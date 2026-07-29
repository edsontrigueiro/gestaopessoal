// ============================================================
//  CONFIG — falta só a SUPABASE_URL.
//  Onde achar: Supabase → Settings → API → seção Data API
//  Formato: https://xxxxxxxxxxxx.supabase.co
//
//  A chave abaixo é publishable: é pública por design e vai
//  dentro do JS que o navegador baixa. Quem protege os dados
//  é o RLS do schema.sql, não o segredo da chave.
//  NUNCA coloque aqui a secret (sb_secret_) nem a service_role:
//  essas ignoram o RLS e dão acesso total ao banco.
// ============================================================

window.CONFIG = {
  SUPABASE_URL: "https://uoeufxvnafxclflilzag.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_qfb7C2oC_6SMPgm4lJ4G-A_zy79akIf"
};
