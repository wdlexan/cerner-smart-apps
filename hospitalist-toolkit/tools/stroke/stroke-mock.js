/*
 * stroke-mock.js — made-up patients (FHIR R4) for testing the Stroke Follow-up app. No real patient data.
 *   1  68 M, left M1 occlusion: tenecteplase + EVT 20 h ago, BP spike, new AF on telemetry, 24 h CT due soon
 *   2  58 F, vertigo, vomiting, can't walk: CT and CTA negative, no MRI yet (posterior circulation concern)
 *   3  42 F, small right cortical infarct on MRI, CTA clear, PFO with atrial septal aneurysm (ESUS)
 */
(function (root) {
  'use strict';
  const MIN = 60 * 1000, HOUR = 60 * MIN, DAY = 24 * HOUR;

  function kit(now) {
    let id = 0;
    const iso = t => new Date(t).toISOString();
    const loinc = (code, display) => ({ coding: [{ system: 'http://loinc.org', code, display }], text: display });
    const obs = (cat, code, name, t, value, unit) => ({ resourceType: 'Observation', id: 'o' + (++id), status: 'final', category: [{ coding: [{ code: cat }] }],
      code: loinc(code, name), effectiveDateTime: iso(t), valueQuantity: { value, unit } });
    const bp = (t, s, d) => ({ resourceType: 'Observation', id: 'o' + (++id), status: 'final', category: [{ coding: [{ code: 'vital-signs' }] }],
      code: loinc('85354-9', 'Blood pressure panel'), effectiveDateTime: iso(t),
      component: [{ code: loinc('8480-6', 'Systolic blood pressure'), valueQuantity: { value: s, unit: 'mm[Hg]' } }, { code: loinc('8462-4', 'Diastolic blood pressure'), valueQuantity: { value: d, unit: 'mm[Hg]' } }] });
    const report = (name, t, text) => ({ resourceType: 'DiagnosticReport', id: 'r' + (++id), status: 'final', code: { text: name }, effectiveDateTime: iso(t), conclusion: text });
    const med = (text, t, sig) => ({ resourceType: 'MedicationRequest', id: 'm' + (++id), status: 'active', intent: 'order', medicationCodeableConcept: { text }, authoredOn: iso(t), dosageInstruction: [{ text: sig || '' }] });
    const admin = (text, t) => ({ resourceType: 'MedicationAdministration', id: 'a' + (++id), status: 'completed', medicationCodeableConcept: { text }, effectiveDateTime: iso(t) });
    const cond = text => ({ resourceType: 'Condition', id: 'c' + (++id), code: { text }, clinicalStatus: { coding: [{ code: 'active' }] } });
    const order = (text, t, status) => ({ resourceType: 'ServiceRequest', id: 's' + (++id), status: status || 'active', intent: 'order', code: { text }, authoredOn: iso(t) });
    const enc = (cls, t, open) => Object.assign({ resourceType: 'Encounter', id: 'e' + (++id), status: open ? 'in-progress' : 'finished', class: { code: cls }, period: { start: iso(t) } });
    return { iso, obs, bp, report, med, admin, cond, order, enc,
      sbpSeries: (out, start, list) => list.forEach(([h, s, d]) => out.observations.push(bp(start + h * HOUR, s, d))) };
  }

  function patient1(now) {
    const k = kit(now);
    const arrive = now - 22 * HOUR, tnk = now - 20.5 * HOUR, evtStart = now - 20 * HOUR, evtEnd = now - 19.2 * HOUR;
    const out = { patient: { resourceType: 'Patient', id: 'sf-mock-1', gender: 'male', birthDate: '1958-04-11' },
      encounters: [k.enc('EMER', arrive, false), k.enc('IMP', now - 18 * HOUR, true)],
      conditions: [k.cond('Hypertension'), k.cond('Type 2 diabetes mellitus')],
      medRequests: [k.med('metformin 500 mg oral tablet', now - 17 * HOUR, '500 mg PO BID'), k.med('atorvastatin 80 mg oral tablet', now - 17 * HOUR, '80 mg PO daily')],
      medAdmins: [k.admin('tenecteplase 25 mg IV', tnk), k.admin('labetalol 10 mg IV', now - 14 * HOUR)],
      procedures: [{ resourceType: 'Procedure', id: 'p1', status: 'completed', code: { text: 'Endovascular thrombectomy, left M1' },
        performedPeriod: { start: k.iso(evtStart), end: k.iso(evtEnd) }, note: [{ text: 'eTICI 2b reperfusion. Right femoral access, closure device.' }] }],
      reports: [
        k.report('CT head without contrast', arrive + 0.3 * HOUR, 'No acute intracranial hemorrhage. Early loss of grey-white differentiation left insula. ASPECTS 8.'),
        k.report('CTA head and neck', arrive + 0.4 * HOUR, 'Occlusion of the left M1 segment of the middle cerebral artery. Carotid bifurcations without significant stenosis.')
      ],
      orders: [k.order('CT head without contrast — 24 h post thrombolysis', now - 18 * HOUR), k.order('Echocardiogram transthoracic', now - 16 * HOUR), k.order('Telemetry', now - 18 * HOUR)],
      observations: [k.obs('laboratory', '2345-7', 'Glucose', arrive + 0.2 * HOUR, 11.2, 'mmol/L'), k.obs('laboratory', '2345-7', 'Glucose', now - 3 * HOUR, 9.1, 'mmol/L'),
        k.obs('survey', '72089-6', 'NIH Stroke Scale total', arrive + 0.3 * HOUR, 14, '{score}'), k.obs('survey', '72089-6', 'NIH Stroke Scale total', now - 6 * HOUR, 8, '{score}'),
        k.obs('vital-signs', '8310-5', 'Body temperature', now - 4 * HOUR, 37.2, 'Cel')],
      notes: [
        { time: arrive + 0.5 * HOUR, title: 'ED Physician Note', text: 'Code stroke. Last known well 07:40. Right hemiparesis and aphasia, NIHSS 14. Right homonymous hemianopia. Discussed with neurology: tenecteplase given, transferred for EVT.' },
        { time: evtEnd + 0.5 * HOUR, title: 'Neurology Note', text: 'Post thrombectomy left M1, eTICI 2b. NIHSS improving. BP target less than 180/105 for 24 h. Repeat CT at 24 h before antithrombotics. NPO until swallow screen.' },
        { time: now - 8 * HOUR, title: 'Nursing Note', text: 'Telemetry showing atrial fibrillation, rate 90s, intermittent. Right groin site soft, no hematoma. Swallow screen failed, remains NPO.' }
      ] };
    k.sbpSeries(out, tnk, [[0.2, 172, 92], [1, 168, 90], [3, 176, 94], [6.5, 186, 101], [7, 171, 95], [10, 162, 88], [14, 158, 84], [18, 150, 82], [20, 154, 80]]);
    return out;
  }

  function patient2(now) {
    const k = kit(now);
    const arrive = now - 10 * HOUR;
    const out = { patient: { resourceType: 'Patient', id: 'sf-mock-2', gender: 'female', birthDate: '1968-09-02' },
      encounters: [k.enc('EMER', arrive, false), k.enc('IMP', now - 6 * HOUR, true)],
      conditions: [k.cond('Hypertension'), k.cond('Dyslipidemia')],
      medRequests: [k.med('acetylsalicylic acid 81 mg oral tablet', now - 7 * HOUR, '81 mg PO daily'), k.med('dimenhydrinate 25 mg IV', now - 8 * HOUR, 'q6h PRN')],
      medAdmins: [k.admin('acetylsalicylic acid 160 mg oral', now - 7 * HOUR)],
      procedures: [],
      reports: [
        k.report('CT head without contrast', arrive + 0.5 * HOUR, 'No acute intracranial abnormality. No hemorrhage.'),
        k.report('CTA head and neck', arrive + 0.6 * HOUR, 'No large vessel occlusion. Vertebral and basilar arteries patent. No significant stenosis.')
      ],
      orders: [k.order('MRI brain without contrast', now - 6 * HOUR)],
      observations: [k.obs('laboratory', '2345-7', 'Glucose', arrive + 0.3 * HOUR, 6.4, 'mmol/L')],
      notes: [
        { time: arrive + HOUR, title: 'ED Physician Note', text: 'Sudden onset vertigo at 06:30 this morning with vomiting. Unable to walk without assistance, falls to the left. Nystagmus on left gaze. NIHSS 2 (ataxia). CT and CTA negative. Discussed with neurology: not a lytic candidate given mild deficits outside window. Admit to hospitalist, MRI.' },
        { time: now - 2 * HOUR, title: 'Nursing Note', text: 'Still dizzy, vomiting x2. Gait unsteady, needs assist of 2. Passed bedside swallow screen.' }
      ] };
    k.sbpSeries(out, arrive, [[0.2, 168, 88], [2, 174, 90], [5, 162, 84], [8, 158, 82], [9.5, 160, 80]]);
    return out;
  }

  function patient3(now) {
    const k = kit(now);
    const arrive = now - 3 * DAY;
    const out = { patient: { resourceType: 'Patient', id: 'sf-mock-3', gender: 'female', birthDate: '1984-02-17' },
      encounters: [k.enc('EMER', arrive, false), k.enc('IMP', arrive + 5 * HOUR, true)],
      conditions: [k.cond('Migraine')],
      medRequests: [k.med('acetylsalicylic acid 81 mg oral tablet', arrive + 3 * HOUR), k.med('atorvastatin 40 mg oral tablet', arrive + 6 * HOUR), k.med('enoxaparin 40 mg subcutaneous', arrive + 6 * HOUR, '40 mg SC daily')],
      medAdmins: [],
      procedures: [],
      reports: [
        k.report('CT head without contrast', arrive + 0.5 * HOUR, 'No acute hemorrhage.'),
        k.report('CTA head and neck', arrive + 0.6 * HOUR, 'No large vessel occlusion. No dissection. No significant stenosis.'),
        k.report('MRI brain', arrive + 20 * HOUR, 'Small acute infarct with restricted diffusion in the right frontal cortex (precentral gyrus), 1.2 cm. No hemorrhage.'),
        k.report('Echocardiogram transthoracic with agitated saline (bubble study)', arrive + 2 * DAY, 'Normal LV size and function. Atrial septal aneurysm with patent foramen ovale; large right-to-left shunt with more than 20 microbubbles at rest and with Valsalva. No LV thrombus.'),
        k.report('Telemetry summary', now - 4 * HOUR, '72 h telemetry: sinus rhythm throughout. No atrial fibrillation.')
      ],
      orders: [k.order('Telemetry', arrive + 5 * HOUR), k.order('Physical therapy consult', arrive + 6 * HOUR), k.order('Occupational therapy consult', arrive + 6 * HOUR)],
      observations: [k.obs('laboratory', '2345-7', 'Glucose', arrive + 0.3 * HOUR, 5.6, 'mmol/L'), k.obs('laboratory', '13457-7', 'LDL cholesterol', arrive + DAY, 2.9, 'mmol/L'),
        k.obs('laboratory', '4548-4', 'Hemoglobin A1c', arrive + DAY, 5.4, '%'), k.obs('survey', '72089-6', 'NIH Stroke Scale total', arrive + 0.3 * HOUR, 3, '{score}')],
      notes: [
        { time: arrive + HOUR, title: 'ED Physician Note', text: 'Sudden left hand weakness and clumsiness on waking. NIHSS 3. Non-smoker. No hypertension or diabetes. CT/CTA negative. Neurology: not a lytic candidate (wake-up, mild). Aspirin, admit, MRI.' },
        { time: arrive + 30 * HOUR, title: 'Hospitalist Progress Note', text: 'MRI shows small right frontal cortical infarct. Passed swallow screen. Plan: echo with bubble, telemetry, lipids, A1c.' },
        { time: now - 5 * HOUR, title: 'Hospitalist Progress Note', text: 'Echo: PFO with atrial septal aneurysm and large shunt. Telemetry no AF. Considering embolic stroke of undetermined source with PFO.' }
      ] };
    k.sbpSeries(out, arrive, [[1, 138, 84], [12, 132, 80], [36, 128, 78], [60, 126, 76], [70, 130, 78]]);
    return out;
  }

  function makeMockResources(now, which) {
    now = now || Date.now();
    const f = { 1: patient1, 2: patient2, 3: patient3 }[which || 1] || patient1;
    return Object.assign({ failed: [], reasons: {} }, f(now));
  }
  const PATIENTS = { 1: 'Demo 1 · 68 M · tenecteplase + EVT 20 h ago', 2: 'Demo 2 · 58 F · vertigo, CT/CTA negative, no MRI', 3: 'Demo 3 · 42 F · ESUS with PFO' };
  root.StrokeMock = { makeMockResources, PATIENTS };
  if (typeof module === 'object' && module.exports) module.exports = { makeMockResources, PATIENTS };
})(typeof self !== 'undefined' ? self : this);
