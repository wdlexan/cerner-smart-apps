/* Antibiotic chooser - UI. Body map → site → regimens badged for this patient's criteria. Read-only; nothing is sent anywhere. */
(function () {
  const $ = (id) => document.getElementById(id);
  const R = window.AbxMapRules, C = window.AbxMapChart;
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const SITES = (window.INF_SITES || []).concat(window.ABXMAP_EXTRA_SITES || []);
  const byId = (id) => SITES.find((s) => s.id === id);
  const PAGES = {}; (window.ABX_CLASS_PAGES || []).forEach((c) => (PAGES[c.id] = c.page));
  const CLASS_NAME = { pen: "Penicillins", ceph: "Cephalosporins", carb: "Carbapenems", mrsa: "Anti-MRSA", ag: "Aminoglycosides", fq: "Fluoroquinolones", mac: "Macrolides/tetracyclines", uti: "TMP-SMX/urinary", anaer: "Clindamycin/metronidazole", cdiff: "C. difficile" };
  const PDF = window.ABXMAP_PDF || "../abx/abx-classes.pdf?v=20261119a"; // standalone page sets ABXMAP_PDF
  const TIERS = [["mild", "Mild / outpatient"], ["moderate", "Moderate / ward"], ["severe", "Severe / sepsis / ICU"], ["", "Show all"]];
  const state = { site: null, tier: "moderate", f: null, chartSites: [], susc: null };

  // ---- body map: hover + click ----
  const svg = $("body"), tip = $("tip");
  svg.querySelectorAll("g[data-site]").forEach((g) => {
    const s = byId(g.dataset.site); if (!s) return;
    const t = document.createElementNS("http://www.w3.org/2000/svg", "title"); t.textContent = s.label; g.prepend(t);
    g.addEventListener("mousemove", (e) => {
      const box = svg.parentElement.getBoundingClientRect();
      tip.textContent = s.label + (g.dataset.sub ? " (" + g.dataset.sub + ")" : ""); tip.style.display = "block";
      tip.style.left = e.clientX - box.left + 12 + "px"; tip.style.top = e.clientY - box.top - 8 + "px";
      svg.querySelectorAll(`g[data-site="${s.id}"] .org, g[data-site="${s.id}"] .skin`).forEach((x) => x.classList.add("hov"));
    });
    g.addEventListener("mouseleave", () => { tip.style.display = "none"; svg.querySelectorAll(".hov").forEach((x) => x.classList.remove("hov")); });
    g.addEventListener("click", (e) => { e.stopPropagation(); pick(s.id); });
  });
  SITES.forEach((s) => { const b = document.createElement("button"); b.textContent = s.label; b.dataset.site = s.id; b.onclick = () => pick(s.id); $("siteBtns").appendChild(b); });

  function markMap() {
    svg.querySelectorAll(".on, .chart").forEach((x) => x.classList.remove("on", "chart"));
    if (state.site) svg.querySelectorAll(`g[data-site="${state.site}"] .org, g[data-site="${state.site}"] .skin`).forEach((x) => x.classList.add("on"));
    state.chartSites.forEach((id) => svg.querySelectorAll(`g[data-site="${id}"] .org, g[data-site="${id}"] .skin`).forEach((x) => x.classList.add("chart")));
    $("siteBtns").querySelectorAll("button").forEach((b) => { b.classList.toggle("on", b.dataset.site === state.site); b.classList.toggle("chartsite", state.chartSites.includes(b.dataset.site)); });
  }

  function pick(id) {
    state.site = id;
    const s = byId(id);
    if (state.tier && !(s.abx || []).some((r) => r.tier === state.tier)) state.tier = (s.abx && s.abx[0] && s.abx[0].tier) || "";
    markMap(); draw();
    if (window.innerWidth < 860) $("panel").scrollIntoView({ behavior: "smooth" });
  }

  // ---- criteria ----
  const CK = { cSulfa: "sulfa", cPreg: "pregnant", cQt: "qtRisk", cVpa: "valproate", cWarf: "warfarin", cSero: "serotonergic", cStatin: "statinColch", cSteroid: "steroids", cCdiff: "cdiffHx" };
  function ctx() {
    const c = { allergy: $("cAllergy").value, crcl: $("cCrcl").value === "" ? null : +$("cCrcl").value,
      risks: { mrsa: $("rMrsa").checked, pseudo: $("rPseudo").checked, esbl: $("rEsbl").checked },
      otherAllergyText: state.f ? state.f.allergies.map((a) => a.sub).join(" ") : "", susc: state.susc };
    Object.entries(CK).forEach(([id, k]) => (c[k] = $(id).checked));
    return c;
  }
  document.querySelectorAll(".crit input, .crit select").forEach((el) => { el.oninput = draw; el.onchange = draw; });

  // ---- panel ----
  function rxCard(item, s) {
    const a = item.a, lab = { ok: "✓ fits", caution: "⚠ caution", avoid: "✗ avoid" }[a.status];
    const chips = a.classes.map((k) => (PAGES[k] ? `<a class="chip" target="_blank" rel="noopener" href="${PDF}#page=${PAGES[k]}">${esc(CLASS_NAME[k] || k)}: doses &amp; side effects</a>` : "")).join("");
    const idx = s.abx.indexOf(item.row);
    return `<div class="rx ${a.status}">
      <div class="set"><span class="badge b-${a.status}">${lab}</span>${esc(item.row.setting)} <span class="muted">· ${esc(item.row.tier)}</span></div>
      <div class="reg">${esc(item.row.regimen)}</div>
      ${a.notes.length ? `<ul>${a.notes.map((n) => `<li class="${n.s}">${esc(n.msg)}</li>`).join("")}</ul>` : ""}
      <div class="acts"><button data-use="${idx}">Use in note</button>${chips}</div></div>`;
  }
  const list = (h, items, open) => (items && items.length ? `<details${open ? " open" : ""}><summary>${h}</summary><ul>${items.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></details>` : "");

  function buildConsult(s, c, reasons) {
    const f = state.f, why = $("cWhy").value;
    const prob = f && f.probs.find((p) => s.match && s.match.test(p.text));
    const m = R.consultMsg({ drName: $("cDr").value.trim(), service: $("cSvc").value, name: f ? f.name : "", age: f ? f.age : null, sex: f ? f.sex : "", mrn: f ? f.mrn : "",
      site: s, problem: prob ? prob.text.replace(/\s+[A-Z]\d{2}(\.\d+)?$/, "").replace(/\s+Z\d\d.*$/, "") : "", tier: state.tier, abx: f ? f.cls.abx : [], susc: state.susc, allergy: c.allergy,
      reason: why === "other" ? "" : reasons[+why] || "", extra: $("cExtra").value, sig: (() => { try { return localStorage.getItem("consult-signoff") || ""; } catch (e) { return ""; } })() });
    $("cMsg").value = m.text; $("cWords").textContent = `~${m.words} words` + (m.words > 60 ? " – a bit long; trim before sending" : "");
  }
  function draw() {
    const s = state.site && byId(state.site);
    if (!s) return;
    const c = ctx(), ch = R.choose(s, state.tier, c);
    const tiersHtml = TIERS.filter(([t]) => !t || (s.abx || []).some((r) => r.tier === t)).map(([t, n]) => `<button data-tier="${t}" class="${state.tier === t ? "on" : ""}">${n}</button>`).join("");
    const al = R.allergyLines(s, c.allergy);
    const riskOn = Object.keys(c.risks).filter((k) => c.risks[k]);
    let h = `<h2>${esc(s.label)}</h2><div class="muted">${esc(s.sub || "")}${state.chartSites.includes(s.id) ? ' · <span class="from">on the problem list</span>' : ""}</div>
      <div class="tiers">${tiersHtml}</div>`;
    if (s.watch && s.watch.length) h += `<div class="alert red"><b>Red flag:</b> ${esc(s.watch[0])}</div>`;
    (s.cards || []).forEach((cd, i) => {
      const t = cd.table ? `<table style="width:100%;border-collapse:collapse;font-size:12.5px;margin:4px 0 8px">${"<tr>" + cd.table.head.map((x) => `<th style="text-align:left;border:1px solid var(--line);padding:3px 6px">${esc(x)}</th>`).join("") + "</tr>"}${cd.table.rows.map((r) => "<tr>" + r.map((x, j) => `<td style="border:1px solid var(--line);padding:3px 6px">${j ? esc(x) : "<b>" + esc(x) + "</b>"}</td>`).join("") + "</tr>").join("")}</table>` : "";
      h += `<details${i === 0 ? " open" : ""}><summary>Key decision: ${esc(cd.title)}</summary>${cd.items ? `<ul>${cd.items.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}${t}${cd.note ? `<p class="small muted">${esc(cd.note)}</p>` : ""}</details>`;
    });
    if (ch.matched.length) h += `<h3>Matches this patient's resistance risk (${riskOn.map((k) => ({ mrsa: "MRSA", pseudo: "Pseudomonas/hospital", esbl: "ESBL" })[k]).join(", ")})</h3>` + ch.matched.map((i) => rxCard(i, s)).join("");
    h += `<h3>${ch.matched.length ? "Standard choices" : "Choices"}</h3>` + (ch.main.length ? ch.main.map((i) => rxCard(i, s)).join("") : '<div class="muted">None at this severity – try another level.</div>');
    if (ch.ifRisk.length) h += `<details><summary>Only if risk factors (${ch.ifRisk.length}) – tick MRSA / Pseudomonas / ESBL above if they apply</summary>${ch.ifRisk.map((i) => rxCard(i, s)).join("")}</details>`;
    if (al.length) h += `<div class="alert warn"><b>Allergy alternatives for this site:</b><ul style="margin:4px 0 0 18px;padding:0">${al.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>`;
    h += list("Red flags / what to watch for", s.watch, true) + list("Likely organisms", s.organisms);
    if (s.ix) h += list("Tests before / with antibiotics", [].concat(s.ix.blood || [], s.ix.imaging || [], s.ix.other || []));
    h += list("Source control", s.source) + list("Duration", s.duration) + list("IV → PO", s.ivpo) + list("When to call ID", s.idc) + list("When to call a surgeon", s.surgeon);
    const svc = state.consultSvc || "ID";
    const reasons = svc === "ID" ? (s.idc || []) : (s.surgeon || []).concat(s.idc || []);
    h += `<details id="consultCard" open><summary>Consult message (ID / surgery / other) – ~50 words to text or Teams</summary>
      <div class="crit" style="margin:4px 0">
        <label>Service <select id="cSvc">${["ID", "General surgery", "Urology", "Orthopedics", "Neurosurgery", "GI", "IR", "Thoracic surgery", "ENT/OMFS", "Other"].map((x) => `<option${x === svc ? " selected" : ""}>${x}</option>`).join("")}</select></label>
        <label>Dr. <input id="cDr" style="width:140px" value="${esc(state.consultDr || "")}" placeholder="name"></label>
        <label>Why <select id="cWhy" style="max-width:360px">${reasons.map((r, i) => `<option value="${i}"${String(i) === String(state.consultWhy || 0) ? " selected" : ""}>${esc(r.length > 80 ? r.slice(0, 78) + "…" : r)}</option>`).join("")}<option value="other"${state.consultWhy === "other" ? " selected" : ""}>Other (type below)</option></select></label>
      </div>
      <input id="cExtra" style="width:100%;margin-bottom:4px" value="${esc(state.consultExtra || "")}" placeholder="Optional: one more fact or your own reason (e.g. 'Not improving after 72 h, fever 39')">
      <textarea id="cMsg" style="min-height:150px"></textarea>
      <div style="display:flex;justify-content:space-between;align-items:center"><span id="cWords" class="small muted"></span><button class="primary" id="cCopy">Copy message</button></div>
    </details>`;
    h += `<p class="small muted">Full class reference: <a target="_blank" rel="noopener" href="${PDF}">antibiotic classes PDF</a>. Same content as the Infections by site tab.</p>`;
    $("panel").innerHTML = h;
    buildConsult(s, c, reasons);
    ["cSvc", "cDr", "cWhy", "cExtra"].forEach((id) => { const el = $(id); el.oninput = el.onchange = () => {
      state.consultSvc = $("cSvc").value; state.consultDr = $("cDr").value; state.consultWhy = $("cWhy").value; state.consultExtra = $("cExtra").value;
      if (id === "cSvc") { state.consultWhy = 0; draw(); } else buildConsult(s, c, reasons); }; });
    $("cCopy").onclick = () => { $("cMsg").select(); try { navigator.clipboard.writeText($("cMsg").value); } catch (e) { document.execCommand("copy"); } $("cCopy").textContent = "Copied"; setTimeout(() => ($("cCopy").textContent = "Copy message"), 1200); };
    $("panel").querySelectorAll("[data-tier]").forEach((b) => (b.onclick = () => { state.tier = b.dataset.tier; draw(); }));
    $("panel").querySelectorAll("[data-use]").forEach((b) => (b.onclick = () => {
      const row = s.abx[+b.dataset.use], item = { row, a: R.assess(row.regimen, c) };
      $("note").value = R.note(s, row.tier, item, c);
    }));
  }
  $("copy").onclick = () => { $("note").select(); try { navigator.clipboard.writeText($("note").value); } catch (e) { document.execCommand("copy"); } };


  // ---- culture & sensitivities: screenshot (OCR in the browser) or pasted text ----
  const TESS = "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";
  function loadTess() { return window.Tesseract ? Promise.resolve() : new Promise((ok, bad) => { const sc = document.createElement("script"); sc.src = TESS; sc.onload = ok; sc.onerror = () => bad(new Error("could not load the OCR library (network blocked?) – paste the text instead")); document.head.appendChild(sc); }); }
  // grey, erase table gridlines (long dark runs), enlarge, black/white – Tesseract reads screen tables much better this way
  function prep(img) {
    const W = img.naturalWidth, H = img.naturalHeight, c = document.createElement("canvas"); c.width = W; c.height = H;
    const g = c.getContext("2d"); g.drawImage(img, 0, 0); const d = g.getImageData(0, 0, W, H), p = d.data, L = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i++) L[i] = 0.3 * p[4 * i] + 0.59 * p[4 * i + 1] + 0.11 * p[4 * i + 2];
    const dark = (v) => v < 160;
    for (let y = 0; y < H; y++) { let run = 0; for (let x = 0; x < W; x++) { run = dark(L[y * W + x]) ? run + 1 : 0; if (run > Math.max(40, W * 0.15)) { for (let xx = 0; xx < W; xx++) if (dark(L[y * W + xx])) L[y * W + xx] = 255; break; } } }
    for (let x = 0; x < W; x++) { let run = 0; for (let y = 0; y < H; y++) { run = dark(L[y * W + x]) ? run + 1 : 0; if (run > Math.max(20, H * 0.25)) { for (let yy = 0; yy < H; yy++) if (dark(L[yy * W + x])) L[yy * W + x] = 255; break; } } }
    for (let i = 0; i < W * H; i++) { p[4 * i] = p[4 * i + 1] = p[4 * i + 2] = L[i]; p[4 * i + 3] = 255; }
    g.putImageData(d, 0, 0);
    // enlarge the grey image smoothly first, then threshold (thresholding first gives blocky letters)
    const k = Math.max(1, Math.min(3, 2400 / W)), out = document.createElement("canvas"); out.width = Math.round(W * k); out.height = Math.round(H * k);
    const o = out.getContext("2d"); o.imageSmoothingEnabled = true; o.imageSmoothingQuality = "high"; o.drawImage(c, 0, 0, out.width, out.height);
    const od = o.getImageData(0, 0, out.width, out.height), q = od.data;
    for (let i = 0; i < q.length; i += 4) { const v = q[i] > 170 ? 255 : 0; q[i] = q[i + 1] = q[i + 2] = v; }
    o.putImageData(od, 0, 0); return out;
  }
  // Several results can be loaded (one per screenshot / pasted text / chart report); each keeps its own column.
  state.results = [];
  let worker = null;
  async function getWorker() {
    if (worker) return worker;
    await loadTess(); $("suscStatus").textContent = "Recognizing text (first time downloads the OCR program, ~10 s)…";
    worker = await Tesseract.createWorker("eng"); await worker.setParameters({ tessedit_pageseg_mode: "6", preserve_interword_spaces: "1" });
    return worker;
  }
  async function readImage(file, k, of) {
    const st = $("suscStatus"); st.textContent = "Reading screenshot" + (of > 1 ? ` ${k} of ${of}` : "") + " in this browser…";
    try {
      const url = URL.createObjectURL(file), img = new Image(); await new Promise((ok, bad) => { img.onload = ok; img.onerror = () => bad(new Error("not an image")); img.src = url; });
      const w = await getWorker(); const { data } = await w.recognize(prep(img)); URL.revokeObjectURL(url);
      $("suscText").value = data.text;
      return addResult(data.text, "screenshot (OCR)");
    } catch (e) { st.textContent = "Could not read the image: " + (e.message || e); return false; }
  }
  async function readImages(files) {
    files = files.filter(isImg); let added = 0;
    for (let i = 0; i < files.length; i++) if (await readImage(files[i], i + 1, files.length)) added++;
    if (worker) { try { await worker.terminate(); } catch (e) {} worker = null; }
    if (files.length > 1) $("suscStatus").textContent = `${added} of ${files.length} screenshots read. ` + $("suscStatus").textContent;
  }
  function addResult(text, src) {
    const p = R.parseSusc(text);
    if (!p.rows.length) { $("suscStatus").textContent = "No antibiotic results found in that " + (src.startsWith("screenshot") ? "screenshot – try cropping to the table, or paste the text." : "text."); return false; }
    const sig = JSON.stringify([p.organisms, p.rows, p.meta]);
    if (state.results.some((r) => r.sig === sig)) { $("suscStatus").textContent = "That result is already loaded."; return false; }
    const m = p.meta, label = [m.specimen && m.specimen + " culture", m.date, m.accession && "acc …" + m.accession.slice(-4), m.status].filter(Boolean).join(" · ");
    state.results.push({ p, src, sig, label });
    applyFlags(p); remerge(); return true;
  }
  function applyFlags(p) {
    const e = R.expandSusc(JSON.parse(JSON.stringify(p)));
    if (e.flags.mrsa) $("rMrsa").checked = true; if (e.flags.esbl) $("rEsbl").checked = true; if (p.organisms.some((o) => /pseudomonas/i.test(o))) $("rPseudo").checked = true;
  }
  function remerge() { state.susc = state.results.length ? R.mergeSusc(state.results) : null; drawSusc(); draw(); }
  function drawSusc() {
    const p = state.susc;
    if (!p) { $("suscOut").innerHTML = ""; $("suscStatus").textContent = ""; return; }
    const cols = p.cols, many = state.results.length > 1;
    const sel = (ri, c, v, inf) => `<select data-r="${ri}" data-c="${c}"${inf ? ` title="Inferred: ${esc(inf)} – not on the report"` : ""}>${["", "S", "I", "R"].map((x) => `<option${x === (v || "") ? " selected" : ""}>${x}</option>`).join("")}</select>`;
    const real = p.rows.map((r, i) => [r, i]).filter(([r]) => !r.derived), der = p.rows.filter((r) => r.derived);
    const srcs = [...new Set(state.results.map((r) => r.src))].join(", ");
    $("suscStatus").textContent = `${state.results.length} result${many ? "s" : ""} loaded (${srcs}) – check every row against the report. ${real.length} antibiotic(s)${p.flags.mrsa ? " · MRSA" : ""}${p.flags.esbl ? " · ESBL" : ""}${p.flags.cre ? " · carbapenemase" : ""}. Edit any cell that is wrong.`;
    const chips = state.results.map((r, ri) => `<div class="small" style="display:flex;gap:6px;align-items:center;margin-top:3px"><b>#${ri + 1}</b>
      <input data-lab="${ri}" value="${esc(r.label)}" placeholder="label, e.g. urine 20-Nov" style="flex:1;min-width:120px;max-width:340px;font-size:12px;padding:1px 4px">
      <span class="muted">${esc(r.p.organisms.join(", ") || "organism not read")}${r.p.meta.modified ? ' · <b style="color:var(--r-ink)">Modified</b>' : ""}</span>
      <button data-del="${ri}" title="Remove this result" style="padding:0 6px">×</button></div>`).join("");
    const warn = [];
    p.dupes.forEach((d) => warn.push(`Accession …${esc(d.accession.slice(-4))} is loaded ${d.ri.length} times (#${d.ri.map((i) => i + 1).join(", #")}) – usually an original and a Modified/corrected report. Keep the latest and remove the other.`));
    const seen = {};
    p.discord.forEach((d) => { (seen[d.org] = seen[d.org] || []).push(`${d.drug} ${d.vals.map((x) => `${x.v} in #${cols[x.i].ri + 1}`).join(" / ")}`); });
    Object.keys(seen).forEach((o) => warn.push(`<b>${esc(o)}</b> results differ between cultures: ${esc(seen[o].join("; "))}. Different isolates or a corrected report – the regimen badges use the worst result; check which is current.`));
    if (real.some(([r]) => r.footnote)) warn.push("* = the lab added a comment to that antibiotic – read it in PowerChart.");
    const allS = real.filter(([r]) => r.allS).map(([r]) => r.drug);
    $("suscOut").innerHTML = `${chips}
      ${warn.length ? `<div class="small" style="margin-top:6px;padding:6px 8px;border-radius:6px;background:var(--a-bg);color:var(--a-ink)">${warn.map((w) => "⚠ " + w).join("<br>")}</div>` : ""}
      <table class="stab"><tr><th>Antibiotic</th>${cols.map((c) => `<th>${many ? `<span class="muted">#${c.ri + 1}</span> ` : ""}${esc(c.org)}${c.label ? `<div class="small muted" style="font-weight:normal">${esc(c.label)}</div>` : ""}</th>`).join("")}</tr>
      ${real.map(([r, i]) => `<tr${r.discord ? ' style="outline:2px solid var(--r-ink)"' : ""}><td>${esc(r.drug)}${r.footnote ? " *" : ""}${r.allS ? ' <span class="small" title="Susceptible in every column">✓ all</span>' : ""}</td>${cols.map((_, c) => `<td class="s${r.results[c] || ""}"${r.inf[c] ? ' style="font-style:italic;opacity:.75"' : ""}>${sel(i, c, r.results[c], r.inf[c])}${r.mics[c] ? ` <span class="small muted">${esc(r.mics[c])}</span>` : ""}</td>`).join("")}</tr>`).join("")}</table>
      ${allS.length ? `<div class="small" style="margin-top:4px">Susceptible in every column: <b>${esc(allS.join(", "))}</b></div>` : ""}
      <div class="small muted" style="margin-top:4px">Italic cells are inferred (not on the report). ${many ? "Each screenshot keeps its own column; the same organism from two cultures is not merged." : "Paste or drop more screenshots to add other organisms or cultures."}</div>
      ${der.length ? `<div class="small muted" style="margin-top:4px">Inferred only (not on any report): ${der.map((r) => `${esc(r.drug)} ${R.worstOf(r.results)} (${esc(r.derived)})`).join(" · ")}</div>` : ""}`;
    $("suscOut").querySelectorAll("select").forEach((x) => (x.onchange = () => {
      const col = cols[+x.dataset.c], res = state.results[col.ri].p, drug = p.rows[+x.dataset.r].drug;
      let row = res.rows.find((r) => r.drug === drug);
      if (!row) { row = { drug, results: [], mic: "" }; res.rows.push(row); }
      row.results[col.oc] = x.value; row.results = Array.from({ length: Math.max(row.results.length, col.oc + 1) }, (_, k) => row.results[k] || "");
      remerge();
    }));
    $("suscOut").querySelectorAll("input[data-lab]").forEach((x) => (x.onchange = () => { state.results[+x.dataset.lab].label = x.value; remerge(); }));
    $("suscOut").querySelectorAll("button[data-del]").forEach((x) => (x.onclick = () => { state.results.splice(+x.dataset.del, 1); remerge(); }));
  }
  window.__abxPrep = prep; // for testing the image cleanup
  const drop = $("drop");
  ["dragenter", "dragover"].forEach((e) => drop.addEventListener(e, (ev) => { ev.preventDefault(); drop.classList.add("over"); }));
  ["dragleave", "drop"].forEach((e) => drop.addEventListener(e, (ev) => { ev.preventDefault(); drop.classList.remove("over"); }));
  // accept a drop anywhere on the page (so a near-miss never opens the image in place of the app), and files with no type (some snipping tools)
  const isImg = (f) => f && (/^image\//.test(f.type) || /\.(png|jpe?g|bmp|gif|webp|tiff?)$/i.test(f.name || ""));
  const dropped = (ev) => { const dt = ev.dataTransfer; if (!dt) return []; const fs = [...(dt.files || [])]; return (fs.length ? fs : [...(dt.items || [])].filter((i) => i.kind === "file").map((i) => i.getAsFile())).filter(isImg); };
  document.addEventListener("dragover", (ev) => { ev.preventDefault(); if (ev.dataTransfer) ev.dataTransfer.dropEffect = "copy"; });
  document.addEventListener("drop", (ev) => {
    ev.preventDefault(); drop.classList.remove("over");
    const fs = dropped(ev);
    if (fs.length) readImages(fs); else $("suscStatus").textContent = "Nothing readable was dropped – save or copy the screenshot as an image (PNG/JPG), or paste it with Ctrl+V.";
  });
  document.addEventListener("paste", (ev) => {
    if (ev.target && /textarea|input/i.test(ev.target.tagName)) return;
    const its = [...((ev.clipboardData && ev.clipboardData.items) || [])].filter((x) => x.kind === "file" && /^image\//.test(x.type));
    if (its.length) { ev.preventDefault(); readImages(its.map((x) => x.getAsFile())); } else { const t = ev.clipboardData && ev.clipboardData.getData("text"); if (t) { $("suscText").value = t; addResult(t, "pasted text"); } }
  });
  $("suscFile").onchange = () => { readImages([...$("suscFile").files]); $("suscFile").value = ""; };
  $("suscRead").onclick = () => addResult($("suscText").value, "pasted text");
  $("suscClear").onclick = () => { state.results = []; state.susc = null; $("suscText").value = ""; drawSusc(); draw(); };

  // ---- chart ----
  function prefill(f) {
    const set = (id, v) => ($(id).checked = !!v);
    const ac = C.allergyCtx(f.allergies);
    $("cAllergy").value = ac.allergy; set("cSulfa", ac.sulfa);
    $("allergyFrom").hidden = !ac.why.length; $("allergyFrom").textContent = ac.why.length ? "chart: " + ac.why.join("; ") : "";
    const kg = f.kg && f.kg.v, cr = f.cr && f.cr.v, cl = R.crcl(f.age, kg, cr, f.sex);
    $("cCrcl").value = cl != null ? cl : "";
    set("rMrsa", f.micro.mrsa.length); set("rEsbl", f.micro.esbl.length); set("rPseudo", f.micro.pseudo.length || f.probs.some((p) => /hospital.acquired|ventilator|\bhap\b|\bvap\b|nosocomial|neutropeni/i.test(p.text)));
    set("cPreg", f.pregnant); set("cQt", (f.qtc && f.qtc.v >= 470) || f.cls.qtDrug.length >= 2); set("cVpa", f.cls.valproate.length); set("cWarf", f.cls.warfarin.length);
    set("cSero", f.cls.serotonergic.length); set("cStatin", f.cls.statinColch.length); set("cSteroid", (f.age || 0) >= 65 || f.cls.steroids.length); set("cCdiff", f.micro.cdiff.length);
    const why = [];
    if (cl != null) why.push(`CrCl ${cl} (Cockcroft-Gault: age ${f.age}, ${kg} kg, Cr ${cr})`); else why.push("CrCl: no recent creatinine/weight – type it");
    if (f.micro.mrsa.length) why.push("MRSA in past results/problems"); if (f.micro.esbl.length) why.push("ESBL/CRE in past results"); if (f.micro.pseudo.length) why.push("Pseudomonas in past results");
    if (f.qtc) why.push(`QTc ${f.qtc.v}`); ["valproate", "warfarin", "serotonergic", "statinColch", "steroids"].forEach((k) => f.cls[k].length && why.push(f.cls[k][0]));
    if (f.pregnant) why.push("pregnancy on problem list");
    if (f.cls.abx.length) why.push("current antibiotics: " + f.cls.abx.join("; "));
    $("critFrom").textContent = "From the chart: " + why.join(" · ");
    state.results = []; state.susc = null;
    const reps = (f.microReports || []).filter((m) => R.parseSusc(m.text).rows.length).slice(0, 4); // newest 4 culture results, each its own column
    reps.forEach((rep) => { if (!addResult(rep.text, "chart")) return; const r = state.results[state.results.length - 1]; if (r && rep.t && !r.p.meta.date) r.label = [r.label, new Date(rep.t).toLocaleDateString("en-CA")].filter(Boolean).join(" · "); });
    if (state.results.length) remerge(); else drawSusc();
    state.chartSites = SITES.filter((s) => s.match && f.probs.some((p) => s.match.test(p.text))).map((s) => s.id);
    if (state.chartSites.length) pick(state.chartSites[0]); else markMap();
  }

  function load(raw, msg, errors) {
    state.f = raw ? C.parse(raw) : null;
    const p = raw && raw.patient;
    $("ptLine").textContent = p ? [state.f.age != null ? state.f.age + " y" : "", state.f.sex].filter(Boolean).join(" · ") : "";
    $("pstatus").textContent = msg;
    $("errs").textContent = errors && errors.length ? "Could not read: " + errors.join("; ") : "";
    if (state.f) prefill(state.f); else { state.chartSites = []; markMap(); }
    draw();
  }
  const SAMPLES = window.ABXMAP_SAMPLES || [];
  SAMPLES.forEach((p, i) => { const o = document.createElement("option"); o.value = i; o.textContent = p.label; $("testsel").appendChild(o); });
  $("testsel").onchange = () => { const p = SAMPLES[$("testsel").value]; if (!p) return load(null, "Open from Cerner to read the chart, or pick a made-up patient:"); load(p.build(Date.now()), "Made-up patient", []); };

  async function fromChart() {
    if (typeof FHIR === "undefined" || !(location.search.includes("code=") || location.search.includes("complete=") || sessionStorage.getItem("SMART_KEY"))) return false;
    $("pstatus").textContent = "Reading the chart…";
    try { const client = await FHIR.oauth2.ready(); const { raw, errors } = await C.gather(client, (m) => ($("pstatus").textContent = m)); load(raw, "Chart read (read-only).", errors); return true; }
    catch (e) { $("pstatus").textContent = "Could not read the chart: " + (e && e.message ? e.message : e) + ". The made-up patients still work."; return false; }
  }
  markMap();
  const demo = new URLSearchParams(location.search).get("demo");
  fromChart().then((ok) => { if (!ok && demo && SAMPLES[+demo - 1]) { $("testsel").value = +demo - 1; $("testsel").onchange(); } });
})();
