// ============================================================
//  POST /api/webhook
//  Único caminho que escreve em assinaturas.
//
//  Três cuidados que, se faltarem, o sistema fura:
//   1. assinatura verificada com o corpo CRU — se o corpo for
//      lido como JSON antes, a verificação falha sempre;
//   2. idempotência por id do evento — o provedor reenvia;
//   3. responder 200 rápido, senão ele repete achando que caiu.
// ============================================================
import { stripeCliente, supabaseServico } from "./_comum.js";

// desliga o parser automático da Vercel: precisamos do corpo cru
export const config = { api: { bodyParser: false } };

function corpoCru(req){
  return new Promise((ok, erro)=>{
    const partes = [];
    req.on("data", p => partes.push(p));
    req.on("end", ()=> ok(Buffer.concat(partes)));
    req.on("error", erro);
  });
}

/* Traduz o estado do provedor para o nosso vocabulário. */
function situacaoDe(s){
  if(s === "active" || s === "trialing")            return "ativa";
  if(s === "past_due" || s === "unpaid")            return "em_atraso";
  if(s === "canceled" || s === "incomplete_expired") return "cancelada";
  return "sem_assinatura";
}

async function gravar(sb, userId, campos){
  if(!userId) return;
  await sb.from("assinaturas").upsert(
    { user_id: userId, ...campos, atualizado_em: new Date().toISOString() },
    { onConflict: "user_id" });
}

/* Descobre de quem é a assinatura: primeiro pelo metadata, depois
   pelo id do cliente já gravado. */
async function acharUsuario(sb, obj){
  const meta = (obj.metadata && obj.metadata.user_id) || null;
  if(meta) return meta;
  const cliente = typeof obj.customer === "string" ? obj.customer : (obj.customer && obj.customer.id);
  if(!cliente) return null;
  const { data } = await sb.from("assinaturas")
    .select("user_id").eq("cliente_ext", cliente).maybeSingle();
  return data ? data.user_id : null;
}

export default async function handler(req, res){
  if(req.method !== "POST"){ res.status(405).end(); return; }

  let evento;
  try{
    const stripe = stripeCliente();
    const cru = await corpoCru(req);
    const assinatura = req.headers["stripe-signature"];
    const segredo = process.env.STRIPE_WEBHOOK_SECRET;
    if(!segredo) throw new Error("Falta STRIPE_WEBHOOK_SECRET.");
    evento = stripe.webhooks.constructEvent(cru, assinatura, segredo);
  }catch(e){
    console.error("[webhook] assinatura inválida:", e.message);
    res.status(400).send(`assinatura inválida: ${e.message}`);
    return;
  }

  try{
    const sb = supabaseServico();

    // já processado? responde 200 e sai — o provedor reenvia de propósito
    const { data: visto } = await sb.from("eventos_pagto")
      .select("id").eq("id", evento.id).maybeSingle();
    if(visto){ res.status(200).send("repetido"); return; }

    const obj = evento.data.object;
    const stripe = stripeCliente();

    switch(evento.type){

      case "checkout.session.completed": {
        if(obj.mode !== "subscription") break;
        const userId = await acharUsuario(sb, obj);
        const assId = typeof obj.subscription === "string" ? obj.subscription : null;
        if(!assId) break;
        const ass = await stripe.subscriptions.retrieve(assId);
        const item = ass.items.data[0];
        await gravar(sb, userId, {
          plano: "pro",
          situacao: situacaoDe(ass.status),
          ciclo: (ass.metadata && ass.metadata.ciclo)
                 || (item && item.price && item.price.recurring && item.price.recurring.interval === "year" ? "anual" : "mensal"),
          cliente_ext: typeof obj.customer === "string" ? obj.customer : null,
          assinatura_ext: assId,
          vale_ate: ass.current_period_end ? new Date(ass.current_period_end * 1000).toISOString() : null,
          cancela_no_fim: !!ass.cancel_at_period_end
        });
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const userId = await acharUsuario(sb, obj);
        const item = obj.items && obj.items.data && obj.items.data[0];
        const sit = situacaoDe(obj.status);
        await gravar(sb, userId, {
          plano: sit === "cancelada" ? "gratuito" : "pro",
          situacao: obj.cancel_at_period_end && sit === "ativa" ? "periodo_final" : sit,
          ciclo: (obj.metadata && obj.metadata.ciclo)
                 || (item && item.price && item.price.recurring && item.price.recurring.interval === "year" ? "anual" : "mensal"),
          assinatura_ext: obj.id,
          vale_ate: obj.current_period_end ? new Date(obj.current_period_end * 1000).toISOString() : null,
          cancela_no_fim: !!obj.cancel_at_period_end
        });
        break;
      }

      case "customer.subscription.deleted": {
        const userId = await acharUsuario(sb, obj);
        await gravar(sb, userId, {
          plano: "gratuito", situacao: "cancelada",
          cancela_no_fim: false,
          vale_ate: obj.ended_at ? new Date(obj.ended_at * 1000).toISOString() : new Date().toISOString()
        });
        break;
      }

      case "invoice.paid": {
        // renovação: estende o acesso
        const assId = typeof obj.subscription === "string" ? obj.subscription : null;
        if(!assId) break;
        const ass = await stripe.subscriptions.retrieve(assId);
        const userId = await acharUsuario(sb, ass);
        await gravar(sb, userId, {
          plano: "pro", situacao: "ativa",
          vale_ate: ass.current_period_end ? new Date(ass.current_period_end * 1000).toISOString() : null
        });
        break;
      }

      case "invoice.payment_failed": {
        const assId = typeof obj.subscription === "string" ? obj.subscription : null;
        if(!assId) break;
        const ass = await stripe.subscriptions.retrieve(assId);
        const userId = await acharUsuario(sb, ass);
        // não corta o acesso na hora: o provedor ainda vai tentar de novo
        await gravar(sb, userId, { situacao: "em_atraso" });
        break;
      }
    }

    await sb.from("eventos_pagto").insert({ id: evento.id, tipo: evento.type });
    res.status(200).send("ok");

  }catch(e){
    console.error("[webhook]", evento && evento.type, e);
    // 500 faz o provedor tentar de novo, que é o certo em falha nossa
    res.status(500).send("erro ao processar");
  }
}
