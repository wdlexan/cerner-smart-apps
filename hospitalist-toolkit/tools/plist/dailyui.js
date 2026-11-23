/* Daily update card on the Patient list tab: open my Excel list -> read each patient's chart by MRN -> fill EMPTY cells and
   rebuild the "check today" column -> save back to the SAME file (in Edge/Chrome; a file in the OneDrive folder then syncs).
   The list (real patient data) stays in this browser's memory and your file: nothing is uploaded or kept by the toolkit. */
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const JSZIP = "https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js";
  const loadJs = (src, test) => (test() ? Promise.resolve() : new Promise((ok, bad) => { const s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = () => bad(new Error("could not load " + src.split("/").pop() + " (network blocked?)")); document.head.appendChild(s); }));
  let file = null; // { name, buf, handle } memory only
  let result = null; // { data, report }
  const canSaveBack = "showOpenFilePicker" in window;

  function say(html, cls) { const m = $("dmsg"); m.className = "small " + (cls || "muted"); m.innerHTML = html; }
  async function openList() {
    try {
      if (canSaveBack) {
        const [h] = await window.showOpenFilePicker({ types: [{ description: "Excel list", accept: { "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"] } }] });
        const f = await h.getFile(); file = { name: f.name, buf: await f.arrayBuffer(), handle: h };
      } else { $("dfile").click(); return; }
      opened();
    } catch (e) { if (e && e.name !== "AbortError") say("Could not open the file: " + esc(e.message || e), "err"); }
  }
  $("dfile").onchange = async (e) => { const f = e.target.files && e.target.files[0]; if (!f) return; file = { name: f.name, buf: await f.arrayBuffer(), handle: null }; e.target.value = ""; opened(); };
  function opened() {
    result = null; $("dname").textContent = file.name; $("drun").disabled = false; $("dstyle").disabled = false; $("dsave").disabled = true; $("dtbl").innerHTML = "";
    $("dsave").textContent = file.handle ? "Save to the same file" : "Download updated file";
    say("Ready. Press <b>Update from the chart</b>, or <b>🎨 New look</b> to restyle the file.");
  }

  // every slow step gets a time limit, so the page can never sit on "connecting" forever
  const within = (ms, p, what) => { let tm; return Promise.race([p, new Promise((_, rej) => { tm = setTimeout(() => rej(new Error(what + " took more than " + Math.round(ms / 1000) + " s")), ms); })]).finally(() => clearTimeout(tm)); };
  let conn = null; // the chart connection, made once and reused
  async function client() {
    if (conn) return conn;
    if (typeof FHIR === "undefined") throw new Error("the chart connection didn't load (reload the toolkit)");
    try { conn = await within(15000, FHIR.oauth2.ready(), "connecting to the chart"); return conn; }
    catch (e) { conn = null; throw new Error(/took more/.test(e.message) ? e.message + ": reload the toolkit (Ctrl+Shift+R) or open its link again" : "not connected to the chart: open the toolkit from PowerChart or from its link, then come back to this tab"); }
  }
  // a copy of the client pointed at another patient (same login, same permissions)
  function forPatient(c, id) { return Object.create(c, { patient: { value: { id, read: () => c.request("Patient/" + id) } } }); }
  /* Cerner often finds a patient by MRN only when the search names the MRN's system ("urn:oid:…|1234567").
     Try the bare number first, then each MRN system seen on this server (learned from the open patient and the test list). */
  const mrnSystems = new Set();
  const isMr = (i) => /\bMR\b|MRN|medical record/i.test(JSON.stringify(i.type || {}));
  function learnSystems(p) { (p && p.identifier || []).filter(isMr).forEach((i) => { if (i.system) mrnSystems.add(i.system); }); }
  async function learnFromOpenPatient(c) { try { if (c.patient && c.patient.id) learnSystems(await within(15000, c.request("Patient/" + c.patient.id), "reading the open patient")); } catch (e) {} }
  async function findByMrn(c, mrn) {
    const tries = [mrn].concat(Array.from(mrnSystems).map((sys) => sys + "|" + mrn));
    let lastErr = null;
    for (const q of tries) {
      try {
        const hits = (await within(25000, c.request("Patient?identifier=" + encodeURIComponent(q), { flat: true }), "finding MRN " + mrn)).filter((p) => p.resourceType === "Patient");
        const exact = hits.filter((p) => (p.identifier || []).some((i) => String(i.value || "").replace(/\D/g, "") === mrn));
        const use = exact.length ? exact : hits;
        if (use.length === 1) return use[0].id;
        if (use.length > 1) throw new Error(use.length + " patients matched MRN " + mrn);
      } catch (e) { if (/matched MRN|\b40[13]\b|forbidden|unauthori/i.test(e.message || "")) throw e; lastErr = e; }
    }
    throw new Error("no patient found with MRN " + mrn + (lastErr ? " (Cerner said: " + String(lastErr.message || lastErr).slice(0, 120) + ")" : ""));
  }

  /* light chart read for the daily list: only what the columns and "check today" need, all requests in parallel,
     no note or report text (that is what made it slow). Same shape as DcChart.gather's raw. */
  const iso = (t) => new Date(t).toISOString().slice(0, 10), DAY = 864e5;
  async function gatherLite(c, pid) {
    const errors = [];
    const get = (url, name, pages) => {
      let tm; return Promise.race([c.request(url, { pageLimit: pages || 1, flat: true }), new Promise((_, rej) => { tm = setTimeout(() => rej(new Error("timed out after 25 s")), 25000); })])
        .then((r) => { clearTimeout(tm); return (Array.isArray(r) ? r : [r]).filter((x) => x && x.resourceType && x.resourceType !== "OperationOutcome"); })
        .catch((e) => { clearTimeout(tm); errors.push(name + ": " + (e.message || e)); return []; });
    };
    const now = Date.now();
    const [patient, encounters, labs, vitals, medreqs, problems, reports, orders, allergies] = await Promise.all([
      get(`Patient/${pid}`, "patient").then((r) => r[0] || null),
      get(`Encounter?patient=${pid}&_count=10`, "encounters"),
      get(`Observation?patient=${pid}&category=laboratory&date=ge${iso(now - 10 * DAY)}&_count=100`, "labs (10 days)", 2),
      get(`Observation?patient=${pid}&category=vital-signs&date=ge${iso(now - 2 * DAY)}&_count=100`, "vitals (2 days)"),
      get(`MedicationRequest?patient=${pid}&_count=100`, "medication orders", 2),
      get(`Condition?patient=${pid}&category=problem-list-item&_count=50`, "problem list"),
      get(`DiagnosticReport?patient=${pid}&date=ge${iso(now - 14 * DAY)}&_count=50`, "reports (14 days)"),
      get(`ServiceRequest?patient=${pid}&authored=ge${iso(now - 14 * DAY)}&_count=50`, "orders (14 days)"),
      get(`AllergyIntolerance?patient=${pid}`, "allergies")]);
    const inpt = encounters.filter((e) => e.period && e.period.start && /IMP|inpatient|ACUTE|observation|OBSENC/i.test(JSON.stringify(e.class || {}) + JSON.stringify(e.type || {})));
    const enc = (inpt.length ? inpt : encounters).filter((e) => e.period && e.period.start).sort((a, b) => new Date(b.period.start) - new Date(a.period.start)).slice(0, 1);
    const seen = new Set(), obs = labs.concat(vitals).filter((o) => (o.id ? (seen.has(o.id) ? false : seen.add(o.id)) : true));
    return { raw: { patient, encounters: enc, obs, medreqs, medstatements: [], conditions: problems, reports, orders, notes: [] }, allergies, errors };
  }
  async function valuesFor(c, p) {
    const mrn = String(p.mrn || "").replace(/\D/g, "");
    if (!mrn) throw new Error("no MRN in the file (add it in the mrn column)");
    let id;
    try { id = await findByMrn(c, mrn); } catch (e) { if (/\b40[13]\b|forbidden|unauthori/i.test(e.message || "")) throw new Error("not allowed to look up other patients from this launch"); throw e; }
    const g = await gatherLite(c, id), raw = Object.assign({ now: Date.now() }, g.raw), f = DcRules.parse(raw);
    let dcc = null; try { dcc = window.DccRules ? DccRules.screen(f, raw) : null; } catch (e) {}
    return PListDaily.values(f, raw, g.allergies, { pending: DcRules.pending, dcc });
  }

  const stayCls = (t) => { const m = String(t || "").match(/ (\d+)\/(\d+)$/); if (!m) return ""; return +m[1] >= +m[2] ? "over" : +m[1] >= +m[2] - 1 ? "near" : "ok"; };
  async function run() {
    if (!file) return;
    $("drun").disabled = true; $("dsave").disabled = true; $("dtbl").innerHTML = "";
    say("Working: connecting to the chart…");
    const slow = setTimeout(() => { if (/connecting/.test($("dmsg").textContent)) say("Still connecting to the chart… (if this stays, reload the toolkit: the sign-in may have expired)"); }, 15000);
    try {
      say("Working: loading the Excel reader…");
      await within(20000, loadJs(JSZIP, () => window.JSZip), "loading the Excel reader");
      say("Working: connecting to the chart…");
      const c = await client();
      say("Working: checking the MRN format…");
      await learnFromOpenPatient(c);
      say("Working: reading your list file…");
      const L = await within(20000, PListXlsx.readList(window.JSZip, file.buf.slice(0)), "reading your list file");
      if (!L.patients.length) throw new Error("no patients found in the file");
      // read the charts 3 at a time, then write the file
      const todo = L.patients.slice(), out = new Map(); let done = 0, noAccess = 0;
      const tick = () => say(`Reading charts: ${done} of ${L.patients.length} done…`);
      tick();
      const worker = async () => { while (todo.length) { const p = todo.shift(); const key = p.first;
        out.set(key, await within(60000, valuesFor(c, p), "reading this chart").then((v) => ({ v }), (e) => { if (/not allowed/.test(e.message || "")) noAccess++; return { e }; }));
        done++; tick(); } };
      const total = L.patients.length; todo.length = 0; todo.push(...L.patients);
      await Promise.all([worker(), worker(), worker()]);
      say(`Read ${total} charts. Writing the file…`);
      const res = await PListXlsx.daily(window.JSZip, file.buf.slice(0), async (p) => { const r = out.get(p.first); if (!r) return null; if (r.e) throw r.e; return r.v; }, { type: "uint8array" });
      result = res;
      const ok = res.report.filter((r) => !r.error && !r.skipped);
      $("dtbl").innerHTML = `<tr><th>Patient</th><th>Stay</th><th>Filled (empty cells only)</th><th>Check today</th></tr>` + res.report.map((r) => `<tr><td>${esc(r.name)}</td><td class="stay ${stayCls(r.stay)}">${esc(r.stay || "")}</td>` +
        (r.error ? `<td colspan="2" class="err">${esc(r.error)}</td>` : `<td>${r.filled.length ? esc(r.filled.join(", ")) : '<span class="muted">nothing empty to fill</span>'}</td><td>${r.check.length ? esc(r.check.join(" · ")) : '<span class="muted">nothing flagged</span>'}</td>`) + "</tr>").join("");
      $("dsave").disabled = !ok.length;
      say(`Read ${ok.length} of ${res.report.length} charts. Check the table, then press <b>${file.handle ? "Save to the same file" : "Download updated file"}</b>` + (file.handle ? "" : " (it goes to your Downloads folder)") + "." +
        (noAccess ? "<br><b>This launch can only read the open patient.</b> Open the toolkit from its own link (it asks you to sign in) to update the whole list." : ""), ok.length ? "muted" : "err");
    } catch (e) { say("Could not update: " + esc(e.message || e), "err"); }
    finally { clearTimeout(slow); $("drun").disabled = false; }
  }

  async function save() {
    if (!result) return;
    try {
      if (file.handle) {
        if (file.handle.requestPermission && (await file.handle.requestPermission({ mode: "readwrite" })) !== "granted") throw new Error("permission to save was not given");
        const w = await file.handle.createWritable(); await w.write(result.data); await w.close();
        file.buf = result.data.buffer.slice(0); // next run starts from what was saved
        say(`Saved to <b>${esc(file.name)}</b>. If that file is in your OneDrive folder it syncs by itself.`, "ok");
      } else {
        const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([result.data], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
        a.download = file.name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
        say(`Downloaded <b>${esc(file.name)}</b> to your <b>Downloads</b> folder (in Edge: the download icon at the top right, or press Ctrl+J). To update the same file each day, move it into your OneDrive folder and open it with <b>📂 Open my list…</b>.`, "ok");
      }
      $("dsave").disabled = true;
    } catch (e) { say("Could not save: " + esc(e.message || e) + (/lock|in use|NoModification|InvalidState/i.test(String(e && (e.name + e.message))) ? " (close the file in Excel first)" : ""), "err"); }
  }
  // give the open file the new look (same values, same columns); nothing leaves this computer
  async function restyleList() {
    if (!file) return;
    $("dstyle").disabled = true; $("dsave").disabled = true; $("dtbl").innerHTML = "";
    try {
      say("Restyling…");
      await within(20000, loadJs(JSZIP, () => window.JSZip), "loading the Excel reader");
      const tpl = await (await fetch("template.xlsx?v=20261122j")).arrayBuffer();
      const r = await PListXlsx.restyle(window.JSZip, file.buf.slice(0), tpl, { type: "uint8array" });
      result = { data: r.data };
      file.buf = r.data.buffer.slice(r.data.byteOffset, r.data.byteOffset + r.data.byteLength); // an update after this starts from the new look
      $("dsave").disabled = false;
      say(`New look ready: ${r.patients} patients on ${r.floors} floor${r.floors === 1 ? "" : "s"}, every value kept. Close the file in Excel, then press <b>${file.handle ? "Save to the same file" : "Download updated file"}</b>.`, "ok");
    } catch (e) { say("Could not restyle: " + esc(e.message || e), "err"); }
    $("dstyle").disabled = false;
  }
  /* ---------- test mode only: a made-up list from the Cerner sandbox's synthetic patients ---------- */
  const isTest = (() => { try { return sessionStorage.getItem("toolkit-test") === "1"; } catch (e) { return false; } })();
  function mrnOf(p) {
    const ids = p.identifier || [];
    const mr = ids.find((i) => /\bMR\b|MRN|medical record/i.test(JSON.stringify(i.type || {}))) || ids.find((i) => /mrn|medical/i.test(i.system || "")) || null;
    return mr ? String(mr.value || "").trim() : "";
  }
  async function makeTestList() {
    const btn = $("dtest"); btn.disabled = true;
    try {
      say("Finding test patients in the Cerner sandbox…");
      await loadJs(JSZIP, () => window.JSZip);
      const c = await client();
      let pts = [];
      for (const q of ["Patient?family=SMART&_count=10", "Patient?family=PETERS&_count=5", "Patient?name=a&_count=10"]) {
        try { pts = pts.concat((await within(25000, c.request(q, { flat: true }), "searching the sandbox")).filter((p) => p.resourceType === "Patient")); } catch (e) {}
        if (pts.length >= 5) break;
      }
      const seen = new Set(), list = [];
      pts.forEach((p) => { learnSystems(p); const mrn = mrnOf(p); if (!mrn || seen.has(mrn)) return; seen.add(mrn); list.push({ p, mrn }); });
      if (!list.length) throw new Error("no sandbox patients with an MRN were found");
      const now = Date.now(), pick = list.slice(0, 6);
      const groups = [{ floor: "TEST", patients: pick.map(({ p, mrn }, i) => {
        const n = (p.name || [])[0] || {}, age = p.birthDate ? Math.floor((now - new Date(p.birthDate)) / (365.25 * 864e5)) : "";
        return { name: `${n.family || "?"}, ${(n.given || []).join(" ")}`.trim(), location: `TEST-VGH T${701 + i} A`, age, mrn, sex: p.gender === "female" ? "F" : p.gender === "male" ? "M" : "",
          reason: "sandbox test patient", gfr: i === 0 ? 55 : "", todo: i === 0 ? ["typed by me: should stay"] : [] };
      }) }];
      const tpl = await (await fetch("template.xlsx?v=20261122i")).arrayBuffer();
      const u8 = await PListXlsx.build(window.JSZip, tpl, groups, { type: "uint8array" });
      file = { name: "TEST_sandbox_list.xlsx", buf: u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength), handle: null };
      opened();
      say(`Made a test list of ${pick.length} sandbox patients (${esc(pick.map((x) => x.mrn).join(", "))}). The first one has a typed gfr (55) and to-do, to show they are kept. Now press <b>Update from the chart</b>.`, "ok");
    } catch (e) { say("Could not make a test list: " + esc(e.message || e), "err"); }
    btn.disabled = false;
  }
  if (isTest) { $("dtest").hidden = false; $("dtest").onclick = makeTestList; }

  $("dopen").onclick = openList; $("drun").onclick = run; $("dstyle").onclick = restyleList; $("dsave").onclick = save;
  $("dsave").textContent = "Save / download";
})();
