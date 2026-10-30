/* "Antibiotic history" card: every antimicrobial ordered or given, with a look-back picker.
   summarize(data, since, now) is pure (testable). render() asks a loader for the data
   whenever the look-back changes and caches it per patient. */
(function (root) {
  'use strict';
  const R = root.ABX_RULES || (typeof require !== 'undefined' ? require('./abx-rules.js') : null);
  const DAY = 24 * 3600 * 1000;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ccText = (cc) => (cc && (cc.text || ((cc.coding || []).find((c) => c.display) || {}).display)) || '';
  const toTime = (s) => { const t = s ? Date.parse(s) : NaN; return isNaN(t) ? null : t; };

  const LOOKBACK = [
    { v: 'visit', label: 'This visit' }, { v: 30, label: 'Last 30 days' }, { v: 90, label: 'Last 3 months' },
    { v: 180, label: 'Last 6 months' }, { v: 365, label: 'Last 12 months' }, { v: 730, label: 'Last 2 years' }, { v: 3650, label: 'Everything (10 years)' }
  ];

  // Antibiotic class, for the "exposure by class" line (matters for resistance risk)
  const CLASS = {
    amoxclav: 'Penicillins', piptazo: 'Penicillins', ampsulb: 'Penicillins', ampicillin: 'Penicillins', amoxicillin: 'Penicillins', cloxacillin: 'Penicillins', penicillin: 'Penicillins',
    cefazolin: 'Cephalosporins', cephalexin: 'Cephalosporins', cefuroxime: 'Cephalosporins', ceftriaxone: 'Cephalosporins', cefotaxime: 'Cephalosporins', ceftazidime: 'Cephalosporins', cefepime: 'Cephalosporins', cefixime: 'Cephalosporins',
    meropenem: 'Carbapenems', ertapenem: 'Carbapenems', imipenem: 'Carbapenems',
    vancomycin: 'Glycopeptides / anti-MRSA', vancopo: 'Glycopeptides / anti-MRSA', daptomycin: 'Glycopeptides / anti-MRSA', linezolid: 'Glycopeptides / anti-MRSA',
    gentamicin: 'Aminoglycosides', tobramycin: 'Aminoglycosides', amikacin: 'Aminoglycosides',
    ciprofloxacin: 'Fluoroquinolones', levofloxacin: 'Fluoroquinolones', moxifloxacin: 'Fluoroquinolones',
    azithromycin: 'Macrolides', clarithromycin: 'Macrolides', erythromycin: 'Macrolides',
    doxycycline: 'Tetracyclines', tmpsmx: 'TMP-SMX', nitrofurantoin: 'Urinary agents', fosfomycin: 'Urinary agents',
    metronidazole: 'Metronidazole', clindamycin: 'Clindamycin', rifampin: 'Rifamycins',
    fluconazole: 'Antifungals', echinocandin: 'Antifungals', acyclovir: 'Antivirals', valacyclovir: 'Antivirals'
  };

  function drugOf(name) { return name ? R.drugs.find((d) => d.match.test(name)) || null : null; }
  function routeOf(text) {
    const s = (text || '').toLowerCase();
    if (/intraven|\biv\b|ivpb|infusion|injection|\bim\b|intramusc|subcut/.test(s)) return 'IV';
    if (/oral|\bpo\b|by mouth|tablet|capsule|\bng\b|nasogastric|\bpeg\b|tube|enteral/.test(s)) return 'PO';
    if (/topical|ophth|otic|inhal|neb|vaginal|rectal|\bpr\b/.test(s)) return 'other';
    return '';
  }
  function nameOf(r, names) {
    if (r.medicationCodeableConcept) return ccText(r.medicationCodeableConcept);
    const ref = r.medicationReference || {};
    return ref.display || (names && names[ref.reference]) || '';
  }

  // Pure: resources in → one row per drug + route
  function summarize(data, since, now, visitStart) {
    const names = data.medNames || {}, rows = {};
    const row = (drug, route, name) => {
      const key = drug.key + '|' + route;
      return rows[key] || (rows[key] = { key, label: drug.label, cls: CLASS[drug.key] || 'Other', route, names: new Set(), first: null, last: null,
        doses: 0, days: new Set(), orders: 0, statuses: new Set(), lastDose: '', ongoing: false });
    };
    const span = (r, t) => { if (t == null) return; r.first = r.first == null ? t : Math.min(r.first, t); r.last = r.last == null ? t : Math.max(r.last, t); };

    (data.medAdmins || []).forEach((a) => {
      if (!a || a.resourceType !== 'MedicationAdministration' || !['completed', 'in-progress'].includes(a.status)) return;
      const t = toTime(a.effectiveDateTime || (a.effectivePeriod && a.effectivePeriod.start));
      if (t == null || t < since || t > now) return;
      const name = nameOf(a, names), drug = drugOf(name); if (!drug) return;
      const d = a.dosage || {}, route = routeOf(ccText(d.route) || d.text || name);
      if (route === 'other') return;                                  // skip eye drops, creams, etc.
      const r = row(drug, route, name);
      r.names.add(name); r.doses++; r.days.add(new Date(t).toDateString()); span(r, t);
      if (t >= (r._lastT || 0)) { r._lastT = t; r.lastDose = d.text || (d.dose ? d.dose.value + ' ' + (d.dose.unit || '') : ''); }
    });
    (data.medRequests || []).forEach((m) => {
      if (!m || m.resourceType !== 'MedicationRequest' || ['entered-in-error', 'draft'].includes(m.status)) return;
      const di = (m.dosageInstruction || [])[0] || {};
      const bp = (di.timing && di.timing.repeat && di.timing.repeat.boundsPeriod) || {};
      const start = toTime(bp.start || m.authoredOn), end = toTime(bp.end);
      const active = m.status === 'active';
      if (start == null || (start < since && !(active || (end != null && end >= since))) || start > now) return;
      const name = nameOf(m, names), drug = drugOf(name); if (!drug) return;
      const route = routeOf(ccText(di.route) || di.text || name);
      if (route === 'other') return;
      const r = row(drug, route, name);
      r.names.add(name); r.orders++; r.statuses.add(m.status);
      if (active) r.ongoing = true;
      if (!r.doses) { span(r, Math.max(start, since)); span(r, active ? now : (end != null ? Math.min(end, now) : start)); }
      if (!r.lastDose && di.text) r.lastDose = di.text;
    });

    const list = Object.values(rows).sort((a, b) => (b.ongoing - a.ongoing) || ((b.last || 0) - (a.last || 0)));
    list.forEach((r) => {
      r.daysCount = r.days.size || (r.first != null ? Math.max(1, Math.round((r.last - r.first) / DAY) + (r.ongoing ? 1 : 0)) : null);
      r.estimated = !r.days.size;
      r.thisVisit = visitStart != null && r.last != null && r.last >= visitStart;
      delete r._lastT;
    });
    // exposure by class, most recent first
    const byClass = {};
    list.forEach((r) => { const c = byClass[r.cls]; if (!c || (r.last || 0) > c.last) byClass[r.cls] = { cls: r.cls, last: r.last || 0, ongoing: r.ongoing || (c && c.ongoing) }; else if (r.ongoing) c.ongoing = true; });
    return { rows: list, classes: Object.values(byClass).sort((a, b) => b.last - a.last), since, now };
  }

  const fmtD = (t) => t == null ? '' : new Date(t).toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });
  function ago(t, now) {
    const d = Math.round((now - t) / DAY);
    if (d < 1) return 'today'; if (d < 14) return d + ' d ago'; if (d < 60) return Math.round(d / 7) + ' wk ago';
    if (d < 730) return Math.round(d / 30.4) + ' mo ago'; return (d / 365).toFixed(1) + ' y ago';
  }

  const cache = {};   // per patient: { choice, results: { [choice]: summary } }
  function render(el, loader, ctx) {
    ctx = ctx || {};
    const pid = ctx.patientId || 'demo';
    const st = cache[pid] || (cache[pid] = { choice: null, results: {} });
    if (st.choice == null) { try { st.choice = localStorage.getItem('abx-hist-lookback') || '90'; } catch (e) { st.choice = '90'; } }
    const head = root.ABXIcons ? root.ABXIcons.head('history', 'Antibiotic history', 'everything ordered or given') : '<h3>Antibiotic history</h3>';

    const draw = (body) => {
      el.innerHTML = head + `<div class="ab-hist-bar"><label>Look back
        <select id="ab-hist-sel">${LOOKBACK.map((o) => `<option value="${o.v}"${String(o.v) === st.choice ? ' selected' : ''}>${esc(o.label)}</option>`).join('')}</select></label>
        <span class="ab-hist-hint">${st.choice === 'visit' ? 'Current admission only' : 'Includes earlier visits and outpatient prescriptions on file'}</span></div>` + body;
      el.querySelector('#ab-hist-sel').onchange = (e) => { st.choice = e.target.value; try { localStorage.setItem('abx-hist-lookback', st.choice); } catch (x) { /* no storage */ } go(); };
    };
    const table = (s) => {
      if (!s.rows.length) return '<p class="op-none">No antimicrobials found in this period.</p>';
      const now = s.now;
      return `<div class="ab-classes">${s.classes.map((c) => `<span class="ab-cls${c.ongoing ? ' on' : ''}">${esc(c.cls)} · ${c.ongoing ? 'current' : esc(ago(c.last, now))}</span>`).join('')}</div>
        <div class="ab-scroll"><table class="ab-hist">
        <thead><tr><th>Antimicrobial</th><th>Route</th><th>Class</th><th>From</th><th>To</th><th>Days</th><th>Doses</th><th>Status</th></tr></thead>
        <tbody>${s.rows.map((r) => `<tr class="${r.ongoing ? 'on' : ''}">
          <td><b>${esc(r.label)}</b>${r.lastDose ? `<br><small>${esc(r.lastDose)}</small>` : ''}</td>
          <td>${r.route ? `<span class="ab-dot ${r.route === 'PO' ? 'po' : 'iv'}">${esc(r.route)}</span>` : ''}</td>
          <td><small>${esc(r.cls)}</small></td>
          <td>${esc(fmtD(r.first))}</td>
          <td>${r.ongoing ? '<b>ongoing</b>' : esc(fmtD(r.last))}<br><small>${r.ongoing ? '' : esc(ago(r.last, now))}</small></td>
          <td>${r.daysCount != null ? r.daysCount + (r.estimated ? '<small title="estimated from order dates"> est.</small>' : '') : ''}</td>
          <td>${r.doses || '<small>no MAR</small>'}</td>
          <td><small>${r.ongoing ? 'active' : esc([...r.statuses].join(', ') || 'given')}${r.thisVisit ? ' · this visit' : ''}</small></td></tr>`).join('')}</tbody></table></div>
        <p class="ab-fine">Days = days with at least one dose charted (MAR). “est.” = no doses on file, estimated from order dates (typical for outpatient prescriptions - may not have been taken). Topical / eye / inhaled forms are left out.</p>`;
    };
    const go = async () => {
      const choice = st.choice;
      if (st.results[choice]) return draw(table(st.results[choice]));
      draw('<p class="op-none">Searching…</p>');
      try {
        const now = ctx.now || Date.now();
        const since = choice === 'visit' ? (ctx.visitStart || now - 14 * DAY) : now - Number(choice) * DAY;
        const data = await loader(choice === 'visit' ? Math.ceil((now - since) / DAY) + 1 : Number(choice));
        st.results[choice] = summarize(data, since, now, ctx.visitStart);
        if (st.choice === choice) draw(table(st.results[choice]));
      } catch (e) {
        if (st.choice === choice) draw(`<div class="banner banner-error">Couldn’t search: ${esc(e && e.message ? e.message : e)}</div>`);
      }
    };
    go();
  }

  const ABXHistory = { summarize, render, LOOKBACK, CLASS };
  if (typeof module !== 'undefined' && module.exports) module.exports = ABXHistory; else root.ABXHistory = ABXHistory;
})(typeof window !== 'undefined' ? window : globalThis);
