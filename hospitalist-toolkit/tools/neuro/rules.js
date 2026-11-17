/* Neuro (non-stroke) tab: rules. Pure functions, no page or chart access, so they can be tested with node (tests/test_neuro.js).
   UNVERIFIED draft written by Claude from general knowledge: thresholds and scores are aids to thinking, not validated tools. */
(function (root) {
  /* ---------- findings the clinician ticks (some are ticked automatically from the chart) ---------- */
  const FINDINGS = [
    { group: "Weakness pattern", items: [
      ["hemi", "One side: face, arm and/or leg"],
      ["para", "Both legs (± arms)"],
      ["ascend", "Ascending over days, starting in the legs"],
      ["prox", "Proximal (rising from chair, arms above head)"],
      ["fatig", "Fatigable, worse later in the day"],
      ["single", "One limb or one nerve (wrist or foot drop)"]] },
    { group: "Signs", items: [
      ["areflex", "Reflexes reduced or absent"],
      ["hyperreflex", "Brisk reflexes, upgoing plantar or clonus"],
      ["sensLevel", "Sensory level on the trunk"],
      ["saddle", "Saddle (perineal) numbness"],
      ["retention", "New urinary retention or incontinence"],
      ["distalNumb", "Tingling that started in the feet or hands"],
      ["ptosis", "Ptosis or double vision"],
      ["bulbar", "Trouble swallowing or speaking, weak neck"],
      ["facial", "Facial weakness"],
      ["dyspnea", "Breathless, weak cough, accessory muscles"],
      ["autonomic", "BP or heart rate swings"],
      ["backpain", "New back pain or spine tenderness"]] },
    { group: "Head / level of consciousness", items: [
      ["drowsy", "Drowsy, confused, or new headache"],
      ["fall", "Fall or head injury"],
      ["gradual", "Getting worse over days to weeks"]] },
    { group: "Vertigo", items: [
      ["vertigo", "Vertigo or dizziness"],
      ["vPositional", "Brief (under 1 min), set off by head position"],
      ["vConstant", "Constant for hours to days, with nystagmus"],
      ["hitNormal", "Head impulse test NORMAL (no catch-up saccade)"],
      ["nysCentral", "Nystagmus changes direction or is vertical"],
      ["skew", "Skew deviation on cover test"],
      ["hearing", "New hearing loss"],
      ["cantWalk", "Cannot walk unaided / severe truncal ataxia"],
      ["dixPos", "Dix-Hallpike positive"]] },
    { group: "Multiple sclerosis", items: [
      ["msNew", "New or worse MS symptoms for over 24 h"],
      ["heat", "Hot, exercising, or recent heat exposure"]] },
    { group: "Background (chart fills some)", items: [
      ["cancer", "Cancer history"],
      ["fever", "Fever or sepsis"],
      ["recentInf", "Diarrhea or chest infection in the past 4 weeks"],
      ["anticoag", "On an anticoagulant"],
      ["antiplt", "On an antiplatelet"],
      ["spineProc", "Recent spinal procedure, epidural or LP"],
      ["absRisk", "IV drug use, bacteremia or diabetes"],
      ["knownMS", "Known MS"],
      ["knownMG", "Known myasthenia gravis"],
      ["lowK", "Potassium under 3.0"],
      ["highCK", "CK over 1000"]] }];
  const LABEL = {}; FINDINGS.forEach((g) => g.items.forEach(([k, l]) => (LABEL[k] = l)));

  /* ---------- ranked list of diagnoses ---------- */
  const DX = [
    { id: "cord", name: "Spinal cord compression (tumour, abscess, hematoma)", card: "cord", urg: "now", cantMiss: true,
      score: (f) => s(f, { para: 2, sensLevel: 3, retention: 2, backpain: 2, spineProc: 1 }) + (f.hyperreflex && f.para ? 1 : 0)
        + (f.cancer && (f.backpain || f.para || f.sensLevel) ? 2 : 0) + (f.fever && f.backpain ? 2 : 0) + (f.absRisk && f.backpain ? 1 : 0)
        + (f.anticoag && f.spineProc ? 2 : 0) },
    { id: "cauda", name: "Cauda equina syndrome", card: "cauda", urg: "now", cantMiss: true,
      score: (f) => s(f, { saddle: 4, retention: 2, backpain: 2 }) + (f.para ? 1 : 0) + (f.areflex && f.para ? 1 : 0) + (f.cancer && f.backpain ? 1 : 0) },
    { id: "gbs", name: "Guillain-Barré syndrome", card: "gbs", urg: "today", cantMiss: true,
      score: (f) => s(f, { ascend: 3, areflex: 2, recentInf: 1, distalNumb: 1, facial: 1, bulbar: 1, autonomic: 1, dyspnea: 1 })
        + (f.para ? 1 : 0) - (f.sensLevel ? 2 : 0) - (f.hyperreflex ? 2 : 0) - (f.fatig ? 1 : 0) },
    { id: "mg", name: "Myasthenia gravis (crisis if breathing or swallowing affected)", card: "mg", urg: "today", cantMiss: true,
      score: (f) => s(f, { fatig: 3, ptosis: 3, bulbar: 2, knownMG: 3, dyspnea: 1 }) - (f.areflex ? 1 : 0) - (f.distalNumb ? 1 : 0) - (f.sensLevel ? 2 : 0) },
    { id: "ms", name: "MS relapse or pseudo-relapse", card: "ms", urg: "today",
      score: (f) => s(f, { knownMS: 2, msNew: 2, heat: 1 }) },
    { id: "sdh", name: "Subdural hematoma (acute or chronic)", card: "sdh", urg: "now", cantMiss: true,
      score: (f) => s(f, { drowsy: 2, fall: 2, gradual: 1 }) + ((f.anticoag || f.antiplt) && (f.drowsy || f.fall || f.hemi) ? 2 : 0) + (f.hemi && (f.drowsy || f.fall) ? 1 : 0) },
    { id: "stroke", name: "Stroke or TIA (use the Stroke tab / code stroke)", card: null, urg: "now", cantMiss: true,
      score: (f) => (f.hemi ? 3 : 0) + (f.facial && !f.bulbar ? 1 : 0) - (f.fall && f.drowsy ? 1 : 0) },
    { id: "vcentral", name: "Central vertigo: posterior circulation stroke", card: "vertigo", urg: "now", cantMiss: true,
      score: (f) => f.vertigo || f.vConstant ? s(f, { hitNormal: 3, nysCentral: 3, skew: 3, hearing: 2, cantWalk: 2 }) + (f.vConstant ? 1 : 0) : 0 },
    { id: "bppv", name: "BPPV", card: "vertigo", urg: "routine",
      score: (f) => s(f, { vPositional: 3, dixPos: 3 }) - (f.vConstant ? 2 : 0) - (f.nysCentral ? 3 : 0) },
    { id: "vneur", name: "Vestibular neuritis / labyrinthitis", card: "vertigo", urg: "routine",
      score: (f) => (f.vConstant ? 3 : 0) - (f.hitNormal || f.nysCentral || f.skew || f.cantWalk ? 4 : 0) - (f.vPositional ? 1 : 0) },
    { id: "hypok", name: "Hypokalemic weakness", card: "weak", urg: "today", score: (f) => (f.lowK ? 3 : 0) + (f.para || f.prox ? 1 : 0) },
    { id: "myo", name: "Myopathy / rhabdomyolysis / myositis", card: "weak", urg: "today", score: (f) => s(f, { prox: 2, highCK: 3 }) - (f.areflex ? 1 : 0) },
    { id: "neurop", name: "Peripheral neuropathy (B12, alcohol, diabetes, chemo)", card: "weak", urg: "routine",
      score: (f) => s(f, { distalNumb: 2, areflex: 1 }) - (f.ascend ? 2 : 0) - (f.sensLevel ? 2 : 0) },
    { id: "mono", name: "Single nerve or root lesion (compression palsy, radiculopathy)", card: "weak", urg: "routine", score: (f) => (f.single ? 3 : 0) }];
  function s(f, w) { let n = 0; for (const k in w) if (f[k]) n += w[k]; return n; }

  function rank(f) {
    return DX.map((d) => {
      const sc = d.score(f);
      return { id: d.id, name: d.name, card: d.card, urg: d.urg, cantMiss: !!d.cantMiss, score: sc, why: why(d, f) };
    }).filter((d) => d.score >= 3).sort((a, b) => b.score - a.score || (a.urg === "now" ? -1 : 1));
  }
  const WHY = {
    cord: ["para", "sensLevel", "retention", "backpain", "hyperreflex", "cancer", "fever", "spineProc", "anticoag", "absRisk"],
    cauda: ["saddle", "retention", "backpain", "para", "areflex", "cancer"],
    gbs: ["ascend", "areflex", "recentInf", "distalNumb", "facial", "bulbar", "autonomic", "dyspnea"],
    mg: ["fatig", "ptosis", "bulbar", "knownMG", "dyspnea"],
    ms: ["knownMS", "msNew", "heat"], sdh: ["drowsy", "fall", "gradual", "anticoag", "antiplt", "hemi"],
    stroke: ["hemi", "facial"], vcentral: ["hitNormal", "nysCentral", "skew", "hearing", "cantWalk", "vConstant"],
    bppv: ["vPositional", "dixPos"], vneur: ["vConstant"], hypok: ["lowK", "para", "prox"], myo: ["prox", "highCK"],
    neurop: ["distalNumb", "areflex"], mono: ["single"] };
  const why = (d, f) => (WHY[d.id] || []).filter((k) => f[k]).map((k) => LABEL[k]);

  /* ---------- breathing in GBS / MG: the 20/30/40 rule ----------
     rows: [{t, fvc (L), nif (cmH2O, negative), mep (cmH2O)}]; weight kg */
  function breathing(rows, weightKg) {
    const r = (rows || []).filter((x) => x && x.t != null).sort((a, b) => a.t - b.t);
    const last = (k) => { for (let i = r.length - 1; i >= 0; i--) if (r[i][k] != null && !isNaN(r[i][k])) return r[i]; return null; };
    const out = { flags: [], fvc: last("fvc"), nif: last("nif"), mep: last("mep"), fvcPerKg: null, drop: null, icu: false };
    if (out.fvc && weightKg) out.fvcPerKg = Math.round((out.fvc.fvc * 1000) / weightKg);
    if (out.fvcPerKg != null && out.fvcPerKg < 20) out.flags.push({ lvl: "urgent", text: `FVC ${out.fvcPerKg} mL/kg: under 20 mL/kg. ICU now; consider intubation.` });
    else if (out.fvcPerKg != null && out.fvcPerKg < 30) out.flags.push({ lvl: "action", text: `FVC ${out.fvcPerKg} mL/kg: under 30 mL/kg. Close to the ICU threshold; tell ICU, check every 2–4 h.` });
    if (out.fvc && !weightKg && out.fvc.fvc < 1.5) out.flags.push({ lvl: "action", text: `FVC ${out.fvc.fvc} L with no weight on file: enter the weight to apply the 20 mL/kg rule.` });
    if (out.nif) {
      const n = -Math.abs(out.nif.nif);
      if (n > -30) out.flags.push({ lvl: "urgent", text: `NIF ${n} cmH₂O: weaker than −30. ICU now.` });
      else if (n > -40) out.flags.push({ lvl: "action", text: `NIF ${n} cmH₂O: approaching −30.` });
    }
    if (out.mep && out.mep.mep < 40) out.flags.push({ lvl: "urgent", text: `MEP ${out.mep.mep} cmH₂O: under 40, weak cough. ICU now.` });
    // fall of 30% or more from the best FVC in the past 48 h
    const fv = r.filter((x) => x.fvc != null);
    if (fv.length >= 2) {
      const lastT = fv[fv.length - 1].t, recent = fv.filter((x) => lastT - x.t <= 48 * 36e5);
      const best = Math.max(...recent.map((x) => x.fvc)), cur = fv[fv.length - 1].fvc;
      out.drop = best > 0 ? Math.round(((best - cur) / best) * 100) : null;
      if (out.drop >= 30) out.flags.push({ lvl: "urgent", text: `FVC has fallen ${out.drop}% from the best value in 48 h (${best} → ${cur} L). Falling fast: ICU review.` });
      else if (out.drop >= 15) out.flags.push({ lvl: "action", text: `FVC down ${out.drop}% from the best value in 48 h. Increase checks.` });
    }
    out.icu = out.flags.some((x) => x.lvl === "urgent");
    return out;
  }

  /* ---------- myasthenia: medicines that can make it worse ---------- */
  const MG_DRUGS = [
    { re: /succinylcholine|suxamethonium|rocuronium|vecuronium|cisatracurium|atracurium|pancuronium/i, lvl: "avoid", why: "neuromuscular blocker: prolonged weakness; tell anesthesia the patient has MG" },
    { re: /magnesium sulfate|magnesium sulphate|mg sulfate/i, lvl: "avoid", why: "IV magnesium can cause crisis; avoid unless essential (e.g. eclampsia) and monitor" },
    { re: /botulinum|botox|dysport|xeomin/i, lvl: "avoid", why: "botulinum toxin worsens weakness" },
    { re: /telithromycin/i, lvl: "avoid", why: "contraindicated in MG" },
    { re: /pembrolizumab|nivolumab|ipilimumab|atezolizumab|durvalumab|avelumab|cemiplimab|dostarlimab|tremelimumab/i, lvl: "avoid", why: "checkpoint inhibitor: can cause or worsen MG (often with myositis/myocarditis)" },
    { re: /gentamicin|tobramycin|amikacin|streptomycin|neomycin/i, lvl: "caution", why: "aminoglycoside: use only if no alternative; monitor strength" },
    { re: /ciprofloxacin|levofloxacin|moxifloxacin|norfloxacin|ofloxacin/i, lvl: "caution", why: "fluoroquinolone: FDA warning, can worsen MG" },
    { re: /azithromycin|clarithromycin|erythromycin/i, lvl: "caution", why: "macrolide: can worsen MG" },
    { re: /colistin|polymyxin/i, lvl: "caution", why: "polymyxin: neuromuscular blockade" },
    { re: /\b\w+olol\b|labetalol|carvedilol/i, lvl: "caution", why: "beta-blocker (including eye drops): can worsen weakness" },
    { re: /procainamide|quinidine|quinine/i, lvl: "caution", why: "can worsen MG" },
    { re: /hydroxychloroquine|chloroquine/i, lvl: "caution", why: "can cause or worsen MG" },
    { re: /penicillamine/i, lvl: "caution", why: "can cause MG" },
    { re: /phenytoin|lithium/i, lvl: "caution", why: "case reports of worsening" },
    { re: /verapamil|diltiazem|nifedipine|amlodipine/i, lvl: "minor", why: "calcium channel blocker: occasional worsening" },
    { re: /atorvastatin|rosuvastatin|simvastatin|pravastatin|lovastatin/i, lvl: "minor", why: "statin: occasional worsening; usually continue" },
    { re: /prednisone|methylprednisolone|dexamethasone|hydrocortisone/i, lvl: "info", why: "steroid: a high starting dose can worsen MG for 5–10 days unless covered by IVIG or PLEX" }];
  function mgCheck(meds) {
    const out = [], seen = new Set();
    (meds || []).forEach((m) => MG_DRUGS.forEach((d) => {
      if (d.re.test(m) && !seen.has(m + d.lvl)) { seen.add(m + d.lvl); out.push({ med: m, lvl: d.lvl, why: d.why }); }
    }));
    const order = { avoid: 0, caution: 1, minor: 2, info: 3 };
    return out.sort((a, b) => order[a.lvl] - order[b.lvl]);
  }

  /* ---------- antithrombotics and reversal (subdural, cord hematoma, before LP or surgery) ---------- */
  const ANTITHROMB = [
    { re: /warfarin|coumadin/i, kind: "warfarin", rev: "4-factor PCC (dose by INR and weight) + vitamin K 10 mg IV. Recheck INR 15–30 min after PCC." },
    { re: /dabigatran|pradaxa/i, kind: "dabigatran", rev: "Idarucizumab 5 g IV. Check creatinine (renal clearance). Dialysis removes it." },
    { re: /apixaban|eliquis|rivaroxaban|xarelto|edoxaban|lixiana|savaysa/i, kind: "factor Xa inhibitor", rev: "4-factor PCC (often 2000 units, or 50 units/kg) or andexanet where available. Note time of last dose." },
    { re: /enoxaparin\s*(30|40)\s*mg|dalteparin\s*5,?000|tinzaparin\s*4,?500|heparin\s*5,?000\s*units?\s*(subcut|sc|s\.c)|fondaparinux\s*2\.5/i, kind: "VTE prophylaxis dose", rev: "Prophylactic dose: hold if bleeding; reversal usually not needed. Note time of last dose before LP or surgery." },
    { re: /enoxaparin|dalteparin|tinzaparin|fondaparinux/i, kind: "LMWH", rev: "Protamine (partial reversal of LMWH; none for fondaparinux). Note time of last dose." },
    { re: /\bheparin\b(?!.*(flush|lock))/i, kind: "heparin", rev: "Stop infusion; protamine 1 mg per 100 units given in the past 2–3 h (max 50 mg)." },
    { re: /\baspirin\b|\basa\b|acetylsalicylic/i, kind: "antiplatelet", rev: "Hold. Platelet transfusion is not routine; discuss with neurosurgery if surgery is planned." },
    { re: /clopidogrel|ticagrelor|prasugrel|plavix|brilinta/i, kind: "antiplatelet", rev: "Hold. Platelet transfusion is not routine; discuss with neurosurgery if surgery is planned." }];
  function antithrombotics(meds) {
    const out = [];
    (meds || []).forEach((m) => { const a = ANTITHROMB.find((x) => x.re.test(m)); if (a && !out.some((o) => o.med === m)) out.push({ med: m, kind: a.kind, rev: a.rev }); });
    return out;
  }

  /* ---------- MS: true relapse or pseudo-relapse ----------
     x: { tempMax, wbc, crp, uaPositive (bool|null), heat (bool) } */
  function pseudoRelapse(x) {
    const trig = [];
    if (x.tempMax != null && x.tempMax >= 37.8) trig.push(`temperature ${x.tempMax} °C`);
    if (x.wbc != null && x.wbc > 11) trig.push(`WBC ${x.wbc}`);
    if (x.crp != null && x.crp > 10) trig.push(`CRP ${x.crp}`);
    if (x.uaPositive) trig.push("urinalysis positive (leukocyte esterase or nitrite)");
    if (x.heat) trig.push("heat or exertion");
    const missing = [];
    if (x.tempMax == null) missing.push("temperature");
    if (x.wbc == null) missing.push("WBC");
    if (x.uaPositive == null) missing.push("urinalysis");
    return {
      verdict: trig.length ? "pseudo" : missing.length ? "incomplete" : "true",
      triggers: trig, missing,
      text: trig.length
        ? "Possible pseudo-relapse: a trigger is present (" + trig.join("; ") + "). Treat the trigger and recheck in 24–48 h before giving steroids."
        : missing.length ? "Check for a trigger first: " + missing.join(", ") + " not found."
        : "No trigger found: a true relapse is possible if symptoms are new, last over 24 h and are at least 30 days after the last relapse."
    };
  }

  /* ---------- bladder scan / post-void residual (mL) ---------- */
  function bladder(ml) {
    if (ml == null || isNaN(ml)) return null;
    if (ml >= 500) return { lvl: "urgent", text: `Bladder ${ml} mL: retention. Catheterize; with back pain or leg symptoms, this is cord/cauda equina until MRI says otherwise.` };
    if (ml > 200) return { lvl: "action", text: `Post-void residual ${ml} mL (over 200): abnormal. Ask about saddle numbness; check anal tone and perianal sensation.` };
    return { lvl: "ok", text: `Post-void residual ${ml} mL.` };
  }

  /* ---------- GCS trend (subdural) ---------- */
  function gcsTrend(rows) {
    const r = (rows || []).filter((x) => x.v != null).sort((a, b) => a.t - b.t);
    if (!r.length) return null;
    const cur = r[r.length - 1].v, best = Math.max(...r.map((x) => x.v)), drop = best - cur;
    return { cur, best, drop, lvl: drop >= 2 || cur <= 8 ? "urgent" : drop === 1 ? "action" : "ok",
      text: drop >= 2 ? `GCS fell ${drop} points (${best} → ${cur}): urgent repeat CT head and neurosurgery.` : cur <= 8 ? `GCS ${cur}: protect the airway.` : drop === 1 ? `GCS down 1 point (${best} → ${cur}): recheck within the hour.` : `GCS ${cur}, stable.` };
  }

  /* ---------- vertigo: HINTS+ ---------- */
  function hints(f) {
    if (!f.vConstant && !f.vertigo) return null;
    if (f.vPositional && !f.vConstant) return { lvl: "ok", text: f.dixPos ? "Brief positional vertigo with a positive Dix-Hallpike: BPPV. Treat with the Epley manoeuvre." : "Brief positional vertigo: do the Dix-Hallpike (or supine roll test). HINTS is only for constant vertigo with nystagmus." };
    if (!f.vConstant) return { lvl: "info", text: "Tick whether the vertigo is brief and positional, or constant with nystagmus." };
    const central = ["hitNormal", "nysCentral", "skew", "hearing", "cantWalk"].filter((k) => f[k]).map((k) => LABEL[k]);
    return central.length
      ? { lvl: "urgent", text: "Central features: " + central.join("; ") + ". Treat as posterior circulation stroke: MRI with DWI (CTA head and neck), stroke team. A negative CT does not rule it out." }
      : { lvl: "ok", text: "Constant vertigo with an ABNORMAL head impulse, one-direction horizontal nystagmus, no skew, normal hearing and able to walk: peripheral (vestibular neuritis) is likely. Only reliable if HINTS was done by a confident examiner." };
  }

  const api = { FINDINGS, LABEL, DX, rank, breathing, mgCheck, MG_DRUGS, antithrombotics, pseudoRelapse, bladder, gcsTrend, hints };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.NeuroRules = api;
})(typeof window !== "undefined" ? window : globalThis);
