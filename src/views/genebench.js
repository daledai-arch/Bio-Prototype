/* Genetics bench: Punnett squares for Mendelian and non-Mendelian crosses (Lectures 15–16). */
const caseRank = t => (t === t.toUpperCase() ? 0 : 1);
export const MODES = {
  mono: { name:"Monohybrid · complete dominance", genes:1, p1:["AA","Aa","aa"], p2:["AA","Aa","aa"], d:["Aa","Aa"], rank:caseRank,
    pheno: g => /A/.test(g) ? "Round seed (A_)" : "Wrinkled seed (aa)",
    note:"<b>Law of segregation.</b> Each parent passes on one allele of the pair. Round (A) is dominant to wrinkled (a), as in Mendel's peas: Aa × Aa gives 3 : 1. Try a test cross (Aa × aa)." },
  di: { name:"Dihybrid · independent assortment", genes:2, p1:["AABB","AaBb","aabb","AaBB","AABb","Aabb","aaBb"], p2:["AABB","AaBb","aabb","AaBB","AABb","Aabb","aaBb"], d:["AaBb","AaBb"], rank:caseRank,
    pheno: g => `${/A/.test(g) ? "Round" : "Wrinkled"}, ${/B/.test(g) ? "yellow" : "green"}`,
    note:"<b>Law of independent assortment.</b> Genes on different chromosomes are sorted into gametes independently, so AaBb × AaBb gives 9 : 3 : 3 : 1. Linked genes on the same chromosome break this rule." },
  inc: { name:"Incomplete dominance", genes:1, p1:["PP","Pp","pp"], p2:["PP","Pp","pp"], d:["PP","pp"], rank:caseRank,
    pheno: g => g === "PP" ? "Purple" : g === "Pp" ? "Violet (intermediate)" : "White",
    note:"<b>Incomplete dominance.</b> The heterozygote is in between: purple × white fruit gives violet. It isn't blending, because the alleles separate again: Pp × Pp gives 1 : 2 : 1." },
  abo: { name:"Codominance · ABO blood type", genes:1, p1:["AA","AO","BB","BO","AB","OO"], p2:["AA","AO","BB","BO","AB","OO"], d:["AO","BO"], rank:t => ({A:0,B:1,O:2})[t],
    show: t => ({A:"Iᴬ",B:"Iᴮ",O:"i"})[t],
    pheno: g => g.includes("A") && g.includes("B") ? "Type AB" : g.includes("A") ? "Type A" : g.includes("B") ? "Type B" : "Type O",
    note:"<b>Codominance and multiple alleles.</b> Iᴬ and Iᴮ are both expressed in AB blood, and both are dominant to i (type O). Three alleles exist in the population, but each person has two." },
  x: { name:"X-linked · red-green color blindness", genes:1, p1:["XBXB","XBXb","XbXb"], p2:["XBY","XbY"], d:["XBXb","XBY"], rank:t => ({XB:0,Xb:1,Y:2})[t],
    show: t => ({XB:"Xᴮ",Xb:"Xᵇ",Y:"Y"})[t], labels:["Mother","Father"],
    pheno: g => g.includes("Y") ? (g.includes("XB") ? "Son, normal vision" : "Son, color-blind")
                                : (g === "XbXb" ? "Daughter, color-blind" : g.includes("Xb") ? "Daughter, carrier" : "Daughter, normal vision"),
    note:"<b>Sex-linked inheritance.</b> Males are hemizygous (one X), so a single recessive allele shows. Affected sons get it from their mother, and the trait can skip a generation through carrier daughters." }
};

export const tokens = s => s.match(/X[Bb]|Y|[A-Za-z]/g);
export function genesOf(s, mode){ const t = tokens(s); return mode.genes === 2 ? [[t[0],t[1]],[t[2],t[3]]] : [[t[0],t[1]]]; }
export function gametes(s, mode){ return genesOf(s, mode).reduce((acc, gene) => acc.flatMap(a => gene.map(al => [...a, al])), [[]]); }
export function child(g1, g2, mode){ return g1.map((al, i) => [al, g2[i]].sort((a, b) => mode.rank(a) - mode.rank(b)).join("")).join(""); }
const gcd = (a, b) => b ? gcd(b, a % b) : a;
export function cross(a, b, mode){
  const G1 = gametes(a, mode), G2 = gametes(b, mode);
  const grid = G1.map(g1 => G2.map(g2 => child(g1, g2, mode)));
  const counts = new Map();
  grid.flat().forEach(g => { const p = mode.pheno(g); counts.set(p, (counts.get(p) || 0) + 1); });
  const sorted = new Map([...counts].sort((x, y) => y[1] - x[1]));
  const total = G1.length * G2.length, d = [...sorted.values()].reduce(gcd);
  return { G1, G2, grid, counts: sorted, total, ratio: [...sorted.values()].map(n => n / d).join(" : ") };
}

export function mountGeneBench(el, onEvent){
  el.innerHTML = `<div class="bench-grid">
  <section class="card"><h2>Set up a cross</h2>
    <label class="ctl">Inheritance pattern <select id="gbMode">${Object.entries(MODES).map(([k, m]) => `<option value="${k}">${m.name}</option>`).join("")}</select></label>
    <label class="ctl"><span id="gbL1">Parent 1</span> <select id="gbP1"></select></label>
    <label class="ctl"><span id="gbL2">Parent 2</span> <select id="gbP2"></select></label>
    <div id="gbNote" class="ezmsg"></div>
  </section>
  <section class="card"><h2>Punnett square</h2>
    <div class="punnett-wrap"><table class="punnett" id="gbGrid"></table></div>
    <h2 style="margin-top:14px">Offspring</h2><ul class="ratios" id="gbRatios"></ul>
  </section></div>`;
  const q = id => el.querySelector("#" + id);
  const fmt = (m, g) => m.show ? tokens(g).map(m.show).join("") : g;
  function fillParents(){
    const m = MODES[q("gbMode").value];
    q("gbP1").innerHTML = m.p1.map(g => `<option value="${g}">${fmt(m, g)}</option>`).join("");
    q("gbP2").innerHTML = m.p2.map(g => `<option value="${g}">${fmt(m, g)}</option>`).join("");
    q("gbP1").value = m.d[0]; q("gbP2").value = m.d[1];
    [q("gbL1").textContent, q("gbL2").textContent] = m.labels || ["Parent 1","Parent 2"];
    q("gbNote").innerHTML = `<p>${m.note}</p>`;
  }
  function update(){
    const m = MODES[q("gbMode").value], r = cross(q("gbP1").value, q("gbP2").value, m);
    const gl = g => fmt(m, g.join(""));
    q("gbGrid").innerHTML = `<tr><th></th>${r.G2.map(g => `<th scope="col">${gl(g)}</th>`).join("")}</tr>` +
      r.G1.map((g1, i) => `<tr><th scope="row">${gl(g1)}</th>${r.grid[i].map(c => `<td title="${m.pheno(c)}">${fmt(m, c)}<small>${m.pheno(c)}</small></td>`).join("")}</tr>`).join("");
    q("gbRatios").innerHTML = [...r.counts].map(([p, n]) => `<li><b>${p}</b><span>${n}/${r.total} (${Math.round(n / r.total * 100)}%)</span></li>`).join("") +
      `<li class="ratio">Phenotype ratio <b>${r.ratio}</b></li>`;
    if (q("gbMode").value === "di" && r.ratio === "9 : 3 : 3 : 1") onEvent("dihybrid");
  }
  q("gbMode").addEventListener("change", () => { fillParents(); update(); });
  q("gbP1").addEventListener("change", update); q("gbP2").addEventListener("change", update);
  fillParents(); update();
}
