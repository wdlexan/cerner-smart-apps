/* Electrolytes tab rules: potassium, phosphate, calcium (low and high), with magnesium as a helper.
   Pure functions, no chart access, so they can be tested in node (tests/test_lytes.js).
   SI units: mmol/L, g/L, umol/L. Cut-offs, grading and doses were written by Claude from general knowledge
   and are UNVERIFIED: check against Island Health protocols, the lab's ranges and pharmacy before clinical use. */
(function () {
  const RANGES = {
    K: { lo: 3.5, hi: 5.0, t: "3.5–5.0" }, phos: { lo: 0.80, hi: 1.45, t: "0.80–1.45" },
    Ca: { lo: 2.10, hi: 2.55, t: "2.10–2.55 (total)" }, iCa: { lo: 1.12, hi: 1.32, t: "1.12–1.32" },
    Mg: { lo: 0.70, hi: 1.00, t: "0.70–1.00" }, albumin: { lo: 35, hi: 50, t: "35–50" },
    creatinine: { lo: 45, hi: 110, t: "45–110" }, glucose: { lo: 4.0, hi: 7.8, t: "4.0–7.8" },
    tCO2: { lo: 22, hi: 29, t: "22–29" }, Na: { lo: 135, hi: 145, t: "135–145" },
    CK: { hi: 200, t: "< 200" }, urate: { hi: 420, t: "< 420" }, LDH: { hi: 250, t: "< 250" },
    plt: { lo: 150, hi: 400, t: "150–400" }, wbc: { lo: 4, hi: 11, t: "4–11" },
    PTH: { lo: 1.6, hi: 6.9, t: "1.6–6.9 pmol/L" }, vitD: { lo: 75, t: "≥ 75 nmol/L" },
    uK: { t: "spot, with urine Cr" }, uCr: { t: "spot" }, QTc: { hi: 470, t: "< 450 M, < 470 F" }, weight: { t: "" }
  };
  const SEV = ["normal", "mild", "moderate", "severe"];
  const r2 = (v) => Math.round(v * 100) / 100, r1 = (v) => Math.round(v * 10) / 10;

  /* corrected total calcium: + 0.02 mmol/L for every g/L of albumin below 40 (Payne). Unreliable when albumin < 25 or in critical illness / CKD. */
  function correctedCa(ca, alb) { return ca == null || alb == null ? null : r2(ca + 0.02 * (40 - alb)); }

  /* CKD-EPI 2021 (race-free). creatinine umol/L. */
  function egfr(cr, age, sex) {
    if (cr == null || age == null || !/^(male|female)$/.test(sex || "")) return null;
    const s = cr / 88.4, f = sex === "female", k = f ? 0.7 : 0.9, a = f ? -0.241 : -0.302;
    return Math.round(142 * Math.pow(Math.min(s / k, 1), a) * Math.pow(Math.max(s / k, 1), -1.2) * Math.pow(0.9938, age) * (f ? 1.012 : 1));
  }

  /* ---- grading: { dir: "low"|"high"|"normal", sev: 0-3, key: "hypoK" etc, basis } ---- */
  function gradeK(k, x) {
    x = x || {};
    if (k == null) return null;
    if (k < 3.5) { let s = k < 2.5 ? 3 : k < 3.0 ? 2 : 1; if ((x.ecg || x.symptoms) && s < 3) s = 3; return { dir: "low", sev: s, key: "hypoK", basis: "K " + k }; }
    if (k > 5.0) { let s = k >= 6.5 ? 3 : k >= 6.0 ? 2 : 1; if (x.ecg && s < 3) s = 3; return { dir: "high", sev: s, key: "hyperK", basis: "K " + k }; }
    return { dir: "normal", sev: 0, key: "", basis: "K " + k };
  }
  function gradePhos(p, x) {
    x = x || {};
    if (p == null) return null;
    if (p < 0.80) { let s = p < 0.32 ? 3 : p < 0.65 ? 2 : 1; if (x.symptoms && s < 3) s = Math.max(s, 2); return { dir: "low", sev: s, key: "hypoPhos", basis: "PO4 " + p }; }
    if (p > 1.45) { const s = p > 3.0 ? 3 : p > 2.0 ? 2 : 1; return { dir: "high", sev: s, key: "hyperPhos", basis: "PO4 " + p }; }
    return { dir: "normal", sev: 0, key: "", basis: "PO4 " + p };
  }
  /* calcium: ionized wins; otherwise albumin-corrected total; otherwise raw total (flagged) */
  function gradeCa(v, x) {
    x = x || {};
    const corr = correctedCa(v.Ca, v.albumin);
    let basis, val, scale;
    if (v.iCa != null) { basis = "ionized"; val = v.iCa; scale = "i"; }
    else if (corr != null) { basis = "corrected"; val = corr; scale = "t"; }
    else if (v.Ca != null) { basis = "total (no albumin)"; val = v.Ca; scale = "t"; }
    else return null;
    const out = { basis, val, corr, dir: "normal", sev: 0, key: "" };
    if (scale === "i") {
      if (val < 1.12) { out.dir = "low"; out.sev = val < 0.9 ? 3 : val < 1.0 ? 2 : 1; }
      else if (val > 1.32) { out.dir = "high"; out.sev = val >= 1.8 ? 3 : val >= 1.5 ? 2 : 1; }
    } else {
      if (val < 2.10) { out.dir = "low"; out.sev = val < 1.90 ? 3 : val < 2.0 ? 2 : 1; }
      else if (val > 2.55) { out.dir = "high"; out.sev = val >= 3.5 ? 3 : val >= 3.0 ? 2 : 1; }
    }
    if (out.dir === "low") { out.key = "hypoCa"; if ((x.ecg || x.symptoms) && out.sev < 3) out.sev = 3; }
    if (out.dir === "high") { out.key = "hyperCa"; if (x.symptoms && out.sev < 2) out.sev = 2; }
    return out;
  }
  /* magnesium: low mild 0.60–0.69, moderate 0.50–0.59, severe < 0.50; high mild 1.01–1.99, moderate 2.0–2.99, severe ≥ 3.0. Symptoms or ECG raise the grade. */
  function gradeMg(m, x) {
    x = x || {};
    if (m == null) return null;
    if (m < 0.70) { let s = m < 0.5 ? 3 : m < 0.6 ? 2 : 1; if ((x.ecg || x.symptoms) && s < 3) s = Math.max(s, 2); return { dir: "low", sev: s, key: "hypoMg", basis: "Mg " + m }; }
    if (m > 1.00) { let s = m >= 3.0 ? 3 : m >= 2.0 ? 2 : 1; if (x.symptoms && m >= 2.0) s = 3; return { dir: "high", sev: s, key: "hyperMg", basis: "Mg " + m }; }
    return { dir: "normal", sev: 0, key: "", basis: "Mg " + m };
  }

  /* ---- medications and problems that matter (name patterns UNVERIFIED; generic and common Canadian brand names) ---- */
  const MEDS = {
    acei: /\b\w+pril\b|altace|coversyl|vasotec|zestril|accupril/i,
    arb: /\b\w+sartan\b|entresto|sacubitril|cozaar|diovan|atacand|micardis|avapro/i,
    mra: /spironolactone|eplerenone|finerenone|aldactone|inspra|kerendia/i,
    ksparing: /amiloride|triamterene|moduret/i,
    tmp: /trimethoprim|co-?trimoxazole|septra|bactrim|sulfamethoxazole/i,
    nsaid: /ibuprofen|naproxen|ketorolac|diclofenac|celecoxib|indomethacin|meloxicam|ketoprofen|advil|aleve|toradol|celebrex|arthrotec/i,
    heparin: /heparin|enoxaparin|dalteparin|tinzaparin|lovenox|fragmin|innohep/i,
    cni: /tacrolimus|cyclosporin|advagraf|prograf|envarsus|neoral/i,
    bb: /\b\w+olol\b|carvedilol|labetalol/i,
    digoxin: /digoxin|lanoxin|toloxin/i,
    ksupp: /potassium chloride|\bkcl\b|k-?dur|slow-?k|micro-?k|k-?lyte|potassium (citrate|bicarbonate|phosphate)/i,
    kbinder: /zirconium|lokelma|patiromer|veltassa|polystyrene|kayexalate|k-?exit/i,
    loop: /furosemide|bumetanide|torsemide|ethacrynic|lasix|burinex/i,
    thiazide: /hydrochlorothiazide|\bhctz\b|chlorthalidone|indapamide|metolazone|chlorthalidone|lozide|hygroton/i,
    insulin: /insulin|lispro|aspart|glulisine|glargine|detemir|degludec|humalog|novorapid|lantus|basaglar|tresiba|toujeo|humulin|novolin/i,
    beta2: /salbutamol|albuterol|terbutaline|ventolin|bricanyl/i,
    ampho: /amphotericin|ambisome/i,
    steroid: /fludrocortisone|hydrocortisone|prednisone|methylprednisolone|dexamethasone|florinef/i,
    laxative: /bisacodyl|senna|sennoside|picosulfate|pico-?salax|polyethylene glycol|peg ?3350|lactulose|docusate|magnesium citrate/i,
    phosLaxative: /sodium phosphate|fleet|phosphate enema|phospho-?soda/i,
    phosSupp: /phosphate novartis|phosphates? novartis|k-?phos|potassium phosphate|sodium phosphate|glycerophosphate/i,
    ivIron: /ferric carboxymaltose|ferinject|iron sucrose|venofer|ferric derisomaltose|monoferric|iron dextran/i,
    binder: /sevelamer|renvela|lanthanum|fosrenol|calcium acetate|sucroferric|velphoro|aluminum hydroxide/i,
    caSupp: /calcium carbonate|calcium citrate|tums|caltrate|os-?cal|calcium gluconate|calcium chloride/i,
    vitD: /cholecalciferol|vitamin d|ergocalciferol|calcitriol|rocaltrol|alfacalcidol|one-?alpha|d-?vi-?sol/i,
    calcitriol: /calcitriol|rocaltrol|alfacalcidol|one-?alpha/i,
    lithium: /lithium|carbolith|lithane/i,
    antiresorptive: /zoledronic|zoledronate|aclasta|zometa|pamidronate|aredia|alendronate|fosamax|risedronate|actonel|denosumab|prolia|xgeva|ibandronate/i,
    cinacalcet: /cinacalcet|sensipar|etelcalcetide|parsabiv/i,
    pth: /teriparatide|forteo|abaloparatide|tymlos/i,
    ppi: /prazole\b|\w+prazole|pantoloc|nexium|losec|pariet|dexilant|tecta/i,
    foscarnet: /foscarnet/i,
    cisplatin: /cisplatin/i,
    aminoglyc: /gentamicin|tobramycin|amikacin/i,
    antiepileptic: /phenytoin|phenobarbital|carbamazepine|dilantin/i,
    tenofovir: /tenofovir|truvada|descovy|biktarvy|genvoya|stribild/i,
    mgLoad: /magnesium (hydroxide|citrate|sulfate|sulphate|oxide|glucoheptonate|gluconate|chloride|lactate)|milk of magnesia|citro-?mag|pico-?salax|rougier|\bmgso4\b/i,
    egfrInh: /cetuximab|panitumumab|erbitux|vectibix/i,
    pentamidine: /pentamidine/i,
    sglt2: /empagliflozin|dapagliflozin|canagliflozin|jardiance|forxiga|invokana|synjardy|xigduo/i
  };
  function classifyMeds(names) {
    const out = {}; Object.keys(MEDS).forEach((k) => (out[k] = []));
    (names || []).forEach((n) => Object.keys(MEDS).forEach((k) => { if (MEDS[k].test(n) && out[k].indexOf(n) === -1) out[k].push(n); }));
    // a phosphate enema is not a phosphate supplement; IV calcium gluconate is not chronic calcium intake but still counts
    out.phosSupp = out.phosSupp.filter((n) => !MEDS.phosLaxative.test(n) || /tablet|novartis|iv|infusion/i.test(n));
    return out;
  }
  const PROB = {
    ckd: /chronic kidney|\bckd\b|N18|end.?stage renal|esrd|eskd|dialysis|Z99\.2|Z49/i,
    dialysis: /dialysis|hemodialysis|haemodialysis|peritoneal dialysis|Z99\.2|Z49|esrd|esk?d/i,
    hf: /heart failure|\bchf\b|\bhfref\b|\bhfpef\b|I50/i,
    af: /atrial fibrillation|atrial flutter|I48/i,
    cad: /coronary|myocardial infarction|\bcad\b|I2[0-5]/i,
    cirrhosis: /cirrhosis|K70\.3|K74/i,
    alcohol: /alcohol|F10|K70/i,
    malnutrition: /malnutrition|cachexia|anorexia nervosa|eating disorder|bulimia|E4[0-6]|F50|refeeding/i,
    malignancy: /cancer|carcinoma|malignan|lymphoma|leukemia|leukaemia|myeloma|metasta|sarcoma|C[0-9]{2}/i,
    myeloma: /myeloma|C90/i,
    lymphoma: /lymphoma|C8[1-6]/i,
    granuloma: /sarcoid|tuberculosis|D86|A15/i,
    hyperpara: /hyperparathyroid|E21\.[0-3]/i,
    hypopara: /hypoparathyroid|E20|thyroidectomy|parathyroidectomy|E89\.2/i,
    diabetes: /diabet|E1[0-4]/i,
    dka: /ketoacidosis|\bdka\b|E1[0-4]\.1/i,
    adrenal: /adrenal insufficiency|addison|E27\.[1-4]/i,
    pancreatitis: /pancreatitis|K85/i,
    rhabdo: /rhabdomyolysis|M62\.82|T79\.6/i,
    tls: /tumou?r lysis|E88\.3/i,
    sepsis: /sepsis|septic|A41/i,
    vomiting: /vomit|gastroenteritis|diarrh|bowel obstruction|ileus|high.?output stoma|K56|A0[89]|R11/i,
    thyrotox: /thyrotoxic|hyperthyroid|graves|E05/i,
    hypothyroid: /hypothyroid|E03/i,
    seizure: /seizure|epilepsy|G40/i
  };
  function classifyProblems(texts) {
    const out = {}; Object.keys(PROB).forEach((k) => (out[k] = []));
    (texts || []).forEach((t) => Object.keys(PROB).forEach((k) => { if (PROB[k].test(t) && out[k].indexOf(t) === -1) out[k].push(t); }));
    return out;
  }

  /* ---- possible causes found in THIS patient (meds, problems, labs). Each: { text, why } ---- */
  function causesFor(key, v, m, p) {
    const c = [], add = (cond, text, why) => { if (cond && cond.length !== 0 && cond !== false) c.push({ text, why: Array.isArray(why) ? why.join(", ") : why || "" }); };
    const lowMg = v.Mg != null && v.Mg < 0.7, eg = v.eGFR;
    if (key === "hypoK") {
      add(m.loop.concat(m.thiazide), "Diuretic (loop or thiazide)", m.loop.concat(m.thiazide));
      add(lowMg, "Low magnesium (K stays low until Mg is replaced)", "Mg " + v.Mg);
      add(m.insulin.concat(m.beta2), "Shift into cells (insulin, salbutamol)", m.insulin.concat(m.beta2));
      add(p.vomiting, "GI loss (vomiting, diarrhea, stoma)", p.vomiting);
      add(m.laxative, "Laxatives", m.laxative);
      add(p.malnutrition.concat(p.alcohol), "Refeeding / poor intake / alcohol", p.malnutrition.concat(p.alcohol));
      add(p.dka, "DKA treatment (insulin drives K in)", p.dka);
      add(m.ampho, "Amphotericin (renal loss)", m.ampho);
      add(m.steroid, "Corticosteroid / mineralocorticoid effect", m.steroid);
      add(v.tCO2 != null && v.tCO2 > 29, "Metabolic alkalosis (vomiting, diuretics, high aldosterone)", "total CO2 " + v.tCO2);
      add(v.tCO2 != null && v.tCO2 < 22, "Metabolic acidosis with low K: think RTA, diarrhea, DKA", "total CO2 " + v.tCO2);
      if (v.uK != null && v.uCr != null && v.uCr > 0) { const r = r1(v.uK / v.uCr); add(true, r > 1.5 ? "Urine K:Cr " + r + " mmol/mmol: kidney losing K" : "Urine K:Cr " + r + " mmol/mmol: kidney holding K (GI loss, shift or poor intake)", "spot urine"); }
    }
    if (key === "hyperK") {
      add(eg != null && eg < 30, "Low kidney function (eGFR " + eg + ")", "");
      add(v.crRise, "Creatinine rising (AKI)", v.crRise);
      add(m.acei.concat(m.arb), "ACE inhibitor / ARB / ARNI", m.acei.concat(m.arb));
      add(m.mra.concat(m.ksparing), "MRA / potassium-sparing diuretic", m.mra.concat(m.ksparing));
      add(m.tmp, "Trimethoprim (blocks ENaC)", m.tmp);
      add(m.nsaid, "NSAID", m.nsaid);
      add(m.heparin, "Heparin / LMWH (low aldosterone)", m.heparin);
      add(m.cni, "Calcineurin inhibitor", m.cni);
      add(m.bb, "Beta-blocker (minor shift)", m.bb);
      add(m.digoxin, "Digoxin (toxicity raises K: check level)", m.digoxin);
      add(m.ksupp, "Potassium supplement", m.ksupp);
      add(p.dka.length || (v.glucose != null && v.glucose > 20) ? ["x"] : [], "Insulin deficiency / hyperglycemia", v.glucose != null ? "glucose " + v.glucose : p.dka);
      add(v.tCO2 != null && v.tCO2 < 22, "Metabolic acidosis", "total CO2 " + v.tCO2);
      add(p.rhabdo.length || (v.CK != null && v.CK > 5000) ? ["x"] : [], "Rhabdomyolysis / tissue breakdown", v.CK != null ? "CK " + v.CK : p.rhabdo);
      add(p.tls.length || (p.malignancy.length && v.urate != null && v.urate > 476) ? ["x"] : [], "Tumour lysis", v.urate != null ? "urate " + v.urate : p.tls);
      add(p.adrenal, "Adrenal insufficiency", p.adrenal);
      add((v.plt != null && v.plt > 500) || (v.wbc != null && v.wbc > 50), "Possible pseudohyperkalemia (very high platelets or WBC): repeat as plasma K", [v.plt != null ? "plt " + v.plt : "", v.wbc != null ? "WBC " + v.wbc : ""].filter(Boolean));
    }
    if (key === "hypoPhos") {
      add(p.malnutrition.concat(p.alcohol), "Refeeding / malnutrition / alcohol", p.malnutrition.concat(p.alcohol));
      add(p.dka.length || m.insulin.length ? ["x"] : [], "Insulin / DKA treatment (shift into cells)", p.dka.concat(m.insulin));
      add(m.ivIron, "IV iron (ferric carboxymaltose causes FGF23-mediated phosphate loss)", m.ivIron);
      add(m.binder.concat(m.caSupp.filter((n) => /carbonate|acetate/i.test(n))), "Phosphate binder or calcium carbonate", m.binder.concat(m.caSupp.filter((n) => /carbonate|acetate/i.test(n))));
      add(m.tenofovir.concat(m.foscarnet, m.cisplatin), "Proximal tubule loss (tenofovir, foscarnet, cisplatin)", m.tenofovir.concat(m.foscarnet, m.cisplatin));
      add(p.hyperpara.length || (v.PTH != null && v.PTH > 6.9) ? ["x"] : [], "High PTH (primary or secondary hyperparathyroidism)", v.PTH != null ? "PTH " + v.PTH : p.hyperpara);
      add(v.vitD != null && v.vitD < 50, "Vitamin D deficiency", "25-OH D " + v.vitD);
      add(p.sepsis, "Sepsis / respiratory alkalosis", p.sepsis);
      add(lowMg, "Low magnesium (often travels with low PO4)", "Mg " + v.Mg);
    }
    if (key === "hyperPhos") {
      add(eg != null && eg < 30, "Low kidney function (eGFR " + eg + ")", "");
      add(v.crRise, "Creatinine rising (AKI)", v.crRise);
      add(p.tls.length || (p.malignancy.length && v.urate != null && v.urate > 476) ? ["x"] : [], "Tumour lysis", v.urate != null ? "urate " + v.urate : p.tls);
      add(p.rhabdo.length || (v.CK != null && v.CK > 5000) ? ["x"] : [], "Rhabdomyolysis", v.CK != null ? "CK " + v.CK : p.rhabdo);
      add(m.phosLaxative, "Phosphate enema / bowel prep", m.phosLaxative);
      add(m.phosSupp, "Phosphate supplement", m.phosSupp);
      add(m.calcitriol, "Active vitamin D", m.calcitriol);
      add(p.hypopara, "Hypoparathyroidism / post-neck surgery", p.hypopara);
      add(v.tCO2 != null && v.tCO2 < 18, "Metabolic acidosis (DKA, lactic) shifts PO4 out", "total CO2 " + v.tCO2);
      add(m.ampho.filter((n) => /liposom|ambisome/i.test(n)), "Liposomal amphotericin: assay artefact (pseudohyperphosphatemia)", m.ampho);
    }
    if (key === "hypoCa") {
      add(v.albumin != null && v.albumin < 30 && v.iCa == null, "Low albumin: total calcium reads low. Order an ionized calcium", "albumin " + v.albumin);
      add(lowMg, "Low magnesium (blocks PTH release and action): replace first", "Mg " + v.Mg);
      add(p.hypopara, "Hypoparathyroidism / after thyroid or parathyroid surgery", p.hypopara);
      add(v.PTH != null && v.PTH < 1.6, "Low PTH with low calcium: hypoparathyroidism (or low Mg)", "PTH " + v.PTH);
      add(v.vitD != null && v.vitD < 50, "Vitamin D deficiency", "25-OH D " + v.vitD);
      add(eg != null && eg < 30, "CKD (low calcitriol, high phosphate)", "eGFR " + eg);
      add(v.phos != null && v.phos > 1.8, "High phosphate binding calcium", "PO4 " + v.phos);
      add(m.antiresorptive, "Bisphosphonate / denosumab (worse with CKD or low vitamin D)", m.antiresorptive);
      add(m.cinacalcet, "Cinacalcet / etelcalcetide", m.cinacalcet);
      add(m.foscarnet, "Foscarnet (chelates ionized calcium)", m.foscarnet);
      add(m.loop, "Loop diuretic (calciuria)", m.loop);
      add(m.antiepileptic, "Enzyme-inducing antiepileptic (vitamin D)", m.antiepileptic);
      add(m.ppi, "PPI (via low magnesium)", m.ppi);
      add(p.pancreatitis, "Pancreatitis", p.pancreatitis);
      add(p.sepsis, "Sepsis / critical illness", p.sepsis);
      add(p.tls.length || p.rhabdo.length ? ["x"] : [], "Tumour lysis / early rhabdomyolysis", p.tls.concat(p.rhabdo));
    }
    if (key === "hypoMg") {
      add(m.ppi, "PPI (long-term use lowers gut Mg absorption)", m.ppi);
      add(m.loop.concat(m.thiazide), "Loop or thiazide diuretic", m.loop.concat(m.thiazide));
      add(p.alcohol, "Alcohol (intake, kidney loss, diarrhea)", p.alcohol);
      add(p.vomiting, "GI loss (diarrhea, high-output stoma, malabsorption)", p.vomiting);
      add(m.laxative.filter((n) => !MEDS.mgLoad.test(n)), "Laxatives", m.laxative.filter((n) => !MEDS.mgLoad.test(n)));
      add(m.aminoglyc.concat(m.ampho, m.cisplatin, m.cni, m.foscarnet, m.pentamidine, m.egfrInh), "Kidney-wasting drug (aminoglycoside, amphotericin, cisplatin, calcineurin inhibitor, foscarnet, pentamidine, cetuximab/panitumumab)", m.aminoglyc.concat(m.ampho, m.cisplatin, m.cni, m.foscarnet, m.pentamidine, m.egfrInh));
      add(p.malnutrition, "Refeeding / malnutrition", p.malnutrition);
      add(p.dka.length || m.insulin.some((n) => /infusion|drip/i.test(n)) ? ["x"] : [], "DKA treatment / insulin (shift into cells, osmotic loss)", p.dka);
      add(p.pancreatitis, "Pancreatitis", p.pancreatitis);
      add(p.hyperpara.length && v.phos != null && v.phos < 0.8 ? ["x"] : [], "Hungry bone after parathyroidectomy", p.hyperpara);
      add(p.diabetes, "Diabetes (glycosuria increases Mg loss)", p.diabetes);
    }
    if (key === "hyperMg") {
      add(eg != null && eg < 30, "Low kidney function (eGFR " + eg + "): cannot excrete Mg", "");
      add(v.crRise, "Creatinine rising (AKI)", v.crRise);
      add(m.mgLoad, "Magnesium intake (laxative, antacid, bowel prep, supplement or IV magnesium sulfate)", m.mgLoad);
      add(m.lithium, "Lithium", m.lithium);
      add(p.tls.length || p.rhabdo.length ? ["x"] : [], "Cell breakdown (tumour lysis, rhabdomyolysis)", p.tls.concat(p.rhabdo));
      add(p.dka, "DKA before insulin (shift out of cells)", p.dka);
      add(p.hypothyroid.concat(p.adrenal), "Hypothyroidism / adrenal insufficiency", p.hypothyroid.concat(p.adrenal));
      add(v.Ca != null && v.Ca > 2.55 && v.PTH != null && v.PTH >= 2.5 ? ["x"] : [], "Mild high Mg with high Ca and PTH: FHH or hyperparathyroidism", "Ca " + v.Ca);
    }
    if (key === "hyperCa") {
      add(v.PTH != null && v.PTH >= 2.5, "PTH not suppressed: PTH-mediated (primary or tertiary hyperparathyroidism, lithium, FHH)", "PTH " + v.PTH);
      add(v.PTH != null && v.PTH < 2.5, "PTH suppressed: look for malignancy, vitamin D, granuloma, milk-alkali", "PTH " + v.PTH);
      add(p.hyperpara, "Known hyperparathyroidism", p.hyperpara);
      add(p.malignancy, "Malignancy (PTHrP, bone metastases)", p.malignancy);
      add(p.myeloma, "Myeloma", p.myeloma);
      add(p.granuloma.concat(p.lymphoma), "Granulomatous disease / lymphoma (calcitriol made outside the kidney)", p.granuloma.concat(p.lymphoma));
      add(m.thiazide, "Thiazide (reduces calcium excretion)", m.thiazide);
      add(m.caSupp, "Calcium supplement (milk-alkali if with alkalosis and AKI)", m.caSupp);
      add(m.vitD, "Vitamin D / calcitriol", m.vitD);
      add(m.lithium, "Lithium", m.lithium);
      add(m.pth, "Teriparatide / abaloparatide", m.pth);
      add(p.thyrotox, "Thyrotoxicosis", p.thyrotox);
      add(p.adrenal, "Adrenal insufficiency", p.adrenal);
      add(v.tCO2 != null && v.tCO2 > 29 && m.caSupp.length ? ["x"] : [], "Milk-alkali pattern: calcium intake + metabolic alkalosis", "total CO2 " + v.tCO2);
    }
    return c;
  }

  /* ---- patient-specific treatment lines: { text, tier: "now"|"next"|"also", calc } ---- */
  const DOSE_NOTE = "Doses are typical adult starting doses: confirm with Island Health protocol and pharmacy.";
  function treatment(key, sev, v, x, m, p) {
    x = x || {};
    const t = [], add = (tier, text) => t.push({ tier, text });
    const w = v.weight, eg = v.eGFR, renal = (eg != null && eg < 30) || x.dialysis || p.dialysis.length > 0;
    const lowMg = v.Mg != null && v.Mg < 0.7, po = !x.npo;
    const mgLine = () => add(sev >= 2 || (v.Mg != null && v.Mg < 0.6) ? "now" : "next", "Magnesium " + v.Mg + ": magnesium sulfate " + (v.Mg < 0.6 && !renal ? "5 g in 100 mL NS IV (max 2 g/h; slower keeps more, e.g. over 5 h)" : "2 g in 50 mL NS IV over 1–2 h") + (renal ? " (eGFR < 30 or dialysis: 50% dose, so 2 g, then recheck)" : "") + ", or PO magnesium if mild and eating. Low Mg must be fixed for K and Ca to correct.");

    if (key === "hypoK") {
      /* local replacement sheet (R. Wanbon PharmD, Dec 2014): 100–200 mEq raises K ~1 mmol/L in acute loss (up to 400 in chronic loss);
         KCl 10 mEq/100 mL peripheral bags, each over at least 30 min; KCl 20 mEq/50 mL and 40 mEq/100 mL central only (rate per IV manual);
         PO: K-Dur 20 mEq SR, Slow-K 8 mEq SR (level ≥ 4 h after), KCl elixir 1.33 mEq/mL (dilute; level 1–2 h after), K citrate 25 mEq (40% as effective). */
      if (lowMg) mgLine();
      const tgt = m.digoxin.length || p.af.length || p.hf.length || p.cad.length ? 4.0 : 3.5;
      if (v.K != null && v.K < tgt) { const d = tgt - v.K; add("also", "Rough need to reach " + tgt.toFixed(1) + ": " + Math.round(d * 100) + "–" + Math.round(d * 200) + " mEq if acute loss (100–200 mEq per 1 mmol/L), up to " + Math.round(d * 400) + " mEq if chronic; ongoing losses add to this." + (renal ? " Halve with eGFR < 30." : "")); }
      if (sev === 3) {
        add("now", "Cardiac monitor and 12-lead ECG (U waves, ST depression, QT/QU prolongation, ectopy).");
        add("now", "IV KCl: peripheral = KCl 10 mEq/100 mL bags, each over at least 30 min (e.g. 4 bags = 40 mEq, then recheck); central line = KCl 20 mEq/50 mL or 40 mEq/100 mL, rate per the IV manual, on a cardiac monitor." + (po ? " Add K-Dur 20 mEq × 2 tabs (40 mEq) PO at the same time if able to swallow." : ""));
        add("now", "If IV fluid is needed: premixed KCl 20 or 40 mEq/L in 1 L (saline-based, not dextrose; ½NS + KCl must be mixed by pharmacy).");
      } else if (sev === 2) {
        add("now", "ECG if K < 2.8, heart disease or digoxin.");
        add("now", po ? "K-Dur 20 mEq: 2 tabs (40 mEq) PO BID–TID today; or KCl elixir 1.33 mEq/mL 30 mL (40 mEq), diluted, if tablets are a problem." : "KCl 10 mEq/100 mL IV peripheral × 4 bags (40 mEq), each over at least 30 min, then recheck.");
      } else {
        add("now", po ? "K-Dur 20 mEq: 1–2 tabs PO BID (40–80 mEq/day) until ≥ 3.5 (≥ 4.0 if AF, ischemia, heart failure or digoxin). Potassium citrate 25 mEq tabs are easier to take but only about 40% as effective as KCl." : "Premixed KCl 20 mEq/L in maintenance IV fluid, or KCl 10 mEq/100 mL IV × 2 bags.");
      }
      if (renal) add("now", "eGFR < 30 or dialysis: 50% dose reduction and recheck sooner (local sheet; rebound hyperkalemia risk).");
      if (m.loop.length || m.thiazide.length) add("also", "On a diuretic: if it continues, add a K-sparing agent (spironolactone 12.5–25 mg) or reduce the diuretic, rather than escalating KCl alone.");
      if (m.digoxin.length) add("now", "On digoxin: low K increases digoxin toxicity. Target K ≥ 4.0; check digoxin level and ECG.");
      if (p.dka.length || m.insulin.some((n) => /infusion|drip|iv/i.test(n))) add("now", "Insulin infusion / DKA: hold insulin if K < 3.3 until replaced (per DKA protocol).");
      add("also", "Hidden losses: if K keeps falling, send urine K and creatinine (K:Cr > 1.5 mmol/mmol = kidney loss), check BP (hypertension + low K: aldosterone excess), tCO2/acid-base.");
    }

    if (key === "hyperK") {
      const pseudo = (v.plt != null && v.plt > 500) || (v.wbc != null && v.wbc > 50);
      if (pseudo) add("now", "Very high platelets or WBC: this may be pseudohyperkalemia. Repeat as plasma K (heparin tube, gas analyser) if no ECG changes.");
      if (sev === 3) {
        add("now", "Cardiac monitor and 12-lead ECG now (peaked T, wide QRS, loss of P waves, bradycardia, sine wave).");
        if (x.ecg) add("now", "ECG changes: calcium gluconate 10% 30 mL (3 g) IV over 5–10 min; repeat in 5 min if ECG still abnormal. Calcium chloride 10% 10 mL only via a central line or in arrest. Works in minutes, lasts 30–60 min, does not lower K.");
        else add("now", "If the ECG shows changes: calcium gluconate 10% 30 mL (3 g) IV over 5–10 min, repeat if changes persist.");
      }
      if (sev >= 2) {
        const gl = v.glucose;
        add("now", "Shift K into cells: insulin regular " + (renal ? "5 units" : "10 units") + " IV + " + (gl != null && gl >= 14 ? "no dextrose (glucose " + gl + " ≥ 14)" : "dextrose 25 g (D50W 50 mL)") + ". Lowers K ~0.6–1.0 mmol/L within 30–60 min for 4–6 h." + (renal ? " (5 units because eGFR < 30 or dialysis: hypoglycemia risk)" : ""));
        add("now", "Capillary glucose every hour for 6 h" + (renal ? "; consider D10W 50 mL/h for 5 h after the bolus" : "") + ".");
        add("now", "Salbutamol 10–20 mg nebulized over 10 min (adds ~0.5–1.0 mmol/L; less effect on beta-blockers; caution with tachyarrhythmia or ischemia).");
        if (v.tCO2 != null && v.tCO2 < 22) add("next", "Metabolic acidosis (tCO2 " + v.tCO2 + "): sodium bicarbonate helps only with acidosis; e.g., isotonic bicarbonate (150 mmol in 1 L D5W) if volume deplete, or 50–100 mmol IV. Not a stand-alone treatment.");
      }
      add(sev >= 2 ? "now" : "next", "Remove K: sodium zirconium cyclosilicate (Lokelma) " + (sev >= 2 ? "10 g PO TID for up to 48 h" : "10 g PO daily") + ", or patiromer (Veltassa) 8.4 g PO daily (slower onset; separate other meds by 3 h). Sodium polystyrene (Kayexalate) 15–30 g is an older option with a bowel necrosis risk.");
      if (!x.dialysis && !p.dialysis.length) add(sev >= 2 ? "now" : "next", "If not volume depleted and passing urine: furosemide 40–80 mg IV" + (eg != null && eg < 30 ? " (higher doses may be needed with low eGFR)" : "") + ". If dry: IV fluid (Ringer's lactate or saline) to restore urine output.");
      if (renal || v.crRise) add(sev >= 2 ? "now" : "next", "Dialysis if K stays ≥ 6.5 or ECG changes persist despite treatment, with oliguric AKI, or on dialysis already: call nephrology early.");
      const culprits = [].concat(m.ksupp, m.acei, m.arb, m.mra, m.ksparing, m.tmp, m.nsaid, m.heparin);
      if (culprits.length) add("now", "Hold or review: " + culprits.join("; ") + ".");
      if (m.digoxin.length) add("now", "On digoxin: check a digoxin level; if toxic with high K or arrhythmia, digoxin immune Fab (DigiFab) via poison centre / pharmacy.");
      if (sev < 2) add("next", "Low-K diet (dietitian); review the cause.");
    }

    if (key === "hypoPhos") {
      /* local replacement sheet (R. Wanbon PharmD, Dec 2014): IV over 4–6 h; 15 mmol × 2 if PO4 < 0.3, or < 0.5 in a patient ≥ 60 kg; 15 mmol otherwise.
         Peripheral OK: KPO4 15 mmol PO4 + 22 mmol K in 255 mL; NaPO4 15 mmol + 20 mmol Na in 125 mL; NaPO4 30 mmol + 40 mmol Na in 260 mL.
         Central only: KPO4 15 mmol in 125 mL; KPO4 30 mmol + 44 mmol K in 255 mL. PO: 16–32 mmol/day (diarrhea above 32). 50% dose with GFR < 30. */
      const k = v.K, useNa = (k != null && k >= 5.0) || (renal && (k == null || k >= 4.5));
      const big = v.phos != null && (v.phos < 0.3 || (v.phos < 0.5 && w != null && w >= 60));
      let mmol = big ? 30 : 15; const halved = renal && mmol === 30; if (halved) mmol = 15;
      const why = big ? "PO4 " + v.phos + (v.phos < 0.3 ? " < 0.3" : " < 0.5 and weight " + w + " kg ≥ 60") : "PO4 " + v.phos + (v.phos < 0.5 && w == null ? " (enter weight: 30 mmol if < 0.5 and ≥ 60 kg)" : "");
      const prod = useNa
        ? (mmol === 30 ? "NaPO4 30 mmol (40 mmol Na) in 260 mL IV over 4–6 h, peripheral OK" : "NaPO4 15 mmol (20 mmol Na) in 125 mL IV over 4–6 h, peripheral OK") + " — sodium salt because " + (k != null && k >= 5.0 ? "K " + k + " ≥ 5.0" : "eGFR < 30 or dialysis" + (k != null ? " with K " + k : ", K unknown"))
        : (mmol === 30 ? "KPO4 15 mmol (22 mmol K) in 255 mL IV over 4–6 h, peripheral OK, × 2 (30 mmol; 44 mmol K). Central line: one bag of KPO4 30 mmol / 44 mmol K in 255 mL over 4–6 h" : "KPO4 15 mmol (22 mmol K) in 255 mL IV over 4–6 h, peripheral OK") + (k != null ? " (K " + k + ")" : " (check K first)");
      const ivLine = "IV phosphate " + mmol + " mmol (" + why + (halved ? "; 50% dose for eGFR < 30" : "") + "): " + prod + ". Not in the same line as calcium.";
      const poLine = "PO phosphate 16–32 mmol/day: sodium phosphate oral solution 4 mmol/mL, 4 mL PO BID (32 mmol/day); or skim milk (8 mmol per 250 mL). Diarrhea is common above 32 mmol/day." + (renal ? " eGFR < 30: half dose." : "");
      if (sev === 3 || x.symptoms) {
        add("now", ivLine);
        add("now", "Severe low phosphate can cause respiratory muscle weakness, failure to wean, rhabdomyolysis, hemolysis and heart failure: check CK and look for weakness.");
        if (po) add("next", "Then, once eating: " + poLine);
      } else if (sev === 2) {
        add("now", po ? poLine + " If not eating, ventilated or < 0.5: IV instead." : ivLine);
        if (po) add("next", "IV alternative: " + ivLine);
      } else {
        add("now", po ? "Dietary phosphate (skim milk 8 mmol per 250 mL, protein); " + poLine.replace("PO phosphate", "PO phosphate if refeeding risk, ventilated or weak:") : ivLine.replace("): ", ", only if refeeding risk or symptoms): "));
      }
      if (v.Ca != null && (v.corrCa || v.Ca) > 2.55) add("now", "Calcium is high: IV phosphate can precipitate calcium phosphate. Discuss before giving IV.");
      if (lowMg) mgLine();
      if (p.malnutrition.length || p.alcohol.length) add("now", "Refeeding risk: thiamine 100 mg IV/PO before and during feeding, start feeds slowly (10–20 kcal/kg/day), daily PO4, K and Mg for 3–5 days; dietitian.");
      if (m.ivIron.length) add("also", "Recent IV iron (ferric carboxymaltose): low PO4 can last weeks; consider iron sucrose or ferric derisomaltose next time.");
    }

    if (key === "hyperPhos") {
      if (p.tls.length || (p.malignancy.length && v.urate != null && v.urate > 476)) add("now", "Possible tumour lysis: urate, K, Ca, LDH, creatinine every 6–8 h; IV fluid to urine output 80–100 mL/h; rasburicase (check G6PD first) or allopurinol per oncology; nephrology early.");
      if (v.crRise || (eg != null && eg < 15)) add("now", "AKI or eGFR < 15 with high phosphate: discuss dialysis if PO4 is rising, with symptomatic low calcium, or with other dialysis indications.");
      else if (sev >= 2) add("now", "Kidneys working: IV saline increases phosphate excretion (if volume allows); levels usually fall within 6–12 h once intake stops.");
      if (v.Ca != null) { const ca = v.corrCa != null ? v.corrCa : v.Ca, prod = r2(ca * v.phos); if (prod > 4.4) add("now", "Calcium × phosphate product " + prod + " mmol²/L² (> 4.4): risk of calcium phosphate deposition. Give IV calcium only for symptoms (tetany, seizure, arrhythmia)."); }
      if (m.phosLaxative.length || m.phosSupp.length) add("now", "Stop: " + m.phosLaxative.concat(m.phosSupp).join("; ") + ".");
      if (eg != null && eg < 60) add("next", "CKD: phosphate binder with meals: " + (v.corrCa != null && v.corrCa > 2.5 ? "sevelamer 800 mg TID (calcium already high-normal)" : "calcium carbonate 500 mg elemental TID with meals, or sevelamer 800 mg TID") + "; renal dietitian (low phosphate diet).");
      else add("next", "Find the source: intake (enema, supplements), cell breakdown (CK, urate, LDH), vitamin D, low PTH.");
    }

    if (key === "hypoCa") {
      const pseudo = v.iCa == null && v.albumin != null && v.Ca != null && correctedCa(v.Ca, v.albumin) >= 2.10;
      if (pseudo) add("now", "Corrected calcium is normal (" + correctedCa(v.Ca, v.albumin) + "): low albumin, probably not true hypocalcemia. Order an ionized calcium before treating.");
      if (lowMg) mgLine();
      if (sev === 3) {
        add("now", "Cardiac monitor and ECG (long QT). Look for tetany, perioral tingling, carpopedal spasm, laryngospasm, seizure.");
        add("now", "Calcium gluconate 10% 10–20 mL (1–2 g) IV in 50–100 mL D5W over 10–20 min. Then infusion: 10 g calcium gluconate (100 mL of 10%) in 1 L D5W or saline" + (w != null ? ", start 50 mL/h (≈ " + Math.round(50 * 0.93 / w * 10) / 10 + " mg elemental Ca/kg/h for " + w + " kg)" : ", start 50 mL/h (≈ 0.5–1.5 mg elemental Ca/kg/h)") + "; titrate to ionized Ca every 4–6 h.");
        add("now", "Not in the same line as bicarbonate or phosphate. Calcium chloride only by central line (vein injury).");
        if (m.digoxin.length) add("now", "On digoxin: give IV calcium slowly with monitoring.");
        if (v.phos != null && v.phos > 2.0) add("now", "Phosphate " + v.phos + " is high: precipitation risk. Give IV calcium for symptoms only and treat the phosphate.");
      } else if (!pseudo) {
        add("now", po ? "Calcium carbonate 500–1000 mg elemental PO BID–TID with meals (calcium citrate if on a PPI)." : "If not eating: calcium gluconate 1–2 g IV over 1–2 h, then recheck.");
        if (v.vitD != null && v.vitD < 50) add("now", "Vitamin D3 (cholecalciferol) 1000–2000 IU daily (or a loading regimen) for 25-OH D " + v.vitD + ".");
        else if (v.vitD == null) add("next", "Check 25-OH vitamin D; start D3 1000–2000 IU daily if low.");
      }
      if (p.hypopara.length || (v.PTH != null && v.PTH < 1.6)) add("now", "Hypoparathyroidism (or after neck surgery): calcitriol 0.25–0.5 mcg PO BID plus calcium; check calcium twice daily at first; endocrinology.");
      if (eg != null && eg < 30) add("next", "CKD: calcitriol and binder choice with nephrology; correct only if symptomatic or severe (vascular calcification risk).");
      if (m.antiresorptive.some((n) => /denosumab|prolia|xgeva|zoledron|zometa|aclasta/i.test(n))) add("also", "After denosumab or zoledronic acid low calcium can last weeks: calcium + vitamin D, and check before the next dose.");
      add("next", "Send if not done: Mg, PO4, PTH, 25-OH D, creatinine, ionized Ca. Low PTH = hypoparathyroid or low Mg; high PTH = vitamin D deficiency, CKD, or PO4 load.");
    }

    if (key === "hypoMg") {
      const torsades = x.ecg || (v.QTc != null && v.QTc >= 500);
      /* local replacement sheet (R. Wanbon PharmD, Dec 2014): MgSO4 2 g (8 mmol) in 50 mL NS or 5 g (20 mmol) in 100 mL NS; max 2 g/h, slower keeps more; 5 g if Mg < 0.6.
         PO target 20 mmol/day divided (diarrhea above 20): Mg 250 mg elemental tab (≈ 10 mmol) BID; Mg glucoheptonate (Mg Rougier) 30 mL (6 mmol) TID. 50% dose with GFR < 30. */
      if (sev === 3 && (torsades || x.symptoms)) add("now", "Torsades, seizure or arrhythmia: magnesium sulfate 2 g IV over 10–15 min (1–2 min if pulseless; 2 g vials are in crash carts and select units, restricted indications), cardiac monitor; then as below.");
      if (v.Mg != null && v.Mg < 0.6) add("now", renal ? "Magnesium sulfate 2 g in 50 mL NS IV over at least 1 h (50% dose for eGFR < 30 or dialysis), recheck before more." : "Magnesium sulfate 5 g in 100 mL NS IV, no faster than 2 g/h (at least 2.5 h; over 4–5 h keeps more). " + (sev === 3 ? "A second dose is often needed: tissue stores refill slowly and much of IV Mg is lost in the urine." : ""));
      else add("now", po ? "PO magnesium, target 20 mmol/day divided: magnesium 250 mg elemental tab BID, or Mg glucoheptonate (Mg Rougier) 30 mL PO TID; diarrhea above 20 mmol/day." + (renal ? " eGFR < 30: half dose." : "") + " Or magnesium sulfate 2 g IV over at least 1 h if needed quickly (low K or Ca, arrhythmia, QT)." : "Magnesium sulfate 2 g in 50 mL NS IV over at least 1 h" + (renal ? " (eGFR < 30: give it, then recheck before more)" : "") + ".");
      if (v.K != null && v.K < 3.5) add("now", "K " + v.K + " is low too: replace Mg with K, or K will not correct.");
      if ((v.corrCa != null ? v.corrCa : v.Ca) != null && (v.corrCa != null ? v.corrCa : v.Ca) < 2.10) add("now", "Calcium is low too: replace Mg first (low Mg blocks PTH).");
      if (m.ppi.length) add("next", "On a PPI (" + m.ppi[0] + "): stop or step down if no firm indication; Mg often stays low until it is stopped.");
      if (m.loop.length || m.thiazide.length) add("also", "Ongoing diuretic loss: amiloride or spironolactone reduces kidney Mg loss.");
      if (p.alcohol.length || p.malnutrition.length) add("now", "Alcohol / malnutrition: thiamine 100 mg before glucose or feeding; check PO4 and K (refeeding).");
      add("also", "If the cause is unclear: urine Mg and creatinine (fractional excretion of Mg > 2–4% with low serum Mg = kidney loss; < 2% = GI loss or intake).");
    }

    if (key === "hyperMg") {
      add(sev >= 2 ? "now" : "next", "Stop all magnesium: " + (m.mgLoad.length ? m.mgLoad.join("; ") : "laxatives, antacids, enemas, supplements, IV magnesium") + ".");
      if (sev === 3) {
        add("now", "Calcium gluconate 10% 10–20 mL (1–2 g) IV over 10 min: antagonizes Mg at the heart and nerves (repeat if hypotension, arrhythmia or breathing problems return). Cardiac monitor.");
        add("now", "Check airway and breathing (respiratory depression and paralysis above ~5 mmol/L): be ready to ventilate. Check reflexes: loss of patellar reflexes is the early warning.");
      }
      if (sev >= 2) {
        if (renal || v.crRise) add("now", "Kidneys cannot clear Mg (eGFR " + (v.eGFR != null ? v.eGFR : "low") + (v.crRise ? ", AKI" : "") + "): nephrology for dialysis if Mg ≥ 3 with symptoms, or rising.");
        else add("now", "Kidneys working: IV 0.9% saline plus furosemide 20–40 mg IV increases Mg excretion (if volume allows).");
      } else add("now", "Mild and no symptoms: stop intake; it falls on its own if kidneys work.");
    }

    if (key === "hyperCa") {
      const ca = v.corrCa != null ? v.corrCa : v.Ca, hf = p.hf.length > 0;
      if (sev >= 2) {
        add("now", "IV 0.9% saline: " + (hf || renal ? "careful boluses of 250–500 mL with reassessment (heart failure or low eGFR)" : "1 L/h for the first 2–3 h, then 200–300 mL/h (about 4–6 L in 24 h)") + ", aiming for urine output 100–150 mL/h. Most patients are dry.");
        add("now", "Calcitonin 4 units/kg SC or IM every 12 h" + (w != null ? " (≈ " + Math.round(4 * w / 10) * 10 + " units for " + w + " kg)" : "") + " for 48–72 h at most: works in hours, then tachyphylaxis. Bridge until the bisphosphonate works.");
        if (eg == null || eg >= 30) add("now", "Zoledronic acid 4 mg IV over at least 15 min (effect 2–4 days, lasts weeks), or for cancer-related hypercalcemia denosumab 120 mg SC (Endocrine Society 2023 suggests denosumab over a bisphosphonate). Alternative: pamidronate 60–90 mg IV over 2–4 h. Check vitamin D first if possible; watch for low Ca and PO4 afterwards.");
        else add("now", "eGFR " + eg + " (< 30): bisphosphonates need dose reduction or are avoided; denosumab 120 mg SC (lower doses used in severe CKD: discuss) does not need renal adjustment but causes more low calcium. Discuss with nephrology/oncology.");
        if (p.granuloma.length || p.lymphoma.length || m.vitD.length) add("now", "Granuloma, lymphoma or vitamin D excess: prednisone 40–60 mg PO daily lowers calcitriol.");
        if (sev === 3 || (renal && ca > 3.5)) add("now", "Calcium > 3.5–4.0 with confusion, AKI or unable to take fluids: dialysis (low-calcium bath) with nephrology.");
        add("next", "Furosemide only after volume is restored and only for fluid overload (not to lower calcium).");
      } else {
        add("now", "Oral fluids (2–3 L/day if able), mobilize, stop calcium-raising drugs; usually no urgent IV treatment if no symptoms.");
      }
      const stop = [].concat(m.thiazide, m.caSupp, m.vitD, m.lithium, m.pth);
      if (stop.length) add("now", "Stop or hold: " + stop.join("; ") + ".");
      add("next", "First test: PTH (with Ca). High or normal PTH → PTH-mediated (primary HPT; urine Ca/Cr clearance ratio < 0.01 suggests FHH). Low PTH → PTHrP, 25-OH D, 1,25-(OH)2 D, SPEP + serum free light chains, ALP, TSH, CXR / CT for cancer.");
    }
    return t;
  }

  /* ---- when to repeat labs: rows { when, what, src } ; src "UKKA 2023", "SfE 2016" etc. or "practice" (common practice, no guideline interval) ---- */
  const SOURCES = {
    UKKA: { label: "UK Kidney Association hyperkalaemia guideline 2023", url: "https://ukkidney.org/wp-content/uploads/drupal-archive/FINAL%20VERSION%20-%20UKKA%20CLINICAL%20PRACTICE%20GUIDELINE%20-%20MANAGEMENT%20OF%20HYPERKALAEMIA%20IN%20ADULTS%20-%20191223.pdf" },
    SFE_HYPER: { label: "Society for Endocrinology emergency guidance: acute hypercalcaemia (2016)", url: "https://www.endocrinology.org/media/4277/emergency-guidance_acute-hypercalcaemia-in-adults.pdf" },
    ES2023: { label: "Endocrine Society guideline: hypercalcemia of malignancy (JCEM 2023)", url: "https://doi.org/10.1210/clinem/dgac621" },
    SFE_HYPO: { label: "Society for Endocrinology emergency guidance: acute hypocalcaemia (2016)", url: "https://doi.org/10.1530/EC-16-0056" },
    LOCAL: { label: "Local electrolyte replacement sheet (R. Wanbon, PharmD, Dec 2014)", url: "" },
    practice: { label: "Common practice: no guideline sets this interval", url: "" } };
  function recheck(key, sev, v, x, m, p, val) {
    const r = [], add = (when, what, src) => r.push({ when, what, src: src || "practice" });
    const renal = (v.eGFR != null && v.eGFR < 30) || x.dialysis || p.dialysis.length > 0;
    if (key === "hyperK") {
      const pseudo = (v.plt != null && v.plt > 500) || (v.wbc != null && v.wbc > 50);
      if (pseudo) add("Now", "Repeat K as plasma (heparin tube) or on a blood gas before more treatment, unless ECG changes.");
      if (sev >= 2 || x.ecg) {
        add("1, 2, 4, 6 and 24 h after treatment", "Serum K (rebound when insulin wears off at 4–6 h; aim K < 6.0 at 2 h).", "UKKA");
        add("0, 15, 30, 60, 90, 120, 180, 240, 300, 360 min", "Capillary glucose for at least 6 h after insulin-glucose" + (renal ? " (higher hypoglycemia risk with low eGFR)" : "") + ".", "UKKA");
        add("Continuous", "Cardiac monitor while K ≥ 6.5, with ECG changes, or K 6.0–6.4 and unwell or rising; repeat 12-lead ECG after calcium.", "UKKA");
        add("Daily until stable", "Creatinine and urine output, plus K after any binder or drug change.");
      } else {
        add(v.crRise || renal ? "Within 6–12 h" : "Within 24 h (24–72 h if stable and cause clear)", "Serum K, creatinine; sooner if rising, AKI or new K-raising drug.");
      }
    }
    if (key === "hypoK") {
      if (sev === 3) { add("1–2 h after each 40 mEq IV", "Serum K (and Mg if replacing).", "practice"); add("Every 4–6 h until K > 3.0", "Serum K; then daily."); add("Continuous", "Cardiac monitor during fast IV replacement or with ECG changes."); }
      else if (sev === 2) { add("At least 4 h after K-Dur / Slow-K (1–2 h after elixir)", "Serum K (with Mg): SR tablets release K over 4–8 h.", "LOCAL"); add("Next morning, then daily", "K, Mg, creatinine while on replacement or diuretic."); }
      else add("Next morning, then daily while on KCl or diuretic (at least 4 h after an SR dose)", "K and Mg.", "LOCAL");
      if (renal) add("Sooner (2–4 h after each dose)", "eGFR < 30 or dialysis: rebound high K risk.");
    }
    if (key === "hypoPhos") {
      if (sev >= 2 || x.symptoms) add("2 h after the IV dose ends, if acute", "PO4 (plus K if KPO4). A level about 72 h later reflects stores better, and repeat levels are often unnecessary.", "LOCAL");
      add(sev === 1 ? "Next morning" : "Then daily while replacing", "PO4, K, Mg until normal and stable.");
      if (p.malnutrition.length || p.alcohol.length) add("Daily for the first 3–5 days of feeding", "PO4, K, Mg (refeeding).");
    }
    if (key === "hyperPhos") {
      if (p.tls.length || (p.malignancy.length && v.urate != null && v.urate > 476)) add("Every 6–8 h", "PO4, K, Ca, urate, creatinine, LDH (tumour lysis).");
      else if (v.crRise || sev >= 2) add("Every 12–24 h", "PO4, Ca, creatinine, K.");
      else add("Next routine bloods (days to weeks if chronic CKD)", "PO4 and Ca with creatinine.");
    }
    if (key === "hypoCa") {
      if (sev === 3) {
        add("1–2 h after an IV bolus", "Ionized or corrected Ca; repeat the bolus if still symptomatic.", "practice");
        add("Every 4–6 h on infusion", "Ionized Ca to titrate the infusion; continuous ECG while symptomatic or on digoxin. (SfE: titrate to normocalcemia; interval not set.)", "SFE_HYPO");
      } else add("Daily", "Calcium (ionized if albumin low), Mg, PO4.");
      if (p.hypopara.length) add("Every 12 h for 24–48 h after neck surgery", "Calcium; then daily.");
      add("After discharge", "Weekly calcium until stable on oral calcium / vitamin D, then every 3–6 months.");
    }
    if (key === "hypoMg") {
      add("At least 1 h after the IV dose (next day is fine)", "Mg with K and Ca. An early level overestimates stores; a level 72 h after the dose is more accurate.", "LOCAL");
      add("Daily while replacing", "Mg, K, Ca.");
      if (renal) add("Before every repeat dose", "Mg (eGFR < 30 or dialysis: risk of high Mg).");
      if (x.ecg || (v.QTc != null && v.QTc >= 500)) add("Continuous; repeat ECG after Mg", "Cardiac monitor until QT shortens and no torsades.");
    }
    if (key === "hyperMg") {
      if (sev === 3) { add("Every 4–6 h", "Mg, Ca, K, creatinine until below 2.0."); add("Every hour", "Patellar reflexes, respiratory rate, BP and level of consciousness (as in obstetric magnesium protocols)."); }
      else if (sev === 2) add("Every 12–24 h", "Mg and creatinine; check reflexes each shift.");
      else add("Next routine bloods", "Mg and creatinine after stopping intake.");
    }
    if (key === "hyperCa") {
      const hi = sev === 3 || x.symptoms || (val != null && (v.iCa != null ? val >= 1.8 : val >= 3.5));
      if (hi) {
        add("6 h after starting IV saline, then every 6–12 h until falling and symptoms improve", "Corrected (or ionized) Ca, creatinine, K, Na.");
        add("Every shift", "Fluid balance, weight, chest exam (4–6 L saline in 24 h: watch for overload, especially elderly or low eGFR).", "SFE_HYPER");
      } else if (sev === 2) add("Every 12–24 h while on IV fluid", "Corrected Ca, creatinine, K.");
      else add("24–48 h (1 week if outpatient, no symptoms)", "Corrected Ca, creatinine; PTH if not done.");
      if (sev >= 2) {
        add("Daily during treatment", "Mg, PO4 and K (saline diuresis lowers K and Mg).");
        add("Day 2–4 after bisphosphonate or denosumab", "Calcium nadir is at 2–4 days: check for low Ca, PO4 and Mg; after denosumab keep checking through the first 1–2 weeks.", "SFE_HYPER");
        add("Stop calcitonin after 48–72 h", "Tachyphylaxis; it is only a bridge.", "ES2023");
      }
    }
    return r;
  }

  /* ---- red flags across all three (and Mg) ---- */
  function flags(v, x, m, p, g) {
    const f = [], add = (lvl, text) => f.push({ lvl, text });
    const k = g.K, ph = g.phos, ca = g.Ca;
    if (k && k.key === "hyperK" && k.sev === 3) add("urgent", "K " + v.K + (x.ecg ? " with ECG changes" : "") + ": life-threatening hyperkalemia. Monitor, ECG, calcium if ECG changes, insulin + dextrose now.");
    else if (k && k.key === "hyperK" && k.sev === 2) add("action", "K " + v.K + ": moderate hyperkalemia. ECG and shift + remove today.");
    if (k && k.key === "hypoK" && k.sev === 3) add("urgent", "K " + v.K + (x.ecg || x.symptoms ? " with ECG changes or symptoms" : "") + ": severe hypokalemia. Monitor and IV replacement.");
    if (k && k.dir !== "normal" && m.digoxin.length) add("urgent", "Abnormal K on digoxin (" + m.digoxin[0] + "): arrhythmia risk. Check digoxin level and ECG.");
    if (ca && ca.key === "hypoCa" && ca.sev === 3) add("urgent", "Calcium " + ca.basis + " " + ca.val + ": severe or symptomatic hypocalcemia. IV calcium gluconate, monitor.");
    if (ca && ca.key === "hyperCa" && ca.sev === 3) add("urgent", "Calcium " + ca.basis + " " + ca.val + ": hypercalcemic crisis range. IV saline, calcitonin, bisphosphonate.");
    else if (ca && ca.key === "hyperCa" && ca.sev === 2) add("action", "Calcium " + ca.basis + " " + ca.val + ": moderate hypercalcemia. IV fluid and workup today.");
    if (ph && ph.key === "hypoPhos" && ph.sev === 3) add("urgent", "PO4 " + v.phos + " (< 0.32): severe hypophosphatemia. IV phosphate; watch breathing and weakness.");
    if (ph && ph.key === "hypoPhos" && (p.malnutrition.length || p.alcohol.length || (v.K != null && v.K < 3.5 && v.Mg != null && v.Mg < 0.7)))
      add("action", "Refeeding pattern (low PO4" + (v.K != null && v.K < 3.5 ? ", low K" : "") + (v.Mg != null && v.Mg < 0.7 ? ", low Mg" : "") + (p.malnutrition.length || p.alcohol.length ? ", poor intake / alcohol on problem list" : "") + "): thiamine, slow feeds, daily lytes.");
    if (k && k.key === "hyperK" && ph && ph.key === "hyperPhos" && (p.malignancy.length || (v.urate != null && v.urate > 476)))
      add("urgent", "High K + high PO4" + (ca && ca.dir === "low" ? " + low Ca" : "") + (v.urate != null ? " (urate " + v.urate + ")" : "") + ": think TUMOUR LYSIS. Fluids, rasburicase/allopurinol, nephrology.");
    if (v.CK != null && v.CK > 5000 && ((k && k.dir === "high") || (ph && ph.dir === "high"))) add("action", "CK " + v.CK + " with high K or PO4: rhabdomyolysis. IV fluids, watch K and creatinine.");
    if (v.crRise && k && k.dir === "high") add("action", "Creatinine rising (" + v.crRise + ") with high K: AKI. Stop K-raising drugs, look for obstruction and volume status.");
    if (v.Mg != null && v.Mg < 0.7 && ((k && k.dir === "low") || (ca && ca.dir === "low"))) add("action", "Mg " + v.Mg + ": low magnesium keeps K and Ca low. Replace Mg first or at the same time.");
    if (v.Mg != null && v.Mg < 0.5) add("action", "Mg " + v.Mg + " (< 0.5): severe; arrhythmia and seizure risk.");
    if (g.Mg && g.Mg.key === "hyperMg" && g.Mg.sev === 3) add("urgent", "Mg " + v.Mg + (x.symptoms ? " with symptoms" : "") + ": severe hypermagnesemia. Stop all Mg, calcium gluconate, check reflexes and breathing.");
    if (g.Mg && g.Mg.key === "hyperMg" && m.mgLoad.length && ((v.eGFR != null && v.eGFR < 30) || v.crRise)) add("action", "Magnesium-containing drug with low or falling kidney function (" + m.mgLoad[0] + "): stop it.");
    if ((v.plt != null && v.plt > 500 || v.wbc != null && v.wbc > 50) && k && k.dir === "high" && !x.ecg) add("info", "Platelets or WBC very high: K may be falsely high. Repeat as plasma K before treating aggressively.");
    if (ca && ca.basis === "corrected" && v.albumin != null && v.albumin < 25) add("info", "Albumin " + v.albumin + " g/L: corrected calcium is unreliable this low. Use ionized calcium.");
    if (ca && ca.basis === "total (no albumin)" && ca.dir !== "normal") add("info", "No albumin in the chart: calcium is uncorrected. Check albumin or ionized calcium.");
    if (v.iCa != null && v.Ca != null && v.albumin != null) { const c = correctedCa(v.Ca, v.albumin); if ((c < 2.10) !== (v.iCa < 1.12) || (c > 2.55) !== (v.iCa > 1.32)) add("info", "Corrected total (" + c + ") and ionized (" + v.iCa + ") disagree: the ionized value is used."); }
    if (v.Ca != null && v.phos != null) { const prod = r2((v.corrCa != null ? v.corrCa : v.Ca) * v.phos); if (prod > 4.4) add("action", "Ca × PO4 product " + prod + " mmol²/L² (> 4.4): calcification risk; IV calcium only for symptoms."); }
    const lowAny = (k && k.dir === "low") || (ca && ca.dir === "low") || (v.Mg != null && v.Mg < 0.7);
    if (v.QTc != null && v.QTc >= 500 && lowAny) add("urgent", "QTc " + v.QTc + " ms with low K, Ca or Mg: torsades risk. Correct and review QT-prolonging drugs.");
    else if (v.QTc != null && v.QTc >= 470 && lowAny) add("action", "QTc " + v.QTc + " ms with low K, Ca or Mg: correct, repeat the ECG, review QT-prolonging drugs.");
    if (k && k.key === "hypoK" && (p.dka.length || m.insulin.some((n) => /infusion|drip/i.test(n))) && v.K < 3.3) add("urgent", "K " + v.K + " (< 3.3) with DKA or insulin infusion: hold insulin until K replaced (DKA protocol).");
    if (v.Kprev != null && v.K != null && Math.abs(v.K - v.Kprev.v) >= 1.0) add("action", "K changed " + (v.K > v.Kprev.v ? "up" : "down") + " by " + r1(Math.abs(v.K - v.Kprev.v)) + " since " + v.Kprev.when + ": recheck soon and look for the reason.");
    return f;
  }

  /* run everything: v = values (SI); x = { ecg, symptoms, npo, dialysis }; medNames, probTexts arrays */
  function assess(v, x, medNames, probTexts) {
    v = Object.assign({}, v); x = x || {};
    const m = classifyMeds(medNames), p = classifyProblems(probTexts);
    if (x.dialysis && !p.dialysis.length) p.dialysis.push("dialysis (ticked)");
    v.corrCa = correctedCa(v.Ca, v.albumin);
    if (v.eGFR == null) v.eGFR = egfr(v.creatinine, v.age, v.sex);
    const g = { K: gradeK(v.K, x), phos: gradePhos(v.phos, x), Ca: gradeCa(v, x), Mg: gradeMg(v.Mg, x) };
    const plans = {};
    ["K", "phos", "Ca", "Mg"].forEach((e) => {
      const gr = g[e]; if (!gr || !gr.key) return;
      plans[e] = { key: gr.key, sev: gr.sev, sevText: SEV[gr.sev], causes: causesFor(gr.key, v, m, p), treat: treatment(gr.key, gr.sev, v, x, m, p), recheck: recheck(gr.key, gr.sev, v, x, m, p, gr.val) };
    });
    return { v, g, plans, flags: flags(v, x, m, p, g), meds: m, prob: p, doseNote: DOSE_NOTE };
  }

  const api = { RANGES, SEV, SOURCES, recheck, correctedCa, egfr, gradeK, gradePhos, gradeCa, gradeMg, classifyMeds, classifyProblems, causesFor, treatment, flags, assess, MEDS, PROB };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else window.LytesRules = api;
})();
