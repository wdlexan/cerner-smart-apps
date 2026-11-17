/* AKI rules: KDIGO staging, fractional excretions, cause pattern, nephrology and dialysis triggers.
   Pure functions (no page, no chart) so they can be tested: node tests/test_aki.js
   Units: creatinine umol/L (serum) and mmol/L (urine); urea mmol/L. UNVERIFIED draft written by Claude:
   check against KDIGO 2012 and local practice before clinical use. */
(function (root) {
  const HR = 36e5, DAY = 24 * HR;
  const r1 = (v) => Math.round(v * 10) / 10;

  /* ---------- KDIGO 2012 staging by creatinine ----------
     series: [{t, v}] umol/L sorted oldest first. baselineOverride: umol/L typed by the clinician (optional).
     Baseline (when not typed): lowest value in the 7 days before the latest; else lowest in the prior 365 days (presumed, older). */
  function creatStage(series, opts) {
    opts = opts || {};
    const s = (series || []).filter((e) => e && isFinite(e.v)).sort((a, b) => a.t - b.t);
    if (!s.length) return null;
    const cur = s[s.length - 1], prior = s.slice(0, -1);
    const win = (d) => prior.filter((e) => cur.t - e.t <= d && cur.t - e.t > 0);
    const low = (a) => a.reduce((m, e) => (!m || e.v < m.v ? e : m), null);
    let base = null, baseKind = "";
    // pre-admission values (7-365 days before the latest): their median is the presumed baseline.
    // The lowest value in the past 7 days is used instead when it is lower (or when there is nothing older).
    const old = prior.filter((e) => cur.t - e.t > 7 * DAY && cur.t - e.t <= 365 * DAY).sort((a, b) => a.v - b.v);
    const med = old.length ? old[Math.floor((old.length - 1) / 2)] : null, lo7 = low(win(7 * DAY));
    if (opts.baseline > 0) { base = { v: opts.baseline, t: null }; baseKind = "typed"; }
    else if (med && (!lo7 || med.v <= lo7.v)) { base = med; baseKind = old.length > 1 ? `median of ${old.length} values 7-365 days ago (presumed)` : "value from 7-365 days ago (presumed)"; }
    else if (lo7) { base = lo7; baseKind = "lowest in prior 7 days"; }
    const lo48 = low(win(2 * DAY));
    const rise48 = lo48 ? cur.v - lo48.v : null;
    const ratio = base ? cur.v / base.v : null;
    const reasons = [];
    let stage = 0;
    if (ratio != null && ratio >= 1.5) { stage = 1; reasons.push(`${r1(ratio)} × baseline (${Math.round(base.v)})`); }
    if (rise48 != null && rise48 >= 26.5) { stage = Math.max(stage, 1); reasons.push(`rise of ${Math.round(rise48)} umol/L in 48 h`); }
    if (ratio != null && ratio >= 2) stage = Math.max(stage, 2);
    if (ratio != null && ratio >= 3) stage = 3;
    if (stage >= 1 && cur.v >= 353.6) { if (stage < 3) reasons.push("creatinine 354 or more with an acute rise"); stage = 3; }
    if (opts.rrt) { stage = 3; reasons.push("on kidney replacement therapy"); }
    // peak in the last 7 days and direction
    const last7 = s.filter((e) => cur.t - e.t <= 7 * DAY);
    const peak = last7.reduce((m, e) => (e.v > m.v ? e : m), last7[0]);
    const prev = prior.length ? prior[prior.length - 1] : null;
    let trend = "single value";
    if (prev) { const d = cur.v - prev.v, pct = d / prev.v; trend = Math.abs(pct) < 0.1 ? "stable" : d > 0 ? "rising" : "falling"; }
    const recovering = peak && peak !== cur && cur.v <= peak.v * 0.8; // 20% or more below the 7-day peak
    return { cur, base, baseKind, ratio, rise48, lo48, stage, reasons, peak, trend, recovering, n: s.length };
  }

  /* ---------- KDIGO staging by urine output ----------
     uo: [{t, v mL}] each a charted volume (assumed to cover the time since the previous entry). Rates use mL/kg/h.
     Only judged when charting covers the window; returns null otherwise. */
  function uoStage(uo, weightKg, now) {
    if (!weightKg || !uo || !uo.length) return null;
    now = now || Date.now();
    const s = uo.filter((e) => isFinite(e.v)).sort((a, b) => a.t - b.t);
    const first = s[0].t;
    const rate = (h) => {
      const from = now - h * HR;
      if (first > from + 2 * HR) return null; // charting does not go back far enough
      const vol = s.filter((e) => e.t > from && e.t <= now).reduce((a, e) => a + e.v, 0);
      return vol / weightKg / h;
    };
    const r6 = rate(6), r12 = rate(12), r24 = rate(24);
    let stage = 0; const reasons = [];
    if (r6 != null && r6 < 0.5) { stage = 1; reasons.push(`${Math.round(r6 * 100) / 100} mL/kg/h over 6 h`); }
    if (r12 != null && r12 < 0.5) { stage = 2; reasons.push(`${Math.round(r12 * 100) / 100} mL/kg/h over 12 h`); }
    if (r24 != null && r24 < 0.3) { stage = 3; reasons.push(`${Math.round(r24 * 100) / 100} mL/kg/h over 24 h`); }
    if (r12 != null && r12 === 0) { stage = 3; reasons.push("no urine for 12 h"); }
    if (r6 == null && r12 == null && r24 == null) return null;
    return { stage, reasons, r6, r12, r24 };
  }

  /* ---------- eGFR (CKD-EPI 2021, no race term). Only valid at steady state: use the baseline, not during AKI. ---------- */
  function egfr(scrUmol, age, sex) {
    if (!(scrUmol > 0) || !(age >= 18) || !/^(male|female)$/.test(sex || "")) return null;
    const scr = scrUmol / 88.4, f = sex === "female", k = f ? 0.7 : 0.9, a = f ? -0.241 : -0.302;
    return 142 * Math.pow(Math.min(scr / k, 1), a) * Math.pow(Math.max(scr / k, 1), -1.2) * Math.pow(0.9938, age) * (f ? 1.012 : 1);
  }
  /* Cockcroft-Gault (for drug dosing), mL/min */
  function crcl(scrUmol, age, sex, kg) {
    if (!(scrUmol > 0) || !(age > 0) || !(kg > 0) || !sex) return null;
    return ((140 - age) * kg * (sex === "female" ? 1.04 : 1.23)) / scrUmol;
  }

  /* ---------- fractional excretion. serum creatinine umol/L, urine creatinine mmol/L ---------- */
  function fe(uX, sX, uCrMmol, sCrUmol) {
    if (![uX, sX, uCrMmol, sCrUmol].every((v) => v > 0)) return null;
    return (uX * sCrUmol) / (sX * uCrMmol * 1000) * 100;
  }
  /* urea (mmol/L) to creatinine (umol/L) ratio, as mmol:mmol. About 80 corresponds to BUN:Cr 20 (mg/dL). */
  function ureaCrRatio(urea, scrUmol) { return urea > 0 && scrUmol > 0 ? (urea * 1000) / scrUmol : null; }

  /* ---------- cause pattern ----------
     x: { fena, feurea, una, uosm, ratio, diuretic, ckd, hydro, pvr, retention, hematuriaProteinuria, rbcCasts, wbcCasts, sterilePyuria,
          muddyCasts, eos, rash, aminDrug, contrast, ck, recentHypotension, sepsis, volumeLow } -> { lean, scores, reasons } */
  function pattern(x) {
    const sc = { prerenal: 0, atn: 0, ain: 0, gn: 0, postrenal: 0 }, why = { prerenal: [], atn: [], ain: [], gn: [], postrenal: [] };
    const add = (k, n, t) => { sc[k] += n; why[k].push(t); };
    // urine indices (FENa unreliable on diuretics or with CKD: lean on FEUrea then)
    const feReliable = !x.diuretic && !x.ckd;
    if (x.fena != null && feReliable) { if (x.fena < 1) add("prerenal", 2, `FENa ${r1(x.fena)}% (under 1%)`); else if (x.fena > 2) add("atn", 2, `FENa ${r1(x.fena)}% (over 2%)`); }
    else if (x.fena != null && x.fena < 1) add("prerenal", 1, `FENa ${r1(x.fena)}% (under 1% even on a diuretic or with CKD)`);
    if (x.feurea != null) { if (x.feurea < 35) add("prerenal", x.diuretic ? 2 : 1, `FEUrea ${r1(x.feurea)}% (under 35%)`); else if (x.feurea > 50) add("atn", x.diuretic ? 2 : 1, `FEUrea ${r1(x.feurea)}% (over 50%)`); }
    if (x.una != null && feReliable) { if (x.una < 20) add("prerenal", 1, `urine Na ${x.una} (under 20)`); else if (x.una > 40) add("atn", 1, `urine Na ${x.una} (over 40)`); }
    if (x.uosm != null) { if (x.uosm > 500) add("prerenal", 1, `urine osm ${x.uosm} (over 500)`); else if (x.uosm < 350) add("atn", 1, `urine osm ${x.uosm} (under 350)`); }
    if (x.ratio != null && x.ratio > 100) add("prerenal", 1, `urea:creatinine ${Math.round(x.ratio)} (over 100; also GI bleed, steroids, catabolism)`);
    if (x.volumeLow) add("prerenal", 2, "volume depletion or low effective volume on exam");
    // ATN context
    if (x.muddyCasts) add("atn", 3, "muddy brown granular casts");
    if (x.recentHypotension || x.sepsis) add("atn", 1, x.sepsis ? "sepsis" : "recent hypotension");
    if (x.contrast) add("atn", 1, "contrast in the past 72 h");
    if (x.ck != null && x.ck > 5000) add("atn", 2, `CK ${Math.round(x.ck)} (rhabdomyolysis)`);
    if (x.nephrotoxin) add("atn", 1, "nephrotoxic drug (" + x.nephrotoxin + ")");
    // AIN
    if (x.wbcCasts) add("ain", 3, "white cell casts");
    if (x.sterilePyuria) add("ain", 2, "white cells in urine without infection");
    if (x.eos) add("ain", 1, "blood eosinophilia");
    if (x.rash) add("ain", 1, "rash or fever");
    if (x.ainDrug) add("ain", 1, "drug that can cause AIN (" + x.ainDrug + ")");
    // GN
    if (x.rbcCasts) add("gn", 4, "red cell casts or dysmorphic red cells");
    if (x.hematuriaProteinuria) add("gn", 2, "blood and protein on urinalysis");
    if (x.serology) add("gn", 3, x.serology);
    // post-renal
    if (x.hydro) add("postrenal", 4, "hydronephrosis on imaging");
    if (x.pvr != null && x.pvr > 200) add("postrenal", 3, `bladder scan ${Math.round(x.pvr)} mL`);
    if (x.retention) add("postrenal", 2, "urinary retention risk (prostate, anticholinergic, opioid, catheter problem)");
    if (x.anuria) add("postrenal", 1, "anuria (also seen in shock, bilateral vascular occlusion, RPGN)");
    const order = Object.keys(sc).sort((a, b) => sc[b] - sc[a]);
    const top = order[0], second = order[1];
    const lean = sc[top] === 0 ? "unclear" : sc[top] - sc[second] <= 1 ? top + "+" + second : top;
    return { lean, scores: sc, reasons: why, order };
  }

  /* ---------- urgent dialysis indications (AEIOU) ----------
     x: { k, ph, hco3, urea, overload, pericarditis, encephalopathy, bleeding, toxin, lithium } -> [{level, text}] */
  function rrt(x) {
    const out = [];
    if (x.k != null && x.k >= 6.5) out.push({ level: "urgent", text: `Potassium ${x.k}: treat now; dialysis if it does not respond to medical treatment or keeps rising.` });
    else if (x.k != null && x.k >= 6) out.push({ level: "action", text: `Potassium ${x.k}: ECG, treat, recheck in 2-4 h.` });
    if (x.ph != null && x.ph < 7.15) out.push({ level: "urgent", text: `pH ${x.ph}: severe metabolic acidosis; dialysis if not responding.` });
    else if (x.hco3 != null && x.hco3 < 12) out.push({ level: "urgent", text: `Bicarbonate ${x.hco3}: severe acidosis; get a blood gas.` });
    if (x.overload) out.push({ level: "urgent", text: "Fluid overload not responding to diuretics." });
    if (x.pericarditis || x.encephalopathy || x.bleeding) out.push({ level: "urgent", text: "Uremic complication (" + [x.pericarditis && "pericarditis", x.encephalopathy && "encephalopathy", x.bleeding && "bleeding"].filter(Boolean).join(", ") + ")." });
    else if (x.urea != null && x.urea > 35) out.push({ level: "action", text: `Urea ${r1(x.urea)} mmol/L: look for uremic symptoms (confusion, pericardial rub, bleeding).` });
    if (x.lithium != null && x.lithium > 2.5) out.push({ level: "urgent", text: `Lithium ${x.lithium}: dialysable toxin; discuss with nephrology and poison centre.` });
    if (x.toxin) out.push({ level: "urgent", text: "Dialysable toxin suspected (" + x.toxin + ")." });
    return out;
  }

  /* ---------- when to involve nephrology ----------
     x: { stage, rrtList, pattern, hematuriaProteinuria, rbcCasts, serology, tma, myeloma, transplant, baseEgfr, noRecovery72, unclear, ain, pregnancy, single }
     -> [{level: "urgent"|"today"|"discuss", text}] */
  function nephro(x) {
    const out = [];
    if ((x.rrtList || []).some((r) => r.level === "urgent")) out.push({ level: "urgent", text: "Possible need for dialysis (see dialysis indications): call nephrology now." });
    if (x.stage >= 3) out.push({ level: "today", text: "KDIGO stage 3 AKI." });
    if (x.rbcCasts || x.serology) out.push({ level: "urgent", text: "Possible rapidly progressive glomerulonephritis (red cell casts, ANCA or anti-GBM positive, low complement): same-day nephrology, biopsy and treatment are time-critical." });
    else if (x.hematuriaProteinuria) out.push({ level: "today", text: "Blood and protein on urinalysis with AKI: glomerular disease needs to be excluded." });
    if (x.tma) out.push({ level: "urgent", text: "Possible thrombotic microangiopathy (low platelets, high LDH, anemia): smear for schistocytes, nephrology and hematology same day." });
    if (x.ain) out.push({ level: "today", text: "Possible acute interstitial nephritis: discuss steroids and biopsy." });
    if (x.myeloma) out.push({ level: "today", text: "Possible myeloma (cast nephropathy): serum free light chains, protein electrophoresis; discuss early." });
    if (x.transplant) out.push({ level: "today", text: "Kidney transplant recipient: involve the transplant nephrologist for any AKI." });
    if (x.baseEgfr != null && x.baseEgfr < 30) out.push({ level: "discuss", text: `AKI on CKD with baseline eGFR about ${Math.round(x.baseEgfr)}: discuss (less reserve, dialysis planning).` });
    if (x.noRecovery72) out.push({ level: "discuss", text: "No improvement after 72 h of treating the cause." });
    if (x.unclear && x.stage >= 1) out.push({ level: "discuss", text: "Cause unclear after the first workup." });
    if (x.single) out.push({ level: "discuss", text: "Single functioning kidney." });
    if (x.pregnancy) out.push({ level: "today", text: "Pregnancy: involve nephrology and obstetrics." });
    return out;
  }

  const api = { creatStage, uoStage, egfr, crcl, fe, ureaCrRatio, pattern, rrt, nephro, DAY, HR };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.AkiRules = api;
})(typeof window !== "undefined" ? window : globalThis);
