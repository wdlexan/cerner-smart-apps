/* Made-up test patients for demo mode (index.html?demo=1). No real patient data.
   Each case is written as a short spec and turned into FHIR-shaped resources by build(),
   so you can copy a case and change it to test a new scenario.

   Spec fields (all optional except age/sex/name):
     orders: [name, route, dose, unit, timingText, prn, home]   active MedicationRequests
     given:  [name, route, dose, unit, [hours ago, ...]]          MedicationAdministrations
     rr / spo2 / poss / rass: [[hours ago, value], ...]
     o2: [hours ago, ...]   oxygen flow charted
     creat: [value, unit]   egfr: value
     noMar: true            pretend the server returned no administrations (orders-only mode) */
(function (root) {
  const H = 3600 * 1000;

  const CASES = [
    { key: 'osa', label: 'A · 81 F · hip fracture, OSA, CKD — escalating hydromorphone + 3 sedatives',
      name: ['Alice', 'Testpatient'], age: 81, sex: 'female', expect: 'red',
      conditions: ['Obstructive sleep apnea', 'Chronic kidney disease stage 3b', 'Hip fracture, left, s/p hemiarthroplasty'],
      orders: [['HYDROmorphone 2 mg tablet', 'PO', 2, 'mg', 'q2h PRN pain', true], ['HYDROmorphone 0.5 mg injection', 'IV', 0.5, 'mg', 'q1h PRN severe pain', true],
        ['LORazepam 0.5 mg tablet', 'SL', 0.5, 'mg', 'q4h PRN anxiety', true], ['gabapentin 300 mg capsule', 'PO', 300, 'mg', 'TID'],
        ['QUEtiapine 25 mg tablet', 'PO', 25, 'mg', 'HS'], ['acetaminophen 1 g tablet', 'PO', 1000, 'mg', 'q6h']],
      given: [['HYDROmorphone 2 mg tablet', 'PO', 2, 'mg', [64, 55, 44, 38, 30, 22, 18, 14, 10, 6, 3]], ['HYDROmorphone 0.5 mg injection', 'IV', 0.5, 'mg', [20, 8]],
        ['LORazepam 0.5 mg tablet', 'SL', 0.5, 'mg', [26, 4]], ['gabapentin 300 mg capsule', 'PO', 300, 'mg', [56, 48, 40, 32, 24, 16, 8]],
        ['QUEtiapine 25 mg tablet', 'PO', 25, 'mg', [50, 26, 2]]],
      rr: [[70, 18], [62, 18], [54, 17], [46, 16], [38, 16], [30, 15], [22, 14], [14, 14], [10, 12], [6, 11], [2, 9]],
      spo2: [[70, 95], [62, 95], [54, 94], [46, 94], [38, 93], [30, 93], [22, 92], [14, 92], [10, 91], [6, 90], [2, 87]],
      o2: [6, 2], poss: [[12, 2], [2, 3]], creat: [168, 'umol/L'], weight: 98, height: 158 },

    { key: 'naloxone', label: 'B · 67 M · post-op knee, AKI — morphine, naloxone given overnight',
      name: ['Bob', 'Testpatient'], age: 67, sex: 'male', expect: 'red',
      conditions: ['Osteoarthritis right knee s/p total knee arthroplasty', 'Hypertension'],
      orders: [['morphine 2.5 mg injection', 'IV', 2.5, 'mg', 'q2h PRN pain', true], ['naloxone 0.4 mg/mL injection', 'IV', 0.04, 'mg', 'q2min PRN RR < 8', true],
        ['ondansetron 4 mg injection', 'IV', 4, 'mg', 'q8h PRN nausea', true]],
      given: [['morphine 2.5 mg injection', 'IV', 2.5, 'mg', [40, 34, 28, 23, 20, 17, 14, 11, 9, 7]], ['naloxone 0.4 mg/mL injection', 'IV', 0.04, 'mg', [6.5, 6.4]]],
      rr: [[46, 16], [38, 16], [30, 14], [22, 14], [14, 12], [10, 11], [7, 7], [6, 12], [4, 14], [1, 15]],
      spo2: [[46, 96], [38, 96], [30, 95], [22, 95], [14, 93], [10, 92], [7, 86], [6, 93], [4, 94], [1, 95]],
      o2: [7, 6, 4], poss: [[10, 2], [7, 4], [4, 2]], creat: [212, 'umol/L'] },

    { key: 'copd', label: 'C · 72 M · COPD exacerbation — steady oxycodone + zopiclone',
      name: ['Carl', 'Testpatient'], age: 72, sex: 'male', expect: 'amber',
      conditions: ['COPD with acute exacerbation', 'Lumbar spinal stenosis'],
      orders: [['oxyCODONE 10 mg tablet', 'PO', 10, 'mg', 'q4h PRN pain', true], ['zopiclone 7.5 mg tablet', 'PO', 7.5, 'mg', 'HS PRN sleep', true],
        ['naloxone 0.4 mg/mL injection', 'IV', 0.1, 'mg', 'PRN', true], ['predniSONE 40 mg tablet', 'PO', 40, 'mg', 'daily']],
      given: [['oxyCODONE 10 mg tablet', 'PO', 10, 'mg', [66, 60, 52, 44, 38, 34, 28, 20, 16, 10, 4]], ['zopiclone 7.5 mg tablet', 'PO', 7.5, 'mg', [57, 33, 9]]],
      rr: [[66, 22], [54, 20], [42, 20], [30, 18], [18, 18], [8, 18], [1.5, 18]],
      spo2: [[66, 89], [54, 90], [42, 91], [30, 91], [18, 92], [8, 91], [1.5, 90]],
      o2: [66, 54, 42, 30, 18, 8, 1.5], creat: [88, 'umol/L'] },

    { key: 'tolerant', label: 'D · 58 M · chronic pain on home methadone + fentanyl patch — high MME, tolerant',
      name: ['Dave', 'Testpatient'], age: 58, sex: 'male', expect: 'amber',
      conditions: ['Chronic low back pain', 'Opioid use disorder on opioid agonist therapy', 'Cellulitis left leg'],
      orders: [['methadone 30 mg oral solution', 'PO', 30, 'mg', 'daily', false, true], ['methadone 30 mg oral solution', 'PO', 30, 'mg', 'daily'],
        ['fentaNYL 25 mcg/h transdermal patch', 'transdermal', 25, 'mcg/h', 'q72h'], ['gabapentin 600 mg tablet', 'PO', 600, 'mg', 'TID'],
        ['naloxone 0.4 mg/mL injection', 'IV', 0.1, 'mg', 'PRN', true], ['ceFAZolin 2 g injection', 'IV', 2000, 'mg', 'q8h']],
      given: [['methadone 30 mg oral solution', 'PO', 30, 'mg', [57, 33, 9]], ['gabapentin 600 mg tablet', 'PO', 600, 'mg', [58, 50, 42, 34, 26, 18, 10, 2]]],
      rr: [[60, 16], [48, 16], [36, 16], [24, 15], [12, 16], [1.5, 16]],
      spo2: [[60, 97], [48, 97], [36, 96], [24, 97], [12, 96], [1.5, 97]],
      poss: [[12, 1], [1.5, 1]], creat: [76, 'umol/L'] },

    { key: 'postop', label: 'E · 45 F · post appendectomy — low-dose oxycodone, normal vitals',
      name: ['Erin', 'Testpatient'], age: 45, sex: 'female', expect: 'green',
      conditions: ['Acute appendicitis s/p laparoscopic appendectomy'],
      orders: [['oxyCODONE 5 mg tablet', 'PO', 5, 'mg', 'q4h PRN pain', true], ['naloxone 0.4 mg/mL injection', 'IV', 0.1, 'mg', 'PRN', true],
        ['acetaminophen 1 g tablet', 'PO', 1000, 'mg', 'q6h'], ['ibuprofen 400 mg tablet', 'PO', 400, 'mg', 'q6h PRN', true]],
      given: [['oxyCODONE 5 mg tablet', 'PO', 5, 'mg', [30, 20, 12, 3]]],
      rr: [[30, 16], [20, 16], [12, 14], [2, 16]], spo2: [[30, 98], [20, 97], [12, 98], [2, 98]],
      poss: [[12, 1], [2, 1]], creat: [62, 'umol/L'] },

    { key: 'nomar', label: 'F · 88 F · dementia, delirium — PRN orders only (no MAR data)',
      name: ['Fran', 'Testpatient'], age: 88, sex: 'female', expect: 'amber', noMar: true,
      conditions: ['Alzheimer dementia', 'Delirium', 'Compression fracture T12'],
      orders: [['HYDROmorphone 1 mg tablet', 'PO', 1, 'mg', 'q4h PRN pain', true], ['HYDROmorphone 0.5 mg injection', 'subcut', 0.5, 'mg', 'q2h PRN pain', true],
        ['haloperidol 0.5 mg injection', 'subcut', 0.5, 'mg', 'q4h PRN agitation', true]],
      rr: [[40, 16], [28, 16], [16, 15], [1, 14]], spo2: [[40, 95], [28, 95], [16, 94], [1, 94]],
      poss: [[1, 2]], egfr: 52 }
  ];

  // G: reconstructed, de-identified event - POSS 2, then a LARGER hydromorphone dose, then no check for hours.
  // Shown at two moments: s = hours since the larger dose.
  function eventCase(key, s, when) {
    return { key, label: `${key.toUpperCase()} · 76 F · ${when} — larger hydromorphone dose given at POSS 2, no check since`,
      name: ['Gina', 'Testpatient'], age: 76, sex: 'female', expect: 'red',
      conditions: ['Community-acquired pneumonia', 'Osteoporotic compression fracture L1'],
      orders: [['HYDROmorphone 1-2 mg tablet', 'PO', 2, 'mg', 'q3h PRN pain', true], ['naloxone 0.4 mg/mL injection', 'IV', 0.1, 'mg', 'PRN', true],
        ['acetaminophen 1 g tablet', 'PO', 1000, 'mg', 'q6h']],
      given: [['HYDROmorphone 1-2 mg tablet', 'PO', 1, 'mg', [s + 9, s + 4.5]], ['HYDROmorphone 1-2 mg tablet', 'PO', 2, 'mg', [s]]],
      rr: [[s + 10, 18], [s + 5, 16], [s + 0.2, 14]], spo2: [[s + 10, 96], [s + 5, 95], [s + 0.2, 93]],
      poss: [[s + 5, 1], [s + 0.2, 2]], creat: [75, 'umol/L'] };
  }
  CASES.push(eventCase('g1', 20 / 60, '20 min after dose'), eventCase('g2', 4, '4 h after dose'));

  function build(spec, now) {
    let n = 0;
    const id = () => 'm' + (++n);
    const iso = (h) => new Date(now - h * H).toISOString();
    const loinc = (code, display) => ({ coding: [{ system: 'http://loinc.org', code, display }], text: display });
    const obs = (cat, code, display, h, val, unit) => ({ resourceType: 'Observation', id: id(), status: 'final',
      category: [{ coding: [{ code: cat }] }], code: loinc(code, display), effectiveDateTime: iso(h), valueQuantity: { value: val, unit } });
    const survey = (text, h, val) => ({ resourceType: 'Observation', id: id(), status: 'final',
      category: [{ coding: [{ code: 'survey' }] }], code: { text }, effectiveDateTime: iso(h), valueInteger: val });

    const medRequests = (spec.orders || []).map(([text, route, dose, unit, timing, prn, home]) => ({
      resourceType: 'MedicationRequest', id: id(), status: 'active', intent: 'order',
      category: [{ coding: [{ code: home ? 'community' : 'inpatient' }] }], medicationCodeableConcept: { text },
      dosageInstruction: [{ text: timing, asNeededBoolean: !!prn, route: { text: route }, doseAndRate: [{ doseQuantity: { value: dose, unit } }] }]
    }));
    const medAdmins = [];
    (spec.given || []).forEach(([text, route, dose, unit, hours]) => hours.forEach((h) => medAdmins.push({
      resourceType: 'MedicationAdministration', id: id(), status: 'completed', medicationCodeableConcept: { text },
      effectiveDateTime: iso(h), dosage: { dose: { value: dose, unit }, route: { text: route } } })));

    const vitals = [];
    (spec.rr || []).forEach(([h, v]) => vitals.push(obs('vital-signs', '9279-1', 'Respiratory rate', h, v, '/min')));
    (spec.spo2 || []).forEach(([h, v]) => vitals.push(obs('vital-signs', '59408-5', 'SpO2', h, v, '%')));
    (spec.o2 || []).forEach((h) => vitals.push(obs('vital-signs', '3151-8', 'Oxygen flow rate', h, 2, 'L/min')));
    const survey_ = [];
    (spec.poss || []).forEach(([h, v]) => survey_.push(survey('Pasero Opioid-Induced Sedation Scale (POSS)', h, v)));
    (spec.rass || []).forEach(([h, v]) => survey_.push(survey('Richmond Agitation-Sedation Scale (RASS)', h, v)));
    const labs = [];
    if (spec.creat) labs.push(obs('laboratory', '2160-0', 'Creatinine', 20, spec.creat[0], spec.creat[1]));
    if (spec.egfr != null) labs.push(obs('laboratory', '98979-8', 'eGFR (CKD-EPI 2021)', 20, spec.egfr, 'mL/min/1.73m2'));
    const body = [];
    if (spec.weight) body.push(obs('vital-signs', '29463-7', 'Body weight', 60, spec.weight, 'kg'));
    if (spec.height) body.push(obs('vital-signs', '8302-2', 'Body height', 60, spec.height, 'cm'));

    const birthYear = new Date(now).getFullYear() - spec.age - 1;
    return {
      now, failed: [], medNames: {},
      patient: { resourceType: 'Patient', id: 'demo-' + spec.key, gender: spec.sex, birthDate: birthYear + '-12-31',
        name: [{ use: 'official', given: [spec.name[0]], family: spec.name[1] }] },
      medRequests, medAdmins: spec.noMar ? null : medAdmins, vitals, labs, body, survey: survey_,
      conditions: (spec.conditions || []).map((t) => ({ resourceType: 'Condition', clinicalStatus: { coding: [{ code: 'active' }] }, code: { text: t } }))
    };
  }

  const OPMock = {
    CASES,
    make: (now, key) => build(CASES.find((c) => c.key === key) || CASES[0], now)
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = OPMock; else root.OPMock = OPMock;
})(typeof window !== 'undefined' ? window : globalThis);
