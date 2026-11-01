/* Liver tab rules: kidneys and blood pressure, HRS-AKI, ascitic fluid, nutrition and VTE prophylaxis. Pure functions (tested in tests/test_liver.js).
   Units: creatinine umol/L, urea mmol/L, albumin and protein g/L, glucose mmol/L, cell counts per uL (= x10^6/L), weight kg, height cm.
   Sources summarised (read 2026-10-31): ICA-ADQI 2024 consensus on AKI in cirrhosis; AASLD 2021 ascites/SBP/HRS guidance; AGA 2021 coagulation in cirrhosis;
   AASLD 2021 malnutrition guidance. Doses and thresholds are an UNVERIFIED draft written by Claude: check them before real use. */
(function (root) {
  const DAY = 864e5, H = 36e5;
  const ok = (v) => typeof v === "number" && isFinite(v);
  const r = (v, d) => (ok(v) ? Math.round(v * Math.pow(10, d || 0)) / Math.pow(10, d || 0) : null);
  const round5 = (g) => Math.round(g / 5) * 5;

  /* ---------- kidneys ---------- */
  /* CKD-EPI 2021 (race-free) eGFR, creatinine in umol/L */
  function egfr(cr, age, sex) {
    if (!ok(cr) || !ok(age)) return null;
    const s = cr / 88.4, f = sex === "female", k = f ? 0.7 : 0.9, a = f ? -0.241 : -0.302;
    return 142 * Math.pow(Math.min(s / k, 1), a) * Math.pow(Math.max(s / k, 1), -1.2) * Math.pow(0.9938, age) * (f ? 1.012 : 1);
  }
  /* creatinine that gives eGFR 75 (ICA-ADQI 2024 back-calculation when no prior value exists) */
  function crForEgfr(target, age, sex) {
    if (!ok(age)) return null;
    let lo = 20, hi = 600;
    for (let i = 0; i < 60; i++) { const mid = (lo + hi) / 2; if (egfr(mid, age, sex) > target) lo = mid; else hi = mid; }
    return (lo + hi) / 2;
  }
  /* Cockcroft-Gault, creatinine umol/L. Overestimates kidney function in cirrhosis (low muscle mass). */
  function crcl(cr, age, wt, sex) { return ok(cr) && ok(age) && ok(wt) ? ((140 - age) * wt * (sex === "female" ? 1.04 : 1.23)) / cr : null; }

  /* AKI by ICA-ADQI 2024 (KDIGO creatinine criteria).
     creats: [{t, v}] ascending. Baseline: manual if given; else lowest value in the 3 months before the latest result;
     else the most recent value 3-12 months back; else the lower of the first value on record and the eGFR-75 back-calculation. */
  function aki(creats, opts) {
    opts = opts || {};
    const arr = (creats || []).filter((e) => ok(e.v)).sort((a, b) => a.t - b.t);
    if (!arr.length) return null;
    const cur = arr[arr.length - 1], prior = arr.slice(0, -1);
    let base = null, src = "";
    if (ok(opts.manualBaseline)) { base = opts.manualBaseline; src = "entered by you"; }
    else {
      const in3 = prior.filter((e) => cur.t - e.t <= 90 * DAY);
      const in12 = prior.filter((e) => cur.t - e.t > 90 * DAY && cur.t - e.t <= 365 * DAY);
      if (in3.length) { base = Math.min(...in3.map((e) => e.v)); src = "lowest value in the past 3 months"; }
      else if (in12.length) { base = in12[in12.length - 1].v; src = "most recent value 3-12 months ago"; }
      else {
        const back = crForEgfr(75, opts.age, opts.sex), first = arr[0].v;
        base = ok(back) ? Math.min(first, back) : first;
        src = ok(back) && back < first ? "back-calculated from eGFR 75 (no earlier value)" : "first value on record (no earlier value)";
      }
    }
    const last48 = prior.filter((e) => cur.t - e.t <= 48 * H);
    const rise48 = last48.length ? cur.v - Math.min(...last48.map((e) => e.v)) : null;
    const ratio = cur.v / base, riseBase = cur.v - base;
    const isAki = (ok(rise48) && rise48 >= 26.5) || ratio >= 1.5 || !!opts.rrt;
    let stage = 0;
    if (isAki) {
      if (opts.rrt || ratio >= 3 || (cur.v >= 353.6 && ((ok(rise48) && rise48 >= 26.5) || riseBase >= 26.5))) stage = 3;
      else if (ratio >= 2) stage = 2;
      else stage = 1;
    }
    const sub = stage === 1 ? (cur.v < 133 ? "1A" : "1B") : stage ? String(stage) : "";
    return { cur, base, src, rise48, ratio, isAki, stage, sub, recovered: cur.v - base <= 26.5 };
  }

  /* FENa (%). Urine creatinine may come as mmol/L (Canada) or umol/L or mg/dL. */
  function fena(uNa, uCr, uCrUnit, pNa, pCr) {
    if (![uNa, uCr, pNa, pCr].every(ok) || uCr <= 0 || pNa <= 0) return null;
    let ucr = uCr;
    if (/mg\s*\/\s*dl/i.test(uCrUnit || "")) ucr = uCr * 88.4; else if (/mmol/i.test(uCrUnit || "") || uCr < 100) ucr = uCr * 1000;
    return (uNa * pCr) / (pNa * ucr) * 100;
  }

  /* ---------- blood pressure ---------- */
  const mapOf = (s, d) => (ok(s) && ok(d) ? (s + 2 * d) / 3 : null);
  /* beta-blocker cautions in ascites (AASLD 2021): caution if SBP < 90, Na < 130 or creatinine > 133 (1.5 mg/dL); hold if MAP < 65 or AKI. */
  function nsbbCheck(x) {
    const hold = [], caution = [];
    if (ok(x.map) && x.map < 65) hold.push("MAP " + r(x.map) + " (below 65)");
    if (x.aki) hold.push("acute kidney injury");
    if (ok(x.sbp) && x.sbp < 90) caution.push("systolic " + r(x.sbp) + " (below 90)");
    if (ok(x.na) && x.na < 130) caution.push("sodium " + r(x.na) + " (below 130)");
    if (ok(x.cr) && x.cr > 133) caution.push("creatinine " + r(x.cr) + " (above 133)");
    return { hold, caution };
  }

  /* ---------- HRS-AKI (ICA-ADQI 2024) ----------
     Each item: state "yes" | "likely" | "no" | "unknown", plus evidence. Manual answers ("yes"/"no") override. */
  function hrs(x) {
    const m = x.manual || {}, items = [];
    const add = (id, label, auto, ev) => { const st = m[id] === "yes" || m[id] === "no" ? m[id] : auto; items.push({ id, label, state: st, auto, ev, manual: !!(m[id] === "yes" || m[id] === "no") }); };
    add("ascites", "Cirrhosis with ascites", x.ascites ? "yes" : x.ascitesHint ? "likely" : "unknown", x.ascitesEv || "Choose the ascites grade above, or answer here");
    add("aki", "AKI (creatinine up 26.5 umol/L in 48 h or 50% above baseline)", x.aki ? (x.aki.isAki ? "yes" : "no") : "unknown",
      x.aki ? `Creatinine ${r(x.aki.cur.v)} vs baseline ${r(x.aki.base)} (${r(x.aki.ratio, 2)}x)` : "No creatinine found");
    let vol = "unknown", vev = "No volume challenge found: answer here once the patient has had adequate volume resuscitation";
    if (x.volGiven) {
      if (ok(x.crAtVol) && x.hoursSinceVol >= 24) { const better = x.aki && x.aki.cur.v <= x.crAtVol - 26.5; vol = better ? "no" : "yes"; vev = `Albumin first given ${r(x.hoursSinceVol)} h ago (creatinine then ${r(x.crAtVol)}, now ${x.aki ? r(x.aki.cur.v) : "?"})${better ? ": improved, so not HRS so far" : ""}`; }
      else vev = "Albumin given, but less than 24 h ago: reassess at 24 h";
    }
    add("novol", "No improvement within 24 h of adequate volume resuscitation (no 48 h albumin challenge needed since 2024)", vol, vev);
    const alt = x.altCauses || [];
    add("noalt", "No strong evidence of another main cause (shock on vasopressors, obstruction, glomerular or drug injury)",
      alt.length ? "unknown" : "likely", alt.length ? "Check: " + alt.join("; ") : "None found in the chart. Renal ultrasound and urine sediment are not checked here: confirm.");
    const states = items.map((i) => i.state);
    const result = states.includes("no") ? "no" : states.every((s) => s === "yes") ? "yes" : states.every((s) => s === "yes" || s === "likely") ? "likely" : "incomplete";
    return { items, result };
  }

  /* Treatment plan. x: { aki, hrsResult, wt, map, spo2, cr, nephrotoxins[], diuretics[], nsbb[], cirrhosis, crAtStart } */
  function akiPlan(x) {
    const steps = [];
    if (!x.aki || !x.aki.isAki) return steps;
    const wt = ok(x.wt) ? x.wt : null;
    steps.push({ h: "Remove precipitants (all AKI stages)", items: [
      x.nephrotoxins.length ? "Stop nephrotoxins found: " + x.nephrotoxins.join(", ") + "." : "No NSAIDs, aminoglycosides, ACE inhibitors / ARBs or contrast found in the past week (check the MAR).",
      x.diuretics.length ? "Hold diuretics: " + x.diuretics.join(", ") + "." : "No active diuretics found.",
      x.nsbb.length ? "Reduce or hold the beta-blocker (" + x.nsbb.join(", ") + ") while AKI persists or MAP is below 65." : "",
      "Look for infection: diagnostic paracentesis (SBP), blood and urine cultures, chest x-ray. Treat infection promptly.",
      "Look for GI bleeding (hemoglobin trend, stool) and over-diuresis or lactulose-related diarrhea.",
      "Replace losses: blood if bleeding (restrictive target about 70 g/L), crystalloid if dehydrated.",
      "Monitor creatinine daily, urine output, daily weight, and lungs / oxygen for volume overload."].filter(Boolean) });
    steps.push({ h: "If volume status is unclear (ICA-ADQI 2024)", items: [
      "Fluid challenge with 20-25% albumin 1 to 1.5 g/kg" + (wt ? ` (${round5(wt)} to ${round5(wt * 1.5)} g for ${r(wt)} kg; many protocols cap at 100 g/day)` : " (weight not found)") + ", or 250-500 mL crystalloid.",
      "Reassess creatinine and urine output at 24 h. Improvement points away from HRS-AKI."] });
    if (x.hrsResult === "yes" || x.hrsResult === "likely") {
      const t = x.map, tgt10 = ok(t) ? r(t + 10) : null, tgt15 = ok(t) ? r(t + 15) : null;
      const terliWarn = [];
      if (ok(x.spo2) && x.spo2 < 90) terliWarn.push("SpO2 " + x.spo2 + "% (below 90%: avoid)");
      if (ok(x.cr) && x.cr >= 442) terliWarn.push("creatinine " + r(x.cr) + " umol/L (5 mg/dL or more: less likely to respond; US label cautions)");
      steps.push({ h: "HRS-AKI: start a vasoconstrictor with albumin now", items: [
        "1st line, terlipressin: 2 mg/day continuous IV infusion (preferred), increasing by at least 2 mg/day every 24 h if creatinine has not fallen 25%, to 12 mg/day; or 1 mg IV every 6 h, up to 2 mg every 6 h. Availability in Canada is limited: ask pharmacy. Avoid with SpO2 below 90%, volume overload, ischemic heart or vascular disease, or ACLF grade 3." + (terliWarn.length ? " Patient: " + terliWarn.join("; ") + "." : ""),
        "2nd line, norepinephrine: 0.5 mg/h IV, increased by 0.5 mg/h every 4 h to 3 mg/h if MAP has not risen more than 10 mmHg. Needs ICU / HAU and a central line." + (tgt10 ? ` Current MAP ${r(t)}: aim for ${tgt10} or more.` : ""),
        "Only if neither is possible, midodrine 7.5 mg PO every 8 h (up to 15 mg) plus octreotide 100 mcg SC every 8 h (up to 200 mcg). Less effective." + (tgt15 ? ` Aim for MAP ${tgt15} or more.` : ""),
        "With the vasoconstrictor: 20-25% albumin 20-40 g/day, adjusted daily to volume status; stop if fluid overload.",
        "Response = creatinine down at least 25% from the start" + (ok(x.crAtStart) ? ` (start ${r(x.crAtStart)}: 25% fall = ${r(x.crAtStart * 0.75)} or lower)` : "") + ". Complete recovery = within 26.5 umol/L of baseline (" + r(x.aki.base + 26.5) + " or lower).",
        "Stop when creatinine is back to baseline, after 48-72 h without improvement at the highest tolerated dose, on a serious side effect, when dialysis or transplant happens, or at 14 days. Retreat if it recurs.",
        "Involve hepatology early; transplant assessment if a candidate (transplant is the definitive treatment). Nephrology if dialysis may be needed as a bridge. Goals-of-care discussion if not a transplant candidate."] });
    } else if (x.hrsResult === "no") {
      steps.push({ h: "AKI, but not HRS-AKI", items: ["Consider pre-renal AKI that responds to volume, acute tubular injury (muddy brown casts, sepsis, shock, contrast), obstruction (renal ultrasound), glomerular disease (proteinuria, hematuria) or drug injury.", "Keep removing precipitants and reassess daily."] });
    } else {
      steps.push({ h: "HRS-AKI not yet decided", items: ["Complete the checklist above. If AKI persists 24 h after adequate volume resuscitation with no other main cause, treat as HRS-AKI."] });
    }
    return steps;
  }

  /* ---------- ascitic fluid ----------
     tap: { wbc, pmn, pmnPct, rbc, alb, prot, glu, ldh, culture } ; serum: { alb, ldh, ldhUln } */
  function fluid(tap, serum) {
    serum = serum || {};
    let pmn = ok(tap.pmn) ? tap.pmn : ok(tap.wbc) && ok(tap.pmnPct) ? (tap.wbc * tap.pmnPct) / 100 : null;
    const corr = ok(pmn) && ok(tap.rbc) && tap.rbc > 0 ? Math.max(0, pmn - tap.rbc / 250) : pmn; // 1 PMN per 250 RBC
    const sbp = ok(corr) ? corr >= 250 : null;
    const saag = ok(serum.alb) && ok(tap.alb) ? serum.alb - tap.alb : null;
    const cult = String(tap.culture || "");
    const noGrowth = /no growth|negative|no organisms|sterile/i.test(cult);
    const culturePos = !!cult && !noGrowth && /grew|growth|positive|isolat|organism|coli|klebsiella|staph|strep|enterococ|pseudomonas|anaerob|bacteroides|candida|gram (positive|negative)/i.test(cult);
    const poly = culturePos && /mixed|polymicrobial|multiple organisms|anaerob|bacteroides|candida/i.test(cult);
    const ldhLimit = ok(serum.ldhUln) ? serum.ldhUln : 250; // fallback when the lab sends no upper limit
    const runyon = [ok(tap.prot) && tap.prot > 10 ? "protein above 10 g/L" : "", ok(tap.glu) && tap.glu < 2.8 ? "glucose below 2.8 mmol/L" : "",
      ok(tap.ldh) && tap.ldh > ldhLimit ? `LDH above the serum upper limit (${r(ldhLimit)})` : ""].filter(Boolean);
    return { pmn, corr, sbp, saag, portal: ok(saag) ? saag >= 11 : null, lowProt: ok(tap.prot) ? tap.prot < 15 : null,
      culturePos, poly, bacterascites: sbp === false && culturePos, secondary: (sbp && runyon.length >= 2) || poly, runyon,
      hemorrhagic: ok(tap.rbc) ? tap.rbc > 50000 : false, ldhLimit, ldhFallback: !ok(serum.ldhUln) };
  }

  const albuminSbp = (wt) => (ok(wt) ? { d1: round5(wt * 1.5), d3: round5(wt * 1.0) } : null);
  /* 6-8 g per litre removed when more than 5 L (AASLD 2021: per litre removed) */
  const albuminLvp = (litres) => (ok(litres) && litres > 5 ? { lo: round5(litres * 6), hi: round5(litres * 8) } : null);

  /* primary SBP prophylaxis (AASLD 2021): ascitic protein < 15 g/L plus kidney or liver criteria */
  function sbpProphylaxis(x) {
    if (!ok(x.prot) || x.prot >= 15) return null;
    const why = [];
    if (ok(x.cr) && x.cr > 106) why.push("creatinine " + r(x.cr) + " (above 106)");
    if (ok(x.urea) && x.urea > 8.9) why.push("urea " + r(x.urea, 1) + " (above 8.9 mmol/L, BUN 25)");
    if (ok(x.na) && x.na < 130) why.push("sodium " + r(x.na) + " (below 130)");
    if (ok(x.cp) && x.cp >= 9 && ok(x.bili) && x.bili > 51) why.push("Child-Pugh " + x.cp + " with bilirubin " + r(x.bili) + " (above 51)");
    return { meets: why.length > 0, why };
  }

  /* diuretic holds (AASLD 2021): AKI, sodium 125 or less, potassium out of range, worsening encephalopathy */
  function diureticHolds(x) {
    const out = [];
    if (x.aki) out.push("Hold all diuretics: acute kidney injury.");
    if (ok(x.na) && x.na <= 125) out.push("Hold diuretics: sodium " + r(x.na) + " (125 or lower). Fluid restriction about 1 L/day.");
    if (ok(x.k) && x.k > 6) out.push("Hold spironolactone: potassium " + r(x.k, 1) + ".");
    else if (ok(x.k) && x.k >= 5.5) out.push("Potassium " + r(x.k, 1) + ": reduce spironolactone or adjust the ratio.");
    if (ok(x.k) && x.k < 3) out.push("Hold furosemide: potassium " + r(x.k, 1) + ".");
    if (x.heBad) out.push("Encephalopathy grade 3-4: hold diuretics.");
    return out;
  }

  /* ---------- nutrition (AASLD 2021) ---------- */
  function nutrition(x) {
    if (!ok(x.wt)) return null;
    const pct = [0, 0.05, 0.1, 0.15][x.ascitesLevel || 0] + (x.edema ? 0.05 : 0); // dry weight: subtract 5 / 10 / 15% for mild / moderate / tense ascites, 5% for leg edema
    const dry = x.wt * (1 - pct);
    const bmi = ok(x.ht) && x.ht > 100 ? dry / Math.pow(x.ht / 100, 2) : null;
    const ibw = ok(x.ht) && x.ht > 100 ? (x.sex === "female" ? 45.5 : 50) + 0.91 * (x.ht - 152.4) : null;
    let kcal, prot, basis;
    if (bmi == null || bmi < 30) { kcal = [35 * dry, 35 * dry]; prot = [1.2 * dry, 1.5 * dry]; basis = "dry weight " + r(dry, 1) + " kg"; }
    else if (bmi < 40) { kcal = [25 * ibw, 35 * ibw]; prot = [1.2 * ibw, 1.5 * ibw]; basis = "ideal weight " + r(ibw, 1) + " kg (BMI 30-40)"; }
    else { kcal = [20 * ibw, 25 * ibw]; prot = [1.2 * ibw, 1.5 * ibw]; basis = "ideal weight " + r(ibw, 1) + " kg (BMI 40 or more)"; }
    const risk = (bmi != null && bmi < 18.5) || x.childC ? "high" : "at risk";
    return { dry, bmi, ibw, kcal: kcal.map((v) => Math.round(v / 50) * 50), prot: prot.map((v) => Math.round(v / 5) * 5), basis, risk };
  }

  /* ---------- VTE ---------- */
  const PADUA = [
    ["cancer", "Active cancer", 3], ["prevvte", "Previous VTE (not superficial)", 3], ["mobility", "Reduced mobility (bed rest 3 days or more)", 3], ["thrombophilia", "Known thrombophilia", 3],
    ["trauma", "Trauma or surgery in the past month", 2], ["age", "Age 70 or older", 1], ["hfrf", "Heart or respiratory failure", 1], ["mistroke", "Acute MI or ischemic stroke", 1],
    ["infection", "Acute infection or rheumatologic disorder", 1], ["obese", "BMI 30 or more", 1], ["hormone", "Hormonal treatment", 1]];
  const padua = (sel) => PADUA.reduce((s, [id, , p]) => s + (sel[id] ? p : 0), 0);

  function vte(x) {
    const why = [];
    if (x.therapeutic) return { state: "na", head: "Already on therapeutic anticoagulation (" + x.therapeutic + "): no separate prophylaxis.", why };
    if (x.bleeding) why.push("active bleeding or variceal bleed not yet controlled");
    if (ok(x.hgbDrop) && x.hgbDrop >= 20) why.push("hemoglobin down " + r(x.hgbDrop) + " g/L in 48 h");
    if (ok(x.plt) && x.plt < 50) why.push("platelets " + r(x.plt) + " (below 50: no guideline threshold, but many centres avoid drug prophylaxis here)");
    const dose = ok(x.crcl) && x.crcl < 30 ? "enoxaparin 30 mg SC daily or heparin 5,000 units SC every 8-12 h (CrCl " + r(x.crcl) + " mL/min)" : "enoxaparin 40 mg SC daily (or dalteparin 5,000 units SC daily, per formulary)";
    if (x.prophylaxis) return { state: why.length ? "review" : "on", head: "Prophylaxis ordered: " + x.prophylaxis + (why.length ? ". Review: " + why.join("; ") + "." : "."), why, dose };
    if (why.length) return { state: "mechanical", head: "Use intermittent pneumatic compression for now; no drug prophylaxis until resolved.", why, dose,
      start: "Start " + dose + " once bleeding is controlled and hemoglobin is stable (after a variceal bleed, agree timing with GI). Reassess daily." };
    if (x.padua >= 4) return { state: "start", head: "High VTE risk (Padua " + x.padua + "): start " + dose + " now.", why, dose };
    return { state: "low", head: "Low VTE risk (Padua " + x.padua + "): drug prophylaxis not needed. Mobilise; reassess if risk changes.", why, dose };
  }

  const api = { egfr, crForEgfr, crcl, aki, fena, mapOf, nsbbCheck, hrs, akiPlan, fluid, albuminSbp, albuminLvp, sbpProphylaxis, diureticHolds, nutrition, PADUA, padua, vte, DAY };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.LiverRules = api;
})(typeof window !== "undefined" ? window : globalThis);
