/* Pain Management – MADE-UP test patients (not real people). index.html?demo=1 … ?demo=7.
 * labs: [name, loinc, value, unit]. Also used by make-test-pdfs.js. */
(function (root) {
  const L = (egfr, cr, extra = []) => [["eGFR", "33914-3", egfr, "mL/min/1.73m2"], ["Creatinine", "2160-0", cr, "umol/L"], ...extra];
  const DEMOS = [
    { key: "Hip fracture, CKD, dementia", expect: "Morphine with eGFR 34 → switch to reduced-dose hydromorphone; no scheduled acetaminophen; no bowel regimen or naloxone; no nerve block; NSAID avoid (CKD + diuretic + ACEi).",
      name: "DEMO, Agnes", given: "Agnes", family: "DEMO", sex: "female", birthDate: "1941-09-02", mrn: "TESTPAIN01",
      conds: ["Hip fracture, left femoral neck", "Dementia", "Chronic kidney disease stage 3b", "Hypertension"],
      labs: L(34, 128, [["Sodium", "2951-2", 134, "mmol/L"], ["Platelets", "777-3", 210, "10*9/L"], ["ALT", "1742-6", 14, "U/L"]]), hr: 88, wt: 52, rr: 16, spo2: 95,
      meds: ["Morphine 2.5 mg SC q2h PRN pain", "Ramipril 5 mg PO daily", "Furosemide 20 mg PO daily", "Donepezil 10 mg PO daily", "Enoxaparin 30 mg SC daily"],
      docs: [{ d: 0, title: "Hospitalist Consult Note - Orthopedics", text: "84 F with dementia admitted after a fall with a left hip fracture, awaiting surgery tomorrow. Grimacing with movement, PAINAD 6. Pain 8/10 when moved. Morphine SC PRN given four times overnight. No regional block documented. CAM negative today. Lives with daughter." }] },
    { key: "Painful diabetic neuropathy, CKD 4", expect: "Pregabalin 300 mg/day above renal max (eGFR 24 → 150); amitriptyline in a 70-year-old (switch to nortriptyline or stop); oxycodone + gabapentinoid; duloxetine avoid (eGFR <30); neuropathic plan.",
      name: "DEMO, Victor", given: "Victor", family: "DEMO", sex: "male", birthDate: "1956-05-14", mrn: "TESTPAIN02",
      conds: ["Type 2 diabetes mellitus", "Diabetic peripheral neuropathy", "Chronic kidney disease stage 4", "Cellulitis, left foot"],
      labs: L(24, 245, [["Sodium", "2951-2", 138, "mmol/L"], ["Platelets", "777-3", 260, "10*9/L"]]), hr: 82, wt: 94, rr: 18, spo2: 96,
      meds: ["Pregabalin 150 mg PO BID", "Amitriptyline 25 mg PO qHS", "Oxycodone 5 mg PO q4h PRN pain", "Insulin glargine 30 units SC qHS", "Cefazolin 2 g IV q8h", "Polyethylene glycol 3350 17 g PO daily"],
      docs: [{ d: 1, title: "Hospitalist Admission Note", text: "70 M admitted with left foot cellulitis. Chronic burning, electric pain in both feet for 5 years from diabetic neuropathy, worse at night, with allodynia. Pain 7/10. Using oxycodone more often. Dizzy on standing. No falls." }] },
    { key: "Post-op on buprenorphine (OUD)", expect: "Opioid use disorder on buprenorphine-naloxone: continue it (split dosing), add hydromorphone on top, multimodal (acetaminophen + NSAID ok), naloxone kit, addiction medicine; acute plan.",
      name: "DEMO, Jordan", given: "Jordan", family: "DEMO", sex: "male", birthDate: "1988-02-11", mrn: "TESTPAIN03",
      conds: ["Opioid use disorder", "Open reduction internal fixation, right tibial fracture", "Hepatitis C, treated"],
      labs: L(105, 74, [["ALT", "1742-6", 32, "U/L"], ["Platelets", "777-3", 240, "10*9/L"]]), hr: 96, wt: 78, rr: 16, spo2: 98,
      meds: ["Buprenorphine-naloxone 16 mg/4 mg SL daily", "Acetaminophen 1 g PO q6h", "Hydromorphone 1 mg PO q4h PRN pain", "Senna 17.2 mg PO qHS"],
      docs: [{ d: 0, title: "Hospitalist Progress Note", text: "36 M post-op day 1 after ORIF of a right tibial fracture from a motorcycle crash. On Suboxone 16 mg daily for opioid use disorder for 3 years, last dose yesterday. Pain 9/10, not controlled with hydromorphone 1 mg. Worried about relapse. Wants to stay on Suboxone." }] },
    { key: "Chronic back pain, high MME + benzo", expect: "180 MME/day scheduled (up to 270 with PRN oxycodone) with lorazepam and gabapentin: highest-risk combination; chronic non-cancer pain ≥90 MME → offer slow taper, naloxone, benzodiazepine taper; consider buprenorphine rotation.",
      name: "DEMO, Glen", given: "Glen", family: "DEMO", sex: "male", birthDate: "1967-07-30", mrn: "TESTPAIN04",
      conds: ["Chronic low back pain", "Lumbar spinal stenosis", "Obstructive sleep apnea", "Anxiety", "Community-acquired pneumonia"],
      labs: L(88, 90), hr: 78, wt: 104, rr: 14, spo2: 92,
      meds: ["Oxycodone CR 60 mg PO q12h", "Oxycodone 10 mg PO q4h PRN breakthrough pain", "Lorazepam 1 mg PO TID", "Gabapentin 600 mg PO TID", "Ceftriaxone 1 g IV q24h", "Azithromycin 500 mg PO daily"],
      docs: [{ d: 1, title: "Hospitalist Admission Note", text: "58 M admitted with pneumonia. Chronic low back pain for 12 years after lumbar stenosis; on oxycodone for 8 years, doses increased over time. Function poor, rarely leaves the house. Uses CPAP inconsistently. Drowsy this morning with SpO2 89% on room air. No naloxone at home." }] },
    { key: "Cancer bone pain, cirrhosis", expect: "Bone metastases with cirrhosis: acetaminophen cap 2 g (current orders 4 g), NSAID avoid, hydromorphone reduced dose; dexamethasone + radiation; cord compression red flag (new leg weakness) — urgent MRI.",
      name: "DEMO, Marcel", given: "Marcel", family: "DEMO", sex: "male", birthDate: "1955-12-03", mrn: "TESTPAIN05",
      conds: ["Hepatocellular carcinoma with bone metastases", "Cirrhosis, alcohol-related", "Ascites"],
      labs: L(70, 88, [["ALT", "1742-6", 64, "U/L"], ["Bilirubin total", "1975-2", 42, "umol/L"], ["INR", "6301-6", 1.6, ""], ["Albumin", "1751-7", 27, "g/L"], ["Platelets", "777-3", 72, "10*9/L"], ["Sodium", "2951-2", 131, "mmol/L"]]), hr: 92, wt: 66, rr: 18, spo2: 95,
      meds: ["Acetaminophen 1 g PO q6h", "Morphine 10 mg PO q4h PRN pain", "Spironolactone 100 mg PO daily", "Lactulose 20 g PO BID"],
      docs: [{ d: 0, title: "Hospitalist Admission Note", text: "70 M with hepatocellular carcinoma and bone metastases to the thoracic spine and pelvis, cirrhosis with ascites. Severe back pain 9/10, worse lying flat. Since yesterday new leg weakness and difficulty voiding. Not yet seen by radiation oncology." }] },
    { key: "Knee OA on NSAID + DOAC", expect: "Ibuprofen with apixaban, ramipril + HCTZ (triple whammy), eGFR 48, age 81 without PPI: stop NSAID; topical diclofenac, scheduled acetaminophen 3 g cap, duloxetine caution; avoid opioids/tramadol for OA.",
      name: "DEMO, Ruth", given: "Ruth", family: "DEMO", sex: "female", birthDate: "1945-03-19", mrn: "TESTPAIN06",
      conds: ["Osteoarthritis of both knees", "Atrial fibrillation", "Hypertension", "Recurrent falls"],
      labs: L(48, 98, [["Sodium", "2951-2", 136, "mmol/L"], ["Platelets", "777-3", 230, "10*9/L"]]), hr: 72, wt: 70, rr: 16, spo2: 96,
      meds: ["Ibuprofen 600 mg PO TID", "Apixaban 5 mg PO BID", "Ramipril 10 mg PO daily", "Hydrochlorothiazide 25 mg PO daily", "Acetaminophen 500 mg PO q6h PRN"],
      docs: [{ d: 1, title: "Hospitalist Admission Note", text: "81 F admitted after a fall at home, no fracture. Chronic bilateral knee osteoarthritis pain for years, 6/10, limits walking. Takes ibuprofen 600 mg three times a day from her family doctor. Mood fine." }] },
    { key: "Fibromyalgia on tramadol + SSRI, seizures", expect: "Tramadol with sertraline and seizure history: serotonin syndrome/seizure risk — stop tramadol; fibromyalgia plan (exercise, CBT, sleep; duloxetine or pregabalin), avoid opioids.",
      name: "DEMO, Simone", given: "Simone", family: "DEMO", sex: "female", birthDate: "1982-08-07", mrn: "TESTPAIN07",
      conds: ["Fibromyalgia", "Epilepsy", "Major depressive disorder", "Migraine"],
      labs: L(110, 62, [["Sodium", "2951-2", 139, "mmol/L"]]), hr: 84, wt: 62, rr: 16, spo2: 98,
      meds: ["Tramadol 50 mg PO q6h", "Sertraline 150 mg PO daily", "Levetiracetam 500 mg PO BID", "Sumatriptan 50 mg PO PRN migraine", "Cyclobenzaprine 10 mg PO qHS"],
      docs: [{ d: 1, title: "Hospitalist Admission Note", text: "44 F admitted after a breakthrough seizure. Fibromyalgia with widespread pain for 6 years, poor sleep, fatigue. Started tramadol 3 months ago from a walk-in clinic. Pain 7/10. Not exercising." }] }
  ];
  root.PAIN_DEMOS = DEMOS;
  if (typeof module !== "undefined" && module.exports) module.exports = DEMOS;
})(typeof window !== "undefined" ? window : globalThis);
