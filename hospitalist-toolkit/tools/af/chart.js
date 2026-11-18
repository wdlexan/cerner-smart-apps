/* Chart reading for the AF tab. READ-ONLY. parse() turns raw FHIR resources into plain facts; gather() fetches them.
   Tests and drugs are matched by LOINC and then by NAME (UNVERIFIED): something not found here may still be in the chart. */
(function () {
  const DAY = 864e5, HR = 36e5;
  const label = (cc) => (cc && (cc.text || (cc.coding || []).map((c) => c.display).find(Boolean))) || "";
  const codes = (cc) => ((cc && cc.coding) || []).map((c) => String(c.code || ""));
  const tOf = (r) => { const d = r.effectiveDateTime || (r.effectivePeriod && r.effectivePeriod.start) || r.issued || r.authoredOn || r.recordedDate || r.onsetDateTime || ""; const t = d ? new Date(d).getTime() : NaN; return isNaN(t) ? null : t; };
  const mgdl = (f) => (v, u) => (/mg\s*\/\s*dl/i.test(u || "") ? v * f : v);

  const VITALS = [
    { id: "hr", loinc: ["8867-4"], re: /heart rate|pulse/i, not: /variab/i },
    { id: "sbp", loinc: ["8480-6"], re: /systolic/i }, { id: "dbp", loinc: ["8462-4"], re: /diastolic/i },
    { id: "spo2", loinc: ["59408-5", "2708-6"], re: /spo2|oxygen saturation|o2 sat/i },
    { id: "rr", loinc: ["9279-1"], re: /resp(iratory)? rate/i }, { id: "temp", loinc: ["8310-5", "8331-1"], re: /temp/i },
    { id: "wt", loinc: ["29463-7", "3141-9"], re: /body weight|^weight/i }];
  const LABS = [
    { id: "k", loinc: ["2823-3", "6298-4", "32713-0"], re: /potassium|^k\b/i, not: /urine/i },
    { id: "mg", loinc: ["19123-9", "2601-3"], re: /magnesium/i, not: /urine/i, conv: mgdl(0.4114) },
    { id: "cr", loinc: ["2160-0", "38483-4", "14682-9"], re: /creatinine/i, not: /ratio|kinase|clearance|urine/i, conv: mgdl(88.4) },
    { id: "hb", loinc: ["718-7", "20509-6"], re: /hemoglobin|haemoglobin|^hgb\b|^hb\b/i, not: /a1c|glyc|urine/i, conv: (v, u) => (/g\s*\/\s*dl/i.test(u || "") ? v * 10 : v) },
    { id: "plt", loinc: ["777-3", "26515-7"], re: /platelet/i },
    { id: "wbc", loinc: ["6690-2", "26464-8"], re: /\bwbc\b|white blood|leukocyte/i, not: /urine|esterase/i },
    { id: "tsh", loinc: ["3016-3", "11580-8"], re: /\btsh\b|thyrotropin/i },
    { id: "ft4", loinc: ["3024-7", "14920-3"], re: /free t4|thyroxine,? free|ft4/i },
    { id: "trop", loinc: ["89579-7", "67151-1", "6598-7", "10839-9", "42757-5", "49563-0"], re: /troponin/i },
    { id: "bnp", loinc: ["30934-4", "42637-9", "33762-6", "83107-3"], re: /bnp|natriuretic/i },
    { id: "lactate", loinc: ["2524-7", "32693-4", "2519-7"], re: /lactate|lactic/i },
    { id: "alt", loinc: ["1742-6", "1743-4"], re: /\balt\b|alanine/i },
    { id: "inr", loinc: ["6301-6", "34714-6"], re: /\binr\b/i },
    { id: "dig", loinc: ["10535-3"], re: /digoxin/i, conv: (v, u) => (/ng\s*\/\s*ml|ug\s*\/\s*l/i.test(u || "") ? v * 1.28 : v) },
    { id: "glu", loinc: ["2345-7", "2339-0"], re: /glucose/i, not: /urine/i },
    { id: "qtc", loinc: ["8636-3", "8634-8"], re: /\bqtc\b/i }];

  const MEDCLASS = {
    bb: /metoprolol|bisoprolol|carvedilol|atenolol|propranolol|labetalol|nadolol|nebivolol|sotalol|lopressor|betaloc/i,
    dilt: /diltiazem|verapamil|cardizem/i, dig: /digoxin|lanoxin|toloxin/i, amio: /amiodarone|cordarone|dronedarone/i,
    doac: /apixaban|eliquis|rivaroxaban|xarelto|edoxaban|lixiana|dabigatran|pradaxa/i, warf: /warfarin|coumadin/i,
    lmwh: /enoxaparin|dalteparin|tinzaparin|fragmin|lovenox|innohep/i, ufh: /\bheparin\b(?!.*flush)/i,
    antiplt: /aspirin|\basa\b|acetylsalicylic|clopidogrel|ticagrelor|prasugrel/i, nsaid: /ibuprofen|naproxen|diclofenac|ketorolac|celecoxib|meloxicam|indomethacin/i,
    pressor: /norepinephrine|noradrenaline|levophed|epinephrine|adrenaline|phenylephrine|vasopressin|dopamine|dobutamine|milrinone/i,
    abx: /azithromycin|clarithromycin|erythromycin|levofloxacin|moxifloxacin|ciprofloxacin|ceftriaxone|cefuroxime|amoxicillin|piperacillin|tazobactam|meropenem|doxycycline|vancomycin|ampicillin|clavulan/i };

  const PROB = {
    hf: /heart failure|I50|cardiomyopathy|I42|LV dysfunction|reduced ejection/i, htn: /hypertension|I1[0-5]/i, dm: /diabetes|E1[0-4]/i,
    stroke: /stroke|cerebral infarct|I63|I64|transient ischemic|TIA|G45|embolism/i, vascular: /coronary|myocardial infarct|I2[0-5]|peripheral arter|PAD|I70|CABG|PCI|stent/i,
    copd: /copd|chronic obstructive|emphysema|J4[34]/i, asthma: /asthma|J45/i, ckd: /chronic kidney|N18|dialysis|end.stage renal/i, ckd45: /N18\.[45]|N18\.6|stage [45]|dialysis|end.stage renal/i,
    liver: /cirrho|K70\.3|K74|hepatic failure/i, bleed: /gastrointestinal hemorrhage|GI bleed|K92\.[0-2]|intracranial hemorrhage|I6[12]|subdural|hemorrhag/i,
    priorAF: /atrial fibrillation|atrial flutter|I48/i, wpw: /wolff|pre-?excitation|I45\.6/i, pacer: /pacemaker|Z95\.0|ICD in situ|Z95\.81/i,
    thyro: /hyperthyroid|thyrotoxic|E05/i, pneumonia: /pneumonia|J1[2-8]|J69/i, sepsis: /sepsis|septic|A41|R65\.2/i, pe: /pulmonary embol|I26/i,
    dementia: /dementia|F0[0-3]|G30/i, falls: /fall|W1[0-9]|R29\.6/i, alcohol: /alcohol|F10/i, mech: /mechanical (heart )?valve|Z95\.2/i, ms: /mitral stenosis|I05\.0|I34\.2/i };

  function obsVal(r) { const q = r.valueQuantity; return q && q.value != null ? { v: +q.value, u: q.unit || q.code || "" } : null; }
  function medText(m) {
    let t = label(m.medicationCodeableConcept) || (m.medicationReference && m.medicationReference.display) || "";
    if (!t && m.medicationReference && m.contained) { const c = m.contained.find((x) => m.medicationReference.reference === "#" + x.id); if (c) t = label(c.code); }
    const di = m.dosageInstruction && m.dosageInstruction[0], d = m.dosage && m.dosage.dose;
    return [t, d && d.value != null ? d.value + " " + (d.unit || "") : "", di && di.text].filter(Boolean).join(" ").trim();
  }
  const pick = (defs, r) => { const c = codes(r.code), n = label(r.code); return defs.find((d) => c.some((x) => d.loinc.includes(x)) || (d.re.test(n) && !(d.not && d.not.test(n)))); };

  function parse(raw, opts) {
    const now = (opts && opts.now) || Date.now(), f = { v: {}, l: {}, meds: [], admins: [], cls: {}, prob: {}, probText: [] };
    const p = raw.patient || {};
    f.sex = String(p.gender || "").toLowerCase();
    if (p.birthDate) f.age = Math.floor((now - new Date(p.birthDate).getTime()) / (365.25 * DAY));
    (raw.obs || []).forEach((r) => {
      if (r.status === "entered-in-error" || r.status === "cancelled") return;
      const t = tOf(r); if (t == null) return;
      // blood pressure panel
      if ((r.component || []).length) r.component.forEach((c) => { const d = pick(VITALS, c), q = obsVal(c); if (d && q) (f.v[d.id] = f.v[d.id] || []).push({ t, v: q.v }); });
      const q = obsVal(r); if (!q) return;
      const vd = pick(VITALS, r); if (vd) { (f.v[vd.id] = f.v[vd.id] || []).push({ t, v: q.v }); return; }
      const ld = pick(LABS, r); if (ld) (f.l[ld.id] = f.l[ld.id] || []).push({ t, v: ld.conv ? ld.conv(q.v, q.u) : q.v, u: q.u, name: label(r.code) });
    });
    Object.values(f.v).concat(Object.values(f.l)).forEach((a) => a.sort((x, y) => x.t - y.t));
    (raw.medreqs || []).forEach((m) => { if (["active", "on-hold", "draft"].includes(m.status) || !m.status) f.meds.push({ text: medText(m), status: m.status || "", t: tOf(m) }); });
    (raw.admins || []).forEach((m) => { if (m.status !== "not-done" && m.status !== "entered-in-error") f.admins.push({ text: medText(m), t: tOf(m) }); });
    f.admins.sort((a, b) => a.t - b.t);
    const all = f.meds.filter((m) => m.status !== "on-hold").map((m) => m.text).concat(f.admins.filter((a) => now - a.t < 2 * DAY).map((a) => a.text));
    f.allMeds = all;
    Object.entries(MEDCLASS).forEach(([k, re]) => { f.cls[k] = all.filter((x) => re.test(x)); });
    f.heldBB = f.meds.filter((m) => m.status === "on-hold" && MEDCLASS.bb.test(m.text)).map((m) => m.text);
    f.lmwhTherapeutic = f.cls.lmwh.some((x) => /1\s*mg\s*\/\s*kg|1\.5\s*mg\s*\/\s*kg|bid|q12h|\b(60|70|80|90|100|120)\s*mg/i.test(x));
    (raw.conditions || []).forEach((c) => {
      if (c.clinicalStatus && /resolved|inactive|remission/.test(codes(c.clinicalStatus).join(" "))) return;
      if (c.verificationStatus && /refuted|entered-in-error/.test(codes(c.verificationStatus).join(" "))) return;
      const n = label(c.code) + " " + codes(c.code).join(" "); f.probText.push(label(c.code));
      Object.entries(PROB).forEach(([k, re]) => { if (re.test(n)) f.prob[k] = (f.prob[k] || []).concat(label(c.code)); });
    });
    if (f.v.wt) f.kg = f.v.wt[f.v.wt.length - 1].v;
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
    const s3 = iso(Date.now() - 3 * DAY), s30 = iso(Date.now() - 30 * DAY);
    const [patient, vitals, labs, medreqs, admins, conditions] = await Promise.all([
      (async () => { try { return await client.patient.read(); } catch (e) { errors.push("patient: " + (e.message || e)); return null; } })(),
      get(`Observation?patient=${pid}&category=vital-signs&date=ge${s3}&_count=200`, "vital signs (3 days)", 6),
      get(`Observation?patient=${pid}&category=laboratory&date=ge${s30}&_count=200`, "lab results (30 days)", 8),
      get(`MedicationRequest?patient=${pid}&_count=100`, "medication orders", 3),
      get(`MedicationAdministration?patient=${pid}&effective-time=ge${isoT(Date.now() - 3 * DAY)}&_count=100`, "medications given (3 days)", 4),
      get(`Condition?patient=${pid}&category=problem-list-item&_count=50`, "problem list", 2)]);
    return { raw: { patient, obs: vitals.concat(labs), medreqs, admins, conditions }, errors };
  }

  const api = { parse, gather, latest, MEDCLASS, PROB, DAY, HR };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else window.AFChart = api;
})();
