/* Chart reading for the Oncology tab. READ-ONLY. parse() turns raw FHIR resources into plain facts; gather() fetches them.
   Labs are matched by LOINC and then by NAME, drugs by NAME (UNVERIFIED): something not found here may still be in the chart. */
(function () {
  const node = typeof module !== "undefined" && module.exports;
  const DR = node ? require("./drugs.js") : window.OncDrugs;
  const R = node ? require("./rules.js") : window.OncRules;
  const DAY = 864e5, H = 36e5;
  const label = (cc) => (cc && (cc.text || (cc.coding || []).map((c) => c.display).find(Boolean))) || "";
  const codes = (cc) => ((cc && cc.coding) || []).map((c) => String(c.code || ""));
  const tOf = (r) => { const d = r.effectiveDateTime || (r.effectivePeriod && r.effectivePeriod.start) || r.issued || r.authoredOn || r.recordedDate || r.onsetDateTime || ""; const t = d ? new Date(d).getTime() : NaN; return isNaN(t) ? null : t; };
  const mgdl = (f) => (v, u) => (/mg\s*\/\s*dl/i.test(u || "") ? v * f : v);
  const gdl = (v, u) => (/g\s*\/\s*dl/i.test(u || "") ? v * 10 : v);
  const cells = (v, u) => (/\/\s*(uL|mm3|µL)/i.test(u || "") && v > 100 ? v / 1000 : v); // cells/µL → ×10⁹/L

  const LABS = [
    { id: "na", name: "Na", loinc: ["2951-2", "2947-0"], re: /sodium/i, not: /urine/i },
    { id: "k", name: "K", loinc: ["2823-3", "6298-4", "32713-0"], re: /potassium|^k\b/i, not: /urine/i },
    { id: "mg", name: "Mg", loinc: ["19123-9", "2601-3"], re: /magnesium/i, not: /urine/i, conv: mgdl(0.4114) },
    { id: "po4", name: "PO4", loinc: ["2777-1", "14879-1"], re: /phosph/i, not: /urine|alkaline/i, conv: mgdl(0.3229) },
    { id: "ca", name: "Ca", loinc: ["17861-6", "2000-8"], re: /^calcium|calcium,? (total|serum)/i, not: /ionized|urine|corrected/i, conv: mgdl(0.2495) },
    { id: "alb", name: "Albumin", loinc: ["1751-7", "61151-7"], re: /^albumin/i, not: /urine|ascit|fluid|ratio/i, conv: gdl },
    { id: "cr", name: "Creat", loinc: ["2160-0", "38483-4", "14682-9"], re: /creatinine/i, not: /ratio|kinase|clearance|urine/i, conv: mgdl(88.4) },
    { id: "urate", name: "Urate", loinc: ["3084-1", "14933-6"], re: /uric acid|urate/i, not: /urine/i, conv: mgdl(59.48) },
    { id: "ldh", name: "LDH", loinc: ["2532-0", "14804-9"], re: /lactate dehydrogenase|\bldh?\b/i, not: /fluid|ascit|pleural|csf/i },
    { id: "glu", name: "Glucose", loinc: ["2345-7", "2339-0", "41653-7", "14749-6"], re: /glucose/i, not: /urine|csf|fluid|tolerance/i, conv: mgdl(0.0555) },
    { id: "alt", name: "ALT", loinc: ["1742-6", "1743-4"], re: /\balt\b|alanine amino/i },
    { id: "bili", name: "Bili", loinc: ["1975-2", "14631-6"], re: /bilirubin,? total|^total bilirubin|^bilirubin$/i, conv: mgdl(17.1) },
    { id: "wbc", name: "WBC", loinc: ["6690-2", "26464-8"], re: /\bwbc\b|white blood|leukocyte/i, not: /urine|esterase|fluid/i, conv: cells },
    { id: "anc", name: "ANC", loinc: ["751-8", "26499-4"], re: /neutrophil|\banc\b|segs|granulocyte/i, not: /%|percent|band|fluid|urine|ratio/i, conv: cells },
    { id: "hb", name: "Hb", loinc: ["718-7", "20509-6"], re: /hemoglobin|haemoglobin|^hgb\b/i, not: /a1c|glyc|urine/i, conv: gdl },
    { id: "plt", name: "Plt", loinc: ["777-3", "26515-7"], re: /platelet|^plt\b/i, not: /volume|mpv|function/i, conv: cells },
    { id: "lactate", name: "Lactate", loinc: ["2524-7", "32693-4", "2519-7"], re: /lactate|lactic/i, not: /dehydrogenase/i },
    { id: "hco3", name: "HCO3", loinc: ["2028-9", "1963-8", "1959-6"], re: /bicarbonate|\bhco3\b|total co2|carbon dioxide/i, not: /arterial|venous|pco2/i },
    { id: "fib", name: "Fibrinogen", loinc: ["3255-7", "48664-7"], re: /fibrinogen/i, not: /antigen|degradation/i, conv: (v, u) => (/mg\s*\/\s*dl/i.test(u || "") ? v / 100 : v) },
    { id: "inr", name: "INR", loinc: ["6301-6", "34714-6", "46418-1"], re: /\binr\b|international normali/i },
    { id: "lipase", name: "Lipase", loinc: ["3040-3", "1798-8"], re: /lipase/i, not: /fluid/i },
    { id: "ferritin", name: "Ferritin", loinc: ["2276-4", "24373-3"], re: /ferritin/i },
    { id: "blasts", name: "Blasts %", loinc: ["709-6", "26446-5"], re: /blast/i, not: /#|abs|count/i },
    { id: "tsh", name: "TSH", loinc: ["3016-3", "11580-8"], re: /\btsh\b|thyrotropin|thyroid stimulating/i },
    { id: "cortisol", name: "Cortisol", loinc: ["2143-6"], re: /cortisol/i, not: /urine|free/i },
    { id: "trop", name: "Troponin", loinc: ["89579-7", "6598-7", "67151-1", "10839-9"], re: /troponin/i },
    { id: "tp", name: "Total protein", loinc: ["2885-2"], re: /^(total )?protein(,? total)?$|^protein,? (serum|plasma)/i, not: /urine|fluid|csf|ascit|pleural|electro/i, conv: gdl },
    { id: "igg", name: "IgG", loinc: ["2465-3"], re: /\bigg\b|immunoglobulin g\b/i, not: /csf|subclass|igg[1-4]|antibod|urine|index/i, conv: (v, u) => (/mg\s*\/\s*dl/i.test(u || "") ? v / 100 : v) },
    { id: "kappa", name: "Free κ light chain", marker: true, loinc: ["36916-5"], re: /kappa/i, not: /urine|ratio|lambda/i, conv: (v, u) => (/mg\s*\/\s*dl/i.test(u || "") ? v * 10 : v) },
    { id: "lambda", name: "Free λ light chain", marker: true, loinc: ["33944-0"], re: /lambda/i, not: /urine|ratio|kappa/i, conv: (v, u) => (/mg\s*\/\s*dl/i.test(u || "") ? v * 10 : v) },
    { id: "mspike", name: "M-protein", marker: true, loinc: ["33358-3", "51435-6"], re: /m.?spike|monoclonal protein|paraprotein|m-?protein/i, not: /urine/i, conv: gdl },
    { id: "psa", name: "PSA", marker: true, loinc: ["2857-1", "35741-8"], re: /\bpsa\b|prostate specific/i, not: /free|ratio|%/i },
    { id: "cea", name: "CEA", marker: true, loinc: ["2039-6"], re: /\bcea\b|carcinoembryonic/i },
    { id: "ca153", name: "CA 15-3", marker: true, loinc: ["6875-9"], re: /ca[\s-]?15[\s-]?3|cancer antigen 15/i },
    { id: "ca199", name: "CA 19-9", marker: true, loinc: ["24108-3"], re: /ca[\s-]?19[\s-]?9|cancer antigen 19/i },
    { id: "testo", name: "Testosterone", loinc: ["2986-8"], re: /testosterone/i, not: /free|bioavail/i, conv: (v, u) => (/ng\s*\/\s*dl/i.test(u || "") ? v * 0.0347 : v) }];
  const MARKER_LOINC = ["2857-1", "35741-8", "2039-6", "6875-9", "24108-3", "2986-8", "36916-5", "33944-0", "33358-3", "51435-6"];

  const isTemp = (r) => codes(r.code).some((c) => ["8310-5", "8331-1", "8332-9", "8333-7", "8334-5", "8328-7"].includes(c)) || /temp/i.test(label(r.code));
  const toC = (v, u) => (/f/i.test(u || "") || v > 50 ? +(((v - 32) * 5) / 9).toFixed(1) : +(+v).toFixed(1));

  function obsVal(r) { const q = r.valueQuantity; return q && q.value != null ? { v: +q.value, u: q.unit || q.code || "" } : null; }
  function medText(m) {
    let t = label(m.medicationCodeableConcept) || (m.medicationReference && m.medicationReference.display) || "";
    if (!t && m.medicationReference && m.contained) { const c = m.contained.find((x) => m.medicationReference.reference === "#" + x.id); if (c) t = label(c.code); }
    const di = m.dosageInstruction && m.dosageInstruction[0];
    return [t, di && di.text && di.text !== t ? di.text : ""].filter(Boolean).join(" ").trim();
  }
  const pick = (r) => { const c = codes(r.code), n = label(r.code); return LABS.find((d) => c.some((x) => d.loinc.includes(x)) || (d.re.test(n) && !(d.not && d.not.test(n)))); };

  function parse(raw, opts) {
    const now = (opts && opts.now) || Date.now();
    const f = { l: {}, latest: {}, meds: [], probText: [], reports: [], temps: [], tmax48: null };
    const p = raw.patient || {};
    f.sex = String(p.gender || "").toLowerCase();
    if (p.birthDate) f.age = Math.floor((now - new Date(p.birthDate).getTime()) / (365.25 * DAY));
    (raw.obs || []).forEach((r) => {
      if (r.status === "entered-in-error" || r.status === "cancelled") return;
      const t = tOf(r), q = obsVal(r); if (t == null || !q) return;
      if (isTemp(r)) { f.temps.push({ t, v: toC(q.v, q.u) }); return; }
      const d = pick(r); if (!d) return;
      (f.l[d.id] = f.l[d.id] || []).push({ t, v: +(+(d.conv ? d.conv(q.v, q.u) : q.v)).toFixed(2), u: q.u, name: label(r.code) });
    });
    Object.keys(f.l).forEach((k) => { f.l[k].sort((a, b) => a.t - b.t); f.latest[k] = f.l[k][f.l[k].length - 1]; });
    const t48 = f.temps.filter((x) => now - x.t <= 48 * H);
    if (t48.length) f.tmax48 = Math.max(...t48.map((x) => x.v));
    const ca = f.latest.ca, alb = f.latest.alb;
    if (ca && alb && Math.abs(ca.t - alb.t) < 3 * DAY) f.corrCa = R.corrCa(ca.v, alb.v);
    const cr = f.l.cr || [];
    if (cr.length >= 2) { const last = cr[cr.length - 1], low = cr.slice(0, -1).reduce((a, b) => (b.v < a.v ? b : a)); if (last.v >= low.v * 1.3 && last.v - low.v >= 26) f.crRise = { from: low.v, to: last.v }; }

    (raw.medreqs || []).forEach((m) => { if (["active", "on-hold", "draft"].includes(m.status) || !m.status) f.meds.push({ text: medText(m), status: m.status || "", t: tOf(m) }); });
    const active = f.meds.filter((m) => m.status !== "on-hold");
    f.drugs = DR.match(active.map((m) => m.text));
    const first = (re) => { const x = active.filter((m) => re.test(m.text) && m.t).sort((a, b) => a.t - b.t)[0]; return x ? Math.floor((now - x.t) / DAY) : null; };
    f.dexDays = first(DR.SUPPORT.dex);
    f.steroidDays = first(DR.SUPPORT.steroid);

    const siteTexts = [];
    (raw.conditions || []).forEach((c) => {
      if (c.clinicalStatus && /resolved|inactive|remission/.test(codes(c.clinicalStatus).join(" "))) return;
      if (c.verificationStatus && /refuted|entered-in-error/.test(codes(c.verificationStatus).join(" "))) return;
      const n = label(c.code) + " " + codes(c.code).join(" ");
      f.probText.push(n.trim()); siteTexts.push(n);
    });
    (raw.reports || []).forEach((r) => {
      const txt = [label(r.code), r.conclusion || ""].join(" — ");
      if (/metasta|malignan|cord|epidural|thecal|lytic|sclerotic|blastic|effusion|svc|vena cava|tamponade|pneumonitis|obstruction|hydroneph|mass|lesion/i.test(txt)) f.reports.push({ t: tOf(r), text: txt.slice(0, 300) });
      if (r.conclusion) siteTexts.push(r.conclusion);
    });
    f.reports.sort((a, b) => (b.t || 0) - (a.t || 0));
    f.sites = R.findSites(siteTexts);
    f.cancers = R.detectCancers(f.probText, f.drugs);
    return f;
  }

  async function gather(client, say) {
    const pid = client.patient.id, errors = [], tell = say || (() => {});
    const iso = (t) => new Date(t).toISOString().slice(0, 10);
    async function get(url, name, pages) {
      const once = () => { let tm; return Promise.race([client.request(url, { pageLimit: pages || 1, flat: true }), new Promise((_, rej) => { tm = setTimeout(() => rej(new Error("timed out after 30 s")), 30000); })]).finally(() => clearTimeout(tm)); };
      const transient = (e) => /timed out|\b50[234]\b|Gateway|Failed to fetch|NetworkError/i.test(String((e && e.message) || e));
      try { const r = (await once().catch((e) => (transient(e) ? new Promise((ok) => setTimeout(ok, 1500)).then(once) : Promise.reject(e)))).filter((x) => x.resourceType && x.resourceType !== "OperationOutcome"); tell(`Loaded ${name} (${r.length})…`); return r; }
      catch (e) { errors.push(`${name}: ${e.message || e}`); return []; }
    }
    const s14 = iso(Date.now() - 14 * DAY), s2 = iso(Date.now() - 2 * DAY), s365 = iso(Date.now() - 365 * DAY), s90 = iso(Date.now() - 90 * DAY);
    const [patient, labs, vitals, markers, medreqs, conditions, reports] = await Promise.all([
      (async () => { try { return await client.patient.read(); } catch (e) { errors.push("patient: " + (e.message || e)); return null; } })(),
      get(`Observation?patient=${pid}&category=laboratory&date=ge${s14}&_count=200`, "lab results (14 days)", 8),
      get(`Observation?patient=${pid}&category=vital-signs&date=ge${s2}&_count=200`, "vital signs (48 h)", 3),
      get(`Observation?patient=${pid}&code=${MARKER_LOINC.map((c) => "http://loinc.org|" + c).join(",")}&date=ge${s365}&_count=100`, "PSA / CEA / markers (1 year)", 2),
      get(`MedicationRequest?patient=${pid}&_count=100`, "medication orders", 3),
      get(`Condition?patient=${pid}&_count=100`, "problems/diagnoses", 2),
      get(`DiagnosticReport?patient=${pid}&date=ge${s90}&_count=100`, "reports (90 days)", 2)]);
    const seen = new Set(), obs = labs.concat(vitals, markers).filter((o) => (o.id ? (seen.has(o.id) ? false : seen.add(o.id)) : true));
    return { raw: { patient, obs, medreqs, conditions, reports }, errors };
  }

  const api = { parse, gather, LABS };
  if (node) module.exports = api; else window.OncChart = api;
})();
