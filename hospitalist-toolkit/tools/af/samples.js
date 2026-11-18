/* MADE-UP patients for testing the AF tab. Times are relative to "now" (h = hours ago). None of these are real people. */
(function () {
  const iso = (now, h) => new Date(now - h * 36e5).toISOString();
  const obs = (cat, loinc, disp, val, unit) => (now, h) => ({ resourceType: "Observation", status: "final", category: [{ coding: [{ code: cat }] }],
    code: { coding: loinc ? [{ system: "http://loinc.org", code: loinc, display: disp }] : [], text: disp }, effectiveDateTime: iso(now, h), valueQuantity: { value: val, unit } });
  const lab = (now, loinc, disp, val, unit, h) => obs("laboratory", loinc, disp, val, unit)(now, h);
  const vit = (now, loinc, disp, val, unit, h) => obs("vital-signs", loinc, disp, val, unit)(now, h);
  /* hr/sbp/dbp series: [[hoursAgo, hr, sbp, dbp], ...] */
  const series = (now, rows) => [].concat(...rows.map(([h, hr, s, d, sat]) => [vit(now, "8867-4", "Heart rate", hr, "/min", h), vit(now, "8480-6", "Systolic BP", s, "mm[Hg]", h), vit(now, "8462-4", "Diastolic BP", d, "mm[Hg]", h)].concat(sat ? [vit(now, "59408-5", "SpO2", sat, "%", h)] : [])));
  const req = (name, status) => ({ resourceType: "MedicationRequest", status: status || "active", medicationCodeableConcept: { text: name } });
  const adm = (now, name, h) => ({ resourceType: "MedicationAdministration", status: "completed", medicationCodeableConcept: { text: name }, effectiveDateTime: iso(now, h) });
  const cond = (text, code) => ({ resourceType: "Condition", clinicalStatus: { coding: [{ code: "active" }] }, code: { coding: [{ system: "http://hl7.org/fhir/sid/icd-10", code }], text } });
  const pt = (age, gender) => ({ resourceType: "Patient", gender, birthDate: new Date(Date.now() - age * 365.25 * 864e5 - 30 * 864e5).toISOString().slice(0, 10) });
  const base = (now, k, mg, cr, extra) => [lab(now, "2823-3", "Potassium", k, "mmol/L", 3), lab(now, "19123-9", "Magnesium", mg, "mmol/L", 3), lab(now, "2160-0", "Creatinine", cr, "umol/L", 3),
    lab(now, "718-7", "Hemoglobin", 118, "g/L", 3), lab(now, "777-3", "Platelets", 210, "10*9/L", 3)].concat(extra || []);

  window.AF_SAMPLES = [
    { label: "A: 84 F, pneumonia day 2, new AF 130s, BP fine, low K and Mg, on azithromycin", sit: { rhythm: "af", onset: "lt48", ongoing: "yes", lvef: "unknown", qtc: 478, ecg: true },
      build: (now) => ({ patient: pt(84, "female"),
        conditions: [cond("Community acquired pneumonia", "J18.9"), cond("Hypertension", "I10"), cond("Osteoporosis", "M81.0")],
        obs: series(now, [[30, 88, 142, 78, 93], [20, 96, 138, 74, 92], [12, 124, 134, 76, 91], [8, 136, 128, 72, 92], [4, 132, 130, 74, 93], [1, 134, 128, 70, 93]]).concat(
          base(now, 3.4, 0.68, 92, [lab(now, "3016-3", "TSH", 1.8, "mU/L", 30), lab(now, "6690-2", "WBC", 14.2, "10*9/L", 3), vit(now, "29463-7", "Body weight", 54, "kg", 40)])),
        medreqs: [req("ceftriaxone 1 g IV q24h"), req("azithromycin 500 mg PO daily"), req("salbutamol 2.5 mg neb q4h PRN"), req("enoxaparin 40 mg subcut daily"), req("amlodipine 5 mg PO daily")],
        admins: [adm(now, "salbutamol 2.5 mg neb", 6), adm(now, "salbutamol 2.5 mg neb", 2), adm(now, "azithromycin 500 mg", 10)] }) },
    { label: "B: 79 M, COPD and pneumonia, known HFrEF (EF 30%), AF 140s, SBP mid 90s", sit: { rhythm: "af", onset: "unknown", ongoing: "yes", lvef: "low", qtc: 452, ecg: true },
      build: (now) => ({ patient: pt(79, "male"),
        conditions: [cond("Pneumonia", "J18.9"), cond("COPD", "J44.9"), cond("Heart failure with reduced ejection fraction", "I50.2"), cond("Type 2 diabetes", "E11.9"), cond("Coronary artery disease", "I25.10"), cond("Chronic kidney disease stage 3", "N18.3")],
        obs: series(now, [[24, 118, 104, 64, 90], [16, 136, 100, 62, 89], [8, 144, 96, 60, 90], [3, 142, 94, 58, 91], [1, 146, 95, 60, 90]]).concat(
          base(now, 4.2, 0.82, 148, [lab(now, "33762-6", "NT-proBNP", 6200, "ng/L", 10), lab(now, "89579-7", "Troponin I, high sensitivity", 38, "ng/L", 10), vit(now, "29463-7", "Body weight", 72, "kg", 20)])),
        medreqs: [req("piperacillin-tazobactam 4.5 g IV q8h"), req("bisoprolol 2.5 mg PO daily", "on-hold"), req("furosemide 40 mg IV BID"), req("tiotropium 18 mcg inhaled daily"), req("aspirin 81 mg PO daily"), req("enoxaparin 40 mg subcut daily"), req("atorvastatin 40 mg PO daily")],
        admins: [adm(now, "furosemide 40 mg IV", 4)] }) },
    { label: "C: 88 F, severe pneumonia with septic shock on norepinephrine, AF 150, lactate 4", sit: { rhythm: "af", onset: "lt48", ongoing: "yes", lvef: "unknown", ecg: true },
      build: (now) => ({ patient: pt(88, "female"),
        conditions: [cond("Pneumonia", "J18.9"), cond("Sepsis", "A41.9"), cond("Dementia", "F03.90"), cond("Hypertension", "I10")],
        obs: series(now, [[10, 112, 102, 58, 90], [6, 138, 88, 50, 88], [3, 152, 82, 46, 89], [1, 150, 84, 48, 90]]).concat(
          base(now, 3.6, 0.7, 168, [lab(now, "2524-7", "Lactate", 4.2, "mmol/L", 2), vit(now, "29463-7", "Body weight", 50, "kg", 30)])),
        medreqs: [req("norepinephrine infusion 0.08 mcg/kg/min"), req("meropenem 1 g IV q12h"), req("vancomycin IV per pharmacy"), req("heparin 5000 units subcut q12h")],
        admins: [adm(now, "sodium chloride 0.9% 500 mL bolus", 6), adm(now, "sodium chloride 0.9% 500 mL bolus", 4)] }) },
    { label: "D: 77 M, aspiration pneumonia, AF 2 days ago now sinus, on levofloxacin, HTN and diabetes", sit: { rhythm: "af", onset: "lt48", ongoing: "no", lvef: "ok", qtc: 466, ecg: true, echo: true },
      build: (now) => ({ patient: pt(77, "male"),
        conditions: [cond("Aspiration pneumonia", "J69.0"), cond("Hypertension", "I10"), cond("Type 2 diabetes", "E11.9"), cond("Alcohol use disorder", "F10.20")],
        obs: series(now, [[60, 134, 136, 80], [48, 118, 130, 78], [30, 92, 134, 80], [12, 84, 140, 82], [2, 80, 138, 80]]).concat(
          base(now, 4.1, 0.85, 104, [lab(now, "3016-3", "TSH", 2.4, "mU/L", 50), vit(now, "29463-7", "Body weight", 66, "kg", 40)])),
        medreqs: [req("levofloxacin 750 mg PO daily"), req("metoprolol tartrate 25 mg PO BID"), req("metformin 500 mg PO BID"), req("enoxaparin 40 mg subcut daily"), req("thiamine 100 mg PO daily")],
        admins: [adm(now, "metoprolol 5 mg IV", 50), adm(now, "metoprolol tartrate 25 mg PO", 12), adm(now, "metoprolol tartrate 25 mg PO", 1)] }) },
    { label: "E: 71 M, asthma flare with pneumonia, wheezy, AF 124, BP 138/82, LVEF 60%", sit: { rhythm: "af", onset: "lt48", ongoing: "yes", lvef: "ok", bronch: true, qtc: 440, ecg: true, echo: true },
      build: (now) => ({ patient: pt(71, "male"),
        conditions: [cond("Pneumonia", "J18.9"), cond("Asthma", "J45.909")],
        obs: series(now, [[14, 104, 142, 84, 92], [6, 122, 140, 82, 93], [2, 126, 138, 82, 94], [1, 124, 138, 82, 94]]).concat(base(now, 4.3, 0.9, 88, [vit(now, "29463-7", "Body weight", 84, "kg", 20)])),
        medreqs: [req("ceftriaxone 1 g IV q24h"), req("doxycycline 100 mg PO BID"), req("prednisone 40 mg PO daily"), req("salbutamol 5 mg neb q2h"), req("ipratropium 500 mcg neb q6h"), req("enoxaparin 40 mg subcut daily")],
        admins: [adm(now, "salbutamol 5 mg neb", 3), adm(now, "salbutamol 5 mg neb", 1)] }) }];
})();
