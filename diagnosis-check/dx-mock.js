/*
 * dx-mock.js — a made-up patient (FHIR R4) for testing the Diagnosis check offline.
 * 71-year-old man admitted 3.5 days ago "with community-acquired pneumonia" who is not improving.
 */
(function (root) {
  'use strict';
  const HOUR = 3600 * 1000;

  function makeMockResources(now) {
    now = now || Date.now();
    const ago = h => new Date(now - h * HOUR).toISOString();
    let id = 0;
    const loinc = (code, name) => ({ coding: [{ system: 'http://loinc.org', code, display: name }], text: name });
    const obs = (cat, code, name, h, value, unit) => ({ resourceType: 'Observation', id: 'o' + (++id), status: 'final',
      category: [{ coding: [{ code: cat }] }], code: loinc(code, name), effectiveDateTime: ago(h), valueQuantity: { value, unit } });
    const lab = (code, name, h, v, u) => obs('laboratory', code, name, h, v, u);
    const vit = (code, name, h, v, u) => obs('vital-signs', code, name, h, v, u);
    const med = (text, sig, h) => ({ resourceType: 'MedicationRequest', id: 'm' + (++id), status: 'active', intent: 'order',
      medicationCodeableConcept: { text }, authoredOn: ago(h), dosageInstruction: [{ text: sig }] });
    const cond = (text, cat, h) => ({ resourceType: 'Condition', id: 'c' + (++id), code: { text }, clinicalStatus: { coding: [{ code: 'active' }] },
      category: [{ coding: [{ code: cat }] }], recordedDate: ago(h) });
    const b64 = s => (typeof btoa === 'function' ? btoa(s) : Buffer.from(s).toString('base64'));
    const admitH = 84;

    return {
      patient: { resourceType: 'Patient', id: 'dx-mock', gender: 'male', birthDate: '1955-06-03' },
      encounters: [{ resourceType: 'Encounter', id: 'e1', status: 'in-progress', period: { start: ago(admitH) } }],
      conditions: [
        cond('Community acquired pneumonia', 'encounter-diagnosis', admitH),
        cond('Alcohol use disorder', 'problem-list-item', 24 * 400),
        cond('Hypertension', 'problem-list-item', 24 * 900),
        cond('Type 2 diabetes mellitus', 'problem-list-item', 24 * 900)
      ],
      medRequests: [
        med('ceftriaxone 1 g IV', '1 g IV q24h', admitH - 1),
        med('azithromycin 500 mg IV', '500 mg IV daily', admitH - 1),
        med('vancomycin 1.25 g IV', '1.25 g IV q12h', 50),
        med('lorazepam 1 mg tablet', '1 mg PO q4h PRN agitation', 40),
        med('metoprolol tartrate 25 mg tablet', '25 mg PO BID', admitH - 1),
        med('acetaminophen 650 mg tablet', '650 mg PO q6h', admitH - 1)
      ],
      medAdmins: [],
      observations: [
        ...[[82, 38.9], [60, 38.4], [36, 38.2], [12, 38.6], [4, 38.3]].map(([h, v]) => vit('8310-5', 'Body temperature', h, v, 'Cel')),
        ...[[20, 104], [12, 108], [4, 112]].map(([h, v]) => vit('8867-4', 'Heart rate', h, v, '/min')),
        ...[[20, 24], [4, 26]].map(([h, v]) => vit('9279-1', 'Respiratory rate', h, v, '/min')),
        ...[[82, 124], [20, 118], [4, 112]].map(([h, v]) => vit('8480-6', 'Systolic blood pressure', h, v, 'mm[Hg]')),
        ...[[82, 2], [36, 3], [4, 4]].map(([h, v]) => vit('3151-8', 'Oxygen flow rate', h, v, 'L/min')),
        ...[[82, 11.2], [58, 12.1], [6, 14.8]].map(([h, v]) => lab('6690-2', 'WBC', h, v, '10*9/L')),
        ...[[82, 132], [6, 128]].map(([h, v]) => lab('718-7', 'Hemoglobin', h, v, 'g/L')),
        ...[[82, 90], [6, 95]].map(([h, v]) => lab('2160-0', 'Creatinine', h, v, 'umol/L')),
        ...[[82, 136], [6, 135]].map(([h, v]) => lab('2951-2', 'Sodium', h, v, 'mmol/L')),
        lab('2524-7', 'Lactate', 6, 1.4, 'mmol/L'),
        lab('42637-9', 'BNP', 82, 1450, 'ng/L'),
        lab('33959-8', 'Procalcitonin', 82, 0.08, 'ug/L'),
        lab('17861-6', 'Calcium', 58, 2.84, 'mmol/L'),
        lab('6768-6', 'Alkaline phosphatase', 58, 260, 'U/L'),
        lab('19123-9', 'Magnesium', 58, 0.62, 'mmol/L'),
        lab('2345-7', 'Glucose', 6, 8.1, 'mmol/L'),
        { resourceType: 'Observation', id: 'o' + (++id), status: 'final', category: [{ coding: [{ code: 'laboratory' }] }],
          code: { text: 'Blood culture' }, effectiveDateTime: ago(62), valueString: 'Staphylococcus aureus, methicillin susceptible (MSSA), 2 of 2 bottles' }
      ],
      reports: [
        { resourceType: 'DiagnosticReport', id: 'r1', status: 'final', category: [{ coding: [{ code: 'RAD', display: 'Radiology' }] }],
          code: { text: 'XR Chest 2 views' }, effectiveDateTime: ago(83),
          presentedForm: [{ contentType: 'text/plain', data: b64('Findings: No focal consolidation. Mild interstitial edema and small bilateral pleural effusions. 8 mm nodule in the right upper lobe; recommend CT chest follow-up in 3 months.') }] }
      ],
      orders: [],
      notes: [
        { time: now - 83 * HOUR, title: 'Admission note', text: 'Admitted with community acquired pneumonia. Impression: CAP, start ceftriaxone and azithromycin. Social: drinks 6-8 beers daily.' },
        { time: now - 40 * HOUR, title: 'Progress note', text: 'Blood cultures growing S. aureus, vancomycin added. Intermittently confused overnight. Complains of low back pain since yesterday.' },
        { time: now - 5 * HOUR, title: 'Nursing note', text: 'Pt confused, pulling at lines. Febrile 38.6 overnight. Lorazepam given for agitation.' }
      ]
    };
  }

  root.DXMock = { makeMockResources };
  if (typeof module === 'object' && module.exports) module.exports = { makeMockResources };
})(typeof self !== 'undefined' ? self : this);
