/* MADE-UP patients for testing the consult tab. Times relative to "now" (h = hours ago). None of these are real people. */
(function () {
  const iso = (now, h) => new Date(now - h * 36e5).toISOString();
  const lab = (now, loinc, disp, val, unit, h) => ({ resourceType: "Observation", status: "final", category: [{ coding: [{ code: "laboratory" }] }],
    code: { coding: loinc ? [{ system: "http://loinc.org", code: loinc, display: disp }] : [], text: disp }, effectiveDateTime: iso(now, h), valueQuantity: { value: val, unit } });
  const bp = (now, h, s, d, hr, spo2, temp) => [
    { resourceType: "Observation", category: [{ coding: [{ code: "vital-signs" }] }], code: { coding: [{ system: "http://loinc.org", code: "85354-9" }], text: "Blood pressure" }, effectiveDateTime: iso(now, h),
      component: [{ code: { coding: [{ code: "8480-6" }] }, valueQuantity: { value: s } }, { code: { coding: [{ code: "8462-4" }] }, valueQuantity: { value: d } }] },
    { resourceType: "Observation", category: [{ coding: [{ code: "vital-signs" }] }], code: { coding: [{ system: "http://loinc.org", code: "8867-4" }], text: "Heart rate" }, effectiveDateTime: iso(now, h), valueQuantity: { value: hr } },
    { resourceType: "Observation", category: [{ coding: [{ code: "vital-signs" }] }], code: { coding: [{ system: "http://loinc.org", code: "59408-5" }], text: "SpO2" }, effectiveDateTime: iso(now, h), valueQuantity: { value: spo2 } },
    temp != null && { resourceType: "Observation", category: [{ coding: [{ code: "vital-signs" }] }], code: { coding: [{ system: "http://loinc.org", code: "8310-5" }], text: "Temperature" }, effectiveDateTime: iso(now, h), valueQuantity: { value: temp, unit: "Cel" } }].filter(Boolean);
  const req = (now, name, h, status) => ({ resourceType: "MedicationRequest", status: status || "active", medicationCodeableConcept: { text: name }, authoredOn: iso(now, h) });
  const adm = (now, name, h) => ({ resourceType: "MedicationAdministration", status: "completed", medicationCodeableConcept: { text: name }, effectiveDateTime: iso(now, h) });
  const cond = (text, code) => ({ resourceType: "Condition", code: { coding: [{ system: "http://hl7.org/fhir/sid/icd-10", code }], text } });
  const pt = (age, gender, given, family, mrn) => ({ resourceType: "Patient", gender, name: [{ use: "official", given: [given], family }], identifier: [{ type: { coding: [{ code: "MR" }] }, value: mrn }],
    birthDate: new Date(Date.now() - age * 365.25 * 864e5).toISOString().slice(0, 10) });
  const enc = (now, h, loc, reason) => ({ resourceType: "Encounter", status: "in-progress", period: { start: iso(now, h) }, location: [{ location: { display: loc } }], reasonCode: [{ text: reason }] });

  window.CONSULT_SAMPLES = [
    { label: "A: Upper GI bleed on apixaban → GI", spec: "gi", urgency: "urgent", question: "Melena, Hgb 112 → 76 on apixaban (held). Timing of endoscopy?", preset: { melena: true }, build: (now) => ({
      patient: pt(78, "male", "John", "Smith", "06233571"), encounters: [enc(now, 30, "4 West, bed 12", "melena")],
      conditions: [cond("Atrial fibrillation", "I48.91"), cond("Hypertension", "I10"), cond("Type 2 diabetes", "E11.9")],
      obs: [].concat([lab(now, "718-7", "Hemoglobin", 112, "g/L", 28), lab(now, "718-7", "Hemoglobin", 84, "g/L", 14), lab(now, "718-7", "Hemoglobin", 76, "g/L", 2),
        lab(now, "777-3", "Platelets", 160, "10*9/L", 2), lab(now, "6301-6", "INR", 1.3, "", 2), lab(now, "3091-6", "Urea", 14.0, "mmol/L", 2), lab(now, "2160-0", "Creatinine", 98, "umol/L", 2),
        lab(now, "1751-7", "Albumin", 33, "g/L", 2), lab(now, "1975-2", "Bilirubin total", 12, "umol/L", 2)], bp(now, 0.5, 98, 60, 104, 96)),
      medreqs: [req(now, "Apixaban 5 mg PO BID", 2000, "on-hold"), req(now, "Pantoprazole 8 mg/h IV infusion", 26), req(now, "Metformin 500 mg PO BID", 2000)],
      admins: [adm(now, "Packed red blood cells 1 unit", 12), adm(now, "Packed red blood cells 1 unit", 8), adm(now, "Apixaban 5 mg PO", 32)] }) },

    { label: "B: AKI on vancomycin and ramipril → Nephrology", spec: "renal", urgency: "routine", question: "AKI stage 2 on vancomycin and ramipril, not improving after 24 h of fluids. Further workup? Need for dialysis?", build: (now) => ({
      patient: pt(66, "female", "Mary", "Lee", "05118842"), encounters: [enc(now, 96, "6 North, bed 3", "cellulitis")],
      conditions: [cond("Cellulitis of left leg", "L03.116"), cond("Chronic kidney disease stage 3a", "N18.31"), cond("Hypertension", "I10")],
      obs: [].concat([lab(now, "2160-0", "Creatinine", 82, "umol/L", 1400), lab(now, "2160-0", "Creatinine", 96, "umol/L", 90), lab(now, "2160-0", "Creatinine", 140, "umol/L", 40), lab(now, "2160-0", "Creatinine", 188, "umol/L", 4),
        lab(now, "2823-3", "Potassium", 5.6, "mmol/L", 4), lab(now, "2951-2", "Sodium", 134, "mmol/L", 4), lab(now, "1963-8", "Bicarbonate", 18, "mmol/L", 4), lab(now, "3091-6", "Urea", 18, "mmol/L", 4),
        lab(now, "718-7", "Hemoglobin", 108, "g/L", 4), lab(now, "2955-3", "Sodium, Urine Random", 46, "mmol/L", 6), lab(now, "2890-2", "Protein/Creatinine Ratio, Urine", 42, "mg/mmol", 6)], bp(now, 1, 142, 78, 82, 97, 37.4)),
      medreqs: [req(now, "Vancomycin 1250 mg IV q12h", 90), req(now, "Ramipril 10 mg PO daily", 3000), req(now, "Hydrochlorothiazide 25 mg PO daily", 3000), req(now, "Ibuprofen 400 mg PO q6h PRN", 80)] }) },

    { label: "C: Chest pain, troponin rising → Cardiology", spec: "cardio", urgency: "urgent", question: "Rising hs-troponin after hip surgery, new ST depression V4-V6. Type 2 MI vs ACS? Anticoagulation safe 1 day post-op?", findings: "ECG: 1 mm ST depression V4-V6, sinus 108", build: (now) => ({
      patient: pt(81, "female", "Ruth", "Anders", "07745120"), encounters: [enc(now, 50, "Ortho 3B, bed 7", "hip fracture")],
      conditions: [cond("Fracture of neck of femur", "S72.001A"), cond("Coronary artery disease", "I25.10"), cond("Heart failure with preserved EF", "I50.30")],
      obs: [].concat([lab(now, "89579-7", "Troponin I high sensitivity", 18, "ng/L", 30), lab(now, "89579-7", "Troponin I high sensitivity", 240, "ng/L", 8), lab(now, "89579-7", "Troponin I high sensitivity", 610, "ng/L", 2),
        lab(now, "33762-6", "NT-proBNP", 2400, "ng/L", 8), lab(now, "2823-3", "Potassium", 3.6, "mmol/L", 2), lab(now, "19123-9", "Magnesium", 0.68, "mmol/L", 2), lab(now, "2160-0", "Creatinine", 102, "umol/L", 2),
        lab(now, "718-7", "Hemoglobin", 86, "g/L", 2)], bp(now, 0.5, 132, 70, 108, 93)),
      medreqs: [req(now, "Enoxaparin 40 mg SC daily", 20), req(now, "Metoprolol tartrate 25 mg PO BID", 3000), req(now, "Aspirin 81 mg PO daily", 3000), req(now, "Ondansetron 4 mg IV q8h PRN", 20)] }) },

    { label: "D: Decompensated cirrhosis → Hepatology", spec: "liver", urgency: "urgent", question: "Alcohol cirrhosis, MELD-Na 32, probable HRS-AKI. Terlipressin? Transplant assessment?", build: (now) => ({
      patient: pt(54, "female", "Anne", "Kowal", "09912003"), encounters: [enc(now, 72, "Medicine 5A, bed 22", "ascites and confusion")],
      conditions: [cond("Alcoholic cirrhosis of liver with ascites", "K70.31"), cond("Hepatic encephalopathy", "K76.82")],
      obs: [].concat([lab(now, "1975-2", "Bilirubin total", 62, "umol/L", 70), lab(now, "1975-2", "Bilirubin total", 78, "umol/L", 3), lab(now, "6301-6", "INR", 2.1, "", 3), lab(now, "2160-0", "Creatinine", 74, "umol/L", 1500),
        lab(now, "2160-0", "Creatinine", 182, "umol/L", 3), lab(now, "2951-2", "Sodium", 126, "mmol/L", 3), lab(now, "1751-7", "Albumin", 23, "g/L", 3), lab(now, "777-3", "Platelets", 58, "10*9/L", 3),
        lab(now, "1742-6", "ALT", 44, "U/L", 3), lab(now, "1920-8", "AST", 96, "U/L", 3), lab(now, "6768-6", "Alkaline phosphatase", 160, "U/L", 3)], bp(now, 1, 98, 52, 92, 96)),
      medreqs: [req(now, "Lactulose 30 mL PO TID", 60), req(now, "Rifaximin 550 mg PO BID", 60), req(now, "Spironolactone 100 mg PO daily", 400, "on-hold"), req(now, "Albumin 25% 100 mL IV daily", 30)] }) }
  ];
})();
