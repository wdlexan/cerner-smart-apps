/* Hospitalist Toolkit - "Which tool?" pop-up. UNVERIFIED draft written by Claude.
   1. Ask: type a question or problem in plain words (or paste the ER note) and get the tabs that answer it, with what each one gives you.
   2. From the chart: reads the problem list, labs (7 days), active meds and the newest ER/admission notes, and lists the tabs that fit,
      with the reason for each (e.g. "Sodium 124 mmol/L (low)"). Clicking a tool opens that tab.
   The rules live in suggest-rules.js. Read-only: nothing is written to the chart, nothing leaves the browser.
   Opens automatically for each new patient (can be turned off in the pop-up); otherwise the "Which tool?" button in the header. */
(function () {
  const R = window.TKSuggestRules;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const AUTO_KEY = "tk-suggest-auto";
  const state = { client: null, chart: null, chartStatus: "", loading: false, limit: 8 };

  const css = `
  #sgbtn { flex:0 0 auto; background:#fff; color:#0b6bcb; border:0; border-radius:6px; padding:6px 11px; font-size:13px; font-weight:600; cursor:pointer; margin-bottom:4px; white-space:nowrap; }
  #sgbtn .n { background:#d93025; color:#fff; border-radius:9px; padding:0 6px; margin-left:5px; font-size:11px; }
  #sgwrap { position:fixed; inset:0; z-index:100; background:rgba(15,25,40,.45); display:flex; align-items:flex-start; justify-content:center; padding:40px 12px; overflow:auto; }
  #sgwrap[hidden] { display:none; }
  #sgbox { background:#fff; color:#1f2933; width:min(760px,100%); border-radius:10px; box-shadow:0 12px 40px rgba(0,0,0,.25); font-size:14px; }
  #sgbox .hd { display:flex; justify-content:space-between; align-items:center; padding:12px 16px; border-bottom:1px solid #dde3ea; }
  #sgbox .hd h2 { margin:0; font-size:17px; }
  #sgbox .x { background:transparent; border:0; font-size:22px; line-height:1; cursor:pointer; color:#6b7785; }
  #sgbox details { border-bottom:1px solid #dde3ea; }
  #sgbox summary { cursor:pointer; padding:11px 16px; font-weight:600; font-size:15px; list-style:none; }
  #sgbox summary::-webkit-details-marker { display:none; }
  #sgbox summary::before { content:"▸ "; color:#0b6bcb; } #sgbox details[open] > summary::before { content:"▾ "; }
  #sgbox .body { padding:0 16px 14px; }
  #sgq { width:100%; min-height:64px; resize:vertical; padding:8px 10px; border:1px solid #c9d2dc; border-radius:6px; font:inherit; }
  #sgq:focus { outline:2px solid #0b6bcb; border-color:transparent; }
  #sgbox .row { display:flex; gap:8px; align-items:center; flex-wrap:wrap; margin-top:8px; }
  #sgbox button.p { background:#0b6bcb; color:#fff; border:0; border-radius:6px; padding:7px 14px; font-weight:600; cursor:pointer; }
  #sgbox button.s { background:#eef3f9; color:#0b6bcb; border:0; border-radius:6px; padding:7px 12px; cursor:pointer; }
  #sgbox select { padding:5px 8px; border:1px solid #c9d2dc; border-radius:6px; font:inherit; }
  #sgbox .muted { color:#6b7785; font-size:12.5px; }
  #sgbox ol { list-style:none; margin:10px 0 0; padding:0; }
  #sgbox li { border:1px solid #dde3ea; border-radius:8px; padding:9px 11px; margin-bottom:7px; }
  #sgbox li:hover { border-color:#0b6bcb; background:#f7fbff; }
  #sgbox li a { font-weight:700; color:#0b6bcb; text-decoration:none; font-size:15px; cursor:pointer; }
  #sgbox li a:hover { text-decoration:underline; }
  #sgbox .lvl { font-size:11px; border-radius:9px; padding:1px 8px; margin-left:8px; font-weight:600; vertical-align:2px; }
  #sgbox .lvl.l3 { background:#fde8e8; color:#8a1c1c; } #sgbox .lvl.l2 { background:#fff3cd; color:#7a4b00; } #sgbox .lvl.l1 { background:#e8f0fe; color:#174ea6; }
  #sgbox .hint { margin:3px 0 4px; color:#33414e; font-size:13px; }
  #sgbox .why { display:flex; flex-wrap:wrap; gap:4px; }
  #sgbox .why span { background:#f1f4f8; border-radius:5px; padding:1px 7px; font-size:12px; color:#33414e; }
  #sgbox .ft { display:flex; justify-content:space-between; align-items:center; gap:8px; padding:10px 16px; flex-wrap:wrap; }
  #sgbox .empty { color:#6b7785; padding:8px 0 0; }
  #sgbox .jump { display:flex; flex-wrap:wrap; gap:6px; margin-top:6px; }
  #sgbox .jump a { font-size:13px; font-weight:600; background:#e8f0fe; color:#174ea6; border-radius:6px; padding:3px 9px; text-decoration:none; }
  #sgbox .jump a::before { content:"↳ "; } #sgbox .jump a:hover { background:#d2e3fc; text-decoration:none; }
  html.pocket #sgwrap { padding:calc(env(safe-area-inset-top) + 8px) 6px 80px; }
  html.pocket #sgq { font-size:16px; }`;

  function mount() {
    if ($("sgwrap")) return;
    const st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);
    const b = document.createElement("button");
    b.id = "sgbtn"; b.type = "button"; b.title = "Which tool should I use? (press ? )"; b.innerHTML = "🧭 Which tool?";
    b.onclick = () => open();
    const row = document.querySelector("header .navrow"); if (row) row.insertBefore(b, row.firstChild);
    const w = document.createElement("div");
    w.id = "sgwrap"; w.hidden = true;
    w.innerHTML = `<div id="sgbox" role="dialog" aria-modal="true" aria-labelledby="sgtitle">
      <div class="hd"><h2 id="sgtitle">🧭 Which tool?</h2><button class="x" id="sgx" aria-label="Close">×</button></div>
      <details id="sgaskd" open><summary>Ask: what do you need help with?</summary><div class="body">
        <textarea id="sgq" placeholder="Type the problem or question, or paste the ER note. Examples: &#10;“Na 121 and confused on HCTZ”  ·  “which antibiotic for cellulitis, penicillin allergy”  ·  “trop 85, does she need DAPT”  ·  “which meds can I stop”"></textarea>
        <div class="row"><button class="p" id="sgfind" type="button">Find tools</button><button class="s" id="sgclear" type="button">Clear</button>
          <span class="muted">Numbers like “Na 121”, “K 2.9”, “Cr 210 (baseline 120)”, “trop 85” are read as lab values. Ctrl+Enter opens the top tool.</span></div>
        <ol id="sgaskres"></ol>
      </div></details>
      <details id="sgchartd" open><summary>Suggested from this patient's chart <span id="sgcount" class="muted"></span></summary><div class="body">
        <div class="row"><span id="sgstatus" class="muted"></span><span style="flex:1"></span>
          <label class="muted">Show <select id="sglimit"><option value="8">top 8</option><option value="999">all</option></select></label>
          <button class="s" id="sgrescan" type="button">Re-read chart</button></div>
        <ol id="sgchartres"></ol>
      </div></details>
      <div class="ft"><label class="muted"><input type="checkbox" id="sgauto"> Open this list automatically when a patient opens</label>
        <span class="muted">Suggestions only: rules match words and lab cut-offs. Check the tab itself.</span></div>
    </div>`;
    document.body.appendChild(w);
    $("sgx").onclick = close;
    w.addEventListener("mousedown", (e) => { if (e.target === w) close(); });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !w.hidden) { e.preventDefault(); close(); }
      else if (e.key === "?" && w.hidden && !/INPUT|TEXTAREA|SELECT/.test((document.activeElement || {}).tagName)) { e.preventDefault(); open(true); }
    });
    let t; $("sgq").oninput = () => { clearTimeout(t); t = setTimeout(runAsk, 350); };
    $("sgq").onkeydown = (e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); const r = runAsk(); if (r[0]) go(r[0].key); } };
    $("sgfind").onclick = runAsk;
    $("sgclear").onclick = () => { $("sgq").value = ""; runAsk(); $("sgq").focus(); };
    $("sglimit").onchange = () => { state.limit = +$("sglimit").value; renderChart(); };
    $("sgrescan").onclick = () => readChart(true);
    let auto = true; try { auto = localStorage.getItem(AUTO_KEY) !== "0"; } catch (e) {}
    $("sgauto").checked = auto;
    $("sgauto").onchange = () => { try { localStorage.setItem(AUTO_KEY, $("sgauto").checked ? "1" : "0"); } catch (e) {} };
  }

  function open(focusAsk) {
    $("sgwrap").hidden = false;
    if (focusAsk || !state.chart || !state.chart.length) setTimeout(() => $("sgq").focus(), 30);
  }
  function close() { $("sgwrap").hidden = true; const b = $("sgbtn"); if (b) b.focus(); }
  function go(key) { close(); if (typeof show === "function") show(key); } // show() is the toolkit's tab switcher (shell.js)

  // Only list tabs this toolkit actually has (the phone version hides the chart-only tabs)
  const tools = () => (typeof TOOLS !== "undefined" ? TOOLS : []);
  const labelOf = (k) => (tools().find((t) => t.key === k) || {}).label;
  const keep = (list) => list.filter((x) => labelOf(x.key));

  function render(el, list, emptyText, limit) {
    list = keep(list);
    if (!list.length) { el.innerHTML = `<div class="empty">${esc(emptyText)}</div>`; return list; }
    const lvl = (s) => (s >= 3 ? ["l3", "strong match"] : s >= 2 ? ["l2", "good match"] : ["l1", "possible"]);
    el.innerHTML = list.slice(0, limit || 999).map((x) => {
      const [c, word] = lvl(x.score);
      return `<li><a data-k="${x.key}" href="#${x.key}">${esc(labelOf(x.key))}</a><span class="lvl ${c}">${word}</span>
        <div class="hint">${esc(x.hint)}</div>
        <div class="why">${x.reasons.map((r) => `<span>${esc(r.text)}</span>`).join("")}</div><div class="jump" data-jk="${x.key}"></div></li>`;
    }).join("") + (limit && list.length > limit ? `<div class="muted">${list.length - limit} more: choose “all” above.</div>` : "");
    el.querySelectorAll("a[data-k]").forEach((a) => (a.onclick = (e) => { e.preventDefault(); go(a.dataset.k); }));
    return list;
  }

  function runAsk() {
    const q = $("sgq").value;
    if (!q.trim()) { $("sgaskres").innerHTML = ""; return []; }
    const list = render($("sgaskres"), R.ask(q), "No tool matched those words. Try the clinical problem (e.g. “low sodium”, “cellulitis”, “chest tube”), or use Find a tool in the header.");
    addSectionLinks($("sgaskres"), list.slice(0, 3), q);
    return list;
  }

  // ---- links straight to a heading inside a tab ----
  // Each tool's page is read once (same site, no patient data) for its section headings; the words you typed are matched against
  // the heading (strongest), a section's data-find words, and the section's fixed text. Rare words in that tool count most.
  const STOP = new Set("the and for with what which when how does do did can should would this that from into about after before have has had not are was were his her she him they them their there then than too very just also only any all some more most less patient pt chart tab tool help need want".split(" "));
  const stem = (w) => (w.length > 5 ? w.slice(0, 5) : w);
  const words = (t) => Array.from(new Set(String(t || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").split(" ").filter((w) => w.length >= 3 && !STOP.has(w)).map(stem)));
  const toks = (t) => String(t || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").split(" ").filter(Boolean);
  const has = (tokList, st) => tokList.some((x) => x.startsWith(st));
  const sectionCache = {};
  function loadSections(key) {
    if (sectionCache[key]) return sectionCache[key];
    const t = tools().find((x) => x.key === key); if (!t) return Promise.resolve([]);
    return (sectionCache[key] = fetch(t.path, { cache: "force-cache" }).then((r) => (r.ok ? r.text() : "")).then((html) => parseSections(new DOMParser().parseFromString(html, "text/html")))
      .then((out) => { if (!out.length) delete sectionCache[key]; return out.length ? out : liveSections(key); }).catch(() => liveSections(key)));
  }
  function parseSections(d) {
    const out = [];
    d.querySelectorAll("details").forEach((det) => {
      const sm = det.querySelector(":scope > summary"); if (!sm) return;
      const head = ((sm.querySelector("span") || sm).textContent || "").replace(/\s+/g, " ").trim(); if (!head || head.length > 90 || out.some((o) => o.head === head)) return;
      const body = det.cloneNode(true); body.querySelectorAll("summary, script, style").forEach((n) => n.remove());
      out.push({ head, h: toks(head), f: toks(det.getAttribute("data-find")), b: toks(body.textContent).slice(0, 400) });
    });
    return out;
  }
  // tabs that build their headings while loading: read them from the tab if it is already open
  function liveSections(key) {
    const f = document.querySelector(`#frames iframe[data-k="${key}"]`);
    try { return f && f.contentDocument && f.contentDocument.readyState === "complete" ? parseSections(f.contentDocument) : []; } catch (e) { return []; }
  }
  async function addSectionLinks(el, list, q) {
    const qs = words(q); if (!qs.length || qs.length > 25) return; // a pasted whole note is too broad for section links
    for (const x of list) {
      const secs = await loadSections(x.key); if (!secs.length) continue;
      // a word found in few headings of this tool (e.g. "bubbling") counts far more than one found in many ("chest", "tube")
      const idf = (st) => Math.pow(Math.log(1 + secs.length / (1 + secs.filter((s) => has(s.h, st)).length)), 2);
      const scored = secs.map((s) => ({ s, score: qs.reduce((a, st) => a + (has(s.h, st) ? 3 : has(s.f, st) ? 2 : has(s.b, st) ? 0.6 : 0) * idf(st), 0) }))
        .filter((z) => z.score > 0.9).sort((a, b) => b.score - a.score).slice(0, 3);
      const slot = el.querySelector(`.jump[data-jk="${x.key}"]`); if (!slot || !scored.length) continue;
      slot.innerHTML = scored.map((z) => `<a href="#" data-h="${esc(z.s.head)}" title="Open ${esc(labelOf(x.key))} at this heading">${esc(z.s.head)}</a>`).join("");
      slot.querySelectorAll("a").forEach((a) => (a.onclick = (e) => { e.preventDefault(); goSection(x.key, a.dataset.h, q); }));
    }
  }
  // Open the tab, wait for its page, then open and scroll to the heading (switching the tool's own sub-tab), and pick the matching
  // choice in a pull-down inside that section when the typed words point to one (e.g. "bubbling" -> Problem: Bubbling (air leak)).
  async function goSection(key, head, q) {
    go(key);
    const secs = await loadSections(key);
    // words in 3 or more headings of this tool ("chest", "tube" in the pleural tab) are too general to pick a choice from a pull-down
    const generic = (st) => secs.filter((s) => has(s.h, st)).length >= 3;
    const qs = words(q).filter((st) => !generic(st)), hw = toks(head), t0 = Date.now();
    const tick = () => {
      const f = document.querySelector(`#frames iframe[data-k="${key}"]`); let d = null;
      try { d = f && f.contentDocument; } catch (e) { return; }
      const target = d && Array.from(d.querySelectorAll("details > summary")).find((sm) => ((sm.querySelector("span") || sm).textContent || "").replace(/\s+/g, " ").trim() === head);
      // wait until the tool page has fully loaded (its pull-downs filled and its sub-tabs built), then a moment more
      if (!target || d.readyState !== "complete") { if (Date.now() - t0 < 10000) setTimeout(tick, 150); return; }
      if (!f.__sgSettled) { f.__sgSettled = true; setTimeout(tick, 250); return; }
      const det = target.parentElement;
      for (let p = det; p; p = p.parentElement && p.parentElement.closest("details")) p.open = true;
      // a pull-down in this section whose choice shares a word you typed that the heading does not
      const extra = qs.filter((st) => !has(hw, st));
      if (extra.length) det.querySelectorAll("select").forEach((sel) => {
        let best = null, bs = 0;
        let ties = 0;
        Array.from(sel.options).forEach((o) => { if (!o.value) return; const ot = toks(o.textContent), sc = extra.filter((st) => has(ot, st)).length; if (sc > bs) { bs = sc; best = o; ties = 0; } else if (sc && sc === bs) ties++; });
        // only when one choice clearly fits
        if (best && !ties) { sel.value = best.value; sel.dispatchEvent(new Event("change", { bubbles: true })); sel.dispatchEvent(new Event("input", { bubbles: true })); }
      });
      det.scrollIntoView({ block: "start" }); // the toolkit's sub-tabs switch to the tab holding it
      const was = det.style.outline; det.style.outline = "3px solid #f4b400"; det.style.outlineOffset = "2px";
      setTimeout(() => { det.style.outline = was; }, 2500);
    };
    setTimeout(tick, 100);
  }

  function renderChart() {
    $("sgstatus").textContent = state.chartStatus;
    if (state.loading) { $("sgchartres").innerHTML = ""; $("sgcount").textContent = ""; return; }
    const list = render($("sgchartres"), state.chart || [], window.TK_POCKET ? "Not connected to Cerner here: type or paste above." : "Nothing in the problem list, recent labs, meds or notes matched a tool.", state.limit);
    $("sgcount").textContent = list.length ? `(${list.length})` : "";
    const b = $("sgbtn"), strong = list.filter((x) => x.score >= 2).length;
    if (b) b.innerHTML = "🧭 Which tool?" + (strong ? `<span class="n">${strong}</span>` : "");
  }

  // ---- read the chart (read-only searches; each may fail on its own) ----
  const iso = (ms) => new Date(ms).toISOString().slice(0, 10);
  async function get(url, pages) {
    const c = state.client;
    let tm;
    try {
      const r = await Promise.race([c.request(url, { pageLimit: pages || 1, flat: true }), new Promise((_, rej) => { tm = setTimeout(() => rej(new Error("timed out")), 25000); })]);
      return (r || []).filter((x) => x && x.resourceType && x.resourceType !== "OperationOutcome");
    } catch (e) { state.errors.push(url.split("?")[0] + ": " + (e.message || e)); return []; }
    finally { clearTimeout(tm); }
  }
  const ccText = (cc) => (cc && (cc.text || ((cc.coding || []).find((x) => x.display) || {}).display)) || "";

  async function noteText(doc) {
    const atts = (doc.content || []).map((c) => c.attachment).filter(Boolean);
    const a = atts.find((x) => /text\/plain/i.test(x.contentType || "")) || atts.find((x) => /html|xml|rtf/i.test(x.contentType || "")) || null;
    if (!a) return "";
    let raw = "";
    if (a.data) { const bin = atob(a.data.replace(/\s+/g, "")); raw = new TextDecoder("utf-8").decode(Uint8Array.from(bin, (ch) => ch.charCodeAt(0))); }
    else if (a.url) {
      const c = state.client, url = new URL(a.url, c.state.serverUrl + "/").href, tok = c.state.tokenResponse && c.state.tokenResponse.access_token;
      const res = await fetch(url, { headers: Object.assign({ Accept: a.contentType || "text/plain" }, tok ? { Authorization: "Bearer " + tok } : {}) });
      if (!res.ok) return "";
      raw = await res.text();
    }
    if (/^\s*JVBER/.test(raw)) return ""; // a PDF inside: skip (the Notes tab can read those)
    if (/<[a-z!?][\s\S]*>/i.test(raw)) { const d = new DOMParser().parseFromString(raw, "text/html"); d.querySelectorAll("script,style").forEach((n) => n.remove()); raw = d.body ? d.body.textContent : raw.replace(/<[^>]+>/g, " "); }
    return raw.replace(/\s+/g, " ").slice(0, 20000);
  }

  async function readChart(force) {
    if (state.loading) return;
    if (window.TK_POCKET) { state.chart = []; state.chartStatus = ""; renderChart(); return; }
    state.loading = true; state.errors = []; state.chartStatus = "Reading problem list, labs, medications and recent notes…"; renderChart();
    const c = state.client, pid = c.patient.id;
    // A patient made from an imported PDF (Import PDF > Open as a separate patient) is read whatever the dates in the PDF
    const pdfOnly = /^pdfpt-/.test(String(pid)), since7 = pdfOnly ? "" : `&date=ge${iso(Date.now() - 7 * 864e5)}`, since3 = pdfOnly ? "" : `&date=ge${iso(Date.now() - 3 * 864e5)}`;
    const [pt, conds, obs, meds, docs] = await Promise.all([
      c.patient.read().catch(() => null),
      get(`Condition?patient=${pid}&clinical-status=active&_count=100`, 2),
      get(`Observation?patient=${pid}&category=laboratory${since7}&_count=100`, 4),
      get(`MedicationRequest?patient=${pid}&status=active&_count=100`, 2),
      get(`DocumentReference?patient=${pid}${since3}&_count=30`, 1)
    ]);
    const conditions = Array.from(new Set(conds.filter((x) => !/refuted|entered-in-error/.test(JSON.stringify(x.verificationStatus || ""))).map((x) => ccText(x.code)).filter(Boolean)));
    const medNames = Array.from(new Set(meds.map((m) => ccText(m.medicationCodeableConcept) || (m.medicationReference && m.medicationReference.display) || "").filter(Boolean)));
    let age = null;
    if (pt && pt.birthDate) { const b = new Date(pt.birthDate), n = new Date(); age = n.getFullYear() - b.getFullYear() - (n < new Date(n.getFullYear(), b.getMonth(), b.getDate()) ? 1 : 0); }
    // Newest ER / admission notes first (H&P, ED, consult), else the newest notes; up to 3
    const when = (d) => new Date(d.date || (d.context && d.context.period && d.context.period.start) || 0).getTime();
    const isAdmit = (d) => /emerg|\bed\b|\ber\b|admi|history and physical|h ?& ?p|consult/i.test(ccText(d.type) + " " + (d.description || ""));
    const pick = docs.filter((d) => d.status !== "entered-in-error").sort((a, b) => (isAdmit(b) - isAdmit(a)) || (when(b) - when(a))).slice(0, 3);
    let text = "", read = 0;
    for (const d of pick) { try { const t = await noteText(d); if (t) { text += "\n" + t; read++; } } catch (e) { /* skip that note */ } }
    state.chart = R.suggest({ labs: R.labsFromObs(obs), conditions, meds: medNames, age, text, textLabel: "Recent note mentions" });
    state.loading = false;
    state.chartStatus = `Read ${conditions.length} problems, ${obs.length} lab results${pdfOnly ? "" : " (7 days)"}, ${medNames.length} active meds, ${read} recent note${read === 1 ? "" : "s"}.` +
      (state.errors.length ? ` Could not read: ${state.errors.join("; ")}.` : "");
    renderChart();
    return state.chart;
  }

  async function init(client) {
    state.client = client;
    mount();
    renderChart();
    const list = keep((await readChart()) || []);
    let auto = true; try { auto = localStorage.getItem(AUTO_KEY) !== "0"; } catch (e) {}
    const seenKey = "tk-suggest-seen:" + client.patient.id;
    let seen = false; try { seen = sessionStorage.getItem(seenKey) === "1"; sessionStorage.setItem(seenKey, "1"); } catch (e) {}
    if (auto && !seen && !window.TK_POCKET && list.some((x) => x.score >= 2)) open(false);
  }

  window.TKSuggest = { init, open, readChart };
})();
