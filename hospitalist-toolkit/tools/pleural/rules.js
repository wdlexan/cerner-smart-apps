/* Pleural effusion: pure decision rules. No chart access here, so it can be tested with node.
   UNVERIFIED DRAFT written by Claude from: BTS Guideline for Pleural Disease 2023 (Roberts et al., Thorax 2023); Light's criteria (Light 1972);
   ERS/EACTS malignant pleural effusion statement 2018 and ATS/STS/STR 2018 MPE guideline; MIST2 (Rahman, NEJM 2011);
   RAPID score (Rahman, Chest 2014; Corcoran 2020 validation); LENT score (Clopton, Thorax 2014); AASLD 2021 hepatic hydrothorax guidance;
   pleural NT-proBNP (Porcel 2009); ADA in TB pleuritis (Aggarwal meta-analysis 2019). Units are SI as used at Island Health.
   Check with respirology / thoracic surgery before real use. */
(function () {
  const r0 = (v) => Math.round(v), r1 = (v) => Math.round(v * 10) / 10, r2 = (v) => Math.round(v * 100) / 100;
  const isNum = (v) => typeof v === "number" && isFinite(v);

  /* ---------- Light's criteria + pseudo-exudate check ---------- */
  // o: pProt, sProt (g/L), pLDH, sLDH, ldhULN (U/L), pAlb, sAlb (g/L), pBNP (ng/L), onDiuretic
  function lights(o) {
    const crit = [], miss = [];
    if (isNum(o.pProt) && isNum(o.sProt)) crit.push({ t: "Pleural/serum protein over 0.5", v: r2(o.pProt / o.sProt), met: o.pProt / o.sProt > 0.5 }); else miss.push("pleural and serum protein");
    if (isNum(o.pLDH) && isNum(o.sLDH)) crit.push({ t: "Pleural/serum LDH over 0.6", v: r2(o.pLDH / o.sLDH), met: o.pLDH / o.sLDH > 0.6 }); else miss.push("pleural and serum LDH");
    const uln = o.ldhULN || 250;
    if (isNum(o.pLDH)) crit.push({ t: `Pleural LDH over 2/3 of the serum upper limit (${r0(uln * 2 / 3)} U/L)`, v: o.pLDH, met: o.pLDH > (uln * 2) / 3 });
    const any = crit.some((c) => c.met);
    let kind = !crit.length ? "unknown" : any ? "exudate" : crit.length === 3 ? "transudate" : "transudate?";
    const notes = [];
    // pseudo-exudate (diuresed heart failure): Light's misclassifies about 25% of HF transudates as exudates
    let pseudo = false;
    if (kind === "exudate") {
      const marginal = crit.filter((c) => c.met).length === 1 || (o.pProt && o.sProt && o.pProt / o.sProt <= 0.65);
      // gradients only re-classify when heart failure / diuretics make a pseudo-exudate plausible
      const hfCtx = !!(o.onDiuretic || o.hf);
      const ag = isNum(o.pAlb) && isNum(o.sAlb) && o.sAlb - o.pAlb > 12, pg = isNum(o.pProt) && isNum(o.sProt) && o.sProt - o.pProt > 31;
      if (ag) notes.push(`Serum-pleural albumin gradient ${r0(o.sAlb - o.pAlb)} g/L (over 12)${hfCtx ? ": behaves like a transudate" : ": would suggest a transudate if heart failure is possible"}`);
      if (pg) notes.push(`Serum-pleural protein gradient ${r0(o.sProt - o.pProt)} g/L (over 31)${hfCtx ? ": behaves like a transudate" : ": would suggest a transudate if heart failure is possible"}`);
      if (hfCtx && (ag || pg)) pseudo = true;
      if (isNum(o.pBNP) && o.pBNP > 1500) { pseudo = true; notes.push(`Pleural NT-proBNP ${r0(o.pBNP)} ng/L (over 1500): heart failure`); }
      if (pseudo) kind = "pseudo";
      else if (o.onDiuretic && marginal) notes.push("On a diuretic and only just an exudate: check the albumin gradient (serum minus pleural albumin) or pleural NT-proBNP");
    }
    const label = { exudate: "Exudate", transudate: "Transudate", "transudate?": "Probably transudate (incomplete)", pseudo: "Transudate misclassified as exudate (diuresed heart failure?)", unknown: "Not enough results" }[kind];
    return { kind, label, crit, miss, notes };
  }

  /* ---------- the rest of the fluid ---------- */
  // o adds: pGlu (mmol/L), pH, pTG, pChol (mmol/L), pHct, bHct (fraction or %), pCr, sCr, pAmy, sAmy, ada, neutPct, lymphPct, eosPct,
  //         appearance ('serous'|'turbid'|'pus'|'milky'|'bloody'), gram ('pos'|'neg'), culture ('pos'|'neg'), cytology ('pos'|'neg'|'atypical'), loculated, ldhULN
  function fluid(o) {
    const F = [], add = (id, tone, text, why) => F.push({ id, tone, text, why });
    const L = lights(o);
    const frac = (v) => (isNum(v) ? (v > 1.5 ? v / 100 : v) : null);
    if (o.appearance === "pus") add("empyema", "urgent", "Frank pus: empyema", "Drain now (chest tube) plus antibiotics. pH is not needed.");
    if (o.gram === "pos" || o.culture === "pos") add("infected", "urgent", "Organisms on Gram stain or culture", "Infected pleural space: chest tube drainage.");
    if (isNum(o.pH)) {
      if (o.pH < 7.2) add("lowpH", o.appearance === "pus" ? "info" : "urgent", `pH ${o.pH} (under 7.2)`, "Parapneumonic: complicated, drain with a chest tube. Also: malignancy (poorer pleurodesis success and survival), TB, RA, esophageal rupture, urinothorax.");
      else if (o.pH < 7.4) add("midpH", "action", `pH ${o.pH} (7.2-7.4)`, "Parapneumonic: consider drainage if LDH over 900 U/L, loculated, large, or not improving on antibiotics (BTS 2023).");
    }
    if (isNum(o.pGlu)) {
      if (o.pGlu < 1.6) add("vlowGlu", "action", `Glucose ${o.pGlu} mmol/L (very low)`, "Empyema, rheumatoid pleurisy (often under 1.6), esophageal rupture.");
      else if (o.pGlu < 3.3) add("lowGlu", "action", `Glucose ${o.pGlu} mmol/L (under 3.3)`, "Complicated parapneumonic/empyema (drain if pH not available), TB, malignancy, RA, lupus.");
    }
    if (isNum(o.pLDH) && o.pLDH > 1000) add("highLDH", "action", `Pleural LDH ${r0(o.pLDH)} U/L (over 1000)`, "Intense inflammation: empyema, complicated parapneumonic, rheumatoid, malignancy.");
    if (isNum(o.pTG)) {
      if (o.pTG > 1.24) add("chylo", "action", `Triglycerides ${o.pTG} mmol/L (over 1.24)`, "Chylothorax: thoracic duct leak (lymphoma, surgery, trauma, LAM, cirrhosis). CT chest/abdomen; low-fat/MCT diet or NPO + TPN; octreotide; lymphangiography/embolization or surgery if high output.");
      else if (o.pTG >= 0.56 && o.appearance === "milky") add("chyloMaybe", "info", `Triglycerides ${o.pTG} mmol/L (0.56-1.24) and milky`, "Indeterminate: send lipoprotein electrophoresis (chylomicrons confirm chylothorax).");
    }
    if (isNum(o.pChol) && o.pChol > 5.18 && !(isNum(o.pTG) && o.pTG > 1.24)) add("pseudochylo", "info", `Cholesterol ${o.pChol} mmol/L (over 5.18)`, "Pseudochylothorax (cholesterol effusion): long-standing effusion with a thick pleura (old TB, rheumatoid). Cholesterol crystals.");
    const ph = frac(o.pHct), bh = frac(o.bHct);
    if (ph != null && bh) {
      const r = r2(ph / bh);
      if (r >= 0.5) add("hemothorax", "urgent", `Pleural/blood hematocrit ${r} (0.5 or more)`, "Hemothorax: large-bore tube (or 14 F if stable, per local practice); thoracic surgery if 1.5 L at insertion or over 200 mL/h for 2-4 h, or unstable.");
      else if (ph > 0.01) add("bloody", "info", `Pleural hematocrit ${r1(ph * 100)}% (ratio ${r})`, "Blood-stained, not hemothorax: malignancy, PE, trauma, post-cardiac injury, asbestos.");
    }
    if (isNum(o.pCr) && isNum(o.sCr) && o.pCr / o.sCr > 1) add("urino", "action", `Pleural/serum creatinine ${r2(o.pCr / o.sCr)} (over 1)`, "Urinothorax (obstructed or injured urinary tract): usually a low-pH transudate. Relieve the obstruction.");
    if (isNum(o.pAmy) && ((isNum(o.sAmy) && o.pAmy / o.sAmy > 1) || o.pAmy > 300)) add("amylase", "action", `Amylase ${r0(o.pAmy)} U/L`, "Pancreatitis/pancreatic pseudocyst fistula, esophageal rupture (salivary amylase, low pH, food particles), malignancy.");
    if (isNum(o.ada)) {
      const lymphy = isNum(o.lymphPct) && o.lymphPct >= 50;
      if (o.ada > 40) add("tb", lymphy ? "action" : "info", `ADA ${o.ada} U/L (over 40)${lymphy ? " with lymphocytes " + o.lymphPct + "%" : ""}`, lymphy ? "TB pleuritis likely (high ADA + lymphocytic exudate, especially in a high-TB-risk patient). Pleural biopsy for culture/histology; airborne precautions until lung TB excluded. Also empyema, lymphoma, RA give high ADA." : "High ADA without lymphocytes: empyema, RA, lymphoma also raise ADA.");
      else if (o.ada < 35 && lymphy) add("tbLow", "info", `ADA ${o.ada} U/L`, "Low ADA makes TB unlikely in a lymphocytic effusion (high negative predictive value in high-prevalence areas, less so in Canada).");
    }
    if (isNum(o.eosPct) && o.eosPct >= 10) add("eos", "info", `Eosinophils ${o.eosPct}% (10% or more)`, "Air or blood in the pleura (repeat taps, pneumothorax, trauma), drugs (nitrofurantoin, dantrolene, valproate, amiodarone), parasites, EGPA, benign asbestos effusion, malignancy.");
    if (isNum(o.lymphPct) && o.lymphPct >= 50 && !F.some((f) => f.id === "tb")) add("lymph", "info", `Lymphocytes ${o.lymphPct}% (50% or more)`, "Malignancy (incl. lymphoma), TB, heart failure on diuretics, post-CABG, rheumatoid, chylothorax, yellow nail syndrome.");
    if (isNum(o.neutPct) && o.neutPct >= 50) add("neut", "info", `Neutrophils ${o.neutPct}%`, "Acute process: parapneumonic, PE, pancreatitis, early TB.");
    if (o.cytology === "pos") add("malignant", "urgent", "Cytology positive for malignancy", "Malignant pleural effusion (stage IV): oncology; plan for recurrence (IPC vs talc) by lung re-expansion and prognosis (LENT).");
    else if (o.cytology === "atypical") add("atypical", "action", "Cytology atypical/suspicious", "Repeat cytology once; if still unclear and malignancy likely: CT-guided or thoracoscopic pleural biopsy.");
    else if (o.cytology === "neg" && L.kind === "exudate" && !F.some((f) => ["empyema", "infected", "lowpH", "hemothorax", "chylo", "tb"].includes(f.id))) add("cytoNeg", "info", "Cytology negative in an unexplained exudate", "One sample finds about 60% of malignant effusions (lower for mesothelioma). A second sample adds little; if still unexplained: contrast CT, then pleural biopsy (image-guided or thoracoscopy).");
    if (o.loculated) add("loculated", "action", "Loculated / septated on imaging", "Parapneumonic: a reason to drain. May need intrapleural tPA + DNase or surgery (VATS).");
    return { light: L, findings: F };
  }

  /* ---------- parapneumonic category and chest tube need ---------- */
  function parapneumonic(o, F) {
    const ids = new Set((F || []).map((f) => f.id));
    if (ids.has("empyema")) return { cat: "empyema", label: "Empyema", drain: true, text: "Chest tube (12-14 F small-bore with regular saline flushes) plus antibiotics. Early thoracic surgery referral if sepsis persists after 5-7 days of drainage + antibiotics or tube fails." };
    if (ids.has("infected") || ids.has("lowpH") || (!isNum(o.pH) && ids.has("lowGlu"))) return { cat: "complicated", label: "Complicated parapneumonic effusion", drain: true, text: "Chest tube drainage plus antibiotics. If loculated or poorly draining after 24-48 h: intrapleural tPA 10 mg + DNase 5 mg twice daily for 3 days (MIST2) or surgery." };
    if (ids.has("midpH") && (ids.has("highLDH") || ids.has("loculated") || o.large)) return { cat: "borderline", label: "Borderline parapneumonic (pH 7.2-7.4 with high LDH, loculation or large)", drain: true, text: "BTS 2023: consider chest tube drainage. Otherwise antibiotics and repeat ultrasound/tap in 24-48 h if not improving." };
    if (isNum(o.pH) || o.appearance) return { cat: "simple", label: "Simple parapneumonic effusion", drain: false, text: "Antibiotics alone. Re-image (ultrasound) and re-tap if fever persists or the effusion grows." };
    return { cat: "unknown", label: "Parapneumonic: needs a diagnostic tap", drain: null, text: "Any parapneumonic effusion over 10 mm deep on ultrasound (or with fever not settling) needs a diagnostic tap with pH (blood gas analyser)." };
  }

  /* ---------- RAPID (pleural infection 3-month mortality) ---------- */
  // urea mmol/L, age, purulent bool, hospitalAcquired bool, albumin g/L
  function rapid(o) {
    const items = [], miss = [];
    const it = (n, p, v) => items.push([n + (v != null ? ` (${v})` : ""), p]);
    if (!isNum(o.urea)) miss.push("urea"); else it("Renal: urea", o.urea > 8 ? 2 : o.urea >= 5 ? 1 : 0, o.urea + " mmol/L");
    if (!isNum(o.age)) miss.push("age"); else it("Age", o.age > 70 ? 2 : o.age >= 50 ? 1 : 0, o.age);
    it("Purulence of fluid", o.purulent ? 0 : 1, o.purulent ? "purulent" : "not purulent");
    it("Infection source", o.hospitalAcquired ? 1 : 0, o.hospitalAcquired ? "hospital" : "community");
    if (!isNum(o.albumin)) miss.push("albumin"); else it("Dietary: albumin", o.albumin < 27 ? 1 : 0, o.albumin + " g/L");
    const score = items.reduce((a, i) => a + i[1], 0);
    const band = score <= 2 ? "low" : score <= 4 ? "medium" : "high";
    return { score, items, miss, band, text: `RAPID ${score}${miss.length ? " (partial)" : ""}: ${band} risk. 3-month mortality in MIST1/MIST2 cohorts roughly: low about 1-5%, medium about 10-20%, high about 30-50%. High score: think about earlier surgical opinion and nutrition; it does not by itself decide surgery.` };
  }

  /* ---------- LENT (malignant effusion survival) ---------- */
  // pLDH U/L, ecog 0-4, nlr, tumour: 'low' (mesothelioma, hematologic), 'mod' (breast, gynecologic, renal), 'high' (lung, other)
  function lent(o) {
    const items = [], miss = [];
    if (!isNum(o.pLDH)) miss.push("pleural LDH"); else items.push([`Pleural LDH (${r0(o.pLDH)} U/L)`, o.pLDH > 1500 ? 1 : 0]);
    if (!isNum(o.ecog)) miss.push("ECOG"); else items.push([`ECOG ${o.ecog}`, o.ecog >= 3 ? 3 : o.ecog]);
    if (!isNum(o.nlr)) miss.push("NLR"); else items.push([`Neutrophil:lymphocyte ratio (${r1(o.nlr)})`, o.nlr > 9 ? 1 : 0]);
    if (!o.tumour) miss.push("tumour type"); else items.push([`Tumour type (${{ low: "mesothelioma / blood cancer", mod: "breast, gynecologic, kidney", high: "lung / other" }[o.tumour]})`, { low: 0, mod: 1, high: 2 }[o.tumour]]);
    const score = items.reduce((a, i) => a + i[1], 0);
    const band = score <= 1 ? "low" : score <= 4 ? "moderate" : "high";
    const med = { low: "about 319 days", moderate: "about 130 days", high: "about 44 days" }[band];
    return { score, items, miss, band, text: `LENT ${score}${miss.length ? " (partial: missing " + miss.join(", ") + ")" : ""}: ${band} risk, median survival ${med} in the derivation cohort (Clopton 2014).` };
  }

  /* ---------- malignant effusion plan ---------- */
  // o: symptomaticRelief (breathless better after tap), reexpand ('yes'|'no'|'unknown'), lentBand, recurrence bool
  function mpePlan(o) {
    const L = [];
    if (o.relief === false) L.push("Breathlessness did not improve after drainage: look for another cause (lymphangitis, PE, tumour, trapped lung) before a definitive procedure.");
    if (o.reexpand === "no") L.push("<b>Non-expandable (trapped) lung:</b> indwelling pleural catheter (IPC). Talc pleurodesis usually fails.");
    else if (o.lentBand === "high") L.push("<b>Short prognosis (LENT high):</b> IPC or repeat therapeutic taps; avoid long admissions. Palliative care.");
    else L.push("<b>Expandable lung, reasonable prognosis:</b> patient choice between IPC (shorter stay, outpatient, AMPLE/TIME2) and talc pleurodesis (slurry via chest tube or thoracoscopic poudrage). IPC + talc via the catheter (IPC-PLUS) raises pleurodesis rates.");
    L.push("First recurrence is common (most within 30 days). Plan the definitive procedure early rather than repeated taps if prognosis is longer than a few weeks.");
    L.push("Treat the cancer: chemo/targeted therapy can control effusions in breast, lymphoma, small-cell lung, ovarian, EGFR/ALK lung cancer.");
    return L;
  }

  /* ---------- chest tube choice ---------- */
  // purpose: 'parapneumonic'|'empyema'|'malignant'|'hemothorax'|'pneumothorax'|'transudate'|'hepatic'|'chylo'
  function tubeChoice(purpose, o) {
    o = o || {};
    const T = {
      empyema: { pick: "Small-bore 12-14 F (Seldinger, ultrasound-guided)", why: "BTS 2023: as effective as large-bore for pleural infection and less painful. Flush with 20-30 mL saline every 6-8 h.", alt: "Large-bore 24-28 F if the small tube blocks repeatedly with thick pus, or surgical drainage (VATS)." },
      parapneumonic: { pick: "Small-bore 12-14 F (Seldinger, ultrasound-guided)", why: "Same as empyema: drain when pH under 7.2, pus, organisms, or loculated.", alt: "" },
      malignant: { pick: "Therapeutic tap first; then IPC or talc pleurodesis (via 12-14 F tube or thoracoscopy)", why: "A chest tube is only needed for talc slurry pleurodesis.", alt: "IPC (tunnelled, 15.5 F) for trapped lung, failed pleurodesis or patient preference." },
      hemothorax: { pick: "Large-bore 24-28 F (surgical insertion) for traumatic hemothorax", why: "Clots block small tubes; allows measuring blood loss. Some centres use 14 F pigtails for stable, non-massive hemothorax.", alt: "Thoracic surgery: 1.5 L at insertion, over 200 mL/h for 2-4 h, unstable, or retained hemothorax (VATS within 3-7 days)." },
      pneumothorax: { pick: "Small-bore 8-14 F (or aspiration / ambulatory device if suitable)", why: "BTS 2023: conservative care for minimally symptomatic primary pneumothorax; small-bore drain if intervention needed.", alt: "Large-bore for ventilated patients with big air leaks or hemopneumothorax." },
      transudate: { pick: "Usually no chest tube: treat the cause; therapeutic tap if breathless", why: "Tubes in transudates drain litres and cause protein/fluid loss and kidney injury.", alt: "IPC for refractory symptomatic transudates (heart failure, kidney) after specialist review." },
      hepatic: { pick: "AVOID a chest tube", why: "Hepatic hydrothorax: tubes cause massive protein/fluid loss, kidney failure, infection and high mortality. Diuretics and sodium restriction, therapeutic taps, TIPS, transplant referral.", alt: "IPC only in selected non-transplant patients after hepatology input." },
      chylo: { pick: "Small-bore tube to measure output (if large)", why: "Output guides treatment: high output (over 1 L/day) after surgery favours early duct ligation/embolization.", alt: "" } };
    return T[purpose] || T.parapneumonic;
  }

  /* ---------- chest tube troubleshooting ---------- */
  const TROUBLE = {
    notDraining: { t: "Not draining / output stopped", urgent: false, steps: ["Check the whole circuit: kinks, clamps, three-way tap direction, the tube taped in a loop, the drainage bottle below the chest.",
      "Is it swinging with breathing? No swing = blocked or out of the pleural space.", "Flush the small-bore tube with 20-30 mL sterile saline (away from the patient's side via the three-way tap; flush toward the patient).",
      "Chest X-ray: position (inside the chest? kinked? in the fissure?) and whether fluid remains.", "Ultrasound/CT if fluid remains: loculations. Pleural infection: intrapleural tPA 10 mg + DNase 5 mg BID for 3 days (MIST2), or a second tube into the residual collection, or thoracic surgery.",
      "If the lung is fully expanded and no fluid remains: the tube is simply done. Consider removal."] },
    airLeak: { t: "Bubbling (air leak)", urgent: false, steps: ["Bubbling with expiration or cough = air leak from the lung (or a hole near the skin). Continuous bubbling with the patient breathing quietly = big leak OR a leak in the circuit.",
      "Check connections and look for a side hole outside the skin (CXR). Briefly clamp at the skin (seconds): bubbling stops = leak is in the patient; continues = leak in the tubing/bottle.",
      "NEVER clamp a bubbling tube for longer: risk of tension pneumothorax.", "Suction (-10 to -20 cmH2O) only if the lung does not re-expand; high-volume low-pressure.",
      "Persistent air leak over 3-5 days: thoracic surgery opinion (VATS, blood patch, endobronchial valves)."] },
    subcut: { t: "Subcutaneous (surgical) emphysema", urgent: false, steps: ["Usually harmless but frightening. Mark the edge on the skin to follow it.",
      "Look for a cause: blocked or kinked tube, a side hole outside the chest, tube pulled back, too small a tube for a big air leak.",
      "CXR; flush/unkink; suction or a larger/second tube if a large leak is not being drained.", "Urgent senior / thoracic help if voice change, stridor, swelling of face and neck closing the eyes, or breathing difficulty."] },
    rpe: { t: "Re-expansion pulmonary edema (cough, breathless, hypoxic during/after drainage)", urgent: true, steps: ["Clamp the drain / stop the tap. Oxygen; sit up.",
      "Supportive: high-flow oxygen or CPAP/NIV if needed; usually settles in 24-48 h. Diuretics are not clearly helpful.",
      "Prevent: drain no more than about 1.5 L at a time (clamp the tube for 1 h after 1-1.5 L), stop if chest tightness or cough. Highest risk: large effusion present for days, young patient, lung collapsed."] },
    bleeding: { t: "Blood in the drain", urgent: true, steps: ["Measure: pleural fluid hematocrit (half of blood or more = hemothorax). Check Hb, platelets, INR/aPTT, anticoagulants.",
      "Intercostal artery injury: insertion too close to the lower rib edge, or a posterior/medial site. Can bleed briskly.",
      "Thoracic surgery NOW if: 1.5 L at insertion, over 200 mL/h for 2-4 h, unstable, or rising Hb loss.", "Reverse anticoagulation, transfuse, keep the tube open (do not clamp to tamponade), CT angiography / IR embolization of the intercostal artery."] },
    dislodged: { t: "Tube fell out or pulled back", urgent: false, steps: ["Cover the hole with an occlusive dressing at once (vaseline gauze). Do not push the tube back in.",
      "Assess breathing and SpO2; CXR now.", "Re-insert a new tube at a new site only if still needed (fluid/air remains and the indication continues).", "Tube pulled back with side holes outside the chest: replace it (do not advance a non-sterile tube)."] },
    pain: { t: "Pain", urgent: false, steps: ["Regular acetaminophen plus an NSAID if safe, short-acting opioid PRN.", "Small-bore tubes hurt less. Persistent severe pain: CXR for tube position (tip against apex/mediastinum), consider pulling back slightly (sterile), or intercostal / serratus anterior block."] },
    infection: { t: "Site infection or new empyema", urgent: false, steps: ["Redness, pus at the site: swab, cellulitis cover (cefazolin or cloxacillin).",
      "New fever with a tube in place: pleural fluid culture through a fresh sample, consider tube-related empyema, change the tube if long in place."] },
    malposition: { t: "Wrong position (fissure, lung, below the diaphragm, chest wall)", urgent: false, steps: ["CT if suspected (CXR can miss it).", "Intra-parenchymal: discuss with thoracic surgery before removal (air leak/bleeding).",
      "Abdominal (liver/spleen): leave in place, call general/thoracic surgery urgently.", "In the fissure or chest wall: usually replace if not draining."] },
    vasovagal: { t: "Faint / vasovagal during insertion or tap", urgent: false, steps: ["Stop, lie flat, legs up; atropine 0.5 mg IV if bradycardic and hypotensive.", "Exclude pneumothorax and bleeding."] },
    highOutput: { t: "Very high output (over 1 L/day after initial drainage)", urgent: false, steps: ["Transudate drainage (heart failure, cirrhosis, kidney): fluid and protein loss, AKI, low Na. Treat the cause; consider removal.",
      "Chylothorax: measure daily output; NPO/TPN or MCT diet; octreotide; over 1 L/day for 5 days: thoracic duct embolization/ligation.", "Watch creatinine, sodium, albumin; replace losses."] } };

  /* ---------- removal ---------- */
  // o: purpose, out24 (mL), bubbling, lungExpanded, sepsisSettled, swings, daysIn, talcHours, fluidLeft
  function removal(o) {
    const yes = [], no = [], how = [];
    const p = o.purpose || "effusion";
    if (o.bubbling) no.push("Still bubbling: air leak. Never remove (or clamp) a bubbling tube.");
    if (o.lungExpanded === false) no.push("Lung not re-expanded on the latest image (or trapped lung: then consider IPC instead of waiting).");
    if (isNum(o.out24)) {
      const lim = p === "pleurodesis" ? 250 : p === "hemothorax" ? 150 : 200;
      if (o.out24 <= lim) yes.push(`Output ${o.out24} mL in 24 h (${lim} mL or less)`); else no.push(`Output ${o.out24} mL in 24 h (over ${lim} mL)`);
    } else no.push("Enter the 24 h drain output");
    if (p === "empyema" || p === "parapneumonic") {
      if (o.sepsisSettled) yes.push("Sepsis settling (fever, WBC, CRP falling)"); else no.push("Infection not yet settling: keep the tube, re-image for residual collection, consider tPA/DNase or surgery.");
      if (o.fluidLeft) no.push("Residual collection on ultrasound/CT: drain it before removal.");
      how.push("Pleural infection: usually remove when output is low, sepsis has settled and imaging shows the space is drained (often 5-7 days). The output of a flushed tube includes the flush volume: subtract it.");
    }
    if (p === "pneumothorax") {
      if (!o.bubbling && o.lungExpanded) yes.push("No bubbling and lung up");
      how.push("Pneumothorax: remove once bubbling has stopped for 24 h (with coughing) and the lung is up. Clamping trials are not routinely needed (BTS); if used, clamp 4-6 h then CXR.");
    }
    if (p === "pleurodesis") how.push("After talc slurry: unclamp after 1-2 h; remove within 24-72 h when output is under 250 mL/day and the lung is up (BTS 2023: early removal at 24-48 h is fine).");
    if (p === "hemothorax") how.push("Hemothorax: remove when output is serous and under about 150 mL/day; CT if a retained clot is suspected (VATS within a week).");
    if (p === "effusion") how.push("Simple drainage of an effusion: remove when output is under 150-200 mL/day and the lung is up. With malignancy, plan pleurodesis or IPC before the tube comes out.");
    if (isNum(o.daysIn) && o.daysIn > 10) no.push(`In for ${o.daysIn} days: infection risk rising; if it is no longer doing anything, take it out.`);
    how.push("Technique: cut the suture, ask for a breath-hold at end-expiration (or Valsalva), pull smoothly, occlusive dressing; tie a purse-string if a large-bore tube had one. A routine CXR after removing a small-bore effusion drain is not required unless symptoms; do one after pneumothorax drains.");
    const ready = no.length === 0 && yes.length > 0;
    return { ready, yes, no, how, label: ready ? "Ready to remove" : "Not yet" };
  }

  /* ---------- causes reference ---------- */
  const CAUSES = [
    { cat: "Transudate", name: "Heart failure", clue: "Bilateral (R bigger than L), cardiomegaly, high NT-proBNP; pleural NT-proBNP over 1500", tx: "Diuretics; tap only if atypical (unilateral, left bigger, fever, pleuritic pain) or not resolving after 3 days of diuresis." },
    { cat: "Transudate", name: "Hepatic hydrothorax", clue: "Cirrhosis with ascites, usually right-sided; SAAG-like transudate", tx: "Sodium restriction, diuretics, therapeutic taps, TIPS, transplant. NO chest tube. Spontaneous bacterial empyema: PMN over 250 + culture positive (or over 500): antibiotics like SBP." },
    { cat: "Transudate", name: "Nephrotic syndrome / hypoalbuminemia", clue: "Bilateral, low albumin, proteinuria", tx: "Treat the cause; also screen for PE (nephrotic is prothrombotic)." },
    { cat: "Transudate", name: "Peritoneal dialysis", clue: "Right-sided, very high glucose in fluid", tx: "Stop PD temporarily; surgical repair of diaphragm defect." },
    { cat: "Transudate", name: "Atelectasis / trapped lung", clue: "Small, mediastinal shift toward the effusion, negative pleural pressure", tx: "Treat atelectasis; trapped lung: IPC if symptomatic." },
    { cat: "Transudate", name: "Urinothorax", clue: "Urinary obstruction or injury; pleural/serum creatinine over 1, low pH", tx: "Relieve the obstruction." },
    { cat: "Exudate", name: "Parapneumonic effusion / empyema", clue: "Pneumonia, fever, neutrophilic, pH and glucose low", tx: "Antibiotics; drain if pH under 7.2, pus, organisms, loculated. See Empyema section." },
    { cat: "Exudate", name: "Malignant effusion (lung, breast, lymphoma, ovary, GI, mesothelioma)", clue: "Large or recurrent, lymphocytic, bloody, weight loss, pleural nodularity on CT", tx: "Cytology (60%), then biopsy; IPC or talc; LENT for prognosis." },
    { cat: "Exudate", name: "Pulmonary embolism", clue: "Pleuritic pain, often small and bloody; can be transudate", tx: "CTPA; anticoagulate (a bloody effusion is not a contraindication)." },
    { cat: "Exudate", name: "Tuberculous pleuritis", clue: "Lymphocytic exudate, ADA over 40, few mesothelial cells, TB risk", tx: "Pleural biopsy (culture + histology, about 80-90% yield); standard 6-month TB therapy; public health." },
    { cat: "Exudate", name: "Rheumatoid / lupus pleuritis", clue: "Very low glucose (RA), low pH, high LDH; lupus: ANA in fluid", tx: "Treat the disease; exclude infection; steroids for lupus." },
    { cat: "Exudate", name: "Post-cardiac injury (post-CABG, Dressler, post-MI, post-ablation)", clue: "Left-sided after cardiac surgery; bloody early, lymphocytic late", tx: "NSAIDs/colchicine; tap if large." },
    { cat: "Exudate", name: "Pancreatitis / pancreatic fistula", clue: "Left-sided, high amylase", tx: "Treat pancreatitis; fistula: ERCP stent/surgery." },
    { cat: "Exudate", name: "Esophageal rupture", clue: "Vomiting, chest pain, high salivary amylase, pH under 7, food particles", tx: "EMERGENCY: NPO, broad antibiotics + antifungal, thoracic surgery." },
    { cat: "Exudate", name: "Drug-induced", clue: "Amiodarone, methotrexate, nitrofurantoin, dasatinib, bromocriptine/cabergoline, ergots, phenytoin, hydralazine/procainamide (lupus), checkpoint inhibitors", tx: "Stop the drug." },
    { cat: "Exudate", name: "Benign asbestos pleural effusion", clue: "Asbestos exposure 10-30 years ago, often eosinophilic", tx: "Diagnosis of exclusion; follow for mesothelioma." },
    { cat: "Exudate", name: "Chylothorax", clue: "Milky; triglycerides over 1.24 mmol/L; lymphoma, surgery, trauma", tx: "See fluid findings: diet, octreotide, embolization/ligation." },
    { cat: "Exudate", name: "Hemothorax", clue: "Trauma, anticoagulation, procedure; pleural/blood Hct 0.5 or more", tx: "Large-bore tube; surgery criteria." },
    { cat: "Exudate", name: "Others: Meigs (ovarian mass), uremic pleuritis, yellow nail syndrome, radiation, sarcoidosis, OHSS", clue: "", tx: "" }];

  /* ---------- imaging report scan ---------- */
  function imaging(text) {
    // drop negated phrases first ("no septations", "without loculation", "no pleural nodularity", "no pneumothorax")
    const t = (text || "").toLowerCase().replace(/\b(no|without|not|negative for|free of)\b[^.,;]*/g, " "), f = [];
    const add = (id, label) => f.push({ id, label });
    if (/massive|very large|white.?out|complete opacif/.test(t)) add("massive", "Massive / near-complete opacification");
    else if (/large (left |right |bilateral )?(pleural )?effusion/.test(t)) add("large", "Large effusion");
    else if (/moderate (left |right |bilateral )?(pleural )?effusion/.test(t)) add("moderate", "Moderate effusion");
    else if (/small (left |right |bilateral )?(pleural )?effusion|trace|blunting/.test(t)) add("small", "Small effusion / blunting");
    if (/bilateral/.test(t) && /effusion/.test(t)) add("bilateral", "Bilateral");
    if (/locul|septat|complex|echogenic|multiloc/.test(t)) add("loculated", "Loculated / septated / complex");
    if (/split pleura/.test(t)) add("split", "Split pleura sign (empyema)");
    if (/nodular|pleural (mass|thickening) .*(\d+ ?(mm|cm))|circumferential|mediastinal pleura/.test(t)) add("malignantPleura", "Nodular/circumferential pleural thickening (malignancy?)");
    if (/shift (to|toward)s? the (left|right)|mediastinal shift away|contralateral shift/.test(t)) add("shift", "Mediastinal shift (check direction: away = large effusion; toward = collapse/trapped lung)");
    if (/pneumothorax/.test(t)) add("ptx", "Pneumothorax mentioned");
    if (/hydropneumothorax|air-?fluid level/.test(t)) add("hydroptx", "Air-fluid level (bronchopleural fistula, esophageal rupture, after a tap)");
    if (/consolidat|pneumonia/.test(t)) add("consol", "Consolidation");
    if (/mass|lesion suspicious|malignan/.test(t)) add("mass", "Mass / suspected malignancy");
    if (/cardiomegaly|enlarged cardiac/.test(t)) add("cardio", "Cardiomegaly");
    if (/ascites/.test(t)) add("ascites", "Ascites");
    if (/(tube|drain|catheter).*(in situ|in place|tip)/.test(t)) add("tube", "Drain in place");
    if (/re-?expan/.test(t)) add("reexp", "Lung re-expansion mentioned");
    if (/trapped|non-?expand|entrapped/.test(t)) add("trapped", "Trapped / non-expandable lung");
    return f;
  }

  const api = { lights, fluid, parapneumonic, rapid, lent, mpePlan, tubeChoice, TROUBLE, removal, CAUSES, imaging };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else window.PleuralRules = api;
})();
