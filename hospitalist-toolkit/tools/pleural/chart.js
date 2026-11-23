/* Chart reading for the Pleural effusion tab. READ-ONLY. parse() turns raw FHIR resources into plain facts; gather() fetches them.
   Pleural fluid results are found by NAME ("pleural", "body fluid") and blood results by LOINC then name (UNVERIFIED):
   something not found here may still be in the chart, so every fluid value can be typed in. */
(function () {
  const DAY = 864e5, HR = 36e5;
  const label = (cc) => (cc && (cc.text || (cc.coding || []).map((c) => c.display).find(Boolean))) || "";
  const codes = (cc) => ((cc && cc.coding) || []).map((c) => String(c.code || ""));
  const tOf = (r) => { const d = r.effectiveDateTime || (r.effectivePeriod && r.effectivePeriod.start) || r.issued || r.authoredOn || r.recordedDate || ""; const t = d ? new Date(d).getTime() : NaN; return isNaN(t) ? null : t; };
  const mgdl = (f) => (v, u) => (/mg\s*\/\s*dl/i.test(u || "") ? v * f : v);
  const gdl = (v, u) => (/g\s*\/\s*dl/i.test(u || "") ? v * 10 : v);
  const FLUID = /pleural|body fluid|thoracentesis|chest fluid|\bpf\b/i;
  const OTHERFLUID = /csf|cerebrospinal|peritoneal|ascit|synovial|joint|pericardial|urine|drain output/i;
  const PCT = /%/;

  // pleural fluid analytes (name contains a FLUID word)
  const PF = [
    { id: "prot", re: /protein/i, not: /electro|c.reactive/i, conv: gdl }, { id: "ldh", re: /\bldh?\b|lactate dehydrogenase/i },
    { id: "glu", re: /glucose/i, conv: mgdl(0.0555) }, { id: "ph", re: /\bph\b/i }, { id: "alb", re: /albumin/i, conv: gdl },
    { id: "tg", re: /triglycer/i, conv: mgdl(0.01129) }, { id: "chol", re: /cholesterol/i, conv: mgdl(0.02586) },
    { id: "hct", re: /hematocrit|haematocrit|\bhct\b/i }, { id: "cr", re: /creatinine/i, conv: mgdl(88.4) }, { id: "amy", re: /amylase/i },
    { id: "ada", re: /adenosine deaminase|\bada\b/i }, { id: "bnp", re: /nt-?pro ?bnp|bnp/i },
    { id: "neutPct", re: /neutro|poly|segment/i, unit: PCT }, { id: "lymphPct", re: /lymph/i, unit: PCT }, { id: "eosPct", re: /eosin/i, unit: PCT },
    { id: "wbc", re: /wbc|white|nucleated|leukocyte/i, noUnit: PCT }, { id: "rbc", re: /\brbc\b|red (blood )?cell/i, noUnit: PCT }];
  const PFTEXT = { cyto: /cytolog/i, gram: /gram stain/i, culture: /culture/i, appearance: /appearance|colou?r|clarity/i, afb: /afb|acid.fast|mycobact/i };
  const VITALS = [{ id: "spo2", loinc: ["59408-5", "2708-6"], re: /spo2|oxygen saturation|oximetry/i }, { id: "rr", loinc: ["9279-1"], re: /resp(iratory)? rate/i },
    { id: "temp", loinc: ["8310-5", "8331-1"], re: /temp/i, conv: (v, u) => (/f/i.test(u || "") || v > 50 ? Math.round(((v - 32) * 5 / 9) * 10) / 10 : v) },
    { id: "sbp", loinc: ["8480-6"], re: /systolic/i }, { id: "hr", loinc: ["8867-4"], re: /heart rate|pulse/i, not: /oxim/i }, { id: "o2", loinc: ["3151-8"], re: /o2 flow|oxygen flow|flow rate/i }];
  const LABS = [
    { id: "prot", loinc: ["2885-2"], re: /protein,? total|total protein/i, not: /urine/i, conv: gdl }, { id: "ldh", loinc: ["2532-0", "14804-9"], re: /\bldh?\b|lactate dehydrogenase/i, not: /urine/i },
    { id: "alb", loinc: ["1751-7"], re: /albumin/i, not: /urine|micro|ratio/i, conv: gdl }, { id: "glu", loinc: ["2345-7", "2339-0"], re: /glucose/i, not: /urine|meter|poc/i, conv: mgdl(0.0555) },
    { id: "cr", loinc: ["2160-0", "38483-4"], re: /creatinine/i, not: /ratio|kinase|clearance|urine/i, conv: mgdl(88.4) },
    { id: "urea", loinc: ["3094-0", "22664-7", "6299-2"], re: /\burea\b|\bbun\b/i, not: /urine/i, conv: (v, u) => (/mg\s*\/\s*dl/i.test(u || "") ? v * 0.357 : v) },
    { id: "hct", loinc: ["4544-3", "20570-8"], re: /hematocrit|\bhct\b/i }, { id: "hb", loinc: ["718-7"], re: /hemoglobin|^hgb/i, not: /a1c|glyc|urine/i, conv: gdl },
    { id: "wbc", loinc: ["6690-2", "26464-8"], re: /\bwbc\b|white blood|leukocyte/i }, { id: "anc", loinc: ["751-8", "26499-4"], re: /neutrophil/i, noUnit: PCT }, { id: "lymph", loinc: ["731-0", "26474-7"], re: /lymphocyte/i, noUnit: PCT, not: /atypical/i },
    { id: "plt", loinc: ["777-3", "26515-7"], re: /platelet/i, not: /volume|mpv/i }, { id: "inr", loinc: ["6301-6", "34714-6"], re: /\binr\b/i }, { id: "ptt", loinc: ["3173-2", "14979-9"], re: /\bptt\b|aptt/i },
    { id: "nt", loinc: ["33762-6", "83107-3"], re: /nt-?pro ?bnp/i }, { id: "crp", loinc: ["1988-5"], re: /\bcrp\b|c.reactive/i, conv: (v, u) => (/mg\s*\/\s*dl/i.test(u || "") ? v * 10 : v) },
    { id: "amy", loinc: ["1798-8"], re: /amylase/i }, { id: "na", loinc: ["2951-2"], re: /sodium/i, not: /urine/i }];
  const DRAIN = /chest tube|chest drain|pleural drain|thoracostomy|pleural catheter|\bipc\b|pleurx|aspira/i;
  const MED = {
    anticoag: /apixaban|rivaroxaban|edoxaban|dabigatran|warfarin|heparin infusion|enoxaparin\s*(1\s*mg|[6-9]\d|1[0-4]\d)|dalteparin\s*\d{4,}|tinzaparin/i,
    proph: /enoxaparin\s*(30|40)\s*mg|heparin\s*5,?000|dalteparin\s*5,?000/i, antiplatelet: /clopidogrel|ticagrelor|prasugrel/i, asa: /aspirin|\basa\b/i,
    diuretic: /furosemide|lasix|bumetanide|torsemide|hydrochlorothiazide|chlorthalidone|metolazone|spironolactone|eplerenone|indapamide/i,
    abx: /cefazolin|ceftriaxone|cefepime|ceftazidime|piperacillin|meropenem|ertapenem|vancomycin|amoxicillin|clavul|metronidazole|clindamycin|levofloxacin|moxifloxacin|ciprofloxacin|azithromycin|doxycycline|sulfamethoxazole|linezolid/i,
    causative: /amiodarone|methotrexate|nitrofurantoin|dasatinib|bosutinib|imatinib|bromocriptine|cabergoline|pergolide|ergotamine|dantrolene|valproate|phenytoin|hydralazine|procainamide|isoniazid|minoxidil|nivolumab|pembrolizumab|ipilimumab|gemcitabine|docetaxel|clozapine|propylthiouracil|interleukin/i,
    steroid: /prednisone|dexamethasone|methylprednisolone|hydrocortisone/i };
  const PROB = {
    hf: /heart failure|I50|cardiomyopathy|I42/i, cirrhosis: /cirrho|K74|K70\.3|portal hypertension|hepatic hydrothorax/i, ascites: /ascites|R18/i, ckd: /chronic kidney|N18/i, dialysis: /dialysis|N18\.6|Z99\.2|end.stage renal/i,
    nephrotic: /nephrotic|N04/i, pd: /peritoneal dialysis/i, pneumonia: /pneumonia|J1[2-8]|empyema|J86|lung abscess/i, pe: /pulmonary embol|I26/i, tb: /tuberculosis|\btb\b|A15|A16|Z22\.7|R76\.1/i,
    ra: /rheumatoid|M05|M06/i, sle: /lupus|M32/i, cabg: /CABG|bypass graft|cardiac surgery|valve replacement|Z95\.1|Dressler/i, pancreatitis: /pancreatitis|K85|K86\.1|pseudocyst/i,
    asbestos: /asbestos|J61|mesothelioma/i, trauma: /rib fracture|S22|hemothorax|chest trauma|S27/i, lungCa: /lung cancer|bronch.*carcinoma|C34|NSCLC|small cell|adenocarcinoma of (the )?lung/i,
    breastCa: /breast cancer|C50|carcinoma of (the )?breast/i, lymphoma: /lymphoma|C8[1-6]|C88|hodgkin/i, meso: /mesothelioma|C45/i, heme: /leukemia|myeloma|C9[0-5]/i, ovary: /ovar|C56|endometri|uterine|cervical|C5[3-5]/i,
    kidneyCa: /renal cell|kidney cancer|C64/i, cancer: /malignan|cancer|carcinoma|lymphoma|leukemia|myeloma|sarcoma|mesothelioma|metasta|C[0-9]{2}/i };
  const IMG = /chest|thorax|thoracic|pleural|lung|cxr|ct ca[p]?|pet/i;

  function obsVal(r) { const q = r.valueQuantity; return q && q.value != null ? { v: +q.value, u: q.unit || q.code || "" } : null; }
  function obsText(r) { return r.valueString || label(r.valueCodeableConcept) || ""; }
  function medText(m) {
    let t = label(m.medicationCodeableConcept) || (m.medicationReference && m.medicationReference.display) || "";
    if (!t && m.medicationReference && m.contained) { const c = m.contained.find((x) => m.medicationReference.reference === "#" + x.id); if (c) t = label(c.code); }
    const di = m.dosageInstruction && m.dosageInstruction[0], dt = di && di.text;
    if (dt && t && dt.toLowerCase().includes(t.toLowerCase())) return dt.trim();
    return [t, dt].filter(Boolean).join(" ").trim();
  }
  const fits = (d, n, unit) => d.re.test(n) && !(d.not && d.not.test(n)) && !(d.unit && !d.unit.test(unit || "")) && !(d.noUnit && d.noUnit.test(unit || ""));
  const pick = (defs, r, unit) => { const c = codes(r.code), n = label(r.code); return defs.find((d) => (d.loinc && d.loinc.length && c.some((x) => d.loinc.includes(x))) || fits(d, n, unit)); };

  function parse(raw, opts) {
    const now = (opts && opts.now) || Date.now(), f = { v: {}, l: {}, pf: {}, pft: {}, drain: [], reports: [], meds: [], cls: {}, prob: {}, probText: [] };
    const p = raw.patient || {};
    f.sex = String(p.gender || "").toLowerCase();
    if (p.birthDate) f.age = Math.floor((now - new Date(p.birthDate).getTime()) / (365.25 * DAY));
    (raw.obs || []).forEach((r) => {
      if (r.status === "entered-in-error" || r.status === "cancelled") return;
      const t = tOf(r); if (t == null) return;
      const name = label(r.code), q = obsVal(r), pending = /registered|preliminary/.test(r.status || "");
      if (DRAIN.test(name) && q) { f.drain.push({ t, v: q.v, name }); return; }
      if (FLUID.test(name) && !OTHERFLUID.test(name)) {
        const txtDef = Object.entries(PFTEXT).find(([, re]) => re.test(name));
        if (txtDef && !q) { (f.pft[txtDef[0]] = f.pft[txtDef[0]] || []).push({ t, text: obsText(r), pending, name }); return; }
        if (q) { const d = PF.find((x) => fits(x, name, q.u)); if (d) (f.pf[d.id] = f.pf[d.id] || []).push({ t, v: Math.round((d.conv ? d.conv(q.v, q.u) : q.v) * 100) / 100 }); }
        return;
      }
      if (OTHERFLUID.test(name)) return;
      if (q) {
        const vd = pick(VITALS, r, q.u); if (vd) { (f.v[vd.id] = f.v[vd.id] || []).push({ t, v: vd.conv ? vd.conv(q.v, q.u) : q.v }); return; }
        const ld = pick(LABS, r, q.u); if (ld) (f.l[ld.id] = f.l[ld.id] || []).push({ t, v: Math.round((ld.conv ? ld.conv(q.v, q.u) : q.v) * 100) / 100 });
      }
    });
    [f.v, f.l, f.pf, f.pft].forEach((o) => Object.values(o).forEach((a) => a.sort((x, y) => x.t - y.t)));
    f.drain.sort((a, b) => a.t - b.t);
    f.drain24 = f.drain.length ? f.drain.filter((d) => now - d.t <= DAY).reduce((a, d) => a + d.v, 0) : null;
    (raw.reports || []).forEach((r) => {
      if (/entered-in-error|cancelled/.test(r.status || "")) return;
      const name = label(r.code); if (!IMG.test(name)) return;
      f.reports.push({ t: tOf(r) || (r.issued ? new Date(r.issued).getTime() : null), name, text: r.conclusion || "", pending: /registered|partial|preliminary/.test(r.status || "") });
    });
    f.reports.sort((a, b) => (a.t || 0) - (b.t || 0));
    (raw.medreqs || []).forEach((m) => { if (/entered-in-error|cancelled|stopped|completed/.test(m.status || "")) return; const text = medText(m); if (text) f.meds.push({ text, status: m.status || "", t: tOf(m) }); });
    const all = f.meds.filter((m) => m.status !== "on-hold").map((m) => m.text);
    Object.entries(MED).forEach(([k, re]) => { f.cls[k] = [...new Set(all.filter((x) => re.test(x)))]; });
    f.cls.anticoag = f.cls.anticoag.filter((x) => !MED.proph.test(x));
    (raw.conditions || []).forEach((c) => {
      if (c.clinicalStatus && /resolved|inactive|remission/.test(codes(c.clinicalStatus).join(" "))) return;
      const n = label(c.code) + " " + codes(c.code).join(" "); f.probText.push(label(c.code));
      Object.entries(PROB).forEach(([k, re]) => { if (re.test(n)) f.prob[k] = (f.prob[k] || []).concat(label(c.code)); });
    });
    if (raw.encounter && raw.encounter.period && raw.encounter.period.start) f.admitT = new Date(raw.encounter.period.start).getTime();
    return f;
  }
  const latest = (a, within, now) => { if (!a || !a.length) return null; const x = a[a.length - 1]; return within && (now || Date.now()) - x.t > within ? null : x; };
  // text result -> pos/neg/atypical
  function cytoRead(s) { s = s || ""; if (/atypical|suspicious|indeterminate/i.test(s)) return "atypical"; if (/negative for malig|no malignant|benign|reactive|negative/i.test(s)) return "neg"; if (/malignan|carcinoma|lymphoma|positive|mesothelioma|metasta/i.test(s)) return "pos"; return ""; }
  function microRead(s) { s = s || ""; if (/no growth|no organisms|negative|not seen|none seen/i.test(s)) return "neg"; if (/positive|gram.(positive|negative)|cocci|rods|bacilli|growth of|isolated|streptococcus|staphylococcus|anaerob|fusobacterium|prevotella|klebsiella|coli|pseudomonas/i.test(s)) return "pos"; return ""; }
  function appearanceRead(s) { s = s || ""; if (/pus|purulent/i.test(s)) return "pus"; if (/milky|chylous|white/i.test(s)) return "milky"; if (/bloody|blood|red|sanguin|hemorrh/i.test(s)) return "bloody"; if (/turbid|cloudy/i.test(s)) return "turbid"; if (/clear|straw|yellow|serous/i.test(s)) return "serous"; return ""; }

  async function gather(client, say) {
    const pid = client.patient.id, errors = [], tell = say || (() => {});
    const iso = (t) => new Date(t).toISOString().slice(0, 10);
    async function get(url, name, pages) {
      const once = () => { let tm; return Promise.race([client.request(url, { pageLimit: pages || 1, flat: true }), new Promise((_, rej) => { tm = setTimeout(() => rej(new Error("timed out after 30 s")), 30000); })]).finally(() => clearTimeout(tm)); };
      const transient = (e) => /timed out|\b50[234]\b|Gateway|Failed to fetch|NetworkError/i.test(String((e && e.message) || e));
      try { const r = (await once().catch((e) => (transient(e) ? new Promise((ok) => setTimeout(ok, 1500)).then(once) : Promise.reject(e)))).filter((x) => x.resourceType && x.resourceType !== "OperationOutcome"); tell(`Loaded ${name} (${r.length})…`); return r; }
      catch (e) { errors.push(`${name}: ${e.message || e}`); return []; }
    }
    const s3 = iso(Date.now() - 3 * DAY), s60 = iso(Date.now() - 60 * DAY), s365 = iso(Date.now() - 365 * DAY);
    const [patient, vitals, labs, reports, medreqs, conditions, encs] = await Promise.all([
      (async () => { try { return await client.patient.read(); } catch (e) { errors.push("patient: " + (e.message || e)); return null; } })(),
      get(`Observation?patient=${pid}&category=vital-signs&date=ge${s3}&_count=200`, "vital signs (3 days)", 6),
      get(`Observation?patient=${pid}&category=laboratory&date=ge${s60}&_count=200`, "lab results incl. pleural fluid (60 days)", 12),
      get(`DiagnosticReport?patient=${pid}&date=ge${s365}&_count=100`, "imaging and reports (1 year)", 3),
      get(`MedicationRequest?patient=${pid}&_count=100`, "medication orders", 3),
      get(`Condition?patient=${pid}&_count=100`, "problem list", 2),
      client.encounter && client.encounter.id ? get(`Encounter?_id=${client.encounter.id}`, "encounter", 1) : Promise.resolve([])]);
    // drain output is often charted as intake/output observations without a lab/vital category
    let io = [];
    try { io = (await client.request(`Observation?patient=${pid}&date=ge${s3}&code:text=chest&_count=100`, { pageLimit: 2, flat: true })).filter((x) => x.resourceType === "Observation"); } catch (e) { /* not supported everywhere: type the output instead */ }
    const seen = new Set(), obs = vitals.concat(labs, io).filter((r) => { if (!r.id) return true; if (seen.has(r.id)) return false; seen.add(r.id); return true; });
    return { raw: { patient, obs, reports, medreqs, conditions, encounter: encs[0] || null }, errors };
  }

  const api = { parse, gather, latest, cytoRead, microRead, appearanceRead, MED, PROB, DAY, HR };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else window.PleuralChart = api;
})();
