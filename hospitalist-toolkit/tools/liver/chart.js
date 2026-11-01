/* Chart reading for the liver tab. READ-ONLY. parse() turns raw FHIR resources into plain facts; gather() fetches them.
   Labs are matched by LOINC and then by NAME; codes and name patterns are UNVERIFIED, so a result not found here may still be in the chart.
   Results are sorted into serum, urine and ascitic fluid by their name. */
(function () {
  const S = window.LiverScores, DAY = 864e5, H = 36e5;
  const label = (cc) => (cc && (cc.text || (cc.coding || []).map((c) => c.display).find(Boolean))) || "";
  const codes = (cc) => ((cc && cc.coding) || []).map((c) => String(c.code || ""));
  const tOf = (r) => { const d = r.effectiveDateTime || (r.effectivePeriod && r.effectivePeriod.start) || r.performedDateTime || (r.performedPeriod && r.performedPeriod.start) || r.issued || r.authoredOn || r.onsetDateTime || r.recordedDate || ""; const t = d ? new Date(d).getTime() : NaN; return isNaN(t) ? null : t; };

  const FLUID = /ascit|peritoneal|paracent|body fluid|\bfluid\b|\bbf\b/i;
  const OTHER_FLUID = /pleural|thoracent|csf|cerebrospinal|synovial|joint|pericard|amniotic|drain/i;
  const URINE = /urine|\bur\b|\burin|\bua\b|24 ?h(ou)?r/i;
  const gL = (v, u) => (/g\s*\/\s*dl/i.test(u || "") || (!u && v < 10) ? v * 10 : /mg\s*\/\s*dl/i.test(u || "") ? v / 100 : v);
  const mmolGlu = (v, u) => (/mg\s*\/\s*dl/i.test(u || "") || v > 40 ? v / 18.016 : v);
  const perUL = (v, u) => (/10\s*[\*\^e]\s*9|10\^9|giga|x ?10e9/i.test(u || "") ? v * 1000 : v);

  /* core five for the scores (first match wins: specific patterns first) */
  const LABS = [
    { id: "bili", label: "Total bilirubin", unit: "umol/L", loinc: ["1975-2", "42719-5", "14631-6"], re: /bilirubin/i, not: /direct|conjugated|indirect|unconjugated|neonatal/i },
    { id: "creat", label: "Creatinine", unit: "umol/L", loinc: ["2160-0", "38483-4", "14682-9"], re: /creatinine/i, not: /ratio|kinase|\bck\b|clearance/i },
    { id: "inr", label: "INR", unit: "", loinc: ["6301-6", "34714-6", "46418-0"], re: /\binr\b|international normali[sz]ed/i, not: /target|goal/i },
    { id: "na", label: "Sodium", unit: "mmol/L", loinc: ["2951-2", "2947-0"], re: /^sodium|\bsodium\b|^na\b/i, not: /fraction|excretion/i },
    { id: "alb", label: "Albumin", unit: "g/L", loinc: ["1751-7", "61151-7", "2862-1"], re: /albumin/i, not: /micro|creatinine|globulin ratio|a\/g/i }
  ];
  /* other serum labs */
  const EXTRA = [
    { id: "plt", label: "Platelets", unit: "x10^9/L", loinc: ["777-3", "26515-7"], re: /platelet/i, not: /volume|mpv|function/i },
    { id: "hgb", label: "Hemoglobin", unit: "g/L", loinc: ["718-7", "20509-6"], re: /hemoglobin|haemoglobin|^hgb\b/i, not: /a1c|glycated|mean corpuscular|mch|plasma free/i, conv: (v, u) => (/g\s*\/\s*dl/i.test(u || "") || v < 25 ? v * 10 : v) },
    { id: "wbc", label: "WBC", unit: "x10^9/L", loinc: ["6690-2", "26464-8"], re: /white blood cell|leukocyte count|^wbc\b/i, not: /urine|esterase/i },
    { id: "k", label: "Potassium", unit: "mmol/L", loinc: ["2823-3", "6298-4"], re: /potassium|^k\b/i },
    { id: "urea", label: "Urea", unit: "mmol/L", loinc: ["3091-6", "22664-7", "3094-0", "6299-2"], re: /\burea\b|\bbun\b/i, not: /ratio|creatinine/i, conv: (v, u) => (/mg\s*\/\s*dl/i.test(u || "") ? v / 2.8 : v) },
    { id: "mg", label: "Magnesium", unit: "mmol/L", loinc: ["19123-9", "2601-3"], re: /magnesium/i, conv: (v, u) => (/mg\s*\/\s*dl/i.test(u || "") ? v * 0.4114 : v) },
    { id: "phos", label: "Phosphate", unit: "mmol/L", loinc: ["2777-1", "14879-1"], re: /phosph/i, not: /alkaline|kinase/i, conv: (v, u) => (/mg\s*\/\s*dl/i.test(u || "") ? v * 0.3229 : v) },
    { id: "ldh", label: "LDH", unit: "U/L", loinc: ["2532-0", "14804-9"], re: /\bldh?\b|lactate dehydrogenase/i }
  ];
  const URINE_LABS = [
    { id: "uprotcr", label: "Urine protein/creatinine", loinc: ["2890-2", "34366-5", "13801-6"], re: /protein.*creat|prot.*cr.*ratio|upcr/i },
    { id: "una", label: "Urine sodium", loinc: ["2955-3", "2956-1"], re: /sodium|\bna\b/i },
    { id: "ucr", label: "Urine creatinine", loinc: ["2161-8", "14683-7"], re: /creatinine/i, not: /ratio|clearance/i },
    { id: "uprot", label: "Urine protein", loinc: ["2888-6", "2887-8", "20454-5"], re: /protein/i },
    { id: "urbc", label: "Urine RBC", loinc: ["13945-1", "30391-7"], re: /\brbc\b|red (blood )?cell|erythrocyte/i }
  ];
  /* ascitic fluid analytes: id, pattern, converter */
  const FLUID_LABS = [
    ["pmnPct", /(neutro|pmn|poly|seg).*%|%.*(neutro|pmn|poly|seg)/i], ["pmn", /neutro|pmn|polymorph|segment/i],
    ["rbc", /\brbc\b|red (blood )?cell|erythrocyte/i], ["wbc", /\bwbc\b|white|nucleated|leuko|cell count/i],
    ["alb", /albumin/i], ["prot", /protein/i], ["glu", /glucose/i], ["ldh", /\bldh?\b|lactate dehydrogenase/i],
    ["culture", /culture/i], ["gram", /gram stain/i], ["cyto", /cytolog/i]];

  /* medication classes (by name) */
  const MEDS = [
    ["warfarin", /warfarin|coumadin/i], ["lactulose", /lactulose/i], ["rifaximin", /rifaximin|zaxine|xifaxan/i],
    ["spironolactone", /spironolactone|aldactone|eplerenone|amiloride/i], ["furosemide", /furosemide|lasix|bumetanide|torsemide|metolazone|hydrochlorothiazide/i],
    ["albumin", /albumin/i], ["nsbb", /propranolol|nadolol|carvedilol/i],
    ["nsaid", /ibuprofen|naproxen|diclofenac|ketorolac|celecoxib|indomethacin|meloxicam|ketoprofen/i], ["aminoglycoside", /gentamicin|tobramycin|amikacin/i],
    ["acearb", /\w+pril\b|\w+sartan\b|entresto|sacubitril/i], ["alpha", /prazosin|terazosin|doxazosin/i], ["contrast", /iohexol|iodixanol|iopamidol|omnipaque|visipaque|isovue|iodinated contrast/i],
    ["terlipressin", /terlipressin/i], ["norepinephrine", /norepinephrine|levophed|noradrenaline/i], ["vasopressor", /vasopressin(?!.*antag)|phenylephrine|\bepinephrine\b|dopamine/i],
    ["midodrine", /midodrine/i], ["octreotide", /octreotide/i], ["thiamine", /thiamine|vitamin b1\b/i],
    ["sbpabx", /ceftriaxone|cefotaxime|ciprofloxacin|sulfamethoxazole|trimethoprim|septra|norfloxacin/i], ["broadabx", /piperacillin|meropenem|imipenem|ertapenem|cefepime|vancomycin(?!.*oral)/i],
    ["doac", /apixaban|eliquis|rivaroxaban|xarelto|dabigatran|pradaxa|edoxaban|lixiana/i], ["lmwh", /enoxaparin|lovenox|dalteparin|fragmin|tinzaparin|innohep/i], ["heparin", /\bheparin\b/i]];
  const DIALYSIS = /dialys|hemodialysis|haemodialysis|\bcrrt\b|\bcvvhd?f?\b|renal replacement/i;
  const CIRRHOSIS = /cirrho|K70\.3|K70\.4|K74\.[3-6]|K72|portal hypertens|K76\.6|esophageal varic|I85|hepatic encephalopath|K76\.82|hepatorenal|K76\.7|ascites|R18|biliary cholangitis|sclerosing cholangitis/i;
  const PROB = { ascites: /ascites|R18|K70\.31|K70\.11|K71\.51/i, cancer: /malignan|cancer|carcinoma|lymphoma|leuk(a)?emia|myeloma|neoplasm|metasta|\bC[0-8]\d(\.\d+)?\b|\bC9[0-7]/i,
    prevvte: /deep vein thromb|\bdvt\b|pulmonary embol|venous thromboembol|\bvte\b|I26|I82\.4|I80\.[12]/i, hfrf: /heart failure|I50|\bcopd\b|J44|respiratory failure|J96/i,
    bleed: /varic\w* (bleed|hemorrhag)|gastrointestinal (bleed|hemorrhag)|upper gi bleed|melena|hematemesis|K92\.[0-2]|I85\.01|I85\.11/i, esrd: /end.stage (renal|kidney)|N18\.6|chronic kidney disease,? stage 5|Z99\.2|dependence on (renal )?dialysis/i, infection: /sepsis|pneumonia|cellulitis|spontaneous bacterial peritonitis|K65\.2|urinary tract infection|A41/i };

  function medText(m) {
    let t = label(m.medicationCodeableConcept) || (m.medicationReference && m.medicationReference.display) || "";
    if (!t && m.medicationReference && m.contained) { const c = m.contained.find((x) => m.medicationReference.reference === "#" + x.id); if (c) t = label(c.code); }
    return t;
  }
  function doseText(m) {
    const d = m.dosage && m.dosage.dose, q = d && d.value != null ? d.value + (d.unit ? " " + d.unit : "") : "";
    const di = m.dosageInstruction && m.dosageInstruction[0];
    return [q, di && di.text].filter(Boolean).join(" ");
  }
  /* daily mg from text like "Spironolactone 100 mg PO BID" */
  function dailyMg(text) {
    const mm = String(text).match(/(\d+(?:\.\d+)?)\s*mg/i); if (!mm) return null;
    const per = /\btid\b|three times|q8h|every 8/i.test(text) ? 3 : /\bbid\b|twice|q12h|every 12/i.test(text) ? 2 : /\bqid\b|four times|q6h/i.test(text) ? 4 : 1;
    return +mm[1] * per;
  }
  /* grams of albumin in one dose: "25 g", or "100 mL" of 25% / 5% */
  function albuminGrams(text) {
    const g = String(text).match(/(\d+(?:\.\d+)?)\s*(g|gram)\b/i); if (g) return +g[1];
    const ml = String(text).match(/(\d+(?:\.\d+)?)\s*ml/i), pct = String(text).match(/(\d+)\s*%/);
    return ml && pct ? (+ml[1] * +pct[1]) / 100 : null;
  }
  /* prophylactic vs therapeutic heparins, by dose text */
  function heparinKind(text) {
    const mg = String(text).match(/(\d+(?:\.\d+)?)\s*mg/i), units = String(text).match(/(\d[\d,]*)\s*(units|unit|iu)\b/i), u = units ? +units[1].replace(/,/g, "") : null;
    if (/enoxaparin|lovenox/i.test(text)) return mg && +mg[1] <= 40 && !/bid|q12|twice/i.test(text) ? "prophylaxis" : mg ? "therapeutic" : "unclear";
    if (/dalteparin|fragmin/i.test(text)) return u ? (u <= 5000 ? "prophylaxis" : "therapeutic") : "unclear";
    if (/tinzaparin|innohep/i.test(text)) return u ? (u <= 4500 ? "prophylaxis" : "therapeutic") : "unclear";
    if (/infusion|drip|\biv\b|intravenous|nomogram|ptt/i.test(text)) return "therapeutic";
    return u && u <= 7500 ? "prophylaxis" : "unclear";
  }

  function parse(raw, opts) {
    const now = (opts && opts.now) || Date.now();
    const f = { sex: "", age: null, labs: {}, extra: {}, urine: {}, taps: [], vitals: [], weights: [], heights: [], meds: {}, medList: [], albumin: [], dialysis: [], problems: [], prob: {} };
    LABS.forEach((d) => (f.labs[d.id] = [])); EXTRA.forEach((d) => (f.extra[d.id] = [])); URINE_LABS.forEach((d) => (f.urine[d.id] = []));
    const p = raw.patient;
    if (p) { f.sex = String(p.gender || "").toLowerCase(); if (p.birthDate) f.age = Math.floor((now - new Date(p.birthDate).getTime()) / (365.25 * DAY)); }

    const seen = new Set(), fluidRows = [];
    (raw.obs || []).forEach((o) => {
      if (!o || o.resourceType !== "Observation" || /entered-in-error|cancelled/.test(o.status || "")) return;
      const t = tOf(o); if (t == null || t > now + DAY) return;
      const name = label(o.code), cs = codes(o.code), q = o.valueQuantity;
      const key = name + "|" + cs.join(",") + "|" + t + "|" + (q ? q.value : o.valueString || ""); if (seen.has(key)) return; seen.add(key);
      const cat = JSON.stringify(o.category || "");
      if (/vital/i.test(cat) || cs.some((c) => ["85354-9", "55284-4", "8480-6", "8462-4", "8478-0", "8867-4", "59408-5", "2708-6", "29463-7", "3141-9", "8302-2", "8306-3", "3137-7"].includes(c))) { vital(f, o, t, name, cs, q); return; }
      const text = o.valueString || (o.valueCodeableConcept && label(o.valueCodeableConcept)) || "";
      const spec = label(o.specimen && o.specimen.display ? { text: o.specimen.display } : null);
      const where = name + " " + spec;
      if (FLUID.test(where) && !OTHER_FLUID.test(where) && !URINE.test(where)) { fluidRows.push({ t, name, q, text, site: /ascit|peritoneal|paracent/i.test(where) ? "ascitic" : "unspecified" }); return; }
      if (OTHER_FLUID.test(where)) return;
      if (URINE.test(where)) {
        if (!q || typeof q.value !== "number") return;
        const d = URINE_LABS.find((x) => x.loinc.some((c) => cs.includes(c))) || URINE_LABS.find((x) => x.re.test(name) && !(x.not && x.not.test(name)));
        if (d) f.urine[d.id].push({ t, v: q.value, unit: q.unit || "", shown: q.value + (q.unit ? " " + q.unit : "") });
        return;
      }
      if (!q || typeof q.value !== "number") return;
      const core = LABS.find((x) => x.loinc.some((c) => cs.includes(c))) || LABS.find((x) => x.re.test(name) && !x.not.test(name));
      if (core) { f.labs[core.id].push({ t, v: S.toSI[core.id](q.value, q.unit || ""), shown: q.value + (q.unit ? " " + q.unit : ""), name }); return; }
      const ex = EXTRA.find((x) => x.loinc.some((c) => cs.includes(c))) || EXTRA.find((x) => x.re.test(name) && !(x.not && x.not.test(name)));
      if (ex) {
        const rr = o.referenceRange && o.referenceRange[0], hi = rr && rr.high && typeof rr.high.value === "number" ? rr.high.value : null;
        f.extra[ex.id].push({ t, v: ex.conv ? ex.conv(q.value, q.unit || "") : q.value, shown: q.value + (q.unit ? " " + q.unit : ""), hi });
      }
    });
    LABS.forEach((d) => f.labs[d.id].sort((a, b) => a.t - b.t)); EXTRA.forEach((d) => f.extra[d.id].sort((a, b) => a.t - b.t)); URINE_LABS.forEach((d) => f.urine[d.id].sort((a, b) => a.t - b.t));
    f.vitals.sort((a, b) => a.t - b.t); f.weights.sort((a, b) => a.t - b.t); f.heights.sort((a, b) => a.t - b.t);

    // group fluid results drawn within 6 h of each other into one paracentesis
    fluidRows.sort((a, b) => a.t - b.t).forEach((row) => {
      let tap = f.taps.find((x) => Math.abs(x.t - row.t) <= 6 * H);
      if (!tap) { tap = { t: row.t, site: row.site, src: "chart", names: [] }; f.taps.push(tap); }
      if (row.site === "ascitic") tap.site = "ascitic";
      const hit = FLUID_LABS.find(([, re]) => re.test(row.name)); if (!hit) return;
      const id = hit[0], q = row.q, u = q ? q.unit || "" : "";
      tap.names.push(row.name);
      if (["culture", "gram", "cyto"].includes(id)) { tap[id] = [tap[id], row.text || (q ? q.value + " " + u : "")].filter(Boolean).join("; "); return; }
      if (!q || typeof q.value !== "number") return;
      let v = q.value;
      if (id === "pmn" && /%/.test(u)) { tap.pmnPct = v; return; }
      if (id === "pmnPct") { tap.pmnPct = v; return; }
      if (["wbc", "pmn", "rbc"].includes(id)) v = perUL(v, u);
      if (id === "alb" || id === "prot") v = gL(v, u);
      if (id === "glu") v = mmolGlu(v, u);
      tap[id] = v;
    });
    f.taps.sort((a, b) => b.t - a.t);

    // medications: active orders, plus administrations
    [].concat(raw.medreqs || [], raw.admins || []).forEach((m) => {
      const name = medText(m), dose = doseText(m), full = (name + " " + dose).trim(), t = tOf(m);
      const isReq = m.resourceType === "MedicationRequest";
      if (isReq && /stopped|cancelled|entered-in-error|completed|draft/.test(m.status || "")) return;
      const cats = MEDS.filter(([, re]) => re.test(name)).map(([id]) => id);
      if (!cats.length) return;
      const rec = { name: full, t, active: isReq && /active|on-hold/.test(m.status || "active"), given: !isReq, cats };
      f.medList.push(rec);
      cats.forEach((id) => { const e = f.meds[id] || (f.meds[id] = { name: full, t, active: false, lastGiven: null }); if (rec.active) e.active = true; if (rec.given && t && (!e.lastGiven || t > e.lastGiven)) e.lastGiven = t; if (t && (!e.t || t > e.t)) { e.t = t; e.name = full; } });
      if (cats.includes("albumin") && !isReq && t) f.albumin.push({ t, g: albuminGrams(full), name: full });
    });
    f.albumin.sort((a, b) => a.t - b.t);

    (raw.procs || []).forEach((pr) => { const t = tOf(pr), n = label(pr.code); if (t && DIALYSIS.test(n) && now - t <= 7 * DAY) f.dialysis.push({ t, n }); });
    (raw.conditions || []).forEach((c) => {
      if (c.clinicalStatus && /resolved|inactive|remission/i.test(JSON.stringify(c.clinicalStatus))) return;
      const txt = label(c.code) + " " + codes(c.code).join(" ");
      if (CIRRHOSIS.test(txt)) f.problems.push(label(c.code) || codes(c.code)[0]);
      Object.keys(PROB).forEach((k) => { if (PROB[k].test(txt)) (f.prob[k] = f.prob[k] || []).push(label(c.code) || codes(c.code)[0]); });
    });
    return f;
  }

  function vital(f, o, t, name, cs, q) {
    const num = (x) => (x && typeof x.value === "number" ? x.value : null);
    const comp = (re, code) => { const c = (o.component || []).find((x) => codes(x.code).includes(code) || re.test(label(x.code))); return c ? num(c.valueQuantity) : null; };
    let sbp = comp(/systolic/i, "8480-6"), dbp = comp(/diastolic/i, "8462-4");
    if (sbp == null && (cs.includes("8480-6") || /systolic/i.test(name))) sbp = num(q);
    if (dbp == null && (cs.includes("8462-4") || /diastolic/i.test(name))) dbp = num(q);
    const row = {};
    if (sbp != null) row.sbp = sbp; if (dbp != null) row.dbp = dbp;
    if (cs.includes("8478-0") || /mean arterial|\bmap\b/i.test(name)) row.map = num(q);
    if (cs.includes("8867-4") || /heart rate|pulse rate/i.test(name)) row.hr = num(q);
    if (cs.some((c) => ["59408-5", "2708-6"].includes(c)) || /spo2|oxygen saturation|pulse ox/i.test(name)) row.spo2 = num(q);
    if (cs.some((c) => ["29463-7", "3141-9"].includes(c)) || /body weight|^weight/i.test(name)) { let v = num(q); const u = (q && q.unit) || ""; if (v != null) { if (/lb/i.test(u)) v *= 0.45359237; else if (/^g$/i.test(u)) v /= 1000; if (v >= 25 && v <= 350) f.weights.push({ t, v }); } return; }
    if (cs.some((c) => ["8302-2", "8306-3", "3137-7"].includes(c)) || /body height|^height/i.test(name)) { let v = num(q); const u = (q && q.unit) || ""; if (v != null) { if (/\bin\b|\[in_i\]|inch/i.test(u)) v *= 2.54; else if (/^m$/i.test(u)) v *= 100; if (v >= 100 && v <= 230) f.heights.push({ t, v }); } return; }
    if (!Object.keys(row).length) return;
    const same = f.vitals.find((x) => Math.abs(x.t - t) < 6e4);
    if (same) Object.assign(same, row); else f.vitals.push(Object.assign({ t }, row));
  }

  /* Latest value of each core lab at or before time t (within maxAge). */
  function at(f, t, maxAge) {
    const out = {};
    LABS.forEach((d) => { const arr = f.labs[d.id]; for (let i = arr.length - 1; i >= 0; i--) if (arr[i].t <= t) { if (t - arr[i].t <= maxAge) out[d.id] = arr[i]; break; } });
    return out;
  }
  const latest = (arr, maxAge, now) => { const e = arr && arr.length ? arr[arr.length - 1] : null; return e && (!maxAge || (now || Date.now()) - e.t <= maxAge) ? e : null; };

  async function gather(client, say) {
    const pid = client.patient.id, errors = [], tell = say || (() => {});
    const iso = (t) => new Date(t).toISOString().slice(0, 10);
    async function get(url, name, pages) {
      const timer = new Promise((_, rej) => setTimeout(() => rej(new Error("timed out after 60 s")), 60000));
      try { const r = (await Promise.race([client.request(url, { pageLimit: pages || 1, flat: true }), timer])).filter((x) => x.resourceType && x.resourceType !== "OperationOutcome"); tell(`Loaded ${name} (${r.length})…`); return r; }
      catch (e) { errors.push(`${name}: ${e.message || e}`); return []; }
    }
    const since = iso(Date.now() - 365 * DAY), since30 = iso(Date.now() - 30 * DAY), since7 = iso(Date.now() - 7 * DAY);
    const loincs = [].concat(...LABS.map((d) => d.loinc)).map((c) => "http://loinc.org|" + c).join(",");
    const [patient, byCode, byCat, vitals, medreqs, admins, procs, conditions] = await Promise.all([
      (async () => { try { return await client.patient.read(); } catch (e) { errors.push("patient: " + (e.message || e)); return null; } })(),
      get(`Observation?patient=${pid}&code=${loincs}&date=ge${since}&_count=100`, "liver labs by code (1 year)", 6),
      get(`Observation?patient=${pid}&category=laboratory&date=ge${since}&_count=100`, "all lab results (1 year)", 10),
      get(`Observation?patient=${pid}&category=vital-signs&date=ge${since7}&_count=100`, "vital signs (7 days)", 6),
      get(`MedicationRequest?patient=${pid}&_count=100`, "medication orders", 3),
      get(`MedicationAdministration?patient=${pid}&effective-time=ge${since30}&_count=100`, "medications given (30 days)", 4),
      get(`Procedure?patient=${pid}&date=ge${since30}&_count=100`, "procedures (30 days)", 2),
      get(`Condition?patient=${pid}&_count=100`, "problem list", 2)
    ]);
    // weight and height can be older than 7 days
    const wh = await get(`Observation?patient=${pid}&code=http://loinc.org|29463-7,http://loinc.org|3141-9,http://loinc.org|8302-2,http://loinc.org|8306-3&_count=50`, "weight and height", 1);
    return { raw: { patient, obs: byCode.concat(byCat, vitals, wh), medreqs, admins, procs, conditions }, errors };
  }

  window.LiverChart = { LABS, EXTRA, URINE_LABS, parse, at, latest, gather, dailyMg, heparinKind, albuminGrams, DAY };
})();
