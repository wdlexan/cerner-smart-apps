/* Chart reading for the liver scores tab. READ-ONLY. parse() turns raw FHIR resources into plain facts; gather() fetches them.
   Labs are matched by LOINC and then by NAME; codes and name patterns are UNVERIFIED, so a result not found here may still be in the chart. */
(function () {
  const S = window.LiverScores, DAY = 864e5;
  const label = (cc) => (cc && (cc.text || (cc.coding || []).map((c) => c.display).find(Boolean))) || "";
  const codes = (cc) => ((cc && cc.coding) || []).map((c) => String(c.code || ""));
  const tOf = (r) => { const d = r.effectiveDateTime || (r.effectivePeriod && r.effectivePeriod.start) || r.performedDateTime || (r.performedPeriod && r.performedPeriod.start) || r.issued || r.authoredOn || r.onsetDateTime || r.recordedDate || ""; const t = d ? new Date(d).getTime() : NaN; return isNaN(t) ? null : t; };
  const NOT_SERUM = /urine|\bur\b|csf|fluid|ascit|peritoneal|pleural|stool|clearance|24 ?h/i;

  /* first match wins, so the more specific patterns come first */
  const LABS = [
    { id: "bili", label: "Total bilirubin", unit: "umol/L", loinc: ["1975-2", "42719-5", "14631-6"], re: /bilirubin/i, not: /direct|conjugated|indirect|unconjugated|neonatal/i },
    { id: "creat", label: "Creatinine", unit: "umol/L", loinc: ["2160-0", "38483-4", "14682-9"], re: /creatinine/i, not: /ratio|kinase|\bck\b/i },
    { id: "inr", label: "INR", unit: "", loinc: ["6301-6", "34714-6", "46418-0"], re: /\binr\b|international normali[sz]ed/i, not: /target|goal/i },
    { id: "na", label: "Sodium", unit: "mmol/L", loinc: ["2951-2", "2947-0"], re: /^sodium|\bsodium\b|^na\b/i, not: /fraction|excretion/i },
    { id: "alb", label: "Albumin", unit: "g/L", loinc: ["1751-7", "61151-7", "2862-1"], re: /albumin/i, not: /micro|creatinine|globulin ratio|a\/g/i }
  ];

  const MEDS = [
    ["warfarin", /warfarin|coumadin/i], ["lactulose", /lactulose/i], ["rifaximin", /rifaximin|zaxine|xifaxan/i],
    ["spironolactone", /spironolactone|aldactone/i], ["furosemide", /furosemide|lasix/i], ["albumin", /albumin.*(5|25) ?%|\balbumin (human|iv|infusion)/i]
  ];
  const DIALYSIS = /dialys|hemodialysis|haemodialysis|\bcrrt\b|\bcvvhd?f?\b|renal replacement/i;
  const CIRRHOSIS = /cirrho|K70\.3|K70\.4|K74\.[3-6]|K72|portal hypertens|K76\.6|esophageal varic|I85|hepatic encephalopath|K76\.82|hepatorenal|K76\.7|ascites|R18/i;

  function medText(m) {
    let t = label(m.medicationCodeableConcept) || (m.medicationReference && m.medicationReference.display) || "";
    if (!t && m.medicationReference && m.contained) { const c = m.contained.find((x) => m.medicationReference.reference === "#" + x.id); if (c) t = label(c.code); }
    return t;
  }

  function parse(raw, opts) {
    const now = (opts && opts.now) || Date.now();
    const f = { sex: "", age: null, labs: {}, meds: {}, dialysis: [], problems: [] };
    LABS.forEach((d) => (f.labs[d.id] = []));
    const p = raw.patient;
    if (p) { f.sex = String(p.gender || "").toLowerCase(); if (p.birthDate) f.age = Math.floor((now - new Date(p.birthDate).getTime()) / (365.25 * DAY)); }

    const seen = new Set();
    (raw.obs || []).forEach((o) => {
      if (!o || o.resourceType !== "Observation" || /entered-in-error|cancelled/.test(o.status || "")) return;
      const q = o.valueQuantity; if (!q || typeof q.value !== "number") return;
      const t = tOf(o); if (t == null || t > now + DAY) return;
      const name = label(o.code), cs = codes(o.code);
      if (NOT_SERUM.test(name)) return;
      const d = LABS.find((x) => x.loinc.some((c) => cs.includes(c))) || LABS.find((x) => x.re.test(name) && !x.not.test(name));
      if (!d) return;
      const key = d.id + "|" + t + "|" + q.value; if (seen.has(key)) return; seen.add(key); // the same result can come back from two searches
      const v = S.toSI[d.id](q.value, q.unit || "");
      f.labs[d.id].push({ t, v, shown: q.value + (q.unit ? " " + q.unit : ""), name });
    });
    LABS.forEach((d) => f.labs[d.id].sort((a, b) => a.t - b.t));

    [].concat(raw.medreqs || [], raw.admins || []).forEach((m) => {
      const name = medText(m), t = tOf(m);
      if (/stopped|cancelled|entered-in-error|completed/.test(m.status || "") && m.resourceType === "MedicationRequest") return;
      MEDS.forEach(([id, re]) => { if (re.test(name)) { const e = f.meds[id] || (f.meds[id] = { name, t }); if (t && (!e.t || t > e.t)) { e.t = t; e.name = name; } } });
    });

    (raw.procs || []).forEach((pr) => { const t = tOf(pr), n = label(pr.code); if (t && DIALYSIS.test(n) && now - t <= 7 * DAY) f.dialysis.push({ t, n }); });
    (raw.conditions || []).forEach((c) => { const txt = label(c.code) + " " + codes(c.code).join(" "); if (CIRRHOSIS.test(txt)) f.problems.push(label(c.code) || codes(c.code)[0]); });
    return f;
  }

  /* Latest value of each lab at or before time t (within maxAge). */
  function at(f, t, maxAge) {
    const out = {};
    LABS.forEach((d) => { const arr = f.labs[d.id]; for (let i = arr.length - 1; i >= 0; i--) if (arr[i].t <= t) { if (t - arr[i].t <= maxAge) out[d.id] = arr[i]; break; } });
    return out;
  }

  async function gather(client, say) {
    const pid = client.patient.id, errors = [], tell = say || (() => {});
    const iso = (t) => new Date(t).toISOString().slice(0, 10);
    async function get(url, name, pages) {
      const timer = new Promise((_, rej) => setTimeout(() => rej(new Error("timed out after 60 s")), 60000));
      try { const r = (await Promise.race([client.request(url, { pageLimit: pages || 1, flat: true }), timer])).filter((x) => x.resourceType && x.resourceType !== "OperationOutcome"); tell(`Loaded ${name} (${r.length})…`); return r; }
      catch (e) { errors.push(`${name}: ${e.message || e}`); return []; }
    }
    const since = iso(Date.now() - 365 * DAY), since30 = iso(Date.now() - 30 * DAY);
    const loincs = [].concat(...LABS.map((d) => d.loinc)).map((c) => "http://loinc.org|" + c).join(",");
    const [patient, byCode, byCat, medreqs, admins, procs, conditions] = await Promise.all([
      (async () => { try { return await client.patient.read(); } catch (e) { errors.push("patient: " + (e.message || e)); return null; } })(),
      get(`Observation?patient=${pid}&code=${loincs}&date=ge${since}&_count=100`, "liver labs by code (1 year)", 6),
      get(`Observation?patient=${pid}&category=laboratory&date=ge${since}&_count=100`, "all lab results (1 year)", 8),
      get(`MedicationRequest?patient=${pid}&_count=100`, "medication orders", 3),
      get(`MedicationAdministration?patient=${pid}&effective-time=ge${since30}&_count=100`, "medications given (30 days)", 3),
      get(`Procedure?patient=${pid}&date=ge${since30}&_count=100`, "procedures (30 days)", 2),
      get(`Condition?patient=${pid}&_count=100`, "problem list", 2)
    ]);
    return { raw: { patient, obs: byCode.concat(byCat), medreqs, admins, procs, conditions }, errors };
  }

  window.LiverChart = { LABS, parse, at, gather, DAY };
})();
