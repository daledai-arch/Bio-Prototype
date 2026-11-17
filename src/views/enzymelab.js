/* Enzyme lab: hexokinase on a bench. Pure rate model + UI (Lectures 18–19). */
const VMAX = 100, KM = 2, KI = 1;
export const NORMAL = { S:4, mg:true, inhib:"none", I:0, T:37, pH:7.4 };

/** Rate rises ~2× per 10 °C up to the 37 °C optimum, then falls to 0 by 45 °C (denaturation). */
export function tempFactor(T){ return T <= 37 ? Math.pow(2, (T - 37) / 10) : Math.max(0, 1 - (T - 37) / 8) ** 2; }
export function phFactor(pH){ return Math.exp(-(((pH - 7.4) / 1.3) ** 2)); }
/** % of maximum rate. Competitive raises apparent Km; allosteric (noncompetitive) lowers Vmax. */
export function rate({ S, mg = true, inhib = "none", I = 0, T = 37, pH = 7.4 }){
  let vmax = VMAX, km = KM;
  if (inhib === "competitive") km = KM * (1 + I / KI);
  if (inhib === "allosteric") vmax = VMAX / (1 + I / KI);
  return (vmax * S / (km + S)) * tempFactor(T) * phFactor(pH) * (mg ? 1 : 0.03);
}
export function denatured(p){ return p.T >= 45 || phFactor(p.pH) < 0.15; }

export function messages(p){
  const m = [];
  if (denatured(p)) m.push(p.T >= 45
    ? "<b>Denatured.</b> Heat broke the weak bonds holding the enzyme's shape, so the active site no longer fits glucose."
    : "<b>Denatured.</b> At this pH, H⁺ or OH⁻ change the charges on the enzyme's amino acids and it loses its shape.");
  else {
    if (p.T > 37) m.push("Above the 37 °C optimum the enzyme is starting to unfold, so activity drops fast.");
    if (p.T < 20) m.push("Cold: molecules move slowly, so glucose meets the active site less often.");
    if (phFactor(p.pH) < .6) m.push("pH is away from this enzyme's optimum (about 7.4), so fewer enzymes have the right shape.");
  }
  if (!p.mg) m.push("<b>No Mg²⁺.</b> Hexokinase needs Mg²⁺ bound to ATP to shield the phosphates' negative charges. Mg²⁺ is an inorganic cofactor.");
  if (p.inhib === "competitive" && p.I > 0) m.push("<b>Competitive inhibitor</b> in the active site. Raise the glucose: enough substrate can out-compete it (Vmax is unchanged).");
  if (p.inhib === "allosteric" && p.I > 0) m.push("<b>Allosteric inhibitor</b> binds another site and changes the enzyme's shape. More glucose doesn't fix it, because the maximum rate itself is lower.");
  if (p.S === 0) m.push("No substrate, no reaction.");
  if (!m.length) m.push("Normal conditions. At high glucose every active site is busy, so the rate levels off (saturation).");
  return m;
}

function pic(p){
  if (denatured(p)) return `<path d="M-80 0 c15 -25 25 25 40 0 s25 -25 40 0 s25 25 40 0 s25 -25 40 0" fill="none" stroke="#0a0d16" stroke-width="9" stroke-linecap="round"/>
    <path d="M-80 0 c15 -25 25 25 40 0 s25 -25 40 0 s25 25 40 0 s25 -25 40 0" fill="none" stroke="#9cc6ec" stroke-width="6" stroke-linecap="round"/>
    <text y="42" text-anchor="middle" class="lbl">unfolded enzyme</text>`;
  const allo = p.inhib === "allosteric" && p.I > 0, comp = p.inhib === "competitive" && p.I > 0;
  const subIn = p.S > 0 && !(comp && p.I >= p.S) ;
  return `<path d="M-62 0 C-62 -40 -30 -46 -14 -42 L14 -42 C30 -46 62 -40 62 0 C62 38 30 48 0 48 C-30 48 -62 38 -62 0 Z" fill="#9cc6ec" stroke="#0a0d16" stroke-width="1.5"/>
    <ellipse cx="0" cy="-42" rx="15" ry="${allo ? 6 : 14}" fill="#151c31" stroke="#0a0d16" stroke-width="1.2"/>
    <circle cx="62" cy="8" r="9" fill="#151c31" stroke="#0a0d16" stroke-width="1.2"/>
    ${comp ? `<rect x="-9" y="-50" width="18" height="16" rx="3" fill="#ef9a9a" stroke="#0a0d16"/>` : subIn ? `<circle cx="0" cy="-42" r="10" fill="#ffc2a1" stroke="#0a0d16"/>` : ""}
    ${allo ? `<circle cx="62" cy="8" r="8" fill="#ef9a9a" stroke="#0a0d16"/>` : ""}
    ${p.mg ? `<circle cx="-22" cy="-30" r="6" fill="#b5d99c" stroke="#0a0d16"/><text x="-22" y="-27" text-anchor="middle" class="tiny">Mg</text>` : ""}
    <text y="10" text-anchor="middle" class="lbl">hexokinase</text>
    <text x="0" y="-60" text-anchor="middle" class="tiny">active site</text><text x="80" y="30" text-anchor="middle" class="tiny">allosteric site</text>`;
}

function chart(p){
  const W = 320, H = 190, x0 = 36, y1 = 14, y0 = 160, xs = s => x0 + s / 20 * (W - x0 - 10), ys = v => y0 - v / 100 * (y0 - y1);
  const line = q => Array.from({ length: 41 }, (_, i) => i / 2).map(s => `${xs(s).toFixed(1)},${ys(rate({ ...q, S:s })).toFixed(1)}`).join(" ");
  return `<line x1="${x0}" y1="${y0}" x2="${W-10}" y2="${y0}" stroke="#7c88a8"/><line x1="${x0}" y1="${y1}" x2="${x0}" y2="${y0}" stroke="#7c88a8"/>
    <text x="${(W+x0)/2}" y="${H-6}" text-anchor="middle" class="tiny">glucose (mM)</text>
    <text x="10" y="${(y0+y1)/2}" text-anchor="middle" class="tiny" transform="rotate(-90 10 ${(y0+y1)/2})">rate (%)</text>
    ${[0,10,20].map(s => `<text x="${xs(s)}" y="${y0+13}" text-anchor="middle" class="tiny">${s}</text>`).join("")}
    ${[0,50,100].map(v => `<text x="${x0-5}" y="${ys(v)+3}" text-anchor="end" class="tiny">${v}</text>`).join("")}
    <polyline points="${line(NORMAL)}" fill="none" stroke="#8a94a6" stroke-width="2" stroke-dasharray="5 4"/>
    <polyline points="${line(p)}" fill="none" stroke="#8cc4ff" stroke-width="2.5"/>
    <circle cx="${xs(p.S)}" cy="${ys(rate(p))}" r="5" fill="#d97706" stroke="#fff" stroke-width="1.5"/>`;
}

export function mountEnzymeLab(el, onEvent){
  el.innerHTML = `<div class="bench-grid">
  <section class="card"><h2>Hexokinase bench</h2>
    <p class="note">Glucose + ATP → glucose-6-phosphate + ADP (glycolysis step 1). Change one thing at a time and watch the rate.</p>
    <label class="ctl">Glucose (substrate) <output id="ezSv"></output><input type="range" id="ezS" min="0" max="20" step="0.5"></label>
    <label class="ctl chk"><input type="checkbox" id="ezMg"> Mg²⁺ cofactor present</label>
    <label class="ctl">Inhibitor <select id="ezInh"><option value="none">None</option><option value="competitive">Competitive (binds the active site)</option><option value="allosteric">Allosteric / noncompetitive (binds another site)</option></select></label>
    <label class="ctl">Inhibitor amount <output id="ezIv"></output><input type="range" id="ezI" min="0" max="10" step="0.5"></label>
    <label class="ctl">Temperature <output id="ezTv"></output><input type="range" id="ezT" min="0" max="60" step="1"></label>
    <label class="ctl">pH <output id="ezPv"></output><input type="range" id="ezP" min="2" max="11" step="0.1"></label>
    <button class="tbtn" id="ezReset" type="button">Reset to normal</button>
  </section>
  <section class="card"><h2>Reaction rate</h2>
    <svg id="ezPic" viewBox="-110 -75 220 130" class="ezpic" aria-hidden="true"></svg>
    <div class="ratebar"><i id="ezBar"></i></div><p class="ratenum"><b id="ezRate"></b> % of the maximum rate</p>
    <div id="ezMsg" class="ezmsg" aria-live="polite"></div>
    <svg id="ezChart" viewBox="0 0 320 190" class="ezchart" role="img" aria-label="Reaction rate against glucose concentration"></svg>
    <p class="note">Dashed line: normal enzyme. Solid line: your conditions. Orange dot: the current glucose level.</p>
  </section></div>`;
  const q = id => el.querySelector("#" + id);
  const set = p => { q("ezS").value = p.S; q("ezMg").checked = p.mg; q("ezInh").value = p.inhib; q("ezI").value = p.I; q("ezT").value = p.T; q("ezP").value = p.pH; };
  const read = () => ({ S:+q("ezS").value, mg:q("ezMg").checked, inhib:q("ezInh").value, I:+q("ezI").value, T:+q("ezT").value, pH:+q("ezP").value });
  function update(){
    const p = read(), r = rate(p);
    q("ezSv").textContent = `${p.S} mM`; q("ezIv").textContent = p.inhib === "none" ? "–" : `${p.I} mM`;
    q("ezTv").textContent = `${p.T} °C`; q("ezPv").textContent = p.pH.toFixed(1);
    q("ezI").disabled = p.inhib === "none";
    q("ezBar").style.width = `${Math.min(100, r)}%`; q("ezRate").textContent = r.toFixed(0);
    q("ezPic").innerHTML = pic(p); q("ezChart").innerHTML = chart(p);
    q("ezMsg").innerHTML = messages(p).map(s => `<p>${s}</p>`).join("");
    if (denatured(p)) onEvent("denature");
  }
  el.addEventListener("input", update);
  q("ezReset").addEventListener("click", () => { set(NORMAL); update(); });
  set(NORMAL); update();
}
