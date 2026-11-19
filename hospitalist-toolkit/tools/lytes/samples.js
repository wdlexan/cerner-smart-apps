/* MADE-UP patients for testing the Electrolytes tab. Times are relative to "now" (h = hours ago). None of these are real people.
   x: the bedside boxes the sample ticks (ECG changes, symptoms). */
(function () {
  const iso = (now, h) => new Date(now - h * 36e5).toISOString();
  const CODES = {
    K: ["2823-3", "Potassium", "mmol/L"], phos: ["2777-1", "Phosphate", "mmol/L"], Ca: ["2000-8", "Calcium", "mmol/L"], iCa: ["1994-3", "Calcium Ionized", "mmol/L"],
    Mg: ["2601-3", "Magnesium", "mmol/L"], albumin: ["1751-7", "Albumin", "g/L"], creatinine: ["14682-9", "Creatinine", "umol/L"], glucose: ["15074-8", "Glucose Random", "mmol/L"],
    tCO2: ["2028-9", "CO2 Total", "mmol/L"], Na: ["2951-2", "Sodium", "mmol/L"], CK: ["2157-6", "CK", "U/L"], urate: ["14933-6", "Uric Acid", "umol/L"], LDH: ["14804-9", "LDH", "U/L"],
    plt: ["777-3", "Platelets", "10*9/L"], wbc: ["6690-2", "WBC", "10*9/L"], PTH: ["14866-8", "PTH Intact", "pmol/L"], vitD: ["14635-7", "25-OH Vitamin D", "nmol/L"],
    uK: ["2828-2", "Potassium Urine Random", "mmol/L"], uCr: ["14683-7", "Creatinine Urine Random", "mmol/L"] };
  const lab = (now, id, val, h) => { const c = CODES[id]; return { resourceType: "Observation", status: "final", category: [{ coding: [{ code: "laboratory" }] }],
    code: { coding: [{ system: "http://loinc.org", code: c[0], display: c[1] }], text: c[1] }, effectiveDateTime: iso(now, h), valueQuantity: { value: val, unit: c[2] } }; };
  const set = (now, h, vals) => Object.keys(vals).map((k) => lab(now, k, vals[k], h));
  const vital = (now, loinc, disp, val, unit, h) => ({ resourceType: "Observation", status: "final", category: [{ coding: [{ code: "vital-signs" }] }],
    code: { coding: [{ system: "http://loinc.org", code: loinc, display: disp }], text: disp }, effectiveDateTime: iso(now, h), valueQuantity: { value: val, unit } });
  const wt = (now, kg) => vital(now, "29463-7", "Weight", kg, "kg", 20);
  const qtc = (now, ms) => vital(now, "8636-3", "QTc Interval", ms, "ms", 2);
  const req = (now, name) => ({ resourceType: "MedicationRequest", status: "active", medicationCodeableConcept: { text: name }, authoredOn: iso(now, 200) });
  const cond = (text, code) => ({ resourceType: "Condition", clinicalStatus: { coding: [{ code: "active" }] }, code: { coding: [{ system: "http://hl7.org/fhir/sid/icd-10-cm", code }], text } });
  const pt = (age, sex) => ({ resourceType: "Patient", gender: sex, birthDate: new Date(Date.now() - age * 365.25 * 864e5).toISOString().slice(0, 10) });

  const SAMPLES = [
    { label: "1: K 6.9 with ECG changes, AKI on ramipril + spironolactone + Septra", x: { ecg: true }, build: (now) => ({
      patient: pt(78, "male"), conditions: [cond("Heart failure with reduced ejection fraction", "I50.2"), cond("Type 2 diabetes mellitus", "E11.9"), cond("Cellulitis of leg", "L03.1")],
      obs: [].concat(set(now, 1, { K: 6.9, Na: 133, tCO2: 17, creatinine: 248, glucose: 9.1, Ca: 2.21, albumin: 34, phos: 1.9, Mg: 1.05 }),
        set(now, 30, { K: 5.6, creatinine: 156 }), set(now, 120, { K: 5.0, creatinine: 112 }), set(now, 4, { plt: 240, wbc: 13.1 }), [wt(now, 82)]),
      medreqs: ["Ramipril 10 mg PO daily", "Spironolactone 25 mg PO daily", "Sulfamethoxazole-trimethoprim DS 1 tab PO BID", "Metoprolol 50 mg PO BID", "Furosemide 40 mg PO daily", "Heparin 5000 units subcut q12h"].map((n) => req(now, n)) }) },

    { label: "2: K 2.6 and Mg 0.48 on furosemide + pantoprazole, AF on digoxin", x: {}, build: (now) => ({
      patient: pt(71, "female"), conditions: [cond("Atrial fibrillation", "I48.91"), cond("Heart failure", "I50.9")],
      obs: [].concat(set(now, 2, { K: 2.6, Mg: 0.48, Na: 136, tCO2: 33, creatinine: 92, Ca: 2.12, albumin: 36, phos: 0.95, glucose: 6.4 }),
        set(now, 26, { K: 3.1, Mg: 0.55 }), [lab(now, "uK", 38, 3), lab(now, "uCr", 6.2, 3), wt(now, 64), qtc(now, 512)]),
      medreqs: ["Furosemide 80 mg IV BID", "Pantoprazole 40 mg PO daily", "Digoxin 0.0625 mg PO daily", "Apixaban 5 mg PO BID"].map((n) => req(now, n)) }) },

    { label: "3: Refeeding on day 3 of feeds: PO4 0.27, K 3.0, Mg 0.56 (anorexia nervosa, 41 kg)", x: { symptoms: true }, build: (now) => ({
      patient: pt(24, "female"), conditions: [cond("Anorexia nervosa", "F50.0"), cond("Severe protein-calorie malnutrition", "E43")],
      obs: [].concat(set(now, 3, { phos: 0.27, K: 3.0, Mg: 0.56, Ca: 2.15, albumin: 33, creatinine: 48, glucose: 5.1, Na: 134, tCO2: 25, CK: 1450 }),
        set(now, 50, { phos: 0.88, K: 3.8, Mg: 0.78 }), [wt(now, 41)]),
      medreqs: ["Enteral feed via NG continuous", "Thiamine 100 mg PO daily", "Multivitamin PO daily"].map((n) => req(now, n)) }) },

    { label: "4: Corrected Ca 3.76, confused, lung cancer, on HCTZ, eGFR ~35", x: { symptoms: true }, build: (now) => ({
      patient: pt(68, "male"), conditions: [cond("Squamous cell carcinoma of right lung", "C34.11"), cond("Hypertension", "I10")],
      obs: [].concat(set(now, 2, { Ca: 3.40, albumin: 22, phos: 0.78, creatinine: 168, K: 3.6, Mg: 0.82, Na: 141, tCO2: 28 }),
        set(now, 2, { PTH: 0.4 }), set(now, 400, { vitD: 62 }), set(now, 48, { Ca: 3.05, albumin: 25 }), [wt(now, 70)]),
      medreqs: ["Hydrochlorothiazide 25 mg PO daily", "Calcium carbonate 500 mg PO BID", "Vitamin D3 1000 units PO daily", "Hydromorphone 1 mg PO q4h PRN"].map((n) => req(now, n)) }) },

    { label: "5: Day 1 after total thyroidectomy: ionized Ca 0.86, tingling, Mg 0.6, PTH low", x: { symptoms: true }, build: (now) => ({
      patient: pt(52, "female"), conditions: [cond("Papillary thyroid carcinoma", "C73"), cond("Postprocedural hypoparathyroidism", "E89.2")],
      obs: [].concat(set(now, 1, { iCa: 0.86, Ca: 1.82, albumin: 38, phos: 1.72, Mg: 0.6, K: 4.0, creatinine: 66, PTH: 0.5 }), set(now, 14, { Ca: 2.02, albumin: 38 }), [wt(now, 72), qtc(now, 486)]),
      medreqs: ["Pantoprazole 40 mg PO daily", "Acetaminophen 1 g PO q6h"].map((n) => req(now, n)) }) },

    { label: "6: Tumour lysis after starting chemo: K 6.2, PO4 2.9, Ca 1.92, urate 690", x: {}, build: (now) => ({
      patient: pt(59, "male"), conditions: [cond("Diffuse large B-cell lymphoma", "C83.3")],
      obs: [].concat(set(now, 1, { K: 6.2, phos: 2.9, Ca: 1.92, albumin: 32, urate: 690, LDH: 1840, creatinine: 214, Mg: 0.9, glucose: 7.2, tCO2: 19, Na: 137 }),
        set(now, 20, { K: 5.0, phos: 1.6, creatinine: 120, urate: 520 }), set(now, 4, { plt: 180, wbc: 8.4 }), [wt(now, 88)]),
      medreqs: ["Allopurinol 300 mg PO daily", "Rituximab IV", "Cyclophosphamide IV", "Prednisone 100 mg PO daily", "Ondansetron 8 mg PO q8h PRN"].map((n) => req(now, n)) }) },

    { label: "7: Low total Ca 1.96 but albumin 21 (cirrhosis): ionized normal", x: {}, build: (now) => ({
      patient: pt(63, "male"), conditions: [cond("Alcoholic cirrhosis of liver", "K70.30")],
      obs: [].concat(set(now, 3, { Ca: 1.96, albumin: 21, iCa: 1.17, phos: 0.70, Mg: 0.66, K: 3.7, creatinine: 74, Na: 131 }), [wt(now, 78)]),
      medreqs: ["Spironolactone 100 mg PO daily", "Furosemide 40 mg PO daily", "Lactulose 30 mL PO TID", "Thiamine 100 mg PO daily"].map((n) => req(now, n)) }) },

    { label: "8: K 6.4 but platelets 1100 (essential thrombocythemia), no ECG change", x: {}, build: (now) => ({
      patient: pt(66, "female"), conditions: [cond("Essential thrombocythemia", "D47.3")],
      obs: [].concat(set(now, 2, { K: 6.4, plt: 1100, wbc: 9.2, creatinine: 70, Ca: 2.30, albumin: 39, phos: 1.1, Mg: 0.85, glucose: 5.6, tCO2: 25 }), [wt(now, 60)]),
      medreqs: ["Hydroxyurea 500 mg PO daily", "ASA 81 mg PO daily"].map((n) => req(now, n)) }) },

    { label: "9: Mg 3.4, drowsy, no reflexes: CKD 4 on milk of magnesia + Pico-Salax", x: { symptoms: true }, build: (now) => ({
      patient: pt(86, "female"), conditions: [cond("Chronic kidney disease stage 4", "N18.4"), cond("Constipation", "K59.0")],
      obs: [].concat(set(now, 2, { Mg: 3.4, creatinine: 210, K: 5.2, Ca: 2.05, albumin: 34, phos: 1.6, Na: 138, tCO2: 21, glucose: 6.0 }), set(now, 50, { Mg: 2.1, creatinine: 180 }), [wt(now, 52)]),
      medreqs: ["Magnesium hydroxide (Milk of Magnesia) 30 mL PO BID", "Pico-Salax 1 sachet PO", "Amlodipine 5 mg PO daily"].map((n) => req(now, n)) }) }];

  if (typeof module !== "undefined" && module.exports) module.exports = SAMPLES; else window.LYTES_SAMPLES = SAMPLES;
})();
