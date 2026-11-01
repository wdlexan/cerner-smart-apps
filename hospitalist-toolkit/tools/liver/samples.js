/* MADE-UP patients for testing the liver tab. Times are relative to "now". None of these are real people. */
(function () {
  const iso = (now, d) => new Date(now - d * 864e5).toISOString();
  const lab = (now, loinc, disp, val, unit, d, hi) => ({ resourceType: "Observation", status: "final", category: [{ coding: [{ code: "laboratory" }] }],
    code: { coding: loinc ? [{ system: "http://loinc.org", code: loinc, display: disp }] : [], text: disp }, effectiveDateTime: iso(now, d), valueQuantity: { value: val, unit },
    referenceRange: hi != null ? [{ high: { value: hi } }] : undefined });
  const txt = (now, disp, val, d) => ({ resourceType: "Observation", status: "final", category: [{ coding: [{ code: "laboratory" }] }], code: { text: disp }, effectiveDateTime: iso(now, d), valueString: val });
  const set = (now, d, bili, creat, inr, na, alb) => [
    lab(now, "1975-2", "Bilirubin total", bili, "umol/L", d), lab(now, "2160-0", "Creatinine", creat, "umol/L", d), lab(now, "6301-6", "INR", inr, "", d),
    lab(now, "2951-2", "Sodium", na, "mmol/L", d), lab(now, "1751-7", "Albumin", alb, "g/L", d)];
  const cbc = (now, d, hgb, plt) => [lab(now, "718-7", "Hemoglobin", hgb, "g/L", d), lab(now, "777-3", "Platelet count", plt, "10*9/L", d)];
  const bp = (now, d, s, dia, hr, spo2) => [
    { resourceType: "Observation", category: [{ coding: [{ code: "vital-signs" }] }], code: { coding: [{ system: "http://loinc.org", code: "85354-9" }], text: "Blood pressure" }, effectiveDateTime: iso(now, d),
      component: [{ code: { coding: [{ code: "8480-6" }], text: "Systolic" }, valueQuantity: { value: s, unit: "mm[Hg]" } }, { code: { coding: [{ code: "8462-4" }], text: "Diastolic" }, valueQuantity: { value: dia, unit: "mm[Hg]" } }] },
    { resourceType: "Observation", category: [{ coding: [{ code: "vital-signs" }] }], code: { coding: [{ system: "http://loinc.org", code: "8867-4" }], text: "Heart rate" }, effectiveDateTime: iso(now, d), valueQuantity: { value: hr, unit: "/min" } },
    { resourceType: "Observation", category: [{ coding: [{ code: "vital-signs" }] }], code: { coding: [{ system: "http://loinc.org", code: "59408-5" }], text: "SpO2" }, effectiveDateTime: iso(now, d), valueQuantity: { value: spo2, unit: "%" } }];
  const wh = (now, kg, cm) => [
    { resourceType: "Observation", category: [{ coding: [{ code: "vital-signs" }] }], code: { coding: [{ system: "http://loinc.org", code: "29463-7" }], text: "Body weight" }, effectiveDateTime: iso(now, 1), valueQuantity: { value: kg, unit: "kg" } },
    { resourceType: "Observation", category: [{ coding: [{ code: "vital-signs" }] }], code: { coding: [{ system: "http://loinc.org", code: "8302-2" }], text: "Body height" }, effectiveDateTime: iso(now, 30), valueQuantity: { value: cm, unit: "cm" } }];
  /* one paracentesis: fluid tests named the way many labs name them */
  const tap = (now, d, o) => [
    o.wbc != null && lab(now, "", "WBC Count, Peritoneal Fluid", o.wbc, "/uL", d), o.pct != null && lab(now, "", "Neutrophils %, Peritoneal Fluid", o.pct, "%", d),
    o.rbc != null && lab(now, "", "RBC Count, Peritoneal Fluid", o.rbc, "/uL", d), o.alb != null && lab(now, "", "Albumin, Peritoneal Fluid", o.alb, "g/L", d),
    o.prot != null && lab(now, "", "Protein Total, Peritoneal Fluid", o.prot, "g/L", d), o.glu != null && lab(now, "", "Glucose, Peritoneal Fluid", o.glu, "mmol/L", d),
    o.ldh != null && lab(now, "", "LDH, Peritoneal Fluid", o.ldh, "U/L", d), o.cult && txt(now, "Culture, Peritoneal Fluid", o.cult, d)].filter(Boolean);
  const req = (now, name, d, status) => ({ resourceType: "MedicationRequest", status: status || "active", medicationCodeableConcept: { text: name }, authoredOn: iso(now, d) });
  const adm = (now, name, d) => ({ resourceType: "MedicationAdministration", status: "completed", medicationCodeableConcept: { text: name }, effectiveDateTime: iso(now, d) });
  const cond = (text, code) => ({ resourceType: "Condition", code: { coding: [{ system: "http://hl7.org/fhir/sid/icd-10", code }], text } });
  const proc = (now, name, d) => ({ resourceType: "Procedure", status: "completed", code: { text: name }, performedDateTime: iso(now, d) });
  const pt = (age, gender) => ({ resourceType: "Patient", gender, birthDate: new Date(Date.now() - age * 365.25 * 864e5).toISOString().slice(0, 10) });

  window.LIVER_SAMPLES = [
    { label: "A: Compensated hepatitis C cirrhosis (Child A), outpatient", ascites: 1, he: 1, build: (now) => ({
      patient: pt(61, "male"), conditions: [cond("Cirrhosis of liver due to chronic hepatitis C", "K74.6")],
      obs: [].concat(set(now, 180, 18, 82, 1.1, 139, 39), set(now, 90, 20, 85, 1.2, 138, 38), set(now, 1, 22, 88, 1.2, 138, 37), cbc(now, 1, 138, 110), bp(now, 1, 124, 76, 68, 98), wh(now, 82, 178)),
      medreqs: [req(now, "Carvedilol 6.25 mg PO BID", 200)] }) },

    { label: "B: Alcohol cirrhosis, ascites, AKI after albumin (HRS-AKI)", ascites: 3, he: 2, build: (now) => ({
      patient: pt(54, "female"), conditions: [cond("Alcoholic cirrhosis of liver with ascites", "K70.31"), cond("Hepatic encephalopathy", "K76.82")],
      obs: [].concat(set(now, 60, 38, 74, 1.5, 134, 29), set(now, 5, 62, 118, 1.8, 129, 25), set(now, 3, 70, 145, 1.9, 127, 24), set(now, 0.3, 78, 182, 2.1, 126, 23),
        cbc(now, 2, 99, 62), cbc(now, 0.3, 97, 58), [lab(now, "2823-3", "Potassium", 4.9, "mmol/L", 0.3), lab(now, "3091-6", "Urea", 14.2, "mmol/L", 0.3)],
        [lab(now, "2955-3", "Sodium, Urine Random", 8, "mmol/L", 0.5), lab(now, "14683-7", "Creatinine, Urine Random", 9.5, "mmol/L", 0.5), lab(now, "", "Protein/Creatinine Ratio, Urine", 18, "mg/mmol", 0.5), lab(now, "13945-1", "RBC, Urine", 2, "/HPF", 0.5)],
        tap(now, 2, { wbc: 180, pct: 20, alb: 9, prot: 11, cult: "No growth at 48 hours" }),
        bp(now, 0.2, 98, 52, 92, 96), bp(now, 0.6, 102, 56, 90, 97), wh(now, 68, 165)),
      medreqs: [req(now, "Spironolactone 100 mg PO daily", 40, "stopped"), req(now, "Furosemide 40 mg PO daily", 40, "stopped"), req(now, "Nadolol 40 mg PO daily", 100), req(now, "Lactulose 30 mL PO TID titrate to 2-3 BM/day", 5), req(now, "Rifaximin 550 mg PO BID", 5)],
      admins: [adm(now, "Albumin 25% 100 mL IV", 1.4), adm(now, "Albumin 25% 100 mL IV", 1.0), adm(now, "Albumin 25% 100 mL IV", 0.4)] }) },

    { label: "C: Cirrhosis on hemodialysis and warfarin", ascites: 2, he: 1, build: (now) => ({
      patient: pt(68, "male"), conditions: [cond("Cirrhosis of liver, NASH", "K75.81"), cond("Cirrhosis of liver", "K74.60"), cond("End stage renal disease", "N18.6")],
      obs: [].concat(set(now, 30, 30, 540, 2.6, 135, 30), set(now, 1, 34, 610, 2.8, 133, 29), cbc(now, 1, 104, 95), bp(now, 0.5, 132, 70, 74, 97), wh(now, 88, 175)),
      medreqs: [req(now, "Warfarin 3 mg PO daily", 200)], procs: [proc(now, "Hemodialysis", 1), proc(now, "Hemodialysis", 3), proc(now, "Hemodialysis", 5)] }) },

    { label: "D: Primary biliary cholangitis, US units (mg/dL)", ascites: 1, he: 1, cholestatic: true, build: (now) => ({
      patient: pt(57, "female"), conditions: [cond("Primary biliary cholangitis", "K74.3")],
      obs: [lab(now, "1975-2", "Bilirubin total", 3.4, "mg/dL", 2), lab(now, "2160-0", "Creatinine", 0.8, "mg/dL", 2), lab(now, "6301-6", "INR", 1.2, "", 2),
        lab(now, "2951-2", "Sodium", 137, "mmol/L", 2), lab(now, "1751-7", "Albumin", 3.4, "g/dL", 2)] }) },

    { label: "E: Labs incomplete (no INR in 2 weeks)", build: (now) => ({
      patient: pt(49, "male"), conditions: [cond("Alcoholic cirrhosis of liver", "K70.30")],
      obs: [].concat([lab(now, "6301-6", "INR", 1.6, "", 40)], [lab(now, "1975-2", "Bilirubin total", 41, "umol/L", 1), lab(now, "2160-0", "Creatinine", 96, "umol/L", 1), lab(now, "2951-2", "Sodium", 131, "mmol/L", 1), lab(now, "1751-7", "Albumin", 31, "g/L", 1)]) }) },

    { label: "F: Fever and abdominal pain, ascitic PMN 1260 (SBP)", ascites: 3, he: 1, build: (now) => ({
      patient: pt(63, "male"), conditions: [cond("Alcoholic cirrhosis of liver with ascites", "K70.31")],
      obs: [].concat(set(now, 50, 70, 84, 1.7, 133, 28), set(now, 0.2, 92, 102, 1.9, 130, 26), cbc(now, 0.2, 112, 88), [lab(now, "6690-2", "WBC", 13.1, "10*9/L", 0.2), lab(now, "3091-6", "Urea", 11.8, "mmol/L", 0.2), lab(now, "2532-0", "LDH", 210, "U/L", 0.2, 225)],
        tap(now, 0.15, { wbc: 1800, pct: 70, rbc: 3000, alb: 6, prot: 8, glu: 6.0, ldh: 90, cult: "Pending" }), bp(now, 0.1, 104, 60, 104, 95), wh(now, 75, 176)),
      medreqs: [req(now, "Spironolactone 100 mg PO daily", 60), req(now, "Furosemide 40 mg PO daily", 60), req(now, "Propranolol 20 mg PO BID", 200)] }) },

    { label: "G: Admitted, tense ascites, obese, refeeding risk, needs VTE prophylaxis", ascites: 3, he: 1, build: (now) => ({
      patient: pt(72, "female"), conditions: [cond("Alcoholic cirrhosis of liver with ascites", "K70.31"), cond("Pneumonia", "J18.9"), cond("Hepatocellular carcinoma", "C22.0")],
      obs: [].concat(set(now, 40, 30, 70, 1.4, 136, 31), set(now, 0.5, 34, 72, 1.5, 134, 30), cbc(now, 0.5, 118, 104),
        [lab(now, "2823-3", "Potassium", 3.2, "mmol/L", 0.5), lab(now, "19123-9", "Magnesium", 0.62, "mmol/L", 0.5), lab(now, "2777-1", "Phosphate", 0.58, "mmol/L", 0.5)],
        tap(now, 1, { wbc: 140, pct: 15, alb: 7, prot: 9, cult: "No growth" }), bp(now, 0.3, 128, 74, 84, 95), wh(now, 112, 162)),
      medreqs: [req(now, "Spironolactone 200 mg PO daily", 20), req(now, "Furosemide 40 mg PO BID", 20), req(now, "Ceftriaxone 1 g IV q24h", 1)] }) }
  ];
})();
