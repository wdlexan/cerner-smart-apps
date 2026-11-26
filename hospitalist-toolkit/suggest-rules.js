/* Hospitalist Toolkit - "Which tool?" rules. UNVERIFIED draft written by Claude: check the thresholds before relying on them.
   Pure functions, no network: used by suggest.js in the browser and by tests/test_suggest.js in node.
   suggest(facts)  -> tools worth opening for this patient, each with the reasons (labs, problems, meds, words in a note).
   ask(text)       -> the same, for a question or problem typed in plain words ("Na 121 and confused", "which antibiotic for cellulitis").
   facts = { labs: { na:[{v,t,unit}], k:[…], … }, conditions:[text], meds:[text], age, text }
   Lab values are expected in Canadian SI units (mmol/L, µmol/L, ng/L); toSI() converts the common US units. */
(function (root) {
  // ---- Topics: words that point to a tool, and one line saying what the tool will give you there ----
  // Patterns are matched at the start of a word ("hyponat" matches hyponatremia/hyponatraemia).
  const TOPICS = [
    { key: "hypona", hint: "Sodium: cause work-up (SIADH, volume, drugs), safe correction limits, hypertonic saline, free water deficit, note draft",
      words: ["hyponat", "hypernat", "sodium", "low na", "high na", "siadh", "diabetes insipidus", "free water", "hypertonic saline", "3% saline", "overcorrect", "osmotic demyelin", "tolvaptan", "urea tablet"] },
    { key: "lytes", hint: "K, Mg, PO4, Ca: causes, IV/PO replacement doses from the local pharmacy sheet, when to repeat labs, infosheets",
      words: ["potassium", "hypokal", "hyperkal", "magnesium", "hypomag", "hypermag", "phosph", "hypophos", "hyperphos", "calcium", "hypocalc", "hypercalc", "electrolyte", "lytes", "refeeding", "replace k", "kcl", "k replacement", "peaked t", "tumou?r lysis", "tls"] },
    { key: "aki", hint: "AKI: pre-renal / renal / post-renal, GN and AIN work-up, expected recovery, when to call nephrology",
      words: ["aki", "acute kidney", "creatinine", "renal failure", "kidney injury", "oliguri", "anuri", "low urine", "urine output", "hydronephro", "rhabdo", "glomerulonephritis", "interstitial nephritis", "ain\\b", "contrast nephro", "dialysis"] },
    { key: "acidbase", hint: "Acid-base: step-by-step ABG/VBG reading, anion gap, delta ratio, compensation, RTA type (urine AG, urine pH, K)",
      words: ["acid base", "acidosis", "alkalosis", "anion gap", "abg", "vbg", "blood gas", "bicarb", "hco3", "low ph", "osmolar gap", "dka", "ketoacidosis", "kussmaul", "lactic acid", "rta\\b", "renal tubular", "tubular acidosis", "nagma", "normal anion gap", "non.?gap", "hyperchlor", "urine anion gap", "fanconi"] },
    { key: "chf", hint: "Heart failure: NT-proBNP by age, diuretic plan, IV to PO switch, GDMT, amyloid clues, handout",
      words: ["chf", "heart failure", "hfref", "hfpef", "adhf", "fluid overload", "volume overload", "pulmonary edema", "pulmonary oedema", "bnp", "probnp", "diures", "furosemide", "lasix", "leg swelling", "edema", "oedema", "orthopnea", "pnd\\b", "gdmt", "entresto", "low ef", "reduced ef", "cardiomyopath", "amyloid"] },
    { key: "acs", hint: "NSTEMI: who needs DAPT and which, anticoagulation, cath vs medical, type 2 MI",
      words: ["nstemi", "stemi", "acs\\b", "acute coronary", "chest pain", "chest pressure", "st depression", "troponin", "trop\\b", "type 2 mi", "myocardial infarct", "angina", "dapt", "ticagrelor", "clopidogrel", "stent", "cabg"] },
    { key: "af", hint: "AF in acute illness: rate drugs (metoprolol, diltiazem, digoxin, amiodarone), anticoagulation, when to involve IM/cardiology",
      words: ["atrial fib", "afib", "a fib", "af\\b", "rvr", "rapid ventricular", "atrial flutter", "flutter", "palpitation", "irregular", "chads", "rate control"] },
    { key: "as", hint: "Aortic stenosis: paste the echo, severity, low-flow states, who qualifies for TAVI",
      words: ["aortic stenosis", "tavi", "tavr", "valve area", "aortic valve", "systolic murmur", "murmur"] },
    { key: "echo", hint: "Echo compare: prior vs current report side by side with changes flagged",
      words: ["echo", "echocardiogram", "tte", "tee", "ejection fraction", "lvef", "compare echo"] },
    { key: "pleural", hint: "Pleural effusion: Light's criteria, fluid tests, chest tube choice and complications, when to pull the tube",
      words: ["pleural", "effusion", "thoracent", "chest tube", "chest drain", "pigtail", "empyema", "hemothorax", "pleurx", "pleurodesis", "light.?s criteria", "suction", "water seal", "air leak", "pneumothorax", "subcutaneous emphysema", "bubbl", "bronchopleural", "bpf\\b"] },
    { key: "ild", hint: "ILD: pattern, acute exacerbation work-up and treatment, drug causes, home oxygen",
      words: ["ild\\b", "interstitial", "pulmonary fibrosis", "ipf\\b", "fibrosis", "honeycomb", "ground glass", "pneumonitis", "nintedanib", "pirfenidone"] },
    { key: "acls", hint: "ACLS: code timer, rhythm algorithms, Hs and Ts, peri-arrest, post-ROSC",
      words: ["code blue", "cardiac arrest", "arrest", "acls", "cpr", "rosc", "pea\\b", "asystole", "vf\\b", "vt\\b", "ventricular tachy", "bradycard", "unstable tachy"] },
    { key: "abxmap", hint: "Antibiotic chooser: click the body site for empiric choices by allergy, MRSA/ESBL risk; reads culture screenshots",
      words: ["which antibiotic", "what antibiotic", "empiric", "cellulitis", "pneumonia", "cap\\b", "hap\\b", "aspiration", "uti\\b", "urinary tract", "pyelo", "urosepsis", "prostatitis", "cholangitis", "cholecystitis", "diverticulitis", "septic arthritis", "osteomyelitis", "meningitis", "penicillin allergy", "pcn allergy", "mrsa", "esbl", "pseudomonas", "culture and sensitiv", "c ?& ?s\\b", "sensitivities", "susceptib", "c\\.? diff"] },
    { key: "abx", hint: "Antibiotic stewardship: day count, planned duration, IV to PO switch, renal dosing, echo needed for bacteremia",
      words: ["antibiotic", "abx\\b", "how long", "duration", "iv to po", "po switch", "step.?down (to )?(oral|po)", "stop antibiotic", "bacteremia", "bacteraemia", "blood culture", "s\\.? aureus", "staph aureus", "vancomycin", "pip.?tazo", "tazocin", "ceftriaxone", "meropenem", "cefazolin"] },
    { key: "inf", hint: "Infections by site: organisms, red flags, imaging, source control, antibiotics, duration, when to call ID",
      words: ["infection", "sepsis", "septic", "source", "necrotizing", "nec fasc", "abscess", "fever", "lactate", "rigor", "dental", "sinusitis", "joint infection"] },
    { key: "fuo", hint: "Fever of unknown origin: staged work-up, HLH and Still's scores, GCA, when to get PET-CT",
      words: ["fuo\\b", "unknown origin", "unexplained fever", "prolonged fever", "persistent fever", "fever not settling", "night sweats", "drug fever", "hlh", "ferritin", "still.?s disease"] },
    { key: "asplenia", hint: "Asplenia: OPSI check, pneumonia antibiotics without a spleen, vaccines due (PCV20, MenACWY, MenB, Hib), prophylaxis and standby antibiotic",
      words: ["asplen", "hyposplen", "splenectom", "no spleen", "without a spleen", "post.?splenectomy", "opsi\\b", "howell.?jolly", "sickle cell", "hbss\\b", "z90\\.81", "d73\\.0", "capnocytophaga", "standby antibiotic", "pill in (the )?pocket", "menveo", "bexsero", "trumenba", "menacwy", "menb\\b", "prevnar", "pcv20", "pneumovax"] },
    { key: "hahabx", hint: "Hospital at Home IV antibiotics: TID-or-less options, elastomeric balls, what can go home",
      words: ["hospital at home", "hah\\b", "home iv", "opat", "elastomeric", "go home on iv", "iv at home"] },
    { key: "hah", hint: "Hospital at Home screen: does this admission qualify for HaH",
      words: ["hospital at home", "hah\\b", "virtual ward", "home instead", "admit to home"] },
    { key: "liver", hint: "Cirrhosis: MELD-Na, Child-Pugh, ascites and SBP, HRS plan, encephalopathy, nutrition, VTE prophylaxis",
      words: ["cirrho", "liver", "hepatic", "ascites", "sbp\\b", "spontaneous bacterial", "paracentes", "varice", "meld", "child.?pugh", "encephalopath", "lactulose", "rifaximin", "hepatorenal", "hrs\\b", "jaundice", "bilirubin", "alcohol.?related liver", "terlipressin"] },
    { key: "cryo", hint: "Cryoneurolysis: focal spasticity after stroke/TBI/SCI/MS, spasticity pain, knee OA, non-operative hip fracture; how to refer to the VGH spasticity clinic",
      words: ["spastic", "spasticity", "contracture", "clonus", "hemiplegic shoulder", "botulinum", "cryoneurol", "cryoneurot"] },
    { key: "sbo", hint: "Bowel obstruction: imaging and lab red flags for ischemia/perforation, NG and gastrografin, when surgery",
      words: ["sbo\\b", "bowel obstruction", "small bowel", "obstruct", "ileus", "volvulus", "ogilvie", "vomiting and distension", "distension", "closed loop", "gastrografin", "ng tube"] },
    { key: "ibd", hint: "IBD flowsheet: labs, meds and scopes over time, acute severe UC pathway, medication classes",
      words: ["crohn", "ulcerative colitis", "\\buc\\b", "ibd\\b", "colitis", "asuc", "infliximab", "vedolizumab", "ustekinumab", "adalimumab"] },
    { key: "dm", hint: "Inpatient diabetes: basal-bolus, correction scales, hypo/hyperglycemia, steroids, DKA/HHS",
      words: ["diabet", "insulin", "glucose", "sugar", "hyperglyc", "hypoglyc", "hypo\\b", "dka", "ketoacidosis", "hhs\\b", "a1c", "bolus insulin", "sliding scale", "basal.?bolus", "basal insulin", "metformin", "sglt2", "steroid.?induced"] },
    { key: "stroke", hint: "Stroke follow-up: secondary prevention, imaging and echo/holter checklist, swallow, rehab",
      words: ["stroke", "cva\\b", "tia\\b", "nihss", "hemipar", "facial droop", "aphasia", "dysarthri", "infarct on ct", "carotid"] },
    { key: "neuro", hint: "Neuro (non-stroke): GBS, myasthenia, cord compression, cauda equina, subdural, vertigo, can't-miss list",
      words: ["weakness", "weak leg", "weak arm", "gbs\\b", "guillain", "myasthen", "multiple sclerosis", "\\bms\\b relapse", "cord compression", "cauda equina", "subdural", "sdh\\b", "vertigo", "dizz", "headache", "numbness", "paresthes", "ataxi", "wernicke", "meningitis", "encephalitis"] },
    { key: "seizure", hint: "Seizure: first vs breakthrough, investigations, antiseizure drug dosing, BC driving rules",
      words: ["seizure", "epilep", "convuls", "status epilept", "post.?ictal", "levetiracetam", "keppra", "phenytoin", "valpro", "lacosamide", "driving after"] },
    { key: "dementia", hint: "Dementia work-up: type, tests, treatment; delirium vs dementia",
      words: ["dementia", "memory", "cognitive", "alzheimer", "lewy", "frontotemporal", "confus", "delirium", "moca", "mmse", "behavio", "wandering", "agitat"] },
    { key: "pd", hint: "Parkinson disease: levodopa timing, nil-by-mouth plan, drugs to avoid, non-motor problems",
      words: ["parkinson", "levodopa", "sinemet", "carbidopa", "tremor", "rigidity", "bradykines", "on.?off", "dyskines"] },
    { key: "ae", hint: "Autoimmune encephalitis: criteria, antibody panels (MitogenDx), treatment",
      words: ["autoimmune enceph", "limbic", "nmda", "lgi1", "caspr2", "psychosis new", "faciobrachial"] },
    { key: "deprx", hint: "Deprescribing: Beers, STOPP/START, STOPPFall, anticholinergic burden, renal doses, no-indication meds",
      words: ["deprescrib", "polypharm", "too many med", "(which|what) med(ication)?s? .{0,25}stop", "stop .{0,20}med(ication)?s?\\b", "med(ication)?s? to stop", "simplify (the )?med", "beers", "stopp", "anticholinergic", "renal dos", "dose adjust", "crcl", "medication review", "med rec"] },
    { key: "meds", hint: "Beers check: current meds against the AGS Beers Criteria",
      words: ["beers", "elderly med", "inappropriate med"] },
    { key: "opioid", hint: "Opioid safety: sedation and breathing checks after doses, naloxone, risky combinations",
      words: ["opioid", "narcotic", "naloxone", "narcan", "over.?sedat", "drowsy", "resp(iratory)? depress", "morphine", "hydromorphone", "dilaudid", "oxycodone", "fentanyl", "methadone"] },
    { key: "pain", hint: "Pain: options by pain type (opioids, gabapentinoids, antidepressants, adjuncts), conversions",
      words: ["pain", "analges", "neuropathic", "pregabalin", "gabapentin", "duloxetine", "chronic pain", "breakthrough pain", "opioid conversion", "equianalgesic"] },
    { key: "ddi", hint: "Drug interactions: QT prolongation, serotonin syndrome and seizure-threshold risk on the current meds",
      words: ["interaction", "ddi", "qtc?\\b", "torsade", "serotonin", "serotonergic", "seizure threshold", "linezolid", "maoi"] },
    { key: "supp", hint: "Supplement interactions: vitamins, minerals and herbal products checked against the current meds (bleeding, transplant levels, chelation spacing, biotin lab interference)",
      words: ["supplements?", "herbal", "natural (health )?products?", "naturopath", "st\\.? john'?s wort", "ginkgo", "turmeric", "red yeast rice", "kava", "ashwagandha", "biotin", "cbd oil", "kratom"] },
    { key: "g6pd", hint: "G6PD: check current meds against CPIC risk, signs of hemolysis",
      words: ["g6pd", "hemolys", "haemolys", "rasburicase", "primaquine", "dapsone"] },
    { key: "risk", hint: "Risk screen: pressure injury, nutrition, sleep, dysphagia and falls from the notes",
      words: ["fall", "falls risk", "dysphag", "swallow", "aspiration risk", "nutrition", "malnutr", "weight loss", "sleep", "pressure injur"] },
    { key: "wound", hint: "Wound care: dressing by wound type, change frequency, NPWT/VAC, photo review",
      words: ["wound", "ulcer", "pressure injur", "bedsore", "decubit", "dressing", "vac\\b", "npwt", "skin tear", "diabetic foot", "dehisc"] },
    { key: "onc", hint: "Common cancers: treatment options and oncologic emergencies (cord compression, hypercalcemia, TLS, febrile neutropenia)",
      words: ["cancer", "malignan", "metasta", "tumou?r", "oncolog", "lymphoma", "leuk", "myeloma", "plasmacytoma", "mgus", "paraprotein", "m.?spike", "light chain", "spep", "bence jones", "chemo", "febrile neutropen", "neutropenic", "svc obstruct", "brain met", "palliative"] },
    { key: "tox", hint: "Oncology toxicity: immunotherapy, ADC, bispecific and TKI side effects matched to the med list",
      words: ["immunotherapy", "checkpoint", "pembrolizumab", "nivolumab", "ipilimumab", "colitis on", "irae", "immune.?related", "tki\\b", "side effect of chemo", "toxicit"] },
    { key: "bsab", hint: "CRS/ICANS monitor for bispecifics (teclistamab etc.): grading and treatment",
      words: ["crs\\b", "icans", "cytokine release", "teclistamab", "elranatamab", "talquetamab", "epcoritamab", "glofitamab", "bispecific", "car.?t"] },
    { key: "pc", hint: "Peritoneal carcinomatosis: PCI, malignant bowel obstruction and ascites, tumour markers",
      words: ["peritoneal carcin", "carcinomatosis", "omental cake", "malignant ascites", "malignant bowel", "ca.?125", "cea\\b"] },
    { key: "sero", hint: "Autoimmune serology: which antibody test to order and how to read ANA, ANCA, RF/CCP, C3/C4",
      words: ["ana\\b", "anca", "autoimmune", "lupus", "sle\\b", "vasculitis", "rheumatoid", "ccp\\b", "complement", "c3\\b", "c4\\b", "sjogren", "scleroderma", "myositis", "antiphospholipid", "serolog"] },
    { key: "ktx", hint: "Kidney transplant patients admitted for other reasons: tacrolimus levels, interactions, infection risks",
      words: ["transplant", "tacrolimus", "mycophenolate", "cellcept", "prograf", "rejection"] },
    { key: "edr", hint: "Eating disorder: past visits, medical admission criteria, refeeding risk, care plan",
      words: ["eating disorder", "anorexi", "bulimi", "arfid", "purging", "very low bmi"] },
    { key: "hip", hint: "Hip fracture pathway: pre-op readiness, anticoagulant timing, Nottingham score, post-op, bone health",
      words: ["hip fracture", "hip #", "fractured hip", "nof\\b", "neck of femur", "intertrochanteric", "fragility fracture", "fall with hip", "pre.?op", "ortho\\b", "orthop(a)?edic"] },
    { key: "mobility", hint: "Mobility & discharge: mobility summary, what PT/OT still needs, aids for home",
      words: ["mobility", "walker", "ambulat", "physio", "physiotherap", "occupational therap", "home safety", "rehab", "placement", "can.?t walk"] },
    { key: "discharge", hint: "Discharge note: what changed, pending results, incidental findings, community follow-up",
      words: ["discharge", "going home", "dc summary", "discharge summary", "pending result", "follow.?up", "incidental"] },
    { key: "dcclinic", hint: "South Island Discharge Clinic: who qualifies for rapid follow-up after discharge",
      words: ["discharge clinic", "rapid follow", "close follow", "sidc", "early follow"] },
    { key: "consult", hint: "Consult summary: builds the message to the specialist, ready to send",
      words: ["consult (cardio|nephro|gi|neuro|id|ortho|surg|hem|onc|psych|resp)", "should i consult", "who (do i|to) call", "which specialist", "referral to", "call (cardiology|nephrology|gi|neurology|id)"] },
    { key: "forms", hint: "Forms: referral and requisition PDFs filled from the chart (BC Cancer, Pulse, GI, HFC, UMAC, neuro clinics, EDITH expected death at home)",
      words: ["forms?\\b", "requisition", "referral form", "bc cancer", "pulse", "heart function clinic", "umac", "headache clinic", "first seizure clinic", "form 4\\.1", "edith", "expected death (in|at) (the )?home", "funeral home"] },
    { key: "dx", hint: "Diagnosis check: not improving, can't-miss bundles, does the data fit, unexplained results, imaging review",
      words: ["not improving", "not getting better", "missed diagnos", "what am i missing", "missing something", "differential", "what else could", "unexplained", "doesn.?t fit", "second look", "cognitive bias", "diagnosis"] },
    { key: "watch", hint: "Watch-ahead: what may happen next, contingency plan, rough prognosis",
      words: ["what to watch", "deteriorat", "contingency", "prognosis", "what could go wrong", "early warning"] },
    { key: "cw", hint: "Choosing Wisely: catheter, ASB, sedatives, repeat labs, telemetry, PPI",
      words: ["choosing wisely", "catheter", "foley", "asymptomatic bacteriuria", "telemetry", "daily labs", "ppi\\b", "low value"] },
    { key: "calc", hint: "Calculators: CHA2DS2-VASc, HAS-BLED, HEART, CURB-65, Wells, frailty, delirium risk",
      words: ["calculat", "chads", "cha2ds2", "has.?bled", "heart score", "curb.?65", "wells (score|criteria)", "frailty (score|scale)", "egfr calc"] },
    { key: "exam", hint: "Physical exam: click findings, get a note paragraph",
      words: ["physical exam(ination)? (template|note)", "exam template", "document (the|my) exam"] },
    { key: "labs", hint: "Labs: results by date range and panel, new in last 24 h",
      words: ["lab result", "blood work", "lab trend"] }
  ];

  const RX = TOPICS.map((t) => ({ key: t.key, hint: t.hint, rx: t.words.map((w) => new RegExp("(^|[^a-z0-9])(" + w + ")", "gi")) }));
  const HINT = Object.fromEntries(TOPICS.map((t) => [t.key, t.hint]));

  // A word preceded in the same sentence by "no", "denies", "negative for", "without", "not", "ruled out" does not count.
  const NEG = /\b(no|denies|denied|negative for|without|not|nil|ruled out|r\/o'?d|resolved)\b[^.;\n]{0,25}$/i;
  const LABWORD = /^(trop|lactat|lactic|glucose|sugar|sodium|potassium|creatinine|bnp|probnp|nt|bicarb|hco3|ferritin|bilirubin|calcium|magnesium|phosph|a1c|ck|inr|ph)/i;
  // Lines that are lab-table rows ("Potassium      3.0   mmol/L   3.5 - 5.0   L"), table headers or "Collected:" lines are dropped before
  // looking for words: the values are read as labs, and the test names alone ("Sodium", "Reference") would give false hits.
  const TABLE_ROW = /^\s*[A-Za-z][A-Za-z0-9 ().,%\/+&-]{1,45}?\s{2,}[<>≤≥]?\s*-?\d[\d.,]*(\s|$)/;
  const TABLE_HDR = /^\s*(test|component|analyte)s?\s{2,}(result|value)/i;
  const cleanText = (t) => String(t || "").split(/\r?\n/).filter((ln) => !TABLE_ROW.test(ln) && !TABLE_HDR.test(ln) && !/^\s*(collected|reported|received)\s*:/i.test(ln)).join("\n");
  function topicHits(text) {
    const s = cleanText(text), out = {};
    if (!s.trim()) return out;
    RX.forEach((t) => t.rx.forEach((rx) => {
      rx.lastIndex = 0; let m;
      while ((m = rx.exec(s))) {
        const at = m.index + m[1].length, before = s.slice(Math.max(0, at - 40), at);
        const after = s.slice(at + m[2].length, at + m[2].length + 14);
        const isLabValue = LABWORD.test(m[2]) && /^[\s:=]*(of|is|was)?\s*[<>]?\s*\d/i.test(after); // "trop 24": the number decides, not the word
        if (!NEG.test(before) && !isLabValue) {
          const word = s.slice(at, at + m[2].length + 25).match(/^[^\s,.;:()]+(\s[^\s,.;:()]+)?/)[0];
          (out[t.key] = out[t.key] || new Set()).add(m[2].length > 4 ? cleanWord(word, m[2]) : m[2].toLowerCase());
          break; // one hit per pattern is enough
        }
        if (rx.lastIndex === m.index) rx.lastIndex++;
      }
    }));
    return out;
  }
  const cleanWord = (w, core) => (/\s/.test(core) ? core : w.split(/\s/)[0]).toLowerCase();

  // ---- Lab values ----
  // Units: convert common US units to SI so one set of cut-offs works.
  function toSI(an, v, unit) {
    const u = String(unit || "").toLowerCase().replace(/\s/g, "");
    if (v == null || isNaN(v)) return null;
    if (an === "creat") return /mg\/dl/.test(u) || (!u && v < 20) ? v * 88.4 : v;
    if (an === "glucose") return /mg\/dl/.test(u) || (!u && v > 40) ? v / 18 : v;
    if (an === "ca") return /mg\/dl/.test(u) || (!u && v > 5) ? v / 4.008 : v;
    if (an === "mg") return /mg\/dl/.test(u) ? v / 2.43 : /meq/.test(u) ? v / 2 : v;
    if (an === "po4") return /mg\/dl/.test(u) ? v / 3.097 : v;
    if (an === "hgb") return /g\/dl/.test(u) || (!u && v < 25) ? v * 10 : v;
    if (an === "trop") return /ng\/ml|ug\/l|µg\/l/.test(u) ? v * 1000 : v; // to ng/L
    if (an === "bili") return /mg\/dl/.test(u) ? v * 17.1 : v;
    return v;
  }
  // [key, label, unit, LOINC codes, name pattern]
  const LABS = [
    ["na", "Sodium", "mmol/L", ["2951-2", "2947-0", "32717-1"], /^sodium|\bna\b/i],
    ["k", "Potassium", "mmol/L", ["2823-3", "6298-4", "32713-0"], /^potassium|\bk\b/i],
    ["ca", "Calcium", "mmol/L", ["17861-6", "2000-8", "49765-1"], /^calcium(?!.*ion)/i],
    ["ica", "Ionized calcium", "mmol/L", ["1994-3", "17863-2"], /ioni[sz]ed calcium|calcium.*ioni|\bica\b/i],
    ["mg", "Magnesium", "mmol/L", ["19123-9", "2601-3", "2593-2"], /^magnesium|\bmg\b(?!\/)/i],
    ["po4", "Phosphate", "mmol/L", ["2777-1", "14879-1"], /phosph(ate|orus)/i],
    ["creat", "Creatinine", "µmol/L", ["2160-0", "38483-4", "14682-9"], /^creatinine(?!.*(urine|clear|ratio))/i],
    ["glucose", "Glucose", "mmol/L", ["2345-7", "2339-0", "15074-8", "41653-7", "14749-6"], /glucose(?!.*(urine|csf))/i],
    ["a1c", "HbA1c", "%", ["4548-4", "17856-6"], /a1c/i],
    ["ph", "pH", "", ["2744-1", "2746-6", "11558-4"], /^ph\b|\bph\b.*(blood|arterial|venous)/i],
    ["hco3", "Bicarbonate", "mmol/L", ["1963-8", "1959-6", "2028-9", "14627-4"], /bicarb|hco3|^co2|total co2/i],
    ["lactate", "Lactate", "mmol/L", ["2524-7", "32693-4", "2518-9"], /lact(ate|ic)/i],
    ["bhb", "Beta-hydroxybutyrate", "mmol/L", ["53060-9"], /hydroxybutyrate|\bb.?ohb\b|\bbhb\b|serum ketones/i],
    ["ag", "Anion gap", "mmol/L", ["33037-3", "1863-0"], /anion gap/i],
    ["pco2", "pCO2", "mmHg", ["2019-8", "2021-4", "11557-6"], /\bp[av]?\s?co2\b/i],
    ["ntbnp", "NT-proBNP", "ng/L", ["33762-6", "71425-3"], /nt.?pro.?bnp/i],
    ["bnp", "BNP", "ng/L", ["30934-4", "42637-9"], /^bnp|b.?type natri/i],
    ["trop", "Troponin", "ng/L", ["6598-7", "10839-9", "89579-7", "67151-1", "49563-0", "42757-5"], /troponin|\btrop\b/i],
    ["bili", "Bilirubin", "µmol/L", ["1975-2", "42719-5"], /bilirubin.*total|^bilirubin$|^t\.? ?bili/i],
    ["inr", "INR", "", ["6301-6", "34714-6"], /\binr\b/i],
    ["hgb", "Hemoglobin", "g/L", ["718-7", "20509-6"], /^h(a)?emoglobin$|^hgb|^hb\b/i],
    ["wbc", "WBC", "x10⁹/L", ["6690-2", "26464-8"], /^wbc|white (blood )?cell/i],
    ["plt", "Platelets", "x10⁹/L", ["777-3", "26515-7"], /platelet/i],
    ["ck", "CK", "U/L", ["2157-6"], /^ck\b|creatine kinase/i],
    ["ferritin", "Ferritin", "µg/L", ["2276-4"], /ferritin/i],
    ["tac", "Tacrolimus level", "µg/L", ["11253-2"], /tacrolimus/i]
  ];
  const LAB = Object.fromEntries(LABS.map((l) => [l[0], { label: l[1], unit: l[2] }]));
  function labKey(obs) {
    const codes = ((obs.code && obs.code.coding) || []).map((c) => String(c.code || ""));
    for (const l of LABS) if (codes.some((c) => l[3].includes(c))) return l[0];
    const name = (obs.code && (obs.code.text || ((obs.code.coding || [])[0] || {}).display)) || "";
    if (/urine|csf|fluid|pleural|ascit/i.test(name)) return null;
    for (const l of LABS) if (l[4].test(name.trim())) return l[0];
    return null;
  }
  /* Turn FHIR Observations into { na:[{v,t,unit,flag}], … }, newest first, in SI units. */
  function labsFromObs(obsList) {
    const out = {};
    (obsList || []).forEach((o) => {
      if (!o || o.resourceType !== "Observation" || o.status === "entered-in-error") return;
      const k = labKey(o); if (!k) return;
      const q = o.valueQuantity; if (!q || q.value == null) return;
      const t = new Date(o.effectiveDateTime || o.issued || (o.effectivePeriod && o.effectivePeriod.start) || 0).getTime() || 0;
      const flag = (((o.interpretation || [])[0] || {}).coding || []).map((c) => c.code)[0] || "";
      (out[k] = out[k] || []).push({ v: toSI(k, Number(q.value), q.unit || q.code), t, flag });
    });
    Object.values(out).forEach((a) => a.sort((x, y) => y.t - x.t));
    return out;
  }
  /* Numbers typed or pasted in plain text: "Na 121", "K+ 6.1", "creat 240", "pH 7.21", "trop 85". Newest wins (first written). */
  const TYPED = [
    ["na", /\b(?:na\+?|sodium)\s*(?:of|is|was|=|:)?\s*(\d{2,3}(?:\.\d)?)\b/i],
    ["k", /\b(?:k\+?|potassium)\s*(?:of|is|was|=|:)?\s*(\d(?:\.\d{1,2})?)\b/i],
    ["ca", /\b(?:ca(?:lcium)?|corr(?:ected)? ca)\s*(?:of|is|was|=|:)?\s*(\d(?:\.\d{1,2})?|1\d(?:\.\d)?)\b/i],
    ["mg", /\b(?:mg|magnesium)\s*(?:of|is|was|=|:)?\s*(\d?\.\d{1,2})\b/i],
    ["po4", /\b(?:po4|phos(?:phate|phorus)?)\s*(?:of|is|was|=|:)?\s*(\d?\.\d{1,2}|\d(?:\.\d{1,2})?)\b/i],
    ["creat", /\b(?:cr|creat(?:inine)?)\s*(?:of|is|was|=|:)?\s*(\d{1,4}(?:\.\d{1,2})?)\b/i],
    ["glucose", /\b(?:glucose|bg|blood sugar|sugar|cbg|gluc)\s*(?:of|is|was|=|:)?\s*(\d{1,3}(?:\.\d)?)\b/i],
    ["ph", /\bph\s*(?:of|is|was|=|:)?\s*(7\.\d{1,2}|6\.\d{1,2})\b/i],
    ["hco3", /\b(?:hco3-?|bicarb(?:onate)?)\s*(?:of|is|was|=|:)?\s*(\d{1,2}(?:\.\d)?)\b/i],
    ["lactate", /\b(?:lactate|lactic(?: acid)?)\s*(?:of|is|was|=|:)?\s*(\d{1,2}(?:\.\d)?)\b/i],
    ["ntbnp", /\b(?:nt-?pro-?bnp|probnp)\s*(?:of|is|was|=|:)?\s*(\d{2,6})\b/i],
    ["bnp", /\bbnp\s*(?:of|is|was|=|:)?\s*(\d{2,5})\b/i],
    ["trop", /\b(?:hs-?)?trop(?:onin)?(?:\s*[it])?\s*(?:of|is|was|=|:)?\s*(\d{1,5}(?:\.\d{1,3})?)\b/i],
    ["bhb", /\b(?:beta.?hydroxybutyrate|b.?ohb|bhb|serum ketones)\s*(?:of|is|was|=|:)?\s*(\d{1,2}(?:\.\d{1,2})?)\b/i],
    ["ag", /\b(?:anion gap|ag)\s*(?:of|is|was|=|:)?\s*(\d{1,2})\b/i],
    ["pco2", /\bp[av]?\s?co2\s*(?:of|is|was|=|:)?\s*(\d{2,3})\b/i],
    ["bili", /\b(?:t\.?\s?bili|bili(?:rubin)?)\s*(?:of|is|was|=|:)?\s*(\d{1,3})\b/i],
    ["inr", /\binr\s*(?:of|is|was|=|:)?\s*(\d(?:\.\d{1,2})?)\b/i],
    ["hgb", /\b(?:hgb|hb|h(?:a)?emoglobin)\s*(?:of|is|was|=|:)?\s*(\d{1,3}(?:\.\d)?)\b/i],
    ["ck", /\bck\s*(?:of|is|was|=|:)?\s*(\d{2,6})\b/i],
    ["ferritin", /\bferritin\s*(?:of|is|was|=|:)?\s*(\d{2,6})\b/i]
  ];
  function labsFromText(text) {
    const s = String(text || ""), out = {};
    TYPED.forEach(([k, rx]) => {
      const m = rx.exec(s); if (!m) return;
      let v = parseFloat(m[1]); if (isNaN(v)) return;
      if (k === "trop" && v < 5) v *= 1000;              // ng/mL written as 0.08
      if (k === "creat" && v < 20) v *= 88.4;            // mg/dL written as 2.1
      if (k === "glucose" && v > 40) v /= 18;            // mg/dL
      if (k === "hgb" && v < 25) v *= 10;                // g/dL
      if (k === "ca" && v > 5) v /= 4.008;               // mg/dL
      out[k] = [{ v, t: 0, typed: true }];
    });
    // creatinine with a baseline: "Cr 210 (baseline 120)", "creatinine went from 80 to 190"
    const fromTo = /\b(?:cr|creat(?:inine)?)\w*\s+(?:went\s+|rose\s+|up\s+)?from\s*(\d{2,4})\s*(?:to|->|→|-)\s*(\d{2,4})/i.exec(s);
    const base = /\bbaseline\s*(?:cr(?:eat(?:inine)?)?)?\s*(?:of|is|was|=|:|~)?\s*(\d{2,4})/i.exec(s);
    if (fromTo) out.creat = [{ v: +fromTo[2], t: 1, typed: true }, { v: +fromTo[1], t: 0, typed: true }];
    else if (base && out.creat) out.creat.push({ v: +base[1], t: 0, typed: true });
    return out;
  }

  // ---- Lab rules: [tool, test(latest, series, labs) -> reason or ""] ----
  const fmt = (k, v) => `${LAB[k].label} ${v == null ? "?" : +(+v).toFixed(k === "k" || k === "mg" || k === "po4" || k === "ca" || k === "ica" || k === "ph" || k === "inr" ? 2 : k === "lactate" || k === "glucose" ? 1 : 0)}${LAB[k].unit ? " " + LAB[k].unit : ""}`;
  const first = (labs, k) => (labs[k] && labs[k][0]) || null;
  const LAB_RULES = [
    ["hypona", (L) => { const x = first(L, "na"); return x && (x.v < 133 ? [fmt("na", x.v) + " (low)", x.v < 125 ? 3 : 2] : x.v > 146 ? [fmt("na", x.v) + " (high)", x.v > 150 ? 3 : 2] : null); }],
    ["lytes", (L) => { const x = first(L, "k"); return x && (x.v < 3.3 ? [fmt("k", x.v) + " (low)", x.v < 3.0 ? 3 : 2] : x.v > 5.5 ? [fmt("k", x.v) + " (high)", x.v >= 6 ? 3 : 2] : null); }],
    ["lytes", (L) => { const x = first(L, "mg"); return x && (x.v < 0.65 ? [fmt("mg", x.v) + " (low)", 2] : x.v > 1.2 ? [fmt("mg", x.v) + " (high)", 2] : null); }],
    ["lytes", (L) => { const x = first(L, "po4"); return x && (x.v < 0.6 ? [fmt("po4", x.v) + " (low)", x.v < 0.4 ? 3 : 2] : x.v > 1.8 ? [fmt("po4", x.v) + " (high)", 2] : null); }],
    ["lytes", (L) => { const x = first(L, "ca"); return x && (x.v < 2.0 ? [fmt("ca", x.v) + " (low; correct for albumin)", 2] : x.v > 2.7 ? [fmt("ca", x.v) + " (high)", x.v > 3.0 ? 3 : 2] : null); }],
    ["lytes", (L) => { const x = first(L, "ica"); return x && (x.v < 1.1 ? [fmt("ica", x.v) + " (low)", 2] : x.v > 1.35 ? [fmt("ica", x.v) + " (high)", 2] : null); }],
    ["aki", (L) => {
      const s = L.creat || []; if (!s.length) return null;
      const now = s[0], prior = s.slice(1).filter((x) => !now.t || !x.t || now.t - x.t <= 7 * 864e5);
      const base = prior.length ? Math.min.apply(null, prior.map((x) => x.v)) : null;
      if (base && now.v >= 1.5 * base) return [`${fmt("creat", now.v)}, up from ${Math.round(base)} (×${(now.v / base).toFixed(1)})`, 3];
      if (base && now.v - base >= 27) return [`${fmt("creat", now.v)}, up ${Math.round(now.v - base)} from ${Math.round(base)}`, 2];
      if (now.v >= 150) return [fmt("creat", now.v) + " (raised; no baseline found)", 1];
      return null;
    }],
    ["acidbase", (L) => { const x = first(L, "ph"); return x && (x.v < 7.32 ? ["pH " + x.v.toFixed(2) + " (acidemia)", 3] : x.v > 7.48 ? ["pH " + x.v.toFixed(2) + " (alkalemia)", 2] : null); }],
    ["acidbase", (L) => { const x = first(L, "hco3"); return x && (x.v < 18 ? [fmt("hco3", x.v) + " (low)", 2] : x.v > 32 ? [fmt("hco3", x.v) + " (high)", 1] : null); }],
    ["acidbase", (L) => { const x = first(L, "ag"); return x && x.v > 16 ? [fmt("ag", x.v) + " (high anion gap)", 2] : null; }],
    ["acidbase", (L) => { const x = first(L, "bhb"); return x && x.v >= 3 ? [fmt("bhb", x.v) + " (ketoacidosis?)", 3] : null; }],
    ["dm", (L) => { const x = first(L, "bhb"); return x && x.v >= 1.5 ? [fmt("bhb", x.v) + (x.v >= 3 ? " (DKA range)" : " (ketosis)"), x.v >= 3 ? 3 : 2] : null; }],
    ["acidbase", (L) => { const x = first(L, "pco2"); return x && (x.v > 50 ? [fmt("pco2", x.v) + " (high: hypercapnia)", 2] : null); }],
    ["inf", (L) => { const x = first(L, "lactate"); return x && x.v > 2 ? [fmt("lactate", x.v) + " (raised: sepsis or hypoperfusion?)", x.v >= 4 ? 3 : 2] : null; }],
    ["chf", (L) => { const x = first(L, "ntbnp"); return x && x.v > 900 ? [fmt("ntbnp", x.v) + " (raised)", x.v > 1800 ? 3 : 2] : null; }],
    ["chf", (L) => { const x = first(L, "bnp"); return x && x.v > 300 ? [fmt("bnp", x.v) + " (raised)", 2] : null; }],
    ["acs", (L) => { const x = first(L, "trop"); return x && (x.flag === "H" || x.flag === "HH" || x.flag === "A" || x.v > 52) ? [fmt("trop", x.v) + " (raised: NSTEMI or type 2 MI?)", x.v > 100 ? 3 : 2] : null; }],
    ["dm", (L) => { const x = first(L, "glucose"); return x && (x.v > 14 ? [fmt("glucose", x.v) + " (high)", x.v > 20 ? 3 : 2] : x.v < 4 ? [fmt("glucose", x.v) + " (low)", 3] : null); }],
    ["dm", (L) => { const x = first(L, "a1c"); return x && x.v >= 6.5 ? ["HbA1c " + x.v + "%", 1] : null; }],
    ["liver", (L) => { const b = first(L, "bili"), i = first(L, "inr"); return b && b.v > 50 ? [fmt("bili", b.v) + (i && i.v > 1.5 ? `, INR ${i.v.toFixed(1)}` : "") + " (raised)", 2] : null; }],
    ["aki", (L) => { const x = first(L, "ck"); return x && x.v > 5000 ? [fmt("ck", x.v) + " (rhabdomyolysis risk)", 2] : null; }],
    ["fuo", (L) => { const x = first(L, "ferritin"); return x && x.v > 3000 ? [fmt("ferritin", x.v) + " (very high: think HLH / Still's)", 2] : null; }],
    ["ktx", (L) => { const x = first(L, "tac"); return x ? [fmt("tac", x.v) + " (on tacrolimus)", 1] : null; }]
  ];

  // ---- Medication rules: [tool, pattern, reason, weight] ----
  const MED_RULES = [
    ["opioid", /morphine|hydromorphone|dilaudid|oxycodone|fentanyl|methadone|codeine|tramadol|tapentadol|buprenorphine|sufentanil/i, "On an opioid", 2],
    ["abx", /cillin|cef|ceph|penem|vancomycin|metronidazole|ciprofloxacin|levofloxacin|moxifloxacin|azithromycin|clarithromycin|doxycycline|sulfamethoxazole|trimethoprim|septra|nitrofurantoin|clindamycin|linezolid|daptomycin|gentamicin|tobramycin|fosfomycin|tazobactam|aztreonam/i, "On an antibiotic", 2],
    ["dm", /insulin|glargine|lantus|detemir|degludec|lispro|aspart|humalog|novorapid|gliclazide|glyburide|glimepiride/i, "On insulin or a sulfonylurea", 2],
    ["pd", /levodopa|carbidopa|sinemet|pramipexole|ropinirole|rasagiline|entacapone|amantadine/i, "On Parkinson medication", 2],
    ["ktx", /tacrolimus|prograf|advagraf|envarsus|mycophenol|cellcept|myfortic|cyclosporin|sirolimus|belatacept/i, "On transplant immunosuppression", 2],
    ["bsab", /teclistamab|elranatamab|talquetamab|epcoritamab|glofitamab|mosunetuzumab|blinatumomab|linvoseltamab/i, "On a bispecific antibody", 3],
    ["tox", /pembrolizumab|nivolumab|ipilimumab|atezolizumab|durvalumab|cemiplimab|osimertinib|trastuzumab deruxtecan|enfortumab|sacituzumab|lenvatinib|cabozantinib|sunitinib|pazopanib/i, "On immunotherapy / targeted cancer drug", 3],
    ["seizure", /levetiracetam|keppra|phenytoin|dilantin|valpro|lacosamide|carbamazepine|lamotrigine|brivaracetam|clobazam|topiramate/i, "On an antiseizure medication", 1],
    ["af", /apixaban|rivaroxaban|edoxaban|dabigatran|warfarin/i, "On an oral anticoagulant", 1],
    ["ddi", /citalopram|escitalopram|methadone|haloperidol|ondansetron|domperidone|azithromycin|clarithromycin|moxifloxacin|levofloxacin|ciprofloxacin|amiodarone|sotalol|linezolid|tramadol|meperidine|bupropion|clozapine|cefepime|imipenem|phenelzine|tranylcypromine|moclobemide|methylene blue/i, "On a QT / serotonergic / seizure-risk drug", 1],
    ["supp", /st\.? john'?s wort|hypericum|ginkgo|ginseng|turmeric|curcumin|fish oil|omega-3|glucosamine|red yeast rice|licorice|melatonin|biotin|valerian|kava|ashwagandha|echinacea|berberine|cannabidiol|\bcbd\b|probiotic|multivitamin|calcium carbonate|ferrous|magnesium oxide|vitamin [dek]\b|cholecalciferol/i, "On a vitamin, mineral or herbal supplement", 1],
    ["g6pd", /rasburicase|primaquine|dapsone|methylene blue/i, "Drug with G6PD hemolysis risk", 2],
    ["liver", /lactulose|rifaximin|spironolactone.*furosemide|terlipressin/i, "On a liver-disease medication", 1],
    ["chf", /sacubitril|entresto|dapagliflozin|empagliflozin|eplerenone/i, "On heart-failure therapy", 1]
  ];

  // ---- Main: chart facts -> suggested tools ----
  function suggest(facts) {
    facts = facts || {};
    const by = {};
    const add = (key, reason, w, src) => {
      const s = (by[key] = by[key] || { key, score: 0, reasons: [], hint: HINT[key] || "" });
      if (s.reasons.some((r) => r.text === reason)) return;
      s.score += w; s.reasons.push({ text: reason, src });
    };
    const L = facts.labs || {};
    LAB_RULES.forEach(([key, fn]) => { const r = fn(L); if (r) add(key, r[0], r[1], "lab"); });
    // problems / diagnoses
    (facts.conditions || []).forEach((c) => { const h = topicHits(c); Object.keys(h).forEach((k) => add(k, "Problem: " + c, 2.5, "problem")); });
    // medications
    const meds = facts.meds || [];
    MED_RULES.forEach(([key, rx, why, w]) => { const m = meds.find((x) => rx.test(x)); if (m) add(key, `${why} (${shorten(m)})`, w, "med"); });
    if (meds.length >= 10) add("deprx", `${meds.length} active medications`, meds.length >= 15 ? 2 : 1.5, "med");
    if (facts.age >= 65 && meds.length >= 5) add("deprx", `Age ${facts.age} with ${meds.length} medications`, 1, "med");
    // free text (typed question, pasted ER note, scanned note)
    if (facts.text) {
      const h = topicHits(facts.text);
      Object.keys(h).forEach((k) => add(k, (facts.textLabel || "Text mentions") + ": " + Array.from(h[k]).slice(0, 4).join(", "), Math.min(1 + h[k].size * 0.75, 3), "text"));
    }
    return Object.values(by).sort((a, b) => b.score - a.score || a.key.localeCompare(b.key));
  }
  const shorten = (s) => String(s).split(/\s+\d|\(|,/)[0].trim().slice(0, 40);

  /* Typed question or pasted note -> tools. Numbers in the text are read as lab values too. */
  function ask(text) {
    const labs = labsFromText(text);
    return suggest({ labs, text, textLabel: "You typed" });
  }

  const api = { suggest, ask, topicHits, labsFromObs, labsFromText, toSI, TOPICS, HINT, LAB };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.TKSuggestRules = api;
})(typeof window !== "undefined" ? window : this);
