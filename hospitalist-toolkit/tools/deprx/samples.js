/* MADE-UP patients for testing the Deprescribing tab. Times relative to "now" (h = hours ago). None are real people. */
(function () {
  const iso = (now, h) => new Date(now - h * 36e5).toISOString();
  const lab = (now, loinc, disp, val, unit, h) => ({ resourceType: "Observation", status: "final", category: [{ coding: [{ code: "laboratory" }] }],
    code: { coding: [{ system: "http://loinc.org", code: loinc, display: disp }], text: disp }, effectiveDateTime: iso(now, h), valueQuantity: { value: val, unit } });
  const vs = (now, loinc, disp, val, unit, h) => ({ resourceType: "Observation", status: "final", category: [{ coding: [{ code: "vital-signs" }] }],
    code: { coding: [{ system: "http://loinc.org", code: loinc, display: disp }], text: disp }, effectiveDateTime: iso(now, h), valueQuantity: { value: val, unit } });
  const wt = (now, v, h) => vs(now, "29463-7", "Weight", v, "kg", h || 20), sbp = (now, v, h) => vs(now, "8480-6", "Systolic blood pressure", v, "mm[Hg]", h), hr = (now, v, h) => vs(now, "8867-4", "Heart rate", v, "/min", h);
  const req = (now, name, sig, prn) => ({ resourceType: "MedicationRequest", status: "active", medicationCodeableConcept: { text: name }, authoredOn: iso(now, 48),
    dosageInstruction: [Object.assign({ text: sig || "" }, prn ? { asNeededBoolean: true } : {})] });
  const cond = (text, code) => ({ resourceType: "Condition", clinicalStatus: { coding: [{ code: "active" }] }, code: { coding: [{ system: "http://hl7.org/fhir/sid/icd-10", code }], text } });
  const pt = (age, gender, name) => ({ resourceType: "Patient", gender, name: [{ text: name }], birthDate: new Date(Date.now() - age * 365.25 * 864e5 - 30 * 864e5).toISOString().slice(0, 10) });
  const L = { cr: "2160-0", egfr: "33914-3", k: "2823-3", na: "2951-2", mg: "19123-9", ca: "17861-6", a1c: "4548-4", tsh: "3016-3", inr: "6301-6", plt: "777-3", hb: "718-7", qtc: "8636-3" };

  const SAMPLES = [
    { label: "1: 86 F, hip fracture after a fall – zopiclone, lorazepam, citalopram 40, oxybutynin + donepezil, amlodipine + furosemide, apixaban 5 BID, Na 128",
      build: (now) => ({ patient: pt(86, "female", "TEST, Hazel (made-up)"),
        conditions: [cond("Closed fracture of neck of right femur", "S72.001A"), cond("Fall from standing height", "W19"), cond("Atrial fibrillation", "I48.91"), cond("Hypertension", "I10"), cond("Alzheimer dementia, mild", "G30.9"), cond("Urge incontinence", "N39.41"), cond("Insomnia", "G47.00")],
        obs: [wt(now, 54), sbp(now, 104, 10), sbp(now, 128, 30), hr(now, 72, 10), lab(now, L.cr, "Creatinine", 118, "umol/L", 8), lab(now, L.egfr, "eGFR", 36, "mL/min/1.73m2", 8), lab(now, L.na, "Sodium", 128, "mmol/L", 8), lab(now, L.k, "Potassium", 4.1, "mmol/L", 8),
          lab(now, L.qtc, "QTc interval", 482, "ms", 20), lab(now, L.hb, "Hemoglobin", 98, "g/L", 8), lab(now, L.plt, "Platelets", 210, "10*9/L", 8)],
        medreqs: [req(now, "zopiclone 7.5 mg tablet", "7.5 mg PO at bedtime"), req(now, "lorazepam 0.5 mg tablet", "0.5 mg PO q6h PRN anxiety", true), req(now, "citalopram 40 mg tablet", "40 mg PO daily"), req(now, "oxybutynin 5 mg tablet", "5 mg PO BID"),
          req(now, "donepezil 10 mg tablet", "10 mg PO daily"), req(now, "amlodipine 10 mg tablet", "10 mg PO daily"), req(now, "furosemide 20 mg tablet", "20 mg PO daily"), req(now, "apixaban 5 mg tablet", "5 mg PO BID"),
          req(now, "pantoprazole 40 mg tablet", "40 mg PO daily"), req(now, "hydromorphone 1 mg tablet", "1 mg PO q4h regular"), req(now, "acetaminophen 1 g", "1 g PO QID"), req(now, "dimenhydrinate 25 mg", "25 mg PO q6h PRN nausea", true)] }),
      factors: { cfs: 5 } },
    { label: "2: 79 M, CKD (Cr 210) – metformin 1000 BID, glyburide, insulin with HbA1c 6.2, gabapentin 300 TID, ramipril + spironolactone with K 5.8, ibuprofen + furosemide",
      build: (now) => ({ patient: pt(79, "male", "TEST, Walter (made-up)"),
        conditions: [cond("Type 2 diabetes mellitus", "E11.9"), cond("Chronic kidney disease stage 4", "N18.4"), cond("Hypertension", "I10"), cond("Osteoarthritis of knee", "M17.9"), cond("Gout", "M10.9")],
        obs: [wt(now, 72), sbp(now, 132, 10), hr(now, 64, 10), lab(now, L.cr, "Creatinine", 210, "umol/L", 6), lab(now, L.egfr, "eGFR", 26, "mL/min/1.73m2", 6), lab(now, L.k, "Potassium", 5.8, "mmol/L", 6), lab(now, L.na, "Sodium", 136, "mmol/L", 6), lab(now, L.a1c, "Hemoglobin A1c", 6.2, "%", 24 * 20)],
        medreqs: [req(now, "metformin 1000 mg tablet", "1000 mg PO BID"), req(now, "glyburide 5 mg tablet", "5 mg PO BID"), req(now, "insulin glargine", "18 units subcut at bedtime"), req(now, "gabapentin 300 mg capsule", "300 mg PO TID"),
          req(now, "ramipril 10 mg capsule", "10 mg PO daily"), req(now, "spironolactone 25 mg tablet", "25 mg PO daily"), req(now, "ibuprofen 400 mg tablet", "400 mg PO TID"), req(now, "furosemide 40 mg tablet", "40 mg PO daily"),
          req(now, "allopurinol 300 mg tablet", "300 mg PO daily"), req(now, "atorvastatin 40 mg tablet", "40 mg PO daily"), req(now, "potassium chloride 20 mEq", "20 mEq PO daily")] }),
      factors: {} },
    { label: "3: 88 F, advanced dementia with delirium, CFS 7 – quetiapine, diphenhydramine, amitriptyline, tramadol + oxycodone + pregabalin, metoclopramide, TSH 0.05, statin",
      build: (now) => ({ patient: pt(88, "female", "TEST, Iris (made-up)"),
        conditions: [cond("Dementia, severe", "F03.C0"), cond("Delirium", "F05"), cond("Hypothyroidism", "E03.9"), cond("Chronic low back pain", "M54.50"), cond("Constipation", "K59.00")],
        obs: [wt(now, 47), sbp(now, 98, 8), hr(now, 66, 8), lab(now, L.cr, "Creatinine", 82, "umol/L", 10), lab(now, L.egfr, "eGFR", 54, "mL/min/1.73m2", 10), lab(now, L.na, "Sodium", 134, "mmol/L", 10), lab(now, L.tsh, "TSH", 0.05, "mU/L", 30)],
        medreqs: [req(now, "quetiapine 25 mg tablet", "25 mg PO at bedtime"), req(now, "diphenhydramine 25 mg", "25 mg PO at bedtime"), req(now, "amitriptyline 25 mg", "25 mg PO at bedtime"), req(now, "tramadol 50 mg", "50 mg PO QID"),
          req(now, "oxycodone 5 mg tablet", "5 mg PO q4h PRN pain", true), req(now, "pregabalin 75 mg capsule", "75 mg PO BID"), req(now, "metoclopramide 10 mg", "10 mg PO TID before meals"), req(now, "levothyroxine 150 mcg", "150 mcg PO daily"),
          req(now, "rosuvastatin 20 mg", "20 mg PO daily"), req(now, "alendronate 70 mg", "70 mg PO weekly"), req(now, "calcium carbonate 500 mg", "500 mg PO BID"), req(now, "donepezil 10 mg", "10 mg PO daily"), req(now, "ramipril 5 mg", "5 mg PO daily")] }),
      factors: { cfs: 7, goals: "limited" } },
    { label: "4: 76 M, AF + CAD (stent 4 years ago) – warfarin INR 4.6 + aspirin + clopidogrel + naproxen, sertraline, digoxin 0.25 with eGFR 28, metoprolol + diltiazem, HR 46",
      build: (now) => ({ patient: pt(76, "male", "TEST, Victor (made-up)"),
        conditions: [cond("Atrial fibrillation, permanent", "I48.21"), cond("Coronary artery disease, PCI 2022", "I25.10"), cond("Depression", "F32.9"), cond("Chronic kidney disease stage 4", "N18.4"), cond("Osteoarthritis", "M19.90")],
        obs: [wt(now, 80), sbp(now, 112, 6), hr(now, 46, 6), hr(now, 58, 30), lab(now, L.cr, "Creatinine", 205, "umol/L", 6), lab(now, L.egfr, "eGFR", 28, "mL/min/1.73m2", 6), lab(now, L.k, "Potassium", 3.3, "mmol/L", 6), lab(now, L.inr, "INR", 4.6, "", 6), lab(now, L.plt, "Platelets", 180, "10*9/L", 6)],
        medreqs: [req(now, "warfarin 5 mg", "5 mg PO daily"), req(now, "aspirin 81 mg", "81 mg PO daily"), req(now, "clopidogrel 75 mg", "75 mg PO daily"), req(now, "naproxen 500 mg", "500 mg PO BID"), req(now, "sertraline 100 mg", "100 mg PO daily"),
          req(now, "digoxin 0.25 mg", "0.25 mg PO daily"), req(now, "metoprolol 50 mg", "50 mg PO BID"), req(now, "diltiazem CD 180 mg", "180 mg PO daily"), req(now, "furosemide 40 mg", "40 mg PO daily"), req(now, "atorvastatin 80 mg", "80 mg PO daily")] }),
      factors: {} },
    { label: "5: 71 F, well-chosen list – metformin, empagliflozin, perindopril, rosuvastatin, apixaban 5 BID for AF (few or no flags expected)",
      build: (now) => ({ patient: pt(71, "female", "TEST, Joy (made-up)"),
        conditions: [cond("Type 2 diabetes mellitus", "E11.9"), cond("Atrial fibrillation", "I48.91"), cond("Hypertension", "I10"), cond("Hyperlipidemia", "E78.5")],
        obs: [wt(now, 74), sbp(now, 126, 6), hr(now, 72, 6), lab(now, L.cr, "Creatinine", 78, "umol/L", 6), lab(now, L.egfr, "eGFR", 68, "mL/min/1.73m2", 6), lab(now, L.k, "Potassium", 4.4, "mmol/L", 6), lab(now, L.na, "Sodium", 139, "mmol/L", 6), lab(now, L.a1c, "HbA1c", 7.3, "%", 24 * 30)],
        medreqs: [req(now, "metformin 500 mg", "500 mg PO BID"), req(now, "empagliflozin 10 mg", "10 mg PO daily"), req(now, "perindopril 4 mg", "4 mg PO daily"), req(now, "rosuvastatin 10 mg", "10 mg PO daily"), req(now, "apixaban 5 mg", "5 mg PO BID")] }),
      factors: {} }];

  if (typeof module !== "undefined" && module.exports) module.exports = SAMPLES; else window.DEPRX_SAMPLES = SAMPLES;
})();
