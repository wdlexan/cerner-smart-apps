/* MADE-UP patients for testing the liver scores tab. Times are relative to "now". None of these are real people. */
(function () {
  const iso = (now, d) => new Date(now - d * 864e5).toISOString();
  const lab = (now, loinc, disp, val, unit, d) => ({ resourceType: "Observation", status: "final", category: [{ coding: [{ code: "laboratory" }] }],
    code: { coding: loinc ? [{ system: "http://loinc.org", code: loinc, display: disp }] : [], text: disp }, effectiveDateTime: iso(now, d), valueQuantity: { value: val, unit } });
  /* one set of the five liver labs on day d (days ago) */
  const set = (now, d, bili, creat, inr, na, alb) => [
    lab(now, "1975-2", "Bilirubin total", bili, "umol/L", d), lab(now, "2160-0", "Creatinine", creat, "umol/L", d), lab(now, "6301-6", "INR", inr, "", d),
    lab(now, "2951-2", "Sodium", na, "mmol/L", d), lab(now, "1751-7", "Albumin", alb, "g/L", d)];
  const req = (now, name, d) => ({ resourceType: "MedicationRequest", status: "active", medicationCodeableConcept: { text: name }, authoredOn: iso(now, d) });
  const cond = (text, code) => ({ resourceType: "Condition", code: { coding: [{ system: "http://hl7.org/fhir/sid/icd-10", code }], text } });
  const proc = (now, name, d) => ({ resourceType: "Procedure", status: "completed", code: { text: name }, performedDateTime: iso(now, d) });
  const pt = (age, gender) => ({ resourceType: "Patient", gender, birthDate: new Date(Date.now() - age * 365.25 * 864e5).toISOString().slice(0, 10) });

  window.LIVER_SAMPLES = [
    { label: "A: Compensated hepatitis C cirrhosis (Child A)", ascites: 1, he: 1, build: (now) => ({
      patient: pt(61, "male"), conditions: [cond("Cirrhosis of liver due to chronic hepatitis C", "K74.6")],
      obs: [].concat(set(now, 180, 18, 82, 1.1, 139, 39), set(now, 90, 20, 85, 1.2, 138, 38), set(now, 1, 22, 88, 1.2, 138, 37)) }) },

    { label: "B: Alcohol cirrhosis, ascites, admitted, MELD-Na rising", build: (now) => ({
      patient: pt(54, "female"), conditions: [cond("Alcoholic cirrhosis of liver with ascites", "K70.31"), cond("Hepatic encephalopathy", "K76.82")],
      obs: [].concat(set(now, 60, 38, 74, 1.5, 134, 29), set(now, 5, 62, 118, 1.8, 129, 25), set(now, 3, 70, 145, 1.9, 127, 24), set(now, 0.3, 78, 182, 2.1, 126, 23)),
      medreqs: [req(now, "Spironolactone 100 mg PO daily", 40), req(now, "Furosemide 40 mg PO daily", 40), req(now, "Lactulose 30 mL PO TID titrate to 2-3 BM/day", 5), req(now, "Rifaximin 550 mg PO BID", 5), req(now, "Albumin 25% 100 mL IV", 2)] }) },

    { label: "C: Cirrhosis on hemodialysis and warfarin", ascites: 2, he: 1, build: (now) => ({
      patient: pt(68, "male"), conditions: [cond("Cirrhosis of liver, NASH", "K75.81"), cond("Cirrhosis of liver", "K74.60"), cond("End stage renal disease", "N18.6")],
      obs: [].concat(set(now, 30, 30, 540, 2.6, 135, 30), set(now, 1, 34, 610, 2.8, 133, 29)),
      medreqs: [req(now, "Warfarin 3 mg PO daily", 200)], procs: [proc(now, "Hemodialysis", 1), proc(now, "Hemodialysis", 3), proc(now, "Hemodialysis", 5)] }) },

    { label: "D: Primary biliary cholangitis, US units (mg/dL)", ascites: 1, he: 1, cholestatic: true, build: (now) => ({
      patient: pt(57, "female"), conditions: [cond("Primary biliary cholangitis", "K74.3")],
      obs: [lab(now, "1975-2", "Bilirubin total", 3.4, "mg/dL", 2), lab(now, "2160-0", "Creatinine", 0.8, "mg/dL", 2), lab(now, "6301-6", "INR", 1.2, "", 2),
        lab(now, "2951-2", "Sodium", 137, "mmol/L", 2), lab(now, "1751-7", "Albumin", 3.4, "g/dL", 2)] }) },

    { label: "E: Labs incomplete (no INR in 2 weeks)", build: (now) => ({
      patient: pt(49, "male"), conditions: [cond("Alcoholic cirrhosis of liver", "K70.30")],
      obs: [].concat([lab(now, "6301-6", "INR", 1.6, "", 40)], [lab(now, "1975-2", "Bilirubin total", 41, "umol/L", 1), lab(now, "2160-0", "Creatinine", 96, "umol/L", 1), lab(now, "2951-2", "Sodium", 131, "mmol/L", 1), lab(now, "1751-7", "Albumin", 31, "g/L", 1)]) }) }
  ];
})();
