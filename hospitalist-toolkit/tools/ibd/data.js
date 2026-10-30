/* Reference data for the IBD flowsheet (Crohn's disease and ulcerative colitis).
   ALL of this is an unreviewed draft written by Claude: drug name lists, lab name patterns, LOINC codes and monitoring reminders must be checked
   before real use. Medication and lab matching is by NAME / code; a drug or test that is not found may still exist elsewhere in the record. */
(function () {
  const D = (id, label, re) => ({ id, label, re: new RegExp(re, "i") });
  /* immuno: counts as immunosuppression in the summary banner */
  const CLASSES = [
    { id: "asa", label: "5-ASA (aminosalicylates)", immuno: false, drugs: [
      D("mesalamine", "Mesalamine / mesalazine (Pentasa, Asacol, Salofalk, Mezavant, Lialda, Apriso)", "mesalamine|mesalazine|asacol|pentasa|salofalk|mezavant|lialda|apriso|5-?asa"),
      D("sulfasalazine", "Sulfasalazine (Salazopyrin, Azulfidine)", "sulfasalazine|salazopyrin|azulfidine"),
      D("balsalazide", "Balsalazide", "balsalazide|colazal"), D("olsalazine", "Olsalazine", "olsalazine|dipentum")],
      remind: ["Creatinine / eGFR at baseline and periodically (rare interstitial nephritis).", "Sulfasalazine: CBC, LFTs, folate."] },
    { id: "steroid", label: "Corticosteroids", immuno: true, drugs: [
      D("prednisone", "Prednisone / prednisolone", "(?<![a-z])prednis(one|olone)"), D("methylpred", "Methylprednisolone (Solu-Medrol)", "methylprednisolone|solu-?medrol"),
      D("hydrocortisone", "Hydrocortisone (Solu-Cortef)", "hydrocortisone|solu-?cortef"), D("budesonide", "Budesonide (Entocort, Uceris, Cortiment)", "budesonide|entocort|uceris|cortiment"),
      D("dexamethasone", "Dexamethasone", "dexamethasone")],
      remind: ["Glucose, potassium, blood pressure while on systemic steroids.", "Plan the taper; consider bone protection and PJP prophylaxis if prolonged or combined with other immunosuppression (check local policy).", "Steroid-dependent or repeated courses: review steroid-sparing therapy."] },
    { id: "immuno", label: "Immunomodulators (thiopurines, methotrexate)", immuno: true, drugs: [
      D("azathioprine", "Azathioprine (Imuran)", "azathioprine|imuran"), D("mercaptopurine", "Mercaptopurine / 6-MP (Purinethol)", "mercaptopurine|6-?mp|purinethol|purixan"),
      D("methotrexate", "Methotrexate", "methotrexate|\\bmtx\\b"), D("thioguanine", "Thioguanine", "thioguanine|lanvis")],
      remind: ["Thiopurines: TPMT / NUDT15 status before starting; CBC and LFTs regularly; interactions (allopurinol).", "Methotrexate: CBC, LFTs, creatinine; folic acid; contraception counselling.", "Check infection and vaccination status; skin and lymphoma risk counselling."] },
    { id: "tnf", label: "Anti-TNF biologics", immuno: true, drugs: [
      D("infliximab", "Infliximab (Remicade, Inflectra, Renflexis, Avsola)", "infliximab|remicade|inflectra|renflexis|avsola"),
      D("adalimumab", "Adalimumab (Humira and biosimilars: Hadlima, Hyrimoz, Amgevita, Idacio, Yuflyma, Abrilada)", "adalimumab|humira|hadlima|hyrimoz|amgevita|idacio|yuflyma|abrilada|hulio|yusimry"),
      D("golimumab", "Golimumab (Simponi)", "golimumab|simponi"), D("certolizumab", "Certolizumab pegol (Cimzia)", "certolizumab|cimzia")],
      remind: ["Before starting: TB screen (IGRA / skin test and chest x-ray as indicated), hepatitis B (HBsAg, anti-HBc, anti-HBs), consider HIV, HCV, VZV serology.", "If loss of response: drug level and anti-drug antibodies (trough before the next dose).", "Hold and look for infection if febrile on therapy."] },
    { id: "integrin", label: "Anti-integrin", immuno: true, drugs: [D("vedolizumab", "Vedolizumab (Entyvio)", "vedolizumab|entyvio")],
      remind: ["Same pre-treatment infection screen as other biologics (TB, hepatitis B).", "Slower onset: response may take weeks."] },
    { id: "il", label: "IL-12/23 and IL-23 inhibitors", immuno: true, drugs: [
      D("ustekinumab", "Ustekinumab (Stelara and biosimilars: Wezlana, Selarsdi, Pyzchiva, Otulfi)", "ustekinumab|stelara|wezlana|selarsdi|pyzchiva|otulfi|imuldosa|steqeyma"),
      D("risankizumab", "Risankizumab (Skyrizi)", "risankizumab|skyrizi"), D("mirikizumab", "Mirikizumab (Omvoh)", "mirikizumab|omvoh"), D("guselkumab", "Guselkumab (Tremfya)", "guselkumab|tremfya")],
      remind: ["Pre-treatment TB and hepatitis B screen.", "Risankizumab and mirikizumab: liver tests at baseline and during induction (check the product monograph)."] },
    { id: "jak", label: "JAK inhibitors", immuno: true, drugs: [
      D("tofacitinib", "Tofacitinib (Xeljanz)", "tofacitinib|xeljanz"), D("upadacitinib", "Upadacitinib (Rinvoq)", "upadacitinib|rinvoq"), D("filgotinib", "Filgotinib (Jyseleca)", "filgotinib|jyseleca")],
      remind: ["Infection risk including herpes zoster; consider VZV status and vaccination.", "Venous thromboembolism and cardiovascular risk: review risk factors before and during use.", "CBC, LFTs, lipids at baseline and during therapy."] },
    { id: "s1p", label: "S1P receptor modulators", immuno: true, drugs: [D("ozanimod", "Ozanimod (Zeposia)", "ozanimod|zeposia"), D("etrasimod", "Etrasimod (Velsipity)", "etrasimod|velsipity")],
      remind: ["Baseline ECG and heart-rate / first-dose considerations (check the monograph).", "Eye review for macular edema if risk factors; LFTs; infection and VZV status."] },
    { id: "rescue", label: "Rescue / calcineurin inhibitors", immuno: true, drugs: [D("cyclosporine", "Cyclosporine", "cyclosporin|ciclosporin|sandimmune|neoral"), D("tacrolimus", "Tacrolimus", "tacrolimus|prograf")],
      remind: ["Level monitoring, creatinine, potassium, magnesium, blood pressure.", "Used as rescue in steroid-refractory severe colitis; involve the GI team and surgery early."] },
    { id: "abx", label: "Antibiotics (C. difficile and others)", immuno: false, drugs: [
      D("vancomycin", "Vancomycin (oral)", "vancomycin"), D("fidaxomicin", "Fidaxomicin (Dificid)", "fidaxomicin|dificid"), D("metronidazole", "Metronidazole", "metronidazole|flagyl"),
      D("ciprofloxacin", "Ciprofloxacin", "ciprofloxacin|cipro\\b")],
      remind: ["Test for C. difficile (and other stool pathogens) in every flare before escalating immunosuppression."] },
    { id: "supp", label: "Iron, vitamins and other supportive drugs", immuno: false, drugs: [
      D("ironiv", "IV iron (iron sucrose, ferric derisomaltose, ferric carboxymaltose)", "iron sucrose|venofer|derisomaltose|monoferric|carboxymaltose|injectafer|ferumoxytol"),
      D("ironpo", "Oral iron (ferrous fumarate, gluconate, sulfate)", "ferrous|ferro-?|iron\\b"), D("vitd", "Vitamin D", "cholecalciferol|ergocalciferol|vitamin d"),
      D("b12", "Vitamin B12", "cyanocobalamin|cobalamin|vitamin b12"), D("folate", "Folic acid", "folic acid|folate"),
      D("vte", "VTE prophylaxis (enoxaparin, dalteparin, heparin)", "enoxaparin|lovenox|dalteparin|fragmin|heparin"),
      D("loperamide", "Loperamide (avoid in severe colitis)", "loperamide|imodium")],
      remind: ["Inpatient with active colitis: VTE prophylaxis is usually indicated even with rectal bleeding (check local policy).", "Avoid anti-motility drugs, opioids and NSAIDs in severe colitis."] }
  ];
  const EVENT_TYPES = [["started", "Started"], ["given", "Dose given"], ["changed", "Dose changed"], ["held", "Held"], ["stopped", "Stopped"]];

  /* Flowsheet lab rows. loinc: unverified; re: name pattern used when no code matches. conv: unit conversion to the standard unit. first match wins. */
  const mgdl = (f) => (v, u) => (/mg\/dl/i.test(u || "") ? v * f : v);
  const LABS = [
    { g: "inflam", id: "crp", label: "CRP", unit: "mg/L", loinc: ["1988-5", "30522-7", "76486-0"], re: /c.reactive|\bcrp\b/i, conv: (v, u) => (/mg\/dl/i.test(u || "") ? v * 10 : v) },
    { g: "inflam", id: "esr", label: "ESR", unit: "mm/h", loinc: ["4537-7", "30341-2"], re: /sed(imentation)? rate|\besr\b/i },
    { g: "inflam", id: "calpro", label: "Fecal calprotectin", unit: "ug/g", loinc: [], re: /calprotectin/i },
    { g: "blood", id: "hgb", label: "Hemoglobin", unit: "g/L", loinc: ["718-7", "20509-6", "59260-0"], re: /hemoglobin|haemoglobin/i, conv: (v, u) => (/g\/dl/i.test(u || "") || v < 25 ? v * 10 : v) },
    { g: "blood", id: "wbc", label: "WBC", unit: "x10^9/L", loinc: ["6690-2", "26464-8"], re: /white blood cell|leukocyte|\bwbc\b/i },
    { g: "blood", id: "anc", label: "Neutrophils (ANC)", unit: "x10^9/L", loinc: ["751-8", "26499-4", "770-8"], re: /neutrophil/i },
    { g: "blood", id: "lymph", label: "Lymphocytes", unit: "x10^9/L", loinc: ["731-0", "26474-7"], re: /lymphocyte/i },
    { g: "blood", id: "plt", label: "Platelets", unit: "x10^9/L", loinc: ["777-3", "26515-7"], re: /platelet/i },
    { g: "nutr", id: "alb", label: "Albumin", unit: "g/L", loinc: ["1751-7"], re: /albumin/i, conv: (v, u) => (/g\/dl/i.test(u || "") || v < 10 ? v * 10 : v) },
    { g: "nutr", id: "ferritin", label: "Ferritin", unit: "ug/L", loinc: ["2276-4"], re: /ferritin/i },
    { g: "nutr", id: "tsat", label: "Transferrin saturation", unit: "%", loinc: ["2502-3"], re: /transferrin sat|iron sat|tsat/i },
    { g: "nutr", id: "iron", label: "Iron", unit: "umol/L", loinc: ["2498-4", "14798-3"], re: /^iron\b|serum iron/i },
    { g: "nutr", id: "b12", label: "Vitamin B12", unit: "pmol/L", loinc: ["2132-9"], re: /vitamin b12|cobalamin/i },
    { g: "nutr", id: "folate", label: "Folate", unit: "nmol/L", loinc: ["2284-8", "2283-0"], re: /folate|folic/i },
    { g: "nutr", id: "vitd", label: "25-OH vitamin D", unit: "nmol/L", loinc: ["1989-3", "35365-6", "62292-8"], re: /25.?hydroxy|vitamin d/i },
    { g: "chem", id: "creat", label: "Creatinine", unit: "umol/L", loinc: ["2160-0", "38483-4", "14682-9"], re: /creatinine/i, conv: (v, u) => (/mg\/dl/i.test(u || "") ? v * 88.4 : v) },
    { g: "chem", id: "k", label: "Potassium", unit: "mmol/L", loinc: ["2823-3", "6298-4"], re: /potassium/i },
    { g: "chem", id: "mg", label: "Magnesium", unit: "mmol/L", loinc: ["19123-9", "2601-3"], re: /magnesium/i },
    { g: "chem", id: "alt", label: "ALT", unit: "U/L", loinc: ["1742-6", "1743-4"], re: /alanine|\balt\b|\bsgpt\b/i },
    { g: "chem", id: "alp", label: "Alkaline phosphatase", unit: "U/L", loinc: ["6768-6"], re: /alkaline phosphatase|\balp\b/i },
    { g: "chem", id: "bili", label: "Total bilirubin", unit: "umol/L", loinc: ["1975-2", "42719-5"], re: /bilirubin.*total|total bilirubin/i },
    { g: "chem", id: "glucose", label: "Glucose", unit: "mmol/L", loinc: ["2345-7", "2339-0", "14743-9"], re: /glucose/i, conv: (v, u) => (/mg\/dl/i.test(u || "") || v > 80 ? v / 18.016 : v) },
    { g: "stool", id: "cdiff", label: "C. difficile", unit: "", loinc: [], re: /clostridi|c\.? ?diff|c\. ?difficile|toxin a|toxin b/i, text: true },
    { g: "stool", id: "stoolcx", label: "Stool culture / pathogen panel", unit: "", loinc: [], re: /stool culture|enteric pathogen|gastrointestinal pathogen|stool pathogen|ova and parasite/i, text: true },
    { g: "stool", id: "cmv", label: "CMV", unit: "", loinc: [], re: /cytomegalo|\bcmv\b/i, text: true },
    { g: "drug", id: "ifxab", label: "Anti-infliximab antibodies", unit: "", loinc: [], re: /(anti|antibod).*infliximab|infliximab.*(antibod|ab\b)/i },
    { g: "drug", id: "ifx", label: "Infliximab level", unit: "ug/mL", loinc: [], re: /infliximab/i },
    { g: "drug", id: "ada", label: "Adalimumab level", unit: "ug/mL", loinc: [], re: /adalimumab/i },
    { g: "drug", id: "vedo", label: "Vedolizumab level", unit: "ug/mL", loinc: [], re: /vedolizumab/i },
    { g: "drug", id: "uste", label: "Ustekinumab level", unit: "ug/mL", loinc: [], re: /ustekinumab/i },
    { g: "drug", id: "tpmt", label: "TPMT / NUDT15", unit: "", loinc: [], re: /tpmt|nudt15|thiopurine methyl/i, text: true },
    { g: "drug", id: "tgn", label: "6-TGN", unit: "pmol/8x10^8 RBC", loinc: [], re: /thioguanine|6.?tgn/i },
    { g: "screen", id: "tb", label: "TB (IGRA / skin test)", unit: "", loinc: [], re: /quantiferon|igra|tuberculosis|mantoux|\btst\b|t-?spot/i, text: true },
    { g: "screen", id: "hbsag", label: "Hepatitis B surface antigen", unit: "", loinc: ["5196-1"], re: /hepatitis b surface antigen|hbsag/i, text: true },
    { g: "screen", id: "hbcab", label: "Hepatitis B core antibody", unit: "", loinc: [], re: /hepatitis b core|anti.?hbc|hbcab/i, text: true },
    { g: "screen", id: "hbsab", label: "Hepatitis B surface antibody", unit: "", loinc: [], re: /hepatitis b surface antibody|anti.?hbs\b|hbsab/i, text: true },
    { g: "screen", id: "hcv", label: "Hepatitis C", unit: "", loinc: [], re: /hepatitis c|\bhcv\b/i, text: true },
    { g: "screen", id: "hiv", label: "HIV", unit: "", loinc: [], re: /\bhiv\b/i, text: true },
    { g: "screen", id: "vzv", label: "VZV IgG", unit: "", loinc: [], re: /varicella|\bvzv\b/i, text: true }
  ];
  /* Order matters when several patterns could match one result: more specific first. */
  const MATCH_ORDER = ["ifxab", "hbsab", "hbcab", "hbsag", "ifx", "ada", "vedo", "uste", "tgn", "tpmt", "calpro", "cdiff", "stoolcx", "cmv", "tb", "hcv", "hiv", "vzv"];
  const GROUPS = [["vitals", "Vital signs (daily worst)"], ["daily", "Symptoms and scores (entered)"], ["inflam", "Inflammation"], ["blood", "Blood counts"], ["nutr", "Nutrition, iron and vitamins"], ["chem", "Chemistry"],
    ["stool", "Stool and infection tests"], ["meds", "Medications (S started, ● given, Δ changed, H held, X stopped)"], ["endo", "Endoscopy"], ["drug", "Drug levels and monitoring"], ["screen", "Pre-biologic screening"]];

  window.IBD = { CLASSES, EVENT_TYPES, LABS, MATCH_ORDER, GROUPS, mgdl,
    VERSION: { version: "0.1 draft", updated: "2026-10-30", note: "All thresholds, drug lists and reminders UNVERIFIED (written by Claude, not checked)" } };
})();
