/* node tests/test_forms_umac.js : Acute Neurology Clinic referral (fillable PDF) is filled into its own fields. MADE-UP patient.
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
const form = window.FORMS.find((f) => f.id === "acuteneuro");
(async () => {
  const blank = await PDFLib.PDFDocument.load(fs.readFileSync(path.join(dir, form.template))), names = new Set(blank.getForm().getFields().map((f) => f.getName()));
  const used = form.sections.flatMap((s) => s.fields).flatMap((f) => [f.acro].concat((f.options || []).map((o) => o.acro))).filter(Boolean);
  ok("every mapped name exists in the PDF", used.every((n) => names.has(n)), used.filter((n) => !names.has(n)));
  ok("every PDF field is mapped", [...names].every((n) => used.includes(n)), [...names].filter((n) => !used.includes(n)));
  ok("no PDF field mapped twice", new Set(used).size === used.length);
  const v = { clinic: "seizure", neurologist: "Dr. Oncall (made-up)", date: "2026-11-22", pages: "3", seizureReq: ["precautions", "driving", "reviewed"],
    last: "Testpatient", first: "Madeup", dob: "1946-03-14", phn: "9999 999 999", ptPhone: "250-555-0100", mrn: "V000123", email: "madeup@example.com", special: "Hard of hearing",
    refName: "Dr. Wayne A. Dong", refMsp: "26301", locum: false, refClinic: form.sections[2].fields[3].value, pcp: "Dr. Family (made-up)", pcpSame: false, copyTo: "Dr. Family (made-up)",
    history: "Made-up patient. First unprovoked GTC seizure 18-Nov, normal CT, Na 138.", onset: "18-Nov-2026", notes: "Discharged home with family.",
    dx_eeg: "ordered", dx_holter: "none", dx_cta: "none", dx_ct: "completed", dx_mri: "ordered", dx_us: "none", dx_other: "completed", otherTest: "ECG", pamphlet: true };
  const r = await gf(PDFLib, fs.readFileSync(path.join(dir, form.template)), form, v);
  if (process.argv[2]) fs.writeFileSync(process.argv[2], r.bytes);
  const f = (await PDFLib.PDFDocument.load(r.bytes)).getForm(), t = (n) => f.getTextField(n).getText(), c = (n) => f.getCheckBox(n).isChecked();
  ok("text: names, DOB dd-Mmm-yyyy, email in Text1, MSP in Text2, date, neurologist, clinic block",
    t("Last name") === "Testpatient" && t("First name") === "Madeup" && t("Date of birth ddMmmyyyy") === "14-Mar-1946" && t("Text1") === "madeup@example.com" && t("Text2") === "26301"
    && t("Date of referral") === "22-Nov-2026" && t("Neurologist Consulted REQUIRED FOR NONER DOCTORS") === "Dr. Oncall (made-up)" && /Hospital Way/.test(t("Clinic Name Street Address Phone STAMP Fax")) && t("MRN optional") === "V000123");
  ok("ticks: First Seizure Clinic + 3 required, EEG/MRI ordered, CT/Other completed, pamphlet; not General or Locum",
    c("FIRST SEIZURE CLINIC") && !c("GENERAL NEUROLOGY") && c("Seizure precautions reviewed with") && c("NO driving until reviewed with") && c("reviewed with patientcaregivers")
    && c("Check Box3") && !c("Check Box4") && c("Check Box8") && c("Check Box13") && !c("Check Box7") && c("Check Box16") && !c("Check Box5") && !c("Check Box11") && c("Patient Pamphlet Given") && !c("Locum") && !c("undefined") && t("Other") === "ECG");
  ok("PDF stays fillable (fields kept), no notes", f.getFields().length === names.size && r.notes.length === 0, r.notes);
  console.log(fail ? fail + " FAILED" : "all passed"); process.exit(fail ? 1 : 0);
})();
