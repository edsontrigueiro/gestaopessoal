// ============================================================
//  NEXVOT — Gestão Inteligente — app.js (v5)
//  Identidade Oris: preto + laranja #FF5E04 usado com escassez.
//  Verde e vermelho SÓ para resultado real (hábito cumprido,
//  dia fechado, conta vencida).
//  Sessão anônima do Supabase: sem tela de login, com RLS ativo.
//  Requer: Authentication → Sign In / Providers → "Allow anonymous
//  sign-ins" LIGADO no painel do Supabase.
// ============================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Sinaliza que o módulo carregou (o watchdog do index.html olha isto).
window.__APP_CARREGOU__ = true;

// O cliente é criado dentro do boot(), depois de validar a config.
// Criar aqui em cima faria o módulo estourar antes de qualquer mensagem
// chegar na tela — que foi exatamente o bug da primeira versão.
let sb = null;

function erroFatal(msg){
  const el = document.getElementById("splash-txt");
  if(el){ el.className = "erro"; el.textContent = msg; }
  console.error("[NexVot]", msg);
}

const CATEGORIAS = ["Mercado","Comer fora","Transporte","Casa","Contas","Saúde","Lazer","Outros"];
// LARANJA é o único ponto de verdade da cor no JS. Trocou aqui, trocou em tudo
// que é desenhado em SVG. O CSS lê de --laranja no index.html.
const LARANJA = "#FF5E04";
// rampa por POSIÇÃO no ranking do mês: o maior gasto recebe o laranja, o resto desce em cinza
const RAMPA = [LARANJA,"#B34204","#8A8A8A","#6E6E6E","#585858","#474747","#3A3A3A","#2E2E2E"];
const BLOCOS = [
  { id:"manha", nome:"Manhã" },
  { id:"trabalho", nome:"Trabalho" },
  { id:"noite", nome:"Noite" }
];
const ROTINA_PRONTA = [
  { bloco:"manha",    nome:"Levantar sem soneca" },
  { bloco:"manha",    nome:"Beber água antes do café" },
  { bloco:"manha",    nome:"Mover o corpo 20 min" },
  { bloco:"manha",    nome:"Escrever as 3 prioridades do dia" },
  { bloco:"trabalho", nome:"Bloco de 90 min sem celular" },
  { bloco:"trabalho", nome:"Lançar os gastos do dia" },
  { bloco:"trabalho", nome:"Zerar a caixa de entrada" },
  { bloco:"noite",    nome:"Sem tela 30 min antes de dormir" },
  { bloco:"noite",    nome:"Deixar o dia seguinte planejado" },
  { bloco:"noite",    nome:"Fechar o dia no painel" }
];
const ORDEM_VIEWS = ["hoje","agenda","numeros"];

let usuario = null;
let viewAtual = "hoje";
let calRef = null, selDia = null, catSel = null, dataAlvo = null, digitos = "";
const abertos = new Set();   // blocos de rotina expandidos manualmente
const db = { lancamentos:[], contas:[], habitos:[], marcas:[], fechados:[], eventos:[] };

/* ================= utilidades ================= */
const $ = id => document.getElementById(id);
const isoDe = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
const hojeISO = () => isoDe(new Date());
const mesDe = s => s.slice(0,7);
const ultimoDia = (a,m) => new Date(a,m,0).getDate();
const dataDoMes = (a,m,d) => `${a}-${String(m).padStart(2,"0")}-${String(Math.min(Math.max(d,1),ultimoDia(a,m))).padStart(2,"0")}`;
const diasEntre = (a,b) => Math.round((new Date(b+"T00:00:00") - new Date(a+"T00:00:00"))/86400000);
const somaDias = (s,n) => { const d = new Date(s+"T00:00:00"); d.setDate(d.getDate()+n); return isoDe(d); };
const brl  = n => Number(n).toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2});
const brl0 = n => n>=1000 ? (n/1000).toFixed(n>=10000?0:1).replace(".",",")+"k" : String(Math.round(n));
const esc  = s => String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const numBR = s => { const n = parseFloat(String(s).replace(/\./g,"").replace(",",".")); return isFinite(n)?n:0; };
const extenso = (s,op) => new Date(s+"T00:00:00").toLocaleDateString("pt-BR", op||{weekday:"long",day:"2-digit",month:"long"});
const curto = s => s.slice(8,10)+"/"+s.slice(5,7);
const tocar = ms => { try{ navigator.vibrate && navigator.vibrate(ms||8); }catch(e){} };

let tToast = null;
function toast(txt, erro){
  let el = $("toast");
  if(!el){ el = document.createElement("div"); el.id = "toast"; el.className = "toast"; document.body.appendChild(el); }
  el.textContent = txt;
  el.style.borderColor = erro ? "var(--red)" : "var(--laranja)";
  el.style.color = erro ? "var(--red)" : "var(--texto)";
  clearTimeout(tToast);
  tToast = setTimeout(()=>{ el.remove(); }, erro ? 4200 : 1700);
}
const falhou = e => { console.error(e); toast((e && e.message) || "falha ao salvar", true); };

/* ================= abertura ================= */
async function boot(){
  // ---- validação da config, com mensagem visível para cada caso ----
  if(!window.CONFIG)
    return erroFatal("O config.js não carregou. Confira se o arquivo existe na raiz do repo e se não tem erro de digitação — um erro de sintaxe impede o arquivo inteiro de rodar.");

  const url = String(window.CONFIG.SUPABASE_URL || "").trim();
  const chave = String(window.CONFIG.SUPABASE_ANON_KEY || "").trim();

  if(!url || url.includes("SEU-PROJETO") || url.includes("COLE-AQUI"))
    return erroFatal("A SUPABASE_URL ainda é o valor de exemplo. Cole a URL do seu projeto (Supabase → Settings → API → Data API).");
  if(!/^https:\/\/[a-z0-9-]+\.supabase\.(co|in)\/?$/i.test(url))
    return erroFatal("A SUPABASE_URL está malformada: \"" + url + "\". Ela precisa ser exatamente https://xxxxxxxx.supabase.co — sem barra extra no fim, sem espaço, e não é o Project ID sozinho.");
  if(!chave || chave.includes("COLE-AQUI"))
    return erroFatal("A chave ainda é o valor de exemplo. Cole a publishable (sb_publishable_...) ou a anon (eyJ...).");
  if(chave.startsWith("sb_secret_") || chave.includes("service_role"))
    return erroFatal("Essa é a chave SECRET. Ela ignora o RLS e não pode ficar num app de navegador. Use a publishable (sb_publishable_...).");

  try{
    sb = createClient(url, chave);
  }catch(e){
    return erroFatal("Não consegui criar o cliente do Supabase: " + e.message);
  }

  // ---- sessão, com prazo: sem isso um erro de rede trava a tela para sempre ----
  let data;
  try{
    const r = await Promise.race([
      sb.auth.getSession(),
      new Promise((_,rej)=>setTimeout(()=>rej(new Error("tempo esgotado")), 12000))
    ]);
    data = r.data;
  }catch(e){
    return erroFatal("Não consegui falar com o Supabase (" + e.message + "). Confira se a URL do projeto está certa e se o projeto não está pausado por inatividade.");
  }
  if(!data.session){
    $("splash-txt").textContent = "criando sua sessão";
    const r = await sb.auth.signInAnonymously();
    if(r.error)
      return erroFatal("Não consegui abrir a sessão anônima. No Supabase: Authentication → Sign In / Providers → ligue \"Allow anonymous sign-ins\". Detalhe: " + r.error.message);
    data = { session:r.data.session };
  }
  usuario = data.session.user;
  selDia = hojeISO();
  calRef = { a:+selDia.slice(0,4), m:+selDia.slice(5,7) };
  dataAlvo = selDia;
  $("splash").hidden = true;
  $("app").hidden = false;
  $("nav").hidden = false;
  ligarEventos();
  await carregarTudo();
}

async function carregarTudo(){
  const [l,c,h,m,f,e] = await Promise.all([
    sb.from("lancamentos").select("*").order("data",{ascending:false}),
    sb.from("contas").select("*"),
    sb.from("habitos").select("*").order("bloco").order("ordem"),
    sb.from("habito_marcas").select("*"),
    sb.from("dias_fechados").select("*"),
    sb.from("eventos").select("*").order("data")
  ]);
  const err = [l,c,h,m,f,e].find(r=>r.error);
  if(err) return falhou(err.error);
  db.lancamentos = (l.data||[]).map(x=>({...x, valor:Number(x.valor)}));
  db.contas      = (c.data||[]).map(x=>({...x, valor:Number(x.valor||0)}));
  db.habitos     = h.data||[];
  db.marcas      = m.data||[];
  db.fechados    = (f.data||[]).map(x=>x.data);
  db.eventos     = e.data||[];
  render();
}

/* ================= cálculos ================= */
const gastoDia = d => db.lancamentos.filter(x=>x.data===d).reduce((s,x)=>s+x.valor,0);
const gastoMes = ym => db.lancamentos.filter(x=>mesDe(x.data)===ym).reduce((s,x)=>s+x.valor,0);
function acumulado(ym, ate){
  const a = +ym.slice(0,4), m = +ym.slice(5,7);
  const lim = ate || ultimoDia(a,m), out = []; let soma = 0;
  for(let d=1; d<=lim; d++){ soma += gastoDia(dataDoMes(a,m,d)); out.push(soma); }
  return out;
}
function mesAnterior(ym){
  const a = +ym.slice(0,4), m = +ym.slice(5,7);
  return m===1 ? `${a-1}-12` : `${a}-${String(m-1).padStart(2,"0")}`;
}
function vencimento(c){
  const h = hojeISO(), a = +h.slice(0,4), m = +h.slice(5,7);
  if(c.ultimo_pago === mesDe(h)){
    const mm = m===12?1:m+1, aa = m===12?a+1:a;
    return dataDoMes(aa,mm,c.dia);
  }
  return dataDoMes(a,m,c.dia);
}
const contasOrd = () => [...db.contas].sort((x,y)=>vencimento(x).localeCompare(vencimento(y)));
const marcasDe = id => db.marcas.filter(x=>x.habito_id===id).map(x=>x.data);
const temMarca = (id,d) => db.marcas.some(x=>x.habito_id===id && x.data===d);
function streakDe(lista){
  const set = new Set(lista); let b = hojeISO();
  if(!set.has(b)) b = somaDias(b,-1);
  let n = 0; while(set.has(b)){ n++; b = somaDias(b,-1); }
  return n;
}
const contasNoDia = d => { const a=+d.slice(0,4), m=+d.slice(5,7); return db.contas.filter(c=>dataDoMes(a,m,c.dia)===d); };
const eventosNoDia = d => db.eventos.filter(e=>e.data===d).sort((x,y)=>(x.hora||"99").localeCompare(y.hora||"99"));
function rankCategorias(ym){
  const soma = {};
  db.lancamentos.filter(x=>mesDe(x.data)===ym).forEach(x=>{ soma[x.categoria]=(soma[x.categoria]||0)+x.valor; });
  return Object.entries(soma).sort((a,b)=>b[1]-a[1]);
}
function corDaCategoria(cat){
  const i = rankCategorias(mesDe(hojeISO())).findIndex(([c])=>c===cat);
  return i < 0 ? "var(--linha-f)" : RAMPA[Math.min(i, RAMPA.length-1)];
}

/* ================= navegação ================= */
function irPara(nome){
  if(nome === viewAtual) return;
  const dir = ORDEM_VIEWS.indexOf(nome) > ORDEM_VIEWS.indexOf(viewAtual) ? "de-dir" : "de-esq";
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

/* ================= teclado ================= */
const valorAtual = () => digitos ? parseInt(digitos,10)/100 : 0;
function pintarMostrador(){
  const v = valorAtual(), el = $("mostrador");
  el.innerHTML = `<small>R$</small>${brl(v)}`;
  el.classList.toggle("zero", v<=0);
  $("btn-lancar").disabled = v<=0 || !catSel;
}
function tecla(k){
  if(k==="del") digitos = digitos.slice(0,-1);
  else if(digitos.length < 9) digitos += k;
  tocar(6); pintarMostrador();
}
function abrirLancamento(data){
  digitos = ""; catSel = null; dataAlvo = data || hojeISO();
  $("nota").value = ""; $("aviso").textContent = "";
  pintarChipsData(); pintarChipsCat(); pintarMostrador();
  abrirSheet("sheet-lanc");
}
function pintarChipsData(){
  const h = hojeISO();
  const op = [{d:h,r:"Hoje"},{d:somaDias(h,-1),r:"Ontem"},{d:somaDias(h,-2),r:curto(somaDias(h,-2))}];
  if(!op.some(o=>o.d===dataAlvo)) op.push({ d:dataAlvo, r:curto(dataAlvo) });
  $("chips-data").innerHTML = op.map(o=>`<button class="chip press ${o.d===dataAlvo?"sel":""}" data-d="${o.d}">${o.r}</button>`).join("");
  $("chips-data").querySelectorAll("button").forEach(b=> b.onclick = ()=>{ dataAlvo = b.dataset.d; tocar(); pintarChipsData(); });
}
function pintarChipsCat(){
  $("chips-cat").innerHTML = CATEGORIAS.map(c=>`<button class="chip press ${c===catSel?"sel":""}" data-c="${esc(c)}">${esc(c)}</button>`).join("");
  $("chips-cat").querySelectorAll("button").forEach(b=> b.onclick = ()=>{ catSel = b.dataset.c; tocar(); pintarChipsCat(); pintarMostrador(); });
}

/* ================= gráficos ================= */
function svgRitmo(){
  const h = hojeISO(), ym = mesDe(h), dia = +h.slice(8,10);
  const atual = acumulado(ym, dia), ant = acumulado(mesAnterior(ym));
  const W=100, H=46, pad=2;
  const nMax = Math.max(atual.length, ant.length, 2);
  const vMax = Math.max(...atual, ...ant, 1);
  const px = i => pad + (i/(nMax-1))*(W-pad*2);
  const py = v => H - pad - (v/vMax)*(H-pad*2);
  const linha = arr => arr.map((v,i)=>`${px(i).toFixed(2)},${py(v).toFixed(2)}`).join(" ");
  const temAnt = ant.some(v=>v>0);
  if(!atual.some(v=>v>0) && !temAnt){ $("leg-ritmo").innerHTML=""; return '<div class="vazio">Sem gastos para desenhar ainda.</div>'; }
  $("leg-ritmo").innerHTML = '<span style="color:var(--laranja)">■ este mês</span> &nbsp; <span style="color:#8A8A8A">■ anterior</span>';
  return `<svg viewBox="0 0 ${W} ${H+9}" width="100%" height="170" preserveAspectRatio="none" role="img" aria-label="Gasto acumulado do mês">
    ${[0.5,1].map(f=>`<line x1="${pad}" y1="${py(vMax*f).toFixed(2)}" x2="${W-pad}" y2="${py(vMax*f).toFixed(2)}" stroke="#2E2E2E" stroke-width=".35"/>`).join("")}
    ${temAnt?`<polyline points="${linha(ant)}" fill="none" stroke="#8A8A8A" stroke-width=".7" stroke-dasharray="1.6 1.4" vector-effect="non-scaling-stroke"/>`:""}
    <polygon points="${pad},${H-pad} ${linha(atual)} ${px(atual.length-1).toFixed(2)},${H-pad}" fill="${LARANJA}" fill-opacity=".16"/>
    <polyline points="${linha(atual)}" fill="none" stroke="${LARANJA}" stroke-width="1.3" stroke-linejoin="miter" vector-effect="non-scaling-stroke"/>
    <rect x="${(px(atual.length-1)-1).toFixed(2)}" y="${(py(atual[atual.length-1])-1).toFixed(2)}" width="2" height="2" fill="${LARANJA}"/>
    <text class="eixo" x="${pad}" y="${H+6}">DIA 1</text>
    <text class="eixo" x="${W-pad}" y="${H+6}" text-anchor="end">DIA ${nMax}</text>
    <text class="eixo" x="${pad}" y="${(py(vMax)-1).toFixed(2)}">R$ ${brl0(vMax)}</text></svg>`;
}

function svgDonut(){
  const pares = rankCategorias(mesDe(hojeISO()));
  if(!pares.length){ $("leg-donut").innerHTML=""; return '<div class="vazio">Nenhum gasto categorizado este mês.</div>'; }
  const total = pares.reduce((s,[,v])=>s+v,0), R=42, C=2*Math.PI*R;
  let off = 0;
  const arcos = pares.map(([c,v],i)=>{
    const len = (v/total)*C;
    const el = `<circle cx="60" cy="60" r="${R}" fill="none" stroke="${RAMPA[Math.min(i,RAMPA.length-1)]}" stroke-width="16"
      stroke-dasharray="${Math.max(len-1.5,.5).toFixed(2)} ${(C-len+1.5).toFixed(2)}" stroke-dashoffset="${(-off).toFixed(2)}" transform="rotate(-90 60 60)"/>`;
    off += len; return el;
  }).join("");
  $("leg-donut").innerHTML = pares.slice(0,6).map(([c,v],i)=>
    `<div><span class="b" style="background:${RAMPA[Math.min(i,RAMPA.length-1)]}"></span><span class="n">${esc(c)}</span><span class="v">${Math.round(v/total*100)}%</span></div>`).join("");
  return `<svg viewBox="0 0 120 120" width="100%" height="152" role="img" aria-label="Gastos por categoria">${arcos}
    <text x="60" y="56" text-anchor="middle" fill="#9A9A9A" style="font-family:var(--mono);font-size:7.5px;font-weight:700;letter-spacing:.16em">MÊS</text>
    <text x="60" y="71" text-anchor="middle" fill="#F2F2F2" style="font-family:var(--disp);font-weight:900;font-size:16px">R$ ${brl0(total)}</text></svg>`;
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

  $("hero-val").innerHTML = `<small>R$</small>${brl(gastoDia(h))}`;
  const totMes = gastoMes(ym);
  $("hero-mes").textContent = `mês: R$ ${brl0(totMes)}`;

  const antAcum = acumulado(mesAnterior(ym), dia);
  const baseAnt = antAcum.length ? antAcum[antAcum.length-1] : 0;
  const hr = $("hero-ritmo");
  if(baseAnt<=0){ hr.textContent = "sem base anterior"; hr.style.color=""; hr.style.borderColor=""; }
  else{
    const p = Math.round((totMes/baseAnt-1)*100);
    hr.textContent = `${p>0?"+":""}${p}% vs. mês passado`;
    hr.style.color = p>0 ? "var(--laranja)" : "var(--fraco)";
    hr.style.borderColor = p>0 ? "var(--laranja)" : "var(--linha-f)";
  }

  $("k-mes").textContent = "R$ " + brl(totMes);
  $("k-mes-sub").textContent = `projeção: R$ ${brl0(totMes/dia*ultimoDia(+ym.slice(0,4),+ym.slice(5,7)))}`;
  if(baseAnt<=0){ $("k-ritmo").textContent="—"; $("k-ritmo").style.color=""; $("k-ritmo-sub").textContent="sem base anterior"; }
  else{
    const p = Math.round((totMes/baseAnt-1)*100);
    $("k-ritmo").textContent = (p>0?"+":"")+p+"%";
    $("k-ritmo").style.color = p>0 ? "var(--laranja)" : "var(--fraco)";
    $("k-ritmo-sub").textContent = `dia ${dia} do mês passado: R$ ${brl0(baseAnt)}`;
  }

  renderRotina(); renderContas(); renderLancamentos();
  renderCalendario(); renderProximosEventos();
  $("g-ritmo").innerHTML = svgRitmo();
  $("g-donut").innerHTML = svgDonut();
  if(!$("sheet-dia").hidden) renderDetalheDia();
}

/* ---- rotina com bloco concluído colapsado ---- */
function renderRotina(){
  const h = hojeISO(), box = $("rotina");
  box.innerHTML = "";
  $("h-seed").hidden = db.habitos.length > 0;
  if(!db.habitos.length){
    box.innerHTML = '<div class="vazio">Rotina vazia. Use a lista pronta e apague o que não servir — cortar é mais fácil que inventar.</div>';
    $("rot-cont").textContent = ""; return;
  }
  $("rot-cont").textContent = `${db.habitos.filter(x=>temMarca(x.id,h)).length}/${db.habitos.length}`;

  BLOCOS.forEach(bl=>{
    const itens = db.habitos.filter(x=>x.bloco===bl.id);
    if(!itens.length) return;
    const feitos = itens.filter(x=>temMarca(x.id,h)).length;
    const pronto = feitos === itens.length;
    const expandido = !pronto || abertos.has(bl.id);

    const sec = document.createElement("div");
    sec.className = "bloco" + (pronto?" pronto":"");

    const cab = document.createElement("button");
    cab.className = "bloco-cab press";
    cab.setAttribute("aria-expanded", String(expandido));
    cab.innerHTML = `<span class="nome">${bl.nome}${pronto?" ✓":""}</span>
      <span class="prog"><i style="width:${Math.round(feitos/itens.length*100)}%"></i></span>
      <span class="prog-n">${feitos}/${itens.length}</span>
      <span class="seta">${expandido?"▾":"▸"}</span>`;
    cab.onclick = ()=>{
      if(abertos.has(bl.id)) abertos.delete(bl.id); else abertos.add(bl.id);
      tocar(); renderRotina();
    };
    sec.appendChild(cab);

    if(expandido){
      itens.forEach(hb=>{
        const on = temMarca(hb.id,h);
        const li = document.createElement("button");
        li.className = "hab press" + (on?" on":"");
        li.setAttribute("aria-pressed", String(on));
        const ms = marcasDe(hb.id);
        let fita = ""; for(let i=13;i>=0;i--) fita += `<i class="${ms.includes(somaDias(h,-i))?"on":""}"></i>`;
        li.innerHTML = `<span class="marca">✓</span><span class="nome">${esc(hb.nome)}</span><span class="fita">${fita}</span>`;
        li.onclick = ()=>alternarHabito(hb, on);
        sec.appendChild(li);
      });
    }
    box.appendChild(sec);
  });
}

function renderContas(){
  const h = hojeISO(), lc = $("lista-contas");
  lc.innerHTML = "";
  if(!db.contas.length){ lc.innerHTML = '<li class="vazio">Sem contas. Comece pelas fixas: aluguel, internet, cartão.</li>'; return; }
  contasOrd().slice(0,6).forEach(c=>{
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
  const h = hojeISO(), ll = $("lista-lanc");
  ll.innerHTML = "";
  $("cont-hoje").textContent = db.lancamentos.filter(x=>x.data===h).length + " hoje";
  const ult = db.lancamentos.slice(0,7);
  if(!ult.length){ ll.innerHTML = '<li class="vazio">Nada lançado. Toque no + e comece pelo último gasto que você lembra.</li>'; return; }
  ult.forEach(l=>{
    const li = document.createElement("li"); li.className = "item";
    li.innerHTML = `<span class="barra-cat" style="background:${corDaCategoria(l.categoria)}"></span>
      <span class="nome">${esc(l.categoria)}${l.nota?' <span style="color:var(--fraco)">· '+esc(l.nota)+'</span>':""}</span>
      <span class="tag">${l.data===h?"hoje":curto(l.data)}</span>
      <span class="cifra">R$ ${brl(l.valor)}</span>`;
    const x = document.createElement("button"); x.className = "x press"; x.textContent = "✕";
    x.onclick = ()=>apagar("lancamentos", l.id, ()=>{ db.lancamentos = db.lancamentos.filter(z=>z.id!==l.id); });
    li.appendChild(x); ll.appendChild(li);
  });
}

/* ---- calendário: forma em vez de cor ---- */
function renderCalendario(){
  const { a, m } = calRef, h = hojeISO(), ymCal = `${a}-${String(m).padStart(2,"0")}`;
  $("cal-mes").textContent = new Date(a, m-1, 1).toLocaleDateString("pt-BR",{month:"short",year:"numeric"}).replace(/\./g,"");
  const primeiro = new Date(a, m-1, 1);
  const inicio = somaDias(isoDe(primeiro), -primeiro.getDay());
  const dias = []; for(let i=0;i<42;i++) dias.push(somaDias(inicio,i));
  const vals = dias.filter(d=>mesDe(d)===ymCal).map(gastoDia).filter(v=>v>0).sort((x,y)=>x-y);
  const q = p => vals.length ? vals[Math.min(vals.length-1, Math.floor(vals.length*p))] : 0;
  const q1=q(.33), q2=q(.66), q3=q(.9);
  const cal = $("cal"); cal.innerHTML = "";
  dias.forEach(d=>{
    const fora = mesDe(d) !== ymCal, v = gastoDia(d);
    const op = v<=0?0 : v<=q1?.22 : v<=q2?.4 : v<=q3?.62 : .85;
    const b = document.createElement("button");
    b.className = "dia press"
      + (fora?" fora":"") + (d===h?" hoje":"") + (v>0?" gastou":"")
      + (contasNoDia(d).length?" conta":"") + (eventosNoDia(d).length?" evento":"");
    const marcas = [];
    if(v>0) marcas.push(`gastou R$ ${brl(v)}`);
    if(contasNoDia(d).length) marcas.push("conta vence");
    if(eventosNoDia(d).length) marcas.push("compromisso");
    if(db.fechados.includes(d)) marcas.push("dia fechado");
    b.setAttribute("aria-label", `${extenso(d)}${marcas.length?" · "+marcas.join(", "):""}`);
    b.innerHTML = `<span class="fundo" style="opacity:${op}"></span><span class="n">${+d.slice(8,10)}</span>`
      + (db.fechados.includes(d) ? '<span class="sub"></span>' : "");
    b.onclick = ()=>{ selDia = d; tocar(); renderDetalheDia(); abrirSheet("sheet-dia"); };
    cal.appendChild(b);
  });
}

function renderProximosEventos(){
  const h = hojeISO(), le = $("lista-eventos");
  le.innerHTML = "";
  const prox = db.eventos.filter(e=>e.data>=h)
    .sort((x,y)=>(x.data+(x.hora||"99")).localeCompare(y.data+(y.hora||"99"))).slice(0,8);
  if(!prox.length){ le.innerHTML = '<li class="vazio">Nada marcado. Toque num dia do calendário para adicionar.</li>'; return; }
  prox.forEach(ev=>{
    const d = diasEntre(h, ev.data);
    const li = document.createElement("li"); li.className = "item";
    li.innerHTML = `<span class="tag ${d<=1?"perto":""}">${d===0?"hoje":d===1?"amanhã":curto(ev.data)}</span>
      <span class="nome">${esc(ev.titulo)}</span><span class="cifra">${ev.hora?ev.hora.slice(0,5):""}</span>`;
    const x = document.createElement("button"); x.className = "x press"; x.textContent = "✕";
    x.onclick = ()=>apagar("eventos", ev.id, ()=>{ db.eventos = db.eventos.filter(z=>z.id!==ev.id); });
    li.appendChild(x); le.appendChild(li);
  });
}

function renderDetalheDia(){
  const d = selDia, h = hojeISO();
  $("dia-titulo").textContent = d===h ? "Hoje" : extenso(d,{weekday:"long",day:"2-digit",month:"long"});
  $("dia-total").innerHTML = `<small>R$</small>${brl(gastoDia(d))}`;

  const dl = $("dia-lanc"); dl.innerHTML = "";
  const ls = db.lancamentos.filter(x=>x.data===d);
  if(!ls.length) dl.innerHTML = '<li class="vazio">Nenhum gasto neste dia.</li>';
  ls.forEach(l=>{
    const li = document.createElement("li"); li.className = "item";
    li.innerHTML = `<span class="barra-cat" style="background:${corDaCategoria(l.categoria)}"></span>
      <span class="nome">${esc(l.categoria)}${l.nota?' <span style="color:var(--fraco)">· '+esc(l.nota)+'</span>':""}</span>
      <span class="cifra">R$ ${brl(l.valor)}</span>`;
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
    li.innerHTML = `<span class="tag">${ev.hora?ev.hora.slice(0,5):"dia todo"}</span><span class="nome">${esc(ev.titulo)}</span>`;
    const x = document.createElement("button"); x.className = "x press"; x.textContent = "✕";
    x.onclick = ()=>apagar("eventos", ev.id, ()=>{ db.eventos = db.eventos.filter(z=>z.id!==ev.id); });
    li.appendChild(x); de.appendChild(li);
  });
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
  const { data, error } = await sb.from("lancamentos")
    .insert({ user_id:usuario.id, data:dataAlvo, valor:v, categoria:catSel, nota:$("nota").value.trim() })
    .select().single();
  if(error) return falhou(error);
  db.lancamentos.unshift({...data, valor:Number(data.valor)});
  db.lancamentos.sort((a,b)=>b.data.localeCompare(a.data));
  tocar(14); fecharSheets(); render();
  toast(`R$ ${brl(v)} · ${dataAlvo===hojeISO()?"hoje":curto(dataAlvo)}`);
}
async function pagarConta(c){
  const mes = mesDe(vencimento(c));
  const { error } = await sb.from("contas").update({ ultimo_pago:mes }).eq("id", c.id);
  if(error) return falhou(error);
  c.ultimo_pago = mes;
  if(c.valor > 0){
    const { data, error:e2 } = await sb.from("lancamentos")
      .insert({ user_id:usuario.id, data:hojeISO(), valor:c.valor, categoria:"Contas", nota:c.nome }).select().single();
    if(e2) return falhou(e2);
    db.lancamentos.unshift({...data, valor:Number(data.valor)});
  }
  tocar(14); render(); toast(`${c.nome} quitada`);
}
async function alternarHabito(hb, estavaOn){
  tocar(estavaOn?6:12);
  if(estavaOn){
    const marca = db.marcas.find(x=>x.habito_id===hb.id && x.data===hojeISO());
    if(!marca) return;
    const { error } = await sb.from("habito_marcas").delete().eq("id", marca.id);
    if(error) return falhou(error);
    db.marcas = db.marcas.filter(x=>x.id!==marca.id);
  }else{
    const { data, error } = await sb.from("habito_marcas")
      .insert({ user_id:usuario.id, habito_id:hb.id, data:hojeISO() }).select().single();
    if(error) return falhou(error);
    db.marcas.push(data);
  }
  render();
}
async function fecharDia(){
  const h = hojeISO();
  const { error } = await sb.from("dias_fechados").insert({ user_id:usuario.id, data:h });
  if(error) return falhou(error);
  db.fechados.push(h);
  tocar(18); render(); toast(`dia fechado · ${streakDe(db.fechados)}d seguidos`);
}
async function semearRotina(){
  const linhas = ROTINA_PRONTA.map((r,i)=>({ user_id:usuario.id, nome:r.nome, bloco:r.bloco, ordem:i }));
  const { data, error } = await sb.from("habitos").insert(linhas).select();
  if(error) return falhou(error);
  db.habitos = data; render(); toast("rotina criada");
}

/* ================= eventos de UI ================= */
function ligarEventos(){
  document.querySelectorAll(".nav .aba").forEach(a=> a.onclick = ()=>irPara(a.dataset.view));
  $("fab").onclick = ()=>{ tocar(10); abrirLancamento(hojeISO()); };
  $("btn-dia").onclick = fecharDia;
  $("h-seed").onclick = semearRotina;
  $("cal-ant").onclick = ()=>{ calRef.m--; if(calRef.m<1){calRef.m=12;calRef.a--;} tocar(); renderCalendario(); };
  $("cal-prox").onclick = ()=>{ calRef.m++; if(calRef.m>12){calRef.m=1;calRef.a++;} tocar(); renderCalendario(); };
  $("veu").onclick = fecharSheets;
  $("lanc-fechar").onclick = fecharSheets;
  $("dia-fechar").onclick = fecharSheets;
  document.addEventListener("keydown", e=>{ if(e.key==="Escape") fecharSheets(); });
  document.querySelectorAll(".tecla").forEach(t=> t.onclick = ()=>tecla(t.dataset.k));
  $("btn-lancar").onclick = lancar;
  $("dia-lancar").onclick = ()=>{ fecharSheets(); setTimeout(()=>abrirLancamento(selDia), 260); };

  $("c-add").onclick = async ()=>{
    const nome = $("c-nome").value.trim(), dia = parseInt($("c-dia").value,10);
    if(!nome || !dia) return toast("preencha nome e dia", true);
    const { data, error } = await sb.from("contas")
      .insert({ user_id:usuario.id, nome, dia:Math.min(Math.max(dia,1),31), valor:numBR($("c-valor").value) }).select().single();
    if(error) return falhou(error);
    db.contas.push({...data, valor:Number(data.valor||0)});
    ["c-nome","c-dia","c-valor"].forEach(k=>$(k).value="");
    render(); toast("conta cadastrada");
  };

  $("e-add").onclick = async ()=>{
    const titulo = $("e-titulo").value.trim();
    if(!titulo) return;
    const { data, error } = await sb.from("eventos")
      .insert({ user_id:usuario.id, data:selDia, hora:$("e-hora").value || null, titulo }).select().single();
    if(error) return falhou(error);
    db.eventos.push(data);
    $("e-titulo").value = ""; $("e-hora").value = "";
    render(); toast("compromisso marcado");
  };

  $("btn-export").onclick = ()=>{
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(db,null,2)],{type:"application/json"}));
    a.download = `nexvot-backup-${hojeISO()}.json`; a.click();
  };

  let x0 = null, y0 = null;
  document.addEventListener("touchstart", e=>{
    if(!$("sheet-lanc").hidden || !$("sheet-dia").hidden) return;
    x0 = e.touches[0].clientX; y0 = e.touches[0].clientY;
  }, { passive:true });
  document.addEventListener("touchend", e=>{
    if(x0===null) return;
    const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0;
    x0 = null;
    if(Math.abs(dx) < 62 || Math.abs(dy) > Math.abs(dx)*0.7) return;
    const i = ORDEM_VIEWS.indexOf(viewAtual) + (dx < 0 ? 1 : -1);
    if(i >= 0 && i < ORDEM_VIEWS.length) irPara(ORDEM_VIEWS[i]);
  }, { passive:true });
}

window.addEventListener("unhandledrejection", e=>{
  if(document.getElementById("splash").hidden) return;
  erroFatal("Erro não tratado: " + ((e.reason && e.reason.message) || e.reason));
});

boot().catch(e => erroFatal("Falha ao iniciar: " + e.message));
