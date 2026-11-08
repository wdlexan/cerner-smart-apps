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
 *   5. Imaging findings    findings that need a cause (pneumobilia, absent gallbladder, portal gas, free air, bladder air, organ infarcts,
 *                          effusions, pulmonary infarct, adrenal bleed, spinal/psoas collections, venous thrombosis, hydronephrosis,
 *                          bone lesions, lymph nodes, brain bleed/infarct) checked against the chart;
 *                          Rigler's triad (gallstone ileus); CRAB pattern (myeloma); hedged report statements to close the loop on
 *   6. Imaging review      timeline of all studies; organ seen before but absent now; "old" lesion that earlier imaging called normal;
 *                          note calls imaging unremarkable when the report lists findings; left/right mismatch; addenda and
 *                          preliminary reports; imaging ordered with no report; "normal" report that the data argue against
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
    ca: ['17861-6', '2000-8'], ica: ['1994-3', '19072-8'], tp: ['2885-2'], alb: ['1751-7'], alp: ['6768-6'], alt: ['1742-6', '1743-4'],
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
    [/magnesium/, 'mg'], [/total protein|protein,? total/, 'tp'], [/^albumin|albumin,? serum|serum albumin/, 'alb'], [/eosinophil/, 'eos'], [/glucose/, 'glucose'],
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
  const fmtDate = t => { const d = new Date(t); return MONTHS[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear(); };
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
      return { id: r.id, status: r.status, time: toTime(r.effectiveDateTime || (r.effectivePeriod && r.effectivePeriod.start) || r.issued), name, kind: kindOf(r.code), text,
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
      .map(r => ({ type: r.resourceType, name: ccText(r.code), time: toTime(r.authoredOn || r.occurrenceDateTime || r.performedDateTime || (r.performedPeriod && r.performedPeriod.start)) }))
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
      reports: parseReports((r.reports || []).concat(r.pastReports || []).filter((x, i, a) => !x || !x.id || a.findIndex(y => y && y.id === x.id) === i)), orders: parseOrders(r.orders), conditions: parseConditions(r.conditions),
      procedures: (r.procedures || []).filter(x => x && x.resourceType === 'Procedure' && !['entered-in-error', 'not-done'].includes(x.status))
        .map(x => ({ name: [ccText(x.code), (x.note || []).map(n => n.text).join(' ')].filter(Boolean).join(' '), time: toTime(x.performedDateTime || (x.performedPeriod && x.performedPeriod.start)) })).filter(x => x.name),
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
  // 5. Imaging findings: are they accounted for?
  // Findings that always have a cause. Each is "accounted for" only if the chart shows a cause (a note, the problem list or a Procedure).
  // A cause mentioned only as an assumption ("presumed post-cholecystectomy", "correlation for prior sphincterotomy") does not count.
  // UNVERIFIED draft lists written by Claude: edit freely.
  // ------------------------------------------------------------------
  const IMG_FINDINGS = [
    { id: 'pneumobilia', label: 'Pneumobilia (air in the bile ducts)',
      re: /pneumobilia|(?:air|gas) (?:with)?in the (?:central |intrahepatic |extrahepatic |common )*(?:bile ducts?|biliary (?:tree|ducts?))|biliary (?:air|gas)\b/i,
      explain: [['ERCP or sphincterotomy', /\bERCP\b|sphincterotom/i], ['Biliary stent or drain', /biliary stent|\bCBD stent|\bPTBD\b|biliary drain/i],
        ['Biliary-enteric surgery', /whipple|pancreaticoduodenectomy|hepaticojejunostomy|choledocho(?:duodeno|jejuno)stomy|biliary.enteric anastomosis/i]],
      consider: ['Cholecystoenteric fistula and gallstone ileus', 'Emphysematous cholecystitis', 'Cholangitis with gas-forming organisms'],
      next: 'Ask radiology to re-review for a fistula and an ectopic gallstone; correlate with LFTs and the clinical picture' },
    { id: 'gb', label: 'Gallbladder absent or not visualized',
      re: /gall ?bladder (?:is |was )?(?:not (?:seen|visuali[sz]ed|identified)|absent|surgically absent|non-?visuali[sz]ed)|(?:absent|non-?visuali[sz]ed) gall ?bladder|(?:presumed |likely |probabl[ey] )?post-?cholecystectomy/i,
      explain: [['Cholecystectomy', /cholecystectomy|\blap(?:aroscopic)? chole\b/i]],
      consider: ['Contracted gallbladder with a cholecystoenteric fistula (gallstone ileus)', 'Chronic cholecystitis or porcelain gallbladder', 'Gallbladder agenesis (rare)'],
      next: 'Confirm surgical history with the patient; ask radiology whether the gallbladder is contracted around stones or fistulized' },
    { id: 'portalgas', label: 'Portal venous gas', re: /portal (?:venous )?gas|portomesenteric (?:venous )?gas/i, explain: [],
      consider: ['Mesenteric ischemia', 'Severe intra-abdominal infection'], next: 'Urgent: discuss with surgery now' },
    { id: 'pneumatosis', label: 'Pneumatosis intestinalis', re: /pneumatosis/i, explain: [],
      consider: ['Bowel ischemia', 'Benign pneumatosis (diagnosis of exclusion)'], next: 'Urgent: lactate, exam, discuss with surgery' },
    { id: 'freeair', label: 'Free intraperitoneal air', re: /free (?:intraperitoneal )?air|pneumoperitoneum/i,
      explain: [['Recent abdominal surgery, laparoscopy, PEG or peritoneal dialysis', /laparotomy|laparoscop\w* (?:on|this admission|post)|post-?op(?:erative)? day|\bPOD ?\d|\bPEG\b|peritoneal dialysis/i]],
      consider: ['Perforated viscus'], next: 'Urgent: discuss with surgery now' },
    { id: 'bladderair', label: 'Air in the bladder', re: /(?:air|gas) (?:with)?in the (?:urinary )?bladder(?: wall| lumen)?|emphysematous cystitis|pneumaturia/i,
      explain: [['Urinary catheter or recent bladder instrumentation', /foley|urinary catheter|indwelling catheter|suprapubic catheter|cystoscop\w*|\bTURP\b|\bTURBT\b|bladder irrigation/i]],
      consider: ['Colovesical or enterovesical fistula (diverticulitis, Crohn disease, colon cancer)', 'Emphysematous cystitis (often with diabetes)'],
      next: 'Urine culture; look for diverticulitis or colon cancer on the CT; discuss with urology' },
    { id: 'organinfarct', label: 'Splenic or renal infarct', re: /(?:splenic|renal|kidney) infarct\w*|infarct\w* (?:of|in|within) the (?:spleen|(?:left |right )?kidney)|wedge-shaped (?:\w+ )?(?:area|defect|region)s? (?:in|of|within) the (?:spleen|(?:left |right )?kidney)/i,
      explain: [['Atrial fibrillation', /atrial fibrillation|atrial flutter|\bAF\b|a-?fib/i], ['Endocarditis', /endocarditis/i], ['Recent angiography, embolization or vascular procedure', /emboli[sz]ation|angiogra\w*|\bEVAR\b|\bTAVI\b|\bTAVR\b/i], ['Sickle cell disease or a known clotting disorder', /sickle|antiphospholipid|myeloproliferative|JAK2/i]],
      consider: ['Endocarditis (blood cultures x3, echo)', 'Undiagnosed AF or LV thrombus', 'Clotting disorder'],
      next: 'Blood cultures x3, echo (TEE if endocarditis is possible), telemetry or Holter for AF' },
    { id: 'effusion', label: 'New or large pleural or pericardial effusion', re: /(?:new|large|moderate|enlarging|increasing|loculated) (?:\w+ )?(?:pleural|pericardial) effusions?|(?:pleural|pericardial) effusions? (?:is |are |has |have )?(?:new|enlarg\w*|increas\w*|larger|loculated)/i,
      explain: [['Heart failure or volume overload', /heart failure|\bCHF\b|\bHFrEF\b|\bHFpEF\b|volume overload/i], ['Recent cardiac or thoracic surgery', /sternotomy|\bCABG\b|thoracotomy|cardiac surgery|thoracic surgery|pericardiotomy/i],
        ['Known cancer', /carcinoma|cancer|malignan\w*|lymphoma|metasta\w*|mesothelioma|myeloma/i], ['Pneumonia or empyema', /pneumonia|empyema|parapneumonic/i], ['Cirrhosis, nephrotic syndrome or kidney failure', /cirrhosis|nephrotic|dialysis|\bESRD\b|\bESKD\b/i]],
      consider: ['Infection (empyema, TB)', 'Cancer', 'Pulmonary embolism', 'Pericarditis or tamponade (pericardial)'],
      next: 'Consider diagnostic thoracentesis; echo if pericardial, and check for tamponade' },
    { id: 'pulminfarct', label: 'Pulmonary infarct or wedge-shaped opacity', re: /pulmonary infarct\w*|wedge-shaped (?:peripheral |pleural-based )?(?:opacit\w*|consolidation)|hampton'?s hump/i,
      explain: [['Known pulmonary embolism', /pulmonary embol\w*|\bPE\b/i]],
      consider: ['Pulmonary embolism not yet diagnosed', 'Septic emboli (endocarditis, IV drug use)', 'Vasculitis'],
      next: 'CT pulmonary angiogram if not done; leg dopplers; blood cultures if febrile' },
    { id: 'adrenal', label: 'Adrenal hemorrhage', re: /adrenal (?:hemorrhage|haemorrhage|hematoma|haematoma|bleed)/i,
      explain: [['Trauma', /trauma|motor vehicle|\bMVC\b|\bMVA\b/i]],
      consider: ['Anticoagulant-related', 'Sepsis (Waterhouse-Friderichsen)', 'Antiphospholipid syndrome', 'Adrenal insufficiency if bilateral'],
      next: 'If bilateral or hypotensive: cortisol and consider stress-dose steroids now; review anticoagulation' },
    { id: 'collection', label: 'Psoas, paraspinal or epidural collection', re: /(?:psoas|iliopsoas|paraspinal|spinal epidural|epidural) (?:abscess|collection|phlegmon)|(?:abscess|collection|phlegmon) (?:in|within|of|involving) the (?:left |right )?(?:psoas|iliopsoas|epidural space)/i,
      explain: [['Recent spinal procedure or surgery', /laminectomy|discectomy|spinal (?:fusion|surgery)|epidural (?:injection|catheter|anesth\w*|analgesia)|lumbar puncture/i]],
      consider: ['Abscess, often S. aureus (blood cultures)', 'Spinal epidural abscess (neuro exam; MRI of the whole spine)', 'Endocarditis seeding'],
      next: 'Urgent: blood cultures, neuro exam, MRI spine if epidural; discuss with spine surgery or IR' },
    { id: 'veinclot', label: 'Portal, mesenteric or splenic vein thrombosis', re: /(?:portal|superior mesenteric|mesenteric|splenic) vein (?:thrombos\w*|thrombus|occlusion|clot)|\bSMV (?:thrombos\w*|thrombus)|\bPVT\b|portal vein (?:is )?(?:occluded|non-?opacified)/i,
      explain: [['Cirrhosis', /cirrhosis/i], ['Known cancer', /carcinoma|cancer|malignan\w*|lymphoma|metasta\w*|mesothelioma|myeloma/i], ['Pancreatitis or intra-abdominal infection', /pancreatitis|appendicitis|diverticulitis|cholangitis|intra-abdominal (?:abscess|infection)/i], ['Known clotting disorder', /antiphospholipid|factor v leiden|myeloproliferative|JAK2|polycythemia|\bPNH\b/i]],
      consider: ['Clotting disorder (JAK2, PNH, antiphospholipid)', 'Hidden cancer', 'Bowel ischemia if the SMV is involved'],
      next: 'Anticoagulation decision; lactate and abdominal exam for ischemia; consider hematology' },
    { id: 'hydro', label: 'Hydronephrosis', re: /hydronephrosis|hydroureteronephrosis|hydroureter\b/i,
      explain: [['Known stone, stent or nephrostomy', /(?:renal|ureteric|ureteral|kidney) (?:stone|calcul\w*)|nephrolithiasis|urolithiasis|(?:ureteric|ureteral|JJ|double-?J) stent|nephrostomy/i], ['Known urinary retention or enlarged prostate', /urinary retention|\bBPH\b|benign prostatic/i], ['Pregnancy', /pregnan\w*/i]],
      consider: ['Obstruction needing drainage (urgent if infected or with AKI)', 'Pelvic, bladder or retroperitoneal cancer', 'Retroperitoneal fibrosis'],
      next: 'Bladder scan and creatinine trend; urgent urology if fever or AKI' },
    { id: 'bone', label: 'Lytic or blastic bone lesions', re: /(?:lytic|osteolytic|blastic|osteoblastic|sclerotic|permeative|destructive) (?:bone |osseous |skeletal |bony )?lesions?|(?:bone|osseous|skeletal) metasta\w*|pathologic(?:al)? fracture/i,
      explain: [['Known metastatic cancer or myeloma', /carcinoma|cancer|malignan\w*|lymphoma|metasta\w*|mesothelioma|myeloma|plasmacytoma/i], ['Paget disease', /paget/i]],
      consider: ['Myeloma (SPEP, free light chains, calcium, creatinine)', 'Hidden primary cancer (breast, prostate, lung, kidney, thyroid)', 'Pathological fracture (including a hip fracture through a lesion)'],
      next: 'Calcium, SPEP and free light chains, PSA in men; tell orthopedics before fixation; oncology referral' },
    { id: 'nodes', label: 'Enlarged lymph nodes', re: /(?:pathologic(?:al)?(?:ly enlarged)?|enlarged|bulky|necrotic|conglomerate|bulky) (?:\w+ ){0,3}(?:lymph nodes?|nodes|lymphadenopathy)|lymphadenopathy/i,
      explain: [['Known lymphoma, leukemia or cancer', /carcinoma|cancer|malignan\w*|lymphoma|metasta\w*|mesothelioma|myeloma|leuk(?:a)?emia|\bCLL\b/i], ['Known infection or sarcoidosis', /sarcoid\w*|tuberculosis|\bTB\b|\bHIV\b|mononucleosis|\bEBV\b/i]],
      consider: ['Lymphoma or metastatic cancer', 'TB, HIV, sarcoidosis'],
      next: 'Make sure follow-up is booked (biopsy or repeat imaging) and name who owns it in the discharge summary' },
    { id: 'brain', label: 'Intracranial bleed or new brain infarct', re: /(?:intracranial|intracerebral|subdural|subarachnoid|intraparenchymal|intraventricular) (?:hemorrhage|haemorrhage|hematoma|haematoma|bleed)|(?:acute|new|subacute) (?:ischemic |lacunar |cortical |embolic |territorial )?(?:infarct\w*|stroke)|(?:cerebral|cerebellar|brain|lacunar|cortical|embolic|MCA|PCA|ACA) (?:territory )?infarct\w*|\bICH\b|\bSAH\b|\bSDH\b/i,
      explain: [['Known stroke or bleed this admission', /stroke|\bCVA\b|\bTIA\b|subdural|intracranial (?:hemorrhage|haemorrhage|bleed)|\bICH\b|\bSAH\b|\bSDH\b/i], ['Head injury or fall with head strike', /head injury|head trauma|head strike|hit (?:her|his|their) head|\bTBI\b/i]],
      consider: ['Anticoagulant or antiplatelet to hold or reverse', 'Embolic source if infarct (AF, endocarditis)', 'Unwitnessed fall in hospital'],
      next: 'Urgent: review anticoagulants now; neurology or neurosurgery; check for an unwitnessed fall' }
  ];
  const NEG_BEFORE = /\b(?:no|not|never|without|denies|denied|negative for|nil|r\/o|rule out|ruled out)\b[^.;:\n]{0,30}$/i;
  const HEDGE_BEFORE = /\b(?:presum\w*|likely|probabl[ey]|possibl[ey]|query|suspect\w*|favou?r\w*|correlat\w*|\?)[^.;:\n]{0,30}$/i;
  const HEDGE = /presum\w*|clinical(?:ly)? correlat\w*|correlate clinically|favou?red to (?:be|represent)|cannot (?:be )?exclude|likely incidental|probably incidental|incidental(?:ly)?\b|of uncertain significance|indeterminate/i;
  // Sentence around position i. Ends at ". " (not decimals like 2.4), a blank line, or a new numbered/heading line; wrapped lines are joined.
  const BOUND = /\.(?=\s)|\n[ \t]*\n|\n(?=[ \t]*(?:\d+\.\s|[A-Z]))/g;
  const SENT = (t, i) => {
    let s = 0, e = t.length, m; BOUND.lastIndex = 0;
    while ((m = BOUND.exec(t))) { if (m.index < i) s = m.index + m[0].length; else { e = m.index + (m[0] === '.' ? 1 : 0); break; } }
    return t.slice(s, e).replace(/\s+/g, ' ').trim();
  };
  const isNeg = (t, i) => NEG_BEFORE.test(t.slice(Math.max(0, i - 40), i));

  // Find a cause in the chart: positive mentions count; negated ones are kept as "chart says not done".
  function findCause(ctx, re, reportTexts) {
    const yes = [], no = [];
    const scan = (text, where, time) => {
      const g = new RegExp(re.source, 'gi'); let m;
      while ((m = g.exec(text || ''))) {
        const before = text.slice(Math.max(0, m.index - 40), m.index), sent = SENT(text, m.index);
        if (reportTexts.some(r => r.includes(sent))) continue; // the radiology report's own assumption is not a cause
        if (NEG_BEFORE.test(before)) no.push({ where, time, quote: sent });
        else if (!HEDGE_BEFORE.test(before)) yes.push({ where, time, quote: sent });
      }
    };
    (ctx.notes || []).forEach(n => scan(n.text, n.title || 'Note', n.time));
    ctx.conditions.forEach(c => scan(c.text, 'Problem list', c.recorded));
    (ctx.procedures || []).forEach(p => scan(p.name, 'Procedure', p.time));
    return { yes, no };
  }

  function imagingFindings(ctx) {
    const need = ['Microbiology reports', 'Nursing notes'];
    if (waiting(ctx, need)) return [R('loading', 'Imaging findings', 'Waiting for data to load…')];
    // recent imaging only (older studies are compared in section 6); includes reports inside notes and imported PDFs
    const all = allImaging(ctx).filter(r => r.time >= ctx.from - 30 * DAY);
    if (!all.length) return [R(ctx.has('Microbiology reports') ? 'na' : 'unknown', 'Imaging findings', ctx.has('Microbiology reports') ? 'No imaging reports in the window' : 'Couldn’t check: reports didn’t load')];
    const reportTexts = all.map(r => r.text.replace(/\s+/g, ' '));
    const notesText = (ctx.notes || []).map(n => n.text || '').join('\n');
    const out = [], hits = {};

    const lcFirst = l => (/^[A-Z][a-z]/.test(l) && !/^(?:Paget|Crohn|Whipple)/.test(l) ? l[0].toLowerCase() + l.slice(1) : l);
    for (const f of IMG_FINDINGS) {
      const quotes = []; // every distinct sentence that reports this finding (up to 3), e.g. a rib lesion and a fracture-site lesion
      for (const rep of all) {
        const g = new RegExp(f.re.source, 'gi'); let m;
        while ((m = g.exec(rep.text))) {
          if (isNeg(rep.text, m.index)) continue;
          const q = SENT(rep.text, m.index);
          if (!quotes.some(x => x.quote === q)) quotes.push({ rep, quote: q });
        }
      }
      if (!quotes.length) continue;
      const h = hits[f.id] = quotes[0];
      const causes = f.explain.map(([label, re]) => ({ label, re, r: findCause(ctx, re, reportTexts) }));
      const found = causes.filter(c => c.r.yes.length);
      const denied = causes.filter(c => !c.r.yes.length && c.r.no.length);
      // the report offers a cause as the explanation ("presumed post-cholecystectomy", "correlation for prior sphincterotomy") that the chart says did not happen
      const ASSUME = /presum\w*|\bprior\b|\bpost-?\w|in keeping with|consistent with|related to|due to|secondary to|status post|\bs\/p\b|correlation for/i;
      const assumed = denied.filter(c => all.some(r => r.text.split(/(?<=\.)\s+|\n+/).some(sn => c.re.test(sn) && ASSUME.test(sn))));
      const hedged = quotes.find(q => HEDGE.test(q.quote));
      const repLines = quotes.slice(0, 3).map(q => 'Report (' + (q.rep.name || 'imaging') + ', ' + fmtTime(q.rep.time) + '): “' + q.quote + '”');
      if (found.length) {
        out.push(R('ok', 'Accounted for: ' + f.label, 'Cause in the chart: ' + found.map(c => c.label).join(', '),
          repLines.concat(found.map(c => 'Chart: “' + c.r.yes[0].quote + '” (' + c.r.yes[0].where + ')'))));
        continue;
      }
      const ev = repLines.slice();
      denied.forEach(c => ev.push('Chart says no: “' + c.r.no[0].quote + '” (' + c.r.no[0].where + (c.r.no[0].time ? ', ' + fmtTime(c.r.no[0].time) : '') + ')'));
      let summary = f.explain.length ? 'No ' + f.explain.map(([l]) => lcFirst(l)).join('; no ') + ' found in the chart.' : 'Needs a cause and usually urgent action.';
      if (assumed.length) summary += ' ⚠ The report assumes ' + assumed.map(c => lcFirst(c.label)).join(' or ') + ', but the chart says it did not happen.';
      else if (denied.length) summary += ' The chart says ' + denied.map(c => lcFirst(c.label)).join(' and ') + ' is absent, so nothing explains it yet.';
      if (hedged && !assumed.length) summary += ' The report hedges (“' + (hedged.quote.match(HEDGE) || [''])[0] + '”): treat it as an open question.';
      out.push(R('review', 'Unaccounted: ' + f.label, summary, ev.concat(['Consider: ' + f.consider.join('; ')]), { next: f.next, findingId: f.id }));
    }

    // Rigler's triad: small bowel obstruction + pneumobilia + gallbladder gone or an ectopic stone/intraluminal focus -> gallstone ileus
    const sboRe = /small bowel obstruction|\bSBO\b|dilated (?:fluid-filled )?small bowel loops[^.]{0,80}transition/i;
    const stoneRe = /ectopic (?:gall)?stone|gallstone (?:in|within) the (?:small bowel|ileum|jejunum|duodenum)|intraluminal (?:\d[\d.]* ?cm )?(?:\w+ ){0,3}(?:focus|density|calcifi\w*|stone|filling defect)[^.]{0,60}transition|(?:focus|density|stone)[^.]{0,40}at the transition point/i;
    const sbo = all.some(r => sboRe.test(r.text)) || ctx.conditions.some(c => c.active && sboRe.test(c.text)) || sboRe.test(notesText);
    const stone = all.map(r => { const m = r.text.match(stoneRe); return m ? SENT(r.text, m.index) : null; }).find(Boolean);
    const gbUnacc = out.some(i => i.findingId === 'gb'), pbUnacc = out.some(i => i.findingId === 'pneumobilia');
    if (sbo && hits.pneumobilia && (hits.gb || stone)) {
      const clues = [];
      if (ctx.patient && ctx.patient.gender === 'female') clues.push('Female');
      if (ctx.age != null && ctx.age >= 65) clues.push('Age ' + ctx.age);
      if (!/laparotomy|bowel resection|colectomy|hemicolectomy|appendicectomy|appendectomy|hysterectomy|open (?:abdominal )?surgery|adhesiolysis/i.test(notesText)) clues.push('No laparotomy found in the notes (adhesions less likely)');
      if (/contrast challenge[^.]{0,120}fail|fail\w*[^.]{0,40}contrast|no contrast in (?:the )?colon/i.test(notesText)) clues.push('Water-soluble contrast challenge failed');
      const alp = ctx.series('alp'), bili = ctx.series('bili');
      if (alp.length && last(alp).value > 120) clues.push('ALP ' + last(alp).value + ' U/L');
      if (bili.length && last(bili).value > 20) clues.push('Bilirubin ' + last(bili).value + ' µmol/L');
      if (/right upper quadrant|\bRUQ\b|biliary colic|gallstones?|cholelithiasis/i.test(notesText)) clues.push('Biliary symptoms or gallstones mentioned in notes');
      const named = /gallstone ileus|rigler/i.test(notesText);
      out.unshift(R('review', 'Pattern: Rigler’s triad → consider gallstone ileus',
        'Small bowel obstruction with pneumobilia' + (hits.gb ? ' and a missing gallbladder' : '') + (stone ? ' and an intraluminal focus' : '') + '. Each was labelled benign on its own; together they point to a stone obstructing the bowel.' +
        (named ? ' Gallstone ileus is already mentioned in a note: has it been confirmed or excluded with radiology and surgery?' : ''),
        (stone ? ['Possible ectopic stone: “' + stone + '”'] : []).concat(clues.length ? ['Also fits: ' + clues.join('; ')] : []),
        { next: 'Ask radiology to re-review the CT for an ectopic gallstone at the transition point and a cholecystoduodenal fistula; discuss with General Surgery today (Watch-ahead tab → Second look has a script)',
          checklist: [
            { state: 'done', text: 'Small bowel obstruction' },
            { state: hits.pneumobilia ? (pbUnacc ? 'missing' : 'done') : 'unknown', text: 'Pneumobilia' + (pbUnacc ? ' (no cause found)' : '') },
            { state: hits.gb ? (gbUnacc ? 'missing' : 'done') : 'ask', text: 'Gallbladder absent or not seen' + (gbUnacc ? ' (no cholecystectomy found)' : '') },
            { state: stone ? 'missing' : 'ask', text: stone ? 'Intraluminal focus at the transition point: is it a gallstone?' : 'Ectopic gallstone: ask radiology to look for one' }
          ] }));
    }

    let fracQuote = null;
    // CRAB pattern: bone lesions or fractures with high calcium, kidney injury, anemia or a wide protein gap -> myeloma (or metastatic cancer)
    {
      const lastV = k => { const a = ctx.series(k).filter(o => o.time >= ctx.from); return a.length ? last(a) : null; };
      const ca = lastV('ca'), ica = lastV('ica'), cr = lastV('creat'), hb = lastV('hgb'), tp = lastV('tp'), alb = lastV('alb');
      const fracRe = /compression (?:deformity|fracture)|pathologic(?:al)? fracture|insufficiency fracture|vertebral (?:body )?(?:collapse|fracture)/i;
      const fracQ = fracQuote = all.map(r => { const m = r.text.match(fracRe); return m && !isNeg(r.text, m.index) ? SENT(r.text, m.index) : null; }).find(Boolean);
      const C = (ca && ca.value > 2.6) || (ica && ica.value > 1.32), Rk = (cr && cr.value >= 130) || ctx.conditions.some(c => c.active && /acute kidney injury|\bAKI\b/i.test(c.text));
      const A = hb && hb.value < 100, gap = tp && alb && tp.value - alb.value >= 40, B = !!hits.bone || !!fracQ;
      const n = [C, Rk, A, gap].filter(Boolean).length;
      if ((B && n >= 1) || n >= 3) {
        const named = /myeloma|plasma cell|paraprotein|\bSPEP\b|free light chain/i.test(notesText);
        const clues = [];
        if (/subtrochanteric|low[- ]energy|ground[- ]level fall|walking pace/i.test(notesText)) clues.push('Low-energy fall or a subtrochanteric fracture');
        if (/weight loss|night sweats/i.test(notesText)) clues.push('Weight loss');
        if (/(?:back|bone|rib) pain/i.test(notesText)) clues.push('Bone or back pain');
        if (ctx.age != null && ctx.age >= 60) clues.push('Age ' + ctx.age);
        out.unshift(R('review', 'Pattern: CRAB features → consider myeloma or metastatic cancer',
          'Bone findings with ' + [C && 'high calcium', Rk && 'kidney injury', A && 'anemia', gap && 'a wide protein gap'].filter(Boolean).join(', ').replace(/, ([^,]*)$/, ' and $1') + '. Each may have another explanation; together they need a myeloma work-up, ideally before any fixation.' +
          (named ? ' Myeloma is already mentioned in a note: has the work-up been sent?' : ''),
          [hits.bone ? 'Bone: “' + hits.bone.quote + '”' : null, fracQ ? 'Spine or fracture: “' + fracQ + '”' : null, clues.length ? 'Also fits: ' + clues.join('; ') : null].filter(Boolean),
          { next: 'SPEP with immunofixation and serum free light chains; corrected or ionized calcium; skeletal survey or low-dose whole-body CT; avoid nephrotoxins; tell orthopedics before fixation (a pathological fracture may change the operation and needs tissue)',
            checklist: [
              { state: C ? 'missing' : 'ask', text: 'Calcium high' + (ca ? ' (' + ca.value + ' mmol/L)' : ica ? ' (ionized ' + ica.value + ')' : ': not measured?') },
              { state: Rk ? 'missing' : 'ask', text: 'Kidney injury' + (cr ? ' (creatinine ' + cr.value + ')' : '') },
              { state: A ? 'missing' : 'ask', text: 'Anemia' + (hb ? ' (Hgb ' + hb.value + ')' : '') },
              { state: B ? 'missing' : 'ask', text: 'Bone lesions or fracture' + (B ? '' : ': none reported; look at the films') },
              { state: gap ? 'missing' : tp && alb ? 'done' : 'ask', text: tp && alb ? 'Protein gap ' + Math.round(tp.value - alb.value) + ' g/L (total protein minus albumin)' : 'Protein gap: check total protein and albumin' }
            ] }));
      }
    }

    // Other hedged statements: radiology asked a question; has anyone answered it?
    // (skip sentences already covered by a card above: a listed finding, its causes, or the possible stone)
    const covered = s => s === stone || s === fracQuote || IMG_FINDINGS.some(f => hits[f.id] && (f.re.test(s) || f.explain.some(([, re]) => re.test(s))));
    const open = [];
    all.forEach(r => { const g = new RegExp(HEDGE.source, 'gi'); let m; while ((m = g.exec(r.text))) { const s = SENT(r.text, m.index); if (!covered(s) && !open.includes(s) && s.length > 12) open.push(s); } });
    if (open.length) out.push(R('review', 'Report statements to close the loop on', open.length + ' hedged statement' + (open.length === 1 ? '' : 's') + ' in the imaging reports. Has each one been answered?',
      open.slice(0, 8).map(s => '“' + s + '”'), { next: 'Answer each in your note, or ask radiology to clarify' }));

    if (!out.length) return [R('ok', 'Imaging findings', 'No findings from the checked list, and no hedged statements')];
    return out;
  }

  // ------------------------------------------------------------------
  // Imaging reports from every source: DiagnosticReports, plus radiology reports pasted inside notes or imported PDFs
  // (split into one report per study heading, each with its own exam date).
  // ------------------------------------------------------------------
  const STUDY_HEAD = /^[ \t]*((?:CT|CTA|MRI|MR|MRCP|ULTRASOUND|US|X-?RAY|XR|CXR|RADIOGRAPH|CHEST X-?RAY|CHEST FILM|NUCLEAR|BONE SCAN|ECHOCARDIOGRAM)\b[^\n]{0,80})$/gim;
  const MODALITY = [['CT', /\bCTA?\b|computed tomograph/i], ['MRI', /\bMRI?\b|\bMRCP\b|magnetic resonance/i], ['Ultrasound', /ultrasound|sonograph|\bUS\b|echocardiogra/i],
    ['X-ray', /x-?ray|\bXR\b|\bCXR\b|radiograph|chest film|\bfilms?\b/i]];
  const modalityOf = s => (MODALITY.find(([, re]) => re.test(s || '')) || ['Imaging'])[0];
  function parseLooseDate(s) {
    let m = /(20\d{2}|19\d{2})-(\d{1,2})-(\d{1,2})(?:[ T]+(\d{1,2}):(\d{2}))?/.exec(s || '');
    if (m) return new Date(+m[1], +m[2] - 1, +m[3], m[4] ? +m[4] : 12, m[5] ? +m[5] : 0).getTime();
    m = /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+(\d{1,2}),?\s+(20\d{2}|19\d{2})(?:\s+(\d{1,2}):(\d{2}))?/i.exec(s || '');
    if (m) return new Date(+m[3], MONTHS.findIndex(x => x.toLowerCase() === m[1].slice(0, 3).toLowerCase()), +m[2], m[4] ? +m[4] : 12, m[5] ? +m[5] : 0).getTime();
    return null;
  }
  function noteBlocks(n) {
    const t = n.text || '', heads = [];
    let m; STUDY_HEAD.lastIndex = 0;
    while ((m = STUDY_HEAD.exec(t))) {
      const line = m[1].trim(), after = t.slice(m.index + m[0].length, m.index + m[0].length + 400);
      if (line.length < 4 || line !== line.toUpperCase() || !/FINDINGS|IMPRESSION|date of (?:exam|study|service)/i.test(after)) continue;
      heads.push({ i: m.index, line });
    }
    return heads.map((h, k) => {
      let end = k + 1 < heads.length ? heads[k + 1].i : t.length;
      const rest = t.slice(h.i + h.line.length + 1, end), stop = rest.search(/\n[ \t]*(?!FINDINGS|IMPRESSION|ADDENDUM|COMPARISON|INDICATION|TECHNIQUE|HISTORY)[A-Z][A-Z ()\/&-]{6,}\n/);
      if (stop >= 0) end = h.i + h.line.length + 1 + stop;
      const text = t.slice(h.i, end).split('\n').filter(l => !/\bPage \d+\s*$/.test(l)).join('\n').trim(), dm = /date of (?:exam|study|service|procedure)[:\s]*([^\n]{6,30})/i.exec(text);
      return { id: 'note-' + n.time + '-' + k, time: (dm && parseLooseDate(dm[1])) || n.time, name: h.line.replace(/\s+/g, ' '), text, status: 'final', imaging: true, fromNote: n.title || 'Note' };
    });
  }
  function allImaging(ctx) {
    if (ctx.__img) return ctx.__img;
    const blocks = [];
    for (const n of ctx.notes || []) {
      const b = noteBlocks(n);
      if (b.length) blocks.push(...b);
      else { // no study headings: fall back to the first report-like section of the note
        const i = (n.text || '').search(/\b(?:CT|MRI|ultrasound|X-?ray|radiograph)\b[^\n]{0,60}\n?[\s\S]{0,40}(?:FINDINGS|IMPRESSION)/i);
        if (i >= 0) blocks.push({ id: 'note-' + n.time, time: n.time, name: (n.title || 'Note') + ' (report text)', text: n.text.slice(i, i + 3000), status: 'final', imaging: true, fromNote: n.title || 'Note' });
      }
    }
    const norm = s => String(s || '').replace(/\s+/g, ' ').trim().toLowerCase();
    const seen = new Set();
    const reports = ctx.reports.filter(r => r.imaging).filter(r => { // drop a report already shown as a note block (PDF imports create both)
      const head = norm(r.text).slice(0, 60);
      if (r.id && seen.has(r.id)) return false; if (r.id) seen.add(r.id);
      return !(head.length > 20 && blocks.some(b => norm(b.text).includes(head)));
    });
    ctx.__img = reports.concat(blocks).filter(r => r.time != null).sort((a, b) => a.time - b.time);
    return ctx.__img;
  }

  // ------------------------------------------------------------------
  // 6. Imaging review: timeline and discrepancies
  //   - an organ seen on earlier imaging is now reported absent, with no surgery in the chart
  //   - a lesion called "old" that earlier imaging of the same bone called normal
  //   - a note calls the imaging unremarkable when the report lists findings
  //   - left/right mismatch between reports and notes
  //   - addenda, amended or corrected reports, and reports still preliminary
  //   - imaging ordered with no report; a "normal" report that the patient's data argue against
  // UNVERIFIED draft rules written by Claude: edit freely.
  // ------------------------------------------------------------------
  const ORGANS = [
    { name: 'Gallbladder', absent: /gall ?bladder (?:is |was )?(?:not (?:seen|visuali[sz]ed|identified)|absent|surgically absent|removed)|(?:absent|non-?visuali[sz]ed) gall ?bladder|post-?cholecystectomy/i, present: /gall ?bladder/i, surgery: /cholecystectomy|\blap(?:aroscopic)? chole\b/i },
    { name: 'Spleen', absent: /spleen (?:is |was )?(?:not (?:seen|visuali[sz]ed|identified)|absent|surgically absent)|post-?splenectomy|asplenia/i, present: /\bspleen\b|\bsplenic\b/i, surgery: /splenectomy/i },
    { name: 'Appendix', absent: /appendix (?:is |was )?(?:not (?:seen|visuali[sz]ed|identified)|absent|surgically absent)|post-?appendectomy/i, present: /appendix (?:is |was )?(?:normal|visuali[sz]ed|unremarkable|seen)|(?:normal|unremarkable) appendix/i, surgery: /appendectomy|appendicectomy/i },
    { name: 'Left kidney', absent: /left kidney (?:is |was )?(?:not (?:seen|visuali[sz]ed|identified)|absent|surgically absent)|left nephrectomy|absent left kidney/i, present: /left kidney/i, surgery: /(?:left )?nephrectomy/i },
    { name: 'Right kidney', absent: /right kidney (?:is |was )?(?:not (?:seen|visuali[sz]ed|identified)|absent|surgically absent)|right nephrectomy|absent right kidney/i, present: /right kidney/i, surgery: /(?:right )?nephrectomy/i }
  ];
  const SIG = /pneumobilia|lytic|blastic|mass\b|nodule|lesion|abscess|collection|thrombos|infarct|hemorrhage|haemorrhage|hematoma|free air|pneumoperitoneum|pneumatosis|portal (?:venous )?gas|hydronephrosis|effusion|fracture|obstruction|dilat|not visuali[sz]ed|absent|compression deformity|perforat|ischemi|lymphadenopathy|enlarged (?:\w+ )?(?:lymph )?nodes?/i;
  const DOWNPLAY = /(?:\b(?:CT|CTA|MRI|x-?rays?|XR|CXR|films?|radiographs?|ultrasound|\bUS\b|imaging|scan)\b)[^.\n]{0,80}?\b(?:otherwise (?:unremarkable|normal|negative)|unremarkable|nothing (?:else|acute)|no (?:other )?(?:acute )?(?:findings|abnormalit\w*)|(?:fracture|SBO|obstruction) only|negative)\b/gi;
  const SIDE_PART = /\b(left|right|lt|rt)\b[\s-]+(?:[\w-]+[\s-]+){0,3}?(hip|femur|femoral|subtrochanteric|intertrochanteric|neck of femur|knee|tibia|tibial|ankle|shoulder|humerus|humeral|wrist|radius|radial|kidney|renal|ureter\w*|pleural|lung|leg|arm)\b/gi;
  const PART_GROUP = p => (/hip|femur|femoral|trochanteric|neck of femur/i.test(p) ? 'hip/femur' : /kidney|renal|ureter/i.test(p) ? 'kidney' : /pleural|lung/i.test(p) ? 'chest' : /tibia|ankle|knee|leg/i.test(p) ? 'leg' : /shoulder|humer|arm|wrist|radi/i.test(p) ? 'arm' : p.toLowerCase());
  const sideOf = s => (/^(?:left|lt)$/i.test(s) ? 'left' : 'right');
  const OLD_CLAIM = /\b(?:old|healed|healing|chronic|longstanding|remote)\b/i, NEW_CLAIM = /age indeterminate|indeterminate age/i;
  const BONE_SITE = /\b(?:(?:left|right) )?(\d{1,2})(?:st|nd|rd|th) rib\b|\b([TL]\d{1,2})\b(?:\s*vertebra\w*)?/i;
  const BONE_NORMAL = /no (?:acute )?(?:rib )?fractures?|ribs? (?:are |is )?intact|no (?:focal |destructive |lytic )?(?:bone|osseous|bony|lytic) lesions?|bones? (?:are |is )?(?:normal|unremarkable)|no compression (?:deformity|fracture)|vertebral (?:body )?heights? (?:are |is )?(?:preserved|maintained)|(?:thoracic|lumbar) spine (?:is )?unremarkable/i;
  const ADDENDUM = /\b(?:ADDENDUM|AMENDED REPORT|CORRECTED REPORT|REVISED REPORT|REPORT AMENDED|REPORT CORRECTED)\b/;

  function imagingReview(ctx) {
    const need = ['Microbiology reports', 'Nursing notes', 'Past imaging'];
    if (waiting(ctx, need)) return [R('loading', 'Imaging review', 'Waiting for data to load…')];
    const all = allImaging(ctx);
    if (!all.length) return [R(ctx.has('Microbiology reports') ? 'na' : 'unknown', 'Imaging review', ctx.has('Microbiology reports') ? 'No imaging reports found' : 'Couldn’t check: reports didn’t load')];
    const notes = ctx.notes || [], out = [];
    const notesText = notes.map(n => n.text || '').join('\n');
    const reportTexts = all.map(r => r.text.replace(/\s+/g, ' '));
    const label = r => (r.name || modalityOf(r.text)) + ', ' + fmtDate(r.time);
    const sentences = r => r.text.split(/(?<=\.)\s+|\n+/).map(s => s.replace(/\s+/g, ' ').trim()).filter(s => s.length > 3);
    // a note is "not a report" when it isn't itself the source of the report blocks (PDF notes hold both)
    const noteProse = n => { let t = n.text || ''; all.filter(r => r.fromNote && r.fromNote === (n.title || 'Note')).forEach(r => { t = t.replace(r.text, ' '); }); return t; };

    // 1. organ present before, absent now
    for (const o of ORGANS) {
      const absentNow = all.filter(r => { const m = r.text.match(o.absent); return m && !isNeg(r.text, m.index); });
      if (!absentNow.length) continue;
      const firstAbsent = absentNow[0];
      const before = all.filter(r => r.time < firstAbsent.time - DAY && !o.absent.test(r.text) && sentences(r).some(s => o.present.test(s) && !o.absent.test(s)));
      if (!before.length) continue;
      const surgery = findCause(ctx, o.surgery, reportTexts).yes;
      const prev = last(before), prevQ = sentences(prev).find(s => o.present.test(s) && !o.absent.test(s));
      const nowQ = SENT(firstAbsent.text, firstAbsent.text.search(o.absent));
      out.push(R(surgery.length ? 'ok' : 'review', (surgery.length ? 'Explained: ' : '⚠ ') + o.name + ' seen on ' + label(prev) + ', absent on ' + label(firstAbsent),
        surgery.length ? 'Surgery found in the chart: “' + surgery[0].quote + '”' : 'No surgery found in the chart between the two studies. Something has happened to the ' + o.name.toLowerCase() + '.',
        ['Earlier (' + label(prev) + '): “' + prevQ + '”', 'Later (' + label(firstAbsent) + '): “' + nowQ + '”'],
        surgery.length ? {} : { next: o.name === 'Gallbladder' ? 'Ask radiology to compare with the earlier study: contracted around stones, fistulized (gallstone ileus), or a reporting error?' : 'Ask radiology to compare with the earlier study' }));
    }

    // 2. a bone lesion called old, but earlier imaging of that bone was normal
    for (const r of all) {
      for (const s of sentences(r)) {
        if (!(OLD_CLAIM.test(s) || NEW_CLAIM.test(s))) continue;
        const site = s.match(BONE_SITE); if (!site) continue;
        const siteWord = site[1] ? site[1] + (/^1$/.test(site[1]) ? 'st' : /^2$/.test(site[1]) ? 'nd' : /^3$/.test(site[1]) ? 'rd' : 'th') + ' rib' : site[2].toUpperCase();
        const region = site[1] ? /\b(?:ribs?|chest|thora\w*)\b/i : /\b(?:spine|vertebra\w*|thora\w*|lumbar|T\d|L\d)\b/i;
        const earlier = all.filter(x => x.time < r.time - 30 * DAY && region.test(x.name + ' ' + x.text) && BONE_NORMAL.test(x.text));
        if (!earlier.length) continue;
        const e = last(earlier), eS = sentences(e).find(x => BONE_NORMAL.test(x) && region.test(x)) || sentences(e).find(x => BONE_NORMAL.test(x));
        out.push(R('review', '⚠ ' + siteWord + ' called ' + (OLD_CLAIM.test(s) ? '“old”' : '“age indeterminate”') + ', but ' + label(e) + ' was normal',
          'Earlier imaging of the same area reported no lesion, so this is probably new.',
          ['Now (' + label(r) + '): “' + s + '”', 'Earlier (' + label(e) + '): “' + eS + '”'],
          { next: 'Ask radiology to compare the two studies directly; a new lytic or expansile lesion needs a work-up' }));
      }
    }

    // 3. a note calls imaging unremarkable when the report lists findings
    for (const n of notes) {
      const prose = noteProse(n); DOWNPLAY.lastIndex = 0; let m; const done = new Set();
      while ((m = DOWNPLAY.exec(prose))) {
        const q = SENT(prose, m.index + 1), mod = modalityOf(m[0]);
        if (done.has(q)) continue; done.add(q);
        const reps = all.filter(r => r.time <= n.time + 12 * HOUR && r.time >= n.time - 14 * DAY && (mod === 'Imaging' || modalityOf(r.name + ' ' + r.text) === mod));
        const isSig = s => SIG.test(s) && !/^(?:no|without)\b/i.test(s) && !isNeg(s, s.search(SIG)) && !/^(?:FINDINGS|IMPRESSION|ADDENDUM|date of)\b/i.test(s) && !/NOT A REAL PERSON/.test(s);
        const sig = []; reps.forEach(r => sentences(r).filter(isSig).forEach(s => { if (!sig.some(x => x.s === s)) sig.push({ r, s }); }));
        // drop findings the note itself names ("fracture only", "SBO")
        const qn = q.toLowerCase().replace(/\bsbo\b/g, 'small bowel obstruction dilated').replace(/\bfractures?\b/g, 'fracture');
        const others = sig.filter(x => { const k = (x.s.match(SIG) || [''])[0].toLowerCase(); return k && !qn.includes(k); });
        if (others.length < 2) continue;
        out.push(R('review', 'Note vs. report: “' + q.slice(0, 90) + (q.length > 90 ? '…' : '') + '”',
          (n.title || 'A note') + ' (' + fmtTime(n.time) + ') reads the imaging as unremarkable, but the report lists ' + others.length + ' other findings.',
          others.slice(0, 4).map(x => label(x.r) + ': “' + x.s + '”'),
          { next: 'Re-read the full report; copy-forward summaries often drop the findings that matter' }));
      }
    }

    // 4. left/right mismatch between reports and notes
    const sides = (text) => { const out2 = {}; let m; SIDE_PART.lastIndex = 0; while ((m = SIDE_PART.exec(text))) { const g = PART_GROUP(m[2]); (out2[g] = out2[g] || new Set()).add(sideOf(m[1])); } return out2; };
    const repSides = {}; all.forEach(r => { const s = sides(r.text); Object.keys(s).forEach(g => { repSides[g] = repSides[g] || new Set(); s[g].forEach(x => repSides[g].add(x)); }); });
    for (const n of notes) {
      const prose = noteProse(n); let m; SIDE_PART.lastIndex = 0;
      while ((m = SIDE_PART.exec(prose))) {
        const g = PART_GROUP(m[2]), side = sideOf(m[1]), rs = repSides[g];
        if (!rs || rs.size !== 1 || rs.has(side) || g === 'chest') continue;
        const repSide = Array.from(rs)[0], r = all.find(x => (sides(x.text)[g] || new Set()).has(repSide));
        let rq = ''; { const body = r.text.replace(/^[^\n]*\n/, ''); let mm; SIDE_PART.lastIndex = 0; while ((mm = SIDE_PART.exec(body))) { if (PART_GROUP(mm[2]) === g) { rq = SENT(body, mm.index); break; } } }
        out.push(R('review', '⚠ Wrong side? Note says ' + side + ' ' + g + ', imaging says ' + repSide,
          (n.title || 'A note') + ' (' + fmtTime(n.time) + ') names the ' + side + ' side; every imaging report names the ' + repSide + '.',
          ['Note: “' + SENT(prose, m.index) + '”', 'Imaging (' + label(r) + '): “' + (rq || r.name) + '”'],
          { next: 'Confirm the side at the bedside and with the team today, before any procedure or consent' }));
        break;
      }
    }

    // 5. addenda, amended or corrected reports, still preliminary
    for (const r of all) {
      const am = r.text.match(ADDENDUM), changed = am || ['amended', 'corrected', 'appended'].includes(r.status);
      if (changed) {
        const at = am ? (parseLooseDate(r.text.slice(am.index, am.index + 80)) || r.time) : r.time;
        const addText = am ? r.text.slice(am.index).replace(/\s+/g, ' ').slice(0, 260) : 'Report status: ' + r.status;
        const after = notes.filter(n => n.time > at && !(r.fromNote && n.title === r.fromNote && n.time === r.time));
        const ack = after.some(n => /addendum|amended|corrected report|revised report|radiology (?:called|updated|revised)/i.test(noteProse(n)));
        out.push(R(ack ? 'ok' : 'review', 'Report changed after it was first read: ' + label(r),
          ack ? 'A later note mentions the change.' : (after.length ? 'No note after ' + fmtTime(at) + ' mentions the change.' : 'No note has been written since the change (' + fmtTime(at) + ').'),
          ['“' + addText + (addText.length >= 260 ? '…' : '') + '”'], ack ? {} : { next: 'Read the addendum now and tell the team; check whether the plan still fits' }));
      } else if (r.status === 'preliminary' && ctx.now - r.time > 12 * HOUR) {
        out.push(R('review', 'Still preliminary after ' + Math.round((ctx.now - r.time) / HOUR) + ' h: ' + label(r), 'The final report may differ from the wet read.', [], { next: 'Check for the final report, or call radiology' }));
      }
    }

    // 6. imaging ordered with no report
    const imgOrders = (ctx.orders || []).filter(o => o.type === 'ServiceRequest' && /\b(?:CT|CTA|MRI|MRCP|x-?ray|XR|CXR|ultrasound|US|radiograph|doppler|echo\w*|bone scan)\b/i.test(o.name) && ctx.now - o.time > 24 * HOUR && o.time >= ctx.from);
    for (const o of imgOrders) {
      const mod = modalityOf(o.name);
      if (all.some(r => r.time >= o.time - 2 * HOUR && (mod === 'Imaging' || modalityOf(r.name + ' ' + r.text) === mod))) continue;
      out.push(R('review', 'Ordered, no report found: ' + o.name, 'Ordered ' + fmtTime(o.time) + ' (' + Math.round((ctx.now - o.time) / HOUR) + ' h ago).', [], { next: 'Was it done? If done, find the report; if not, decide whether it is still needed' }));
    }

    // 7. a "normal" report the patient's data argue against
    const lastAfter = (k, t) => ctx.series(k).filter(o => o.time >= t && o.time <= t + 2 * DAY);
    for (const r of all.filter(x => x.time >= ctx.from - 2 * DAY)) {
      if (/\b(?:chest|CXR|lungs?)\b/i.test(r.name + ' ' + r.text) && /lungs? (?:are )?clear|no acute (?:cardiopulmonary|chest)|normal chest/i.test(r.text)) {
        const low = lastAfter('spo2', r.time).filter(o => o.value < 90);
        if (low.length) out.push(R('review', 'Chest imaging “clear” but SpO2 ' + minBy(low, o => o.value).value + '%: ' + label(r),
          'Hypoxia with clear lungs on imaging needs another explanation.', ['Report: “' + SENT(r.text, r.text.search(/lungs? (?:are )?clear|no acute|normal chest/i)) + '”'],
          { next: 'Consider pulmonary embolism, shunt, hypoventilation or a film that is now out of date' }));
      }
      if (/no (?:intra- ?or extrahepatic )?biliary (?:duct(?:al)? )?dilat/i.test(r.text)) {
        const hi = lastAfter('bili', r.time).filter(o => o.value > 40);
        if (hi.length) out.push(R('review', 'No biliary dilatation but bilirubin ' + maxBy(hi, o => o.value).value + ': ' + label(r),
          'Rising bilirubin without dilated ducts.', [], { next: 'Hemolysis, drugs, hepatitis, sepsis; repeat imaging if it keeps rising' }));
      }
    }

    // timeline
    const tl = all.slice().reverse().slice(0, 12).map(r => {
      const imp = r.text.match(/IMPRESSION:?\s*([\s\S]{0,170})/i), body = (imp ? imp[1] : r.text.replace(/^[^\n]*\n/, '')).replace(/\s+/g, ' ').trim();
      return fmtDate(r.time) + ' · ' + (r.name || modalityOf(r.text)) + (r.status && r.status !== 'final' ? ' (' + r.status + ')' : '') + (ADDENDUM.test(r.text) ? ' [addendum]' : '') + (r.fromNote ? ' [from ' + r.fromNote + ']' : '') + ' — ' + body.slice(0, 170) + (body.length > 170 ? '…' : '');
    });
    out.push(R('na', 'Imaging timeline (' + all.length + ' stud' + (all.length === 1 ? 'y' : 'ies') + ', newest first)', 'Every imaging report found, including older studies and reports inside notes or imported PDFs.', tl));
    if (!out.some(i => i.status === 'review')) out.unshift(R('ok', 'Imaging review', 'No discrepancies found between the reports, the notes and the data'));
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
    const im = safe(() => imagingFindings(ctx), 'Imaging findings');
    const rv = safe(() => imagingReview(ctx), 'Imaging review');
    const sections = [
      { id: 'improving', title: '1. Not improving', items: [].concat(ni) },
      { id: 'bundles', title: '2. Can’t-miss checks', items: [].concat(bu) },
      { id: 'fit', title: '3. Does the data fit the working diagnosis?', items: fit.items || [].concat(fit), detected: fit.detected || {} },
      { id: 'unexplained', title: '4. Unexplained results', items: [].concat(ux) },
      { id: 'imaging', title: '5. Imaging findings: are they accounted for?', items: [].concat(im) },
      { id: 'review', title: '6. Imaging review: timeline and discrepancies', items: [].concat(rv) }
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
    const out = { patient: null, encounters: [], medRequests: [], medAdmins: null, observations: [], reports: [], orders: [], procedures: [], pastReports: [], conditions: [], notes: null };
    const progress = opts.onProgress || function () {};
    const partial = opts.onPartial || function () {};
    const snapshot = () => Object.assign({}, out, { failed: failed.slice(), pending: Array.from(pending), reasons: Object.assign({}, reasons) });
    const FAILED = {};
    const LABELS = ['Patient', 'Admission', 'Active medications', 'Problem list', 'Lab results', 'Microbiology reports', 'Orders', 'Past procedures', 'Past imaging', 'Nursing notes'];
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
      run('Past imaging', 'pastReports', () => fhirSearch(client, 'DiagnosticReport?patient=' + pid + '&_count=100', 3), []), // older studies to compare against
      run('Past procedures', 'procedures', () => fhirSearch(client, 'Procedure?patient=' + pid + '&_count=100', 3), []), // surgical history, any date (cholecystectomy, ERCP)
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

  return { CONFIG, FIT_RULES, UNEXPLAINED, IMG_FINDINGS, imagingFindings, imagingReview, allImaging, mount, loadResources, buildContext, evaluate, render, kindOf, detectWorkingDx };
});
