/* Diagnosis packs for the Watch-ahead app. EDIT THIS FILE to change or add a diagnosis; the page needs no other change.
   Each pack: match (regex on problem-list text), mayHappen, watch, ifthen (if -> then), course (qualitative, no numbers invented),
   length (treatment duration / time points) and source. No drug doses are given. Everything is UNVERIFIED until checked against the named source.
   Prognosis here is a qualitative course, not a statistic: for numbers use the published score for the condition (e.g. CURB-65 or PSI for pneumonia). */
window.WA_DX_META = { version: "0.1 draft", updated: "2026-10-26", note: "Prototype. Content is NOT yet reviewed against sources." };
window.WA_DX = [
  {
    id: "cap", title: "Community-acquired pneumonia", match: /pneumonia|\bcap\b|lung infection|chest infection/i,
    mayHappen: ["Slow response: cough and fatigue often last well after the fever settles", "Respiratory failure or sepsis", "Pleural effusion or empyema", "Delirium, especially in older adults", "Heart failure or COPD flaring", "Kidney injury from dehydration or drugs", "C. difficile after antibiotics"],
    watch: ["Oxygen need, respiratory rate, heart rate and temperature each shift", "Blood pressure and mental state", "Oral intake and urine output", "Creatinine, potassium and glucose (if on steroids)"],
    ifthen: [
      ["Oxygen need rising or breathing rate climbing", "Reassess now; consider ICU or critical care outreach review and check lactate and a gas per your pathway"],
      ["No improvement by 48 to 72 hours", "Reassess the diagnosis and look for complications: repeat chest imaging, check for effusion or empyema, review cultures and PCR, consider pulmonary embolism or heart failure; discuss antibiotic change with ID or stewardship"],
      ["Pleural effusion on imaging", "Ultrasound and sampling if sizeable; involve respirology or thoracic surgery if complicated"],
      ["Blood pressure falling or lactate rising", "Treat as possible sepsis per your sepsis pathway"],
      ["Diarrhea after antibiotics", "Test for C. difficile and review whether the antibiotic is still needed"],
      ["New confusion", "Look for hypoxia, spreading infection, drugs, retention and constipation; avoid adding sedatives"]
    ],
    course: "Most patients start to improve within 2 to 3 days of appropriate treatment. Cough and tiredness can last weeks. Older, frail or multi-morbid patients recover more slowly and are at higher risk of readmission and loss of function.",
    length: [
      ["Antibiotics", "Guided by clinical stability rather than a fixed number; ATS/IDSA 2019 suggests a minimum of 5 days and stopping once the patient is clinically stable (check the exact stability criteria in the guideline)."],
      ["Switch to oral", "When stable and able to take oral medicines and absorb them."],
      ["Risk numbers", "This app does not estimate mortality. Use CURB-65 or PSI and their published tables."]
    ],
    source: { text: "ATS/IDSA community-acquired pneumonia guideline, 2019 (Metlay et al.). Summary written by Claude, not checked against the guideline.", status: "unverified" }
  },
  {
    id: "hf", title: "Heart failure exacerbation", match: /heart failure|\bchf\b|\bhfref\b|\bhfpef\b|cardiomyopathy/i,
    mayHappen: ["Congestion not clearing, or clearing too slowly", "Low blood pressure or kidney injury during diuresis", "Potassium, magnesium or sodium abnormalities", "Atrial fibrillation or other arrhythmia", "Delirium, falls", "Readmission in the weeks after discharge"],
    watch: ["Daily weight and intake and output", "Oxygen need, breathing, swelling, JVP", "Potassium, magnesium, sodium and creatinine daily during diuresis", "Blood pressure and heart rate, including standing if safe"],
    ifthen: [
      ["Weight and swelling not improving on the diuretic plan", "Check salt and fluid intake, adherence and absorption; escalate diuretic per your protocol or discuss with cardiology; look for another driver (ischemia, atrial fibrillation, infection, anemia, valve disease, thyroid)"],
      ["Creatinine rises while still congested", "Congestion itself may be the cause; discuss before stopping the diuretic"],
      ["Creatinine rises and the patient looks dry", "Reduce diuresis; review ACE inhibitor/ARB/ARNI, spironolactone-type drugs, SGLT2 inhibitor and NSAIDs"],
      ["Potassium low or high", "Replace or treat per protocol; recheck; review the drugs that move potassium"],
      ["Blood pressure low with cool hands and poor urine output", "Think low-output state; call cardiology or ICU early"],
      ["New fast irregular rhythm or chest pain", "ECG, troponin per your pathway, and senior or cardiology input"],
      ["Before discharge", "Stable on oral diuretic, dry weight recorded, heart failure drugs reviewed, follow-up booked"]
    ],
    course: "Symptoms usually improve over days once the fluid is off. The weeks after discharge carry a high risk of readmission. The longer-term outlook depends on ejection fraction, kidney function, other illnesses and whether guideline therapy is in place.",
    length: [
      ["Diuresis", "Until the patient is euvolemic, then watch on the oral diuretic before discharge (many protocols look for stability for roughly a day)."],
      ["Follow-up", "Early review after discharge, commonly within about 7 days (check the current guideline)."],
      ["Medicines", "Use your heart failure therapy checklist for the long-term plan."]
    ],
    source: { text: "ACC/AHA/HFSA heart failure guideline 2022; CCS/CHFS Canadian heart failure guidelines. Summary written by Claude, not checked against either.", status: "unverified" }
  },
  {
    id: "copd", title: "COPD exacerbation", match: /\bcopd\b|chronic obstructive|emphysema|chronic bronchitis/i,
    mayHappen: ["Rising CO2 and drowsiness, including from too much oxygen", "Relapse after discharge", "High blood sugar and delirium from steroids", "Pneumonia, heart failure or pulmonary embolism behind the symptoms", "Falls and deconditioning"],
    watch: ["Oxygen saturation against the target range for this patient", "Respiratory rate and work of breathing", "Drowsiness or headache (possible CO2 retention)", "Glucose while on steroids", "Sputum change and fever"],
    ifthen: [
      ["Drowsy or breathing rate rising", "Check a gas, bring oxygen back to the target range, consider non-invasive ventilation and ICU review"],
      ["No improvement by 48 to 72 hours", "Reconsider pneumonia, heart failure, pulmonary embolism, pneumothorax; repeat chest imaging"],
      ["Glucose high on steroids", "Monitor and treat per your protocol"],
      ["Before discharge", "Inhaler technique checked, maintenance inhalers reviewed, follow-up and pulmonary rehab considered"]
    ],
    course: "Most exacerbations improve over several days; full return to baseline can take weeks. Each severe exacerbation raises the risk of another and of readmission.",
    length: [
      ["Systemic steroids", "Commonly about 5 days (GOLD); longer courses are not routine."],
      ["Antibiotics", "About 5 to 7 days when indicated by the usual criteria (more sputum purulence together with more breathlessness or sputum volume, or ventilatory support)."]
    ],
    source: { text: "GOLD report (current edition) and Canadian Thoracic Society COPD guidance. Summary written by Claude, not checked.", status: "unverified" }
  },
  {
    id: "aki", title: "Acute kidney injury", match: /acute kidney|acute renal|\baki\b/i,
    mayHappen: ["Further fall in kidney function", "High potassium, acid build-up, fluid overload", "Drug accumulation", "Longer-term loss of kidney function"],
    watch: ["Urine output and bladder scan if low", "Creatinine and potassium daily until clearly improving", "Volume status and blood pressure", "Every kidney-relevant or renally dosed drug"],
    ifthen: [
      ["Potassium very high or ECG changes", "Treat urgently per your hyperkalemia protocol and call nephrology"],
      ["Overload, acid build-up or uremic signs not responding", "Urgent nephrology discussion about dialysis"],
      ["Little or no urine", "Bladder scan; imaging for obstruction"],
      ["Creatinine not improving by 48 to 72 hours", "Urinalysis and sediment, kidney ultrasound, nephrology input"]
    ],
    course: "Kidney injury from low blood volume often improves within days once the cause is fixed. Injury to the tubules can take weeks. Some patients are left with lasting kidney damage.",
    length: [
      ["In hospital", "Creatinine is followed daily until clearly improving."],
      ["After discharge", "KDIGO suggests reviewing about 3 months later for recovery, new or worse chronic kidney disease."]
    ],
    source: { text: "KDIGO clinical practice guideline for acute kidney injury, 2012. Summary written by Claude, not checked.", status: "unverified" }
  },
  {
    id: "cellulitis", title: "Cellulitis", match: /cellulitis|erysipelas|skin infection|soft tissue infection|abscess/i,
    mayHappen: ["Spreading redness or abscess", "Necrotizing infection (rare but urgent)", "Bacteremia", "Recurrence"],
    watch: ["Mark the edge of the redness with the time and re-check", "Temperature and heart rate", "Pain out of proportion, blisters, skin color change, crepitus", "Glucose if diabetic"],
    ifthen: [
      ["Pain out of proportion, rapid spread, skin necrosis or toxic appearance", "Urgent surgical review for necrotizing infection"],
      ["Fluctuant area", "Incision and drainage"],
      ["No improvement by 48 to 72 hours", "Reconsider the diagnosis (for example clot, stasis dermatitis, gout), image for an abscess, review antibiotic cover with ID or stewardship"],
      ["Before discharge", "Treat the cause where possible (swelling, athlete's foot, wounds) to reduce recurrence"]
    ],
    course: "Most patients improve within 48 to 72 hours of antibiotics; redness and swelling can linger for weeks. Recurrence is common when swelling or skin breaks persist.",
    length: [["Antibiotics", "Often about 5 days if improving by day 5, extended only if not (IDSA 2014; check the guideline)."]],
    source: { text: "IDSA skin and soft tissue infection guideline, 2014 (Stevens et al.). Summary written by Claude, not checked.", status: "unverified" }
  },
  {
    id: "pyelo", title: "Pyelonephritis / complicated urinary infection", match: /pyelonephritis|urinary tract infection|\buti\b|urosepsis/i,
    mayHappen: ["Sepsis", "Obstruction or abscess behind a slow response", "Kidney injury", "Recurrence"],
    watch: ["Temperature, heart rate and blood pressure", "Flank pain and urine output", "Creatinine", "Urine and blood culture results and the antibiotic's coverage"],
    ifthen: [
      ["Still febrile or unwell at about 72 hours", "Imaging (ultrasound or CT) for obstruction or abscess; recheck culture sensitivities"],
      ["Obstructed infected system", "Emergency urology review for decompression"],
      ["Blood pressure falling", "Follow your sepsis pathway"],
      ["Positive blood cultures", "Involve ID; duration and imaging may change"]
    ],
    course: "Most patients improve within 48 to 72 hours; fever can take up to 72 hours to settle. Structural problems, diabetes and catheters raise the risk of slow response and recurrence.",
    length: [["Antibiotics", "Roughly 7 days with some agents and 10 to 14 days with some others; shorter courses have been studied. Choose by culture and agent. Switch to oral when afebrile and improving (IDSA 2010; check current guidance and your antibiogram)."]],
    source: { text: "IDSA acute uncomplicated cystitis and pyelonephritis guideline, 2010, and later trials. Summary written by Claude, not checked.", status: "unverified" }
  }
];
