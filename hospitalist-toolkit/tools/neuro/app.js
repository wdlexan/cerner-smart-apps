/* Neuro (non-stroke) tab: page logic. READ-ONLY: reads the chart, orders nothing, sends nothing. UNVERIFIED draft written by Claude. */
const R = window.NeuroRules, REF = window.NeuroRef, C = window.NeuroChart;
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const fmt = (t) => new Date(t).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
const H = 36e5;

const state = { f: null, ticks: {}, auto: {}, pres: "all", typed: [], work: null, card: "weak", exam: {}, examKeys: {}, ms: {} };

/* ---------- presentation buttons: which findings groups to highlight ---------- */
const PRES = [
  ["all", "All"], ["weak", "Weakness"], ["back", "Back pain + neuro"], ["eyes", "Eyes / swallowing / breathing"],
  ["head", "Drowsy / headache / fall"], ["conf", "Confused / fever / seizure"], ["vert", "Vertigo"], ["ms", "Known MS, worse"]];
const PRES_GROUPS = {
  weak: ["Weakness pattern", "Signs", "Weakness from the top down", "Background (chart fills some)"], back: ["Signs", "Weakness pattern", "Weakness from the top down", "Background (chart fills some)"],
  eyes: ["Signs", "Weakness pattern", "Weakness from the top down", "Background (chart fills some)"], head: ["Head / level of consciousness", "Confusion, headache, fever", "Weakness pattern", "Background (chart fills some)"],
  conf: ["Confusion, headache, fever", "Head / level of consciousness", "Background (chart fills some)"],
  vert: ["Vertigo"], ms: ["Multiple sclerosis", "Signs", "Background (chart fills some)"] };
const PRES_CARD = { weak: "weak", back: "cord", eyes: "mg", head: "sdh", conf: "mening", vert: "vertigo", ms: "ms" };

function drawPres() {
  $("pres").innerHTML = "What's the problem? " + PRES.map(([k, l]) => `<button data-p="${k}" class="${state.pres === k ? "on" : ""}">${l}</button>`).join("");
  $("pres").querySelectorAll("button").forEach((b) => (b.onclick = () => {
    state.pres = b.dataset.p; if (PRES_CARD[state.pres] && !state.work) state.card = PRES_CARD[state.pres];
    drawPres(); drawTicks(); draw();
  }));
}

function drawTicks() {
  const show = PRES_GROUPS[state.pres];
  $("ticks").innerHTML = R.FINDINGS.map((g) => `<fieldset class="grp ${show && !show.includes(g.group) ? "dim" : ""}"><legend>${g.group}</legend><div class="ticks">` +
    g.items.map(([k, l]) => `<label><input type="checkbox" data-k="${k}" ${state.ticks[k] ? "checked" : ""}> <span>${esc(l)}${state.auto[k] ? `<span class="auto">chart: ${esc(state.auto[k])}</span>` : ""}</span></label>`).join("") +
    `</div></fieldset>`).join("");
  $("ticks").querySelectorAll("input[data-k]").forEach((i) => (i.onchange = () => { state.ticks[i.dataset.k] = i.checked; draw(); }));
}

/* ---------- where is the lesion (UMN / LMN / junction / muscle) ---------- */
const LOC_KEYS = ["hyperreflex", "spastic", "areflex", "flaccid", "wasting", "fascic", "reflexNormal", "sensOK", "sensLevel", "saddle", "hemi", "para", "prox", "fatig", "ptosis", "pupils", "distalNumb", "single", "hyperacute"];
function drawLoc() {
  $("locticks").innerHTML = LOC_KEYS.map((k) => `<label><input type="checkbox" data-lk="${k}" ${state.ticks[k] ? "checked" : ""}> <span>${esc(R.LABEL[k])}</span></label>`).join("");
  $("locticks").querySelectorAll("input[data-lk]").forEach((i) => (i.onchange = () => { state.ticks[i.dataset.lk] = i.checked; drawTicks(); draw(); }));
  const L = R.localize(state.ticks), lv = L.level ? R.LEVELS[L.level] : null;
  const dxNames = (ids) => ids.map((id) => (R.DX.find((d) => d.id === id) || {}).name).filter(Boolean).map((n) => n.split(" (")[0]).join(", ");
  $("locout").innerHTML = (lv ? `<div class="lvl"><b>Most likely level: ${esc(lv.name)}</b>${L.next ? ` <span>(or ${esc(R.LEVELS[L.next].name)})</span>` : ""}
      <div style="margin-top:4px"><b>First test:</b> ${esc(lv.test)}</div><div style="margin-top:4px"><b>Think of:</b> ${esc(dxNames(lv.dx))}</div></div>`
    : `<div class="muted">Tick reflexes, tone, bulk and sensation to see the level.</div>`)
    + L.warn.map((w) => `<div class="alert action">${esc(w)}</div>`).join("");
  $("locsum").textContent = lv ? lv.name.split(" (")[0] : "";
}

/* ---------- special bedside tests ---------- */
const EXAM_ALL = R.EXAM.flatMap((g) => g.tests);
function drawExam() {
  $("exam").innerHTML = R.EXAM.map((g) => {
    const done = g.tests.filter((t) => state.exam[t.id]).length, abn = g.tests.filter((t) => state.exam[t.id] === "abn").length;
    return `<details class="exgrp"${done ? " open" : ""}><summary>${esc(g.group)} <span class="muted" style="font-weight:normal">${done ? `${done} done${abn ? `, ${abn} abnormal` : ""}` : ""}</span></summary>` +
      g.tests.map((t) => `<div class="exrow ${state.exam[t.id] === "abn" ? "abn" : ""}"><div class="nm"><details><summary>${esc(t.name)}</summary>
          <div class="how"><b>How:</b> ${esc(t.how)}<br><b>Abnormal:</b> ${esc(t.abn)}<br><b>Means:</b> ${esc(t.means)}${t.sets.length ? `<br><span class="sets">Abnormal ticks: ${esc(t.sets.map((k) => R.LABEL[k]).join("; "))}</span>` : ""}</div></details></div>
        <div class="rad">${[["", "Not done"], ["normal", "Normal"], ["abn", "Abnormal"]].map(([v, l]) => `<label><input type="radio" name="ex-${t.id}" value="${v}"${(state.exam[t.id] || "") === v ? " checked" : ""}> ${l}</label>`).join("")}</div></div>`).join("") + `</details>`;
  }).join("");
  $("exam").querySelectorAll("input[type=radio]").forEach((r) => (r.onchange = () => { const id = r.name.slice(3); if (r.value) state.exam[id] = r.value; else delete state.exam[id]; applyExam(); drawExam(); drawTicks(); draw(); }));
  const n = Object.keys(state.exam).length, a = Object.values(state.exam).filter((v) => v === "abn").length;
  $("examsum").textContent = n ? `${n} done, ${a} abnormal` : "";
}
function applyExam() {
  const want = {}; EXAM_ALL.filter((t) => state.exam[t.id] === "abn").forEach((t) => t.sets.forEach((k) => (want[k] = true)));
  Object.keys(state.examKeys).forEach((k) => { if (!want[k]) { state.ticks[k] = false; delete state.examKeys[k]; } }); // undo ticks only the tests had set
  Object.keys(want).forEach((k) => { if (!state.ticks[k]) { state.ticks[k] = true; state.examKeys[k] = true; } });
}

/* ---------- MS relapse check ---------- */
function drawMS(x) {
  if ((state.ticks.knownMS || state.ticks.msNew) && !state.msOpened) { $("sec-ms").open = true; state.msOpened = true; }
  $("msq").innerHTML = R.MS_Q.map((q) => `<div class="msq"><div class="qq">${esc(q.q)}${q.k === "trig" && !state.ms.trig && x.pr && x.pr.triggers.length ? ` <span class="auto" style="color:var(--accent);font-size:11.5px">chart: ${esc(x.pr.triggers.join("; "))}</span>` : ""}</div>
      ${q.opts.concat([["", "Unknown"]]).map(([v, l]) => `<label><input type="radio" name="ms-${q.k}" value="${v}"${(state.ms[q.k] || "") === v ? " checked" : ""}> ${esc(l)}</label>`).join("")}</div>`).join("");
  $("msq").querySelectorAll("input[type=radio]").forEach((r) => (r.onchange = () => { const k = r.name.slice(3); if (r.value) state.ms[k] = r.value; else delete state.ms[k]; draw(); }));
  const m = x.msr, cls = m.verdict === "true" ? "c-no" : m.verdict === "pseudo" ? "c-yes" : "c-unknown";
  $("msout").innerHTML = m.verdict === "none" ? `<div class="muted" style="margin-top:6px">Answer the questions to get a verdict.</div>`
    : `<div class="lvl"><b>${m.verdict === "true" ? "True relapse likely" : m.verdict === "pseudo" ? "Pseudo-relapse likely" : "Unclear"}</b>
        <div style="margin-top:4px">${esc(m.text)}</div>
        <div class="muted" style="margin-top:4px;font-size:12px">For relapse: ${m.t} · for pseudo-relapse: ${m.p}</div></div>` + m.notes.map((n) => `<div class="alert action">${esc(n)}</div>`).join("")
      + (x.dmt.length && /natalizumab/i.test(x.dmt.join(" ")) ? `<div class="alert urgent">On natalizumab: new symptoms could be PML. Urgent MRI and neurology; JCV PCR in CSF.</div>` : "");
  $("mssum").textContent = m.verdict === "none" ? "" : m.verdict === "true" ? "true relapse likely" : m.verdict === "pseudo" ? "pseudo-relapse likely" : "unclear";
}

/* ---------- derived facts ---------- */
function facts() {
  const f = state.f || { labs: {}, resp: [], gcs: [], bladder: [], meds: [], conds: [], series: {} };
  const wt = parseFloat($("wt").value) || (f.weight && f.weight.v) || null;
  const respRows = (f.resp || []).concat(state.typed).sort((a, b) => a.t - b.t);
  const br = R.breathing(respRows, wt);
  const mg = R.mgCheck(f.meds);
  const at = R.antithrombotics(f.meds);
  const bl = f.bladder && f.bladder.length ? f.bladder[f.bladder.length - 1] : null;
  const gcs = R.gcsTrend(f.gcs);
  const ranked = R.rank(state.ticks);
  const L = f.labs;
  const pr = (state.ticks.knownMS || state.ticks.msNew) ? R.pseudoRelapse({ tempMax: f.tempMax, wbc: L.wbc ? L.wbc.v : null, crp: L.crp ? L.crp.v : null, uaPositive: f.ua ? f.ua.pos : null, heat: !!state.ticks.heat }) : null;
  const dmt = (f.meds || []).filter((m) => /natalizumab|ocrelizumab|ofatumumab|ublituximab|rituximab|fingolimod|siponimod|ozanimod|ponesimod|cladribine|alemtuzumab|dimethyl fumarate|diroximel|teriflunomide|glatiramer|interferon/i.test(m));
  const msr = R.msRelapse(state.ms, pr ? pr.triggers : []);
  return { f, wt, respRows, br, mg, at, bl, gcs, ranked, pr, msr, dmt, hints: R.hints(state.ticks) };
}

/* ---------- drawing ---------- */
function draw() {
  const x = facts();
  drawLoc(); drawMS(x); drawTiles(x); drawAlerts(x); drawDx(x); drawBreathing(x); drawMeds(x); drawLabs(x); drawCard(); NOTE.update();
}

function tile(k, big, s, cls) { return `<div class="tile ${cls || ""}"><div class="k">${k}</div><div class="big">${big}</div><div class="s">${s}</div></div>`; }
function drawTiles(x) {
  const t = [];
  const b = x.br;
  if (b.fvc || b.nif) t.push(tile("Breathing", b.fvcPerKg != null ? b.fvcPerKg + " mL/kg" : b.fvc ? b.fvc.fvc + " L" : "NIF " + b.nif.nif,
    [b.fvc ? `FVC ${b.fvc.fvc} L` : "", b.nif ? `NIF ${b.nif.nif}` : "", b.drop != null ? `${b.drop}% below best (48 h)` : ""].filter(Boolean).join(" · "), b.icu ? "t3" : b.flags.length ? "t2" : "t0"));
  if (x.bl) { const r = R.bladder(x.bl.v); t.push(tile("Bladder scan", x.bl.v + " mL", fmt(x.bl.t), r.lvl === "urgent" ? "t3" : r.lvl === "action" ? "t2" : "t0")); }
  if (x.gcs) t.push(tile("GCS", x.gcs.cur, x.gcs.drop ? `best ${x.gcs.best}, down ${x.gcs.drop}` : "stable", x.gcs.lvl === "urgent" ? "t3" : x.gcs.lvl === "action" ? "t2" : "t0"));
  if (x.at.length) t.push(tile("Antithrombotic", x.at.length, x.at.map((a) => esc(a.med)).join("<br>"), "t2"));
  if (x.mg.some((m) => m.lvl === "avoid" || m.lvl === "caution")) t.push(tile("MG risk medicines", x.mg.filter((m) => m.lvl === "avoid" || m.lvl === "caution").length, "see Medicines", state.ticks.knownMG || state.ticks.fatig || state.ticks.ptosis ? "t3" : "t1"));
  if (x.ranked.length) t.push(tile("Top of the list", "", esc(x.ranked[0].name), x.ranked[0].urg === "now" ? "t3" : x.ranked[0].urg === "today" ? "t2" : "t1"));
  $("tiles").innerHTML = t.join("");
}

function alert(lvl, b, text) { return `<div class="alert ${lvl}"><b>${b}</b>${text}</div>`; }
function drawAlerts(x) {
  const a = [], T = state.ticks;
  x.br.flags.forEach((fl) => a.push(alert(fl.lvl === "urgent" ? "urgent" : "action", "Breathing:", esc(fl.text))));
  if (x.bl) { const r = R.bladder(x.bl.v); if (r.lvl !== "ok") a.push(alert(r.lvl === "urgent" ? "urgent" : "action", "Bladder:", esc(r.text))); }
  if (x.gcs && x.gcs.lvl !== "ok") a.push(alert(x.gcs.lvl === "urgent" ? "urgent" : "action", "GCS:", esc(x.gcs.text)));
  if (x.hints && x.hints.lvl !== "info") a.push(alert(x.hints.lvl === "urgent" ? "urgent" : "info", "Vertigo:", esc(x.hints.text)));
  if (x.msr.verdict !== "none") a.push(alert(x.msr.verdict === "pseudo" ? "action" : "info", "MS:", esc(x.msr.text)));
  else if (x.pr) a.push(alert(x.pr.verdict === "pseudo" ? "action" : "info", "MS:", esc(x.pr.text)));
  const cord = x.ranked.find((d) => d.id === "cord" || d.id === "cauda");
  if (cord && cord.score >= 5) a.push(alert("urgent", "Cord / cauda equina:", "MRI whole spine now (within 24 h at the latest). " + (T.cancer ? "Cancer history: dexamethasone 16 mg now, do not wait for MRI. " : "") + "Call spine surgery."));
  if ((T.drowsy || T.fall) && x.at.some((q) => q.kind !== "antiplatelet" && q.kind !== "VTE prophylaxis dose")) a.push(alert("urgent", "Head injury on anticoagulant:", "CT head now; if bleeding, reverse (see Medicines)."));
  if ((T.knownMG || T.fatig || T.ptosis) && x.mg.some((m) => m.lvl === "avoid")) a.push(alert("urgent", "Myasthenia:", "Medicines to avoid are ordered: " + x.mg.filter((m) => m.lvl === "avoid").map((m) => esc(m.med)).join("; ") + "."));
  if (x.dmt.some((m) => /natalizumab/i.test(m)) && (T.knownMS || T.msNew)) a.push(alert("action", "Natalizumab:", "new symptoms: think PML; MRI and discuss with the MS clinic before calling it a relapse."));
  if (T.lowK) a.push(alert("action", "Potassium:", `${esc(state.auto.lowK || "low K")}: replace and recheck; low K alone can cause weakness.`));
  $("alerts").innerHTML = a.length ? a.join("") : `<div class="muted">Nothing urgent from the ticks and chart. Keep examining.</div>`;
  $("alertsum").textContent = a.length ? a.length + " item" + (a.length > 1 ? "s" : "") : "";
}

function drawDx(x) {
  if (!x.ranked.length) { $("dxlist").innerHTML = `<div class="muted">Pick the problem above and tick what you find; the list appears here.</div>`; $("dxsum").textContent = ""; return; }
  $("dxlist").innerHTML = x.ranked.map((d) => `<div class="dx ${state.work === d.id ? "work" : ""}">
      <span class="chip u-${d.urg}">${d.urg === "now" ? "NOW" : d.urg === "today" ? "TODAY" : "routine"}</span>
      <div><div class="nm">${esc(d.name)}${d.cantMiss ? ` <span class="chip c-no">can't miss</span>` : ""}</div><div class="why">${esc(d.why.join(" · "))}</div></div>
      <span class="sp"></span>
      ${d.card ? `<button data-card="${d.card}">Tests & treatment</button>` : d.id === "stroke" ? `<span class="muted">Stroke tab</span>` : ""}
      <button data-work="${d.id}" class="primary">${state.work === d.id ? "Working diagnosis ✓" : "Set as working"}</button></div>`).join("");
  $("dxlist").querySelectorAll("[data-card]").forEach((b) => (b.onclick = () => { state.card = b.dataset.card; drawCard(); $("card").scrollIntoView({ behavior: "smooth" }); }));
  $("dxlist").querySelectorAll("[data-work]").forEach((b) => (b.onclick = () => {
    state.work = state.work === b.dataset.work ? null : b.dataset.work;
    const d = R.DX.find((q) => q.id === state.work); if (d && d.card) state.card = d.card; draw();
  }));
  $("dxsum").textContent = x.ranked.length + " to consider";
}

function spark(rows, key, w, h, lo, hi) {
  const pts = rows.filter((r) => r[key] != null); if (pts.length < 2) return "";
  const t0 = pts[0].t, t1 = pts[pts.length - 1].t, X = (t) => 30 + ((t - t0) / (t1 - t0 || 1)) * (w - 40), Y = (v) => h - 15 - ((v - lo) / (hi - lo)) * (h - 25);
  return pts.map((p) => [X(p.t), Y(p[key])]);
}
function drawBreathing(x) {
  const rows = x.respRows;
  if (!rows.length) { $("brtable").innerHTML = `<div class="muted">No FVC/NIF in the chart. Add bedside values below (respiratory therapy can measure them).</div>`; $("spark").innerHTML = ""; $("brsum").textContent = ""; return; }
  const wt = x.wt;
  $("brtable").innerHTML = `<table><tr><th>When</th><th class="num">FVC (L)</th><th class="num">FVC mL/kg</th><th class="num">NIF</th><th class="num">MEP</th><th></th></tr>` + rows.map((r) => {
    const pk = r.fvc != null && wt ? Math.round((r.fvc * 1000) / wt) : null;
    return `<tr><td>${fmt(r.t)}</td><td class="num">${r.fvc ?? ""}</td><td class="num ${pk != null && pk < 20 ? "hi" : ""}">${pk ?? ""}</td><td class="num ${r.nif != null && -Math.abs(r.nif) > -30 ? "hi" : ""}">${r.nif ?? ""}</td><td class="num ${r.mep != null && r.mep < 40 ? "hi" : ""}">${r.mep ?? ""}</td><td class="muted">${r.typed ? "typed" : "chart"}</td></tr>`;
  }).join("") + `</table>`;
  const W = 520, Hh = 110, fvcMax = Math.max(4, ...rows.filter((r) => r.fvc != null).map((r) => r.fvc));
  const p = spark(rows, "fvc", W, Hh, 0, fvcMax);
  let svg = "";
  if (p) {
    const thr = wt ? (20 * wt) / 1000 : null, Y = (v) => Hh - 15 - (v / fvcMax) * (Hh - 25);
    svg = `<svg width="100%" viewBox="0 0 ${W} ${Hh}" style="max-width:${W}px"><text x="2" y="12">FVC (L)</text>` +
      (thr ? `<line x1="30" x2="${W - 10}" y1="${Y(thr)}" y2="${Y(thr)}" stroke="var(--r-ink)" stroke-dasharray="4 3"/><text x="${W - 120}" y="${Y(thr) - 3}">20 mL/kg = ${thr.toFixed(2)} L</text>` : "") +
      `<polyline fill="none" stroke="var(--accent)" stroke-width="2" points="${p.map((q) => q.join(",")).join(" ")}"/>` +
      p.map((q) => `<circle cx="${q[0]}" cy="${q[1]}" r="3" fill="var(--accent)"/>`).join("") + `</svg>`;
  }
  $("spark").innerHTML = svg;
  $("brsum").textContent = x.br.icu ? "ICU threshold met" : x.br.flags.length ? "watch closely" : "no threshold met";
}

function drawMeds(x) {
  const out = [];
  if (!x.f.meds.length) { $("meds").innerHTML = `<div class="muted">No medicines read from the chart.</div>`; $("medsum").textContent = ""; return; }
  out.push(`<h3 style="font-size:14px;margin:6px 0">Myasthenia: medicines that can make it worse</h3>`);
  out.push(x.mg.length ? `<table><tr><th>Medicine</th><th>Level</th><th>Why</th></tr>` + x.mg.map((m) => `<tr><td class="wrap">${esc(m.med)}</td><td><span class="chip ${m.lvl === "avoid" ? "c-no" : m.lvl === "caution" ? "c-unknown" : "c-yes"}">${m.lvl}</span></td><td class="wrap">${esc(m.why)}</td></tr>`).join("") + `</table>` : `<div class="muted">None of the listed MG-risk medicines found.</div>`);
  out.push(`<h3 style="font-size:14px;margin:12px 0 6px">Antithrombotics and reversal (subdural, epidural hematoma, before LP or surgery)</h3>`);
  const L = x.f.labs;
  const coag = ["inr", "aptt", "plt", "fib", "antixa", "cr"].filter((k) => L[k]).map((k) => `${L[k].label} ${L[k].v}`).join(" · ");
  out.push(x.at.length ? `<table><tr><th>Medicine</th><th>Type</th><th>Reversal if bleeding</th></tr>` + x.at.map((a) => `<tr><td class="wrap">${esc(a.med)}</td><td>${esc(a.kind)}</td><td class="wrap">${esc(a.rev)}</td></tr>`).join("") + `</table>` : `<div class="muted">No anticoagulant or antiplatelet found.</div>`);
  if (coag) out.push(`<div class="muted" style="margin-top:4px">Latest: ${esc(coag)}</div>`);
  if (x.dmt.length) out.push(`<h3 style="font-size:14px;margin:12px 0 6px">MS disease-modifying therapy</h3><div>${x.dmt.map(esc).join("; ")}. ${x.dmt.some((m) => /natalizumab/i.test(m)) ? "<b>Natalizumab: PML risk.</b> " : ""}${x.dmt.some((m) => /ocrelizumab|ofatumumab|rituximab|ublituximab|alemtuzumab|cladribine/i.test(m)) ? "B-cell depleting or strong immunosuppression: higher infection risk." : ""}</div>`);
  $("meds").innerHTML = out.join("");
  $("medsum").textContent = [x.mg.filter((m) => m.lvl === "avoid").length ? x.mg.filter((m) => m.lvl === "avoid").length + " MG avoid" : "", x.at.length ? x.at.length + " antithrombotic" : ""].filter(Boolean).join(" · ");
}

const LAB_FLAG = { k: (v) => v < 3.5 || v > 5.5, na: (v) => v < 133 || v > 146, ca: (v) => v < 2.1 || v > 2.6, mg: (v) => v < 0.7, phos: (v) => v < 0.8, glu: (v) => v < 4 || v > 11,
  ck: (v) => v > 400, tsh: (v) => v < 0.3 || v > 5, b12: (v) => v < 150, crp: (v) => v > 10, wbc: (v) => v > 11 || v < 4, plt: (v) => v < 100, inr: (v) => v > 1.3, fib: (v) => v < 1.5 };
function drawLabs(x) {
  const L = x.f.labs, rows = C.LABS.filter((d) => L[d.id]);
  if (!rows.length) { $("labs").innerHTML = `<div class="muted">No labs read. For weakness send: CBC, Na, K, Ca, Mg, phosphate, glucose, creatinine, CK, TSH, B12, HbA1c, CRP.</div>`; $("labsum").textContent = ""; return; }
  const missing = ["k", "ca", "mg", "phos", "ck", "tsh", "b12", "glu"].filter((k) => !L[k]).map((k) => C.LABS.find((d) => d.id === k).label);
  $("labs").innerHTML = `<table><tr><th>Test</th><th>Latest</th><th>Unit</th><th>When</th></tr>` + rows.map((d) => { const l = L[d.id]; return `<tr><td>${d.label}</td><td class="num ${LAB_FLAG[d.id] && LAB_FLAG[d.id](l.v) ? "hi" : ""}">${l.v}</td><td>${d.unit}</td><td class="muted">${fmt(l.t)}</td></tr>`; }).join("") + `</table>` +
    (missing.length ? `<div class="muted" style="margin-top:6px">Not found in 30 days (weakness screen): ${missing.join(", ")}.</div>` : "") +
    (x.f.ua ? `<div style="margin-top:6px">Urinalysis: ${x.f.ua.pos ? "<b>leukocyte esterase or nitrite positive</b>" : "negative"} (${fmt(x.f.ua.t)}).</div>` : "");
  $("labsum").textContent = rows.length + " found";
}

function drawCard() {
  $("cardsel").innerHTML = REF.CARDS.map((c) => `<option value="${c.id}" ${state.card === c.id ? "selected" : ""}>${esc(c.title)}</option>`).join("");
  const c = REF.byId[state.card]; if (!c) { $("card").innerHTML = ""; return; }
  const ul = (a) => (a && a.length ? `<ul>${a.map((s) => `<li>${esc(s)}</li>`).join("")}</ul>` : `<div class="muted">—</div>`);
  $("card").innerHTML = `<h3 style="margin:6px 0">${esc(c.title)}</h3>
    <div class="redbox"><b>Red flags / call now</b>${ul(c.red)}</div>
    <h4>Tests to order</h4><table>${c.tests.map(([a, b]) => `<tr><td>${esc(a)}</td><td>${esc(b)}</td></tr>`).join("")}</table>
    <h4>Treatment now</h4>${ul(c.now)}<h4>This admission</h4>${ul(c.adm)}
    ${c.avoid.length ? `<h4>Avoid</h4>${ul(c.avoid)}` : ""}<h4>Who to call and when</h4>${ul(c.call)}
    <h4>Monitor</h4>${ul(c.mon)}${c.dc.length ? `<h4>Discharge and return advice</h4>${ul(c.dc)}` : ""}`;
}
$("cardsel").onchange = () => { state.card = $("cardsel").value; drawCard(); NOTE.update(); };

/* ---------- note draft ---------- */
function neuroNote() {
  const x = facts(), T = state.ticks, S = { assess: [], data: [], plan: [] };
  const found = Object.keys(T).filter((k) => T[k]).map((k) => R.LABEL[k]);
  if (!found.length && !x.respRows.length && !x.f.meds.length) return null;
  const work = state.work ? R.DX.find((d) => d.id === state.work) : null;
  if (work) S.assess.push("Working diagnosis: " + work.name + ".");
  if (found.length) S.assess.push("Findings: " + found.join("; ") + ".");
  const exAbn = EXAM_ALL.filter((t) => state.exam[t.id] === "abn").map((t) => t.name), exNorm = EXAM_ALL.filter((t) => state.exam[t.id] === "normal").map((t) => t.name);
  if (exAbn.length || exNorm.length) S.data.push("Bedside tests: " + [exAbn.length ? "abnormal: " + exAbn.join(", ") : "", exNorm.length ? "normal: " + exNorm.join(", ") : ""].filter(Boolean).join("; ") + ".");
  const loc = R.localize(T); if (loc.level) S.assess.push("Localization: " + R.LEVELS[loc.level].name + (loc.next ? " (or " + R.LEVELS[loc.next].name + ")" : "") + ".");
  const others = x.ranked.filter((d) => d.id !== state.work).slice(0, 4);
  if (others.length) S.assess.push((work ? "Also considered: " : "Differential: ") + others.map((d) => d.name + (d.cantMiss ? " (can't miss)" : "")).join("; ") + ".");
  if (x.hints && x.hints.lvl !== "info") S.assess.push(x.hints.text);
  if (x.msr.verdict !== "none") { S.assess.push("MS: " + x.msr.text); x.msr.notes.forEach((n) => S.assess.push(n)); }
  else if (x.pr) S.assess.push(x.pr.text);
  const b = x.br;
  if (b.fvc || b.nif) S.data.push("Breathing: " + [b.fvc ? `FVC ${b.fvc.fvc} L${b.fvcPerKg != null ? ` (${b.fvcPerKg} mL/kg)` : ""}` : "", b.nif ? `NIF ${b.nif.nif}` : "", b.mep ? `MEP ${b.mep.mep}` : "", b.drop ? `${b.drop}% below best in 48 h` : ""].filter(Boolean).join(", ") + (b.icu ? " — meets ICU threshold." : "."));
  if (x.bl) S.data.push(`Bladder scan ${x.bl.v} mL (${fmt(x.bl.t)}).`);
  if (x.gcs) S.data.push(x.gcs.text);
  const L = x.f.labs, lab = Object.keys(L).map((k) => `${L[k].label} ${L[k].v}`);
  if (lab.length) S.data.push("Labs: " + lab.join(", ") + ".");
  if (x.at.length) S.data.push("Antithrombotics: " + x.at.map((a) => a.med).join("; ") + ".");
  const mgBad = x.mg.filter((m) => m.lvl === "avoid" || m.lvl === "caution");
  if (mgBad.length && (T.knownMG || T.fatig || T.ptosis || state.work === "mg")) S.data.push("MG-risk medicines: " + mgBad.map((m) => `${m.med} (${m.lvl})`).join("; ") + ".");
  const c = REF.byId[state.card];
  if (c) {
    c.tests.filter(([a]) => !/where is|definition/i.test(a)).forEach(([a, b]) => S.plan.push(`${a}: ${b}`));
    c.now.forEach((s) => S.plan.push(s));
    if (c.call.length) S.plan.push("Consult: " + c.call.join(" "));
    if (c.mon.length) S.plan.push("Monitor: " + c.mon.join(" "));
  }
  return { stamp: Date.now(), heading: "NEUROLOGY" + (work ? ": " + work.name.toUpperCase() : ""), sections: S };
}
const NOTE = NoteDraft.mount($("note"), {
  title: "Neuro",
  sections: [{ id: "assess", label: "Assessment" }, { id: "data", label: "Chart data", noteLabel: "Data" }, { id: "plan", label: "Plan" }],
  build: neuroNote
});

/* ---------- typed FVC / NIF ---------- */
function nowLocal() { const d = new Date(Date.now() - new Date().getTimezoneOffset() * 60e3); return d.toISOString().slice(0, 16); }
$("b-t").value = nowLocal();
$("b-add").onclick = () => {
  const t = new Date($("b-t").value).getTime() || Date.now(), r = { t, typed: true };
  const fv = parseFloat($("b-fvc").value), ni = parseFloat($("b-nif").value), me = parseFloat($("b-mep").value);
  if (!isNaN(fv)) r.fvc = fv > 20 ? fv / 1000 : fv; if (!isNaN(ni)) r.nif = -Math.abs(ni); if (!isNaN(me)) r.mep = me;
  if (r.fvc == null && r.nif == null && r.mep == null) return;
  state.typed.push(r); ["b-fvc", "b-nif", "b-mep"].forEach((i) => ($(i).value = "")); $("b-t").value = nowLocal(); draw();
};
$("wt").oninput = draw;

/* ---------- loading ---------- */
function autoTicks(f) {
  const a = Object.assign({}, f.auto), at = R.antithrombotics(f.meds);
  const ac = at.filter((q) => q.kind !== "antiplatelet" && q.kind !== "VTE prophylaxis dose"), ap = at.filter((q) => q.kind === "antiplatelet");
  if (ac.length) a.anticoag = ac.map((q) => q.med.split(" ")[0]).join(", ");
  if (ap.length) a.antiplt = ap.map((q) => q.med.split(" ")[0]).join(", ");
  return a;
}
function load(raw, note, errors, preset) {
  state.f = raw ? C.parse(raw) : null; state.typed = []; state.work = null;
  state.auto = state.f ? autoTicks(state.f) : {};
  state.ticks = {}; state.exam = {}; state.examKeys = {}; state.ms = {}; state.msOpened = false; Object.keys(state.auto).forEach((k) => (state.ticks[k] = true));
  if (preset) { (preset.ticks || []).forEach((k) => (state.ticks[k] = true)); state.card = preset.card || state.card; }
  $("wt").value = state.f && state.f.weight ? state.f.weight.v : "";
  const p = raw && raw.patient, nm = p && p.name && p.name[0];
  $("ptsum").textContent = nm ? `${(nm.given || []).join(" ")} ${nm.family || ""}${state.f.ageYears != null ? " · " + state.f.ageYears + " y" : ""}` : "";
  $("pstatus").textContent = note; $("clear").hidden = !raw;
  $("errs").innerHTML = errors && errors.length ? "Could not read: " + errors.map(esc).join("; ") + (errors.some((e) => /\b40[13]\b|Unauthorized|Forbidden/i.test(e)) ? ". Check the scopes in the Code Console." : ". Cerner's sandbox can be slow: reload the patient to try again.") : "";
  drawExam(); drawTicks(); draw(); NOTE.reset();
}
$("clear").onclick = () => { $("testsel").value = ""; load(null, "Open from Cerner to read the chart, or pick a made-up patient:"); };
const SAMPLES = window.NEURO_SAMPLES || [];
SAMPLES.forEach((p, i) => { const o = document.createElement("option"); o.value = i; o.textContent = p.label; $("testsel").appendChild(o); });
$("testsel").onchange = () => { const p = SAMPLES[$("testsel").value]; if (!p) return $("clear").onclick(); load(p.build(Date.now()), "Made-up patient: " + p.label, [], p); };

async function fromChart() {
  if (typeof FHIR === "undefined" || !(location.search.includes("code=") || location.search.includes("complete=") || sessionStorage.getItem("SMART_KEY"))) return;
  $("pstatus").textContent = "Reading the chart…";
  try {
    const client = await FHIR.oauth2.ready();
    const { raw, errors } = await C.gather(client, (msg) => ($("pstatus").textContent = msg));
    load(raw, "Chart read (read-only). Nothing is sent anywhere. Tick what you find at the bedside.", errors);
  } catch (e) { $("pstatus").textContent = "Could not read the chart: " + (e && e.message ? e.message : e) + ". The made-up patients still work."; }
}
drawPres(); drawExam(); drawTicks(); draw(); fromChart();
// ?demo=1..6 opens a made-up patient directly
(() => { const d = parseInt(new URLSearchParams(location.search).get("demo"), 10); if (d >= 1 && d <= SAMPLES.length) { $("testsel").value = d - 1; $("testsel").onchange(); } })();
