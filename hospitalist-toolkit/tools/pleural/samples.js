/* MADE-UP patients for testing the Pleural effusion tab. Times are relative to "now" (h = hours ago). None of these are real people. */
(function () {
  const iso = (now, h) => new Date(now - h * 36e5).toISOString();
  const ob = (cat) => (now, loinc, disp, val, unit, h) => ({ resourceType: "Observation", status: "final", category: [{ coding: [{ code: cat }] }],
    code: { coding: loinc ? [{ system: "http://loinc.org", code: loinc, display: disp }] : [], text: disp }, effectiveDateTime: iso(now, h), valueQuantity: { value: val, unit } });
  const lab = ob("laboratory"), vit = ob("vital-signs");
  const L = (now, loinc, disp, unit, pts) => pts.map(([h, v]) => lab(now, loinc, disp, v, unit, h));
  const txt = (now, disp, text, h) => ({ resourceType: "Observation", status: "final", category: [{ coding: [{ code: "laboratory" }] }], code: { text: disp }, effectiveDateTime: iso(now, h), valueString: text });
  // pleural fluid panel (all named "Pleural fluid ...", no LOINC, as many labs send them)
  const pf = (now, h, o) => [].concat(
    o.prot != null ? [lab(now, null, "Pleural fluid protein", o.prot, "g/L", h)] : [], o.ldh != null ? [lab(now, null, "Pleural fluid LDH", o.ldh, "U/L", h)] : [],
    o.glu != null ? [lab(now, null, "Pleural fluid glucose", o.glu, "mmol/L", h)] : [], o.ph != null ? [lab(now, null, "Pleural fluid pH", o.ph, "", h)] : [],
    o.alb != null ? [lab(now, null, "Pleural fluid albumin", o.alb, "g/L", h)] : [], o.tg != null ? [lab(now, null, "Pleural fluid triglycerides", o.tg, "mmol/L", h)] : [],
    o.chol != null ? [lab(now, null, "Pleural fluid cholesterol", o.chol, "mmol/L", h)] : [], o.hct != null ? [lab(now, null, "Pleural fluid hematocrit", o.hct, "%", h)] : [],
    o.ada != null ? [lab(now, null, "Pleural fluid adenosine deaminase", o.ada, "U/L", h)] : [], o.bnp != null ? [lab(now, null, "Pleural fluid NT-proBNP", o.bnp, "ng/L", h)] : [],
    o.wbc != null ? [lab(now, null, "Pleural fluid nucleated cells", o.wbc, "10*6/L", h)] : [], o.n != null ? [lab(now, null, "Pleural fluid neutrophils %", o.n, "%", h)] : [],
    o.ly != null ? [lab(now, null, "Pleural fluid lymphocytes %", o.ly, "%", h)] : [], o.eo != null ? [lab(now, null, "Pleural fluid eosinophils %", o.eo, "%", h)] : [],
    o.app ? [txt(now, "Pleural fluid appearance", o.app, h)] : [], o.gram ? [txt(now, "Pleural fluid Gram stain", o.gram, h)] : [], o.cult ? [txt(now, "Pleural fluid culture", o.cult, h - 30)] : [],
    o.cyto ? [txt(now, "Pleural fluid cytology", o.cyto, h - 40)] : []);
  const serum = (now, h, o) => [].concat(L(now, "2885-2", "Protein total", "g/L", [[h, o.prot || 68]]), L(now, "2532-0", "LDH", "U/L", [[h, o.ldh || 200]]), L(now, "1751-7", "Albumin", "g/L", [[h, o.alb || 36]]),
    L(now, "2345-7", "Glucose", "mmol/L", [[h, o.glu || 6]]), L(now, "2160-0", "Creatinine", "umol/L", [[h, o.cr || 80]]), L(now, "3094-0", "Urea", "mmol/L", [[h, o.urea || 5]]),
    L(now, "4544-3", "Hematocrit", "L/L", [[h, o.hct || 0.4]]), L(now, "718-7", "Hemoglobin", "g/L", o.hbs || [[h, o.hb || 130]]), L(now, "6690-2", "WBC", "10*9/L", [[h, o.wbc || 8]]),
    L(now, "751-8", "Neutrophils absolute", "10*9/L", [[h, o.anc || 5]]), L(now, "731-0", "Lymphocytes absolute", "10*9/L", [[h, o.ly || 1.8]]), L(now, "777-3", "Platelets", "10*9/L", [[h, o.plt || 240]]),
    L(now, "6301-6", "INR", "", [[h, o.inr || 1.0]]), o.nt ? L(now, "33762-6", "NT-proBNP", "ng/L", [[h, o.nt]]) : [], o.crp ? L(now, "1988-5", "CRP", "mg/L", [[h, o.crp]]) : []);
  const vs = (now, o) => [vit(now, "59408-5", "SpO2", o.spo2 || 95, "%", 2), vit(now, "9279-1", "Respiratory rate", o.rr || 18, "/min", 2), vit(now, "8310-5", "Temperature", o.t || 36.9, "Cel", 2), vit(now, "8480-6", "Systolic BP", o.sbp || 128, "mm[Hg]", 2), vit(now, "8867-4", "Heart rate", o.hr || 84, "/min", 2)];
  const drain = (now, pts) => pts.map(([h, v]) => ({ resourceType: "Observation", status: "final", code: { text: "Chest tube output" }, effectiveDateTime: iso(now, h), valueQuantity: { value: v, unit: "mL" } }));
  const rep = (now, disp, conclusion, h) => ({ resourceType: "DiagnosticReport", status: "final", code: { text: disp }, effectiveDateTime: iso(now, h), issued: iso(now, h), conclusion });
  const req = (name, status) => ({ resourceType: "MedicationRequest", status: status || "active", medicationCodeableConcept: { text: name } });
  const cond = (text, code) => ({ resourceType: "Condition", clinicalStatus: { coding: [{ code: "active" }] }, code: { coding: [{ system: "http://hl7.org/fhir/sid/icd-10", code }], text } });
  const pt = (age, gender) => ({ resourceType: "Patient", gender, birthDate: new Date(Date.now() - age * 365.25 * 864e5 - 30 * 864e5).toISOString().slice(0, 10) });
  const enc = (d) => ({ resourceType: "Encounter", period: { start: new Date(Date.now() - d * 864e5).toISOString() } });

  window.PLEURAL_SAMPLES = [
    { label: "A: 81 M heart failure on furosemide, bilateral R>L effusions, Light's says exudate (pseudo-exudate: albumin gradient 16, pleural NT-proBNP 3,800)",
      sit: { side: "bilateral", size: "moderate", context: "hf", sympt: true, purpose: "transudate" },
      build: (now) => ({ patient: pt(81, "male"), encounter: enc(4), conditions: [cond("Heart failure with reduced ejection fraction", "I50.20"), cond("Atrial fibrillation", "I48.91"), cond("Chronic kidney disease stage 3", "N18.3")],
        obs: [].concat(vs(now, { spo2: 92, rr: 22 }), serum(now, 10, { prot: 58, ldh: 210, alb: 34, cr: 142, urea: 11, nt: 9200 }), pf(now, 8, { prot: 31, ldh: 140, alb: 18, glu: 6.2, bnp: 3800, wbc: 600, ly: 72, n: 10, app: "Clear, straw-coloured", cyto: "Negative for malignant cells" })),
        reports: [rep(now, "XR chest PA and lateral", "Cardiomegaly. Moderate right and small left pleural effusions. Upper lobe venous diversion.", 30), rep(now, "US chest pleural", "Moderate right effusion, anechoic, no septations. Site marked.", 10)],
        medreqs: [req("furosemide 80 mg IV BID"), req("apixaban 5 mg PO BID"), req("bisoprolol 2.5 mg PO daily"), req("spironolactone 12.5 mg PO daily")] }) },
    { label: "B: 66 M pneumonia day 6, still febrile, loculated R effusion, pH 7.02, Gram-positive cocci; 12 F tube day 2 has stopped draining (RAPID 5)",
      sit: { side: "right", size: "moderate", context: "pneumonia", sympt: true, fever: true, purpose: "empyema", hospitalAcquired: false, trouble: "notDraining", sepsisSettled: false, fluidLeft: true, daysIn: 2 },
      build: (now) => ({ patient: pt(66, "male"), encounter: enc(6), conditions: [cond("Community-acquired pneumonia, right lower lobe", "J18.1"), cond("Type 2 diabetes mellitus", "E11.9"), cond("Alcohol use disorder", "F10.20")],
        obs: [].concat(vs(now, { spo2: 93, rr: 24, t: 38.6, hr: 108 }), serum(now, 6, { alb: 24, urea: 9.1, cr: 118, wbc: 18.4, anc: 15.9, ly: 1.1, crp: 240 }), pf(now, 52, { prot: 48, ldh: 2400, glu: 1.4, ph: 7.02, wbc: 42000, n: 91, ly: 6, app: "Turbid", gram: "Gram-positive cocci in chains", cult: "Streptococcus anginosus group" }),
          drain(now, [[46, 420], [40, 90], [30, 30], [20, 10], [12, 5], [4, 0]])),
        reports: [rep(now, "CT chest with contrast", "Right lower lobe consolidation. Loculated right pleural collection with enhancing split pleura sign, consistent with empyema.", 54), rep(now, "XR chest portable", "Right pigtail drain in situ. Persistent right basal opacity, no significant change. No pneumothorax.", 6)],
        medreqs: [req("ceftriaxone 2 g IV q24h"), req("metronidazole 500 mg PO BID"), req("enoxaparin 40 mg SC daily"), req("sodium chloride 0.9% 20 mL intrapleural flush q8h")] }) },
    { label: "C: 71 F metastatic breast cancer, large recurrent L effusion, cytology positive, ECOG 2, lung did not re-expand after 1.4 L tap (trapped lung, LENT 5)",
      sit: { side: "left", size: "large", context: "cancer", sympt: true, purpose: "malignant", ecog: 2, tumour: "mod", reexpand: "no", relief: true, drained: 1400, drainMin: 50, tube: "small" },
      build: (now) => ({ patient: pt(71, "female"), encounter: enc(2), conditions: [cond("Metastatic breast cancer to bone", "C50.911"), cond("Hypertension", "I10")],
        obs: [].concat(vs(now, { spo2: 91, rr: 26 }), serum(now, 10, { prot: 64, ldh: 260, alb: 30, anc: 7.0, ly: 0.7, wbc: 8.4 }), pf(now, 20, { prot: 44, ldh: 1700, glu: 4.4, ph: 7.28, wbc: 1800, ly: 64, n: 12, app: "Blood-stained", hct: 2, cyto: "Malignant cells present: metastatic adenocarcinoma, consistent with breast primary" })),
        reports: [rep(now, "XR chest", "Large left pleural effusion with mediastinal shift to the right.", 30), rep(now, "XR chest post thoracentesis", "Partial drainage of left effusion. Left lung has not re-expanded with persistent hydropneumothorax at the base, suggestive of trapped (non-expandable) lung.", 16)],
        medreqs: [req("letrozole 2.5 mg PO daily"), req("denosumab 120 mg SC monthly"), req("hydromorphone 1 mg PO q4h PRN")] }) },
    { label: "D: 59 M cirrhosis with ascites, large right hydrothorax (transudate), INR 1.9, platelets 58; a chest tube has been suggested",
      sit: { side: "right", size: "large", context: "cirrhosis", sympt: true, purpose: "hepatic" },
      build: (now) => ({ patient: pt(59, "male"), encounter: enc(3), conditions: [cond("Alcohol-related cirrhosis with ascites", "K70.31"), cond("Hepatic hydrothorax, right", "J91.8"), cond("Esophageal varices", "I85.00")],
        obs: [].concat(vs(now, { spo2: 93, rr: 22, sbp: 102 }), serum(now, 8, { prot: 62, ldh: 200, alb: 26, cr: 104, plt: 58, inr: 1.9 }), pf(now, 12, { prot: 12, ldh: 60, glu: 7.0, alb: 6, wbc: 180, n: 20, ly: 55, app: "Clear, straw-coloured", cult: "No growth at 48 hours" })),
        reports: [rep(now, "XR chest", "Large right pleural effusion. Left lung clear.", 30), rep(now, "US abdomen", "Cirrhotic liver. Moderate ascites. Splenomegaly.", 40)],
        medreqs: [req("spironolactone 100 mg PO daily"), req("furosemide 40 mg PO daily"), req("lactulose 30 mL PO TID"), req("nadolol 20 mg PO daily")] }) },
    { label: "E: 38 M born in India, 3 weeks of fever and pleuritic pain, lymphocytic R exudate 88%, ADA 74, cytology negative (TB pleuritis?)",
      sit: { side: "right", size: "moderate", context: "unknown", sympt: true, fever: true, purpose: "effusion", tbRisk: true },
      build: (now) => ({ patient: pt(38, "male"), encounter: enc(2), conditions: [],
        obs: [].concat(vs(now, { t: 38.1 }), serum(now, 10, { prot: 74, ldh: 230, alb: 38 }), pf(now, 20, { prot: 54, ldh: 420, glu: 4.1, ph: 7.34, ada: 74, wbc: 3200, ly: 88, n: 6, app: "Straw-coloured", gram: "No organisms seen", cult: "No growth at 48 hours", cyto: "Negative for malignant cells. Predominantly lymphocytes, few mesothelial cells." })),
        reports: [rep(now, "XR chest", "Moderate right pleural effusion. No parenchymal lesion visible.", 40), rep(now, "CT chest with contrast", "Moderate right pleural effusion with smooth pleural thickening. No pleural nodularity. No lymphadenopathy.", 24)],
        medreqs: [req("acetaminophen 650 mg PO q6h PRN")] }) },
    { label: "F: 74 M fall with right rib fractures on apixaban; 28 F tube drained 1,100 mL then 260, 240, 230 mL/h; Hb 128 to 98 (hemothorax)",
      sit: { side: "right", size: "large", context: "trauma", sympt: true, purpose: "hemothorax", trouble: "bleeding", daysIn: 0 },
      build: (now) => ({ patient: pt(74, "male"), encounter: enc(0.3), conditions: [cond("Multiple right rib fractures", "S22.41XA"), cond("Atrial fibrillation", "I48.91"), cond("Hypertension", "I10")],
        obs: [].concat(vs(now, { spo2: 92, hr: 112, sbp: 98 }), serum(now, 1, { hct: 0.36, hbs: [[6, 128], [3, 112], [1, 98]], plt: 190, inr: 1.3 }), pf(now, 5, { hct: 30, app: "Frank blood" }),
          drain(now, [[5, 1100], [3.5, 260], [2.5, 240], [1.5, 230]])),
        reports: [rep(now, "CT chest", "Displaced fractures right ribs 6-9. Large right hemothorax. No pneumothorax.", 6), rep(now, "XR chest portable", "Right chest drain in situ. Residual right pleural opacity.", 1)],
        medreqs: [req("apixaban 5 mg PO BID", "on-hold"), req("hydromorphone 0.5 mg IV q2h PRN")] }) },
    { label: "G: 64 F follicular lymphoma, milky left effusion, triglycerides 3.8 mmol/L, tube draining 1,400 mL/day (chylothorax)",
      sit: { side: "left", size: "large", context: "cancer", sympt: true, purpose: "chylo", trouble: "highOutput", daysIn: 3 },
      build: (now) => ({ patient: pt(64, "female"), encounter: enc(5), conditions: [cond("Follicular lymphoma", "C82.90")],
        obs: [].concat(vs(now, {}), serum(now, 8, { alb: 29, cr: 96 }), pf(now, 72, { prot: 40, ldh: 190, glu: 6.0, tg: 3.8, chol: 2.1, wbc: 2600, ly: 90, app: "Milky white", cyto: "Negative for malignant cells; small mature lymphocytes" }),
          drain(now, [[22, 400], [16, 350], [10, 330], [4, 320]])),
        reports: [rep(now, "CT chest abdomen pelvis", "Bulky mediastinal and retroperitoneal lymphadenopathy. Large left pleural effusion.", 90)],
        medreqs: [req("medium-chain triglyceride diet"), req("octreotide 100 mcg SC TID")] }) }];
})();
