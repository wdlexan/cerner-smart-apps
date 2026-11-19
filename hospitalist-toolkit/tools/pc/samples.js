/* MADE-UP patients for testing the peritoneal carcinomatosis tab. Times relative to "now" (h = hours ago). None are real people. */
(function () {
  const iso = (now, h) => new Date(now - h * 36e5).toISOString();
  const lab = (now, loinc, disp, val, unit, h) => ({ resourceType: "Observation", status: "final", category: [{ coding: [{ code: "laboratory" }] }],
    code: { coding: [{ system: "http://loinc.org", code: loinc, display: disp }], text: disp }, effectiveDateTime: iso(now, h), valueQuantity: { value: val, unit } });
  const req = (now, name, h) => ({ resourceType: "MedicationRequest", status: "active", medicationCodeableConcept: { text: name }, authoredOn: iso(now, h || 24) });
  const cond = (text, code) => ({ resourceType: "Condition", clinicalStatus: { coding: [{ code: "active" }] }, code: { coding: [{ system: "http://hl7.org/fhir/sid/icd-10", code }], text } });
  const rep = (now, name, concl, h) => ({ resourceType: "DiagnosticReport", status: "final", code: { text: name }, conclusion: concl, effectiveDateTime: iso(now, h) });
  const pt = (age, gender, name) => ({ resourceType: "Patient", gender, name: [{ text: name }], birthDate: new Date(Date.now() - age * 365.25 * 864e5 - 30 * 864e5).toISOString().slice(0, 10) });

  window.PC_SAMPLES = [
    { label: "A: 68 M, sigmoid cancer with peritoneal mets, SBO day 6, low K, metoclopramide + Buscopan, dex 7 days",
      build: (now) => ({ patient: pt(68, "male", "TEST, Alpha (made-up)"),
        conditions: [cond("Malignant neoplasm of sigmoid colon", "C18.7"), cond("Secondary malignant neoplasm of peritoneum", "C78.6"), cond("Small bowel obstruction", "K56.6"), cond("Hypertension", "I10")],
        obs: [lab(now, "2823-3", "Potassium", 3.1, "mmol/L", 4), lab(now, "19123-9", "Magnesium", 0.62, "mmol/L", 4), lab(now, "2160-0", "Creatinine", 82, "umol/L", 120), lab(now, "2160-0", "Creatinine", 131, "umol/L", 4),
          lab(now, "17861-6", "Calcium", 2.15, "mmol/L", 4), lab(now, "1751-7", "Albumin", 26, "g/L", 4), lab(now, "2524-7", "Lactate", 1.4, "mmol/L", 6), lab(now, "6690-2", "WBC", 11.2, "10*9/L", 4),
          lab(now, "2951-2", "Sodium", 133, "mmol/L", 4), lab(now, "2039-6", "CEA", 18, "ug/L", 2000), lab(now, "2039-6", "CEA", 42, "ug/L", 900), lab(now, "2039-6", "CEA", 96, "ug/L", 30)],
        medreqs: [req(now, "metoclopramide 10 mg IV q6h", 100), req(now, "hyoscine butylbromide 20 mg subcut q6h PRN", 90), req(now, "dexamethasone 8 mg IV daily", 168), req(now, "hydromorphone 0.5 mg subcut q2h PRN"), req(now, "sennosides 17.2 mg PO HS"), req(now, "enoxaparin 40 mg subcut daily")],
        reports: [rep(now, "CT Abdomen Pelvis with contrast", "Dilated small bowel with two transition points in the pelvis. Omental caking and peritoneal nodularity consistent with carcinomatosis. Small volume ascites.", 140)] }) },
    { label: "B: 59 F, high-grade serous ovarian cancer, tense ascites, CA-125 rising, no obstruction",
      build: (now) => ({ patient: pt(59, "female", "TEST, Bravo (made-up)"),
        conditions: [cond("High grade serous carcinoma of ovary", "C56.9"), cond("Malignant ascites", "R18.0"), cond("Peritoneal carcinomatosis", "C78.6")],
        obs: [lab(now, "2823-3", "Potassium", 4.0, "mmol/L", 6), lab(now, "19123-9", "Magnesium", 0.8, "mmol/L", 6), lab(now, "2160-0", "Creatinine", 64, "umol/L", 6), lab(now, "1751-7", "Albumin", 31, "g/L", 6),
          lab(now, "17861-6", "Calcium", 2.3, "mmol/L", 6), lab(now, "10334-1", "CA-125", 410, "kU/L", 2200), lab(now, "10334-1", "CA-125", 95, "kU/L", 1200), lab(now, "10334-1", "CA-125", 780, "kU/L", 20)],
        medreqs: [req(now, "hydromorphone 1 mg PO q4h PRN"), req(now, "polyethylene glycol 3350 17 g PO daily"), req(now, "olaparib 300 mg PO BID", 4000), req(now, "ondansetron 4 mg PO q8h PRN")],
        reports: [rep(now, "US Abdomen", "Large volume ascites. Peritoneal thickening.", 30)] }) },
    { label: "C: 74 M, gastric adenocarcinoma, gastric outlet obstruction, hypercalcemia, lactate 3.4",
      build: (now) => ({ patient: pt(74, "male", "TEST, Charlie (made-up)"),
        conditions: [cond("Adenocarcinoma of stomach", "C16.9"), cond("Gastric outlet obstruction", "K31.1"), cond("Peritoneal metastases", "C78.6"), cond("Type 2 diabetes", "E11.9")],
        obs: [lab(now, "2823-3", "Potassium", 3.6, "mmol/L", 3), lab(now, "17861-6", "Calcium", 2.85, "mmol/L", 3), lab(now, "1751-7", "Albumin", 24, "g/L", 3), lab(now, "2524-7", "Lactate", 3.4, "mmol/L", 2),
          lab(now, "6690-2", "WBC", 17.5, "10*9/L", 3), lab(now, "2160-0", "Creatinine", 98, "umol/L", 3), lab(now, "24108-3", "CA 19-9", 1250, "kU/L", 40), lab(now, "2039-6", "CEA", 22, "ug/L", 40)],
        medreqs: [req(now, "pantoprazole 40 mg IV daily"), req(now, "morphine 2.5 mg subcut q2h PRN")],
        reports: [rep(now, "CT Abdomen", "Circumferential gastric antral thickening with gastric outlet obstruction. Peritoneal nodules and omental stranding.", 10)] }) }];
})();
