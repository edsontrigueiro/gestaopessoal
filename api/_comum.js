// ============================================================
//  ZORVEL — helpers das funções de servidor
//  Nada aqui vai para o navegador. As chaves ficam só na Vercel.
// ============================================================
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

export const PRECOS = {
  mensal: process.env.STRIPE_PRECO_MENSAL,
  anual:  process.env.STRIPE_PRECO_ANUAL
};

export function stripeCliente(){
  const chave = process.env.STRIPE_SECRET_KEY;
  if(!chave) throw new Error("Falta STRIPE_SECRET_KEY nas variáveis de ambiente da Vercel.");
  return new Stripe(chave);
}

/* Cliente com a chave de serviço: ignora RLS. Só existe no servidor.
   É o único caminho que pode escrever em assinaturas. */
export function supabaseServico(){
  const url = process.env.SUPABASE_URL;
  const chave = process.env.SUPABASE_SERVICE_KEY;
  if(!url || !chave) throw new Error("Faltam SUPABASE_URL ou SUPABASE_SERVICE_KEY na Vercel.");
  return createClient(url, chave, { auth: { persistSession:false, autoRefreshToken:false } });
}

/* Confere o token do usuário que veio do navegador e devolve quem é.
   Sem isso, qualquer um poderia abrir checkout no nome de outro. */
export async function usuarioDoToken(req){
  const cab = req.headers.authorization || req.headers.Authorization || "";
  const token = cab.startsWith("Bearer ") ? cab.slice(7) : null;
  if(!token) return null;
  const sb = supabaseServico();
  const { data, error } = await sb.auth.getUser(token);
  if(error || !data.user) return null;
  return data.user;
}

export function json(res, status, corpo){
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.status(status).send(JSON.stringify(corpo));
}

/* O site é servido do mesmo domínio, então não abrimos CORS para terceiros. */
export function mesmaOrigem(req){
  const origem = req.headers.origin;
  if(!origem) return true;                       // chamada sem origem: navegação direta
  const host = req.headers.host || "";
  try{ return new URL(origem).host === host; }catch(e){ return false; }
}

export const urlBase = req =>
  process.env.URL_PUBLICA || `https://${req.headers.host}`;
