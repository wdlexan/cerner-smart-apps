/*
 * dm-criteria.js — rules for the Inpatient Diabetes app. Edit here; no other file needs to change. SI units.
 *
 * Sources
 *   DC16   Diabetes Canada CPG ch.16 In-hospital management: preprandial 5.0–8.0, random <10.0; basal-bolus + correction,
 *          not correction alone; insulin-naive start 0.4–0.5 units/kg/day, 40–50% basal; type 1 must never be without insulin;
 *          hypoglycemia ≤3.9 → change therapy; steroids: monitor 48 h, basal-bolus better than correction only;
 *          IV→SC: give subcutaneous insulin 1–2 h before stopping the IV infusion.
 *   IH     Island Health hypoglycemia protocol: 2.8–3.9 → 15 g; <2.8 conscious → 20 g; recheck 15 min until >4.0;
 *          unable to swallow → D50W 25 g (50 mL) IV or glucagon 1 mg; then meal or snack; tell physician if severe or 3+.
 *   DC13   Diabetes Canada ch.13 (2024 user guide): metformin first line; SGLT2i/GLP-1 RA for ASCVD, HF (SGLT2i preferred), CKD
 *          regardless of A1C; SU/insulin cause lows; hold SU when not eating; hold metformin and SGLT2i if dehydrated or AKI risk.
 *   BCPC   BC PharmaCare SGLT2i: start if eGFR ≥30 (cana), ≥25 (dapa), ≥20 (empa); may continue below for kidney/heart benefit.
 *   DCVP   Diabetes Canada vascular protection: statin if CVD, age >40, age >30 with diabetes >15 y, or microvascular disease;
 *          ACEi/ARB if CVD, age >55 with a risk factor, or end-organ damage (albuminuria, retinopathy, LVH);
 *          ASA 81–162 mg if established CVD, NOT routinely for primary prevention; A1C ≤7.0, BP <130/80, LDL <2.0 or >50% lower.
 *   UMP    Discharge by admission A1C (Umpierrez, Diabetes Care 2014): <7% home regimen; 7–9% home orals + basal 50% of the
 *          hospital dose; >9% orals + basal 80%, or basal-bolus 80%.
 *   Local  Choices made for this app. Check against the Island Health subcutaneous insulin order set.
 */
(function (root) {
  'use strict';

  const TARGETS = { preMealLow: 5.0, preMealHigh: 8.0, randomHigh: 10.0, hypo: 4.0, severeHypo: 2.8, veryHigh: 15.0 };

  const HYPO_TREATMENT = [
    'BG 2.8–3.9 and able to swallow: 15 g fast carbohydrate (3 glucose tablets).',
    'BG below 2.8 and able to swallow: 20 g (4 tablets or 1 tube of gel).',
    'Unable to swallow: D50W 25 g (50 mL) IV over 1–3 min, or glucagon 1 mg SC/IM if no IV.',
    'Recheck in 15 min and repeat until above 4.0, then give a meal or snack.',
    'Nursing to tell the physician if severe, or after 3 or more lows this admission.'
  ];

  // Time-of-day slots for bedside glucose (24 h clock, start inclusive). Which insulin each slot reflects.
  const SLOTS = [
    { key: 'overnight', label: 'Overnight', from: 0, to: 5, reflects: 'basal' },
    { key: 'fasting', label: 'Fasting / pre-breakfast', from: 5, to: 10, reflects: 'basal' },
    { key: 'preLunch', label: 'Pre-lunch', from: 10, to: 14, reflects: 'breakfast' },
    { key: 'preSupper', label: 'Pre-supper', from: 14, to: 19, reflects: 'lunch' },
    { key: 'bedtime', label: 'Bedtime', from: 19, to: 24, reflects: 'supper' }
  ];

  const INSULIN = {
    basal: /\b(?:glargine|lantus|basaglar|toujeo|semglee|detemir|levemir|degludec|tresiba|NPH|humulin N|novolin ge NPH|isophane)\b/i,
    nph: /\b(?:NPH|humulin N|isophane|novolin ge NPH)\b/i,
    rapid: /\b(?:aspart|novorapid|fiasp|trurapi|lispro|humalog|admelog|glulisine|apidra|regular|humulin R|toronto|entuzity)\b/i,
    premix: /\b(?:30\/70|70\/30|mix ?25|mix ?50|novomix|humalog mix|premix)\b/i,
    correction: /\bcorrection\b|\bsliding scale\b|\bscale\b|\bper protocol\b|\bsupplement\w*\b|\bprn\b/i,
    meal: /\bbreakfast\b|\blunch\b|\bsupper\b|\bdinner\b|\bwith meals?\b|\bmeal\b|\bac\b|\btid ?ac\b/i,
    iv: /\binfusion\b|\bdrip\b|\bIV insulin\b|\bunits?\/h(?:ou)?r\b/i
  };

  const DOSING = {
    startPerKg: 0.4, startPerKgLow: 0.2, startPerKgHigh: 0.5,
    basalFraction: 0.5,
    lowDoseIf: 'age 70 or older, eGFR under 30, weight under 50 kg, or poor intake',
    adjustUpPct: 10, adjustDownPct: 20, adjustDownMildPct: 10,
    highDaysNeeded: 2,          // fasting/pre-meal above target on this many of the last 3 days before increasing
    correctionShare: 0.5,       // fold about half of yesterday's correction units into scheduled doses
    correctionUnitsTrigger: 6,  // correction units in 24 h that suggest scheduled doses are too low
    npoBasalPct: { type1: 80, type2: 60 },  // keep this % of basal when NPO (Local; type 1 never zero)
    steroidNphPer10mgPred: 0.1, steroidNphMaxPerKg: 0.4,   // Local: morning NPH 0.1 u/kg per 10 mg prednisone-equivalent
    steroidEquivalents: { prednisone: 1, prednisolone: 1, methylprednisolone: 1.25, dexamethasone: 6.67, hydrocortisone: 0.25 }
  };

  // Discharge by admission A1C (UMP), type 2 only. Type 1 continues basal-bolus.
  const DISCHARGE_T2 = [
    { maxA1c: 7.0, text: 'A1C below 7%: discharge on the home regimen (adjust for kidney function, lows and new conditions).' },
    { maxA1c: 9.0, text: 'A1C 7–9%: home oral agents + basal insulin at about 50% of the hospital basal dose, or intensify orals.' },
    { maxA1c: 99, text: 'A1C above 9%: home oral agents + basal insulin at about 80% of the hospital basal dose, or basal-bolus at about 80%.' }
  ];

  // Oral / non-insulin options. eGFR rules (mL/min/1.73m²) and fit by patient features.
  // status: 'avoid' | 'caution' | 'ok'; each check returns null or a reason.
  const AGENTS = [
    { key: 'metformin', name: 'Metformin', match: /\bmetformin\b|\bglucophage\b|\bjanumet\b|\bsynjardy\b|\bxigduo\b|\bjentadueto\b/i,
      benefit: 'First line. Cheap, no lows, weight neutral.', risk: 'GI upset; hold if AKI, dehydration, IV contrast or sepsis.',
      egfr: [[30, 'avoid', 'eGFR under 30'], [45, 'caution', 'eGFR 30–44: max 1,000 mg/day, don’t start new']], hypo: false, cost: '$' },
    { key: 'sglt2', name: 'SGLT2 inhibitor (empagliflozin, dapagliflozin, canagliflozin)', match: /\bempagliflozin\b|\bjardiance\b|\bdapagliflozin\b|\bforxiga\b|\bcanagliflozin\b|\binvokana\b|\bertugliflozin\b|\bsteglatro\b|\bsynjardy\b|\bxigduo\b/i,
      benefit: 'Heart failure and kidney protection; CV benefit (empagliflozin, canagliflozin). Preferred in HF.', risk: 'Genital infections, euglycemic DKA (hold when NPO, acutely ill, or 3 days before surgery), volume depletion.',
      egfr: [[20, 'avoid', 'eGFR under 20: don’t start (empagliflozin ≥20, dapagliflozin ≥25, canagliflozin ≥30)'], [45, 'caution', 'Less glucose lowering below 45; still kidney/heart benefit']], hypo: false, cost: '$$', cardiorenal: true },
    { key: 'glp1', name: 'GLP-1 RA (semaglutide, dulaglutide, liraglutide)', match: /\bsemaglutide\b|\bozempic\b|\brybelsus\b|\bdulaglutide\b|\btrulicity\b|\bliraglutide\b|\bvictoza\b|\bexenatide\b|\blixisenatide\b|\btirzepatide\b|\bmounjaro\b/i,
      benefit: 'CV benefit (semaglutide SC, dulaglutide, liraglutide); weight loss; no lows on its own. Tirzepatide: more A1C/weight lowering, no CV data yet.', risk: 'Nausea; avoid with medullary thyroid cancer or MEN2 history; aspiration risk around anesthesia; pancreatitis history.',
      egfr: [[15, 'caution', 'Limited data with eGFR under 15']], hypo: false, cost: '$$$', cardiorenal: true },
    { key: 'dpp4', name: 'DPP-4 inhibitor (sitagliptin, linagliptin)', match: /\bsitagliptin\b|\bjanuvia\b|\bjanumet\b|\blinagliptin\b|\btrajenta\b|\bjentadueto\b|\bsaxagliptin\b|\bonglyza\b|\balogliptin\b|\bnesina\b/i,
      benefit: 'Well tolerated, no lows, weight neutral. Linagliptin needs no kidney dose change.', risk: 'Modest A1C effect; don’t combine with GLP-1 RA; saxagliptin/alogliptin caution in HF.',
      egfr: [[30, 'caution', 'Sitagliptin 25 mg if eGFR under 30 (50 mg if 30–44); linagliptin no change'], [45, 'caution', 'Sitagliptin 50 mg if eGFR 30–44']], hypo: false, cost: '$$' },
    { key: 'su', name: 'Sulfonylurea (gliclazide preferred)', match: /\bgliclazide\b|\bdiamicron\b|\bglyburide\b|\bglibenclamide\b|\bglimepiride\b|\bamaryl\b|\bglipizide\b/i,
      benefit: 'Strong A1C lowering, cheap.', risk: 'Lows and weight gain. Hold when not eating. Avoid glyburide in older adults and CKD.',
      egfr: [[30, 'caution', 'High risk of lows with eGFR under 30; gliclazide only, low dose'], [60, 'caution', 'Avoid glyburide if eGFR under 60']], hypo: true, cost: '$' },
    { key: 'tzd', name: 'Pioglitazone', match: /\bpioglitazone\b|\bactos\b|\brosiglitazone\b/i,
      benefit: 'No lows, durable; may help fatty liver.', risk: 'Fluid retention and heart failure, weight gain, fractures; not with bladder cancer history.',
      egfr: [], hypo: false, cost: '$' },
    { key: 'meglitinide', name: 'Repaglinide', match: /\brepaglinide\b|\bgluconorm\b/i,
      benefit: 'Short acting, taken with meals; usable in CKD.', risk: 'Lows (less than SU); dosing with each meal.', egfr: [], hypo: true, cost: '$' },
    { key: 'insulin', name: 'Insulin', match: /\binsulin\b|\bglargine\b|\bdetemir\b|\bdegludec\b|\bNPH\b|\baspart\b|\blispro\b/i,
      benefit: 'Most effective; no dose ceiling. Needed if symptomatic, losing weight, or very high A1C.', risk: 'Lows, weight gain; needs teaching, meter and supplies.', egfr: [], hypo: true, cost: '$–$$' }
  ];

  // Vascular protection and risk factor checks.
  const VASCULAR = {
    statinAge: 40, statinYoungAge: 30, statinYoungDurationY: 15,
    aceAge: 55,
    asaDose: '81–162 mg',
    a1cTarget: 7.0, a1cTargetFrail: 8.5,
    ldlTarget: 2.0, bpTarget: [130, 80],
    acrHigh: 2.0,   // mg/mmol: albuminuria
    text: {
      statin: 'Statin if CVD, age over 40, age over 30 with diabetes for more than 15 years, or microvascular disease (DCVP).',
      ace: 'ACE inhibitor or ARB if CVD, age over 55 with another risk factor, or end-organ damage: albuminuria, retinopathy, LVH (DCVP).',
      asa: 'ASA 81–162 mg if established CVD. Not routinely for primary prevention (DCVP).',
      cardiorenal: 'Type 2 with ASCVD, HF or CKD: SGLT2 inhibitor or GLP-1 RA with proven benefit, regardless of A1C (SGLT2i preferred in HF) (DC13).'
    }
  };

  const CONDITIONS = {
    type1: /\btype 1\b|\bT1DM?\b|\bIDDM\b|\binsulin[- ]dependent diabetes\b|\bLADA\b|\bjuvenile diabetes\b/i,
    type2: /\btype 2\b|\bT2DM?\b|\bNIDDM\b|\bnon[- ]insulin[- ]dependent\b/i,
    diabetes: /\bdiabet\w*|\bDM\b|\bT[12]DM\b/i,
    cvd: /\bmyocardial infarction\b|\bMI\b|\bNSTEMI\b|\bSTEMI\b|\bcoronary (?:artery )?disease\b|\bCAD\b|\bangina\b|\bPCI\b|\bCABG\b|\bstroke\b|\bCVA\b|\bTIA\b|\bperipheral (?:arterial|vascular) disease\b|\bPAD\b|\bPVD\b|\bcarotid stenosis\b|\bASCVD\b|\bischemic heart\b/i,
    hf: /\bheart failure\b|\bCHF\b|\bHFrEF\b|\bHFpEF\b|\bcardiomyopathy\b/i,
    ckd: /\bchronic kidney disease\b|\bCKD\b|\bdiabetic nephropathy\b|\bESRD\b|\bESKD\b|\bdialysis\b/i,
    retinopathy: /\bretinopathy\b/i, neuropathy: /\bneuropathy\b/i, nephropathy: /\bnephropathy\b|\balbuminuria\b|\bproteinuria\b/i,
    lvh: /\bLVH\b|\bleft ventricular hypertrophy\b/i,
    htn: /\bhypertension\b|\bHTN\b/i, dyslipidemia: /\bdyslipid\w*|\bhyperlipid\w*|\bhypercholesterol\w*/i,
    smoker: /\bsmok\w*|\btobacco\b/i,
    gastroparesis: /\bgastroparesis\b/i, pancreatitis: /\bpancreatitis\b/i, mtc: /\bmedullary thyroid\b|\bMEN ?2\b/i,
    bladderCa: /\bbladder cancer\b/i, cirrhosis: /\bcirrhosis\b/i, dementia: /\bdementia\b/i,
    pump: /\binsulin pump\b|\bCSII\b|\bomnipod\b|\btandem\b|\bmedtronic 7\d\d\b/i, cgm: /\bCGM\b|\bcontinuous glucose\b|\blibre\b|\bdexcom\b/i
  };

  const DRUGS = {
    statin: /\b(?:atorva|rosuva|simva|prava|lova|fluva|pitava)statin\b|\blipitor\b|\bcrestor\b/i,
    lipidOther: /\bezetimibe\b|\bevolocumab\b|\balirocumab\b|\binclisiran\b/i,
    aceArb: /\b\w+pril\b|\b\w+sartan\b|\bentresto\b|\bsacubitril\b/i,
    asa: /\bacetylsalicylic\b|\baspirin\b|\bASA\b/i,
    anticoag: /\bapixaban\b|\brivaroxaban\b|\bdabigatran\b|\bedoxaban\b|\bwarfarin\b/i,
    p2y12: /\bclopidogrel\b|\bticagrelor\b|\bprasugrel\b/i,
    steroid: /\bprednisone\b|\bprednisolone\b|\bmethylprednisolone\b|\bsolu-?medrol\b|\bdexamethasone\b|\bhydrocortisone\b/i,
    betaBlocker: /\b\w+olol\b/i
  };

  const TEXT = {
    npo: /\bNPO\b|\bnil by mouth\b|\bnothing by mouth\b|\bnil per os\b/i,
    poorIntake: /\bpoor (?:oral )?intake\b|\bnot eating\b|\bate (?:very )?little\b|\b(?:0|10|20|25|30)% of (?:(?:the|her|his) )?(?:meals?|tray|breakfast|lunch|supper|dinner)\b|\bnausea\b|\bvomit\w*/i,
    tubeFeed: /\btube feed\w*|\benteral (?:feed|nutrition)\w*|\bTPN\b|\bparenteral nutrition\b|\bNG feeds?\b/i,
    hypoSymptoms: /\bdiaphore\w*|\bsweaty\b|\bshaky\b|\bconfus\w*|\bhypoglyc\w*/i,
    dka: /\bDKA\b|\bketoacidosis\b|\bHHS\b|\bhyperosmolar\b/i,
    education: /\bdiabetes educat\w*|\binsulin teaching\b|\bDEC\b|\bdiabetes education cent(?:re|er)\b/i
  };

  const api = { TARGETS, HYPO_TREATMENT, SLOTS, INSULIN, DOSING, DISCHARGE_T2, AGENTS, VASCULAR, CONDITIONS, DRUGS, TEXT };
  root.DMCriteria = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof self !== 'undefined' ? self : this);
