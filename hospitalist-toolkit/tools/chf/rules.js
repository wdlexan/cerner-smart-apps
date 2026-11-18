/* Heart failure (CHF) admission: pure decision rules. No chart access here, so it can be tested with node.
   UNVERIFIED DRAFT written by Claude from: ICON-RELOADED (Januzzi, JACC 2018) age-stratified NT-proBNP cut-offs; ESC 2021 HF guideline
   (+2023 focused update) natriuresis-guided diuretic algorithm; CCS/CHFS 2021 HF guideline and 2020 cardiac amyloidosis position statement;
   DOSE, ADVOR, CLOROTIC, STRONG-HF trials. Doses are typical adult doses: check against Island Health pharmacy before use. */
(function () {
  const r0 = (v) => Math.round(v), r1 = (v) => Math.round(v * 10) / 10;

  /* ---------- natriuretic peptides ---------- */
  // NT-proBNP: ng/L and pg/mL are the same number
  const NT_BANDS = [{ max: 49, label: "under 50", cut: 450 }, { max: 75, label: "50 to 75", cut: 900 }, { max: 200, label: "over 75", cut: 1800 }];
  function ntBand(age) { return age == null ? null : NT_BANDS.find((b) => age <= b.max) || NT_BANDS[2]; }
  function ntInterp(v, age, o) {
    o = o || {};
    if (v == null) return null;
    const b = ntBand(age), notes = [];
    if (o.egfr != null && o.egfr < 60) notes.push(`eGFR ${o.egfr}: NT-proBNP is cleared by the kidney and runs higher; a value above the age cut-off is less specific (some use 1200 for eGFR under 60 when age is 50+)`);
    if (o.bmi != null && o.bmi >= 30) notes.push(`BMI ${o.bmi}: obesity LOWERS NT-proBNP (by about half at BMI 35+), so a "normal" value does not fully rule out HF`);
    if (o.af) notes.push("AF raises NT-proBNP on its own: the age cut-offs are less specific");
    if (o.sepsis) notes.push("Sepsis, PE, pneumonia and critical illness also raise it");
    if (o.arni) notes.push("On sacubitril/valsartan: BNP rises (neprilysin breaks BNP down) but NT-proBNP does not: use NT-proBNP");
    let zone, text;
    if (v < 300) { zone = "out"; text = "Under 300: acute heart failure very unlikely (ICON-RELOADED rule-out, negative predictive value about 98%)"; }
    else if (!b) { zone = "grey"; text = "Age needed for the rule-in cut-off"; }
    else if (v >= b.cut) { zone = "in"; text = `${v} is at or above ${b.cut} (age ${b.label}): acute heart failure likely`; }
    else { zone = "grey"; text = `Between 300 and ${b.cut} (age ${b.label}): grey zone. Use the exam, chest X-ray, POCUS (B-lines, IVC) and echo`; }
    return { zone, text, band: b, notes };
  }
  function bnpInterp(v) {
    if (v == null) return null;
    return v < 100 ? { zone: "out", text: "BNP under 100: acute HF unlikely" } : v >= 400 ? { zone: "in", text: "BNP 400 or more: acute HF likely" } : { zone: "grey", text: "BNP 100-400: grey zone" };
  }
  /* change from the highest value this admission to the latest */
  function ntChange(series) {
    if (!series || series.length < 2) return null;
    const peak = series.reduce((a, x) => (x.v > a.v ? x : a), series[0]), last = series[series.length - 1];
    if (last.t <= peak.t) return null;
    const pct = r0(((last.v - peak.v) / peak.v) * 100);
    return { peak, last, pct, text: pct <= -30 ? `Down ${-pct}% from the peak: a fall of 30% or more by discharge is reassuring` : pct < 0 ? `Down ${-pct}% from the peak: less than a 30% fall, so higher risk of readmission. Is the patient really decongested?` : `Up ${pct}% from the peak` };
  }

  /* ---------- loop diuretics ---------- */
  // oral furosemide equivalents: furosemide PO 40 = furosemide IV 20 = bumetanide 1 (PO or IV) = torsemide 20 PO
  function furoPOeq(drug, mg, route) {
    if (!(mg > 0)) return null;
    if (/bumet/i.test(drug)) return mg * 40;
    if (/torse|torasemide/i.test(drug)) return mg * 2;
    if (/furos|lasix/i.test(drug)) return /iv|intraven/i.test(route || "") ? mg * 2 : mg;
    return null;
  }
  /* starting IV dose. homePO = home oral furosemide-equivalent mg/day (0 or null = diuretic-naive). egfr optional */
  function startDose(homePO, egfr) {
    if (!homePO) {
      const hi = egfr != null && egfr < 30;
      return { daily: hi ? 80 : 40, text: hi ? "Diuretic-naive with eGFR under 30: furosemide 40-80 mg IV, repeat in 6-12 h according to the response" : "Diuretic-naive: furosemide 40 mg IV (20-40 mg; ESC), then assess the response", why: "ESC 2021" };
    }
    const iv = Math.min(Math.ceil((homePO * 2) / 20) * 20, 400), each = iv / 2;
    return { daily: iv, text: `On ${homePO} mg/day oral furosemide-equivalent at home: give about ${iv} mg/day IV (twice the home oral dose as IV; DOSE used 2.5x), e.g. furosemide ${each} mg IV BID`, why: "Oral absorption is poor in congestion; DOSE trial (bolus = infusion, high dose decongests faster)" };
  }
  /* response to the last dose. una = spot urine Na 2 h after the dose (mmol/L); uoPerH = urine output mL/h over 6 h; wt24 = weight change kg/24 h */
  function response(o) {
    const out = { ok: null, why: [] };
    if (o.una != null) { if (o.una < 50) { out.ok = false; out.why.push(`spot urine Na ${o.una} (under 50-70 mmol/L at 2 h)`); } else if (o.una >= 70) { out.ok = out.ok !== false; out.why.push(`spot urine Na ${o.una} (70 or more)`); } else out.why.push(`spot urine Na ${o.una} (borderline 50-70)`); }
    if (o.uoPerH != null) { if (o.uoPerH < 100) { out.ok = false; out.why.push(`urine output ${o.uoPerH} mL/h (under 100-150 mL/h over 6 h)`); } else if (o.uoPerH >= 150) { out.ok = out.ok !== false; out.why.push(`urine output ${o.uoPerH} mL/h`); } else out.why.push(`urine output ${o.uoPerH} mL/h (borderline)`); }
    if (o.wt24 != null) { if (o.wt24 > -0.5) { if (out.ok == null) out.ok = false; out.why.push(`weight ${o.wt24 > 0 ? "up" : "down"} ${Math.abs(r1(o.wt24))} kg in 24 h`); } else { if (out.ok == null) out.ok = true; out.why.push(`weight down ${Math.abs(r1(o.wt24))} kg in 24 h`); } }
    return out;
  }
  /* escalation ladder, given current IV furosemide mg/day */
  function ladder(ivDaily, hco3, egfr) {
    const L = [];
    const next = Math.min((ivDaily || 40) * 2, 400);
    L.push({ step: 1, t: `Poor response: double the loop dose (to about ${next} mg/day IV furosemide, single bolus max about 200 mg; usual daily max 400-600 mg). Recheck urine Na at 2 h / urine output at 6 h after each change` });
    L.push({ step: 2, t: "Add a second diuretic (sequential nephron blockade): metolazone 2.5-5 mg PO daily (give 30 min before the loop) or hydrochlorothiazide 25-50 mg daily (CLOROTIC). Check K, Mg, Na and creatinine daily: drops fast" });
    L.push({ step: 2, t: `Or acetazolamide 500 mg IV daily for up to 3 days (ADVOR)${hco3 != null ? ` - bicarbonate ${hco3}${hco3 >= 27 ? ": good fit (alkalosis)" : ""}` : ""}; best early in the admission` });
    L.push({ step: 2, t: "SGLT2 inhibitor (dapagliflozin or empagliflozin 10 mg daily) adds natriuresis and is a long-term pillar" + (egfr != null && egfr < 20 ? " (eGFR under 20: not started)" : "") });
    L.push({ step: 3, t: "Still resistant: continuous furosemide infusion (e.g. 10-20 mg/h after a bolus), look for low output (cool, narrow pulse pressure, rising lactate), and call cardiology / nephrology for inotropes or ultrafiltration" });
    return L;
  }
  /* days to dry weight */
  function daysTo(current, target, perDay) {
    if (!(current > 0 && target > 0 && perDay > 0)) return null;
    const kg = current - target; return kg <= 0 ? 0 : Math.ceil(kg / perDay);
  }
  /* creatinine change: rise in umol/L from the admission / pre-diuresis value */
  function creatinine(base, now, decongesting) {
    if (!(base > 0 && now > 0)) return null;
    const d = now - base, pct = r0((d / base) * 100);
    if (d <= 26) return { lvl: "ok", text: `Creatinine ${r0(base)} → ${r0(now)} (${d >= 0 ? "+" : ""}${r0(d)} umol/L): no worsening renal function` };
    if (decongesting) return { lvl: "action", text: `Creatinine up ${r0(d)} umol/L (${pct}%) while still congested and losing fluid: usually haemodynamic and NOT harmful. Keep diuresing unless hypotensive, dry, or K rising; do not stop SGLT2i or RAAS blockers for a small rise` };
    return { lvl: "urgent", text: `Creatinine up ${r0(d)} umol/L (${pct}%) and the patient looks decongested or dry: over-diuresis? Hold or reduce the loop, review BP, NSAIDs, contrast` };
  }

  /* ---------- IV to oral ---------- */
  function switchPO(ivDaily, homePO) {
    if (!(ivDaily > 0)) return null;
    const furoPO = Math.ceil((ivDaily * 2) / 20) * 20;
    const opts = [
      { a: `Furosemide ${furoPO} mg/day PO (2 x the IV daily dose; oral absorption about 50% and variable), e.g. ${furoPO / 2} mg BID or ${furoPO} mg once in the morning`, why: "Same drug" },
      { a: `Torsemide ${Math.max(10, Math.round(ivDaily / 10) * 10)} mg PO daily`, why: "About 80-100% absorbed, longer acting, once daily (torsemide 20 = furosemide 40 PO)" },
      { a: `Bumetanide ${r1(ivDaily / 20)} mg/day PO`, why: "About 80% absorbed (bumetanide 1 mg = furosemide 40 PO)" }];
    const note = homePO && furoPO <= homePO ? `This is not more than the home dose (${homePO} mg/day) that failed: discharge on a HIGHER dose than before admission, or switch to torsemide.` : "";
    return { furoPO, opts, note };
  }
  function readyForPO(s) {
    return [
      ["Congestion gone or nearly gone: no orthopnea, JVP not raised, edema minimal, lungs clear", s.decongested],
      ["At or within about 1 kg of the target (dry) weight", s.nearTarget],
      ["Off oxygen (or back to home oxygen)", s.offO2],
      ["Creatinine and K stable over 24 h", s.labsStable],
      ["SBP 90 or more, no symptomatic hypotension", s.bpOk],
      ["Eating and drinking; taking pills reliably", s.eating]];
  }

  /* ---------- GDMT by ejection fraction ---------- */
  function gdmt(ef, s, meds) {
    const has = (re) => meds.some((m) => re.test(m)), out = [];
    const k = s.k, egfr = s.egfr, sbp = s.sbp, hr = s.hr;
    const add = (name, on, dose, caution) => out.push({ name, on, dose, caution: caution.filter(Boolean) });
    const sglt = has(/dapagliflozin|forxiga|empagliflozin|jardiance|canagliflozin|ertugliflozin|sotagliflozin/i);
    const arni = has(/sacubitril|entresto/i), acei = has(/pril\b|ramipril|enalapril|lisinopril|perindopril|trandolapril|captopril/i), arb = has(/sartan\b|candesartan|valsartan|losartan|irbesartan|telmisartan|olmesartan/i) && !arni;
    const bb = has(/bisoprolol|carvedilol|metoprolol succ|metoprolol ?(cr|xl|er)|metoprolol|nebivolol/i), mra = has(/spironolactone|eplerenone|finerenone/i);
    if (ef === "low") {
      add("ARNI (or ACE inhibitor / ARB)", arni || acei || arb, arni ? "On sacubitril/valsartan" : "Sacubitril/valsartan 24/26 mg BID (49/51 if SBP over 110 and was on ACEi/ARB); stop an ACE inhibitor 36 h before. ACEi/ARB if ARNI not possible",
        [sbp != null && sbp < 95 && `SBP ${sbp}: start low or wait`, k != null && k > 5 && `K ${k}`, egfr != null && egfr < 30 && `eGFR ${egfr}: lower start`, (acei || arb) && !arni && "On ACEi/ARB: switch to ARNI when stable (CCS)"]);
      add("Beta-blocker (bisoprolol, carvedilol, metoprolol succinate)", bb, "Bisoprolol 1.25 mg daily or carvedilol 3.125 mg BID; start once euvolemic and off IV inotropes; double every 2 weeks",
        [hr != null && hr < 60 && `HR ${hr}`, s.decompensated && "Do not START while still wet; do not stop a home beta-blocker unless shock"]);
      add("MRA (spironolactone or eplerenone)", mra, "Spironolactone 12.5-25 mg daily if K under 5.0 and eGFR over 30; check K and creatinine at 3 days and 1 week",
        [k != null && k >= 5 && `K ${k}: not now`, egfr != null && egfr < 30 && `eGFR ${egfr}: avoid`]);
      add("SGLT2 inhibitor", sglt, "Dapagliflozin or empagliflozin 10 mg daily; start in hospital once stable (eGFR 20+ / 25+)",
        [egfr != null && egfr < 20 && `eGFR ${egfr}: not started below 20`, s.dka && "Type 1 diabetes / ketoacidosis risk: avoid"]);
      out.push({ name: "Then consider", on: null, dose: "Ivabradine (sinus HR 70+ on max beta-blocker), hydralazine/nitrate, vericiguat, digoxin; ICD/CRT if EF still 35% or less after 3 months of full GDMT", caution: [] });
    } else if (ef === "mid") {
      add("SGLT2 inhibitor", sglt, "Dapagliflozin or empagliflozin 10 mg daily (DELIVER, EMPEROR-Preserved)", [egfr != null && egfr < 20 && `eGFR ${egfr}`]);
      add("Consider ARNI/ACEi/ARB, beta-blocker, MRA", arni || acei || arb || bb || mra, "Treat as HFrEF-lite (CCS 2021): especially if EF was lower before or is falling", []);
    } else if (ef === "pres") {
      add("SGLT2 inhibitor", sglt, "Dapagliflozin or empagliflozin 10 mg daily: lowers HF admissions (EMPEROR-Preserved, DELIVER)", [egfr != null && egfr < 20 && `eGFR ${egfr}`]);
      add("MRA (spironolactone; finerenone where available)", mra, "Consider spironolactone 12.5-25 mg (TOPCAT) or finerenone (FINEARTS-HF) if K and kidney function allow", [k != null && k >= 5 && `K ${k}`]);
      add("ARNI", arni, "Consider sacubitril/valsartan if EF at the lower end of normal (PARAGON-HF)", []);
      out.push({ name: "And", on: null, dose: "Control BP and AF rate, treat sleep apnea, obesity (GLP-1 agonist: STEP-HFpEF), diuretic to the lowest dose that keeps the patient dry. Look for a specific cause (amyloid, HCM, valve)", caution: [] });
    } else out.push({ name: "Echo needed", on: null, dose: "Choose GDMT once the ejection fraction is known (or use the last echo). SGLT2 inhibitor helps at any EF", caution: [] });
    return out;
  }
  /* iron deficiency: ferritin ug/L, tsat % */
  function iron(ferritin, tsat) {
    if (ferritin == null) return { def: null, text: "Ferritin and transferrin saturation not found: check them (iron deficiency is common in HF)" };
    const def = ferritin < 100 || (ferritin <= 299 && tsat != null && tsat < 20);
    return { def, text: def ? `Iron deficient (ferritin ${ferritin}${tsat != null ? ", TSAT " + tsat + "%" : ""}): IV iron (ferric derisomaltose) before discharge improves symptoms and lowers HF readmission (AFFIRM-AHF, IRONMAN). Look for a GI cause.` : `Ferritin ${ferritin}${tsat != null ? ", TSAT " + tsat + "%" : ""}: not iron deficient by HF criteria (ferritin under 100, or 100-299 with TSAT under 20%)${tsat == null && ferritin <= 299 ? ". TSAT needed to be sure" : ""}` };
  }

  /* ---------- cardiac amyloidosis ---------- */
  const AMYLOID_FLAGS = [
    ["hfpefOld", "HFpEF (or mildly reduced EF) and age 65+"], ["lvh", "LV wall 12 mm or more without a cause (no severe hypertension or aortic stenosis)"],
    ["lowvolt", "Low or normal ECG voltage despite a thick LV wall (voltage-mass discordance), pseudo-infarct Q waves"],
    ["ctsBil", "Carpal tunnel syndrome (especially both hands, or surgery)"], ["spinal", "Lumbar spinal stenosis"], ["biceps", "Spontaneous biceps tendon rupture"],
    ["as", "Aortic stenosis in an older patient (often low-flow, low-gradient)"], ["intol", "Low BP or poor tolerance of beta-blocker / ACE inhibitor; hypertension that went away"],
    ["trop", "Troponin persistently raised without a coronary cause"], ["neuro", "Peripheral neuropathy or autonomic dysfunction (orthostatic hypotension, diarrhea, erectile dysfunction)"],
    ["conduction", "AV block, bundle branch block, pacemaker, or AF"], ["renal", "Proteinuria / nephrotic syndrome (AL)"], ["al", "Macroglossia, periorbital bruising (AL)"],
    ["strain", "Echo: apical sparing on strain, thick valves, biatrial enlargement, pericardial effusion"], ["mgus", "Known MGUS, myeloma or monoclonal protein"]];
  function amyloid(flags) {
    const on = AMYLOID_FLAGS.filter(([k]) => flags[k]);
    const level = on.length >= 3 ? "high" : on.length >= 1 ? "some" : "none";
    return { on, level, steps: [
      "1. Rule out AL (light-chain) amyloid FIRST - it is a hematology emergency: serum free light chains (kappa/lambda ratio; abnormal under 0.26 or over 1.65), serum AND urine protein electrophoresis with immunofixation",
      "2. If all normal: technetium-99m pyrophosphate (PYP) bone scan with SPECT (grade 2-3 uptake = ATTR without a biopsy)",
      "3. If any monoclonal protein: hematology; tissue biopsy (fat pad, bone marrow or endomyocardial) - PYP can be positive in AL too",
      "4. ATTR confirmed: TTR gene testing (hereditary vs wild-type); cardiology / amyloid clinic for tafamidis or acoramidis",
      "Cardiac MRI (LGE, high ECV) helps when the echo is unclear" ] };
  }

  /* ---------- causes (differential) ---------- */
  const DDX = [
    ["Ischemic heart disease", "Most common cause of HFrEF. Prior MI, risk factors, regional wall motion", "Troponin trend, ECG; coronary angiography or CT, or ischemia testing, once stable", "cad"],
    ["Hypertension", "LVH, HFpEF, older women", "BP history, echo LVH", "htn"],
    ["Valve disease", "Aortic stenosis, mitral regurgitation; murmur", "Echo; severe AS → TAVI assessment", "valve"],
    ["AF / tachycardia-induced cardiomyopathy", "Fast AF for weeks; EF improves with rate/rhythm control", "ECG, Holter; repeat echo after rate control", "af"],
    ["Cardiac amyloidosis (ATTR or AL)", "HFpEF with thick walls, older men, carpal tunnel, spinal stenosis, low voltage, intolerance of BB/ACEi", "Free light chains + SPEP/UPEP with immunofixation, then PYP scan (see red flags)", "amyloid"],
    ["Alcohol, cocaine, methamphetamine", "Dilated cardiomyopathy; can recover with abstinence", "History, GGT/MCV, urine drug screen", "alcohol"],
    ["Cancer therapy cardiotoxicity", "Anthracyclines (doxorubicin), trastuzumab, immune checkpoint inhibitors (myocarditis), radiation", "Treatment history; cardio-oncology", "chemo"],
    ["Myocarditis", "Recent viral illness, younger, chest pain, high troponin", "Cardiac MRI", ""],
    ["Hypertrophic cardiomyopathy", "Thick septum, family history, murmur that rises with Valsalva", "Echo, cardiac MRI, genetics", ""],
    ["Sarcoidosis, hemochromatosis", "Heart block, VT, young; high ferritin/TSAT with diabetes and liver disease", "Cardiac MRI, FDG-PET; iron studies", ""],
    ["Thyroid disease", "Thyrotoxicosis (high output, AF) or hypothyroidism", "TSH", "thyroid"],
    ["High-output failure", "Severe anemia, thyrotoxicosis, AV fistula (dialysis), Paget, thiamine deficiency (alcohol, malnutrition), liver disease", "Hb, TSH, fistula exam, thiamine", ""],
    ["Constrictive pericarditis / tamponade", "Raised JVP with Kussmaul sign, prior surgery/radiation/TB, small heart", "Echo (respirophasic variation), CT/MRI, cath", ""],
    ["Right heart failure from lung disease / PE / pulmonary hypertension", "COPD, sleep apnea, prior PE; clear lungs, big RV", "Echo (RV, RVSP), CTPA or V/Q, sleep study", "copd"],
    ["Peripartum, Takotsubo, Chagas", "Late pregnancy to 5 months after; emotional/physical stress; from Latin America", "History, echo, serology", ""],
    ["Drugs that worsen HF", "NSAIDs, diltiazem/verapamil in HFrEF, pioglitazone, dronedarone, some chemo, high-salt IV fluids", "Medication review (see Chart alerts)", "drugs"]];
  const MIMICS = ["Kidney failure / nephrotic syndrome (edema, low albumin, proteinuria)", "Cirrhosis (ascites, low albumin)", "Venous insufficiency, DVT, lymphedema", "Drug edema: amlodipine/nifedipine, pregabalin/gabapentin, steroids", "COPD or pneumonia (dyspnea)", "Hypoalbuminemia / malnutrition"];

  /* precipitants of THIS admission (FAILURE mnemonic, simplified) */
  const PRECIP = ["Missed medications or too much salt/fluid", "Ischemia / ACS", "Arrhythmia (AF, brady)", "Infection (pneumonia, UTI)", "Uncontrolled BP", "New drugs: NSAIDs, steroids, diltiazem, pioglitazone, IV fluids", "Anemia, thyroid, kidney function worse", "PE", "Alcohol"];

  /* investigations. c: map of latest values (objects with v or null) */
  function workup(c) {
    const L = [], add = (t, have, why) => L.push({ t, have, why });
    add("NT-proBNP on admission (and before discharge)", c.nt, "Diagnosis and the discharge fall (30% or more is reassuring)");
    add("ECG", null, "Ischemia, AF, LVH, low voltage (amyloid), QRS width (CRT if EF low and QRS 130+ ms)");
    add("Chest X-ray / lung POCUS", null, "Edema, effusions, other causes");
    add("Troponin", c.trop, "ACS as the trigger; persistently raised and flat suggests chronic injury (amyloid, CKD)");
    add("Electrolytes, creatinine/eGFR, urea", c.cr, "Daily while on IV diuretic");
    add("Magnesium", c.mg, "Keep 0.8 or more (more with thiazide)");
    add("Bicarbonate / CO2", c.hco3, "27+ suggests contraction alkalosis: acetazolamide helps");
    add("CBC", c.hb, "Anemia worsens HF");
    add("Ferritin and transferrin saturation", c.ferritin, "IV iron if deficient");
    add("TSH", c.tsh, "Thyroid cause");
    add("HbA1c, lipids", c.a1c, "Risk factors; SGLT2i / GLP-1 choice");
    add("Liver enzymes, albumin", c.alb, "Congestive hepatopathy; low albumin reduces diuretic effect");
    add("Urinalysis (protein)", null, "Nephrotic syndrome, AL amyloid");
    add("Spot urine sodium 2 h after the first IV dose", c.una, "Diuretic response (aim 50-70+ mmol/L)");
    add("Echocardiogram (if none in 12 months or a change)", null, "EF decides GDMT; valves, RV, wall thickness, strain");
    add("Ischemia workup (angiography, CT or stress test) once stable", null, "New HFrEF, or HFpEF with angina");
    return L;
  }

  /* discharge and follow-up */
  const FOLLOWUP = [
    "Family doctor or HF clinic within 7 days of discharge (a visit or phone call); first-week visits lower readmissions",
    "Bloodwork (electrolytes, creatinine) 1 week after discharge and 1-2 weeks after each change to ARNI/ACEi/ARB, MRA or diuretic",
    "Referral to the heart failure clinic (Island Health HF clinic) - especially first admission, EF 40% or less, or 2+ admissions in a year",
    "GDMT titration every 1-2 weeks to target or highest tolerated dose (STRONG-HF: fast titration with close follow-up is safe)",
    "Repeat echo about 3 months after GDMT is at target if EF was 35% or less: ICD / CRT decision",
    "Discharge weight written on the discharge summary and the handout (the new dry weight)",
    "Clear diuretic plan, including whether a flexible extra dose is allowed for weight gain",
    "Medication reconciliation: home beta-blocker, NSAIDs removed, potassium supplements adjusted",
    "Vaccines: influenza, COVID-19, pneumococcal; RSV if eligible",
    "Cardiac rehab referral; home care / telemonitoring if available",
    "Goals of care and palliative care input for advanced HF (repeated admissions, low BP, kidney limits)"];

  const api = { NT_BANDS, ntBand, ntInterp, bnpInterp, ntChange, furoPOeq, startDose, response, ladder, daysTo, creatinine, switchPO, readyForPO, gdmt, iron, AMYLOID_FLAGS, amyloid, DDX, MIMICS, PRECIP, workup, FOLLOWUP, r1 };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else window.CHFRules = api;
})();
