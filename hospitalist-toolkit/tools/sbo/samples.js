/* MADE-UP patients for testing the Small bowel obstruction tab. Times are relative to "now" (h = hours ago). None of these are real people. */
(function () {
  const iso = (now, h) => new Date(now - h * 36e5).toISOString();
  const ob = (cat) => (now, loinc, disp, val, unit, h) => ({ resourceType: "Observation", status: "final", category: [{ coding: [{ code: cat }] }],
    code: { coding: loinc ? [{ system: "http://loinc.org", code: loinc, display: disp }] : [], text: disp }, effectiveDateTime: iso(now, h), valueQuantity: { value: val, unit } });
  const lab = ob("laboratory"), vit = ob("vital-signs");
  const labs = (now, h, o) => [["6690-2", "WBC", "10*9/L", o.wbc ?? 9], ["718-7", "Hemoglobin", "g/L", o.hb ?? 135], ["777-3", "Platelets", "10*9/L", o.plt ?? 260],
    ["2951-2", "Sodium", "mmol/L", o.na ?? 138], ["2823-3", "Potassium", "mmol/L", o.k ?? 3.9], ["2075-0", "Chloride", "mmol/L", o.cl ?? 100], ["1963-8", "Bicarbonate", "mmol/L", o.hco3 ?? 25],
    ["2160-0", "Creatinine", "umol/L", o.cr ?? 80], ["3094-0", "Urea", "mmol/L", o.urea ?? 6], ["2524-7", "Lactate", "mmol/L", o.lac ?? 1.3], ["1988-5", "CRP", "mg/L", o.crp ?? 12],
    ["3040-3", "Lipase", "U/L", o.lip ?? 30], ["1751-7", "Albumin", "g/L", o.alb ?? 38], ["19123-9", "Magnesium", "mmol/L", o.mg ?? 0.85], ["2345-7", "Glucose", "mmol/L", o.glu ?? 6.5],
    ["6301-6", "INR", "", o.inr ?? 1.0]].map(([c, d, u, v]) => lab(now, c, d, v, u, h)).concat(o.ph != null ? [lab(now, "2746-6", "pH venous", o.ph, "", h)] : [], o.crBase != null ? [lab(now, "2160-0", "Creatinine", o.crBase, "umol/L", 24 * 40)] : []);
  const vs = (now, o, h) => [vit(now, "8867-4", "Heart rate", o.hr || 88, "/min", h || 1), vit(now, "8480-6", "Systolic BP", o.sbp || 130, "mm[Hg]", h || 1), vit(now, "8310-5", "Temperature", o.t || 37.0, "Cel", h || 1),
    vit(now, "9279-1", "Respiratory rate", o.rr || 18, "/min", h || 1), vit(now, "59408-5", "SpO2", o.spo2 || 96, "%", h || 1), vit(now, "29463-7", "Weight", o.wt || 70, "kg", 20)];
  const ng = (now, pts) => pts.map(([h, v]) => ({ resourceType: "Observation", status: "final", code: { text: "NG tube output" }, effectiveDateTime: iso(now, h), valueQuantity: { value: v, unit: "mL" } }));
  const rep = (now, disp, conclusion, h) => ({ resourceType: "DiagnosticReport", status: "final", code: { text: disp }, effectiveDateTime: iso(now, h), issued: iso(now, h), conclusion });
  const req = (name) => ({ resourceType: "MedicationRequest", status: "active", medicationCodeableConcept: { text: name } });
  const cond = (text, code, resolved) => ({ resourceType: "Condition", clinicalStatus: { coding: [{ code: resolved ? "resolved" : "active" }] }, code: { coding: [{ system: "http://hl7.org/fhir/sid/icd-10", code }], text } });
  const proc = (now, text, daysAgo) => ({ resourceType: "Procedure", status: "completed", code: { text }, performedDateTime: iso(now, daysAgo * 24) });
  const pt = (age, gender) => ({ resourceType: "Patient", gender, birthDate: new Date(Date.now() - age * 365.25 * 864e5 - 30 * 864e5).toISOString().slice(0, 10) });
  const enc = (now, h) => ({ resourceType: "Encounter", period: { start: iso(now, h) } });

  window.SBO_SAMPLES = [
    { label: "A: 72 F adhesive SBO (hysterectomy + appendectomy), colicky pain, no red flags, NG in 14 h: offer the contrast challenge",
      sit: { colicky: true, vomiting: true, distension: true, nomHours: 14, cause: "adhesions", dry: true },
      build: (now) => ({ patient: pt(72, "female"), encounter: enc(now, 16), conditions: [cond("Hypertension", "I10"), cond("Osteoarthritis of knee", "M17.9"), cond("Status post total abdominal hysterectomy", "Z90.710", true)],
        procedures: [proc(now, "Total abdominal hysterectomy", 365 * 18), proc(now, "Open appendectomy", 365 * 50)],
        obs: [].concat(vs(now, { hr: 96, sbp: 124, wt: 64 }), labs(now, 15, { k: 3.2, cl: 94, hco3: 30, cr: 104, crBase: 72, urea: 11, lac: 1.6, wbc: 10.8, crp: 22 }), ng(now, [[12, 600], [6, 450], [1, 300]])),
        reports: [rep(now, "CT abdomen pelvis with IV contrast", "Dilated fluid-filled small bowel loops up to 3.8 cm with a transition point in the right lower quadrant, likely adhesive. Small bowel feces sign proximal to the transition. Distal small bowel and colon decompressed. Normal bowel wall enhancement. No pneumatosis, no free air, no closed loop. Trace free fluid in the pelvis.", 14)],
        medreqs: [req("hydromorphone 0.5 mg IV q3h PRN"), req("dimenhydrinate 25 mg IV q4h PRN"), req("ramipril 10 mg PO daily"), req("hydrochlorothiazide 25 mg PO daily"), req("polyethylene glycol 17 g PO daily PRN"), req("heparin 5,000 units SC q12h")] }) },
    { label: "B: 84 F tender irreducible right femoral hernia, lactate 3.4, reduced wall enhancement: emergency surgery",
      sit: { continuous: true, vomiting: true, distension: true, guarding: true, hernia: "tender", cause: "hernia", dry: true },
      build: (now) => ({ patient: pt(84, "female"), encounter: enc(now, 5), conditions: [cond("Atrial fibrillation", "I48.91"), cond("Mild cognitive impairment", "G31.84"), cond("Chronic kidney disease stage 3a", "N18.31")],
        obs: [].concat(vs(now, { hr: 118, sbp: 104, t: 37.9, wt: 52 }), labs(now, 4, { wbc: 15.6, lac: 3.4, crp: 96, cr: 148, crBase: 98, urea: 16, hco3: 19, k: 4.4 })),
        reports: [rep(now, "CT abdomen pelvis with IV contrast", "Small bowel obstruction due to an incarcerated right femoral hernia containing a loop of ileum. The herniated loop shows reduced wall enhancement and adjacent mesenteric edema, concerning for strangulation. Small amount of free fluid. No free air.", 3)],
        medreqs: [req("apixaban 2.5 mg PO BID"), req("metoprolol 25 mg PO BID"), req("donepezil 5 mg PO daily"), req("morphine 2 mg IV q2h PRN")] }) },
    { label: "C: 46 M Roux-en-Y bypass 6 y ago, sudden severe pain, closed loop with whirl sign, CT otherwise soft: internal hernia",
      sit: { continuous: true, vomiting: true, cause: "hernia" },
      build: (now) => ({ patient: pt(46, "male"), encounter: enc(now, 4), conditions: [cond("Status post Roux-en-Y gastric bypass", "Z98.84"), cond("Obstructive sleep apnea", "G47.33")],
        procedures: [proc(now, "Laparoscopic Roux-en-Y gastric bypass", 365 * 6)],
        obs: [].concat(vs(now, { hr: 112, sbp: 142, wt: 98 }), labs(now, 3, { wbc: 13.1, lac: 1.9, crp: 8 })),
        reports: [rep(now, "CT abdomen pelvis with IV contrast", "Swirling of the mesentery (whirl sign) in the left upper quadrant with a cluster of dilated small bowel loops and two adjacent transition points, in keeping with a closed-loop obstruction from internal hernia through Petersen's defect. Bowel wall enhancement preserved. Mild mesenteric edema. No free air.", 2)],
        medreqs: [req("multivitamin PO daily"), req("vitamin B12 1000 mcg IM monthly"), req("semaglutide 1 mg SC weekly"), req("ketorolac 15 mg IV q6h PRN")] }) },
    { label: "D: 61 F ovarian cancer with peritoneal carcinomatosis, vomiting, multiple transition points: malignant bowel obstruction",
      sit: { colicky: true, vomiting: true, distension: true, obstipation: true, cause: "malignant", nomHours: 30 },
      build: (now) => ({ patient: pt(61, "female"), encounter: enc(now, 36), conditions: [cond("Malignant neoplasm of ovary, high-grade serous", "C56.9"), cond("Peritoneal carcinomatosis", "C78.6"), cond("Malignant ascites", "R18.0")],
        procedures: [proc(now, "Debulking: total abdominal hysterectomy, bilateral salpingo-oophorectomy, omentectomy", 400)],
        obs: [].concat(vs(now, { hr: 102, sbp: 112, wt: 54 }), labs(now, 6, { alb: 24, k: 3.3, cr: 70, lac: 1.4, crp: 64, hb: 98 }), ng(now, [[20, 900], [10, 700], [2, 650]])),
        reports: [rep(now, "CT abdomen pelvis with IV contrast", "Progression of peritoneal carcinomatosis with omental caking and moderate ascites. Dilated small bowel with multiple transition points in the pelvis due to tethering by peritoneal implants. No free air. Bowel wall enhancement preserved.", 30)],
        medreqs: [req("hydromorphone 1 mg SC q4h PRN"), req("metoclopramide 10 mg IV q6h"), req("dexamethasone 8 mg IV daily"), req("senna 2 tabs PO HS"), req("enoxaparin 40 mg SC daily")] }) },
    { label: "E: 34 M Crohn ileitis, no previous surgery, CRP 88, thickened enhancing terminal ileum with upstream dilation",
      sit: { colicky: true, vomiting: true, distension: true, cause: "crohn" },
      build: (now) => ({ patient: pt(34, "male"), encounter: enc(now, 20), conditions: [cond("Crohn disease of small intestine", "K50.00")],
        obs: [].concat(vs(now, { hr: 98, t: 37.8, wt: 66 }), labs(now, 8, { wbc: 11.4, crp: 88, alb: 31, hb: 118 })),
        reports: [rep(now, "CT enterography", "Long segment wall thickening and mucosal hyperenhancement of the terminal ileum over 15 cm with comb sign, consistent with active Crohn disease, causing partial small bowel obstruction with upstream dilation to 3.4 cm. No abscess. No free air.", 18)],
        medreqs: [req("adalimumab 40 mg SC every 2 weeks"), req("loperamide 2 mg PO PRN"), req("acetaminophen 1 g PO q6h")] }) },
    { label: "F: 69 M adhesive SBO day 3 of non-operative care, Gastrografin given 26 h ago and NOT in the colon: surgery",
      sit: { colicky: true, vomiting: true, distension: true, obstipation: true, cause: "adhesions", nomHours: 76, wsccGiven: true, wsccHours: 26, wsccColon: "no", npoDays: 3 },
      build: (now) => ({ patient: pt(69, "male"), encounter: enc(now, 80), conditions: [cond("Type 2 diabetes mellitus", "E11.9"), cond("Parkinson disease", "G20"), cond("Status post sigmoid colectomy for diverticulitis", "Z90.49", true)],
        procedures: [proc(now, "Open sigmoid colectomy (Hartmann) and reversal", 365 * 7)],
        obs: [].concat(vs(now, { hr: 92, wt: 82 }), labs(now, 5, { k: 3.6, mg: 0.62, lac: 1.5, wbc: 10.2, crp: 58, glu: 11.8 }), ng(now, [[60, 1100], [36, 1000], [12, 900], [2, 800]])),
        reports: [rep(now, "CT abdomen pelvis with IV contrast", "Small bowel obstruction with transition point in the mid pelvis near the colorectal anastomosis, likely adhesive. No closed loop. Normal wall enhancement. No free air.", 74),
          rep(now, "XR abdomen (contrast follow-up 24 h)", "Contrast remains within dilated small bowel loops. Contrast has not reached the colon.", 2)],
        medreqs: [req("carbidopa-levodopa 25/100 mg PO QID"), req("metformin 1000 mg PO BID"), req("empagliflozin 10 mg PO daily"), req("insulin glargine 18 units SC daily"), req("oxybutynin 5 mg PO BID"), req("morphine 2 mg IV q3h PRN")] }) },
    { label: "G: 78 M on prednisone for polymyalgia, distension and vomiting, free intraperitoneal air at a transition point: perforated",
      sit: { continuous: true, vomiting: true, distension: true, obstipation: true, cause: "unknown", dry: true },
      build: (now) => ({ patient: pt(78, "male"), encounter: enc(now, 3), conditions: [cond("Polymyalgia rheumatica", "M35.3"), cond("Chronic obstructive pulmonary disease", "J44.9"), cond("Status post open right hemicolectomy", "Z90.49", true)],
        obs: [].concat(vs(now, { hr: 124, sbp: 86, t: 37.4, rr: 26, spo2: 92, wt: 74 }), labs(now, 2, { wbc: 3.1, lac: 5.2, hco3: 16, ph: 7.24, cr: 166, crBase: 90, urea: 18, crp: 180, k: 4.9, inr: 2.8 })),
        reports: [rep(now, "CT abdomen pelvis non-contrast", "Dilated small bowel loops to 4.5 cm with a transition point in the right abdomen near the ileocolic anastomosis. Moderate pneumoperitoneum and free fluid, consistent with perforation. Pneumatosis of the dilated loops. IV contrast not given due to AKI.", 1)],
        medreqs: [req("prednisone 15 mg PO daily"), req("tiotropium 18 mcg inhaled daily"), req("warfarin 4 mg PO daily")] }) }];
})();
