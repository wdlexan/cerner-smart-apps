/* MADE-UP patients for testing the FUO tab. Times are relative to "now" (h = hours ago). None of these are real people. */
(function () {
  const iso = (now, h) => new Date(now - h * 36e5).toISOString();
  const ob = (cat) => (now, loinc, disp, val, unit, h) => ({ resourceType: "Observation", status: "final", category: [{ coding: [{ code: cat }] }],
    code: { coding: loinc ? [{ system: "http://loinc.org", code: loinc, display: disp }] : [], text: disp }, effectiveDateTime: iso(now, h), valueQuantity: { value: val, unit } });
  const lab = ob("laboratory"), vit = ob("vital-signs");
  const L = (now, loinc, disp, unit, pts) => pts.map(([h, v]) => lab(now, loinc, disp, v, unit, h));
  const qual = (now, disp, text, h, status) => ({ resourceType: "Observation", status: status || "final", category: [{ coding: [{ code: "laboratory" }] }], code: { text: disp }, effectiveDateTime: iso(now, h), valueString: text });
  const rep = (now, disp, conclusion, h, status) => ({ resourceType: "DiagnosticReport", status: status || "final", code: { text: disp }, effectiveDateTime: iso(now, h), issued: iso(now, h), conclusion });
  // fever curve: days of 4 readings/day; spike(dayIndex) gives that day's peak, base is the trough; hr(temp) gives the paired heart rate
  function curve(now, days, spike, base, hrFn) {
    const out = [];
    for (let d = days - 1; d >= 0; d--) [20, 14, 8, 2].forEach((hh, i) => {
      const h = d * 24 + hh, temp = Math.round((i === 1 ? spike(d) : i === 3 ? (spike(d) + base) / 2 : base) * 10) / 10;
      out.push(vit(now, "8310-5", "Temperature", temp, "Cel", h), vit(now, "8867-4", "Heart rate", hrFn(temp), "/min", h));
    });
    return out;
  }
  const bp = (now, sbp) => [vit(now, "8480-6", "Systolic BP", sbp, "mm[Hg]", 3)];
  const req = (name, hAgo, status, prn) => ({ resourceType: "MedicationRequest", status: status || "active", authoredOn: hAgo != null ? iso(Date.now(), hAgo) : undefined, medicationCodeableConcept: { text: name }, dosageInstruction: [{ text: name, asNeededBoolean: !!prn }] });
  const cond = (text, code) => ({ resourceType: "Condition", clinicalStatus: { coding: [{ code: "active" }] }, code: { coding: [{ system: "http://hl7.org/fhir/sid/icd-10", code }], text } });
  const pt = (age, gender) => ({ resourceType: "Patient", gender, birthDate: new Date(Date.now() - age * 365.25 * 864e5 - 30 * 864e5).toISOString().slice(0, 10) });
  const enc = (daysAgo) => ({ resourceType: "Encounter", period: { start: new Date(Date.now() - daysAgo * 864e5).toISOString() } });
  const cbc = (now, h, o) => [].concat(L(now, "6690-2", "WBC", "10*9/L", [[h, o.wbc]]), L(now, "751-8", "Neutrophils absolute", "10*9/L", [[h, o.anc]]), o.npct ? L(now, "770-8", "Neutrophils %", "%", [[h, o.npct]]) : [],
    L(now, "731-0", "Lymphocytes absolute", "10*9/L", [[h, o.ly]]), L(now, "742-7", "Monocytes absolute", "10*9/L", [[h, o.mo]]), L(now, "711-2", "Eosinophils absolute", "10*9/L", [[h, o.eo]]),
    L(now, "718-7", "Hemoglobin", "g/L", [[h, o.hb]]), L(now, "777-3", "Platelets", "10*9/L", [[h, o.plt]]));
  const chem = (now, h, o) => [].concat(L(now, "2951-2", "Sodium", "mmol/L", [[h, o.na || 138]]), L(now, "2823-3", "Potassium", "mmol/L", [[h, o.k || 4.1]]), L(now, "2160-0", "Creatinine", "umol/L", [[h, o.cr || 80]]),
    L(now, "17861-6", "Calcium", "mmol/L", [[h, o.ca || 2.3]]), L(now, "1751-7", "Albumin", "g/L", [[h, o.alb || 35]]), L(now, "1742-6", "ALT", "U/L", [[h, o.alt || 25]]), L(now, "1920-8", "AST", "U/L", [[h, o.ast || 24]]),
    L(now, "6768-6", "Alkaline phosphatase", "U/L", [[h, o.alp || 90]]), L(now, "2532-0", "LDH", "U/L", [[h, o.ldh || 190]]), L(now, "2157-6", "CK", "U/L", [[h, o.ck || 80]]),
    L(now, "4537-7", "ESR", "mm/h", [[h, o.esr]]), L(now, "1988-5", "CRP", "mg/L", [[h, o.crp]]), L(now, "2276-4", "Ferritin", "ug/L", [[h, o.fer]]), o.tsh ? L(now, "3016-3", "TSH", "mIU/L", [[h, o.tsh]]) : [],
    o.tg ? L(now, "2571-8", "Triglycerides", "mmol/L", [[h, o.tg]]) : [], o.fib ? L(now, "3255-7", "Fibrinogen", "g/L", [[h, o.fib]]) : []);
  const stage1 = (now, h, o) => [qual(now, "Blood culture set 1", o.bc || "No growth at 5 days", h + 50), qual(now, "Blood culture set 2", o.bc2 || o.bc || "No growth at 5 days", h + 49), qual(now, "Blood culture set 3", o.bc3 || o.bc || "No growth at 5 days", h + 26),
    qual(now, "Urinalysis", o.ua || "Negative", h), qual(now, "Urine culture", "No growth", h), qual(now, "HIV 1/2 antigen/antibody", "Non-reactive", h), qual(now, "Hepatitis B surface antigen", "Negative", h), qual(now, "Hepatitis C antibody", "Non-reactive", h),
    qual(now, "ANA", o.ana || "Negative", h), qual(now, "Rheumatoid factor", o.rf || "Negative", h), qual(now, "Serum protein electrophoresis", o.spep || "Polyclonal increase in gamma globulins, no monoclonal band", h)];

  window.FUO_SAMPLES = [
    { label: "A: 58 M, 5 weeks of fevers, night sweats, 8 kg weight loss, LDH 540, ALP 210, retroperitoneal nodes on CT (lymphoma?)",
      sit: { feverStartDays: 35, admittedDays: 4, presentOnAdmission: true, ticks: ["nightSweats", "weightLoss", "lymphadenopathy", "splenomegaly", "pruritus"] },
      build: (now) => ({ patient: pt(58, "male"), encounter: enc(4),
        conditions: [cond("Hypertension", "I10")],
        obs: [].concat(curve(now, 4, (d) => 38.9 + (d % 2) * 0.3, 37.0, (t) => Math.round(70 + (t - 37) * 10)), bp(now, 128),
          cbc(now, 10, { wbc: 6.2, anc: 4.4, ly: 0.7, mo: 0.6, eo: 0.6, hb: 104, plt: 410 }), chem(now, 10, { esr: 78, crp: 64, fer: 1450, ldh: 540, alp: 210, ca: 2.62, alb: 31 }),
          stage1(now, 30, {}), [qual(now, "QuantiFERON-TB Gold Plus", "Negative", 30)]),
        reports: [rep(now, "XR chest PA and lateral", "No consolidation. Possible right paratracheal fullness.", 80), rep(now, "CT chest abdomen pelvis with contrast", "Bulky retroperitoneal and mesenteric lymphadenopathy up to 3.4 cm. Splenomegaly 16 cm. No abscess.", 40),
          rep(now, "PET-CT FDG whole body", "", 2, "registered")],
        medreqs: [req("acetaminophen 650 mg PO q6h PRN fever", 90, "active", true), req("ramipril 5 mg PO daily", 2000)], admins: [] }) },
    { label: "B: 76 F, 4 weeks of low-grade fever, new temporal headache, jaw pain chewing, shoulder stiffness, ESR 104, platelets 520 (GCA?)",
      sit: { feverStartDays: 28, admittedDays: 2, presentOnAdmission: true, ticks: ["headache", "jawClaud", "girdlePain", "weightLoss"], gca: { stiffness: true, headache: true, jawClaud: true, scalp: true } },
      build: (now) => ({ patient: pt(76, "female"), encounter: enc(2),
        conditions: [cond("Osteoarthritis", "M19.90"), cond("Hypothyroidism", "E03.9")],
        obs: [].concat(curve(now, 2, () => 38.4, 37.2, (t) => Math.round(78 + (t - 37) * 8)), bp(now, 138),
          cbc(now, 8, { wbc: 9.1, anc: 6.5, ly: 1.6, mo: 0.7, eo: 0.2, hb: 103, plt: 520 }), chem(now, 8, { esr: 104, crp: 88, fer: 620, alp: 168, tsh: 2.1 }), stage1(now, 20, {})),
        reports: [rep(now, "XR chest", "Normal.", 30)],
        medreqs: [req("levothyroxine 75 mcg PO daily", 3000), req("acetaminophen 1 g PO q6h", 40)], admins: [] }) },
    { label: "C: 31 F, daily fever spikes to 39.8 °C for 3 weeks, salmon rash with fever, sore throat, joint pain, WBC 19, ferritin 8,600 (Still's? check HScore)",
      sit: { feverStartDays: 22, admittedDays: 5, presentOnAdmission: true, ticks: ["salmonRash", "rash", "soreThroat", "arthralgia", "lymphadenopathy", "splenomegaly"] },
      build: (now) => ({ patient: pt(31, "female"), encounter: enc(5),
        conditions: [],
        obs: [].concat(curve(now, 5, () => 39.8, 36.8, (t) => Math.round(80 + (t - 37) * 10)), bp(now, 112),
          cbc(now, 6, { wbc: 19.2, anc: 17.0, npct: 88, ly: 1.4, mo: 0.6, eo: 0.1, hb: 108, plt: 455 }), chem(now, 6, { esr: 92, crp: 156, fer: 8600, alt: 112, ast: 96, ldh: 410, tg: 1.3, fib: 5.2 }),
          stage1(now, 60, {}), [qual(now, "Procalcitonin", "0.4", 6), qual(now, "EBV VCA IgM", "Negative", 50), qual(now, "CMV IgM", "Negative", 50), qual(now, "Throat swab culture", "Normal flora", 70)]),
        reports: [rep(now, "CT chest abdomen pelvis with contrast", "Mild splenomegaly 14 cm, small reactive axillary nodes. No abscess.", 70), rep(now, "Echocardiogram transthoracic", "Normal valves. Small pericardial effusion.", 30)],
        medreqs: [req("naproxen 500 mg PO BID", 80), req("acetaminophen 650 mg PO q6h PRN", 100, "active", true)], admins: [] }) },
    { label: "D: 68 M, bioprosthetic aortic valve, 3 weeks of fevers, amoxicillin from walk-in clinic BEFORE cultures, new murmur, splinters, cultures negative",
      sit: { feverStartDays: 23, admittedDays: 3, presentOnAdmission: true, ticks: ["murmur", "emboli", "animals"] },
      build: (now) => ({ patient: pt(68, "male"), encounter: enc(3),
        conditions: [cond("Bioprosthetic aortic valve replacement", "Z95.2"), cond("Type 2 diabetes mellitus", "E11.9")],
        obs: [].concat(curve(now, 3, () => 38.7, 37.3, (t) => Math.round(76 + (t - 37) * 10)), bp(now, 124),
          cbc(now, 8, { wbc: 11.6, anc: 8.4, ly: 1.5, mo: 1.4, eo: 0.1, hb: 98, plt: 210 }), chem(now, 8, { esr: 108, crp: 92, fer: 900, cr: 128 }), stage1(now, 20, { ua: "Blood 2+, protein 1+" })),
        reports: [rep(now, "XR chest", "No acute disease.", 60), rep(now, "Echocardiogram transthoracic", "Bioprosthetic aortic valve, mean gradient 22 mmHg. Image quality limited; vegetation not excluded.", 20)],
        medreqs: [req("amoxicillin 500 mg PO TID", 120, "completed"), req("metformin 1000 mg PO BID", 4000)], admins: [{ resourceType: "MedicationAdministration", status: "completed", medicationCodeableConcept: { text: "amoxicillin 500 mg PO" }, effectiveDateTime: iso(now, 110) }] }) },
    { label: "E: 82 F, hip fracture day 9, fever from day 5, phenytoin and ceftriaxone started day 2, eosinophils 1.1, rash, HR 84 at 39.2 °C (nosocomial: drug fever?)",
      sit: { admittedDays: 9, presentOnAdmission: false, ticks: ["rash", "recentSurgery", "immobile"] },
      build: (now) => ({ patient: pt(82, "female"), encounter: enc(9),
        conditions: [cond("Fracture of neck of femur, right", "S72.001A"), cond("Seizure disorder", "G40.909"), cond("Atrial fibrillation", "I48.91")],
        obs: [].concat(curve(now, 5, () => 39.2, 37.4, () => 84), bp(now, 132),
          cbc(now, 6, { wbc: 10.8, anc: 7.0, ly: 1.4, mo: 0.8, eo: 1.1, hb: 96, plt: 280 }), chem(now, 6, { esr: 40, crp: 38, fer: 410, alt: 68, ast: 54 }),
          [qual(now, "Blood culture set 1", "No growth at 3 days", 90), qual(now, "Blood culture set 2", "No growth at 3 days", 89), qual(now, "Urinalysis", "Negative", 90), qual(now, "Urine culture", "No growth", 90), qual(now, "C. difficile toxin PCR", "Not detected", 70)]),
        reports: [rep(now, "XR chest", "No consolidation.", 88)],
        medreqs: [req("phenytoin 100 mg PO TID", 7 * 24), req("ceftriaxone 1 g IV q24h", 7 * 24), req("enoxaparin 40 mg SC daily", 8 * 24), req("apixaban 5 mg PO BID", 24), req("hydromorphone 0.5 mg PO q4h PRN", 8 * 24, "active", true)], admins: [] }) },
    { label: "F: 49 M, fever 40.1 °C, spleen 19 cm, Hb 74, WBC 1.8, platelets 38, ferritin 24,000, triglycerides 4.6, fibrinogen 1.1, AST 210 (HLH, urgent)",
      sit: { feverStartDays: 18, admittedDays: 2, presentOnAdmission: true, ticks: ["splenomegaly", "hepatomegaly", "lymphadenopathy", "nightSweats"] },
      build: (now) => ({ patient: pt(49, "male"), encounter: enc(2),
        conditions: [cond("Rheumatoid arthritis on methotrexate", "M06.9")],
        obs: [].concat(curve(now, 2, () => 40.1, 38.0, (t) => Math.round(90 + (t - 37) * 10)), bp(now, 104),
          cbc(now, 4, { wbc: 1.8, anc: 0.9, ly: 0.5, mo: 0.2, eo: 0.0, hb: 74, plt: 38 }), chem(now, 4, { esr: 30, crp: 120, fer: 24000, ldh: 1240, alt: 180, ast: 210, tg: 4.6, fib: 1.1, na: 131, alb: 26 }),
          [qual(now, "Blood culture set 1", "No growth at 2 days", 30), qual(now, "Blood culture set 2", "No growth at 2 days", 30), qual(now, "EBV DNA PCR quantitative", "Detected 85,000 IU/mL", 6)]),
        reports: [rep(now, "CT chest abdomen pelvis with contrast", "Hepatosplenomegaly (spleen 19 cm). Small mesenteric nodes.", 20)],
        medreqs: [req("methotrexate 20 mg PO weekly", 5000, "on-hold"), req("folic acid 5 mg PO weekly", 5000), req("piperacillin-tazobactam 4.5 g IV q6h", 20)], admins: [] }) },
    { label: "G: 63 M, born in the Philippines, 6 weeks of evening fevers, night sweats, weight loss, lymphopenia, Ca 2.71, IGRA positive (TB?)",
      sit: { feverStartDays: 42, admittedDays: 3, presentOnAdmission: true, ticks: ["tbRisk", "nightSweats", "weightLoss", "lymphadenopathy"] },
      build: (now) => ({ patient: pt(63, "male"), encounter: enc(3),
        conditions: [cond("Type 2 diabetes mellitus", "E11.9")],
        obs: [].concat(curve(now, 3, () => 38.6, 36.9, (t) => Math.round(74 + (t - 37) * 10)), bp(now, 130),
          cbc(now, 8, { wbc: 7.4, anc: 5.6, ly: 0.6, mo: 1.2, eo: 0.2, hb: 112, plt: 380 }), chem(now, 8, { esr: 88, crp: 72, fer: 980, alp: 196, ca: 2.71, alb: 30 }),
          stage1(now, 30, {}), [qual(now, "QuantiFERON-TB Gold Plus", "Positive", 28), qual(now, "Sputum AFB smear", "Pending", 6, "registered")]),
        reports: [rep(now, "XR chest", "Right hilar fullness. No cavity.", 60), rep(now, "CT chest abdomen pelvis with contrast", "Necrotic mediastinal and right hilar nodes. Hypodense lesions in the spleen. Small right pleural effusion.", 30)],
        medreqs: [req("metformin 500 mg PO BID", 3000)], admins: [] }) }];
})();
