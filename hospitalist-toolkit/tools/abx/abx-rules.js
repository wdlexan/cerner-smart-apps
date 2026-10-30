/* Antibiotic tab - EDITABLE RULES.
   Everything clinical lives here so it can be checked and changed without touching abx.js.

   ⚠ DRAFT. Durations, renal dose bands and oral options are common published defaults
   (IDSA/ATS, product monographs, short-course trials). They are NOT Island Health policy.
   Before any clinical use: have Island Health antimicrobial stewardship / pharmacy review
   and replace them with local guidance.

   drugs:       how a medication name is recognised, plus renal-dosing and IV→PO notes
                (first match wins, so combinations are listed before single drugs)
   indications: target durations for the "Duration" card
   ivpo:        cut-offs for the IV→PO readiness checklist
*/
(function (root) {
  'use strict';

  // renal: [{ below: CrCl mL/min, text }] - checked lowest band first. [] = no adjustment needed.
  // renal: null = dose by levels (shown as a reminder, not a CrCl band).
  const drugs = [
    // ---- penicillins ----
    { key: 'amoxclav', label: 'Amoxicillin-clavulanate', match: /amoxicillin.{0,3}clav|clavulan|clavulin|augmentin/i,
      betaLactam: true, anaerobe: true,
      renal: [{ below: 30, text: 'CrCl < 30: avoid 875 mg tabs; e.g. 500/125 mg q12h (q24h if < 10).' }] },
    { key: 'piptazo', label: 'Piperacillin-tazobactam', match: /piperacillin|tazobactam|tazocin|zosyn/i,
      betaLactam: true, anaerobe: true, broad: true,
      renal: [{ below: 20, text: 'CrCl < 20: e.g. 2.25 g q6–8h (pneumonia: 2.25 g q6h).' },
              { below: 40, text: 'CrCl 20–40: e.g. 2.25–3.375 g q6h (pneumonia: 3.375 g q6h).' }],
      oral: 'Amoxicillin-clavulanate if the organism is susceptible; otherwise per cultures / ID.' },
    { key: 'ampsulb', label: 'Ampicillin-sulbactam', match: /sulbactam|unasyn/i, betaLactam: true, anaerobe: true,
      renal: [{ below: 15, text: 'CrCl < 15: q24h.' }, { below: 30, text: 'CrCl 15–29: q12h.' }],
      oral: 'Amoxicillin-clavulanate.' },
    { key: 'ampicillin', label: 'Ampicillin', match: /\bampicillin\b/i, betaLactam: true,
      renal: [{ below: 10, text: 'CrCl < 10: q12–24h.' }, { below: 50, text: 'CrCl 10–50: q6–12h.' }],
      oral: 'Amoxicillin.' },
    { key: 'amoxicillin', label: 'Amoxicillin', match: /\bamoxicillin\b/i, betaLactam: true,
      renal: [{ below: 30, text: 'CrCl < 30: avoid 875 mg; e.g. 250–500 mg q12h.' }] },
    { key: 'cloxacillin', label: 'Cloxacillin', match: /cloxacillin|nafcillin|oxacillin/i, betaLactam: true, renal: [],
      oral: 'Cephalexin (MSSA), if not bacteremic.' },
    { key: 'penicillin', label: 'Penicillin', match: /penicillin/i, betaLactam: true,
      renal: [{ below: 10, text: 'CrCl < 10: reduce dose (e.g. 50% or longer interval).' }], oral: 'Penicillin V or amoxicillin.' },

    // ---- cephalosporins ----
    { key: 'cefazolin', label: 'Cefazolin', match: /cefazolin|ancef/i, betaLactam: true,
      renal: [{ below: 10, text: 'CrCl < 10: e.g. 1 g q24h.' }, { below: 35, text: 'CrCl 10–34: e.g. 1 g q12h.' }],
      oral: 'Cephalexin.' },
    { key: 'cephalexin', label: 'Cephalexin', match: /cephalexin|cefalexin|keflex/i, betaLactam: true,
      renal: [{ below: 30, text: 'CrCl < 30: lengthen interval (e.g. q8–12h).' }] },
    { key: 'cefuroxime', label: 'Cefuroxime', match: /cefuroxime/i, betaLactam: true,
      renal: [{ below: 30, text: 'CrCl < 30: lengthen interval (e.g. q24h oral / q12h IV).' }], oral: 'Cefuroxime axetil.' },
    { key: 'ceftriaxone', label: 'Ceftriaxone', match: /ceftriaxone|rocephin/i, betaLactam: true, renal: [],
      oral: 'Per cultures: e.g. amoxicillin-clavulanate, cefuroxime or cefixime (UTI/pneumonia), or a fluoroquinolone if susceptible.' },
    { key: 'cefotaxime', label: 'Cefotaxime', match: /cefotaxime/i, betaLactam: true,
      renal: [{ below: 20, text: 'CrCl < 20: halve the dose.' }], oral: 'Per cultures.' },
    { key: 'ceftazidime', label: 'Ceftazidime', match: /ceftazidime|fortaz/i, betaLactam: true, broad: true,
      renal: [{ below: 16, text: 'CrCl < 16: e.g. 0.5–1 g q24–48h.' }, { below: 31, text: 'CrCl 16–30: e.g. 1 g q24h.' }, { below: 51, text: 'CrCl 31–50: e.g. 1 g q12h.' }],
      oral: 'Ciprofloxacin if susceptible.' },
    { key: 'cefepime', label: 'Cefepime', match: /cefepime/i, betaLactam: true, broad: true,
      renal: [{ below: 11, text: 'CrCl ≤ 10: e.g. 250–1000 mg q24h. Watch for neurotoxicity.' }, { below: 30, text: 'CrCl 11–29: q24h. Watch for confusion / myoclonus.' }, { below: 60, text: 'CrCl 30–60: q12h.' }],
      oral: 'Ciprofloxacin if susceptible.' },
    { key: 'cefixime', label: 'Cefixime', match: /cefixime/i, betaLactam: true,
      renal: [{ below: 20, text: 'CrCl < 20: 200 mg daily.' }] },

    // ---- carbapenems ----
    { key: 'meropenem', label: 'Meropenem', match: /meropenem/i, betaLactam: true, anaerobe: true, broad: true,
      renal: [{ below: 10, text: 'CrCl < 10: e.g. 500 mg q24h.' }, { below: 26, text: 'CrCl 10–25: e.g. 500 mg q12h.' }, { below: 51, text: 'CrCl 26–50: e.g. 1 g q12h.' }],
      oral: 'Per cultures / ID.' },
    { key: 'ertapenem', label: 'Ertapenem', match: /ertapenem|invanz/i, betaLactam: true, anaerobe: true, broad: true,
      renal: [{ below: 31, text: 'CrCl ≤ 30: 500 mg daily.' }], oral: 'Per cultures / ID.' },
    { key: 'imipenem', label: 'Imipenem', match: /imipenem/i, betaLactam: true, anaerobe: true, broad: true,
      renal: [{ below: 90, text: 'CrCl < 90: reduce dose (seizure risk) - check monograph.' }], oral: 'Per cultures / ID.' },

    // ---- gram-positive ----
    { key: 'vancomycin', label: 'Vancomycin', match: /vancomycin/i, mrsa: true, renal: null,
      levels: 'Dose by AUC / trough. Check last level, next level due, and creatinine trend (AKI).',
      oral: 'Per susceptibilities / ID: e.g. linezolid, doxycycline or TMP-SMX.' },
    { key: 'daptomycin', label: 'Daptomycin', match: /daptomycin/i, mrsa: true,
      renal: [{ below: 30, text: 'CrCl < 30: q48h.' }], oral: 'Per ID.' },
    { key: 'linezolid', label: 'Linezolid', match: /linezolid|zyvox/i, mrsa: true, renal: [], sameOral: true,
      warn: 'Serotonin syndrome with SSRIs/SNRIs; check platelets if > 14 days.' },

    // ---- aminoglycosides ----
    { key: 'gentamicin', label: 'Gentamicin', match: /gentamicin/i, renal: null,
      levels: 'Dose by levels / extended-interval nomogram. Avoid if AKI.' },
    { key: 'tobramycin', label: 'Tobramycin', match: /tobramycin/i, renal: null, levels: 'Dose by levels. Avoid if AKI.' },
    { key: 'amikacin', label: 'Amikacin', match: /amikacin/i, renal: null, levels: 'Dose by levels. Avoid if AKI.' },

    // ---- fluoroquinolones ----
    { key: 'ciprofloxacin', label: 'Ciprofloxacin', match: /ciprofloxacin|cipro\b/i, sameOral: true,
      renal: [{ below: 30, text: 'CrCl < 30: lengthen interval (e.g. q18–24h).' }], warn: 'QT, tendinopathy, C. difficile.' },
    { key: 'levofloxacin', label: 'Levofloxacin', match: /levofloxacin/i, sameOral: true,
      renal: [{ below: 20, text: 'CrCl < 20: e.g. 750 mg then 500 mg q48h.' }, { below: 50, text: 'CrCl 20–49: e.g. 750 mg q48h.' }], warn: 'QT, tendinopathy.' },
    { key: 'moxifloxacin', label: 'Moxifloxacin', match: /moxifloxacin/i, anaerobe: true, sameOral: true, renal: [], warn: 'QT.' },

    // ---- others ----
    { key: 'azithromycin', label: 'Azithromycin', match: /azithromycin|zithromax/i, sameOral: true, renal: [], warn: 'QT.' },
    { key: 'clarithromycin', label: 'Clarithromycin', match: /clarithromycin/i, sameOral: true,
      renal: [{ below: 30, text: 'CrCl < 30: halve the dose.' }], warn: 'QT; many interactions (CYP3A4).' },
    { key: 'erythromycin', label: 'Erythromycin', match: /erythromycin/i, renal: [], warn: 'QT.' },
    { key: 'doxycycline', label: 'Doxycycline', match: /doxycycline/i, sameOral: true, renal: [] },
    { key: 'tmpsmx', label: 'TMP-SMX', match: /sulfamethoxazole|trimethoprim|septra|bactrim|co-?trimoxazole/i, sameOral: true,
      renal: [{ below: 15, text: 'CrCl < 15: generally avoid.' }, { below: 30, text: 'CrCl 15–30: halve the dose.' }],
      warn: 'Hyperkalemia, raises creatinine, interacts with warfarin.' },
    { key: 'nitrofurantoin', label: 'Nitrofurantoin', match: /nitrofurantoin|macrobid/i,
      renal: [{ below: 30, text: 'CrCl < 30: avoid (ineffective, toxicity - Beers).' }] },
    { key: 'fosfomycin', label: 'Fosfomycin', match: /fosfomycin/i, renal: [] },
    { key: 'metronidazole', label: 'Metronidazole', match: /metronidazole|flagyl/i, anaerobe: true, sameOral: true, renal: [] },
    { key: 'clindamycin', label: 'Clindamycin', match: /clindamycin/i, anaerobe: true, sameOral: true, renal: [], warn: 'High C. difficile risk.' },
    { key: 'rifampin', label: 'Rifampin', match: /rifampin|rifampicin/i, renal: [], warn: 'Major interactions (DOACs, warfarin, many others).' },

    // ---- antifungal / antiviral ----
    { key: 'fluconazole', label: 'Fluconazole', match: /fluconazole/i, antifungal: true, sameOral: true,
      renal: [{ below: 51, text: 'CrCl ≤ 50: halve the dose after the loading dose.' }], warn: 'QT; CYP interactions.' },
    { key: 'echinocandin', label: 'Echinocandin', match: /micafungin|caspofungin|anidulafungin/i, antifungal: true, renal: [] },
    { key: 'acyclovir', label: 'Acyclovir', match: /acyclovir|aciclovir/i, antiviral: true,
      renal: [{ below: 10, text: 'CrCl < 10: 50% dose q24h.' }, { below: 25, text: 'CrCl 10–25: q24h.' }, { below: 51, text: 'CrCl 25–50: q12h.' }],
      oral: 'Valacyclovir if appropriate.', warn: 'Keep hydrated (crystal nephropathy).' },
    { key: 'valacyclovir', label: 'Valacyclovir', match: /valacyclovir/i, antiviral: true,
      renal: [{ below: 50, text: 'CrCl < 50: reduce (check indication table).' }] }
  ];

  // days: target total days of active therapy. null = no fixed target.
  // mustIV: oral step-down is usually NOT appropriate (the IV→PO card will say so).
  const indications = [
    { key: '', label: '— choose indication —', days: null },
    { key: 'cap', label: 'Community-acquired pneumonia', days: 5, note: '≥ 5 days; stop once afebrile 48 h and clinically stable.', ref: 'IDSA/ATS 2019' },
    { key: 'hap', label: 'Hospital-acquired / ventilator pneumonia', days: 7, note: '7 days for most.', ref: 'IDSA/ATS 2016' },
    { key: 'aecopd', label: 'COPD exacerbation', days: 5, note: '5 days.', ref: 'GOLD' },
    { key: 'cystitis', label: 'Cystitis (uncomplicated)', days: 5, note: 'Nitrofurantoin 5 d · TMP-SMX 3 d · fosfomycin 1 dose.', ref: 'IDSA 2010' },
    { key: 'pyelo', label: 'Pyelonephritis / complicated UTI', days: 7, note: '7 days (fluoroquinolone 5–7 d).', ref: 'IDSA; Yahav 2019' },
    { key: 'cauti', label: 'Catheter-associated UTI', days: 7, note: '7 days if prompt response (remove / change catheter).', ref: 'IDSA 2009' },
    { key: 'cellulitis', label: 'Cellulitis (non-purulent)', days: 5, note: '5–6 days if improving.', ref: 'IDSA 2014' },
    { key: 'iai', label: 'Intra-abdominal infection, source controlled', days: 4, note: '4 days after source control.', ref: 'STOP-IT 2015' },
    { key: 'gnb', label: 'Gram-negative bacteremia (uncomplicated)', days: 7, note: '7 days if source controlled and improving.', ref: 'Yahav 2019; BALANCE 2024' },
    { key: 'sbp', label: 'Spontaneous bacterial peritonitis', days: 5, note: '5–7 days.', ref: 'AASLD' },
    { key: 'cdiff', label: 'C. difficile', days: 10, note: '10 days (vancomycin PO or fidaxomicin).', ref: 'IDSA/SHEA 2021' },
    { key: 'sab', label: 'S. aureus bacteremia', days: 14, mustIV: true, note: '≥ 14 days from first negative culture if uncomplicated; 4–6 weeks if complicated. ID consult.', ref: 'IDSA 2011' },
    { key: 'ie', label: 'Infective endocarditis', days: 28, mustIV: true, note: '4–6 weeks. IV unless POET oral step-down criteria are met (see the Endocarditis tool).', ref: 'AHA; POET' },
    { key: 'osteo', label: 'Osteomyelitis', days: 42, note: '6 weeks; oral step-down is acceptable (OVIVA).', ref: 'OVIVA 2019' },
    { key: 'meningitis', label: 'Meningitis / CNS infection', days: null, mustIV: true, note: 'Duration depends on organism.', ref: 'IDSA' },
    { key: 'fn', label: 'Febrile neutropenia', days: null, mustIV: true, note: 'Continue until afebrile and neutrophil recovery (per oncology).', ref: 'IDSA 2010' },
    { key: 'other', label: 'Other / unsure', days: null, note: 'Set a stop or review date in the order.' }
  ];

  // Suggest an indication from problem-list text (only a suggestion - the user confirms it).
  const suggest = [
    { re: /endocarditis/i, key: 'ie' },
    { re: /staph.*aureus.*bacter|s\.? ?aureus bacter|mrsa bacter|mssa bacter/i, key: 'sab' },
    { re: /mening|encephalitis|brain abscess/i, key: 'meningitis' },
    { re: /neutropeni/i, key: 'fn' },
    { re: /osteomyel/i, key: 'osteo' },
    { re: /c\.? ?diff|clostrid/i, key: 'cdiff' },
    { re: /hospital.acquired pneum|ventilator.associated|\bhap\b|\bvap\b/i, key: 'hap' },
    { re: /pneumonia/i, key: 'cap' },
    { re: /copd|chronic obstructive/i, key: 'aecopd' },
    { re: /pyelo|urosepsis|complicated uti/i, key: 'pyelo' },
    { re: /cystitis|urinary tract infection|\buti\b/i, key: 'cystitis' },
    { re: /cellulitis/i, key: 'cellulitis' },
    { re: /peritonitis.*spontan|\bsbp\b|spontaneous bacterial/i, key: 'sbp' },
    { re: /bacteremia|bacteraemia/i, key: 'gnb' },
    { re: /appendic|cholecyst|cholangit|diverticul|intra.?abdominal/i, key: 'iai' }
  ];

  const ivpo = {
    hours: 24,          // look-back for vitals
    tempMax: 38.0,      // °C - afebrile means every temp below this
    hrMax: 100,         // last heart rate below this
    sbpMin: 90,         // every systolic BP at or above this
    wbcMax: 12          // ×10⁹/L - normal-ish or falling counts as improving
  };

  const flags = {
    vancoReviewHours: 72,   // vancomycin running this long: "MRSA found? Consider stopping."
    broadReviewHours: 72    // broad-spectrum β-lactam this long: "cultures back? De-escalate?"
  };

  // ---------------- "Echo needed?" card ----------------
  // Items that can be ticked. chart: regex run against the problem list to pre-tick it.
  const echoItems = {
    emboli:      { text: 'Cerebral or peripheral emboli' },
    meningitis:  { text: 'Meningitis' },
    device:      { text: 'Prosthetic valve, pacemaker/ICD, or previous endocarditis',
                   chart: /prosthetic.{0,12}valve|valve replacement|\btavi\b|\btavr\b|\bavr\b|\bmvr\b|pacemaker|\bicd\b|defibrillator|\bcrt-?[dp]?\b|cardiac device|endocarditis/i },
    ivdu:        { text: 'Injection drug use', chart: /inject\w* drug|intravenous drug|\bivdu\b|\bpwid\b/i },
    valve:       { text: 'Native valve disease (stenosis / regurgitation / bicuspid / rheumatic)',
                   chart: /stenosis|regurgitation|insufficiency|valve prolapse|bicuspid|rheumatic heart|valvular/i },
    murmur:      { text: 'Heart murmur on exam' },
    persistent:  { text: 'Persistent bacteremia ≥ 48 h despite therapy' },
    vertebral:   { text: 'Vertebral osteomyelitis / discitis', chart: /vertebral osteo|discitis|spondylodiscitis/i },
    community:   { text: 'Community-acquired (or healthcare-associated, not hospital-acquired)', defaultOn: true },
    shock:       { text: 'Severe sepsis or septic shock' },
    crp:         { text: 'CRP > 190 mg/L' },             // pre-ticked from labs
    symptoms7:   { text: 'Symptoms for ≥ 7 days before cultures' },
    cultures2:   { text: '≥ 2 positive blood culture sets' },
    unknownSrc:  { text: 'Source unknown' },
    mono:        { text: 'Only one species in blood cultures', defaultOn: true },
    dialysis:    { text: 'On hemodialysis', chart: /dialysis|end.?stage renal|\besrd\b/i }
  };

  // Scores. Points as published - VERIFY against the original papers with ID before use.
  const echoScores = {
    // Tubiana et al., J Infect 2016. ≤ 2 = low risk (TEE can usually be skipped).
    virsta: { name: 'VIRSTA', lowMax: 2, items: [['emboli', 5], ['meningitis', 5], ['device', 4], ['ivdu', 4], ['valve', 3],
      ['persistent', 3], ['vertebral', 2], ['community', 2], ['shock', 1], ['crp', 1]] },
    // Berge et al., Eur Heart J 2019 (E. faecalis). ≥ 3 = TEE.
    denova: { name: 'DENOVA', lowMax: 2, items: [['symptoms7', 1], ['emboli', 1], ['cultures2', 1], ['unknownSrc', 1], ['valve', 1], ['murmur', 1]] },
    // Sunnerhagen et al., Clin Infect Dis 2018 (non-β-hemolytic streptococci). ≥ 3 = echo.
    // The species point (A) comes from the organism choice below (aetiologyPts).
    handoc: { name: 'HANDOC', lowMax: 2, items: [['murmur', 1], ['valve', 1], ['cultures2', 1], ['symptoms7', 1], ['mono', 1], ['community', 1]], heartIsOne: true }
  };

  // Organisms. score: which score applies. aetiologyPts: HANDOC "A" point for that group
  // (S. anginosus is −1 in the original table - CHECK).
  const echoOrganisms = [
    { key: '', label: '— choose organism —' },
    { key: 'sa', label: 'Staphylococcus aureus (MSSA / MRSA)', score: 'virsta', alwaysTTE: true,
      remind: ['Repeat blood cultures every 24–48 h until negative.', 'ID consult (lowers mortality in SAB).', 'Remove / replace infected lines; look for metastatic foci (spine, joints, abscess).'] },
    { key: 'slug', label: 'Staphylococcus lugdunensis', score: 'virsta', alwaysTTE: true, remind: ['Treat like S. aureus.', 'Repeat blood cultures until negative.'] },
    { key: 'efaecalis', label: 'Enterococcus faecalis', score: 'denova', remind: ['Repeat blood cultures until negative.', 'If E. faecalis and no clear source, consider colonoscopy.'] },
    { key: 'efaecium', label: 'Enterococcus faecium', rule: 'risk', remind: ['Lower endocarditis risk than E. faecalis; echo if persistent, device or valve disease.'] },
    { key: 'smutans', label: 'Viridans strep: S. mutans group', score: 'handoc', aetiologyPts: 1 },
    { key: 'sbovis', label: 'S. bovis / gallolyticus group', score: 'handoc', aetiologyPts: 1, remind: ['Colonoscopy (association with colorectal neoplasia).'] },
    { key: 'ssanguinis', label: 'Viridans strep: S. sanguinis group', score: 'handoc', aetiologyPts: 1 },
    { key: 'sanginosus', label: 'S. anginosus group (milleri)', score: 'handoc', aetiologyPts: -1, remind: ['Look for an abscess (this group causes abscesses more than endocarditis).'] },
    { key: 'smitis', label: 'Viridans strep: mitis / oralis / salivarius / other', score: 'handoc', aetiologyPts: 0 },
    { key: 'bhs', label: 'β-hemolytic strep (group A, B, C, G)', rule: 'risk', remind: ['Group B / G in older patients: lower threshold for echo.'] },
    { key: 'hacek', label: 'HACEK organism', rule: 'always', remind: ['HACEK bacteremia without another source is endocarditis until proven otherwise.'] },
    { key: 'gnb', label: 'Gram-negative bacilli (E. coli, Klebsiella, Pseudomonas…)', rule: 'risk', remind: ['Endocarditis is uncommon; echo only with risk features below.'] },
    { key: 'cons', label: 'Coagulase-negative staph (not lugdunensis)', rule: 'cons', remind: ['Single positive set is usually a contaminant.'] },
    { key: 'candida', label: 'Candida', rule: 'candida', remind: ['Dilated eye exam (ophthalmology).', 'Remove central lines.', 'Repeat blood cultures daily until negative.'] },
    { key: 'other', label: 'Other / not listed', rule: 'risk' }
  ];

  const echoTextRe = /echocardiog|\becho\b|transthoracic|trans-?o?esophageal|\btte\b|\btee\b/i;

  const R = { drugs, indications, suggest, ivpo, flags, echoItems, echoScores, echoOrganisms, echoTextRe };
  if (typeof module !== 'undefined' && module.exports) module.exports = R; else root.ABX_RULES = R;
})(typeof window !== 'undefined' ? window : globalThis);
