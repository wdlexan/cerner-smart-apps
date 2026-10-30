/* node test_extract.js : tests the PDF text extractor on MADE-UP report text. */
const X = require("../pdf-extract.js");
let pass = 0, fail = 0; const ok = (n, c, x) => { console.log((c ? "PASS " : "FAIL ") + n + (!c && x ? " | " + JSON.stringify(x).slice(0, 300) : "")); c ? pass++ : fail++; };
const labReport = `Pathology and Laboratory Medicine - OUTSIDE LAB
Patient: TEST, MADE-UP    Collected: 2026-10-12 08:15
Test                      Result     Units        Reference     Flag
Hemoglobin                98         g/L          130 - 170     L
White Blood Cell Count    14.2       x10^9/L      4.0 - 11.0    H
Platelets                 520        x10^9/L      150 - 450     H
Sodium                    138        mmol/L       135 - 145
Potassium                 3.1        mmol/L       3.5 - 5.1     L
Creatinine                142        umol/L       60 - 110      H
C-Reactive Protein        78         mg/L         0 - 8         H
Albumin                   26         g/L          35 - 50       L
Fecal Calprotectin        1450       ug/g         < 50          H
Ferritin                  18         ug/L         30 - 300      L
Hemoglobin A1c            6.1        %
C. difficile toxin B PCR  Detected
QuantiFERON TB Gold       Negative
Hepatitis B surface antigen  Negative
Hepatitis B core antibody total  Positive
Collected: 14/10/2026
Glucose 11.8 mmol/L
INR 1.1`;
let r = X.fromText(labReport, { fileName: "outside_labs.pdf" });
const by = (k) => r.items.filter((i) => i.key === k);
ok("doc date from Collected line", r.docT && X.iso(r.docT) === "2026-10-12", r.docT);
ok("Hgb 98 g/L low with range", by("hgb")[0] && by("hgb")[0].value === 98 && by("hgb")[0].unit === "g/L" && by("hgb")[0].low === 130 && by("hgb")[0].high === 170 && by("hgb")[0].flag === "L", by("hgb"));
ok("WBC with ^ unit", by("wbc")[0] && by("wbc")[0].value === 14.2 && /x10\^9\/L/i.test(by("wbc")[0].unit), by("wbc"));
ok("platelets", by("plt")[0] && by("plt")[0].value === 520);
ok("sodium, potassium separate", by("na")[0].value === 138 && by("k")[0].value === 3.1);
ok("creatinine", by("creat")[0].value === 142);
ok("CRP hyphenated name", by("crp")[0] && by("crp")[0].value === 78, by("crp"));
ok("calprotectin with < reference", by("calpro")[0] && by("calpro")[0].value === 1450 && by("calpro")[0].high === 50, by("calpro"));
ok("HbA1c is not hemoglobin", by("hba1c")[0] && by("hba1c")[0].value === 6.1 && by("hgb").length === 1, [by("hba1c"), by("hgb")]);
ok("C. diff text Detected", by("cdiff")[0] && by("cdiff")[0].text === "Detected", by("cdiff"));
ok("TB negative", by("tb")[0] && by("tb")[0].text === "Negative");
ok("HBsAg vs HBcAb separate", by("hbsag")[0].text === "Negative" && by("hbcab")[0].text === "Positive", [by("hbsag"), by("hbcab")]);
ok("later Collected 14/10/2026 date applies to glucose", by("glucose")[0] && X.iso(by("glucose")[0].t) === "2026-10-14", by("glucose"));
ok("INR no unit", by("inr")[0] && by("inr")[0].value === 1.1 && by("inr")[0].unit === "");
ok("no duplicate sodium from 'Na' inside words", r.items.filter((i) => i.key === "na").length === 1);
ok("ferritin low flag", by("ferritin")[0].flag === "L" && by("ferritin")[0].value === 18);
// resource build
const res = X.toResource(by("hgb")[0], { patientId: "123", fileName: "outside_labs.pdf", now: Date.now() });
ok("Observation resource shape", res.resourceType === "Observation" && res.code.coding[0].code === "718-7" && res.valueQuantity.value === 98 && res.interpretation[0].coding[0].code === "L" && res.referenceRange[0].low.value === 130 && res.meta.tag[0].code === "pdf-import" && res.subject.reference === "Patient/123", res);
const tx = X.toResource(by("cdiff")[0], { patientId: "123", fileName: "f.pdf", now: Date.now() }); ok("text lab becomes valueString", tx.valueString === "Detected" && !tx.valueQuantity);

// vitals and meds and conditions
const clinic = `Gastroenterology Clinic Letter     Date of visit: Oct 20, 2026
Diagnosis: Crohn disease of ileum, diagnosed 2015. Family history of colon cancer.
No history of tuberculosis.
Vitals: BP 118/72  HR 78  RR 16  Temp 36.8 C  SpO2 97%  Weight 66.5 kg
Current medications:
  Adalimumab 40 mg subcut every 2 weeks
  Azathioprine 150 mg PO daily
  Folic acid 5 mg daily
Allergies: penicillin
Plan: continue. Total 3 follow up. Take 2 tablets daily.`;
r = X.fromText(clinic, { fileName: "clinic.pdf" });
const k = (kind) => r.items.filter((i) => i.kind === kind);
ok("visit date", X.iso(r.docT) === "2026-10-20");
ok("BP/HR/RR/temp/spo2/weight", ["bp", "hr", "rr", "temp", "spo2", "wt"].every((x) => k("vital").some((v) => v.key === x)), k("vital").map((v) => v.key));
ok("BP values", k("vital").find((v) => v.key === "bp").value === 118 && k("vital").find((v) => v.key === "bp").value2 === 72);
ok("weight 66.5", k("vital").find((v) => v.key === "wt").value === 66.5);
ok("3 meds found, with dose", k("med").length === 3 && k("med").some((m) => /Adalimumab 40 mg/.test(m.text)) && k("med").some((m) => /Azathioprine 150 mg PO daily/.test(m.text)), k("med"));
ok("junk 'Take 2 tablets' not a med", !k("med").some((m) => /^take/i.test(m.label)));
ok("Crohn disease condition", k("condition").some((c) => c.label === "Crohn disease" && c.icd === "K50.9"), k("condition"));
ok("family history / negated not captured", !k("condition").some((c) => /cancer/i.test(c.label)) && !k("condition").some((c) => /tubercul/i.test(c.label)));
const mr = X.toResource(k("med")[0], { patientId: "9", fileName: "clinic.pdf", now: Date.now() }); ok("MedicationRequest shape", mr.resourceType === "MedicationRequest" && mr.status === "active" && /mg/.test(mr.medicationCodeableConcept.text));
const cr = X.toResource(k("condition")[0], { patientId: "9", fileName: "clinic.pdf", now: Date.now() }); ok("Condition shape (ICD K50)", cr.code.coding[0].code === "K50.9" && cr.clinicalStatus.coding[0].code === "active");

// endoscopy report
const endo = `ENDOSCOPY REPORT
Date of procedure: 2026-09-02
Procedure: Colonoscopy with ileoscopy
Findings: Ulcers in the neoterminal ileum. Mayo endoscopic subscore 2 in the sigmoid. SES-CD 9.
Impression: Active ileocolonic Crohn disease.`;
r = X.fromText(endo, { fileName: "colonoscopy.pdf" });
const pr = k("procedure")[0] || r.items.find((i) => i.kind === "procedure");
ok("procedure detected with date", pr && X.iso(pr.t) === "2026-09-02" && /colonoscopy/i.test(pr.label), pr);
ok("note keeps findings text incl. scores", pr && /SES-CD 9/.test(pr.text) && /Mayo endoscopic subscore 2/.test(pr.text), pr && pr.text);
const prr = X.toResource(pr, { patientId: "9", fileName: "c.pdf", now: Date.now() }); ok("Procedure shape", prr.resourceType === "Procedure" && prr.performedDateTime.startsWith("2026-09-02") && /SES-CD 9/.test(prr.note[0].text));
const dr = X.docResource(endo, { patientId: "9", fileName: "colonoscopy.pdf", now: Date.now() }, r.docT); ok("DocumentReference text/plain base64", dr.content[0].attachment.contentType === "text/plain" && Buffer.from(dr.content[0].attachment.data, "base64").toString().includes("Mayo"));
// imaging
r = X.fromText("CT ABDOMEN AND PELVIS  Report date: 2026-10-01\nFindings: bowel wall thickening.\nImpression: Terminal ileitis, no abscess.", { fileName: "ct.pdf" });
ok("imaging report detected", r.items.some((i) => i.kind === "report" && /terminal ileitis/i.test(i.text)), r.items);
// ambiguity and junk
r = X.fromText("Collected: 03/04/2026\nSodium 140 mmol/L", {}); ok("ambiguous numeric date flagged", r.items[0] && r.items[0].ambiguous === true, r.items);
r = X.fromText("This is a letter about nothing in particular. See you soon.", {}); ok("nothing found in plain letter", r.items.length === 0, r.items);
r = X.fromText("", {}); ok("empty text no crash", r.items.length === 0);
r = X.fromText("Sodium\nPotassium: high\nCreatinine ..... 88 umol/L", {}); ok("name without number ignored, dotted leader ok", r.items.length === 1 && r.items[0].value === 88, r.items);
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
