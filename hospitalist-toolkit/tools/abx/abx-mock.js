/* Made-up test patients for index.html?demo=1. Times are relative to "now". */
(function (root) {
  'use strict';
  const H = 3600 * 1000, D = 24 * H;
  const iso = (t) => new Date(t).toISOString();

  const patient = (id, given, family, sex, ageY) => ({ resourceType: 'Patient', id, gender: sex,
    birthDate: new Date(Date.now() - ageY * 365.25 * D).toISOString().slice(0, 10), name: [{ use: 'official', given: [given], family }] });
  const enc = (now, daysAgo) => ({ resourceType: 'Encounter', id: 'e1', status: 'in-progress', period: { start: iso(now - daysAgo * D) } });
  const order = (id, name, route, dose, startAgo, now, status) => ({ resourceType: 'MedicationRequest', id, status: status || 'active',
    medicationCodeableConcept: { text: name }, authoredOn: iso(now - startAgo),
    dosageInstruction: [{ text: dose, route: { text: route } }] });
  const obs = (code, v, unit, t, cat) => ({ resourceType: 'Observation', status: 'final', category: [{ coding: [{ code: cat || 'vital-signs' }] }],
    code: { coding: [{ system: 'http://loinc.org', code }] }, valueQuantity: { value: v, unit }, effectiveDateTime: iso(t) });
  const cond = (text) => ({ resourceType: 'Condition', code: { text } });
  const report = (text, t) => ({ resourceType: 'DiagnosticReport', status: 'final', code: { text }, effectiveDateTime: iso(t) });

  // doses of one drug every `everyH` hours from startAgo until stopAgo (ms before now)
  function doses(name, route, dose, everyH, startAgo, stopAgo, now) {
    const out = []; for (let t = now - startAgo; t <= now - (stopAgo || 0); t += everyH * H)
      out.push({ resourceType: 'MedicationAdministration', status: 'completed', medicationCodeableConcept: { text: name },
        effectiveDateTime: iso(t), dosage: { route: { text: route }, text: dose } });
    return out;
  }
  // vitals every 6 h over the last 3 days; f(hoursAgo) => { t, hr, sbp }
  function vitals(now, f) {
    const out = []; for (let h = 72; h >= 0; h -= 6) { const v = f(h); const t = now - h * H;
      out.push(obs('8310-5', v.t, 'Cel', t), obs('8867-4', v.hr, '/min', t), obs('8480-6', v.sbp, 'mm[Hg]', t)); }
    return out;
  }
  const labs = (now, list) => list.map(([daysAgo, code, v, unit]) => obs(code, v, unit, now - daysAgo * D, 'laboratory'));
  const weight = (now, kg) => [obs('29463-7', kg, 'kg', now - 3 * D)];

  const CASES = [
    { key: 'cap', label: 'CAP day 6 on IV ceftriaxone + azithro, now stable',
      make: (now) => ({
        patient: patient('demo-cap', 'Arthur', 'TESTCAP', 'male', 74), encounters: [enc(now, 6)],
        conditions: [cond('Community acquired pneumonia'), cond('Hypertension')],
        medRequests: [order('o1', 'cefTRIAXone 1 g', 'Intravenous', '1 g IV q24h', 5.5 * D, now), order('o2', 'azithromycin 500 mg', 'Intravenous', '500 mg IV daily', 5.5 * D, now),
          order('o3', 'ramipril 5 mg tab', 'Oral', '5 mg PO daily', 5.5 * D, now)],
        medAdmins: [...doses('cefTRIAXone 1 g', 'Intravenous', '1 g', 24, 5.5 * D, 0, now), ...doses('azithromycin 500 mg', 'Intravenous', '500 mg', 24, 5.5 * D, 0, now)],
        vitals: vitals(now, (h) => ({ t: h > 48 ? 38.6 : 37.0, hr: h > 48 ? 108 : 84, sbp: 124 })),
        labs: labs(now, [[5, '6690-2', 16.2, '10*9/L'], [3, '6690-2', 12.8, '10*9/L'], [1, '6690-2', 9.1, '10*9/L'], [5, '14682-9', 98, 'umol/L'], [1, '14682-9', 92, 'umol/L']]),
        body: weight(now, 78) }) },
    { key: 'pyelo', label: 'Pyelonephritis day 3 on pip-tazo + metronidazole, CrCl < 20',
      make: (now) => ({
        patient: patient('demo-pyelo', 'Edna', 'TESTPYELO', 'female', 86), encounters: [enc(now, 3)],
        conditions: [cond('Acute pyelonephritis'), cond('Chronic kidney disease stage 3b')],
        medRequests: [order('o1', 'piperacillin-tazobactam 4.5 g', 'Intravenous', '4.5 g IV q6h', 2.6 * D, now), order('o2', 'metronidazole 500 mg', 'Intravenous', '500 mg IV q12h', 2 * D, now),
          order('o3', 'acetaminophen 650 mg', 'Oral', '650 mg PO q6h prn', 2.6 * D, now)],
        medAdmins: [...doses('piperacillin-tazobactam 4.5 g', 'Intravenous', '4.5 g', 6, 2.6 * D, 0, now), ...doses('metronidazole 500 mg', 'Intravenous', '500 mg', 12, 2 * D, 0, now)],
        vitals: vitals(now, (h) => ({ t: h > 12 ? 38.4 : 37.6, hr: h > 12 ? 112 : 96, sbp: h > 30 ? 96 : 112 })),
        labs: labs(now, [[3, '6690-2', 18.4, '10*9/L'], [1, '6690-2', 14.0, '10*9/L'], [3, '14682-9', 132, 'umol/L'], [1, '14682-9', 168, 'umol/L']]),
        body: weight(now, 52) }) },
    { key: 'sab', label: 'S. aureus bacteremia day 5 on cefazolin (+ vanco stopped)',
      make: (now) => ({
        patient: patient('demo-sab', 'Victor', 'TESTSAB', 'male', 61), encounters: [enc(now, 4)],
        conditions: [cond('MSSA bacteremia'), cond('Type 2 diabetes'), cond('Moderate aortic stenosis')],
        reports: [report('Echocardiogram transthoracic (TTE)', now - 2 * D)],
        medRequests: [order('o1', 'ceFAZolin 2 g', 'Intravenous', '2 g IV q8h', 2.5 * D, now), order('o2', 'vancomycin 1.25 g', 'Intravenous', '1.25 g IV q12h', 3.8 * D, now, 'stopped'),
          order('o3', 'metformin 500 mg', 'Oral', '500 mg PO bid', 3.8 * D, now)],
        medAdmins: [...doses('vancomycin 1.25 g', 'Intravenous', '1.25 g', 12, 3.8 * D, 2.6 * D, now), ...doses('ceFAZolin 2 g', 'Intravenous', '2 g', 8, 2.5 * D, 0, now)],
        vitals: vitals(now, () => ({ t: 36.9, hr: 82, sbp: 132 })),
        labs: labs(now, [[4, '6690-2', 13.5, '10*9/L'], [1, '6690-2', 8.2, '10*9/L'], [1, '14682-9', 80, 'umol/L'], [4, '1988-5', 214, 'mg/L'], [1, '1988-5', 96, 'mg/L']]),
        body: weight(now, 95) }) },
    { key: 'efae', label: 'E. faecalis bacteremia day 2 on ampicillin, urinary source',
      make: (now) => ({
        patient: patient('demo-efae', 'Harold', 'TESTENTERO', 'male', 79), encounters: [enc(now, 2)],
        conditions: [cond('Enterococcus faecalis bacteremia'), cond('Benign prostatic hyperplasia with urinary retention')],
        medRequests: [order('o1', 'ampicillin 2 g', 'Intravenous', '2 g IV q4h', 1.7 * D, now), order('o2', 'tamsulosin 0.4 mg', 'Oral', '0.4 mg PO daily', 1.7 * D, now)],
        medAdmins: doses('ampicillin 2 g', 'Intravenous', '2 g', 4, 1.7 * D, 0, now),
        vitals: vitals(now, (h) => ({ t: h > 36 ? 38.3 : 37.2, hr: 90, sbp: 128 })),
        labs: labs(now, [[2, '6690-2', 14.1, '10*9/L'], [0.5, '6690-2', 10.2, '10*9/L'], [0.5, '14682-9', 110, 'umol/L'], [2, '1988-5', 120, 'mg/L']]),
        body: weight(now, 72) }) },
    { key: 'cell', label: 'Cellulitis day 2 on vanco + cefazolin, still febrile',
      make: (now) => ({
        patient: patient('demo-cell', 'Grace', 'TESTCELL', 'female', 48), encounters: [enc(now, 2)],
        conditions: [cond('Cellulitis of left leg')],
        medRequests: [order('o1', 'ceFAZolin 2 g', 'Intravenous', '2 g IV q8h', 1.6 * D, now), order('o2', 'vancomycin 1.5 g', 'Intravenous', '1.5 g IV q12h', 1.6 * D, now)],
        medAdmins: [...doses('ceFAZolin 2 g', 'Intravenous', '2 g', 8, 1.6 * D, 0, now), ...doses('vancomycin 1.5 g', 'Intravenous', '1.5 g', 12, 1.6 * D, 0, now)],
        vitals: vitals(now, (h) => ({ t: h % 12 === 0 ? 38.4 : 37.6, hr: 104, sbp: 118 })),
        labs: labs(now, [[2, '6690-2', 13.9, '10*9/L'], [0.5, '6690-2', 14.6, '10*9/L'], [2, '14682-9', 70, 'umol/L'], [0.5, '14682-9', 104, 'umol/L']]),
        body: weight(now, 110) }) }
  ];

  // Earlier courses (outpatient prescriptions + a past admission) for the history card
  const PRIOR = {
    cap: [['amoxicillin-clavulanate 875 mg', 'Oral', '875 mg PO bid', 245, 7], ['azithromycin 250 mg', 'Oral', '500 mg day 1 then 250 mg daily', 420, 5]],
    pyelo: [['ciprofloxacin 500 mg', 'Oral', '500 mg PO bid', 62, 7], ['nitrofurantoin 100 mg', 'Oral', '100 mg PO bid', 150, 5], ['cephalexin 500 mg', 'Oral', '500 mg PO qid', 300, 7]],
    sab: [['cephalexin 500 mg', 'Oral', '500 mg PO qid', 33, 10]],
    efae: [['ciprofloxacin 500 mg', 'Oral', '500 mg PO bid', 120, 7]],
    cell: [['cephalexin 500 mg', 'Oral', '500 mg PO qid', 21, 7], ['clindamycin 300 mg', 'Oral', '300 mg PO qid', 400, 7]]
  };
  function history(now, key, days) {
    const cur = CASES.find((x) => x.key === key) || CASES[0], d = cur.make(now);
    const prior = (PRIOR[cur.key] || []).map(([name, route, dose, ago, len], i) => ({ resourceType: 'MedicationRequest', id: 'h' + i, status: 'completed',
      medicationCodeableConcept: { text: name }, authoredOn: iso(now - ago * D),
      dosageInstruction: [{ text: dose, route: { text: route }, timing: { repeat: { boundsPeriod: { start: iso(now - ago * D), end: iso(now - (ago - len) * D) } } } }] }));
    // a past admission with charted IV doses, 5 months ago
    const pastAdmin = cur.key === 'cap' ? doses('piperacillin-tazobactam 4.5 g', 'Intravenous', '4.5 g', 8, 152 * D, 148 * D, now) : [];
    return new Promise((res) => setTimeout(() => res({ medRequests: d.medRequests.concat(prior), medAdmins: d.medAdmins.concat(pastAdmin), medNames: {} }), 250));
  }

  // Made-up echo report text for the report reader
  const ECHO_TEXT = {
    sab: [[2, 'Echocardiogram transthoracic (TTE)', 'Dr. Test Cardiology', `TRANSTHORACIC ECHOCARDIOGRAM
Indication: MSSA bacteremia.
Findings:
Left ventricle normal in size with normal wall thickness. LVEF 55-60%. No regional wall motion abnormalities.
Aortic valve: trileaflet, calcified. Moderate aortic stenosis (mean gradient 24 mmHg). Mild aortic regurgitation.
Mitral valve: mildly thickened. Trace mitral regurgitation. No vegetation seen.
Tricuspid valve: mild tricuspid regurgitation. RVSP 34 mmHg.
Right ventricular size and systolic function are normal.
No pericardial effusion.

Conclusions:
1. Normal LV size and systolic function, EF 55-60%.
2. Moderate aortic stenosis with mild aortic regurgitation.
3. No vegetation seen. Image quality limited; TTE cannot exclude endocarditis - consider TEE if clinically indicated.

Electronically signed by Dr. Test Cardiology`]],
    efae: [[200, 'Echocardiogram transthoracic (TTE)', 'Dr. Test Cardiology', `TTE (outpatient, for murmur)
LVEF estimated at 50%. Mild mitral regurgitation. Sclerotic aortic valve without stenosis. No pericardial effusion.
Impression: Low-normal LV function. Mild MR. Aortic sclerosis.`]]
  };
  function echoReports(now, key) {
    const list = (ECHO_TEXT[key] || []).map(([ago, title, author, text]) => ({ t: now - ago * D, title, author, status: 'final', text }));
    return new Promise((res) => setTimeout(() => res(list), 200));
  }

  const ABXMock = { history, echoReports, CASES: CASES.map(({ key, label }) => ({ key, label })),
    make: (now, key) => { const c = CASES.find((x) => x.key === key) || CASES[0]; return Object.assign({ now, failed: [], medNames: {} }, c.make(now)); } };
  if (typeof module !== 'undefined' && module.exports) module.exports = ABXMock; else root.ABXMock = ABXMock;
})(typeof window !== 'undefined' ? window : globalThis);
