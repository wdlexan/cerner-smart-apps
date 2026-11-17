/*
 * dm-mock.js — made-up patients (FHIR R4) for testing the Inpatient Diabetes app. No real patient data.
 *   1  78 F, type 2, pneumonia, eGFR 28, basal-bolus + gliclazide + metformin, poor intake, overnight/fasting lows
 *   2  64 M, type 2, COPD on prednisone 40 mg, CAD + heart failure, correction insulin only, afternoon highs, A1C 9.6
 *   3  26 F, type 1, NPO for appendectomy, basal insulin not reordered, correction only
 */
(function (root) {
  'use strict';
  const MIN = 60 * 1000, HOUR = 60 * MIN, DAY = 24 * HOUR;
  function kit(now) {
    let id = 0;
    const iso = t => new Date(t).toISOString();
    const at = (daysAgo, hh, mm) => { const d = new Date(now); d.setHours(0, 0, 0, 0); return d.getTime() - daysAgo * DAY + hh * HOUR + (mm || 0) * MIN; };
    const loinc = (code, display) => ({ coding: [{ system: 'http://loinc.org', code, display }], text: display });
    const obs = (cat, code, name, t, value, unit) => ({ resourceType: 'Observation', id: 'o' + (++id), status: 'final', category: [{ coding: [{ code: cat }] }], code: loinc(code, name), effectiveDateTime: iso(t), valueQuantity: { value, unit } });
    const poc = (t, v) => obs('laboratory', '41653-7', 'Glucose POC', t, v, 'mmol/L');
    const lab = (code, name, t, v, unit) => obs('laboratory', code, name, t, v, unit);
    const med = (text, sig, units) => Object.assign({ resourceType: 'MedicationRequest', id: 'm' + (++id), status: 'active', intent: 'order', medicationCodeableConcept: { text }, authoredOn: iso(now - 3 * DAY), dosageInstruction: [{ text: sig }] },
      units != null ? { dosageInstruction: [{ text: sig, doseAndRate: [{ doseQuantity: { value: units, unit: 'unit' } }] }] } : {});
    const give = (text, t, units, note) => ({ resourceType: 'MedicationAdministration', id: 'a' + (++id), status: 'completed', medicationCodeableConcept: { text }, effectiveDateTime: iso(t), dosage: { text: note || '', dose: { value: units, unit: 'unit' } } });
    const cond = (text, onset) => Object.assign({ resourceType: 'Condition', id: 'c' + (++id), code: { text }, clinicalStatus: { coding: [{ code: 'active' }] } }, onset ? { onsetDateTime: iso(onset) } : {});
    const enc = t => ({ resourceType: 'Encounter', id: 'e' + (++id), status: 'in-progress', class: { code: 'IMP' }, period: { start: iso(t) } });
    const series = (out, list) => list.forEach(([d, h, m, v]) => out.observations.push(poc(at(d, h, m), v)));
    return { iso, at, obs, poc, lab, med, give, cond, enc, series };
  }

  function p1(now) {
    const k = kit(now), at = k.at;
    const out = { patient: { resourceType: 'Patient', id: 'dm-mock-1', gender: 'female', birthDate: '1948-03-21' }, encounters: [k.enc(at(3, 14))],
      conditions: [k.cond('Type 2 diabetes mellitus', now - 18 * 365 * DAY), k.cond('Coronary artery disease, prior myocardial infarction'), k.cond('Hypertension'), k.cond('Chronic kidney disease stage 4'), k.cond('Community-acquired pneumonia')],
      medRequests: [k.med('insulin glargine 100 unit/mL', '14 units subcut at bedtime', 14), k.med('insulin aspart 100 unit/mL', '4 units subcut with breakfast, lunch and supper', 4),
        k.med('insulin aspart 100 unit/mL', 'correction scale subcut before meals and at bedtime per protocol'), k.med('gliclazide MR 60 mg oral tablet', '60 mg PO daily with breakfast'),
        k.med('metformin 500 mg oral tablet', '500 mg PO BID'), k.med('acetylsalicylic acid 81 mg', '81 mg PO daily'), k.med('atorvastatin 40 mg', '40 mg PO daily'), k.med('metoprolol 25 mg', '25 mg PO BID'), k.med('ceftriaxone 1 g IV', 'q24h')],
      medAdmins: [], observations: [k.obs('vital-signs', '29463-7', 'Body weight', at(3, 15), 54, 'kg'), k.lab('4548-4', 'Hemoglobin A1c', at(3, 16), 7.4, '%'), k.lab('33914-3', 'eGFR', at(0, 6), 28, 'mL/min/1.73m2'),
        k.lab('13457-7', 'LDL cholesterol', now - 200 * DAY, 2.6, 'mmol/L'), k.obs('vital-signs', '8480-6', 'Systolic blood pressure', at(0, 8), 138, 'mm[Hg]')], notes: [] };
    for (let d = 2; d >= 0; d--) {
      out.medAdmins.push(k.give('insulin glargine 100 unit/mL', at(d + 1, 22), 14));
      [[8, 0], [12, 0], [17, 30]].forEach(([h, m]) => { if (!(d === 0 && h > 15)) out.medAdmins.push(k.give('insulin aspart 100 unit/mL', at(d, h, m), 4, 'meal dose')); });
    }
    out.medAdmins.push(k.give('insulin aspart 100 unit/mL', at(2, 17, 30), 2, 'correction scale'));
    k.series(out, [[2, 7, 40, 6.8], [2, 11, 45, 9.4], [2, 17, 20, 11.2], [2, 21, 30, 8.9], [1, 3, 10, 3.4], [1, 3, 30, 5.6], [1, 7, 40, 4.6], [1, 11, 45, 7.2], [1, 17, 20, 8.1], [1, 21, 30, 6.9], [0, 6, 55, 2.6], [0, 7, 15, 5.1], [0, 11, 45, 6.4]]);
    out.notes.push({ time: at(1, 19), title: 'Nursing Note', text: 'Poor intake, ate about 25% of supper. Drowsy with fever.' }, { time: at(0, 7, 20), title: 'Nursing Note', text: 'Diaphoretic and confused at 0655, BG 2.6. Treated with 20 g glucose, recheck 5.1. Ate 25% of breakfast.' });
    return out;
  }

  function p2(now) {
    const k = kit(now), at = k.at;
    const out = { patient: { resourceType: 'Patient', id: 'dm-mock-2', gender: 'male', birthDate: '1962-06-30' }, encounters: [k.enc(at(3, 10))],
      conditions: [k.cond('Type 2 diabetes mellitus', now - 9 * 365 * DAY), k.cond('COPD exacerbation'), k.cond('Coronary artery disease'), k.cond('Heart failure with reduced ejection fraction'), k.cond('Hypertension'), k.cond('Current smoker')],
      medRequests: [k.med('insulin lispro 100 unit/mL', 'correction scale subcut AC and HS per protocol'), k.med('metformin 1000 mg oral tablet', '1000 mg PO BID'), k.med('prednisone 40 mg oral tablet', '40 mg PO daily in the morning'),
        k.med('acetylsalicylic acid 81 mg', '81 mg PO daily'), k.med('bisoprolol 5 mg', '5 mg PO daily'), k.med('furosemide 40 mg', '40 mg PO daily'), k.med('tiotropium', 'daily')],
      medAdmins: [], observations: [k.obs('vital-signs', '29463-7', 'Body weight', at(3, 11), 92, 'kg'), k.lab('4548-4', 'Hemoglobin A1c', at(3, 12), 9.6, '%'), k.lab('33914-3', 'eGFR', at(0, 6), 71, 'mL/min/1.73m2'),
        k.lab('13457-7', 'LDL cholesterol', at(2, 6), 3.1, 'mmol/L'), k.lab('9318-7', 'Albumin/creatinine ratio urine', at(2, 6), 4.2, 'mg/mmol'), k.obs('vital-signs', '8480-6', 'Systolic blood pressure', at(0, 8), 142, 'mm[Hg]')], notes: [] };
    [[2, 17, 30, 4], [2, 21, 30, 4], [1, 12, 0, 2], [1, 17, 30, 6], [1, 21, 30, 4], [0, 12, 0, 4], [0, 17, 30, 6]].forEach(([d, h, m, u]) => out.medAdmins.push(k.give('insulin lispro 100 unit/mL', at(d, h, m), u, 'correction scale')));
    k.series(out, [[2, 7, 30, 8.4], [2, 11, 50, 10.8], [2, 17, 15, 15.2], [2, 21, 20, 14.1], [1, 7, 30, 8.9], [1, 11, 50, 12.6], [1, 17, 15, 16.8], [1, 21, 20, 13.5], [0, 7, 30, 8.6], [0, 11, 50, 12.9], [0, 17, 15, 17.4]]);
    out.notes.push({ time: at(1, 10), title: 'Hospitalist Progress Note', text: 'COPD exacerbation improving on prednisone 40 mg. Glucose high in the afternoons. Eating well. Not on insulin at home.' });
    return out;
  }

  function p3(now) {
    const k = kit(now), at = k.at;
    const out = { patient: { resourceType: 'Patient', id: 'dm-mock-3', gender: 'female', birthDate: '2000-08-11' }, encounters: [k.enc(at(1, 20))],
      conditions: [k.cond('Type 1 diabetes mellitus', now - 12 * 365 * DAY), k.cond('Acute appendicitis')],
      medRequests: [k.med('insulin aspart 100 unit/mL', 'correction scale subcut q4h while NPO per protocol')],
      medAdmins: [k.give('insulin glargine 100 unit/mL', at(2, 21), 18, 'home dose'), k.give('insulin aspart 100 unit/mL', at(0, 4), 3, 'correction scale'), k.give('insulin aspart 100 unit/mL', at(0, 8), 4, 'correction scale')],
      observations: [k.obs('vital-signs', '29463-7', 'Body weight', at(1, 21), 58, 'kg'), k.lab('4548-4', 'Hemoglobin A1c', at(1, 22), 8.1, '%'), k.lab('33914-3', 'eGFR', at(0, 5), 110, 'mL/min/1.73m2'),
        k.lab('1963-8', 'Bicarbonate', at(0, 5), 21, 'mmol/L'), k.lab('53060-9', 'Beta-hydroxybutyrate', at(0, 5), 0.9, 'mmol/L')], orders: [{ resourceType: 'ServiceRequest', id: 's1', status: 'active', intent: 'order', code: { text: 'Diet: NPO' }, authoredOn: k.iso(at(1, 21)) }], notes: [] };
    k.series(out, [[1, 21, 0, 9.8], [0, 0, 10, 11.6], [0, 4, 0, 13.9], [0, 8, 0, 14.6], [0, 12, 0, 12.8]]);
    out.notes.push({ time: at(1, 22), title: 'Surgery Consult', text: 'Acute appendicitis. NPO for OR today. Type 1 diabetes, home glargine 18 units at bedtime, aspart with meals by carb counting. Uses Libre CGM.' });
    return out;
  }

  function makeMockResources(now, which) { now = now || Date.now(); return Object.assign({ failed: [], reasons: {}, orders: [] }, ({ 1: p1, 2: p2, 3: p3 }[which || 1] || p1)(now)); }
  const PATIENTS = { 1: 'Demo 1 · 78 F · T2, eGFR 28, lows', 2: 'Demo 2 · 64 M · T2 on prednisone, HF', 3: 'Demo 3 · 26 F · T1, NPO, no basal' };
  root.DMMock = { makeMockResources, PATIENTS };
  if (typeof module === 'object' && module.exports) module.exports = { makeMockResources, PATIENTS };
})(typeof self !== 'undefined' ? self : this);
