/* MADE-UP patients for testing the kidney transplant tab. Times are hours before "now". None of these are real people. */
(function () {
  const iso = (now, h) => new Date(now - h * 36e5).toISOString();
  const lab = (now, loinc, disp, val, unit, h) => ({ resourceType: "Observation", status: "final", category: [{ coding: [{ code: "laboratory" }] }],
    code: { coding: loinc ? [{ system: "http://loinc.org", code: loinc, display: disp }] : [], text: disp }, effectiveDateTime: iso(now, h), valueQuantity: { value: val, unit } });
  const tac = (now, v, h) => lab(now, "", "Tacrolimus Level", v, "ug/L", h);
  const cr = (now, v, h) => lab(now, "2160-0", "Creatinine", v, "umol/L", h);
  const req = (now, name, h, status, endH) => {
    const r = { resourceType: "MedicationRequest", status: status || "active", medicationCodeableConcept: { text: name }, authoredOn: iso(now, h) };
    if (endH != null) r.dosageInstruction = [{ timing: { repeat: { boundsPeriod: { start: iso(now, h), end: iso(now, endH) } } } }];
    return r;
  };
  const adm = (now, name, h) => ({ resourceType: "MedicationAdministration", status: "completed", medicationCodeableConcept: { text: name }, effectiveDateTime: iso(now, h) });
  const cond = (text, code) => ({ resourceType: "Condition", clinicalStatus: { coding: [{ code: "active" }] }, code: { coding: [{ system: "http://hl7.org/fhir/sid/icd-10", code }], text } });
  const pt = (age, gender) => ({ resourceType: "Patient", gender, birthDate: new Date(Date.now() - age * 365.25 * 864e5).toISOString().slice(0, 10) });
  const ktx = cond("Kidney transplant status", "Z94.0");
  const base = (now, kind) => ({ tacrolimus: req(now, "Tacrolimus (Advagraf) 6 mg PO daily", 4000), mmf: req(now, "Mycophenolate mofetil (CellCept) 750 mg PO BID", 4000),
    mps: req(now, "Mycophenolate sodium (Myfortic) 540 mg PO BID", 4000), pred: req(now, "Prednisone 5 mg PO daily", 4000) })[kind];

  window.TX_SAMPLES = [
    { label: "A: Pneumonia, clarithromycin started 2 days ago, ibuprofen PRN", targets: { tacrolimus: [5, 8] }, build: (now) => ({
      patient: pt(58, "male"), conditions: [ktx, cond("Community acquired pneumonia", "J18.9")],
      medreqs: [base(now, "tacrolimus"), base(now, "mmf"), base(now, "pred"), req(now, "Clarithromycin 500 mg PO BID", 50), req(now, "Ibuprofen 400 mg PO q6h PRN pain", 40),
        req(now, "Pantoprazole 40 mg PO daily", 300), req(now, "Sulfamethoxazole-trimethoprim SS 400-80 mg PO daily (PJP prophylaxis)", 4000), req(now, "Ondansetron 4 mg IV q8h PRN", 40)],
      admins: [adm(now, "Clarithromycin 500 mg PO", 48), adm(now, "Clarithromycin 500 mg PO", 36), adm(now, "Clarithromycin 500 mg PO", 24), adm(now, "Clarithromycin 500 mg PO", 12)],
      obs: [tac(now, 7.2, 120), cr(now, 112, 720), cr(now, 118, 120), cr(now, 128, 30), cr(now, 150, 2),
        lab(now, "2823-3", "Potassium", 5.8, "mmol/L", 2), lab(now, "19123-9", "Magnesium", 0.61, "mmol/L", 2), lab(now, "2345-7", "Glucose", 9.4, "mmol/L", 2),
        lab(now, "6690-2", "WBC", 11.2, "10*9/L", 2), lab(now, "777-3", "Platelets", 210, "10*9/L", 2), lab(now, "718-7", "Hemoglobin", 118, "g/L", 2)] }) },

    { label: "B: COVID-19, Paxlovid started yesterday", targets: { tacrolimus: [5, 8] }, build: (now) => ({
      patient: pt(67, "female"), conditions: [ktx, cond("COVID-19", "U07.1"), cond("Type 2 diabetes mellitus", "E11.9")],
      medreqs: [base(now, "tacrolimus"), base(now, "mmf"), base(now, "pred"), req(now, "Nirmatrelvir/ritonavir (Paxlovid) 300/100 mg PO BID x 5 days", 20),
        req(now, "Atovaquone 1500 mg PO daily", 4000), req(now, "Insulin glargine 18 units SC qHS", 4000)],
      admins: [adm(now, "Nirmatrelvir/ritonavir 300/100 mg PO", 19), adm(now, "Nirmatrelvir/ritonavir 300/100 mg PO", 7)],
      obs: [tac(now, 6.5, 40), cr(now, 95, 200), cr(now, 98, 20), lab(now, "2823-3", "Potassium", 4.6, "mmol/L", 20), lab(now, "2345-7", "Glucose", 14.2, "mmol/L", 3),
        lab(now, "6690-2", "WBC", 4.1, "10*9/L", 20), lab(now, "718-7", "Hemoglobin", 124, "g/L", 20)] }) },

    { label: "C: Gout flare on cyclosporine + azathioprine; simvastatin, allopurinol, diarrhea", targets: {}, build: (now) => ({
      patient: pt(71, "male"), conditions: [cond("Kidney replaced by transplant", "Z94.0"), cond("Gout flare", "M10.9"), cond("Diarrhea", "R19.7")],
      medreqs: [req(now, "Cyclosporine (Neoral) 100 mg PO BID", 9000), req(now, "Azathioprine 75 mg PO daily", 9000), base(now, "pred"),
        req(now, "Simvastatin 40 mg PO qHS", 9000), req(now, "Allopurinol 100 mg PO daily", 2000), req(now, "Colchicine 0.6 mg PO BID", 30)],
      obs: [lab(now, "", "Cyclosporine Level", 145, "ug/L", 240), cr(now, 140, 400), cr(now, 152, 10), lab(now, "2823-3", "Potassium", 5.2, "mmol/L", 10),
        lab(now, "6690-2", "WBC", 3.4, "10*9/L", 10), lab(now, "777-3", "Platelets", 140, "10*9/L", 10), lab(now, "718-7", "Hemoglobin", 104, "g/L", 10), lab(now, "718-7", "Hemoglobin", 126, "g/L", 40),
        Object.assign(lab(now, "2157-6", "Creatine Kinase", 1240, "U/L", 10), { referenceRange: [{ high: { value: 200 } }] })] }) },

    { label: "D: CMV on valganciclovir, low WBC; fluconazole stopped 3 days ago; vancomycin + gentamicin", targets: { tacrolimus: [5, 8] }, build: (now) => ({
      patient: pt(49, "female"), conditions: [ktx, cond("Cytomegalovirus viremia", "B25.9"), cond("Bacteremia", "R78.81")],
      medreqs: [base(now, "tacrolimus"), base(now, "mps"), base(now, "pred"), req(now, "Fluconazole 200 mg PO daily", 240, "stopped", 72),
        req(now, "Valganciclovir 450 mg PO BID", 200), req(now, "Vancomycin 1250 mg IV q12h", 50), req(now, "Gentamicin 340 mg IV q24h", 48),
        req(now, "Calcium carbonate 1250 mg PO TID with meals", 2000)],
      obs: [tac(now, 10.8, 100), tac(now, 9.1, 24), cr(now, 88, 400), cr(now, 92, 100), cr(now, 101, 3),
        lab(now, "6690-2", "WBC", 2.4, "10*9/L", 3), lab(now, "751-8", "Neutrophils", 0.8, "10*9/L", 3), lab(now, "777-3", "Platelets", 95, "10*9/L", 3),
        lab(now, "2823-3", "Potassium", 4.3, "mmol/L", 3), lab(now, "19123-9", "Magnesium", 0.58, "mmol/L", 3)] }) },

    { label: "E: Sirolimus, NPO for surgery, CT with contrast, TMP-SMX prophylaxis", targets: { sirolimus: [4, 8] }, build: (now) => ({
      patient: pt(62, "male"), conditions: [ktx, cond("Acute cholecystitis", "K81.0")],
      medreqs: [req(now, "Sirolimus (Rapamune) 2 mg PO daily", 6000), base(now, "pred"), req(now, "Ramipril 5 mg PO daily", 6000),
        req(now, "Sulfamethoxazole-trimethoprim DS 800-160 mg PO three times a week (Mon/Wed/Fri)", 6000), req(now, "Piperacillin-tazobactam 3.375 g IV q6h", 20)],
      orders: [{ resourceType: "NutritionOrder", status: "active", oralDiet: { type: [{ text: "NPO" }] } },
        { resourceType: "ServiceRequest", status: "active", code: { text: "CT Abdomen Pelvis with Contrast" } }],
      obs: [lab(now, "", "Sirolimus Level", 6.1, "ug/L", 220), cr(now, 120, 900), cr(now, 124, 8), lab(now, "2823-3", "Potassium", 4.8, "mmol/L", 8), lab(now, "6690-2", "WBC", 13.5, "10*9/L", 8)] }) },

    { label: "F: Not a transplant patient (pneumonia on clarithromycin)", targets: {}, build: (now) => ({
      patient: pt(80, "female"), conditions: [cond("Community acquired pneumonia", "J18.9")],
      medreqs: [req(now, "Clarithromycin 500 mg PO BID", 30), req(now, "Ceftriaxone 1 g IV q24h", 30)],
      obs: [cr(now, 80, 20)] }) }
  ];
})();
