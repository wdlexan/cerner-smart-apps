/* Protocol text for the Bispecific CRS/ICANS monitor.
   Transcribed from the two BC Cancer protocols supplied by the user:
     SCCRS   Cytokine Release Syndrome Management  (activated 1 Dec 2022, revised 1 Jun 2026: Grade 1 and 2 sections updated)
     SCICANS ICANS Management                       (activated 1 Mar 2024, revised 1 Dec 2024)
   Doses and wording are kept as printed. The app does NOT order anything. If a protocol is revised, edit this file.
   Each item has a category c (where it is shown) and optionally w = "home" or "facility" (only shown for that setting).
   The "where" items put the protocol's "present to facility / admit / higher level of care / ER / ICU" wording in one place.
   INTERPRETATION: the protocols say "health-care facility", "admit", "higher level of care" and "ER/ICU". The app shows ward, ER and ICU for those; the protocols do not name a ward. */
(function () {
  const CATS = [
    ["where", "Where the patient should be"],
    ["notify", "Who to notify"],
    ["stop", "Stop or hold treatment"],
    ["meds", "Medications, fluids and oxygen"],
    ["tests", "Labs and cultures"],
    ["imaging", "Imaging, EEG and procedures"],
    ["consult", "Consults"],
    ["monitor", "Monitoring and nursing care"]
  ];
  const I = (c, t, w) => (w ? { c, t, w } : { c, t });

  /* ----- shared pieces (SCCRS) ----- */
  const CRS_LABS = I("tests", "CBC & diff, electrolyte panel, creatinine, ALT, alkaline phosphatase, LDH, total bilirubin, lactate, CRP, ferritin, INR, PTT, fibrinogen (for persistent Grade 1 or Grade 2 CRS, and as required). Repeat serially if any abnormality (every 4 hours) and again before discharge.");
  const CRS_CLIN = I("tests", "If clinically indicated: urinalysis with culture, blood cultures.");
  const CRS_CXR = I("imaging", "If clinically indicated: chest x-ray.");
  const SEPSIS = [
    I("tests", "If febrile: concurrent septic work-up (blood and urine cultures, and/or other tests directed at symptoms). Do not wait for the work-up before treating CRS."),
    I("imaging", "If febrile: chest x-ray as part of the septic work-up."),
    I("meds", "If febrile: consider empiric broad-spectrum antibiotics, particularly if immunocompromised and/or neutropenic.")
  ];
  const SYMPTOM_DRUGS = [
    I("meds", "diphenhydrAMINE 50 mg IV every 4 hours PRN for rash, pruritis"),
    I("meds", "metoclopramide 10 mg PO/IV every 4 hours PRN for nausea"),
    I("meds", "ondansetron 8 mg PO/IV every 8 hours PRN for nausea")
  ];
  const TOCI = I("meds", "tocilizumab 8 mg/kg (maximum 800 mg) IV in 100 mL NS over 1 hour. Repeat every 8 hours as needed if not responding to IV fluids or supplemental oxygen (limit 3 doses in 24 hours, 4 doses total).");
  const SALBUTAMOL = I("meds", "salbutamol 5 mg nebule for inhalation by nebulizer every 20 minutes PRN (maximum 3 doses) for shortness of breath, hypoxia");
  const OXYGEN = I("meds", "Oxygen to maintain oxygen saturation above 92%.");
  const SBP_BOLUS = I("meds", "If systolic blood pressure is less than 100 mmHg or more than 20 mmHg below baseline: notify physician and start NaCl 0.9% IV fluid bolus.");

  const CRS = {
    1: [
      I("where", "AT HOME: may stay home with hourly temperature checks. Go to a health-care facility / ER now if: fever persists longer than 1 hour or recurs within 6 hours; new orthostatic symptoms, weakness, confusion, dizziness or shortness of breath (suggest Grade 2); or systolic BP < 10 mmHg below baseline AND < 100 mmHg (if able to check). Consider in-person evaluation if extensive comorbidities or poor performance status.", "home"),
      I("where", "AT A FACILITY: stay in a monitored bed (ward) with hourly vital signs. When CRS symptoms have resolved and the patient is afebrile with normal vital signs for at least 4 hours, contact the MRP to decide on discharge home with ongoing home monitoring.", "facility"),
      I("where", "Persistent Grade 1 CRS not responding to the measures below: treat as Grade 2 CRS."),
      I("notify", "Notify the admitting or most responsible physician (a physician must be notified at the first signs of CRS)."),
      I("stop", "Hold infusion until CRS symptoms resolve. Once resolved, may restart as per the specific drug protocol."),
      I("meds", "acetaminophen 975 mg to 1000 mg PO and dexamethasone 12 mg PO for fever ≥ 38.0 ºC; can repeat acetaminophen every 4-6 hours PRN if clinically stable", "home"),
      I("meds", "acetaminophen 650 mg or 975 mg PO every 4 hours PRN for fever", "facility"),
      I("meds", "Recommend aggressive oral hydration: 2 L orally daily (8-10 glasses of water).", "home"),
      SBP_BOLUS, OXYGEN
    ].concat(SYMPTOM_DRUGS, [I("meds", "Consider IV fluids if required")], SEPSIS, [CRS_LABS, CRS_CLIN, CRS_CXR,
      I("monitor", "Patient to check temperature every 1 hour (and blood pressure, heart rate, oxygen saturation if able). Advise the patient to contact the treating team urgently and/or present directly to ER for the symptoms listed above.", "home"),
      I("monitor", "Vital signs and pulse oximetry every 1 hour until resolution of symptoms.", "facility")]),
    2: [
      I("where", "AT HOME: go to a health-care facility / ER urgently for evaluation and management. Take acetaminophen 1000 mg PO and dexamethasone 12 mg PO once (if prescribed) on the way.", "home"),
      I("where", "AT A FACILITY: monitored bed (ward) with vital signs and pulse oximetry at least every hour. Escalate to Grade 3 management (ER/ICU) if BP or oxygen needs worsen, or if the patient has extensive comorbidities or poor performance status (protocol: manage per Grade 3).", "facility"),
      I("notify", "Notify the most responsible physician if not already done."),
      I("stop", "Immediately discontinue current treatment and do not restart."),
      I("meds", "500 mL to 1 L NaCl 0.9% IV fluid bolus or continuous infusion for hypotension", "facility"),
      I("meds", "acetaminophen 650 mg or 975 mg PO every 4 hours PRN for fever ≥ 38.0 ºC", "facility"),
      I("meds", "If blood pressure does not respond to IV fluids (after 2 fluid boluses): give tocilizumab and/or steroids. Early tocilizumab decreases progression to Grade 3 or 4 CRS: give tocilizumab first, reserving dexamethasone if no response within 1 to 2 hours."),
      TOCI,
      I("meds", "dexamethasone 10 mg IV every 6 hours. Continue corticosteroids until event is Grade 1 or less, then taper over 3 days."),
      I("meds", "(Protocol also lists methylPREDNISolone 125 mg IV once, preferred only for melanoma patients on tebentafusp.)"),
      SBP_BOLUS, OXYGEN
    ].concat(SYMPTOM_DRUGS, [SALBUTAMOL], SEPSIS, [CRS_LABS, CRS_CLIN, CRS_CXR,
      I("monitor", "Vital signs and pulse oximetry at least every hour, and more frequently if necessary, until resolution of CRS symptoms.")]),
    3: [
      I("where", "ER / ICU: arrange EMERGENT transfer to a higher level of care (ER/ICU required). From home: emergency transport to the ER, then ICU. From a ward: ICU / critical care now."),
      I("notify", "Notify the most responsible physician if not already done. Contact ICU."),
      I("stop", "Immediately stop treatment and do not restart."),
      I("meds", "acetaminophen 650 mg or 975 mg PO every 4 hours PRN for fever ≥ 38.0 ºC"),
      I("meds", "500 mL to 1 L NaCl 0.9% IV fluid bolus or continuous infusion for hypotension"),
      I("meds", "epinephrine 1 mg/mL (1:1000) 0.5 mg IM every 5 minutes (maximum 3 doses) PRN for severe hypotension"),
      I("meds", "ALL patients should receive BOTH steroids and tocilizumab."),
      TOCI,
      I("meds", "dexamethasone 10 to 20 mg IV every 6 hours (start at 10 mg and escalate to 20 mg if no improvement in hypoxia at 24 hours or abrupt increase in oxygen needs) OR methylprednisolone 1 gram IV daily. Continue corticosteroids until event is Grade 1 or less, then taper over 2 to 7 days."),
      OXYGEN
    ].concat(SYMPTOM_DRUGS, [SALBUTAMOL], SEPSIS, [CRS_LABS, CRS_CLIN, CRS_CXR,
      I("monitor", "Vital signs every 15 minutes or more frequently as ordered by MD until resolution to Grade 2 or less, then every hour until complete resolution of CRS.")])
  };

  /* ----- ICANS (SCICANS) ----- */
  const LEV = "levETIRAcetam 1500 mg PO load, then 750 mg PO BID maintenance dose (starting dose for 30 days). In patients without premorbid seizure history who return to neurologic baseline, taper: 500 mg PO BID for 2 weeks, then 250 mg PO BID for 2 weeks, then discontinue. Monitor for recurrence of seizure.";
  const ICANS_COMMON = [
    I("notify", "Page the admitting physician or covering physician (a physician must be notified at the first signs of ICANS)."),
    I("stop", "Immediately stop administration of treatment medication."),
    I("meds", "LORazepam 1 mg IV every 5 minutes PRN for seizures, to a maximum of 4 mg."),
    I("meds", "Avoid medications that cause CNS depression."),
    I("meds", "If concurrent CRS, consider tocilizumab (see SCCRS). Tocilizumab does not cross the blood brain barrier, so it does not treat ICANS itself."),
    I("tests", "CBC & diff, sodium, potassium, chloride, bicarbonate, calcium, magnesium, phosphorus, uric acid, albumin, creatinine, ALT, alkaline phosphatase, LDH, total bilirubin, lactate, CRP, ferritin, INR, PTT, fibrinogen (all grades). If any abnormality: repeat every 4 hours or at provider discretion, and repeat before discharge."),
    I("tests", "Point of care glucometer testing every 6 hours."),
    I("tests", "If clinically indicated: urinalysis and culture, blood cultures."),
    I("imaging", "If clinically indicated: chest x-ray."),
    I("imaging", "Consider CT or MRI head and/or EEG to assess for alternate etiologies. Repeat assessment if persistent abnormalities or further clinical changes."),
    I("imaging", "Consider lumbar puncture (opening pressure, infectious work-up, protein, glucose, cell count and differential, flow cytometry for underlying disease if appropriate)."),
    I("imaging", "Bedside fundoscopic evaluation."),
    I("consult", "Consider Neurology consultation."),
    I("monitor", "Neurovitals and an ICE score every 8 hours until normalization. Neurovitals = vital signs, Glasgow coma scale and pupil size in mm for left and right eye."),
    I("monitor", "Monitor vital signs every 4 hours for development of concurrent CRS."),
    I("monitor", "Monitor for seizure activity. Monitor ability to safely swallow: consider NPO, meds with sips; convert all medications to IV if swallowing is impaired. Elevate head of bed 30 degrees.")
  ];
  const ICANS = {
    1: [I("where", "WARD (admitted, monitored bed): admit for monitoring if not already admitted. A patient at home must come to hospital."),
        I("meds", "Steroids may not be required for Grade 1, but low threshold to give a single dose of dexamethasone if concerning features such as ataxia or ICE score of 7: consider dexamethasone 10 mg IV once and reassess (can be repeated every 6 hours, as per Grade 2 dosing).")].concat(ICANS_COMMON),
    2: [I("where", "WARD (admitted, monitored bed): admit for monitoring if not already admitted. A patient at home must come to hospital. Consider transfer to a higher level of care (ICU / neurology-capable site) if there is no improvement to Grade 1 after 1 to 2 doses of steroids (for neurology consultation, EEG, urgent neuroimaging), or if CRS is Grade 2 or higher."),
        I("meds", "Give steroids first (reserve tocilizumab for concurrent CRS): dexamethasone 10 mg IV every 6 hours. Continue steroids until event is Grade 1 or less, then taper over 3 days."),
        I("meds", "Consider seizure prophylaxis (if not already on), particularly if any concern for clinical seizure and/or epileptiform EEG findings (progression to Grade 3): " + LEV),
        I("consult", "Consider Ophthalmology consult to rule out papilledema."),
        I("imaging", "If no improvement after 1 to 2 doses of steroids: urgent neuroimaging, EEG and neurology consultation (may need a higher level of care).")].concat(ICANS_COMMON),
    3: [I("where", "ICU / higher level of care: arrange URGENT transfer and contact ICU to discuss admission. From home: ER by emergency transport, then ICU."),
        I("meds", "Steroid by type: encephalopathy, dexamethasone 10 mg IV every 6 hours (increase to 20 mg if not resolved at 24 hours); seizure, dexamethasone 20 mg IV every 6 hours; focal cerebral edema, methylPREDNISolone 1 gram IV daily (3 days if edema involves the brain stem or thalamus, one day for other locations). Continue corticosteroids until event is Grade 1 or less, then taper over 3 to 7 days."),
        I("meds", "Seizure treatment (recommended for Grade 3 to 4 even if no clinical seizure activity): " + LEV),
        I("meds", "Consider for refractory ICANS: anakinra 100 mg IV in NS 50 mL every 12 hours (can be escalated to every 6 hours)."),
        I("imaging", "EEG to assess for seizures."),
        I("imaging", "Lumbar puncture to assess opening pressure and rule out other causes of neurologic deterioration (if not already performed and no contraindications)."),
        I("imaging", "CT/MRI: consider repeating imaging every 2 to 3 days if persistent Grade 3 or higher CRS, to monitor for cerebral edema."),
        I("consult", "If seizures, papilledema on fundoscopy, or edema on imaging: consult Neurology."),
        I("monitor", "ICU monitoring and management of cerebral edema as indicated; consider mechanical ventilation for airway protection.")].concat(ICANS_COMMON)
  };
  ICANS[4] = ICANS[3].map((x) => (x.t.startsWith("Steroid by type") ? I("meds", "Grade 4: methylPREDNISolone 1 gram IV daily. Continue corticosteroids until event is Grade 1 or less, then taper over 3 to 7 days.") : x));

  /* Protocol lab panel (used for the latest-value table). */
  const LABS = [
    ["wbc", "WBC", "crs icans"], ["anc", "Neutrophils (ANC)", "crs icans"], ["hgb", "Hemoglobin", "crs icans"], ["plt", "Platelets", "crs icans"],
    ["na", "Sodium", "crs icans"], ["k", "Potassium", "crs icans"], ["cl", "Chloride", "icans"], ["hco3", "Bicarbonate", "icans"],
    ["ca", "Calcium", "icans"], ["mg", "Magnesium", "icans"], ["phos", "Phosphate", "icans"], ["urate", "Uric acid", "icans"], ["alb", "Albumin", "icans"],
    ["creat", "Creatinine", "crs icans"], ["alt", "ALT", "crs icans"], ["alp", "Alkaline phosphatase", "crs icans"], ["ldh", "LDH", "crs icans"],
    ["bili", "Total bilirubin", "crs icans"], ["lactate", "Lactate", "crs icans"], ["crp", "CRP", "crs icans"], ["ferritin", "Ferritin", "crs icans"],
    ["inr", "INR", "crs icans"], ["ptt", "PTT", "crs icans"], ["fib", "Fibrinogen", "crs icans"]
  ];

  window.BS_PROTOCOL = {
    CRS, ICANS, LABS, CATS,
    META: {
      crs: "SCCRS Cytokine Release Syndrome Management, BC Cancer (activated 1 Dec 2022, revised 1 Jun 2026)",
      icans: "SCICANS Immune Effector Cell-Associated Neurotoxicity Syndrome Management, BC Cancer (activated 1 Mar 2024, revised 1 Dec 2024)",
      grading: "Grades follow the ASTCT consensus criteria (Lee et al. Biol Blood Marrow Transplant 2019) as printed in the two protocols."
    }
  };
})();
