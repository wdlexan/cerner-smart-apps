/* Extra sites for the antibiotic chooser, same shape as INF_SITES in ../infections/infections-data.js.
   UNVERIFIED draft written by Claude (Surviving Sepsis 2021, IDSA febrile neutropenia, IDSA/SHEA C. difficile 2021). Adult doses, normal renal function. */
window.ABXMAP_EXTRA_SITES = [
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
  sub: "Non-severe, severe, fulminant, recurrent",
  organisms: ["Clostridioides difficile toxin-producing strains"],
  watch: ["Severe: WBC ≥15 ×10^9/L or creatinine >133 µmol/L", "Fulminant: hypotension/shock, ileus, toxic megacolon – surgery consult the same day", "Test only unformed stool (≥3 in 24 h) without laxatives in the past 48 h; do not test for cure", "Ileus can mean little diarrhea despite severe disease"],
  ix: { blood: ["CBC, creatinine, lactate, albumin"], imaging: ["Abdominal X-ray or CT if distension, ileus, peritonism or fulminant"], other: ["Stool C. difficile PCR/GDH with toxin"] },
  source: ["Stop other antibiotics if possible; stop PPIs and laxatives; contact precautions", "Fulminant/megacolon: colectomy or loop ileostomy with colonic lavage"],
  abx: [
    { tier: "mild", setting: "Non-severe, first episode", regimen: "Fidaxomicin 200 mg PO BID ×10 days (preferred) or vancomycin 125 mg PO QID ×10 days" },
    { tier: "moderate", setting: "Severe (WBC ≥15 or creatinine >133), first episode", regimen: "Fidaxomicin 200 mg PO BID ×10 days or vancomycin 125 mg PO QID ×10 days" },
    { tier: "moderate", setting: "First recurrence", regimen: "Fidaxomicin 200 mg PO BID ×10 days (or extended-pulsed); or vancomycin taper/pulse" },
    { tier: "severe", setting: "Fulminant (shock, ileus, megacolon)", regimen: "Vancomycin 500 mg PO/NG QID + metronidazole 500 mg IV q8h; add rectal vancomycin 500 mg in 100 mL saline q6h if ileus" }
  ],
  allergy: ["No beta-lactam issue – oral vancomycin and fidaxomicin are not absorbed"],
  duration: ["10 days; extend only if other antibiotics must continue (many continue until those stop)", "Second or later recurrence: fecal microbiota transplant"],
  ivpo: ["Treatment is oral/enteral; IV metronidazole only as an add-on in fulminant disease (IV vancomycin does not reach the colon)"],
  idc: ["Fulminant disease, second recurrence, immunocompromise"],
  surgeon: ["Fulminant colitis, toxic megacolon, perforation, rising lactate – general surgery the same day"]
}];
