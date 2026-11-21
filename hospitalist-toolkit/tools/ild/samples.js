/* MADE-UP patients for testing the ILD tab. Times relative to "now" (h = hours ago). None are real people. */
(function () {
  const iso = (now, h) => new Date(now - h * 36e5).toISOString();
  const lab = (now, loinc, disp, val, unit, h) => ({ resourceType: "Observation", status: "final", category: [{ coding: [{ code: "laboratory" }] }],
    code: { coding: [{ system: "http://loinc.org", code: loinc, display: disp }], text: disp }, effectiveDateTime: iso(now, h), valueQuantity: { value: val, unit } });
  const txt = (now, disp, val, h) => ({ resourceType: "Observation", status: "final", category: [{ coding: [{ code: "laboratory" }] }], code: { text: disp }, effectiveDateTime: iso(now, h), valueString: val });
  const vs = (now, loinc, disp, val, unit, h) => ({ resourceType: "Observation", status: "final", category: [{ coding: [{ code: "vital-signs" }] }],
    code: { coding: [{ system: "http://loinc.org", code: loinc, display: disp }], text: disp }, effectiveDateTime: iso(now, h), valueQuantity: { value: val, unit } });
  const spo2 = (now, v, h) => vs(now, "59408-5", "SpO2", v, "%", h), flow = (now, v, h) => vs(now, "3151-8", "Oxygen flow rate", v, "L/min", h);
  const req = (now, name, h) => ({ resourceType: "MedicationRequest", status: "active", medicationCodeableConcept: { text: name }, authoredOn: iso(now, h || 24) });
  const cond = (text, code) => ({ resourceType: "Condition", clinicalStatus: { coding: [{ code: "active" }] }, code: { coding: [{ system: "http://hl7.org/fhir/sid/icd-10", code }], text } });
  const rep = (now, name, concl, h) => ({ resourceType: "DiagnosticReport", status: "final", code: { text: name }, conclusion: concl, effectiveDateTime: iso(now, h) });
  const pt = (age, gender, name) => ({ resourceType: "Patient", gender, name: [{ text: name }], birthDate: new Date(Date.now() - age * 365.25 * 864e5 - 30 * 864e5).toISOString().slice(0, 10) });

  const SAMPLES = [
    { label: "A: 76 M, IPF on nintedanib, O2 2 → 6 L in 2 days, CT new bilateral ground glass on UIP, procalcitonin low, apixaban",
      build: (now) => ({ patient: pt(76, "male", "TEST, Alpha (made-up)"),
        conditions: [cond("Idiopathic pulmonary fibrosis", "J84.112"), cond("Atrial fibrillation", "I48.91"), cond("GERD", "K21.9")],
        obs: [flow(now, 2, 60), flow(now, 4, 30), flow(now, 6, 4), spo2(now, 93, 60), spo2(now, 86, 6), spo2(now, 90, 3),
          lab(now, "33959-8", "Procalcitonin", 0.08, "ug/L", 8), lab(now, "33762-6", "NT-proBNP", 640, "ng/L", 8), lab(now, "1988-5", "CRP", 48, "mg/L", 8), lab(now, "2532-0", "LDH", 390, "U/L", 8), lab(now, "1742-6", "ALT", 32, "U/L", 8)],
        medreqs: [req(now, "nintedanib 150 mg PO BID", 9000), req(now, "apixaban 5 mg PO BID", 9000), req(now, "pantoprazole 40 mg PO daily", 9000)],
        reports: [rep(now, "CT Chest (CTPA)", "No pulmonary embolism. New bilateral ground-glass opacities superimposed on subpleural basal reticulation, traction bronchiectasis and honeycombing (UIP pattern).", 10),
          rep(now, "HRCT Chest", "Subpleural basal-predominant reticulation with honeycombing and traction bronchiectasis, UIP pattern.", 24 * 300)] }) },
    { label: "B: 68 F, no known ILD, on amiodarone and long-term nitrofurantoin; CT new ground glass and reticulation; eosinophils 0.6",
      build: (now) => ({ patient: pt(68, "female", "TEST, Bravo (made-up)"),
        conditions: [cond("Atrial fibrillation", "I48.91"), cond("Recurrent urinary tract infection", "N39.0"), cond("Dyspnea", "R06.00")],
        obs: [flow(now, 1, 50), flow(now, 2, 5), spo2(now, 89, 6), lab(now, "711-2", "Eosinophils absolute", 0.6, "10*9/L", 6), lab(now, "1742-6", "ALT", 45, "U/L", 6)],
        medreqs: [req(now, "amiodarone 200 mg PO daily", 8000), req(now, "nitrofurantoin 50 mg PO at bedtime (prophylaxis)", 9000), req(now, "warfarin 3 mg PO daily", 8000)],
        reports: [rep(now, "CT Chest", "Bilateral peripheral ground-glass opacities and fine reticulation, new since 2 years ago. Differential includes drug-related pneumonitis or NSIP.", 12)] }) },
    { label: "C: 58 F, rheumatoid arthritis on methotrexate 8 months, new ILD on CT, no serology in chart",
      build: (now) => ({ patient: pt(58, "female", "TEST, Charlie (made-up)"),
        conditions: [cond("Rheumatoid arthritis", "M06.9"), cond("Interstitial lung disease", "J84.9")],
        obs: [spo2(now, 90, 5), flow(now, 2, 5), lab(now, "1988-5", "CRP", 32, "mg/L", 6), lab(now, "6690-2", "WBC", 9.8, "10*9/L", 6)],
        medreqs: [req(now, "methotrexate 20 mg PO weekly", 5800), req(now, "folic acid 5 mg PO weekly", 5800), req(now, "prednisone 5 mg PO daily", 5800)],
        reports: [rep(now, "HRCT Chest", "Bilateral lower-lobe ground glass with reticulation and subpleural sparing, NSIP pattern.", 20)] }) },
    { label: "D: 49 M, new rapidly worsening ILD, CK 2400, ferritin 3200, mechanic's hands (anti-synthetase / MDA5?)",
      build: (now) => ({ patient: pt(49, "male", "TEST, Delta (made-up)"),
        conditions: [cond("Interstitial lung disease, rapidly progressive", "J84.9"), cond("Proximal muscle weakness", "M62.81"), cond("Mechanic's hands", "L85.8")],
        obs: [flow(now, 2, 70), flow(now, 5, 6), spo2(now, 88, 6), lab(now, "2157-6", "CK", 2400, "U/L", 6), lab(now, "2276-4", "Ferritin", 3200, "ug/L", 6), lab(now, "2532-0", "LDH", 520, "U/L", 6), txt(now, "ANA", "1:160 speckled", 30)],
        medreqs: [req(now, "methylprednisolone 1000 mg IV daily x3", 20)],
        reports: [rep(now, "CT Chest", "Bilateral lower-lobe consolidation and ground glass with peribronchovascular distribution, organizing pneumonia pattern, progressed over 2 weeks.", 8)] }) },
    { label: "E: 71 M, fibrotic hypersensitivity pneumonitis on prednisone 30 mg × 6 weeks + mycophenolate, no PJP prophylaxis, LDH 480, new ground glass",
      build: (now) => ({ patient: pt(71, "male", "TEST, Echo (made-up)"),
        conditions: [cond("Chronic hypersensitivity pneumonitis, fibrotic (bird exposure)", "J67.2"), cond("Type 2 diabetes", "E11.9")],
        obs: [flow(now, 1, 60), flow(now, 4, 4), spo2(now, 87, 4), lab(now, "2532-0", "LDH", 480, "U/L", 6), lab(now, "33959-8", "Procalcitonin", 0.12, "ug/L", 6), lab(now, "6690-2", "WBC", 11.2, "10*9/L", 6)],
        medreqs: [req(now, "prednisone 30 mg PO daily", 1000), req(now, "mycophenolate mofetil 1000 mg PO BID", 1000), req(now, "insulin glargine 18 units subcut daily", 9000)],
        reports: [rep(now, "CT Chest", "Diffuse bilateral ground-glass opacity superimposed on upper-zone fibrosis with mosaic attenuation and air trapping.", 6)] }) },
    { label: "F: 80 F, IPF on pirfenidone, started ciprofloxacin; ALT 150; also on long-term prednisone 10 mg",
      build: (now) => ({ patient: pt(80, "female", "TEST, Foxtrot (made-up)"),
        conditions: [cond("Idiopathic pulmonary fibrosis", "J84.112"), cond("Urinary tract infection", "N39.0")],
        obs: [spo2(now, 92, 5), flow(now, 2, 50), flow(now, 2, 5), lab(now, "1742-6", "ALT", 150, "U/L", 6)],
        medreqs: [req(now, "pirfenidone 801 mg PO TID with meals", 9000), req(now, "ciprofloxacin 500 mg PO BID", 30), req(now, "prednisone 10 mg PO daily", 9000)],
        reports: [rep(now, "HRCT Chest", "Probable UIP pattern: subpleural basal reticulation with traction bronchiectasis, no honeycombing.", 24 * 400)] }) } ];

  if (typeof module !== "undefined" && module.exports) module.exports = SAMPLES; else window.ILD_SAMPLES = SAMPLES;
})();
