/* "Echo needed?" card for the Antibiotics tab.
   score(orgKey, ticks) is pure (testable). render() draws the card and keeps the user's
   choices per patient in this browser. Rules and points live in abx-rules.js. */
(function (root) {
  'use strict';
  const R = root.ABX_RULES || (typeof require !== 'undefined' ? require('./abx-rules.js') : null);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // Items shown for each kind of organism
  const RISK_ITEMS = ['device', 'valve', 'murmur', 'emboli', 'persistent', 'ivdu'];
  function itemsFor(org) {
    if (!org || !org.key) return [];
    if (org.score) {
      const s = R.echoScores[org.score];
      const keys = s.items.map((i) => i[0]);
      if (org.score === 'virsta') keys.push('dialysis');
      return [...new Set(keys)];
    }
    if (org.rule === 'cons') return ['cultures2', 'device', 'persistent', 'valve'];
    if (org.rule === 'candida') return ['device', 'persistent', 'valve', 'emboli'];
    return RISK_ITEMS;
  }

  // Pure: organism + ticked items -> { score, max, level, title, text, remind }
  function score(orgKey, ticks) {
    const org = R.echoOrganisms.find((o) => o.key === orgKey);
    const on = (k) => !!(ticks && ticks[k]);
    const out = { org, score: null, scoreName: null, parts: [], remind: (org && org.remind) || [] };
    if (!org || !org.key) return Object.assign(out, { level: 'none', title: 'Choose the organism' });
    const anyRisk = ['device', 'emboli', 'persistent', 'murmur', 'valve', 'ivdu'].filter(on);

    if (org.score) {
      const s = R.echoScores[org.score];
      let pts = 0;
      s.items.forEach(([k, p]) => { if (on(k)) { pts += p; out.parts.push({ k, p }); } });
      if (s.heartIsOne && on('murmur') && on('valve')) { pts -= 1; out.parts.push({ k: 'heartIsOne', p: -1 }); } // H = murmur OR valve disease, 1 point
      if (org.aetiologyPts) { pts += org.aetiologyPts; out.parts.push({ k: 'aetiology', p: org.aetiologyPts }); }
      out.score = pts; out.scoreName = s.name; out.lowMax = s.lowMax;
      const high = pts > s.lowMax;
      if (org.score === 'virsta') {
        if (high) Object.assign(out, { level: 'red', title: 'TTE and TEE recommended', text: s.name + ' ' + pts + ' (> ' + s.lowMax + '): not low risk for endocarditis. Get TTE now; TEE even if TTE is normal.' });
        else Object.assign(out, { level: 'amber', title: 'TTE recommended; TEE probably not needed', text: s.name + ' ' + pts + ' (≤ ' + s.lowMax + '): low risk. TTE for everyone with S. aureus; TEE only if TTE is abnormal, cultures stay positive, or new features appear.' });
        if (on('dialysis')) out.remind = out.remind.concat(['Hemodialysis: higher endocarditis risk than the score suggests - lower your threshold for TEE.']);
      } else if (org.score === 'denova') {
        if (high) Object.assign(out, { level: 'red', title: 'Echo recommended (TEE)', text: s.name + ' ' + pts + ' (≥ 3): endocarditis risk high enough to need TEE.' });
        else Object.assign(out, { level: 'green', title: 'Echo not routinely needed', text: s.name + ' ' + pts + ' (< 3): low risk. Echo if new features appear.' });
      } else {
        if (high) Object.assign(out, { level: 'red', title: 'Echo recommended', text: s.name + ' ' + pts + ' (≥ 3): get TTE; TEE if TTE is negative but suspicion remains.' });
        else Object.assign(out, { level: 'green', title: 'Echo not routinely needed', text: s.name + ' ' + pts + ' (≤ 2): low risk.' });
      }
      return out;
    }
    if (org.rule === 'always') return Object.assign(out, { level: 'red', title: 'Echo recommended (TEE)', text: org.label + ': echo for everyone.' });
    if (org.rule === 'candida') {
      if (anyRisk.length) return Object.assign(out, { level: 'red', title: 'Echo recommended', text: 'Candidemia with risk features: TTE, then TEE if prosthetic valve or persistent candidemia.' });
      return Object.assign(out, { level: 'amber', title: 'Consider echo', text: 'Candidemia: consider TTE, especially if cultures stay positive.' });
    }
    if (org.rule === 'cons') {
      if (on('cultures2') && (on('device') || on('persistent') || on('valve'))) return Object.assign(out, { level: 'red', title: 'Echo recommended', text: 'Multiple positive sets with a device, valve disease or persistent bacteremia.' });
      if (!on('cultures2')) return Object.assign(out, { level: 'green', title: 'Echo not needed', text: 'One positive set: likely a contaminant. Repeat cultures if unsure.' });
      return Object.assign(out, { level: 'amber', title: 'Probably not needed', text: '≥ 2 sets but no device, valve disease or persistence: treat the source; echo if it persists.' });
    }
    if (anyRisk.length) return Object.assign(out, { level: 'red', title: 'Echo recommended', text: 'Risk features present: ' + anyRisk.map((k) => R.echoItems[k].text.toLowerCase()).join('; ') + '.' });
    return Object.assign(out, { level: 'green', title: 'Echo not routinely needed', text: 'No risk features ticked. Echo if bacteremia persists, a murmur appears, or emboli occur.' });
  }

  // Pre-tick from the chart (problem list + CRP). Returns { ticks, fromChart: {key: reason} }
  function prefill(ctx) {
    const ticks = {}, fromChart = {};
    Object.entries(R.echoItems).forEach(([k, it]) => {
      if (it.defaultOn) ticks[k] = true;
      if (it.chart && ctx.probText) { const m = ctx.probText.match(it.chart); if (m) { ticks[k] = true; fromChart[k] = 'problem list: “' + m[0] + '”'; } }
    });
    if (ctx.crp && ctx.crp.v > 190) { ticks.crp = true; fromChart.crp = 'highest CRP this visit ' + Math.round(ctx.crp.v) + ' mg/L'; }
    else if (ctx.crp) fromChart.crp = 'highest CRP ' + Math.round(ctx.crp.v) + ' mg/L';
    return { ticks, fromChart };
  }

  function render(el, ctx, patientId) {
    const key = 'abx-echo-' + (patientId || 'demo');
    let saved = null; try { saved = JSON.parse(localStorage.getItem(key) || 'null'); } catch (e) { /* no storage */ }
    const pre = prefill(ctx);
    let state = saved || { org: ctx.suggestedOrg || '', ticks: pre.ticks };
    const save = () => { try { localStorage.setItem(key, JSON.stringify(state)); } catch (e) { /* no storage */ } };

    const draw = () => {
      const org = R.echoOrganisms.find((o) => o.key === state.org) || R.echoOrganisms[0];
      const res = score(state.org, state.ticks);
      const items = itemsFor(org);
      const pts = {}; if (org.score) R.echoScores[org.score].items.forEach(([k, p]) => { pts[k] = p; });
      el.innerHTML = `
        ${root.ABXIcons ? root.ABXIcons.head('echo', 'Echo needed?', 'bacteremia / candidemia') : '<h3>Echo needed? <small class="ab-sub">bacteremia / candidemia</small></h3>'}
        ${ctx.echoes && ctx.echoes.length ? `<div class="ab-echo-done">Already this visit: ${ctx.echoes.map((e) => esc(e.text) + ' (' + esc(new Date(e.t).toLocaleDateString([], { month: 'short', day: 'numeric' })) + ')').join(' · ')}</div>` : '<div class="ab-echo-none">No echo found in the chart this visit.</div>'}
        <label class="ab-lbl">Organism in blood cultures
          <select id="ab-org">${R.echoOrganisms.map((o) => `<option value="${o.key}"${o.key === state.org ? ' selected' : ''}>${esc(o.label)}</option>`).join('')}</select>
        </label>
        ${items.length ? `<div class="ab-checks">${items.map((k) => {
            const it = R.echoItems[k], why = pre.fromChart[k];
            return `<label class="ab-chk"><input type="checkbox" data-k="${k}"${state.ticks[k] ? ' checked' : ''}>
              <span>${esc(it.text)}${pts[k] ? ` <b class="ab-pts">+${pts[k]}</b>` : ''}${why ? ` <small class="ab-from">${esc(why)}</small>` : ''}</span></label>`; }).join('')}
            ${org.aetiologyPts ? `<div class="ab-chk ab-fixed"><span>Species group (${esc(org.label)}) <b class="ab-pts">${org.aetiologyPts > 0 ? '+' : ''}${org.aetiologyPts}</b></span></div>` : ''}
          </div>` : ''}
        ${res.org && res.org.key ? `<div class="ab-echo-res ab-er-${res.level}">
            <div class="ab-er-title">${esc(res.title)}</div>
            ${res.text ? `<div>${esc(res.text)}</div>` : ''}
          </div>
          ${res.remind.length ? '<ul class="ab-remind">' + res.remind.map((r) => '<li>' + esc(r) + '</li>').join('') + '</ul>' : ''}
          ${res.scoreName === 'VIRSTA' ? '<p class="ab-fine">Unticking “community-acquired” lowers the score - only untick if the bacteremia started in hospital (&gt; 48 h after admission).</p>' : ''}` : ''}
        <p class="ab-fine">Scores: VIRSTA (Tubiana 2016), DENOVA (Berge 2019), HANDOC (Sunnerhagen 2018). DRAFT - check points and wording with ID before clinical use. Any new murmur, emboli, device or persistent bacteremia → echo regardless of score.</p>`;
      el.querySelector('#ab-org').onchange = (e) => { state.org = e.target.value; save(); draw(); };
      el.querySelectorAll('input[data-k]').forEach((cb) => { cb.onchange = () => { state.ticks[cb.dataset.k] = cb.checked; save(); draw(); }; });
    };
    draw();
  }

  const ABXEcho = { score, prefill, itemsFor, render };
  if (typeof module !== 'undefined' && module.exports) module.exports = ABXEcho; else root.ABXEcho = ABXEcho;
})(typeof window !== 'undefined' ? window : globalThis);
