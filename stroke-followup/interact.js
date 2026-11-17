/* interact.js — small shared add-on for the Hospitalist Toolkit apps (plain JavaScript, no libraries).
   Copy this one file into an app folder and load it before the app's own script. Everything stays in the browser.
     Interact.showSource({ title, date, text, match })   open the full note with the matched words highlighted
     Interact.vote(app, rule, sample, ok) / voteButtons(app, rule, sample) / stats(app) / exportCsv(app) / clearVotes(app)
                                                         ✓/✗ on each auto-tick, kept in this browser, to measure which rules miss or over-call
     Interact.startTicker() + <span data-due="ms">       live "in 2 h 14 min" / "overdue by 20 min" countdowns, optional browser alerts
     Interact.chart(el, { series, markers, onPick, ranges, now, unitsLabel, limits })   trend chart: hover values, click a point, zoom ranges
     Interact.handout(title, html)                       printable plain-language handout in a new window
     Interact.shared.get/set/on(patientId, key, value)   values typed once (weight, height, goals of care) shared by every tab of this browser tab
   UNVERIFIED draft written by Claude. */
(function (root) {
  'use strict';
  if (root.Interact) return;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const MIN = 60000, HOUR = 60 * MIN, DAY = 24 * HOUR;
  const ls = { get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage blocked */ } } };
  const ss = { get(k, d) { try { const v = sessionStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }, set(k, v) { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage blocked */ } } };

  /* ---------- styles (injected once) ---------- */
  const css = `
  .ix-modal{position:fixed;inset:0;background:rgba(15,23,42,.45);z-index:9999;display:flex;align-items:flex-start;justify-content:center;padding:40px 16px;overflow:auto}
  .ix-box{background:#fff;border-radius:10px;max-width:860px;width:100%;box-shadow:0 10px 40px rgba(0,0,0,.25);font:14px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif;color:#1f2a37}
  .ix-head{display:flex;justify-content:space-between;gap:12px;align-items:center;padding:10px 16px;border-bottom:1px solid #e2e8f0}
  .ix-head h3{margin:0;font-size:15px} .ix-close{border:0;background:#eef2f7;border-radius:6px;padding:4px 10px;cursor:pointer;font:inherit}
  .ix-body{padding:12px 16px;white-space:pre-wrap;max-height:70vh;overflow:auto;font-size:13px}
  .ix-body mark{background:#ffe58a;padding:0 1px;border-radius:2px}
  .ix-src{cursor:pointer;text-decoration:underline dotted;text-underline-offset:2px}
  .ix-vote{display:inline-flex;gap:2px;margin-left:6px;vertical-align:middle}
  .ix-vote button{border:1px solid #cbd5e1;background:#fff;border-radius:5px;font-size:11px;line-height:1;padding:2px 5px;cursor:pointer;color:#475569}
  .ix-vote button.on-ok{background:#e7f6ee;border-color:#6cc28f;color:#067647} .ix-vote button.on-bad{background:#fdecea;border-color:#f19a92;color:#b42318}
  .ix-due{font-weight:600} .ix-due.ix-over{color:#b42318} .ix-due.ix-soon{color:#a15c00}
  .ix-chart{width:100%;height:auto;display:block;font:11px system-ui,sans-serif} .ix-chart .ix-ax{fill:#64748b}
  .ix-chart .ix-pt{cursor:pointer} .ix-chart .ix-pt:hover{r:6}
  .ix-tip{position:fixed;pointer-events:none;background:#0f172a;color:#fff;font:12px system-ui,sans-serif;padding:4px 8px;border-radius:5px;z-index:9998;display:none;white-space:nowrap}
  .ix-ranges{display:flex;gap:4px;margin:4px 0} .ix-ranges button{border:1px solid #cbd5e1;background:#fff;border-radius:5px;padding:2px 8px;font-size:12px;cursor:pointer}
  .ix-ranges button.on{background:#1d5fa8;color:#fff;border-color:#1d5fa8}
  .ix-legend{display:flex;gap:12px;flex-wrap:wrap;font-size:12px;color:#475569;margin-top:2px} .ix-legend i{display:inline-block;width:12px;height:3px;margin-right:4px;vertical-align:middle}`;
  function addCss() { if (document.getElementById('ix-css')) return; const s = document.createElement('style'); s.id = 'ix-css'; s.textContent = css; document.head.appendChild(s); }

  /* ---------- 1. source viewer ---------- */
  function showSource(o) {
    addCss();
    const text = String(o.text || ''), m = o.match;
    let html = esc(text);
    if (m) {
      // highlight every occurrence of the matched words (case-insensitive), first one scrolled into view
      const re = new RegExp(String(m).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+'), 'ig');
      let i = 0; html = '';
      let last = 0, mm;
      while ((mm = re.exec(text))) { html += esc(text.slice(last, mm.index)) + '<mark' + (i++ === 0 ? ' id="ix-first"' : '') + '>' + esc(mm[0]) + '</mark>'; last = mm.index + mm[0].length; if (!mm[0].length) re.lastIndex++; }
      html += esc(text.slice(last));
    }
    const wrap = document.createElement('div');
    wrap.className = 'ix-modal';
    wrap.innerHTML = '<div class="ix-box" role="dialog" aria-modal="true"><div class="ix-head"><h3>' + esc(o.title || 'Source') + (o.date ? ' <span style="font-weight:400;color:#64748b">· ' + esc(o.date) + '</span>' : '') +
      '</h3><button class="ix-close" type="button">Close</button></div><div class="ix-body">' + (html || '<i>No text.</i>') + '</div></div>';
    const close = () => { wrap.remove(); document.removeEventListener('keydown', onKey); };
    const onKey = e => { if (e.key === 'Escape') close(); };
    wrap.addEventListener('click', e => { if (e.target === wrap || e.target.classList.contains('ix-close')) close(); });
    document.addEventListener('keydown', onKey);
    document.body.appendChild(wrap);
    const f = wrap.querySelector('#ix-first'); if (f) f.scrollIntoView({ block: 'center' });
  }

  /* ---------- 2. ✓/✗ feedback on auto-ticks ---------- */
  const VKEY = app => 'ix-votes:' + app;
  const sampleId = s => { let h = 0; s = String(s || ''); for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return 'h' + (h >>> 0).toString(36); };
  function vote(app, rule, sample, ok) {
    const v = ls.get(VKEY(app), {}), id = rule + ':' + sampleId(sample);
    if (ok === null) delete v[id]; else v[id] = { rule, ok: !!ok, sample: String(sample || '').slice(0, 300), t: Date.now() };
    ls.set(VKEY(app), v);
  }
  function voteOf(app, rule, sample) { const v = ls.get(VKEY(app), {})[rule + ':' + sampleId(sample)]; return v ? v.ok : null; }
  function voteButtons(app, rule, sample) {
    const cur = voteOf(app, rule, sample);
    return '<span class="ix-vote" data-app="' + esc(app) + '" data-rule="' + esc(rule) + '" data-sample="' + esc(sample) + '" title="Was this auto-tick right? Kept in this browser to measure the rule.">' +
      '<button type="button" data-ok="1" class="' + (cur === true ? 'on-ok' : '') + '" aria-label="Correct">✓</button><button type="button" data-ok="0" class="' + (cur === false ? 'on-bad' : '') + '" aria-label="Wrong">✗</button></span>';
  }
  function stats(app) {
    const v = ls.get(VKEY(app), {}), by = {};
    Object.values(v).forEach(x => { const r = by[x.rule] || (by[x.rule] = { rule: x.rule, ok: 0, bad: 0, wrong: [] }); if (x.ok) r.ok++; else { r.bad++; r.wrong.push(x.sample); } });
    return Object.values(by).sort((a, b) => b.bad - a.bad || a.rule.localeCompare(b.rule));
  }
  function exportCsv(app) {
    const v = ls.get(VKEY(app), {}), rows = [['app', 'rule', 'correct', 'date', 'sample']];
    Object.values(v).forEach(x => rows.push([app, x.rule, x.ok ? 'yes' : 'no', new Date(x.t).toISOString().slice(0, 10), x.sample]));
    const csv = rows.map(r => r.map(c => '"' + String(c).replace(/"/g, '""') + '"').join(',')).join('\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = app + '-rule-feedback.csv';
    document.body.appendChild(a); a.click(); a.remove();
  }
  function clearVotes(app) { ls.set(VKEY(app), {}); }
  document.addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('.ix-vote button'); if (!b) return;
    e.preventDefault(); e.stopPropagation();
    const w = b.parentElement, ok = b.dataset.ok === '1', cur = voteOf(w.dataset.app, w.dataset.rule, w.dataset.sample);
    vote(w.dataset.app, w.dataset.rule, w.dataset.sample, cur === ok ? null : ok);
    const now = voteOf(w.dataset.app, w.dataset.rule, w.dataset.sample);
    w.children[0].className = now === true ? 'on-ok' : ''; w.children[1].className = now === false ? 'on-bad' : '';
    w.dispatchEvent(new CustomEvent('ix-voted', { bubbles: true }));
  }, true);

  /* ---------- 3. live countdowns + alerts ---------- */
  function rel(ms) {
    const a = Math.abs(ms);
    if (a < HOUR) return Math.max(1, Math.round(a / MIN)) + ' min';
    if (a < 2 * DAY) { const tm = Math.round(a / MIN), h = Math.floor(tm / 60), m = tm % 60; return h + ' h' + (m ? ' ' + m + ' min' : ''); }
    return Math.round(a / DAY * 10) / 10 + ' days';
  }
  const alerted = new Set();
  let alertsOn = ls.get('ix-alerts', false);
  function tick() {
    const now = Date.now();
    document.querySelectorAll('[data-due]').forEach(el => {
      const t = +el.dataset.due; if (!t) return;
      const d = t - now, soon = d > 0 && d < 2 * HOUR;
      el.textContent = d >= 0 ? 'in ' + rel(d) : 'overdue by ' + rel(d);
      el.classList.add('ix-due'); el.classList.toggle('ix-over', d < 0); el.classList.toggle('ix-soon', soon);
      const key = (el.dataset.label || '') + t;
      if (alertsOn && d <= 0 && d > -10 * MIN && !alerted.has(key) && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        alerted.add(key); try { new Notification('Due now: ' + (el.dataset.label || 'item'), { body: document.title }); } catch (e) { /* ignore */ }
      }
    });
  }
  let ticking = null;
  function startTicker() { addCss(); tick(); if (!ticking) ticking = setInterval(tick, 30000); }
  async function enableAlerts() {
    if (typeof Notification === 'undefined') return 'This browser has no notifications.';
    const p = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
    alertsOn = p === 'granted'; ls.set('ix-alerts', alertsOn);
    return alertsOn ? 'Alerts on: you will get a pop-up when an item falls due while this page is open.' : 'Alerts were not allowed in this browser.';
  }

  /* ---------- 4. interactive trend chart ---------- */
  // series: [{ label, color, points: [{ t, v, src? }] , dash? }], markers: [{ t, label, color }], limits: [{ v, label, color }]
  function chart(el, o) {
    addCss();
    const ranges = o.ranges || [['48 h', 2 * DAY], ['7 d', 7 * DAY], ['30 d', 30 * DAY]];
    let span = el.__ixSpan || ranges[0][1];
    let tip = document.querySelector('.ix-tip'); if (!tip) { tip = document.createElement('div'); tip.className = 'ix-tip'; document.body.appendChild(tip); }
    function draw() {
      const now = o.now || Date.now(), from = now - span;
      const W = 720, H = 220, L = 42, R = 10, T = 12, B = 26;
      const pts = o.series.flatMap(s => s.points.filter(p => p.t >= from && p.t <= now + HOUR));
      const vals = pts.map(p => p.v).concat((o.limits || []).map(l => l.v));
      let lo = vals.length ? Math.min(...vals) : 0, hi = vals.length ? Math.max(...vals) : 1;
      if (hi === lo) { hi += 1; lo -= 1; } const pad = (hi - lo) * 0.12; lo -= pad; hi += pad;
      const x = t => L + (t - from) / (now - from) * (W - L - R), y = v => T + (hi - v) / (hi - lo) * (H - T - B);
      let s = '<svg class="ix-chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(o.title || 'Trend') + '">';
      [lo + pad, (lo + hi) / 2, hi - pad].forEach(v => { s += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + y(v) + '" y2="' + y(v) + '" stroke="#eef2f7"/><text class="ix-ax" x="' + (L - 4) + '" y="' + (y(v) + 4) + '" text-anchor="end">' + (Math.round(v * 10) / 10) + '</text>'; });
      for (let i = 0; i <= 4; i++) { const t = from + (now - from) * i / 4; const d = new Date(t); s += '<text class="ix-ax" x="' + x(t) + '" y="' + (H - 8) + '" text-anchor="middle">' + (i === 4 ? 'now' : (span <= 2 * DAY ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : d.toLocaleDateString([], { month: 'short', day: 'numeric' }))) + '</text>'; }
      (o.limits || []).forEach(l => { s += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + y(l.v) + '" y2="' + y(l.v) + '" stroke="' + (l.color || '#b42318') + '" stroke-dasharray="5 4"/><text class="ix-ax" x="' + (W - R) + '" y="' + (y(l.v) - 3) + '" text-anchor="end" style="fill:' + (l.color || '#b42318') + '">' + esc(l.label) + '</text>'; });
      (o.markers || []).filter(m => m.t >= from && m.t <= now).forEach((m, i) => { s += '<line x1="' + x(m.t) + '" x2="' + x(m.t) + '" y1="' + T + '" y2="' + (H - B) + '" stroke="' + (m.color || '#7c3aed') + '" stroke-dasharray="2 3"/><text class="ix-ax" x="' + (x(m.t) + 3) + '" y="' + (T + 10 + (i % 3) * 11) + '" style="fill:' + (m.color || '#7c3aed') + '">' + esc(m.label) + '</text>'; });
      o.series.forEach((se, si) => {
        const p = se.points.filter(q => q.t >= from && q.t <= now + HOUR).sort((a, b) => a.t - b.t);
        if (p.length > 1) s += '<path d="' + p.map((q, i) => (i ? 'L' : 'M') + x(q.t).toFixed(1) + ' ' + y(q.v).toFixed(1)).join(' ') + '" fill="none" stroke="' + se.color + '" stroke-width="2"' + (se.dash ? ' stroke-dasharray="5 4"' : '') + '/>';
        p.forEach((q, qi) => { s += '<circle class="ix-pt" r="4" cx="' + x(q.t).toFixed(1) + '" cy="' + y(q.v).toFixed(1) + '" fill="' + (q.flag ? '#b42318' : se.color) + '" data-s="' + si + '" data-i="' + se.points.indexOf(q) + '"/>'; });
      });
      if (!pts.length) s += '<text class="ix-ax" x="' + (W / 2) + '" y="' + (H / 2) + '" text-anchor="middle">No values in this range</text>';
      s += '</svg>';
      el.innerHTML = '<div class="ix-ranges">' + ranges.map(r => '<button type="button" data-span="' + r[1] + '"' + (r[1] === span ? ' class="on"' : '') + '>' + r[0] + '</button>').join('') + '</div>' + s +
        '<div class="ix-legend">' + o.series.map(se => '<span><i style="background:' + se.color + '"></i>' + esc(se.label) + '</span>').join('') + (o.onPick ? '<span>Hover a point for its value; click it to open the source.</span>' : '<span>Hover a point for its value.</span>') + '</div>';
      el.querySelectorAll('.ix-ranges button').forEach(b => b.onclick = () => { span = el.__ixSpan = +b.dataset.span; draw(); });
      el.querySelectorAll('.ix-pt').forEach(c => {
        const se = o.series[+c.dataset.s], q = se.points[+c.dataset.i];
        c.addEventListener('mousemove', e => { tip.style.display = 'block'; tip.style.left = (e.clientX + 12) + 'px'; tip.style.top = (e.clientY - 10) + 'px'; tip.textContent = se.label + ' ' + q.v + (q.unit ? ' ' + q.unit : '') + ' · ' + new Date(q.t).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); });
        c.addEventListener('mouseleave', () => { tip.style.display = 'none'; });
        if (o.onPick) c.addEventListener('click', () => { tip.style.display = 'none'; o.onPick(se, q); });
      });
    }
    draw();
  }

  /* ---------- 5. printable handout ---------- */
  function handout(title, html) {
    const w = window.open('', '_blank');
    if (!w) { alert('Allow pop-ups for this site to print the handout.'); return; }
    w.document.write('<!DOCTYPE html><html><head><meta charset="utf-8"><title>' + esc(title) + '</title><style>body{font:16px/1.6 Georgia,serif;max-width:720px;margin:32px auto;padding:0 20px;color:#111}h1{font-size:24px}h2{font-size:18px;margin-top:22px}' +
      'li{margin:4px 0}.note{font-size:13px;color:#555;border-top:1px solid #ccc;margin-top:28px;padding-top:8px}@media print{button{display:none}}</style></head><body><button onclick="window.print()" style="float:right;font:14px sans-serif;padding:6px 12px">Print</button><h1>' +
      esc(title) + '</h1>' + html + '<p class="note">General information to go with your care team\'s advice. Ask your nurse or doctor if anything is unclear.</p></body></html>');
    w.document.close();
  }

  /* ---------- 6. values typed once, shared by every tab ---------- */
  const SKEY = pid => 'ix-shared:' + (pid || 'none');
  let bc = null; try { bc = new BroadcastChannel('ix-shared'); } catch (e) { /* old browser */ }
  const listeners = [];
  const shared = {
    get(pid, key) { const v = ss.get(SKEY(pid), {})[key]; return v ? v.value : undefined; },
    meta(pid, key) { return ss.get(SKEY(pid), {})[key] || null; },
    set(pid, key, value, by) { const all = ss.get(SKEY(pid), {}); if (value === '' || value == null) delete all[key]; else all[key] = { value, by: by || '', t: Date.now() }; ss.set(SKEY(pid), all); if (bc) bc.postMessage({ pid, key }); },
    on(fn) { listeners.push(fn); }
  };
  if (bc) bc.onmessage = e => listeners.forEach(fn => { try { fn(e.data.pid, e.data.key); } catch (err) { /* ignore */ } });

  root.Interact = { showSource, vote, voteOf, voteButtons, stats, exportCsv, clearVotes, startTicker, enableAlerts, rel, chart, handout, shared, esc };
})(typeof window !== 'undefined' ? window : globalThis);
