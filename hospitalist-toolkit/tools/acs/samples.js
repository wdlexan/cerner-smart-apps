/* MADE-UP patients for testing the NSTEMI tab. Times are relative to "now" (h = hours ago). None of these are real people. */
(function () {
  const iso = (now, h) => new Date(now - h * 36e5).toISOString();
  const ob = (cat) => (now, loinc, disp, val, unit, h) => ({ resourceType: "Observation", status: "final", category: [{ coding: [{ code: cat }] }],
    code: { coding: loinc ? [{ system: "http://loinc.org", code: loinc, display: disp }] : [], text: disp }, effectiveDateTime: iso(now, h), valueQuantity: { value: val, unit } });
  const lab = ob("laboratory"), vit = ob("vital-signs");
  const series = (now, loinc, disp, unit, pts) => pts.map(([h, v]) => lab(now, loinc, disp, v, unit, h));
  const trop = (now, pts) => series(now, "89579-7", "Troponin I high sensitivity", "ng/L", pts);
  const vs = (now, rows) => [].concat(...rows.map(([h, hr, s, d, sat]) => [vit(now, "8867-4", "Heart rate", hr, "/min", h), vit(now, "8480-6", "Systolic BP", s, "mm[Hg]", h), vit(now, "8462-4", "Diastolic BP", d, "mm[Hg]", h), vit(now, "59408-5", "SpO2", sat, "%", h)]));
  const wt = (now, kg) => vit(now, "29463-7", "Weight", kg, "kg", 20);
  const req = (name, status) => ({ resourceType: "MedicationRequest", status: status || "active", medicationCodeableConcept: { text: name } });
  const cond = (text, code) => ({ resourceType: "Condition", clinicalStatus: { coding: [{ code: "active" }] }, code: { coding: [{ system: "http://hl7.org/fhir/sid/icd-10", code }], text } });
  const pt = (age, gender) => ({ resourceType: "Patient", gender, birthDate: new Date(Date.now() - age * 365.25 * 864e5 - 30 * 864e5).toISOString().slice(0, 10) });
  const basic = (now, o) => [].concat(series(now, "718-7", "Hemoglobin", "g/L", o.hb), series(now, "777-3", "Platelets", "10*9/L", [[6, o.plt]]), series(now, "2160-0", "Creatinine", "umol/L", [[6, o.cr]]),
    series(now, "33914-3", "eGFR", "mL/min/1.73m2", [[6, o.egfr]]), series(now, "2823-3", "Potassium", "mmol/L", [[6, o.k]]), series(now, "19123-9", "Magnesium", "mmol/L", [[6, o.mg]]));

  window.ACS_SAMPLES = [
    { label: "A: 66 M, chest pain at rest, ST depression V4-V6, hs-TnI 34 → 410 → 1650, diabetes (classic type 1 NSTEMI)",
      sit: { symptoms: true, ecgIsch: true, stDev: true, dynamicST: true, killip: 1, frail: 3, managed: "pending" },
      build: (now) => ({ patient: pt(66, "male"),
        conditions: [cond("Type 2 diabetes mellitus", "E11.9"), cond("Hypertension", "I10"), cond("Dyslipidemia", "E78.5"), cond("Tobacco use", "F17.210")],
        obs: [].concat(trop(now, [[9, 34], [7, 410], [2, 1650]]), basic(now, { hb: [[8, 142]], plt: 238, cr: 96, egfr: 74, k: 3.8, mg: 0.82 }), [wt(now, 88)],
          series(now, "13457-7", "LDL cholesterol", "mmol/L", [[6, 3.4]]), series(now, "4548-4", "Hemoglobin A1c", "%", [[6, 8.1]]), vs(now, [[8, 92, 158, 92, 96], [2, 84, 142, 84, 97]])),
        medreqs: [req("aspirin 81 mg PO daily"), req("enoxaparin 90 mg SC q12h"), req("ticagrelor 90 mg PO BID"), req("atorvastatin 40 mg PO daily"), req("metformin 1000 mg PO BID"), req("ramipril 5 mg PO daily"), req("nitroglycerin 0.4 mg SL q5min PRN chest pain")], admins: [] }) },
    { label: "B: 87 F, frail (CFS 7), dementia, AF on apixaban, eGFR 26, hs-TnI 60 → 240, ECG T inversion",
      sit: { symptoms: true, ecgIsch: true, killip: 2, frail: 7, dementia: true, managed: "pending" },
      build: (now) => ({ patient: pt(87, "female"),
        conditions: [cond("Atrial fibrillation", "I48.91"), cond("Alzheimer dementia, moderate", "G30.1"), cond("Chronic kidney disease stage 4", "N18.4"), cond("Hypertension", "I10"), cond("Frailty", "R54")],
        obs: [].concat(trop(now, [[14, 60], [10, 152], [3, 240]]), basic(now, { hb: [[8, 104]], plt: 188, cr: 158, egfr: 26, k: 4.6, mg: 0.9 }), [wt(now, 52)], vs(now, [[8, 88, 134, 70, 94], [2, 82, 128, 66, 95]])),
        medreqs: [req("apixaban 2.5 mg PO BID"), req("aspirin 81 mg PO daily"), req("metoprolol 12.5 mg PO BID"), req("donepezil 10 mg PO daily"), req("omeprazole 20 mg PO daily")], admins: [] }) },
    { label: "C: 79 M, pneumonia + sepsis, AF with RVR 140s, Hb 76, hs-TnI 48 → 132, no ECG ischemia, ticagrelor ordered (type 2 MI)",
      sit: { symptoms: false, ecgIsch: false, killip: 1, frail: 5, triggers: ["anemia", "tachy", "sepsis"], managed: "pending" },
      build: (now) => ({ patient: pt(79, "male"),
        conditions: [cond("Community-acquired pneumonia", "J18.9"), cond("Sepsis", "A41.9"), cond("Atrial fibrillation with rapid ventricular response", "I48.91"), cond("Iron deficiency anemia", "D50.9")],
        obs: [].concat(trop(now, [[20, 48], [14, 96], [4, 132]]), basic(now, { hb: [[30, 82], [6, 76]], plt: 312, cr: 132, egfr: 46, k: 3.4, mg: 0.66 }), [wt(now, 74)], series(now, "2524-7", "Lactate", "mmol/L", [[18, 3.1]]),
          vs(now, [[12, 142, 102, 60, 89], [3, 128, 108, 62, 92]])),
        medreqs: [req("ceftriaxone 1 g IV q24h"), req("azithromycin 500 mg PO daily"), req("aspirin 81 mg PO daily"), req("ticagrelor 90 mg PO BID"), req("enoxaparin 40 mg SC daily")], admins: [] }) },
    { label: "D: 61 M, NSTEMI day 2 after angiography: 3-vessel disease, diabetes, LVEF 35%, SYNTAX 28, on ticagrelor (CABG?)",
      sit: { symptoms: true, ecgIsch: true, stDev: true, killip: 1, frail: 2, lvef: 35, anatomy: "3v", proxLAD: true, syntax: 28, managed: "cabg", angioThrombus: true },
      build: (now) => ({ patient: pt(61, "male"),
        conditions: [cond("Type 2 diabetes mellitus", "E11.9"), cond("Hypertension", "I10"), cond("Obesity", "E66.9")],
        obs: [].concat(trop(now, [[40, 120], [34, 2400], [10, 1800]]), basic(now, { hb: [[30, 139], [6, 134]], plt: 220, cr: 88, egfr: 88, k: 4.2, mg: 0.85 }), [wt(now, 102)],
          series(now, "13457-7", "LDL cholesterol", "mmol/L", [[30, 2.6]]), series(now, "4548-4", "Hemoglobin A1c", "%", [[30, 9.2]]), vs(now, [[8, 76, 126, 74, 96]])),
        medreqs: [req("aspirin 81 mg PO daily"), req("ticagrelor 90 mg PO BID"), req("atorvastatin 80 mg PO daily"), req("metoprolol 25 mg PO BID"), req("heparin infusion per ACS nomogram"), req("insulin glargine 30 units SC qhs"), req("sildenafil 50 mg PO PRN")], admins: [] }) },
    { label: "E: 72 M, ongoing chest pain, SBP 86, HR 112, crackles to mid-zones (Killip 3), hs-TnI 1200 → 9800 (very high risk)",
      sit: { symptoms: true, ecgIsch: true, stDev: true, dynamicST: true, killip: 3, frail: 3, vh: ["shock", "refractory", "ahf"], managed: "pending" },
      build: (now) => ({ patient: pt(72, "male"),
        conditions: [cond("Coronary artery disease with prior stent", "I25.10"), cond("Hypertension", "I10"), cond("COPD", "J44.9")],
        obs: [].concat(trop(now, [[4, 1200], [1, 9800]]), basic(now, { hb: [[3, 128]], plt: 205, cr: 141, egfr: 44, k: 4.9, mg: 0.8 }), [wt(now, 80)], series(now, "2524-7", "Lactate", "mmol/L", [[1, 3.8]]),
          vs(now, [[3, 104, 98, 60, 91], [0.5, 112, 86, 54, 88]])),
        medreqs: [req("aspirin 81 mg PO daily"), req("heparin infusion per ACS nomogram"), req("furosemide 40 mg IV BID"), req("metoprolol 25 mg PO BID"), req("atorvastatin 80 mg PO daily")], admins: [] }) },
    { label: "F: 70 F, NSTEMI, prior ischemic stroke 2 y ago, GI bleed 8 months ago, on clarithromycin, LVEF 55%, single-vessel stent done",
      sit: { symptoms: true, ecgIsch: true, killip: 1, frail: 4, lvef: 55, anatomy: "1v", culpritPCI: true, managed: "pci", angioThrombus: true, bleed12: true },
      build: (now) => ({ patient: pt(70, "female"),
        conditions: [cond("History of ischemic stroke", "Z86.73"), cond("Upper GI bleed, duodenal ulcer", "K26.4"), cond("Hypertension", "I10"), cond("Rheumatoid arthritis", "M06.9")],
        obs: [].concat(trop(now, [[30, 88], [24, 740], [6, 520]]), basic(now, { hb: [[30, 118], [6, 114]], plt: 260, cr: 92, egfr: 54, k: 4.1, mg: 0.84 }), [wt(now, 58)],
          series(now, "13457-7", "LDL cholesterol", "mmol/L", [[28, 2.1]]), vs(now, [[6, 68, 132, 76, 97]])),
        medreqs: [req("aspirin 81 mg PO daily"), req("ticagrelor 90 mg PO BID"), req("clarithromycin 500 mg PO BID"), req("simvastatin 40 mg PO daily"), req("naproxen 500 mg PO BID"), req("prednisone 5 mg PO daily")], admins: [] }) }];
})();
