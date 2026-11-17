/* Autoimmune / Limbic Encephalitis – SMART on FHIR app (Cerner R4)
   Pulls the chart, flags features, applies Graus 2016 criteria, suggests antibody/tumour
   workup and treatment steps, and fills the MitogenDx requisition. */
'use strict';

const CFG = window.AE_CONFIG || {};
const S = {
  client: null, manual: false, pid: null,
  patient: null, labs: [], vitals: [], conds: [], meds: [], docs: [], reports: [], texts: [],
  auto: {},        // key -> {on:bool, ev:[...]}
  user: {},        // key -> true/false (user override)
  loadErrors: []
};
const $ = s => document.querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const DAY = 86400000;

/* ---------------- storage (per browser, best effort) ---------------- */
const store = {
  get(k, d) { try { const v = localStorage.getItem('ae.' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('ae.' + k, JSON.stringify(v)); } catch (e) { /* ignore */ } }
};

/* ---------------- findings definitions ---------------- */
// type: clinical | investigation | context. manual-only items have no chart detection.
const FINDINGS = [
  { key: 'onset3mo', label: 'Subacute onset (< 3 months)', type: 'core', manualOnly: true },
  { key: 'altExcluded', label: 'Reasonable exclusion of alternative causes (infection, metabolic, toxic, structural, primary psychiatric)', type: 'core', manualOnly: true },

  { key: 'memory', label: 'Working / short-term memory deficit, confusion', type: 'clinical',
    re: /\b(short[- ]term memory|memory (loss|impair|deficit|difficult)|amnesi|anterograde|disorient|confus(ed|ion))/i },
  { key: 'psych', label: 'Psychiatric: psychosis, hallucinations, paranoia, agitation, behaviour change', type: 'clinical',
    re: /\b(psychos[ie]s|psychotic|hallucinat|paranoi|delusion|agitat|bizarre behavio|manic|mania\b|personality change|disorganized)/i },
  { key: 'seizure', label: 'New seizures / status epilepticus', type: 'clinical',
    re: /\b(seizure|status epilepticus|convuls|tonic[- ]clonic|focal impaired awareness)/i },
  { key: 'fbds', label: 'Faciobrachial dystonic seizures (brief arm + face jerks)', type: 'clinical',
    re: /\b(faciobrachial|FBDS)\b/i },
  { key: 'speech', label: 'Speech dysfunction: reduced speech, mutism, echolalia', type: 'clinical',
    re: /\b(mutism|mute\b|echolalia|reduced speech|decreased speech|poverty of speech|perseverat)/i },
  { key: 'movement', label: 'Dyskinesias, orofacial movements, choreoathetosis, dystonia, rigidity', type: 'clinical',
    re: /\b(dyskinesi|orofacial|choreo|athetos|dystoni|lip[- ]smacking|grimac)/i },
  { key: 'catatonia', label: 'Catatonia', type: 'clinical', re: /\b(catatoni|waxy flexib|posturing|bush[- ]francis)/i },
  { key: 'consciousness', label: 'Decreased level of consciousness', type: 'clinical',
    re: /\b(decreased (level of )?consciousness|obtunded|stupor|unresponsive|reduced LOC|decreased LOC)/i },
  { key: 'autonomic', label: 'Autonomic instability (labile HR/BP, hyperthermia, arrhythmia)', type: 'clinical',
    re: /\b(dysautonomi|autonomic instab|labile (blood pressure|BP|heart rate)|asystole)/i },
  { key: 'hypovent', label: 'Central hypoventilation', type: 'clinical', re: /\b(hypoventilat)/i },
  { key: 'focalNeuro', label: 'New focal neurological signs', type: 'clinical',
    re: /\b(hemiparesis|focal (neuro|deficit|weakness)|aphasi|ataxi|nystagmus|ophthalmopleg)/i },
  { key: 'prodrome', label: 'Viral-type prodrome (fever, headache)', type: 'clinical', re: /\b(flu[- ]like|viral (illness|prodrome)|prodrom)/i },
  { key: 'sleep', label: 'Sleep disturbance (insomnia / hypersomnia)', type: 'clinical', re: /\b(insomnia|hypersomni|sleep disturb)/i },
  { key: 'nmsReaction', label: 'Severe reaction to antipsychotics (NMS-like, rigidity, high CK)', type: 'clinical',
    re: /\b(neuroleptic malignant|NMS\b|extrapyramidal|EPS\b)/i },
  { key: 'neuromyotonia', label: 'Neuromyotonia / neuropathic pain (CASPR2)', type: 'clinical', re: /\b(neuromyotoni|myokymi|morvan)/i },
  { key: 'gi', label: 'Diarrhoea / weight loss preceding encephalopathy (DPPX)', type: 'clinical', re: /\b(chronic diarrh|weight loss)/i },

  { key: 'csfPleo', label: 'CSF pleocytosis (> 5 WBC/µL)', type: 'investigation' },
  { key: 'csfOCB', label: 'CSF oligoclonal bands / raised IgG index', type: 'investigation' },
  { key: 'mriLimbic', label: 'MRI: mesial temporal T2/FLAIR change', type: 'investigation',
    re: /\b(mesial temporal|medial temporal|hippocamp\w*|amygdal\w*|limbic)\b[^.]{0,80}\b(hyperintens|FLAIR|T2|signal|swell|enhanc|edema|oedema)/i },
  { key: 'mriBilat', label: 'MRI: BILATERAL mesial temporal involvement', type: 'investigation',
    re: /\bbilateral\b[^.]{0,60}\b(mesial temporal|medial temporal|hippocamp|amygdal)/i },
  { key: 'mriOther', label: 'MRI: other change suggestive of encephalitis (cortical/subcortical FLAIR, demyelinating-type)', type: 'investigation',
    re: /\b(cortical|subcortical|multifocal)\b[^.]{0,60}\b(FLAIR|T2) (hyperintens|signal)/i },
  { key: 'eegTemporal', label: 'EEG: temporal epileptiform activity or slowing', type: 'investigation',
    re: /\btemporal\b[^.]{0,40}\b(sharp|spike|epileptiform|slowing|discharge)/i },
  { key: 'eegAbnormal', label: 'EEG abnormal (focal/diffuse slowing, epileptiform)', type: 'investigation',
    re: /\b(EEG|electroenceph\w*)\b[\s\S]{0,160}?\b(slowing|epileptiform|seizure|abnormal|encephalopath)/i },
  { key: 'deltaBrush', label: 'EEG: extreme delta brush', type: 'investigation', re: /\bdelta brush/i },
  { key: 'hypoNa', label: 'Hyponatraemia (Na < 135)', type: 'investigation' },

  { key: 'teratoma', label: 'Ovarian teratoma / dermoid / adnexal mass', type: 'context', re: /\b(teratoma|dermoid|adnexal mass|ovarian mass)/i },
  { key: 'postHSV', label: 'HSV encephalitis in past 2–8 weeks', type: 'context', re: /\b(HSV|herpes simplex) encephalitis/i },
  { key: 'checkpoint', label: 'Immune checkpoint inhibitor exposure', type: 'context' },
  { key: 'cancer', label: 'Known/suspected cancer (SCLC, thymoma, lymphoma, breast, testicular)', type: 'context',
    re: /\b(small cell|SCLC|thymoma|hodgkin|lymphoma|testicular (cancer|tumou?r|germ)|seminoma|breast cancer)/i },
  { key: 'smoker', label: 'Smoker / heavy smoking history', type: 'context', re: /\b(smoker|pack[- ]years?|smokes \d|current smoking)/i },
  { key: 'psychDx', label: 'Labelled as primary psychiatric (schizophrenia / first-episode psychosis)', type: 'context',
    re: /\b(schizophreni|first[- ]episode psychosis|FEP\b|schizoaffective|brief psychotic)/i }
];
const FMAP = Object.fromEntries(FINDINGS.map(f => [f.key, f]));
const on = k => (k in S.user ? S.user[k] : !!(S.auto[k] && S.auto[k].on));

/* ---------------- helpers ---------------- */
function ccText(cc) {
  if (!cc) return '';
  if (cc.text) return cc.text;
  const c = (cc.coding || []).find(x => x.display) || (cc.coding || [])[0];
  return c ? (c.display || c.code || '') : '';
}
function codes(cc) { return ((cc && cc.coding) || []).map(c => c.code); }
function fmtDate(d) { if (!d) return ''; const x = new Date(d); return isNaN(x) ? d : x.toLocaleDateString('en-CA'); }
function ageFrom(dob) { if (!dob) return null; const b = new Date(dob), n = new Date(); let a = n.getFullYear() - b.getFullYear(); if (n < new Date(n.getFullYear(), b.getMonth(), b.getDate())) a--; return a; }
function obsDate(o) { return o.effectiveDateTime || (o.effectivePeriod && o.effectivePeriod.start) || o.issued || ''; }
function obsVal(o) {
  if (o.valueQuantity) return { num: o.valueQuantity.value, str: o.valueQuantity.value + ' ' + (o.valueQuantity.unit || '') };
  if (o.valueString) return { num: parseFloat(o.valueString), str: o.valueString };
  if (o.valueCodeableConcept) return { num: NaN, str: ccText(o.valueCodeableConcept) };
  const interp = o.interpretation && o.interpretation[0] ? ccText(o.interpretation[0]) : '';
  return { num: NaN, str: interp };
}
function stripHtml(h) {
  return String(h || '').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|tr|li|h\d)>/gi, '\n').replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/[ \t]+/g, ' ');
}
function b64(s) { try { return decodeURIComponent(escape(atob(s))); } catch (e) { try { return atob(s); } catch (e2) { return ''; } } }
function labsMatching(re, extra) {
  return S.labs.filter(o => { const n = ccText(o.code); return re.test(n) && (!extra || extra(o, n)); })
    .sort((a, b) => new Date(obsDate(b)) - new Date(obsDate(a)));
}
function medName(m) { return ccText(m.medicationCodeableConcept) || (m.medicationReference && m.medicationReference.display) || ''; }
function medsMatching(re) { return S.meds.filter(m => re.test(medName(m))); }
function activeMed(m) { return !m.status || ['active', 'on-hold', 'draft'].includes(m.status); }

const NEG = /\b(no|not|denies|denied|negative for|without|absence of|free of|resolved)\b[^.\n]{0,30}$/i;
function scanText(re) {
  const ev = [];
  for (const t of S.texts) {
    const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
    let m;
    while ((m = g.exec(t.text)) && ev.length < 4) {
      const before = t.text.slice(Math.max(0, m.index - 40), m.index);
      if (NEG.test(before)) continue;
      const snip = t.text.slice(Math.max(0, m.index - 70), Math.min(t.text.length, m.index + m[0].length + 70)).replace(/\s+/g, ' ');
      ev.push(`${t.source}${t.date ? ' (' + fmtDate(t.date) + ')' : ''}: …${snip}…`);
      break; // one hit per document
    }
    if (ev.length >= 4) break;
  }
  return ev;
}

/* ---------------- FHIR loading ---------------- */
async function req(url, pages) {
  try { return await S.client.request(url, { pageLimit: pages || 1, flat: true }); }
  catch (e) { S.loadErrors.push(url.split('?')[0] + ': ' + (e.message || e)); return []; }
}
async function attText(att) {
  if (!att) return '';
  if (att.data) return stripHtml(b64(att.data));
  if (!att.url) return '';
  const tries = [att.contentType || 'text/plain', 'text/html', 'application/fhir+json'];
  for (const accept of tries) {
    try {
      const r = await S.client.request({ url: att.url, headers: { Accept: accept } });
      if (typeof r === 'string') return stripHtml(r);
      if (r && r.data) return stripHtml(b64(r.data));
    } catch (e) { /* try next */ }
  }
  return '';
}
async function loadChart() {
  const pid = S.pid;
  const since7 = new Date(Date.now() - 7 * DAY).toISOString().slice(0, 10);
  const [pt, labs, vit, conds, meds, docs, reps] = await Promise.all([
    S.client.patient.read().catch(e => { S.loadErrors.push('Patient: ' + e.message); return null; }),
    req(`Observation?patient=${pid}&category=laboratory&_count=100`, 4),
    req(`Observation?patient=${pid}&category=vital-signs&date=ge${since7}&_count=100`, 3),
    req(`Condition?patient=${pid}&_count=100`, 2),
    req(`MedicationRequest?patient=${pid}&_count=100`, 3),
    req(`DocumentReference?patient=${pid}&_count=${CFG.maxNotes || 20}`, 1),
    req(`DiagnosticReport?patient=${pid}&_count=60`, 1)
  ]);
  S.patient = pt; S.labs = labs.filter(r => r.resourceType === 'Observation');
  S.vitals = vit.filter(r => r.resourceType === 'Observation');
  S.conds = conds.filter(r => r.resourceType === 'Condition');
  S.meds = meds.filter(r => r.resourceType === 'MedicationRequest');
  S.docs = docs.filter(r => r.resourceType === 'DocumentReference')
    .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0)).slice(0, CFG.maxNotes || 20);
  S.reports = reps.filter(r => r.resourceType === 'DiagnosticReport');

  setStatus(`Reading ${S.docs.length} notes and ${S.reports.length} reports…`);
  const texts = [];
  await Promise.all(S.docs.map(async d => {
    const att = d.content && d.content[0] && d.content[0].attachment;
    const t = await attText(att);
    if (t) texts.push({ source: ccText(d.type) || d.description || 'Note', date: d.date, text: t });
  }));
  await Promise.all(S.reports.map(async r => {
    let t = [ccText(r.code), r.conclusion || ''].join('. ');
    if (r.presentedForm && r.presentedForm[0] && /mri|mr |eeg|ct |ultras|pet|pelvi|brain|head/i.test(ccText(r.code))) {
      t += '\n' + await attText(r.presentedForm[0]);
    }
    texts.push({ source: ccText(r.code) || 'Report', date: r.effectiveDateTime || r.issued, text: t, report: true });
  }));
  S.conds.forEach(c => texts.push({ source: 'Problem list', date: c.recordedDate || c.onsetDateTime, text: ccText(c.code) }));
  S.texts = texts;
}

/* ---------------- detection ---------------- */
function detect() {
  const A = {};
  const set = (k, ev) => { A[k] = { on: ev.length > 0, ev }; };

  FINDINGS.forEach(f => { if (f.re) set(f.key, scanText(f.re)); });

  // CSF labs
  const csfWbc = labsMatching(/(csf|cerebrospinal|spinal fluid)/i, (o, n) => /(wbc|leuk|white|nucleated)/i.test(n));
  const pleo = csfWbc.filter(o => obsVal(o).num > 5);
  set('csfPleo', pleo.slice(0, 3).map(o => `${ccText(o.code)} ${obsVal(o).str} (${fmtDate(obsDate(o))})`));
  if (!pleo.length && csfWbc.length) A.csfPleo.note = `Latest CSF WBC ${obsVal(csfWbc[0]).str} – not pleocytic`;
  // Imported PDFs / free text: "CSF cell count 38 /uL", "CSF WBC 12"
  if (!pleo.length) {
    const tx = [];
    S.texts.forEach(t => { const re = /\bCSF\b[^.\n]{0,40}?\b(cell count|wbc|white cells?|nucleated cells?|leukocytes?)\b[^\d\n]{0,15}(\d+(?:\.\d+)?)/ig; let m;
      while ((m = re.exec(t.text))) { if (parseFloat(m[2]) > 5 && tx.length < 3) tx.push(`${t.source}: …${m[0].replace(/\s+/g, ' ')}…`); } });
    if (tx.length) A.csfPleo = { on: true, ev: tx };
  }
  const ocb = labsMatching(/(oligoclonal|igg index)/i).filter(o => /positive|present|detected|elevated|high|\bH\b/i.test(obsVal(o).str + ' ' + (o.interpretation ? ccText(o.interpretation[0]) : '')));
  set('csfOCB', ocb.slice(0, 2).map(o => `${ccText(o.code)}: ${obsVal(o).str}`));
  if (!A.csfOCB.on) { const e = scanText(/oligoclonal bands?[^.\n]{0,25}\b(positive|present|detected)/i); if (e.length) A.csfOCB = { on: true, ev: e }; }

  // Sodium
  const na = labsMatching(/^(sodium|na\b)|sodium.*(serum|plasma|blood)/i, (o, n) => !/urine|ur\b/i.test(n));
  const low = na.filter(o => obsVal(o).num < 135 && Date.now() - new Date(obsDate(o)) < 30 * DAY);
  set('hypoNa', low.length ? [`Lowest Na in 30 d: ${Math.min(...low.map(o => obsVal(o).num))} (${low.length} low results)`] : []);

  // Vitals: autonomic instability over 72 h
  const v72 = S.vitals.filter(o => Date.now() - new Date(obsDate(o)) < 3 * DAY);
  const pick = (loinc, re) => {
    const out = [];
    v72.forEach(o => {
      if (codes(o.code).includes(loinc) || re.test(ccText(o.code))) { const n = obsVal(o).num; if (!isNaN(n)) out.push(n); }
      (o.component || []).forEach(c => { if (codes(c.code).includes(loinc) && c.valueQuantity) out.push(c.valueQuantity.value); });
    });
    return out;
  };
  const hr = pick('8867-4', /heart rate|pulse/i), sbp = pick('8480-6', /systolic/i), tmp = pick('8310-5', /temp/i);
  const vev = [];
  if (hr.length > 2 && (Math.max(...hr) - Math.min(...hr) >= 60 || Math.min(...hr) <= 45)) vev.push(`HR range 72 h: ${Math.min(...hr)}–${Math.max(...hr)}`);
  if (sbp.length > 2 && Math.max(...sbp) - Math.min(...sbp) >= 60) vev.push(`SBP range 72 h: ${Math.min(...sbp)}–${Math.max(...sbp)}`);
  if (tmp.length && Math.max(...tmp) >= 38.5 && Math.max(...tmp) < 50) vev.push(`Tmax 72 h: ${Math.max(...tmp)}`);
  if (vev.length) { A.autonomic = A.autonomic || { on: false, ev: [] }; A.autonomic.ev = vev.concat(A.autonomic.ev); A.autonomic.on = true; }
  S.vitalSummary = { hr, sbp, tmp };

  // Checkpoint inhibitors (meds) and conditions
  const ici = medsMatching(/(pembrolizumab|nivolumab|ipilimumab|atezolizumab|durvalumab|avelumab|cemiplimab|tremelimumab|dostarlimab)/i);
  set('checkpoint', ici.slice(0, 3).map(m => `${medName(m)} (${fmtDate(m.authoredOn)})`));

  // CK for NMS-like reactions
  const ck = labsMatching(/(creatine kinase|^ck\b|\bcpk\b)/i).filter(o => obsVal(o).num > 1000);
  if (ck.length) { A.nmsReaction = A.nmsReaction || { on: false, ev: [] }; A.nmsReaction.ev.unshift(`CK ${obsVal(ck[0]).str} (${fmtDate(obsDate(ck[0]))})`); }

  S.auto = A;
}

/* ---------------- demographics ---------------- */
function demo() {
  const p = S.patient || {};
  const nm = (p.name || []).find(n => n.use === 'official') || (p.name || [])[0] || {};
  const surname = nm.family || '', first = (nm.given || []).join(' ');
  const age = ageFrom(p.birthDate);
  const sex = (p.gender || '').toLowerCase();
  const ids = p.identifier || [];
  const phnId = ids.find(i => /phn|personal health|health card|provincial/i.test(ccText(i.type) + ' ' + (i.system || '')));
  const mrnId = ids.find(i => /mrn|medical record/i.test(ccText(i.type)));
  return { surname, first, age, sex, dob: p.birthDate || '', phn: phnId ? phnId.value : '', mrn: mrnId ? mrnId.value : '' };
}

/* ---------------- criteria ---------------- */
function criteria() {
  const o = on;
  const groups = [
    ['Abnormal behaviour or cognition', o('psych') || o('memory')],
    ['Speech dysfunction', o('speech')],
    ['Seizures', o('seizure') || o('fbds')],
    ['Movement disorder, dyskinesias, rigidity/abnormal postures', o('movement') || o('catatonia')],
    ['Decreased level of consciousness', o('consciousness')],
    ['Autonomic dysfunction or central hypoventilation', o('autonomic') || o('hypovent')]
  ];
  const nGroups = groups.filter(g => g[1]).length;
  const nmdarLab = o('eegAbnormal') || o('eegTemporal') || o('deltaBrush') || o('csfPleo') || o('csfOCB');

  return [
    { name: 'Possible autoimmune encephalitis (Graus 2016)', items: [
      ['Subacute onset < 3 months', o('onset3mo'), 'onset3mo'],
      ['Working memory deficit, altered mental status, or psychiatric symptoms', o('memory') || o('psych') || o('consciousness')],
      ['≥ 1 of: new focal CNS findings, new seizures, CSF pleocytosis, MRI suggestive of encephalitis',
        o('focalNeuro') || o('seizure') || o('fbds') || o('csfPleo') || o('mriLimbic') || o('mriOther')],
      ['Alternative causes reasonably excluded', o('altExcluded'), 'altExcluded']
    ] },
    { name: 'Definite autoimmune limbic encephalitis (Graus 2016)', note: 'If one of the first three items is missing, a positive neural antibody is needed.', items: [
      ['Subacute (< 3 mo) memory deficits, seizures or psychiatric symptoms (limbic)', o('onset3mo') && (o('memory') || o('seizure') || o('fbds') || o('psych'))],
      ['Bilateral mesial temporal T2/FLAIR abnormality on MRI', o('mriBilat')],
      ['CSF pleocytosis OR EEG temporal epileptic/slow activity', o('csfPleo') || o('eegTemporal')],
      ['Alternative causes reasonably excluded', o('altExcluded'), 'altExcluded']
    ] },
    { name: 'Probable anti-NMDAR encephalitis (Graus 2016)', groups, nGroups, items: [
      ['Rapid onset < 3 months', o('onset3mo'), 'onset3mo'],
      [`≥ 4 of 6 symptom groups (currently ${nGroups}) — or 3 groups + teratoma`, nGroups >= 4 || (nGroups >= 3 && o('teratoma'))],
      ['Abnormal EEG or CSF pleocytosis/OCB (not needed if 3 groups + teratoma)', nmdarLab || (nGroups >= 3 && o('teratoma'))],
      ['Alternative causes reasonably excluded', o('altExcluded'), 'altExcluded']
    ] }
  ].map(c => Object.assign(c, { met: c.items.every(i => i[1]) }));
}

/* ---------------- phenotype → antibody & tumour ---------------- */
function phenotypes() {
  const d = demo(), a = d.age, f = d.sex === 'female', m = d.sex === 'male', o = on, out = [];
  if ((f && a != null && a >= 12 && a <= 45) || o('postHSV') || o('teratoma') || (o('psych') && (o('movement') || o('catatonia') || o('autonomic') || o('speech')))) {
    out.push({ ab: 'Anti-NMDAR', why: [f && a <= 45 ? 'female of reproductive age' : '', o('postHSV') ? 'post-HSV encephalitis' : '', o('teratoma') ? 'teratoma/adnexal mass' : '', o('psych') ? 'psychiatric onset' : '', o('movement') ? 'dyskinesias' : '', o('catatonia') ? 'catatonia' : '', o('autonomic') ? 'dysautonomia' : ''].filter(Boolean),
      tumour: f ? 'MRI pelvis + transvaginal ultrasound for ovarian teratoma; if negative, repeat periodically (e.g. q6 months for ~2 y).' : 'Teratoma rare in males/children; consider testicular US if male, CT CAP if older.',
      test: 'CSF is the key sample (serum misses ~15%).' });
  }
  if (o('fbds') || o('hypoNa') || (a >= 50 && o('memory') && o('seizure'))) {
    out.push({ ab: 'Anti-LGI1', why: [o('fbds') ? 'faciobrachial dystonic seizures' : '', o('hypoNa') ? 'hyponatraemia' : '', a >= 50 ? 'age ≥ 50' : ''].filter(Boolean),
      tumour: 'Tumour uncommon (< 10%); CT chest for thymoma reasonable.', test: 'SERUM is often more sensitive than CSF. FBDS respond to steroids better than to ASMs.' });
  }
  if (o('neuromyotonia') || (o('sleep') && m && a >= 50)) {
    out.push({ ab: 'Anti-CASPR2', why: ['neuromyotonia / insomnia / pain'], tumour: 'CT chest for thymoma (especially Morvan syndrome).', test: 'Serum.' });
  }
  if ((o('smoker') || o('cancer')) && a >= 45) {
    out.push({ ab: 'Anti-GABA-B, anti-Hu, SOX1, AMPAR', why: ['older smoker / cancer history', o('seizure') ? 'seizures (GABA-B: early refractory seizures)' : ''].filter(Boolean),
      tumour: 'CT chest/abdomen/pelvis for SCLC; if negative, whole-body FDG-PET.', test: 'Paraneoplastic PLUS panel + encephalitis panel.' });
  }
  if (m && a != null && a < 50 && (o('sleep') || o('memory'))) {
    out.push({ ab: 'Anti-Ma2', why: ['young man', o('sleep') ? 'hypersomnia / sleep change' : 'limbic symptoms'].filter(Boolean),
      tumour: 'Testicular ultrasound (germ cell tumour); CT CAP.', test: 'Paraneoplastic PLUS panel (PNMA2).' });
  }
  if (o('gi')) out.push({ ab: 'Anti-DPPX', why: ['diarrhoea / weight loss'], tumour: 'Screen for B-cell lymphoma (CT CAP, LDH, flow if indicated).', test: 'Encephalitis panel (DPPX).' });
  if (o('checkpoint')) out.push({ ab: 'Checkpoint-inhibitor encephalitis', why: ['ICI exposure'], tumour: 'Known cancer – discuss with oncology; hold ICI.', test: 'Full encephalitis + paraneoplastic panels.' });
  if (!out.length) out.push({ ab: 'No dominant phenotype yet', why: ['send broad panel'], tumour: 'Age/sex-appropriate screen: CT CAP; pelvic imaging in women; testicular US in young men; FDG-PET if high suspicion.', test: 'Paired serum + CSF, encephalitis panel + Paraneoplastic PLUS.' });
  return out;
}

/* ---------------- workup status ---------------- */
function workup() {
  const t = re => S.texts.filter(x => re.test(x.source) || (x.report && re.test(x.text.slice(0, 200))));
  const lab = re => labsMatching(re);
  const row = (item, found, detail) => ({ item, found, detail });
  const csf = lab(/(csf|cerebrospinal|spinal fluid)/i);
  const txt = re => S.texts.find(x => re.test(x.text));
  const csfTxt = txt(/\b(CSF|lumbar puncture)\b/i), hsvTxt = txt(/\b(HSV|herpes simplex)\b[^.\n]{0,30}PCR/i);
  const hsv = lab(/(hsv|herpes simplex)/i);
  const abs = lab(/(nmda|lgi1|caspr|gaba|ampa|dppx|iglon|paraneoplastic|anti-?hu\b|\bma2\b|\bgad\b|aquaporin|\bmog\b)/i);
  const mri = t(/(mri|mr ).*(brain|head)|(brain|head).*(mri|mr\b)/i);
  const eeg = t(/\beeg\b|electroenceph/i);
  const pelvis = t(/(pelvi|transvaginal|ovar|adnex)/i);
  const ctc = t(/ct.*(chest|thorax|abd)/i);
  const pet = t(/\bpet\b/i);
  const tsh = lab(/\btsh\b|thyrotropin/i), tpo = lab(/(tpo|peroxidase)/i);
  const latest = arr => arr.length ? `${ccText(arr[0].code)}: ${obsVal(arr[0]).str} (${fmtDate(obsDate(arr[0]))})` : '';
  const latestT = arr => arr.length ? `${arr[0].source} (${fmtDate(arr[0].date)})` : '';
  return [
    row('LP: cell count, protein, glucose', csf.length > 0 || !!csfTxt, csf.length ? csf.slice(0, 3).map(o => `${ccText(o.code)} ${obsVal(o).str}`).join('; ') : csfTxt ? 'mentioned in ' + csfTxt.source : ''),
    row('CSF oligoclonal bands / IgG index', lab(/oligoclonal|igg index/i).length > 0, latest(lab(/oligoclonal|igg index/i))),
    row('HSV-1/2 (and VZV) PCR – keep acyclovir until negative', hsv.length > 0 || !!hsvTxt, hsv.length ? hsv.map(o => obsVal(o).str).slice(0, 2).join('; ') : hsvTxt ? 'mentioned in ' + hsvTxt.source : ''),
    row('Neural antibody panels – paired serum + CSF (MitogenDx)', abs.length > 0, abs.slice(0, 4).map(o => `${ccText(o.code)}: ${obsVal(o).str}`).join('; ')),
    row('MRI brain with gadolinium (FLAIR, DWI)', mri.length > 0, latestT(mri)),
    row('EEG (continuous if fluctuating LOC – NCSE?)', eeg.length > 0, latestT(eeg)),
    row('Sodium', lab(/^(sodium|na\b)/i).length > 0, latest(lab(/^(sodium|na\b)/i))),
    row('TSH and anti-TPO (SREAT)', tsh.length > 0 && tpo.length > 0, [latest(tsh), latest(tpo)].filter(Boolean).join('; ')),
    row('B12, ammonia, HIV, syphilis, tox screen', ['b12|cobalamin', 'ammonia', 'hiv', 'syphilis|treponem|rpr', 'drug screen|tox'].every(r => lab(new RegExp(r, 'i')).length), ''),
    row('Tumour screen: pelvic MRI / transvaginal US (women)', pelvis.length > 0, latestT(pelvis)),
    row('Tumour screen: CT chest/abdomen/pelvis', ctc.length > 0, latestT(ctc)),
    row('Tumour screen: FDG-PET (if CT negative and high suspicion)', pet.length > 0, latestT(pet))
  ];
}

/* ---------------- treatment ---------------- */
function treatment() {
  const first = medsMatching(/(methylpred|solu-?medrol|immune glob|immunoglob|ivig|privigen|gamunex|octagam)/i);
  const second = medsMatching(/(rituximab|cyclophosphamide|tocilizumab|bortezomib)/i);
  const maint = medsMatching(/(azathioprine|mycophenol|prednisone)/i);
  const antipsych = medsMatching(/(haloperidol|olanzapine|risperidone|quetiapine|aripiprazole|ziprasidone|loxapine|chlorpromazine|paliperidone|methotrimeprazine|zuclopenthixol)/i).filter(activeMed);
  const acyclo = medsMatching(/acyclovir|aciclovir/i).filter(activeMed);
  const pjp = medsMatching(/(sulfamethox|trimethoprim|septra|dapsone|atovaquone|pentamidine)/i);
  const starts = first.map(m => new Date(m.authoredOn)).filter(d => !isNaN(d));
  const start = starts.length ? new Date(Math.min(...starts)) : null;
  const days = start ? Math.floor((Date.now() - start) / DAY) : null;
  const hsvNeg = labsMatching(/(hsv|herpes simplex)/i).some(o => /not detected|negative/i.test(obsVal(o).str)) ||
    S.texts.some(t => /\b(HSV|herpes simplex)\b[^.\n]{0,30}PCR[^.\n]{0,30}(not detected|negative)/i.test(t.text));
  return { first, second, maint, antipsych, acyclo, pjp, start, days, hsvNeg, plex: !!S.user.plexDone };
}

/* ---------------- rendering ---------------- */
function setStatus(t) { $('#pt').textContent = t; }
function chip(k) {
  if (FMAP[k] && FMAP[k].manualOnly) return '<span class="chip manual">you</span>';
  if (k in S.user && S.auto[k] && S.user[k] !== S.auto[k].on) return '<span class="chip manual">edited</span>';
  return S.auto[k] && S.auto[k].on ? '<span class="chip">chart</span>' : '';
}
function findingRow(f) {
  const a = S.auto[f.key] || { ev: [] };
  const ev = (a.ev || []).length ? `<details class="ev"><summary>${a.ev.length} chart match${a.ev.length > 1 ? 'es' : ''}</summary><ul class="tight">${a.ev.map(e => `<li>${esc(e)}</li>`).join('')}</ul></details>` : (a.note ? `<div class="ev">${esc(a.note)}</div>` : '');
  return `<div class="find"><label><input type="checkbox" data-k="${f.key}" ${on(f.key) ? 'checked' : ''}> ${esc(f.label)}</label>${chip(f.key)}${ev}</div>`;
}
function renderOverview() {
  const d = demo();
  const groups = [['core', 'Core (you decide)'], ['clinical', 'Clinical features'], ['investigation', 'Investigations'], ['context', 'Context / triggers']];
  const flags = [];
  if (on('psychDx') && (on('seizure') || on('movement') || on('catatonia') || on('autonomic') || on('consciousness') || on('nmsReaction') || on('csfPleo')))
    flags.push('Patient carries a psychiatric label but has neurological red flags — consider autoimmune encephalitis before attributing to primary psychosis.');
  if (on('nmsReaction')) flags.push('Severe antipsychotic intolerance (NMS-like / high CK) is a classic clue to anti-NMDAR encephalitis.');
  if (on('fbds')) flags.push('Faciobrachial dystonic seizures → anti-LGI1; start immunotherapy early to prevent cognitive decline.');
  const vs = S.vitalSummary || {};
  $('#tab-overview').innerHTML = `
    ${flags.map(f => `<div class="alert">${esc(f)}</div>`).join('')}
    <div class="card"><h2>Patient</h2>
      ${S.manual ? '<div class="muted">Manual mode – no chart connected. Tick findings yourself.</div>' :
      `${esc(d.first)} ${esc(d.surname)} · ${d.age ?? '?'} y · ${esc(d.sex || '?')} · DOB ${esc(d.dob)} ${d.phn ? '· PHN ' + esc(d.phn) : ''}<br>
       <span class="muted small">Loaded ${S.labs.length} labs, ${S.vitals.length} vitals (7 d), ${S.conds.length} problems, ${S.meds.length} med orders, ${S.texts.filter(t => !t.report).length} notes scanned, ${S.reports.length} reports.
       ${vs.hr && vs.hr.length ? ` HR 72 h ${Math.min(...vs.hr)}–${Math.max(...vs.hr)}.` : ''}</span>
       ${S.loadErrors.length ? `<details class="ev"><summary>${S.loadErrors.length} load warnings</summary><ul class="tight">${S.loadErrors.map(e => `<li>${esc(e)}</li>`).join('')}</ul></details>` : ''}`}
    </div>
    <div class="grid2">${groups.map(([t, h]) => `<div class="card"><h2>${h}</h2>${FINDINGS.filter(f => f.type === t).map(findingRow).join('')}</div>`).join('')}</div>`;
}
const CRIT_SHORT = ['Possible AE', 'Definite limbic', 'Probable NMDAR'];
function critItem(i) {
  const mark = `<span class="${i[1] ? 'y' : 'n'}">${i[1] ? '✔' : '✘'}</span>`;
  if (i[2]) return `<li><label class="tick">${mark} <input type="checkbox" data-k="${i[2]}" ${i[1] ? 'checked' : ''}> ${esc(i[0])} <span class="chip manual">tick here</span></label></li>`;
  return `<li>${mark} ${esc(i[0])}</li>`;
}
function renderCritBar(cs) {
  $('#critbar').innerHTML = '<span class="cb-lbl">Graus 2016:</span>' + cs.map((c, k) => {
    const n = c.items.filter(i => i[1]).length;
    return `<button type="button" class="cb ${c.met ? 'met' : 'notmet'}" data-crit="${k}" title="${esc(c.name)}">${c.met ? '✔' : '✘'} ${CRIT_SHORT[k]} <b>${c.met ? 'MET' : 'not met'}</b> <span>${n}/${c.items.length}</span></button>`;
  }).join('');
}
function renderCriteria() {
  const cs = criteria();
  S.critOpen = S.critOpen || {};
  renderCritBar(cs);
  $('#tab-criteria').innerHTML = `<div class="card critsum"><h2>Summary</h2>
      <table><tr><th>Criteria set</th><th>Result</th><th>Items met</th><th>Still missing</th></tr>
      ${cs.map((c, k) => `<tr><td>${esc(c.name.replace(' (Graus 2016)', ''))}</td><td class="${c.met ? 'y' : 'n'}"><b>${c.met ? 'MET' : 'not met'}</b></td>
        <td>${c.items.filter(i => i[1]).length}/${c.items.length}</td><td class="small">${c.met ? '—' : esc(c.items.filter(i => !i[1]).map(i => i[0]).join('; '))}</td></tr>`).join('')}
      </table></div>` +
    cs.map((c, k) => `
    <details class="card crit ${c.met ? 'met' : 'notmet'}" data-ci="${k}" ${S.critOpen[k] ? 'open' : ''}>
      <summary><h2>${esc(c.name)} — <span class="status">${c.met ? 'MET' : 'not met'}</span> <span class="muted small">(${c.items.filter(i => i[1]).length}/${c.items.length} items)</span></h2></summary>
      <ul class="tight crit-items">${c.items.map(critItem).join('')}</ul>
      ${c.groups ? `<h3>NMDAR symptom groups (${c.nGroups}/6)</h3><ul class="tight">${c.groups.map(g => `<li class="${g[1] ? 'y' : 'q'}">${g[1] ? '✔' : '○'} <span style="color:var(--ink)">${esc(g[0])}</span></li>`).join('')}</ul>
        <div class="muted small">Definite anti-NMDAR = ≥ 1 group + IgG anti-GluN1 antibodies in CSF.</div>` : ''}
      ${c.note ? `<div class="muted small">${esc(c.note)}</div>` : ''}
    </details>`).join('') + `<div class="tip">Don't wait for antibody results (MitogenDx ~5–7 working days after receipt). If "possible" or "probable" criteria are met and infection is reasonably excluded, start first-line immunotherapy.</div>
    <div class="muted small">Onset and "alternatives excluded" can be ticked here or on the Findings tab. Other items come from the Findings tab.</div>`;
  document.querySelectorAll('#tab-criteria details[data-ci]').forEach(d => d.addEventListener('toggle', () => { S.critOpen[d.dataset.ci] = d.open; }));
}
function openTab(name) {
  const b = document.querySelector(`#tabs button[data-tab="${name}"]`); if (b) b.click();
}
function renderPhenotype() {
  $('#tab-phenotype').innerHTML = phenotypes().map(p => `
    <div class="card"><h2>${esc(p.ab)}</h2>
      <div class="small muted">Why: ${esc(p.why.join(', '))}</div>
      <div><b>Testing:</b> ${esc(p.test)}</div><div><b>Tumour screen:</b> ${esc(p.tumour)}</div>
    </div>`).join('') + `<div class="muted small">Suggestions follow typical age/sex/feature associations; any antibody can occur in any patient. When unsure, send the full encephalitis panel + Paraneoplastic PLUS on paired serum and CSF.</div>`;
}
function renderWorkup() {
  const rows = workup();
  $('#tab-workup').innerHTML = `<div class="card"><h2>Workup checklist</h2>
    <table><tr><th></th><th>Item</th><th>Found in chart</th></tr>
    ${rows.map(r => `<tr><td class="${r.found ? 'y' : 'q'}">${r.found ? '✔' : '○'}</td><td>${esc(r.item)}</td><td class="small">${esc(r.detail || (r.found ? 'present' : 'not found'))}</td></tr>`).join('')}
    </table><div class="muted small">"Not found" means no matching lab/report was found — it may still have been done elsewhere.</div></div>
    <div class="card"><h2>Imaging – what to expect</h2><ul class="tight">
      <li>Classic limbic (LGI1, Hu, GABA-B, AMPAR, Ma2): uni/bilateral mesial temporal T2/FLAIR hyperintensity, hippocampal swelling → later atrophy/MTS.</li>
      <li>Anti-NMDAR: MRI normal in ~⅔. Normal MRI does not exclude it. FDG-PET: frontotemporal hyper- with occipital hypometabolism.</li>
      <li>LGI1 with FBDS: sometimes basal ganglia T1/T2 change. GABA-A: multifocal cortical/subcortical FLAIR. Ma2: hypothalamus/brainstem.</li>
      <li>HSV mimic: asymmetric, insula/cingulate, haemorrhage, diffusion restriction.</li></ul></div>`;
}
function medList(arr) { return arr.length ? arr.map(m => `${esc(medName(m))} <span class="muted small">(${esc(m.status || '')}, ${fmtDate(m.authoredOn)})</span>`).join('<br>') : '<span class="muted">none found</span>'; }
function renderTreatment() {
  const t = treatment();
  const alerts = [];
  const redFlags = ['seizure','fbds','movement','catatonia','nmsReaction','autonomic','consciousness','csfPleo','deltaBrush','mriLimbic'].some(on);
  if (t.antipsych.length) alerts.push(`<div class="${redFlags ? 'alert' : 'tip'}"><b>Active antipsychotic:</b> ${t.antipsych.map(m => esc(medName(m))).join(', ')}. Patients with NMDAR encephalitis are prone to NMS-like reactions. Prefer benzodiazepines, low-dose quetiapine, dexmedetomidine/clonidine; avoid high-potency typicals.</div>`);
  if (t.acyclo.length && t.hsvNeg) alerts.push(`<div class="tip">Acyclovir active and an HSV PCR is negative — review whether acyclovir can stop.</div>`);
  if (t.days != null && t.days >= 10 && !t.second.length) alerts.push(`<div class="tip">First-line therapy started ${t.days} days ago with no second-line agent found. If not clearly improving, consider rituximab ± cyclophosphamide (usual threshold ~10–14 days; earlier if ICU).</div>`);
  if ((t.second.some(m => /cyclophosph/i.test(medName(m))) || (t.days != null && t.days > 21)) && !t.pjp.length) alerts.push(`<div class="tip">On cyclophosphamide or prolonged steroids without PJP prophylaxis found — consider TMP-SMX.</div>`);
  $('#tab-treatment').innerHTML = `${alerts.join('')}
    <div class="grid2">
      <div class="card"><h2>1. First line ${t.days != null ? `<span class="chip">day ${t.days}</span>` : ''}</h2>
        <div class="small">${medList(t.first)}</div>
        <label class="small"><input type="checkbox" id="plexDone" ${t.plex ? 'checked' : ''}> PLEX done/ongoing (procedure – not in med list)</label>
        <ul class="tight small"><li>IV methylprednisolone 1 g daily × 3–5 d → oral taper</li><li>IVIG 2 g/kg over 2–5 d, and/or</li><li>PLEX 5–7 exchanges q2d — <b>PLEX before IVIG</b>, otherwise it removes the IVIG</li><li>Start empirically; acyclovir until HSV PCR negative</li></ul></div>
      <div class="card"><h2>2. Second line</h2><div class="small">${medList(t.second)}</div>
        <ul class="tight small"><li>Rituximab 375 mg/m² weekly × 4, or 1 g × 2 two weeks apart</li><li>Cyclophosphamide 750 mg/m² monthly</li><li>Refractory: tocilizumab, bortezomib (specialist)</li></ul></div>
      <div class="card"><h2>Tumour removal</h2><ul class="tight small"><li>Teratoma resection speeds recovery and lowers relapse.</li><li>Onconeural (Hu, Ma2, CV2): treating the cancer is the main therapy; immunotherapy response is poor.</li></ul></div>
      <div class="card"><h2>Maintenance</h2><div class="small">${medList(t.maint)}</div><ul class="tight small"><li>Steroid taper, monthly IVIG, rituximab redosing, or azathioprine/MMF (esp. LGI1 relapses)</li></ul></div>
      <div class="card"><h2>Supportive</h2><ul class="tight small">
        <li>Agitation: benzodiazepines, low-dose quetiapine, dexmedetomidine/clonidine</li><li>Catatonia: lorazepam challenge; ECT if refractory</li>
        <li>Seizures: ASMs; FBDS need immunotherapy</li><li>Dysautonomia/hypoventilation: telemetry, ICU; pacing for asystole</li>
        <li>Hyponatraemia: fluid restriction / salt tablets</li><li>Prophylaxis: PJP, bone, GI, VTE, glucose monitoring</li></ul></div>
    </div>`;
  const pd = $('#plexDone'); if (pd) pd.onchange = e => { S.user.plexDone = e.target.checked; renderAll(); };
}

/* ---------------- requisition ---------------- */
function physicianList() {
  const list = [];
  if (CFG.defaultPhysician) list.push(Object.assign({ id: 'default' }, CFG.defaultPhysician));
  store.get('physicians', []).forEach((p, i) => list.push(Object.assign({ id: 'saved' + i }, p)));
  return list;
}
function renderRequisition() {
  const d = demo(), lab = store.get('lab', {}), phys = physicianList(), sel0 = store.get('lastPhysician', 'default');
  const sel = (sel0 === 'other' || phys.some(p => p.id === sel0)) ? sel0 : (phys[0] ? phys[0].id : 'other');
  const TESTS = (window.MitogenFill && window.MitogenFill.TESTS) || [];
  const pickedTests = store.get('tests', null) || TESTS.filter(t => t.def).map(t => t.field);
  $('#tab-requisition').innerHTML = `
    <div class="grid2">
      <div class="card"><h2>Referring physician</h2>
        <div class="form">
          <span>Physician</span><select id="physSel">
            ${phys.map(p => `<option value="${p.id}" ${p.id === sel ? 'selected' : ''}>${esc(p.label || p.name)}</option>`).join('')}
            <option value="other" ${sel === 'other' ? 'selected' : ''}>Other physician…</option></select>
          <span>Name (Surname, First)</span><input type="text" id="phName">
          <span>Phone</span><input type="text" id="phPhone">
          <span>Fax</span><input type="text" id="phFax">
          <span>Email</span><input type="email" id="phEmail">
          <span>Comments</span><input type="text" id="phComments" placeholder="College ID; MSP number">
        </div>
        <div class="row" style="margin-top:8px">
          <button class="btn sec" id="phSave">Save as a physician on this computer</button>
          <button class="btn sec" id="phDel">Remove saved physician</button>
        </div>
        <div class="muted small">Saved physicians stay in this browser only (none are stored in the app itself).</div>
      </div>
      <div class="card"><h2>Patient</h2>
        <div class="form">
          <span>Surname</span><input type="text" id="ptSur" value="${esc(d.surname)}">
          <span>First name</span><input type="text" id="ptFirst" value="${esc(d.first)}">
          <span>Sex</span><select id="ptSex"><option value=""></option><option value="female" ${d.sex === 'female' ? 'selected' : ''}>Female</option><option value="male" ${d.sex === 'male' ? 'selected' : ''}>Male</option></select>
          <span>PHN</span><input type="text" id="ptPhn" value="${esc(d.phn)}">
          <span>DOB (dd/mm/yy)</span><input type="text" id="ptDob" value="${esc(dobFmt(d.dob))}">
        </div></div>
      <div class="card"><h2>Ordering laboratory</h2>
        <div class="form">
          <span>Lab name</span><input type="text" id="labName" value="${esc(lab.name || '')}">
          <span>Address</span><input type="text" id="labAddr" value="${esc(lab.address || '')}">
          <span>Phone</span><input type="text" id="labPhone" value="${esc(lab.phone || '')}">
          <span>Fax</span><input type="text" id="labFax" value="${esc(lab.fax || '')}">
          <span>Email</span><input type="text" id="labEmail" value="${esc(lab.email || '')}">
        </div><div class="muted small">Remembered in this browser after you generate a form.</div></div>
      <div class="card"><h2>Samples</h2>
        <div class="form">
          <span>Serum collected</span><div class="row nowrap"><input type="datetime-local" id="smSerum" class="dt"><button type="button" class="btn sec sm" data-now="smSerum">Now</button></div>
          <span>CSF collected</span><div class="row nowrap"><input type="datetime-local" id="smCsf" class="dt"><button type="button" class="btn sec sm" data-now="smCsf">Now</button></div>
          <span>Lab reference #</span><input type="text" id="smRef">
          <span>Clinical comment</span><input type="text" id="smNote" value="Query autoimmune / paraneoplastic encephalitis. Paired serum and CSF sent on separate requisitions.">
        </div>
        <div class="muted small">CSF: 0.3–1.0 mL, frozen, dry ice. Serum: 0.5–1.0 mL SST, ice packs. Must arrive by 3 pm Friday; results go to the ordering lab only.</div></div>
    </div>
    <div class="card"><h2>Tests</h2>
      ${TESTS.map(t => `<div><label><input type="checkbox" class="tst" value="${esc(t.field)}" ${pickedTests.includes(t.field) ? 'checked' : ''}> ${esc(t.label)}</label> <span class="muted small">${esc(t.group)}</span></div>`).join('')}
      <div class="muted small">Not on this form: GABA-A, mGluR5, glycine receptor, GFAP — ask the lab or neurology (Mayo) if the panel is negative and suspicion stays high.</div>
    </div>
    <div class="row">
      <button class="btn" data-gen="serum">Serum requisition (PDF)</button>
      <button class="btn" data-gen="csf">CSF requisition (PDF)</button>
      <button class="btn sec" data-gen="both">Both</button>
      <span id="genMsg" class="muted small"></span>
    </div>`;
  fillPhysician(sel);
  $('#physSel').onchange = e => { store.set('lastPhysician', e.target.value); fillPhysician(e.target.value); };
  $('#phSave').onclick = savePhysician;
  $('#phDel').onclick = deletePhysician;
  document.querySelectorAll('[data-gen]').forEach(b => b.onclick = () => generate(b.dataset.gen));
  // Clicking anywhere in a date box opens the calendar (Chrome/Edge); "Now" fills the current date and time
  document.querySelectorAll('#tab-requisition input.dt').forEach(i => i.addEventListener('click', () => { try { i.showPicker(); } catch (e) { /* older browser: its own picker icon still works */ } }));
  document.querySelectorAll('[data-now]').forEach(b => b.onclick = () => { $('#' + b.dataset.now).value = localNow(); });
}
// datetime-local value "2026-11-17T09:30" -> form format "17/11/26 09:30"
function dtFmt(v) { const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}:\d{2}))?/.exec(v || ''); return m ? `${m[3]}/${m[2]}/${m[1].slice(2)}${m[4] ? ' ' + m[4] : ''}` : (v || ''); }
function localNow() { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); }
function dobFmt(iso) { if (!iso) return ''; const [y, m, d] = iso.split('-'); return d && m ? `${d}/${m}/${y.slice(2)}` : iso; }
function fillPhysician(id) {
  const p = physicianList().find(x => x.id === id) || { name: '', phone: '', fax: '', email: '', comments: '' };
  $('#phName').value = p.name || ''; $('#phPhone').value = p.phone || ''; $('#phFax').value = p.fax || '';
  $('#phEmail').value = p.email || ''; $('#phComments').value = p.comments || '';
  $('#phDel').disabled = !String(id).startsWith('saved');
  if (id === 'other') $('#phName').focus();
}
function currentPhysician() {
  return { name: $('#phName').value.trim(), phone: $('#phPhone').value.trim(), fax: $('#phFax').value.trim(), email: $('#phEmail').value.trim(), comments: $('#phComments').value.trim() };
}
function savePhysician() {
  const p = currentPhysician();
  if (!p.name) { alertMsg('Enter the physician name first.'); return; }
  const list = store.get('physicians', []);
  const i = list.findIndex(x => x.name.toLowerCase() === p.name.toLowerCase());
  p.label = 'Dr. ' + p.name.split(',').map(s => s.trim()).reverse().join(' ');
  if (i >= 0) list[i] = p; else list.push(p);
  store.set('physicians', list);
  const idx = i >= 0 ? i : list.length - 1;
  store.set('lastPhysician', 'saved' + idx);
  renderRequisition(); alertMsg('Saved ' + p.label + '.');
}
function deletePhysician() {
  const id = $('#physSel').value; if (!id.startsWith('saved')) return;
  const list = store.get('physicians', []); list.splice(parseInt(id.slice(5), 10), 1);
  store.set('physicians', list); store.set('lastPhysician', 'other'); renderRequisition();
}
function alertMsg(t) { const m = $('#genMsg'); if (m) m.textContent = t; }
let TEMPLATE = null;
async function generate(which) {
  try {
    if (!window.PDFLib || !window.MitogenFill) throw new Error('PDF library did not load (check internet access to cdn.jsdelivr.net).');
    if (!TEMPLATE) {
      const r = await fetch('mitogen-requisition-2025.pdf');
      if (!r.ok) throw new Error('Could not load mitogen-requisition-2025.pdf (' + r.status + ')');
      TEMPLATE = await r.arrayBuffer();
    }
    const ph = currentPhysician();
    if (!ph.name) { alertMsg('Referring physician name is required.'); return; }
    const lab = { name: $('#labName').value, address: $('#labAddr').value, phone: $('#labPhone').value, fax: $('#labFax').value, email: $('#labEmail').value };
    store.set('lab', lab);
    const tests = [...document.querySelectorAll('.tst:checked')].map(x => x.value);
    store.set('tests', tests);
    const patient = { surname: $('#ptSur').value, first: $('#ptFirst').value, sex: $('#ptSex').value, phn: $('#ptPhn').value, dob: $('#ptDob').value };
    const note = $('#smNote').value;
    const types = which === 'both' ? ['serum', 'csf'] : [which];
    for (const type of types) {
      const bytes = await window.MitogenFill.fillMitogen(window.PDFLib, TEMPLATE.slice(0), {
        patient, physician: ph, lab, tests, page2Comments: note,
        sample: { type, collected: dtFmt(type === 'csf' ? $('#smCsf').value : $('#smSerum').value), ref: $('#smRef').value,
          comments: type === 'csf' ? 'CSF, frozen, shipped on dry ice. Paired serum sent separately.' : 'Serum (SST). Paired CSF sent separately.' }
      });
      const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url; a.download = `MitogenDx_${type.toUpperCase()}_${(patient.surname || 'patient').replace(/\W+/g, '')}.pdf`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    }
    alertMsg(`Generated ${types.join(' + ')} requisition${types.length > 1 ? 's' : ''} for ${ph.name}.`);
  } catch (e) { alertMsg('Error: ' + e.message); console.error(e); }
}

/* ---------------- note draft ---------------- */
function buildNote() {
  const d = demo(), cs = criteria(), ph = phenotypes(), t = treatment(), w = workup();
  const pos = FINDINGS.filter(f => on(f.key) && !f.manualOnly).map(f => f.label.split('(')[0].trim());
  const lines = [];
  lines.push(`Query autoimmune encephalitis${d.age != null ? ` — ${d.age} y ${d.sex}` : ''}`);
  lines.push('');
  lines.push('Features: ' + (pos.length ? pos.join('; ') : 'none recorded') + '.');
  lines.push('');
  lines.push('Criteria (Graus 2016):');
  cs.forEach(c => lines.push(`- ${c.name.replace(' (Graus 2016)', '')}: ${c.met ? 'MET' : 'not met'}${c.met ? '' : ' (missing: ' + c.items.filter(i => !i[1]).map(i => i[0]).join('; ') + ')'}`));
  lines.push('');
  lines.push('Suspected antibody / tumour screen:');
  ph.forEach(p => lines.push(`- ${p.ab}: ${p.tumour}`));
  lines.push('');
  lines.push('Workup outstanding:');
  w.filter(r => !r.found).forEach(r => lines.push(`- ${r.item}`));
  lines.push('');
  lines.push('Treatment:');
  lines.push(`- First line: ${t.first.length ? t.first.map(medName).join(', ') + (t.days != null ? ` (day ${t.days})` : '') : 'not started'}${t.plex ? '; PLEX' : ''}`);
  lines.push(`- Second line: ${t.second.length ? t.second.map(medName).join(', ') : 'not started'}`);
  if (t.antipsych.length) lines.push(`- On antipsychotic (${t.antipsych.map(medName).join(', ')}) — monitor for NMS-like reaction; prefer benzodiazepines.`);
  lines.push('');
  lines.push('Plan / decision: ');
  return lines.join('\n');
}
function renderNote() {
  $('#tab-note').innerHTML = `<div class="card"><h2>Assessment &amp; plan draft</h2>
    <textarea id="note"></textarea>
    <div class="row" style="margin-top:8px"><button class="btn" id="copyNote">Copy</button><button class="btn sec" id="regenNote">Rebuild from current findings</button><span id="noteMsg" class="muted small"></span></div>
    <div class="muted small">Edit freely before pasting into the PowerChart note. Rebuilding overwrites your edits.</div></div>`;
  $('#note').value = S.noteText || buildNote();
  $('#note').oninput = e => { S.noteText = e.target.value; };
  $('#regenNote').onclick = () => { S.noteText = buildNote(); $('#note').value = S.noteText; };
  $('#copyNote').onclick = async () => {
    try { await navigator.clipboard.writeText($('#note').value); $('#noteMsg').textContent = 'Copied.'; }
    catch (e) { $('#note').select(); document.execCommand('copy'); $('#noteMsg').textContent = 'Copied.'; }
  };
}
function renderReference() {
  const rows = [
    ['NMDAR', 'Young women (median ~21), children', 'Psychosis → catatonia, dyskinesias, dysautonomia, hypoventilation', 'Ovarian teratoma (~40–50% women 12–45)'],
    ['LGI1', 'Men > women, ~60s', 'FBDS, hyponatraemia, amnesia', 'Rare'],
    ['CASPR2', 'Older men', 'Neuromyotonia, insomnia, pain, Morvan', 'Thymoma'],
    ['GABA-B', '60s, smokers', 'Early refractory seizures / status', 'SCLC (~50%)'],
    ['AMPAR', 'Middle-aged women', 'Limbic, psychiatric', 'Thymoma, SCLC, breast'],
    ['GABA-A', 'Any', 'Refractory status; multifocal MRI', 'Thymoma'],
    ['DPPX', 'Adults', 'Diarrhoea/weight loss → encephalopathy, hyperekplexia', 'B-cell lymphoma'],
    ['mGluR5', 'Young adults', 'Ophelia syndrome', 'Hodgkin lymphoma'],
    ['Hu', '60s, smokers', 'Limbic ± sensory neuronopathy', 'SCLC'],
    ['Ma2', 'Young men < 50', 'Limbic, diencephalic, brainstem; hypersomnia', 'Testicular germ cell'],
    ['GAD65 (high titre)', 'Young–middle-aged women', 'Chronic TLE, stiff-person, ataxia', 'Rare; T1DM/thyroid'],
  ];
  $('#tab-reference').innerHTML = `<div class="card"><h2>Antibody syndromes</h2><table><tr><th>Antibody</th><th>Typical patient</th><th>Features</th><th>Tumour</th></tr>
    ${rows.map(r => `<tr>${r.map(c => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</table>
    <div class="muted small">Cell-surface antibodies (NMDAR, LGI1, CASPR2, AMPAR, GABA-A/B, DPPX) are pathogenic and respond to immunotherapy. Intracellular/onconeural (Hu, Ma2, CV2, amphiphysin) are T-cell mediated, strongly cancer-associated, and respond poorly.</div></div>
    <div class="card"><h2>Red flags in "first-episode psychosis"</h2><ul class="tight">
      <li>Acute onset, no psychiatric history; viral prodrome or headache</li><li>Catatonia, mutism, fluctuating consciousness</li>
      <li>Seizures, dyskinesias, focal signs, dysautonomia</li><li>NMS-like reaction to antipsychotics</li><li>Hyponatraemia; recent HSV encephalitis</li>
      <li>Abnormal EEG, CSF or MRI; treatment-resistant psychosis</li></ul>
      <div class="muted small">Low-titre serum-only NMDAR positivity in a typical psychiatric patient is often a false positive — CSF confirms.</div></div>`;
}
function renderAll() {
  renderOverview(); renderCriteria(); renderPhenotype(); renderWorkup(); renderTreatment(); renderNote(); renderReference();
  if (!$('#tab-requisition').innerHTML) renderRequisition();
}

/* ---------------- events & start ---------------- */
document.addEventListener('change', e => {
  const k = e.target.dataset && e.target.dataset.k;
  if (!k) return;
  S.user[k] = e.target.checked;
  const keep = $('#tab-requisition').innerHTML; // don't wipe typed requisition fields
  renderOverview(); renderCriteria(); renderPhenotype(); renderTreatment();
  if (!S.noteText) renderNote();
  void keep;
});
document.getElementById('critbar').addEventListener('click', e => {
  const b = e.target.closest('[data-crit]'); if (!b) return;
  S.critOpen = S.critOpen || {}; S.critOpen[b.dataset.crit] = true;
  renderCriteria(); openTab('criteria');
  const d = document.querySelector(`#tab-criteria details[data-ci="${b.dataset.crit}"]`); if (d) d.scrollIntoView({ behavior: 'smooth', block: 'start' });
});
document.getElementById('tabs').addEventListener('click', e => {
  const b = e.target.closest('button[data-tab]'); if (!b) return;
  document.querySelectorAll('#tabs button').forEach(x => x.classList.toggle('on', x === b));
  document.querySelectorAll('section.tab').forEach(s => s.classList.toggle('on', s.id === 'tab-' + b.dataset.tab));
});

(async function start() {
  try {
    const demoN = new URLSearchParams(location.search).get('demo');
    if (demoN && window.AE_MOCK) {
      S.client = window.AE_MOCK.client(parseInt(demoN, 10) || 1);
      const links = Array.from({ length: window.AE_MOCK.count }, (_, i) => `<a href="?demo=${i + 1}"${String(i + 1) === demoN ? ' style="font-weight:700"' : ''}>${i + 1}</a>`).join(' · ');
      $('#banner').innerHTML = `<div class="banner warn">DEMO – made-up test patient ${esc(demoN)}. Other test patients: ${links}</div>`;
    } else {
      if (!window.FHIR) throw new Error('no fhirclient');
      S.client = await FHIR.oauth2.ready();
    }
    S.pid = S.client.patient.id;
    if (!S.pid) throw new Error('No patient in context');
    setStatus('Loading chart…');
    await loadChart();
    detect();
    const d = demo();
    setStatus(`${d.first} ${d.surname} · ${d.age ?? '?'} y · ${d.sex}${d.mrn ? ' · MRN ' + d.mrn : ''}`);
  } catch (e) {
    S.manual = true;
    $('#banner').innerHTML = `<div class="banner info">Manual mode — not launched from the EHR (${esc(e.message || e)}). You can still tick findings, check criteria and fill the MitogenDx requisition.</div>`;
    setStatus('Manual mode');
    S.auto = {};
  }
  renderAll();
})();
