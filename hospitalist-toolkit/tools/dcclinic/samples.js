/* MADE-UP patients for the Discharge Clinic tab (added to the Discharge tab's made-up patients A to C). None of these are real people. */
(function () {
  const iso = (now, h) => new Date(now - h * 36e5).toISOString();
  const ob = (cat) => (now, loinc, disp, val, unit, h, status) => ({ resourceType: "Observation", status: status || "final", category: [{ coding: [{ code: cat }] }],
    code: { coding: loinc ? [{ system: "http://loinc.org", code: loinc, display: disp }] : [], text: disp }, effectiveDateTime: iso(now, h), valueQuantity: val == null ? undefined : { value: val, unit } });
  const lab = ob("laboratory"), vit = ob("vital-signs");
  const series = (now, loinc, disp, unit, pts, f) => pts.map(([h, v]) => (f || lab)(now, loinc, disp, v, unit, h));
  const rq = (name, status) => ({ resourceType: "MedicationRequest", status: status || "active", intent: "order", category: [{ coding: [{ code: "inpatient" }] }], medicationCodeableConcept: { text: name } });
  const home = (name) => ({ resourceType: "MedicationStatement", status: "active", medicationCodeableConcept: { text: name } });
  const cond = (text, code, h, now) => ({ resourceType: "Condition", clinicalStatus: { coding: [{ code: "active" }] }, code: { coding: [{ system: "http://hl7.org/fhir/sid/icd-10", code }], text }, recordedDate: h != null ? iso(now, h) : undefined });
  const pt = (age, gender, phone) => ({ resourceType: "Patient", gender, birthDate: new Date(Date.now() - age * 365.25 * 864e5 - 30 * 864e5).toISOString().slice(0, 10), telecom: phone ? [{ system: "phone", value: phone, use: "home" }] : [] });
  const enc = (now, h) => ({ resourceType: "Encounter", status: "in-progress", class: { code: "IMP" }, period: { start: iso(now, h) } });
  const rep = (now, name, status, h, conclusion, c) => ({ resourceType: "DiagnosticReport", id: name.replace(/\W+/g, "-").toLowerCase(), status, code: { text: name }, category: [{ text: c || "Radiology" }], effectiveDateTime: iso(now, h), conclusion });

  window.DCC_SAMPLES = [
    { label: "D: 82 M, iron-deficiency anemia + Na 127, still on 2 L oxygen, ALC in note (should be flagged)",
      build: (now) => ({ patient: pt(82, "male"), encounters: [enc(now, 100)],
        conditions: [cond("Iron deficiency anemia", "D50.9", 98, now), cond("Hyponatremia", "E87.1", 98, now), cond("Hypertension", "I10")],
        obs: [].concat(series(now, "718-7", "Hemoglobin", "g/L", [[98, 71], [50, 82], [6, 84]]), series(now, "2951-2", "Sodium", "mmol/L", [[98, 124], [30, 126], [6, 127]]),
          series(now, "2160-0", "Creatinine", "umol/L", [[98, 90], [6, 88]]), series(now, "3151-8", "Oxygen flow", "L/min", [[30, 2], [4, 2]], vit)),
        medstatements: [home("hydrochlorothiazide 25 mg PO daily"), home("amlodipine 5 mg PO daily")],
        medreqs: [rq("ferrous fumarate 300 mg PO daily"), rq("amlodipine 5 mg PO daily"), rq("hydrochlorothiazide 25 mg PO daily", "stopped")],
        reports: [], orders: [],
        notes: [{ name: "Progress note", t: now - 8 * 36e5, text: "Hb stable. Na slowly improving off HCTZ. Still on 2 L nasal prongs overnight. PT: two-person assist, designated ALC awaiting placement." }] }) },
    { label: "E: 64 F, weight loss, liver lesions concerning for metastases, biopsy pending, home phone on file",
      build: (now) => ({ patient: pt(64, "female", "250-555-0147"), encounters: [enc(now, 72)],
        conditions: [cond("Weight loss", "R63.4", 70, now), cond("Abnormal liver function tests", "R74.0", 70, now)],
        obs: [].concat(series(now, "1742-6", "ALT", "U/L", [[70, 88], [6, 92]]), series(now, "718-7", "Hemoglobin", "g/L", [[70, 112], [6, 110]]), series(now, "2951-2", "Sodium", "mmol/L", [[70, 136]])),
        medstatements: [], medreqs: [rq("ondansetron 4 mg PO q8h PRN")],
        reports: [rep(now, "CT abdomen and pelvis with contrast", "final", 60, "Multiple hypoenhancing hepatic lesions, the largest 3.4 cm in segment 6, concerning for metastases. Recommend tissue sampling. No bowel obstruction."),
          rep(now, "Liver biopsy (pathology)", "registered", 20, "", "Pathology")],
        orders: [], notes: [{ name: "Progress note", t: now - 10 * 36e5, text: "Liver biopsy done today, tolerated well. Independent, lives with husband, drives. Plan home tomorrow." }] }) }];
})();
