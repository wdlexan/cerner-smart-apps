/* Oncology tab: anticancer and supportive drugs matched by NAME from the medication list.
   Each entry: what it is, which cancers, and what a hospitalist should watch for.
   UNVERIFIED draft written by Claude from general knowledge (product monographs, BC Cancer drug manual style). Verify before clinical use.
   tags: ici = immune checkpoint inhibitor, cyto = cytotoxic chemo (neutropenia/fever risk), qt = QTc risk, ind = strong CYP3A4 inducer,
         cdk = CDK4/6 inhibitor (CYP3A4 substrate), gnrh = GnRH agonist (flare), aa = antiandrogen, abi = abiraterone, adc = antibody-drug conjugate,
         vegf = anti-VEGF, egfrab = anti-EGFR antibody, bispec = bispecific T-cell engager, bone = bone-targeted agent */
(function () {
  const D = [
    // ---------- immune checkpoint inhibitors ----------
    { re: /pembrolizumab|keytruda/i, name: "Pembrolizumab", cls: "Immunotherapy (PD-1)", cancers: ["lung", "breast", "crc"], tags: ["ici"],
      watch: "Immune-related side effects can start any time, even months after the last dose: colitis, pneumonitis, hepatitis, thyroid, hypophysitis/adrenal, type 1 diabetes/DKA, myocarditis, nephritis. Check TSH, cortisol, glucose, LFTs, creatinine. See the Oncology toxicity tab." },
    { re: /nivolumab|opdivo/i, name: "Nivolumab", cls: "Immunotherapy (PD-1)", cancers: ["lung", "crc"], tags: ["ici"],
      watch: "Immune-related side effects (colitis, pneumonitis, hepatitis, endocrine, myocarditis). With ipilimumab the rate of serious side effects is much higher." },
    { re: /ipilimumab|yervoy/i, name: "Ipilimumab", cls: "Immunotherapy (CTLA-4)", cancers: ["lung", "crc"], tags: ["ici"],
      watch: "Highest rate of colitis and hypophysitis of the checkpoint drugs. Diarrhea on ipilimumab is colitis until proven otherwise." },
    { re: /atezolizumab|tecentriq/i, name: "Atezolizumab", cls: "Immunotherapy (PD-L1)", cancers: ["lung"], tags: ["ici"], watch: "Immune-related side effects (pneumonitis, hepatitis, endocrine, colitis)." },
    { re: /durvalumab|imfinzi/i, name: "Durvalumab", cls: "Immunotherapy (PD-L1)", cancers: ["lung"], tags: ["ici"], watch: "Often given after chemoradiation (stage III NSCLC, limited-stage SCLC): pneumonitis may be drug or radiation – CT, hold, call oncology." },
    { re: /cemiplimab|libtayo/i, name: "Cemiplimab", cls: "Immunotherapy (PD-1)", cancers: ["lung"], tags: ["ici"], watch: "Immune-related side effects." },
    { re: /tremelimumab|imjudo/i, name: "Tremelimumab", cls: "Immunotherapy (CTLA-4)", cancers: ["lung"], tags: ["ici"], watch: "Immune-related side effects, colitis." },
    { re: /dostarlimab|jemperli/i, name: "Dostarlimab", cls: "Immunotherapy (PD-1)", cancers: ["crc"], tags: ["ici"], watch: "dMMR rectal cancer (organ-sparing) and others: immune-related side effects." },
    // ---------- bispecific ----------
    { re: /tarlatamab|imdelltra/i, name: "Tarlatamab", cls: "Bispecific T-cell engager (DLL3)", cancers: ["lung"], tags: ["bispec"],
      watch: "Small cell lung cancer. CRS (fever, low BP, low O2) and ICANS (confusion, word-finding) mostly after the first doses. See the CRS/ICANS tab." },
    // ---------- lung targeted ----------
    { re: /osimertinib|tagrisso/i, name: "Osimertinib", cls: "EGFR inhibitor", cancers: ["lung"], tags: ["qt"],
      watch: "QTc prolongation (ECG; keep K, Mg normal; avoid other QT drugs), ILD/pneumonitis (new cough or hypoxia: hold and call oncology), reduced LVEF (rare), diarrhea, rash, paronychia. Avoid strong CYP3A4 inducers. Do not stop for long without asking oncology (disease can flare)." },
    { re: /erlotinib|tarceva|gefitinib|iressa|afatinib|giotrif|dacomitinib|vizimpro/i, name: "Erlotinib / gefitinib / afatinib / dacomitinib", cls: "EGFR inhibitor (older)", cancers: ["lung"], tags: [],
      watch: "Acneiform rash, diarrhea (afatinib especially), ILD, hepatotoxicity. Erlotinib/gefitinib absorption falls with PPIs and H2 blockers; smoking lowers erlotinib levels." },
    { re: /amivantamab|rybrevant/i, name: "Amivantamab", cls: "EGFR-MET bispecific antibody", cancers: ["lung"], tags: [],
      watch: "Infusion reactions (first dose), acneiform rash, paronychia, low albumin/edema, ILD. With lazertinib: high VTE risk – prophylactic anticoagulation is recommended for the first 4 months." },
    { re: /lazertinib|lazcluze/i, name: "Lazertinib", cls: "EGFR inhibitor", cancers: ["lung"], tags: [], watch: "Given with amivantamab: VTE (prophylactic anticoagulation first 4 months), rash, paronychia, ILD." },
    { re: /alectinib|alecensaro|alecensa/i, name: "Alectinib", cls: "ALK inhibitor", cancers: ["lung"], tags: [],
      watch: "Bradycardia, CK rise/myalgia, hepatotoxicity, anemia, photosensitivity, edema. Check HR and LFTs." },
    { re: /lorlatinib|lorbrena/i, name: "Lorlatinib", cls: "ALK inhibitor", cancers: ["lung"], tags: [],
      watch: "High cholesterol/triglycerides, mood change, cognitive effects, hallucinations, edema, weight gain, AV block. Strong CYP3A4 inducers are contraindicated." },
    { re: /brigatinib|alunbrig/i, name: "Brigatinib", cls: "ALK inhibitor", cancers: ["lung"], tags: [], watch: "Early pulmonary events (first week), hypertension, bradycardia, CK and lipase rise." },
    { re: /crizotinib|xalkori/i, name: "Crizotinib", cls: "ALK/ROS1/MET inhibitor", cancers: ["lung"], tags: ["qt"], watch: "Visual disturbance, bradycardia, QTc, hepatotoxicity, edema, low testosterone." },
    { re: /entrectinib|rozlytrek|repotrectinib|augtyro|larotrectinib|vitrakvi/i, name: "Entrectinib / repotrectinib / larotrectinib", cls: "ROS1/NTRK inhibitor", cancers: ["lung"], tags: [], watch: "Dizziness, ataxia, weight gain, cognitive effects, falls." },
    { re: /sotorasib|lumakras|adagrasib|krazati/i, name: "Sotorasib / adagrasib", cls: "KRAS G12C inhibitor", cancers: ["lung", "crc"], tags: [],
      watch: "Hepatotoxicity (more if recent immunotherapy), diarrhea, nausea. Adagrasib: QTc. Many CYP3A4 interactions." },
    { re: /dabrafenib|tafinlar|trametinib|mekinist/i, name: "Dabrafenib + trametinib", cls: "BRAF + MEK inhibitors", cancers: ["lung"], tags: [],
      watch: "Pyrexia syndrome (fever, chills: hold both, may need steroids – not always infection), reduced LVEF, retinal problems, rash." },
    { re: /encorafenib|braftovi|binimetinib|mektovi/i, name: "Encorafenib (± binimetinib)", cls: "BRAF inhibitor", cancers: ["lung", "crc"], tags: [], watch: "Fatigue, arthralgia, rash, new skin cancers; with cetuximab in BRAF V600E colorectal cancer. MEK: LVEF, eye." },
    { re: /capmatinib|tabrecta|tepotinib|tepmetko/i, name: "Capmatinib / tepotinib", cls: "MET inhibitor", cancers: ["lung"], tags: [], watch: "Peripheral edema (common, hard to treat), ILD, raised creatinine, hepatotoxicity." },
    { re: /selpercatinib|retevmo|pralsetinib|gavreto/i, name: "Selpercatinib / pralsetinib", cls: "RET inhibitor", cancers: ["lung"], tags: ["qt"], watch: "Hypertension, hepatotoxicity, QTc (selpercatinib), pneumonitis and infections (pralsetinib)." },
    // ---------- ADCs ----------
    { re: /trastuzumab deruxtecan|fam-?trastuzumab|enhertu|t-?dxd/i, name: "Trastuzumab deruxtecan (T-DXd)", cls: "Antibody-drug conjugate (HER2)", cancers: ["breast", "lung", "crc"], tags: ["adc", "cyto"],
      watch: "ILD/pneumonitis (can be fatal): any new cough, dyspnea or fever → CT, hold drug, call oncology; steroids for grade ≥2. Also nausea, neutropenia, reduced LVEF." },
    { re: /datopotamab|datroway|dato-?dxd/i, name: "Datopotamab deruxtecan", cls: "Antibody-drug conjugate (TROP2)", cancers: ["breast", "lung"], tags: ["adc", "cyto"], watch: "Stomatitis, eye problems (keratitis), ILD/pneumonitis, nausea." },
    { re: /sacituzumab|trodelvy/i, name: "Sacituzumab govitecan", cls: "Antibody-drug conjugate (TROP2)", cancers: ["breast"], tags: ["adc", "cyto"], watch: "Neutropenia (febrile neutropenia risk) and diarrhea (early cholinergic and late). More severe if UGT1A1*28 homozygous." },
    { re: /trastuzumab emtansine|kadcyla|t-?dm1/i, name: "Trastuzumab emtansine (T-DM1)", cls: "Antibody-drug conjugate (HER2)", cancers: ["breast"], tags: ["adc"], watch: "Thrombocytopenia, hepatotoxicity, neuropathy, reduced LVEF." },
    // ---------- HER2 ----------
    { re: /^(?!.*(deruxtecan|emtansine|enhertu|kadcyla)).*(trastuzumab|herceptin|herzuma|ogivri|kanjinti|trazimera|ontruzant|phesgo)/i, name: "Trastuzumab", cls: "HER2 antibody", cancers: ["breast", "crc"], tags: [],
      watch: "Reduced LVEF / heart failure (usually reversible): echo or MUGA every ~3 months; new HF → hold and call oncology. Infusion reactions." },
    { re: /pertuzumab|perjeta|phesgo/i, name: "Pertuzumab", cls: "HER2 antibody", cancers: ["breast"], tags: [], watch: "Diarrhea, LVEF drop (with trastuzumab)." },
    { re: /tucatinib|tukysa/i, name: "Tucatinib", cls: "HER2 TKI", cancers: ["breast", "crc"], tags: [], watch: "Diarrhea, hepatotoxicity. Raises serum creatinine by blocking tubular secretion without true kidney injury (check cystatin C if unsure). Strong CYP2C8 interactions." },
    { re: /neratinib|nerlynx|lapatinib|tykerb/i, name: "Neratinib / lapatinib", cls: "HER2 TKI", cancers: ["breast"], tags: [], watch: "Diarrhea (neratinib very common – loperamide prophylaxis), hepatotoxicity. Lapatinib: QTc, LVEF." },
    // ---------- breast endocrine / CDK / PI3K ----------
    { re: /tamoxifen|nolvadex/i, name: "Tamoxifen", cls: "Endocrine (SERM)", cancers: ["breast"], tags: [],
      watch: "VTE, endometrial changes (report vaginal bleeding), hot flashes. Strong CYP2D6 inhibitors (paroxetine, fluoxetine, bupropion) may reduce benefit – prefer venlafaxine or citalopram/escitalopram. Often held around major surgery/immobility (ask oncology)." },
    { re: /letrozole|femara|anastrozole|arimidex|exemestane|aromasin/i, name: "Aromatase inhibitor", cls: "Endocrine (AI)", cancers: ["breast"], tags: [], watch: "Arthralgia, bone loss (bone density, Ca/vitamin D), hot flashes. Safe to continue in hospital in most cases." },
    { re: /fulvestrant|faslodex/i, name: "Fulvestrant", cls: "Endocrine (SERD, IM)", cancers: ["breast"], tags: [], watch: "Monthly IM injections (care with low platelets/anticoagulation); injection-site pain." },
    { re: /elacestrant|orserdu|camizestrant|imlunestrant/i, name: "Oral SERD (elacestrant etc.)", cls: "Endocrine (oral SERD)", cancers: ["breast"], tags: [], watch: "ESR1-mutant disease. Nausea, high lipids." },
    { re: /ribociclib|kisqali/i, name: "Ribociclib", cls: "CDK4/6 inhibitor", cancers: ["breast"], tags: ["cdk", "qt"],
      watch: "QTc prolongation (ECG; avoid other QT drugs; keep K/Mg normal), hepatotoxicity, neutropenia (usually not febrile). Strong CYP3A4 inhibitors/inducers interact." },
    { re: /palbociclib|ibrance/i, name: "Palbociclib", cls: "CDK4/6 inhibitor", cancers: ["breast"], tags: ["cdk"], watch: "Neutropenia (common, rarely febrile – still treat fever as FN), fatigue, stomatitis. CYP3A4 interactions." },
    { re: /abemaciclib|verzenio/i, name: "Abemaciclib", cls: "CDK4/6 inhibitor", cancers: ["breast"], tags: ["cdk"], watch: "Diarrhea (early, common – loperamide), VTE, ILD (rare), neutropenia, raised creatinine (secretion, not true AKI). CYP3A4 interactions." },
    { re: /alpelisib|piqray|inavolisib|itovebi/i, name: "Alpelisib / inavolisib", cls: "PI3K inhibitor", cancers: ["breast"], tags: [],
      watch: "Hyperglycemia, can be severe (DKA reported): check glucose; metformin first line, hold if glucose very high. Rash, diarrhea, stomatitis." },
    { re: /capivasertib|truqap/i, name: "Capivasertib", cls: "AKT inhibitor", cancers: ["breast"], tags: [], watch: "Hyperglycemia, diarrhea, rash." },
    { re: /everolimus|afinitor/i, name: "Everolimus", cls: "mTOR inhibitor", cancers: ["breast"], tags: [], watch: "Stomatitis (dexamethasone mouthwash), non-infectious pneumonitis, hyperglycemia, infections, hyperlipidemia." },
    { re: /olaparib|lynparza|talazoparib|talzenna|niraparib|zejula|akeega/i, name: "PARP inhibitor", cls: "PARP inhibitor", cancers: ["breast", "prostate"], tags: [], watch: "Anemia (often needs transfusion), thrombocytopenia, neutropenia, rare MDS/AML; niraparib hypertension." },
    { re: /goserelin|zoladex|leuprolide|leuprorelin|lupron|eligard|triptorelin|trelstar|buserelin/i, name: "GnRH agonist (ADT)", cls: "Hormone (GnRH agonist)", cancers: ["prostate", "breast"], tags: ["gnrh", "qt"],
      watch: "Prostate: testosterone FLARE in the first 1–3 weeks (more bone pain, cord compression, urinary obstruction) – cover with an antiandrogen (bicalutamide) if bulky/spinal disease. Long term: QTc, diabetes, cardiovascular risk, osteoporosis, anemia, hot flashes, mood. Do not stop ADT when starting chemo." },
    { re: /degarelix|firmagon|relugolix|orgovyx/i, name: "GnRH antagonist (degarelix / relugolix)", cls: "Hormone (GnRH antagonist)", cancers: ["prostate"], tags: ["qt"], watch: "No flare (good choice for cord compression or obstruction). QTc, hot flashes. Relugolix: P-gp interactions; daily tablet – keep giving in hospital." },
    // ---------- prostate ----------
    { re: /abiraterone|zytiga|yonsa|akeega/i, name: "Abiraterone", cls: "Androgen synthesis inhibitor", cancers: ["prostate"], tags: ["abi"],
      watch: "Must be given with prednisone (5 mg BID or 10 mg daily) – without it: hypokalemia, hypertension, edema. Adrenal suppression: give stress-dose steroids when acutely ill; IV hydrocortisone if NPO. Hepatotoxicity (LFTs)." },
    { re: /enzalutamide|xtandi/i, name: "Enzalutamide", cls: "Androgen receptor inhibitor", cancers: ["prostate"], tags: ["aa", "ind"],
      watch: "Falls and fractures, fatigue, seizures (rare), hypertension. Strong CYP3A4 inducer: lowers apixaban, rivaroxaban, many others – ask pharmacy." },
    { re: /apalutamide|erleada/i, name: "Apalutamide", cls: "Androgen receptor inhibitor", cancers: ["prostate"], tags: ["aa", "ind", "qt"], watch: "Rash, hypothyroidism, falls/fractures, seizures (rare), QTc. Strong CYP3A4 inducer – interactions (DOACs, others)." },
    { re: /darolutamide|nubeqa/i, name: "Darolutamide", cls: "Androgen receptor inhibitor", cancers: ["prostate"], tags: ["aa"], watch: "Fewer CNS effects and interactions than enzalutamide/apalutamide. Fatigue, rash." },
    { re: /bicalutamide|casodex|flutamide|nilutamide/i, name: "Bicalutamide (first-generation antiandrogen)", cls: "Antiandrogen", cancers: ["prostate"], tags: ["aa"], watch: "Used to block flare when starting a GnRH agonist. Hepatotoxicity, gynecomastia." },
    { re: /lutetium|lu-?177|pluvicto|psma-?617/i, name: "Lutetium-177 PSMA (Pluvicto)", cls: "Radioligand", cancers: ["prostate"], tags: [], watch: "Bone marrow suppression (platelets, Hb), dry mouth, kidney function. Radiation precautions with urine for a few days after each dose." },
    { re: /radium|xofigo/i, name: "Radium-223", cls: "Radiopharmaceutical", cancers: ["prostate"], tags: [], watch: "Bone marrow suppression, diarrhea. Bone-only symptomatic disease." },
    { re: /cabazitaxel|jevtana/i, name: "Cabazitaxel", cls: "Chemotherapy (taxane)", cancers: ["prostate"], tags: ["cyto"], watch: "Neutropenia and febrile neutropenia (G-CSF prophylaxis usually given), diarrhea, hematuria." },
    // ---------- cytotoxics ----------
    { re: /docetaxel|taxotere/i, name: "Docetaxel", cls: "Chemotherapy (taxane)", cancers: ["lung", "breast", "prostate"], tags: ["cyto"], watch: "Neutropenia / febrile neutropenia (nadir ~day 7–10), fluid retention, neuropathy, nail changes, hypersensitivity (dex premedication)." },
    { re: /^(?!.*(nab|protein|abraxane)).*(paclitaxel|taxol)/i, name: "Paclitaxel", cls: "Chemotherapy (taxane)", cancers: ["lung", "breast"], tags: ["cyto"], watch: "Neuropathy, hypersensitivity reactions, neutropenia, myalgia." },
    { re: /nab-?paclitaxel|abraxane|paclitaxel protein/i, name: "Nab-paclitaxel", cls: "Chemotherapy (taxane)", cancers: ["lung", "breast"], tags: ["cyto"], watch: "Neuropathy, neutropenia." },
    { re: /cisplatin/i, name: "Cisplatin", cls: "Chemotherapy (platinum)", cancers: ["lung"], tags: ["cyto"],
      watch: "AKI, hypomagnesemia, hypokalemia, SIADH/salt wasting, severe nausea (delayed), ototoxicity, neuropathy. Hydrate; avoid nephrotoxins." },
    { re: /carboplatin/i, name: "Carboplatin", cls: "Chemotherapy (platinum)", cancers: ["lung", "breast"], tags: ["cyto"], watch: "Thrombocytopenia and neutropenia, hypersensitivity (after many cycles), low Mg." },
    { re: /oxaliplatin|eloxatin|folfox|capox|xelox|folfoxiri/i, name: "Oxaliplatin", cls: "Chemotherapy (platinum)", cancers: ["crc"], tags: ["cyto"],
      watch: "Cold-induced tingling and throat tightness (laryngopharyngeal dysesthesia – sats normal; reassure, avoid cold drinks), cumulative neuropathy, hypersensitivity, thrombocytopenia." },
    { re: /etoposide|vp-?16/i, name: "Etoposide", cls: "Chemotherapy", cancers: ["lung"], tags: ["cyto"], watch: "Neutropenia (febrile neutropenia common in SCLC), alopecia, mucositis." },
    { re: /pemetrexed|alimta/i, name: "Pemetrexed", cls: "Chemotherapy (antifolate)", cancers: ["lung"], tags: ["cyto"],
      watch: "Needs folic acid daily and B12 every 9 weeks. Avoid NSAIDs around doses; avoid if CrCl < 45 mL/min. Myelosuppression, rash (dex premedication), edema." },
    { re: /gemcitabine|gemzar/i, name: "Gemcitabine", cls: "Chemotherapy", cancers: ["lung", "breast"], tags: ["cyto"], watch: "Thrombocytopenia, flu-like fever after dose, pneumonitis, TMA/HUS (rare: new hypertension, AKI, schistocytes)." },
    { re: /vinorelbine|navelbine/i, name: "Vinorelbine", cls: "Chemotherapy (vinca)", cancers: ["lung", "breast"], tags: ["cyto"], watch: "Neutropenia, constipation/ileus, neuropathy, vein irritation." },
    { re: /topotecan|hycamtin|lurbinectedin|zepzelca/i, name: "Topotecan / lurbinectedin", cls: "Chemotherapy", cancers: ["lung"], tags: ["cyto"], watch: "Myelosuppression (neutropenia, thrombocytopenia), fatigue; lurbinectedin hepatotoxicity, CYP3A4 interactions." },
    { re: /doxorubicin|adriamycin|epirubicin|ellence/i, name: "Anthracycline (doxorubicin / epirubicin)", cls: "Chemotherapy (anthracycline)", cancers: ["breast"], tags: ["cyto"],
      watch: "Cardiotoxicity (cumulative dose: baseline and follow-up echo), neutropenia, nausea, mucositis, red urine (harmless), extravasation injury." },
    { re: /cyclophosphamide|cytoxan|procytox/i, name: "Cyclophosphamide", cls: "Chemotherapy (alkylator)", cancers: ["breast"], tags: ["cyto"], watch: "Neutropenia, nausea, hemorrhagic cystitis (hydrate), SIADH/hyponatremia." },
    { re: /eribulin|halaven/i, name: "Eribulin", cls: "Chemotherapy", cancers: ["breast"], tags: ["cyto", "qt"], watch: "Neutropenia, neuropathy, QTc." },
    { re: /capecitabine|xeloda|capox|xelox/i, name: "Capecitabine", cls: "Chemotherapy (oral fluoropyrimidine)", cancers: ["breast", "crc"], tags: ["cyto"],
      watch: "Diarrhea, hand–foot syndrome, mucositis; severe early toxicity if DPD deficient (DPYD). Raises INR markedly with warfarin. Coronary vasospasm (chest pain → stop, ECG/troponin). Reduce dose if CrCl 30–50; avoid < 30. Hold if not eating/drinking." },
    { re: /fluorouracil|5-?fu\b|folfox|folfiri|folfoxiri/i, name: "5-Fluorouracil (5-FU)", cls: "Chemotherapy (fluoropyrimidine)", cancers: ["crc", "breast"], tags: ["cyto"],
      watch: "Often a 46-hour home pump. Mucositis, diarrhea, neutropenia; severe if DPD deficient (uridine triacetate antidote, best within 96 h). Coronary vasospasm: chest pain during infusion → stop pump, ECG, troponin, nitrates; no rechallenge without oncology." },
    { re: /irinotecan|camptosar|folfiri|folfoxiri/i, name: "Irinotecan", cls: "Chemotherapy (topoisomerase I)", cancers: ["crc"], tags: ["cyto"],
      watch: "Early diarrhea/cramps/sweating within 24 h (cholinergic → atropine); late diarrhea (day 2–10) → loperamide 4 mg then 2 mg q2h until 12 h free of diarrhea, fluids, admit if fever or dehydrated. Neutropenia. Worse with UGT1A1*28 or high bilirubin." },
    { re: /trifluridine|tipiracil|lonsurf/i, name: "Trifluridine/tipiracil", cls: "Chemotherapy (oral)", cancers: ["crc"], tags: ["cyto"], watch: "Neutropenia (common), anemia, nausea." },
    // ---------- CRC biologics ----------
    { re: /bevacizumab|avastin|mvasi|zirabev|aflibercept|zaltrap|ramucirumab|cyramza/i, name: "Anti-VEGF (bevacizumab / aflibercept / ramucirumab)", cls: "Anti-VEGF", cancers: ["crc", "lung", "breast"], tags: ["vegf"],
      watch: "Hypertension, proteinuria, bleeding, GI perforation (new abdominal pain → CT), arterial clots, poor wound healing: hold at least 4–6 weeks before elective surgery and about 4 weeks after." },
    { re: /cetuximab|erbitux|panitumumab|vectibix/i, name: "Anti-EGFR (cetuximab / panitumumab)", cls: "Anti-EGFR antibody", cancers: ["crc"], tags: ["egfrab"],
      watch: "Acneiform rash (doxycycline or minocycline), hypomagnesemia (often with low K and Ca – check Mg), paronychia, infusion reactions (cetuximab), ILD rare." },
    { re: /regorafenib|stivarga|fruquintinib|fruzaqla/i, name: "Regorafenib / fruquintinib", cls: "Multi-kinase / VEGFR TKI", cancers: ["crc"], tags: ["vegf"], watch: "Hand–foot skin reaction, hypertension, hepatotoxicity (regorafenib), proteinuria, bleeding, perforation." },
    // ---------- bone ----------
    { re: /denosumab|xgeva|prolia/i, name: "Denosumab", cls: "Bone-targeted", cancers: ["breast", "prostate", "lung"], tags: ["bone"],
      watch: "Hypocalcemia (check Ca and vitamin D; give calcium/vitamin D), osteonecrosis of the jaw (dental review). Do not stop abruptly long term – rebound vertebral fractures." },
    { re: /zoledronic|zometa|aclasta|pamidronate|aredia/i, name: "Zoledronic acid / pamidronate", cls: "Bone-targeted (bisphosphonate)", cancers: ["breast", "prostate", "lung"], tags: ["bone"],
      watch: "Acute-phase reaction (fever, aches day 1–3), hypocalcemia, kidney toxicity (dose by CrCl for bone mets), osteonecrosis of the jaw." },
  ];

  // Supportive / interacting drugs (not anticancer) used by the safety checks
  const S = {
    steroid: /dexamethasone|decadron|prednisone|prednisolone|methylprednisolone|solu-?medrol|hydrocortisone|solu-?cortef/i,
    dex: /dexamethasone|decadron/i,
    doac: /apixaban|eliquis|rivaroxaban|xarelto|edoxaban|lixiana|savaysa|dabigatran|pradaxa/i,
    warfarin: /warfarin|coumadin/i,
    anticoag: /apixaban|rivaroxaban|edoxaban|dabigatran|warfarin|enoxaparin|dalteparin|tinzaparin|heparin|fondaparinux/i,
    qt: /ondansetron|granisetron|haloperidol|quetiapine|citalopram|escitalopram|methadone|domperidone|amiodarone|sotalol|levofloxacin|moxifloxacin|ciprofloxacin|azithromycin|clarithromycin|erythromycin|fluconazole|voriconazole|posaconazole|hydroxychloroquine|olanzapine|risperidone|tacrolimus|methotrimeprazine|prochlorperazine|droperidol/i,
    cyp3a4inh: /clarithromycin|erythromycin|ketoconazole|itraconazole|voriconazole|posaconazole|fluconazole|ritonavir|cobicistat|nirmatrelvir|paxlovid|diltiazem|verapamil|grapefruit/i,
    cyp2d6inh: /paroxetine|fluoxetine|bupropion|quinidine|terbinafine/i,
    ppi: /pantoprazole|omeprazole|esomeprazole|lansoprazole|rabeprazole|dexlansoprazole|famotidine|ranitidine/i,
    nsaid: /ibuprofen|naproxen|diclofenac|ketorolac|celecoxib|meloxicam|indomethacin|ketoprofen/i,
    gcsf: /filgrastim|neupogen|grastofil|nivestym|pegfilgrastim|neulasta|lapelga|fulphila|ziextenzo/i,
    tmpsmx: /sulfamethoxazole|trimethoprim|septra|bactrim|cotrimoxazole|atovaquone|dapsone|pentamidine/i,
    antiandro: /bicalutamide|casodex|flutamide|nilutamide|enzalutamide|apalutamide|darolutamide/i,
    calciumD: /calcium carbonate|calcium citrate|calcium \d|cholecalciferol|vitamin d|ergocalciferol|calcitriol/i,
    loperamide: /loperamide|imodium/i,
    opioid: /morphine|hydromorphone|oxycodone|fentanyl|methadone|codeine|tramadol|tapentadol/i,
  };

  function match(medTexts) {
    const out = [];
    D.forEach((d) => { const hits = medTexts.filter((t) => d.re.test(t)); if (hits.length) out.push(Object.assign({}, d, { orders: hits })); });
    return out;
  }
  const api = { DRUGS: D, SUPPORT: S, match };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else window.OncDrugs = api;
})();
