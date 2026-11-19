/* Builds abx-classes.html, the source for abx-classes.pdf (antibiotic classes: when to use, usual adult doses, side effects).
   Run:  node abx-classes.js   then:  google-chrome --headless --no-pdf-header-footer --print-to-pdf=abx-classes.pdf abx-classes.html
   One class per page so the tab can link to abx-classes.pdf#page=N (PAGES below is also written to abx-classes-pages.js).
   Content written by Claude from general knowledge (UNVERIFIED): typical adult doses for normal renal function. Check Island Health
   formulary / pharmacy, the Bugs & Drugs / Sanford-type references, and local antibiogram before use. */
const fs = require("fs"), path = require("path");

const CLASSES = [
 { id: "pen", name: "Penicillins", short: "Pen G/V, amoxicillin, amox-clav, ampicillin, cloxacillin, piperacillin-tazobactam",
   covers: "Strep, enterococcus (amp/amox), MSSA (cloxacillin, amox-clav), anaerobes (amox-clav, pip-tazo), Pseudomonas (pip-tazo only)",
   gaps: "MRSA, atypicals; ESBL (pip-tazo unreliable for ESBL bacteremia – MERINO)",
   when: ["Strep pyogenes (pharyngitis, cellulitis, necrotizing infection with clindamycin), syphilis, susceptible strep endocarditis → penicillin G", "Enterococcus faecalis, Listeria → ampicillin", "MSSA bacteremia/endocarditis/osteomyelitis → cloxacillin (or cefazolin)", "Bites, aspiration, sinusitis, COPD exacerbation, step-down for intra-abdominal infection → amoxicillin-clavulanate", "Hospital-acquired / Pseudomonas risk / febrile neutropenia / severe intra-abdominal → piperacillin-tazobactam"],
   agents: [
    ["Penicillin G (IV)", "2–4 million units IV q4h (4 MU q4h for endocarditis, meningitis, neurosyphilis)", "Yes"],
    ["Penicillin V (PO)", "300–600 mg PO QID (strep pharyngitis 600 mg BID ×10 days)", "Yes"],
    ["Amoxicillin", "500 mg–1 g PO TID (CAP 1 g TID)", "Yes"],
    ["Amoxicillin-clavulanate", "875/125 mg PO BID (or 500/125 mg TID)", "Yes"],
    ["Ampicillin", "1–2 g IV q4–6h (2 g q4h for enterococcal endocarditis, Listeria)", "Yes"],
    ["Cloxacillin", "2 g IV q4h (MSSA bacteremia); 500 mg PO QID (poor oral absorption – prefer cephalexin PO)", "No"],
    ["Piperacillin-tazobactam", "4.5 g IV q6–8h (q6h or extended infusion for Pseudomonas / severe sepsis)", "Yes"]],
   se: ["Hypersensitivity: rash, urticaria, anaphylaxis, rarely SJS/TEN/DRESS", "Diarrhea, C. difficile (amox-clav, pip-tazo)", "Interstitial nephritis; neutropenia and drug fever with long courses (>2 weeks)", "Seizures with high doses in renal failure", "Hypokalemia and sodium load (pip-tazo); AKI more often with vancomycin + pip-tazo", "Amox-clav: cholestatic hepatitis (older men, longer courses)"],
   monitor: "CBC and creatinine weekly on long IV courses (OPAT). Amoxicillin rash in EBV infection is not a true allergy." },
 { id: "ceph", name: "Cephalosporins", short: "Cefazolin, cephalexin, cefuroxime, ceftriaxone, ceftazidime, cefepime, ceftaroline",
   covers: "1st gen: MSSA, strep, E. coli. 3rd gen: gram-negatives, pneumococcus, meningitis. Ceftazidime/cefepime: Pseudomonas. Ceftaroline: MRSA",
   gaps: "Enterococcus (none), Listeria, atypicals, anaerobes (poor), ESBL/AmpC producers",
   when: ["Cellulitis, MSSA bacteremia, surgical prophylaxis → cefazolin (PO step-down cephalexin)", "Community-acquired pneumonia (with macrolide/doxy), pyelonephritis, SBP, meningitis, gonorrhea → ceftriaxone", "Pseudomonas, febrile neutropenia, hospital-acquired pneumonia → cefepime or ceftazidime", "MRSA when vancomycin is not suitable → ceftaroline (ID input)", "Ceftazidime-avibactam, ceftolozane-tazobactam → MDR Pseudomonas / CRE: ID approval only"],
   agents: [
    ["Cefazolin", "1–2 g IV q8h (2 g q8h for MSSA bacteremia; 3 g if ≥120 kg for surgical prophylaxis)", "Yes"],
    ["Cephalexin", "500 mg–1 g PO QID", "Yes"],
    ["Cefuroxime", "750 mg–1.5 g IV q8h; axetil 500 mg PO BID", "Yes"],
    ["Ceftriaxone", "1–2 g IV q24h (meningitis 2 g IV q12h; gonorrhea 500 mg–1 g IM once)", "No"],
    ["Cefixime", "400 mg PO daily", "Yes"],
    ["Ceftazidime", "1–2 g IV q8h (2 g q8h for Pseudomonas)", "Yes"],
    ["Cefepime", "1–2 g IV q8–12h (2 g q8h for febrile neutropenia / Pseudomonas)", "Yes – neurotoxicity"],
    ["Ceftaroline", "600 mg IV q12h (q8h for severe MRSA)", "Yes"]],
   se: ["Hypersensitivity; cross-reactivity with penicillin ~1–2%, mostly through shared side chains (cephalexin/cefadroxil with amoxicillin/ampicillin; ceftazidime with aztreonam)", "C. difficile (3rd generation especially)", "Cefepime neurotoxicity: confusion, myoclonus, non-convulsive status – mainly when not renally dosed", "Ceftriaxone: biliary sludge/pseudolithiasis, immune hemolysis (rare)", "Cytopenias, interstitial nephritis, drug fever with long courses"],
   monitor: "Cefepime: dose to CrCl; think of it in a confused patient with kidney disease. Ceftriaxone needs no renal adjustment." },
 { id: "carb", name: "Carbapenems and aztreonam", short: "Meropenem, ertapenem, imipenem-cilastatin; aztreonam (monobactam)",
   covers: "Broadest beta-lactams: gram-negatives incl. ESBL, anaerobes, strep, MSSA. Meropenem/imipenem: Pseudomonas, Acinetobacter. Aztreonam: gram-negatives incl. Pseudomonas only",
   gaps: "MRSA, E. faecium (VRE), Stenotrophomonas, atypicals; ertapenem misses Pseudomonas, Acinetobacter, enterococcus; aztreonam has no gram-positive or anaerobe cover",
   when: ["ESBL-producing Enterobacterales infection (bacteremia, pyelonephritis) → ertapenem (no Pseudomonas risk) or meropenem", "Severe hospital-acquired sepsis, febrile neutropenia with previous resistant organisms, CNS infection with resistant gram-negatives → meropenem", "Severe penicillin allergy needing gram-negative/Pseudomonas cover → aztreonam (avoid if ceftazidime allergy)", "Carbapenem-sparing: de-escalate as soon as susceptibilities return"],
   agents: [
    ["Meropenem", "1 g IV q8h (2 g q8h for meningitis, Pseudomonas, severe infection; extended infusion)", "Yes"],
    ["Ertapenem", "1 g IV q24h", "Yes (500 mg if CrCl <30)"],
    ["Imipenem-cilastatin", "500 mg IV q6h", "Yes"],
    ["Aztreonam", "1–2 g IV q8h (2 g q6–8h for Pseudomonas)", "Yes"]],
   se: ["Seizures (imipenem > meropenem/ertapenem), especially renal failure or CNS disease", "<b>Valproate interaction: carbapenems cut valproate levels within a day → breakthrough seizures. Avoid together; use another antibiotic or another antiseizure drug</b>", "C. difficile; selects for carbapenem-resistant organisms", "Hypersensitivity: cross-reactivity with penicillin <1%", "Aztreonam: rash, LFT rise; safe in most beta-lactam allergy"],
   monitor: "Check the medication list for valproate before starting. Reserve meropenem: ID / stewardship review at 48–72 h." },
 { id: "mrsa", name: "Anti-MRSA agents", short: "Vancomycin, daptomycin, linezolid (plus TMP-SMX, doxycycline, ceftaroline on other pages)",
   covers: "MRSA, MSSA (inferior to cloxacillin/cefazolin for MSSA), strep, enterococcus (vancomycin for amp-R; linezolid/daptomycin for VRE), C. difficile (oral vancomycin)",
   gaps: "All gram-negatives",
   when: ["Sepsis with MRSA risk (known colonization, injection drug use, severe purulent SSTI, necrotizing pneumonia), empiric meningitis → IV vancomycin; stop at 48–72 h if no MRSA", "MRSA bacteremia/endocarditis → vancomycin or daptomycin (high dose); ID consult for every S. aureus bacteremia", "MRSA pneumonia → vancomycin or linezolid (<b>not daptomycin</b>)", "VRE → linezolid or daptomycin", "Gram-positive infection with severe beta-lactam allergy → vancomycin"],
   agents: [
    ["Vancomycin IV", "Load 20–35 mg/kg (max ~3 g), then 15–20 mg/kg q8–12h; AUC 400–600 or trough per pharmacy protocol", "Yes – levels"],
    ["Vancomycin PO", "C. difficile: 125 mg PO QID ×10 days (fulminant 500 mg QID) – not absorbed, no levels", "No"],
    ["Daptomycin", "6 mg/kg IV q24h; 8–10 mg/kg for bacteremia/endocarditis", "Yes (q48h if CrCl <30)"],
    ["Linezolid", "600 mg PO/IV q12h (100% oral bioavailability)", "No"],
    ["Rifampin (adjunct only)", "300–450 mg PO BID with another active drug for prosthetic material/hardware – never alone", "No"]],
   se: ["Vancomycin: AKI (higher with pip-tazo, other nephrotoxins), infusion reaction (flushing – slow the infusion, not allergy), neutropenia, DRESS, ototoxicity (rare)", "Daptomycin: CK rise/myopathy (check CK weekly; hold statins), eosinophilic pneumonia; inactivated by surfactant → no use in pneumonia", "Linezolid: thrombocytopenia/anemia (>10–14 days), serotonin syndrome with SSRIs/SNRIs/MAOIs, lactic acidosis, hypoglycemia, peripheral and optic neuropathy with long courses", "Rifampin: major CYP inducer (DOACs, warfarin, tacrolimus, azoles, opioids, contraceptives), orange body fluids, hepatitis"],
   monitor: "Vancomycin levels and creatinine 2–3×/week; daptomycin CK weekly; linezolid CBC weekly and review serotonergic drugs." },
 { id: "ag", name: "Aminoglycosides", short: "Gentamicin, tobramycin, amikacin",
   covers: "Aerobic gram-negatives incl. Pseudomonas (tobramycin best), synergy with beta-lactams for enterococcal/strep endocarditis",
   gaps: "Anaerobes, strep alone, MRSA alone; poor in abscess (acidic, low oxygen), poor lung and CNS penetration",
   when: ["One empiric dose for gram-negative sepsis or pyelonephritis while cultures pending (single doses carry little toxicity)", "Pyelonephritis / complicated UTI with resistant organism and normal kidney function", "Synergy: enterococcal endocarditis (gentamicin) – or ampicillin + ceftriaxone instead to avoid nephrotoxicity", "Plague, tularemia; amikacin for some mycobacteria and MDR gram-negatives (ID)"],
   agents: [
    ["Gentamicin / tobramycin", "5–7 mg/kg IV q24h (extended interval; use adjusted body weight if obese)", "Yes – levels, interval"],
    ["Gentamicin (synergy)", "1 mg/kg IV q8h (enterococcus) or 3 mg/kg q24h (viridans strep)", "Yes"],
    ["Amikacin", "15–20 mg/kg IV q24h", "Yes"]],
   se: ["Nephrotoxicity (non-oliguric AKI, usually after 5–7 days; often reversible)", "Ototoxicity: vestibular (imbalance, oscillopsia) and cochlear – <b>often permanent</b>", "Neuromuscular blockade (myasthenia gravis, after anesthesia)", "Worse with vancomycin, loop diuretics, contrast, NSAIDs, amphotericin"],
   monitor: "Avoid in CKD, older adults and >5–7 days where possible. Levels per pharmacy nomogram; creatinine every 2–3 days; ask about dizziness/tinnitus." },
 { id: "fq", name: "Fluoroquinolones", short: "Ciprofloxacin, levofloxacin, moxifloxacin",
   covers: "Gram-negatives incl. Pseudomonas (cipro, levo), atypicals (levo, moxi), pneumococcus (levo, moxi), anaerobes (moxi only)",
   gaps: "Cipro: strep/pneumococcus poor. MRSA (unreliable), enterococcus (weak). Moxifloxacin: urinary infections (low urine levels), Pseudomonas",
   when: ["Pyelonephritis, complicated UTI, prostatitis (best prostate penetration) → ciprofloxacin or levofloxacin", "Pseudomonas when an oral drug is needed → ciprofloxacin 750 mg BID", "CAP with severe beta-lactam allergy → levofloxacin or moxifloxacin", "Gram-negative bone/joint step-down; traveller's diarrhea", "Health Canada warnings: avoid for uncomplicated cystitis, sinusitis and bronchitis when alternatives exist"],
   agents: [
    ["Ciprofloxacin", "500–750 mg PO BID; 400 mg IV q8–12h", "Yes"],
    ["Levofloxacin", "750 mg PO/IV daily (500 mg for some UTI)", "Yes"],
    ["Moxifloxacin", "400 mg PO/IV daily", "No"]],
   se: ["QT prolongation (moxi > levo > cipro) – check ECG with other QT drugs, low K/Mg", "Tendinopathy/rupture (age >60, steroids, transplant), aortic aneurysm/dissection", "Dysglycemia (hypo- and hyperglycemia), especially diabetics on insulin/sulfonylureas", "CNS: delirium, insomnia, seizures; peripheral neuropathy (may be permanent)", "C. difficile, photosensitivity, myasthenia gravis worsening", "Chelation: separate from Ca, Mg, Al, Fe, Zn and enteral feeds (give FQ 2 h before or 6 h after); warfarin INR rises"],
   monitor: "100% oral bioavailability – IV rarely needed. Review QTc and co-prescribed QT drugs." },
 { id: "mac", name: "Macrolides and tetracyclines", short: "Azithromycin, clarithromycin, erythromycin; doxycycline, minocycline, tigecycline",
   covers: "Atypicals (Mycoplasma, Chlamydophila, Legionella), pneumococcus (rising resistance), H. influenzae/Moraxella. Doxycycline also: MRSA (SSTI), Rickettsia, Lyme, Leptospira, chlamydia",
   gaps: "Most gram-negative rods, Pseudomonas, enterococcus; macrolides not for S. aureus; tigecycline poor serum levels (not for bacteremia) and no Pseudomonas",
   when: ["CAP: atypical cover with a beta-lactam (azithromycin or doxycycline); outpatient CAP without comorbidities → doxycycline or amoxicillin", "COPD exacerbation (doxycycline); chronic azithromycin to reduce COPD exacerbations/bronchiectasis", "Chlamydia, pertussis, Campylobacter, traveller's diarrhea (azithromycin)", "MRSA SSTI step-down, Lyme, tick-borne illness (doxycycline)", "H. pylori, MAC (clarithromycin); erythromycin IV as a prokinetic (gastroparesis, before endoscopy for upper GI bleed)"],
   agents: [
    ["Azithromycin", "500 mg PO/IV daily ×3 days (or 500 mg day 1 then 250 mg ×4); chlamydia 1 g once", "No"],
    ["Clarithromycin", "500 mg PO BID", "Yes"],
    ["Erythromycin (prokinetic)", "250 mg IV 30–90 min before endoscopy; 125–250 mg PO TID-QID for gastroparesis (short term)", "No"],
    ["Doxycycline", "100 mg PO/IV BID (200 mg first dose)", "No"],
    ["Minocycline", "100 mg PO BID", "No"],
    ["Tigecycline", "100 mg IV once, then 50 mg q12h (reserve, ID)", "No (hepatic)"]],
   se: ["QT prolongation (azithro, clarithro, erythro); GI upset; hepatotoxicity; hearing loss (high dose)", "<b>Clarithromycin/erythromycin: strong CYP3A4 inhibitors</b> – statins (rhabdo), colchicine (toxicity), DOACs, calcium channel blockers, tacrolimus, cyclosporine; azithromycin has few interactions", "Doxycycline: pill esophagitis (take upright with a full glass of water), photosensitivity, chelation with Ca/Fe/antacids; avoid in pregnancy", "Minocycline: dizziness/vertigo, DRESS, drug-induced lupus, skin pigmentation", "Tigecycline: nausea/vomiting, pancreatitis, higher all-cause mortality warning"],
   monitor: "Baseline QTc if other QT drugs; review interactions for clarithromycin. Doxycycline and minocycline need no renal adjustment." },
 { id: "uti", name: "Sulfonamide and urinary agents", short: "TMP-SMX, trimethoprim, nitrofurantoin, fosfomycin",
   covers: "TMP-SMX: E. coli/Enterobacterales (resistance often 20%+), MRSA, Stenotrophomonas, Nocardia, PJP, Toxoplasma. Nitrofurantoin and fosfomycin: lower-tract E. coli incl. many ESBL, E. faecalis (nitrofurantoin)",
   gaps: "TMP-SMX: strep (cellulitis – add cephalexin), Pseudomonas, anaerobes. Nitrofurantoin/fosfomycin: no tissue or blood levels – not for pyelonephritis, prostatitis, bacteremia",
   when: ["Uncomplicated cystitis → nitrofurantoin 5 days, fosfomycin once, or TMP-SMX 3 days (if local resistance <20%)", "Pyelonephritis/complicated UTI step-down when susceptible → TMP-SMX", "Purulent SSTI/MRSA (often with cephalexin for strep), Stenotrophomonas → TMP-SMX", "PJP treatment and prophylaxis (steroids ≥20 mg prednisone >4 weeks, transplant, HIV CD4 <200) → TMP-SMX", "ESBL cystitis → fosfomycin or nitrofurantoin"],
   agents: [
    ["TMP-SMX", "UTI/SSTI 1 DS (160/800 mg) PO BID; larger patients/MRSA 2 DS BID", "Yes"],
    ["TMP-SMX (PJP)", "Treatment 15–20 mg/kg/day TMP divided q6–8h; prophylaxis 1 SS daily or 1 DS 3×/week", "Yes"],
    ["Trimethoprim", "100 mg PO BID or 200 mg daily", "Yes"],
    ["Nitrofurantoin (Macrobid)", "100 mg PO BID ×5 days", "Avoid if CrCl <30"],
    ["Fosfomycin", "3 g PO once (sachet in water); some use 3 g q48–72h ×3 doses for complicated cystitis", "Caution"]],
   se: ["TMP-SMX: <b>hyperkalemia</b> (with ACEi/ARB/spironolactone, CKD, elderly), creatinine rise without true GFR fall, rash → SJS/TEN, cytopenias, hepatitis, hypoglycemia with sulfonylureas, <b>warfarin INR rises sharply</b>, aseptic meningitis", "Nitrofurantoin: acute pulmonary reaction (fever, dyspnea) and chronic pulmonary fibrosis with long use, hepatitis, peripheral neuropathy, hemolysis in G6PD deficiency", "Fosfomycin: diarrhea, nausea"],
   monitor: "TMP-SMX: K and creatinine at day 3–5 in at-risk patients, INR if on warfarin, CBC on long courses." },
 { id: "anaer", name: "Clindamycin and metronidazole", short: "Clindamycin; metronidazole",
   covers: "Clindamycin: strep, MSSA, many MRSA (check D-test), anaerobes above the diaphragm, toxin suppression. Metronidazole: anaerobes (incl. B. fragilis, C. difficile), Trichomonas, Giardia, amoeba",
   gaps: "Both: no aerobic gram-negatives. Clindamycin: B. fragilis resistance common, enterococcus. Metronidazole: no aerobes, no gram-positive aerobes",
   when: ["Necrotizing fasciitis, toxic shock (with a beta-lactam) → clindamycin to switch off toxin production", "Cellulitis, dental infections, bone infection in beta-lactam allergy → clindamycin", "Intra-abdominal infection (with ceftriaxone or a fluoroquinolone), aspiration with abscess, brain abscess → metronidazole", "C. difficile only if oral vancomycin and fidaxomicin are unavailable (non-severe); fulminant C. difficile → IV metronidazole + oral vancomycin", "Bacterial vaginosis, trichomoniasis, amoebiasis, Giardia → metronidazole"],
   agents: [
    ["Clindamycin", "300–450 mg PO QID; 600–900 mg IV q8h", "No"],
    ["Metronidazole", "500 mg PO/IV q12h (q8h in some protocols); BV 500 mg PO BID ×7 days", "No (reduce in severe liver disease)"]],
   se: ["Clindamycin: <b>highest C. difficile risk of any antibiotic</b>, diarrhea, rash, hepatitis", "Metronidazole: metallic taste, nausea, peripheral neuropathy (>4 weeks), encephalopathy/cerebellar signs, <b>warfarin INR rises sharply</b>, QT prolongation, alcohol intolerance (weak evidence)", "Metronidazole has near-complete oral absorption – PO as good as IV"],
   monitor: "INR within 3–5 days if on warfarin with metronidazole. Stop clindamycin early if diarrhea and test for C. difficile." },
 { id: "cdiff", name: "C. difficile therapy and other agents", short: "Oral vancomycin, fidaxomicin; colistin/polymyxin and newer agents (ID only)",
   covers: "C. difficile (oral vancomycin, fidaxomicin – act in the gut lumen, not absorbed)",
   gaps: "Oral vancomycin and fidaxomicin treat nothing outside the gut",
   when: ["First episode C. difficile → fidaxomicin (preferred, fewer recurrences) or oral vancomycin, 10 days", "Fulminant (hypotension, ileus, megacolon) → vancomycin 500 mg PO/NG QID + metronidazole 500 mg IV q8h ± rectal vancomycin; surgery consult", "Recurrence → fidaxomicin or vancomycin taper/pulse; consider fecal microbiota transplant after 2nd recurrence", "Stop unnecessary antibiotics and PPIs; contact precautions", "Colistin, cefiderocol, ceftazidime-avibactam, ceftolozane-tazobactam, meropenem-vaborbactam: CRE/MDR gram-negatives – ID approval"],
   agents: [
    ["Vancomycin PO", "125 mg PO QID ×10 days; fulminant 500 mg PO/NG QID", "No"],
    ["Fidaxomicin", "200 mg PO BID ×10 days (extended-pulsed regimens for recurrence)", "No"],
    ["Metronidazole IV (fulminant add-on)", "500 mg IV q8h", "No"]],
   se: ["Oral vancomycin/fidaxomicin: few systemic effects; nausea", "Colistin: nephrotoxicity, neurotoxicity"],
   monitor: "Do not test for cure. Do not treat colonization (no diarrhea). Bezlotoxumab is no longer available." }];

const PRACTICAL = `
  <h2>Penicillin allergy</h2>
  <ul>
    <li>Most labelled patients (~90%+) are not allergic. <b>PEN-FAST</b>: <b>F</b>ive years or less since reaction (2), <b>A</b>naphylaxis/angioedema (2) or <b>S</b>evere cutaneous reaction (SJS/TEN/DRESS, 2), <b>T</b>reatment needed (1). Score &lt;3 = low risk → direct oral amoxicillin challenge is reasonable.</li>
    <li>Cephalosporins after penicillin allergy: ~1–2% cross-reactivity, mostly via shared side chains. Cefazolin has a unique side chain – usually safe. Carbapenems &lt;1%. Aztreonam: avoid only with ceftazidime allergy.</li>
    <li>True severe delayed reaction (SJS/TEN, DRESS) to any beta-lactam → avoid the class; ask ID/allergy.</li>
  </ul>
  <h2>IV to PO switch</h2>
  <ul>
    <li>Switch when: afebrile 24–48 h, hemodynamically stable, improving, gut working, a suitable oral drug exists. Not for: meningitis, endocarditis (unless POET-style criteria met), S. aureus bacteremia without ID input, severe neutropenia.</li>
    <li>Near-100% oral bioavailability (no need for IV if absorbing): fluoroquinolones, linezolid, TMP-SMX, metronidazole, doxycycline/minocycline, clindamycin, rifampin, fluconazole.</li>
    <li>Common step-downs: cefazolin → cephalexin; ceftriaxone → cefixime / amox-clav / TMP-SMX (by susceptibility); pip-tazo → amox-clav or cipro + metronidazole.</li>
  </ul>
  <h2>Renal dosing</h2>
  <ul>
    <li><b>Adjust for CrCl</b>: most penicillins and cephalosporins (cefepime especially), carbapenems, aztreonam, fluoroquinolones (cipro, levo), vancomycin, aminoglycosides, daptomycin, TMP-SMX, clarithromycin, nitrofurantoin.</li>
    <li><b>No renal adjustment</b>: ceftriaxone, cloxacillin, doxycycline, minocycline, linezolid, clindamycin, metronidazole, azithromycin, moxifloxacin, rifampin, oral vancomycin, fidaxomicin.</li>
    <li>Give a full first dose regardless of kidney function, then adjust.</li>
  </ul>
  <h2>Who covers what (quick)</h2>
  <table>
    <tr><th>Need</th><th>Options</th></tr>
    <tr><td>Pseudomonas</td><td>Pip-tazo, cefepime, ceftazidime, meropenem/imipenem, aztreonam, ciprofloxacin/levofloxacin, aminoglycosides</td></tr>
    <tr><td>MRSA</td><td>Vancomycin, linezolid, daptomycin (not lung), ceftaroline, TMP-SMX, doxycycline (SSTI), clindamycin (if D-test negative)</td></tr>
    <tr><td>Anaerobes</td><td>Metronidazole, amox-clav, pip-tazo, carbapenems, clindamycin (above diaphragm), moxifloxacin</td></tr>
    <tr><td>Atypicals</td><td>Azithromycin, clarithromycin, doxycycline, levofloxacin, moxifloxacin</td></tr>
    <tr><td>ESBL</td><td>Carbapenems (ertapenem, meropenem); cystitis: nitrofurantoin, fosfomycin; by susceptibility: TMP-SMX, ciprofloxacin, aminoglycosides</td></tr>
    <tr><td>Enterococcus</td><td>Ampicillin/amoxicillin (E. faecalis), vancomycin; VRE: linezolid, daptomycin. Cephalosporins never cover enterococcus</td></tr>
  </table>`;

const CSS = `<style>
  @page { size: letter; margin: 9mm 10mm; }
  * { box-sizing: border-box; }
  body { font-family: "Segoe UI", system-ui, -apple-system, Roboto, Arial, sans-serif; color: #1f2933; font-size: 8.8pt; line-height: 1.26; margin: 0; }
  h1 { font-size: 15pt; margin: 0 0 1mm; color: #0b4a99; }
  h2 { font-size: 10.5pt; margin: 3mm 0 1.2mm; color: #0b4a99; }
  .sub { color: #5f6c7b; font-size: 9pt; margin-bottom: 2mm; }
  table { border-collapse: collapse; width: 100%; break-inside: avoid; margin: 1mm 0; }
  td, th { padding: 1.2mm 2mm; vertical-align: top; text-align: left; border: 0.25mm solid #dde3ea; }
  th { background: #f5f7fa; }
  td.a { font-weight: 600; width: 24%; background: #fafbfc; } td.r { width: 15%; }
  ul { margin: 0; padding-left: 4mm; } li { margin: 0.5mm 0; }
  .two { display: grid; grid-template-columns: 1fr 1fr; gap: 3mm; }
  .box { border: 0.3mm solid #dde3ea; border-radius: 2mm; padding: 2mm 3mm; break-inside: avoid; }
  .box h3 { margin: 0 0 1.2mm; font-size: 9.6pt; color: #0b4a99; }
  .cov { background: #e4f4ea; } .gap { background: #fde8e8; }
  .warn { background: #fff4e5; border: 0.3mm solid #f0c27b; border-radius: 2mm; padding: 1.5mm 3mm; font-size: 8pt; margin: 2mm 0; }
  .foot { margin-top: 3mm; font-size: 7.4pt; color: #5f6c7b; border-top: 0.25mm solid #dde3ea; padding-top: 1mm; }
  .pb { break-before: page; }
  a { color: #0b6bcb; text-decoration: none; }
</style>`;

const WARN = `<div class="warn"><b>Decision-support draft, not verified.</b> Written by Claude from general knowledge. Doses are typical adult doses for <b>normal kidney and liver function</b>; renal column = needs adjustment. Always check the Island Health formulary, pharmacy, local antibiogram and allergy history. Choose the narrowest drug that covers the likely or proven organism.</div>`;
const foot = (n) => `<div class="foot">Hospitalist Toolkit · Antibiotics tab · antibiotic classes reference · page ${n} · UNVERIFIED draft (Nov 2026)</div>`;

// page 1 = index, then one page per class, then practical page
const PAGES = {}; CLASSES.forEach((c, i) => (PAGES[c.id] = i + 2)); PAGES.practical = CLASSES.length + 2;

function classPage(c) {
  return `<div class="pb" id="${c.id}"></div>
  <h1>${c.name}</h1><div class="sub">${c.short}</div>
  <table><tr><td class="a cov">Covers</td><td>${c.covers}</td></tr><tr><td class="a gap">Does not cover</td><td>${c.gaps}</td></tr></table>
  <h2>When to use</h2><ul>${c.when.map((x) => `<li>${x}</li>`).join("")}</ul>
  <h2>Usual adult doses</h2>
  <table><tr><th>Agent</th><th>Usual dose (normal renal function)</th><th>Renal adjust?</th></tr>
  ${c.agents.map((a) => `<tr><td class="a">${a[0]}</td><td>${a[1]}</td><td class="r">${a[2]}</td></tr>`).join("")}</table>
  <h2>Side effects and interactions</h2><ul>${c.se.map((x) => `<li>${x}</li>`).join("")}</ul>
  <h2>Monitoring / pearls</h2><p style="margin:0">${c.monitor}</p>
  ${foot(PAGES[c.id])}`;
}

const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><title>Antibiotic classes – when to use, doses, side effects</title>
<!-- Generated by abx-classes.js: edit there, not here. PDF: google-chrome --headless --no-pdf-header-footer --print-to-pdf=abx-classes.pdf abx-classes.html -->
${CSS}</head><body>
  <h1>Antibiotic classes: when to use, usual doses, side effects</h1>
  <div class="sub">Hospitalist Toolkit · Antibiotics tab · adults · one class per page</div>
  ${WARN}
  <table><tr><th>Page</th><th>Class</th><th>Agents</th><th>Main use</th></tr>
  ${CLASSES.map((c) => `<tr><td>${PAGES[c.id]}</td><td class="a"><a href="#${c.id}">${c.name}</a></td><td>${c.short}</td><td>${c.when[0].replace(/<[^>]+>/g, "")}</td></tr>`).join("")}
  <tr><td>${PAGES.practical}</td><td class="a"><a href="#practical">Penicillin allergy, IV→PO, renal dosing, who covers what</a></td><td colspan="2">Practical page</td></tr></table>
  <h2>Before you prescribe</h2>
  <ul>
    <li>Send cultures first when it does not delay treatment of sepsis.</li>
    <li>Write the indication and the planned stop date or review date on the order.</li>
    <li>Reassess at 48–72 h: narrow to the organism, switch IV to PO, stop if not infection.</li>
    <li>Short courses work for most infections: CAP 5 days, cystitis 3–5, pyelonephritis 7 (FQ) –10, cellulitis 5–6, uncomplicated gram-negative bacteremia 7, intra-abdominal after source control 4.</li>
  </ul>
  ${foot(1)}
  ${CLASSES.map(classPage).join("\n")}
  <div class="pb" id="practical"></div>
  <h1>Practical: allergy, IV to PO, renal dosing</h1><div class="sub">Applies across classes</div>
  ${PRACTICAL}
  ${foot(PAGES.practical)}
</body></html>`;

fs.writeFileSync(path.join(__dirname, "abx-classes.html"), html);
fs.writeFileSync(path.join(__dirname, "abx-classes-pages.js"), "// Generated by abx-classes.js - page numbers in abx-classes.pdf for the jump-to-class links.\nwindow.ABX_CLASS_PAGES = " +
  JSON.stringify(CLASSES.map((c) => ({ id: c.id, name: c.name, page: PAGES[c.id] })).concat([{ id: "practical", name: "Penicillin allergy, IV→PO, renal dosing", page: PAGES.practical }])) + ";\n");
console.log("wrote abx-classes.html and abx-classes-pages.js;", CLASSES.length + 2, "pages expected");
