import { INFO } from "./data/entities.js";
import { ITEMS, MISSIONS } from "./data/items.js";
import { kindFor, drawShape, paint, miniSvg, tmLayout, markup } from "./engine/shapes.js";
import { load, save, clear } from "./engine/store.js";
import { INCELL } from "./data/rules.js";
import { QUIZ } from "./data/quiz.js";
import * as Quiz from "./ui/quiz.js";
import { mountEnzymeLab } from "./views/enzymelab.js";
import { mountGeneBench } from "./views/genebench.js";
const saved = load();

const NS = "http://www.w3.org/2000/svg";
const svg = document.getElementById("cell");
const $ = id => document.getElementById(id);
const C = {gen:"#c59bff", sig:"#4fd8c8", nrg:"#ff9466", bio:"#7dc3ff", endo:"#ff74ad"};
const CN = {gen:"Genetics", sig:"Signal transduction", nrg:"Cellular energetics", bio:"Biochemistry", endo:"Endomembrane"};
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
let SPD = 1;


const ITEM = {}; ITEMS.forEach(g => g.list.forEach(i => { i.c = g.c; ITEM[i.key] = i; }));
const done = new Set((saved.done || []).filter(k => MISSIONS.some(m => m[0] === k)));
let guidedMode = !!saved.guided;
const scores = (saved.scores && typeof saved.scores === "object") ? saved.scores : {};
function persist(){ save({ done:[...done], speed:SPD, guided:guidedMode, scores }); }

/* ---------------- svg helpers ---------------- */
function el(tag, attrs={}, parent){
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(e);
  return e;
}
const L = {amb:$("ambient"), bg:$("bgfx"), fixed:$("fixed"), fx:$("fx"), hints:$("hints"), tags:$("tags")};

function tok(label, color, x, y, info, layer=L.fx){
  const g = el("g", {class:"tok"}, layer);
  if (info) g.setAttribute("data-info", info);
  const kind = kindFor(info, label);
  const s = el("g", {class:"shape"}, g), geo = {r: drawShape(s, kind, info || label)};
  g.insertBefore(el("circle", {class:"hit", r:(geo.r + 6).toFixed(1)}), s);
  const t = el("text", kind==="bead" ? {y:3.5, "text-anchor":"middle", class:"in"} : {y:geo.r+11, "text-anchor":"middle", class:"cap"}, g);
  const T = {g, s, t, x, y, color, kind};
  setColor(T, color); setLabel(T, label); place(T, x, y);
  return T;
}
function setLabel(T, s){ T.t.textContent = s; T.label = s; }
function setColor(T, c){ paint(T.s, c); T.color = c; }
function place(T, x, y){ T.x = x; T.y = y; T.g.setAttribute("transform", `translate(${x},${y})`); }
const ease = t => t<.5 ? 2*t*t : 1-Math.pow(-2*t+2,2)/2;
function dur(ms){ return reduced ? ms*0.25 : ms/SPD; }
function wait(ms){ return new Promise(r => setTimeout(r, dur(ms))); }
function move(T, x, y, ms=700){
  if (T.g.parentNode === L.fx || T.g.parentNode === L.fixed) noteFocus(x, y);
  const x0=T.x, y0=T.y, d=dur(ms), t0=performance.now();
  return new Promise(res => {
    function f(now){ const k = Math.min(1,(now-t0)/d), e = ease(k);
      place(T, x0+(x-x0)*e, y0+(y-y0)*e); if (k<1) requestAnimationFrame(f); else res(); }
    requestAnimationFrame(f);
  });
}
async function path(T, pts, ms=500){ for (const [x,y] of pts) await move(T,x,y,ms); }
/* Products of reactions stay in the cell (as drifting molecules) instead of vanishing. */
const settled = [], SETTLE_MAX = 260;
function keepable(T){ return T.g.parentNode === L.fx && T.g.isConnected && !/^(e⁻|P|hydrolysis…)$/.test(T.label) && !/×/.test(T.label); }
function settle(T){
  L.amb.appendChild(T.g); T.g.setAttribute("opacity", .9);
  const a = { T, box:[T.x-45, T.y-30, T.x+45, T.y+30], vx:(Math.random()-.5)*.15, vy:(Math.random()-.5)*.15,
    label:T.label, color:T.color, info:T.g.getAttribute("data-info"), speed:.15, settled:true };
  AMB.push(a); settled.push(a);
  if (settled.length > SETTLE_MAX){ const old = settled.shift(), i = AMB.indexOf(old); if (i >= 0) AMB.splice(i, 1); old.T.g.remove(); }
}
function fade(T, ms=500){
  if (keepable(T)){ settle(T); return Promise.resolve(); }
  const d = dur(ms), t0 = performance.now();
  return new Promise(res => { function f(now){ const k=Math.min(1,(now-t0)/d); T.g.setAttribute("opacity", 1-k); if(k<1) requestAnimationFrame(f); else { T.g.remove(); res(); } } requestAnimationFrame(f); });
}
function moveEl(node, fromXY, toXY, ms){ // move a static group via transform
  const d = dur(ms), t0 = performance.now();
  return new Promise(res => { function f(now){ const k=Math.min(1,(now-t0)/d), e=ease(k);
    node.setAttribute("transform", `translate(${fromXY[0]+(toXY[0]-fromXY[0])*e},${fromXY[1]+(toXY[1]-fromXY[1])*e})`);
    if(k<1) requestAnimationFrame(f); else res(); } requestAnimationFrame(f); });
}
function setOpacity(node, v){ node.setAttribute("opacity", v); }
function pulseFill(node, color){ node.querySelectorAll("rect,path,circle").forEach(n => { if (n.getAttribute("fill") && n.getAttribute("fill")!=="none" && !n.classList.contains("ol") && !n.classList.contains("hl")) { n.dataset.f0 = n.dataset.f0 || n.getAttribute("fill"); n.setAttribute("fill", color); } }); }
function unpulse(node){ node.querySelectorAll("[data-f0]").forEach(n => n.setAttribute("fill", n.dataset.f0)); }

/* ---------------- build membrane + decorations ---------------- */
(function build(){
  const m = $("membrane");
  el("rect",{x:0,y:120,width:1200,height:40,fill:"#2b2a3f"},m);
  for (let x=4; x<1200; x+=11){
    el("line",{x1:x,y1:126,x2:x,y2:139,stroke:"#7d6f48","stroke-width":1.4},m);
    el("line",{x1:x,y1:141,x2:x,y2:154,stroke:"#7d6f48","stroke-width":1.4},m);
    el("circle",{cx:x,cy:124,r:4.6,fill:"#e2bd63",stroke:"#0a0d16","stroke-width":.8},m);
    el("circle",{cx:x,cy:156,r:4.6,fill:"#e2bd63",stroke:"#0a0d16","stroke-width":.8},m);
  }
  // crowded background (Goodsell-style), non-interactive
  const crowd = el("g",{"pointer-events":"none"}); svg.insertBefore(crowd, svg.querySelector(".lbl-big"));
  let sd = 7; const rnd = () => (sd = (sd*16807) % 2147483647) / 2147483647;
  const cyt = ["#202c55","#24315e","#1c284c","#283563","#222f58"], ext = ["#14404f","#174656","#123a49"];
  for (let i=0;i<300;i++) el("circle",{cx:rnd()*1200, cy:168+rnd()*585, r:2.5+rnd()*4, fill:cyt[i%5]},crowd);
  for (let i=0;i<90;i++) el("circle",{cx:rnd()*1200, cy:6+rnd()*108, r:2+rnd()*3.5, fill:ext[i%3]},crowd);
  // membrane proteins as space-filling atom clusters
  ['[data-info="nakpump"]',"#gpcr","#ac","#ado","#rtkL","#rtkR","#nachrL","#nachrR","#glut4","#glut1","#at1","#egfr","#aqp","#sglt","#prot26",
   'rect[data-info="c1"]','rect[data-info="c3"]','rect[data-info="c4"]'].forEach(sel => { const n = svg.querySelector(sel); if (n) atomize(n, sel); });
  m.appendChild(el("rect",{id:"depol",x:0,y:118,width:1200,height:44,fill:C.sig,opacity:0}));
  // nuclear pores
  const p = $("pores");
  [ -150, -110, -35, 20, 75, 140, 200 ].forEach(a => {
    const r = a*Math.PI/180, x = 260+195*Math.cos(r), y = 530+150*Math.sin(r);
    el("rect",{x:x-6,y:y-6,width:12,height:12,rx:3,fill:"#141d3b",stroke:"#b9a8ff","stroke-width":1.5,transform:`rotate(${a} ${x} ${y})`},p);
  });
  // ribosomes on RER
  const rr = $("rerRibo");
  [[488,404],[548,462],[556,500],[547,560],[530,620],[500,646],[598,450],[604,510],[598,575],[578,640],[640,470],[640,530],[630,600]].forEach(([x,y]) => el("circle",{cx:x+7,cy:y,r:4},rr));
})();

/* fixed actors (tokens that live in place) */
const F = {};
function fixed(key, label, color, x, y, info){ F[key] = tok(label, color, x, y, info, L.fixed); return F[key]; }
fixed("galpha","α · GDP","#7fe3d6",232,192,"galpha");
fixed("gbg","βγ","#5bc2b6",268,194,"gbg");
fixed("pka","PKA","#9fd8ff",385,245,"pka");
fixed("gp","glycogen phosphorylase","#9fd8ff",400,300,"gp");
// glycogen cluster
(function(){ const g = el("g",{"data-info":"glycogen"},L.fixed); [[0,0],[12,-6],[24,0],[6,10],[18,10],[30,10],[-6,10],[12,20],[24,20]].forEach(([dx,dy])=>el("circle",{cx:510+dx,cy:258+dy,r:6,fill:"#f6c66d",stroke:"#a77b26"},g)); el("text",{class:"lbl",x:522,y:300,"text-anchor":"middle"},g).textContent="glycogen"; })();
fixed("dock","docking protein","#ffd88a",640,235,"dock");
fixed("plc","PLC","#9fd8ff",445,197,"plc");
fixed("ras","Ras · GDP","#c9e7b0",548,214,"ras");
fixed("gr","glucocorticoid receptor","#d8c3ff",600,340,"gr");
fixed("ache","AChE","#9fd8ff",835,92,"ache");
fixed("hk","hexokinase","#9fd8ff",1110,222,"hk");
fixed("pfk","PFK","#9fd8ff",1035,222,"pfk");
fixed("ald","aldolase","#9fd8ff",965,222,"ald");
fixed("gapdh","G3P dehydrogenase","#9fd8ff",960,270,"gapdh");
fixed("pk","pyruvate kinase","#9fd8ff",960,318,"pk");
fixed("ldh","lactate dehydrogenase","#9fd8ff",1100,320,"ldh"); setOpacity(F.ldh.g,.35);

/* ---------------- ambient wanderers ---------------- */
const AMB = [];
function wander(label,color,info,box,n,speed=0.25){
  for (let i=0;i<n;i++){
    const x = box[0]+Math.random()*(box[2]-box[0]), y = box[1]+Math.random()*(box[3]-box[1]);
    const T = tok(label,color,x,y,info,L.amb); T.g.setAttribute("opacity",.85);
    AMB.push({T, box, vx:(Math.random()-.5)*speed, vy:(Math.random()-.5)*speed, label, color, info, speed});
  }
}
wander("Na⁺","#9ee7ff","na",[20,42,1180,82],9,.4);
wander("K⁺","#c9b3ff","k",[60,42,1150,82],3,.4);
wander("glucose","#ffc2a1","glucose",[900,45,1170,82],2,.25);
wander("O₂","#cfe9ff","o2",[200,45,700,82],2,.3);
wander("ATP","#ffd27a","atp",[60,180,460,360],3,.25);
wander("ADP","#d9b98a","adp",[680,580,840,660],2,.25);
wander("K⁺","#c9b3ff","k",[60,710,640,735],3,.35);
wander("ribosome","#e8c9ff","ribosome",[650,300,800,420],2,.2);
wander("NAD⁺","#ffe0c7","nad",[1150,560,1180,740],1,.2);
wander("ATP","#ffd27a","atp",[880,560,1010,740],2,.25);
wander("NADH","#ffe0c7","nadh",[875,400,1035,470],2,.15);
wander("mRNA",C.gen,"mrna",[470,300,640,360],1,.15);
wander("worn-out protein","#b9a38f","junk",[880,610,990,700],1,.12);
wander("protein","#9cc6ec","cprot",[110,205,450,360],2,.12);
wander("protein","#b5d99c","cprot",[470,700,1060,745],3,.12);
wander("ATP","#ffd27a","atp",[480,700,1180,745],3,.22);
wander("ribosome","#e8c9ff","ribosome",[700,610,860,680],2,.15);
wander("glucose","#ffc2a1","glucose",[300,40,880,82],3,.25);
let paused = false;
function tick(){
  if (!paused && !reduced){
    for (const a of AMB){
      if (a.held) continue;
      let {x,y} = a.T; x += a.vx*SPD; y += a.vy*SPD;
      if (x<a.box[0]||x>a.box[2]) a.vx*=-1; if (y<a.box[1]||y>a.box[3]) a.vy*=-1;
      if (Math.random()<.01){ a.vx += (Math.random()-.5)*.1; a.vy += (Math.random()-.5)*.1; }
      place(a.T, Math.max(a.box[0],Math.min(a.box[2],x)), Math.max(a.box[1],Math.min(a.box[3],y)));
    }
  }
  updateCam(); spinRotor();
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

/* ---------------- UI: info, log, toast, missions ---------------- */
function tagChips(cs){ return cs.map(c => `<span class="chip"><i style="background:${C[c]}"></i>${CN[c]}</span>`).join(""); }
function showInfo(key){
  const i = INFO[key]; if (!i) return;
  $("infocard").hidden = false;
  $("info").innerHTML = `<h2>Selected</h2><p class="info-name">${i.n}</p><div class="info-kind">${i.k}</div><p>${i.d}</p>${i.t?`<p class="try">${i.t}</p>`:""}<div class="tags">${tagChips(i.c)}</div>`;
}
let capTimer;
function logStep(c, text){
  const cap = $("caption"); cap.innerHTML = `<span class="t" style="color:${C[c]}">${CN[c]}</span>${text}`;
  cap.classList.add("show"); clearTimeout(capTimer); capTimer = setTimeout(() => cap.classList.remove("show"), 7000);
  const li = document.createElement("li");
  li.style.borderLeftColor = C[c];
  li.innerHTML = `<span class="t" style="color:${C[c]}">${CN[c]}</span>${text}`;
  const log = $("log"); log.prepend(li);
  while (log.children.length > 60) log.lastChild.remove();
}
let toastT;
function toast(msg){ const t=$("toast"); t.textContent = msg; t.classList.add("show"); clearTimeout(toastT); toastT = setTimeout(()=>t.classList.remove("show"), 4200); }
function renderMissions(){
  $("missions").innerHTML = MISSIONS.map(([k,t]) => `<li class="${done.has(k)?"done":""}" data-k="${k}" tabindex="0" role="button" title="Show me how"><b>${done.has(k)?"✓":""}</b><span>${t}</span></li>`).join("");
  $("mprog").textContent = `${done.size}/${MISSIONS.length}`;
}
function complete(k){ if (!done.has(k)){ done.add(k); persist(); renderMissions(); if (done.size===MISSIONS.length) toast(`All ${MISSIONS.length} missions done. You've walked through every pathway in this cell.`); } }
function nametag(key, x, y){
  const i = INFO[key]; if (!i) return;
  const t = el("text",{class:"nametag",x, y:y-16,"text-anchor":"middle"},L.tags); t.textContent = i.n;
  setTimeout(()=>t.remove(), 1600);
}

/* ---------------- gene readout ---------------- */
const CODONS = ["AUG","UUC","GGA","UGG","CAA","GAC","UAA"];
const AA = ["Met","Phe","Gly","Trp","Gln","Asp","Stop"];
const COMP = {A:"U",U:"A",G:"C",C:"G"};
let mut = null; // null | "silent" | "missense" | "nonsense" | "frameshift"
const MUTS = {
  silent:{c:["AUG","UUC","GGG","UGG","CAA","GAC","UAA"], a:["Met","Phe","Gly","Trp","Gln","Asp","Stop"], at:[2]},
  missense:{c:["AUG","UUC","GGA","UGG","CAA","GUC","UAA"], a:["Met","Phe","Gly","Trp","Gln","Val","Stop"], at:[5]},
  nonsense:{c:["AUG","UUC","GGA","UGA","CAA","GAC","UAA"], a:["Met","Phe","Gly","Stop","Gln","Asp","Stop"], at:[3]},
  frameshift:{c:["AUG","AUU","CGG","AUG","GCA","AGA","CUA"], a:["Met","Ile","Arg","Met","Ala","Arg","Leu"], at:[1,2,3,4,5,6]}
};
function mrna(){ return mut ? MUTS[mut].c.slice() : CODONS.slice(); }
function aas(){ return mut ? MUTS[mut].a.slice() : AA.slice(); }
function renderSeq(hi=-1, mode=""){
  const m = mrna(), a = aas();
  const tmpl = m.map(c => c.split("").map(b => ({A:"T",U:"A",G:"C",C:"G"})[b]).join(""));
  const cell = (s,i) => `<span class="c ${i===hi?"on":""} ${mut&&MUTS[mut].at.includes(i)?"mut":""}">${s}</span>`;
  const upto = mode==="tl" ? hi : (mode==="done"?99:-1);
  const stopAt = a.includes("Stop") ? a.indexOf("Stop") : 99;
  $("seq").innerHTML =
    `<div class="row"><span class="k">DNA template</span>3′ ${tmpl.map(cell).join("")} 5′</div>`+
    `<div class="row"><span class="k">mRNA</span>5′ ${m.map(cell).join("")} 3′</div>`+
    `<div class="row"><span class="k">Amino acids</span>${a.map((x,i)=>`<span class="c ${i===hi&&mode==="tl"?"on":""}" style="${i>upto||i>stopAt?"opacity:.35":""}">${x}</span>`).join("")}</div>`;
}
renderSeq();

/* ---------------- state ---------------- */
const lock = new Set();
const S = {oxygen:true, pfkUntil:0, adoBlockedUntil:0, uncoupled:false, glut4:false};
function busy(k){ if (lock.has(k)){ toast("That pathway is still running. Watch it finish, then try again."); return true; } lock.add(k); return false; }
function free(k){ lock.delete(k); }

/* ---------------- targets ---------------- */
const TG = {
  gpcr:{name:"β-adrenergic receptor", node:"gpcr", hit:(x,y)=>Math.hypot(x-200,y-135)<42},
  ado:{name:"adenosine receptor", node:"ado", hit:(x,y)=>Math.hypot(x-470,y-135)<42},
  rtk:{name:"insulin receptor", node:"rtk", hit:(x,y)=>Math.hypot(x-620,y-135)<46},
  nachr:{name:"acetylcholine receptor", node:"nachr", hit:(x,y)=>Math.hypot(x-770,y-135)<42},
  glut4:{name:"GLUT4 transporter", node:"glut4", hit:(x,y)=>S.glut4 && Math.hypot(x-880,y-135)<36},
  glut1:{name:"GLUT1 transporter", node:"glut1", hit:(x,y)=>Math.hypot(x-1110,y-135)<42},
  at1:{name:"AT1 receptor", hit:(x,y)=>Math.hypot(x-400,y-135)<28},
  egfr:{name:"EGF receptor", hit:(x,y)=>Math.hypot(x-545,y-130)<28},
  aqp:{name:"aquaporin", hit:(x,y)=>Math.hypot(x-700,y-140)<28},
  sglt:{name:"Na⁺–glucose symporter", hit:(x,y)=>Math.hypot(x-960,y-140)<30},
  pit:{name:"coated pit", hit:(x,y)=>Math.hypot(x-1035,y-140)<32},
  ras:{name:"Ras", hit:(x,y)=>Math.hypot(x-548,y-214)<24},
  pfk:{name:"PFK enzyme", node:null, hit:(x,y)=>Math.hypot(x-1035,y-222)<30},
  nakpump:{name:"Na⁺/K⁺ pump", hit:(x,y)=>Math.hypot(x-80,y-140)<34},
  ac:{name:"adenylyl cyclase", hit:(x,y)=>Math.hypot(x-330,y-150)<32},
  hk:{name:"hexokinase", hit:(x,y)=>Math.hypot(x-1110,y-222)<28},
  gapdh:{name:"G3P dehydrogenase", hit:(x,y)=>Math.hypot(x-960,y-270)<28},
  c1:{name:"complex I", hit:(x,y)=>Math.hypot(x-915,y-504)<22},
  atpsyn:{name:"ATP synthase", hit:(x,y)=>Math.hypot(x-1075,y-490)<26},
  mito:{name:"mitochondrion", node:"mito", hit:(x,y)=>x>838&&x<1162&&y>368&&y<526},
  lyso:{name:"lysosome", node:"lyso", hit:(x,y)=>Math.hypot(x-1080,y-655)<52},
  gene:{name:"gene", node:"gene", hit:(x,y)=>Math.abs(x-300)<62&&Math.abs(y-520)<30},
  nucleus:{name:"nucleus", node:"nucleus", hit:(x,y)=>((x-260)/200)**2+((y-530)/155)**2<1},
  rer:{name:"rough ER", node:"rer", hit:(x,y)=>x>470&&x<650&&y>375&&y<690},
  golgi:{name:"Golgi apparatus", node:"golgi", hit:(x,y)=>x>680&&x<835&&y>460&&y<620},
  membrane:{name:"plasma membrane", node:null, hit:(x,y)=>y>=98&&y<=176},
  outside:{name:"extracellular fluid", node:null, hit:(x,y)=>y<98},
  cyto:{name:"cytoplasm", node:null, hit:(x,y)=>y>176}
};
const ORDER = ["gpcr","at1","ado","egfr","rtk","aqp","nachr","glut4","sglt","pit","glut1","ras","pfk","nakpump","ac","hk","gapdh","c1","atpsyn","mito","lyso","gene","nucleus","rer","golgi","membrane","outside","cyto"];
function targetAt(x,y){ return ORDER.find(k => TG[k].hit(x,y)); }

const VALID = {
  epi:["gpcr"], adenosine:["ado"], caffeine:["ado"], insulin:["rtk"], ach:["nachr"],
  cortisol:["gpcr","ado","rtk","nachr","glut4","glut1","membrane","pfk","mito","lyso","gene","nucleus","rer","golgi","cyto"],
  glucose:["glut1","glut4"], ucp1item:["mito"], xatp:["pfk"], tetra:["rer"], mutation:["gene"], junk:["lyso"],
  silent:["gene"], missense:["gene"], frameshift:["gene"], highnrg:["mito"],
  angio:["at1"], egf:["egfr"], norad:["gpcr"], rasmut:["ras","egfr"], adh:["aqp"], ldl:["pit"]
};
const HINT_POS = {gpcr:[200,135],ado:[470,135],rtk:[620,135],nachr:[770,135],glut4:[880,135],glut1:[1110,135],pfk:[1035,222],mito:[1000,447],lyso:[1080,655],gene:[300,520],rer:[560,520],nakpump:[80,140],ac:[330,150],hk:[1110,222],gapdh:[960,270],c1:[915,504],atpsyn:[1075,490],at1:[400,135],egfr:[545,130],aqp:[700,140],sglt:[960,140],pit:[1035,140],ras:[548,214]};
function showHints(key, inCell){
  clearHints();
  (inCell ? cellTargets(key) : (VALID[key]||[])).forEach(k => { const p = HINT_POS[k]; if (!p || (k==="glut4"&&!S.glut4)) return;
    el("circle",{class:"target-hint",cx:p[0],cy:p[1],r:k==="mito"?95:k==="rer"?80:46,fill:"none",stroke:"#ffd27a","stroke-width":3,"stroke-dasharray":"7 6"},L.hints); });
}
function clearHints(){ L.hints.innerHTML = ""; }

/* ---------------- drop dispatcher ---------------- */
const POLAR = {epi:1, insulin:1, ach:1, adenosine:1, caffeine:1, glucose:1, angio:1, egf:1, norad:1, adh:1, ldl:1};
function drop(key, x, y){
  const t = targetAt(x,y);
  if (!t){ return; }
  if ((VALID[key]||[]).includes(t) || ((key==="cortisol" || TAGS[key]) && t!=="outside" && t!=="membrane")) return guided(key, () => RUN[key](t, x, y));
  // teaching feedback for wrong drops
  const it = INFO[key].n, tn = TG[t].name;
  if (t==="outside") return toast(`${it} is floating outside the cell now, but nothing happens until it reaches its target. ${INFO[key].t||""}`);
  if (POLAR[key] && (t==="membrane" || t==="cyto" || t==="nucleus" || t==="rer" || t==="golgi" || t==="mito" || t==="lyso" || t==="gene"))
    return toast(`${it} is polar, so it can't diffuse through the lipid bilayer to reach the ${tn}. It needs a membrane protein. ${INFO[key].t||""}`);
  if (["gpcr","ado","rtk","nachr"].includes(t) && POLAR[key])
    return toast(`Receptors are specific: the ${tn}'s binding site doesn't fit ${it}. ${INFO[key].t||""}`);
  if (key==="glucose") return toast("Glucose needs a glucose transporter (GLUT1, or GLUT4 after insulin).");
  if (key==="mutation") return toast("A mutation changes DNA. Drop it right on the target gene inside the nucleus.");
  if (key==="tetra" && t!=="rer") return toast("Tetracycline acts on ribosomes. Drop it on the rough ER, where ribosomes are attached.");
  toast(`${it} has no effect on the ${tn}. ${INFO[key].t||""}`);
}

/* ---------------- pathways ---------------- */
const RUN = {};

RUN.epi = async () => {
  if (busy("epi")) return;
  const lig = tok("epinephrine", C.sig, 200, 60, "epi");
  await move(lig, 200, 104, 800);
  pulseFill($("gpcr"), "#7ff7e8");
  logStep("sig", "<b>Reception.</b> Epinephrine, the first messenger, binds the β-adrenergic receptor. The 7-helix GPCR changes shape.");
  await wait(600);
  setLabel(F.galpha, "α · GTP"); setColor(F.galpha, "#b8fff5");
  logStep("sig", "<b>Transduction.</b> The receptor activates its trimeric G protein: GDP is swapped for GTP and the α subunit separates from βγ.");
  await move(F.galpha, 318, 192, 900);
  pulseFill($("ac"), "#6fe8da");
  logStep("bio", "The α subunit activates <b>adenylyl cyclase</b>, which converts ATP into <b>cAMP</b>, the second messenger.");
  const camps = [];
  for (let i=0;i<6;i++){ const c = tok("cAMP", "#bff4ff", 330, 200, "camp"); camps.push(c); move(c, 360+Math.random()*50, 225+Math.random()*30, 700); await wait(150); }
  logStep("sig", "<b>Amplification.</b> One activated enzyme makes many cAMP molecules.");
  await wait(500);
  setColor(F.pka, "#ffd27a"); setLabel(F.pka, "PKA active");
  logStep("bio", "cAMP activates <b>protein kinase A</b>, a kinase that transfers phosphates from ATP onto other proteins.");
  const P = tok("P", "#ffd27a", 385, 245); await move(P, 400, 288, 600); await fade(P, 200);
  setColor(F.gp, "#ffd27a"); setLabel(F.gp, "glycogen phosphorylase · P");
  logStep("sig", "The phosphorylation cascade activates <b>glycogen phosphorylase</b>.");
  await wait(400);
  const g1p = [];
  for (let i=0;i<5;i++){ const t = tok("glucose-1-P", "#ffc2a1", 520, 270, "glucose"); g1p.push(t); move(t, 470+Math.random()*120, 330+Math.random()*30, 900); await wait(180); }
  logStep("nrg", "<b>Response.</b> Glycogen is cleaved by phosphorolysis into glucose-1-phosphate. A liver cell releases glucose into the blood for fight-or-flight energy.");
  complete("epi");
  await wait(1400);
  setLabel(F.galpha, "α · GDP"); setColor(F.galpha, "#7fe3d6");
  logStep("bio", "<b>Shut-off.</b> The α subunit's GTPase hydrolyzes GTP → GDP, and α returns to βγ. Phosphodiesterase converts cAMP → AMP.");
  camps.forEach(c => { setLabel(c, "AMP"); setColor(c, "#8aa"); fade(c, 900); });
  await move(F.galpha, 232, 192, 900);
  unpulse($("ac")); unpulse($("gpcr"));
  setColor(F.pka, "#9fd8ff"); setLabel(F.pka, "PKA");
  setColor(F.gp, "#9fd8ff"); setLabel(F.gp, "glycogen phosphorylase");
  g1p.forEach(t => fade(t, 800));
  await move(lig, 200, 40, 700); await fade(lig, 300);
  free("epi");
};

RUN.adenosine = async () => {
  if (busy("ado")) return;
  const lig = tok("adenosine", C.sig, 470, 55, "adenosine");
  if (performance.now() < S.adoBlockedUntil){
    await move(lig, 470, 95, 700);
    logStep("sig", "Adenosine can't bind: <b>caffeine is occupying the binding site</b>. No signal, so no drowsiness signal either.");
    await move(lig, 430, 45, 700); await fade(lig, 300); free("ado"); return;
  }
  await move(lig, 470, 104, 800);
  pulseFill($("ado"), "#a9d6ff");
  logStep("sig", "Adenosine (an <b>agonist</b>) binds its GPCR and switches it on. In brain cells this signal promotes drowsiness.");
  await wait(1600); unpulse($("ado")); await move(lig, 470, 45, 700); await fade(lig, 300);
  free("ado");
};

RUN.caffeine = async () => {
  if (busy("ado")) return;
  const lig = tok("caffeine", "#c7b08a", 470, 55, "caffeine");
  await move(lig, 470, 104, 800);
  pulseFill($("ado"), "#5d6680");
  logStep("sig", "<b>Antagonist.</b> Caffeine resembles adenosine, so it fits the receptor, but it doesn't cause the shape change. The receptor is blocked.");
  toast("Now drop adenosine on the same receptor to see the block.");
  S.adoBlockedUntil = performance.now() + dur(20000);
  complete("block");
  free("ado");
  await wait(20000);
  unpulse($("ado")); await move(lig, 470, 45, 700); await fade(lig, 300);
  logStep("sig", "Caffeine has unbound. The adenosine receptor can respond again.");
};

RUN.insulin = async () => {
  if (busy("ins")) return;
  const lig = tok("insulin", C.sig, 620, 55, "insulin");
  await move(lig, 620, 88, 800);
  logStep("sig", "<b>Reception.</b> Insulin from pancreatic β cells binds the insulin receptor, a receptor tyrosine kinase.");
  await Promise.all([moveEl($("rtkL"),[0,0],[8,0],600), moveEl($("rtkR"),[0,0],[-8,0],600)]);
  logStep("sig", "The two receptor halves come together (<b>dimerization</b>).");
  const a1 = tok("ATP", "#ffd27a", 560, 250, "atp"), a2 = tok("ATP", "#ffd27a", 680, 250, "atp");
  await Promise.all([move(a1, 600, 205, 600), move(a2, 640, 205, 600)]);
  setLabel(a1,"ADP"); setLabel(a2,"ADP"); setColor(a1,"#d9b98a"); setColor(a2,"#d9b98a");
  const p1 = tok("P","#ffd27a",603,186), p2 = tok("P","#ffd27a",637,186);
  logStep("bio", "<b>Autophosphorylation.</b> Each kinase domain uses ATP to phosphorylate tyrosines on its partner.");
  fade(a1,700); fade(a2,700);
  await wait(400);
  setLabel(F.dock, "docking protein · P"); setColor(F.dock, "#ffd27a");
  logStep("sig", "Phosphotyrosines become docking sites. Docked proteins are phosphorylated and relay the signal.");
  const v = $("g4ves");
  await moveEl(v, [800,315], [880,178], 1300);
  logStep("endo", "A <b>GLUT4 vesicle</b> moves to the plasma membrane. v-SNAREs on the vesicle pair with t-SNAREs on the membrane and the membranes fuse.");
  setOpacity(v, 0); setOpacity($("glut4"), 1); S.glut4 = true;
  for (let i=0;i<3;i++){ const g = tok("glucose", "#ffc2a1", 880, 50, "glucose"); path(g, [[880,140],[870+Math.random()*20,230]], 500).then(()=>fade(g,500)); await wait(300); }
  logStep("nrg", "<b>Response.</b> More glucose enters by facilitated diffusion through GLUT4, lowering blood sugar.");
  logStep("gen", "Insulin signaling also activates transcription factors that increase expression of the GLUT4 gene.");
  complete("insulin");
  await wait(1500);
  fade(p1,500); fade(p2,500);
  await Promise.all([moveEl($("rtkL"),[8,0],[0,0],600), moveEl($("rtkR"),[-8,0],[0,0],600)]);
  setLabel(F.dock, "docking protein"); setColor(F.dock, "#ffd88a");
  await move(lig, 620, 40, 600); await fade(lig, 300);
  v.setAttribute("transform","translate(800,315)"); setOpacity(v,1);
  logStep("sig", "Phosphatases remove the phosphates and the receptor resets. A new GLUT4 vesicle is ready.");
  free("ins");
};

RUN.ach = async () => {
  if (busy("ach")) return;
  const a = tok("ACh", C.sig, 755, 55, "ach"), b = tok("ACh", C.sig, 785, 55, "ach");
  await Promise.all([move(a, 755, 98, 700), move(b, 785, 98, 700)]);
  logStep("sig", "Two acetylcholine molecules bind the <b>nicotinic receptor</b>, a ligand-gated ion channel.");
  await Promise.all([moveEl($("nachrL"),[0,0],[-7,0],400), moveEl($("nachrR"),[0,0],[7,0],400)]);
  const ions = [];
  for (let i=0;i<8;i++){ const n = tok("Na⁺", "#9ee7ff", 740+Math.random()*60, 60, "na"); ions.push(n); path(n, [[770,110],[770,175],[740+Math.random()*60, 210+Math.random()*40]], 380).then(()=>fade(n,700)); await wait(140); }
  const d = $("depol"); d.setAttribute("opacity", .35);
  logStep("sig", "The channel opens. <b>Na⁺ diffuses in</b> down its gradient, depolarizing the membrane. In muscle this starts an action potential that leads to Ca²⁺ release from the SER and contraction.");
  complete("ach");
  await wait(1200);
  await move(F.ache, 772, 72, 700);
  setLabel(a, "acetate"); setLabel(b, "choline"); setColor(a,"#8fb"); setColor(b,"#8fb");
  logStep("bio", "<b>Acetylcholinesterase</b> hydrolyzes ACh into acetate and choline, so the receptor isn't stimulated constantly.");
  await Promise.all([move(a, 730, 40, 700), move(b, 810, 40, 700)]);
  fade(a,400); fade(b,400); d.setAttribute("opacity", 0);
  await Promise.all([moveEl($("nachrL"),[-7,0],[0,0],400), moveEl($("nachrR"),[7,0],[0,0],400), move(F.ache, 835, 92, 700)]);
  logStep("sig", "The channel closes and the membrane recovers.");
  free("ach");
};

RUN.cortisol = async (t, x) => {
  if (busy("gene")) return;
  const sx = Math.max(60, Math.min(1140, x));
  const c = tok("cortisol", "#e0c8ff", sx, 60, "cortisol");
  await move(c, sx, 112, 500);
  await move(c, sx, 168, 1100);
  logStep("sig", "Cortisol is a <b>nonpolar steroid</b>, so it diffuses straight through the phospholipid bilayer. No membrane receptor needed.");
  await move(c, 600, 322, 1000);
  setColor(F.gr, C.gen); setLabel(F.gr, "receptor + cortisol"); fade(c, 200);
  logStep("sig", "It binds the <b>glucocorticoid receptor</b> in the cytoplasm, an intracellular receptor. The receptor changes shape.");
  const home = [F.gr.x, F.gr.y];
  await path(F.gr, [[470,420],[420,444]], 700);
  logStep("gen", "The receptor–cortisol complex enters the nucleus through a <b>nuclear pore</b>.");
  await move(F.gr, 300, 494, 700);
  logStep("gen", "It binds DNA near the target gene and acts as a <b>transcription factor</b>.");
  const pol = tok("RNA pol", "#bfa3ff", 240, 520, "rnapol");
  await move(pol, 262, 520, 500);
  for (let i=0;i<7;i++){ renderSeq(i,"tx"); move(pol, 262+i*12, 520, 280); await wait(300); }
  renderSeq();
  logStep("gen", `<b>Transcription.</b> RNA polymerase reads the template strand 3′→5′ and builds mRNA 5′→3′: ${mrna().join(" ")}…`);
  fade(pol, 300);
  const m = tok("mRNA", C.gen, 330, 540, "mrna");
  await path(m, [[400,470],[425,444],[480,440]], 600);
  logStep("gen", "The mRNA leaves the nucleus through a nuclear pore.");
  await move(m, 548, 470, 600);
  const rib = tok("ribosome", "#e8c9ff", 548, 452, "ribosome");
  logStep("gen", "A ribosome binds the mRNA and starts translating at the start codon AUG (Met).");
  const a = aas(); let chain = [];
  const pp = tok("Met", "#ffd0f0", 570, 470, "protein");
  for (let i=0;i<7;i++){
    renderSeq(i,"tl");
    if (a[i]==="Stop"){ await wait(500); break; }
    chain.push(a[i]); setLabel(pp, chain.join("-")); place(pp, 560 + chain.join("-").length*3.1, 488);
    await wait(500);
  }
  renderSeq(-1,"done");
  if (mut === "nonsense" || mut === "frameshift"){
    logStep("gen", mut === "nonsense"
      ? "<b>Nonsense mutation.</b> Codon 4 is now <b>UGA</b>, a stop codon, so translation ends after Met-Phe-Gly. The protein is cut short."
      : "<b>Frameshift.</b> After the inserted base every codon is read in the wrong frame (Ile-Arg-Met-Ala…), and the real stop codon is missed.");
    setColor(pp, "#ff8a8a"); setLabel(pp, mut === "nonsense" ? "Met-Phe-Gly (truncated)" : "garbled protein");
    await wait(900);
    logStep("endo", "The faulty protein can't fold properly in the rough ER, so it isn't packaged for the Golgi. The cell breaks it down and <b>no protein is secreted</b>.");
    fade(pp, 900); fade(m, 600); fade(rib, 600);
    if (mut === "nonsense") complete("nonsense");
  } else {
    logStep("endo", "A signal sequence brings the ribosome to the <b>rough ER</b>. The polypeptide threads into the ER lumen, folds, and gets its first sugars.");
    fade(m, 500); fade(rib, 500);
    await move(pp, 590, 520, 600);
    setLabel(pp, "protein"); await wait(300);
    const v = tok("vesicle", "#ff9cc6", 610, 525, "vesicle"); fade(pp, 200);
    await move(v, 690, 540, 800);
    logStep("endo", "A transport vesicle carries it to the <b>cis face of the Golgi</b>.");
    await move(v, 740, 540, 900);
    logStep("endo", "Inside the Golgi the protein's carbohydrates are modified, it's sorted, and it reaches the <b>trans face</b>.");
    await move(v, 805, 515, 700);
    setLabel(v, "secretory vesicle");
    await path(v, [[830,420],[870,340],[960,175]], 650);
    logStep("endo", "A secretory vesicle fuses with the plasma membrane. v-SNAREs pair with t-SNAREs and Ca²⁺ triggers fusion: <b>exocytosis</b>.");
    fade(v, 300);
    const out = tok("glycoprotein", "#ffd0f0", 960, 120, "protein");
    await move(out, 990, 50, 900);
    logStep("gen", "The gene's product is outside the cell. DNA → RNA → protein, routed through the endomembrane system.");
    complete("gene");
    if (mut === "silent") logStep("gen", "<b>Silent mutation.</b> GGG still codes for Gly (the genetic code is redundant), so the secreted protein is unchanged.");
    if (mut === "missense") logStep("gen", "<b>Missense mutation.</b> The protein has Val where Asp should be. One changed amino acid can change folding and function, as in sickle-cell hemoglobin (Glu → Val).");
    fade(out, 1500);
  }
  if (mut){ seenMut.add(mut); if (["silent","missense","frameshift"].every(k => seenMut.has(k))) complete("mutants"); }
  await wait(500);
  await path(F.gr, [[420,444],[470,420],home], 600);
  setColor(F.gr, "#d8c3ff"); setLabel(F.gr, "glucocorticoid receptor");
  renderSeq();
  free("gene");
};

function ledger(id, v){ $(id).textContent = v; }
function resetLedger(){ ["lg-gly-atp","lg-gly-nadh","lg-pox-nadh","lg-pox-co2","lg-tca-atp","lg-tca-nadh","lg-tca-fadh","lg-tca-co2","lg-etc-atp","lg-total"].forEach(i=>ledger(i,0)); }
async function countUp(id, from, to, ms){ const steps = Math.max(1,to-from); for (let v=from+1; v<=to; v++){ ledger(id, v); await wait(ms/steps); } }

RUN.glucose = async (t) => {
  if (busy("resp")) return;
  resetLedger(); $("ledgerNote").textContent = "Running…";
  const gx = t==="glut4" ? 880 : 1110;
  const g = tok("glucose", "#ffc2a1", gx, 55, "glucose");
  await path(g, [[gx,140],[gx,180]], 600);
  logStep("nrg", `Glucose enters through ${t==="glut4"?"GLUT4":"GLUT1"} by <b>facilitated diffusion</b>.`);
  await move(g, 1110, 205, 600);
  const a1 = tok("ATP", "#ffd27a", 1150, 250, "atp"); await move(a1, 1120, 212, 400); setLabel(a1,"ADP"); fade(a1, 600);
  setLabel(g, "glucose-6-P");
  logStep("bio", "<b>Step 1, hexokinase:</b> ATP phosphorylates glucose. Glycolysis starts by investing energy.");
  await wait(300); setLabel(g, "fructose-6-P");
  await move(g, 1035, 205, 700);
  if (performance.now() < S.pfkUntil){
    logStep("bio", "<b>Stalled at step 3.</b> PFK's allosteric site is bound by excess ATP, so the rate-limiting enzyme is slowed. Fructose-6-P piles up until ATP levels drop.");
    complete("pfk");
    while (performance.now() < S.pfkUntil) await new Promise(r=>setTimeout(r,200));
    logStep("bio", "ATP has dropped, PFK is active again, and glycolysis resumes.");
  }
  const a2 = tok("ATP", "#ffd27a", 1070, 250, "atp"); await move(a2, 1045, 212, 400); setLabel(a2,"ADP"); fade(a2, 600);
  setLabel(g, "fructose-1,6-bisP");
  logStep("bio", "<b>Step 3, PFK:</b> a second ATP is invested. This is the rate-limiting step.");
  await move(g, 965, 205, 700);
  setLabel(g, "G3P"); const g2 = tok("G3P", "#ffc2a1", 965, 205, "glucose");
  logStep("nrg", "<b>Steps 4–5:</b> aldolase splits the 6-carbon sugar into two 3-carbon <b>G3P</b> molecules.");
  await Promise.all([move(g, 920, 262, 600), move(g2, 1005, 262, 600)]);
  const n1 = tok("NADH", "#ffe0c7", 920, 262, "nadh"), n2 = tok("NADH", "#ffe0c7", 1005, 262, "nadh");
  move(n1, 880, 290, 500); move(n2, 1045, 290, 500);
  logStep("nrg", "<b>Step 6:</b> G3P dehydrogenase oxidizes each G3P, reducing NAD⁺ → <b>NADH</b>.");
  ledger("lg-gly-nadh", 2);
  await Promise.all([move(g, 920, 312, 600), move(g2, 1005, 312, 600)]);
  for (const [x] of [[900],[985],[940],[1025]]){ const at = tok("ATP","#ffd27a",x,330,"atp"); move(at, x, 352, 400).then(()=>fade(at,700)); await wait(150); }
  setLabel(g, "pyruvate"); setLabel(g2, "pyruvate");
  logStep("nrg", "<b>Steps 7 and 10:</b> substrate-level phosphorylation makes 4 ATP. Net from glycolysis: <b>2 ATP, 2 NADH, 2 pyruvate</b>.");
  ledger("lg-gly-atp", 2); ledger("lg-total", 2);
  await wait(500);

  if (!S.oxygen){
    setOpacity(F.ldh.g, 1);
    await Promise.all([move(g, 1080, 320, 600), move(g2, 1120, 320, 600), move(n1, 1080, 302, 600), move(n2, 1120, 302, 600)]);
    if (S.yeast){
      setLabel(g,"acetaldehyde"); setLabel(g2,"acetaldehyde");
      [1080,1120].forEach(x => { const c = tok("CO₂","#cfd8e8",x,320,"co2"); move(c, x+25, 285, 800).then(() => fade(c, 500)); });
      logStep("nrg", "<b>No O₂, so no electron transport.</b> In yeast, <b>pyruvate decarboxylase</b> removes CO₂ from each pyruvate, making acetaldehyde.");
      await wait(800);
      setLabel(g,"ethanol"); setLabel(g2,"ethanol"); setLabel(n1,"NAD⁺"); setLabel(n2,"NAD⁺");
      logStep("nrg", "<b>Alcohol dehydrogenase</b> uses NADH to reduce acetaldehyde to <b>ethanol</b>, regenerating NAD⁺. Alcoholic fermentation: 2 ethanol + 2 CO₂ + <b>2 ATP</b> per glucose.");
      complete("ethanol");
    } else {
      setLabel(g,"lactate"); setLabel(g2,"lactate"); setLabel(n1,"NAD⁺"); setLabel(n2,"NAD⁺");
      logStep("nrg", "<b>No O₂, so no electron transport.</b> Lactate dehydrogenase uses NADH to reduce pyruvate to <b>lactate</b>, regenerating NAD⁺ so glycolysis can continue.");
      logStep("nrg", "Lactic acid fermentation: <b>2 ATP per glucose</b>, versus about 32 with oxygen.");
    }
    $("ledgerNote").textContent = "Fermentation: only glycolysis's 2 net ATP. Turn oxygen back on to compare.";
    complete("ferment");
    await wait(1200); [g,g2,n1,n2].forEach(x=>fade(x,700)); setOpacity(F.ldh.g,.35);
    free("resp"); return;
  }

  if (performance.now() < (S.pdhUntil || 0)){
    logStep("bio", "<b>Stalled at the mitochondrion.</b> High NADH, acetyl CoA and ATP: PDH kinase phosphorylates and switches off the <b>pyruvate dehydrogenase complex</b>. ATP also inhibits citrate synthase, and NADH competitively inhibits isocitrate dehydrogenase.");
    complete("pdh");
    while (performance.now() < S.pdhUntil) await new Promise(r => setTimeout(r, 200));
    logStep("bio", "Energy has been used up. PDH phosphatase reactivates PDH, and pyruvate enters the matrix.");
  }
  // pyruvate oxidation
  await Promise.all([path(g, [[880,360],[880,420]], 500), path(g2, [[905,360],[905,440]], 500), move(n1, 880, 395, 900), move(n2, 905, 470, 900)]);
  setLabel(g, "acetyl CoA"); setLabel(g2, "acetyl CoA");
  const co = [tok("CO₂","#cfd8e8",880,420,"co2"), tok("CO₂","#cfd8e8",905,440,"co2")];
  co.forEach((c,i)=>move(c, 820, 330+i*20, 900).then(()=>fade(c,500)));
  logStep("nrg", "<b>Pyruvate oxidation</b> in the matrix: the pyruvate dehydrogenase complex makes acetyl CoA, CO₂ and NADH (×2). This is the commitment step.");
  ledger("lg-pox-nadh", 2); ledger("lg-pox-co2", 2);
  await wait(400);
  // TCA
  await Promise.all([move(g, 920, 440, 500), move(g2, 945, 412, 500)]);
  for (let k=0;k<20;k++){ const ang = k/20*Math.PI*2; place(g, 945+30*Math.cos(ang), 440+30*Math.sin(ang)); place(g2, 945-30*Math.cos(ang), 440-30*Math.sin(ang)); await wait(70); }
  fade(g, 300); fade(g2, 300);
  const out = [];
  [["CO₂ ×4","#cfd8e8","co2",820,470],["NADH ×6","#ffe0c7","nadh",915,478],["FADH₂ ×2","#ffe8a8","fadh",960,478],["ATP ×2","#ffd27a","atp",1000,430]].forEach(([s,cl,i,x,y]) => { const T = tok(s,cl,945,440,i); out.push(T); move(T,x,y,700); });
  logStep("nrg", "<b>Citric acid cycle</b> (2 turns per glucose): acetyl CoA is fully oxidized, giving 4 CO₂, 6 NADH, 2 FADH₂ and 2 ATP.");
  ledger("lg-tca-atp", 2); ledger("lg-tca-nadh", 6); ledger("lg-tca-fadh", 2); ledger("lg-tca-co2", 4); ledger("lg-total", 4);
  await wait(900);
  fade(out[0], 600); fade(out[3], 900); fade(n1, 400);
  // ETC
  logStep("nrg", "<b>Electron transport chain.</b> NADH hands electrons to complex I; FADH₂ enters at ubiquinone. Electrons move to carriers with higher redox potential.");
  const stops = [[915,500],[948,500],[980,500],[1010,515],[1040,500]];
  const hs = [];
  for (let run=0; run<3; run++){
    const e = tok("e⁻", "#a6f0ff", stops[0][0], 480, "nadh");
    for (let s=0; s<stops.length; s++){
      await move(e, stops[s][0], stops[s][1]-14, 260);
      if (s===0||s===2||s===4){ const h = tok("H⁺","#ff9ad1",stops[s][0],488,"hplus"); hs.push(h); move(h, stops[s][0]+(Math.random()*16-8), 516, 300); }
    }
    if (run===0){ const o = tok("O₂","#cfe9ff",1040,460,"o2"); await move(o,1040,486,300); setLabel(o,"H₂O"); move(o,1080,450,500).then(()=>fade(o,600));
      logStep("nrg", "At complex IV, <b>O₂ is the final electron acceptor</b> and becomes water. Complexes I, III and IV pump H⁺ into the intermembrane space."); }
    fade(e, 200);
  }
  fade(n2, 300); fade(out[1], 400); fade(out[2], 400);
  // chemiosmosis
  logStep("nrg", S.uncoupled
    ? "<b>Uncoupled.</b> Some H⁺ flow back through UCP1 instead of ATP synthase. Their energy is released as heat."
    : "<b>Chemiosmosis.</b> H⁺ flow back into the matrix through ATP synthase. The rotor turns and ADP + Pi → ATP.");
  const rotor = $("rotor"); let ang = 0, made = 0;
  for (let i=0;i<hs.length;i++){
    const h = hs[i]; const leak = S.uncoupled && i%3!==0;
    if (leak){ await move(h, 1110, 516, 300); await move(h, 1110, 486, 300); fade(h,200);
      const hg = $("heatGlow"); hg.setAttribute("r", 30); setTimeout(()=>hg.setAttribute("r",0), dur(500)); continue; }
    await move(h, 1075, 516, 260); await move(h, 1075, 472, 260); fade(h, 200);
    ang += 60; rotor.setAttribute("transform", `translate(0,-32) rotate(${ang})`);
    const at = tok("ATP","#ffd27a",1075,462,"atp"); made++; move(at, 1040+Math.random()*80, 400+Math.random()*20, 700).then(()=>fade(at,600));
  }
  if (S.uncoupled){
    ledger("lg-etc-atp", "fewer"); ledger("lg-total", "< 32");
    $("ledgerNote").textContent = "With UCP1 open, much of the proton gradient became heat instead of ATP. Reset the cell to remove UCP1.";
  } else {
    await countUp("lg-etc-atp", 0, 28, 900); ledger("lg-total", 32);
    logStep("nrg", "Oxidative phosphorylation: 10 NADH × 2.5 + 2 FADH₂ × 1.5 = <b>28 ATP</b>. Total ≈ <b>32 ATP per glucose</b> (2 + 2 + 28). C₆H₁₂O₆ + 6O₂ → 6CO₂ + 6H₂O.");
    $("ledgerNote").textContent = "Each H⁺ token stands for many protons. NADH → 2.5 ATP, FADH₂ → 1.5 ATP.";
    complete("atp32");
  }
  free("resp");
};

RUN.xatp = async () => {
  if (busy("pfk")) return;
  const a = tok("ATP", "#ffd27a", 1035, 175, "xatp");
  await move(a, 1056, 208, 600);
  setColor(F.pfk, "#5d6680"); setLabel(F.pfk, "PFK · inhibited");
  S.pfkUntil = performance.now() + dur(18000);
  logStep("bio", "<b>Allosteric inhibition.</b> Excess ATP binds PFK's regulatory site (not the active site). The enzyme changes shape and slows: feedback inhibition of glycolysis.");
  toast("PFK is inhibited for a few seconds. Drop glucose on GLUT1 now to watch glycolysis stall.");
  free("pfk");
  while (performance.now() < S.pfkUntil) await new Promise(r=>setTimeout(r,200));
  setColor(F.pfk, "#9fd8ff"); setLabel(F.pfk, "PFK"); fade(a, 400);
  logStep("bio", "ATP levels fell and left the allosteric site. PFK is active again.");
};

RUN.ucp1item = async () => {
  if (S.uncoupled){ toast("UCP1 is already in the inner membrane. Run glucose to see its effect, or reset the cell."); return; }
  const u = tok("UCP1", "#ff5c2e", 1110, 340, "ucp1item");
  await move(u, 1110, 500, 800); fade(u, 300);
  setOpacity($("ucp1"), 1); S.uncoupled = true;
  logStep("nrg", "<b>UCP1</b> is now in the inner mitochondrial membrane. Brown fat cells make it (via a noradrenaline → GPCR → cAMP pathway) to generate heat. Run glucose to see it uncouple the ETC from ATP synthesis.");
};

RUN.tetra = async () => {
  const tt = tok("tetracycline", "#c7e6a0", 560, 360, "tetra");
  await move(tt, 552, 455, 700);
  await move(tt, 600, 400, 600);
  logStep("bio", "<b>No effect.</b> Tetracycline binds the 30S subunit of bacterial <b>70S</b> ribosomes. This cell's ribosomes are eukaryotic <b>80S</b>, so translation carries on. That difference is why antibiotics can target bacteria.");
  fade(tt, 600);
};

RUN.mutation = async () => applyMut("nonsense");
RUN.silent = async () => applyMut("silent");
RUN.missense = async () => applyMut("missense");
RUN.frameshift = async () => applyMut("frameshift");

RUN.junk = async () => {
  if (busy("lyso")) return;
  const j = tok("worn-out protein", "#b9a38f", 990, 610, "junk");
  await move(j, 1080, 655, 900);
  setLabel(j, "hydrolysis…"); await wait(900);
  fade(j, 200);
  const aa = [];
  for (let i=0;i<4;i++){ const a = tok("amino acid","#d7f0b0",1080,655,"protein"); aa.push(a); move(a, 980+Math.random()*180, 715+Math.random()*25, 900); }
  logStep("endo", "The lysosome's acidic interior (pH ≈ 5) and <b>hydrolases</b> break the protein into amino acids, which the cell reuses. Undigested material is removed by exocytosis.");
  complete("lyso");
  await wait(1600); aa.forEach(a=>fade(a,800));
  free("lyso");
};

/* ---------------- M4: transport + signaling ---------------- */
async function water(dir, n){ // dir 1 = into the cell, -1 = out
  for (let i=0;i<n;i++){
    const x = i%2 ? 700 : 150+Math.random()*900, w = tok("H₂O", "#bfe3ff", x, dir>0 ? 60 : 210, "water");
    path(w, dir>0 ? [[x,140],[x+Math.random()*40-20,215]] : [[x,140],[x,55]], 450).then(() => fade(w, 500));
    await wait(150);
  }
}
const TON = ["isotonic","hypotonic","hypertonic"]; let ti = 0;
$("tonbtn").addEventListener("click", async () => {
  if (lock.has("water")) return toast("Water is still moving. Wait a moment.");
  ti = (ti+1) % 3; $("tonbtn").textContent = `Outside: ${TON[ti]}`;
  if (ti === 0){ svg.style.transform = ""; return logStep("endo", "<b>Isotonic</b> outside: water moves in and out equally, so there's no net change."); }
  busy("water");
  logStep("endo", ti === 1
    ? "<b>Hypotonic</b> outside (fewer solutes). By <b>osmosis</b> water moves <b>into</b> the cell, toward the higher solute concentration. An animal cell swells and can burst."
    : "<b>Hypertonic</b> outside (more solutes). By <b>osmosis</b> water moves <b>out</b> of the cell, and an animal cell shrivels.");
  svg.style.transition = "transform .8s"; svg.style.transform = ti === 1 ? "scale(1.015)" : "scale(.985)";
  await water(ti === 1 ? 1 : -1, 8);
  complete("osmosis"); free("water");
});

RUN.adh = async () => {
  if (busy("water")) return;
  const h = tok("ADH", C.sig, 700, 55, "adh"); await move(h, 700, 92, 600);
  logStep("sig", "<b>ADH</b> (antidiuretic hormone) signals that the body is dehydrated.");
  const v = tok("AQP vesicle", "#cfe6f7", 700, 330, "vesicle"); await move(v, 700, 178, 900); fade(v, 300);
  pulseFill($("aqp"), "#6fb8ea");
  logStep("endo", "Vesicles holding <b>aquaporins</b> fuse with the plasma membrane, adding water channels.");
  await water(1, 10);
  logStep("endo", "Water now crosses much faster by <b>facilitated diffusion</b> through aquaporins, so it returns to the blood and less urine is made.");
  await wait(800); unpulse($("aqp")); fade(h, 600); free("water");
};

RUN.ldl = async () => {
  if (busy("ldl")) return;
  const l = tok("LDL", C.endo, 1035, 55, "ldl"); await move(l, 1035, 150, 700);
  logStep("endo", "<b>LDL</b>, carrying cholesterol, binds specific receptors gathered in a <b>coated pit</b> lined with clathrin on the cytoplasmic side.");
  const v = tok("coated vesicle", "#fde3ee", 1035, 182, "vesicle");
  await Promise.all([move(l, 1035, 205, 700), move(v, 1035, 205, 700)]);
  logStep("endo", "The pit pinches off into the cell: <b>receptor-mediated endocytosis</b>. The vesicle then sheds its clathrin coat.");
  await Promise.all([path(l, [[1062,400],[1080,640]], 700), path(v, [[1062,400],[1080,640]], 700)]);
  fade(v, 300); setLabel(l, "cholesterol");
  logStep("endo", "It fuses with a <b>lysosome</b>. Hydrolases free the cholesterol for the cell's membranes, and the receptors are recycled to the surface.");
  complete("ldl"); await move(l, 1000, 600, 800); fade(l, 800); free("ldl");
};

RUN.angio = async () => {
  if (busy("ip3")) return;
  const lig = tok("angiotensin II", C.sig, 400, 55, "angio"); await move(lig, 400, 92, 700);
  pulseFill($("at1"), "#ffd2c2");
  logStep("sig", "<b>Reception.</b> Angiotensin II binds the <b>AT1 receptor</b>, a GPCR. Its G protein swaps GDP for GTP.");
  const ga = tok("α · GTP", "#b8fff5", 400, 185, "galpha"); await move(ga, 425, 200, 500);
  setColor(F.plc, "#ffd27a");
  logStep("bio", "The α subunit activates <b>phospholipase C</b>, an enzyme anchored to the membrane.");
  const ip3 = tok("IP₃", "#c5f0a4", 445, 200, "ip3"), dag = tok("DAG", "#f5e0a0", 462, 172, "dag");
  logStep("sig", "PLC cuts the membrane lipid <b>PIP₂</b> into two second messengers: <b>IP₃</b>, which diffuses into the cytosol, and <b>DAG</b>, which stays in the membrane.");
  await path(ip3, [[560,430],[700,650],[722,690]], 650);
  logStep("endo", "IP₃ opens Ca²⁺ channels in the <b>smooth ER</b>, where Ca²⁺ is stored.");
  const cas = [];
  for (let i=0;i<6;i++){ const c = tok("Ca²⁺", "#ffe08a", 722, 700, "ca"); cas.push(c); move(c, 620+Math.random()*200, 560+Math.random()*90, 800); await wait(120); }
  await wait(600);
  const pkc = tok("PKC", "#ffd27a", 480, 200, "pkc");
  logStep("sig", "Ca²⁺ and DAG together activate <b>protein kinase C</b>. In the smooth muscle of blood vessels the response is <b>vasoconstriction</b>, raising blood pressure.");
  complete("ip3"); await wait(1500);
  unpulse($("at1")); setColor(F.plc, "#9fd8ff");
  [lig, ga, ip3, dag, pkc, ...cas].forEach(t => fade(t, 800));
  logStep("endo", "Ca²⁺ pumps (active transport) return Ca²⁺ to the smooth ER, and the signal ends.");
  free("ip3");
};

async function rasCascade(mut){
  setLabel(F.ras, "Ras · GTP"); setColor(F.ras, "#ffd27a");
  logStep("sig", mut ? "<b>Mutant Ras</b> can't hydrolyze its GTP, so it stays <b>on</b> with no growth factor at all."
                     : "Adapter proteins on the phosphotyrosines make <b>Ras</b>, a small G protein, swap GDP for GTP.");
  const T = [];
  for (const [n,x,y] of [["Raf",590,255],["MEK",525,285],["ERK",460,315]]){ T.push(tok(n, "#ffd27a", x, y, "mapk")); await wait(350); }
  logStep("bio", "<b>MAP kinase cascade.</b> Raf, MEK and ERK each phosphorylate the next, so one signal is amplified many times.");
  await path(T[2], [[440,420],[330,470]], 600);
  logStep("gen", "Active ERK enters the nucleus and switches on transcription factors for <b>cell-division genes</b>.");
  return T;
}
RUN.egf = async () => {
  if (busy("ras")) return;
  const lig = tok("EGF", C.sig, 545, 50, "egf"); await move(lig, 545, 84, 700);
  pulseFill($("egfr"), "#e4f7cf");
  logStep("sig", "<b>EGF</b> binds the <b>EGF receptor</b>, a receptor tyrosine kinase. The receptor dimerizes and autophosphorylates.");
  const T = await rasCascade(false);
  complete("ras"); await wait(1200);
  setLabel(F.ras, "Ras · GDP"); setColor(F.ras, "#c9e7b0");
  logStep("bio", "<b>Shut-off.</b> Ras hydrolyzes GTP → GDP and phosphatases switch the kinases off, so division stops until more growth factor arrives.");
  unpulse($("egfr")); [lig, ...T].forEach(t => fade(t, 800)); free("ras");
};
RUN.rasmut = async () => {
  if (busy("ras")) return;
  const m = tok("mutation", "#ff8a8a", 548, 260, "rasmut"); await move(m, 548, 226, 500); fade(m, 400);
  logStep("gen", "A point mutation in the <b>Ras</b> gene, an oncogene, makes a Ras protein that can't hydrolyze GTP.");
  for (let r=0;r<2;r++){ const T = await rasCascade(true); await wait(400); T.forEach(t => fade(t, 500)); }
  logStep("gen", "With Ras stuck on, the cell keeps getting the signal to divide: <b>uncontrolled cell division</b>, a step toward cancer (common in pancreatic and colorectal cancers).");
  complete("cancer"); await wait(800);
  setLabel(F.ras, "Ras · GDP"); setColor(F.ras, "#c9e7b0"); free("ras");
};

RUN.norad = async () => {
  if (busy("epi")) return;
  const lig = tok("noradrenaline", C.sig, 200, 55, "norad"); await move(lig, 200, 104, 700);
  pulseFill($("gpcr"), "#bff4ee");
  logStep("sig", "In a <b>brown fat cell</b>, cold triggers noradrenaline release. It binds a β-adrenergic GPCR, and adenylyl cyclase makes <b>cAMP</b>.");
  const c = tok("cAMP", "#bff4ff", 330, 200, "camp"); await move(c, 385, 238, 500);
  setColor(F.pka, "#ffd27a"); setLabel(F.pka, "PKA active");
  logStep("gen", "cAMP and PKA switch on transcription of the <b>Ucp1 gene</b> and trigger lipolysis, supplying fatty acids to burn.");
  await path(c, [[420,440],[300,520]], 600); fade(c, 300);
  const u = tok("UCP1", "#ff5c2e", 420, 470, "ucp1item"); await path(u, [[700,380],[1110,480]], 900); fade(u, 300);
  setOpacity($("ucp1"), 1); S.uncoupled = true;
  const hg = $("heatGlow"); hg.setAttribute("r", 34);
  logStep("nrg", "UCP1 lets H⁺ leak back into the matrix without passing through ATP synthase, so the gradient's energy becomes <b>heat</b>: non-shivering thermogenesis.");
  complete("heat"); await wait(1500); hg.setAttribute("r", 0);
  unpulse($("gpcr")); setColor(F.pka, "#9fd8ff"); setLabel(F.pka, "PKA");
  await move(lig, 200, 40, 600); fade(lig, 300);
  free("epi");
};

/* ---------------- M5: protein targeting, regulation, mutations ---------------- */
const TAGS = {
  sigpep:{lab:"signal peptide", to:[[620,470],[575,505]], log:"The <b>N-terminal signal sequence</b> is bound by the signal recognition particle, which pauses translation and docks the ribosome on the <b>rough ER</b>. The protein enters the ER lumen: the route for secreted proteins, membrane proteins and lysosomal enzymes."},
  kdel:{lab:"KDEL", to:[[620,470],[575,505],[720,540],[585,510]], log:"The C-terminal <b>KDEL</b> sequence marks an ER-resident protein, like the chaperone BiP. When it drifts to the Golgi, KDEL receptors <b>retrieve</b> it back to the ER."},
  nls:{lab:"NLS", to:[[470,420],[425,444],[300,565]], log:"The <b>nuclear localization signal</b> is recognized by importins, which carry the protein through a <b>nuclear pore</b>. Histones, DNA polymerase and transcription factors get in this way."},
  mtag:{lab:"mito signal", to:[[850,420],[930,458]], log:"The <b>mitochondrial targeting sequence</b> is threaded through the TOM and TIM complexes into the <b>matrix</b>, where the citric acid cycle enzymes work."},
  skl:{lab:"-SKL", to:[[860,620],[900,690]], log:"The C-terminal <b>-SKL</b> (PTS1) signal sends the protein into a <b>peroxisome</b>, like catalase, which breaks H₂O₂ into water and O₂."},
  ubiq:{lab:"ubiquitin", to:[[420,360],[110,320]], log:"Chains of <b>ubiquitin</b> tag the protein for destruction. The <b>proteasome</b> unfolds it and cuts it into peptides and amino acids for recycling."}
};
const tagged = new Set();
async function runTag(key){
  if (busy("tag")) return;
  const T = TAGS[key];
  const rib = tok("ribosome", "#e8c9ff", 760, 398, "ribosome"), p = tok(`protein + ${T.lab}`, "#ffd0f0", 760, 420, "protein");
  logStep("endo", `A free ribosome makes a protein carrying a <b>${T.lab}</b> tag. Tags are short amino-acid sequences that are part of the protein itself.`);
  await wait(600); fade(rib, 500);
  for (const [x,y] of T.to) await move(p, x, y, 700);
  logStep("endo", T.log);
  if (key === "ubiq") setLabel(p, "amino acids");
  tagged.add(key); if (tagged.size >= 3) complete("target");
  await wait(900); fade(p, 700); free("tag");
}
Object.keys(TAGS).forEach(k => RUN[k] = () => runTag(k));

RUN.highnrg = async () => {
  const t = tok("NADH + ATP", "#ffe0c7", 880, 380, "highnrg"); await move(t, 885, 410, 500);
  S.pdhUntil = performance.now() + dur(18000);
  logStep("bio", "<b>Feedback inhibition.</b> High NADH, acetyl CoA and ATP mean the cell has energy to spare, so the pathways that make them slow down.");
  toast("The citric acid cycle is slowed for a few seconds. Drop glucose on GLUT1 now to watch it stall.");
  while (performance.now() < S.pdhUntil) await new Promise(r => setTimeout(r, 250));
  fade(t, 400); logStep("bio", "NADH and ATP levels have fallen. PDH and the citric acid cycle run normally again.");
};
$("orgbtn").addEventListener("click", () => {
  S.yeast = !S.yeast; $("orgbtn").textContent = `Organism: ${S.yeast ? "yeast" : "animal"}`;
  logStep("nrg", S.yeast ? "Now a <b>yeast</b> cell. Without O₂ it switches to alcoholic fermentation." : "Back to an <b>animal</b> cell. Without O₂ it switches to lactic acid fermentation.");
});

const MUTLOG = {
  silent:"<b>Silent mutation.</b> Codon 3 changes GGA → GGG.",
  missense:"<b>Missense mutation.</b> Codon 6 changes GAC → GUC.",
  nonsense:"<b>Nonsense mutation.</b> One base changes (G→A), so codon 4 goes from UGG (Trp) to <b>UGA (stop)</b>.",
  frameshift:"<b>Frameshift.</b> One extra base (A) is inserted right after the start codon, shifting every codon after it."
};
function applyMut(kind){
  if (lock.has("gene")) return toast("Wait for the gene to finish being expressed first.");
  if (mut === kind) return toast("The gene already carries this mutation. Drop cortisol on the cell to express it.");
  mut = kind; $("geneTxt").textContent = `${kind} mutant`;
  $("gene").querySelector("rect").setAttribute("stroke", "#ff6b6b"); renderSeq();
  logStep("gen", MUTLOG[kind] + " Drop cortisol on the cell to express the gene.");
}
const seenMut = new Set();

/* ---------------- M6: study mode ---------------- */
const askedNow = new Set();
function record(unit, ok){ const s = scores[unit] || (scores[unit] = {right:0, total:0}); s.total++; if (ok) s.right++; persist(); }
async function guided(key, run){
  const q = guidedMode && QUIZ.find(x => x.run === key && !askedNow.has(x.id));
  if (q){
    askedNow.add(q.id);
    const ok = await Quiz.ask(q, "Predict", `${CN[q.unit]} · predict, then watch`);
    if (ok !== null) record(q.unit, ok);
  }
  return run();
}
function setMode(on){
  guidedMode = on; persist();
  $("modebtn").textContent = `Mode: ${on ? "Guided" : "Explore"}`; $("modebtn").setAttribute("aria-pressed", on);
}
$("modebtn").addEventListener("click", () => {
  setMode(!guidedMode);
  logStep("sig", guidedMode ? "<b>Guided mode.</b> Before a pathway runs you'll predict what happens, then watch the answer." : "<b>Explore mode.</b> Pathways run straight away.");
});
function reviewMenu(){
  Quiz.show("Review quiz", `<p class="qq">Pick a unit. Scores include predictions from Guided mode.</p>` +
    Object.keys(CN).map(u => { const s = scores[u], n = QUIZ.filter(q => q.unit === u).length;
      return `<button class="qopt qunit" data-u="${u}" type="button"><i style="background:${C[u]}"></i>${CN[u]} · ${n} questions<small>${s ? `${s.right}/${s.total} correct so far` : "not started"}</small></button>`; }).join(""));
  document.querySelectorAll(".qunit").forEach(b => b.addEventListener("click", () => review(b.dataset.u)));
  document.querySelector(".qunit").focus();
}
async function review(unit){
  const qs = QUIZ.filter(q => q.unit === unit).sort(() => Math.random() - .5);
  let right = 0;
  for (const [i, q] of qs.entries()){
    const ok = await Quiz.ask(q, "Review", `${CN[unit]} · ${i+1} of ${qs.length}`);
    if (ok === null) return;
    record(unit, ok); if (ok) right++;
  }
  const missed = qs.length - right;
  Quiz.show("Review done", `<p class="qq">${right} of ${qs.length} correct in ${CN[unit]}.</p>` +
    `<p class="note">${missed ? "Run the pathways you missed in Guided mode, then try again." : "Perfect score."}</p>` +
    `<button class="qnext" id="qback" type="button">Pick another unit</button>`);
  $("qback").addEventListener("click", reviewMenu); $("qback").focus();
}
$("reviewbtn").addEventListener("click", reviewMenu);

/* ---------------- pages (flip in from the right) + labs ---------------- */
const mountedViews = new Set();
const benchEvent = k => complete(k);
let openId = null, curLab = null;
function closePages(){
  document.querySelectorAll(".page.open").forEach(p => { p.classList.remove("open"); p.setAttribute("aria-hidden", "true"); });
  document.querySelectorAll("[data-page]").forEach(b => b.setAttribute("aria-expanded", "false"));
  openId = null;
}
function openPage(id, keep){
  if (openId === id && !keep) return closePages();
  document.querySelectorAll(".page").forEach(p => { const on = p.id === id; p.classList.toggle("open", on); p.setAttribute("aria-hidden", String(!on)); });
  document.querySelectorAll("[data-page]").forEach(b => b.setAttribute("aria-expanded", String(b.dataset.page === id)));
  openId = id;
  if (id === "pg-labs" && !curLab) showLab("enzymeView");
  $(id).querySelector(".pclose").focus({ preventScroll:true });
}
function showLab(v){
  curLab = v;
  document.querySelectorAll("[data-view]").forEach(x => x.setAttribute("aria-selected", String(x.dataset.view === v)));
  ["enzymeView","geneView"].forEach(id => $(id).hidden = id !== v);
  if (!mountedViews.has(v)){
    mountedViews.add(v);
    if (v === "enzymeView") mountEnzymeLab($(v), benchEvent);
    if (v === "geneView") mountGeneBench($(v), benchEvent);
  }
}
document.addEventListener("click", e => {
  const b = e.target.closest("[data-page]"); if (b) return openPage(b.dataset.page);
  const v = e.target.closest("[data-view]"); if (v){ openPage("pg-labs", true); return showLab(v.dataset.view); }
  if (e.target.closest(".pclose")) closePages();
});
document.addEventListener("keydown", e => { if (e.key === "Escape" && openId && $("quiz").hidden) closePages(); });
$("infoclose").addEventListener("click", () => $("infocard").hidden = true);
/* ---------------- in-cell molecules: drag any drifting molecule ---------------- */
const ACT = {
  sglt: async () => {
    if (busy("sglt")) return;
    const n = tok("Na⁺", "#9ee7ff", 950, 55, "na"), g = tok("glucose", "#ffc2a1", 974, 55, "glucose");
    await Promise.all([move(n, 953, 98, 500), move(g, 968, 98, 500)]); pulseFill($("sglt"), "#d6f2db");
    logStep("endo", "Na⁺ and glucose bind the <b>Na⁺–glucose symporter</b> together.");
    await Promise.all([path(n, [[953,175],[925,240]], 600), path(g, [[968,175],[995,245]], 600)]);
    logStep("nrg", "<b>Secondary active transport.</b> Na⁺ flowing down the gradient built by the Na⁺/K⁺ pump drags glucose in against its own gradient. ATP is used only indirectly, by the pump.");
    complete("sglt"); unpulse($("sglt")); fade(n, 800); fade(g, 800); free("sglt");
  },
  pump: async (x, y) => {
    if (busy("pump")) return;
    const node = svg.querySelector('[data-info="nakpump"]');
    const a = tok("ATP", "#ffd27a", x, y, "atp");
    await move(a, 92, 172, 600); setLabel(a, "ADP"); setColor(a, "#d9b98a"); pulseFill(node, "#d8ccff");
    logStep("bio", "<b>Primary active transport.</b> The pump hydrolyzes ATP, and the phosphate changes the pump's shape.");
    const na = [0,1,2].map(i => tok("Na⁺", "#9ee7ff", 70+i*10, 172, "na"));
    await Promise.all(na.map((n,i) => path(n, [[80,140],[55+i*22,70]], 450)));
    const ks = [0,1].map(i => tok("K⁺", "#c9b3ff", 72+i*14, 70, "k"));
    await Promise.all(ks.map((n,i) => path(n, [[80,140],[66+i*28,205]], 450)));
    logStep("sig", "3 Na⁺ go <b>out</b> and 2 K⁺ come <b>in</b>, both against their gradients. That stored gradient powers secondary active transport and nerve signals.");
    unpulse(node); [a, ...na, ...ks].forEach(t => fade(t, 900));
    free("pump");
  },
  xatp: () => RUN.xatp(),
  resp: (x, y, t) => RUN.glucose(t),
  lyso: () => RUN.junk(),
  synth: async (x, y) => {
    const a = tok("ADP", "#d9b98a", x, y, "adp");
    await move(a, 1075, 524, 500);
    $("rotor").setAttribute("transform", "translate(0,-32) rotate(45)");
    setLabel(a, "ATP"); setColor(a, "#ffd27a");
    logStep("nrg", "<b>ATP synthase.</b> H⁺ flowing back into the matrix turn the rotor, joining ADP + Pi → ATP. With no proton gradient (no O₂, or UCP1 leaking protons) this stops.");
    await move(a, 1040, 420, 700); fade(a, 600);
  },
  o2: async (x) => {
    const sx = Math.max(60, Math.min(1140, x));
    const o = tok("O₂", "#cfe9ff", sx, 80, "o2");
    await path(o, [[sx,140],[sx,185]], 600);
    logStep("nrg", "O₂ is small and nonpolar, so it crosses the bilayer by <b>simple diffusion</b>. No transporter needed.");
    await path(o, [[1000,360],[1040,484]], 700);
    setLabel(o, "H₂O");
    logStep("nrg", "At complex IV, O₂ is the <b>final electron acceptor</b> and becomes water.");
    if (!S.oxygen) $("o2btn").click();
    fade(o, 900);
  },
  etc: async (x, y) => {
    if (busy("etc1")) return;
    const n = tok("NADH", "#ffe0c7", x, y, "nadh");
    await move(n, 915, 478, 500); setLabel(n, "NAD⁺");
    logStep("nrg", "NADH hands 2 electrons to <b>complex I</b> and leaves as NAD⁺, ready to be reduced again.");
    const stops = [[915,500],[948,500],[980,500],[1010,515],[1040,500]], e = tok("e⁻", "#a6f0ff", 915, 486, "nadh"), hs = [];
    for (let s = 0; s < stops.length; s++){
      await move(e, stops[s][0], stops[s][1]-14, 260);
      if (s % 2 === 0){ const h = tok("H⁺", "#ff9ad1", stops[s][0], 488, "hplus"); hs.push(h); move(h, stops[s][0], 516, 300); }
    }
    fade(e, 200); fade(n, 500);
    logStep("nrg", "Complexes I, III and IV pump H⁺. Through ATP synthase, that gradient yields about <b>2.5 ATP per NADH</b> (FADH₂ enters at Q and yields about 1.5).");
    for (const h of hs){ await move(h, 1075, 516, 240); await move(h, 1075, 472, 240); fade(h, 200); }
    const a = tok("ATP", "#ffd27a", 1075, 462, "atp"); move(a, 1050, 405, 700).then(() => fade(a, 600));
    free("etc1");
  },
  nad: async (x, y) => {
    const n = tok("NAD⁺", "#ffe0c7", x, y, "nad");
    await move(n, 960, 250, 500); setLabel(n, "NADH");
    logStep("nrg", "At glycolysis step 6, G3P dehydrogenase oxidizes G3P and <b>reduces NAD⁺ to NADH</b>. Without NAD⁺ glycolysis stops, which is why fermentation regenerates it.");
    await wait(1000); fade(n, 600);
  },
  translate: async (x, y) => {
    const m = tok("mRNA", C.gen, x, y, "mrna");
    await move(m, 548, 470, 600);
    const rib = tok("ribosome", "#e8c9ff", 548, 452, "ribosome");
    logStep("gen", "A ribosome reads the mRNA codon by codon from AUG. The new protein's <b>signal sequence</b> docks the ribosome on the rough ER.");
    const pp = tok("polypeptide", "#ffd0f0", 570, 480, "protein");
    await move(pp, 590, 522, 900);
    logStep("endo", "The polypeptide threads into the ER lumen, folds, gets its first sugars, then leaves in a vesicle for the Golgi.");
    await wait(700); [m, rib, pp].forEach(t => fade(t, 700));
  }
};
function cellTargets(key){ const r = INCELL[key] || {}; return Object.keys(r).filter(t => ACT[r[t]]); }
function dropAmbient(a, x, y){
  const key = a.info, t = targetAt(x, y), act = t && (INCELL[key] || {})[t];
  if (act && ACT[act]){
    AMB.splice(AMB.indexOf(a), 1); a.T.g.remove();
    guided(act, () => ACT[act](x, y, t));
    if (!a.settled) setTimeout(() => wander(a.label, a.color, a.info, a.box, 1, a.speed), dur(6000));
    else settled.splice(settled.indexOf(a), 1);
    return;
  }
  if (act) toast(act);
  else if (t){
    const names = cellTargets(key).map(k => TG[k].name);
    toast(`${INFO[key].n} has no effect on the ${TG[t].name}.` + (names.length ? ` Try: ${[...new Set(names)].join(", ")}.` : " It's just part of the cell's crowd."));
  }
  a.held = false; a.T.g.setAttribute("opacity", .85);
  place(a.T, Math.max(a.box[0], Math.min(a.box[2], a.T.x)), Math.max(a.box[1], Math.min(a.box[3], a.T.y)));
}
let held = null, suppressClick = false;
svg.addEventListener("pointerdown", e => {
  if (selected) return;
  const g = e.target.closest("#ambient .tok"); if (!g) return;
  const a = AMB.find(m => m.T.g === g); if (!a) return;
  held = {a, start:[e.clientX, e.clientY], dragging:false};
  e.preventDefault();
});
window.addEventListener("pointermove", e => {
  if (!held) return;
  if (!held.dragging && Math.hypot(e.clientX-held.start[0], e.clientY-held.start[1]) > 6){
    held.dragging = true; held.a.held = true; held.a.T.g.setAttribute("opacity", 1);
    L.amb.appendChild(held.a.T.g); showHints(held.a.info, true); showInfo(held.a.info);
  }
  if (held.dragging){ const p = svgPoint(e.clientX, e.clientY); place(held.a.T, p.x, p.y); }
});
window.addEventListener("pointerup", e => {
  if (!held) return; const h = held; held = null;
  if (!h.dragging) return;
  clearHints(); suppressClick = true; setTimeout(() => suppressClick = false, 0);
  const p = svgPoint(e.clientX, e.clientY);
  dropAmbient(h.a, p.x, p.y);
});

/* ---------------- tray + drag/tap ---------------- */
const tray = $("tray");
ITEMS.forEach(gr => {
  const g = document.createElement("div"); g.className = "group";
  g.innerHTML = `<div class="group-title"><i style="background:${C[gr.c]}"></i>${gr.g}</div>`;
  gr.list.forEach(it => {
    const b = document.createElement("button");
    b.className = "item"; b.id = "item-"+it.key; b.type = "button";
    b.innerHTML = `<span class="pic"></span><span class="nm">${it.label}<small>${it.sub}</small></span>`;
    b.firstChild.appendChild(miniSvg(it.key, C[it.c], it.label));
    b.setAttribute("aria-label", `${it.label}. Drag onto the cell, or press to select then click a target.`);
    g.appendChild(b); attachDrag(b, it);
  });
  tray.appendChild(g);
});
const dockTabs = $("dockTabs");
ITEMS.forEach((gr, i) => {
  const b = document.createElement("button"); b.type = "button"; b.className = "dtab"; b.textContent = gr.g;
  b.style.setProperty("--c", C[gr.c]); b.addEventListener("click", () => setGroup(i)); dockTabs.appendChild(b);
});
function setGroup(i){
  [...tray.children].forEach((g, j) => g.classList.toggle("active", j === i));
  [...dockTabs.children].forEach((b, j) => b.setAttribute("aria-pressed", String(j === i)));
}
setGroup(0);

let selected = null;
const ghost = $("ghost");
function select(key){
  document.querySelectorAll(".item.selected").forEach(n=>n.classList.remove("selected"));
  selected = key;
  if (key){ $("item-"+key).classList.add("selected"); showHints(key); $("status").innerHTML = `<b>${ITEM[key].label}</b> selected. Click where it should go.`; showInfo(key); }
  else { clearHints(); $("status").textContent = "Nothing selected"; }
}
function svgPoint(cx, cy){ const p = svg.createSVGPoint(); p.x = cx; p.y = cy; return p.matrixTransform(svg.getScreenCTM().inverse()); }
function overSvg(cx, cy){ const r = svg.getBoundingClientRect(); return cx>=r.left&&cx<=r.right&&cy>=r.top&&cy<=r.bottom; }
function attachDrag(btn, it){
  let start = null, dragging = false;
  btn.addEventListener("pointerdown", e => { start = [e.clientX, e.clientY]; dragging = false; btn.setPointerCapture(e.pointerId); });
  btn.addEventListener("pointermove", e => {
    if (!start) return;
    if (!dragging && Math.hypot(e.clientX-start[0], e.clientY-start[1]) > 6){
      dragging = true; ghost.hidden = false; ghost.textContent = it.label; ghost.style.background = C[it.c]; showHints(it.key); showInfo(it.key);
    }
    if (dragging){ ghost.style.left = e.clientX+"px"; ghost.style.top = e.clientY+"px"; }
  });
  btn.addEventListener("pointerup", e => {
    if (!start) return;
    if (dragging){
      ghost.hidden = true; clearHints();
      const under = document.elementFromPoint(e.clientX, e.clientY);
      if (under && under.closest("#cell")){ const p = svgPoint(e.clientX, e.clientY); drop(it.key, p.x, p.y); }
      select(null);
    } else {
      select(selected===it.key ? null : it.key);
    }
    start = null; dragging = false;
  });
  btn.addEventListener("pointercancel", () => { ghost.hidden = true; clearHints(); start = null; dragging = false; });
  btn.addEventListener("keydown", e => { if (e.key==="Escape") select(null); });
}
svg.addEventListener("click", e => {
  if (suppressClick){ suppressClick = false; return; }
  const p = svgPoint(e.clientX, e.clientY);
  if (selected){ const k = selected; select(null); drop(k, p.x, p.y); return; }
  const n = e.target.closest("[data-info]");
  if (n){ const key = n.getAttribute("data-info"); showInfo(key); nametag(key, p.x, p.y); }
});
document.addEventListener("keydown", e => { if (e.key==="Escape") select(null); });

/* ---------------- atomized scene proteins ---------------- */
function atomize(n, seed){
  const isG = n.tagName === "g";
  const parts = isG ? [...n.children].filter(c => c.tagName !== "text" && !c.id) : [n];
  if (!parts.length) return;
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  parts.forEach(p => { const b = p.getBBox(); x0 = Math.min(x0, b.x); y0 = Math.min(y0, b.y); x1 = Math.max(x1, b.x + b.width); y1 = Math.max(y1, b.y + b.height); });
  const src = parts.map(p => p.getAttribute("fill") && p.getAttribute("fill") !== "none" ? p : p.querySelector("[fill]:not([fill=none])")).find(Boolean);
  const color = src ? src.getAttribute("fill") : "#9cc6ec";
  const g = document.createElementNS(NS, "g");
  g.setAttribute("transform", `translate(${((x0+x1)/2).toFixed(1)},${((y0+y1)/2).toFixed(1)})`);
  g.innerHTML = markup(tmLayout(x1 - x0 + 2, y1 - y0 + 2, seed), color);
  if (isG){ parts.forEach(p => p.remove()); n.insertBefore(g, n.firstChild); }
  else { const w = document.createElementNS(NS, "g"); ["id","data-info"].forEach(a => n.hasAttribute(a) && w.setAttribute(a, n.getAttribute(a))); w.appendChild(g); n.replaceWith(w); }
}

/* ---------------- camera: follow the action, zoom, pan ---------------- */
const VW = 1200, VH = 760, CAM = {x:0, y:0, w:VW, h:VH};
let follow = !reduced, userView = null, lastZoomTxt = "";
const focusPts = [];
function noteFocus(x, y){ if (follow) focusPts.push([x, y, performance.now()]); }
function clampView(v){ const w = Math.min(VW, Math.max(260, v.w)), h = w * VH / VW; return { w, h, x: Math.min(VW - w, Math.max(0, v.x)), y: Math.min(VH - h, Math.max(0, v.y)) }; }
function camTarget(){
  const now = performance.now();
  while (focusPts.length && now - focusPts[0][2] > 2200) focusPts.shift();
  if (follow && focusPts.length){
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const [x, y] of focusPts){ x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    const w = Math.max(560, x1 - x0 + 300, (y1 - y0 + 240) * VW / VH);
    return clampView({ w, x: (x0 + x1) / 2 - w / 2, y: (y0 + y1) / 2 - w * VH / VW / 2 });
  }
  return userView || { x:0, y:0, w:VW, h:VH };
}
function updateCam(){
  const t = camTarget(), k = reduced ? 1 : .06;
  for (const p of ["x","y","w","h"]) CAM[p] += (t[p] - CAM[p]) * k;
  svg.setAttribute("viewBox", `${CAM.x.toFixed(1)} ${CAM.y.toFixed(1)} ${CAM.w.toFixed(1)} ${CAM.h.toFixed(1)}`);
  const z = `${Math.round(VW / CAM.w * 100)}%`; if (z !== lastZoomTxt){ lastZoomTxt = z; $("zoomlvl").textContent = z; }
}
let rotA = 0;
function spinRotor(){ if (reduced || !S.oxygen) return; rotA = (rotA + .8 * SPD) % 360; $("rotor").setAttribute("transform", `translate(0,-32) rotate(${rotA.toFixed(1)})`); }
function zoomBy(k, cx, cy){
  const b = userView || { x:0, y:0, w:VW, h:VH };
  if (cx === undefined){ cx = b.x + b.w / 2; cy = b.y + b.h / 2; }
  const w = b.w * k;
  if (w >= VW){ userView = null; return; }
  userView = clampView({ w, x: cx - (cx - b.x) * w / b.w, y: cy - (cy - b.y) * w / b.w });
}
svg.addEventListener("wheel", e => { e.preventDefault(); const p = svgPoint(e.clientX, e.clientY); zoomBy(e.deltaY > 0 ? 1.15 : 1 / 1.15, p.x, p.y); }, { passive:false });
$("zoomin").addEventListener("click", () => zoomBy(1 / 1.35));
$("zoomout").addEventListener("click", () => zoomBy(1.35));
$("zoomfit").addEventListener("click", () => { userView = null; focusPts.length = 0; });
$("followbtn").addEventListener("click", () => {
  follow = !follow; if (!follow) focusPts.length = 0;
  $("followbtn").textContent = `Follow: ${follow ? "on" : "off"}`; $("followbtn").setAttribute("aria-pressed", follow);
});
$("followbtn").textContent = `Follow: ${follow ? "on" : "off"}`; $("followbtn").setAttribute("aria-pressed", follow);
let pan = null;
svg.addEventListener("pointerdown", e => {
  if (selected || e.target.closest(".tok") || !userView) return;
  pan = { x:e.clientX, y:e.clientY, v:{...userView}, moved:false };
});
window.addEventListener("pointermove", e => {
  if (!pan) return;
  const s = CAM.w / svg.getBoundingClientRect().width, dx = (e.clientX - pan.x) * s, dy = (e.clientY - pan.y) * s;
  if (Math.hypot(dx, dy) > 4) pan.moved = true;
  if (pan.moved){ userView = clampView({ ...pan.v, x: pan.v.x - dx, y: pan.v.y - dy }); svg.classList.add("panning"); }
});
window.addEventListener("pointerup", () => {
  if (!pan) return;
  if (pan.moved){ suppressClick = true; setTimeout(() => suppressClick = false, 0); }
  pan = null; svg.classList.remove("panning");
});

/* ---------------- background life (keeps the cell busy) ---------------- */
const BG = [
  {info:"vesicle", label:"secretory vesicle", color:"#ff9cc6", path:[[790,520],[830,420],[870,260],[905,178]], ms:1100},
  {info:"vesicle", label:"transport vesicle", color:"#ff9cc6", path:[[600,560],[650,560],[695,545]], ms:900},
  {info:"vesicle", label:"vesicle on kinesin", color:"#c9a6ff", path:[[662,600],[700,420],[668,300],[676,200]], ms:1300},
  {info:"mrna", label:"mRNA", color:C.gen, path:[[330,540],[400,470],[428,444],[520,415]], ms:900},
  {info:"glucose", label:"glucose", color:"#ffc2a1", path:[[1110,50],[1110,140],[1100,215]], ms:900, o2:false},
  {info:"na", label:"Na⁺", color:"#9ee7ff", path:[[80,185],[80,140],[72,62]], ms:700},
  {info:"k", label:"K⁺", color:"#c9b3ff", path:[[88,62],[80,140],[92,195]], ms:700},
  {info:"water", label:"H₂O", color:"#bfe3ff", path:[[700,50],[700,140],[708,220]], ms:700},
  {info:"junk", label:"worn-out protein", color:"#b9a38f", path:[[980,600],[1050,640],[1080,655]], ms:1100},
  {info:"cprot", label:"new protein", color:"#ffd0f0", path:[[560,470],[585,520],[610,560]], ms:900},
  {info:"hplus", label:"H⁺", color:"#ff9ad1", path:[[1040,522],[1075,518],[1075,468]], ms:500, o2:true},
  {info:"co2", label:"CO₂", color:"#cfd8e8", path:[[945,440],[900,330],[880,60]], ms:1200, o2:true}
];
function bgEvent(){
  if (lock.size === 0 && !document.hidden){
    const e = BG[Math.floor(Math.random() * BG.length)];
    if (!e.o2 || S.oxygen){
      const T = tok(e.label, e.color, e.path[0][0], e.path[0][1], e.info, L.bg);
      T.g.setAttribute("opacity", .9);
      (async () => { for (const [x, y] of e.path.slice(1)) await move(T, x, y, e.ms); await fade(T, 500); })();
    }
  }
  setTimeout(bgEvent, (1300 + Math.random() * 1700) / SPD);
}
setTimeout(bgEvent, 1200);

/* ---------------- friendlier UI: mission hints, tray search ---------------- */
const MHINT = {
  epi:["epi","Drag Epinephrine onto the β-adrenergic receptor (top left)."],
  block:["caffeine","Drop Caffeine on the adenosine receptor, then Adenosine on the same receptor."],
  insulin:["insulin","Drop Insulin on the insulin receptor."],
  ach:["ach","Drop Acetylcholine on the ACh receptor channel."],
  gene:["cortisol","Drop Cortisol anywhere inside the cell."],
  atp32:["glucose","With oxygen present, drop Glucose on GLUT1 (top right)."],
  ferment:["glucose","Set Oxygen to removed (Conditions), then drop Glucose on GLUT1."],
  pfk:["xatp","Drop Excess ATP on PFK, then Glucose on GLUT1."],
  nonsense:["mutation","Drop Nonsense mutation on the gene in the nucleus, then Cortisol on the cell."],
  lyso:["junk","Drop Worn-out protein on the lysosome."],
  sglt:[null,"Drag a drifting Na⁺ from outside the cell onto SGLT1."],
  osmosis:[null,"Click “Outside: isotonic” under Conditions to change the solution."],
  ldl:["ldl","Drop LDL on the coated pit."],
  ip3:["angio","Drop Angiotensin II on the AT1 receptor."],
  ras:["egf","Drop EGF on the EGF receptor."],
  cancer:["rasmut","Drop Ras mutation on Ras, under the EGF receptor."],
  heat:["norad","Drop Noradrenaline on the β-adrenergic receptor."],
  target:["sigpep","Drop three different protein tags inside the cell."],
  ethanol:["glucose","Switch Organism to yeast and remove oxygen, then drop Glucose on GLUT1."],
  pdh:["highnrg","Drop High NADH + ATP on the mitochondrion, then Glucose on GLUT1."],
  mutants:["silent","Drop a silent, missense and frameshift mutation on the gene, adding Cortisol after each."],
  denature:["tab:enzymeView","In the Enzyme lab, raise the temperature past 45 °C."],
  dihybrid:["tab:geneView","On the Genetics bench, pick Dihybrid and cross AaBb × AaBb."]
};
function showMe(k){
  const [it, tip] = MHINT[k] || []; if (!tip) return;
  if (it && it.startsWith("tab:")) return document.querySelector(`[data-view="${it.slice(4)}"]`).click();
  closePages();
  if (it){ const gi = ITEMS.findIndex(g => g.list.some(x => x.key === it)); if (gi >= 0) setGroup(gi); select(it); }
  toast(tip);
}
$("missions").addEventListener("click", e => { const li = e.target.closest("li[data-k]"); if (li) showMe(li.dataset.k); });
$("missions").addEventListener("keydown", e => {
  const li = e.target.closest("li[data-k]");
  if (li && (e.key === "Enter" || e.key === " ")){ e.preventDefault(); showMe(li.dataset.k); }
});
$("traysearch").addEventListener("input", e => {
  const q = e.target.value.trim().toLowerCase();
  document.querySelectorAll("#tray .group").forEach(g => {
    let any = false;
    g.querySelectorAll(".item").forEach(b => { const m = !q || b.textContent.toLowerCase().includes(q); b.hidden = !m; any = any || m; });
    g.hidden = !any;
  });
  tray.classList.toggle("searching", !!q);
});

/* toolbar */
$("o2btn").addEventListener("click", () => {
  S.oxygen = !S.oxygen;
  const b = $("o2btn"); b.setAttribute("aria-pressed", S.oxygen); b.textContent = S.oxygen ? "Oxygen: present" : "Oxygen: removed";
  logStep("nrg", S.oxygen ? "Oxygen restored. The ETC can run again." : "Oxygen removed. With no final electron acceptor the ETC stops. Try glucose now.");
});
const speeds = [0.5,1,2]; let si = 1;
$("speedbtn").addEventListener("click", () => { si = (si+1)%3; SPD = speeds[si]; $("speedbtn").textContent = `Speed: ${SPD}×`; persist(); });
if (guidedMode) setMode(true);
if (speeds.includes(saved.speed)){ si = speeds.indexOf(saved.speed); SPD = saved.speed; $("speedbtn").textContent = `Speed: ${SPD}×`; }
$("resetprog").addEventListener("click", () => { if (confirm("Clear all completed missions? This can't be undone.")){ clear(); done.clear(); for (const k in scores) delete scores[k]; persist(); renderMissions(); } });
$("resetbtn").addEventListener("click", () => location.reload());
$("clearbtn").addEventListener("click", () => {
  settled.splice(0).forEach(a => { const i = AMB.indexOf(a); if (i >= 0) AMB.splice(i, 1); a.T.g.remove(); });
  logStep("bio", "Cleared the leftover molecules from earlier reactions.");
});

/* initial state */
renderMissions();
$("info").innerHTML = `<h2>Start here</h2><p class="info-name">A cell you can poke</p><div class="info-kind">Biology I · cell lab</div><p>Click anything to name it. Drag a molecule from the dock at the bottom onto its target to run a pathway. The buttons on the right open your notes, missions, data, study mode, labs and settings.</p><p class="try">Good first try: drag Epinephrine onto the β-adrenergic receptor at the top left.</p>`;
logStep("sig", "Cell at rest. Na⁺ is high outside, K⁺ high inside, and ATP is drifting in the cytosol.");
