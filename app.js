// ============================================================
//  NEXVOT — Gestão Inteligente — app.js (v8)
//  Login de verdade + tema claro/escuro + layout responsivo.
//  Requer schema.sql + schema2.sql + schema3.sql rodados.
// ============================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

window.__OK__ = true;
let sb = null;

const $ = id => document.getElementById(id);
function fatal(msg){
  const el = $("splash-txt");
  if(el){ el.className = "st erro"; el.textContent = msg; }
  console.error("[NexVot]", msg);
}

/* ================= constantes ================= */
const CATS = {
  pessoal:{ saida:["Mercado","Comer fora","Transporte","Casa","Contas","Saúde","Lazer","Outros"],
            entrada:["Salário","Freela","Rendimento","Outros"] },
  empresa:{ saida:["Estoque","Marketing","Frete","Ferramentas","Impostos","Pró-labore","Outros"],
            entrada:["Vendas","Serviços","Outros"] }
};
const NAT_PADRAO = { "Mercado":"essencial","Transporte":"essencial","Casa":"essencial","Contas":"essencial",
                     "Saúde":"essencial","Comer fora":"futil","Lazer":"futil","Outros":"essencial" };
const ROTINA = [
  { hora:"07:30", titulo:"Acordar", itens:["Arrumar a cama","Água","Higiene","Sem celular por 20 minutos"] },
  { hora:"08:00", titulo:"Café da manhã", nota:"Sem responder mensagens ainda",
    itens:["Olhar a agenda do dia","Conferir o calendário","Revisar as tarefas"] },
  { hora:"08:30", titulo:"Organização", nota:"Antes do trabalho começar",
    itens:["Abrir Notion / Trello","Abrir WhatsApp","Abrir a agenda","O Lucas grava hoje?","Existe algum prazo?","Alguma entrega atrasada?","Algum conteúdo para aprovar?"] },
  { hora:"09:00", titulo:"Deep Work — 1º bloco", nota:"Sem interrupções",
    itens:["Planejamento de conteúdo","Organização dos stories","Ideias de reels","Roteiros","Branding","Análise dos concorrentes","Organização da semana"] },
  { hora:"11:00", titulo:"Operacional", itens:["Responder a equipe","Resolver pendências","Enviar materiais","Organizar demandas"] },
  { hora:"12:00", titulo:"Almoço", nota:"Nada de computador", itens:["Almoçar longe da tela"] },
  { hora:"13:00", titulo:"Planejamento do Lucas", nota:"Quando ele começar a gravar, tudo já está pronto",
    itens:["Stories do dia","Reels","Roteiro","Horários","Ideias","Referências"] },
  { hora:"14:00", titulo:"Gravações", itens:["Acompanhar","Anotar cortes","Anotar ideias que surgirem","Pensar em conteúdos futuros"] },
  { hora:"16:00", titulo:"Deep Work — 2º bloco", nota:"Sem interrupção",
    itens:["Branding da Oris","Documentos","Planejamento semanal","Campanhas","Calendário editorial","Melhorias de processos"] },
  { hora:"17:30", titulo:"Revisão", itens:["O que ficou pendente?","O que precisa ser feito amanhã?","O que pode ser delegado?"] },
  { hora:"18:00", titulo:"Encerrar o operacional", itens:["Encerrar o operacional"] },
  { hora:"19:00", titulo:"Estudo — 40 minutos", nota:"Aprender mais que a média é o diferencial",
    itens:[{nome:"Branding",dia:1},{nome:"Marketing",dia:2},{nome:"Copywriting",dia:3},{nome:"Storytelling",dia:4},
           {nome:"Gestão",dia:5},{nome:"IA e automação",dia:6},{nome:"Tendências",dia:0}] },
  { hora:"20:00", titulo:"Tempo livre", itens:["Assistir algo","Conversar","Descansar"] },
  { hora:"21:30", titulo:"Preparar o dia seguinte", itens:["Separar as roupas","Conferir a agenda","Separar as tarefas","Escrever as 3 prioridades"] },
  { hora:"22:30", titulo:"Desligar telas", itens:["Desligar as telas"] },
  { hora:"23:59", titulo:"Dormir", itens:["Dormir"] }
];
const VIEWS = ["painel","rotina","agenda","numeros"];
const DIAS = ["domingo","segunda","terça","quarta","quinta","sexta","sábado"];
const cor = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

/* ================= estado ================= */
let user = null, espaco = "pessoal", view = "painel", modoAuth = "entrar";
let calRef = null, selDia = null, rtDia = null, blocoAberto = null, blocoEdit = null, dataAlvo = null;
let tipoSel = "saida", catSel = null, natSel = "essencial", membroSel = null, dig = "";
const avisados = new Set();
const db = { lancamentos:[], contas:[], habitos:[], marcas:[], fechados:[], eventos:[], membros:[], blocos:[], tarefas:[] };

/* ================= utils ================= */
const isoDe = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
const hoje = () => isoDe(new Date());
const mesDe = s => s.slice(0,7);
const ultDia = (a,m) => new Date(a,m,0).getDate();
const dtMes = (a,m,d) => `${a}-${String(m).padStart(2,"0")}-${String(Math.min(Math.max(d,1),ultDia(a,m))).padStart(2,"0")}`;
const dif = (a,b) => Math.round((new Date(b+"T00:00:00") - new Date(a+"T00:00:00"))/86400000);
const mais = (s,n) => { const d = new Date(s+"T00:00:00"); d.setDate(d.getDate()+n); return isoDe(d); };
const dsem = s => new Date(s+"T00:00:00").getDay();
const brl = n => Number(n).toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2});
const brl0 = n => { const a=Math.abs(n); const s=a>=1000?(a/1000).toFixed(a>=10000?0:1).replace(".",",")+"k":String(Math.round(a)); return (n<0?"-":"")+s; };
const esc = s => String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const numBR = s => { const n = parseFloat(String(s).replace(/\./g,"").replace(",",".")); return isFinite(n)?n:0; };
const ext = (s,o) => new Date(s+"T00:00:00").toLocaleDateString("pt-BR", o||{weekday:"long",day:"2-digit",month:"long"});
const curto = s => s.slice(8,10)+"/"+s.slice(5,7);
const hm = h => h ? h.slice(0,5) : "";
const vibra = ms => { try{ navigator.vibrate && navigator.vibrate(ms||8); }catch(e){} };
const parado = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

let tT = null;
function toast(txt, erro){
  let el = $("toast");
  if(!el){ el = document.createElement("div"); el.id="toast"; el.className="toast"; document.body.appendChild(el); }
  el.textContent = txt;
  el.style.background = erro ? cor("--sai") : cor("--barra");
  clearTimeout(tT); tT = setTimeout(()=>el.remove(), erro?4200:1700);
}
const falhou = e => { console.error(e); toast((e&&e.message)||"falha ao salvar", true); };

function anima(el, alvo){
  const fim = Number(alvo)||0;
  if(parado()){ el.innerHTML = `<small>R$</small>${brl(fim)}`; return; }
  const t0 = performance.now();
  const passo = t => {
    const p = Math.min((t-t0)/500, 1), e = 1-Math.pow(1-p,3);
    el.innerHTML = `<small>R$</small>${brl(fim*e)}`;
    if(p<1) requestAnimationFrame(passo);
  };
  requestAnimationFrame(passo);
}

/* ================= tema ================= */
function temaAtual(){ return document.documentElement.dataset.tema || "claro"; }
function aplicarTema(t){
  document.documentElement.dataset.tema = t;
  try{ localStorage.setItem("nexvot:tema", t); }catch(e){}
  const meta = document.querySelector('meta[name="theme-color"]');
  if(meta) meta.setAttribute("content", t==="escuro" ? "#101312" : "#F4F5F3");
  const bt = $("side-tema"); if(bt) bt.textContent = t==="escuro" ? "Tema claro" : "Tema escuro";
  const ic = $("ic-tema");
  if(ic) ic.innerHTML = t==="escuro"
    ? '<circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5 5l1.5 1.5M17.5 17.5L19 19M19 5l-1.5 1.5M6.5 17.5L5 19"/>'
    : '<path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z"/>';
  if(!$("shell").hidden) render();
}

/* ================= boot / auth ================= */
async function boot(){
  if(!window.CONFIG) return fatal("O config.js não carregou.");
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

  aplicarTema(temaAtual());
  $("splash").hidden = true;

  if(ses && !ses.user.is_anonymous){ user = ses.user; return entrar(); }
  if(ses && ses.user.is_anonymous){ try{ await sb.auth.signOut(); }catch(e){} }
  telaAuth();
}

function telaAuth(){
  $("auth").hidden = false;
  $("auth-tabs").querySelectorAll("button").forEach(b=> b.onclick = ()=>{
    modoAuth = b.dataset.m;
    $("auth-tabs").querySelectorAll("button").forEach(x=>x.classList.toggle("on", x.dataset.m===modoAuth));
    $("a-ok").textContent = modoAuth==="entrar" ? "Entrar" : "Criar conta";
    $("a-senha").setAttribute("autocomplete", modoAuth==="entrar" ? "current-password" : "new-password");
    $("a-msg").textContent = "";
  });
  $("a-ok").onclick = autenticar;
  ["a-email","a-senha"].forEach(k => $(k).addEventListener("keydown", e=>{ if(e.key==="Enter") autenticar(); }));
}

async function autenticar(){
  const msg = $("a-msg"), email = $("a-email").value.trim(), senha = $("a-senha").value;
  if(!email || !senha){ msg.className="msg erro"; msg.textContent="Preencha e-mail e senha."; return; }
  if(modoAuth==="criar" && senha.length < 6){ msg.className="msg erro"; msg.textContent="A senha precisa de pelo menos 6 caracteres."; return; }
  msg.className = "msg"; msg.textContent = modoAuth==="entrar" ? "entrando…" : "criando…";
  $("a-ok").disabled = true;

  const r = modoAuth==="entrar"
    ? await sb.auth.signInWithPassword({ email, password:senha })
    : await sb.auth.signUp({ email, password:senha });
  $("a-ok").disabled = false;

  if(r.error){
    msg.className = "msg erro";
    msg.textContent = r.error.message.includes("Invalid login")
      ? "E-mail ou senha incorretos." : r.error.message;
    return;
  }
  if(!r.data.session){
    msg.className = "msg ok";
    msg.textContent = "Conta criada. Confirme o e-mail e volte para entrar.";
    return;
  }
  user = r.data.user; msg.textContent = "";
  $("auth").hidden = true;
  entrar();
}

async function entrar(){
  $("auth").hidden = true;
  $("shell").hidden = false;
  $("nav").hidden = false;
  $("side-email").textContent = user.email || "";
  selDia = hoje(); rtDia = hoje(); dataAlvo = hoje();
  calRef = { a:+selDia.slice(0,4), m:+selDia.slice(5,7) };
  try{ espaco = localStorage.getItem("nexvot:espaco") || "pessoal"; }catch(e){}
  ligar();
  aplicarEspaco(false);
  irPara("painel");
  await carregar();
  setInterval(lembretes, 30000);
}

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
    sb.from("tarefas").select("*").order("hora")
  ]);
  const err = r.find(x=>x.error);
  if(err) return falhou(err.error);
  const [l,c,h,m,f,e,mb,bl,tf] = r;
  db.lancamentos = (l.data||[]).map(x=>({...x, valor:Number(x.valor)}));
  db.contas = (c.data||[]).map(x=>({...x, valor:Number(x.valor||0)}));
  db.habitos = h.data||[]; db.marcas = m.data||[];
  db.fechados = (f.data||[]).map(x=>x.data);
  db.eventos = e.data||[]; db.membros = mb.data||[];
  db.blocos = bl.data||[]; db.tarefas = tf.data||[];
  if(!db.membros.length){
    const { data:n } = await sb.from("membros").insert({ user_id:user.id, nome:"Você", eh_voce:true }).select().single();
    if(n) db.membros = [n];
  }
  render();
}

/* ================= seleção ================= */
const lancs = () => db.lancamentos.filter(x=>x.espaco===espaco);
const contas = () => db.contas.filter(x=>x.espaco===espaco);
const evts = () => db.eventos.filter(x=>x.espaco===espaco);
const som = a => a.reduce((s,x)=>s+x.valor,0);
const noDia = (d,t) => lancs().filter(x=>x.data===d && (!t||x.tipo===t));
const noMes = (y,t) => lancs().filter(x=>mesDe(x.data)===y && (!t||x.tipo===t));
const sai = d => som(noDia(d,"saida"));
const ent = d => som(noDia(d,"entrada"));
function acum(y, ate){
  const a=+y.slice(0,4), m=+y.slice(5,7); const lim = ate||ultDia(a,m); const o=[]; let s=0;
  for(let d=1;d<=lim;d++){ s += sai(dtMes(a,m,d)); o.push(s); } return o;
}
function mesAnt(y){ const a=+y.slice(0,4), m=+y.slice(5,7); return m===1?`${a-1}-12`:`${a}-${String(m-1).padStart(2,"0")}`; }
function venc(c){
  const h=hoje(), a=+h.slice(0,4), m=+h.slice(5,7);
  if(c.ultimo_pago===mesDe(h)){ const mm=m===12?1:m+1, aa=m===12?a+1:a; return dtMes(aa,mm,c.dia); }
  return dtMes(a,m,c.dia);
}
const contasOrd = () => [...contas()].sort((x,y)=>venc(x).localeCompare(venc(y)));
const contasDia = d => { const a=+d.slice(0,4), m=+d.slice(5,7); return contas().filter(c=>dtMes(a,m,c.dia)===d); };
const evtsDia = d => evts().filter(e=>e.data===d).sort((x,y)=>(x.hora||"99").localeCompare(y.hora||"99"));
const marcado = (id,d) => db.marcas.some(x=>x.habito_id===id && x.data===d);
function streak(l){ const s=new Set(l); let b=hoje(); if(!s.has(b)) b=mais(b,-1); let n=0; while(s.has(b)){n++;b=mais(b,-1);} return n; }
function rank(y){ const s={}; noMes(y,"saida").forEach(x=>{s[x.categoria]=(s[x.categoria]||0)+x.valor;}); return Object.entries(s).sort((a,b)=>b[1]-a[1]); }
const nomeM = id => (db.membros.find(m=>m.id===id)||{}).nome || "—";
const itensBloco = (id,d) => db.habitos.filter(x=>x.bloco_id===id && (x.dia_semana==null || x.dia_semana===dsem(d))).sort((a,b)=>(a.ordem||0)-(b.ordem||0));
const tarefasDia = d => db.tarefas.filter(t=>t.data===d).sort((a,b)=>(a.hora||"99").localeCompare(b.hora||"99"));

/* ================= gráficos ================= */
function gFluxo(){
  const h = hoje(); const dias=[]; for(let i=13;i>=0;i--) dias.push(mais(h,-i));
  const ins = dias.map(ent), outs = dias.map(sai);
  const mx = Math.max(...ins, ...outs, 1);
  if(!ins.some(v=>v>0) && !outs.some(v=>v>0))
    return '<div class="vazio" style="padding:14px 0">Sem movimento nos últimos 14 dias.</div>';
  const W=100,H=44,l=W/dias.length, cE=cor("--entra"), cS=cor("--sai");
  const b = dias.map((d,i)=>{
    const x=i*l, hi=(ins[i]/mx)*(H/2-2), ho=(outs[i]/mx)*(H/2-2);
    return (ins[i]>0?`<rect x="${(x+l*.12).toFixed(2)}" y="${(H/2-hi).toFixed(2)}" width="${(l*.32).toFixed(2)}" height="${hi.toFixed(2)}" rx=".5" fill="${cE}"/>`:"")
         + (outs[i]>0?`<rect x="${(x+l*.54).toFixed(2)}" y="${(H/2).toFixed(2)}" width="${(l*.32).toFixed(2)}" height="${ho.toFixed(2)}" rx=".5" fill="${cS}"/>`:"");
  }).join("");
  return `<svg viewBox="0 0 ${W} ${H+8}" width="100%" height="150" preserveAspectRatio="none" role="img" aria-label="Entradas e saídas dos últimos 14 dias">
    <line x1="0" y1="${H/2}" x2="${W}" y2="${H/2}" stroke="${cor("--linha")}" stroke-width=".4"/>${b}
    <text x="0" y="${H+6}" font-size="3.4" fill="${cor("--txt3")}">${curto(dias[0])}</text>
    <text x="${W}" y="${H+6}" font-size="3.4" text-anchor="end" fill="${cor("--txt3")}">hoje</text></svg>`;
}

function gRitmo(){
  const h=hoje(), y=mesDe(h), d=+h.slice(8,10);
  const at=acum(y,d), an=acum(mesAnt(y));
  const W=100,H=44,p=2, n=Math.max(at.length,an.length,2), mx=Math.max(...at,...an,1);
  const px=i=>p+(i/(n-1))*(W-p*2), py=v=>H-p-(v/mx)*(H-p*2);
  const ln=a=>a.map((v,i)=>`${px(i).toFixed(2)},${py(v).toFixed(2)}`).join(" ");
  const tA=an.some(v=>v>0);
  if(!at.some(v=>v>0) && !tA){ $("leg-rit").textContent=""; return '<div class="vazio" style="padding:14px 0">Sem saídas para desenhar.</div>'; }
  $("leg-rit").textContent = "laranja: este mês · cinza: anterior";
  const c=cor("--laranja");
  return `<svg viewBox="0 0 ${W} ${H+8}" width="100%" height="150" preserveAspectRatio="none" role="img" aria-label="Saídas acumuladas">
    <line x1="${p}" y1="${py(mx/2).toFixed(2)}" x2="${W-p}" y2="${py(mx/2).toFixed(2)}" stroke="${cor("--linha")}" stroke-width=".35"/>
    ${tA?`<polyline points="${ln(an)}" fill="none" stroke="${cor("--txt3")}" stroke-width=".7" stroke-dasharray="1.6 1.4" vector-effect="non-scaling-stroke"/>`:""}
    <polygon points="${p},${H-p} ${ln(at)} ${px(at.length-1).toFixed(2)},${H-p}" fill="${c}" fill-opacity=".13"/>
    <polyline points="${ln(at)}" fill="none" stroke="${c}" stroke-width="1.4" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>
    <text x="${p}" y="${H+6}" font-size="3.4" fill="${cor("--txt3")}">dia 1</text>
    <text x="${W-p}" y="${H+6}" font-size="3.4" text-anchor="end" fill="${cor("--txt3")}">R$ ${brl0(mx)}</text></svg>`;
}

function gDonut(){
  const pares = rank(mesDe(hoje()));
  if(!pares.length){ $("leg-donut").innerHTML=""; return '<div class="vazio" style="padding:14px 0">Nenhuma saída este mês.</div>'; }
  const tot = pares.reduce((s,[,v])=>s+v,0), R=42, C=2*Math.PI*R;
  const paleta = [cor("--sai"), cor("--alerta"), cor("--laranja"), "#9CA3AF", "#6B7280", "#C4A484", "#8B9DC3", "#B0B7B4"];
  let off = 0;
  const arcos = pares.map(([c,v],i)=>{
    const len=(v/tot)*C;
    const el=`<circle cx="60" cy="60" r="${R}" fill="none" stroke="${paleta[i%paleta.length]}" stroke-width="16"
      stroke-dasharray="${Math.max(len-1.6,.5).toFixed(2)} ${(C-len+1.6).toFixed(2)}" stroke-dashoffset="${(-off).toFixed(2)}" transform="rotate(-90 60 60)"/>`;
    off += len; return el;
  }).join("");
  $("leg-donut").innerHTML = pares.slice(0,7).map(([c,v],i)=>
    `<div style="display:flex;align-items:center;gap:10px;padding:5px 0;font-size:13px">
      <i class="dot" style="background:${paleta[i%paleta.length]}"></i>
      <span style="flex:1;color:var(--txt2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(c)}</span>
      <b style="font-variant-numeric:tabular-nums">${Math.round(v/tot*100)}%</b></div>`).join("");
  return `<svg viewBox="0 0 120 120" width="100%" height="160" role="img" aria-label="Saídas por categoria">${arcos}
    <text x="60" y="56" text-anchor="middle" font-size="7" fill="${cor("--txt2")}">saídas do mês</text>
    <text x="60" y="72" text-anchor="middle" font-size="15" font-weight="700" fill="${cor("--txt")}">R$ ${brl0(tot)}</text></svg>`;
}

/* ================= render ================= */
function render(){
  const h=hoje(), y=mesDe(h), d=+h.slice(8,10);
  $("topo-hoje").textContent = ext(h,{weekday:"long",day:"2-digit",month:"long"}).replace(/^\w/,c=>c.toUpperCase());
  $("topo-sub").textContent = espaco==="pessoal" ? "Espaço pessoal" : "Espaço empresa";
  const fec = db.fechados.includes(h);
  const bd = $("bt-dia");
  bd.className = "bt-dia press" + (fec?" feito":"");
  bd.disabled = fec;
  bd.textContent = fec ? `✓ ${streak(db.fechados)} dias seguidos` : "Fechar o dia";

  const iM = som(noMes(y,"entrada")), oM = som(noMes(y,"saida")), sM = iM-oM;
  if(espaco==="pessoal") rPessoal(h,y,d,oM); else rEmpresa(y,iM,oM,sM);
  rContas(); rLanc(); rRotina(); rCalendario(); rEventos(); rNumeros(h,y,d,iM,oM,sM);
  $("g-fluxo").innerHTML = gFluxo();
}

function rPessoal(h,y,d,oM){
  const e=ent(h), s=sai(h);
  anima($("p-saldo"), e-s);
  $("p-saldo").style.color = (e-s)<0 ? cor("--sai") : (e-s)>0 ? cor("--entra") : "";
  $("p-in").textContent = `entrou R$ ${brl0(e)}`;
  $("p-out").textContent = `saiu R$ ${brl0(s)}`;
  const an = acum(mesAnt(y), d), base = an.length?an[an.length-1]:0;
  const pr = $("p-ritmo");
  if(base<=0){ pr.className="pill"; pr.textContent="sem base do mês passado"; }
  else{ const p=Math.round((oM/base-1)*100); pr.className="pill "+(p>0?"warn":"up"); pr.textContent=`${p>0?"+":""}${p}% vs. mês passado`; }

  const sd = noMes(y,"saida");
  const ess = som(sd.filter(x=>x.natureza!=="futil")), fut = som(sd.filter(x=>x.natureza==="futil"));
  const t = ess+fut, pf = t>0?Math.round(fut/t*100):0;
  $("sp-e").style.width = t>0?(100-pf)+"%":"100%";
  $("sp-f").style.width = t>0?pf+"%":"0%";
  $("lg-e").textContent = `Essencial R$ ${brl0(ess)}`;
  $("lg-f").textContent = `Fútil R$ ${brl0(fut)}`;
  $("fut-pct").textContent = t>0 ? pf+"% fútil" : "sem dados";
}

function rEmpresa(y,iM,oM,lucro){
  anima($("e-lucro"), lucro);
  $("e-lucro").style.color = lucro<0 ? cor("--sai") : lucro>0 ? cor("--entra") : "";
  const roi = oM>0 ? ((iM-oM)/oM)*100 : null;
  const er = $("e-roi");
  er.className = "pill " + (roi===null?"":roi>=0?"up":"down");
  er.textContent = roi===null ? "ROI sem base" : `ROI ${roi>0?"+":""}${roi.toFixed(0)}%`;
  const mg = iM>0 ? (lucro/iM)*100 : null;
  $("e-margem").textContent = mg===null ? "sem receita" : `margem ${mg.toFixed(0)}%`;
  $("e-in").textContent = "R$ "+brl(iM);
  $("e-out").textContent = "R$ "+brl(oM);
  $("e-in-s").textContent = noMes(y,"entrada").length+" lançamentos";
  $("e-out-s").textContent = noMes(y,"saida").length+" lançamentos";

  const g={}; noMes(y,"saida").forEach(x=>{ const k=x.membro_id||"sem"; g[k]=(g[k]||0)+x.valor; });
  const pares = Object.entries(g).sort((a,b)=>b[1]-a[1]);
  const tot = pares.reduce((s,[,v])=>s+v,0);
  $("e-soc-t").textContent = tot>0?"R$ "+brl0(tot):"";
  const box = $("e-socios");
  if(!pares.length){ box.innerHTML = '<div class="vazio" style="padding:6px 0">Nenhuma saída este mês. Ao lançar, escolha de quem foi o gasto.</div>'; }
  else{
    const mx = pares[0][1];
    box.innerHTML = pares.map(([k,v])=>
      `<div class="bl"><span class="n">${esc(k==="sem"?"não atribuído":nomeM(k))}</span>
       <span class="tr"><i style="width:${Math.max(3,(v/mx)*100)}%"></i></span>
       <span class="v">R$ ${brl0(v)}</span></div>`).join("");
  }
}

function rContas(){
  const h=hoje(), ul=$("l-contas"); ul.innerHTML="";
  if(!contas().length){ ul.innerHTML='<li class="vazio">Sem contas neste espaço. Adicione as fixas abaixo.</li>'; return; }
  contasOrd().slice(0,7).forEach(c=>{
    const d = dif(h, venc(c));
    const cl = d<0?"venc":d<=3?"perto":"";
    const li = document.createElement("li"); li.className="lin";
    li.innerHTML = `<span class="badge ${cl}">${d<0?`${-d}d atrás`:d===0?"hoje":`${d}d`}</span>
      <span class="n">${esc(c.nome)}</span><span class="v">${c.valor?"R$ "+brl(c.valor):""}</span>`;
    const pg = document.createElement("button"); pg.className="mini press"; pg.textContent="paguei";
    pg.onclick = ()=>pagar(c);
    const x = document.createElement("button"); x.className="x press"; x.textContent="✕";
    x.onclick = ()=>apagar("contas", c.id, ()=>{ db.contas = db.contas.filter(z=>z.id!==c.id); });
    li.append(pg,x); ul.appendChild(li);
  });
}

function rLanc(){
  const h=hoje(), ul=$("l-lanc"); ul.innerHTML="";
  $("cnt-hoje").textContent = noDia(h).length+" hoje";
  const ult = lancs().slice(0,8);
  if(!ult.length){ ul.innerHTML='<li class="vazio">Nada lançado neste espaço. Toque no + para começar.</li>'; return; }
  ult.forEach(l=>{
    const li = document.createElement("li"); li.className="lin";
    const sub = [l.nota, espaco==="empresa"&&l.membro_id?nomeM(l.membro_id):""].filter(Boolean).join(" · ");
    li.innerHTML = `<span class="dot" style="background:${l.tipo==="entrada"?cor("--entra"):cor("--sai")}"></span>
      <span class="n">${esc(l.categoria)}${sub?`<small>${esc(sub)}</small>`:""}</span>
      ${l.natureza==="futil"?'<span class="badge fut">fútil</span>':""}
      <span class="badge">${l.data===h?"hoje":curto(l.data)}</span>
      <span class="v ${l.tipo==="entrada"?"entra":"sai"}">${l.tipo==="entrada"?"+":"−"} ${brl(l.valor)}</span>`;
    const x = document.createElement("button"); x.className="x press"; x.textContent="✕";
    x.onclick = ()=>apagar("lancamentos", l.id, ()=>{ db.lancamentos = db.lancamentos.filter(z=>z.id!==l.id); });
    li.appendChild(x); ul.appendChild(li);
  });
}

function rRotina(){
  const d=rtDia, h=hoje();
  const rel = d===h?"hoje":d===mais(h,-1)?"ontem":d===mais(h,1)?"amanhã"
    :(dif(h,d)>0?`em ${dif(h,d)} dias`:`${-dif(h,d)} dias atrás`);
  $("rt-data").textContent = ext(d,{weekday:"long",day:"2-digit",month:"short"}).replace(/\./g,"");
  $("rt-rel").textContent = rel;

  const box=$("rt-blocos"); box.innerHTML="";
  $("rt-seed").hidden = db.blocos.length>0;
  if(!db.blocos.length){
    box.innerHTML = '<div class="card"><div class="vazio">Nenhum bloco ainda. Use “Instalar minha rotina padrão” abaixo — depois é só editar o que não bater.</div></div>';
    $("rt-barra").style.width="0%";
  }else{
    let tI=0,tF=0;
    const agora = new Date().toTimeString().slice(0,5);
    const bs = [...db.blocos].sort((a,b)=>a.hora.localeCompare(b.hora));
    bs.forEach((bl,i)=>{
      const itens = itensBloco(bl.id,d);
      const feitos = itens.filter(x=>marcado(x.id,d)).length;
      tI+=itens.length; tF+=feitos;
      const ok = itens.length>0 && feitos===itens.length;
      const prox = bs[i+1];
      const nesse = d===h && hm(bl.hora)<=agora && (!prox || agora<hm(prox.hora));
      const ab = blocoAberto===bl.id;
      const el = document.createElement("div");
      el.className = "blk" + (ok?" ok":"") + (nesse&&!ok?" agora":"");
      const c = document.createElement("button");
      c.className = "blk-c press"; c.setAttribute("aria-expanded", String(ab));
      c.innerHTML = `<span class="blk-h">${hm(bl.hora)}</span><span class="blk-t">${esc(bl.titulo)}</span>
        ${nesse&&!ok?'<span class="selo">agora</span>':""}
        <span class="blk-n">${feitos}/${itens.length}</span><span class="blk-s">${ab?"▾":"▸"}</span>`;
      c.onclick = ()=>{ blocoAberto = ab?null:bl.id; vibra(); rRotina(); };
      el.appendChild(c);
      if(ab){
        const b = document.createElement("div"); b.className="blk-b";
        if(bl.nota){ const n=document.createElement("div"); n.className="blk-nota"; n.textContent=bl.nota; b.appendChild(n); }
        if(!itens.length){ const v=document.createElement("div"); v.className="vazio"; v.style.padding="10px 0"; v.textContent="Nenhum item para "+DIAS[dsem(d)]+"."; b.appendChild(v); }
        itens.forEach(it=>{
          const on = marcado(it.id,d);
          const li = document.createElement("button");
          li.className = "tk press"+(on?" on":""); li.setAttribute("aria-pressed", String(on));
          li.innerHTML = `<span class="cx">✓</span><span class="t">${esc(it.nome)}</span>`
            + (it.dia_semana!=null?`<span class="h">${DIAS[it.dia_semana].slice(0,3)}</span>`:"");
          li.onclick = ()=>marcar(it,on,d);
          b.appendChild(li);
        });
        const ed = document.createElement("button");
        ed.className="mini press"; ed.style.cssText="width:100%;margin-top:12px";
        ed.textContent="Editar este bloco"; ed.onclick=()=>abrirBloco(bl);
        b.appendChild(ed); el.appendChild(b);
      }
      box.appendChild(el);
    });
    $("rt-barra").style.width = tI?Math.round(tF/tI*100)+"%":"0%";
  }

  const ul=$("rt-tarefas"); ul.innerHTML="";
  const ts=tarefasDia(d);
  $("rt-tc").textContent = ts.length ? ts.filter(t=>t.feita).length+"/"+ts.length : "";
  if(!ts.length) ul.innerHTML='<li class="vazio">Nada só para este dia.</li>';
  ts.forEach(t=>{
    const li=document.createElement("li"); li.className="lin";
    const cx=document.createElement("button");
    cx.className="cx press"; cx.textContent=t.feita?"✓":""; 
    cx.style.background = t.feita?cor("--entra"):"";
    cx.style.borderColor = t.feita?cor("--entra"):"";
    cx.style.color = t.feita?"#fff":"transparent";
    cx.onclick=()=>toggleTarefa(t);
    const n=document.createElement("span"); n.className="n"; n.textContent=t.titulo;
    if(t.feita){ n.style.color=cor("--txt3"); n.style.textDecoration="line-through"; }
    const hh=document.createElement("span"); hh.className="badge"; hh.textContent=hm(t.hora)||"—";
    const x=document.createElement("button"); x.className="x press"; x.textContent="✕";
    x.onclick=()=>apagar("tarefas", t.id, ()=>{ db.tarefas = db.tarefas.filter(z=>z.id!==t.id); });
    li.append(cx,n,hh,x); ul.appendChild(li);
  });
}

function abrirBloco(bl){
  blocoEdit = bl;
  $("bl-tit").textContent = hm(bl.hora)+" — "+bl.titulo;
  $("bl-hora").value = hm(bl.hora); $("bl-nome").value = bl.titulo;
  const ul=$("bl-itens"); ul.innerHTML="";
  const todos = db.habitos.filter(x=>x.bloco_id===bl.id).sort((a,b)=>(a.ordem||0)-(b.ordem||0));
  if(!todos.length) ul.innerHTML='<li class="vazio">Bloco sem itens.</li>';
  todos.forEach(it=>{
    const li=document.createElement("li"); li.className="lin";
    li.innerHTML = `<span class="n">${esc(it.nome)}</span>`+(it.dia_semana!=null?`<span class="badge">só ${DIAS[it.dia_semana]}</span>`:"");
    const x=document.createElement("button"); x.className="x press"; x.textContent="✕";
    x.onclick = async ()=>{
      const { error } = await sb.from("habitos").delete().eq("id", it.id);
      if(error) return falhou(error);
      db.habitos = db.habitos.filter(z=>z.id!==it.id);
      db.marcas = db.marcas.filter(z=>z.habito_id!==it.id);
      abrirBloco(bl); rRotina(); toast("item removido");
    };
    li.appendChild(x); ul.appendChild(li);
  });
  abrirSheet("sh-bloco");
}

function rCalendario(){
  const {a,m}=calRef, h=hoje(), ym=`${a}-${String(m).padStart(2,"0")}`;
  $("cal-mes").textContent = new Date(a,m-1,1).toLocaleDateString("pt-BR",{month:"long",year:"numeric"});
  const p1=new Date(a,m-1,1), ini=mais(isoDe(p1), -p1.getDay());
  const dias=[]; for(let i=0;i<42;i++) dias.push(mais(ini,i));
  const vals = dias.filter(d=>mesDe(d)===ym).map(sai).filter(v=>v>0).sort((x,y)=>x-y);
  const q = p => vals.length?vals[Math.min(vals.length-1, Math.floor(vals.length*p))]:0;
  const q1=q(.33),q2=q(.66),q3=q(.9);
  const cal=$("cal"); cal.innerHTML="";
  dias.forEach(d=>{
    const fora = mesDe(d)!==ym, v=sai(d);
    const op = v<=0?0:v<=q1?.10:v<=q2?.18:v<=q3?.28:.4;
    const marcas=[];
    if(v>0) marcas.push(cor("--sai"));
    if(contasDia(d).length) marcas.push(cor("--alerta"));
    if(evtsDia(d).length||tarefasDia(d).length) marcas.push(cor("--laranja"));
    const b=document.createElement("button");
    b.className = "dia press"+(fora?" fora":"")+(d===h?" hoje":"")+(v>0?" gastou":"")+(db.fechados.includes(d)?" fech":"");
    b.setAttribute("aria-label", ext(d));
    b.innerHTML = `<span class="f" style="opacity:${op}"></span><span class="n">${+d.slice(8,10)}</span>
      <span class="m">${marcas.map(c=>`<i style="background:${c}"></i>`).join("")}</span>`;
    b.onclick = ()=>{ selDia=d; vibra(); rDetalhe(); abrirSheet("sh-dia"); };
    cal.appendChild(b);
  });
}

function rEventos(){
  const h=hoje(), ul=$("l-eventos"); ul.innerHTML="";
  const prox = evts().filter(e=>e.data>=h).sort((x,y)=>(x.data+(x.hora||"99")).localeCompare(y.data+(y.hora||"99"))).slice(0,10);
  if(!prox.length){ ul.innerHTML='<li class="vazio">Nada marcado. Toque num dia do calendário para adicionar.</li>'; return; }
  prox.forEach(ev=>{
    const d=dif(h,ev.data);
    const li=document.createElement("li"); li.className="lin";
    li.innerHTML = `<span class="badge ${d<=1?"perto":""}">${d===0?"hoje":d===1?"amanhã":curto(ev.data)}</span>
      <span class="n">${esc(ev.titulo)}${ev.lembrete_min?`<small>aviso ${ev.lembrete_min} min antes</small>`:""}</span>
      <span class="v">${hm(ev.hora)}</span>`;
    const x=document.createElement("button"); x.className="x press"; x.textContent="✕";
    x.onclick=()=>apagar("eventos", ev.id, ()=>{ db.eventos = db.eventos.filter(z=>z.id!==ev.id); });
    li.appendChild(x); ul.appendChild(li);
  });
}

function rNumeros(h,y,d,iM,oM,sM){
  $("k-in").textContent = "R$ "+brl(iM);
  $("k-out").textContent = "R$ "+brl(oM);
  $("k-in-s").textContent = noMes(y,"entrada").length+" lançamentos";
  $("k-out-s").textContent = `projeção: R$ ${brl0(oM/d*ultDia(+y.slice(0,4),+y.slice(5,7)))}`;
  $("k-sal").textContent = "R$ "+brl(sM);
  $("k-sal").style.color = sM<0?cor("--sai"):sM>0?cor("--entra"):"";
  $("k-sal-s").textContent = iM>0?`margem ${(sM/iM*100).toFixed(0)}%`:"sem entradas";
  const an=acum(mesAnt(y),d), base=an.length?an[an.length-1]:0;
  if(base<=0){ $("k-rit").textContent="—"; $("k-rit").style.color=""; $("k-rit-s").textContent="sem base anterior"; }
  else{
    const p=Math.round((oM/base-1)*100);
    $("k-rit").textContent=(p>0?"+":"")+p+"%";
    $("k-rit").style.color = p>0?cor("--sai"):cor("--entra");
    $("k-rit-s").textContent = `dia ${d} do mês passado: R$ ${brl0(base)}`;
  }
  $("g-ritmo").innerHTML = gRitmo();
  $("g-donut").innerHTML = gDonut();
}

function rDetalhe(){
  const d=selDia, h=hoje();
  $("dia-tit").textContent = d===h?"Hoje":ext(d,{weekday:"long",day:"2-digit",month:"long"});
  const s = ent(d)-sai(d);
  $("dia-saldo").innerHTML = `<small>R$</small>${brl(s)}`;
  $("dia-saldo").style.color = s<0?cor("--sai"):s>0?cor("--entra"):"";

  const dl=$("dia-lanc"); dl.innerHTML="";
  const ls=noDia(d);
  if(!ls.length) dl.innerHTML='<li class="vazio" style="padding:10px 0">Nenhum lançamento.</li>';
  ls.forEach(l=>{
    const li=document.createElement("li"); li.className="lin";
    li.innerHTML=`<span class="dot" style="background:${l.tipo==="entrada"?cor("--entra"):cor("--sai")}"></span>
      <span class="n">${esc(l.categoria)}${l.nota?`<small>${esc(l.nota)}</small>`:""}</span>
      <span class="v ${l.tipo==="entrada"?"entra":"sai"}">${l.tipo==="entrada"?"+":"−"} ${brl(l.valor)}</span>`;
    const x=document.createElement("button"); x.className="x press"; x.textContent="✕";
    x.onclick=()=>apagar("lancamentos", l.id, ()=>{ db.lancamentos=db.lancamentos.filter(z=>z.id!==l.id); rDetalhe(); });
    li.appendChild(x); dl.appendChild(li);
  });

  const dc=$("dia-contas"); dc.innerHTML="";
  const cs=contasDia(d);
  if(!cs.length) dc.innerHTML='<li class="vazio" style="padding:10px 0">Nenhuma conta vence neste dia.</li>';
  cs.forEach(c=>{
    const li=document.createElement("li"); li.className="lin";
    li.innerHTML=`<span class="dot" style="background:${cor("--alerta")}"></span><span class="n">${esc(c.nome)}</span>
      <span class="v">${c.valor?"R$ "+brl(c.valor):""}</span>
      <span class="badge">${c.ultimo_pago===mesDe(d)?"pago":"aberto"}</span>`;
    dc.appendChild(li);
  });

  const de=$("dia-eventos"); de.innerHTML="";
  const es=evtsDia(d);
  if(!es.length) de.innerHTML='<li class="vazio" style="padding:10px 0">Nada marcado.</li>';
  es.forEach(ev=>{
    const li=document.createElement("li"); li.className="lin";
    li.innerHTML=`<span class="badge">${ev.hora?hm(ev.hora):"dia todo"}</span><span class="n">${esc(ev.titulo)}</span>`;
    const x=document.createElement("button"); x.className="x press"; x.textContent="✕";
    x.onclick=()=>apagar("eventos", ev.id, ()=>{ db.eventos=db.eventos.filter(z=>z.id!==ev.id); rDetalhe(); });
    li.appendChild(x); de.appendChild(li);
  });
}

/* ================= lembretes ================= */
function lembretes(){
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
        new Notification("NexVot", { body:`${e.titulo} às ${hm(e.hora)}` }); }catch(x){}
      vibra(30);
    }
  });
}

/* ================= navegação ================= */
function aplicarEspaco(re){
  const p = espaco==="pessoal";
  $("seg").querySelectorAll("button").forEach(b=>b.classList.toggle("on", b.dataset.e===espaco));
  $("kp-pessoal").hidden = !p;
  $("kp-empresa").hidden = p;
  try{ localStorage.setItem("nexvot:espaco", espaco); }catch(e){}
  if(re) render();
}
function irPara(v){
  view = v;
  VIEWS.forEach(n=> $("v-"+n).hidden = n!==v);
  document.querySelectorAll("#nav .ab").forEach(b=>b.classList.toggle("on", b.dataset.v===v));
  document.querySelectorAll("#side-nav button").forEach(b=>b.classList.toggle("on", b.dataset.v===v));
  window.scrollTo({top:0, behavior:"instant"});
}
function abrirSheet(id){
  $("veu").hidden=false; $(id).hidden=false;
  requestAnimationFrame(()=>{ $("veu").classList.add("on"); $(id).classList.add("on"); });
  document.body.style.overflow="hidden";
}
function fecharSheets(){
  document.querySelectorAll(".sheet").forEach(s=>s.classList.remove("on"));
  $("veu").classList.remove("on");
  document.body.style.overflow="";
  setTimeout(()=>{ document.querySelectorAll(".sheet").forEach(s=>s.hidden=true); $("veu").hidden=true; },300);
}

/* ================= lançamento ================= */
const valor = () => dig ? parseInt(dig,10)/100 : 0;
function pintaValor(){
  const v=valor(), el=$("mostra");
  el.innerHTML = `<small>R$</small>${brl(v)}`;
  el.className = "v"+(v<=0?" zero":tipoSel==="entrada"?" e":" s");
  $("bt-lancar").disabled = v<=0 || !catSel;
  $("bt-lancar").style.opacity = ($("bt-lancar").disabled)?".5":"1";
}
function tecla(k){ if(k==="del") dig=dig.slice(0,-1); else if(dig.length<9) dig+=k; vibra(6); pintaValor(); }
function abrirLanc(data){
  dig=""; catSel=null; tipoSel="saida"; natSel="essencial";
  membroSel = (db.membros.find(m=>m.eh_voce)||db.membros[0]||{}).id||null;
  dataAlvo = data||hoje();
  $("nota").value=""; $("lanc-msg").textContent="";
  $("lanc-tit").textContent = espaco==="pessoal" ? "Lançar — pessoal" : "Lançar — empresa";
  pintaTipo(); pintaData(); pintaCat(); pintaNat(); pintaMembro(); pintaValor();
  abrirSheet("sh-lanc");
}
function pintaTipo(){
  $("dp-tipo").querySelectorAll("button").forEach(b=>{
    const on = b.dataset.t===tipoSel;
    b.className = on ? ("on "+(tipoSel==="entrada"?"e":"s")) : "";
  });
}
function pintaData(){
  const h=hoje();
  const op=[{d:h,r:"Hoje"},{d:mais(h,-1),r:"Ontem"},{d:mais(h,-2),r:curto(mais(h,-2))}];
  if(!op.some(o=>o.d===dataAlvo)) op.push({d:dataAlvo,r:curto(dataAlvo)});
  $("rl-data").innerHTML = op.map(o=>`<button class="pill ${o.d===dataAlvo?"on":""}" data-d="${o.d}">${o.r}</button>`).join("");
  $("rl-data").querySelectorAll("button").forEach(b=>b.onclick=()=>{ dataAlvo=b.dataset.d; vibra(); pintaData(); });
}
function pintaCat(){
  const lista = CATS[espaco][tipoSel];
  if(catSel && !lista.includes(catSel)) catSel=null;
  $("rl-cat").innerHTML = lista.map(c=>`<button class="pill ${c===catSel?"on":""}" data-c="${esc(c)}">${esc(c)}</button>`).join("");
  $("rl-cat").querySelectorAll("button").forEach(b=>b.onclick=()=>{
    catSel=b.dataset.c;
    if(espaco==="pessoal"&&tipoSel==="saida") natSel = NAT_PADRAO[catSel]||"essencial";
    vibra(); pintaCat(); pintaNat(); pintaValor();
  });
}
function pintaNat(){
  const m = espaco==="pessoal" && tipoSel==="saida";
  $("dp-nat").hidden = !m;
  if(!m) return;
  $("dp-nat").querySelectorAll("button").forEach(b=>b.className = b.dataset.n===natSel?"on":"");
}
function pintaMembro(){
  const m = espaco==="empresa" && tipoSel==="saida" && db.membros.length>0;
  $("rl-membro").hidden = !m;
  if(!m) return;
  $("rl-membro").innerHTML = db.membros.map(x=>`<button class="pill ${x.id===membroSel?"on":""}" data-m="${x.id}">${esc(x.nome)}</button>`).join("");
  $("rl-membro").querySelectorAll("button").forEach(b=>b.onclick=()=>{ membroSel=b.dataset.m; vibra(); pintaMembro(); });
}

/* ================= mutações ================= */
async function apagar(t,id,loc){
  const { error } = await sb.from(t).delete().eq("id", id);
  if(error) return falhou(error);
  loc(); render(); toast("removido");
}
async function lancar(){
  const v=valor();
  if(v<=0){ $("lanc-msg").textContent="Digite um valor."; return; }
  if(!catSel){ $("lanc-msg").textContent="Escolha uma categoria."; return; }
  $("lanc-msg").textContent="";
  const { data, error } = await sb.from("lancamentos").insert({
    user_id:user.id, espaco, tipo:tipoSel, data:dataAlvo, valor:v, categoria:catSel,
    nota:$("nota").value.trim(),
    natureza:(espaco==="pessoal"&&tipoSel==="saida")?natSel:null,
    membro_id:(espaco==="empresa"&&tipoSel==="saida")?membroSel:null
  }).select().single();
  if(error) return falhou(error);
  db.lancamentos.unshift({...data, valor:Number(data.valor)});
  db.lancamentos.sort((a,b)=>b.data.localeCompare(a.data));
  vibra(14); fecharSheets(); render();
  toast(`${tipoSel==="entrada"?"+":"−"} R$ ${brl(v)} · ${dataAlvo===hoje()?"hoje":curto(dataAlvo)}`);
}
async function pagar(c){
  const mes = mesDe(venc(c));
  const { error } = await sb.from("contas").update({ ultimo_pago:mes }).eq("id", c.id);
  if(error) return falhou(error);
  c.ultimo_pago = mes;
  if(c.valor>0){
    const { data, error:e2 } = await sb.from("lancamentos").insert({
      user_id:user.id, espaco:c.espaco, tipo:"saida", data:hoje(), valor:c.valor,
      categoria:"Contas", nota:c.nome, natureza:c.espaco==="pessoal"?"essencial":null
    }).select().single();
    if(e2) return falhou(e2);
    db.lancamentos.unshift({...data, valor:Number(data.valor)});
  }
  vibra(14); render(); toast(`${c.nome} quitada`);
}
async function marcar(it,on,d){
  vibra(on?6:12);
  if(on){
    const m = db.marcas.find(x=>x.habito_id===it.id && x.data===d);
    if(!m) return;
    const { error } = await sb.from("habito_marcas").delete().eq("id", m.id);
    if(error) return falhou(error);
    db.marcas = db.marcas.filter(x=>x.id!==m.id);
  }else{
    const { data, error } = await sb.from("habito_marcas").insert({ user_id:user.id, habito_id:it.id, data:d }).select().single();
    if(error) return falhou(error);
    db.marcas.push(data);
  }
  rRotina();
}
async function toggleTarefa(t){
  vibra(t.feita?6:12);
  const { error } = await sb.from("tarefas").update({ feita: !t.feita }).eq("id", t.id);
  if(error) return falhou(error);
  t.feita = !t.feita; rRotina();
}
async function fecharDia(){
  const h=hoje();
  const { error } = await sb.from("dias_fechados").insert({ user_id:user.id, data:h });
  if(error) return falhou(error);
  db.fechados.push(h); vibra(18); render(); toast(`Dia fechado · ${streak(db.fechados)} seguidos`);
}
async function instalarRotina(){
  toast("instalando…");
  for(let i=0;i<ROTINA.length;i++){
    const b = ROTINA[i];
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
  rRotina(); toast("Rotina instalada");
}

/* ================= eventos ================= */
function ligar(){
  $("seg").querySelectorAll("button").forEach(b=>b.onclick=()=>{
    if(espaco===b.dataset.e) return; espaco=b.dataset.e; vibra(10); aplicarEspaco(true);
  });
  document.querySelectorAll("#nav .ab").forEach(b=>b.onclick=()=>irPara(b.dataset.v));
  document.querySelectorAll("#side-nav button").forEach(b=>b.onclick=()=>irPara(b.dataset.v));
  $("fab").onclick=()=>{ vibra(10); abrirLanc(hoje()); };
  $("bt-dia").onclick=fecharDia;
  $("bt-tema").onclick=()=>aplicarTema(temaAtual()==="escuro"?"claro":"escuro");
  $("side-tema").onclick=()=>aplicarTema(temaAtual()==="escuro"?"claro":"escuro");
  const sair = async ()=>{ await sb.auth.signOut(); location.reload(); };
  $("side-sair").onclick=sair; $("bt-sair").onclick=sair;

  $("rt-ant").onclick=()=>{ rtDia=mais(rtDia,-1); blocoAberto=null; vibra(); rRotina(); };
  $("rt-prox").onclick=()=>{ rtDia=mais(rtDia,1); blocoAberto=null; vibra(); rRotina(); };
  $("rt-hoje").onclick=()=>{ rtDia=hoje(); blocoAberto=null; vibra(); rRotina(); };
  $("rt-seed").onclick=instalarRotina;

  $("t-add").onclick=async ()=>{
    const t=$("t-tit").value.trim(); if(!t) return;
    const { data, error } = await sb.from("tarefas").insert({ user_id:user.id, data:rtDia, hora:$("t-hora").value||null, titulo:t }).select().single();
    if(error) return falhou(error);
    db.tarefas.push(data); $("t-tit").value=""; $("t-hora").value="";
    rRotina(); rCalendario(); toast("adicionado a este dia");
  };
  $("b-add").onclick=async ()=>{
    const h=$("b-hora").value, t=$("b-tit").value.trim();
    if(!h||!t) return toast("preencha hora e título", true);
    const { data, error } = await sb.from("blocos_rotina").insert({ user_id:user.id, hora:h, titulo:t, ordem:db.blocos.length }).select().single();
    if(error) return falhou(error);
    db.blocos.push(data); $("b-hora").value=""; $("b-tit").value="";
    blocoAberto=data.id; rRotina(); toast("bloco criado");
  };
  $("bl-fech").onclick=fecharSheets;
  $("bl-add").onclick=async ()=>{
    if(!blocoEdit) return;
    const n=$("bl-novo").value.trim(); if(!n) return;
    const dv=$("bl-dia").value;
    const { data, error } = await sb.from("habitos").insert({
      user_id:user.id, bloco_id:blocoEdit.id, nome:n,
      dia_semana: dv===""?null:parseInt(dv,10),
      ordem: db.habitos.filter(x=>x.bloco_id===blocoEdit.id).length
    }).select().single();
    if(error) return falhou(error);
    db.habitos.push(data); $("bl-novo").value="";
    abrirBloco(blocoEdit); rRotina(); toast("item adicionado");
  };
  $("bl-salvar").onclick=async ()=>{
    if(!blocoEdit) return;
    const h=$("bl-hora").value, t=$("bl-nome").value.trim();
    if(!h||!t) return toast("preencha hora e título", true);
    const { error } = await sb.from("blocos_rotina").update({ hora:h, titulo:t }).eq("id", blocoEdit.id);
    if(error) return falhou(error);
    blocoEdit.hora=h; blocoEdit.titulo=t;
    fecharSheets(); rRotina(); toast("bloco salvo");
  };
  $("bl-apagar").onclick=async ()=>{
    if(!blocoEdit || !confirm("Apagar o bloco e todos os itens dele?")) return;
    const { error } = await sb.from("blocos_rotina").delete().eq("id", blocoEdit.id);
    if(error) return falhou(error);
    db.blocos=db.blocos.filter(z=>z.id!==blocoEdit.id);
    db.habitos=db.habitos.filter(z=>z.bloco_id!==blocoEdit.id);
    blocoEdit=null; blocoAberto=null; fecharSheets(); rRotina(); toast("bloco apagado");
  };

  $("cal-ant").onclick=()=>{ calRef.m--; if(calRef.m<1){calRef.m=12;calRef.a--;} vibra(); rCalendario(); };
  $("cal-prox").onclick=()=>{ calRef.m++; if(calRef.m>12){calRef.m=1;calRef.a++;} vibra(); rCalendario(); };
  $("veu").onclick=fecharSheets;
  $("lanc-fech").onclick=fecharSheets;
  $("dia-fech").onclick=fecharSheets;
  document.addEventListener("keydown", e=>{ if(e.key==="Escape") fecharSheets(); });
  document.querySelectorAll(".tec button").forEach(b=>b.onclick=()=>tecla(b.dataset.k));
  $("bt-lancar").onclick=lancar;
  $("dia-lanc-bt").onclick=()=>{ const d=selDia; fecharSheets(); setTimeout(()=>abrirLanc(d),260); };
  $("dia-rot").onclick=()=>{ rtDia=selDia; blocoAberto=null; fecharSheets(); setTimeout(()=>{ irPara("rotina"); rRotina(); },260); };

  $("dp-tipo").querySelectorAll("button").forEach(b=>b.onclick=()=>{
    tipoSel=b.dataset.t; vibra(); pintaTipo(); pintaCat(); pintaNat(); pintaMembro(); pintaValor();
  });
  $("dp-nat").querySelectorAll("button").forEach(b=>b.onclick=()=>{ natSel=b.dataset.n; vibra(); pintaNat(); });

  $("bt-notif").onclick=async ()=>{
    if(!("Notification" in window)) return toast("este navegador não tem notificações", true);
    const p = await Notification.requestPermission();
    toast(p==="granted"?"avisos ligados":"avisos negados", p!=="granted");
  };
  $("c-add").onclick=async ()=>{
    const n=$("c-nome").value.trim(), d=parseInt($("c-dia").value,10);
    if(!n||!d) return toast("preencha nome e dia", true);
    const { data, error } = await sb.from("contas").insert({
      user_id:user.id, espaco, nome:n, dia:Math.min(Math.max(d,1),31), valor:numBR($("c-valor").value)
    }).select().single();
    if(error) return falhou(error);
    db.contas.push({...data, valor:Number(data.valor||0)});
    ["c-nome","c-dia","c-valor"].forEach(k=>$(k).value="");
    render(); toast("conta cadastrada");
  };
  $("m-add").onclick=async ()=>{
    const n=$("m-nome").value.trim(); if(!n) return;
    const { data, error } = await sb.from("membros").insert({ user_id:user.id, nome:n, eh_voce:false }).select().single();
    if(error) return falhou(error);
    db.membros.push(data); $("m-nome").value=""; render(); toast("sócio adicionado");
  };
  $("e-add").onclick=async ()=>{
    const t=$("e-tit").value.trim(); if(!t) return;
    const lm=$("e-lem").value;
    const { data, error } = await sb.from("eventos").insert({
      user_id:user.id, espaco, data:selDia, hora:$("e-hora").value||null, titulo:t,
      lembrete_min: lm?parseInt(lm,10):null
    }).select().single();
    if(error) return falhou(error);
    db.eventos.push(data);
    $("e-tit").value=""; $("e-hora").value=""; $("e-lem").value="";
    render(); rDetalhe(); toast("compromisso marcado");
  };
  $("bt-export").onclick=()=>{
    const a=document.createElement("a");
    a.href=URL.createObjectURL(new Blob([JSON.stringify(db,null,2)],{type:"application/json"}));
    a.download=`nexvot-backup-${hoje()}.json`; a.click();
  };

  let x0=null,y0=null;
  document.addEventListener("touchstart", e=>{
    if(document.querySelector(".sheet.on")) return;
    x0=e.touches[0].clientX; y0=e.touches[0].clientY;
  }, {passive:true});
  document.addEventListener("touchend", e=>{
    if(x0===null) return;
    const dx=e.changedTouches[0].clientX-x0, dy=e.changedTouches[0].clientY-y0;
    x0=null;
    if(Math.abs(dx)<64 || Math.abs(dy)>Math.abs(dx)*.7) return;
    const i=VIEWS.indexOf(view)+(dx<0?1:-1);
    if(i>=0 && i<VIEWS.length){ irPara(VIEWS[i]); vibra(6); }
  }, {passive:true});
}

window.addEventListener("unhandledrejection", e=>{
  if(!$("splash").hidden) fatal("Erro: "+((e.reason&&e.reason.message)||e.reason));
});

boot().catch(e => fatal("Falha ao iniciar: "+e.message));
