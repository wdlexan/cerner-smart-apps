/*
 * edr.js — Eating Disorder ED Review (adults)
 * SMART on FHIR (Oracle Health / Cerner Millennium R4). Read-only: nothing is written to the chart.
 *
 * For adults with an eating disorder who come to the ED often:
 *   1. Today       red / amber criteria (MEED 2022 + APA 2023 adult), compared with the patient's own usual values,
 *                  bedside questions, refeeding risk (NICE CG32)
 *   2. Decision    consider admission (any red) / still to assess / no flags, with an admit or discharge checklist
 *                  and a summary to copy into the note
 *   3. Care plan   PLACEHOLDER until the care plan's location in PowerChart is known
 *   4. Past visits ED visits and admissions over 12–36 months, worst values per visit, weights, past complications
 *
 * Usage (after FHIR.oauth2.ready()):
 *   EDR.mount(document.getElementById('edr-tab'), client, { historyMonths: 24 });
 * Options:
 *   historyMonths  12 | 24 | 36 (default 24)
 *   loader         async (from, to) => resources   (demo/tests: replaces FHIR loading)
 *   now            a fixed "now" (tests)
 *
 * Thresholds and questions live in edr-criteria.js (load it before this file).
 */
(function (root, factory) {
  const crit = (typeof module === 'object' && module.exports) ? require('./edr-criteria.js') : root.EDRCriteria;
  const api = factory(crit);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.EDR = api;
})(typeof self !== 'undefined' ? self : this, function (C) {
  'use strict';
  if (!C) throw new Error('edr-criteria.js must be loaded before edr.js');

  const HOUR = 3600 * 1000, DAY = 24 * HOUR;

  const CONFIG = {
    historyMonths: 24,
    currentHours: 24,          // "today" = the current encounter, or the last 24 h if there is none
    currentEncounterHours: 72, // an encounter that started this recently counts as the current visit
    visitPaddingHours: 2,      // results this close to a visit's start/end count toward that visit
    edVisitDefaultHours: 12,   // length assumed for an ED visit with no end time
    admitLinkHours: 24,        // an inpatient encounter starting this soon after an ED visit = "admitted"
    maxNotes: 40,
    timeouts: { searchMs: 60000, notesMs: 90000, noteMs: 15000 },
    maxParallel: 4,
    extraCodes: {}             // site codes: { k: ['system|code'], qtc: [...] }
  };

  const LINKS = {
    meed: 'https://www.rcpsych.ac.uk/improving-care/campaigning-for-better-mental-health-policy/college-reports/2022-college-reports/cr233',
    apa: 'https://psychiatryonline.org/doi/book/10.1176/appi.books.9780890424865',
    nice: 'https://www.nice.org.uk/guidance/cg32'
  };

  const LOINC = {
    hr: ['8867-4', '8889-8', '68999-4'], sbp: ['8480-6', '8459-0', '8460-8'], dbp: ['8462-4', '8453-3', '8454-1'],
    temp: ['8310-5', '8331-1', '8332-9', '8333-7', '8328-5', '8334-5'],
    weight: ['29463-7', '3141-9', '3142-7'], height: ['8302-2', '8306-3', '3137-7'], bmi: ['39156-5'],
    k: ['2823-3', '6298-4'], na: ['2951-2', '2947-0'], po4: ['2777-1', '14879-1'], mg: ['19123-9', '2601-3'],
    ca: ['17861-6', '2000-8'], glucose: ['2345-7', '2339-0', '41653-7', '14749-6', '15074-8', '2341-6'],
    albumin: ['1751-7', '61151-7'], alt: ['1742-6', '1743-4', '76625-3'], ast: ['1920-8', '30239-8'],
    wbc: ['6690-2', '26464-8', '804-5'], neut: ['751-8', '26499-4', '753-4'], hgb: ['718-7', '30313-1', '20509-6'],
    qtc: ['8636-3', '8634-8'], a1c: ['4548-4', '17856-6']
  };
  const CODE_PARAM = Object.keys(LOINC).flatMap(k => LOINC[k]).map(c => 'http://loinc.org|' + c).join(',');

  // ------------------------------------------------------------------
  // Utilities
  // ------------------------------------------------------------------
  const lc = s => (s == null ? '' : String(s)).toLowerCase();
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const toTime = v => { const t = v ? Date.parse(v) : NaN; return isNaN(t) ? null : t; };
  const pad2 = n => String(n).padStart(2, '0');
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const fmtTime = t => { const d = new Date(t); return MONTHS[d.getMonth()] + ' ' + d.getDate() + ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes()); };
  const fmtDate = t => { const d = new Date(t); return MONTHS[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear(); };
  const round = (v, d = 0) => { const f = Math.pow(10, d); return Math.round(v * f) / f; };
  const fhirDate = t => new Date(t).toISOString().replace(/\.\d{3}Z$/, 'Z');
  const codings = cc => (cc && cc.coding) || [];
  const ccText = cc => !cc ? '' : (cc.text || (codings(cc).find(c => c.display) || {}).display || '');
  const plural = (n, w) => n + ' ' + w + (n === 1 ? '' : 's');
  const median = a => { if (!a.length) return null; const s = a.slice().sort((x, y) => x - y), m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
  const MEASURE = {}; C.MEASURES.forEach(m => { MEASURE[m.key] = m; });
  const fmtVal = (key, v) => { if (v == null) return '—'; const m = MEASURE[key]; return String(round(v, (m && m.decimals) || 0)); };
  const LEVEL_RANK = { red: 2, amber: 1, ok: 0 };
  const NEGATION = /\b(?:no|not|denies|denied|without|negative for|nil|absent|never)\b[^.;:\n]{0,30}$/i;

  function ageAt(birthDate, t) {
    const b = new Date(birthDate), d = new Date(t);
    let a = d.getFullYear() - b.getFullYear();
    if (d.getMonth() < b.getMonth() || (d.getMonth() === b.getMonth() && d.getDate() < b.getDate())) a--;
    return a;
  }

  function findInNotes(notes, re, opts) {
    opts = opts || {};
    const hits = [];
    for (const n of notes || []) {
      const t = (opts.withTitle ? (n.title || '') + '\n' : '') + (n.text || '');
      const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
      let m;
      while ((m = g.exec(t))) {
        if (opts.allowNegated || !NEGATION.test(t.slice(Math.max(0, m.index - 40), m.index))) {
          const s = Math.max(0, m.index - 50), e = Math.min(t.length, m.index + m[0].length + 60);
          hits.push({ time: n.time, title: n.title, match: m[0],
            excerpt: (s > 0 ? '…' : '') + t.slice(s, e).replace(/\s+/g, ' ').trim() + (e < t.length ? '…' : '') });
          break;
        }
        if (m.index === g.lastIndex) g.lastIndex++;
      }
    }
    return hits.sort((a, b) => b.time - a.time);
  }

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
    for (const k of Object.keys(LOINC)) if (loinc.some(code => LOINC[k].includes(code))) return k;
    const t = lc(ccText(cc) + ' ' + cods.map(c => c.display || '').join(' '));
    if (!t.trim() || /urine|csf|fluid|stool|ratio|panel$/.test(t)) return null;
    if (/\bqtc\b|qt interval,? corrected|corrected qt/.test(t)) return 'qtc';
    if (/heart rate|pulse rate|^pulse\b|apical pulse/.test(t)) return 'hr';
    if (/systolic/.test(t)) return 'sbp';
    if (/diastolic/.test(t)) return 'dbp';
    if (/temperature/.test(t)) return 'temp';
    if (/body mass index|\bbmi\b/.test(t)) return 'bmi';
    if (/(?:body )?weight|dosing weight|measured weight/.test(t) && !/birth|ideal|lean/.test(t)) return 'weight';
    if (/(?:body )?height|\blength\b/.test(t)) return 'height';
    if (/\bpotassium\b/.test(t)) return 'k';
    if (/\bsodium\b/.test(t)) return 'na';
    if (/phosph(?:ate|orus)/.test(t) && !/alkaline|alk phos/.test(t)) return 'po4';
    if (/magnesium/.test(t)) return 'mg';
    if (/\bcalcium\b/.test(t) && !/ionized|ionised|corrected/.test(t)) return 'ca';
    if (/glucose/.test(t) && !/tolerance/.test(t)) return 'glucose';
    if (/albumin/.test(t) && !/micro|prealbumin/.test(t)) return 'albumin';
    if (/\balt\b|alanine aminotransferase|\bsgpt\b/.test(t)) return 'alt';
    if (/\bast\b|aspartate aminotransferase|\bsgot\b/.test(t)) return 'ast';
    if (/neutrophil/.test(t) && !/%|percent/.test(t)) return 'neut';
    if (/\bwbc\b|white blood cell|leukocyte/.test(t)) return 'wbc';
    if (/h(?:a)?emoglobin\b/.test(t) && !/a1c|glyc|free/.test(t)) return 'hgb';
    if (/a1c|glycated|glycosylated/.test(t)) return 'a1c';
    return null;
  }

  function obsValue(o) {
    if (o.valueQuantity && typeof o.valueQuantity.value === 'number') return { num: o.valueQuantity.value, unit: o.valueQuantity.unit || o.valueQuantity.code || '' };
    if (typeof o.valueInteger === 'number') return { num: o.valueInteger, unit: '' };
    if (typeof o.valueString === 'string') { const n = parseFloat(o.valueString.replace(/[<>]/g, '')); return { num: isNaN(n) ? null : n, unit: '' }; }
    return { num: null, unit: '' };
  }

  // Convert to SI units. Unknown units are assumed SI unless the number only makes sense in US units.
  function toSI(kind, num, unit) {
    if (num == null) return null;
    const u = lc(unit).replace(/\s/g, '');
    const usMass = /mg\/dl|mg\/100ml/.test(u);
    switch (kind) {
      case 'temp': return (/degf|\[degf\]|fahrenheit|°f/.test(u) || num > 50) ? round((num - 32) * 5 / 9, 1) : num;
      case 'weight': return (/\[lb|lb|pound/.test(u)) ? round(num * 0.45359, 1) : (/^g$/.test(u) ? round(num / 1000, 1) : num);
      case 'height': if (/\[in|inch|^in$/.test(u)) return round(num * 2.54, 1); if (/^m$/.test(u) || num < 3) return round(num * 100, 1); return num;
      case 'glucose': return (usMass || num > 40) ? round(num / 18.016, 1) : num;
      case 'po4': return (usMass || num > 2.5) ? round(num * 0.3229, 2) : num;
      case 'mg': return (usMass || /meq/.test(u) || num > 1.6) ? (/meq/.test(u) ? round(num / 2, 2) : round(num * 0.4114, 2)) : num;
      case 'ca': return (usMass || num > 4) ? round(num * 0.2495, 2) : num;
      case 'albumin': return (/g\/dl/.test(u) || num < 10) ? round(num * 10) : num;
      case 'hgb': return (/g\/dl/.test(u) || num < 25) ? round(num * 10) : num;
      case 'a1c': return (/mmol\/mol/.test(u) || num > 25) ? round(num / 10.929 + 2.15, 1) : num;
      default: return num;
    }
  }

  function parseObservations(list) {
    const out = [], seen = new Set();
    for (const o of list || []) {
      if (!o || o.resourceType !== 'Observation' || ['entered-in-error', 'cancelled'].includes(o.status)) continue;
      const time = toTime(o.effectiveDateTime || (o.effectivePeriod && o.effectivePeriod.start) || o.issued);
      if (time == null) continue;
      const entries = [{ cc: o.code, src: o }].concat((o.component || []).map(c => ({ cc: c.code, src: c })));
      for (const e of entries) {
        const kind = kindOf(e.cc);
        if (!kind) continue;
        const v = obsValue(e.src);
        const value = toSI(kind, v.num, v.unit);
        if (value == null) continue;
        const id = kind + '|' + time + '|' + value;
        if (seen.has(id)) continue;
        seen.add(id);
        out.push({ kind, time, value, display: ccText(e.cc) });
      }
    }
    return out.sort((a, b) => a.time - b.time);
  }

  function encounterKind(e) {
    const cls = lc((e.class && (e.class.code || e.class.display)) || '');
    const type = lc((e.type || []).map(ccText).join(' ') + ' ' + ccText(e.serviceType));
    if (/emer|^er$/.test(cls) || /emergency|\bED\b/i.test(type)) return 'ed';
    if (/imp|inpatient|acute|nonac/.test(cls) || /inpatient/.test(type)) return 'inpatient';
    if (/obsenc|observation/.test(cls) || /observation/.test(type)) return 'observation';
    return 'other';
  }

  function parseEncounters(list, now) {
    return (list || []).filter(e => e && e.resourceType === 'Encounter' && !['entered-in-error', 'cancelled', 'planned'].includes(e.status))
      .map(e => {
        const start = toTime(e.period && e.period.start);
        if (start == null) return null;
        const kind = encounterKind(e);
        let end = toTime(e.period && e.period.end);
        const open = !end && (e.status === 'in-progress' || e.status === 'arrived' || e.status === 'triaged');
        if (!end) end = open ? now : start + (kind === 'ed' ? CONFIG.edVisitDefaultHours : 24) * HOUR;
        const disp = e.hospitalization && e.hospitalization.dischargeDisposition;
        return { id: e.id, kind, start, end, open, status: e.status, disposition: ccText(disp),
          reason: (e.reasonCode || []).map(ccText).filter(Boolean).join('; ') };
      }).filter(Boolean).sort((a, b) => a.start - b.start);
  }

  function parseMeds(list) {
    return (list || []).filter(r => r && r.resourceType === 'MedicationRequest' && ['active', 'on-hold'].includes(r.status))
      .map(r => ccText(r.medicationCodeableConcept) || (r.medicationReference && r.medicationReference.display) || '')
      .filter(Boolean);
  }
  function parseConditions(list) {
    const bad = c => /entered-in-error|refuted/.test(lc(ccText(c.verificationStatus) + ' ' + codings(c.verificationStatus).map(x => x.code).join(' ')));
    return (list || []).filter(c => c && c.resourceType === 'Condition' && !bad(c))
      .map(c => ({ text: ccText(c.code), active: !c.clinicalStatus || /active|recurrence|relapse/.test(lc(ccText(c.clinicalStatus) || codings(c.clinicalStatus).map(x => x.code).join(' '))) }))
      .filter(c => c.text);
  }

  // ------------------------------------------------------------------
  // Context: visits, today's window, baseline
  // ------------------------------------------------------------------
  function buildContext(r, opts) {
    const now = opts.now || Date.now();
    const historyMonths = opts.historyMonths || CONFIG.historyMonths;
    const from = now - historyMonths * 30.44 * DAY;
    const p = r.patient || {};
    const sex = /^f/i.test(p.gender || '') ? 'female' : (/^m/i.test(p.gender || '') ? 'male' : 'unknown');
    const age = p.birthDate ? ageAt(p.birthDate, now) : null;
    const obs = parseObservations(r.observations);
    const encounters = parseEncounters(r.encounters, now);
    const notes = (r.notes || []).filter(n => n && n.time != null).sort((a, b) => b.time - a.time);
    const conditions = parseConditions(r.conditions);
    const meds = parseMeds(r.medRequests);

    // Current visit: an open encounter, or one that started in the last 72 h.
    const recent = encounters.filter(e => e.start >= now - CONFIG.currentEncounterHours * HOUR && e.start <= now);
    const current = recent.filter(e => e.open).pop() || recent.filter(e => e.kind === 'ed').pop() || recent.pop() || null;
    const curFrom = current ? Math.min(current.start - CONFIG.visitPaddingHours * HOUR, now - 6 * HOUR) : now - CONFIG.currentHours * HOUR;
    const inCurrent = t => t >= curFrom && t <= now + HOUR;

    // ED visits in the history window; link each to an admission that followed it.
    const inpatients = encounters.filter(e => e.kind === 'inpatient' || e.kind === 'observation');
    let edVisits = encounters.filter(e => e.kind === 'ed' && e.start >= from);
    // If the server reports no ED encounters, fall back to every encounter in the window so the table isn't empty.
    const edFallback = !edVisits.length;
    if (edFallback) edVisits = encounters.filter(e => e.start >= from && e.kind !== 'other');
    const visits = edVisits.map(e => {
      const adm = inpatients.find(i => i !== e && i.start >= e.start - HOUR && i.start <= e.start + CONFIG.admitLinkHours * HOUR);
      const pad = CONFIG.visitPaddingHours * HOUR;
      const vFrom = e.start - pad, vTo = Math.max(e.end, adm ? Math.min(adm.start + DAY, adm.end) : e.end) + pad;
      const vObs = obs.filter(o => o.time >= vFrom && o.time <= vTo);
      const worst = {};
      C.MEASURES.forEach(m => {
        const vals = vObs.filter(o => o.kind === m.key).map(o => o.value);
        if (vals.length) worst[m.key] = m.worst === 'max' ? Math.max(...vals) : Math.min(...vals);
      });
      const w = vObs.filter(o => o.kind === 'weight');
      if (w.length) worst.weight = Math.min(...w.map(o => o.value));
      const vNotes = notes.filter(n => n.time >= vFrom && n.time <= vTo + DAY);
      const isCurrent = !!current && (e === current || (adm && adm === current) || (e.start >= curFrom));
      const lengthH = (e.end - e.start) / HOUR;
      return { enc: e, admission: adm || null, isCurrent, worst, notes: vNotes, lengthH,
        disposition: adm ? ('Admitted' + (adm.kind === 'observation' ? ' (observation)' : '') + (adm.open ? ', still in hospital' : ', ' + plural(Math.max(1, Math.round((adm.end - adm.start) / DAY)), 'day')))
          : (e.disposition || (e.open ? 'In ED now' : 'Discharged from ED')) };
    });

    const inpatientsInWindow = inpatients.filter(i => i.start >= from);
    return { now, from, historyMonths, patient: p, sex, age, obs, encounters, notes, conditions, meds, current, curFrom, inCurrent,
      visits, edFallback, inpatientsInWindow, gaps: r.gaps || [], failed: r.failed || [], reasons: r.reasons || {}, pending: r.pending || [] };
  }

  // Height: latest ever. BMI: from an Observation, or weight ÷ height².
  function latestHeight(ctx) {
    const h = ctx.obs.filter(o => o.kind === 'height' && o.value > 100 && o.value < 230);
    return h.length ? h[h.length - 1] : null;
  }
  function bmiSeries(ctx) {
    const h = latestHeight(ctx);
    const fromWeights = h ? ctx.obs.filter(o => o.kind === 'weight' && o.value > 20 && o.value < 250)
      .map(o => ({ kind: 'bmi', time: o.time, value: round(o.value / Math.pow(h.value / 100, 2), 1), derived: true })) : [];
    const coded = ctx.obs.filter(o => o.kind === 'bmi');
    const all = coded.concat(fromWeights.filter(d => !coded.some(c => Math.abs(c.time - d.time) < HOUR)));
    return all.sort((a, b) => a.time - b.time);
  }

  // ------------------------------------------------------------------
  // Rules
  // ------------------------------------------------------------------
  function limitFor(rule, sex) {
    if (typeof rule.value === 'number') return rule.value;
    return sex === 'male' ? rule.value.male : (sex === 'female' ? rule.value.female : Math.min(rule.value.male, rule.value.female));
  }
  function test(op, v, lim) {
    return op === '<' ? v < lim : op === '<=' ? v <= lim : op === '>' ? v > lim : v >= lim;
  }
  function levelFor(m, v, sex) {
    if (v == null) return null;
    for (const r of m.rules) {
      const lim = limitFor(r, sex);
      if (test(r.op, v, lim)) return { level: r.level, source: r.source, text: r.op + ' ' + lim };
    }
    return { level: 'ok' };
  }

  // Weight change in kg/week from two weights 10–21 days apart (latest vs earlier).
  function weightChange(ctx) {
    const w = ctx.obs.filter(o => o.kind === 'weight' && o.value > 20 && o.value < 250);
    if (w.length < 2) return null;
    const last = w[w.length - 1];
    const earlier = w.filter(o => last.time - o.time >= 10 * DAY && last.time - o.time <= 21 * DAY);
    if (!earlier.length) return null;
    const first = earlier[0];
    const weeks = (last.time - first.time) / (7 * DAY);
    return { perWeek: round((first.value - last.value) / weeks, 2), from: first, to: last };
  }
  // Percent weight lost over the last 3–6 months (highest weight 90–180 days ago vs latest).
  function lossPct(ctx) {
    const w = ctx.obs.filter(o => o.kind === 'weight' && o.value > 20 && o.value < 250);
    if (!w.length) return null;
    const last = w[w.length - 1];
    const prior = w.filter(o => last.time - o.time >= 60 * DAY && last.time - o.time <= 190 * DAY);
    if (!prior.length) return null;
    const max = Math.max(...prior.map(o => o.value));
    return max > last.value ? round((max - last.value) / max * 100, 1) : 0;
  }

  // answers: bedside entries { suicide: 'none', lyingSbp: 110, ..., qtc: 440, weight: 41 }
  function assess(ctx, answers) {
    answers = answers || {};
    const sex = ctx.sex;
    const diabetic = ctx.conditions.some(c => C.DIABETES.test(c.text));
    const todayNotes = ctx.notes.filter(n => ctx.inCurrent(n.time));
    const bmis = bmiSeries(ctx);
    const flags = [];     // { level, label, detail, source }
    const missing = [];   // things still to check

    // 1. Measured values today (worst in the current window), with the patient's usual (median of past visits).
    const pastVisits = ctx.visits.filter(v => !v.isCurrent);
    const measures = C.MEASURES.filter(m => m.onlyIf !== 'diabetes' || diabetic).map(m => {
      let series = m.key === 'bmi' ? bmis : ctx.obs.filter(o => o.kind === m.key);
      const today = series.filter(o => ctx.inCurrent(o.time));
      let value = null, time = null, entered = false;
      if (today.length) {
        const pick = today.reduce((a, b) => (m.worst === 'max' ? (b.value > a.value ? b : a) : (b.value < a.value ? b : a)));
        value = pick.value; time = pick.time;
      }
      // Bedside entries fill gaps (QTc from the ECG, a weight taken in the ED).
      if (m.key === 'qtc' && answers.qtc != null && answers.qtc !== '') { value = +answers.qtc; time = null; entered = true; }
      if (m.key === 'bmi' && value == null && answers.weight != null && answers.weight !== '') {
        const h = latestHeight(ctx);
        if (h) { value = round(+answers.weight / Math.pow(h.value / 100, 2), 1); entered = true; }
      }
      const last = series.length ? series[series.length - 1] : null;
      const usualVals = pastVisits.map(v => m.key === 'bmi' ? (v.worst.weight != null && latestHeight(ctx) ? round(v.worst.weight / Math.pow(latestHeight(ctx).value / 100, 2), 1) : null) : v.worst[m.key])
        .filter(x => x != null);
      const lv = levelFor(m, value, sex);
      const row = { key: m.key, label: m.label, unit: m.unit, value, time, entered, level: lv ? lv.level : null,
        source: lv && lv.source, limit: lv && lv.text, usual: median(usualVals), usualN: usualVals.length,
        last: (value == null && last) ? last : null };
      if (lv && lv.level !== 'ok') flags.push({ level: lv.level, label: m.label + ' ' + fmtVal(m.key, value) + ' ' + m.unit, detail: lv.text + ' ' + m.unit, source: lv.source });
      return row;
    });
    const essential = ['hr', 'sbp', 'temp', 'k', 'po4', 'glucose', 'qtc', 'bmi'];
    measures.filter(r => essential.includes(r.key) && r.value == null)
      .forEach(r => missing.push(r.key === 'qtc' ? 'ECG / QTc (enter it below if it isn’t in the chart)' : r.key === 'bmi' ? 'Weight today (enter it below)' : r.label + ' today'));
    if (!latestHeight(ctx)) missing.push('Height (no height on file, so BMI can’t be calculated)');

    // 2. Lying-to-standing change.
    const O = C.ORTHOSTATIC;
    const num = k => (answers[k] === '' || answers[k] == null || isNaN(+answers[k])) ? null : +answers[k];
    const ls = num('lyingSbp'), ss = num('standingSbp'), lh = num('lyingHr'), sh = num('standingHr');
    let ortho = null;
    if (ls != null && ss != null && lh != null && sh != null) {
      const drop = ls - ss, rise = sh - lh;
      let level = 'ok';
      const why = [];
      if (drop > O.redSbpDrop || rise > O.redHrRise || ss < O.standingSbpRed) {
        level = 'red';
        if (drop > O.redSbpDrop) why.push('SBP drop ' + drop); if (rise > O.redHrRise) why.push('HR rise ' + rise); if (ss < O.standingSbpRed) why.push('standing SBP ' + ss);
      } else if (drop > O.amberSbpDrop || rise > O.amberHrRise) {
        level = 'amber';
        if (drop > O.amberSbpDrop) why.push('SBP drop ' + drop); if (rise > O.amberHrRise) why.push('HR rise ' + rise);
      }
      ortho = { drop, rise, level };
      if (level !== 'ok') flags.push({ level, label: 'Lying-to-standing change (' + why.join(', ') + ')',
        detail: level === 'red' ? 'drop >' + O.redSbpDrop + ' mmHg, HR rise >' + O.redHrRise + ', or standing SBP <' + O.standingSbpRed : 'drop >' + O.amberSbpDrop + ' mmHg or HR rise >' + O.amberHrRise, source: O.source });
    } else missing.push('Lying and standing BP and heart rate');

    // 3. Weight change.
    const W = C.WEIGHT_LOSS;
    const wc = weightChange(ctx);
    let wLevel = null, wText = '';
    if (wc) {
      wLevel = wc.perWeek >= W.redKgPerWeek ? 'red' : wc.perWeek >= W.amberKgPerWeek ? 'amber' : 'ok';
      wText = (wc.perWeek > 0 ? 'loss ' : 'gain ') + Math.abs(wc.perWeek) + ' kg/week (' + fmtVal('weight', wc.from.value) + ' kg on ' + fmtDate(wc.from.time) + ' → ' + fmtVal('weight', wc.to.value) + ' kg on ' + fmtDate(wc.to.time) + ')';
    } else if (answers.weightTrend) {
      wLevel = answers.weightTrend; wText = { red: '≥1 kg/week (reported)', amber: '0.5–0.99 kg/week (reported)', ok: 'under 0.5 kg/week or fluctuating (reported)' }[answers.weightTrend];
    }
    if (wLevel && wLevel !== 'ok') flags.push({ level: wLevel, label: 'Weight ' + wText, detail: wLevel === 'red' ? '≥' + W.redKgPerWeek + ' kg/week' : W.amberKgPerWeek + '–' + W.redKgPerWeek + ' kg/week', source: W.source });

    // 4. Bedside questions.
    const questions = C.QUESTIONS.map(q => {
      const a = answers[q.key] || '';
      const level = a ? (q.flags[a] || 'ok') : null;
      const hints = q.noteHint ? findInNotes(todayNotes, q.noteHint).slice(0, 2) : [];
      if (level && level !== 'ok') flags.push({ level, label: q.label + ': ' + (q.options.find(o => o[0] === a) || [])[1], detail: '', source: q.source });
      if (!a && q.required) missing.push(q.label);
      return { q, answer: a, level, hints };
    });

    // 5. Refeeding risk (NICE CG32).
    const refeeding = refeedingRisk(ctx, answers, measures, bmis, diabetic);

    const reds = flags.filter(f => f.level === 'red'), ambers = flags.filter(f => f.level === 'amber');
    const verdict = reds.length ? 'red' : missing.length ? 'incomplete' : ambers.length ? 'amber' : 'clear';
    return { measures, ortho, weight: { level: wLevel, text: wText, computed: !!wc }, questions, refeeding, flags, reds, ambers, missing, verdict, diabetic, todayNotes };
  }

  function refeedingRisk(ctx, answers, measures, bmis, diabetic) {
    const R = C.REFEEDING;
    const bmiRow = measures.find(m => m.key === 'bmi');
    const bmi = bmiRow && bmiRow.value != null ? bmiRow.value : (bmis.length ? bmis[bmis.length - 1].value : null);
    const loss = lossPct(ctx);
    const intake = answers.intakeDays || '';   // '', 'lt5', '5to10', 'gt10'
    const lowLytes = ['k', 'po4', 'mg'].map(k => measures.find(m => m.key === k)).filter(m => m && m.value != null && m.level && m.level !== 'ok')
      .map(m => m.label.toLowerCase() + ' ' + fmtVal(m.key, m.value));
    const one = [], two = [];
    if (bmi != null && bmi < R.high1.bmi) one.push('BMI ' + bmi + ' (<' + R.high1.bmi + ')');
    if (loss != null && loss > R.high1.lossPct) one.push(loss + '% weight loss in 3–6 months');
    if (intake === 'gt10') one.push('little or no intake for more than 10 days');
    if (lowLytes.length) one.push('low ' + lowLytes.join(', ') + ' before feeding');
    if (bmi != null && bmi < R.high2.bmi && bmi >= R.high1.bmi) two.push('BMI ' + bmi + ' (<' + R.high2.bmi + ')');
    if (loss != null && loss > R.high2.lossPct && loss <= R.high1.lossPct) two.push(loss + '% weight loss in 3–6 months');
    if (intake === '5to10') two.push('little or no intake for 5–10 days');
    const alcohol = ctx.conditions.some(c => R.alcohol.test(c.text));
    const drugs = ctx.meds.filter(m => R.drugs.some(d => lc(m).includes(d)));
    if (alcohol || drugs.length) two.push([alcohol ? 'alcohol use' : '', drugs.length ? 'on ' + drugs.slice(0, 3).join(', ') : ''].filter(Boolean).join('; '));
    const high = one.length > 0 || two.length >= 2;
    const unknown = [];
    if (bmi == null) unknown.push('BMI');
    if (loss == null) unknown.push('weight 3–6 months ago');
    if (!intake) unknown.push('days of poor intake');
    return { high, reasons: one.length ? one : two, any: one.concat(two), unknown, bmi, loss };
  }

  // ------------------------------------------------------------------
  // History summary
  // ------------------------------------------------------------------
  function historySummary(ctx) {
    const year = ctx.now - 365 * DAY;
    const past = ctx.visits.filter(v => !v.isCurrent);
    const admitted = ctx.visits.filter(v => v.admission);
    const gaps = [];
    const starts = ctx.visits.map(v => v.enc.start).sort((a, b) => a - b);
    for (let i = 1; i < starts.length; i++) gaps.push((starts[i] - starts[i - 1]) / DAY);
    const visitRed = v => C.MEASURES.some(m => { const lv = levelFor(m, v.worst[m.key], ctx.sex); return lv && lv.level === 'red'; });
    const terms = C.HISTORY_TERMS.map(([label, re]) => ({ label, hits: findInNotes(ctx.notes, re) })).filter(t => t.hits.length);
    const services = C.SERVICES.map(([label, re]) => ({ label, hits: findInNotes(ctx.notes, re) })).filter(t => t.hits.length);
    const weights = ctx.obs.filter(o => o.kind === 'weight' && o.time >= ctx.from && o.value > 20 && o.value < 250);
    const h = latestHeight(ctx);
    // one weight per day, newest last
    const byDay = {};
    weights.forEach(w => { byDay[new Date(w.time).toDateString()] = w; });
    const weightList = Object.values(byDay).sort((a, b) => a.time - b.time)
      .map(w => ({ time: w.time, kg: w.value, bmi: h ? round(w.value / Math.pow(h.value / 100, 2), 1) : null }));
    return {
      visits12: ctx.visits.filter(v => v.enc.start >= year).length,
      visitsAll: ctx.visits.length,
      admitted12: admitted.filter(v => v.enc.start >= year).length,
      admittedAll: admitted.length,
      inpatientAll: ctx.inpatientsInWindow.length,
      medianGap: gaps.length ? round(median(gaps)) : null,
      lastPast: past.length ? past[past.length - 1] : null,
      withRed: past.filter(visitRed).length,
      pastCount: past.length,
      terms, services, weightList, visitRed,
      diagnoses: ctx.conditions.filter(c => C.ED_DIAGNOSES.test(c.text)).map(c => c.text)
    };
  }

  // ------------------------------------------------------------------
  // Care plan (placeholder)
  // ------------------------------------------------------------------
  function findCarePlan(ctx) {
    const P = C.CARE_PLAN;
    const byType = P.docTypes.length ? ctx.notes.filter(n => P.docTypes.some(t => lc(n.title) === lc(t))) : [];
    if (byType.length) return { found: true, how: 'type', note: byType[0] };
    const byTitle = ctx.notes.filter(n => P.keywords.test(n.title || ''));
    if (byTitle.length) return { found: true, how: 'title', note: byTitle[0] };
    const inText = findInNotes(ctx.notes, P.keywords);
    return { found: false, mentions: inText.slice(0, 3) };
  }

  // ------------------------------------------------------------------
  // Summary text for the note
  // ------------------------------------------------------------------
  function summaryText(ctx, a, hist, checks) {
    const L = [];
    L.push('Eating disorder ED review (adult criteria: MEED 2022 / APA 2023), ' + fmtTime(ctx.now) + '.');
    L.push('Past ' + ctx.historyMonths + ' months: ' + plural(hist.visitsAll, 'ED visit') + ' (' + hist.visits12 + ' in the last 12 months), ' +
      plural(hist.admittedAll, 'admission') + ' from the ED.');
    if (a.reds.length) L.push('Red criteria: ' + a.reds.map(f => f.label).join('; ') + '.');
    else L.push('Red criteria: none found.');
    L.push('Amber criteria: ' + (a.ambers.length ? a.ambers.map(f => f.label).join('; ') : 'none') + '.');
    if (a.missing.length) L.push('Not yet assessed: ' + a.missing.join('; ') + '.');
    L.push('Refeeding risk (NICE): ' + (a.refeeding.high ? 'HIGH — ' + a.refeeding.reasons.join('; ') : 'not high on available data' + (a.refeeding.unknown.length ? ' (unknown: ' + a.refeeding.unknown.join(', ') + ')' : '')) + '.');
    const sq = a.questions.find(x => x.q.key === 'suicide');
    L.push('Suicide / self-harm risk: ' + (sq && sq.answer ? (sq.q.options.find(o => o[0] === sq.answer) || [])[1] : 'not documented here') + '.');
    const done = (checks || []).filter(c => c.checked).map(c => c.label);
    if (done.length) L.push((a.verdict === 'red' ? 'Admission steps: ' : 'Discharge plan: ') + done.join('; ') + '.');
    L.push('Decision support only; final decision by clinical assessment.');
    return L.join('\n');
  }

  // ------------------------------------------------------------------
  // Loading
  // ------------------------------------------------------------------
  function shortError(e) {
    const m = String((e && e.message) || e || 'failed');
    const code = m.match(/^\s*(\d{3})\b/);
    if (code) {
      const c = +code[1];
      if (c === 504 || c === 503 || c === 502) return 'Cerner server timed out (' + c + ')';
      if (c === 401 || c === 403) return 'Not allowed (' + c + ') — check the app’s scopes';
      if (c === 400 || c === 422) return 'Search not supported (' + c + ')';
      return 'Server error ' + c;
    }
    return m.length > 120 ? m.slice(0, 120) + '…' : m;
  }
  function withTimeout(p, ms, label) {
    let t;
    return Promise.race([p, new Promise((_, rej) => { t = setTimeout(() => rej(new Error(label + ' timed out after ' + Math.round(ms / 1000) + ' s')), ms); })])
      .finally(() => clearTimeout(t));
  }
  async function fhirSearch(client, url, pageLimit) {
    const r = await client.request(url, { pageLimit: pageLimit || 5, flat: true });
    return Array.isArray(r) ? r : (r && r.entry ? r.entry.map(e => e.resource) : []);
  }
  function b64decode(s) {
    try { return new TextDecoder().decode(Uint8Array.from(atob(s), c => c.charCodeAt(0))); } catch (e) { return ''; }
  }
  function stripHtml(h) {
    return String(h || '').replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ').replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|li|tr|h\d)>/gi, '\n').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/[ \t]+/g, ' ').trim();
  }
  async function noteText(client, doc) {
    const atts = (doc.content || []).map(c => c.attachment).filter(Boolean);
    const att = atts.find(a => /text\/plain/.test(a.contentType || '')) || atts.find(a => /html/.test(a.contentType || '')) || atts[0];
    if (!att) return '';
    let txt = '';
    if (att.data) txt = b64decode(att.data);
    else if (att.url) {
      const r = await client.request({ url: att.url, headers: { Accept: att.contentType || 'text/plain' } });
      txt = typeof r === 'string' ? r : (r && r.data ? b64decode(r.data) : '');
    }
    return (/html/.test(att.contentType || '') || /<\w+[^>]*>/.test(txt)) ? stripHtml(txt) : txt;
  }
  async function loadNotes(client, pid, from, to) {
    let docs;
    try { docs = await fhirSearch(client, 'DocumentReference?patient=' + pid + '&_count=100', 5); }
    catch (e) { docs = await fhirSearch(client, 'DocumentReference?patient=' + pid + '&_count=50', 5); }
    const P = C.CARE_PLAN;
    const all = docs.filter(d => d.status !== 'entered-in-error')
      .map(d => ({ d, time: toTime(d.date || (d.context && d.context.period && d.context.period.start)), title: ccText(d.type) || d.description || 'Note' }))
      .filter(x => x.time != null && x.time >= from && x.time <= to)
      .sort((a, b) => b.time - a.time);
    // Always read a care-plan-looking document, then the most recent notes.
    const plan = all.filter(x => (P.docTypes.length && P.docTypes.some(t => lc(x.title) === lc(t))) || P.keywords.test(x.title)).slice(0, 2);
    const pick = plan.concat(all.filter(x => !plan.includes(x)).slice(0, CONFIG.maxNotes - plan.length));
    const texts = await Promise.allSettled(pick.map(x => withTimeout(noteText(client, x.d), CONFIG.timeouts.noteMs, 'note')));
    return pick.map((x, i) => ({ time: x.time, title: x.title, text: texts[i].status === 'fulfilled' ? texts[i].value : '' }))
      .filter(n => n.text || n.title);
  }
  function throttled(client) {
    let active = 0;
    const queue = [];
    const next = () => {
      while (active < CONFIG.maxParallel && queue.length) {
        const job = queue.shift();
        active++;
        Promise.resolve().then(job.fn).then(job.resolve, job.reject).finally(() => { active--; next(); });
      }
    };
    return { patient: client.patient,
      request: (...args) => new Promise((resolve, reject) => { queue.push({ fn: () => client.request(...args), resolve, reject }); next(); }) };
  }

  async function loadResources(rawClient, opts) {
    const client = throttled(rawClient);
    const pid = client.patient.id;
    const from = opts.from, to = opts.to, ge = fhirDate(from);
    const failed = [], pending = new Set(), reasons = {};
    const out = { patient: null, encounters: [], observations: [], conditions: [], medRequests: [], notes: [] };
    const progress = opts.onProgress || function () {};
    const FAILED = {};
    const safe = async (label, fn, ms) => {
      progress(label, 'loading');
      try {
        const v = await withTimeout(Promise.resolve().then(fn), ms || CONFIG.timeouts.searchMs, label);
        progress(label, 'done', Array.isArray(v) ? v.length : null);
        return v;
      } catch (e) {
        if (typeof console !== 'undefined') console.warn('[edr] ' + label + ' failed', e);
        progress(label, 'failed', null, shortError(e));
        reasons[label] = shortError(e);
        return FAILED;
      }
    };
    const run = async (label, key, fn, fallback, ms) => {
      pending.add(label);
      const v = await safe(label, fn, ms);
      pending.delete(label);
      if (v === FAILED) { failed.push(label); out[key] = fallback; } else out[key] = v;
    };
    const firstWorking = async (urls, pages) => {
      let last;
      const share = Math.floor(CONFIG.timeouts.searchMs / urls.length * 0.9);
      for (const u of urls) {
        try { return await withTimeout(fhirSearch(client, u, pages), share, 'Search'); } catch (e) { last = e; }
      }
      throw last;
    };
    const both = async fns => {
      const rs = await Promise.allSettled(fns.map(f => f()));
      const ok = rs.filter(r => r.status === 'fulfilled');
      if (!ok.length) throw rs[0].reason;
      return ok.flatMap(r => r.value);
    };
    await Promise.all([
      run('Patient', 'patient', () => client.patient.read(), null),
      run('Visits (encounters)', 'encounters', () => firstWorking([
        'Encounter?patient=' + pid + '&date=ge' + ge + '&_count=100',
        'Encounter?patient=' + pid + '&_count=100'], 5), []),
      run('Problem list', 'conditions', () => firstWorking([
        'Condition?patient=' + pid + '&category=problem-list-item',
        'Condition?patient=' + pid], 3), []),
      run('Medications', 'medRequests', () => fhirSearch(client, 'MedicationRequest?patient=' + pid + '&status=active&_count=100', 3), [])
    ]);
    await Promise.all([
      run('Vitals and labs', 'observations', () => firstWorking([
        'Observation?patient=' + pid + '&code=' + CODE_PARAM + '&date=ge' + ge + '&_count=100'
      ], 20).catch(() => both([
        () => fhirSearch(client, 'Observation?patient=' + pid + '&category=vital-signs&date=ge' + ge + '&_count=100', 15),
        () => fhirSearch(client, 'Observation?patient=' + pid + '&category=laboratory&date=ge' + ge + '&_count=100', 15)
      ])), [], CONFIG.timeouts.searchMs * 2),
      run('Notes', 'notes', () => loadNotes(client, pid, from, to), [], CONFIG.timeouts.notesMs)
    ]);
    return Object.assign(out, { failed, reasons, pending: Array.from(pending) });
  }

  // ------------------------------------------------------------------
  // Rendering
  // ------------------------------------------------------------------
  const LEVEL_LABEL = { red: 'Red', amber: 'Amber', ok: 'OK' };
  const badge = l => l ? '<span class="edr-badge edr-b-' + l + '">' + LEVEL_LABEL[l] + '</span>' : '<span class="edr-badge edr-b-none">No value</span>';

  function verdictHtml(a) {
    const V = {
      red: ['edr-v-red', 'Meets at least one red criterion — consider medical admission',
        'Any one red criterion is enough to consider admission (MEED / APA). Review the items below.'],
      incomplete: ['edr-v-incomplete', 'Not complete — ' + plural(a.missing.length, 'item') + ' still to check',
        'No red criteria found so far' + (a.ambers.length ? ', ' + plural(a.ambers.length, 'amber flag') : '') + '. The patient can’t be called stable until these are checked.'],
      amber: ['edr-v-amber', 'No red criteria — ' + plural(a.ambers.length, 'amber flag') + ' to review',
        'Amber means higher concern but not, on its own, a reason to admit. Review before discharge and make sure follow-up is arranged.'],
      clear: ['edr-v-clear', 'No red or amber criteria found',
        'Medically stable on the criteria checked. Follow the care plan and the discharge checklist below.']
    }[a.verdict];
    const list = a.verdict === 'red' ? a.reds : [];
    return '<section class="edr-verdict ' + V[0] + '" role="status"><h2>' + esc(V[1]) + '</h2><p>' + esc(V[2]) + '</p>' +
      (list.length ? '<ul>' + list.map(f => '<li><strong>' + esc(f.label) + '</strong>' + (f.source ? ' <span class="edr-src">(' + esc(f.source) + ')</span>' : '') + '</li>').join('') + '</ul>' : '') +
      (a.verdict === 'incomplete' ? '<ul class="edr-missing">' + a.missing.map(m => '<li>' + esc(m) + '</li>').join('') + '</ul>' : '') +
      '<p class="edr-judgment">Decision support only. Clinical assessment decides.</p></section>';
  }

  function measuresHtml(a) {
    const rows = a.measures.map(r => {
      const lvl = r.value == null ? null : r.level;
      const usual = r.usual == null ? '—' : esc(fmtVal(r.key, r.usual)) + ' <span class="edr-muted">(' + plural(r.usualN, 'visit') + ')</span>';
      const today = r.value == null
        ? '<span class="edr-muted">none today' + (r.last ? ' · last ' + esc(fmtVal(r.key, r.last.value)) + ' on ' + esc(fmtDate(r.last.time)) : '') + '</span>'
        : '<strong>' + esc(fmtVal(r.key, r.value)) + '</strong>' + (r.entered ? ' <span class="edr-muted">(entered)</span>' : (r.time ? ' <span class="edr-muted">' + esc(fmtTime(r.time)) + '</span>' : ''));
      const change = (r.value != null && r.usual != null) ? (() => {
        const d = r.value - r.usual, m = MEASURE[r.key];
        const worse = m.worst === 'max' ? d > 0 : d < 0;
        if (Math.abs(d) < Math.pow(10, -((m.decimals) || 0))) return '<span class="edr-muted">same as usual</span>';
        return '<span class="' + (worse ? 'edr-worse' : 'edr-better') + '">' + (d > 0 ? '+' : '') + esc(fmtVal(r.key, d)) + (worse ? ' worse' : '') + '</span>';
      })() : '';
      return '<tr class="edr-row-' + (lvl || 'none') + '"><th scope="row">' + esc(r.label) + ' <span class="edr-unit">' + esc(r.unit) + '</span></th>' +
        '<td>' + today + '</td><td>' + usual + '</td><td>' + change + '</td><td>' + badge(lvl) +
        (lvl && lvl !== 'ok' ? ' <span class="edr-src">' + esc(r.limit + ' · ' + r.source) + '</span>' : '') + '</td></tr>';
    }).join('');
    return '<div class="edr-table-wrap"><table class="edr-table"><thead><tr><th>Measure</th><th>Today (worst)</th><th>Usual for this patient*</th><th>Change</th><th>Flag</th></tr></thead><tbody>' +
      rows + '</tbody></table></div><p class="edr-foot">* Median of the worst value at each past ED visit in the look-back period. “Today” is the current visit' +
      ' (or the last 24 hours if there’s no open visit).</p>';
  }

  function bedsideHtml(a, answers) {
    const v = k => answers[k] == null ? '' : esc(answers[k]);
    const qtcRow = a.measures.find(m => m.key === 'qtc');
    const bmiRow = a.measures.find(m => m.key === 'bmi');
    const o = a.ortho;
    const orthoLine = o ? 'SBP drop ' + o.drop + ' mmHg, HR rise ' + o.rise + ' bpm ' + badge(o.level) : '<span class="edr-muted">Enter all four numbers.</span>';
    const qs = a.questions.map(x => {
      const q = x.q;
      return '<div class="edr-q' + (x.level && x.level !== 'ok' ? ' edr-q-' + x.level : '') + '"><label>' + esc(q.label) + (q.required ? ' <span class="edr-req">required</span>' : '') +
        '<select data-k="' + esc(q.key) + '">' + q.options.map(op => '<option value="' + esc(op[0]) + '"' + (x.answer === op[0] ? ' selected' : '') + '>' + esc(op[1]) + '</option>').join('') + '</select></label>' +
        (x.level && x.level !== 'ok' ? badge(x.level) : '') +
        (x.hints.length ? '<div class="edr-hint">Today’s notes: ' + x.hints.map(h => '“' + esc(h.excerpt) + '” (' + esc(h.title) + ', ' + esc(fmtTime(h.time)) + ')').join(' · ') + '</div>' : '') +
        '</div>';
    }).join('');
    return '<div class="edr-bedside">' +
      '<div class="edr-group"><h4>Lying and standing (after 2 min standing)</h4><div class="edr-nums">' +
      '<label>Lying SBP<input type="number" inputmode="numeric" data-k="lyingSbp" value="' + v('lyingSbp') + '"></label>' +
      '<label>Standing SBP<input type="number" inputmode="numeric" data-k="standingSbp" value="' + v('standingSbp') + '"></label>' +
      '<label>Lying HR<input type="number" inputmode="numeric" data-k="lyingHr" value="' + v('lyingHr') + '"></label>' +
      '<label>Standing HR<input type="number" inputmode="numeric" data-k="standingHr" value="' + v('standingHr') + '"></label>' +
      '</div><p class="edr-ortho">' + orthoLine + '</p></div>' +
      '<div class="edr-group"><h4>Values not in the chart</h4><div class="edr-nums">' +
      '<label>QTc (ms)' + (qtcRow && qtcRow.value != null && !qtcRow.entered ? ' <span class="edr-muted">chart: ' + esc(fmtVal('qtc', qtcRow.value)) + '</span>' : '') +
      '<input type="number" inputmode="numeric" data-k="qtc" value="' + v('qtc') + '"></label>' +
      '<label>Weight today (kg)' + (bmiRow && bmiRow.value != null && !bmiRow.entered ? ' <span class="edr-muted">BMI in chart</span>' : '') +
      '<input type="number" inputmode="decimal" step="0.1" data-k="weight" value="' + v('weight') + '"></label>' +
      '</div>' +
      (a.weight.computed ? '<p class="edr-muted">Weight change from the chart: ' + esc(a.weight.text) + ' ' + badge(a.weight.level) + '</p>' :
        '<label class="edr-inline">Weight change over the last 2 weeks <select data-k="weightTrend">' +
        [['', 'Not known'], ['ok', 'Under 0.5 kg/week or fluctuating'], ['amber', '0.5–0.99 kg/week'], ['red', '1 kg/week or more']]
          .map(op => '<option value="' + op[0] + '"' + ((answers.weightTrend || '') === op[0] ? ' selected' : '') + '>' + esc(op[1]) + '</option>').join('') + '</select></label>') +
      '<label class="edr-inline">Days with little or no intake <select data-k="intakeDays">' +
      [['', 'Not known'], ['lt5', 'Under 5 days'], ['5to10', '5–10 days'], ['gt10', 'More than 10 days']]
        .map(op => '<option value="' + op[0] + '"' + ((answers.intakeDays || '') === op[0] ? ' selected' : '') + '>' + esc(op[1]) + '</option>').join('') + '</select></label>' +
      '</div>' +
      '<div class="edr-group"><h4>Bedside questions</h4>' + qs + '</div>' +
      '<p class="edr-foot">Entries stay on this screen only. Nothing is saved to the chart or the browser.</p></div>';
  }

  function refeedingHtml(r) {
    return '<section class="edr-card ' + (r.high ? 'edr-card-red' : '') + '"><h3>Refeeding risk (NICE CG32) ' +
      (r.high ? '<span class="edr-badge edr-b-red">High</span>' : '<span class="edr-badge edr-b-ok">Not high</span>') + '</h3>' +
      (r.high ? '<p>High risk because: ' + esc(r.reasons.join('; ')) + '.</p><p class="edr-action">→ If admitting or feeding: refeeding precautions per local protocol (thiamine before feeding; check potassium, phosphate, magnesium and glucose before and during the first days of feeding).</p>'
        : '<p>' + (r.any.length ? 'One minor factor: ' + esc(r.any.join('; ')) + '. ' : '') + 'High risk = one major factor (BMI <16, >15% loss in 3–6 months, >10 days of little intake, low K/PO₄/Mg) or two minor ones.</p>') +
      (r.unknown.length ? '<p class="edr-muted">Not known: ' + esc(r.unknown.join(', ')) + '.</p>' : '') + '</section>';
  }

  const ADMIT_CHECKS = [
    'Admission reason documented against the red criteria',
    'Cardiac monitoring if HR <40, prolonged QTc, arrhythmia, or low K/PO₄/Mg',
    'Refeeding precautions started if refeeding risk is high',
    'Electrolytes, glucose and weight to be checked daily at first',
    'Eating disorder program / psychiatry informed',
    'If the patient declines admission while at high risk: capacity assessed; Mental Health Act considered'
  ];
  const DISCHARGE_CHECKS = [
    'Care plan reviewed and followed',
    'Low electrolytes replaced in the ED and repeat bloodwork arranged',
    'Follow-up arranged with the eating disorder program or family doctor (who and when)',
    'Safety plan reviewed; crisis line given (9-8-8 Suicide Crisis Helpline; BC 310-6789 Mental Health Support)',
    'Return advice given: fainting, chest pain or palpitations, unable to eat or drink, thoughts of self-harm',
    'Outpatient team told about this visit'
  ];

  function decisionHtml(a, checks) {
    const red = a.verdict === 'red';
    const list = red ? ADMIT_CHECKS : DISCHARGE_CHECKS;
    return '<section class="edr-card"><h3>' + (red ? 'If admitting' : 'If discharging') + '</h3>' +
      (red ? '' : '<p class="edr-muted">For patients who come to the ED often, a consistent response that follows the care plan works best. Use this list when the red criteria are clear and the required items are checked.</p>') +
      '<ul class="edr-checks">' + list.map((t, i) => '<li><label><input type="checkbox" data-check="' + i + '"' + (checks[i] ? ' checked' : '') + '> ' + esc(t) + '</label></li>').join('') + '</ul>' +
      (a.ambers.length ? '<div class="edr-ambers"><strong>Amber flags to review:</strong><ul>' + a.ambers.map(f => '<li>' + esc(f.label) + (f.source ? ' <span class="edr-src">(' + esc(f.source) + ')</span>' : '') + '</li>').join('') + '</ul></div>' : '') +
      '</section>';
  }

  function carePlanHtml(cp) {
    if (cp.found) {
      const n = cp.note;
      return '<section class="edr-card edr-card-plan"><h3>Care plan</h3><p><strong>' + esc(n.title) + '</strong> · ' + esc(fmtDate(n.time)) +
        (cp.how === 'title' ? ' <span class="edr-muted">(found by its title; confirm it’s the current plan)</span>' : '') + '</p>' +
        '<details><summary>Show the text</summary><pre class="edr-pre">' + esc((n.text || '').slice(0, 4000)) + ((n.text || '').length > 4000 ? '\n…' : '') + '</pre></details></section>';
    }
    return '<section class="edr-card edr-card-placeholder"><h3>Care plan <span class="edr-badge edr-b-none">Placeholder</span></h3>' +
      '<p>The location of this patient’s care plan in PowerChart isn’t set up yet, so it can’t be shown here. Check the chart directly.</p>' +
      (cp.mentions.length ? '<p class="edr-muted">Notes that mention a care plan: ' + cp.mentions.map(h => '“' + esc(h.excerpt) + '” (' + esc(h.title) + ', ' + esc(fmtDate(h.time)) + ')').join(' · ') + '</p>' : '') +
      '<p class="edr-foot">To set it up: once you know the care plan’s document type in PowerChart, add it to <code>CARE_PLAN.docTypes</code> in edr-criteria.js.</p></section>';
  }

  function historyHtml(ctx, h) {
    const metric = (label, value, sub) => '<div class="edr-metric"><div class="edr-metric-label">' + esc(label) + '</div><div class="edr-metric-value">' + value + '</div>' + (sub ? '<div class="edr-metric-sub">' + sub + '</div>' : '') + '</div>';
    const out = [];
    out.push('<div class="edr-metrics">' +
      metric('ED visits, last 12 months', h.visits12, 'all ' + ctx.historyMonths + ' months: ' + h.visitsAll) +
      metric('Admitted from the ED', h.admittedAll, h.visitsAll ? Math.round(h.admittedAll / h.visitsAll * 100) + '% of visits' : '') +
      metric('Typical gap between visits', h.medianGap == null ? '—' : plural(h.medianGap, 'day'), 'median') +
      metric('Past visits with a red value', h.withRed, 'of ' + h.pastCount) +
      '</div>');
    if (ctx.edFallback && ctx.visits.length) out.push('<p class="edr-note">No encounters were marked as emergency, so all visits are listed.</p>');
    if (h.diagnoses.length) out.push('<p><strong>On the problem list:</strong> ' + esc(h.diagnoses.join('; ')) + '</p>');
    if (h.terms.length) out.push('<div class="edr-sub"><h4>Found in past notes</h4><ul>' + h.terms.map(t => '<li><strong>' + esc(t.label) + '</strong> — ' +
      plural(t.hits.length, 'note') + ', latest ' + esc(fmtDate(t.hits[0].time)) + ': “' + esc(t.hits[0].excerpt) + '”</li>').join('') + '</ul></div>');
    if (h.services.length) out.push('<div class="edr-sub"><h4>Services involved (from notes)</h4><p>' + h.services.map(s => esc(s.label) + ' <span class="edr-muted">(latest ' + esc(fmtDate(s.hits[0].time)) + ')</span>').join(' · ') + '</p></div>');
    const keys = ['hr', 'sbp', 'temp', 'k', 'po4', 'glucose', 'qtc'];
    if (ctx.visits.length) {
      const rows = ctx.visits.slice().reverse().map(v => {
        const cells = keys.map(k => {
          const val = v.worst[k];
          const lv = val == null ? null : levelFor(MEASURE[k], val, ctx.sex);
          return '<td class="edr-c-' + (lv ? lv.level : 'none') + '">' + (val == null ? '<span class="edr-muted">—</span>' : esc(fmtVal(k, val))) + '</td>';
        }).join('');
        const hgt = latestHeight(ctx);
        const bmi = v.worst.weight != null && hgt ? round(v.worst.weight / Math.pow(hgt.value / 100, 2), 1) : null;
        const lvB = bmi == null ? null : levelFor(MEASURE.bmi, bmi, ctx.sex);
        return '<tr' + (v.isCurrent ? ' class="edr-current"' : '') + '><th scope="row">' + esc(fmtDate(v.enc.start)) + (v.isCurrent ? ' <span class="edr-badge edr-b-now">Now</span>' : '') +
          '</th><td>' + esc(v.disposition) + '</td>' + cells +
          '<td class="edr-c-' + (lvB ? lvB.level : 'none') + '">' + (bmi == null ? (v.worst.weight != null ? esc(fmtVal('weight', v.worst.weight)) + ' kg' : '<span class="edr-muted">—</span>') : esc(bmi)) + '</td>' +
          '<td class="edr-reason">' + esc(v.enc.reason || (v.notes[0] ? v.notes[0].title : '')) + '</td></tr>';
      }).join('');
      out.push('<div class="edr-table-wrap"><table class="edr-table edr-hist"><thead><tr><th>Visit</th><th>Outcome</th><th>HR</th><th>SBP</th><th>Temp</th><th>K</th><th>PO₄</th><th>Glucose</th><th>QTc</th><th>BMI</th><th>Reason / first note</th></tr></thead><tbody>' +
        rows + '</tbody></table></div><p class="edr-foot">Worst value at each visit. Red and amber cells use today’s criteria.</p>');
    } else out.push('<p class="edr-muted">No visits found in the last ' + ctx.historyMonths + ' months.</p>');
    if (h.weightList.length) {
      const wl = h.weightList.slice(-12);
      out.push('<div class="edr-sub"><h4>Weights</h4><p class="edr-weights">' + wl.map(w => esc(fmtDate(w.time)) + ': <strong>' + esc(fmtVal('weight', w.kg)) + ' kg</strong>' + (w.bmi != null ? ' (BMI ' + esc(w.bmi) + ')' : '')).join(' · ') +
        (h.weightList.length > 12 ? ' <span class="edr-muted">(last 12 of ' + h.weightList.length + ')</span>' : '') + '</p></div>');
    }
    return out.join('');
  }

  function render(ctx, a, hist, cp, state) {
    const H = [];
    H.push('<div class="edr">');
    if (ctx.failed.length) {
      H.push('<div class="edr-incomplete" role="alert"><strong>Incomplete:</strong> some data didn’t load, so results may be missing. <button type="button" class="edr-retry">Try again</button><ul>' +
        ctx.failed.map(f => '<li>' + esc(f) + (ctx.reasons[f] ? ' — ' + esc(ctx.reasons[f]) : '') + '</li>').join('') + '</ul></div>');
    }
    if (ctx.age != null && ctx.age < 18) H.push('<div class="edr-incomplete" role="alert"><strong>This patient is under 18.</strong> These are adult criteria; use the paediatric (MEED / SAHM) thresholds instead.</div>');
    H.push(verdictHtml(a));
    H.push('<section class="edr-section"><h3 class="edr-h">1. Today</h3>' + measuresHtml(a) + '</section>');
    H.push('<section class="edr-section"><h3 class="edr-h">2. Bedside assessment</h3>' + bedsideHtml(a, state.answers) + '</section>');
    H.push('<section class="edr-section"><h3 class="edr-h">3. Decision</h3>' + refeedingHtml(a.refeeding) + decisionHtml(a, state.checks) +
      '<section class="edr-card"><h3>Summary for the note</h3><textarea class="edr-summary" rows="9" readonly>' + esc(summaryText(ctx, a, hist,
        (a.verdict === 'red' ? ADMIT_CHECKS : DISCHARGE_CHECKS).map((label, i) => ({ label, checked: !!state.checks[i] })))) + '</textarea>' +
      '<button type="button" class="edr-copy">Copy summary</button> <span class="edr-copied" aria-live="polite"></span></section></section>');
    H.push('<section class="edr-section"><h3 class="edr-h">4. Care plan</h3>' + carePlanHtml(cp) + '</section>');
    H.push('<section class="edr-section"><h3 class="edr-h">5. Past visits (' + ctx.historyMonths + ' months)</h3>' + historyHtml(ctx, hist) + '</section>');
    H.push('<p class="edr-disclaimer">Decision support only, from data available through FHIR and what you enter here. Adult criteria: ' +
      '<a href="' + LINKS.meed + '" target="_blank" rel="noopener">MEED 2022 (RCPsych CR233)</a>, ' +
      '<a href="' + LINKS.apa + '" target="_blank" rel="noopener">APA 2023 guideline</a>, refeeding risk <a href="' + LINKS.nice + '" target="_blank" rel="noopener">NICE CG32</a>. ' +
      'Thresholds are in edr-criteria.js. Tested on made-up patients only.</p>');
    H.push('</div>');
    return H.join('');
  }

  // ------------------------------------------------------------------
  // Mount
  // ------------------------------------------------------------------
  async function mount(container, client, opts) {
    opts = opts || {};
    const gen = (container.__edrGen || 0) + 1;
    container.__edrGen = gen;
    const current = () => container.__edrGen === gen;
    const now = opts.now || Date.now();
    const historyMonths = opts.historyMonths || CONFIG.historyMonths;
    const from = now - historyMonths * 30.44 * DAY;
    const pid = (client && client.patient && client.patient.id) || opts.patientKey || 'demo';
    // Bedside entries survive a Refresh for the same patient (kept in memory only).
    if (container.__edrPid !== pid) { container.__edrPid = pid; container.__edrState = { answers: {}, checks: {} }; }
    const state = container.__edrState;
    const status = {};
    const drawProgress = () => {
      if (!current()) return;
      const icon = { loading: '…', done: '✓', failed: '✗' };
      container.innerHTML = '<div class="edr"><p class="edr-loading">Loading ' + historyMonths + ' months of visits, vitals, labs and notes…</p><ul class="edr-progress">' +
        Object.keys(status).map(k => '<li class="edr-prog-' + status[k].state + '"><span>' + icon[status[k].state] + '</span>' + esc(k) +
          (status[k].state === 'done' && status[k].count != null ? ' (' + status[k].count + ')' : '') +
          (status[k].state === 'failed' ? ' — ' + esc(status[k].msg || 'failed') : '') + '</li>').join('') + '</ul></div>';
    };
    const onProgress = (label, st, count, msg) => { status[label] = { state: st, count, msg }; drawProgress(); };
    container.innerHTML = '<div class="edr"><p class="edr-loading">Loading…</p></div>';
    const loader = opts.loader || ((f, t) => loadResources(client, { from: f, to: t, onProgress }));
    let res;
    try { res = await loader(from, now); }
    catch (e) {
      if (current()) container.innerHTML = '<div class="edr"><p class="edr-error">Couldn’t load the data. ' + esc(shortError(e)) + '</p></div>';
      throw e;
    }
    if (!current()) return null;
    const ctx = buildContext(res, { now, historyMonths });
    const hist = historySummary(ctx);
    const cp = findCarePlan(ctx);
    let scrollY = 0;
    const draw = (focusKey) => {
      const a = assess(ctx, state.answers);
      container.innerHTML = render(ctx, a, hist, cp, state);
      wire();
      if (focusKey) {
        const el = container.querySelector('[data-k="' + focusKey + '"]');
        if (el) { el.focus(); if (el.setSelectionRange && el.type === 'text') el.setSelectionRange(el.value.length, el.value.length); }
      }
      return a;
    };
    const wire = () => {
      container.querySelectorAll('[data-k]').forEach(el => {
        const k = el.getAttribute('data-k');
        const ev = el.tagName === 'SELECT' ? 'change' : 'change';
        el.addEventListener(ev, () => {
          state.answers[k] = el.value;
          scrollY = (typeof window !== 'undefined') ? window.scrollY : 0;
          draw(null);
          if (typeof window !== 'undefined') window.scrollTo(0, scrollY);
        });
      });
      container.querySelectorAll('[data-check]').forEach(el => {
        el.addEventListener('change', () => {
          state.checks[el.getAttribute('data-check')] = el.checked;
          scrollY = (typeof window !== 'undefined') ? window.scrollY : 0;
          draw(null);
          if (typeof window !== 'undefined') window.scrollTo(0, scrollY);
        });
      });
      const cb = container.querySelector('.edr-copy');
      if (cb) cb.addEventListener('click', async () => {
        const ta = container.querySelector('.edr-summary');
        const done = container.querySelector('.edr-copied');
        try { await navigator.clipboard.writeText(ta.value); done.textContent = 'Copied.'; }
        catch (e) { ta.removeAttribute('readonly'); ta.select(); ta.setAttribute('readonly', ''); done.textContent = 'Press Ctrl+C to copy.'; }
      });
      const rb = container.querySelector('.edr-retry');
      if (rb) rb.addEventListener('click', () => { mount(container, client, Object.assign({}, opts, { now: undefined })).catch(() => {}); });
    };
    const a = draw(null);
    return { ctx, assessment: a, history: hist, carePlan: cp };
  }

  return { CONFIG, LINKS, LOINC, mount, loadResources, buildContext, assess, historySummary, findCarePlan, summaryText, kindOf, toSI, levelFor, render };
});
