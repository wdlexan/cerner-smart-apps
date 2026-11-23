/* Chart reading for the FUO tab. READ-ONLY. parse() turns raw FHIR resources into plain facts; gather() fetches them.
   Tests and drugs are matched by LOINC and then by NAME (UNVERIFIED): something not found here may still be in the chart. */
(function () {
  const DAY = 864e5, HR = 36e5;
  const label = (cc) => (cc && (cc.text || (cc.coding || []).map((c) => c.display).find(Boolean))) || "";
  const codes = (cc) => ((cc && cc.coding) || []).map((c) => String(c.code || ""));
  const tOf = (r) => { const d = r.effectiveDateTime || (r.effectivePeriod && r.effectivePeriod.start) || r.issued || r.authoredOn || r.recordedDate || ""; const t = d ? new Date(d).getTime() : NaN; return isNaN(t) ? null : t; };
  const mgdl = (f) => (v, u) => (/mg\s*\/\s*dl/i.test(u || "") ? v * f : v);
  const URINE = /urine|\bur\b|random urine|csf|fluid/i;
  const PCT = /%/;

  const VITALS = [
    { id: "temp", loinc: ["8310-5", "8331-1", "8332-9", "8328-7", "8333-7"], re: /temp/i, conv: (v, u) => (/f/i.test(u || "") || v > 50 ? Math.round(((v - 32) * 5 / 9) * 10) / 10 : v) },
    { id: "hr", loinc: ["8867-4"], re: /heart rate|pulse/i, not: /oxim|ox\b|spo2/i }, { id: "sbp", loinc: ["8480-6"], re: /systolic/i },
    { id: "spo2", loinc: ["59408-5", "2708-6"], re: /spo2|oxygen saturation|oximetry/i }, { id: "rr", loinc: ["9279-1"], re: /resp(iratory)? rate/i },
    { id: "wt", loinc: ["29463-7", "3141-9"], re: /body weight|^weight/i, conv: (v, u) => (/lb/i.test(u || "") ? v * 0.4536 : v) }];
  const LABS = [
    { id: "wbc", loinc: ["6690-2", "26464-8"], re: /\bwbc\b|white blood|leukocyte/i, not: URINE },
    { id: "anc", loinc: ["751-8", "26499-4", "753-4"], re: /neutrophil|\banc\b|segmented|polys/i, not: URINE, noUnit: PCT },
    { id: "neutPct", loinc: ["770-8", "23761-0"], re: /neutrophil|segmented|polys/i, not: URINE, unit: PCT },
    { id: "lymph", loinc: ["731-0", "26474-7"], re: /lymphocyte/i, not: /atypical|reactive|urine/i, noUnit: PCT },
    { id: "mono", loinc: ["742-7", "26484-6"], re: /monocyte/i, noUnit: PCT }, { id: "eos", loinc: ["711-2", "26449-9"], re: /eosinophil/i, not: URINE, noUnit: PCT },
    { id: "hb", loinc: ["718-7"], re: /hemoglobin|haemoglobin|^hgb/i, not: /a1c|glyc|urine/i, conv: (v, u) => (/g\s*\/\s*dl/i.test(u || "") ? v * 10 : v) },
    { id: "plt", loinc: ["777-3", "26515-7"], re: /platelet/i, not: /volume|mpv/i },
    { id: "cr", loinc: ["2160-0", "38483-4"], re: /creatinine/i, not: /ratio|kinase|clearance|urine/i, conv: mgdl(88.4) },
    { id: "na", loinc: ["2951-2", "2947-0"], re: /sodium/i, not: URINE }, { id: "k", loinc: ["2823-3", "6298-4"], re: /potassium/i, not: URINE },
    { id: "ca", loinc: ["17861-6", "2000-8"], re: /calcium/i, not: /ionized|ionised|urine|channel/i, conv: mgdl(0.2495) },
    { id: "alb", loinc: ["1751-7"], re: /albumin/i, not: /urine|micro|ratio/i, conv: (v, u) => (/g\s*\/\s*dl/i.test(u || "") ? v * 10 : v) },
    { id: "alt", loinc: ["1742-6", "1743-4"], re: /\balt\b|alanine/i }, { id: "ast", loinc: ["1920-8", "30239-8"], re: /\bast\b|aspartate/i },
    { id: "alp", loinc: ["6768-6"], re: /alkaline phos|\balp\b/i }, { id: "bili", loinc: ["1975-2"], re: /bilirubin/i, not: /direct|conjugated|urine/i },
    { id: "ldh", loinc: ["2532-0", "14804-9"], re: /\bldh?\b|lactate dehydrogenase/i, not: URINE }, { id: "ck", loinc: ["2157-6"], re: /\bck\b|creatine kinase|\bcpk\b/i, not: /mb/i },
    { id: "esr", loinc: ["4537-7", "30341-2"], re: /\besr\b|sed(imentation)? rate/i }, { id: "crp", loinc: ["1988-5", "30522-7"], re: /\bcrp\b|c.reactive/i, conv: (v, u) => (/mg\s*\/\s*dl/i.test(u || "") ? v * 10 : v) },
    { id: "ferritin", loinc: ["2276-4"], re: /ferritin/i }, { id: "tg", loinc: ["2571-8"], re: /triglyceride/i, conv: mgdl(0.01129) },
    { id: "fib", loinc: ["3255-7"], re: /fibrinogen/i, conv: (v, u) => (/mg\s*\/\s*dl/i.test(u || "") ? v / 100 : v) },
    { id: "tsh", loinc: ["3016-3", "11580-8"], re: /\btsh\b|thyrotropin/i }, { id: "pct", loinc: ["33959-8"], re: /procalcitonin/i },
    { id: "lactate", loinc: ["2524-7", "32693-4"], re: /lactate|lactic/i, not: /dehydrogenase/i }, { id: "cd4", loinc: ["24467-3", "8123-2"], re: /\bcd4\b/i, noUnit: PCT }];

  // qualitative / ordered tests (done-status for the workup list). pos/neg read from the value text.
  const TESTS = {
    bc: /blood culture/i, uc: /urine culture/i, ua: /urinalysis|urine (dipstick|microscop|routine)|\bua\b/i, hiv: /\bhiv\b/i, hbv: /hepatitis b|hbsag|hbs ag|anti-hbc/i, hcv: /hepatitis c|\bhcv\b/i,
    ana: /\bana\b|antinuclear/i, rf: /rheumatoid factor|^rf\b/i, spep: /protein electrophoresis|\bspep\b|immunofixation/i, igra: /quantiferon|\bigra\b|interferon.gamma release|t-spot/i,
    cmv: /\bcmv\b|cytomegalovirus/i, ebv: /\bebv\b|epstein|monospot|heterophile/i, syph: /syphilis|treponem|\brpr\b|vdrl/i, anca: /\banca\b|proteinase 3|myeloperoxidase|\bpr3\b|\bmpo\b/i,
    c3: /complement c3|^c3\b/i, c4: /complement c4|^c4\b/i, dsdna: /dsdna|double.stranded/i, malaria: /malaria|plasmodium|thick.*(film|smear)/i,
    qfever: /coxiella|q fever/i, bart: /bartonella/i, bruc: /brucella/i, histo: /histoplasma/i, crypto: /cryptococc/i, bdg: /beta.?d.?glucan|fungitell/i,
    afb: /\bafb\b|acid.fast|mycobact|tb pcr|genexpert/i, flc: /free light chain|kappa.*lambda/i, cortisol: /cortisol/i, sil2r: /il-?2 receptor|sil-?2r|cd25/i,
    calpro: /calprotectin/i, dengue: /dengue/i, strongy: /strongyloides/i };
  const POS = /positive|reactive|detected|growth of|isolated|gram.(positive|negative)|staphylococcus|streptococcus|enterococcus|escherichia|klebsiella|candida|\bpos\b/i;
  const NEG = /no growth|negative|not detected|non.?reactive|\bneg\b|none detected/i;
  // reports (DiagnosticReport / imaging, procedures)
  const REPORTS = {
    cxr: /chest.*(x.?ray|xr|radiograph|cxr|pa and lat)|\bcxr\b|xr chest/i, ct: /\bct\b.*(abd|pelvi|chest|thorax)|(abd|pelvi|chest|thorax).*\bct\b|ct cap/i,
    echo: /echo|\btte\b|\btee\b|transthoracic|transesophageal/i, tee: /\btee\b|transesophageal/i, pet: /\bpet\b|fdg/i, tus: /temporal artery.*(us|ultrasound|doppler)/i,
    doppler: /doppler|venous duplex|dvt (us|ultrasound)/i, mri: /mri.*spine|spine.*mri/i, nodebx: /lymph node.*(biopsy|excision)|node biopsy/i,
    bmbx: /bone marrow|marrow (aspirate|biopsy)/i, tab: /temporal artery biopsy/i, liverbx: /liver biopsy/i, colon: /colonoscopy/i };

  const MED = {
    abx: /cefazolin|ceftriaxone|cefepime|ceftazidime|cephalexin|cefuroxime|cefixime|piperacillin|meropenem|ertapenem|imipenem|vancomycin|azithromycin|clarithromycin|ciprofloxacin|levofloxacin|moxifloxacin|amoxicillin|ampicillin|penicillin|cloxacillin|clindamycin|doxycycline|minocycline|metronidazole|gentamicin|tobramycin|linezolid|daptomycin|sulfamethoxazole|septra|bactrim|nitrofurantoin|fosfomycin|rifampin/i,
    steroid: /prednisone|prednisolone|dexamethasone|methylprednisolone|hydrocortisone|budesonide oral/i,
    immuno: /tacrolimus|cyclosporine|mycophenolate|azathioprine|methotrexate|sirolimus|everolimus|infliximab|adalimumab|etanercept|certolizumab|golimumab|tocilizumab|rituximab|abatacept|ustekinumab|vedolizumab|tofacitinib|upadacitinib|baricitinib|cyclophosphamide|fingolimod|ocrelizumab|natalizumab|anakinra/i,
    tnf: /infliximab|adalimumab|etanercept|certolizumab|golimumab/i,
    antipyretic: /acetaminophen|paracetamol|tylenol|ibuprofen|naproxen|ketorolac|celecoxib|diclofenac|indomethacin|aspirin\s*(325|650)/i,
    rate: /bisoprolol|carvedilol|metoprolol|atenolol|propranolol|nebivolol|labetalol|diltiazem|verapamil|digoxin|amiodarone|ivabradine/i,
    anticoag: /apixaban|rivaroxaban|edoxaban|dabigatran|warfarin|enoxaparin\s*(1\s*mg|[6-9]\d|1[0-4]\d)|heparin infusion|dalteparin\s*\d{4,}/i,
    chemo: /cyclophosphamide|doxorubicin|cisplatin|carboplatin|oxaliplatin|paclitaxel|docetaxel|gemcitabine|fluorouracil|capecitabine|etoposide|vincristine|cytarabine|azacitidine|venetoclax|ibrutinib|bendamustine/i };
  const PROB = {
    valve: /prosthetic.*valve|valve replacement|mechanical (heart )?valve|bioprosthetic|Z95\.2|Z95\.3|TAVI|TAVR|aortic stenosis|mitral regurg|I3[4-7]|rheumatic heart|endocarditis/i,
    device: /pacemaker|defibrillator|\bicd\b|Z95\.0|Z95\.81|joint (replacement|prosthesis|arthroplasty)|Z96\.6|vascular graft|Z95\.82|port-?a-?cath|picc|central line|hemodialysis catheter|ventricular assist|LVAD/i,
    hiv: /\bhiv\b|human immunodeficiency|B20|Z21/i, transplant: /transplant|Z94/i, asplenia: /asplenia|splenectomy|D73\.0|Z90\.81/i,
    cancerHx: /malignan|cancer|carcinoma|lymphoma|leukemia|myeloma|C[0-9]{2}/i, cirrhosis: /cirrho|K74|K70\.3|portal hypertension/i, dm: /diabetes|E1[0-4]/i,
    ivdu: /injection drug|intravenous drug|IVDU|PWID|opioid use disorder|F11|substance use/i, tb: /tuberculosis|\btb\b|latent tb|A1[5-9]|Z22\.7|R76\.1/i,
    ckd: /chronic kidney|N18|dialysis|Z99\.2/i, neuroEvent: /stroke|intracerebral|subarachnoid|traumatic brain|I6[0-3]|S06/i, ra: /rheumatoid|M05|M06/i,
    ibd: /crohn|ulcerative colitis|K50|K51/i, sarcoid: /sarcoid|D86/i, sle: /lupus|M32/i, adrenal: /adrenal insufficiency|addison|E27/i, pacer: /pacemaker|Z95\.0/i };

  function obsVal(r) { const q = r.valueQuantity; return q && q.value != null ? { v: +q.value, u: q.unit || q.code || "" } : null; }
  function obsText(r) { return r.valueString || label(r.valueCodeableConcept) || (r.interpretation ? (r.interpretation || []).map(label).join(" ") : "") || ""; }
  function medText(m) {
    let t = label(m.medicationCodeableConcept) || (m.medicationReference && m.medicationReference.display) || "";
    if (!t && m.medicationReference && m.contained) { const c = m.contained.find((x) => m.medicationReference.reference === "#" + x.id); if (c) t = label(c.code); }
    const di = m.dosageInstruction && m.dosageInstruction[0], d = m.dosage && m.dosage.dose;
    const dt = di && di.text; if (dt && t && dt.toLowerCase().includes(t.toLowerCase())) return dt.trim(); // dosage text already names the drug
    return [t, d && d.value != null ? d.value + " " + (d.unit || "") : "", dt].filter(Boolean).join(" ").trim();
  }
  const pick = (defs, r, unit) => { const c = codes(r.code), n = label(r.code); return defs.find((d) => (d.loinc.length && c.some((x) => d.loinc.includes(x))) || (d.re.test(n) && !(d.not && d.not.test(n)) && !(d.unit && !d.unit.test(unit || "")) && !(d.noUnit && d.noUnit.test(unit || "")))); };

  function parse(raw, opts) {
    const now = (opts && opts.now) || Date.now(), f = { v: {}, l: {}, tests: {}, reports: {}, meds: [], admins: [], cls: {}, prob: {}, probText: [], firstAbx: null, firstBC: null };
    const p = raw.patient || {};
    f.sex = String(p.gender || "").toLowerCase();
    if (p.birthDate) f.age = Math.floor((now - new Date(p.birthDate).getTime()) / (365.25 * DAY));
    (raw.obs || []).forEach((r) => {
      if (r.status === "entered-in-error" || r.status === "cancelled") return;
      const t = tOf(r); if (t == null) return;
      const name = label(r.code), pending = /registered|preliminary/.test(r.status || "");
      Object.entries(TESTS).forEach(([id, re]) => {
        if (!re.test(name)) return;
        const txt = obsText(r), q = obsVal(r), val = txt || (q ? q.v + " " + q.u : "");
        const pos = POS.test(txt) && !NEG.test(txt), neg = NEG.test(txt);
        (f.tests[id] = f.tests[id] || []).push({ t, name, text: val.trim(), pos, neg, pending });
        if (id === "bc" && (f.firstBC == null || t < f.firstBC)) f.firstBC = t;
      });
      if ((r.component || []).length) r.component.forEach((c) => { const q = obsVal(c), d = q && pick(VITALS, c, q.u); if (d) (f.v[d.id] = f.v[d.id] || []).push({ t, v: d.conv ? d.conv(q.v, q.u) : q.v }); });
      const q = obsVal(r); if (!q) return;
      const vd = pick(VITALS, r, q.u); if (vd) { (f.v[vd.id] = f.v[vd.id] || []).push({ t, v: vd.conv ? vd.conv(q.v, q.u) : q.v }); return; }
      const ld = pick(LABS, r, q.u); if (!ld) return;
      (f.l[ld.id] = f.l[ld.id] || []).push({ t, v: Math.round((ld.conv ? ld.conv(q.v, q.u) : q.v) * 100) / 100 });
    });
    Object.values(f.v).concat(Object.values(f.l)).forEach((a) => a.sort((x, y) => x.t - y.t));
    Object.values(f.tests).forEach((a) => a.sort((x, y) => x.t - y.t));
    (raw.reports || []).forEach((r) => {
      if (/entered-in-error|cancelled/.test(r.status || "")) return;
      const name = label(r.code), t = tOf(r) || (r.issued ? new Date(r.issued).getTime() : null);
      Object.entries(REPORTS).forEach(([id, re]) => { if (re.test(name)) (f.reports[id] = f.reports[id] || []).push({ t, name, text: r.conclusion || "", pending: /registered|partial|preliminary/.test(r.status || "") }); });
    });
    (raw.medreqs || []).forEach((m) => {
      if (/entered-in-error|cancelled/.test(m.status || "")) return;
      const text = medText(m); if (!text) return;
      f.meds.push({ text, status: m.status || "", t: tOf(m), prn: !!(m.dosageInstruction && m.dosageInstruction[0] && m.dosageInstruction[0].asNeededBoolean) || /\bprn\b|as needed/i.test(text) });
    });
    (raw.admins || []).forEach((m) => { if (m.status && m.status !== "completed" && m.status !== "in-progress") return; const text = medText(m), t = tOf(m); if (text && t) f.admins.push({ text, t }); });
    f.admins.sort((a, b) => a.t - b.t);
    const active = f.meds.filter((m) => !/stopped|completed|on-hold/.test(m.status));
    const all = active.map((m) => m.text).concat(f.admins.filter((a) => now - a.t < 2 * DAY).map((a) => a.text));
    Object.entries(MED).forEach(([k, re]) => { f.cls[k] = [...new Set(all.filter((x) => re.test(x)))]; });
    f.stoppedSteroid = f.meds.filter((m) => /stopped|completed/.test(m.status) && MED.steroid.test(m.text)).map((m) => m.text);
    f.scheduledAntipyretic = active.filter((m) => MED.antipyretic.test(m.text) && !m.prn).map((m) => m.text);
    f.activeMeds = active;
    const abxTimes = f.meds.filter((m) => MED.abx.test(m.text) && m.t).map((m) => m.t).concat(f.admins.filter((a) => MED.abx.test(a.text)).map((a) => a.t));
    f.firstAbx = abxTimes.length ? Math.min(...abxTimes) : null;
    (raw.conditions || []).forEach((c) => {
      if (c.clinicalStatus && /resolved|inactive|remission/.test(codes(c.clinicalStatus).join(" "))) return;
      if (c.verificationStatus && /refuted|entered-in-error/.test(codes(c.verificationStatus).join(" "))) return;
      const n = label(c.code) + " " + codes(c.code).join(" "); f.probText.push(label(c.code));
      Object.entries(PROB).forEach(([k, re]) => { if (re.test(n)) f.prob[k] = (f.prob[k] || []).concat(label(c.code)); });
    });
    if (raw.encounter && raw.encounter.period && raw.encounter.period.start) f.admitT = new Date(raw.encounter.period.start).getTime();
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
    const s30 = iso(Date.now() - 30 * DAY), s90 = iso(Date.now() - 90 * DAY), s365 = iso(Date.now() - 365 * DAY);
    const [patient, vitals, labs, reports, medreqs, admins, conditions, encs] = await Promise.all([
      (async () => { try { return await client.patient.read(); } catch (e) { errors.push("patient: " + (e.message || e)); return null; } })(),
      get(`Observation?patient=${pid}&category=vital-signs&date=ge${s30}&_count=200`, "vital signs (30 days)", 10),
      get(`Observation?patient=${pid}&category=laboratory&date=ge${s90}&_count=200`, "lab results (90 days)", 12),
      get(`DiagnosticReport?patient=${pid}&date=ge${s365}&_count=100`, "reports (1 year)", 3),
      get(`MedicationRequest?patient=${pid}&_count=100`, "medication orders", 3),
      get(`MedicationAdministration?patient=${pid}&effective-time=ge${isoT(Date.now() - 14 * DAY)}&_count=100`, "medications given (14 days)", 4),
      get(`Condition?patient=${pid}&_count=100`, "problem list", 2),
      client.encounter && client.encounter.id ? get(`Encounter?_id=${client.encounter.id}`, "encounter", 1) : Promise.resolve([])]);
    return { raw: { patient, obs: vitals.concat(labs), reports, medreqs, admins, conditions, encounter: encs[0] || null }, errors };
  }

  const api = { parse, gather, latest, MED, PROB, TESTS, REPORTS, DAY, HR };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else window.FUOChart = api;
})();
