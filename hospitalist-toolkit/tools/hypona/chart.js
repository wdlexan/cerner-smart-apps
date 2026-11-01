/* Chart reading for the hyponatremia tab. READ-ONLY. parse() turns raw FHIR resources into plain facts; gather() fetches them.
   Labs are matched by LOINC and then by NAME (codes and patterns UNVERIFIED): a result not found here may still be in the chart. */
(function () {
  const DAY = 864e5;
  const label = (cc) => (cc && (cc.text || (cc.coding || []).map((c) => c.display).find(Boolean))) || "";
  const codes = (cc) => ((cc && cc.coding) || []).map((c) => String(c.code || ""));
  const tOf = (r) => { const d = r.effectiveDateTime || (r.effectivePeriod && r.effectivePeriod.start) || r.issued || r.authoredOn || r.recordedDate || ""; const t = d ? new Date(d).getTime() : NaN; return isNaN(t) ? null : t; };
  const URINE = /urine|\bur\b|\burin|24 ?h(ou)?r/i;
  const OTHER = /csf|fluid|pleural|ascit|peritoneal|stool|sweat|drain/i;
  const GAS = /gas|arterial|venous|whole blood|\bpoc|point of care|i-?stat|\bbg\b|abg|vbg/i;
  const mg = (f) => (v, u) => (/mg\s*\/\s*dl/i.test(u || "") ? v * f : v);

  /* serum / blood tests. sodium handled separately (keeps lab vs blood gas) */
  const SERUM = [
    { id: "glu", label: "Glucose", loinc: ["2345-7", "2339-0", "41653-7", "15074-8", "14749-6"], re: /glucose/i, not: /tolerance|fasting.*plan/i, conv: (v, u) => (/mg\s*\/\s*dl/i.test(u || "") || v > 60 ? v / 18.016 : v), unit: "mmol/L" },
    { id: "urea", label: "Urea", loinc: ["3091-6", "22664-7", "3094-0", "6299-2"], re: /\burea\b|\bbun\b/i, not: /ratio|creatinine/i, conv: mg(1 / 2.8), unit: "mmol/L" },
    { id: "creat", label: "Creatinine", loinc: ["2160-0", "38483-4", "14682-9"], re: /creatinine/i, not: /ratio|kinase|clearance/i, conv: mg(88.4), unit: "umol/L" },
    { id: "k", label: "Potassium", loinc: ["2823-3", "6298-4", "32713-0"], re: /potassium|^k\b/i, unit: "mmol/L" },
    { id: "sosm", label: "Serum osmolality", loinc: ["2692-1", "2693-9"], re: /osmol/i, not: /gap|calc/i, unit: "mOsm/kg" },
    { id: "tsh", label: "TSH", loinc: ["3016-3", "11580-8", "11579-0"], re: /\btsh\b|thyrotropin|thyroid stimulating/i, unit: "mU/L" },
    { id: "cort", label: "Cortisol", loinc: ["2143-6", "9813-7", "2141-0"], re: /cortisol/i, not: /urine|saliva|free/i, conv: (v, u) => (/ug\s*\/\s*dl|mcg\s*\/\s*dl/i.test(u || "") ? v * 27.59 : v), unit: "nmol/L" },
    { id: "uric", label: "Uric acid", loinc: ["3084-1", "14933-6"], re: /uric acid|urate/i, conv: (v, u) => (/mg\s*\/\s*dl/i.test(u || "") ? v * 0.05948 : /umol/i.test(u || "") || v > 5 ? v / 1000 : v), unit: "mmol/L" },
    { id: "tg", label: "Triglycerides", loinc: ["2571-8", "3043-7"], re: /triglycer/i, conv: mg(1 / 88.57), unit: "mmol/L" },
    { id: "prot", label: "Total protein", loinc: ["2885-2"], re: /total protein|protein,? total/i, conv: (v, u) => (/g\s*\/\s*dl/i.test(u || "") ? v * 10 : v), unit: "g/L" },
    { id: "mg", label: "Magnesium", loinc: ["19123-9", "2601-3"], re: /magnesium/i, conv: mg(0.4114), unit: "mmol/L" },
    { id: "phos", label: "Phosphate", loinc: ["2777-1", "14879-1"], re: /phosph/i, not: /alkaline|kinase/i, conv: mg(0.3229), unit: "mmol/L" }];
  const URINE_LABS = [
    { id: "uosm", label: "Urine osmolality", loinc: ["2695-4", "2697-0"], re: /osmol/i, unit: "mOsm/kg" },
    { id: "una", label: "Urine sodium", loinc: ["2955-3", "2956-1"], re: /sodium|\bna\b/i, unit: "mmol/L" },
    { id: "uk", label: "Urine potassium", loinc: ["2829-0", "2828-2"], re: /potassium|\bk\b/i, unit: "mmol/L" },
    { id: "ucr", label: "Urine creatinine", loinc: ["2161-8", "14683-7"], re: /creatinine/i, not: /ratio|clearance/i, unit: "mmol/L" }];
  const NA_LAB = ["2951-2", "2947-0"], NA_GAS = ["32717-1", "39791-9", "41657-8", "39792-7"];

  /* medications by name. culprit: label shown when it may cause hyponatremia */
  const MEDS = [
    ["thiazide", /hydrochlorothiazide|chlorthalidone|indapamide|metolazone|\bhctz\b|chlorothiazide/i, "Thiazide"],
    ["loop", /furosemide|lasix|bumetanide|torsemide/i, ""],
    ["ssri", /citalopram|escitalopram|sertraline|fluoxetine|paroxetine|fluvoxamine|venlafaxine|desvenlafaxine|duloxetine|vortioxetine/i, "SSRI / SNRI"],
    ["tca", /amitriptyline|nortriptyline|imipramine|clomipramine|desipramine|doxepin/i, "Tricyclic antidepressant"],
    ["mirtaz", /mirtazapine|trazodone/i, "Mirtazapine / trazodone (less common)"],
    ["aed", /carbamazepine|oxcarbazepine|eslicarbazepine|valpro|lamotrigine|levetiracetam/i, "Antiepileptic (carbamazepine / oxcarbazepine most often)"],
    ["antipsych", /haloperidol|risperidone|olanzapine|quetiapine|clozapine|aripiprazole|chlorpromazine/i, "Antipsychotic"],
    ["ppi", /pantoprazole|omeprazole|esomeprazole|lansoprazole|rabeprazole|dexlansoprazole/i, "Proton pump inhibitor (rare)"],
    ["opioid", /morphine|hydromorphone|oxycodone|tramadol|fentanyl|methadone|codeine/i, "Opioid"],
    ["nsaid", /ibuprofen|naproxen|diclofenac|ketorolac|celecoxib|indomethacin|meloxicam/i, "NSAID"],
    ["chemo", /cyclophosphamide|vincristine|vinblastine|vinorelbine|cisplatin|carboplatin|ifosfamide|melphalan|methotrexate/i, "Chemotherapy"],
    ["tmp", /trimethoprim|septra|bactrim|co-trimoxazole/i, "Trimethoprim (high dose)"],
    ["amio", /amiodarone/i, "Amiodarone"], ["sulfonylurea", /chlorpropamide/i, "Chlorpropamide"],
    ["oxytocin", /oxytocin/i, "Oxytocin"], ["desmo", /desmopressin|ddavp/i, ""],
    ["tolvaptan", /tolvaptan|jinarc|samsca/i, ""], ["urea", /\burea\b|ure-?na/i, ""], ["steroid", /hydrocortisone|prednisone|prednisolone|methylprednisolone|dexamethasone|fludrocortisone/i, ""],
    ["levo", /levothyroxine|synthroid|eltroxin/i, ""], ["kcl", /potassium chloride|\bkcl\b|k-?dur|slow-?k/i, ""], ["thiamine", /thiamine/i, ""]];
  /* fluids: decide by strength */
  function fluidKind(n) {
    if (!/saline|sodium chloride|nacl|dextrose|d5|d10|ringer|plasma-?lyte|plasmalyte|\bns\b|water for injection/i.test(n)) return "";
    if (/tab|tablet|capsule|\bpo\b|oral/i.test(n) && /sodium chloride|nacl|salt/i.test(n)) return "salttab";
    if (/3\s*%|hypertonic|5\s*%\s*(sodium chloride|nacl|saline)|2\s*%\s*(sodium chloride|nacl|saline)|23\.4/i.test(n)) return "hypertonic";
    if (/0\.45|half|0\.2\s*%|0\.18|1\/2\s*ns|2\/3.*1\/3|d5\s*\/?\s*0\.45|d5w|dextrose 5\s*%\s*(in )?water|d10w|dextrose 10\s*%\s*(in )?water|water for injection/i.test(n)) return "hypotonic";
    if (/0\.9|normal saline|\bns\b|ringer|plasma-?lyte|plasmalyte/i.test(n)) return "isotonic";
    if (/^\s*(dextrose|d5|d10)/i.test(n)) return "hypotonic";
    return "";
  }
  const PROB = {
    hf: /heart failure|I50/i, cirrhosis: /cirrho|K70\.3|K74\.[3-6]|K72|portal hypertens|hepatic failure|ascites|R18/i, ckd: /chronic kidney|N18|end.stage renal|renal failure/i, nephrotic: /nephrotic|N04/i,
    alcohol: /alcohol|F10|K70|beer/i, malnutrition: /malnutrition|E4[0-6]|cachexia|anorexia nervosa|F50\.0|refeeding/i, adrenal: /adrenal insufficiency|addison|E27\.[1-4]|hypopituit|E23\.0/i,
    hypothyroid: /hypothyroid|E03|myxedema/i, lung: /lung cancer|small cell|C34|pneumonia|J1[2-8]|tuberculosis/i, cns: /subarachnoid|meningitis|encephalitis|stroke|I6[0-4]|head injury|traumatic brain|brain tumou?r|S06/i,
    psych: /schizophren|F20|psychogenic polydipsia|R63\.1|polydipsia/i, gi: /vomiting|R11|diarrh|A09|K52|gastroenteritis|bowel obstruction|K56|pancreatitis|K85/i };

  function medText(m) {
    let t = label(m.medicationCodeableConcept) || (m.medicationReference && m.medicationReference.display) || "";
    if (!t && m.medicationReference && m.contained) { const c = m.contained.find((x) => m.medicationReference.reference === "#" + x.id); if (c) t = label(c.code); }
    const di = m.dosageInstruction && m.dosageInstruction[0], d = m.dosage && m.dosage.dose;
    return [t, d && d.value != null ? d.value + " " + (d.unit || "") : "", di && di.text].filter(Boolean).join(" ").trim();
  }

  function parse(raw, opts) {
    const now = (opts && opts.now) || Date.now();
    const f = { sex: "", age: null, na: [], s: {}, u: {}, uo: [], weights: [], heights: [], meds: [], prob: {} };
    SERUM.forEach((d) => (f.s[d.id] = [])); URINE_LABS.forEach((d) => (f.u[d.id] = []));
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
      if (cs.includes("9187-6") || /urine output|output.*urine|urine volume|foley|void/i.test(name)) { f.uo.push({ t, v: q.value }); return; }
      if (cs.some((c) => ["29463-7", "3141-9"].includes(c)) || /body weight|^weight/i.test(name)) { let v = q.value; if (/lb/i.test(u)) v *= 0.4536; if (v >= 25 && v <= 350) f.weights.push({ t, v }); return; }
      if (cs.some((c) => ["8302-2", "8306-3"].includes(c)) || /body height|^height/i.test(name)) { let v = q.value; if (/\bin\b|\[in_i\]|inch/i.test(u)) v *= 2.54; if (v >= 100 && v <= 230) f.heights.push({ t, v }); return; }
      if (OTHER.test(where)) return;
      if (URINE.test(where)) {
        const d = URINE_LABS.find((x) => x.loinc.some((c) => cs.includes(c))) || URINE_LABS.find((x) => x.re.test(name) && !(x.not && x.not.test(name)));
        if (d) { let v = q.value; if (d.id === "ucr" && /umol/i.test(u)) v /= 1000; f.u[d.id].push({ t, v, shown: q.value + " " + u }); }
        return;
      }
      const isNa = cs.some((c) => NA_LAB.concat(NA_GAS).includes(c)) || (/sodium|^na\b|\bna\+?$/i.test(name) && !/fraction|excretion|bicarb|chloride ratio/i.test(name));
      if (isNa) { if (q.value >= 90 && q.value <= 190) f.na.push({ t, v: q.value, src: cs.some((c) => NA_GAS.includes(c)) || GAS.test(where) ? "gas" : "lab", name }); return; }
      const d = SERUM.find((x) => x.loinc.some((c) => cs.includes(c))) || SERUM.find((x) => x.re.test(name) && !(x.not && x.not.test(name)));
      if (d) f.s[d.id].push({ t, v: d.conv ? d.conv(q.value, u) : q.value, shown: q.value + " " + u });
    });
    const srt = (a) => a.sort((x, y) => x.t - y.t);
    srt(f.na); srt(f.uo); srt(f.weights); srt(f.heights); Object.values(f.s).forEach(srt); Object.values(f.u).forEach(srt);

    [].concat(raw.medreqs || [], raw.admins || []).forEach((m) => {
      const isReq = m.resourceType === "MedicationRequest";
      if (isReq && /stopped|cancelled|entered-in-error|completed|draft/.test(m.status || "")) return;
      const name = medText(m), t = tOf(m), cats = MEDS.filter(([, re]) => re.test(name)).map(([id]) => id), fk = fluidKind(name);
      if (fk) cats.push(fk);
      if (!cats.length) return;
      f.meds.push({ name, t, cats, active: isReq && /active|on-hold/.test(m.status || "active"), given: !isReq });
    });
    (raw.conditions || []).forEach((c) => {
      if (c.clinicalStatus && /resolved|inactive|remission/i.test(JSON.stringify(c.clinicalStatus))) return;
      const txt = label(c.code) + " " + codes(c.code).join(" ");
      Object.keys(PROB).forEach((k) => { if (PROB[k].test(txt)) (f.prob[k] = f.prob[k] || []).push(label(c.code) || codes(c.code)[0]); });
    });
    return f;
  }

  const latest = (arr, maxAge, now) => { const e = arr && arr.length ? arr[arr.length - 1] : null; return e && (!maxAge || (now || Date.now()) - e.t <= maxAge) ? e : null; };
  /* drugs ordered now, or given in the past `days` */
  const recent = (f, cat, days, now) => f.meds.filter((m) => m.cats.includes(cat) && (m.active || (m.t && (now || Date.now()) - m.t <= days * DAY)));
  const names = (list) => [...new Set(list.map((m) => m.name.replace(/\s+\d.*$/, "").trim() || m.name))];

  async function gather(client, say) {
    const pid = client.patient.id, errors = [], tell = say || (() => {});
    const iso = (t) => new Date(t).toISOString().slice(0, 10);
    async function get(url, name, pages) {
      const timer = new Promise((_, rej) => setTimeout(() => rej(new Error("timed out after 60 s")), 60000));
      try { const r = (await Promise.race([client.request(url, { pageLimit: pages || 1, flat: true }), timer])).filter((x) => x.resourceType && x.resourceType !== "OperationOutcome"); tell(`Loaded ${name} (${r.length})…`); return r; }
      catch (e) { errors.push(`${name}: ${e.message || e}`); return []; }
    }
    const since90 = iso(Date.now() - 90 * DAY), since14 = iso(Date.now() - 14 * DAY), since3 = iso(Date.now() - 3 * DAY);
    const naCodes = NA_LAB.concat(NA_GAS).map((c) => "http://loinc.org|" + c).join(",");
    const [patient, na, labs, vit, uo, medreqs, admins, conditions] = await Promise.all([
      (async () => { try { return await client.patient.read(); } catch (e) { errors.push("patient: " + (e.message || e)); return null; } })(),
      get(`Observation?patient=${pid}&code=${naCodes}&date=ge${since14}&_count=100`, "sodium (14 days)", 4),
      get(`Observation?patient=${pid}&category=laboratory&date=ge${since90}&_count=100`, "lab results (90 days)", 10),
      get(`Observation?patient=${pid}&code=http://loinc.org|29463-7,http://loinc.org|3141-9,http://loinc.org|8302-2,http://loinc.org|8306-3&_count=50`, "weight and height", 1),
      get(`Observation?patient=${pid}&code=http://loinc.org|9187-6&date=ge${since3}&_count=100`, "urine output (3 days)", 2),
      get(`MedicationRequest?patient=${pid}&_count=100`, "medication orders", 3),
      get(`MedicationAdministration?patient=${pid}&effective-time=ge${since14}&_count=100`, "medications given (14 days)", 4),
      get(`Condition?patient=${pid}&_count=100`, "problem list", 2)]);
    return { raw: { patient, obs: na.concat(labs, vit, uo), medreqs, admins, conditions }, errors };
  }

  window.HypoChart = { SERUM, URINE_LABS, parse, latest, recent, names, fluidKind, gather, DAY };
})();
