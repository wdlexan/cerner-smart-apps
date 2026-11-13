/* Hyponatremia note draft. Uses the page's ctx(), state, R, C, LABEL, RISKS, fmtDT, r1, sgn (defined in app.js). UNVERIFIED draft. */
const HYPO_TX_CATS = ["hypertonic", "isotonic", "hypotonic", "salttab", "urea", "tolvaptan", "desmo", "kcl"];
const tm = (t) => new Date(t).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });

/* sodium-related treatment in the past 24 h: doses given (counted) and active orders */
function hypoTreatment(f, now) {
  const g = new Map();
  f.meds.filter((m) => m.cats.some((c) => HYPO_TX_CATS.includes(c)) && (m.active || (m.given && now - m.t <= DAY))).forEach((m) => {
    const k = m.name.replace(/\s+/g, " ").trim(), e = g.get(k) || { name: k, n: 0, last: 0, active: false };
    if (m.given) { e.n++; e.last = Math.max(e.last, m.t); } else e.active = true;
    g.set(k, e);
  });
  return [...g.values()].map((e) => e.name + (e.n ? (e.n > 1 ? " ×" + e.n : "") + " (last " + tm(e.last) + ")" : "") + (e.active ? (e.n ? ", still ordered" : " (ordered)") : ""));
}

function hypoNote(full) {
  if (!state.f) return null;
  const x = ctx(); if (!x.last) return null;
  const f = state.f, now = x.now, st = x.st, c = x.cause, lim = x.lim, sym = $("symptoms").value, vol = $("volume").value;
  const used = [x.last, x.sosm, x.uosm, x.una, x.uk, x.glu, x.k].filter(Boolean);
  const stamp = Math.max(...used.filter((e) => e.src !== "typed").map((e) => e.t));
  const S = {};
  const lo48 = st ? st.rs.low48 : x.last;

  // assessment
  const tonic = c && c.label === "hyperglycemia" ? `not hypotonic: glucose ${r1(x.glu.v)}, corrected Na ${r1(R.glucoseCorrected(x.last.v, x.glu.v))}`
    : c && c.label === "nonhypotonic" ? `not hypotonic (sOsm ${Math.round(x.sosm.v)})` : x.sosm ? `hypotonic (sOsm ${Math.round(x.sosm.v)})` : "tonicity not confirmed (no sOsm)";
  const symText = { "": "symptoms not documented", none: "no or mild symptoms", moderate: "moderate symptoms", severe: "severe symptoms" }[sym];
  const pending = [!x.tsh && "TSH", !x.cort && "cortisol"].concat(c ? c.missing.map((k) => ({ sosm: "sOsm", uosm: "uOsm", una: "urine Na" }[k])) : []).filter(Boolean);
  const NL = { siad: "SIAD", highuna: "urine Na above 30, volume status not yet chosen", diuretic: "diuretic-related", renalloss: "kidney or adrenal salt loss", hypovolemic: "volume depletion (non-kidney loss)",
    hypervolemic: "hypervolemic hyponatremia", lowvol: "low effective arterial volume", lowuosm: "water excess or low solute intake", hyperglycemia: "hyperglycemia", nonhypotonic: "non-hypotonic hyponatremia", incomplete: "not yet determined (workup incomplete)" };
  const notTonic = c && /hyperglycemia|nonhypotonic/.test(c.label);
  const consider = c ? c.likely.map((l) => l.replace(/\s*\(.*?\)/g, "").replace(/:.*$/, "")).filter((l) => l && !/^SIAD$/.test(l) || c.label !== "siad").filter((l, i, a) => a.indexOf(l) === i)
    .filter((l) => !(NL[c.label] || "").toLowerCase().includes(l.toLowerCase().split(" ")[0].replace(/s$/, "")))
    .map((l) => (/^[A-Z][A-Z]/.test(l) ? l : l[0].toLowerCase() + l.slice(1))) : [];
  S.assess = [
    (notTonic ? "Hyponatremia, " : (x.acute ? "Acute" : "Chronic (or unknown onset)") + " hyponatremia, ") + `${tonic}. Na ${lo48.v !== x.last.v ? lo48.v + " → " : ""}${x.last.v}${x.last.src === "gas" ? " (blood gas)" : ""}.`,
    `${symText[0].toUpperCase() + symText.slice(1)}${vol ? "; volume " + { hypo: "low", eu: "normal", hyper: "high" }[vol] : ""}.`,
    c ? `Likely cause: ${NL[c.label] || "not determined"}${consider.length && !notTonic ? "; also consider " + consider.filter((l) => !/^SIAD$/i.test(l) || c.label !== "siad").slice(0, full ? 5 : 3).join(", ") : ""}.` : "",
    pending.length && !notTonic ? "Not yet found in the chart: " + pending.join(", ") + "." : ""];

  // correction limits
  if (st && !(c && /hyperglycemia|nonhypotonic/.test(c.label))) {
    const risks = RISKS.filter(([k]) => state.risk[k]).map(([k, l]) => (k === "hypoK" && x.k ? "K " + x.k.v : l.toLowerCase()));
    S.limits = [
      `ODS risk ${x.high ? "HIGH (" + risks.join(", ") + ")" : "standard"}. Limit ${lim.l24} mmol/L per 24 h, ${lim.l48} per 48 h; goal ${lim.tLo}-${lim.tHi} per 24 h.`,
      st.c ? `Na must not exceed ${st.c.v} before ${fmtDT(st.c.until)} (set by Na ${st.c.from.v} at ${fmtDT(st.c.from.t)}).` : "",
      `Rise so far ${sgn(st.rs.rise24)} in 24 h${st.rs.rise48 > st.rs.rise24 ? ", " + sgn(st.rs.rise48) + " in 48 h" : ""}${st.over ? ": OVERCORRECTED" : st.near ? ": close to the limit" : st.slow ? ": slower than goal" : ""}.`];
  }

  // workup
  const wk = [x.sosm && "sOsm " + Math.round(x.sosm.v), x.uosm && "uOsm " + Math.round(x.uosm.v), x.una && "uNa " + Math.round(x.una.v), x.uk && "uK " + Math.round(x.uk.v),
    x.tsh && "TSH " + x.tsh.v, x.cort && "cortisol " + Math.round(x.cort.v), x.uric && "uric acid " + (Math.round(x.uric.v * 100) / 100), x.glu && x.glu.v > 10 && "glucose " + r1(x.glu.v)].filter(Boolean);
  const typedIn = [x.sosm, x.uosm, x.una, x.uk, x.glu, x.urea, x.uric, x.creat].some((e) => e && e.src === "typed");
  S.cause = [wk.length ? wk.join(", ") + "." + (typedIn ? " (Some values entered by hand.)" : "") : "No workup values found.",
    x.siad && x.siad.met ? "Meets SIAD criteria." : full && x.siad && c && /siad|highuna/.test(c.label) ? "SIAD criteria not all confirmed: " + x.siad.criteria.filter((i) => i.state !== true).map((i) => i.label.toLowerCase()).join("; ") + "." : "",
    x.furst ? `Furst ratio ${r1(x.furst.ratio)}.` : ""];

  // treatment so far
  S.tx = hypoTreatment(f, now);

  // plan
  if (full) {
    const blocks = R.plan({ lim, st, wt: x.wt, water: x.water, na: x.last.v, symptoms: sym || "none", acute: x.acute, highRisk: x.high, meds: x.meds, causeLabel: c ? c.label : "", volume: vol,
      furst: x.furst, uosm: x.uosm && x.uosm.v, liver: !!state.risk.liver, alcohol: !!state.risk.alcohol, hypoK: x.k && x.k.v < 3.5,
      bolusesGiven: f.meds.filter((m) => m.given && m.cats.includes("hypertonic") && now - m.t <= 6 * HR).length });
    S.plan = [].concat(...blocks.filter((b) => b.h !== "Targets and monitoring").map((b) => b.items));
  } else S.plan = shortPlan(x, c, st, sym, vol);
  const active = sym === "severe" || sym === "moderate" || x.last.v < 125 || (st && st.near) || (c && c.label === "lowuosm") || x.meds.hypertonic.length;
  if (!notTonic) S.plan.push(st && st.over ? "Na every 1-2 h while relowering." : `Na ${sym === "severe" || x.last.v < 120 || (st && st.near) || (c && c.label === "lowuosm") ? "every 2-4 h" : x.last.v < 125 ? "every 4-6 h" : "every 6-12 h"}` + (active ? "; urine output hourly, recheck Na if above 100 mL/h." : "."));

  // optional
  S.drugs = x.meds.culprits.length ? x.meds.culprits.map((d) => d + ".") : ["No common culprit drugs found."];
  S.labs = ["Na: " + x.na.filter((e) => now - e.t <= 2 * DAY).map((e) => e.v + (e.src === "gas" ? " gas" : "") + " (" + fmtDT(e.t) + ")").join(", ") + ".",
    [x.k && "K " + x.k.v, x.glu && "glucose " + r1(x.glu.v), x.urea && "urea " + r1(x.urea.v), x.creat && "creatinine " + Math.round(x.creat.v)].filter(Boolean).join(", ") + "."];
  return { stamp, heading: "HYPONATREMIA", sections: S };
}

function shortPlan(x, c, st, sym, vol) {
  const P = [], m = x.meds, L = c ? c.label : "";
  if (st && st.over) {
    const rs = R.rescue(x.wt);
    P.push(`Relower: stop sodium sources; desmopressin 2 mcg IV q6-8h; D5W ${rs.d5w6 ? rs.d5w6 + " mL" : "6 mL/kg"} over 1-2 h; target Na below ${st.c ? st.c.v : "the limit"}.`);
    P.push("Resume cause-specific treatment once back under the ceiling.");
    return P;
  }
  if (sym === "severe") P.push(`3% saline 150 mL bolus(es) for severe symptoms; stop at symptom relief or +5 mmol/L (max ${x.lim.l24} in 24 h).`);
  else if (sym === "moderate") P.push("3% saline 150 mL x1 if symptoms persist.");
  else if (st && st.near) P.push("Slow correction: stop or reduce sodium sources; recheck Na in 2 h.");
  if (m.hypotonic.length) P.push("Stop hypotonic IV fluids (" + m.hypotonic.join(", ") + ").");
  if (m.culprits.length) P.push("Hold " + m.culprits.map((d) => d.replace(/\s*\(.*\)$/, "")).join(", ") + ".");
  if (L === "siad" || L === "highuna") {
    P.push(x.furst ? "Fluid restriction " + (x.furst.ratio >= 1 ? "unlikely to work alone" : x.furst.ratio >= 0.5 ? "500 mL/day" : "1 L/day") + "." : "Fluid restriction 500 mL-1 L/day.");
    if ((x.furst && x.furst.ratio >= 1) || (x.uosm && x.uosm.v > 500)) P.push("Add urea 15-30 g/day PO if restriction fails.");
    if (m.isotonic.length && x.uosm && x.uosm.v > 530) P.push("Stop 0.9% saline (urine osmolality above saline).");
    P.push("TSH and morning cortisol" + (x.tsh && x.cort ? " done." : " if not done."));
  }
  if (L === "hypovolemic" || L === "renalloss" || (L === "lowvol" && vol !== "hyper")) P.push("0.9% saline 500 mL-1 L, then reassess; watch for a water diuresis.");
  if (L === "hypervolemic" || (L === "lowvol" && vol === "hyper")) P.push("Fluid restriction 1-1.5 L/day; treat " + (state.risk.liver ? "cirrhosis (hold diuretics if Na 125 or less)" : "heart failure / underlying cause") + ".");
  if (L === "diuretic") P.push("Stop thiazide; replace K and Mg.");
  if (L === "lowuosm") P.push("Restrict water; restart diet slowly; high risk of rapid correction.");
  if (L === "incomplete") P.push("Send " + c.missing.map((k) => ({ sosm: "serum osmolality", uosm: "urine osmolality", una: "urine Na/K" }[k])).join(", ") + " before treatment if safe.");
  if (L === "hyperglycemia" || L === "nonhypotonic") P.push("Treat the glucose / extra osmole; no sodium-specific treatment.");
  if (x.k && x.k.v < 3.5) P.push("Replace K (counts toward the sodium rise).");
  return P;
}

const HYPO_NOTE = NoteDraft.mount(document.getElementById("note"), {
  title: "Hyponatremia",
  sections: [{ id: "assess", label: "Assessment" }, { id: "limits", label: "Correction limits" }, { id: "cause", label: "Workup", noteLabel: "Workup" },
    { id: "tx", label: "Treatment so far", noteLabel: "Treatment in last 24 h" }, { id: "plan", label: "Plan" }, { id: "drugs", label: "Drug review", on: false }, { id: "labs", label: "Lab values", on: false }],
  build: hypoNote
});
