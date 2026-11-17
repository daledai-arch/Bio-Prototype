/* Quiz dialog: ask(q) resolves true/false when answered, or null if closed. */
const $ = id => document.getElementById(id);
let pending = null, lastFocus = null;

function open(){ if ($("quiz").hidden){ lastFocus = document.activeElement; $("quiz").hidden = false; } }
function hide(){ $("quiz").hidden = true; if (lastFocus && lastFocus.focus) lastFocus.focus(); }
export function close(){ hide(); if (pending){ const r = pending; pending = null; r(null); } }
$("qclose").addEventListener("click", close);
document.addEventListener("keydown", e => { if (e.key === "Escape" && !$("quiz").hidden) close(); });

export function ask(q, title, meta){
  return new Promise(res => {
    pending = res; open();
    $("qtitle").textContent = title; $("qmeta").textContent = meta || "";
    const body = $("qbody");
    body.innerHTML = `<p class="qq">${q.q}</p>` +
      q.choices.map((c, i) => `<button class="qopt" data-i="${i}" type="button">${c}</button>`).join("") +
      `<div class="qwhy" aria-live="polite" hidden></div>`;
    body.querySelectorAll(".qopt").forEach(b => b.addEventListener("click", () => {
      const i = +b.dataset.i, ok = i === q.a;
      body.querySelectorAll(".qopt").forEach((x, j) => { x.disabled = true; if (j === q.a) x.classList.add("right"); else if (j === i) x.classList.add("wrong"); });
      const w = body.querySelector(".qwhy"); w.hidden = false;
      const predict = title === "Predict";
      w.innerHTML = `<p><b>${ok ? "Correct." : "Not quite."}</b> ${q.why} <span class="qsrc">${q.L}</span></p>` +
        `<button class="qnext" type="button">${predict ? "Watch it happen" : "Next"}</button>`;
      const next = w.querySelector(".qnext");
      next.addEventListener("click", () => { const r = pending; pending = null; if (predict) hide(); if (r) r(ok); });
      next.focus();
    }));
    body.querySelector(".qopt").focus();
  });
}

export function show(title, html){ open(); $("qtitle").textContent = title; $("qmeta").textContent = ""; $("qbody").innerHTML = html; }
