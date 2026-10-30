/* Chart reading for the IBD flowsheet. READ-ONLY. parseChart() turns raw FHIR resources into a plain "facts" object; gather() fetches them with a SMART client.
   Labs, drugs and endoscopy are matched by NAME (and LOINC where known). LOINC codes and name patterns are UNVERIFIED: anything not found here may still exist in the chart. */
(function () {
  const IB = window.IBD;
  const lc = (s) => String(s == null ? "" : s).toLowerCase();
  const label = (cc) => (cc && (cc.text || (cc.coding || []).map((c) => c.display).find(Boolean))) || "";
  const codes = (cc) => ((cc && cc.coding) || []).map((c) => String(c.code || ""));
  const tOf = (r) => { const d = r.effectiveDateTime || (r.effectivePeriod && r.effectivePeriod.start) || r.performedDateTime || (r.performedPeriod && r.performedPeriod.start) || r.issued || r.occurrenceDateTime || r.authoredOn || r.date || r.onsetDateTime || r.recordedDate || ""; const t = d ? new Date(d).getTime() : NaN; return isNaN(t) ? null : t; };
  const NOT_BLOOD = /urine|\bur\b|csf|fluid|clearance|ratio/i;
  const WATCH = [["nsaid", /ibuprofen|naproxen|diclofenac|ketorolac|celecoxib|indomethacin|meloxicam|\baspirin\b.*(325|650)/i], ["opioid", /morphine|hydromorphone|oxycodone|codeine|fentanyl|tramadol|methadone|dilaudid/i]];
  const ENDO = /colonoscop|sigmoidoscop|ileoscop|endoscop|\begd\b|enteroscop|capsule|pouchoscop|proctoscop|flex(ible)? sig/i;

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
  function classifyDrug(name) {
    for (const c of IB.CLASSES) for (const d of c.drugs) if (d.re.test(name)) return { cls: c.id, drug: d.id };
    return null;
  }
  function labText(o) {
    if (o.valueString) return String(o.valueString);
    if (o.valueCodeableConcept) return label(o.valueCodeableConcept);
    if (typeof o.valueBoolean === "boolean") return o.valueBoolean ? "Positive" : "Negative";
    return null;
  }
  function scoresFrom(text) {
    const s = {}, t = String(text || "");
    let m = t.match(/mayo[^0-9]{0,40}\b([0-3])\b/i); if (m) s.mayo = +m[1];
    m = t.match(/ses-?cd[^0-9]{0,25}(\d{1,2})\b/i); if (m) s.sescd = +m[1];
    m = t.match(/rutgeerts[^i0-9]{0,20}(i[0-4])\b/i); if (m) s.rutgeerts = m[1].toLowerCase();
    return s;
  }

  function parseChart(raw, opts) {
    opts = opts || {};
    const now = opts.now || Date.now();
    const f = { age: null, sex: "", disease: "", onsetT: null, weights: [], vitals: [], labs: {}, meds: [], watch: [], endo: [], notes: [] };
    const p = raw.patient;
    if (p) { f.sex = lc(p.gender); if (p.birthDate) { const b = new Date(p.birthDate); if (!isNaN(b)) f.age = Math.floor((now - b.getTime()) / (365.25 * 864e5)); } }

    // diagnosis from the problem list: ICD-10 K50 = Crohn, K51 = ulcerative colitis
    (raw.conditions || []).forEach((c) => {
      const txt = label(c.code) + " " + codes(c.code).join(" ");
      let d = "";
      if (/crohn|\bK50\b|K50\./i.test(txt)) d = "cd"; else if (/ulcerative colitis|proctitis|pancolitis|\bK51\b|K51\./i.test(txt)) d = "uc"; else if (/inflammatory bowel|\bK52\.?[39]?\b.*colitis|indeterminate colitis/i.test(txt)) d = d || "unknown";
      if (!d) return;
      if (!f.disease || f.disease === "unknown") f.disease = d;
      else if (f.disease !== d && d !== "unknown") f.notes.push("Both Crohn disease and ulcerative colitis appear in the problem list: choose the disease above.");
      const t = c.onsetDateTime ? new Date(c.onsetDateTime).getTime() : c.recordedDate ? new Date(c.recordedDate).getTime() : null;
      if (t && !isNaN(t) && (f.onsetT == null || t < f.onsetT)) f.onsetT = t;
    });

    const obs = (raw.obs || []).filter((o) => o && o.resourceType === "Observation");

    // weight and vitals (one row per day of worst values)
    obs.forEach((o) => {
      const t = tOf(o); if (t == null) return;
      const lab = label(o.code), q = o.valueQuantity;
      if (q && typeof q.value === "number" && (codes(o.code).includes("29463-7") || codes(o.code).includes("3141-9") || /body weight/i.test(lab))) {
        let v = q.value; const u = q.unit || ""; if (/lb/i.test(u)) v *= 0.45359237; else if (/^g$/i.test(u)) v /= 1000;
        v = Math.round(v * 10) / 10; if (v >= 20 && v <= 400) f.weights.push({ t, v });
      }
    });
    const vrows = new Map();
    const addV = (t, key, v) => { const k = Math.floor(t / 6e4), r = vrows.get(k) || { t }; r[key] = v; vrows.set(k, r); };
    obs.forEach((o) => {
      const t = tOf(o); if (t == null) return;
      const lab = label(o.code), q = o.valueQuantity;
      if (q && typeof q.value === "number" && (codes(o.code).some((c) => ["8310-5", "8331-1"].includes(c)) || (/body temperature|^temp/i.test(lab) && !NOT_BLOOD.test(lab)))) {
        let v = q.value; if (/f/i.test(q.unit || "") || v > 50) v = Math.round(((v - 32) * 5) / 9 * 10) / 10; if (v >= 30 && v <= 43) addV(t, "temp", v);
      }
      if (q && typeof q.value === "number" && (codes(o.code).includes("8867-4") || /heart rate|pulse/i.test(lab)) && q.value >= 20 && q.value <= 240) addV(t, "hr", q.value);
      const sc = (o.component || []).find((c) => codes(c.code).includes("8480-6") || /systolic/i.test(label(c.code)));
      const sv = sc ? sc.valueQuantity : codes(o.code).includes("8480-6") || /systolic/i.test(lab) ? q : null;
      if (sv && typeof sv.value === "number" && sv.value >= 40 && sv.value <= 280) addV(t, "sbp", sv.value);
    });
    f.vitals = Array.from(vrows.values()).sort((a, b) => a.t - b.t);

    // labs: every result, grouped by flowsheet row, in the flowsheet unit
    IB.LABS.forEach((d) => { f.labs[d.id] = []; });
    const order = IB.MATCH_ORDER.map((id) => IB.LABS.find((d) => d.id === id)).concat(IB.LABS.filter((d) => !IB.MATCH_ORDER.includes(d.id)));
    const unmatched = new Set();
    obs.forEach((o) => {
      const t = tOf(o); if (t == null) return;
      const lab = label(o.code);
      const isLabCat = (o.category || []).some((c) => (c.coding || []).some((x) => /laboratory/i.test(x.code || ""))) || !(o.category || []).length;
      const def = order.find((d) => (d.loinc.some((l) => codes(o.code).includes(l)) || d.re.test(lab)) && !(NOT_BLOOD.test(lab) && !d.text && !["calpro"].includes(d.id)));
      if (!def || !isLabCat) return;
      if (def.id === "iron" && /binding|saturation|transferrin|ferritin/i.test(lab)) return;
      if (def.id === "wbc" && /neutrophil|lymph/i.test(lab)) return;
      if (def.id === "creat" && /clearance|urine/i.test(lab)) return;
      const e = { t, name: lab };
      const q = o.valueQuantity;
      if (q && typeof q.value === "number") {
        e.v = def.conv ? Math.round(def.conv(q.value, q.unit) * 100) / 100 : q.value; e.unit = def.unit || q.unit || "";
        if (def.conv && q.unit && e.v !== q.value) e.rawv = q.value + " " + q.unit;
        const rr = (o.referenceRange || [])[0] || {}, low = rr.low && rr.low.value, high = rr.high && rr.high.value;
        const interp = (o.interpretation || []).map((i) => (i.coding || []).map((c) => String(c.code || "").toUpperCase()).join(" ")).join(" ");
        if (/\b(H|HH|L|LL|A|AA|HU|LU)\b/.test(interp)) e.abn = true; else if (/\bN\b/.test(interp)) e.abn = false;
        else if ((typeof low === "number" || typeof high === "number") && !def.conv) e.abn = (typeof low === "number" && q.value < low) || (typeof high === "number" && q.value > high);
        if (e.abn == null) e.abn = null;
      } else { const tx = labText(o); if (tx == null) return; e.text = tx; e.unit = ""; }
      f.labs[def.id].push(e);
    });
    Object.keys(f.labs).forEach((k) => { f.labs[k].sort((a, b) => a.t - b.t); });

    // medications: administrations are "given"; requests are "ordered"
    const addMed = (m, type, t, isReq) => {
      const name = medText(m); if (!name || t == null) return;
      const c = classifyDrug(name);
      if (!c) { const w = WATCH.find(([, re]) => re.test(name)); if (w) f.watch.push({ kind: w[0], name, t }); return; }
      const e = { drug: c.drug, cls: c.cls, name, t, type, detail: doseText(m), src: "chart", status: m.status || "" };
      if (isReq && /^(active|on-hold|draft|unknown)$/i.test(m.status || "")) e.reqActive = m.status !== "on-hold";
      if (isReq && /on-hold/i.test(m.status || "")) { e.type = "held"; }
      f.meds.push(e);
      if (isReq && /^(stopped|cancelled|completed)$/i.test(m.status || "")) {
        const endT = m.dispenseRequest && m.dispenseRequest.validityPeriod && m.dispenseRequest.validityPeriod.end ? new Date(m.dispenseRequest.validityPeriod.end).getTime() : null;
        if (/stopped|cancelled/i.test(m.status) && endT && !isNaN(endT)) f.meds.push({ drug: c.drug, cls: c.cls, name, t: endT, type: "stopped", detail: "order ended", src: "chart", status: m.status });
      }
    };
    (raw.admins || []).forEach((m) => { if (m.status && /not-done|entered-in-error|stopped/i.test(m.status)) return; addMed(m, "given", tOf(m), false); });
    (raw.medreqs || []).forEach((m) => { if (m.status && /entered-in-error/i.test(m.status)) return; addMed(m, "started", tOf(m), true); });
    f.meds.sort((a, b) => a.t - b.t);
    if (!f.meds.length) f.notes.push("No IBD medication was found by name in the medication data. Add what the patient takes below (the page keeps entries until you reload).");

    // endoscopy: procedures, diagnostic reports, documents (names only; document text is not fetched)
    const addEndo = (r, kind, title, text) => {
      const t = tOf(r); if (t == null) return;
      if (!(ENDO.test(title) || ENDO.test(text || ""))) return;
      if (kind === "DocumentReference" && !ENDO.test(title)) return;
      const sc = scoresFrom((title || "") + " " + (text || ""));
      f.endo.push(Object.assign({ t, kind, title: title || kind, text: String(text || "").slice(0, 600), src: "chart" }, sc));
    };
    (raw.procs || []).forEach((r) => { if (/not-done|entered-in-error/i.test(r.status || "")) return; addEndo(r, "Procedure", label(r.code), (r.note || []).map((n) => n.text).join(" ") + " " + (r.outcome ? label(r.outcome) : "")); });
    (raw.reports || []).forEach((r) => addEndo(r, "DiagnosticReport", label(r.code), (r.conclusion || "") + " " + label((r.conclusionCode || [])[0])));
    (raw.docs || []).forEach((r) => addEndo(r, "DocumentReference", (r.description || "") + " " + label(r.type) + " " + ((r.content || [])[0] && r.content[0].attachment ? r.content[0].attachment.title || "" : ""), ""));
    f.endo.sort((a, b) => b.t - a.t);
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
    const since3y = iso(Date.now() - 3 * 365.25 * 864e5), since1y = iso(Date.now() - 365.25 * 864e5), since120 = iso(Date.now() - 120 * 864e5);
    const L = (arr) => arr.map((c) => "http://loinc.org|" + c).join(",");
    const loincs = []; IB.LABS.forEach((d) => d.loinc.forEach((c) => { if (!loincs.includes(c)) loincs.push(c); }));
    const chunks = []; for (let i = 0; i < loincs.length; i += 12) chunks.push(loincs.slice(i, i + 12));
    const codeReq = chunks.map((ch, i) => get(`Observation?patient=${pid}&code=${L(ch)}&date=ge${since3y}&_count=100`, "lab codes " + (i + 1), 3));
    const [patient, conditions, labsAll, vitals, weight, admins, medreqs, procs, reports, docs, ...codeSets] = await Promise.all([
      (async () => { try { return await client.patient.read(); } catch (e) { errors.push("patient: " + (e.message || e)); return null; } })(),
      get(`Condition?patient=${pid}&_count=100`, "problem list", 2),
      get(`Observation?patient=${pid}&category=laboratory&date=ge${since3y}&_count=100`, "laboratory results (3 years)", 8),
      get(`Observation?patient=${pid}&category=vital-signs&date=ge${since120}&_count=100`, "vital signs (120 days)", 4),
      get(`Observation?patient=${pid}&code=${L(["29463-7", "3141-9"])}&date=ge${since1y}&_count=40`, "weight"),
      get(`MedicationAdministration?patient=${pid}&_count=100`, "medication administrations", 4),
      get(`MedicationRequest?patient=${pid}&_count=100`, "medication orders", 4),
      get(`Procedure?patient=${pid}&_count=100`, "procedures", 3),
      get(`DiagnosticReport?patient=${pid}&_count=100`, "reports", 3),
      get(`DocumentReference?patient=${pid}&_count=100`, "documents", 3),
      ...codeReq
    ]);
    const seen = new Set(), obs = labsAll.concat(vitals, weight, ...codeSets).filter((o) => { const i = o.id || Math.random(); if (seen.has(i)) return false; seen.add(i); return true; });
    return { raw: { patient, obs, conditions, admins, medreqs, procs, reports, docs }, errors };
  }
  window.IBDChart = { parseChart, gather, classifyDrug, scoresFrom };
})();
