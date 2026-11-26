/* Hospital at Home – decision tools added to the HaH tab (sub-tabs):
   1. Escalation Risk Predictor – Victoria HaH, outcomes of 1000 patients (June 2023 – Sept 2024).
      Predicts the risk of escalation ("repatriation") from 4 predictors: severe heart failure, moderate frailty,
      metastatic cancer and sex, plus the cirrhosis gate (MELD-Na > 19 = NOT eligible).
   2. Asthma exacerbation transfer matrix (HaH, Feb 2026).
   3. Death in the Home decision matrix (HaH, Nov 2025).
   The rules (top half) also run in node for tests: node tests/test_hah_matrices.js */
(function (root) {
  // ---------- Rules ----------
  // Predicted risk (%) by [severe HF][moderately frail][metastatic cancer][male]
  const ESC_TABLE = [
    { hf: true,  frail: true,  met: true,  male: 45, female: 35 },
    { hf: true,  frail: true,  met: false, male: 31, female: 23 },
    { hf: true,  frail: false, met: true,  male: 26, female: 19 },
    { hf: true,  frail: false, met: false, male: 16, female: 11 },
    { hf: false, frail: true,  met: true,  male: 22, female: 15 },
    { hf: false, frail: true,  met: false, male: 13, female: 9 },
    { hf: false, frail: false, met: true,  male: 11, female: 7 },
    { hf: false, frail: false, met: false, male: 6,  female: 4 }
  ];
  const PREDICTORS = [
    { key: "hf",    label: "Severe heart failure",  yes: "Severe heart failure", no: "Not severe HF",
      help: "LVEF < 30% (+/- severe valvular dysfunction, +/- severe pulmonary hypertension)" },
    { key: "frail", label: "Moderately frail",      yes: "Moderately frail",     no: "Not moderately frail",
      help: "Before admission, needed help with at least 1 ADL, e.g. bathing or dressing" },
    { key: "met",   label: "Metastatic cancer",     yes: "Metastatic cancer",    no: "No metastatic cancer", help: "" },
    { key: "male",  label: "Sex",                   yes: "Male",                 no: "Female", help: "" }
  ];
  // one predictor value: true / false / null (not yet chosen)
  function escRisk(v) {
    const row = ESC_TABLE.find((r) => r.hf === v.hf && r.frail === v.frail && r.met === v.met);
    return row && typeof v.male === "boolean" ? (v.male ? row.male : row.female) : null;
  }
  // with some predictors unknown: lowest and highest possible risk
  function escRange(v) {
    let combos = [{}];
    PREDICTORS.forEach((p) => {
      const opts = typeof v[p.key] === "boolean" ? [v[p.key]] : [true, false];
      combos = combos.flatMap((c) => opts.map((o) => ({ ...c, [p.key]: o })));
    });
    const vals = combos.map(escRisk);
    return { min: Math.min(...vals), max: Math.max(...vals), exact: combos.length === 1 ? vals[0] : null, unknown: PREDICTORS.filter((p) => typeof v[p.key] !== "boolean").map((p) => p.label) };
  }
  function escBand(p) { return p == null ? null : p <= 10 ? "Low" : p <= 20 ? "Medium" : "High"; }
  // cirrhosis: "yes" / "no" / "" ; meld: number or NaN
  function cirrhosisGate(cirr, meld) {
    if (cirr !== "yes") return { code: cirr === "no" ? "ok" : "unk", text: cirr === "no" ? "No cirrhosis" : "Cirrhosis not answered" };
    if (meld == null || isNaN(meld)) return { code: "need", text: "Cirrhosis – enter MELD-Na (not eligible if > 19)" };
    return meld > 19 ? { code: "out", text: `Cirrhosis with MELD-Na ${meld} (> 19): NOT ELIGIBLE for Hospital at Home` }
                     : { code: "ok", text: `Cirrhosis with MELD-Na ${meld} (≤ 19): not excluded by MELD-Na` };
  }

  const ASTHMA_COLS = ["Appropriate for HaH transfer", "Respirologist opinion required", "Not appropriate for HaH transfer"];
  const ASTHMA = [
    { key: "pef",   label: "Peak flow",        opts: [">60–80% predicted or personal best", "40–60% predicted or personal best", "<40% predicted or personal best"] },
    { key: "spo2",  label: "Oxygen saturation", opts: ["At least 94% on room air", "90–94% on ≤ 4 L O2", "<90% on 4 L O2"] },
    { key: "wob",   label: "Work of breathing", opts: ["Full sentences; RR 16–20", "Phrases; RR 20–30", "Single words; RR > 30"] },
    { key: "hr",    label: "Heart rate",        opts: ["< 100 bpm", "100–120 bpm", "> 120 bpm"] },
    { key: "ms",    label: "Mental status",     opts: ["Alert and oriented", "Anxious or restless", "Confused, drowsy or exhausted"] },
    { key: "hx",    label: "History risk",      opts: ["No prior ICU / intubation", "Recent ED visit or OCS use", "Any history of ICU / intubation"] }
  ];
  // answers: { key: 0 | 1 | 2 | null }  -> worst column wins
  function asthmaResult(ans) {
    const vals = ASTHMA.map((m) => ans[m.key]).filter((x) => x === 0 || x === 1 || x === 2);
    const missing = ASTHMA.filter((m) => ![0, 1, 2].includes(ans[m.key])).map((m) => m.label);
    if (!vals.length) return { level: null, missing, drivers: [] };
    const level = Math.max(...vals);
    const drivers = ASTHMA.filter((m) => ans[m.key] === level && level > 0).map((m) => `${m.label}: ${m.opts[level]}`);
    return { level, text: ASTHMA_COLS[level], missing, drivers, provisional: missing.length > 0 && level < 2 };
  }

  const DEATH_COLS = [
    { key: "edith",   label: "Expected death – with EDITH form" },
    { key: "noedith", label: "Expected death – without EDITH form" },
    { key: "udnr",    label: "Unexpected natural death – DNR" },
    { key: "ufull",   label: "Unexpected natural death – Full resuscitation" },
    { key: "unnat",   label: "Unnatural death" }
  ];
  const DEATH_ROWS = [
    ["Coroner notification", ["No", "No", "No", "No", "Yes"]],
    ["Police notification", ["No", "No", "No", "No", "Yes"]],
    ["Ambulance attendance", ["No", "No", "No", "Yes", "Yes"]],
    ["Death certificate author", ["HaH physician", "HaH physician", "HaH physician", "HaH physician", "Coroner to determine"]],
    ["Disposition of body", ["Funeral home", "Hospital morgue", "Hospital morgue", "Hospital morgue", "Coroner to determine"]],
    ["Body transport", ["Funeral home", "Medivan", "Medivan", "Medivan", "Coroner to determine"]]
  ];
  function deathPlan(colKey) { const i = DEATH_COLS.findIndex((c) => c.key === colKey); return i < 0 ? null : DEATH_ROWS.map(([what, v]) => ({ what, value: v[i] })); }

  const rules = { ESC_TABLE, PREDICTORS, escRisk, escRange, escBand, cirrhosisGate, ASTHMA, ASTHMA_COLS, asthmaResult, DEATH_COLS, DEATH_ROWS, deathPlan };
  if (typeof module !== "undefined" && module.exports) { module.exports = rules; return; }

  // ---------- Screen ----------
  const doc = root.document, $ = (id) => doc.getElementById(id);
  const h = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const css = `
  details.mx { background:var(--card); border:1px solid var(--line); border-radius:8px; padding:0; }
  details.mx > summary { cursor:pointer; padding:10px 12px; font-weight:700; font-size:15px; list-style:none; }
  details.mx > summary::before { content:"▾ "; color:var(--muted); } details.mx:not([open]) > summary::before { content:"▸ "; }
  details.mx > .body { padding:0 12px 12px; }
  .mxgrid { display:grid; grid-template-columns:repeat(auto-fill, minmax(250px, 1fr)); gap:10px 16px; }
  .mxgrid label { font-size:12.5px; color:var(--muted); display:flex; flex-direction:column; gap:3px; }
  .mxgrid select, .mxgrid input { padding:7px 8px; border:1px solid var(--line); border-radius:6px; font:inherit; font-size:14px; color:var(--ink); background:#fff; }
  .mxgrid .hint { font-size:11.5px; } .mxgrid .chart { font-size:11.5px; color:#0b4a99; background:#eef4fb; border-radius:5px; padding:3px 6px; }
  .riskbox { border-radius:8px; padding:12px 16px; color:#fff; margin-bottom:10px; }
  .riskbox b { font-size:22px; display:block; } .riskbox.Low { background:var(--ok); } .riskbox.Medium { background:var(--warn); } .riskbox.High { background:var(--bad); }
  .riskbox.none { background:#eceff3; color:var(--ink); } .riskbox.out { background:#5b0010; }
  table.mxt { border-collapse:collapse; width:100%; font-size:13px; } .mxt th, .mxt td { border:1px solid var(--line); padding:4px 7px; text-align:left; vertical-align:top; }
  .mxt th { background:#eef4fb; } .mxt tr.hit td { outline:3px solid var(--accent); outline-offset:-3px; font-weight:700; background:#fffbe6; }
  .mxt td.Low { background:#e6f4ea; } .mxt td.Medium { background:#fff1dc; } .mxt td.High { background:#fde8e8; }
  .mxt td.sel { background:#fffbe6; font-weight:700; } .mxt .colsel { background:#d7e6f8; }
  .lvl0 { color:var(--ok); } .lvl1 { color:var(--warn); } .lvl2 { color:var(--bad); }
  .mxnote { font-size:12.5px; color:var(--muted); margin:6px 0; } .mxnote b { color:var(--ink); }`;

  const pre = {}; // chart suggestions { key: {value, why} }
  function sel(id, opts, val) { return `<select id="${id}"><option value="">— select —</option>${opts.map(([v, t]) => `<option value="${v}"${val === v ? " selected" : ""}>${h(t)}</option>`).join("")}</select>`; }
  function boolOf(id) { const v = $(id).value; return v === "1" ? true : v === "0" ? false : null; }

  function buildRisk() {
    const p = PREDICTORS.map((q) => `<label>${h(q.label)}${sel("esc_" + q.key, [["1", q.yes], ["0", q.no]], "")}
      ${q.help ? `<span class="hint">${h(q.help)}</span>` : ""}<span class="chart" id="esc_${q.key}_why" hidden></span></label>`).join("");
    return `<details class="mx" open><summary>Escalation Risk Predictor <span class="note">(risk of escalation / "repatriation" back to hospital)</span></summary><div class="body">
      <div id="escOut"></div>
      <div class="mxgrid">${p}
        <label>Cirrhosis${sel("esc_cirr", [["yes", "Cirrhosis"], ["no", "No cirrhosis"]], "")}<span class="chart" id="esc_cirr_why" hidden></span></label>
        <label>MELD-Na (if cirrhosis)<input id="esc_meld" type="number" min="6" max="40" step="1" placeholder="e.g. 14"><span class="hint">Not eligible for HaH if MELD-Na > 19 (calculate in the Liver tab)</span></label>
      </div>
      <div class="toolbar"><button type="button" id="escCopy">Copy for note</button> <button type="button" class="sec" id="escClear">Clear</button> <span class="note" id="escMsg"></span></div>
      <p class="mxnote"><b>Not</b> associated with increased risk: age, caregiver status, severe renal failure (baseline GFR &lt; 30), transplant status, home oxygen, chemotherapy.</p>
      <p class="mxnote">Based on the outcomes of 1000 Victoria HaH patients (June 2023 – Sept 2024). Bands: Low 0–10% · Medium 11–20% · High &gt; 20%. A predicted risk informs the discussion; it does not decide eligibility.</p>
    </div></details>
    <details class="mx"><summary>Full risk table</summary><div class="body"><div id="escTable"></div></div></details>`;
  }
  function riskValues() { const v = {}; PREDICTORS.forEach((q) => (v[q.key] = boolOf("esc_" + q.key))); return v; }
  function drawRisk() {
    const v = riskValues(), r = escRange(v), gate = cirrhosisGate($("esc_cirr").value, $("esc_meld").value === "" ? null : Number($("esc_meld").value));
    let box;
    if (gate.code === "out") box = `<div class="riskbox out"><b>Not eligible for Hospital at Home</b>${h(gate.text)}</div>`;
    else if (r.exact != null) box = `<div class="riskbox ${escBand(r.exact)}"><b>${r.exact}% – ${escBand(r.exact)} risk of escalation</b>${h(summaryLine(v))}</div>`;
    else box = `<div class="riskbox none"><b>${r.min}–${r.max}% so far</b>Still to choose: ${h(r.unknown.join(", "))}</div>`;
    if (gate.code === "need") box += `<div class="warn">${h(gate.text)}</div>`;
    else if (gate.code === "unk") box += `<p class="mxnote">Cirrhosis: answer below (cirrhosis with MELD-Na &gt; 19 is not eligible for HaH).</p>`;
    $("escOut").innerHTML = box;
    const rows = ESC_TABLE.flatMap((t) => [true, false].map((m) => ({ ...t, m, p: m ? t.male : t.female })));
    const hit = (x) => PREDICTORS.every((q) => { const want = v[q.key]; const have = q.key === "male" ? x.m : x[q.key]; return want == null || want === have; });
    $("escTable").innerHTML = `<table class="mxt"><thead><tr><th>Severe heart failure</th><th>Moderately frail</th><th>Metastatic cancer</th><th>Sex</th><th>Predicted risk</th></tr></thead><tbody>` +
      rows.map((x) => `<tr class="${r.exact != null && hit(x) ? "hit" : ""}"${r.exact == null && !hit(x) ? ' style="opacity:.35"' : ""}><td>${x.hf ? "Severe HF" : "Not severe HF"}</td><td>${x.frail ? "Moderately frail" : "Not mod frail"}</td><td>${x.met ? "Metastatic cancer" : "No metastatic cancer"}</td><td>${x.m ? "Male" : "Female"}</td><td class="${escBand(x.p)}">${x.p}%</td></tr>`).join("") +
      `</tbody></table><p class="mxnote">Rows that still fit your answers stay dark; the matching row is outlined.</p>`;
  }
  function summaryLine(v) { return PREDICTORS.map((q) => v[q.key] == null ? `${q.label}: ?` : v[q.key] ? q.yes : q.no).join(" · "); }
  function riskNote() {
    const v = riskValues(), r = escRange(v), gate = cirrhosisGate($("esc_cirr").value, $("esc_meld").value === "" ? null : Number($("esc_meld").value));
    const res = gate.code === "out" ? "NOT ELIGIBLE for HaH (cirrhosis, MELD-Na > 19)."
      : r.exact != null ? `Predicted escalation risk ${r.exact}% (${escBand(r.exact)}).` : `Predicted escalation risk ${r.min}–${r.max}% (not all predictors known: ${r.unknown.join(", ")}).`;
    return `HaH escalation risk (Victoria HaH predictor, n=1000, Jun 2023–Sep 2024): ${summaryLine(v)}; ${gate.text}. ${res}`;
  }

  function buildAsthma() {
    return `<details class="mx" open><summary>HaH transfer decision matrix: asthma exacerbation <span class="note">(Feb 2026)</span></summary><div class="body">
      <div id="asOut"></div>
      <div class="mxgrid">${ASTHMA.map((m) => `<label>${h(m.label)}${sel("as_" + m.key, m.opts.map((o, i) => [String(i), o]), "")}</label>`).join("")}</div>
      <div class="toolbar"><button type="button" id="asCopy">Copy for note</button> <button type="button" class="sec" id="asClear">Clear</button></div>
      <p class="mxnote">The worst row decides: any "Not appropriate" answer = not appropriate; otherwise any "Respirologist opinion" answer = get a respirologist opinion before transfer.</p>
    </div></details>
    <details class="mx"><summary>Full asthma matrix</summary><div class="body"><div id="asTable"></div></div></details>`;
  }
  function asthmaAnswers() { const a = {}; ASTHMA.forEach((m) => { const v = $("as_" + m.key).value; a[m.key] = v === "" ? null : Number(v); }); return a; }
  function drawAsthma() {
    const a = asthmaAnswers(), r = asthmaResult(a);
    const cls = r.level == null ? "none" : ["Low", "Medium", "out"][r.level];
    $("asOut").innerHTML = `<div class="riskbox ${cls}"><b>${r.level == null ? "Choose the findings below" : h(r.text) + (r.provisional ? " (so far)" : "")}</b>` +
      (r.drivers.length ? h("Because of: " + r.drivers.join("; ")) : r.level === 0 && !r.missing.length ? "All findings in the appropriate column." : "") +
      (r.missing.length && r.level != null ? `<div>Still to choose: ${h(r.missing.join(", "))}</div>` : "") + `</div>`;
    $("asTable").innerHTML = `<table class="mxt"><thead><tr><th>Assessment</th>${ASTHMA_COLS.map((c, i) => `<th class="lvl${i}">${h(c)}</th>`).join("")}</tr></thead><tbody>` +
      ASTHMA.map((m) => `<tr><th>${h(m.label)}</th>${m.opts.map((o, i) => `<td class="${a[m.key] === i ? "sel" : ""}">${h(o)}</td>`).join("")}</tr>`).join("") + `</tbody></table>`;
  }
  function asthmaNote() {
    const a = asthmaAnswers(), r = asthmaResult(a);
    const parts = ASTHMA.filter((m) => a[m.key] != null).map((m) => `${m.label}: ${m.opts[a[m.key]]}`);
    return `HaH asthma exacerbation transfer matrix (Feb 2026): ${parts.join("; ") || "no findings entered"}. Result: ${r.level == null ? "incomplete" : r.text + (r.missing.length ? " (not assessed: " + r.missing.join(", ") + ")" : "")}.`;
  }

  function buildDeath() {
    return `<details class="mx" open><summary>Death in the Home decision matrix <span class="note">(Nov 2025)</span></summary><div class="body">
      <div class="mxgrid"><label>Type of death${sel("dm_col", DEATH_COLS.map((c) => [c.key, c.label]), "")}</label></div>
      <div id="dmOut" style="margin-top:10px"></div>
    </div></details>
    <details class="mx"><summary>Full matrix and definitions</summary><div class="body"><div id="dmTable"></div>
      <p class="mxnote"><b>EDITH form:</b> Expected Death in the Home form · <b>Natural death:</b> a death attributable to natural causes ·
      <b>Unnatural death:</b> a death due to trauma or foul play · <b>DNR:</b> do not resuscitate using CPR · <b>Full resusc:</b> resuscitate using CPR.</p>
      <p class="mxnote">For an expected death, completing the EDITH form ahead of time lets the funeral home take the body directly (no morgue, no Medivan).</p></div></details>`;
  }
  function drawDeath() {
    const k = $("dm_col").value, plan = deathPlan(k), ci = DEATH_COLS.findIndex((c) => c.key === k);
    $("dmOut").innerHTML = plan ? `<table class="mxt" style="max-width:560px"><tbody>${plan.map((p) => `<tr><th>${h(p.what)}</th><td class="sel">${h(p.value)}</td></tr>`).join("")}</tbody></table>` : `<p class="mxnote">Choose the type of death to see who to notify, who writes the death certificate and where the body goes.</p>`;
    $("dmTable").innerHTML = `<table class="mxt"><thead><tr><th></th>${DEATH_COLS.map((c, i) => `<th class="${i === ci ? "colsel" : ""}">${h(c.label)}</th>`).join("")}</tr></thead><tbody>` +
      DEATH_ROWS.map(([w, v]) => `<tr><th>${h(w)}</th>${v.map((x, i) => `<td class="${i === ci ? "sel" : ""}">${h(x)}</td>`).join("")}</tr>`).join("") + `</tbody></table>`;
  }

  function copy(t, msgEl) {
    const done = () => { if (msgEl) { msgEl.textContent = "Copied"; setTimeout(() => (msgEl.textContent = ""), 1500); } };
    if (navigator.clipboard) navigator.clipboard.writeText(t).then(done, () => prompt("Copy:", t)); else prompt("Copy:", t);
  }

  function mountUI() {
    const st = doc.createElement("style"); st.textContent = css; doc.head.appendChild(st);
    $("escRisk").innerHTML = buildRisk(); $("asthma").innerHTML = buildAsthma(); $("death").innerHTML = buildDeath();
    doc.querySelectorAll("#escRisk select, #escRisk input").forEach((e) => (e.oninput = e.onchange = drawRisk));
    doc.querySelectorAll("#asthma select").forEach((e) => (e.onchange = drawAsthma));
    $("dm_col").onchange = drawDeath;
    $("escCopy").onclick = () => copy(riskNote(), $("escMsg"));
    $("asCopy").onclick = () => copy(asthmaNote());
    $("escClear").onclick = () => { doc.querySelectorAll("#escRisk select, #escRisk input").forEach((e) => (e.value = "")); doc.querySelectorAll("#escRisk .chart").forEach((e) => (e.hidden = true)); drawRisk(); };
    $("asClear").onclick = () => { doc.querySelectorAll("#asthma select").forEach((e) => (e.value = "")); drawAsthma(); };
    drawRisk(); drawAsthma(); drawDeath();
  }

  // ---------- Pre-fill from the chart (called by app.js once the notes, diagnoses and patient are read) ----------
  // Only suggestions: each one shows where it came from and can be changed.
  const RX = {
    ef: /\b(?:LV)?EF\b|ejection fraction/gi,
    sevValve: /severe (?:aortic|mitral|tricuspid) (?:stenosis|regurgitation|insufficiency)|severe pulmonary (?:arterial )?hypertension/i,
    met: /\bmetastatic\b|\bmetastas[ie]s\b|\bmets to\b|\bstage (?:iv|4)\b/i,
    metIgnore: /no (?:evidence of )?metasta|metastatic work-?up|rule out metasta|query metasta|\?\s*metasta/i,
    frailYes: /(?:needs?|needed|requires?|required|with) (?:help|assist(?:ance)?) (?:with|for) (?:\w+ ){0,3}(?:adls?|bathing|dressing|toileting|transfers|personal care)|dependent (?:for|with|in) (?:\w+ ){0,2}(?:adls?|bathing|dressing|personal care)|\bclinical frailty scale\s*(?:score)?\s*(?:of|=|:)?\s*[5-9]\b|\bCFS\s*(?:of|=|:)?\s*[5-9]\b/i,
    frailNo: /independent (?:with|for|in) (?:all )?(?:adls?|bathing|dressing|personal care)|\bclinical frailty scale\s*(?:score)?\s*(?:of|=|:)?\s*[1-4]\b|\bCFS\s*(?:of|=|:)?\s*[1-4]\b/i,
    cirr: /\bcirrho(?:sis|tic)\b/i,
    meld: /MELD[- ]?Na\s*(?:score)?\s*(?:of|=|:|is|was)?\s*(\d{1,2})\b/i
  };
  function snip(text, at, len) { const s = Math.max(0, at - 50); return (s ? "…" : "") + text.slice(s, at + len + 60).replace(/\s+/g, " ") + "…"; }
  function findNotes(re, ignore, notes, negFn) {
    for (const n of notes) {
      const rx = new RegExp(re.source, "gi"); let m;
      while ((m = rx.exec(n.text))) {
        if (!m[0]) { rx.lastIndex++; continue; }
        const ctx = n.text.slice(Math.max(0, m.index - 40), m.index + m[0].length + 40);
        if (ignore && ignore.test(ctx)) continue;
        if (negFn && negFn(n.text, m.index, m[0].length)) continue;
        return { n, m, why: `${n.type || "note"} ${String(n.date || "").slice(0, 10)}: ${snip(n.text, m.index, m[0].length)}` };
      }
    }
    return null;
  }
  function lowestEF(notes) {
    let best = null;
    for (const n of notes) {
      const rx = /\b(?:LV)?EF\b|ejection fraction/gi; let m;
      while ((m = rx.exec(n.text))) {
        const after = n.text.slice(m.index + m[0].length, m.index + m[0].length + 30);
        const v = /^\s*(?:of|is|was|=|:|estimated(?: at)?|~|approximately|approx\.?)?\s*(?:<|less than|≤|~)?\s*(\d{1,2})(?:\s*(?:-|–|to)\s*(\d{1,2}))?\s*%/i.exec(after);
        if (!v) continue;
        const ef = v[2] ? Math.max(+v[1], +v[2]) : +v[1];
        if (!best || ef < best.ef) best = { ef, why: `${n.type || "note"} ${String(n.date || "").slice(0, 10)}: ${snip(n.text, m.index, m[0].length + v[0].length)}` };
      }
    }
    return best;
  }
  function set(id, value, why) {
    const el = $(id); if (!el || el.value !== "") return; // never overwrite a choice already made
    el.value = value; const w = $(id + "_why"); if (w && why) { w.hidden = false; w.textContent = "From chart – confirm: " + why; }
  }
  function prefill(ctx) {
    try {
      const notes = ctx.notes || [], p = ctx.patient || {};
      const negFn = (t, i, l) => { try { return ctx.negated ? ctx.negated(t, i, l) : false; } catch (e) { return false; } };
      const condText = (ctx.conds || []).map((c) => (c.code && (c.code.text || ((c.code.coding || [])[0] || {}).display)) || "").filter(Boolean);
      const cnotes = condText.map((t) => ({ type: "Diagnosis list", date: "", text: t })).concat(notes);
      if (p.gender === "male" || p.gender === "female") set("esc_male", p.gender === "male" ? "1" : "0", "patient record sex: " + p.gender);
      const ef = lowestEF(notes);
      if (ef && ef.ef < 30) set("esc_hf", "1", `LVEF ${ef.ef}% – ${ef.why}`);
      else if (ef) { const valve = findNotes(RX.sevValve, null, notes, negFn); if (!valve) set("esc_hf", "0", `LVEF ${ef.ef}% – ${ef.why}`);
        else { const w = $("esc_hf_why"); w.hidden = false; w.textContent = `LVEF ${ef.ef}% but also "${valve.m[0]}" – decide (${valve.why})`; } }
      const met = findNotes(RX.met, RX.metIgnore, cnotes, negFn);
      if (met) set("esc_met", "1", met.why);
      const fy = findNotes(RX.frailYes, null, notes, negFn), fn = !fy && findNotes(RX.frailNo, null, notes, negFn);
      if (fy) set("esc_frail", "1", fy.why); else if (fn) set("esc_frail", "0", fn.why);
      const ci = findNotes(RX.cirr, /no (?:evidence of |signs of )?cirrho|non-?cirrhotic/i, cnotes, negFn);
      if (ci) {
        set("esc_cirr", "yes", ci.why);
        const ml = findNotes(RX.meld, null, notes, null);
        if (ml && $("esc_meld").value === "") $("esc_meld").value = ml.m[1];
      }
      drawRisk();
    } catch (e) { /* suggestions are optional */ }
  }

  root.HaHMatrices = Object.assign({ prefill }, rules);
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", mountUI); else mountUI();
})(typeof window !== "undefined" ? window : globalThis);
