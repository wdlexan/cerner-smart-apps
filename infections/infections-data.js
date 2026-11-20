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
  surgeon: ["Suspected necrotizing infection - general/plastic surgery NOW (perineum/genitals: see Groin & perineum - Fournier)", "Abscess not amenable to bedside drainage, hand infections (plastics)", "Diabetic foot with abscess, gangrene, or osteomyelitis (vascular/ortho/podiatry)"]
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
    "Legionella: hyponatremia, diarrhea, high fever, confusion", "TB possible (see TB site / Think TB card): airborne isolation, sputum AFB x3 + NAAT, and avoid fluoroquinolones until TB is excluded"
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
  allergy: ["Non-severe penicillin allergy: ceftriaxone is fine", "Severe: levofloxacin 750 mg daily (or moxifloxacin 400 mg daily) monotherapy covers typical + atypical - but NOT if TB is possible (masks TB)", "Fluoroquinolone cautions: QTc, aortic aneurysm, tendinopathy, delirium, C. difficile"],
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
  surgeon: ["Obstruction/stone with infection - urology urgently", "Emphysematous pyelonephritis, abscess", "Fournier gangrene - see Groin & perineum"]
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
  id: "groin", label: "Groin & perineum (Fournier)", match: /fournier|perineal|perianal|perirectal|ischiorectal|scrotal|epididym|orchitis|groin abscess|inguinal abscess|bartholin/i,
  sub: "Fournier gangrene, perianal abscess, scrotal and groin infections",
  organisms: ["Fournier gangrene: polymicrobial - E. coli, Klebsiella, Proteus, Enterococcus, streptococci (incl. group A), S. aureus, anaerobes (Bacteroides, Clostridium)", "Perianal/perirectal abscess: enteric gram-negatives and anaerobes", "Epididymo-orchitis: <35 or STI risk - N. gonorrhoeae, C. trachomatis; >35, catheter or instrumentation - E. coli and other Enterobacterales (also mumps)", "Groin abscess in people who inject drugs: S. aureus (MRSA), streptococci"],
  watch: [
    "FOURNIER GANGRENE (necrotizing fasciitis of perineum/genitals): genital or perineal pain out of proportion, swelling, crepitus, dusky or black skin, foul discharge, rapid spread to the abdominal wall or thighs, systemic toxicity. Skin findings UNDERESTIMATE the deep extent. LRINEC (below) - a low score does not exclude",
    "Risk factors: diabetes (incl. SGLT2 inhibitors - Health Canada warning), alcohol use, obesity, immunosuppression, recent perineal, urologic or colorectal procedure, urethral catheter or stricture, perianal abscess",
    "Testes are usually spared (separate blood supply); testicular involvement suggests a retroperitoneal or intra-abdominal source",
    "Groin abscess in someone who injects into the femoral area: exclude FEMORAL PSEUDOANEURYSM with Doppler ultrasound BEFORE incision",
    "Scrotal pain: testicular torsion must be excluded first (urgent Doppler/urology) - do not label as epididymitis without it",
    "Perianal abscess in neutropenia: may have no pus - early broad antibiotics and surgical review; incarcerated or strangulated hernia can mimic a groin infection"
  ],
  ix: {
    blood: ["CBC, lytes, creatinine, glucose/HbA1c, CRP (for LRINEC), lactate, CK, coagulation", "Blood cultures x2 if systemic signs"],
    imaging: ["CT abdomen/pelvis with contrast: extent of gas and fascial spread, source (perianal, urethral, retroperitoneal) - but do NOT delay surgery in clear Fournier", "Scrotal ultrasound with Doppler (torsion, abscess, orchitis)", "Groin Doppler ultrasound before draining an injection-site abscess", "MRI pelvis for complex perianal fistula/abscess"],
    other: ["Deep tissue cultures at debridement (not surface swabs)", "Urine culture; NAAT for gonorrhea/chlamydia (urine) in epididymitis", "HIV, syphilis, hepatitis testing if STI or injection drug use"]
  },
  source: ["Fournier: EMERGENCY radical debridement (urology and/or general surgery), planned re-look every 24-48 h; suprapubic catheter; diverting colostomy if extensive perianal involvement; later plastics reconstruction", "Stop SGLT2 inhibitor; tight glucose control", "Perianal/perirectal abscess: incision and drainage (general surgery)", "Groin abscess: drainage after pseudoaneurysm excluded (vascular surgery if present)", "Scrotal abscess: urology drainage"],
  abx: [
    { tier: "mild", setting: "Perianal abscess after drainage (antibiotics only if cellulitis, diabetes, immunocompromised or systemic signs)", regimen: "Amoxicillin-clavulanate 875/125 mg PO BID, or ciprofloxacin 500 mg BID + metronidazole 500 mg TID" },
    { tier: "mild", setting: "Epididymo-orchitis, STI risk", regimen: "Ceftriaxone 500 mg IM once (1 g if >=150 kg) + doxycycline 100 mg PO BID x 10 days" },
    { tier: "mild", setting: "Epididymo-orchitis, enteric (older, catheter, instrumentation)", regimen: "Levofloxacin 500 mg PO daily x 10 days (or by urine culture)" },
    { tier: "moderate", setting: "Groin abscess / cellulitis in people who inject drugs", regimen: "Vancomycin IV (MRSA) +/- cefazolin 2 g IV q8h; step down by culture" },
    { tier: "severe", setting: "Fournier gangrene / necrotizing perineal infection", regimen: "Piperacillin-tazobactam 4.5 g IV q6h (or meropenem 1 g IV q8h) + vancomycin IV + clindamycin 900 mg IV q8h (toxin suppression); adjust to cultures; antifungal if immunocompromised and Candida" }
  ],
  allergy: ["Severe beta-lactam allergy: vancomycin + (ciprofloxacin or aztreonam) + metronidazole + clindamycin; carbapenems are usually acceptable (<1% cross-reactivity)"],
  duration: ["Fournier: continue until no further debridement needed, clinical improvement and afebrile 48-72 h (often 2-3 weeks total)", "Perianal abscess, when antibiotics given: 5-7 days", "Epididymo-orchitis: 10 days", "Groin abscess after drainage: 5-7 days; longer with bacteremia (S. aureus - ID)"],
  ivpo: ["IV for Fournier and any necrotizing infection until debridement complete and improving; then oral by cultures (e.g. amoxicillin-clavulanate)"],
  idc: ["Fournier gangrene (complex polymicrobial, prolonged course)", "S. aureus bacteremia or endocarditis in people who inject drugs", "Neutropenic perianal infection"],
  surgeon: ["Fournier: urology and general surgery NOW (do not wait for CT if clinically obvious)", "Perianal abscess: general surgery", "Testicular torsion or scrotal abscess: urology urgently", "Femoral pseudoaneurysm: vascular surgery"]
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
  id: "divert", label: "Diverticulitis / intra-abdominal", match: /diverticulitis|intra-?abdominal|peritonitis|appendicitis|abdominal abscess/i,
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
  id: "biliary", label: "Biliary (cholangitis, cholecystitis)", match: /cholangitis|cholecystitis|biliary sepsis|choledocholithiasis|biliary obstruction|gallstone|liver abscess/i,
  sub: "Ascending cholangitis, acute cholecystitis (Tokyo Guidelines 2018)",
  organisms: ["E. coli, Klebsiella, Enterobacter, Enterococcus, streptococci", "Anaerobes (Bacteroides): biliary-enteric anastomosis, elderly, severe disease", "Healthcare-associated, biliary stents, prior ERCP: Pseudomonas, ESBL producers, Enterococcus (incl. VRE), Candida", "Liver abscess: Klebsiella (hypervirulent - eye/CNS spread), Streptococcus anginosus, anaerobes, Entamoeba (travel)"],
  watch: [
    "CHOLANGITIS needs DRAINAGE - antibiotics alone fail with ongoing obstruction. Charcot triad (fever, RUQ pain, jaundice) in only ~50-70%; Reynolds pentad adds shock and confusion",
    "Tokyo 2018 grading (see calculator above): Grade III (organ dysfunction) = urgent drainage as soon as resuscitated; Grade II = early ERCP within 24-48 h; Grade I = drain if no response in 24 h",
    "Elderly and immunocompromised may have no fever or pain - unexplained sepsis with raised ALP/bilirubin = cholangitis until proven otherwise",
    "Cholecystitis complications: gangrenous, emphysematous (diabetes, gas in wall - urgent surgery), perforation, empyema of gallbladder, cholecystoenteric fistula/gallstone ileus",
    "Acalculous cholecystitis in critically ill/TPN patients - high mortality, percutaneous cholecystostomy",
    "Gallstone pancreatitis with cholangitis; malignant obstruction (painless jaundice, weight loss); blocked stent; pyogenic liver abscess (Klebsiella: check eyes and CNS)"
  ],
  ix: {
    blood: ["CBC, creatinine, lytes, lactate", "Liver panel: ALP, GGT, ALT/AST, bilirubin (cholestatic pattern), albumin, INR", "Lipase (gallstone pancreatitis)", "Blood cultures x2 BEFORE antibiotics (positive in up to half of cholangitis)"],
    imaging: ["Abdominal ultrasound first: gallstones, wall thickening, pericholecystic fluid, sonographic Murphy, CBD dilatation", "CT abdomen with contrast: complications, liver abscess, malignancy, unclear diagnosis", "MRCP: CBD stones/strictures when diagnosis uncertain and patient stable (do not delay ERCP in cholangitis)", "EUS if intermediate probability of CBD stone", "HIDA scan if ultrasound equivocal for cholecystitis"],
    other: ["Bile culture at ERCP/PTBD", "Aspirate culture for liver abscess; Entamoeba serology if travel"]
  },
  source: ["Cholangitis: ERCP with sphincterotomy, stone extraction or stent (GI); PTBD by IR if ERCP fails or altered anatomy; EUS-guided drainage", "Cholecystitis: early laparoscopic cholecystectomy (within 72 h, same admission); percutaneous cholecystostomy if too unwell/frail", "After gallstone cholangitis: cholecystectomy in the same admission or soon after", "Liver abscess >5 cm or not improving: percutaneous drainage"],
  abx: [
    { tier: "mild", setting: "Grade I cholecystitis / cholangitis, community", regimen: "Ceftriaxone 1-2 g IV daily (add metronidazole 500 mg q12h if biliary-enteric anastomosis); oral step-down amoxicillin-clavulanate 875/125 mg BID" },
    { tier: "moderate", setting: "Grade II, community", regimen: "Ceftriaxone 2 g IV daily + metronidazole 500 mg PO/IV q12h (or piperacillin-tazobactam 4.5 g IV q6h)" },
    { tier: "severe", setting: "Grade III, or healthcare-associated / stent / prior ERCP", regimen: "Piperacillin-tazobactam 4.5 g IV q6h (meropenem 1 g IV q8h if ESBL); add vancomycin if Enterococcus/MRSA risk (TG18 recommends enterococcal cover in severe and healthcare-associated cases)" },
    { tier: "moderate", setting: "Pyogenic liver abscess", regimen: "Ceftriaxone 2 g IV daily + metronidazole 500 mg q12h (metronidazole also covers Entamoeba) + drainage" }
  ],
  allergy: ["Non-severe penicillin allergy: ceftriaxone + metronidazole", "Severe beta-lactam allergy: ciprofloxacin (or levofloxacin) + metronidazole; septic - aztreonam + metronidazole + vancomycin (carbapenem usually acceptable - <1% cross-reactivity)"],
  duration: ["Uncomplicated cholecystitis with cholecystectomy: stop within 24 h after surgery", "Complicated cholecystitis (gangrene, perforation, empyema): 4-7 days after source control", "Cholangitis after drainage: 4-7 days (TG18); bacteremia with Enterococcus or Streptococcus: at least 2 weeks", "Residual stones/obstruction: continue until anatomical problem fixed", "Liver abscess: 4-6 weeks (IV 2-3 weeks then oral)"],
  ivpo: ["Switch to oral (amoxicillin-clavulanate, or ciprofloxacin + metronidazole) once drained, afebrile and eating"],
  idc: ["Resistant organisms (ESBL, CRE, VRE) or Candida in bile/blood", "Klebsiella liver abscess with metastatic infection (eye/CNS)", "Recurrent cholangitis with indwelling stents, liver transplant"],
  surgeon: ["GI for urgent ERCP (Grade II within 24-48 h, Grade III as soon as resuscitated)", "General surgery for cholecystitis (cholecystectomy) and emphysematous/gangrenous gallbladder", "IR for PTBD, cholecystostomy, liver abscess drainage"]
},
{
  id: "mening", label: "Meningitis", match: /meningitis|ventriculitis|brain abscess/i,
  sub: "Bacterial vs viral (aseptic) meningitis; mentation usually preserved",
  organisms: ["Bacterial: S. pneumoniae, N. meningitidis", "Age >50, pregnancy, alcohol, immunocompromised: add Listeria monocytogenes", "Post-neurosurgery / shunt: S. aureus, coagulase-negative staph, gram-negatives incl. Pseudomonas", "Viral (aseptic): enteroviruses (summer-fall), HSV-2 (incl. recurrent Mollaret meningitis), VZV, HIV seroconversion, West Nile, mumps", "Subacute (days-weeks), lymphocytic CSF, low glucose, cranial nerve palsies: TB meningitis (see TB site)", "Cryptococcus in HIV/transplant (CSF cryptococcal antigen)"],
  watch: ["EMERGENCY: do not delay antibiotics for CT or LP - blood cultures, dexamethasone, antibiotics within 1 hour", "Meningitis alone (meninges only) leaves mentation preserved: headache, fever, neck stiffness, photophobia with a normal sensorium - typical of viral meningitis", "Confusion, behaviour change, seizures or focal signs = brain parenchyma involved: think ENCEPHALITIS / meningoencephalitis (see Encephalitis) and add acyclovir", "Caveat: severe BACTERIAL meningitis often lowers level of consciousness (raised ICP, sepsis) without encephalitis - altered mentation does not make it 'not meningitis'; treat for both if unsure", "CT before LP only if: immunocompromised, known CNS lesion, new seizure, papilledema, reduced level of consciousness (GCS <10-12), focal deficit", "Petechial/purpuric rash = meningococcemia (droplet isolation 24 h after effective therapy; notify public health)", "Raised ICP, seizures, hearing loss (pneumococcal), DIC, SIADH"],
  ix: { blood: ["Blood cultures x2 BEFORE antibiotics", "CBC, lytes, creatinine, glucose (for CSF ratio), lactate, coagulation", "Serum procalcitonin (>0.5 ng/mL favours bacterial) and CRP"], imaging: ["CT head (only if criteria above, after antibiotics started)"], other: ["LP: opening pressure, cell count + differential, protein, glucose, Gram stain, culture, CSF lactate; HSV/VZV/enterovirus PCR; cryptococcal antigen if immunocompromised; keep extra CSF", "Meningitis/encephalitis multiplex PCR if available", "Repeat LP at 6-12 h (up to 24 h) if the first CSF is neutrophilic but otherwise viral-looking"] },
  cards: [
    { title: "Bacterial vs viral - typical adult CSF", table: { head: ["", "Bacterial", "Viral"], rows: [
      ["Opening pressure", "High (often >30 cmH2O)", "Normal or mildly raised"],
      ["WBC (x10^6/L)", "Usually >1000 (lower early or after antibiotics)", "Usually 10-300, rarely >1000"],
      ["Cell type", "Neutrophils >80%", "Lymphocytes (may be neutrophils in first 24-48 h)"],
      ["Glucose", "Low: <2.2 mmol/L, CSF:serum <0.4", "Normal: ratio >0.6"],
      ["Protein", "High: >1 g/L, often >2", "Normal to mildly high: <1 g/L"],
      ["Gram stain", "Positive in ~60-90% (less after antibiotics)", "Negative"],
      ["CSF lactate", ">3.5-4 mmol/L", "<3.5 mmol/L"],
      ["Serum procalcitonin", ">0.5 ng/mL", "Low"]] },
      items: ["Lymphocytes + LOW glucose + high protein is not viral: think TB, fungal (cryptococcus), Listeria, partially treated bacterial, carcinomatous", "Antibiotics before LP lower the cell count and Gram stain/culture yield; low glucose, high protein, lactate, procalcitonin and PCR still help", "The Bacterial Meningitis Score is validated in children only - do not use it to rule out bacterial meningitis in adults"] },
    { title: "Dexamethasone - when to give, continue, stop", items: ["Give to adults with SUSPECTED bacterial meningitis: dexamethasone 10 mg IV q6h x 4 days (0.15 mg/kg), first dose 10-20 min before or with the first antibiotic - do not wait for LP/CT", "Antibiotics already given: IDSA - do not start; ESCMID - may start up to ~4 h after the first antibiotic dose", "Benefit is mainly pneumococcal (de Gans 2002: less death and hearing loss)", "Do not use: cryptococcal meningitis (harm), neurosurgical/shunt/post-traumatic meningitis; TB meningitis needs a different regimen (6-8 week taper with TB therapy, ID)", "Reduces vancomycin CSF penetration - full-dose vancomycin; consider rifampin if ceftriaxone-resistant pneumococcus suspected", "Watch glucose, delirium, GI bleeding (PPI); steroids can mask fever - repeat LP if not improving at 48 h; septic shock needs separate hydrocortisone"],
      table: { head: ["Result", "Dexamethasone"], rows: [["S. pneumoniae (Gram-positive diplococci, culture, PCR, urine antigen)", "Continue 4 days"], ["Bacterial pattern, organism unknown", "Continue 4 days"], ["N. meningitidis, H. influenzae", "IDSA: stop; ESCMID: continue"], ["Listeria", "Stop (possible harm)"], ["Viral pattern / bacterial excluded", "Stop"]] } },
    { title: "Not sure if bacterial or viral", items: ["Treat as bacterial until ruled out: blood cultures, dexamethasone with first dose, ceftriaxone 2 g IV q12h + vancomycin (+ ampicillin 2 g IV q4h if >50, immunocompromised, pregnant, alcohol)", "Add acyclovir 10 mg/kg IV q8h for ANY altered mentation, seizure or focal sign (see Encephalitis)", "Sort it out over 24-72 h: CSF lactate + serum procalcitonin, multiplex PCR (enterovirus positive with viral pattern = viral), repeat LP 6-12 h if neutrophilic-but-viral-looking, cultures at 48-72 h", "Call ID if still unclear at 48-72 h, not improving, immunocompromised, or CSF fits neither pattern"],
      table: { head: ["At 48-72 h", "Dexamethasone", "Antibiotics", "Acyclovir"], rows: [
        ["Viral pattern, low lactate/PCT, cultures negative, improving", "Stop", "Stop", "Stop when HSV PCR negative and no encephalitis*"],
        ["Enterovirus PCR positive + viral pattern", "Stop", "Stop once cultures negative", "Stop if HSV PCR negative"],
        ["Still unclear (mixed results, antibiotics before LP, not improving)", "Finish 4 days if CSF bacterial-looking", "Continue full course (10-14 days) with ID", "Continue until HSV excluded"],
        ["Lymphocytic + low glucose", "Not the meningitis regimen", "TB/fungal/Listeria workup (AFB, cryptococcal antigen); ID", "Per HSV result"]] },
      note: "*HSV PCR done within 72 h of symptoms can be falsely negative - if encephalitis still suspected, keep acyclovir and repeat LP / MRI." }],
  source: ["Neurosurgery for brain abscess, shunt infection, CSF leak, or hydrocephalus"],
  abx: [
    { tier: "severe", setting: "Adult suspected bacterial meningitis (community)", regimen: "Dexamethasone 10 mg IV q6h x 4 days (first dose before or with antibiotics) + ceftriaxone 2 g IV q12h + vancomycin IV (load 25 mg/kg, trough/AUC per pharmacy)" },
    { tier: "severe", setting: "Age >50, pregnant, alcohol, immunocompromised", regimen: "ADD ampicillin 2 g IV q4h (Listeria)" },
    { tier: "severe", setting: "Altered mentation, seizures or focal signs (possible meningoencephalitis/HSV)", regimen: "ADD acyclovir 10 mg/kg IV q8h (ideal body weight; hydrate, adjust for renal function) - see Encephalitis" },
    { tier: "moderate", setting: "Clearly viral (aseptic) meningitis: alert, viral CSF, low procalcitonin", regimen: "Supportive care (analgesia, fluids, antiemetic); stop empiric antibiotics/dexamethasone once cultures negative at 48 h; acyclovir only for HSV-2/VZV meningitis if severe or immunocompromised" },
    { tier: "severe", setting: "Post-neurosurgery / shunt", regimen: "Vancomycin + cefepime 2 g IV q8h (or meropenem 2 g IV q8h)" }
  ],
  allergy: ["Severe beta-lactam allergy: vancomycin + moxifloxacin 400 mg IV daily (or meropenem if allergy non-severe); Listeria: TMP-SMX 5 mg/kg (TMP) IV q6-8h", "Always involve ID"],
  duration: ["N. meningitidis: 7 days", "S. pneumoniae: 10-14 days", "Listeria: >=21 days", "Gram-negative bacilli: 21 days", "Viral meningitis: no antibiotics once bacterial excluded", "Dexamethasone 4 days if pneumococcal or bacterial-unknown; stop if viral, Listeria, or bacterial excluded"],
  ivpo: ["IV throughout (high-dose IV needed for CSF penetration) - no oral step-down"],
  idc: ["ALL cases of bacterial meningitis", "Public health for meningococcal disease - close-contact prophylaxis (ciprofloxacin 500 mg PO once, or rifampin, or ceftriaxone 250 mg IM)"],
  surgeon: ["Neurosurgery: abscess, shunt, hydrocephalus"]
},
{
  id: "enceph", label: "Encephalitis", match: /encephalitis|meningoencephalitis|rhombencephalitis/i,
  sub: "Brain parenchyma: altered mentation, seizures, focal signs - HSV until proven otherwise",
  organisms: ["HSV-1: commonest sporadic viral encephalitis and the key treatable one (temporal lobes)", "VZV: older or immunocompromised, rash may be absent; also vasculopathy", "Enteroviruses, West Nile (summer, flaccid weakness), other arboviruses/travel, rabies (animal exposure)", "Immunocompromised/transplant: CMV, HHV-6, EBV, JC virus, Toxoplasma, Cryptococcus", "Listeria rhombencephalitis (brainstem signs), TB", "Autoimmune: anti-NMDAR, LGI1 and others (see Autoimmune encephalitis tab); anti-NMDAR can follow HSV encephalitis weeks later", "Mimics: septic/metabolic encephalopathy, non-convulsive status, stroke, drugs, Wernicke"],
  watch: ["Encephalitis = altered mentation for >=24 h (lower level of consciousness, lethargy, personality or behaviour change) PLUS fever, new seizures, focal signs, CSF WBC >=5, abnormal MRI or EEG", "Meningitis alone keeps mentation preserved - once mentation is altered the brain itself is involved (or bacterial meningitis is severe)", "Start acyclovir IMMEDIATELY on suspicion - do not wait for LP, MRI or PCR", "HSV PCR in the first 72 h can be falsely negative: if still suspected, keep acyclovir and repeat LP in 3-7 days", "Seizures and non-convulsive status (EEG), raised ICP, SIADH/hyponatremia, aspiration", "Acyclovir crystal nephropathy (AKI): dose on ideal body weight, IV fluids, daily creatinine; acyclovir neurotoxicity in renal failure can mimic worsening encephalitis"],
  ix: { blood: ["Blood cultures, CBC, lytes (Na), creatinine, glucose, LFTs, HIV test", "Serum autoimmune encephalitis antibodies if viral workup negative"], imaging: ["MRI brain with DWI/FLAIR (HSV: medial temporal lobes, insula, often asymmetric); CT first only if MRI delayed or for safety before LP"], other: ["LP: opening pressure, cells, protein, glucose, HSV-1/2 PCR, VZV PCR, enterovirus PCR, multiplex panel; West Nile IgM in season; cryptococcal antigen if immunocompromised; oligoclonal bands; FREEZE extra CSF for autoimmune antibodies", "EEG (temporal periodic discharges in HSV; non-convulsive status)"] },
  cards: [
    { title: "Meningitis vs encephalitis", table: { head: ["", "Meningitis (meninges)", "Encephalitis (brain parenchyma)"], rows: [
      ["Mentation", "Preserved - alert, oriented (viral meningitis)", "Altered: confusion, drowsiness, behaviour or personality change"],
      ["Seizures", "Uncommon", "Common"],
      ["Focal signs", "Absent (cranial nerve palsy suggests TB/basal)", "Common: aphasia, hemiparesis, memory loss"],
      ["Neck stiffness, photophobia", "Prominent", "May be mild or absent"],
      ["MRI", "Normal or meningeal enhancement", "Parenchymal signal change (temporal lobes in HSV)"],
      ["EEG", "Normal", "Abnormal (slowing, periodic discharges)"],
      ["Treatment", "Bacterial: dex + ceftriaxone + vanco (± ampicillin); viral: supportive", "Acyclovir now; add meningitis regimen if bacterial possible"]] },
      note: "Overlap (meningoencephalitis) is common. Severe bacterial meningitis can lower consciousness without encephalitis - if unsure, treat for both." },
    { title: "Steroids and HSV encephalitis", items: ["DexEnceph (Lancet Neurology, Jan 2026; 94 adults, 53 UK hospitals): dexamethasone 10 mg IV q6h x 4 days added to acyclovir did not improve verbal memory at 26 weeks overall; earlier use may give better recovery; dexamethasone was safe", "So: dexamethasone given for possible bacterial meningitis that turns out to be HSV encephalitis is not harmful - keep acyclovir going; finish or stop the 4-day course", "NEVER give steroids without acyclovir when HSV is possible", "Possible autoimmune encephalitis: steroids can be started early ALONGSIDE acyclovir instead of waiting for the HSV PCR (revised European guidance expected to support this)", "Immunocompromised, CMV/VZV: ask ID before steroids"] },
    { title: "When to stop acyclovir", items: ["HSV encephalitis confirmed: 14-21 days IV (21 if immunocompromised); consider repeat LP near the end to confirm PCR negative", "HSV PCR negative AND (LP done >72 h after symptom onset, or repeat PCR negative, or MRI/CSF normal, or another diagnosis made): stop", "Early negative PCR with ongoing suspicion: continue, repeat LP in 3-7 days"] }],
  source: ["Neurosurgery for mass effect, herniation (decompressive craniectomy) or abscess"],
  abx: [
    { tier: "severe", setting: "Suspected encephalitis (any cause)", regimen: "Acyclovir 10 mg/kg IV q8h (ideal body weight; IV fluids; adjust for CrCl)" },
    { tier: "severe", setting: "Meningoencephalitis / bacterial meningitis not excluded", regimen: "ADD dexamethasone 10 mg IV q6h (with first antibiotic) + ceftriaxone 2 g IV q12h + vancomycin IV" },
    { tier: "severe", setting: "Brainstem signs, age >50, immunocompromised (Listeria rhombencephalitis)", regimen: "ADD ampicillin 2 g IV q4h" },
    { tier: "severe", setting: "VZV encephalitis", regimen: "Acyclovir 10-15 mg/kg IV q8h x 10-14 days" },
    { tier: "severe", setting: "Immunocompromised: CMV or HHV-6", regimen: "Ganciclovir 5 mg/kg IV q12h (± foscarnet) - ID" }
  ],
  allergy: ["Acyclovir: no cross-reaction with antibiotics", "Bacterial component with severe beta-lactam allergy: vancomycin + moxifloxacin 400 mg IV daily; Listeria: TMP-SMX 5 mg/kg (TMP) IV q6-8h - ID"],
  duration: ["HSV encephalitis: 14-21 days IV acyclovir", "VZV: 10-14 days", "Stop acyclovir per the card above once HSV excluded"],
  ivpo: ["IV acyclovir throughout - oral valacyclovir is not a substitute for treatment"],
  idc: ["ALL cases; neurology too", "ICU if GCS falling, status epilepticus or raised ICP"],
  surgeon: ["Neurosurgery: mass effect, herniation, abscess"]
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
},
{
  id: "tb", label: "TB (tuberculosis)", match: /tuberculosis|\btb\b|mycobacter|\bafb\b|miliary|pott/i,
  sub: "Pulmonary and extrapulmonary TB, TB infection before immunosuppression",
  organisms: ["Mycobacterium tuberculosis complex (M. tuberculosis, M. bovis)", "Non-tuberculous mycobacteria (MAC, M. abscessus) can look similar on smear - NAAT/culture separates them", "Drug resistance (INH or MDR-TB): prior TB treatment, contact with drug-resistant TB, birth/residence in high-burden countries"],
  watch: [
    "THINK TB when: cough >2-3 weeks, hemoptysis, night sweats, fever, weight loss; upper-lobe or cavitary infiltrate, miliary pattern, hilar nodes; pneumonia not responding to usual antibiotics",
    "Risk factors: born or lived in a high-incidence country; lived in a community with high TB incidence (including some First Nations and Inuit communities in Canada); known contact; prior TB or untreated TB infection; HIV; transplant, anti-TNF/biologics, prednisone >=15 mg/day >=1 month; dialysis/ESRD; diabetes; silicosis; homelessness, incarceration, substance use",
    "Extrapulmonary clues: lymphocytic exudative pleural effusion (high ADA); lymphocytic meningitis with low glucose and high protein, cranial nerve palsies; vertebral osteomyelitis (Pott disease - thoracic, sparing disc space early); sterile pyuria; chronic monoarthritis; cervical lymphadenitis; pericardial effusion; ascites with lymphocytes",
    "Avoid fluoroquinolones (levofloxacin/moxifloxacin) for presumed CAP when TB is possible - they partially treat TB, delay diagnosis and select resistance",
    "Hospital transmission happens with UNRECOGNIZED TB - start airborne isolation on suspicion, before results",
    "TB-IRIS in HIV starting ART; drug-induced hepatitis on treatment (stop drugs if ALT >3x ULN with symptoms or >5x without)"
  ],
  ix: {
    blood: ["HIV test (all patients with TB)", "CBC, creatinine, ALT/AST, bilirubin (baseline before treatment), hepatitis B and C serology, HbA1c", "IGRA (QuantiFERON) or TST: supports TB infection but does NOT rule active TB in or out", "Blood mycobacterial culture if HIV with low CD4 / disseminated"],
    imaging: ["Chest X-ray (upper lobe, cavity, miliary, nodes, effusion)", "CT chest if X-ray unclear or immunocompromised", "Site-specific: MRI spine (Pott), MRI brain (tuberculomas, basal enhancement), CT abdomen, echo (pericardial)"],
    other: ["3 sputum specimens for AFB smear, mycobacterial culture and TB NAAT (GeneXpert MTB/RIF) - at least 1 hour apart, one early morning if possible", "Induced sputum or bronchoscopy (BAL) if not producing sputum", "Tissue/fluid: pleural biopsy (fluid culture low yield), lymph node biopsy, CSF for AFB culture + NAAT (large volume), urine AFB cultures x3 early morning for renal TB - send tissue for culture, not only pathology", "Rifampin resistance from NAAT; full drug susceptibility on culture"]
  },
  source: ["Usually medical treatment alone", "Spinal TB with cord compression or instability - spine surgery", "Large TB empyema - drainage; constrictive pericarditis - pericardiectomy", "Abscess (cold abscess, psoas) - drainage"],
  abx: [
    { tier: "moderate", setting: "Drug-susceptible pulmonary TB (start only with TB specialist / BCCDC TB Services; collect specimens first)", regimen: "Intensive phase 2 months: isoniazid 5 mg/kg (max 300 mg) + rifampin 10 mg/kg (max 600 mg) + pyrazinamide 25 mg/kg + ethambutol 15-20 mg/kg PO daily; then continuation 4 months isoniazid + rifampin. Pyridoxine 25 mg daily with isoniazid. Directly observed therapy" },
    { tier: "severe", setting: "TB meningitis", regimen: "Same 4 drugs (higher-dose rifampin often used) + dexamethasone (0.3-0.4 mg/kg/day tapered over 6-8 weeks); continuation phase to 12 months total - ID/TB specialist" },
    { tier: "severe", setting: "Critically ill / cannot take PO / severe liver disease", regimen: "TB specialist to choose IV or liver-sparing regimen (e.g. rifampin IV, ethambutol, fluoroquinolone, aminoglycoside)" },
    { tier: "mild", setting: "TB infection (latent), active TB excluded - e.g. before anti-TNF or transplant", regimen: "Rifampin 10 mg/kg (max 600 mg) daily x 4 months (preferred), or isoniazid + rifapentine weekly x 12 weeks (3HP), or isoniazid daily x 9 months" }
  ],
  allergy: ["Drug reactions (hepatitis, rash) are managed by stopping all drugs and reintroducing one at a time under the TB specialist", "Rifampin interactions are major: DOACs, warfarin, hormonal contraception, tacrolimus/cyclosporine, HIV ART, methadone, azoles, many others - pharmacy review"],
  duration: ["Drug-susceptible pulmonary TB: 6 months (2 + 4); extend to 9 months if cavitary disease AND culture still positive at 2 months", "TB meningitis/CNS: 12 months", "Bone and joint: 6-9 months (often 9-12 for spine)", "Pericardial, lymph node, pleural: 6 months", "TB infection: 4 months rifampin (4R), 12 weeks 3HP, or 9 months isoniazid"],
  ivpo: ["Oral daily therapy is standard; IV only if unable to absorb or critically ill (TB specialist)"],
  idc: ["ALL suspected or confirmed active TB - TB specialist (BCCDC TB Services / ID / respirology)", "Report suspected or confirmed TB to public health (Medical Health Officer) - contact tracing; TB drugs supplied free through BCCDC in BC", "Drug resistance, HIV co-infection, pregnancy, liver disease, drug reactions"],
  surgeon: ["Spine surgery for Pott disease with neurological deficit or instability", "Thoracic surgery for empyema/destroyed lung; cardiac surgery for constrictive pericarditis"],
  isolation: ["Airborne precautions (negative-pressure room, N95 for staff, patient wears surgical mask outside the room) as soon as pulmonary/laryngeal TB is suspected", "Stop isolation when TB is excluded: negative TB NAAT or 3 negative AFB smears (local policy and TB physician/IPAC order)", "Confirmed TB: per TB physician - usually after effective treatment for about 2 weeks, clinical improvement and drug susceptibility known (Canadian TB Standards 2022 discourage waiting for smear conversion in every case)"]
},
{
  id: "sepsis", label: "Sepsis, source unclear (blood)", match: /sepsis|septic shock|bacteremia|bacteraemia|febrile neutropenia|fever without source/i,
  sub: "Empiric therapy while the source is found",
  organisms: ["Community: E. coli and other Enterobacterales, S. aureus, Strep pneumoniae and other streptococci", "Healthcare-associated, recent antibiotics, lines: MRSA, Pseudomonas, ESBL producers, enterococcus, Candida", "Neutropenia: gram-negatives incl. Pseudomonas first; gram-positives with lines/mucositis"],
  watch: ["Blood cultures ×2 before antibiotics, but give antibiotics within 1 hour in septic shock", "Look again for the source: lines, skin (incl. back and perineum), urine, chest, abdomen, joints, spine pain (epidural abscess), new murmur (endocarditis), meningism", "If meningitis is possible, use meningitis doses (see Meningitis)", "S. aureus or Candida in blood: always ID consult; echo; remove lines"],
  ix: { blood: ["Blood cultures ×2 (one from each line), lactate, CBC, creatinine, LFTs, bilirubin, INR"], imaging: ["Chest X-ray; CT of chest/abdomen/pelvis if no source and not improving", "Echo for S. aureus, enterococcus, viridans strep bacteremia"], other: ["Urinalysis and culture, sputum, wound swabs; procalcitonin can support stopping"] },
  source: ["Remove infected lines/catheters", "Drain abscesses and obstructed systems (urine, bile)"],
  abx: [
    { tier: "moderate", setting: "Community-acquired sepsis, source unclear, not in shock", regimen: "Ceftriaxone 2 g IV q24h" },
    { tier: "moderate", setting: "Add if MRSA risk (prior MRSA, injection drug use, line, severe skin)", regimen: "Add vancomycin IV (load 25 mg/kg, then per pharmacy AUC dosing)" },
    { tier: "severe", setting: "Septic shock, community", regimen: "Piperacillin-tazobactam 4.5 g IV q6h + vancomycin IV" },
    { tier: "severe", setting: "Hospital-acquired / recent antibiotics / Pseudomonas risk", regimen: "Piperacillin-tazobactam 4.5 g IV q6h (or cefepime 2 g IV q8h, or meropenem 1 g IV q8h) + vancomycin IV" },
    { tier: "severe", setting: "Previous ESBL infection or colonization", regimen: "Meropenem 1 g IV q8h + vancomycin IV" },
    { tier: "severe", setting: "Febrile neutropenia (neutropenic, healthcare)", regimen: "Cefepime 2 g IV q8h or piperacillin-tazobactam 4.5 g IV q6h; add vancomycin for line infection, skin infection, pneumonia, hypotension or MRSA" }
  ],
  allergy: ["Non-severe penicillin allergy: cefepime or ceftriaxone are fine", "Severe (anaphylaxis): vancomycin + aztreonam 2 g IV q8h (or + ciprofloxacin 400 mg IV q12h / gentamicin 5–7 mg/kg once); add metronidazole 500 mg IV q12h if abdominal source possible; meropenem is usually acceptable with monitoring", "Severe delayed reaction (SJS/TEN, DRESS): vancomycin + aztreonam or ciprofloxacin – ID input"],
  duration: ["Set by the source once found; reassess at 48–72 h and stop if no bacterial infection", "Uncomplicated gram-negative bacteremia with source control and improving: 7 days", "S. aureus bacteremia: at least 14 days IV (uncomplicated) – ID"],
  ivpo: ["IV until stable and the source is known", "Gram-negative bacteremia: oral step-down (fluoroquinolone, TMP-SMX, or high-dose beta-lactam) once stable and susceptible"],
  idc: ["S. aureus or Candida in blood – always", "Neutropenic fever not settling, MDR organisms", "No source found after 48–72 h"],
  surgeon: ["Abscess, obstructed bile or urine, necrotizing infection, perforation – source control the same day"]
},
{
  id: "cdiff", label: "C. difficile colitis", match: /c\.? ?diff|clostridi(o)?ides difficile|clostridium difficile|cdad|cdi\b|pseudomembranous/i,
  sub: "Non-severe, severe, fulminant, first and later recurrences",
  organisms: ["Clostridioides difficile toxin-producing strains"],
  watch: ["Severe: WBC >=15 x10^9/L or creatinine >133 umol/L", "Fulminant: hypotension/shock, ileus, toxic megacolon - surgery consult the same day", "Test only unformed stool (>=3 in 24 h) without laxatives in the past 48 h; do not test for cure", "Ileus can mean little diarrhea despite severe disease", "Recurrence = symptoms return within 8 weeks of finishing treatment, with a positive test; about 1 in 4 recur after a first episode, more after each recurrence", "Before calling it a recurrence: rule out post-infectious IBS, laxatives, tube feeds, other infection, IBD flare"],
  ix: { blood: ["CBC, creatinine, lactate, albumin"], imaging: ["Abdominal X-ray or CT if distension, ileus, peritonism or fulminant"], other: ["Stool C. difficile PCR/GDH with toxin (only if unformed stool)"] },
  cards: [
    { title: "Recurrent C. difficile - options by episode (IDSA/SHEA 2021)", table: { head: ["Episode", "Preferred", "Alternatives", "Add / consider"], rows: [
      ["First episode", "Fidaxomicin 200 mg PO BID x10 days", "Vancomycin 125 mg PO QID x10 days", "Stop PPI and unneeded antibiotics"],
      ["1st recurrence", "Fidaxomicin 200 mg PO BID x10 days, or extended-pulsed (200 mg BID days 1-5, then 200 mg every other day days 7-25)", "Vancomycin taper and pulse; or vancomycin 125 mg QID x10 days if metronidazole was used the first time", "Bezlotoxumab is no longer available"],
      ["2nd or later recurrence", "Fidaxomicin (standard or extended-pulsed) or vancomycin taper and pulse", "Vancomycin 125 mg QID x10 days, then rifaximin 400 mg PO TID x20 days", "Fecal microbiota transplant (FMT) after the 2nd recurrence (i.e. 3rd episode) - refer GI/ID"],
      ["Multiple recurrences, not FMT candidate", "Long-term suppressive vancomycin 125 mg PO daily", "-", "ID/GI"],
      ["Prior C. difficile and now needs systemic antibiotics", "Shortest, narrowest course; avoid clindamycin, fluoroquinolones, 3rd-gen cephalosporins if possible", "Some give vancomycin 125 mg PO daily (or BID) during the antibiotic course and for ~5 days after (secondary prophylaxis - weaker evidence)", "Discuss with ID for multiple prior recurrences"]] },
      items: ["Vancomycin taper and pulse (example): 125 mg QID x10-14 days, then 125 mg BID x7 days, then 125 mg daily x7 days, then 125 mg every 2-3 days for 2-8 weeks", "A severe or fulminant recurrence is treated as severe/fulminant first (see those rows)", "FMT: colonoscopy, enema or capsules through an approved program; licensed microbiome products where available", "Metronidazole is not recommended for recurrences"] }],
  source: ["Stop other antibiotics if possible; stop PPIs and laxatives; contact precautions; soap-and-water hand hygiene (alcohol gel does not kill spores)", "Fulminant/megacolon: colectomy or loop ileostomy with colonic lavage"],
  abx: [
    { tier: "mild", setting: "Non-severe, first episode", regimen: "Fidaxomicin 200 mg PO BID x10 days (preferred) or vancomycin 125 mg PO QID x10 days" },
    { tier: "moderate", setting: "Severe (WBC >=15 or creatinine >133), first episode", regimen: "Fidaxomicin 200 mg PO BID x10 days or vancomycin 125 mg PO QID x10 days" },
    { tier: "moderate", setting: "First recurrence", regimen: "Fidaxomicin 200 mg PO BID x10 days or extended-pulsed (200 mg BID days 1-5, then every other day days 7-25); or vancomycin taper and pulse" },
    { tier: "moderate", setting: "Second or later recurrence", regimen: "Fidaxomicin (standard or extended-pulsed) or vancomycin taper and pulse; or vancomycin 125 mg QID x10 days then rifaximin 400 mg PO TID x20 days; refer for fecal microbiota transplant" },
    { tier: "mild", setting: "Multiple recurrences, not a FMT candidate", regimen: "Suppressive vancomycin 125 mg PO daily long term (ID/GI)" },
    { tier: "mild", setting: "Prior C. difficile, now on systemic antibiotics (secondary prophylaxis, weaker evidence)", regimen: "Vancomycin 125 mg PO daily or BID during the antibiotic course and ~5 days after" },
    { tier: "severe", setting: "Fulminant (shock, ileus, megacolon)", regimen: "Vancomycin 500 mg PO/NG QID + metronidazole 500 mg IV q8h; add rectal vancomycin 500 mg in 100 mL saline q6h if ileus" }
  ],
  allergy: ["No beta-lactam issue - oral vancomycin and fidaxomicin are not absorbed"],
  duration: ["10 days for a first episode or standard-course recurrence; extended-pulsed fidaxomicin 25 days; vancomycin taper/pulse 6-12 weeks", "If other antibiotics must continue, many continue C. difficile treatment until those stop", "Second or later recurrence: fecal microbiota transplant"],
  ivpo: ["Treatment is oral/enteral; IV metronidazole only as an add-on in fulminant disease (IV vancomycin does not reach the colon)"],
  idc: ["Fulminant disease, any recurrence (ID or GI), immunocompromise, FMT referral"],
  surgeon: ["Fulminant colitis, toxic megacolon, perforation, rising lactate - general surgery the same day"]
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
