/* MADE-UP patients for testing the Acid-Base tab. Times are relative to "now" (h = hours ago). None of these are real people.
   Values are internally consistent (Henderson-Hasselbalch) and in SI units. */
(function () {
  const iso = (now, h) => new Date(now - h * 36e5).toISOString();
  const lab = (now, loinc, disp, val, unit, h) => ({ resourceType: "Observation", status: "final", category: [{ coding: [{ code: "laboratory" }] }],
    code: { coding: loinc ? [{ system: "http://loinc.org", code: loinc, display: disp }] : [], text: disp }, effectiveDateTime: iso(now, h), valueQuantity: { value: val, unit } });
  const ART = { pH: ["2744-1", "pH Arterial"], pCO2: ["2019-8", "pCO2 Arterial"], pO2: ["2703-7", "pO2 Arterial"], HCO3: ["1960-4", "HCO3 Arterial"], BE: ["1925-7", "Base Excess Arterial"] };
  const VEN = { pH: ["2746-6", "pH Venous"], pCO2: ["2021-4", "pCO2 Venous"], pO2: ["2705-2", "pO2 Venous"], HCO3: ["14627-4", "HCO3 Venous"], BE: ["1927-3", "Base Excess Venous"] };
  const UNIT = { pH: "", pCO2: "mmHg", pO2: "mmHg", HCO3: "mmol/L", BE: "mmol/L" };
  function gas(now, h, spec, vals) { const m = spec === "arterial" ? ART : VEN; return Object.keys(vals).map((k) => lab(now, m[k][0], m[k][1], vals[k], UNIT[k], h)); }
  function lytes(now, h, na, k, cl, co2) { return [lab(now, "2951-2", "Sodium", na, "mmol/L", h), lab(now, "2823-3", "Potassium", k, "mmol/L", h), lab(now, "2075-0", "Chloride", cl, "mmol/L", h), lab(now, "2028-9", "CO2 Total", co2, "mmol/L", h)]; }
  const L = {
    alb: (now, v, h) => lab(now, "1751-7", "Albumin", v, "g/L", h), glu: (now, v, h) => lab(now, "15074-8", "Glucose Random", v, "mmol/L", h),
    urea: (now, v, h) => lab(now, "22664-7", "Urea", v, "mmol/L", h), cr: (now, v, h) => lab(now, "14682-9", "Creatinine", v, "umol/L", h),
    lac: (now, v, h) => lab(now, "32693-4", "Lactate Blood", v, "mmol/L", h), osm: (now, v, h) => lab(now, "2692-1", "Osmolality Serum", v, "mmol/kg", h),
    bhb: (now, v, h) => lab(now, "53060-9", "Beta-Hydroxybutyrate", v, "mmol/L", h), eth: (now, v, h) => lab(now, "5643-2", "Ethanol Level", v, "mmol/L", h),
    sal: (now, v, h) => lab(now, "4024-6", "Salicylate Level", v, "mmol/L", h),
    una: (now, v, h) => lab(now, "2955-3", "Sodium Urine Random", v, "mmol/L", h), uk: (now, v, h) => lab(now, "2828-2", "Potassium Urine Random", v, "mmol/L", h),
    ucl: (now, v, h) => lab(now, "2078-4", "Chloride Urine Random", v, "mmol/L", h), uph: (now, v, h) => lab(now, "2756-5", "pH Urine", v, "", h) };
  const req = (now, name, h) => ({ resourceType: "MedicationRequest", status: "active", medicationCodeableConcept: { text: name }, authoredOn: iso(now, h) });
  const cond = (text, code) => ({ resourceType: "Condition", clinicalStatus: { coding: [{ code: "active" }] }, code: { coding: [{ system: "http://hl7.org/fhir/sid/icd-10-cm", code }], text } });
  const pt = (age, sex) => ({ resourceType: "Patient", gender: sex, birthDate: new Date(Date.now() - age * 365.25 * 864e5).toISOString().slice(0, 10) });

  window.ACIDBASE_SAMPLES = [
    { label: "A: Euglycaemic DKA on empagliflozin (glucose 11)", build: (now) => ({
      patient: pt(62, "female"), conditions: [cond("Type 2 diabetes mellitus", "E11.9"), cond("Heart failure with reduced ejection fraction", "I50.2")],
      obs: [].concat(gas(now, 1, "venous", { pH: 7.22, pCO2: 22, pO2: 38, HCO3: 9 }), lytes(now, 1, 137, 4.9, 102, 9),
        [L.alb(now, 38, 1), L.glu(now, 11.2, 1), L.urea(now, 9.4, 1), L.cr(now, 118, 1), L.bhb(now, 5.8, 1), L.lac(now, 1.6, 1)],
        gas(now, 8, "venous", { pH: 7.29, pCO2: 26, HCO3: 12.5 }), lytes(now, 8, 136, 4.6, 103, 13)),
      medreqs: [req(now, "Empagliflozin 10 mg PO daily", 500), req(now, "Metoprolol 25 mg PO BID", 500), req(now, "Furosemide 40 mg PO daily", 500)] }) },

    { label: "B: Septic shock, lactate rising, on metformin, tiring", build: (now) => ({
      patient: pt(74, "male"), conditions: [cond("Type 2 diabetes mellitus", "E11.9"), cond("Sepsis, unspecified organism", "A41.9")],
      obs: [].concat(gas(now, 0.5, "arterial", { pH: 7.08, pCO2: 48, pO2: 68, HCO3: 14, BE: -15 }), lytes(now, 0.5, 135, 5.4, 98, 13),
        [L.alb(now, 28, 0.5), L.lac(now, 8.9, 0.5), L.cr(now, 310, 0.5), L.urea(now, 22, 0.5), L.glu(now, 9.8, 0.5)],
        gas(now, 4, "arterial", { pH: 7.21, pCO2: 36, pO2: 72, HCO3: 14 }), [L.lac(now, 6.1, 4)], lytes(now, 4, 136, 5.1, 99, 15)),
      medreqs: [req(now, "metFORMIN 1000 mg PO BID", 900), req(now, "Piperacillin-tazobactam 4.5 g IV q6h", 6)] }) },

    { label: "C: Vomiting, metabolic alkalosis, K 2.8", build: (now) => ({
      patient: pt(41, "female"), conditions: [cond("Small bowel obstruction", "K56.6")],
      obs: [].concat(gas(now, 2, "venous", { pH: 7.53, pCO2: 48, HCO3: 40 }), lytes(now, 2, 133, 2.8, 84, 39), [L.alb(now, 40, 2), L.ucl(now, 8, 1.5), L.una(now, 35, 1.5), L.uk(now, 30, 1.5)]),
      medreqs: [req(now, "Ondansetron 4 mg IV q8h PRN", 12), req(now, "Pantoprazole 40 mg IV daily", 12)] }) },

    { label: "D: Diarrhoea (Crohn), normal anion gap acidosis", build: (now) => ({
      patient: pt(29, "male"), conditions: [cond("Crohn disease of small intestine", "K50.0"), cond("Ileostomy status", "Z93.2")],
      obs: [].concat(gas(now, 3, "venous", { pH: 7.28, pCO2: 30, HCO3: 14 }), lytes(now, 3, 138, 3.0, 116, 14),
        [L.alb(now, 35, 3), L.una(now, 30, 2), L.uk(now, 25, 2), L.ucl(now, 80, 2), L.uph(now, 5.2, 2), L.cr(now, 95, 3)]),
      medreqs: [req(now, "Loperamide 2 mg PO QID PRN", 30)] }) },

    { label: "E: COPD on furosemide, chronic CO2 retention", build: (now) => ({
      patient: pt(78, "male"), conditions: [cond("Chronic obstructive pulmonary disease with acute exacerbation", "J44.1")],
      obs: [].concat(gas(now, 2, "arterial", { pH: 7.35, pCO2: 62, pO2: 58, HCO3: 34 }), lytes(now, 2, 139, 3.4, 94, 34), [L.alb(now, 36, 2)]),
      medreqs: [req(now, "Furosemide 40 mg PO daily", 800), req(now, "Tiotropium 18 mcg inhaled daily", 800), req(now, "Prednisone 40 mg PO daily", 24)] }) },

    { label: "F: Osmolar gap 31 with high anion gap (toxic alcohol?)", build: (now) => ({
      patient: pt(47, "male"), conditions: [cond("Alcohol dependence", "F10.20")],
      obs: [].concat(gas(now, 1, "arterial", { pH: 7.14, pCO2: 18, pO2: 104, HCO3: 6 }), lytes(now, 1, 140, 5.0, 104, 6),
        [L.alb(now, 40, 1), L.glu(now, 6.0, 1), L.urea(now, 5.0, 1), L.osm(now, 322, 1), L.eth(now, 0, 1), L.lac(now, 3.1, 1), L.cr(now, 130, 1)]), medreqs: [] }) },

    { label: "G: Respiratory alkalosis + high gap (salicylate pattern)", build: (now) => ({
      patient: pt(23, "female"), conditions: [],
      obs: [].concat(gas(now, 1, "venous", { pH: 7.46, pCO2: 20, HCO3: 14 }), lytes(now, 1, 141, 3.6, 104, 14), [L.alb(now, 41, 1), L.lac(now, 2.4, 1), L.glu(now, 5.5, 1)]), medreqs: [] }) }
  ];
})();
