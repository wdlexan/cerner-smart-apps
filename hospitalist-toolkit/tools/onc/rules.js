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
    prostate: { re: /prostat|C61\b/i },
    leuk: { re: /leuka?emia|\b(aml|cml|cll|apl)\b|promyelocytic|lymphoblastic|myeloblastic|C9[1-5](\.\d+)?\b/i },
    bladder: { re: /bladder|urothelial|transitional cell|C6[5-7](\.\d+)?\b/i },
    melanoma: { re: /melanoma|C43(\.\d+)?\b/i },
    hn: { re: /head and neck|oropharyn|oral cavity|tongue|tonsil|laryn|pharyn|salivary|parotid|floor of mouth|gingiva|buccal mucosa|\blip\b|sinonasal|C0\d(\.\d+)?\b|C1[0-4](\.\d+)?\b|C3[0-2](\.\d+)?\b/i },
    kidney: { re: /renal cell|\brcc\b|kidney|C64(\.\d+)?\b/i },
    panc: { re: /pancrea|C25(\.\d+)?\b/i },
    lymph: { re: /lymphoma|hodgkin|\bdlbcl\b|burkitt|mycosis fungoides|C8[1-6](\.\d+)?\b|C88(\.\d+)?\b/i },
    myeloma: { re: /myeloma|plasmacytoma|plasma cell (neoplasm|leuka?emia|dyscrasia|myeloma)|kahler|C90(\.\d+)?\b/i } };
  // heme subtypes (shown on the cancer card and used by rules)
  const SUB = {
    leuk: [["apl", /promyelocytic|\bapl\b|pml-?rara|C92\.4/i], ["aml", /acute myeloid|acute myelogenous|\baml\b|myeloblastic|C92\.0|C93\.0/i],
      ["all", /lymphoblastic|\bB-?ALL\b|\bT-?ALL\b|C91\.0/i], ["cml", /chronic myeloid|chronic myelogenous|\bcml\b|C92\.1/i],
      ["cll", /chronic lymphocytic|\bcll\b|small lymphocytic|C91\.1/i]],
    lymph: [["hodgkin", /^(?!.*non-?hodgkin).*hodgkin|C81/i], ["dlbcl", /diffuse large|\bdlbcl\b|C83\.3/i], ["burkitt", /burkitt|C83\.7/i],
      ["pcnsl", /central nervous system lymphoma|cns lymphoma|primary cns|brain lymphoma|cerebral lymphoma|intraocular lymphoma/i],
      ["follicular", /follicular|C82/i], ["mantle", /mantle cell|C83\.1/i], ["marginal", /marginal zone|malt|C88\.4/i], ["tcell", /t-?cell lymphoma|peripheral t|anaplastic large|C84|C86/i]] };
  const SUBNAME = { apl: "APL", aml: "AML", all: "ALL", cml: "CML", cll: "CLL", hodgkin: "Hodgkin", dlbcl: "DLBCL", burkitt: "Burkitt", pcnsl: "primary CNS", follicular: "follicular", mantle: "mantle cell", marginal: "marginal zone", tcell: "T-cell" };
  const CANCERWORD = /cancer|carcinoma|adenocarcinoma|malignan|neoplasm|tumou?r|nsclc|sclc|melanoma|\brcc\b|leuka?emia|lymphoma|hodgkin|myeloma|plasmacytoma|\b(aml|cml|cll|apl|dlbcl)\b|\bALL\b|\bC\d\d/i;
  const NOTCANCER = /benign|hyperplasia|\bbph\b|polyp|adenoma(?!.*carcinoma)|screening|family history|fh of|fibroadenoma|cyst|prostatitis|nodule(?!.*malig)|leukemoid|lymphadenopathy|lymphocytosis|ipmn|intraductal papillary|neurogenic bladder|overactive bladder|\bD[0-4]\d/i;
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
    // the uppercase word "ALL" alone (case-sensitive) also means acute lymphoblastic leukemia
    (probTexts || []).forEach((t) => { if (/\bALL\b/.test(t) && !NOTCANCER.test(t)) (out.leuk = out.leuk || { from: [], drugs: [] }).from.push(t); });
    ["leuk", "lymph"].forEach((k) => {
      if (!out[k]) return;
      const txt = out[k].from.join(" | ");
      out[k].sub = SUB[k].filter(([, re]) => re.test(txt) || (k === "leuk" && re.source.includes("ALL") && /\bALL\b/.test(txt))).map(([id]) => id);
      if (k === "leuk" && out[k].sub.includes("apl")) out[k].sub = out[k].sub.filter((x) => x !== "aml");
      if (k === "leuk" && !out[k].sub.length && out[k].drugs.length) {
        const dn = out[k].drugs.join(" ");
        if (/ATRA|Arsenic/i.test(dn)) out[k].sub.push("apl"); else if (/Venetoclax|Azacitidine|Cytarabine|FLT3|IDH/i.test(dn)) out[k].sub.push("aml");
      }
    });
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
    biliary: /biliary obstruction|cholangitis|obstructive jaundice|jaundice|stent occlusion|K83\.[01]|R17/i,
    airway: /stridor|airway obstruction|upper airway|tracheostomy|laryngectomy|J38\.6|Z93\.0/i,
    laryngectomy: /laryngectomy|neck breather/i,
    bleed: /hemorrhage|haemorrhage|bleed|hematemesis|haematemesis|carotid blowout|R04\.0/i,
    hematuria: /hematuria|haematuria|clot retention|R31/i,
    conduit: /ileal conduit|urostomy|neobladder|cystectomy|Z93\.6/i,
    rash: /rash|stevens|toxic epidermal|blister|bullous|dermatitis|L51|L27/i,
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
    else if (L.na && L.na.v < 130) out.push({ level: "amber", tk: "hypona", text: `Na ${L.na.v} mmol/L${f.cancers && f.cancers.lung && f.cancers.lung.sclc ? " in small cell lung cancer" : ""}. Think SIADH (SCLC, cisplatin, cyclophosphamide, opioids) and adrenal insufficiency${tag("ici").length ? " – on immunotherapy check AM cortisol, ACTH, TSH/free T4 (hypophysitis/adrenalitis) first" : ""}.` });

    // counts
    if (L.plt && L.plt.v < 20) out.push({ level: "red", text: `Platelets ${L.plt.v}: bleeding risk${has(S.anticoag) ? " – on an anticoagulant: review now" : ""}. Transfuse if bleeding or <10.` });
    else if (L.plt && L.plt.v < 50 && has(S.anticoag)) out.push({ level: "amber", go: "emerg", text: `Platelets ${L.plt.v} on an anticoagulant: reduce or hold LMWH/DOAC (discuss with hematology).` });
    if (L.hb && L.hb.v < 70) out.push({ level: "amber", text: `Hb ${L.hb.v} g/L (chemo, PARP inhibitor, Lu-PSMA, marrow infiltration, bleeding).` });

    // Mg
    if (L.mg && L.mg.v < 0.5) out.push({ level: "red", tk: "lytes", text: `Mg ${L.mg.v} mmol/L: severe${tag("egfrab").length ? " (anti-EGFR antibody)" : has(/cisplatin/i) ? " (cisplatin)" : ""}. IV magnesium; check K and Ca.` });
    else if (L.mg && L.mg.v < 0.7 && (tag("egfrab").length || has(/cisplatin|carboplatin/i))) out.push({ level: "amber", tk: "lytes", text: `Mg ${L.mg.v} mmol/L on ${tag("egfrab").length ? "cetuximab/panitumumab" : "platinum"}: replace.` });

    // glucose
    const hiG = L.glu && L.glu.v >= 15;
    if (hiG && !has(/enfortumab|padcev/i) && (has(/alpelisib|piqray|inavolisib|capivasertib|everolimus/i) || has(S.steroid) || tag("ici").length))
      out.push({ level: L.glu.v >= 20 ? "red" : "amber", text: `Glucose ${L.glu.v} mmol/L on ${[has(/alpelisib|piqray|inavolisib|capivasertib|everolimus/i) && "a PI3K/AKT/mTOR drug", has(S.steroid) && "steroids", tag("ici").length && "immunotherapy (think type 1 diabetes / DKA)"].filter(Boolean).join(", ")}. Check ketones; treat.` });

    // liver
    if (L.alt && L.alt.v >= 120 && (tag("ici").length || drugs.some((d) => /inhibitor|TKI/i.test(d.cls)))) out.push({ level: "amber", tk: "tox", text: `ALT ${L.alt.v} U/L (≥3× ULN) on ${drugs.map((d) => d.name).slice(0, 3).join(", ")}: drug hepatitis? Hold and call oncology.` });

    // kidney
    if (f.crRise) out.push({ level: "amber", tk: "aki", text: `Creatinine ${f.crRise.from} → ${f.crRise.to} µmol/L (AKI): dehydration from diarrhea/vomiting, obstruction (hydronephrosis), hypercalcemia, nephrotoxic drugs, TLS. Recheck doses of renally cleared drugs.` });
    if (f.crRise && (has(/cisplatin|pemetrexed|zoledronic|capecitabine/i) || (has(/methotrexate/i) && !drugs.some((d) => /Methotrexate \(high/.test(d.name))))) out.push({ level: "amber", text: `Creatinine rise on ${meds.filter((m) => /cisplatin|pemetrexed|methotrexate|zoledronic|capecitabine/i.test(m)).map((m) => m.split(" ")[0]).join(", ")}: kidney-dosed or nephrotoxic – oncology/pharmacy to review before the next dose.` });
    if (f.crRise && has(/tucatinib|abemaciclib/i)) out.push({ level: "info", text: "Tucatinib/abemaciclib raise creatinine by blocking secretion without true kidney injury: check cystatin C or urine output before calling it AKI." });

    // sites / text
    if (sites.mscc) out.push({ level: "red", go: "emerg", text: "Cord compression / epidural disease in the chart: dexamethasone, MRI whole spine, rad onc + spine surgery today." });
    else if (sites.backpain && (sites.bone || (f.cancers && (f.cancers.prostate || f.cancers.breast || f.cancers.lung || f.cancers.myeloma)))) out.push({ level: sites.weakness ? "red" : "amber", go: "emerg", text: `Back pain${sites.bone ? " with bone mets" : " with a cancer that spreads to bone"}${sites.weakness ? " and weakness/retention" : ""}: think spinal cord compression – neuro exam, MRI whole spine within 24 h${sites.weakness ? " (today)" : ""}.` });
    if (sites.svc) out.push({ level: "red", go: "emerg", text: "SVC obstruction in the chart: stridor/confusion → urgent stent; get tissue before steroids." });
    if (sites.pericard) out.push({ level: "red", go: "emerg", text: "Pericardial effusion / tamponade in the chart: echo, pericardiocentesis if tamponade." });
    if (sites.hemoptysis) out.push({ level: "amber", go: "emerg", text: `Hemoptysis${has(S.anticoag) ? " on an anticoagulant" : ""}${tag("vegf").length ? " on anti-VEGF" : ""}.` });
    if (sites.brain) out.push({ level: "amber", go: "emerg", text: `Brain mets: seizure plan, steroid only if symptomatic${has(S.anticoag) ? "; anticoagulation is not contraindicated by brain mets alone" : ""}.` });
    if (sites.pneumonitis && (tag("ici").length || tag("adc").length || has(/osimertinib|everolimus|erlotinib|gefitinib|amivantamab/i))) out.push({ level: "red", tk: "tox", text: "Pneumonitis/ILD on a drug that causes it: hold drug, CT, exclude infection, steroids for grade ≥2, call oncology." });
    if (sites.obstruction) out.push({ level: "amber", tk: "pc", text: `Bowel obstruction${tag("vegf").length ? " on anti-VEGF (perforation risk)" : ""}.` });
    if (sites.diarrhea && (has(/irinotecan|folfiri|fluorouracil|5-?fu\b|capecitabine|abemaciclib|neratinib|sacituzumab|ipilimumab/i) || tag("ici").length)) out.push({ level: "red", text: `Diarrhea on ${drugs.filter((d) => /irinotecan|fluorouracil|capecitabine|abemaciclib|neratinib|sacituzumab/i.test(d.name) || d.tags.includes("ici")).map((d) => d.name).join(", ") || "anticancer treatment"}: grade it (stools/day over baseline), fluids, K/Mg, C. difficile; ${tag("ici").length ? "immunotherapy colitis → steroids (Oncology toxicity tab); " : ""}irinotecan → high-dose loperamide; admit/IV if neutropenic, febrile or dehydrated.` });
    if (sites.hydro) out.push({ level: "amber", text: "Hydronephrosis: US, urology/IR for stent or nephrostomy if it fits goals." });

    // ---- blood cancers ----
    const leuk = f.cancers && f.cancers.leuk, lymph = f.cancers && f.cancers.lymph, sub = [].concat((leuk && leuk.sub) || [], (lymph && lymph.sub) || []);
    const wbc = L.wbc && L.wbc.v;
    if (wbc != null && wbc >= 100) out.push({ level: sub.includes("cll") && !sub.some((x) => /aml|all|apl/.test(x)) ? "amber" : "red", go: "emerg",
      text: sub.includes("cll") && !sub.some((x) => /aml|all|apl/.test(x)) ? `WBC ${wbc} in CLL: leukostasis is rare in CLL even >400, but watch K (pseudohyperkalemia) and TLS with treatment.` : `WBC ${wbc}: hyperleukocytosis – leukostasis risk (hypoxia, confusion, vision change). Hydroxyurea, urgent hematology, TLS prevention; avoid RBC transfusion unless needed.` });
    else if (wbc != null && wbc >= 50 && leuk && !sub.includes("cll") && !sub.includes("cml")) out.push({ level: "amber", go: "emerg", text: `WBC ${wbc} in acute leukemia: leukostasis possible (especially monocytic AML) – check O2, neuro symptoms; hematology.` });
    if (wbc != null && wbc >= 100 && L.k && L.k.v >= 5.5) out.push({ level: "info", text: `K ${L.k.v} with WBC ${wbc}: could be pseudohyperkalemia – repeat on a heparin/whole blood sample (no pneumatic tube) before treating, unless ECG changes.` });
    const fib = L.fib && L.fib.v, inr = L.inr && L.inr.v;
    if (fib != null && fib < 1.5) out.push({ level: fib < 1.0 || sub.includes("apl") || (L.plt && L.plt.v < 50) ? "red" : "amber", go: "emerg",
      text: `Fibrinogen ${fib} g/L${inr ? `, INR ${inr}` : ""}${L.plt ? `, platelets ${L.plt.v}` : ""}: DIC${has(/asparaginase|pegaspargase|oncaspar|erwinia|rylaze/i) ? " or asparaginase effect" : ""}? Cryoprecipitate to keep fibrinogen >1.5, platelets >30–50; no LP/central line until corrected.` });
    if (sub.includes("apl") && !has(/tretinoin|\batra\b|vesanoid/i)) out.push({ level: "red", go: "emerg", text: "APL on the problem list but no ATRA (tretinoin) on the medication list: start ATRA now unless hematology says otherwise." });
    const dsDrug = drugs.filter((d) => /ATRA|Arsenic|IDH inhibitor|FLT3/.test(d.name));
    if (dsDrug.length) {
      const signs = [tmax != null && tmax >= 38.0 && `fever ${tmax}`, f.crRise && "rising creatinine", (sites.pneumonitis || sites.pleural || sites.pericard) && "infiltrates/effusion in the chart"].filter(Boolean);
      out.push(signs.length ? { level: "red", go: "emerg", text: `Possible differentiation syndrome on ${dsDrug.map((d) => d.name.split(" (")[0]).join(", ")} (${signs.join(", ")}): dexamethasone 10 mg IV q12h now, hematology.` }
        : { level: "info", go: "emerg", text: `${dsDrug.map((d) => d.name.split(" (")[0]).join(", ")}: watch for differentiation syndrome (fever, hypoxia, infiltrates, weight gain, AKI).` });
    }
    if ((leuk || lymph) && ((L.ldh && L.ldh.v >= 500) || (wbc != null && wbc >= 25 && leuk && sub.some((x) => /aml|all/.test(x))) || sub.includes("burkitt")) && !t.lab)
      out.push({ level: "amber", go: "emerg", text: `High tumour lysis risk (${[sub.includes("burkitt") && "Burkitt", L.ldh && L.ldh.v >= 500 && `LDH ${L.ldh.v}`, wbc >= 25 && `WBC ${wbc}`].filter(Boolean).join(", ")}): fluids, allopurinol or rasburicase (check G6PD), TLS labs every 8–12 h.` });
    if (has(/venetoclax|venclexta/i)) {
      if (has(S.azole) || has(/clarithromycin|ritonavir|cobicistat|nirmatrelvir/i)) out.push({ level: "amber", text: `Venetoclax with a strong CYP3A4 inhibitor (${meds.filter((m) => S.azole.test(m) || /clarithromycin|ritonavir|cobicistat|nirmatrelvir/i.test(m)).map((m) => m.split(" ")[0]).join(", ")}): venetoclax dose must be cut a lot (e.g. ~75% with posaconazole) – pharmacy/hematology.` });
      const vs = (f.meds || []).filter((m) => /venetoclax|venclexta/i.test(m.text) && m.t).map((m) => m.t).sort()[0];
      if (vs && now - vs < 35 * DAY) out.push({ level: "amber", go: "emerg", text: `Venetoclax started ~${Math.round((now - vs) / DAY)} days ago (ramp-up): TLS labs before and 6–8 h and 24 h after each new dose, hydration, allopurinol.` });
    }
    if (has(/vincristine|oncovin|chop|epoch|cvp/i) && has(/posaconazole|voriconazole|itraconazole|ketoconazole/i)) out.push({ level: "red", text: "Vincristine with an azole (posaconazole/voriconazole/itraconazole): severe neurotoxicity and ileus – change the azole (e.g. to an echinocandin) around vincristine doses; ask pharmacy." });
    const hdmtx = drugs.find((d) => /Methotrexate \(high-dose/.test(d.name));
    if (hdmtx) {
      const bad = meds.filter((m) => S.mtxInteract.test(m));
      if (f.crRise) out.push({ level: "red", text: `High-dose methotrexate with a creatinine rise (${f.crRise.from} → ${f.crRise.to}): check methotrexate level now; leucovorin per nomogram; glucarpidase if delayed clearance; hematology/pharmacy.` });
      if (bad.length) out.push({ level: "amber", text: `High-dose methotrexate with ${bad.map((m) => m.split(" ")[0]).join(", ")}: slows clearance – stop or swap (PPI → H2 blocker or none; no NSAIDs, TMP-SMX or penicillins) until the level is cleared.` });
    }
    if (has(/mercaptopurine|purinethol|6-?mp\b|thioguanine/i) && has(S.xo)) out.push({ level: "red", text: "Mercaptopurine/thioguanine with allopurinol or febuxostat: life-threatening myelosuppression unless the thiopurine dose is cut to ~25–33% – check with hematology/pharmacy." });
    const btk = drugs.find((d) => /BTK inhibitor/.test(d.name));
    if (btk && has(S.warfarin)) out.push({ level: "red", text: "BTK inhibitor with warfarin: avoid (major bleeding) – discuss switching anticoagulant with hematology." });
    else if (btk && (has(S.anticoag) || has(S.antiplatelet))) out.push({ level: "amber", text: `BTK inhibitor with ${[has(S.anticoag) && "an anticoagulant", has(S.antiplatelet) && "an antiplatelet"].filter(Boolean).join(" and ")}: higher bleeding risk; hold the BTK inhibitor 3–7 days around procedures.` });
    const cd20 = drugs.find((d) => /Anti-CD20/.test(d.name));
    if (cd20 && L.alt && L.alt.v >= 120) out.push({ level: "amber", text: `ALT ${L.alt.v} on anti-CD20 therapy: check HBV DNA, HBsAg (hepatitis B reactivation) as well as drug causes.` });
    else if (cd20 && !has(S.hbv)) out.push({ level: "info", text: "Rituximab/obinutuzumab: confirm HBsAg and anti-HBc were checked; prophylaxis (entecavir/tenofovir) if either is positive." });
    const pjpNeed = drugs.filter((d) => /Bendamustine|Purine analogue|PI3K-delta|CAR-T|Blinatumomab/.test(d.name) || (/Asparaginase|Mercaptopurine/.test(d.name)));
    if (pjpNeed.length && !has(S.tmpsmx)) out.push({ level: "amber", text: `${pjpNeed.map((d) => d.name.split(" (")[0]).join(", ")}: PJP prophylaxis is usually expected (TMP-SMX or alternative) – none on the medication list.` });
    if (pjpNeed.length && !has(S.antiviral)) out.push({ level: "info", text: "Zoster/HSV prophylaxis (acyclovir or valacyclovir) is usually given with these drugs – none on the medication list." });
    if (has(/asparaginase|pegaspargase|oncaspar|erwinia|rylaze/i)) out.push({ level: "info", text: "Asparaginase: watch lipase (pancreatitis), fibrinogen, glucose, triglycerides; new headache or seizure → think cerebral venous thrombosis." });
    if (drugs.some((d) => /Bleomycin/.test(d.name))) out.push({ level: "info", text: "Bleomycin: new cough/dyspnea → stop and CT; give the lowest FiO2 that keeps sats 88–92%." });
    if (sub.includes("pcnsl") && has(S.dex) && !hdmtx) out.push({ level: "info", text: "Primary CNS lymphoma on dexamethasone: steroids before the biopsy can make it non-diagnostic – confirm the tissue diagnosis is done or ask neurosurgery/hematology before continuing." });

    // ---- myeloma ----
    const C2 = f.cancers || {};
    const imid = has(/lenalidomide|revlimid|pomalidomide|pomalyst|imnovid|thalidomide|thalomid/i);
    if (C2.myeloma) {
      const cr = L.cr && L.cr.v, kap = L.kappa && L.kappa.v, lam = L.lambda && L.lambda.v, inv = kap != null && lam != null ? Math.max(kap, lam) : null;
      if (f.crRise || (cr != null && cr > 177)) out.push({ level: "red", tk: "aki", text: `Myeloma with ${f.crRise ? `creatinine ${f.crRise.from} → ${f.crRise.to}` : `creatinine ${cr}`} µmol/L${inv != null ? ` (involved free light chain ${inv} mg/L${inv >= 500 ? ": cast nephropathy likely" : ""})` : ""}: treat as light-chain cast nephropathy until proven otherwise – serum free light chains now, IV fluids 2–3 L/day if no heart failure, stop NSAIDs/nephrotoxins, avoid IV contrast, treat calcium, hematology today (bortezomib-dexamethasone).` });
      if (has(S.nsaid)) out.push({ level: "amber", text: `Myeloma on an NSAID (${meds.filter((m) => S.nsaid.test(m)).slice(0, 2).join("; ")}): stop – high risk of AKI. Use acetaminophen, opioids, radiotherapy for bone pain.` });
      if (L.hb && L.hb.v < 80) out.push({ level: "amber", text: `Hb ${L.hb.v} g/L in myeloma (marrow infiltration, kidney failure, treatment)${has(/daratumumab|darzalex|isatuximab|sarclisa/i) ? " – on anti-CD38: tell the blood bank before crossmatch" : ""}.` });
      if (L.igg && L.igg.v < 4 && (tag("bispec").length || (tmax != null && tmax >= 38.0))) out.push({ level: "amber", text: `IgG ${L.igg.v} g/L in myeloma${tag("bispec").length ? " on a bispecific" : ""}: severe hypogammaglobulinemia – IVIG is usually given for serious or recurrent infections.` });
    } else if (L.tp && L.alb && L.tp.v - L.alb.v >= 40 && ((L.hb && L.hb.v < 110) || (f.corrCa != null && f.corrCa > 2.6) || f.crRise)) {
      out.push({ level: "info", text: `Globulin gap ${Math.round(L.tp.v - L.alb.v)} g/L (total protein ${L.tp.v} − albumin ${L.alb.v}) with ${[L.hb && L.hb.v < 110 && `Hb ${L.hb.v}`, f.corrCa != null && f.corrCa > 2.6 && `corrected Ca ${f.corrCa}`, f.crRise && "AKI"].filter(Boolean).join(", ")}: consider myeloma – SPEP with immunofixation and serum free light chains.` });
    }
    if (L.kappa && L.lambda && L.lambda.v > 0 && !C2.myeloma) {
      const ratio = L.kappa.v / L.lambda.v;
      if (ratio >= 100 || ratio <= 0.01) out.push({ level: "amber", text: `Free light chain ratio ${ratio >= 1 ? ratio.toFixed(0) : ratio.toFixed(3)} (κ ${L.kappa.v}, λ ${L.lambda.v} mg/L): ≥100 is myeloma-defining – hematology referral.` });
    }
    if (imid && !has(S.anticoag) && !has(S.antiplatelet)) out.push({ level: "amber", text: `${meds.filter((m) => /lenalidomide|revlimid|pomalidomide|pomalyst|imnovid|thalidomide|thalomid/i.test(m)).slice(0, 1).join("")}: VTE prophylaxis is expected (ASA if low risk; LMWH or DOAC if higher risk) – none on the medication list.` });
    const mmAntiviral = drugs.filter((d) => /Bortezomib|Carfilzomib|Ixazomib|Anti-CD38|BCMA|GPRC5D/.test(d.name));
    if (mmAntiviral.length && !has(S.antiviral)) out.push({ level: "info", text: `${mmAntiviral.map((d) => d.name.split(" (")[0]).join(", ")}: zoster prophylaxis (acyclovir or valacyclovir) is usually given – none on the medication list.` });
    if (has(/daratumumab|darzalex|isatuximab|sarclisa/i)) out.push({ level: "info", text: "Anti-CD38 antibody (daratumumab/isatuximab): it makes the antibody screen and crossmatch positive for up to 6 months – tell the blood bank before any transfusion." });
    if (has(/carfilzomib|kyprolis/i) && (f.crRise || (L.trop && L.trop.v > 50))) out.push({ level: "amber", text: `Carfilzomib with ${f.crRise ? "a creatinine rise" : `troponin ${L.trop.v}`}: think cardiac toxicity (HF, ischemia) or TMA – BP, echo, NT-proBNP, smear/LDH/haptoglobin; hold and call hematology.` });
    if (has(/selinexor|xpovio/i) && L.na && L.na.v < 130) out.push({ level: "amber", tk: "hypona", text: `Na ${L.na.v} on selinexor (a known cause): hold dose, replace sodium, hematology.` });

    // ---- bladder, melanoma, head & neck, kidney, pancreas ----
    if (C2.panc) {
      const bili = L.bili && L.bili.v;
      if (bili != null && bili >= 50) out.push({ level: tmax != null && tmax >= 38.0 ? "red" : "amber", text: `Bilirubin ${bili} µmol/L in pancreatic cancer${tmax != null && tmax >= 38.0 ? ` with fever ${tmax} °C: cholangitis? Blood cultures, antibiotics, urgent ERCP/PTBD` : ": biliary obstruction or stent occlusion? US/CT, GI for ERCP (chemo waits until it falls)"}.` });
      else if (sites.biliary) out.push({ level: "amber", text: "Biliary obstruction / cholangitis in the chart: check stent patency, LFTs, cultures if febrile." });
      if (!has(S.pert)) out.push({ level: "info", text: "Pancreatic cancer with no pancreatic enzymes on the medication list: steatorrhea or weight loss → pancrelipase with meals (often stopped on admission by mistake)." });
      if (!has(S.anticoag)) out.push({ level: "info", go: "emerg", text: "Pancreatic cancer has one of the highest VTE risks: inpatient prophylaxis; low threshold to image leg swelling, dyspnea or abdominal pain (splanchnic thrombosis)." });
    }
    if (C2.hn) {
      if (sites.airway && !sites.laryngectomy) out.push({ level: "red", text: "Head and neck cancer with an airway issue in the chart (stridor / tracheostomy): bedside airway plan, ENT and anesthesia aware, spare tracheostomy tubes and obturator at the bedside." });
      if (sites.laryngectomy) out.push({ level: "red", text: "Laryngectomy (neck breather): oxygen and bag-mask to the STOMA; cannot be intubated through the mouth. Post a sign at the bedside." });
      if (sites.bleed) out.push({ level: "red", text: "Bleeding in head and neck cancer: treat any bleed as a possible sentinel (carotid) bleed – large-bore IV, crossmatch, ENT/IR now; crisis comfort plan if goals are palliative." });
      if (has(/cisplatin/i) || tag("egfrab").length) out.push({ level: "info", text: "Chemoradiation: mucositis and dysphagia peak weeks 3–7 – fluids, analgesia, feeding tube, dietitian, SLP; watch Na, K, Mg, creatinine; refeeding labs if intake was poor." });
    }
    {
      if (has(/\bbcg\b|bacillus calmette|\btice\b|oncotice/i) && tmax != null && tmax >= 38.5) out.push({ level: "red", text: `Fever ${tmax} °C after intravesical BCG: possible BCG infection (BCGosis) – cultures incl. mycobacterial, ID consult; isoniazid + rifampin + ethambutol if septic or persistent.` });
    }
    if (C2.bladder && sites.hematuria) out.push({ level: "amber", text: `Hematuria / clot retention${has(S.anticoag) ? " on an anticoagulant" : ""}: 3-way catheter and bladder irrigation, urology; Hb trend.` });
    if (sites.conduit && L.hco3 && L.hco3.v < 20) out.push({ level: "amber", text: `Bicarbonate ${L.hco3.v} with an ileal conduit/neobladder: hyperchloremic metabolic acidosis from urine reabsorption – oral bicarbonate; check for obstruction/infection.` });
    if (has(/enfortumab|padcev/i)) {
      if (L.glu && L.glu.v >= 14) out.push({ level: L.glu.v >= 20 ? "red" : "amber", text: `Glucose ${L.glu.v} on enfortumab vedotin: hyperglycemia/DKA can occur without diabetes – ketones, insulin, hold the drug.` });
      if (sites.rash) out.push({ level: "red", text: "Rash on enfortumab vedotin: check for blisters, mucosal involvement, skin pain (SJS/TEN) – hold the drug, dermatology." });
    }
    if (has(/erdafitinib|balversa/i) && L.po4 && L.po4.v >= 1.8) out.push({ level: "amber", text: `PO4 ${L.po4.v} on erdafitinib (FGFR inhibitor): low-phosphate diet, binder; dose change by oncology.` });
    const braf = drugs.filter((d) => /Dabrafenib|Encorafenib|Vemurafenib/.test(d.name));
    if (braf.length && tmax != null && tmax >= 38.0) out.push({ level: "amber", text: `Fever ${tmax} °C on ${braf.map((d) => d.name).join(", ")}: BRAF/MEK pyrexia is common – hold both drugs, still look for infection (and neutropenia); restart when afebrile 24 h.` });
    if (tag("ici").length && L.tsh && (L.tsh.v < 0.1 || L.tsh.v > 10)) out.push({ level: "amber", tk: "tox", text: `TSH ${L.tsh.v} on immunotherapy: ${L.tsh.v < 0.1 ? "thyroiditis (early thyrotoxic phase – beta-blocker; hypothyroidism often follows) or low TSH from hypophysitis (check free T4, cortisol)" : "hypothyroidism – levothyroxine (check cortisol first)"}.` });
    if (tag("ici").length && L.na && L.na.v < 135 && L.na.v >= 130) out.push({ level: "amber", text: `Na ${L.na.v} on immunotherapy: check AM cortisol, ACTH, TSH/free T4 (hypophysitis or adrenalitis) before calling it SIADH.` });
    const vegfTki = drugs.find((d) => /VEGF TKI/.test(d.name));
    if (vegfTki && has(S.nondhp)) out.push({ level: "amber", text: "VEGF TKI with diltiazem or verapamil: CYP3A4 interaction raises TKI levels – prefer amlodipine for TKI hypertension." });
    if (has(/belzutifan|welireg/i) && L.hb && L.hb.v < 90) out.push({ level: "amber", text: `Hb ${L.hb.v} on belzutifan (anemia is common; also check O2 sats – hypoxia is a known effect): transfusion/ESA, oncology to adjust dose.` });
    if (C2.melanoma && sites.brain) out.push({ level: "info", text: "Melanoma brain mets bleed: MRI for any new headache; caution with anticoagulation; lowest effective dexamethasone (steroids blunt immunotherapy)." });

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
    if (tag("vegf").length) out.push({ level: "info", text: drugs.some((d) => d.tags.includes("vegf") && /antibody|Anti-VEGF \(/.test(d.name + d.cls)) ? "Anti-VEGF drug: check BP and urine protein; hold ≥4–6 weeks before elective surgery; new abdominal pain → think perforation." : "VEGF TKI: check BP and urine protein; hold ~1–3 weeks before surgery (drug-specific); new abdominal pain → think perforation." });
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

  const api = { SUBNAME, detectCancers, findSites, corrCa, caLevel, tls, mascc, flags, handoutDefaults, note, SITES, PRIMARY };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else window.OncRules = api;
})();
