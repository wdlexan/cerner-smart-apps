/* Antibiotic review tab - phase 1.
   DRAFT for sandbox testing. Rules (durations, renal bands, oral options) live in abx-rules.js.

     load(client)   - FHIR searches
     assess(data)   - pure: resources in, review out (no FHIR calls; testable in node)
     render(el,res) - draws the tab
   Phase 2 (not here yet): culture / susceptibility matching. */
(function (root) {
  'use strict';
  const R = root.ABX_RULES || (typeof require !== 'undefined' ? require('./abx-rules.js') : null);
  const HOUR = 3600 * 1000, DAY = 24 * HOUR;

  const CONFIG = { fallbackDays: 14, gridDays: 14, labDays: 7, maxParallel: 3, searchMs: 25000 };
  const L = {
    temp: ['8310-5', '8331-1', '8332-9', '8333-7'], hr: ['8867-4'], sbp: ['8480-6'], bpPanel: ['85354-9', '55284-4'],
    crp: ['1988-5', '30522-7', '76485-2'], wbc: ['6690-2', '26464-8', '33256-9'], creat: ['2160-0', '14682-9', '38483-4', '59826-8'],
    weight: ['29463-7', '3141-9'], height: ['8302-2', '3137-7']
  };

  // ---------- small helpers ----------
  const ccText = (cc) => (cc && (cc.text || ((cc.coding || []).find((c) => c.display) || {}).display)) || '';
  const hasCode = (o, list) => ((o.code && o.code.coding) || []).some((c) => list.includes(c.code));
  const toTime = (s) => { const t = s ? Date.parse(s) : NaN; return isNaN(t) ? null : t; };
  const dayKey = (t) => { const d = new Date(t); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  const startOfDay = (t) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
  const round = (n, d) => { const f = Math.pow(10, d || 0); return Math.round(n * f) / f; };
  const fhirDate = (t) => new Date(t).toISOString();

  function drugOf(name) {
    if (!name) return null;
    return R.drugs.find((d) => d.match.test(name)) || null;
  }
  function routeKind(text) {
    const s = (text || '').toLowerCase();
    if (/intraven|\biv\b|ivpb|infusion|injection|parenteral|\bim\b|intramusc|subcut/.test(s)) return 'IV';
    if (/oral|\bpo\b|by mouth|tablet|capsule|\bng\b|nasogastric|\bpeg\b|\bg-?tube|enteral|feeding tube/.test(s)) return 'PO';
    return s ? 'other' : '';
  }
  function medName(r, names) {
    if (r.medicationCodeableConcept) return ccText(r.medicationCodeableConcept);
    const ref = r.medicationReference || {};
    return ref.display || (names && names[ref.reference]) || '';
  }
  function obsValue(o) {
    if (o.valueQuantity && o.valueQuantity.value != null) return { v: +o.valueQuantity.value, unit: o.valueQuantity.unit || o.valueQuantity.code || '' };
    if (o.valueString != null) { const m = String(o.valueString).match(/-?\d+(\.\d+)?/); return m ? { v: +m[0], unit: '' } : null; }
    return null;
  }
  function obsTime(o) { return toTime(o.effectiveDateTime || (o.effectivePeriod && o.effectivePeriod.start) || o.issued); }
  function series(list, codes) {
    const out = [];
    (list || []).forEach((o) => {
      if (!o || o.resourceType !== 'Observation' || ['entered-in-error', 'cancelled'].includes(o.status)) return;
      const t = obsTime(o); if (t == null) return;
      if (hasCode(o, codes)) { const v = obsValue(o); if (v) out.push({ t, v: v.v, unit: v.unit }); }
      (o.component || []).forEach((c) => {           // BP panels keep systolic as a component
        if (hasCode(c, codes) && c.valueQuantity && c.valueQuantity.value != null) out.push({ t, v: +c.valueQuantity.value, unit: c.valueQuantity.unit || '' });
      });
    });
    return out.sort((a, b) => a.t - b.t);
  }
  function tempC(p) { return /f/i.test(p.unit) && !/cel/i.test(p.unit) ? (p.v - 32) * 5 / 9 : (p.v > 50 ? (p.v - 32) * 5 / 9 : p.v); }
  function creatMgDl(p) { return /mol/i.test(p.unit) || p.v > 20 ? p.v / 88.4 : p.v; }
  function ageOf(p, now) {
    if (!p || !p.birthDate) return null;
    const b = new Date(p.birthDate), d = new Date(now); let a = d.getFullYear() - b.getFullYear();
    if (d < new Date(d.getFullYear(), b.getMonth(), b.getDate())) a--; return a;
  }
  function ckdEpi2021(scr, age, sex) {
    if (!scr || age == null) return null;
    const f = sex === 'female', k = f ? 0.7 : 0.9, a = f ? -0.241 : -0.302;
    return 142 * Math.pow(Math.min(scr / k, 1), a) * Math.pow(Math.max(scr / k, 1), -1.2) * Math.pow(0.9938, age) * (f ? 1.012 : 1);
  }
  function cockcroftGault(scr, age, sex, kg) {
    if (!scr || age == null || !kg) return null;
    return ((140 - age) * kg * (sex === 'female' ? 0.85 : 1)) / (72 * scr);
  }
  function doseText(d) {
    if (!d) return '';
    if (d.text) return d.text;
    const q = d.dose || (d.doseAndRate && d.doseAndRate[0] && d.doseAndRate[0].doseQuantity);
    return q ? (q.value + ' ' + (q.unit || q.code || '')).trim() : '';
  }

  // ---------- loading ----------
  function withTimeout(p, ms, label) {
    let t; return Promise.race([p, new Promise((_, rej) => { t = setTimeout(() => rej(new Error(label + ' timed out')), ms); })]).finally(() => clearTimeout(t));
  }
  function throttled(client) {
    let active = 0; const q = [];
    const next = () => { while (active < CONFIG.maxParallel && q.length) { const j = q.shift(); active++; Promise.resolve().then(j.fn).then(j.resolve, j.reject).finally(() => { active--; next(); }); } };
    return { patient: client.patient, request: (...a) => new Promise((resolve, reject) => { q.push({ fn: () => client.request(...a), resolve, reject }); next(); }) };
  }
  async function search(client, url, pages) {
    const r = await withTimeout(client.request(url, { pageLimit: pages || 3, flat: true }), CONFIG.searchMs, 'Search');
    return Array.isArray(r) ? r : (r && r.entry ? r.entry.map((e) => e.resource) : []);
  }
  async function firstWorking(client, urls, pages) {
    let last; for (const u of urls) { try { return await search(client, u, pages); } catch (e) { last = e; } } throw last;
  }

  async function load(rawClient, opts) {
    const client = throttled(rawClient), pid = client.patient.id;
    const now = (opts && opts.now) || Date.now();
    const out = { now, patient: null, encounters: [], medRequests: [], medAdmins: null, vitals: [], labs: [], body: [], conditions: [], reports: [], procedures: [], failed: [] };
    const run = async (label, key, fn, fb) => { try { out[key] = await fn(); } catch (e) { console.warn('[abx] ' + label, e); out.failed.push(label); out[key] = fb; } };
    await Promise.all([
      run('Patient', 'patient', () => client.patient.read(), null),
      run('Current visit', 'encounters', () => firstWorking(client, [
        'Encounter?patient=' + pid + '&status=in-progress&_count=10', 'Encounter?patient=' + pid + '&_count=10'], 1), []),
      run('Medication orders', 'medRequests', () => search(client, 'MedicationRequest?patient=' + pid + '&_count=100', 5), []),
      run('Problem list', 'conditions', () => firstWorking(client, [
        'Condition?patient=' + pid + '&category=problem-list-item', 'Condition?patient=' + pid], 2), [])
    ]);
    const enc = currentEncounter(out.encounters, now);
    const since = Math.min(enc ? enc.start : now - CONFIG.fallbackDays * DAY, now - CONFIG.labDays * DAY);
    const ge = fhirDate(Math.max(since, now - 60 * DAY));
    await Promise.all([
      run('Medication administrations', 'medAdmins', () => search(client, 'MedicationAdministration?patient=' + pid + '&effective-time=ge' + ge + '&_count=100', 10), null),
      run('Vital signs', 'vitals', () => search(client, 'Observation?patient=' + pid + '&category=vital-signs&date=ge' + fhirDate(now - 3 * DAY) + '&_count=100', 10), []),
      run('Labs', 'labs', () => firstWorking(client, [
        'Observation?patient=' + pid + '&code=' + L.wbc.concat(L.creat, L.crp).map((c) => 'http://loinc.org|' + c).join(',') + '&date=ge' + ge + '&_count=100',
        'Observation?patient=' + pid + '&category=laboratory&date=ge' + ge + '&_count=100'], 5), []),
      run('Reports (echo)', 'reports', () => search(client, 'DiagnosticReport?patient=' + pid + '&date=ge' + ge + '&_count=50', 2), []),
      run('Procedures (echo)', 'procedures', () => search(client, 'Procedure?patient=' + pid + '&date=ge' + ge + '&_count=50', 2), []),
      run('Height / weight', 'body', () => search(client, 'Observation?patient=' + pid + '&code=' + L.weight.concat(L.height).map((c) => 'http://loinc.org|' + c).join(',') + '&_count=20', 1), [])
    ]);
    const refs = new Set();
    [...out.medRequests, ...(out.medAdmins || [])].forEach((r) => { const ref = r && r.medicationReference; if (ref && ref.reference && !ref.display && !ref.reference.startsWith('#')) refs.add(ref.reference); });
    out.medNames = {};
    await Promise.all([...refs].slice(0, 40).map(async (ref) => { try { out.medNames[ref] = ccText((await client.request(ref)).code); } catch (e) { /* unnamed */ } }));
    return out;
  }

  function currentEncounter(encs, now) {
    const list = (encs || []).filter((e) => e && e.resourceType === 'Encounter' && e.period && e.period.start)
      .map((e) => ({ e, start: toTime(e.period.start), end: toTime(e.period.end) }))
      .filter((x) => x.start != null && x.start <= now && (x.end == null || x.end >= now - DAY));
    list.sort((a, b) => b.start - a.start);
    return list[0] || null;
  }

  // ---------- assessment (pure) ----------
  function assess(data) {
    const now = data.now || Date.now();
    const names = data.medNames || {};
    const enc = currentEncounter(data.encounters, now);
    const windowStart = enc ? enc.start : now - CONFIG.fallbackDays * DAY;
    const flags = [], notes = [];
    const add = (level, text) => flags.push({ level, text });

    // Orders
    const orders = (data.medRequests || []).filter((r) => r && r.resourceType === 'MedicationRequest' && !['entered-in-error', 'draft'].includes(r.status))
      .map((r) => {
        const name = medName(r, names), drug = drugOf(name), di = (r.dosageInstruction || [])[0] || {};
        const route = routeKind(ccText(di.route) || di.text || name);
        const start = toTime((di.timing && di.timing.repeat && di.timing.repeat.boundsPeriod && di.timing.repeat.boundsPeriod.start) || r.authoredOn);
        const end = toTime(di.timing && di.timing.repeat && di.timing.repeat.boundsPeriod && di.timing.repeat.boundsPeriod.end);
        return { r, name, drug, route, dose: doseText(di), start, end, active: r.status === 'active' };
      }).filter((o) => o.drug);
    const otherOral = (data.medRequests || []).some((r) => r && r.status === 'active' && routeKind(ccText(((r.dosageInstruction || [])[0] || {}).route) + ' ' + (((r.dosageInstruction || [])[0] || {}).text || '')) === 'PO');

    // Administrations (the MAR) - the most accurate source for day counts
    const admins = (data.medAdmins || []).filter((a) => a && a.resourceType === 'MedicationAdministration' && ['completed', 'in-progress'].includes(a.status))
      .map((a) => {
        const name = medName(a, names), drug = drugOf(name), d = a.dosage || {};
        return { t: toTime(a.effectiveDateTime || (a.effectivePeriod && a.effectivePeriod.start)), name, drug, route: routeKind(ccText(d.route) || d.text || name), dose: doseText(d) };
      }).filter((a) => a.drug && a.t != null && a.t >= windowStart - DAY && a.t <= now);
    // Oral vancomycin is a C. difficile treatment, not systemic - label it separately
    const fixVanco = (x) => { if (x.drug.key === 'vancomycin' && x.route === 'PO') x.drug = Object.assign({}, x.drug, { key: 'vancopo', label: 'Vancomycin (oral)', renal: [], levels: null, mrsa: false, oral: null }); };
    admins.forEach(fixVanco); orders.forEach(fixVanco);

    const fromMar = admins.length > 0;
    if (!fromMar) notes.push(data.medAdmins == null ? 'Couldn’t read the medication administration record (MAR); days are estimated from order start dates.' : 'No antimicrobial doses found on the MAR this visit; days are estimated from order start dates.');

    // Courses by drug
    const courses = {};
    const course = (drug) => courses[drug.key] || (courses[drug.key] = { key: drug.key, label: drug.label, drug, routes: new Set(), days: new Set(), doses: 0, first: null, last: null, lastDose: '', active: false, order: null });
    if (fromMar) {
      admins.sort((a, b) => a.t - b.t).forEach((a) => {
        const c = course(a.drug); c.routes.add(a.route || '?'); c.days.add(dayKey(a.t)); c.doses++;
        c.first = c.first == null ? a.t : Math.min(c.first, a.t); c.last = Math.max(c.last || 0, a.t); c.lastDose = a.dose; c.lastRoute = a.route;
      });
    }
    orders.forEach((o) => {
      if (!o.active && !(fromMar && courses[o.drug.key])) return;
      const c = course(o.drug);
      if (o.active) { c.active = true; c.order = o; if (o.route) c.routes.add(o.route); c.orderRoute = o.route; }
      if (!fromMar && o.start != null) {           // estimate: every day from order start to today (or end)
        const s = Math.max(o.start, windowStart), e = Math.min(o.end || now, now);
        for (let t = startOfDay(s); t <= e; t += DAY) c.days.add(dayKey(t));
        c.first = c.first == null ? s : Math.min(c.first, s); c.last = Math.max(c.last || 0, e);
      }
    });
    const list = Object.values(courses).sort((a, b) => (b.active - a.active) || ((a.first || 0) - (b.first || 0)));
    list.forEach((c) => { c.route = c.orderRoute || c.lastRoute || [...c.routes][0] || ''; c.hours = c.first != null ? (Math.min(c.last || now, now) - c.first) / HOUR : null; c.activeHours = c.first != null ? (now - c.first) / HOUR : null; });

    const active = list.filter((c) => c.active);
    const allDays = new Set(); list.forEach((c) => c.days.forEach((d) => allDays.add(d)));
    const firstT = list.reduce((m, c) => (c.first != null && (m == null || c.first < m) ? c.first : m), null);
    const abxDay = firstT != null ? Math.round((startOfDay(now) - startOfDay(firstT)) / DAY) + 1 : null;
    const dot = list.reduce((s, c) => s + c.days.size, 0);

    // Vitals & labs
    const temps = series(data.vitals, L.temp).map((p) => ({ t: p.t, v: tempC(p) }));
    const hrs = series(data.vitals, L.hr), sbps = series(data.vitals, L.sbp);
    const wbc = series(data.labs, L.wbc), creat = series(data.labs, L.creat).map((p) => ({ t: p.t, v: creatMgDl(p), raw: p }));
    const weight = series(data.body, L.weight).pop();

    // ---- renal ----
    const pt = data.patient || {}, age = ageOf(pt, now), sex = pt.gender;
    const lastCr = creat[creat.length - 1];
    const renal = { items: [] };
    if (lastCr) {
      const kg = weight ? (/lb/i.test(weight.unit) ? weight.v * 0.4536 : weight.v) : null;
      renal.scr = lastCr; renal.kg = kg;
      renal.crcl = cockcroftGault(lastCr.v, age, sex, kg);
      renal.egfr = ckdEpi2021(lastCr.v, age, sex);
      renal.use = renal.crcl != null ? renal.crcl : renal.egfr;
      renal.useLabel = renal.crcl != null ? 'CrCl (Cockcroft-Gault, actual weight)' : 'eGFR (CKD-EPI 2021, used as CrCl estimate - no weight found)';
      const prev = creat.filter((p) => p.t < lastCr.t && p.t >= lastCr.t - 48 * HOUR);
      const base = creat.length ? Math.min(...creat.map((p) => p.v)) : null;
      if (prev.length && lastCr.v - Math.min(...prev.map((p) => p.v)) >= 0.3) renal.aki = 'Creatinine up ≥ 26 µmol/L in 48 h (possible AKI)';
      else if (base && lastCr.v >= 1.5 * base) renal.aki = 'Creatinine ≥ 1.5× lowest this visit (possible AKI)';
      if (renal.aki) add('amber', renal.aki + ' - recheck antimicrobial doses.');
    } else notes.push('No creatinine found - renal dosing can’t be checked.');
    active.forEach((c) => {
      const d = c.drug, item = { label: c.label, dose: c.order ? c.order.dose : c.lastDose, level: 'ok', text: '' };
      if (d.renal === null) { item.level = 'info'; item.text = d.levels; }
      else if (!d.renal || !d.renal.length) item.text = 'No renal adjustment.';
      else if (renal.use == null) { item.level = 'info'; item.text = 'Needs adjustment below CrCl ' + Math.max(...d.renal.map((b) => b.below)) + ' - no kidney function available.'; }
      else {
        const band = d.renal.slice().sort((a, b) => a.below - b.below).find((b) => renal.use < b.below);
        if (band) { item.level = 'amber'; item.text = band.text; add('amber', c.label + ': ' + round(renal.use) + ' mL/min - check dose. ' + band.text); }
        else item.text = 'No adjustment at CrCl ' + round(renal.use) + '.';
      }
      if (d.warn) item.warn = d.warn;
      if (renal.aki && (d.renal === null || (d.renal && d.renal.length))) item.level = item.level === 'ok' ? 'amber' : item.level;
      renal.items.push(item);
    });

    // ---- combination / spectrum flags ----
    const anaer = active.filter((c) => c.drug.anaerobe);
    if (anaer.length > 1) add('amber', 'Double anaerobic coverage: ' + anaer.map((c) => c.label).join(' + ') + '.');
    const bl = active.filter((c) => c.drug.betaLactam);
    if (bl.length > 1) add('amber', 'Two β-lactams at once: ' + bl.map((c) => c.label).join(' + ') + '.');
    active.filter((c) => c.drug.mrsa && c.key !== 'vancopo').forEach((c) => {
      if (c.activeHours != null && c.activeHours >= R.flags.vancoReviewHours) add('amber', c.label + ' for ' + Math.floor(c.activeHours / 24) + ' days: was MRSA found? If not, consider stopping.');
    });
    active.filter((c) => c.drug.broad).forEach((c) => {
      if (c.activeHours != null && c.activeHours >= R.flags.broadReviewHours) add('amber', c.label + ' for ' + Math.floor(c.activeHours / 24) + ' days: cultures back? Consider narrowing.');
    });
    if (!list.length) notes.push('No antimicrobials found this visit.');
    else if (!active.length) notes.push('No active antimicrobial orders (all stopped).');

    // ---- IV → PO readiness (indication-independent part) ----
    const since = now - R.ivpo.hours * HOUR;
    const t24 = temps.filter((p) => p.t >= since), s24 = sbps.filter((p) => p.t >= since), hrLast = hrs[hrs.length - 1];
    const w = wbc.slice(-2);
    const ivActive = active.filter((c) => c.route === 'IV');
    const crit = [
      { key: 'afebrile', text: 'Afebrile ' + R.ivpo.hours + ' h (all temps < ' + R.ivpo.tempMax + ' °C)',
        ok: t24.length ? t24.every((p) => p.v < R.ivpo.tempMax) : null,
        detail: t24.length ? 'Tmax ' + round(Math.max(...t24.map((p) => p.v)), 1) + ' °C' : 'no temps charted' },
      { key: 'hr', text: 'Heart rate < ' + R.ivpo.hrMax, ok: hrLast ? hrLast.v < R.ivpo.hrMax : null, detail: hrLast ? 'last ' + round(hrLast.v) : 'no HR charted' },
      { key: 'sbp', text: 'Systolic BP ≥ ' + R.ivpo.sbpMin + ' (' + R.ivpo.hours + ' h)', ok: s24.length ? s24.every((p) => p.v >= R.ivpo.sbpMin) : null,
        detail: s24.length ? 'lowest ' + round(Math.min(...s24.map((p) => p.v))) : 'no BP charted' },
      { key: 'wbc', text: 'WBC normal or falling', ok: w.length ? (w[w.length - 1].v <= R.ivpo.wbcMax || (w.length === 2 && w[1].v < w[0].v)) : null,
        detail: w.length ? w.map((p) => round(p.v, 1)).join(' → ') : 'no WBC' },
      { key: 'oral', text: 'Taking oral medications (gut working)', ok: otherOral ? true : null, detail: otherOral ? 'has active oral orders' : 'no active oral orders found - check' }
    ];
    const ivpo = { applies: ivActive.length > 0, ivDrugs: ivActive, crit,
      options: ivActive.map((c) => ({ label: c.label, text: c.drug.sameOral ? 'Same drug orally (high oral bioavailability).' : (c.drug.oral || 'Per cultures / ID.') })) };

    // ---- grid: last N days ----
    const gridFrom = Math.min(firstT != null ? firstT : now, enc ? enc.start : now);
    const gridStart = Math.max(startOfDay(gridFrom), startOfDay(now) - (CONFIG.gridDays - 1) * DAY);
    const cols = []; for (let t = gridStart; t <= now; t += DAY) cols.push(dayKey(t));
    const perDay = (s, fn) => { const m = {}; s.forEach((p) => { const k = dayKey(p.t); m[k] = m[k] == null ? p.v : fn(m[k], p.v); }); return m; };
    const grid = { cols, tmax: perDay(temps, Math.max), wbc: perDay(wbc, (a, b) => b), creat: perDay(creat.map((p) => ({ t: p.t, v: p.v * 88.4 })), (a, b) => b),
      dayNo: (k) => firstT != null ? Math.round((startOfDay(Date.parse(k + 'T12:00:00')) - startOfDay(firstT)) / DAY) + 1 : null };

    // ---- indication suggestion from problem list ----
    const probText = (data.conditions || []).filter((c) => c && c.resourceType === 'Condition').map((c) => ccText(c.code)).join(' | ');
    const sug = R.suggest.find((s) => s.re.test(probText));

    if (data.failed && data.failed.length) notes.push('Couldn’t load: ' + data.failed.join(', ') + '.');
    // ---- context for the "Echo needed?" card ----
    const crpS = series(data.labs, L.crp).filter((p) => p.t >= windowStart - 2 * DAY);
    const echoes = [];
    (data.reports || []).concat(data.procedures || []).forEach((r) => {
      if (!r || !['DiagnosticReport', 'Procedure'].includes(r.resourceType) || ['entered-in-error', 'cancelled', 'not-done'].includes(r.status)) return;
      const text = ccText(r.code); if (!R.echoTextRe.test(text)) return;
      const t = toTime(r.effectiveDateTime || (r.effectivePeriod && r.effectivePeriod.start) || r.performedDateTime || (r.performedPeriod && r.performedPeriod.start) || r.issued);
      if (t != null && t >= windowStart - DAY) echoes.push({ t, text });
    });
    const orgSug = /aureus|mssa|mrsa/i.test(probText) ? 'sa' : /candid/i.test(probText) ? 'candida' : /faecalis/i.test(probText) ? 'efaecalis' : '';
    const echoCtx = { probText, crp: crpS.length ? crpS.reduce((m, p) => (p.v > m.v ? p : m)) : null, echoes: echoes.sort((a, b) => a.t - b.t), suggestedOrg: orgSug };

    return { echoCtx, now, enc, fromMar, courses: list, active, abxDay, dot, firstT, renal, ivpo, grid, flags, notes, suggestedIndication: sug ? sug.key : '', age, sex, probText };
  }

  // Duration + indication-dependent IV→PO verdict (called on every indication change)
  function withIndication(res, indKey) {
    const ind = R.indications.find((i) => i.key === indKey) || R.indications[0];
    const out = { ind, flags: [] };
    if (ind.days && res.abxDay != null) {
      out.dayOf = res.abxDay; out.target = ind.days; out.left = ind.days - res.abxDay;
      if (res.active.length) {
        if (res.abxDay > ind.days) out.flags.push({ level: 'red', text: 'Day ' + res.abxDay + ' - past the ' + ind.days + '-day target for ' + ind.label.toLowerCase() + '. Review stop date.' });
        else if (res.abxDay === ind.days) out.flags.push({ level: 'amber', text: 'Day ' + res.abxDay + ' of ' + ind.days + ' - last planned day today? Set the stop date.' });
      }
    }
    if (res.ivpo.applies) {
      const fails = res.ivpo.crit.filter((c) => c.ok === false), unknown = res.ivpo.crit.filter((c) => c.ok == null);
      if (ind.mustIV) out.ivpo = { level: 'info', text: ind.label + ': usually stays IV. ' + (ind.key === 'ie' ? 'Check POET criteria in the Endocarditis tool.' : 'Discuss with ID before oral step-down.') };
      else if (fails.length) out.ivpo = { level: 'none', text: 'Not yet: ' + fails.map((c) => c.text).join('; ') + '.' };
      else if (unknown.length) out.ivpo = { level: 'amber', text: 'Possibly eligible - confirm: ' + unknown.map((c) => c.text).join('; ') + '.' };
      else out.ivpo = { level: 'green', text: 'Likely eligible for oral step-down.' };
      if (out.ivpo.level === 'green') out.flags.push({ level: 'amber', text: 'IV antibiotic but meets IV→PO criteria - consider oral step-down.' });
    }
    return out;
  }

  // ---------- rendering ----------
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmtDay = (k) => new Date(k + 'T12:00:00').toLocaleDateString([], { month: 'short', day: 'numeric' });
  const fmtT = (t) => new Date(t).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  function render(el, res, opts) {
    opts = opts || {};
    const key = 'abx-ind-' + (opts.patientId || 'demo');
    let chosen = null; try { chosen = localStorage.getItem(key); } catch (e) { /* no storage */ }
    if (chosen == null) chosen = res.suggestedIndication || '';

    const draw = () => {
      const wi = withIndication(res, chosen);
      const all = wi.flags.concat(res.flags);
      const worst = all.some((f) => f.level === 'red') ? 'red' : all.some((f) => f.level === 'amber') ? 'amber' : res.active.length ? 'green' : 'none';
      const headline = res.abxDay != null ? 'Antibiotic day ' + res.abxDay : 'No antimicrobials this visit';
      const sub = [res.active.length + ' active', res.dot ? res.dot + ' days of therapy (all drugs)' : '', res.fromMar ? 'from MAR' : 'estimated from orders'].filter(Boolean).join(' · ');

      el.innerHTML = `
      <div class="op-summary op-${worst}">
        <div class="op-tier">${esc(headline)}${wi.target ? ` <span class="ab-of">of ${wi.target}-day target</span>` : ''}</div>
        <div class="op-score">${esc(sub)}</div>
        ${all.length ? '<ul class="ab-flags">' + all.map((f) => `<li class="${f.level}">${esc(f.text)}</li>`).join('') + '</ul>' : (res.active.length ? '<p class="op-none">No flags.</p>' : '')}
      </div>

      <div class="op-card op-wide">
        <h3>Antimicrobials by day</h3>
        ${gridHtml(res)}
      </div>

      <div class="op-grid">
        <div class="op-card">
          <h3>Duration</h3>
          <label class="ab-lbl">Indication
            <select id="ab-ind">${R.indications.map((i) => `<option value="${i.key}"${i.key === chosen ? ' selected' : ''}>${esc(i.label)}</option>`).join('')}</select>
          </label>
          ${res.suggestedIndication && chosen === res.suggestedIndication ? '<p class="ab-hint">Suggested from the problem list - change if wrong.</p>' : ''}
          ${wi.ind.key ? `<p class="ab-note">${esc(wi.ind.note || '')}${wi.ind.ref ? ` <small>(${esc(wi.ind.ref)})</small>` : ''}</p>` : '<p class="op-none">Choose the indication to compare against a target duration.</p>'}
          ${wi.target && res.abxDay != null ? durationBar(res.abxDay, wi.target) : ''}
        </div>

        <div class="op-card">
          <h3>IV → PO</h3>
          ${res.ivpo.applies ? `
            <ul>${res.ivpo.crit.map((c) => `<li class="${c.ok === false ? 'red' : ''}"><span>${c.ok === true ? '✅' : c.ok === false ? '❌' : '❔'} ${esc(c.text)}</span><b>${esc(c.detail)}</b></li>`).join('')}
              ${wi.ind.mustIV ? `<li class="red"><span>❌ Indication needs IV (${esc(wi.ind.label)})</span><b></b></li>` : ''}</ul>
            <div class="ab-verdict ab-${wi.ivpo.level}">${esc(wi.ivpo.text)}</div>
            <div class="ab-opts">${res.ivpo.options.map((o) => `<div><b>${esc(o.label)} →</b> ${esc(o.text)}</div>`).join('')}</div>`
          : '<p class="op-none">No active IV antimicrobials.</p>'}
        </div>

        <div class="op-card">
          <h3>Renal dosing</h3>
          ${res.renal.scr ? `<p class="ab-note">Creatinine ${round(res.renal.scr.v * 88.4)} µmol/L (${esc(fmtT(res.renal.scr.t))})<br>
            ${res.renal.use != null ? `<b>${round(res.renal.use)} mL/min</b> - ${esc(res.renal.useLabel)}` : 'Age or sex missing - can’t calculate.'}
            ${res.renal.aki ? `<br><span class="ab-red">${esc(res.renal.aki)}</span>` : ''}</p>` : ''}
          ${res.renal.items.length ? '<ul>' + res.renal.items.map((i) => `<li class="${i.level === 'amber' ? 'red' : ''}"><span><b class="ab-drug">${esc(i.label)}</b>${i.dose ? ' <small>' + esc(i.dose) + '</small>' : ''}<br>${esc(i.text)}${i.warn ? `<br><small class="ab-warn">⚠ ${esc(i.warn)}</small>` : ''}</span></li>`).join('') + '</ul>' : '<p class="op-none">No active antimicrobials.</p>'}
        </div>
      </div>

      <div class="op-card op-wide" id="ab-echo"></div>

      <div class="op-notes">
        ${res.notes.map((n) => '<div>' + esc(n) + '</div>').join('')}
        <div>DRAFT - durations, dose bands and oral options are general defaults, not Island Health policy. Check with pharmacy / stewardship. Cultures and susceptibilities are not checked yet (phase 2).</div>
      </div>`;

      if (root.ABXEcho) root.ABXEcho.render(el.querySelector('#ab-echo'), res.echoCtx, opts.patientId);
      else el.querySelector('#ab-echo').remove();
      const sel = el.querySelector('#ab-ind');
      sel.onchange = () => { chosen = sel.value; try { localStorage.setItem(key, chosen); } catch (e) { /* no storage */ } draw(); };
    };
    draw();
  }

  function durationBar(day, target) {
    const max = Math.max(day, target) + 1, pct = (n) => (n / max * 100).toFixed(1) + '%';
    return `<div class="ab-bar"><div class="ab-fill ${day > target ? 'over' : ''}" style="width:${pct(Math.min(day, max))}"></div><div class="ab-tgt" style="left:${pct(target)}" title="target"></div></div>
      <div class="ab-barlbl"><span>Day ${day}</span><span>target ${target} d · ${day <= target ? (target - day) + ' left after today' : (day - target) + ' over'}</span></div>`;
  }

  function gridHtml(res) {
    const g = res.grid;
    if (!res.courses.length) return '<p class="op-none">No antimicrobials found this visit.</p>';
    const head = '<tr><th></th>' + g.cols.map((k) => `<th class="ab-c">${esc(fmtDay(k))}<br><small>${g.dayNo(k) > 0 ? 'D' + g.dayNo(k) : 'adm'}</small></th>`).join('') + '</tr>';
    const rows = res.courses.map((c) => `<tr><td class="ab-name">${esc(c.label)} <small>${esc(c.route)}</small>${c.active ? '' : ' <small class="ab-stop">stopped</small>'}</td>` +
      g.cols.map((k) => `<td class="ab-c">${c.days.has(k) ? '<span class="ab-dot ' + (c.route === 'PO' ? 'po' : 'iv') + '">' + (c.route === 'PO' ? 'PO' : 'IV') + '</span>' : ''}</td>`).join('') + '</tr>').join('');
    const lab = (label, m, fmt, bad) => `<tr class="ab-lab"><td class="ab-name">${label}</td>` + g.cols.map((k) => `<td class="ab-c${m[k] != null && bad(m[k]) ? ' ab-red' : ''}">${m[k] != null ? fmt(m[k]) : ''}</td>`).join('') + '</tr>';
    return `<div class="ab-scroll"><table class="ab-grid">${head}${rows}
      ${lab('Tmax °C', g.tmax, (v) => round(v, 1), (v) => v >= 38)}
      ${lab('WBC', g.wbc, (v) => round(v, 1), (v) => v > 12 || v < 4)}
      ${lab('Creat µmol/L', g.creat, (v) => round(v), () => false)}</table></div>`;
  }

  async function mount(el, client, opts) {
    opts = opts || {};
    el.innerHTML = '<p class="op-none">Loading antimicrobials, vitals and labs…</p>';
    const data = opts.loader ? await opts.loader() : await load(client, opts);
    if (opts.now) data.now = opts.now;
    const res = assess(data);
    render(el, res, { patientId: (data.patient && data.patient.id) || opts.patientId });
    return res;
  }

  const ABX = { CONFIG, load, assess, withIndication, render, mount, _test: { drugOf, routeKind, cockcroftGault, ckdEpi2021 } };
  if (typeof module !== 'undefined' && module.exports) module.exports = ABX; else root.ABX = ABX;
})(typeof window !== 'undefined' ? window : globalThis);
