/* Acid-Base page. Read-only from the chart; typed values stay in this page. UNVERIFIED draft. */
const R = window.AcidBaseRules, C = window.AcidBaseChart, REF = window.ACIDBASE_REF, ORDER = window.ACIDBASE_ORDER, DAY = C.DAY, HR = C.HR;
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const fmtDT = (t) => new Date(t).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
const ago = (t) => { const h = (Date.now() - t) / HR; return h < 1 ? Math.max(1, Math.round(h * 60)) + " min ago" : h < 48 ? Math.round(h) + " h ago" : Math.round(h / 24) + " d ago"; };
const rd = (v, d) => (v == null || isNaN(v) ? null : Math.round(v * Math.pow(10, d)) / Math.pow(10, d));
const DEC = { pH: 2, K: 1, glucose: 1, urea: 1, lactate: 1, bhb: 1, salicylate: 1, HCO3: 1, uPH: 1 };
const fmt = (k, v) => (v == null ? "" : String(rd(v, DEC[k] != null ? DEC[k] : 0)));

const GASF = ["pH", "pCO2", "HCO3", "pO2"];
const CHEMF = ["Na", "K", "Cl", "tCO2", "albumin", "glucose", "urea", "creatinine", "lactate", "bhb", "osm", "ethanol", "salicylate", "CK"];
const URF = ["uNa", "uK", "uCl", "uPH"];
const MF = GASF.concat(CHEMF, URF);
/* how far from the gas a chemistry value may be (hours) */
const WIN = { Na: 6, K: 6, Cl: 6, tCO2: 6, glucose: 6, lactate: 3, albumin: 72, urea: 24, creatinine: 24, bhb: 12, osm: 12, ethanol: 12, salicylate: 12, CK: 48 };
const state = { f: null, gasIdx: -1 };

/* Adult reference ranges shown beside each box (typical Canadian SI ranges; check the Island Health lab's own range).
   lo/hi colour the box when a value is outside; ven: venous range used when the gas is venous. */
const RANGES = {
  pH: { lo: 7.35, hi: 7.45, t: "7.35–7.45", ven: { lo: 7.31, hi: 7.41, t: "venous 7.31–7.41" } },
  pCO2: { lo: 35, hi: 45, t: "35–45", ven: { lo: 41, hi: 51, t: "venous 41–51" } },
  HCO3: { lo: 22, hi: 26, t: "22–26" },
  pO2: { lo: 80, hi: 100, t: "80–100 arterial", ven: { lo: null, hi: null, t: "venous 30–50 (not for oxygenation)" } },
  Na: { lo: 135, hi: 145, t: "135–145" }, K: { lo: 3.5, hi: 5.0, t: "3.5–5.0" }, Cl: { lo: 98, hi: 107, t: "98–107" },
  tCO2: { lo: 22, hi: 29, t: "22–29" }, albumin: { lo: 35, hi: 50, t: "35–50" },
  glucose: { lo: 4.0, hi: 7.8, t: "4.0–7.8 random" }, urea: { lo: 2.5, hi: 8.0, t: "2.5–8.0" },
  creatinine: { lo: 45, hi: 110, t: "45–90 F, 60–110 M" }, lactate: { lo: 0.5, hi: 2.0, t: "0.5–2.0" },
  bhb: { hi: 0.6, t: "< 0.6 (≥ 3 ketoacidosis)" }, osm: { lo: 275, hi: 295, t: "275–295" },
  ethanol: { hi: 2, t: "none (< 2)" }, salicylate: { hi: 2.2, t: "therapeutic ≤ 2.2; toxic > 2.2" }, CK: { hi: 200, t: "< 200 (approx.)" },
  uNa: { t: "< 20 = kidney holding Na" }, uK: { t: "> 20 with low K = kidney loss" }, uCl: { t: "< 20 = Cl-responsive" }, uPH: { lo: 4.5, hi: 8, t: "4.5–8 (< 5.5 = acidifies)" }
};
const UNITS = {};
function rangeFor(k, spec) {
  const r = RANGES[k]; if (!r) return null;
  if (k === "creatinine" && state.f && /^(male|female)$/.test(state.f.sex)) return state.f.sex === "male" ? { lo: 60, hi: 110, t: "60–110 (male)" } : { lo: 45, hi: 90, t: "45–90 (female)" };
  return spec === "venous" && r.ven ? Object.assign({}, r, r.ven) : r;
}

/* ---- chart values for the selected gas ---- */
function chartVals() {
  const out = {}, f = state.f; if (!f) return out;
  const g = state.gasIdx >= 0 ? f.gases[state.gasIdx] : null;
  const t = g ? g.t : Date.now();
  if (g) GASF.forEach((k) => { if (g[k] != null) out[k] = { v: g[k], t: g.t, spec: g.spec }; });
  CHEMF.forEach((k) => {
    const e = g ? C.nearLab(f.c[k], t, WIN[k]) : C.latest((f.c[k] || []).filter((x) => !x.gas), (WIN[k] > 24 ? WIN[k] : 24) * HR) || C.latest(f.c[k], 24 * HR);
    if (e) out[k] = e;
  });
  URF.forEach((k) => { const e = C.near(f.u[k], t, 48); if (e) out[k] = e; });
  // previous lactate (for "rising"): the one before the lactate used, within 24 h
  if (out.lactate) { const prev = (f.c.lactate || []).filter((e) => e.t < out.lactate.t - 30 * 60e3 && out.lactate.t - e.t <= 24 * HR).pop(); if (prev) out.lactatePrev = prev; }
  return out;
}
function typed() { const o = {}; MF.forEach((k) => { const v = parseFloat($("m-" + k).value); o[k] = isFinite(v) ? v : null; }); return o; }
function merged() {
  const t = typed(), c = chartVals(), v = {}, src = {};
  MF.forEach((k) => { if (t[k] != null) { v[k] = t[k]; src[k] = "typed"; } else if (c[k]) { v[k] = rd(c[k].v, 3); src[k] = "chart"; } else v[k] = null; });
  if (c.lactatePrev && src.lactate === "chart") v.lactatePrev = rd(c.lactatePrev.v, 2);
  const g = state.f && state.gasIdx >= 0 ? state.f.gases[state.gasIdx] : null;
  v.specimen = $("m-specimen").value || (g && g.spec) || "";
  return { v, src, chart: c, gas: g };
}
function medClasses() { return R.classifyMeds(state.f ? state.f.medNames : []); }

/* ---- drawing ---- */
function tile(k, big, s, cls) { return `<div class="tile ${cls || ""}"><div class="k">${esc(k)}</div><div class="big">${big == null || big === "" ? "–" : esc(big)}</div><div class="s">${s || ""}</div></div>`; }
function draw() {
  const m = merged(), v = m.v, meds = medClasses(), out = R.interpret(v, meds), d = out.derived;
  state.last = { m, out, meds };
  // inputs: chart values as placeholders
  const t = typed();
  MF.forEach((k) => { const el = $("m-" + k), c = m.chart[k]; el.placeholder = c ? fmt(k, c.v) : ""; el.title = c ? "Chart: " + fmt(k, c.v) + " (" + fmtDT(c.t) + (c.shown && c.shown.trim() !== fmt(k, c.v) ? ", reported " + c.shown : "") + ")" : ""; el.classList.toggle("typed", t[k] != null); });
  MF.forEach((k) => {
    const el = $("m-" + k), span = el.parentNode.querySelector(".u"), r = rangeFor(k, v.specimen);
    if (!(k in UNITS)) UNITS[k] = span ? span.textContent.trim() : "";
    if (span && r) span.innerHTML = (UNITS[k] ? esc(UNITS[k]) + " · " : "") + '<span class="rng">' + esc(r.t) + "</span>";
    const val = v[k], out = r && val != null && ((r.lo != null && val < r.lo) || (r.hi != null && val > r.hi));
    el.classList.toggle("out", !!out); el.parentNode.classList.toggle("outrow", !!out);
  });
  const nT = MF.filter((k) => t[k] != null).length, nC = MF.filter((k) => m.src[k] === "chart").length;
  $("m-src").textContent = (nT ? nT + " typed" : "") + (nT && nC ? ", " : "") + (nC ? nC + " from the chart (grey)" : "");
  $("m-clear").hidden = !nT;
  $("msum").textContent = v.specimen ? v.specimen + " gas" : "";
  // pairing note
  const pair = [];
  if (m.gas) {
    pair.push(`Gas ${fmtDT(m.gas.t)} (${ago(m.gas.t)}), ${m.gas.spec || "sample type not stated"}.`);
    const far = CHEMF.filter((k) => m.src[k] === "chart" && Math.abs(m.chart[k].t - m.gas.t) > 2 * HR).map((k) => C.CHEM.find((x) => x.id === k).label + " " + fmtDT(m.chart[k].t));
    if (far.length) pair.push("Drawn more than 2 h from the gas: " + far.join("; ") + ".");
  } else if (state.f) pair.push("No blood gas: using the latest chemistry (anion gap only).");
  $("pairing").textContent = pair.join(" ");

  // tiles
  const pHc = v.pH == null ? "" : v.pH < 7.2 || v.pH > 7.6 ? "t3" : v.pH < 7.35 || v.pH > 7.45 ? "t2" : "t0";
  const agv = d.AGcorr != null ? d.AGcorr : d.AG;
  $("tiles").innerHTML =
    tile("pH", v.pH != null ? fmt("pH", v.pH) : null, v.pH == null ? "" : v.pH < 7.35 ? "acidaemia" : v.pH > 7.45 ? "alkalaemia" : "normal range", pHc) +
    tile("pCO2", v.pCO2 != null ? fmt("pCO2", v.pCO2) : null, d.expectedPCO2 ? "expected " + d.expectedPCO2[0] + "–" + d.expectedPCO2[1] : "mmHg", v.pCO2 != null && d.expectedPCO2 && (v.pCO2 < d.expectedPCO2[0] || v.pCO2 > d.expectedPCO2[1]) ? "t2" : "") +
    tile("HCO3", d.HCO3 != null ? d.HCO3 : null, d.HCO3calculated ? "calculated from pH/pCO2" : "mmol/L" + (v.tCO2 != null && v.HCO3 != null ? " · total CO2 " + fmt("tCO2", v.tCO2) : ""), d.HCO3 != null && (d.HCO3 < 15 || d.HCO3 > 35) ? "t2" : "") +
    tile("Anion gap" + (d.AGcorr != null ? " (alb-corr.)" : ""), agv, d.AG != null ? (d.AGcorr != null ? "uncorrected " + d.AG : "no albumin") : "needs Na, Cl, CO2", d.highAG ? "t3" : agv != null ? "t0" : "") +
    (d.deltaRatio != null ? tile("Delta ratio", d.deltaRatio, d.deltaRatio < 1 ? "+ normal gap acidosis" : d.deltaRatio > 2 ? "+ metabolic alkalosis" : "pure high-gap", d.deltaRatio < 1 || d.deltaRatio > 2 ? "t2" : "t1") : "") +
    (d.osmGap != null ? tile("Osmolar gap", d.osmGap, "calculated " + d.calcOsm, d.osmGap > 10 ? "t3" : "t0") : "") +
    (v.lactate != null ? tile("Lactate", fmt("lactate", v.lactate), v.lactatePrev != null ? "previous " + v.lactatePrev : "mmol/L", v.lactate >= 4 ? "t3" : v.lactate >= 2 ? "t2" : "t0") : "");

  // flags and caveats
  const fl = out.flags.map((x) => `<div class="alert ${x.level === "high" ? "urgent" : "action"}"><b>${x.level === "high" ? "Act now" : "Check"}</b>${esc(x.text)}</div>`)
    .concat(out.caveats.map((c) => `<div class="alert info"><b>Note</b>${esc(c)}</div>`));
  $("alerts").innerHTML = fl.length ? fl.join("") : '<div class="muted">No red flags from these values.</div>';
  $("alertsum").textContent = out.flags.length ? out.flags.length + " flag" + (out.flags.length > 1 ? "s" : "") : "";

  // interpretation
  $("dis").innerHTML = out.disorders.length ? out.disorders.map((x) => `<span class="${/^No /.test(x) ? "none" : ""}">${esc(x)}</span>`).join("") : '<span class="none">Enter values to interpret</span>';
  $("intsum").textContent = out.disorders.filter((x) => !/^No /.test(x)).length ? out.disorders.length + " process" + (out.disorders.length > 1 ? "es" : "") : "";
  $("steps").innerHTML = out.steps.map((s) => `<li><span class="mk ${s.ok === true ? "ok" : s.ok === false ? "no" : "na"}">${s.ok === true ? "✓" : s.ok === false ? "✗" : "?"}</span><b>${esc(s.title)}</b><div style="margin-top:4px">${esc(s.text)}</div>${s.teach ? `<div class="teach">${esc(s.teach)}</div>` : ""}</li>`).join("");

  drawMeds(meds); drawRef(out); NOTE.update();
}

function drawMeds(meds) {
  const f = state.f;
  if (!f) { $("meds").innerHTML = '<div class="muted">Load a patient to check medications and problems.</div>'; $("medsum").textContent = ""; return; }
  const LAB = { sglt2: "SGLT2 inhibitor (euglycaemic DKA)", metformin: "Metformin (lactic acidosis with AKI/shock)", diuretic: "Loop/thiazide diuretic (metabolic alkalosis, low K)",
    cai: "Carbonic anhydrase inhibitor (NAGMA)", hyperK: "Raises K / type 4 RTA pattern", alkali: "Alkali load (metabolic alkalosis)", sedative: "Opioid/sedative (hypoventilation)" };
  const rows = Object.keys(LAB).filter((k) => meds[k]).map((k) => `<tr><td class="wrap">${esc(LAB[k])}</td><td class="wrap">${esc(meds[k].join("; "))}</td></tr>`);
  const PL = { diabetes: "Diabetes", copd: "COPD / hypoventilation", ckd: "CKD", cirrhosis: "Cirrhosis", alcohol: "Alcohol use", neuromusc: "Neuromuscular disease", ibd: "IBD / stoma / short bowel", pregnancy: "Pregnancy", sepsis: "Sepsis" };
  const probs = Object.keys(PL).filter((k) => f.prob[k]).map((k) => `<tr><td>${esc(PL[k])}</td><td class="wrap">${esc(f.prob[k].join("; "))}</td></tr>`);
  $("meds").innerHTML = (rows.length ? `<table><tr><th>Medication class</th><th>On the chart</th></tr>${rows.join("")}</table>` : '<div class="muted">No acid-base-relevant medications found (orders and doses given in the last 7 days, matched by name).</div>') +
    (probs.length ? `<h3 style="font-size:14px;margin:12px 0 4px">Problems</h3><table>${probs.join("")}</table>` : "");
  $("medsum").textContent = rows.length ? rows.length + " class" + (rows.length > 1 ? "es" : "") : "";
}

function drawRef(out) {
  const hit = new Set(out.causesToShow);
  if (hit.has("metacid") && !hit.has("hagma") && !hit.has("nagma")) { hit.add("hagma"); hit.add("nagma"); }
  const keys = ORDER.slice().sort((a, b) => (hit.has(b) ? 1 : 0) - (hit.has(a) ? 1 : 0));
  const prev = {}; document.querySelectorAll("#ref details").forEach((d) => (prev[d.dataset.k] = d.open));
  $("ref").innerHTML = keys.map((k) => { const r = REF[k], h = hit.has(k);
    return `<details data-k="${k}" class="${h ? "hit" : ""}"${(prev[k] != null ? prev[k] : h) ? " open" : ""}><summary>${esc(r.h)} <span class="muted" style="font-weight:400">· ${esc(r.mn)}</span></summary><div class="in">
      <table>${r.causes.map((c) => `<tr><td>${esc(c[0])}</td><td class="wrap">${esc(c[1])}</td></tr>`).join("")}</table>
      <h3 style="font-size:13.5px;margin:10px 0 4px">Tests</h3><ul style="margin:4px 0 6px 18px;padding:0">${r.tests.map((x) => "<li>" + esc(x) + "</li>").join("")}</ul>
      <h3 style="font-size:13.5px;margin:10px 0 4px">First steps</h3><ul style="margin:4px 0 6px 18px;padding:0">${r.steps.map((x) => "<li>" + esc(x) + "</li>").join("")}</ul></div></details>`; }).join("") +
    '<div class="src">Unverified summary from general references (Berend NEJM 2014; Kraut &amp; Madias; Emmett 2020; BICAR-ICU 2018). Follow Island Health protocols and the Poison Centre where they differ.</div>';
}

/* ---- trend: small line charts + table of gases ---- */
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
    ${pts.map((p) => `<circle cx="${x(p.t).toFixed(1)}" cy="${y(p.v).toFixed(1)}" r="3" fill="var(--accent)"><title>${esc(rd(p.v, d))} ${esc(unit)} · ${esc(fmtDT(p.t))}</title></circle>`).join("")}</svg></div>`;
}
function drawTrend() {
  const f = state.f;
  if (!f) { $("sparks").innerHTML = '<div class="muted">Load a patient to see trends.</div>'; $("gastable").innerHTML = ""; $("trendsum").textContent = ""; return; }
  const ph = f.gases.filter((g) => g.pH != null).map((g) => ({ t: g.t, v: g.pH })), pco2 = f.gases.filter((g) => g.pCO2 != null).map((g) => ({ t: g.t, v: g.pCO2 }));
  const hco3 = (f.c.tCO2 || []).map((e) => ({ t: e.t, v: e.v })), ag = C.gapSeries(f), lac = (f.c.lactate || []).map((e) => ({ t: e.t, v: e.v }));
  $("sparks").innerHTML = spark("pH", ph, "", 7.35, 7.45, 2) + spark("pCO2", pco2, "mmHg", 35, 45, 0) + spark("Total CO2", hco3, "mmol/L", 22, 26, 0) + spark("Anion gap" + (ag.some((a) => a.corr) ? " (alb-corr.)" : ""), ag, "", 8, 12, 0) + spark("Lactate", lac, "mmol/L", 0, 2, 1);
  $("trendsum").textContent = f.gases.length + " gas" + (f.gases.length === 1 ? "" : "es");
  $("gastable").innerHTML = f.gases.length ? `<table><tr><th>Time</th><th>Sample</th><th>pH</th><th>pCO2</th><th>HCO3</th><th>pO2</th><th>BE</th></tr>` +
    f.gases.slice().reverse().map((g) => `<tr><td>${esc(fmtDT(g.t))}</td><td>${esc(g.spec || "?")}</td>${["pH", "pCO2", "HCO3", "pO2", "BE"].map((k) => `<td class="num${k === "pH" && g.pH != null && (g.pH < 7.35 || g.pH > 7.45) ? " hi" : ""}">${g[k] != null ? esc(fmt(k, g[k])) : ""}</td>`).join("")}</tr>`).join("") + "</table>" : "";
}

/* ---- note draft ---- */
function acidNote(full) {
  const L = state.last; if (!L) return null;
  const { m, out } = L, v = m.v, d = out.derived;
  if (v.pH == null && d.AG == null) return null;
  const vals = [];
  if (v.pH != null) vals.push(`${v.specimen ? v.specimen.charAt(0).toUpperCase() + v.specimen.slice(1) + " gas" : "Gas"}: pH ${fmt("pH", v.pH)}, pCO2 ${fmt("pCO2", v.pCO2)}, HCO3 ${d.HCO3}${v.pO2 != null && v.specimen === "arterial" ? ", pO2 " + fmt("pO2", v.pO2) : ""}`);
  if (d.AG != null) vals.push(`Na ${fmt("Na", v.Na)}, Cl ${fmt("Cl", v.Cl)}, CO2 ${fmt("tCO2", v.tCO2 != null ? v.tCO2 : d.HCO3)}, AG ${d.AG}${d.AGcorr != null ? " (albumin " + fmt("albumin", v.albumin) + ", corrected " + d.AGcorr + ")" : ""}`);
  if (d.deltaRatio != null) vals.push("Delta ratio " + d.deltaRatio);
  if (d.osmGap != null) vals.push(`Osmolar gap ${d.osmGap} (measured ${fmt("osm", v.osm)}, calculated ${d.calcOsm})`);
  ["lactate", "bhb", "glucose", "K", "salicylate"].forEach((k) => { if (v[k] != null) vals.push(({ lactate: "Lactate", bhb: "BHB", glucose: "Glucose", K: "K", salicylate: "Salicylate" })[k] + " " + fmt(k, v[k])); });
  if (d.UAG != null) vals.push("Urine AG " + d.UAG);
  const assess = out.disorders.length ? [out.disorders.join("; ") + "."] : [];
  const steps = out.steps.filter((s) => full || s.ok === false).map((s) => s.title.replace(/^\d+[ab]?\.\s*/, "") + ": " + s.text);
  const flags = out.flags.map((x) => x.text);
  const plan = [];
  const has = (k) => out.causesToShow.indexOf(k) > -1;
  if (has("hagma")) plan.push("HAGMA workup: lactate, BHB, osmolar gap, salicylate/acetaminophen as indicated; treat cause.");
  if (has("toxalc")) plan.push("Toxic alcohol suspected: fomepizole, nephrology for dialysis, Poison Centre.");
  if (has("nagma")) plan.push("NAGMA: urine anion gap/pH, review saline and GI losses; balanced crystalloid; replace K.");
  if (has("metalk")) plan.push("Metabolic alkalosis: urine Cl, replace K/Mg, volume and chloride if responsive; review diuretics.");
  if (has("respacid")) plan.push("Respiratory acidosis: review opioids/sedatives, O2 target 88–92% if retainer, NIV/ICU if worsening.");
  if (has("respalk")) plan.push("Respiratory alkalosis: look for hypoxaemia, sepsis, PE, salicylate.");
  plan.push("Repeat gas and lytes after treatment.");
  return { stamp: m.gas ? m.gas.t : null, heading: "ACID-BASE", sections: { assess, vals, steps, flags, plan } };
}
const NOTE = NoteDraft.mount($("note"), { title: "Acid-base",
  sections: [{ id: "assess", label: "Assessment" }, { id: "vals", label: "Values", noteLabel: "Data" }, { id: "steps", label: "Reasoning", noteLabel: "Interpretation", on: false }, { id: "flags", label: "Red flags" }, { id: "plan", label: "Plan" }],
  build: acidNote });

/* ---- loading ---- */
function load(raw, note, errors) {
  state.f = raw ? C.parse(raw) : null;
  const sel = $("gassel"); sel.innerHTML = "";
  const gases = state.f ? state.f.gases : [];
  if (!gases.length) sel.innerHTML = `<option value="-1">${state.f ? "No blood gas in the chart (14 days)" : "No patient loaded"}</option>`;
  gases.slice().reverse().forEach((g, i) => { const idx = gases.length - 1 - i, o = document.createElement("option"); o.value = idx;
    o.textContent = `${fmtDT(g.t)} · ${g.spec || "gas"} · pH ${g.pH != null ? fmt("pH", g.pH) : "?"} / pCO2 ${g.pCO2 != null ? fmt("pCO2", g.pCO2) : "?"}${i === 0 ? " (latest)" : ""}`; sel.appendChild(o); });
  state.gasIdx = gases.length ? gases.length - 1 : -1; sel.value = String(state.gasIdx);
  $("m-specimen").value = "";
  if (state.f) $("ptsum").textContent = [state.f.sex, state.f.age != null ? state.f.age + " y" : ""].filter(Boolean).join(", "); else $("ptsum").textContent = "";
  $("pstatus").textContent = note; $("clear").hidden = !raw;
  $("errs").innerHTML = errors && errors.length ? "Could not read: " + errors.map(esc).join("; ") + ". Check the scopes in the Code Console." : "";
  drawTrend(); draw(); NOTE.reset();
}
$("gassel").onchange = () => { state.gasIdx = parseInt($("gassel").value, 10); draw(); };
$("m-specimen").onchange = draw;
MF.forEach((k) => ($("m-" + k).oninput = draw));
$("m-clear").onclick = () => { MF.forEach((k) => ($("m-" + k).value = "")); draw(); };
$("teach").onchange = () => { document.body.classList.toggle("teaching", $("teach").checked); try { localStorage.setItem("acidbase-teach", $("teach").checked ? "1" : ""); } catch (e) {} };
try { if (localStorage.getItem("acidbase-teach") === "1") { $("teach").checked = true; document.body.classList.add("teaching"); } } catch (e) {}
$("clear").onclick = () => { $("testsel").value = ""; load(null, "Open from Cerner to read the chart, or pick a made-up patient:"); };
const SAMPLES = window.ACIDBASE_SAMPLES || [];
SAMPLES.forEach((p, i) => { const o = document.createElement("option"); o.value = i; o.textContent = p.label; $("testsel").appendChild(o); });
$("testsel").onchange = () => { const p = SAMPLES[$("testsel").value]; if (!p) return $("clear").onclick(); load(p.build(Date.now()), "Made-up patient: " + p.label, []); };

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
