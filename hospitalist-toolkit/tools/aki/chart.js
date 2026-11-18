/* Chart reading for the AKI tab. READ-ONLY. parse() turns raw FHIR resources into plain facts; gather() fetches them.
   Tests are matched by LOINC and then by NAME (codes and patterns UNVERIFIED): a result not found here may still be in the chart. */
(function () {
  const DAY = 864e5;
  const label = (cc) => (cc && (cc.text || (cc.coding || []).map((c) => c.display).find(Boolean))) || "";
  const codes = (cc) => ((cc && cc.coding) || []).map((c) => String(c.code || ""));
  const tOf = (r) => { const d = r.effectiveDateTime || (r.effectivePeriod && r.effectivePeriod.start) || r.issued || r.authoredOn || r.recordedDate || ""; const t = d ? new Date(d).getTime() : NaN; return isNaN(t) ? null : t; };
  const URINE = /urine|\bur\b|\burin|\bua\b|urinalysis|24 ?h(ou)?r/i;
  const OTHER = /csf|fluid|pleural|ascit|peritoneal|stool|sweat|drain/i;
  const GAS = /gas|arterial|venous|whole blood|\bpoc|point of care|i-?stat|abg|vbg/i;
  const mg = (f) => (v, u) => (/mg\s*\/\s*dl/i.test(u || "") ? v * f : v);

  const SERUM = [
    { id: "creat", label: "Creatinine", loinc: ["2160-0", "38483-4", "14682-9"], re: /creatinine/i, not: /ratio|kinase|clearance|egfr|gfr/i, conv: (v, u) => (/mg\s*\/\s*dl/i.test(u || "") || v < 20 ? v * 88.4 : v), unit: "umol/L" },
    { id: "urea", label: "Urea", loinc: ["3091-6", "22664-7", "3094-0", "6299-2"], re: /\burea\b|\bbun\b/i, not: /ratio|creatinine|breath/i, conv: mg(1 / 2.8), unit: "mmol/L" },
    { id: "na", label: "Sodium", loinc: ["2951-2", "2947-0"], re: /^sodium|\bsodium\b/i, not: /fraction|excretion|bicarb/i, unit: "mmol/L" },
    { id: "k", label: "Potassium", loinc: ["2823-3", "6298-4", "32713-0"], re: /potassium/i, unit: "mmol/L" },
    { id: "hco3", label: "Bicarbonate", loinc: ["1963-8", "2028-9", "1959-6", "14627-4"], re: /bicarb|total co2|\bco2\b|\bhco3/i, not: /pco2|partial/i, unit: "mmol/L" },
    { id: "ph", label: "pH (blood gas)", loinc: ["2744-1", "2746-6", "11558-4"], re: /^ph\b|\bph,? (arterial|venous|blood)/i, not: /urine/i, unit: "" },
    { id: "ck", label: "CK", loinc: ["2157-6"], re: /creatine kinase|\bck\b|\bcpk\b/i, not: /mb|isoenz/i, unit: "U/L" },
    { id: "ca", label: "Calcium", loinc: ["17861-6", "2000-8"], re: /^calcium|calcium,? (total|serum)/i, not: /ionized|urine|ratio/i, conv: mg(0.2495), unit: "mmol/L" },
    { id: "phos", label: "Phosphate", loinc: ["2777-1", "14879-1"], re: /phosph/i, not: /alkaline|kinase/i, conv: mg(0.3229), unit: "mmol/L" },
    { id: "alb", label: "Albumin", loinc: ["1751-7", "61151-7"], re: /^albumin|albumin,? serum/i, not: /urine|ratio|globulin|micro/i, conv: (v, u) => (/g\s*\/\s*dl/i.test(u || "") ? v * 10 : v), unit: "g/L" },
    { id: "prot", label: "Total protein", loinc: ["2885-2"], re: /total protein|protein,? total/i, not: /urine/i, conv: (v, u) => (/g\s*\/\s*dl/i.test(u || "") ? v * 10 : v), unit: "g/L" },
    { id: "urate", label: "Uric acid", loinc: ["3084-1", "14933-6"], re: /uric acid|urate/i, conv: (v, u) => (/mg\s*\/\s*dl/i.test(u || "") ? v * 0.05948 : /umol/i.test(u || "") || v > 5 ? v / 1000 : v), unit: "mmol/L" },
    { id: "ldh", label: "LDH", loinc: ["2532-0", "14804-9"], re: /\bldh\b|lactate dehydrogenase/i, unit: "U/L" },
    { id: "hb", label: "Hemoglobin", loinc: ["718-7", "20509-6"], re: /hemoglobin|haemoglobin|^hgb\b|^hb\b/i, not: /a1c|glyc|mean|mch/i, conv: (v, u) => (/g\s*\/\s*dl/i.test(u || "") || v < 25 ? v * 10 : v), unit: "g/L" },
    { id: "plt", label: "Platelets", loinc: ["777-3", "26515-7"], re: /platelet/i, not: /mean|volume|mpv/i, unit: "×10⁹/L" },
    { id: "eos", label: "Eosinophils", loinc: ["711-2", "26449-9"], re: /eosinophil/i, not: /%|percent|urine/i, conv: (v) => (v > 50 ? v / 1000 : v), unit: "×10⁹/L" },
    { id: "lith", label: "Lithium", loinc: ["14334-7", "3719-2"], re: /lithium/i, unit: "mmol/L" },
    { id: "c3", label: "C3", loinc: ["4485-9"], re: /\bc3\b|complement c3/i, conv: (v, u) => (/mg\s*\/\s*dl/i.test(u || "") ? v / 100 : v), unit: "g/L" },
    { id: "c4", label: "C4", loinc: ["4498-2"], re: /\bc4\b|complement c4/i, conv: (v, u) => (/mg\s*\/\s*dl/i.test(u || "") ? v / 100 : v), unit: "g/L" },
    { id: "vanc", label: "Vancomycin level", loinc: ["4092-3", "20578-1", "4090-7"], re: /vancomycin/i, unit: "mg/L" },
    { id: "genta", label: "Aminoglycoside level", loinc: ["35668-3", "3663-2", "4033-7"], re: /gentamicin|tobramycin|amikacin/i, unit: "mg/L" }];
  const URINE_LABS = [
    { id: "una", label: "Urine sodium", loinc: ["2955-3", "2956-1"], re: /sodium|\bna\b/i, unit: "mmol/L" },
    { id: "ucr", label: "Urine creatinine", loinc: ["2161-8", "14683-7"], re: /creatinine/i, not: /ratio|clearance/i, unit: "mmol/L" },
    { id: "uurea", label: "Urine urea", loinc: ["3095-7", "22700-9"], re: /\burea\b|\bbun\b|urea nitrogen/i, unit: "mmol/L" },
    { id: "uosm", label: "Urine osmolality", loinc: ["2695-4", "2697-0"], re: /osmol/i, unit: "mOsm/kg" },
    { id: "upcr", label: "Urine protein:creatinine", loinc: ["2890-2", "34366-5"], re: /protein.*creat|pcr\b/i, unit: "g/mmol" },
    { id: "uacr", label: "Urine albumin:creatinine", loinc: ["9318-7", "14959-1", "14958-3"], re: /albumin.*creat|\bacr\b/i, unit: "mg/mmol" },
    { id: "urbc", label: "Urine red cells", loinc: ["13945-1", "30391-7"], re: /red (blood )?cells?|\brbc\b/i, not: /cast/i, unit: "/HPF" },
    { id: "uwbc", label: "Urine white cells", loinc: ["5821-4", "30405-5"], re: /white (blood )?cells?|\bwbc\b|leukocytes?\b/i, not: /esterase|cast/i, unit: "/HPF" }];
  /* urinalysis dipstick / microscopy and serology: qualitative (positive/negative) */
  const QUAL = [
    { id: "ublood", label: "Urine blood (dipstick)", loinc: ["5794-3", "57289-1"], re: /blood|hemoglobin/i, not: /cells?\b|rbc|cast/i, urine: true },
    { id: "uprot", label: "Urine protein (dipstick)", loinc: ["2888-6", "20454-5", "5804-0"], re: /protein/i, not: /ratio|creat|24/i, urine: true },
    { id: "uleuk", label: "Leukocyte esterase", loinc: ["5799-2", "60026-2"], re: /leuk.*esterase/i, urine: true },
    { id: "unit", label: "Nitrite", loinc: ["5802-4"], re: /nitrite/i, urine: true },
    { id: "rbccast", label: "Red cell casts", loinc: ["5808-1"], re: /(red|rbc).*cast/i, urine: true },
    { id: "wbccast", label: "White cell casts", loinc: ["5821-4x"], re: /(white|wbc).*cast/i, urine: true },
    { id: "grancast", label: "Granular casts", loinc: ["5793-5"], re: /granular cast|muddy/i, urine: true },
    { id: "uculture", label: "Urine culture", loinc: ["630-4"], re: /culture/i, urine: true },
    { id: "mpo", label: "MPO-ANCA", loinc: ["6968-2", "14615-9"], re: /mpo|myeloperoxidase|p-?anca/i },
    { id: "pr3", label: "PR3-ANCA", loinc: ["6969-0", "14614-2"], re: /pr-?3|proteinase|c-?anca/i },
    { id: "anca", label: "ANCA screen", loinc: ["17351-8"], re: /\banca\b|neutrophil cytoplasmic/i },
    { id: "gbm", label: "Anti-GBM", loinc: ["5149-0", "32202-4"], re: /gbm|glomerular basement/i },
    { id: "ana", label: "ANA", loinc: ["5048-4", "8061-4"], re: /\bana\b|antinuclear/i },
    { id: "dsdna", label: "Anti-dsDNA", loinc: ["5130-0", "11235-9"], re: /dsdna|double.?strand/i },
    { id: "flc", label: "Free light chain ratio", loinc: ["48378-4"], re: /light chain.*ratio|kappa.*lambda/i },
    { id: "spep", label: "Protein electrophoresis", loinc: ["24351-9"], re: /electrophoresis|m-?spike|paraprotein/i }];

  /* medicines: category -> regex. Roles are decided in the app. */
  const MEDS = [
    ["nsaid", /ibuprofen|naproxen|diclofenac|ketorolac|celecoxib|indomethacin|meloxicam|ketoprofen|\basa\b.*(325|650|975)/i],
    ["acei", /pril\b|captopril|enalapril|lisinopril|ramipril|perindopril|trandolapril|quinapril|fosinopril/i],
    ["arb", /sartan\b|candesartan|losartan|valsartan|irbesartan|telmisartan|olmesartan|sacubitril|entresto/i],
    ["loop", /furosemide|lasix|bumetanide|torsemide/i], ["thiazide", /hydrochlorothiazide|chlorthalidone|indapamide|metolazone|\bhctz\b/i],
    ["mra", /spironolactone|eplerenone|finerenone/i], ["sglt2", /empagliflozin|dapagliflozin|canagliflozin|ertugliflozin|jardiance|forxiga|invokana/i],
    ["metformin", /metformin|janumet|synjardy|xigduo/i],
    ["amino", /gentamicin|tobramycin|amikacin|streptomycin/i], ["vanc", /vancomycin/i], ["piptazo", /piperacillin|tazobactam|tazocin|zosyn/i],
    ["ampho", /amphotericin|ambisome/i], ["acyclo", /acyclovir|aciclovir|valacyclovir/i], ["mtx", /methotrexate/i],
    ["platin", /cisplatin|ifosfamide|carboplatin/i], ["cni", /tacrolimus|cyclosporin|ciclosporin|advagraf|prograf|envarsus/i],
    ["lithium", /lithium/i], ["contrast", /iohexol|iodixanol|iopamidol|ioversol|omnipaque|visipaque|isovue|contrast/i],
    ["ppi", /pantoprazole|omeprazole|esomeprazole|lansoprazole|rabeprazole|dexlansoprazole/i],
    ["betalactam", /penicillin|amoxicillin|ampicillin|cloxacillin|piperacillin|cefazolin|cephalexin|ceftriaxone|cefuroxime|ceftazidime|cefepime|cefoxitin|meropenem|ertapenem|imipenem/i],
    ["rifampin", /rifampin|rifampicin/i], ["tmp", /trimethoprim|septra|bactrim|co-trimoxazole|sulfamethoxazole/i], ["allopurinol", /allopurinol/i],
    ["ici", /pembrolizumab|nivolumab|ipilimumab|atezolizumab|durvalumab|cemiplimab|avelumab|tremelimumab/i],
    ["zoledronic", /zoledronic|pamidronate/i], ["colistin", /colistin|polymyxin/i], ["foscarnet", /foscarnet|cidofovir/i], ["tenofovir", /tenofovir/i],
    ["mesalamine", /mesalamine|mesalazine|sulfasalazine/i],
    ["anticholinergic", /oxybutynin|tolterodine|solifenacin|fesoterodine|darifenacin|trospium|amitriptyline|nortriptyline|diphenhydramine|hydroxyzine|benztropine|scopolamine|dimenhydrinate|promethazine|chlorpheniramine/i],
    ["opioid", /morphine|hydromorphone|oxycodone|codeine|tramadol|fentanyl|methadone|tapentadol/i],
    ["kraise", /potassium chloride|\bkcl\b|k-?dur|slow-?k|amiloride|triamterene|heparin|enoxaparin|dalteparin|tinzaparin/i],
    ["renaldose", /enoxaparin|dalteparin|tinzaparin|gabapentin|pregabalin|morphine|codeine|apixaban|rivaroxaban|dabigatran|edoxaban|nitrofurantoin|baclofen|colchicine|sotalol|digoxin|glyburide|sitagliptin|saxagliptin|famotidine|ranitidine|levetiracetam|valacyclovir|acyclovir|fluconazole|ciprofloxacin|levofloxacin|cephalexin|cefazolin|piperacillin|meropenem|ertapenem|vancomycin|gentamicin|tobramycin|amikacin|allopurinol|methotrexate|lithium|metformin/i],
    ["alphablock", /tamsulosin|alfuzosin|silodosin|terazosin|doxazosin/i]];

  const PROB = {
    ckd: /chronic kidney|N18|end.stage renal|esrd|renal insufficiency/i, hf: /heart failure|I50|cardiomyopathy/i, cirrhosis: /cirrho|K70\.3|K74\.[3-6]|K72|portal hypertens|ascites|R18/i,
    bph: /prostat|N40|bladder outlet|urinary retention|R33|neurogenic bladder|N31|urethral stricture/i, stone: /kidney stone|nephrolith|urolith|N20|renal colic/i,
    transplant: /kidney transplant|renal transplant|Z94\.0|T86\.1/i, myeloma: /myeloma|C90|light chain|plasma cell|MGUS|D47\.2/i,
    autoimmune: /lupus|M32|vasculitis|granulomatosis with polyangiitis|wegener|microscopic polyangiitis|M31|goodpasture|anti-gbm|scleroderma|systemic sclerosis|M34|sjogren|M35\.0|sarcoid|D86/i,
    diabetes: /diabetes|E1[0-4]/i, single: /single kidney|solitary kidney|nephrectomy|Z90\.5|absence of kidney/i, pregnant: /pregnan|O\d\d|Z33/i,
    sepsis: /sepsis|septic|A41|R65\.2/i, rhabdo: /rhabdomyoly|M62\.82|T79\.6/i, cancer: /carcinoma|cancer|malignan|lymphoma|leukemia|C\d\d/i };

  function medText(m) {
    let t = label(m.medicationCodeableConcept) || (m.medicationReference && m.medicationReference.display) || "";
    if (!t && m.medicationReference && m.contained) { const c = m.contained.find((x) => m.medicationReference.reference === "#" + x.id); if (c) t = label(c.code); }
    const di = m.dosageInstruction && m.dosageInstruction[0];
    return [t, di && di.text].filter(Boolean).join(" ").trim();
  }
  /* qualitative result: true (positive/abnormal), false (negative/normal), null (unknown) */
  function qualOf(o) {
    const s = [o.valueString, label(o.valueCodeableConcept), (o.interpretation || []).map(label).join(" ")].filter(Boolean).join(" ");
    if (/\bnot detected|negative|\bneg\b|nil|none seen|absent|non-?reactive|^\s*0\s*$|within normal/i.test(s)) return false;
    if (/positive|\bpos\b|detected|reactive|present|trace|\d\+|\+{1,4}|large|moderate|small|abnormal|many|few|seen|\bhigh\b/i.test(s)) return true;
    const ic = (o.interpretation || []).flatMap((i) => codes(i));
    if (ic.some((c) => /^(H|HH|A|AA|POS|DET)$/.test(c))) return true;
    if (ic.some((c) => /^(N|NEG|ND)$/.test(c))) return false;
    const q = o.valueQuantity, hi = o.referenceRange && o.referenceRange[0] && o.referenceRange[0].high;
    if (q && typeof q.value === "number" && hi && typeof hi.value === "number") return q.value > hi.value;
    return null;
  }

  function parse(raw, opts) {
    const now = (opts && opts.now) || Date.now();
    const f = { sex: "", age: null, s: {}, u: {}, q: {}, uo: [], pvr: [], weights: [], sbp: [], map: [], meds: [], prob: {} };
    SERUM.forEach((d) => (f.s[d.id] = [])); URINE_LABS.forEach((d) => (f.u[d.id] = [])); QUAL.forEach((d) => (f.q[d.id] = []));
    const p = raw.patient;
    if (p) { f.sex = String(p.gender || "").toLowerCase(); if (p.birthDate) f.age = Math.floor((now - new Date(p.birthDate).getTime()) / (365.25 * DAY)); }
    const seen = new Set();
    (raw.obs || []).forEach((o) => {
      if (!o || o.resourceType !== "Observation" || /entered-in-error|cancelled/.test(o.status || "")) return;
      const t = tOf(o); if (t == null || t > now + DAY) return;
      const name = label(o.code), cs = codes(o.code), q = o.valueQuantity, u = (q && q.unit) || "";
      const spec = (o.specimen && o.specimen.display) || "", where = name + " " + spec;
      const key = name + cs.join() + t + JSON.stringify(o.valueQuantity || o.valueString || o.valueCodeableConcept || ""); if (seen.has(key)) return; seen.add(key);
      // blood pressure (component or single)
      if (cs.includes("85354-9") || /blood pressure/i.test(name)) {
        const comp = (o.component || []).map((c) => ({ c: codes(c.code), n: label(c.code), v: c.valueQuantity && c.valueQuantity.value }));
        const sb = comp.find((c) => c.c.includes("8480-6") || /systol/i.test(c.n)), db = comp.find((c) => c.c.includes("8462-4") || /diastol/i.test(c.n));
        if (sb && isFinite(sb.v)) { f.sbp.push({ t, v: sb.v }); if (db && isFinite(db.v)) f.map.push({ t, v: (sb.v + 2 * db.v) / 3 }); }
        return;
      }
      if (q && typeof q.value === "number") {
        if (cs.includes("8480-6") || /^systolic/i.test(name)) { f.sbp.push({ t, v: q.value }); return; }
        if (cs.includes("8478-0") || /mean arterial/i.test(name)) { f.map.push({ t, v: q.value }); return; }
        if (cs.includes("9187-6") || /urine output|output.*urine|urine volume|foley output|void(ed)? (amount|volume)/i.test(name)) { f.uo.push({ t, v: q.value }); return; }
        if (/bladder scan|post.?void|residual/i.test(name)) { f.pvr.push({ t, v: q.value }); return; }
        if (cs.some((c) => ["29463-7", "3141-9"].includes(c)) || /body weight|^weight/i.test(name)) { let v = q.value; if (/lb/i.test(u)) v *= 0.4536; if (v >= 25 && v <= 350) f.weights.push({ t, v }); return; }
      }
      if (OTHER.test(where)) return;
      const isUrine = URINE.test(where);
      // qualitative first (dipstick, casts, serology)
      const qd = QUAL.find((x) => x.loinc.some((c) => cs.includes(c)) && (!!x.urine === isUrine || !x.urine)) || QUAL.find((x) => (!!x.urine === isUrine) && x.re.test(name) && !(x.not && x.not.test(name)));
      const numericUrine = q && typeof q.value === "number" && isUrine && URINE_LABS.some((x) => x.loinc.some((c) => cs.includes(c)) || (x.re.test(name) && !(x.not && x.not.test(name))));
      if (qd && !numericUrine) {
        const pos = qualOf(o), shown = o.valueString || label(o.valueCodeableConcept) || (q ? q.value + " " + u : "");
        if (pos !== null || shown) { f.q[qd.id].push({ t, pos, shown }); return; }
      }
      if (!q || typeof q.value !== "number") return;
      if (isUrine) {
        const d = URINE_LABS.find((x) => x.loinc.some((c) => cs.includes(c))) || URINE_LABS.find((x) => x.re.test(name) && !(x.not && x.not.test(name)));
        if (d) {
          let v = q.value;
          if (d.id === "ucr") { if (/umol/i.test(u)) v /= 1000; else if (/mg\s*\/\s*dl/i.test(u)) v *= 0.0884; }
          if (d.id === "uurea" && /mg\s*\/\s*dl/i.test(u)) v /= 2.8;
          f.u[d.id].push({ t, v, shown: q.value + " " + u });
        }
        return;
      }
      const d = SERUM.find((x) => x.loinc.some((c) => cs.includes(c))) || SERUM.find((x) => x.re.test(name) && !(x.not && x.not.test(name)));
      if (d) {
        if (d.id === "ph" && !(q.value > 6.5 && q.value < 8)) return;
        if (d.id === "na" && !(q.value >= 90 && q.value <= 190)) return;
        f.s[d.id].push({ t, v: d.conv ? d.conv(q.value, u) : q.value, shown: q.value + " " + u, gas: GAS.test(where) });
      }
    });
    const srt = (a) => a.sort((x, y) => x.t - y.t);
    [f.uo, f.pvr, f.weights, f.sbp, f.map].forEach(srt); [f.s, f.u, f.q].forEach((g) => Object.values(g).forEach(srt));

    [].concat(raw.medreqs || [], raw.admins || []).forEach((m) => {
      const isReq = m.resourceType === "MedicationRequest";
      if (isReq && /stopped|cancelled|entered-in-error|draft/.test(m.status || "")) return;
      const name = medText(m), t = tOf(m), cats = MEDS.filter(([, re]) => re.test(name)).map(([id]) => id);
      if (!cats.length) return;
      f.meds.push({ name, t, cats, active: isReq && /active|on-hold/.test(m.status || "active"), given: !isReq, completed: isReq && /completed/.test(m.status || "") });
    });
    (raw.conditions || []).forEach((c) => {
      if (c.clinicalStatus && /resolved|inactive|remission/i.test(JSON.stringify(c.clinicalStatus))) return;
      const txt = label(c.code) + " " + codes(c.code).join(" ");
      Object.keys(PROB).forEach((k) => { if (PROB[k].test(txt)) (f.prob[k] = f.prob[k] || []).push(label(c.code) || codes(c.code)[0]); });
    });
    return f;
  }

  const latest = (arr, maxAge, now) => { const e = arr && arr.length ? arr[arr.length - 1] : null; return e && (!maxAge || (now || Date.now()) - e.t <= maxAge) ? e : null; };
  /* drugs ordered now, or given / ordered in the past `days` */
  const recent = (f, cat, days, now) => f.meds.filter((m) => m.cats.includes(cat) && (m.active || (m.t && (now || Date.now()) - m.t <= days * DAY)));
  const names = (list) => [...new Set(list.map((m) => m.name.replace(/\s+\d.*$/, "").trim() || m.name))];

  async function gather(client, say) {
    const pid = client.patient.id, errors = [], tell = say || (() => {});
    const iso = (t) => new Date(t).toISOString().slice(0, 10);
    async function get(url, name, pages) {
      const once = () => { let tm; return Promise.race([client.request(url, { pageLimit: pages || 1, flat: true }), new Promise((_, rej) => { tm = setTimeout(() => rej(new Error("timed out after 30 s")), 30000); })]).finally(() => clearTimeout(tm)); };
      const fetchRetry = () => once().catch((e) => /timed out|\b50[234]\b|Gateway|Failed to fetch|NetworkError/i.test(String((e && e.message) || e)) ? new Promise((r) => setTimeout(r, 1500)).then(once) : Promise.reject(e));
      try { const r = (await fetchRetry()).filter((x) => x.resourceType && x.resourceType !== "OperationOutcome"); tell(`Loaded ${name} (${r.length})…`); return r; }
      catch (e) { errors.push(`${name}: ${e.message || e}`); return []; }
    }
    const since365 = iso(Date.now() - 365 * DAY), since30 = iso(Date.now() - 30 * DAY), since3 = iso(Date.now() - 3 * DAY);
    const crCodes = ["2160-0", "38483-4", "14682-9"].map((c) => "http://loinc.org|" + c).join(",");
    const [patient, cr, labs, vit, uo, medreqs, admins, conditions] = await Promise.all([
      (async () => { try { return await client.patient.read(); } catch (e) { errors.push("patient: " + (e.message || e)); return null; } })(),
      get(`Observation?patient=${pid}&code=${crCodes}&date=ge${since365}&_count=100`, "creatinine (1 year)", 4),
      get(`Observation?patient=${pid}&category=laboratory&date=ge${since30}&_count=100`, "lab results (30 days)", 10),
      get(`Observation?patient=${pid}&category=vital-signs&date=ge${since3}&_count=100`, "vital signs (3 days)", 3),
      get(`Observation?patient=${pid}&code=http://loinc.org|9187-6&date=ge${since3}&_count=100`, "urine output (3 days)", 2),
      get(`MedicationRequest?patient=${pid}&_count=100`, "medication orders", 3),
      get(`MedicationAdministration?patient=${pid}&effective-time=ge${iso(Date.now() - 14 * DAY)}T00:00:00Z&_count=100`, "medications given (14 days)", 4),
      get(`Condition?patient=${pid}&category=problem-list-item&_count=50`, "problem list", 2)]);
    const w = await get(`Observation?patient=${pid}&code=http://loinc.org|29463-7,http://loinc.org|3141-9&_count=20`, "weight", 1);
    return { raw: { patient, obs: cr.concat(labs, vit, uo, w), medreqs, admins, conditions }, errors };
  }

  window.AkiChart = { SERUM, URINE_LABS, QUAL, MEDS, parse, qualOf, latest, recent, names, gather, DAY };
})();
