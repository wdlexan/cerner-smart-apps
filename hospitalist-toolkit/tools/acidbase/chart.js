/* Chart reading for the Acid-Base tab. READ-ONLY. parse() turns raw FHIR resources into plain facts; gather() fetches them.
   Labs are matched by LOINC and then by NAME (codes and patterns UNVERIFIED): a result not found here may still be in the chart.
   Values are converted to SI (mmol/L, g/L, umol/L, mmHg). */
(function () {
  const DAY = 864e5, HR = 36e5;
  const label = (cc) => (cc && (cc.text || (cc.coding || []).map((c) => c.display).find(Boolean))) || "";
  const codes = (cc) => ((cc && cc.coding) || []).map((c) => String(c.code || ""));
  const tOf = (r) => { const d = r.effectiveDateTime || (r.effectivePeriod && r.effectivePeriod.start) || r.issued || r.authoredOn || r.recordedDate || ""; const t = d ? new Date(d).getTime() : NaN; return isNaN(t) ? null : t; };
  const URINE = /urine|\bur\b|\burin|24 ?h(ou)?r/i;
  const OTHER = /csf|fluid|pleural|ascit|peritoneal|stool|sweat|drain/i;
  const GASNAME = /gas|arterial|venous|capillary|\bpoc\b|point of care|i-?stat|\bbg\b|abg|vbg|cord/i;
  const ART = /arterial|\bart\b|abg/i, VEN = /venous|\bven\b|vbg|mixed venous/i, CAP = /capillary|\bcap\b|cbg/i;
  const mg = (f) => (v, u) => (/mg\s*\/\s*dl/i.test(u || "") ? v * f : v);

  /* blood gas analytes. spec: LOINC that fixes the specimen */
  const GAS = [
    { id: "pH", label: "pH", loinc: { "2744-1": "arterial", "2746-6": "venous", "2745-8": "capillary", "11558-4": "" }, re: /^\s*ph\b|\bph\s*(,|\(|$)|\bph of\b/i, not: /urine|phos/i, ok: (v) => v >= 6.5 && v <= 8 },
    { id: "pCO2", label: "pCO2", loinc: { "2019-8": "arterial", "2021-4": "venous", "2020-6": "capillary", "11557-6": "" }, re: /p\s*co2|pco2|partial pressure.*carbon dioxide/i,
      conv: (v, u) => (/kpa/i.test(u || "") ? v * 7.50062 : v), ok: (v) => v >= 5 && v <= 200 },
    { id: "pO2", label: "pO2", loinc: { "2703-7": "arterial", "2705-2": "venous", "2704-5": "capillary", "11556-8": "" }, re: /p\s*o2\b|\bpo2\b|partial pressure.*oxygen/i, not: /sat|so2/i,
      conv: (v, u) => (/kpa/i.test(u || "") ? v * 7.50062 : v), ok: (v) => v >= 5 && v <= 700 },
    { id: "HCO3", label: "HCO3 (gas)", loinc: { "1960-4": "arterial", "14627-4": "venous", "1961-2": "capillary", "1959-6": "" }, re: /hco3|bicarb/i, not: /standard|std/i, ok: (v) => v > 0 && v < 70 },
    { id: "BE", label: "Base excess", loinc: { "1925-7": "arterial", "1927-3": "venous", "1926-5": "capillary", "11555-0": "" }, re: /base (excess|deficit)|\bbe\b|\bbeecf\b|\bbeb\b/i, ok: (v) => v > -40 && v < 40 }];

  /* chemistry and other blood tests */
  const CHEM = [
    { id: "Na", label: "Sodium", loinc: ["2951-2", "2947-0", "32717-1", "39791-9"], re: /sodium|^na\b|\bna\+?$/i, not: /fraction|excretion|bicarb/i, ok: (v) => v >= 90 && v <= 190, unit: "mmol/L" },
    { id: "K", label: "Potassium", loinc: ["2823-3", "6298-4", "32713-0"], re: /potassium|^k\b|\bk\+?$/i, ok: (v) => v > 1 && v < 12, unit: "mmol/L" },
    { id: "Cl", label: "Chloride", loinc: ["2075-0", "2069-3", "41650-3"], re: /chloride|^cl\b|\bcl-?$/i, ok: (v) => v >= 50 && v <= 160, unit: "mmol/L" },
    { id: "tCO2", label: "Total CO2 / bicarbonate", loinc: ["2028-9", "1963-8", "20565-8", "1962-0"], re: /total co2|co2,? total|^co2\b|\bco2 content|carbon dioxide|bicarbonate|\bhco3/i, not: /p\s*co2|partial/i, ok: (v) => v > 0 && v < 70, unit: "mmol/L" },
    { id: "albumin", label: "Albumin", loinc: ["1751-7", "61151-7", "2862-1"], re: /albumin/i, not: /urine|ratio|micro|globulin|electro|fraction/i, conv: (v, u) => (/g\s*\/\s*dl/i.test(u || "") || v < 8 ? v * 10 : v), ok: (v) => v > 5 && v < 70, unit: "g/L" },
    { id: "glucose", label: "Glucose", loinc: ["2345-7", "2339-0", "41653-7", "15074-8", "14749-6"], re: /glucose/i, not: /tolerance|urine/i, conv: (v, u) => (/mg\s*\/\s*dl/i.test(u || "") || v > 60 ? v / 18.016 : v), unit: "mmol/L" },
    { id: "urea", label: "Urea", loinc: ["3091-6", "22664-7", "3094-0", "6299-2"], re: /\burea\b|\bbun\b/i, not: /ratio|creatinine|urine/i, conv: mg(1 / 2.8), unit: "mmol/L" },
    { id: "creatinine", label: "Creatinine", loinc: ["2160-0", "38483-4", "14682-9"], re: /creatinine/i, not: /ratio|kinase|clearance/i, conv: mg(88.4), unit: "umol/L" },
    { id: "lactate", label: "Lactate", loinc: ["2524-7", "32693-4", "2518-9", "2519-7", "14118-4", "32133-1"], re: /lact/i, not: /dehydrogenase|ldh|lactose/i, conv: mg(1 / 9.008), ok: (v) => v >= 0 && v < 40, unit: "mmol/L" },
    { id: "osm", label: "Osmolality (measured)", loinc: ["2692-1", "2693-9"], re: /osmol/i, not: /gap|calc/i, unit: "mmol/kg" },
    { id: "bhb", label: "Beta-hydroxybutyrate", loinc: ["53060-9", "33428-4", "48633-1"], re: /hydroxybutyr|\bbhb\b|ketone|b-?ohb/i, not: /urine/i, conv: mg(1 / 10.41), unit: "mmol/L" },
    { id: "ethanol", label: "Ethanol", loinc: ["5643-2", "5640-8", "15053-2"], re: /ethanol|alcohol/i, not: /urine|breath/i, conv: (v, u) => (/mg\s*\/\s*dl/i.test(u || "") ? v / 4.607 : /g\s*\/\s*l/i.test(u || "") ? v * 21.7 : v), unit: "mmol/L" },
    { id: "salicylate", label: "Salicylate", loinc: ["4024-6", "35667-3"], re: /salicyl|aspirin/i, conv: (v, u) => (/mg\s*\/\s*dl/i.test(u || "") ? v / 13.81 : /mg\s*\/\s*l|ug\s*\/\s*ml|mcg\s*\/\s*ml/i.test(u || "") ? v / 138.1 : v), unit: "mmol/L" },
    { id: "CK", label: "Creatine kinase", loinc: ["2157-6"], re: /creatine kinase|\bck\b|\bcpk\b/i, not: /mb|isoenzyme/i, unit: "U/L" },
    { id: "phos", label: "Phosphate", loinc: ["2777-1", "14879-1"], re: /phosph/i, not: /alkaline|kinase/i, conv: mg(0.3229), unit: "mmol/L" }];
  const URINE_LABS = [
    { id: "uNa", label: "Urine sodium", loinc: ["2955-3", "2956-1"], re: /sodium|\bna\b/i, unit: "mmol/L" },
    { id: "uK", label: "Urine potassium", loinc: ["2828-2", "2829-0"], re: /potassium|\bk\b/i, unit: "mmol/L" },
    { id: "uCl", label: "Urine chloride", loinc: ["2078-4", "2079-2"], re: /chloride|\bcl\b/i, unit: "mmol/L" },
    { id: "uPH", label: "Urine pH", loinc: ["2756-5", "5803-2", "2748-2"], re: /\bph\b/i, ok: (v) => v >= 4 && v <= 9.5, unit: "" },
    { id: "uOsm", label: "Urine osmolality", loinc: ["2695-4"], re: /osmol/i, not: /gap|calc/i, ok: (v) => v > 30 && v < 1500, unit: "mmol/kg" },
    { id: "uUrea", label: "Urine urea", loinc: ["3095-7", "22702-5", "59570-2"], re: /\burea\b|urea nitrogen|\bbun\b|\buun\b/i, not: /creatinine|ratio|24/i, conv: mg(0.357), unit: "mmol/L" },
    { id: "uGlu", label: "Urine glucose", loinc: ["2350-7", "15076-3"], re: /glucose/i, conv: mg(1 / 18.016), unit: "mmol/L" },
    { id: "uKet", label: "Urine ketones", loinc: ["2514-8", "5797-6"], re: /ketone/i, unit: "" }];

  const PROB = {
    diabetes: /diabet|E1[0-4]/i, copd: /copd|chronic obstructive|emphysema|J44|J43|obesity hypoventilation|E66\.2/i, ckd: /chronic kidney|N18|end.stage renal|dialysis|Z99\.2/i,
    cirrhosis: /cirrho|K70\.3|K74\.[3-6]|hepatic failure|K72/i, alcohol: /alcohol|F10|K70/i, neuromusc: /myasthen|G70|guillain|G61\.0|als\b|amyotrophic|G12\.2|muscular dystroph/i,
    ibd: /crohn|colitis|K50|K51|ileostomy|Z93\.2|short bowel/i, pregnancy: /pregnan|O\d\d|Z33/i, sepsis: /sepsis|septic|A41|R65\.2/i };

  function medText(m) {
    let t = label(m.medicationCodeableConcept) || (m.medicationReference && m.medicationReference.display) || "";
    if (!t && m.medicationReference && m.contained) { const c = m.contained.find((x) => m.medicationReference.reference === "#" + x.id); if (c) t = label(c.code); }
    const di = m.dosageInstruction && m.dosageInstruction[0], d = m.dosage && m.dosage.dose;
    return [t, d && d.value != null ? d.value + " " + (d.unit || "") : "", di && di.text].filter(Boolean).join(" ").trim();
  }
  function specOf(name, spec, fixed) {
    if (fixed) return fixed;
    const w = name + " " + spec;
    return ART.test(w) ? "arterial" : VEN.test(w) ? "venous" : CAP.test(w) ? "capillary" : "";
  }

  function parse(raw, opts) {
    const now = (opts && opts.now) || Date.now();
    const f = { sex: "", age: null, gasObs: [], gases: [], c: {}, u: {}, meds: [], medNames: [], prob: {}, probNames: [] };
    CHEM.forEach((d) => (f.c[d.id] = [])); URINE_LABS.forEach((d) => (f.u[d.id] = []));
    const p = raw.patient;
    if (p) { f.sex = String(p.gender || "").toLowerCase(); if (p.birthDate) f.age = Math.floor((now - new Date(p.birthDate).getTime()) / (365.25 * DAY)); }
    const seen = new Set();
    (raw.obs || []).forEach((o) => {
      if (!o || o.resourceType !== "Observation" || /entered-in-error|cancelled/.test(o.status || "")) return;
      const q = o.valueQuantity; if (!q || typeof q.value !== "number") return;
      const t = tOf(o); if (t == null || t > now + DAY) return;
      const name = label(o.code), cs = codes(o.code), u = q.unit || "";
      const spec = (o.specimen && o.specimen.display) || "", where = name + " " + spec;
      const key = name + cs.join() + t + q.value; if (seen.has(key)) return; seen.add(key);
      if (OTHER.test(where)) return;
      if (URINE.test(where)) {
        const d = URINE_LABS.find((x) => x.loinc.some((c) => cs.includes(c))) || URINE_LABS.find((x) => x.re.test(name) && !(x.not && x.not.test(name)));
        const uv = d && d.conv ? d.conv(q.value, u) : q.value;
        if (d && (!d.ok || d.ok(uv))) f.u[d.id].push({ t, v: uv, shown: q.value + " " + u, name });
        return;
      }
      // blood gas analytes first (a gas LOINC, or a gas-only analyte name, or a gas-looking name)
      let g = GAS.find((x) => cs.some((c) => c in x.loinc));
      const isGasName = GASNAME.test(where);
      if (!g) g = GAS.find((x) => (x.id === "pH" || x.id === "pCO2" || x.id === "pO2" || x.id === "BE" || isGasName) && x.re.test(name) && !(x.not && x.not.test(name)));
      if (g) {
        const fixed = cs.map((c) => g.loinc[c]).find((s) => s !== undefined);
        const v = g.conv ? g.conv(q.value, u) : q.value;
        if (!g.ok || g.ok(v)) f.gasObs.push({ t, id: g.id, v, spec: specOf(name, spec, fixed), name, shown: q.value + " " + u });
        return;
      }
      const d = CHEM.find((x) => x.loinc.some((c) => cs.includes(c))) || CHEM.find((x) => x.re.test(name) && !(x.not && x.not.test(name)));
      if (d) {
        const v = d.conv ? d.conv(q.value, u) : q.value;
        if (!d.ok || d.ok(v)) f.c[d.id].push({ t, v, shown: q.value + " " + u, name, gas: isGasName });
      }
    });
    const srt = (a) => a.sort((x, y) => x.t - y.t);
    Object.values(f.c).forEach(srt); Object.values(f.u).forEach(srt); srt(f.gasObs);

    // group gas analytes into gases: same time (within 10 min) and compatible specimen
    f.gasObs.forEach((o) => {
      let g = f.gases.find((x) => Math.abs(x.t - o.t) <= 10 * 60e3 && (!x.spec || !o.spec || x.spec === o.spec) && x[o.id] == null);
      if (!g) { g = { t: o.t, spec: "" }; f.gases.push(g); }
      g[o.id] = o.v; if (o.spec) g.spec = o.spec;
    });
    f.gases = f.gases.filter((g) => g.pH != null || g.pCO2 != null).sort((a, b) => a.t - b.t);

    [].concat(raw.medreqs || [], raw.admins || []).forEach((m) => {
      const isReq = m.resourceType === "MedicationRequest";
      if (isReq && /stopped|cancelled|entered-in-error|completed|draft/.test(m.status || "")) return;
      const t = tOf(m);
      if (!isReq && t && now - t > 7 * DAY) return;
      const name = medText(m); if (!name) return;
      f.meds.push({ name, t, active: isReq, given: !isReq });
      if (f.medNames.indexOf(name) === -1) f.medNames.push(name);
    });
    (raw.conditions || []).forEach((c) => {
      if (c.clinicalStatus && /resolved|inactive|remission/i.test(JSON.stringify(c.clinicalStatus))) return;
      const txt = label(c.code) + " " + codes(c.code).join(" ");
      f.probNames.push(txt.trim());
      Object.keys(PROB).forEach((k) => { if (PROB[k].test(txt)) (f.prob[k] = f.prob[k] || []).push(label(c.code) || codes(c.code)[0]); });
    });
    return f;
  }

  /* value of a series nearest to time t, within maxH hours (prefers the most recent at or before t + 1 h) */
  function near(arr, t, maxH) {
    if (!arr || !arr.length) return null;
    let best = null, bd = Infinity;
    arr.forEach((e) => { const d = Math.abs(e.t - t) + (e.t > t + HR ? HR : 0); if (d < bd) { bd = d; best = e; } });
    return best && Math.abs(best.t - t) <= maxH * HR ? best : null;
  }
  const latest = (arr, maxAge, now) => { const e = arr && arr.length ? arr[arr.length - 1] : null; return e && (!maxAge || (now || Date.now()) - e.t <= maxAge) ? e : null; };
  /* lab (non-gas) value preferred; gas-analyser electrolytes only when no lab value */
  function nearLab(arr, t, maxH) { const lab = near((arr || []).filter((e) => !e.gas), t, maxH); return lab || near(arr, t, maxH); }

  /* chemistry anion gaps over time: Na, Cl, tCO2 drawn within 1 h of each other */
  function gapSeries(f) {
    const out = [];
    (f.c.tCO2 || []).forEach((h) => {
      const na = nearLab(f.c.Na, h.t, 1), cl = nearLab(f.c.Cl, h.t, 1);
      if (na && cl) { const alb = near(f.c.albumin, h.t, 72); const ag = na.v - (cl.v + h.v); out.push({ t: h.t, v: alb ? ag + 0.25 * (40 - alb.v) : ag, raw: ag, corr: !!alb }); }
    });
    return out;
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
    const since14 = iso(Date.now() - 14 * DAY), since7 = iso(Date.now() - 7 * DAY);
    const gasCodes = [].concat(...GAS.map((g) => Object.keys(g.loinc))).concat(CHEM.find((c) => c.id === "lactate").loinc).map((c) => "http://loinc.org|" + c).join(",");
    const [patient, gas, labs, medreqs, admins, conditions] = await Promise.all([
      (async () => { try { return await client.patient.read(); } catch (e) { errors.push("patient: " + (e.message || e)); return null; } })(),
      get(`Observation?patient=${pid}&code=${gasCodes}&date=ge${since14}&_count=100`, "blood gases (14 days)", 4),
      get(`Observation?patient=${pid}&category=laboratory&date=ge${since14}&_count=100`, "lab results (14 days)", 10),
      get(`MedicationRequest?patient=${pid}&_count=100`, "medication orders", 3),
      get(`MedicationAdministration?patient=${pid}&effective-time=ge${since7}T00:00:00Z&_count=100`, "medications given (7 days)", 4),
      get(`Condition?patient=${pid}&category=problem-list-item&_count=50`, "problem list", 2)]);
    return { raw: { patient, obs: gas.concat(labs), medreqs, admins, conditions }, errors };
  }

  const api = { GAS, CHEM, URINE_LABS, parse, near, nearLab, latest, gapSeries, gather, DAY, HR };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else window.AcidBaseChart = api;
})();
