/* MADE-UP patients for testing the Discharge tab. Times are relative to "now" (h = hours ago). None of these are real people. */
(function () {
  const iso = (now, h) => new Date(now - h * 36e5).toISOString();
  const ob = (cat) => (now, loinc, disp, val, unit, h, status) => ({ resourceType: "Observation", status: status || "final", category: [{ coding: [{ code: cat }] }],
    code: { coding: loinc ? [{ system: "http://loinc.org", code: loinc, display: disp }] : [], text: disp }, effectiveDateTime: iso(now, h), valueQuantity: val == null ? undefined : { value: val, unit } });
  const lab = ob("laboratory"), vit = ob("vital-signs");
  const series = (now, loinc, disp, unit, pts, f) => pts.map(([h, v]) => (f || lab)(now, loinc, disp, v, unit, h));
  const cat = (c) => [{ coding: [{ system: "http://terminology.hl7.org/CodeSystem/medicationrequest-category", code: c }] }];
  const rq = (name, c, status) => ({ resourceType: "MedicationRequest", status: status || "active", intent: "order", category: cat(c || "inpatient"), medicationCodeableConcept: { text: name } });
  const home = (name) => ({ resourceType: "MedicationStatement", status: "active", medicationCodeableConcept: { text: name } });
  const cond = (text, code, h, now) => ({ resourceType: "Condition", clinicalStatus: { coding: [{ code: "active" }] }, code: { coding: [{ system: "http://hl7.org/fhir/sid/icd-10", code }], text }, recordedDate: h != null ? iso(now, h) : undefined });
  const pt = (age, gender) => ({ resourceType: "Patient", gender, birthDate: new Date(Date.now() - age * 365.25 * 864e5 - 30 * 864e5).toISOString().slice(0, 10) });
  const enc = (now, h) => ({ resourceType: "Encounter", status: "in-progress", class: { code: "IMP" }, period: { start: iso(now, h) } });
  const rep = (now, name, status, h, conclusion, c, id) => ({ resourceType: "DiagnosticReport", id: id || name.replace(/\W+/g, "-").toLowerCase(), status, code: { text: name }, category: [{ text: c || "Radiology" }], effectiveDateTime: iso(now, h), conclusion });
  const sr = (now, name, h, c, id) => ({ resourceType: "ServiceRequest", id, status: "active", intent: "order", code: { text: name }, category: [{ text: c || "Laboratory" }], authoredOn: iso(now, h) });

  window.DC_SAMPLES = [
    { label: "A: 79 F, heart failure + new AF (apixaban started), lung nodule on CT, echo pending", v: { dry: 79.5, fpDays: 7, ptReason: "heart failure (fluid on the lungs) and a new irregular heart rhythm (atrial fibrillation)" },
      build: (now) => ({ patient: pt(79, "female"), encounters: [enc(now, 120)],
        conditions: [cond("Heart failure with preserved ejection fraction", "I50.30", 118, now), cond("Atrial fibrillation", "I48.91", 110, now), cond("Hypertension", "I10"), cond("Osteoarthritis of knee", "M17.9")],
        obs: [].concat(series(now, "29463-7", "Weight", "kg", [[118, 84.1], [72, 82.0], [24, 80.2], [3, 79.5]], vit), series(now, "33762-6", "NT-proBNP", "ng/L", [[118, 8400], [20, 3100]]),
          series(now, "2160-0", "Creatinine", "umol/L", [[118, 98], [48, 118], [6, 124]]), series(now, "2823-3", "Potassium", "mmol/L", [[118, 4.1], [6, 4.6]]), series(now, "2951-2", "Sodium", "mmol/L", [[118, 136], [6, 135]]),
          series(now, "718-7", "Hemoglobin", "g/L", [[118, 118], [6, 112]]), series(now, "33914-3", "eGFR", "mL/min/1.73m2", [[118, 50], [6, 38]]),
          [lab(now, "3016-3", "TSH", null, "", 30, "registered")]),
        medstatements: [home("furosemide 20 mg PO daily"), home("metoprolol 25 mg PO BID"), home("ramipril 5 mg PO daily"), home("naproxen 250 mg PO BID PRN knee pain"), home("ASA 81 mg PO daily")],
        medreqs: [rq("furosemide 40 mg PO BID"), rq("metoprolol 50 mg PO BID"), rq("ramipril 5 mg PO daily"), rq("apixaban 5 mg PO BID"), rq("dapagliflozin 10 mg PO daily"), rq("heparin 5,000 units SC q12h", "inpatient", "stopped"), rq("senna 8.6 mg PO qhs PRN")],
        reports: [rep(now, "CT chest (PE protocol)", "final", 116, "No pulmonary embolism. Bilateral small pleural effusions and interlobular septal thickening in keeping with pulmonary edema. Incidental 7 mm solid nodule in the right upper lobe. Recommend follow-up CT chest in 6 to 12 months per Fleischner Society guidelines. No suspicious mass in the mediastinum."),
          rep(now, "Echocardiogram (transthoracic)", "registered", 20, "", "Cardiology"), rep(now, "Chest X-ray", "final", 118, "Cardiomegaly with vascular congestion. No pneumothorax.")],
        orders: [],
        notes: [{ name: "Progress note", t: now - 6 * 36e5, text: "Day 5. Euvolemic, weight 79.5 kg.\nPlan:\n1. Refer to heart function clinic in 4 to 6 weeks.\n2. Repeat electrolytes and creatinine in 1 week.\n3. Outpatient Holter monitor to assess rate control.\n4. No need for GI follow-up." }] }) },
    { label: "B: 71 M, pneumonia + COPD, insulin started, gliclazide stopped for lows, blood culture pending", v: { abxEnd: "", fpDays: 7, ptReason: "pneumonia (a lung infection) and a COPD flare" },
      build: (now) => ({ patient: pt(71, "male"), encounters: [enc(now, 96)],
        conditions: [cond("Community-acquired pneumonia, right lower lobe", "J18.1", 94, now), cond("COPD with acute exacerbation", "J44.1", 94, now), cond("Type 2 diabetes", "E11.9"), cond("Current smoker", "F17.210")],
        obs: [].concat(series(now, "6690-2", "WBC", "x10^9/L", [[94, 15.4], [8, 9.1]]), series(now, "1988-5", "C reactive protein", "mg/L", [[94, 182], [8, 41]]), series(now, "2160-0", "Creatinine", "umol/L", [[94, 88], [8, 84]]),
          series(now, "4548-4", "Hemoglobin A1c", "%", [[90, 8.9]]), [lab(now, "", "Legionella urine antigen", null, "", 90, "registered")]),
        medstatements: [home("gliclazide MR 60 mg PO daily"), home("metformin 1000 mg PO BID"), home("tiotropium 18 mcg inhaled daily"), home("salbutamol 100 mcg 2 puffs inhaled q4h PRN")],
        medreqs: [rq("amoxicillin-clavulanate 875 mg PO BID"), rq("prednisone 40 mg PO daily"), rq("insulin glargine 14 units SC qhs"), rq("metformin 1000 mg PO BID"), rq("tiotropium 18 mcg inhaled daily"), rq("salbutamol 100 mcg 2 puffs inhaled q4h PRN"), rq("ceftriaxone 1 g IV q24h", "inpatient", "completed"), rq("nicotine patch 21 mg/24 h daily")],
        reports: [rep(now, "Blood culture x2", "preliminary", 92, "No growth to date at 48 hours. Final report to follow at 5 days.", "Microbiology", "bc1"),
          rep(now, "Chest X-ray", "final", 95, "Right lower lobe consolidation in keeping with pneumonia. Recommend follow-up chest radiograph in 6 to 8 weeks to document resolution. Hyperinflation.")],
        orders: [sr(now, "Sputum culture", 93, "Microbiology", "s1"), sr(now, "Blood culture x2", 92, "Microbiology", "bc-order")],
        notes: [{ name: "Progress note", t: now - 20 * 36e5, text: "Day 4. Afebrile. Sputum culture pending. Plan: switch to oral antibiotics, home tomorrow if stable." }] }) },
    { label: "C: 86 F, hip fracture repaired, delirium (lorazepam stopped), hydromorphone, T12 fracture on X-ray", v: { fpDays: 14, wb: "full weight bearing as tolerated", vteWeeks: "4", ptReason: "a broken hip that was repaired with surgery" },
      build: (now) => ({ patient: pt(86, "female"), encounters: [enc(now, 168)],
        conditions: [cond("Fracture of neck of right femur", "S72.001A", 166, now), cond("Delirium due to known physiological condition", "F05", 120, now), cond("Fall from same level", "W18.30XA", 166, now), cond("Hypertension", "I10")],
        obs: [].concat(series(now, "718-7", "Hemoglobin", "g/L", [[166, 128], [120, 96], [10, 94]]), series(now, "2160-0", "Creatinine", "umol/L", [[166, 71], [10, 68]]), series(now, "2951-2", "Sodium", "mmol/L", [[166, 139], [10, 134]])),
        medstatements: [home("amlodipine 5 mg PO daily"), home("lorazepam 1 mg PO qhs"), home("vitamin D 1,000 units PO daily")],
        medreqs: [rq("amlodipine 5 mg PO daily", "discharge"), rq("vitamin D 1,000 units PO daily", "discharge"), rq("enoxaparin 40 mg SC daily for 4 weeks", "discharge"), rq("hydromorphone 1 mg PO q4h PRN pain", "discharge"), rq("acetaminophen 1 g PO QID", "discharge"), rq("polyethylene glycol 17 g PO daily", "discharge"),
          rq("hydromorphone 0.5 mg SC q2h PRN"), rq("lorazepam 1 mg PO qhs", "inpatient", "stopped")],
        reports: [rep(now, "Chest X-ray (pre-op)", "final", 165, "No acute cardiopulmonary process. Moderate compression fracture of the T12 vertebral body, age indeterminate. Recommend clinical correlation and assessment for osteoporosis."),
          rep(now, "X-ray right hip", "final", 166, "Displaced subcapital fracture of the right femoral neck.")],
        orders: [] }) }];
})();
