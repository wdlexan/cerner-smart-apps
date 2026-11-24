/* Heart failure page - "Labs from a screenshot": drop / paste a screenshot (or text) of PowerChart lab results and the values
   are read in this browser (Tesseract OCR), shown for checking, then added to the page as if they came from the chart.
   Works with a single-result list ("Sodium 136 mmol/L") and with flowsheet rows of several results ("Creatinine 112 118 131").
   Nothing is sent anywhere. Written by Claude. UNVERIFIED: always check the numbers against PowerChart. */
(function () {
  const NAMES = { nt: ["NT-proBNP", "ng/L"], bnp: ["BNP", "ng/L"], na: ["Sodium", "mmol/L"], k: ["Potassium", "mmol/L"], cr: ["Creatinine", "umol/L"], egfr: ["eGFR", "mL/min/1.73m2"],
    urea: ["Urea", "mmol/L"], mg: ["Magnesium", "mmol/L"], hco3: ["Bicarbonate (total CO2)", "mmol/L"], hb: ["Hemoglobin", "g/L"], ferritin: ["Ferritin", "ug/L"], tsat: ["Iron saturation", "%"],
    tsh: ["TSH", "mU/L"], a1c: ["Hemoglobin A1c", "%"], trop: ["Troponin (hs)", "ng/L"], alb: ["Albumin", "g/L"], alt: ["ALT", "U/L"], una: ["Urine sodium", "mmol/L"],
    flc: ["Free light chain ratio (kappa/lambda)", ""], spep: ["Protein electrophoresis / IFE", ""] };
  const MON = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
  const DATE_RE = /(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:\s+(\d{1,2}):(\d{2}))?|(\d{1,2})[- ](jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[- ](\d{2,4})(?:\s+(\d{1,2}):(\d{2}))?|\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.? (\d{1,2})(?:,? (\d{4}))?(?:\s+(\d{1,2}):(\d{2}))?/gi;

  // dates in a line, with their position (character index, or cell index when the line is tab-separated)
  function dates(line, now) {
    const out = []; let m; const re = new RegExp(DATE_RE.source, "gi"), yr = new Date(now || Date.now()).getFullYear();
    while ((m = re.exec(line))) {
      let d = null;
      if (m[1]) d = new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0));
      else if (m[6] && MON[m[7].toLowerCase()] != null) { let y = +m[8]; if (y < 100) y += 2000; d = new Date(y, MON[m[7].toLowerCase()], +m[6], +(m[9] || 0), +(m[10] || 0)); }
      else if (m[11] && MON[m[11].toLowerCase()] != null) d = new Date(m[13] ? +m[13] : yr, MON[m[11].toLowerCase()], +m[12], +(m[14] || 0), +(m[15] || 0));
      if (d && !isNaN(d)) out.push({ t: d.getTime(), pos: m.index });
    }
    return out;
  }

  // Blank out (keeping positions) what is not a result: reference ranges, dates, times, eGFR's "1.73 m2", bracketed text.
  const blank = (s, re) => s.replace(re, (x) => " ".repeat(x.length));
  function clean(rest) {
    let r = blank(rest, new RegExp(DATE_RE.source, "gi"));
    [/\b\d{1,2}:\d{2}\b/g, /1\.73\s*m\s*[2²]?/gi, /[([{][^)\]}]*[)\]}]/g, /(?:ref(?:erence)?(?: range)?|normal)\s*:?\s*[<>]?\s*\d+(?:[.,]\d+)?(?:\s*(?:-|–|to)\s*\d+(?:[.,]\d+)?)?/gi,
      /\b\d+(?:[.,]\d+)?\s*(?:-|–)\s*\d+(?:[.,]\d+)?\b/g].forEach((re) => (r = blank(r, re)));
    return r;
  }
  const cellOf = (line, pos) => (line.slice(0, pos).match(/\t/g) || []).length;

  /* text -> [{ id, name, v, unit, cmp, flag, t }]. order: "newestFirst" | "newestLast" (used when there are no dates). */
  function parseLabs(text, LABS, opts) {
    opts = opts || {}; const now = opts.now || Date.now(), order = opts.order || "newestFirst", out = [];
    const lines = String(text || "").replace(/\r/g, "").split("\n").map((l) => l.replace(/[|¦]/g, " ").replace(/\s+$/, "")).filter((l) => l.trim());
    let header = null; // { ds: [{t,pos}], tabs }
    lines.forEach((line0) => {
      const line = line0, tabs = line.includes("\t"), ds = dates(line, now);
      const split = line.match(/^(\s*)([A-Za-z][^\s]*(?:[ ][A-Za-z(][^\s]*)*?)\s+(?=[<>]?\s*\d)/);
      const name = split ? split[2] : line.trim(), def = LABS.find((d) => d.re.test(name) && !(d.not && d.not.test(name)) && !(d.only && !d.only.test(name)));
      if (!def) { if (ds.length >= 2 || (ds.length === 1 && !/\d+\s*(?:mmol|umol|µmol|g\/l|ng|%)/i.test(line))) header = { ds: ds.map((d) => ({ t: d.t, pos: tabs ? cellOf(line, d.pos) : d.pos })), tabs }; return; }
      const off = split ? split[1].length + split[2].length : line.length, rest = clean(line.slice(off));
      const vals = [...rest.matchAll(/([<>]=?)?\s*(\d+(?:[.,]\d+)?)\s*([HLhl*!]{0,2})(?![\d/.])/g)].map((m) => ({ cmp: m[1] || "", v: parseFloat(m[2].replace(",", ".")), flag: m[3] || "", pos: off + m.index + m[0].search(/\d/) }));
      if (!vals.length) return;
      const unit = (rest.match(/(mmol\/L|umol\/L|µmol\/L|mg\/dL|g\/L|g\/dL|ng\/L|pg\/mL|ug\/L|µg\/L|mU\/L|U\/L|IU\/L|mL\/min|%)/i) || [])[1] || NAMES[def.id][1];
      const own = ds.length >= vals.length ? ds : null, n = vals.length;
      vals.forEach((x, i) => {
        let t = null;
        if (own) t = own[i].t;
        else if (header && header.ds.length >= n) {
          const p = header.tabs && tabs ? cellOf(line, x.pos) : x.pos;
          t = header.ds.slice().sort((a, b) => Math.abs(a.pos - p) - Math.abs(b.pos - p))[0].t;
        }
        if (t == null) { const age = order === "newestFirst" ? i : n - 1 - i; t = (opts.when != null ? opts.when : now) - age * 864e5; }
        out.push({ id: def.id, name: NAMES[def.id][0], v: x.v, cmp: x.cmp, flag: x.flag, unit, t });
      });
    });
    return out;
  }

  // entries -> FHIR Observations the page's chart reader understands
  function toObs(entries, LABS) {
    return entries.filter((e) => e.id && isFinite(e.v) && e.t).map((e) => {
      const def = LABS.find((d) => d.id === e.id), loinc = def && def.loinc[0];
      return { resourceType: "Observation", status: "final", _shot: true, category: [{ coding: [{ code: "laboratory" }] }],
        code: { coding: loinc ? [{ system: "http://loinc.org", code: loinc, display: NAMES[e.id][0] }] : [], text: NAMES[e.id][0] },
        effectiveDateTime: new Date(e.t).toISOString(), valueQuantity: { value: e.v, unit: e.unit || NAMES[e.id][1] } };
    });
  }

  const SAMPLE = `Results Review          24-Nov-2026 05:40   23-Nov-2026 06:10   22-Nov-2026 21:15
Sodium                  134 L               136                 138
Potassium               3.4 L               3.9                 4.4
Creatinine              131 H               118 H               104
eGFR                    44                  50                  59
Total CO2               31 H                29                  26
Magnesium               0.68 L              0.74                0.81
NT-proBNP                                                       8450 H
Troponin I hs           38 H                41 H
Hemoglobin              118 L               121                 124`;

  const api = { parseLabs, toObs, dates, NAMES, SAMPLE };
  if (typeof module !== "undefined" && module.exports) { module.exports = api; return; }

  /* ---------- page ---------- */
  const $ = (id) => document.getElementById(id), esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const LABS = () => (window.CHFChart && window.CHFChart.LABS) || [];
  const TESS = "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";
  const loadTess = () => (window.Tesseract ? Promise.resolve() : new Promise((ok, bad) => { const sc = document.createElement("script"); sc.src = TESS; sc.onload = ok; sc.onerror = () => bad(new Error("could not load the picture reader (network blocked?): paste the text instead")); document.head.appendChild(sc); }));
  let rows = [], worker = null;
  const local = (t) => { const d = new Date(t - new Date(t).getTimezoneOffset() * 6e4); return d.toISOString().slice(0, 16); };

  function table() {
    const box = $("ls-rows"); if (!box) return;
    if (!rows.length) { box.innerHTML = '<div class="muted">No lab values read yet.</div>'; $("ls-use").disabled = true; return; }
    $("ls-use").disabled = false;
    const opts = (sel) => Object.entries(NAMES).map(([k, [n]]) => `<option value="${k}" ${k === sel ? "selected" : ""}>${esc(n)}</option>`).join("");
    box.innerHTML = `<table><tr><th>Lab</th><th>Value</th><th>Unit</th><th>Date and time</th><th></th></tr>` +
      rows.map((r, i) => `<tr><td><select data-i="${i}" data-k="id">${opts(r.id)}</select></td><td><input type="number" step="any" data-i="${i}" data-k="v" value="${r.v}" style="width:90px">${r.cmp ? " <span class='muted'>(" + esc(r.cmp) + ")</span>" : ""}${/h/i.test(r.flag) ? ' <span class="flag">H</span>' : /l/i.test(r.flag) ? ' <span class="flag">L</span>' : ""}</td>` +
        `<td><input data-i="${i}" data-k="unit" value="${esc(r.unit)}" size="12"></td><td><input type="datetime-local" data-i="${i}" data-k="t" value="${local(r.t)}"></td><td><button data-del="${i}" title="Remove">✕</button></td></tr>`).join("") + "</table>";
    box.querySelectorAll("[data-k]").forEach((el) => (el.onchange = () => { const r = rows[+el.dataset.i], k = el.dataset.k; r[k] = k === "v" ? parseFloat(el.value) : k === "t" ? new Date(el.value).getTime() : el.value; if (k === "id") r.unit = NAMES[r.id][1]; }));
    box.querySelectorAll("[data-del]").forEach((b) => (b.onclick = () => { rows.splice(+b.dataset.del, 1); table(); }));
  }

  function read(text, src) {
    const got = parseLabs(text, LABS(), { order: $("ls-order").value, when: $("ls-when").value ? new Date($("ls-when").value).getTime() : null });
    rows = rows.concat(got); table();
    $("ls-status").textContent = got.length ? `Read ${got.length} value${got.length > 1 ? "s" : ""} from the ${src}. Check every number against PowerChart, fix any here, then press "Add these labs to the page".` : `No known lab names found in the ${src}. Crop the screenshot to the results, or paste the text.`;
  }

  async function readImages(files) {
    const st = $("ls-status"); st.textContent = "Reading the picture in this browser… (first time takes ~10 s)";
    try {
      await loadTess(); if (!worker) { worker = await Tesseract.createWorker("eng"); await worker.setParameters({ tessedit_pageseg_mode: "6", preserve_interword_spaces: "1" }); }
      for (const f of files) { const { data } = await worker.recognize(f); $("ls-text").value = ($("ls-text").value ? $("ls-text").value + "\n" : "") + data.text; read(data.text, "screenshot"); }
    } catch (e) { st.textContent = (e && e.message) || String(e); }
  }

  function apply() {
    if (typeof state === "undefined" || typeof C === "undefined") return;
    const good = rows.filter((r) => r.id && isFinite(r.v) && r.t);
    const base = state.raw ? Object.assign({}, state.raw) : { patient: null, conditions: [], obs: [], medreqs: [], admins: [], _shotOnly: true };
    const age = parseFloat($("ls-age").value);
    if (base._shotOnly && isFinite(age)) base.patient = { resourceType: "Patient", birthDate: new Date(Date.now() - (age + 0.5) * 365.25 * 864e5).toISOString().slice(0, 10) };
    base.obs = (base.obs || []).filter((o) => !o._shot).concat(toObs(good, LABS()));
    state.raw = base; state.f = C.parse(base);
    if (typeof window.draw === "function") window.draw();
    $("ls-status").textContent = `Added ${good.length} lab value${good.length === 1 ? "" : "s"} to the page (tiles, NT-proBNP, creatinine trend, alerts and note now use them). They stay only until you reload.` + (base._shotOnly ? " No chart is open, so medicines are unknown: ignore the GDMT pillars tile." : "");
    $("lssum").textContent = good.length + " from screenshot";
  }
  function removeAll() {
    rows = []; table(); $("ls-text").value = ""; $("lssum").textContent = "";
    if (typeof state !== "undefined" && state.raw) { state.raw = Object.assign({}, state.raw, { obs: (state.raw.obs || []).filter((o) => !o._shot) }); state.f = C.parse(state.raw); if (typeof window.draw === "function") window.draw(); }
    $("ls-status").textContent = "Screenshot labs removed.";
  }

  function mount() {
    if (!$("ls-drop")) return;
    const ageVis = () => ($("ls-agewrap").style.display = typeof state !== "undefined" && state.raw && !state.raw._shotOnly ? "none" : "");
    setInterval(ageVis, 1500); ageVis();
    const drop = $("ls-drop");
    drop.addEventListener("dragover", (e) => { e.preventDefault(); drop.classList.add("over"); });
    drop.addEventListener("dragleave", () => drop.classList.remove("over"));
    drop.addEventListener("drop", (e) => { e.preventDefault(); drop.classList.remove("over"); const fs = [...e.dataTransfer.files].filter((f) => f.type.startsWith("image/")); if (fs.length) readImages(fs); else { const t = e.dataTransfer.getData("text"); if (t) { $("ls-text").value = t; read(t, "text"); } } });
    drop.onclick = (e) => { if (e.target === drop || e.target.classList.contains("dz")) $("ls-file").click(); };
    $("ls-file").onchange = (e) => { const fs = [...e.target.files]; if (fs.length) readImages(fs); e.target.value = ""; };
    // Ctrl+V anywhere on the Assess tab area while this card is open, or in the text box
    document.addEventListener("paste", (ev) => {
      const card = $("ls-card"); if (!card || !card.open || card.offsetParent === null) return;
      if (ev.target && ev.target.id !== "ls-text" && /^(INPUT|TEXTAREA|SELECT)$/.test(ev.target.tagName)) return;
      const its = [...((ev.clipboardData && ev.clipboardData.items) || [])].filter((i) => i.type.startsWith("image/"));
      if (its.length) { ev.preventDefault(); readImages(its.map((i) => i.getAsFile())); }
      else if (ev.target && ev.target.id === "ls-text") setTimeout(() => read($("ls-text").value, "text"), 0);
    });
    $("ls-readtext").onclick = () => { rows = []; read($("ls-text").value, "text"); };
    $("ls-sample").onclick = () => { $("ls-text").value = SAMPLE; rows = []; read(SAMPLE, "made-up results"); };
    $("ls-add").onclick = () => { rows.push({ id: "cr", name: "Creatinine", v: NaN, unit: "umol/L", t: Date.now(), cmp: "", flag: "" }); table(); };
    $("ls-use").onclick = apply; $("ls-clear").onclick = removeAll;
    table();
  }
  window.CHFLabShot = Object.assign({}, api, { mount });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount); else mount();
})();
