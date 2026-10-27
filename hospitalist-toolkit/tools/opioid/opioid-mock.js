/* Made-up patient for index.html?demo=1 - an 81-year-old woman with sleep apnea and CKD,
   PRN hydromorphone that has been escalating, plus lorazepam, gabapentin and quetiapine,
   with RR and SpO2 drifting down overnight and a POSS of 3 charted. No naloxone order. */
(function (root) {
  const H = 3600 * 1000;
  const iso = (t) => new Date(t).toISOString();
  const loinc = (code, display) => ({ coding: [{ system: 'http://loinc.org', code, display }], text: display });

  function make(now) {
    let n = 0;
    const id = () => 'm' + (++n);
    const req = (text, route, doseVal, unit, timingText, prn, category) => ({
      resourceType: 'MedicationRequest', id: id(), status: 'active', intent: 'order',
      category: [{ coding: [{ code: category || 'inpatient' }] }],
      medicationCodeableConcept: { text },
      dosageInstruction: [{ text: timingText, asNeededBoolean: !!prn, route: { text: route },
        doseAndRate: [{ doseQuantity: { value: doseVal, unit } }] }]
    });
    const mar = (text, hoursAgo, val, unit, route) => ({
      resourceType: 'MedicationAdministration', id: id(), status: 'completed',
      medicationCodeableConcept: { text }, effectiveDateTime: iso(now - hoursAgo * H),
      dosage: { dose: { value: val, unit }, route: { text: route } }
    });
    const obs = (cat, code, display, hoursAgo, val, unit) => ({
      resourceType: 'Observation', id: id(), status: 'final',
      category: [{ coding: [{ code: cat }] }], code: loinc(code, display),
      effectiveDateTime: iso(now - hoursAgo * H), valueQuantity: { value: val, unit }
    });
    const survey = (text, hoursAgo, val) => ({
      resourceType: 'Observation', id: id(), status: 'final', category: [{ coding: [{ code: 'survey' }] }],
      code: { text }, effectiveDateTime: iso(now - hoursAgo * H), valueInteger: val
    });

    const medRequests = [
      req('HYDROmorphone 2 mg tablet', 'PO', 2, 'mg', 'q2h PRN pain', true),
      req('HYDROmorphone 0.5 mg injection', 'IV', 0.5, 'mg', 'q1h PRN severe pain', true),
      req('LORazepam 0.5 mg tablet', 'SL', 0.5, 'mg', 'q4h PRN anxiety', true),
      req('gabapentin 300 mg capsule', 'PO', 300, 'mg', 'TID', false),
      req('QUEtiapine 25 mg tablet', 'PO', 25, 'mg', 'HS', false),
      req('acetaminophen 1 g tablet', 'PO', 1000, 'mg', 'q6h', false),
      req('apixaban 2.5 mg tablet', 'PO', 2.5, 'mg', 'BID', false)
    ];

    const medAdmins = [];
    // Hydromorphone PO: 2 doses the day before yesterday, 3 yesterday, 6 in the last 24 h
    [64, 55, 44, 38, 30, 22, 18, 14, 10, 6, 3].forEach((h) => medAdmins.push(mar('HYDROmorphone 2 mg tablet', h, 2, 'mg', 'PO')));
    [20, 8].forEach((h) => medAdmins.push(mar('HYDROmorphone 0.5 mg injection', h, 0.5, 'mg', 'IV')));
    [26, 4].forEach((h) => medAdmins.push(mar('LORazepam 0.5 mg tablet', h, 0.5, 'mg', 'SL')));
    [56, 48, 40, 32, 24, 16, 8].forEach((h) => medAdmins.push(mar('gabapentin 300 mg capsule', h, 300, 'mg', 'PO')));
    [50, 26, 2].forEach((h) => medAdmins.push(mar('QUEtiapine 25 mg tablet', h, 25, 'mg', 'PO')));

    const vitals = [];
    const rrs = [[70, 18], [62, 18], [54, 17], [46, 16], [38, 16], [30, 15], [22, 14], [14, 14], [10, 12], [6, 11], [2, 9]];
    const sps = [[70, 95], [62, 95], [54, 94], [46, 94], [38, 93], [30, 93], [22, 92], [14, 92], [10, 91], [6, 90], [2, 87]];
    rrs.forEach(([h, v]) => vitals.push(obs('vital-signs', '9279-1', 'Respiratory rate', h, v, '/min')));
    sps.forEach(([h, v]) => vitals.push(obs('vital-signs', '59408-5', 'SpO2', h, v, '%')));
    [6, 2].forEach((h) => vitals.push(obs('vital-signs', '3151-8', 'Oxygen flow rate', h, 2, 'L/min')));

    return {
      now,
      patient: { resourceType: 'Patient', id: 'demo', gender: 'female', birthDate: new Date(now).getFullYear() - 81 + '-03-14',
        name: [{ use: 'official', given: ['Demo'], family: 'Patient' }] },
      medRequests, medAdmins, vitals,
      labs: [obs('laboratory', '2160-0', 'Creatinine', 20, 168, 'umol/L')],
      body: [obs('vital-signs', '29463-7', 'Body weight', 60, 98, 'kg'), obs('vital-signs', '8302-2', 'Body height', 60, 158, 'cm')],
      survey: [survey('Pasero Opioid-Induced Sedation Scale (POSS)', 12, 2), survey('Pasero Opioid-Induced Sedation Scale (POSS)', 2, 3)],
      conditions: [
        { resourceType: 'Condition', clinicalStatus: { coding: [{ code: 'active' }] }, code: { text: 'Obstructive sleep apnea' } },
        { resourceType: 'Condition', clinicalStatus: { coding: [{ code: 'active' }] }, code: { text: 'Chronic kidney disease stage 3b' } },
        { resourceType: 'Condition', clinicalStatus: { coding: [{ code: 'active' }] }, code: { text: 'Hip fracture, left, s/p hemiarthroplasty' } }
      ],
      medNames: {}, failed: []
    };
  }
  const OPMock = { make };
  if (typeof module !== 'undefined' && module.exports) module.exports = OPMock; else root.OPMock = OPMock;
})(typeof window !== 'undefined' ? window : globalThis);
