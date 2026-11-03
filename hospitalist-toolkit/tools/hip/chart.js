/* Chart reading for the hip fracture tab. READ-ONLY. Labs matched by LOINC then NAME; drugs and procedures by NAME (UNVERIFIED patterns). */
(function () {
  const DAY = 864e5;
  const label = (cc) => (cc && (cc.text || (cc.coding || []).map((c) => c.display).find(Boolean))) || "";
  const codes = (cc) => ((cc && cc.coding) || []).map((c) => String(c.code || ""));
  const tOf = (r) => { const d = r.effectiveDateTime || (r.effectivePeriod && r.effectivePeriod.start) || r.performedDateTime || (r.performedPeriod && r.performedPeriod.start) || r.issued || r.authoredOn || r.onsetDateTime || r.recordedDate || ""; const t = d ? new Date(d).getTime() : NaN; return isNaN(t) ? null : t; };
  const NOT_BLOOD = /urine|\bur\b|csf|fluid|stool/i;
  const mg = (f) => (v, u) => (/mg\s*\/\s*dl/i.test(u || "") ? v * f : v);
  const LABS = [
    { id: "hgb", loinc: ["718-7", "20509-6", "59260-0"], re: /hemoglobin|haemoglobin|^hgb\b/i, not: /a1c|glycated|mean corpuscular|mch|free/i, conv: (v, u) => (/g\s*\/\s*dl/i.test(u || "") || v < 25 ? v * 10 : v) },
    { id: "plt", loinc: ["777-3", "26515-7"], re: /platelet/i, not: /volume|mpv|function/i },
    { id: "inr", loinc: ["6301-6", "34714-6"], re: /\binr\b|international normali/i },
    { id: "na", loinc: ["2951-2", "2947-0"], re: /^sodium|\bsodium\b/i, not: /fraction/i },
    { id: "k", loinc: ["2823-3", "6298-4"], re: /potassium/i },
    { id: "glu", loinc: ["2345-7", "2339-0", "41653-7"], re: /glucose/i, conv: (v, u) => (/mg\s*\/\s*dl/i.test(u || "") || v > 60 ? v / 18.016 : v) },
    { id: "cr", loinc: ["2160-0", "38483-4"], re: /creatinine/i, not: /ratio|kinase|clearance/i, conv: mg(88.4) },
    { id: "ca", loinc: ["17861-6", "2000-8"], re: /^calcium|calcium,? total|total calcium/i, not: /ionized|ionised|urine/i, conv: mg(0.2495) },
    { id: "alb", loinc: ["1751-7"], re: /albumin/i, not: /micro|creatinine|ratio/i, conv: (v, u) => (/g\s*\/\s*dl/i.test(u || "") || v < 10 ? v * 10 : v) },
    { id: "vitd", loinc: ["1989-3", "35365-6", "62292-8"], re: /25.?hydroxy|vitamin d/i, conv: (v, u) => (/ng\s*\/\s*ml/i.test(u || "") ? v * 2.496 : v) },
    { id: "ptt", loinc: ["3173-2", "14979-9"], re: /\bptt\b|partial thromboplastin/i },
    { id: "tt", loinc: ["3243-3"], re: /thrombin time/i }];
  const TS = /abo|rh\b|type and screen|group and screen|antibody screen|blood group|crossmatch|cross match/i;
  const DRUGS = [
    ["xa", /apixaban|eliquis|rivaroxaban|xarelto|edoxaban|lixiana|savaysa/i], ["dabigatran", /dabigatran|pradaxa/i], ["warfarin", /warfarin|coumadin/i],
    ["lmwh", /enoxaparin|lovenox|dalteparin|fragmin|tinzaparin|innohep/i], ["ufh", /\bheparin\b/i],
    ["asa", /aspirin|\basa\b|acetylsalicylic/i], ["p2y12", /clopidogrel|plavix|prasugrel|ticagrelor|brilinta/i],
    ["vitk", /phytonadione|vitamin k\b|phytomenadione/i], ["pcc", /octaplex|beriplex|kcentra|prothrombin complex/i], ["txa", /tranexamic/i],
    ["acetaminophen", /acetaminophen|paracetamol|tylenol/i], ["opioid", /morphine|hydromorphone|dilaudid|oxycodone|fentanyl|tramadol|codeine|tapentadol|methadone|meperidine/i],
    ["nsaid", /ibuprofen|naproxen|diclofenac|ketorolac|celecoxib|meloxicam|indomethacin/i], ["block", /bupivacaine|ropivacaine|fascia iliaca|nerve block|peng block|femoral nerve/i],
    ["bowel", /senn|sennoside|polyethylene glycol|peg ?3350|lax-?a-?day|restoralax|lactulose|bisacodyl|docusate|glycerin supp|sodium picosulfate/i],
    ["delirium", /lorazepam|diazepam|clonazepam|alprazolam|temazepam|oxazepam|midazolam|zopiclone|zolpidem|diphenhydramine|benadryl|hydroxyzine|dimenhydrinate|gravol|promethazine|oxybutynin|tolterodine|amitriptyline|nortriptyline|doxepin|scopolamine|meperidine|cyclobenzaprine|chlorpheniramine/i],
    ["antipsych", /haloperidol|quetiapine|olanzapine|risperidone/i],
    ["vitd", /cholecalciferol|ergocalciferol|vitamin d|d-?vi-?sol/i], ["calcium", /calcium carbonate|calcium citrate|caltrate|os-?cal/i],
    ["osteo", /alendron|fosamax|risedron|actonel|zoledron|aclasta|reclast|denosumab|prolia|teriparatide|forteo|romosozumab|evenity|ibandron/i],
    ["iron", /iron sucrose|venofer|ferric derisomaltose|monoferric|ferric carboxymaltose|ferrous/i], ["rbc", /red blood cell|packed cells|prbc|\brbc\b transfusion/i]];
  const SURGERY = /hemiarthroplasty|hemi-arthroplasty|arthroplasty.*hip|hip arthroplasty|total hip|intramedullary nail|cephalomedullary|gamma nail|tfna|pfna|dynamic hip screw|\bdhs\b|sliding hip screw|cannulated screw|(orif|open reduction).*(hip|femur|femoral)|hip.*(fixation|pinning)|femoral neck.*(fixation|screw)|hip fracture repair/i;
  const FRACTURE = /hip fracture|fracture.*(neck of femur|femoral neck|intertrochanteric|pertrochanteric|subtrochanteric|trochanteric|proximal femur)|(neck of femur|femoral neck|intertrochanteric|pertrochanteric|subtrochanteric).*fracture|\bS72\.[0-2]/i;
  const PROB = { dementia: /dementia|alzheimer|F0[0-3]|G30|cognitive impairment/i, malignancy: /malignan|cancer|carcinoma|lymphoma|leuk(a)?emia|myeloma|metasta|\bC[0-8]\d|\bC9[0-7]/i,
    cardiac: /heart failure|I50|coronary|ischemic heart|I2[0-5]|myocardial infarction|aortic stenosis|I35\.0|atrial fibrillation|I48/i, cerebro: /stroke|cerebrovascular|I6[0-9]|transient ischemic|G45/i,
    resp: /copd|J44|asthma|J45|interstitial lung|J84|respiratory failure/i, renal: /chronic kidney|N18|renal failure/i, diabetes: /diabetes|E1[0-4]/i,
    parkinson: /parkinson|G20/i, institution: /nursing home|long.term care|assisted living|residential care|Z59\.3|Z99\.89/i, osteo: /osteoporo|M80|M81/i, prevvte: /deep vein|pulmonary embol|venous thromboembol|I26|I82\.4/i, valve: /mechanical (heart )?valve|Z95\.2/i, alcohol: /alcohol|F10/i };

  function medText(m) {
    let t = label(m.medicationCodeableConcept) || (m.medicationReference && m.medicationReference.display) || "";
    if (!t && m.medicationReference && m.contained) { const c = m.contained.find((x) => m.medicationReference.reference === "#" + x.id); if (c) t = label(c.code); }
    const di = m.dosageInstruction && m.dosageInstruction[0], d = m.dosage && m.dosage.dose;
    return [t, d && d.value != null ? d.value + " " + (d.unit || "") : "", di && di.text].filter(Boolean).join(" ").trim();
  }

  function parse(raw, opts) {
    const now = (opts && opts.now) || Date.now();
    const f = { sex: "", age: null, labs: {}, ts: null, vit: [], weights: [], heights: [], meds: [], procs: [], surgery: null, fracture: null, arrival: null, prob: {} };
    LABS.forEach((d) => (f.labs[d.id] = []));
    const p = raw.patient;
    if (p) { f.sex = String(p.gender || "").toLowerCase(); if (p.birthDate) f.age = Math.floor((now - new Date(p.birthDate).getTime()) / (365.25 * DAY)); }
    const seen = new Set();
    (raw.obs || []).forEach((o) => {
      if (!o || o.resourceType !== "Observation" || /entered-in-error|cancelled/.test(o.status || "")) return;
      const t = tOf(o); if (t == null || t > now + DAY) return;
      const name = label(o.code), cs = codes(o.code), q = o.valueQuantity, u = (q && q.unit) || "";
      const key = name + cs.join() + t + (q ? q.value : o.valueString); if (seen.has(key)) return; seen.add(key);
      if (cs.some((c) => ["882-1", "890-4", "883-9", "10331-7"].includes(c)) || TS.test(name)) { if (!f.ts || t > f.ts.t) f.ts = { t, text: o.valueString || label(o.valueCodeableConcept) || "" }; return; }
      if (!q || typeof q.value !== "number") return;
      if (cs.some((c) => ["29463-7", "3141-9"].includes(c)) || /body weight|^weight/i.test(name)) { let v = q.value; if (/lb/i.test(u)) v *= 0.4536; if (v >= 25 && v <= 350) f.weights.push({ t, v }); return; }
      if (cs.some((c) => ["8302-2", "8306-3"].includes(c)) || /body height|^height/i.test(name)) { let v = q.value; if (/\bin\b|inch/i.test(u)) v *= 2.54; if (v >= 100 && v <= 230) f.heights.push({ t, v }); return; }
      const vrow = {};
      if (cs.includes("8867-4") || /heart rate|pulse rate/i.test(name)) vrow.hr = q.value;
      if (cs.some((c) => ["59408-5", "2708-6"].includes(c)) || /spo2|oxygen saturation/i.test(name)) vrow.spo2 = q.value;
      if (cs.some((c) => ["8310-5", "8331-1"].includes(c)) || /body temperature|^temp/i.test(name)) vrow.temp = q.value > 50 ? Math.round(((q.value - 32) * 5) / 9 * 10) / 10 : q.value;
      if (cs.includes("8480-6") || /systolic/i.test(name)) vrow.sbp = q.value;
      if (Object.keys(vrow).length) { f.vit.push(Object.assign({ t }, vrow)); return; }
      if (NOT_BLOOD.test(name)) return;
      const d = LABS.find((x) => x.loinc.some((c) => cs.includes(c))) || LABS.find((x) => x.re.test(name) && !(x.not && x.not.test(name)));
      if (d) f.labs[d.id].push({ t, v: d.conv ? d.conv(q.value, u) : q.value, shown: q.value + " " + u });
    });
    const srt = (a) => a.sort((x, y) => x.t - y.t);
    Object.values(f.labs).forEach(srt); srt(f.vit); srt(f.weights); srt(f.heights);

    [].concat(raw.medreqs || [], raw.admins || []).forEach((m) => {
      const isReq = m.resourceType === "MedicationRequest";
      if (isReq && /cancelled|entered-in-error|draft/.test(m.status || "")) return;
      const name = medText(m), t = tOf(m), cats = DRUGS.filter(([, re]) => re.test(name)).map(([id]) => id);
      if (cats.includes("lmwh") && cats.includes("ufh")) cats.splice(cats.indexOf("ufh"), 1);
      if (!cats.length) return;
      f.meds.push({ name, t, cats, active: isReq && /active|on-hold/.test(m.status || "active"), stopped: isReq && /stopped|completed/.test(m.status || ""), given: !isReq });
    });
    (raw.procs || []).forEach((pr) => {
      const t = tOf(pr), n = label(pr.code); if (!t) return;
      f.procs.push({ t, n });
      if (SURGERY.test(n) && /completed|in-progress/.test(pr.status || "completed") && (!f.surgery || t > f.surgery.t)) f.surgery = { t, n };
      if (/nerve block|fascia iliaca|peng block|femoral block/i.test(n)) f.meds.push({ name: n, t, cats: ["block"], given: true });
      if (/transfusion|red (blood )?cell/i.test(n)) f.meds.push({ name: n, t, cats: ["rbc"], given: true });
    });
    (raw.conditions || []).forEach((c) => {
      if (c.clinicalStatus && /resolved|inactive|remission/i.test(JSON.stringify(c.clinicalStatus))) return;
      const txt = label(c.code) + " " + codes(c.code).join(" ");
      if (FRACTURE.test(txt)) { const t = tOf(c); if (!f.fracture || (t && t > (f.fracture.t || 0))) f.fracture = { t, n: label(c.code) || codes(c.code)[0] }; }
      Object.keys(PROB).forEach((k) => { if (PROB[k].test(txt)) (f.prob[k] = f.prob[k] || []).push(label(c.code) || codes(c.code)[0]); });
    });
    // arrival: start of the current encounter (else the fracture diagnosis date)
    const encs = (raw.encounters || []).filter((e) => e.period && e.period.start && !/cancelled|entered-in-error/.test(e.status || "")).map((e) => ({ t: new Date(e.period.start).getTime(), end: e.period.end ? new Date(e.period.end).getTime() : null, status: e.status }))
      .filter((e) => !isNaN(e.t) && e.t <= now && (!e.end || e.end >= now - 2 * DAY)).sort((a, b) => a.t - b.t);
    if (encs.length) f.arrival = { t: encs[0].t, src: "encounter start" };
    else if (f.fracture && f.fracture.t) f.arrival = { t: f.fracture.t, src: "fracture diagnosis date" };
    return f;
  }

  const latest = (arr, maxAge, now) => { const e = arr && arr.length ? arr[arr.length - 1] : null; return e && (!maxAge || (now || Date.now()) - e.t <= maxAge) ? e : null; };
  const recent = (f, cat, days, now) => f.meds.filter((m) => m.cats.includes(cat) && !m.stopped && (m.active || (m.t && (now || Date.now()) - m.t <= days * DAY)));
  const lastGiven = (f, cat) => f.meds.filter((m) => m.given && m.cats.includes(cat) && m.t).reduce((a, m) => (!a || m.t > a.t ? m : a), null);
  const names = (list) => [...new Set(list.map((m) => m.name.replace(/\s+\d.*$/, "").trim() || m.name))];

  async function gather(client, say) {
    const pid = client.patient.id, errors = [], tell = say || (() => {});
    const iso = (t) => new Date(t).toISOString().slice(0, 10);
    async function get(url, name, pages) {
      const timer = new Promise((_, rej) => setTimeout(() => rej(new Error("timed out after 60 s")), 60000));
      try { const r = (await Promise.race([client.request(url, { pageLimit: pages || 1, flat: true }), timer])).filter((x) => x.resourceType && x.resourceType !== "OperationOutcome"); tell(`Loaded ${name} (${r.length})…`); return r; }
      catch (e) { errors.push(`${name}: ${e.message || e}`); return []; }
    }
    const s30 = iso(Date.now() - 30 * DAY), s180 = iso(Date.now() - 180 * DAY), s14 = iso(Date.now() - 14 * DAY), s7 = iso(Date.now() - 7 * DAY);
    const [patient, labs, vitd, vit, wh, medreqs, admins, procs, conditions, encounters] = await Promise.all([
      (async () => { try { return await client.patient.read(); } catch (e) { errors.push("patient: " + (e.message || e)); return null; } })(),
      get(`Observation?patient=${pid}&category=laboratory&date=ge${s30}&_count=100`, "lab results (30 days)", 8),
      get(`Observation?patient=${pid}&code=http://loinc.org|1989-3,http://loinc.org|35365-6,http://loinc.org|62292-8&date=ge${s180}&_count=20`, "vitamin D (6 months)", 1),
      get(`Observation?patient=${pid}&category=vital-signs&date=ge${s7}&_count=100`, "vital signs (7 days)", 5),
      get(`Observation?patient=${pid}&code=http://loinc.org|29463-7,http://loinc.org|3141-9,http://loinc.org|8302-2,http://loinc.org|8306-3&_count=50`, "weight and height", 1),
      get(`MedicationRequest?patient=${pid}&_count=100`, "medication orders", 3),
      get(`MedicationAdministration?patient=${pid}&effective-time=ge${s14}&_count=100`, "medications given (14 days)", 5),
      get(`Procedure?patient=${pid}&date=ge${s30}&_count=100`, "procedures (30 days)", 2),
      get(`Condition?patient=${pid}&_count=100`, "problem list", 2),
      get(`Encounter?patient=${pid}&date=ge${s30}&_count=50`, "encounters (30 days)", 1)]);
    return { raw: { patient, obs: labs.concat(vitd, vit, wh), medreqs, admins, procs, conditions, encounters }, errors };
  }

  window.HipChart = { parse, latest, recent, lastGiven, names, gather, DAY };
})();
