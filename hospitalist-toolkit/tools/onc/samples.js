/* MADE-UP patients for testing the Oncology tab. Times relative to "now" (h = hours ago). None are real people. */
(function () {
  const iso = (now, h) => new Date(now - h * 36e5).toISOString();
  const lab = (now, loinc, disp, val, unit, h) => ({ resourceType: "Observation", status: "final", category: [{ coding: [{ code: "laboratory" }] }],
    code: { coding: [{ system: "http://loinc.org", code: loinc, display: disp }], text: disp }, effectiveDateTime: iso(now, h), valueQuantity: { value: val, unit } });
  const temp = (now, val, h) => ({ resourceType: "Observation", status: "final", category: [{ coding: [{ code: "vital-signs" }] }],
    code: { coding: [{ system: "http://loinc.org", code: "8310-5", display: "Body temperature" }], text: "Temperature" }, effectiveDateTime: iso(now, h), valueQuantity: { value: val, unit: "Cel" } });
  const req = (now, name, h) => ({ resourceType: "MedicationRequest", status: "active", medicationCodeableConcept: { text: name }, authoredOn: iso(now, h || 24) });
  const cond = (text, code) => ({ resourceType: "Condition", clinicalStatus: { coding: [{ code: "active" }] }, code: { coding: [{ system: "http://hl7.org/fhir/sid/icd-10", code }], text } });
  const rep = (now, name, concl, h) => ({ resourceType: "DiagnosticReport", status: "final", code: { text: name }, conclusion: concl, effectiveDateTime: iso(now, h) });
  const pt = (age, gender, name) => ({ resourceType: "Patient", gender, name: [{ text: name }], birthDate: new Date(Date.now() - age * 365.25 * 864e5 - 30 * 864e5).toISOString().slice(0, 10) });

  const SAMPLES = [
    { label: "A: 66 M, extensive small cell lung cancer, day 9 after carboplatin-etoposide-durvalumab, fever 38.6, ANC 0.3, Na 126",
      build: (now) => ({ patient: pt(66, "male", "TEST, Alpha (made-up)"),
        conditions: [cond("Small cell carcinoma of right upper lobe lung, extensive stage", "C34.1"), cond("Secondary malignant neoplasm of liver", "C78.7"), cond("COPD", "J44.9")],
        obs: [temp(now, 38.6, 3), temp(now, 37.4, 20), lab(now, "751-8", "Neutrophils absolute", 0.3, "10*9/L", 4), lab(now, "6690-2", "WBC", 0.9, "10*9/L", 4),
          lab(now, "777-3", "Platelets", 64, "10*9/L", 4), lab(now, "718-7", "Hemoglobin", 92, "g/L", 4), lab(now, "2951-2", "Sodium", 126, "mmol/L", 4),
          lab(now, "2823-3", "Potassium", 3.9, "mmol/L", 4), lab(now, "2160-0", "Creatinine", 78, "umol/L", 4), lab(now, "2524-7", "Lactate", 2.1, "mmol/L", 3)],
        medreqs: [req(now, "durvalumab 1500 mg IV every 3 weeks", 216), req(now, "etoposide 100 mg/m2 IV days 1-3", 216), req(now, "carboplatin AUC 5 IV day 1", 216),
          req(now, "ondansetron 8 mg PO q8h PRN"), req(now, "tiotropium 18 mcg inhaled daily", 2000)],
        reports: [rep(now, "CT Chest", "Right upper lobe mass with bulky mediastinal nodes. Multiple liver metastases.", 600)] }) },
    { label: "B: 58 F, metastatic ER+ breast cancer with bone mets on ribociclib + letrozole, back pain, corrected Ca 3.2, ondansetron + citalopram",
      build: (now) => ({ patient: pt(58, "female", "TEST, Bravo (made-up)"),
        conditions: [cond("Malignant neoplasm of left breast, ER positive HER2 negative", "C50.912"), cond("Secondary malignant neoplasm of bone", "C79.51"), cond("Low back pain", "M54.5"), cond("Depression", "F32.9")],
        obs: [lab(now, "17861-6", "Calcium", 3.05, "mmol/L", 5), lab(now, "1751-7", "Albumin", 32, "g/L", 5), lab(now, "2160-0", "Creatinine", 70, "umol/L", 200), lab(now, "2160-0", "Creatinine", 104, "umol/L", 5),
          lab(now, "2823-3", "Potassium", 3.6, "mmol/L", 5), lab(now, "19123-9", "Magnesium", 0.74, "mmol/L", 5), lab(now, "751-8", "Neutrophils absolute", 1.3, "10*9/L", 5), lab(now, "6875-9", "CA 15-3", 88, "kU/L", 900), lab(now, "6875-9", "CA 15-3", 164, "kU/L", 30)],
        medreqs: [req(now, "ribociclib 600 mg PO daily days 1-21", 3000), req(now, "letrozole 2.5 mg PO daily", 3000), req(now, "ondansetron 4 mg IV q8h PRN"), req(now, "citalopram 20 mg PO daily", 5000), req(now, "hydromorphone 1 mg PO q4h PRN")],
        reports: [rep(now, "Bone scan", "Multiple osseous metastases including T10 and L2 vertebral bodies.", 400)] }) },
    { label: "C: 71 M, metastatic left-sided colon cancer on FOLFIRI + panitumumab, diarrhea, Mg 0.45, K 3.1, creatinine rise",
      build: (now) => ({ patient: pt(71, "male", "TEST, Charlie (made-up)"),
        conditions: [cond("Malignant neoplasm of sigmoid colon", "C18.7"), cond("Secondary malignant neoplasm of liver", "C78.7"), cond("Diarrhea", "R19.7"), cond("Pulmonary embolism", "I26.9")],
        obs: [lab(now, "19123-9", "Magnesium", 0.45, "mmol/L", 6), lab(now, "2823-3", "Potassium", 3.1, "mmol/L", 6), lab(now, "2160-0", "Creatinine", 84, "umol/L", 160), lab(now, "2160-0", "Creatinine", 142, "umol/L", 6),
          lab(now, "17861-6", "Calcium", 2.02, "mmol/L", 6), lab(now, "1751-7", "Albumin", 30, "g/L", 6), lab(now, "1975-2", "Bilirubin total", 31, "umol/L", 6), lab(now, "751-8", "Neutrophils absolute", 1.6, "10*9/L", 6),
          lab(now, "2039-6", "CEA", 54, "ug/L", 1500), lab(now, "2039-6", "CEA", 31, "ug/L", 500)],
        medreqs: [req(now, "FOLFIRI (irinotecan, leucovorin, fluorouracil 46 h pump) every 2 weeks", 120), req(now, "panitumumab 6 mg/kg IV every 2 weeks", 120), req(now, "loperamide 2 mg PO PRN"), req(now, "rivaroxaban 20 mg PO daily", 3000), req(now, "doxycycline 100 mg PO BID", 1000)] }) },
    { label: "D: 79 M, new metastatic prostate cancer: leuprolide 10 days ago (no antiandrogen), enzalutamide + apixaban, back pain and leg weakness",
      build: (now) => ({ patient: pt(79, "male", "TEST, Delta (made-up)"),
        conditions: [cond("Adenocarcinoma of prostate", "C61"), cond("Secondary malignant neoplasm of bone", "C79.51"), cond("Back pain", "M54.9"), cond("Lower limb weakness", "R29.898"), cond("Atrial fibrillation", "I48.91")],
        obs: [lab(now, "2857-1", "PSA", 312, "ug/L", 400), lab(now, "17861-6", "Calcium", 2.18, "mmol/L", 4), lab(now, "1751-7", "Albumin", 36, "g/L", 4), lab(now, "2160-0", "Creatinine", 96, "umol/L", 4), lab(now, "718-7", "Hemoglobin", 104, "g/L", 4)],
        medreqs: [req(now, "leuprolide 22.5 mg IM every 3 months", 240), req(now, "enzalutamide 160 mg PO daily", 200), req(now, "apixaban 5 mg PO BID", 4000), req(now, "morphine 5 mg PO q4h PRN")],
        reports: [rep(now, "XR Thoracic spine", "Sclerotic lesions T8 to T11 in keeping with metastases. No fracture.", 30)] }) },
    { label: "E: 63 F, EGFR lung adenocarcinoma on osimertinib, new ground-glass pneumonitis on CT, haloperidol, dexamethasone 30 days",
      build: (now) => ({ patient: pt(63, "female", "TEST, Echo (made-up)"),
        conditions: [cond("Adenocarcinoma of left lower lobe lung, EGFR exon 19 deletion", "C34.3"), cond("Secondary malignant neoplasm of brain", "C79.31"), cond("Delirium", "F05")],
        obs: [lab(now, "2823-3", "Potassium", 3.4, "mmol/L", 6), lab(now, "19123-9", "Magnesium", 0.68, "mmol/L", 6), lab(now, "2345-7", "Glucose", 17.2, "mmol/L", 4), lab(now, "1742-6", "ALT", 34, "U/L", 6),
          lab(now, "2951-2", "Sodium", 136, "mmol/L", 6), lab(now, "751-8", "Neutrophils absolute", 6.8, "10*9/L", 6), temp(now, 37.6, 5)],
        medreqs: [req(now, "osimertinib 80 mg PO daily", 6000), req(now, "dexamethasone 4 mg PO BID", 720), req(now, "haloperidol 0.5 mg subcut q4h PRN agitation"), req(now, "pantoprazole 40 mg PO daily", 720)],
        reports: [rep(now, "CT Chest", "New bilateral ground-glass opacities, differential includes drug-related pneumonitis or atypical infection.", 8)] }) },
    { label: "F: 74 M, metastatic castration-resistant prostate cancer on abiraterone with NO prednisone ordered, K 3.0, hydronephrosis",
      build: (now) => ({ patient: pt(74, "male", "TEST, Foxtrot (made-up)"),
        conditions: [cond("Malignant neoplasm of prostate", "C61"), cond("Secondary malignant neoplasm of bone", "C79.51"), cond("Bilateral hydronephrosis", "N13.30"), cond("Hypertension", "I10")],
        obs: [lab(now, "2823-3", "Potassium", 3.0, "mmol/L", 5), lab(now, "2160-0", "Creatinine", 88, "umol/L", 500), lab(now, "2160-0", "Creatinine", 196, "umol/L", 5), lab(now, "2857-1", "PSA", 48, "ug/L", 2000), lab(now, "2857-1", "PSA", 126, "ug/L", 60),
          lab(now, "2986-8", "Testosterone", 0.4, "nmol/L", 60), lab(now, "1742-6", "ALT", 58, "U/L", 5)],
        medreqs: [req(now, "abiraterone 1000 mg PO daily", 4000), req(now, "goserelin 10.8 mg subcut every 12 weeks", 9000), req(now, "denosumab 120 mg subcut every 4 weeks", 3000), req(now, "amlodipine 10 mg PO daily", 9000)],
        reports: [rep(now, "US Kidneys", "Moderate bilateral hydronephrosis. Bladder wall thickening and enlarged prostate.", 10)] }) } ];

  if (typeof module !== "undefined" && module.exports) module.exports = SAMPLES; else window.ONC_SAMPLES = SAMPLES;
})();
