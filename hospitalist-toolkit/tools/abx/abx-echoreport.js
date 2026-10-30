/* Echo report reader for the "Echo needed?" card.
   - makeLoader(client): finds echo reports (DiagnosticReport + DocumentReference) and gets their text
     (plain text, HTML, Cerner XML or PDF).
   - extract(text): pure, rules-based pull-out of the findings that matter most (EF, vegetation, abscess,
     valve lesions, prosthetic valve, RVSP, effusion, RV function) plus the report's own conclusion.
   It is a reading aid, not an interpretation: the full report is always one click away. */
(function (root) {
  'use strict';
  const R = root.ABX_RULES || (typeof require !== 'undefined' ? require('./abx-rules.js') : null);
  const DAY = 24 * 3600 * 1000;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ccText = (cc) => (cc && (cc.text || ((cc.coding || []).find((c) => c.display) || {}).display)) || '';
  const toTime = (s) => { const t = s ? Date.parse(s) : NaN; return isNaN(t) ? null : t; };

  // ---------------- extraction (pure) ----------------
  const NEG = /\b(no|not|without|negative for|absence of|absent|free of|no evidence of|rule[sd]? out|excluded?)\b/i;
  const SEV = ['trace', 'trivial', 'mild', 'mild-to-moderate', 'moderate', 'moderate-to-severe', 'severe'];
  const sevRank = (s) => SEV.indexOf(s);

  function sentences(text) {
    return text.replace(/\r/g, '').split(/(?<=[.;])\s+|\n+/).map((s) => s.trim()).filter(Boolean);
  }
  // Is the term negated in this sentence? (negation word before the term, within the same clause)
  function negated(sentence, termRe) {
    const m = sentence.match(termRe); if (!m) return null;
    const before = sentence.slice(0, m.index).split(/,|\bbut\b|\bhowever\b|\bwith\b(?! no)/i).pop();
    if (NEG.test(before)) return true;
    const after = sentence.slice(m.index + m[0].length, m.index + m[0].length + 40);
    if (/^\w*\W*(is |are |was |were |has been |have been )?(not (seen|visualized|visualised|identified|present|demonstrated)|absent|none)\b/i.test(after)) return true;
    return false;
  }
  function severityIn(s) {
    const low = s.toLowerCase().replace(/\s*(?:to|-|–)\s*/g, '-');
    let best = null, rest = low;
    [['moderate-severe', 'moderate-to-severe'], ['moderate-to-severe', 'moderate-to-severe'], ['mild-moderate', 'mild-to-moderate'], ['mild-to-moderate', 'mild-to-moderate'],
      ['severe', 'severe'], ['moderate', 'moderate'], ['mild', 'mild'], ['trivial', 'trivial'], ['trace', 'trace']].forEach(([k, v]) => {
      if (rest.includes(k)) { if (best == null || sevRank(v) > sevRank(best)) best = v; rest = rest.split(k).join(' '); }
    });
    return best;
  }

  const VALVES = [['Aortic', /\baortic\b|\bAV\b/i], ['Mitral', /\bmitral\b|\bMV\b/i], ['Tricuspid', /\btricuspid\b|\bTV\b/i], ['Pulmonic', /\bpulmon(ic|ary) valve\b|\bpulmonic\b/i]];
  const LESIONS = [['regurgitation', /regurgitation|insufficiency|\b[AMTP]R\b/i], ['stenosis', /stenosis|\b[AM]S\b/i]];

  function extract(text, typeHint) {
    const t = String(text || '');
    const ss = sentences(t);
    const out = { type: /trans-?o?esophageal|\bTEE\b/i.test((typeHint || '') + ' ' + t.slice(0, 600)) ? 'TEE' : 'TTE', findings: [] };
    const add = (level, label, value) => out.findings.push({ level, label, value });

    // LVEF
    const ef = t.match(/(?:LVEF|LV ejection fraction|ejection fraction|\bEF\b)[^0-9%]{0,30}(\d{1,2})\s*(?:%\s*)?(?:-|–|to)\s*(\d{1,2})\s*%|(?:LVEF|LV ejection fraction|ejection fraction|\bEF\b)[^0-9%]{0,30}(?:>|<|≥|≤|greater than|less than)?\s*(\d{1,2})\s*%/i);
    if (ef) {
      const lo = +(ef[1] || ef[3]), hi = ef[2] ? +ef[2] : lo, mid = (lo + hi) / 2;
      out.ef = lo === hi ? lo + '%' : lo + '–' + hi + '%';
      add(mid < 40 ? 'red' : mid < 50 ? 'amber' : 'ok', 'LVEF', out.ef);
    } else {
      const q = ss.find((s) => /(left ventric\w*|\bLV\b)[^.]{0,40}systolic function/i.test(s));
      if (q) { const sev = severityIn(q); const norm = /normal/i.test(q) && !/reduced|impaired|depressed|decreased/i.test(q);
        add(norm ? 'ok' : sev === 'severe' || sev === 'moderate-to-severe' ? 'red' : 'amber', 'LV systolic function', norm ? 'normal' : (sev ? sev + 'ly ' : '') + 'reduced'); }
    }

    // Endocarditis features
    [['Vegetation', /vegetation|\bveg\b|echodensit|mobile (mass|echo)/i], ['Abscess', /abscess|pseudoaneurysm/i],
      ['Perforation / fistula', /perforat|fistula/i], ['Prosthetic dehiscence', /dehiscen|paravalvular leak|perivalvular leak/i]].forEach(([label, re]) => {
      const hits = ss.filter((s) => re.test(s));
      if (!hits.length) return;
      const pos = hits.filter((s) => negated(s, re) === false);
      if (pos.length) add('red', label, pos[0].length > 140 ? pos[0].slice(0, 137) + '…' : pos[0]);
      else add('ok', label, 'none seen');
    });
    if (!out.findings.some((f) => f.label === 'Vegetation')) add('info', 'Vegetation', 'not mentioned');

    // Prosthetic valve
    const pv = ss.find((s) => /prosthe|bioprosth|mechanical (aortic|mitral|valve)|\bTAVR\b|\bTAVI\b|valve replacement|\b(AVR|MVR)\b/i.test(s) && !NEG.test(s.split(/prosthe|bioprosth|mechanical|TAVR|TAVI|replacement|AVR|MVR/i)[0]));
    if (pv) add('info', 'Prosthetic valve', pv.length > 120 ? pv.slice(0, 117) + '…' : pv);

    // Valve lesions: worst severity per valve + lesion
    VALVES.forEach(([vName, vRe]) => LESIONS.forEach(([lName, lRe]) => {
      let worst = null, neg = false;
      ss.filter((s) => vRe.test(s) && lRe.test(s)).forEach((sent) => {
        // look only at the clause that holds the lesion ("moderate AS with mild AR" → AS moderate, AR mild)
        const s = sent.split(/\bwith\b|\band\b|,|;|\(/i).find((c) => lRe.test(c)) || sent;
        const sev = severityIn(s);
        if (negated(s, lRe) && !sev) { neg = true; return; }
        if (sev && (worst == null || sevRank(sev) > sevRank(worst))) worst = sev;
      });
      if (worst && sevRank(worst) >= sevRank('mild')) add(sevRank(worst) >= sevRank('moderate-to-severe') ? 'red' : sevRank(worst) >= sevRank('moderate') ? 'amber' : 'info', vName + ' ' + lName, worst);
    }));

    // RVSP / PASP
    const rv = t.match(/(?:RVSP|PASP|pulmonary artery systolic pressure|right ventricular systolic pressure)[^0-9]{0,40}(\d{2,3})\s*(?:\+\s*RAP\s*)?mm\s*Hg/i);
    if (rv) add(+rv[1] >= 50 ? 'amber' : 'ok', 'RVSP', rv[1] + ' mmHg');
    const rvf = ss.find((s) => /(right ventric\w*|\bRV\b)[^.]{0,40}(systolic )?function/i.test(s));
    if (rvf) { const sev = severityIn(rvf); const norm = /normal/i.test(rvf) && !/reduced|impaired|depressed|decreased/i.test(rvf);
      if (!norm) add(sev === 'severe' ? 'red' : 'amber', 'RV function', (sev ? sev + 'ly ' : '') + 'reduced'); }

    // Pericardial effusion
    const pe = ss.filter((s) => /pericardial effusion/i.test(s));
    if (pe.length) {
      const p = pe.find((s) => negated(s, /pericardial effusion/i) === false);
      if (p) {
        const tamp = /tamponade/i.test(p) && negated(p, /tamponade/i) === false;
        const size = /large/i.test(p) ? 'large' : /moderate/i.test(p) ? 'moderate' : /small|trivial|trace/i.test(p) ? 'small' : 'present';
        add(tamp || size === 'large' ? 'red' : 'amber', 'Pericardial effusion', size + (tamp ? ' - tamponade physiology' : ''));
      }
    }

    // Report's own conclusion
    const cm = t.match(/(?:^|\n)\s*(conclusions?|impression|summary|interpretation|final (?:impression|diagnosis))\s*[:\-]?\s*\n?([\s\S]{20,1200}?)(?=\n\s*\n\s*[A-Z][A-Za-z /]{2,40}:|\n\s*(?:electronically signed|signed by|reading physician|sonographer|measurements)\b|$)/i);
    out.conclusion = cm ? cm[2].trim().replace(/\n{2,}/g, '\n') : '';
    out.flag = out.findings.some((f) => f.level === 'red' && /Vegetation|Abscess|Perforation|dehiscence/i.test(f.label)) ? 'ie' : null;
    return out;
  }

  // ---------------- fetching ----------------
  const b64ToBytes = (b64) => Uint8Array.from(atob(String(b64).replace(/\s+/g, '')), (c) => c.charCodeAt(0));
  function htmlToText(html) {
    const d = new DOMParser().parseFromString(html, 'text/html');
    d.querySelectorAll('script,style').forEach((n) => n.remove());
    d.querySelectorAll('br').forEach((n) => n.replaceWith('\n'));
    d.querySelectorAll('p,div,tr,li,h1,h2,h3,h4,h5,h6').forEach((n) => n.append('\n'));
    return (d.body.textContent || '').replace(/\n{3,}/g, '\n\n').trim();
  }
  function loadPdfJs() {
    if (root.pdfjsLib) return Promise.resolve(root.pdfjsLib);
    return new Promise((res, rej) => {
      const s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js';
      s.onload = () => { root.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js'; res(root.pdfjsLib); };
      s.onerror = () => rej(new Error('PDF reader failed to load')); document.head.appendChild(s);
    });
  }
  async function pdfToText(bytes) {
    const lib = await loadPdfJs(); const pdf = await lib.getDocument({ data: bytes }).promise; const pages = [];
    for (let p = 1; p <= pdf.numPages; p++) {
      const items = (await (await pdf.getPage(p)).getTextContent()).items; let out = '', line = '', lastY = null;
      items.forEach((it) => { const y = it.transform[5]; if (lastY !== null && Math.abs(y - lastY) > 2) { out += line.trimEnd() + '\n'; line = ''; } line += it.str; lastY = y; });
      pages.push((out + line).trim());
    }
    return pages.join('\n\n');
  }
  async function xmlToText(xml) {
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    if (doc.querySelector('parsererror')) return htmlToText(xml);
    const pdfEl = [...doc.querySelectorAll('*')].find((el) => !el.children.length && /^\s*JVBER/.test(el.textContent));
    if (pdfEl) return pdfToText(b64ToBytes(pdfEl.textContent));
    doc.querySelectorAll('*').forEach((el) => { if (!el.children.length) el.append('\n'); });
    let text = ((doc.querySelector('document-data') || doc.documentElement).textContent || '').trim();
    if (/<\/?(p|div|br|span|table|html|body)\b[^>]*>/i.test(text)) text = htmlToText(text);
    return text.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  }

  function makeLoader(client) {
    async function authFetch(url, accept) {
      const go = () => fetch(url, { headers: { Authorization: 'Bearer ' + client.state.tokenResponse.access_token, Accept: accept } });
      try { await client.refreshIfNeeded(); } catch (e) { /* ignore */ }
      let res = await go();
      if (res.status === 401) { try { await client.refresh(); } catch (e) { throw new Error('sign-in expired - relaunch'); } res = await go(); }
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res;
    }
    async function attText(atts) {
      const pref = ['text/plain', 'text/html', 'application/xhtml+xml', 'application/pdf', 'application/xml', 'text/rtf'];
      const att = pref.map((p) => atts.find((a) => (a.contentType || '').toLowerCase().startsWith(p))).find(Boolean) || atts[0];
      if (!att) return '';
      const ct = (att.contentType || '').toLowerCase();
      let bytes = null;
      if (att.data) bytes = b64ToBytes(att.data);
      else if (att.url) bytes = new Uint8Array(await (await authFetch(new URL(att.url, client.state.serverUrl + '/').href, att.contentType || '*/*')).arrayBuffer());
      if (!bytes) return '';
      if (ct.startsWith('application/pdf')) return pdfToText(bytes);
      const raw = new TextDecoder('utf-8').decode(bytes);
      if (/^\s*<\?xml/i.test(raw) || (ct.includes('xml') && !ct.includes('xhtml'))) return xmlToText(raw);
      if (ct.includes('html')) return htmlToText(raw);
      if (ct.includes('rtf')) return raw.replace(/\\par[d]?/g, '\n').replace(/\\'[0-9a-f]{2}/gi, '').replace(/[{}]|\\[a-z]+-?\d* ?/gi, '').trim();
      return raw;
    }
    return async (sinceT) => {
      const pid = client.patient.id, ge = new Date(sinceT).toISOString();
      const flat = async (url) => { try { const r = await client.request(url, { pageLimit: 5, flat: true }); return Array.isArray(r) ? r : []; } catch (e) { return []; } };
      const cat = encodeURIComponent('http://hl7.org/fhir/us/core/CodeSystem/us-core-documentreference-category|clinical-note');
      const [reps, docs1, docs2] = await Promise.all([
        flat('DiagnosticReport?patient=' + pid + '&date=ge' + ge + '&_count=100'),
        flat('DocumentReference?patient=' + pid + '&date=ge' + ge + '&_count=100'),
        flat('DocumentReference?patient=' + pid + '&category=' + cat + '&date=ge' + ge + '&_count=100')]);
      const seen = new Set(), found = [];
      reps.forEach((r) => {
        if (r.resourceType !== 'DiagnosticReport' || ['entered-in-error', 'cancelled'].includes(r.status) || !R.echoTextRe.test(ccText(r.code))) return;
        found.push({ id: 'dr/' + r.id, t: toTime(r.effectiveDateTime || (r.effectivePeriod && r.effectivePeriod.start) || r.issued), title: ccText(r.code),
          status: r.status, author: ((r.resultsInterpreter || r.performer || [])[0] || {}).display || '', atts: r.presentedForm || [], conclusion: r.conclusion || '' });
      });
      docs1.concat(docs2).forEach((d) => {
        if (d.resourceType !== 'DocumentReference' || seen.has(d.id) || d.status === 'entered-in-error') return; seen.add(d.id);
        const title = ccText(d.type) + ' ' + (d.description || '');
        if (!R.echoTextRe.test(title)) return;
        found.push({ id: 'doc/' + d.id, t: toTime(d.date || (d.context && d.context.period && d.context.period.start)), title: title.trim(), status: d.docStatus || d.status,
          author: ((d.author || [])[0] || {}).display || '', atts: (d.content || []).map((c) => c.attachment).filter(Boolean), conclusion: '' });
      });
      found.sort((a, b) => (b.t || 0) - (a.t || 0));
      const top = found.slice(0, 4);
      await Promise.all(top.map(async (f) => {
        try { f.text = await attText(f.atts); } catch (e) { f.text = ''; f.error = e.message; }
        if (!f.text && f.conclusion) f.text = 'Conclusion: ' + f.conclusion;
      }));
      return top.map((f) => ({ t: f.t, title: f.title, status: f.status, author: f.author, text: f.text || '', error: f.error }));
    };
  }

  // ---------------- rendering ----------------
  // ---------------- optional AI summary (sandbox / made-up patients only) ----------------
  const SANDBOX_HOSTS = ['fhir-ehr-code.cerner.com', 'fhir-open.cerner.com'];
  let aiCtx = { source: 'sample', serverUrl: '' };
  function setContext(c) { aiCtx = Object.assign({ source: 'sample', serverUrl: '' }, c || {}); }
  function aiAllowed() {
    if (aiCtx.source === 'sample') return { ok: true };
    if (SANDBOX_HOSTS.some((h) => String(aiCtx.serverUrl || '').includes(h))) return { ok: true };
    return { ok: false, why: 'AI is off for this chart: it does not look like the Cerner sandbox. Real patient data stays out of AI until Island Health approves.' };
  }
  // Remove identifiers before anything leaves the page. The user sees the result before sending.
  function deidentify(text) {
    const months = '(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*';
    return String(text || '')
      .split('\n').filter((l) => !/^\s*(patient( name)?|name|mrn|fin|phn|health ?number|account|dob|date of birth|birth ?date|age\/sex|address|phone|location|room|bed|referring|ordering|requesting|attending|sonographer|technologist|reading (physician|md)|interpreted by|electronically signed|signed by|signature|cc|copy to|accession|study (date|time|id))\b/i.test(l))
      .join('\n')
      .replace(/\b\d{4}[-/.]\d{1,2}[-/.]\d{1,2}([ T]\d{1,2}:\d{2}(:\d{2})?)?\b/g, '[date]')
      .replace(/\b\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}\b/g, '[date]')
      .replace(new RegExp('\\b' + months + '\\.? \\d{1,2},? \\d{4}\\b', 'gi'), '[date]')
      .replace(new RegExp('\\b\\d{1,2} ' + months + '\\.? \\d{4}\\b', 'gi'), '[date]')
      .replace(/\b(dr|doctor|md)\.? [A-Z][a-zA-Z'-]+( [A-Z][a-zA-Z'-]+)?/g, 'Dr. [name]')
      .replace(/\b\d{6,}\b/g, '[number]')
      .replace(/\n{3,}/g, '\n\n').trim();
  }
  // Every AI finding must quote the report; quotes we can't find in the text are flagged.
  function verifyQuote(quote, text) {
    const norm = (x) => String(x || '').toLowerCase().replace(/\s+/g, ' ').replace(/[“”"']/g, '').trim();
    const q = norm(quote); return q.length >= 4 && norm(text).includes(q);
  }
  const AI_SAMPLE = { sample: true, summary: 'SAMPLE ONLY, not about this patient: normal LV function, moderate aortic stenosis, no vegetation seen; TTE cannot exclude endocarditis.',
    findings: [{ label: 'Vegetation', value: 'none seen', quote: 'No vegetation seen' }],
    endocarditis: 'No echo features of endocarditis on TTE; TTE does not exclude it.', limitations: ['Sample output - set the AI server address in abx-ai-config.js to get a real draft.'] };

  async function runAI(box, sent) {
    const ep = root.ABX_AI_ENDPOINT || '';
    box.innerHTML = '<div class="ab-ai-wait">Asking the AI…</div>';
    let R;
    try {
      if (!ep) R = AI_SAMPLE;
      else {
        const res = await fetch(ep, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: sent }) });
        if (!res.ok) { let m = ''; try { m = (await res.json()).error || ''; } catch (e) { /* none */ } throw new Error('HTTP ' + res.status + (m ? ': ' + m : '')); }
        R = await res.json();
      }
    } catch (e) {
      box.innerHTML = `<div class="banner banner-error">AI summary failed: ${esc(e.message)}.${/fetch|network/i.test(e.message) ? ' Is the AI server running on this computer? (node echo-server.js)' : ''}</div>`;
      return;
    }
    const f = (R.findings || []).map((x) => Object.assign({}, x, { ok: verifyQuote(x.quote, sent) }));
    box.innerHTML = `<div class="ab-ai-out">
      <div class="ab-ai-tag">${R.sample ? 'SAMPLE OUTPUT - not about this patient' : 'AI draft - check against the report'}</div>
      <p>${esc(R.summary || '')}</p>
      ${R.endocarditis ? `<p><b>Endocarditis features:</b> ${esc(R.endocarditis)}</p>` : ''}
      ${f.length ? '<ul>' + f.map((x) => `<li><b>${esc(x.label)}:</b> ${esc(x.value)}${x.quote ? `<br><small class="${x.ok ? 'ab-q-ok' : 'ab-q-bad'}">${x.ok ? '✓' : '⚠ quote not found in report -'} “${esc(x.quote)}”</small>` : ''}</li>`).join('') + '</ul>' : ''}
      ${(R.limitations || []).length ? '<p class="ab-fine"><b>Limits:</b> ' + R.limitations.map(esc).join(' ') + '</p>' : ''}
    </div>`;
  }
  function aiPanel(r) {
    const a = aiAllowed();
    if (!a.ok) return `<div class="ab-ai"><span class="ab-fine">${esc(a.why)}</span></div>`;
    return `<div class="ab-ai"><button type="button" class="ab-ai-btn" data-ai="${r._i}">✨ AI summary (draft)</button><div class="ab-ai-box"></div></div>`;
  }
  function wireAI(el, reports) {
    el.querySelectorAll('.ab-ai-btn').forEach((btn) => {
      btn.onclick = () => {
        const r = reports[+btn.dataset.ai], box = btn.nextElementSibling, sent = deidentify(r.text);
        box.innerHTML = `<div class="ab-ai-prev"><b>This is exactly what will be sent</b> (names, numbers and dates removed - check nothing identifying is left):
          <pre class="ab-er-full">${esc(sent)}</pre>
          <button type="button" class="ab-ai-send">Send to AI</button> <button type="button" class="ab-ai-cancel">Cancel</button>
          <span class="ab-fine">Server: ${esc(root.ABX_AI_ENDPOINT || 'none - a fixed sample will be shown')}</span></div>`;
        box.querySelector('.ab-ai-cancel').onclick = () => { box.innerHTML = ''; };
        box.querySelector('.ab-ai-send').onclick = () => runAI(box, sent);
      };
    });
  }

  const cache = {};
  function render(el, loader, patientId, onResult) {
    const pid = patientId || 'demo';
    const show = (reports) => {
      if (!reports.length) { el.innerHTML = '<div class="ab-echo-none">No echo report found in the last 12 months.</div>'; return; }
      reports.forEach((r, i) => { r._i = i; });
      el.innerHTML = reports.map((r, i) => {
        const x = r.x;
        const when = r.t ? new Date(r.t).toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' }) : '';
        const ago = r.t ? Math.round((Date.now() - r.t) / DAY) : null;
        return `<div class="ab-er-report${i ? ' older' : ''}">
          <div class="ab-er-top"><span class="ab-er-type">${x.type}</span> <b>${esc(when)}</b> <small>${ago != null ? (ago < 1 ? 'today' : ago + ' d ago') : ''}${r.author ? ' · ' + esc(r.author) : ''}${r.status && !/final|current/i.test(r.status) ? ' · ' + esc(r.status) : ''}</small></div>
          ${r.text ? `<div class="ab-er-chips">${x.findings.map((f) => `<span class="ab-chip ab-chip-${f.level}" title="${esc(f.value)}"><b>${esc(f.label)}:</b> ${esc(f.value.length > 60 ? f.value.slice(0, 57) + '…' : f.value)}</span>`).join('')}</div>
            ${x.flag === 'ie' ? '<div class="ab-er-ie">Findings suggest endocarditis - see the Endocarditis tool; ID / cardiac surgery input.</div>' : ''}
            ${x.conclusion ? `<div class="ab-er-concl"><b>Conclusion (as written):</b><br>${esc(x.conclusion).replace(/\n/g, '<br>')}</div>` : ''}
            <details><summary>Full report</summary><pre class="ab-er-full">${esc(r.text)}</pre></details>
            ${aiPanel(r)}`
          : `<div class="ab-echo-none">Couldn’t read the report text${r.error ? ' (' + esc(r.error) + ')' : ''}. Open it in PowerChart.</div>`}
        </div>`;
      }).join('') + '<p class="ab-fine">Findings are pulled out of the report text automatically and can miss or misread wording - always check the conclusion and full report.</p>';
      wireAI(el, reports);
    };
    if (cache[pid]) { show(cache[pid]); if (onResult) onResult(cache[pid]); return; }
    el.innerHTML = '<div class="ab-echo-none">Looking for echo reports…</div>';
    loader(Date.now() - 365 * DAY).then((reports) => {
      reports.forEach((r) => { r.x = extract(r.text, r.title); });
      cache[pid] = reports; show(reports); if (onResult) onResult(reports);
    }).catch((e) => { el.innerHTML = '<div class="ab-echo-none">Couldn’t search for echo reports: ' + esc(e.message || e) + '</div>'; });
  }

  const ABXEchoReport = { extract, makeLoader, render, setContext, deidentify, verifyQuote };
  if (typeof module !== 'undefined' && module.exports) module.exports = ABXEchoReport; else root.ABXEchoReport = ABXEchoReport;
})(typeof window !== 'undefined' ? window : globalThis);
