/* Chart reading for the Small bowel obstruction tab. READ-ONLY. parse() turns raw FHIR resources into plain facts; gather() fetches them.
   Labs found by LOINC then by name (UNVERIFIED for Island Health's Cerner build): anything missed can be typed in on the page. */
(function () {
  const DAY = 864e5, HR = 36e5;
  const label = (cc) => (cc && (cc.text || (cc.coding || []).map((c) => c.display).find(Boolean))) || "";
  const codes = (cc) => ((cc && cc.coding) || []).map((c) => String(c.code || ""));
  const tOf = (r) => { const d = r.effectiveDateTime || (r.effectivePeriod && r.effectivePeriod.start) || r.performedDateTime || (r.performedPeriod && r.performedPeriod.start) || r.issued || r.authoredOn || r.recordedDate || r.onsetDateTime || ""; const t = d ? new Date(d).getTime() : NaN; return isNaN(t) ? null : t; };
  const mgdl = (f) => (v, u) => (/mg\s*\/\s*dl/i.test(u || "") ? v * f : v);
  const gdl = (v, u) => (/g\s*\/\s*dl/i.test(u || "") ? v * 10 : v);
  const PCT = /%/;
  const VITALS = [{ id: "hr", loinc: ["8867-4"], re: /heart rate|pulse/i, not: /oxim/i }, { id: "sbp", loinc: ["8480-6"], re: /systolic/i },
    { id: "temp", loinc: ["8310-5", "8331-1"], re: /temp/i, conv: (v, u) => (/\[?degF\]?|°?f\b/i.test(u || "") || v > 50 ? Math.round(((v - 32) * 5 / 9) * 10) / 10 : v) },
    { id: "rr", loinc: ["9279-1"], re: /resp(iratory)? rate/i }, { id: "spo2", loinc: ["59408-5", "2708-6"], re: /spo2|oxygen saturation|oximetry/i },
    { id: "weight", loinc: ["29463-7", "3141-9"], re: /^weight|body weight|weight measured|dosing weight/i, conv: (v, u) => (/lb/i.test(u || "") ? Math.round(v * 0.4536 * 10) / 10 : v) }];
  const LABS = [
    { id: "wbc", loinc: ["6690-2", "26464-8"], re: /\bwbc\b|white blood|leukocyte/i, not: /urine|fluid/i }, { id: "hb", loinc: ["718-7"], re: /hemoglobin|^hgb/i, not: /a1c|glyc|urine/i, conv: gdl },
    { id: "plt", loinc: ["777-3", "26515-7"], re: /platelet/i, not: /volume|mpv/i }, { id: "na", loinc: ["2951-2", "2947-0"], re: /sodium/i, not: /urine/i },
    { id: "k", loinc: ["2823-3", "6298-4"], re: /potassium/i, not: /urine/i }, { id: "cl", loinc: ["2075-0"], re: /chloride/i, not: /urine/i },
    { id: "hco3", loinc: ["1963-8", "2028-9", "1959-6"], re: /bicarb|\bhco3\b|total co2|co2,? total|\bco2\b/i, not: /pco2|urine/i },
    { id: "cr", loinc: ["2160-0", "38483-4"], re: /creatinine/i, not: /ratio|kinase|clearance|urine/i, conv: mgdl(88.4) },
    { id: "urea", loinc: ["3094-0", "22664-7", "6299-2"], re: /\burea\b|\bbun\b/i, not: /urine/i, conv: (v, u) => (/mg\s*\/\s*dl/i.test(u || "") ? v * 0.357 : v) },
    { id: "lactate", loinc: ["2524-7", "32693-4", "2519-7", "32133-1"], re: /lactate|lactic/i, not: /dehydrogenase|ldh/i, conv: mgdl(0.111) },
    { id: "crp", loinc: ["1988-5", "30522-7"], re: /\bcrp\b|c.reactive/i, conv: (v, u) => (/mg\s*\/\s*dl/i.test(u || "") ? v * 10 : v) },
    { id: "lipase", loinc: ["3040-3"], re: /lipase/i }, { id: "alb", loinc: ["1751-7"], re: /albumin/i, not: /urine|micro|ratio/i, conv: gdl },
    { id: "mg", loinc: ["19123-9", "2601-3"], re: /magnesium/i, not: /urine/i, conv: (v, u) => (/mg\s*\/\s*dl/i.test(u || "") ? v * 0.411 : v) },
    { id: "po4", loinc: ["2777-1"], re: /phosph/i, not: /alkaline|urine/i, conv: (v, u) => (/mg\s*\/\s*dl/i.test(u || "") ? v * 0.323 : v) },
    { id: "glu", loinc: ["2345-7", "2339-0"], re: /glucose/i, not: /urine|meter|poc|fluid/i, conv: mgdl(0.0555) },
    { id: "inr", loinc: ["6301-6", "34714-6"], re: /\binr\b/i }, { id: "ph", loinc: ["2744-1", "2746-6", "11558-4"], re: /\bph\b/i, not: /urine|fluid|stool/i },
    { id: "ck", loinc: ["2157-6"], re: /creatine kinase|\bck\b|\bcpk\b/i, not: /mb\b/i }, { id: "alt", loinc: ["1742-6"], re: /\balt\b|alanine/i },
    { id: "bili", loinc: ["1975-2"], re: /bilirubin,? total|total bilirubin/i }];
  const NG = /\bng\b|naso-?gastric|gastric (tube )?output|ngt|emesis|vomit/i;
  const MED = {
    opioid: /morphine|hydromorphone|oxycodone|fentanyl|codeine|tramadol|tapentadol|methadone|buprenorphine|meperidine/i,
    anticoag: /apixaban|rivaroxaban|edoxaban|dabigatran|warfarin|heparin infusion|enoxaparin\s*(1\s*mg\/kg|[6-9]\d|1[0-9]\d)\s*mg|dalteparin\s*\d{4,}|tinzaparin/i,
    steroid: /prednisone|prednisolone|dexamethasone|methylprednisolone|hydrocortisone/i,
    bezoar: /psyllium|metamucil|sevelamer|sucralfate|cholestyramine|colestipol|aluminum hydroxide/i,
    abx: /cefazolin|ceftriaxone|cefepime|piperacillin|meropenem|ertapenem|metronidazole|vancomycin|ciprofloxacin|clindamycin/i };
  const PROB = {
    cancer: /malignan|cancer|carcinoma|lymphoma|sarcoma|metasta|neoplasm|C[0-7][0-9]|C80/i,
    carcinomatosis: /carcinomatosis|peritoneal metasta|C78\.6|omental/i, crohn: /crohn|K50/i, uc: /ulcerative colitis|K51/i,
    radiation: /radiation (enteritis|proctitis)|radiotherapy|K52\.0|K62\.7/i, hernia: /hernia|K4[0-6]/i,
    sbo: /small bowel obstruction|intestinal obstruction|K56|bowel obstruction|ileus/i, bypass: /gastric bypass|roux|bariatric|Z98\.84/i,
    af: /atrial fib|I48/i, parkinson: /parkinson|G20/i, diabetes: /diabetes|E1[0-4]/i, ckd: /chronic kidney|N18/i, hf: /heart failure|I50/i,
    dementia: /dementia|F0[0-3]|G30/i, priorSurgery: /appendectomy|appendicectomy|colectomy|hemicolectomy|hysterectomy|caesarean|cesarean|c-section|laparotomy|bowel resection|small bowel resection|whipple|cholecystectomy|gastrectomy|ileostomy|colostomy|anterior resection|Z90\.4|Z98\.890|adhesion|K66\.0/i,
    transplant: /transplant|Z94/i, epilepsy: /epilep|seizure|G40/i };
  const SURG = /appendectomy|appendicectomy|colectomy|hemicolectomy|hysterectomy|caesarean|cesarean|c-section|laparotomy|laparoscop|bowel resection|resection of (small|large) (bowel|intestine)|whipple|pancreaticoduodenectomy|cholecystectomy|gastrectomy|ileostomy|colostomy|anterior resection|hernia repair|herniorrhaphy|adhesiolysis|oophorectomy|salpingo|gastric bypass|sleeve gastrectomy|nephrectomy|cystectomy|prostatectomy|aortic aneurysm repair/i;
  const IMG = /abdo|abdomen|pelvis|ct a\/?p|kub|small bowel|enterograph|gastrografin|contrast follow|bowel|chest x|cxr|xr chest/i;

  function obsVal(r) { const q = r.valueQuantity; return q && q.value != null ? { v: +q.value, u: q.unit || q.code || "" } : null; }
  function medText(m) {
    let t = label(m.medicationCodeableConcept) || (m.medicationReference && m.medicationReference.display) || "";
    if (!t && m.medicationReference && m.contained) { const c = m.contained.find((x) => m.medicationReference.reference === "#" + x.id); if (c) t = label(c.code); }
    const di = m.dosageInstruction && m.dosageInstruction[0], dt = di && di.text;
    if (dt && t && dt.toLowerCase().includes(t.toLowerCase())) return dt.trim();
    return [t, dt].filter(Boolean).join(" ").trim();
  }
  const fits = (d, nm, unit) => d.re.test(nm) && !(d.not && d.not.test(nm)) && !(d.noUnit && d.noUnit.test(unit || ""));
  const pick = (defs, r, unit) => { const c = codes(r.code), nm = label(r.code); return defs.find((d) => (d.loinc && c.some((x) => d.loinc.includes(x)) && !(d.not && d.not.test(nm))) || fits(d, nm, unit)); };

  function parse(raw, opts) {
    const now = (opts && opts.now) || Date.now(), f = { v: {}, l: {}, ng: [], reports: [], meds: [], cls: {}, prob: {}, probText: [], surgeries: [] };
    const p = raw.patient || {};
    f.sex = String(p.gender || "").toLowerCase();
    if (p.birthDate) f.age = Math.floor((now - new Date(p.birthDate).getTime()) / (365.25 * DAY));
    const nm0 = p.name && p.name[0]; f.name = nm0 ? (nm0.text || [((nm0.given || []).join(" ")), nm0.family].filter(Boolean).join(" ")) : "";
    (raw.obs || []).forEach((r) => {
      if (r.status === "entered-in-error" || r.status === "cancelled") return;
      const t = tOf(r); if (t == null) return;
      const name = label(r.code), q = obsVal(r);
      if (!q) return;
      if (NG.test(name) && /ml/i.test(q.u || "ml")) { f.ng.push({ t, v: q.v, name }); return; }
      if (/fluid|urine|csf|stool|drain/i.test(name) && !/oxygen/i.test(name)) return;
      const vd = pick(VITALS, r, q.u); if (vd) { (f.v[vd.id] = f.v[vd.id] || []).push({ t, v: vd.conv ? vd.conv(q.v, q.u) : q.v }); return; }
      const ld = pick(LABS, r, q.u); if (ld) (f.l[ld.id] = f.l[ld.id] || []).push({ t, v: Math.round((ld.conv ? ld.conv(q.v, q.u) : q.v) * 100) / 100 });
    });
    [f.v, f.l].forEach((o) => Object.values(o).forEach((a) => a.sort((x, y) => x.t - y.t)));
    f.ng.sort((a, b) => a.t - b.t);
    f.ng24 = f.ng.length ? f.ng.filter((d) => now - d.t <= DAY).reduce((a, d) => a + d.v, 0) : null;
    (raw.reports || []).forEach((r) => {
      if (/entered-in-error|cancelled/.test(r.status || "")) return;
      const name = label(r.code); if (!IMG.test(name)) return;
      let text = r.conclusion || "";
      (r.presentedForm || []).forEach((pf) => { if (pf.data && /text/.test(pf.contentType || "")) { try { text += " " + atob(pf.data); } catch (e) { /* not base64 text */ } } });
      f.reports.push({ t: tOf(r), name, text: text.trim(), pending: /registered|partial|preliminary/.test(r.status || "") });
    });
    f.reports.sort((a, b) => (a.t || 0) - (b.t || 0));
    (raw.medreqs || []).forEach((m) => { if (/entered-in-error|cancelled|stopped|completed/.test(m.status || "")) return; const text = medText(m); if (text) f.meds.push({ text, status: m.status || "", t: tOf(m) }); });
    const all = f.meds.filter((m) => m.status !== "on-hold").map((m) => m.text);
    f.medTexts = all;
    Object.entries(MED).forEach(([k, re]) => { f.cls[k] = [...new Set(all.filter((x) => re.test(x)))]; });
    (raw.conditions || []).forEach((c) => {
      const resolved = c.clinicalStatus && /resolved|inactive|remission/.test(codes(c.clinicalStatus).join(" "));
      const nm = label(c.code) + " " + codes(c.code).join(" ");
      if (SURG.test(nm)) f.surgeries.push({ name: label(c.code), t: tOf(c), src: "problem list" });
      if (resolved) { if (PROB.priorSurgery.test(nm)) f.prob.priorSurgery = (f.prob.priorSurgery || []).concat(label(c.code)); return; } // past surgery still counts when resolved
      f.probText.push(label(c.code));
      Object.entries(PROB).forEach(([k, re]) => { if (re.test(nm)) f.prob[k] = (f.prob[k] || []).concat(label(c.code)); });
    });
    (raw.procedures || []).forEach((pr) => {
      if (/entered-in-error|not-done/.test(pr.status || "")) return;
      const nm = label(pr.code); if (SURG.test(nm)) f.surgeries.push({ name: nm, t: tOf(pr), src: "procedures" });
    });
    if (f.surgeries.length) f.prob.priorSurgery = (f.prob.priorSurgery || []).concat(f.surgeries.map((s) => s.name));
    f.recentSurgery = f.surgeries.some((s) => s.t && now - s.t <= 30 * DAY);
    if (raw.encounter && raw.encounter.period && raw.encounter.period.start) f.admitT = new Date(raw.encounter.period.start).getTime();
    // creatinine baseline: lowest in the 60 days before the last value
    const cr = f.l.cr || []; if (cr.length > 1) f.crBase = Math.min(...cr.slice(0, -1).map((x) => x.v));
    return f;
  }
  const latest = (a, within, now) => { if (!a || !a.length) return null; const x = a[a.length - 1]; return within && (now || Date.now()) - x.t > within ? null : x; };

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
    const [patient, vitals, labs, reports, medreqs, conditions, procedures, encs] = await Promise.all([
      (async () => { try { return await client.patient.read(); } catch (e) { errors.push("patient: " + (e.message || e)); return null; } })(),
      get(`Observation?patient=${pid}&category=vital-signs&date=ge${s3}&_count=200`, "vital signs (3 days)", 6),
      get(`Observation?patient=${pid}&category=laboratory&date=ge${s60}&_count=200`, "lab results (60 days)", 10),
      get(`DiagnosticReport?patient=${pid}&date=ge${s365}&_count=100`, "imaging and reports (1 year)", 3),
      get(`MedicationRequest?patient=${pid}&_count=100`, "medication orders", 3),
      get(`Condition?patient=${pid}&_count=100`, "problem list", 2),
      get(`Procedure?patient=${pid}&_count=100`, "procedures / past surgery", 2),
      client.encounter && client.encounter.id ? get(`Encounter?_id=${client.encounter.id}`, "encounter", 1) : Promise.resolve([])]);
    let io = []; // NG output is often charted as intake/output without a category
    try { io = (await client.request(`Observation?patient=${pid}&date=ge${s3}&code:text=gastric&_count=100`, { pageLimit: 2, flat: true })).filter((x) => x.resourceType === "Observation"); } catch (e) { /* type the NG output instead */ }
    const seen = new Set(), obs = vitals.concat(labs, io).filter((r) => { if (!r.id) return true; if (seen.has(r.id)) return false; seen.add(r.id); return true; });
    return { raw: { patient, obs, reports, medreqs, conditions, procedures, encounter: encs[0] || null }, errors };
  }

  const api = { parse, gather, latest, MED, PROB, DAY, HR };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else window.SboChart = api;
})();
