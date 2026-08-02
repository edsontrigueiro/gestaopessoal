// ============================================================
//  POST /api/portal   →  { url }
//
//  Leva o cliente ao portal do provedor, onde ele troca o cartão,
//  baixa a nota e CANCELA sozinho. Cancelamento fácil é diferencial:
//  a maior queixa contra os concorrentes é cobrança depois do
//  cancelamento. Não repita isso.
// ============================================================
import { stripeCliente, supabaseServico, usuarioDoToken, json, mesmaOrigem, urlBase } from "./_comum.js";

export default async function handler(req, res){
  if(req.method !== "POST") return json(res, 405, { erro:"metodo" });
  if(!mesmaOrigem(req))     return json(res, 403, { erro:"origem" });

  try{
    const user = await usuarioDoToken(req);
    if(!user) return json(res, 401, { erro:"sem_sessao" });

    const sb = supabaseServico();
    const { data: ass } = await sb.from("assinaturas")
      .select("cliente_ext").eq("user_id", user.id).maybeSingle();

    if(!ass || !ass.cliente_ext) return json(res, 400, { erro:"sem_cliente" });

    const stripe = stripeCliente();
    const sessao = await stripe.billingPortal.sessions.create({
      customer: ass.cliente_ext,
      return_url: `${urlBase(req)}/?tela=ajustes`,
      locale: "pt-BR"
    });

    return json(res, 200, { url: sessao.url });
  }catch(e){
    console.error("[portal]", e);
    return json(res, 500, { erro:"falha", detalhe: e.message });
  }
}
