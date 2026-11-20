/* Autoimmune Serology Interpreter — SMART on FHIR (Cerner) front end */
(function () {
  'use strict';
  const E = window.SeroEngine, DEMO = window.SeroDemo || [];
  const $ = s => document.querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const A = { S: {}, chartS: {}, F: {}, autoF: new Set(), ctx: { meds: [] }, pt: {}, mode: 'none', unmatched: [], noteEdited: false, consultEdited: false, client: null };

  // ---------- tabs ----------
  $('#nav').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    document.querySelectorAll('nav button').forEach(x => x.classList.toggle('on', x === b));
    document.querySelectorAll('.tab').forEach(x => x.classList.toggle('on', x.id === 'tab-' + b.dataset.t));
  });
  // ---------- collapsible sections (open/closed remembered in this browser) ----------
  let OPEN = {}; try { OPEN = JSON.parse(localStorage.getItem('sero-open') || '{}'); } catch (e) { OPEN = {}; }
  const isOpen = (k, def) => (k in OPEN ? OPEN[k] : def);
  const saveOpen = () => { try { localStorage.setItem('sero-open', JSON.stringify(OPEN)); } catch (e) { /* storage off */ } };
  const sec = (k, title, body, def = true) => `<details class="box sec" data-sec="${k}" ${isOpen(k, def) ? 'open' : ''}><summary><h3>${title}</h3></summary>${body}</details>`;
  document.addEventListener('toggle', e => { const d = e.target; if (d.dataset && d.dataset.sec) { OPEN[d.dataset.sec] = d.open; saveOpen(); } }, true);
  function setAll(open) {
    const tab = document.querySelector('.tab.on'); if (!tab) return;
    tab.querySelectorAll('details[data-sec]').forEach(d => { d.open = open; OPEN[d.dataset.sec] = open; });
    tab.querySelectorAll('tr.grp-row').forEach(tr => setGroup(tr, open));
    saveOpen();
  }
  function setGroup(tr, open) {
    tr.classList.toggle('shut', !open); OPEN['lab-' + tr.dataset.g] = open;
    tr.parentNode.querySelectorAll(`tr[data-grp="${tr.dataset.g}"]`).forEach(x => (x.hidden = !open));
  }
  document.getElementById('expAll').onclick = () => setAll(true);
  document.getElementById('colAll').onclick = () => setAll(false);
  const toast = msg => { const t = $('#toast'); t.textContent = msg; t.style.display = 'block'; setTimeout(() => (t.style.display = 'none'), 1800); };
  const copy = txt => (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(() => toast('Copied'), () => {
    const ta = document.createElement('textarea'); ta.value = txt; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); toast('Copied');
  });

  // ---------- FHIR loading ----------
  const ageFrom = dob => { if (!dob) return null; const d = new Date(dob), n = new Date(); let a = n.getFullYear() - d.getFullYear(); if (n < new Date(n.getFullYear(), d.getMonth(), d.getDate())) a--; return a; };
  const nameOf = p => { const n = (p.name || [])[0] || {}; return n.text || [(n.family || ''), (n.given || []).join(' ')].filter(Boolean).join(', '); };
  const mrnOf = p => { const id = (p.identifier || []).find(i => (i.type && ((i.type.coding || []).some(c => c.code === 'MR') || /MRN/i.test(i.type.text || '')))); return id ? id.value : ''; };

  async function loadFromFhir(client) {
    A.mode = 'fhir'; A.client = client;
    $('#pt').textContent = 'Loading chart…';
    const pid = client.patient.id;
    const pat = await client.patient.read();
    A.pt = { name: nameOf(pat), age: ageFrom(pat.birthDate), sex: pat.gender || '', mrn: mrnOf(pat), id: pid };
    const get = (q, pages) => client.request(q, { pageLimit: pages || 5, flat: true }).catch(err => { console.warn(q, err); return []; });
    const [obs, conds, meds] = await Promise.all([
      get(`Observation?patient=${pid}&category=laboratory&_count=200`, 10),
      get(`Condition?patient=${pid}&_count=100`, 3),
      get(`MedicationRequest?patient=${pid}&status=active&_count=100`, 3),
    ]);
    const { S, unmatched } = E.stateFromObservations(obs.filter(o => o.resourceType === 'Observation'));
    A.chartS = S; A.S = JSON.parse(JSON.stringify(S)); A.unmatched = unmatched;
    A.ctx = { age: A.pt.age, sex: A.pt.sex, meds: meds.filter(m => m.resourceType === 'MedicationRequest').map(m => (m.medicationCodeableConcept && (m.medicationCodeableConcept.text || (m.medicationCodeableConcept.coding || [])[0]?.display)) || '').filter(Boolean) };
    A.F = {}; A.autoF = new Set();
    conds.filter(c => c.resourceType === 'Condition').forEach(c => {
      const txt = (c.code && (c.code.text || (c.code.coding || [])[0]?.display)) || '';
      E.CONDITION_MAP.forEach(([re, f]) => { if (re.test(txt)) { A.F[f] = true; A.autoF.add(f); } });
    });
    A.noteEdited = A.consultEdited = false;
    renderAll(true);
    toast(`Loaded ${obs.length} lab observations, ${Object.keys(S).length} matched`);
  }

  function loadDemo(id) {
    const d = DEMO.find(x => x.id === id); if (!d) return;
    A.mode = 'demo'; A.pt = Object.assign({}, d.pt); A.chartS = {}; A.S = JSON.parse(JSON.stringify(d.S));
    A.F = Object.assign({}, d.F); A.autoF = new Set(); A.unmatched = [];
    A.ctx = { age: d.pt.age, sex: d.pt.sex, meds: d.meds.slice() };
    A.noteEdited = A.consultEdited = false;
    renderAll(true);
  }

  function buildDemoSelect() {
    const sel = $('#demoSel');
    sel.innerHTML = (A.client ? '<option value="__chart">Chart patient</option>' : '<option value="">Choose a made-up case…</option>') +
      DEMO.map(d => `<option value="${d.id}">${esc(d.label)}</option>`).join('');
    sel.onchange = () => { if (sel.value === '__chart') loadFromFhir(A.client); else if (sel.value) loadDemo(sel.value); };
  }

  // ---------- render ----------
  let R = null;
  function renderAll(full) {
    const p = A.pt;
    $('#pt').innerHTML = `${A.mode === 'demo' ? '<span class="badge">MADE-UP TEST PATIENT</span> ' : ''}<b>${esc(p.name || '')}</b> · ${p.age != null ? p.age + ' y' : ''} ${esc((p.sex || '')[0] || '').toUpperCase()} · MRN ${esc(p.mrn || '—')}`;
    R = E.evaluate(A.S, A.F, A.ctx);
    renderInterp();
    if (full) { renderLabs(); renderFeat(); renderOrder(); }
    renderNote();
  }

  const symCls = s => (s === '✓' ? 's-ok' : s === '✗' ? 's-no' : s === '?' ? 's-q' : 's-t');
  const VERD = { meets: 'Meets criteria / pattern fits', possible: 'Possible — needs more', unlikely: 'Less likely', na: 'Not assessable' };
  // ---------- criteria checklist inside each card ----------
  const wTxt = w => (w == null ? '' : (w > 0 ? '+' : '') + w);
  const ruleTxt = (d, kind) => (d.rule === 'max' && kind === 'points' ? 'highest counts' : d.rule === 'sum' ? 'all add' : d.rule === 'count' && d.need ? `need ≥${d.need}` : '');
  function critItem(i) {
    const w = `<span class="w">${i.sel ? (i.met ? '+' + i.w : '') : wTxt(i.w)}</span>`;
    if (i.sel) return `<div class="ci ${i.met ? 'on' : ''}"><span class="s s-q">▾</span><span>${esc(i.l)}</span><select data-crsel="${i.sel}">${E.RA_JOINTS.map(([v, l]) => `<option value="${v}" ${i.selVal === v ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>${w}</div>`;
    const lt = i.labTxt ? `<span class="lt">${esc(i.labTxt)}</span>` : '';
    if (i.f) return `<label class="ci ${i.met ? 'on' : ''}"><input type="checkbox" data-cf="${i.f}" ${A.F[i.f] ? 'checked' : ''}><span>${esc(i.l)}</span>${i.lab === true ? `<span class="have">✓ ${esc(i.from)}</span>` : ''}${lt}${w}</label>`;
    const sym = i.lab === true ? ['✓', 's-ok'] : i.lab === false ? ['✗', 's-no'] : ['?', 's-q'];
    return `<div class="ci lab ${i.met ? 'on' : ''}" title="Filled from results — change on the Serology &amp; labs tab"><span class="s ${sym[1]}">${sym[0]}</span><span>${esc(i.l)}</span>${lt || (i.lab == null ? '<span class="lt">not done</span>' : '')}${w}</div>`;
  }
  function critHtml(c) {
    const sets = R.criteria && R.criteria[c.key]; if (!sets) return '';
    return sets.map((s, si) => {
      const k = `crit-${c.key}-${si}`, res = s.met === true ? 'yes' : s.met === null ? 'maybe' : 'no';
      return `<details class="crit" data-sec="${k}" ${isOpen(k, true) ? 'open' : ''}><summary><b>${esc(s.name)}</b><span class="cres ${res}">${esc(s.text)}</span></summary>
        <div class="csrc">${esc(s.src)}</div>${s.pre ? `<div class="pre">${esc(s.pre)}</div>` : ''}
        ${s.entry.length ? `<div class="dom"><div class="dh">Entry ${s.entry.length > 1 ? 'criteria (all required)' : 'criterion'}</div>${s.entry.map(critItem).join('')}</div>` : ''}
        ${s.domains.map(d => `<div class="dom"><div class="dh">${esc(d.d)} <span class="rule">${ruleTxt(d, s.kind)}</span>${s.kind === 'points' ? `<span class="dsc">${d.score}</span>` : d.need ? `<span class="dsc">${d.score}/${d.need}</span>` : ''}</div>${d.items.map(critItem).join('')}</div>`).join('')}
        ${s.kind === 'points' && s.thr != null ? `<div class="tot">Total <b>${s.total}</b> · threshold ${s.thr}</div>` : ''}
      </details>`;
    }).join('');
  }
  function cardHtml(c, open) {
    const pct = c.verdict !== 'na' && c.score != null && c.threshold ? Math.max(0, Math.min(100, (c.score / c.threshold) * 100)) : null;
    return `<details class="card ${c.verdict}" data-sec="card-${c.key}" ${isOpen('card-' + c.key, open) ? 'open' : ''}><summary>
      <span class="nm">${esc(c.name)}</span><span class="pill ${c.verdict}">${VERD[c.verdict]}</span>
      ${pct != null ? `<span class="bar" title="${c.score} of ${c.threshold}"><i style="width:${pct}%"></i></span><span class="muted">${c.score}/${c.threshold}</span>` : ''}
      </summary>
      <div class="basis">${esc(c.basis)}</div>
      ${critHtml(c)}
      <details class="why" data-sec="why-${c.key}" ${isOpen('why-' + c.key, !(R.criteria && R.criteria[c.key])) ? 'open' : ''}><summary>Summary of findings</summary>
      <ul class="pts">${c.pts.map(x => `<li><span class="s ${symCls(x.s)}">${x.s}</span><span>${esc(x.t)}</span>${x.w != null ? `<span class="w">${x.w > 0 ? '+' : ''}${x.w}</span>` : ''}</li>`).join('')}</ul></details>
      ${c.notes.map(n => `<div class="note">${esc(n)}</div>`).join('')}
    </details>`;
  }

  function renderInterp() {
    const top = R.cards.filter(c => c.verdict === 'meets' || c.verdict === 'possible');
    const low = R.cards.filter(c => c.verdict === 'unlikely');
    const na = R.cards.filter(c => c.verdict === 'na');
    const nDone = Object.keys(A.S).length;
    $('#tab-interp').innerHTML = `
      ${R.flags.length ? `<div class="flag"><b>⚠ Act now</b><ul>${R.flags.map(f => `<li>${esc(f)}</li>`).join('')}</ul></div>` : ''}
      ${nDone === 0 ? `<div class="box">No autoimmune serology found in the chart${A.mode === 'fhir' ? ' (sandbox patients rarely have these labs)' : ''}. Enter results on the <b>Serology &amp; labs</b> tab, or pick a made-up case at the top right.</div>` : ''}
      <div class="grid">
        ${sec('ana', 'ANA', R.anaSummary.map(t => `<p>${esc(t)}</p>`).join(''))}
        ${sec('comp', `Complement: ${esc(R.complement.pattern)}`, `<p>${esc(R.complement.text)}</p>${R.complement.causes.length ? `<ul>${R.complement.causes.map(c => `<li>${esc(c)}</li>`).join('')}</ul>` : ''}`)}
        ${sec('anca', 'ANCA', R.ancaSummary.map(t => `<p>${esc(t)}</p>`).join(''))}
      </div>
      <h2 style="font-size:16px;margin:8px 0">Conditions to consider</h2>
      ${top.length ? top.map(c => cardHtml(c, true)).join('') : '<div class="box muted">No condition currently meets criteria or is flagged as possible with the data entered.</div>'}
      ${R.next.length ? sec('next', `Suggested next tests (${R.next.length})`, `<ul>${R.next.map(n => `<li><b>${esc(n.test)}</b> <span class="muted">— ${esc(n.why)}</span></li>`).join('')}</ul>`) : ''}
      ${low.length ? `<details class="box" data-sec="grp-low" ${isOpen('grp-low', false) ? 'open' : ''}><summary><b>Less likely (${low.length})</b> — click to see why</summary>${low.map(c => cardHtml(c, false)).join('')}</details>` : ''}
      ${na.length ? `<details class="box" data-sec="grp-na" ${isOpen('grp-na', false) ? 'open' : ''}><summary><b>Not assessable with current data (${na.length})</b></summary>${na.map(c => cardHtml(c, false)).join('')}</details>` : ''}`;
  }

  function control(t) {
    const cur = A.S[t.id] ? A.S[t.id].v : '';
    if (t.type === 'num') return `<input type="number" step="any" data-id="${t.id}" value="${cur === '' || cur == null ? '' : cur}" style="width:110px"> <span class="src">${esc(t.unit)}</span>`;
    return `<select data-id="${t.id}">${E.OPTIONS[t.type].map(([v, l]) => `<option value="${v}" ${String(v) === String(cur) ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
  }
  function renderLabs() {
    const groups = [...new Set(E.TESTS.map(t => t.group))];
    const order = ['ANA & ENA', 'ANCA & GBM', 'RF & CCP', 'Complement', 'Antiphospholipid', 'Myositis', 'Liver', 'Other', 'Supporting labs'];
    groups.sort((a, b) => order.indexOf(a) - order.indexOf(b));
    let h = `<div class="box"><div class="row"><span class="muted">Blue = from chart · Orange = entered/overridden here · Changes update the interpretation immediately.</span>
      <span style="margin-left:auto"></span><button class="btn alt" id="resetLabs">${A.mode === 'fhir' ? 'Reset to chart values' : 'Clear all'}</button></div>
      <table><thead><tr><th style="width:30%">Test</th><th style="width:32%">Result</th><th>Source</th></tr></thead><tbody>`;
    groups.forEach(g => {
      const gt = E.TESTS.filter(t => t.group === g), n = gt.filter(t => A.S[t.id]).length, op = isOpen('lab-' + g, true);
      h += `<tr class="grp-row${op ? '' : ' shut'}" data-g="${esc(g)}"><td class="grp" colspan="3">${esc(g)} <span class="cnt">${n ? `${n} result${n > 1 ? 's' : ''}` : 'none'}</span></td></tr>`;
      gt.forEach(t => {
        const s = A.S[t.id];
        const cls = s ? (s.src === 'chart' ? 'chart' : 'manual') : '';
        h += `<tr class="${cls}" data-grp="${esc(g)}" ${op ? '' : 'hidden'}><td>${esc(t.name)}</td><td>${control(t)}</td><td class="src">${s ? (s.src === 'chart' ? `${esc(s.raw)}: ${esc(s.disp)} · ${esc((s.date || '').slice(0, 10))}${s.note ? ' · ' + esc(s.note) : ''}` : s.src === 'demo' ? `made-up: ${esc(s.disp)}` : 'entered here') : ''}</td></tr>`;
      });
    });
    h += '</tbody></table></div>';
    if (A.unmatched.length) h += `<details class="box"><summary><b>Antibody-type results not recognised (${A.unmatched.length})</b> — map these by entering them above</summary><ul>${A.unmatched.slice(0, 60).map(p => `<li>${esc(p.name)}: ${esc(p.display)} <span class="src">${esc((p.date || '').slice(0, 10))}</span></li>`).join('')}</ul></details>`;
    $('#tab-labs').innerHTML = h;
    $('#tab-labs').querySelectorAll('[data-id]').forEach(el => el.addEventListener('change', () => {
      const t = E.TEST[el.dataset.id]; let val = el.value;
      if (val === '') { delete A.S[t.id]; }
      else {
        if (t.type === 'num') val = parseFloat(val); else if (/^\d+$/.test(val)) val = parseInt(val, 10);
        A.S[t.id] = { v: val, disp: t.type === 'num' ? `${val} ${t.unit}` : E.optLabel(t.type, val), src: 'manual' };
      }
      el.closest('tr').classList.remove('chart', 'manual'); if (A.S[t.id]) el.closest('tr').classList.add('manual');
      el.closest('tr').querySelector('.src').textContent = A.S[t.id] ? 'entered here' : '';
      renderAll(false);
    }));
    $('#tab-labs').querySelectorAll('tr.grp-row').forEach(tr => (tr.onclick = () => { setGroup(tr, tr.classList.contains('shut')); saveOpen(); }));
    $('#resetLabs').onclick = () => { A.S = JSON.parse(JSON.stringify(A.chartS)); renderAll(true); };
  }

  function renderFeat() {
    let h = `<details class="box sec" data-sec="feat-top" ${isOpen('feat-top', true) ? 'open' : ''}><summary><h3>RA joint count &amp; medications</h3></summary><div class="row"><b>RA joint count (2010 criteria):</b> <select id="raJ">${E.RA_JOINTS.map(([v, l]) => `<option value="${v}" ${String(A.F.raJoints || '') === v ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></div>
      <div class="row" style="align-items:flex-start"><b style="min-width:150px">Medications<br><span class="muted" style="font-weight:400">(one per line; checked for drug-induced lupus/ANCA, anticoagulants, statins)</span></b>
      <textarea id="medsTa" style="min-height:90px;flex:1">${esc((A.ctx.meds || []).join('\n'))}</textarea></div></details><div class="feat">`;
    E.FEATURES.forEach(([g, items]) => {
      const n = items.filter(([id]) => A.F[id] || (id === 'age50' && A.pt.age >= 50)).length;
      h += `<details class="fs" data-sec="feat-${esc(g)}" ${isOpen('feat-' + g, true) ? 'open' : ''}><summary><b>${esc(g)}</b> <span class="cnt" data-cnt="${esc(g)}">${n ? n + ' ticked' : ''}</span></summary>${items.map(([id, l]) => `<label class="${A.autoF.has(id) ? 'auto' : ''}"><input type="checkbox" data-f="${id}" ${A.F[id] || (id === 'age50' && A.pt.age >= 50) ? 'checked' : ''} ${id === 'age50' ? 'disabled' : ''}> ${esc(l)}</label>`).join('')}</details>`;
    });
    h += '</div>';
    $('#tab-feat').innerHTML = h;
    $('#tab-feat').querySelectorAll('[data-f]').forEach(cb => cb.addEventListener('change', () => {
      A.F[cb.dataset.f] = cb.checked;
      const d = cb.closest('details'), n = d.querySelectorAll('input:checked').length; d.querySelector('.cnt').textContent = n ? n + ' ticked' : '';
      renderAll(false); }));
    $('#raJ').onchange = e => { A.F.raJoints = e.target.value; renderAll(false); };
    $('#medsTa').oninput = e => { A.ctx.meds = e.target.value.split('\n').map(s => s.trim()).filter(Boolean); renderAll(false); };
  }

  // ---------- note & consult ----------
  function serologyLine() {
    const parts = [];
    E.TESTS.filter(t => t.type !== 'num' && A.S[t.id]).forEach(t => {
      const v = A.S[t.id].v; let lab = E.optLabel(t.type, v);
      if (t.type === 'ab') lab = v === 'pos' ? 'POS' : v === 'neg' ? 'neg' : 'equivocal';
      parts.push(`${t.name.replace(/ \(.*\)/, '')} ${lab}`);
    });
    return parts.join('; ');
  }
  function supportLine() {
    return E.TESTS.filter(t => t.type === 'num' && A.S[t.id]).map(t => `${t.name} ${A.S[t.id].v}${t.unit ? ' ' + t.unit : ''}`).join('; ');
  }
  function noteText() {
    const today = new Date().toISOString().slice(0, 10);
    const top = R.cards.filter(c => c.verdict === 'meets' || c.verdict === 'possible');
    const feats = E.FEATURES.flatMap(([, items]) => items).filter(([id]) => A.F[id]).map(([, l]) => l.replace(/ \(.*\)/, ''));
    return [
      `AUTOIMMUNE SEROLOGY REVIEW — ${today}`,
      `Serology: ${serologyLine() || 'none available'}`,
      `Complement: ${R.complement.pattern}`,
      `Supporting labs: ${supportLine() || '—'}`,
      `Clinical features: ${feats.join(', ') || '—'}`,
      '',
      'Interpretation:',
      ...(top.length ? top.map(c => `- ${c.name}: ${c.verdict === 'meets' ? 'meets' : 'possible by'} ${c.basis.split(' (')[0]}${c.score != null ? ` (${c.score}/${c.threshold})` : ''}`) : ['- No pattern meets criteria with current data.']),
      ...R.anaSummary.map(s => `- ${s}`),
      ...(R.flags.length ? ['', 'Red flags:', ...R.flags.map(f => `- ${f}`)] : []),
      ...(R.next.length ? ['', 'Suggested work-up:', ...R.next.map(n => `- ${n.test}`)] : []),
      '',
      'My assessment/decision: ____________________',
      'Plan: ____________________',
    ].join('\n');
  }
  function consultText(spec, dr) {
    const p = A.pt; const top = R.cards.filter(c => c.verdict === 'meets' || c.verdict === 'possible').slice(0, 2).map(c => c.name.replace(/ \(.*\)/, ''));
    const keyPos = E.TESTS.filter(t => t.type !== 'num' && t.group !== 'Supporting labs' && A.S[t.id] && !['neg', 'normal', ''].includes(String(A.S[t.id].v)))
      .slice(0, 5).map(t => `${t.name.replace(/ \(.*\)/, '')} ${E.optLabel(t.type, A.S[t.id].v).replace(/ \(.*\)/, '')}`);
    const feats = E.FEATURES.flatMap(([, i]) => i).filter(([id]) => A.F[id] && id !== 'age50').slice(0, 3).map(([, l]) => l.split(' / ')[0].replace(/ \(.*\)/, ''));
    return `Hello Dr. ${dr || '___'}, This is Wayne, hospitalist. I have ${p.name || '[name]'}, ${p.age != null ? p.age : '[age]'}${(p.sex || '')[0] ? (p.sex[0]).toUpperCase() : ''}, MRN ${p.mrn || '[MRN]'}${feats.length ? `, with ${feats.join(', ')}` : ''}. Serology: ${keyPos.join(', ') || 'pending'}. Concern for ${top.join(' vs ') || 'autoimmune disease'}. Would you be able to see them${spec ? ` (${spec})` : ''}? Your help is much appreciated. Thanks, Wayne`;
  }
  function renderNote() {
    const host = $('#tab-note');
    if (!host.dataset.built) {
      host.dataset.built = '1';
      host.innerHTML = `<details class="box sec" data-sec="note" ${isOpen('note', true) ? 'open' : ''}><summary><h3>Note draft (editable — copy into the PowerChart note)</h3></summary>
        <textarea id="noteTa"></textarea>
        <div class="row"><button class="btn" id="copyNote">Copy note</button><button class="btn alt" id="regenNote">Regenerate from current data</button><span class="muted" id="noteState"></span></div></details>
        <details class="box sec" data-sec="consult" ${isOpen('consult', true) ? 'open' : ''}><summary><h3>Consult message (MS Teams / text)</h3></summary>
        <div class="row">Specialty <select id="spec"><option>Rheumatology</option><option>Nephrology</option><option>Respirology</option><option>Dermatology</option><option>Neurology</option><option>Hepatology</option></select>
        Dr. <input type="text" id="drName" placeholder="surname" style="width:160px"></div>
        <textarea id="consultTa" style="min-height:110px"></textarea>
        <div class="row"><button class="btn" id="copyConsult">Copy message</button><button class="btn alt" id="regenConsult">Regenerate</button><span class="muted" id="wc"></span></div></details>`;
      $('#noteTa').oninput = () => { A.noteEdited = true; $('#noteState').textContent = 'Edited — your text is kept until you press Regenerate.'; };
      $('#consultTa').oninput = () => { A.consultEdited = true; wc(); };
      $('#copyNote').onclick = () => copy($('#noteTa').value);
      $('#copyConsult').onclick = () => copy($('#consultTa').value);
      $('#regenNote').onclick = () => { A.noteEdited = false; $('#noteState').textContent = ''; renderNote(); };
      $('#regenConsult').onclick = () => { A.consultEdited = false; renderNote(); };
      $('#spec').onchange = $('#drName').oninput = () => { A.consultEdited = false; renderNote(); };
    }
    if (!A.noteEdited) $('#noteTa').value = noteText();
    if (!A.consultEdited) $('#consultTa').value = consultText($('#spec').value, $('#drName').value.trim());
    wc();
  }
  const wc = () => { const n = $('#consultTa').value.trim().split(/\s+/).length; $('#wc').textContent = `${n} words`; };

  // ---------- Which test? (disease -> tests to order) ----------
  const OG = window.SeroOrderGuide;
  let orderQ = '';
  function renderOrder() {
    const host = $('#tab-order'); if (!OG) { host.innerHTML = '<div class="box">order-guide.js not loaded.</div>'; return; }
    if (!host.dataset.built) {
      host.dataset.built = '1';
      host.innerHTML = `<div class="box"><div class="row"><b>Disease or test:</b>
        <input type="search" id="ordQ" list="ordList" placeholder="e.g. primary biliary cirrhosis, PBC, GPA, myositis… or a test, e.g. AMA" style="flex:1;min-width:260px;padding:7px 9px;font-size:15px" autocomplete="off">
        <datalist id="ordList">${OG.GUIDE.map(d => `<option value="${esc(d.name)}">`).join('')}</datalist></div>
        <div class="muted" style="font-size:12px">Type a disease (abbreviations and old names work) to see what to order. Type a test name to see which diseases it is used for. ✓ = result already in this chart / entered here.</div></div>
        <div id="ordRes"></div>
        ${sec('ord-all', `Browse all conditions (${OG.GUIDE.length})`, `<div class="ordall">${OG.GUIDE.map(d => `<a href="#" data-d="${esc(d.name)}">${esc(d.name)}</a>`).join('')}</div>`, false)}
        <p class="disc">Draft from general practice — confirm against your lab's test menu and current guidelines.</p>`;
      $('#ordQ').addEventListener('input', e => { orderQ = e.target.value; drawOrder(); });
      host.querySelector('.ordall').addEventListener('click', e => { const a = e.target.closest('a[data-d]'); if (!a) return; e.preventDefault(); orderQ = a.dataset.d; $('#ordQ').value = orderQ; drawOrder(); window.scrollTo(0, 0); });
    }
    drawOrder();
  }
  function testLi(x) {
    const s = x.id && A.S[x.id];
    const have = s ? ` <span class="have">✓ ${esc(E.TEST[x.id] && E.TEST[x.id].type !== 'num' ? E.optLabel(E.TEST[x.id].type, s.v) : s.v + ' ' + (E.TEST[x.id] ? E.TEST[x.id].unit : ''))}</span>` : '';
    return `<li><b>${esc(x.name)}</b>${x.why ? ` <span class="muted">— ${esc(x.why)}</span>` : ''}${have}</li>`;
  }
  function orderText(d) {
    const L = (h, a) => (a && a.length ? [h + ':', ...a.map(x => '- ' + x.name)] : []);
    return [d.name, ...L('Order first', d.first), ...L('Then / to confirm', d.then), ...L('Also consider', d.also), ...(d.note ? ['Note: ' + d.note] : [])].join('\n');
  }
  function drawOrder() {
    const box = $('#ordRes'); if (!box) return;
    const res = OG.search(orderQ);
    if (!orderQ.trim()) { box.innerHTML = ''; return; }
    if (!res.length) { box.innerHTML = `<div class="box muted">No match for "${esc(orderQ)}". Try another name or abbreviation, or browse the list below.</div>`; return; }
    const byTest = res[0].s <= 30;
    box.innerHTML = (byTest ? `<div class="box muted">"${esc(orderQ)}" looks like a test — conditions that use it:</div>` : '') +
      res.slice(0, 8).map((x, i) => {
        const d = x.d, k = 'ord-' + d.name;
        const body = `${d.first && d.first.length ? `<h4>Order first</h4><ul>${d.first.map(testLi).join('')}</ul>` : ''}
          ${d.then && d.then.length ? `<h4>Then / to confirm</h4><ul>${d.then.map(testLi).join('')}</ul>` : ''}
          ${d.also && d.also.length ? `<h4>Also consider</h4><ul>${d.also.map(testLi).join('')}</ul>` : ''}
          ${d.note ? `<div class="note">${esc(d.note)}</div>` : ''}
          <div class="row"><button class="btn alt" data-copy="${esc(d.name)}">Copy order list</button></div>`;
        return `<details class="box sec" data-sec="${esc(k)}" ${i < (byTest ? 3 : 1) || isOpen(k, false) ? 'open' : ''}><summary><h3>${esc(d.name)}</h3></summary>${body}</details>`;
      }).join('');
    box.querySelectorAll('[data-copy]').forEach(b => (b.onclick = () => copy(orderText(OG.GUIDE.find(d => d.name === b.dataset.copy)))));
  }

  function renderRef() {
    $('#tab-ref').innerHTML = `
      <details class="box sec" data-sec="ref-ab" ${isOpen('ref-ab', true) ? 'open' : ''}><summary><h3>Antibody guide</h3></summary><table><thead><tr><th>Test</th><th>Main associations</th><th>Pearls / false positives</th></tr></thead><tbody>
      ${E.LIBRARY.map(r => `<tr><td><b>${esc(r[0])}</b></td><td>${esc(r[1])}</td><td>${esc(r[2])}</td></tr>`).join('')}</tbody></table></details>
      <details class="box sec" data-sec="ref-comp" ${isOpen('ref-comp', true) ? 'open' : ''}><summary><h3>Complement patterns</h3></summary><table><thead><tr><th>C3</th><th>C4</th><th>Think of</th></tr></thead><tbody>
      <tr><td>Low</td><td>Low</td><td>SLE, cryoglobulinemia, immune-complex MPGN, endocarditis/shunt nephritis, HBV/HCV, urticarial vasculitis</td></tr>
      <tr><td>Low</td><td>Normal</td><td>Post-infectious GN, C3 glomerulopathy, atypical HUS, sepsis</td></tr>
      <tr><td>Normal</td><td>Low</td><td>Cryoglobulinemia, hereditary/acquired angioedema (C1-INH), early SLE, C4 null alleles</td></tr>
      <tr><td>Normal</td><td>Normal</td><td>ANCA vasculitis, anti-GBM, IgA vasculitis/nephropathy, RA, SSc (does not exclude SLE)</td></tr></tbody></table></details>
      <details class="box sec" data-sec="ref-pearls" ${isOpen('ref-pearls', true) ? 'open' : ''}><summary><h3>Ordering pearls</h3></summary><ul>
        <li>Order ANA only with a compatible picture — in unselected patients most positives are false positives.</li>
        <li>Once ANA is positive, do not repeat it to follow disease; follow dsDNA, C3/C4, urine and CBC in SLE.</li>
        <li>ANCA: PR3/MPO immunoassay is the first-line test (2017 international consensus); IIF alone misses cases.</li>
        <li>Low complement + positive RF + purpura → think cryoglobulinemia and check HCV.</li>
        <li>Infections (endocarditis, HCV, HBV, TB, parvovirus B19) mimic autoimmune serology — get blood cultures before immunosuppression if febrile.</li>
        <li>Antiphospholipid tests need confirmation ≥12 weeks apart; lupus anticoagulant is unreliable on anticoagulants.</li>
        <li>Sjögren and antisynthetase syndrome can have a negative HEp-2 ANA — order Ro/Jo-1 directly if suspected.</li>
      </ul></details>`;
  }

  // ticking a criterion in a card = ticking it on the Clinical features tab
  $('#tab-interp').addEventListener('change', e => {
    const cb = e.target.closest('[data-cf]'), sel = e.target.closest('[data-crsel]');
    if (cb) A.F[cb.dataset.cf] = cb.checked; else if (sel) A.F[sel.dataset.crsel] = sel.value; else return;
    renderFeat(); renderAll(false);
  });

  // ---------- start ----------
  renderRef();
  const urlDemo = new URLSearchParams(location.search).get('demo');
  if (urlDemo != null || !(/[?&](code|state)=/.test(location.search) || sessionStorage.getItem('SMART_KEY'))) {
    buildDemoSelect(); loadDemo(urlDemo && DEMO.some(d => d.id === urlDemo) ? urlDemo : DEMO[0].id);
    $('#demoSel').value = A.mode === 'demo' ? (urlDemo && DEMO.some(d => d.id === urlDemo) ? urlDemo : DEMO[0].id) : '';
  } else {
    FHIR.oauth2.ready().then(client => { A.client = client; buildDemoSelect(); return loadFromFhir(client); })
      .catch(err => { console.error(err); buildDemoSelect(); loadDemo(DEMO[0].id); toast('No EHR session — showing made-up case'); });
  }
})();
