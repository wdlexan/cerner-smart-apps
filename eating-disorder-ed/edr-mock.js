/*
 * edr-mock.js — made-up patients (FHIR R4 resources) for testing the Eating Disorder ED Review offline.
 *   1  29-year-old woman, frequent visits, stable today (amber potassium), care plan note on file
 *   2  24-year-old woman, red criteria today (bradycardia, low BP, low phosphate, rapid weight loss)
 *   3  34-year-old man, partly assessed (no labs or ECG yet), no care plan found
 *   4  admitted to IM 9 days ago; checks transfer to the hospitalist service
 *   5  admitted to IM 4 days ago with low phosphate; stays with IM
 * No real patient data.
 */
(function (root) {
  'use strict';
  const HOUR = 3600 * 1000, DAY = 24 * HOUR;

  function builder(now) {
    let id = 0;
    const iso = t => new Date(t).toISOString();
    const loinc = (code, display) => ({ coding: [{ system: 'http://loinc.org', code, display }], text: display });
    const obs = (cat, code, name, t, value, unit) => ({ resourceType: 'Observation', id: 'o' + (++id), status: 'final',
      category: [{ coding: [{ code: cat }] }], code: loinc(code, name), effectiveDateTime: iso(t), valueQuantity: { value, unit } });
    const V = {
      hr: (t, v) => obs('vital-signs', '8867-4', 'Heart rate', t, v, '/min'),
      bp: (t, s, d) => ({ resourceType: 'Observation', id: 'o' + (++id), status: 'final', category: [{ coding: [{ code: 'vital-signs' }] }],
        code: loinc('85354-9', 'Blood pressure panel'), effectiveDateTime: iso(t),
        component: [{ code: loinc('8480-6', 'Systolic blood pressure'), valueQuantity: { value: s, unit: 'mm[Hg]' } },
          { code: loinc('8462-4', 'Diastolic blood pressure'), valueQuantity: { value: d, unit: 'mm[Hg]' } }] }),
      temp: (t, v) => obs('vital-signs', '8310-5', 'Body temperature', t, v, 'Cel'),
      wt: (t, v) => obs('vital-signs', '29463-7', 'Body weight', t, v, 'kg'),
      ht: (t, v) => obs('vital-signs', '8302-2', 'Body height', t, v, 'cm'),
      k: (t, v) => obs('laboratory', '2823-3', 'Potassium', t, v, 'mmol/L'),
      na: (t, v) => obs('laboratory', '2951-2', 'Sodium', t, v, 'mmol/L'),
      po4: (t, v) => obs('laboratory', '2777-1', 'Phosphate', t, v, 'mmol/L'),
      mg: (t, v) => obs('laboratory', '19123-9', 'Magnesium', t, v, 'mmol/L'),
      glu: (t, v) => obs('laboratory', '2345-7', 'Glucose', t, v, 'mmol/L'),
      hgb: (t, v) => obs('laboratory', '718-7', 'Hemoglobin', t, v, 'g/L'),
      wbc: (t, v) => obs('laboratory', '6690-2', 'WBC', t, v, '10*9/L'),
      alb: (t, v) => obs('laboratory', '1751-7', 'Albumin', t, v, 'g/L'),
      alt: (t, v) => obs('laboratory', '1742-6', 'ALT', t, v, 'U/L'),
      qtc: (t, v) => obs('procedure', '8636-3', 'QTc interval', t, v, 'ms')
    };
    const enc = (cls, start, hours, opts) => Object.assign({ resourceType: 'Encounter', id: 'e' + (++id),
      status: opts && opts.open ? 'in-progress' : 'finished', class: { code: cls },
      period: Object.assign({ start: iso(start) }, opts && opts.open ? {} : { end: iso(start + hours * HOUR) }) },
      opts && opts.reason ? { reasonCode: [{ text: opts.reason }] } : {},
      opts && opts.disp ? { hospitalization: { dischargeDisposition: { text: opts.disp } } } : {});
    const cond = text => ({ resourceType: 'Condition', id: 'c' + (++id), code: { text }, clinicalStatus: { coding: [{ code: 'active' }] } });
    const med = text => ({ resourceType: 'MedicationRequest', id: 'm' + (++id), status: 'active', intent: 'order', medicationCodeableConcept: { text } });
    // A past ED visit: vitals + labs at arrival, a note.
    const visit = (out, daysAgo, v, note, admitDays) => {
      const t = now - daysAgo * DAY;
      out.encounters.push(enc('EMER', t, 8, { reason: v.reason, disp: admitDays ? 'Admitted' : 'Home' }));
      if (admitDays) out.encounters.push(enc('IMP', t + 7 * HOUR, admitDays * 24, { reason: v.reason }));
      out.observations.push(V.hr(t + HOUR, v.hr), V.bp(t + HOUR, v.sbp, v.dbp), V.temp(t + HOUR, v.temp));
      if (v.wt) out.observations.push(V.wt(t + HOUR, v.wt));
      if (v.k != null) out.observations.push(V.k(t + 2 * HOUR, v.k));
      if (v.po4 != null) out.observations.push(V.po4(t + 2 * HOUR, v.po4));
      if (v.glu != null) out.observations.push(V.glu(t + 2 * HOUR, v.glu));
      if (v.qtc != null) out.observations.push(V.qtc(t + HOUR, v.qtc));
      if (note) out.notes.push({ time: t + 3 * HOUR, title: 'ED Physician Note', text: note });
    };
    return { V, enc, cond, med, visit };
  }

  function patient1(now) {
    const b = builder(now), V = b.V;
    const out = { patient: { resourceType: 'Patient', id: 'edr-mock-1', gender: 'female', birthDate: '1997-03-09' },
      encounters: [], observations: [V.ht(now - 400 * DAY, 165)], notes: [],
      conditions: [b.cond('Anorexia nervosa, binge-eating/purging type'), b.cond('Generalized anxiety disorder')],
      medRequests: [b.med('sertraline 100 mg oral tablet'), b.med('multivitamin oral tablet')] };
    const past = [
      [540, { hr: 54, sbp: 100, dbp: 64, temp: 36.5, wt: 46.5, k: 3.4, po4: 0.98, glu: 4.8, reason: 'Dizziness' }, 'Presents with dizziness after vomiting. Tolerated oral intake. Discharged with eating disorder program follow-up.'],
      [470, { hr: 49, sbp: 95, dbp: 60, temp: 36.3, wt: 45.0, k: 2.7, po4: 0.74, glu: 4.1, qtc: 462, reason: 'Hypokalemia' }, 'Hypokalemia 2.7 after daily vomiting. Admitted for IV potassium and phosphate replacement. Refeeding syndrome precautions.', 4],
      [400, { hr: 56, sbp: 102, dbp: 66, temp: 36.6, wt: 46.0, k: 3.5, glu: 5.0, reason: 'Abdominal pain' }, 'Abdominal pain, benign exam. Seen by psychiatry in ED. Care plan reviewed.'],
      [330, { hr: 52, sbp: 98, dbp: 62, temp: 36.4, wt: 45.2, k: 3.3, po4: 0.92, glu: 4.6, reason: 'Weakness' }, 'Generalized weakness. Potassium replaced orally. Discharged per care plan.'],
      [260, { hr: 51, sbp: 97, dbp: 63, temp: 36.5, wt: 44.8, k: 3.2, glu: 4.4, reason: 'Palpitations' }, 'Palpitations, ECG sinus rhythm. Dietitian follow-up arranged.'],
      [200, { hr: 47, sbp: 92, dbp: 58, temp: 36.2, wt: 43.9, k: 3.0, po4: 0.85, glu: 4.0, qtc: 448, reason: 'Presyncope' }, 'Presyncope. Orthostatic. IV fluids, then admitted for monitoring.', 3],
      [130, { hr: 55, sbp: 101, dbp: 65, temp: 36.6, wt: 44.5, k: 3.6, glu: 4.9, reason: 'Anxiety' }, 'Anxiety, denies suicidal ideation. Discharged with mental health worker follow-up.'],
      [75, { hr: 53, sbp: 99, dbp: 61, temp: 36.4, wt: 44.2, k: 3.3, po4: 0.9, glu: 4.6, reason: 'Vomiting' }, 'Vomiting several times a week. Electrolytes replaced. Discharged with family doctor follow-up.'],
      [30, { hr: 52, sbp: 98, dbp: 62, temp: 36.5, wt: 44.0, k: 3.4, glu: 4.7, qtc: 440, reason: 'Chest discomfort' }, 'Atypical chest discomfort, ECG normal, troponin negative. Discharged per care plan.']
    ];
    past.forEach(p => b.visit(out, p[0], p[1], p[2], p[3]));
    // Care plan note
    out.notes.push({ time: now - 380 * DAY, title: 'Interdisciplinary Care Plan', text:
      'ED care plan for frequent presentations. Medical admission only if red MEED criteria are met. If medically stable: replace electrolytes in ED, ' +
      'contact the eating disorder program next business day, follow-up with family doctor within 1 week. Contact: ED program intake. Psychiatry consult only if suicidal ideation.' });
    // Today: ED visit in progress, started 4 h ago
    const t = now - 4 * HOUR;
    out.encounters.push(b.enc('EMER', t, 0, { open: true, reason: 'Weakness, vomiting' }));
    out.observations.push(V.hr(t + 0.5 * HOUR, 54), V.hr(t + 3 * HOUR, 52), V.bp(t + 0.5 * HOUR, 99, 63), V.bp(t + 3 * HOUR, 97, 62),
      V.temp(t + 0.5 * HOUR, 36.5), V.wt(t + 0.5 * HOUR, 43.8), V.k(t + HOUR, 3.2), V.na(t + HOUR, 137), V.po4(t + HOUR, 0.94),
      V.mg(t + HOUR, 0.78), V.glu(t + HOUR, 4.7), V.hgb(t + HOUR, 121), V.wbc(t + HOUR, 4.6), V.alb(t + HOUR, 38), V.alt(t + HOUR, 32),
      V.qtc(t + 0.75 * HOUR, 442));
    out.notes.push({ time: t + 2 * HOUR, title: 'ED Physician Note', text:
      'Known anorexia nervosa. Presents with weakness after vomiting 3-4 times this week. Denies suicidal ideation. Eating small meals. Drinking fluids. ' +
      'No syncope. ECG sinus rhythm, QTc 442.' });
    return out;
  }

  function patient2(now) {
    const b = builder(now), V = b.V;
    const out = { patient: { resourceType: 'Patient', id: 'edr-mock-2', gender: 'female', birthDate: '2002-07-21' },
      encounters: [], observations: [V.ht(now - 200 * DAY, 163)], notes: [],
      conditions: [b.cond('Anorexia nervosa, restricting type'), b.cond('Major depressive disorder')],
      medRequests: [b.med('fluoxetine 20 mg oral capsule')] };
    b.visit(out, 160, { hr: 48, sbp: 94, dbp: 60, temp: 36.2, wt: 41.5, k: 3.6, po4: 0.9, glu: 4.2, reason: 'Fatigue' }, 'Fatigue. Discharged with eating disorder program referral.');
    b.visit(out, 90, { hr: 45, sbp: 90, dbp: 58, temp: 36.0, wt: 40.2, k: 3.4, po4: 0.82, glu: 3.9, reason: 'Dizziness' }, 'Dizziness. Declined admission. Psychiatry saw patient.');
    out.observations.push(V.wt(now - 14 * DAY, 39.0));   // clinic weight two weeks ago
    out.notes.push({ time: now - 14 * DAY, title: 'Eating Disorder Program Clinic Note', text: 'Weight 39.0 kg, down from 40.2. Restricting to one small meal a day. Plan reviewed.' });
    const t = now - 3 * HOUR;
    out.encounters.push(b.enc('EMER', t, 0, { open: true, reason: 'Syncope' }));
    out.observations.push(V.hr(t + 0.3 * HOUR, 41), V.hr(t + 2 * HOUR, 38), V.bp(t + 0.3 * HOUR, 86, 54), V.bp(t + 2 * HOUR, 84, 52),
      V.temp(t + 0.3 * HOUR, 35.7), V.wt(t + 0.3 * HOUR, 36.0), V.k(t + HOUR, 2.8), V.na(t + HOUR, 133), V.po4(t + HOUR, 0.62),
      V.mg(t + HOUR, 0.66), V.glu(t + HOUR, 3.1), V.hgb(t + HOUR, 104), V.wbc(t + HOUR, 2.9), V.alb(t + HOUR, 33), V.alt(t + HOUR, 145),
      V.qtc(t + 0.5 * HOUR, 476));
    out.notes.push({ time: t + 1.5 * HOUR, title: 'ED Physician Note', text:
      'Syncope at home, collapsed in kitchen. Refusing to eat for 4 days, drinking small amounts. Passive suicidal thoughts. Bradycardic to 38.' });
    return out;
  }

  function patient3(now) {
    const b = builder(now), V = b.V;
    const out = { patient: { resourceType: 'Patient', id: 'edr-mock-3', gender: 'male', birthDate: '1992-01-15' },
      encounters: [], observations: [V.ht(now - 300 * DAY, 178)], notes: [],
      conditions: [b.cond('Bulimia nervosa'), b.cond('Type 1 diabetes mellitus')],
      medRequests: [b.med('insulin glargine 100 unit/mL injection'), b.med('insulin lispro 100 unit/mL injection')] };
    b.visit(out, 300, { hr: 72, sbp: 118, dbp: 74, temp: 36.7, wt: 63, k: 3.3, glu: 14.2, reason: 'Hyperglycemia' }, 'Hyperglycemia with insulin omission. Discharged.');
    b.visit(out, 180, { hr: 88, sbp: 104, dbp: 66, temp: 36.8, wt: 61, k: 3.1, po4: 0.8, glu: 22.5, reason: 'DKA' }, 'Mild DKA after insulin restriction. Admitted to medicine.', 3);
    b.visit(out, 60, { hr: 70, sbp: 116, dbp: 72, temp: 36.6, wt: 62, k: 3.5, glu: 11.0, reason: 'Vomiting' }, 'Vomiting after binge. Tolerating fluids. Discharged with GP follow-up.');
    const t = now - 1.5 * HOUR;
    out.encounters.push(b.enc('EMER', t, 0, { open: true, reason: 'Vomiting' }));
    out.observations.push(V.hr(t + 0.3 * HOUR, 76), V.bp(t + 0.3 * HOUR, 112, 70), V.temp(t + 0.3 * HOUR, 36.7));
    out.notes.push({ time: t + HOUR, title: 'Triage Note', text: 'Vomiting since last night. Labs drawn, pending.' });
    return out;
  }


  // Admitted to IM for supervised feeding; checks whether transfer to the hospitalist service fits.
  function admitted(now, stay) {
    const b = builder(now), V = b.V;
    const out = { patient: { resourceType: 'Patient', id: stay ? 'edr-mock-5' : 'edr-mock-4', gender: 'female', birthDate: stay ? '1999-11-02' : '1994-05-30' },
      encounters: [], observations: [V.ht(now - 300 * DAY, 160)], notes: [],
      conditions: [b.cond('Anorexia nervosa, restricting type')], medRequests: [b.med('thiamine 100 mg oral tablet'), b.med('potassium phosphate oral')] };
    b.visit(out, 120, { hr: 50, sbp: 96, dbp: 60, temp: 36.3, wt: 37.5, k: 3.4, po4: 0.85, glu: 4.3, reason: 'Weakness' }, 'Weakness. Discharged per care plan.');
    const adm = now - (stay ? 4 : 9) * DAY;
    out.encounters.push(b.enc('EMER', adm, 6, { reason: 'Bradycardia, food refusal', disp: 'Admitted' }));
    out.encounters.push(b.enc('IMP', adm + 6 * HOUR, 0, { open: true, reason: 'Anorexia nervosa, supervised feeding' }));
    const days = stay ? 4 : 9;
    for (let d = days; d >= 0; d--) {
      const t = now - d * DAY + 2 * HOUR - (d === 0 ? 4 * HOUR : 0);
      out.observations.push(V.hr(t, d > 6 ? 38 + (days - d) : 44 + (days - d) % 4), V.bp(t, 92 + (days - d), 58), V.temp(t, 36.2));
      if (d % 1 === 0) out.observations.push(V.k(t, d === 5 ? 2.9 : 3.5), V.po4(t, d === 8 ? 0.35 : (stay && d === 2 ? 0.38 : 0.82)), V.na(t, 136),
        obsCO2(V, t), V.glu(t, d === 3 ? 3.7 : 4.8));
      if (d % 3 === 0) out.observations.push(V.wt(t, 34.0 + (days - d) * 0.15));
    }
    out.observations.push(V.qtc(now - 2 * DAY, 446));
    out.notes.push({ time: adm + 3 * HOUR, title: 'Internal Medicine Admission Note', text: 'Admitted to GIM for supervised feeding. HR 38, food refusal 6 days. Refeeding protocol started with dietitian. Psychiatry liaison consulted.' });
    if (!stay) out.notes.push({ time: now - 3 * DAY + 4 * HOUR, title: 'Internal Medicine Progress Note', text: 'Glucose 3.7 one hour after lunch, postprandial, asymptomatic, resolved. Phosphate replaced earlier in admission, now stable. Tolerating full meal plan.' });
    else out.notes.push({ time: now - 2 * DAY + 4 * HOUR, title: 'Internal Medicine Progress Note', text: 'Phosphate 0.38 on day 2 of feeding, IV phosphate given. Continue refeeding precautions. Dizzy on standing.' });
    return out;
  }
  function obsCO2(V, t) { const o = V.k(t, 28); o.code = { coding: [{ system: 'http://loinc.org', code: '1963-8', display: 'Bicarbonate' }], text: 'Bicarbonate' }; return o; }

  function makeMockResources(now, which) {
    now = now || Date.now();
    const f = { 1: patient1, 2: patient2, 3: patient3, 4: n => admitted(n, false), 5: n => admitted(n, true) }[which || 1] || patient1;
    return Object.assign({ failed: [], reasons: {}, pending: [] }, f(now));
  }
  const PATIENTS = { 1: 'Demo 1 · 29 F · frequent visits, stable today', 2: 'Demo 2 · 24 F · red criteria today', 3: 'Demo 3 · 34 M · partly assessed', 4: 'Demo 4 · admitted day 9 · transfer check', 5: 'Demo 5 · admitted day 4 · stays with IM' };

  root.EDRMock = { makeMockResources, PATIENTS };
  if (typeof module === 'object' && module.exports) module.exports = { makeMockResources, PATIENTS };
})(typeof self !== 'undefined' ? self : this);
