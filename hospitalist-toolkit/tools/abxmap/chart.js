/* Chart reading for the antibiotic chooser. READ-ONLY. Matching by code and NAME (UNVERIFIED): something not found may still be in the chart. */
(function () {
  const DAY = 864e5;
  const label = (cc) => (cc && (cc.text || (cc.coding || []).map((c) => c.display).find(Boolean))) || "";
  const codes = (cc) => ((cc && cc.coding) || []).map((c) => String(c.code || ""));
  const tOf = (r) => { const d = r.effectiveDateTime || r.issued || r.authoredOn || r.recordedDate || r.onsetDateTime || ""; const t = d ? new Date(d).getTime() : NaN; return isNaN(t) ? null : t; };
  function medText(m) {
    let t = label(m.medicationCodeableConcept) || (m.medicationReference && m.medicationReference.display) || "";
    const di = m.dosageInstruction && m.dosageInstruction[0];
    return [t, di && di.text && di.text !== t ? di.text : ""].filter(Boolean).join(" ").trim();
  }
  const MEDS = {
    valproate: /valpro|divalproex|epival|depakene/i,
    warfarin: /warfarin|coumadin/i,
    serotonergic: /sertraline|citalopram|escitalopram|fluoxetine|paroxetine|fluvoxamine|venlafaxine|duloxetine|desvenlafaxine|tramadol|methadone|trazodone|mirtazapine|lithium|linezolid|moclobemide|phenelzine|tranylcypromine|selegiline|fentanyl/i,
    statinColch: /simvastatin|atorvastatin|lovastatin|colchicine|apixaban|rivaroxaban|amlodipine|diltiazem|verapamil|tacrolimus|cyclosporine/i,
    qtDrug: /amiodarone|sotalol|haloperidol|quetiapine|ondansetron|methadone|citalopram|escitalopram|domperidone|hydroxychloroquine|azithromycin|clarithromycin|levofloxacin|moxifloxacin|ciprofloxacin/i,
    steroids: /prednisone|prednisolone|dexamethasone|methylprednisolone|hydrocortisone/i,
    abx: /cillin|cef|ceph|penem|aztreonam|vancomycin|linezolid|daptomycin|floxacin|mycin|cycline|trimethoprim|sulfameth|nitrofurantoin|fosfomycin|metronidazole|fidaxomicin/i };

  function parse(raw, opts) {
    const now = (opts && opts.now) || Date.now(), f = { meds: [], cls: {}, allergies: [], probs: [], micro: { mrsa: [], esbl: [], pseudo: [], cdiff: [] } };
    const p = raw.patient || {};
    f.sex = String(p.gender || "").toLowerCase();
    const nm = (p.name || [])[0] || {};
    f.name = nm.text || [(nm.given || []).join(" "), nm.family].filter(Boolean).join(" ") || "";
    if (/,/.test(f.name)) f.name = f.name.split(",").map((x) => x.trim()).reverse().join(" "); // "SMITH, John" -> "John SMITH"
    const mrn = (p.identifier || []).find((i) => /\bMR\b|mrn|medical record/i.test(((i.type && (i.type.coding || []).map((c) => c.code + " " + (c.display || "")).join(" ")) || "") + " " + ((i.type && i.type.text) || "") + " " + (i.system || "")));
    f.mrn = mrn ? mrn.value : "";
    if (p.birthDate) f.age = Math.floor((now - new Date(p.birthDate).getTime()) / (365.25 * DAY));
    const latest = (re, loinc, conv, not) => (raw.obs || []).filter((o) => o.valueQuantity && (codes(o.code).some((c) => loinc.includes(c)) || (re.test(label(o.code)) && !(not && not.test(label(o.code)))))).map((o) => ({ t: tOf(o), v: conv ? conv(+o.valueQuantity.value, o.valueQuantity.unit || "") : +o.valueQuantity.value })).filter((x) => x.t).sort((a, b) => b.t - a.t)[0];
    f.cr = latest(/creatinine/i, ["2160-0", "38483-4", "14682-9"], (v, u) => (/mg\s*\/\s*dl/i.test(u) ? v * 88.4 : v), /clearance|ratio|urine|kinase/i);
    f.kg = latest(/body weight|^weight/i, ["29463-7", "3141-9"]);
    f.qtc = latest(/\bqtc\b/i, ["8636-3", "8634-8"]);
    f.wbc = latest(/\bwbc\b|white blood|leukocyte/i, ["6690-2", "26464-8"], null, /urine|esterase|fluid/i);
    (raw.medreqs || []).forEach((m) => { if (["active", "on-hold", "draft"].includes(m.status) || !m.status) f.meds.push(medText(m)); });
    Object.entries(MEDS).forEach(([k, re]) => (f.cls[k] = f.meds.filter((x) => re.test(x))));
    (raw.allergies || []).forEach((a) => {
      if (a.verificationStatus && /refuted|entered-in-error/.test(codes(a.verificationStatus).join(" "))) return;
      const sub = label(a.code), reac = (a.reaction || []).map((r) => [(r.manifestation || []).map(label).join(", "), r.severity || "", r.description || ""].join(" ")).join("; ");
      f.allergies.push({ sub, reac, crit: a.criticality || "" });
    });
    (raw.conditions || []).forEach((c) => {
      if (c.clinicalStatus && /resolved|inactive|remission/.test(codes(c.clinicalStatus).join(" "))) return;
      f.probs.push({ text: label(c.code) + " " + codes(c.code).join(" "), t: tOf(c) });
    });
    const microText = (raw.reports || []).map((r) => ({ t: tOf(r), text: [label(r.code), r.conclusion || ""].join(" — ") }))
      .concat((raw.obs || []).filter((o) => o.valueString || o.valueCodeableConcept).map((o) => ({ t: tOf(o), text: label(o.code) + " " + (o.valueString || label(o.valueCodeableConcept)) })));
    f.microReports = microText.filter((m) => /culture|susceptib|sensitiv|organism|isolate/i.test(m.text)).sort((a, b) => (b.t || 0) - (a.t || 0));
    microText.forEach((m) => {
      if (/\bmrsa\b|methicillin.resistant|oxacillin.resistant/i.test(m.text) && !/not detected|negative|no mrsa/i.test(m.text)) f.micro.mrsa.push(m);
      if (/\besbl\b|extended.spectrum beta|carbapenemase|\bcre\b/i.test(m.text) && !/not detected|negative/i.test(m.text)) f.micro.esbl.push(m);
      if (/pseudomonas/i.test(m.text) && !/not detected|negative/i.test(m.text)) f.micro.pseudo.push(m);
      if (/difficile/i.test(m.text) && /positive|detected/i.test(m.text) && !/not detected/i.test(m.text)) f.micro.cdiff.push(m);
    });
    f.probs.forEach((p2) => { if (/\bmrsa\b/i.test(p2.text)) f.micro.mrsa.push(p2); if (/\besbl\b/i.test(p2.text)) f.micro.esbl.push(p2); if (/difficile|c\.? ?diff/i.test(p2.text)) f.micro.cdiff.push(p2); });
    f.pregnant = f.probs.some((p2) => /pregnan|gestation|O0\d|O[1-9]\d|Z33|Z34/i.test(p2.text)) && f.sex !== "male";
    return f;
  }

  /* Allergy category for the chooser from the allergy list. */
  function allergyCtx(allergies) {
    const out = { allergy: "none", sulfa: false, other: [], why: [] };
    allergies.forEach((a) => {
      const s = a.sub, r = a.reac + " " + a.crit;
      if (/penicillin|amoxicillin|ampicillin|cloxacillin|piperacillin|beta.?lactam|cephalo|cef|ceph/i.test(s)) {
        const delayed = /stevens|\bsjs\b|\bten\b|toxic epidermal|dress|drug reaction with eosin|serum sickness|interstitial nephritis|hemolytic/i.test(r);
        const severe = /anaphyla|angioedema|throat|hypotension|wheez|bronchospasm|airway|epinephrine|high|severe/i.test(r);
        const cat = delayed ? "bl-delayed" : severe ? "pen-severe" : "pen-mild";
        const order = { none: 0, "pen-mild": 1, "pen-severe": 2, "bl-delayed": 3 };
        if (order[cat] > order[out.allergy]) out.allergy = cat;
        out.why.push(`${s}${a.reac.trim() ? " – " + a.reac.trim() : ""}`);
      } else if (/sulfa|sulfonamide|sulfamethoxazole|septra|bactrim|co-?trimoxazole/i.test(s)) { out.sulfa = true; out.why.push(s); }
      else if (s) out.other.push(s);
    });
    return out;
  }

  async function gather(client, say) {
    const pid = client.patient.id, errors = [], tell = say || (() => {});
    const iso = (t) => new Date(t).toISOString().slice(0, 10);
    async function get(url, name, pages) {
      try { const r = (await client.request(url, { pageLimit: pages || 1, flat: true })).filter((x) => x.resourceType && x.resourceType !== "OperationOutcome"); tell(`Loaded ${name} (${r.length})…`); return r; }
      catch (e) { errors.push(`${name}: ${e.message || e}`); return []; }
    }
    const [patient, labs, vit, medreqs, conditions, allergies, reports] = await Promise.all([
      (async () => { try { return await client.patient.read(); } catch (e) { errors.push("patient: " + (e.message || e)); return null; } })(),
      get(`Observation?patient=${pid}&category=laboratory&date=ge${iso(Date.now() - 365 * DAY)}&_count=200`, "labs and cultures (1 year)", 6),
      get(`Observation?patient=${pid}&category=vital-signs&date=ge${iso(Date.now() - 30 * DAY)}&_count=100`, "vitals/weight (30 days)", 2),
      get(`MedicationRequest?patient=${pid}&_count=100`, "medication orders", 3),
      get(`Condition?patient=${pid}&_count=100`, "problems", 2),
      get(`AllergyIntolerance?patient=${pid}&_count=50`, "allergies", 1),
      get(`DiagnosticReport?patient=${pid}&date=ge${iso(Date.now() - 365 * DAY)}&_count=100`, "reports and cultures (1 year)", 3)]);
    return { raw: { patient, obs: labs.concat(vit), medreqs, conditions, allergies, reports }, errors };
  }

  const api = { parse, allergyCtx, gather, MEDS };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else window.AbxMapChart = api;
})();
