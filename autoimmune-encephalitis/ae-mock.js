/*
 * ae-mock.js — made-up test patients (FHIR R4) for the Autoimmune Encephalitis app. No real patient data.
 * Open index.html?demo=1 … ?demo=6
 *   1  23 F  anti-NMDAR pattern + right ovarian teratoma, on haloperidol with high CK, first line day 4
 *   2  67 M  anti-LGI1 pattern: faciobrachial dystonic seizures, Na 126, bilateral mesial temporal MRI change
 *   3  64 F  smoker, new refractory seizures + hilar mass (GABA-B / SCLC pattern), steroids day 15, no second line
 *   4  34 M  anti-Ma2 pattern: hypersomnia, amnesia, hippocampal + hypothalamic MRI change, testicular US not done
 *   5  29 F  post-HSV autoimmune encephalitis: HSV encephalitis 5 weeks ago, now choreoathetosis and agitation
 *   6  26 M  MIMIC: first-episode psychosis with a normal workup (should NOT meet criteria)
 */
(function (root) {
  'use strict';
  const HOUR = 3600e3, DAY = 24 * HOUR;

  function kit(now) {
    let id = 0;
    const iso = t => new Date(t).toISOString();
    const ago = d => iso(now - d * DAY);
    const lab = (name, value, unit, daysAgo, loinc) => ({ resourceType: 'Observation', id: 'o' + (++id), status: 'final',
      category: [{ coding: [{ code: 'laboratory' }] }], code: { text: name, coding: loinc ? [{ system: 'http://loinc.org', code: loinc }] : [] },
      effectiveDateTime: ago(daysAgo), valueQuantity: { value, unit } });
    const labS = (name, str, daysAgo) => ({ resourceType: 'Observation', id: 'o' + (++id), status: 'final',
      category: [{ coding: [{ code: 'laboratory' }] }], code: { text: name }, effectiveDateTime: ago(daysAgo), valueString: str });
    const vit = (loinc, name, value, unit, hoursAgo) => ({ resourceType: 'Observation', id: 'o' + (++id), status: 'final',
      category: [{ coding: [{ code: 'vital-signs' }] }], code: { text: name, coding: [{ system: 'http://loinc.org', code: loinc }] },
      effectiveDateTime: iso(now - hoursAgo * HOUR), valueQuantity: { value, unit } });
    const bp = (sbp, dbp, hoursAgo) => ({ resourceType: 'Observation', id: 'o' + (++id), status: 'final',
      category: [{ coding: [{ code: 'vital-signs' }] }], code: { text: 'Blood pressure', coding: [{ code: '85354-9' }] },
      effectiveDateTime: iso(now - hoursAgo * HOUR),
      component: [{ code: { coding: [{ code: '8480-6' }] }, valueQuantity: { value: sbp, unit: 'mmHg' } },
                  { code: { coding: [{ code: '8462-4' }] }, valueQuantity: { value: dbp, unit: 'mmHg' } }] });
    const vitals = (hr, sbp, temp) => {
      const out = [];
      hr.forEach((v, i) => out.push(vit('8867-4', 'Heart rate', v, '/min', 4 + i * 8)));
      sbp.forEach((v, i) => out.push(bp(v, Math.round(v * 0.6), 4 + i * 8)));
      temp.forEach((v, i) => out.push(vit('8310-5', 'Temperature', v, 'Cel', 4 + i * 8)));
      return out;
    };
    const med = (text, daysAgo, status) => ({ resourceType: 'MedicationRequest', id: 'm' + (++id), status: status || 'active', intent: 'order',
      medicationCodeableConcept: { text }, authoredOn: ago(daysAgo) });
    const cond = text => ({ resourceType: 'Condition', id: 'c' + (++id), code: { text }, clinicalStatus: { coding: [{ code: 'active' }] } });
    const note = (type, daysAgo, text) => ({ resourceType: 'DocumentReference', id: 'd' + (++id), status: 'current', type: { text: type },
      date: ago(daysAgo), content: [{ attachment: { contentType: 'text/plain', data: b64(text) } }] });
    const report = (name, daysAgo, text) => ({ resourceType: 'DiagnosticReport', id: 'r' + (++id), status: 'final', code: { text: name },
      effectiveDateTime: ago(daysAgo), conclusion: text });
    return { lab, labS, vitals, med, cond, note, report };
  }
  function b64(s) { try { return btoa(unescape(encodeURIComponent(s))); } catch (e) { return btoa(s); } }
  const pt = (id, gender, birthDate, family, given, phn) => ({ resourceType: 'Patient', id, gender, birthDate,
    name: [{ use: 'official', family, given: [given] }],
    identifier: [{ type: { text: 'PHN' }, value: phn }, { type: { text: 'MRN' }, value: '7' + phn.slice(-6) }] });
  const yrs = (now, y) => new Date(now - y * 365.25 * DAY - 40 * DAY).toISOString().slice(0, 10);

  const PATIENTS = {
    1: (now, k) => ({
      patient: pt('ae-mock-1', 'female', yrs(now, 23), 'Testcase', 'Amelia', '9000000011'),
      labs: [k.lab('CSF WBC', 38, '/uL', 5), k.lab('CSF Protein', 0.62, 'g/L', 5), k.lab('CSF Glucose', 3.4, 'mmol/L', 5),
        k.labS('CSF Oligoclonal bands', 'Positive', 4), k.labS('HSV 1/2 PCR CSF', 'Not detected', 4),
        k.lab('Sodium', 139, 'mmol/L', 1, '2951-2'), k.lab('Creatine kinase', 3100, 'U/L', 3), k.lab('TSH', 1.8, 'mU/L', 5)],
      vitals: k.vitals([52, 148, 96, 132, 61], [88, 168, 112, 155], [37.4, 38.6, 37.9]),
      conds: [k.cond('Psychosis, unspecified')],
      meds: [k.med('haloperidol 5 mg IM', 9), k.med('acyclovir 10 mg/kg IV q8h', 6), k.med('methylPREDNISolone 1 g IV daily', 4, 'completed'),
        k.med('immune globulin (IVIG) 0.4 g/kg IV daily', 2), k.med('lorazepam 1 mg IV q4h PRN', 3)],
      notes: [
        k.note('Admission Note', 7, 'HPI: 23 year old woman, no psychiatric history. Flu-like illness with headache 3 weeks ago, then insomnia, paranoia and auditory hallucinations over 10 days. Initially seen by psychiatry with first-episode psychosis and started on haloperidol. Over 48 h developed rigidity and CK rose; ? neuroleptic malignant syndrome. Now speech markedly reduced with periods of mutism.'),
        k.note('Progress Note', 2, 'Catatonic posturing, orofacial dyskinesias with lip-smacking and grimacing. Generalized tonic-clonic seizure overnight. Labile blood pressure and heart rate on telemetry. Ultrasound: right adnexal mass, likely teratoma — gyne aware.'),
      ],
      reports: [k.report('MRI Brain with and without contrast', 5, 'No acute intracranial abnormality. No abnormal enhancement.'),
        k.report('EEG', 3, 'Diffuse slowing with extreme delta brush pattern. No electrographic seizures captured.'),
        k.report('US Pelvis transvaginal', 2, '4.2 cm right ovarian lesion with echogenic fat and calcification, consistent with mature cystic teratoma (dermoid).')]
    }),
    2: (now, k) => ({
      patient: pt('ae-mock-2', 'male', yrs(now, 67), 'Testcase', 'Bernard', '9000000022'),
      labs: [k.lab('Sodium', 126, 'mmol/L', 1, '2951-2'), k.lab('Sodium', 128, 'mmol/L', 4, '2951-2'), k.lab('CSF WBC', 3, '/uL', 3),
        k.lab('CSF Protein', 0.48, 'g/L', 3), k.labS('HSV 1/2 PCR CSF', 'Not detected', 3), k.lab('TSH', 2.1, 'mU/L', 4), k.lab('Anti-TPO', 12, 'IU/mL', 4)],
      vitals: k.vitals([72, 78, 70, 75], [134, 128, 140], [36.8, 37.0]),
      conds: [k.cond('Hypertension'), k.cond('Hyponatremia')],
      meds: [k.med('levetiracetam 750 mg PO BID', 6), k.med('amlodipine 5 mg PO daily', 30)],
      notes: [k.note('Neurology Consult', 2, '67 year old man with 6 weeks of progressive short-term memory loss and disorientation. Wife describes many brief episodes a day where the left arm stiffens and the left face grimaces for 2-3 seconds — consistent with faciobrachial dystonic seizures (FBDS). Not improved on levetiracetam. Hyponatremia felt to be SIADH. Ex-smoker 10 pack-years, quit 1990.')],
      reports: [k.report('MRI Brain with and without contrast', 3, 'Bilateral mesial temporal FLAIR hyperintensity with mild hippocampal swelling, right greater than left. No enhancement or diffusion restriction.'),
        k.report('EEG', 2, 'Intermittent right temporal sharp waves and right temporal slowing.')]
    }),
    3: (now, k) => ({
      patient: pt('ae-mock-3', 'female', yrs(now, 64), 'Testcase', 'Carol', '9000000033'),
      labs: [k.lab('CSF WBC', 12, '/uL', 16), k.lab('CSF Protein', 0.71, 'g/L', 16), k.labS('HSV 1/2 PCR CSF', 'Not detected', 16), k.lab('Sodium', 136, 'mmol/L', 1, '2951-2')],
      vitals: k.vitals([88, 96, 92], [126, 132, 120], [37.1, 37.3]),
      conds: [k.cond('COPD'), k.cond('Lung mass')],
      meds: [k.med('methylPREDNISolone 1 g IV daily', 15, 'completed'), k.med('predniSONE 60 mg PO daily', 10), k.med('levetiracetam 1500 mg PO BID', 16),
        k.med('lacosamide 200 mg PO BID', 12), k.med('pantoprazole 40 mg PO daily', 15)],
      notes: [k.note('Progress Note', 1, '64 year old woman, current smoker 45 pack-years. Presented with new seizures progressing to status epilepticus, now confusion and short-term memory loss. Seizures still breaking through on two antiseizure medications. Minimal improvement since steroids. CT chest shows right hilar mass, bronchoscopy pending; small cell lung cancer suspected.')],
      reports: [k.report('MRI Brain with and without contrast', 15, 'Left mesial temporal T2/FLAIR hyperintensity involving the hippocampus and amygdala. No enhancement.'),
        k.report('CT Chest with contrast', 13, '3.4 cm right hilar mass with bulky mediastinal adenopathy, suspicious for small cell carcinoma.'),
        k.report('EEG', 14, 'Frequent left temporal epileptiform discharges; electrographic seizures arising from the left temporal region.')]
    }),
    4: (now, k) => ({
      patient: pt('ae-mock-4', 'male', yrs(now, 34), 'Testcase', 'Daniel', '9000000044'),
      labs: [k.lab('CSF WBC', 9, '/uL', 2), k.lab('CSF Protein', 0.55, 'g/L', 2), k.labS('HSV 1/2 PCR CSF', 'Not detected', 2), k.lab('Sodium', 141, 'mmol/L', 1, '2951-2')],
      vitals: k.vitals([66, 70, 64], [118, 122, 116], [36.7]),
      conds: [],
      meds: [k.med('acyclovir 10 mg/kg IV q8h', 2)],
      notes: [k.note('Admission Note', 2, '34 year old man with 2 months of excessive daytime sleepiness (hypersomnia), sleeping 16 h a day, and short-term memory loss. Vertical gaze limitation on exam. No fever. Testicular exam not documented.')],
      reports: [k.report('MRI Brain with and without contrast', 2, 'Bilateral hippocampal FLAIR hyperintensity with additional hypothalamic and upper brainstem T2 signal change. Faint enhancement.')]
    }),
    5: (now, k) => ({
      patient: pt('ae-mock-5', 'female', yrs(now, 29), 'Testcase', 'Elena', '9000000055'),
      labs: [k.lab('CSF WBC', 22, '/uL', 3), k.labS('HSV 1/2 PCR CSF', 'Not detected', 3), k.labS('HSV 1/2 PCR CSF', 'Detected', 38),
        k.lab('Sodium', 137, 'mmol/L', 1, '2951-2')],
      vitals: k.vitals([104, 112, 98], [128, 134, 126], [37.6, 37.2]),
      conds: [k.cond('Herpes simplex encephalitis')],
      meds: [k.med('acyclovir 10 mg/kg IV q8h', 38, 'completed'), k.med('quetiapine 25 mg PO BID', 3)],
      notes: [k.note('Progress Note', 1, 'Treated for HSV encephalitis 5 weeks ago, was improving at discharge. Re-presents with new agitation, insomnia and abnormal involuntary movements — choreoathetosis of arms and orofacial dyskinesias. Repeat HSV PCR negative. Concern for post-HSV autoimmune encephalitis (anti-NMDAR).')],
      reports: [k.report('MRI Brain with and without contrast', 3, 'Expected evolution of left temporal and insular encephalomalacia from prior HSV encephalitis. No new diffusion restriction.'),
        k.report('EEG', 2, 'Diffuse slowing, no epileptiform discharges.')]
    }),
    6: (now, k) => ({
      patient: pt('ae-mock-6', 'male', yrs(now, 26), 'Testcase', 'Felix', '9000000066'),
      labs: [k.lab('CSF WBC', 1, '/uL', 2), k.lab('CSF Protein', 0.32, 'g/L', 2), k.labS('HSV 1/2 PCR CSF', 'Not detected', 2),
        k.lab('Sodium', 140, 'mmol/L', 1, '2951-2'), k.lab('TSH', 1.4, 'mU/L', 3), k.labS('Urine drug screen', 'Positive for cannabinoids', 3)],
      vitals: k.vitals([78, 82, 76], [124, 120, 126], [36.6, 36.8]),
      conds: [k.cond('First episode psychosis'), k.cond('Cannabis use disorder')],
      meds: [k.med('risperidone 2 mg PO daily', 5)],
      notes: [k.note('Psychiatry Consult', 2, '26 year old man with 8 months of gradual social withdrawal, then paranoid delusions and auditory hallucinations. Daily cannabis. No seizures. No abnormal movements, no dyskinesias. No catatonia. Neurological exam normal. Tolerating risperidone without extrapyramidal side effects. Medicine asked to rule out organic cause.')],
      reports: [k.report('MRI Brain with and without contrast', 3, 'Normal MRI of the brain.'), k.report('EEG', 2, 'Normal awake and drowsy EEG.')]
    })
  };

  function client(n) {
    const now = Date.now(), k = kit(now), build = PATIENTS[n] || PATIENTS[1], d = build(now, k);
    // weight, height and hematocrit for the dose calculators
    const BODY = { 1: [58, 165, 0.36], 2: [82, 176, 0.41], 3: [66, 160, 0.37], 4: [74, 181, 0.44], 5: [61, 168, 0.38], 6: [79, 180, 0.45] }[n] || [70, 170, 0.4];
    d.vitals.push({ resourceType: 'Observation', id: 'wt', status: 'final', category: [{ coding: [{ code: 'vital-signs' }] }], code: { text: 'Body weight', coding: [{ code: '29463-7' }] }, effectiveDateTime: new Date(now - 2 * DAY).toISOString(), valueQuantity: { value: BODY[0], unit: 'kg' } },
      { resourceType: 'Observation', id: 'ht', status: 'final', category: [{ coding: [{ code: 'vital-signs' }] }], code: { text: 'Height', coding: [{ code: '8302-2' }] }, effectiveDateTime: new Date(now - 2 * DAY).toISOString(), valueQuantity: { value: BODY[1], unit: 'cm' } });
    d.labs.push(k.lab('Hematocrit', BODY[2], 'L/L', 2));
    const route = url => {
      const u = typeof url === 'string' ? url : url.url;
      if (u.startsWith('Observation')) return /laboratory/.test(u) ? d.labs : d.vitals;
      if (u.startsWith('Condition')) return d.conds;
      if (u.startsWith('MedicationRequest')) return d.meds;
      if (u.startsWith('DocumentReference')) return d.notes;
      if (u.startsWith('DiagnosticReport')) return d.reports;
      return [];
    };
    return { patient: { id: d.patient.id, read: () => Promise.resolve(d.patient) }, request: u => Promise.resolve(route(u)) };
  }
  root.AE_MOCK = { client, count: Object.keys(PATIENTS).length };
})(typeof window !== 'undefined' ? window : globalThis);
