/* Hospitalist Toolkit shell: "Import PDF" button. Reads a PDF in the browser (pdf.js), finds labs, vitals, medications, procedures and diagnoses,
   shows them for the physician to tick and correct, then stores the accepted items for this browser tab so every tool tab can see them (pdf-overlay.js).
   No PDF content leaves the browser. Text PDFs only (scanned images have no text and need OCR, which is not included). UNVERIFIED draft written by Claude. */
(function () {
  const PDFJS = "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js", WORKER = "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js";
  const KEY = (pid) => "pdfimport:" + pid;
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const X = () => window.PdfExtract;
  const pid = () => (window.TK && window.TK.patientId) || null;
  const storeFor = (id) => { try { return JSON.parse(sessionStorage.getItem(KEY(id)) || "null") || { items: [], files: [] }; } catch (e) { return { items: [], files: [] }; } };
  const saveFor = (id, st) => sessionStorage.setItem(KEY(id), JSON.stringify(st));
  const store = () => storeFor(pid()), save = (st) => saveFor(pid(), st);
  const isPdfPt = (id) => /^pdfpt-/.test(String(id || ""));
  /* PDF-only patients made in this browser tab */
  const pdfPatients = () => { try { return JSON.parse(sessionStorage.getItem("pdfpatients") || "[]"); } catch (e) { return []; } };
  const savePdfPatients = (l) => sessionStorage.setItem("pdfpatients", JSON.stringify(l));
  const hash = (s) => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); };
  function patientResource(id, f) {
    const name = (f.given || f.family) ? [{ use: "official", text: [f.given, f.family].filter(Boolean).join(" "), family: f.family || undefined, given: f.given ? f.given.split(/\s+/) : undefined }] : [{ text: f.name || "PDF patient" }];
    let birthDate = f.birthDate || undefined;
    if (!birthDate && f.age) birthDate = (new Date().getFullYear() - +f.age) + "-01-01"; // age only: approximate DOB (1 January)
    const identifier = [];
    if (f.phn) identifier.push({ type: { text: "PHN" }, system: "urn:bc:phn", value: f.phn });
    if (f.mrn) identifier.push({ type: { coding: [{ code: "MR" }], text: "MRN (outside)" }, value: f.mrn });
    return { resourceType: "Patient", id, meta: { tag: [{ system: "urn:toolkit:import", code: "pdf-only-patient", display: "Created from PDF" }] }, name, gender: f.sex || undefined, birthDate, birthDateApproximate: !f.birthDate && !!f.age || undefined, identifier: identifier.length ? identifier : undefined };
  }

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
  function refreshCount() { const st = pid() ? store() : { items: [], files: [] }; const el = document.getElementById("pdfcnt"); el.innerHTML = st.items.length ? `<a href="#" id="pdfman" style="color:#fff">${st.items.length} imported item${st.items.length === 1 ? "" : "s"}</a>` : pdfPatients().length ? `<a href="#" id="pdfman" style="color:#fff">PDF-only patients (${pdfPatients().length})</a>` : ""; const a = document.getElementById("pdfman"); if (a) a.onclick = (e) => { e.preventDefault(); manage(); }; }
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
    const lib = await loadLib(), buf = await file.arrayBuffer(), doc = await lib.getDocument({ data: buf }).promise, pages = []; let chars = 0;
    for (let p = 1; p <= doc.numPages; p++) {
      const tc = await (await doc.getPage(p)).getTextContent();
      pages.push(tc.items.filter((it) => it.str && it.str.trim()).map((it) => { chars += it.str.length; return { s: it.str, x: it.transform[4], y: it.transform[5], w: it.width || 0, h: it.height || Math.abs(it.transform[3]) || 0 }; }));
    }
    // keep columns and table rows (pdf-extract.js layoutLines), so two-column notes and wrapped table cells read correctly
    return { lines: X().layoutLines(pages), chars, pages: doc.numPages };
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
    const demo = results.reduce((d, r) => (d.family || d.given ? d : X().demographics ? X().demographics(r.text) : {}), {});
    const others = pdfPatients().filter((p) => p.id !== pid());
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
        h += `<tr data-i="${i}"><td><input type="checkbox" class="ck" checked></td><td>${KIND[it.kind]}</td><td>${esc(it.label)}${it.flag ? ` <b>${esc(it.flag)}</b>` : ""}${it.kind === "med" ? ` <label class="muted" title="${esc(it.heldWhy || "")}" style="white-space:nowrap"><input type="checkbox" class="hh"${it.held ? " checked" : ""}> on hold${it.held ? " (per note)" : ""}</label>` : ""}</td>
          <td>${it.kind === "condition" ? "" : `<input type="text" class="vv" value="${esc(fmtVal(it))}" size="${it.kind === "med" ? 38 : 9}">`}</td>
          <td>${it.kind === "lab" && it.text == null ? `<input type="text" class="uu" value="${esc(it.unit || "")}" size="9" placeholder="${esc(it.unitGuess)}">` : esc(unit)}${noUnit ? ` <span class="bad" title="No unit was found next to the value">?</span>` : ""}</td>
          <td><input type="date" class="dd" value="${d || today}">${missing ? ` <span class="bad" title="No date found in the PDF; today is filled in">set date</span>` : amb ? ` <span class="bad" title="Numeric date could be day/month or month/day">check day/month</span>` : ""}</td>
          <td class="src">${esc(it.line)}</td></tr>`;
      });
      h += `</table>`;
    }
    h += `<p><label><input type="checkbox" id="pdfkeep"${results.some((r) => /history of present illness|chief complaint|\bhpi\b|admission note|consult(?:ation)? note|progress note|discharge summary|physical exam/i.test(r.text)) ? " checked" : ""}> Also keep the PDF text as a note, so Notes, Risk screen and other tabs that read notes can see it (the AI tab only sends data out if you have set it up to)</label></p>
      <div style="border:1px solid #dde3ea;border-radius:8px;padding:8px 12px;margin:8px 0"><b>Where should this go?</b>
        <div><label><input type="radio" name="pdfdest" value="current" checked> Add to the patient shown at the top: <b>${esc(patientName())}</b>${isPdfPt(pid()) ? " (PDF-only patient)" : ""}</label></div>
        <div><label><input type="radio" name="pdfdest" value="new"> Open as a <b>separate patient</b> made only from this PDF (no Cerner data)</label></div>
        ${others.length ? `<div><label><input type="radio" name="pdfdest" value="existing"> Add to another PDF-only patient: <select id="pdfexist">${others.map((p) => `<option value="${esc(p.id)}">${esc(p.label)}</option>`).join("")}</select></label></div>` : ""}
        <div id="pdfcur" style="margin-top:6px"><label><b><input type="checkbox" id="pdfpt"> This PDF is for ${esc(patientName())}</b></label></div>
        <div id="pdfnew" hidden style="margin-top:6px">
          <div class="muted">Details found in the PDF are filled in: check them. Nothing here goes to Cerner; this patient exists only in this browser tab.</div>
          <table style="width:auto"><tr><td>Name</td><td><input type="text" id="np-given" placeholder="First name" value="${esc(demo.given || "")}" size="16"> <input type="text" id="np-family" placeholder="Last name" value="${esc(demo.family || "")}" size="16"></td></tr>
            <tr><td>Sex</td><td><select id="np-sex"><option value="">Unknown</option><option value="female"${demo.sex === "female" ? " selected" : ""}>Female</option><option value="male"${demo.sex === "male" ? " selected" : ""}>Male</option></select></td></tr>
            <tr><td>Date of birth</td><td><input type="date" id="np-dob" value="${esc(demo.birthDate || "")}"> or age <input type="text" id="np-age" size="4" value="${demo.birthDate ? "" : esc(demo.age || "")}">${demo.birthAmbiguous ? ' <span class="bad">check day/month</span>' : ""}</td></tr>
            <tr><td>PHN / outside MRN</td><td><input type="text" id="np-phn" placeholder="PHN" value="${esc(demo.phn || "")}" size="12"> <input type="text" id="np-mrn" placeholder="MRN" value="${esc(demo.mrn || "")}" size="12"></td></tr></table>
        </div>
      </div>
      <p><button class="primary" id="pdfadd" disabled>Add ticked items</button> <button id="pdfback">Back</button> <button id="pdfx2">Cancel</button> <span class="muted" id="pdfres"></span></p>`;
    box.innerHTML = h;
    const addBtn = document.getElementById("pdfadd"), pt = document.getElementById("pdfpt");
    const dest = () => (box.querySelector('input[name="pdfdest"]:checked') || {}).value || "current";
    const refreshDest = () => {
      const d = dest();
      document.getElementById("pdfcur").hidden = d !== "current"; document.getElementById("pdfnew").hidden = d !== "new";
      const named = (document.getElementById("np-given").value + document.getElementById("np-family").value).trim();
      addBtn.disabled = d === "current" ? !pt.checked : d === "new" ? !named : false;
      addBtn.textContent = d === "current" ? "Add ticked items" : d === "new" ? "Create patient and open" : "Add and open that patient";
    };
    box.querySelectorAll('input[name="pdfdest"]').forEach((r) => (r.onchange = refreshDest));
    ["np-given", "np-family"].forEach((id) => (document.getElementById(id).oninput = refreshDest));
    pt.onchange = refreshDest; refreshDest();
    document.getElementById("pdfback").onclick = () => drop(); document.getElementById("pdfx2").onclick = close;
    addBtn.onclick = () => {
      const d = dest(); let target = pid(), created = null;
      if (d === "existing") target = document.getElementById("pdfexist").value;
      if (d === "new") {
        const f = { given: document.getElementById("np-given").value.trim(), family: document.getElementById("np-family").value.trim(), sex: document.getElementById("np-sex").value,
          birthDate: document.getElementById("np-dob").value, age: document.getElementById("np-age").value.trim(), phn: document.getElementById("np-phn").value.trim(), mrn: document.getElementById("np-mrn").value.trim() };
        target = "pdfpt-" + hash([f.given, f.family, f.birthDate, Date.now()].join("|"));
        created = patientResource(target, f);
      }
      const ctxBase = { patientId: target, now: Date.now() }, st = storeFor(target), added = []; const filesAdded = {};
      if (created) st.patient = created;
      box.querySelectorAll("tr[data-i]").forEach((tr) => {
        if (!tr.querySelector(".ck").checked) return;
        const { it: src, r } = all[+tr.dataset.i], it = Object.assign({}, src), vv = tr.querySelector(".vv"), uu = tr.querySelector(".uu"), dd = tr.querySelector(".dd").value;
        if (dd && !(it.t && X().iso(it.t) === dd)) it.t = new Date(dd + "T12:00:00").getTime(); // keep a time read from the PDF unless the date was changed
        if (vv) { const v = vv.value.trim();
          if (it.kind === "lab") { if (it.text != null) it.text = v; else { const n = parseFloat(v.replace(/^[<>]/, "").replace(",", ".")); if (isNaN(n)) return; it.value = n; it.cmp = /^[<>]/.test(v) ? v[0] : ""; } }
          else if (it.kind === "vital") { if (it.key === "bp") { const m = /(\d+)\s*\/\s*(\d+)/.exec(v); if (!m) return; it.value = +m[1]; it.value2 = +m[2]; } else { const n = parseFloat(v); if (isNaN(n)) return; it.value = n; } }
          else if (it.kind === "med") { it.text = v; it.label = v.split(/\s+/)[0]; } }
        if (uu) it.unit = uu.value.trim();
        const hh = tr.querySelector(".hh"); if (hh) it.held = hh.checked;
        const res = X().toResource(it, Object.assign({ fileName: r.fileName }, ctxBase)); if (!res) return;
        if (!st.items.some((x) => x.id === res.id)) { st.items.push(res); added.push(res); (filesAdded[r.fileName] = filesAdded[r.fileName] || []).push(res.id); }
      });
      if (document.getElementById("pdfkeep").checked) results.forEach((r) => { const d = X().docResource(r.text, Object.assign({ fileName: r.fileName }, ctxBase), r.docT); if (!st.items.some((x) => x.id === d.id)) { st.items.push(d); added.push(d); (filesAdded[r.fileName] = filesAdded[r.fileName] || []).push(d.id); } });
      Object.keys(filesAdded).forEach((n) => st.files.push({ name: n, ids: filesAdded[n], at: Date.now() }));
      if (!added.length) { document.getElementById("pdfres").textContent = "Nothing was added."; return; }
      saveFor(target, st);
      if (created) { const l = pdfPatients(); l.push({ id: target, label: [created.name[0].text, created.gender, created.birthDate ? "DOB " + created.birthDate : ""].filter(Boolean).join(", "), at: Date.now() }); savePdfPatients(l); }
      if (target !== pid()) { box.innerHTML = `<h2>Opening the PDF-only patient…</h2>`; window.TK.switchPatient(target); return; }
      refreshCount(); reloadTabs();
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
      ${pdfPatients().length || isPdfPt(pid()) ? `<h2 style="margin-top:14px">PDF-only patients</h2>
        <table><tr><th>Patient</th><th>Items</th><th></th></tr>${pdfPatients().map((p, i) => `<tr><td>${esc(p.label)}${p.id === pid() ? " <b>(open now)</b>" : ""}</td><td>${storeFor(p.id).items.length}</td>
          <td>${p.id === pid() ? "" : `<button data-open="${esc(p.id)}">Open</button> `}<button data-del="${i}">Delete</button></td></tr>`).join("")}</table>
        ${isPdfPt(pid()) && sessionStorage.getItem("pdfpt-return") ? `<p><button id="pdfback2" class="primary">Back to the Cerner patient</button></p>` : ""}` : ""}
      <p><button id="pdfclr" ${st.items.length ? "" : "disabled"}>Remove everything</button> <button id="pdfx4">Close</button></p>`;
    modal.classList.add("on");
    box.querySelectorAll("button[data-rm]").forEach((b) => (b.onclick = () => { const s = store(), f = s.files[+b.dataset.rm]; s.items = s.items.filter((x) => !f.ids.includes(x.id)); s.files.splice(+b.dataset.rm, 1); save(s); refreshCount(); reloadTabs(); manage(); }));
    box.querySelectorAll("button[data-open]").forEach((b) => (b.onclick = () => window.TK.switchPatient(b.dataset.open)));
    box.querySelectorAll("button[data-del]").forEach((b) => (b.onclick = () => {
      const l = pdfPatients(), p = l[+b.dataset.del]; if (!p) return;
      sessionStorage.removeItem(KEY(p.id)); l.splice(+b.dataset.del, 1); savePdfPatients(l);
      if (p.id === pid()) { if (sessionStorage.getItem("pdfpt-return")) return window.TK.backToCerner(); }
      manage();
    }));
    const bk = document.getElementById("pdfback2"); if (bk) bk.onclick = () => window.TK.backToCerner();
    document.getElementById("pdfclr").onclick = () => { save({ items: [], files: [] }); refreshCount(); reloadTabs(); manage(); };
    document.getElementById("pdfx4").onclick = close;
  }
  window.PdfImportUI = { refreshCount, review, pdfLines };
  const t = setInterval(() => { if (pid()) { refreshCount(); clearInterval(t); } }, 500);
})();
