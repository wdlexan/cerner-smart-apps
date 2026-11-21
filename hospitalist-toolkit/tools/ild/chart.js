/* Chart reading for the ILD tab. READ-ONLY. parse() turns raw FHIR into plain facts; gather() fetches them.
   Labs by LOINC then name, CT findings by words in report titles/conclusions, drugs by name (UNVERIFIED): something not found may still be in the chart. */
(function () {
  const node = typeof module !== "undefined" && module.exports;
  const R = node ? require("./rules.js") : window.IldRules;
  const DAY = 864e5, H = 36e5;
  const label = (cc) => (cc && (cc.text || (cc.coding || []).map((c) => c.display).find(Boolean))) || "";
  const codes = (cc) => ((cc && cc.coding) || []).map((c) => String(c.code || ""));
  const tOf = (r) => { const d = r.effectiveDateTime || (r.effectivePeriod && r.effectivePeriod.start) || r.issued || r.authoredOn || r.recordedDate || r.onsetDateTime || ""; const t = d ? new Date(d).getTime() : NaN; return isNaN(t) ? null : t; };
  const cells = (v, u) => (/\/\s*(uL|mm3|µL)/i.test(u || "") && v > 50 ? v / 1000 : v);

  const LABS = [
    { id: "wbc", name: "WBC", loinc: ["6690-2", "26464-8"], re: /\bwbc\b|white blood|leukocyte/i, not: /urine|esterase|fluid/i, conv: cells },
    { id: "eos", name: "Eosinophils", loinc: ["711-2", "26449-9"], re: /eosinophil/i, not: /%|percent|urine|fluid/i, conv: cells },
    { id: "crp", name: "CRP", loinc: ["1988-5", "30522-7"], re: /c-?reactive|\bcrp\b/i },
    { id: "pct", name: "Procalcitonin", loinc: ["33959-8", "75241-0"], re: /procalcitonin/i },
    { id: "bnp", name: "BNP", loinc: ["30934-4", "42637-9"], re: /^bnp|b-?type natriuretic|brain natriuretic/i, not: /pro/i, hiAt: 100 },
    { id: "ntbnp", name: "NT-proBNP", loinc: ["33762-6", "83107-3"], re: /nt-?pro|n-?terminal/i, hiAt: 900 },
    { id: "ddimer", name: "D-dimer", loinc: ["48065-7", "48066-5", "7799-0"], re: /d-?dimer/i },
    { id: "trop", name: "Troponin", loinc: ["89579-7", "6598-7", "67151-1", "10839-9"], re: /troponin/i },
    { id: "ldh", name: "LDH", loinc: ["2532-0", "14804-9"], re: /lactate dehydrogenase|\bldh?\b/i, not: /fluid|pleural|csf/i },
    { id: "ck", name: "CK", loinc: ["2157-6"], re: /creatine kinase|\bck\b|\bcpk\b/i, not: /mb|isoenz/i },
    { id: "ferritin", name: "Ferritin", loinc: ["2276-4", "24373-3"], re: /ferritin/i },
    { id: "alt", name: "ALT", loinc: ["1742-6", "1743-4"], re: /\balt\b|alanine amino/i },
    { id: "cr", name: "Creat", loinc: ["2160-0", "38483-4"], re: /creatinine/i, not: /ratio|kinase|clearance|urine/i, conv: (v, u) => (/mg\s*\/\s*dl/i.test(u || "") ? v * 88.4 : v) },
    { id: "bdg", name: "Beta-D-glucan", loinc: ["53805-4"], re: /glucan/i }];
  // serology names (shown, not interpreted – the Autoimmune serology tab interprets)
  const SERO = /\bana\b|antinuclear|\benas?\b|extractable|scl-?70|topoisomerase|ss-?a|ss-?b|\bro\b|ro-?52|\bla\b|\brnp\b|rheumatoid factor|^rf\b|ccp|citrullin|jo-?1|pl-?7|pl-?12|\bej\b|\boj\b|mda-?5|myositis|anca|\bmpo\b|\bpr3\b|centromere|dsdna/i;
  const SPO2 = ["59408-5", "2708-6", "20564-1", "59417-6"], O2FLOW = ["3151-8", "19941-4"], FIO2 = ["3150-0", "19996-8"];

  const obsVal = (r) => { const q = r.valueQuantity; return q && q.value != null ? { v: +q.value, u: q.unit || q.code || "" } : null; };
  const pick = (r) => { const c = codes(r.code), n = label(r.code); return LABS.find((d) => c.some((x) => d.loinc.includes(x)) || (d.re.test(n) && !(d.not && d.not.test(n)))); };
  function medText(m) {
    let t = label(m.medicationCodeableConcept) || (m.medicationReference && m.medicationReference.display) || "";
    const di = m.dosageInstruction && m.dosageInstruction[0];
    return [t, di && di.text && di.text !== t ? di.text : ""].filter(Boolean).join(" ").trim();
  }

  function parse(raw, opts) {
    const now = (opts && opts.now) || Date.now();
    const f = { l: {}, latest: {}, meds: [], probText: [], ct: [], ctNew: [], spo2: [], o2: null, serology: [], serologySeen: [] };
    const p = raw.patient || {};
    f.sex = String(p.gender || "").toLowerCase();
    if (p.birthDate) f.age = Math.floor((now - new Date(p.birthDate).getTime()) / (365.25 * DAY));
    const flows = [];
    (raw.obs || []).forEach((r) => {
      if (r.status === "entered-in-error" || r.status === "cancelled") return;
      const t = tOf(r); if (t == null) return;
      const c = codes(r.code), n = label(r.code), q = obsVal(r);
      if (c.some((x) => SPO2.includes(x)) || /spo2|oxygen saturation|pulse ox/i.test(n)) { if (q) f.spo2.push({ t, v: q.v }); return; }
      if (c.some((x) => O2FLOW.includes(x)) || /oxygen flow|o2 flow|l\/min/i.test(n)) { if (q) flows.push({ t, v: q.v }); return; }
      if (c.some((x) => FIO2.includes(x)) || /fio2/i.test(n)) return;
      if (SERO.test(n) && !/anion|ratio/i.test(n)) { f.serology.push({ t, name: n, v: q ? `${q.v} ${q.u}` : (r.valueString || label(r.valueCodeableConcept) || "") }); return; }
      const d = pick(r); if (!d || !q) return;
      const v = +(+(d.conv ? d.conv(q.v, q.u) : q.v)).toFixed(2);
      (f.l[d.id] = f.l[d.id] || []).push({ t, v, u: q.u, name: d.name, hi: d.hiAt != null && v >= d.hiAt });
    });
    Object.keys(f.l).forEach((k) => { f.l[k].sort((a, b) => a.t - b.t); f.latest[k] = f.l[k][f.l[k].length - 1]; });
    if (!f.latest.bnp && f.latest.ntbnp) f.latest.bnp = f.latest.ntbnp;
    f.serologySeen = f.serology.map((x) => x.name);
    const s72 = f.spo2.filter((x) => now - x.t <= 72 * H);
    if (s72.length) f.spo2min = Math.min(...s72.map((x) => x.v));
    const fl = flows.filter((x) => now - x.t <= 72 * H).sort((a, b) => a.t - b.t);
    if (fl.length) { const from = fl[0].v, to = fl[fl.length - 1].v, max = Math.max(...fl.map((x) => x.v)); f.o2 = { from, to, max, rise: to - from >= 2 || (from === 0 && to >= 2) }; }
    f.flows = fl;

    (raw.medreqs || []).forEach((m) => { if (["active", "on-hold", "draft"].includes(m.status) || !m.status) f.meds.push({ text: medText(m), status: m.status || "", t: tOf(m) }); });
    f.tox = R.pneumotox(f.meds.filter((m) => m.status !== "on-hold").map((m) => m.text));

    (raw.conditions || []).forEach((c) => {
      if (c.clinicalStatus && /resolved|inactive|remission/.test(codes(c.clinicalStatus).join(" "))) return;
      if (c.verificationStatus && /refuted|entered-in-error/.test(codes(c.verificationStatus).join(" "))) return;
      f.probText.push((label(c.code) + " " + codes(c.code).join(" ")).trim());
    });
    f.cls = R.classify(f.probText);

    (raw.reports || []).forEach((r) => {
      const title = label(r.code), concl = r.conclusion || "";
      if (!/\bct\b|computed tomograph|hrct|chest|thorax|lung|pulmonary|x-?ray|\bxr\b|cxr/i.test(title)) return;
      const t = tOf(r), fnd = R.ctFindings(concl);
      f.ct.push({ t, title, text: concl.slice(0, 320), findings: fnd, isCT: /\bct\b|computed tomograph|hrct|ctpa/i.test(title) });
    });
    f.ct.sort((a, b) => (b.t || 0) - (a.t || 0));
    const recent = f.ct.filter((x) => x.t && now - x.t <= 14 * DAY);
    const seen = new Set(); recent.forEach((x) => x.findings.forEach((y) => { if (!seen.has(y.id)) { seen.add(y.id); f.ctNew.push(y); } }));
    f.ctRecent = recent.length > 0;
    f.ctpaRecent = f.ct.some((x) => x.t && now - x.t <= 7 * DAY && (/ctpa|pulmonary angio|\bpe\b protocol|embol/i.test(x.title) || x.findings.some((y) => y.id === "pe" || y.id === "nope")));
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
    const [patient, labs, vitals, medreqs, conditions, reports] = await Promise.all([
      (async () => { try { return await client.patient.read(); } catch (e) { errors.push("patient: " + (e.message || e)); return null; } })(),
      get(`Observation?patient=${pid}&category=laboratory&date=ge${iso(Date.now() - 365 * DAY)}&_count=200`, "lab results (1 year)", 8),
      get(`Observation?patient=${pid}&category=vital-signs&date=ge${iso(Date.now() - 3 * DAY)}&_count=200`, "vital signs (72 h)", 4),
      get(`MedicationRequest?patient=${pid}&_count=100`, "medication orders", 3),
      get(`Condition?patient=${pid}&_count=100`, "problems/diagnoses", 2),
      get(`DiagnosticReport?patient=${pid}&date=ge${iso(Date.now() - 5 * 365 * DAY)}&_count=100`, "imaging reports (5 years)", 3)]);
    const seenIds = new Set(), obs = labs.concat(vitals).filter((o) => (o.id ? (seenIds.has(o.id) ? false : seenIds.add(o.id)) : true));
    return { raw: { patient, obs, medreqs, conditions, reports }, errors };
  }

  const api = { parse, gather, LABS };
  if (node) module.exports = api; else window.IldChart = api;
})();
