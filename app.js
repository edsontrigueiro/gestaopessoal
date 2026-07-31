// ============================================================
//  NEXVOT — Gestão Inteligente · app.js (v12)
//  Requer: schema.sql → schema2 → schema3 → schema4 → schema5
//  e i18n.js carregado antes deste arquivo.
// ============================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

window.__OK__ = true;
let sb = null;

const $  = id => document.getElementById(id);
const $$ = s  => Array.from(document.querySelectorAll(s));
function fatal(msg){
  const el = $("splash-txt");
  if(el){ el.className = "st erro"; el.textContent = msg; }
  console.error("[NexVot]", msg);
}

/* ================= IDIOMA ================= */
let idioma = "pt";
function t(k, vars){
  const D = window.I18N;
  let s = (D && ((D[idioma] && D[idioma][k]) || (D.pt && D.pt[k]))) || k;
  if(vars) for(const [a,b] of Object.entries(vars)) s = String(s).replace("{"+a+"}", b);
  return s;
}
const VAZIO_LISTAS = { cat:{ pessoal:{saida:[],entrada:[],investimento:[]},
                             empresa:{saida:[],entrada:[],investimento:[]} },
                       dias:["","","","","","",""], diasCurto:["","","","","","",""] };
const listas = () => (window.I18N_LISTAS && (window.I18N_LISTAS[idioma] || window.I18N_LISTAS.pt)) || VAZIO_LISTAS;
const CATS   = () => listas().cat;
const DIAS   = () => listas().dias;
const DIASC  = () => listas().diasCurto;
const locale = () => idioma==="en" ? "en-US" : idioma==="es" ? "es-ES" : "pt-BR";
const simb   = () => idioma==="en" ? "$" : idioma==="es" ? "€" : "R$";

function aplicarTextos(){
  $$("[data-i]").forEach(e => e.textContent = t(e.dataset.i));
  $$("[data-ip]").forEach(e => e.placeholder = t(e.dataset.ip));
  const la = $("lang-atual"); if(la) la.textContent = idioma.toUpperCase();
  document.documentElement.lang = idioma === "pt" ? "pt-BR" : idioma;
  $$("#auth-lang button").forEach(b => b.classList.toggle("on", b.dataset.l === idioma));
  $$("#pop-lang [data-lang]").forEach(b => b.classList.toggle("on", b.dataset.lang === idioma));
}
async function trocarIdioma(l){
  idioma = l;
  try{ localStorage.setItem("nexvot:idioma", l); }catch(e){}
  aplicarTextos();
  if(user && sb) sb.from("perfil").upsert({ user_id:user.id, idioma:l, atualizado:new Date().toISOString() }).then(()=>{});
  if(!$("app").hidden) render();
}

/* ================= ESTADO ================= */
let user = null, perfil = null;
let espaco = "pessoal", tela = "painel", periodo = "mes";
let calRef = null, selDia = null, rtDia = null, blocoAberto = null;
let dataAlvo = null, tipoSel = "saida", catSel = null, natSel = "essencial", membroSel = null, dig = "";
let importados = [];
const avisados = new Set();

const db = { lancamentos:[], contas:[], habitos:[], marcas:[], fechados:[], eventos:[],
             membros:[], blocos:[], tarefas:[], orcamentos:[], recorrencias:[], metas:[] };

const TELAS = ["painel","fluxo","orcamento","recorrencias","metas","rotina","agenda","relatorios","ajustes"];
const ICONES = {
  painel:'<svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="8" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="3" y="15" width="7" height="6" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/></svg>',
  fluxo:'<svg viewBox="0 0 24 24"><path d="M3 17l5-6 4 3 5-7 4 4"/><path d="M3 21h18"/></svg>',
  orcamento:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 3v9l6 3"/></svg>',
  recorrencias:'<svg viewBox="0 0 24 24"><path d="M4 10a8 8 0 0113.7-5.6L20 7"/><path d="M20 4v4h-4"/><path d="M20 14a8 8 0 01-13.7 5.6L4 17"/><path d="M4 20v-4h4"/></svg>',
  metas:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1"/></svg>',
  rotina:'<svg viewBox="0 0 24 24"><path d="M4 7h3M4 12h3M4 17h3"/><path d="M10 7h10M10 12h10M10 17h10"/></svg>',
  agenda:'<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2.5"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
  relatorios:'<svg viewBox="0 0 24 24"><path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/></svg>',
  ajustes:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="9"/></svg>'
};
const TITULO = { painel:["painel.titulo","painel.sub"], fluxo:["nav.fluxo","sec.fluxo.sub"],
  orcamento:["nav.orcamento","sec.orcamento.sub"], recorrencias:["nav.recorrencias","sec.recorrencias.sub"],
  metas:["nav.metas","sec.metas.sub"], rotina:["nav.rotinaDia","sec.rotinaHoje"],
  agenda:["nav.agenda","sec.compromissos"], relatorios:["nav.relatorios","sec.fechamento.sub"],
  ajustes:["nav.ajustes","sec.idioma.sub"] };

/* ================= UTILIDADES ================= */
const isoDe = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
const hoje  = () => isoDe(new Date());
const mesDe = s => s.slice(0,7);
const ultDia = (a,m) => new Date(a,m,0).getDate();
const dtMes = (a,m,d) => `${a}-${String(m).padStart(2,"0")}-${String(Math.min(Math.max(d,1),ultDia(a,m))).padStart(2,"0")}`;
const dif   = (a,b) => Math.round((new Date(b+"T00:00:00") - new Date(a+"T00:00:00"))/86400000);
const mais  = (s,n) => { const d = new Date(s+"T00:00:00"); d.setDate(d.getDate()+n); return isoDe(d); };
const dsem  = s => new Date(s+"T00:00:00").getDay();
const num   = n => Number(n).toLocaleString(locale(), {minimumFractionDigits:2, maximumFractionDigits:2});
const din   = n => simb() + " " + num(n);
const din0  = n => { const a=Math.abs(n);
  const s = a>=1000000 ? (a/1000000).toFixed(1).replace(".",",")+"M"
          : a>=1000 ? (a/1000).toFixed(a>=10000?0:1).replace(".",",")+"k" : String(Math.round(a));
  return (n<0?"-":"") + simb() + " " + s; };
const esc = s => String(s==null?"":s).replace(/[&<>"]/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const numBR = s => { const x=String(s).replace(/[^\d,.-]/g,"").replace(/\.(?=\d{3}\b)/g,"").replace(",","."); const n=parseFloat(x); return isFinite(n)?n:0; };
const ext = (s,o) => new Date(s+"T00:00:00").toLocaleDateString(locale(), o||{weekday:"long",day:"2-digit",month:"long"});
const curto = s => new Date(s+"T00:00:00").toLocaleDateString(locale(), {day:"2-digit",month:"2-digit"});
const hm = h => h ? h.slice(0,5) : "";
const cor = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const vibra = ms => { try{ navigator.vibrate && navigator.vibrate(ms||8); }catch(e){} };
const cap = s => String(s).charAt(0).toUpperCase() + String(s).slice(1);

let tToast = null;
function toast(txt, erro){
  let el = $("toast");
  if(!el){ el = document.createElement("div"); el.id="toast"; el.className="toast"; document.body.appendChild(el); }
  el.textContent = txt;
  el.style.borderColor = erro ? cor("--vermelho") : cor("--linha");
  el.style.color = erro ? cor("--vermelho") : cor("--txt");
  clearTimeout(tToast); tToast = setTimeout(()=>el.remove(), erro?4500:2000);
}
const falhou = e => { console.error(e); toast((e && e.message) || t("msg.falhaSalvar"), true); };
const ICO = { seta:'<svg viewBox="0 0 24 24"><path d="M7 17L17 7M17 7H9M17 7v8"/></svg>',
              x:'<svg viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"/></svg>',
              ok:'<svg viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg>' };

/* ================= TEMA ================= */
/* preferência guardada: claro · escuro · sistema. O que a tela usa é o resolvido. */
let temaPref = "escuro";
const mqEscuro = window.matchMedia("(prefers-color-scheme: dark)");
const resolverTema = () => temaPref === "sistema" ? (mqEscuro.matches ? "escuro" : "claro") : temaPref;
const SOL  = '<circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5 5l1.5 1.5M17.5 17.5L19 19M19 5l-1.5 1.5M6.5 17.5L5 19"/>';
const LUA  = '<path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z"/>';
const TELA = '<rect x="2.5" y="4" width="19" height="13" rx="2"/><path d="M8.5 21h7M12 17v4"/>';

function aplicarTema(pref, salvar){
  temaPref = pref;
  const real = resolverTema();
  document.documentElement.dataset.tema = real;
  try{ localStorage.setItem("nexvot:tema", pref); }catch(e){}
  const meta = document.querySelector('meta[name="theme-color"]');
  if(meta) meta.setAttribute("content", real==="escuro" ? "#0A0A0B" : "#F7F8FA");
  const ic = $("ic-tema");
  if(ic) ic.innerHTML = pref==="sistema" ? TELA : (real==="escuro" ? LUA : SOL);
  $$("#pop-tema .pop-i").forEach(b => b.classList.toggle("on", b.dataset.tema===pref));
  if(salvar!==false && user && sb)
    sb.from("perfil").upsert({ user_id:user.id, tema: real, atualizado:new Date().toISOString() }).then(()=>{});
  if(!$("app").hidden) render();
}
mqEscuro.addEventListener("change", ()=>{ if(temaPref==="sistema") aplicarTema("sistema", false); });

/* ================= ABERTURA ================= */
async function boot(){
  // Os arquivos irmãos são conferidos ANTES de qualquer coisa usar tradução.
  if(!window.I18N || !window.I18N.pt)
    return fatal("O i18n.js não carregou. Confira se o arquivo está na raiz do repositório, "
               + "com o nome exato i18n.js, e se o commit chegou na Vercel.");
  if(!window.I18N_LISTAS)
    return fatal("O i18n.js carregou incompleto: falta o bloco I18N_LISTAS no fim do arquivo. "
               + "Cole o arquivo inteiro, do começo ao fim.");
  if(!window.CONFIG)
    return fatal("O config.js não carregou. Confira se o arquivo está na raiz do repositório.");

  try{ idioma = localStorage.getItem("nexvot:idioma") || (navigator.language||"pt").slice(0,2); }catch(e){}
  if(!["pt","en","es"].includes(idioma)) idioma = "pt";
  aplicarTextos();

  const url = String(window.CONFIG.SUPABASE_URL||"").trim();
  const key = String(window.CONFIG.SUPABASE_ANON_KEY||"").trim();
  if(!/^https:\/\/[a-z0-9-]+\.supabase\.(co|in)\/?$/i.test(url)) return fatal("SUPABASE_URL inválida: \""+url+"\"");
  if(!key || key.includes("COLE-AQUI")) return fatal("A chave ainda é o valor de exemplo.");
  if(key.startsWith("sb_secret_")) return fatal("Essa é a chave SECRET. Use a publishable.");

  try{ sb = createClient(url, key); }catch(e){ return fatal("createClient falhou: "+e.message); }

  let ses;
  try{
    const r = await Promise.race([ sb.auth.getSession(),
      new Promise((_,x)=>setTimeout(()=>x(new Error("tempo esgotado")),12000)) ]);
    ses = r.data.session;
  }catch(e){ return fatal("Não consegui falar com o Supabase ("+e.message+")."); }

  let prefSalva = "escuro";
  try{ prefSalva = localStorage.getItem("nexvot:tema") || "escuro"; }catch(e){}
  aplicarTema(prefSalva, false);
  $("splash").hidden = true;
  if(ses && !ses.user.is_anonymous){ user = ses.user; return entrar(); }
  if(ses){ try{ await sb.auth.signOut(); }catch(e){} }
  telaAuth();
}

let modoAuth = "entrar";
function telaAuth(){
  $("auth").hidden = false;
  $$("#auth-tabs button").forEach(b => b.onclick = ()=>{
    modoAuth = b.dataset.m;
    $$("#auth-tabs button").forEach(x => x.classList.toggle("on", x.dataset.m===modoAuth));
    $("a-ok").textContent = t(modoAuth==="entrar" ? "auth.entrar" : "auth.criar");
    $("a-senha").setAttribute("autocomplete", modoAuth==="entrar" ? "current-password" : "new-password");
    $("a-msg").textContent = "";
  });
  $$("#auth-lang button").forEach(b => b.onclick = ()=>trocarIdioma(b.dataset.l));
  $("a-ok").onclick = autenticar;
  ["a-email","a-senha"].forEach(k => $(k).addEventListener("keydown", e=>{ if(e.key==="Enter") autenticar(); }));
}

async function autenticar(){
  const msg = $("a-msg"), email = $("a-email").value.trim(), senha = $("a-senha").value;
  if(!email || !senha){ msg.className="msg erro"; msg.textContent=t("auth.preencha"); return; }
  if(modoAuth==="criar" && senha.length < 6){ msg.className="msg erro"; msg.textContent=t("auth.senhaCurta"); return; }
  msg.className="msg"; msg.textContent = t(modoAuth==="entrar" ? "auth.entrando" : "auth.criando");
  $("a-ok").disabled = true;
  const r = modoAuth==="entrar"
    ? await sb.auth.signInWithPassword({ email, password:senha })
    : await sb.auth.signUp({ email, password:senha });
  $("a-ok").disabled = false;
  if(r.error){
    msg.className="msg erro";
    msg.textContent = r.error.message.includes("Invalid login") ? t("auth.invalido") : r.error.message;
    return;
  }
  if(!r.data.session){ msg.className="msg ok"; msg.textContent = t("auth.confirme"); return; }
  user = r.data.user; msg.textContent = "";
  $("auth").hidden = true;
  entrar();
}

async function entrar(){
  $("auth").hidden = true;
  $("app").hidden = false;
  $("fab").hidden = false;
  const nome = (user.email||"").split("@")[0];
  $("avatar").textContent = (nome[0]||"N").toUpperCase();
  $("perfil-nome").textContent = cap(nome);
  $("perfil-email").textContent = user.email || "";
  $("pop-nome").textContent = cap(nome);
  $("pop-email").textContent = user.email || "";
  selDia = hoje(); rtDia = hoje(); dataAlvo = hoje();
  calRef = { a:+selDia.slice(0,4), m:+selDia.slice(5,7) };
  try{ espaco = localStorage.getItem("nexvot:espaco") || "pessoal"; }catch(e){}
  ligar();
  await carregar();
  await materializarRecorrencias();
  irPara("painel");
  setInterval(checarLembretes, 30000);
}

/* ================= DADOS ================= */
async function carregar(){
  const r = await Promise.all([
    sb.from("lancamentos").select("*").order("data",{ascending:false}),
    sb.from("contas").select("*"),
    sb.from("habitos").select("*").order("ordem"),
    sb.from("habito_marcas").select("*"),
    sb.from("dias_fechados").select("*"),
    sb.from("eventos").select("*").order("data"),
    sb.from("membros").select("*").order("criado_em"),
    sb.from("blocos_rotina").select("*").order("hora"),
    sb.from("tarefas").select("*").order("hora"),
    sb.from("orcamentos").select("*"),
    sb.from("recorrencias").select("*").order("dia"),
    sb.from("metas").select("*").order("criado_em"),
    sb.from("perfil").select("*").eq("user_id", user.id).maybeSingle()
  ]);
  const err = r.find(x=>x.error);
  if(err) return falhou(err.error);
  const [l,c,h,m,f,e,mb,bl,tf,orc,rec,mt,pf] = r;
  db.lancamentos  = (l.data||[]).map(x=>({...x, valor:Number(x.valor)}));
  db.contas       = (c.data||[]).map(x=>({...x, valor:Number(x.valor||0)}));
  db.habitos = h.data||[]; db.marcas = m.data||[];
  db.fechados = (f.data||[]).map(x=>x.data);
  db.eventos = e.data||[]; db.membros = mb.data||[];
  db.blocos = bl.data||[]; db.tarefas = tf.data||[];
  db.orcamentos   = (orc.data||[]).map(x=>({...x, valor_mes:Number(x.valor_mes)}));
  db.recorrencias = (rec.data||[]).map(x=>({...x, valor:Number(x.valor)}));
  db.metas        = (mt.data||[]).map(x=>({...x, alvo:Number(x.alvo)}));
  perfil = pf.data || null;
  if(perfil && perfil.idioma && perfil.idioma !== idioma){ idioma = perfil.idioma; aplicarTextos(); }
  if(!db.membros.length){
    const { data:n } = await sb.from("membros").insert({ user_id:user.id, nome:"Você", eh_voce:true }).select().single();
    if(n) db.membros = [n];
  }
}

async function materializarRecorrencias(){
  const h = hoje(), ym = mesDe(h), a=+ym.slice(0,4), m=+ym.slice(5,7), diaHoje=+h.slice(8,10);
  const criar = [];
  for(const r of db.recorrencias){
    if(!r.ativo || r.ultimo_gerado === ym) continue;
    if(r.dia > diaHoje) continue;
    criar.push({ rec:r, linha:{
      user_id:user.id, espaco:r.espaco, tipo:r.tipo, data:dtMes(a,m,r.dia), valor:r.valor,
      categoria:r.categoria, nota:r.descricao||"", natureza:r.natureza||null,
      membro_id:r.membro_id||null, recorrencia_id:r.id }});
  }
  if(!criar.length) return;
  const { data, error } = await sb.from("lancamentos").insert(criar.map(x=>x.linha)).select();
  if(error) return falhou(error);
  db.lancamentos.unshift(...data.map(x=>({...x, valor:Number(x.valor)})));
  db.lancamentos.sort((x,y)=>y.data.localeCompare(x.data));
  await Promise.all(criar.map(x => sb.from("recorrencias").update({ ultimo_gerado: ym }).eq("id", x.rec.id)));
  criar.forEach(x => x.rec.ultimo_gerado = ym);
  toast(criar.length + " " + t("msg.geradas"));
}

/* ================= SELEÇÕES E CÁLCULOS ================= */
const lancs   = () => db.lancamentos.filter(x=>x.espaco===espaco);
const contas  = () => db.contas.filter(x=>x.espaco===espaco);
const evts    = () => db.eventos.filter(x=>x.espaco===espaco);
const orcs    = () => db.orcamentos.filter(x=>x.espaco===espaco);
const recs    = () => db.recorrencias.filter(x=>x.espaco===espaco);
const metas   = () => db.metas.filter(x=>x.espaco===espaco);
const soma    = a => a.reduce((s,x)=>s+x.valor,0);
const noDia   = (d,tp) => lancs().filter(x=>x.data===d && (!tp||x.tipo===tp));
const noMes   = (y,tp) => lancs().filter(x=>mesDe(x.data)===y && (!tp||x.tipo===tp));
const entra   = d => soma(noDia(d,"entrada"));
const saiu    = d => soma(noDia(d,"saida"));
const investe = d => soma(noDia(d,"investimento"));

function janela(){
  const h = hoje();
  if(periodo==="hoje") return [h,h];
  if(periodo==="7")    return [mais(h,-6), h];
  if(periodo==="30")   return [mais(h,-29), h];
  const a=+h.slice(0,4), m=+h.slice(5,7);
  return [dtMes(a,m,1), h];
}
function mesAnt(y){ const a=+y.slice(0,4), m=+y.slice(5,7); return m===1?`${a-1}-12`:`${a}-${String(m-1).padStart(2,"0")}`; }
function venc(c){
  const h=hoje(), a=+h.slice(0,4), m=+h.slice(5,7);
  if(c.ultimo_pago===mesDe(h)){ const mm=m===12?1:m+1, aa=m===12?a+1:a; return dtMes(aa,mm,c.dia); }
  return dtMes(a,m,c.dia);
}
const contasOrd = () => [...contas()].sort((x,y)=>venc(x).localeCompare(venc(y)));
const contasDia = d => { const a=+d.slice(0,4), m=+d.slice(5,7); return contas().filter(c=>dtMes(a,m,c.dia)===d); };
const evtsDia   = d => evts().filter(e=>e.data===d).sort((x,y)=>(x.hora||"99").localeCompare(y.hora||"99"));
const marcado   = (id,d) => db.marcas.some(x=>x.habito_id===id && x.data===d);
const tarefasDia= d => db.tarefas.filter(x=>x.data===d).sort((a,b)=>(a.hora||"99").localeCompare(b.hora||"99"));
const itensBloco= (id,d) => db.habitos.filter(x=>x.bloco_id===id && (x.dia_semana==null || x.dia_semana===dsem(d))).sort((a,b)=>(a.ordem||0)-(b.ordem||0));
const nomeM     = id => (db.membros.find(m=>m.id===id)||{}).nome || "—";
function rank(y){ const s={}; noMes(y,"saida").forEach(x=>{ s[x.categoria]=(s[x.categoria]||0)+x.valor; }); return Object.entries(s).sort((a,b)=>b[1]-a[1]); }

function folego(){
  const h=hoje(), y=mesDe(h), d=+h.slice(8,10);
  const disp = soma(noMes(y,"entrada")) - soma(noMes(y,"saida")) - soma(noMes(y,"investimento"));
  const gastoDia = soma(noMes(y,"saida")) / Math.max(d,1);
  if(gastoDia <= 0) return { dias:null, disp };
  return { dias: Math.max(0, Math.floor(disp/gastoDia)), disp };
}
function usoOrcamento(){
  const y = mesDe(hoje());
  return orcs().map(o=>{
    const gasto = soma(noMes(y,"saida").filter(x=>x.categoria===o.categoria));
    const pct = o.valor_mes>0 ? (gasto/o.valor_mes)*100 : 0;
    return { ...o, gasto, pct };
  }).sort((a,b)=>b.pct-a.pct);
}
const estourados = () => usoOrcamento().filter(o=>o.pct>100).length;

function fechamento(){
  const y = mesDe(hoje()), ant = mesAnt(y);
  const bloco = ym => ({ entrada:soma(noMes(ym,"entrada")), saida:soma(noMes(ym,"saida")), invest:soma(noMes(ym,"investimento")) });
  const a=bloco(y), b=bloco(ant);
  const catA={}, catB={};
  noMes(y,"saida").forEach(x=>catA[x.categoria]=(catA[x.categoria]||0)+x.valor);
  noMes(ant,"saida").forEach(x=>catB[x.categoria]=(catB[x.categoria]||0)+x.valor);
  const deltas = Object.keys({...catA,...catB}).map(k=>({cat:k, d:(catA[k]||0)-(catB[k]||0)})).sort((x,y2)=>y2.d-x.d);
  return { a, b, temAnterior:(b.entrada+b.saida+b.invest)>0,
    saldoA:a.entrada-a.saida-a.invest, saldoB:b.entrada-b.saida-b.invest,
    alta:deltas[0], queda:deltas[deltas.length-1] };
}
function disciplina(){
  const fech = new Set(db.fechados), dias = {};
  lancs().filter(x=>x.tipo==="saida").forEach(x=>{
    if(!dias[x.data]) dias[x.data] = { total:0, futil:0 };
    dias[x.data].total += x.valor;
    if(x.natureza==="futil") dias[x.data].futil += x.valor;
  });
  const com=[], sem=[];
  Object.entries(dias).forEach(([d,v]) => (fech.has(d) ? com : sem).push(v));
  if(com.length<2 || sem.length<2) return null;
  const med = arr => ({ total: arr.reduce((s,x)=>s+x.total,0)/arr.length, futil: arr.reduce((s,x)=>s+x.futil,0)/arr.length });
  const mc=med(com), ms=med(sem);
  const p = ms.futil>0 ? Math.round(((mc.futil-ms.futil)/ms.futil)*100) : 0;
  return { com:com.length, sem:sem.length, mc, ms, p:Math.abs(p), dir: p<0?"menor":"maior" };
}
function progressoMeta(m){
  const rel = lancs().filter(x=>x.tipo==="investimento" && (!m.categoria || x.categoria===m.categoria));
  const feito = soma(rel);
  const pct = Math.min(100, (feito/m.alvo)*100);
  const meses = new Set(rel.map(x=>mesDe(x.data)));
  const ritmo = meses.size ? feito/meses.size : 0;
  const faltam = Math.max(0, m.alvo-feito);
  return { feito, pct, faltam, prev: ritmo>0 ? Math.ceil(faltam/ritmo) : null };
}

/* ================= GRÁFICOS ================= */
function caminhoSuave(pts, tn=0.32){
  if(pts.length<2) return "";
  let d = `M ${pts[0][0].toFixed(2)} ${pts[0][1].toFixed(2)}`;
  for(let i=0;i<pts.length-1;i++){
    const p0=pts[i-1]||pts[i], p1=pts[i], p2=pts[i+1], p3=pts[i+2]||pts[i+1];
    const c1x=p1[0]+(p2[0]-p0[0])*tn/3, c1y=p1[1]+(p2[1]-p0[1])*tn/3;
    const c2x=p2[0]-(p3[0]-p1[0])*tn/3, c2y=p2[1]-(p3[1]-p1[1])*tn/3;
    d += ` C ${c1x.toFixed(2)} ${c1y.toFixed(2)}, ${c2x.toFixed(2)} ${c2y.toFixed(2)}, ${p2[0].toFixed(2)} ${p2[1].toFixed(2)}`;
  }
  return d;
}
function grafArea(series, rotulos, alt){
  const vazioAntes = !series.flatMap(s=>s.dados).some(v=>v!==0);
  const W=1000, H=vazioAntes ? 120 : (alt||280), pt=14, pb=8;
  const todos = series.flatMap(s=>s.dados);
  const vMax = Math.max(...todos, 1), vMin = Math.min(...todos, 0);
  const amp = (vMax-vMin) || 1, n = rotulos.length;
  const px = i => (i/Math.max(n-1,1))*W;
  const py = v => pt + (1-(v-vMin)/amp)*(H-pt-pb);
  const temDado = todos.some(v=>v!==0);
  const grades = [0,.25,.5,.75,1].map(f=>{
    const y = pt + f*(H-pt-pb);
    return `<line x1="0" y1="${y.toFixed(1)}" x2="${W}" y2="${y.toFixed(1)}" stroke="${cor("--linha")}" stroke-width="1" ${f<1?'stroke-dasharray="3 6"':""}/>`;
  }).join("");
  const camadas = series.map((s,k)=>{
    const pts = s.dados.map((v,i)=>[px(i), py(v)]);
    const d = caminhoSuave(pts);
    const base = py(Math.max(vMin,0));
    return `<defs><linearGradient id="gr${k}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${s.cor}" stop-opacity=".30"/>
        <stop offset="100%" stop-color="${s.cor}" stop-opacity="0"/></linearGradient></defs>
      <path d="${d} L ${px(n-1).toFixed(2)} ${base.toFixed(2)} L 0 ${base.toFixed(2)} Z" fill="url(#gr${k})"/>
      <path d="${d}" fill="none" stroke="${s.cor}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>`;
  }).join("");
  const passo = Math.max(1, Math.ceil(n/7));
  const eixoX = rotulos.map((r,i)=> (i%passo===0 || i===n-1) ? `<span>${esc(r)}</span>` : "").filter(Boolean).join("");
  const eixoY = temDado
    ? `<div class="eixo-y"><span>${din0(vMax)}</span><span>${din0(vMin+amp*.5)}</span><span>${din0(vMin)}</span></div>`
    : "";
  return `<div class="${temDado?"com-y":""}">
    ${eixoY}
    <div class="graf">
      <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" style="height:${H}px" role="img">${grades}${temDado?camadas:""}</svg>
      ${!temDado?`<div class="graf-vazio">${t("vazio.grafico")}</div>`:""}
    </div>
    ${temDado?`<div class="graf-x">${eixoX}</div>`:""}</div>`;
}
function grafBarras(dias, ins, outs, alt){
  const vazio = !ins.some(v=>v>0) && !outs.some(v=>v>0);
  const W=1000, H=vazio ? 120 : (alt||250), l=W/Math.max(dias.length,1);
  const mx = Math.max(...ins, ...outs, 1);
  const cE=cor("--verde"), cS=cor("--vermelho");
  const barras = dias.map((d,i)=>{
    const x=i*l, hi=(ins[i]/mx)*(H-30), ho=(outs[i]/mx)*(H-30), w=l*.30;
    return (ins[i]>0?`<rect x="${(x+l*.14).toFixed(1)}" y="${(H-20-hi).toFixed(1)}" width="${w.toFixed(1)}" height="${hi.toFixed(1)}" rx="3" fill="${cE}"/>`:"")
         + (outs[i]>0?`<rect x="${(x+l*.52).toFixed(1)}" y="${(H-20-ho).toFixed(1)}" width="${w.toFixed(1)}" height="${ho.toFixed(1)}" rx="3" fill="${cS}"/>`:"");
  }).join("");
  const eixoY = vazio ? ""
    : `<div class="eixo-y" style="bottom:40px"><span>${din0(mx)}</span><span>${din0(mx/2)}</span><span>${din0(0)}</span></div>`;
  return `<div class="${vazio?"":"com-y"}">
    ${eixoY}
    <div class="graf">
      <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" style="height:${H}px" role="img">
        <line x1="0" y1="${H-20}" x2="${W}" y2="${H-20}" stroke="${cor("--linha")}" stroke-width="1"/>${vazio?"":barras}</svg>
      ${vazio?`<div class="graf-vazio">${t("vazio.grafico")}</div>`:""}
    </div>
    ${vazio?"":`<div class="graf-x"><span>${curto(dias[0])}</span><span>${t("dia.hoje")}</span></div>`}</div>`;
}
function grafRosca(pares, centroR, centroV){
  if(!pares.length) return `<div class="graf" style="height:130px"><div class="graf-vazio">${t("vazio.categorias")}</div></div>`;
  const total = pares.reduce((s,[,v])=>s+v,0), R=64, C=2*Math.PI*R;
  const paleta = [cor("--laranja"), cor("--ambar"), cor("--verde"), cor("--azul"), cor("--violeta"), "#EC4899", "#14B8A6", cor("--txt3")];
  let off=0;
  const arcos = pares.map(([c,v],i)=>{
    const len=(v/total)*C;
    const el=`<circle cx="90" cy="90" r="${R}" fill="none" stroke="${paleta[i%paleta.length]}" stroke-width="20"
      stroke-dasharray="${Math.max(len-2,.5).toFixed(2)} ${(C-len+2).toFixed(2)}" stroke-dashoffset="${(-off).toFixed(2)}" transform="rotate(-90 90 90)"/>`;
    off+=len; return el;
  }).join("");
  const leg = pares.slice(0,7).map(([c,v],i)=>
    `<div style="display:flex;align-items:center;gap:12px;padding:9px 0;font-size:14.5px">
      <i class="pt" style="background:${paleta[i%paleta.length]}"></i>
      <span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" class="t2">${esc(c)}</span>
      <b class="num">${Math.round(v/total*100)}%</b>
      <span class="t3 num" style="width:86px;text-align:right">${din0(v)}</span></div>`).join("");
  return `<div style="display:flex;gap:32px;align-items:center;flex-wrap:wrap">
    <svg viewBox="0 0 180 180" style="width:180px;height:180px;flex:none" role="img">${arcos}
      <text x="90" y="84" text-anchor="middle" font-size="11" fill="${cor("--txt3")}" font-family="Inter">${esc(centroR)}</text>
      <text x="90" y="107" text-anchor="middle" font-size="22" font-weight="700" fill="${cor("--txt")}" font-family="Inter">${esc(centroV)}</text></svg>
    <div style="flex:1;min-width:250px">${leg}</div></div>`;
}

/* ================= BLOCOS ================= */
const kpi = (rot,val,pe,ico,classe,corV) => `
  <div class="card kpi"><div class="kpi-t">${esc(rot)}</div>
    <div class="kpi-ic ${classe}">${ico}</div>
    <div class="kpi-v num" ${corV?`style="color:${corV}"`:""}>${val}</div>
    <div class="kpi-f">${ICO.seta}<span>${esc(pe)}</span></div></div>`;
const secH = (tit,sub,dir) => `
  <div class="sec-h"><div><h2>${esc(tit)}</h2><p>${esc(sub)}</p></div>${dir?`<div class="dir">${dir}</div>`:""}</div>`;
const zero = (tt,ss,acao) => `
  <button class="zero" data-acao="${acao}"><span class="mais">+</span>
    <span class="tt">${esc(tt)}</span><span class="ss">${esc(ss)}</span></button>`;

/* ================= RENDER ================= */
function render(){
  const [ti,su] = TITULO[tela];
  $("ph-tit").textContent = t(ti);
  $("ph-sub").textContent = t(su);
  $("ph-ic").innerHTML = ICONES[tela];
  $("trilha-nome").textContent = t(ti);
  $("periodo-label").textContent = rotuloPeriodo();
  $$("#seg-espaco button").forEach(b=>b.classList.toggle("on", b.dataset.e===espaco));
  $$("#seg-periodo button").forEach(b=>b.classList.toggle("on", b.dataset.p===periodo));
  $$(".side .item[data-v]").forEach(b=>b.classList.toggle("on", b.dataset.v===tela));
  const fn = { painel:vPainel, fluxo:vFluxo, orcamento:vOrcamento, recorrencias:vRecorrencias,
               metas:vMetas, rotina:vRotina, agenda:vAgenda, relatorios:vRelatorios, ajustes:vAjustes }[tela];
  $("v-"+tela).innerHTML = fn();
  ligarTela();
}
function rotuloPeriodo(){
  const [i,f] = janela();
  if(periodo==="hoje") return ext(f,{day:"2-digit",month:"short",year:"numeric"});
  if(periodo==="mes")  return cap(new Date(f+"T00:00:00").toLocaleDateString(locale(),{month:"long",year:"numeric"}));
  return `${curto(i)} – ${curto(f)}`;
}

/* ---------- PAINEL ---------- */
function vPainel(){
  const h=hoje(), y=mesDe(h), d=+h.slice(8,10);
  const iM=soma(noMes(y,"entrada")), oM=soma(noMes(y,"saida")), vM=soma(noMes(y,"investimento"));
  const disp=iM-oM-vM, fol=folego();
  const fut = soma(noMes(y,"saida").filter(x=>x.natureza==="futil"));
  const pFut = oM>0 ? Math.round(fut/oM*100) : 0;
  const proj = d>0 ? oM/d*ultDia(+y.slice(0,4),+y.slice(5,7)) : 0;
  const rot=[], serie=[]; let acc=0;
  for(let k=1;k<=d;k++){ const dd=dtMes(+y.slice(0,4),+y.slice(5,7),k); acc+=entra(dd)-saiu(dd)-investe(dd); serie.push(acc); rot.push(String(k)); }
  const dias=[]; for(let i=13;i>=0;i--) dias.push(mais(h,-i));

  return `
  ${statusHTML(iM,oM,vM,disp,pFut)}
  <div class="grade g3">
    ${kpi(t("kpi.disponivel"), din(disp), t("kpi.disponivel.pe"),
      '<svg viewBox="0 0 24 24"><rect x="2" y="6" width="20" height="13" rx="3"/><path d="M2 11h20M6 15h4"/></svg>',
      "ic-lar", disp<0?cor("--vermelho"):"")}
    ${kpi(t("kpi.folego"), fol.dias==null?"—":`${fol.dias} <small>${t("kpi.dias")}</small>`,
      fol.dias==null?t("kpi.semLimite"):t("kpi.folego.pe"),
      '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></svg>',
      fol.dias!=null&&fol.dias<7?"ic-vrm":"ic-azu")}
    ${kpi(t("kpi.futil"), pFut+"%", t("kpi.futil.pe"),
      '<svg viewBox="0 0 24 24"><path d="M3 6h18l-2 13H5z"/><path d="M9 10v5M15 10v5"/></svg>',
      pFut>=30?"ic-amb":"ic-vio")}
  </div>
  <div class="grade g3">
    ${kpi(t("kpi.entradas"), din(iM), noMes(y,"entrada").length+" ×",
      '<svg viewBox="0 0 24 24"><path d="M12 19V5M5 12l7-7 7 7"/></svg>', "ic-ver", cor("--verde"))}
    ${kpi(t("kpi.saidas"), din(oM), t("kpi.saidas.pe")+": "+din0(proj),
      '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12l7 7 7-7"/></svg>', "ic-vrm", cor("--vermelho"))}
    ${kpi(t("kpi.investido"), din(vM), t("kpi.investido.pe"),
      '<svg viewBox="0 0 24 24"><path d="M3 17l5-6 4 3 5-7 4 4"/><path d="M3 21h18"/></svg>', "ic-amb", cor("--ambar"))}
  </div>
  <div class="card pad" style="--d:60ms">
    ${secH(t("sec.evolucao"), t("sec.evolucao.sub"),
      `<div class="legenda"><span><i class="pt" style="background:${cor("--laranja")}"></i>${t("leg.disponivel")}</span></div>`)}
    ${grafArea([{dados:serie.length?serie:[0], cor:cor("--laranja")}], rot.length?rot:["1"], 210)}
  </div>
  <div class="grade g21">
    <div class="card pad" style="--d:100ms">
      ${secH(t("sec.fluxo"), t("sec.fluxo.sub"),
        `<div class="legenda"><span><i class="pt" style="background:${cor("--verde")}"></i>${t("leg.entradas")}</span>
         <span><i class="pt" style="background:${cor("--vermelho")}"></i>${t("leg.saidas")}</span></div>`)}
      ${grafBarras(dias, dias.map(entra), dias.map(saiu), 190)}
    </div>
    <div class="card" style="--d:140ms">
      <div class="pad">${secH(t("sec.contas"), t("sec.contas.sub"))}</div>
      ${tabelaContas()}
    </div>
  </div>
  <div class="card" style="--d:180ms">
    <div class="pad">${secH(t("sec.lancamentos"), t("sec.lancamentos.sub"))}</div>
    ${listaLancamentos(8)}
  </div>`;
}
function statusHTML(iM,oM,vM,disp,pFut){
  const h=hoje();
  const vencidas = contasOrd().filter(c=>dif(h,venc(c))<0).length;
  const est = estourados();
  let tt,ss,cta,acao;
  if(!lancs().length){ tt=t("st.comecar"); ss=t("st.comecar.sub"); cta=t("st.comecar.cta"); acao="novo"; }
  else if(vencidas){ tt=`${vencidas} ${vencidas===1?t("st.vencida"):t("st.vencidas")}`; ss=t("st.vencida.sub"); cta=t("st.vencida.cta"); acao="painel"; }
  else if(est){ tt=`${est} ${t("st.estourou")}`; ss=t("sec.orcamento.sub"); cta=t("st.estourou.cta"); acao="orcamento"; }
  else if(iM<=0){ tt=t("st.semEntrada"); ss=t("st.semEntrada.sub"); cta=t("st.semEntrada.cta"); acao="entrada"; }
  else if(disp<0){ tt=t("st.negativo"); ss=`${din(oM+vM)} · ${din(iM)}`; cta=t("st.negativo.cta"); acao="fluxo"; }
  else if(pFut>=30){ tt=`${pFut}% ${t("kpi.futil").toLowerCase()}`; ss=t("sec.categorias.sub"); cta=t("st.futil.cta"); acao="fluxo"; }
  else { tt=t("st.ok"); ss=`${t("kpi.disponivel")}: ${din(disp)} · ${t("kpi.futil")}: ${pFut}%`; cta=t("lanc.botao"); acao="novo"; }
  return `<div class="card" style="--d:0ms;margin-bottom:22px"><div class="status">
    <div class="txt"><div class="tt">${esc(tt)}</div><div class="ss">${esc(ss)}</div></div>
    <button class="btn-pri" data-acao="${acao}">${esc(cta)}</button></div></div>`;
}

/* ---------- FLUXO ---------- */
function vFluxo(){
  const y=mesDe(hoje()), [i,f]=janela();
  const dias=[]; let cur=i; while(cur<=f){ dias.push(cur); cur=mais(cur,1); }
  const acE=[],acS=[],acI=[]; let a=0,b=0,c=0;
  dias.forEach(d=>{ a+=entra(d); b+=saiu(d); c+=investe(d); acE.push(a); acS.push(b); acI.push(c); });
  const pares = rank(y);
  return `
  <div class="card pad">
    ${secH(t("sec.evolucao"), t("sec.evolucao.sub"),
      `<div class="legenda">
        <span><i class="pt" style="background:${cor("--verde")}"></i>${t("leg.entradas")}</span>
        <span><i class="pt" style="background:${cor("--vermelho")}"></i>${t("leg.saidas")}</span>
        <span><i class="pt" style="background:${cor("--ambar")}"></i>${t("leg.investido")}</span></div>`)}
    ${grafArea([{dados:acE,cor:cor("--verde")},{dados:acS,cor:cor("--vermelho")},{dados:acI,cor:cor("--ambar")}], dias.map(curto), 190)}
  </div>
  <div class="card pad" style="--d:60ms">
    ${secH(t("sec.fluxo"), t("sec.fluxo.sub"))}
    ${grafBarras(dias.slice(-14), dias.slice(-14).map(entra), dias.slice(-14).map(saiu), 200)}
  </div>
  <div class="card pad" style="--d:110ms">
    ${secH(t("sec.categorias"), t("sec.categorias.sub"))}
    ${grafRosca(pares, t("kpi.saidas"), din0(pares.reduce((s,[,v])=>s+v,0)))}
  </div>
  <div class="card" style="--d:160ms">
    <div class="pad">${secH(t("sec.lancamentos"), t("sec.lancamentos.sub"))}</div>
    ${listaLancamentos(20)}
  </div>`;
}

/* ---------- ORÇAMENTO ---------- */
function vOrcamento(){
  const u = usoOrcamento(), cats = CATS()[espaco].saida, y = mesDe(hoje());
  const corpo = !u.length ? zero(t("vazio.orcamento"), t("vazio.orcamento.sub"), "foco-orc")
    : `<div class="pad" style="padding-top:8px">${u.map(o=>{
        const cl = o.pct>100?"est":o.pct>=80?"al":"ok";
        const tag = o.pct>100 ? `<span class="tag vrm">${t("orc.estourado")}</span>`
                              : `<span class="tag ${o.pct>=80?"amb":"ver"}">${Math.round(o.pct)}%</span>`;
        return `<div class="linha-b"><span class="n">${esc(o.categoria)}</span>
          <span><span class="barra"><i class="${cl}" style="width:${Math.min(100,o.pct).toFixed(1)}%"></i></span></span>
          <span class="v">${din0(o.gasto)} / ${din0(o.valor_mes)} ${tag}
            <button class="x" data-del-orc="${o.id}">${ICO.x}</button></span></div>`;
      }).join("")}</div>`;
  return `
  <div class="card">
    <div class="pad">${secH(t("sec.orcamento"), t("sec.orcamento.sub"))}</div>
    ${corpo}
    <div class="form">
      <select id="orc-cat" class="fn">${cats.map(c=>`<option>${esc(c)}</option>`).join("")}</select>
      <input id="orc-valor" class="fx" inputmode="decimal" placeholder="${t("form.teto")}">
      <button class="mini lar" id="orc-add">${t("form.add")}</button></div>
  </div>
  <div class="card pad" style="--d:80ms">
    ${secH(t("sec.categorias"), t("sec.categorias.sub"))}
    ${grafRosca(rank(y), t("kpi.saidas"), din0(soma(noMes(y,"saida"))))}
  </div>`;
}

/* ---------- RECORRÊNCIAS ---------- */
function vRecorrencias(){
  const r = recs();
  const cats = [...CATS()[espaco].saida, ...CATS()[espaco].entrada, ...CATS()[espaco].investimento];
  const corpo = !r.length ? zero(t("vazio.recorrencias"), t("vazio.recorrencias.sub"), "foco-rec")
    : `<div class="tb">
        <div class="tb-h" style="grid-template-columns:1fr 130px 120px 190px">
          <span>${t("form.descricao")}</span><span>${t("form.dia")}</span>
          <span style="text-align:right">${t("form.valor")}</span><span style="text-align:right">${t("rec.ativa")}</span></div>
        ${r.map(x=>{
          const c = x.tipo==="entrada"?cor("--verde"):x.tipo==="investimento"?cor("--ambar"):cor("--vermelho");
          const sinal = x.tipo==="entrada"?"+":x.tipo==="investimento"?"→":"−";
          return `<div class="tb-l" style="grid-template-columns:1fr 130px 120px 190px">
            <span class="n">${esc(x.categoria)}<small>${esc(x.descricao||"")}</small></span>
            <span class="t2">${t("rec.todoDia",{d:x.dia})}</span>
            <span class="v" style="color:${c}">${sinal} ${num(x.valor)}</span>
            <span class="dir-fim">
              <span class="tag ${x.ativo?"ver":""}">${x.ativo?t("rec.ativa"):t("rec.pausada")}</span>
              <button class="mini" data-toggle-rec="${x.id}">${x.ativo?t("rec.pausar"):t("rec.retomar")}</button>
              <button class="x" data-del-rec="${x.id}">${ICO.x}</button></span></div>`;
        }).join("")}</div>`;
  return `
  <div class="card">
    <div class="pad">${secH(t("sec.recorrencias"), t("sec.recorrencias.sub"))}</div>
    ${corpo}
    <div class="form">
      <select id="rec-tipo" class="fh">
        <option value="saida">${t("lanc.saida")}</option>
        <option value="entrada">${t("lanc.entrada")}</option>
        <option value="investimento">${t("lanc.investir")}</option></select>
      <select id="rec-cat" class="fh">${cats.map(c=>`<option>${esc(c)}</option>`).join("")}</select>
      <input id="rec-desc" class="fn" placeholder="${t("form.descricao")}">
      <input id="rec-dia" class="fx" inputmode="numeric" placeholder="${t("form.dia")}">
      <input id="rec-valor" class="fx" inputmode="decimal" placeholder="${t("form.valor")}">
      <button class="mini lar" id="rec-add">${t("form.add")}</button></div>
  </div>`;
}

/* ---------- METAS ---------- */
function vMetas(){
  const m = metas(), cats = CATS()[espaco].investimento;
  const un = idioma==="en" ? "months" : "meses";
  const corpo = !m.length ? zero(t("vazio.metas"), t("vazio.metas.sub"), "foco-meta")
    : `<div class="pad" style="padding-top:8px">${m.map(x=>{
        const p = progressoMeta(x);
        const cl = p.pct>=100?"ok":p.pct>=50?"al":"";
        const pe = p.pct>=100 ? t("meta.concluida")
                 : p.prev ? t("meta.previsao",{m:p.prev+" "+un}) : t("meta.semRitmo");
        return `<div style="padding:16px 0;border-bottom:1px solid var(--linha2)">
          <div style="display:flex;align-items:baseline;gap:12px;margin-bottom:10px;flex-wrap:wrap">
            <b style="font-size:16px;flex:1;min-width:120px">${esc(x.nome)}</b>
            <span class="num t2">${din0(p.feito)} / ${din0(x.alvo)}</span>
            <span class="tag ${p.pct>=100?"ver":"lar"}">${Math.round(p.pct)}%</span>
            <button class="x" data-del-meta="${x.id}">${ICO.x}</button></div>
          <span class="barra"><i class="${cl}" style="width:${Math.min(100,p.pct).toFixed(1)}%"></i></span>
          <div class="t3" style="font-size:13.5px;margin-top:9px">${esc(pe)}${x.categoria?" · "+esc(x.categoria):""}</div>
        </div>`; }).join("")}</div>`;
  return `
  <div class="card">
    <div class="pad">${secH(t("sec.metas"), t("sec.metas.sub"))}</div>
    ${corpo}
    <div class="form">
      <input id="meta-nome" class="fn" placeholder="${t("form.nome")}">
      <select id="meta-cat" class="fh"><option value="">${t("form.todoDia")}</option>${cats.map(c=>`<option>${esc(c)}</option>`).join("")}</select>
      <input id="meta-alvo" class="fx" inputmode="decimal" placeholder="${t("form.alvo")}">
      <button class="mini lar" id="meta-add">${t("form.add")}</button></div>
  </div>`;
}

/* ---------- ROTINA ---------- */
function vRotina(){
  const d=rtDia, h=hoje();
  const rel = d===h?t("dia.hoje"):d===mais(h,-1)?t("dia.ontem"):d===mais(h,1)?t("dia.amanha")
    :(dif(h,d)>0?t("dia.em",{n:dif(h,d)}):t("dia.atras",{n:-dif(h,d)}));
  let corpo="", tI=0, tF=0;
  if(!db.blocos.length){
    corpo = `<div class="card">${zero(t("vazio.rotina"), t("vazio.rotina.sub"), "seed-rotina")}</div>`;
  }else{
    const agora = new Date().toTimeString().slice(0,5);
    const bs = [...db.blocos].sort((a,b)=>a.hora.localeCompare(b.hora));
    corpo = bs.map((bl,i)=>{
      const itens = itensBloco(bl.id,d);
      const feitos = itens.filter(x=>marcado(x.id,d)).length;
      tI+=itens.length; tF+=feitos;
      const ok = itens.length>0 && feitos===itens.length;
      const prox = bs[i+1];
      const nesse = d===h && hm(bl.hora)<=agora && (!prox || agora<hm(prox.hora));
      const ab = blocoAberto===bl.id;
      return `<div class="blk ${ok?"ok":""} ${nesse&&!ok?"agora":""}">
        <button class="blk-c" data-bloco="${bl.id}">
          <span class="blk-h">${hm(bl.hora)}</span><span class="blk-t">${esc(bl.titulo)}</span>
          ${nesse&&!ok?`<span class="tag lar">${t("rot.agora")}</span>`:""}
          <span class="blk-n">${feitos}/${itens.length}</span><span class="blk-s">${ab?"▾":"▸"}</span></button>
        ${ab?`<div class="blk-b">
          ${bl.nota?`<div class="blk-nota">${esc(bl.nota)}</div>`:""}
          ${itens.length?itens.map(it=>`<button class="tk ${marcado(it.id,d)?"on":""}" data-item="${it.id}">
              <span class="cx">${ICO.ok}</span><span class="t">${esc(it.nome)}</span>
              ${it.dia_semana!=null?`<span class="h">${DIAS()[it.dia_semana].slice(0,3)}</span>`:""}</button>`).join("")
            :`<div class="t3" style="padding:14px 0;font-size:14px">${t("rot.semItens",{d:DIAS()[dsem(d)]})}</div>`}
          <button class="mini" style="width:100%;margin-top:14px" data-edit-bloco="${bl.id}">${t("rot.editarBloco")}</button>
        </div>`:""}</div>`;
    }).join("");
  }
  const ts = tarefasDia(d);
  return `
  <div class="dnav">
    <button data-rt="-1">‹</button>
    <button class="c" data-rt="0"><span class="d">${cap(ext(d,{weekday:"long",day:"2-digit",month:"short"}))}</span><span class="s">${rel}</span></button>
    <button data-rt="1">›</button></div>
  <div class="pbar"><i style="width:${tI?Math.round(tF/tI*100):0}%"></i></div>
  ${corpo}
  <div class="card" style="--d:60ms;margin-top:20px">
    <div class="pad">${secH(t("sec.soHoje"), t("vazio.tarefas.sub"))}</div>
    ${ts.length ? ts.map(x=>`<div class="li">
        <button class="cx ${x.feita?"on":""}" data-tarefa="${x.id}">${ICO.ok}</button>
        <span class="n" ${x.feita?'style="color:var(--txt3);text-decoration:line-through"':""}>${esc(x.titulo)}</span>
        <span class="tag">${hm(x.hora)||"—"}</span>
        <button class="x" data-del-tarefa="${x.id}">${ICO.x}</button></div>`).join("")
      : zero(t("vazio.tarefas"), t("vazio.tarefas.sub"), "foco-tarefa")}
    <div class="form">
      <input id="t-tit" class="fn" placeholder="${t("form.lembrete")}">
      <input id="t-hora" class="fh" type="time">
      <button class="mini lar" id="t-add">${t("form.add")}</button></div>
  </div>
  <div class="card" style="--d:110ms">
    <div class="pad">${secH(t("sec.editarRotina"), t("rot.blocosValem"))}</div>
    <div class="form">
      <input id="b-hora" class="fh" type="time">
      <input id="b-tit" class="fn" placeholder="${t("form.bloco")}">
      <button class="mini" id="b-add">${t("form.add")}</button>
      ${!db.blocos.length?`<button class="mini lar" id="rt-seed">${t("rot.instalar")}</button>`:""}</div>
  </div>`;
}

/* ---------- AGENDA ---------- */
function vAgenda(){
  const {a,m}=calRef, h=hoje(), ym=`${a}-${String(m).padStart(2,"0")}`;
  const p1=new Date(a,m-1,1), ini=mais(isoDe(p1), -p1.getDay());
  const dias=[]; for(let i=0;i<42;i++) dias.push(mais(ini,i));
  const vals = dias.filter(d=>mesDe(d)===ym).map(saiu).filter(v=>v>0).sort((x,y)=>x-y);
  const q = p => vals.length ? vals[Math.min(vals.length-1, Math.floor(vals.length*p))] : 0;
  const q1=q(.33), q2=q(.66), q3=q(.9);
  const grade = dias.map(d=>{
    const fora = mesDe(d)!==ym, v=saiu(d);
    const op = v<=0?0:v<=q1?.12:v<=q2?.22:v<=q3?.34:.5;
    const ms=[];
    if(v>0) ms.push(cor("--vermelho"));
    if(contasDia(d).length) ms.push(cor("--ambar"));
    if(evtsDia(d).length||tarefasDia(d).length) ms.push(cor("--laranja"));
    return `<button class="dia ${fora?"fora":""} ${d===h?"hoje":""} ${v>0?"gastou":""} ${db.fechados.includes(d)?"fech":""}" data-dia="${d}">
      <span class="f" style="opacity:${op}"></span><span class="n">${+d.slice(8,10)}</span>
      <span class="m">${ms.map(c=>`<i style="background:${c}"></i>`).join("")}</span></button>`;
  }).join("");
  const prox = evts().filter(e=>e.data>=h).sort((x,y)=>(x.data+(x.hora||"99")).localeCompare(y.data+(y.hora||"99"))).slice(0,10);
  return `
  <div class="grade g21">
    <div class="card pad">
      ${secH(t("sec.calendario"), cap(new Date(a,m-1,1).toLocaleDateString(locale(),{month:"long",year:"numeric"})),
        `<div style="display:flex;gap:8px"><button class="mini" data-cal="-1">‹</button><button class="mini" data-cal="1">›</button></div>`)}
      <div class="cal-sem">${DIASC().map(x=>`<b>${x}</b>`).join("")}</div>
      <div class="cal">${grade}</div>
      <div class="legenda" style="margin-top:20px">
        <span><i class="pt" style="background:${cor("--vermelho")}"></i>${t("cal.gastou")}</span>
        <span><i class="pt" style="background:${cor("--ambar")}"></i>${t("cal.conta")}</span>
        <span><i class="pt" style="background:${cor("--laranja")}"></i>${t("cal.compromisso")}</span>
        <span><i class="pt" style="background:${cor("--verde")}"></i>${t("cal.fechado")}</span></div>
    </div>
    <div class="card" style="--d:60ms">
      <div class="pad">${secH(t("sec.compromissos"), t("vazio.compromissos.sub"))}</div>
      ${prox.length ? prox.map(e=>{
        const dd=dif(h,e.data);
        return `<div class="li">
          <span class="tag ${dd<=1?"lar":""}">${dd===0?t("dia.hoje"):dd===1?t("dia.amanha"):curto(e.data)}</span>
          <span class="n">${esc(e.titulo)}${e.lembrete_min?`<small>${e.lembrete_min} min</small>`:""}</span>
          <span class="v t2">${hm(e.hora)}</span>
          <button class="x" data-del-evt="${e.id}">${ICO.x}</button></div>`;
      }).join("") : zero(t("vazio.compromissos"), t("vazio.compromissos.sub"), "abrir-hoje")}
    </div>
  </div>`;
}

/* ---------- RELATÓRIOS ---------- */
function vRelatorios(){
  const f = fechamento(), dsc = disciplina();
  const delta = (a,b) => { if(b===0) return a>0?"+100%":"—"; const p=Math.round((a/b-1)*100); return (p>0?"+":"")+p+"%"; };
  const linha = (rot,va,vb,inverso) => {
    const bom = vb===0 ? null : (inverso ? va<vb : va>vb);
    return `<div><div class="r">${esc(rot)}</div><div class="v">${din0(va)}</div>
      <div style="font-size:13px;margin-top:6px;color:${bom===null?cor("--txt3"):bom?cor("--verde"):cor("--vermelho")}">
      ${delta(va,vb)} · ${t("leg.anterior")} ${din0(vb)}</div></div>`;
  };
  const fechHTML = !f.temAnterior
    ? `<div class="pad t3" style="font-size:14.5px">${t("vazio.fechamento")}</div>`
    : `<div class="pad"><div class="faixa" style="grid-template-columns:repeat(4,1fr)">
        ${linha(t("fech.entradas"), f.a.entrada, f.b.entrada)}
        ${linha(t("fech.saidas"), f.a.saida, f.b.saida, true)}
        ${linha(t("fech.investido"), f.a.invest, f.b.invest)}
        ${linha(t("fech.saldo"), f.saldoA, f.saldoB)}</div>
      ${f.alta && f.alta.d>0 ? `<div class="li" style="padding-left:0;padding-right:0">
        <span class="tag amb">${t("fech.maiorAlta")}</span><span class="n">${esc(f.alta.cat)}</span>
        <span class="v neg">+ ${num(f.alta.d)}</span></div>`:""}
      ${f.queda && f.queda.d<0 ? `<div class="li" style="padding-left:0;padding-right:0;border-bottom:none">
        <span class="tag ver">${t("fech.maiorQueda")}</span><span class="n">${esc(f.queda.cat)}</span>
        <span class="v pos">− ${num(-f.queda.d)}</span></div>`:""}</div>`;
  const dscHTML = !dsc
    ? `<div class="pad t3" style="font-size:14.5px">${t("vazio.disciplina")}</div>`
    : `<div class="pad"><div class="faixa" style="grid-template-columns:repeat(4,1fr)">
        <div><div class="r">${t("disc.fechado")}</div><div class="v">${dsc.com}</div></div>
        <div><div class="r">${t("disc.aberto")}</div><div class="v">${dsc.sem}</div></div>
        <div><div class="r">${t("disc.mediaGasto")}</div><div class="v">${din0(dsc.mc.total)}</div></div>
        <div><div class="r">${t("disc.mediaFutil")}</div><div class="v inv">${din0(dsc.mc.futil)}</div></div></div>
      <div style="margin-top:20px;font-size:16px;line-height:1.6">
        ${esc(t("disc.conclusao",{p:dsc.p, dir:t(dsc.dir==="menor"?"disc.menor":"disc.maior")}))}</div></div>`;
  return `
  <div class="card">
    <div class="pad">${secH(t("sec.fechamento"), t("sec.fechamento.sub"))}</div>
    ${fechHTML}</div>
  <div class="card" style="--d:60ms">
    <div class="pad">${secH(t("sec.disciplina"), t("sec.disciplina.sub"))}</div>
    ${dscHTML}</div>
  <div class="grade g2" style="--d:110ms">
    <div class="card pad">
      ${secH(t("sec.importar"), t("sec.importar.sub"))}
      <div class="drop" id="drop">
        <svg viewBox="0 0 24 24"><path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2"/></svg>
        <div class="tt">${t("imp.solte")}</div><div class="ss">${t("imp.formatos")}</div></div>
      <input type="file" id="arq" accept=".ofx,.csv,.txt" hidden>
    </div>
    <div class="card pad">
      ${secH(t("sec.exportar"), t("sec.exportar.sub"))}
      <button class="btn-pri" id="bt-pdf" style="width:100%;justify-content:center">
        <svg viewBox="0 0 24 24"><path d="M12 3v12M7 10l5 5 5-5M4 20h16"/></svg>${t("exp.gerar")}</button>
      <div class="t3" style="font-size:13.5px;margin-top:12px;line-height:1.6">${t("exp.dica")}</div>
    </div>
  </div>`;
}

/* ---------- AJUSTES ---------- */
function vAjustes(){
  const langs = [["pt","Português"],["en","English"],["es","Español"]];
  return `
  <div class="grade g2">
    <div class="card pad">
      ${secH(t("sec.idioma"), t("sec.idioma.sub"))}
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        ${langs.map(([k,n])=>`<button class="chip ${idioma===k?"on":""}" data-lang="${k}">${n}</button>`).join("")}</div>
    </div>
    <div class="card pad" style="--d:60ms">
      ${secH(t("sec.conta"), user.email||"")}
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        <button class="mini" id="bt-backup">${t("conta.backup")}</button>
        <button class="mini" id="bt-sair2">${t("conta.sair")}</button></div>
    </div>
  </div>
  <div class="card" style="--d:110ms">
    <div class="pad">${secH(t("sec.socios"), t("sec.socios.sub"))}</div>
    <div class="pad" style="padding-top:8px">
      ${db.membros.map(m=>`<div class="li" style="padding-left:0;padding-right:0">
        <span class="n">${esc(m.nome)}</span>
        ${!m.eh_voce?`<button class="x" data-del-membro="${m.id}">${ICO.x}</button>`:""}</div>`).join("")}
    </div>
    <div class="form">
      <input id="m-nome" class="fn" placeholder="${t("form.socio")}">
      <button class="mini lar" id="m-add">${t("form.add")}</button></div>
  </div>`;
}

/* ---------- pedaços compartilhados ---------- */
function tabelaContas(){
  const h=hoje(), cs=contasOrd();
  const formulario = `<div class="form">
    <input id="c-nome" class="fn" placeholder="${t("form.conta")}">
    <input id="c-dia" class="fx" inputmode="numeric" placeholder="${t("form.dia")}">
    <input id="c-valor" class="fx" inputmode="decimal" placeholder="${t("form.valor")}">
    <button class="mini lar" id="c-add">${t("form.add")}</button></div>`;
  if(!cs.length) return zero(t("vazio.contas"), t("vazio.contas.sub"), "foco-conta") + formulario;
  return `<div class="tb">
    <div class="tb-h" style="grid-template-columns:34px 1fr 110px 110px">
      <span></span><span>${t("form.nome")}</span>
      <span style="text-align:right">${t("form.valor")}</span><span style="text-align:right">${t("form.dia")}</span></div>
    ${cs.slice(0,8).map(c=>{
      const d=dif(h,venc(c)), pago=c.ultimo_pago===mesDe(h);
      const tag = pago?`<span class="tag ver">${t("msg.quitada")}</span>`
        : d<0?`<span class="tag vrm">${t("dia.atras1",{n:-d})}</span>`
        : d===0?`<span class="tag amb">${t("dia.hoje")}</span>` : `<span class="tag">${d}d</span>`;
      return `<div class="tb-l" style="grid-template-columns:34px 1fr 110px 110px">
        <button class="cx ${pago?"on":""}" data-pagar="${c.id}">${ICO.ok}</button>
        <span class="n">${esc(c.nome)}<small>${t("rec.todoDia",{d:c.dia})}</small></span>
        <span class="v">${c.valor?num(c.valor):"—"}</span>
        <span class="dir-fim">${tag}<button class="x" data-del-conta="${c.id}">${ICO.x}</button></span></div>`;
    }).join("")}</div>` + formulario;
}
function listaLancamentos(n){
  const h=hoje(), ult=lancs().slice(0,n);
  if(!ult.length) return zero(t("vazio.lancamentos"), t("vazio.lancamentos.sub"), "novo");
  return ult.map(l=>{
    const c = l.tipo==="entrada"?cor("--verde"):l.tipo==="investimento"?cor("--ambar"):cor("--vermelho");
    const sinal = l.tipo==="entrada"?"+":l.tipo==="investimento"?"→":"−";
    const sub = [l.nota, espaco==="empresa"&&l.membro_id?nomeM(l.membro_id):"", l.recorrencia_id?t("nav.recorrencias"):""].filter(Boolean).join(" · ");
    return `<div class="li"><i class="pt" style="background:${c}"></i>
      <span class="n">${esc(l.categoria)}${sub?`<small>${esc(sub)}</small>`:""}</span>
      ${l.natureza==="futil"?`<span class="tag amb">${t("leg.futil")}</span>`:""}
      <span class="tag">${l.data===h?t("dia.hoje"):curto(l.data)}</span>
      <span class="v" style="color:${c}">${sinal} ${num(l.valor)}</span>
      <button class="x" data-del-lanc="${l.id}">${ICO.x}</button></div>`;
  }).join("");
}

/* ================= NAVEGAÇÃO ================= */
function irPara(v){
  tela = v;
  TELAS.forEach(n => $("v-"+n).hidden = n!==v);
  fecharGaveta();
  window.scrollTo({top:0, behavior:"instant"});
  render();
}
/* ---------- popovers da barra superior ---------- */
let popAberto = null;
function fecharPop(){
  if(!popAberto) return;
  $(popAberto.pop).classList.remove("on");
  const g = $(popAberto.gatilho); if(g) g.classList.remove("aberto");
  popAberto = null;
}
function alternarPop(gatilho, pop){
  const jaAberto = popAberto && popAberto.pop === pop;
  fecharPop();
  if(jaAberto) return;
  if(pop === "pop-avisos") montarAvisos();
  $(pop).classList.add("on");
  $(gatilho).classList.add("aberto");
  popAberto = { gatilho, pop };
}

/* o sino agora lista o que precisa de atenção, em vez de só pedir permissão */
function montarAvisos(){
  const h = hoje(), y = mesDe(h), itens = [];
  contasOrd().forEach(c=>{
    if(c.ultimo_pago === mesDe(h)) return;
    const d = dif(h, venc(c));
    if(d < 0)      itens.push({ c:"--vermelho", t:c.nome, s:t("av.vencida",{d:curto(venc(c))}) });
    else if(d===0) itens.push({ c:"--ambar",    t:c.nome, s:t("av.venceHoje") });
    else if(d<=3)  itens.push({ c:"--ambar",    t:c.nome, s:t("av.vence",{n:d}) });
  });
  usoOrcamento().forEach(o=>{
    if(o.pct > 100)      itens.push({ c:"--vermelho", t:o.categoria, s:t("av.estourou",{p:Math.round(o.pct), v:din0(o.valor_mes)}) });
    else if(o.pct >= 80) itens.push({ c:"--ambar",    t:o.categoria, s:t("av.perto",{p:Math.round(o.pct)}) });
  });
  metas().forEach(m=>{ if(progressoMeta(m).pct >= 100) itens.push({ c:"--verde", t:m.nome, s:t("av.meta") }); });
  evts().filter(e=>e.data===h || e.data===mais(h,1)).forEach(e=>
    itens.push({ c:"--laranja", t:e.titulo, s:t("av.evento",{q: e.data===h ? t("dia.hoje") : t("dia.amanha")}) }));

  const box = $("lista-avisos");
  const permissao = ("Notification" in window && Notification.permission !== "granted")
    ? `<div class="pop-sep"></div><button class="pop-i" id="pedir-aviso">
         <svg viewBox="0 0 24 24"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 01-3.4 0"/></svg>
         <span>${t("av.permitir")}</span></button>` : "";
  box.innerHTML = (itens.length
    ? itens.slice(0,8).map(x=>`<div class="pop-i" style="cursor:default;align-items:flex-start">
        <i class="pt" style="background:var(${x.c});margin-top:6px"></i>
        <span style="flex:1;min-width:0"><b style="color:var(--txt);font-weight:600;display:block">${esc(x.t)}</b>
        <span style="font-size:13px;color:var(--txt3)">${esc(x.s)}</span></span></div>`).join("")
    : `<div class="pop-i" style="cursor:default;color:var(--txt3)">${t("av.vazio")}</div>`) + permissao;

  const pa = $("pedir-aviso");
  if(pa) pa.onclick = async ()=>{
    const p = await Notification.requestPermission();
    toast(p==="granted" ? t("msg.avisosOn") : t("msg.avisosOff"), p!=="granted");
    montarAvisos();
  };
}

const abrirGaveta = ()=>{ $("side").classList.add("aberta"); document.body.style.overflow="hidden"; };
const fecharGaveta = ()=>{ $("side").classList.remove("aberta"); document.body.style.overflow=""; };

/* ================= SHEETS ================= */
function abrirSheet(html){
  $("sheets").innerHTML = `<div class="sheet" id="sheet">${html}</div>`;
  $("veu").hidden = false;
  requestAnimationFrame(()=>{ $("veu").classList.add("on"); $("sheet").classList.add("on"); });
  document.body.style.overflow="hidden";
  $$("#sheets [data-fechar]").forEach(b=>b.onclick=fecharSheet);
}
function fecharSheet(){
  const s = $("sheet"); if(s) s.classList.remove("on");
  $("veu").classList.remove("on");
  document.body.style.overflow="";
  setTimeout(()=>{ $("sheets").innerHTML=""; $("veu").hidden=true; }, 210);
}
const cabSheet = (ico,tit) => `<div class="sh-c"><span class="ic">${ico}</span><h3>${esc(tit)}</h3>
  <button class="fechar" data-fechar>${ICO.x}</button></div>`;

/* --- lançamento --- */
const valorDig = () => dig ? parseInt(dig,10)/100 : 0;
function abrirLanc(data, tipo){
  dig=""; catSel=null; tipoSel=tipo||"saida"; natSel="essencial";
  membroSel = (db.membros.find(m=>m.eh_voce)||db.membros[0]||{}).id||null;
  dataAlvo = data||hoje();
  abrirSheet(`
    ${cabSheet('<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>', t("lanc.titulo"))}
    <div class="trio" id="dp-tipo">
      <button data-t="saida">${t("lanc.saida")}</button>
      <button data-t="entrada">${t("lanc.entrada")}</button>
      <button data-t="investimento">${t("lanc.investir")}</button></div>
    <div class="mostra"><div id="mostra" class="v zv"><small>${simb()}</small>0,00</div></div>
    <div id="rl-data" class="rolo"></div>
    <div id="rl-cat" class="rolo"></div>
    <div class="dup" id="dp-nat" hidden>
      <button data-n="essencial">${t("lanc.essencial")}</button>
      <button data-n="futil">${t("lanc.futil")}</button></div>
    <div id="rl-membro" class="rolo" hidden></div>
    <div class="tec">
      ${[1,2,3,4,5,6,7,8,9].map(k=>`<button data-k="${k}">${k}</button>`).join("")}
      <button data-k="00" class="aux">00</button><button data-k="0">0</button>
      <button data-k="del" class="aux">${t("lanc.apagar")}</button></div>
    <input id="nota" class="campo" placeholder="${t("lanc.nota")}">
    <div id="lanc-msg" class="msg erro"></div>
    <button id="bt-lancar" class="btn">${t("lanc.botao")}</button>`);
  pintaTipo(); pintaData(); pintaCat(); pintaNat(); pintaMembro(); pintaValor();
  $$("#dp-tipo button").forEach(b=>b.onclick=()=>{ tipoSel=b.dataset.t; vibra(); pintaTipo(); pintaCat(); pintaNat(); pintaMembro(); pintaValor(); });
  $$("#dp-nat button").forEach(b=>b.onclick=()=>{ natSel=b.dataset.n; vibra(); pintaNat(); });
  $$(".tec button").forEach(b=>b.onclick=()=>tecla(b.dataset.k));
  $("bt-lancar").onclick = lancar;
}
function pintaValor(){
  const v=valorDig(), el=$("mostra"); if(!el) return;
  el.innerHTML = `<small>${simb()}</small>${num(v)}`;
  el.className = "v"+(v<=0?" zv":"");
  el.style.color = v<=0?"":tipoSel==="entrada"?cor("--verde"):tipoSel==="investimento"?cor("--ambar"):cor("--vermelho");
  const b=$("bt-lancar"); if(b){ b.disabled = v<=0||!catSel; b.style.opacity = b.disabled?".5":"1"; }
}
function tecla(k){ if(k==="del") dig=dig.slice(0,-1); else if(dig.length<9) dig+=k; vibra(6); pintaValor(); }
function pintaTipo(){ $$("#dp-tipo button").forEach(b=>b.classList.toggle("on", b.dataset.t===tipoSel)); }
function pintaData(){
  const h=hoje();
  const op=[{d:h,r:t("lanc.hoje")},{d:mais(h,-1),r:t("lanc.ontem")},{d:mais(h,-2),r:curto(mais(h,-2))}];
  if(!op.some(o=>o.d===dataAlvo)) op.push({d:dataAlvo,r:curto(dataAlvo)});
  $("rl-data").innerHTML = op.map(o=>`<button class="chip ${o.d===dataAlvo?"on":""}" data-d="${o.d}">${o.r}</button>`).join("");
  $$("#rl-data button").forEach(b=>b.onclick=()=>{ dataAlvo=b.dataset.d; vibra(); pintaData(); });
}
const FUTEIS = new Set(["Comer fora","Lazer","Eating out","Leisure","Comer fuera","Ocio"]);
function pintaCat(){
  const lista = CATS()[espaco][tipoSel];
  if(catSel && !lista.includes(catSel)) catSel=null;
  $("rl-cat").innerHTML = lista.map(c=>`<button class="chip ${c===catSel?"on":""}" data-c="${esc(c)}">${esc(c)}</button>`).join("");
  $$("#rl-cat button").forEach(b=>b.onclick=()=>{
    catSel=b.dataset.c;
    if(espaco==="pessoal"&&tipoSel==="saida") natSel = FUTEIS.has(catSel) ? "futil" : "essencial";
    vibra(); pintaCat(); pintaNat(); pintaValor();
  });
}
function pintaNat(){
  const m = espaco==="pessoal" && tipoSel==="saida";
  $("dp-nat").hidden = !m;
  if(m) $$("#dp-nat button").forEach(b=>b.classList.toggle("on", b.dataset.n===natSel));
}
function pintaMembro(){
  const m = espaco==="empresa" && tipoSel==="saida" && db.membros.length>0;
  $("rl-membro").hidden = !m;
  if(!m) return;
  $("rl-membro").innerHTML = db.membros.map(x=>`<button class="chip ${x.id===membroSel?"on":""}" data-m="${x.id}">${esc(x.nome)}</button>`).join("");
  $$("#rl-membro button").forEach(b=>b.onclick=()=>{ membroSel=b.dataset.m; vibra(); pintaMembro(); });
}

/* --- detalhe do dia --- */
function abrirDia(d){
  selDia = d;
  const ls=noDia(d), cs=contasDia(d), es=evtsDia(d);
  const saldo = entra(d)-saiu(d)-investe(d);
  abrirSheet(`
    ${cabSheet('<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18"/></svg>', cap(ext(d)))}
    <div style="font-size:13.5px;color:var(--txt2)">${t("fech.saldo")}</div>
    <div class="num" style="font-size:34px;font-weight:700;letter-spacing:-.035em;margin:6px 0 4px;color:${saldo<0?cor("--vermelho"):saldo>0?cor("--verde"):""}">${din(saldo)}</div>
    <div class="sub-sec">${t("sec.lancamentos")}</div>
    ${ls.length?ls.map(l=>{
      const c = l.tipo==="entrada"?cor("--verde"):l.tipo==="investimento"?cor("--ambar"):cor("--vermelho");
      return `<div class="li" style="padding:12px 0"><i class="pt" style="background:${c}"></i>
        <span class="n">${esc(l.categoria)}${l.nota?`<small>${esc(l.nota)}</small>`:""}</span>
        <span class="v" style="color:${c}">${num(l.valor)}</span>
        <button class="x" data-dl="${l.id}">${ICO.x}</button></div>`;
    }).join(""):`<div class="t3" style="font-size:14px;padding:8px 0">—</div>`}
    <div class="sub-sec">${t("sec.contas")}</div>
    ${cs.length?cs.map(c=>`<div class="li" style="padding:12px 0"><i class="pt" style="background:${cor("--ambar")}"></i>
      <span class="n">${esc(c.nome)}</span><span class="v">${c.valor?num(c.valor):"—"}</span></div>`).join("")
      :`<div class="t3" style="font-size:14px;padding:8px 0">—</div>`}
    <div class="sub-sec">${t("sec.compromissos")}</div>
    ${es.length?es.map(e=>`<div class="li" style="padding:12px 0"><span class="tag">${hm(e.hora)||"—"}</span>
      <span class="n">${esc(e.titulo)}</span><button class="x" data-de="${e.id}">${ICO.x}</button></div>`).join("")
      :`<div class="t3" style="font-size:14px;padding:8px 0">—</div>`}
    <div class="form" style="border:none;background:none;padding:16px 0 0">
      <input id="e-tit" class="fn" placeholder="${t("form.compromisso")}">
      <input id="e-hora" class="fh" type="time">
      <select id="e-lem" class="fh">
        <option value="">${t("form.semAviso")}</option><option value="10">${t("form.min10")}</option>
        <option value="30">${t("form.min30")}</option><option value="60">${t("form.h1")}</option></select>
      <button class="mini lar" id="e-add">${t("form.add")}</button></div>
    <button class="btn" style="margin-top:16px" id="dia-lanc">${t("lanc.botao")}</button>`);
  $("e-add").onclick = addEvento;
  $("dia-lanc").onclick = ()=>{ const x=selDia; fecharSheet(); setTimeout(()=>abrirLanc(x),240); };
  $$("#sheets [data-dl]").forEach(b=>b.onclick=()=>apagar("lancamentos", b.dataset.dl, ()=>{
    db.lancamentos=db.lancamentos.filter(z=>z.id!==b.dataset.dl); fecharSheet(); }));
  $$("#sheets [data-de]").forEach(b=>b.onclick=()=>apagar("eventos", b.dataset.de, ()=>{
    db.eventos=db.eventos.filter(z=>z.id!==b.dataset.de); fecharSheet(); }));
}

/* --- edição de bloco --- */
function abrirBloco(bl){
  const itens = db.habitos.filter(x=>x.bloco_id===bl.id).sort((a,b)=>(a.ordem||0)-(b.ordem||0));
  const semanas = [["",t("form.todoDia")],["1",t("form.soSeg")],["2",t("form.soTer")],["3",t("form.soQua")],
                   ["4",t("form.soQui")],["5",t("form.soSex")],["6",t("form.soSab")],["0",t("form.soDom")]];
  abrirSheet(`
    ${cabSheet('<svg viewBox="0 0 24 24"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z"/></svg>', hm(bl.hora)+" — "+bl.titulo)}
    <div class="sub-sec">${t("sec.editarRotina")}</div>
    ${itens.length?itens.map(it=>`<div class="li" style="padding:12px 0">
      <span class="n">${esc(it.nome)}</span>
      ${it.dia_semana!=null?`<span class="tag">${DIAS()[it.dia_semana]}</span>`:""}
      <button class="x" data-di="${it.id}">${ICO.x}</button></div>`).join("")
      :`<div class="t3" style="font-size:14px;padding:8px 0">—</div>`}
    <div class="form" style="border:none;background:none;padding:16px 0 0">
      <input id="bl-novo" class="fn" placeholder="${t("form.item")}">
      <select id="bl-dia" class="fh">${semanas.map(([v,n])=>`<option value="${v}">${n}</option>`).join("")}</select>
      <button class="mini lar" id="bl-add">${t("form.add")}</button></div>
    <div class="sub-sec">${t("form.bloco")}</div>
    <div class="form" style="border:none;background:none;padding:0">
      <input id="bl-hora" class="fh" type="time" value="${hm(bl.hora)}">
      <input id="bl-nome" class="fn" value="${esc(bl.titulo)}">
      <button class="mini" id="bl-salvar">${t("form.salvar")}</button></div>
    <button class="mini" id="bl-apagar" style="width:100%;margin-top:18px;color:var(--vermelho);border-color:color-mix(in srgb,var(--vermelho) 40%,transparent)">${t("form.apagar")}</button>`);
  $("bl-add").onclick = async ()=>{
    const n=$("bl-novo").value.trim(); if(!n) return;
    const dv=$("bl-dia").value;
    const { data, error } = await sb.from("habitos").insert({ user_id:user.id, bloco_id:bl.id, nome:n,
      dia_semana: dv===""?null:parseInt(dv,10), ordem:itens.length }).select().single();
    if(error) return falhou(error);
    db.habitos.push(data); abrirBloco(bl); render();
  };
  $("bl-salvar").onclick = async ()=>{
    const h=$("bl-hora").value, ti=$("bl-nome").value.trim();
    if(!h||!ti) return toast(t("auth.preencha"), true);
    const { error } = await sb.from("blocos_rotina").update({ hora:h, titulo:ti }).eq("id", bl.id);
    if(error) return falhou(error);
    bl.hora=h; bl.titulo=ti; fecharSheet(); render(); toast(t("msg.salvo"));
  };
  $("bl-apagar").onclick = async ()=>{
    if(!confirm(t("conf.apagarBloco"))) return;
    const { error } = await sb.from("blocos_rotina").delete().eq("id", bl.id);
    if(error) return falhou(error);
    db.blocos=db.blocos.filter(z=>z.id!==bl.id);
    db.habitos=db.habitos.filter(z=>z.bloco_id!==bl.id);
    blocoAberto=null; fecharSheet(); render(); toast(t("msg.removido"));
  };
  $$("#sheets [data-di]").forEach(b=>b.onclick=async ()=>{
    const id=b.dataset.di;
    const { error } = await sb.from("habitos").delete().eq("id", id);
    if(error) return falhou(error);
    db.habitos=db.habitos.filter(z=>z.id!==id); db.marcas=db.marcas.filter(z=>z.habito_id!==id);
    abrirBloco(bl); render();
  });
}

/* ================= MUTAÇÕES ================= */
async function apagar(tabela, id, local){
  const { error } = await sb.from(tabela).delete().eq("id", id);
  if(error) return falhou(error);
  local(); render(); toast(t("msg.removido"));
}
async function lancar(){
  const v = valorDig();
  if(v<=0){ $("lanc-msg").textContent=t("lanc.digite"); return; }
  if(!catSel){ $("lanc-msg").textContent=t("lanc.categoria"); return; }
  const { data, error } = await sb.from("lancamentos").insert({
    user_id:user.id, espaco, tipo:tipoSel, data:dataAlvo, valor:v, categoria:catSel,
    nota:$("nota").value.trim(),
    natureza:(espaco==="pessoal"&&tipoSel==="saida")?natSel:null,
    membro_id:(espaco==="empresa"&&tipoSel==="saida")?membroSel:null
  }).select().single();
  if(error) return falhou(error);
  db.lancamentos.unshift({...data, valor:Number(data.valor)});
  db.lancamentos.sort((a,b)=>b.data.localeCompare(a.data));
  vibra(14); fecharSheet(); render();
  toast(`${tipoSel==="entrada"?"+":"−"} ${din(v)}`);
}
async function pagarConta(c){
  const mes = mesDe(venc(c));
  const { error } = await sb.from("contas").update({ ultimo_pago:mes }).eq("id", c.id);
  if(error) return falhou(error);
  c.ultimo_pago = mes;
  if(c.valor>0){
    const catContas = CATS()[c.espaco].saida[4] || CATS()[c.espaco].saida[0];
    const { data, error:e2 } = await sb.from("lancamentos").insert({
      user_id:user.id, espaco:c.espaco, tipo:"saida", data:hoje(), valor:c.valor,
      categoria:catContas, nota:c.nome, natureza:c.espaco==="pessoal"?"essencial":null }).select().single();
    if(e2) return falhou(e2);
    db.lancamentos.unshift({...data, valor:Number(data.valor)});
    db.lancamentos.sort((a,b)=>b.data.localeCompare(a.data));
  }
  vibra(14); render(); toast(`${c.nome} · ${t("msg.quitada")}`);
}
async function marcarItem(id, on, d){
  vibra(on?6:12);
  if(on){
    const m = db.marcas.find(x=>x.habito_id===id && x.data===d);
    if(!m) return;
    const { error } = await sb.from("habito_marcas").delete().eq("id", m.id);
    if(error) return falhou(error);
    db.marcas = db.marcas.filter(x=>x.id!==m.id);
  }else{
    const { data, error } = await sb.from("habito_marcas").insert({ user_id:user.id, habito_id:id, data:d }).select().single();
    if(error) return falhou(error);
    db.marcas.push(data);
  }
  render();
}
async function addEvento(){
  const ti=$("e-tit").value.trim(); if(!ti) return;
  const lm=$("e-lem").value;
  const { data, error } = await sb.from("eventos").insert({
    user_id:user.id, espaco, data:selDia, hora:$("e-hora").value||null, titulo:ti,
    lembrete_min: lm?parseInt(lm,10):null }).select().single();
  if(error) return falhou(error);
  db.eventos.push(data); fecharSheet(); render(); toast(t("msg.compromisso"));
}
const ROTINA_BASE = [
  { hora:"07:30", titulo:"Acordar", itens:["Arrumar a cama","Água","Higiene","Sem celular por 20 minutos"] },
  { hora:"08:00", titulo:"Café da manhã", nota:"Sem responder mensagens ainda", itens:["Olhar a agenda do dia","Conferir o calendário","Revisar as tarefas"] },
  { hora:"08:30", titulo:"Organização", nota:"Antes do trabalho começar", itens:["Abrir Notion / Trello","Abrir WhatsApp","Abrir a agenda","O Lucas grava hoje?","Existe algum prazo?","Alguma entrega atrasada?","Algum conteúdo para aprovar?"] },
  { hora:"09:00", titulo:"Deep Work — 1º bloco", nota:"Sem interrupções", itens:["Planejamento de conteúdo","Organização dos stories","Ideias de reels","Roteiros","Branding","Análise dos concorrentes","Organização da semana"] },
  { hora:"11:00", titulo:"Operacional", itens:["Responder a equipe","Resolver pendências","Enviar materiais","Organizar demandas"] },
  { hora:"12:00", titulo:"Almoço", nota:"Nada de computador", itens:["Almoçar longe da tela"] },
  { hora:"13:00", titulo:"Planejamento do Lucas", itens:["Stories do dia","Reels","Roteiro","Horários","Ideias","Referências"] },
  { hora:"14:00", titulo:"Gravações", itens:["Acompanhar","Anotar cortes","Anotar ideias que surgirem","Pensar em conteúdos futuros"] },
  { hora:"16:00", titulo:"Deep Work — 2º bloco", itens:["Branding da Oris","Documentos","Planejamento semanal","Campanhas","Calendário editorial","Melhorias de processos"] },
  { hora:"17:30", titulo:"Revisão", itens:["O que ficou pendente?","O que precisa ser feito amanhã?","O que pode ser delegado?"] },
  { hora:"18:00", titulo:"Encerrar o operacional", itens:["Encerrar o operacional"] },
  { hora:"19:00", titulo:"Estudo — 40 minutos", itens:[{nome:"Branding",dia:1},{nome:"Marketing",dia:2},{nome:"Copywriting",dia:3},{nome:"Storytelling",dia:4},{nome:"Gestão",dia:5},{nome:"IA e automação",dia:6},{nome:"Tendências",dia:0}] },
  { hora:"20:00", titulo:"Tempo livre", itens:["Assistir algo","Conversar","Descansar"] },
  { hora:"21:30", titulo:"Preparar o dia seguinte", itens:["Separar as roupas","Conferir a agenda","Separar as tarefas","Escrever as 3 prioridades"] },
  { hora:"22:30", titulo:"Desligar telas", itens:["Desligar as telas"] },
  { hora:"23:59", titulo:"Dormir", itens:["Dormir"] }
];
async function instalarRotina(){
  toast(t("msg.instalando"));
  for(let i=0;i<ROTINA_BASE.length;i++){
    const b = ROTINA_BASE[i];
    const { data:bloco, error } = await sb.from("blocos_rotina")
      .insert({ user_id:user.id, hora:b.hora, titulo:b.titulo, nota:b.nota||null, ordem:i }).select().single();
    if(error) return falhou(error);
    db.blocos.push(bloco);
    const itens = b.itens.map((it,j)=>{
      const o = typeof it==="string" ? {nome:it,dia:null} : it;
      return { user_id:user.id, bloco_id:bloco.id, nome:o.nome, dia_semana:o.dia==null?null:o.dia, ordem:j };
    });
    const { data:novos, error:e2 } = await sb.from("habitos").insert(itens).select();
    if(e2) return falhou(e2);
    db.habitos.push(...novos);
  }
  render(); toast(t("msg.rotinaCriada"));
}

/* ================= IMPORTAÇÃO ================= */
function parseOFX(txt){
  const out = [];
  for(const b of txt.split(/<STMTTRN>/i).slice(1)){
    const g = re => { const m = b.match(re); return m ? m[1].trim() : ""; };
    const dt = g(/<DTPOSTED>([^<\r\n]+)/i).slice(0,8);
    const vl = parseFloat(g(/<TRNAMT>([^<\r\n]+)/i).replace(",","."));
    const me = g(/<MEMO>([^<\r\n]+)/i) || g(/<NAME>([^<\r\n]+)/i);
    if(!dt || !isFinite(vl)) continue;
    out.push({ data:`${dt.slice(0,4)}-${dt.slice(4,6)}-${dt.slice(6,8)}`, valor:Math.abs(vl),
               tipo: vl>=0?"entrada":"saida", nota:me });
  }
  return out;
}
function parseCSV(txt){
  const linhas = txt.split(/\r?\n/).filter(l=>l.trim());
  if(!linhas.length) return [];
  const sep = (linhas[0].match(/;/g)||[]).length > (linhas[0].match(/,/g)||[]).length ? ";" : ",";
  const cab = linhas[0].toLowerCase().split(sep).map(s=>s.trim().replace(/"/g,""));
  const iData = cab.findIndex(c=>/data|date|fecha/.test(c));
  const iVal  = cab.findIndex(c=>/valor|amount|importe|value/.test(c));
  const iDesc = cab.findIndex(c=>/desc|hist|memo|detalle|title/.test(c));
  if(iData<0 || iVal<0) return [];
  const out = [];
  for(const l of linhas.slice(1)){
    const p = l.split(sep).map(s=>s.trim().replace(/^"|"$/g,""));
    const bruto = p[iData]||""; let d = "";
    if(/^\d{4}-\d{2}-\d{2}/.test(bruto)) d = bruto.slice(0,10);
    else { const m = bruto.match(/(\d{2})[\/\-](\d{2})[\/\-](\d{4})/); if(m) d = `${m[3]}-${m[2]}-${m[1]}`; }
    const bruV = p[iVal]||"0";
    const val = Math.abs(numBR(bruV));
    if(!d || !val) continue;
    out.push({ data:d, valor:val, tipo: /-/.test(bruV) ? "saida" : "entrada", nota:(p[iDesc]||"").slice(0,120) });
  }
  return out;
}
const jaExiste = x => db.lancamentos.some(l => l.espaco===espaco && l.data===x.data &&
    Math.abs(l.valor - x.valor) < 0.005 && l.tipo===x.tipo);

async function lerArquivo(file){
  let txt;
  try{ txt = await file.text(); }catch(e){ return toast(t("msg.arquivoInvalido"), true); }
  let itens = /<STMTTRN>/i.test(txt) ? parseOFX(txt) : parseCSV(txt);
  if(!itens.length) return toast(t("msg.arquivoInvalido"), true);
  const antes = itens.length;
  itens = itens.filter(x=>!jaExiste(x));
  const dup = antes - itens.length;
  if(!itens.length) return toast(t("msg.nadaImportar"));
  importados = itens;
  const catsS = CATS()[espaco].saida, catsE = CATS()[espaco].entrada;
  abrirSheet(`
    ${cabSheet('<svg viewBox="0 0 24 24"><path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2"/></svg>', t("imp.revisar"))}
    ${dup?`<div class="t3" style="font-size:13.5px;margin-bottom:14px">${t("imp.duplicados",{n:dup})}</div>`:""}
    <div style="max-height:44vh;overflow-y:auto;margin-bottom:18px">
      ${itens.slice(0,60).map((x,i)=>`<div class="li" style="padding:11px 0">
        <span class="tag">${curto(x.data)}</span>
        <span class="n">${esc(x.nota||"—")}</span>
        <select data-cat="${i}" style="border:1px solid var(--linha);border-radius:8px;background:var(--campo);padding:7px 9px;font-size:13px">
          ${(x.tipo==="entrada"?catsE:catsS).map(c=>`<option>${esc(c)}</option>`).join("")}</select>
        <span class="v" style="color:${x.tipo==="entrada"?cor("--verde"):cor("--vermelho")}">${num(x.valor)}</span></div>`).join("")}
    </div>
    <button class="btn" id="imp-ok">${t("imp.confirmar",{n:itens.length})}</button>`);
  $("imp-ok").onclick = async ()=>{
    $$("#sheets [data-cat]").forEach(s => importados[+s.dataset.cat].categoria = s.value);
    const linhas = importados.map(x=>({
      user_id:user.id, espaco, tipo:x.tipo, data:x.data, valor:x.valor,
      categoria: x.categoria || (x.tipo==="entrada"?catsE[catsE.length-1]:catsS[catsS.length-1]),
      nota:(x.nota||"").slice(0,140),
      natureza:(espaco==="pessoal"&&x.tipo==="saida")?"essencial":null }));
    const { data, error } = await sb.from("lancamentos").insert(linhas).select();
    if(error) return falhou(error);
    db.lancamentos.unshift(...data.map(z=>({...z, valor:Number(z.valor)})));
    db.lancamentos.sort((a,b)=>b.data.localeCompare(a.data));
    fecharSheet(); render(); toast(`${data.length} ${t("msg.importados")}`);
  };
}

/* ================= LEMBRETES ================= */
function checarLembretes(){
  const ag=new Date(), h=isoDe(ag);
  db.eventos.filter(e=>e.data===h && e.hora && e.lembrete_min).forEach(e=>{
    if(avisados.has(e.id)) return;
    const [hh,mm]=hm(e.hora).split(":").map(Number);
    const q=new Date(ag); q.setHours(hh,mm,0,0);
    const f=(q-ag)/60000;
    if(f<=e.lembrete_min && f>-2){
      avisados.add(e.id);
      toast(`${e.titulo} · ${hm(e.hora)}`);
      try{ if("Notification" in window && Notification.permission==="granted")
        new Notification("NexVot", { body:`${e.titulo} — ${hm(e.hora)}` }); }catch(x){}
      vibra(30);
    }
  });
}

/* ================= EVENTOS GLOBAIS ================= */
function ligar(){
  $$(".side .item[data-v]").forEach(b => b.onclick = ()=>{ vibra(6); irPara(b.dataset.v); });
  $$("#seg-espaco button").forEach(b => b.onclick = ()=>{
    if(espaco===b.dataset.e) return;
    espaco = b.dataset.e;
    try{ localStorage.setItem("nexvot:espaco", espaco); }catch(e){}
    vibra(10); render();
  });
  $$("#seg-periodo button").forEach(b => b.onclick = ()=>{ periodo=b.dataset.p; vibra(6); render(); });
  $("bt-menu").onclick = ()=>{ vibra(8); abrirGaveta(); };
  $("bt-lang").onclick   = e=>{ e.stopPropagation(); alternarPop("bt-lang","pop-lang"); };
  $("bt-tema").onclick   = e=>{ e.stopPropagation(); alternarPop("bt-tema","pop-tema"); };
  $("bt-avisos").onclick = e=>{ e.stopPropagation(); alternarPop("bt-avisos","pop-avisos"); };
  $("bt-perfil").onclick = e=>{ e.stopPropagation(); alternarPop("bt-perfil","pop-perfil"); };
  $$("#pop-lang [data-lang]").forEach(b => b.onclick = ()=>{ fecharPop(); trocarIdioma(b.dataset.lang); });
  $$("#pop-tema [data-tema]").forEach(b => b.onclick = ()=>{ fecharPop(); aplicarTema(b.dataset.tema); });
  $$("#pop-perfil [data-ir]").forEach(b => b.onclick = ()=>{ fecharPop(); irPara(b.dataset.ir); });
  $("pop-sair").onclick = async ()=>{ await sb.auth.signOut(); location.reload(); };
  $$(".pop").forEach(p => p.addEventListener("click", e=>e.stopPropagation()));
  $("bt-novo").onclick = ()=>abrirLanc(hoje());
  $("fab").onclick = ()=>{ vibra(10); abrirLanc(hoje()); };
  $("bt-sair").onclick = async ()=>{ await sb.auth.signOut(); location.reload(); };
  $("bt-recolher").onclick = ()=>{
    document.body.classList.toggle("recolhido");
    try{ localStorage.setItem("nexvot:recolhido", document.body.classList.contains("recolhido")?"1":"0"); }catch(e){}
  };
  $("veu").onclick = fecharSheet;
  $("busca").addEventListener("input", e=>{
    const q = e.target.value.toLowerCase();
    $$(".side .item[data-v]").forEach(b=>{
      b.style.display = !q || b.textContent.toLowerCase().includes(q) ? "" : "none";
    });
  });
  document.addEventListener("keydown", e=>{
    if((e.metaKey||e.ctrlKey) && e.key.toLowerCase()==="k"){ e.preventDefault(); abrirGaveta(); $("busca").focus(); }
    if(e.key==="Escape"){ fecharSheet(); fecharGaveta(); fecharPop(); }
  });
  document.addEventListener("click", e=>{
    fecharPop();
    if(window.innerWidth<=1000 && $("side").classList.contains("aberta")
       && !e.target.closest("#side") && !e.target.closest("#bt-menu")) fecharGaveta();
  });
}

/* ================= EVENTOS DA TELA ================= */
function ligarTela(){
  const raiz = $("v-"+tela);
  const on = (sel, fn) => raiz.querySelectorAll(sel).forEach(fn);
  const add = (id, fn) => { const el = $(id); if(el) el.onclick = fn; };

  on("[data-acao]", b => b.onclick = ()=>{
    const a = b.dataset.acao;
    if(a==="novo") abrirLanc(hoje());
    else if(a==="entrada") abrirLanc(hoje(),"entrada");
    else if(a==="seed-rotina") instalarRotina();
    else if(a==="abrir-hoje") abrirDia(hoje());
    else if(a.startsWith("foco-")){
      const alvo = { "foco-orc":"orc-valor","foco-rec":"rec-desc","foco-meta":"meta-nome",
                     "foco-conta":"c-nome","foco-tarefa":"t-tit" }[a];
      const el = $(alvo); if(el) el.focus();
    }
    else if(TELAS.includes(a)) irPara(a);
  });

  on("[data-del-lanc]", b => b.onclick = ()=>apagar("lancamentos", b.dataset.delLanc, ()=>{
    db.lancamentos = db.lancamentos.filter(z=>z.id!==b.dataset.delLanc); }));
  on("[data-del-conta]", b => b.onclick = ()=>apagar("contas", b.dataset.delConta, ()=>{
    db.contas = db.contas.filter(z=>z.id!==b.dataset.delConta); }));
  on("[data-del-orc]", b => b.onclick = ()=>apagar("orcamentos", b.dataset.delOrc, ()=>{
    db.orcamentos = db.orcamentos.filter(z=>z.id!==b.dataset.delOrc); }));
  on("[data-del-rec]", b => b.onclick = ()=>apagar("recorrencias", b.dataset.delRec, ()=>{
    db.recorrencias = db.recorrencias.filter(z=>z.id!==b.dataset.delRec); }));
  on("[data-del-meta]", b => b.onclick = ()=>apagar("metas", b.dataset.delMeta, ()=>{
    db.metas = db.metas.filter(z=>z.id!==b.dataset.delMeta); }));
  on("[data-del-evt]", b => b.onclick = ()=>apagar("eventos", b.dataset.delEvt, ()=>{
    db.eventos = db.eventos.filter(z=>z.id!==b.dataset.delEvt); }));
  on("[data-del-tarefa]", b => b.onclick = ()=>apagar("tarefas", b.dataset.delTarefa, ()=>{
    db.tarefas = db.tarefas.filter(z=>z.id!==b.dataset.delTarefa); }));
  on("[data-del-membro]", b => b.onclick = ()=>apagar("membros", b.dataset.delMembro, ()=>{
    db.membros = db.membros.filter(z=>z.id!==b.dataset.delMembro); }));

  on("[data-pagar]", b => b.onclick = ()=>{
    const c = db.contas.find(x=>x.id===b.dataset.pagar);
    if(c && c.ultimo_pago !== mesDe(hoje())) pagarConta(c);
  });
  on("[data-dia]", b => b.onclick = ()=>{ vibra(); abrirDia(b.dataset.dia); });
  on("[data-cal]", b => b.onclick = ()=>{
    calRef.m += (+b.dataset.cal);
    if(calRef.m<1){ calRef.m=12; calRef.a--; }
    if(calRef.m>12){ calRef.m=1; calRef.a++; }
    render();
  });
  on("[data-rt]", b => b.onclick = ()=>{
    const n = +b.dataset.rt;
    rtDia = n===0 ? hoje() : mais(rtDia, n);
    blocoAberto = null; vibra(); render();
  });
  on("[data-bloco]", b => b.onclick = ()=>{
    blocoAberto = blocoAberto===b.dataset.bloco ? null : b.dataset.bloco;
    vibra(); render();
  });
  on("[data-edit-bloco]", b => b.onclick = ()=>{
    const bl = db.blocos.find(x=>x.id===b.dataset.editBloco); if(bl) abrirBloco(bl);
  });
  on("[data-item]", b => b.onclick = ()=>marcarItem(b.dataset.item, marcado(b.dataset.item, rtDia), rtDia));
  on("[data-tarefa]", b => b.onclick = async ()=>{
    const x = db.tarefas.find(z=>z.id===b.dataset.tarefa); if(!x) return;
    const { error } = await sb.from("tarefas").update({ feita: !x.feita }).eq("id", x.id);
    if(error) return falhou(error);
    x.feita = !x.feita; vibra(); render();
  });
  on("[data-lang]", b => b.onclick = ()=>trocarIdioma(b.dataset.lang));
  on("[data-toggle-rec]", b => b.onclick = async ()=>{
    const r = db.recorrencias.find(x=>x.id===b.dataset.toggleRec); if(!r) return;
    const { error } = await sb.from("recorrencias").update({ ativo: !r.ativo }).eq("id", r.id);
    if(error) return falhou(error);
    r.ativo = !r.ativo; render();
  });

  add("c-add", async ()=>{
    const n=$("c-nome").value.trim(), d=parseInt($("c-dia").value,10);
    if(!n||!d) return toast(t("auth.preencha"), true);
    const { data, error } = await sb.from("contas").insert({ user_id:user.id, espaco, nome:n,
      dia:Math.min(Math.max(d,1),31), valor:numBR($("c-valor").value) }).select().single();
    if(error) return falhou(error);
    db.contas.push({...data, valor:Number(data.valor||0)}); render(); toast(t("msg.contaCadastrada"));
  });
  add("orc-add", async ()=>{
    const c=$("orc-cat").value, v=numBR($("orc-valor").value);
    if(!v) return toast(t("auth.preencha"), true);
    const { data, error } = await sb.from("orcamentos")
      .upsert({ user_id:user.id, espaco, categoria:c, valor_mes:v }, { onConflict:"user_id,espaco,categoria" })
      .select().single();
    if(error) return falhou(error);
    db.orcamentos = db.orcamentos.filter(x=>!(x.espaco===espaco && x.categoria===c));
    db.orcamentos.push({...data, valor_mes:Number(data.valor_mes)});
    render(); toast(t("msg.tetoSalvo"));
  });
  add("rec-add", async ()=>{
    const d=parseInt($("rec-dia").value,10), v=numBR($("rec-valor").value);
    if(!d||!v) return toast(t("auth.preencha"), true);
    const tp=$("rec-tipo").value;
    const { data, error } = await sb.from("recorrencias").insert({
      user_id:user.id, espaco, tipo:tp, categoria:$("rec-cat").value,
      descricao:$("rec-desc").value.trim(), valor:v, dia:Math.min(Math.max(d,1),31),
      natureza:(espaco==="pessoal"&&tp==="saida")?"essencial":null }).select().single();
    if(error) return falhou(error);
    db.recorrencias.push({...data, valor:Number(data.valor)});
    await materializarRecorrencias();
    render(); toast(t("msg.recSalva"));
  });
  add("meta-add", async ()=>{
    const n=$("meta-nome").value.trim(), a=numBR($("meta-alvo").value);
    if(!n||!a) return toast(t("auth.preencha"), true);
    const { data, error } = await sb.from("metas").insert({ user_id:user.id, espaco, nome:n, alvo:a,
      categoria:$("meta-cat").value||null }).select().single();
    if(error) return falhou(error);
    db.metas.push({...data, alvo:Number(data.alvo)}); render(); toast(t("msg.metaSalva"));
  });
  add("t-add", async ()=>{
    const ti=$("t-tit").value.trim(); if(!ti) return;
    const { data, error } = await sb.from("tarefas").insert({ user_id:user.id, data:rtDia,
      hora:$("t-hora").value||null, titulo:ti }).select().single();
    if(error) return falhou(error);
    db.tarefas.push(data); render(); toast(t("msg.salvo"));
  });
  add("b-add", async ()=>{
    const h=$("b-hora").value, ti=$("b-tit").value.trim();
    if(!h||!ti) return toast(t("auth.preencha"), true);
    const { data, error } = await sb.from("blocos_rotina").insert({ user_id:user.id, hora:h, titulo:ti,
      ordem:db.blocos.length }).select().single();
    if(error) return falhou(error);
    db.blocos.push(data); blocoAberto=data.id; render(); toast(t("msg.salvo"));
  });
  add("rt-seed", instalarRotina);
  add("m-add", async ()=>{
    const n=$("m-nome").value.trim(); if(!n) return;
    const { data, error } = await sb.from("membros").insert({ user_id:user.id, nome:n, eh_voce:false }).select().single();
    if(error) return falhou(error);
    db.membros.push(data); render(); toast(t("msg.socioAdd"));
  });
  add("bt-backup", ()=>{
    const a=document.createElement("a");
    a.href=URL.createObjectURL(new Blob([JSON.stringify(db,null,2)],{type:"application/json"}));
    a.download=`nexvot-${hoje()}.json`; a.click();
  });
  add("bt-sair2", async ()=>{ await sb.auth.signOut(); location.reload(); });
  add("bt-pdf", ()=>{ toast(t("exp.dica")); setTimeout(()=>window.print(), 500); });

  const drop = $("drop"), arq = $("arq");
  if(drop && arq){
    drop.onclick = ()=>arq.click();
    arq.onchange = e => { if(e.target.files[0]) lerArquivo(e.target.files[0]); };
    ["dragenter","dragover"].forEach(ev => drop.addEventListener(ev, e=>{ e.preventDefault(); drop.classList.add("sobre"); }));
    ["dragleave","drop"].forEach(ev => drop.addEventListener(ev, e=>{ e.preventDefault(); drop.classList.remove("sobre"); }));
    drop.addEventListener("drop", e=>{ const f=e.dataTransfer.files[0]; if(f) lerArquivo(f); });
  }
}

window.addEventListener("unhandledrejection", e=>{
  if(!$("splash").hidden) fatal("Erro: "+((e.reason&&e.reason.message)||e.reason));
});

boot().catch(e => fatal("Falha ao iniciar: "+e.message));
