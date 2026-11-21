/* node tests/test_forms_hfc.js : Heart Function Clinic referral (fillable PDF) is filled into its own fields. MADE-UP patient.
   Needs pdf-lib (npm i pdf-lib, or a global copy); skipped if not installed. */
const fs = require("fs"), path = require("path");
let PDFLib; for (const p of ["pdf-lib", "/opt/npm-tools/node_modules/pdf-lib"]) { try { PDFLib = require(p); break; } catch (e) {} }
if (!PDFLib) { console.log("skipped: pdf-lib not installed"); process.exit(0); }
const dir = path.join(__dirname, "../tools/forms"), src = fs.readFileSync(path.join(dir, "app.js"), "utf8");
const grab = (a, b) => src.slice(src.indexOf(a), src.indexOf(b, src.indexOf(a)));
global.window = {}; eval(fs.readFileSync(path.join(dir, "forms.js"), "utf8"));
eval(["const MONTHS = " + /const MONTHS = (\[[^\]]+\])/.exec(src)[1], "const PAGE_H = 792;", grab("function fmtDate", "\n}\n") + "\n}", grab("function cleanText", "\n}\n") + "\n}",
  "const allFields = (form) => form.sections.flatMap((s) => s.fields);", grab("function wrapText", "\n}\n") + "\n}", grab("async function genericFill", "// ---------- create the PDF"), "global.gf = genericFill;"].join("\n"));
let fail = 0; const ok = (n, c, x) => { console.log((c ? "PASS " : "FAIL ") + n + (!c && x ? " | " + JSON.stringify(x).slice(0, 200) : "")); if (!c) fail++; };
const form = window.FORMS.find((f) => f.id === "hfc");
(async () => {
  const blank = await PDFLib.PDFDocument.load(fs.readFileSync(path.join(dir, form.template))), names = new Set(blank.getForm().getFields().map((f) => f.getName()));
  const used = form.sections.flatMap((s) => s.fields).flatMap((f) => [f.acro].concat((f.options || []).map((o) => o.acro))).filter(Boolean);
  ok("every mapped name exists in the PDF", used.every((n) => names.has(n)), used.filter((n) => !names.has(n)));
  const v = { date: "2026-11-21", urgency: "urgent", clinic: "victoria", source: "ed", rereferral: "no", patientName: "Madeup Testpatient", dob: "1946-03-14", phn: "9999 999 999", refName: "Dr. Wayne A. Dong", refMsp: "26301", refPhone: "250-819-0168", question: "Please help with GDMT titration.", required: ["echo", "meds"], outside: [], amyloid: ["pyp"] };
  const r = await gf(PDFLib, fs.readFileSync(path.join(dir, form.template)), form, v);
  const f = (await PDFLib.PDFDocument.load(r.bytes)).getForm(), t = (n) => f.getTextField(n).getText(), c = (n) => f.getCheckBox(n).isChecked();
  ok("text fields filled (date dd-Mmm-yyyy, name, MSP in Text1)", t("Referral Date ddMmmyyyy") === "21-Nov-2026" && t("Patient Name") === "Madeup Testpatient" && t("Date of birth ddMmmyyyy") === "14-Mar-1946" && t("Text1") === "26301");
  ok("ticks: URGENT, Victoria, ED/Hospital, re-referral No, echo, meds, PYP; not semi-urgent or labs", c("Check Box2") && c("Victoria Heart Function Clinic") && c("EDHospital") && c("undefined_2") && c("Echocardiogram in past 6 months") && c("Current medication list") && c("Technetium PYP Scan") && !c("Check Box3") && !c("CBC urea creatinine eGFR Na K BNPNTproBNP in the past 3 months") && !c("undefined"));
  ok("PDF stays fillable (fields kept)", f.getFields().length === names.size && r.notes.length === 0, r.notes);
  console.log(fail ? fail + " FAILED" : "all passed"); process.exit(fail ? 1 : 0);
})();
