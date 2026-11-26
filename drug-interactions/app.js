/* Drug interactions tab – UI + FHIR loading. Rules live in rules.js (window.DDI). */
(function () {
  'use strict';
  const $ = s => document.querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const SEVS = ['Contraindicated', 'High', 'Moderate', 'Low'];
  const SEV_COLOR = { Contraindicated: '#7a0b2e', High: '#b42318', Moderate: '#b54708', Low: '#1f6f43' };
  const CAT_LABEL = { qt: 'QT', ss: 'Serotonin', sz: 'Seizure' };

  const state = {
    mode: 'manual',
    patient: { name: '', mrn: '' },
    meds: [],            // {text, source:'chart'|'manual'|'proposed'}
    pt: { age: null, sex: '', qtc: null, k: null, mg: null, ca: null, ica: null, hr: null, egfr: null, scr: null, na: null, glucose: null, hf: false, ami: false, sepsis: false, seizureHx: false, withdrawal: false, longQT: false },
    src: {},             // field -> "chart 2026-11-25" etc.
    hunter: {},
    consult: { to: 'Pharmacy', drName: '', reason: '', dirty: false, text: '' },
    refSel: { qt: 'monitor', ss: 'manage', sz: 'manage' },
    result: null
  };

  // ---------------- tabs ----------------
  document.querySelectorAll('#tabs button').forEach(b => b.addEventListener('click', () => {
    document.querySelectorAll('#tabs button').forEach(x => x.classList.toggle('active', x === b));
    document.querySelectorAll('.panel').forEach(p => p.classList.toggle('active', p.id === 'p-' + b.dataset.tab));
    window.scrollTo(0, 0);
  }));

  // ---------------- helpers ----------------
  const openState = {};   // remembers which sections the user opened/closed across re-renders
  function sec(title, inner, open = true, extra = '') {
    const key = title.replace(/\s*\(\d+\)$/, '');
    const isOpen = key in openState ? openState[key] : open;
    return `<details data-key="${esc(key)}" ${isOpen ? 'open' : ''}><summary>${title}${extra}</summary><div class="body">${inner}</div></details>`;
  }
  document.addEventListener('toggle', e => { const k = e.target.dataset && e.target.dataset.key; if (k) openState[k] = e.target.open; }, true);
  function findingHTML(f, showCat) {
    return `<div class="find ${f.sev}"><h4><span class="sev ${f.sev}">${f.sev}</span>${esc(f.title)}${showCat ? `<span class="catTag">${CAT_LABEL[f.cat]}</span>` : ''}</h4>
      <div class="drugs">${esc(f.drugNames.join(' · '))}</div>
      ${f.why ? `<p>${esc(f.why)}</p>` : ''}${f.todo ? `<p><b>Do:</b> ${esc(f.todo)}</p>` : ''}</div>`;
  }
  function findingsBlock(list, showCat) {
    return list.length ? list.map(f => findingHTML(f, showCat)).join('') : '<div class="empty">✓ No interactions flagged in this category.</div>';
  }
  function chips(d) {
    let h = '';
    if (d.qt) h += `<span class="chip qt">QT ${d.qt}</span>`;
    if (d.ss) h += `<span class="chip ss">5-HT ${d.ss.replace('_weak', ' (weak)')}</span>`;
    if (d.sz) h += `<span class="chip sz">Seizure ${d.sz}</span>`;
    return h;
  }
  function drugTable(rows, noteKey) {
    if (!rows.length) return '<p class="muted">None on the current list.</p>';
    return `<table><tr><th>Drug</th><th>Order text</th><th>Risk</th><th>Notes / alternative</th></tr>${rows.map(x => `<tr>
      <td><b>${esc(x.drug.name)}</b><div class="small muted">${esc(x.drug.cls || '')}</div>${x.proposed ? '<div class="small" style="color:#b54708">proposed</div>' : ''}</td>
      <td class="small">${esc(x.text)}</td><td>${chips(x.drug)}</td>
      <td class="small">${esc(x.drug[noteKey] || '')}${x.drug.alt ? `<div><b>Alt:</b> ${esc(x.drug.alt)}</div>` : ''}</td></tr>`).join('')}</table>`;
  }
  function refBlock(cat, options) {
    const cur = state.refSel[cat];
    return `<div class="row"><select data-ref="${cat}">${Object.keys(options).map(k => `<option value="${k}" ${k === cur ? 'selected' : ''}>${esc(options[k].label)}</option>`).join('')}</select></div>
      <div class="ref">${options[cur].html}</div>`;
  }
  function badge(id, list) {
    const el = $(id); if (!el) return;
    const worst = SEVS.find(s => list.some(f => f.sev === s));
    const n = list.filter(f => f.sev !== 'Low').length;
    el.textContent = n || (list.length ? list.length : '');
    el.style.background = worst ? SEV_COLOR[worst] : 'transparent';
  }

  // ---------------- reference content ----------------
  const REF_QT = {
    monitor: { label: 'Monitoring', html: `<ul>
      <li>Prolonged QTc: &gt;470 ms (men), &gt;480 ms (women); <b>≥500 ms</b> or rise of <b>&gt;60 ms</b> from baseline = high risk.</li>
      <li>Baseline ECG before a known-TdP drug when other risk factors are present; repeat at steady state or after IV doses / dose increases.</li>
      <li>Keep K ≥4.0 mmol/L and Mg ≥0.8 mmol/L. Avoid bradycardia.</li>
      <li>Use the same lead and correction formula when comparing; Fridericia is better than Bazett at HR &gt;90 or &lt;60. Wide QRS (BBB/paced) overestimates QTc.</li>
      <li>Telemetry if QTc ≥500 ms on a QT drug, or after TdP.</li></ul>` },
    tdp: { label: 'Torsades management', html: `<ul>
      <li>Unstable / pulseless: defibrillate (ACLS).</li>
      <li><b>Magnesium sulfate 2 g IV</b> over 1–2 min if pulseless, or over 15 min if stable; may repeat once. Effective even when Mg is normal.</li>
      <li>Stop all QT-prolonging drugs; correct K to 4.5–5.0 mmol/L.</li>
      <li>Recurrent pause-dependent TdP: increase heart rate – temporary overdrive pacing (~90–110/min) or isoproterenol as a bridge (avoid in congenital long QT).</li>
      <li>Cardiology consult.</li></ul>` },
    alts: { label: 'Common lower-QT alternatives', html: `<table><tr><th>Instead of</th><th>Consider</th></tr>
      <tr><td>Azithromycin / clarithromycin (atypical cover)</td><td>Doxycycline</td></tr>
      <tr><td>Citalopram / escitalopram</td><td>Sertraline</td></tr>
      <tr><td>Fluoroquinolone</td><td>Depends on the site – antibiotic chooser / ID</td></tr>
      <tr><td>Fluconazole</td><td>Echinocandin when appropriate</td></tr>
      <tr><td>IV haloperidol for delirium</td><td>Non-drug measures; lowest dose; ECG if repeated dosing</td></tr>
      <tr><td>IV ondansetron high dose</td><td>Lower dose / PO; dimenhydrinate (sedation) if appropriate</td></tr>
      <tr><td>Domperidone</td><td>Short course metoclopramide (if no Parkinson disease)</td></tr></table>` },
    tis: { label: 'About the Tisdale score', html: `<p>Validated in cardiac-unit inpatients to predict QTc prolongation (&gt;500 ms or ↑&gt;60 ms). ≤6 low, 7–10 moderate, ≥11 high. Tisdale JE et al., <i>Circ Cardiovasc Qual Outcomes</i> 2013;6:479-87. Use as a guide only outside cardiac units.</p>` }
  };
  const REF_SS = {
    manage: { label: 'Management', html: `<ul>
      <li>Stop all serotonergic drugs. Most cases resolve within 24 h (longer with fluoxetine, MAOIs, long-acting drugs).</li>
      <li>Supportive care, IV fluids, continuous monitoring. <b>Benzodiazepines</b> for agitation and tremor; avoid physical restraints.</li>
      <li><b>Cyproheptadine</b> (moderate cases): 12 mg PO/NG, then 2 mg q2h while symptoms continue; maintenance 8 mg q6h. Tablets only (crush for NG).</li>
      <li>Temp &gt;41.1 °C or severe rigidity: ICU, sedation, paralysis with a non-depolarizing agent, intubation. Antipyretics don't help (heat comes from muscle activity).</li>
      <li>Avoid: succinylcholine, physical restraints, antipsychotics with anticholinergic or NMS potential, propranolol, bromocriptine, dantrolene.</li></ul>` },
    ddx: { label: 'SS vs NMS vs anticholinergic', html: `<table><tr><th></th><th>Serotonin syndrome</th><th>NMS</th><th>Anticholinergic</th></tr>
      <tr><td>Onset</td><td>&lt;24 h (hours)</td><td>Days–weeks</td><td>Hours</td></tr>
      <tr><td>Neuromuscular</td><td>Clonus, hyperreflexia, tremor (legs &gt; arms)</td><td>"Lead-pipe" rigidity, bradyreflexia</td><td>Normal</td></tr>
      <tr><td>Pupils</td><td>Dilated</td><td>Normal</td><td>Dilated</td></tr>
      <tr><td>Skin</td><td>Diaphoresis</td><td>Diaphoresis</td><td>Hot, dry, red</td></tr>
      <tr><td>Bowel</td><td>Hyperactive, diarrhea</td><td>Normal/↓</td><td>↓ / absent, retention</td></tr>
      <tr><td>Trigger</td><td>Serotonergic drugs</td><td>Dopamine antagonist / stopping a dopamine agonist</td><td>Anticholinergic drugs</td></tr></table>` },
    washout: { label: 'Washout periods', html: `<ul>
      <li>SSRI/SNRI → MAOI: wait 2 weeks (<b>5 weeks after fluoxetine</b>).</li>
      <li>MAOI → any serotonergic drug: wait 2 weeks (moclobemide: ~24–48 h).</li>
      <li>Linezolid: MAO inhibition is reversible; serotonergic drug can restart ~24 h after the last linezolid dose.</li>
      <li>Avoid starting or increasing two serotonergic drugs at the same time.</li></ul>` }
  };
  const REF_SZ = {
    manage: { label: 'Drug-induced seizure management', html: `<ul>
      <li><b>Benzodiazepines first line</b> (lorazepam 4 mg IV, repeat once; or midazolam IM). Second line: phenobarbital or propofol.</li>
      <li>Phenytoin works poorly for toxin-induced seizures and should not be used for theophylline toxicity.</li>
      <li>Check and correct glucose, Na, Ca, Mg; check drug levels (theophylline, lithium, AEDs); review renal dosing.</li>
      <li>Persistent confusion after a seizure, or myoclonus on a β-lactam: get an <b>EEG</b> for non-convulsive status.</li></ul>` },
    specific: { label: 'Specific drugs', html: `<ul>
      <li><b>Isoniazid:</b> pyridoxine 1 g IV per g of INH ingested (5 g if unknown).</li>
      <li><b>Cefepime neurotoxicity:</b> stop or reduce dose; hemodialysis clears it in severe cases.</li>
      <li><b>Carbapenem + valproate:</b> switch antibiotic or bridge with another AED (e.g. levetiracetam); a higher VPA dose won't restore levels.</li>
      <li><b>Tramadol/bupropion:</b> seizures are dose-related and may occur at therapeutic doses; stop the drug.</li>
      <li><b>Theophylline:</b> early hemodialysis for seizures/high levels; avoid phenytoin.</li>
      <li><b>Clozapine:</b> seizure risk rises with dose/level; levels rise when the patient stops smoking in hospital.</li></ul>` },
    hx: { label: 'Patient factors that lower threshold', html: `<ul><li>Epilepsy/prior seizure, structural brain lesion, recent stroke/TBI</li><li>Na &lt;125, glucose &lt;3.0, low Ca/Mg, uremia, hepatic encephalopathy</li><li>Alcohol, benzodiazepine, barbiturate or baclofen withdrawal</li><li>Sleep deprivation, fever, missed AEDs (NPO, held meds)</li></ul>` }
  };

  // ---------------- Hunter criteria ----------------
  const HUNTER = [['sponClonus', 'Spontaneous clonus'], ['indClonus', 'Inducible clonus'], ['ocClonus', 'Ocular clonus'], ['agitation', 'Agitation'], ['diaph', 'Diaphoresis'], ['tremor', 'Tremor'], ['hyperref', 'Hyperreflexia'], ['hypertonia', 'Hypertonia'], ['temp', 'Temperature >38 °C']];
  function hunterResult(hasAgent) {
    const h = state.hunter;
    const ad = h.agitation || h.diaph;
    const pos = h.sponClonus || (h.indClonus && ad) || (h.ocClonus && ad) || (h.tremor && h.hyperref) || (h.hypertonia && h.temp && (h.ocClonus || h.indClonus));
    if (!Object.values(h).some(Boolean)) return '';
    if (!hasAgent) return '<div class="verdict neg">No serotonergic drug on the list – Hunter criteria need serotonergic exposure.</div>';
    return pos ? '<div class="verdict pos">Meets Hunter criteria for serotonin toxicity (sensitivity 84%, specificity 97%).</div>' : '<div class="verdict neg">Does not meet Hunter criteria. Reassess if symptoms change.</div>';
  }

  // ---------------- consult + note ----------------
  const ASK = {
    Pharmacy: 'Could you review for safer alternatives and dosing?',
    Cardiology: 'Would appreciate your advice on QT risk and monitoring.',
    Psychiatry: 'Could you advise on adjusting the psychiatric medications?',
    Neurology: 'Could you advise on seizure risk and antiseizure management?',
    'Internal medicine': 'Would appreciate your advice on management.'
  };
  function buildConsult(r) {
    const c = state.consult, p = state.patient, pt = state.pt;
    const top = r.findings.filter(f => f.sev !== 'Low').slice(0, 2);
    const who = [p.name || '[name]', pt.age ? pt.age + (pt.sex ? pt.sex[0].toUpperCase() : '') : '[age]', 'MRN ' + (p.mrn || '[MRN]')].join(', ');
    const concern = top.length ? top.map(f => f.title + ' (' + f.drugNames.join(', ') + ')').join('; ') : 'possible drug interaction';
    const vals = [pt.qtc ? 'QTc ' + pt.qtc + ' ms' : '', pt.k ? 'K ' + pt.k : '', pt.egfr ? 'eGFR ' + pt.egfr : ''].filter(Boolean).join(', ');
    return `Hello ${c.to === 'Pharmacy' ? (c.drName || '___') : 'Dr. ' + (c.drName || '___')}, This is Wayne, hospitalist. I have ${who}${c.reason ? ', admitted with ' + c.reason : ''}. Concern: ${concern}${vals ? '. ' + vals : ''}. ${ASK[c.to]} Your help is much appreciated. Thanks, Wayne`;
  }
  function buildNote(r) {
    const lines = ['Drug interaction review (QT / serotonin / seizure threshold):'];
    const fs = r.findings.filter(f => f.sev !== 'Low');
    if (!fs.length) lines.push('- No significant interactions flagged on current medication list.');
    fs.forEach(f => lines.push(`- [${f.sev}] ${CAT_LABEL[f.cat]}: ${f.title} (${f.drugNames.join(', ')}). Plan: ${f.todo || ''}`));
    const pt = state.pt;
    lines.push(`QTc: ${pt.qtc ? pt.qtc + ' ms' : 'not available'}; K ${pt.k ?? '–'}; Mg ${pt.mg ?? '–'}; eGFR ${pt.egfr ?? '–'}. Tisdale QT risk score ${r.qt.tisdale.score} (${r.qt.tisdale.band}).`);
    return lines.join('\n');
  }

  // ---------------- render ----------------
  function run() {
    state.result = DDI.analyze({ meds: state.meds.map(m => ({ text: m.text, proposed: m.source === 'proposed' })), pt: state.pt });
    render();
  }
  function render() {
    const r = state.result, all = r.findings;
    const byCat = c => all.filter(f => f.cat === c);
    badge('#b-all', all); badge('#b-qt', byCat('qt')); badge('#b-ss', byCat('ss')); badge('#b-sz', byCat('sz'));

    // Summary
    const counts = SEVS.map(s => `<span class="sev ${s}">${all.filter(f => f.sev === s).length} ${s}</span>`).join(' ');
    const overlap = r.meds.filter(x => [x.drug.qt, x.drug.ss, x.drug.sz].filter(Boolean).length >= 2);
    if (!state.consult.dirty) state.consult.text = buildConsult(r);
    $('#p-summary').innerHTML =
      sec('Findings', `<div class="row">${counts}</div><p class="small muted">${r.meds.length} medications recognized, ${r.unmatched.length} not in the rule set (see Med list).</p>${findingsBlock(all.filter(f => f.sev !== 'Low'), true)}
        ${all.some(f => f.sev === 'Low') ? sec('Low-priority notes (' + all.filter(f => f.sev === 'Low').length + ')', findingsBlock(all.filter(f => f.sev === 'Low'), true), false) : ''}`) +
      sec('Drugs in more than one risk group', overlap.length ? `<table>${overlap.map(x => `<tr><td><b>${esc(x.drug.name)}</b></td><td>${chips(x.drug)}</td></tr>`).join('')}</table>` : '<p class="muted">None.</p>', overlap.length > 0) +
      sec('Check a drug before ordering', `<div class="row"><input id="propIn" list="drugList" placeholder="Type a drug (e.g. linezolid)" style="flex:1;min-width:220px;padding:6px;border:1px solid #dde1e7;border-radius:5px;font:inherit">
          <button class="act" id="propAdd">Add as proposed</button></div>
          <datalist id="drugList">${DDI.DRUGS.map(d => d.name).sort().map(n => `<option value="${esc(n)}">`).join('')}</datalist>
          ${state.meds.filter(m => m.source === 'proposed').map((m) => `<span class="chip sz">${esc(m.text)} <a href="#" data-rmprop="${esc(m.text)}">✕</a></span>`).join('')}`) +
      sec('Consult message', `<div class="grid">
          <label class="f">To<select id="cTo">${Object.keys(ASK).map(k => `<option ${k === state.consult.to ? 'selected' : ''}>${k}</option>`).join('')}</select></label>
          <label class="f">Name<input id="cName" value="${esc(state.consult.drName)}" placeholder="___"></label>
          <label class="f">Admitted with<input id="cReason" value="${esc(state.consult.reason)}" placeholder="e.g. pneumonia"></label></div>
          <textarea id="cText" rows="4" style="margin-top:8px">${esc(state.consult.text)}</textarea>
          <div class="row"><button class="act" data-copy="cText">Copy message</button><button class="sec" id="cRegen">Regenerate</button><span class="small muted" id="cWords"></span></div>`, false) +
      sec('Copy to note', `<textarea id="noteText" rows="7">${esc(buildNote(r))}</textarea><div class="row"><button class="act" data-copy="noteText">Copy to clipboard</button></div>`, false);
    const wc = $('#cWords'); if (wc) wc.textContent = state.consult.text.split(/\s+/).filter(Boolean).length + ' words';

    // QT
    const q = r.qt, t = q.tisdale;
    $('#p-qt').innerHTML =
      sec('QT findings', findingsBlock(byCat('qt'))) +
      sec('QT-prolonging drugs on the list', drugTable(q.drugs, 'qtNote')) +
      sec('QT risk factors', `<p><b>QTc:</b> ${q.qtc ? q.qtc + ' ms' + (q.qtc500 ? ' <span class="sev High">≥500</span>' : q.qtcProlonged ? ' <span class="sev Moderate">prolonged</span>' : '') : '<span class="muted">not available – enter on Patient data tab</span>'}
        <span class="small muted">(prolonged cut-off ${q.qtcProlongCut} ms for this patient)</span></p>
        ${q.risks.length ? '<ul>' + q.risks.map(x => `<li>${esc(x)}</li>`).join('') + '</ul>' : '<p class="muted">None identified.</p>'}`) +
      sec('Tisdale QT risk score', `<div class="row"><span class="score">${t.score}</span><span class="sev ${t.band === 'Low' ? 'Low' : t.band}">${t.band} risk</span><span class="small muted">≤6 low · 7–10 moderate · ≥11 high</span></div>
        <table>${t.items.map(i => `<tr><td class="${i.on ? 'ok' : 'no'}">${i.on ? '✓' : '✗'}</td><td>${esc(i.label)}</td><td>${i.pts}</td></tr>`).join('')}</table>
        <p class="small muted">Items come from the Patient data tab – edit there to recalculate.</p>`, true) +
      sec('QT reference', refBlock('qt', REF_QT), false);

    // Serotonin
    $('#p-ss').innerHTML =
      sec('Serotonin findings', findingsBlock(byCat('ss'))) +
      sec('Serotonergic drugs on the list', drugTable(r.ss.drugs, 'ssNote')) +
      sec('Hunter criteria (bedside check)', `<div class="grid">${HUNTER.map(([k, l]) => `<label class="cb"><input type="checkbox" data-hunter="${k}" ${state.hunter[k] ? 'checked' : ''}>${l}</label>`).join('')}</div>${hunterResult(r.ss.drugs.length > 0)}`, false) +
      sec('Serotonin reference', refBlock('ss', REF_SS), false);

    // Seizure
    $('#p-sz').innerHTML =
      sec('Seizure-threshold findings', findingsBlock(byCat('sz'))) +
      sec('Seizure-threshold-lowering drugs on the list', drugTable(r.sz.drugs, 'szNote')) +
      sec('Seizure risk factors', r.sz.risks.length ? '<ul>' + r.sz.risks.map(x => `<li>${esc(x)}</li>`).join('') + '</ul>' : '<p class="muted">None identified.</p>') +
      sec('Seizure reference', refBlock('sz', REF_SZ), false);

    // Med list
    $('#p-meds').innerHTML =
      sec('Recognized medications (' + r.meds.length + ')', r.meds.length ? `<table><tr><th>Drug</th><th>Order text</th><th>Groups</th></tr>${r.meds.map(x => `<tr><td><b>${esc(x.drug.name)}</b>${x.proposed ? ' <span class="small" style="color:#b54708">proposed</span>' : ''}</td><td class="small">${esc(x.text)}</td><td>${chips(x.drug) || '<span class="small muted">interaction partner only</span>'}</td></tr>`).join('')}</table>` : '<p class="muted">No medications yet.</p>') +
      sec('Not in the rule set (' + r.unmatched.length + ')', r.unmatched.length ? '<ul class="small">' + r.unmatched.map(u => `<li>${esc(u)}</li>`).join('') + '</ul><p class="small muted">Not checked here – use Lexicomp/pharmacy for full interaction checking.</p>' : '<p class="muted">None.</p>', r.unmatched.length > 0 && r.unmatched.length < 15) +
      sec('Paste or type a medication list', `<textarea id="manualMeds" rows="8" placeholder="One medication per line (paste from PowerChart, the MAR or PharmaNet)">${esc(state.meds.filter(m => m.source === 'manual').map(m => m.text).join('\n'))}</textarea>
        <div class="row"><button class="act" id="useManual">Check this list</button><span class="small muted">${state.mode === 'fhir' ? 'Added to the chart medications.' : ''}</span></div>`, state.mode !== 'fhir');
  }

  // ---------------- patient data panel (rendered once, updated in place) ----------------
  const NUM_FIELDS = [['age', 'Age (y)'], ['qtc', 'QTc (ms)'], ['hr', 'Heart rate'], ['k', 'K (mmol/L)'], ['mg', 'Mg (mmol/L)'], ['ca', 'Total Ca (mmol/L)'], ['ica', 'Ionized Ca (mmol/L)'], ['na', 'Na (mmol/L)'], ['glucose', 'Glucose (mmol/L)'], ['scr', 'Creatinine (µmol/L)'], ['egfr', 'eGFR (mL/min/1.73m²)']];
  const BOOL_FIELDS = [['hf', 'Heart failure'], ['ami', 'Acute MI'], ['sepsis', 'Sepsis'], ['longQT', 'Congenital long QT / prior TdP'], ['seizureHx', 'Seizure disorder / epilepsy'], ['withdrawal', 'Alcohol / benzodiazepine withdrawal']];
  function renderData() {
    $('#p-data').innerHTML =
      sec('Labs, ECG and demographics', `<div class="grid">
        <label class="f">Sex<select data-f="sex"><option value="">–</option><option value="female" ${state.pt.sex === 'female' ? 'selected' : ''}>Female</option><option value="male" ${state.pt.sex === 'male' ? 'selected' : ''}>Male</option></select><span class="src">${esc(state.src.sex || '')}</span></label>
        ${NUM_FIELDS.map(([k, l]) => `<label class="f">${l}<input type="number" step="any" data-f="${k}" value="${state.pt[k] ?? ''}"><span class="src">${esc(state.src[k] || '')}</span></label>`).join('')}</div>
        <p class="small muted">Chart values are the most recent in the last 30 days. QTc is often only in the ECG report – type it in. eGFR is calculated (CKD-EPI 2021) from creatinine if no eGFR result is found.</p>`) +
      sec('Conditions', `<div class="grid">${BOOL_FIELDS.map(([k, l]) => `<label class="cb"><input type="checkbox" data-f="${k}" ${state.pt[k] ? 'checked' : ''}>${l}</label>`).join('')}</div>
        <p class="small muted">${esc(state.src.conditions || 'Tick from the problem list / admission diagnosis.')}</p>`);
  }

  // ---------------- events ----------------
  document.addEventListener('input', e => {
    const f = e.target.dataset.f;
    if (f) {
      if (e.target.type === 'checkbox') state.pt[f] = e.target.checked;
      else if (e.target.type === 'number') state.pt[f] = e.target.value === '' ? null : parseFloat(e.target.value);
      else state.pt[f] = e.target.value;
      if ((f === 'scr' || f === 'age' || f === 'sex') && state.pt.scr && !state.src.egfrLab) {
        state.pt.egfr = DDI.ckdEpi2021(state.pt.scr, state.pt.age, state.pt.sex);
        state.src.egfr = state.pt.egfr ? 'calculated CKD-EPI 2021' : '';
        const el = document.querySelector('[data-f="egfr"]'); if (el) el.value = state.pt.egfr ?? '';
      }
      return run();
    }
    if (e.target.id === 'cText') { state.consult.text = e.target.value; state.consult.dirty = true; const wc = $('#cWords'); if (wc) wc.textContent = e.target.value.split(/\s+/).filter(Boolean).length + ' words'; }
    if (e.target.id === 'cName' || e.target.id === 'cReason') {
      state.consult[e.target.id === 'cName' ? 'drName' : 'reason'] = e.target.value; state.consult.dirty = false;
      state.consult.text = buildConsult(state.result); $('#cText').value = state.consult.text;
    }
  });
  document.addEventListener('change', e => {
    if (e.target.dataset.hunter) { state.hunter[e.target.dataset.hunter] = e.target.checked; render(); }
    if (e.target.dataset.ref) { state.refSel[e.target.dataset.ref] = e.target.value; render(); }
    if (e.target.id === 'cTo') { state.consult.to = e.target.value; state.consult.dirty = false; render(); }
  });
  document.addEventListener('click', e => {
    const t = e.target;
    if (t.id === 'propAdd') {
      const v = $('#propIn').value.trim(); if (!v) return;
      state.meds.push({ text: v, source: 'proposed' }); run();
    }
    if (t.dataset && t.dataset.rmprop) { e.preventDefault(); state.meds = state.meds.filter(m => !(m.source === 'proposed' && m.text === t.dataset.rmprop)); run(); }
    if (t.id === 'useManual') {
      const lines = $('#manualMeds').value.split(/\n|;/).map(s => s.trim()).filter(Boolean);
      state.meds = state.meds.filter(m => m.source !== 'manual').concat(lines.map(text => ({ text, source: 'manual' })));
      run();
    }
    if (t.id === 'cRegen') { state.consult.dirty = false; render(); }
    if (t.dataset && t.dataset.copy) {
      const el = document.getElementById(t.dataset.copy);
      (navigator.clipboard ? navigator.clipboard.writeText(el.value) : Promise.reject()).then(() => { t.textContent = 'Copied ✓'; setTimeout(() => t.textContent = t.dataset.copy === 'cText' ? 'Copy message' : 'Copy to clipboard', 1500); })
        .catch(() => { el.select(); document.execCommand('copy'); });
    }
  });
  document.addEventListener('keydown', e => { if (e.target.id === 'propIn' && e.key === 'Enter') $('#propAdd').click(); });

  // ---------------- FHIR ----------------
  const LABS = {
    qtc: { loinc: ['8636-3', '8634-8'], re: /\bqtc\b|qt\s*corr|corrected\s*qt/i },
    hr: { loinc: ['8867-4'], re: /heart rate|pulse rate|^pulse$/i },
    k: { loinc: ['2823-3', '6298-4', '77142-8', '32713-0'], re: /^potassium|potassium,? (serum|plasma|blood|level)|^k\b/i },
    mg: { loinc: ['19123-9', '2601-3'], re: /magnesium/i },
    ica: { loinc: ['1994-3', '17863-2', '1995-0'], re: /ioni[sz]ed calcium|calcium,? ioni[sz]ed|\bica\b/i },
    ca: { loinc: ['17861-6', '2000-8', '49765-1'], re: /^calcium(?!.*ioni)|calcium,? total/i },
    na: { loinc: ['2951-2', '2947-0', '32717-1'], re: /^sodium|sodium,? (serum|plasma|blood|level)|^na\b/i },
    glucose: { loinc: ['2345-7', '2339-0', '41653-7', '15074-8', '14749-6'], re: /glucose/i },
    scr: { loinc: ['2160-0', '14682-9', '38483-4'], re: /^creatinine(?!.*(clear|ratio|urine))/i },
    egfr: { loinc: ['33914-3', '48642-3', '48643-1', '62238-1', '69405-9', '98979-8', '50044-7'], re: /egfr|glomerular filtration/i }
  };
  const EXCLUDE = /urine|\bur\b|csf|fluid|24\s*h|random ur/i;
  function obsValue(o) {
    if (o.valueQuantity && typeof o.valueQuantity.value === 'number') return { v: o.valueQuantity.value, u: (o.valueQuantity.unit || o.valueQuantity.code || '').toLowerCase() };
    if (typeof o.valueString === 'string') { const m = o.valueString.match(/-?\d+(\.\d+)?/); if (m) return { v: parseFloat(m[0]), u: '' }; }
    return null;
  }
  function convert(key, v, u) {
    if (key === 'mg' && /mg\/dl/.test(u)) return +(v / 2.43).toFixed(2);
    if ((key === 'ca' || key === 'ica') && /mg\/dl/.test(u)) return +(v / 4.008).toFixed(2);
    if (key === 'glucose' && /mg\/dl/.test(u)) return +(v / 18).toFixed(1);
    if (key === 'scr' && /mg\/dl/.test(u)) return Math.round(v * 88.4);
    return v;
  }
  function classify(o) {
    const codes = ((o.code && o.code.coding) || []).map(c => c.code);
    const text = ((o.code && (o.code.text || (o.code.coding || []).map(c => c.display).join(' '))) || '');
    for (const k of Object.keys(LABS)) {
      if (codes.some(c => LABS[k].loinc.includes(c))) return k;
    }
    if (EXCLUDE.test(text)) return null;
    for (const k of Object.keys(LABS)) if (LABS[k].re.test(text.trim())) return k;
    return null;
  }
  const COND = [['hf', /heart failure|\bchf\b|hfref|hfpef|cardiomyopathy/i], ['ami', /myocardial infarction|\bstemi\b|\bnstemi\b|acute coronary/i], ['sepsis', /sepsis|septic/i],
    ['seizureHx', /epilep|seizure|status epilepticus/i], ['withdrawal', /alcohol withdrawal|benzodiazepine withdrawal|delirium tremens/i], ['longQT', /long qt|torsade/i]];

  async function loadFHIR(client) {
    state.mode = 'fhir';
    const status = $('#status');
    status.textContent = 'Loading chart…';
    const pid = client.patient.id;
    const errs = [];
    try {
      const p = await client.patient.read();
      const n = (p.name || [])[0] || {};
      state.patient.name = n.text || [((n.given || []).join(' ')), n.family].filter(Boolean).join(' ');
      const mrn = (p.identifier || []).find(i => (i.type && (i.type.coding || []).some(c => c.code === 'MR')) || /mrn/i.test((i.type && i.type.text) || ''));
      state.patient.mrn = mrn ? mrn.value : '';
      if (p.birthDate) { const b = new Date(p.birthDate), now = new Date(); let a = now.getFullYear() - b.getFullYear(); if (now < new Date(now.getFullYear(), b.getMonth(), b.getDate())) a--; state.pt.age = a; state.src.age = 'chart'; }
      if (p.gender === 'female' || p.gender === 'male') { state.pt.sex = p.gender; state.src.sex = 'chart'; }
      $('#ptBanner').textContent = `${state.patient.name || 'Patient'} · ${state.pt.age ?? '?'}${state.pt.sex ? state.pt.sex[0].toUpperCase() : ''}${state.patient.mrn ? ' · MRN ' + state.patient.mrn : ''}`;
    } catch (e) { errs.push('patient'); }

    try {
      const meds = await client.request(`MedicationRequest?patient=${pid}&status=active&_count=100`, { pageLimit: 0, flat: true });
      state.meds = state.meds.filter(m => m.source !== 'chart').concat((meds || []).filter(m => m.resourceType === 'MedicationRequest').map(m => {
        const cc = m.medicationCodeableConcept || {};
        const name = cc.text || (cc.coding || []).map(c => c.display).filter(Boolean)[0] || (m.medicationReference && m.medicationReference.display) || '';
        const dose = (m.dosageInstruction || []).map(d => d.text).filter(Boolean).join('; ');
        return { text: (name + (dose && dose.toLowerCase().indexOf(name.toLowerCase()) < 0 ? ' — ' + dose : '')).trim(), source: 'chart' };
      }).filter(m => m.text));
    } catch (e) { errs.push('medications'); }

    const since = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
    const latest = {};
    for (const cat of ['laboratory', 'vital-signs', 'procedure']) {
      try {
        const obs = await client.request(`Observation?patient=${pid}&category=${cat}&date=ge${since}&_count=200`, { pageLimit: 5, flat: true });
        (obs || []).forEach(o => {
          if (o.resourceType !== 'Observation' || o.status === 'entered-in-error') return;
          const k = classify(o); if (!k) return;
          const val = obsValue(o); if (!val) return;
          const when = o.effectiveDateTime || o.issued || '';
          if (!latest[k] || when > latest[k].when) latest[k] = { v: convert(k, val.v, val.u), when };
        });
      } catch (e) { if (cat !== 'procedure') errs.push(cat + ' observations'); }
    }
    Object.entries(latest).forEach(([k, x]) => { state.pt[k] = x.v; state.src[k] = 'chart ' + (x.when || '').slice(0, 10); });
    if (latest.egfr) state.src.egfrLab = true;
    else if (state.pt.scr) { state.pt.egfr = DDI.ckdEpi2021(state.pt.scr, state.pt.age, state.pt.sex); if (state.pt.egfr) state.src.egfr = 'calculated CKD-EPI 2021'; }

    try {
      const conds = await client.request(`Condition?patient=${pid}&_count=100`, { pageLimit: 3, flat: true });
      const found = [];
      (conds || []).forEach(c => {
        if (c.resourceType !== 'Condition') return;
        const cs = c.clinicalStatus && ((c.clinicalStatus.coding || [])[0] || {}).code;
        if (cs && !/active|recurrence|relapse/.test(cs)) return;
        const txt = (c.code && (c.code.text || (c.code.coding || []).map(x => x.display).join(' '))) || '';
        COND.forEach(([k, re]) => { if (re.test(txt)) { state.pt[k] = true; found.push(txt); } });
      });
      state.src.conditions = found.length ? 'Ticked from problem list: ' + [...new Set(found)].join('; ') : 'Nothing matched on the problem list – tick manually if relevant.';
    } catch (e) { errs.push('conditions'); }

    status.textContent = errs.length ? 'Could not load: ' + errs.join(', ') : 'Chart loaded ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  // ---------------- start ----------------
  const DEMO = {
    patient: { name: 'Demo Patient (made up)', mrn: '0000000' },
    meds: ['Azithromycin 500 mg PO daily', 'Citalopram 40 mg PO daily', 'Ondansetron 4 mg IV q8h PRN', 'Furosemide 40 mg IV BID',
      'Tramadol 50 mg PO q6h PRN', 'Divalproex 500 mg PO BID', 'Meropenem 1 g IV q8h', 'Apixaban 2.5 mg PO BID'],
    pt: { age: 82, sex: 'female', qtc: 492, k: 3.3, mg: 0.68, scr: 160, hf: true }
  };
  async function start() {
    if (/[?&]demo=1\b/.test(location.search)) {
      state.mode = 'demo';
      state.patient = DEMO.patient;
      state.meds = DEMO.meds.map(text => ({ text, source: 'chart' }));
      Object.assign(state.pt, DEMO.pt);
      state.pt.egfr = DDI.ckdEpi2021(state.pt.scr, state.pt.age, state.pt.sex); state.src.egfr = 'calculated CKD-EPI 2021';
      $('#ptBanner').textContent = 'DEMO – made-up patient';
      $('#status').textContent = 'Demo mode – sample data only';
    } else if (window.FHIR) {
      // Works for a direct launch (launch.html) and inside the Hospitalist Toolkit (shared sign-in)
      try { const client = await FHIR.oauth2.ready(); await loadFHIR(client); }
      catch (e) { state.mode = 'manual'; $('#status').textContent = 'Not launched from Cerner – manual mode (paste meds on the Med list tab, or add ?demo=1)'; }
    } else {
      $('#status').textContent = 'SMART library not loaded – manual mode';
    }
    renderData();
    run();
    if (!state.meds.length) document.querySelector('[data-tab="meds"]').click();
  }
  start();
})();
