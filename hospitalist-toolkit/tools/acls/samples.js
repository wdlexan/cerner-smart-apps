/* MADE-UP patients for testing the ACLS tab. Times are relative to "now" (h = hours ago). None of these are real people. */
(function () {
  const iso = (now, h) => new Date(now - h * 36e5).toISOString();
  const ob = (cat) => (now, loinc, disp, val, unit, h) => ({ resourceType: "Observation", status: "final", category: [{ coding: [{ code: cat }] }],
    code: { coding: loinc ? [{ system: "http://loinc.org", code: loinc, display: disp }] : [], text: disp }, effectiveDateTime: iso(now, h), valueQuantity: { value: val, unit } });
  const lab = ob("laboratory"), vit = ob("vital-signs");
  const series = (now, loinc, disp, unit, pts) => pts.map(([h, v]) => lab(now, loinc, disp, v, unit, h));
  const vs = (now, rows) => [].concat(...rows.map(([h, hr, s, d, sat, rr, temp]) => [vit(now, "8867-4", "Heart rate", hr, "/min", h), vit(now, "8480-6", "Systolic BP", s, "mm[Hg]", h), vit(now, "8462-4", "Diastolic BP", d, "mm[Hg]", h),
    vit(now, "59408-5", "SpO2", sat, "%", h), vit(now, "9279-1", "Respiratory rate", rr, "/min", h), vit(now, "8310-5", "Temperature", temp, "Cel", h)]));
  const wt = (now, kg) => vit(now, "29463-7", "Weight", kg, "kg", 30);
  const req = (name, status) => ({ resourceType: "MedicationRequest", status: status || "active", medicationCodeableConcept: { text: name } });
  const given = (now, name, h) => ({ resourceType: "MedicationAdministration", status: "completed", medicationCodeableConcept: { text: name }, effectiveDateTime: iso(now, h) });
  const cond = (text, code) => ({ resourceType: "Condition", clinicalStatus: { coding: [{ code: "active" }] }, code: { coding: code ? [{ system: "http://hl7.org/fhir/sid/icd-10", code }] : [], text } });
  const codeObs = (now, text, h) => ({ resourceType: "Observation", status: "final", code: { text: "Code status" }, effectiveDateTime: iso(now, h), valueString: text });
  const pt = (age, gender) => ({ resourceType: "Patient", gender, birthDate: new Date(Date.now() - age * 365.25 * 864e5 - 30 * 864e5).toISOString().slice(0, 10) });
  const L = (now, rows) => [].concat(...rows.map(([loinc, disp, unit, pts]) => series(now, loinc, disp, unit, pts)));

  window.ACLS_SAMPLES = [
    { label: "A: 72 M, dialysis patient, missed 2 runs, K 7.1, peaked T waves, on ramipril (hyperkalemia)",
      sit: { tachy: null, brady: false },
      build: (now) => ({ patient: pt(72, "male"),
        conditions: [cond("End stage renal disease on hemodialysis", "N18.6"), cond("Type 2 diabetes mellitus", "E11.9"), cond("Hypertension", "I10")],
        obs: [].concat(L(now, [["2823-3", "Potassium", "mmol/L", [[30, 5.9], [3, 7.1]]], ["2160-0", "Creatinine", "umol/L", [[3, 980]]], ["1963-8", "Bicarbonate", "mmol/L", [[3, 14]]],
          ["2744-1", "pH arterial", "", [[2, 7.18]]], ["2019-8", "pCO2 arterial", "mm[Hg]", [[2, 30]]], ["2345-7", "Glucose", "mmol/L", [[3, 9.4]]], ["718-7", "Hemoglobin", "g/L", [[3, 96]]], ["19123-9", "Magnesium", "mmol/L", [[3, 1.2]]]]),
          [wt(now, 84)], vs(now, [[8, 62, 150, 80, 96, 18, 36.6], [1, 48, 104, 60, 95, 20, 36.4]]), [codeObs(now, "Full code (CPR and critical care)", 40)]),
        medreqs: [req("ramipril 10 mg PO daily"), req("insulin glargine 18 units SC qHS"), req("calcium carbonate 500 mg PO TID with meals"), req("heparin 5,000 units SC q12h")], admins: [] }) },
    { label: "B: 84 F, hip fracture post-op day 1, hydromorphone 2 h ago + zopiclone + fascia iliaca block, SpO2 86%, RR 8 (opioid)",
      sit: {},
      build: (now) => ({ patient: pt(84, "female"),
        conditions: [cond("Right intertrochanteric hip fracture, status post ORIF", "S72.141A"), cond("Obstructive sleep apnea", "G47.33"), cond("Chronic kidney disease stage 3b", "N18.32")],
        obs: [].concat(L(now, [["2823-3", "Potassium", "mmol/L", [[10, 4.3]]], ["718-7", "Hemoglobin", "g/L", [[40, 118], [10, 94]]], ["2345-7", "Glucose", "mmol/L", [[10, 6.8]]], ["2160-0", "Creatinine", "umol/L", [[10, 128]]]]),
          [wt(now, 51)], vs(now, [[12, 88, 132, 70, 95, 16, 37.1], [1, 58, 98, 54, 86, 8, 36.2]])),
        medreqs: [req("hydromorphone 1 mg PO q4h PRN pain"), req("hydromorphone 0.5 mg SC q2h PRN breakthrough"), req("zopiclone 7.5 mg PO qHS PRN"), req("bupivacaine 0.25% fascia iliaca block 30 mL"), req("enoxaparin 30 mg SC daily"), req("acetaminophen 1 g PO q6h")],
        admins: [given(now, "hydromorphone 0.5 mg SC", 2), given(now, "hydromorphone 1 mg PO", 6), given(now, "zopiclone 7.5 mg PO", 4)] }) },
    { label: "C: 67 F, laparotomy for ovarian cancer 3 days ago, no VTE prophylaxis, HR 128, SpO2 88%, D-dimer 4.8 (PE)",
      sit: { tachy: "narrow" },
      build: (now) => ({ patient: pt(67, "female"),
        conditions: [cond("Ovarian cancer", "C56.9"), cond("Status post laparotomy and debulking", "Z98.890"), cond("Hypothyroidism", "E03.9")],
        obs: [].concat(L(now, [["48065-7", "D-dimer", "mg/L FEU", [[3, 4.8]]], ["89579-7", "Troponin I high sensitivity", "ng/L", [[4, 28], [1, 61]]], ["718-7", "Hemoglobin", "g/L", [[24, 108], [3, 104]]],
          ["2823-3", "Potassium", "mmol/L", [[3, 4.0]]], ["2524-7", "Lactate", "mmol/L", [[2, 3.1]]], ["2345-7", "Glucose", "mmol/L", [[3, 7.2]]]]),
          [wt(now, 72)], vs(now, [[10, 104, 118, 70, 93, 22, 37.6], [1, 128, 92, 58, 88, 28, 37.4]])),
        medreqs: [req("hydromorphone 0.5 mg IV q3h PRN"), req("ondansetron 4 mg IV q8h PRN"), req("levothyroxine 100 mcg PO daily"), req("pantoprazole 40 mg IV daily")], admins: [] }) },
    { label: "D: 58 M, NSTEMI, troponin rising, K 3.1, Mg 0.55, QTc 521 on haloperidol + ondansetron + azithromycin (torsades risk)",
      sit: { tachy: "torsades" },
      build: (now) => ({ patient: pt(58, "male"),
        conditions: [cond("NSTEMI", "I21.4"), cond("Community acquired pneumonia", "J18.9"), cond("Alcohol use disorder", "F10.20")],
        obs: [].concat(L(now, [["89579-7", "Troponin I high sensitivity", "ng/L", [[20, 140], [12, 880], [2, 2400]]], ["2823-3", "Potassium", "mmol/L", [[20, 3.4], [2, 3.1]]], ["19123-9", "Magnesium", "mmol/L", [[2, 0.55]]],
          ["8636-3", "QTc interval", "ms", [[3, 521]]], ["718-7", "Hemoglobin", "g/L", [[2, 132]]], ["2345-7", "Glucose", "mmol/L", [[2, 5.6]]]]),
          [wt(now, 80)], vs(now, [[6, 96, 126, 76, 94, 20, 37.9], [1, 112, 110, 68, 93, 22, 37.8]]), [codeObs(now, "Full code", 30)]),
        medreqs: [req("aspirin 81 mg PO daily"), req("ticagrelor 90 mg PO BID"), req("enoxaparin 80 mg SC q12h"), req("haloperidol 2 mg IV q4h PRN agitation"), req("ondansetron 8 mg IV q8h"), req("azithromycin 500 mg IV daily"), req("ceftriaxone 1 g IV daily"), req("metoprolol 25 mg PO BID")], admins: [] }) },
    { label: "E: 91 F, MOST M2 on the problem list, urosepsis, AF RVR 150, SBP 84 (code status already set)",
      sit: { tachy: "af", unstable: true },
      build: (now) => ({ patient: pt(91, "female"),
        conditions: [cond("DNR - MOST M2: medical treatments within current location, no CPR, no critical care", ""), cond("Urosepsis", "A41.51"), cond("Atrial fibrillation", "I48.91"), cond("Heart failure with reduced ejection fraction", "I50.22"), cond("Dementia, moderate", "F03.B0")],
        obs: [].concat(L(now, [["2524-7", "Lactate", "mmol/L", [[6, 2.4], [1, 4.6]]], ["2823-3", "Potassium", "mmol/L", [[3, 3.4]]], ["718-7", "Hemoglobin", "g/L", [[3, 112]]], ["2345-7", "Glucose", "mmol/L", [[3, 8.0]]]]),
          [wt(now, 48)], vs(now, [[8, 118, 106, 60, 94, 22, 38.6], [1, 150, 84, 50, 91, 28, 38.9]])),
        medreqs: [req("ceftriaxone 1 g IV daily"), req("apixaban 2.5 mg PO BID"), req("bisoprolol 2.5 mg PO daily"), req("furosemide 40 mg PO daily", "on-hold")], admins: [] }) },
    { label: "F: 76 M, AF on diltiazem + metoprolol + digoxin, HR 38, K 5.9, digoxin level 3.4 nmol/L, eGFR falling (bradycardia)",
      sit: { brady: true, bradyUnstable: true },
      build: (now) => ({ patient: pt(76, "male"),
        conditions: [cond("Atrial fibrillation, permanent", "I48.21"), cond("Acute kidney injury", "N17.9"), cond("Hypertension", "I10")],
        obs: [].concat(L(now, [["2823-3", "Potassium", "mmol/L", [[3, 5.9]]], ["10535-3", "Digoxin level", "nmol/L", [[3, 3.4]]], ["2160-0", "Creatinine", "umol/L", [[50, 110], [3, 241]]], ["2345-7", "Glucose", "mmol/L", [[3, 6.1]]]]),
          [wt(now, 78)], vs(now, [[10, 54, 112, 64, 95, 16, 36.8], [1, 38, 82, 48, 94, 18, 36.6]]), [codeObs(now, "Full code", 60)]),
        medreqs: [req("diltiazem CD 240 mg PO daily"), req("metoprolol 50 mg PO BID"), req("digoxin 0.125 mg PO daily"), req("rivaroxaban 20 mg PO daily"), req("spironolactone 25 mg PO daily")], admins: [] }) }];

  // A practice code for the timer and note (minutes after the call). Made up.
  window.ACLS_PRACTICE = [[0, "start"], [0.5, "access", "IV"], [2, "rhythm", "vf"], [2.1, "shock", 200], [4, "rhythm", "vf"], [4.1, "shock", 200], [4.4, "epi"], [6, "rhythm", "vf"], [6.1, "shock", 200], [6.5, "amio", 300],
    [7.5, "airway", "ETT 7.5, capnography confirmed"], [8.2, "epi"], [8.5, "rhythm", "organized"], [8.6, "rosc"]];
})();
