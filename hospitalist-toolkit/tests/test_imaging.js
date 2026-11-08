/* node tests/test_imaging.js : Diagnosis check section 5 (imaging findings, Rigler's triad). Made-up data only. */
const DX = require("../tools/dx/dx.js"), X = require("../pdf-extract.js"), fs = require("fs"), path = require("path");
let fail = 0; const ok = (n, c, x) => { if (!c) fail++; console.log((c ? "ok   " : "FAIL ") + n + (!c && x ? " | " + JSON.stringify(x).slice(0, 400) : "")); };
const now = new Date("2026-11-07T12:00:00").getTime(), H = 36e5;
const base = (o) => Object.assign({ patient: { resourceType: "Patient", id: "p", gender: "female", birthDate: "1960-05-21" }, encounters: [], medRequests: [], medAdmins: [], observations: [], reports: [], orders: [], procedures: [], conditions: [], notes: [], failed: [], pending: [] }, o);
const rep = (text, h) => ({ resourceType: "DiagnosticReport", id: "r" + Math.random(), status: "final", category: [{ coding: [{ code: "imaging" }] }], code: { text: "CT abdomen" }, effectiveDateTime: new Date(now - (h || 72) * H).toISOString(), conclusion: text });
const note = (text, h) => ({ time: now - (h || 48) * H, title: "Progress note", text });
const run = (r) => DX.imagingFindings(DX.buildContext(r, { now, lookbackDays: 7 }));
const titles = (items) => items.map((i) => i.status + ":" + i.title);

// 1. the made-up PDF patient, through the real PDF extractor
const txt = fs.readFileSync(path.join(__dirname, "fixtures/sbo_gallstone_ileus.txt"), "utf8");
const ex = X.fromText(txt, { fileName: "TestPatient_SBO_GallstoneIleus.pdf" });
const ctxB = { patientId: "pdfpt-1", fileName: ex.fileName, now };
const res = ex.items.map((it) => X.toResource(it, ctxB)).filter(Boolean);
const doc = X.docResource(ex.text, ctxB, ex.docT);
let items = run(base({ observations: res.filter((r) => r.resourceType === "Observation"), reports: res.filter((r) => r.resourceType === "DiagnosticReport"),
  conditions: res.filter((r) => r.resourceType === "Condition"), notes: [{ time: new Date(doc.date).getTime(), title: "Imported PDF", text: ex.text }] }));
const t = titles(items);
ok("PDF: Rigler pattern first", /Rigler/.test(t[0]), t);
ok("PDF: pneumobilia unaccounted", t.some((x) => x === "review:Unaccounted: Pneumobilia (air in the bile ducts)"), t);
ok("PDF: gallbladder unaccounted", t.some((x) => x === "review:Unaccounted: Gallbladder absent or not visualized"), t);
const gb = items.find((i) => /Gallbladder/.test(i.title)), pb = items.find((i) => /Pneumobilia/.test(i.title) && /Unaccounted/.test(i.title));
ok("PDF: gallbladder contradiction (never had a cholecystectomy)", gb && /⚠/.test(gb.summary) && gb.evidence.some((e) => /never had a cholecystectomy/i.test(e)), gb);
ok("PDF: pneumobilia contradiction (no ERCP)", pb && pb.evidence.some((e) => /No history of ERCP/i.test(e)), pb);
const rig = items[0];
ok("PDF: ectopic stone sentence found", rig.evidence.some((e) => /intraluminal focus/i.test(e)), rig.evidence);
ok("PDF: clues include failed contrast, no laparotomy, ALP", /contrast/.test(rig.evidence.join(" ")) && /laparotomy/.test(rig.evidence.join(" ")) && /ALP/.test(rig.evidence.join(" ")), rig.evidence);
ok("PDF: notes already name gallstone ileus", /already mentioned/.test(rig.summary));
ok("PDF: checklist 4 items", rig.checklist && rig.checklist.length === 4);

// 2. explained by ERCP -> accounted for, no triad without SBO
items = run(base({ reports: [rep("Pneumobilia, in keeping with prior sphincterotomy. Gallbladder present.")], notes: [note("History: ERCP with sphincterotomy 2023 for choledocholithiasis.")] }));
ok("ERCP explains pneumobilia", titles(items).includes("ok:Accounted for: Pneumobilia (air in the bile ducts)"), titles(items));
ok("no SBO, no Rigler", !titles(items).some((x) => /Rigler/.test(x)));
// 3. cholecystectomy in a Procedure resource explains absent gallbladder
items = run(base({ reports: [rep("Gallbladder surgically absent.")], procedures: [{ resourceType: "Procedure", status: "completed", code: { text: "Laparoscopic cholecystectomy" }, performedDateTime: "2015-03-01" }] }));
ok("Procedure explains gallbladder", titles(items).includes("ok:Accounted for: Gallbladder absent or not visualized"), titles(items));
// 4. negations in the report are not findings
items = run(base({ reports: [rep("No free air. No pneumatosis or portal venous gas. No pneumobilia.")] }));
ok("negated findings ignored", !titles(items).some((x) => /Unaccounted/.test(x)), titles(items));
// 5. free air within days of surgery is accounted for; without, urgent
items = run(base({ reports: [rep("Small amount of free intraperitoneal air.")], notes: [note("POD 2 after laparotomy, recovering.")] }));
ok("free air after surgery accounted", titles(items).some((x) => /^ok:Accounted for: Free/.test(x)), titles(items));
items = run(base({ reports: [rep("Small amount of free intraperitoneal air.")] }));
ok("free air unexplained -> review", titles(items).some((x) => /^review:Unaccounted: Free/.test(x)), titles(items));
// 6. radiology's own assumption does not count as a cause
items = run(base({ reports: [rep("Pneumobilia. Clinical correlation for prior sphincterotomy.")] }));
ok("report's assumption is not a cause", titles(items).some((x) => /^review:Unaccounted: Pneumobilia/.test(x)), titles(items));
// 7. hedged statements listed
items = run(base({ reports: [rep("Small nodule, favoured to represent a lymph node. Cannot exclude early appendicitis.")] }));
ok("hedges listed", items.some((i) => /close the loop/.test(i.title) && i.evidence.length === 2), items);
// 8. nothing -> na
ok("no reports -> na", run(base({}))[0].status === "na");
// 9. evaluate() includes section 5
const ev = DX.evaluate(DX.buildContext(base({ reports: [rep("Pneumobilia.")] }), { now, lookbackDays: 7 }));
ok("section 5 present", ev.sections.some((s) => s.id === "imaging"));

// 10. each added finding: unexplained -> review; explained by a note -> ok; negated -> nothing
const CASES = [
  ["bladderair", "Air in the urinary bladder lumen.", "Foley catheter inserted on admission.", "No air in the bladder."],
  ["organinfarct", "Wedge-shaped hypoenhancing area in the spleen, likely splenic infarct.", "Known atrial fibrillation on apixaban.", "No splenic infarct."],
  ["effusion", "New moderate right pleural effusion.", "Admitted with decompensated heart failure.", "No pleural effusion."],
  ["pulminfarct", "Peripheral wedge-shaped opacity in the right lower lobe.", "Pulmonary embolism diagnosed on admission, on heparin.", "No pulmonary infarct."],
  ["adrenal", "Left adrenal hemorrhage.", "Admitted after a motor vehicle collision (trauma).", "No adrenal hemorrhage."],
  ["collection", "Right psoas abscess measuring 4 cm.", "Day 5 after L4-5 laminectomy.", "No psoas abscess."],
  ["veinclot", "Portal vein thrombosis.", "Known cirrhosis from alcohol.", "No portal vein thrombosis."],
  ["hydro", "Moderate left hydronephrosis.", "Known left ureteric stone, stent placed last month.", "No hydronephrosis."],
  ["bone", "Multiple lytic lesions in the pelvis and femur.", "Known multiple myeloma on treatment.", "No lytic lesions."],
  ["nodes", "Enlarged mediastinal lymph nodes up to 2.3 cm.", "Known lymphoma, in remission.", "No lymphadenopathy."],
  ["brain", "Acute left subdural hematoma, 8 mm.", "Fall with head strike this morning, on apixaban.", "No intracranial hemorrhage."]
];
const label = (id) => DX.IMG_FINDINGS.find((f) => f.id === id).label;
CASES.forEach(([id, finding, cause, neg]) => {
  let it = run(base({ reports: [rep(finding)] }));
  ok(id + ": unexplained -> review", it.some((i) => i.status === "review" && i.title === "Unaccounted: " + label(id)), titles(it));
  it = run(base({ reports: [rep(finding)], notes: [note(cause)] }));
  ok(id + ": cause in a note -> accounted for", it.some((i) => i.status === "ok" && i.title === "Accounted for: " + label(id)), titles(it));
  it = run(base({ reports: [rep(neg)] }));
  ok(id + ": negated -> not flagged", !it.some((i) => i.title.endsWith(label(id))), titles(it));
});
// a negated cause does not account for the finding
let it2 = run(base({ reports: [rep("Moderate left hydronephrosis.")], notes: [note("No history of kidney stones or urinary retention.")] }));
ok("negated cause -> still unaccounted, shown as 'chart says no'", it2.some((i) => /Unaccounted: Hydronephrosis/.test(i.title) && i.evidence.some((e) => /Chart says no/.test(e))), it2);
// small effusions are not flagged
ok("small bilateral effusions not flagged", !run(base({ reports: [rep("Small bilateral pleural effusions.")] })).some((i) => /effusion/i.test(i.title)));
// splenic infarct is not read as a brain infarct
ok("acute splenic infarct is not a brain infarct", !run(base({ reports: [rep("Acute splenic infarct.")] })).some((i) => /brain/i.test(i.title)));

// 11. second made-up PDF patient: hip fracture through a lytic lesion (myeloma missed)
{
  const txt2 = fs.readFileSync(path.join(__dirname, "fixtures/hip_fracture_lytic.txt"), "utf8");
  const ex2 = X.fromText(txt2, { fileName: "TestPatient_HipFracture_Lytic.pdf" }), c2 = { patientId: "pdfpt-2", fileName: ex2.fileName, now };
  const r2 = ex2.items.map((it) => X.toResource(it, c2)).filter(Boolean);
  const it = run(base({ patient: { resourceType: "Patient", id: "p2", gender: "male", birthDate: "1952-02-11" }, observations: r2.filter((r) => r.resourceType === "Observation"),
    reports: r2.filter((r) => r.resourceType === "DiagnosticReport"), conditions: r2.filter((r) => r.resourceType === "Condition"), notes: [{ time: ex2.docT, title: "Imported PDF", text: ex2.text }] }));
  const crab = it[0];
  ok("hip PDF: CRAB pattern first", crab && /CRAB/.test(crab.title), titles(it));
  ok("hip PDF: all five CRAB boxes flagged", crab && crab.checklist.filter((c) => c.state === "missing").length === 5, crab && crab.checklist);
  ok("hip PDF: protein gap 62", crab && crab.checklist.some((c) => /gap 62/.test(c.text)));
  const bone = it.find((i) => /Unaccounted: Lytic/.test(i.title));
  ok("hip PDF: both lytic lesions quoted (rib and fracture site)", bone && bone.evidence.some((e) => /6th rib/.test(e)) && bone.evidence.some((e) => /fracture site/.test(e)), bone && bone.evidence);
  ok("hip PDF: 'No known cancer' shown as chart says no", bone && bone.evidence.some((e) => /Chart says no: .No known cancer/.test(e)), bone && bone.evidence);
  ok("hip PDF: no false contradiction warning", bone && !/⚠/.test(bone.summary), bone && bone.summary);
  ok("hip PDF: no Rigler", !it.some((i) => /Rigler/.test(i.title)));
  ok("hip PDF: small effusion not flagged", !it.some((i) => /effusion/i.test(i.title)));
}
// CRAB needs bone findings plus one feature, or three features
ok("CRAB: lytic lesion alone (normal labs) -> no pattern", !run(base({ reports: [rep("Lytic lesion in the left femur.")], observations: [] })).some((i) => /CRAB/.test(i.title)));

// ---------- 6. Imaging review ----------
const rev = (r) => DX.imagingReview(DX.buildContext(r, { now, lookbackDays: 7 }));
const repD = (name, text, iso, status) => ({ resourceType: "DiagnosticReport", id: "d" + Math.random(), status: status || "final", category: [{ coding: [{ code: "imaging" }] }], code: { text: name }, effectiveDateTime: iso, conclusion: text });
const T = (items) => items.map((i) => i.status + ":" + i.title);
{
  // PDF patients
  const load = (f, g, dob) => { const t = fs.readFileSync(path.join(__dirname, "fixtures/" + f), "utf8"), e = X.fromText(t, { fileName: f }), c = { patientId: "pdfpt", fileName: f, now }, r = e.items.map((it) => X.toResource(it, c)).filter(Boolean);
    return base({ patient: { resourceType: "Patient", id: "p", gender: g, birthDate: dob }, observations: r.filter((x) => x.resourceType === "Observation"), reports: r.filter((x) => x.resourceType === "DiagnosticReport"), conditions: r.filter((x) => x.resourceType === "Condition"), notes: [{ time: e.docT, title: "Imported PDF", text: e.text }] }); };
  let it = rev(load("sbo_gallstone_ileus.txt", "female", "1960-05-21"));
  ok("Gwen: gallbladder seen on 2024 US, absent on CT", T(it).some((x) => /review:⚠ Gallbladder seen on ULTRASOUND.*Mar 12, 2024.*absent on CT/.test(x)), T(it));
  ok("Gwen: note downplays CT", T(it).some((x) => /Note vs. report: “CT: SBO with RLQ transition, otherwise unremarkable/.test(x)), T(it));
  ok("Gwen: timeline has 2 studies (PDF report not duplicated)", T(it).some((x) => /Imaging timeline \(2 studies/.test(x)), T(it));
  ok("Gwen: no wrong-side flag", !T(it).some((x) => /Wrong side/.test(x)));
  it = rev(load("hip_fracture_lytic.txt", "male", "1952-02-11"));
  ok("Harold: rib called old but normal in 2025", T(it).some((x) => /6th rib called “old”, but X-RAY CHEST.*Oct 2, 2025/.test(x)), T(it));
  ok("Harold: T8 age indeterminate vs normal spine", it.some((i) => /T8/.test(i.title) && i.evidence.some((e) => /vertebral body heights/.test(e))), T(it));
  ok("Harold: note 'fracture only, otherwise unremarkable'", T(it).some((x) => /Note vs. report: “X-rays: fracture only/.test(x)), T(it));
  ok("Harold: wrong side (consent right, imaging left)", it.some((i) => /Wrong side\? Note says right hip\/femur, imaging says left/.test(i.title) && i.evidence.some((e) => /Consent signed for right femur/.test(e))), T(it));
  ok("Harold: addendum with no later note", it.some((i) => /Report changed after it was first read/.test(i.title) && i.status === "review" && /No note has been written since/.test(i.summary)), T(it));
  ok("Harold: timeline 3 studies, footer stripped", it.some((i) => /timeline \(3 studies/.test(i.title) && !i.evidence.join(" ").includes("NOT A REAL PERSON")), it.find((i) => /timeline/.test(i.title)));
}
// organ removed with surgery in the chart -> explained
let iv = rev(base({ reports: [repD("US abdomen", "Gallbladder contains stones.", "2023-01-10T10:00:00"), repD("CT abdomen", "Gallbladder surgically absent.", "2026-11-05T10:00:00")], notes: [note("Laparoscopic cholecystectomy in 2024.")] }));
ok("organ absent after surgery -> explained", T(iv).some((x) => /^ok:Explained: Gallbladder/.test(x)), T(iv));
// addendum acknowledged in a later note
iv = rev(base({ reports: [repD("CT head", "No acute findings. ADDENDUM (2026-11-06 08:00): small left subdural hematoma.", "2026-11-05T22:00:00")], notes: [{ time: new Date("2026-11-06T10:00:00").getTime(), title: "Progress note", text: "Radiology addendum reviewed: small subdural, apixaban held." }] }));
ok("addendum acknowledged -> ok", iv.some((i) => /Report changed/.test(i.title) && i.status === "ok"), T(iv));
// preliminary for more than 12 h
iv = rev(base({ reports: [repD("CT chest", "Preliminary: no PE.", new Date(now - 20 * H).toISOString(), "preliminary")] }));
ok("still preliminary after 20 h", T(iv).some((x) => /Still preliminary after 20 h/.test(x)), T(iv));
// ordered but no report
iv = rev(base({ orders: [{ resourceType: "ServiceRequest", status: "active", code: { text: "MRI lumbar spine" }, authoredOn: new Date(now - 40 * H).toISOString() }], reports: [repD("CT abdomen", "Normal.", new Date(now - 30 * H).toISOString())] }));
ok("MRI ordered 40 h ago with no MRI report", T(iv).some((x) => /Ordered, no report found: MRI lumbar spine/.test(x)), T(iv));
// clear chest X-ray with low SpO2
const sat = (v, h) => ({ resourceType: "Observation", id: "s" + h, status: "final", category: [{ coding: [{ code: "vital-signs" }] }], code: { coding: [{ system: "http://loinc.org", code: "59408-5" }], text: "SpO2" }, effectiveDateTime: new Date(now - h * H).toISOString(), valueQuantity: { value: v, unit: "%" } });
iv = rev(base({ reports: [repD("XR chest", "Lungs are clear. No acute cardiopulmonary process.", new Date(now - 10 * H).toISOString())], observations: [sat(86, 6)] }));
ok("clear chest film but SpO2 86", T(iv).some((x) => /Chest imaging “clear” but SpO2 86%/.test(x)), T(iv));
// no discrepancies -> ok + timeline
iv = rev(base({ reports: [repD("XR chest", "Lungs are clear.", new Date(now - 10 * H).toISOString())], observations: [sat(97, 6)] }));
ok("clean -> ok and timeline", iv[0].status === "ok" && T(iv).some((x) => /timeline \(1 study/.test(x)), T(iv));
// section 6 in evaluate
ok("section 6 present", DX.evaluate(DX.buildContext(base({}), { now, lookbackDays: 7 })).sections.some((x) => x.id === "review"));
console.log(fail ? fail + " FAILED" : "all passed"); process.exit(fail ? 1 : 0);
