/* MADE-UP patients for testing the hyponatremia tab. Times are relative to "now" (h = hours ago). None of these are real people. */
(function () {
  const iso = (now, h) => new Date(now - h * 36e5).toISOString();
  const lab = (now, loinc, disp, val, unit, h) => ({ resourceType: "Observation", status: "final", category: [{ coding: [{ code: "laboratory" }] }],
    code: { coding: loinc ? [{ system: "http://loinc.org", code: loinc, display: disp }] : [], text: disp }, effectiveDateTime: iso(now, h), valueQuantity: { value: val, unit } });
  const na = (now, v, h, gas) => lab(now, gas ? "2947-0" : "2951-2", gas ? "Sodium, Blood Gas" : "Sodium", v, "mmol/L", h);
  const vit = (now, code, disp, v, unit, h) => ({ resourceType: "Observation", category: [{ coding: [{ code: "vital-signs" }] }], code: { coding: [{ system: "http://loinc.org", code }], text: disp }, effectiveDateTime: iso(now, h), valueQuantity: { value: v, unit } });
  const wh = (now, kg, cm) => [vit(now, "29463-7", "Body weight", kg, "kg", 20), vit(now, "8302-2", "Body height", cm, "cm", 200)];
  const uo = (now, ml, h) => ({ resourceType: "Observation", category: [{ coding: [{ code: "vital-signs" }] }], code: { coding: [{ system: "http://loinc.org", code: "9187-6" }], text: "Urine output" }, effectiveDateTime: iso(now, h), valueQuantity: { value: ml, unit: "mL" } });
  const req = (now, name, h, status) => ({ resourceType: "MedicationRequest", status: status || "active", medicationCodeableConcept: { text: name }, authoredOn: iso(now, h) });
  const adm = (now, name, h) => ({ resourceType: "MedicationAdministration", status: "completed", medicationCodeableConcept: { text: name }, effectiveDateTime: iso(now, h) });
  const cond = (text, code) => ({ resourceType: "Condition", code: { coding: [{ system: "http://hl7.org/fhir/sid/icd-10", code }], text } });
  const pt = (age, gender) => ({ resourceType: "Patient", gender, birthDate: new Date(Date.now() - age * 365.25 * 864e5).toISOString().slice(0, 10) });

  window.HYPO_SAMPLES = [
    { label: "A: SIAD with pneumonia, on citalopram and 0.9% saline", symptoms: "none", volume: "eu", build: (now) => ({
      patient: pt(74, "male"), conditions: [cond("Community acquired pneumonia", "J18.9")],
      obs: [].concat([na(now, 126, 72), na(now, 124, 48), na(now, 123, 24), na(now, 122, 2)], wh(now, 68, 172), [
        lab(now, "2345-7", "Glucose", 6.1, "mmol/L", 2), lab(now, "3091-6", "Urea", 3.2, "mmol/L", 2), lab(now, "2160-0", "Creatinine", 70, "umol/L", 2), lab(now, "2823-3", "Potassium", 4.1, "mmol/L", 2),
        lab(now, "2692-1", "Osmolality, Serum", 258, "mOsm/kg", 24), lab(now, "3084-1", "Uric Acid", 180, "umol/L", 24),
        lab(now, "2695-4", "Osmolality, Urine Random", 540, "mOsm/kg", 23), lab(now, "2955-3", "Sodium, Urine Random", 68, "mmol/L", 23), lab(now, "2829-0", "Potassium, Urine Random", 38, "mmol/L", 23)]),
      medreqs: [req(now, "Citalopram 20 mg PO daily", 900), req(now, "Pantoprazole 40 mg PO daily", 60), req(now, "Sodium chloride 0.9% 1000 mL IV at 100 mL/h", 30), req(now, "Ceftriaxone 1 g IV q24h", 30)] }) },

    { label: "B: Seizure, sodium 112, thiazide, alcohol, low potassium", symptoms: "severe", volume: "eu", build: (now) => ({
      patient: pt(66, "female"), conditions: [cond("Alcohol use disorder, moderate", "F10.20"), cond("Essential hypertension", "I10")],
      obs: [].concat([na(now, 131, 720), na(now, 112, 3), na(now, 114, 1.5, true), na(now, 116, 0.3)], wh(now, 58, 160), [
        lab(now, "2345-7", "Glucose", 6.5, "mmol/L", 3), lab(now, "3091-6", "Urea", 4.0, "mmol/L", 3), lab(now, "2160-0", "Creatinine", 62, "umol/L", 3), lab(now, "2823-3", "Potassium", 2.8, "mmol/L", 3),
        lab(now, "19123-9", "Magnesium", 0.62, "mmol/L", 3), lab(now, "2692-1", "Osmolality, Serum", 238, "mOsm/kg", 3),
        lab(now, "2695-4", "Osmolality, Urine Random", 310, "mOsm/kg", 2.8), lab(now, "2955-3", "Sodium, Urine Random", 52, "mmol/L", 2.8), lab(now, "2829-0", "Potassium, Urine Random", 20, "mmol/L", 2.8)]),
      medreqs: [req(now, "Hydrochlorothiazide 25 mg PO daily", 2000)],
      admins: [adm(now, "Sodium chloride 3% 150 mL IV over 20 min", 2.5), adm(now, "Sodium chloride 3% 150 mL IV over 20 min", 1.8)] }) },

    { label: "C: Vomiting, given 0.9% saline, now overcorrected", symptoms: "none", volume: "hypo", build: (now) => ({
      patient: pt(52, "male"), conditions: [cond("Gastroenteritis", "A09")],
      obs: [].concat([na(now, 116, 22), na(now, 119, 16), na(now, 124, 8), na(now, 128, 1)], wh(now, 80, 180), [uo(now, 260, 5), uo(now, 280, 4), uo(now, 300, 3), uo(now, 310, 2), uo(now, 290, 1)], [
        lab(now, "2345-7", "Glucose", 5.4, "mmol/L", 22), lab(now, "3091-6", "Urea", 9.8, "mmol/L", 22), lab(now, "2160-0", "Creatinine", 118, "umol/L", 22), lab(now, "2823-3", "Potassium", 3.6, "mmol/L", 1),
        lab(now, "2692-1", "Osmolality, Serum", 248, "mOsm/kg", 22), lab(now, "2695-4", "Osmolality, Urine Random", 380, "mOsm/kg", 21.5), lab(now, "2955-3", "Sodium, Urine Random", 12, "mmol/L", 21.5)]),
      medreqs: [req(now, "Sodium chloride 0.9% 1000 mL IV at 150 mL/h", 20), req(now, "Ondansetron 4 mg IV q8h PRN", 20)] }) },

    { label: "D: Heart failure on furosemide and metolazone", symptoms: "none", volume: "hyper", build: (now) => ({
      patient: pt(81, "male"), conditions: [cond("Heart failure with reduced ejection fraction", "I50.2")],
      obs: [].concat([na(now, 129, 48), na(now, 128, 24), na(now, 127, 1)], wh(now, 92, 175), [
        lab(now, "2345-7", "Glucose", 7.2, "mmol/L", 1), lab(now, "3091-6", "Urea", 14.5, "mmol/L", 1), lab(now, "2160-0", "Creatinine", 142, "umol/L", 1), lab(now, "2823-3", "Potassium", 3.4, "mmol/L", 1),
        lab(now, "2692-1", "Osmolality, Serum", 266, "mOsm/kg", 24), lab(now, "2695-4", "Osmolality, Urine Random", 420, "mOsm/kg", 23), lab(now, "2955-3", "Sodium, Urine Random", 18, "mmol/L", 23)]),
      medreqs: [req(now, "Furosemide 80 mg IV BID", 72), req(now, "Metolazone 2.5 mg PO daily", 48), req(now, "Sertraline 50 mg PO daily", 2000)] }) },

    { label: "E: Sodium 126 with glucose 38 (hyperglycemia)", symptoms: "none", volume: "hypo", build: (now) => ({
      patient: pt(45, "female"), conditions: [cond("Type 2 diabetes mellitus with hyperglycemia", "E11.65")],
      obs: [].concat([na(now, 126, 2)], wh(now, 74, 165), [lab(now, "2345-7", "Glucose", 38, "mmol/L", 2), lab(now, "3091-6", "Urea", 8.1, "mmol/L", 2), lab(now, "2692-1", "Osmolality, Serum", 302, "mOsm/kg", 2)]) }) },

    { label: "F: Beer potomania, sodium 107, low urine osmolality", symptoms: "moderate", volume: "eu", build: (now) => ({
      patient: pt(58, "male"), conditions: [cond("Alcohol dependence", "F10.20"), cond("Moderate protein-calorie malnutrition", "E44.0")],
      obs: [].concat([na(now, 106, 4), na(now, 107, 0.5)], wh(now, 60, 175), [
        lab(now, "2345-7", "Glucose", 5.0, "mmol/L", 4), lab(now, "3091-6", "Urea", 1.4, "mmol/L", 4), lab(now, "2823-3", "Potassium", 2.9, "mmol/L", 4), lab(now, "2777-1", "Phosphate", 0.5, "mmol/L", 4), lab(now, "19123-9", "Magnesium", 0.6, "mmol/L", 4),
        lab(now, "2692-1", "Osmolality, Serum", 222, "mOsm/kg", 4), lab(now, "2695-4", "Osmolality, Urine Random", 68, "mOsm/kg", 3.5), lab(now, "2955-3", "Sodium, Urine Random", 10, "mmol/L", 3.5)]) }) }
  ];
})();
