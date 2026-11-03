/*
 * stroke.js — Stroke Follow-up for the hospitalist (adults)
 * SMART on FHIR (Oracle Health / Cerner Millennium R4). Read-only: nothing is written to the chart.
 *
 * For patients the hospitalist follows after the ED and neurology have seen them:
 *   - treated with tenecteplase/alteplase and/or EVT, or
 *   - CTA negative, MRI pending (possible minor stroke / TIA / mimic), or ESUS after the MRI.
 * Shows: pathway, alerts, timeline (24 h scan, BP window, when antithrombotics / LMWH / anticoagulation can start),
 * BP chart, posterior-circulation check with HINTS, prognosis scores, workup and ESUS tracker, discharge handoff.
 *
 * Usage (after FHIR.oauth2.ready()):
 *   Stroke.mount(document.getElementById('stroke-tab'), client, { lookbackDays: 14 });
 * Options: lookbackDays (default 14), loader (demo/tests), now (tests), patientKey (demo)
 * Rules live in stroke-criteria.js (load it first).
 */
(function (root, factory) {
  const crit = (typeof module === 'object' && module.exports) ? require('./stroke-criteria.js') : root.StrokeCriteria;
  const api = factory(crit);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Stroke = api;
})(typeof self !== 'undefined' ? self : this, function (C) {
  'use strict';
  if (!C) throw new Error('stroke-criteria.js must be loaded before stroke.js');

  const MIN = 60 * 1000, HOUR = 60 * MIN, DAY = 24 * HOUR;
  const CONFIG = {
    lookbackDays: 14,
    maxNotes: 30,
    timeouts: { searchMs: 60000, notesMs: 90000, noteMs: 15000 },
    maxParallel: 4,
    extraCodes: {}
  };

  const LOINC = {
    sbp: ['8480-6', '8459-0', '8460-8'], dbp: ['8462-4', '8453-3', '8454-1'], hr: ['8867-4', '8889-8'],
    temp: ['8310-5', '8331-1', '8332-9', '8333-7', '8328-5'], spo2: ['59408-5', '2708-6'],
    glucose: ['2345-7', '2339-0', '41653-7', '14749-6', '15074-8'], nihss: ['72089-6', '70182-1'],
    ldl: ['13457-7', '2089-1', '18262-6'], a1c: ['4548-4', '17856-6'], ddimer: ['48065-7', '48066-5', '7799-0'],
    plt: ['777-3', '26515-7'], inr: ['6301-6', '34714-6']
  };

  // ------------------------------------------------------------------ utilities
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
  const hoursText = ms => { const h = ms / HOUR; if (Math.abs(h) < 1) return Math.round(Math.abs(ms) / MIN) + ' min'; if (Math.abs(h) < 48) return round(Math.abs(h), Math.abs(h) < 10 ? 1 : 0) + ' h'; return round(Math.abs(h) / 24, 1) + ' days'; };
  const rel = (t, now) => t > now ? 'in ' + hoursText(t - now) : hoursText(now - t) + ' ago';
  const NEGATION = /\b(?:no|not|denies|denied|without|negative for|nil|absent|never|resolved)\b[^.;:\n]{0,30}$/i;
  const wordRe = term => new RegExp('\\b' + term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b');
  const CLASS_RES = {};
  ['lytic', 'antiplatelet', 'anticoag', 'statin', 'lipidOther', 'antihypertensive'].forEach(k => { CLASS_RES[k] = C.DRUGS[k].map(wordRe); });
  function normMed(name) { let n = lc(name); Object.keys(C.BRANDS).forEach(b => { n = n.replace(wordRe(b), C.BRANDS[b]); }); return n; }
  function classesOf(name) {
    const n = normMed(name), out = {};
    Object.keys(CLASS_RES).forEach(k => { if (CLASS_RES[k].some(re => re.test(n))) out[k] = true; });
    if (out.anticoag && C.DRUGS.prophylacticLmwh.test(n)) { out.prophylaxis = true; }
    if (out.anticoag && /\bheparin\b/.test(n) && /flush|lock/.test(n)) delete out.anticoag;
    return out;
  }
  function ageAt(birthDate, t) {
    const b = new Date(birthDate), d = new Date(t);
    let a = d.getFullYear() - b.getFullYear();
    if (d.getMonth() < b.getMonth() || (d.getMonth() === b.getMonth() && d.getDate() < b.getDate())) a--;
    return a;
  }
  function findIn(items, re, opts) {
    opts = opts || {};
    const hits = [];
    for (const n of items || []) {
      const t = (n.title ? n.title + '\n' : '') + (n.text || '');
      const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
      let m;
      while ((m = g.exec(t))) {
        if (opts.allowNegated || !NEGATION.test(t.slice(Math.max(0, m.index - 40), m.index))) {
          const s = Math.max(0, m.index - 50), e = Math.min(t.length, m.index + m[0].length + 60);
          hits.push({ time: n.time, title: n.title, match: m[0], m,
            excerpt: (s > 0 ? '…' : '') + t.slice(s, e).replace(/\s+/g, ' ').trim() + (e < t.length ? '…' : '') });
          break;
        }
        if (m.index === g.lastIndex) g.lastIndex++;
      }
    }
    return hits.sort((a, b) => b.time - a.time);
  }
  const quote = h => '“' + h.excerpt + '” (' + (h.title || 'note') + ', ' + fmtTime(h.time) + ')';

  // ------------------------------------------------------------------ parsing
  function kindOf(cc) {
    const cods = codings(cc);
    for (const kind of Object.keys(CONFIG.extraCodes || {})) {
      const list = CONFIG.extraCodes[kind] || [];
      if (cods.some(c => list.includes((c.system || '') + '|' + (c.code || '')) || list.includes(c.code))) return kind;
    }
    const loinc = cods.filter(c => !c.system || /loinc/i.test(c.system)).map(c => c.code);
    for (const k of Object.keys(LOINC)) if (loinc.some(code => LOINC[k].includes(code))) return k;
    const t = lc(ccText(cc) + ' ' + cods.map(c => c.display || '').join(' '));
    if (!t.trim() || /urine|csf/.test(t)) return null;
    if (/nih stroke|nihss/.test(t)) return 'nihss';
    if (/systolic/.test(t)) return 'sbp';
    if (/diastolic/.test(t)) return 'dbp';
    if (/heart rate|pulse rate|^pulse\b/.test(t)) return 'hr';
    if (/temperature/.test(t)) return 'temp';
    if (/spo2|oxygen saturation|o2 sat/.test(t)) return 'spo2';
    if (/glucose/.test(t) && !/tolerance/.test(t)) return 'glucose';
    if (/\bldl\b|low density/.test(t)) return 'ldl';
    if (/a1c|glycated|glycosylated/.test(t)) return 'a1c';
    if (/d-?dimer/.test(t)) return 'ddimer';
    if (/platelet/.test(t)) return 'plt';
    if (/\binr\b/.test(t)) return 'inr';
    return null;
  }
  function toSI(kind, num, unit) {
    if (num == null) return null;
    const u = lc(unit).replace(/\s/g, '');
    if (kind === 'temp' && (/degf|fahrenheit/.test(u) || num > 50)) return round((num - 32) * 5 / 9, 1);
    if (kind === 'glucose' && (/mg\/dl/.test(u) || num > 40)) return round(num / 18.016, 1);
    if (kind === 'ldl' && (/mg\/dl/.test(u) || num > 15)) return round(num / 38.67, 2);
    if (kind === 'a1c' && (/mmol\/mol/.test(u) || num > 25)) return round(num / 10.929 + 2.15, 1);
    return num;
  }
  function obsNum(o) {
    if (o.valueQuantity && typeof o.valueQuantity.value === 'number') return { num: o.valueQuantity.value, unit: o.valueQuantity.unit || o.valueQuantity.code || '' };
    if (typeof o.valueInteger === 'number') return { num: o.valueInteger, unit: '' };
    if (typeof o.valueString === 'string') { const n = parseFloat(o.valueString.replace(/[<>]/g, '')); return { num: isNaN(n) ? null : n, unit: '' }; }
    return { num: null, unit: '' };
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
        const v = obsNum(e.src);
        const value = toSI(kind, v.num, v.unit);
        if (value == null) continue;
        const id = kind + '|' + time + '|' + value;
        if (seen.has(id)) continue;
        seen.add(id);
        out.push({ kind, time, value });
      }
    }
    return out.sort((a, b) => a.time - b.time);
  }
  function modalityOf(text) {
    const t = lc(text);
    if (/\bcta\b|ct angio|angiogra(?:m|phy)\b.*\bct\b|\bct\b.*angio/.test(t)) return 'cta';
    if (/perfusion|\bctp\b/.test(t)) return 'ctp';
    if (/\bmri\b|\bmr\b|magnetic resonance|\bdwi\b|\bmra\b/.test(t)) return /\bmra\b|angio/.test(t) && !/brain|head/.test(t) ? 'mra' : 'mri';
    if (/\bct\b|computed tomography/.test(t) && /head|brain|cranial/.test(t)) return 'ct';
    if (/echo|\btte\b|\btee\b/.test(t)) return 'echo';
    if (/holter|event monitor|loop recorder|\bzio\b/.test(t)) return 'holter';
    if (/carotid/.test(t)) return 'carotid';
    if (/\bct\b/.test(t)) return 'ctOther';
    return 'other';
  }
  function b64decode(s) { try { return new TextDecoder().decode(Uint8Array.from(atob(s), c => c.charCodeAt(0))); } catch (e) { return ''; } }
  function stripHtml(h) {
    return String(h || '').replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ').replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|li|tr|h\d)>/gi, '\n').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/[ \t]+/g, ' ').trim();
  }
  function parseReports(list) {
    return (list || []).filter(r => r && r.resourceType === 'DiagnosticReport' && r.status !== 'entered-in-error').map(r => {
      const name = ccText(r.code);
      const text = [r.conclusion, (r.conclusionCode || []).map(ccText).join(' '),
        (r.presentedForm || []).map(p => p.data ? stripHtml(b64decode(p.data)) : '').join(' ')].filter(Boolean).join('\n');
      return { time: toTime(r.effectiveDateTime || (r.effectivePeriod && r.effectivePeriod.start) || r.issued), title: name, text, modality: modalityOf(name) };
    }).filter(r => r.time != null).sort((a, b) => a.time - b.time);
  }
  function medName(r) { return ccText(r.medicationCodeableConcept) || (r.medicationReference && r.medicationReference.display) || ''; }

  // ------------------------------------------------------------------ context
  function buildContext(r, opts) {
    const now = opts.now || Date.now();
    const p = r.patient || {};
    const sex = /^f/i.test(p.gender || '') ? 'female' : (/^m/i.test(p.gender || '') ? 'male' : 'unknown');
    const age = p.birthDate ? ageAt(p.birthDate, now) : null;
    const obs = parseObservations(r.observations);
    const reports = parseReports(r.reports);
    const notes = (r.notes || []).filter(n => n && n.time != null).sort((a, b) => b.time - a.time);
    const meds = (r.medRequests || []).filter(x => x && x.resourceType === 'MedicationRequest' && ['active', 'on-hold'].includes(x.status))
      .map(x => { const name = medName(x); return { name, time: toTime(x.authoredOn), cls: classesOf(name), text: name + ' ' + ((x.dosageInstruction || []).map(d => d.text || '').join(' ')) }; })
      .filter(m => m.name);
    meds.forEach(m => { if (m.cls.anticoag && C.DRUGS.prophylacticLmwh.test(m.text)) m.cls.prophylaxis = true; });
    const admins = (r.medAdmins || []).filter(x => x && x.resourceType === 'MedicationAdministration' && !['not-done', 'entered-in-error'].includes(x.status))
      .map(x => { const name = medName(x); return { name, time: toTime(x.effectiveDateTime || (x.effectivePeriod && x.effectivePeriod.start)), cls: classesOf(name) }; })
      .filter(a => a.name && a.time != null).sort((a, b) => a.time - b.time);
    const procedures = (r.procedures || []).filter(x => x && x.resourceType === 'Procedure' && !['entered-in-error', 'not-done'].includes(x.status))
      .map(x => ({ title: ccText(x.code), text: ccText(x.code) + ' ' + (x.note || []).map(n => n.text).join(' ') + ' ' + ccText(x.outcome),
        time: toTime(x.performedDateTime || (x.performedPeriod && x.performedPeriod.start)), end: toTime(x.performedPeriod && x.performedPeriod.end) }))
      .filter(x => x.time != null);
    const orders = (r.orders || []).filter(x => x && x.resourceType === 'ServiceRequest' && !['entered-in-error', 'revoked'].includes(x.status))
      .map(x => ({ title: ccText(x.code), text: ccText(x.code), time: toTime(x.authoredOn) || now, status: x.status }));
    const conditions = (r.conditions || []).filter(c => c && c.resourceType === 'Condition')
      .map(c => ({ title: ccText(c.code), text: ccText(c.code), time: toTime(c.recordedDate || c.onsetDateTime) || 0 })).filter(c => c.text);
    const encounters = (r.encounters || []).filter(e => e && e.resourceType === 'Encounter' && e.period && e.period.start)
      .map(e => ({ start: toTime(e.period.start), end: toTime(e.period.end), open: !e.period.end || e.status === 'in-progress', cls: lc((e.class && (e.class.code || e.class.display)) || '') }))
      .sort((a, b) => a.start - b.start);
    const current = encounters.filter(e => e.open).pop() || encounters[encounters.length - 1] || null;
    const arrival = encounters.length ? Math.min(...encounters.filter(e => !current || e.start >= current.start - 2 * DAY).map(e => e.start)) : null;
    return { now, patient: p, sex, age, obs, reports, notes, meds, admins, procedures, orders, conditions, encounters, current, arrival,
      failed: r.failed || [], reasons: r.reasons || {} };
  }

  // ------------------------------------------------------------------ analysis
  function analyse(ctx, ans) {
    ans = ans || {};
    const T = C.TEXT, now = ctx.now;
    const allText = ctx.notes.concat(ctx.reports, ctx.procedures, ctx.orders);
    const has = re => ctx.conditions.some(c => re.test(c.text));

    // Treatment
    const lyticAdmin = ctx.admins.find(a => a.cls.lytic);
    const lyticNote = !lyticAdmin ? findIn(ctx.notes, /\btenecteplase\b|\balteplase\b|\bTNK\b|\btPA\b|\bthromboly\w*/i).filter(h => !/\bnot (?:a )?candidate\b|\bcontraindicat\w*|\bnot given\b|\bdeclined\b/i.test(h.excerpt)).pop() : null;
    const lytic = lyticAdmin ? { time: lyticAdmin.time, drug: lyticAdmin.name, source: 'MAR' } : (lyticNote ? { time: lyticNote.time, drug: lyticNote.match, source: 'note', approx: true, hit: lyticNote } : null);
    const evtProc = ctx.procedures.find(p => T.evt.test(p.text));
    const evtNote = !evtProc ? findIn(ctx.notes, T.evt).pop() : null;
    const evtText = evtProc ? evtProc.text : (evtNote ? evtNote.excerpt : '');
    const ticiAll = findIn(ctx.notes.concat(ctx.procedures), T.tici, { allowNegated: true });
    const evt = evtProc ? { time: evtProc.time, end: evtProc.end || evtProc.time, source: 'procedure', text: evtText } : (evtNote ? { time: evtNote.time, end: evtNote.time, source: 'note', approx: true, hit: evtNote } : null);
    if (evt && ticiAll.length) evt.tici = ticiAll[0].m[1];
    const anchor = (ans.anchor && toTime(ans.anchor)) || (evt ? evt.end : (lytic ? lytic.time : null));

    // Imaging
    const imaging = ctx.reports.filter(r => ['ct', 'cta', 'ctp', 'mri', 'mra'].includes(r.modality));
    const ctas = imaging.filter(r => r.modality === 'cta' || (r.modality === 'ctp'));
    const mris = imaging.filter(r => r.modality === 'mri');
    const cts = imaging.filter(r => r.modality === 'ct');
    const readResult = (r, pos, neg) => { if (!r) return null; if (neg.test(r.text) && !findIn([r], pos).length) return 'negative'; if (findIn([r], pos).length) return 'positive'; if (neg.test(r.text)) return 'negative'; return 'unclear'; };
    const lastCta = ctas[ctas.length - 1] || null;
    const ctaResult = readResult(lastCta, T.lvo, T.noLvo);
    const lastMri = mris[mris.length - 1] || null;
    const mriResult = readResult(lastMri, T.infarct, T.noInfarct);
    const mriOrdered = ctx.orders.some(o => /\bMRI\b|\bMR brain\b|\bmagnetic resonance\b/i.test(o.text) && o.status !== 'completed');
    const followUpScan = anchor ? imaging.filter(r => ['ct', 'mri'].includes(r.modality) && r.time >= anchor + C.POST_TREATMENT.imagingEarliestH * HOUR).shift() || null : null;
    const fuHem = followUpScan ? (findIn([followUpScan], T.hemorrhage).length && !T.noHemorrhage.test(followUpScan.text) ? 'yes' : 'no') : null;
    const anyHem = imaging.filter(r => !anchor || r.time > anchor).some(r => findIn([r], T.hemorrhage).length && !T.noHemorrhage.test(r.text));

    // Pathway
    let pathway = (lytic || evt) ? 'treated' : (mriResult === 'positive' ? 'confirmed' : (mriResult === 'negative' ? 'mriNegative' : 'mriPending'));
    if (ans.pathway) pathway = ans.pathway;

    // Onset / NIHSS
    const onset = ans.onset ? toTime(ans.onset) : null;
    const nihssObs = ctx.obs.filter(o => o.kind === 'nihss');
    const nihssNotes = findIn(ctx.notes.slice().reverse(), T.nihss, { allowNegated: true }).map(h => ({ time: h.time, value: +h.m[1], src: 'note' }));
    const nihssSeries = nihssObs.map(o => ({ time: o.time, value: o.value, src: 'chart' })).concat(nihssNotes).sort((a, b) => a.time - b.time);
    const nihssAdmit = ans.nihss !== undefined && ans.nihss !== '' ? +ans.nihss : (nihssSeries.length ? nihssSeries[0].value : null);
    const nihssLatest = nihssSeries.length ? nihssSeries[nihssSeries.length - 1] : null;
    const nihssBest = nihssSeries.length ? Math.min(...nihssSeries.map(n => n.value)) : null;

    // Conditions / risk factors
    const afCond = has(T.af) || has(/atrial fibrillation|atrial flutter/i);
    const afNew = !afCond ? findIn(ctx.notes.concat(ctx.reports.filter(r => r.modality === 'holter' || /ecg|telemetry/i.test(r.title))), T.af).filter(h => !T.noAf.test(h.excerpt))[0] : null;
    const af = afCond || !!afNew || ans.af === 'yes';
    const htn = has(/hypertension|\bHTN\b/i), dm = has(/diabet|\bT[12]DM\b/i);
    const cancer = has(T.cancer);
    const priorStroke = has(/stroke|CVA|TIA|cerebral infarct/i) || !!findIn(ctx.notes, T.priorStroke)[0];
    const smoker = ans.smoker ? ans.smoker === 'yes' : (findIn(ctx.notes, T.nonSmoker, { allowNegated: true })[0] ? false : (findIn(ctx.notes, T.smoker)[0] ? true : null));

    // Echo / PFO
    const echos = ctx.reports.filter(r => r.modality === 'echo');
    const pfoHit = findIn(echos.concat(ctx.notes), T.pfo).filter(h => !T.noPfo.test(h.excerpt))[0];
    const pfo = ans.pfo ? ans.pfo === 'yes' : (pfoHit ? true : (echos.some(e => T.noPfo.test(e.text)) ? false : null));
    const lvThrombus = findIn(echos, T.lvThrombus)[0];

    // Meds
    const onAntiplatelet = ctx.meds.filter(m => m.cls.antiplatelet);
    const onAnticoag = ctx.meds.filter(m => m.cls.anticoag && !m.cls.prophylaxis);
    const onProphylaxis = ctx.meds.filter(m => m.cls.prophylaxis);
    const onStatin = ctx.meds.filter(m => m.cls.statin);
    const earlyAntithrombotic = lytic ? ctx.admins.filter(a => (a.cls.antiplatelet || a.cls.anticoag) && !a.cls.lytic && a.time > lytic.time - 30 * MIN &&
      (a.time < lytic.time + C.POST_TREATMENT.antithromboticHoldH * HOUR || (!followUpScan || a.time < followUpScan.time))) : [];

    return { lytic, evt, anchor, imaging, cts, ctas, mris, lastCta, ctaResult, lastMri, mriResult, mriOrdered, followUpScan, fuHem, anyHem,
      pathway, onset, nihssSeries, nihssAdmit, nihssLatest, nihssBest, af, afNew, afCond, htn, dm, cancer, priorStroke, smoker,
      echos, pfo, pfoHit, lvThrombus, onAntiplatelet, onAnticoag, onProphylaxis, onStatin, earlyAntithrombotic, allText };
  }

  // Alerts: { level: 'red'|'amber'|'info', text, detail }
  function alerts(ctx, A, ans, post) {
    const out = [], T = C.TEXT, P = C.POST_TREATMENT, now = ctx.now;
    if (post.needMri) out.push({ level: 'red', text: 'Possible posterior circulation stroke with no MRI — ' + (A.mriOrdered ? 'MRI is ordered; make sure it is done' : 'MRI brain needed'), detail: C.POSTERIOR.text });
    else if (post.repeatMri) out.push({ level: 'amber', text: 'Posterior symptoms with an early negative MRI — consider repeat MRI at 48–72 h', detail: C.POSTERIOR.earlyMriText });
    if (A.anchor) {
      const winEnd = A.anchor + P.bpWindowH * HOUR;
      const high = ctx.obs.filter(o => o.time >= A.anchor && o.time <= Math.min(now, winEnd) && ((o.kind === 'sbp' && o.value > P.bpTreated.sbp) || (o.kind === 'dbp' && o.value > P.bpTreated.dbp)));
      if (high.length) out.push({ level: 'red', text: plural(high.length, 'BP reading') + ' above 180/105 in the 24 h after treatment', detail: 'Highest: ' + high.map(o => o.value).reduce((a, b) => Math.max(a, b)) + ' (' + fmtTime(high[high.length - 1].time) + ')' });
      const due = A.anchor + P.followUpImagingH * HOUR;
      if (!A.followUpScan && now > due + 2 * HOUR) out.push({ level: 'red', text: '24-hour follow-up CT is overdue (was due ' + fmtTime(due) + ')', detail: 'Needed before starting antiplatelet, anticoagulant or LMWH.' });
      if (A.fuHem === 'yes') out.push({ level: 'red', text: 'Follow-up imaging mentions hemorrhage — hold antithrombotics, discuss with neurology', detail: quote(findIn([A.followUpScan], T.hemorrhage)[0]) });
      if (A.earlyAntithrombotic.length) out.push({ level: 'red', text: 'Antithrombotic given within 24 h of the lytic or before the follow-up scan', detail: A.earlyAntithrombotic.map(a => a.name + ' ' + fmtTime(a.time)).join('; ') });
      if (A.lytic) {
        const ang = findIn(ctx.notes.filter(n => n.time >= A.lytic.time), T.angioedema)[0];
        if (ang) out.push({ level: 'red', text: 'Angioedema mentioned after the lytic', detail: quote(ang) });
      }
      if (A.evt) {
        const acc = findIn(ctx.notes.filter(n => n.time >= A.evt.time), T.access)[0];
        if (acc) out.push({ level: 'red', text: 'Access-site problem mentioned after EVT', detail: quote(acc) });
      }
    }
    if (A.nihssLatest && A.nihssBest != null && A.nihssLatest.value - A.nihssBest >= 4) out.push({ level: 'red', text: 'NIHSS up by ' + (A.nihssLatest.value - A.nihssBest) + ' from its best (' + A.nihssBest + ' → ' + A.nihssLatest.value + ')', detail: 'Neurological worsening: urgent CT and neurology.' });
    const worse = findIn(ctx.notes.filter(n => n.time >= now - DAY), T.worse)[0];
    if (worse) out.push({ level: 'amber', text: 'A note in the last 24 h mentions worsening', detail: quote(worse) });
    const glu = ctx.obs.filter(o => o.kind === 'glucose' && o.time >= now - DAY);
    const gHigh = glu.filter(o => o.value > P.glucose.high), gLow = glu.filter(o => o.value < P.glucose.low);
    if (gLow.length) out.push({ level: 'red', text: 'Glucose below ' + P.glucose.low + ' in the last 24 h (lowest ' + Math.min(...gLow.map(o => o.value)) + ')', detail: 'Target ' + P.glucose.target + '.' });
    if (gHigh.length) out.push({ level: 'amber', text: 'Glucose above ' + P.glucose.high + ' in the last 24 h (highest ' + Math.max(...gHigh.map(o => o.value)) + ')', detail: 'Target ' + P.glucose.target + '.' });
    const temps = ctx.obs.filter(o => o.kind === 'temp' && o.time >= now - DAY && o.value > P.tempHigh);
    if (temps.length) out.push({ level: 'amber', text: 'Temperature above ' + P.tempHigh + ' °C in the last 24 h (highest ' + Math.max(...temps.map(o => o.value)) + ')', detail: 'Treat fever; look for aspiration or UTI.' });
    const swPass = findIn(ctx.notes, T.swallowPass)[0], swFail = findIn(ctx.notes, T.swallowFail)[0];
    if (!swPass && !swFail && ans.swallow !== 'done') out.push({ level: 'amber', text: 'No swallow screen found', detail: 'Keep NPO until a swallow screen is passed.' });
    if (A.afNew) out.push({ level: 'amber', text: 'AF mentioned and not on the problem list — anticoagulation plan needed', detail: quote(A.afNew) });
    if (A.lvThrombus) out.push({ level: 'amber', text: 'Echo mentions LV thrombus — anticoagulation indication', detail: quote(A.lvThrombus) });
    return out;
  }

  // Timeline rows: { label, time, status: 'done'|'due'|'overdue'|'now'|'info', detail }
  function timeline(ctx, A, ans) {
    const P = C.POST_TREATMENT, now = ctx.now, rows = [];
    const sizeKey = ans.size || null;
    if (A.anchor) {
      const t0 = A.anchor;
      const phase = P.neuroChecks.find(p => now < t0 + p.untilH * HOUR);
      rows.push({ label: 'Neuro checks', time: null, status: phase ? 'now' : 'done', detail: phase ? phase.text + ' (until ' + fmtTime(t0 + phase.untilH * HOUR) + ')' : 'First 24 h complete; per unit routine now' });
      const bpEnd = t0 + P.bpWindowH * HOUR;
      rows.push({ label: 'BP ≤180/105', time: bpEnd, status: now < bpEnd ? 'now' : 'done', detail: (now < bpEnd ? 'Until ' : 'Ended ') + fmtTime(bpEnd) + '. ' + (A.evt ? C.POST_TREATMENT.bpEvtNote : 'Hold home antihypertensives in the first 24 h unless directed.') });
      const due = t0 + P.followUpImagingH * HOUR;
      rows.push({ label: '24-hour follow-up CT', time: due, status: A.followUpScan ? 'done' : (now > due + 2 * HOUR ? 'overdue' : 'due'),
        detail: A.followUpScan ? (A.followUpScan.title + ' ' + fmtTime(A.followUpScan.time) + ' — ' + (A.fuHem === 'yes' ? 'mentions hemorrhage' : 'no hemorrhage found')) : 'Due ' + fmtTime(due) + ' (' + rel(due, now) + ')' });
      const okToStart = A.followUpScan && A.fuHem === 'no';
      const startAt = Math.max(t0 + P.antithromboticHoldH * HOUR, A.followUpScan ? A.followUpScan.time : due);
      rows.push({ label: 'Antiplatelet can start', time: startAt, status: okToStart ? (A.onAntiplatelet.length || A.onAnticoag.length ? 'done' : 'now') : (A.fuHem === 'yes' ? 'overdue' : 'due'),
        detail: A.fuHem === 'yes' ? 'Hemorrhage on follow-up imaging — neurology to advise' : okToStart ? (A.onAntiplatelet.length ? 'On ' + A.onAntiplatelet.map(m => m.name).join(', ') : 'Follow-up scan clear — start unless neurology advises otherwise') : 'After 24 h and a follow-up scan without hemorrhage' });
      rows.push({ label: 'LMWH prophylaxis', time: startAt, status: okToStart ? (A.onProphylaxis.length ? 'done' : 'now') : 'due',
        detail: (A.onProphylaxis.length ? 'On ' + A.onProphylaxis.map(m => m.name).join(', ') : 'SCDs until then; start LMWH if immobile once the scan is clear') });
    } else {
      rows.push({ label: 'BP', time: null, status: 'info', detail: C.POST_TREATMENT.bpUntreated.text });
      rows.push({ label: 'Antiplatelet', time: null, status: A.onAntiplatelet.length || A.onAnticoag.length ? 'done' : 'now',
        detail: A.onAntiplatelet.length ? 'On ' + A.onAntiplatelet.map(m => m.name).join(', ') : 'Not treated with a lytic: start an antiplatelet once hemorrhage is excluded on CT' });
      rows.push({ label: 'LMWH prophylaxis', time: null, status: A.onProphylaxis.length ? 'done' : 'info', detail: A.onProphylaxis.length ? 'On ' + A.onProphylaxis.map(m => m.name).join(', ') : 'If immobile: SCDs; LMWH per neurology' });
    }
    // DAPT
    const nih = A.nihssAdmit;
    if (!A.lytic && !A.af && nih != null && nih <= C.DAPT.ticagrelorNihssMax && !A.anyHem) {
      const dual = A.onAntiplatelet.length >= 2;
      rows.push({ label: 'Dual antiplatelet (minor stroke)', time: A.onset ? A.onset + DAY : null, status: dual ? 'done' : 'info',
        detail: (dual ? 'On ' + A.onAntiplatelet.map(m => m.name).join(' + ') + '. ' : 'NIHSS ' + nih + (nih <= C.DAPT.nihssMax ? '' : ' (≤5: ticagrelor option)') + '. ') + C.DAPT.text });
    }
    // AF anticoagulation (ELAN)
    if (A.af) {
      const E = C.ELAN;
      const base = A.onset || A.anchor || ctx.arrival;
      if (!sizeKey) rows.push({ label: 'Anticoagulation for AF', time: null, status: 'due', detail: 'Choose the infarct size (Prognosis section) to show the ELAN start window. ' + E.note });
      else {
        const w = E[sizeKey];
        const from = base + w.fromH * HOUR, to = base + w.toH * HOUR;
        const on = A.onAnticoag.length;
        rows.push({ label: 'Anticoagulation for AF', time: from, status: on ? 'done' : (now > to ? 'overdue' : (now >= from ? 'now' : 'due')),
          detail: (on ? 'On ' + A.onAnticoag.map(m => m.name).join(', ') + '. ' : '') + E.sizes[sizeKey] + ': start ' + w.text + (base ? ' (' + fmtTime(from) + ' – ' + fmtTime(to) + ', from ' + (A.onset ? 'onset' : 'treatment/arrival') + ')' : '') + '. ' + E.note });
      }
    }
    return rows;
  }

  // Posterior circulation + HINTS
  function posterior(ctx, A, ans) {
    const P = C.POSTERIOR;
    const feats = P.features.map(([key, label, re]) => {
      const hits = findIn(ctx.notes, re);
      const ticked = ans['pf_' + key];
      const present = ticked === 'yes' || (ticked !== 'no' && hits.length > 0);
      return { key, label, hits, present, fromNotes: hits.length > 0 && ticked !== 'yes', ticked };
    });
    const present = feats.filter(f => f.present);
    const strong = present.some(f => P.strong.includes(f.key));
    let hints = hintsResult(ans);
    const suspect = ans.posterior === 'yes' || (ans.posterior !== 'no' && (strong || present.length >= P.minCount || hints.result === 'central'));
    const hasMri = !!A.lastMri;
    const onset = A.onset || ctx.arrival;
    const earlyMri = hasMri && onset && A.lastMri.time - onset < P.earlyMriH * HOUR;
    const needMri = suspect && !hasMri;
    const repeatMri = suspect && hasMri && A.mriResult === 'negative' && earlyMri;
    return { feats, present, suspect, needMri, repeatMri, hasMri, earlyMri, hints, onlyCt: !hasMri && A.cts.length > 0 };
  }
  function hintsResult(ans) {
    const H = C.HINTS.central;
    const parts = ['impulse', 'nystagmus', 'skew'].map(k => ans['hints_' + k] || '');
    const hearing = ans.hints_hearing || '';
    if (ans.hints_applies === 'no') return { result: 'na', text: 'HINTS doesn’t apply (no continuous vertigo with nystagmus). Decide on MRI from the other findings.' };
    if (parts.every(p => !p)) return { result: 'notdone', text: 'Not done.' };
    const central = (ans.hints_impulse === H.impulse) || H.nystagmus.includes(ans.hints_nystagmus) || ans.hints_skew === H.skew || hearing === H.hearing;
    if (central) return { result: 'central', text: 'Central (stroke) pattern — get an MRI; a negative early MRI does not rule out stroke.' };
    if (parts.some(p => !p)) return { result: 'incomplete', text: 'Incomplete — all three parts are needed to call it peripheral.' };
    const trained = ans.hints_trained === 'yes';
    return { result: 'peripheral', text: 'Peripheral pattern' + (trained ? '' : ' (examiner not marked as trained, so rely on it less)') + '. Lowers but doesn’t remove stroke risk; still get an MRI if there are other posterior signs, vascular risk factors or you’re unsure.' };
  }

  // Prognosis
  function prognosis(ctx, A, ans) {
    const P = C.PROGNOSIS;
    const age = ctx.age, nih = A.nihssAdmit;
    const glu = ctx.obs.filter(o => o.kind === 'glucose' && ctx.arrival && o.time <= ctx.arrival + 6 * HOUR && o.time >= ctx.arrival - HOUR)[0] || ctx.obs.find(o => o.kind === 'glucose');
    const vf = ans.vf === 'yes' || (ans.vf !== 'no' && !!findIn(ctx.notes, /\bhemianopi\w*|\bvisual field (?:defect|cut|loss)\b|\bquadrantanopi\w*/i)[0]);
    const loc = ans.loc === 'yes';
    const onsetToArrivalH = A.onset && ctx.arrival ? (ctx.arrival - A.onset) / HOUR : null;
    const late = ans.late === 'yes' || (ans.late !== 'no' && onsetToArrivalH != null && onsetToArrivalH > 3);
    let astral = null, astralParts = null;
    if (age != null && nih != null) {
      astralParts = { age: Math.floor(age / 5), nihss: nih, time: late ? 2 : 0, vf: vf ? 2 : 0, glucose: glu && (glu.value > 7.3 || glu.value < 3.7) ? 1 : 0, loc: loc ? 3 : 0 };
      astral = Object.values(astralParts).reduce((a, b) => a + b, 0);
    }
    let thrive = null, thriveParts = null;
    if (age != null && nih != null) {
      thriveParts = { nihss: nih <= 10 ? 0 : nih <= 20 ? 2 : 4, age: age <= 59 ? 0 : age <= 79 ? 1 : 2, htn: A.htn ? 1 : 0, dm: A.dm ? 1 : 0, af: A.af ? 1 : 0 };
      thrive = Object.values(thriveParts).reduce((a, b) => a + b, 0);
    }
    const band = thrive == null ? null : P.thriveBands.find(b => thrive <= b.max);
    const vol = ans.volume !== undefined && ans.volume !== '' ? +ans.volume : (ans.abcA && ans.abcB && ans.abcC ? round(ans.abcA * ans.abcB * ans.abcC / 2, 1) : null);
    const loc2 = ans.location ? P.locations.find(l => l[0] === ans.location) : null;
    return { astral, astralParts, thrive, thriveParts, band, glucose: glu, vf, loc, late, onsetToArrivalH, vol, location: loc2,
      malignant: vol != null && vol > P.malignantMcaMl, nihss: nih, age };
  }

  // Workup tracker
  function workup(ctx, A, ans) {
    const lab = k => ctx.obs.filter(o => o.kind === k).pop();
    const findAny = re => findIn(ctx.reports.concat(ctx.orders, ctx.procedures), re, { allowNegated: true })[0] || findIn(ctx.notes, re)[0];
    const esus = ans.esus === 'yes' || (ans.esus !== 'no' && (A.pathway === 'esus' || (A.pathway === 'confirmed' && A.ctaResult !== 'positive')));
    const embolicWorkup = esus || A.pathway === 'mriPending';
    const items = C.WORKUP.filter(w => w.always || (w.esus && embolicWorkup && (!w.ageMax || ctx.age == null || ctx.age <= w.ageMax || ans.esus === 'yes')))
      .map(w => {
        let hit = null, status = 'missing', detail = '';
        if (w.lab) { const v = lab(w.lab); if (v) { status = 'done'; detail = (w.lab === 'ldl' ? 'LDL ' + v.value + ' mmol/L' : 'A1c ' + v.value + '%') + ', ' + fmtDate(v.time); } }
        else {
          hit = findAny(w.find);
          if (hit) {
            const isOrder = ctx.orders.some(o => o.time === hit.time && o.text === (hit.title || '')) && !ctx.reports.some(r => w.find.test(r.title));
            status = isOrder ? 'ordered' : 'done';
            detail = (hit.title || '') + ', ' + fmtDate(hit.time);
          }
        }
        if (w.key === 'swallow') { const p = findIn(ctx.notes, C.TEXT.swallowPass)[0], f = findIn(ctx.notes, C.TEXT.swallowFail)[0]; if (p) { status = 'done'; detail = 'Passed: ' + quote(p); } else if (f) { status = 'done'; detail = 'Failed / NPO: ' + quote(f); } }
        if (w.key === 'prolonged' && status === 'missing') status = 'outpatient';
        if (w.key === 'mri' && status === 'missing' && A.pathway === 'treated' && A.ctaResult === 'positive') { status = 'consider'; detail = 'Optional when CT/CTA explain the stroke'; }
        if (w.key === 'clinic' && status === 'missing') status = 'outpatient';
        if (ans['wk_' + w.key] === 'done') { status = 'done'; detail = detail || 'Marked done'; }
        return { key: w.key, label: w.label, status, detail };
      });
    // ESUS extras
    const multi = ans.location === 'multiple' || !!findIn(A.mris, /\bmultiple (?:vascular )?territor\w*|\bbilateral\b[^.]{0,30}\binfarct|\bscattered\b[^.]{0,30}\binfarct/i)[0];
    const ddimer = lab('ddimer');
    const extra = !esus ? [] : C.ESUS_TESTS.filter(t => {
      if (t.ageMax && ctx.age != null && ctx.age > t.ageMax) return false;
      if (t.female && ctx.sex !== 'female') return false;
      if (t.needs === 'pfo' && !A.pfo) return false;
      return true;
    }).map(t => {
      const hit = findAny(t.find);
      let why = t.when;
      let priority = false;
      if (t.key === 'ddimer' && (multi || A.cancer)) priority = true;
      if (t.key === 'ddimer' && ddimer) why = 'D-dimer ' + ddimer.value + ' (' + fmtDate(ddimer.time) + ')' + (ddimer.value > 3 ? ' — high: consider CT chest/abdomen/pelvis' : '');
      if (t.key === 'cultures' && (multi || findIn(ctx.notes, C.TEXT.fever)[0])) priority = true;
      if (t.key === 'tee' && (multi || A.pfo)) priority = true;
      if (t.key === 'legDoppler' && A.pfo) priority = true;
      if (t.key === 'apl' && ctx.age != null && ctx.age < 50) priority = true;
      const deferNow = t.defer && (A.onAnticoag.length || A.onProphylaxis.length || ctx.meds.some(m => /heparin|warfarin/.test(normMed(m.name))));
      return { key: t.key, label: t.label, why, priority, status: ans['wk_' + t.key] === 'done' ? 'done' : (hit ? 'done' : (deferNow ? 'defer' : 'consider')), detail: hit ? (hit.title || '') + ', ' + fmtDate(hit.time) : '' };
    });
    // RoPE
    let rope = null;
    if (A.pfo && ctx.age != null) {
      const R = C.ROPE;
      const agePts = R.age.find(a => ctx.age <= a[0])[1];
      const cortical = ans.location ? ['cortical', 'largeMca', 'multiple'].includes(ans.location) : !!findIn(A.mris, /\bcortical\b/i)[0];
      const parts = { age: agePts, noHtn: A.htn ? 0 : 1, noDm: A.dm ? 0 : 1, noPriorStroke: A.priorStroke ? 0 : 1, nonSmoker: A.smoker === true ? 0 : (A.smoker === false ? 1 : 0), cortical: cortical ? 1 : 0 };
      rope = { score: Object.values(parts).reduce((a, b) => a + b, 0), parts, smokerUnknown: A.smoker == null,
        closureAge: ctx.age >= R.pfoClosure.ageMin && ctx.age <= R.pfoClosure.ageMax };
    }
    return { esus, items, extra, rope, multi };
  }

  // ------------------------------------------------------------------ handoff text
  const PATHWAY_LABEL = {
    treated: 'Treated (lytic and/or EVT)', mriPending: 'CTA negative — MRI pending', confirmed: 'Stroke confirmed on MRI (no lytic/EVT)',
    mriNegative: 'MRI negative (TIA or mimic?)', esus: 'ESUS — embolic stroke of undetermined source'
  };
  function summaryText(ctx, A, al, tl, post, prog, wk) {
    const L = [];
    L.push('Stroke follow-up (hospitalist), ' + fmtTime(ctx.now) + '. Pathway: ' + PATHWAY_LABEL[A.pathway] + '.');
    if (A.lytic) L.push('Lytic: ' + A.lytic.drug + ' ' + fmtTime(A.lytic.time) + (A.lytic.approx ? ' (time from note)' : '') + '.');
    if (A.evt) L.push('EVT: ' + fmtTime(A.evt.time) + (A.evt.tici ? ', TICI ' + A.evt.tici : '') + '.');
    L.push('CTA: ' + (A.lastCta ? ({ positive: 'occlusion/thrombus reported', negative: 'no occlusion reported', unclear: 'see report' }[A.ctaResult]) + ' (' + fmtDate(A.lastCta.time) + ')' : 'none found') +
      '. MRI: ' + (A.lastMri ? ({ positive: 'acute infarct', negative: 'no acute infarct', unclear: 'see report' }[A.mriResult]) + ' (' + fmtDate(A.lastMri.time) + ')' : (A.mriOrdered ? 'ordered, pending' : 'not done')) + '.');
    if (A.nihssAdmit != null) L.push('NIHSS: ' + A.nihssAdmit + (A.nihssLatest && A.nihssLatest.value !== A.nihssAdmit ? ' → ' + A.nihssLatest.value : '') + '.');
    if (al.length) L.push('Alerts: ' + al.map(a => a.text).join('; ') + '.');
    if (post.suspect) L.push('Posterior circulation features: ' + post.present.map(f => f.label).join(', ') + (post.hints.result !== 'notdone' ? '. HINTS: ' + post.hints.result : '') + '.');
    tl.filter(r => r.status !== 'info').forEach(r => L.push(r.label + ': ' + r.detail.replace(/\s+/g, ' ')));
    if (prog.thrive != null) L.push('Scores: THRIVE ' + prog.thrive + (prog.band ? ' (' + prog.band.label.toLowerCase() + ')' : '') + ', ASTRAL ' + prog.astral + '.');
    const outstanding = wk.items.filter(i => i.status !== 'done').map(i => i.label + (i.status === 'outpatient' ? ' (outpatient)' : i.status === 'ordered' ? ' (ordered)' : ''));
    const extra = wk.extra.filter(i => i.status !== 'done' && (i.priority || i.status === 'defer')).map(i => i.label + (i.status === 'defer' ? ' (defer to outpatient)' : ''));
    if (outstanding.length || extra.length) L.push('Outstanding workup / follow-up: ' + outstanding.concat(extra).join('; ') + '.');
    if (wk.rope) L.push('PFO: RoPE ' + wk.rope.score + '/10.');
    L.push('Decision support only; follow neurology recommendations.');
    return L.join('\n');
  }

  // ------------------------------------------------------------------ loading
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
  async function fhirSearch(client, url, pageLimit) {
    const r = await client.request(url, { pageLimit: pageLimit || 5, flat: true });
    return Array.isArray(r) ? r : (r && r.entry ? r.entry.map(e => e.resource) : []);
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
    const docs = await fhirSearch(client, 'DocumentReference?patient=' + pid + '&_count=100', 3);
    const recent = docs.filter(d => d.status !== 'entered-in-error')
      .map(d => ({ d, time: toTime(d.date || (d.context && d.context.period && d.context.period.start)) }))
      .filter(x => x.time != null && x.time >= from && x.time <= to).sort((a, b) => b.time - a.time).slice(0, CONFIG.maxNotes);
    const texts = await Promise.allSettled(recent.map(x => withTimeout(noteText(client, x.d), CONFIG.timeouts.noteMs, 'note')));
    return recent.map((x, i) => ({ time: x.time, title: ccText(x.d.type) || x.d.description || 'Note', text: texts[i].status === 'fulfilled' ? texts[i].value : '' })).filter(n => n.text);
  }
  function throttled(client) {
    let active = 0; const queue = [];
    const next = () => { while (active < CONFIG.maxParallel && queue.length) { const j = queue.shift(); active++; Promise.resolve().then(j.fn).then(j.resolve, j.reject).finally(() => { active--; next(); }); } };
    return { patient: client.patient, request: (...a) => new Promise((resolve, reject) => { queue.push({ fn: () => client.request(...a), resolve, reject }); next(); }) };
  }
  async function loadResources(rawClient, opts) {
    const client = throttled(rawClient);
    const pid = client.patient.id, from = opts.from, to = opts.to, ge = fhirDate(from);
    const failed = [], reasons = {}, out = {};
    const progress = opts.onProgress || function () {};
    const run = async (label, key, fn, fallback, ms) => {
      progress(label, 'loading');
      try { const v = await withTimeout(Promise.resolve().then(fn), ms || CONFIG.timeouts.searchMs, label); out[key] = v; progress(label, 'done', Array.isArray(v) ? v.length : null); }
      catch (e) { if (typeof console !== 'undefined') console.warn('[stroke] ' + label, e); out[key] = fallback; failed.push(label); reasons[label] = shortError(e); progress(label, 'failed', null, shortError(e)); }
    };
    const firstWorking = async (urls, pages) => { let last; for (const u of urls) { try { return await fhirSearch(client, u, pages); } catch (e) { last = e; } } throw last; };
    await Promise.all([
      run('Patient', 'patient', () => client.patient.read(), null),
      run('Encounters', 'encounters', () => firstWorking(['Encounter?patient=' + pid + '&date=ge' + ge + '&_count=50', 'Encounter?patient=' + pid + '&_count=50'], 2), []),
      run('Problem list', 'conditions', () => firstWorking(['Condition?patient=' + pid + '&category=problem-list-item', 'Condition?patient=' + pid], 3), []),
      run('Active medications', 'medRequests', () => fhirSearch(client, 'MedicationRequest?patient=' + pid + '&status=active&_count=100', 3), [])
    ]);
    await Promise.all([
      run('Medications given', 'medAdmins', () => fhirSearch(client, 'MedicationAdministration?patient=' + pid + '&effective-time=ge' + ge + '&_count=100', 10), []),
      run('Vitals and labs', 'observations', async () => {
        const rs = await Promise.allSettled([
          fhirSearch(client, 'Observation?patient=' + pid + '&category=vital-signs&date=ge' + ge + '&_count=100', 15),
          fhirSearch(client, 'Observation?patient=' + pid + '&category=laboratory&date=ge' + fhirDate(from - 180 * DAY) + '&_count=100', 15),
          fhirSearch(client, 'Observation?patient=' + pid + '&category=survey&date=ge' + ge + '&_count=100', 3)
        ]);
        const ok = rs.filter(r => r.status === 'fulfilled'); if (!ok.length) throw rs[0].reason; return ok.flatMap(r => r.value);
      }, [], CONFIG.timeouts.searchMs * 2),
      run('Imaging and reports', 'reports', () => firstWorking(['DiagnosticReport?patient=' + pid + '&date=ge' + ge + '&_count=100', 'DiagnosticReport?patient=' + pid + '&_count=100'], 5), []),
      run('Procedures', 'procedures', () => fhirSearch(client, 'Procedure?patient=' + pid + '&date=ge' + ge + '&_count=100', 3), []),
      run('Orders', 'orders', () => fhirSearch(client, 'ServiceRequest?patient=' + pid + '&_count=100', 3), []),
      run('Notes', 'notes', () => loadNotes(client, pid, from, to), [], CONFIG.timeouts.notesMs)
    ]);
    return Object.assign(out, { failed, reasons });
  }

  // ------------------------------------------------------------------ rendering
  const ST = { done: ['Done', 'st-done'], due: ['Due', 'st-due'], overdue: ['Overdue', 'st-over'], now: ['Now', 'st-now'], info: ['Info', 'st-info'],
    missing: ['Missing', 'st-over'], ordered: ['Ordered', 'st-due'], outpatient: ['Outpatient', 'st-info'], consider: ['Consider', 'st-due'], defer: ['Defer', 'st-info'] };
  const badge = s => '<span class="sf-badge ' + ST[s][1] + '">' + ST[s][0] + '</span>';
  const sel = (key, options, val) => '<select data-k="' + esc(key) + '">' + options.map(o => '<option value="' + esc(o[0]) + '"' + ((val || '') === o[0] ? ' selected' : '') + '>' + esc(o[1]) + '</option>').join('') + '</select>';
  const YN = [['', 'Auto / not answered'], ['yes', 'Yes'], ['no', 'No']];

  function pathwayIcon(p) {
    const m = { treated: ['#0b4f8a', 'Rx'], mriPending: ['#b07a10', 'MRI'], confirmed: ['#5b2a86', 'CVA'], mriNegative: ['#2d6a0b', '−'], esus: ['#a32d2d', 'ESUS'] }[p];
    return '<svg class="sf-icon" viewBox="0 0 52 52" width="52" height="52" aria-hidden="true"><rect x="1" y="1" width="50" height="50" rx="11" fill="' + m[0] + '"/>' +
      '<path d="M15 14c3-5 19-5 22 0 3 4 1 9-2 10 2 3-1 7-5 6-2 3-8 3-9 0-4 1-7-3-5-6-3-1-4-6-1-10z" fill="none" stroke="#fff" stroke-width="2" opacity=".85"/>' +
      '<text x="26" y="45" text-anchor="middle" font-family="system-ui,sans-serif" font-size="' + (m[1].length > 3 ? 10 : 12) + '" font-weight="700" fill="#fff">' + m[1] + '</text></svg>';
  }

  function headerHtml(ctx, A, ans) {
    const facts = [];
    if (A.lytic) facts.push('<strong>' + esc(A.lytic.drug) + '</strong> ' + esc(fmtTime(A.lytic.time)) + (A.lytic.approx ? ' <span class="sf-muted">(time from a note — confirm)</span>' : '') + ' · ' + esc(rel(A.lytic.time, ctx.now)));
    if (A.evt) facts.push('<strong>EVT</strong> ' + esc(fmtTime(A.evt.time)) + (A.evt.tici ? ', TICI ' + esc(A.evt.tici) : '') + (A.evt.approx ? ' <span class="sf-muted">(from a note)</span>' : ''));
    facts.push('<strong>CTA</strong> ' + (A.lastCta ? esc({ positive: 'occlusion/thrombus reported', negative: 'no occlusion', unclear: 'see report' }[A.ctaResult]) + ' · ' + esc(fmtDate(A.lastCta.time)) : '<span class="sf-muted">none found</span>'));
    facts.push('<strong>MRI</strong> ' + (A.lastMri ? esc({ positive: 'acute infarct', negative: 'no acute infarct', unclear: 'see report' }[A.mriResult]) + ' · ' + esc(fmtDate(A.lastMri.time)) : (A.mriOrdered ? 'ordered, pending' : '<span class="sf-muted">not done</span>')));
    if (A.nihssAdmit != null) facts.push('<strong>NIHSS</strong> ' + A.nihssAdmit + (A.nihssLatest && A.nihssLatest.value !== A.nihssAdmit ? ' → ' + A.nihssLatest.value : ''));
    const opts = [['', 'Auto: ' + PATHWAY_LABEL[A.autoPathway || A.pathway]]].concat(Object.keys(PATHWAY_LABEL).map(k => [k, PATHWAY_LABEL[k]]));
    return '<section class="sf-head sf-p-' + A.pathway + '">' + pathwayIcon(A.pathway) + '<div class="sf-head-body"><div class="sf-head-top"><h2>' + esc(PATHWAY_LABEL[A.pathway]) + '</h2>' +
      '<label class="sf-small">Pathway ' + sel('pathway', opts, ans.pathway) + '</label></div><p class="sf-facts">' + facts.join(' &nbsp;·&nbsp; ') + '</p>' +
      '<div class="sf-nums"><label>Symptom onset / last known well<input type="datetime-local" data-k="onset" value="' + esc(ans.onset || '') + '"></label>' +
      '<label>Admission NIHSS' + (A.nihssSeries.length ? ' <span class="sf-muted">chart: ' + A.nihssSeries[0].value + '</span>' : '') + '<input type="number" min="0" max="42" data-k="nihss" value="' + esc(ans.nihss || '') + '"></label></div></div></section>';
  }

  function alertsHtml(al) {
    if (!al.length) return '<section class="sf-card sf-ok"><strong>No alerts.</strong> Nothing out of range or overdue in the data checked.</section>';
    return '<section class="sf-alerts">' + al.map(a => '<div class="sf-alert sf-a-' + a.level + '"><strong>' + esc(a.text) + '</strong>' + (a.detail ? '<div class="sf-small">' + esc(a.detail) + '</div>' : '') + '</div>').join('') + '</section>';
  }

  function timelineHtml(tl) {
    return '<div class="sf-table-wrap"><table class="sf-table"><tbody>' + tl.map(r => '<tr><th scope="row">' + esc(r.label) + '</th><td>' + badge(r.status) + '</td><td>' + esc(r.detail) + '</td></tr>').join('') + '</tbody></table></div>';
  }

  function bpChart(ctx, A) {
    const from = ctx.now - 48 * HOUR;
    const sbp = ctx.obs.filter(o => o.kind === 'sbp' && o.time >= from), dbp = ctx.obs.filter(o => o.kind === 'dbp' && o.time >= from);
    if (!sbp.length) return '<p class="sf-muted">No BP readings in the last 48 h.</p>';
    const W = 640, H = 200, padL = 36, padR = 8, padT = 10, padB = 24;
    const x = t => padL + (t - from) / (48 * HOUR) * (W - padL - padR);
    const vals = sbp.concat(dbp).map(o => o.value);
    const lim = A.anchor ? C.POST_TREATMENT.bpTreated : C.POST_TREATMENT.bpUntreated;
    const lo = Math.max(0, Math.floor((Math.min(...vals) - 10) / 10) * 10), hi = Math.max(lim.sbp + 10, ...vals);
    const y = v => padT + (hi - v) / (hi - lo) * (H - padT - padB);
    const path = arr => arr.map((o, i) => (i ? 'L' : 'M') + x(o.time).toFixed(1) + ' ' + y(o.value).toFixed(1)).join(' ');
    const ticks = [0, 12, 24, 36, 48].map(h => { const t = from + h * HOUR; return '<text x="' + x(t) + '" y="' + (H - 6) + '" text-anchor="middle" class="sf-ax">' + (h === 48 ? 'now' : '−' + (48 - h) + 'h') + '</text>'; }).join('');
    const yt = [lo, Math.round((lo + hi) / 2), hi].map(v => '<text x="' + (padL - 4) + '" y="' + (y(v) + 4) + '" text-anchor="end" class="sf-ax">' + Math.round(v) + '</text>').join('');
    let win = '';
    if (A.anchor) { const a = Math.max(from, A.anchor), b = Math.min(ctx.now, A.anchor + 24 * HOUR); if (b > a) win = '<rect x="' + x(a) + '" y="' + padT + '" width="' + (x(b) - x(a)) + '" height="' + (H - padT - padB) + '" class="sf-win"/>'; }
    const dots = sbp.map(o => '<circle cx="' + x(o.time).toFixed(1) + '" cy="' + y(o.value).toFixed(1) + '" r="3" class="' + (o.value > lim.sbp ? 'sf-dot-hi' : 'sf-dot') + '"><title>SBP ' + o.value + ' · ' + fmtTime(o.time) + '</title></circle>').join('');
    return '<svg class="sf-chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Blood pressure, last 48 hours">' + win +
      '<line x1="' + padL + '" x2="' + (W - padR) + '" y1="' + y(lim.sbp) + '" y2="' + y(lim.sbp) + '" class="sf-lim"/><text x="' + (W - padR) + '" y="' + (y(lim.sbp) - 4) + '" text-anchor="end" class="sf-ax sf-lim-t">SBP ' + lim.sbp + '</text>' +
      '<path d="' + path(dbp) + '" class="sf-line-d"/><path d="' + path(sbp) + '" class="sf-line-s"/>' + dots + ticks + yt + '</svg>' +
      '<p class="sf-legend"><span class="sf-key sf-key-s"></span>Systolic <span class="sf-key sf-key-d"></span>Diastolic' + (A.anchor ? ' <span class="sf-key sf-key-w"></span>First 24 h after treatment' : '') + '</p>';
  }

  function posteriorHtml(post, ans, A) {
    const verdict = post.needMri ? '<div class="sf-alert sf-a-red"><strong>MRI needed.</strong> ' + esc(C.POSTERIOR.text) + (post.onlyCt ? ' Only a CT' + (A.lastCta ? ' and CTA have' : ' has') + ' been done.' : '') + '</div>'
      : post.repeatMri ? '<div class="sf-alert sf-a-amber"><strong>Early MRI was negative.</strong> ' + esc(C.POSTERIOR.earlyMriText) + '</div>'
      : post.suspect ? '<div class="sf-alert sf-a-info">Posterior features present; MRI done.</div>'
      : '<p class="sf-muted">No posterior circulation features found in notes or entered.</p>';
    const feats = '<div class="sf-feats">' + post.feats.map(f => '<div class="sf-feat' + (f.present ? ' sf-feat-on' : '') + '"><label>' + esc(f.label) + ' ' + sel('pf_' + f.key, [['', f.hits.length ? 'Auto: in notes' : 'Auto: not found'], ['yes', 'Present'], ['no', 'Absent']], f.ticked) + '</label>' +
      (f.hits.length && f.ticked !== 'no' ? '<div class="sf-hint">' + esc(quote(f.hits[0])) + '</div>' : '') + '</div>').join('') + '</div>';
    const H = C.HINTS.labels;
    const hints = '<div class="sf-group"><h4>HINTS exam</h4><p class="sf-small">' + esc(C.HINTS.applies) + '</p><div class="sf-nums">' +
      '<label>Continuous vertigo with nystagmus now?' + sel('hints_applies', [['', 'Not answered'], ['yes', 'Yes'], ['no', 'No']], ans.hints_applies) + '</label>' +
      '<label>Examiner trained in HINTS?' + sel('hints_trained', [['', 'Not answered'], ['yes', 'Yes'], ['no', 'No']], ans.hints_trained) + '</label>' +
      '<label>Head impulse' + sel('hints_impulse', H.impulse, ans.hints_impulse) + '</label>' +
      '<label>Nystagmus' + sel('hints_nystagmus', H.nystagmus, ans.hints_nystagmus) + '</label>' +
      '<label>Test of skew' + sel('hints_skew', H.skew, ans.hints_skew) + '</label>' +
      '<label>Hearing (HINTS-plus)' + sel('hints_hearing', H.hearing, ans.hints_hearing) + '</label></div>' +
      '<p class="sf-hints-r sf-h-' + post.hints.result + '"><strong>Result:</strong> ' + esc(post.hints.text) + '</p></div>';
    return verdict + '<label class="sf-inline">Suspect posterior circulation stroke? ' + sel('posterior', [['', 'Auto (' + (post.suspect ? 'yes' : 'no') + ')'], ['yes', 'Yes'], ['no', 'No']], ans.posterior) + '</label>' + feats + hints;
  }

  function prognosisHtml(prog, ans, A) {
    const P = C.PROGNOSIS;
    const part = (o, names) => Object.keys(o).map(k => names[k] + ' ' + o[k]).join(' + ');
    const scores = prog.thrive == null ? '<p class="sf-muted">Needs age and admission NIHSS (enter the NIHSS above).</p>' :
      '<div class="sf-scores"><div class="sf-score"><div class="sf-score-l">THRIVE</div><div class="sf-score-v">' + prog.thrive + '<span>/9</span></div><div class="sf-small">' + esc(prog.band.label) +
      (P.thriveTable ? ' · ' + esc(P.thriveTable[prog.thrive <= 2 ? '0-2' : prog.thrive <= 5 ? '3-5' : '6-9'] || '') : '') + '</div><div class="sf-muted">' + esc(part(prog.thriveParts, { nihss: 'NIHSS', age: 'age', htn: 'HTN', dm: 'DM', af: 'AF' })) + '</div></div>' +
      '<div class="sf-score"><div class="sf-score-l">ASTRAL</div><div class="sf-score-v">' + prog.astral + '</div><div class="sf-small">Higher = more likely dependent or dead at 3 months</div><div class="sf-muted">' +
      esc(part(prog.astralParts, { age: 'age/5', nihss: 'NIHSS', time: '>3 h', vf: 'visual field', glucose: 'glucose', loc: 'LOC' })) + '</div></div></div>' +
      '<p class="sf-small">Percentages: these scores were validated with outcome tables that aren’t built in yet. Use <a href="' + P.links.thrive + '" target="_blank" rel="noopener">THRIVE</a> or <a href="' + P.links.astral + '" target="_blank" rel="noopener">ASTRAL</a> on MDCalc for the published probability. NIHSS is the strongest single predictor.</p>';
    const inputs = '<div class="sf-nums"><label>Visual field defect' + sel('vf', [['', 'Auto (' + (prog.vf ? 'yes' : 'no') + ')'], ['yes', 'Yes'], ['no', 'No']], ans.vf) + '</label>' +
      '<label>Decreased consciousness on arrival' + sel('loc', [['', 'No'], ['yes', 'Yes']], ans.loc) + '</label>' +
      '<label>Onset to arrival > 3 h' + sel('late', [['', 'Auto (' + (prog.onsetToArrivalH == null ? 'unknown' : round(prog.onsetToArrivalH, 1) + ' h') + ')'], ['yes', 'Yes'], ['no', 'No']], ans.late) + '</label></div>';
    const size = '<div class="sf-group"><h4>Infarct size and location (from the MRI or CT)</h4><div class="sf-nums">' +
      '<label>Location' + sel('location', [['', 'Not set']].concat(P.locations.map(l => [l[0], l[1]])), ans.location) + '</label>' +
      '<label>Size (ELAN, for AF timing)' + sel('size', [['', 'Not set']].concat(Object.keys(C.ELAN.sizes).map(k => [k, C.ELAN.sizes[k]])), ans.size) + '</label>' +
      '<label>Volume, mL (if reported)<input type="number" step="1" data-k="volume" value="' + esc(ans.volume || '') + '"></label></div>' +
      '<p class="sf-small">Or estimate with ABC/2 (cm): <input class="sf-abc" type="number" step="0.1" data-k="abcA" value="' + esc(ans.abcA || '') + '" aria-label="A"> × <input class="sf-abc" type="number" step="0.1" data-k="abcB" value="' + esc(ans.abcB || '') + '" aria-label="B"> × <input class="sf-abc" type="number" step="0.1" data-k="abcC" value="' + esc(ans.abcC || '') + '" aria-label="C"> ÷ 2' +
      (prog.vol != null ? ' = <strong>' + prog.vol + ' mL</strong>' : '') + '</p>' +
      (prog.location ? '<p><strong>' + esc(prog.location[1]) + ':</strong> ' + esc(prog.location[2]) + '</p>' : '') +
      (prog.malignant ? '<div class="sf-alert sf-a-red"><strong>Infarct volume > ' + P.malignantMcaMl + ' mL.</strong> High risk of malignant swelling if this is an MCA infarct (DWI within 14 h). Involve neurosurgery early; hemicraniectomy within 48 h improves survival in age ≤60.</div>' : '') + '</div>';
    return scores + inputs + size + '<p class="sf-foot">Scores estimate groups, not individuals; recovery continues for months. Don’t use them alone for goals-of-care decisions.</p>';
  }

  function workupHtml(wk, A, ans, ctx) {
    const row = i => '<tr><th scope="row">' + esc(i.label) + '</th><td>' + badge(i.status) + '</td><td>' + esc(i.detail || '') +
      (i.status !== 'done' ? ' <label class="sf-mark"><input type="checkbox" data-k="wk_' + esc(i.key) + '"' + (ans['wk_' + i.key] === 'done' ? ' checked' : '') + '> mark done</label>' : '') + '</td></tr>';
    let h = '<div class="sf-table-wrap"><table class="sf-table"><tbody>' + wk.items.map(row).join('') + '</tbody></table></div>';
    h += '<label class="sf-inline">Treat as ESUS / cryptogenic (show the extra workup) ' + sel('esus', [['', 'Auto (' + (wk.esus ? 'yes' : 'no') + ')'], ['yes', 'Yes'], ['no', 'No']], ans.esus) + '</label>';
    if (wk.esus) {
      h += '<div class="sf-group"><h4>ESUS workup (when the CTA is clear)</h4><p class="sf-small">ESUS = non-lacunar infarct on imaging, no ≥50% stenosis upstream, no major cardiac source after echo and ECG monitoring, no other specific cause.</p>';
      h += '<div class="sf-table-wrap"><table class="sf-table"><tbody>' + wk.extra.map(i => '<tr' + (i.priority && i.status !== 'done' ? ' class="sf-pri"' : '') + '><th scope="row">' + esc(i.label) + (i.priority && i.status !== 'done' ? ' <span class="sf-badge st-over">Suggested</span>' : '') +
        '</th><td>' + badge(i.status) + '</td><td>' + esc(i.why) + (i.detail ? '<div class="sf-muted">' + esc(i.detail) + '</div>' : '') +
        (i.status !== 'done' ? ' <label class="sf-mark"><input type="checkbox" data-k="wk_' + esc(i.key) + '"' + (ans['wk_' + i.key] === 'done' ? ' checked' : '') + '> done</label>' : '') + '</td></tr>').join('') + '</tbody></table></div>';
      h += '<div class="sf-nums"><label>PFO / shunt on bubble study' + sel('pfo', [['', 'Auto (' + (A.pfo == null ? 'not known' : A.pfo ? 'yes' : 'no') + ')'], ['yes', 'Yes'], ['no', 'No']], ans.pfo) + '</label>' +
        '<label>Current smoker' + sel('smoker', [['', 'Auto (' + (A.smoker == null ? 'unknown' : A.smoker ? 'yes' : 'no') + ')'], ['yes', 'Yes'], ['no', 'No']], ans.smoker) + '</label>' +
        '<label>AF found' + sel('af', [['', 'Auto (' + (A.af ? 'yes' : 'no') + ')'], ['yes', 'Yes']], ans.af) + '</label></div>';
      if (wk.rope) {
        const r = wk.rope;
        h += '<div class="sf-card"><strong>RoPE score ' + r.score + '/10</strong> <span class="sf-muted">(age ' + r.parts.age + ', no HTN ' + r.parts.noHtn + ', no DM ' + r.parts.noDm + ', no prior stroke ' + r.parts.noPriorStroke + ', non-smoker ' + r.parts.nonSmoker + ', cortical ' + r.parts.cortical + ')</span>' +
          (r.smokerUnknown ? '<div class="sf-muted">Smoking status unknown — counted as 0.</div>' : '') +
          '<p class="sf-small">Higher scores (7–10) make the PFO more likely the cause. ' + esc(C.ROPE.pfoClosure.text) + '</p>' +
          (r.closureAge ? '<p class="sf-small"><strong>In the age range for closure.</strong> Refer for a PFO closure opinion if neurology agrees.</p>' : '<p class="sf-small">Outside the 18–60 closure age range.</p>') + '</div>';
      }
      h += '<p class="sf-small sf-esus-tx"><strong>Treatment:</strong> ' + esc(C.ESUS_TREATMENT) + '</p></div>';
    }
    return h;
  }

  function render(ctx, A, ans, parts) {
    const { al, tl, post, prog, wk } = parts;
    const H = [];
    H.push('<div class="sf">');
    if (ctx.failed.length) H.push('<div class="sf-alert sf-a-red"><strong>Incomplete:</strong> some data didn’t load. <button type="button" class="sf-btn sf-retry">Try again</button><ul>' + ctx.failed.map(f => '<li>' + esc(f) + (ctx.reasons[f] ? ' — ' + esc(ctx.reasons[f]) : '') + '</li>').join('') + '</ul></div>');
    if (ctx.age != null && ctx.age < 18) H.push('<div class="sf-alert sf-a-red">This patient is under 18. These are adult rules.</div>');
    H.push(headerHtml(ctx, A, ans));
    H.push('<section class="sf-section"><h3 class="sf-h">Alerts</h3>' + alertsHtml(al) + '</section>');
    H.push('<section class="sf-section"><h3 class="sf-h">Timeline</h3>' + timelineHtml(tl) + '<div class="sf-card">' + bpChart(ctx, A) + '</div></section>');
    H.push('<section class="sf-section"><h3 class="sf-h">Posterior circulation check</h3>' + posteriorHtml(post, ans, A) + '</section>');
    H.push('<section class="sf-section"><h3 class="sf-h">Prognosis</h3>' + prognosisHtml(prog, ans, A) + '</section>');
    H.push('<section class="sf-section"><h3 class="sf-h">Workup and secondary prevention</h3>' + workupHtml(wk, A, ans, ctx) + '</section>');
    H.push('<section class="sf-section"><h3 class="sf-h">Summary for the note / discharge handoff</h3><textarea class="sf-summary" rows="12" readonly>' + esc(summaryText(ctx, A, al, tl, post, prog, wk)) +
      '</textarea><button type="button" class="sf-btn sf-copy">Copy summary</button> <span class="sf-copied" aria-live="polite"></span></section>');
    H.push('<p class="sf-disclaimer">Decision support only, from FHIR data and what you enter. Follow neurology and local stroke order sets. Rules are in stroke-criteria.js (sources listed there). Tested on made-up patients only.</p></div>');
    return H.join('');
  }

  function evaluate(ctx, ans) {
    const A = analyse(ctx, ans);
    A.autoPathway = analyse(ctx, Object.assign({}, ans, { pathway: '' })).pathway;
    const post = posterior(ctx, A, ans);
    const al = alerts(ctx, A, ans, post);
    const tl = timeline(ctx, A, ans);
    const prog = prognosis(ctx, A, ans);
    const wk = workup(ctx, A, ans);
    return { A, post, al, tl, prog, wk };
  }

  async function mount(container, client, opts) {
    opts = opts || {};
    const gen = (container.__sfGen || 0) + 1;
    container.__sfGen = gen;
    const current = () => container.__sfGen === gen;
    const now = opts.now || Date.now();
    const lookback = opts.lookbackDays || CONFIG.lookbackDays;
    const pid = (client && client.patient && client.patient.id) || opts.patientKey || 'demo';
    if (container.__sfPid !== pid) { container.__sfPid = pid; container.__sfAns = {}; }
    const ans = container.__sfAns;
    const status = {};
    const onProgress = (label, st, count, msg) => {
      status[label] = { st, count, msg };
      if (!current()) return;
      const icon = { loading: '…', done: '✓', failed: '✗' };
      container.innerHTML = '<div class="sf"><p class="sf-muted">Loading ' + lookback + ' days of the chart…</p><ul class="sf-progress">' + Object.keys(status).map(k => '<li><span>' + icon[status[k].st] + '</span>' + esc(k) +
        (status[k].st === 'done' && status[k].count != null ? ' (' + status[k].count + ')' : '') + (status[k].st === 'failed' ? ' — ' + esc(status[k].msg) : '') + '</li>').join('') + '</ul></div>';
    };
    container.innerHTML = '<div class="sf"><p class="sf-muted">Loading…</p></div>';
    const loader = opts.loader || ((f, t) => loadResources(client, { from: f, to: t, onProgress }));
    let res;
    try { res = await loader(now - lookback * DAY, now); }
    catch (e) { if (current()) container.innerHTML = '<div class="sf"><p class="sf-alert sf-a-red">Couldn’t load the data. ' + esc(shortError(e)) + '</p></div>'; throw e; }
    if (!current()) return null;
    const ctx = buildContext(res, { now });
    let last;
    const draw = () => {
      const y = typeof window !== 'undefined' ? window.scrollY : 0;
      last = evaluate(ctx, ans);
      container.innerHTML = render(ctx, last.A, ans, last);
      wire();
      if (typeof window !== 'undefined') window.scrollTo(0, y);
    };
    const wire = () => {
      container.querySelectorAll('[data-k]').forEach(el => {
        el.addEventListener('change', () => {
          const k = el.getAttribute('data-k');
          ans[k] = el.type === 'checkbox' ? (el.checked ? 'done' : '') : el.value;
          draw();
        });
      });
      const cb = container.querySelector('.sf-copy');
      if (cb) cb.addEventListener('click', async () => {
        const ta = container.querySelector('.sf-summary'), done = container.querySelector('.sf-copied');
        try { await navigator.clipboard.writeText(ta.value); done.textContent = 'Copied.'; } catch (e) { ta.removeAttribute('readonly'); ta.select(); ta.setAttribute('readonly', ''); done.textContent = 'Press Ctrl+C to copy.'; }
      });
      const rb = container.querySelector('.sf-retry');
      if (rb) rb.addEventListener('click', () => { mount(container, client, Object.assign({}, opts, { now: undefined })).catch(() => {}); });
    };
    draw();
    return { ctx, result: last };
  }

  return { CONFIG, mount, loadResources, buildContext, evaluate, analyse, hintsResult, summaryText, kindOf, classesOf };
});
