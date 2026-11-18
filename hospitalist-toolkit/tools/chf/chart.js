/* Chart reading for the heart failure tab. READ-ONLY. parse() turns raw FHIR resources into plain facts; gather() fetches them.
   Tests and drugs are matched by LOINC and then by NAME (UNVERIFIED): something not found here may still be in the chart. */
(function () {
  const DAY = 864e5, HR = 36e5;
  const label = (cc) => (cc && (cc.text || (cc.coding || []).map((c) => c.display).find(Boolean))) || "";
  const codes = (cc) => ((cc && cc.coding) || []).map((c) => String(c.code || ""));
  const tOf = (r) => { const d = r.effectiveDateTime || (r.effectivePeriod && r.effectivePeriod.start) || r.issued || r.authoredOn || r.recordedDate || ""; const t = d ? new Date(d).getTime() : NaN; return isNaN(t) ? null : t; };
  const mgdl = (f) => (v, u) => (/mg\s*\/\s*dl/i.test(u || "") ? v * f : v);
  const URINE = /urine|\bur\b|random urine/i;

  const VITALS = [
    { id: "hr", loinc: ["8867-4"], re: /heart rate|pulse/i }, { id: "sbp", loinc: ["8480-6"], re: /systolic/i }, { id: "dbp", loinc: ["8462-4"], re: /diastolic/i },
    { id: "spo2", loinc: ["59408-5", "2708-6"], re: /spo2|oxygen saturation/i }, { id: "rr", loinc: ["9279-1"], re: /resp(iratory)? rate/i },
    { id: "wt", loinc: ["29463-7", "3141-9", "8350-1"], re: /body weight|^weight|daily weight/i, conv: (v, u) => (/lb/i.test(u || "") ? v * 0.4536 : v) },
    { id: "ht", loinc: ["8302-2"], re: /height/i, conv: (v, u) => (/in/i.test(u || "") ? v * 2.54 : v) },
    { id: "uo", loinc: ["9187-6", "9192-6"], re: /urine output|urine volume|void/i }];
  const LABS = [
    { id: "nt", loinc: ["33762-6", "83107-3", "71425-3"], re: /nt-?pro ?bnp|n-terminal/i },
    { id: "bnp", loinc: ["30934-4", "42637-9"], re: /\bbnp\b|b-type natriuretic/i, not: /nt-?pro|n-terminal/i },
    { id: "na", loinc: ["2951-2"], re: /sodium/i, not: URINE }, { id: "k", loinc: ["2823-3", "6298-4"], re: /potassium/i, not: URINE },
    { id: "cr", loinc: ["2160-0", "38483-4"], re: /creatinine/i, not: /ratio|kinase|clearance|urine/i, conv: mgdl(88.4) },
    { id: "egfr", loinc: ["33914-3", "62238-1", "98979-8", "48642-3", "48643-1"], re: /egfr|glomerular filtration/i },
    { id: "urea", loinc: ["3091-6", "22664-7"], re: /\burea\b|\bbun\b/i, not: /ratio|urine/i },
    { id: "mg", loinc: ["19123-9", "2601-3"], re: /magnesium/i, not: URINE, conv: mgdl(0.4114) },
    { id: "hco3", loinc: ["1963-8", "2028-9", "1959-6"], re: /bicarb|total co2|^co2/i, not: /pco2|partial/i },
    { id: "hb", loinc: ["718-7"], re: /hemoglobin|haemoglobin|^hgb/i, not: /a1c|glyc/i, conv: (v, u) => (/g\s*\/\s*dl/i.test(u || "") ? v * 10 : v) },
    { id: "ferritin", loinc: ["2276-4", "20567-4"], re: /ferritin/i }, { id: "tsat", loinc: ["2502-3"], re: /saturation.*(transferrin|iron)|iron saturation|tsat/i },
    { id: "tsh", loinc: ["3016-3", "11580-8"], re: /\btsh\b|thyrotropin/i }, { id: "a1c", loinc: ["4548-4", "17856-6"], re: /a1c|glycated/i },
    { id: "trop", loinc: ["89579-7", "67151-1", "6598-7", "10839-9", "42757-5"], re: /troponin/i },
    { id: "alb", loinc: ["1751-7", "61151-7"], re: /albumin/i, not: URINE }, { id: "alt", loinc: ["1742-6"], re: /\balt\b|alanine/i },
    { id: "una", loinc: ["2955-3", "2956-1"], re: /sodium/i, only: URINE },
    { id: "flc", loinc: ["48378-4", "36916-5", "33944-0"], re: /kappa.*lambda|free light chain/i }, { id: "spep", loinc: [], re: /immunofixation|protein electrophoresis|m-?spike|paraprotein/i }];

  const MED = {
    loop: /furosemide|lasix|bumetanide|burinex|torsemide|torasemide|demadex/i, thiaz: /metolazone|hydrochlorothiazide|chlorthalidone|indapamide|\bhctz\b/i, acz: /acetazolamide|diamox/i,
    arni: /sacubitril|entresto/i, acei: /ramipril|enalapril|lisinopril|perindopril|trandolapril|captopril|quinapril/i, arb: /candesartan|valsartan|losartan|irbesartan|telmisartan|olmesartan/i,
    bb: /bisoprolol|carvedilol|metoprolol|nebivolol|atenolol|propranolol/i, mra: /spironolactone|eplerenone|finerenone|aldactone/i,
    sglt2: /dapagliflozin|forxiga|empagliflozin|jardiance|canagliflozin|invokana|ertugliflozin/i, dig: /digoxin|lanoxin/i, ivab: /ivabradine/i,
    ironiv: /ferric derisomaltose|monoferric|iron sucrose|venofer|ferric carboxymaltose|ferinject/i, kcl: /potassium chloride|\bkcl\b|k-?dur|slow-?k/i,
    nsaid: /ibuprofen|naproxen|diclofenac|ketorolac|celecoxib|meloxicam|indomethacin/i, ndhp: /diltiazem|verapamil/i, tzd: /pioglitazone|rosiglitazone/i,
    dron: /dronedarone/i, ivfluid: /sodium chloride 0\.9|normal saline|ringer|plasma-?lyte/i, steroid: /prednisone|dexamethasone|methylprednisolone|hydrocortisone/i,
    amlo: /amlodipine|nifedipine|felodipine/i, gaba: /pregabalin|gabapentin/i, o2: /oxygen/i };
  const PROB = {
    hfref: /reduced ejection|HFrEF|systolic (heart )?failure|I50\.2|I50\.4|dilated cardiomyopathy|I42\.0/i, hfpef: /preserved ejection|HFpEF|diastolic (heart )?failure|I50\.3/i,
    hf: /heart failure|I50|cardiomyopathy|I42/i, af: /atrial fib|flutter|I48/i, cad: /coronary|myocardial infarct|I2[0-5]|CABG|stent/i, htn: /hypertension|I1[0-5]/i,
    dm: /diabetes|E1[0-4]/i, dm1: /type 1 diabetes|E10/i, ckd: /chronic kidney|N18|dialysis/i, valve: /aortic stenosis|mitral (regurg|insuff|stenosis)|I3[45]|I05|I06|valve/i,
    as: /aortic stenosis|I35\.0|I35\.2/i, copd: /copd|J44|emphysema|pulmonary hypertension|I27|sleep apnea|G47\.3/i, thyroid: /thyro|E0[3-5]/i, alcohol: /alcohol|F10/i,
    chemo: /anthracycline|doxorubicin|trastuzumab|chemotherapy|Z92\.21|breast cancer|lymphoma/i, cts: /carpal tunnel|G56\.0/i, spinal: /spinal stenosis|M48\.0/i,
    neuro: /neuropathy|G6[0-3]|orthostatic hypotension|I95\.1/i, mgus: /monoclonal|MGUS|D47\.2|myeloma|C90|amyloid|E85/i, pacer: /pacemaker|Z95\.0|heart block|I44/i,
    cirrhosis: /cirrho|K74|K70\.3/i, nephrotic: /nephrotic|N04/i, obesity: /obesity|E66/i };

  function obsVal(r) { const q = r.valueQuantity; return q && q.value != null ? { v: +q.value, u: q.unit || q.code || "" } : null; }
  function medText(m) {
    let t = label(m.medicationCodeableConcept) || (m.medicationReference && m.medicationReference.display) || "";
    if (!t && m.medicationReference && m.contained) { const c = m.contained.find((x) => m.medicationReference.reference === "#" + x.id); if (c) t = label(c.code); }
    const di = m.dosageInstruction && m.dosageInstruction[0], d = m.dosage && m.dosage.dose, rt = (m.dosage && m.dosage.route && label(m.dosage.route)) || (di && di.route && label(di.route)) || "";
    return [t, d && d.value != null ? d.value + " " + (d.unit || "") : "", rt, di && di.text].filter(Boolean).join(" ").trim();
  }
  const pick = (defs, r) => { const c = codes(r.code), n = label(r.code); return defs.find((d) => (d.loinc.length && c.some((x) => d.loinc.includes(x))) || (d.re.test(n) && !(d.not && d.not.test(n)) && !(d.only && !d.only.test(n)))); };

  /* loop dose in one order or administration -> { drug, mg, iv, perDay } */
  const FREQ = [[/\bqid\b|q6h|four times/i, 4], [/\btid\b|q8h|three times/i, 3], [/\bbid\b|q12h|twice/i, 2]];
  function loopDose(text) {
    const m = text.match(MED.loop); if (!m) return null;
    const mg = (text.match(/(\d+(?:\.\d+)?)\s*mg/i) || [])[1]; if (!mg) return null;
    const iv = /\biv\b|intraven|inj/i.test(text), times = (FREQ.find(([re]) => re.test(text)) || [0, 1])[1];
    return { drug: m[0].toLowerCase(), mg: +mg, iv, times, perDay: +mg * times };
  }

  function parse(raw, opts) {
    const now = (opts && opts.now) || Date.now(), f = { v: {}, l: {}, meds: [], admins: [], cls: {}, prob: {} };
    const p = raw.patient || {};
    f.sex = String(p.gender || "").toLowerCase();
    if (p.birthDate) f.age = Math.floor((now - new Date(p.birthDate).getTime()) / (365.25 * DAY));
    (raw.obs || []).forEach((r) => {
      if (r.status === "entered-in-error" || r.status === "cancelled") return;
      const t = tOf(r); if (t == null) return;
      if ((r.component || []).length) r.component.forEach((c) => { const d = pick(VITALS, c), q = obsVal(c); if (d && q) (f.v[d.id] = f.v[d.id] || []).push({ t, v: q.v }); });
      const q = obsVal(r); if (!q) return;
      const vd = pick(VITALS, r); if (vd) { (f.v[vd.id] = f.v[vd.id] || []).push({ t, v: vd.conv ? vd.conv(q.v, q.u) : q.v }); return; }
      const ld = pick(LABS, r); if (ld) (f.l[ld.id] = f.l[ld.id] || []).push({ t, v: ld.conv ? ld.conv(q.v, q.u) : q.v, u: q.u, name: label(r.code) });
    });
    Object.values(f.v).concat(Object.values(f.l)).forEach((a) => a.sort((x, y) => x.t - y.t));
    (raw.medreqs || []).forEach((m) => { if (["active", "on-hold", "draft"].includes(m.status) || !m.status) f.meds.push({ text: medText(m), status: m.status || "", t: tOf(m) }); });
    (raw.admins || []).forEach((m) => { if (m.status !== "not-done" && m.status !== "entered-in-error") f.admins.push({ text: medText(m), t: tOf(m) }); });
    f.admins.sort((a, b) => a.t - b.t);
    f.allMeds = f.meds.filter((m) => m.status !== "on-hold").map((m) => m.text).concat(f.admins.filter((a) => now - a.t < 2 * DAY).map((a) => a.text));
    Object.entries(MED).forEach(([k, re]) => { f.cls[k] = [...new Set(f.allMeds.filter((x) => re.test(x)))]; });
    // loop diuretic actually given in the last 24 h (furosemide-equivalent), else from the orders
    const R = (typeof window !== "undefined" && window.CHFRules) || (typeof require !== "undefined" ? require("./rules.js") : null);
    let iv24 = 0, po24 = 0;
    f.admins.filter((a) => now - a.t <= DAY).forEach((a) => { const d = loopDose(a.text); if (!d) return; const eq = R.furoPOeq(d.drug, d.mg, d.iv ? "iv" : "po"); if (d.iv && /furos|lasix/.test(d.drug)) iv24 += d.mg; else if (eq) po24 += eq; });
    const ordered = f.meds.filter((m) => m.status !== "on-hold").map((m) => loopDose(m.text)).filter(Boolean);
    f.loop = { iv24, po24, given: iv24 + po24 > 0, orders: ordered,
      ivOrderDaily: ordered.filter((d) => d.iv && /furos|lasix/.test(d.drug)).reduce((a, d) => a + d.perDay, 0) };
    (raw.conditions || []).forEach((c) => {
      if (c.clinicalStatus && /resolved|inactive|remission/.test(codes(c.clinicalStatus).join(" "))) return;
      const n = label(c.code) + " " + codes(c.code).join(" ");
      Object.entries(PROB).forEach(([k, re]) => { if (re.test(n)) f.prob[k] = (f.prob[k] || []).concat(label(c.code)); });
    });
    if (f.v.wt) f.kg = f.v.wt[f.v.wt.length - 1].v;
    if (f.v.ht && f.kg) { const m = f.v.ht[f.v.ht.length - 1].v / 100; if (m > 1) f.bmi = Math.round((f.kg / (m * m)) * 10) / 10; }
    return f;
  }
  const latest = (a, within, now) => { if (!a || !a.length) return null; const x = a[a.length - 1]; return within && (now || Date.now()) - x.t > within ? null : x; };
  /* weight change over the last ~24 h (closest value 18-30 h before the latest) */
  function wtChange(w) {
    if (!w || w.length < 2) return null; const last = w[w.length - 1];
    const prev = w.filter((x) => last.t - x.t >= 18 * HR && last.t - x.t <= 36 * HR).pop();
    return prev ? { d: last.v - prev.v, from: prev, to: last } : null;
  }

  async function gather(client, say) {
    const pid = client.patient.id, errors = [], tell = say || (() => {});
    const iso = (t) => new Date(t).toISOString().slice(0, 10), isoT = (t) => new Date(t).toISOString().replace(/\.\d{3}Z$/, "Z");
    async function get(url, name, pages) {
      const once = () => { let tm; return Promise.race([client.request(url, { pageLimit: pages || 1, flat: true }), new Promise((_, rej) => { tm = setTimeout(() => rej(new Error("timed out after 30 s")), 30000); })]).finally(() => clearTimeout(tm)); };
      const transient = (e) => /timed out|\b50[234]\b|Gateway|Failed to fetch|NetworkError/i.test(String((e && e.message) || e));
      try { const r = (await once().catch((e) => (transient(e) ? new Promise((ok) => setTimeout(ok, 1500)).then(once) : Promise.reject(e)))).filter((x) => x.resourceType && x.resourceType !== "OperationOutcome"); tell(`Loaded ${name} (${r.length})…`); return r; }
      catch (e) { errors.push(`${name}: ${e.message || e}`); return []; }
    }
    const s14 = iso(Date.now() - 14 * DAY), s365 = iso(Date.now() - 365 * DAY);
    const [patient, vitals, labs, older, medreqs, admins, conditions] = await Promise.all([
      (async () => { try { return await client.patient.read(); } catch (e) { errors.push("patient: " + (e.message || e)); return null; } })(),
      get(`Observation?patient=${pid}&category=vital-signs&date=ge${s14}&_count=200`, "vital signs and weights (14 days)", 8),
      get(`Observation?patient=${pid}&category=laboratory&date=ge${s14}&_count=200`, "lab results (14 days)", 8),
      get(`Observation?patient=${pid}&code=http://loinc.org|33762-6,http://loinc.org|30934-4,http://loinc.org|2276-4,http://loinc.org|2502-3,http://loinc.org|3016-3,http://loinc.org|4548-4&date=ge${s365}&_count=100`, "NT-proBNP, iron, TSH, A1c (1 year)", 2),
      get(`MedicationRequest?patient=${pid}&_count=100`, "medication orders", 3),
      get(`MedicationAdministration?patient=${pid}&effective-time=ge${isoT(Date.now() - 3 * DAY)}&_count=100`, "medications given (3 days)", 4),
      get(`Condition?patient=${pid}&category=problem-list-item&_count=50`, "problem list", 2)]);
    const seen = new Set(), obs = vitals.concat(labs, older).filter((o) => (o.id ? (seen.has(o.id) ? false : seen.add(o.id)) : true));
    return { raw: { patient, obs, medreqs, admins, conditions }, errors };
  }

  const api = { parse, gather, latest, wtChange, loopDose, MED, PROB, DAY, HR };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else window.CHFChart = api;
})();
