/*
 * dm.js — Inpatient Diabetes (hospitalist), Type 1 and Type 2 views.
 * SMART on FHIR (Oracle Health / Cerner Millennium R4). Read-only: nothing is written to the chart.
 *
 * Sections: glucose and insulin day view · lows (what likely caused them, treatment, risk) · dose suggestions
 * (proposals to approve, calculations shown) · IV insulin / DKA transition · discharge plan (A1C-guided; non-insulin
 * options checked against eGFR, HF, CVD, CKD and lows) · vascular protection (A1C, LDL, BP, ACR, statin, ACEi/ARB, ASA,
 * SGLT2i/GLP-1 RA) · summary for the note.
 *
 * Usage: DM.mount(container, client, { lookbackDays: 7 })   Options: lookbackDays, loader (demo), now (tests), patientKey
 * Rules are in dm-criteria.js (load it first).
 */
(function (root, factory) {
  const crit = (typeof module === 'object' && module.exports) ? require('./dm-criteria.js') : root.DMCriteria;
  const api = factory(crit);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DM = api;
})(typeof self !== 'undefined' ? self : this, function (C) {
  'use strict';
  if (!C) throw new Error('dm-criteria.js must be loaded before dm.js');

  const MIN = 60 * 1000, HOUR = 60 * MIN, DAY = 24 * HOUR;
  const CONFIG = { lookbackDays: 7, maxNotes: 25, timeouts: { searchMs: 60000, notesMs: 90000, noteMs: 15000 }, maxParallel: 4, extraCodes: {} };
  const LOINC = {
    glucose: ['2345-7', '2339-0', '41653-7', '14749-6', '15074-8', '2341-6', '41651-1'], a1c: ['4548-4', '17856-6', '59261-8'],
    ldl: ['13457-7', '2089-1', '18262-6'], egfr: ['33914-3', '62238-1', '48642-3', '48643-1', '88293-6', '98979-8'], creat: ['2160-0', '38483-4'],
    acr: ['9318-7', '14959-1', '14958-3'], k: ['2823-3', '6298-4'], hco3: ['1963-8', '2028-9'], ketone: ['53060-9', '33903-6', '2514-8'],
    weight: ['29463-7', '3141-9'], sbp: ['8480-6', '8459-0'], dbp: ['8462-4', '8453-3']
  };

  // ------------------------------------------------------------------ utilities
  const lc = s => (s == null ? '' : String(s)).toLowerCase();
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const toTime = v => { const t = v ? Date.parse(v) : NaN; return isNaN(t) ? null : t; };
  const pad2 = n => String(n).padStart(2, '0');
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const fmtTime = t => { const d = new Date(t); return MONTHS[d.getMonth()] + ' ' + d.getDate() + ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes()); };
  const fmtDate = t => { const d = new Date(t); return MONTHS[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear(); };
  const fmtDay = t => { const d = new Date(t); return DAYS[d.getDay()] + ' ' + MONTHS[d.getMonth()] + ' ' + d.getDate(); };
  const round = (v, d = 0) => { const f = Math.pow(10, d); return Math.round(v * f) / f; };
  const fhirDate = t => new Date(t).toISOString().replace(/\.\d{3}Z$/, 'Z');
  const codings = cc => (cc && cc.coding) || [];
  const ccText = cc => !cc ? '' : (cc.text || (codings(cc).find(c => c.display) || {}).display || '');
  const plural = (n, w) => n + ' ' + w + (n === 1 ? '' : 's');
  const dayStart = t => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
  const hourOf = t => new Date(t).getHours() + new Date(t).getMinutes() / 60;
  const slotOf = t => { const h = hourOf(t); return C.SLOTS.find(s => h >= s.from && h < s.to); };
  const mealOfDose = t => { const h = hourOf(t); return h >= 5 && h < 10.5 ? 'breakfast' : h >= 10.5 && h < 15 ? 'lunch' : h >= 15 && h < 21 ? 'supper' : 'bedtime'; };
  const NEG = /\b(?:no|not|denies|denied|without|negative for|nil|absent|never|resolved)\b[^.;:\n]{0,30}$/i;
  function ageAt(b, t) { const x = new Date(b), d = new Date(t); let a = d.getFullYear() - x.getFullYear(); if (d.getMonth() < x.getMonth() || (d.getMonth() === x.getMonth() && d.getDate() < x.getDate())) a--; return a; }
  function findIn(items, re, opts) {
    opts = opts || {};
    const out = [];
    for (const n of items || []) {
      const t = (n.title ? n.title + '\n' : '') + (n.text || '');
      const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
      let m;
      while ((m = g.exec(t))) {
        if (opts.allowNegated || !NEG.test(t.slice(Math.max(0, m.index - 40), m.index))) {
          const s = Math.max(0, m.index - 50), e = Math.min(t.length, m.index + m[0].length + 60);
          out.push({ time: n.time, title: n.title, match: m[0], excerpt: (s > 0 ? '…' : '') + t.slice(s, e).replace(/\s+/g, ' ').trim() + (e < t.length ? '…' : '') });
          break;
        }
        if (m.index === g.lastIndex) g.lastIndex++;
      }
    }
    return out.sort((a, b) => b.time - a.time);
  }
  const quote = h => '“' + h.excerpt + '” (' + (h.title || 'note') + ', ' + fmtTime(h.time) + ')';

  // ------------------------------------------------------------------ parsing
  function kindOf(cc) {
    const cods = codings(cc);
    for (const k of Object.keys(CONFIG.extraCodes || {})) { const l = CONFIG.extraCodes[k] || []; if (cods.some(c => l.includes((c.system || '') + '|' + c.code) || l.includes(c.code))) return k; }
    const loinc = cods.filter(c => !c.system || /loinc/i.test(c.system)).map(c => c.code);
    for (const k of Object.keys(LOINC)) if (loinc.some(code => LOINC[k].includes(code))) return k;
    const t = lc(ccText(cc) + ' ' + cods.map(c => c.display || '').join(' '));
    if (!t.trim()) return null;
    if (/a1c|glycated|glycosylated/.test(t)) return 'a1c';
    if (/glucose|\bbg\b|\bpoc(?:t)? glu|capillary blood/.test(t) && !/urine|csf|tolerance/.test(t)) return 'glucose';
    if (/\bldl\b|low density/.test(t)) return 'ldl';
    if (/egfr|glomerular filtration/.test(t)) return 'egfr';
    if (/creatinine/.test(t) && !/urine|ratio|clearance|kinase/.test(t)) return 'creat';
    if (/albumin.*creatinine|\bacr\b/.test(t)) return 'acr';
    if (/\bpotassium\b/.test(t) && !/urine/.test(t)) return 'k';
    if (/bicarbonate|total co2|\bhco3\b/.test(t)) return 'hco3';
    if (/hydroxybutyrate|ketone/.test(t) && !/urine/.test(t)) return 'ketone';
    if (/(?:body )?weight/.test(t) && !/birth|ideal/.test(t)) return 'weight';
    if (/systolic/.test(t)) return 'sbp';
    if (/diastolic/.test(t)) return 'dbp';
    return null;
  }
  function toSI(kind, n, unit) {
    if (n == null) return null;
    const u = lc(unit).replace(/\s/g, '');
    if (kind === 'glucose' && (/mg\/dl/.test(u) || n > 45)) return round(n / 18.016, 1);
    if (kind === 'ldl' && (/mg\/dl/.test(u) || n > 15)) return round(n / 38.67, 2);
    if (kind === 'a1c' && (/mmol\/mol/.test(u) || n > 25)) return round(n / 10.929 + 2.15, 1);
    if (kind === 'a1c' && n < 0.25) return round(n * 100, 1);
    if (kind === 'creat' && (/mg\/dl/.test(u) || n < 20)) return round(n * 88.42);
    if (kind === 'weight' && /lb|\[lb/.test(u)) return round(n * 0.4536, 1);
    if (kind === 'acr' && /mg\/g/.test(u)) return round(n / 8.84, 1);
    return n;
  }
  function parseObservations(list) {
    const out = [], seen = new Set();
    for (const o of list || []) {
      if (!o || o.resourceType !== 'Observation' || ['entered-in-error', 'cancelled'].includes(o.status)) continue;
      const time = toTime(o.effectiveDateTime || (o.effectivePeriod && o.effectivePeriod.start) || o.issued);
      if (time == null) continue;
      [{ cc: o.code, src: o }].concat((o.component || []).map(c => ({ cc: c.code, src: c }))).forEach(e => {
        const kind = kindOf(e.cc); if (!kind) return;
        const s = e.src;
        let n = null, unit = '';
        if (s.valueQuantity && typeof s.valueQuantity.value === 'number') { n = s.valueQuantity.value; unit = s.valueQuantity.unit || s.valueQuantity.code || ''; }
        else if (typeof s.valueString === 'string') { const m = s.valueString.match(/[<>]?\s*(\d+(?:\.\d+)?)/); if (m) n = +m[1]; if (/^\s*</.test(s.valueString) && kind === 'glucose') n = Math.min(n, 1.5); }
        const v = toSI(kind, n, unit); if (v == null) return;
        const id = kind + time + v; if (seen.has(id)) return; seen.add(id);
        out.push({ kind, time, value: v });
      });
    }
    return out.sort((a, b) => a.time - b.time);
  }
  const medName = r => ccText(r.medicationCodeableConcept) || (r.medicationReference && r.medicationReference.display) || '';
  function unitsFrom(text) { const m = String(text || '').match(/(\d+(?:\.\d+)?)\s*(?:units?|u)\b/i); return m ? +m[1] : null; }
  function insulinKind(name, text) {
    const s = name + ' ' + (text || '');
    if (C.INSULIN.iv.test(s)) return 'iv';
    if (C.INSULIN.premix.test(s)) return 'premix';
    if (C.INSULIN.basal.test(name)) return C.INSULIN.nph.test(name) ? 'nph' : 'basal';
    if (C.INSULIN.rapid.test(name)) return C.INSULIN.correction.test(text || '') && !C.INSULIN.meal.test(text || '') ? 'correction' : (C.INSULIN.correction.test(text || '') ? 'correction' : 'bolus');
    if (/\binsulin\b/i.test(name)) return 'other';
    return null;
  }

  // ------------------------------------------------------------------ context
  function buildContext(r, opts) {
    const now = opts.now || Date.now();
    const p = r.patient || {};
    const age = p.birthDate ? ageAt(p.birthDate, now) : null;
    const sex = /^f/i.test(p.gender || '') ? 'female' : /^m/i.test(p.gender || '') ? 'male' : 'unknown';
    const obs = parseObservations(r.observations);
    const notes = (r.notes || []).filter(n => n && n.time != null).sort((a, b) => b.time - a.time);
    const meds = (r.medRequests || []).filter(x => x && x.resourceType === 'MedicationRequest' && ['active', 'on-hold'].includes(x.status)).map(x => {
      const name = medName(x);
      const text = (x.dosageInstruction || []).map(d => [d.text, ccText(d.timing && d.timing.code), d.asNeededBoolean ? 'prn' : ''].filter(Boolean).join(' ')).join(' ');
      const dq = (x.dosageInstruction || []).map(d => ((d.doseAndRate || [])[0] || {}).doseQuantity).find(Boolean);
      return { name, text, status: x.status, time: toTime(x.authoredOn), units: dq && typeof dq.value === 'number' && /unit/i.test((dq.unit || dq.code || 'unit')) ? dq.value : unitsFrom(text) || unitsFrom(name), ins: insulinKind(name, text) };
    }).filter(m => m.name);
    const admins = (r.medAdmins || []).filter(x => x && x.resourceType === 'MedicationAdministration' && !['not-done', 'entered-in-error'].includes(x.status)).map(x => {
      const name = medName(x);
      const text = (x.dosage && x.dosage.text) || '';
      const dose = x.dosage && x.dosage.dose && typeof x.dosage.dose.value === 'number' ? x.dosage.dose.value : unitsFrom(text);
      return { name, text, time: toTime(x.effectiveDateTime || (x.effectivePeriod && x.effectivePeriod.start)), units: dose, ins: insulinKind(name, text) };
    }).filter(a => a.name && a.time != null).sort((a, b) => a.time - b.time);
    const conditions = (r.conditions || []).filter(c => c && c.resourceType === 'Condition').map(c => ({ text: ccText(c.code), time: toTime(c.onsetDateTime || c.recordedDate) })).filter(c => c.text);
    const orders = (r.orders || []).filter(x => x && (x.resourceType === 'ServiceRequest' || x.resourceType === 'NutritionOrder') && !['entered-in-error', 'revoked', 'completed'].includes(x.status))
      .map(x => ({ title: ccText(x.code) || ((x.oralDiet && (x.oralDiet.type || []).map(ccText).join(' ')) || '') || 'Order', text: ccText(x.code) + ' ' + (x.oralDiet ? (x.oralDiet.type || []).map(ccText).join(' ') : ''), time: toTime(x.authoredOn || x.dateTime) || now }));
    const encs = (r.encounters || []).filter(e => e && e.period && e.period.start).map(e => ({ start: toTime(e.period.start), open: !e.period.end })).sort((a, b) => a.start - b.start);
    const admit = (encs.filter(e => e.open).pop() || encs[encs.length - 1] || {}).start || null;
    return { now, patient: p, age, sex, obs, notes, meds, admins, conditions, orders, admit, failed: r.failed || [], reasons: r.reasons || {} };
  }

  const latest = (ctx, kind, sinceMs) => { const l = ctx.obs.filter(o => o.kind === kind && (!sinceMs || o.time >= sinceMs)); return l.length ? l[l.length - 1] : null; };

  // ------------------------------------------------------------------ analysis
  function analyse(ctx, ans) {
    ans = ans || {};
    const K = C.CONDITIONS, now = ctx.now;
    const has = re => ctx.conditions.some(c => re.test(c.text));
    const autoType = has(K.type1) ? 1 : has(K.type2) ? 2 : null;
    const type = ans.type ? +ans.type : (autoType || 2);
    const weightObs = latest(ctx, 'weight');
    const weight = ans.weight ? +ans.weight : (weightObs ? weightObs.value : null);
    const egfr = latest(ctx, 'egfr');
    const a1c = latest(ctx, 'a1c', now - 120 * DAY) || latest(ctx, 'a1c');
    const glucose = ctx.obs.filter(o => o.kind === 'glucose');
    const ivInsulin = ctx.admins.filter(a => a.ins === 'iv' && a.time >= now - DAY).length > 0 || ctx.meds.some(m => m.ins === 'iv');
    const dka = !!findIn(ctx.notes.filter(n => n.time >= now - 3 * DAY), C.TEXT.dka)[0] || has(/ketoacidosis|\bDKA\b|\bHHS\b/i);
    const npo = ans.npo ? ans.npo === 'yes' : (ctx.orders.some(o => C.TEXT.npo.test(o.text)) || !!findIn(ctx.notes.filter(n => n.time >= now - DAY), C.TEXT.npo)[0]);
    const poorIntake = !!findIn(ctx.notes.filter(n => n.time >= now - DAY), C.TEXT.poorIntake)[0];
    const tubeFeed = !!findIn(ctx.notes.filter(n => n.time >= now - 2 * DAY), C.TEXT.tubeFeed)[0] || ctx.orders.some(o => C.TEXT.tubeFeed.test(o.text));
    const pump = has(K.pump) || !!findIn(ctx.notes, K.pump)[0];
    const cgm = has(K.cgm) || !!findIn(ctx.notes, K.cgm)[0];
    const steroids = ctx.meds.filter(m => C.DRUGS.steroid.test(m.name));
    const predEq = steroids.reduce((sum, m) => {
      const drug = Object.keys(C.DOSING.steroidEquivalents).find(d => lc(m.name).includes(d));
      const mg = (String(m.name + ' ' + m.text).match(/(\d+(?:\.\d+)?)\s*mg/i) || [])[1];
      return sum + (drug && mg ? +mg * C.DOSING.steroidEquivalents[drug] : 0);
    }, 0);
    const agentsOn = C.AGENTS.filter(ag => ag.key !== 'insulin' && ctx.meds.some(m => ag.match.test(m.name)));
    const onInsulin = ctx.meds.some(m => m.ins) || ctx.admins.some(a => a.ins && a.time >= now - 2 * DAY);
    const dmYears = ans.dmYears ? +ans.dmYears : (() => { const c = ctx.conditions.find(c => K.diabetes.test(c.text) && c.time); return c ? Math.floor((now - c.time) / (365.25 * DAY)) : null; })();
    return { type, autoType, weight, weightObs, egfr, a1c, glucose, ivInsulin, dka, npo, poorIntake, tubeFeed, pump, cgm, steroids, predEq, agentsOn, onInsulin, dmYears,
      cvd: has(K.cvd), hf: has(K.hf), ckd: has(K.ckd) || (egfr && egfr.value < 60), retinopathy: has(K.retinopathy), neuropathy: has(K.neuropathy),
      nephropathy: has(K.nephropathy) || ((latest(ctx, 'acr') || {}).value >= C.VASCULAR.acrHigh), lvh: has(K.lvh), htn: has(K.htn), smoker: has(K.smoker),
      dyslipidemia: has(K.dyslipidemia), mtc: has(K.mtc), pancreatitis: has(K.pancreatitis), bladderCa: has(K.bladderCa), dementia: has(K.dementia) };
  }

  // Day view: last 3 days, glucose per slot and insulin per type.
  function dayView(ctx, A) {
    const out = [];
    for (let i = 2; i >= 0; i--) {
      const d0 = dayStart(ctx.now) - i * DAY, d1 = d0 + DAY;
      const g = A.glucose.filter(o => o.time >= d0 && o.time < d1);
      const slots = {};
      C.SLOTS.forEach(s => { const v = g.filter(o => slotOf(o.time).key === s.key).map(o => o.value); slots[s.key] = v; });
      const ins = ctx.admins.filter(a => a.ins && a.time >= d0 && a.time < d1);
      const sum = k => round(ins.filter(a => (Array.isArray(k) ? k.includes(a.ins) : a.ins === k)).reduce((s, a) => s + (a.units || 0), 0), 1);
      const bolusBy = {}; ['breakfast', 'lunch', 'supper'].forEach(m => { bolusBy[m] = round(ins.filter(a => a.ins === 'bolus' && mealOfDose(a.time) === m).reduce((s, a) => s + (a.units || 0), 0), 1); });
      out.push({ d0, label: fmtDay(d0), today: i === 0, slots, basal: sum(['basal', 'nph']), bolus: sum('bolus'), correction: sum('correction'), premix: sum('premix'), iv: ins.some(a => a.ins === 'iv'), bolusBy, n: g.length });
    }
    return out;
  }

  // Lows and their likely causes.
  function lows(ctx, A) {
    const from = Math.max(ctx.now - 7 * DAY, ctx.admit ? ctx.admit - DAY : 0);
    const list = A.glucose.filter(o => o.time >= from && o.value < C.TARGETS.hypo).map(o => {
      const slot = slotOf(o.time);
      const causes = [];
      const before = (h, kinds) => ctx.admins.filter(a => kinds.includes(a.ins) && a.time <= o.time && a.time >= o.time - h * HOUR);
      const rapid = before(5, ['bolus', 'correction', 'premix']);
      const basal = before(26, ['basal', 'nph', 'premix']);
      if (rapid.length) causes.push('rapid-acting insulin ' + rapid.map(a => (a.units || '?') + ' u at ' + fmtTime(a.time).slice(-5) + (a.ins === 'correction' ? ' (correction)' : '')).join(', ') + ' in the 5 h before');
      if ((slot.key === 'overnight' || slot.key === 'fasting') && basal.length) causes.push('basal insulin ' + basal.map(a => (a.units || '?') + ' u').join(', ') + ' the previous day');
      const su = ctx.meds.filter(m => /gliclazide|glyburide|glimepiride|glipizide|repaglinide/i.test(m.name));
      if (su.length) causes.push(su.map(m => m.name).join(', ') + ' (sulfonylurea/meglitinide)');
      const intake = findIn(ctx.notes.filter(n => n.time <= o.time + HOUR && n.time >= o.time - 14 * HOUR), new RegExp(C.TEXT.npo.source + '|' + C.TEXT.poorIntake.source, 'i'))[0];
      if (intake) causes.push('reduced intake: ' + quote(intake));
      if (A.egfr && A.egfr.value < 30) causes.push('eGFR ' + A.egfr.value + ' (insulin and sulfonylureas clear slowly)');
      if (A.steroids.length && findIn(ctx.notes.filter(n => n.time >= o.time - 2 * DAY && n.time <= o.time), /\bsteroids? (?:stopped|tapered|weaned|reduced|decreased)\b|\btaper\w*/i)[0]) causes.push('steroid dose recently reduced');
      return { time: o.time, value: o.value, severe: o.value < C.TARGETS.severeHypo, slot, causes };
    });
    // collapse repeat readings of the same event (within 45 min)
    const events = [];
    list.forEach(l => { const p = events[events.length - 1]; if (p && l.time - p.time < 45 * MIN) { if (l.value < p.value) { p.value = l.value; p.severe = p.severe || l.severe; } } else events.push(l); });
    return events;
  }

  function hypoRisk(ctx, A, events) {
    const f = [];
    if (events.length) f.push(plural(events.length, 'low') + ' this admission' + (events.some(e => e.severe) ? ' (severe)' : ''));
    if (A.onInsulin) f.push('on insulin');
    if (ctx.meds.some(m => /gliclazide|glyburide|glimepiride|glipizide|repaglinide/i.test(m.name))) f.push('on a sulfonylurea/meglitinide');
    if (A.egfr && A.egfr.value < 30) f.push('eGFR under 30');
    if (ctx.age != null && ctx.age >= 75) f.push('age 75 or older');
    if (A.weight != null && A.weight < 50) f.push('weight under 50 kg');
    if (A.npo || A.poorIntake) f.push(A.npo ? 'NPO' : 'poor intake');
    if (A.type === 1) f.push('type 1 diabetes');
    if (A.dementia) f.push('dementia (may not report symptoms)');
    if (ctx.meds.some(m => C.DRUGS.betaBlocker.test(m.name))) f.push('beta-blocker (can mask symptoms)');
    const level = events.some(e => e.severe) || f.length >= 4 ? 'high' : f.length >= 2 ? 'moderate' : 'low';
    return { level, factors: f };
  }

  // Current scheduled regimen from active orders (falls back to yesterday's doses given).
  function regimen(ctx, A) {
    const r = { basal: [], bolus: { breakfast: null, lunch: null, supper: null }, correction: false, premix: [], fromMar: false };
    ctx.meds.filter(m => m.ins).forEach(m => {
      if (m.ins === 'basal' || m.ins === 'nph') r.basal.push({ name: m.name, units: m.units, text: m.text, nph: m.ins === 'nph', am: /\b(?:am|morning|breakfast|0[6-9]00)\b/i.test(m.text) });
      else if (m.ins === 'bolus') {
        const meals = ['breakfast', 'lunch', 'supper'].filter(x => new RegExp('\\b' + x + '\\b|' + (x === 'supper' ? '\\bdinner\\b' : 'zz'), 'i').test(m.text));
        (meals.length ? meals : ['breakfast', 'lunch', 'supper']).forEach(x => { r.bolus[x] = { name: m.name, units: m.units }; });
      }
      else if (m.ins === 'correction') r.correction = true;
      else if (m.ins === 'premix') r.premix.push({ name: m.name, units: m.units });
    });
    if (!r.basal.length && !Object.values(r.bolus).some(Boolean)) {
      const y = ctx.admins.filter(a => a.time >= ctx.now - 30 * HOUR);
      const b = y.filter(a => a.ins === 'basal' || a.ins === 'nph');
      if (b.length) { r.basal.push({ name: b[b.length - 1].name, units: b[b.length - 1].units, nph: b[b.length - 1].ins === 'nph' }); r.fromMar = true; }
      ['breakfast', 'lunch', 'supper'].forEach(x => { const d = y.filter(a => a.ins === 'bolus' && mealOfDose(a.time) === x).pop(); if (d) { r.bolus[x] = { name: d.name, units: d.units }; r.fromMar = true; } });
    }
    r.basalTotal = r.basal.reduce((s, b) => s + (b.units || 0), 0);
    r.bolusTotal = ['breakfast', 'lunch', 'supper'].reduce((s, x) => s + ((r.bolus[x] && r.bolus[x].units) || 0), 0);
    r.scheduled = r.basal.length > 0 || r.bolusTotal > 0 || r.premix.length > 0;
    return r;
  }

  // Dose suggestions. Each: { what, from, to, why, calc, level }
  function suggestions(ctx, A, days, events, reg) {
    const D = C.DOSING, T = C.TARGETS, S = [];
    const blockers = [];
    if (A.ivInsulin) blockers.push('IV insulin is running — use the IV protocol; see the transition checklist.');
    if (A.dka && A.ivInsulin) blockers.push('DKA/HHS being treated.');
    if (A.pump) blockers.push('Insulin pump user — doses are set with the patient (pump policy); suggestions not shown.');
    if (blockers.length) return { blockers, items: [], start: null };
    const last2 = days.slice(-2), last3 = days;
    const lowIn = keys => events.filter(e => e.time >= ctx.now - 48 * HOUR && keys.includes(e.slot.key));
    const highDays = (key, lim) => last3.filter(d => d.slots[key].length && Math.max(...d.slots[key]) > lim).length;
    const roundU = v => Math.max(0, Math.round(v));
    const anyLow48 = events.some(e => e.time >= ctx.now - 48 * HOUR);
    const ytd = days[days.length - 2] || days[0];
    const lowFactor = (ctx.age != null && ctx.age >= 70) || (A.egfr && A.egfr.value < 30) || (A.weight != null && A.weight < 50) || A.poorIntake;
    let start = null;
    const highs24 = A.glucose.filter(o => o.time >= ctx.now - DAY && o.value > T.randomHigh).length;
    const recentBasal = ctx.admins.filter(a => (a.ins === 'basal' || a.ins === 'nph') && a.time >= ctx.now - 72 * HOUR && a.units).pop();
    if (!reg.scheduled && recentBasal) {
      const pct = A.npo ? D.npoBasalPct[A.type === 1 ? 'type1' : 'type2'] : 100;
      const to = roundU(recentBasal.units * pct / 100);
      S.push({ what: 'Restart basal insulin (' + recentBasal.name + ')', from: 0, to, level: A.type === 1 ? 'red' : 'amber',
        why: 'Basal ' + recentBasal.units + ' u was given ' + fmtTime(recentBasal.time) + ' but there is no active basal order' + (A.type === 1 ? ' — type 1 must never be without basal' : ''),
        calc: recentBasal.units + ' u' + (pct < 100 ? ' × ' + pct + '% while NPO = ' + to + ' u' : '') + ' once daily; add meal doses when eating' });
    } else if (!reg.scheduled) {
      if ((highs24 >= 2 || (ytd && ytd.correction >= D.correctionUnitsTrigger) || A.type === 1) && A.weight) {
        const perKg = lowFactor ? (A.type === 1 ? 0.3 : D.startPerKgLow + 0.1) : D.startPerKg;
        const tdd = roundU(perKg * A.weight);
        const basal = roundU(tdd * D.basalFraction), meal = roundU((tdd - basal) / 3);
        start = { tdd, perKg, basal, meal,
          calc: perKg + ' units/kg × ' + A.weight + ' kg = ' + tdd + ' units/day; ' + Math.round(D.basalFraction * 100) + '% basal = ' + basal + ' units once daily; ' + meal + ' units with each meal' + (lowFactor ? ' (lower dose: ' + D.lowDoseIf + ')' : ''),
          why: A.type === 1 ? 'Type 1 needs scheduled basal insulin at all times.' : (highs24 >= 2 ? highs24 + ' readings above ' + T.randomHigh + ' in 24 h on correction only' : 'Correction insulin ' + ytd.correction + ' units yesterday'),
          npo: A.npo };
      } else if (highs24 >= 2 && !A.weight) blockers.push('Enter a weight to calculate a starting dose.');
    }
    if (reg.scheduled) {
    // Basal
    if (reg.basal.length) {
      const cur = reg.basalTotal;
      const lowsB = lowIn(['overnight', 'fasting']);
      const fh = highDays('fasting', T.preMealHigh);
      if (A.npo) {
        const pct = D.npoBasalPct[A.type === 1 ? 'type1' : 'type2'];
        S.push({ what: 'Basal insulin while NPO', from: cur, to: roundU(cur * pct / 100), level: 'amber', why: 'NPO: keep about ' + pct + '% of basal' + (A.type === 1 ? ' — never stop basal in type 1' : ''), calc: cur + ' × ' + pct + '% = ' + roundU(cur * pct / 100) });
      } else if (lowsB.length) {
        const pct = lowsB.some(e => e.severe) || lowsB.length >= 2 ? D.adjustDownPct : D.adjustDownMildPct;
        S.push({ what: 'Basal insulin', from: cur, to: roundU(cur * (1 - pct / 100)), level: 'red', why: plural(lowsB.length, 'low') + ' overnight/fasting in 48 h (lowest ' + Math.min(...lowsB.map(e => e.value)) + ')', calc: cur + ' − ' + pct + '% = ' + roundU(cur * (1 - pct / 100)) });
      } else if (fh >= D.highDaysNeeded && !anyLow48) {
        const to = Math.max(roundU(cur * (1 + D.adjustUpPct / 100)), cur + 1);
        S.push({ what: 'Basal insulin', from: cur, to, level: 'info', why: 'Fasting above ' + T.preMealHigh + ' on ' + fh + ' of the last 3 days, no lows', calc: cur + ' + ' + D.adjustUpPct + '% = ' + to });
      }
    }
    // Meal boluses: pre-lunch reflects breakfast, pre-supper reflects lunch, bedtime reflects supper.
    const map = { breakfast: 'preLunch', lunch: 'preSupper', supper: 'bedtime' };
    Object.keys(map).forEach(meal => {
      const b = reg.bolus[meal]; if (!b || !b.units) return;
      const slot = map[meal];
      const lim = slot === 'bedtime' ? T.randomHigh : T.preMealHigh;
      const lw = lowIn([slot]);
      if (A.npo) { S.push({ what: cap(meal) + ' bolus', from: b.units, to: 0, level: 'amber', why: 'NPO: hold mealtime insulin; keep correction insulin', calc: 'hold' }); return; }
      if (lw.length) { const pct = lw.some(e => e.severe) || lw.length >= 2 ? D.adjustDownPct : D.adjustDownMildPct; S.push({ what: cap(meal) + ' bolus', from: b.units, to: roundU(b.units * (1 - pct / 100)), level: 'red', why: 'Low at ' + C.SLOTS.find(s => s.key === slot).label.toLowerCase() + ' (' + Math.min(...lw.map(e => e.value)) + ')', calc: b.units + ' − ' + pct + '% = ' + roundU(b.units * (1 - pct / 100)) }); return; }
      if (A.poorIntake) { S.push({ what: cap(meal) + ' bolus', from: b.units, to: roundU(b.units / 2), level: 'amber', why: 'Poor intake: halve, or give right after the meal based on how much was eaten', calc: b.units + ' ÷ 2' }); return; }
      const h = highDays(slot, lim);
      if (h >= D.highDaysNeeded && !anyLow48) { const to = Math.max(roundU(b.units * (1 + D.adjustUpPct / 100)), b.units + 1); S.push({ what: cap(meal) + ' bolus', from: b.units, to, level: 'info', why: C.SLOTS.find(s => s.key === slot).label + ' above ' + lim + ' on ' + h + ' of 3 days', calc: b.units + ' + ' + D.adjustUpPct + '% = ' + to }); }
    });
    // Correction units folded into scheduled doses
    if (ytd && ytd.correction >= D.correctionUnitsTrigger && !events.some(e => e.time >= ctx.now - 48 * HOUR) && !A.npo) {
      const add = roundU(ytd.correction * D.correctionShare);
      S.push({ what: 'Scheduled insulin (from correction use)', from: null, to: '+' + add, level: 'info', why: 'Correction insulin ' + ytd.correction + ' units yesterday', calc: ytd.correction + ' × ' + D.correctionShare + ' = ' + add + ' units/day, split between basal and the meal doses where readings are high' });
    }
    }
    // Steroids
    if (A.predEq >= 10 && A.weight) {
      const pm = days.slice(-2).some(d => (d.slots.preSupper.concat(d.slots.bedtime)).some(v => v > T.randomHigh));
      if (pm && !reg.basal.some(b => b.nph && b.am)) {
        const perKg = Math.min(D.steroidNphPer10mgPred * (A.predEq / 10), D.steroidNphMaxPerKg) * (lowFactor ? 0.5 : 1);
        const u = roundU(perKg * A.weight);
        if (start) { start.replacedBySteroid = true; start = null; }
        S.push({ what: 'Morning NPH for steroid hyperglycemia', from: 0, to: u, level: 'info', why: 'Prednisone-equivalent ' + round(A.predEq) + ' mg/day with afternoon/evening highs', calc: round(perKg, 2) + ' u/kg (0.1 u/kg per 10 mg prednisone, max 0.4' + (lowFactor ? ', halved for ' + D.lowDoseIf : '') + ') × ' + A.weight + ' kg = ' + u + ' units NPH each morning with the steroid' + (reg.scheduled ? '' : ', in place of a glargine start; keep correction insulin and add meal doses if pre-lunch is still high') + '. Reduce in step with the steroid taper; stop when the steroid stops (Local).' });
      }
    }
    return { blockers, items: S, start };
  }
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

  // Non-insulin options for type 2, checked against this patient.
  function agentOptions(ctx, A, events) {
    const eg = A.egfr ? A.egfr.value : null;
    return C.AGENTS.map(ag => {
      const on = ag.key === 'insulin' ? A.onInsulin : A.agentsOn.some(x => x.key === ag.key);
      let status = 'ok';
      const notes = [];
      if (eg != null) for (const [lim, st, why] of ag.egfr) { if (eg < lim) { if (st === 'avoid' || status === 'ok') status = st; notes.push(why); break; } }
      if (ag.key === 'tzd' && A.hf) { status = 'avoid'; notes.push('Heart failure'); }
      if (ag.key === 'tzd' && A.bladderCa) { status = 'avoid'; notes.push('Bladder cancer history'); }
      if (ag.key === 'glp1' && A.mtc) { status = 'avoid'; notes.push('Medullary thyroid cancer / MEN2 history'); }
      if (ag.key === 'glp1' && A.pancreatitis) { status = 'caution'; notes.push('Pancreatitis history'); }
      if (ag.key === 'dpp4' && A.agentsOn.some(x => x.key === 'glp1')) { status = 'avoid'; notes.push('Already on a GLP-1 RA'); }
      if (ag.key === 'glp1' && A.agentsOn.some(x => x.key === 'dpp4')) notes.push('Stop the DPP-4 inhibitor if starting');
      if (ag.hypo && events.length) { status = status === 'avoid' ? 'avoid' : 'caution'; notes.push('Lows this admission'); }
      if (ag.key === 'su' && ctx.age != null && ctx.age >= 75) { status = status === 'avoid' ? 'avoid' : 'caution'; notes.push('Age 75+: high risk of lows'); }
      if (ag.key === 'sglt2' && (A.npo || A.dka)) notes.push('Hold while NPO / acutely ill; restart when eating');
      if (ag.key === 'metformin' && A.npo) notes.push('Hold while NPO or with AKI / contrast');
      let suggest = false;
      if (ag.cardiorenal && (A.cvd || A.hf || A.ckd) && status !== 'avoid' && !on) { suggest = true; notes.unshift((A.hf ? 'Heart failure' : A.ckd ? 'CKD' : 'ASCVD') + ': cardiorenal benefit regardless of A1C' + (ag.key === 'sglt2' && A.hf ? ' (preferred in HF)' : '')); }
      if (ag.key === 'metformin' && !on && status !== 'avoid') suggest = suggest || !A.agentsOn.length;
      return { key: ag.key, name: ag.name, on, status, notes, suggest, benefit: ag.benefit, risk: ag.risk, cost: ag.cost };
    });
  }

  function discharge(ctx, A, reg, events) {
    const a1 = A.a1c;
    const items = [];
    let plan = null;
    if (A.type === 2) {
      if (a1) { const band = C.DISCHARGE_T2.find(b => a1.value < b.maxA1c); plan = band.text;
        const relax = events.some(e => e.severe) || (ctx.age != null && ctx.age >= 80) || A.dementia || (A.egfr && A.egfr.value < 30);
        if (relax && a1.value < C.VASCULAR.a1cTargetFrail) plan = 'A1C ' + a1.value + '% with lows or frailty/advanced CKD: a relaxed target (≤ ' + C.VASCULAR.a1cTargetFrail + '%) is reasonable — don’t intensify; simplify and remove drugs that cause lows (sulfonylurea first). ';
        else if (reg.basalTotal && a1.value >= 7) { const pct = a1.value < 9 ? 0.5 : 0.8; plan += ' Hospital basal ' + reg.basalTotal + ' u → about ' + Math.round(reg.basalTotal * pct) + ' u at home.'; } }
      else plan = 'No A1C in the last 4 months — order one; it guides the discharge regimen.';
    } else plan = 'Type 1: continue basal-bolus (or pump) with the home doses adjusted for the lows/highs seen here. Endocrinology follow-up if control is poor or there was DKA.';
    const newInsulin = A.onInsulin && !findIn(ctx.notes, /\b(?:home|usual|chronic) insulin\b|\bon insulin at home\b|\binsulin at home\b/i)[0] && A.type === 2;
    items.push(['education', 'Diabetes teaching done (meter use, lows, sick days)' + (newInsulin ? ' — new insulin: injection teaching and diabetes education referral' : ''), !!findIn(ctx.notes, C.TEXT.education)[0]]);
    if (A.onInsulin || ctx.meds.some(m => /gliclazide|glyburide|glimepiride/i.test(m.name))) items.push(['supplies', 'Prescriptions: glucose meter, strips, lancets' + (A.onInsulin ? ', pen needles, insulin pens' : ''), false]);
    if (A.type === 1) { items.push(['glucagon', 'Glucagon (nasal or injection) prescribed and family shown how to use it', false]); items.push(['ketones', 'Ketone testing and sick-day plan (never stop basal insulin)', false]); }
    items.push(['sickday', 'Sick-day rules: hold SGLT2i, metformin, ACEi/ARB, diuretics, NSAIDs and sulfonylureas when unable to eat or drink', false]);
    if (events.length) items.push(['hypoplan', 'Lows this admission: dose reduced, hypoglycemia plan given, driving advice (insulin/SU)', false]);
    items.push(['followup', 'Follow-up: who adjusts doses and when (family doctor / diabetes centre within 1–2 weeks if insulin changed)', false]);
    items.push(['a1crepeat', 'Repeat A1C in 3 months', false]);
    return { plan, items };
  }

  function vascular(ctx, A) {
    const V = C.VASCULAR, has = re => ctx.meds.some(m => re.test(m.name));
    const age = ctx.age;
    const micro = A.retinopathy || A.neuropathy || A.nephropathy;
    const ldl = latest(ctx, 'ldl'), acr = latest(ctx, 'acr');
    const sbp = ctx.obs.filter(o => o.kind === 'sbp' && o.time >= ctx.now - DAY).map(o => o.value);
    const out = [];
    const statinWhy = [A.cvd && 'CVD', age != null && age > V.statinAge && 'age over 40', age != null && age > V.statinYoungAge && A.dmYears != null && A.dmYears > V.statinYoungDurationY && 'diabetes over 15 years', micro && 'microvascular disease'].filter(Boolean);
    out.push(row('Statin', statinWhy, has(C.DRUGS.statin), V.text.statin));
    const aceWhy = [A.cvd && 'CVD', age != null && age > V.aceAge && (A.htn || A.smoker || A.dyslipidemia || A.ckd) && 'age over 55 + risk factor', (A.nephropathy || A.retinopathy || A.lvh) && 'end-organ damage'].filter(Boolean);
    out.push(row('ACE inhibitor or ARB', aceWhy, has(C.DRUGS.aceArb), V.text.ace));
    const onAsa = has(C.DRUGS.asa);
    const asaRow = row('ASA ' + V.asaDose, A.cvd ? ['established CVD'] : [], onAsa, V.text.asa);
    if (!A.cvd && onAsa) { asaRow.status = 'review'; asaRow.detail = 'On ASA without established CVD — not routinely recommended for primary prevention; review the reason (stent, other indication?).'; }
    if (A.cvd && !onAsa && has(C.DRUGS.anticoag)) { asaRow.status = 'na'; asaRow.detail = 'On an anticoagulant — ASA usually not added unless cardiology advises.'; }
    if (A.cvd && !onAsa && has(C.DRUGS.p2y12)) { asaRow.status = 'ok'; asaRow.detail = 'On a P2Y12 inhibitor (antiplatelet covered).'; }
    out.push(asaRow);
    if (A.type === 2) out.push(row('SGLT2 inhibitor or GLP-1 RA with proven benefit', [A.cvd && 'ASCVD', A.hf && 'heart failure', A.ckd && 'CKD'].filter(Boolean), A.agentsOn.some(x => x.key === 'sglt2' || x.key === 'glp1'), V.text.cardiorenal));
    const targets = [
      tgt('A1C', A.a1c, '%', v => v <= (ctx.age >= 80 || A.dementia ? V.a1cTargetFrail : V.a1cTarget), '≤ ' + V.a1cTarget + '% (≤ ' + V.a1cTargetFrail + '% if frail/older)'),
      tgt('LDL', ldl, 'mmol/L', v => v < V.ldlTarget, '< ' + V.ldlTarget + ' or > 50% lower'),
      tgt('Urine ACR', acr, 'mg/mmol', v => v < V.acrHigh, '< ' + V.acrHigh),
      tgt('eGFR', A.egfr, 'mL/min', v => v >= 60, '≥ 60 (for drug choice)'),
      { label: 'BP (last 24 h)', value: sbp.length ? Math.round(sbp.reduce((a, b) => a + b, 0) / sbp.length) + ' systolic avg' : null, ok: sbp.length ? Math.max(...sbp) < V.bpTarget[0] : null, target: '< ' + V.bpTarget.join('/'), time: null }
    ];
    return { rows: out, targets, outpatient: ['Dilated eye exam (yearly or per retinopathy status)', 'Foot exam (yearly; more often if neuropathy or ulcer)', 'Smoking cessation if smoking', 'Weight and physical activity plan'] };
    function row(label, why, on, text) {
      const ind = why.length > 0;
      return { label, why, on, status: ind ? (on ? 'ok' : 'gap') : (on ? 'ok' : 'na'), detail: ind ? 'Indicated: ' + why.join(', ') + '.' + (on ? '' : ' Not on it.') : (on ? 'On it.' : 'Not indicated by these criteria.'), text };
    }
    function tgt(label, o, unit, okFn, target) { return { label, value: o ? o.value + ' ' + unit : null, ok: o ? okFn(o.value) : null, target, time: o ? o.time : null }; }
  }

  function transition(ctx, A) {
    if (!A.ivInsulin && !A.dka) return null;
    const ivUnits = ctx.admins.filter(a => a.ins === 'iv' && a.time >= ctx.now - DAY).reduce((s, a) => s + (a.units || 0), 0);
    const hco3 = latest(ctx, 'hco3'), k = latest(ctx, 'k'), ket = latest(ctx, 'ketone');
    return { ivUnits: round(ivUnits, 1), hco3, k, ket, items: [
      'DKA resolved: bicarbonate ≥ 15–18, anion gap closed, ketones falling' + (hco3 ? ' (HCO₃ ' + hco3.value + ', ' + fmtTime(hco3.time) + ')' : ''),
      'Eating, or a plan for NPO (basal still needed)',
      'Subcutaneous basal insulin given 1–2 h BEFORE stopping the IV infusion (DC16)',
      'Starting dose: previous home dose, or about 0.5–0.6 units/kg/day split basal/bolus, or ~80% of the stable IV rate × 24 h' + (ivUnits ? ' (IV insulin last 24 h ≈ ' + round(ivUnits, 1) + ' units recorded)' : ''),
      'Potassium checked and replaced' + (k ? ' (K ' + k.value + ')' : ''),
      'Cause of DKA addressed (missed insulin, infection, SGLT2i, new diagnosis)'
    ] };
  }

  // ------------------------------------------------------------------ evaluate + text
  function evaluate(ctx, ans) {
    const A = analyse(ctx, ans);
    const days = dayView(ctx, A);
    const ev = lows(ctx, A);
    const risk = hypoRisk(ctx, A, ev);
    const reg = regimen(ctx, A);
    const sug = suggestions(ctx, A, days, ev, reg);
    const opts = A.type === 2 ? agentOptions(ctx, A, ev) : null;
    const dc = discharge(ctx, A, reg, ev);
    const vp = vascular(ctx, A);
    const tr = transition(ctx, A);
    const alerts = [];
    if (A.type === 1 && !reg.basal.length && !A.ivInsulin && !A.pump) alerts.push({ level: 'red', text: 'Type 1 diabetes with no basal insulin ordered — risk of DKA. Basal must never be stopped.' });
    if (ev.some(e => e.severe)) alerts.push({ level: 'red', text: 'Severe low (below ' + C.TARGETS.severeHypo + ') in the last 7 days' });
    else if (ev.length) alerts.push({ level: 'amber', text: plural(ev.length, 'low') + ' (below ' + C.TARGETS.hypo + ') in the last 7 days' });
    const high = A.glucose.filter(o => o.time >= ctx.now - DAY && o.value > C.TARGETS.veryHigh);
    if (high.length) alerts.push({ level: 'amber', text: plural(high.length, 'reading') + ' above ' + C.TARGETS.veryHigh + ' in 24 h' + (A.type === 1 ? ' — check ketones' : '') });
    if (!reg.scheduled && A.glucose.filter(o => o.time >= ctx.now - 2 * DAY && o.value > C.TARGETS.randomHigh).length >= 3) alerts.push({ level: 'amber', text: 'Correction insulin only, with repeated highs — Diabetes Canada advises scheduled basal(-bolus) instead' });
    if (ev.length && ctx.meds.some(m => /gliclazide|glyburide|glimepiride|glipizide|repaglinide/i.test(m.name))) alerts.push({ level: 'red', text: 'Lows while on a sulfonylurea/meglitinide — consider stopping it' });
    if (A.npo && ctx.meds.some(m => /gliclazide|glyburide|glimepiride|repaglinide/i.test(m.name))) alerts.push({ level: 'red', text: 'Sulfonylurea/meglitinide active while NPO — hold' });
    if ((A.npo || A.dka) && A.agentsOn.some(x => x.key === 'sglt2')) alerts.push({ level: 'red', text: 'SGLT2 inhibitor active while NPO/acutely ill — hold (euglycemic DKA risk)' });
    if (A.egfr && A.egfr.value < 30 && A.agentsOn.some(x => x.key === 'metformin')) alerts.push({ level: 'red', text: 'Metformin with eGFR ' + A.egfr.value + ' — stop' });
    if (A.pump || A.cgm) alerts.push({ level: 'info', text: (A.pump ? 'Insulin pump' : 'CGM') + ' user — follow the hospital pump/CGM policy (patient able to self-manage, backup plan, remove for MRI)' });
    return { A, days, ev, risk, reg, sug, opts, dc, vp, tr, alerts };
  }

  function summaryText(ctx, R, ans) {
    const A = R.A, L = [];
    L.push('Inpatient diabetes review, ' + fmtTime(ctx.now) + '. Type ' + A.type + (A.a1c ? ', A1C ' + A.a1c.value + '% (' + fmtDate(A.a1c.time) + ')' : ', no recent A1C') + (A.egfr ? ', eGFR ' + A.egfr.value : '') + (A.weight ? ', weight ' + A.weight + ' kg' : '') + '.');
    const d = R.days[R.days.length - 2];
    if (d) L.push('Yesterday: basal ' + d.basal + ' u, meal ' + d.bolus + ' u, correction ' + d.correction + ' u.');
    if (R.ev.length) L.push('Lows: ' + R.ev.map(e => e.value + ' at ' + fmtTime(e.time)).join('; ') + '. Hypoglycemia risk ' + R.risk.level + '.');
    R.alerts.filter(a => a.level !== 'info').forEach(a => L.push('Alert: ' + a.text + '.'));
    const acc = R.sug.items.filter((s, i) => ans['acc_' + i] === 'yes');
    if (R.sug.start && ans.acc_start === 'yes') L.push('Plan: start basal-bolus ' + R.sug.start.calc + '.');
    acc.forEach(s => L.push('Plan: ' + s.what + ' ' + (s.from != null ? s.from + ' → ' : '') + s.to + ' units (' + s.why + ').'));
    L.push('Discharge: ' + R.dc.plan);
    const gaps = R.vp.rows.filter(r => r.status === 'gap' || r.status === 'review').map(r => r.label + (r.status === 'review' ? ' (review)' : ' not on'));
    if (gaps.length) L.push('Vascular protection gaps: ' + gaps.join('; ') + '.');
    const miss = R.vp.targets.filter(t => t.value == null).map(t => t.label);
    if (miss.length) L.push('Not on file: ' + miss.join(', ') + '.');
    L.push('Decision support only; doses to be confirmed by the prescriber.');
    return L.join('\n');
  }

  // ------------------------------------------------------------------ loading
  function shortError(e) { const m = String((e && e.message) || e || 'failed'); const c = (m.match(/^\s*(\d{3})\b/) || [])[1]; if (c) { if (+c >= 502 && +c <= 504) return 'Cerner server timed out (' + c + ')'; if (c === '401' || c === '403') return 'Not allowed (' + c + ') — check the app’s scopes'; return 'Server error ' + c; } return m.length > 120 ? m.slice(0, 120) + '…' : m; }
  function withTimeout(p, ms, l) { let t; return Promise.race([p, new Promise((_, r) => { t = setTimeout(() => r(new Error(l + ' timed out after ' + Math.round(ms / 1000) + ' s')), ms); })]).finally(() => clearTimeout(t)); }
  async function fhirSearch(client, url, pages) { const r = await client.request(url, { pageLimit: pages || 5, flat: true }); return Array.isArray(r) ? r : (r && r.entry ? r.entry.map(e => e.resource) : []); }
  function b64(s) { try { return new TextDecoder().decode(Uint8Array.from(atob(s), c => c.charCodeAt(0))); } catch (e) { return ''; } }
  function strip(h) { return String(h || '').replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ').replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|li|tr|h\d)>/gi, '\n').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/[ \t]+/g, ' ').trim(); }
  async function noteText(client, doc) {
    const atts = (doc.content || []).map(c => c.attachment).filter(Boolean);
    const att = atts.find(a => /text\/plain/.test(a.contentType || '')) || atts.find(a => /html/.test(a.contentType || '')) || atts[0];
    if (!att) return '';
    let t = att.data ? b64(att.data) : '';
    if (!t && att.url) { const r = await client.request({ url: att.url, headers: { Accept: att.contentType || 'text/plain' } }); t = typeof r === 'string' ? r : (r && r.data ? b64(r.data) : ''); }
    return /<\w+[^>]*>/.test(t) ? strip(t) : t;
  }
  async function loadNotes(client, pid, from, to) {
    const docs = await fhirSearch(client, 'DocumentReference?patient=' + pid + '&_count=100', 3);
    const rec = docs.filter(d => d.status !== 'entered-in-error').map(d => ({ d, time: toTime(d.date || (d.context && d.context.period && d.context.period.start)) }))
      .filter(x => x.time != null && x.time >= from && x.time <= to).sort((a, b) => b.time - a.time).slice(0, CONFIG.maxNotes);
    const tx = await Promise.allSettled(rec.map(x => withTimeout(noteText(client, x.d), CONFIG.timeouts.noteMs, 'note')));
    return rec.map((x, i) => ({ time: x.time, title: ccText(x.d.type) || x.d.description || 'Note', text: tx[i].status === 'fulfilled' ? tx[i].value : '' })).filter(n => n.text);
  }
  function throttled(client) {
    let active = 0; const q = [];
    const next = () => { while (active < CONFIG.maxParallel && q.length) { const j = q.shift(); active++; Promise.resolve().then(j.fn).then(j.res, j.rej).finally(() => { active--; next(); }); } };
    return { patient: client.patient, request: (...a) => new Promise((res, rej) => { q.push({ fn: () => client.request(...a), res, rej }); next(); }) };
  }
  async function loadResources(raw, opts) {
    const client = throttled(raw), pid = client.patient.id, ge = fhirDate(opts.from);
    const failed = [], reasons = {}, out = {}, prog = opts.onProgress || function () {};
    const run = async (label, key, fn, fb, ms) => { prog(label, 'loading'); try { const v = await withTimeout(Promise.resolve().then(fn), ms || CONFIG.timeouts.searchMs, label); out[key] = v; prog(label, 'done', Array.isArray(v) ? v.length : null); } catch (e) { out[key] = fb; failed.push(label); reasons[label] = shortError(e); prog(label, 'failed', null, shortError(e)); } };
    const first = async (urls, pages) => { let last; for (const u of urls) { try { return await fhirSearch(client, u, pages); } catch (e) { last = e; } } throw last; };
    await Promise.all([
      run('Patient', 'patient', () => client.patient.read(), null),
      run('Encounters', 'encounters', () => first(['Encounter?patient=' + pid + '&date=ge' + ge + '&_count=20', 'Encounter?patient=' + pid + '&_count=20'], 1), []),
      run('Problem list', 'conditions', () => first(['Condition?patient=' + pid + '&category=problem-list-item', 'Condition?patient=' + pid], 3), []),
      run('Active medications', 'medRequests', () => fhirSearch(client, 'MedicationRequest?patient=' + pid + '&status=active&_count=100', 3), [])
    ]);
    await Promise.all([
      run('Insulin and medications given', 'medAdmins', () => fhirSearch(client, 'MedicationAdministration?patient=' + pid + '&effective-time=ge' + ge + '&_count=100', 10), []),
      run('Glucose, labs and vitals', 'observations', async () => {
        const rs = await Promise.allSettled([
          fhirSearch(client, 'Observation?patient=' + pid + '&category=laboratory&date=ge' + fhirDate(opts.from - 400 * DAY) + '&_count=100', 20),
          fhirSearch(client, 'Observation?patient=' + pid + '&category=vital-signs&date=ge' + ge + '&_count=100', 10),
          fhirSearch(client, 'Observation?patient=' + pid + '&code=http://loinc.org|41653-7,http://loinc.org|2339-0,http://loinc.org|2345-7&date=ge' + ge + '&_count=100', 10)
        ]);
        const ok = rs.filter(r => r.status === 'fulfilled'); if (!ok.length) throw rs[0].reason; return ok.flatMap(r => r.value);
      }, [], CONFIG.timeouts.searchMs * 2),
      run('Diet orders', 'orders', () => fhirSearch(client, 'ServiceRequest?patient=' + pid + '&status=active&_count=100', 2).catch(() => fhirSearch(client, 'NutritionOrder?patient=' + pid, 1)), []),
      run('Notes', 'notes', () => loadNotes(client, pid, opts.from, opts.to), [], CONFIG.timeouts.notesMs)
    ]);
    return Object.assign(out, { failed, reasons });
  }

  // ------------------------------------------------------------------ rendering
  const sel = (k, options, v) => '<select data-k="' + esc(k) + '">' + options.map(o => '<option value="' + esc(o[0]) + '"' + ((v || '') === o[0] ? ' selected' : '') + '>' + esc(o[1]) + '</option>').join('') + '</select>';
  const pill = (text, cls) => '<span class="dm-pill ' + cls + '">' + esc(text) + '</span>';
  const gcls = v => v < C.TARGETS.severeHypo ? 'g-sev' : v < C.TARGETS.hypo ? 'g-low' : v > C.TARGETS.veryHigh ? 'g-vhigh' : v > C.TARGETS.randomHigh ? 'g-high' : v > C.TARGETS.preMealHigh ? 'g-above' : 'g-ok';

  function icon(type) {
    const c = type === 1 ? ['#0b4f8a', 'T1'] : ['#2d6a0b', 'T2'];
    return '<svg class="dm-icon" viewBox="0 0 52 52" width="52" height="52" aria-hidden="true"><rect x="1" y="1" width="50" height="50" rx="11" fill="' + c[0] + '"/>' +
      '<path d="M26 9c-6 9-10 14-10 19a10 10 0 0 0 20 0c0-5-4-10-10-19z" fill="none" stroke="#fff" stroke-width="2.4"/><text x="26" y="33" text-anchor="middle" font-family="system-ui,sans-serif" font-size="11" font-weight="700" fill="#fff">' + c[1] + '</text></svg>';
  }

  function headerHtml(ctx, R, ans) {
    const A = R.A;
    const f = [];
    f.push('<strong>A1C</strong> ' + (A.a1c ? A.a1c.value + '% <span class="dm-muted">' + fmtDate(A.a1c.time) + '</span>' : '<span class="dm-muted">none on file</span>'));
    f.push('<strong>eGFR</strong> ' + (A.egfr ? A.egfr.value : '<span class="dm-muted">—</span>'));
    f.push('<strong>Weight</strong> ' + (A.weight ? A.weight + ' kg' : '<span class="dm-muted">—</span>'));
    if (A.npo) f.push(pill('NPO', 'p-amber')); if (A.tubeFeed) f.push(pill('Tube feeds / TPN', 'p-amber')); if (A.predEq) f.push(pill('Steroid ~' + round(A.predEq) + ' mg pred/day', 'p-amber'));
    if (A.ivInsulin) f.push(pill('IV insulin', 'p-red')); if (A.pump) f.push(pill('Pump', 'p-info')); if (A.cgm) f.push(pill('CGM', 'p-info'));
    return '<section class="dm-head dm-t' + A.type + '">' + icon(A.type) + '<div class="dm-head-b"><div class="dm-head-top"><h2>Type ' + A.type + ' diabetes ' + (A.type === 1 ? '(insulin-dependent)' : '(non-insulin-dependent)') + '</h2>' +
      '<div class="dm-tabs" role="tablist">' + [1, 2].map(t => '<button type="button" role="tab" class="dm-tab' + (A.type === t ? ' on' : '') + '" data-type="' + t + '" aria-selected="' + (A.type === t) + '">Type ' + t + '</button>').join('') + '</div></div>' +
      '<p class="dm-facts">' + f.join(' &nbsp;·&nbsp; ') + (A.autoType ? '' : ' <span class="dm-muted">(type not on the problem list — choose above)</span>') + '</p>' +
      '<div class="dm-nums"><label>Weight (kg)' + (A.weightObs ? ' <span class="dm-muted">chart ' + A.weightObs.value + '</span>' : '') + '<input type="number" step="0.1" data-k="weight" value="' + esc(ans.weight || '') + '"></label>' +
      '<label>NPO now' + sel('npo', [['', 'Auto (' + (A.npo ? 'yes' : 'no') + ')'], ['yes', 'Yes'], ['no', 'No']], ans.npo) + '</label>' +
      '<label>Years with diabetes' + (A.dmYears != null ? ' <span class="dm-muted">chart ~' + A.dmYears + '</span>' : '') + '<input type="number" data-k="dmYears" value="' + esc(ans.dmYears || '') + '"></label></div></div></section>';
  }

  function alertsHtml(R) {
    if (!R.alerts.length) return '<div class="dm-card dm-okc">No alerts.</div>';
    return R.alerts.map(a => '<div class="dm-alert a-' + a.level + '">' + esc(a.text) + '</div>').join('');
  }

  function dayHtml(R) {
    const head = '<tr><th>Day</th>' + C.SLOTS.map(s => '<th>' + esc(s.label) + '</th>').join('') + '<th>Basal</th><th>Meal (B/L/S)</th><th>Correction</th></tr>';
    const rows = R.days.map(d => '<tr' + (d.today ? ' class="dm-today"' : '') + '><th scope="row">' + esc(d.label) + (d.today ? ' <span class="dm-muted">(so far)</span>' : '') + '</th>' +
      C.SLOTS.map(s => '<td>' + (d.slots[s.key].length ? d.slots[s.key].map(v => '<span class="dm-g ' + gcls(v) + '">' + v + '</span>').join(' ') : '<span class="dm-muted">—</span>') + '</td>').join('') +
      '<td>' + (d.basal || (d.premix ? d.premix + ' premix' : '—')) + '</td><td>' + (d.bolus ? d.bolusBy.breakfast + '/' + d.bolusBy.lunch + '/' + d.bolusBy.supper : '—') + '</td><td>' + (d.correction || '—') + (d.iv ? ' · IV' : '') + '</td></tr>').join('');
    return '<div class="dm-tw"><table class="dm-table dm-day">' + head + rows + '</table></div><p class="dm-legend"><span class="dm-g g-sev">&lt;2.8</span> <span class="dm-g g-low">&lt;4</span> <span class="dm-g g-ok">4–8</span> <span class="dm-g g-above">8–10</span> <span class="dm-g g-high">10–15</span> <span class="dm-g g-vhigh">&gt;15</span> mmol/L · Target before meals 5–8, random under 10 (Diabetes Canada). Insulin in units given (MAR).</p>' + chart(R);
  }

  function chart(R) {
    const g = R.A.glucose.filter(o => o.time >= R.days[0].d0);
    if (!g.length) return '';
    const W = 680, H = 170, pl = 30, pr = 6, pt = 8, pb = 20, from = R.days[0].d0, span = 3 * DAY;
    const x = t => pl + (t - from) / span * (W - pl - pr);
    const hi = Math.max(20, ...g.map(o => o.value)), y = v => pt + (hi - v) / hi * (H - pt - pb);
    const band = '<rect x="' + pl + '" y="' + y(10) + '" width="' + (W - pl - pr) + '" height="' + (y(4) - y(10)) + '" class="dm-band"/>';
    const lowLine = '<line x1="' + pl + '" x2="' + (W - pr) + '" y1="' + y(4) + '" y2="' + y(4) + '" class="dm-lowline"/>';
    const days = [0, 1, 2, 3].map(i => '<line x1="' + x(from + i * DAY) + '" x2="' + x(from + i * DAY) + '" y1="' + pt + '" y2="' + (H - pb) + '" class="dm-grid"/>' + (i < 3 ? '<text x="' + (x(from + i * DAY) + 4) + '" y="' + (H - 6) + '" class="dm-ax">' + esc(R.days[i].label) + '</text>' : '')).join('');
    const pts = g.map(o => '<circle cx="' + x(o.time).toFixed(1) + '" cy="' + y(o.value).toFixed(1) + '" r="3.2" class="dm-pt ' + gcls(o.value) + '"><title>' + o.value + ' · ' + fmtTime(o.time) + '</title></circle>').join('');
    const yt = [4, 10, Math.round(hi)].map(v => '<text x="' + (pl - 4) + '" y="' + (y(v) + 4) + '" text-anchor="end" class="dm-ax">' + v + '</text>').join('');
    return '<svg class="dm-chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Glucose over 3 days">' + band + lowLine + days + pts + yt + '</svg>';
  }

  function lowsHtml(R) {
    const ev = R.ev, risk = R.risk;
    let h = '<div class="dm-risk r-' + risk.level + '"><strong>Hypoglycemia risk: ' + risk.level + '</strong>' + (risk.factors.length ? ' — ' + esc(risk.factors.join(', ')) : '') + '</div>';
    if (!ev.length) h += '<p class="dm-muted">No readings below ' + C.TARGETS.hypo + ' in the last 7 days.</p>';
    else h += '<div class="dm-tw"><table class="dm-table"><tr><th>Time</th><th>Glucose</th><th>When</th><th>Likely contributors</th></tr>' + ev.map(e => '<tr><th scope="row">' + esc(fmtTime(e.time)) + '</th><td><span class="dm-g ' + gcls(e.value) + '">' + e.value + '</span>' + (e.severe ? ' ' + pill('Severe', 'p-red') : '') + '</td><td>' + esc(e.slot.label) + '</td><td>' + (e.causes.length ? '<ul class="dm-ul">' + e.causes.map(c => '<li>' + esc(c) + '</li>').join('') + '</ul>' : '<span class="dm-muted">None found — check intake, timing and activity</span>') + '</td></tr>').join('') + '</table></div>';
    h += '<details class="dm-more"><summary>How to treat a low (Island Health protocol)</summary><ol>' + C.HYPO_TREATMENT.map(t => '<li>' + esc(t) + '</li>').join('') + '</ol></details>';
    return h;
  }

  function dosingHtml(R, ans) {
    const S = R.sug, reg = R.reg, A = R.A;
    let h = '';
    const regLine = reg.scheduled ? 'Current scheduled insulin' + (reg.fromMar ? ' (from doses given; no active order found)' : '') + ': basal ' + (reg.basal.map(b => (b.units != null ? b.units + ' u ' : '') + b.name).join(' + ') || 'none') +
      '; meals ' + ['breakfast', 'lunch', 'supper'].map(m => reg.bolus[m] && reg.bolus[m].units != null ? reg.bolus[m].units : '–').join('/') + (reg.correction ? '; correction scale' : '') : 'No scheduled insulin (correction only or none).';
    h += '<p class="dm-small">' + esc(regLine) + '</p>';
    S.blockers.forEach(b => { h += '<div class="dm-alert a-amber">' + esc(b) + '</div>'; });
    if (S.start) h += '<div class="dm-sug s-info"><div class="dm-sug-top"><strong>Start basal-bolus insulin</strong> <label class="dm-acc"><input type="checkbox" data-k="acc_start"' + (ans.acc_start === 'yes' ? ' checked' : '') + '> Accept into the plan</label></div>' +
      '<p>' + esc(S.start.why) + '.</p><p class="dm-calc">' + esc(S.start.calc) + (S.start.npo ? ' — NPO now: give basal only, hold meal doses.' : '') + '</p></div>';
    S.items.forEach((s, i) => {
      h += '<div class="dm-sug s-' + s.level + '"><div class="dm-sug-top"><strong>' + esc(s.what) + ': ' + (s.from != null ? s.from + ' → ' : '') + '<span class="dm-to">' + esc(s.to) + (typeof s.to === 'number' || /^\+/.test(s.to) ? ' units' : '') + '</span></strong>' +
        '<label class="dm-acc"><input type="checkbox" data-k="acc_' + i + '"' + (ans['acc_' + i] === 'yes' ? ' checked' : '') + '> Accept into the plan</label></div><p>' + esc(s.why) + '</p><p class="dm-calc">' + esc(s.calc) + '</p></div>';
    });
    if (!S.blockers.length && !S.start && !S.items.length) h += '<div class="dm-card dm-okc">No dose change suggested: readings in range without lows on the current regimen.</div>';
    h += '<p class="dm-foot">Proposals only — the prescriber decides and writes the order. Rules: lows → reduce the responsible insulin 10–20%; fasting or pre-meal above 8 on 2 of 3 days → increase by 10%; start 0.4 units/kg/day (0.2–0.3 if ' + esc(C.DOSING.lowDoseIf) + '), half basal. Not given for IV insulin, DKA or pumps.</p>';
    if (R.tr) h += '<div class="dm-group"><h4>IV insulin / DKA → subcutaneous</h4><ul class="dm-ul">' + R.tr.items.map(t => '<li>' + esc(t) + '</li>').join('') + '</ul></div>';
    return h;
  }

  function optionsHtml(R) {
    if (!R.opts) return '<p class="dm-small">Type 1: insulin only (basal-bolus or pump). Non-insulin agents aren’t used for glucose in type 1. SGLT2 inhibitors carry a high DKA risk in type 1.</p>';
    const st = { ok: ['Suitable', 'p-ok'], caution: ['Caution', 'p-amber'], avoid: ['Avoid', 'p-red'] };
    return '<div class="dm-tw"><table class="dm-table dm-opts"><tr><th>Option</th><th>For this patient</th><th>Benefits</th><th>Cautions</th><th>Cost</th></tr>' + R.opts.map(o =>
      '<tr' + (o.suggest ? ' class="dm-sugrow"' : '') + '><th scope="row">' + esc(o.name) + (o.on ? ' ' + pill('On now', 'p-info') : '') + (o.suggest ? ' ' + pill('Consider adding', 'p-sug') : '') + '</th><td>' + pill(st[o.status][0], st[o.status][1]) +
      (o.notes.length ? '<ul class="dm-ul">' + o.notes.map(n => '<li>' + esc(n) + '</li>').join('') + '</ul>' : '') + '</td><td>' + esc(o.benefit) + '</td><td>' + esc(o.risk) + '</td><td>' + esc(o.cost) + '</td></tr>').join('') + '</table></div>' +
      '<p class="dm-foot">Diabetes Canada 2024: metformin first line; add an SGLT2 inhibitor or GLP-1 RA with proven benefit for ASCVD, heart failure or CKD regardless of A1C; insulin if symptomatic, losing weight or well above target. eGFR limits from Diabetes Canada and BC PharmaCare. Check BC PharmaCare coverage (Special Authority) for newer agents.</p>';
  }

  function dischargeHtml(R, ans) {
    return '<div class="dm-card"><strong>Regimen:</strong> ' + esc(R.dc.plan) + '</div><ul class="dm-checks">' + R.dc.items.map(([k, t, done]) => '<li><label><input type="checkbox" data-k="dc_' + k + '"' + (ans['dc_' + k] === 'yes' || (done && ans['dc_' + k] !== 'no') ? ' checked' : '') + '> ' + esc(t) + (done ? ' <span class="dm-muted">(found in notes)</span>' : '') + '</label></li>').join('') + '</ul>';
  }

  function vascularHtml(R) {
    const st = { ok: ['On it', 'p-ok'], gap: ['Gap', 'p-red'], na: ['Not indicated', 'p-na'], review: ['Review', 'p-amber'] };
    let h = '<div class="dm-tw"><table class="dm-table"><tr><th>Therapy</th><th>Status</th><th>Why</th></tr>' + R.vp.rows.map(r => '<tr><th scope="row">' + esc(r.label) + '</th><td>' + pill(st[r.status][0], st[r.status][1]) + '</td><td>' + esc(r.detail) + '<div class="dm-muted">' + esc(r.text) + '</div></td></tr>').join('') + '</table></div>';
    h += '<div class="dm-tgts">' + R.vp.targets.map(t => '<div class="dm-tgt ' + (t.ok == null ? 't-none' : t.ok ? 't-ok' : 't-bad') + '"><div class="dm-tgt-l">' + esc(t.label) + '</div><div class="dm-tgt-v">' + (t.value != null ? esc(t.value) : 'Not on file') + '</div><div class="dm-muted">Target ' + esc(t.target) + (t.time ? ' · ' + esc(fmtDate(t.time)) : '') + '</div></div>').join('') + '</div>';
    h += '<p class="dm-small"><strong>Outpatient:</strong> ' + esc(R.vp.outpatient.join(' · ')) + '</p>';
    return h;
  }

  function render(ctx, R, ans, open) {
    const H = [];
    const sec = (key, title, status, cls, body) => '<details class="dm-sec" data-sec="' + key + '"' + (open[key] === false ? '' : ' open') + '><summary class="dm-h"><span class="dm-chev" aria-hidden="true"><svg viewBox="0 0 14 14"><path d="M5 3l4 4-4 4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></span><span class="dm-h-t">' + esc(title) + '</span>' + (status ? '<span class="dm-h-s ' + (cls || '') + '">' + esc(status) + '</span>' : '') + '</summary><div class="dm-sec-b">' + body + '</div></details>';
    H.push('<div class="dm">');
    if (ctx.failed.length) H.push('<div class="dm-alert a-red"><strong>Incomplete:</strong> ' + esc(ctx.failed.map(f => f + (ctx.reasons[f] ? ' (' + ctx.reasons[f] + ')' : '')).join(', ')) + ' <button type="button" class="dm-btn dm-retry">Try again</button></div>');
    H.push(headerHtml(ctx, R, ans));
    H.push('<div class="dm-toolbar"><button type="button" class="dm-btn dm-all" data-all="open">Expand all</button> <button type="button" class="dm-btn dm-all" data-all="close">Collapse all</button></div>');
    const reds = R.alerts.filter(a => a.level === 'red').length, amb = R.alerts.filter(a => a.level === 'amber').length;
    H.push(sec('alerts', 'Alerts', R.alerts.length ? [reds && reds + ' red', amb && amb + ' amber'].filter(Boolean).join(', ') || 'Info' : 'None', reds ? 'hs-red' : amb ? 'hs-amber' : 'hs-ok', alertsHtml(R)));
    H.push(sec('day', 'Glucose and insulin (3 days)', R.days.reduce((s, d) => s + d.n, 0) + ' readings', '', dayHtml(R)));
    H.push(sec('lows', 'Lows and hypoglycemia risk', R.ev.length ? plural(R.ev.length, 'low') + ' · risk ' + R.risk.level : 'No lows · risk ' + R.risk.level, R.ev.some(e => e.severe) ? 'hs-red' : R.ev.length || R.risk.level === 'high' ? 'hs-amber' : 'hs-ok', lowsHtml(R)));
    const nS = R.sug.items.length + (R.sug.start ? 1 : 0);
    H.push(sec('dosing', 'Dose suggestions', R.sug.blockers.length ? 'Not shown' : nS ? plural(nS, 'suggestion') : 'No change', R.sug.items.some(s => s.level === 'red') ? 'hs-red' : nS ? 'hs-amber' : 'hs-ok', dosingHtml(R, ans)));
    if (R.A.type === 2) H.push(sec('options', 'Non-insulin options (type 2)', R.opts.filter(o => o.suggest).length ? R.opts.filter(o => o.suggest).length + ' to consider' : '', R.opts.some(o => o.suggest) ? 'hs-amber' : '', optionsHtml(R)));
    else H.push(sec('options', 'Type 1 notes', '', '', optionsHtml(R)));
    H.push(sec('discharge', 'Discharge plan', R.A.a1c ? 'A1C ' + R.A.a1c.value + '%' : 'No A1C', R.A.a1c ? '' : 'hs-amber', dischargeHtml(R, ans)));
    const gaps = R.vp.rows.filter(r => r.status === 'gap' || r.status === 'review').length;
    H.push(sec('vascular', 'A1C, lipids and vascular protection', gaps ? plural(gaps, 'gap') : 'No gaps', gaps ? 'hs-red' : 'hs-ok', vascularHtml(R)));
    H.push(sec('summary', 'Summary for the note', '', '', '<textarea class="dm-summary" rows="11" readonly>' + esc(summaryText(ctx, R, ans)) + '</textarea><button type="button" class="dm-btn dm-copy">Copy summary</button> <span class="dm-copied" aria-live="polite"></span>'));
    H.push('<p class="dm-disc">Decision support only, from FHIR data and what you enter; the prescriber decides all doses. Rules and sources are in dm-criteria.js (Diabetes Canada, Island Health hypoglycemia protocol, BC PharmaCare). Tested on made-up patients only.</p></div>');
    return H.join('');
  }

  async function mount(container, client, opts) {
    opts = opts || {};
    const gen = (container.__dmGen || 0) + 1; container.__dmGen = gen;
    const current = () => container.__dmGen === gen;
    const now = opts.now || Date.now(), lookback = opts.lookbackDays || CONFIG.lookbackDays;
    const pid = (client && client.patient && client.patient.id) || opts.patientKey || 'demo';
    if (container.__dmPid !== pid) { container.__dmPid = pid; container.__dmAns = {}; }
    if (!container.__dmOpen) { container.__dmOpen = {}; try { container.__dmOpen = JSON.parse(localStorage.getItem('dm-open-sections') || '{}') || {}; } catch (e) {} }
    const ans = container.__dmAns, open = container.__dmOpen;
    const saveOpen = () => { try { localStorage.setItem('dm-open-sections', JSON.stringify(open)); } catch (e) {} };
    const status = {};
    const onProgress = (l, st, n, msg) => { status[l] = { st, n, msg }; if (!current()) return; const ic = { loading: '…', done: '✓', failed: '✗' };
      container.innerHTML = '<div class="dm"><p class="dm-muted">Loading…</p><ul class="dm-prog">' + Object.keys(status).map(k => '<li><span>' + ic[status[k].st] + '</span>' + esc(k) + (status[k].n != null ? ' (' + status[k].n + ')' : '') + (status[k].st === 'failed' ? ' — ' + esc(status[k].msg) : '') + '</li>').join('') + '</ul></div>'; };
    container.innerHTML = '<div class="dm"><p class="dm-muted">Loading…</p></div>';
    const loader = opts.loader || ((f, t) => loadResources(client, { from: f, to: t, onProgress }));
    let res;
    try { res = await loader(now - lookback * DAY, now); } catch (e) { if (current()) container.innerHTML = '<div class="dm"><p class="dm-alert a-red">Couldn’t load the data. ' + esc(shortError(e)) + '</p></div>'; throw e; }
    if (!current()) return null;
    const ctx = buildContext(res, { now });
    let last;
    const draw = () => { const y = typeof window !== 'undefined' ? window.scrollY : 0; last = evaluate(ctx, ans); container.innerHTML = render(ctx, last, ans, open); wire(); if (typeof window !== 'undefined') window.scrollTo(0, y); };
    const wire = () => {
      container.querySelectorAll('details[data-sec]').forEach(d => d.addEventListener('toggle', () => { open[d.getAttribute('data-sec')] = d.open; saveOpen(); }));
      container.querySelectorAll('.dm-all').forEach(b => b.addEventListener('click', () => { const o = b.getAttribute('data-all') === 'open'; container.querySelectorAll('details[data-sec]').forEach(d => { d.open = o; open[d.getAttribute('data-sec')] = o; }); saveOpen(); }));
      container.querySelectorAll('[data-type]').forEach(b => b.addEventListener('click', () => { ans.type = b.getAttribute('data-type'); Object.keys(ans).filter(k => /^acc_/.test(k)).forEach(k => delete ans[k]); draw(); }));
      container.querySelectorAll('[data-k]').forEach(el => el.addEventListener('change', () => {
        const k = el.getAttribute('data-k');
        ans[k] = el.type === 'checkbox' ? (el.checked ? 'yes' : 'no') : el.value;
        if (k === 'weight' || k === 'npo') Object.keys(ans).filter(x => /^acc_/.test(x)).forEach(x => delete ans[x]);
        draw();
      }));
      const cb = container.querySelector('.dm-copy');
      if (cb) cb.addEventListener('click', async () => { const ta = container.querySelector('.dm-summary'), d = container.querySelector('.dm-copied'); try { await navigator.clipboard.writeText(ta.value); d.textContent = 'Copied.'; } catch (e) { ta.removeAttribute('readonly'); ta.select(); ta.setAttribute('readonly', ''); d.textContent = 'Press Ctrl+C to copy.'; } });
      const rb = container.querySelector('.dm-retry'); if (rb) rb.addEventListener('click', () => mount(container, client, Object.assign({}, opts, { now: undefined })).catch(() => {}));
    };
    draw();
    return { ctx, result: last };
  }

  return { CONFIG, mount, loadResources, buildContext, evaluate, summaryText, kindOf, insulinKind };
});
