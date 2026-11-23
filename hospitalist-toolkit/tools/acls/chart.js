/* Chart reading for the ACLS tab. READ-ONLY. parse() turns raw FHIR resources into plain facts; gather() fetches them.
   Tests and drugs are matched by LOINC and then by NAME (UNVERIFIED): something not found here may still be in the chart. */
(function () {
  const DAY = 864e5, HR = 36e5;
  const label = (cc) => (cc && (cc.text || (cc.coding || []).map((c) => c.display).find(Boolean))) || "";
  const codes = (cc) => ((cc && cc.coding) || []).map((c) => String(c.code || ""));
  const tOf = (r) => { const d = r.effectiveDateTime || (r.effectivePeriod && r.effectivePeriod.start) || r.issued || r.authoredOn || r.recordedDate || r.date || (r.meta && r.meta.lastUpdated) || ""; const t = d ? new Date(d).getTime() : NaN; return isNaN(t) ? null : t; };
  const mgdl = (f) => (v, u) => (/mg\s*\/\s*dl/i.test(u || "") ? v * f : v);
  const URINE = /urine|\bur\b|random urine/i;
  const ART = /arterial|\bart\b|abg/i, VEN = /venous|\bven\b|vbg/i;

  const VITALS = [
    { id: "hr", loinc: ["8867-4"], re: /heart rate|pulse/i }, { id: "sbp", loinc: ["8480-6"], re: /systolic/i }, { id: "dbp", loinc: ["8462-4"], re: /diastolic/i },
    { id: "map", loinc: ["8478-0"], re: /mean arterial|\bmap\b/i }, { id: "rr", loinc: ["9279-1"], re: /resp(iratory)? rate/i },
    { id: "spo2", loinc: ["59408-5", "2708-6"], re: /spo2|oxygen saturation|pulse ox/i },
    { id: "temp", loinc: ["8310-5", "8331-1", "8332-9", "8333-7"], re: /temperature|^temp/i, conv: (v, u) => (/\[?degF\]?|°f|fahrenheit/i.test(u || "") ? (v - 32) * 5 / 9 : v) },
    { id: "wt", loinc: ["29463-7", "3141-9", "8350-1"], re: /body weight|^weight|daily weight/i, conv: (v, u) => (/lb/i.test(u || "") ? v * 0.4536 : v) }];
  const LABS = [
    { id: "k", loinc: ["2823-3", "6298-4", "32713-0"], re: /potassium/i, not: URINE }, { id: "na", loinc: ["2951-2", "2947-0"], re: /sodium/i, not: URINE },
    { id: "mg", loinc: ["19123-9", "2601-3"], re: /magnesium/i, not: URINE, conv: mgdl(0.4114) },
    { id: "ica", loinc: ["1994-3", "17863-2", "1995-0"], re: /ionized calcium|calcium,? ionized|ica\b/i, conv: mgdl(0.25) },
    { id: "ca", loinc: ["17861-6", "2000-8"], re: /calcium/i, not: /ionized|urine|score/i, conv: mgdl(0.2495) },
    { id: "glu", loinc: ["2345-7", "2339-0", "41653-7", "14743-9", "15074-8"], re: /glucose/i, not: /urine|csf|tolerance/i, conv: mgdl(0.0555) },
    { id: "ph", loinc: ["2744-1", "2746-6", "11558-4", "2753-2"], re: /\bph\b/i, not: URINE },
    { id: "pco2", loinc: ["2019-8", "2021-4", "11557-6"], re: /pco2|carbon dioxide partial/i },
    { id: "hco3", loinc: ["1959-6", "1963-8", "2028-9", "14627-4"], re: /bicarbonate|hco3|total co2|\bco2\b/i, not: /pco2|partial/i },
    { id: "lactate", loinc: ["2524-7", "32693-4", "2518-9"], re: /lactate|lactic/i, not: /dehydrogenase/i },
    { id: "hb", loinc: ["718-7"], re: /hemoglobin|haemoglobin|^hgb/i, not: /a1c|glyc|urine/i, conv: (v, u) => (/g\s*\/\s*dl/i.test(u || "") ? v * 10 : v) },
    { id: "plt", loinc: ["777-3", "26515-7"], re: /platelet/i, not: /volume|mpv/i }, { id: "inr", loinc: ["6301-6", "34714-6"], re: /\binr\b/i },
    { id: "trop", loinc: ["89579-7", "67151-1", "6598-7", "10839-9", "42757-5", "49563-0", "48425-3", "67015-8"], re: /troponin/i, conv: (v, u) => (/ug\s*\/\s*l|µg\s*\/\s*l|mcg\s*\/\s*l|ng\s*\/\s*ml/i.test(u || "") ? v * 1000 : v) },
    { id: "ddimer", loinc: ["48065-7", "48066-5", "30240-6"], re: /d-?dimer/i, conv: (v, u) => (/ng\s*\/\s*ml|ug\s*\/\s*l|µg\s*\/\s*l/i.test(u || "") ? v / 1000 : v) },
    { id: "dig", loinc: ["10535-3"], re: /digoxin/i, conv: (v, u) => (/ng\s*\/\s*ml|ug\s*\/\s*l|mcg\s*\/\s*l/i.test(u || "") ? v * 1.28 : v) },
    { id: "qtc", loinc: ["8636-3", "76635-1"], re: /qtc/i }, { id: "cr", loinc: ["2160-0", "38483-4"], re: /creatinine/i, not: /ratio|kinase|clearance|urine/i, conv: mgdl(88.4) }];

  const MED = {
    opioid: /morphine|hydromorphone|dilaudid|oxycodone|fentanyl|codeine|tramadol|methadone|tapentadol|meperidine|sufentanil|remifentanil|buprenorphine/i,
    benzo: /lorazepam|midazolam|diazepam|clonazepam|alprazolam|temazepam|oxazepam|chlordiazepoxide/i, sedOther: /zopiclone|zolpidem|quetiapine|olanzapine|gabapentin|pregabalin|propofol|dexmedetomidine|ketamine/i,
    naloxone: /naloxone|narcan/i,
    bb: /bisoprolol|carvedilol|metoprolol|nebivolol|atenolol|propranolol|labetalol|esmolol|sotalol/i, ccb: /diltiazem|verapamil|amlodipine|nifedipine|felodipine/i, ndhp: /diltiazem|verapamil/i,
    dig: /digoxin|lanoxin/i, tca: /amitriptyline|nortriptyline|imipramine|desipramine|doxepin|clomipramine/i,
    la: /bupivacaine|ropivacaine|lidocaine.*(infusion|drip|mg\/h|mg\s*\/\s*min)|mepivacaine|chloroprocaine|nerve block|epidural|fascia iliaca/i,
    qt: /haloperidol|ondansetron|methadone|citalopram|escitalopram|ciprofloxacin|levofloxacin|moxifloxacin|azithromycin|clarithromycin|erythromycin|amiodarone|sotalol|quetiapine|domperidone|hydroxychloroquine|fluconazole|voriconazole|amitriptyline|nortriptyline|procainamide|flecainide|dofetilide|tacrolimus|ziprasidone|risperidone|olanzapine|droperidol|chlorpromazine|trazodone|propafenone|arsenic/i,
    anticoag: /apixaban|eliquis|rivaroxaban|xarelto|edoxaban|dabigatran|warfarin|coumadin|enoxaparin.*(1\s*mg\s*\/\s*kg|bid|q12)|heparin.*(infusion|units?\s*\/\s*h|drip|nomogram)|dalteparin.*(200|bid)|tinzaparin.*175|fondaparinux.*(5|7\.5|10)\s*mg|argatroban|bivalirudin/i,
    vteppx: /enoxaparin|dalteparin|tinzaparin|heparin|fondaparinux|apixaban|rivaroxaban|edoxaban|dabigatran|warfarin/i,
    insulin: /insulin|glargine|detemir|degludec|lispro|aspart|humulin|novorapid|lantus/i, su: /gliclazide|glyburide|glimepiride|glipizide|repaglinide/i,
    kup: /potassium chloride|kcl|k-dur|slow-k|spironolactone|eplerenone|amiloride|triamterene|trimethoprim|septra|cotrimoxazole|ramipril|enalapril|lisinopril|perindopril|candesartan|valsartan|losartan|irbesartan|telmisartan|sacubitril|tacrolimus|cyclosporine|heparin/i,
    loopThiazide: /furosemide|lasix|bumetanide|torsemide|hydrochlorothiazide|chlorthalidone|indapamide|metolazone/i,
    pressor: /norepinephrine|levophed|epinephrine|vasopressin|phenylephrine|dopamine|dobutamine|milrinone/i };
  const PROB = {
    dialysis: /dialysis|N18\.6|Z99\.2|end.stage renal|ESRD/i, ckd: /chronic kidney|N18/i, pe: /pulmonary embol|I26|deep vein|DVT|venous thromb|I82/i,
    cancer: /malignan|cancer|carcinoma|lymphoma|leukemia|myeloma|C[0-9]{2}\b/i, acs: /NSTEMI|STEMI|acute myocardial|acute coronary|I21|I22|I24/i, cad: /coronary|ischemic heart|I25|CABG|stent/i,
    hf: /heart failure|I50|cardiomyopathy|I42/i, af: /atrial fib|flutter|I48/i, pacer: /pacemaker|Z95\.0|ICD\b|defibrillator/i, transplant: /heart transplant|Z94\.1/i,
    copd: /copd|J44|emphysema/i, osa: /sleep apnea|G47\.3/i, ptx: /pneumothorax|J93/i, effusion: /pericardial effusion|tamponade|I31\.[34]|pericarditis/i,
    cardsurg: /cardiac surgery|CABG|valve replacement|post.?pericardiotomy|ablation|lead (insertion|placement)/i, gibleed: /GI bleed|gastrointestinal hem|melena|hematemesis|K92\.[012]|varices/i,
    sepsis: /sepsis|septic|A41|R65\.2/i, dka: /ketoacidosis|DKA|E1[01]\.1/i, overdose: /overdose|poisoning|T4[0-9]\.|T50/i, longqt: /long QT|I45\.81/i, wpw: /wolff|WPW|pre-?excitation|I45\.6/i,
    hipfx: /hip fracture|femoral neck|intertrochanteric|S72/i, postop: /post-?op|postoperative|s\/p |status post|Z98|Z96\.6|arthroplasty|hemiarthroplasty|ORIF|laparotomy/i, trauma: /rib fracture|chest trauma|S22/i,
    pregnancy: /pregnan|O[0-9]{2}\.|Z33/i, ventilated: /mechanical ventilation|ventilator|tracheostomy|Z99\.11/i };
  const CODE_RE = /code status|resuscitation status|resus status|\bMOST\b|medical orders for scope|\bDNR\b|do not resuscitate|full code|no cpr|allow natural death|\bM[123]\b.*(supportive|medical|transfer|comfort)|\bC[012]\b.*(critical|intubat)|goals of care designation/i;

  function obsVal(r) { const q = r.valueQuantity; return q && q.value != null ? { v: +q.value, u: q.unit || q.code || "" } : null; }
  function obsText(r) { return r.valueString || (r.valueCodeableConcept && label(r.valueCodeableConcept)) || ""; }
  function medText(m) {
    let t = label(m.medicationCodeableConcept) || (m.medicationReference && m.medicationReference.display) || "";
    if (!t && m.medicationReference && m.contained) { const c = m.contained.find((x) => m.medicationReference.reference === "#" + x.id); if (c) t = label(c.code); }
    const di = m.dosageInstruction && m.dosageInstruction[0], d = m.dosage && m.dosage.dose, rt = (m.dosage && m.dosage.route && label(m.dosage.route)) || (di && di.route && label(di.route)) || "";
    return [t, d && d.value != null ? d.value + " " + (d.unit || "") : "", rt, di && di.text].filter(Boolean).join(" ").trim();
  }
  const pick = (defs, r) => { const c = codes(r.code), n = label(r.code); return defs.find((d) => (d.loinc.length && c.some((x) => d.loinc.includes(x))) || (d.re.test(n) && !(d.not && d.not.test(n)))); };

  function parse(raw, opts) {
    const now = (opts && opts.now) || Date.now(), f = { v: {}, l: {}, meds: [], admins: [], cls: {}, prob: {}, probText: [], code: [], gasArt: null };
    const p = raw.patient || {};
    f.sex = String(p.gender || "").toLowerCase();
    if (p.birthDate) f.age = Math.floor((now - new Date(p.birthDate).getTime()) / (365.25 * DAY));
    (raw.obs || []).forEach((r) => {
      if (r.status === "entered-in-error" || r.status === "cancelled") return;
      const t = tOf(r); if (t == null) return;
      const nm = label(r.code), tx = obsText(r);
      if (CODE_RE.test(nm) && tx) f.code.push({ text: nm + ": " + tx, source: "chart observation", t });
      if ((r.component || []).length) r.component.forEach((c) => { const d = pick(VITALS, c), q = obsVal(c); if (d && q) (f.v[d.id] = f.v[d.id] || []).push({ t, v: d.conv ? d.conv(q.v, q.u) : q.v }); });
      const q = obsVal(r); if (!q) return;
      const vd = pick(VITALS, r); if (vd) { (f.v[vd.id] = f.v[vd.id] || []).push({ t, v: Math.round((vd.conv ? vd.conv(q.v, q.u) : q.v) * 10) / 10 }); return; }
      const ld = pick(LABS, r); if (!ld) return;
      const val = Math.round((ld.conv ? ld.conv(q.v, q.u) : q.v) * 100) / 100;
      if ((ld.id === "ph" || ld.id === "pco2") && VEN.test(nm)) { (f.l[ld.id + "V"] = f.l[ld.id + "V"] || []).push({ t, v: val }); return; }
      (f.l[ld.id] = f.l[ld.id] || []).push({ t, v: val, art: ART.test(nm) });
    });
    Object.values(f.v).concat(Object.values(f.l)).forEach((a) => a.sort((x, y) => x.t - y.t));
    (raw.medreqs || []).forEach((m) => { if (/entered-in-error|cancelled|stopped|completed/.test(m.status || "")) return; const text = medText(m); if (text) f.meds.push({ text, status: m.status || "", t: tOf(m) }); });
    (raw.admins || []).forEach((m) => { if (m.status && m.status !== "completed" && m.status !== "in-progress") return; const text = medText(m), t = tOf(m); if (text && t) f.admins.push({ text, t }); });
    f.admins.sort((a, b) => a.t - b.t);
    const all = f.meds.filter((m) => m.status !== "on-hold").map((m) => m.text).concat(f.admins.filter((a) => now - a.t < 2 * DAY).map((a) => a.text));
    f.allMeds = all;
    Object.entries(MED).forEach(([k, re]) => { f.cls[k] = [...new Set(all.filter((x) => re.test(x)).map((x) => x.split(/\s+\d/)[0].trim()))]; });
    f.cls.qt = f.cls.qt.filter((x) => !/^lidocaine/i.test(x));
    f.recentOpioidDose = f.admins.some((a) => MED.opioid.test(a.text) && now - a.t < 6 * HR);
    (raw.conditions || []).forEach((c) => {
      const n = label(c.code) + " " + codes(c.code).join(" ");
      if (CODE_RE.test(n)) f.code.push({ text: label(c.code), source: "problem list", t: tOf(c) });
      if (c.clinicalStatus && /resolved|inactive|remission/.test(codes(c.clinicalStatus).join(" "))) return;
      if (c.verificationStatus && /refuted|entered-in-error/.test(codes(c.verificationStatus).join(" "))) return;
      f.probText.push(label(c.code));
      Object.entries(PROB).forEach(([k, re]) => { if (re.test(n)) f.prob[k] = (f.prob[k] || []).concat(label(c.code)); });
    });
    (raw.docs || []).forEach((d) => {
      if (d.status === "entered-in-error") return;
      const n = [label(d.type), d.description, ...((d.content || []).map((c) => c.attachment && c.attachment.title))].filter(Boolean).join(" · ");
      if (CODE_RE.test(n)) f.code.push({ text: n, source: "document", t: tOf(d) });
    });
    if (f.v.wt) f.kg = Math.round(f.v.wt[f.v.wt.length - 1].v * 10) / 10;
    return f;
  }
  const latest = (a, within, now) => { if (!a || !a.length) return null; const x = a[a.length - 1]; return within && (now || Date.now()) - x.t > within ? null : x; };

  async function gather(client, say) {
    const pid = client.patient.id, errors = [], tell = say || (() => {});
    const iso = (t) => new Date(t).toISOString().slice(0, 10), isoT = (t) => new Date(t).toISOString().replace(/\.\d{3}Z$/, "Z");
    async function get(url, name, pages, quiet) {
      const once = () => { let tm; return Promise.race([client.request(url, { pageLimit: pages || 1, flat: true }), new Promise((_, rej) => { tm = setTimeout(() => rej(new Error("timed out after 30 s")), 30000); })]).finally(() => clearTimeout(tm)); };
      const transient = (e) => /timed out|\b50[234]\b|Gateway|Failed to fetch|NetworkError/i.test(String((e && e.message) || e));
      try { const r = (await once().catch((e) => (transient(e) ? new Promise((ok) => setTimeout(ok, 1500)).then(once) : Promise.reject(e)))).filter((x) => x.resourceType && x.resourceType !== "OperationOutcome"); tell(`Loaded ${name} (${r.length})…`); return r; }
      catch (e) { if (!quiet) errors.push(`${name}: ${e.message || e}`); return []; }
    }
    const s2 = iso(Date.now() - 2 * DAY), s7 = iso(Date.now() - 7 * DAY), s60 = iso(Date.now() - 60 * DAY);
    const [patient, vitals, labs, medreqs, admins, conditions, docs] = await Promise.all([
      (async () => { try { return await client.patient.read(); } catch (e) { errors.push("patient: " + (e.message || e)); return null; } })(),
      get(`Observation?patient=${pid}&category=vital-signs&date=ge${s2}&_count=200`, "vital signs (2 days)", 5),
      get(`Observation?patient=${pid}&category=laboratory&date=ge${s7}&_count=200`, "lab results (7 days)", 6),
      get(`MedicationRequest?patient=${pid}&_count=100`, "medication orders", 3),
      get(`MedicationAdministration?patient=${pid}&effective-time=ge${isoT(Date.now() - 2 * DAY)}&_count=100`, "medications given (2 days)", 3),
      get(`Condition?patient=${pid}&_count=100`, "problem list", 2),
      get(`DocumentReference?patient=${pid}&date=ge${s60}&_count=100`, "document titles (60 days, for code status)", 2, true)]);
    return { raw: { patient, obs: vitals.concat(labs), medreqs, admins, conditions, docs }, errors };
  }

  const api = { parse, gather, latest, MED, PROB, CODE_RE, DAY, HR };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else window.ACLSChart = api;
})();
