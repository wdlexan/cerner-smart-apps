/* Chart-wide "watch-out" rules. EDIT THIS FILE to change thresholds or wording. Each rule returns null or a card.
   Every threshold and drug list below is a common clinical convention written by Claude and is UNVERIFIED: check against your own sources
   (KDIGO for AKI, AGS Beers 2023 for sedatives and anticholinergics, CredibleMeds for QT, your hospital's pathways). No doses are given. */
(function () {
  const T = {
    K_HIGH: 5.5, K_RAAS: 5.0, K_LOW: 3.5, NA_LOW: 130, NA_VLOW: 125, EGFR_LOW: 30, EGFR_NSAID: 60,
    SBP_LOW: 100, SBP_VLOW: 90, HR_HIGH: 110, RR_HIGH: 22, TEMP_HIGH: 38.0, SPO2_LOW: 90,
    HGB_LOW: 100, HGB_VLOW: 80, HGB_DROP: 20, PLT_LOW: 100, GLU_HIGH: 20, GLU_LOW: 4.0, LACT_HIGH: 2.0,
    AGE_OLD: 65, AGE_VOLD: 75, AKI_RATIO: 1.5, AKI_ABS: 26.5
  };
  const SRC = { text: "Common clinical conventions drafted by Claude; thresholds and drug lists not checked against KDIGO, AGS Beers 2023, CredibleMeds or your hospital pathway.", status: "unverified" };

  function ctx(f) {
    const useOld = f.useOld;
    return {
      f, T,
      v: (k) => (f.values[k] != null && (useOld || !f.stale[k]) ? f.values[k] : null),
      src: (k) => f.source[k],
      has: (c) => !!(f.meds[c] && f.meds[c].length),
      names: (c) => (f.meds[c] || []).slice(0, 4).join(", "),
      age: f.age
    };
  }
  const R = (id, sev, title, from, watch, ifthen) => ({ id, sev, title, from, watch, ifthen, source: SRC });
  const label = { sbp: "Systolic BP", hr: "Heart rate", rr: "Resp rate", temp: "Temp", spo2: "SpO2", k: "K", na: "Na", creat: "Creatinine", egfr: "eGFR", hgb: "Hgb", wbc: "WBC", plt: "Platelets", glucose: "Glucose", inr: "INR", lactate: "Lactate" };
  const S = (c, ...keys) => keys.filter((k) => c.v(k) != null).map((k) => `${label[k]} ${c.src(k)}`);

  const RULES = [
    // ---------- electrolytes ----------
    (c) => {
      const k = c.v("k"); if (k == null) return null;
      const raas = ["acei", "arb", "mra", "kSupp", "trimeth"].filter((x) => c.has(x));
      if (k >= T.K_HIGH) return R("hyperk", "high", "High potassium", S(c, "k", "egfr").concat(raas.length ? ["On: " + raas.map((x) => c.names(x)).join("; ")] : []),
        ["Arrhythmia, muscle weakness", "Worse with kidney injury, ACE inhibitor/ARB, spironolactone-type drugs, potassium supplements, trimethoprim"],
        [["K stays high or ECG changes", "Treat per your hyperkalemia protocol and get an ECG; stop or hold the drugs that raise potassium"], ["Kidney function worsening", "Look for obstruction and volume depletion; discuss with nephrology"]]);
      if (k >= T.K_RAAS && raas.length) return R("hyperk", "med", "Potassium high-normal on drugs that raise it", S(c, "k").concat(["On: " + raas.map((x) => c.names(x)).join("; ")]),
        ["Further rise if kidney function falls or intake changes"], [["Potassium or creatinine rising", "Recheck within a day, review the drug list, consider holding the drug"]]);
      return null;
    },
    (c) => {
      const k = c.v("k"); if (k == null || k >= T.K_LOW) return null;
      const arr = ["qt", "digoxin"].filter((x) => c.has(x)), loop = c.has("loop") || c.has("thiazide");
      return R("hypok", arr.length ? "high" : "med", "Low potassium", S(c, "k").concat(arr.length ? ["On: " + arr.map((x) => c.names(x)).join("; ")] : []).concat(loop ? ["On a diuretic"] : []),
        ["Arrhythmia, especially with QT-prolonging drugs or digoxin", "Weakness, ileus", "Low magnesium often travels with it"],
        [["Potassium low", "Replace per your protocol, check magnesium, recheck after replacement"], ["QT drug or digoxin on the list", "Get an ECG and review the need for the drug"]]);
    },
    (c) => {
      const na = c.v("na"); if (na == null || na >= T.NA_LOW) return null;
      return R("hypona", na < T.NA_VLOW ? "high" : "med", "Low sodium", S(c, "na").concat(c.has("thiazide") ? ["On: " + c.names("thiazide")] : []),
        ["Confusion, falls, seizures if severe", "Overly fast correction can harm"],
        [["New confusion or seizure", "Urgent assessment; follow your severe hyponatremia protocol and call the senior or ICU"], ["Any sodium correction", "Check the rate of change against your protocol limits"]]);
    },
    // ---------- kidney and drugs ----------
    (c) => {
      const creat = (c.f.series.creat || []).filter((x) => x.t), out = [];
      if (creat.length < 2) return null;
      const last = creat[0], day7 = last.t - 7 * 864e5, day2 = last.t - 2 * 864e5;
      const base = Math.min.apply(null, creat.slice(1).filter((x) => x.t >= day7).map((x) => x.v).concat([Infinity]));
      const recent = creat.slice(1).filter((x) => x.t >= day2).map((x) => x.v);
      const byRatio = base !== Infinity && last.v >= T.AKI_RATIO * base, byAbs = recent.length && last.v - Math.min.apply(null, recent) >= T.AKI_ABS;
      if (!byRatio && !byAbs) return null;
      if (!c.f.useOld && c.f.stale.creat) return null;
      const nephro = ["nsaid", "acei", "arb", "mra", "nephrotoxicAbx", "loop", "thiazide", "sglt2", "metformin"].filter((x) => c.has(x));
      return R("aki", "high", "Creatinine rise that may meet an AKI criterion", [`Creatinine ${last.v} umol/L (${last.date}) vs lowest ${base !== Infinity ? base : Math.min.apply(null, recent)} in the window`].concat(nephro.length ? ["Kidney-relevant drugs: " + nephro.map((x) => c.names(x)).join("; ")] : []),
        ["Further decline, high potassium, fluid overload", "Drugs that accumulate or harm the kidney"],
        [["Creatinine still rising", "Look for dehydration, hypotension, obstruction (bladder scan, ultrasound), urinalysis; hold nephrotoxic drugs; review renal doses"], ["Potassium high, acidosis, or overload", "Urgent nephrology discussion"]]);
    },
    (c) => {
      const egfr = c.v("egfr"); if (egfr == null || egfr >= T.EGFR_LOW) return null;
      const drugs = ["metformin", "anticoag", "gabapentinoid", "nsaid", "nephrotoxicAbx", "lithium", "digoxin", "sglt2", "sulfonylurea"].filter((x) => c.has(x));
      if (!drugs.length) return null;
      return R("renalDose", "high", "Low eGFR with drugs that may need adjusting", S(c, "egfr").concat(["On: " + drugs.map((x) => c.names(x)).join("; ")]),
        ["Drug accumulation: bleeding, confusion, hypoglycemia, lactic acidosis, toxicity"], [["Any of these drugs unadjusted", "Check each dose against the monograph or pharmacy renal dosing reference and change or stop"]]);
    },
    (c) => {
      if (!c.has("nsaid")) return null;
      const egfr = c.v("egfr"), triple = (c.has("acei") || c.has("arb")) && (c.has("loop") || c.has("thiazide"));
      if (!((egfr != null && egfr < T.EGFR_NSAID) || triple || c.has("anticoag"))) return null;
      return R("nsaidKidney", egfr != null && egfr < T.EGFR_LOW ? "high" : "med", "NSAID with kidney or bleeding risk", ["On: " + c.names("nsaid")].concat(S(c, "egfr")).concat(triple ? ["Also on ACE inhibitor/ARB plus a diuretic"] : []).concat(c.has("anticoag") ? ["Also on: " + c.names("anticoag")] : []),
        ["Kidney injury, GI bleeding, fluid retention, high potassium"], [["No clear need for the NSAID", "Stop it and use an alternative"], ["Creatinine rising or dark stools", "Stop the NSAID; check creatinine, Hgb and stool"]]);
    },
    // ---------- bleeding ----------
    (c) => {
      if (!c.has("anticoag")) return null;
      const hgb = c.v("hgb"), plt = c.v("plt"), inr = c.v("inr"), why = [];
      if (hgb != null && hgb < T.HGB_LOW) why.push("Hgb " + c.src("hgb"));
      if (plt != null && plt < T.PLT_LOW) why.push("Platelets " + c.src("plt"));
      if (inr != null && inr > 3.5 && /warfarin|coumadin/i.test(c.names("anticoag"))) why.push("INR " + c.src("inr"));
      if (c.has("antiplatelet")) why.push("Also on: " + c.names("antiplatelet"));
      if (!why.length) return null;
      return R("bleedRisk", "high", "Anticoagulant with bleeding risk", ["On: " + c.names("anticoag")].concat(why),
        ["Bleeding: black stools, hematuria, falling Hgb, bruising", "Falls with a head strike"], [["Active bleeding or Hgb falling", "Hold the anticoagulant, repeat counts, type and screen, and follow your bleeding or reversal protocol"], ["Platelets falling", "Think of heparin-induced thrombocytopenia if on heparin; discuss with hematology"]]);
    },
    (c) => {
      const s = c.f.series.hgb || []; if (s.length < 2 || (!c.f.useOld && c.f.stale.hgb)) return null;
      const last = s[0], prev = s.slice(1).filter((x) => x.t && last.t - x.t <= 7 * 864e5).map((x) => x.v);
      if (!prev.length || Math.max.apply(null, prev) - last.v < T.HGB_DROP) return null;
      return R("hgbDrop", "high", "Hemoglobin falling", [`Hgb ${last.v} g/L (${last.date}), down at least ${T.HGB_DROP} from a value in the past 7 days`],
        ["Bleeding, hemolysis, dilution after fluids"], [["Drop continues or unstable vital signs", "Look for a bleeding source, type and screen, review anticoagulants, call senior or surgical or GI as appropriate"]]);
    },
    (c) => {
      const h = c.v("hgb"); if (h == null || h >= T.HGB_VLOW) return null;
      return R("anemia", "med", "Low hemoglobin", S(c, "hgb"), ["Shortness of breath, chest pain, tachycardia", "Bleeding source"], [["Symptoms or unstable", "Follow your transfusion threshold and look for the source"]]);
    },
    // ---------- drugs ----------
    (c) => {
      const q = c.f.meds.qt || [], k = c.v("k");
      if (q.length < 2 && !(q.length && k != null && k < T.K_LOW)) return null;
      return R("qt", q.length >= 2 && k != null && k < T.K_LOW ? "high" : "med", "QT-prolonging drugs", ["On: " + q.slice(0, 5).join(", ")].concat(S(c, "k")),
        ["Prolonged QT, torsades, especially with low K or Mg, slow heart rate, older age, heart disease"], [["No recent ECG", "Get an ECG and check the QTc against your hospital's threshold"], ["QTc long", "Correct K and Mg, stop or replace the drug that can be stopped, and get senior or cardiology advice"]]);
    },
    (c) => {
      const age = c.age, sed = ["opioid", "benzo", "zdrug"].filter((x) => c.has(x)), antipsy = c.has("antipsychotic");
      const dual = sed.length >= 2, old = age != null && age >= T.AGE_OLD;
      if (!(dual || (old && (sed.length || antipsy)))) return null;
      return R("sedatives", dual || (age != null && age >= T.AGE_VOLD) ? "high" : "med", "Sedating drugs" + (old ? " in an older adult" : ""),
        ["On: " + sed.map((x) => c.names(x)).concat(antipsy ? [c.names("antipsychotic")] : []).join("; ")].concat(age != null ? ["Age " + age] : []),
        ["Falls, delirium, over-sedation, slow breathing (more so with lung disease, kidney failure, or combinations)"], [["More drowsy or breathing slowly", "Hold the sedating drugs, check oxygen and CO2, follow your opioid-reversal protocol"], ["No clear need", "Taper or stop (see AGS Beers 2023)"]]);
    },
    (c) => {
      const ac = c.f.meds.anticholinergic || [], age = c.age;
      if (!ac.length || age == null || age < T.AGE_OLD) return null;
      return R("anticholinergic", "med", "Anticholinergic drug in an older adult", ["On: " + ac.slice(0, 4).join(", "), "Age " + age],
        ["Delirium, urinary retention, constipation, falls"], [["New confusion or retention", "Stop the drug if possible; bladder scan; bowel review"]]);
    },
    (c) => {
      if (!c.has("steroid")) return null;
      const g = c.v("glucose"), bleed = c.has("nsaid") || c.has("anticoag");
      return R("steroids", g != null && g >= T.GLU_HIGH ? "high" : "low", "Corticosteroid", ["On: " + c.names("steroid")].concat(S(c, "glucose")).concat(bleed ? ["Also on a drug that raises bleeding risk"] : []),
        ["High blood sugar, agitation or delirium, poor sleep, fluid retention", "Stomach bleeding when combined with NSAIDs or anticoagulants"], [["Glucose high", "Start glucose monitoring and treat per your protocol"], ["Agitation or confusion", "Review dose and timing, rule out other causes"]]);
    },
    // ---------- vital signs ----------
    (c) => {
      const s = c.v("sbp"); if (s == null || s >= T.SBP_LOW) return null;
      const dr = ["antihtn", "loop", "thiazide", "acei", "arb", "mra", "opioid"].filter((x) => c.has(x));
      return R("hypotension", s < T.SBP_VLOW ? "high" : "med", "Low blood pressure", S(c, "sbp", "hr", "lactate").concat(dr.length ? ["Could be contributing: " + dr.map((x) => c.names(x)).join("; ")] : []),
        ["Poor perfusion, kidney injury, falls, sepsis or bleeding behind it"], [["BP stays low or falls", "Assess perfusion; hold blood-pressure-lowering drugs; look for sepsis, bleeding, cardiac cause; call a senior or ICU outreach"]]);
    },
    (c) => {
      const o = c.v("spo2"); if (o == null || o >= T.SPO2_LOW) return null;
      return R("hypoxia", "high", "Low oxygen saturation", S(c, "spo2", "rr"), ["Rising oxygen need, tiring, confusion"],
        [["Oxygen need rising", "Repeat assessment, chest imaging, consider ICU or critical care review"], ["Known lung disease with drowsiness", "Check a gas; use your target range for CO2 retainers"]]);
    },
    (c) => {
      const t = c.v("temp"), hr = c.v("hr"), rr = c.v("rr"), sbp = c.v("sbp"), w = c.v("wbc"), lac = c.v("lactate"), why = [];
      if (t != null && (t >= T.TEMP_HIGH || t < 36)) why.push("Temp " + c.src("temp"));
      if (hr != null && hr > 90) why.push("HR " + c.src("hr"));
      if (rr != null && rr > 20) why.push("RR " + c.src("rr"));
      if (w != null && (w > 12 || w < 4)) why.push("WBC " + c.src("wbc"));
      let q = 0; if (rr != null && rr >= T.RR_HIGH) q++; if (sbp != null && sbp <= 100) q++;
      const lacHigh = lac != null && lac >= T.LACT_HIGH;
      if (why.length < 2 && q < 2 && !lacHigh) return null;
      return R("sepsisSigns", q >= 2 || lacHigh ? "high" : "med", "Vital signs or labs that fit possible sepsis", why.concat(lacHigh ? ["Lactate " + c.src("lactate")] : []).concat([`Quick check: ${q} of 2 measurable qSOFA items (mentation not read from the chart)`]),
        ["Worsening infection, low blood pressure, organ dysfunction"], [["Looks unwell or BP falling", "Follow your sepsis pathway: cultures, lactate, source control, early antibiotics, call senior or ICU"]]);
    },
    // ---------- glucose ----------
    (c) => {
      const g = c.v("glucose"); if (g == null) return null;
      if (g >= T.GLU_HIGH) return R("glucose", "high", "High blood glucose", S(c, "glucose").concat(c.has("sglt2") ? ["On: " + c.names("sglt2")] : []).concat(c.has("steroid") ? ["On a steroid"] : []),
        ["Dehydration, ketoacidosis (including on SGLT2 inhibitors, even with only mildly high glucose)"], [["Nausea, abdominal pain, fast breathing", "Check ketones and a blood gas; follow your DKA/HHS protocol"]]);
      if (g < T.GLU_LOW) return R("glucose", "high", "Low blood glucose", S(c, "glucose").concat(c.has("insulin") || c.has("sulfonylurea") ? ["On: " + [c.names("insulin"), c.names("sulfonylurea")].filter(Boolean).join("; ")] : []),
        ["Repeat lows, especially with poor intake or kidney failure"], [["Another low", "Review the diabetes drugs and doses and reduce or hold"]]);
      return null;
    },
    (c) => {
      const risky = (c.has("insulin") || c.has("sulfonylurea")) && c.v("egfr") != null && c.v("egfr") < T.EGFR_LOW;
      if (!risky) return null;
      return R("hypoRisk", "med", "Diabetes drugs with low kidney function", S(c, "egfr").concat(["On: " + [c.names("insulin"), c.names("sulfonylurea")].filter(Boolean).join("; ")]),
        ["Prolonged or repeated low blood sugar"], [["Poor intake or glucose dropping", "Reduce the doses and increase glucose checks"]]);
    },
    // ---------- allergy ----------
    (c) => {
      const pen = c.f.allergies.filter((a) => /penicillin|amoxicillin|ampicillin|beta.?lactam|cephalosporin|cef|sulfa/i.test(a.text));
      if (!pen.length || !c.has("betaLactam")) return null;
      return R("allergyBetaLactam", "med", "Allergy entry and a related antibiotic on the list", ["Allergy: " + pen.map((a) => a.text + (a.reaction ? " (" + a.reaction + ")" : "") + (a.severity ? " [" + a.severity + "]" : "")).join("; "), "On: " + c.names("betaLactam")],
        ["Allergic reaction"], [["Reaction history unclear", "Clarify the reaction type and timing with the patient or pharmacy; it may still be appropriate, but it should be a deliberate decision"]]);
    },
    // ---------- age ----------
    (c) => {
      if (c.age == null || c.age < T.AGE_VOLD) return null;
      return R("elderly", "low", "Age " + c.age + ": baseline risks in hospital", ["Age " + c.age],
        ["Delirium, falls, pressure injury, deconditioning, poor intake"], [["Any new confusion", "Look for infection, drugs, retention, constipation, pain, low oxygen; avoid adding sedatives"], ["Not mobilizing", "Early physio and a plan for where they go next"]]);
    }
  ];

  function run(f) {
    const c = ctx(f), out = [];
    RULES.forEach((fn) => { try { const r = fn(c); if (r) out.push(r); } catch (e) { out.push({ id: "error", sev: "low", title: "A rule failed to run", from: [String(e && e.message || e)], watch: [], ifthen: [], source: SRC }); } });
    const rank = { high: 0, med: 1, low: 2 };
    return out.sort((a, b) => rank[a.sev] - rank[b.sev]);
  }
  window.WARules = { run, T, SRC };
})();
