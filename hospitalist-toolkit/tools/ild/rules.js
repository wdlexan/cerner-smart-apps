/* ILD tab: pure rules (no DOM, no FHIR). UNVERIFIED draft written by Claude from general knowledge
   (ATS/ERS/JRS/ALAT IPF and PPF guidelines, 2016 acute exacerbation definition, Pneumotox-type drug lists). Verify before clinical use.
   node hospitalist-toolkit/tests/test_ild.js checks them. */
(function () {
  const DAY = 864e5, H = 36e5;

  // ---- ILD and subtype from the problem list ----
  const ILD = /interstitial lung|\bild\b|pulmonary fibrosis|lung fibrosis|fibrotic lung|\bipf\b|usual interstitial|\buip\b|\bnsip\b|organi[sz]ing pneumonia|\bcop\b|\bboop\b|hypersensitivity pneumonitis|extrinsic allergic alveolitis|sarcoid|asbestosis|silicosis|pneumoconiosis|pneumonitis|J84|J67|D86|J6[0-5]|J70\.[2-4]/i;
  const NOT_ILD = /aspiration pneumonitis|J69|radiation pneumonitis.*resolved|family history/i;
  const SUB = [
    ["ipf", /idiopathic pulmonary fibrosis|\bipf\b|usual interstitial|\buip\b|J84\.112/i, "IPF / UIP"],
    ["hp", /hypersensitivity pneumonitis|extrinsic allergic|bird fancier|farmer'?s lung|J67/i, "Hypersensitivity pneumonitis"],
    ["op", /organi[sz]ing pneumonia|\bcop\b|\bboop\b|J84\.116/i, "Organizing pneumonia"],
    ["nsip", /\bnsip\b|non-?specific interstitial/i, "NSIP"],
    ["sarcoid", /sarcoid|D86/i, "Sarcoidosis"],
    ["occ", /asbestosis|silicosis|pneumoconiosis|coal worker|J6[0-5]/i, "Occupational (pneumoconiosis)"],
    ["drug", /drug[- ]induced|amiodarone|nitrofurantoin|methotrexate pneumonitis|J70\.[2-4]/i, "Drug-induced"],
    ["rad", /radiation pneumonitis|radiation fibrosis|J70\.[01]/i, "Radiation"],
    ["ctd", /rheumatoid.*(lung|ild|interstitial)|scleroderma.*(lung|ild)|systemic sclerosis.*(lung|ild)|(myositis|antisynthetase|anti-synthetase).*(lung|ild)|ctd-?ild|M05\.1|M34\.81/i, "CTD-ILD"]];
  const CTD = [
    ["ra", /rheumatoid arthritis|\bra\b|M05|M06/i, "Rheumatoid arthritis"],
    ["ssc", /systemic sclerosis|scleroderma|\bcrest\b|M34/i, "Systemic sclerosis"],
    ["myositis", /myositis|dermatomyositis|polymyositis|antisynthetase|anti-synthetase|M33/i, "Myositis / anti-synthetase"],
    ["sjogren", /sj[oö]gren|sicca|M35\.0/i, "Sjögren"],
    ["sle", /lupus|\bsle\b|M32/i, "Lupus"],
    ["mctd", /mixed connective|\bmctd\b|M35\.1/i, "MCTD"],
    ["vasc", /anca|vasculitis|granulomatosis with polyangiitis|microscopic polyangiitis|M31\.[37]/i, "ANCA vasculitis"]];

  function classify(probTexts) {
    const ild = (probTexts || []).filter((t) => ILD.test(t) && !NOT_ILD.test(t));
    const txt = ild.join(" | "), all = (probTexts || []).join(" | ");
    return {
      ild, has: ild.length > 0,
      sub: SUB.filter(([, re]) => re.test(txt)).map(([id, , name]) => ({ id, name })),
      ctd: CTD.filter(([, re]) => re.test(all)).map(([id, , name]) => ({ id, name })),
      fibrotic: /fibros|\bipf\b|\buip\b|honeycomb|asbestosis|silicosis|fibrotic|J84\.1/i.test(txt) };
  }

  // ---- CT report wording ----
  const CT = [
    ["honeycomb", /honeycomb/i, "honeycombing", "fib"], ["traction", /traction bronchiectasis|traction bronchiolectasis/i, "traction bronchiectasis", "fib"],
    ["uip", /\buip\b|usual interstitial/i, "UIP pattern", "fib"], ["reticul", /reticula/i, "reticulation", "fib"],
    ["fibrosis", /fibros|fibrotic/i, "fibrosis", "fib"], ["subpleural", /subpleural|basal predominan|lower lobe predominan/i, "subpleural/basal", "fib"],
    ["ggo", /ground[- ]?glass|\bggo\b/i, "ground glass", "acute"], ["consol", /consolidat/i, "consolidation", "acute"],
    ["op", /organi[sz]ing pneumonia|reversed halo|atoll/i, "organizing-pneumonia pattern", "acute"],
    ["mosaic", /mosaic|air[- ]trapping|centrilobular nodul/i, "mosaic / air trapping (HP?)", "hp"],
    ["crazy", /crazy[- ]paving/i, "crazy paving", "acute"], ["effusion", /pleural effusion/i, "pleural effusion", "other"],
    ["edema", /interstitial edema|pulmonary edema|septal thickening.*(edema|failure)|kerley/i, "edema / HF features", "other"],
    ["pe", /^(?!.*\bno\b.{0,30}(pulmonary embol|\bpe\b)).*(pulmonary embol|filling defect)/i, "pulmonary embolism", "other"],
    ["nope", /\bno\b.{0,30}(pulmonary embol|\bpe\b)/i, "no PE", "other"],
    ["ptx", /pneumothorax/i, "pneumothorax", "other"]];
  function ctFindings(text) { return CT.filter(([, re]) => re.test(text || "")).map(([id, , name, kind]) => ({ id, name, kind })); }

  // ---- drugs that cause pneumonitis / ILD, and ILD treatments ----
  const PNEUMOTOX = [
    { re: /amiodarone/i, name: "Amiodarone", note: "Pneumonitis or fibrosis (usually months, dose >200–400 mg/day, can occur after stopping – long half-life). Stop; steroids for moderate/severe.", strong: true },
    { re: /nitrofurantoin|macrobid|macrodantin/i, name: "Nitrofurantoin", note: "Acute (days: fever, eosinophilia) or chronic (long-term prophylaxis: fibrosis/NSIP). Stop; often improves.", strong: true },
    { re: /methotrexate/i, name: "Methotrexate", note: "Acute hypersensitivity pneumonitis (first year, cough, fever, hypoxia, eosinophils); also infection (PJP) when immunosuppressed. Stop and investigate.", strong: true },
    { re: /bleomycin|abvd/i, name: "Bleomycin", note: "Pneumonitis → fibrosis; high FiO2 worsens injury (target sats 88–92%).", strong: true },
    { re: /pembrolizumab|nivolumab|atezolizumab|durvalumab|cemiplimab|ipilimumab|avelumab|dostarlimab|tremelimumab|relatlimab/i, name: "Immune checkpoint inhibitor", note: "Immune pneumonitis (any time): hold, CT, exclude infection; prednisone 1–2 mg/kg for grade ≥2. Oncology toxicity tab.", strong: true },
    { re: /trastuzumab deruxtecan|enhertu|datopotamab/i, name: "Deruxtecan ADC (T-DXd / Dato-DXd)", note: "ILD can be fatal: stop at any suspicion; steroids grade ≥2.", strong: true },
    { re: /osimertinib|erlotinib|gefitinib|afatinib|amivantamab|crizotinib|brigatinib|capmatinib|tepotinib/i, name: "EGFR/ALK/MET TKI", note: "ILD/pneumonitis (brigatinib: first week). Hold, call oncology.", strong: true },
    { re: /everolimus|sirolimus|temsirolimus/i, name: "mTOR inhibitor", note: "Non-infectious pneumonitis (often mild, steroid-responsive); exclude infection.", strong: true },
    { re: /busulfan|carmustine|bcnu|cyclophosphamide|gemcitabine|docetaxel|oxaliplatin|brentuximab|idelalisib|duvelisib/i, name: "Chemotherapy agent", note: "Recognised pneumonitis cause (gemcitabine, busulfan, carmustine especially). Discuss with oncology.", strong: false },
    { re: /leflunomide|sulfasalazine|mesalamine|mesalazine|infliximab|adalimumab|etanercept|certolizumab|golimumab|rituximab|tocilizumab/i, name: "DMARD / biologic", note: "Uncommon pneumonitis or ILD worsening (leflunomide, anti-TNF); infection more common.", strong: false },
    { re: /daptomycin|minocycline/i, name: "Daptomycin / minocycline", note: "Eosinophilic pneumonia (fever, hypoxia, infiltrates, eosinophils): stop, steroids.", strong: true },
    { re: /hydralazine|propylthiouracil|\bptu\b/i, name: "Hydralazine / PTU", note: "Drug-induced ANCA vasculitis with alveolar hemorrhage.", strong: false }];
  const S = {
    nintedanib: /nintedanib|ofev/i, pirfenidone: /pirfenidone|esbriet/i, nerandomilast: /nerandomilast/i,
    steroid: /prednisone|prednisolone|methylprednisolone|solu-?medrol|dexamethasone|hydrocortisone/i,
    immuno: /mycophenolate|cellcept|myfortic|azathioprine|tacrolimus|cyclosporine|rituximab|cyclophosphamide|tocilizumab|methotrexate|leflunomide|tofacitinib|baricitinib|upadacitinib|infliximab|adalimumab/i,
    pjp: /sulfamethoxazole|trimethoprim|septra|bactrim|cotrimoxazole|atovaquone|dapsone|pentamidine/i,
    cyp1a2: /ciprofloxacin|fluvoxamine|enoxacin/i, anticoag: /apixaban|rivaroxaban|edoxaban|dabigatran|warfarin|enoxaparin|dalteparin|tinzaparin|heparin/i,
    ppi: /pantoprazole|omeprazole|esomeprazole|lansoprazole|rabeprazole|famotidine/i, bone: /alendronate|risedronate|zoledronic|denosumab|calcium|vitamin d|cholecalciferol/i,
    opioid: /morphine|hydromorphone|oxycodone|fentanyl/i };

  function pneumotox(meds) {
    const out = [];
    PNEUMOTOX.forEach((d) => { const hits = meds.filter((m) => d.re.test(m)); if (hits.length) out.push(Object.assign({}, d, { orders: hits })); });
    return out;
  }

  // prednisone-equivalent mg/day from an order text (rough; for the PJP rule only)
  function predEq(t) {
    const m = String(t).match(/(\d+(?:\.\d+)?)\s*mg/i); if (!m) return null;
    let mg = +m[1];
    if (/bid|twice|q12h/i.test(t)) mg *= 2; else if (/tid|q8h/i.test(t)) mg *= 3; else if (/qid|q6h/i.test(t)) mg *= 4;
    if (/dexamethasone/i.test(t)) return mg * 6.67;
    if (/methylprednisolone|solu-?medrol/i.test(t)) return mg * 1.25;
    if (/hydrocortisone/i.test(t)) return mg / 4;
    return mg;
  }

  // GAP index (IPF): Gender, Age, FVC % predicted, DLCO % predicted
  function gap(o) {
    let s = 0;
    if (o.sex === "male") s += 1;
    if (o.age > 65) s += 2; else if (o.age > 60) s += 1;
    if (o.fvc != null) { if (o.fvc < 50) s += 2; else if (o.fvc <= 75) s += 1; }
    if (o.dlcoNA) s += 3; else if (o.dlco != null) { if (o.dlco <= 35) s += 2; else if (o.dlco <= 55) s += 1; }
    const stage = s <= 3 ? "I" : s <= 5 ? "II" : "III";
    const mort = { I: [5.6, 10.9, 16.3], II: [16.2, 29.9, 42.1], III: [39.2, 62.1, 76.8] }[stage];
    return { score: s, stage, mort, text: `GAP ${s} – stage ${stage}: estimated mortality ~${mort[0]}% at 1 year, ~${mort[1]}% at 2 years, ~${mort[2]}% at 3 years (IPF cohorts; rough).` };
  }

  // 2016 acute exacerbation criteria (all four)
  function aeCriteria(sel) {
    const n = ["dx", "lt1m", "newggo", "notHF"].filter((k) => sel[k]).length;
    return { n, met: n === 4, text: n === 4 ? "Meets the definition of acute exacerbation (triggered or idiopathic). Infection, aspiration, drugs and procedures are triggers – keep looking for them." : `${n} of 4 criteria. Not an acute exacerbation yet: keep working up the other causes.` };
  }

  // ---- flags ----
  function flags(f, now) {
    now = now || Date.now();
    const out = [], L = f.latest || {}, meds = (f.meds || []).filter((m) => m.status !== "on-hold").map((m) => m.text);
    const has = (re) => meds.some((t) => re.test(t));
    const c = f.cls || { has: false, sub: [], ctd: [] }, ct = f.ctNew || [], ctIds = new Set(ct.map((x) => x.id));
    const ildish = c.has || ct.some((x) => x.kind === "fib") || ctIds.has("ggo") || ctIds.has("op");
    const tox = f.tox || [];

    // acute worsening
    if (f.o2 && f.o2.rise) out.push({ level: "red", go: "acute", text: `Oxygen need rising (${f.o2.from} → ${f.o2.to} L/min in 72 h${f.spo2min != null ? `, lowest SpO2 ${f.spo2min}%` : ""})${c.has ? " in known ILD" : ""}: work through infection, PE, heart failure, drug, pneumothorax and acute exacerbation – checklist on the Acute worsening tab.` });
    else if (f.spo2min != null && f.spo2min < 88) out.push({ level: "amber", go: "acute", text: `SpO2 as low as ${f.spo2min}% in the last 72 h.` });
    const strongFib = c.fibrotic || ["honeycomb", "traction", "uip", "fibrosis"].some((k) => ctIds.has(k));
    if (c.has && ctIds.has("ggo") && strongFib && ((f.o2 && f.o2.rise) || (f.spo2min != null && f.spo2min < 88))) out.push({ level: "red", go: "acute", text: "New ground glass on a background of fibrosis: possible acute exacerbation (in-hospital mortality ~50%). Exclude infection, PE, HF and drugs; respirology today; goals of care now." });
    if (c.fibrotic && f.o2 && f.o2.to >= 6) out.push({ level: "amber", go: "acute", text: `Fibrotic ILD needing ${f.o2.to} L/min: intubation rarely helps (ICU mortality >70–80% unless a reversible cause or transplant bridge). Discuss goals of care, HFNC ceiling, dyspnea plan (opioids).` });

    // drugs
    tox.forEach((d) => {
      const lvl = ildish && d.strong ? "red" : ildish ? "amber" : "info";
      out.push({ level: lvl, go: "drug", text: `${d.name} (${d.orders[0]})${ildish ? " with ILD/infiltrates" : ""}: ${d.note}` });
    });
    if (!c.has && (ctIds.has("ggo") || ctIds.has("op") || ct.some((x) => x.kind === "fib")) && !tox.length) out.push({ level: "info", go: "types", text: `CT shows ${ct.map((x) => x.name).join(", ")} without ILD on the problem list: new ILD vs infection, edema or hemorrhage – compare with old imaging, review exposures, drugs and CTD features.` });

    // eosinophils
    if (L.eos && L.eos.v >= 1.0 && ildish) out.push({ level: "amber", text: `Eosinophils ${L.eos.v} ×10⁹/L with infiltrates: eosinophilic pneumonia (drugs: daptomycin, nitrofurantoin, minocycline; parasites; EGPA) – BAL eosinophils, stop culprit, steroids.` });

    // myositis / MDA5
    if (L.ck && L.ck.v >= 1000 && ildish) out.push({ level: "amber", go: "ctd", text: `CK ${L.ck.v} with ILD: myositis / anti-synthetase syndrome – myositis antibody panel (Jo-1, PL-7, PL-12, EJ, OJ, MDA5, Ro52), rheumatology.` });
    if (L.ferritin && L.ferritin.v >= 1500 && ildish) out.push({ level: "red", go: "ctd", text: `Ferritin ${L.ferritin.v} with ILD: think anti-MDA5 rapidly progressive ILD (can have normal CK, skin ulcers, mechanic's hands) – urgent MDA5, rheumatology + respirology the same day (combined immunosuppression).` });
    if (c.ctd.length && ildish) out.push({ level: "info", go: "ctd", text: `${c.ctd.map((x) => x.name).join(", ")} with ILD/infiltrates: CTD-ILD flare vs infection on immunosuppression vs drug (methotrexate, leflunomide, biologics).` });
    if (!c.ctd.length && ildish && !c.sub.some((x) => x.id === "ipf") && !(f.serologySeen || []).length) out.push({ level: "info", go: "ctd", text: "No autoimmune serology found in the chart: ANA, ENA (Scl-70, SSA/SSB, RNP), RF, anti-CCP, CK, myositis panel, ANCA are usual for new ILD." });

    // infection risk / PJP
    const pred = (f.meds || []).filter((m) => S.steroid.test(m.text)).map((m) => ({ eq: predEq(m.text), days: m.t ? Math.floor((now - m.t) / DAY) : null }));
    const bigSteroid = pred.some((p) => p.eq != null && p.eq >= 20 && p.days != null && p.days >= 28);
    const comboIS = pred.some((p) => p.eq != null && p.eq >= 15) && has(/mycophenolate|cellcept|myfortic|azathioprine|cyclophosphamide|rituximab|tacrolimus|cyclosporine/i);
    if ((bigSteroid || comboIS) && !has(S.pjp)) out.push({ level: "amber", go: "disch", text: `${bigSteroid ? "Prednisone ≥20 mg/day (or equivalent) for ≥4 weeks" : "Prednisone ≥15 mg/day with mycophenolate/azathioprine/cyclophosphamide/rituximab/calcineurin inhibitor"} with no PJP prophylaxis: TMP-SMX (or atovaquone/dapsone).` });
    if ((has(S.steroid) || has(S.immuno)) && ildish && L.ldh && L.ldh.v >= 350 && ctIds.has("ggo")) out.push({ level: "amber", go: "acute", text: `Immunosuppressed with ground glass and LDH ${L.ldh.v}: PJP? Beta-D-glucan, induced sputum/BAL PCR; treat empirically if hypoxic.` });

    // steroids in IPF
    if (c.sub.some((x) => x.id === "ipf") && has(S.steroid) && !(f.o2 && f.o2.rise) && !ctIds.has("ggo")) out.push({ level: "amber", go: "types", text: "IPF on steroids without an acute exacerbation: long-term steroids (± azathioprine) increase harm in IPF (PANTHER) – check the indication." });

    // antifibrotics
    if (has(S.nintedanib)) {
      if (L.alt && L.alt.v >= 120) out.push({ level: "amber", text: `ALT ${L.alt.v} on nintedanib (≥3× ULN): hold or reduce; respirology.` });
      if (has(S.anticoag)) out.push({ level: "info", text: "Nintedanib with an anticoagulant: higher bleeding risk (VEGF effect) – full anticoagulation is not contraindicated but monitor." });
      out.push({ level: "info", text: "Nintedanib: diarrhea is common (loperamide); hold if NPO, for major surgery (wound healing) or with ALT ≥3× ULN; do not stop routinely for admission." });
    }
    if (has(S.pirfenidone)) {
      if (has(S.cyp1a2)) out.push({ level: "amber", text: `Pirfenidone with ${meds.filter((m) => S.cyp1a2.test(m)).map((m) => m.split(" ")[0]).join(", ")} (CYP1A2 inhibitor): pirfenidone levels rise – ciprofloxacin needs a dose cut, fluvoxamine is contraindicated.` });
      if (L.alt && L.alt.v >= 120) out.push({ level: "amber", text: `ALT ${L.alt.v} on pirfenidone: hold or reduce; respirology.` });
      out.push({ level: "info", text: "Pirfenidone: take with food (nausea), photosensitivity rash (sunscreen), LFTs monthly at first." });
    }
    if (c.fibrotic && !has(S.nintedanib) && !has(S.pirfenidone) && !has(S.nerandomilast)) out.push({ level: "info", go: "disch", text: "Fibrotic ILD with no antifibrotic on the list: IPF or progressive pulmonary fibrosis may qualify (nintedanib, pirfenidone) – ask about home meds and respirology follow-up." });

    // supportive labs
    if (L.bnp && L.bnp.hi && ildish) out.push({ level: "info", go: "acute", text: `${L.bnp.name} ${L.bnp.v}: heart failure or pulmonary hypertension / RV strain may contribute – echo.` });
    if (ctIds.has("pe")) out.push({ level: "red", go: "acute", text: "CT report mentions pulmonary embolism." });
    if (ctIds.has("ptx")) out.push({ level: "red", go: "acute", text: "CT report mentions pneumothorax (fibrotic lungs, often needs a drain and re-expands poorly)." });

    const order = { red: 0, amber: 1, info: 2, green: 3 };
    return out.sort((a, b) => order[a.level] - order[b.level]);
  }

  function note(o) {
    const L = [];
    L.push(`INTERSTITIAL LUNG DISEASE (${o.date || ""})`);
    L.push(`ILD: ${o.ild || "___"}${o.type ? " – " + o.type : ""}. Baseline O2: ${o.baseO2 || "___"}. Respirologist: ${o.resp || "___"}.`);
    if (o.ct) L.push(`CT: ${o.ct}.`);
    if (o.o2) L.push(`Now: ${o.o2}.`);
    if (o.labs) L.push(`Labs: ${o.labs}.`);
    L.push(`ILD medications: ${o.meds && o.meds.length ? o.meds.join("; ") : "none found"}.`);
    if (o.tox && o.tox.length) L.push(`Possible pneumotoxic drugs: ${o.tox.join("; ")}.`);
    if (o.ae) L.push(`Acute exacerbation criteria: ${o.ae}.`);
    if (o.flags && o.flags.length) { L.push(""); L.push("Issues:"); o.flags.forEach((x) => L.push(`- ${x}`)); }
    L.push(""); L.push("Plan:");
    (o.plan && o.plan.length ? o.plan : ["___"]).forEach((x) => L.push(`- ${x}`));
    L.push(`- Respirology ${o.respAware ? "aware" : "to be consulted"}.`);
    L.push(`- Goals of care / code status: ${o.code || "___"}.`);
    if (o.decision) { L.push(""); L.push(`My decision: ${o.decision}`); }
    return L.join("\n");
  }

  const api = { classify, ctFindings, pneumotox, predEq, gap, aeCriteria, flags, note, PNEUMOTOX, S };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else window.IldRules = api;
})();
