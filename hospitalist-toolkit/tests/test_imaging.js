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
console.log(fail ? fail + " FAILED" : "all passed"); process.exit(fail ? 1 : 0);
