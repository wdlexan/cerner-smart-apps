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
  function opened() { result = null; $("dname").textContent = file.name; $("drun").disabled = false; $("dsave").disabled = true; $("dtbl").innerHTML = ""; say("Ready. Press <b>Update from the chart</b>."); }

  async function client() {
    if (typeof FHIR === "undefined") throw new Error("the chart connection didn't load");
    try { return await FHIR.oauth2.ready(); } catch (e) { throw new Error("not connected to the chart: open the toolkit from PowerChart or from its link, then come back to this tab"); }
  }
  // a copy of the client pointed at another patient (same login, same permissions)
  function forPatient(c, id) { return Object.create(c, { patient: { value: { id, read: () => c.request("Patient/" + id) } } }); }
  async function findByMrn(c, mrn) {
    const hits = (await c.request("Patient?identifier=" + encodeURIComponent(mrn), { flat: true })).filter((p) => p.resourceType === "Patient");
    if (!hits.length) throw new Error("no patient with MRN " + mrn);
    if (hits.length > 1) throw new Error(hits.length + " patients matched MRN " + mrn);
    return hits[0].id;
  }

  async function run() {
    if (!file) return;
    $("drun").disabled = true; $("dsave").disabled = true; $("dtbl").innerHTML = "";
    try {
      await loadJs(JSZIP, () => window.JSZip);
      const c = await client();
      let n = 0, noAccess = 0;
      const res = await PListXlsx.daily(window.JSZip, file.buf.slice(0), async (p) => {
        n++; say(`Reading chart ${n}: ${esc(p.name)}…`);
        const mrn = String(p.mrn || "").replace(/\D/g, "");
        if (!mrn) throw new Error("no MRN in the file (add it in the mrn column)");
        let id;
        try { id = await findByMrn(c, mrn); } catch (e) { if (/\b40[13]\b|forbidden|unauthori/i.test(e.message || "")) { noAccess++; throw new Error("not allowed to look up other patients from this launch"); } throw e; }
        const pc = forPatient(c, id);
        const g = await DcChart.gather(pc, () => {});
        let allergies = [];
        try { allergies = (await c.request(`AllergyIntolerance?patient=${id}`, { flat: true })).filter((a) => a.resourceType === "AllergyIntolerance"); } catch (e) {}
        const raw = Object.assign({ now: Date.now() }, g.raw), f = DcRules.parse(raw);
        let dcc = null; try { dcc = window.DccRules ? DccRules.screen(f, raw) : null; } catch (e) {}
        return PListDaily.values(f, raw, allergies, { pending: DcRules.pending, dcc });
      }, { type: "uint8array" });
      result = res;
      const ok = res.report.filter((r) => !r.error && !r.skipped);
      $("dtbl").innerHTML = `<tr><th>Patient</th><th>Filled (empty cells only)</th><th>Check today</th></tr>` + res.report.map((r) => `<tr><td>${esc(r.name)}</td>` +
        (r.error ? `<td colspan="2" class="err">${esc(r.error)}</td>` : `<td>${r.filled.length ? esc(r.filled.join(", ")) : '<span class="muted">nothing empty to fill</span>'}</td><td>${r.check.length ? esc(r.check.join(" · ")) : '<span class="muted">nothing flagged</span>'}</td>`) + "</tr>").join("");
      $("dsave").disabled = !ok.length;
      say(`Read ${ok.length} of ${res.report.length} charts. Check the table, then press <b>${canSaveBack && file.handle ? "Save to " + esc(file.name) : "Download updated file"}</b>.` +
        (noAccess ? "<br><b>This launch can only read the open patient.</b> Open the toolkit from its own link (it asks you to sign in) to update the whole list." : ""), ok.length ? "muted" : "err");
    } catch (e) { say("Could not update: " + esc(e.message || e), "err"); }
    $("drun").disabled = false;
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
        say(`Downloaded an updated <b>${esc(file.name)}</b>. Move it into your OneDrive folder (this browser can't save over the original).`, "ok");
      }
      $("dsave").disabled = true;
    } catch (e) { say("Could not save: " + esc(e.message || e) + (/lock|in use|NoModification|InvalidState/i.test(String(e && (e.name + e.message))) ? " (close the file in Excel first)" : ""), "err"); }
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
        try { pts = pts.concat((await c.request(q, { flat: true })).filter((p) => p.resourceType === "Patient")); } catch (e) {}
        if (pts.length >= 5) break;
      }
      const seen = new Set(), list = [];
      pts.forEach((p) => { const mrn = mrnOf(p); if (!mrn || seen.has(mrn)) return; seen.add(mrn); list.push({ p, mrn }); });
      if (!list.length) throw new Error("no sandbox patients with an MRN were found");
      const now = Date.now(), pick = list.slice(0, 6);
      const groups = [{ floor: "TEST", patients: pick.map(({ p, mrn }, i) => {
        const n = (p.name || [])[0] || {}, age = p.birthDate ? Math.floor((now - new Date(p.birthDate)) / (365.25 * 864e5)) : "";
        return { name: `${n.family || "?"}, ${(n.given || []).join(" ")}`.trim(), location: `TEST-VGH T${701 + i} A`, age, mrn, sex: p.gender === "female" ? "F" : p.gender === "male" ? "M" : "",
          reason: "sandbox test patient", gfr: i === 0 ? 55 : "", todo: i === 0 ? ["typed by me: should stay"] : [] };
      }) }];
      const tpl = await (await fetch("template.xlsx?v=20261120m")).arrayBuffer();
      const u8 = await PListXlsx.build(window.JSZip, tpl, groups, { type: "uint8array" });
      file = { name: "TEST_sandbox_list.xlsx", buf: u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength), handle: null };
      opened();
      say(`Made a test list of ${pick.length} sandbox patients (${esc(pick.map((x) => x.mrn).join(", "))}). The first one has a typed gfr (55) and to-do, to show they are kept. Now press <b>Update from the chart</b>.`, "ok");
    } catch (e) { say("Could not make a test list: " + esc(e.message || e), "err"); }
    btn.disabled = false;
  }
  if (isTest) { $("dtest").hidden = false; $("dtest").onclick = makeTestList; }

  $("dopen").onclick = openList; $("drun").onclick = run; $("dsave").onclick = save;
  $("dsave").textContent = canSaveBack ? "Save to the same file" : "Download updated file";
})();
