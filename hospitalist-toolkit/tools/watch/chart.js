/* Chart reading for the Watch-ahead app. READ-ONLY. parseChart() turns raw FHIR resources into a plain "facts" object; gather() fetches them
   with a SMART client. Nothing is sent anywhere. Implausible values are ignored and listed. Medication matching is by NAME only. */
(function () {
  const lc = (s) => String(s == null ? "" : s).toLowerCase();
  const label = (cc) => (cc && (cc.text || (cc.coding || []).map((c) => c.display).find(Boolean))) || "";
  const codes = (cc) => ((cc && cc.coding) || []).map((c) => String(c.code || ""));
  const dtOf = (r) => r.effectiveDateTime || (r.effectivePeriod && r.effectivePeriod.start) || r.issued || r.recordedDate || r.authoredOn || "";
  const day = (d) => (d ? String(d).slice(0, 10) : "");
  const qty = (o) => (o.valueQuantity && typeof o.valueQuantity.value === "number" ? o.valueQuantity : null);
  const NOT_BLOOD = /urine|\bur\b|csf|stool|fluid|a1c|clearance|ratio|random urine/i;

  /* Standard units used by the app: BP mmHg, HR/RR per min, temp C, SpO2 %, K/Na/glucose/lactate mmol/L, creatinine umol/L, Hgb g/L, WBC/platelets x10^9/L.
     conv() converts common alternative units. range = plausible limits (outside = ignored and reported). staleHours = older than this is not used by default. */
  const DEFS = {
    sbp:   { name: "Systolic BP", unit: "mmHg", range: [40, 280], stale: 72, loinc: ["8480-6"], re: /systolic/i },
    hr:    { name: "Heart rate", unit: "/min", range: [20, 240], stale: 72, loinc: ["8867-4"], re: /heart rate|pulse/i },
    rr:    { name: "Resp rate", unit: "/min", range: [4, 70], stale: 72, loinc: ["9279-1"], re: /respiratory rate|resp rate/i },
    temp:  { name: "Temperature", unit: "C", range: [30, 43], stale: 72, loinc: ["8310-5", "8331-1"], re: /body temperature|^temp/i,
             conv: (v, u) => (/f/i.test(u || "") || v > 50 ? Math.round(((v - 32) * 5) / 9 * 10) / 10 : v) },
    spo2:  { name: "SpO2", unit: "%", range: [50, 100], stale: 72, loinc: ["59408-5", "2708-6"], re: /oxygen saturation|spo2/i },
    k:     { name: "Potassium", unit: "mmol/L", range: [1.5, 9], stale: 168, loinc: ["2823-3", "6298-4"], re: /potassium/i },
    na:    { name: "Sodium", unit: "mmol/L", range: [100, 180], stale: 168, loinc: ["2951-2", "2947-0"], re: /sodium/i },
    creat: { name: "Creatinine", unit: "umol/L", range: [15, 2500], stale: 168, loinc: ["2160-0", "38483-4", "14682-9"], re: /creatinine/i,
             conv: (v, u) => (/mg\/dl/i.test(u || "") ? Math.round(v * 88.4) : v) },
    egfr:  { name: "eGFR", unit: "mL/min", range: [1, 200], stale: 168, loinc: ["33914-3", "62238-1", "48642-3", "48643-1", "77147-7", "98979-8", "50044-7", "69405-9"], re: /egfr|glomerular filtration/i },
    hgb:   { name: "Hemoglobin", unit: "g/L", range: [30, 220], stale: 168, loinc: ["718-7", "20509-6", "59260-0"], re: /hemoglobin|haemoglobin/i,
             conv: (v, u) => (/g\/dl/i.test(u || "") || v < 25 ? Math.round(v * 10) : v) },
    wbc:   { name: "WBC", unit: "x10^9/L", range: [0.1, 400], stale: 168, loinc: ["6690-2", "26464-8"], re: /white blood cell|leukocyte|\bwbc\b/i },
    plt:   { name: "Platelets", unit: "x10^9/L", range: [5, 2000], stale: 168, loinc: ["777-3", "26515-7"], re: /platelet/i },
    glucose: { name: "Glucose", unit: "mmol/L", range: [0.5, 80], stale: 72, loinc: ["2345-7", "2339-0", "14743-9", "41653-7"], re: /glucose/i,
             conv: (v, u) => (/mg\/dl/i.test(u || "") || v > 80 ? Math.round((v / 18.016) * 10) / 10 : v) },
    inr:   { name: "INR", unit: "", range: [0.5, 20], stale: 168, loinc: ["6301-6", "34714-6"], re: /\binr\b|international normalized/i },
    lactate: { name: "Lactate", unit: "mmol/L", range: [0.2, 30], stale: 72, loinc: ["2524-7", "32693-4"], re: /lactate|lactic/i }
  };

  /* Drug classes: lower-case name fragments. Matching is by name only; "not found" does not prove the patient is not taking a drug. UNVERIFIED lists. */
  const CLASSES = {
    anticoag: ["apixaban", "eliquis", "rivaroxaban", "xarelto", "dabigatran", "pradaxa", "edoxaban", "lixiana", "warfarin", "coumadin", "enoxaparin", "lovenox", "dalteparin", "fragmin", "tinzaparin", "heparin"],
    antiplatelet: ["aspirin", "asa ", "acetylsalicylic", "clopidogrel", "plavix", "ticagrelor", "brilinta", "prasugrel"],
    nsaid: ["ibuprofen", "advil", "naproxen", "aleve", "diclofenac", "ketorolac", "celecoxib", "indomethacin", "meloxicam", "etodolac", "nabumetone"],
    acei: ["ramipril", "enalapril", "lisinopril", "perindopril", "captopril", "trandolapril", "quinapril", "fosinopril", "benazepril", "cilazapril"],
    arb: ["candesartan", "valsartan", "losartan", "irbesartan", "telmisartan", "olmesartan", "azilsartan", "sacubitril", "entresto"],
    mra: ["spironolactone", "eplerenone", "finerenone", "amiloride", "triamterene"],
    kSupp: ["potassium chloride", "slow-k", "k-dur", "klor-con", "k-lyte"],
    trimeth: ["trimethoprim", "septra", "bactrim", "cotrimoxazole"],
    loop: ["furosemide", "lasix", "bumetanide", "torsemide"],
    thiazide: ["hydrochlorothiazide", "hctz", "chlorthalidone", "indapamide", "metolazone"],
    antihtn: ["amlodipine", "nifedipine", "diltiazem", "verapamil", "metoprolol", "bisoprolol", "carvedilol", "atenolol", "labetalol", "hydralazine", "nitroglycerin", "isosorbide", "prazosin", "doxazosin", "terazosin", "clonidine"],
    opioid: ["morphine", "hydromorphone", "dilaudid", "oxycodone", "percocet", "fentanyl", "codeine", "tramadol", "methadone", "tapentadol", "hydrocodone"],
    benzo: ["lorazepam", "ativan", "diazepam", "clonazepam", "alprazolam", "temazepam", "oxazepam", "midazolam"],
    zdrug: ["zopiclone", "imovane", "zolpidem", "eszopiclone"],
    anticholinergic: ["diphenhydramine", "benadryl", "dimenhydrinate", "gravol", "amitriptyline", "oxybutynin", "hydroxyzine", "paroxetine", "tolterodine", "solifenacin", "cyclobenzaprine", "promethazine", "doxepin"],
    antipsychotic: ["quetiapine", "seroquel", "olanzapine", "haloperidol", "risperidone", "aripiprazole", "chlorpromazine", "loxapine"],
    qt: ["haloperidol", "ondansetron", "zofran", "azithromycin", "clarithromycin", "levofloxacin", "ciprofloxacin", "moxifloxacin", "methadone", "citalopram", "escitalopram", "quetiapine", "amiodarone", "sotalol", "fluconazole", "domperidone", "hydroxychloroquine", "donepezil", "trazodone", "risperidone", "olanzapine", "chlorpromazine"],
    steroid: ["prednisone", "prednisolone", "dexamethasone", "hydrocortisone", "methylprednisolone", "solu-medrol", "solu-cortef"],
    insulin: ["insulin", "lantus", "humalog", "novorapid", "tresiba", "levemir", "toujeo", "humulin", "novolin"],
    sulfonylurea: ["glyburide", "gliclazide", "diamicron", "glimepiride", "glipizide"],
    metformin: ["metformin", "glucophage"],
    sglt2: ["dapagliflozin", "empagliflozin", "canagliflozin", "forxiga", "jardiance", "invokana"],
    digoxin: ["digoxin", "lanoxin"],
    lithium: ["lithium"],
    gabapentinoid: ["gabapentin", "pregabalin", "lyrica", "neurontin"],
    nephrotoxicAbx: ["vancomycin", "gentamicin", "tobramycin", "amikacin"],
    betaLactam: ["penicillin", "amoxicillin", "ampicillin", "piperacillin", "tazobactam", "cefazolin", "ceftriaxone", "cephalexin", "cefuroxime", "cefixime", "cefotaxime", "ceftazidime", "cefepime", "meropenem", "ertapenem", "imipenem", "cloxacillin", "augmentin", "clavulanate"],
    antibiotic: ["cillin", "cef", "ceph", "penem", "floxacin", "mycin", "cycline", "metronidazole", "vancomycin", "trimethoprim", "sulfameth", "nitrofurantoin", "linezolid", "clindamycin", "tazobactam"]
  };

  function medText(m) {
    let t = label(m.medicationCodeableConcept) || (m.medicationReference && m.medicationReference.display) || "";
    if (!t && m.medicationReference && m.contained) { const c = m.contained.find((x) => m.medicationReference.reference === "#" + x.id); if (c) t = label(c.code); }
    return t;
  }
  function classifyMeds(meds) {
    const classes = {}, names = [];
    meds.forEach((m) => {
      if (m.status && !/active/i.test(m.status)) return;
      const name = medText(m), s = " " + lc(name) + " "; if (!name) return; names.push(name);
      Object.keys(CLASSES).forEach((k) => { if (k === "antibiotic") return; const hit = CLASSES[k].find((x) => s.includes(x)); if (hit && !(classes[k] || []).includes(name)) (classes[k] = classes[k] || []).push(name); });
      if (CLASSES.antibiotic.some((x) => s.includes(x))) (classes.antibiotic = classes.antibiotic || []).push(name);
    });
    return { classes, names };
  }

  function valueOf(o, def) {
    const comp = (o.component || []).find((c) => def.loinc.some((l) => codes(c.code).includes(l)) || def.re.test(label(c.code)));
    const q = comp && comp.valueQuantity && typeof comp.valueQuantity.value === "number" ? comp.valueQuantity : qty(o);
    return q;
  }
  function parseChart(raw, opts) {
    opts = opts || {};
    const now = opts.now ? new Date(opts.now).getTime() : Date.now();
    const f = { age: null, sex: "", conditions: [], allergies: [], meds: {}, medNames: [], values: {}, series: {}, source: {}, stale: {}, notes: [], useOld: !!opts.useOld };
    // demographics
    const p = raw.patient;
    if (p) {
      f.sex = lc(p.gender);
      if (p.birthDate) { const b = new Date(p.birthDate); if (!isNaN(b)) f.age = Math.floor((now - b.getTime()) / (365.25 * 864e5)); }
    }
    f.conditions = (raw.conds || []).filter((c) => !c.clinicalStatus || /active|recurrence|relapse/i.test(label(c.clinicalStatus) + (c.clinicalStatus.coding || []).map((x) => x.code).join(" "))).map((c) => label(c.code)).filter(Boolean);
    f.allergies = (raw.allergies || []).filter((a) => !a.clinicalStatus || !/inactive|resolved/i.test((a.clinicalStatus.coding || []).map((x) => x.code).join(" "))).map((a) => ({
      text: label(a.code), reaction: ((a.reaction || []).map((r) => (r.manifestation || []).map(label).join(", ")).filter(Boolean).join("; ")), severity: (a.criticality || "") })).filter((a) => a.text);
    const cm = classifyMeds(raw.meds || []); f.meds = cm.classes; f.medNames = cm.names;
    // observations
    const obs = (raw.obs || []).filter((o) => o && o.resourceType === "Observation");
    Object.keys(DEFS).forEach((key) => {
      const d = DEFS[key], list = [];
      obs.forEach((o) => {
        const lab = label(o.code);
        const isMatch = d.loinc.some((l) => codes(o.code).includes(l)) || (d.re.test(lab) && !NOT_BLOOD.test(lab)) || (o.component || []).some((c) => d.loinc.some((l) => codes(c.code).includes(l)));
        if (!isMatch) return;
        if (key === "sbp" && !(codes(o.code).includes("8480-6") || /systolic/i.test(lab) || (o.component || []).some((c) => codes(c.code).includes("8480-6") || /systolic/i.test(label(c.code))))) return;
        const q = valueOf(o, d); if (!q) return;
        let v = d.conv ? d.conv(q.value, q.unit) : q.value;
        const date = dtOf(o), t = date ? new Date(date).getTime() : NaN;
        if (v < d.range[0] || v > d.range[1]) { f.notes.push(`Ignored ${d.name} ${q.value}${q.unit ? " " + q.unit : ""} (${day(date) || "no date"}): outside a plausible range.`); return; }
        list.push({ v, t: isNaN(t) ? 0 : t, date: day(date), raw: q });
      });
      list.sort((a, b) => b.t - a.t);
      const seen = new Set(), uniq = list.filter((x) => { const k = x.t + "|" + x.v; if (seen.has(k)) return false; seen.add(k); return true; });
      if (!uniq.length) return;
      f.series[key] = uniq;
      const top = uniq[0], ageH = top.t ? (now - top.t) / 36e5 : Infinity;
      f.values[key] = top.v;
      f.source[key] = `${top.v}${d.unit ? " " + d.unit : ""}, ${top.date || "no date"}`;
      if (ageH > d.stale) { f.stale[key] = true; }
    });
    const staleKeys = Object.keys(f.stale);
    if (staleKeys.length && !f.useOld) f.notes.push("Older than the usual window, so not used for warnings: " + staleKeys.map((k) => `${DEFS[k].name} (${f.source[k]})`).join("; ") + ". Tick “Include older values” to use them.");
    return f;
  }

  /* gather: read-only FHIR searches. Each one is allowed to fail on its own (e.g. a scope not enabled) and the failure is reported. */
  const iso = (d) => new Date(d).toISOString().slice(0, 10);
  async function gather(client, setStatus) {
    const pid = client.patient.id, errors = [], say = setStatus || (() => {});
    async function get(url, name, pages) {
      const t = new Promise((_, rej) => setTimeout(() => rej(new Error("timed out after 60 s")), 60000));
      try { const r = (await Promise.race([client.request(url, { pageLimit: pages || 1, flat: true }), t])).filter((x) => x.resourceType && x.resourceType !== "OperationOutcome"); say(`Loaded ${name} (${r.length})…`); return r; }
      catch (e) { errors.push(`${name}: ${e.message || e}`); return []; }
    }
    const since = iso(Date.now() - 30 * 864e5), L = (arr) => arr.map((c) => "http://loinc.org|" + c).join(",");
    const group = (keys) => keys.reduce((a, k) => a.concat(DEFS[k].loinc), []);
    const [patient, meds, allergies, conds, vitals, labs, renal, lytes, heme, other] = await Promise.all([
      (async () => { try { return await client.patient.read(); } catch (e) { errors.push("patient: " + (e.message || e)); return null; } })(),
      get(`MedicationRequest?patient=${pid}&status=active&_count=50`, "medications", 3),
      get(`AllergyIntolerance?patient=${pid}&_count=50`, "allergies"),
      get(`Condition?patient=${pid}&category=problem-list-item&clinical-status=active&_count=50`, "problem list"),
      get(`Observation?patient=${pid}&category=vital-signs&date=ge${since}&_count=50`, "vital signs (last 30 days)"),
      get(`Observation?patient=${pid}&category=laboratory&_count=50`, "laboratory results", 2),
      get(`Observation?patient=${pid}&code=${L(group(["creat", "egfr"]))}&_count=30`, "creatinine and eGFR"),
      get(`Observation?patient=${pid}&code=${L(group(["k", "na"]))}&_count=20`, "potassium and sodium"),
      get(`Observation?patient=${pid}&code=${L(group(["hgb", "wbc", "plt"]))}&_count=30`, "blood counts"),
      get(`Observation?patient=${pid}&code=${L(group(["glucose", "inr", "lactate"]))}&_count=30`, "glucose, INR, lactate")
    ]);
    const seen = new Set(), all = vitals.concat(labs, renal, lytes, heme, other).filter((o) => { const i = o.id || Math.random(); if (seen.has(i)) return false; seen.add(i); return true; });
    return { raw: { patient, meds, allergies, conds, obs: all }, errors };
  }
  window.WAChart = { parseChart, gather, classifyMeds, DEFS, CLASSES };
})();
