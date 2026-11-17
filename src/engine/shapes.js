/* Space-filling "atom cluster" molecules (original art in a Goodsell-like style):
   many small spheres with a dark union outline, two-tone domains and a soft highlight.
   Each molecule kind+key is built once into <defs> and reused with <use>. */
const NS = "http://www.w3.org/2000/svg";
export const OUTLINE = "#0a0d16";

const KIND = {
  galpha:"glob", gbg:"glob", pka:"glob", gp:"glob", dock:"glob", gr:"glob", ache:"glob",
  hk:"glob", pfk:"glob", ald:"glob", gapdh:"glob", pk:"glob", ldh:"glob", rnapol:"glob",
  ribosome:"glob", insulin:"glob", protein:"glob", ucp1item:"glob", junk:"glob", ldl:"glob",
  mapk:"glob", pkc:"glob", cprot:"glob", plc:"glob", ras:"glob", egf:"small",
  mrna:"strand", mutation:"strand", rasmut:"strand", silent:"strand", missense:"strand", frameshift:"strand",
  vesicle:"vesicle"
};

function hash(s){ let h = 2166136261; for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; }
function rng(seed){ return () => { seed = (Math.imul(seed ^ (seed >>> 15), 2246822507) + 0x9e3779b9) | 0; return ((seed >>> 0) % 10000) / 10000; }; }

/** Lighten a #rrggbb color toward white. */
export function pastel(hex, k = .18){
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return hex;
  const n = parseInt(hex.slice(1), 16), m = v => Math.round(v + (255 - v) * k);
  return `rgb(${m(n >> 16)},${m((n >> 8) & 255)},${m(n & 255)})`;
}
export function kindFor(key, label){ return String(label).length <= 3 ? "bead" : (KIND[key] || "small"); }

/** Fill a region with a jittered hex grid of atoms. inside(x,y) → domain index or -1. */
function fill(rand, box, ar, inside){
  const sp = ar * 1.45, out = [];
  let row = 0;
  for (let y = box[1]; y <= box[3]; y += sp * .866, row++){
    for (let x = box[0] + (row % 2 ? sp / 2 : 0); x <= box[2]; x += sp){
      const jx = x + (rand() - .5) * sp * .35, jy = y + (rand() - .5) * sp * .35, d = inside(jx, jy, rand());
      if (d >= 0) out.push([jx, jy, ar * (.85 + rand() * .3), d]);
    }
  }
  return out;
}

/** Atom layout for a free molecule: {atoms:[[x,y,r,domain]], r} */
export function layout(kind, seed){
  const rand = rng(hash(seed));
  if (kind === "bead") return { atoms:[[0,0,9,0]], r:9 };
  if (kind === "strand"){
    const atoms = [];
    for (let x = -20; x <= 20; x += 3.2){ const y = Math.sin(x / 4) * 4; atoms.push([x, y, 2.4, 0]); if (Math.round(x) % 2 === 0) atoms.push([x, y + 4.6, 2, 1]); }
    return { atoms, r:10 };
  }
  if (kind === "vesicle"){
    const atoms = [];
    for (let i = 0; i < 26; i++){ const a = i / 26 * Math.PI * 2; atoms.push([Math.cos(a) * 12.5, Math.sin(a) * 12.5, 2.4, i % 2 ? 2 : 0]); }
    return { atoms, r:15, core:11 };
  }
  const big = kind === "glob", lobes = [];
  const n = big ? 2 + (rand() > .55 ? 1 : 0) : 2;
  for (let i = 0; i < n; i++){
    const a = rand() * Math.PI * 2, d = i ? (big ? 6 + rand() * 3 : 3 + rand() * 2) : 0;
    lobes.push([Math.cos(a) * d, Math.sin(a) * d * .8, big ? 8.5 + rand() * 2 : 4.5 + rand() * 1.5]);
  }
  const ext = lobes.reduce((m, l) => Math.max(m, Math.hypot(l[0], l[1]) + l[2]), 0);
  const atoms = fill(rand, [-ext, -ext, ext, ext], big ? 2.4 : 2.1, (x, y, noise) => {
    let best = -1, bd = 1e9;
    lobes.forEach((l, i) => { const d = Math.hypot(x - l[0], y - l[1]) / l[2]; if (d < bd){ bd = d; best = i; } });
    return bd < 1 - noise * .12 ? best : -1;
  });
  return { atoms, r: ext + 2.5 };
}

/** Atom layout for a rectangular transmembrane protein (w×h, centered). Stripes suggest helices. */
export function tmLayout(w, h, seed){
  const rand = rng(hash(seed));
  return { atoms: fill(rand, [-w/2, -h/2, w/2, h/2], 2.5, (x, y, noise) =>
    (Math.abs(x) / (w/2)) ** 4 + (Math.abs(y) / (h/2)) ** 4 <= 1 - noise * .15 ? Math.floor((x + w/2) / 7) % 2 : -1), r: Math.max(w, h) / 2 };
}

/** SVG markup. color = "currentColor" (reusable) or a hex (scene proteins, pulseFill-able). */
export function markup(L, color = "currentColor"){
  const f = n => n.toFixed(1);
  let o = "", b = "", h = "";
  if (L.core) b += `<circle r="${L.core}" fill="${color}" fill-opacity=".22"/>`;
  for (const [x, y, r, d] of L.atoms){
    o += `<circle class="ol" cx="${f(x)}" cy="${f(y)}" r="${f(r + 1.1)}" fill="${OUTLINE}"/>`;
    b += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill="${color}"/>`;
    if (d === 1) b += `<circle class="hl" cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill="#000" fill-opacity=".24"/>`;
    if (d === 2) b += `<circle class="hl" cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill="#fff" fill-opacity=".2"/>`;
    h += `<circle class="hl" cx="${f(x - r * .3)}" cy="${f(y - r * .32)}" r="${f(r * .48)}" fill="#fff" fill-opacity=".26"/>`;
  }
  return o + b + h;
}

const cache = new Map();
function defsFor(svg){ let d = svg.querySelector("#molDefs"); if (!d){ d = document.createElementNS(NS, "defs"); d.id = "molDefs"; svg.prepend(d); } return d; }

/** Draw a reusable molecule into group g. Returns its radius. */
export function drawShape(g, kind, seed){
  const id = "m-" + kind + "-" + hash(seed).toString(36);
  if (!cache.has(id)){
    const L = layout(kind, seed), sym = document.createElementNS(NS, "g");
    sym.id = id; sym.innerHTML = markup(L); defsFor(g.ownerSVGElement).appendChild(sym); cache.set(id, L.r);
  }
  const u = document.createElementNS(NS, "use"); u.setAttribute("href", "#" + id); g.appendChild(u);
  return cache.get(id);
}
export function paint(g, color){ g.style.color = pastel(color); }

/** Small standalone SVG for tray cards. */
export function miniSvg(key, color, label = "molecule"){
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", "-24 -20 48 40"); svg.setAttribute("aria-hidden", "true");
  svg.style.color = pastel(color);
  svg.innerHTML = markup(layout(KIND[key] || "small", key + label));
  return svg;
}
