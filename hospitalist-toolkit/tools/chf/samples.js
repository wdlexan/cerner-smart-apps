/* MADE-UP patients for testing the heart failure tab. Times are relative to "now" (h = hours ago). None of these are real people. */
(function () {
  const iso = (now, h) => new Date(now - h * 36e5).toISOString();
  const ob = (cat) => (now, loinc, disp, val, unit, h) => ({ resourceType: "Observation", status: "final", category: [{ coding: [{ code: cat }] }],
    code: { coding: loinc ? [{ system: "http://loinc.org", code: loinc, display: disp }] : [], text: disp }, effectiveDateTime: iso(now, h), valueQuantity: { value: val, unit } });
  const lab = ob("laboratory"), vit = ob("vital-signs");
  const series = (now, loinc, disp, unit, pts, f) => pts.map(([h, v]) => (f || lab)(now, loinc, disp, v, unit, h));
  const wts = (now, pts) => series(now, "29463-7", "Weight", "kg", pts, vit);
  const vs = (now, rows) => [].concat(...rows.map(([h, hr, s, d, sat]) => [vit(now, "8867-4", "Heart rate", hr, "/min", h), vit(now, "8480-6", "Systolic BP", s, "mm[Hg]", h), vit(now, "8462-4", "Diastolic BP", d, "mm[Hg]", h), vit(now, "59408-5", "SpO2", sat, "%", h)]));
  const req = (name, status) => ({ resourceType: "MedicationRequest", status: status || "active", medicationCodeableConcept: { text: name } });
  const adm = (now, name, h) => ({ resourceType: "MedicationAdministration", status: "completed", medicationCodeableConcept: { text: name }, effectiveDateTime: iso(now, h) });
  const cond = (text, code) => ({ resourceType: "Condition", clinicalStatus: { coding: [{ code: "active" }] }, code: { coding: [{ system: "http://hl7.org/fhir/sid/icd-10", code }], text } });
  const pt = (age, gender) => ({ resourceType: "Patient", gender, birthDate: new Date(Date.now() - age * 365.25 * 864e5 - 30 * 864e5).toISOString().slice(0, 10) });
  const ht = (now, cm) => vit(now, "8302-2", "Height", cm, "cm", 90);

  window.CHF_SAMPLES = [
    { label: "A: 82 M, HFpEF, AF, slow diuresis on furosemide 40 IV BID, carpal tunnel + spinal stenosis (amyloid?)", sit: { ef: "pres", dry: 72, homePO: 40, una: 38, cong: ["orth", "jvp", "edema"], flags: { lvh: true, lowvolt: true, intol: true } },
      build: (now) => ({ patient: pt(82, "male"),
        conditions: [cond("Heart failure with preserved ejection fraction", "I50.30"), cond("Atrial fibrillation", "I48.91"), cond("Chronic kidney disease stage 3", "N18.3"), cond("Bilateral carpal tunnel syndrome", "G56.03"), cond("Lumbar spinal stenosis", "M48.06"), cond("Aortic stenosis, moderate", "I35.0")],
        obs: [].concat(wts(now, [[72, 79.0], [48, 78.6], [24, 78.4], [2, 78.1]]), [ht(now, 176)],
          series(now, "33762-6", "NT-proBNP", "ng/L", [[74, 6800], [4, 5900]]), series(now, "2160-0", "Creatinine", "umol/L", [[74, 121], [26, 130], [4, 138]]),
          series(now, "2823-3", "Potassium", "mmol/L", [[4, 3.6]]), series(now, "2951-2", "Sodium", "mmol/L", [[4, 136]]), series(now, "19123-9", "Magnesium", "mmol/L", [[4, 0.72]]),
          series(now, "1963-8", "Bicarbonate", "mmol/L", [[4, 29]]), series(now, "33914-3", "eGFR", "mL/min/1.73m2", [[4, 42]]), series(now, "718-7", "Hemoglobin", "g/L", [[4, 112]]),
          series(now, "2276-4", "Ferritin", "ug/L", [[60, 62]]), series(now, "2502-3", "Iron saturation", "%", [[60, 14]]), series(now, "89579-7", "Troponin I hs", "ng/L", [[74, 48], [66, 51]]),
          series(now, "3016-3", "TSH", "mU/L", [[70, 2.1]]), vs(now, [[24, 84, 108, 64, 93], [2, 88, 104, 62, 94]])),
        medreqs: [req("furosemide 40 mg IV BID"), req("apixaban 5 mg PO BID"), req("bisoprolol 2.5 mg PO daily"), req("amlodipine 5 mg PO daily"), req("naproxen 250 mg PO BID PRN")],
        admins: [adm(now, "furosemide 40 mg IV", 22), adm(now, "furosemide 40 mg IV", 10)] }) },
    { label: "B: 64 M, ischemic HFrEF (EF 25%), day 4, down 7 kg, NT-proBNP falling: ready for oral?", sit: { ef: "low", dry: 89, homePO: 40, cong: [], ready: true },
      build: (now) => ({ patient: pt(64, "male"),
        conditions: [cond("Heart failure with reduced ejection fraction", "I50.22"), cond("Coronary artery disease, prior MI", "I25.2"), cond("Type 2 diabetes", "E11.9"), cond("Hypertension", "I10")],
        obs: [].concat(wts(now, [[96, 96.2], [72, 94.1], [48, 92.0], [24, 90.3], [2, 89.4]]), [ht(now, 180)],
          series(now, "33762-6", "NT-proBNP", "ng/L", [[98, 9800], [4, 3900]]), series(now, "2160-0", "Creatinine", "umol/L", [[98, 104], [50, 116], [4, 112]]),
          series(now, "2823-3", "Potassium", "mmol/L", [[28, 4.1], [4, 4.3]]), series(now, "2951-2", "Sodium", "mmol/L", [[4, 137]]), series(now, "19123-9", "Magnesium", "mmol/L", [[4, 0.86]]),
          series(now, "33914-3", "eGFR", "mL/min/1.73m2", [[4, 62]]), series(now, "718-7", "Hemoglobin", "g/L", [[4, 131]]), series(now, "2276-4", "Ferritin", "ug/L", [[90, 240]]), series(now, "2502-3", "Iron saturation", "%", [[90, 24]]),
          series(now, "4548-4", "Hemoglobin A1c", "%", [[90, 7.6]]), vs(now, [[24, 76, 118, 70, 96], [2, 72, 116, 68, 97]])),
        medreqs: [req("furosemide 80 mg IV BID"), req("bisoprolol 2.5 mg PO daily"), req("ramipril 2.5 mg PO daily"), req("atorvastatin 80 mg PO daily"), req("aspirin 81 mg PO daily"), req("metformin 500 mg PO BID")],
        admins: [adm(now, "furosemide 80 mg IV", 20), adm(now, "furosemide 80 mg IV", 8)] }) },
    { label: "C: 46 M, new heart failure, heavy alcohol use, NT-proBNP 2400, no diuretic yet", sit: { ef: "unknown", dry: null, homePO: 0, cong: ["orth", "jvp", "edema", "crackles", "o2"] },
      build: (now) => ({ patient: pt(46, "male"),
        conditions: [cond("Alcohol use disorder", "F10.20"), cond("Shortness of breath", "R06.02")],
        obs: [].concat(wts(now, [[3, 101.5]]), [ht(now, 178)], series(now, "33762-6", "NT-proBNP", "ng/L", [[3, 2400]]), series(now, "2160-0", "Creatinine", "umol/L", [[3, 88]]),
          series(now, "2823-3", "Potassium", "mmol/L", [[3, 3.9]]), series(now, "2951-2", "Sodium", "mmol/L", [[3, 133]]), series(now, "33914-3", "eGFR", "mL/min/1.73m2", [[3, 92]]),
          series(now, "89579-7", "Troponin I hs", "ng/L", [[3, 22], [1, 24]]), series(now, "718-7", "Hemoglobin", "g/L", [[3, 128]]), vs(now, [[3, 112, 132, 88, 89]])),
        medreqs: [req("thiamine 100 mg PO daily"), req("oxygen 2 L/min nasal prongs")], admins: [] }) },
    { label: "D: 79 F, COPD flare, BMI 36, NT-proBNP 640: is it heart failure?", sit: { ef: "unknown", dry: null, homePO: 0, cong: ["o2"] },
      build: (now) => ({ patient: pt(79, "female"),
        conditions: [cond("COPD with acute exacerbation", "J44.1"), cond("Obesity", "E66.9"), cond("Hypertension", "I10"), cond("Obstructive sleep apnea", "G47.33")],
        obs: [].concat(wts(now, [[6, 98]]), [ht(now, 165)], series(now, "33762-6", "NT-proBNP", "ng/L", [[6, 640]]), series(now, "2160-0", "Creatinine", "umol/L", [[6, 78]]),
          series(now, "2823-3", "Potassium", "mmol/L", [[6, 4.2]]), series(now, "33914-3", "eGFR", "mL/min/1.73m2", [[6, 64]]), vs(now, [[6, 96, 148, 82, 88]])),
        medreqs: [req("prednisone 40 mg PO daily"), req("salbutamol 2.5 mg neb q4h"), req("ipratropium 500 mcg neb q6h"), req("amlodipine 10 mg PO daily")], admins: [] }) }];
})();
