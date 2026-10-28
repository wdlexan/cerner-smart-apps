/*
 * edr-criteria.js — the thresholds and questions used by the Eating Disorder ED Review app.
 * ADULTS (18+) only. Edit numbers here; no other file needs to change.
 *
 * Sources
 *   MEED  = Royal College of Psychiatrists, Medical Emergencies in Eating Disorders (CR233, 2022),
 *           adult risk table (red = high risk, amber = alert).
 *   APA   = American Psychiatric Association Practice Guideline for Eating Disorders (2023),
 *           adult indications for hospitalization / level-of-care table.
 *   NICE  = NICE CG32 refeeding-risk criteria (used by MEED).
 *   Local = a choice made for this app where the guidelines give no number. Change freely.
 * Rule: a value is RED if it meets EITHER the MEED red criterion OR an APA adult hospitalization
 * criterion (the more cautious of the two). AMBER uses the MEED amber band.
 *
 * Measure rules: checked in order, first match wins.
 *   op  '<'  '<='  '>'  '>='
 *   value  a number, or { female: n, male: n } for sex-specific limits
 * All values in SI units (mmol/L, g/L, °C, kg).
 */
(function (root) {
  'use strict';

  const MEASURES = [
    { key: 'hr', label: 'Heart rate (awake)', unit: 'bpm', worst: 'min', rules: [
      { level: 'red', op: '<', value: 40, source: 'MEED red; APA adult' },
      { level: 'amber', op: '<=', value: 50, source: 'MEED amber (40–50)' } ] },
    { key: 'sbp', label: 'Systolic BP', unit: 'mmHg', worst: 'min', rules: [
      { level: 'red', op: '<', value: 90, source: 'APA adult (<90/60); MEED standing BP <90' } ] },
    { key: 'dbp', label: 'Diastolic BP', unit: 'mmHg', worst: 'min', rules: [
      { level: 'red', op: '<', value: 60, source: 'APA adult (<90/60)' } ] },
    { key: 'temp', label: 'Temperature', unit: '°C', worst: 'min', decimals: 1, rules: [
      { level: 'red', op: '<', value: 36.1, source: 'APA adult (<97.0 °F); MEED red <35.5' },
      { level: 'amber', op: '<', value: 36.3, source: 'Local: close to the APA limit' } ] },
    { key: 'bmi', label: 'BMI', unit: 'kg/m²', worst: 'min', decimals: 1, rules: [
      { level: 'red', op: '<', value: 13, source: 'MEED red' },
      { level: 'amber', op: '<', value: 15, source: 'MEED amber (13–14.9)' } ] },
    { key: 'k', label: 'Potassium', unit: 'mmol/L', worst: 'min', decimals: 1, rules: [
      { level: 'red', op: '<', value: 3.0, source: 'APA adult (<3.0); MEED red <2.5' },
      { level: 'amber', op: '<', value: 3.5, source: 'Local: below normal' } ] },
    { key: 'po4', label: 'Phosphate', unit: 'mmol/L', worst: 'min', decimals: 2, rules: [
      { level: 'red', op: '<', value: 0.80, source: 'MEED red (hypophosphataemia)' } ] },
    { key: 'mg', label: 'Magnesium', unit: 'mmol/L', worst: 'min', decimals: 2, rules: [
      { level: 'red', op: '<', value: 0.50, source: 'Local: severe' },
      { level: 'amber', op: '<', value: 0.70, source: 'Local: below normal (refeeding risk)' } ] },
    { key: 'na', label: 'Sodium', unit: 'mmol/L', worst: 'min', rules: [
      { level: 'red', op: '<', value: 130, source: 'MEED red (hyponatraemia); number is local' },
      { level: 'amber', op: '<', value: 135, source: 'Local: below normal' } ] },
    { key: 'ca', label: 'Calcium (total)', unit: 'mmol/L', worst: 'min', decimals: 2, rules: [
      { level: 'red', op: '<', value: 2.10, source: 'MEED red (hypocalcaemia); number is local' } ] },
    { key: 'glucose', label: 'Glucose', unit: 'mmol/L', worst: 'min', decimals: 1, rules: [
      { level: 'red', op: '<', value: 3.3, source: 'APA adult (<60 mg/dL); MEED red <3' },
      { level: 'amber', op: '<', value: 4.0, source: 'Local' } ] },
    { key: 'albumin', label: 'Albumin', unit: 'g/L', worst: 'min', rules: [
      { level: 'red', op: '<', value: 30, source: 'MEED red (hypoalbuminaemia); number is local' },
      { level: 'amber', op: '<', value: 35, source: 'Local: below normal' } ] },
    { key: 'alt', label: 'ALT', unit: 'U/L', worst: 'max', rules: [
      { level: 'red', op: '>', value: 120, source: 'MEED red (>3× upper limit, ULN 40)' } ] },
    { key: 'ast', label: 'AST', unit: 'U/L', worst: 'max', rules: [
      { level: 'red', op: '>', value: 120, source: 'MEED red (>3× upper limit, ULN 40)' } ] },
    { key: 'wbc', label: 'WBC', unit: '×10⁹/L', worst: 'min', decimals: 1, rules: [
      { level: 'red', op: '<', value: 3.0, source: 'MEED red (low white count); number is local' },
      { level: 'amber', op: '<', value: 4.0, source: 'Local: below normal' } ] },
    { key: 'neut', label: 'Neutrophils', unit: '×10⁹/L', worst: 'min', decimals: 1, rules: [
      { level: 'red', op: '<', value: 1.0, source: 'MEED red (low white count); number is local' },
      { level: 'amber', op: '<', value: 1.5, source: 'Local' } ] },
    { key: 'hgb', label: 'Hemoglobin', unit: 'g/L', worst: 'min', rules: [
      { level: 'red', op: '<', value: 100, source: 'MEED red' } ] },
    { key: 'qtc', label: 'QTc', unit: 'ms', worst: 'max', rules: [
      { level: 'red', op: '>', value: { female: 470, male: 450 }, source: 'Prolonged QTc (APA-based algorithms)' },
      { level: 'amber', op: '>', value: { female: 450, male: 430 }, source: 'MEED amber' } ] },
    { key: 'a1c', label: 'HbA1c (if diabetic)', unit: '%', worst: 'max', decimals: 1, onlyIf: 'diabetes', rules: [
      { level: 'red', op: '>', value: 10, source: 'MEED red (diabetes, HbA1c >10%)' } ] }
  ];

  // Bedside questions. Most of these are not stored as coded data, so the clinician answers them.
  // 'required' items must be answered before the app will call the patient "no flags found".
  // noteHint: words searched for in today's notes; a hit is shown under the question as a prompt.
  const QUESTIONS = [
    { key: 'suicide', label: 'Self-harm and suicide risk', required: true,
      options: [['', 'Not assessed'], ['none', 'No current ideation or self-harm'],
        ['low', 'Ideation, low risk / cutting or similar'], ['high', 'Moderate–high risk ideation, or self-poisoning']],
      flags: { low: 'amber', high: 'red' }, source: 'MEED',
      noteHint: /\bsuicid\w*|\bSI\b|\bself[- ]?harm\w*|\boverdose\w*|\bOD\b|\bingest(?:ed|ion)\b|\bcutting\b|\bwish(?:es|ed)? to die\b/i },
    { key: 'intake', label: 'Food intake', required: true,
      options: [['', 'Not assessed'], ['ok', 'Eating some meals'],
        ['refusal', 'Acute food refusal, or under 500 kcal/day for 2+ days']],
      flags: { refusal: 'red' }, source: 'MEED red; APA acute food refusal',
      noteHint: /\bfood refusal\b|\brefus\w* (?:to eat|food|meals?)\b|\bnot eating\b|\bnil by mouth\b|\bno (?:oral )?intake\b/i },
    { key: 'hydration', label: 'Fluids and hydration', required: true,
      options: [['', 'Not assessed'], ['ok', 'Drinking; mild dehydration at most'],
        ['moderate', 'Severe fluid restriction or moderate dehydration (5–10%)'], ['severe', 'Fluid refusal or severe dehydration (≥10%)']],
      flags: { moderate: 'amber', severe: 'red' }, source: 'MEED',
      noteHint: /\bdehydrat\w*|\bfluid refusal\b|\brefus\w* (?:fluids?|to drink)\b/i },
    { key: 'syncope', label: 'Syncope', required: false,
      options: [['', 'Not assessed'], ['none', 'None'], ['occasional', 'Occasional'], ['recurrent', 'Recurrent']],
      flags: { occasional: 'amber', recurrent: 'red' }, source: 'MEED',
      noteHint: /\bsyncop\w*|\bfaint\w*|\bcollaps\w*|\bpassed out\b|\bLOC\b|\bloss of consciousness\b/i },
    { key: 'posturalSymptoms', label: 'Symptoms on standing (dizziness, presyncope)', required: false,
      options: [['', 'Not assessed'], ['no', 'No'], ['yes', 'Yes']],
      flags: {}, source: 'Island Health transfer criteria',
      noteHint: /\bdizz\w*|\blight-?headed\w*|\bpresyncop\w*|\bnear[- ]syncop\w*/i },
    { key: 'ecgOther', label: 'Other ECG abnormality (arrhythmia, heart block, etc.)', required: false,
      options: [['', 'Not assessed'], ['no', 'No'], ['yes', 'Yes']],
      flags: { yes: 'red' }, source: 'MEED red; APA arrhythmia',
      noteHint: /\barrhythmi\w*|\bheart block\b|\bjunctional\b|\bventricular (?:ectopy|tachycardia)\b|\bVT\b|\btorsade\w*|\bprolonged QT\w*/i },
    { key: 'suss', label: 'SUSS test (sit up / squat-stand, worst part)', required: false,
      options: [['', 'Not done'], ['3', '3 — no difficulty'], ['2', '2 — some difficulty'], ['1', '0–1 — unable or uses hands/upper body']],
      flags: { '2': 'amber', '1': 'red' }, source: 'MEED' },
    { key: 'purging', label: 'Purging (vomiting / laxatives)', required: false,
      options: [['', 'Not assessed'], ['none', 'None or occasional'], ['weekly', '3 or more times a week'], ['daily', 'Multiple times a day']],
      flags: { weekly: 'amber', daily: 'red' }, source: 'MEED',
      noteHint: /\bvomit\w*|\bpurg\w*|\blaxative\w*|\bself[- ]induced\b|\bemesis\b/i },
    { key: 'exercise', label: 'Uncontrolled exercise (with malnutrition)', required: false,
      options: [['', 'Not assessed'], ['under1', 'Under 1 hour a day'], ['1to2', '1–2 hours a day'], ['over2', 'More than 2 hours a day']],
      flags: { '1to2': 'amber', over2: 'red' }, source: 'MEED' },
    { key: 'engagement', label: 'Engagement with the care plan', required: false,
      options: [['', 'Not assessed'], ['some', 'Some insight and motivation'], ['poor', 'Poor insight / resisting weight gain / plan can’t be followed'],
        ['struggle', 'Physical struggles with staff or carers over food, or harm to self']],
      flags: { poor: 'amber', struggle: 'red' }, source: 'MEED' },
    { key: 'otherAcute', label: 'Other acute medical problem', required: false,
      options: [['', 'Not assessed'], ['none', 'None'], ['non', 'Non-life-threatening (e.g. hematemesis, pressure sores)'],
        ['life', 'Life-threatening (e.g. acute confusion, DKA, seizure)']],
      flags: { non: 'amber', life: 'red' }, source: 'MEED',
      noteHint: /\bconfus\w*|\bdelirium\b|\bseizure\w*|\bDKA\b|\bketoacidosis\b|\bhematemesis\b|\bchest pain\b|\bpressure (?:sore|injur)\w*/i }
  ];

  // Lying-to-standing (orthostatic) change. Entered at the bedside.
  const ORTHOSTATIC = {
    redSbpDrop: 20, redHrRise: 30,      // MEED red: drop >20 mmHg or HR rise >30
    amberSbpDrop: 15, amberHrRise: 20,  // MEED amber: drop >15 mmHg or rise up to 30 (20 is local)
    standingSbpRed: 90,                 // MEED: standing BP <90
    source: 'MEED'
  };

  // Weight change (needs two weights 10–21 days apart, or entered at the bedside).
  const WEIGHT_LOSS = { redKgPerWeek: 1.0, amberKgPerWeek: 0.5, source: 'MEED' };

  // NICE CG32 refeeding risk.
  const REFEEDING = {
    high1: { bmi: 16, lossPct: 15, intakeDays: 10 },          // any ONE of these
    high2: { bmi: 18.5, lossPct: 10, intakeDays: 5 },         // any TWO of these (plus alcohol/drugs below)
    drugs: ['insulin', 'furosemide', 'hydrochlorothiazide', 'chlorthalidone', 'indapamide', 'spironolactone', 'bumetanide',
      'metolazone', 'calcium carbonate', 'aluminum hydroxide', 'magnesium hydroxide', 'antacid'],
    alcohol: /alcohol (?:use|misuse|abuse|dependence)|alcoholism|\bAUD\b|substance use/i,
    source: 'NICE CG32'
  };

  // Care plan. PLACEHOLDER until you know where it lives in PowerChart.
  // docTypes: exact document type names to treat as the care plan (fill in once known).
  // keywords: words in a note's title or text that suggest it is the care plan.
  const CARE_PLAN = {
    docTypes: [],
    keywords: /\bcare plan\b|\bcrisis plan\b|\bfrequent (?:presenter|visitor|ED user)\b|\bED management plan\b|\bemergency (?:department )?plan\b|\bindividual(?:ized)? care plan\b/i,
    configured: false
  };

  // Words looked for across all past notes, shown in the past-visits summary.
  const HISTORY_TERMS = [
    ['Refeeding syndrome', /\brefeeding syndrome\b/i],
    ['Low phosphate needing replacement', /\bhypophosphat\w*|\bphosphate replacement\b|\bIV phosphate\b/i],
    ['Low potassium needing replacement', /\bhypokal\w*|\bIV potassium\b|\bKCl (?:IV|infusion)\b/i],
    ['ICU / step-down stay', /\bICU\b|\bintensive care\b|\bstep[- ]?down\b|\bHDU\b/i],
    ['Arrhythmia or prolonged QTc', /\barrhythmi\w*|\bprolonged QT\w*|\btorsade\w*/i],
    ['Seizure', /\bseizure\w*/i],
    ['Overdose or self-harm', /\boverdose\w*|\bself[- ]?harm\w*|\bingestion\b|\bsuicide attempt\b/i],
    ['Involuntary (Mental Health Act) admission', /\bMental Health Act\b|\bcertified\b|\bform 4\b|\binvoluntar\w*/i],
    ['Left before assessment / against advice', /\bAMA\b|\bagainst medical advice\b|\bleft without being seen\b|\bLWBS\b|\beloped\b/i]
  ];
  const SERVICES = [
    ['Eating disorder program', /\beating disorder (?:program|clinic|service|team)\b|\bEDP\b|\bLooking Glass\b/i],
    ['Psychiatry', /\bpsychiatr\w*/i],
    ['Dietitian', /\bdietitian\b|\bdietician\b|\bnutrition(?:ist| consult)\b/i],
    ['Mental health / case manager', /\bmental health (?:team|worker|clinician|and substance use)\b|\bcase manager\b|\bMHSU\b/i],
    ['Family doctor / GP', /\bfamily (?:doctor|physician)\b|\bGP\b|\bprimary care\b/i]
  ];

  // ------------------------------------------------------------------
  // Island Health service routing (VGH / RJH pathway for supervised feeding admissions)
  // ------------------------------------------------------------------
  // Admission: Internal Medicine is MRP. Transfer to the hospitalist service (House) may be considered
  // once refeeding risk is over and NONE of the criteria below have been present in the last 7 days
  // (to be mutually agreed by House and IM; usually 7–10 days after admission).
  const ROUTING = {
    defaultSite: 'VGH',
    windowDays: 7,
    usualTransferDays: '7–10',
    sites: {
      VGH: { im: 'General Internal Medicine (GIM)', admit: 'Admit to GIM as MRP. GIM involves the dietitian and Psychiatry Liaison as appropriate.' },
      RJH: { im: 'Internal Medicine CTU', admit: 'Admit to CTU, with Psychiatry (Dr Blashko) and the specialized dietitian (Crystal Frost) consulting. There is no dedicated eating disorder unit at RJH.' }
    },
    higherCare: 'If an ED patient needs transfer to RJH for a higher level of care, IM is MRP pending transfer.',
    afterTransfer: 'After transfer, the hospitalist can request ongoing GIM consultant support, with ongoing Psychiatry and dietitian support.',
    advice: '24-hour on-call IM eating disorder specialist at St. Paul’s Hospital for specific eating disorder questions.',
    // Lab and vital criteria (SI; mEq/L = mmol/L for K and HCO3). Any value in the window = criterion present.
    labs: [
      { key: 'k', op: '<', value: 2.7, label: 'K⁺ < 2.7 mmol/L' },
      { key: 'hco3', op: '>', value: 35, label: 'Severe metabolic alkalosis (HCO₃ > 35)' },
      { key: 'na', op: '<', value: 125, label: 'Na⁺ < 125 mmol/L' },
      { key: 'po4', op: '<', value: 0.4, label: 'PO₄ < 0.4 mmol/L' },
      { key: 'glucose', op: '<', value: 4.0, label: 'Hypoglycemia < 4.0 mmol/L',
        caveat: 'Brief low glucose after meals is common during refeeding and usually settles; confirm whether this was postprandial.' },
      { key: 'temp', op: '<', value: 35, label: 'Hypothermia < 35 °C' },
      { key: 'qtc', op: '>', value: 450, label: 'QTc > 450 ms' }
    ],
    bradycardia: { below: 40, label: 'Bradycardia < 40 bpm with symptoms or another metabolic disturbance' },
    postural: { hrRise: 40, sbpDrop: 20, label: 'Postural hypotension with symptoms (HR rise > 40 or SBP drop > 20)',
      note: 'A postural HR change without symptoms is not a criterion. Vitals don’t have to be normal; bradycardia and postural changes are common in this group.' },
    // Notes in the window are searched for these; a hit means "check", since notes can be historical.
    syncope: /\bsyncop\w*|\bfaint(?:ed|ing)\b|\bcollaps(?:e|ed)\b|\bpassed out\b|\bloss of consciousness\b/i,
    dysrhythmia: /\bdysrhythmi\w*|\barrhythmi\w*|\bheart block\b|\bjunctional rhythm\b|\bventricular tachycardia\b|\bnon-?sustained VT\b|\bNSVT\b|\btorsade\w*|\bpauses?\b(?= on tele)/i,
    symptoms: /\bdizz\w*|\blight-?headed\w*|\bpresyncop\w*|\bnear[- ]syncop\w*|\bchest pain\b|\bpalpitation\w*|\bshort(?:ness)? of breath\b/i
  };

  // Eating disorder diagnoses on the problem list (just for the header).
  const ED_DIAGNOSES = /anorexia nervosa|bulimia|binge eating|ARFID|avoidant[/ -]restrictive|eating disorder|OSFED|EDNOS/i;
  const DIABETES = /diabet|\bT1DM\b|\bT2DM\b/i;

  const api = { ROUTING, MEASURES, QUESTIONS, ORTHOSTATIC, WEIGHT_LOSS, REFEEDING, CARE_PLAN, HISTORY_TERMS, SERVICES, ED_DIAGNOSES, DIABETES };
  root.EDRCriteria = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof self !== 'undefined' ? self : this);
