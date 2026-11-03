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

// ---- patient details for a separate PDF patient ----
const dm = X.demographics("OUTSIDE HOSPITAL REPORT\nPatient: TEST, MADE-UP    DOB: 1946-03-02    Sex: F\nPHN: 9123 456 789   MRN: AB12345\nCollected: 2026-10-12");
ok("demo name last, first", dm.family === "Test" && dm.given === "Made-Up" && dm.name === "Made-Up Test", dm);
ok("demo dob", dm.birthDate === "1946-03-02", dm); ok("demo sex", dm.sex === "female", dm); ok("demo phn", dm.phn === "9123456789", dm); ok("demo mrn", dm.mrn === "AB12345", dm);
ok("demo age from dob", dm.age >= 80 && dm.age <= 81, dm);
const dm2 = X.demographics("Name: John Albert Smith\nAge: 72  Gender: Male");
ok("demo first last", dm2.family === "Smith" && dm2.given === "John Albert", dm2); ok("demo age", dm2.age === 72 && dm2.sex === "male", dm2);
ok("demo none", Object.keys(X.demographics("Hemoglobin 98 g/L")).length === 0);
ok("document date skips DOB line", X.fromText("Patient: TEST, A  DOB: 1946-03-02\nHemoglobin 98 g/L\nReported: 2026-10-12").docT === new Date(2026, 9, 12, 12).getTime());

/* ---- formatted clinical note: two columns, vitals header row, wrapped table cells (MADE-UP patient, layout as pdftotext/layoutLines give it) ---- */
const note = [
  " RIVERSIDE TEST HOSPITAL                                   ADMISSION NOTE",
  " Department of Medicine                                    Date: March 3, 2026",
  "                                                           Time: 09:45",
  "",
  "  Patient Name: Testcase,     MRN: 111-222-33      DOB: 05/06/1950 (75 y/o)     Gender: Female",
  "  Jane",
  "",
  "HISTORY OF PRESENT ILLNESS",
  "",
  "Ms. Testcase is a 75-year-old woman with a history of Parkinson's Disease admitted with confusion. Differential",
  "diagnosis includes sepsis or drug effect.",
  "",
  "PAST MEDICAL HISTORY                          HOME MEDICATIONS",
  "",
  "   Atrial Fibrillation                         Carbidopa/Levodopa: 25/100 mg PO QID",
  "",
  "   Benign Prostatic Hyperplasia                Apixaban: 5 mg PO BID",
  "",
  "PHYSICAL EXAMINATION",
  "",
  " T (Oral)           BP              HR            RR         SpO2",
  "",
  " 38.2 °C            102/64 mmHg     112 bpm       22 bpm     91% on 2 L",
  "",
  "Neuro: confused, rigid.",
  "",
  " Test            Result                          Reference Range   Comment",
  "",
  "                                                 3.5 - 5.0 mmol /",
  " Potassium       5.6 mmol/L                                        High",
  "                                                 L",
  "",
  "                 Cloudy, Nitrite (+),                              Consistent with",
  " Urinalysis                                      Negative",
  "                 WBC > 50/hpf                                      infection",
  "",
  " Serum",
  "                 160 umol/L                      45 - 90 umol/L    AKI",
  " Creatinine",
  "",
  " Chest CT        Right lower lobe consolidation.                   Pneumonia",
  "",
  "ASSESSMENT",
  "",
  "Urinary tract infection with delirium. Acute kidney injury."
];
const nr = X.fromLines(note, { fileName: "note.pdf" }), nI = (k, l) => nr.items.find((i) => i.kind === k && (!l || i.label === l || i.key === l));
const nd = X.demographics(nr.text);
ok("note: name wrapped onto next line", nd.family === "Testcase" && nd.given === "Jane", nd);
ok("note: written date + time", nr.docT === new Date(2026, 2, 3, 9, 45).getTime(), new Date(nr.docT));
ok("note: vitals from header row", nI("vital", "temp").value === 38.2 && nI("vital", "bp").value === 102 && nI("vital", "hr").value === 112 && nI("vital", "rr").value === 22 && nI("vital", "spo2").value === 91, nr.items.filter((i) => i.kind === "vital"));
ok("note: right-column meds", nI("med", "Carbidopa/Levodopa") && /25\/100 mg PO QID/.test(nI("med", "Carbidopa/Levodopa").text) && nI("med", "Apixaban"), nr.items.filter((i) => i.kind === "med"));
ok("note: left-column history", nI("condition", "Atrial fibrillation") && nI("condition", "Benign prostatic hyperplasia") && nI("condition", "Parkinson disease"), nr.items.filter((i) => i.kind === "condition").map((i) => i.label));
ok("note: assessment diagnoses", nI("condition", "Urinary tract infection") && nI("condition", "Delirium") && nI("condition", "Acute kidney injury"));
ok("note: differential across a line break is not a diagnosis", !nI("condition", "Sepsis"));
ok("note: wrapped table row (Serum / Creatinine)", nI("lab", "creat") && nI("lab", "creat").value === 160 && nI("lab", "creat").low === 45, nI("lab", "creat"));
ok("note: range and unit split over lines", nI("lab", "k") && nI("lab", "k").value === 5.6 && nI("lab", "k").high === 5, nI("lab", "k"));
ok("note: urine WBC per hpf never read as blood WBC", !nI("lab", "wbc"), nI("lab", "wbc"));
ok("note: imaging row", nI("report") && nI("report").label === "Chest CT" && /consolidation/.test(nI("report").text), nI("report"));
ok("units: x10^3/µL read as x10^9/L", X.fromText("WBC  12.8 x10^3 / µL  4.5 - 11.0").items[0].unit === "x10^9/L");
ok("urine line skipped", X.fromText("Urine sodium 20 mmol/L").items.filter((i) => i.kind === "lab").length === 0);
ok("page title row is not two columns", X.structure(["HOSPITAL NAME HERE            ADMISSION NOTE", "  Name: A, B     MRN: 1     DOB: 2000-01-01"]).some((l) => /Name: A, B\s+MRN/.test(l)));
// layoutLines from pdf.js-style items: columns kept, wide gap = new row group
const ll = X.layoutLines([[{ s: "Sodium", x: 50, y: 700, w: 30, h: 9 }, { s: "124 mmol/L", x: 150, y: 700, w: 45, h: 9 }, { s: "Next row", x: 50, y: 680, w: 40, h: 9 }]]);
ok("layoutLines columns and row gap", /^Sodium\s{3,}124 mmol\/L$/.test(ll[0]) && ll[1] === "" && ll[2] === "Next row", ll);

const hm = X.fromText("HOME MEDICATIONS\nPramipexole: 0.5 mg PO TID\nRopinirole 1 mg PO TID\nPLAN\nHold dopamine agonist (Pramipexole) for hallucinations.\nStarted IV Ceftriaxone 1g daily.").items.filter((i) => i.kind === "med");
ok("med held per note", hm.find((i) => i.label === "Pramipexole").held === true && !hm.find((i) => i.label === "Ropinirole").held, hm);
ok("med route before name kept", /Ceftriaxone 1 g IV daily/.test(hm.find((i) => i.label === "Ceftriaxone").text), hm.find((i) => i.label === "Ceftriaxone"));
const hr = X.toResource(Object.assign({}, hm[0], { held: true }), { fileName: "f", patientId: "p", now: 0 });
ok("held med -> on-hold order, text once", hr.status === "on-hold" && !hr.dosageInstruction && /0\.5 mg/.test(hr.medicationCodeableConcept.text), hr);
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
