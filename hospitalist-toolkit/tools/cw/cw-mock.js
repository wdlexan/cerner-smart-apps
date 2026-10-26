/*
 * cw-mock.js — a made-up patient (FHIR R4 resources) for testing the Choosing Wisely tab offline.
 * 84-year-old woman admitted 5 days ago after a fall with confusion.
 */
(function (root) {
  'use strict';
  const HOUR = 3600 * 1000, DAY = 24 * HOUR;

  function makeMockResources(now) {
    now = now || Date.now();
    const ago = h => new Date(now - h * HOUR).toISOString();
    const loinc = (code, display) => ({ coding: [{ system: 'http://loinc.org', code, display }], text: display });
    let id = 0;
    const lab = (code, name, hoursAgo, value, unit) => ({ resourceType: 'Observation', id: 'o' + (++id), status: 'final',
      category: [{ coding: [{ code: 'laboratory' }] }], code: loinc(code, name), effectiveDateTime: ago(hoursAgo), valueQuantity: { value, unit } });
    const vital = (code, name, hoursAgo, value, unit) => Object.assign(lab(code, name, hoursAgo, value, unit),
      { category: [{ coding: [{ code: 'vital-signs' }] }] });
    const med = (text, sig, opts) => ({ resourceType: 'MedicationRequest', id: 'm' + (++id), status: 'active', intent: 'order',
      medicationCodeableConcept: { text }, authoredOn: ago((opts && opts.hoursAgo) || 24 * 30),
      dosageInstruction: [Object.assign({ text: sig }, opts && opts.prn ? { asNeededBoolean: true } : {},
        opts && opts.route ? { route: { text: opts.route } } : {})] });
    const admin = (text, hoursAgo) => ({ resourceType: 'MedicationAdministration', id: 'a' + (++id), status: 'completed',
      medicationCodeableConcept: { text }, effectiveDateTime: ago(hoursAgo) });
    const cond = text => ({ resourceType: 'Condition', id: 'c' + (++id), code: { text }, clinicalStatus: { coding: [{ code: 'active' }] } });

    // Daily morning labs over the last 4 days (hours ago: 78, 54, 30, 6)
    const days4 = [78, 54, 30, 6];
    const series = (code, name, vals, unit) => days4.map((h, i) => lab(code, name, h, vals[i], unit));

    return {
      patient: { resourceType: 'Patient', id: 'cw-mock', gender: 'female', birthDate: '1942-02-14' },
      encounters: [{ resourceType: 'Encounter', id: 'e1', status: 'in-progress', class: { code: 'IMP' }, period: { start: ago(5 * 24) } }],
      medRequests: [
        med('ciprofloxacin 500 mg oral tablet', '500 mg PO BID', { hoursAgo: 70 }),
        med('zopiclone 7.5 mg oral tablet', '7.5 mg PO qHS PRN sleep', { prn: true, hoursAgo: 100 }),
        med('quetiapine 25 mg oral tablet', '12.5–25 mg PO q6h PRN agitation', { prn: true, hoursAgo: 90 }),
        med('pantoprazole 40 mg oral tablet', '40 mg PO daily', { hoursAgo: 110 }),
        med('Spiriva Respimat 2.5 mcg/actuation', '2 puffs inhaled daily', { route: 'Inhalation' }),
        med('apixaban 2.5 mg oral tablet', '2.5 mg PO BID'),
        med('metoprolol tartrate 25 mg oral tablet', '25 mg PO BID'),
        med('acetaminophen 650 mg oral tablet', '650 mg PO q6h')
      ],
      medAdmins: [
        admin('zopiclone 7.5 mg oral tablet', 30), admin('zopiclone 7.5 mg oral tablet', 54),
        admin('quetiapine 25 mg oral tablet', 28)
      ],
      observations: [
        ...series('718-7', 'Hemoglobin', [118, 121, 119, 120], 'g/L'),
        ...series('6690-2', 'WBC', [14.2, 11.8, 9.6, 8.1], '10*9/L'),
        ...series('777-3', 'Platelets', [221, 230, 226, 232], '10*9/L'),
        ...series('2951-2', 'Sodium', [138, 137, 139, 138], 'mmol/L'),
        ...series('2823-3', 'Potassium', [4.1, 4.3, 3.9, 4.2], 'mmol/L'),
        ...series('2160-0', 'Creatinine', [88, 92, 90, 89], 'umol/L'),
        ...[100, 76, 52, 28, 8].map(h => vital('8310-5', 'Body temperature', h, 36.9, 'Cel')),
        { resourceType: 'Observation', id: 'o' + (++id), status: 'final', category: [{ coding: [{ code: 'laboratory' }] }],
          code: { text: 'Urine culture' }, effectiveDateTime: ago(74), valueString: '>10^8 CFU/L Escherichia coli' },
        // Spirometry from two years ago (so the inhaler check comes out OK)
        Object.assign(lab('19926-5', 'FEV1/FVC', 24 * 730, 0.58, '1'), { category: [{ coding: [{ code: 'exam' }] }] })
      ],
      reports: [],
      orders: [
        { resourceType: 'ServiceRequest', id: 's1', status: 'active', intent: 'order', code: { text: 'Cardiac telemetry monitoring' }, authoredOn: ago(4 * 24) }
      ],
      conditions: [cond('Dementia, Alzheimer type'), cond('Metastatic breast cancer'), cond('COPD'), cond('Atrial fibrillation'), cond('Hypertension')],
      notes: [
        { time: now - 118 * HOUR, title: 'ED note', text: 'Found on floor at home by daughter, confused. Foley catheter inserted in ED for urine sample and monitoring. Admit to hospitalist, telemetry.' },
        { time: now - 72 * HOUR, title: 'Progress note', text: 'UA positive, urine culture growing E. coli, started ciprofloxacin. Afebrile. Denies dysuria. Confusion likely multifactorial. Plan: continue tele.' },
        { time: now - 7 * HOUR, title: 'Nursing note', text: 'Pt confused overnight, reoriented x3. Foley draining clear yellow urine. Zopiclone given for sleep at 0200. No complaints of pain.' }
      ]
    };
  }

  root.CWMock = { makeMockResources };
  if (typeof module === 'object' && module.exports) module.exports = { makeMockResources };
})(typeof self !== 'undefined' ? self : this);
