/* MADE-UP patients for testing. Times are relative to "now". Each sample is { label, build(now) -> { raw, disease, setting, flaring, entries, manualMeds, manualEndo } }.
   raw = FHIR-like resources that the page parses exactly like a real chart. None of these are real people. */
(function () {
  const iso = (now, d) => new Date(now - d * 864e5).toISOString();
  const lab = (now, loinc, disp, val, unit, d, lo, hi) => ({ resourceType: "Observation", status: "final", category: [{ coding: [{ code: "laboratory" }] }], code: { coding: loinc ? [{ system: "http://loinc.org", code: loinc, display: disp }] : [], text: disp }, effectiveDateTime: iso(now, d), valueQuantity: { value: val, unit },
    referenceRange: lo != null || hi != null ? [{ low: lo != null ? { value: lo } : undefined, high: hi != null ? { value: hi } : undefined }] : undefined });
  const txt = (now, disp, val, d) => ({ resourceType: "Observation", status: "final", category: [{ coding: [{ code: "laboratory" }] }], code: { text: disp }, effectiveDateTime: iso(now, d), valueString: val });
  const vit = (now, d, t, hr, sbp) => [
    { resourceType: "Observation", category: [{ coding: [{ code: "vital-signs" }] }], code: { coding: [{ system: "http://loinc.org", code: "8310-5" }], text: "Body temperature" }, effectiveDateTime: iso(now, d), valueQuantity: { value: t, unit: "degC" } },
    { resourceType: "Observation", category: [{ coding: [{ code: "vital-signs" }] }], code: { coding: [{ system: "http://loinc.org", code: "8867-4" }], text: "Heart rate" }, effectiveDateTime: iso(now, d), valueQuantity: { value: hr, unit: "/min" } },
    { resourceType: "Observation", category: [{ coding: [{ code: "vital-signs" }] }], code: { coding: [{ system: "http://loinc.org", code: "8480-6" }], text: "Systolic blood pressure" }, effectiveDateTime: iso(now, d), valueQuantity: { value: sbp, unit: "mm[Hg]" } }];
  const wt = (now, kg, d) => ({ resourceType: "Observation", category: [{ coding: [{ code: "vital-signs" }] }], code: { coding: [{ system: "http://loinc.org", code: "29463-7" }], text: "Body weight" }, effectiveDateTime: iso(now, d), valueQuantity: { value: kg, unit: "kg" } });
  const adm = (now, name, d) => ({ resourceType: "MedicationAdministration", status: "completed", medicationCodeableConcept: { text: name }, effectiveDateTime: iso(now, d) });
  const req = (now, name, d, status) => ({ resourceType: "MedicationRequest", status: status || "active", medicationCodeableConcept: { text: name }, authoredOn: iso(now, d) });
  const proc = (now, name, d, note) => ({ resourceType: "Procedure", status: "completed", code: { text: name }, performedDateTime: iso(now, d), note: note ? [{ text: note }] : undefined });
  const cond = (text, code, d, now) => ({ resourceType: "Condition", code: { coding: [{ system: "http://hl7.org/fhir/sid/icd-10", code }], text }, onsetDateTime: iso(now, d) });
  const pt = (age, gender) => ({ resourceType: "Patient", gender, birthDate: new Date(Date.now() - age * 365.25 * 864e5).toISOString().slice(0, 10) });

  window.IBD_SAMPLES = [
    { label: "A: Crohn disease, adalimumab, doing well", build: (now) => ({ disease: "cd", setting: "outpatient", flaring: false,
      entries: [{ t: now - 60 * 864e5, stools: 3, wellbeing: 1, pain: 1, mass: 0, comps: 0 }, { t: now - 2 * 864e5, stools: 2, wellbeing: 0, pain: 0, mass: 0, comps: 0 }],
      raw: { patient: pt(34, "female"), conditions: [cond("Crohn disease of small and large intestine", "K50.8", 365 * 6, now)],
        obs: [].concat(vit(now, 2, 36.7, 70, 118), [wt(now, 66, 2), wt(now, 65, 200)], [
          lab(now, "1988-5", "C reactive protein", 2, "mg/L", 2, 0, 8), lab(now, "1988-5", "C reactive protein", 14, "mg/L", 120, 0, 8), lab(now, "", "Fecal calprotectin", 38, "ug/g", 30), lab(now, "", "Fecal calprotectin", 410, "ug/g", 200),
          lab(now, "718-7", "Hemoglobin", 128, "g/L", 2, 120, 160), lab(now, "718-7", "Hemoglobin", 112, "g/L", 120, 120, 160), lab(now, "1751-7", "Albumin", 41, "g/L", 2, 35, 50), lab(now, "2276-4", "Ferritin", 55, "ug/L", 2, 15, 200),
          lab(now, "6690-2", "White blood cell count", 6.1, "10*9/L", 2, 4, 11), lab(now, "777-3", "Platelet count", 290, "10*9/L", 2, 150, 450), lab(now, "2132-9", "Vitamin B12", 310, "pmol/L", 2, 150, 700),
          lab(now, "", "Adalimumab trough level", 9.1, "ug/mL", 60), txt(now, "QuantiFERON TB Gold", "Negative", 400), txt(now, "Hepatitis B surface antigen", "Negative", 400), txt(now, "Hepatitis B core antibody total", "Negative", 400)]),
        admins: [adm(now, "Adalimumab (Humira) 40 mg subcut", 6), adm(now, "Adalimumab (Humira) 40 mg subcut", 20), adm(now, "Adalimumab (Humira) 40 mg subcut", 34)], medreqs: [req(now, "Adalimumab 40 mg subcut every 2 weeks", 300)],
        procs: [proc(now, "Colonoscopy with ileoscopy", 150, "SES-CD 2. Small aphthous ulcers in neoterminal ileum.")] } }) },
    { label: "B: Severe ulcerative colitis, admitted, IV steroid", build: (now) => ({ disease: "uc", setting: "inpatient", flaring: true,
      entries: [{ t: now - 2 * 864e5, stools: 9, normalStools: 1, blood: 3, pga: 3 }, { t: now - 0.2 * 864e5, stools: 8, normalStools: 1, blood: 3, pga: 3 }],
      raw: { patient: pt(28, "male"), conditions: [cond("Ulcerative colitis, left sided", "K51.5", 365 * 2, now)],
        obs: [].concat(vit(now, 2, 37.9, 112, 108), vit(now, 0.3, 38.1, 108, 110), [wt(now, 71, 2), wt(now, 77, 90)], [
          lab(now, "1988-5", "C reactive protein", 78, "mg/L", 0.3, 0, 8), lab(now, "4537-7", "Erythrocyte sedimentation rate", 44, "mm/h", 0.3), lab(now, "718-7", "Hemoglobin", 98, "g/L", 0.3, 130, 170), lab(now, "1751-7", "Albumin", 26, "g/L", 0.3, 35, 50),
          lab(now, "6690-2", "White blood cell count", 14.2, "10*9/L", 0.3, 4, 11), lab(now, "777-3", "Platelet count", 520, "10*9/L", 0.3, 150, 450), lab(now, "2823-3", "Potassium", 3.1, "mmol/L", 0.3, 3.5, 5.1), lab(now, "2276-4", "Ferritin", 18, "ug/L", 0.3, 30, 300)]),
        admins: [adm(now, "Methylprednisolone 60 mg IV", 2), adm(now, "Methylprednisolone 60 mg IV", 1), adm(now, "Methylprednisolone 60 mg IV", 0.2), adm(now, "Loperamide 2 mg", 1.5)], medreqs: [req(now, "Mesalamine 4.8 g oral daily", 400, "active")],
        procs: [] } }) },
    { label: "C: Crohn disease, infliximab + azathioprine, losing response", build: (now) => ({ disease: "cd", setting: "outpatient", flaring: true,
      entries: [{ t: now - 3 * 864e5, stools: 7, wellbeing: 2, pain: 2, mass: 1, comps: 1 }],
      raw: { patient: pt(45, "female"), conditions: [cond("Crohn disease of ileum", "K50.0", 365 * 11, now)],
        obs: [].concat(vit(now, 3, 37.2, 88, 112), [wt(now, 58, 3), wt(now, 63, 100)], [
          lab(now, "1988-5", "C reactive protein", 46, "mg/L", 3, 0, 8), lab(now, "", "Fecal calprotectin", 880, "ug/g", 10), lab(now, "718-7", "Hemoglobin", 102, "g/L", 3, 120, 160), lab(now, "1751-7", "Albumin", 32, "g/L", 3, 35, 50),
          lab(now, "6690-2", "White blood cell count", 2.7, "10*9/L", 3, 4, 11), lab(now, "751-8", "Neutrophils", 1.3, "10*9/L", 3, 2, 7.5), lab(now, "1742-6", "Alanine aminotransferase", 96, "U/L", 3, 0, 40), lab(now, "777-3", "Platelet count", 410, "10*9/L", 3, 150, 450),
          lab(now, "2276-4", "Ferritin", 24, "ug/L", 3, 15, 200), lab(now, "2132-9", "Vitamin B12", 128, "pmol/L", 3, 150, 700), lab(now, "1989-3", "25-hydroxy vitamin D", 38, "nmol/L", 3, 50, 150)]),
        admins: [adm(now, "Infliximab (Remicade) 5 mg/kg IV", 25), adm(now, "Infliximab (Remicade) 5 mg/kg IV", 81)], medreqs: [req(now, "Azathioprine 150 mg oral daily", 800)],
        procs: [proc(now, "Colonoscopy", 500, "Ileocolonic Crohn disease, SES-CD 9, ulcers in neoterminal ileum")], reports: [] } }) },
    { label: "D: Ulcerative colitis, vedolizumab, long steroid course, no screening", build: (now) => ({ disease: "uc", setting: "outpatient", flaring: false,
      entries: [{ t: now - 10 * 864e5, stools: 3, normalStools: 1, blood: 1, pga: 1 }],
      raw: { patient: pt(61, "male"), conditions: [cond("Ulcerative colitis, pancolitis", "K51.0", 365 * 10, now)],
        obs: [].concat(vit(now, 10, 36.6, 76, 134), [
          lab(now, "1988-5", "C reactive protein", 9, "mg/L", 10, 0, 8), lab(now, "", "Fecal calprotectin", 190, "ug/g", 14), lab(now, "718-7", "Hemoglobin", 118, "g/L", 10, 130, 170), lab(now, "2345-7", "Glucose", 11.8, "mmol/L", 5, 3.5, 7.8),
          lab(now, "2276-4", "Ferritin", 160, "ug/L", 10, 30, 400), lab(now, "2502-3", "Transferrin saturation", 12, "%", 10, 20, 50)]),
        admins: [adm(now, "Vedolizumab (Entyvio) 300 mg IV", 20), adm(now, "Vedolizumab (Entyvio) 300 mg IV", 76)], medreqs: [req(now, "Prednisone 20 mg oral daily", 100, "active"), req(now, "Mesalamine 4 g oral daily", 900, "active"), req(now, "Ibuprofen 400 mg oral", 6, "active")],
        procs: [proc(now, "Flexible sigmoidoscopy", 700, "Mayo endoscopic subscore 2")] } }) },
    { label: "E: Crohn disease after ileocecal resection, ustekinumab, low B12", build: (now) => ({ disease: "cd", setting: "outpatient", flaring: false,
      entries: [{ t: now - 14 * 864e5, stools: 4, wellbeing: 1, pain: 1, mass: 0, comps: 0 }],
      raw: { patient: pt(39, "male"), conditions: [cond("Crohn disease of ileum", "K50.0", 365 * 9, now)],
        obs: [].concat(vit(now, 14, 36.8, 74, 122), [wt(now, 68, 14), wt(now, 76, 110)], [
          lab(now, "1988-5", "C reactive protein", 6, "mg/L", 14, 0, 8), lab(now, "", "Fecal calprotectin", 320, "ug/g", 20), lab(now, "718-7", "Hemoglobin", 131, "g/L", 14, 130, 170), lab(now, "2132-9", "Vitamin B12", 98, "pmol/L", 14, 150, 700),
          lab(now, "1989-3", "25-hydroxy vitamin D", 44, "nmol/L", 14, 50, 150), lab(now, "1751-7", "Albumin", 36, "g/L", 14, 35, 50),
          txt(now, "QuantiFERON TB Gold", "Negative", 300), txt(now, "Hepatitis B surface antigen", "Negative", 300), txt(now, "Hepatitis B core antibody total", "Negative", 300), txt(now, "Varicella zoster IgG", "Positive", 300)]),
        admins: [adm(now, "Ustekinumab (Stelara) 90 mg subcut", 30), adm(now, "Ustekinumab (Stelara) 90 mg subcut", 86), adm(now, "Cyanocobalamin 1000 mcg IM", 40)], medreqs: [],
        procs: [proc(now, "Colonoscopy with ileoscopy", 90, "Post-operative assessment. Rutgeerts i3: more than 5 aphthous ulcers with diffusely inflamed mucosa between them.")] } }) },
    { label: "F: New ulcerative colitis, mesalamine, C. difficile positive", build: (now) => ({ disease: "uc", setting: "outpatient", flaring: true,
      entries: [{ t: now - 1 * 864e5, stools: 6, normalStools: 1, blood: 2, pga: 2 }],
      raw: { patient: pt(22, "female"), conditions: [cond("Ulcerative colitis", "K51.9", 20, now)],
        obs: [].concat(vit(now, 1, 37.4, 92, 116), [
          lab(now, "1988-5", "C reactive protein", 22, "mg/L", 1, 0, 8), lab(now, "", "Fecal calprotectin", 1450, "ug/g", 3), txt(now, "Clostridioides difficile toxin B PCR", "Detected", 3), lab(now, "718-7", "Hemoglobin", 124, "g/L", 1, 120, 160)]),
        admins: [], medreqs: [req(now, "Mesalamine 2.4 g oral daily", 18, "active"), req(now, "Vancomycin 125 mg oral four times daily", 2, "active")],
        procs: [] } }) }
  ];
})();
