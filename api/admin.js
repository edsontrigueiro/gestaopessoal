// ============================================================
//  ZORVEL — /api/admin
//  Toda a área administrativa passa por aqui. Nada de admin
//  é decidido no navegador: o front só desenha o que esta
//  rota devolver, e ela só devolve se o token for de um admin.
//
//  Variável obrigatória na Vercel:
//    ADMIN_IDS = uuid-do-admin[,outro-uuid]
//  (pegue em: select id, email from auth.users where email='...')
// ============================================================
import { supabaseServico, usuarioDoToken, json, mesmaOrigem } from "./_comum.js";

function ehAdmin(user){
  const lista = (process.env.ADMIN_IDS || "")
    .split(",").map(s => s.trim()).filter(Boolean);
  return !!user && lista.includes(user.id);
}

const mesAtual = () => new Date().toISOString().slice(0, 7);

/* ---------- leitura de configuração ---------- */
async function lerConfig(sb){
  const { data } = await sb.from("config_sistema").select("chave,valor");
  const m = {};
  (data || []).forEach(r => { m[r.chave] = r.valor; });
  return m;
}

/* ---------- resumo financeiro ----------
   Faturamento sai da tabela assinaturas, alimentada pelo webhook
   do Stripe. É rápido, mas herda qualquer atraso do webhook:
   se um evento falhar, o número aqui fica velho. */
async function resumo(sb, mes){
  const cfg = await lerConfig(sb);
  const planos = cfg.planos || {};
  const precoMensal = Number(planos.mensal || 0);
  const precoAnual  = Number(planos.anual  || 0);

  const { data: assinaturas } = await sb.from("assinaturas")
    .select("user_id,plano,situacao,ciclo,vale_ate,cancela_no_fim,atualizado_em");

  const todas = assinaturas || [];
  const ativas = todas.filter(a => a.situacao === "ativa");
  const mensais = ativas.filter(a => a.ciclo !== "anual").length;
  const anuais  = ativas.filter(a => a.ciclo === "anual").length;

  // Receita recorrente mensal: a anual entra dividida por 12.
  const mrr = mensais * precoMensal + anuais * (precoAnual / 12);

  const { data: inv } = await sb.from("investimentos")
    .select("mes,valor").eq("mes", mes).maybeSingle();
  const investimento = Number((inv && inv.valor) || 0);

  const { count: totalUsuarios } = await sb
    .from("perfil").select("user_id", { count: "exact", head: true });
  const { count: suspensos } = await sb
    .from("perfil").select("user_id", { count: "exact", head: true }).eq("ativo", false);

  return {
    mes,
    mrr,
    arr: mrr * 12,
    investimento,
    roi: investimento > 0 ? mrr / investimento : null,
    ticket: ativas.length ? mrr / ativas.length : 0,
    assinantes: {
      ativas: ativas.length,
      mensais,
      anuais,
      em_atraso: todas.filter(a => a.situacao === "em_atraso").length,
      canceladas: todas.filter(a => a.situacao === "cancelada").length,
      cancelam_no_fim: ativas.filter(a => a.cancela_no_fim).length
    },
    usuarios: {
      total: totalUsuarios || 0,
      suspensos: suspensos || 0,
      pagantes: ativas.length,
      conversao: totalUsuarios ? ativas.length / totalUsuarios : 0
    },
    precos: { mensal: precoMensal, anual: precoAnual }
  };
}

/* ---------- lista de usuários ---------- */
async function usuarios(sb){
  const { data: lista } = await sb.auth.admin.listUsers({ page: 1, perPage: 200 });
  const brutos = (lista && lista.users) || [];

  const { data: perfis }      = await sb.from("perfil").select("user_id,nome_completo,ativo");
  const { data: assinaturas } = await sb.from("assinaturas").select("user_id,plano,situacao,ciclo,vale_ate");

  const porPerfil = {}; (perfis || []).forEach(p => { porPerfil[p.user_id] = p; });
  const porAss    = {}; (assinaturas || []).forEach(a => { porAss[a.user_id] = a; });

  return brutos.map(u => {
    const p = porPerfil[u.id] || {};
    const a = porAss[u.id] || {};
    return {
      id: u.id,
      email: u.email || "",
      nome: p.nome_completo || "",
      ativo: p.ativo !== false,
      criado_em: u.created_at,
      ultimo_acesso: u.last_sign_in_at,
      plano: a.plano || "gratuito",
      situacao: a.situacao || "sem_assinatura",
      ciclo: a.ciclo || null,
      vale_ate: a.vale_ate || null
    };
  }).sort((x, y) => String(y.criado_em).localeCompare(String(x.criado_em)));
}

// ============================================================
export default async function handler(req, res){
  if(!mesmaOrigem(req)) return json(res, 403, { erro: "origem não permitida" });

  const user = await usuarioDoToken(req);
  if(!user)        return json(res, 401, { erro: "sem sessão" });
  if(!ehAdmin(user)) return json(res, 403, { erro: "não autorizado" });

  const sb = supabaseServico();

  try{
    if(req.method === "GET"){
      const acao = String(req.query.acao || "");

      if(acao === "eu")      return json(res, 200, { admin: true, email: user.email });
      if(acao === "resumo")  return json(res, 200, await resumo(sb, String(req.query.mes || mesAtual())));
      if(acao === "usuarios")return json(res, 200, { usuarios: await usuarios(sb) });
      if(acao === "config"){
        const cfg = await lerConfig(sb);
        const { data: invs } = await sb.from("investimentos")
          .select("mes,valor").order("mes", { ascending: false }).limit(24);
        return json(res, 200, { config: cfg, investimentos: invs || [] });
      }
      return json(res, 400, { erro: "ação desconhecida" });
    }

    if(req.method === "POST"){
      const corpo = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
      const acao = String(corpo.acao || "");

      if(acao === "ativo"){
        if(!corpo.user_id) return json(res, 400, { erro: "falta user_id" });
        if(corpo.user_id === user.id)
          return json(res, 400, { erro: "você não pode suspender a própria conta" });
        const { error } = await sb.from("perfil")
          .update({ ativo: !!corpo.ativo }).eq("user_id", corpo.user_id);
        if(error) return json(res, 500, { erro: error.message });
        return json(res, 200, { ok: true, ativo: !!corpo.ativo });
      }

      if(acao === "config"){
        if(!corpo.chave) return json(res, 400, { erro: "falta chave" });
        const { error } = await sb.from("config_sistema").upsert(
          { chave: corpo.chave, valor: corpo.valor || {}, atualizado: new Date().toISOString() },
          { onConflict: "chave" });
        if(error) return json(res, 500, { erro: error.message });
        return json(res, 200, { ok: true });
      }

      if(acao === "investimento"){
        const mes = String(corpo.mes || mesAtual());
        const { error } = await sb.from("investimentos").upsert(
          { mes, valor: Number(corpo.valor || 0), nota: corpo.nota || "",
            atualizado: new Date().toISOString() },
          { onConflict: "mes" });
        if(error) return json(res, 500, { erro: error.message });
        return json(res, 200, { ok: true });
      }

      return json(res, 400, { erro: "ação desconhecida" });
    }

    return json(res, 405, { erro: "método não permitido" });
  }catch(e){
    console.error("[admin]", e);
    return json(res, 500, { erro: e.message });
  }
}
