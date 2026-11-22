/* Neuro (non-stroke) tab: chart reading. READ-ONLY. gather() fetches FHIR resources; parse() turns them into plain facts.
   Results are matched by LOINC and then by NAME (codes and name patterns UNVERIFIED): anything not found here may still be in the chart. */
(function (root) {
  const H = 36e5, DAY = 24 * H;
  const label = (cc) => (cc && (cc.text || (cc.coding || []).map((c) => c.display).find(Boolean))) || "";
  const codes = (cc) => ((cc && cc.coding) || []).map((c) => String(c.code || ""));
  const tOf = (r) => { const d = r.effectiveDateTime || (r.effectivePeriod && r.effectivePeriod.start) || r.issued || r.authoredOn || r.recordedDate || r.onsetDateTime || ""; const t = d ? new Date(d).getTime() : NaN; return isNaN(t) ? null : t; };
  const NOTBLOOD = /urine|\bur\b|csf|fluid|stool/i;

  const LABS = [
    { id: "na", label: "Sodium", unit: "mmol/L", loinc: ["2951-2", "2947-0"], re: /\bsodium\b/i, not: /urine|fraction/i },
    { id: "k", label: "Potassium", unit: "mmol/L", loinc: ["2823-3", "6298-4"], re: /potassium/i, not: /urine/i },
    { id: "ca", label: "Calcium", unit: "mmol/L", loinc: ["17861-6", "2000-8"], re: /^calcium|calcium,? (total|serum)/i, not: /ionized|urine/i, conv: (v, u) => (/mg\s*\/\s*dl/i.test(u || "") ? v * 0.2495 : v) },
    { id: "mg", label: "Magnesium", unit: "mmol/L", loinc: ["19123-9", "2601-3"], re: /magnesium/i, not: /urine/i, conv: (v, u) => (/mg\s*\/\s*dl/i.test(u || "") ? v * 0.4114 : v) },
    { id: "phos", label: "Phosphate", unit: "mmol/L", loinc: ["2777-1"], re: /phosph/i, not: /alkaline|kinase/i, conv: (v, u) => (/mg\s*\/\s*dl/i.test(u || "") ? v * 0.3229 : v) },
    { id: "glu", label: "Glucose", unit: "mmol/L", loinc: ["2345-7", "2339-0"], re: /glucose/i, not: /urine|csf/i, conv: (v, u) => (/mg\s*\/\s*dl/i.test(u || "") ? v / 18 : v) },
    { id: "cr", label: "Creatinine", unit: "µmol/L", loinc: ["2160-0", "14682-9"], re: /creatinine/i, not: /ratio|kinase|clearance|gfr/i, conv: (v, u) => (/mg\s*\/\s*dl/i.test(u || "") || v < 20 ? v * 88.4 : v) },
    { id: "ck", label: "CK", unit: "U/L", loinc: ["2157-6"], re: /creatine kinase|\bck\b|\bcpk\b/i, not: /mb|isoenz/i },
    { id: "tsh", label: "TSH", unit: "mU/L", loinc: ["3016-3", "11580-8"], re: /\btsh\b|thyroid stimulating/i },
    { id: "b12", label: "Vitamin B12", unit: "pmol/L", loinc: ["2132-9", "14685-2"], re: /b12|cobalamin/i },
    { id: "a1c", label: "HbA1c", unit: "%", loinc: ["4548-4"], re: /a1c|glycated/i },
    { id: "crp", label: "CRP", unit: "mg/L", loinc: ["1988-5"], re: /c.?reactive|\bcrp\b/i },
    { id: "wbc", label: "WBC", unit: "×10⁹/L", loinc: ["6690-2", "26464-8"], re: /\bwbc\b|white (blood )?cell|leukocytes/i, not: NOTBLOOD },
    { id: "hb", label: "Hemoglobin", unit: "g/L", loinc: ["718-7"], re: /hemoglobin|^hgb\b|^hb\b/i, not: /a1c|glyc|mch/i, conv: (v, u) => (/g\s*\/\s*dl/i.test(u || "") || v < 25 ? v * 10 : v) },
    { id: "plt", label: "Platelets", unit: "×10⁹/L", loinc: ["777-3", "26515-7"], re: /platelet/i, not: /mean|volume|mpv/i },
    { id: "inr", label: "INR", unit: "", loinc: ["6301-6", "34714-6"], re: /\binr\b/i },
    { id: "aptt", label: "aPTT", unit: "s", loinc: ["14979-9", "3173-2"], re: /aptt|\bptt\b|partial thromboplastin/i },
    { id: "fib", label: "Fibrinogen", unit: "g/L", loinc: ["3255-7"], re: /fibrinogen/i, conv: (v, u) => (/mg\s*\/\s*dl/i.test(u || "") ? v / 100 : v) },
    { id: "antixa", label: "Anti-Xa", unit: "", loinc: ["3274-8", "74218-8"], re: /anti.?xa|apixaban|rivaroxaban/i }];
  const RESP = [
    { id: "fvc", loinc: ["19870-5", "19868-9"], re: /forced vital capacity|\bfvc\b|vital capacity/i, conv: (v, u) => (/ml/i.test(u || "") || v > 20 ? v / 1000 : v) },
    { id: "nif", loinc: ["20155-8"], re: /negative inspiratory|\bnif\b|\bmip\b|maximal inspiratory|inspiratory force/i, conv: (v) => -Math.abs(v) },
    { id: "mep", loinc: [], re: /maximal expiratory pressure|\bmep\b/i }];
  const GCS = { loinc: ["9269-2"], re: /glasgow|\bgcs\b/i, not: /eye|verbal|motor/i };
  const BLADDER = { loinc: [], re: /bladder scan|post.?void|residual|bladder volume/i };
  const TEMP = ["8310-5", "8331-1"];

  function match(o, d) {
    const cs = codes(o.code), nm = label(o.code);
    if ((d.loinc || []).some((c) => cs.includes(c))) return true;
    return d.re.test(nm) && !(d.not && d.not.test(nm));
  }
  const num = (o) => (o.valueQuantity && typeof o.valueQuantity.value === "number" ? o.valueQuantity.value : null);

  function parse(raw) {
    const now = Date.now(), obs = (raw.obs || []).filter((o) => o && o.resourceType === "Observation" && o.status !== "entered-in-error");
    const out = { labs: {}, series: {}, resp: [], gcs: [], bladder: [], temps: [], weight: null, ua: null, meds: [], conds: [], auto: {} };
    obs.forEach((o) => {
      const t = tOf(o), v = num(o), u = o.valueQuantity && (o.valueQuantity.unit || o.valueQuantity.code), cs = codes(o.code), nm = label(o.code);
      if (t == null) return;
      const sbpC = (o.component || []).find((cp) => codes(cp.code).includes("8480-6") || /systolic/i.test(label(cp.code)));
      const sbpV = sbpC && sbpC.valueQuantity ? sbpC.valueQuantity.value : cs.includes("8480-6") || /systolic/i.test(nm) ? v : null;
      if (sbpV != null) { (out.series.sbp = out.series.sbp || []).push({ t, v: sbpV }); return; }
      if (TEMP.some((c) => cs.includes(c)) || /temperature/i.test(nm)) { if (v != null) out.temps.push({ t, v: v > 50 ? Math.round(((v - 32) * 5 / 9) * 10) / 10 : v }); return; }
      if (cs.includes("29463-7") || cs.includes("3141-9") || /body weight/i.test(nm)) { if (v != null) { const kg = /lb/i.test(u || "") ? v * 0.4536 : v; if (!out.weight || t > out.weight.t) out.weight = { t, v: Math.round(kg * 10) / 10 }; } return; }
      const rd = RESP.find((d) => match(o, d));
      if (rd && v != null) { out.resp.push({ t, [rd.id]: Math.round((rd.conv ? rd.conv(v, u) : v) * 100) / 100 }); return; }
      if (match(o, GCS) && v != null) { out.gcs.push({ t, v }); return; }
      if (match(o, BLADDER) && v != null) { out.bladder.push({ t, v }); return; }
      if (/leuk.*esterase|nitrite/i.test(nm)) {
        const txt = (o.valueCodeableConcept && label(o.valueCodeableConcept)) || o.valueString || "";
        const pos = /pos|trace|small|moderate|large|\+|[1-3]\+/i.test(txt) && !/neg/i.test(txt);
        if (!out.ua || t >= out.ua.t) out.ua = { t, pos: (out.ua && out.ua.t === t && out.ua.pos) || pos };
        return;
      }
      if (NOTBLOOD.test(nm) && !/glucose/i.test(nm)) return;
      const d = LABS.find((x) => match(o, x));
      if (d && v != null) {
        const val = Math.round((d.conv ? d.conv(v, u) : v) * 100) / 100;
        (out.series[d.id] = out.series[d.id] || []).push({ t, v: val });
        if (!out.labs[d.id] || t > out.labs[d.id].t) out.labs[d.id] = { t, v: val, label: d.label, unit: d.unit };
      }
    });
    out.resp.sort((a, b) => a.t - b.t); out.gcs.sort((a, b) => a.t - b.t); out.bladder.sort((a, b) => a.t - b.t);
    // merge FVC/NIF/MEP taken at the same time into one row
    const merged = []; out.resp.forEach((r) => { const m = merged.find((x) => Math.abs(x.t - r.t) < 15 * 60e3); if (m) Object.assign(m, r, { t: m.t }); else merged.push({ ...r }); });
    out.resp = merged;

    const active = (m) => !m.status || /active|on-hold|draft/i.test(m.status);
    const medName = (m) => label(m.medicationCodeableConcept) || (m.medicationReference && m.medicationReference.display) || "";
    const seen = new Set();
    (raw.medreqs || []).filter(active).forEach((m) => { const n = medName(m); if (n && !seen.has(n.toLowerCase())) { seen.add(n.toLowerCase()); out.meds.push(n); } });
    (raw.admins || []).forEach((m) => { const t = tOf(m) || (m.effectivePeriod && new Date(m.effectivePeriod.start).getTime()); const n = medName(m); if (n && t && now - t < 3 * DAY && !seen.has(n.toLowerCase())) { seen.add(n.toLowerCase()); out.meds.push(n); } });
    out.conds = (raw.conditions || []).filter((c) => !c.clinicalStatus || !/resolved|inactive/i.test(label(c.clinicalStatus))).map((c) => label(c.code)).filter(Boolean);

    // chart-filled findings
    const cond = out.conds.join(" | "), L = out.labs, recentTemps = out.temps.filter((x) => now - x.t < 3 * DAY);
    out.tempMax = recentTemps.length ? Math.max(...recentTemps.map((x) => x.v)) : null;
    const A = out.auto;
    if (/malignan|cancer|carcinoma|lymphoma|myeloma|metasta|sarcoma|leuka?emia|neoplasm/i.test(cond)) A.cancer = "cancer on the problem list";
    if (/multiple sclerosis|\bms\b/i.test(cond)) A.knownMS = "MS on the problem list";
    if (/myasthenia/i.test(cond)) A.knownMG = "myasthenia on the problem list";
    if (out.tempMax != null && out.tempMax >= 38) A.fever = `temperature ${out.tempMax} °C in 72 h`;
    if (L.k && L.k.v < 3.0) A.lowK = `K ${L.k.v}`;
    if (L.ck && L.ck.v > 1000) A.highCK = `CK ${L.ck.v}`;
    const meds = out.meds.join(" | ");
    const glu = (out.series.glu || []).filter((x) => now - x.t < 3 * DAY), gluMin = glu.length ? Math.min(...glu.map((x) => x.v)) : null;
    if (gluMin != null && gluMin < 4) A.lowGlu = `glucose ${gluMin} in 72 h`;
    else if (/insulin|glargine|detemir|degludec|lispro|aspart|gliclazide|glyburide|glimepiride/i.test(meds)) A.lowGlu = "on insulin or a sulfonylurea";
    if (/alcohol (use|dependence|abuse|withdrawal)|alcoholism|malnutrition|bariatric|gastric bypass|hyperemesis|anorexia/i.test(cond)) A.etoh = "on the problem list";
    if (/tacrolimus|cyclosporine|mycophenolate|azathioprine|methotrexate|rituximab|cyclophosphamide|prednisone|dexamethasone/i.test(meds) || /transplant|\bhiv\b|neutropen/i.test(cond)) A.immuno = "immunosuppressant or condition";
    if (/pregnan|postpartum|puerper|O[0-9]{2}\b/i.test(cond)) A.preg = "on the problem list";
    if (/estradiol|ethinyl|estrogen|conjugated estrogens|norethindrone acetate.*ethinyl|levonorgestrel.*ethinyl|drospirenone|norgestimate|desogestrel|etonogestrel.*ring|nuvaring|evra|yaz|yasmin|alesse|seasonique|tri-cyclen|premarin|estrace/i.test(meds)) A.estrogen = "estrogen-containing medicine ordered";
    if (/thrombophilia|factor v leiden|prothrombin gene|antiphospholipid|protein [cs] deficiency|antithrombin deficiency|history of (dvt|pe|venous thromb|pulmonary embol)|deep vein thromb|pulmonary embol/i.test(cond)) A.thrombo = "on the problem list";
    if (/tacrolimus|cyclosporine|bevacizumab/i.test(meds) || /pre-?eclampsia|eclampsia|end.stage renal|dialysis|chronic kidney disease.*(stage 5|5)/i.test(cond)) A.presRisk = "drug or condition";
    const sbp = (out.series.sbp || []).filter((x) => now - x.t < DAY), sbpMax = sbp.length ? Math.max(...sbp.map((x) => x.v)) : null;
    if (sbpMax != null && sbpMax >= 180) A.htn = `SBP ${Math.round(sbpMax)} in 24 h`;
    const lastBl = out.bladder[out.bladder.length - 1];
    if (lastBl && lastBl.v > 200 && now - lastBl.t < 3 * DAY) A.retention = `bladder scan ${lastBl.v} mL`;
    out.ageYears = raw.patient && raw.patient.birthDate ? Math.floor((now - new Date(raw.patient.birthDate).getTime()) / (365.25 * DAY)) : null;
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
    const since30 = iso(Date.now() - 30 * DAY), since7 = iso(Date.now() - 7 * DAY);
    const [patient, labs, vit, other, medreqs, admins, conditions] = await Promise.all([
      (async () => { try { return await client.patient.read(); } catch (e) { errors.push("patient: " + (e.message || e)); return null; } })(),
      get(`Observation?patient=${pid}&category=laboratory&date=ge${since30}&_count=100`, "lab results (30 days)", 10),
      get(`Observation?patient=${pid}&category=vital-signs&date=ge${since7}&_count=100`, "vital signs (7 days)", 4),
      get(`Observation?patient=${pid}&category=exam,survey,procedure&date=ge${since7}&_count=100`, "assessments: FVC/NIF, GCS, bladder scans (7 days)", 4),
      get(`MedicationRequest?patient=${pid}&_count=100`, "medication orders", 3),
      get(`MedicationAdministration?patient=${pid}&effective-time=ge${iso(Date.now() - 3 * DAY)}T00:00:00Z&_count=100`, "medications given (3 days)", 3),
      get(`Condition?patient=${pid}&category=problem-list-item&_count=50`, "problem list", 2)]);
    const w = await get(`Observation?patient=${pid}&code=http://loinc.org|29463-7,http://loinc.org|3141-9&_count=20`, "weight", 1);
    return { raw: { patient, obs: labs.concat(vit, other, w), medreqs, admins, conditions }, errors };
  }

  const api = { LABS, parse, gather, label, DAY };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.NeuroChart = api;
})(typeof window !== "undefined" ? window : globalThis);
