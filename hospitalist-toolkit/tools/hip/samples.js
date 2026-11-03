/* MADE-UP patients for testing the hip fracture tab. Times relative to "now" (h = hours ago). None of these are real people. */
(function () {
  const iso = (now, h) => new Date(now - h * 36e5).toISOString();
  const lab = (now, loinc, disp, val, unit, h) => ({ resourceType: "Observation", status: "final", category: [{ coding: [{ code: "laboratory" }] }],
    code: { coding: loinc ? [{ system: "http://loinc.org", code: loinc, display: disp }] : [], text: disp }, effectiveDateTime: iso(now, h), valueQuantity: { value: val, unit } });
  const txt = (now, loinc, disp, val, h) => ({ resourceType: "Observation", status: "final", category: [{ coding: [{ code: "laboratory" }] }], code: { coding: [{ system: "http://loinc.org", code: loinc }], text: disp }, effectiveDateTime: iso(now, h), valueString: val });
  const vit = (now, code, disp, v, unit, h) => ({ resourceType: "Observation", category: [{ coding: [{ code: "vital-signs" }] }], code: { coding: [{ system: "http://loinc.org", code }], text: disp }, effectiveDateTime: iso(now, h), valueQuantity: { value: v, unit } });
  const basic = (now, h, o) => [o.hgb != null && lab(now, "718-7", "Hemoglobin", o.hgb, "g/L", h), o.plt != null && lab(now, "777-3", "Platelet count", o.plt, "10*9/L", h),
    o.na != null && lab(now, "2951-2", "Sodium", o.na, "mmol/L", h), o.k != null && lab(now, "2823-3", "Potassium", o.k, "mmol/L", h), o.glu != null && lab(now, "2345-7", "Glucose", o.glu, "mmol/L", h),
    o.cr != null && lab(now, "2160-0", "Creatinine", o.cr, "umol/L", h), o.inr != null && lab(now, "6301-6", "INR", o.inr, "", h)].filter(Boolean);
  const wh = (now, kg, cm) => [vit(now, "29463-7", "Body weight", kg, "kg", 20), vit(now, "8302-2", "Body height", cm, "cm", 30)];
  const req = (now, name, h, status) => ({ resourceType: "MedicationRequest", status: status || "active", medicationCodeableConcept: { text: name }, authoredOn: iso(now, h) });
  const adm = (now, name, h) => ({ resourceType: "MedicationAdministration", status: "completed", medicationCodeableConcept: { text: name }, effectiveDateTime: iso(now, h) });
  const cond = (text, code) => ({ resourceType: "Condition", code: { coding: [{ system: "http://hl7.org/fhir/sid/icd-10", code }], text } });
  const proc = (now, name, h) => ({ resourceType: "Procedure", status: "completed", code: { text: name }, performedDateTime: iso(now, h) });
  const enc = (now, h) => ({ resourceType: "Encounter", status: "in-progress", class: { code: "IMP" }, period: { start: iso(now, h) } });
  const pt = (age, gender) => ({ resourceType: "Patient", gender, birthDate: new Date(Date.now() - age * 365.25 * 864e5).toISOString().slice(0, 10) });

  window.HIP_SAMPLES = [
    { label: "A: Pre-op, 84 F on apixaban (last dose 22 h ago), lives at home", preset: { amtsLow: false, institution: false }, build: (now) => ({
      patient: pt(84, "female"), encounters: [enc(now, 20)],
      conditions: [cond("Fracture of neck of right femur, closed", "S72.001A"), cond("Atrial fibrillation", "I48.91"), cond("Hypertension", "I10")],
      obs: [].concat(basic(now, 18, { hgb: 112, plt: 230, na: 133, k: 4.2, glu: 7.8, cr: 95, inr: 1.2 }), wh(now, 58, 158), [txt(now, "882-1", "ABO and Rh group", "O Positive", 18), txt(now, "890-4", "Antibody screen", "Negative", 18)],
        [vit(now, "59408-5", "SpO2", 95, "%", 2), vit(now, "8867-4", "Heart rate", 88, "/min", 2)]),
      medreqs: [req(now, "Apixaban 5 mg PO BID", 2000, "on-hold"), req(now, "Acetaminophen 1 g PO q6h", 18), req(now, "Hydromorphone 0.5 mg PO q3h PRN", 18), req(now, "Zopiclone 7.5 mg PO qhs PRN", 18)],
      admins: [adm(now, "Apixaban 5 mg PO", 22), adm(now, "Hydromorphone 0.5 mg PO", 10), adm(now, "Hydromorphone 0.5 mg PO", 4), adm(now, "Zopiclone 7.5 mg PO", 12)],
      procs: [proc(now, "Fascia iliaca nerve block", 19)] }) },

    { label: "B: Pre-op, 79 M on warfarin, INR 2.6, dementia, low K and Na", preset: { amtsLow: true, institution: false }, build: (now) => ({
      patient: pt(79, "male"), encounters: [enc(now, 10)],
      conditions: [cond("Intertrochanteric fracture of left femur", "S72.141A"), cond("Atrial fibrillation", "I48.91"), cond("Alzheimer disease", "G30.9"), cond("Chronic kidney disease stage 3", "N18.3")],
      obs: [].concat(basic(now, 9, { hgb: 98, plt: 180, na: 128, k: 3.2, glu: 6.4, cr: 140, inr: 2.6 }), wh(now, 70, 172)),
      medreqs: [req(now, "Warfarin 4 mg PO daily", 2000, "on-hold"), req(now, "Morphine 2.5 mg SC q4h PRN", 9), req(now, "Metoprolol 25 mg PO BID", 2000)],
      admins: [adm(now, "Morphine 2.5 mg SC", 6), adm(now, "Morphine 2.5 mg SC", 2)] }) },

    { label: "C: Day 1 after hemiarthroplasty, 88 F from care home, Hgb 74, delirium", preset: { amtsLow: true, institution: true, cam: "positive", catheter: true, mobilized: false }, build: (now) => ({
      patient: pt(88, "female"), encounters: [enc(now, 60)],
      conditions: [cond("Displaced fracture of neck of left femur", "S72.032A"), cond("Vascular dementia", "F01.50"), cond("Heart failure", "I50.9"), cond("Resident of nursing home", "Z59.3")],
      obs: [].concat(basic(now, 58, { hgb: 104, plt: 250, na: 136, k: 4.0, glu: 6.0, cr: 70, inr: 1.1 }), basic(now, 20, { hgb: 92, na: 133, k: 4.1, cr: 84 }), basic(now, 4, { hgb: 74, plt: 198, na: 131, k: 4.4, cr: 105 }),
        [lab(now, "1989-3", "25-Hydroxyvitamin D", 38, "nmol/L", 50), lab(now, "17861-6", "Calcium", 2.18, "mmol/L", 4)], wh(now, 52, 155),
        [txt(now, "882-1", "ABO and Rh group", "A Positive", 57), vit(now, "59408-5", "SpO2", 91, "%", 1), vit(now, "8310-5", "Body temperature", 37.6, "Cel", 1), vit(now, "8867-4", "Heart rate", 104, "/min", 1)]),
      medreqs: [req(now, "Enoxaparin 40 mg SC daily", 24), req(now, "Hydromorphone 0.5 mg SC q2h PRN", 26), req(now, "Diphenhydramine 25 mg PO qhs PRN", 26), req(now, "Acetaminophen 650 mg PO q6h PRN", 26)],
      admins: [adm(now, "Hydromorphone 0.5 mg SC", 20), adm(now, "Hydromorphone 0.5 mg SC", 14), adm(now, "Hydromorphone 0.5 mg SC", 8), adm(now, "Hydromorphone 0.5 mg SC", 3), adm(now, "Diphenhydramine 25 mg PO", 12)],
      procs: [proc(now, "Hemiarthroplasty of left hip", 26)] }) },

    { label: "D: Day 3 after nailing, 72 M, recovering; bone health due", preset: { amtsLow: false, institution: false, cam: "negative", catheter: false, mobilized: true, bm: true }, build: (now) => ({
      patient: pt(72, "male"), encounters: [enc(now, 92)],
      conditions: [cond("Pertrochanteric fracture of right femur", "S72.101A"), cond("Type 2 diabetes mellitus", "E11.9")],
      obs: [].concat(basic(now, 90, { hgb: 136, plt: 240, na: 139, k: 4.3, glu: 9.1, cr: 82, inr: 1.0 }), basic(now, 50, { hgb: 112, cr: 84 }), basic(now, 6, { hgb: 108, plt: 260, na: 138, k: 4.2, cr: 80 }),
        [lab(now, "1989-3", "25-Hydroxyvitamin D", 72, "nmol/L", 60), lab(now, "17861-6", "Calcium", 2.31, "mmol/L", 6)], wh(now, 80, 176), [txt(now, "882-1", "ABO and Rh group", "B Positive", 88)]),
      medreqs: [req(now, "Enoxaparin 40 mg SC daily", 70), req(now, "Acetaminophen 1 g PO q6h", 70), req(now, "Oxycodone 5 mg PO q4h PRN", 70), req(now, "Sennosides 17.2 mg PO qhs", 70), req(now, "Cholecalciferol 1000 units PO daily", 70)],
      admins: [adm(now, "Oxycodone 5 mg PO", 16), adm(now, "Enoxaparin 40 mg SC", 20)],
      procs: [proc(now, "Intramedullary nail fixation of right femur (cephalomedullary)", 72)] }) },

    { label: "E: Waiting 56 h, 90 M on aspirin + clopidogrel, aortic stenosis", preset: { amtsLow: false, institution: false }, build: (now) => ({
      patient: pt(90, "male"), encounters: [enc(now, 56)],
      conditions: [cond("Subtrochanteric fracture of right femur", "S72.21XA"), cond("Aortic stenosis", "I35.0"), cond("Coronary artery disease with stent", "I25.10"), cond("COPD", "J44.9"), cond("Prostate cancer", "C61")],
      obs: [].concat(basic(now, 54, { hgb: 128, plt: 190, na: 137, k: 4.5, glu: 6.2, cr: 102, inr: 1.1 }), basic(now, 8, { hgb: 121, na: 136, k: 4.4, cr: 98 }), wh(now, 68, 170),
        [txt(now, "882-1", "ABO and Rh group", "O Negative", 54)]),
      medreqs: [req(now, "Aspirin 81 mg PO daily", 3000), req(now, "Clopidogrel 75 mg PO daily", 3000, "on-hold"), req(now, "Dalteparin 5000 units SC daily", 50), req(now, "Acetaminophen 1 g PO q6h", 54), req(now, "Morphine 2.5 mg SC q4h PRN", 54), req(now, "PEG 3350 17 g PO daily", 54)],
      admins: [adm(now, "Dalteparin 5000 units SC", 26), adm(now, "Clopidogrel 75 mg PO", 54)] }) }
  ];
})();
