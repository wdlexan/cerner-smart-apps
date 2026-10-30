/* MADE-UP patients for testing. Times are relative to "now" so the 48-hour window, overdue timers and fever patterns always behave the same.
   Each sample is { label, build(now) -> { raw, where, set } }. raw = FHIR-like resources the page parses exactly like a real chart; set = bedside entries pre-filled. */
(function () {
  const iso = (now, h) => new Date(now - h * 36e5).toISOString();
  const O = (now, loinc, disp, val, unit, h, cat) => ({ resourceType: "Observation", status: "final", category: [{ coding: [{ code: cat || "vital-signs" }] }], code: { coding: [{ system: "http://loinc.org", code: loinc, display: disp }], text: disp }, effectiveDateTime: iso(now, h), valueQuantity: { value: val, unit } });
  const vit = (now, h, t, sbp, hr, rr, sp) => [O(now, "8310-5", "Body temperature", t, "degC", h), O(now, "8480-6", "Systolic blood pressure", sbp, "mm[Hg]", h), O(now, "8867-4", "Heart rate", hr, "/min", h), O(now, "9279-1", "Respiratory rate", rr, "/min", h), O(now, "59408-5", "Oxygen saturation by pulse oximetry", sp, "%", h)];
  const lab = (now, loinc, disp, val, unit, h, lo, hi) => Object.assign(O(now, loinc, disp, val, unit, h, "laboratory"), { referenceRange: [{ low: lo != null ? { value: lo } : undefined, high: hi != null ? { value: hi } : undefined }] });
  const adm = (now, name, h) => ({ resourceType: "MedicationAdministration", status: "completed", medicationCodeableConcept: { text: name }, effectiveDateTime: iso(now, h) });
  const pt = (age, gender) => ({ resourceType: "Patient", gender, birthDate: new Date(Date.now() - age * 365.25 * 864e5).toISOString().slice(0, 10) });
  const ICE10 = { orient: 4, naming: 3, command: 1, writing: 1, attention: 1 };
  const wt = (now, kg) => O(now, "29463-7", "Body weight", kg, "kg", 200);
  const ICE = (now, total, h, by) => Object.assign(O(now, "ICE-LOCAL", "Immune effector cell-associated encephalopathy (ICE) score", total, "{score}", h, "survey"), { performer: [{ display: by || "RN (made up)" }] });
  const GCS = (now, v, h) => O(now, "9269-2", "Glasgow coma score total", v, "{score}", h, "exam");
  const base = (now) => vit(now, 70, 36.8, 126, 74, 16, 97).concat(vit(now, 52, 36.7, 130, 72, 16, 97));

  window.BS_SAMPLES = [
    { label: "A: Day 1 after first step-up dose, well", build: (now) => ({ where: "home", set: { ice: ICE10, iceT: now - 2 * 36e5 }, raw: { patient: pt(67, "female"),
      obs: base(now).concat(vit(now, 3, 37.0, 127, 76, 16, 97), vit(now, 2, 37.1, 126, 76, 16, 96), vit(now, 1, 37.1, 124, 78, 16, 96), vit(now, 0.2, 37.2, 126, 77, 16, 96), [wt(now, 72), ICE(now, 10, 24), ICE(now, 10, 16), ICE(now, 10, 8), lab(now, "1988-5", "C reactive protein", 4, "mg/L", 6, 0, 8), lab(now, "2276-4", "Ferritin", 310, "ug/L", 6, 20, 300)]),
      admins: [adm(now, "Tocilizumab 8 mg/kg IV", 21), adm(now, "Teclistamab (Tecvayli) 0.06 mg/kg subcut, step-up dose 1", 20)], meds: [] } }) },
    { label: "B: Fever persisting at home (grade 1)", build: (now) => ({ where: "home", set: { ice: ICE10, iceT: now - 3 * 36e5 }, raw: { patient: pt(71, "male"),
      obs: base(now).concat(vit(now, 26, 36.9, 124, 74, 16, 97), vit(now, 3, 37.4, 122, 80, 17, 96), vit(now, 1.25, 38.2, 118, 92, 18, 95), vit(now, 0.25, 38.3, 114, 96, 18, 95), [wt(now, 84)]),
      admins: [adm(now, "Teclistamab step-up dose 1", 80), adm(now, "Teclistamab step-up dose 2", 30)], meds: [] } }) },
    { label: "C: Grade 2 CRS at facility (fluids, low-flow O2)", build: (now) => ({ where: "facility", set: { hypo: "fluid", o2: "low", ice: ICE10, iceT: now - 2 * 36e5 }, raw: { patient: pt(74, "female"),
      obs: base(now).concat(vit(now, 6, 37.2, 122, 80, 16, 96), vit(now, 1.5, 38.4, 104, 100, 20, 93), vit(now, 0.3, 38.7, 94, 112, 22, 91), [wt(now, 66), lab(now, "1988-5", "C reactive protein", 96, "mg/L", 1, 0, 8), lab(now, "2276-4", "Ferritin", 820, "ug/L", 1, 20, 300), lab(now, "2160-0", "Creatinine", 88, "umol/L", 1, 45, 90), lab(now, "1742-6", "ALT", 64, "U/L", 1, 7, 40), lab(now, "2524-7", "Lactate", 2.4, "mmol/L", 1, 0.5, 2.0)]),
      admins: [adm(now, "Teclistamab first full dose", 18), adm(now, "Teclistamab step-up dose 2", 100), adm(now, "Teclistamab step-up dose 1", 190), adm(now, "Tocilizumab", 191)], meds: [] } }) },
    { label: "D: Grade 3 CRS, tocilizumab at limit, 105 kg", build: (now) => ({ where: "facility", set: { hypo: "one", o2: "high", ice: ICE10, iceT: now - 1 * 36e5, comorbid: false }, raw: { patient: pt(78, "male"),
      obs: base(now).concat(vit(now, 5, 38.6, 100, 108, 22, 94), vit(now, 0.25, 39.1, 78, 128, 28, 89), [wt(now, 105)]),
      admins: [adm(now, "Teclistamab first full dose", 26), adm(now, "Tocilizumab", 60), adm(now, "Tocilizumab 8 mg/kg", 20), adm(now, "Tocilizumab 8 mg/kg", 12), adm(now, "Tocilizumab 8 mg/kg", 4)], meds: [] } }) },
    { label: "E: ICANS grade 2 with mild CRS", build: (now) => ({ where: "facility", set: { ice: { orient: 2, naming: 2, command: 1, writing: 0, attention: 0 }, iceT: now - 1 * 36e5, loc: "voice" }, raw: { patient: pt(69, "female"),
      obs: base(now).concat(vit(now, 4, 37.6, 120, 84, 16, 96), vit(now, 0.4, 38.1, 118, 94, 18, 94), [wt(now, 70), ICE(now, 10, 34), ICE(now, 9, 14, "RN (made up)"), ICE(now, 7, 8), ICE(now, 5, 1), GCS(now, 15, 8), GCS(now, 14, 1)]),
      admins: [adm(now, "Teclistamab first full dose", 44), adm(now, "Tocilizumab", 120)], meds: [] } }) },
    { label: "F: ICANS grade 3 (seizure), no fever", build: (now) => ({ where: "facility", set: { ice: { orient: 1, naming: 0, command: 0, writing: 0, attention: 0 }, iceT: now - 0.5 * 36e5, loc: "tactile", seizure: "g3" }, raw: { patient: pt(72, "male"),
      obs: base(now).concat(vit(now, 2, 37.5, 128, 88, 18, 96), vit(now, 0.3, 37.8, 130, 92, 20, 95), [wt(now, 80), ICE(now, 10, 60), ICE(now, 8, 20), ICE(now, 3, 6), ICE(now, 1, 0.5), GCS(now, 12, 6), GCS(now, 9, 0.5)]),
      admins: [adm(now, "Teclistamab step-up dose 2", 70)], meds: [] } }) },
    { label: "G: Fever 10 days after a full dose (CRS unlikely)", build: (now) => ({ where: "home", set: { fullDoseNoCRS: true, ice: ICE10, iceT: now - 5 * 36e5 }, raw: { patient: pt(65, "female"),
      obs: base(now).concat(vit(now, 3, 37.2, 128, 80, 16, 97), vit(now, 0.3, 38.4, 124, 96, 18, 96), [wt(now, 62)]),
      admins: [adm(now, "Teclistamab step-up 1", 330), adm(now, "Teclistamab step-up 2", 280), adm(now, "Teclistamab first full dose", 240)], meds: [] } }) },
    { label: "H: ICE 8, otherwise well (ICANS grade 1)", build: (now) => ({ where: "home", set: { ice: { orient: 4, naming: 3, command: 1, writing: 0, attention: 0 }, iceT: now - 0.5 * 36e5 }, raw: { patient: pt(70, "male"),
      obs: base(now).concat(vit(now, 2, 37.1, 126, 78, 16, 97), vit(now, 0.5, 37.2, 125, 80, 16, 97), [wt(now, 90), ICE(now, 10, 20), ICE(now, 9, 8), ICE(now, 8, 0.5)]),
      admins: [adm(now, "Teclistamab step-up dose 2", 36)], meds: [] } }) },
    { label: "I: No teclistamab or readings found", build: (now) => ({ where: "home", set: {}, raw: { patient: pt(68, "female"), obs: [], admins: [], meds: [] } }) }
  ];
})();
