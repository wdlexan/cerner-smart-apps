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
console.log(fail ? fail + " FAILED" : "all passed"); process.exit(fail ? 1 : 0);
