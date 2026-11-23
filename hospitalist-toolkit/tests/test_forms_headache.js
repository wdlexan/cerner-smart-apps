/* node tests/test_forms_umac.js : Complex Headache Clinic referral (fillable PDF, incl. Yes/No radio groups) is filled into its own fields. MADE-UP patient.
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
const form = window.FORMS.find((f) => f.id === "headache");
(async () => {
  const blank = await PDFLib.PDFDocument.load(fs.readFileSync(path.join(dir, form.template))), names = new Set(blank.getForm().getFields().map((f) => f.getName()));
  const used = form.sections.flatMap((s) => s.fields).flatMap((f) => [f.acro].concat((f.options || []).map((o) => o.acro))).filter(Boolean);
  ok("every mapped name exists in the PDF", used.every((n) => names.has(n)), used.filter((n) => !names.has(n)));
  ok("every PDF field is mapped", [...names].every((n) => used.includes(n)), [...names].filter((n) => !used.includes(n)));
  const v = { last: "Testpatient", first: "Madeup", dob: "1980-06-02", phn: "9999 999 999", mrn: "V000124", ptPhone: "250-555-0101", email: "madeup@example.com", special: "",
    refName: "Dr. Wayne A. Dong", refMsp: "26301", locum: false, refClinic: "VGH Hospitalist Service", refPhone: "250-819-0168", refFax: "", refAddress: "1 Hospital Way, Victoria, BC V8Z 6R5",
    pcp: "Dr. Family (made-up)", pcpSame: false, copyTo: "", reason: ["migraine", "high"], frequency: "20 d/month", triedAgents: "yes", eyeExam: "no",
    history: "Made-up patient. Chronic migraine, admitted with status migrainosus.", historyAttached: false, meds: "sumatriptan, naproxen", medsAttached: true,
    completed: ["imaging"], seenNeuro: "no", neuroNotes: false, trialed: ["topiramate", "bb"] };
  const r = await gf(PDFLib, fs.readFileSync(path.join(dir, form.template)), form, v);
  if (process.argv[2]) fs.writeFileSync(process.argv[2], r.bytes);
  const f = (await PDFLib.PDFDocument.load(r.bytes)).getForm(), t = (n) => f.getTextField(n).getText(), c = (n) => f.getCheckBox(n).isChecked(), rg = (n) => f.getRadioGroup(n).getSelected();
  ok("text: names, DOB, MSP, frequency, address", t("Last Name") === "Testpatient" && t("Date of Birth ddMmmyyyy") === "02-Jun-1980" && t("MSP") === "26301" && t("Has patient tried at least 1 abortive  1") === "20 d/month" && /Hospital Way/.test(t("Street Address")));
  ok("radio groups: tried agents Yes, eye exam No, seen neurologist No", rg("cerebrovascular risk factors") === "Yes" && rg("undefined_3") === "No_2" && rg("MANDATORY QUESTION Has patient previously seen a neurologist") === "No_3",
    [rg("cerebrovascular risk factors"), rg("undefined_3"), rg("MANDATORY QUESTION Has patient previously seen a neurologist")]);
  ok("ticks: migraine, high-pressure, MRI/CT, meds attached, topiramate, beta blocker; not others", c("Migraine  Headache Frequency") && c("Highpressure headache") && c("MRICT scan") && c("Attached_2") && c("Topiramate") && c("Propanolol or other beta blocker") && !c("Attached") && !c("Complex Aura") && !c("undefined") && !c("Recent Bloodwork"));
  ok("PDF stays fillable (fields kept), no notes", f.getFields().length === names.size && r.notes.length === 0, r.notes);
  console.log(fail ? fail + " FAILED" : "all passed"); process.exit(fail ? 1 : 0);
})();
