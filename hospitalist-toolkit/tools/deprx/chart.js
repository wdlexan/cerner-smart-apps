/* Chart reading for the Deprescribing tab. READ-ONLY. parse() turns raw FHIR into plain facts; gather() fetches them.
   Labs by LOINC then name, drugs by name: something not found may still be in the chart. */
(function () {
  const node = typeof module !== "undefined" && module.exports;
  const R = node ? require("./rules.js") : window.DeprxRules;
  const DAY = 864e5, H = 36e5;
  const label = (cc) => (cc && (cc.text || (cc.coding || []).map((c) => c.display).find(Boolean))) || "";
  const allText = (cc) => (cc ? [cc.text, ...(cc.coding || []).map((c) => c.display)].filter(Boolean).join(" | ") : "");
  const codes = (cc) => ((cc && cc.coding) || []).map((c) => String(c.code || ""));
  const tOf = (r) => { const d = r.effectiveDateTime || (r.effectivePeriod && r.effectivePeriod.start) || r.issued || r.authoredOn || r.recordedDate || r.onsetDateTime || ""; const t = d ? new Date(d).getTime() : NaN; return isNaN(t) ? null : t; };

  const LABS = [
    { id: "cr", name: "Creatinine", u: "µmol/L", loinc: ["2160-0", "38483-4", "14682-9"], re: /creatinine/i, not: /ratio|kinase|clearance|urine|random urine/i, conv: (v, u) => (/mg\s*\/\s*dl/i.test(u || "") ? Math.round(v * 88.4) : v) },
    { id: "egfr", name: "eGFR", u: "mL/min/1.73m²", loinc: ["33914-3", "48642-3", "48643-1", "62238-1", "69405-9", "98979-8", "88293-6", "88294-4", "50044-7"], re: /egfr|glomerular filtration/i },
    { id: "k", name: "Potassium", u: "mmol/L", loinc: ["2823-3", "6298-4", "32713-7"], re: /^potassium|\bk\b|potassium,? (serum|plasma|blood)/i, not: /urine/i },
    { id: "na", name: "Sodium", u: "mmol/L", loinc: ["2951-2", "2947-0", "32717-8"], re: /^sodium|\bna\b|sodium,? (serum|plasma|blood)/i, not: /urine/i },
    { id: "mg", name: "Magnesium", u: "mmol/L", loinc: ["19123-9", "2601-3", "2593-0"], re: /magnesium/i, not: /urine/i, conv: (v, u) => (/mg\s*\/\s*dl/i.test(u || "") ? +(v * 0.411).toFixed(2) : v) },
    { id: "ca", name: "Calcium", u: "mmol/L", loinc: ["17861-6", "2000-8"], re: /^calcium|calcium,? (serum|total)/i, not: /ionized|ionised|urine|corrected/i, conv: (v, u) => (/mg\s*\/\s*dl/i.test(u || "") ? +(v * 0.2495).toFixed(2) : v) },
    { id: "a1c", name: "HbA1c", u: "%", loinc: ["4548-4", "17856-6", "59261-8"], re: /a1c|glycated|glycosylated/i, conv: (v, u) => (/mmol\s*\/\s*mol/i.test(u || "") || v > 20 ? +(v / 10.929 + 2.15).toFixed(1) : v) },
    { id: "tsh", name: "TSH", u: "mU/L", loinc: ["3016-3", "11580-8"], re: /\btsh\b|thyroid stimulating/i },
    { id: "inr", name: "INR", u: "", loinc: ["6301-6", "34714-6", "46418-0"], re: /\binr\b|international normali/i },
    { id: "plt", name: "Platelets", u: "×10⁹/L", loinc: ["777-3", "26515-7"], re: /platelet/i, not: /mpv|volume|function/i },
    { id: "hb", name: "Hemoglobin", u: "g/L", loinc: ["718-7"], re: /^hemoglobin|^haemoglobin|^hgb|^hb\b/i, not: /a1c|glyc/i, conv: (v, u) => (/g\s*\/\s*dl/i.test(u || "") ? Math.round(v * 10) : v) },
    { id: "qtc", name: "QTc", u: "ms", loinc: ["8636-3", "8634-8"], re: /qtc|qt corrected|corrected qt/i },
    { id: "b12", name: "Vitamin B12", u: "pmol/L", loinc: ["2132-9"], re: /b12|cobalamin/i },
    { id: "dig", name: "Digoxin level", u: "nmol/L", loinc: ["10535-3"], re: /digoxin/i }];
  const V = { wt: ["29463-7", "3141-9", "3142-7"], ht: ["8302-2", "8306-3"], sbp: ["8480-6"], hr: ["8867-4"], bp: ["85354-9", "55284-4"] };

  const obsVal = (r) => { const q = r.valueQuantity; return q && q.value != null ? { v: +q.value, u: q.unit || q.code || "" } : null; };
  const pick = (r) => { const c = codes(r.code), n = label(r.code); return LABS.find((d) => c.some((x) => d.loinc.includes(x))) || LABS.find((d) => d.re.test(n) && !(d.not && d.not.test(n))); };

  function medInfo(m, medMap) {
    let cc = m.medicationCodeableConcept, lab = "";
    if (!cc && m.medicationReference) {
      const id = (m.medicationReference.reference || "").split("/").pop().replace("#", "");
      const x = (m.contained || []).find((c) => c.id === id) || (medMap || {})[id];
      cc = x && x.code; lab = m.medicationReference.display || "";
    }
    lab = label(cc) || lab || "Unknown medication";
    const di = (m.dosageInstruction || [])[0] || {};
    const sig = di.text && di.text !== lab ? di.text : "";
    const prn = !!(di.asNeededBoolean || di.asNeededCodeableConcept) || /\bprn\b|as needed|when needed/i.test(lab + " " + sig);
    const route = allText(di.route);
    return { label: lab, sig, prn, route, names: allText(cc), status: m.status || "", t: tOf(m) };
  }

  function parse(raw, opts) {
    const now = (opts && opts.now) || Date.now();
    const f = { l: {}, lab: {}, meds: [], probs: [], vit: {}, wt: null, ht: null };
    const p = raw.patient || {};
    f.sex = String(p.gender || "").toLowerCase();
    if (p.birthDate) f.age = Math.floor((now - new Date(p.birthDate).getTime()) / (365.25 * DAY));
    const n = (p.name && (p.name.find((x) => x.use === "official") || p.name[0])) || {};
    f.name = n.text || [(n.given || []).join(" "), n.family].filter(Boolean).join(" ");
    const wts = [], hts = [], sbp = [], hr = [];
    (raw.obs || []).forEach((r) => {
      if (r.status === "entered-in-error" || r.status === "cancelled") return;
      const t = tOf(r); if (t == null) return;
      const c = codes(r.code), nm = label(r.code), q = obsVal(r);
      if (c.some((x) => V.wt.includes(x)) || /^(body )?weight/i.test(nm)) { if (q) wts.push({ t, v: /lb/i.test(q.u) ? +(q.v * 0.4536).toFixed(1) : /^g$/i.test(q.u) ? q.v / 1000 : q.v }); return; }
      if (c.some((x) => V.ht.includes(x)) || /^(body )?height/i.test(nm)) { if (q) hts.push({ t, v: /in/i.test(q.u) ? q.v * 2.54 : /^m$/i.test(q.u) ? q.v * 100 : q.v }); return; }
      if (c.some((x) => V.bp.includes(x)) || (/blood pressure/i.test(nm) && r.component)) { (r.component || []).forEach((cp) => { const cq = obsVal(cp); if (!cq) return; if (codes(cp.code).includes("8480-6") || /systolic/i.test(label(cp.code))) sbp.push({ t, v: cq.v }); }); return; }
      if (c.some((x) => V.sbp.includes(x)) || /systolic/i.test(nm)) { if (q) sbp.push({ t, v: q.v }); return; }
      if (c.some((x) => V.hr.includes(x)) || /heart rate|pulse rate|^pulse$/i.test(nm)) { if (q) hr.push({ t, v: q.v }); return; }
      const d = pick(r); if (!d || !q) return;
      const v = +(+(d.conv ? d.conv(q.v, q.u) : q.v)).toFixed(2);
      (f.l[d.id] = f.l[d.id] || []).push({ t, v, u: q.u || d.u, name: d.name });
    });
    Object.keys(f.l).forEach((k) => { f.l[k].sort((a, b) => a.t - b.t); f.lab[k] = f.l[k][f.l[k].length - 1]; });
    wts.sort((a, b) => b.t - a.t); hts.sort((a, b) => b.t - a.t);
    if (wts[0] && now - wts[0].t <= 365 * DAY) { f.wt = +wts[0].v.toFixed(1); f.wtT = wts[0].t; }
    if (hts[0]) f.ht = Math.round(hts[0].v);
    const s72 = sbp.filter((x) => now - x.t <= 72 * H), h72 = hr.filter((x) => now - x.t <= 72 * H);
    if (s72.length) f.vit.sbpMin = Math.min(...s72.map((x) => x.v));
    if (h72.length) f.vit.hrMin = Math.min(...h72.map((x) => x.v));
    f.sbp = s72; f.hr = h72;

    const medMap = {}; (raw.medreqs || []).filter((r) => r.resourceType === "Medication").forEach((r) => (medMap[r.id] = r));
    const seen = new Set();
    (raw.medreqs || []).filter((r) => r.resourceType === "MedicationRequest" || !r.resourceType).forEach((m) => {
      if (m.status && !["active", "on-hold", "draft"].includes(m.status)) return;
      const x = medInfo(m, medMap), key = (x.label + "|" + x.sig).toLowerCase();
      if (seen.has(key)) return; seen.add(key);
      x.i = f.meds.length;
      x.hay = R.expand([x.names, x.label, x.route, x.sig].join(" "), opts && opts.alias);
      f.meds.push(x);
    });
    (raw.conditions || []).forEach((c) => {
      if (c.clinicalStatus && /resolved|inactive|remission/.test(codes(c.clinicalStatus).join(" "))) return;
      if (c.verificationStatus && /refuted|entered-in-error/.test(codes(c.verificationStatus).join(" "))) return;
      const t = allText(c.code); if (t && !f.probs.includes(t)) f.probs.push(t);
    });
    return f;
  }

  async function gather(client, say) {
    const pid = client.patient.id, errors = [], tell = say || (() => {});
    const iso = (t) => new Date(t).toISOString().slice(0, 10);
    async function get(url, name, pages) {
      const once = () => { let tm; return Promise.race([client.request(url, { pageLimit: pages || 1, flat: true }), new Promise((_, rej) => { tm = setTimeout(() => rej(new Error("timed out after 30 s")), 30000); })]).finally(() => clearTimeout(tm)); };
      const transient = (e) => /timed out|\b50[234]\b|Gateway|Failed to fetch|NetworkError/i.test(String((e && e.message) || e));
      try { const r = (await once().catch((e) => (transient(e) ? new Promise((ok) => setTimeout(ok, 1500)).then(once) : Promise.reject(e)))).filter((x) => x.resourceType && x.resourceType !== "OperationOutcome"); tell(`Loaded ${name} (${r.length})…`); return r; }
      catch (e) { errors.push(`${name}: ${e.message || e}`); return null; }
    }
    const [patient, labs, vitals, medsInc, conditions] = await Promise.all([
      (async () => { try { return await client.patient.read(); } catch (e) { errors.push("patient: " + (e.message || e)); return null; } })(),
      get(`Observation?patient=${pid}&category=laboratory&date=ge${iso(Date.now() - 365 * DAY)}&_count=200`, "lab results (1 year)", 8),
      get(`Observation?patient=${pid}&category=vital-signs&date=ge${iso(Date.now() - 30 * DAY)}&_count=200`, "vital signs (30 days)", 4),
      get(`MedicationRequest?patient=${pid}&status=active&_include=MedicationRequest:medication&_count=100`, "medication orders", 4),
      get(`Condition?patient=${pid}&_count=100`, "problems/diagnoses", 3)]);
    let medreqs = medsInc;
    if (medreqs == null) { errors.pop(); medreqs = (await get(`MedicationRequest?patient=${pid}&status=active&_count=100`, "medication orders", 4)) || []; }
    const seenIds = new Set(), obs = (labs || []).concat(vitals || []).filter((o) => (o.id ? (seenIds.has(o.id) ? false : seenIds.add(o.id)) : true));
    return { raw: { patient, obs, medreqs, conditions: conditions || [] }, errors };
  }

  const api = { parse, gather, LABS };
  if (node) module.exports = api; else window.DeprxChart = api;
})();
