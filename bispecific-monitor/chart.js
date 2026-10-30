/* Chart reading for the Bispecific CRS/ICANS monitor. READ-ONLY. parseChart() turns raw FHIR resources into a plain "facts" object;
   gather() fetches them with a SMART client. Nothing is sent anywhere.
   Medication matching is by NAME. A drug that is not found here may still have been given (for example if it is recorded outside this chart),
   so the page lets you add doses by hand. LOINC code lists are UNVERIFIED: if a code is missing the display name is matched instead. */
(function () {
  const lc = (s) => String(s == null ? "" : s).toLowerCase();
  const label = (cc) => (cc && (cc.text || (cc.coding || []).map((c) => c.display).find(Boolean))) || "";
  const codes = (cc) => ((cc && cc.coding) || []).map((c) => String(c.code || ""));
  const tOf = (r) => { const d = r.effectiveDateTime || (r.effectivePeriod && r.effectivePeriod.start) || r.issued || r.occurrenceDateTime || r.authoredOn || ""; const t = d ? new Date(d).getTime() : NaN; return isNaN(t) ? null : t; };
  const NOT_BLOOD = /urine|\bur\b|csf|stool|fluid|clearance|ratio/i;
  const MIN = 6e4;

  const VITALS = {
    temp: { loinc: ["8310-5", "8331-1"], re: /body temperature|^temp/i, range: [30, 43], conv: (v, u) => (/f/i.test(u || "") || v > 50 ? Math.round(((v - 32) * 5) / 9 * 10) / 10 : v) },
    sbp: { loinc: ["8480-6"], re: /systolic/i, range: [40, 280] },
    hr: { loinc: ["8867-4"], re: /heart rate|pulse/i, range: [20, 240] },
    rr: { loinc: ["9279-1"], re: /respiratory rate|resp rate/i, range: [4, 70] },
    spo2: { loinc: ["59408-5", "2708-6"], re: /oxygen saturation|spo2/i, range: [50, 100] }
  };
  /* protocol lab panel: key -> [LOINC codes], name pattern */
  const LABS = {
    wbc: [["6690-2", "26464-8"], /white blood cell|leukocyte|\bwbc\b/i], anc: [["751-8", "26499-4", "770-8"], /neutrophil/i], hgb: [["718-7", "20509-6", "59260-0"], /hemoglobin|haemoglobin/i],
    plt: [["777-3", "26515-7"], /platelet/i], na: [["2951-2", "2947-0"], /sodium/i], k: [["2823-3", "6298-4"], /potassium/i], cl: [["2075-0", "2069-3"], /chloride/i],
    hco3: [["1963-8", "2028-9", "1959-6"], /bicarbonate|carbon dioxide|\bco2\b/i], ca: [["17861-6", "2000-8"], /calcium/i], mg: [["19123-9", "2601-3"], /magnesium/i],
    phos: [["2777-1", "14879-1"], /phosph/i], urate: [["3084-1"], /uric acid|urate/i], alb: [["1751-7"], /albumin/i], creat: [["2160-0", "38483-4", "14682-9"], /creatinine/i],
    alt: [["1742-6", "1743-4"], /alanine|\balt\b|\bsgpt\b/i], alp: [["6768-6"], /alkaline phosphatase|\balp\b/i], ldh: [["2532-0"], /lactate dehydrogenase|\bldh\b/i],
    bili: [["1975-2", "42719-5"], /bilirubin.*total|total bilirubin/i], lactate: [["2524-7", "32693-4"], /lactate|lactic/i], crp: [["1988-5", "30522-7", "76486-0"], /c.reactive|\bcrp\b/i],
    ferritin: [["2276-4"], /ferritin/i], inr: [["6301-6", "34714-6"], /\binr\b|international normalized/i], ptt: [["3173-2", "14979-9"], /partial thromboplastin|\bptt\b|\baptt\b/i],
    fib: [["3255-7", "48665-7"], /fibrinogen/i]
  };
  const DRUGS = [
    ["tec", /teclistamab|tecvayli/i], ["toci", /tocilizumab|actemra/i], ["dex", /dexamethasone/i]
  ];

  function medText(m) {
    let t = label(m.medicationCodeableConcept) || (m.medicationReference && m.medicationReference.display) || "";
    if (!t && m.medicationReference && m.contained) { const c = m.contained.find((x) => m.medicationReference.reference === "#" + x.id); if (c) t = label(c.code); }
    return t;
  }
  function doseText(m) {
    const d = m.dosage && m.dosage.dose, q = d && d.value != null ? d.value + (d.unit ? " " + d.unit : "") : "";
    const di = m.dosageInstruction && m.dosageInstruction[0], t = di && (di.text || "");
    return q || t || "";
  }
  const median = (a) => { const s = a.slice().sort((x, y) => x - y), m = Math.floor(s.length / 2); return s.length ? (s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2) : null; };

  function parseChart(raw, opts) {
    opts = opts || {};
    const now = opts.now || Date.now();
    const f = { age: null, sex: "", weightKg: null, weightT: null, readings: [], labs: {}, doses: [], ordered: [], notes: [], baseSbpGuess: null, baseSbpN: 0 };
    const p = raw.patient;
    if (p) { f.sex = lc(p.gender); if (p.birthDate) { const b = new Date(p.birthDate); if (!isNaN(b)) f.age = Math.floor((now - b.getTime()) / (365.25 * 864e5)); } }
    const obs = (raw.obs || []).filter((o) => o && o.resourceType === "Observation");

    // weight
    const wts = obs.filter((o) => (codes(o.code).includes("29463-7") || codes(o.code).includes("3141-9") || /body weight/i.test(label(o.code))) && o.valueQuantity && typeof o.valueQuantity.value === "number")
      .map((o) => { let v = o.valueQuantity.value; const u = o.valueQuantity.unit || ""; if (/lb/i.test(u)) v = v * 0.45359237; else if (/^g$/i.test(u)) v = v / 1000; return { v: Math.round(v * 10) / 10, t: tOf(o) || 0 }; })
      .filter((x) => x.v >= 20 && x.v <= 400).sort((a, b) => b.t - a.t);
    if (wts.length) { f.weightKg = wts[0].v; f.weightT = wts[0].t; }

    // ICE / ICANS records charted by nursing (matched by NAME: Cerner has no standard code for these, so a PowerForm that is free text will not appear)
    const numOf = (o) => { const q = o.valueQuantity && o.valueQuantity.value; if (typeof q === "number") return q; if (typeof o.valueInteger === "number") return o.valueInteger; const m = String(o.valueString || "").match(/(\d+(?:\.\d+)?)/); return m ? Number(m[1]) : null; };
    const ITEMS = [["orient", /orient/i], ["naming", /naming|name/i], ["command", /command/i], ["writing", /writ/i], ["attention", /attention|count/i]];
    f.ice = []; f.icansGrades = [];
    obs.forEach((o) => {
      const lab = label(o.code), t = tOf(o); if (t == null) return;
      if (!/\bICE\b|immune effector|icans|encephalopathy/i.test(lab)) return;
      const by = ((o.performer || [])[0] || {}).display || "";
      if (/grade/i.test(lab)) { const g = numOf(o); if (g != null && g >= 0 && g <= 4) f.icansGrades.push({ t, grade: g, by }); return; }
      let total = numOf(o); const items = {};
      (o.component || []).forEach((cm) => { const cl = label(cm.code), v = cm.valueQuantity ? cm.valueQuantity.value : typeof cm.valueInteger === "number" ? cm.valueInteger : null; const it = ITEMS.find(([, re]) => re.test(cl)); if (it && typeof v === "number") items[it[0]] = v; });
      if (total == null && Object.keys(items).length === 5) total = Object.values(items).reduce((a, b) => a + b, 0);
      if (total == null || total < 0 || total > 10) return;
      f.ice.push({ t, total, items: Object.keys(items).length ? items : null, by, src: "chart", name: lab });
    });
    f.ice.sort((a, b) => b.t - a.t);
    f.gcs = obs.filter((o) => (codes(o.code).includes("9269-2") || /glasgow coma/i.test(label(o.code))) && numOf(o) != null && numOf(o) >= 3 && numOf(o) <= 15).map((o) => ({ t: tOf(o) || 0, v: numOf(o) })).sort((a, b) => b.t - a.t);

    // vitals -> readings (rows by minute)
    const rows = new Map(), ignored = [];
    obs.forEach((o) => {
      const t = tOf(o); if (t == null) return;
      Object.keys(VITALS).forEach((key) => {
        const d = VITALS[key], lab = label(o.code);
        const comp = (o.component || []).find((c) => d.loinc.some((l) => codes(c.code).includes(l)) || (key === "sbp" && /systolic/i.test(label(c.code))));
        const direct = d.loinc.some((l) => codes(o.code).includes(l)) || (!(o.component || []).length && d.re.test(lab) && !NOT_BLOOD.test(lab));
        const q = comp ? comp.valueQuantity : direct ? o.valueQuantity : null;
        if (!q || typeof q.value !== "number") return;
        if (key === "sbp" && direct && !comp && !codes(o.code).includes("8480-6") && !/systolic/i.test(lab)) return;
        const v = d.conv ? d.conv(q.value, q.unit) : q.value;
        if (v < d.range[0] || v > d.range[1]) { ignored.push(`${key} ${q.value}`); return; }
        const k = Math.floor(t / MIN), row = rows.get(k) || { t, src: "chart" }; row[key] = v; rows.set(k, row);
      });
    });
    if (ignored.length) f.notes.push("Ignored implausible vital values: " + ignored.slice(0, 6).join(", ") + ".");
    f.readings = Array.from(rows.values()).sort((a, b) => b.t - a.t);

    // labs: latest per key, with the lab's own reference range / interpretation for the abnormal flag
    Object.keys(LABS).forEach((key) => {
      const [lo, re] = LABS[key], hits = [];
      obs.forEach((o) => {
        if (!o.valueQuantity || typeof o.valueQuantity.value !== "number") return;
        const lab = label(o.code);
        if (!(lo.some((l) => codes(o.code).includes(l)) || (re.test(lab) && !NOT_BLOOD.test(lab)))) return;
        if (key === "wbc" && /neutrophil|lymph/i.test(lab)) return;
        const t = tOf(o); if (t == null) return;
        const rr = (o.referenceRange || [])[0] || {}, low = rr.low && rr.low.value, high = rr.high && rr.high.value;
        const interp = (o.interpretation || []).map((i) => (i.coding || []).map((c) => String(c.code || "").toUpperCase()).join(" ")).join(" ");
        let abn = null;
        if (/\b(H|HH|L|LL|A|AA|HU|LU)\b/.test(interp)) abn = true; else if (/\bN\b/.test(interp)) abn = false;
        else if (typeof low === "number" || typeof high === "number") abn = (typeof low === "number" && o.valueQuantity.value < low) || (typeof high === "number" && o.valueQuantity.value > high);
        hits.push({ v: o.valueQuantity.value, unit: o.valueQuantity.unit || "", t, low: typeof low === "number" ? low : null, high: typeof high === "number" ? high : null, abn });
      });
      hits.sort((a, b) => b.t - a.t); if (hits.length) f.labs[key] = hits[0];
    });

    // doses: administrations are "given"; requests are only "ordered"
    const classify = (name) => { const d = DRUGS.find(([, re]) => re.test(name)); return d ? d[0] : null; };
    (raw.admins || []).forEach((m) => {
      if (m.status && /not-done|entered-in-error|stopped/i.test(m.status)) return;
      const name = medText(m), drug = classify(name), t = tOf(m); if (!drug || t == null) return;
      f.doses.push({ drug, name, t, src: "chart", detail: doseText(m) });
    });
    (raw.meds || []).forEach((m) => {
      const name = medText(m), drug = classify(name), t = tOf(m); if (!drug) return;
      f.ordered.push({ drug, name, t, status: m.status || "", detail: doseText(m) });
    });
    f.doses.sort((a, b) => a.t - b.t);
    const tec = f.doses.filter((d) => d.drug === "tec");
    if (!tec.length && f.ordered.some((o) => o.drug === "tec")) f.notes.push("A teclistamab order was found but no administration record. Add the actual dose times below.");
    if (!tec.length && !f.ordered.some((o) => o.drug === "tec")) f.notes.push("No teclistamab was found by name in the medication data. Add the dose times by hand if it was given.");
    f.doses.forEach((d) => { d.label = d.name; });

    // baseline systolic: median of readings before the first teclistamab dose, else the first five readings on record
    const sb = f.readings.filter((r) => r.sbp != null);
    if (sb.length) {
      const before = tec.length ? sb.filter((r) => r.t < tec[0].t) : [];
      const use = before.length ? before : sb.slice().sort((a, b) => a.t - b.t).slice(0, 5);
      f.baseSbpGuess = Math.round(median(use.map((r) => r.sbp))); f.baseSbpN = use.length; f.baseFromBefore = before.length > 0;
    }
    return f;
  }

  const iso = (d) => new Date(d).toISOString().slice(0, 10);
  async function gather(client, setStatus) {
    const pid = client.patient.id, errors = [], say = setStatus || (() => {});
    async function get(url, name, pages) {
      const t = new Promise((_, rej) => setTimeout(() => rej(new Error("timed out after 60 s")), 60000));
      try { const r = (await Promise.race([client.request(url, { pageLimit: pages || 1, flat: true }), t])).filter((x) => x.resourceType && x.resourceType !== "OperationOutcome"); say(`Loaded ${name} (${r.length})…`); return r; }
      catch (e) { errors.push(`${name}: ${e.message || e}`); return []; }
    }
    const since = iso(Date.now() - 21 * 864e5), L = (arr) => arr.map((c) => "http://loinc.org|" + c).join(",");
    const labKeys = Object.keys(LABS), chunks = [];
    for (let i = 0; i < labKeys.length; i += 6) chunks.push(labKeys.slice(i, i + 6));
    const labReq = chunks.map((ks) => get(`Observation?patient=${pid}&code=${L(ks.reduce((a, k) => a.concat(LABS[k][0]), []))}&date=ge${since}&_count=50`, "labs " + ks.join("/"), 2));
    const [patient, vitals, weight, admins, meds, survey, exam, gcs, ...labsets] = await Promise.all([
      (async () => { try { return await client.patient.read(); } catch (e) { errors.push("patient: " + (e.message || e)); return null; } })(),
      get(`Observation?patient=${pid}&category=vital-signs&date=ge${since}&_count=100`, "vital signs (last 21 days)", 3),
      get(`Observation?patient=${pid}&code=${L(["29463-7", "3141-9"])}&_count=5`, "weight"),
      get(`MedicationAdministration?patient=${pid}&_count=100`, "medication administrations", 3),
      get(`MedicationRequest?patient=${pid}&_count=100`, "medication orders", 3),
      get(`Observation?patient=${pid}&category=survey&date=ge${since}&_count=100`, "nursing assessments (survey)", 3),
      get(`Observation?patient=${pid}&category=exam&date=ge${since}&_count=100`, "nursing assessments (exam)", 3),
      get(`Observation?patient=${pid}&code=${L(["9269-2"])}&date=ge${since}&_count=50`, "Glasgow coma score"),
      ...labReq
    ]);
    const seen = new Set(), all = vitals.concat(weight, survey, exam, gcs, ...labsets).filter((o) => { const i = o.id || Math.random(); if (seen.has(i)) return false; seen.add(i); return true; });
    return { raw: { patient, obs: all, admins, meds }, errors };
  }
  window.BSChart = { parseChart, gather, LABS };
})();
