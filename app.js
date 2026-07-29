// ============================================================
//  NEXVOT — Gestão Inteligente — app.js (v7)
//  Requer schema.sql + schema2.sql + schema3.sql rodados e
//  Anonymous Sign-Ins ligado no Supabase.
// ============================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

window.__APP_CARREGOU__ = true;
let sb = null;

function erroFatal(msg){
  const el = document.getElementById("splash-txt");
  if(el){ el.className = "erro"; el.textContent = msg; }
  console.error("[NexVot]", msg);
}

/* ================= constantes ================= */
const LARANJA = "#FF5E04";
const VERDE   = "#22A268";
const RAMPA = [LARANJA,"#B34204","#8A8A8A","#6E6E6E","#585858","#474747","#3A3A3A","#2E2E2E"];

const CATS = {
  pessoal: {
    saida:   ["Mercado","Comer fora","Transporte","Casa","Contas","Saúde","Lazer","Outros"],
    entrada: ["Salário","Freela","Rendimento","Outros"]
  },
  empresa: {
    saida:   ["Estoque","Marketing","Frete","Ferramentas","Impostos","Pró-labore","Outros"],
    entrada: ["Vendas","Serviços","Outros"]
  }
};
const NATUREZA_PADRAO = {
  "Mercado":"essencial","Transporte":"essencial","Casa":"essencial",
  "Contas":"essencial","Saúde":"essencial",
  "Comer fora":"futil","Lazer":"futil","Outros":"essencial"
};

// Rotina do Edson, na ordem e com as notas que ele mandou.
// dia: 0=dom 1=seg ... 6=sáb — null vale todo dia.
const ROTINA = [
  { hora:"07:30", titulo:"Acordar", itens:[
    "Arrumar a cama","Água","Higiene","Sem celular por 20 minutos"] },
  { hora:"08:00", titulo:"Café da manhã", nota:"Sem responder mensagens ainda", itens:[
    "Olhar a agenda do dia","Conferir o calendário","Revisar as tarefas"] },
  { hora:"08:30", titulo:"Organização", nota:"Antes do trabalho começar", itens:[
    "Abrir Notion / Trello","Abrir WhatsApp","Abrir a agenda",
    "O Lucas grava hoje?","Existe algum prazo?","Alguma entrega atrasada?","Algum conteúdo para aprovar?"] },
  { hora:"09:00", titulo:"Deep Work — 1º bloco", nota:"Sem interrupções", itens:[
    "Planejamento de conteúdo","Organização dos stories","Ideias de reels","Roteiros",
    "Branding","Análise dos concorrentes","Organização da semana"] },
  { hora:"11:00", titulo:"Operacional", itens:[
    "Responder a equipe","Resolver pendências","Enviar materiais","Organizar demandas"] },
  { hora:"12:00", titulo:"Almoço", nota:"Nada de computador", itens:[
    "Almoçar longe da tela"] },
  { hora:"13:00", titulo:"Planejamento do Lucas", nota:"Quando ele começar a gravar, tudo já está pronto", itens:[
    "Stories do dia","Reels","Roteiro","Horários","Ideias","Referências"] },
  { hora:"14:00", titulo:"Gravações", itens:[
    "Acompanhar","Anotar cortes","Anotar ideias que surgirem","Pensar em conteúdos futuros"] },
  { hora:"16:00", titulo:"Deep Work — 2º bloco", nota:"Sem interrupção", itens:[
    "Branding da Oris","Documentos","Planejamento semanal","Campanhas",
    "Calendário editorial","Melhorias de processos"] },
  { hora:"17:30", titulo:"Revisão", itens:[
    "O que ficou pendente?","O que precisa ser feito amanhã?","O que pode ser delegado?"] },
  { hora:"18:00", titulo:"Encerrar o operacional", itens:[
    "Encerrar o operacional"] },
  { hora:"19:00", titulo:"Estudo — 40 minutos", nota:"Aprender mais que a média é o diferencial", itens:[
    { nome:"Branding", dia:1 }, { nome:"Marketing", dia:2 }, { nome:"Copywriting", dia:3 },
    { nome:"Storytelling", dia:4 }, { nome:"Gestão", dia:5 },
    { nome:"IA e automação", dia:6 }, { nome:"Tendências", dia:0 }] },
  { hora:"20:00", titulo:"Tempo livre", itens:[
    "Assistir algo","Conversar","Descansar"] },
  { hora:"21:30", titulo:"Preparar o dia seguinte", itens:[
    "Separar as roupas","Conferir a agenda","Separar as tarefas","Escrever as 3 prioridades"] },
  { hora:"22:30", titulo:"Desligar telas", itens:["Desligar as telas"] },
  { hora:"00:00", titulo:"Dormir", itens:["Dormir"] }
];

const VIEWS = ["painel","rotina","agenda","numeros"];
const DIAS_SEM = ["domingo","segunda","terça","quarta","quinta","sexta","sábado"];

/* ================= estado ================= */
let usuario = null;
let espaco = "pessoal";
let viewAtual = "painel";
let calRef = null, selDia = null, dataAlvo = null, rtDia = null, blocoAberto = null, blocoEdit = null;
let tipoSel = "saida", catSel = null, natSel = "essencial", membroSel = null, digitos = "";
const avisados = new Set();
const db = { lancamentos:[], contas:[], habitos:[], marcas:[], fechados:[], eventos:[], membros:[], blocos:[], tarefas:[] };

/* ================= utilidades ================= */
const $ = id => document.getElementById(id);
const isoDe = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
const hojeISO = () => isoDe(new Date());
const mesDe = s => s.slice(0,7);
const ultimoDia = (a,m) => new Date(a,m,0).getDate();
const dataDoMes = (a,m,d) => `${a}-${String(m).padStart(2,"0")}-${String(Math.min(Math.max(d,1),ultimoDia(a,m))).padStart(2,"0")}`;
const diasEntre = (a,b) => Math.round((new Date(b+"T00:00:00") - new Date(a+"T00:00:00"))/86400000);
const somaDias = (s,n) => { const d = new Date(s+"T00:00:00"); d.setDate(d.getDate()+n); return isoDe(d); };
const diaSemana = s => new Date(s+"T00:00:00").getDay();
const brl  = n => Number(n).toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2});
const brl0 = n => { const a=Math.abs(n); const s = a>=1000 ? (a/1000).toFixed(a>=10000?0:1).replace(".",",")+"k" : String(Math.round(a)); return (n<0?"-":"")+s; };
const esc  = s => String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const numBR = s => { const n = parseFloat(String(s).replace(/\./g,"").replace(",",".")); return isFinite(n)?n:0; };
const extenso = (s,op) => new Date(s+"T00:00:00").toLocaleDateString("pt-BR", op||{weekday:"long",day:"2-digit",month:"long"});
const curto = s => s.slice(8,10)+"/"+s.slice(5,7);
const hhmm = h => h ? h.slice(0,5) : "";
const tocar = ms => { try{ navigator.vibrate && navigator.vibrate(ms||8); }catch(e){} };
const semMovimento = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

let tToast = null;
function toast(txt, erro){
  let el = $("toast");
  if(!el){ el = document.createElement("div"); el.id = "toast"; el.className = "toast"; document.body.appendChild(el); }
  el.textContent = txt;
  el.style.borderColor = erro ? "var(--red)" : "var(--laranja)";
  el.style.color = erro ? "var(--red)" : "var(--texto)";
  clearTimeout(tToast);
  tToast = setTimeout(()=>{ el.remove(); }, erro ? 4500 : 1700);
}
const falhou = e => { console.error(e); toast((e && e.message) || "falha ao salvar", true); };

function anima(el, alvo, prefixo){
  const fim = Number(alvo) || 0;
  if(semMovimento()){ el.innerHTML = `<small>${prefixo}</small>${brl(fim)}`; return; }
  const ini = performance.now(), dur = 520;
  const passo = t => {
    const p = Math.min((t-ini)/dur, 1), e = 1 - Math.pow(1-p, 3);
    el.innerHTML = `<small>${prefixo}</small>${brl(fim*e)}`;
    if(p < 1) requestAnimationFrame(passo);
  };
  requestAnimationFrame(passo);
}

/* ================= abertura ================= */
async function boot(){
  if(!window.CONFIG) return erroFatal("O config.js não carregou.");
  const url = String(window.CONFIG.SUPABASE_URL || "").trim();
  const chave = String(window.CONFIG.SUPABASE_ANON_KEY || "").trim();
  if(!url || url.includes("SEU-PROJETO")) return erroFatal("A SUPABASE_URL ainda é o valor de exemplo.");
  if(!/^https:\/\/[a-z0-9-]+\.supabase\.(co|in)\/?$/i.test(url))
    return erroFatal("A SUPABASE_URL está malformada: \"" + url + "\".");
  if(!chave || chave.includes("COLE-AQUI")) return erroFatal("A chave ainda é o valor de exemplo.");
  if(chave.startsWith("sb_secret_")) return erroFatal("Essa é a chave SECRET. Use a publishable.");

  try{ sb = createClient(url, chave); }
  catch(e){ return erroFatal("Não consegui criar o cliente do Supabase: " + e.message); }

  let data;
  try{
    const r = await Promise.race([
      sb.auth.getSession(),
      new Promise((_,rej)=>setTimeout(()=>rej(new Error("tempo esgotado")), 12000))
    ]);
    data = r.data;
  }catch(e){ return erroFatal("Não consegui falar com o Supabase (" + e.message + ")."); }

  if(!data.session){
    $("splash-txt").textContent = "criando sua sessão";
    const r = await sb.auth.signInAnonymously();
    if(r.error) return erroFatal("Sessão anônima desligada. Project Settings → Authentication → User Signups → Anonymous Sign-Ins. Detalhe: " + r.error.message);
    data = { session:r.data.session };
  }
  usuario = data.session.user;

  try{ espaco = localStorage.getItem("nexvot:espaco") || "pessoal"; }catch(e){}
  selDia = hojeISO(); rtDia = hojeISO();
  calRef = { a:+selDia.slice(0,4), m:+selDia.slice(5,7) };
  dataAlvo = selDia;

  $("splash").hidden = true;
  $("app").hidden = false;
  $("nav").hidden = false;
  aplicarEspaco(false);
  ligarEventos();
  await carregarTudo();
  setInterval(checarLembretes, 30000);
}

async function carregarTudo(){
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
  db.contas      = (c.data||[]).map(x=>({...x, valor:Number(x.valor||0)}));
  db.habitos     = h.data||[];
  db.marcas      = m.data||[];
  db.fechados    = (f.data||[]).map(x=>x.data);
  db.eventos     = e.data||[];
  db.membros     = mb.data||[];
  db.blocos      = bl.data||[];
  db.tarefas     = tf.data||[];

  if(!db.membros.length){
    const { data:novo } = await sb.from("membros")
      .insert({ user_id:usuario.id, nome:"Você", eh_voce:true }).select().single();
    if(novo) db.membros = [novo];
  }
  render();
}

/* ================= seleções ================= */
const lancs   = () => db.lancamentos.filter(x=>x.espaco===espaco);
const contas  = () => db.contas.filter(x=>x.espaco===espaco);
const eventos = () => db.eventos.filter(x=>x.espaco===espaco);
const soma = arr => arr.reduce((s,x)=>s+x.valor,0);
const noDia = (d,t) => lancs().filter(x=>x.data===d && (!t||x.tipo===t));
const noMes = (ym,t) => lancs().filter(x=>mesDe(x.data)===ym && (!t||x.tipo===t));
const saidaDia = d => soma(noDia(d,"saida"));
const entraDia = d => soma(noDia(d,"entrada"));

function acumulado(ym, ate){
  const a=+ym.slice(0,4), m=+ym.slice(5,7);
  const lim = ate || ultimoDia(a,m), out=[]; let s=0;
  for(let d=1; d<=lim; d++){ s += saidaDia(dataDoMes(a,m,d)); out.push(s); }
  return out;
}
function mesAnterior(ym){
  const a=+ym.slice(0,4), m=+ym.slice(5,7);
  return m===1 ? `${a-1}-12` : `${a}-${String(m-1).padStart(2,"0")}`;
}
function vencimento(c){
  const h = hojeISO(), a=+h.slice(0,4), m=+h.slice(5,7);
  if(c.ultimo_pago === mesDe(h)){
    const mm = m===12?1:m+1, aa = m===12?a+1:a;
    return dataDoMes(aa,mm,c.dia);
  }
  return dataDoMes(a,m,c.dia);
}
const contasOrd = () => [...contas()].sort((x,y)=>vencimento(x).localeCompare(vencimento(y)));
const contasNoDia = d => { const a=+d.slice(0,4), m=+d.slice(5,7); return contas().filter(c=>dataDoMes(a,m,c.dia)===d); };
const eventosNoDia = d => eventos().filter(e=>e.data===d).sort((x,y)=>(x.hora||"99").localeCompare(y.hora||"99"));
const temMarca = (id,d) => db.marcas.some(x=>x.habito_id===id && x.data===d);
function streakDe(lista){
  const set = new Set(lista); let b = hojeISO();
  if(!set.has(b)) b = somaDias(b,-1);
  let n=0; while(set.has(b)){ n++; b = somaDias(b,-1); }
  return n;
}
function rankCategorias(ym){
  const s = {};
  noMes(ym,"saida").forEach(x=>{ s[x.categoria]=(s[x.categoria]||0)+x.valor; });
  return Object.entries(s).sort((a,b)=>b[1]-a[1]);
}
const nomeMembro = id => (db.membros.find(m=>m.id===id)||{}).nome || "—";
// itens de um bloco válidos para a data
const itensDoBloco = (blocoId, data) => db.habitos
  .filter(x=>x.bloco_id===blocoId && (x.dia_semana===null || x.dia_semana===undefined || x.dia_semana===diaSemana(data)))
  .sort((a,b)=>(a.ordem||0)-(b.ordem||0));
const tarefasDoDia = d => db.tarefas.filter(t=>t.data===d).sort((a,b)=>(a.hora||"99").localeCompare(b.hora||"99"));

/* ================= gráficos ================= */
function svgFluxo(){
  const h = hojeISO();
  const dias = []; for(let i=13;i>=0;i--) dias.push(somaDias(h,-i));
  const ins = dias.map(entraDia), outs = dias.map(saidaDia);
  const max = Math.max(...ins, ...outs, 1);
  if(!ins.some(v=>v>0) && !outs.some(v=>v>0))
    return '<div class="vazio">Sem movimento nos últimos 14 dias. Lance um gasto no + para o gráfico ganhar forma.</div>';
  const W=100, H=46, larg=W/dias.length;
  const barras = dias.map((d,i)=>{
    const x = i*larg;
    const hi = (ins[i]/max)*(H/2-2), ho = (outs[i]/max)*(H/2-2);
    return (ins[i]>0 ? `<rect x="${(x+larg*.10).toFixed(2)}" y="${(H/2-hi).toFixed(2)}" width="${(larg*.34).toFixed(2)}" height="${hi.toFixed(2)}" fill="${VERDE}"/>` : "")
         + (outs[i]>0 ? `<rect x="${(x+larg*.52).toFixed(2)}" y="${(H/2).toFixed(2)}" width="${(larg*.34).toFixed(2)}" height="${ho.toFixed(2)}" fill="${LARANJA}"/>` : "");
  }).join("");
  return `<svg viewBox="0 0 ${W} ${H+9}" width="100%" height="170" preserveAspectRatio="none" role="img" aria-label="Entradas e saídas dos últimos 14 dias">
    <line x1="0" y1="${H/2}" x2="${W}" y2="${H/2}" stroke="#3D3D3D" stroke-width=".35"/>
    ${barras}
    <text class="eixo" x="0" y="${H+7}">${curto(dias[0])}</text>
    <text class="eixo" x="${W}" y="${H+7}" text-anchor="end">HOJE</text>
    <text class="eixo" x="0" y="4">R$ ${brl0(max)}</text></svg>`;
}

function svgRitmo(){
  const h = hojeISO(), ym = mesDe(h), dia = +h.slice(8,10);
  const atual = acumulado(ym, dia), ant = acumulado(mesAnterior(ym));
  const W=100,H=44,pad=2;
  const nMax = Math.max(atual.length, ant.length, 2);
  const vMax = Math.max(...atual, ...ant, 1);
  const px = i => pad + (i/(nMax-1))*(W-pad*2);
  const py = v => H - pad - (v/vMax)*(H-pad*2);
  const linha = arr => arr.map((v,i)=>`${px(i).toFixed(2)},${py(v).toFixed(2)}`).join(" ");
  const temAnt = ant.some(v=>v>0);
  if(!atual.some(v=>v>0) && !temAnt){ $("leg-ritmo").innerHTML=""; return '<div class="vazio">Sem saídas para desenhar ainda.</div>'; }
  $("leg-ritmo").innerHTML = '<span style="color:var(--laranja)">■ este mês</span> &nbsp; <span style="color:#8A8A8A">■ anterior</span>';
  return `<svg viewBox="0 0 ${W} ${H+9}" width="100%" height="165" preserveAspectRatio="none" role="img" aria-label="Saídas acumuladas do mês">
    ${[0.5,1].map(f=>`<line x1="${pad}" y1="${py(vMax*f).toFixed(2)}" x2="${W-pad}" y2="${py(vMax*f).toFixed(2)}" stroke="#2B2B2B" stroke-width=".35"/>`).join("")}
    ${temAnt?`<polyline points="${linha(ant)}" fill="none" stroke="#8A8A8A" stroke-width=".8" stroke-dasharray="1.6 1.4" vector-effect="non-scaling-stroke"/>`:""}
    <polygon points="${pad},${H-pad} ${linha(atual)} ${px(atual.length-1).toFixed(2)},${H-pad}" fill="${LARANJA}" fill-opacity=".15"/>
    <polyline points="${linha(atual)}" fill="none" stroke="${LARANJA}" stroke-width="1.6" vector-effect="non-scaling-stroke"/>
    <text class="eixo" x="${pad}" y="${H+7}">DIA 1</text>
    <text class="eixo" x="${W-pad}" y="${H+7}" text-anchor="end">DIA ${nMax}</text>
    <text class="eixo" x="${pad}" y="${(py(vMax)-1.5).toFixed(2)}">R$ ${brl0(vMax)}</text></svg>`;
}

function svgDonut(){
  const pares = rankCategorias(mesDe(hojeISO()));
  if(!pares.length){ $("leg-donut").innerHTML=""; return '<div class="vazio">Nenhuma saída categorizada este mês.</div>'; }
  const total = pares.reduce((s,[,v])=>s+v,0), R=42, C=2*Math.PI*R;
  let off = 0;
  const arcos = pares.map(([c,v],i)=>{
    const len = (v/total)*C;
    const el = `<circle cx="60" cy="60" r="${R}" fill="none" stroke="${RAMPA[Math.min(i,RAMPA.length-1)]}" stroke-width="17"
      stroke-dasharray="${Math.max(len-1.5,.5).toFixed(2)} ${(C-len+1.5).toFixed(2)}" stroke-dashoffset="${(-off).toFixed(2)}" transform="rotate(-90 60 60)"/>`;
    off += len; return el;
  }).join("");
  $("leg-donut").innerHTML = pares.slice(0,7).map(([c,v],i)=>
    `<div><span class="b" style="background:${RAMPA[Math.min(i,RAMPA.length-1)]}"></span><span class="n">${esc(c)}</span><span class="v">${Math.round(v/total*100)}%</span></div>`).join("");
  return `<svg viewBox="0 0 120 120" width="100%" height="155" role="img" aria-label="Saídas por categoria">${arcos}
    <text x="60" y="55" text-anchor="middle" fill="#9E9E9E" style="font-family:var(--mono);font-size:7.5px;font-weight:800;letter-spacing:.2em">SAÍDAS</text>
    <text x="60" y="73" text-anchor="middle" fill="#FAFAFA" style="font-family:var(--disp);font-weight:900;font-size:18px">R$ ${brl0(total)}</text></svg>`;
}

/* ================= render ================= */
function render(){
  const h = hojeISO(), ym = mesDe(h), dia = +h.slice(8,10);
  $("topo-data").textContent = extenso(h,{weekday:"short",day:"2-digit",month:"short"}).replace(/\./g,"");
  const fechado = db.fechados.includes(h);
  const bd = $("btn-dia");
  bd.className = "chip press " + (fechado ? "on" : "acao");
  bd.disabled = fechado;
  bd.textContent = fechado ? `${streakDe(db.fechados)}d seguidos` : "Fechar o dia";

  const inMes = soma(noMes(ym,"entrada")), outMes = soma(noMes(ym,"saida"));
  const saldoMes = inMes - outMes;

  if(espaco === "pessoal") renderPessoal(h, ym, dia, outMes);
  else renderEmpresa(ym, inMes, outMes, saldoMes);

  $("g-fluxo-topo").innerHTML = svgFluxo();
  renderAlertas(); renderContas(); renderLancamentos();
  renderRotinaDia(); renderCalendario(); renderProximosEventos();
  renderNumeros(h, ym, dia, inMes, outMes, saldoMes);
}

function renderPessoal(h, ym, dia, outMes){
  const ent = entraDia(h), sai = saidaDia(h);
  anima($("p-hero"), ent - sai, "R$");
  $("p-hero").style.color = (ent-sai) < 0 ? "var(--texto)" : "var(--green)";
  $("p-entrou").textContent = `entrou R$ ${brl0(ent)}`;
  $("p-saiu").textContent   = `saiu R$ ${brl0(sai)}`;

  const antAcum = acumulado(mesAnterior(ym), dia);
  const base = antAcum.length ? antAcum[antAcum.length-1] : 0;
  const hr = $("p-ritmo");
  if(base<=0){ hr.textContent = "sem base anterior"; hr.style.color=""; hr.style.borderColor=""; }
  else{
    const p = Math.round((outMes/base-1)*100);
    hr.textContent = `${p>0?"+":""}${p}% vs. mês passado`;
    hr.style.color = p>0 ? "var(--laranja)" : "var(--fraco)";
    hr.style.borderColor = p>0 ? "var(--laranja)" : "var(--linha-f)";
  }

  const saidas = noMes(ym,"saida");
  const ess = soma(saidas.filter(x=>x.natureza!=="futil"));
  const fut = soma(saidas.filter(x=>x.natureza==="futil"));
  const tot = ess + fut, pf = tot>0 ? Math.round(fut/tot*100) : 0;
  $("sp-ess").style.width = tot>0 ? (100-pf)+"%" : "100%";
  $("sp-fut").style.width = tot>0 ? pf+"%" : "0%";
  $("lg-ess").textContent = `essencial R$ ${brl0(ess)}`;
  $("lg-fut").textContent = `fútil R$ ${brl0(fut)}`;
  const fp = $("futil-pct");
  fp.textContent = tot>0 ? pf + "% fútil" : "sem dados";
  fp.style.color = pf >= 30 ? "var(--laranja)" : "var(--fraco)";
}

function renderEmpresa(ym, inMes, outMes, lucro){
  $("e-hero").className = "hero " + (lucro >= 0 ? "lucro" : "prejuizo");
  anima($("e-lucro"), lucro, "R$");
  $("e-lucro").style.color = lucro < 0 ? "var(--red)" : "var(--texto)";

  const roi = outMes > 0 ? ((inMes - outMes)/outMes)*100 : null;
  const er = $("e-roi");
  er.textContent = roi === null ? "ROI sem base" : `ROI ${roi>0?"+":""}${roi.toFixed(0)}%`;
  er.style.color = roi === null ? "" : (roi >= 0 ? "var(--green)" : "var(--red)");
  er.style.borderColor = roi === null ? "" : (roi >= 0 ? "var(--green)" : "var(--red)");
  const margem = inMes > 0 ? (lucro/inMes)*100 : null;
  $("e-margem").textContent = margem === null ? "sem receita" : `margem ${margem.toFixed(0)}%`;

  $("e-in").textContent  = "R$ " + brl(inMes);
  $("e-out").textContent = "R$ " + brl(outMes);
  $("e-in-sub").textContent  = noMes(ym,"entrada").length + " lançamentos";
  $("e-out-sub").textContent = noMes(ym,"saida").length + " lançamentos";

  const g = {};
  noMes(ym,"saida").forEach(x=>{ const k = x.membro_id || "sem"; g[k] = (g[k]||0)+x.valor; });
  const pares = Object.entries(g).sort((a,b)=>b[1]-a[1]);
  const total = pares.reduce((s,[,v])=>s+v,0);
  $("e-socios-tot").textContent = total>0 ? "R$ " + brl0(total) : "";
  const box = $("e-socios");
  if(!pares.length){ box.innerHTML = '<div class="vazio">Nenhuma saída este mês. Ao lançar, escolha de quem foi o gasto.</div>'; }
  else{
    const max = pares[0][1];
    box.innerHTML = pares.map(([k,v])=>
      `<div class="linha-barra"><span class="n">${esc(k==="sem"?"não atribuído":nomeMembro(k))}</span>
       <span class="trilho"><i style="width:${Math.max(2,(v/max)*100)}%"></i></span>
       <span class="v">${brl0(v)}</span></div>`).join("");
  }
}

function renderAlertas(){
  const box = $("alertas"); box.innerHTML = "";
  const h = hojeISO();
  const venc = contasOrd().filter(c=>diasEntre(h, vencimento(c)) < 0);
  const ev = eventosNoDia(h).filter(e=>e.hora);
  const p = [];
  if(venc.length) p.push(`${venc.length} conta${venc.length>1?"s":""} vencida${venc.length>1?"s":""}`);
  if(ev.length)   p.push(`${ev.length} compromisso${ev.length>1?"s":""} hoje`);
  if(!p.length) return;
  const el = document.createElement("div");
  el.className = "alerta";
  el.innerHTML = `<span class="rot laranja">Atenção</span><span class="t">${p.join(" · ")}</span>`;
  box.appendChild(el);
}

/* ================= ROTINA ================= */
function renderRotinaDia(){
  const d = rtDia, h = hojeISO();
  const rel = d===h ? "hoje" : d===somaDias(h,-1) ? "ontem" : d===somaDias(h,1) ? "amanhã"
            : (diasEntre(h,d) > 0 ? `em ${diasEntre(h,d)} dias` : `${-diasEntre(h,d)} dias atrás`);
  $("rt-data").textContent = extenso(d,{weekday:"long",day:"2-digit",month:"short"}).replace(/\./g,"");
  $("rt-rel").textContent = rel;

  const box = $("rt-blocos"); box.innerHTML = "";
  $("rt-seed").hidden = db.blocos.length > 0;

  if(!db.blocos.length){
    box.innerHTML = '<div class="card"><div class="vazio">Nenhum bloco ainda. Use o botão abaixo para instalar sua rotina de 07:30 às 00:00 — depois é só editar o que não bater.</div></div>';
    $("rt-barra").style.width = "0%";
  }else{
    let totI = 0, totF = 0;
    const agora = new Date().toTimeString().slice(0,5);
    const blocos = [...db.blocos].sort((a,b)=>a.hora.localeCompare(b.hora));

    blocos.forEach((bl,idx)=>{
      const itens = itensDoBloco(bl.id, d);
      const feitos = itens.filter(i=>temMarca(i.id, d)).length;
      totI += itens.length; totF += feitos;
      const pronto = itens.length > 0 && feitos === itens.length;
      const prox = blocos[idx+1];
      const agoraNesse = d===h && hhmm(bl.hora) <= agora && (!prox || agora < hhmm(prox.hora));
      const aberto = blocoAberto === bl.id;

      const el = document.createElement("div");
      el.className = "blk" + (pronto?" pronto":"") + (agoraNesse && !pronto?" agora":"");
      const cab = document.createElement("button");
      cab.className = "blk-cab press";
      cab.setAttribute("aria-expanded", String(aberto));
      cab.innerHTML = `<span class="blk-hora">${hhmm(bl.hora)}</span>
        <span class="blk-tit">${esc(bl.titulo)}</span>
        ${agoraNesse && !pronto ? '<span class="selo">agora</span>' : ""}
        <span class="blk-cnt">${feitos}/${itens.length}</span>
        <span class="blk-seta">${aberto?"▾":"▸"}</span>`;
      cab.onclick = ()=>{ blocoAberto = aberto ? null : bl.id; tocar(); renderRotinaDia(); };
      el.appendChild(cab);

      if(aberto){
        const corpo = document.createElement("div");
        corpo.className = "blk-corpo";
        if(bl.nota){
          const n = document.createElement("div");
          n.className = "blk-nota"; n.textContent = bl.nota;
          corpo.appendChild(n);
        }
        if(!itens.length){
          const v = document.createElement("div");
          v.className = "vazio"; v.style.fontSize = "13px";
          v.textContent = "Nenhum item para " + DIAS_SEM[diaSemana(d)] + ".";
          corpo.appendChild(v);
        }
        itens.forEach(it=>{
          const on = temMarca(it.id, d);
          const li = document.createElement("button");
          li.className = "tk press" + (on?" on":"");
          li.setAttribute("aria-pressed", String(on));
          li.innerHTML = `<span class="cx">✓</span><span class="t">${esc(it.nome)}</span>`
            + (it.dia_semana !== null && it.dia_semana !== undefined ? `<span class="h">${DIAS_SEM[it.dia_semana].slice(0,3)}</span>` : "");
          li.onclick = ()=>alternarItem(it, on, d);
          corpo.appendChild(li);
        });
        const ed = document.createElement("button");
        ed.className = "mini press";
        ed.style.cssText = "width:100%;margin-top:12px";
        ed.textContent = "Editar este bloco";
        ed.onclick = ()=>abrirBloco(bl);
        corpo.appendChild(ed);
        el.appendChild(corpo);
      }
      box.appendChild(el);
    });
    $("rt-barra").style.width = totI ? Math.round(totF/totI*100)+"%" : "0%";
  }

  // tarefas avulsas
  const lt = $("rt-tarefas"); lt.innerHTML = "";
  const ts = tarefasDoDia(d);
  $("rt-tar-cnt").textContent = ts.length ? ts.filter(t=>t.feita).length + "/" + ts.length : "";
  if(!ts.length) lt.innerHTML = '<li class="vazio">Nada só para este dia.</li>';
  ts.forEach(t=>{
    const li = document.createElement("li");
    li.className = "tk" + (t.feita?" on":"");
    const bt = document.createElement("button");
    bt.className = "cx press"; bt.textContent = "✓";
    bt.setAttribute("aria-pressed", String(t.feita));
    bt.onclick = ()=>alternarTarefa(t);
    const tx = document.createElement("span");
    tx.className = "t"; tx.textContent = t.titulo;
    const hr = document.createElement("span");
    hr.className = "h"; hr.textContent = hhmm(t.hora);
    const x = document.createElement("button");
    x.className = "x press"; x.textContent = "✕";
    x.onclick = ()=>apagar("tarefas", t.id, ()=>{ db.tarefas = db.tarefas.filter(z=>z.id!==t.id); });
    li.append(bt,tx,hr,x); lt.appendChild(li);
  });
}

function abrirBloco(bl){
  blocoEdit = bl;
  $("bl-titulo").textContent = hhmm(bl.hora) + " — " + bl.titulo;
  $("bl-hora").value = hhmm(bl.hora);
  $("bl-nome").value = bl.titulo;
  const ul = $("bl-itens"); ul.innerHTML = "";
  const todos = db.habitos.filter(x=>x.bloco_id===bl.id).sort((a,b)=>(a.ordem||0)-(b.ordem||0));
  if(!todos.length) ul.innerHTML = '<li class="vazio">Bloco sem itens.</li>';
  todos.forEach(it=>{
    const li = document.createElement("li"); li.className = "item";
    li.innerHTML = `<span class="nome">${esc(it.nome)}</span>`
      + (it.dia_semana !== null && it.dia_semana !== undefined ? `<span class="tag">só ${DIAS_SEM[it.dia_semana]}</span>` : "");
    const x = document.createElement("button");
    x.className = "x press"; x.textContent = "✕";
    x.onclick = async ()=>{
      const { error } = await sb.from("habitos").delete().eq("id", it.id);
      if(error) return falhou(error);
      db.habitos = db.habitos.filter(z=>z.id!==it.id);
      db.marcas  = db.marcas.filter(z=>z.habito_id!==it.id);
      abrirBloco(bl); renderRotinaDia(); toast("item removido");
    };
    li.appendChild(x); ul.appendChild(li);
  });
  abrirSheet("sheet-bloco");
}

/* ================= listas ================= */
function renderContas(){
  const h = hojeISO(), lc = $("lista-contas"); lc.innerHTML = "";
  if(!contas().length){ lc.innerHTML = '<li class="vazio">Sem contas neste espaço.</li>'; return; }
  contasOrd().slice(0,7).forEach(c=>{
    const d = diasEntre(h, vencimento(c));
    const cls = d<0?"vencido":d<=3?"perto":"";
    const li = document.createElement("li"); li.className = "item";
    li.innerHTML = `<span class="tag ${cls}">${d<0?`${-d}d atrás`:d===0?"hoje":`${d}d`}</span>
      <span class="nome">${esc(c.nome)}</span><span class="cifra">${c.valor?"R$ "+brl(c.valor):""}</span>`;
    const pg = document.createElement("button"); pg.className = "mini press"; pg.textContent = "paguei";
    pg.onclick = ()=>pagarConta(c);
    const x = document.createElement("button"); x.className = "x press"; x.textContent = "✕";
    x.onclick = ()=>apagar("contas", c.id, ()=>{ db.contas = db.contas.filter(z=>z.id!==c.id); });
    li.append(pg,x); lc.appendChild(li);
  });
}

function renderLancamentos(){
  const h = hojeISO(), ll = $("lista-lanc"); ll.innerHTML = "";
  $("cont-hoje").textContent = noDia(h).length + " hoje";
  const ult = lancs().slice(0,8);
  if(!ult.length){ ll.innerHTML = '<li class="vazio">Nada lançado neste espaço. Toque no + para começar.</li>'; return; }
  const rank = rankCategorias(mesDe(h));
  ult.forEach(l=>{
    const i = rank.findIndex(([c])=>c===l.categoria);
    const cor = l.tipo==="entrada" ? VERDE : (i<0 ? "var(--linha-f)" : RAMPA[Math.min(i,RAMPA.length-1)]);
    const extra = espaco==="empresa" && l.membro_id ? " · " + esc(nomeMembro(l.membro_id)) : "";
    const li = document.createElement("li"); li.className = "item";
    li.innerHTML = `<span class="barra-cat" style="background:${cor}"></span>
      <span class="nome">${esc(l.categoria)}${l.nota?' <span style="color:var(--fraco)">· '+esc(l.nota)+'</span>':""}<span style="color:var(--fraco)">${extra}</span></span>
      ${l.natureza==="futil"?'<span class="tag futil">fútil</span>':""}
      <span class="tag">${l.data===h?"hoje":curto(l.data)}</span>
      <span class="cifra ${l.tipo==="entrada"?"entrada":""}">${l.tipo==="entrada"?"+":"−"} ${brl(l.valor)}</span>`;
    const x = document.createElement("button"); x.className = "x press"; x.textContent = "✕";
    x.onclick = ()=>apagar("lancamentos", l.id, ()=>{ db.lancamentos = db.lancamentos.filter(z=>z.id!==l.id); });
    li.appendChild(x); ll.appendChild(li);
  });
}

function renderCalendario(){
  const { a, m } = calRef, h = hojeISO(), ymCal = `${a}-${String(m).padStart(2,"0")}`;
  $("cal-mes").textContent = new Date(a, m-1, 1).toLocaleDateString("pt-BR",{month:"short",year:"numeric"}).replace(/\./g,"");
  const primeiro = new Date(a, m-1, 1);
  const inicio = somaDias(isoDe(primeiro), -primeiro.getDay());
  const dias = []; for(let i=0;i<42;i++) dias.push(somaDias(inicio,i));
  const vals = dias.filter(d=>mesDe(d)===ymCal).map(saidaDia).filter(v=>v>0).sort((x,y)=>x-y);
  const q = p => vals.length ? vals[Math.min(vals.length-1, Math.floor(vals.length*p))] : 0;
  const q1=q(.33), q2=q(.66), q3=q(.9);
  const cal = $("cal"); cal.innerHTML = "";
  dias.forEach(d=>{
    const fora = mesDe(d) !== ymCal, v = saidaDia(d);
    const op = v<=0?0 : v<=q1?.20 : v<=q2?.36 : v<=q3?.55 : .78;
    const b = document.createElement("button");
    b.className = "dia press" + (fora?" fora":"") + (d===h?" hoje":"") + (v>0?" gastou":"")
      + (contasNoDia(d).length?" conta":"") + ((eventosNoDia(d).length||tarefasDoDia(d).length)?" evento":"");
    b.setAttribute("aria-label", extenso(d));
    b.innerHTML = `<span class="fundo" style="opacity:${op}"></span><span class="n">${+d.slice(8,10)}</span>`
      + (db.fechados.includes(d) ? '<span class="sub"></span>' : "");
    b.onclick = ()=>{ selDia = d; tocar(); renderDetalheDia(); abrirSheet("sheet-dia"); };
    cal.appendChild(b);
  });
}

function renderProximosEventos(){
  const h = hojeISO(), le = $("lista-eventos"); le.innerHTML = "";
  const prox = eventos().filter(e=>e.data>=h)
    .sort((x,y)=>(x.data+(x.hora||"99")).localeCompare(y.data+(y.hora||"99"))).slice(0,10);
  if(!prox.length){ le.innerHTML = '<li class="vazio">Nada marcado. Toque num dia do calendário para adicionar.</li>'; return; }
  prox.forEach(ev=>{
    const d = diasEntre(h, ev.data);
    const li = document.createElement("li"); li.className = "item";
    li.innerHTML = `<span class="tag ${d<=1?"perto":""}">${d===0?"hoje":d===1?"amanhã":curto(ev.data)}</span>
      <span class="nome">${esc(ev.titulo)}${ev.lembrete_min?' <span style="color:var(--fraco)">· aviso '+ev.lembrete_min+'min</span>':""}</span>
      <span class="cifra">${hhmm(ev.hora)}</span>`;
    const x = document.createElement("button"); x.className = "x press"; x.textContent = "✕";
    x.onclick = ()=>apagar("eventos", ev.id, ()=>{ db.eventos = db.eventos.filter(z=>z.id!==ev.id); });
    li.appendChild(x); le.appendChild(li);
  });
}

function renderNumeros(h, ym, dia, inMes, outMes, saldoMes){
  $("k-in").textContent  = "R$ " + brl(inMes);
  $("k-out").textContent = "R$ " + brl(outMes);
  $("k-in-sub").textContent  = noMes(ym,"entrada").length + " lançamentos";
  $("k-out-sub").textContent = `projeção: R$ ${brl0(outMes/dia*ultimoDia(+ym.slice(0,4),+ym.slice(5,7)))}`;
  $("k-saldo").textContent = "R$ " + brl(saldoMes);
  $("k-saldo").style.color = saldoMes < 0 ? "var(--red)" : "var(--green)";
  $("k-saldo-sub").textContent = inMes>0 ? `margem ${(saldoMes/inMes*100).toFixed(0)}%` : "sem entradas";

  const antAcum = acumulado(mesAnterior(ym), dia);
  const base = antAcum.length ? antAcum[antAcum.length-1] : 0;
  if(base<=0){ $("k-ritmo").textContent="—"; $("k-ritmo").style.color=""; $("k-ritmo-sub").textContent="sem base anterior"; }
  else{
    const p = Math.round((outMes/base-1)*100);
    $("k-ritmo").textContent = (p>0?"+":"")+p+"%";
    $("k-ritmo").style.color = p>0 ? "var(--laranja)" : "var(--green)";
    $("k-ritmo-sub").textContent = `dia ${dia} do mês passado: R$ ${brl0(base)}`;
  }
  $("g-fluxo").innerHTML = svgFluxo();
  $("g-ritmo").innerHTML = svgRitmo();
  $("g-donut").innerHTML = svgDonut();
}

function renderDetalheDia(){
  const d = selDia, h = hojeISO();
  $("dia-titulo").textContent = d===h ? "Hoje" : extenso(d,{weekday:"long",day:"2-digit",month:"long"});
  const saldo = entraDia(d) - saidaDia(d);
  $("dia-total").innerHTML = `<small>R$</small>${brl(saldo)}`;
  $("dia-total").style.color = saldo < 0 ? "var(--texto)" : "var(--green)";

  const dl = $("dia-lanc"); dl.innerHTML = "";
  const ls = noDia(d);
  if(!ls.length) dl.innerHTML = '<li class="vazio">Nenhum lançamento neste dia.</li>';
  ls.forEach(l=>{
    const li = document.createElement("li"); li.className = "item";
    li.innerHTML = `<span class="barra-cat" style="background:${l.tipo==="entrada"?VERDE:LARANJA}"></span>
      <span class="nome">${esc(l.categoria)}${l.nota?' <span style="color:var(--fraco)">· '+esc(l.nota)+'</span>':""}</span>
      <span class="cifra ${l.tipo==="entrada"?"entrada":""}">${l.tipo==="entrada"?"+":"−"} ${brl(l.valor)}</span>`;
    const x = document.createElement("button"); x.className = "x press"; x.textContent = "✕";
    x.onclick = ()=>apagar("lancamentos", l.id, ()=>{ db.lancamentos = db.lancamentos.filter(z=>z.id!==l.id); });
    li.appendChild(x); dl.appendChild(li);
  });

  const dc = $("dia-contas"); dc.innerHTML = "";
  const cs = contasNoDia(d);
  if(!cs.length) dc.innerHTML = '<li class="vazio">Nenhuma conta vence neste dia.</li>';
  cs.forEach(c=>{
    const li = document.createElement("li"); li.className = "item";
    li.innerHTML = `<span class="barra-cat" style="background:var(--red)"></span><span class="nome">${esc(c.nome)}</span>
      <span class="cifra">${c.valor?"R$ "+brl(c.valor):""}</span>
      <span class="tag">${c.ultimo_pago===mesDe(d)?"pago":"aberto"}</span>`;
    dc.appendChild(li);
  });

  const de = $("dia-eventos"); de.innerHTML = "";
  const evs = eventosNoDia(d);
  if(!evs.length) de.innerHTML = '<li class="vazio">Nada marcado neste dia.</li>';
  evs.forEach(ev=>{
    const li = document.createElement("li"); li.className = "item";
    li.innerHTML = `<span class="tag">${ev.hora?hhmm(ev.hora):"dia todo"}</span><span class="nome">${esc(ev.titulo)}</span>`;
    const x = document.createElement("button"); x.className = "x press"; x.textContent = "✕";
    x.onclick = ()=>apagar("eventos", ev.id, ()=>{ db.eventos = db.eventos.filter(z=>z.id!==ev.id); });
    li.appendChild(x); de.appendChild(li);
  });
}

/* ================= lembretes ================= */
function checarLembretes(){
  const agora = new Date(), h = isoDe(agora);
  db.eventos.filter(e=>e.data===h && e.hora && e.lembrete_min).forEach(e=>{
    if(avisados.has(e.id)) return;
    const [hh,mm] = hhmm(e.hora).split(":").map(Number);
    const q = new Date(agora); q.setHours(hh, mm, 0, 0);
    const faltam = (q - agora)/60000;
    if(faltam <= e.lembrete_min && faltam > -2){
      avisados.add(e.id);
      toast(`${e.titulo} · ${hhmm(e.hora)}`);
      try{
        if("Notification" in window && Notification.permission === "granted")
          new Notification("NexVot", { body: `${e.titulo} às ${hhmm(e.hora)}` });
      }catch(err){}
      tocar(30);
    }
  });
}

/* ================= navegação ================= */
function aplicarEspaco(rerender){
  const pessoal = espaco === "pessoal";
  $("seletor").className = "seletor" + (pessoal ? "" : " empresa");
  $("seletor").querySelectorAll("button").forEach(b=> b.classList.toggle("ativo", b.dataset.esp===espaco));
  $("p-pessoal").hidden = !pessoal;
  $("p-empresa").hidden = pessoal;
  try{ localStorage.setItem("nexvot:espaco", espaco); }catch(e){}
  if(rerender) render();
}
function irPara(nome){
  if(nome === viewAtual) return;
  const dir = VIEWS.indexOf(nome) > VIEWS.indexOf(viewAtual) ? "de-dir" : "de-esq";
  document.querySelectorAll(".view").forEach(v=>v.classList.remove("ativa","de-dir","de-esq"));
  $("v-"+nome).classList.add("ativa", dir);
  document.querySelectorAll(".nav .aba").forEach(a=>a.classList.toggle("ativa", a.dataset.view===nome));
  viewAtual = nome;
  window.scrollTo({ top:0, behavior:"instant" });
  tocar(6);
}
function abrirSheet(id){
  $("veu").hidden = false; $(id).hidden = false;
  requestAnimationFrame(()=>{ $("veu").classList.add("aberto"); $(id).classList.add("aberto"); });
  document.body.style.overflow = "hidden";
}
function fecharSheets(){
  document.querySelectorAll(".sheet").forEach(s=>s.classList.remove("aberto"));
  $("veu").classList.remove("aberto");
  document.body.style.overflow = "";
  setTimeout(()=>{ document.querySelectorAll(".sheet").forEach(s=>s.hidden=true); $("veu").hidden = true; }, 300);
}

/* ================= lançamento ================= */
const valorAtual = () => digitos ? parseInt(digitos,10)/100 : 0;
function pintarMostrador(){
  const v = valorAtual(), el = $("mostrador");
  el.innerHTML = `<small>R$</small>${brl(v)}`;
  el.className = "v" + (v<=0?" zero":"") + (tipoSel==="entrada"?" entrada":"");
  $("btn-lancar").disabled = v<=0 || !catSel;
}
function tecla(k){
  if(k==="del") digitos = digitos.slice(0,-1);
  else if(digitos.length < 9) digitos += k;
  tocar(6); pintarMostrador();
}
function abrirLancamento(data){
  digitos = ""; catSel = null;
  membroSel = (db.membros.find(m=>m.eh_voce)||db.membros[0]||{}).id || null;
  tipoSel = "saida"; natSel = "essencial";
  dataAlvo = data || hojeISO();
  $("nota").value = ""; $("aviso").textContent = "";
  $("lanc-titulo").textContent = espaco === "pessoal" ? "Lançar — pessoal" : "Lançar — empresa";
  pintarTipo(); pintarChipsData(); pintarChipsCat(); pintarNatureza(); pintarMembros(); pintarMostrador();
  abrirSheet("sheet-lanc");
}
function pintarTipo(){
  $("dp-tipo").querySelectorAll("button").forEach(b=>{
    const sel = b.dataset.t === tipoSel;
    b.className = sel ? ("sel" + (tipoSel==="entrada"?" verde":"")) : "";
  });
}
function pintarChipsData(){
  const h = hojeISO();
  const op = [{d:h,r:"Hoje"},{d:somaDias(h,-1),r:"Ontem"},{d:somaDias(h,-2),r:curto(somaDias(h,-2))}];
  if(!op.some(o=>o.d===dataAlvo)) op.push({ d:dataAlvo, r:curto(dataAlvo) });
  $("chips-data").innerHTML = op.map(o=>`<button class="chip press ${o.d===dataAlvo?"sel":""}" data-d="${o.d}">${o.r}</button>`).join("");
  $("chips-data").querySelectorAll("button").forEach(b=> b.onclick = ()=>{ dataAlvo = b.dataset.d; tocar(); pintarChipsData(); });
}
function pintarChipsCat(){
  const lista = CATS[espaco][tipoSel];
  if(catSel && !lista.includes(catSel)) catSel = null;
  $("chips-cat").innerHTML = lista.map(c=>`<button class="chip press ${c===catSel?"sel":""}" data-c="${esc(c)}">${esc(c)}</button>`).join("");
  $("chips-cat").querySelectorAll("button").forEach(b=> b.onclick = ()=>{
    catSel = b.dataset.c;
    if(espaco==="pessoal" && tipoSel==="saida") natSel = NATUREZA_PADRAO[catSel] || "essencial";
    tocar(); pintarChipsCat(); pintarNatureza(); pintarMostrador();
  });
}
function pintarNatureza(){
  const mostra = espaco==="pessoal" && tipoSel==="saida";
  $("dp-natureza").hidden = !mostra;
  if(!mostra) return;
  $("dp-natureza").querySelectorAll("button").forEach(b=> b.className = b.dataset.n===natSel ? "sel" : "");
}
function pintarMembros(){
  const mostra = espaco==="empresa" && tipoSel==="saida" && db.membros.length > 0;
  $("chips-membro").hidden = !mostra;
  if(!mostra) return;
  $("chips-membro").innerHTML = db.membros.map(m=>
    `<button class="chip press ${m.id===membroSel?"sel":""}" data-m="${m.id}">${esc(m.nome)}</button>`).join("");
  $("chips-membro").querySelectorAll("button").forEach(b=> b.onclick = ()=>{ membroSel = b.dataset.m; tocar(); pintarMembros(); });
}

/* ================= mutações ================= */
async function apagar(tabela, id, local){
  const { error } = await sb.from(tabela).delete().eq("id", id);
  if(error) return falhou(error);
  local(); render(); toast("removido");
}
async function lancar(){
  const v = valorAtual();
  if(v<=0){ $("aviso").textContent = "digite um valor"; return; }
  if(!catSel){ $("aviso").textContent = "escolha uma categoria"; return; }
  $("aviso").textContent = "";
  const { data, error } = await sb.from("lancamentos").insert({
    user_id:usuario.id, espaco, tipo:tipoSel, data:dataAlvo, valor:v,
    categoria:catSel, nota:$("nota").value.trim(),
    natureza: (espaco==="pessoal" && tipoSel==="saida") ? natSel : null,
    membro_id: (espaco==="empresa" && tipoSel==="saida") ? membroSel : null
  }).select().single();
  if(error) return falhou(error);
  db.lancamentos.unshift({...data, valor:Number(data.valor)});
  db.lancamentos.sort((a,b)=>b.data.localeCompare(a.data));
  tocar(14); fecharSheets(); render();
  toast(`${tipoSel==="entrada"?"+":"−"} R$ ${brl(v)} · ${dataAlvo===hojeISO()?"hoje":curto(dataAlvo)}`);
}
async function pagarConta(c){
  const mes = mesDe(vencimento(c));
  const { error } = await sb.from("contas").update({ ultimo_pago:mes }).eq("id", c.id);
  if(error) return falhou(error);
  c.ultimo_pago = mes;
  if(c.valor > 0){
    const { data, error:e2 } = await sb.from("lancamentos").insert({
      user_id:usuario.id, espaco:c.espaco, tipo:"saida", data:hojeISO(), valor:c.valor,
      categoria:"Contas", nota:c.nome, natureza: c.espaco==="pessoal" ? "essencial" : null
    }).select().single();
    if(e2) return falhou(e2);
    db.lancamentos.unshift({...data, valor:Number(data.valor)});
  }
  tocar(14); render(); toast(`${c.nome} quitada`);
}
async function alternarItem(it, estavaOn, data){
  tocar(estavaOn?6:12);
  if(estavaOn){
    const marca = db.marcas.find(x=>x.habito_id===it.id && x.data===data);
    if(!marca) return;
    const { error } = await sb.from("habito_marcas").delete().eq("id", marca.id);
    if(error) return falhou(error);
    db.marcas = db.marcas.filter(x=>x.id!==marca.id);
  }else{
    const { data:novo, error } = await sb.from("habito_marcas")
      .insert({ user_id:usuario.id, habito_id:it.id, data }).select().single();
    if(error) return falhou(error);
    db.marcas.push(novo);
  }
  renderRotinaDia();
}
async function alternarTarefa(t){
  tocar(t.feita?6:12);
  const { error } = await sb.from("tarefas").update({ feita: !t.feita }).eq("id", t.id);
  if(error) return falhou(error);
  t.feita = !t.feita;
  renderRotinaDia();
}
async function fecharDia(){
  const h = hojeISO();
  const { error } = await sb.from("dias_fechados").insert({ user_id:usuario.id, data:h });
  if(error) return falhou(error);
  db.fechados.push(h);
  tocar(18); render(); toast(`dia fechado · ${streakDe(db.fechados)}d seguidos`);
}
async function instalarRotina(){
  toast("instalando…");
  for(let i=0;i<ROTINA.length;i++){
    const b = ROTINA[i];
    const { data:bloco, error } = await sb.from("blocos_rotina")
      .insert({ user_id:usuario.id, hora:b.hora, titulo:b.titulo, nota:b.nota || null, ordem:i })
      .select().single();
    if(error) return falhou(error);
    db.blocos.push(bloco);
    const itens = b.itens.map((it,j)=>{
      const obj = typeof it === "string" ? { nome:it, dia:null } : it;
      return { user_id:usuario.id, bloco_id:bloco.id, nome:obj.nome,
               dia_semana: obj.dia === null || obj.dia === undefined ? null : obj.dia, ordem:j };
    });
    const { data:novos, error:e2 } = await sb.from("habitos").insert(itens).select();
    if(e2) return falhou(e2);
    db.habitos.push(...novos);
  }
  renderRotinaDia();
  toast("rotina instalada");
}

/* ================= eventos de UI ================= */
function ligarEventos(){
  $("seletor").querySelectorAll("button").forEach(b=>
    b.onclick = ()=>{ if(espaco===b.dataset.esp) return; espaco = b.dataset.esp; tocar(10); aplicarEspaco(true); });
  document.querySelectorAll(".nav .aba").forEach(a=> a.onclick = ()=>irPara(a.dataset.view));
  $("fab").onclick = ()=>{ tocar(10); abrirLancamento(hojeISO()); };
  $("btn-dia").onclick = fecharDia;

  $("rt-ant").onclick  = ()=>{ rtDia = somaDias(rtDia,-1); blocoAberto = null; tocar(); renderRotinaDia(); };
  $("rt-prox").onclick = ()=>{ rtDia = somaDias(rtDia, 1); blocoAberto = null; tocar(); renderRotinaDia(); };
  $("rt-hoje").onclick = ()=>{ rtDia = hojeISO(); blocoAberto = null; tocar(); renderRotinaDia(); };
  $("rt-seed").onclick = instalarRotina;

  $("t-add").onclick = async ()=>{
    const titulo = $("t-titulo").value.trim();
    if(!titulo) return;
    const { data, error } = await sb.from("tarefas").insert({
      user_id:usuario.id, data:rtDia, hora:$("t-hora").value || null, titulo
    }).select().single();
    if(error) return falhou(error);
    db.tarefas.push(data);
    $("t-titulo").value = ""; $("t-hora").value = "";
    renderRotinaDia(); renderCalendario(); toast("adicionado a este dia");
  };

  $("b-add").onclick = async ()=>{
    const hora = $("b-hora").value, titulo = $("b-titulo").value.trim();
    if(!hora || !titulo) return toast("preencha hora e título", true);
    const { data, error } = await sb.from("blocos_rotina")
      .insert({ user_id:usuario.id, hora, titulo, ordem:db.blocos.length }).select().single();
    if(error) return falhou(error);
    db.blocos.push(data);
    $("b-hora").value = ""; $("b-titulo").value = "";
    blocoAberto = data.id; renderRotinaDia(); toast("bloco criado");
  };

  $("bl-fechar").onclick = fecharSheets;
  $("bl-add").onclick = async ()=>{
    if(!blocoEdit) return;
    const nome = $("bl-novo").value.trim();
    if(!nome) return;
    const dv = $("bl-dia").value;
    const { data, error } = await sb.from("habitos").insert({
      user_id:usuario.id, bloco_id:blocoEdit.id, nome,
      dia_semana: dv === "" ? null : parseInt(dv,10),
      ordem: db.habitos.filter(x=>x.bloco_id===blocoEdit.id).length
    }).select().single();
    if(error) return falhou(error);
    db.habitos.push(data);
    $("bl-novo").value = "";
    abrirBloco(blocoEdit); renderRotinaDia(); toast("item adicionado");
  };
  $("bl-salvar").onclick = async ()=>{
    if(!blocoEdit) return;
    const hora = $("bl-hora").value, titulo = $("bl-nome").value.trim();
    if(!hora || !titulo) return toast("preencha hora e título", true);
    const { error } = await sb.from("blocos_rotina").update({ hora, titulo }).eq("id", blocoEdit.id);
    if(error) return falhou(error);
    blocoEdit.hora = hora; blocoEdit.titulo = titulo;
    fecharSheets(); renderRotinaDia(); toast("bloco salvo");
  };
  $("bl-apagar").onclick = async ()=>{
    if(!blocoEdit) return;
    if(!confirm("Apagar o bloco e todos os itens dele?")) return;
    const { error } = await sb.from("blocos_rotina").delete().eq("id", blocoEdit.id);
    if(error) return falhou(error);
    db.blocos  = db.blocos.filter(z=>z.id!==blocoEdit.id);
    db.habitos = db.habitos.filter(z=>z.bloco_id!==blocoEdit.id);
    blocoEdit = null; blocoAberto = null;
    fecharSheets(); renderRotinaDia(); toast("bloco apagado");
  };

  $("cal-ant").onclick  = ()=>{ calRef.m--; if(calRef.m<1){calRef.m=12;calRef.a--;} tocar(); renderCalendario(); };
  $("cal-prox").onclick = ()=>{ calRef.m++; if(calRef.m>12){calRef.m=1;calRef.a++;} tocar(); renderCalendario(); };
  $("veu").onclick = fecharSheets;
  $("lanc-fechar").onclick = fecharSheets;
  $("dia-fechar").onclick = fecharSheets;
  document.addEventListener("keydown", e=>{ if(e.key==="Escape") fecharSheets(); });
  document.querySelectorAll(".tecla").forEach(t=> t.onclick = ()=>tecla(t.dataset.k));
  $("btn-lancar").onclick = lancar;
  $("dia-lancar").onclick = ()=>{ const d = selDia; fecharSheets(); setTimeout(()=>abrirLancamento(d), 260); };
  $("dia-rotina").onclick = ()=>{ rtDia = selDia; blocoAberto = null; fecharSheets(); setTimeout(()=>{ irPara("rotina"); renderRotinaDia(); }, 260); };

  $("dp-tipo").querySelectorAll("button").forEach(b=> b.onclick = ()=>{
    tipoSel = b.dataset.t; tocar();
    pintarTipo(); pintarChipsCat(); pintarNatureza(); pintarMembros(); pintarMostrador();
  });
  $("dp-natureza").querySelectorAll("button").forEach(b=> b.onclick = ()=>{
    natSel = b.dataset.n; tocar(); pintarNatureza();
  });

  $("btn-notif").onclick = async ()=>{
    if(!("Notification" in window)) return toast("este navegador não tem notificações", true);
    const p = await Notification.requestPermission();
    toast(p === "granted" ? "avisos ligados" : "avisos negados", p !== "granted");
  };

  $("c-add").onclick = async ()=>{
    const nome = $("c-nome").value.trim(), dia = parseInt($("c-dia").value,10);
    if(!nome || !dia) return toast("preencha nome e dia", true);
    const { data, error } = await sb.from("contas").insert({
      user_id:usuario.id, espaco, nome, dia:Math.min(Math.max(dia,1),31), valor:numBR($("c-valor").value)
    }).select().single();
    if(error) return falhou(error);
    db.contas.push({...data, valor:Number(data.valor||0)});
    ["c-nome","c-dia","c-valor"].forEach(k=>$(k).value="");
    render(); toast("conta cadastrada");
  };

  $("m-add").onclick = async ()=>{
    const nome = $("m-nome").value.trim();
    if(!nome) return;
    const { data, error } = await sb.from("membros")
      .insert({ user_id:usuario.id, nome, eh_voce:false }).select().single();
    if(error) return falhou(error);
    db.membros.push(data);
    $("m-nome").value = "";
    render(); toast("sócio adicionado");
  };

  $("e-add").onclick = async ()=>{
    const titulo = $("e-titulo").value.trim();
    if(!titulo) return;
    const lem = $("e-lembrete").value;
    const { data, error } = await sb.from("eventos").insert({
      user_id:usuario.id, espaco, data:selDia, hora:$("e-hora").value || null,
      titulo, lembrete_min: lem ? parseInt(lem,10) : null
    }).select().single();
    if(error) return falhou(error);
    db.eventos.push(data);
    $("e-titulo").value = ""; $("e-hora").value = ""; $("e-lembrete").value = "";
    render(); renderDetalheDia(); toast("compromisso marcado");
  };

  $("btn-export").onclick = ()=>{
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(db,null,2)],{type:"application/json"}));
    a.download = `nexvot-backup-${hojeISO()}.json`; a.click();
  };

  let x0 = null, y0 = null;
  document.addEventListener("touchstart", e=>{
    if(!$("sheet-lanc").hidden || !$("sheet-dia").hidden || !$("sheet-bloco").hidden) return;
    x0 = e.touches[0].clientX; y0 = e.touches[0].clientY;
  }, { passive:true });
  document.addEventListener("touchend", e=>{
    if(x0===null) return;
    const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0;
    x0 = null;
    if(Math.abs(dx) < 62 || Math.abs(dy) > Math.abs(dx)*0.7) return;
    const i = VIEWS.indexOf(viewAtual) + (dx < 0 ? 1 : -1);
    if(i >= 0 && i < VIEWS.length) irPara(VIEWS[i]);
  }, { passive:true });
}

window.addEventListener("unhandledrejection", e=>{
  if($("splash").hidden) return;
  erroFatal("Erro não tratado: " + ((e.reason && e.reason.message) || e.reason));
});

boot().catch(e => erroFatal("Falha ao iniciar: " + e.message));
