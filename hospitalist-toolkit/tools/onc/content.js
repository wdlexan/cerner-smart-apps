/* Oncology tab: reference content for each cancer and the oncologic emergency cards.
   UNVERIFIED draft written by Claude from general knowledge (BC Cancer, CCO, ASCO, ESMO, NCCN-type guidance and landmark trials, to mid-2026).
   Regimens are named, not dosed: the BC Cancer protocol is the source of truth for doses. Verify before clinical use. */
(function () {
  const BC = "https://www.bccancer.bc.ca/health-professionals/clinical-resources/chemotherapy-protocols/";
  const LINKS = {
    lung: BC + "lung", breast: BC + "breast", crc: BC + "gastrointestinal", prostate: BC + "genitourinary",
    supportive: BC + "supportive-care", leuk: BC + "leukemia-bone-marrow-transplant", lymph: BC + "lymphoma-myeloma", melanoma: BC + "skin-melanoma", hn: BC + "head-neck",
    fn: "https://www.bccancer.bc.ca/health-professionals/clinical-resources/cancer-management-manual/supportive-care/febrile-neutropenia" };
  const go = (k, t) => `<a href="#" data-goto="${k}">${t}</a>`;
  const tk = (k, t) => `<a href="#" data-toolkit="${k}">${t}</a>`; // another toolkit tab
  const ref = (n, url, title) => `<a href="${url}" target="_blank" rel="noopener" title="${title}">[${n}]</a>`; // outside source link

  const CANCERS = [
  // =====================================================================================
  { key: "lung", name: "Lung", full: "Lung cancer (NSCLC and SCLC)", link: LINKS.lung,
    intro: `<b>Two diseases.</b> Non-small cell (NSCLC, ~85%: adenocarcinoma, squamous) and small cell (SCLC, ~15%, smokers, fast, chemo-sensitive, paraneoplastic).`,
    sections: [
    { t: "At a glance: intent and biomarkers", open: true, h: `
      <table><tr><th>Setting</th><th>Intent</th></tr>
        <tr><td>NSCLC stage I–III, limited-stage SCLC</td><td><b>Curative</b></td></tr>
        <tr><td>NSCLC stage IV, extensive-stage SCLC</td><td><b>Palliative</b>, but survival with a driver mutation can be many years. Oligometastatic disease is sometimes treated radically.</td></tr></table>
      <ul>
        <li><b>Biomarkers for every non-squamous NSCLC</b> (and never-smokers with squamous): EGFR, ALK, ROS1, BRAF V600E, KRAS G12C, MET exon 14, RET, NTRK, HER2 (ERBB2) mutation, plus <b>PD-L1 TPS</b>.</li>
        <li>Early stage: EGFR, ALK and PD-L1 are needed before surgery or adjuvant decisions.</li>
        <li>Driver-positive tumours usually do <b>not</b> get immunotherapy first (little benefit, more toxicity, especially before or with osimertinib).</li>
        <li>Staging: CT chest/abdomen, PET-CT, <b>MRI brain</b> (stage II and up, or any neuro symptoms), EBUS for mediastinal nodes.</li>
      </ul>` },
    { t: "Treatment for cure", open: false, h: `
      <table><tr><th>Stage</th><th>Usual approach</th></tr>
        <tr><td>I (N0)</td><td>Lobectomy (or segmentectomy if ≤2 cm peripheral) with node sampling. <b>SBRT</b> if not fit for surgery. EGFR+ stage IB: adjuvant osimertinib.</td></tr>
        <tr><td>II–IIIA resectable</td><td>Perioperative or neoadjuvant <b>platinum doublet + immunotherapy</b> (nivolumab, pembrolizumab or durvalumab) → surgery → adjuvant immunotherapy. Or surgery → adjuvant platinum chemo → atezolizumab (PD-L1 ≥1%).<br><b>EGFR+</b>: adjuvant osimertinib for 3 years. <b>ALK+</b>: adjuvant alectinib for 2 years.</td></tr>
        <tr><td>III unresectable</td><td>Concurrent <b>platinum chemoradiation</b> → durvalumab for 12 months (PACIFIC). EGFR+: osimertinib after chemoradiation (LAURA).</td></tr>
        <tr><td>Limited-stage SCLC</td><td>Concurrent cisplatin (or carboplatin) + etoposide with thoracic RT → <b>durvalumab consolidation</b> (ADRIATIC). Brain MRI surveillance or prophylactic cranial irradiation. Very early T1–2 N0: surgery then chemo.</td></tr></table>` },
    { t: "Palliative / metastatic options", open: false, h: `
      <h4>NSCLC with a driver (targeted pill first)</h4>
      <table><tr><th>Driver</th><th>Usual first choice</th></tr>
        <tr><td>EGFR (exon 19 del, L858R)</td><td>Osimertinib (± platinum-pemetrexed, FLAURA2) or amivantamab + lazertinib (MARIPOSA)</td></tr>
        <tr><td>ALK</td><td>Alectinib or lorlatinib (brigatinib)</td></tr>
        <tr><td>ROS1</td><td>Entrectinib, crizotinib, repotrectinib</td></tr>
        <tr><td>BRAF V600E</td><td>Dabrafenib + trametinib (or encorafenib + binimetinib)</td></tr>
        <tr><td>KRAS G12C</td><td>Usually chemo-immunotherapy first; sotorasib or adagrasib later</td></tr>
        <tr><td>MET exon 14 / RET / NTRK</td><td>Capmatinib or tepotinib / selpercatinib or pralsetinib / larotrectinib or entrectinib</td></tr>
        <tr><td>HER2 mutation</td><td>Trastuzumab deruxtecan (usually after first line)</td></tr></table>
      <h4>NSCLC without a driver</h4>
      <ul>
        <li><b>PD-L1 ≥50%</b>: pembrolizumab (or cemiplimab, atezolizumab) alone, or chemo-immunotherapy if bulky/symptomatic.</li>
        <li><b>PD-L1 &lt;50%</b>: platinum doublet + pembrolizumab (pemetrexed for non-squamous; carboplatin + paclitaxel or nab-paclitaxel for squamous). Alternative: nivolumab + ipilimumab ± 2 cycles of chemo.</li>
        <li>Maintenance: pemetrexed ± immunotherapy (non-squamous).</li>
        <li>Later: docetaxel (± ramucirumab), ADCs (datopotamab deruxtecan after EGFR TKI), trials.</li>
      </ul>
      <h4>Extensive-stage SCLC</h4>
      <ul><li>Carboplatin + etoposide + atezolizumab or durvalumab → maintenance immunotherapy.</li>
        <li>Second line: lurbinectedin, topotecan, <b>tarlatamab</b> (DLL3 bispecific: CRS/ICANS – ${tk("bsab", "CRS/ICANS tab")}).</li>
        <li>Brain RT for brain mets; consolidative thoracic RT in selected patients.</li></ul>
      <h4>Local palliation</h4>
      <ul><li>RT for hemoptysis, bone pain, airway or SVC compression (8 Gy single fraction for bone pain).</li>
        <li>Bronchoscopy (debulking, stent), indwelling pleural catheter or pleurodesis, SRS or whole-brain RT.</li></ul>` },
    { t: "What to watch for in hospital", open: true, h: `
      <table><tr><th>Problem</th><th>Clue</th><th>Do</th></tr>
        <tr><td><b>Pneumonitis</b> (immunotherapy, TKI, ADC, radiation)</td><td>New cough, hypoxia, ground-glass on CT, 1–6 months after RT</td><td>Hold the drug, CT, sputum/viral swab ± bronchoscopy to exclude infection; grade ≥2: prednisone 1–2 mg/kg. ${tk("tox", "Oncology toxicity tab")}</td></tr>
        <tr><td>Massive hemoptysis</td><td>&gt;100–200 mL, or any with instability</td><td>Bleeding side down, airway, TXA, stop anticoagulants, IR bronchial artery embolization / bronchoscopy, RT. ${go("emerg", "Emergencies")}</td></tr>
        <tr><td>SVC syndrome</td><td>Face/arm swelling, chest-wall veins, worse lying</td><td>CT with contrast; <b>biopsy before steroids</b> if lymphoma possible; stent if stridor/confusion. ${go("emerg", "Emergencies")}</td></tr>
        <tr><td>Malignant pleural / pericardial effusion</td><td>Dyspnea, tachycardia, low BP (tamponade)</td><td>Thoracentesis (cytology); echo; pericardiocentesis if tamponade</td></tr>
        <tr><td>Brain mets</td><td>Headache, seizure, confusion, focal signs</td><td>MRI; dexamethasone only if symptomatic edema; antiseizure drug only after a seizure; rad onc</td></tr>
        <tr><td>Hyponatremia (SIADH)</td><td>Mostly SCLC; also cisplatin, cyclophosphamide, vinca, opioids, nausea</td><td>Exclude adrenal insufficiency and hypothyroid. ${tk("hypona", "Sodium tab")}</td></tr>
        <tr><td>Hypercalcemia</td><td>Squamous (PTHrP)</td><td>${go("emerg", "Emergencies")}</td></tr>
        <tr><td>Paraneoplastic</td><td>LEMS (proximal weakness, SCLC), cerebellar, ectopic ACTH (low K, high glucose, SCLC)</td><td>VGCC antibodies, AM cortisol/ACTH; neurology</td></tr>
        <tr><td>VTE</td><td>High risk (adenocarcinoma, ALK/ROS1, amivantamab + lazertinib)</td><td>Low threshold to image; check drug interactions before choosing anticoagulant</td></tr>
        <tr><td>Radiation esophagitis</td><td>Odynophagia during/after chest RT</td><td>Viscous lidocaine mixes, PPI, nutrition, exclude candida</td></tr>
      </table>
      <ul>
        <li><b>Do not stop an EGFR/ALK pill</b> for long without oncology: disease can flare within days. Hold for surgery/procedures only as oncology advises.</li>
        <li>Osimertinib, crizotinib, selpercatinib: QTc (ECG, K, Mg). ALK drugs: bradycardia. Lorlatinib: lipids, mood. Many CYP3A4 interactions.</li>
      </ul>` },
    { t: "When to call oncology urgently", open: false, h: `<ul>
      <li>Febrile neutropenia, suspected pneumonitis grade ≥2, any immune side effect grade ≥2.</li>
      <li>New cord compression, SVC syndrome, new brain mets, massive hemoptysis (also rad onc).</li>
      <li>Before holding or stopping a targeted pill or immunotherapy.</li>
      <li>Big drop in performance status: changes what treatment is possible and is the time for a goals-of-care talk.</li></ul>` },
    { t: "Prognosis (rough) and goals of care", open: false, h: `
      <table><tr><th>Setting</th><th>Rough outlook</th></tr>
        <tr><td>Stage I resected</td><td>5-year survival ~70–90%</td></tr>
        <tr><td>Stage III</td><td>5-year ~35–55% with chemoradiation + durvalumab</td></tr>
        <tr><td>Stage IV EGFR / ALK</td><td>Median survival ~3–5+ years (ALK longest)</td></tr>
        <tr><td>Stage IV no driver, chemo-immunotherapy</td><td>Median ~1.5–2 years; ~20–30% of PD-L1-high alive at 5 years</td></tr>
        <tr><td>Limited-stage SCLC</td><td>Median ~4–5 years with durvalumab consolidation</td></tr>
        <tr><td>Extensive-stage SCLC</td><td>Median ~12–13 months</td></tr></table>
      <p class="muted">From trial medians; individuals vary widely. Performance status (ECOG) is the strongest bedside predictor.</p>` } ] },

  // =====================================================================================
  { key: "breast", name: "Breast", full: "Breast cancer", link: LINKS.breast,
    intro: `<b>Subtype drives everything:</b> HR+/HER2− (~70%), HER2+ (~15–20%), triple-negative (TNBC, ~10–15%). "HER2-low" (IHC 1+ or 2+/ISH−) matters for trastuzumab deruxtecan.`,
    sections: [
    { t: "At a glance: intent and biomarkers", open: true, h: `
      <table><tr><th>Setting</th><th>Intent</th></tr>
        <tr><td>Stage I–III (including inflammatory)</td><td><b>Curative</b></td></tr>
        <tr><td>Stage IV</td><td><b>Palliative</b>, with median survival of years for HR+ and HER2+</td></tr></table>
      <ul>
        <li>ER, PR, HER2 (IHC/ISH), Ki-67, grade; genomic score (e.g. Oncotype DX) for HR+ early disease.</li>
        <li><b>Germline BRCA1/2</b> testing for those who qualify (PARP inhibitor eligibility, family).</li>
        <li>Metastatic HR+: tumour or ctDNA testing for <b>ESR1, PIK3CA, AKT1, PTEN</b> at progression.</li>
        <li>New metastasis: biopsy when possible (receptors can change).</li>
      </ul>` },
    { t: "Treatment for cure", open: false, h: `
      <ul><li><b>Surgery</b>: lumpectomy + RT, or mastectomy; sentinel node biopsy. RT after mastectomy if node-positive or large tumour.</li></ul>
      <table><tr><th>Subtype</th><th>Usual approach</th></tr>
        <tr><td>HR+/HER2−</td><td><b>Endocrine therapy 5–10 years</b> (tamoxifen premenopausal; aromatase inhibitor postmenopausal; ovarian suppression + AI for high-risk premenopausal).<br>Chemo if high risk or high genomic score (AC→paclitaxel, or docetaxel-cyclophosphamide).<br>High-risk: adjuvant <b>abemaciclib 2 years</b> or <b>ribociclib 3 years</b>; <b>olaparib 1 year</b> if gBRCA.<br>Postmenopausal: zoledronic acid every 6 months for 3 years (bone and recurrence benefit).</td></tr>
        <tr><td>HER2+</td><td>≥T1c or node-positive: neoadjuvant chemo (e.g. docetaxel + carboplatin, or AC→taxane) + <b>trastuzumab + pertuzumab</b> → surgery → complete 1 year of HER2 therapy. Residual disease → <b>T-DM1</b> (KATHERINE). Small node-negative: paclitaxel + trastuzumab.</td></tr>
        <tr><td>Triple-negative</td><td>Stage II–III: neoadjuvant <b>pembrolizumab + carboplatin/paclitaxel → AC/EC</b> (KEYNOTE-522) → surgery → adjuvant pembrolizumab. Residual disease → capecitabine, or olaparib if gBRCA.</td></tr></table>` },
    { t: "Palliative / metastatic options", open: false, h: `
      <table><tr><th>Subtype</th><th>Usual sequence</th></tr>
        <tr><td>HR+/HER2−</td><td>1st line: <b>aromatase inhibitor (or fulvestrant) + CDK4/6 inhibitor</b> (ribociclib, palbociclib, abemaciclib).<br>Then by mutation: ESR1 → elacestrant (or newer oral SERD); PIK3CA/AKT1/PTEN → capivasertib or alpelisib + fulvestrant (inavolisib + palbociclib + fulvestrant for early relapse with PIK3CA); everolimus + exemestane; gBRCA → olaparib/talazoparib.<br>Then ADCs: T-DXd (HER2-low/ultralow), sacituzumab govitecan, datopotamab deruxtecan; single-agent chemo (capecitabine, paclitaxel, eribulin).<br><b>Visceral crisis</b> (rapid liver failure, lymphangitic lung) → chemo first.</td></tr>
        <tr><td>HER2+</td><td>1st line: <b>taxane + trastuzumab + pertuzumab</b> → maintenance HP (+ endocrine if HR+). 2nd line: <b>T-DXd</b>. Then tucatinib + trastuzumab + capecitabine (good for brain mets), T-DM1, others.</td></tr>
        <tr><td>Triple-negative</td><td>PD-L1 CPS ≥10: chemo + pembrolizumab. Then sacituzumab govitecan; T-DXd if HER2-low; PARP inhibitor if gBRCA; chemo.</td></tr></table>
      <ul><li><b>Bone mets</b>: denosumab or zoledronic acid (dental check, Ca/vitamin D), RT for pain, orthopedics for impending fracture (Mirels score).</li>
        <li><b>Brain mets</b>: SRS, surgery or whole-brain RT; HER2+ → tucatinib regimen or T-DXd.</li></ul>` },
    { t: "What to watch for in hospital", open: true, h: `
      <table><tr><th>Problem</th><th>Clue</th><th>Do</th></tr>
        <tr><td><b>Cord compression</b> / pathological fracture</td><td>Bone mets + new back pain, weakness, retention</td><td>${go("emerg", "Emergencies")}: dexamethasone, MRI whole spine within 24 h</td></tr>
        <tr><td>Hypercalcemia</td><td>Bone mets, thirst, confusion, constipation</td><td>${go("emerg", "Emergencies")}</td></tr>
        <tr><td>Brain / leptomeningeal mets</td><td>HER2+, TNBC, lobular: headache, cranial nerve palsy, confusion</td><td>MRI brain + spine with gadolinium; LP cytology if leptomeningeal suspected</td></tr>
        <tr><td>Liver mets / visceral crisis</td><td>Rising bilirubin, ALP, INR</td><td>Urgent oncology (chemo may need to start quickly); exclude biliary obstruction</td></tr>
        <tr><td>Effusions</td><td>Pleural or pericardial</td><td>Thoracentesis, echo</td></tr>
        <tr><td>Lobular cancer spread</td><td>GI wall, peritoneum, ureters, mimics GI primary</td><td>Hydronephrosis, bowel obstruction: ${tk("pc", "Peritoneal carcinomatosis tab")}</td></tr>
        <tr><td>Heart failure</td><td>Anthracycline (cumulative), trastuzumab (usually reversible)</td><td>Echo; hold HER2 drug and call oncology</td></tr>
        <tr><td>ILD on T-DXd</td><td>New cough, dyspnea, fever</td><td>CT; stop drug; steroids for grade ≥2</td></tr>
        <tr><td>Hyperglycemia / DKA</td><td>Alpelisib, inavolisib, capivasertib, everolimus</td><td>Glucose checks; hold drug; metformin first line, insulin if high</td></tr>
        <tr><td>VTE</td><td>Tamoxifen, abemaciclib, chemo</td><td>Treat; ask oncology about stopping tamoxifen</td></tr>
      </table>
      <ul>
        <li><b>Ribociclib</b>: QTc (avoid ondansetron/haloperidol stacking; ECG). <b>Abemaciclib, neratinib, sacituzumab</b>: diarrhea. CDK4/6 drugs: CYP3A4 interactions (clarithromycin, azoles).</li>
        <li><b>Tamoxifen</b> with paroxetine, fluoxetine or bupropion: reduced effect – prefer venlafaxine, citalopram or escitalopram.</li>
        <li>Lymphedema arm: limited evidence that BP cuffs/IVs cause harm, but use the other arm when you can (follow local policy).</li>
        <li>Denosumab: low calcium; do not stop long term without a plan (rebound fractures).</li>
      </ul>` },
    { t: "When to call oncology urgently", open: false, h: `<ul>
      <li>Febrile neutropenia; cord compression; new brain mets; hypercalcemia; rapidly rising bilirubin (visceral crisis).</li>
      <li>New heart failure on HER2 therapy; suspected ILD on T-DXd; DKA on a PI3K/AKT drug.</li>
      <li>Before holding endocrine, CDK4/6 or HER2 therapy for more than a few days.</li></ul>` },
    { t: "Prognosis (rough) and goals of care", open: false, h: `
      <table><tr><th>Setting</th><th>Rough outlook</th></tr>
        <tr><td>Stage I–II</td><td>5-year survival &gt;90%</td></tr>
        <tr><td>Stage III</td><td>5-year ~70–85%</td></tr>
        <tr><td>Metastatic HR+/HER2− (CDK4/6 era)</td><td>Median ~5 years</td></tr>
        <tr><td>Metastatic HER2+</td><td>Median ~5+ years</td></tr>
        <tr><td>Metastatic triple-negative</td><td>Median ~1.5–2 years</td></tr></table>
      <p class="muted">Liver failure from mets, leptomeningeal disease and declining ECOG mean much shorter survival.</p>` } ] },

  // =====================================================================================
  { key: "crc", name: "Colorectal", full: "Colorectal cancer", link: LINKS.crc,
    intro: `<b>Even some stage IV is curable</b>: limited liver or lung mets can be resected or ablated. Peritoneal disease: ${tk("pc", "Peritoneal carcinomatosis tab")}.`,
    sections: [
    { t: "At a glance: intent and biomarkers", open: true, h: `
      <table><tr><th>Setting</th><th>Intent</th></tr>
        <tr><td>Stage I–III colon and rectum</td><td><b>Curative</b></td></tr>
        <tr><td>Oligometastatic liver/lung (resectable)</td><td><b>Curative intent</b> (refer to HPB / thoracic surgery)</td></tr>
        <tr><td>Unresectable stage IV</td><td><b>Palliative</b> (some become resectable after chemo)</td></tr></table>
      <ul>
        <li><b>MMR/MSI for all</b>; metastatic: <b>KRAS/NRAS, BRAF V600E, HER2</b>; tumour side (left vs right) for anti-EGFR.</li>
        <li><b>DPYD testing</b> before 5-FU/capecitabine is recommended and offered in many Canadian centres: check whether it was done.</li>
        <li>Baseline CEA; CT chest/abdomen/pelvis; rectal: pelvic MRI.</li>
      </ul>` },
    { t: "Treatment for cure", open: false, h: `
      <table><tr><th>Stage</th><th>Usual approach</th></tr>
        <tr><td>Colon I</td><td>Surgery alone.</td></tr>
        <tr><td>Colon II</td><td>Surgery. Adjuvant chemo only if high-risk (T4, obstruction/perforation, &lt;12 nodes, LVI) <b>and</b> pMMR. dMMR stage II: no 5-FU alone.</td></tr>
        <tr><td>Colon III</td><td>Surgery → <b>CAPOX 3 months</b> (T1–3 N1) or <b>FOLFOX/CAPOX 6 months</b> (T4 or N2). Frail/older: capecitabine alone. dMMR stage III: FOLFOX + atezolizumab (ATOMIC) where available.</td></tr>
        <tr><td>Rectal II–III</td><td><b>Total neoadjuvant therapy</b>: short-course RT (5 × 5 Gy) or chemoradiation with capecitabine, plus FOLFOX/CAPOX → TME surgery, or <b>watch-and-wait</b> if clinical complete response. <b>dMMR rectal</b>: dostarlimab alone (high complete response rates, organ-sparing).</td></tr>
        <tr><td>Liver / lung mets, resectable</td><td>Perioperative FOLFOX/CAPOX + resection, ablation or SBRT. 5-year survival ~40–50% after liver resection.</td></tr></table>` },
    { t: "Palliative / metastatic options", open: false, h: `
      <table><tr><th>Tumour</th><th>Usual first line</th></tr>
        <tr><td><b>dMMR / MSI-high</b></td><td>Pembrolizumab, or nivolumab + ipilimumab: durable responses</td></tr>
        <tr><td>pMMR, RAS/BRAF wild-type, <b>left-sided</b></td><td>FOLFOX or FOLFIRI + <b>panitumumab or cetuximab</b></td></tr>
        <tr><td>pMMR, <b>right-sided or RAS-mutant</b></td><td>FOLFOX/CAPOX or FOLFIRI (FOLFOXIRI if fit) + <b>bevacizumab</b></td></tr>
        <tr><td>BRAF V600E</td><td>Encorafenib + cetuximab (+ mFOLFOX6 first line, BREAKWATER)</td></tr>
        <tr><td>HER2-amplified</td><td>Trastuzumab + tucatinib; T-DXd (later lines)</td></tr>
        <tr><td>KRAS G12C</td><td>Sotorasib or adagrasib + anti-EGFR (later lines)</td></tr></table>
      <ul>
        <li>Later lines: trifluridine/tipiracil + bevacizumab, regorafenib, fruquintinib. Maintenance: capecitabine ± bevacizumab.</li>
        <li>Frail: capecitabine ± bevacizumab, or best supportive care.</li>
        <li>Local: colonic stent or diverting stoma for obstruction; RT for rectal bleeding/pain; biliary stent for jaundice.</li>
      </ul>` },
    { t: "What to watch for in hospital", open: true, h: `
      <table><tr><th>Problem</th><th>Clue</th><th>Do</th></tr>
        <tr><td>Bowel obstruction</td><td>Distension, vomiting, no flatus</td><td>CT; surgery or GI (stent/stoma). ${tk("pc", "Peritoneal carcinomatosis tab")} for malignant bowel obstruction</td></tr>
        <tr><td>Perforation</td><td>Sudden pain, peritonism; higher on <b>bevacizumab</b></td><td>CT, urgent surgery</td></tr>
        <tr><td>Severe early toxicity on 5-FU/capecitabine</td><td>Mucositis, diarrhea, neutropenia in cycle 1</td><td>Think <b>DPD deficiency</b>; stop drug; uridine triacetate (best within 96 h) – call oncology/pharmacy</td></tr>
        <tr><td><b>Chest pain on 5-FU/capecitabine</b></td><td>During infusion pump or tablets</td><td>Coronary vasospasm: stop pump, ECG, troponin, nitrates/CCB; no rechallenge without oncology</td></tr>
        <tr><td><b>Irinotecan diarrhea</b></td><td>Early (&lt;24 h, cramps, sweating) or late (day 2–10)</td><td>Early: atropine. Late: loperamide 4 mg then 2 mg q2h until 12 h free of diarrhea; fluids; C. difficile; admit if fever, dehydrated or neutropenic</td></tr>
        <tr><td>Oxaliplatin throat symptoms</td><td>Cold-triggered throat tightness, normal sats</td><td>Laryngopharyngeal dysesthesia: reassure, avoid cold drinks; exclude anaphylaxis</td></tr>
        <tr><td>Low Mg (± K, Ca)</td><td>Cetuximab, panitumumab</td><td>Replace Mg; ${tk("lytes", "Electrolytes tab")}</td></tr>
        <tr><td>High-output stoma</td><td>&gt;1.5–2 L/day</td><td>AKI, low Mg/Na; loperamide, oral rehydration solution, limit hypotonic drinks</td></tr>
        <tr><td>Liver mets</td><td>Jaundice, biliary obstruction, cholangitis</td><td>US/CT, ERCP/PTC; bilirubin changes irinotecan dosing</td></tr>
        <tr><td>VTE</td><td>Common</td><td>DOAC or LMWH; caution with luminal tumour in place (bleeding)</td></tr>
      </table>
      <ul><li><b>Anti-VEGF</b>: hypertension, proteinuria, bleeding, wound healing – hold at least 4–6 weeks before elective surgery.</li>
        <li><b>Capecitabine + warfarin</b>: INR can rise a lot – check INR often or switch anticoagulant.</li>
        <li>Rising CEA after curative treatment → recurrence work-up (CT).</li></ul>` },
    { t: "When to call oncology urgently", open: false, h: `<ul>
      <li>Febrile neutropenia; severe diarrhea or mucositis (DPD deficiency?); chest pain on 5-FU/capecitabine.</li>
      <li>Perforation or obstruction (also surgery); new jaundice.</li>
      <li>Home 5-FU pump problems (leak, early empty, disconnect) – call the cancer centre.</li></ul>` },
    { t: "Prognosis (rough) and goals of care", open: false, h: `
      <table><tr><th>Setting</th><th>Rough outlook</th></tr>
        <tr><td>Stage I</td><td>5-year survival ~90%</td></tr>
        <tr><td>Stage II</td><td>~80%</td></tr>
        <tr><td>Stage III</td><td>~65–75% (wide range by T and N)</td></tr>
        <tr><td>Resected liver mets</td><td>~40–50% at 5 years</td></tr>
        <tr><td>Unresectable metastatic pMMR</td><td>Median ~2.5–3 years; BRAF V600E shorter</td></tr>
        <tr><td>Metastatic dMMR on immunotherapy</td><td>Many long-term responders</td></tr></table>` } ] },

  // =====================================================================================
  { key: "prostate", name: "Prostate", full: "Prostate cancer", link: LINKS.prostate,
    intro: `<b>Most men live a long time with it.</b> Metastatic disease goes from hormone-sensitive (mHSPC) to castration-resistant (mCRPC: progression with testosterone &lt;1.7 nmol/L).
      <div style="margin-top:6px"><a href="prostate-drugs.pdf?v=20261126a" target="_blank" rel="noopener"><b>Common prostate cancer drugs: usual doses and side effects (PDF)</b></a> · <a href="https://www.bccancer.bc.ca/health-professionals/clinical-resources/cancer-drug-manual/drug-index" target="_blank" rel="noopener">BC Cancer Drug Manual</a></div>`,
    sections: [
    { t: "At a glance: intent and biomarkers", open: true, h: `
      <table><tr><th>Setting</th><th>Intent</th></tr>
        <tr><td>Localized (any risk group)</td><td><b>Curative</b> (or active surveillance for low risk)</td></tr>
        <tr><td>PSA rise after surgery/RT</td><td>Salvage treatment, still <b>curative intent</b></td></tr>
        <tr><td>Metastatic</td><td><b>Palliative</b>; median survival ~5+ years for mHSPC</td></tr></table>
      <ul>
        <li>PSA, Grade Group (Gleason), stage → risk group (low / intermediate / high / very high).</li>
        <li><b>PSMA PET</b> for staging high-risk disease and for PSA recurrence.</li>
        <li><b>Germline testing</b> (BRCA2, ATM and others) for metastatic or high-risk disease; tumour HRR genes for mCRPC (PARP inhibitor).</li>
      </ul>` },
    { t: "Treatment for cure", open: false, h: `
      <table><tr><th>Risk group</th><th>Usual approach</th></tr>
        <tr><td>Low (GG1, PSA &lt;10)</td><td><b>Active surveillance</b> (PSA, MRI, repeat biopsy). Watchful waiting if limited life expectancy.</td></tr>
        <tr><td>Favourable intermediate</td><td>Surveillance (selected), radical prostatectomy, or RT (external beam or brachytherapy)</td></tr>
        <tr><td>Unfavourable intermediate</td><td>RT + <b>short-term ADT (4–6 months)</b>, or prostatectomy</td></tr>
        <tr><td>High / very high</td><td>RT + <b>long-term ADT (18–36 months)</b>; very high-risk or node-positive: add <b>abiraterone for 2 years</b> (STAMPEDE). Prostatectomy + pelvic nodes in selected men.</td></tr>
        <tr><td>PSA recurrence after prostatectomy</td><td>Salvage RT ± ADT, guided by PSMA PET</td></tr></table>` },
    { t: "Palliative / metastatic options", open: false, h: `
      <table><tr><th>State</th><th>Usual approach</th></tr>
        <tr><td><b>mHSPC</b></td><td>Continuous ADT (leuprolide, goserelin, degarelix or relugolix) <b>+ ARPI</b> (abiraterone + prednisone, enzalutamide, apalutamide or darolutamide).<br>High-volume and fit: <b>triplet</b> ADT + docetaxel + darolutamide (ARASENS) or abiraterone (PEACE-1).<br>Low-volume: add RT to the prostate.</td></tr>
        <tr><td>Non-metastatic CRPC (PSA doubling ≤10 months)</td><td>ADT + apalutamide, enzalutamide or darolutamide</td></tr>
        <tr><td><b>mCRPC</b></td><td>Change class: docetaxel + prednisone; cabazitaxel; <b>lutetium-177 PSMA</b>; <b>PARP inhibitor</b> (olaparib; niraparib + abiraterone; talazoparib + enzalutamide) for HRR/BRCA; radium-223 (symptomatic bone-only, no visceral mets); pembrolizumab if MSI-high. Switching one ARPI to another rarely works.</td></tr></table>
      <ul><li>ADT continues through every line, including chemo.</li>
        <li><b>Bone</b>: denosumab or zoledronic acid for mCRPC bone mets (fewer skeletal events), with calcium/vitamin D; single 8 Gy RT for painful mets.</li></ul>` },
    { t: "What to watch for in hospital", open: true, h: `
      <table><tr><th>Problem</th><th>Clue</th><th>Do</th></tr>
        <tr><td><b>Cord compression</b></td><td>Back pain, then weakness, sensory level, retention</td><td>${go("emerg", "Emergencies")}. Untreated prostate cancer: start <b>degarelix</b> (no flare) or bicalutamide first</td></tr>
        <tr><td><b>Testosterone flare</b></td><td>First 1–3 weeks of a GnRH agonist: more bone pain, retention, cord compression</td><td>Antiandrogen (bicalutamide) 1 week before and 2–4 weeks after, or use degarelix/relugolix</td></tr>
        <tr><td>Urinary retention, hydronephrosis</td><td>Rising creatinine, poor flow</td><td>Catheter; US kidneys; urology (nephrostomy/stent)</td></tr>
        <tr><td>Hematuria, clot retention</td><td>After RT (radiation cystitis) or local progression</td><td>3-way catheter, bladder irrigation; urology</td></tr>
        <tr><td><b>Abiraterone</b></td><td>Low K, hypertension, edema; LFTs</td><td>Must have prednisone. <b>Acutely ill: stress-dose steroids</b>; NPO → IV hydrocortisone. Do not stop prednisone suddenly</td></tr>
        <tr><td>Enzalutamide / apalutamide</td><td>Falls, fractures, confusion, seizures (rare)</td><td><b>Strong CYP3A4 inducers</b>: lower DOAC levels (apixaban, rivaroxaban) – ask pharmacy (LMWH often chosen)</td></tr>
        <tr><td>ADT long term</td><td>QTc, diabetes, cardiovascular events, osteoporosis, anemia, depression</td><td>ECG with QT drugs; bone density, Ca/vitamin D</td></tr>
        <tr><td>Cytopenias</td><td>Docetaxel, cabazitaxel (febrile neutropenia), Lu-PSMA, radium-223, PARP inhibitors, marrow infiltration</td><td>CBC; blood film (leukoerythroblastic); DIC screen if bleeding</td></tr>
        <tr><td>Low calcium</td><td>Osteoblastic mets + denosumab</td><td>Ca, vitamin D, replace</td></tr>
      </table>` },
    { t: "When to call oncology urgently", open: false, h: `<ul>
      <li>Cord compression (also rad onc and spine), febrile neutropenia.</li>
      <li>Acute illness on abiraterone (steroid cover), new bilateral hydronephrosis.</li>
      <li>Before stopping ADT or an ARPI.</li></ul>` },
    { t: "Prognosis (rough) and goals of care", open: false, h: `
      <table><tr><th>Setting</th><th>Rough outlook</th></tr>
        <tr><td>Localized low/intermediate risk</td><td>10-year prostate-cancer survival &gt;95%</td></tr>
        <tr><td>High-risk localized</td><td>Most cured or controlled for many years</td></tr>
        <tr><td>mHSPC (doublet/triplet era)</td><td>Median ~5–7 years</td></tr>
        <tr><td>mCRPC</td><td>Median ~2–3 years; visceral (liver) mets shorter</td></tr></table>` } ] },

  // =====================================================================================
  { key: "leuk", name: "Leukemia", full: "Leukemia (AML, APL, ALL, CML, CLL)", link: LINKS.leuk,
    intro: `<b>Acute (AML, ALL) = emergency, usually admitted for induction. Chronic (CML, CLL) = often found on a routine CBC.</b> APL is the AML you must not miss: it bleeds (DIC) but is >90% curable – start ATRA on suspicion.`,
    sections: [
    { t: "At a glance: types and intent", open: true, h: `
      <table><tr><th>Type</th><th>Who / clue</th><th>Intent</th></tr>
        <tr><td><b>AML</b></td><td>Median age ~68; cytopenias, blasts, Auer rods, gum hypertrophy (monocytic)</td><td><b>Curative</b> if fit for intensive chemo ± transplant; unfit → disease control (venetoclax + azacitidine)</td></tr>
        <tr><td><b>APL</b>: acute promyelocytic leukemia (APML, M3; AML with PML-RARA) – see the APL section below</td><td>Bleeding, DIC, low fibrinogen, often low WBC</td><td><b>Curative</b> (>90%) if the first 2 weeks are survived</td></tr>
        <tr><td><b>ALL</b></td><td>Children and older adults; nodes, mediastinal mass, CNS; ~25–30% of adults Ph+ (BCR-ABL)</td><td><b>Curative</b> intent</td></tr>
        <tr><td><b>CML</b></td><td>High WBC with all stages of granulocytes, basophilia, big spleen; BCR-ABL</td><td>TKI → near-normal life expectancy; some can stop (treatment-free remission)</td></tr>
        <tr><td><b>CLL</b></td><td>Older adults; lymphocytosis, smudge cells, nodes</td><td>Not cured with standard therapy, but long survival; many never need treatment</td></tr></table>
      <h4>Work-up of a suspected acute leukemia</h4>
      <ul><li>CBC + <b>blood film</b>, <b>PT/INR, PTT, fibrinogen</b> (DIC), LDH, urate, K, PO4, Ca, creatinine (TLS).</li>
        <li>Peripheral flow cytometry; bone marrow with cytogenetics and molecular tests (FLT3, NPM1, IDH1/2, TP53, BCR-ABL).</li>
        <li>HLA typing (transplant candidates), echo before anthracycline, HBV/HCV/HIV, CMV, pregnancy test; CT head if neuro signs or severe coagulopathy.</li>
        <li>CLL: flow cytometry of blood is enough; IGHV status and del(17p)/TP53 before treatment.</li></ul>` },
    { t: "APL: acute promyelocytic leukemia (APML, M3 leukemia)", open: true, h: `
      <p><b>Acute promyelocytic leukemia</b> (also called <b>APML</b> or <b>M3 leukemia</b>; AML with PML::RARA) is a rare, fast-growing subtype of acute myeloid leukemia (AML). It is treated as an <b>urgent oncologic emergency</b> because of a high risk of life-threatening bleeding and clotting early in the illness.
        <span class="muted">Read more: ${ref(1, "https://www.acep.org/criticalcare/newsroom/newsroom-articles/january-2025/acutepromleuk", "ACEP Critical Care, Jan 2025")} ${ref(2, "https://my.clevelandclinic.org/health/diseases/acute-promyelocytic-leukemia", "Cleveland Clinic")} ${ref(3, "https://www.bloodcancer.org.nz/assets-prod/downloads/Information-Booklets-SS-Documents/LBCNZ-APL-DIGITAL.pdf", "Leukaemia & Blood Cancer NZ booklet (PDF)")} ${ref(4, "https://myhealth.alberta.ca/Health/pages/conditions.aspx?hwid=tn10219&", "MyHealth Alberta")} ${ref(5, "https://www.mskcc.org/cancer-care/types/leukemias/types/acute-promyelocytic-leukemia-apl", "Memorial Sloan Kettering")}</span></p>
      <div class="flag red"><b>Why APL is a medical emergency</b><ul style="margin:4px 0 0 18px;padding:0">
        <li><b>Severe bleeding and clotting:</b> APL frequently causes disseminated intravascular coagulation (DIC) and low platelets, leading to dangerous bleeding (including in the brain or lungs) alongside abnormal blood clots. ${ref(1, "https://www.youtube.com/watch?v=FDUNpXuUoKM&t=191", "Video (YouTube)")} ${ref(2, "https://myhealth.alberta.ca/Health/pages/conditions.aspx?hwid=tn10219&", "MyHealth Alberta")}</li>
        <li><b>Rapid early risk:</b> without prompt recognition, supportive blood transfusions and targeted therapy, early death can occur quickly after presentation. Doctors often start treatment immediately on strong suspicion rather than waiting for all test results. ${ref(1, "https://jamanetwork.com/journals/jama/article-abstract/201358", "JAMA")} ${ref(2, "https://www.acep.org/criticalcare/newsroom/newsroom-articles/january-2025/acutepromleuk", "ACEP Critical Care")}</li>
        <li><b>Treatment-related emergencies:</b> early treatment with differentiating agents (ATRA, arsenic trioxide) can trigger <b>differentiation syndrome (retinoic acid syndrome)</b>, a serious reaction that needs close monitoring and prompt care. ${ref(1, "https://johnshopkinshealthcare.staywellsolutionsonline.com/HealthyKidsTeens/34,BAMLT11", "Johns Hopkins (StayWell)")}</li></ul></div>
      <h4>Recognize it</h4>
      <ul><li>New leukemia (or pancytopenia) with <b>bruising, bleeding gums, nosebleeds, heavy periods or blood in urine</b>; headache or new neuro signs = intracranial bleed until proven otherwise.</li>
        <li>Labs: <b>low fibrinogen</b>, high INR, very high D-dimer, low platelets; WBC is often <b>low</b> (WBC &gt;10 = high risk).</li>
        <li>Blood film: abnormal promyelocytes with heavy granules and <b>Auer rods</b> (bundles = "faggot cells"). Confirm by PML::RARA (FISH or PCR) and marrow, but <b>do not wait</b> for these.</li></ul>
      <h4>Do now (on suspicion)</h4>
      <ul><li><b>Start ATRA (tretinoin)</b> right away and call hematology now.</li>
        <li>Support: platelets &gt;30–50 ×10⁹/L, fibrinogen &gt;1.5 g/L (cryoprecipitate), FFP for high INR; coagulation tests every 6–8 h at first.</li>
        <li>No LP, central line or invasive procedure until the coagulopathy is corrected; CT head for any headache or neuro change.</li>
        <li>Watch for differentiation syndrome (retinoic acid syndrome; fever, breathlessness, low O2, infiltrates, effusions, weight gain, low BP, AKI) and QTc on arsenic (ECG; K ≥4, Mg ≥0.9). ${go("emerg", "Emergencies: APL and DIC, Differentiation syndrome (retinoic acid syndrome)")}</li></ul>
      <p class="muted">Outlook: &gt;90% are cured if the first 2 weeks are survived; most early deaths are from bleeding.</p>` },
    { t: "Treatment for cure", open: false, h: `
      <table><tr><th>Type</th><th>Usual approach</th></tr>
        <tr><td>AML, fit</td><td><b>"7+3"</b> induction (cytarabine 7 days + daunorubicin or idarubicin 3 days) ± midostaurin or quizartinib (FLT3), ± gemtuzumab (favourable risk). CPX-351 for therapy-related or MDS-related AML. Consolidation: high-dose cytarabine, or <b>allogeneic stem cell transplant</b> for intermediate/adverse risk. Maintenance oral azacitidine in selected patients.</td></tr>
        <tr><td>APL</td><td><b>ATRA + arsenic trioxide</b>, no chemo (WBC ≤10). High risk (WBC >10): ATRA + arsenic + idarubicin or gemtuzumab. Start ATRA as soon as APL is suspected.</td></tr>
        <tr><td>ALL</td><td>Multi-agent pediatric-inspired regimens (vincristine, steroid, asparaginase, anthracycline, cyclophosphamide, methotrexate, cytarabine) with <b>intrathecal CNS prophylaxis</b>, then ~2 years maintenance (mercaptopurine, methotrexate). <b>Blinatumomab</b> added in consolidation. Ph+: <b>TKI (dasatinib or ponatinib) + steroid ± blinatumomab</b>. Transplant for high risk or MRD-positive.</td></tr>
        <tr><td>CML</td><td>TKI: imatinib, dasatinib, nilotinib, bosutinib, asciminib. BCR-ABL PCR every 3 months; treatment-free remission trial after a deep, sustained response.</td></tr></table>` },
    { t: "Unfit, relapsed and palliative options", open: false, h: `
      <ul>
        <li><b>AML unfit/older</b>: venetoclax + azacitidine (or decitabine); IDH1 → ivosidenib + azacitidine; relapsed FLT3 → gilteritinib; IDH2 → enasidenib; menin inhibitors for KMT2A-rearranged or NPM1-mutated relapse where available; low-dose cytarabine; or supportive care (hydroxyurea, transfusion, antibiotics, palliative care).</li>
        <li><b>ALL relapse</b>: blinatumomab, inotuzumab, CAR-T (brexucabtagene/tisagenlecleucel), transplant.</li>
        <li><b>CLL</b> – treat only if indicated (progressive marrow failure Hb &lt;100 or plt &lt;100, bulky/progressive nodes or spleen, lymphocyte doubling &lt;6 months, B symptoms, autoimmune cytopenia not responding to steroids):
          continuous <b>BTK inhibitor</b> (acalabrutinib, zanubrutinib, ibrutinib) or fixed-duration <b>venetoclax + obinutuzumab</b> (1 year) or venetoclax + BTK inhibitor. TP53/del(17p): no chemo. Later: pirtobrutinib, CAR-T, transplant.</li>
        <li><b>CML</b> resistant or accelerated: switch TKI by mutation (ponatinib/asciminib for T315I), transplant.</li>
      </ul>` },
    { t: "What to watch for in hospital", open: true, h: `
      <table><tr><th>Problem</th><th>Clue</th><th>Do</th></tr>
        <tr><td><b>Febrile neutropenia</b></td><td>AML induction: ANC &lt;0.5 for 3–4 weeks</td><td>${go("emerg", "Emergencies")}; antifungal prophylaxis (posaconazole) is common – check interactions</td></tr>
        <tr><td><b>Leukostasis</b></td><td>WBC &gt;100 (AML; ALL &gt;400): hypoxia, confusion, headache, vision change, priapism</td><td>Hydroxyurea, urgent hematology, avoid RBC transfusion unless needed (viscosity), TLS prevention. ${go("emerg", "Emergencies")}</td></tr>
        <tr><td><b>DIC / bleeding</b></td><td>APL, monocytic AML: low fibrinogen, high INR, low platelets</td><td>Keep platelets &gt;30–50, fibrinogen &gt;1.5 g/L (cryo), FFP for INR; no LP or central line until corrected</td></tr>
        <tr><td><b>Tumour lysis</b></td><td>High WBC, high LDH, ALL, venetoclax ramp-up</td><td>${go("emerg", "Emergencies")}: fluids, allopurinol or rasburicase (G6PD)</td></tr>
        <tr><td><b>Differentiation syndrome (retinoic acid syndrome)</b></td><td>ATRA, arsenic, IDH inhibitors, gilteritinib: fever, hypoxia, infiltrates, effusions, weight gain, AKI</td><td>Dexamethasone 10 mg IV q12h; hold drug if severe; hematology</td></tr>
        <tr><td>Spurious lab results</td><td>Very high WBC</td><td>Low PaO2 on ABG (cells use the oxygen – trust pulse oximetry) and high K (pseudohyperkalemia – repeat on heparin/whole blood)</td></tr>
        <tr><td>CLL infections and autoimmunity</td><td>Low IgG, recurrent infections; AIHA, ITP</td><td>IVIG if recurrent serious infection with low IgG; DAT; steroids for AIHA/ITP</td></tr>
        <tr><td>Richter transformation</td><td>CLL with a fast-growing node, B symptoms, high LDH</td><td>PET-CT and biopsy</td></tr>
        <tr><td>CNS leukemia</td><td>ALL, monocytic AML: headache, cranial nerve palsy</td><td>MRI, LP (after coagulopathy and blasts in blood are addressed)</td></tr>
        <tr><td>Asparaginase</td><td>Pancreatitis, cerebral venous thrombosis (headache, seizure), low fibrinogen</td><td>Lipase, CT venogram, replace fibrinogen per protocol</td></tr>
      </table>
      <ul>
        <li><b>Interactions</b>: azoles (posaconazole, voriconazole) with venetoclax, vincristine (severe neurotoxicity), midostaurin, TKIs; <b>mercaptopurine + allopurinol</b>; high-dose methotrexate with PPIs, NSAIDs, TMP-SMX, penicillins; QTc with arsenic, nilotinib, quizartinib, gilteritinib, azoles, ondansetron.</li>
        <li>Blood products: irradiated after purine analogues, in transplant candidates and recipients; ask hematology.</li>
        <li>Do not stop a TKI, BTK inhibitor or venetoclax without hematology.</li>
      </ul>` },
    { t: "When to call hematology urgently", open: false, h: `<ul>
      <li>Blasts on the film or a new unexplained high WBC with cytopenias: same day.</li>
      <li><b>Suspected APL</b> (blasts/promyelocytes + DIC or low fibrinogen): now – ATRA is started before confirmation.</li>
      <li>WBC &gt;100 or leukostasis symptoms, DIC, febrile neutropenia, differentiation syndrome (retinoic acid syndrome), TLS.</li>
      <li>Blinatumomab or CAR-T side effects; before stopping a TKI, BTK inhibitor or venetoclax.</li></ul>` },
    { t: "Prognosis (rough) and goals of care", open: false, h: `
      <table><tr><th>Setting</th><th>Rough outlook</th></tr>
        <tr><td>AML, intensive treatment</td><td>5-year survival ~40–50% under 60; ~10–20% over 60</td></tr>
        <tr><td>AML, venetoclax + azacitidine</td><td>Median ~15 months; some long remissions</td></tr>
        <tr><td>AML untreated</td><td>Weeks to a few months</td></tr>
        <tr><td>APL</td><td>&gt;90% cured; early deaths are mostly bleeding in the first 2 weeks</td></tr>
        <tr><td>Adult ALL</td><td>~40–60% long-term (better if younger; Ph+ improving with TKI + blinatumomab)</td></tr>
        <tr><td>CML chronic phase</td><td>Near-normal life expectancy</td></tr>
        <tr><td>CLL</td><td>Often &gt;10 years; TP53 shorter</td></tr></table>
      <p class="muted">Older patients with AML and poor performance status: goals-of-care talk early – intensive and low-intensity treatment both mean many hospital days.</p>` } ] },

  // =====================================================================================
  { key: "lymph", name: "Lymphoma", full: "Lymphoma (Hodgkin and non-Hodgkin)", link: LINKS.lymph,
    intro: `<b>Aggressive</b> (DLBCL, Burkitt, Hodgkin, CNS lymphoma, most T-cell) = treat now, curative intent. <b>Indolent</b> (follicular, marginal zone, small lymphocytic) = often watch-and-wait, long survival, usually not cured. <b>No steroids before the biopsy</b> unless life-threatening (they can melt the tumour and spoil the diagnosis).`,
    sections: [
    { t: "At a glance: types and intent", open: true, h: `
      <table><tr><th>Type</th><th>Behaviour</th><th>Intent</th></tr>
        <tr><td><b>DLBCL</b> (most common)</td><td>Aggressive</td><td><b>Curative</b>: ~60–70% cured first line</td></tr>
        <tr><td><b>Hodgkin</b></td><td>Young adults and &gt;60; mediastinal mass, itch, alcohol-induced node pain</td><td><b>Curative</b>: ~85–90%</td></tr>
        <tr><td>Burkitt / high-grade (double-hit)</td><td>Very aggressive, highest TLS risk</td><td><b>Curative</b> with intensive chemo</td></tr>
        <tr><td>Primary CNS lymphoma</td><td>Confusion, focal deficits, eye involvement</td><td><b>Curative</b> intent with high-dose methotrexate</td></tr>
        <tr><td>Follicular, marginal zone</td><td>Indolent</td><td>Control; median survival &gt;15–20 years; early-stage follicular can be cured with RT</td></tr>
        <tr><td>Mantle cell</td><td>Variable</td><td>Mostly control, years of survival</td></tr>
        <tr><td>Peripheral T-cell</td><td>Aggressive</td><td>Curative intent but poorer outcomes</td></tr></table>
      <h4>Work-up</h4>
      <ul><li><b>Excisional or core biopsy</b> (not fine needle aspirate). PET-CT for staging (Lugano).</li>
        <li>CBC, LDH, urate, creatinine, LFTs; <b>HBsAg, anti-HBc</b>, HCV, HIV before rituximab; echo before anthracycline.</li>
        <li>IPI (age &gt;60, high LDH, ECOG ≥2, stage III–IV, &gt;1 extranodal site). CNS risk (high CNS-IPI, testis, kidney/adrenal, breast) → MRI ± LP.</li>
        <li>B symptoms: fever, drenching night sweats, weight loss &gt;10% in 6 months.</li></ul>` },
    { t: "Treatment for cure", open: false, h: `
      <table><tr><th>Type</th><th>Usual approach</th></tr>
        <tr><td>DLBCL</td><td><b>R-CHOP × 6</b> (4 + 2 rituximab if limited, low risk), or <b>Pola-R-CHP</b> (IPI 2–5). Limited stage: shorter chemo ± RT. Double/triple-hit: DA-EPOCH-R or R-CHOP. Over 80: R-mini-CHOP. Older/frail: prednisone prephase (1 week) lowers early toxicity.<br>Relapse within 12 months or refractory: <b>CAR-T</b> (axicabtagene, lisocabtagene). Later relapse: salvage (R-ICE, R-GDP) + autologous transplant; bispecifics (glofitamab, epcoritamab), polatuzumab-BR, tafasitamab-lenalidomide, loncastuximab.</td></tr>
        <tr><td>Hodgkin</td><td>Early: ABVD × 2–4 ± involved-site RT (PET-adapted). Advanced: <b>nivolumab-AVD</b>, brentuximab-AVD, or ABVD with PET-adapted bleomycin drop; escalated BEACOPP-type regimens in younger patients in some centres. Relapse: salvage + autologous transplant ± brentuximab maintenance; checkpoint inhibitors.</td></tr>
        <tr><td>Burkitt</td><td>DA-EPOCH-R or CODOX-M/IVAC with CNS prophylaxis; rasburicase and aggressive TLS prevention.</td></tr>
        <tr><td>Primary CNS</td><td><b>High-dose methotrexate</b>-based induction (with rituximab, cytarabine, thiotepa) → thiotepa-based autologous transplant or whole-brain RT; older: methotrexate-rituximab ± maintenance.</td></tr>
        <tr><td>Follicular stage I–II</td><td>Involved-site RT (can be curative)</td></tr>
        <tr><td>Mantle cell, young fit</td><td>BTK inhibitor-containing induction ± autologous transplant; rituximab maintenance</td></tr></table>` },
    { t: "Indolent, relapsed and palliative options", open: false, h: `
      <ul>
        <li><b>Follicular, advanced</b>: watch-and-wait if low tumour burden. Treat if bulky, symptomatic or cytopenias: bendamustine-rituximab, R-CHOP/R-CVP, obinutuzumab-based; rituximab maintenance; lenalidomide + rituximab. Later: bispecifics (mosunetuzumab, epcoritamab), CAR-T. Sudden growth or high LDH = <b>transformation</b> to DLBCL (biopsy, treat as DLBCL).</li>
        <li><b>Marginal zone</b>: gastric MALT → H. pylori eradication; rituximab; BTK inhibitors.</li>
        <li><b>Mantle cell, older</b>: bendamustine-rituximab ± acalabrutinib; BTK inhibitors; venetoclax; brexucabtagene CAR-T.</li>
        <li><b>Older/frail aggressive lymphoma</b>: R-mini-CHOP, palliative RT, steroids, bispecifics; palliative care.</li>
        <li><b>T-cell</b>: CHOP, or brentuximab-CHP if CD30+; transplant in first remission for fit patients.</li>
      </ul>` },
    { t: "What to watch for in hospital", open: true, h: `
      <table><tr><th>Problem</th><th>Clue</th><th>Do</th></tr>
        <tr><td><b>Tumour lysis</b></td><td>Burkitt, bulky DLBCL, high LDH, first cycle</td><td>${go("emerg", "Emergencies")}: fluids, allopurinol or rasburicase (G6PD), labs q6–12h</td></tr>
        <tr><td><b>Febrile neutropenia</b></td><td>Day 7–14 after R-CHOP</td><td>${go("emerg", "Emergencies")}; G-CSF prophylaxis is common (age &gt;65, curative intent)</td></tr>
        <tr><td><b>Mediastinal mass</b></td><td>Hodgkin, primary mediastinal B-cell, lymphoblastic: orthopnea, stridor, SVC</td><td>Do not lie flat for procedures; anesthesia early (general anesthesia can collapse the airway); biopsy under local if possible. ${go("emerg", "SVC card")}</td></tr>
        <tr><td>Cord compression, bowel obstruction or perforation</td><td>GI lymphoma can perforate after chemo starts</td><td>${go("emerg", "Emergencies")}; surgical review</td></tr>
        <tr><td>Hypercalcemia</td><td>Calcitriol-driven</td><td>Steroids work well; ${go("emerg", "Emergencies")}</td></tr>
        <tr><td><b>Hepatitis B reactivation</b></td><td>Rituximab/obinutuzumab: rising ALT</td><td>HBsAg/anti-HBc positive → entecavir or tenofovir before and for ≥12 months after; check HBV DNA if ALT rises</td></tr>
        <tr><td>Steroid hyperglycemia</td><td>Prednisone 100 mg days 1–5 of R-CHOP</td><td>Glucose checks, prandial insulin on steroid days</td></tr>
        <tr><td>Vincristine</td><td>Constipation/ileus, neuropathy, SIADH</td><td>Bowel regimen from day 1; avoid azoles</td></tr>
        <tr><td>Bleomycin lung</td><td>Cough, dyspnea, crackles (ABVD)</td><td>Stop drug, CT; lowest FiO2 for sats 88–92%</td></tr>
        <tr><td>CRS / ICANS</td><td>CAR-T, glofitamab, epcoritamab, mosunetuzumab</td><td>${tk("bsab", "CRS/ICANS tab")}; call the CAR-T team before treating</td></tr>
        <tr><td>Infections</td><td>PJP (bendamustine, purine analogues, steroids, CAR-T), zoster, low IgG, CMV</td><td>PJP and antiviral prophylaxis per protocol</td></tr>
        <tr><td><b>HLH</b></td><td>Persistent fever, cytopenias, very high ferritin, big spleen, high triglycerides, low fibrinogen</td><td>Ferritin, triglycerides, fibrinogen, sCD25; HScore; urgent hematology</td></tr>
        <tr><td>High-dose methotrexate (CNS lymphoma)</td><td>AKI, mucositis, delayed clearance</td><td>Alkalinized fluids, levels, leucovorin; glucarpidase if AKI; no PPIs, NSAIDs, TMP-SMX, penicillins</td></tr>
      </table>` },
    { t: "When to call hematology urgently", open: false, h: `<ul>
      <li>Suspected new aggressive lymphoma (rapidly growing nodes, high LDH, B symptoms): arrange biopsy quickly and <b>ask before giving steroids</b>.</li>
      <li>Mediastinal mass with airway or SVC symptoms; cord compression; TLS; febrile neutropenia.</li>
      <li>CRS/ICANS after CAR-T or a bispecific; HBV reactivation; HLH; methotrexate AKI (glucarpidase).</li></ul>` },
    { t: "Prognosis (rough) and goals of care", open: false, h: `
      <table><tr><th>Setting</th><th>Rough outlook</th></tr>
        <tr><td>DLBCL</td><td>~60–70% cured; IPI 0–1 ~90%, IPI 4–5 ~50% or less</td></tr>
        <tr><td>DLBCL relapsed, CAR-T</td><td>~40% long-term remission</td></tr>
        <tr><td>Hodgkin</td><td>~85–90% cured (lower over 60)</td></tr>
        <tr><td>Follicular</td><td>Median survival &gt;15–20 years; progression within 2 years of treatment is worse</td></tr>
        <tr><td>Mantle cell</td><td>Median ~5–10 years with modern treatment</td></tr>
        <tr><td>Primary CNS lymphoma</td><td>~30–50% long-term if fit; older patients worse</td></tr>
        <tr><td>Peripheral T-cell</td><td>5-year ~30–40%</td></tr></table>` } ] }
,
  // =====================================================================================
  { key: "myeloma", name: "Myeloma", full: "Multiple myeloma (and MGUS, smoldering myeloma, plasmacytoma)", link: LINKS.lymph,
    intro: `<b>Think of it</b> in anyone over ~50 with two of: unexplained anemia, back or bone pain, high calcium, AKI, a high total protein (globulin gap), or recurrent infections. <b>Screen with SPEP + immunofixation AND serum free light chains</b> (SPEP alone misses light-chain myeloma, ~15–20%). Not curable for most, but median survival is now <b>many years</b>: treat for control, with curative-type intensity in fit patients.`,
    sections: [
    { t: "At a glance: the plasma cell spectrum and when it is myeloma", open: true, h: `
      <table><tr><th>Condition</th><th>Defined by</th><th>What happens</th></tr>
        <tr><td><b>MGUS</b></td><td>M-protein &lt;30 g/L, marrow clonal plasma cells &lt;10%, <b>no</b> myeloma-defining event</td><td>Watch only (SPEP/FLC yearly or per risk); ~1% per year progress</td></tr>
        <tr><td><b>Smoldering myeloma</b></td><td>M-protein ≥30 g/L or urine M-protein ≥500 mg/24 h, and/or marrow 10–59%, no myeloma-defining event</td><td>Hematology follow-up; high-risk smoldering may be treated</td></tr>
        <tr><td><b>Active multiple myeloma</b></td><td>Marrow clonal plasma cells ≥10% (or biopsy-proven plasmacytoma) <b>plus ≥1 myeloma-defining event</b> (below)</td><td>Treat</td></tr>
        <tr><td>Solitary plasmacytoma</td><td>One bone or soft-tissue lesion, marrow &lt;10%, no CRAB</td><td>Radiotherapy (curative intent); watch for progression</td></tr>
        <tr><td>AL amyloidosis</td><td>Light chains deposit in heart, kidney, nerves, liver, gut</td><td>Different urgency: cardiac amyloid is life-threatening; see Signs</td></tr></table>
      <h4>Myeloma-defining events: SLiM-CRAB</h4>
      <table><tr><th></th><th>Criterion</th></tr>
        <tr><td><b>S</b>ixty</td><td>Clonal plasma cells ≥60% in the marrow</td></tr>
        <tr><td><b>Li</b>ght chains</td><td>Involved:uninvolved serum free light chain ratio ≥100 (involved ≥100 mg/L)</td></tr>
        <tr><td><b>M</b>RI</td><td>&gt;1 focal lesion ≥5 mm on MRI</td></tr>
        <tr><td><b>C</b>alcium</td><td>&gt;2.75 mmol/L, or &gt;0.25 above the upper limit of normal</td></tr>
        <tr><td><b>R</b>enal</td><td>Creatinine &gt;177 µmol/L or CrCl &lt;40 mL/min (from light chains)</td></tr>
        <tr><td><b>A</b>nemia</td><td>Hb &lt;100 g/L, or &gt;20 g/L below normal</td></tr>
        <tr><td><b>B</b>one</td><td>≥1 lytic lesion ≥5 mm on CT, PET-CT or skeletal survey</td></tr></table>
      <h4>Staging and risk</h4>
      <ul><li><b>R-ISS / R2-ISS</b>: β2-microglobulin, albumin, LDH and high-risk FISH. ISS III = β2-microglobulin ≥5.5 mg/L.</li>
        <li><b>High-risk cytogenetics (FISH)</b>: del(17p)/TP53, t(4;14), t(14;16), t(14;20), gain/amplification 1q; "double-hit" = 2 or more. Also circulating plasma cells, extramedullary disease.</li></ul>` },
    { t: "Symptoms", open: true, h: `
      <table><tr><th>Symptom</th><th>Why</th><th>Notes</th></tr>
        <tr><td><b>Bone pain</b>, especially back and ribs</td><td>Lytic lesions, vertebral fractures</td><td>~60–70% at diagnosis. Worse with movement; night pain or a band-like pain = think cord compression</td></tr>
        <tr><td><b>Fatigue, breathlessness</b></td><td>Anemia (normocytic)</td><td>Often the first symptom</td></tr>
        <tr><td>Thirst, polyuria, constipation, nausea, confusion, drowsiness</td><td>Hypercalcemia</td><td>Easy to blame on age or opioids</td></tr>
        <tr><td>Reduced urine, swelling, nausea</td><td>AKI (cast nephropathy, hypercalcemia, dehydration, NSAIDs)</td><td>Often found on bloods, not symptoms</td></tr>
        <tr><td><b>Recurrent infections</b></td><td>Low normal immunoglobulins (immunoparesis), neutropenia, treatment</td><td>Pneumococcal pneumonia, UTIs, zoster</td></tr>
        <tr><td>Weight loss, night sweats</td><td>Tumour burden</td><td>Less prominent than in lymphoma</td></tr>
        <tr><td><b>Leg weakness, numbness, urinary retention</b></td><td>Spinal cord or cauda equina compression</td><td>Emergency</td></tr>
        <tr><td>Tingling, numb feet</td><td>Amyloid or paraprotein neuropathy; later bortezomib/thalidomide</td><td>Carpal tunnel syndrome is an amyloid clue</td></tr>
        <tr><td>Blurred vision, headache, nosebleeds, gum bleeding, confusion, breathlessness</td><td><b>Hyperviscosity</b> (very high IgA, or IgG3; IgM = Waldenström)</td><td>Emergency: plasmapheresis</td></tr>
        <tr><td>Breathlessness, ankle swelling, light-headed on standing, frothy urine, diarrhea</td><td><b>AL amyloidosis</b> (heart, kidney, autonomic nerves, gut)</td><td>Check NT-proBNP, troponin, urine albumin</td></tr></table>` },
    { t: "Signs", open: true, h: `
      <ul>
        <li><b>Pallor</b>; bone tenderness (spine, ribs, sternum, pelvis); <b>height loss or kyphosis</b> from vertebral collapse; a pathologic fracture after little or no trauma.</li>
        <li><b>Neurology</b>: leg weakness, sensory level, brisk or absent reflexes, saddle anesthesia, a palpable bladder = cord or cauda equina compression. Check every patient with back pain.</li>
        <li><b>Dehydration and confusion</b> (hypercalcemia, AKI, sepsis).</li>
        <li>A soft-tissue or bony mass: <b>plasmacytoma</b> (skull, ribs, chest wall, nasopharynx).</li>
        <li>Signs of infection; fever.</li>
        <li><b>Hyperviscosity</b>: mucosal bleeding, retinal vein engorgement ("sausage" veins), retinal hemorrhages on fundoscopy, drowsiness, heart failure.</li>
        <li><b>AL amyloid clues</b>: <b>macroglossia</b> (tooth marks on the tongue), <b>periorbital purpura</b> ("raccoon eyes" after coughing or straining), nephrotic edema, hepatomegaly, low BP or orthostatic drop, heart failure with low voltage on ECG and thick walls on echo, carpal tunnel syndrome, shoulder pad sign.</li>
        <li><b>Not typical</b> of myeloma: big lymph nodes or a big spleen (think lymphoma, Waldenström, CLL, or another diagnosis).</li>
      </ul>` },
    { t: "Investigations", open: true, h: `
      <h4>When to suspect it (and send the screen)</h4>
      <ul><li>Unexplained anemia (normocytic), especially with a <b>high total protein</b> (total protein − albumin ≥ 40 g/L = globulin gap) or a <b>low anion gap</b> (cationic IgG).</li>
        <li>Hypercalcemia with a <b>low or normal PTH</b>; AKI with a bland sediment, or <b>urine protein much higher than the dipstick suggests</b> (dipstick misses light chains).</li>
        <li>Back pain over 50 with red flags; osteoporotic or vertebral fracture with anemia or a raised ESR; recurrent bacterial infections; <b>rouleaux</b> on the smear; a very high ESR.</li>
        <li>NAGMA with low K, low phosphate and glucose in the urine (proximal RTA / Fanconi from light chains): ${tk("acidbase", "Acid-base tab (RTA)")}.</li></ul>
      <h4>Tests</h4>
      <table><tr><th>Test</th><th>What it shows</th></tr>
        <tr><td><b>SPEP + serum immunofixation</b></td><td>The M-protein (g/L) and its type (IgG ~50%, IgA ~20%, light chain only ~15–20%, IgD/IgM/non-secretory rare)</td></tr>
        <tr><td><b>Serum free light chains</b> (κ, λ, ratio)</td><td>Abnormal ratio (normal ~0.26–1.65; adjusted range in CKD). <b>Involved ≥ 500 mg/L with AKI = probable cast nephropathy</b>. Ratio ≥100 = myeloma-defining</td></tr>
        <tr><td>Urine protein electrophoresis + immunofixation (24 h)</td><td>Bence Jones protein; also needed for response monitoring and amyloid. Urine albumin:protein ratio low = light chains; high = glomerular (amyloid)</td></tr>
        <tr><td>CBC, smear, reticulocytes</td><td>Anemia, rouleaux, circulating plasma cells (plasma cell leukemia if ≥5%)</td></tr>
        <tr><td>Creatinine, electrolytes, <b>calcium + albumin</b>, urate, phosphate, total protein, albumin, LDH, <b>β2-microglobulin</b></td><td>CRAB, staging (ISS), TLS risk</td></tr>
        <tr><td>Quantitative IgG, IgA, IgM</td><td>The involved Ig and suppression of the others (immunoparesis)</td></tr>
        <tr><td><b>Bone marrow aspirate and biopsy</b></td><td>Clonal plasma cell % (CD138, κ/λ restriction), <b>FISH</b> (del17p, t(4;14), t(14;16), 1q), ± flow MRD later</td></tr>
        <tr><td><b>Whole-body low-dose CT</b> (preferred) or PET-CT; MRI whole body/spine</td><td>Lytic lesions; MRI for marrow lesions in smoldering myeloma and for <b>suspected cord compression (urgent MRI whole spine)</b>. Skeletal survey is less sensitive. <b>Bone scan is not useful</b> (lytic lesions are cold)</td></tr>
        <tr><td>Serum viscosity</td><td>If symptoms of hyperviscosity or very high M-protein (IgA especially)</td></tr>
        <tr><td>NT-proBNP, troponin, urine albumin, ALP; echo ± cardiac MRI; fat pad or marrow Congo red</td><td>AL amyloidosis screen (any myeloma with HF, nephrotic proteinuria, neuropathy, unexplained low BP)</td></tr>
        <tr><td>Kidney biopsy</td><td>AKI with involved FLC &lt; 500 mg/L, or albuminuria (amyloid, light chain deposition disease)</td></tr>
        <tr><td>Before treatment</td><td>HBsAg, anti-HBc, HCV, HIV, VZV serology; echo (carfilzomib, amyloid); <b>blood group and antibody screen BEFORE daratumumab</b> (it interferes with crossmatching for months)</td></tr></table>
      <p class="muted">Lab pearls: high protein can cause pseudohyponatremia; a paraprotein can interfere with some assays (phosphate, bilirubin, creatinine). Monitoring uses the same test that was abnormal at diagnosis (M-protein or FLC).</p>` },
    { t: "Treatment: newly diagnosed", open: false, h: `
      <p>Decided by hematology, mainly by <b>fitness and transplant eligibility</b> (usually ≤70–75 and fit), not age alone. BC Cancer protocols set the regimen and doses. Common backbone drugs: <b>D</b> = daratumumab (or Isa = isatuximab, anti-CD38), <b>V</b> = bortezomib (proteasome inhibitor), <b>R</b> = lenalidomide (immunomodulator), <b>d</b> = dexamethasone.</p>
      <table><tr><th>Group</th><th>Usual approach</th></tr>
        <tr><td><b>Transplant-eligible</b></td><td>Quadruplet induction <b>D-VRd</b> (or Isa-VRd) ~4–6 cycles → stem cell collection → <b>high-dose melphalan + autologous stem cell transplant</b> → consolidation (2 cycles) → <b>lenalidomide maintenance</b> until progression (± daratumumab or bortezomib for high risk). Some defer transplant to first relapse.</td></tr>
        <tr><td><b>Transplant-ineligible, fit-ish</b></td><td><b>DRd</b> (daratumumab-lenalidomide-dex) continuous, or D-VRd / Isa-VRd then maintenance</td></tr>
        <tr><td><b>Frail</b> (IMWG frailty score)</td><td>Dose-reduced regimens: DRd with low-dose dex, VRd-lite, Rd; dexamethasone 20 mg/week or less; supportive care first</td></tr>
        <tr><td><b>AKI from cast nephropathy</b></td><td><b>Bortezomib-dexamethasone-based</b> (± daratumumab) started urgently (days, not weeks) to drop light chains; lenalidomide needs kidney dose adjustment. Plasma exchange is not routine</td></tr>
        <tr><td>Solitary plasmacytoma</td><td>Involved-site radiotherapy (~40–50 Gy)</td></tr>
        <tr><td>High-risk smoldering</td><td>Hematology may offer early treatment (e.g. daratumumab or Rd) or a trial</td></tr>
        <tr><td>AL amyloidosis</td><td>Dara-CyBorD (daratumumab, cyclophosphamide, bortezomib, dex); careful in cardiac amyloid (fluids, BP, arrhythmias)</td></tr></table>
      <h4>Supportive care (for everyone)</h4>
      <ul>
        <li><b>Bone</b>: zoledronic acid (dose by CrCl; avoid if CrCl &lt; 30) or <b>denosumab</b> (OK in kidney failure, but watch hypocalcemia and rebound on stopping); calcium + vitamin D; dental check (osteonecrosis of the jaw). Vertebroplasty/kyphoplasty for painful fractures; radiotherapy for pain or cord compression; orthopedics for long-bone lesions at risk of fracture.</li>
        <li><b>VTE prophylaxis with lenalidomide, pomalidomide or thalidomide</b>: ASA if low risk; LMWH or a DOAC if higher risk (prior VTE, immobility, high-dose dex, carfilzomib, ESA).</li>
        <li><b>Antiviral prophylaxis</b> (acyclovir or valacyclovir) with bortezomib, carfilzomib, daratumumab, bispecifics and after transplant/CAR-T (zoster risk).</li>
        <li><b>PJP prophylaxis</b> (TMP-SMX) with bispecifics, CAR-T, high-dose steroids; <b>IVIG</b> if IgG &lt; 4 g/L with serious or recurrent infections (common on BCMA bispecifics); vaccines (pneumococcal, influenza, COVID, recombinant zoster).</li>
        <li>Kidney: 2–3 L/day fluids unless heart failure; <b>no NSAIDs</b>; avoid IV contrast where possible (hydrate if needed); dose drugs for CrCl.</li>
        <li>Anemia: transfuse for symptoms; ESA if chemo-related and Hb &lt; 100 (VTE risk). Steroid side effects: glucose, PPI, sleep, mood.</li>
      </ul>` },
    { t: "Treatment: relapsed and later lines", open: false, h: `
      <p>Choice depends on what the myeloma is <b>refractory</b> to (progressed on or within 60 days of): lenalidomide, an anti-CD38 antibody, a proteasome inhibitor ("triple-class").</p>
      <table><tr><th>Setting</th><th>Options (examples)</th></tr>
        <tr><td>First relapse, lenalidomide-refractory</td><td>Carfilzomib-based (<b>KD</b> ± daratumumab/isatuximab), pomalidomide-based (<b>DPd</b>, PVd), <b>CAR-T early</b> (ciltacabtagene autoleucel from 2nd line), belantamab-based (BVd, BPd) where available, second transplant if long first remission</td></tr>
        <tr><td>Not lenalidomide-refractory</td><td>DRd, KRd, IsaKd, DKd</td></tr>
        <tr><td>Triple-class exposed</td><td><b>CAR-T</b> (cilta-cel, ide-cel); <b>BCMA bispecifics</b> (teclistamab, elranatamab, linvoseltamab); <b>GPRC5D bispecific</b> (talquetamab); belantamab mafodotin; selinexor-dex; venetoclax for t(11;14); clinical trials</td></tr>
        <tr><td>Palliative</td><td>Radiotherapy for bone pain, low-dose steroids, cyclophosphamide-based regimens; early palliative care involvement. Many patients live years with sequential lines, so "palliative" does not mean short</td></tr></table>` },
    { t: "What to watch for in hospital", open: true, h: `
      <table><tr><th>Problem</th><th>Clue</th><th>Do</th></tr>
        <tr><td><b>Hypercalcemia</b></td><td>Confusion, constipation, AKI; check corrected (or ionized) Ca</td><td>IV saline, zoledronic acid or denosumab (AKI), calcitonin; <b>steroids help in myeloma</b>; ${go("emerg", "Emergencies")} · ${tk("lytes", "Electrolytes tab")}</td></tr>
        <tr><td><b>AKI / cast nephropathy</b></td><td>Rising creatinine, high involved FLC, bland urine with heavy proteinuria</td><td>Urgent FLC, fluids 2–3 L/day, stop NSAIDs/ACEi/nephrotoxins, treat Ca, <b>hematology today</b> (bortezomib-dex); ${tk("aki", "AKI tab")}</td></tr>
        <tr><td><b>Cord compression</b></td><td>Back pain + any leg weakness, sensory level, retention</td><td>Dexamethasone, <b>MRI whole spine now</b>, rad onc ± spine surgery; ${go("emerg", "Emergencies")}</td></tr>
        <tr><td>Pathologic fracture</td><td>Pain after minimal trauma; hip or long-bone lesions</td><td>Orthopedics (prophylactic fixation), RT after surgery; hip fracture pathway if relevant</td></tr>
        <tr><td><b>Infection</b></td><td>Pneumonia (pneumococcus), UTI, zoster; low IgG; neutropenia</td><td>Low threshold for antibiotics; febrile neutropenia protocol; check IgG; IVIG if very low and recurrent</td></tr>
        <tr><td><b>Hyperviscosity</b></td><td>Mucosal bleeding, visual change, confusion with very high M-protein</td><td>Urgent hematology: <b>plasmapheresis</b>; hydrate; <b>avoid transfusing until viscosity is lowered</b> (raises viscosity)</td></tr>
        <tr><td><b>VTE</b></td><td>Lenalidomide/pomalidomide/thalidomide + dex, carfilzomib</td><td>Check prophylaxis is on the list; image leg swelling or dyspnea</td></tr>
        <tr><td><b>Daratumumab / isatuximab</b></td><td>Positive antibody screen and incompatible crossmatch for up to 6 months</td><td><b>Tell the blood bank</b> the patient is on anti-CD38 before any transfusion (DTT-treated cells, K-negative units); infusion reactions with the first doses</td></tr>
        <tr><td>Bortezomib</td><td>Peripheral neuropathy, orthostatic hypotension, zoster, thrombocytopenia (cyclical), diarrhea</td><td>Antiviral prophylaxis; hold or reduce for painful neuropathy (SC weekly is gentler)</td></tr>
        <tr><td>Carfilzomib</td><td>Hypertension, heart failure, MI, pulmonary hypertension, TMA/AKI, dyspnea</td><td>BP, echo if dyspneic, troponin/NT-proBNP; smear and LDH if AKI with low platelets</td></tr>
        <tr><td>Lenalidomide / pomalidomide</td><td>Cytopenias, rash, diarrhea (lenalidomide), VTE; teratogenic</td><td>Dose lenalidomide by CrCl; hold for neutropenic fever</td></tr>
        <tr><td><b>CRS / ICANS</b></td><td>Teclistamab, elranatamab, talquetamab, linvoseltamab; CAR-T (cilta-cel can cause late parkinsonism and cranial nerve palsy)</td><td>${tk("bsab", "CRS/ICANS tab")}; call the myeloma/CAR-T team before treating</td></tr>
        <tr><td>Talquetamab</td><td>Taste loss, weight loss, nail and skin peeling, dry mouth</td><td>Dietitian; dose spacing by hematology</td></tr>
        <tr><td>Belantamab mafodotin</td><td>Keratopathy: blurred vision, dry eyes</td><td>Eye exam before each dose; lubricating drops</td></tr>
        <tr><td>Selinexor</td><td>Nausea, anorexia, weight loss, <b>hyponatremia</b>, low platelets</td><td>Antiemetics (olanzapine + 5-HT3); Na checks</td></tr>
        <tr><td>Dexamethasone pulses</td><td>Hyperglycemia, insomnia, agitation or psychosis, GI upset</td><td>Glucose checks on dex days; PPI; reduce dose in older patients</td></tr>
        <tr><td>Melphalan / autologous transplant (day 0–30)</td><td>Mucositis, neutropenic fever, diarrhea, engraftment syndrome</td><td>Transplant team manages; febrile neutropenia protocol</td></tr></table>` },
    { t: "When to call hematology urgently", open: false, h: `<ul>
      <li>Suspected new myeloma with <b>AKI</b> (send FLC and SPEP and call the same day: delay costs kidney function), <b>hypercalcemia</b>, cord compression or hyperviscosity.</li>
      <li>Febrile neutropenia; CRS/ICANS after a bispecific or CAR-T; suspected plasma cell leukemia (circulating plasma cells).</li>
      <li>New heart failure, nephrotic syndrome or low BP in a patient with a paraprotein (AL amyloid).</li>
      <li>Before stopping or holding anticancer drugs for more than a few days, or before a transfusion on daratumumab.</li></ul>` },
    { t: "Prognosis (rough) and goals of care", open: false, h: `
      <table><tr><th>Setting</th><th>Rough outlook</th></tr>
        <tr><td>Newly diagnosed, transplant-eligible, standard risk (quadruplet + transplant)</td><td>Median survival &gt;10 years; many in deep remission (MRD-negative) for years</td></tr>
        <tr><td>Transplant-ineligible (DRd)</td><td>Median survival ~6–8 years</td></tr>
        <tr><td>R-ISS I / II / III</td><td>5-year survival roughly ~80% / ~60% / ~40% (older data; better now)</td></tr>
        <tr><td>High-risk (del17p, ≥2 high-risk lesions, plasma cell leukemia)</td><td>Median ~3–5 years</td></tr>
        <tr><td>Triple-class refractory</td><td>~1 year without CAR-T/bispecifics; CAR-T (cilta-cel) median progression-free ~3 years in later lines</td></tr>
        <tr><td>MGUS</td><td>~1% per year progress to myeloma or related disease; most never do</td></tr></table>
      <p class="muted">Frailty, kidney failure that does not recover, and cardiac amyloid lower survival. Discuss goals of care at each relapse; palliative care helps with bone pain and symptom burden at any stage.</p>` } ] }
,


  // =====================================================================================
  { key: "bladder", name: "Bladder", full: "Bladder (urothelial) cancer", link: LINKS.prostate,
    intro: `<b>Two diseases.</b> Non-muscle-invasive (NMIBC, ~75%: TURBT + intravesical BCG/chemo, recurs often but rarely kills) and muscle-invasive (MIBC: cystectomy or bladder-sparing chemoradiation). Painless visible hematuria in a smoker is bladder cancer until cystoscopy says otherwise. Same disease can arise in the renal pelvis/ureter (upper tract urothelial).`,
    sections: [
    { t: "At a glance: intent and biomarkers", open: true, h: `
      <table><tr><th>Setting</th><th>Intent</th></tr>
        <tr><td>NMIBC (Ta, T1, CIS)</td><td><b>Curative</b> / bladder preservation with surveillance cystoscopy</td></tr>
        <tr><td>MIBC (T2–T4a, N0–1)</td><td><b>Curative</b>: neoadjuvant chemo(-immunotherapy) → cystectomy, or trimodality bladder sparing</td></tr>
        <tr><td>Metastatic</td><td><b>Palliative</b>; median survival now ~2.5 years with enfortumab + pembrolizumab</td></tr></table>
      <ul><li>Cystoscopy + TURBT (depth: muscle present?), CT urogram, CT chest; urine cytology.</li>
        <li>Metastatic: <b>FGFR2/3</b> alterations (erdafitinib), HER2 (T-DXd), PD-L1 less important now.</li>
        <li>Cisplatin eligibility (CrCl ≥50–60, ECOG 0–1, no hearing loss/neuropathy/HF) shapes treatment.</li></ul>` },
    { t: "Treatment for cure", open: false, h: `
      <table><tr><th>Setting</th><th>Usual approach</th></tr>
        <tr><td>NMIBC low risk</td><td>TURBT + single post-op intravesical chemo (gemcitabine or mitomycin); surveillance</td></tr>
        <tr><td>NMIBC intermediate/high risk, CIS</td><td>Re-TURBT for T1; <b>intravesical BCG</b> induction + maintenance (1–3 years). BCG-unresponsive: radical cystectomy, or intravesical gemcitabine-docetaxel, newer intravesical agents, pembrolizumab</td></tr>
        <tr><td>MIBC, cisplatin-eligible</td><td><b>Neoadjuvant cisplatin-based chemo</b> (dd-MVAC or gemcitabine-cisplatin), now often <b>with durvalumab perioperatively</b> (NIAGARA) → radical cystectomy + pelvic nodes (ileal conduit or neobladder). Adjuvant nivolumab for high-risk pathology.</td></tr>
        <tr><td>MIBC, cisplatin-ineligible</td><td>Cystectomy (± perioperative enfortumab-pembrolizumab where available) or <b>trimodality therapy</b>: maximal TURBT + RT with radiosensitizing chemo (5-FU/mitomycin, cisplatin or gemcitabine)</td></tr>
        <tr><td>Upper tract urothelial</td><td>Nephroureterectomy ± adjuvant platinum chemo; kidney-sparing for low grade</td></tr></table>` },
    { t: "Palliative / metastatic options", open: false, h: `
      <ul><li><b>1st line: enfortumab vedotin + pembrolizumab</b> (EV-302) – the new standard.</li>
        <li>Alternatives: gemcitabine-cisplatin + nivolumab; platinum chemo → <b>avelumab maintenance</b> if no progression.</li>
        <li>FGFR3 alteration: <b>erdafitinib</b>. HER2-positive: trastuzumab deruxtecan. Sacituzumab (later lines). Single-agent chemo (paclitaxel, docetaxel, vinflunine).</li>
        <li>Local: palliative RT for hematuria and pain; nephrostomy for obstruction (match to goals).</li></ul>` },
    { t: "What to watch for in hospital", open: true, h: `
      <table><tr><th>Problem</th><th>Clue</th><th>Do</th></tr>
        <tr><td>Hematuria, clot retention</td><td>Tumour, radiation cystitis, cyclophosphamide</td><td>3-way catheter, continuous bladder irrigation, urology; hold anticoagulation if possible; RT or embolization for intractable bleeding</td></tr>
        <tr><td>Obstruction, hydronephrosis</td><td>Rising creatinine</td><td>US; nephrostomy or stent (fits goals?)</td></tr>
        <tr><td><b>After cystectomy</b> (ileal conduit / neobladder)</td><td>Hyperchloremic metabolic acidosis, low B12 (late), stomal stenosis, ureteric stricture, urosepsis</td><td>Bicarbonate; catheter samples from the stoma (not the bag) for culture; always colonized – treat only if sick</td></tr>
        <tr><td><b>BCG infection</b> (BCGosis)</td><td>Fever &gt;39 °C or &gt;48 h after BCG, sepsis, granulomatous hepatitis/pneumonitis, mycotic aneurysm</td><td>ID consult; isoniazid + rifampin + ethambutol (BCG resists pyrazinamide) ± steroids; no BCG while sick</td></tr>
        <tr><td><b>Enfortumab vedotin</b></td><td>Rash (can be SJS/TEN), hyperglycemia/DKA, neuropathy, dry eyes</td><td>Hold for severe rash or glucose &gt;14; insulin; dermatology</td></tr>
        <tr><td>Erdafitinib</td><td>High phosphate, eye (central serous retinopathy), nail/mouth changes</td><td>Low-phosphate diet, binders; ophthalmology for vision change</td></tr>
        <tr><td>Cisplatin</td><td>AKI, low Mg, ototoxicity, neuropathy</td><td>${tk("lytes", "Electrolytes tab")}</td></tr>
        <tr><td>Hypercalcemia, VTE</td><td>Advanced disease</td><td>${go("emerg", "Emergencies")}</td></tr></table>` },
    { t: "When to call oncology/urology urgently", open: false, h: `<ul>
      <li>Clot retention or hemorrhage needing transfusion; bilateral obstruction with AKI.</li>
      <li>Fever or sepsis after recent BCG; severe rash on enfortumab; febrile neutropenia; immune side effects.</li></ul>` },
    { t: "Prognosis (rough) and goals of care", open: false, h: `
      <table><tr><th>Setting</th><th>Rough outlook</th></tr>
        <tr><td>NMIBC</td><td>5-year survival ~90%; recurrence common (~50–70%)</td></tr>
        <tr><td>MIBC treated for cure</td><td>5-year ~50–65%</td></tr>
        <tr><td>Metastatic (EV + pembrolizumab)</td><td>Median ~2.5 years</td></tr></table>` } ] },

  // =====================================================================================
  { key: "melanoma", name: "Melanoma", full: "Melanoma", link: LINKS.melanoma,
    intro: `<b>Immunotherapy changed everything:</b> about half of patients with metastatic melanoma on ipilimumab + nivolumab are alive at 10 years. The hospital problems are mostly <b>immune side effects</b>, <b>brain mets</b> and BRAF-inhibitor fevers. Mucosal and uveal melanoma behave differently (uveal → liver).`,
    sections: [
    { t: "At a glance: intent and biomarkers", open: true, h: `
      <table><tr><th>Setting</th><th>Intent</th></tr>
        <tr><td>Stage I–II</td><td><b>Curative</b>: wide excision ± sentinel node biopsy</td></tr>
        <tr><td>Stage III (nodes) and resected IV</td><td><b>Curative</b>: surgery + adjuvant (or neoadjuvant) immunotherapy</td></tr>
        <tr><td>Unresectable stage IV</td><td>Treat with intent of <b>durable control</b>; a minority are effectively cured by immunotherapy</td></tr></table>
      <ul><li><b>BRAF V600</b> mutation (~40–50% of cutaneous) in stage III–IV; also NRAS, KIT (mucosal/acral).</li>
        <li>Staging: Breslow thickness, ulceration, sentinel node; CT/PET and <b>MRI brain</b> for stage III–IV. LDH is prognostic.</li></ul>` },
    { t: "Treatment for cure", open: false, h: `
      <table><tr><th>Setting</th><th>Usual approach</th></tr>
        <tr><td>Stage I–II</td><td>Wide local excision (margins by thickness), sentinel node biopsy if ≥0.8 mm or ulcerated. High-risk IIB–IIC: adjuvant pembrolizumab or nivolumab (1 year).</td></tr>
        <tr><td>Stage III</td><td><b>Neoadjuvant pembrolizumab</b> (or ipilimumab + nivolumab) for clinically detected nodes → surgery → adjuvant; or surgery → adjuvant anti-PD-1 for 1 year; BRAF-mutant: dabrafenib + trametinib for 1 year is an alternative. Completion node dissection rarely now.</td></tr>
        <tr><td>Resected stage IV</td><td>Adjuvant nivolumab (or pembrolizumab)</td></tr></table>` },
    { t: "Metastatic options", open: false, h: `
      <ul><li><b>Ipilimumab + nivolumab</b> (highest response, most toxicity: ~55–60% grade 3–4) – preferred for brain mets and fit patients; or <b>nivolumab + relatlimab</b>; or anti-PD-1 alone (pembrolizumab, nivolumab) for frailer patients.</li>
        <li><b>BRAF V600</b>: dabrafenib + trametinib, encorafenib + binimetinib, or vemurafenib + cobimetinib – fast responses (use for rapid, symptomatic disease or after immunotherapy). Immunotherapy first is generally preferred (DREAMseq).</li>
        <li>After progression: TIL therapy (lifileucel), ipilimumab-based combinations, trials, chemo (limited). Uveal melanoma with HLA-A*02:01: tebentafusp (CRS); liver-directed therapy.</li>
        <li><b>Brain mets</b>: SRS ± ipi/nivo; steroids reduce immunotherapy benefit – use the lowest dose.</li></ul>` },
    { t: "What to watch for in hospital", open: true, h: `
      <table><tr><th>Problem</th><th>Clue</th><th>Do</th></tr>
        <tr><td><b>Immune side effects</b></td><td>Diarrhea/colitis, hepatitis, hypophysitis (headache, fatigue, low Na), thyroiditis, T1DM/DKA, pneumonitis, <b>myocarditis</b> (+ myositis/myasthenia)</td><td>${tk("tox", "Oncology toxicity tab")}; ${go("emerg", "irAE card")}. Ipi/nivo: diarrhea is colitis until proven otherwise</td></tr>
        <tr><td>Hypophysitis / adrenal</td><td>Headache, fatigue, low BP, low Na (ipilimumab especially)</td><td>AM cortisol, ACTH, TSH/free T4, MRI pituitary; hydrocortisone before levothyroxine</td></tr>
        <tr><td><b>BRAF/MEK pyrexia</b></td><td>Fever, chills, rigors on dabrafenib + trametinib</td><td>Hold both drugs; check for infection; antipyretics; prednisone if recurrent; restart when afebrile 24 h</td></tr>
        <tr><td>Brain mets</td><td>Headache, seizure, focal deficit; melanoma mets bleed</td><td>MRI; dexamethasone lowest effective dose; rad onc/neurosurgery; caution with anticoagulation</td></tr>
        <tr><td>GI bleeding / obstruction</td><td>Small-bowel mets (intussusception)</td><td>CT, surgery</td></tr>
        <tr><td>MEK inhibitor</td><td>Reduced LVEF, retinal detachment (blurred vision), rash, CK rise</td><td>Echo, ophthalmology</td></tr>
        <tr><td>Tebentafusp / TIL</td><td>CRS, rash, hypotension; TIL: lymphodepletion, IL-2 capillary leak</td><td>${tk("bsab", "CRS/ICANS tab")}; specialised centre</td></tr></table>` },
    { t: "When to call oncology urgently", open: false, h: `<ul>
      <li>Any grade ≥2 immune side effect, suspected myocarditis (troponin), adrenal crisis, DKA.</li>
      <li>New brain mets or bleeding; recurrent fevers on BRAF/MEK.</li></ul>` },
    { t: "Prognosis (rough) and goals of care", open: false, h: `
      <table><tr><th>Setting</th><th>Rough outlook</th></tr>
        <tr><td>Stage I</td><td>~95–99% at 10 years</td></tr>
        <tr><td>Stage III</td><td>~65–90% at 5 years (substage)</td></tr>
        <tr><td>Metastatic, ipi/nivo</td><td>~50% alive at 10 years</td></tr>
        <tr><td>Metastatic, anti-PD-1 alone</td><td>~35–45% at 5 years</td></tr></table>` } ] },

  // =====================================================================================
  { key: "hn", name: "Head & neck", full: "Head and neck cancer (oral cavity, pharynx, larynx, salivary)", link: LINKS.hn,
    intro: `<b>HPV-positive oropharynx</b> (younger, non-smokers, better prognosis) vs smoking/alcohol-related cancers. Treatment for cure is often surgery or <b>cisplatin-radiation</b> – weeks of mucositis, weight loss and feeding-tube dependence. The airway is the main hospital emergency.`,
    sections: [
    { t: "At a glance: intent and biomarkers", open: true, h: `
      <table><tr><th>Setting</th><th>Intent</th></tr>
        <tr><td>Stage I–II</td><td><b>Curative</b>: surgery or RT alone</td></tr>
        <tr><td>Locally advanced (III–IVB)</td><td><b>Curative</b>: surgery + adjuvant (chemo)RT, or definitive cisplatin-RT</td></tr>
        <tr><td>Recurrent / metastatic</td><td><b>Palliative</b> (salvage surgery or re-irradiation can still cure some)</td></tr></table>
      <ul><li><b>p16/HPV</b> for oropharynx (different staging and outlook); EBV for nasopharynx; <b>PD-L1 CPS</b> for recurrent/metastatic.</li>
        <li>Work-up: scope and biopsy (ENT), CT/MRI neck, PET-CT, dental assessment before RT, nutrition and speech-language pathology baseline.</li></ul>` },
    { t: "Treatment for cure", open: false, h: `
      <table><tr><th>Setting</th><th>Usual approach</th></tr>
        <tr><td>Oral cavity</td><td><b>Surgery first</b> (resection ± neck dissection ± flap) → RT, or cisplatin-RT if positive margins/extranodal extension</td></tr>
        <tr><td>Oropharynx, larynx, hypopharynx</td><td>Organ preservation: <b>RT with weekly or 3-weekly cisplatin</b> (cetuximab-RT if cisplatin unfit, inferior), or transoral surgery for selected early tumours; total laryngectomy for advanced larynx with cartilage destruction</td></tr>
        <tr><td>Nasopharynx</td><td>Induction gemcitabine-cisplatin → cisplatin-RT</td></tr>
        <tr><td>Resectable, newer option</td><td>Perioperative pembrolizumab with surgery and (chemo)RT (KEYNOTE-689) for CPS ≥1 locally advanced disease, where available</td></tr></table>` },
    { t: "Palliative / recurrent options", open: false, h: `
      <ul><li><b>CPS ≥1</b>: pembrolizumab alone, or pembrolizumab + platinum + 5-FU (higher burden/symptoms). CPS &lt;1: platinum + 5-FU + cetuximab (EXTREME) or with pembrolizumab.</li>
        <li>Later: cetuximab, methotrexate, taxanes, trials. Nasopharynx: gemcitabine-cisplatin + toripalimab/camrelizumab-type PD-1.</li>
        <li>Palliative RT (bleeding, pain, airway), tracheostomy, feeding tube, early palliative care (pain, secretions, wound/fungating tumour care).</li></ul>` },
    { t: "What to watch for in hospital", open: true, h: `
      <table><tr><th>Problem</th><th>Clue</th><th>Do</th></tr>
        <tr><td><b>Airway obstruction</b></td><td>Stridor, voice change, can't lie flat</td><td>Sit up, heliox, dexamethasone; ENT and anesthesia now (awake fibreoptic or surgical airway); know whether the patient has a <b>laryngectomy (neck breather – oxygen to the stoma, cannot intubate orally)</b> or tracheostomy</td></tr>
        <tr><td><b>Carotid blowout / tumour bleed</b></td><td>Herald (sentinel) bleed after RT/surgery, fungating neck wound</td><td>Pressure, airway, large-bore access, crossmatch, IR/ENT now; goals of care – crisis medication and dark towels ready</td></tr>
        <tr><td>Mucositis, dysphagia, dehydration</td><td>Weeks 2–7 of chemoRT</td><td>Pain control (opioids, mouthwashes), IV fluids, feeding tube (PEG/NG), dietitian, SLP; aspiration risk</td></tr>
        <tr><td>Cisplatin-RT toxicity</td><td>AKI, low Mg/K/Na, nausea, ototoxicity, neutropenia</td><td>${tk("lytes", "Electrolytes tab")}; hydrate</td></tr>
        <tr><td>Cetuximab</td><td>Infusion reaction, acneiform rash, radiation dermatitis worse, low Mg</td><td>Replace Mg, skin care</td></tr>
        <tr><td>Hypercalcemia</td><td>Squamous (PTHrP)</td><td>${go("emerg", "Emergencies")}</td></tr>
        <tr><td>Late RT effects</td><td>Hypothyroidism, osteoradionecrosis of the jaw, carotid stenosis, trismus, lymphedema</td><td>TSH; dental care before extractions; stroke work-up as usual</td></tr>
        <tr><td>Refeeding, malnutrition</td><td>Big weight loss, alcohol use</td><td>Thiamine, PO4/K/Mg monitoring when feeding starts</td></tr>
        <tr><td>Alcohol withdrawal</td><td>Heavy drinkers admitted for surgery/chemoRT</td><td>CIWA, thiamine</td></tr></table>` },
    { t: "When to call oncology/ENT urgently", open: false, h: `<ul>
      <li>Any stridor or airway change; any bleed from the mouth, neck or tracheostomy (sentinel bleed).</li>
      <li>Cannot swallow fluids or medications during chemoRT; febrile neutropenia.</li></ul>` },
    { t: "Prognosis (rough) and goals of care", open: false, h: `
      <table><tr><th>Setting</th><th>Rough outlook</th></tr>
        <tr><td>HPV+ oropharynx, locally advanced</td><td>5-year survival ~80–90%</td></tr>
        <tr><td>HPV− / smoking-related, locally advanced</td><td>~40–55%</td></tr>
        <tr><td>Recurrent/metastatic on pembrolizumab ± chemo</td><td>Median ~13–15 months; ~20% at 4–5 years with CPS high</td></tr></table>
      <p class="muted">Uncontrolled local disease means airway, bleeding, swallowing and wound problems – plan for these early.</p>` } ] },

  // =====================================================================================
  { key: "kidney", name: "Kidney", full: "Kidney cancer (renal cell carcinoma)", link: LINKS.prostate,
    intro: `<b>Often found incidentally on imaging.</b> Surgery cures most localized disease. Metastatic clear-cell RCC is treated with <b>immunotherapy + VEGF TKI</b> combinations. Paraneoplastic: hypercalcemia, erythrocytosis, fever, Stauffer syndrome (cholestasis without liver mets).`,
    sections: [
    { t: "At a glance: intent and biomarkers", open: true, h: `
      <table><tr><th>Setting</th><th>Intent</th></tr>
        <tr><td>Stage I–III</td><td><b>Curative</b>: partial or radical nephrectomy (or ablation / surveillance for small masses in older patients)</td></tr>
        <tr><td>Oligometastatic</td><td>Metastasectomy or SBRT can give long control</td></tr>
        <tr><td>Metastatic</td><td><b>Palliative</b>, but median survival now &gt;4 years for favourable/intermediate risk</td></tr></table>
      <ul><li>Histology: clear cell (~75%), papillary, chromophobe, others (different drugs).</li>
        <li><b>IMDC risk</b> (time from diagnosis &lt;1 year, KPS &lt;80, low Hb, high corrected Ca, high neutrophils, high platelets).</li>
        <li>Young or bilateral/multifocal: think hereditary (VHL – belzutifan).</li></ul>` },
    { t: "Treatment for cure", open: false, h: `
      <ul><li>Small renal mass (&lt;4 cm): partial nephrectomy, thermal ablation, or active surveillance (older/comorbid).</li>
        <li>Larger/locally advanced: radical nephrectomy (± IVC thrombectomy).</li>
        <li><b>Adjuvant pembrolizumab</b> for 1 year after nephrectomy for intermediate-high/high-risk clear-cell RCC (KEYNOTE-564: survival benefit).</li></ul>` },
    { t: "Metastatic options", open: false, h: `
      <ul><li><b>1st line clear cell</b>: immunotherapy combination – pembrolizumab + axitinib, nivolumab + cabozantinib, pembrolizumab + lenvatinib, or <b>ipilimumab + nivolumab</b> (intermediate/poor risk; drug-free remissions possible).</li>
        <li>Low-volume, slow disease: active surveillance or SBRT first is reasonable.</li>
        <li>Later: cabozantinib, lenvatinib + everolimus, axitinib, <b>belzutifan</b> (HIF-2α), tivozanib, sunitinib/pazopanib.</li>
        <li>Non-clear cell: cabozantinib, pembrolizumab ± lenvatinib, trials.</li>
        <li>Cytoreductive nephrectomy only in selected patients. Bone mets: RT, denosumab/zoledronic acid, orthopedic fixation (RCC bone mets are vascular – embolize before surgery).</li></ul>` },
    { t: "What to watch for in hospital", open: true, h: `
      <table><tr><th>Problem</th><th>Clue</th><th>Do</th></tr>
        <tr><td><b>VEGF TKI</b> (sunitinib, pazopanib, axitinib, cabozantinib, lenvatinib)</td><td>Hypertension, proteinuria, diarrhea, hand–foot, hypothyroidism, hepatotoxicity (pazopanib), bleeding, poor wound healing, perforation, QTc (sunitinib, pazopanib, lenvatinib)</td><td>BP control (amlodipine; avoid diltiazem/verapamil – CYP3A4); TSH; hold before surgery; urine protein</td></tr>
        <tr><td><b>Belzutifan</b></td><td>Anemia (common), <b>hypoxia</b></td><td>Hb, O2 sats; hold if hypoxic; ESA/transfusion</td></tr>
        <tr><td>IO + TKI overlap</td><td>Diarrhea or high LFTs: TKI side effect or immune colitis/hepatitis?</td><td>Hold both; TKI effects settle in days (short half-life except lenvatinib/cabozantinib longer), immune ones need steroids. ${tk("tox", "Oncology toxicity tab")}</td></tr>
        <tr><td>Hypercalcemia</td><td>PTHrP</td><td>${go("emerg", "Emergencies")}</td></tr>
        <tr><td>Hematuria, clot retention</td><td>Primary in place</td><td>Urology; embolization</td></tr>
        <tr><td>IVC tumour thrombus, VTE</td><td>Leg swelling, varicocele (right-sided or non-reducing)</td><td>Imaging; anticoagulation decision with urology/oncology</td></tr>
        <tr><td>Single kidney after nephrectomy</td><td>Lower GFR</td><td>Dose by CrCl; avoid nephrotoxins and contrast without need</td></tr>
        <tr><td>Brain mets</td><td>Hemorrhagic</td><td>MRI; SRS</td></tr></table>` },
    { t: "When to call oncology urgently", open: false, h: `<ul>
      <li>Grade ≥2 immune side effect; severe diarrhea or hepatitis on IO + TKI; hypertensive emergency on a TKI.</li>
      <li>Hypoxia on belzutifan; cord compression; hemorrhage.</li></ul>` },
    { t: "Prognosis (rough) and goals of care", open: false, h: `
      <table><tr><th>Setting</th><th>Rough outlook</th></tr>
        <tr><td>Stage I</td><td>5-year survival ~90%+</td></tr>
        <tr><td>Stage III</td><td>~60–70%</td></tr>
        <tr><td>Metastatic, IO combination</td><td>Median ~4–5 years (favourable risk longer, poor risk ~1.5–2 years)</td></tr></table>` } ] },

  // =====================================================================================
  { key: "panc", name: "Pancreas", full: "Pancreatic cancer (adenocarcinoma)", link: LINKS.crc,
    intro: `<b>Most present unresectable.</b> Only ~15–20% can have surgery. Symptom burden is high: pain, jaundice, weight loss, VTE, diabetes. <b>Early palliative care</b> and a goals-of-care conversation belong in almost every admission. Pancreatic neuroendocrine tumours (PNETs) behave very differently – check the pathology.`,
    sections: [
    { t: "At a glance: intent and biomarkers", open: true, h: `
      <table><tr><th>Setting</th><th>Intent</th></tr>
        <tr><td>Resectable</td><td><b>Curative</b>: surgery (Whipple or distal pancreatectomy) + 6 months chemo</td></tr>
        <tr><td>Borderline resectable</td><td>Neoadjuvant chemo (± RT) → surgery if response</td></tr>
        <tr><td>Locally advanced</td><td>Chemo; a few become resectable</td></tr>
        <tr><td>Metastatic</td><td><b>Palliative</b>; median survival ~11 months with fit-patient chemo</td></tr></table>
      <ul><li>Pancreas-protocol CT, EUS-guided biopsy, CA 19-9 (useless if bilirubin high or Lewis-antigen negative).</li>
        <li><b>Germline testing for everyone</b> (BRCA1/2, PALB2: platinum + PARP maintenance). Tumour: KRAS-wild-type alterations, MSI-high (rare, pembrolizumab), NTRK.</li>
        <li>Jaundice before surgery: biliary <b>metal stent</b> by ERCP (do not delay chemo for long).</li></ul>` },
    { t: "Treatment for cure", open: false, h: `
      <ul><li>Resectable: surgery → <b>modified FOLFIRINOX for 6 months</b> (fit) or gemcitabine-capecitabine. Neoadjuvant chemo increasingly used.</li>
        <li>Borderline/locally advanced: FOLFIRINOX or gemcitabine-nab-paclitaxel → restage → surgery or chemoradiation/SBRT.</li>
        <li>After a Whipple: pancreatic enzyme replacement, diabetes, delayed gastric emptying, leaks, B12/iron/vitamin D.</li></ul>` },
    { t: "Palliative / metastatic options", open: false, h: `
      <ul><li>ECOG 0–1: <b>(m)FOLFIRINOX</b> or <b>NALIRIFOX</b> (liposomal irinotecan); or gemcitabine + nab-paclitaxel.</li>
        <li>ECOG 2: gemcitabine ± nab-paclitaxel; ECOG ≥3: best supportive care.</li>
        <li>gBRCA/PALB2: platinum first, then <b>olaparib maintenance</b>. MSI-high: pembrolizumab.</li>
        <li>2nd line: the other backbone (5-FU + liposomal irinotecan after gemcitabine; gemcitabine-based after FOLFIRINOX). New RAS inhibitors are in trials.</li>
        <li>Symptom care: celiac plexus block for pain, duodenal stent or gastrojejunostomy for gastric outlet obstruction, biliary stent, paracentesis/indwelling catheter for ascites.</li></ul>` },
    { t: "What to watch for in hospital", open: true, h: `
      <table><tr><th>Problem</th><th>Clue</th><th>Do</th></tr>
        <tr><td><b>Biliary obstruction / cholangitis</b></td><td>Jaundice, itch, fever, rising ALP/bilirubin; stent occlusion (plastic &gt; metal)</td><td>Blood cultures, antibiotics, ERCP stent exchange or PTBD; chemo waits until bilirubin falls</td></tr>
        <tr><td><b>VTE</b> (very high risk)</td><td>Leg swelling, PE, splanchnic/portal vein thrombosis</td><td>LMWH or DOAC (apixaban/edoxaban/rivaroxaban; watch GI bleeding); outpatient prophylaxis often given</td></tr>
        <tr><td>Pain</td><td>Epigastric pain radiating to back</td><td>Opioids, adjuvants; celiac plexus neurolysis; palliative RT</td></tr>
        <tr><td>Gastric outlet obstruction</td><td>Vomiting, early satiety</td><td>NG decompression; duodenal stent or GJ</td></tr>
        <tr><td>Exocrine insufficiency</td><td>Steatorrhea, weight loss, bloating</td><td><b>Pancrelipase with meals</b> (e.g. 50,000 lipase units per meal, 25,000 with snacks) – often missing on admission</td></tr>
        <tr><td>Diabetes</td><td>New or worse diabetes (type 3c)</td><td>Insulin often needed; watch hypoglycemia with poor intake</td></tr>
        <tr><td>Malignant ascites, bowel obstruction</td><td>Peritoneal disease</td><td>${tk("pc", "Peritoneal carcinomatosis tab")}</td></tr>
        <tr><td>FOLFIRINOX / NALIRIFOX</td><td>Neutropenic fever, diarrhea (irinotecan), neuropathy (oxaliplatin)</td><td>${go("emerg", "Emergencies")}; loperamide high-dose</td></tr>
        <tr><td>Gemcitabine</td><td>Fever after dose, TMA/HUS (new hypertension, AKI, schistocytes), pneumonitis</td><td>Smear, LDH, haptoglobin</td></tr>
        <tr><td>Depression, cachexia</td><td>Common</td><td>Screen; dietitian; mirtazapine; olanzapine for nausea</td></tr></table>` },
    { t: "When to call oncology urgently", open: false, h: `<ul>
      <li>Cholangitis or stent occlusion; febrile neutropenia; GI bleed on anticoagulation.</li>
      <li>Rapid decline in performance status – time for goals of care and palliative care involvement.</li></ul>` },
    { t: "Prognosis (rough) and goals of care", open: false, h: `
      <table><tr><th>Setting</th><th>Rough outlook</th></tr>
        <tr><td>Resected + adjuvant mFOLFIRINOX</td><td>Median ~4.5 years; 5-year ~40%</td></tr>
        <tr><td>Locally advanced</td><td>Median ~1–1.5 years</td></tr>
        <tr><td>Metastatic, FOLFIRINOX/NALIRIFOX</td><td>Median ~11 months</td></tr>
        <tr><td>Metastatic, ECOG ≥2 or untreated</td><td>Weeks to a few months</td></tr></table>` } ] }
 ];

  // =====================================================================================
  const EMERG = [
    { key: "fn", t: "Febrile neutropenia", open: true, h: `
      <div class="flag red"><b>Antibiotics within 60 minutes.</b> Fever in anyone who had chemo in the last ~6 weeks is febrile neutropenia until the CBC says otherwise.</div>
      <ul>
        <li><b>Definition</b>: temperature ≥38.3 °C once, or ≥38.0 °C for an hour; and ANC &lt;0.5 ×10⁹/L, or expected to fall below 0.5 within 48 h.</li>
        <li><b>Now</b>: 2 sets of blood cultures (one from each lumen of any line), lactate, CBC diff, lytes, creatinine, LFTs, urine culture, CXR, swabs as indicated.</li>
        <li><b>Antibiotic</b>: piperacillin-tazobactam 4.5 g IV q6–8h (local protocol; adjust for kidney function).
          Add vancomycin for suspected line infection, skin/soft tissue infection, MRSA, pneumonia or hemodynamic instability.
          Penicillin allergy: follow the local protocol (e.g. cefepime if low-risk allergy; meropenem or aztreonam + vancomycin for severe).</li>
        <li>Shock or ICU: meropenem + vancomycin ± aminoglycoside; ICU early.</li>
        <li><b>Low risk (MASCC ≥21)</b>: oral ciprofloxacin + amoxicillin-clavulanate can be used in selected patients after the first IV dose, if close follow-up is possible.</li>
        <li>No rectal exams or suppositories. G-CSF is not routine for established febrile neutropenia (consider if high risk).</li>
        <li><b>Neutropenic enterocolitis</b>: RLQ pain, diarrhea, CT bowel-wall thickening → piperacillin-tazobactam or meropenem, bowel rest; surgery if perforation.</li>
        <li>Persistent fever &gt;4–7 days: think fungal (CT chest, galactomannan), lines, C. difficile, drug fever.</li>
      </ul>
      <div id="masccBox"></div>
      <p class="muted"><a href="${LINKS.fn}" target="_blank" rel="noopener">BC Cancer febrile neutropenia guidance</a></p>` },
    { key: "mscc", t: "Spinal cord compression", open: true, h: `
      <div class="flag red"><b>Ambulatory at diagnosis = usually stays ambulatory.</b> Do not wait for weakness: new back pain in cancer is cord compression until imaged.</div>
      <ul>
        <li><b>Suspect</b>: new back pain (thoracic, worse lying/at night/with cough), band-like radicular pain, leg weakness, sensory level, urinary retention or incontinence (late).</li>
        <li>Most often prostate, breast, lung, myeloma, kidney, lymphoma.</li>
        <li><b>Dexamethasone</b> 10 mg IV once, then 4 mg IV/PO q6h (16 mg/day), with a PPI and glucose checks. Lymphoma possible and no deficit: discuss biopsy before steroids.</li>
        <li><b>MRI whole spine within 24 h</b> (same day, or immediately, with a neuro deficit). CT if MRI not possible.</li>
        <li>Call <b>radiation oncology and spine surgery</b> the same day: surgery + RT for selected patients (single level, unstable spine, good performance status, expected survival &gt;3 months).</li>
        <li>Spinal precautions (flat, log roll) if pain is mechanical or the spine may be unstable; bladder scan; bowel regimen; VTE prophylaxis; pain control.</li>
        <li>Untreated prostate cancer: start ADT with <b>degarelix</b> (no flare).</li>
      </ul>` },
    { key: "hcal", t: "Hypercalcemia of malignancy", open: true, h: `
      <div id="caBox"></div>
      <ul>
        <li><b>Causes</b>: PTHrP (squamous lung, breast, kidney, head &amp; neck), bone mets (breast, myeloma), calcitriol (lymphoma).</li>
        <li><b>Labs</b>: PTH (should be suppressed), PTHrP, 25-OH and 1,25-OH vitamin D, Mg, PO4, creatinine; SPEP/free light chains if no known cancer.</li>
        <li><b>Stop</b> calcium, vitamin D, thiazides, lithium.</li>
        <li><b>Normal saline 1 L/h for a few hours</b>, then 150–200 mL/h, aiming for urine output ~100–150 mL/h. Go slower in heart failure or advanced CKD.</li>
        <li><b>Zoledronic acid 4 mg IV</b> over at least 15 minutes (works in 2–4 days). Caution if creatinine &gt;400 µmol/L: <b>denosumab 120 mg SC</b> instead (watch for low Ca later).</li>
        <li><b>Calcitonin</b> 4 IU/kg SC/IM q12h for 24–48 h if Ca &gt;3.5 mmol/L or symptomatic (fast but short-lived).</li>
        <li><b>Prednisone</b> 40–60 mg daily if lymphoma or vitamin-D mediated.</li>
        <li>Furosemide only for fluid overload after volume repletion. Dialysis for severe hypercalcemia with kidney failure or confusion.</li>
        <li>Recheck Ca every 12–24 h. Hypercalcemia from cancer often means advanced disease: a good moment for a goals-of-care conversation.</li>
      </ul>` },
    { key: "tls", t: "Tumour lysis syndrome", open: false, h: `
      <div id="tlsBox"></div>
      <ul>
        <li><b>Highest risk</b>: Burkitt, ALL, AML with WBC &gt;100 or high LDH, bulky DLBCL, CLL during venetoclax ramp-up or obinutuzumab. Solid tumours: SCLC, bulky chemo-sensitive tumours, germ cell, extensive liver mets. Can happen before treatment.</li>
        <li>High risk: rasburicase up front (after G6PD), fluids, labs every 6–8 h; intermediate risk: allopurinol, fluids, labs every 8–12 h.</li>
        <li><b>Lab TLS (Cairo-Bishop)</b>: ≥2 of urate ≥476 µmol/L, K ≥6.0 mmol/L, PO4 ≥1.45 mmol/L, corrected Ca ≤1.75 mmol/L, within 3 days before to 7 days after treatment. <b>Clinical TLS</b>: lab TLS plus creatinine ≥1.5 × ULN, arrhythmia or seizure.</li>
        <li>IV fluids (aim urine output &gt;100 mL/h) if no overload; allopurinol for prevention.</li>
        <li><b>Rasburicase</b> for high urate or established TLS – <b>check G6PD first</b> (${tk("g6pd", "G6PD tab")}).</li>
        <li>Treat high K; do not treat asymptomatic low Ca (calcium-phosphate precipitation). No urine alkalinization.</li>
        <li>Labs every 6–8 h, telemetry; nephrology early if oliguric or K/PO4 rising.</li>
      </ul>` },
    { key: "leukostasis", t: "Hyperleukocytosis / leukostasis", open: false, h: `
      <div id="wbcBox"></div>
      <ul><li><b>Hyperleukocytosis</b>: WBC (blasts) &gt;100 ×10⁹/L. Leukostasis = symptoms from sludging: hypoxia, infiltrates, confusion, headache, vision change, stroke, priapism, limb ischemia. Mostly AML (can occur &gt;50 in monocytic AML); ALL needs much higher counts; CLL rarely causes it even &gt;400.</li>
        <li><b>Now</b>: urgent hematology; <b>hydroxyurea</b> 50–100 mg/kg/day (split doses) until definitive chemo; IV fluids; TLS prevention (rasburicase if high risk); correct DIC.</li>
        <li>Avoid RBC transfusion unless needed (raises viscosity); transfuse platelets as needed (do not raise viscosity much). Leukapheresis only in selected cases (not APL).</li>
        <li>Lab traps: <b>low PaO2</b> on a blood gas from oxygen use by cells (trust the oximeter) and <b>pseudohyperkalemia</b> (repeat K on a heparin/whole blood sample, no pneumatic tube).</li></ul>` },
    { key: "apl", t: "APL (acute promyelocytic leukemia) and DIC", open: false, h: `
      <div class="flag red"><b>Suspect APL → start ATRA now</b> (tretinoin 45 mg/m²/day PO in 2 doses), before genetic confirmation. Most early APL deaths are from bleeding.</div>
      <ul><li>Clues: new leukemia with bleeding/bruising, low fibrinogen, high INR, high D-dimer, often low WBC; abnormal promyelocytes with Auer rods (faggot cells) on the film.</li>
        <li>Support: platelets &gt;30–50 ×10⁹/L, <b>fibrinogen &gt;1.5 g/L</b> (cryoprecipitate), FFP for high INR; check coagulation every 6–8 h at first.</li>
        <li>No LP, central line or invasive procedure until the coagulopathy is corrected. Avoid tranexamic acid and heparin unless hematology advises.</li>
        <li>CT head for any headache or neuro change (intracranial bleeding).</li>
        <li>Watch for <b>differentiation syndrome (retinoic acid syndrome)</b> (below) and QTc on arsenic (ECG; K ≥4, Mg ≥0.9).</li></ul>` },
    { key: "diffs", t: "Differentiation syndrome (retinoic acid syndrome)", open: false, h: `
      <ul><li>After ATRA, arsenic trioxide, IDH inhibitors (ivosidenib, enasidenib, olutasidenib), gilteritinib, menin inhibitors – days to weeks after starting.</li>
        <li>Fever, dyspnea, hypoxia, pulmonary infiltrates, pleural/pericardial effusions, weight gain &gt;5 kg, edema, hypotension, AKI. Often mistaken for pneumonia or heart failure.</li>
        <li><b>Dexamethasone 10 mg IV q12h</b> at the first signs (continue until resolved, then taper); diuretics if overloaded; hold the drug if severe; hydroxyurea if WBC rising. Hematology now.</li></ul>` },
    { key: "hlh", t: "HLH (hemophagocytic lymphohistiocytosis)", open: false, h: `
      <ul><li>Lymphoma (especially T-cell), infections (EBV), after CAR-T. Persistent fever, cytopenias, very high ferritin (often &gt;10,000), hepatosplenomegaly, high triglycerides, low fibrinogen, high LFTs, high sCD25.</li>
        <li>HScore; bone marrow. Urgent hematology: dexamethasone ± etoposide, anakinra; treat the trigger.</li></ul>` },
    { key: "svc", t: "Superior vena cava (SVC) syndrome", open: false, h: `
      <ul>
        <li>Face, neck and arm swelling, distended chest-wall veins, dyspnea, worse lying or bending. Causes: lung cancer (SCLC), lymphoma, line-related clot.</li>
        <li><b>Emergency if</b> stridor, laryngeal edema or confusion (cerebral edema): urgent endovascular stent (IR), airway.</li>
        <li>Otherwise: CT chest with contrast; head up, O2; <b>get tissue first</b> (steroids can hide lymphoma); then RT or chemo by histology; anticoagulate if clot.</li>
        <li><b>Mediastinal mass</b> (lymphoma, lymphoblastic leukemia): sedation or general anesthesia can collapse the airway – anesthesia review before any procedure, keep upright, biopsy under local if possible.</li>
      </ul>` },
    { key: "brain", t: "Brain mets / raised intracranial pressure", open: false, h: `
      <ul>
        <li>Headache (worse in the morning), vomiting, focal deficit, seizure, confusion, personality change.</li>
        <li>CT then MRI with gadolinium.</li>
        <li><b>Dexamethasone</b> only if symptomatic edema: 4–8 mg/day; 10 mg IV then 4 mg q6h if severe. None if asymptomatic. Taper as soon as possible.</li>
        <li>Seizure → levetiracetam. No prophylactic antiseizure drug without a seizure.</li>
        <li>Neurosurgery (large single lesion, hydrocephalus) and radiation oncology (SRS or whole-brain RT). Herniation signs → ICU, hyperosmolar therapy.</li>
      </ul>` },
    { key: "peri", t: "Malignant pericardial effusion / tamponade", open: false, h: `
      <ul><li>Dyspnea, tachycardia, low BP, raised JVP, pulsus paradoxus, low-voltage ECG. Lung, breast, lymphoma, melanoma.</li>
        <li>Urgent echo; pericardiocentesis (cytology). Avoid diuretics and vasodilators; give fluid if hypotensive.</li>
        <li>Recurrent: pericardial window (cardiac surgery).</li></ul>` },
    { key: "airway", t: "Massive hemoptysis / airway obstruction", open: false, h: `
      <ul><li>&gt;100–200 mL in 24 h, or any amount with instability or hypoxia.</li>
        <li>Lie bleeding side down; large-bore access; stop and reverse anticoagulation; TXA (nebulized or IV); airway with a large ETT (anesthesia/ICU).</li>
        <li>Bronchoscopy, IR bronchial artery embolization, urgent RT. Match the plan to goals of care; have comfort measures ready (midazolam, dark towels) for a terminal bleed.</li></ul>` },
    { key: "na", t: "Hyponatremia (SIADH)", open: false, h: `
      <ul><li>SCLC, cisplatin, cyclophosphamide, vinca alkaloids, opioids, pain, nausea.</li>
        <li>Exclude <b>adrenal insufficiency</b> (immunotherapy hypophysitis/adrenalitis, steroid withdrawal) and hypothyroidism.</li>
        <li>Severe symptoms (seizure, coma): 3% saline 100–150 mL bolus. Limit correction to 8 mmol/L in 24 h (6 if high risk).</li>
        <li>Chronic: fluid restriction, salt tablets, urea, tolvaptan; treating SCLC often fixes it. ${tk("hypona", "Sodium tab")}</li></ul>` },
    { key: "irae", t: "Immunotherapy side effects (irAEs)", open: false, h: `
      <ul><li>Any new symptom on a checkpoint inhibitor (even months after the last dose): diarrhea/colitis, pneumonitis, hepatitis, rash, thyroid, hypophysitis/adrenal (fatigue, low Na, low BP), type 1 diabetes/DKA, <b>myocarditis</b> (troponin, ECG – often with myositis/myasthenia, high mortality), nephritis, neuro.</li>
        <li>Grade 2: hold immunotherapy, prednisone 0.5–1 mg/kg. Grade 3–4: methylprednisolone 1–2 mg/kg IV. Myocarditis: methylprednisolone 1 g IV daily, cardiology.</li>
        <li>Steroid-refractory: infliximab (colitis), mycophenolate (hepatitis) – with oncology.</li>
        <li>Grading and organ-by-organ management: ${tk("tox", "Oncology toxicity tab")}.</li></ul>` },
    { key: "crs", t: "CRS / ICANS (bispecifics, CAR-T)", open: false, h: `
      <ul><li>Fever, low BP, low O2 (CRS) and confusion, word-finding trouble, handwriting change (ICANS) after tarlatamab, teclistamab and other bispecifics or CAR-T.</li>
        <li>Grade, tocilizumab, dexamethasone: ${tk("bsab", "CRS/ICANS tab")}.</li></ul>` },
    { key: "vte", t: "Cancer-associated VTE", open: false, h: `
      <ul><li>DOAC (apixaban, edoxaban, rivaroxaban) or LMWH. Prefer LMWH or apixaban with an unresected luminal GI/GU tumour (bleeding), and LMWH with strong CYP3A4/P-gp inducers (enzalutamide, apalutamide).</li>
        <li>Platelets &lt;50: reduce or hold LMWH (discuss with hematology). Brain mets are not a contraindication by themselves.</li>
        <li>Treat for at least 6 months, and while cancer is active.</li></ul>` },
    { key: "adrenal", t: "Adrenal crisis", open: false, h: `
      <ul><li>On long-term steroids (dexamethasone, prednisone with abiraterone) or immunotherapy hypophysitis/adrenalitis.</li>
        <li>Low BP, low Na, high K, low glucose, vomiting, confusion.</li>
        <li>Hydrocortisone 100 mg IV, then 50 mg IV q6h (or 200 mg/24 h); fluids; treat the trigger. Draw cortisol/ACTH first if it does not delay treatment.</li></ul>` },
    { key: "mbo", t: "Malignant bowel obstruction", open: false, h: `<p>${tk("pc", "Peritoneal carcinomatosis tab")}: surgery/stent checklist, octreotide, dexamethasone, antiemetics, venting gastrostomy.</p>` } ];

  // MASCC risk index (febrile neutropenia): total 26, ≥21 = low risk
  const MASCC = [
    { id: "burden", text: "Burden of illness", choices: [["5", "No or mild symptoms"], ["3", "Moderate symptoms"], ["0", "Severe symptoms or moribund"]] },
    { id: "nohypo", text: "No hypotension (SBP > 90)", pts: 5 },
    { id: "nocopd", text: "No COPD", pts: 4 },
    { id: "solid", text: "Solid tumour, or blood cancer with no previous fungal infection", pts: 4 },
    { id: "nodehyd", text: "No dehydration needing IV fluids", pts: 3 },
    { id: "outpt", text: "Outpatient when fever started", pts: 3 },
    { id: "young", text: "Age under 60", pts: 2 } ];

  const api = { CANCERS, EMERG, MASCC, LINKS };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else window.OncContent = api;
})();
