/* Hospitalist Toolkit shell: "Import PDF" button. Reads a PDF in the browser (pdf.js), finds labs, vitals, medications, procedures and diagnoses,
   shows them for the physician to tick and correct, then stores the accepted items for this browser tab so every tool tab can see them (pdf-overlay.js).
   No PDF content leaves the browser. Text PDFs are read directly; PDFs that are only pictures of text (scans, faxes, "Microsoft Print to PDF"
   of a CareConnect page) are read with OCR (Tesseract.js) running in this browser: the OCR library and English language data are downloaded
   from the CDN, the page images are not uploaded anywhere. UNVERIFIED draft written by Claude. */
(function () {
  const PDFJS = "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js", WORKER = "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js";
  const TESS = "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js", OCR_SCALE = 3; // 3 x 72 = 216 dpi page images for OCR
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
  #pdfbox .grp td { background:#f1f4f8; font-weight:700; }
  #pdfbox details.pdfsec { border:1px solid #dde3ea; border-radius:8px; padding:6px 12px; margin:8px 0; }
  #pdfbox details.pdfsec > summary { cursor:pointer; padding:2px 0; }
  #pdfbox textarea { width:100%; box-sizing:border-box; font:13px/1.45 system-ui,sans-serif; padding:6px 8px; border:1px solid #cbd5e0; border-radius:6px; margin:6px 0 4px; resize:vertical; }
  #pdfbox textarea.mono { font:12px/1.4 ui-monospace,Consolas,monospace; white-space:pre; overflow-x:auto; }
  #pdfbox .row { margin:2px 0 4px; }`;
  document.head.appendChild(css);

  const bar = document.createElement("div"); bar.id = "pdfbar";
  bar.innerHTML = `<button id="pdfopen" title="Read a PDF report (labs, clinic letter, endoscopy) or typed/pasted text, and add what it contains to every tab">Import PDF / text / screenshot</button><span class="cnt" id="pdfcnt"></span>`;
  const top = document.querySelector("header .top"); if (top) top.insertBefore(bar, top.lastElementChild);
  const modal = document.createElement("div"); modal.id = "pdfmodal"; modal.innerHTML = `<div id="pdfbox"></div>`; document.body.appendChild(modal);
  const box = modal.firstChild;
  modal.addEventListener("click", (e) => { if (e.target === modal) close(); });
  function close() { modal.classList.remove("on"); }
  function refreshCount() { const st = pid() ? store() : { items: [], files: [] }; const el = document.getElementById("pdfcnt"); el.innerHTML = st.items.length ? `<a href="#" id="pdfman" style="color:#fff">${st.items.length} imported item${st.items.length === 1 ? "" : "s"}</a>` : pdfPatients().length ? `<a href="#" id="pdfman" style="color:#fff">PDF-only patients (${pdfPatients().length})</a>` : ""; const a = document.getElementById("pdfman"); if (a) a.onclick = (e) => { e.preventDefault(); manage(); }; }
  document.getElementById("pdfopen").onclick = () => { if (!pid()) { alert("The patient has not loaded yet."); return; } drop(); };
  /* the last "Review what was found" screen, kept for this browser tab so it can be reopened after closing it */
  const LAST = "pdflastreview";
  const saveLast = (results, problems) => { try { sessionStorage.setItem(LAST, JSON.stringify({ results, problems, at: Date.now() })); } catch (e) {} };
  const loadLast = () => { try { return JSON.parse(sessionStorage.getItem(LAST) || "null"); } catch (e) { return null; } };
  const patientName = () => { const el = document.getElementById("patient"); return el ? Array.from(el.childNodes).map((n) => n.textContent.trim()).filter(Boolean).filter((t) => !/^test mode\b/i.test(t)).join(" ") : ""; };

  /* ---------- step 1: choose files ---------- */
  function drop(msg) {
    box.innerHTML = `<h2>Import a PDF, screenshot or typed text</h2>
      <div class="muted">For labs, clinic letters or procedure reports that are not in Cerner. The PDF is read here in your browser: nothing is uploaded or sent to an AI. Use made-up or Cerner sandbox documents only until Island Health approves real data.</div>
      ${msg ? `<div class="warn">${msg}</div>` : ""}
      ${(() => { const L = loadLast(); return L && L.results && L.results.length ? `<p><button class="primary" id="pdflast">Back to the last review: ${esc(L.results.map((r) => r.fileName).join(", "))}</button> <span class="muted">read ${esc(new Date(L.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }))}, with its summary and OCR text</span></p>` : ""; })()}
      <div id="pdfdrop"><div style="font-size:15px">Drop PDF files or screenshots here</div><div class="muted">or <b>paste a screenshot</b> (Ctrl+V; take one with Windows+Shift+S, or Cmd+Shift+Ctrl+4 on a Mac), or</div><input type="file" id="pdffile" accept="application/pdf,.pdf,image/*" multiple></div>
      <details class="pdfsec" open><summary><b>Or type or paste text</b> <span class="muted">a phone report, an outside note, labs from a fax, or your own notes</span></summary>
        <input type="text" id="typtitle" placeholder="Title (optional), e.g. Phone report from Dr. ___, outside labs" style="width:100%;box-sizing:border-box;margin-top:6px;padding:5px 8px">
        <textarea id="typtext" rows="10" spellcheck="true" placeholder="Type or paste here. Labs written like 'Na 131, K 3.2, Cr 142' and medications with doses are picked up. Section headings such as Diagnosis, Impression or Plan on their own line go into the summary."></textarea>
        <div class="row"><button class="primary" id="typread">Read this text</button> <span class="muted">Nothing is sent anywhere: it is read here, then shown to you to check like a PDF.</span></div></details>
      ${sampleBlock()}
      <div class="muted">Text PDFs are read directly. Screenshots (PowerChart, CareConnect, a lab report on screen) and scanned pages, faxes or printed-to-PDF CareConnect pages (pictures of text) are read with OCR in your browser, which takes about 5-10 seconds a page (the first time also downloads about 10 MB of OCR data). Everything found is shown to you to tick and correct before it is used.</div>
      <p><button id="pdfx">Close</button></p>`;
    modal.classList.add("on");
    const dz = document.getElementById("pdfdrop"), fi = document.getElementById("pdffile");
    ["dragenter", "dragover"].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.add("hot"); }));
    ["dragleave", "drop"].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.remove("hot"); }));
    dz.addEventListener("drop", (e) => run(Array.from(e.dataTransfer.files)));
    fi.onchange = () => run(Array.from(fi.files));
    const tt = document.getElementById("typtext"), tl = document.getElementById("typtitle");
    try { const d = JSON.parse(sessionStorage.getItem("pdftypedraft") || "null"); if (d) { tt.value = d.text || ""; tl.value = d.title || ""; } } catch (e) {}
    const keepDraft = () => { try { sessionStorage.setItem("pdftypedraft", JSON.stringify({ text: tt.value, title: tl.value })); } catch (e) {} };
    tt.oninput = keepDraft; tl.oninput = keepDraft;
    document.getElementById("typread").onclick = () => {
      const txt = tt.value.trim(); if (!txt) { tt.focus(); return; }
      const stamp = new Date().toLocaleString([], { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
      const name = (tl.value.trim() || "Typed note") + " (" + stamp + ")";
      const r = X().fromText(txt, { fileName: name }); r.typed = true;
      sessionStorage.removeItem("pdftypedraft");
      review([r], []);
    };
    const lb = document.getElementById("pdflast"); if (lb) lb.onclick = () => { const L = loadLast(); if (L) review(L.results, L.problems || []); };
    const ss = document.getElementById("pdfsample");
    if (ss) ss.onchange = () => { if (ss.value !== "") loadSample(+ss.value); };
    document.getElementById("pdfx").onclick = close;
  }

  // paste a screenshot while the Import screen is open
  document.addEventListener("paste", (e) => {
    if (!modal.classList.contains("on") || !document.getElementById("pdfdrop")) return;
    const items = Array.from((e.clipboardData && e.clipboardData.items) || []).filter((it) => it.kind === "file" && /^image\//.test(it.type));
    if (!items.length) return; // ordinary text paste (e.g. into the text box) carries on as normal
    e.preventDefault();
    const stamp = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    run(items.map((it, i) => { const b = it.getAsFile(); return new File([b], "Pasted screenshot " + stamp + (items.length > 1 ? " (" + (i + 1) + ")" : "") + "." + ((b.type.split("/")[1] || "png").replace("jpeg", "jpg")), { type: b.type }); }));
  });

  /* ---------- made-up test patients (sample-pdfs/<condition>/…, listed in sample-pdfs/index.js) ---------- */
  function sampleBlock() {
    const list = window.SAMPLE_PDFS || []; if (!list.length) return "";
    const groups = [...new Set(list.map((x) => x.folder))];
    return `<div style="margin:4px 0 12px"><label for="pdfsample" style="font-weight:600">Or load a made-up test patient: </label>
      <select id="pdfsample" style="padding:5px;max-width:100%"><option value="">Choose a sample patient…</option>
      ${groups.map((g) => `<optgroup label="${esc(g)}">${list.map((x, i) => x.folder === g ? `<option value="${i}">${esc(x.label)}</option>` : "").join("")}</optgroup>`).join("")}
      </select></div>`;
  }
  async function loadSample(i) {
    const x = (window.SAMPLE_PDFS || [])[i]; if (!x) return;
    try {
      const url = "sample-pdfs/" + x.file.split("/").map(encodeURIComponent).join("/");
      const r = await fetch(url); if (!r.ok) throw new Error(r.status + " " + r.statusText);
      run([new File([await r.blob()], x.label + ".pdf", { type: "application/pdf" })]);
    } catch (e) { drop("Could not load the sample " + esc(x.label) + ": " + esc(e.message || e)); }
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
  /* OCR (Tesseract.js) for PDFs with no text layer */
  let tessP = null, ocrW = null, ocrMsg = null;
  function loadTess() {
    if (window.Tesseract) return Promise.resolve(window.Tesseract);
    if (tessP) return tessP;
    tessP = new Promise((res, rej) => {
      const s = document.createElement("script"); s.src = TESS; s.onload = () => res(window.Tesseract);
      s.onerror = () => { tessP = null; rej(new Error("Could not load the OCR library (cdn.jsdelivr.net) needed for scanned PDFs. Check internet or ad-blocker.")); };
      document.head.appendChild(s);
    });
    return tessP;
  }
  async function ocrWorker() {
    if (ocrW) return ocrW;
    const T = await loadTess();
    ocrW = T.createWorker("eng", 1, { logger: (m) => { if (ocrMsg && m && m.status && /loading|initializ/i.test(m.status)) ocrMsg("Preparing OCR: " + m.status + (m.progress ? " " + Math.round(m.progress * 100) + "%" : "")); } })
      .catch((e) => { ocrW = null; throw new Error("Could not start OCR: " + (e && e.message || e)); });
    return ocrW;
  }
  /* render each page to a canvas, OCR it, and return words as {s, x, y, w, h} in PDF points (y from the bottom), like pdf.js text items,
     so layoutLines() keeps columns and label/value rows. All words on one OCR line share that line's baseline. */
  async function ocrPages(doc, name) {
    const say = (t) => { const el = document.getElementById("pdfprog"); if (el) el.textContent = t; };
    ocrMsg = say; say(name + ": no text layer, starting OCR…");
    const w = await ocrWorker(), pages = []; let chars = 0;
    for (let p = 1; p <= doc.numPages; p++) {
      say(name + ": OCR page " + p + " of " + doc.numPages + "…");
      const page = await doc.getPage(p), vp = page.getViewport({ scale: OCR_SCALE }), cv = document.createElement("canvas");
      cv.width = Math.ceil(vp.width); cv.height = Math.ceil(vp.height);
      const ctx = cv.getContext("2d"); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, cv.width, cv.height);
      await page.render({ canvasContext: ctx, viewport: vp }).promise;
      const items = await ocrCanvas(w, cv, OCR_SCALE); items.forEach((it) => (chars += it.s.length));
      pages.push(items); cv.width = cv.height = 0; // free the canvas memory
    }
    ocrMsg = null;
    return { pages, chars };
  }
  // OCR one canvas -> words {s, x, y, w, h}; k = canvas pixels per output unit. Words on one OCR line share its baseline.
  async function ocrCanvas(w, cv, k) {
    const { data } = await w.recognize(cv), items = [];
    (data.lines || []).forEach((ln) => {
      const ws = (ln.words || []).filter((x) => x.text && x.text.trim()); if (!ws.length) return;
      const yb = Math.max(...ws.map((x) => x.bbox.y1)), yt = Math.min(...ws.map((x) => x.bbox.y0));
      ws.forEach((x) => items.push({ s: x.text, x: x.bbox.x0 / k, y: (cv.height - yb) / k, w: (x.bbox.x1 - x.bbox.x0) / k, h: (yb - yt) / k }));
    });
    return items;
  }
  /* a screenshot or photo (PNG, JPG…): enlarge small text, grey scale, white background (dark-mode screens are inverted), then OCR */
  async function imageLines(file) {
    const say = (t) => { const el = document.getElementById("pdfprog"); if (el) el.textContent = t; };
    ocrMsg = say; say(file.name + ": reading the picture with OCR…");
    const bmp = await createImageBitmap(file), up = bmp.width < 1600 ? 2 : 1, cv = document.createElement("canvas");
    cv.width = bmp.width * up; cv.height = bmp.height * up;
    const ctx = cv.getContext("2d", { willReadFrequently: true });
    // dark background? sample the picture small
    const sm = document.createElement("canvas"); sm.width = 64; sm.height = Math.max(1, Math.round(64 * bmp.height / bmp.width)); const sx = sm.getContext("2d"); sx.drawImage(bmp, 0, 0, sm.width, sm.height);
    const px = sx.getImageData(0, 0, sm.width, sm.height).data; let lum = 0; for (let i = 0; i < px.length; i += 4) lum += 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
    const dark = lum / (px.length / 4) < 110;
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.filter = "grayscale(1)" + (dark ? " invert(1)" : ""); ctx.imageSmoothingQuality = "high"; ctx.drawImage(bmp, 0, 0, cv.width, cv.height); ctx.filter = "none";
    const w = await ocrWorker(); say(file.name + ": OCR…");
    const k = cv.width / 612; // map to a letter-page width so layout spacing matches PDFs
    const items = await ocrCanvas(w, cv, k); cv.width = cv.height = 0; ocrMsg = null;
    const chars = items.reduce((n, it) => n + it.s.length, 0);
    return { lines: X().layoutLines([items]), chars, pages: 1, ocr: true, image: true };
  }
  const isImage = (f) => /^image\//i.test(f.type || "") || /\.(png|jpe?g|gif|bmp|webp|tiff?)$/i.test(f.name || "");
  async function pdfLines(file) {
    const lib = await loadLib(), buf = await file.arrayBuffer(), doc = await lib.getDocument({ data: buf }).promise; let pages = [], chars = 0, ocr = false;
    for (let p = 1; p <= doc.numPages; p++) {
      const tc = await (await doc.getPage(p)).getTextContent();
      pages.push(tc.items.filter((it) => it.str && it.str.trim()).map((it) => { chars += it.str.length; return { s: it.str, x: it.transform[4], y: it.transform[5], w: it.width || 0, h: it.height || Math.abs(it.transform[3]) || 0 }; }));
    }
    // no real text layer: pictures of text (scan, fax, Microsoft Print to PDF) -> OCR
    if (chars < 40 * doc.numPages) { const o = await ocrPages(doc, file.name); if (o.chars > chars) { pages = o.pages; chars = o.chars; ocr = true; } }
    // keep columns and table rows (pdf-extract.js layoutLines), so two-column notes and wrapped table cells read correctly
    return { lines: X().layoutLines(pages), chars, pages: doc.numPages, ocr };
  }

  /* ---------- step 2: read and review ---------- */
  async function run(files) {
    files = files.filter((f) => /pdf$/i.test(f.name) || f.type === "application/pdf" || isImage(f)); if (!files.length) return drop("That is not a PDF or a picture (PNG, JPG).");
    box.innerHTML = `<h2>Reading…</h2><div class="muted" id="pdfprog">Starting</div>`;
    const results = [], problems = [];
    for (const f of files) {
      try {
        document.getElementById("pdfprog").textContent = "Reading " + f.name + "…";
        const { lines, chars, pages, ocr, image } = isImage(f) ? await imageLines(f) : await pdfLines(f);
        if (chars < 20 * pages) { problems.push(f.name + ": almost no text found" + (ocr ? " even with OCR (blank, handwritten or very poor scan)." : ".")); if (chars < 20) continue; }
        const r = X().fromLines(lines, { fileName: f.name }); if (ocr) { r.ocr = true; problems.push(f.name + ": " + (image ? "a picture" : "this PDF is pictures of text") + ", so it was read with OCR. OCR can misread numbers and units (e.g. 0/O, 1/l, 5/S): check every value against the " + (image ? "screenshot" : "PDF") + " before accepting."); }
        results.push(r);
      } catch (e) { problems.push(f.name + ": " + (e.message || e)); }
    }
    review(results, problems);
  }
  /* ---------- draft discharge note from one file: follow-up in the community + what to watch for (tools/discharge/rules.js) ---------- */
  const D = () => window.DcRules;
  const FT = { referral: "Referral", imaging: "Imaging / procedure", lab: "Lab test", other: "Other" };
  function draftInit(r) {
    if (r.draft || !D()) return;
    const text = r.textDraft != null ? r.textDraft : r.text;
    r.draft = { follow: D().followups([{ name: r.fileName, text }]), fpDays: 7, dirty: false, out: "" };
  }
  function draftText(r) {
    const text = r.textDraft != null ? r.textDraft : r.text, d = X().demographics(text), det = D().detect(text);
    const items = r.items || [];
    const mods = D().modules(det).map((m) => m.id); // condition-specific only (the generic warnings were too generic to help)
    const pending = D().sentences(text).filter((x) => /\b(?:pending|awaiting|to follow|sent out)\b/i.test(x) && x.length < 260).slice(0, 8);
    return D().draftNote({
      title: r.fileName + (r.ocr ? " (read by OCR: check against the source)" : ""),
      patient: [d.name, d.sex, d.birthDate ? "DOB " + d.birthDate : d.age != null ? d.age + " y" : "", d.phn ? "PHN " + d.phn : ""].filter(Boolean).join(", "),
      sections: X().sections(text, 1200), meds: items.filter((i) => i.kind === "med").map((i) => i.text.replace(/\s+/g, " ").trim()),
      labs: items.filter((i) => i.kind === "lab").map((i) => i.label + " " + (i.text != null ? i.text : (i.cmp || "") + i.value + (i.unit ? " " + i.unit : "")) + (i.flag ? " (" + i.flag + ")" : "") + (i.t ? " " + X().iso(i.t) : "")),
      follow: r.draft.follow, pending, mods, v: { fpDays: r.draft.fpDays, sex: d.sex }, f: det });
  }
  function draftCard(r, k) {
    draftInit(r); if (!r.draft) return "";
    if (!r.draft.dirty) r.draft.out = draftText(r);
    const fl = r.draft.follow;
    return `<details open class="pdfsec"><summary><b>Draft discharge note: ${esc(r.fileName)}</b> <span class="muted">follow-up in the community and what to watch for (9-1-1 / family doctor); editable</span></summary>
      <div class="muted" style="margin:6px 0 2px">Follow-up found in the note (referrals, imaging, lab tests). Untick, edit or add; the note below updates.</div>
      <table><tr><th></th><th>Type</th><th>Follow-up</th><th>When</th></tr>${fl.map((x, i) => `<tr><td><input type="checkbox" class="dcon" data-k="${k}" data-i="${i}"${x.on !== false ? " checked" : ""}></td>
        <td><select class="dctype" data-k="${k}" data-i="${i}">${Object.entries(FT).map(([v, l]) => `<option value="${v}"${x.type === v ? " selected" : ""}>${l}</option>`).join("")}</select></td>
        <td><input type="text" class="dctext" data-k="${k}" data-i="${i}" value="${esc(x.text)}" style="width:100%"></td><td><input type="text" class="dcwhen" data-k="${k}" data-i="${i}" value="${esc(x.when)}" size="14" placeholder="e.g. in 1 week"></td></tr>`).join("") || `<tr><td colspan="4" class="muted">None found in the note.</td></tr>`}</table>
      <div class="row"><button data-dcadd="${k}">Add a follow-up</button> <label>See family doctor within <input type="text" class="dcfp" data-k="${k}" value="${esc(r.draft.fpDays)}" size="3"> days</label></div>
      <textarea id="pdfdc${k}" rows="20" class="mono" spellcheck="true" style="white-space:pre-wrap">${esc(r.draft.out)}</textarea>
      <div class="row"><button data-dcai="${k}" title="Opens Claude with this note (identifiers removed) and asks for more follow-up detail">Ask Claude for more follow-up detail</button></div>
      <div id="pdfai${k}" hidden style="border:1px solid #f0c27b;background:#fff8ec;border-radius:8px;padding:8px 10px;margin:6px 0">
        <div style="font-size:12.5px">Sends text to Claude (claude.ai), outside Island Health. Names, PHN, MRN, DOB, phone, address and doctors\u2019 names are removed automatically: <b>read the text below before sending</b>. Use made-up or sandbox notes until Island Health approves real data. Claude\u2019s answer is a draft: check it before it goes in the chart.</div>
        <textarea id="pdfaitext${k}" rows="12" class="mono" spellcheck="false"></textarea>
        <div class="row"><button class="primary" data-dcaigo="${k}">Copy and open Claude</button> <span class="muted" id="pdfaimsg${k}"></span></div></div>
      <div class="row"><button data-dccopy="${k}">Copy draft note</button> <button data-dcrb="${k}">Rebuild from above</button> <label><input type="checkbox" class="dckeep" data-k="${k}" checked> Keep this draft as a note for the patient</label> <span class="muted" id="pdfdcmsg${k}">${r.draft.dirty ? "Edited by you: changes above no longer update it (Rebuild to start again)." : ""}</span></div>
      <div class="muted">"What to watch for" uses standard return-precaution text for the conditions and medicines named in the note (heart failure, COPD, infection, blood thinner, diabetes…): check it fits this patient. UNVERIFIED draft written by Claude.</div></details>`;
  }
  function wireDraft(results, problems) {
    const redo = (k) => { const r = results[+k]; if (!r || !r.draft || r.draft.dirty) return; r.draft.out = draftText(r); const ta = document.getElementById("pdfdc" + k); if (ta) ta.value = r.draft.out; saveLast(results, problems); };
    const it = (el) => results[+el.dataset.k].draft.follow[+el.dataset.i];
    box.querySelectorAll(".dcon").forEach((el) => (el.onchange = () => { it(el).on = el.checked; redo(el.dataset.k); }));
    box.querySelectorAll(".dctype").forEach((el) => (el.onchange = () => { it(el).type = el.value; redo(el.dataset.k); }));
    box.querySelectorAll(".dctext").forEach((el) => (el.oninput = () => { it(el).text = el.value; redo(el.dataset.k); }));
    box.querySelectorAll(".dcwhen").forEach((el) => (el.oninput = () => { it(el).when = el.value; redo(el.dataset.k); }));
    box.querySelectorAll(".dcfp").forEach((el) => (el.oninput = () => { results[+el.dataset.k].draft.fpDays = el.value; redo(el.dataset.k); }));
    box.querySelectorAll("button[data-dcadd]").forEach((b) => (b.onclick = () => { const r = results[+b.dataset.dcadd]; r.draft.follow.push({ type: "referral", text: "", when: "", on: true }); review(results, problems); }));
    box.querySelectorAll("textarea[id^=pdfdc]").forEach((t) => (t.oninput = () => { const r = results[+t.id.slice(5)]; r.draft.out = t.value; r.draft.dirty = true; const m = document.getElementById("pdfdcmsg" + t.id.slice(5)); if (m) m.textContent = "Edited by you: changes above no longer update it (Rebuild to start again)."; saveLast(results, problems); }));
    box.querySelectorAll("button[data-dcrb]").forEach((b) => (b.onclick = () => { const r = results[+b.dataset.dcrb]; if (r.draft.dirty && !confirm("Rebuild the draft note? Your edits in it will be lost.")) return; r.draft.dirty = false; redo(b.dataset.dcrb); const m = document.getElementById("pdfdcmsg" + b.dataset.dcrb); if (m) m.textContent = ""; }));
    box.querySelectorAll("button[data-dcai]").forEach((b) => (b.onclick = () => {
      const k = b.dataset.dcai, r = results[+k], panel = document.getElementById("pdfai" + k);
      if (!panel.hidden) { panel.hidden = true; return; }
      const text = r.textDraft != null ? r.textDraft : r.text, d = X().demographics(text);
      document.getElementById("pdfaitext" + k).value = D().aiPrompt({ note: D().deidentify(text, d), found: r.draft.follow.filter((x) => x.on !== false).map((x) => x.text), age: d.age != null ? (d.age >= 90 ? "90+" : d.age) : "", sex: d.sex || "" });
      panel.hidden = false;
    }));
    box.querySelectorAll("button[data-dcaigo]").forEach((b) => (b.onclick = async () => {
      const k = b.dataset.dcaigo, ta = document.getElementById("pdfaitext" + k), msg = document.getElementById("pdfaimsg" + k);
      try { await navigator.clipboard.writeText(ta.value); } catch (e) { ta.select(); document.execCommand("copy"); }
      const url = D().claudeUrl(ta.value); window.open(url, "_blank", "noopener");
      msg.textContent = url.includes("?q=") ? "Copied and opened. If the message box in Claude is empty, paste (Ctrl+V)." : "Copied. The note is long: paste it into Claude (Ctrl+V).";
    }));
    box.querySelectorAll("button[data-dccopy]").forEach((b) => (b.onclick = async () => { const ta = document.getElementById("pdfdc" + b.dataset.dccopy); try { await navigator.clipboard.writeText(ta.value); } catch (e) { ta.select(); document.execCommand("copy"); } b.textContent = "Copied"; setTimeout(() => (b.textContent = "Copy draft note"), 1500); }));
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
    saveLast(results, problems);
    // per file: an editable summary, and the text that was read (OCR or text layer) to check and correct
    results.forEach((r, k) => {
      if (r.summary == null) r.summary = X().summarize(r);
      h += `<details open class="pdfsec"><summary><b>Summary: ${esc(r.fileName)}</b> <span class="muted">editable: correct it, then copy it or keep it as a note</span></summary>
        <textarea id="pdfsum${k}" rows="14" spellcheck="true">${esc(r.summary)}</textarea>
        <div class="row"><button data-copy="${k}">Copy summary</button> <label><input type="checkbox" class="sumkeep" data-k="${k}"${r.typed ? "" : " checked"}> Keep this summary as a note for the patient</label></div></details>
        <details${r.ocr || r.typed ? " open" : ""} class="pdfsec"><summary><b>${r.typed ? "Your text" : "Text read from " + esc(r.fileName)}</b>${r.ocr ? ' <span class="bad">(OCR)</span>' : ""} <span class="muted">${r.lines} lines${r.edited ? ", corrected by you" : ""}</span></summary>
        <div class="muted">${r.ocr ? "This is what OCR read from the page pictures. " : ""}Fix misread words or numbers here, then press Re-read: the items table and summary are rebuilt from your corrected text.</div>
        <textarea id="pdftxt${k}" rows="18" class="mono" spellcheck="false">${esc(r.textDraft != null ? r.textDraft : r.text)}</textarea>
        <div class="row"><button data-reread="${k}">Re-read corrected text</button> <button data-copytxt="${k}">Copy text</button></div></details>`;
      h += draftCard(r, k);
    });
    if (!all.length) { h += `<p>Nothing recognisable was found.${results.length ? " You can still keep the PDF text as a note below." : ""}</p>`; }
    else {
      h += `<table><tr><th></th><th>Type</th><th>Item</th><th>Value</th><th>Unit</th><th>Date</th><th>Source line</th></tr>`;
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
    h += `<p><label><input type="checkbox" id="pdfkeep"${results.some((r) => r.typed || /history of present illness|chief complaint|\bhpi\b|admission note|consult(?:ation)? note|progress note|discharge summary|physical exam/i.test(r.text)) ? " checked" : ""}> Also keep the ${results.some((r) => r.typed) ? "typed" : "PDF"} text as a note, so Notes, Risk screen and other tabs that read notes can see it (the AI tab only sends data out if you have set it up to)</label></p>
      <div style="border:1px solid #dde3ea;border-radius:8px;padding:8px 12px;margin:8px 0"><b>Where should this go?</b>
        <div><label><input type="radio" name="pdfdest" value="current" checked> Add to the patient shown at the top: <b>${esc(patientName())}</b>${isPdfPt(pid()) ? " (PDF-only patient)" : ""}</label></div>
        <div><label><input type="radio" name="pdfdest" value="new"> Open as a <b>separate patient</b> made only from this ${results.every((r) => r.typed) ? "text" : "PDF"} (no Cerner data)</label></div>
        ${others.length ? `<div><label><input type="radio" name="pdfdest" value="existing"> Add to another PDF-only patient: <select id="pdfexist">${others.map((p) => `<option value="${esc(p.id)}">${esc(p.label)}</option>`).join("")}</select></label></div>` : ""}
        <div id="pdfcur" style="margin-top:6px"><label><b><input type="checkbox" id="pdfpt"> This ${results.every((r) => r.typed) ? "text" : "PDF"} is for ${esc(patientName())}</b></label></div>
        <div id="pdfnew" hidden style="margin-top:6px">
          <div class="muted">Details found in the ${results.every((r) => r.typed) ? "text" : "PDF"} are filled in and update as you edit the text above (a box you change yourself is left alone): check them. Nothing here goes to Cerner; this patient exists only in this browser tab.</div>
          <table style="width:auto"><tr><td>Name</td><td><input type="text" id="np-given" placeholder="First name" value="${esc(demo.given || "")}" size="16"> <input type="text" id="np-family" placeholder="Last name" value="${esc(demo.family || "")}" size="16"></td></tr>
            <tr><td>Sex</td><td><select id="np-sex"><option value="">Unknown</option><option value="female"${demo.sex === "female" ? " selected" : ""}>Female</option><option value="male"${demo.sex === "male" ? " selected" : ""}>Male</option></select></td></tr>
            <tr><td>Date of birth</td><td><input type="date" id="np-dob" value="${esc(demo.birthDate || "")}"> or age <input type="text" id="np-age" size="4" value="${demo.birthDate ? "" : esc(demo.age || "")}">${demo.birthAmbiguous ? ' <span class="bad">check day/month</span>' : ""}</td></tr>
            <tr><td>PHN / outside MRN</td><td><input type="text" id="np-phn" placeholder="PHN" value="${esc(demo.phn || "")}" size="12"> <input type="text" id="np-mrn" placeholder="MRN" value="${esc(demo.mrn || "")}" size="12"></td></tr></table>
        </div>
      </div>
      <p><button class="primary" id="pdfadd" disabled>Add ticked items</button> <button id="pdfback">Back</button> <button id="pdfx2">Cancel</button> <span class="muted" id="pdfres"></span></p>`;
    box.innerHTML = h;
    wireDraft(results, problems);
    const copy = async (b, ta, label) => { try { await navigator.clipboard.writeText(ta.value); } catch (e) { ta.select(); document.execCommand("copy"); } b.textContent = "Copied"; setTimeout(() => (b.textContent = label), 1500); };
    box.querySelectorAll("button[data-copy]").forEach((b) => (b.onclick = () => copy(b, document.getElementById("pdfsum" + b.dataset.copy), "Copy summary")));
    box.querySelectorAll("button[data-copytxt]").forEach((b) => (b.onclick = () => copy(b, document.getElementById("pdftxt" + b.dataset.copytxt), "Copy text")));
    box.querySelectorAll("textarea[id^=pdfsum]").forEach((t) => (t.oninput = () => { results[+t.id.slice(6)].summary = t.value; saveLast(results, problems); }));
    box.querySelectorAll("textarea[id^=pdftxt]").forEach((t) => (t.oninput = () => { results[+t.id.slice(6)].textDraft = t.value; saveLast(results, problems); }));
    box.querySelectorAll("button[data-reread]").forEach((b) => (b.onclick = () => {
      const k = +b.dataset.reread, old = results[k], txt = document.getElementById("pdftxt" + k).value;
      const nr = X().fromText(txt, { fileName: old.fileName }); nr.ocr = old.ocr; nr.typed = old.typed; nr.edited = true; results[k] = nr; // summary is rebuilt from the corrected text
      review(results, problems);
    }));
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
    // patient details follow the (edited) text: refill boxes the physician has not changed by hand
    const NP = { "np-given": "given", "np-family": "family", "np-sex": "sex", "np-dob": "birthDate", "np-age": "age", "np-phn": "phn", "np-mrn": "mrn" };
    Object.keys(NP).forEach((id) => { const el = document.getElementById(id); if (el) el.dataset.auto = el.value; });
    const refill = () => {
      const txt = results.map((r, k) => (document.getElementById("pdftxt" + k) || {}).value || r.text).join("\n");
      const d = X().demographics(txt); if (d.birthDate) d.age = "";
      Object.entries(NP).forEach(([id, key]) => { const el = document.getElementById(id); if (!el || el.value !== el.dataset.auto) return; const v = d[key] == null ? "" : String(d[key]); el.value = v; el.dataset.auto = el.value; });
      results.forEach((r, k) => { if (r.draft && !r.draft.dirty && D()) { r.draft.out = draftText(r); const ta = document.getElementById("pdfdc" + k); if (ta) ta.value = r.draft.out; } });
      refreshDest();
    };
    let rt = null; box.querySelectorAll("textarea[id^=pdftxt]").forEach((t) => t.addEventListener("input", () => { clearTimeout(rt); rt = setTimeout(refill, 400); }));
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
      const keepDoc = (text, name, r) => { if (!String(text || "").trim()) return; const d = X().docResource(text, Object.assign({ fileName: name }, ctxBase), r.docT); if (!st.items.some((x) => x.id === d.id)) { st.items.push(d); added.push(d); (filesAdded[r.fileName] = filesAdded[r.fileName] || []).push(d.id); } };
      results.forEach((r, k) => {
        if (document.getElementById("pdfkeep").checked) keepDoc((document.getElementById("pdftxt" + k) || {}).value || r.text, r.fileName, r); // the text as corrected on screen
        const sk = box.querySelector('.sumkeep[data-k="' + k + '"]'); if (sk && sk.checked) keepDoc((document.getElementById("pdfsum" + k) || {}).value, r.fileName + " (summary)", r);
        const dk = box.querySelector('.dckeep[data-k="' + k + '"]'); if (dk && dk.checked) keepDoc((document.getElementById("pdfdc" + k) || {}).value, r.fileName + " (draft discharge note)", r);
      });
      Object.keys(filesAdded).forEach((n) => { const k = results.findIndex((r) => r.fileName === n), r = results[k] || {};
        st.files.push({ name: n, ids: filesAdded[n], at: Date.now(), ocr: !!r.ocr, docT: r.docT || null,
          summary: (document.getElementById("pdfsum" + k) || {}).value || r.summary || "", draft: (document.getElementById("pdfdc" + k) || {}).value || (r.draft && r.draft.out) || "", text: (document.getElementById("pdftxt" + k) || {}).value || r.text || "" }); });
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
      ${st.files.length ? `<table><tr><th>File</th><th>Items</th><th>Added</th><th></th></tr>${st.files.map((f, i) => `<tr><td>${esc(f.name)}</td><td>${f.ids.length}</td><td>${new Date(f.at).toLocaleString()}</td><td><button data-view="${i}">Summary / text</button> <button data-rm="${i}">Remove</button></td></tr>`).join("")}</table>` : "<p>Nothing imported.</p>"}
      ${loadLast() ? `<p><button id="pdflast2">Back to the last review screen</button></p>` : ""}
      <p class="muted">Imported items are kept only in this browser tab and disappear when the tab is closed.</p>
      ${pdfPatients().length || isPdfPt(pid()) ? `<h2 style="margin-top:14px">PDF-only patients</h2>
        <table><tr><th>Patient</th><th>Items</th><th></th></tr>${pdfPatients().map((p, i) => `<tr><td>${esc(p.label)}${p.id === pid() ? " <b>(open now)</b>" : ""}</td><td>${storeFor(p.id).items.length}</td>
          <td>${p.id === pid() ? "" : `<button data-open="${esc(p.id)}">Open</button> `}<button data-del="${i}">Delete</button></td></tr>`).join("")}</table>
        ${isPdfPt(pid()) && sessionStorage.getItem("pdfpt-return") ? `<p><button id="pdfback2" class="primary">Back to the Cerner patient</button></p>` : ""}` : ""}
      <p><button id="pdfclr" ${st.items.length ? "" : "disabled"}>Remove everything</button> <button id="pdfx4">Close</button></p>`;
    modal.classList.add("on");
    box.querySelectorAll("button[data-rm]").forEach((b) => (b.onclick = () => { const s = store(), f = s.files[+b.dataset.rm]; s.items = s.items.filter((x) => !f.ids.includes(x.id)); s.files.splice(+b.dataset.rm, 1); save(s); refreshCount(); reloadTabs(); manage(); }));
    box.querySelectorAll("button[data-view]").forEach((b) => (b.onclick = () => viewFile(+b.dataset.view)));
    const l2 = document.getElementById("pdflast2"); if (l2) l2.onclick = () => { const L = loadLast(); if (L) review(L.results, L.problems || []); };
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
  /* summary and read text of one imported file: edit, copy, and update the kept summary note */
  function viewFile(i) {
    const st = store(), f = st.files[i]; if (!f) return manage();
    const has = f.summary != null || f.text != null;
    const noteIdx = () => st.items.findIndex((x) => x.resourceType === "DocumentReference" && x.description === "Imported PDF: " + f.name + " (summary)");
    box.innerHTML = `<h2>${esc(f.name)}</h2><div class="muted">Imported ${esc(new Date(f.at).toLocaleString())}${f.ocr ? " · read by OCR: check values against the PDF" : ""}</div>
      ${!has ? `<div class="warn">This PDF was imported before summaries were saved. Import it again to get its summary and text.</div>` : `
      <details open class="pdfsec"><summary><b>Summary</b> <span class="muted">editable</span></summary>
        <textarea id="vsum" rows="16" spellcheck="true">${esc(f.summary || "")}</textarea>
        <div class="row"><button id="vcopy">Copy summary</button> <button id="vsave" class="primary">Save changes</button> <span class="muted" id="vmsg">${noteIdx() >= 0 ? "Saving also updates the summary note the other tabs see." : "Not kept as a note: Save changes keeps the edited summary here only."}</span></div></details>
      ${f.draft ? `<details class="pdfsec"><summary><b>Draft discharge note</b> <span class="muted">as kept at import</span></summary>
        <textarea id="vdc" rows="18" class="mono">${esc(f.draft)}</textarea>
        <div class="row"><button id="vcopydc">Copy draft note</button></div></details>` : ""}
      <details class="pdfsec"><summary><b>Text read from the PDF</b>${f.ocr ? ' <span class="bad">(OCR)</span>' : ""}</summary>
        <textarea id="vtxt" rows="18" class="mono" readonly>${esc(f.text || "")}</textarea>
        <div class="row"><button id="vcopyt">Copy text</button></div></details>`}
      <p><button id="vback">Back</button> <button id="vx">Close</button></p>`;
    modal.classList.add("on");
    const copy = async (b, ta, label) => { try { await navigator.clipboard.writeText(ta.value); } catch (e) { ta.select(); document.execCommand("copy"); } b.textContent = "Copied"; setTimeout(() => (b.textContent = label), 1500); };
    if (has) {
      document.getElementById("vcopy").onclick = (e) => copy(e.target, document.getElementById("vsum"), "Copy summary");
      document.getElementById("vcopyt").onclick = (e) => copy(e.target, document.getElementById("vtxt"), "Copy text");
      const vd = document.getElementById("vcopydc"); if (vd) vd.onclick = (e) => copy(e.target, document.getElementById("vdc"), "Copy draft note");
      document.getElementById("vsave").onclick = () => {
        const v = document.getElementById("vsum").value; f.summary = v;
        const j = noteIdx();
        if (j >= 0) { const old = st.items[j], nd = X().docResource(v, { fileName: f.name + " (summary)", patientId: pid(), now: Date.now() }, f.docT); nd.id = old.id; st.items[j] = nd; }
        save(st); document.getElementById("vmsg").textContent = "Saved" + (j >= 0 ? ": tabs reloaded with the new summary note." : ".");
        if (j >= 0) reloadTabs();
      };
    }
    document.getElementById("vback").onclick = manage; document.getElementById("vx").onclick = close;
  }
  window.PdfImportUI = { refreshCount, review, pdfLines };
  const t = setInterval(() => { if (pid()) { refreshCount(); clearInterval(t); } }, 500);
})();
