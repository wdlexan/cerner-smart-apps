/* Made-up patients for testing. None is a real person. Dates are relative to "now" so the values are never stale. */
(function () {
  const ago = (d) => new Date(Date.now() - d * 864e5).toISOString();
  let n = 0;
  const L = "http://loinc.org";
  const obs = (code, text, v, unit, days, cat) => ({ resourceType: "Observation", id: "o" + ++n, status: "final", category: [{ coding: [{ code: cat || "laboratory" }] }], code: { coding: [{ system: L, code }], text }, valueQuantity: { value: v, unit }, effectiveDateTime: ago(days) });
  const bp = (s, d, days) => ({ resourceType: "Observation", id: "o" + ++n, status: "final", category: [{ coding: [{ code: "vital-signs" }] }], code: { coding: [{ system: L, code: "85354-9" }], text: "Blood pressure" },
    component: [{ code: { coding: [{ system: L, code: "8480-6" }], text: "Systolic blood pressure" }, valueQuantity: { value: s, unit: "mmHg" } }, { code: { coding: [{ system: L, code: "8462-4" }], text: "Diastolic blood pressure" }, valueQuantity: { value: d, unit: "mmHg" } }], effectiveDateTime: ago(days) });
  const V = "vital-signs";
  const vit = (o) => [bp(o.sbp, 70, o.d || 0.1), obs("8867-4", "Heart rate", o.hr, "/min", o.d || 0.1, V), obs("9279-1", "Respiratory rate", o.rr, "/min", o.d || 0.1, V), obs("8310-5", "Body temperature", o.t, "Cel", o.d || 0.1, V), obs("59408-5", "Oxygen saturation", o.spo2, "%", o.d || 0.1, V)];
  const med = (t) => ({ resourceType: "MedicationRequest", id: "m" + ++n, status: "active", medicationCodeableConcept: { text: t } });
  const cond = (t) => ({ resourceType: "Condition", id: "c" + ++n, clinicalStatus: { coding: [{ code: "active" }] }, code: { text: t } });
  const alg = (t, reaction, crit) => ({ resourceType: "AllergyIntolerance", id: "a" + ++n, clinicalStatus: { coding: [{ code: "active" }] }, criticality: crit || "low", code: { text: t }, reaction: [{ manifestation: [{ text: reaction }] }] });
  const pt = (age, sex) => ({ resourceType: "Patient", id: "p" + ++n, gender: sex, birthDate: new Date(Date.now() - age * 365.25 * 864e5 - 30 * 864e5).toISOString().slice(0, 10) });

  window.WA_SAMPLES = [
    { label: "A: 78 F pneumonia, kidney injury, bleeding risk, sedatives (expect many flags)", raw: {
      patient: pt(78, "female"), conds: ["Pneumonia", "Chronic kidney disease stage 3", "Type 2 diabetes mellitus", "Dementia"].map(cond),
      meds: ["Enoxaparin 40 mg subcut daily", "Ibuprofen 400 mg PO", "Lorazepam 0.5 mg PO", "Metformin 500 mg PO", "Ramipril 5 mg PO", "Furosemide 40 mg PO", "Piperacillin-tazobactam IV"].map(med),
      allergies: [alg("Penicillin", "rash", "low")],
      obs: vit({ sbp: 94, hr: 112, rr: 24, t: 38.4, spo2: 89 }).concat([obs("2160-0", "Creatinine", 142, "umol/L", 0.2), obs("2160-0", "Creatinine", 88, "umol/L", 3), obs("98979-8", "eGFR", 28, "mL/min/1.73m2", 0.2), obs("2823-3", "Potassium", 4.1, "mmol/L", 0.2), obs("2951-2", "Sodium", 134, "mmol/L", 0.2),
        obs("718-7", "Hemoglobin", 96, "g/L", 0.2), obs("718-7", "Hemoglobin", 121, "g/L", 3), obs("6690-2", "WBC", 17, "10*9/L", 0.2), obs("777-3", "Platelets", 210, "10*9/L", 0.2), obs("2345-7", "Glucose", 12.4, "mmol/L", 0.2), obs("2524-7", "Lactate", 2.6, "mmol/L", 0.2)]) } },
    { label: "B: 70 M heart failure, high potassium, low BP, digoxin", raw: {
      patient: pt(70, "male"), conds: ["Heart failure with reduced ejection fraction", "Atrial fibrillation"].map(cond),
      meds: ["Spironolactone 25 mg PO", "Ramipril 10 mg PO", "Potassium chloride ER", "Furosemide 80 mg PO", "Digoxin 0.125 mg PO", "Trimethoprim-sulfamethoxazole DS"].map(med), allergies: [],
      obs: vit({ sbp: 88, hr: 58, rr: 18, t: 36.8, spo2: 95 }).concat([obs("2823-3", "Potassium", 5.7, "mmol/L", 0.2), obs("2160-0", "Creatinine", 160, "umol/L", 0.2), obs("2160-0", "Creatinine", 118, "umol/L", 1.5), obs("98979-8", "eGFR", 24, "mL/min/1.73m2", 0.2), obs("2951-2", "Sodium", 128, "mmol/L", 0.2)]) } },
    { label: "C: 82 M COPD, hypoxia, QT drugs, sedatives, steroid, high glucose", raw: {
      patient: pt(82, "male"), conds: ["COPD"].map(cond),
      meds: ["Prednisone 50 mg PO", "Quetiapine 25 mg PO", "Azithromycin 250 mg PO", "Oxycodone 5 mg PO", "Zopiclone 5 mg PO", "Amitriptyline 10 mg PO"].map(med), allergies: [],
      obs: vit({ sbp: 128, hr: 96, rr: 26, t: 37.2, spo2: 87 }).concat([obs("2823-3", "Potassium", 3.3, "mmol/L", 0.2), obs("2345-7", "Glucose", 22.5, "mmol/L", 0.2), obs("2160-0", "Creatinine", 90, "umol/L", 0.2)]) } },
    { label: "D: 45 M cellulitis, diabetes on SGLT2, anaphylaxis to penicillin, on cefazolin", raw: {
      patient: pt(45, "male"), conds: ["Cellulitis of left leg", "Type 2 diabetes mellitus"].map(cond),
      meds: ["Cefazolin IV", "Metformin 1000 mg PO", "Empagliflozin 10 mg PO", "Insulin glargine"].map(med), allergies: [alg("Penicillin", "anaphylaxis", "high")],
      obs: vit({ sbp: 124, hr: 102, rr: 18, t: 38.2, spo2: 97 }).concat([obs("2345-7", "Glucose", 21.3, "mmol/L", 0.2), obs("6690-2", "WBC", 15.2, "10*9/L", 0.2), obs("2160-0", "Creatinine", 80, "umol/L", 0.2), obs("98979-8", "eGFR", 90, "mL/min/1.73m2", 0.2), obs("2823-3", "Potassium", 4.2, "mmol/L", 0.2)]) } },
    { label: "E: 52 F control, hypertension, normal values (expect NO watch-outs)", raw: {
      patient: pt(52, "female"), conds: ["Essential hypertension"].map(cond), meds: ["Amlodipine 5 mg PO"].map(med), allergies: [],
      obs: vit({ sbp: 126, hr: 72, rr: 16, t: 36.8, spo2: 98 }).concat([obs("2823-3", "Potassium", 4.2, "mmol/L", 0.5), obs("2951-2", "Sodium", 139, "mmol/L", 0.5), obs("2160-0", "Creatinine", 70, "umol/L", 0.5), obs("98979-8", "eGFR", 95, "mL/min/1.73m2", 0.5), obs("718-7", "Hemoglobin", 135, "g/L", 0.5), obs("6690-2", "WBC", 7, "10*9/L", 0.5), obs("777-3", "Platelets", 250, "10*9/L", 0.5), obs("2345-7", "Glucose", 5.2, "mmol/L", 0.5)]) } },
    { label: "F: old values only (31 days): expect them NOT used unless 'Include older values' is ticked", raw: {
      patient: pt(66, "male"), conds: ["Heart failure"].map(cond), meds: ["Spironolactone 25 mg PO"].map(med), allergies: [],
      obs: [obs("2823-3", "Potassium", 6.2, "mmol/L", 31), bp(82, 50, 31), obs("8867-4", "Heart rate", 50, "/min", 31, V)] } }
  ];
})();
