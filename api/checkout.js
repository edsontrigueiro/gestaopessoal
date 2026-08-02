// ============================================================
//  POST /api/checkout   { ciclo: "mensal" | "anual" }
//  Devolve { url } para redirecionar ao pagamento.
//
//  O preço vem da variável de ambiente, nunca do navegador —
//  senão daria para pedir checkout de R$ 0,01.
// ============================================================
import { stripeCliente, supabaseServico, usuarioDoToken, json, mesmaOrigem, urlBase, PRECOS } from "./_comum.js";

export default async function handler(req, res){
  if(req.method !== "POST") return json(res, 405, { erro:"metodo" });
  if(!mesmaOrigem(req))     return json(res, 403, { erro:"origem" });

  try{
    const user = await usuarioDoToken(req);
    if(!user) return json(res, 401, { erro:"sem_sessao" });

    const ciclo = (req.body && req.body.ciclo) === "anual" ? "anual" : "mensal";
    const preco = PRECOS[ciclo];
    if(!preco) return json(res, 500, { erro:"preco_nao_configurado", ciclo });

    const sb = supabaseServico();
    const stripe = stripeCliente();

    // reaproveita o cliente do provedor, para não duplicar cadastro
    const { data: ass } = await sb.from("assinaturas")
      .select("cliente_ext").eq("user_id", user.id).maybeSingle();

    let cliente = ass && ass.cliente_ext;
    if(!cliente){
      const { data: perfil } = await sb.from("perfil")
        .select("nome_completo, telefone, tel_ddi").eq("user_id", user.id).maybeSingle();
      const novo = await stripe.customers.create({
        email: user.email,
        name: (perfil && perfil.nome_completo) || undefined,
        phone: (perfil && perfil.telefone) ? `+${perfil.tel_ddi||""}${perfil.telefone}` : undefined,
        metadata: { user_id: user.id }
      });
      cliente = novo.id;
      await sb.from("assinaturas")
        .upsert({ user_id: user.id, cliente_ext: cliente, atualizado_em: new Date().toISOString() },
                { onConflict: "user_id" });
    }

    const base = urlBase(req);
    const sessao = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: cliente,
      line_items: [{ price: preco, quantity: 1 }],
      locale: "pt-BR",
      allow_promotion_codes: true,
      success_url: `${base}/?pagamento=ok`,
      cancel_url:  `${base}/?pagamento=cancelado`,
      // metadata em dois lugares: a sessão e a assinatura criada por ela
      metadata: { user_id: user.id, ciclo },
      subscription_data: { metadata: { user_id: user.id, ciclo } }
    });

    return json(res, 200, { url: sessao.url });
  }catch(e){
    console.error("[checkout]", e);
    return json(res, 500, { erro:"falha", detalhe: e.message });
  }
}
