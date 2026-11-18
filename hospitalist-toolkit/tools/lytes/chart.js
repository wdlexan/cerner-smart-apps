/* Chart reading for the Electrolytes tab. READ-ONLY. parse() turns raw FHIR resources into plain facts; gather() fetches them.
   Labs are matched by LOINC and then by NAME (codes and patterns UNVERIFIED): a result not found here may still be in the chart.
   Values are converted to SI (mmol/L, g/L, umol/L, pmol/L, nmol/L). */
(function () {
  const DAY = 864e5, HR = 36e5;
  const label = (cc) => (cc && (cc.text || (cc.coding || []).map((c) => c.display).find(Boolean))) || "";
  const codes = (cc) => ((cc && cc.coding) || []).map((c) => String(c.code || ""));
  const tOf = (r) => { const d = r.effectiveDateTime || (r.effectivePeriod && r.effectivePeriod.start) || r.issued || r.authoredOn || r.recordedDate || ""; const t = d ? new Date(d).getTime() : NaN; return isNaN(t) ? null : t; };
  const URINE = /urine|\bur\b|\burin|24 ?h(ou)?r/i;
  const OTHER = /csf|fluid|pleural|ascit|peritoneal|stool|sweat|drain|dialysate/i;
  const mgdl = (u) => /mg\s*\/\s*dl/i.test(u || "");
  const mg = (f) => (v, u) => (mgdl(u) ? v * f : v);

  const LABS = [
    { id: "K", label: "Potassium", loinc: ["2823-3", "6298-4", "32713-0", "77142-8"], re: /potassium|^k\b|\bk\+?$/i, not: /phosph|chloride|citrate/i, ok: (v) => v > 1 && v < 12 },
    { id: "phos", label: "Phosphate", loinc: ["2777-1", "14879-1", "24519-1"], re: /phosph/i, not: /alkaline|kinase|potassium phos|sodium phos/i, conv: mg(0.3229), ok: (v) => v > 0.05 && v < 8 },
    { id: "Ca", label: "Calcium (total)", loinc: ["17861-6", "2000-8", "29265-6"], re: /calcium/i, not: /ion|free|ica\b|urine|ratio|creat|corrected|adj|score|channel|gluconate|carbonate/i, conv: mg(0.2495), ok: (v) => v > 0.8 && v < 5 },
    { id: "iCa", label: "Calcium (ionized)", loinc: ["1994-3", "1995-0", "17863-2", "34581-9", "12180-6"], re: /ioni[sz]ed|free calcium|\bica\b|ca\+\+|calcium,? ion/i, not: /urine/i, conv: mg(0.2495), ok: (v) => v > 0.3 && v < 3 },
    { id: "Mg", label: "Magnesium", loinc: ["19123-9", "2601-3", "2593-2"], re: /magnes|^mg\b/i, not: /urine|sulfate|oxide|citrate/i, conv: (v, u) => (mgdl(u) ? v * 0.4114 : /meq/i.test(u || "") ? v * 0.5 : v), ok: (v) => v > 0.1 && v < 5 },
    { id: "albumin", label: "Albumin", loinc: ["1751-7", "61151-7", "2862-1"], re: /albumin/i, not: /urine|ratio|micro|globulin|electro|fraction/i, conv: (v, u) => (/g\s*\/\s*dl/i.test(u || "") || v < 8 ? v * 10 : v), ok: (v) => v > 5 && v < 70 },
    { id: "creatinine", label: "Creatinine", loinc: ["2160-0", "38483-4", "14682-9"], re: /creatinine/i, not: /ratio|kinase|clearance|urine/i, conv: mg(88.4) },
    { id: "glucose", label: "Glucose", loinc: ["2345-7", "2339-0", "41653-7", "15074-8", "14749-6"], re: /glucose/i, not: /tolerance|urine/i, conv: (v, u) => (mgdl(u) || v > 60 ? v / 18.016 : v) },
    { id: "tCO2", label: "Total CO2", loinc: ["2028-9", "1963-8", "20565-8", "1962-0"], re: /total co2|co2,? total|^co2\b|\bco2 content|carbon dioxide|bicarbonate|\bhco3/i, not: /p\s*co2|partial/i, ok: (v) => v > 0 && v < 70 },
    { id: "Na", label: "Sodium", loinc: ["2951-2", "2947-0"], re: /sodium|^na\b/i, not: /fraction|excretion|bicarb|phosph/i, ok: (v) => v >= 90 && v <= 190 },
    { id: "CK", label: "Creatine kinase", loinc: ["2157-6"], re: /creatine kinase|\bck\b|\bcpk\b/i, not: /mb|isoenzyme/i },
    { id: "urate", label: "Uric acid", loinc: ["3084-1", "14933-6"], re: /uric acid|urate/i, not: /urine/i, conv: mg(59.48) },
    { id: "LDH", label: "LDH", loinc: ["2532-0", "14804-9"], re: /\bldh\b|lactate dehydrogenase/i },
    { id: "plt", label: "Platelets", loinc: ["777-3", "26515-7"], re: /platelet|\bplt\b/i, not: /volume|mpv|function|antibod/i },
    { id: "wbc", label: "WBC", loinc: ["6690-2", "26464-8"], re: /\bwbc\b|white blood cell|leukocyte count|white cell count/i, not: /urine|esterase/i },
    { id: "PTH", label: "PTH", loinc: ["2731-8", "14866-8"], re: /parathyroid hormone|\bpth\b/i, not: /related|rp\b|pthrp/i, conv: (v, u) => (/pg\s*\/\s*ml|ng\s*\/\s*l/i.test(u || "") ? v * 0.106 : v) },
    { id: "vitD", label: "25-OH vitamin D", loinc: ["1989-3", "62292-8", "14635-7"], re: /25.?(oh|hydroxy)|vitamin d/i, not: /1,?25|dihydroxy/i, conv: (v, u) => (/ng\s*\/\s*ml|ug\s*\/\s*l/i.test(u || "") ? v * 2.496 : v) },
    { id: "PTHrP", label: "PTHrP", loinc: ["15087-0"], re: /pthrp|parathyroid hormone.?related/i }];
  const URINE_LABS = [
    { id: "uK", label: "Urine potassium", loinc: ["2828-2", "2829-0"], re: /potassium|\bk\b/i },
    { id: "uCr", label: "Urine creatinine", loinc: ["2161-8", "14683-7", "20624-3"], re: /creatinine/i, not: /ratio|clearance/i, conv: (v, u) => (/umol/i.test(u || "") ? v / 1000 : mgdl(u) ? v * 0.0884 : v) }];
  const VITALS = [
    { id: "weight", label: "Weight", loinc: ["29463-7", "3141-9", "3142-7", "8335-2"], re: /weight/i, not: /birth|ideal|dry|change|percent/i, conv: (v, u) => (/lb/i.test(u || "") ? v * 0.45359 : /\bg\b/i.test(u || "") && v > 1000 ? v / 1000 : v), ok: (v) => v > 20 && v < 350 },
    { id: "QTc", label: "QTc", loinc: ["8636-3", "8634-8"], re: /qtc|q-?t interval corrected/i, ok: (v) => v > 250 && v < 750 }];

  function parse(raw, opts) {
    const now = (opts && opts.now) || Date.now();
    const f = { sex: "", age: null, c: {}, meds: [], medNames: [], probs: [] };
    LABS.concat(URINE_LABS, VITALS).forEach((d) => (f.c[d.id] = []));
    const p = raw.patient;
    if (p) { f.sex = String(p.gender || "").toLowerCase(); if (p.birthDate) f.age = Math.floor((now - new Date(p.birthDate).getTime()) / (365.25 * DAY)); }
    const seen = new Set();
    const match = (list, cs, name) => list.find((x) => x.loinc.some((c) => cs.includes(c))) || list.find((x) => x.re.test(name) && !(x.not && x.not.test(name)));
    (raw.obs || []).forEach((o) => {
      if (!o || o.resourceType !== "Observation" || /entered-in-error|cancelled/.test(o.status || "")) return;
      const q = o.valueQuantity; if (!q || typeof q.value !== "number") return;
      const t = tOf(o); if (t == null || t > now + DAY) return;
      const name = label(o.code), cs = codes(o.code), u = q.unit || q.code || "";
      const spec = (o.specimen && o.specimen.display) || "", where = name + " " + spec;
      const key = name + cs.join() + t + q.value; if (seen.has(key)) return; seen.add(key);
      if (OTHER.test(where)) return;
      const isVital = (o.category || []).some((c) => /vital|exam|procedure/i.test(JSON.stringify(c))) || VITALS.some((x) => x.loinc.some((c) => cs.includes(c)));
      const d = isVital ? match(VITALS, cs, name) : URINE.test(where) ? match(URINE_LABS, cs, name) : match(LABS, cs, name);
      if (!d) return;
      const v = d.conv ? d.conv(q.value, u) : q.value;
      if (!d.ok || d.ok(v)) f.c[d.id].push({ t, v, shown: q.value + " " + u, name });
    });
    Object.values(f.c).forEach((a) => a.sort((x, y) => x.t - y.t));

    [].concat(raw.medreqs || [], raw.admins || []).forEach((m) => {
      const isReq = m.resourceType === "MedicationRequest";
      if (isReq && /stopped|cancelled|entered-in-error|completed|draft/.test(m.status || "")) return;
      const t = tOf(m);
      if (!isReq && t && now - t > 3 * DAY) return;
      const name = medText(m); if (!name) return;
      f.meds.push({ name, t, active: isReq, given: !isReq });
      if (f.medNames.indexOf(name) === -1) f.medNames.push(name);
    });
    (raw.conditions || []).forEach((c) => {
      if (c.clinicalStatus && /resolved|inactive|remission/i.test(JSON.stringify(c.clinicalStatus))) return;
      const txt = [label(c.code)].concat(codes(c.code)).filter(Boolean).join(" ");
      if (txt && f.probs.indexOf(txt) === -1) f.probs.push(txt);
    });
    return f;
  }
  function medText(m) {
    const cc = m.medicationCodeableConcept; let n = label(cc) || (m.medicationReference && m.medicationReference.display) || "";
    const di = (m.dosageInstruction || [])[0]; if (di && di.text && n && n.indexOf(di.text) === -1) n += " " + di.text;
    return n.trim();
  }

  const latest = (arr, maxAge, now) => { const e = arr && arr.length ? arr[arr.length - 1] : null; return e && (!maxAge || (now || Date.now()) - e.t <= maxAge) ? e : null; };
  /* the value before e, at least minGapH hours earlier, within maxH hours */
  function previous(arr, e, minGapH, maxH) { if (!e) return null; return (arr || []).filter((x) => x.t <= e.t - minGapH * HR && e.t - x.t <= maxH * HR).pop() || null; }
  /* AKI-ish: creatinine up ≥ 26.5 in 48 h or ≥ 1.5 × the lowest in 7 days (KDIGO creatinine criteria) */
  function crRise(arr, now) {
    const last = latest(arr, 2 * DAY, now); if (!last) return null;
    const in48 = (arr || []).filter((x) => x.t >= last.t - 2 * DAY && x.t < last.t), in7 = (arr || []).filter((x) => x.t >= last.t - 7 * DAY && x.t < last.t);
    const min48 = in48.length ? Math.min(...in48.map((x) => x.v)) : null, min7 = in7.length ? Math.min(...in7.map((x) => x.v)) : null;
    if (min48 != null && last.v - min48 >= 26.5) return "creatinine " + Math.round(min48) + " → " + Math.round(last.v) + " in 48 h";
    if (min7 != null && last.v >= 1.5 * min7) return "creatinine " + Math.round(min7) + " → " + Math.round(last.v) + " in 7 days";
    return null;
  }

  async function gather(client, say) {
    const pid = client.patient.id, errors = [], tell = say || (() => {});
    const iso = (t) => new Date(t).toISOString().slice(0, 10);
    async function get(url, name, pages) {
      const once = () => { let tm; return Promise.race([client.request(url, { pageLimit: pages || 1, flat: true }), new Promise((_, rej) => { tm = setTimeout(() => rej(new Error("timed out after 30 s")), 30000); })]).finally(() => clearTimeout(tm)); };
      const fetchRetry = () => once().catch((e) => /timed out|\b50[234]\b|Gateway|Failed to fetch|NetworkError/i.test(String((e && e.message) || e)) ? new Promise((r) => setTimeout(r, 1500)).then(once) : Promise.reject(e));
      try { const r = (await fetchRetry()).filter((x) => x.resourceType && x.resourceType !== "OperationOutcome"); tell(`Loaded ${name} (${r.length})…`); return r; }
      catch (e) { errors.push(`${name}: ${e.message || e}`); return []; }
    }
    const since14 = iso(Date.now() - 14 * DAY), since3 = iso(Date.now() - 3 * DAY), since365 = iso(Date.now() - 365 * DAY);
    const endo = ["PTH", "vitD", "PTHrP"].map((id) => LABS.find((x) => x.id === id).loinc).reduce((a, b) => a.concat(b), []).map((c) => "http://loinc.org|" + c).join(",");
    const vit = VITALS.map((x) => x.loinc).reduce((a, b) => a.concat(b), []).map((c) => "http://loinc.org|" + c).join(",");
    const [patient, labs, endoLabs, vitals, medreqs, admins, conditions] = await Promise.all([
      (async () => { try { return await client.patient.read(); } catch (e) { errors.push("patient: " + (e.message || e)); return null; } })(),
      get(`Observation?patient=${pid}&category=laboratory&date=ge${since14}&_count=100`, "lab results (14 days)", 10),
      get(`Observation?patient=${pid}&code=${endo}&date=ge${since365}&_count=50`, "PTH and vitamin D (1 year)", 2),
      get(`Observation?patient=${pid}&code=${vit}&date=ge${since14}&_count=50`, "weight and QTc (14 days)", 2),
      get(`MedicationRequest?patient=${pid}&_count=100`, "medication orders", 3),
      get(`MedicationAdministration?patient=${pid}&effective-time=ge${since3}T00:00:00Z&_count=100`, "medications given (3 days)", 4),
      get(`Condition?patient=${pid}&category=problem-list-item&_count=50`, "problem list", 2)]);
    return { raw: { patient, obs: labs.concat(endoLabs, vitals), medreqs, admins, conditions }, errors };
  }

  const api = { LABS, URINE_LABS, VITALS, parse, latest, previous, crRise, gather, DAY, HR };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else window.LytesChart = api;
})();
