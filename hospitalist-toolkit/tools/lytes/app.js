/* Electrolytes page (K, PO4, Ca). Read-only from the chart; typed values stay in this page. UNVERIFIED draft. */
const R = window.LytesRules, C = window.LytesChart, REF = window.LYTES_REF, ORDER = window.LYTES_ORDER, DAY = C.DAY, HR = C.HR;
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const fmtDT = (t) => new Date(t).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
const ago = (t) => { const h = (Date.now() - t) / HR; return h < 1 ? Math.max(1, Math.round(h * 60)) + " min ago" : h < 48 ? Math.round(h) + " h ago" : Math.round(h / 24) + " d ago"; };
const rd = (v, d) => (v == null || isNaN(v) ? null : Math.round(v * Math.pow(10, d)) / Math.pow(10, d));
const DEC = { K: 1, phos: 2, Ca: 2, iCa: 2, Mg: 2, glucose: 1, weight: 1, wbc: 1, PTH: 1, uCr: 1 };
const fmt = (k, v) => (v == null ? "" : String(rd(v, DEC[k] != null ? DEC[k] : 0)));

const MF = ["K", "phos", "Ca", "iCa", "Mg", "albumin", "creatinine", "glucose", "tCO2", "Na", "weight", "QTc", "CK", "urate", "LDH", "plt", "wbc", "PTH", "vitD", "uK", "uCr"];
/* how old a chart value may be (hours) to be used */
const AGE = { K: 72, phos: 72, Ca: 72, iCa: 72, Mg: 72, albumin: 168, creatinine: 72, glucose: 24, tCO2: 72, Na: 72, weight: 336, QTc: 168, CK: 168, urate: 168, LDH: 168, plt: 168, wbc: 168, PTH: 8760, vitD: 8760, uK: 168, uCr: 168 };
const NAMES = { K: "Potassium", phos: "Phosphate", Ca: "Calcium" };
const state = { f: null, x: {} };

/* ---- values ---- */
function chartVals() {
  const out = {}, f = state.f; if (!f) return out;
  MF.forEach((k) => { const e = C.latest(f.c[k], AGE[k] * HR); if (e) out[k] = e; });
  return out;
}
function typed() { const o = {}; MF.forEach((k) => { const v = parseFloat($("m-" + k).value); o[k] = isFinite(v) ? v : null; }); return o; }
function merged() {
  const t = typed(), c = chartVals(), v = {}, src = {};
  MF.forEach((k) => { if (t[k] != null) { v[k] = t[k]; src[k] = "typed"; } else if (c[k]) { v[k] = rd(c[k].v, 3); src[k] = "chart"; } else v[k] = null; });
  if (state.f) {
    v.age = state.f.age; v.sex = state.f.sex;
    if (src.creatinine === "chart") v.crRise = C.crRise(state.f.c.creatinine);
    if (src.K === "chart") { const p = C.previous(state.f.c.K, c.K, 4, 48); if (p) v.Kprev = { v: p.v, when: fmtDT(p.t) }; }
  }
  return { v, src, chart: c };
}
const bedside = () => ({ ecg: $("x-ecg").checked, symptoms: $("x-symptoms").checked, npo: $("x-npo").checked, dialysis: $("x-dialysis").checked });

/* ---- drawing ---- */
const SEVCLS = ["t0", "t1", "t2", "t3"];
function tile(k, big, s, cls) { return `<div class="tile ${cls || ""}"><div class="k">${esc(k)}</div><div class="big">${big == null || big === "" ? "–" : esc(big)}</div><div class="s">${s || ""}</div></div>`; }
const sevWord = (g) => (!g ? "" : g.dir === "normal" ? "normal" : R.SEV[g.sev] + " " + (g.dir === "low" ? "low" : "high"));
const ageNote = (m, k) => (m.src[k] === "typed" ? "typed" : m.chart[k] ? ago(m.chart[k].t) : "");

function draw() {
  const m = merged(), v = m.v, x = bedside(), a = R.assess(v, x, state.f ? state.f.medNames : [], state.f ? state.f.probs : []);
  state.last = { m, a, x };
  const t = typed();
  MF.forEach((k) => {
    const el = $("m-" + k), c = m.chart[k], span = el.parentNode.querySelector(".u"), r = R.RANGES[k];
    el.placeholder = c ? fmt(k, c.v) : ""; el.title = c ? "Chart: " + fmt(k, c.v) + " (" + fmtDT(c.t) + (c.shown && c.shown.trim() !== fmt(k, c.v) ? ", reported " + c.shown : "") + ")" : "";
    el.classList.toggle("typed", t[k] != null);
    if (span && !span.dataset.u) span.dataset.u = span.textContent.trim();
    if (span && r && r.t) span.innerHTML = esc(span.dataset.u) + ' · <span class="rng">' + esc(r.t) + "</span>";
    const val = v[k], out = r && val != null && ((r.lo != null && val < r.lo) || (r.hi != null && val > r.hi));
    el.classList.toggle("out", !!out); el.parentNode.classList.toggle("outrow", !!out);
  });
  const nt = MF.filter((k) => t[k] != null).length;
  $("m-clear").hidden = !nt; $("msum").textContent = nt ? nt + " typed" : "";
  $("m-src").textContent = a.v.eGFR != null ? "eGFR (CKD-EPI 2021) " + a.v.eGFR + " mL/min/1.73m²" : state.f ? "eGFR needs creatinine, age and sex" : "";

  // tiles
  const g = a.g, ca = g.Ca;
  $("tiles").innerHTML =
    tile("Potassium", fmt("K", v.K), g.K ? sevWord(g.K) + " · " + ageNote(m, "K") : "no value", g.K ? SEVCLS[g.K.sev] : "") +
    tile("Phosphate", fmt("phos", v.phos), g.phos ? sevWord(g.phos) + " · " + ageNote(m, "phos") : "no value", g.phos ? SEVCLS[g.phos.sev] : "") +
    tile("Calcium" + (ca ? " (" + ca.basis + ")" : ""), ca ? rd(ca.val, 2) : null, ca ? sevWord(ca) + (ca.basis === "ionized" && ca.corr != null ? " · corrected total " + ca.corr : ca.basis === "corrected" ? " · total " + fmt("Ca", v.Ca) + ", albumin " + fmt("albumin", v.albumin) : "") : "no value", ca ? SEVCLS[ca.sev] : "") +
    tile("Magnesium", fmt("Mg", v.Mg), g.Mg ? sevWord(g.Mg) + " · " + ageNote(m, "Mg") : "no value: check it", g.Mg ? SEVCLS[g.Mg.sev] : "t1") +
    tile("eGFR", a.v.eGFR, (v.creatinine != null ? "creatinine " + fmt("creatinine", v.creatinine) : "") + (v.crRise ? " · <b>rising</b>" : "") + (x.dialysis ? " · dialysis" : ""), a.v.eGFR == null ? "" : a.v.eGFR < 15 ? "t3" : a.v.eGFR < 30 ? "t2" : a.v.eGFR < 60 ? "t1" : "t0");

  // flags
  const order = { urgent: 0, action: 1, info: 2 }, fl = a.flags.slice().sort((p, q) => order[p.lvl] - order[q.lvl]);
  $("alerts").innerHTML = fl.length ? fl.map((f) => `<div class="alert ${f.lvl}">${esc(f.text)}</div>`).join("") : `<div class="muted">${state.f || nt ? "None found." : "Load a patient or type values."}</div>`;
  $("alertsum").textContent = fl.length ? fl.filter((f) => f.lvl === "urgent").length + " urgent, " + fl.length + " total" : "";

  ["K", "phos", "Ca"].forEach((e) => drawPlan(e, a, m));
  drawMeds(a); drawRef(a); NOTE.update();
}

function drawPlan(e, a, m) {
  const gr = a.g[e], p = a.plans[e], body = $("body-" + e), sum = $("sum-" + e);
  if (!gr) { sum.innerHTML = '<span class="muted">no value</span>'; body.innerHTML = `<div class="muted">No ${NAMES[e].toLowerCase()} in the chart (3 days). Type a value above, or open the reference: ${refLinks(e)}</div>`; return; }
  const chipCls = SEVCLS[gr.sev];
  sum.innerHTML = `<span class="chip ${chipCls}">${esc(sevWord(gr))}</span>`;
  if (!p) { body.innerHTML = `<div class="muted">${esc(NAMES[e])} is in the normal range${e === "Ca" ? " (" + esc(gr.basis) + " " + esc(gr.val) + ")" : ""}. Reference: ${refLinks(e)}</div>`; return; }
  const ref = REF[p.key];
  const causes = p.causes.length ? "<ul>" + p.causes.map((c) => `<li>${esc(c.text)}${c.why ? ` <span class="why">(${esc(c.why)})</span>` : ""}</li>`).join("") + "</ul>" : '<div class="muted">No cause found in the medications, problem list or labs read. See the full list in the reference below.</div>';
  const tiers = { now: "Now", next: "Next", also: "Also" };
  const treat = "<ul>" + p.treat.map((t) => `<li><span class="tier ${t.tier}">${tiers[t.tier]}</span>${esc(t.text)}</li>`).join("") + "</ul>";
  body.innerHTML = `<div class="muted">${esc(ref.grade)}</div>
    <h3>Possible causes in this patient</h3>${causes}
    <h3>Treatment and monitoring</h3>${treat}
    <div class="src">${esc(a.doseNote)} Symptoms: ${esc(ref.symptoms)}</div>
    <div class="row noprint"><button class="linkbtn" data-ref="${p.key}">Full reference: ${esc(ref.title)}</button></div>`;
  body.querySelectorAll("[data-ref]").forEach((b) => (b.onclick = () => openRef(b.dataset.ref)));
}
function refLinks(e) {
  const keys = ORDER.filter((k) => REF[k].el === ({ K: "K", phos: "PO4", Ca: "Ca" })[e]);
  setTimeout(() => document.querySelectorAll("[data-ref]").forEach((b) => (b.onclick = () => openRef(b.dataset.ref))));
  return keys.map((k) => `<button class="linkbtn" data-ref="${k}">${esc(REF[k].title)}</button>`).join(" · ");
}
function openRef(key) { $("sec-ref").open = true; const d = $("ref-" + key); if (d) { d.open = true; d.scrollIntoView({ behavior: "smooth", block: "start" }); } }

function drawRef(a) {
  const hit = Object.values(a.plans).map((p) => p.key);
  if (!$("ref").dataset.built) {
    $("ref").innerHTML = ORDER.map((k) => { const r = REF[k];
      return `<details id="ref-${k}"><summary>${esc(r.title)}</summary><div class="in">
        <table><tr><td>Grading</td><td>${esc(r.grade)}</td></tr><tr><td>Symptoms and ECG</td><td>${esc(r.symptoms)}</td></tr>
        ${r.causes.map((c) => `<tr><td>Cause: ${esc(c[0])}</td><td>${esc(c[1])}</td></tr>`).join("")}
        <tr><td>Tests</td><td><ul style="margin:0;padding-left:18px">${r.tests.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></td></tr>
        ${r.treat.map((c) => `<tr><td>Treat: ${esc(c[0])}</td><td>${esc(c[1])}</td></tr>`).join("")}
        <tr><td>Pearls</td><td><ul style="margin:0;padding-left:18px">${r.pearls.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></td></tr></table>
        <div class="src">Unverified draft from general knowledge: check before use.</div></div></details>`; }).join("");
    $("ref").dataset.built = "1";
  }
  ORDER.forEach((k) => $("ref-" + k).classList.toggle("hit", hit.indexOf(k) > -1));
}

function drawMeds(a) {
  const LBL = { acei: "ACE inhibitor", arb: "ARB / ARNI", mra: "MRA", ksparing: "K-sparing diuretic", tmp: "Trimethoprim", nsaid: "NSAID", heparin: "Heparin / LMWH", cni: "Calcineurin inhibitor", bb: "Beta-blocker",
    digoxin: "Digoxin", ksupp: "K supplement", kbinder: "K binder", loop: "Loop diuretic", thiazide: "Thiazide", insulin: "Insulin", beta2: "Beta-agonist", ampho: "Amphotericin", steroid: "Corticosteroid", laxative: "Laxative",
    phosLaxative: "Phosphate enema / prep", phosSupp: "Phosphate supplement", ivIron: "IV iron", binder: "Phosphate binder", caSupp: "Calcium", vitD: "Vitamin D", lithium: "Lithium", antiresorptive: "Bisphosphonate / denosumab",
    cinacalcet: "Calcimimetic", pth: "PTH analogue", ppi: "PPI", foscarnet: "Foscarnet", cisplatin: "Cisplatin", aminoglyc: "Aminoglycoside", antiepileptic: "Enzyme-inducing AED", tenofovir: "Tenofovir", sglt2: "SGLT2 inhibitor", calcitriol: "Active vitamin D" };
  const rows = Object.keys(LBL).filter((k) => a.meds[k] && a.meds[k].length && k !== "calcitriol").map((k) => `<tr><td>${esc(LBL[k])}</td><td>${esc(a.meds[k].join("; "))}</td></tr>`);
  const PL = { ckd: "CKD", dialysis: "Dialysis", hf: "Heart failure", af: "AF", cirrhosis: "Cirrhosis", alcohol: "Alcohol", malnutrition: "Malnutrition / eating disorder", malignancy: "Cancer", granuloma: "Granulomatous", hyperpara: "Hyperparathyroidism", hypopara: "Hypoparathyroid / neck surgery", diabetes: "Diabetes", dka: "DKA", adrenal: "Adrenal insufficiency", pancreatitis: "Pancreatitis", rhabdo: "Rhabdomyolysis", tls: "Tumour lysis", sepsis: "Sepsis", vomiting: "GI losses", thyrotox: "Thyrotoxicosis" };
  const probs = Object.keys(PL).filter((k) => a.prob[k] && a.prob[k].length).map((k) => `<tr><td>${esc(PL[k])}</td><td>${esc(a.prob[k].join("; "))}</td></tr>`);
  $("meds").innerHTML = (rows.length ? `<table><tr><th>Medication group</th><th>Ordered or given (3 days)</th></tr>${rows.join("")}</table>` : '<div class="muted">No electrolyte-relevant medications found.</div>') +
    (probs.length ? `<table style="margin-top:10px"><tr><th>Problem</th><th>On the problem list</th></tr>${probs.join("")}</table>` : "");
  $("medsum").textContent = rows.length + " med group" + (rows.length === 1 ? "" : "s") + ", " + probs.length + " problem" + (probs.length === 1 ? "" : "s");
}

function spark(title, pts, unit, lo, hi, d) {
  if (!pts.length) return `<div class="sp"><b>${esc(title)}</b><div class="muted">No values.</div></div>`;
  const W = 220, H = 70, P = 6, t0 = Math.min(...pts.map((p) => p.t)), t1 = Math.max(...pts.map((p) => p.t), t0 + HR);
  const vals = pts.map((p) => p.v).concat(lo != null ? [lo] : [], hi != null ? [hi] : []), vmin = Math.min(...vals), vmax = Math.max(...vals, vmin + 1e-6);
  const x = (t) => P + ((t - t0) / (t1 - t0)) * (W - 2 * P), y = (v) => H - P - ((v - vmin) / (vmax - vmin)) * (H - 2 * P);
  const band = lo != null && hi != null ? `<rect x="${P}" width="${W - 2 * P}" y="${y(hi)}" height="${Math.max(1, y(lo) - y(hi))}" fill="var(--g-bg)"/>` : "";
  const line = pts.map((p, i) => (i ? "L" : "M") + x(p.t).toFixed(1) + " " + y(p.v).toFixed(1)).join(" ");
  const last = pts[pts.length - 1];
  return `<div class="sp"><b>${esc(title)}</b> <span class="muted">${esc(rd(last.v, d))} ${esc(unit)} · ${esc(ago(last.t))}</span>
    <svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}" role="img" aria-label="${esc(title)} trend">${band}<path d="${line}" fill="none" stroke="var(--accent)" stroke-width="2"/>
    ${pts.map((p) => `<circle cx="${x(p.t).toFixed(1)}" cy="${y(p.v).toFixed(1)}" r="3" fill="${(lo != null && p.v < lo) || (hi != null && p.v > hi) ? "var(--r-ink)" : "var(--accent)"}"><title>${esc(rd(p.v, d))} ${esc(unit)} · ${esc(fmtDT(p.t))}</title></circle>`).join("")}</svg></div>`;
}
function drawTrend() {
  const f = state.f;
  if (!f) { $("sparks").innerHTML = '<div class="muted">Load a patient to see trends.</div>'; $("trendsum").textContent = ""; return; }
  const pts = (k) => (f.c[k] || []).map((e) => ({ t: e.t, v: e.v }));
  // corrected calcium: each total Ca with the nearest albumin within 7 days
  const corr = (f.c.Ca || []).map((e) => { const alb = (f.c.albumin || []).filter((a) => Math.abs(a.t - e.t) <= 7 * DAY).sort((p, q) => Math.abs(p.t - e.t) - Math.abs(q.t - e.t))[0]; return alb ? { t: e.t, v: R.correctedCa(e.v, alb.v) } : null; }).filter(Boolean);
  $("sparks").innerHTML = spark("Potassium", pts("K"), "mmol/L", 3.5, 5.0, 1) + spark("Phosphate", pts("phos"), "mmol/L", 0.8, 1.45, 2) +
    (corr.length ? spark("Calcium (albumin-corrected)", corr, "mmol/L", 2.10, 2.55, 2) : spark("Calcium (total)", pts("Ca"), "mmol/L", 2.10, 2.55, 2)) +
    (pts("iCa").length ? spark("Ionized calcium", pts("iCa"), "mmol/L", 1.12, 1.32, 2) : "") + spark("Magnesium", pts("Mg"), "mmol/L", 0.7, 1.0, 2) + spark("Creatinine", pts("creatinine"), "umol/L", null, null, 0);
  const n = ["K", "phos", "Ca", "iCa", "Mg"].reduce((s, k) => s + (f.c[k] || []).length, 0);
  $("trendsum").textContent = n + " results";
}

/* ---- note draft ---- */
function lytesNote(full) {
  const L = state.last; if (!L) return null;
  const { a, m, x } = L, v = a.v, g = a.g;
  if (!g.K && !g.phos && !g.Ca) return null;
  const assess = [], vals = [], causes = [], plan = [];
  ["K", "phos", "Ca"].forEach((e) => {
    const gr = g[e]; if (!gr) return;
    const p = a.plans[e];
    if (p) assess.push(R.SEV[p.sev].charAt(0).toUpperCase() + R.SEV[p.sev].slice(1) + " " + REF[p.key].title.replace(/^(Low|High) (\w+) \((\w+)\)$/, "$3") + (e === "Ca" ? " (" + gr.basis + " Ca " + gr.val + ")" : " (" + (e === "K" ? "K " + fmt("K", v.K) : "PO4 " + fmt("phos", v.phos)) + ")"));
    if (p) { p.causes.forEach((c) => causes.push(c.text + (c.why ? " (" + c.why + ")" : ""))); p.treat.filter((t) => full || t.tier === "now").forEach((t) => plan.push(t.text)); }
  });
  if (x.ecg) assess.push("ECG changes present.");
  if (x.symptoms) assess.push("Symptomatic.");
  if (!assess.length) assess.push("K, PO4 and Ca within normal range.");
  [["K", "K"], ["phos", "PO4"], ["Ca", "Ca"], ["iCa", "iCa"], ["Mg", "Mg"], ["albumin", "albumin"], ["creatinine", "creatinine"]].forEach(([k, n]) => { if (v[k] != null) vals.push(n + " " + fmt(k, v[k])); });
  const data = [vals.join(", ") + (v.corrCa != null ? "; corrected Ca " + v.corrCa : "") + (v.eGFR != null ? "; eGFR " + v.eGFR : "")];
  if (v.crRise) data.push(v.crRise);
  const stamp = ["K", "phos", "Ca", "iCa", "Mg"].map((k) => m.chart[k] && m.src[k] === "chart" ? m.chart[k].t : 0).reduce((p, q) => Math.max(p, q), 0);
  return { stamp: stamp || null, heading: "ELECTROLYTES", sections: { assess, data, causes, flags: a.flags.filter((f) => full || f.lvl !== "info").map((f) => f.text), plan } };
}
const NOTE = NoteDraft.mount($("note"), { title: "Electrolytes",
  sections: [{ id: "assess", label: "Assessment" }, { id: "data", label: "Values", noteLabel: "Data" }, { id: "causes", label: "Possible causes" }, { id: "flags", label: "Red flags", on: false }, { id: "plan", label: "Plan" }],
  build: lytesNote });

/* ---- loading ---- */
function load(raw, note, errors, x) {
  state.f = raw ? C.parse(raw) : null;
  ["ecg", "symptoms", "npo", "dialysis"].forEach((k) => ($("x-" + k).checked = !!(x && x[k])));
  if (state.f) $("ptsum").textContent = [state.f.sex, state.f.age != null ? state.f.age + " y" : ""].filter(Boolean).join(", "); else $("ptsum").textContent = "";
  $("pstatus").textContent = note; $("clear").hidden = !raw;
  $("errs").innerHTML = errors && errors.length ? "Could not read: " + errors.map(esc).join("; ") + (errors.some((e) => /\b40[13]\b|Unauthorized|Forbidden/i.test(e)) ? ". Check the scopes in the Code Console." : ". Cerner's sandbox can be slow: reload the patient to try again.") : "";
  drawTrend(); draw(); NOTE.reset();
}
MF.forEach((k) => ($("m-" + k).oninput = draw));
["ecg", "symptoms", "npo", "dialysis"].forEach((k) => ($("x-" + k).onchange = draw));
$("m-clear").onclick = () => { MF.forEach((k) => ($("m-" + k).value = "")); draw(); };
$("clear").onclick = () => { $("testsel").value = ""; load(null, "Open from Cerner to read the chart, or pick a made-up patient:"); };
const SAMPLES = window.LYTES_SAMPLES || [];
SAMPLES.forEach((p, i) => { const o = document.createElement("option"); o.value = i; o.textContent = p.label; $("testsel").appendChild(o); });
$("testsel").onchange = () => { const p = SAMPLES[$("testsel").value]; if (!p) return $("clear").onclick(); MF.forEach((k) => ($("m-" + k).value = "")); load(p.build(Date.now()), "Made-up patient: " + p.label, [], p.x); };

async function fromChart() {
  const demo = /[?&]demo=(\d+)/.exec(location.search);
  if (demo && SAMPLES[demo[1] - 1]) { $("testsel").value = String(demo[1] - 1); return $("testsel").onchange(); }
  if (typeof FHIR === "undefined" || !(location.search.includes("code=") || location.search.includes("complete=") || sessionStorage.getItem("SMART_KEY"))) return;
  $("pstatus").textContent = "Reading the chart…";
  try {
    const client = await FHIR.oauth2.ready();
    const { raw, errors } = await C.gather(client, (msg) => ($("pstatus").textContent = msg));
    load(raw, "Chart read (read-only). Nothing is sent anywhere.", errors);
  } catch (e) { $("pstatus").textContent = "Could not read the chart: " + (e && e.message ? e.message : e) + ". The made-up patients and the calculator still work."; }
}
load(null, "Open from Cerner to read the chart, or pick a made-up patient:"); fromChart();
