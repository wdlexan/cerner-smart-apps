/* PDF text -> candidate FHIR items for the Hospitalist Toolkit. Pure functions (browser or node). UNVERIFIED draft written by Claude.
   Nothing here is sent anywhere. Every item is shown to the physician to tick, correct or reject before it is used.
   Lab names are matched from a built-in list; LOINC codes in it are unverified (tools also match by display name). */
(function (root) {
  const L = (key, re, loinc, display, unit, o) => Object.assign({ key, re: new RegExp(re, "ig"), loinc, display, unit }, o || {});
  const TXT = { text: true };
  /* order matters only for display; overlaps are resolved by position and length */
  const LABS = [
    L("hba1c", "hemoglobin\\s*a1c|haemoglobin\\s*a1c|hba1c|glycated hemoglobin", "4548-4", "Hemoglobin A1c", "%"),
    L("hgb", "hemoglobin|haemoglobin|\\bhgb\\b|\\bhb\\b", "718-7", "Hemoglobin", "g/L"),
    L("hct", "hematocrit|haematocrit|\\bhct\\b", "4544-3", "Hematocrit", "L/L"),
    L("wbc", "white blood cells?(?: count)?|white cell count|leukocytes?|\\bwbc\\b", "6690-2", "White blood cell count", "x10^9/L"),
    L("anc", "absolute neutrophils?|neutrophils?\\s*(?:abs|#)|\\banc\\b|neutrophils?", "751-8", "Neutrophils", "x10^9/L"),
    L("lymph", "lymphocytes?\\s*(?:abs|#)?", "731-0", "Lymphocytes", "x10^9/L"),
    L("eos", "eosinophils?", "711-2", "Eosinophils", "x10^9/L"),
    L("plt", "platelets?(?: count)?|\\bplt\\b", "777-3", "Platelet count", "x10^9/L"),
    L("rbc", "red blood cells?(?: count)?|red cell count|\\brbc\\b", "789-8", "Red blood cell count", "x10^12/L"),
    L("mcv", "\\bmcv\\b|mean corpuscular volume", "787-2", "MCV", "fL"),
    L("na", "sodium|\\bna\\b", "2951-2", "Sodium", "mmol/L"),
    L("k", "potassium|\\bk\\b", "2823-3", "Potassium", "mmol/L"),
    L("cl", "chloride", "2075-0", "Chloride", "mmol/L"),
    L("hco3", "bicarbonate|total co2|carbon dioxide|\\bhco3\\b", "1963-8", "Bicarbonate", "mmol/L"),
    L("bun", "\\bbun\\b|blood urea nitrogen|\\burea\\b", "3094-0", "Urea / BUN", "mmol/L"),
    L("creat", "creatinine", "2160-0", "Creatinine", "umol/L"),
    L("egfr", "\\begfr\\b|estimated gfr|glomerular filtration", "62238-1", "eGFR", "mL/min/1.73m2"),
    L("glucose", "glucose", "2345-7", "Glucose", "mmol/L"),
    L("ca", "calcium", "17861-6", "Calcium", "mmol/L"),
    L("mg", "magnesium", "19123-9", "Magnesium", "mmol/L"),
    L("phos", "phosphate|phosphorus", "2777-1", "Phosphate", "mmol/L"),
    L("alb", "albumin", "1751-7", "Albumin", "g/L"),
    L("tp", "total protein", "2885-2", "Total protein", "g/L"),
    L("alt", "alanine aminotransferase|\\balt\\b|\\bsgpt\\b", "1742-6", "ALT", "U/L"),
    L("ast", "aspartate aminotransferase|\\bast\\b|\\bsgot\\b", "1920-8", "AST", "U/L"),
    L("alp", "alkaline phosphatase|\\balp\\b", "6768-6", "Alkaline phosphatase", "U/L"),
    L("ggt", "gamma.?glutamyl|\\bggt\\b", "2324-2", "GGT", "U/L"),
    L("bili", "total bilirubin|bilirubin,? total|bilirubin", "1975-2", "Total bilirubin", "umol/L"),
    L("ldh", "lactate dehydrogenase|\\bldh\\b", "2532-0", "LDH", "U/L"),
    L("lipase", "lipase", "3040-3", "Lipase", "U/L"),
    L("ck", "creatine kinase|\\bck\\b|\\bcpk\\b", "2157-6", "Creatine kinase", "U/L"),
    L("urate", "uric acid|urate", "3084-1", "Uric acid", "umol/L"),
    L("crp", "c.?reactive protein|\\bcrp\\b", "1988-5", "C reactive protein", "mg/L"),
    L("esr", "sed(?:imentation)? rate|\\besr\\b", "4537-7", "Erythrocyte sedimentation rate", "mm/h"),
    L("calpro", "fecal calprotectin|faecal calprotectin|calprotectin", null, "Fecal calprotectin", "ug/g"),
    L("pct", "procalcitonin", "33959-8", "Procalcitonin", "ug/L"),
    L("lactate", "lactate|lactic acid", "2524-7", "Lactate", "mmol/L"),
    L("ferritin", "ferritin", "2276-4", "Ferritin", "ug/L"),
    L("tsat", "transferrin sat(?:uration)?|iron sat(?:uration)?|\\btsat\\b", "2502-3", "Transferrin saturation", "%"),
    L("tibc", "total iron.binding capacity|\\btibc\\b", "2500-7", "TIBC", "umol/L"),
    L("iron", "serum iron|\\biron\\b", "2498-4", "Iron", "umol/L"),
    L("b12", "vitamin b12|cobalamin|\\bb12\\b", "2132-9", "Vitamin B12", "pmol/L"),
    L("folate", "folate|folic acid", "2284-8", "Folate", "nmol/L"),
    L("vitd", "25.?hydroxy.?vitamin d|25.?oh.?vitamin d|vitamin d", "1989-3", "25-hydroxy vitamin D", "nmol/L"),
    L("inr", "\\binr\\b|international normalized ratio", "6301-6", "INR", ""),
    L("ptt", "partial thromboplastin|\\bptt\\b|\\baptt\\b", "3173-2", "PTT", "s"),
    L("fib", "fibrinogen", "3255-7", "Fibrinogen", "g/L"),
    L("ddimer", "d.?dimer", null, "D-dimer", "ug/L"),
    L("trop", "troponin\\s*[it]?|hs.?tn[it]?", "10839-9", "Troponin", "ng/L"),
    L("bnp", "nt.?pro.?bnp|\\bbnp\\b", "33762-6", "NT-proBNP / BNP", "ng/L"),
    L("tsh", "\\btsh\\b|thyroid stimulating", "3016-3", "TSH", "mIU/L"),
    L("ft4", "free t4|\\bft4\\b", "3024-7", "Free T4", "pmol/L"),
    L("chol", "total cholesterol|cholesterol", "2093-3", "Cholesterol", "mmol/L"),
    L("ldl", "\\bldl\\b", "2089-1", "LDL", "mmol/L"),
    L("hdl", "\\bhdl\\b", "2085-9", "HDL", "mmol/L"),
    L("tg", "triglycerides?", "2571-8", "Triglycerides", "mmol/L"),
    L("b2m", "beta.?2.?microglobulin|\\bb2m\\b", null, "Beta-2 microglobulin", "mg/L"),
    L("igg", "\\bigg\\b", null, "IgG", "g/L"),
    L("mprot", "m.?protein|paraprotein", null, "M-protein", "g/L"),
    L("cdiff", "c\\.? ?difficile(?: toxin)?|clostridi\\w+ difficile|clostridioides difficile|toxin [ab]", null, "C. difficile", "", TXT),
    L("tb", "quantiferon|\\bigra\\b|t-?spot|mantoux|tuberculin", null, "TB test (IGRA / skin)", "", TXT),
    L("hbsag", "hepatitis b surface antigen|\\bhbsag\\b", "5196-1", "Hepatitis B surface antigen", "", TXT),
    L("hbcab", "hepatitis b core (?:total )?antibody|anti.?hbc|\\bhbcab\\b", null, "Hepatitis B core antibody", "", TXT),
    L("hbsab", "hepatitis b surface antibody|anti.?hbs|\\bhbsab\\b", null, "Hepatitis B surface antibody", "", TXT),
    L("hcv", "hepatitis c(?: antibody)?|\\bhcv\\b", null, "Hepatitis C antibody", "", TXT),
    L("hiv", "\\bhiv\\b(?: 1\\/2)?(?: ag\\/ab)?", null, "HIV", "", TXT),
    L("vzv", "varicella(?: zoster)?(?: igg)?|\\bvzv\\b", null, "Varicella zoster IgG", "", TXT),
    L("cmv", "cytomegalovirus|\\bcmv\\b", null, "CMV", "", TXT)
  ];
  const TEXTVAL = /^[^\n\d]{0,40}?\b(not detected|non-?reactive|not immune|negative|positive|detected|reactive|indeterminate|immune|present|absent|neg|pos)\b/i;
  const NUM = /^[\s:.\-–=]*(?:\([^)]*\)\s*)?([<>]?\s?\d{1,6}(?:[.,]\d{1,4})?)\s*/;
  const UNIT = /^((?:x\s?)?(?:10\s?[\^*]\s?\d+|µ|u|m|n|p|k)?(?:g|mol|L|U|IU|iu|mmol|umol|µmol|mL|dL|mm|fL|s|%|mIU|ng|pg|ug|mg|kg|Hg)[A-Za-zµ\/\^*0-9.%]*(?:\/[A-Za-z0-9\^*.µ]+)*|%|x10\^?\d+\/L)/i;
  const RANGE = /(\d+(?:[.,]\d+)?)\s*(?:-|–|to)\s*(\d+(?:[.,]\d+)?)/;
  const FLAG = /(?:^|\s)(HH|LL|H|L|A|AA|High|Low|Critical|Abnormal)(?=\s|$|\*)/;

  const MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, sept: 8, oct: 9, nov: 10, dec: 11 };
  const DATE_RES = [
    [/\b(20\d{2}|19\d{2})[-\/.](\d{1,2})[-\/.](\d{1,2})\b/, (m) => [+m[1], +m[2] - 1, +m[3]]],
    [/\b(\d{1,2})[\s\-]([A-Za-z]{3,4})[a-z]*\.?[\s\-,]+(20\d{2}|19\d{2})\b/, (m) => [+m[3], MONTHS[m[2].toLowerCase()], +m[1]]],
    [/\b([A-Za-z]{3,4})[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(20\d{2}|19\d{2})\b/, (m) => [+m[3], MONTHS[m[1].toLowerCase()], +m[2]]],
    [/\b(\d{1,2})[\/.-](\d{1,2})[\/.-](20\d{2}|19\d{2})\b/, (m) => { const a = +m[1], b = +m[2]; return a > 12 ? [+m[3], b - 1, a] : [+m[3], a - 1, b, "ambiguous"]; }]
  ];
  function findDate(s) {
    let best = null;
    for (const [re, f] of DATE_RES) {
      const m = re.exec(s); if (!m) continue;
      const v = f(m); if (v[1] == null || isNaN(v[1])) continue;
      const d = new Date(v[0], v[1], v[2], 12); if (isNaN(d) || d.getMonth() !== v[1]) continue;
      if (!best || m.index < best.idx) best = { t: d.getTime(), idx: m.index, ambiguous: v[3] === "ambiguous" };
    }
    return best;
  }
  const iso = (t) => { const d = new Date(t); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
  const num = (s) => { s = String(s).replace(/\s/g, ""); const lt = /^[<>]/.test(s) ? s[0] : ""; s = s.replace(/^[<>]/, ""); if (/^\d+,\d{1,2}$/.test(s)) s = s.replace(",", "."); else s = s.replace(/,/g, ""); return { v: parseFloat(s), cmp: lt }; };

  const DATE_HINT = /collected|collection|specimen|drawn|reported|date of (?:service|procedure|exam|study|visit|test)|procedure date|performed|dictated|examination date|date:/i;
  function documentDate(lines) {
    for (const ln of lines.slice(0, 80)) if (DATE_HINT.test(ln)) { const d = findDate(ln); if (d) return d; }
    for (const ln of lines.slice(0, 40)) { const d = findDate(ln); if (d) return d; }
    return null;
  }

  function labItems(lines, docT, fileName) {
    const out = []; let sectionT = null;
    lines.forEach((ln, li) => {
      if (DATE_HINT.test(ln)) { const d = findDate(ln); if (d && !/\d+(?:\.\d+)?\s*(?:-|–)\s*\d/.test(ln.replace(d ? "" : "", ""))) sectionT = d; }
      const hits = [];
      LABS.forEach((def) => { def.re.lastIndex = 0; let m; while ((m = def.re.exec(ln))) { if (!m[0]) { def.re.lastIndex++; continue; } hits.push({ def, i: m.index, e: m.index + m[0].length }); } });
      hits.sort((a, b) => a.i - b.i || (b.e - b.i) - (a.e - a.i));
      const kept = []; let end = -1; hits.forEach((h) => { if (h.i >= end) { kept.push(h); end = h.e; } });
      kept.forEach((h, k) => {
        if (h.i > 45 && k === 0 && !/[:\t]|\s{2}/.test(ln.slice(Math.max(0, h.i - 3), h.i))) { /* name deep inside a sentence: keep only with a clear separator */ }
        const nextI = k + 1 < kept.length ? kept[k + 1].i : ln.length, rest = ln.slice(h.e, nextI);
        const def = h.def; let value = null, unit = "", cmp = "", text = null, tail = "";
        if (def.text) { const m = TEXTVAL.exec(rest); if (!m) return; text = m[1].replace(/^neg$/i, "Negative").replace(/^pos$/i, "Positive"); text = text[0].toUpperCase() + text.slice(1).toLowerCase(); tail = rest.slice(m[0].length); }
        else {
          const m = NUM.exec(rest); if (!m) return;
          const n = num(m[1]); if (isNaN(n.v)) return; value = n.v; cmp = n.cmp; tail = rest.slice(m[0].length);
          const um = UNIT.exec(tail); if (um) { unit = um[1]; tail = tail.slice(um[0].length); }
          if (!unit && def.unit && !/^\s*(?:\(|\[)?\s*\d/.test(tail.slice(0, 2)) ) unit = ""; // unit not stated: leave blank, flagged below
        }
        // reference range and flag in the rest of this cell
        let low = null, high = null; const rm = RANGE.exec(tail);
        if (rm && !def.text) { low = num(rm[1]).v; high = num(rm[2]).v; if (!(low <= high)) { low = high = null; } }
        const lt = /[<≤]\s*(\d+(?:[.,]\d+)?)/.exec(tail), gt = /[>≥]\s*(\d+(?:[.,]\d+)?)/.exec(tail);
        if (low == null && lt && !def.text) high = num(lt[1]).v; if (low == null && gt && !def.text) low = num(gt[1]).v;
        const fm = FLAG.exec(tail); const flag = fm ? fm[1].toUpperCase() : "";
        const dm = findDate(ln); const useT = dm ? dm.t : sectionT ? sectionT.t : docT ? docT.t : null;
        out.push({ kind: "lab", key: def.key, label: def.display, value, text, cmp, unit, unitGuess: !unit ? def.unit : "", low, high, flag, loinc: def.loinc, t: useT, dateFrom: dm ? "line" : sectionT ? "section" : docT ? "document" : "none", ambiguous: !!((dm && dm.ambiguous) || (!dm && sectionT && sectionT.ambiguous)), line: ln.trim().slice(0, 200), li });
      });
    });
    return out;
  }

  function vitalItems(lines, docT) {
    const out = [];
    lines.forEach((ln, li) => {
      const add = (o) => out.push(Object.assign({ kind: "vital", t: (findDate(ln) || docT || {}).t || null, line: ln.trim().slice(0, 200), li }, o));
      let m;
      if ((m = /(?:\bBP\b|blood pressure)[:\s]*(\d{2,3})\s*\/\s*(\d{2,3})/i.exec(ln))) { const s = +m[1], d = +m[2]; if (s > d && s >= 50 && s <= 280) add({ key: "bp", label: "Blood pressure", value: s, value2: d, unit: "mm[Hg]" }); }
      if ((m = /(?:\bHR\b|heart rate|pulse)[:\s]*(\d{2,3})(?!\d)/i.exec(ln))) { const v = +m[1]; if (v >= 20 && v <= 240) add({ key: "hr", label: "Heart rate", value: v, unit: "/min" }); }
      if ((m = /(?:\bRR\b|resp(?:iratory)? rate)[:\s]*(\d{1,2})(?!\d)/i.exec(ln))) { const v = +m[1]; if (v >= 4 && v <= 70) add({ key: "rr", label: "Respiratory rate", value: v, unit: "/min" }); }
      if ((m = /(?:spo2|o2 sat(?:uration)?|oxygen saturation|sat)[:\s]*(\d{2,3})\s*%/i.exec(ln))) { const v = +m[1]; if (v >= 50 && v <= 100) add({ key: "spo2", label: "Oxygen saturation", value: v, unit: "%" }); }
      if ((m = /(?:\btemp(?:erature)?\b)[:\s]*(\d{2}(?:\.\d)?)\s*°?\s*([CF])?/i.exec(ln))) { let v = +m[1]; const f = (m[2] || "").toUpperCase() === "F" || v > 50; if (f) v = Math.round(((v - 32) * 5) / 9 * 10) / 10; if (v >= 30 && v <= 43) add({ key: "temp", label: "Temperature", value: v, unit: "degC" }); }
      if ((m = /(?:\bweight\b|\bwt\b)[:\s]*(\d{2,3}(?:\.\d)?)\s*(kg|lbs?|lb)\b/i.exec(ln))) { let v = +m[1]; const u = m[2].toLowerCase(); if (u.startsWith("lb")) v = Math.round(v * 0.45359237 * 10) / 10; if (v >= 20 && v <= 400) add({ key: "wt", label: "Weight", value: v, unit: "kg" }); }
    });
    return out;
  }

  const DOSE = /\b([A-Za-z][A-Za-z\-]{2,}(?:\s+(?:[A-Z][A-Za-z\-]+|XR|SR|ER|CR))?)\s+(\d+(?:[.,]\d+)?)\s?(mg|mcg|µg|ug|g|units?|iu|ml|mL|mEq|meq)\b([^\n]{0,70})/i;
  const FREQ = /\b(daily|once daily|bid|b\.i\.d|tid|qid|q\d+h|q\d+ ?hours?|qhs|hs|prn|weekly|monthly|every \d+|po|iv|im|sc|subcut\w*|sl|pr|inh|topical|nightly|qam|od\b|twice)\b/i;
  const MED_HDR = /(?:medications?|meds\b|prescriptions?|rx\b|current medications|discharge medications|home medications)/i;
  const NOT_MED = /^(?:take|dose|total|result|range|normal|weight|height|age|bmi|sodium|potassium|creatinine|glucose|hemoglobin)$/i;
  function medItems(lines, docT) {
    const out = []; let inMeds = false, since = 0;
    lines.forEach((ln, li) => {
      if (/^\s*[A-Za-z ]{3,40}:?\s*$/.test(ln) && ln.trim().length < 40) inMeds = MED_HDR.test(ln); else if (MED_HDR.test(ln) && ln.trim().length < 60) inMeds = true; else if (/^\s*(?:allerg|assessment|plan|impression|diagnos|vitals?|labs?|history|examination)\w*\s*:?/i.test(ln)) inMeds = false;
      const m = DOSE.exec(ln); if (!m) return;
      if (!(inMeds || FREQ.test(ln))) return;
      const name = m[1].trim(); if (NOT_MED.test(name.split(/\s/)[0])) return;
      out.push({ kind: "med", key: "med", label: name, dose: m[2] + " " + m[3], text: (name + " " + m[2] + " " + m[3] + m[4]).replace(/\s+/g, " ").trim(), t: (findDate(ln) || docT || {}).t || null, line: ln.trim().slice(0, 200), li });
    });
    return out;
  }

  const ENDO = /colonoscop\w*|sigmoidoscop\w*|ileoscop\w*|pouchoscop\w*|upper endoscop\w*|esophagogastroduodenoscop\w*|\begd\b|enteroscop\w*|capsule endoscop\w*|gastroscop\w*|bronchoscop\w*|cystoscop\w*|endoscopy/i;
  const IMAGING = /\b(ct (?:scan|abdomen|chest|head|pelvis|angiogram)?|mri|magnetic resonance|ultrasound|sonograph\w*|echocardiogra\w*|x-?ray|radiograph\w*|chest film|mr enterography|ct enterography|pet(?:\/ct| scan))\b/i;
  function sectionAfter(text, re, n) { const m = re.exec(text); if (!m) return ""; return text.slice(m.index, m.index + (n || 700)).replace(/\s+/g, " ").trim(); }
  function procedureItems(lines, text, docT, fileName) {
    const out = [];
    const all = text.match(new RegExp(ENDO.source, "ig")) || [], pick = all.find((x) => !/^endoscopy$/i.test(x)) || all[0], em = pick ? [pick] : null;
    if (em) {
      const concl = sectionAfter(text, /impression|conclusion|findings|summary|diagnosis/i, 800) || text.slice(0, 800).replace(/\s+/g, " ");
      const dm = lines.map((l) => (/(date of (?:procedure|exam|service)|procedure date|performed)/i.test(l) ? findDate(l) : null)).find(Boolean) || docT;
      out.push({ kind: "procedure", key: "endo", label: em[0][0].toUpperCase() + em[0].slice(1).toLowerCase(), text: concl, t: dm ? dm.t : null, ambiguous: !!(dm && dm.ambiguous), line: ("Report mentions: " + em[0]).slice(0, 200), li: 0 });
    } else {
      const im = IMAGING.exec(text);
      if (im) {
        const concl = sectionAfter(text, /impression|conclusion|summary/i, 800) || sectionAfter(text, /findings/i, 800) || text.slice(0, 800).replace(/\s+/g, " ");
        out.push({ kind: "report", key: "imaging", label: im[0].trim().replace(/^./, (c) => c.toUpperCase()), text: concl, t: docT ? docT.t : null, ambiguous: !!(docT && docT.ambiguous), line: ("Report mentions: " + im[0]).slice(0, 200), li: 0 });
      }
    }
    return out;
  }

  const CONDITIONS = [
    ["Crohn disease", /crohn/i, "K50.9"], ["Ulcerative colitis", /ulcerative colitis|proctitis/i, "K51.9"], ["Inflammatory bowel disease", /inflammatory bowel/i, "K52.9"],
    ["Multiple myeloma", /multiple myeloma/i, "C90.00"], ["Heart failure", /heart failure|\bchf\b|\bhfref\b|\bhfpef\b/i, "I50.9"], ["COPD", /\bcopd\b|chronic obstructive/i, "J44.9"],
    ["Chronic kidney disease", /chronic kidney disease|\bckd\b/i, "N18.9"], ["Type 2 diabetes", /type 2 diabetes|\bt2dm\b|diabetes mellitus/i, "E11.9"], ["Atrial fibrillation", /atrial fibrillation|\bafib\b|\bAF\b/, "I48.91"],
    ["Hypertension", /hypertension|\bhtn\b/i, "I10"], ["Pneumonia", /pneumonia/i, "J18.9"], ["Pulmonary embolism", /pulmonary embol/i, "I26.99"], ["Deep vein thrombosis", /deep vein thrombosis|\bdvt\b/i, "I82.40"],
    ["Cirrhosis", /cirrhosis/i, "K74.60"], ["Stroke", /\bstroke\b|cerebrovascular accident|\bcva\b/i, "I63.9"], ["Dementia", /dementia/i, "F03.90"], ["Asthma", /asthma/i, "J45.909"],
    ["Anorexia nervosa", /anorexia nervosa/i, "F50.00"], ["Cancer (as stated)", /\bcarcinoma\b|\blymphoma\b|\bleukemia\b/i, "C80.1"]
  ];
  const DX_CTX = /diagnos|problem|\bdx\b|history of|\bpmh\b|\bhx\b|assessment|impression|comorbid/i, NEG = /\bno (?:history|evidence|signs?)\b|denies|negative for|rule out|\br\/o\b|family history|\bfhx\b|without/i;
  function conditionItems(lines, docT) {
    const out = [], seen = new Set();
    lines.forEach((ln, li) => {
      if (!DX_CTX.test(ln)) return;
      ln.split(/[.;]\s/).forEach((cl) => {
        if (NEG.test(cl)) return;
        CONDITIONS.forEach(([name, re, icd]) => { if (re.test(cl) && !seen.has(name)) { seen.add(name); out.push({ kind: "condition", key: "dx", label: name, icd, t: (findDate(ln) || docT || {}).t || null, line: ln.trim().slice(0, 200), li }); } });
      });
    });
    return out;
  }

  /* lines: array of strings (one per visual row). */
  function fromLines(lines, opts) {
    opts = opts || {};
    lines = lines.map((s) => String(s).replace(/ /g, " ").replace(/[ \t]+$/g, "")).filter((s) => s.trim());
    const text = lines.join("\n"), docT = documentDate(lines);
    const items = [].concat(labItems(lines, docT, opts.fileName), vitalItems(lines, docT), medItems(lines, docT), procedureItems(lines, text, docT, opts.fileName), conditionItems(lines, docT));
    const seen = new Set();
    const uniq = items.filter((it) => { const k = [it.kind, it.key, it.label, it.value, it.value2, it.text, it.t && iso(it.t)].join("|"); if (seen.has(k)) return false; seen.add(k); return true; });
    uniq.forEach((it, i) => { it.id = "i" + i; });
    return { docT: docT ? docT.t : null, docDateAmbiguous: !!(docT && docT.ambiguous), lines: lines.length, chars: text.length, text, items: uniq, fileName: opts.fileName || "" };
  }
  const fromText = (text, opts) => fromLines(String(text).split(/\r?\n/), opts);

  /* ---------- FHIR resources from accepted items ---------- */
  function tag(fileName) { return { tag: [{ system: "urn:toolkit:import", code: "pdf-import", display: "Imported from PDF: " + (fileName || "file") }] }; }
  const hash = (s) => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); };
  function toResource(it, ctx) {
    const pid = ctx.patientId, when = new Date(it.t || ctx.now).toISOString(), id = "pdf-" + hash([ctx.fileName, it.kind, it.key, it.label, it.value, it.value2, it.text, when].join("|"));
    const base = { id, status: "final", subject: { reference: "Patient/" + pid }, meta: tag(ctx.fileName) };
    if (it.kind === "lab") {
      const r = Object.assign({ resourceType: "Observation", category: [{ coding: [{ system: "http://terminology.hl7.org/CodeSystem/observation-category", code: "laboratory" }] }], code: { coding: it.loinc ? [{ system: "http://loinc.org", code: it.loinc, display: it.label }] : [], text: it.label }, effectiveDateTime: when }, base);
      if (it.text != null) r.valueString = it.text; else { r.valueQuantity = { value: it.value, unit: it.unit || "" }; if (it.cmp) r.valueQuantity.comparator = it.cmp; }
      if (it.low != null || it.high != null) r.referenceRange = [{ low: it.low != null ? { value: it.low } : undefined, high: it.high != null ? { value: it.high } : undefined }];
      if (it.flag) r.interpretation = [{ coding: [{ code: /^(HH|LL|H|L|A|AA)$/.test(it.flag) ? it.flag : /high/i.test(it.flag) ? "H" : /low/i.test(it.flag) ? "L" : "A" }] }];
      return r;
    }
    if (it.kind === "vital") {
      const cat = [{ coding: [{ system: "http://terminology.hl7.org/CodeSystem/observation-category", code: "vital-signs" }] }];
      if (it.key === "bp") return Object.assign({ resourceType: "Observation", category: cat, code: { coding: [{ system: "http://loinc.org", code: "85354-9", display: "Blood pressure panel" }], text: "Blood pressure" }, effectiveDateTime: when,
        component: [{ code: { coding: [{ system: "http://loinc.org", code: "8480-6", display: "Systolic blood pressure" }], text: "Systolic blood pressure" }, valueQuantity: { value: it.value, unit: "mm[Hg]" } }, { code: { coding: [{ system: "http://loinc.org", code: "8462-4", display: "Diastolic blood pressure" }], text: "Diastolic blood pressure" }, valueQuantity: { value: it.value2, unit: "mm[Hg]" } }] }, base);
      const L = { hr: ["8867-4", "Heart rate"], rr: ["9279-1", "Respiratory rate"], spo2: ["59408-5", "Oxygen saturation"], temp: ["8310-5", "Body temperature"], wt: ["29463-7", "Body weight"] }[it.key];
      return Object.assign({ resourceType: "Observation", category: cat, code: { coding: [{ system: "http://loinc.org", code: L[0], display: L[1] }], text: L[1] }, effectiveDateTime: when, valueQuantity: { value: it.value, unit: it.unit } }, base);
    }
    if (it.kind === "med") return { resourceType: "MedicationRequest", id, status: "active", intent: "order", subject: base.subject, meta: base.meta, authoredOn: when, medicationCodeableConcept: { text: it.text }, dosageInstruction: [{ text: it.text }] };
    if (it.kind === "procedure") return { resourceType: "Procedure", id, status: "completed", subject: base.subject, meta: base.meta, code: { text: it.label }, performedDateTime: when, note: [{ text: it.text }] };
    if (it.kind === "report") return { resourceType: "DiagnosticReport", id, status: "final", subject: base.subject, meta: base.meta, category: [{ coding: [{ code: "imaging" }] }], code: { text: it.label }, effectiveDateTime: when, issued: when, conclusion: it.text };
    if (it.kind === "condition") return { resourceType: "Condition", id, subject: base.subject, meta: base.meta, category: [{ coding: [{ system: "http://terminology.hl7.org/CodeSystem/condition-category", code: "problem-list-item" }] }], clinicalStatus: { coding: [{ system: "http://terminology.hl7.org/CodeSystem/condition-clinical", code: "active" }] }, code: { coding: [{ system: "http://hl7.org/fhir/sid/icd-10", code: it.icd, display: it.label }], text: it.label }, recordedDate: when };
    return null;
  }
  function docResource(text, ctx, docT) {
    const when = new Date(docT || ctx.now).toISOString();
    const b64 = typeof Buffer !== "undefined" ? Buffer.from(text, "utf8").toString("base64") : btoa(String.fromCharCode.apply(null, Array.from(new TextEncoder().encode(text))).replace(/[^\x00-\xff]/g, "?"));
    return { resourceType: "DocumentReference", id: "pdf-doc-" + hash(ctx.fileName + text.length), status: "current", subject: { reference: "Patient/" + ctx.patientId }, meta: tag(ctx.fileName),
      type: { coding: [{ system: "http://loinc.org", code: "34109-9", display: "Note" }], text: "Imported PDF: " + ctx.fileName }, category: [{ coding: [{ system: "http://hl7.org/fhir/us/core/CodeSystem/us-core-documentreference-category", code: "clinical-note" }] }],
      description: "Imported PDF: " + ctx.fileName, date: when, content: [{ attachment: { contentType: "text/plain", data: b64, title: ctx.fileName } }] };
  }

  root.PdfExtract = { LABS, CONDITIONS, findDate, fromLines, fromText, toResource, docResource, iso };
  if (typeof module !== "undefined" && module.exports) module.exports = root.PdfExtract;
})(typeof window !== "undefined" ? window : globalThis);
