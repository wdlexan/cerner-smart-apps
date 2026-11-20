/* MADE-UP patients for testing the antibiotic chooser. Not real people. Times relative to now (h = hours ago). */
(function () {
  const iso = (now, h) => new Date(now - h * 36e5).toISOString();
  const obs = (now, cat, loinc, disp, val, unit, h) => ({ resourceType: "Observation", status: "final", category: [{ coding: [{ code: cat }] }], code: { coding: [{ system: "http://loinc.org", code: loinc }], text: disp }, effectiveDateTime: iso(now, h), valueQuantity: { value: val, unit } });
  const req = (name) => ({ resourceType: "MedicationRequest", status: "active", medicationCodeableConcept: { text: name } });
  const cond = (text, code) => ({ resourceType: "Condition", clinicalStatus: { coding: [{ code: "active" }] }, code: { coding: [{ system: "http://hl7.org/fhir/sid/icd-10", code }], text } });
  const alg = (sub, manif, crit) => ({ resourceType: "AllergyIntolerance", code: { text: sub }, criticality: crit || "low", reaction: manif ? [{ manifestation: [{ text: manif }] }] : [] });
  const rep = (now, name, concl, h) => ({ resourceType: "DiagnosticReport", status: "final", code: { text: name }, conclusion: concl, effectiveDateTime: iso(now, h) });
  const pt = (age, gender, name, mrn) => ({ resourceType: "Patient", gender, name: [{ text: name || "TEST, Made-up" }], identifier: [{ type: { coding: [{ code: "MR" }] }, value: mrn || "TEST000" }], birthDate: new Date(Date.now() - age * 365.25 * 864e5 - 30 * 864e5).toISOString().slice(0, 10) });

  window.ABXMAP_SAMPLES = [
    { label: "A: 81 F, leg cellulitis, penicillin anaphylaxis, CrCl ~25, warfarin + sertraline",
      build: (now) => ({ patient: pt(81, "female", "TEST, Alma", "TEST0001"), conditions: [cond("Cellulitis of left lower limb", "L03.116"), cond("Atrial fibrillation", "I48.91"), cond("Depression", "F32.9")],
        obs: [obs(now, "laboratory", "2160-0", "Creatinine", 140, "umol/L", 5), obs(now, "vital-signs", "29463-7", "Body weight", 52, "kg", 20), obs(now, "laboratory", "6690-2", "WBC", 13.1, "x10^9/L", 5)],
        medreqs: [req("warfarin 3 mg PO daily"), req("sertraline 50 mg PO daily")], allergies: [alg("Penicillin", "Anaphylaxis", "high")], reports: [] }) },
    { label: "B: 67 M, prostatitis, ESBL E. coli last year, on valproate",
      build: (now) => ({ patient: pt(67, "male", "TEST, Bruno", "TEST0002"), conditions: [cond("Acute prostatitis", "N41.0"), cond("Epilepsy", "G40.909")],
        obs: [obs(now, "laboratory", "2160-0", "Creatinine", 96, "umol/L", 4), obs(now, "vital-signs", "29463-7", "Body weight", 80, "kg", 10)],
        medreqs: [req("divalproex 500 mg PO BID"), req("tamsulosin 0.4 mg PO daily")], allergies: [],
        reports: [rep(now, "Urine culture", "Escherichia coli >10^8 CFU/L, ESBL producer. Resistant to ceftriaxone and ciprofloxacin; susceptible to ertapenem, meropenem, nitrofurantoin, TMP-SMX.", 24 * 200)] }) },
    { label: "C: 84 M, hospital-acquired pneumonia, prior MRSA, QTc 492, citalopram, prednisone",
      build: (now) => ({ patient: pt(84, "male", "TEST, Cyril", "TEST0003"), conditions: [cond("Hospital-acquired pneumonia", "J18.9"), cond("COPD", "J44.9"), cond("History of MRSA", "Z86.19")],
        obs: [obs(now, "laboratory", "2160-0", "Creatinine", 118, "umol/L", 6), obs(now, "vital-signs", "29463-7", "Body weight", 68, "kg", 30), obs(now, "laboratory", "8636-3", "QTc interval", 492, "ms", 8)],
        medreqs: [req("citalopram 20 mg PO daily"), req("prednisone 40 mg PO daily"), req("haloperidol 0.5 mg PO q6h PRN")], allergies: [alg("Sulfamethoxazole-trimethoprim", "Rash", "low")],
        reports: [rep(now, "Wound swab culture", "Staphylococcus aureus, methicillin resistant (MRSA).", 24 * 90)] }) },
    { label: "D: 29 F, pregnant 24 weeks, pyelonephritis, amoxicillin rash as a child",
      build: (now) => ({ patient: pt(29, "female", "TEST, Dana", "TEST0004"), conditions: [cond("Pyelonephritis", "N10"), cond("Pregnancy, second trimester", "Z34.82")],
        obs: [obs(now, "laboratory", "2160-0", "Creatinine", 62, "umol/L", 3), obs(now, "vital-signs", "29463-7", "Body weight", 70, "kg", 10)],
        medreqs: [req("prenatal vitamin PO daily")], allergies: [alg("Amoxicillin", "Rash (childhood)", "low")], reports: [] }) }];
})();
