/* Hospitalist Toolkit: makes items imported from a PDF visible to every tool tab, exactly as if Cerner had returned them.
   Loaded by each tool right after the FHIR library. It wraps client.request so that search results (Observation, MedicationRequest, Procedure,
   DiagnosticReport, DocumentReference, Condition) also include the imported resources that match the same search (category, code, date, status).
   Imported items live only in this browser tab (sessionStorage), are tagged "pdf-import", and are never sent anywhere. UNVERIFIED draft written by Claude. */
(function () {
  if (window.__pdfOverlay) return; window.__pdfOverlay = 1;
  const KEY = (pid) => "pdfimport:" + pid;
  const HANDLED = { Observation: 1, MedicationRequest: 1, Procedure: 1, DiagnosticReport: 1, DocumentReference: 1, Condition: 1 };
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
  function banner(st) {
    if (!st.items.length) return;
    const go = () => {
      if (document.getElementById("pdf-import-banner")) return;
      const kinds = {}; st.items.forEach((r) => { kinds[r.resourceType] = (kinds[r.resourceType] || 0) + 1; });
      const d = document.createElement("div"); d.id = "pdf-import-banner";
      d.style.cssText = "background:#fff4e5;border:1px solid #f0c27b;color:#6b4a00;padding:6px 12px;margin:6px 12px;border-radius:8px;font:13px system-ui,sans-serif";
      d.textContent = "Includes " + st.items.length + " item" + (st.items.length === 1 ? "" : "s") + " imported from PDF (" + Object.keys(kinds).map((k) => kinds[k] + " " + k).join(", ") + "). These are NOT from Cerner: check them against the source PDF. They live only in this browser tab; use Imported PDFs in the toolkit header to remove them.";
      document.body.insertBefore(d, document.body.firstChild);
    };
    if (document.body) go(); else document.addEventListener("DOMContentLoaded", go);
  }
  function wrap(client) {
    if (!client || client.__pdfWrapped) return client; client.__pdfWrapped = 1;
    const pid = client.patient && client.patient.id; if (!pid) return client;
    const st = load(pid); banner(st);
    const wrapFn = (obj) => { if (!obj || typeof obj.request !== "function") return; const o = obj.request.bind(obj); obj.request = function (arg, opts) { const url = typeof arg === "string" ? arg : (arg && arg.url) || ""; return o(arg, opts).then((res) => merge(res, url, load(pid))); }; };
    wrapFn(client); wrapFn(client.patient);
    return client;
  }
  if (window.FHIR && FHIR.oauth2 && typeof FHIR.oauth2.ready === "function") {
    const orig = FHIR.oauth2.ready; FHIR.oauth2.ready = function () { return orig.apply(this, arguments).then(wrap); };
  }
  window.__pdfOverlayTest = { parse, matches, merge, wrap, load };
})();
