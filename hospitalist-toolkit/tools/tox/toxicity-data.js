/* Oncology toxicity matrix content. EDIT THIS FILE to change rows; the page needs no other change.
   Every row must carry a source and a status. status "unverified" shows a red label on the card.
   "matchNames" (lowercase) is for the later chart-matching step. No doses are entered unless copied from a named source. */
window.TOX_META = { version: "0.1 draft", updated: "2026-10-21", note: "Prototype. Content is NOT yet reviewed against sources." };
window.TOX = [
  {
    id: "immune-pneumonitis", title: "Immune pneumonitis", category: "irAE", urgency: "high",
    agentClass: "Checkpoint inhibitors (PD-1 / PD-L1)", drugs: ["Pembrolizumab", "Nivolumab", "Cemiplimab"],
    matchNames: ["pembrolizumab", "keytruda", "nivolumab", "opdivo", "cemiplimab", "libtayo", "atezolizumab", "durvalumab"],
    features: "New cough, shortness of breath or low oxygen in a patient on or after a checkpoint inhibitor; ground-glass or patchy changes on CT.",
    differential: "Infection (including opportunistic), heart failure, pulmonary embolism, progression of disease, radiation pneumonitis if prior chest radiation.",
    steps: [
      ["Drug", "Hold the checkpoint inhibitor and confirm the grade with the oncology team."],
      ["Workup", "Resting and walking oxygen saturation, CT chest, infection workup."],
      ["Steroids", "Gemini export, not checked: methylprednisolone 1-2 mg/kg/day IV for Grade 2 or higher. Confirm against your source."],
      ["Consult", "Urgent respiratory consult; bronchoscopy with lavage may be considered."]
    ],
    callOncology: "Any new respiratory symptoms on a checkpoint inhibitor.",
    source: { text: "Claude draft; steroid line from a Gemini export. Not checked against a monograph or guideline.", date: "2026-10-21", status: "unverified" }
  },
  {
    id: "crs", title: "Cytokine release syndrome (CRS)", category: "ADC / Bispecific", urgency: "emergent",
    agentClass: "Bispecific T-cell engagers / CAR-T", drugs: ["Teclistamab", "Elranatamab", "Epcoritamab"],
    matchNames: ["teclistamab", "tecvayli", "elranatamab", "elrexfio", "epcoritamab", "epkinly", "glofitamab", "talquetamab", "blinatumomab"],
    features: "Fever (often the first sign) within hours to days of an infusion or step-up dose; may progress to low blood pressure and low oxygen. Neurologic changes (ICANS) can overlap.",
    differential: "Infection or sepsis (can coexist), other causes of fever, neurotoxicity (ICANS) overlapping.",
    steps: [
      ["First", "Treat as urgent. Check vital signs, oxygen need and blood pressure; examine mental status."],
      ["Workup", "Blood cultures and infection workup at the same time. Check counts."],
      ["Treating team", "Call the treating oncology or hematology team urgently and use their CRS protocol. Decisions about tocilizumab and steroids are made with them."],
      ["Gemini export (unchecked)", "Tocilizumab 8 mg/kg IV, IV fluid boluses, vasopressor if fluid-refractory, ferritin/CRP/fibrinogen, early ICU notification for Grade 2+ with sustained hypoxia or hypotension."],
      ["Monitor", "Repeat neurologic checks for ICANS."]
    ],
    callOncology: "Immediately for fever after a recent infusion or step-up dose.",
    source: { text: "Claude draft plus a Gemini export line (dose). Not checked; follow your treating team's CRS protocol.", date: "2026-10-21", status: "unverified" }
  },
  {
    id: "adc-ild", title: "ADC interstitial lung disease (ILD)", category: "ADC / Bispecific", urgency: "emergent",
    agentClass: "Antibody-drug conjugates (ADC)", drugs: ["Trastuzumab deruxtecan (T-DXd)", "Sacituzumab govitecan"],
    matchNames: ["trastuzumab deruxtecan", "enhertu", "sacituzumab", "trodelvy"],
    features: "New cough, shortness of breath or low oxygen on or after an ADC; changes on chest CT.",
    differential: "Exacerbation of heart failure, opportunistic viral pneumonia (PJP/CMV), progression of disease.",
    steps: [
      ["Drug", "Immediately interrupt drug dosing (do not re-challenge if Grade 2 or higher)."],
      ["Steroids", "High-dose prednisone 1 mg/kg/day (or equivalent) for Grade 2; IV pulse methylprednisolone for Grade 3/4."],
      ["Workup", "HRCT chest, resting pulse oximetry, infectious PCR panel."],
      ["Consult", "Prompt pulmonary specialist consultation."]
    ],
    callOncology: "Any new respiratory symptoms on an ADC.",
    source: { text: "Transcribed from a Gemini answer (screenshot). Doses and thresholds not checked; confirm against the drug monograph and your cancer agency.", date: "2026-10-21", status: "unverified" }
  },
  {
    id: "immune-colitis", title: "Immune-mediated colitis", category: "irAE", urgency: "high",
    agentClass: "Checkpoint inhibitors (CTLA-4 / PD-1)", drugs: ["Ipilimumab", "Nivolumab combination"],
    matchNames: ["ipilimumab", "yervoy", "nivolumab", "opdivo", "pembrolizumab", "keytruda", "tremelimumab"],
    features: "Diarrhea above the patient's baseline, abdominal pain, blood or mucus in the stool, in a patient on or after a checkpoint inhibitor (more common with combination therapy).",
    differential: "Infection (C. difficile and other enteric pathogens), other drug-related diarrhea, ischemia or obstruction.",
    steps: [
      ["Assess", "Count stools above baseline, examine the abdomen, check for blood and dehydration."],
      ["Workup", "C. difficile and stool studies, CBC, electrolytes, creatinine, CRP; imaging if severe or an acute abdomen is suspected."],
      ["Drug", "Hold the checkpoint inhibitor and discuss with oncology."],
      ["Steroids", "Gemini export, not checked: methylprednisolone 1-2 mg/kg/day IV once infection is excluded."],
      ["Refractory", "Gemini export, not checked: infliximab 5 mg/kg or vedolizumab if no response after 48-72 h."],
      ["Avoid", "Gemini export, not checked: antimotility agents (loperamide) until infection and severe causes are excluded."],
      ["Consult", "Early gastroenterology and oncology input."]
    ],
    callOncology: "Same day for diarrhea on a checkpoint inhibitor.",
    source: { text: "Claude draft plus Gemini export lines (doses). Not checked against a monograph or guideline.", date: "2026-10-21", status: "unverified" }
  },
  {
    id: "tki-qtc", title: "TKI QTc prolongation", category: "Targeted TKI", urgency: "moderate",
    agentClass: "Tyrosine kinase inhibitors (TKI)", drugs: ["Osimertinib", "Lenvatinib", "Vandetanib"],
    matchNames: ["osimertinib", "tagrisso", "lenvatinib", "lenvima", "vandetanib", "caprelsa", "nilotinib", "crizotinib"],
    features: "Palpitations, syncope or an abnormal ECG on a TKI; risk rises with low potassium, magnesium or calcium and other QT-prolonging drugs.",
    differential: "Electrolyte disturbance, other QT-prolonging drugs (antiemetics, antipsychotics, some antibiotics and antifungals), cardiac disease.",
    steps: [
      ["ECG", "Get an ECG and review the QTc against your hospital's thresholds. Gemini export, not checked: hold the TKI if QTc is above 500 ms."],
      ["Labs", "Check and correct potassium, magnesium and calcium. Gemini export, not checked: targets K above 4.0 and Mg above 2.0 mg/dL."],
      ["Medicines", "Review other QT-prolonging drugs on the medication list."],
      ["Drug", "Discuss holding or adjusting the TKI with oncology."]
    ],
    callOncology: "For any QTc above the hospital threshold.",
    source: { text: "Claude draft, structure only. Thresholds from a Gemini export, not checked.", date: "2026-10-21", status: "unverified" }
  },
  {
    id: "tki-diarrhea", title: "TKI severe diarrhea", category: "Targeted TKI", urgency: "moderate",
    agentClass: "Tyrosine kinase inhibitors (TKI)", drugs: ["Cabozantinib", "Lenvatinib", "Afatinib"],
    matchNames: ["cabozantinib", "cabometyx", "lenvatinib", "lenvima", "afatinib", "giotrif"],
    features: "Frequent loose stools with dehydration, electrolyte loss or kidney injury in a patient on a TKI.",
    differential: "Infection, immune-related colitis if also on immunotherapy, other medicines, bowel obstruction.",
    steps: [
      ["Assess", "Volume status, stool count and blood pressure."],
      ["Labs", "Electrolytes, creatinine, magnesium; stool studies including C. difficile."],
      ["Fluids", "Replace fluid and electrolytes. Gemini export, not checked: hold the TKI for Grade 3 or higher (more than 6 stools/day over baseline); loperamide for symptoms."],
      ["Drug", "Discuss holding or dose-reducing the TKI with oncology."]
    ],
    callOncology: "For severe or persistent diarrhea.",
    source: { text: "Claude draft, structure only. No doses entered. Gemini grouped this with QTc; split here because they are different problems.", date: "2026-10-21", status: "unverified" }
  }
];
