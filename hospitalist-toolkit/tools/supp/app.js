/* Supplement interactions tab – UI + FHIR loading. Rules live in rules.js (window.SUPP). */
(function () {
  'use strict';
  const $ = s => document.querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const SEVS = ['Contraindicated', 'High', 'Moderate', 'Low'];
  const SEV_COLOR = { Contraindicated: '#7a0b2e', High: '#b42318', Moderate: '#b54708', Low: '#1f6f43' };
  const SRC_LABEL = { chart: 'Chart order', notes: 'Found in notes', patient: 'Patient-reported', manual: 'Pasted list', proposed: 'Thinking of starting' };
  const CLASSES = ['Vitamin', 'Mineral', 'Herbal', 'Other'];

  const state = {
    mode: 'manual',
    patient: { name: '', mrn: '' },
    meds: [],          // {text, source:'chart'|'manual'}
    supps: [],         // {key?, text, source:'patient'|'notes'|'manual'|'proposed', snippet, label, off}
    notesOther: [],    // generic "supplement / herbal" mentions in notes
    notesStatus: '',
    pt: { age: null, sex: '', scr: null, egfr: null, k: null, ca: null, mg: null, alt: null, inr: null, plt: null, anc: null,
      liver: false, transplant: false, immunosupp: false, seizureHx: false, htn: false, hf: false, surgery: false, centralLine: false, g6pd: false, trop: false, thyroidTest: false },
    src: {},
    consult: { to: 'Pharmacy', drName: '', reason: '', dirty: false, text: '' },
    ref: { q: '', cls: '' },
    result: null
  };

  // ---------------- tabs ----------------
  document.querySelectorAll('#tabs button').forEach(b => b.addEventListener('click', () => {
    document.querySelectorAll('#tabs button').forEach(x => x.classList.toggle('active', x === b));
    document.querySelectorAll('.panel').forEach(p => p.classList.toggle('active', p.id === 'p-' + b.dataset.tab));
    window.scrollTo(0, 0);
  }));

  // ---------------- helpers ----------------
  const openState = {};
  try { Object.assign(openState, JSON.parse(localStorage.getItem('supp-open') || '{}')); } catch (e) {}
  function sec(title, inner, open = true, extra = '') {
    const key = title.replace(/\s*\(\d+\)$/, '');
    const isOpen = key in openState ? openState[key] : open;
    return `<details data-key="${esc(key)}" ${isOpen ? 'open' : ''}><summary>${title}${extra}</summary><div class="body">${inner}</div></details>`;
  }
  document.addEventListener('toggle', e => {
    const k = e.target.dataset && e.target.dataset.key; if (!k) return;
    openState[k] = e.target.open;
    try { localStorage.setItem('supp-open', JSON.stringify(openState)); } catch (err) {}
  }, true);
  function expandBar(panel) { return `<div class="row small"><a href="#" data-expand="${panel}">Expand all</a> · <a href="#" data-collapse="${panel}">Collapse all</a></div>`; }
  const srcChips = list => (list || []).map(s => `<span class="src-chip s-${s}">${esc(SRC_LABEL[s] || s)}</span>`).join('');
  function findingHTML(f, showSupp) {
    return `<div class="find ${f.sev}"><h4><span class="sev ${f.sev}">${f.sev}</span>${esc(f.title)}${showSupp && f.kind !== 'surgery' && f.kind !== 'stack' ? ` <span class="catTag">${esc(f.suppName)}</span>` : ''}</h4>
      ${f.partners.length ? `<div class="drugs">With: ${esc(f.partners.join(' · '))}</div>` : ''}
      ${f.why ? `<p>${esc(f.why)}</p>` : ''}${f.todo ? `<p><b>Do:</b> ${esc(f.todo)}</p>` : ''}${f.space ? `<p class="small"><b>Spacing:</b> ${esc(f.space)}</p>` : ''}
      ${f.sources && f.sources.length ? `<div class="small muted">Source: ${srcChips(f.sources)}</div>` : ''}</div>`;
  }
  const findingsBlock = (list, showSupp) => list.length ? list.map(f => findingHTML(f, showSupp)).join('') : '<div class="empty">✓ Nothing flagged.</div>';
  function badge(id, list) {
    const el = $(id); if (!el) return;
    const worst = SEVS.find(s => list.some(f => f.sev === s));
    const n = list.filter(f => f.sev !== 'Low').length;
    el.textContent = n || (list.length ? list.length : '');
    el.style.background = worst ? SEV_COLOR[worst] : 'transparent';
  }
  const activeSupps = () => state.supps.filter(s => !s.off);
  function suppOptions() {
    return CLASSES.map(c => `<optgroup label="${c}s">${SUPP.SUPPS.filter(s => s.cls === c).sort((a, b) => a.name.localeCompare(b.name)).map(s => `<option value="${s.key}">${esc(s.name)}</option>`).join('')}</optgroup>`).join('');
  }

  // ---------------- consult + note ----------------
  const ASK = {
    Pharmacy: 'Could you review these supplement interactions and advise what to stop or space out?',
    'Transplant nephrology': 'Could you advise on the supplement and immunosuppressant levels?',
    Cardiology: 'Would appreciate your advice on the antithrombotic plan given these supplements.',
    'Internal medicine': 'Would appreciate your advice on management.'
  };
  function buildConsult(r) {
    const c = state.consult, p = state.patient, pt = state.pt;
    const top = r.findings.filter(f => f.sev !== 'Low').slice(0, 2);
    const who = [p.name || '[name]', pt.age ? pt.age + (pt.sex ? pt.sex[0].toUpperCase() : '') : '[age]', 'MRN ' + (p.mrn || '[MRN]')].join(', ');
    const concern = top.length ? top.map(f => f.title + (f.partners.length ? ' (' + f.partners.map(x => x.split(/\s+/)[0]).join(', ') + ')' : '')).join('; ') : 'supplements with possible drug interactions';
    const name = c.to === 'Pharmacy' ? (c.drName || '___') : 'Dr. ' + (c.drName || '___');
    return `Hello ${name}, This is Wayne, hospitalist. I have ${who}${c.reason ? ', admitted with ' + c.reason : ''}. Supplements: ${r.supps.map(x => x.supp.name).join(', ') || 'none'}. Concern: ${concern}. ${ASK[c.to]} Your help is much appreciated. Thanks, Wayne`;
  }
  function buildNote(r) {
    const lines = ['Supplement / natural health product review:'];
    lines.push('- Taking: ' + (r.supps.length ? r.supps.map(x => x.supp.name + (x.texts[0] && x.texts[0].toLowerCase() !== x.supp.name.toLowerCase() ? ' (' + x.texts[0] + ')' : '') + ' [' + x.sources.map(s => SRC_LABEL[s] || s).join(', ') + ']').join('; ') : 'none identified') + '.');
    const fs = r.findings.filter(f => f.sev !== 'Low');
    if (!fs.length) lines.push('- No significant supplement-drug interactions flagged.');
    fs.forEach(f => lines.push(`- [${f.sev}] ${f.title}${f.partners.length ? ' (with ' + f.partners.join(', ') + ')' : ''}. Plan: ${f.todo || ''}`));
    if (r.spacing.length) lines.push('- Dose spacing: ' + [...new Set(r.spacing.map(s => s.text))].join(' '));
    lines.push('Plan discussed with patient; medication reconciliation updated to include supplements.');
    return lines.join('\n');
  }

  // ---------------- render ----------------
  function run() {
    state.result = SUPP.analyze({ meds: state.meds, supps: activeSupps(), pt: state.pt });
    render();
  }
  function render() {
    const r = state.result, all = r.findings;
    badge('#b-all', all);
    const bs = $('#b-supps'); if (bs) { bs.textContent = r.supps.length || ''; bs.style.background = r.supps.length ? '#1f5f8b' : 'transparent'; }
    badge('#b-sp', r.spacing.map(s => ({ sev: 'Low' })).concat(all.filter(f => f.kind === 'surgery' || f.kind === 'lab')));

    // ----- Summary
    const counts = SEVS.map(s => `<span class="sev ${s}">${all.filter(f => f.sev === s).length} ${s}</span>`).join(' ');
    if (!state.consult.dirty) state.consult.text = buildConsult(r);
    const low = all.filter(f => f.sev === 'Low');
    $('#p-summary').innerHTML = expandBar('summary') +
      sec('Findings', `<div class="row">${counts}</div>
        <p class="small muted">${r.supps.length} supplement${r.supps.length === 1 ? '' : 's'} checked against ${r.meds.length} medication${r.meds.length === 1 ? '' : 's'}.
        ${!r.supps.length ? '<b>No supplements yet</b> – supplements are often missing from the med list: ask the patient and add them on the <a href="#" data-goto="supps">Supplements</a> tab.' : ''}</p>
        ${findingsBlock(all.filter(f => f.sev !== 'Low'), true)}
        ${low.length ? sec('Low-priority notes (' + low.length + ')', findingsBlock(low, true), false) : ''}`) +
      sec('Supplements checked (' + r.supps.length + ')', r.supps.length ? `<table><tr><th>Supplement</th><th>As recorded</th><th>From</th></tr>${r.supps.map(x => `<tr><td><b>${esc(x.supp.name)}</b><div class="small muted">${x.supp.cls}</div></td><td class="small">${esc(x.texts.join(' · ') || '–')}</td><td>${srcChips(x.sources)}</td></tr>`).join('')}</table>` : '<p class="muted">None yet.</p>', true) +
      sec('Ask the patient', `<p class="small">Supplements are under-recorded. Ask: <i>"Do you take any vitamins, minerals, herbal or natural products, CBD, protein or weight-loss products, or anything from a naturopath or health food store?"</i> Ask them (or family) to bring the bottles in.</p>
        <div class="row"><select id="qSel"><option value="">Pick a supplement…</option>${suppOptions()}</select><input id="qDose" placeholder="dose (optional)" style="width:140px"><button class="act" id="qAdd">Add</button></div>`, !r.supps.length) +
      sec('Consult message', `<div class="grid">
          <label class="f">To<select id="cTo">${Object.keys(ASK).map(k => `<option ${k === state.consult.to ? 'selected' : ''}>${k}</option>`).join('')}</select></label>
          <label class="f">Name<input id="cName" value="${esc(state.consult.drName)}" placeholder="___"></label>
          <label class="f">Admitted with<input id="cReason" value="${esc(state.consult.reason)}" placeholder="e.g. hip fracture"></label></div>
          <textarea id="cText" rows="4" style="margin-top:8px">${esc(state.consult.text)}</textarea>
          <div class="row"><button class="act" data-copy="cText">Copy message</button><button class="sec" id="cRegen">Regenerate</button><span class="small muted" id="cWords"></span></div>`, false) +
      sec('Copy to note', `<textarea id="noteText" rows="8">${esc(buildNote(r))}</textarea><div class="row"><button class="act" data-copy="noteText">Copy to clipboard</button></div>`, false);
    const wc = $('#cWords'); if (wc) wc.textContent = state.consult.text.split(/\s+/).filter(Boolean).length + ' words';

    // ----- Supplements (inputs)
    const rows = state.supps.map((s, i) => {
      const m = s.key ? SUPP.SUPPS.find(x => x.key === s.key) : SUPP.matchSupp(s.text);
      return `<tr class="${s.off ? 'off' : ''}"><td><b>${esc(m ? m.name : s.text)}</b>${m ? '' : ' <span class="small" style="color:#b54708">not recognized</span>'}</td>
        <td class="small">${esc(s.text || '')}${s.snippet ? `<div class="snip">“…${esc(s.snippet)}…”<span class="muted"> ${esc(s.label || '')}</span></div>` : ''}</td>
        <td>${srcChips([s.source])}</td>
        <td>${s.source === 'notes' ? `<label class="cb small"><input type="checkbox" data-suppon="${i}" ${s.off ? '' : 'checked'}>include</label>` : `<a href="#" data-rmsupp="${i}" title="Remove">✕</a>`}</td></tr>`;
    }).join('');
    const chartS = r.supps.filter(x => x.sources.indexOf('chart') >= 0);
    $('#p-supps').innerHTML = expandBar('supps') +
      sec('Add a supplement (pull-down)', `<div class="row">
          <select id="addSel"><option value="">Pick a supplement…</option>${suppOptions()}</select>
          <input id="addDose" placeholder="dose / how often (optional)" style="width:200px">
          <select id="addSrc"><option value="patient">Patient-reported</option><option value="proposed">Thinking of starting</option></select>
          <button class="act" id="addBtn">Add</button></div>
        <div class="small muted" style="margin:8px 0 4px">Common ones – tick to add:</div>
        <div class="grid">${SUPP.COMMON.map(k => { const s = SUPP.SUPPS.find(x => x.key === k); const on = state.supps.some(x => x.key === k && x.source === 'patient'); return `<label class="cb"><input type="checkbox" data-quick="${k}" ${on ? 'checked' : ''}>${esc(s.name)}</label>`; }).join('')}</div>`) +
      sec('On the list (' + state.supps.length + ' added' + (chartS.length ? ' + ' + chartS.length + ' from chart orders' : '') + ')',
        (chartS.length ? `<p class="small"><b>From chart orders:</b> ${chartS.map(x => esc(x.supp.name)).join(', ')}</p>` : '') +
        (state.supps.length ? `<table><tr><th>Supplement</th><th>Text</th><th>From</th><th></th></tr>${rows}</table>` : '<p class="muted">Nothing added yet.</p>')) +
      sec('Paste or type a list', `<textarea id="pasteSupps" rows="5" placeholder="One per line, e.g. from the bottles the family brought in:\nVitamin D3 1000 IU daily\nTurmeric 500 mg BID\nGinkgo">${esc(state.supps.filter(s => s.source === 'manual').map(s => s.text).join('\n'))}</textarea>
        <div class="row"><button class="act" id="usePaste">Check these</button>${r.unmatched.length ? `<span class="small" style="color:#b54708">Not recognized: ${esc(r.unmatched.join(', '))} – check with pharmacy / Natural Medicines.</span>` : ''}</div>`, false) +
      sec('Found in notes', `<p class="small muted">${esc(state.notesStatus || (state.mode === 'fhir' ? '' : 'Notes are read when the tab is opened from Cerner.'))}</p>
        ${state.supps.some(s => s.source === 'notes') ? '<p class="small">Supplements named in recent notes are in the list above with <i>Found in notes</i> – untick “include” if the note says they were stopped.</p>' : ''}
        ${state.notesOther.length ? '<p class="small"><b>Other mentions of supplements or natural products</b> (not named – ask the patient):</p>' + state.notesOther.map(o => `<div class="snip">“…${esc(o.snippet)}…” <span class="muted">${esc(o.label)}</span></div>`).join('') : ''}`, state.supps.some(s => s.source === 'notes') || state.notesOther.length > 0) +
      sec('Medications checked (' + r.meds.length + ')', (r.meds.length ? `<table><tr><th>Order</th><th>Interaction groups</th></tr>${r.meds.map(m => `<tr><td class="small">${esc(m.text)}</td><td class="small muted">${esc(m.groups.map(g => SUPP.GROUPS[g].label).join(' · ') || '–')}</td></tr>`).join('')}</table>` : '<p class="muted">No medications yet.</p>') +
        `<p class="small muted" style="margin-top:8px">Paste a medication list (manual mode):</p><textarea id="manualMeds" rows="5" placeholder="One medication per line">${esc(state.meds.filter(m => m.source === 'manual').map(m => m.text).join('\n'))}</textarea>
        <div class="row"><button class="act" id="useManual">Use this list</button></div>`, state.mode !== 'fhir');

    // ----- By supplement
    $('#p-bysupp').innerHTML = r.supps.length ? expandBar('bysupp') + r.supps.map(x => {
      const fs = all.filter(f => f.supp === x.supp.key);
      const worst = SEVS.find(s => fs.some(f => f.sev === s));
      return sec(esc(x.supp.name), `<p class="small">${esc(x.supp.what || '')}</p><div class="small muted">From: ${srcChips(x.sources)} ${esc(x.texts.join(' · '))}</div>
        ${findingsBlock(fs, false)}${x.supp.preop ? `<p class="small"><b>Before surgery:</b> ${esc(x.supp.preop)}</p>` : ''}`, true,
        worst ? ` <span class="sev ${worst}">${fs.length}</span>` : ' <span class="ok small">✓</span>');
    }).join('') : '<p class="muted">No supplements yet – add them on the Supplements tab.</p>';

    // ----- Spacing, surgery and labs
    const sp = r.spacing;
    const spRows = [];
    sp.forEach(s => { const k = s.supp + '|' + s.text; if (!spRows.some(x => x.k === k)) spRows.push({ k, supp: s.supp, partners: s.partners, text: s.text }); });
    const surg = all.find(f => f.kind === 'surgery');
    const lab = all.filter(f => f.kind === 'lab');
    $('#p-spacing').innerHTML = expandBar('spacing') +
      sec('Dose spacing (minerals and fibre that bind oral drugs)', spRows.length ? `<table><tr><th>Supplement</th><th>Drug</th><th>How to space</th></tr>${spRows.map(s => `<tr><td><b>${esc(s.supp)}</b></td><td class="small">${esc(s.partners.join(' · ') || '–')}</td><td class="small">${esc(s.text)}</td></tr>`).join('')}</table>
        <p class="small muted">A simple schedule that usually works: thyroid hormone or bisphosphonate on waking (fasting); other drugs with breakfast; iron mid-morning or at lunch; calcium/magnesium with supper; during a short quinolone or doxycycline course, hold the mineral.</p>` : '<p class="muted">No spacing needed for the current list.</p>') +
      sec('Surgery', `<label class="cb"><input type="checkbox" data-f="surgery" ${state.pt.surgery ? 'checked' : ''}>Surgery planned (ticked automatically for a hip fracture on the problem list)</label>
        ${surg ? findingHTML(surg) : ''}
        ${r.preop.length ? `<table style="margin-top:6px"><tr><th>Supplement</th><th>Before surgery</th></tr>${r.preop.map(p => `<tr><td><b>${esc(p.name)}</b></td><td class="small">${esc(p.text)}</td></tr>`).join('')}</table>` : '<p class="muted">No supplements on the list that need holding.</p>'}
        <p class="small muted">Times from Ang-Lee et al., JAMA 2001 (ginkgo 36 h, garlic and ginseng 7 days, St John's wort 5 days, kava and ephedra 24 h). For urgent surgery, stop now and tell anesthesia – do not delay surgery.</p>`, true) +
      sec('Lab interference', (lab.length ? findingsBlock(lab, false) : '') +
        `<ul class="small"><li><b>Biotin</b> (hair/nail products, 5–10 mg): falsely low troponin, falsely “hyperthyroid” thyroid tests, and others. Ask before interpreting an unexpected result.</li>
        <li><b>High-dose vitamin C</b> (mainly IV): falsely high readings on some bedside glucose meters.</li>
        <li><b>Siberian ginseng</b>: falsely high digoxin levels on some assays.</li></ul>
        <div class="grid"><label class="cb"><input type="checkbox" data-f="trop" ${state.pt.trop ? 'checked' : ''}>Troponin ordered / ACS work-up</label>
        <label class="cb"><input type="checkbox" data-f="thyroidTest" ${state.pt.thyroidTest ? 'checked' : ''}>Thyroid tests ordered</label></div>`, lab.length > 0);

    // ----- Reference
    renderRef();
  }

  function renderRef() {
    const q = state.ref.q.trim().toLowerCase(), cls = state.ref.cls;
    const hit = s => (!cls || s.cls === cls) && (!q || (s.name + ' ' + s.terms.join(' ') + ' ' + (s.what || '') + ' ' + s.ix.map(r => r.title + ' ' + r.g.map(g => SUPP.GROUPS[g].label + ' ' + SUPP.GROUPS[g].terms.join(' ')).join(' ')).join(' ')).toLowerCase().indexOf(q) >= 0);
    const list = SUPP.SUPPS.filter(hit).sort((a, b) => a.name.localeCompare(b.name));
    const sevOf = (r) => typeof r.sev === 'function' ? 'Moderate' : r.sev;
    const body = CLASSES.map(c => {
      const ls = list.filter(s => s.cls === c); if (!ls.length) return '';
      return sec(c + 's (' + ls.length + ')', ls.map(s => `<div class="refitem"><h4>${esc(s.name)}</h4><p class="small">${esc(s.what || '')}</p>
        ${s.ix.length ? `<ul class="small">${s.ix.map(r => `<li><span class="sev ${sevOf(r)}">${typeof r.sev === 'function' ? 'Varies' : r.sev}</span>${esc(r.title)} <span class="muted">– ${esc(r.g.map(g => SUPP.GROUPS[g].label).join(', '))}</span></li>`).join('')}</ul>` : ''}
        ${s.cond.length ? `<div class="small muted">Patient factors: ${esc(s.cond.map(r => r.title).join('; '))}</div>` : ''}
        ${s.lab ? '<div class="small muted">Lab test interference (see Spacing, surgery & labs).</div>' : ''}
        ${s.preop ? `<div class="small"><b>Before surgery:</b> ${esc(s.preop)}</div>` : ''}</div>`).join(''), !!q);
    }).join('');
    const el = $('#p-ref');
    const hadFocus = document.activeElement && document.activeElement.id === 'refQ';
    el.innerHTML = `<div class="row"><input id="refQ" placeholder="Search a supplement or a drug (e.g. tacrolimus, warfarin, levothyroxine)" value="${esc(state.ref.q)}" style="flex:1;min-width:240px">
      <select id="refCls"><option value="">All types</option>${CLASSES.map(c => `<option ${c === cls ? 'selected' : ''}>${c}</option>`).join('')}</select></div>
      <p class="small muted">${list.length} of ${SUPP.SUPPS.length} supplements.</p>${expandBar('ref')}${body || '<p class="muted">No match.</p>'}
      ${sec('Sources and where to check', `<ul class="small">
        <li><a href="https://naturalmedicines.therapeuticresearch.com" target="_blank" rel="noopener">Natural Medicines</a> (licensed – the most complete interaction checker; ask pharmacy about access).</li>
        <li><a href="https://ods.od.nih.gov/factsheets/list-all/" target="_blank" rel="noopener">NIH Office of Dietary Supplements fact sheets</a> (vitamins and minerals).</li>
        <li><a href="https://www.nccih.nih.gov/health/herbsataglance" target="_blank" rel="noopener">NCCIH Herbs at a Glance</a>.</li>
        <li><a href="https://www.mskcc.org/cancer-care/diagnosis-treatment/symptom-management/integrative-medicine/herbs" target="_blank" rel="noopener">MSKCC About Herbs</a> (good for oncology patients).</li>
        <li>Health Canada Licensed Natural Health Products Database (NPN on the bottle).</li>
        <li>Ang-Lee MK et al. Herbal medicines and perioperative care. JAMA 2001;286:208-16.</li></ul>
        <p class="small muted">This tab is an UNVERIFIED draft written from general knowledge and product monographs. Lists are curated, not exhaustive.</p>`, false)}`;
    if (hadFocus) { const i = $('#refQ'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }
  }

  // ---------------- patient data panel ----------------
  const NUM_FIELDS = [['age', 'Age (y)'], ['scr', 'Creatinine (µmol/L)'], ['egfr', 'eGFR (mL/min/1.73m²)'], ['k', 'K (mmol/L)'], ['ca', 'Total Ca (mmol/L)'], ['mg', 'Mg (mmol/L)'], ['alt', 'ALT (U/L)'], ['inr', 'INR'], ['plt', 'Platelets (×10⁹/L)'], ['anc', 'Neutrophils (×10⁹/L)']];
  const BOOL_FIELDS = [['liver', 'Liver disease / cirrhosis'], ['transplant', 'Solid organ transplant'], ['immunosupp', 'Immunosuppressed / neutropenic / chemo'], ['centralLine', 'Central line / PICC'], ['seizureHx', 'Seizure disorder'], ['htn', 'Hypertension'], ['hf', 'Heart failure'], ['g6pd', 'G6PD deficiency'], ['surgery', 'Surgery planned'], ['trop', 'Troponin ordered / ACS work-up'], ['thyroidTest', 'Thyroid tests ordered']];
  function renderData() {
    $('#p-data').innerHTML =
      sec('Labs and demographics', `<div class="grid">
        <label class="f">Sex<select data-f="sex"><option value="">–</option><option value="female" ${state.pt.sex === 'female' ? 'selected' : ''}>Female</option><option value="male" ${state.pt.sex === 'male' ? 'selected' : ''}>Male</option></select><span class="src">${esc(state.src.sex || '')}</span></label>
        ${NUM_FIELDS.map(([k, l]) => `<label class="f">${l}<input type="number" step="any" data-f="${k}" value="${state.pt[k] ?? ''}"><span class="src">${esc(state.src[k] || '')}</span></label>`).join('')}</div>
        <p class="small muted">Chart values are the most recent in the last 30 days. eGFR is calculated (CKD-EPI 2021) from creatinine if no eGFR result is found.</p>`) +
      sec('Conditions', `<div class="grid">${BOOL_FIELDS.map(([k, l]) => `<label class="cb"><input type="checkbox" data-f="${k}" ${state.pt[k] ? 'checked' : ''}>${l}</label>`).join('')}</div>
        <p class="small muted">${esc(state.src.conditions || 'Tick from the problem list / admission diagnosis.')}</p>`);
  }

  // ---------------- events ----------------
  function addSupp(key, text, source) {
    if (!key && !text) return;
    const s = key ? SUPP.SUPPS.find(x => x.key === key) : null;
    state.supps.push({ key: key || null, text: text ? (s ? s.name + ' ' + text : text) : (s ? s.name : ''), source });
    run();
  }
  document.addEventListener('input', e => {
    const f = e.target.dataset.f;
    if (f) {
      if (e.target.type === 'checkbox') state.pt[f] = e.target.checked;
      else if (e.target.type === 'number') state.pt[f] = e.target.value === '' ? null : parseFloat(e.target.value);
      else state.pt[f] = e.target.value;
      if ((f === 'scr' || f === 'age' || f === 'sex') && state.pt.scr && !state.src.egfrLab) {
        state.pt.egfr = SUPP.ckdEpi2021(state.pt.scr, state.pt.age, state.pt.sex);
        state.src.egfr = state.pt.egfr ? 'calculated CKD-EPI 2021' : '';
        const el = document.querySelector('#p-data [data-f="egfr"]'); if (el) el.value = state.pt.egfr ?? '';
      }
      document.querySelectorAll(`[data-f="${f}"]`).forEach(el => { if (el !== e.target && el.type === 'checkbox') el.checked = state.pt[f]; });
      return run();
    }
    if (e.target.id === 'refQ') { state.ref.q = e.target.value; renderRef(); }
    if (e.target.id === 'cText') { state.consult.text = e.target.value; state.consult.dirty = true; const wc = $('#cWords'); if (wc) wc.textContent = e.target.value.split(/\s+/).filter(Boolean).length + ' words'; }
    if (e.target.id === 'cName' || e.target.id === 'cReason') {
      state.consult[e.target.id === 'cName' ? 'drName' : 'reason'] = e.target.value; state.consult.dirty = false;
      state.consult.text = buildConsult(state.result); $('#cText').value = state.consult.text;
    }
  });
  document.addEventListener('change', e => {
    const t = e.target;
    if (t.dataset.quick) {
      const k = t.dataset.quick;
      if (t.checked) addSupp(k, '', 'patient');
      else { state.supps = state.supps.filter(x => !(x.key === k && x.source === 'patient')); run(); }
    }
    if (t.dataset.suppon != null) { state.supps[+t.dataset.suppon].off = !t.checked; run(); }
    if (t.id === 'refCls') { state.ref.cls = t.value; renderRef(); }
    if (t.id === 'cTo') { state.consult.to = t.value; state.consult.dirty = false; render(); }
  });
  document.addEventListener('click', e => {
    const t = e.target;
    if (t.id === 'addBtn') { addSupp($('#addSel').value, $('#addDose').value.trim(), $('#addSrc').value); }
    if (t.id === 'qAdd') { addSupp($('#qSel').value, $('#qDose').value.trim(), 'patient'); }
    if (t.dataset && t.dataset.rmsupp != null) { e.preventDefault(); state.supps.splice(+t.dataset.rmsupp, 1); run(); }
    if (t.dataset && t.dataset.goto) { e.preventDefault(); document.querySelector(`#tabs [data-tab="${t.dataset.goto}"]`).click(); }
    if (t.dataset && (t.dataset.expand || t.dataset.collapse)) {
      e.preventDefault(); const open = !!t.dataset.expand;
      document.querySelectorAll('#p-' + (t.dataset.expand || t.dataset.collapse) + ' details').forEach(d => { d.open = open; });
    }
    if (t.id === 'usePaste') {
      const lines = $('#pasteSupps').value.split(/\n|;/).map(s => s.trim()).filter(Boolean);
      state.supps = state.supps.filter(s => s.source !== 'manual').concat(lines.map(text => ({ text, source: 'manual' })));
      run();
    }
    if (t.id === 'useManual') {
      const lines = $('#manualMeds').value.split(/\n|;/).map(s => s.trim()).filter(Boolean);
      state.meds = state.meds.filter(m => m.source !== 'manual').concat(lines.map(text => ({ text, source: 'manual' })));
      run();
    }
    if (t.id === 'cRegen') { state.consult.dirty = false; render(); }
    if (t.dataset && t.dataset.copy) {
      const el = document.getElementById(t.dataset.copy), label = t.textContent;
      (navigator.clipboard ? navigator.clipboard.writeText(el.value) : Promise.reject()).then(() => { t.textContent = 'Copied ✓'; setTimeout(() => t.textContent = label, 1500); })
        .catch(() => { el.select(); document.execCommand('copy'); });
    }
  });

  function setStatus(msg, kind) {
    const h = $('#status'); if (h) h.textContent = msg;
    const n = $('#loadNote'); if (!n) return;
    n.textContent = msg; n.className = 'loadnote ' + (kind || '');
    n.style.display = msg ? 'block' : 'none';
  }
  const withTimeout = (pr, ms) => Promise.race([pr, new Promise((_, rej) => setTimeout(() => rej(new Error('timed out')), ms))]);

  // ---------------- FHIR ----------------
  const LABS = {
    k: { loinc: ['2823-3', '6298-4', '77142-8', '32713-0'], re: /^potassium|potassium,? (serum|plasma|blood|level)|^k\b/i },
    mg: { loinc: ['19123-9', '2601-3'], re: /magnesium/i },
    ca: { loinc: ['17861-6', '2000-8', '49765-1'], re: /^calcium(?!.*ioni)|calcium,? total/i },
    scr: { loinc: ['2160-0', '14682-9', '38483-4'], re: /^creatinine(?!.*(clear|ratio|urine))/i },
    egfr: { loinc: ['33914-3', '48642-3', '48643-1', '62238-1', '69405-9', '98979-8', '50044-7'], re: /egfr|glomerular filtration/i },
    alt: { loinc: ['1742-6', '1743-4', '76625-3'], re: /^alt\b|alanine amino/i },
    inr: { loinc: ['6301-6', '34714-6', '46418-0'], re: /\binr\b|international normali[sz]ed/i },
    plt: { loinc: ['777-3', '26515-7', '49497-1'], re: /platelet/i },
    anc: { loinc: ['751-8', '753-4', '26499-4'], re: /neutrophils?,? (abs|#)|absolute neutrophil|^anc\b|^neut(rophil)?s? ?(abs|#)/i },
    trop: { loinc: ['6598-7', '10839-9', '42757-5', '67151-1', '89579-7', '49563-0', '48425-3', '48426-1'], re: /troponin/i },
    tsh: { loinc: ['3016-3', '11580-8', '3024-7', '3051-0', '14920-3'], re: /\btsh\b|thyroid stimulating|free t4|free thyroxine|\bft4\b|free t3/i }
  };
  const EXCLUDE = /urine|\bur\b|csf|fluid|24\s*h|random ur/i;
  function obsValue(o) {
    if (o.valueQuantity && typeof o.valueQuantity.value === 'number') return { v: o.valueQuantity.value, u: (o.valueQuantity.unit || o.valueQuantity.code || '').toLowerCase() };
    if (typeof o.valueString === 'string') { const m = o.valueString.match(/-?\d+(\.\d+)?/); if (m) return { v: parseFloat(m[0]), u: '' }; }
    return { v: null, u: '' };
  }
  function convert(key, v, u) {
    if (v == null) return v;
    if (key === 'mg' && /mg\/dl/.test(u)) return +(v / 2.43).toFixed(2);
    if (key === 'ca' && /mg\/dl/.test(u)) return +(v / 4.008).toFixed(2);
    if (key === 'scr' && /mg\/dl/.test(u)) return Math.round(v * 88.4);
    if (key === 'anc' && /\/(mm3|ul|µl)/.test(u) && v > 50) return +(v / 1000).toFixed(2);
    if (key === 'plt' && /\/(mm3|ul|µl)/.test(u) && v > 5000) return Math.round(v / 1000);
    return v;
  }
  function classify(o) {
    const codes = ((o.code && o.code.coding) || []).map(c => c.code);
    const text = ((o.code && (o.code.text || (o.code.coding || []).map(c => c.display).join(' '))) || '');
    for (const k of Object.keys(LABS)) if (codes.some(c => LABS[k].loinc.includes(c))) return k;
    if (EXCLUDE.test(text)) return null;
    for (const k of Object.keys(LABS)) if (LABS[k].re.test(text.trim())) return k;
    return null;
  }
  const COND = [['liver', /cirrhosis|hepatitis|liver disease|hepatic|nafld|masld|steatohepatitis/i], ['transplant', /transplant/i],
    ['immunosupp', /neutropeni|immunosuppress|immunocompromis|\bhiv\b|leuk(a)?emia|lymphoma|myeloma|chemotherapy/i], ['seizureHx', /epilep|seizure/i],
    ['htn', /hypertension(?!.*pulmonary)/i], ['hf', /heart failure|\bchf\b|hfref|hfpef|cardiomyopathy/i], ['g6pd', /g6pd|glucose-6-phosphate/i],
    ['surgery', /hip fracture|fracture of (the )?(neck of )?femur|femoral neck fracture|intertrochanteric|subtrochanteric|pre-?op|awaiting surgery/i],
    ['trop', /acute coronary|\bnstemi\b|\bstemi\b|chest pain|myocardial infarction/i]];

  async function loadFHIR(client) {
    state.mode = 'fhir';
    setStatus('Loading medications, labs and problem list from the chart…', 'busy');
    const pid = client.patient.id;
    const errs = [];
    const since = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
    const T = 25000;
    const get = (label, pr) => withTimeout(pr, T).catch(() => { if (label) errs.push(label); return null; });
    const [p, meds, labs, conds] = await Promise.all([
      get('patient', client.patient.read()),
      get('medications', client.request(`MedicationRequest?patient=${pid}&status=active&_count=100`, { pageLimit: 0, flat: true })),
      get('labs', client.request(`Observation?patient=${pid}&category=laboratory&date=ge${since}&_count=200`, { pageLimit: 3, flat: true })),
      get('problem list', client.request(`Condition?patient=${pid}&_count=100`, { pageLimit: 2, flat: true }))
    ]);
    if (p) {
      const n = (p.name || [])[0] || {};
      state.patient.name = n.text || [((n.given || []).join(' ')), n.family].filter(Boolean).join(' ');
      const mrn = (p.identifier || []).find(i => (i.type && (i.type.coding || []).some(c => c.code === 'MR')) || /mrn/i.test((i.type && i.type.text) || ''));
      state.patient.mrn = mrn ? mrn.value : '';
      if (p.birthDate) { const bd = new Date(p.birthDate), now = new Date(); let ag = now.getFullYear() - bd.getFullYear(); if (now < new Date(now.getFullYear(), bd.getMonth(), bd.getDate())) ag--; state.pt.age = ag; state.src.age = 'chart'; }
      if (p.gender === 'female' || p.gender === 'male') { state.pt.sex = p.gender; state.src.sex = 'chart'; }
      $('#ptBanner').textContent = `${state.patient.name || 'Patient'} · ${state.pt.age ?? '?'}${state.pt.sex ? state.pt.sex[0].toUpperCase() : ''}${state.patient.mrn ? ' · MRN ' + state.patient.mrn : ''}`;
    }
    if (meds) {
      // Includes documented home medications (Cerner returns them as MedicationRequest with intent "plan")
      state.meds = state.meds.filter(m => m.source !== 'chart').concat([].concat(meds).filter(m => m && m.resourceType === 'MedicationRequest').map(m => {
        const cc = m.medicationCodeableConcept || {};
        const name = cc.text || (cc.coding || []).map(c => c.display).filter(Boolean)[0] || (m.medicationReference && m.medicationReference.display) || '';
        const dose = (m.dosageInstruction || []).map(d => d.text).filter(Boolean).join('; ');
        return { text: (name + (dose && dose.toLowerCase().indexOf(name.toLowerCase()) < 0 ? ' — ' + dose : '')).trim(), source: 'chart' };
      }).filter(m => m.text));
    }
    const latest = {}, recent = Date.now() - 7 * 864e5;
    [].concat(labs || []).forEach(o => {
      if (!o || o.resourceType !== 'Observation' || o.status === 'entered-in-error') return;
      const k = classify(o); if (!k) return;
      const when = o.effectiveDateTime || o.issued || '';
      if (k === 'trop' || k === 'tsh') { if (when && Date.parse(when) >= recent) { state.pt[k === 'trop' ? 'trop' : 'thyroidTest'] = true; state.src[k] = 'chart ' + when.slice(0, 10); } return; }
      const val = obsValue(o); if (val.v == null) return;
      if (!latest[k] || when > latest[k].when) latest[k] = { v: convert(k, val.v, val.u), when };
    });
    Object.entries(latest).forEach(([k, x]) => { state.pt[k] = x.v; state.src[k] = 'chart ' + (x.when || '').slice(0, 10); });
    if (latest.egfr) state.src.egfrLab = true;
    else if (state.pt.scr) { state.pt.egfr = SUPP.ckdEpi2021(state.pt.scr, state.pt.age, state.pt.sex); if (state.pt.egfr) state.src.egfr = 'calculated CKD-EPI 2021'; }
    if (conds) {
      const found = [];
      [].concat(conds).forEach(c => {
        if (!c || c.resourceType !== 'Condition') return;
        const cs = c.clinicalStatus && ((c.clinicalStatus.coding || [])[0] || {}).code;
        if (cs && !/active|recurrence|relapse/.test(cs)) return;
        const txt = (c.code && (c.code.text || (c.code.coding || []).map(x => x.display).join(' '))) || '';
        COND.forEach(([k, re]) => { if (re.test(txt)) { state.pt[k] = true; found.push(txt); } });
      });
      state.src.conditions = found.length ? 'Ticked from problem list: ' + [...new Set(found)].join('; ') : 'Nothing matched on the problem list – tick manually if relevant.';
    }
    const nMeds = state.meds.filter(m => m.source === 'chart').length;
    setStatus(errs.length ? `Chart loaded with gaps – could not load: ${errs.join(', ')}. ${nMeds} active medications found.` : `Chart loaded: ${nMeds} active medications. Reading recent notes for supplements…`, errs.length ? 'warn' : 'busy');
    renderData(); run();
    try { await scanNotes(client); } catch (e) { state.notesStatus = 'Could not read notes (' + (e.message || e) + ').'; }
    const nS = state.result.supps.length;
    setStatus(`Chart loaded: ${nMeds} active medications, ${nS} supplement${nS === 1 ? '' : 's'} found. ${state.notesStatus} Ask the patient – supplements are often missing from the chart.`, errs.length ? 'warn' : 'ok');
    run();
  }

  // ---------------- notes ----------------
  async function scanNotes(client) {
    const cat = encodeURIComponent('http://hl7.org/fhir/us/core/CodeSystem/us-core-documentreference-category|clinical-note');
    const since = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
    let docs = await withTimeout(client.request(`DocumentReference?patient=${client.patient.id}&category=${cat}&date=ge${since}&_count=50`, { pageLimit: 3, flat: true }), 25000);
    docs = [].concat(docs || []).filter(d => d && d.resourceType === 'DocumentReference' && d.status !== 'entered-in-error');
    const docDate = d => d.date || (d.context && d.context.period && d.context.period.start) || '';
    docs.sort((a, b) => new Date(docDate(b)) - new Date(docDate(a)));
    docs = docs.slice(0, 15);
    let read = 0;
    for (let i = 0; i < docs.length; i += 5) {
      const batch = await Promise.all(docs.slice(i, i + 5).map(async d => ({ d, text: await getText(client, d) })));
      batch.forEach(({ d, text }) => {
        if (!text || text.length < 20 || /^\[/.test(text)) return;
        read++;
        const label = ((d.type && (d.type.text || (d.type.coding || []).map(c => c.display).find(Boolean))) || 'Note') + ' ' + docDate(d).slice(0, 10);
        const r = SUPP.scanText(text, label);
        r.hits.forEach(h => { if (!state.supps.some(s => s.key === h.key && s.source === 'notes')) state.supps.push({ key: h.key, text: h.text, source: 'notes', snippet: h.snippet, label: h.label }); });
        r.other.forEach(o => { if (state.notesOther.length < 6) state.notesOther.push(o); });
      });
    }
    const n = state.supps.filter(s => s.source === 'notes').length;
    state.notesStatus = docs.length ? `${read} of ${docs.length} recent notes read; ${n} supplement${n === 1 ? '' : 's'} named.` : 'No clinical notes in the last 30 days.';
  }
  function pickAttachment(doc) {
    const atts = (doc.content || []).map(c => c.attachment).filter(Boolean);
    for (const p of ['text/plain', 'text/html', 'application/xhtml+xml', 'application/pdf', 'application/xml', 'text/rtf']) {
      const a = atts.find(x => (x.contentType || '').toLowerCase().startsWith(p)); if (a) return a;
    }
    return atts[0];
  }
  const b64ToBytes = b64 => Uint8Array.from(atob(b64.replace(/\s+/g, '')), c => c.charCodeAt(0));
  function htmlToText(html) {
    const d = new DOMParser().parseFromString(html, 'text/html');
    d.querySelectorAll('script,style').forEach(n => n.remove());
    d.querySelectorAll('br').forEach(n => n.replaceWith('\n'));
    d.querySelectorAll('p,div,tr,li,h1,h2,h3,h4,h5,h6').forEach(n => n.append('\n'));
    return (d.body.textContent || '').replace(/\n{3,}/g, '\n\n').trim();
  }
  async function pdfToText(bytes) {
    if (typeof pdfjsLib === 'undefined') return '[PDF reader not loaded]';
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
    const pdf = await pdfjsLib.getDocument({ data: bytes }).promise; const out = [];
    for (let p = 1; p <= pdf.numPages; p++) out.push((await (await pdf.getPage(p)).getTextContent()).items.map(it => it.str + (it.hasEOL ? '\n' : ' ')).join(''));
    return out.join('\n\n');
  }
  async function xmlToText(xml) {
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    if (doc.querySelector('parsererror')) return htmlToText(xml);
    const pdfEl = [...doc.querySelectorAll('*')].find(el => !el.children.length && /^\s*JVBER/.test(el.textContent));
    if (pdfEl) return pdfToText(b64ToBytes(pdfEl.textContent));
    doc.querySelectorAll('*').forEach(el => { if (!el.children.length) el.append('\n'); });
    let text = ((doc.querySelector('document-data') || doc.documentElement).textContent || '').trim();
    if (/<\/?(p|div|br|span|table|html|body)\b[^>]*>/i.test(text)) text = htmlToText(text);
    return text;
  }
  async function getText(client, doc) {
    const att = pickAttachment(doc); if (!att) return '';
    const ct = (att.contentType || '').toLowerCase();
    try {
      let bytes = null;
      if (att.data) bytes = b64ToBytes(att.data);
      else if (att.url) {
        try { await client.refreshIfNeeded(); } catch (e) {}
        const url = new URL(att.url, client.state.serverUrl + '/').href;
        const res = await withTimeout(fetch(url, { headers: { Authorization: 'Bearer ' + client.state.tokenResponse.access_token, Accept: att.contentType || '*/*' } }), 20000);
        if (!res.ok) return '[HTTP ' + res.status + ']';
        bytes = new Uint8Array(await res.arrayBuffer());
      }
      if (!bytes) return '';
      if (ct.startsWith('application/pdf')) return await pdfToText(bytes);
      if (ct.startsWith('image/')) return '';
      const raw = new TextDecoder('utf-8').decode(bytes);
      if (/^\s*<\?xml/i.test(raw) || (ct.includes('xml') && !ct.includes('xhtml'))) return await xmlToText(raw);
      if (ct.includes('html')) return htmlToText(raw);
      return raw;
    } catch (e) { return '[' + (e.message || e) + ']'; }
  }

  // ---------------- made-up patients ----------------
  const DEMOS = {
    1: { name: 'Doris Hip (made up)', reason: 'left hip fracture', pt: { age: 86, sex: 'female', scr: 98, k: 4.1, ca: 2.31, plt: 210, surgery: true, htn: true },
      meds: ['Apixaban 2.5 mg PO BID', 'Levothyroxine 75 mcg PO daily', 'Alendronate 70 mg PO weekly', 'Citalopram 10 mg PO daily', 'Zopiclone 3.75 mg PO HS PRN', 'Hydromorphone 0.5 mg PO q4h PRN', 'Calcium carbonate 500 mg + vitamin D3 400 IU PO BID'],
      supps: [{ key: 'ginkgo', text: 'Ginkgo 120 mg daily', source: 'patient' }, { key: 'fishoil', text: 'Fish oil 1000 mg BID', source: 'patient' }, { key: 'melatonin', text: 'Melatonin 5 mg HS', source: 'patient' },
        { key: 'turmeric', text: 'turmeric 500 mg', source: 'notes', snippet: 'daughter reports she also takes turmeric 500 mg daily for her knees and ginkgo for memory', label: 'ED note (made up)' }] },
    2: { name: 'Ray Transplant (made up)', reason: 'diarrhea and AKI', pt: { age: 58, sex: 'male', scr: 190, k: 5.3, alt: 30, transplant: true, htn: true },
      meds: ['Tacrolimus (Advagraf) 6 mg PO daily', 'Mycophenolate mofetil 750 mg PO BID', 'Prednisone 5 mg PO daily', 'Ramipril 5 mg PO daily', 'Sulfamethoxazole-trimethoprim 400/80 mg PO daily'],
      supps: [{ key: 'sjw', text: "St John's wort 300 mg TID (started 3 weeks ago for low mood)", source: 'patient' }, { key: 'echinacea', text: 'Echinacea for colds', source: 'patient' }, { key: 'potassium', text: 'NoSalt salt substitute', source: 'patient' }, { key: 'probiotic', text: 'Probiotic daily', source: 'patient' }] },
    3: { name: 'Walter Warfarin (made up)', reason: 'pneumonia, INR 4.6', pt: { age: 79, sex: 'male', scr: 110, inr: 4.6, k: 4.0 },
      meds: ['Warfarin 5 mg PO daily (Mon-Fri), 2.5 mg Sat-Sun', 'Ciprofloxacin 500 mg PO BID', 'Metoprolol 25 mg PO BID', 'Atorvastatin 40 mg PO daily'],
      supps: [{ key: 'glucosamine', text: 'Glucosamine-chondroitin 1500 mg daily', source: 'patient' }, { key: 'cranberry', text: 'Cranberry capsules', source: 'patient' }, { key: 'coq10', text: 'CoQ10 100 mg', source: 'patient' }, { key: 'mvi', text: 'Centrum Silver daily', source: 'patient' }, { key: 'magnesium', text: 'Magnesium oxide 400 mg HS', source: 'patient' }, { key: 'dongquai', text: 'Dong quai (wife’s)', source: 'patient' }] },
    4: { name: 'Gloria Chest Pain (made up)', reason: 'chest pain, troponin pending', pt: { age: 64, sex: 'female', scr: 80, k: 3.1, trop: true, htn: true },
      meds: ['Atorvastatin 80 mg PO daily', 'Clarithromycin 500 mg PO BID', 'Furosemide 40 mg PO daily', 'Digoxin 0.0625 mg PO daily', 'ASA 81 mg PO daily'],
      supps: [{ key: 'biotin', text: 'Biotin 10 mg (hair, skin and nails)', source: 'patient' }, { key: 'redyeast', text: 'Red yeast rice 600 mg BID', source: 'patient' }, { key: 'licorice', text: 'Licorice root tea several cups a day', source: 'patient' }] },
    5: { name: 'Henry CKD (made up)', reason: 'hyperkalemia', pt: { age: 74, sex: 'male', scr: 230, k: 5.6, mg: 1.15, hf: true, htn: true },
      meds: ['Ramipril 10 mg PO daily', 'Spironolactone 25 mg PO daily', 'Furosemide 40 mg PO BID', 'Levothyroxine 100 mcg PO daily'],
      supps: [{ key: 'potassium', text: 'Potassium gluconate 595 mg OTC', source: 'patient' }, { key: 'magnesium', text: 'Magnesium citrate 300 mg', source: 'patient' }, { key: 'vitc', text: 'Vitamin C 2000 mg daily', source: 'patient' }, { key: 'iron', text: 'Ferrous gluconate 300 mg daily', source: 'patient' }, { key: 'iodine', text: 'Kelp tablets', source: 'patient' }] },
    6: { name: 'Nadia Mood (made up)', reason: 'confusion and tremor', pt: { age: 46, sex: 'female', scr: 70, alt: 210, liver: false },
      meds: ['Sertraline 150 mg PO daily', 'Tramadol 50 mg PO q6h PRN', 'Lorazepam 1 mg PO HS', 'Ethinyl estradiol / levonorgestrel daily', 'Apixaban 5 mg PO BID'],
      supps: [{ key: 'sjw', text: "St John's wort", source: 'patient' }, { key: 'fivehtp', text: '5-HTP 100 mg', source: 'patient' }, { key: 'kava', text: 'Kava for anxiety', source: 'patient' }, { key: 'cbd', text: 'CBD oil 25 mg HS', source: 'patient' }, { key: 'ashwagandha', text: 'Ashwagandha', source: 'patient' }, { key: 'greentea', text: 'Green tea extract (weight loss)', source: 'patient' }] }
  };

  async function start() {
    const dm = location.search.match(/[?&]demo=(\d+)/);
    if (dm && DEMOS[dm[1]]) {
      const d = DEMOS[dm[1]];
      state.mode = 'demo';
      state.patient = { name: d.name, mrn: '0000000' };
      state.meds = d.meds.map(text => ({ text, source: 'chart' }));
      state.supps = d.supps.map(s => Object.assign({}, s));
      Object.assign(state.pt, d.pt);
      state.consult.reason = d.reason;
      if (state.pt.scr) { state.pt.egfr = SUPP.ckdEpi2021(state.pt.scr, state.pt.age, state.pt.sex); state.src.egfr = 'calculated CKD-EPI 2021'; }
      $('#ptBanner').textContent = 'DEMO ' + dm[1] + ' – made-up patient';
      setStatus('Demo ' + dm[1] + ' – made-up patient (' + d.name + '). Other demos: ?demo=1 to 6.', 'warn');
    } else if (window.FHIR) {
      renderData(); run();
      setStatus('Connecting to the chart…', 'busy');
      let client = null;
      try { client = await withTimeout(FHIR.oauth2.ready(), 15000); } catch (e) { client = null; }
      if (client) {
        try { await loadFHIR(client); } catch (e) { setStatus('Could not read the chart (' + (e.message || e) + ') – add supplements and paste meds on the Supplements tab.', 'warn'); }
      } else {
        state.mode = 'manual';
        setStatus('Not launched from Cerner – manual mode: add supplements and paste the medication list on the Supplements tab (or add ?demo=1 … 6 for a made-up patient).', 'warn');
      }
    } else {
      setStatus('SMART library not loaded – manual mode.', 'warn');
    }
    renderData();
    run();
    if (state.mode === 'manual') document.querySelector('[data-tab="supps"]').click();
  }
  window.addEventListener('error', e => setStatus('Script error: ' + e.message + ' – please report this.', 'warn'));
  start();
})();
