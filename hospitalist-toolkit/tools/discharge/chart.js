/* Chart reading for the Discharge tab. READ-ONLY. gather(client) fetches what the discharge note needs; nothing is written to Cerner.
   Note and report text is read in the browser (plain text, HTML, XML, RTF; PDF attachments are skipped here). UNVERIFIED draft written by Claude. */
(function () {
  const DAY = 864e5;
  const iso = (t) => new Date(t).toISOString().slice(0, 10);
  const label = (cc) => (cc && (cc.text || (cc.coding || []).map((c) => c.display).find(Boolean))) || "";
  const b64ToText = (b64) => { const bin = atob(String(b64).replace(/\s+/g, "")); return new TextDecoder("utf-8").decode(Uint8Array.from(bin, (c) => c.charCodeAt(0))); };
  function htmlToText(html) {
    const doc = new DOMParser().parseFromString(html, "text/html");
    doc.querySelectorAll("script,style").forEach((n) => n.remove());
    doc.querySelectorAll("br").forEach((n) => n.replaceWith("\n"));
    doc.querySelectorAll("p,div,tr,li,h1,h2,h3,h4,h5,h6").forEach((n) => n.append("\n"));
    return (doc.body.textContent || "").replace(/\n{3,}/g, "\n\n").trim();
  }
  function toText(raw, ct) {
    ct = (ct || "").toLowerCase();
    if (/^\s*<\?xml/i.test(raw) || (ct.includes("xml") && !ct.includes("xhtml"))) { const d = new DOMParser().parseFromString(raw, "application/xml"); return d.querySelector("parsererror") ? htmlToText(raw) : (d.documentElement.textContent || "").replace(/\n{3,}/g, "\n\n").trim(); }
    if (ct.includes("html") || /<\/?(p|div|br|table|html|body)\b/i.test(raw)) return htmlToText(raw);
    if (ct.includes("rtf")) return raw.replace(/\\par[d]?/g, "\n").replace(/\\'[0-9a-f]{2}/gi, "").replace(/[{}]|\\[a-z]+-?\d* ?/gi, "").trim();
    return raw;
  }
  async function attachmentText(client, atts, errors, what) {
    const a = (atts || []).filter(Boolean).find((x) => /text|html|xml|rtf/i.test(x.contentType || "")) || null; if (!a) return "";
    try {
      if (a.data) return toText(b64ToText(a.data), a.contentType);
      if (!a.url) return "";
      const url = new URL(a.url, client.state.serverUrl + "/").href;
      try { await client.refreshIfNeeded(); } catch (e) {}
      const go = () => fetch(url, { headers: { Authorization: "Bearer " + client.state.tokenResponse.access_token, Accept: a.contentType || "*/*" } });
      let res = await go(); if (res.status === 401) { try { await client.refresh(); } catch (e) {} res = await go(); }
      if (!res.ok) throw new Error("HTTP " + res.status);
      return toText(await res.text(), a.contentType);
    } catch (e) { errors.push(what + ": text not read (" + (e.message || e) + ")"); return ""; }
  }

  async function gather(client, say) {
    const pid = client.patient.id, errors = [], tell = say || (() => {});
    async function get(url, name, pages) {
      const once = () => { let tm; return Promise.race([client.request(url, { pageLimit: pages || 1, flat: true }), new Promise((_, rej) => { tm = setTimeout(() => rej(new Error("timed out after 30 s")), 30000); })]).finally(() => clearTimeout(tm)); };
      const transient = (e) => /timed out|\b50[234]\b|Gateway|Failed to fetch|NetworkError/i.test(String((e && e.message) || e));
      try { const r = (await once().catch((e) => (transient(e) ? new Promise((ok) => setTimeout(ok, 1500)).then(once) : Promise.reject(e)))).filter((x) => x.resourceType && x.resourceType !== "OperationOutcome"); tell(`Loaded ${name} (${r.length})…`); return r; }
      catch (e) { errors.push(`${name}: ${e.message || e}`); return []; }
    }
    const s21 = iso(Date.now() - 21 * DAY), s60 = iso(Date.now() - 60 * DAY);
    const [patient, encounters, labs, vitals, medreqs, medstatements, problems, encdx, reports, orders, docs] = await Promise.all([
      (async () => { try { return await client.patient.read(); } catch (e) { errors.push("patient: " + (e.message || e)); return null; } })(),
      get(`Encounter?patient=${pid}&_count=20`, "encounters", 1),
      get(`Observation?patient=${pid}&category=laboratory&date=ge${s21}&_count=200`, "lab results (21 days)", 8),
      get(`Observation?patient=${pid}&category=vital-signs&date=ge${s21}&_count=200`, "vital signs and weights (21 days)", 6),
      get(`MedicationRequest?patient=${pid}&_count=100`, "medication orders", 4),
      get(`MedicationStatement?patient=${pid}&_count=100`, "home medications", 2),
      get(`Condition?patient=${pid}&category=problem-list-item&_count=60`, "problem list", 2),
      get(`Condition?patient=${pid}&category=encounter-diagnosis&_count=60`, "encounter diagnoses", 2),
      get(`DiagnosticReport?patient=${pid}&date=ge${s60}&_count=100`, "reports (imaging, micro, pathology; 60 days)", 3),
      get(`ServiceRequest?patient=${pid}&authored=ge${s21}&_count=100`, "orders (21 days)", 2),
      get(`DocumentReference?patient=${pid}&date=ge${s21}&_count=30`, "notes (21 days)", 1)]);
    // the current (or latest) inpatient encounter
    const inpt = encounters.filter((e) => e.period && e.period.start && /IMP|inpatient|ACUTE|observation|OBSENC/i.test(JSON.stringify(e.class || {}) + JSON.stringify(e.type || {})));
    const enc = (inpt.length ? inpt : encounters).filter((e) => e.period && e.period.start).sort((a, b) => new Date(b.period.start) - new Date(a.period.start)).slice(0, 1);
    // report text: conclusion, else the attached report
    tell("Reading report text…");
    for (const r of reports.slice(0, 40)) if (!r.conclusion && r.presentedForm && r.presentedForm.length) { const t = await attachmentText(client, r.presentedForm, errors, "report " + label(r.code)); if (t) r._text = [t]; }
    // the 12 most recent notes (newest first)
    tell("Reading notes…");
    const notes = [];
    for (const d of docs.filter((x) => x.status !== "entered-in-error").sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0)).slice(0, 12)) {
      const text = await attachmentText(client, (d.content || []).map((c) => c.attachment), errors, "note " + label(d.type));
      if (text) notes.push({ name: label(d.type) || "Note", t: d.date ? new Date(d.date).getTime() : null, text });
    }
    const seen = new Set(), obs = labs.concat(vitals).filter((o) => (o.id ? (seen.has(o.id) ? false : seen.add(o.id)) : true));
    return { raw: { patient, encounters: enc, obs, medreqs, medstatements, conditions: problems.concat(encdx), reports, orders, notes }, errors };
  }
  const api = { gather, toText };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else window.DcChart = api;
})();
