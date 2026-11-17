/* MADE-UP patients for testing the AKI tab. Times are relative to "now" (h = hours ago). None of these are real people. */
(function () {
  const iso = (now, h) => new Date(now - h * 36e5).toISOString();
  const code = (loinc, disp) => ({ coding: loinc ? [{ system: "http://loinc.org", code: loinc, display: disp }] : [], text: disp });
  const lab = (now, loinc, disp, val, unit, h) => ({ resourceType: "Observation", status: "final", category: [{ coding: [{ code: "laboratory" }] }], code: code(loinc, disp), effectiveDateTime: iso(now, h), valueQuantity: { value: val, unit } });
  const txt = (now, loinc, disp, s, h) => ({ resourceType: "Observation", status: "final", category: [{ coding: [{ code: "laboratory" }] }], code: code(loinc, disp), effectiveDateTime: iso(now, h), valueString: s });
  const cr = (now, v, h) => lab(now, "2160-0", "Creatinine", v, "umol/L", h);
  const vit = (now, loinc, disp, v, unit, h) => ({ resourceType: "Observation", status: "final", category: [{ coding: [{ code: "vital-signs" }] }], code: code(loinc, disp), effectiveDateTime: iso(now, h), valueQuantity: { value: v, unit } });
  const bp = (now, s, d, h) => ({ resourceType: "Observation", status: "final", category: [{ coding: [{ code: "vital-signs" }] }], code: code("85354-9", "Blood pressure"), effectiveDateTime: iso(now, h),
    component: [{ code: code("8480-6", "Systolic"), valueQuantity: { value: s, unit: "mm[Hg]" } }, { code: code("8462-4", "Diastolic"), valueQuantity: { value: d, unit: "mm[Hg]" } }] });
  const uo = (now, ml, h) => vit(now, "9187-6", "Urine output", ml, "mL", h);
  const wt = (now, kg) => vit(now, "29463-7", "Body weight", kg, "kg", 30);
  const req = (now, name, h, status) => ({ resourceType: "MedicationRequest", status: status || "active", medicationCodeableConcept: { text: name }, authoredOn: iso(now, h) });
  const adm = (now, name, h) => ({ resourceType: "MedicationAdministration", status: "completed", medicationCodeableConcept: { text: name }, effectiveDateTime: iso(now, h) });
  const cond = (text, icd) => ({ resourceType: "Condition", clinicalStatus: { coding: [{ code: "active" }] }, code: { coding: [{ system: "http://hl7.org/fhir/sid/icd-10", code: icd }], text } });
  const pt = (age, gender) => ({ resourceType: "Patient", gender, birthDate: new Date(Date.now() - age * 365.25 * 864e5).toISOString().slice(0, 10) });
  const hourly = (now, mlPerH, hours) => Array.from({ length: hours }, (_, i) => uo(now, mlPerH, i + 0.5));

  window.AKI_SAMPLES = [
    { label: "A: Pre-renal: vomiting and diarrhea on ramipril, HCTZ and ibuprofen", exam: "dry", build: (now) => ({
      patient: pt(82, "female"), conditions: [cond("Essential hypertension", "I10"), cond("Osteoarthritis of knee", "M17.9")],
      obs: [cr(now, 82, 2400), cr(now, 78, 4300), cr(now, 196, 26), cr(now, 171, 2), wt(now, 58), bp(now, 92, 54, 26), bp(now, 104, 60, 3),
        lab(now, "3091-6", "Urea", 24.5, "mmol/L", 26), lab(now, "3091-6", "Urea", 21.0, "mmol/L", 2), lab(now, "2951-2", "Sodium", 134, "mmol/L", 26), lab(now, "2823-3", "Potassium", 5.3, "mmol/L", 2),
        lab(now, "1963-8", "Bicarbonate", 21, "mmol/L", 2), lab(now, "2955-3", "Sodium, Urine Random", 11, "mmol/L", 24), lab(now, "2161-8", "Creatinine, Urine Random", 14.2, "mmol/L", 24),
        lab(now, "3095-7", "Urea, Urine Random", 380, "mmol/L", 24), lab(now, "2695-4", "Osmolality, Urine", 640, "mOsm/kg", 24),
        txt(now, "5794-3", "Blood, Urine", "Negative", 24), txt(now, "2888-6", "Protein, Urine", "Trace", 24), txt(now, "5799-2", "Leukocyte Esterase, Urine", "Negative", 24)],
      medreqs: [req(now, "Ramipril 10 mg PO daily", 3000), req(now, "Hydrochlorothiazide 25 mg PO daily", 3000), req(now, "Ibuprofen 400 mg PO TID PRN", 400), req(now, "Ringer's lactate 1000 mL IV at 125 mL/h", 20)] }) },

    { label: "B: ATN: septic shock on vancomycin and piperacillin-tazobactam", exam: "", build: (now) => ({
      patient: pt(68, "male"), conditions: [cond("Sepsis due to pneumonia", "A41.9"), cond("Type 2 diabetes mellitus", "E11.9")],
      obs: [].concat([cr(now, 92, 120), cr(now, 140, 72), cr(now, 205, 48), cr(now, 262, 24), cr(now, 305, 2), wt(now, 80), bp(now, 78, 40, 70), bp(now, 96, 52, 30), bp(now, 112, 60, 3),
        lab(now, "3091-6", "Urea", 19.8, "mmol/L", 2), lab(now, "2823-3", "Potassium", 5.9, "mmol/L", 2), lab(now, "1963-8", "Bicarbonate", 15, "mmol/L", 2), lab(now, "2744-1", "pH, Venous", 7.24, "", 2),
        lab(now, "2951-2", "Sodium", 137, "mmol/L", 2), lab(now, "2777-1", "Phosphate", 2.1, "mmol/L", 2), lab(now, "2157-6", "Creatine Kinase", 640, "U/L", 30), lab(now, "4092-3", "Vancomycin Trough", 27.5, "mg/L", 20),
        lab(now, "2955-3", "Sodium, Urine Random", 62, "mmol/L", 20), lab(now, "2161-8", "Creatinine, Urine Random", 4.1, "mmol/L", 20), lab(now, "3095-7", "Urea, Urine Random", 95, "mmol/L", 20), lab(now, "2695-4", "Osmolality, Urine", 305, "mOsm/kg", 20),
        txt(now, "5793-5", "Granular Casts, Urine", "Many (muddy brown)", 20), txt(now, "5794-3", "Blood, Urine", "Trace", 20), txt(now, "2888-6", "Protein, Urine", "1+", 20)], hourly(now, 15, 14)),
      medreqs: [req(now, "Vancomycin 1500 mg IV q12h", 96), req(now, "Piperacillin-tazobactam 4.5 g IV q6h", 96), req(now, "Norepinephrine infusion", 70, "completed"), req(now, "Enoxaparin 40 mg subcut daily", 96), req(now, "Metformin 1000 mg PO BID", 4000, "on-hold")] }) },

    { label: "C: AIN: pantoprazole, amoxicillin, rash and eosinophilia", exam: "euvolemic", build: (now) => ({
      patient: pt(54, "female"), conditions: [cond("Gastroesophageal reflux disease", "K21.9")],
      obs: [cr(now, 68, 900), cr(now, 74, 260), cr(now, 148, 120), cr(now, 196, 48), cr(now, 224, 3), wt(now, 66), bp(now, 132, 78, 4),
        lab(now, "3091-6", "Urea", 12.1, "mmol/L", 3), lab(now, "2823-3", "Potassium", 4.6, "mmol/L", 3), lab(now, "1963-8", "Bicarbonate", 22, "mmol/L", 3), lab(now, "2951-2", "Sodium", 139, "mmol/L", 3),
        lab(now, "711-2", "Eosinophils", 0.9, "10*9/L", 4), lab(now, "718-7", "Hemoglobin", 128, "g/L", 4), lab(now, "777-3", "Platelets", 245, "10*9/L", 4),
        lab(now, "5821-4", "WBC, Urine", 30, "/HPF", 6), lab(now, "13945-1", "RBC, Urine", 4, "/HPF", 6), txt(now, "5799-2", "Leukocyte Esterase, Urine", "2+", 6), txt(now, "5802-4", "Nitrite, Urine", "Negative", 6),
        txt(now, "630-4", "Urine Culture", "No growth", 2), txt(now, "", "White Cell Casts, Urine", "Few seen", 6), lab(now, "2890-2", "Protein/Creatinine Ratio, Urine", 0.06, "g/mmol", 6),
        lab(now, "2955-3", "Sodium, Urine Random", 48, "mmol/L", 6), lab(now, "2161-8", "Creatinine, Urine Random", 6.5, "mmol/L", 6)],
      medreqs: [req(now, "Pantoprazole 40 mg PO daily", 600), req(now, "Amoxicillin 500 mg PO TID", 330, "completed")] }) },

    { label: "D: Post-renal: urinary retention (prostate, oxybutynin, hydromorphone)", exam: "", build: (now) => ({
      patient: pt(79, "male"), conditions: [cond("Benign prostatic hyperplasia", "N40.0"), cond("Fracture of neck of femur", "S72.0")],
      obs: [].concat([cr(now, 96, 1500), cr(now, 101, 70), cr(now, 168, 30), cr(now, 262, 3), wt(now, 74), bp(now, 158, 84, 4),
        lab(now, "3091-6", "Urea", 18.2, "mmol/L", 3), lab(now, "2823-3", "Potassium", 5.6, "mmol/L", 3), lab(now, "1963-8", "Bicarbonate", 20, "mmol/L", 3), lab(now, "2951-2", "Sodium", 136, "mmol/L", 3),
        vit(now, "", "Bladder scan volume", 950, "mL", 1), txt(now, "5794-3", "Blood, Urine", "1+", 5)], [uo(now, 0, 2), uo(now, 40, 6), uo(now, 650, 9), uo(now, 20, 14)]),
      medreqs: [req(now, "Oxybutynin 5 mg PO BID", 90), req(now, "Hydromorphone 1 mg PO q4h PRN", 70), req(now, "Tamsulosin 0.4 mg PO daily", 4000, "stopped"), req(now, "Enoxaparin 40 mg subcut daily", 70)],
      admins: [adm(now, "Hydromorphone 1 mg PO", 5), adm(now, "Hydromorphone 1 mg PO", 10), adm(now, "Hydromorphone 1 mg PO", 16)] }) },

    { label: "E: Rapidly progressive GN: hemoptysis, red cell casts, MPO-ANCA positive", exam: "", build: (now) => ({
      patient: pt(63, "male"), conditions: [cond("Hemoptysis", "R04.2")],
      obs: [cr(now, 88, 1600), cr(now, 238, 96), cr(now, 334, 48), cr(now, 418, 4), wt(now, 77), bp(now, 168, 96, 4),
        lab(now, "3091-6", "Urea", 26.4, "mmol/L", 4), lab(now, "2823-3", "Potassium", 5.4, "mmol/L", 4), lab(now, "1963-8", "Bicarbonate", 18, "mmol/L", 4), lab(now, "2951-2", "Sodium", 138, "mmol/L", 4),
        lab(now, "718-7", "Hemoglobin", 94, "g/L", 4), lab(now, "777-3", "Platelets", 310, "10*9/L", 4), lab(now, "4485-9", "Complement C3", 1.1, "g/L", 30), lab(now, "4498-2", "Complement C4", 0.24, "g/L", 30),
        txt(now, "5794-3", "Blood, Urine", "3+", 30), txt(now, "2888-6", "Protein, Urine", "2+", 30), lab(now, "13945-1", "RBC, Urine", 60, "/HPF", 30),
        txt(now, "5808-1", "RBC Casts, Urine", "Present", 30), txt(now, "6968-2", "Myeloperoxidase Ab (MPO-ANCA)", "Positive", 10), txt(now, "5149-0", "Glomerular Basement Membrane Ab", "Negative", 10),
        lab(now, "2890-2", "Protein/Creatinine Ratio, Urine", 0.21, "g/mmol", 30)],
      medreqs: [req(now, "Amlodipine 5 mg PO daily", 40)] }) }
  ];
})();
