/* Hospitalist Toolkit: makes items imported from a PDF visible to every tool tab, exactly as if Cerner had returned them.
   Loaded by each tool right after the FHIR library. It wraps client.request so that search results (Observation, MedicationRequest, Procedure,
   DiagnosticReport, DocumentReference, Condition) also include the imported resources that match the same search (category, code, date, status).
   Imported items live only in this browser tab (sessionStorage), are tagged "pdf-import", and are never sent anywhere. UNVERIFIED draft written by Claude.
   PDF-only patients: a patient ID starting "pdfpt-" was created from a PDF (Import PDF > "Open as a separate patient"). For those, nothing goes to
   Cerner at all: every request is answered here from the imported items (a search returns the matching items, other resource types come back empty). */
(function () {
  if (window.__pdfOverlay) return; window.__pdfOverlay = 1;
  const KEY = (pid) => "pdfimport:" + pid;
  const HANDLED = { Observation: 1, MedicationRequest: 1, Procedure: 1, DiagnosticReport: 1, DocumentReference: 1, Condition: 1 };
  const LOCAL = (pid) => /^pdfpt-/.test(String(pid || ""));
  function load(pid) { try { return JSON.parse(sessionStorage.getItem(KEY(pid)) || "null") || { items: [], files: [] }; } catch (e) { return { items: [], files: [] }; } }
  const when = (r) => { const d = r.effectiveDateTime || r.performedDateTime || r.authoredOn || r.date || r.issued || r.onsetDateTime || ""; const t = d ? new Date(d).getTime() : NaN; return isNaN(t) ? null : t; };
  function parse(url) {
    const u = String(url || ""), q = u.indexOf("?"), segs = (q < 0 ? u : u.slice(0, q)).split("/").filter(Boolean), last = segs[segs.length - 1];
    if (!HANDLED[last]) return null;
    return { type: last, params: new URLSearchParams(q < 0 ? "" : u.slice(q + 1)) };
  }
  const listVals = (v) => String(v || "").split(",").map((x) => x.trim()).filter(Boolean);
  function matches(r, p) {
    const P = p.params;
    const cat = P.get("category");
    if (cat) { const want = listVals(cat).map((x) => x.split("|").pop().toLowerCase()), have = (r.category || []).reduce((a, c) => a.concat((c.coding || []).map((x) => String(x.code || "").toLowerCase())), []); if (!want.some((w) => have.includes(w))) return false; }
    const code = P.get("code");
    if (code) { const want = listVals(code).map((x) => x.split("|").pop()), have = ((r.code && r.code.coding) || []).map((x) => String(x.code || "")); if (!want.some((w) => have.includes(w))) return false; }
    const st = P.get("status"); if (st && r.status && !listVals(st).includes(r.status)) return false;
    const t = when(r);
    for (const v of P.getAll("date")) {
      const m = /^(ge|gt|le|lt|eq)?(.+)$/.exec(v); if (!m) continue; const lim = new Date(m[2]).getTime(); if (isNaN(lim) || t == null) continue;
      const op = m[1] || "eq";
      if ((op === "ge" && t < lim) || (op === "gt" && t <= lim) || (op === "le" && t > lim + 864e5 - 1) || (op === "lt" && t >= lim) || (op === "eq" && Math.abs(t - lim) > 864e5)) return false;
    }
    return true;
  }
  function merge(res, url, st) {
    const p = parse(url); if (!p || !st.items.length) return res;
    const add = st.items.filter((r) => r.resourceType === p.type && matches(r, p)); if (!add.length) return res;
    if (Array.isArray(res)) { const ids = new Set(res.map((x) => x && x.id)); return res.concat(add.filter((r) => !ids.has(r.id))); }
    if (res && res.resourceType === "Bundle") { res.entry = (res.entry || []).concat(add.map((r) => ({ resource: r }))); return res; }
    return res;
  }
  /* PDF-only patient: answer a request from the stored items. Reads (Type/id) return one resource; searches return matches. */
  function localResult(arg, opts, st, pid) {
    const url = typeof arg === "string" ? arg : (arg && arg.url) || "", u = String(url), q = u.indexOf("?");
    const segs = (q < 0 ? u : u.slice(0, q)).split("/").filter(Boolean), last = segs[segs.length - 1] || "", prev = segs[segs.length - 2] || "";
    const isType = (x) => /^[A-Z][A-Za-z]+$/.test(x);
    if (isType(prev) && !isType(last) && q < 0) {           // read: Patient/pdfpt-1, Observation/pdf-abc
      const id = decodeURIComponent(last);
      if (prev === "Patient") return st.patient || { resourceType: "Patient", id: pid };
      const r = st.items.find((x) => x.resourceType === prev && x.id === id);
      if (r) return r;
      const e = new Error(prev + "/" + id + " is not in the PDF-only patient"); e.status = 404; throw e;
    }
    const type = isType(last) ? last : "", params = new URLSearchParams(q < 0 ? "" : u.slice(q + 1));
    const list = type === "Patient" ? (st.patient ? [st.patient] : []) : st.items.filter((r) => r.resourceType === type && (!HANDLED[type] || matches(r, { type, params })));
    if (opts && opts.flat) return list;
    const bundle = { resourceType: "Bundle", type: "searchset", total: list.length, entry: list.map((r) => ({ resource: r })) };
    return opts && opts.pageLimit !== undefined && opts.pageLimit !== 1 ? [bundle] : bundle;
  }
  function banner(st, local) {
    if (!st.items.length && !local) return;
    const go = () => {
      if (document.getElementById("pdf-import-banner")) return;
      if (!/\/tools\//.test(location.pathname) && !local) return;   // the toolkit header shows its own count
      const kinds = {}; st.items.forEach((r) => { kinds[r.resourceType] = (kinds[r.resourceType] || 0) + 1; });
      const d = document.createElement("div"); d.id = "pdf-import-banner";
      d.style.cssText = local ? "background:#fde8e8;border:1px solid #e3a3a3;color:#7a1b1b;padding:6px 12px;margin:6px 12px;border-radius:8px;font:13px system-ui,sans-serif"
        : "background:#fff4e5;border:1px solid #f0c27b;color:#6b4a00;padding:6px 12px;margin:6px 12px;border-radius:8px;font:13px system-ui,sans-serif";
      d.textContent = local ? "PDF-only patient" + (st.patient && st.patient.name && st.patient.name[0] ? " (" + (st.patient.name[0].text || "") + ")" : "") + ": everything here comes from " + st.items.length + " item" + (st.items.length === 1 ? "" : "s") + " imported from PDF. There is NO Cerner data for this patient, so anything not in the PDF shows as missing. Check against the source PDF."
        : "Includes " + st.items.length + " item" + (st.items.length === 1 ? "" : "s") + " imported from PDF (" + Object.keys(kinds).map((k) => kinds[k] + " " + k).join(", ") + "). These are NOT from Cerner: check them against the source PDF. They live only in this browser tab; use Imported PDFs in the toolkit header to remove them.";
      if (!/\/tools\//.test(location.pathname)) return;
      document.body.insertBefore(d, document.body.firstChild);
    };
    if (document.body) go(); else document.addEventListener("DOMContentLoaded", go);
  }
  function wrap(client) {
    if (!client || client.__pdfWrapped) return client; client.__pdfWrapped = 1;
    const pid = client.patient && client.patient.id; if (!pid) return client;
    const st = load(pid), local = LOCAL(pid); banner(st, local);
    const wrapFn = (obj) => {
      if (!obj || typeof obj.request !== "function") return;
      const o = obj.request.bind(obj);
      obj.request = local ? function (arg, opts) { return new Promise((res) => res(localResult(arg, opts, load(pid), pid))); }
        : function (arg, opts) { const url = typeof arg === "string" ? arg : (arg && arg.url) || ""; return o(arg, opts).then((res) => merge(res, url, load(pid))); };
    };
    wrapFn(client); wrapFn(client.patient);
    return client;
  }
  if (window.FHIR && FHIR.oauth2 && typeof FHIR.oauth2.ready === "function") {
    const orig = FHIR.oauth2.ready; FHIR.oauth2.ready = function () { return orig.apply(this, arguments).then(wrap); };
  }
  window.__pdfOverlayTest = { parse, matches, merge, wrap, load, localResult, LOCAL };
})();
