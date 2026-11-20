/* Oncology tab: pure rules (no DOM, no FHIR). UNVERIFIED draft written by Claude - verify before clinical use.
   node hospitalist-toolkit/tests/test_onc.js checks them. */
(function () {
  const DR = (typeof module !== "undefined" && module.exports) ? require("./drugs.js") : window.OncDrugs;
  const DAY = 864e5, H = 36e5;

  // ---- which cancer(s) from the problem list (primary only; "secondary ... of lung" is a metastasis, not lung cancer) ----
  const PRIMARY = {
    lung: { re: /\blung\b|bronch|nsclc|sclc|small cell|non-?small|pulmonary (adeno|carcinoma|malignan|neoplasm)|C34(\.\d+)?\b/i },
    breast: { re: /breast|C50(\.\d+)?\b/i },
    crc: { re: /colon|colorectal|rectum|rectal|rectosigmoid|sigmoid|caecum|cecum|cecal|hepatic flexure|splenic flexure|C1[89](\.\d+)?\b|C20\b/i },
    prostate: { re: /prostat|C61\b/i } };
  const CANCERWORD = /cancer|carcinoma|adenocarcinoma|malignan|neoplasm|tumou?r|nsclc|sclc|\bC\d\d/i;
  const NOTCANCER = /benign|hyperplasia|\bbph\b|polyp|adenoma(?!.*carcinoma)|screening|family history|fh of|fibroadenoma|cyst|prostatitis|nodule(?!.*malig)|\bD[0-4]\d/i;
  const SECONDARY = /secondary|metasta|\bmets?\b|C7[7-9]/i;

  function detectCancers(probTexts, drugHits) {
    const out = {};
    (probTexts || []).forEach((t) => {
      if (!CANCERWORD.test(t) || NOTCANCER.test(t)) return;
      // "Secondary malignant neoplasm of lung" is lung mets; "lung cancer with brain metastases" is still lung cancer
      Object.entries(PRIMARY).forEach(([k, d]) => {
        if (!d.re.test(t)) return;
        if (SECONDARY.test(t)) {
          const m = t.match(/(secondary|metasta\w*|mets?)\b.{0,40}?\b(of|to|in)\b\s*(the\s*)?(\w+)/i);
          const site = m ? m[4] : "";
          if (site && d.re.test(site)) return; // the metastatic site is this organ, not the primary
        }
        (out[k] = out[k] || { from: [], drugs: [] }).from.push(t.replace(/\s+[A-Z]\d\d(\.\d+)?$/, ""));
      });
    });
    (drugHits || []).forEach((d) => {
      if (d.cancers.length === 1) { const k = d.cancers[0]; (out[k] = out[k] || { from: [], drugs: [] }).drugs.push(d.name); }
    });
    const sclc = (probTexts || []).some((t) => /small cell/i.test(t) && !/non-?small/i.test(t));
    if (out.lung) out.lung.sclc = sclc;
    return out;
  }

  // ---- metastatic sites / complications from problems + report text ----
  const SITES = {
    bone: /bone met|bony met|osseous met|skeletal met|secondary malignant neoplasm of bone|C79\.5|lytic|sclerotic lesion|blastic/i,
    brain: /brain met|cerebral met|intracranial met|secondary malignant neoplasm of brain|C79\.3|leptomening/i,
    liver: /liver met|hepatic met|secondary malignant neoplasm of liver|C78\.7/i,
    lungmet: /lung met|pulmonary met|secondary malignant neoplasm of lung|C78\.0/i,
    pleural: /pleural effusion|C78\.2|malignant effusion/i,
    peritoneal: /peritone|carcinomatosis|C78\.6|omental/i,
    mscc: /cord compression|spinal cord compress|epidural (disease|tumou?r|met|extension)|cauda equina|thecal sac (compression|effacement)|G95\.2|G83\.4/i,
    backpain: /back pain|spinal pain|dorsalgia|M54\./i,
    weakness: /leg weakness|paraparesis|paraplegia|lower limb weakness|urinary retention|R33/i,
    svc: /superior vena cava|\bsvc (syndrome|obstruction)|I87\.1/i,
    pericard: /pericardial effusion|tamponade|I31\.[34]/i,
    hemoptysis: /hemoptysis|haemoptysis|R04\.2/i,
    pneumonitis: /pneumonitis|interstitial lung disease|\bild\b|J70\.[24]|J84/i,
    fn: /febrile neutropeni|neutropenic fever|D70/i,
    obstruction: /bowel obstruction|\bsbo\b|\blbo\b|K56/i,
    hydro: /hydronephrosis|N13/i,
    diarrhea: /diarrh|colitis|enteritis|R19\.7|K52/i,
    vte: /deep vein|\bdvt\b|pulmonary embol|\bpe\b|I26|I80|I82/i };

  function findSites(texts) {
    const out = {};
    (texts || []).forEach((t) => Object.entries(SITES).forEach(([k, re]) => { if (re.test(t)) (out[k] = out[k] || []).push(t.slice(0, 160)); }));
    return out;
  }

  const corrCa = (ca, alb) => (ca == null || alb == null ? null : +(ca + 0.02 * (40 - alb)).toFixed(2));

  function caLevel(c) {
    if (c == null) return null;
    if (c > 3.5) return { level: "red", text: `Corrected Ca ${c} mmol/L: severe hypercalcemia (>3.5). Saline, zoledronic acid (or denosumab), calcitonin; consider ICU/dialysis if confused or kidney failure.` };
    if (c >= 3.0) return { level: "red", text: `Corrected Ca ${c} mmol/L: moderate hypercalcemia (3.0–3.5). Saline and zoledronic acid; calcitonin if symptomatic.` };
    if (c > 2.6) return { level: "amber", text: `Corrected Ca ${c} mmol/L: mild hypercalcemia (2.6–3.0). Hydrate, stop calcium/vitamin D/thiazides; bisphosphonate if symptomatic or rising.` };
    if (c < 2.0) return { level: "amber", text: `Corrected Ca ${c} mmol/L: low (consider denosumab/bisphosphonate, low vitamin D, low Mg, TLS).` };
    return { level: "green", text: `Corrected Ca ${c} mmol/L: normal range.` };
  }

  // Cairo-Bishop laboratory TLS (adult thresholds, SI)
  function tls(v) {
    const crit = [];
    if (v.urate != null && v.urate >= 476) crit.push(`urate ${v.urate}`);
    if (v.k != null && v.k >= 6.0) crit.push(`K ${v.k}`);
    if (v.po4 != null && v.po4 >= 1.45) crit.push(`PO4 ${v.po4}`);
    if (v.ca != null && v.ca <= 1.75) crit.push(`corrected Ca ${v.ca}`);
    const clinical = v.crHigh || v.arrhythmia || v.seizure;
    return { n: crit.length, crit, lab: crit.length >= 2, clinical: crit.length >= 2 && !!clinical };
  }

  function mascc(sel) {
    let s = Number(sel.burden || 0);
    ["nohypo", "nocopd", "solid", "nodehyd", "outpt", "young"].forEach((k) => { if (sel[k]) s += { nohypo: 5, nocopd: 4, solid: 4, nodehyd: 3, outpt: 3, young: 2 }[k]; });
    return { score: s, low: s >= 21, text: s >= 21 ? `MASCC ${s}: low risk (≥21). Oral antibiotics and early discharge may be possible if stable, reliable and able to return fast.` : `MASCC ${s}: high risk (<21). IV antibiotics in hospital.` };
  }

  // ---- emergency and drug-safety flags ----
  // f: parsed chart facts (chart.js). Returns [{ level, text, go? , tk? }]
  function flags(f, now) {
    now = now || Date.now();
    const out = [], L = f.latest || {}, S = DR.SUPPORT;
    const meds = (f.meds || []).filter((m) => m.status !== "on-hold").map((m) => m.text);
    const has = (re) => meds.some((t) => re.test(t));
    const drugs = f.drugs || DR.match(meds);
    const tag = (t) => drugs.filter((d) => d.tags.includes(t));
    const fresh = (x, hrs) => x && now - x.t <= hrs * H;
    const cyto = tag("cyto"), onCancerTx = drugs.filter((d) => !d.tags.includes("bone")).length > 0;
    const sites = f.sites || {};

    // febrile neutropenia
    const anc = fresh(L.anc, 72) ? L.anc : null, tmax = f.tmax48;
    if (anc && anc.v < 0.5 && tmax != null && tmax >= 38.0) out.push({ level: "red", go: "emerg", text: `Febrile neutropenia: ANC ${anc.v} with temperature ${tmax} °C in the last 48 h. Cultures and piperacillin-tazobactam within 60 minutes.` });
    else if (anc && anc.v < 1.0 && tmax != null && tmax >= 38.0) out.push({ level: "red", go: "emerg", text: `Fever ${tmax} °C with ANC ${anc.v}: ANC may fall below 0.5 – treat as febrile neutropenia.` });
    else if (anc && anc.v < 0.5) out.push({ level: "amber", go: "emerg", text: `Severe neutropenia (ANC ${anc.v}). Neutropenic precautions; antibiotics within 60 min if any fever. No rectal exams or suppositories.` });
    else if (anc && anc.v < 1.0) out.push({ level: "amber", text: `Neutropenia (ANC ${anc.v}).` });
    if (!anc && tmax != null && tmax >= 38.0 && (cyto.length || onCancerTx)) out.push({ level: "red", go: "emerg", text: `Fever ${tmax} °C on anticancer treatment with no ANC in the last 72 h: send CBC with differential now and treat as febrile neutropenia until it is back.` });
    if (sites.fn) out.push({ level: "red", go: "emerg", text: "Febrile neutropenia on the problem list." });

    // calcium
    const cc = f.corrCa != null ? f.corrCa : (L.ca ? L.ca.v : null);
    const cl = caLevel(cc); if (cl && cl.level !== "green") out.push(Object.assign({ go: "emerg" }, cl));

    // TLS
    const t = tls({ urate: L.urate && L.urate.v, k: L.k && L.k.v, po4: L.po4 && L.po4.v, ca: f.corrCa, crHigh: f.crRise && f.crRise.to >= 1.5 * f.crRise.from });
    if (t.lab) out.push({ level: "red", go: "emerg", text: `Laboratory tumour lysis pattern (Cairo-Bishop ${t.n} of 4: ${t.crit.join(", ")})${t.clinical ? " with a creatinine rise = clinical TLS" : ""}. Fluids, rasburicase (check G6PD), nephrology.` });
    else if (L.urate && L.urate.v >= 476) out.push({ level: "amber", text: `Urate ${L.urate.v} µmol/L: TLS risk if bulky or chemo-sensitive disease (check K, PO4, Ca, LDH).` });
    if (L.k && L.k.v >= 6.0) out.push({ level: "red", text: `K ${L.k.v} mmol/L: treat hyperkalemia now (ECG).` });

    // sodium
    if (L.na && L.na.v < 125) out.push({ level: "red", tk: "hypona", text: `Na ${L.na.v} mmol/L${f.cancers && f.cancers.lung && f.cancers.lung.sclc ? " in small cell lung cancer (SIADH likely)" : ""}. Exclude adrenal insufficiency; limit correction to 8 mmol/L/24 h.` });
    else if (L.na && L.na.v < 130) out.push({ level: "amber", tk: "hypona", text: `Na ${L.na.v} mmol/L${f.cancers && f.cancers.lung && f.cancers.lung.sclc ? " in small cell lung cancer" : ""}. Think SIADH (SCLC, cisplatin, cyclophosphamide, opioids) and adrenal insufficiency.` });

    // counts
    if (L.plt && L.plt.v < 20) out.push({ level: "red", text: `Platelets ${L.plt.v}: bleeding risk${has(S.anticoag) ? " – on an anticoagulant: review now" : ""}. Transfuse if bleeding or <10.` });
    else if (L.plt && L.plt.v < 50 && has(S.anticoag)) out.push({ level: "amber", go: "emerg", text: `Platelets ${L.plt.v} on an anticoagulant: reduce or hold LMWH/DOAC (discuss with hematology).` });
    if (L.hb && L.hb.v < 70) out.push({ level: "amber", text: `Hb ${L.hb.v} g/L (chemo, PARP inhibitor, Lu-PSMA, marrow infiltration, bleeding).` });

    // Mg
    if (L.mg && L.mg.v < 0.5) out.push({ level: "red", tk: "lytes", text: `Mg ${L.mg.v} mmol/L: severe${tag("egfrab").length ? " (anti-EGFR antibody)" : has(/cisplatin/i) ? " (cisplatin)" : ""}. IV magnesium; check K and Ca.` });
    else if (L.mg && L.mg.v < 0.7 && (tag("egfrab").length || has(/cisplatin|carboplatin/i))) out.push({ level: "amber", tk: "lytes", text: `Mg ${L.mg.v} mmol/L on ${tag("egfrab").length ? "cetuximab/panitumumab" : "platinum"}: replace.` });

    // glucose
    const hiG = L.glu && L.glu.v >= 15;
    if (hiG && (has(/alpelisib|piqray|inavolisib|capivasertib|everolimus/i) || has(S.steroid) || tag("ici").length))
      out.push({ level: L.glu.v >= 20 ? "red" : "amber", text: `Glucose ${L.glu.v} mmol/L on ${[has(/alpelisib|piqray|inavolisib|capivasertib|everolimus/i) && "a PI3K/AKT/mTOR drug", has(S.steroid) && "steroids", tag("ici").length && "immunotherapy (think type 1 diabetes / DKA)"].filter(Boolean).join(", ")}. Check ketones; treat.` });

    // liver
    if (L.alt && L.alt.v >= 120 && (tag("ici").length || drugs.some((d) => /inhibitor|TKI/i.test(d.cls)))) out.push({ level: "amber", tk: "tox", text: `ALT ${L.alt.v} U/L (≥3× ULN) on ${drugs.map((d) => d.name).slice(0, 3).join(", ")}: drug hepatitis? Hold and call oncology.` });

    // kidney
    if (f.crRise) out.push({ level: "amber", tk: "aki", text: `Creatinine ${f.crRise.from} → ${f.crRise.to} µmol/L (AKI): dehydration from diarrhea/vomiting, obstruction (hydronephrosis), hypercalcemia, nephrotoxic drugs, TLS. Recheck doses of renally cleared drugs.` });
    if (f.crRise && (has(/cisplatin|pemetrexed|methotrexate|zoledronic|capecitabine/i))) out.push({ level: "amber", text: `Creatinine rise on ${meds.filter((m) => /cisplatin|pemetrexed|methotrexate|zoledronic|capecitabine/i.test(m)).map((m) => m.split(" ")[0]).join(", ")}: kidney-dosed or nephrotoxic – oncology/pharmacy to review before the next dose.` });
    if (f.crRise && has(/tucatinib|abemaciclib/i)) out.push({ level: "info", text: "Tucatinib/abemaciclib raise creatinine by blocking secretion without true kidney injury: check cystatin C or urine output before calling it AKI." });

    // sites / text
    if (sites.mscc) out.push({ level: "red", go: "emerg", text: "Cord compression / epidural disease in the chart: dexamethasone, MRI whole spine, rad onc + spine surgery today." });
    else if (sites.backpain && (sites.bone || (f.cancers && (f.cancers.prostate || f.cancers.breast || f.cancers.lung)))) out.push({ level: sites.weakness ? "red" : "amber", go: "emerg", text: `Back pain${sites.bone ? " with bone mets" : " with a cancer that spreads to bone"}${sites.weakness ? " and weakness/retention" : ""}: think spinal cord compression – neuro exam, MRI whole spine within 24 h${sites.weakness ? " (today)" : ""}.` });
    if (sites.svc) out.push({ level: "red", go: "emerg", text: "SVC obstruction in the chart: stridor/confusion → urgent stent; get tissue before steroids." });
    if (sites.pericard) out.push({ level: "red", go: "emerg", text: "Pericardial effusion / tamponade in the chart: echo, pericardiocentesis if tamponade." });
    if (sites.hemoptysis) out.push({ level: "amber", go: "emerg", text: `Hemoptysis${has(S.anticoag) ? " on an anticoagulant" : ""}${tag("vegf").length ? " on anti-VEGF" : ""}.` });
    if (sites.brain) out.push({ level: "amber", go: "emerg", text: `Brain mets: seizure plan, steroid only if symptomatic${has(S.anticoag) ? "; anticoagulation is not contraindicated by brain mets alone" : ""}.` });
    if (sites.pneumonitis && (tag("ici").length || tag("adc").length || has(/osimertinib|everolimus|erlotinib|gefitinib|amivantamab/i))) out.push({ level: "red", tk: "tox", text: "Pneumonitis/ILD on a drug that causes it: hold drug, CT, exclude infection, steroids for grade ≥2, call oncology." });
    if (sites.obstruction) out.push({ level: "amber", tk: "pc", text: `Bowel obstruction${tag("vegf").length ? " on anti-VEGF (perforation risk)" : ""}.` });
    if (sites.diarrhea && (has(/irinotecan|folfiri|fluorouracil|5-?fu\b|capecitabine|abemaciclib|neratinib|sacituzumab|ipilimumab/i) || tag("ici").length)) out.push({ level: "red", text: `Diarrhea on ${drugs.filter((d) => /irinotecan|fluorouracil|capecitabine|abemaciclib|neratinib|sacituzumab/i.test(d.name) || d.tags.includes("ici")).map((d) => d.name).join(", ") || "anticancer treatment"}: grade it (stools/day over baseline), fluids, K/Mg, C. difficile; ${tag("ici").length ? "immunotherapy colitis → steroids (Oncology toxicity tab); " : ""}irinotecan → high-dose loperamide; admit/IV if neutropenic, febrile or dehydrated.` });
    if (sites.hydro) out.push({ level: "amber", text: "Hydronephrosis: US, urology/IR for stent or nephrostomy if it fits goals." });

    // ---- drug safety ----
    if (tag("ici").length) out.push({ level: "info", tk: "tox", text: `On immunotherapy (${tag("ici").map((d) => d.name).join(", ")}): any new symptom may be an immune side effect. Check TSH, cortisol, glucose, LFTs, creatinine, troponin if chest symptoms.` });
    if (tag("bispec").length) out.push({ level: "info", tk: "bsab", text: `On a bispecific (${tag("bispec").map((d) => d.name).join(", ")}): fever/low BP = CRS, confusion = ICANS.` });
    if (tag("abi").length && !has(/prednisone|prednisolone|dexamethasone|hydrocortisone/i)) out.push({ level: "red", text: "Abiraterone without prednisone on the medication list: it needs prednisone 5 mg BID (or 10 mg daily) – risk of low K, hypertension and adrenal crisis." });
    const onPred = has(/prednisone|prednisolone|dexamethasone|hydrocortisone/i);
    if ((tag("abi").length && onPred) || (has(S.steroid) && f.steroidDays != null && f.steroidDays >= 21)) out.push({ level: "amber", go: "emerg", text: `${tag("abi").length ? "Abiraterone + prednisone" : "Steroids ≥3 weeks"}: adrenal suppression – stress-dose steroids if acutely ill or for surgery; IV hydrocortisone if NPO.` });
    if (tag("abi").length && L.k && L.k.v < 3.5) out.push({ level: "amber", text: `K ${L.k.v} on abiraterone (mineralocorticoid excess): replace; check prednisone is being given; check BP.` });
    if (f.dexDays != null && f.dexDays >= 28 && !has(S.tmpsmx)) out.push({ level: "amber", text: `Dexamethasone for ~${f.dexDays} days with no PJP prophylaxis: consider TMP-SMX (usual threshold ≥20 mg prednisone-equivalent for ≥4 weeks). Also PPI and glucose checks.` });
    if (tag("ind").length && has(S.doac)) out.push({ level: "amber", text: `${tag("ind").map((d) => d.name).join(", ")} (strong CYP3A4/P-gp inducer) with a DOAC: DOAC levels fall – ask pharmacy; LMWH is often used.` });
    const gnrh = drugs.find((d) => d.tags.includes("gnrh"));
    if (gnrh && !has(S.antiandro)) {
      const start = (f.meds || []).filter((m) => DR.DRUGS.find((d) => d.tags.includes("gnrh")).re.test(m.text) && m.t).map((m) => m.t).sort()[0];
      if (start && now - start < 28 * DAY && f.cancers && f.cancers.prostate) out.push({ level: sites.bone || sites.backpain ? "red" : "amber", text: `GnRH agonist started ~${Math.round((now - start) / DAY)} days ago without an antiandrogen: testosterone flare risk${sites.bone || sites.backpain ? " with bone disease (cord compression, retention)" : ""}. Consider bicalutamide or a GnRH antagonist.` });
    }
    const qtCancer = tag("qt"), qtOther = meds.filter((m) => S.qt.test(m));
    if (qtCancer.length && qtOther.length) out.push({ level: "amber", text: `QTc: ${qtCancer.map((d) => d.name).join(", ")} with ${[...new Set(qtOther.map((m) => (m.match(S.qt) || [""])[0].toLowerCase()))].join(", ")}. Get an ECG; keep K ≥4 and Mg ≥0.8.` });
    if (has(/capecitabine|xeloda/i) && has(S.warfarin)) out.push({ level: "amber", text: "Capecitabine + warfarin: INR can rise sharply – check INR at least weekly or change anticoagulant." });
    if (has(/tamoxifen/i) && has(S.cyp2d6inh)) out.push({ level: "amber", text: "Tamoxifen with a strong CYP2D6 inhibitor (paroxetine/fluoxetine/bupropion): may reduce tamoxifen effect – prefer venlafaxine, citalopram or escitalopram." });
    if (has(/erlotinib|gefitinib/i) && has(S.ppi)) out.push({ level: "info", text: "Erlotinib/gefitinib with an acid suppressant: absorption falls – avoid PPI if possible, or separate doses (ask pharmacy)." });
    if (has(/pemetrexed/i) && has(S.nsaid)) out.push({ level: "amber", text: "Pemetrexed with an NSAID: higher toxicity – avoid NSAIDs around doses (especially if CrCl < 80)." });
    if (has(/pemetrexed/i) && !has(/folic|folate|cyanocobalamin|vitamin b12|b12/i)) out.push({ level: "info", text: "Pemetrexed: folic acid daily and B12 every 9 weeks needed – not seen on the medication list (may be outpatient)." });
    if (tag("cdk").length && has(S.cyp3a4inh)) out.push({ level: "amber", text: `${tag("cdk").map((d) => d.name).join(", ")} with a CYP3A4 inhibitor (${meds.filter((m) => S.cyp3a4inh.test(m)).slice(0, 2).join("; ")}): higher levels – ask pharmacy.` });
    if (tag("bone").length && cc != null && cc < 2.1) out.push({ level: "amber", text: `Ca ${cc} on ${tag("bone").map((d) => d.name).join(", ")}: replace calcium and vitamin D.` });
    if (tag("vegf").length) out.push({ level: "info", text: "Anti-VEGF drug: check BP and urine protein; hold ≥4–6 weeks before elective surgery; new abdominal pain → think perforation." });
    if (has(/fluorouracil|5-?fu\b|folfox|folfiri|capecitabine|xeloda/i)) out.push({ level: "info", text: "Fluoropyrimidine: chest pain = possible coronary vasospasm; severe toxicity in cycle 1 = possible DPD deficiency (uridine triacetate)." });
    if (has(/irinotecan|folfiri/i) && L.bili && L.bili.v > 25) out.push({ level: "amber", text: `Bilirubin ${L.bili.v} µmol/L on irinotecan: more neutropenia and diarrhea – oncology to review dose.` });

    const order = { red: 0, amber: 1, info: 2, green: 3 };
    return out.sort((a, b) => order[a.level] - order[b.level]);
  }

  // ---- handout sections chosen from the drugs ----
  function handoutDefaults(drugs, meds) {
    const tags = new Set([].concat(...drugs.map((d) => d.tags)));
    const any = (re) => (meds || []).some((m) => re.test(m));
    return {
      chemo: tags.has("cyto"), immuno: tags.has("ici") || tags.has("bispec"),
      targeted: drugs.some((d) => /inhibitor|TKI|antibody|conjugate/i.test(d.cls) && !d.tags.includes("ici")),
      hormone: drugs.some((d) => /hormone|endocrine|androgen|antiandrogen/i.test(d.cls)),
      steroid: any(DR.SUPPORT.steroid), anticoag: any(DR.SUPPORT.anticoag), bone: tags.has("bone") };
  }

  // ---- note ----
  function note(o) {
    const L = [];
    L.push(`ONCOLOGY SUMMARY (${o.date || ""})`);
    L.push(`Cancer: ${o.cancer || "___"}${o.stage ? ", " + o.stage : ""}. Intent: ${o.intent || "___"}. Oncologist: ${o.oncologist || "___"}.`);
    L.push(`Current anticancer treatment: ${o.treatment && o.treatment.length ? o.treatment.join("; ") : "none found on the medication list"}${o.lastTx ? ` (last treatment ${o.lastTx})` : ""}.`);
    if (o.labs) L.push(`Labs: ${o.labs}.`);
    if (o.flags && o.flags.length) { L.push(""); L.push("Issues / safety:"); o.flags.forEach((x) => L.push(`- ${x}`)); }
    if (o.mascc) L.push(`- ${o.mascc}`);
    L.push("");
    L.push("Plan:");
    (o.plan && o.plan.length ? o.plan : ["___"]).forEach((x) => L.push(`- ${x}`));
    L.push(`- Oncology ${o.oncNotified ? "aware" : "to be informed"}${o.oncologist ? " (Dr. " + o.oncologist.replace(/^dr\.?\s*/i, "") + ")" : ""}.`);
    L.push(`- Goals of care / code status: ${o.code || "___"}.`);
    if (o.decision) { L.push(""); L.push(`My decision: ${o.decision}`); }
    return L.join("\n");
  }

  const api = { detectCancers, findSites, corrCa, caLevel, tls, mascc, flags, handoutDefaults, note, SITES, PRIMARY };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else window.OncRules = api;
})();
