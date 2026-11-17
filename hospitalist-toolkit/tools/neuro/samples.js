/* Neuro (non-stroke) tab: made-up patients for testing. Not real people. Each builds raw FHIR-like resources plus the bedside ticks. */
(function (root) {
  const H = 36e5;
  function kit(now) {
    let n = 0;
    const obs = (loinc, name, v, unit, hAgo, cat) => ({ resourceType: "Observation", id: "o" + ++n, status: "final",
      category: [{ coding: [{ code: cat || "laboratory" }] }], code: { coding: loinc ? [{ system: "http://loinc.org", code: loinc, display: name }] : [], text: name },
      effectiveDateTime: new Date(now - hAgo * H).toISOString(), valueQuantity: { value: v, unit } });
    const qual = (name, txt, hAgo) => ({ resourceType: "Observation", id: "o" + ++n, status: "final", code: { text: name },
      effectiveDateTime: new Date(now - hAgo * H).toISOString(), valueString: txt });
    const med = (name) => ({ resourceType: "MedicationRequest", id: "m" + ++n, status: "active", medicationCodeableConcept: { text: name } });
    const cond = (name) => ({ resourceType: "Condition", id: "c" + ++n, clinicalStatus: { text: "active" }, code: { text: name } });
    const pt = (given, family, years, sex) => ({ resourceType: "Patient", id: "demo", gender: sex, birthDate: new Date(now - years * 365.25 * 24 * H).toISOString().slice(0, 10), name: [{ given: [given], family }] });
    return { obs, qual, med, cond, pt };
  }
  const basic = (k, x) => [k.obs("2951-2", "Sodium", x.na || 139, "mmol/L", 6), k.obs("2823-3", "Potassium", x.k || 4.1, "mmol/L", 6),
    k.obs("2160-0", "Creatinine", x.cr || 78, "umol/L", 6), k.obs("6690-2", "WBC", x.wbc || 7.2, "10*9/L", 6), k.obs("777-3", "Platelets", x.plt || 240, "10*9/L", 6),
    k.obs("2345-7", "Glucose", x.glu || 6.1, "mmol/L", 6), k.obs("8310-5", "Temperature", x.temp || 36.8, "Cel", 2, "vital-signs"),
    k.obs("29463-7", "Body weight", x.wt || 75, "kg", 30, "vital-signs")];

  const SAMPLES = [
    { label: "GBS with falling FVC (44 M)", ticks: ["para", "ascend", "areflex", "distalNumb", "recentInf", "facial"], card: "gbs",
      build(now) { const k = kit(now); return { patient: k.pt("Demo", "GUILLAIN", 44, "male"),
        obs: basic(k, { wt: 80 }).concat([k.obs("2157-6", "CK", 180, "U/L", 6),
          k.obs("19870-5", "Forced vital capacity", 3.1, "L", 40, "exam"), k.obs("20155-8", "Negative inspiratory force", -55, "cmH2O", 40, "exam"),
          k.obs("19870-5", "Forced vital capacity", 2.6, "L", 20, "exam"), k.obs("20155-8", "Negative inspiratory force", -42, "cmH2O", 20, "exam"),
          k.obs("19870-5", "Forced vital capacity", 1.9, "L", 2, "exam"), k.obs("20155-8", "Negative inspiratory force", -32, "cmH2O", 2, "exam")]),
        medreqs: [k.med("Enoxaparin 40 mg subcut daily"), k.med("Acetaminophen 1 g PO q6h")], admins: [], conditions: [k.cond("Gastroenteritis")] }; } },

    { label: "Myasthenia exacerbation on ciprofloxacin + metoprolol (71 F)", ticks: ["fatig", "ptosis", "bulbar", "dyspnea"], card: "mg",
      build(now) { const k = kit(now); return { patient: k.pt("Demo", "MYASTHENIA", 71, "female"),
        obs: basic(k, { wt: 62, temp: 37.9, wbc: 12.4 }).concat([k.obs("19123-9", "Magnesium", 0.85, "mmol/L", 6), k.obs("3016-3", "TSH", 2.1, "mU/L", 30),
          k.obs("19870-5", "Forced vital capacity", 1.4, "L", 8, "exam"), k.obs("20155-8", "Negative inspiratory force", -28, "cmH2O", 8, "exam"),
          k.qual("Urine leukocyte esterase", "Positive 2+", 10), k.qual("Urine nitrite", "Positive", 10)]),
        medreqs: [k.med("Pyridostigmine 60 mg PO q6h"), k.med("Ciprofloxacin 500 mg PO BID"), k.med("Metoprolol tartrate 25 mg PO BID"),
          k.med("Prednisone 10 mg PO daily"), k.med("Magnesium sulfate 2 g IV once")], admins: [], conditions: [k.cond("Myasthenia gravis"), k.cond("Atrial fibrillation")] }; } },

    { label: "Back pain, leg weakness, prostate cancer, retention (78 M)", ticks: ["para", "backpain", "sensLevel", "hyperreflex"], card: "cord",
      build(now) { const k = kit(now); return { patient: k.pt("Demo", "CORD", 78, "male"),
        obs: basic(k, { wt: 70 }).concat([k.obs("17861-6", "Calcium", 2.86, "mmol/L", 6), k.obs("1988-5", "CRP", 12, "mg/L", 6),
          k.obs(null, "Bladder scan volume", 640, "mL", 3, "exam")]),
        medreqs: [k.med("Hydromorphone 1 mg PO q4h PRN"), k.med("Leuprolide 22.5 mg IM q3 months"), k.med("Apixaban 5 mg PO BID")], admins: [],
        conditions: [k.cond("Metastatic prostate cancer"), k.cond("Atrial fibrillation")] }; } },

    { label: "Chronic subdural after falls, on apixaban (86 F)", ticks: ["drowsy", "fall", "gradual"], card: "sdh",
      build(now) { const k = kit(now); return { patient: k.pt("Demo", "SUBDURAL", 86, "female"),
        obs: basic(k, { wt: 54, plt: 190 }).concat([k.obs("6301-6", "INR", 1.2, "", 4), k.obs("14979-9", "aPTT", 31, "s", 4),
          k.obs("9269-2", "Glasgow coma score total", 15, "", 30, "exam"), k.obs("9269-2", "Glasgow coma score total", 14, "", 12, "exam"),
          k.obs("9269-2", "Glasgow coma score total", 13, "", 1, "exam")]),
        medreqs: [k.med("Apixaban 2.5 mg PO BID"), k.med("Aspirin 81 mg PO daily"), k.med("Donepezil 5 mg PO daily")], admins: [],
        conditions: [k.cond("Atrial fibrillation"), k.cond("Mild cognitive impairment")] }; } },

    { label: "MS worse with a UTI: pseudo-relapse (39 F)", ticks: ["msNew"], card: "ms",
      build(now) { const k = kit(now); return { patient: k.pt("Demo", "SCLEROSIS", 39, "female"),
        obs: basic(k, { wt: 66, temp: 38.3, wbc: 13.1 }).concat([k.obs("1988-5", "CRP", 64, "mg/L", 6),
          k.qual("Urine leukocyte esterase", "Large", 8), k.qual("Urine nitrite", "Positive", 8), k.obs(null, "Post void residual", 240, "mL", 5, "exam")]),
        medreqs: [k.med("Ocrelizumab 600 mg IV every 6 months"), k.med("Baclofen 10 mg PO TID")], admins: [], conditions: [k.cond("Multiple sclerosis, relapsing-remitting")] }; } },

    { label: "Acute vertigo with normal head impulse (67 M)", ticks: ["vertigo", "vConstant", "hitNormal", "cantWalk"], card: "vertigo",
      build(now) { const k = kit(now); return { patient: k.pt("Demo", "VERTIGO", 67, "male"), obs: basic(k, { wt: 88, glu: 9.4 }),
        medreqs: [k.med("Dimenhydrinate 50 mg IV q4h PRN"), k.med("Atorvastatin 40 mg PO daily"), k.med("Metformin 1000 mg PO BID")], admins: [],
        conditions: [k.cond("Type 2 diabetes"), k.cond("Hypertension")] }; } }];
  if (typeof module !== "undefined" && module.exports) module.exports = SAMPLES; else root.NEURO_SAMPLES = SAMPLES;
})(typeof window !== "undefined" ? window : globalThis);
