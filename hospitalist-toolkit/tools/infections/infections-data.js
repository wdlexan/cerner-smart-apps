/* Infections by body site - clinical content. UNVERIFIED draft written by Claude from general knowledge and current guidelines
   (IDSA SSTI 2014, IWGDF/IDSA diabetic foot 2023, ATS/IDSA CAP 2019 + ATS 2025 update, IDSA cUTI 2025, AGA diverticulitis 2021,
   IDSA bacterial meningitis 2004 / ESCMID 2016, IDSA rhinosinusitis 2012, ADA dental 2019). Adult doses, normal renal function.
   Verify against Island Health / local antibiogram and pharmacy before use. Edit this file to change content; app.js renders it.
   Each site: organisms, watch (red flags), ix {blood, imaging, other}, source (surgery / source control),
   abx [{tier:'mild'|'moderate'|'severe', setting, regimen}], allergy, duration, ivpo, idc (when to call ID), surgeon. */
window.INF_SITES = [
{
  id: "skin", label: "Skin & soft tissue", match: /cellulitis|erysipelas|skin abscess|soft tissue abscess|soft tissue|skin infection|wound infection|diabetic foot|foot ulcer|necroti[sz]ing fasciitis|fasciitis/i,
  sub: "Cellulitis, abscess, diabetic foot, necrotizing infection",
  organisms: [
    "Non-purulent cellulitis / erysipelas: beta-hemolytic streptococci (group A, C, G), less often S. aureus",
    "Purulent (abscess, furuncle, pus): S. aureus incl. MRSA",
    "Diabetic foot: mild - S. aureus and streptococci; moderate-severe or chronic/previously treated - add gram-negatives (Enterobacterales, Pseudomonas if macerated/water exposure) and anaerobes (ischemia, necrosis)",
    "Animal bite: Pasteurella (cat/dog), Capnocytophaga (dog, asplenia); human bite: Eikenella, oral anaerobes",
    "Water exposure: Vibrio (salt water), Aeromonas (fresh water)",
    "Necrotizing fasciitis: type 1 polymicrobial (diabetes, perineum - Fournier); type 2 group A strep or S. aureus"
  ],
  watch: [
    "NECROTIZING FASCIITIS: pain out of proportion, rapid spread over hours, woody induration beyond the erythema, bullae (esp. hemorrhagic), skin anesthesia, crepitus/gas, grey or dusky skin, systemic toxicity. LRINEC (below) helps but a low score does NOT exclude it - call surgery on clinical suspicion",
    "Toxic shock syndrome (GAS or S. aureus): hypotension, rash, multi-organ failure - add clindamycin, consider IVIG",
    "Mimics: DVT, stasis dermatitis (bilateral cellulitis is rare), gout, contact dermatitis, lipodermatosclerosis",
    "Diabetic foot: probe-to-bone positive or exposed bone = osteomyelitis; critical limb ischemia (absent pulses, ABI) needs vascular review",
    "Periorbital/orbital, hand and perineal infections - lower threshold for imaging and surgical review"
  ],
  ix: {
    blood: ["CBC, creatinine, glucose, CRP (LRINEC), lactate if unwell, CK (myonecrosis)", "Blood cultures only if systemic toxicity, immunocompromise, animal/water exposure or severe infection (low yield in simple cellulitis)", "ESR/CRP for diabetic foot osteomyelitis (ESR >70 supports)", "HbA1c in diabetic foot"],
    imaging: ["Usually none for simple cellulitis", "Ultrasound: occult abscess", "Doppler if DVT possible", "Plain X-ray of the foot (gas, osteomyelitis, foreign body); MRI for osteomyelitis", "CT with contrast if necrotizing infection suspected - but do NOT delay surgery for imaging"],
    other: ["Swab/culture pus from abscesses (not intact skin)", "Diabetic foot: deep tissue or bone culture after debridement (not superficial swab)", "Mark the erythema border and photograph to track spread"]
  },
  source: ["Abscess: incision and drainage is the main treatment", "Necrotizing infection: EMERGENT surgical exploration/debridement, re-look in 24 h", "Diabetic foot: debridement, offloading, vascular assessment; amputation for wet gangrene/uncontrolled infection", "Elevate the limb; treat tinea/fissures, edema"],
  abx: [
    { tier: "mild", setting: "Non-purulent cellulitis, outpatient", regimen: "Cephalexin 500 mg PO QID (1 g TID if obese)" },
    { tier: "mild", setting: "Purulent / abscess after I&D (if systemic signs, large, or immunocompromised)", regimen: "TMP-SMX 1-2 DS tab PO BID, or doxycycline 100 mg PO BID (MRSA cover)" },
    { tier: "mild", setting: "Bite wound", regimen: "Amoxicillin-clavulanate 875/125 mg PO BID" },
    { tier: "moderate", setting: "Non-purulent cellulitis, inpatient", regimen: "Cefazolin 2 g IV q8h" },
    { tier: "moderate", setting: "Purulent / MRSA risk (prior MRSA, IVDU, failed beta-lactam)", regimen: "Vancomycin IV (load 25 mg/kg, then per pharmacy AUC dosing)" },
    { tier: "moderate", setting: "Diabetic foot, moderate", regimen: "Amoxicillin-clavulanate 875/125 mg PO BID, or ceftriaxone 2 g IV daily + metronidazole 500 mg PO/IV q12h; add vancomycin if MRSA risk" },
    { tier: "severe", setting: "Severe / suspected necrotizing infection / septic", regimen: "Piperacillin-tazobactam 4.5 g IV q6h (or meropenem 1 g IV q8h) + vancomycin IV + clindamycin 900 mg IV q8h (toxin suppression)" },
    { tier: "severe", setting: "Group A strep necrotizing infection / TSS (once confirmed)", regimen: "Penicillin G 4 million units IV q4h + clindamycin 900 mg IV q8h; consider IVIG for streptococcal TSS" }
  ],
  allergy: ["Non-severe penicillin allergy (rash, remote): cefazolin/cephalexin are fine (dissimilar side chains)", "Severe (anaphylaxis): vancomycin IV, or clindamycin 300-450 mg PO QID / 600-900 mg IV q8h (strep clindamycin resistance ~10-20%, C. difficile risk)", "Severe delayed reaction (SJS/TEN, DRESS): avoid all beta-lactams - ID/allergy input"],
  duration: ["Cellulitis: 5-6 days if improving (extend only if not improved)", "Abscess after I&D: 5-7 days if antibiotics given", "Diabetic foot soft tissue: 1-2 weeks; osteomyelitis 6 weeks (about 3 weeks after minor amputation with clear margin; 2-5 days if all infected bone resected)", "Necrotizing infection: until no further debridement needed, clinically improved and afebrile 48-72 h"],
  ivpo: ["IV if systemic toxicity, rapid progression, failed oral therapy, or unable to take PO", "Switch to cephalexin (or matching oral) once afebrile 24-48 h, erythema receding, eating"],
  idc: ["Necrotizing infection or TSS", "S. aureus bacteremia (always)", "Diabetic foot osteomyelitis needing long therapy / OPAT", "Unusual exposure (water, animal), immunocompromised, or not improving after 48-72 h"],
  surgeon: ["Suspected necrotizing infection - general/plastic surgery NOW (Fournier: urology)", "Abscess not amenable to bedside drainage, hand infections (plastics)", "Diabetic foot with abscess, gangrene, or osteomyelitis (vascular/ortho/podiatry)"]
},
{
  id: "lung", label: "Lung (pneumonia)", match: /pneumonia|\bcap\b|\bhap\b|aspiration|empyema|lung abscess|lower respiratory/i,
  sub: "Community-acquired, aspiration, hospital-acquired, empyema",
  organisms: [
    "CAP: S. pneumoniae, H. influenzae, M. catarrhalis, atypicals (Mycoplasma, Chlamydophila, Legionella), respiratory viruses (influenza, COVID-19, RSV)",
    "Post-influenza: S. aureus (incl. MRSA) - necrotizing pneumonia",
    "Aspiration pneumonitis vs aspiration pneumonia: oral flora; anaerobes mainly with abscess/empyema",
    "Hospital-acquired / healthcare: S. aureus, Pseudomonas, Enterobacterales, Klebsiella",
    "Structural lung disease (bronchiectasis, CF): Pseudomonas"
  ],
  watch: [
    "Severe CAP (ICU): needs vasopressors or ventilation, or >=3 minor criteria (RR >=30, PaO2/FiO2 <=250, multilobar, confusion, urea >7, WBC <4, platelets <100, temp <36, hypotension needing fluids)",
    "Parapneumonic effusion/empyema - tap any significant effusion (pH <7.2, glucose low, pus or positive Gram stain = chest tube)",
    "Lung abscess / cavitation - consider MRSA, anaerobes, TB (airborne isolation if TB possible)",
    "Not improving at 72 h: wrong bug, empyema, abscess, obstruction (tumour), PE, heart failure, drug fever",
    "Legionella: hyponatremia, diarrhea, high fever, confusion"
  ],
  ix: {
    blood: ["CBC, lytes, urea, creatinine, CRP, lactate if unwell", "Blood cultures: severe CAP, or if MRSA/Pseudomonas cover started or prior isolation", "Procalcitonin may help decide stopping (not starting) antibiotics", "ABG/VBG if hypoxic or hypercapnic"],
    imaging: ["Chest X-ray (or lung ultrasound per ATS 2025)", "CT chest if effusion, abscess, not improving, or diagnosis unclear", "Pleural ultrasound before thoracentesis"],
    other: ["Sputum Gram stain and culture (severe CAP, MRSA/Pseudomonas risk)", "Nasopharyngeal PCR: influenza, COVID-19, RSV", "Urine Legionella antigen (severe or epidemiologic risk); pneumococcal urine antigen (severe)", "MRSA nasal PCR - negative result allows stopping vancomycin", "Pleural fluid: pH, glucose, LDH, protein, cell count, Gram stain, culture"]
  },
  source: ["Empyema or complicated effusion: chest tube (thoracic surgery if loculated - consider intrapleural tPA/DNase)", "Large lung abscess not draining: IR/thoracic surgery", "Obstructing lesion: bronchoscopy"],
  abx: [
    { tier: "mild", setting: "Outpatient, no comorbidities", regimen: "Amoxicillin 1 g PO TID, or doxycycline 100 mg PO BID" },
    { tier: "mild", setting: "Outpatient with comorbidities (COPD, heart/liver/renal disease, diabetes, alcohol)", regimen: "Amoxicillin-clavulanate 875/125 mg PO BID + (azithromycin 500 mg day 1 then 250 mg daily, or doxycycline 100 mg BID); or levofloxacin 750 mg PO daily" },
    { tier: "moderate", setting: "Inpatient, ward", regimen: "Ceftriaxone 1-2 g IV daily + azithromycin 500 mg PO/IV daily (or doxycycline); or levofloxacin 750 mg PO/IV daily (severe beta-lactam allergy)" },
    { tier: "moderate", setting: "Aspiration pneumonia (community)", regimen: "Ceftriaxone 1-2 g IV daily, or amoxicillin-clavulanate; add metronidazole only for abscess/empyema" },
    { tier: "severe", setting: "Severe CAP / ICU", regimen: "Ceftriaxone 2 g IV daily + azithromycin 500 mg IV daily; consider hydrocortisone 200 mg/day (severe CAP, not in influenza)" },
    { tier: "severe", setting: "MRSA risk (prior MRSA, post-influenza necrotizing, cavitation)", regimen: "Add vancomycin IV (or linezolid 600 mg q12h); stop if MRSA nasal PCR and cultures negative at 48 h" },
    { tier: "severe", setting: "Pseudomonas risk / hospital-acquired", regimen: "Piperacillin-tazobactam 4.5 g IV q6h (or cefepime 2 g IV q8h, or meropenem 1 g IV q8h) +/- vancomycin" }
  ],
  allergy: ["Non-severe penicillin allergy: ceftriaxone is fine", "Severe: levofloxacin 750 mg daily (or moxifloxacin 400 mg daily) monotherapy covers typical + atypical", "Fluoroquinolone cautions: QTc, aortic aneurysm, tendinopathy, delirium, C. difficile"],
  duration: ["Clinically stable by day 3 (afebrile, HR <100, RR <24, SpO2 >=90% on room air, normal mentation, eating): 3-5 days total (ATS 2025; PTC trial)", "Otherwise minimum 5 days and until stable 48 h", "Longer: S. aureus or Pseudomonas (7 days+), empyema (2-6 weeks, drained), abscess (3-6 weeks), Legionella severe (7-14 days)", "HAP/VAP: 7 days"],
  ivpo: ["Most ward patients can take PO from the start if absorbing (levofloxacin, doxycycline have ~100% bioavailability)", "Switch IV to PO when stable: amoxicillin-clavulanate or amoxicillin +/- azithromycin/doxycycline"],
  idc: ["S. aureus bacteremia (always)", "Severe immunocompromise (transplant, neutropenia, HIV with low CD4)", "Lung abscess/empyema needing prolonged therapy", "Suspected TB, fungal, or Pneumocystis", "MDR organism or not improving after 72 h"],
  surgeon: ["Empyema not draining with chest tube - thoracic surgery", "Massive hemoptysis, necrotizing pneumonia"]
},
{
  id: "uti", label: "Urinary tract (UTI)", match: /\buti\b|urinary tract infection|cystitis|pyelonephritis|urosepsis|cauti|bacteriuria/i,
  sub: "Cystitis, pyelonephritis, CAUTI, urosepsis",
  organisms: ["E. coli (most), Klebsiella, Proteus, Enterococcus, S. saprophyticus (young women)", "Healthcare/catheter/recurrent: ESBL-producing Enterobacterales, Pseudomonas, Enterococcus", "Candida in urine is usually colonization (catheter) - treat only in specific situations"],
  watch: [
    "ASYMPTOMATIC BACTERIURIA - do not treat (positive culture without urinary symptoms or fever), except pregnancy or before urologic procedure with mucosal bleeding. Confusion alone in the elderly is not a UTI",
    "Obstructed infected kidney (stone + fever) - urologic emergency: urgent decompression (stent or nephrostomy)",
    "Emphysematous pyelonephritis (diabetes, gas on CT) and renal/perinephric abscess",
    "Men with febrile UTI: think prostatitis (see Prostate)",
    "Sepsis: blood cultures, early broad therapy if prior ESBL"
  ],
  ix: {
    blood: ["CBC, creatinine, lytes, lactate if septic", "Blood cultures: pyelonephritis needing admission, sepsis"],
    imaging: ["None for uncomplicated cystitis/pyelonephritis that improves", "Ultrasound or CT KUB/abdomen if septic, stone history, no improvement in 48-72 h, or suspected obstruction/abscess"],
    other: ["Urinalysis and urine culture BEFORE antibiotics (from a new catheter if catheterized >2 weeks)", "Check prior urine cultures and susceptibilities (ESBL?)", "Pregnancy test in women of childbearing potential"]
  },
  source: ["Remove or replace urinary catheter (culture from the new one)", "Obstruction: urology for stent/nephrostomy", "Abscess >5 cm: drainage"],
  abx: [
    { tier: "mild", setting: "Cystitis (bladder only, women or men)", regimen: "Nitrofurantoin 100 mg PO BID x 5 days (avoid if CrCl <30), or TMP-SMX 1 DS BID x 3 days (if local resistance <20%), or fosfomycin 3 g once" },
    { tier: "mild", setting: "Pyelonephritis, outpatient", regimen: "Ciprofloxacin 500 mg PO BID (or levofloxacin 750 mg daily) x 5-7 days, or TMP-SMX DS BID x 7 days if susceptible; oral beta-lactams less reliable - give a first dose of ceftriaxone 1 g IV" },
    { tier: "moderate", setting: "Complicated UTI / pyelonephritis, inpatient, not septic", regimen: "Ceftriaxone 1-2 g IV daily (ertapenem 1 g IV daily if ESBL within 12 months)" },
    { tier: "moderate", setting: "CAUTI", regimen: "As complicated UTI; change catheter; cover per prior cultures" },
    { tier: "severe", setting: "Sepsis / septic shock from urinary source", regimen: "Piperacillin-tazobactam 4.5 g IV q6h; meropenem 1 g IV q8h if ESBL known or prior ESBL (pip-tazo inferior for ESBL bacteremia - MERINO); add vancomycin only if Enterococcus/MRSA risk and shock" }
  ],
  allergy: ["Non-severe penicillin allergy: ceftriaxone fine", "Carbapenems (ertapenem/meropenem): cross-reactivity with penicillin <1% - generally acceptable even after penicillin anaphylaxis, give with monitoring (needed for ESBL)", "Severe beta-lactam allergy: ciprofloxacin/levofloxacin, TMP-SMX if susceptible, or aminoglycoside (gentamicin 5-7 mg/kg once daily, short course, watch renal function)"],
  duration: ["Cystitis: nitrofurantoin 5 days, TMP-SMX 3 days, fosfomycin single dose (men: 7 days)", "Complicated UTI incl. pyelonephritis and CAUTI, improving: 5-7 days of a fluoroquinolone or 7 days of another agent (IDSA 2025)", "With gram-negative bacteremia and improving: 7 days total", "Prostatitis, abscess, or slow response: longer (see Prostate)"],
  ivpo: ["Switch to oral as soon as improving and tolerating PO (IDSA 2025 favours oral step-down) - choose by susceptibility", "Oral options: ciprofloxacin, TMP-SMX, amoxicillin-clavulanate or cephalexin (beta-lactams: complete 7-10 days)"],
  idc: ["Carbapenem-resistant or difficult-to-treat resistant organisms", "Candidemia or fungal ball", "Recurrent cUTI with structural abnormality or transplant kidney"],
  surgeon: ["Obstruction/stone with infection - urology urgently", "Emphysematous pyelonephritis, abscess", "Fournier gangrene - see Skin"]
},
{
  id: "prostate", label: "Prostate", match: /prostatitis|prostate abscess/i,
  sub: "Acute bacterial prostatitis, prostatic abscess",
  organisms: ["E. coli and other Enterobacterales (most), Pseudomonas, Enterococcus", "Men <35 or sexually active: N. gonorrhoeae, Chlamydia trachomatis", "After prostate biopsy: fluoroquinolone-resistant E. coli, ESBL"],
  watch: ["Urinary retention - catheter (in-out or suprapubic; avoid prolonged urethral catheter if possible)", "Prostatic abscess: not improving at 48-72 h, persistent fever - TRUS or CT/MRI pelvis", "Sepsis after biopsy - assume resistant organisms", "Avoid prostatic massage in acute prostatitis (bacteremia)"],
  ix: { blood: ["CBC, creatinine, blood cultures if febrile", "PSA not useful acutely (falsely raised)"], imaging: ["Bladder scan for retention", "TRUS or CT/MRI pelvis if abscess suspected"], other: ["Midstream urine culture", "NAAT for gonorrhea/chlamydia if <35 or STI risk"] },
  source: ["Abscess: transrectal/transperineal drainage (urology)", "Retention: catheter"],
  abx: [
    { tier: "mild", setting: "Outpatient", regimen: "Ciprofloxacin 500 mg PO BID (or levofloxacin 500-750 mg daily), or TMP-SMX 1 DS PO BID" },
    { tier: "mild", setting: "STI risk", regimen: "Ceftriaxone 500 mg IM once + doxycycline 100 mg PO BID x 10 days" },
    { tier: "moderate", setting: "Inpatient", regimen: "Ceftriaxone 1-2 g IV daily (ertapenem if ESBL); step down by susceptibility to a fluoroquinolone or TMP-SMX (good prostate penetration)" },
    { tier: "severe", setting: "Septic / post-biopsy", regimen: "Piperacillin-tazobactam 4.5 g IV q6h or meropenem 1 g IV q8h" }
  ],
  allergy: ["Fluoroquinolone or TMP-SMX are oral mainstays; beta-lactams penetrate the prostate poorly for step-down"],
  duration: ["Acute bacterial prostatitis: 2-4 weeks (usually 2 weeks if quick response; 4 weeks if slow or abscess)", "Chronic bacterial prostatitis: 4-6 weeks fluoroquinolone"],
  ivpo: ["Oral fluoroquinolone/TMP-SMX once afebrile and improving"],
  idc: ["Resistant organism with no oral option", "Recurrent/chronic bacterial prostatitis"],
  surgeon: ["Prostatic abscess, retention not resolving - urology"]
},
{
  id: "joint", label: "Joints (septic arthritis)", match: /septic arthritis|joint infection|prosthetic joint|periprosthetic|septic (knee|hip|shoulder)|bursitis/i,
  sub: "Native joint, prosthetic joint, septic bursitis",
  organisms: ["S. aureus (most, incl. MRSA), streptococci", "Gram-negatives: elderly, immunocompromised, IVDU (Pseudomonas)", "N. gonorrhoeae: young sexually active (migratory polyarthralgia, tenosynovitis, pustules)", "Prosthetic joint: coagulase-negative staph, S. aureus, Cutibacterium (shoulder), streptococci, gram-negatives"],
  watch: ["A hot swollen joint is septic until proven otherwise - crystals do not exclude infection (both can coexist)", "Prosthetic joint: do NOT give antibiotics before aspiration/tissue samples if the patient is stable", "Sternoclavicular/sacroiliac joints in IVDU", "Endocarditis with S. aureus or strep septic arthritis - consider echo"],
  ix: { blood: ["CBC, CRP, ESR, creatinine, urate", "Blood cultures x2 (positive in ~50%)"], imaging: ["X-ray baseline (fracture, chondrocalcinosis, loosening)", "Ultrasound to confirm effusion / guide aspiration (hip)", "MRI if osteomyelitis or adjacent abscess suspected"], other: ["JOINT ASPIRATION before antibiotics: cell count (>50,000 WBC with >90% PMN suggests infection; >3,000 in prosthetic knee), Gram stain, culture (blood culture bottles), crystals", "NAAT urine/throat/rectal for gonorrhea if at risk"] },
  source: ["Drainage is essential: arthroscopic or open washout (ortho), or daily needle aspiration", "Prosthetic joint: DAIR (debridement, antibiotics, implant retention) if early, or 1- or 2-stage revision"],
  abx: [
    { tier: "moderate", setting: "Gram-positive cocci / no Gram stain, no MRSA risk", regimen: "Cefazolin 2 g IV q8h" },
    { tier: "moderate", setting: "MRSA risk or Gram-positive cocci in clusters", regimen: "Vancomycin IV (load 25 mg/kg, AUC dosing)" },
    { tier: "moderate", setting: "Gram-negative risk (elderly, IVDU, immunocompromised) or gonococcal", regimen: "Add ceftriaxone 2 g IV daily (gonococcal: ceftriaxone 1 g IV daily)" },
    { tier: "severe", setting: "Septic / Pseudomonas risk", regimen: "Vancomycin + cefepime 2 g IV q8h (or piperacillin-tazobactam)" }
  ],
  allergy: ["Severe beta-lactam allergy: vancomycin (+ ciprofloxacin or aztreonam for gram-negatives)"],
  duration: ["Native joint: 3-4 weeks total (2 weeks may suffice after surgical washout in some joints); early oral step-down acceptable (OVIVA)", "Gonococcal: 7-14 days", "Prosthetic joint: 6 weeks (DAIR often 12 weeks with rifampin) - ID to direct"],
  ivpo: ["Oral step-down once improving and organism known (e.g. cephalexin high dose, linezolid, TMP-SMX + rifampin, fluoroquinolone for gram-negatives) - OVIVA showed oral non-inferior for bone and joint infection"],
  idc: ["All prosthetic joint infections", "S. aureus bacteremia", "Resistant organism or need for prolonged therapy/rifampin combinations"],
  surgeon: ["Orthopedics for every suspected septic joint (washout) and every prosthetic joint infection"]
},
{
  id: "divert", label: "Diverticulitis / intra-abdominal", match: /diverticulitis|intra-?abdominal|peritonitis|appendicitis|cholecystitis|cholangitis|abdominal abscess/i,
  sub: "Uncomplicated and complicated diverticulitis",
  organisms: ["Enterobacterales (E. coli), anaerobes (Bacteroides fragilis), streptococci", "Healthcare-associated: Pseudomonas, Enterococcus, ESBL, Candida"],
  watch: ["Complicated: abscess, perforation (free air), peritonitis, fistula (pneumaturia - colovesical), obstruction", "Immunocompromised (steroids, transplant, chemo): fewer signs, higher perforation risk - lower threshold for CT and antibiotics", "Not improving in 48-72 h - repeat CT for abscess", "Colonoscopy 6-8 weeks after complicated episode (or first episode without prior colonoscopy) to exclude cancer"],
  ix: { blood: ["CBC, CRP, lactate if unwell, creatinine, lipase, LFTs", "Blood cultures if febrile/septic"], imaging: ["CT abdomen/pelvis with IV contrast (confirms diagnosis, finds abscess/perforation)"], other: ["Urinalysis (colovesical fistula)", "Abscess fluid culture if drained"] },
  source: ["Abscess >=3-4 cm: CT-guided percutaneous drainage", "Free perforation / purulent or feculent peritonitis: emergency surgery", "Elective resection discussion after recovery for complicated/recurrent disease"],
  abx: [
    { tier: "mild", setting: "Uncomplicated, immunocompetent, well", regimen: "Antibiotics often NOT needed (AGA 2021; DIABOLO, AVOD) - clear fluids, analgesia, review in 2-3 days. If used: amoxicillin-clavulanate 875/125 mg PO BID, or ciprofloxacin 500 mg BID + metronidazole 500 mg PO TID" },
    { tier: "moderate", setting: "Inpatient / complicated", regimen: "Ceftriaxone 2 g IV daily + metronidazole 500 mg PO/IV q12h" },
    { tier: "severe", setting: "Septic, peritonitis, or healthcare-associated", regimen: "Piperacillin-tazobactam 4.5 g IV q6h (meropenem 1 g q8h if ESBL)" }
  ],
  allergy: ["Severe beta-lactam allergy: ciprofloxacin (or levofloxacin) + metronidazole; severe sepsis - aztreonam + metronidazole +/- vancomycin"],
  duration: ["Uncomplicated (if treated): 4-7 days", "Complicated with source control: 4 days after source control (STOP-IT)", "Undrained small abscess: until clinical/radiologic resolution, usually 10-14 days"],
  ivpo: ["Oral amoxicillin-clavulanate or ciprofloxacin + metronidazole once eating and improving"],
  idc: ["Resistant organisms, candida peritonitis", "Persistent sepsis despite source control"],
  surgeon: ["General surgery: perforation, peritonitis, abscess not drainable, obstruction, fistula, failure of non-operative care, immunocompromised"]
},
{
  id: "mening", label: "Meningitis / encephalitis", match: /meningitis|encephalitis|ventriculitis|brain abscess/i,
  sub: "Bacterial meningitis, HSV encephalitis",
  organisms: ["S. pneumoniae, N. meningitidis", "Age >50, pregnancy, alcohol, immunocompromised: add Listeria monocytogenes", "Post-neurosurgery / shunt: S. aureus, coagulase-negative staph, gram-negatives incl. Pseudomonas", "Encephalitis: HSV-1 (most important treatable), VZV, enteroviruses, West Nile; autoimmune (see AE app)", "Cryptococcus in HIV/transplant"],
  watch: ["EMERGENCY: do not delay antibiotics for CT or LP - blood cultures, dexamethasone, antibiotics within 1 hour", "CT before LP only if: immunocompromised, known CNS lesion, new seizure, papilledema, reduced level of consciousness (GCS <10-12), focal deficit", "Petechial/purpuric rash = meningococcemia (droplet isolation 24 h after effective therapy; notify public health)", "Encephalitis signs (confusion, behaviour change, seizures, focal signs) - add acyclovir", "Raised ICP, seizures, hearing loss (pneumococcal), DIC"],
  ix: { blood: ["Blood cultures x2 BEFORE antibiotics", "CBC, lytes, creatinine, glucose (for CSF ratio), lactate, coagulation"], imaging: ["CT head (only if criteria above, after antibiotics started)", "MRI brain for encephalitis (temporal lobe HSV)"], other: ["LP: opening pressure, cell count, protein, glucose, Gram stain, culture; HSV/VZV/enterovirus PCR; cryptococcal antigen if immunocompromised; keep extra CSF", "Meningitis/encephalitis multiplex PCR if available", "EEG if altered or seizures"] },
  source: ["Neurosurgery for brain abscess, shunt infection, CSF leak, or hydrocephalus"],
  abx: [
    { tier: "severe", setting: "Adult suspected bacterial meningitis (community)", regimen: "Dexamethasone 10 mg IV q6h x 4 days (first dose before or with antibiotics) + ceftriaxone 2 g IV q12h + vancomycin IV (load 25 mg/kg, trough/AUC per pharmacy)" },
    { tier: "severe", setting: "Age >50, pregnant, alcohol, immunocompromised", regimen: "ADD ampicillin 2 g IV q4h (Listeria)" },
    { tier: "severe", setting: "Encephalitis features", regimen: "ADD acyclovir 10 mg/kg IV q8h (ideal body weight; hydrate, adjust for renal function)" },
    { tier: "severe", setting: "Post-neurosurgery / shunt", regimen: "Vancomycin + cefepime 2 g IV q8h (or meropenem 2 g IV q8h)" }
  ],
  allergy: ["Severe beta-lactam allergy: vancomycin + moxifloxacin 400 mg IV daily (or meropenem if allergy non-severe); Listeria: TMP-SMX 5 mg/kg (TMP) IV q6-8h", "Always involve ID"],
  duration: ["N. meningitidis: 7 days", "S. pneumoniae: 10-14 days", "Listeria: >=21 days", "Gram-negative bacilli: 21 days", "HSV encephalitis: 14-21 days acyclovir IV", "Stop dexamethasone if not pneumococcal (some continue for unknown cause)"],
  ivpo: ["IV throughout (high-dose IV needed for CSF penetration) - no oral step-down"],
  idc: ["ALL cases of meningitis/encephalitis", "Public health for meningococcal disease - close-contact prophylaxis (ciprofloxacin 500 mg PO once, or rifampin, or ceftriaxone 250 mg IM)"],
  surgeon: ["Neurosurgery: abscess, shunt, hydrocephalus"]
},
{
  id: "sinus", label: "Sinus", match: /sinusitis|rhinosinusitis|orbital cellulitis|periorbital/i,
  sub: "Acute bacterial rhinosinusitis and its complications",
  organisms: ["Mostly viral (>98%)", "Bacterial: S. pneumoniae, H. influenzae, M. catarrhalis", "Hospital/NG tube: S. aureus, gram-negatives", "Diabetic ketoacidosis, neutropenia, transplant: Mucorales, Aspergillus (invasive fungal - emergency)"],
  watch: ["Bacterial only if: >=10 days without improvement; severe onset (fever >=39 C + purulent discharge/facial pain >=3 days); or 'double worsening' after initial improvement", "ORBITAL complications: periorbital swelling/erythema, proptosis, painful or limited eye movement, diplopia, reduced vision - CT orbits/sinuses with contrast, ophthalmology + ENT urgently", "Intracranial: severe headache, meningism, altered mental status, focal signs - cavernous sinus thrombosis, epidural/brain abscess", "Invasive fungal sinusitis: black eschar on palate/turbinate, facial numbness in immunocompromised - ENT same day"],
  ix: { blood: ["Usually none", "CBC, glucose, blood cultures if complicated or immunocompromised"], imaging: ["No imaging for uncomplicated sinusitis", "CT sinuses/orbits with contrast for complications; MRI for intracranial"], other: ["Endoscopic culture by ENT if complicated, immunocompromised, or failing therapy"] },
  source: ["ENT drainage for orbital abscess, frontal sinus (Pott puffy tumor), invasive fungal debridement"],
  abx: [
    { tier: "mild", setting: "Acute bacterial sinusitis", regimen: "Amoxicillin 500 mg-1 g PO TID (higher dose if risk of resistance); amoxicillin-clavulanate 875/125 mg BID if recent antibiotics/risk factors; plus saline irrigation and intranasal steroid" },
    { tier: "moderate", setting: "Hospitalized / failed oral therapy", regimen: "Ceftriaxone 1-2 g IV daily" },
    { tier: "severe", setting: "Orbital / intracranial complication", regimen: "Ceftriaxone 2 g IV q12h + vancomycin IV + metronidazole 500 mg IV q8h (intracranial); ENT/ophthalmology" }
  ],
  allergy: ["Doxycycline 100 mg PO BID, or levofloxacin 750 mg daily / moxifloxacin 400 mg daily (reserve for treatment failure)"],
  duration: ["Uncomplicated: 5-7 days", "Orbital cellulitis: 2-3 weeks (IV then PO)", "Intracranial complications: 4-8 weeks (ID)"],
  ivpo: ["Oral for uncomplicated; IV for orbital/intracranial until clear improvement"],
  idc: ["Intracranial extension, invasive fungal sinusitis, immunocompromised"],
  surgeon: ["ENT: orbital abscess, invasive fungal disease, frontal sinus complications; ophthalmology for any orbital signs"]
},
{
  id: "dental", label: "Dental / deep neck", match: /dental|odontogenic|tooth|ludwig|peritonsillar|deep neck|parapharyngeal|retropharyngeal/i,
  sub: "Odontogenic infection, Ludwig angina, deep neck space infection",
  organisms: ["Oral streptococci (viridans, S. anginosus group), anaerobes (Prevotella, Fusobacterium, Peptostreptococcus)", "Lemierre syndrome: Fusobacterium necrophorum (septic internal jugular thrombophlebitis, lung emboli)"],
  watch: ["AIRWAY: floor-of-mouth swelling, raised tongue, drooling, trismus, muffled 'hot potato' voice, stridor, unable to lie flat - Ludwig angina: anesthesia/ENT immediately, secure airway", "Trismus, neck swelling or stiffness, odynophagia - deep neck space infection: CT neck with contrast", "Mediastinitis (chest pain, widened mediastinum)", "Lemierre: sore throat then sepsis, neck pain, lung nodules"],
  ix: { blood: ["CBC, creatinine, lactate if unwell, blood cultures if systemic"], imaging: ["Panoramic dental X-ray (OPG) for source", "CT neck with contrast for swelling beyond the jaw, trismus, or airway concern", "CT chest if mediastinitis suspected"], other: ["Culture pus from drainage"] },
  source: ["Dental source control is the main treatment: extraction, root canal, or incision and drainage (dentist/oral surgery)", "Deep neck abscess: ENT/OMFS surgical drainage"],
  abx: [
    { tier: "mild", setting: "Localized dental infection with systemic signs or spreading (not needed if source control alone)", regimen: "Penicillin VK 500 mg PO QID or amoxicillin 500 mg PO TID; add metronidazole 500 mg PO TID if not improving in 2-3 days" },
    { tier: "moderate", setting: "Facial cellulitis, admitted", regimen: "Penicillin G 2-4 million units IV q4-6h + metronidazole 500 mg IV q12h, or ceftriaxone 2 g IV daily + metronidazole" },
    { tier: "severe", setting: "Ludwig angina / deep neck infection / septic", regimen: "Piperacillin-tazobactam 4.5 g IV q6h (or ceftriaxone 2 g IV + metronidazole 500 mg IV q8h) +/- vancomycin if MRSA risk; dexamethasone may reduce airway edema (with ENT/anesthesia)" }
  ],
  allergy: ["Non-severe penicillin allergy: cephalexin 500 mg PO QID (+/- metronidazole)", "Severe: clindamycin 300 mg PO QID / 600 mg IV q8h (C. difficile risk), or azithromycin + metronidazole (ADA 2019)"],
  duration: ["Dental with source control: 3-7 days (stop 24 h after symptoms resolve)", "Deep neck infection: 2-3 weeks after drainage; Lemierre 4-6 weeks"],
  ivpo: ["IV for facial cellulitis, trismus, airway risk; switch to amoxicillin-clavulanate when swelling regressing and swallowing"],
  idc: ["Lemierre syndrome, mediastinitis, septic thrombophlebitis"],
  surgeon: ["ENT/OMFS: Ludwig angina, any deep neck abscess, airway concern; dentist for all odontogenic sources"]
}
];

/* Applies to every site */
window.INF_GENERAL = {
  ivpo: ["IV route if: sepsis/shock, unable to take or absorb PO (vomiting, ileus, short gut), CNS infection, endocarditis (unless POET criteria), S. aureus bacteremia, undrained abscess, necrotizing infection, or no oral agent with activity",
    "Switch IV to PO when ALL (COMS): clinically improving; afebrile >=24-48 h; HR <100, BP stable, no new organ dysfunction; tolerating PO with functioning gut; oral agent with good bioavailability and activity (consider susceptibilities)",
    "Highly bioavailable orals: fluoroquinolones, TMP-SMX, doxycycline, linezolid, metronidazole, fluconazole, clindamycin, rifampin"],
  idc: ["S. aureus or Candida in blood - ALWAYS", "CNS infection, endocarditis, prosthetic device/joint/vascular graft infection, vertebral osteomyelitis/epidural abscess",
    "MDR organisms (CRE, difficult-to-treat Pseudomonas) or severe beta-lactam allergy limiting options", "Severe immunocompromise (neutropenia, transplant, advanced HIV)",
    "Not improving after 72 h of appropriate therapy, unclear source, or recurrent infection", "Needing OPAT (home IV) or prolonged therapy", "TB, fungal, parasitic, or travel-related infection"],
  stewardship: ["Culture before antibiotics when it does not delay care in sepsis", "Review at 48-72 h ('antibiotic time-out'): narrow, switch to PO, or stop", "Document indication, start date and planned stop date",
    "C. difficile risk: clindamycin, fluoroquinolones, cephalosporins, carbapenems"]
};
