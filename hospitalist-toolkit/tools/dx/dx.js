/*
 * dx.js — Diagnosis check for the hospitalist toolkit
 * SMART on FHIR (Oracle Health / Cerner Millennium R4)
 *
 * Four sections that prompt a second look, never a diagnosis:
 *   1. Not improving       day 3+ with fever, rising WBC/creatinine/lactate or more oxygen → diagnostic time-out
 *   2. Can't-miss bundles  S. aureus or Candida in blood, refractory hypotension, confusion with alcohol use,
 *                          back pain with fever or bacteremia → must-do list, ticked from the chart
 *   3. Does the data fit?  the working diagnosis against findings that argue for and against it
 *   4. Unexplained results abnormal labs and imaging follow-up recommendations that no note mentions
 * Read-only: nothing is written to the chart.
 *
 * Usage (after FHIR.oauth2.ready()):
 *   DX.mount(document.getElementById('dx-tab'), client, { lookbackDays: 7 });
 * Options: lookbackDays, getNotes, loader (demo/tests), now (tests).
 * Thresholds, keywords and rules are in CONFIG, LAB, FIT_RULES, BUNDLES and UNEXPLAINED below.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DX = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const HOUR = 3600 * 1000, DAY = 24 * HOUR;

  // ------------------------------------------------------------------
  // Configuration
  // ------------------------------------------------------------------
  const CONFIG = {
    lookbackDays: 7,
    notImprovingDay: 3,          // hospital day (or day on antibiotics) from which "not improving" applies
    feverC: 38.0,
    hrHigh: 100, rrHigh: 22, spo2Low: 92, sbpLow: 90,
    wbcHigh: 12, wbcRise: 2,     // ×10⁹/L
    creatRise: 26.5,             // µmol/L within 48 h
    lactateHigh: 2.0,            // mmol/L
    timeouts: { searchMs: 60000, notesMs: 60000, noteMs: 15000 },
    maxParallel: 4,
    maxNotes: 30,
    extraCodes: {}               // site codes, e.g. { o2flow: ['system|code'], bloodCulture: [...] }
  };

  // LOINC codes by kind. Text matching is the fallback (kindOf).
  const LAB = {
    temp: ['8310-5', '8331-1', '8332-9', '8333-7', '8328-5'], hr: ['8867-4'], rr: ['9279-1'],
    sbp: ['8480-6'], spo2: ['59408-5', '2708-6', '20564-1'], o2flow: ['3151-8', '19941-4'], fio2: ['3150-0', '19996-8'],
    wbc: ['6690-2', '26464-8', '804-5'], hgb: ['718-7', '30313-1', '20509-6'], plt: ['777-3', '26515-7'],
    eos: ['711-2', '26449-9'], na: ['2951-2', '2947-0'], k: ['2823-3', '6298-4'], creat: ['2160-0', '38483-4', '14682-9'],
    ca: ['17861-6', '2000-8'], ica: ['1994-3', '19072-8'], alp: ['6768-6'], alt: ['1742-6', '1743-4'],
    bili: ['1975-2', '42719-5'], inr: ['6301-6', '34714-6'], tsh: ['3016-3', '11580-8'], glucose: ['2345-7', '2339-0', '41653-7'],
    lactate: ['2524-7', '32693-4', '2518-9'], crp: ['1988-5', '30522-7'], pct: ['33959-8', '75241-0'],
    bnp: ['30934-4', '42637-9'], ntbnp: ['33762-6', '83107-3', '83108-1'], cortisol: ['2143-6', '2141-0'],
    uosm: ['2695-8'], una: ['2955-3', '2956-1'], sosm: ['2692-2'], mg: ['19123-9', '2601-3'],
    ule: ['5799-2', '60026-2'], unit: ['5802-4'], uwbc: ['5821-4', '30405-5']
  };
  const TEXT_KIND = [
    [/blood culture|culture,? blood|bld cx/, 'bloodCulture'], [/urine culture|culture,? urine/, 'urineCulture'],
    [/n-?terminal|nt-?pro ?bnp/, 'ntbnp'], [/\bbnp\b|natriuretic/, 'bnp'], [/procalcitonin/, 'pct'],
    [/lactate|lactic acid/, 'lactate'], [/c-?reactive protein|\bcrp\b/, 'crp'], [/cortisol/, 'cortisol'],
    [/oxygen flow|o2 flow|flow rate/, 'o2flow'], [/fio2|inspired oxygen/, 'fio2'],
    [/spo2|oxygen saturation|o2 sat/, 'spo2'], [/heart rate|pulse rate/, 'hr'], [/respiratory rate/, 'rr'],
    [/systolic/, 'sbp'], [/temperature/, 'temp'],
    [/osmolality,? urine|urine osmolality/, 'uosm'], [/sodium,? urine|urine sodium/, 'una'], [/osmolality/, 'sosm'],
    [/leukocyte esterase/, 'ule'], [/nitrite/, 'unit'],
    [/ionized calcium|calcium,? ionized/, 'ica'], [/\bcalcium\b/, 'ca'], [/alkaline phosphatase|\balp\b/, 'alp'],
    [/\balt\b|alanine aminotransferase/, 'alt'], [/bilirubin/, 'bili'], [/\binr\b/, 'inr'], [/\btsh\b|thyrotropin/, 'tsh'],
    [/magnesium/, 'mg'], [/eosinophil/, 'eos'], [/glucose/, 'glucose'],
    [/h(a)?emoglobin\b/, 'hgb'], [/\bwbc\b|white blood cell|leukocyte count/, 'wbc'], [/platelet/, 'plt'],
    [/\bsodium\b/, 'na'], [/\bpotassium\b/, 'k'], [/creatinine/, 'creat']
  ];
  const URINE_EXCLUDE = /urine|csf|fluid|stool/;

  const DRUGS = {
    antibiotic: ['ciprofloxacin', 'levofloxacin', 'moxifloxacin', 'nitrofurantoin', 'fosfomycin', 'trimethoprim', 'sulfamethoxazole',
      'cephalexin', 'cefazolin', 'cefuroxime', 'cefixime', 'ceftriaxone', 'cefotaxime', 'ceftazidime', 'cefepime', 'amoxicillin',
      'ampicillin', 'piperacillin', 'meropenem', 'ertapenem', 'imipenem', 'gentamicin', 'tobramycin', 'amikacin', 'doxycycline',
      'vancomycin', 'clindamycin', 'azithromycin', 'clarithromycin', 'metronidazole', 'linezolid', 'daptomycin', 'cloxacillin',
      'penicillin', 'rifampin', 'tazobactam'],
    antiStaphBetaLactam: ['cefazolin', 'cloxacillin', 'nafcillin', 'oxacillin', 'flucloxacillin'],
    mrsaActive: ['vancomycin', 'daptomycin', 'linezolid', 'ceftaroline'],
    antifungal: ['fluconazole', 'caspofungin', 'micafungin', 'anidulafungin', 'voriconazole', 'amphotericin', 'isavuconazole', 'posaconazole'],
    vasopressor: ['norepinephrine', 'noradrenaline', 'vasopressin', 'phenylephrine', 'epinephrine', 'dopamine'],
    steroid: ['prednisone', 'prednisolone', 'hydrocortisone', 'methylprednisolone', 'dexamethasone', 'fludrocortisone'],
    thiamine: ['thiamine', 'vitamin b1'],
    anticoag: ['warfarin'],
    deliriogenic: ['zopiclone', 'zolpidem', 'lorazepam', 'diazepam', 'clonazepam', 'alprazolam', 'temazepam', 'oxazepam', 'midazolam',
      'diphenhydramine', 'hydroxyzine', 'dimenhydrinate', 'oxybutynin', 'tolterodine', 'amitriptyline', 'hydromorphone', 'morphine',
      'oxycodone', 'codeine', 'tramadol', 'gabapentin', 'pregabalin', 'quetiapine', 'olanzapine', 'haloperidol', 'prednisone',
      'dexamethasone', 'metoclopramide', 'ciprofloxacin', 'levofloxacin', 'moxifloxacin']
  };
  const BRANDS = { tazocin: 'piperacillin tazobactam', 'pip-tazo': 'piperacillin tazobactam', levophed: 'norepinephrine',
    solu: 'methylprednisolone', imovane: 'zopiclone', ativan: 'lorazepam', dilaudid: 'hydromorphone', neurontin: 'gabapentin',
    seroquel: 'quetiapine', benadryl: 'diphenhydramine', gravol: 'dimenhydrinate', cipro: 'ciprofloxacin', coumadin: 'warfarin' };

  // ------------------------------------------------------------------
  // Utilities
  // ------------------------------------------------------------------
  const lc = s => (s == null ? '' : String(s)).toLowerCase();
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const toTime = v => { const t = v ? Date.parse(v) : NaN; return isNaN(t) ? null : t; };
  const pad2 = n => String(n).padStart(2, '0');
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const fmtTime = t => { const d = new Date(t); return MONTHS[d.getMonth()] + ' ' + d.getDate() + ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes()); };
  const round = (v, d = 0) => { const f = Math.pow(10, d); return Math.round(v * f) / f; };
  const fhirDate = t => new Date(t).toISOString().replace(/\.\d{3}Z$/, 'Z');
  const uniq = a => Array.from(new Set(a));
  const codings = cc => (cc && cc.coding) || [];
  const ccText = cc => !cc ? '' : (cc.text || (codings(cc).find(c => c.display) || {}).display || '');
  const last = a => (a.length ? a[a.length - 1] : null);
  const maxBy = (a, f) => a.reduce((m, x) => (m == null || f(x) > f(m) ? x : m), null);
  const minBy = (a, f) => a.reduce((m, x) => (m == null || f(x) < f(m) ? x : m), null);

  function wordRe(term) { return new RegExp('\\b' + term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b'); }
  const CLASS_RES = {};
  Object.keys(DRUGS).forEach(k => { CLASS_RES[k] = DRUGS[k].map(wordRe); });
  function normMed(n) { n = lc(n); Object.keys(BRANDS).forEach(b => { n = n.replace(wordRe(b), BRANDS[b]); }); return n; }
  function classesOf(norm) {
    const out = {};
    Object.keys(CLASS_RES).forEach(c => { const h = CLASS_RES[c].map(re => (norm.match(re) || [])[0]).filter(Boolean); if (h.length) out[c] = uniq(h); });
    return out;
  }
  function ageAt(b, t) { const x = new Date(b), d = new Date(t); let a = d.getFullYear() - x.getFullYear(); if (d.getMonth() < x.getMonth() || (d.getMonth() === x.getMonth() && d.getDate() < x.getDate())) a--; return a; }

  const NEGATION = /\b(?:no|not|denies|denied|without|negative for|nil|absent|resolved|ruled out|r\/o)\b[^.;:\n]{0,30}$/i;
  function findInNotes(notes, re, opts) {
    opts = opts || {};
    const hits = [];
    for (const n of notes || []) {
      if (opts.after != null && n.time < opts.after) continue;
      const t = n.text || '';
      const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
      let m;
      while ((m = g.exec(t))) {
        if (opts.allowNegated || !NEGATION.test(t.slice(Math.max(0, m.index - 40), m.index))) {
          const s = Math.max(0, m.index - 50), e = Math.min(t.length, m.index + m[0].length + 60);
          hits.push({ time: n.time, title: n.title, match: m[0], excerpt: (s > 0 ? '…' : '') + t.slice(s, e).replace(/\s+/g, ' ').trim() + (e < t.length ? '…' : '') });
          break;
        }
        if (m.index === g.lastIndex) g.lastIndex++;
      }
    }
    return hits.sort((a, b) => a.time - b.time);
  }
  const quote = h => '“' + h.excerpt + '” (' + (h.title || 'note') + ', ' + fmtTime(h.time) + ')';

  // ------------------------------------------------------------------
  // Parsing
  // ------------------------------------------------------------------
  function kindOf(cc) {
    const cods = codings(cc);
    for (const kind of Object.keys(CONFIG.extraCodes || {})) {
      const list = CONFIG.extraCodes[kind] || [];
      if (cods.some(c => list.includes((c.system || '') + '|' + (c.code || '')) || list.includes(c.code))) return kind;
    }
    const loinc = cods.filter(c => !c.system || /loinc/i.test(c.system)).map(c => c.code);
    for (const k of Object.keys(LAB)) if (loinc.some(code => LAB[k].includes(code))) return k;
    const t = lc(ccText(cc) + ' ' + cods.map(c => c.display || '').join(' '));
    if (!t.trim()) return null;
    for (const [re, k] of TEXT_KIND) {
      if (!re.test(t)) continue;
      if (['ca', 'hgb', 'wbc', 'plt', 'na', 'k', 'creat', 'glucose', 'eos', 'mg', 'alp', 'alt', 'bili', 'sosm'].includes(k) && URINE_EXCLUDE.test(t)) continue;
      if (k === 'hgb' && /a1c|glyc/.test(t)) continue;
      if (k === 'creat' && /clearance|ratio|kinase/.test(t)) continue;
      return k;
    }
    return null;
  }
  function toSI(kind, num, unit) {
    if (num == null) return null;
    const u = lc(unit).replace(/\s/g, '');
    switch (kind) {
      case 'hgb': return (u.includes('g/dl') || (!u && num < 25)) ? round(num * 10) : num;
      case 'creat': return (u.includes('mg/dl') || (!u && num < 20)) ? round(num * 88.42) : num;
      case 'glucose': return (u.includes('mg/dl') || (!u && num > 35)) ? round(num / 18.016, 1) : num;
      case 'ca': return (u.includes('mg/dl') || (!u && num > 5)) ? round(num / 4.008, 2) : num;
      case 'bili': return (u.includes('mg/dl') || (!u && num < 15)) ? round(num * 17.1) : num;
      case 'lactate': return (u.includes('mg/dl')) ? round(num / 9.01, 1) : num;
      case 'temp': return (/degf|\[degf\]|fahrenheit/.test(u) || num > 50) ? round((num - 32) * 5 / 9, 1) : num;
      case 'fio2': return num <= 1 ? round(num * 100) : num;
      default: return num;
    }
  }
  function obsValue(o) {
    if (o.valueQuantity && typeof o.valueQuantity.value === 'number') return { num: o.valueQuantity.value, unit: o.valueQuantity.unit || o.valueQuantity.code || '' };
    if (typeof o.valueInteger === 'number') return { num: o.valueInteger, unit: '' };
    if (typeof o.valueString === 'string') { const m = o.valueString.match(/^\s*[<>]?\s*(-?\d+(?:\.\d+)?)\s*$/); return { num: m ? parseFloat(m[1]) : null, text: o.valueString }; }
    if (o.valueCodeableConcept) return { num: null, text: ccText(o.valueCodeableConcept) };
    return { num: null, text: '' };
  }
  function parseObservations(list) {
    const out = [];
    for (const o of list || []) {
      if (!o || o.resourceType !== 'Observation' || ['entered-in-error', 'cancelled'].includes(o.status)) continue;
      const time = toTime(o.effectiveDateTime || (o.effectivePeriod && o.effectivePeriod.start) || o.issued);
      if (time == null) continue;
      const entries = [{ cc: o.code, src: o }].concat((o.component || []).map(c => ({ cc: c.code, src: c })));
      for (const e of entries) {
        const kind = kindOf(e.cc);
        if (!kind) continue;
        const v = obsValue(e.src);
        if (v.num == null && !v.text) continue;
        out.push({ kind, time, display: ccText(e.cc), value: toSI(kind, v.num, v.unit), unit: v.unit,
          text: [v.text, (o.interpretation || []).map(ccText).join(' '), (o.note || []).map(n => n.text).join(' ')].filter(Boolean).join(' '),
          flag: codings((o.interpretation || [])[0]).map(c => c.code)[0] || '' });
      }
    }
    return out.sort((a, b) => a.time - b.time);
  }
  function b64decode(s) { try { return new TextDecoder().decode(Uint8Array.from(atob(s), c => c.charCodeAt(0))); } catch (e) { return ''; } }
  function stripHtml(h) {
    return String(h || '').replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ').replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|li|tr|h\d)>/gi, '\n')
      .replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/[ \t]+/g, ' ').trim();
  }
  function parseReports(list) {
    return (list || []).filter(r => r && r.resourceType === 'DiagnosticReport' && r.status !== 'entered-in-error').map(r => {
      const cats = (r.category || []).flatMap(c => codings(c).map(x => lc(x.code + ' ' + (x.display || '')))).join(' ');
      const name = ccText(r.code);
      const text = [r.conclusion, (r.conclusionCode || []).map(ccText).join(' '),
        (r.presentedForm || []).map(p => (p.data ? b64decode(p.data) : '')).map(stripHtml).join(' ')].filter(Boolean).join(' ');
      return { time: toTime(r.effectiveDateTime || (r.effectivePeriod && r.effectivePeriod.start) || r.issued), name, kind: kindOf(r.code), text,
        imaging: /\brad|imaging|\bri\b|ct\b|x-?ray|mri|ultrasound|\bus\b/.test(cats) || /\b(?:ct|x-?ray|xr|cxr|mri|ultrasound|\bus\b|radiograph|chest)\b/i.test(name) };
    }).filter(r => r.time != null).sort((a, b) => a.time - b.time);
  }
  function parseMeds(list) {
    return (list || []).filter(r => r && r.resourceType === 'MedicationRequest' && r.status === 'active').map(r => {
      const name = ccText(r.medicationCodeableConcept) || (r.medicationReference && r.medicationReference.display) || '';
      const norm = normMed(name);
      return { name, norm, classes: classesOf(norm), authored: toTime(r.authoredOn), sig: (r.dosageInstruction || []).map(d => d.text || '').filter(Boolean).join('; ') };
    }).filter(m => m.name);
  }
  function parseAdmins(list) {
    return (list || []).filter(r => r && r.resourceType === 'MedicationAdministration' && ['completed', 'in-progress'].includes(r.status)).map(r => {
      const name = ccText(r.medicationCodeableConcept) || (r.medicationReference && r.medicationReference.display) || '';
      const norm = normMed(name);
      return { name, norm, classes: classesOf(norm), time: toTime(r.effectiveDateTime || (r.effectivePeriod && r.effectivePeriod.start)) };
    }).filter(a => a.name && a.time != null).sort((a, b) => a.time - b.time);
  }
  function parseConditions(list) {
    return (list || []).filter(r => r && r.resourceType === 'Condition')
      .filter(r => !['entered-in-error', 'refuted'].includes(codings(r.verificationStatus).map(c => c.code)[0]))
      .map(r => {
        const st = codings(r.clinicalStatus).map(c => c.code)[0] || '';
        const cat = (r.category || []).flatMap(c => codings(c).map(x => x.code)).join(' ');
        return { text: ccText(r.code), active: !st || ['active', 'recurrence', 'relapse'].includes(st), encounterDx: /encounter-diagnosis/.test(cat),
          recorded: toTime(r.recordedDate || r.onsetDateTime) };
      }).filter(c => c.text);
  }
  function parseOrders(list) {
    return (list || []).filter(r => r && (r.resourceType === 'ServiceRequest' || r.resourceType === 'Procedure'))
      .filter(r => !['entered-in-error', 'revoked', 'not-done'].includes(r.status))
      .map(r => ({ name: ccText(r.code), time: toTime(r.authoredOn || r.occurrenceDateTime || r.performedDateTime || (r.performedPeriod && r.performedPeriod.start)) }))
      .filter(o => o.time != null);
  }

  // ------------------------------------------------------------------
  // Context
  // ------------------------------------------------------------------
  function buildContext(r, opts) {
    opts = opts || {};
    const now = opts.now != null ? opts.now : Date.now();
    const lookbackDays = opts.lookbackDays || CONFIG.lookbackDays;
    const enc = (r.encounters || []).filter(e => e && e.resourceType === 'Encounter')
      .map(e => ({ start: toTime(e.period && e.period.start), status: e.status })).filter(e => e.start != null && e.start <= now).sort((a, b) => b.start - a.start);
    const cur = enc.find(e => ['in-progress', 'arrived', 'onleave'].includes(e.status)) || enc[0] || null;
    const admitTime = cur ? cur.start : null;
    const from = Math.min(now - lookbackDays * DAY, admitTime || Infinity);
    const patient = r.patient || null;
    const ctx = {
      now, from, lookbackDays, admitTime, patient,
      age: patient && patient.birthDate ? ageAt(patient.birthDate, now) : null,
      meds: parseMeds(r.medRequests), admins: r.medAdmins == null ? null : parseAdmins(r.medAdmins),
      obs: parseObservations(r.observations).filter(o => o.time >= from - 2 * DAY),
      reports: parseReports(r.reports), orders: parseOrders(r.orders), conditions: parseConditions(r.conditions),
      notes: r.notes == null ? null : r.notes.filter(n => n.time >= from && n.time <= now).sort((a, b) => a.time - b.time),
      failed: uniq((r.failed || []).concat(r.pending || [])), pending: (r.pending || []).slice(), reasons: r.reasons || {},
      chosenDx: opts.chosenDx || null
    };
    ctx.has = l => !ctx.failed.includes(l);
    ctx.series = k => ctx.obs.filter(o => o.kind === k && o.value != null);
    ctx.textObs = k => ctx.obs.filter(o => o.kind === k);
    ctx.medsIn = c => ctx.meds.filter(m => m.classes[c]);
    // Day count: from admission; without an admission date, from the first antibiotic order in the window.
    const abxStart = minBy(ctx.medsIn('antibiotic').filter(m => m.authored != null), m => m.authored);
    ctx.day0 = admitTime != null ? admitTime : (abxStart ? abxStart.authored : null);
    ctx.day0Source = admitTime != null ? 'admission' : (abxStart ? 'first antibiotic order' : null);
    ctx.hospitalDay = ctx.day0 != null ? Math.floor((now - ctx.day0) / DAY) + 1 : null;
    ctx.cultures = kind => [
      ...ctx.textObs(kind).map(o => ({ time: o.time, text: (o.display + ' ' + o.text).trim() })),
      ...ctx.reports.filter(x => x.kind === kind).map(x => ({ time: x.time, text: (x.name + ' ' + x.text).trim() }))
    ].sort((a, b) => a.time - b.time);
    return ctx;
  }

  const R = (status, title, summary, evidence, extra) =>
    Object.assign({ status, title, summary, evidence: [].concat(evidence || []).filter(Boolean) }, extra || {});
  const waiting = (ctx, labels) => labels.some(l => ctx.pending.includes(l));
  const failedOf = (ctx, labels) => labels.filter(l => !ctx.has(l) && !ctx.pending.includes(l));

  // ------------------------------------------------------------------
  // 1. Not improving
  // ------------------------------------------------------------------
  const TIMEOUT_QUESTIONS = [
    'Is the diagnosis right? Re-read the imaging and the admission story; consider heart failure, PE, malignancy, vasculitis or drug reaction.',
    'Is it the right organism and drug? Check cultures and sensitivities; consider resistant, atypical, fungal or viral causes.',
    'Is the source controlled? Abscess, empyema, obstructed urinary or biliary tract, infected line or device.',
    'Is this a new hospital problem? C. difficile, VTE, aspiration, line infection, CAUTI, pressure injury.',
    'Could it be the treatment? Drug fever, adverse reaction, interaction, withdrawal.',
    'Is it not infection at all? Gout or pseudogout, pancreatitis, transfusion reaction, adrenal insufficiency, thyroid storm.'
  ];

  function notImproving(ctx) {
    const need = ['Lab results'];
    if (waiting(ctx, need)) return R('loading', 'Not improving', 'Waiting for data to load…');
    if (failedOf(ctx, need).length) return R('unknown', 'Not improving', 'Couldn’t check: vital signs and labs didn’t load');
    if (ctx.hospitalDay == null) return R('unknown', 'Not improving', 'Couldn’t tell the hospital day (no admission date or antibiotic start found)');
    if (ctx.hospitalDay < CONFIG.notImprovingDay)
      return R('na', 'Not improving', 'Day ' + ctx.hospitalDay + ' (from ' + ctx.day0Source + '): too early to judge, checked from day ' + CONFIG.notImprovingDay);
    const since24 = ctx.now - DAY, since48 = ctx.now - 2 * DAY;
    const signs = [], good = [];
    const temps = ctx.series('temp').filter(o => o.time >= since24);
    const fever = temps.filter(o => o.value >= CONFIG.feverC);
    if (fever.length) signs.push('Fever: Tmax ' + maxBy(fever, o => o.value).value + ' °C in the last 24 h');
    else if (temps.length) good.push('Afebrile in the last 24 h');
    const trend = (k, label, unit, test) => {
      const s = ctx.series(k);
      const l = last(s);
      if (!l || l.time < since48) return;
      const earlier = s.filter(o => o.time <= l.time - 36 * HOUR);
      const base = earlier.length ? last(earlier) : (s.length > 1 ? s[0] : null);
      const msg = test(l, base);
      const name = label.replace(/ (?:rising|high):$/, '');
      if (msg === true) signs.push(label + ' ' + (base ? base.value + ' → ' : '') + l.value + ' ' + unit + ' (' + fmtTime(l.time) + ')');
      else if (msg === false && base) good.push(name + ' ' + base.value + ' → ' + l.value + ' ' + unit);
    };
    trend('wbc', 'WBC rising:', '×10⁹/L', (l, b) => l.value > CONFIG.wbcHigh ? (!b || l.value - b.value >= CONFIG.wbcRise ? true : null) : (b && b.value > CONFIG.wbcHigh ? false : null));
    trend('creat', 'Creatinine rising:', 'µmol/L', (l, b) => b ? (l.value - b.value >= CONFIG.creatRise ? true : (b.value - l.value >= CONFIG.creatRise ? false : null)) : null);
    trend('lactate', 'Lactate high:', 'mmol/L', (l, b) => l.value >= CONFIG.lactateHigh ? true : (b && b.value >= CONFIG.lactateHigh ? false : null));
    trend('crp', 'CRP rising:', 'mg/L', (l, b) => b ? (l.value > b.value * 1.2 && l.value > 20 ? true : (l.value < b.value * 0.7 ? false : null)) : null);
    const o2 = ctx.series('o2flow');
    if (o2.length >= 2) {
      const l = last(o2), firstDay = o2.filter(o => o.time <= l.time - DAY);
      const b = firstDay.length ? last(firstDay) : o2[0];
      if (l.time >= since24 && l.value > b.value) signs.push('More oxygen: ' + b.value + ' → ' + l.value + ' L/min');
      else if (b.value > l.value) good.push('Less oxygen: ' + b.value + ' → ' + l.value + ' L/min');
    }
    const hr = ctx.series('hr').filter(o => o.time >= since24);
    if (hr.length >= 2 && hr.filter(o => o.value > CONFIG.hrHigh).length / hr.length >= 0.5) signs.push('Heart rate over ' + CONFIG.hrHigh + ' on ' + hr.filter(o => o.value > CONFIG.hrHigh).length + ' of ' + hr.length + ' readings in 24 h');
    const rr = ctx.series('rr').filter(o => o.time >= since24);
    if (rr.length >= 2 && rr.filter(o => o.value > CONFIG.rrHigh).length / rr.length >= 0.5) signs.push('Respiratory rate over ' + CONFIG.rrHigh + ' on most readings in 24 h');
    const dayNote = 'Hospital day ' + ctx.hospitalDay + ' (from ' + ctx.day0Source + ')';
    if (!signs.length) {
      if (!temps.length && !ctx.series('wbc').length) return R('unknown', 'Not improving', dayNote + ': no recent temperatures or WBC to judge');
      return R('ok', 'Not improving', dayNote + ': no signs of failure to improve', good);
    }
    return R('review', 'Not improving', dayNote + ' and ' + (signs.length === 1 ? 'one sign' : signs.length + ' signs') + ' of not improving. Take a diagnostic time-out:',
      signs.concat(good.length ? ['Improving: ' + good.join('; ')] : []), { checklist: TIMEOUT_QUESTIONS.map(q => ({ text: q, state: 'ask' })) });
  }

  // ------------------------------------------------------------------
  // 2. Can't-miss bundles
  // ------------------------------------------------------------------
  const RX = {
    sAureus: /staph(?:ylococcus)?\.? aureus|\bMRSA\b|\bMSSA\b|S\.? ?aureus/i,
    mrsa: /\bMRSA\b|methicillin[- ]resistant|oxacillin[^.;\n]{0,15}\bR\b|oxacillin resistant/i,
    mssa: /\bMSSA\b|methicillin[- ]susceptible|methicillin[- ]sensitive|oxacillin[^.;\n]{0,15}\bS\b/i,
    candida: /candida|yeast/i,
    noGrowth: /no growth|negative|no organisms/i,
    idConsult: /infectious diseases?|\bID (?:consult|service|team|fellow|recommend)|ID following|seen by ID/i,
    echo: /\becho(?:cardiogram)?\b|\bTTE\b|\bTEE\b|transthoracic|transesophageal/i,
    ophtho: /ophthalmolog|fundoscop|dilated (?:eye|fundus) exam|eye exam/i,
    lineOut: /(?:line|PICC|catheter|CVC|port)\b[^.\n]{0,30}\b(?:removed|pulled|discontinued|exchanged)/i,
    confusion: /confus|delirium|disorient|altered mental|encephalopath|agitat/i,
    alcohol: /alcohol use|alcohol dependence|alcoholism|\bETOH\b|heavy drink|drinks? (?:\d+(?:-\d+)?[^.;\n]{0,20}|daily|heavily)|alcohol withdrawal|\bAUD\b/i,
    malnutrition: /malnutrition|cachexi|bariatric|hyperemesis|anorexia nervosa|refeeding/i,
    backPain: /back pain|spinal pain|neck pain|tender(?:ness)? (?:over|of) the spine|spinous process tender/i,
    pwid: /injection drug|IVDU|\bPWID\b|IV drug use|injects?/i,
    spineImaging: /\bMRI\b[^.\n]{0,40}(?:spine|lumbar|thoracic|cervical)|(?:spine|lumbar|thoracic|cervical)[^.\n]{0,40}\bMRI\b/i,
    neuroExam: /neuro(?:logical)? exam|power \d\/5|strength \d\/5|saddle anesthesia|bladder|bowel incontinence|urinary retention/i
  };
  const stateOf = ok => (ok ? 'done' : 'missing');

  function bundles(ctx) {
    const out = [];
    const need = ['Microbiology reports', 'Lab results', 'Active medications'];
    if (waiting(ctx, need)) return [R('loading', 'Can’t-miss checks', 'Waiting for data to load…')];
    const notes = ctx.notes || [];
    const notesOk = ctx.notes != null;
    const unk = notesOk ? 'missing' : 'unknown';
    const after = t => ({ after: t });
    const has = (re, t) => notesOk && findInNotes(notes, re, after(t)).length > 0;

    // S. aureus bacteremia
    const blood = ctx.cultures('bloodCulture');
    const sab = blood.filter(c => RX.sAureus.test(c.text) && !/coagulase[- ]negative/i.test(c.text));
    if (sab.length) {
      const first = sab[0];
      const isMRSA = sab.some(c => RX.mrsa.test(c.text)), isMSSA = !isMRSA && sab.some(c => RX.mssa.test(c.text));
      const repeat = blood.filter(c => c.time > first.time + 12 * HOUR);
      const repeatNeg = repeat.filter(c => RX.noGrowth.test(c.text) && !RX.sAureus.test(c.text));
      const echoDone = ctx.reports.some(x => x.time >= first.time && RX.echo.test(x.name)) || ctx.orders.some(o => o.time >= first.time && RX.echo.test(o.name)) || has(RX.echo, first.time);
      const idDone = ctx.orders.some(o => o.time >= first.time && RX.idConsult.test(o.name)) || has(RX.idConsult, first.time);
      const bl = ctx.medsIn('antiStaphBetaLactam'), mrsaDrug = ctx.medsIn('mrsaActive');
      let abx;
      if (isMRSA) abx = { text: 'MRSA: on vancomycin or daptomycin' + (mrsaDrug.length ? ' (' + mrsaDrug.map(m => m.classes.mrsaActive[0]).join(', ') + ')' : ''), state: stateOf(mrsaDrug.length) };
      else if (isMSSA) abx = { text: 'MSSA: switch to cefazolin or cloxacillin, which work better than vancomycin or ceftriaxone' + (bl.length ? ' (on ' + bl.map(m => m.classes.antiStaphBetaLactam[0]).join(', ') + ')' : ''), state: stateOf(bl.length) };
      else abx = { text: 'Susceptibilities pending: cover MRSA (vancomycin) until known', state: stateOf(mrsaDrug.length || bl.length) };
      out.push(R('review', 'Staphylococcus aureus in a blood culture', 'Never a contaminant. Standard bundle:', ['Positive blood culture ' + fmtTime(first.time) + ': ' + first.text.replace(/^\s*blood culture\s*/i, '').slice(0, 90)], {
        checklist: [
          { text: 'Infectious diseases consult', state: notesOk || ctx.orders.length ? stateOf(idDone) : 'unknown' },
          { text: 'Repeat blood cultures until negative' + (repeatNeg.length ? ' (negative ' + fmtTime(last(repeatNeg).time) + ')' : repeat.length ? ' (repeat drawn, still positive or pending)' : ''), state: repeatNeg.length ? 'done' : (repeat.length ? 'pending' : 'missing') },
          { text: 'Echocardiogram (TEE if high risk: device, prosthetic valve, persistent bacteremia)', state: notesOk ? stateOf(echoDone) : 'unknown' },
          abx,
          { text: 'Find and control the source; remove infected lines', state: 'ask' },
          { text: 'Duration from the first negative culture: at least 14 days IV if uncomplicated, longer if complicated', state: 'ask' }
        ] }));
    }
    // Candidemia
    const cand = blood.filter(c => RX.candida.test(c.text));
    if (cand.length) {
      const first = cand[0];
      const af = ctx.medsIn('antifungal');
      out.push(R('review', 'Candida in a blood culture', 'Never a contaminant. Standard bundle:', ['Positive blood culture ' + fmtTime(first.time)], {
        checklist: [
          { text: 'Antifungal started (an echinocandin first)' + (af.length ? ' (' + af.map(m => m.classes.antifungal[0]).join(', ') + ')' : ''), state: stateOf(af.length) },
          { text: 'Remove central lines', state: notesOk ? stateOf(has(RX.lineOut, first.time)) : 'unknown' },
          { text: 'Dilated eye exam (ophthalmology)', state: notesOk ? stateOf(has(RX.ophtho, first.time)) : 'unknown' },
          { text: 'Echocardiogram', state: notesOk ? stateOf(has(RX.echo, first.time) || ctx.reports.some(x => x.time >= first.time && RX.echo.test(x.name))) : 'unknown' },
          { text: 'Repeat blood cultures until negative', state: blood.some(c => c.time > first.time + 12 * HOUR && RX.noGrowth.test(c.text)) ? 'done' : 'missing' },
          { text: 'Infectious diseases consult', state: notesOk ? stateOf(has(RX.idConsult, first.time)) : 'unknown' }
        ] }));
    }
    // Refractory hypotension
    const sbpLow = ctx.series('sbp').filter(o => o.time >= ctx.now - DAY && o.value < CONFIG.sbpLow);
    const press = ctx.medsIn('vasopressor');
    if (sbpLow.length >= 2 || press.length) {
      const steroids = ctx.medsIn('steroid');
      const cort = ctx.series('cortisol');
      const hgb = ctx.series('hgb');
      const hgbDrop = hgb.length >= 2 && hgb[0].value - last(hgb).value >= 20;
      out.push(R('review', 'Persistent low blood pressure', 'Look beyond sepsis and dehydration:', [
        press.length ? 'On ' + press.map(m => m.classes.vasopressor[0]).join(', ') : 'SBP under ' + CONFIG.sbpLow + ' on ' + sbpLow.length + ' readings in 24 h (lowest ' + minBy(sbpLow, o => o.value).value + ')'
      ], { checklist: [
        { text: 'Adrenal insufficiency: cortisol' + (cort.length ? ' ' + last(cort).value + ' (' + fmtTime(last(cort).time) + ')' : ' not drawn') + (steroids.length ? '; on steroids (' + steroids.map(m => m.classes.steroid[0]).join(', ') + '), so give stress-dose coverage' : ''), state: cort.length ? 'done' : 'missing' },
        { text: 'Bleeding: hemoglobin ' + (hgb.length ? hgb[0].value + ' → ' + last(hgb).value + ' g/L' : 'not available'), state: hgbDrop ? 'missing' : (hgb.length ? 'done' : 'unknown') },
        { text: 'Obstructive shock: PE, tamponade, tension pneumothorax (bedside echo)', state: 'ask' },
        { text: 'Medications: antihypertensives, sedatives, opioids still running', state: 'ask' },
        { text: 'Anaphylaxis or adrenal crisis after a new drug', state: 'ask' }
      ] }));
    }
    // Confusion with alcohol use or malnutrition → thiamine
    const confNotes = notesOk ? findInNotes(notes, RX.confusion) : [];
    const confProb = ctx.conditions.filter(c => c.active && RX.confusion.test(c.text));
    const risk = ctx.conditions.filter(c => c.active && (RX.alcohol.test(c.text) || RX.malnutrition.test(c.text))).map(c => c.text)
      .concat(notesOk ? findInNotes(notes, RX.alcohol).concat(findInNotes(notes, RX.malnutrition)).map(h => h.match) : []);
    if ((confNotes.length || confProb.length) && risk.length) {
      const thiamine = ctx.medsIn('thiamine');
      const mg = ctx.series('mg');
      const glu = ctx.series('glucose');
      out.push(R(thiamine.length ? 'ok' : 'review', 'Confusion with alcohol use or malnutrition', 'Think Wernicke encephalopathy: treat on suspicion.', [
        'Risk: ' + uniq(risk).slice(0, 3).join('; '),
        confNotes.length ? quote(last(confNotes)) : 'Problem list: ' + confProb[0].text
      ], { checklist: [
        { text: 'Thiamine IV, before or with glucose' + (thiamine.length ? ' (' + thiamine[0].sig + ')' : ''), state: stateOf(thiamine.length) },
        { text: 'Magnesium' + (mg.length ? ' ' + last(mg).value + ' mmol/L' : ' not checked') + ' (low Mg blocks thiamine’s effect)', state: mg.length ? (last(mg).value < 0.7 ? 'missing' : 'done') : 'missing' },
        { text: 'Glucose' + (glu.length ? ' ' + last(glu).value + ' mmol/L' : ' not checked'), state: glu.length ? 'done' : 'missing' },
        { text: 'Other causes: withdrawal, head injury (subdural), hepatic encephalopathy, infection', state: 'ask' }
      ] }));
    }
    // Back pain with fever or bacteremia → spinal epidural abscess
    const back = notesOk ? findInNotes(notes, RX.backPain) : [];
    if (back.length) {
      const fever = ctx.series('temp').filter(o => o.time >= ctx.from && o.value >= CONFIG.feverC);
      const bact = blood.filter(c => !RX.noGrowth.test(c.text) && !/pending|in progress/i.test(c.text));
      const pwid = (notesOk && findInNotes(notes, RX.pwid).length) || ctx.conditions.some(c => RX.pwid.test(c.text));
      if (fever.length || bact.length || pwid) {
        const mri = ctx.reports.some(x => RX.spineImaging.test(x.name + ' ' + x.text)) || ctx.orders.some(o => RX.spineImaging.test(o.name)) || has(RX.spineImaging, ctx.from);
        out.push(R(mri ? 'ok' : 'review', 'Back pain with fever, bacteremia or injection drug use', 'Think spinal epidural abscess or vertebral osteomyelitis.', [
          quote(last(back)), [fever.length ? 'Fever ' + maxBy(fever, o => o.value).value + ' °C' : '', bact.length ? 'Positive blood culture' : '', pwid ? 'Injection drug use documented' : ''].filter(Boolean).join('; ')
        ], { checklist: [
          { text: 'Urgent MRI of the whole spine with gadolinium', state: stateOf(mri) },
          { text: 'Documented neurological exam (power, sensation, bladder)', state: notesOk ? stateOf(findInNotes(notes, RX.neuroExam).length) : 'unknown' },
          { text: 'Blood cultures drawn', state: blood.length ? 'done' : 'missing' },
          { text: 'Spine surgery consult if neurological deficit or abscess', state: 'ask' }
        ] }));
      }
    }
    if (!out.length) {
      const gaps = failedOf(ctx, need.concat(['Nursing notes']));
      if (gaps.length) return [R('unknown', 'Can’t-miss checks', 'None triggered, but ' + gaps.join(', ') + ' didn’t load')];
      return [R('ok', 'Can’t-miss checks', 'None triggered: no S. aureus or Candida in blood, no persistent low BP, no confusion with alcohol use, no back pain with fever')];
    }
    return out;
  }

  // ------------------------------------------------------------------
  // 3. Does the data fit?
  // ------------------------------------------------------------------
  // Each rule: detect (working diagnosis text), and for/against findings from labs, reports and notes.
  const FIT_RULES = [
    { id: 'hf', label: 'Heart failure exacerbation', detect: /heart failure|\bCHF\b|\bHF(?:rEF|pEF)?\b|cardiac failure|pulmonary edema|volume overload/i,
      check(ctx) {
        const f = [], a = [];
        const bnp = last(ctx.series('bnp')), nt = last(ctx.series('ntbnp'));
        if (bnp) (bnp.value < 100 ? a : f).push('BNP ' + bnp.value + ' ng/L' + (bnp.value < 100 ? ' (under 100 makes acute heart failure unlikely)' : ''));
        if (nt) (nt.value < 300 ? a : f).push('NT-proBNP ' + nt.value + ' ng/L' + (nt.value < 300 ? ' (under 300 makes acute heart failure unlikely)' : ''));
        const cxr = lastImaging(ctx, /chest|cxr|thorax/i);
        if (cxr) {
          if (/edema|vascular congestion|kerley|cephalization|effusions?/i.test(cxr.text) && !/no (?:pulmonary )?edema/i.test(cxr.text)) f.push('Chest imaging: congestion or effusion (' + fmtTime(cxr.time) + ')');
          else if (/clear|no acute|normal/i.test(cxr.text)) a.push('Chest imaging without congestion (' + fmtTime(cxr.time) + ')');
          if (/consolidation|infiltrate|pneumonia/i.test(cxr.text) && !/no (?:focal )?(?:consolidation|infiltrate)/i.test(cxr.text)) a.push('Chest imaging shows consolidation: consider pneumonia');
        }
        return { f, a, alt: 'Consider COPD or asthma, pneumonia, PE, renal failure with fluid overload, cirrhosis or nephrotic edema.' };
      } },
    { id: 'pna', label: 'Pneumonia', detect: /pneumonia|\bCAP\b|\bHAP\b|chest infection|\bLRTI\b|lower respiratory tract infection/i,
      check(ctx) {
        const f = [], a = [];
        const cxr = lastImaging(ctx, /chest|cxr|thorax|lung/i);
        if (cxr) {
          if (/no (?:focal )?(?:consolidation|infiltrate|airspace)|no acute (?:cardio)?pulmonary|lungs are clear|clear lungs/i.test(cxr.text)) a.push('Chest imaging: no consolidation (' + fmtTime(cxr.time) + ')');
          else if (/consolidation|infiltrate|airspace (?:disease|opacit)|pneumonia/i.test(cxr.text)) f.push('Chest imaging: consolidation (' + fmtTime(cxr.time) + ')');
          if (/edema|vascular congestion|kerley/i.test(cxr.text) && !/no (?:pulmonary )?edema/i.test(cxr.text)) a.push('Chest imaging suggests edema: consider heart failure');
        }
        const pct = last(ctx.series('pct'));
        if (pct) (pct.value < 0.25 ? a : f).push('Procalcitonin ' + pct.value + ' µg/L' + (pct.value < 0.25 ? ' (low: bacterial pneumonia less likely)' : ''));
        const bnp = last(ctx.series('bnp')), nt = last(ctx.series('ntbnp'));
        if ((bnp && bnp.value > 400) || (nt && nt.value > 1800)) a.push((bnp ? 'BNP ' + bnp.value : 'NT-proBNP ' + nt.value) + ' ng/L: consider heart failure');
        const fever = ctx.series('temp').filter(o => o.value >= CONFIG.feverC), wbc = ctx.series('wbc');
        if (!fever.length && wbc.length && wbc.every(o => o.value >= 4 && o.value <= 11)) a.push('No fever and normal WBC since admission');
        return { f, a, alt: 'Consider heart failure, PE, atelectasis, aspiration pneumonitis, malignancy, organizing pneumonia, vasculitis.' };
      } },
    { id: 'uti', label: 'Urinary tract infection', detect: /urinary tract infection|\bUTI\b|pyelonephritis|cystitis|urosepsis/i,
      check(ctx) {
        const f = [], a = [];
        const le = last(ctx.textObs('ule')), nit = last(ctx.textObs('unit')), uwbc = last(ctx.series('uwbc'));
        const neg = o => o && /neg|^0$|none|not detected/i.test(o.text || String(o.value));
        if (le && nit) (neg(le) && neg(nit) ? a : f).push('Urinalysis: leukocyte esterase ' + (le.text || le.value) + ', nitrite ' + (nit.text || nit.value));
        if (uwbc) (uwbc.value <= 5 ? a : f).push('Urine WBC ' + uwbc.value + '/hpf');
        const uc = last(ctx.cultures('urineCulture'));
        if (uc) (RX.noGrowth.test(uc.text) || /mixed|contaminat/i.test(uc.text) ? a : f).push('Urine culture: ' + uc.text.replace(/^\s*urine culture\s*/i, '').slice(0, 80));
        if (ctx.notes) {
          const sx = findInNotes(ctx.notes, /dysuria|urinary (?:frequency|urgency)|suprapubic (?:pain|tenderness)|flank pain|CVA tenderness|costovertebral/i);
          if (sx.length) f.push('Symptoms: ' + quote(last(sx))); else a.push('No urinary symptoms found in notes (bacteriuria alone is not UTI)');
        }
        return { f, a, alt: 'If the patient is confused or fell without urinary symptoms, look for another cause rather than treating bacteriuria.' };
      } },
    { id: 'cell', label: 'Cellulitis', detect: /cellulitis|erysipelas|skin and soft tissue infection|\bSSTI\b/i,
      check(ctx) {
        const f = [], a = [];
        if (ctx.notes) {
          const bilat = findInNotes(ctx.notes, /bilateral(?:ly)?[^.\n]{0,40}(?:leg|lower (?:limb|extremit)|cellulitis|erythema|redness)|(?:both|bilateral) (?:legs|lower legs|shins)/i);
          if (bilat.length) a.push('Bilateral: ' + quote(last(bilat)) + ' (true cellulitis is rarely bilateral)');
        }
        const fever = ctx.series('temp').filter(o => o.value >= CONFIG.feverC), wbc = ctx.series('wbc');
        if (fever.length) f.push('Fever ' + maxBy(fever, o => o.value).value + ' °C');
        if (wbc.length) (last(wbc).value > 11 ? f : a).push('WBC ' + last(wbc).value + ' ×10⁹/L');
        return { f, a, alt: 'Consider venous stasis dermatitis, contact dermatitis, lipodermatosclerosis, DVT, gout, or erythema from edema.' };
      } },
    { id: 'copd', label: 'COPD exacerbation', detect: /COPD exacerbation|AECOPD|exacerbation of COPD|COPD with (?:acute )?exacerbation/i,
      check(ctx) {
        const f = [], a = [];
        const bnp = last(ctx.series('bnp')), nt = last(ctx.series('ntbnp'));
        if ((bnp && bnp.value > 400) || (nt && nt.value > 1800)) a.push((bnp ? 'BNP ' + bnp.value : 'NT-proBNP ' + nt.value) + ' ng/L: heart failure may be contributing');
        const cxr = lastImaging(ctx, /chest|cxr|thorax/i);
        if (cxr && /consolidation|infiltrate|pneumothorax|effusion|edema/i.test(cxr.text) && !/no (?:focal )?(?:consolidation|infiltrate|pneumothorax|effusion|edema)/i.test(cxr.text)) a.push('Chest imaging finding: “' + cxr.text.slice(0, 80) + '…”');
        return { f, a, alt: 'Consider heart failure, pneumonia, PE, pneumothorax, arrhythmia; confirm COPD with spirometry when well.' };
      } },
    { id: 'delirium', label: 'Delirium from infection', detect: /delirium|confusion|altered mental status|encephalopathy/i,
      check(ctx) {
        const f = [], a = [];
        const fever = ctx.series('temp').filter(o => o.value >= CONFIG.feverC), wbc = ctx.series('wbc');
        if (fever.length) f.push('Fever ' + maxBy(fever, o => o.value).value + ' °C');
        else if (ctx.series('temp').length) a.push('No fever recorded');
        if (wbc.length) (last(wbc).value > 11 ? f : a).push('WBC ' + last(wbc).value + ' ×10⁹/L');
        const newDrugs = ctx.admitTime != null ? ctx.medsIn('deliriogenic').filter(m => m.authored != null && m.authored >= ctx.admitTime) : [];
        if (newDrugs.length) a.push('Started this admission, can cause delirium: ' + newDrugs.map(m => m.classes.deliriogenic[0]).join(', '));
        const na = last(ctx.series('na')), ca = last(ctx.series('ca')), glu = ctx.series('glucose').filter(o => o.value < 4);
        if (na && (na.value < 130 || na.value > 148)) a.push('Sodium ' + na.value + ' mmol/L');
        if (ca && ca.value > 2.6) a.push('Calcium ' + ca.value + ' mmol/L');
        if (glu.length) a.push('Glucose as low as ' + minBy(glu, o => o.value).value + ' mmol/L');
        return { f, a, alt: 'Also consider drugs, withdrawal, retention, constipation, pain, hypoxia, stroke, subdural hematoma, metabolic causes.' };
      } },
    { id: 'siadh', label: 'SIADH', detect: /\bSIADH\b|syndrome of inappropriate (?:antidiuretic|ADH)|\bSIAD\b/i,
      check(ctx) {
        const f = [], a = [];
        const uosm = last(ctx.series('uosm')), una = last(ctx.series('una')), sosm = last(ctx.series('sosm'));
        if (sosm) (sosm.value < 275 ? f : a).push('Serum osmolality ' + sosm.value + ' mOsm/kg');
        if (uosm) (uosm.value > 100 ? f : a).push('Urine osmolality ' + uosm.value + ' mOsm/kg' + (uosm.value <= 100 ? ' (dilute urine: consider low solute intake or polydipsia)' : ''));
        if (una) (una.value > 30 ? f : a).push('Urine sodium ' + una.value + ' mmol/L' + (una.value <= 30 ? ' (low: consider hypovolemia)' : ''));
        if (!uosm || !una || !sosm) a.push('Workup incomplete: ' + [!sosm && 'serum osmolality', !uosm && 'urine osmolality', !una && 'urine sodium'].filter(Boolean).join(', ') + ' not found');
        return { f, a, alt: 'SIADH needs euvolemia and exclusion of hypothyroidism, adrenal insufficiency, diuretics and hypovolemia.' };
      } }
  ];
  function lastImaging(ctx, re) {
    return last(ctx.reports.filter(x => x.imaging && re.test(x.name + ' ' + x.text) && x.time >= ctx.from - 2 * DAY));
  }

  function detectWorkingDx(ctx) {
    const found = {};
    const add = (id, src) => { (found[id] = found[id] || []).push(src); };
    for (const c of ctx.conditions) {
      const recent = c.encounterDx || (ctx.admitTime != null && c.recorded != null && c.recorded >= ctx.admitTime - DAY);
      if (!recent || !c.active) continue;
      FIT_RULES.forEach(r => { if (r.detect.test(c.text)) add(r.id, (c.encounterDx ? 'Encounter diagnosis: ' : 'Problem list: ') + c.text); });
    }
    const IMP = /(?:impression|assessment|working diagnosis|diagnos[ie]s|admitted (?:with|for)|admit(?:ting)? diagnosis|a\/p|plan)\s*[:\-]?\s*([^\n]{0,200})/gi;
    for (const n of ctx.notes || []) {
      let m;
      IMP.lastIndex = 0;
      while ((m = IMP.exec(n.text || ''))) {
        const seg = m[1];
        FIT_RULES.forEach(r => {
          const mm = seg.match(r.detect);
          const after = seg.slice(mm ? mm.index + mm[0].length : 0, (mm ? mm.index + mm[0].length : 0) + 25);
          if (mm && !NEGATION.test(seg.slice(Math.max(0, mm.index - 30), mm.index)) && !/^\s*(?:was |is |has been )?(?:ruled out|excluded|unlikely|resolved|not (?:likely|supported))/i.test(after))
            add(r.id, (n.title || 'Note') + ', ' + fmtTime(n.time) + ': “' + seg.trim().slice(0, 80) + (seg.trim().length > 80 ? '…' : '') + '”');
        });
      }
    }
    return found;
  }

  function dataFit(ctx) {
    const need = ['Lab results', 'Problem list', 'Nursing notes'];
    if (waiting(ctx, need)) return { items: [R('loading', 'Does the data fit?', 'Waiting for data to load…')], detected: {} };
    const detected = detectWorkingDx(ctx);
    const chosen = ctx.chosenDx || Object.keys(detected);
    if (!chosen.length) {
      const gaps = failedOf(ctx, need);
      return { detected, items: [R(gaps.length ? 'unknown' : 'na', 'Does the data fit?',
        gaps.length ? 'No working diagnosis found, and ' + gaps.join(', ') + ' didn’t load. Pick one below.' : 'No working diagnosis this check covers was found. Pick one below.')] };
    }
    const items = chosen.map(id => {
      const rule = FIT_RULES.find(r => r.id === id);
      if (!rule) return null;
      const res = rule.check(ctx);
      const src = detected[id] ? detected[id][0] : 'Chosen by you';
      const st = res.a.length ? 'review' : (res.f.length ? 'ok' : 'unknown');
      const summary = res.a.length ? (res.a.length === 1 ? '1 finding argues against it' : res.a.length + ' findings argue against it') : (res.f.length ? 'The findings available fit' : 'Not enough data to judge');
      return R(st, rule.label, summary, [], { source: src, against: res.a, forIt: res.f, alt: res.a.length ? res.alt : '' });
    }).filter(Boolean);
    return { detected, items };
  }

  // ------------------------------------------------------------------
  // 4. Unexplained results
  // ------------------------------------------------------------------
  const UNEXPLAINED = [
    { kind: 'ca', label: 'High calcium', test: v => v > 2.6, fmt: v => v + ' mmol/L', mention: /hypercalc|calcium|\bCa\b/i, next: 'PTH, PTHrP, vitamin D, SPEP; look for malignancy' },
    { kind: 'ica', label: 'High ionized calcium', test: v => v > 1.32, fmt: v => v + ' mmol/L', mention: /hypercalc|calcium/i, next: 'PTH, PTHrP, vitamin D' },
    { kind: 'alp', label: 'High ALP', test: v => v > 150, fmt: v => v + ' U/L', mention: /alk(?:aline)? phos|\bALP\b|cholesta|liver enzymes|LFTs?/i, next: 'GGT, liver ultrasound; bone source if GGT normal' },
    { kind: 'alt', label: 'High ALT', test: v => v > 120, fmt: v => v + ' U/L', mention: /\bALT\b|transaminas|liver enzymes|LFTs?|hepatitis/i, next: 'Drugs, viral hepatitis, ischemia, ultrasound' },
    { kind: 'bili', label: 'High bilirubin', test: v => v > 40, fmt: v => v + ' µmol/L', mention: /bilirubin|jaundice|hyperbili|icter/i, next: 'Direct fraction, hemolysis screen, liver ultrasound' },
    { kind: 'hgb', label: 'Anemia', test: v => v < 100, fmt: v => v + ' g/L', mention: /anemi|anaemi|\bHg?b\b|hemoglobin|transfus|blood loss|bleed/i, next: 'MCV, iron studies, B12, reticulocytes, look for bleeding' },
    { kind: 'plt', label: 'Platelets abnormal', test: v => v < 100 || v > 600, fmt: v => v + ' ×10⁹/L', mention: /thrombocyto|platelet|\bplt\b|\bHIT\b|\bITP\b/i, next: 'Drugs, HIT if on heparin, smear' },
    { kind: 'eos', label: 'Eosinophilia', test: v => v > 1.5, fmt: v => v + ' ×10⁹/L', mention: /eosinophil/i, next: 'Drug reaction (DRESS), parasites, adrenal insufficiency, vasculitis' },
    { kind: 'na', label: 'Sodium abnormal', test: v => v < 130 || v > 148, fmt: v => v + ' mmol/L', mention: /hyponat|hypernat|sodium|\bNa\b|SIAD/i, next: 'Volume status, serum and urine osmolality, urine sodium' },
    { kind: 'k', label: 'Potassium abnormal', test: v => v < 3.0 || v > 5.5, fmt: v => v + ' mmol/L', mention: /hypokal|hyperkal|potassium|\bK\+?\b/i, next: 'ECG, magnesium, review drugs' },
    { kind: 'inr', label: 'High INR (not on warfarin)', test: (v, ctx) => v > 1.5 && !ctx.medsIn('anticoag').length, fmt: v => v, mention: /\bINR\b|coagulopath|vitamin K/i, next: 'Liver disease, vitamin K deficiency, DIC' },
    { kind: 'tsh', label: 'TSH abnormal', test: v => v < 0.1 || v > 10, fmt: v => v + ' mU/L', mention: /\bTSH\b|thyroid/i, next: 'Free T4; repeat after acute illness if mild' },
    { kind: 'lactate', label: 'High lactate', test: v => v >= 2, fmt: v => v + ' mmol/L', mention: /lactat/i, next: 'Hypoperfusion, sepsis, ischemia, drugs (metformin)' },
    { kind: 'glucose', label: 'Low glucose', test: v => v < 4, fmt: v => v + ' mmol/L', mention: /hypoglyc|glucose|\bBG\b|sugar/i, next: 'Drugs, sepsis, liver failure, adrenal insufficiency' }
  ];
  const IMAGING_FOLLOWUP = /recommend(?:ed|s)?[^.\n]{0,60}(?:follow[- ]?up|further (?:evaluation|imaging)|\bCT\b|\bMRI\b|ultrasound|dedicated)|incidental(?:ly)?|indeterminate|suspicious for (?:malignancy|neoplasm)|\b(?:nodule|mass|lesion)\b/i;
  const IMAGING_MENTION = /nodule|incidental|mass|lesion|follow[- ]?up (?:imaging|CT|scan)|radiology recommend/i;

  function unexplained(ctx) {
    const need = ['Lab results', 'Nursing notes'];
    if (waiting(ctx, need)) return [R('loading', 'Unexplained results', 'Waiting for data to load…')];
    if (!ctx.has('Lab results')) return [R('unknown', 'Unexplained results', 'Couldn’t check: labs didn’t load')];
    const notesOk = ctx.notes != null;
    const out = [];
    for (const u of UNEXPLAINED) {
      const abn = ctx.series(u.kind).filter(o => o.time >= ctx.from && u.test(o.value, ctx));
      if (!abn.length) continue;
      const worst = u.kind === 'hgb' || (u.kind === 'na' && abn.some(o => o.value < 130)) || u.kind === 'glucose' ? minBy(abn, o => o.value) : maxBy(abn, o => o.value);
      const firstAbn = abn[0];
      const mentioned = notesOk ? findInNotes(ctx.notes, u.mention, { after: firstAbn.time - 12 * HOUR, allowNegated: true }) : [];
      if (mentioned.length) continue;
      out.push(R(notesOk ? 'review' : 'unknown', u.label + ': ' + u.fmt(worst.value),
        notesOk ? 'Not mentioned in any note since ' + fmtTime(firstAbn.time) : 'Couldn’t check notes', [abn.length > 1 ? abn.length + ' abnormal results, worst on ' + fmtTime(worst.time) : 'Result on ' + fmtTime(worst.time)],
        { next: u.next }));
    }
    for (const rep of ctx.reports.filter(x => x.imaging && x.time >= ctx.from)) {
      const m = rep.text.match(IMAGING_FOLLOWUP);
      if (!m) continue;
      if (/no (?:suspicious |focal )?(?:nodule|mass|lesion)s?/i.test(rep.text) && !/recommend/i.test(rep.text)) continue;
      const mentioned = notesOk ? findInNotes(ctx.notes, IMAGING_MENTION, { after: rep.time, allowNegated: true }) : [];
      if (mentioned.length) continue;
      const s = Math.max(0, m.index - 60), e = Math.min(rep.text.length, m.index + 140);
      out.push(R(notesOk ? 'review' : 'unknown', 'Imaging finding to follow up: ' + (rep.name || 'report'),
        notesOk ? 'Not mentioned in any note since the report' : 'Couldn’t check notes',
        ['“' + (s > 0 ? '…' : '') + rep.text.slice(s, e).replace(/\s+/g, ' ').trim() + '…” (' + fmtTime(rep.time) + ')'],
        { next: 'Act on it now, or put it in the discharge summary and tell the family doctor' }));
    }
    if (!out.length) return [R(notesOk ? 'ok' : 'unknown', 'Unexplained results', notesOk ? 'Every abnormal result checked is mentioned in a note' : 'Couldn’t check notes')];
    return out;
  }

  // ------------------------------------------------------------------
  // Evaluate
  // ------------------------------------------------------------------
  function evaluate(ctx) {
    const safe = (fn, title) => { try { return fn(); } catch (e) { if (typeof console !== 'undefined') console.warn('[dx] ' + title, e); return R('unknown', title, 'Couldn’t check (error)'); } };
    const ni = safe(() => notImproving(ctx), 'Not improving');
    const bu = safe(() => bundles(ctx), 'Can’t-miss checks');
    const fit = safe(() => dataFit(ctx), 'Does the data fit?');
    const ux = safe(() => unexplained(ctx), 'Unexplained results');
    const sections = [
      { id: 'improving', title: '1. Not improving', items: [].concat(ni) },
      { id: 'bundles', title: '2. Can’t-miss checks', items: [].concat(bu) },
      { id: 'fit', title: '3. Does the data fit the working diagnosis?', items: fit.items || [].concat(fit), detected: fit.detected || {} },
      { id: 'unexplained', title: '4. Unexplained results', items: [].concat(ux) }
    ];
    const all = sections.flatMap(s => s.items);
    return { ctx, sections, counts: { review: all.filter(i => i.status === 'review').length },
      failed: ctx.failed.filter(f => !ctx.pending.includes(f)), pending: ctx.pending, reasons: ctx.reasons };
  }

  // ------------------------------------------------------------------
  // FHIR loading
  // ------------------------------------------------------------------
  function shortError(e) {
    const m = String((e && e.message) || e || 'failed');
    const code = m.match(/^\s*(\d{3})\b/);
    if (code) {
      const c = +code[1];
      if (c >= 502 && c <= 504) return 'Cerner server timed out (' + c + ')';
      if (c === 401 || c === 403) return 'Not allowed (' + c + ') — check the app’s scopes';
      if (c === 400 || c === 422) return 'Search not supported (' + c + ')';
      return 'Server error ' + c;
    }
    return m.length > 120 ? m.slice(0, 120) + '…' : m;
  }
  function withTimeout(p, ms, label) {
    let t;
    return Promise.race([p, new Promise((_, rej) => { t = setTimeout(() => rej(new Error(label + ' timed out after ' + Math.round(ms / 1000) + ' s')), ms); })]).finally(() => clearTimeout(t));
  }
  function throttled(client) {
    let active = 0;
    const queue = [];
    const next = () => {
      while (active < CONFIG.maxParallel && queue.length) {
        const job = queue.shift(); active++;
        Promise.resolve().then(job.fn).then(job.resolve, job.reject).finally(() => { active--; next(); });
      }
    };
    return { patient: client.patient, request: (...a) => new Promise((resolve, reject) => { queue.push({ fn: () => client.request(...a), resolve, reject }); next(); }) };
  }
  async function fhirSearch(client, url, pages) {
    const r = await client.request(url, { pageLimit: pages || 5, flat: true });
    return Array.isArray(r) ? r : (r && r.entry ? r.entry.map(e => e.resource) : []);
  }
  async function noteText(client, doc) {
    const atts = (doc.content || []).map(c => c.attachment).filter(Boolean);
    const att = atts.find(a => /text\/plain/.test(a.contentType || '')) || atts.find(a => /html/.test(a.contentType || '')) || atts[0];
    if (!att) return '';
    let txt = '';
    if (att.data) txt = b64decode(att.data);
    else if (att.url) { const r = await client.request({ url: att.url, headers: { Accept: att.contentType || 'text/plain' } }); txt = typeof r === 'string' ? r : (r && r.data ? b64decode(r.data) : ''); }
    return (/html/.test(att.contentType || '') || /<\w+[^>]*>/.test(txt)) ? stripHtml(txt) : txt;
  }
  async function loadNotes(client, pid, from, to) {
    const docs = await fhirSearch(client, 'DocumentReference?patient=' + pid + '&_count=50', 3);
    const recent = docs.filter(d => d.status !== 'entered-in-error').map(d => ({ d, time: toTime(d.date || (d.context && d.context.period && d.context.period.start)) }))
      .filter(x => x.time != null && x.time >= from && x.time <= to).sort((a, b) => b.time - a.time).slice(0, CONFIG.maxNotes);
    const texts = await Promise.allSettled(recent.map(x => withTimeout(noteText(client, x.d), CONFIG.timeouts.noteMs, 'note')));
    return recent.map((x, i) => ({ time: x.time, title: ccText(x.d.type) || x.d.description || 'Note', text: texts[i].status === 'fulfilled' ? texts[i].value : '' })).filter(n => n.text);
  }

  async function loadResources(rawClient, opts) {
    const client = throttled(rawClient);
    const pid = client.patient.id;
    const from = opts.from, to = opts.to, ge = fhirDate(from - 2 * DAY);
    const failed = [], pending = new Set(), reasons = {};
    const out = { patient: null, encounters: [], medRequests: [], medAdmins: null, observations: [], reports: [], orders: [], conditions: [], notes: null };
    const progress = opts.onProgress || function () {};
    const partial = opts.onPartial || function () {};
    const snapshot = () => Object.assign({}, out, { failed: failed.slice(), pending: Array.from(pending), reasons: Object.assign({}, reasons) });
    const FAILED = {};
    const LABELS = ['Patient', 'Admission', 'Active medications', 'Problem list', 'Lab results', 'Microbiology reports', 'Orders', 'Nursing notes'];
    LABELS.forEach(l => pending.add(l));
    const safe = async (label, fn) => {
      progress(label, 'loading');
      try { const v = await withTimeout(Promise.resolve().then(fn), label === 'Nursing notes' ? CONFIG.timeouts.notesMs : CONFIG.timeouts.searchMs, label); progress(label, 'done', Array.isArray(v) ? v.length : null); return v; }
      catch (e) { if (typeof console !== 'undefined') console.warn('[dx] ' + label + ' failed', e); progress(label, 'failed', null, shortError(e)); reasons[label.replace(' (retry)', '')] = shortError(e); return FAILED; }
    };
    const run = async (label, key, fn, fallback, retryIfQuick) => {
      const t0 = Date.now();
      let v = await safe(label, fn);
      if (v === FAILED && retryIfQuick && Date.now() - t0 < CONFIG.timeouts.searchMs / 2) v = await safe(label + ' (retry)', fn);
      pending.delete(label);
      if (v === FAILED) { failed.push(label); out[key] = fallback; } else { out[key] = v; delete reasons[label]; }
      partial(snapshot());
    };
    const firstWorking = async (urls, pages) => {
      let lastErr;
      const share = Math.floor(CONFIG.timeouts.searchMs / urls.length * 0.9);
      for (const u of urls) { try { return await withTimeout(fhirSearch(client, u, pages), share, 'Search'); } catch (e) { lastErr = e; } }
      throw lastErr;
    };
    const both = async fns => {
      const rs = await Promise.allSettled(fns.map(f => f()));
      const ok = rs.filter(r => r.status === 'fulfilled');
      if (!ok.length) throw rs[0].reason;
      return ok.flatMap(r => r.value);
    };
    await Promise.all([
      run('Patient', 'patient', () => client.patient.read(), null),
      run('Admission', 'encounters', () => firstWorking(['Encounter?patient=' + pid + '&status=in-progress', 'Encounter?patient=' + pid + '&_count=20'], 1), []),
      run('Active medications', 'medRequests', () => fhirSearch(client, 'MedicationRequest?patient=' + pid + '&status=active&_count=100'), [], true),
      run('Problem list', 'conditions', () => both([
        () => firstWorking(['Condition?patient=' + pid + '&category=problem-list-item', 'Condition?patient=' + pid + '&clinical-status=active'], 3),
        () => fhirSearch(client, 'Condition?patient=' + pid + '&category=encounter-diagnosis', 2)
      ]), [], true)
    ]);
    await Promise.all([
      run('Lab results', 'observations', () => both([
        () => fhirSearch(client, 'Observation?patient=' + pid + '&category=laboratory&date=ge' + ge + '&_count=100', 10),
        () => fhirSearch(client, 'Observation?patient=' + pid + '&category=vital-signs&date=ge' + ge + '&_count=100', 10)
      ]), []),
      run('Microbiology reports', 'reports', () => firstWorking(['DiagnosticReport?patient=' + pid + '&date=ge' + ge + '&_count=100'], 5), []),
      run('Orders', 'orders', () => both([
        () => fhirSearch(client, 'ServiceRequest?patient=' + pid + '&_count=100', 3),
        () => fhirSearch(client, 'Procedure?patient=' + pid + '&date=ge' + ge + '&_count=100', 3)
      ]), []),
      run('Nursing notes', 'notes', () => opts.getNotes ? opts.getNotes({ from, to }) : loadNotes(client, pid, from, to), null)
    ]);
    return snapshot();
  }

  // ------------------------------------------------------------------
  // Rendering
  // ------------------------------------------------------------------
  const STATUS = { review: ['Review', 'dx-st-review'], ok: ['OK', 'dx-st-ok'], na: ['Not applicable', 'dx-st-na'], unknown: ['Couldn’t check', 'dx-st-unknown'], loading: ['Loading', 'dx-st-na'] };
  const CHECK = { done: ['✓', 'dx-ck-done', 'Done'], missing: ['!', 'dx-ck-missing', 'Not found'], pending: ['…', 'dx-ck-pending', 'Pending'], unknown: ['?', 'dx-ck-unknown', 'Couldn’t check'], ask: ['○', 'dx-ck-ask', 'Ask yourself'] };

  function itemHtml(i) {
    const s = STATUS[i.status] || STATUS.unknown;
    let h = '<div class="dx-item dx-item-' + i.status + '"><div class="dx-item-head"><span class="dx-badge ' + s[1] + '">' + s[0] + '</span><h4>' + esc(i.title) + '</h4></div>';
    h += '<p class="dx-summary">' + esc(i.summary) + '</p>';
    if (i.source) h += '<p class="dx-source">From ' + esc(i.source) + '</p>';
    if (i.evidence.length) h += '<ul class="dx-evidence">' + i.evidence.map(e => '<li>' + esc(e) + '</li>').join('') + '</ul>';
    if (i.against && i.against.length) h += '<p class="dx-sub dx-against">Argues against</p><ul class="dx-evidence">' + i.against.map(e => '<li>' + esc(e) + '</li>').join('') + '</ul>';
    if (i.forIt && i.forIt.length) h += '<p class="dx-sub dx-for">Fits</p><ul class="dx-evidence">' + i.forIt.map(e => '<li>' + esc(e) + '</li>').join('') + '</ul>';
    if (i.alt) h += '<p class="dx-action">→ ' + esc(i.alt) + '</p>';
    if (i.next) h += '<p class="dx-action">→ ' + esc(i.next) + '</p>';
    if (i.checklist) h += '<ul class="dx-checklist">' + i.checklist.map(c => { const k = CHECK[c.state] || CHECK.ask; return '<li class="' + k[1] + '"><span class="dx-ck" title="' + k[2] + '" aria-label="' + k[2] + '">' + k[0] + '</span>' + esc(c.text) + '</li>'; }).join('') + '</ul>';
    return h + '</div>';
  }

  function render(result) {
    const r = result, h = ['<div class="dx">'];
    if (r.pending.length) h.push('<div class="dx-pending" role="status"><span class="dx-spinner" aria-hidden="true"></span><strong>Still loading:</strong> ' + r.pending.map(esc).join(', ') + '. Results update when they arrive.</div>');
    if (r.failed.length) {
      const why = r.reasons || {};
      h.push('<div class="dx-incomplete" role="alert"><strong>Incomplete:</strong> some data didn’t load. <button type="button" class="dx-retry">Try again</button><ul class="dx-fail-list">' +
        r.failed.map(f => '<li>' + esc(f) + (why[f] ? ' — ' + esc(why[f]) : '') + '</li>').join('') + '</ul></div>');
    }
    const c = r.ctx;
    h.push('<div class="dx-metrics"><div class="dx-metric ' + (r.counts.review ? 'dx-metric-bad' : (r.pending.length || r.failed.length ? '' : 'dx-metric-good')) + '"><div class="dx-metric-label">Prompts to review</div><div class="dx-metric-value">' + r.counts.review + '</div></div>' +
      '<div class="dx-metric"><div class="dx-metric-label">Hospital day</div><div class="dx-metric-value">' + (c.hospitalDay != null ? c.hospitalDay : '—') + '</div><div class="dx-metric-sub">' + esc(c.day0Source ? 'from ' + c.day0Source : 'admission date not found') + '</div></div></div>');
    for (const s of r.sections) {
      h.push('<section class="dx-section"><h3 class="dx-strip">' + esc(s.title) + '</h3>');
      if (s.id === 'fit') {
        const chosen = c.chosenDx || Object.keys(s.detected || {});
        h.push('<div class="dx-picker"><span>Working diagnosis:</span>' + FIT_RULES.map(f => '<label><input type="checkbox" class="dx-pick" value="' + f.id + '"' + (chosen.includes(f.id) ? ' checked' : '') + '> ' + esc(f.label) +
          (s.detected && s.detected[f.id] ? ' <em>(found)</em>' : '') + '</label>').join('') + '</div>');
      }
      h.push(s.items.map(itemHtml).join(''));
      h.push('</section>');
    }
    h.push('<p class="dx-disclaimer">Prompts for a second look, not diagnoses. Built from data available through FHIR: labs, vitals, reports, orders and the last ' + c.lookbackDays +
      ' days of notes. A prompt is only as good as the charting; check the chart before acting.</p></div>');
    return h.join('');
  }

  // ------------------------------------------------------------------
  // Mount
  // ------------------------------------------------------------------
  async function mount(container, client, opts) {
    opts = opts || {};
    const gen = (container.__dxGen || 0) + 1;
    container.__dxGen = gen;
    const current = () => container.__dxGen === gen;
    const hasPrev = !!container.querySelector('.dx-metrics');
    const now = opts.now || Date.now();
    const lookbackDays = opts.lookbackDays || CONFIG.lookbackDays;
    const from = now - lookbackDays * DAY;
    let partialShown = false, lastRes = null;
    const status = {};
    const strip = (text, cls) => {
      const root = container.querySelector('.dx'); if (!root) return;
      let el = root.querySelector('.dx-updating');
      if (!el) { el = document.createElement('div'); el.setAttribute('role', 'status'); root.insertBefore(el, root.firstChild); }
      el.className = 'dx-updating' + (cls ? ' ' + cls : ''); el.textContent = text;
    };
    const drawProgress = () => {
      if (!current() || partialShown) return;
      const keys = Object.keys(status);
      if (hasPrev) { strip('Updating… ' + keys.filter(k => status[k].state !== 'loading').length + ' of ' + keys.length + ' loaded'); return; }
      const icon = { loading: '…', done: '✓', failed: '✗' };
      container.innerHTML = '<div class="dx"><p class="dx-loading">Loading diagnosis check…</p><ul class="dx-progress">' +
        keys.map(k => '<li class="dx-prog-' + status[k].state + '"><span>' + icon[status[k].state] + '</span>' + esc(k) + (status[k].state === 'failed' ? ' — ' + esc(status[k].msg || '') : '') + '</li>').join('') + '</ul></div>';
    };
    const show = res => {
      lastRes = res;
      const chosenDx = container.__dxChosen || null;
      const result = evaluate(buildContext(res, { now, lookbackDays, chosenDx }));
      container.innerHTML = render(result);
      const rb = container.querySelector('.dx-retry');
      if (rb) rb.addEventListener('click', () => { mount(container, client, Object.assign({}, opts, { now: undefined })).catch(() => {}); });
      container.querySelectorAll('.dx-pick').forEach(cb => cb.addEventListener('change', () => {
        container.__dxChosen = Array.from(container.querySelectorAll('.dx-pick')).filter(x => x.checked).map(x => x.value);
        show(lastRes);
      }));
      return result;
    };
    const onProgress = (label, state, count, msg) => { status[label] = { state, count, msg }; drawProgress(); };
    const onPartial = snap => {
      if (!current() || hasPrev) return;
      if (!['Active medications', 'Problem list', 'Lab results'].some(l => !snap.pending.includes(l))) return;
      partialShown = true; show(snap);
    };
    const loader = opts.loader || ((f, t) => loadResources(client, { from: f, to: t, getNotes: opts.getNotes, onProgress, onPartial }));
    if (hasPrev) strip('Updating…'); else container.innerHTML = '<div class="dx"><p class="dx-loading">Loading diagnosis check…</p></div>';
    try {
      const res = await loader(from, now);
      if (!current()) return null;
      return show(res);
    } catch (e) {
      if (!current()) return null;
      if (hasPrev) strip('Couldn’t update — showing the previous check. ' + shortError(e), 'dx-updating-error');
      else container.innerHTML = '<div class="dx"><p class="dx-error">Couldn’t load the diagnosis check. ' + esc(shortError(e)) + '</p></div>';
      throw e;
    }
  }

  return { CONFIG, FIT_RULES, UNEXPLAINED, mount, loadResources, buildContext, evaluate, render, kindOf, detectWorkingDx };
});
