/* Protocol text for the Bispecific CRS/ICANS monitor.
   Transcribed from the two BC Cancer protocols supplied by the user:
     SCCRS   Cytokine Release Syndrome Management  (activated 1 Dec 2022, revised 1 Jun 2026: Grade 1 and 2 sections updated)
     SCICANS ICANS Management                       (activated 1 Mar 2024, revised 1 Dec 2024)
   Doses and wording are kept as printed. The app does NOT order anything. If the protocol is revised, edit this file.
   kind: stop | notify | drug | monitor | escalate | note   (only used for the small label shown beside each line) */
(function () {
  const I = (kind, t) => ({ k: kind, t });
  const SYMPTOM_DRUGS = [
    I("drug", "diphenhydrAMINE 50 mg IV every 4 hours PRN for rash, pruritis"),
    I("drug", "metoclopramide 10 mg PO/IV every 4 hours PRN for nausea"),
    I("drug", "ondansetron 8 mg PO/IV every 8 hours PRN for nausea")
  ];
  const TOCI = I("drug", "tocilizumab 8 mg/kg (maximum 800 mg) IV in 100 mL NS over 1 hour. Repeat every 8 hours as needed if not responding to IV fluids or supplemental oxygen (limit 3 doses in 24 hours, 4 doses total).");
  const SALBUTAMOL = I("drug", "salbutamol 5 mg nebule for inhalation by nebulizer every 20 minutes PRN (maximum 3 doses) for shortness of breath, hypoxia");

  const CRS = {
    1: [
      { title: "All settings", items: [
        I("stop", "Hold infusion until CRS symptoms resolve. Once resolved, may restart infusion as per specific drug protocol."),
        I("notify", "Notify the admitting or most responsible physician (a physician must be notified at the first signs of CRS)."),
        I("note", "If febrile, initiate concurrent septic work up and consider empiric coverage with broad-spectrum antibiotics, particularly if immunocompromised and/or neutropenic. Do not wait for infectious work-up before starting treatment for CRS.") ] },
      { title: "If patient is at home", where: "home", items: [
        I("drug", "acetaminophen 975 mg to 1000 mg PO and dexamethasone 12 mg PO for fever ≥ 38.0 ºC; can repeat acetaminophen every 4-6 hours PRN if clinically stable"),
        I("note", "Recommend aggressive oral hydration (2 L orally daily, equivalent to 8-10 glasses of water)"),
        I("monitor", "Patient to check temperature every 1 hour (and blood pressure, heart rate, oxygen saturation if able). If fever > 38.0 ºC persists for longer than 1 hour or recurs within 6 hours, advise patient to present to health-care facility and/or ER for evaluation."),
        I("escalate", "Advise patient to contact the treating healthcare team for urgent evaluation and/or present directly to ER if: new orthostatic symptoms, weakness, confusion, dizziness, shortness of breath (suggestive of Grade 2 CRS); or systolic BP < 10 mmHg below baseline AND < 100 mmHg, if able to check at home."),
        I("escalate", "Consider in-person evaluation if extensive comorbidities or poor performance status.") ] },
      { title: "If patient is at a health-care facility", where: "facility", items: [
        I("drug", "acetaminophen 650 mg or 975 mg PO every 4 hours PRN for fever"),
        I("monitor", "Vital signs and pulse oximetry every 1 hour until resolution of symptoms.") ] },
      { title: "Additional symptom management", items: SYMPTOM_DRUGS.concat([I("note", "Consider IV fluids if required")]) },
      { title: "Next steps", items: [
        I("note", "Persistent grade 1 CRS not responding to the above measures: proceed to treat as grade 2 CRS."),
        I("note", "Where outpatient management is permitted: if CRS symptoms resolve and the patient is afebrile with normal vital signs for at least 4 hours, contact the MRP to decide whether the patient may be discharged home with a plan for ongoing home monitoring.") ] }
    ],
    2: [
      { title: "All settings", items: [
        I("stop", "Immediately discontinue current treatment and do not restart."),
        I("notify", "Notify the most responsible physician if not already done."),
        I("note", "If febrile, concurrent septic work up and consider broad-spectrum antibiotics, particularly if neutropenic.") ] },
      { title: "If patient is at home", where: "home", items: [
        I("escalate", "Instruct patient to present urgently to a health-care facility for evaluation and management."),
        I("drug", "Advise patient to take acetaminophen 1000 mg PO and dexamethasone 12 mg PO once (if prescribed) en route to the health-care facility.") ] },
      { title: "If patient is at a health-care facility", where: "facility", items: [
        I("drug", "500 mL to 1 L NaCl 0.9% IV fluid bolus or continuous infusion for hypotension"),
        I("drug", "acetaminophen 650 mg or 975 mg PO every 4 hours PRN for fever ≥ 38.0 ºC") ] },
      { title: "If blood pressure does not respond to IV fluids (after 2 fluid boluses), or oxygen need persists", items: [
        I("note", "Tocilizumab and/or steroids should be administered. Early tocilizumab decreases rates of progression to grade 3 or 4 CRS: administer tocilizumab first, reserving dexamethasone if no response to tocilizumab within 1 to 2 hours."),
        TOCI,
        I("drug", "dexamethasone 10 mg IV every 6 hours. Continue corticosteroids until event is Grade 1 or less, then taper over 3 days."),
        I("note", "The protocol also lists methylPREDNISolone 125 mg IV once, preferred only for melanoma patients treated with tebentafusp (tocilizumab is reserved for those patients).") ] },
      { title: "Additional symptom management", items: SYMPTOM_DRUGS.concat([SALBUTAMOL]) },
      { title: "Monitoring", items: [I("monitor", "Vital sign monitoring and pulse oximetry at least every hour, and more frequently if necessary, until resolution of CRS symptoms.")] }
    ],
    3: [
      { title: "Immediately", items: [
        I("stop", "Immediately stop treatment and do not restart."),
        I("notify", "Notify the most responsible physician if not already done."),
        I("escalate", "Arrange emergent transfer to higher level of care (ER / ICU required). Contact ICU."),
        I("monitor", "Vital signs every 15 minutes or more frequently as ordered by MD until resolution to Grade 2 or less, then every hour until complete resolution of CRS.") ] },
      { title: "As ordered", items: [
        I("drug", "acetaminophen 650 mg or 975 mg PO every 4 hours PRN for fever ≥ 38.0 ºC"),
        I("drug", "500 mL to 1 L NaCl 0.9% IV fluid bolus or continuous infusion for hypotension"),
        I("drug", "epinephrine 1 mg/mL (1:1000) 0.5 mg IM every 5 minutes (maximum 3 doses) PRN for severe hypotension")
      ].concat(SYMPTOM_DRUGS, [SALBUTAMOL]) },
      { title: "All patients should receive BOTH steroids and tocilizumab", items: [
        TOCI,
        I("drug", "dexamethasone 10 to 20 mg IV every 6 hours (start at 10 mg and escalate to 20 mg if no improvement in hypoxia at 24 hours or abrupt increase in oxygen needs) OR methylprednisolone 1 gram IV daily"),
        I("note", "Continue corticosteroids until event is Grade 1 or less, then taper over 2 to 7 days.") ] }
    ]
  };

  const SUPPORT = [ // supportive care printed under ICANS Grade 1 (applies to all grades)
    I("monitor", "Point of care glucometer testing every 6 hours"),
    I("monitor", "Monitor for seizure activity"),
    I("monitor", "Monitor ability to safely swallow; consider NPO, meds with sips; convert all medications to IV if swallowing is impaired"),
    I("note", "Elevate head of bed 30 degrees"),
    I("note", "Avoid medications that cause CNS depression"),
    I("monitor", "Bedside fundoscopic evaluation"),
    I("escalate", "Consider Neurology consultation"),
    I("monitor", "Monitor vitals every 4 hours for development of concurrent CRS. If concurrent CRS, consider tocilizumab (see SCCRS)."),
    I("monitor", "Neurovitals and an ICE score every 8 hours until normalization. Neurovitals = vital signs, Glasgow coma scale and pupil size in mm for left and right eye."),
    I("drug", "LORazepam 1 mg IV every 5 minutes PRN for seizures, to a maximum of 4 mg")
  ];
  const LEV = I("drug", "levETIRAcetam 1500 mg PO load, then 750 mg PO BID maintenance dose (starting dose for 30 days). In patients without premorbid seizure history who return to neurologic baseline, taper: 500 mg PO BID for 2 weeks, then 250 mg PO BID for 2 weeks, then discontinue. Monitor for recurrence of seizure.");

  const ICANS = {
    1: [
      { title: "Immediately", items: [
        I("stop", "Immediately stop administration of treatment medication."),
        I("notify", "Page the admitting physician or covering physician."),
        I("escalate", "Admit the patient for further monitoring if not already admitted (a home patient needs to come in)."),
        I("drug", "Early steroids may decrease severity. Steroids may not be required for Grade 1, but low threshold to give a single dose of dexamethasone if concerning features such as ataxia or ICE score of 7. Consider dexamethasone 10 mg IV once and reassess (can be repeated every 6 hours, as per Grade 2 dosing).") ] },
      { title: "Supportive care", items: SUPPORT }
    ],
    2: [
      { title: "Immediately", items: [
        I("stop", "Immediately stop administration of treatment medication."),
        I("escalate", "Admit the patient for further monitoring if not already admitted."),
        I("notify", "Page the admitting physician or covering physician if not already done."),
        I("drug", "Administer steroids first. Reserve tocilizumab for concurrent CRS (tocilizumab does not cross the blood brain barrier). dexamethasone 10 mg IV every 6 hours. Continue steroids until event is Grade 1 or less, then taper over 3 days."),
        I("drug", "Consider seizure prophylaxis (if not already on), particularly if any concern for clinical seizure and/or epileptiform EEG findings (progression to Grade 3): " + LEV.t) ] },
      { title: "Supportive care (as Grade 1) PLUS", items: [
        I("escalate", "If no resolution of symptoms or no improvement to Grade 1 ICANS after 1 to 2 doses of steroids, consider transfer to higher level of care if required for neurology consultation, EEG and urgent neuroimaging."),
        I("escalate", "Consider transfer to higher level of care if associated with Grade 2 or higher CRS."),
        I("note", "Consider Ophthalmology consult to rule out papilledema."),
        I("note", "Consider lumbar puncture to assess opening pressure and rule out other causes of neurologic deterioration.")
      ].concat(SUPPORT) }
    ],
    3: [
      { title: "Immediately", items: [
        I("stop", "Immediately stop administration of treatment medication."),
        I("escalate", "Arrange urgent transfer to higher level of care. Contact ICU to discuss admission."),
        I("notify", "Page the admitting physician or covering physician if not already done."),
        I("drug", "Steroid by type: encephalopathy, dexamethasone 10 mg IV every 6 hours (increase to 20 mg if not resolved at 24 hours); seizure, dexamethasone 20 mg IV every 6 hours; focal cerebral edema, methylPREDNISolone 1 gram IV daily (3 days if edema involves the brain stem or thalamus, one day for other locations). Continue corticosteroids until event is Grade 1 or less, then taper over 3 to 7 days."),
        I("drug", "Seizure treatment (recommended for Grade 3 to 4 even if no clinical seizure activity): " + LEV.t) ] },
      { title: "Supportive care (as Grades 1 and 2) PLUS", items: [
        I("note", "EEG to assess for seizures."),
        I("note", "Lumbar puncture to assess opening pressure and rule out other causes (if not already performed and no contraindications)."),
        I("escalate", "If seizures, papilledema on fundoscopy, or edema on imaging, consult Neurology."),
        I("note", "CT/MRI: consider repeating imaging every 2 to 3 days if persistent Grade 3 or higher CRS, to monitor for cerebral edema."),
        I("escalate", "ICU monitoring and management of cerebral edema as indicated; consider mechanical ventilation for airway protection."),
        I("drug", "Consider for refractory ICANS: anakinra 100 mg IV in NS 50 mL every 12 hours (can be escalated to every 6 hours).")
      ].concat(SUPPORT) }
    ]
  };
  ICANS[4] = [
    { title: "Immediately", items: [
      I("stop", "Immediately stop administration of treatment medication."),
      I("escalate", "Arrange urgent transfer to higher level of care. Contact ICU to discuss admission."),
      I("notify", "Page the admitting physician or covering physician if not already done."),
      I("drug", "Grade 4: methylPREDNISolone 1 gram IV daily. Continue corticosteroids until event is Grade 1 or less, then taper over 3 to 7 days."),
      I("drug", "Seizure treatment (recommended for Grade 3 to 4 even if no clinical seizure activity): " + LEV.t) ] },
    ICANS[3][1]
  ];

  /* Protocol lab panel. CRS (persistent Grade 1 or 2, and as required) and ICANS (all grades) lists are both shown.
     Repeat every 4 hours if abnormal (CRS) / "or at provider discretion" (ICANS), and repeat before discharge. */
  const LABS = [
    ["wbc", "WBC", "crs icans"], ["anc", "Neutrophils (ANC)", "crs icans"], ["hgb", "Hemoglobin", "crs icans"], ["plt", "Platelets", "crs icans"],
    ["na", "Sodium", "crs icans"], ["k", "Potassium", "crs icans"], ["cl", "Chloride", "icans"], ["hco3", "Bicarbonate", "icans"],
    ["ca", "Calcium", "icans"], ["mg", "Magnesium", "icans"], ["phos", "Phosphate", "icans"], ["urate", "Uric acid", "icans"], ["alb", "Albumin", "icans"],
    ["creat", "Creatinine", "crs icans"], ["alt", "ALT", "crs icans"], ["alp", "Alkaline phosphatase", "crs icans"], ["ldh", "LDH", "crs icans"],
    ["bili", "Total bilirubin", "crs icans"], ["lactate", "Lactate", "crs icans"], ["crp", "CRP", "crs icans"], ["ferritin", "Ferritin", "crs icans"],
    ["inr", "INR", "crs icans"], ["ptt", "PTT", "crs icans"], ["fib", "Fibrinogen", "crs icans"]
  ];
  const OTHER_TESTS = {
    crs: "If clinically indicated: chest x-ray, urinalysis with culture, blood cultures.",
    icans: "Consider CT or MRI head and/or EEG to assess for alternate etiologies (repeat if persistent abnormalities or further clinical change). Consider lumbar puncture (opening pressure, infectious work-up, protein, glucose, cell count and differential, flow cytometry if appropriate). If clinically indicated: chest x-ray, urinalysis and culture, blood cultures."
  };

  window.BS_PROTOCOL = {
    CRS, ICANS, LABS, OTHER_TESTS,
    META: {
      crs: "SCCRS Cytokine Release Syndrome Management, BC Cancer (activated 1 Dec 2022, revised 1 Jun 2026)",
      icans: "SCICANS Immune Effector Cell-Associated Neurotoxicity Syndrome Management, BC Cancer (activated 1 Mar 2024, revised 1 Dec 2024)",
      grading: "Grades follow the ASTCT consensus criteria (Lee et al. Biol Blood Marrow Transplant 2019) as printed in the two protocols."
    }
  };
})();
