/* Chart reading for the Asplenia tab. READ-ONLY. parse() turns raw FHIR resources into plain facts; gather() fetches them.
   Matched by code and then by NAME (UNVERIFIED): something not found here may still be in the chart.
   Immunizations: Cerner often does not hold the BC provincial record, and Immunization.read may not be in the app's scopes:
   the page lets you paste or add doses by hand. */
(function () {
  const DAY = 864e5, HR = 36e5;
  const label = (cc) => (cc && (cc.text || (cc.coding || []).map((c) => c.display).find(Boolean))) || "";
  const codes = (cc) => ((cc && cc.coding) || []).map((c) => String(c.code || ""));
  const tOf = (r) => { const d = r.effectiveDateTime || (r.effectivePeriod && r.effectivePeriod.start) || r.occurrenceDateTime || r.performedDateTime || (r.performedPeriod && r.performedPeriod.start) || r.issued || r.authoredOn || r.recordedDate || r.onsetDateTime || ""; const t = d ? new Date(d).getTime() : NaN; return isNaN(t) ? null : t; };
  const mgdl = (f) => (v, u) => (/mg\s*\/\s*dl/i.test(u || "") ? v * f : v);
  const URINE = /urine|\bur\b|csf|fluid/i;

  const VITALS = [
    { id: "temp", loinc: ["8310-5", "8331-1", "8332-9", "8328-7", "8333-7"], re: /temp/i, conv: (v, u) => (/f/i.test(u || "") || v > 50 ? Math.round(((v - 32) * 5 / 9) * 10) / 10 : v) },
    { id: "hr", loinc: ["8867-4"], re: /heart rate|pulse/i, not: /oxim|spo2/i }, { id: "sbp", loinc: ["8480-6"], re: /systolic/i }, { id: "dbp", loinc: ["8462-4"], re: /diastolic/i },
    { id: "rr", loinc: ["9279-1"], re: /resp(iratory)? rate/i }, { id: "spo2", loinc: ["59408-5", "2708-6"], re: /spo2|oxygen saturation|oximetry/i },
    { id: "wt", loinc: ["29463-7", "3141-9"], re: /body weight|^weight/i, conv: (v, u) => (/lb/i.test(u || "") ? v * 0.4536 : v) }];
  const LABS = [
    { id: "wbc", loinc: ["6690-2", "26464-8"], re: /\bwbc\b|white blood|leukocyte/i, not: URINE }, { id: "plt", loinc: ["777-3", "26515-7"], re: /platelet/i, not: /volume|mpv/i },
    { id: "hb", loinc: ["718-7"], re: /hemoglobin|haemoglobin|^hgb/i, not: /a1c|glyc|urine/i, conv: (v, u) => (/g\s*\/\s*dl/i.test(u || "") ? v * 10 : v) },
    { id: "cr", loinc: ["2160-0", "38483-4"], re: /creatinine/i, not: /ratio|kinase|clearance|urine/i, conv: mgdl(88.4) },
    { id: "urea", loinc: ["3091-6", "22664-7", "3094-0", "6299-2"], re: /\burea\b|\bbun\b|blood urea/i, not: URINE, conv: (v, u) => (/mg\s*\/\s*dl/i.test(u || "") ? v * 0.357 : v) },
    { id: "lactate", loinc: ["2524-7", "32693-4"], re: /lactate|lactic/i, not: /dehydrogenase/i }, { id: "inr", loinc: ["6301-6", "34714-6"], re: /\binr\b/i },
    { id: "fib", loinc: ["3255-7"], re: /fibrinogen/i, conv: (v, u) => (/mg\s*\/\s*dl/i.test(u || "") ? v / 100 : v) }, { id: "pct", loinc: ["33959-8"], re: /procalcitonin/i },
    { id: "crp", loinc: ["1988-5", "30522-7"], re: /\bcrp\b|c.reactive/i, conv: (v, u) => (/mg\s*\/\s*dl/i.test(u || "") ? v * 10 : v) }];
  const SMEAR = /smear|film|morpholog|howell|blood film/i;
  const FLU = /influenza|\bflu\b/i, RESP = /respiratory (virus|panel|pathogen)|viral panel|rvp/i;
  const POS = /positive|detected|reactive|\bpos\b/i, NEG = /negative|not detected|non.?reactive|\bneg\b/i;
  const BC = /blood culture/i;
  const REPORTS = { cxr: /chest.*(x.?ray|xr|radiograph|cxr)|\bcxr\b|xr chest/i, ct: /\bct\b/i, us: /ultrasound|\bus\b/i };

  const MED = {
    proph: /penicillin v|pen.?vk|phenoxymethylpenicillin|amoxicillin(?!.*clav)/i,
    abx: /ceftriaxone|cefepime|ceftazidime|cefuroxime|cefazolin|piperacillin|meropenem|ertapenem|vancomycin|azithromycin|clarithromycin|levofloxacin|moxifloxacin|ciprofloxacin|amoxicillin|ampicillin|penicillin|doxycycline|linezolid|clindamycin|sulfamethoxazole|metronidazole/i,
    chemo: /cyclophosphamide|doxorubicin|cisplatin|carboplatin|oxaliplatin|paclitaxel|docetaxel|gemcitabine|fluorouracil|capecitabine|etoposide|vincristine|cytarabine|azacitidine|venetoclax|ibrutinib|bendamustine|fludarabine|daratumumab|lenalidomide|bortezomib/i,
    cd20: /rituximab|obinutuzumab|ocrelizumab|ofatumumab|ublituximab/i,
    immuno: /tacrolimus|cyclosporine|mycophenolate|azathioprine|methotrexate|sirolimus|infliximab|adalimumab|etanercept|tocilizumab|abatacept|tofacitinib|upadacitinib|baricitinib|fingolimod|natalizumab|prednisone\s*([2-9]\d|1\d\d)|dexamethasone/i,
    eculizumab: /eculizumab|ravulizumab|soliris|ultomiris|iptacopan|pegcetacoplan|crovalimab|danicopan/i,
    anticoag: /apixaban|rivaroxaban|edoxaban|dabigatran|warfarin|enoxaparin|dalteparin|tinzaparin|heparin|fondaparinux/i,
    vteProph: /enoxaparin\s*40|dalteparin\s*5000|tinzaparin\s*4500|heparin\s*5[\s,]?000|fondaparinux\s*2\.5/i,
    macrolideQT: /amiodarone|sotalol|haloperidol|citalopram|escitalopram|methadone|ondansetron|quetiapine|domperidone/i };
  const PROB = {
    heme: /lymphoma|leukemia|leukaemia|myeloma|myelodysplas|myelofibrosis|polycythemia|thrombocythemia|myeloproliferative|C8[1-9]|C9[0-6]/i,
    transplant: /transplant|Z94/i, hiv: /\bhiv\b|B20|Z21/i, itp: /\bitp\b|immune thrombocytop|D69\.3/i, hemolytic: /hemolytic|spherocytosis|thalass|sickle|D5[5-9]/i,
    opsi: /overwhelming post.?splenectomy|\bopsi\b|invasive pneumococcal|pneumococcal (sepsis|bacteremia|meningitis)|meningococcal (sepsis|disease|meningitis)/i, ckd: /chronic kidney|N18|dialysis/i };
  const ALLERGY = { pcn: /penicillin|amoxicillin|ampicillin|piperacillin|cloxacillin|beta.?lactam|cephalosporin|ceftriaxone|cefazolin|cephalexin/i,
    scar: /stevens|johnson|\bsjs\b|\bten\b|toxic epidermal|dress|drug reaction with eosinophilia|serum sickness|hemolytic anemia|interstitial nephritis/i,
    immediate: /anaphyla|angioedema|urticaria|hives|wheez|bronchospasm|swelling of (the )?(throat|tongue|lips)|hypotension/i };

  function obsVal(r) { const q = r.valueQuantity; return q && q.value != null ? { v: +q.value, u: q.unit || q.code || "" } : null; }
  function obsText(r) { return r.valueString || label(r.valueCodeableConcept) || ""; }
  function medText(m) {
    let t = label(m.medicationCodeableConcept) || (m.medicationReference && m.medicationReference.display) || "";
    const di = m.dosageInstruction && m.dosageInstruction[0], dt = di && di.text;
    if (dt && t && dt.toLowerCase().includes(t.toLowerCase())) return dt.trim();
    return [t, dt].filter(Boolean).join(" ").trim();
  }
  const pick = (defs, r) => { const c = codes(r.code), n = label(r.code); return defs.find((d) => (d.loinc.length && c.some((x) => d.loinc.includes(x))) || (d.re.test(n) && !(d.not && d.not.test(n)))); };

  function parse(raw, opts) {
    const now = (opts && opts.now) || Date.now();
    const f = { v: {}, l: {}, meds: [], cls: {}, prob: {}, probText: [], procs: [], imms: [], allergies: [], reports: [], smear: "", flu: null, bcPos: [], immsError: raw.immsError || "" };
    const p = raw.patient || {};
    f.sex = String(p.gender || "").toLowerCase();
    if (p.birthDate) f.age = Math.floor((now - new Date(p.birthDate).getTime()) / (365.25 * DAY));
    (raw.obs || []).forEach((r) => {
      if (r.status === "entered-in-error" || r.status === "cancelled") return;
      const t = tOf(r); if (t == null) return;
      const name = label(r.code), txt = obsText(r);
      if (SMEAR.test(name) || /howell.?jolly/i.test(txt)) { if (/howell.?jolly/i.test(txt) && !/no howell|howell.?jolly bodies (are )?(absent|not seen)|without howell/i.test(txt)) f.smear = "hj"; else if (!f.smear && txt) f.smear = "seen"; }
      if (FLU.test(name) || (RESP.test(name) && FLU.test(txt))) { const pos = POS.test(txt) && !NEG.test(txt.replace(/influenza [ab] (not detected|negative)/gi, "")); if (FLU.test(name)) f.flu = POS.test(txt) && !NEG.test(txt) ? "pos" : NEG.test(txt) ? "neg" : f.flu; else if (pos) f.flu = "pos"; }
      if (BC.test(name) && POS.test(txt) && !/no growth/i.test(txt)) f.bcPos.push({ t, text: txt });
      if ((r.component || []).length) r.component.forEach((c) => { const q = obsVal(c), d = q && pick(VITALS, c); if (d) (f.v[d.id] = f.v[d.id] || []).push({ t, v: d.conv ? d.conv(q.v, q.u) : q.v }); });
      const q = obsVal(r); if (!q) return;
      const vd = pick(VITALS, r); if (vd) { (f.v[vd.id] = f.v[vd.id] || []).push({ t, v: vd.conv ? vd.conv(q.v, q.u) : q.v }); return; }
      const ld = pick(LABS, r); if (!ld) return;
      (f.l[ld.id] = f.l[ld.id] || []).push({ t, v: Math.round((ld.conv ? ld.conv(q.v, q.u) : q.v) * 100) / 100 });
    });
    Object.values(f.v).concat(Object.values(f.l)).forEach((a) => a.sort((x, y) => x.t - y.t));
    (raw.reports || []).forEach((r) => {
      if (/entered-in-error|cancelled/.test(r.status || "")) return;
      const name = label(r.code), text = r.conclusion || "";
      f.reports.push({ t: tOf(r), name, text });
      if (/spleen (is )?(absent|not (seen|visuali[sz]ed))|status post splenectomy|post.?splenectomy|surgically absent spleen|splenectomy/i.test(text)) f.probText.push("Imaging: " + text.slice(0, 120));
      if (/splenule|accessory spleen|splenosis/i.test(text)) f.splenule = text.slice(0, 160);
      if (/howell.?jolly/i.test(text) && !/no howell/i.test(text)) f.smear = "hj";
    });
    (raw.procedures || []).forEach((r) => {
      if (/entered-in-error|not-done/.test(r.status || "")) return;
      const name = label(r.code) + " " + codes(r.code).join(" "), t = tOf(r);
      f.procs.push({ name: label(r.code), t, status: r.status || "" });
      if (/splenectomy|splenic (artery )?emboli/i.test(name)) {
        if (/partial|hemi/i.test(name)) f.partialT = t;
        else if (/emboli/i.test(name)) f.embolT = t;
        else if (r.status === "preparation" || (t && t > now)) f.plannedT = t;
        else f.splenectomyT = f.splenectomyT ? Math.max(f.splenectomyT, t || 0) || f.splenectomyT : t;
      }
    });
    (raw.medreqs || []).forEach((m) => {
      if (/entered-in-error|cancelled/.test(m.status || "")) return;
      const text = medText(m); if (!text) return;
      f.meds.push({ text, status: m.status || "", t: tOf(m) });
    });
    const active = f.meds.filter((m) => !/stopped|completed|on-hold/.test(m.status)).map((m) => m.text);
    Object.entries(MED).forEach(([k, re]) => { f.cls[k] = [...new Set(active.filter((x) => re.test(x)))]; });
    // anti-CD20 / chemo in the past 6 months (any status) for vaccine timing
    f.recentImmuno = [...new Set(f.meds.filter((m) => (MED.cd20.test(m.text) || MED.chemo.test(m.text)) && (!m.t || now - m.t < 183 * DAY)).map((m) => (MED.cd20.test(m.text) ? "anti-CD20 (" + m.text.split(" ")[0] + ")" : "chemotherapy (" + m.text.split(" ")[0] + ")")))];
    f.cls.proph = f.cls.proph.filter((x) => /\b(250|300|500)\s*mg\b.*(bid|daily|once|q12|twice)|prophyla/i.test(x) || /penicillin v|pen.?vk|phenoxymethyl/i.test(x));
    (raw.conditions || []).forEach((c) => {
      if (c.clinicalStatus && /resolved|inactive|remission/.test(codes(c.clinicalStatus).join(" "))) return;
      if (c.verificationStatus && /refuted|entered-in-error/.test(codes(c.verificationStatus).join(" "))) return;
      const n = label(c.code) + " " + codes(c.code).join(" "); f.probText.push(n.trim());
      Object.entries(PROB).forEach(([k, re]) => { if (re.test(n)) f.prob[k] = (f.prob[k] || []).concat(label(c.code)); });
    });
    // past problems still count for prior OPSI
    (raw.conditions || []).forEach((c) => { const n = label(c.code); if (PROB.opsi.test(n) && !f.prob.opsi) f.prob.opsi = [n]; });
    f.procs.forEach((p) => f.probText.push("Procedure: " + p.name));
    (raw.allergies || []).forEach((a) => {
      if (a.verificationStatus && /refuted|entered-in-error/.test(codes(a.verificationStatus).join(" "))) return;
      if (a.clinicalStatus && /inactive|resolved/.test(codes(a.clinicalStatus).join(" "))) return;
      const name = label(a.code), rx = (a.reaction || []).flatMap((r) => (r.manifestation || []).map(label)).concat((a.reaction || []).map((r) => r.description || "")).filter(Boolean).join(", ");
      f.allergies.push({ name, rx, crit: a.criticality || "" });
    });
    const bl = f.allergies.filter((a) => ALLERGY.pcn.test(a.name));
    f.allergy = !bl.length ? "none" : bl.some((a) => ALLERGY.scar.test(a.rx)) ? "scar" : bl.some((a) => ALLERGY.immediate.test(a.rx) || a.crit === "high") ? "immediate" : "low";
    f.allergyText = bl.map((a) => a.name + (a.rx ? " (" + a.rx + ")" : "")).join("; ");
    (raw.imms || []).forEach((r) => {
      if (/entered-in-error|not-done/.test(r.status || "")) return;
      const name = label(r.vaccineCode) + (codes(r.vaccineCode).length ? " [CVX " + codes(r.vaccineCode).join(",") + "]" : "");
      f.imms.push({ name: name.trim(), t: tOf(r), src: "chart" });
    });
    if (raw.encounter && raw.encounter.period && raw.encounter.period.start) f.admitT = new Date(raw.encounter.period.start).getTime();
    return f;
  }
  const latest = (a, within, now) => { if (!a || !a.length) return null; const x = a[a.length - 1]; return within && (now || Date.now()) - x.t > within ? null : x; };
  // Cockcroft-Gault (Cr in µmol/L, weight kg)
  function crcl(age, sex, wt, cr) { if (age == null || !wt || !cr) return null; return Math.round(((140 - age) * wt * (sex === "female" ? 1.04 : 1.23)) / cr); }

  async function gather(client, say) {
    const pid = client.patient.id, errors = [], tell = say || (() => {});
    const iso = (t) => new Date(t).toISOString().slice(0, 10);
    let immsError = "";
    async function get(url, name, pages, quiet) {
      const once = () => { let tm; return Promise.race([client.request(url, { pageLimit: pages || 1, flat: true }), new Promise((_, rej) => { tm = setTimeout(() => rej(new Error("timed out after 30 s")), 30000); })]).finally(() => clearTimeout(tm)); };
      const transient = (e) => /timed out|\b50[234]\b|Gateway|Failed to fetch|NetworkError/i.test(String((e && e.message) || e));
      try { const r = (await once().catch((e) => (transient(e) ? new Promise((ok) => setTimeout(ok, 1500)).then(once) : Promise.reject(e)))).filter((x) => x.resourceType && x.resourceType !== "OperationOutcome"); tell(`Loaded ${name} (${r.length})…`); return r; }
      catch (e) { if (quiet) immsError = String(e.message || e); else errors.push(`${name}: ${e.message || e}`); return []; }
    }
    const s14 = iso(Date.now() - 14 * DAY), s90 = iso(Date.now() - 90 * DAY), s2y = iso(Date.now() - 730 * DAY);
    const [patient, vitals, labs, reports, medreqs, conditions, procedures, allergies, imms, encs] = await Promise.all([
      (async () => { try { return await client.patient.read(); } catch (e) { errors.push("patient: " + (e.message || e)); return null; } })(),
      get(`Observation?patient=${pid}&category=vital-signs&date=ge${s14}&_count=200`, "vital signs (14 days)", 6),
      get(`Observation?patient=${pid}&category=laboratory&date=ge${s90}&_count=200`, "lab results (90 days)", 8),
      get(`DiagnosticReport?patient=${pid}&date=ge${s2y}&_count=100`, "reports (2 years)", 3),
      get(`MedicationRequest?patient=${pid}&_count=100`, "medication orders", 3),
      get(`Condition?patient=${pid}&_count=100`, "problem list", 2),
      get(`Procedure?patient=${pid}&_count=100`, "procedures", 2),
      get(`AllergyIntolerance?patient=${pid}&_count=50`, "allergies", 1),
      get(`Immunization?patient=${pid}&_count=100`, "immunizations", 3, true),
      client.encounter && client.encounter.id ? get(`Encounter?_id=${client.encounter.id}`, "encounter", 1) : Promise.resolve([])]);
    return { raw: { patient, obs: vitals.concat(labs), reports, medreqs, conditions, procedures, allergies, imms, immsError, encounter: encs[0] || null }, errors };
  }

  const api = { parse, gather, latest, crcl, MED, PROB, DAY, HR };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else window.AspleniaChart = api;
})();
