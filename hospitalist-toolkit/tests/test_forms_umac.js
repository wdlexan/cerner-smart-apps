/* node tests/test_forms_umac.js : UMAC referral (fillable PDF) is filled into its own fields. MADE-UP patient.
   Needs pdf-lib (npm i pdf-lib, or a global copy); skipped if not installed. */
const fs = require("fs"), path = require("path");
let PDFLib; for (const p of ["pdf-lib", "/opt/npm-tools/node_modules/pdf-lib"]) { try { PDFLib = require(p); break; } catch (e) {} }
if (!PDFLib) { console.log("skipped: pdf-lib not installed"); process.exit(0); }
const dir = path.join(__dirname, "../tools/forms"), src = fs.readFileSync(path.join(dir, "app.js"), "utf8");
const grab = (a, b) => src.slice(src.indexOf(a), src.indexOf(b, src.indexOf(a)));
global.window = {}; eval(fs.readFileSync(path.join(dir, "config.js"), "utf8")); eval(fs.readFileSync(path.join(dir, "forms.js"), "utf8"));
eval(["const MONTHS = " + /const MONTHS = (\[[^\]]+\])/.exec(src)[1], "const PAGE_H = 792;", grab("function fmtDate", "\n}\n") + "\n}", grab("function cleanText", "\n}\n") + "\n}",
  "const allFields = (form) => form.sections.flatMap((s) => s.fields);", grab("function wrapText", "\n}\n") + "\n}", grab("async function genericFill", "// ---------- create the PDF"), "global.gf = genericFill;"].join("\n"));
let fail = 0; const ok = (n, c, x) => { console.log((c ? "PASS " : "FAIL ") + n + (!c && x ? " | " + JSON.stringify(x).slice(0, 200) : "")); if (!c) fail++; };
const form = window.FORMS.find((f) => f.id === "umac");
(async () => {
  const blank = await PDFLib.PDFDocument.load(fs.readFileSync(path.join(dir, form.template))), names = new Set(blank.getForm().getFields().map((f) => f.getName()));
  const used = form.sections.flatMap((s) => s.fields).flatMap((f) => [f.acro].concat((f.options || []).map((o) => o.acro))).filter(Boolean);
  ok("every mapped name exists in the PDF", used.every((n) => names.has(n)), used.filter((n) => !names.has(n)));
  ok("every PDF field is mapped", [...names].every((n) => used.includes(n)), [...names].filter((n) => !used.includes(n)));
  const reason = form.sections[3].fields[0].options.find((o) => o.value.startsWith("A: Venous")).value;
  const v = { date: "2026-11-22", urgency: "a", refType: "hospital", priority: "first", last: "Testpatient", first: "Madeup", dob: "1946-03-14", phn: "9999 999 999", ptPhone: "250-555-0100", gender: "female",
    address: "123 Fake St, Victoria, BC V8V 1A1", refName: "Dr. Wayne A. Dong", refMsp: "26301", clinic: form.sections[2].fields[3].value, reason, details: "Made-up patient. New PE on apixaban, discharged today; please reassess in 1-2 weeks.",
    alerts: ["mobility", "language"], languageSpec: "Punjabi", docs: "pending", pendingSpec: "CT report", pmh: "attached", meds: "attached" };
  const r = await gf(PDFLib, fs.readFileSync(path.join(dir, form.template)), form, v);
  if (process.argv[2]) fs.writeFileSync(process.argv[2], r.bytes);
  const f = (await PDFLib.PDFDocument.load(r.bytes)).getForm(), t = (n) => f.getTextField(n).getText(), c = (n) => f.getCheckBox(n).isChecked();
  ok("text: date, names, DOB dd-Mmm-yyyy, MSP in Text1, clinic block", t("Date of Referral") === "22-Nov-2026" && t("Last name") === "Testpatient" && t("First name") === "Madeup" && t("Date of birth ddMmmyyyy") === "14-Mar-1946" && t("Text1") === "26301" && /Hospital Way/.test(t("Clinic Name Street Address Phone STAMP Fax")));
  ok("reason prints as text", t("Reason for referral selected ONLY from page 2") === reason);
  ok("ticks: F, URGENT A, Hospital, first available, mobility, language, pending, PMH/meds attached; not M or ED", c("undefined_2") && c("URGENT A") && c("Hospital") && c("undefined_4") && c("Mobility Impairment") && c("Language Barrier") && c("Pending") && c("Attached_2") && c("Attached_3") && !c("undefined") && !c("Hospital ED") && !c("Attached") && t("Text2") === "Punjabi" && t("Text4") === "CT report");
  ok("PDF stays fillable (fields kept), no notes", f.getFields().length === names.size && r.notes.length === 0, r.notes);
  console.log(fail ? fail + " FAILED" : "all passed"); process.exit(fail ? 1 : 0);
})();
