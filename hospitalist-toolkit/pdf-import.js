/* Hospitalist Toolkit shell: "Import PDF" button. Reads a PDF in the browser (pdf.js), finds labs, vitals, medications, procedures and diagnoses,
   shows them for the physician to tick and correct, then stores the accepted items for this browser tab so every tool tab can see them (pdf-overlay.js).
   No PDF content leaves the browser. Text PDFs only (scanned images have no text and need OCR, which is not included). UNVERIFIED draft written by Claude. */
(function () {
  const PDFJS = "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js", WORKER = "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js";
  const KEY = (pid) => "pdfimport:" + pid;
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const X = () => window.PdfExtract;
  const pid = () => (window.TK && window.TK.patientId) || null;
  const store = () => { try { return JSON.parse(sessionStorage.getItem(KEY(pid())) || "null") || { items: [], files: [] }; } catch (e) { return { items: [], files: [] }; } };
  const save = (st) => sessionStorage.setItem(KEY(pid()), JSON.stringify(st));

  const css = document.createElement("style");
  css.textContent = `
  #pdfbar { display:flex; gap:8px; align-items:center; }
  #pdfbar button { background:#fff; color:#0b6bcb; border:0; border-radius:6px; padding:4px 10px; font-size:13px; cursor:pointer; }
  #pdfbar .cnt { font-size:12px; opacity:.95; }
  #pdfmodal { position:fixed; inset:0; background:rgba(0,0,0,.45); z-index:50; display:none; align-items:flex-start; justify-content:center; overflow:auto; padding:24px 12px; }
  #pdfmodal.on { display:flex; }
  #pdfbox { background:#fff; color:#1f2933; max-width:1100px; width:100%; border-radius:10px; padding:16px 18px; font-size:13.5px; box-shadow:0 10px 40px rgba(0,0,0,.3); }
  #pdfbox h2 { margin:0 0 6px; font-size:17px; } #pdfbox .muted { color:#6b7785; font-size:12.5px; }
  #pdfdrop { border:2px dashed #9db4cf; border-radius:10px; padding:26px; text-align:center; margin:10px 0; background:#f5f9ff; }
  #pdfdrop.hot { background:#e3eefc; border-color:#0b6bcb; }
  #pdfbox table { border-collapse:collapse; width:100%; font-size:12.5px; } #pdfbox th, #pdfbox td { text-align:left; padding:4px 6px; border-bottom:1px solid #dde3ea; vertical-align:top; }
  #pdfbox input[type=text], #pdfbox input[type=date] { font:inherit; font-size:12.5px; padding:2px 4px; border:1px solid #cbd5e0; border-radius:4px; }
  #pdfbox .warn { background:#fff4e5; border:1px solid #f0c27b; border-radius:8px; padding:8px 12px; margin:8px 0; }
  #pdfbox .bad { color:#b00020; } #pdfbox .src { color:#6b7785; font-family:ui-monospace,Consolas,monospace; font-size:11.5px; max-width:340px; }
  #pdfbox button { font:inherit; font-size:13px; padding:5px 12px; border:1px solid #cbd5e0; border-radius:6px; background:#fff; cursor:pointer; }
  #pdfbox button.primary { border-color:#0b6bcb; color:#0b6bcb; font-weight:600; } #pdfbox button:disabled { opacity:.45; cursor:default; }
  #pdfbox .grp td { background:#f1f4f8; font-weight:700; }`;
  document.head.appendChild(css);

  const bar = document.createElement("div"); bar.id = "pdfbar";
  bar.innerHTML = `<button id="pdfopen" title="Read a PDF report (labs, clinic letter, endoscopy) and add what it contains to every tab">Import PDF</button><span class="cnt" id="pdfcnt"></span>`;
  const top = document.querySelector("header .top"); if (top) top.insertBefore(bar, top.lastElementChild);
  const modal = document.createElement("div"); modal.id = "pdfmodal"; modal.innerHTML = `<div id="pdfbox"></div>`; document.body.appendChild(modal);
  const box = modal.firstChild;
  modal.addEventListener("click", (e) => { if (e.target === modal) close(); });
  function close() { modal.classList.remove("on"); }
  function refreshCount() { const st = pid() ? store() : { items: [], files: [] }; const el = document.getElementById("pdfcnt"); el.innerHTML = st.items.length ? `<a href="#" id="pdfman" style="color:#fff">${st.items.length} imported item${st.items.length === 1 ? "" : "s"}</a>` : ""; const a = document.getElementById("pdfman"); if (a) a.onclick = (e) => { e.preventDefault(); manage(); }; }
  document.getElementById("pdfopen").onclick = () => { if (!pid()) { alert("The patient has not loaded yet."); return; } drop(); };
  const patientName = () => { const el = document.getElementById("patient"); return el ? el.textContent.trim() : ""; };

  /* ---------- step 1: choose files ---------- */
  function drop(msg) {
    box.innerHTML = `<h2>Import a PDF report</h2>
      <div class="muted">For labs, clinic letters or procedure reports that are not in Cerner. The PDF is read here in your browser: nothing is uploaded or sent to an AI. Use made-up or Cerner sandbox documents only until Island Health approves real data.</div>
      ${msg ? `<div class="warn">${msg}</div>` : ""}
      <div id="pdfdrop"><div style="font-size:15px">Drop PDF files here</div><div class="muted">or</div><input type="file" id="pdffile" accept="application/pdf,.pdf" multiple></div>
      <div class="muted">Works for PDFs that contain real text. Scanned pages or faxes (pictures of text) cannot be read yet. Everything found is shown to you to tick and correct before it is used.</div>
      <p><button id="pdfx">Close</button></p>`;
    modal.classList.add("on");
    const dz = document.getElementById("pdfdrop"), fi = document.getElementById("pdffile");
    ["dragenter", "dragover"].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.add("hot"); }));
    ["dragleave", "drop"].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.remove("hot"); }));
    dz.addEventListener("drop", (e) => run(Array.from(e.dataTransfer.files)));
    fi.onchange = () => run(Array.from(fi.files));
    document.getElementById("pdfx").onclick = close;
  }

  let libP = null;
  function loadLib() {
    if (window.pdfjsLib && window.pdfjsLib.__ready) return Promise.resolve(window.pdfjsLib);
    if (libP) return libP;
    libP = new Promise((res, rej) => {
      const s = document.createElement("script"); s.src = PDFJS; s.onerror = () => rej(new Error("Could not load the PDF reader library (cdn.jsdelivr.net). Check internet or ad-blocker."));
      s.onload = async () => {
        try { const code = await (await fetch(WORKER)).text(); window.pdfjsLib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(new Blob([code], { type: "text/javascript" })); window.pdfjsLib.__ready = true; res(window.pdfjsLib); }
        catch (e) { rej(new Error("Could not load the PDF reader worker: " + (e.message || e))); }
      };
      document.head.appendChild(s);
    });
    return libP;
  }
  async function pdfLines(file) {
    const lib = await loadLib(), buf = await file.arrayBuffer(), doc = await lib.getDocument({ data: buf }).promise, lines = []; let chars = 0;
    for (let p = 1; p <= doc.numPages; p++) {
      const tc = await (await doc.getPage(p)).getTextContent(), rows = [];
      tc.items.forEach((it) => { if (!it.str || !it.str.trim()) return; const y = it.transform[5], x = it.transform[4]; let r = rows.find((q) => Math.abs(q.y - y) < 2.5); if (!r) { r = { y, parts: [] }; rows.push(r); } r.parts.push({ x, w: it.width || 0, s: it.str }); chars += it.str.length; });
      rows.sort((a, b) => b.y - a.y).forEach((r) => { r.parts.sort((a, b) => a.x - b.x); let s = "", end = null; r.parts.forEach((q) => { if (end != null) { const gap = q.x - end; s += gap > 12 ? "   " : gap > 1.2 ? " " : ""; } s += q.s; end = q.x + q.w; }); lines.push(s); });
      lines.push("");
    }
    return { lines, chars, pages: doc.numPages };
  }

  /* ---------- step 2: read and review ---------- */
  async function run(files) {
    files = files.filter((f) => /pdf$/i.test(f.name) || f.type === "application/pdf"); if (!files.length) return drop("That is not a PDF file.");
    box.innerHTML = `<h2>Reading…</h2><div class="muted" id="pdfprog">Starting</div>`;
    const results = [], problems = [];
    for (const f of files) {
      try {
        document.getElementById("pdfprog").textContent = "Reading " + f.name + "…";
        const { lines, chars, pages } = await pdfLines(f);
        if (chars < 40 * pages) { problems.push(f.name + ": almost no text found. It looks like a scanned image, which this version cannot read."); if (chars < 20) continue; }
        const r = X().fromLines(lines, { fileName: f.name }); results.push(r);
      } catch (e) { problems.push(f.name + ": " + (e.message || e)); }
    }
    review(results, problems);
  }
  const fmtVal = (it) => (it.kind === "lab" ? (it.text != null ? it.text : (it.cmp || "") + it.value) : it.kind === "vital" ? (it.key === "bp" ? it.value + "/" + it.value2 : String(it.value)) : it.kind === "med" ? it.text : it.kind === "condition" ? "" : "");
  const KIND = { lab: "Lab", vital: "Vital", med: "Medication", procedure: "Procedure", report: "Imaging report", condition: "Diagnosis" };
  function review(results, problems) {
    const all = []; results.forEach((r) => r.items.forEach((it) => all.push({ it, r })));
    const today = X().iso(Date.now());
    let h = `<h2>Review what was found</h2>
      <div class="warn"><b>Check before adding.</b> Reading a PDF is imperfect: values, units and dates can be wrong or missing, and a name can match the wrong test. Untick anything doubtful and fix values here. Added items appear in every tab marked as imported from PDF, not from Cerner.</div>
      ${problems.length ? `<div class="warn bad">${problems.map(esc).join("<br>")}</div>` : ""}`;
    if (!all.length) { h += `<p>Nothing recognisable was found.${results.length ? " You can still keep the PDF text as a note below." : ""}</p>`; }
    else {
      h += `<table><tr><th></th><th>Type</th><th>Item</th><th>Value</th><th>Unit</th><th>Date</th><th>Line in the PDF</th></tr>`;
      let cur = null;
      all.forEach(({ it, r }, i) => {
        if (cur !== r.fileName) { cur = r.fileName; h += `<tr class="grp"><td colspan="7">${esc(r.fileName)}</td></tr>`; }
        const d = it.t ? X().iso(it.t) : "", missing = !it.t, amb = it.ambiguous || (it.dateFrom === "document" && r.docDateAmbiguous);
        const unit = it.kind === "lab" && it.text == null ? it.unit || it.unitGuess : it.kind === "vital" ? it.unit : "";
        const noUnit = it.kind === "lab" && it.text == null && !it.unit;
        h += `<tr data-i="${i}"><td><input type="checkbox" class="ck" checked></td><td>${KIND[it.kind]}</td><td>${esc(it.label)}${it.flag ? ` <b>${esc(it.flag)}</b>` : ""}</td>
          <td>${it.kind === "condition" ? "" : `<input type="text" class="vv" value="${esc(fmtVal(it))}" size="${it.kind === "med" ? 38 : 9}">`}</td>
          <td>${it.kind === "lab" && it.text == null ? `<input type="text" class="uu" value="${esc(it.unit || "")}" size="9" placeholder="${esc(it.unitGuess)}">` : esc(unit)}${noUnit ? ` <span class="bad" title="No unit was found next to the value">?</span>` : ""}</td>
          <td><input type="date" class="dd" value="${d || today}">${missing ? ` <span class="bad" title="No date found in the PDF; today is filled in">set date</span>` : amb ? ` <span class="bad" title="Numeric date could be day/month or month/day">check day/month</span>` : ""}</td>
          <td class="src">${esc(it.line)}</td></tr>`;
      });
      h += `</table>`;
    }
    h += `<p><label><input type="checkbox" id="pdfkeep"> Also keep the PDF text as a note, so Notes, Risk screen and other tabs that read notes can see it (the AI tab only sends data out if you have set it up to)</label></p>
      <p><label><b><input type="checkbox" id="pdfpt"> This PDF is for the patient shown at the top: ${esc(patientName())}</b></label></p>
      <p><button class="primary" id="pdfadd" disabled>Add ticked items</button> <button id="pdfback">Back</button> <button id="pdfx2">Cancel</button> <span class="muted" id="pdfres"></span></p>`;
    box.innerHTML = h;
    const addBtn = document.getElementById("pdfadd"), pt = document.getElementById("pdfpt");
    pt.onchange = () => { addBtn.disabled = !pt.checked; };
    document.getElementById("pdfback").onclick = () => drop(); document.getElementById("pdfx2").onclick = close;
    addBtn.onclick = () => {
      const ctxBase = { patientId: pid(), now: Date.now() }, st = store(), added = []; const filesAdded = {};
      box.querySelectorAll("tr[data-i]").forEach((tr) => {
        if (!tr.querySelector(".ck").checked) return;
        const { it: src, r } = all[+tr.dataset.i], it = Object.assign({}, src), vv = tr.querySelector(".vv"), uu = tr.querySelector(".uu"), dd = tr.querySelector(".dd").value;
        if (dd) it.t = new Date(dd + "T12:00:00").getTime();
        if (vv) { const v = vv.value.trim();
          if (it.kind === "lab") { if (it.text != null) it.text = v; else { const n = parseFloat(v.replace(/^[<>]/, "").replace(",", ".")); if (isNaN(n)) return; it.value = n; it.cmp = /^[<>]/.test(v) ? v[0] : ""; } }
          else if (it.kind === "vital") { if (it.key === "bp") { const m = /(\d+)\s*\/\s*(\d+)/.exec(v); if (!m) return; it.value = +m[1]; it.value2 = +m[2]; } else { const n = parseFloat(v); if (isNaN(n)) return; it.value = n; } }
          else if (it.kind === "med") { it.text = v; it.label = v.split(/\s+/)[0]; } }
        if (uu) it.unit = uu.value.trim();
        const res = X().toResource(it, Object.assign({ fileName: r.fileName }, ctxBase)); if (!res) return;
        if (!st.items.some((x) => x.id === res.id)) { st.items.push(res); added.push(res); (filesAdded[r.fileName] = filesAdded[r.fileName] || []).push(res.id); }
      });
      if (document.getElementById("pdfkeep").checked) results.forEach((r) => { const d = X().docResource(r.text, Object.assign({ fileName: r.fileName }, ctxBase), r.docT); if (!st.items.some((x) => x.id === d.id)) { st.items.push(d); added.push(d); (filesAdded[r.fileName] = filesAdded[r.fileName] || []).push(d.id); } });
      Object.keys(filesAdded).forEach((n) => st.files.push({ name: n, ids: filesAdded[n], at: Date.now() }));
      if (!added.length) { document.getElementById("pdfres").textContent = "Nothing was added."; return; }
      save(st); refreshCount(); reloadTabs();
      box.innerHTML = `<h2>Added ${added.length} item${added.length === 1 ? "" : "s"}</h2><p>They now show in every tab, marked as imported from PDF. Tabs that were open have been reloaded.</p><p><button id="pdfx3">Close</button> <button id="pdfman2">Manage imported items</button></p>`;
      document.getElementById("pdfx3").onclick = close; document.getElementById("pdfman2").onclick = manage;
    };
  }
  function reloadTabs() { document.querySelectorAll("#frames iframe").forEach((f) => { try { f.contentWindow.location.reload(); } catch (e) {} }); }

  /* ---------- manage / remove ---------- */
  function manage() {
    const st = store();
    box.innerHTML = `<h2>Imported from PDF (this browser tab only)</h2>
      ${st.files.length ? `<table><tr><th>File</th><th>Items</th><th>Added</th><th></th></tr>${st.files.map((f, i) => `<tr><td>${esc(f.name)}</td><td>${f.ids.length}</td><td>${new Date(f.at).toLocaleString()}</td><td><button data-rm="${i}">Remove</button></td></tr>`).join("")}</table>` : "<p>Nothing imported.</p>"}
      <p class="muted">Imported items are kept only in this browser tab and disappear when the tab is closed.</p>
      <p><button id="pdfclr" ${st.items.length ? "" : "disabled"}>Remove everything</button> <button id="pdfx4">Close</button></p>`;
    modal.classList.add("on");
    box.querySelectorAll("button[data-rm]").forEach((b) => (b.onclick = () => { const s = store(), f = s.files[+b.dataset.rm]; s.items = s.items.filter((x) => !f.ids.includes(x.id)); s.files.splice(+b.dataset.rm, 1); save(s); refreshCount(); reloadTabs(); manage(); }));
    document.getElementById("pdfclr").onclick = () => { save({ items: [], files: [] }); refreshCount(); reloadTabs(); manage(); };
    document.getElementById("pdfx4").onclick = close;
  }
  window.PdfImportUI = { refreshCount, review, pdfLines };
  const t = setInterval(() => { if (pid()) { refreshCount(); clearInterval(t); } }, 500);
})();
