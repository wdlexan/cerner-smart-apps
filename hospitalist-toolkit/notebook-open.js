/* Hospitalist Toolkit: open a tool tab for a Rounding notebook patient.
   The notebook keeps its own patients (pasted notes, labs, meds). To let any tool tab (Acid-base, Sodium, AKI...) work on one of
   them, this turns the notebook patient into a local "PDF-only" patient (ID pdfpt-nb-<notebook id>), the same mechanism as
   Import PDF > "Open as a separate patient": pdf-overlay.js answers every chart request from these items, and nothing goes to Cerner.
   Items: labs (Observation, LOINC-coded by pdf-extract.js), hospital medication orders (MedicationRequest), the admission note and
   daily notes (DocumentReference). Kept only in this browser tab (sessionStorage) and rebuilt from the notebook each time. Written by Claude. */
(function () {
  const KEY = (pid) => "pdfimport:" + pid;
  const X = () => window.PdfExtract;
  const ALIAS = [[/^carbon dioxide(?: total)?|^total co2|^co2 total/i, "Bicarbonate"], [/^glucose(?: level)?(?: random| fasting)?/i, "Glucose"],
    [/\s+level$/i, ""], [/^hemoglobin whole blood/i, "Hemoglobin"]];
  const labName = (n) => ALIAS.reduce((s, [re, to]) => s.replace(re, to), String(n || "").trim());
  const isHome = (g) => /home|prescri|documented|outpatient/i.test(g || "");

  function patientResource(id, p) {
    const raw = String(p.name || "").trim(); let family = "", given = "";
    if (/,/.test(raw)) { const [f, g] = raw.split(","); family = f.trim(); given = (g || "").trim(); } else { const w = raw.split(/\s+/); family = w.pop() || ""; given = w.join(" "); }
    const identifier = [];
    if (p.phn) identifier.push({ type: { text: "PHN" }, system: "urn:bc:phn", value: String(p.phn).replace(/\D/g, "") });
    if (p.mrn) identifier.push({ type: { coding: [{ code: "MR" }], text: "MRN" }, value: p.mrn });
    let birthDate = p.dob || undefined; if (!birthDate && p.age) birthDate = (new Date().getFullYear() - +p.age) + "-01-01";
    return { resourceType: "Patient", id, meta: { tag: [{ system: "urn:toolkit:import", code: "pdf-only-patient", display: "From the Rounding notebook" }] },
      name: [{ use: "official", text: [given, family].filter(Boolean).join(" ") || "Notebook patient", family: family || undefined, given: given ? given.split(/\s+/) : undefined }],
      gender: /^f/i.test(p.sex || "") ? "female" : /^m/i.test(p.sex || "") ? "male" : undefined, birthDate, identifier: identifier.length ? identifier : undefined,
      address: p.address ? [{ use: "home", text: p.address }] : undefined, telecom: p.phone ? [{ system: "phone", use: "home", value: p.phone }] : undefined };
  }

  function build(p) {
    const id = "pdfpt-nb-" + p.id, ctx = { patientId: id, now: Date.now(), fileName: "Rounding notebook" }, items = [];
    const push = (r) => { if (r && !items.some((x) => x.id === r.id)) items.push(r); };
    (p.labs || []).forEach((l) => {
      const v = String(l.value || "").trim(); if (!v) return;
      const r = X().fromText(`${labName(l.name)} ${v} ${l.unit || ""}`.trim(), {}); const it = (r.items || []).find((i) => i.kind === "lab"); if (!it) return;
      it.t = new Date(`${l.date}T${l.time || "06:00"}:00`).getTime(); if (l.unit) it.unit = l.unit;
      if (l.flag) it.flag = /critical high/i.test(l.flag) ? "HH" : /critical low/i.test(l.flag) ? "LL" : /high/i.test(l.flag) ? "H" : /low/i.test(l.flag) ? "L" : "A";
      push(X().toResource(it, ctx));
    });
    const meds = ((p.admission && p.admission.meds) || []).filter((m) => m.name && !isHome(m.group) && !/discontinued/i.test(m.group || ""));
    meds.forEach((m) => push(X().toResource({ kind: "med", text: [m.name, m.dose, m.route, m.freq].filter(Boolean).join(", "), label: m.name.split(/\s+/)[0], t: Date.now() }, ctx)));
    const adm = (p.admission && p.admission.raw) || "";
    if (adm.trim()) push(X().docResource(adm, Object.assign({}, ctx, { fileName: "Admission note" }), p.admitDate ? new Date(p.admitDate + "T12:00:00").getTime() : null));
    (p.notes || []).forEach((n, i) => { if ((n.text || "").trim()) push(X().docResource(n.text, Object.assign({}, ctx, { fileName: "Daily note " + (n.date || i + 1) }), n.date ? new Date(n.date + "T12:00:00").getTime() : null)); });
    const st = { patient: patientResource(id, p), items, files: [{ name: "Rounding notebook", ids: items.map((x) => x.id), at: Date.now(), text: "" }] };
    sessionStorage.setItem(KEY(id), JSON.stringify(st));
    let l = []; try { l = JSON.parse(sessionStorage.getItem("pdfpatients") || "[]"); } catch (e) {}
    l = l.filter((x) => x.id !== id); l.push({ id, label: [st.patient.name[0].text, "(Rounding notebook)"].join(" "), at: Date.now() });
    sessionStorage.setItem("pdfpatients", JSON.stringify(l));
    return { id, n: items.length };
  }

  /* Called by the Rounding notebook: TKOpenForNotebook(patient, toolKey) */
  window.TKOpenForNotebook = function (p, key) {
    if (!X()) return "The toolkit has not finished loading — try again in a moment.";
    if (!TOOLS.some((t) => t.key === key)) return "Unknown tool.";
    const { id } = build(p);
    if (window.TK && window.TK.patientId === id) { // already on this patient: refresh the chart tabs so they pick up new labs, then open the tool
      document.querySelectorAll("#frames iframe").forEach((f) => { if (!OWN_PATIENTS.includes(f.dataset.k)) try { f.contentWindow.location.reload(); } catch (e) {} });
      show(key); return "";
    }
    if (!window.TK || !window.TK.switchPatient) return "Open the toolkit from PowerChart or the test launch first.";
    try { localStorage.setItem(TAB_KEY, key); } catch (e) {}
    window.TK.switchPatient(id); return "";
  };
  window.TKToolList = () => TOOLS.filter((t) => !OWN_PATIENTS.includes(t.key) && !["today", "plist", "crit", "ai", "consult"].includes(t.key)).map((t) => ({ key: t.key, label: t.label, tags: t.tags || "" }));
  window.TKCurrentNotebookPt = () => { const id = (window.TK && window.TK.patientId) || ""; return /^pdfpt-nb-/.test(id) ? id.slice(9) : ""; };
})();
