/* Chart reading for the NSTEMI tab. READ-ONLY. parse() turns raw FHIR resources into plain facts; gather() fetches them.
   Tests and drugs are matched by LOINC and then by NAME (UNVERIFIED): something not found here may still be in the chart. */
(function () {
  const DAY = 864e5, HR = 36e5;
  const label = (cc) => (cc && (cc.text || (cc.coding || []).map((c) => c.display).find(Boolean))) || "";
  const codes = (cc) => ((cc && cc.coding) || []).map((c) => String(c.code || ""));
  const tOf = (r) => { const d = r.effectiveDateTime || (r.effectivePeriod && r.effectivePeriod.start) || r.issued || r.authoredOn || r.recordedDate || ""; const t = d ? new Date(d).getTime() : NaN; return isNaN(t) ? null : t; };
  const mgdl = (f) => (v, u) => (/mg\s*\/\s*dl/i.test(u || "") ? v * f : v);
  const URINE = /urine|\bur\b|random urine/i;
  // troponin: ug/L and ng/mL (old assays, e.g. 0.04) -> ng/L
  const tropConv = (v, u) => (/ug\s*\/\s*l|µg\s*\/\s*l|mcg\s*\/\s*l|ng\s*\/\s*ml/i.test(u || "") ? v * 1000 : v);

  const VITALS = [
    { id: "hr", loinc: ["8867-4"], re: /heart rate|pulse/i }, { id: "sbp", loinc: ["8480-6"], re: /systolic/i }, { id: "dbp", loinc: ["8462-4"], re: /diastolic/i },
    { id: "spo2", loinc: ["59408-5", "2708-6"], re: /spo2|oxygen saturation/i }, { id: "rr", loinc: ["9279-1"], re: /resp(iratory)? rate/i },
    { id: "wt", loinc: ["29463-7", "3141-9", "8350-1"], re: /body weight|^weight|daily weight/i, conv: (v, u) => (/lb/i.test(u || "") ? v * 0.4536 : v) }];
  const LABS = [
    { id: "trop", loinc: ["89579-7", "67151-1", "6598-7", "10839-9", "42757-5", "49563-0", "48425-3", "67015-8"], re: /troponin/i, conv: tropConv },
    { id: "hb", loinc: ["718-7"], re: /hemoglobin|haemoglobin|^hgb/i, not: /a1c|glyc|urine/i, conv: (v, u) => (/g\s*\/\s*dl/i.test(u || "") ? v * 10 : v) },
    { id: "plt", loinc: ["777-3", "26515-7"], re: /platelet/i, not: /volume|mpv/i }, { id: "wbc", loinc: ["6690-2", "26464-8"], re: /\bwbc\b|white blood|leukocyte/i, not: URINE },
    { id: "cr", loinc: ["2160-0", "38483-4"], re: /creatinine/i, not: /ratio|kinase|clearance|urine/i, conv: mgdl(88.4) },
    { id: "egfr", loinc: ["33914-3", "62238-1", "98979-8", "48642-3", "48643-1"], re: /egfr|glomerular filtration/i },
    { id: "k", loinc: ["2823-3", "6298-4"], re: /potassium/i, not: URINE }, { id: "mg", loinc: ["19123-9", "2601-3"], re: /magnesium/i, not: URINE, conv: mgdl(0.4114) },
    { id: "ldl", loinc: ["13457-7", "18262-6", "2089-1"], re: /\bldl\b|low density/i, conv: mgdl(0.02586) },
    { id: "a1c", loinc: ["4548-4", "17856-6"], re: /a1c|glycated/i }, { id: "inr", loinc: ["6301-6", "34714-6"], re: /\binr\b/i },
    { id: "tsh", loinc: ["3016-3", "11580-8"], re: /\btsh\b|thyrotropin/i }, { id: "lactate", loinc: ["2524-7", "32693-4"], re: /lactate|lactic/i },
    { id: "nt", loinc: ["33762-6", "83107-3"], re: /nt-?pro ?bnp/i }, { id: "qtc", loinc: ["8636-3", "76635-1"], re: /qtc/i }];

  const MED = {
    asa: /aspirin|\basa\b|acetylsalicylic/i, tic: /ticagrelor|brilinta/i, pra: /prasugrel|effient/i, clop: /clopidogrel|plavix/i,
    doac: /apixaban|eliquis|rivaroxaban|xarelto|edoxaban|lixiana|dabigatran|pradaxa/i, warf: /warfarin|coumadin/i,
    lmwh: /enoxaparin|lovenox|dalteparin|fragmin|tinzaparin|innohep/i, ufh: /\bheparin\b/i, fond: /fondaparinux|arixtra/i,
    statin: /atorvastatin|rosuvastatin|simvastatin|pravastatin|lovastatin|fluvastatin|pitavastatin/i, eze: /ezetimibe/i, pcsk9: /evolocumab|alirocumab|inclisiran/i,
    bb: /bisoprolol|carvedilol|metoprolol|nebivolol|atenolol|propranolol|labetalol/i, acei: /ramipril|enalapril|lisinopril|perindopril|trandolapril|captopril|quinapril/i,
    arb: /candesartan|valsartan|losartan|irbesartan|telmisartan|olmesartan/i, arni: /sacubitril|entresto/i, mra: /spironolactone|eplerenone|aldactone|inspra/i,
    sglt2: /dapagliflozin|forxiga|empagliflozin|jardiance|canagliflozin|invokana/i, nitro: /nitroglycerin|glyceryl trinitrate|isosorbide|nitro-?dur/i,
    ppi: /pantoprazole|omeprazole|esomeprazole|lansoprazole|rabeprazole|dexlansoprazole/i, nsaid: /ibuprofen|naproxen|diclofenac|ketorolac|celecoxib|meloxicam|indomethacin/i,
    steroid: /prednisone|dexamethasone|methylprednisolone|hydrocortisone/i, pde5: /sildenafil|tadalafil|vardenafil/i, ndhp: /diltiazem|verapamil/i,
    cyp3a4: /clarithromycin|ketoconazole|itraconazole|voriconazole|posaconazole|ritonavir|cobicistat|nefazodone|rifampin|rifampicin|carbamazepine|phenytoin|phenobarbital/i,
    pressor: /norepinephrine|levophed|epinephrine|vasopressin|phenylephrine|dopamine|dobutamine|milrinone/i, abx: /cefazolin|ceftriaxone|piperacillin|meropenem|vancomycin|azithromycin|ciprofloxacin|levofloxacin|moxifloxacin|amoxicillin|ampicillin|clindamycin|doxycycline|metronidazole|ertapenem|cefepime|ceftazidime|gentamicin/i,
    insulin: /insulin/i, cocaine: /cocaine/i };
  const PROB = {
    cad: /coronary|ischemic heart|myocardial infarct|I2[0-5]|CABG|stent|angina|Z95\.[15]/i, priorPCI: /stent|PCI|Z95\.5|angioplasty/i, priorCABG: /CABG|bypass graft|Z95\.1/i,
    dm: /diabetes|E1[0-4]/i, htn: /hypertension|I1[0-5]/i, lipid: /hyperlipid|dyslipid|hypercholest|E78/i, smoke: /tobacco|smok|nicotine|F17|Z72\.0/i,
    fhx: /family history.*(coronary|ischemic|heart)|Z82\.4/i, hf: /heart failure|I50|cardiomyopathy|I42/i, af: /atrial fib|flutter|I48/i,
    ich: /intracranial hem|intracerebral hem|subarachnoid|subdural|I6[0-2]|arteriovenous malformation/i, stroke: /stroke|cerebral infarct|cerebrovascular|I63|TIA|transient ischemic|G45/i,
    gibleed: /GI bleed|gastrointestinal hem|melena|hematemesis|K92\.[012]|peptic ulcer|K2[5-8]/i, bleedDx: /hemophilia|von willebrand|D6[6-8]|thrombocytopenia|D69\.[3-6]/i,
    cirrhosis: /cirrho|K74|K70\.3|portal hypertension|K76\.6|varices|I85/i, cancer: /malignan|cancer|carcinoma|lymphoma|leukemia|myeloma|C[0-9]{2}/i, ckd: /chronic kidney|N18|dialysis|Z99\.2/i,
    dialysis: /dialysis|N18\.6|Z99\.2|end.stage renal/i, dementia: /dementia|alzheimer|F0[0-3]|G30/i, copd: /copd|J44|emphysema/i, asthma: /asthma|J45/i,
    sepsis: /sepsis|septic|A41|R65\.2/i, pneumonia: /pneumonia|J1[2-8]/i, anemia: /anemia|D6[2-4]/i, pe: /pulmonary embol|I26/i, mechValve: /mechanical (heart )?valve|Z95\.2/i,
    vte: /deep vein|DVT|venous thromb|I82/i, as: /aortic stenosis|I35\.0/i, pacer: /pacemaker|Z95\.0/i, avb: /heart block|AV block|I44\.[12]/i, frailty: /frail|R54/i, hit: /heparin.induced|HIT\b|D75\.82/i, pvd: /peripheral (arterial|vascular)|I70\.2|I73\.9/i };

  function obsVal(r) { const q = r.valueQuantity; return q && q.value != null ? { v: +q.value, u: q.unit || q.code || "" } : null; }
  function medText(m) {
    let t = label(m.medicationCodeableConcept) || (m.medicationReference && m.medicationReference.display) || "";
    if (!t && m.medicationReference && m.contained) { const c = m.contained.find((x) => m.medicationReference.reference === "#" + x.id); if (c) t = label(c.code); }
    const di = m.dosageInstruction && m.dosageInstruction[0], d = m.dosage && m.dosage.dose, rt = (m.dosage && m.dosage.route && label(m.dosage.route)) || (di && di.route && label(di.route)) || "";
    return [t, d && d.value != null ? d.value + " " + (d.unit || "") : "", rt, di && di.text].filter(Boolean).join(" ").trim();
  }
  const pick = (defs, r) => { const c = codes(r.code), n = label(r.code); return defs.find((d) => (d.loinc.length && c.some((x) => d.loinc.includes(x))) || (d.re.test(n) && !(d.not && d.not.test(n)) && !(d.only && !d.only.test(n)))); };

  function parse(raw, opts) {
    const now = (opts && opts.now) || Date.now(), f = { v: {}, l: {}, meds: [], admins: [], cls: {}, prob: {}, probText: [], tropName: "" };
    const p = raw.patient || {};
    f.sex = String(p.gender || "").toLowerCase();
    if (p.birthDate) f.age = Math.floor((now - new Date(p.birthDate).getTime()) / (365.25 * DAY));
    (raw.obs || []).forEach((r) => {
      if (r.status === "entered-in-error" || r.status === "cancelled") return;
      const t = tOf(r); if (t == null) return;
      if ((r.component || []).length) r.component.forEach((c) => { const d = pick(VITALS, c), q = obsVal(c); if (d && q) (f.v[d.id] = f.v[d.id] || []).push({ t, v: q.v }); });
      const q = obsVal(r); if (!q) return;
      const vd = pick(VITALS, r); if (vd) { (f.v[vd.id] = f.v[vd.id] || []).push({ t, v: vd.conv ? vd.conv(q.v, q.u) : q.v }); return; }
      const ld = pick(LABS, r); if (!ld) return;
      if (ld.id === "trop" && !f.tropName) f.tropName = label(r.code);
      (f.l[ld.id] = f.l[ld.id] || []).push({ t, v: Math.round((ld.conv ? ld.conv(q.v, q.u) : q.v) * 100) / 100 });
    });
    Object.values(f.v).concat(Object.values(f.l)).forEach((a) => a.sort((x, y) => x.t - y.t));
    (raw.medreqs || []).forEach((m) => { if (/entered-in-error|cancelled|stopped|completed/.test(m.status || "")) return; const text = medText(m); if (text) f.meds.push({ text, status: m.status || "", t: tOf(m) }); });
    (raw.admins || []).forEach((m) => { if (m.status && m.status !== "completed" && m.status !== "in-progress") return; const text = medText(m), t = tOf(m); if (text && t) f.admins.push({ text, t }); });
    f.admins.sort((a, b) => a.t - b.t);
    const all = f.meds.filter((m) => m.status !== "on-hold").map((m) => m.text).concat(f.admins.filter((a) => now - a.t < 2 * DAY).map((a) => a.text));
    f.allMeds = all;
    Object.entries(MED).forEach(([k, re]) => { f.cls[k] = [...new Set(all.filter((x) => re.test(x)))]; });
    f.cls.ufh = f.cls.ufh.filter((x) => !MED.lmwh.test(x));
    f.heparinTx = f.cls.lmwh.some((x) => /1\s*mg\s*\/\s*kg|bid|q12h|\b([6-9]\d|1[0-4]\d)\s*mg/i.test(x)) || f.cls.ufh.some((x) => /infusion|units?\s*\/\s*(kg\s*\/\s*)?h|drip|nomogram|bolus/i.test(x)) || f.cls.fond.some((x) => /\b(5|7\.5|10)\s*mg/i.test(x));
    f.asaHigh = f.cls.asa.some((x) => /\b(160|162|325|650)\s*mg/i.test(x) && !/load|once|stat|x\s*1/i.test(x));
    f.heldBB = f.meds.filter((m) => m.status === "on-hold" && MED.bb.test(m.text)).map((m) => m.text);
    (raw.conditions || []).forEach((c) => {
      if (c.clinicalStatus && /resolved|inactive|remission/.test(codes(c.clinicalStatus).join(" "))) return;
      if (c.verificationStatus && /refuted|entered-in-error/.test(codes(c.verificationStatus).join(" "))) return;
      const n = label(c.code) + " " + codes(c.code).join(" "); f.probText.push(label(c.code));
      Object.entries(PROB).forEach(([k, re]) => { if (re.test(n)) f.prob[k] = (f.prob[k] || []).concat(label(c.code)); });
    });
    if (f.v.wt) f.kg = Math.round(f.v.wt[f.v.wt.length - 1].v * 10) / 10;
    f.tropT = /\btnt\b|troponin\s*t\b|troponin t/i.test(f.tropName);
    return f;
  }
  const latest = (a, within, now) => { if (!a || !a.length) return null; const x = a[a.length - 1]; return within && (now || Date.now()) - x.t > within ? null : x; };

  async function gather(client, say) {
    const pid = client.patient.id, errors = [], tell = say || (() => {});
    const iso = (t) => new Date(t).toISOString().slice(0, 10), isoT = (t) => new Date(t).toISOString().replace(/\.\d{3}Z$/, "Z");
    async function get(url, name, pages) {
      const once = () => { let tm; return Promise.race([client.request(url, { pageLimit: pages || 1, flat: true }), new Promise((_, rej) => { tm = setTimeout(() => rej(new Error("timed out after 30 s")), 30000); })]).finally(() => clearTimeout(tm)); };
      const transient = (e) => /timed out|\b50[234]\b|Gateway|Failed to fetch|NetworkError/i.test(String((e && e.message) || e));
      try { const r = (await once().catch((e) => (transient(e) ? new Promise((ok) => setTimeout(ok, 1500)).then(once) : Promise.reject(e)))).filter((x) => x.resourceType && x.resourceType !== "OperationOutcome"); tell(`Loaded ${name} (${r.length})…`); return r; }
      catch (e) { errors.push(`${name}: ${e.message || e}`); return []; }
    }
    const s3 = iso(Date.now() - 3 * DAY), s365 = iso(Date.now() - 365 * DAY);
    const [patient, vitals, labs, medreqs, admins, conditions] = await Promise.all([
      (async () => { try { return await client.patient.read(); } catch (e) { errors.push("patient: " + (e.message || e)); return null; } })(),
      get(`Observation?patient=${pid}&category=vital-signs&date=ge${s3}&_count=200`, "vital signs (3 days)", 6),
      get(`Observation?patient=${pid}&category=laboratory&date=ge${s365}&_count=200`, "lab results (1 year)", 10),
      get(`MedicationRequest?patient=${pid}&_count=100`, "medication orders", 3),
      get(`MedicationAdministration?patient=${pid}&effective-time=ge${isoT(Date.now() - 3 * DAY)}&_count=100`, "medications given (3 days)", 4),
      get(`Condition?patient=${pid}&_count=100`, "problem list", 2)]);
    return { raw: { patient, obs: vitals.concat(labs), medreqs, admins, conditions }, errors };
  }

  const api = { parse, gather, latest, MED, PROB, DAY, HR };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else window.ACSChart = api;
})();
