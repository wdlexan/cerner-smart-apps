/* Chart reading for the mobility tab. READ-ONLY. Reads PT / OT / nursing / discharge-planning notes (DocumentReference + Binary),
   mobility-type Observations (activity, ambulation, transfers, Morse falls score) and PT / OT orders (ServiceRequest). Patterns UNVERIFIED. */
(function () {
  const DAY = 864e5, R = window.MobRules;
  const label = (cc) => (cc && (cc.text || (cc.coding || []).map((c) => c.display).find(Boolean))) || "";
  const codes = (cc) => ((cc && cc.coding) || []).map((c) => String(c.code || ""));
  const tOf = (r) => { const d = r.effectiveDateTime || (r.effectivePeriod && r.effectivePeriod.start) || r.date || (r.context && r.context.period && r.context.period.start) || r.issued || r.authoredOn || r.occurrenceDateTime || r.recordedDate || ""; const t = d ? new Date(d).getTime() : NaN; return isNaN(t) ? null : t; };
  const NOTE_SRC = [["PT", /physio|physical therap|\bpt\b|mobility/i], ["OT", /occupational|\bot\b/i], ["Nursing", /nurs|\brn\b|shift|interdisciplinary/i], ["Discharge planning", /social work|case manag|discharge plan|transition|patient care coordinat|liaison|\bpcc\b/i], ["Physician", /progress|hospitalist|physician|consult|admission|h ?& ?p|history/i]];
  const OBS = /ambulat|mobility|activity|assist(ance)? level|transfer|gait|weight[- ]bearing|distance walked|walk|stairs|morse|fall(s)? risk|bed mobility|up in chair|out of bed/i;
  const ORTHO = /fracture|arthroplasty|hip replacement|knee replacement|\bS72|\bS82|\bS32|\bZ96\.6/i;
  const HIP = /hip|femur|femoral|\bS72|Z96\.64/i;

  const srcOf = (title) => { const h = NOTE_SRC.find(([, re]) => re.test(title)); return h ? h[0] : "Other"; };

  /* ---- note text (same approach as the risk screen and note compiler) ---- */
  function pickAttachment(doc) {
    const atts = (doc.content || []).map((c) => c.attachment).filter(Boolean);
    for (const p of ["text/plain", "text/html", "application/xhtml+xml", "application/pdf", "application/xml", "text/rtf"]) { const a = atts.find((x) => (x.contentType || "").toLowerCase().startsWith(p)); if (a) return a; }
    return atts[0];
  }
  const b64ToBytes = (b64) => Uint8Array.from(atob(b64.replace(/\s+/g, "")), (c) => c.charCodeAt(0));
  function htmlToText(html) {
    const d = new DOMParser().parseFromString(html, "text/html");
    d.querySelectorAll("script,style").forEach((n) => n.remove()); d.querySelectorAll("br").forEach((n) => n.replaceWith("\n"));
    d.querySelectorAll("p,div,tr,li,h1,h2,h3,h4,h5,h6").forEach((n) => n.append("\n"));
    return (d.body.textContent || "").replace(/\n{3,}/g, "\n\n").trim();
  }
  async function pdfToText(bytes) {
    if (typeof pdfjsLib === "undefined") return "";
    pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js";
    const pdf = await pdfjsLib.getDocument({ data: bytes }).promise, pages = [];
    for (let p = 1; p <= pdf.numPages; p++) { const c = await (await pdf.getPage(p)).getTextContent(); pages.push(c.items.map((i) => i.str + (i.hasEOL ? "\n" : " ")).join("")); }
    return pages.join("\n\n");
  }
  async function getText(client, doc) {
    const att = pickAttachment(doc); if (!att) return "";
    const ct = (att.contentType || "").toLowerCase();
    let bytes = null;
    if (att.data) bytes = b64ToBytes(att.data);
    else if (att.url && client) {
      const url = new URL(att.url, client.state.serverUrl + "/").href;
      try { await client.refreshIfNeeded(); } catch (e) {}
      const res = await fetch(url, { headers: { Authorization: "Bearer " + client.state.tokenResponse.access_token, Accept: att.contentType || "*/*" } });
      if (!res.ok) throw new Error("HTTP " + res.status);
      bytes = new Uint8Array(await res.arrayBuffer());
    }
    if (!bytes) return "";
    if (ct.startsWith("application/pdf")) return pdfToText(bytes);
    if (ct.startsWith("image/")) return "";
    const raw = new TextDecoder("utf-8").decode(bytes);
    if (ct.includes("html") || /<\/?(p|div|br|table|html|body)\b/i.test(raw)) return htmlToText(raw.replace(/^[\s\S]*?<document-data>|<\/document-data>[\s\S]*$/g, ""));
    if (ct.includes("xml")) { const d = new DOMParser().parseFromString(raw, "application/xml"); return (d.documentElement.textContent || "").trim(); }
    return raw;
  }

  /* raw = { patient, docs: [{doc, text}], obs, serviceRequests, conditions, encounters } */
  function parse(raw, opts) {
    const now = (opts && opts.now) || Date.now();
    const f = { sex: "", age: null, records: [], orders: [], morse: null, prob: {}, start: null, problems: [] };
    const p = raw.patient;
    if (p) { f.sex = String(p.gender || "").toLowerCase(); if (p.birthDate) f.age = Math.floor((now - new Date(p.birthDate).getTime()) / (365.25 * DAY)); }
    const encs = (raw.encounters || []).filter((e) => e.period && e.period.start && !/cancelled|entered-in-error|finished/.test(e.status || "")).map((e) => new Date(e.period.start).getTime()).filter((t) => !isNaN(t)).sort((a, b) => a - b);
    f.start = encs.length ? encs[0] : now - 14 * DAY;
    (raw.docs || []).forEach(({ doc, text }) => {
      const t = tOf(doc); if (!t || t < f.start - DAY || !text) return;
      const title = label(doc.type) || doc.description || (doc.content && doc.content[0] && doc.content[0].attachment && doc.content[0].attachment.title) || "Note";
      const x = R.extract(text);
      f.records.push(Object.assign({ t, src: srcOf(title), title, text, author: (doc.author && doc.author[0] && doc.author[0].display) || "" }, x));
    });
    (raw.obs || []).forEach((o) => {
      if (!o || o.resourceType !== "Observation" || /entered-in-error|cancelled/.test(o.status || "")) return;
      const name = label(o.code), t = tOf(o); if (!t || t < f.start - DAY || !OBS.test(name)) return;
      const q = o.valueQuantity, val = o.valueString || (o.valueCodeableConcept && label(o.valueCodeableConcept)) || (q ? q.value + (q.unit ? " " + q.unit : "") : "");
      if (/morse|fall(s)? risk/i.test(name)) { const n = q && typeof q.value === "number" ? q.value : parseFloat(val); if (!isNaN(n) && (!f.morse || t > f.morse.t)) f.morse = { t, v: n }; return; }
      const text = name + ": " + val + ".", x = R.extract(/walk|ambulat|gait|distance/i.test(name) ? "Ambulation " + val + "." : /transfer/i.test(name) ? "Transfers " + val + "." : text);
      if (/distance/i.test(name) && q && typeof q.value === "number") x.dist = /ft|feet/i.test(q.unit || "") ? Math.round(q.value * 0.3048) : q.value;
      if (x.level != null || x.transfer != null || x.aids.length || x.dist != null || x.wb) f.records.push(Object.assign({ t, src: "Nursing chart", title: name, text }, x));
    });
    (raw.serviceRequests || []).forEach((s) => {
      const n = label(s.code) + " " + (s.category || []).map(label).join(" ");
      if (/physio|physical therap|occupational|\bpt\b|\bot\b|rehab/i.test(n) && !/cancelled|entered-in-error|revoked/.test(s.status || "")) f.orders.push({ t: tOf(s), name: label(s.code) || n.trim(), kind: /occupational|\bot\b/i.test(n) ? "OT" : "PT", status: s.status });
    });
    (raw.conditions || []).forEach((c) => {
      if (c.clinicalStatus && /resolved|inactive/i.test(JSON.stringify(c.clinicalStatus))) return;
      const n = label(c.code) + " " + codes(c.code).join(" ");
      f.problems.push(label(c.code) || codes(c.code)[0]);
      if (ORTHO.test(n)) f.prob.ortho = true; if (ORTHO.test(n) && HIP.test(n)) f.prob.hip = true;
      if (/dementia|alzheimer|delirium|cognitive/i.test(n)) f.prob.cognition = true;
      if (/parkinson|stroke|hemipleg/i.test(n)) f.prob.neuro = true;
    });
    f.records.sort((a, b) => a.t - b.t);
    return f;
  }

  async function gather(client, say) {
    const pid = client.patient.id, errors = [], tell = say || (() => {});
    const iso = (t) => new Date(t).toISOString().slice(0, 10);
    async function get(url, name, pages) {
      const timer = new Promise((_, rej) => setTimeout(() => rej(new Error("timed out after 60 s")), 60000));
      try { const r = (await Promise.race([client.request(url, { pageLimit: pages || 1, flat: true }), timer])).filter((x) => x.resourceType && x.resourceType !== "OperationOutcome"); tell(`Loaded ${name} (${r.length})…`); return r; }
      catch (e) { errors.push(`${name}: ${e.message || e}`); return []; }
    }
    const s30 = iso(Date.now() - 30 * DAY), s14 = iso(Date.now() - 14 * DAY);
    const [patient, docRefs, obs, srs, conditions, encounters] = await Promise.all([
      (async () => { try { return await client.patient.read(); } catch (e) { errors.push("patient: " + (e.message || e)); return null; } })(),
      get(`DocumentReference?patient=${pid}&date=ge${s30}&_count=100`, "notes (30 days)", 4),
      get(`Observation?patient=${pid}&date=ge${s14}&_count=100`, "observations (14 days)", 8),
      get(`ServiceRequest?patient=${pid}&_count=100`, "orders", 2),
      get(`Condition?patient=${pid}&_count=100`, "problem list", 2),
      get(`Encounter?patient=${pid}&date=ge${s30}&_count=50`, "encounters", 1)]);
    // read only the notes likely to talk about mobility, newest first
    const wanted = docRefs.filter((d) => d.status !== "entered-in-error").filter((d) => /physio|physical therap|\bpt\b|occupational|\bot\b|nurs|mobility|rehab|discharge|social work|case manag|transition|progress|interdisciplinary/i.test(label(d.type) + " " + (d.description || "")))
      .sort((a, b) => (tOf(b) || 0) - (tOf(a) || 0)).slice(0, 40);
    const docs = [];
    for (let i = 0; i < wanted.length; i += 5) {
      tell(`Reading notes ${Math.min(i + 5, wanted.length)} of ${wanted.length}…`);
      docs.push(...(await Promise.all(wanted.slice(i, i + 5).map(async (doc) => { try { return { doc, text: await getText(client, doc) }; } catch (e) { errors.push((label(doc.type) || "note") + ": " + e.message); return { doc, text: "" }; } }))));
    }
    return { raw: { patient, docs, obs, serviceRequests: srs, conditions, encounters }, errors };
  }

  window.MobChart = { parse, gather, getText, DAY };
})();
