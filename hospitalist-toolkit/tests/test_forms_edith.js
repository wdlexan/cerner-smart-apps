/* node tests/test_forms_edith.js [out.pdf] : EDITH (HLTH 3987 Notification of Expected Death in the Home) fillable PDF. MADE-UP patient.
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
const form = window.FORMS.find((f) => f.id === "edith");
(async () => {
  const blank = await PDFLib.PDFDocument.load(fs.readFileSync(path.join(dir, form.template)));
  const names = new Set(blank.getForm().getFields().filter((f) => !(f instanceof PDFLib.PDFButton)).map((f) => f.getName())); // skip the Print / Clear Form buttons
  const used = form.sections.flatMap((s) => s.fields).flatMap((f) => [].concat(f.acro || [], f.acroDate || [], (f.options || []).map((o) => o.acro))).filter(Boolean);
  ok("every mapped name exists in the PDF", used.every((n) => names.has(n)), used.filter((n) => !names.has(n)));
  ok("every PDF field is mapped", [...names].every((n) => used.includes(n)), [...names].filter((n) => !used.includes(n)));
  const pr = form.sections[2].fields;
  ok("practitioner address split from config", pr[3].value === "1 Hospital Way" && pr[4].value === "Victoria" && pr[5].value === "BC" && pr[6].value === "V8Z 6R5", pr.slice(3, 7).map((f) => f.value));
  const v = { fhName: "Madeup Funeral Chapel", fhAddress: "1 Nowhere Rd", fhCity: "Victoria", fhProvince: "BC", fhPostal: "V0V 0V0",
    patientName: "Madeup Testpatient", gender: "female", dob: "1938-03-04", phn: "9999 999 999", address: "123 Fake St", city: "Victoria", province: "BC", postal: "V8V 1A1",
    precautions: "Pacemaker in situ. MRSA colonized.", pracName: "Dr. Wayne A. Dong", pracCollege: "21341", pracPhone: "250-819-0168",
    pracAddress: pr[3].value, pracCity: pr[4].value, pracProvince: pr[5].value, pracPostal: pr[6].value,
    comments: "Made-up patient. Metastatic cancer, DNR, expected natural death.", signedDate: "2026-11-26", relationship: "b", authName: "Madeup Spouse", authPhone: "250-555-0100" };
  const r = await gf(PDFLib, fs.readFileSync(path.join(dir, form.template)), form, v);
  if (process.argv[2]) fs.writeFileSync(process.argv[2], r.bytes);
  const f = (await PDFLib.PDFDocument.load(r.bytes)).getForm(), t = (n) => f.getTextField(n).getText(), c = (n) => f.getCheckBox(n).isChecked();
  ok("funeral home + patient name printed twice", t("Funeral Home Name") === "Madeup Funeral Chapel" && t("Patient Name") === "Madeup Testpatient" && t("Authorized Person") === "Madeup Testpatient");
  ok("DOB split DD / MM / YYYY", t("Patient DOB Day") === "04" && t("Patient DOB Month") === "03" && t("Patient DOB Year") === "1938");
  ok("signed date split", t("Practitioner Signed Day") === "26" && t("Practitioner Signed Month") === "11" && t("Practitioner Signed Year") === "2026");
  ok("practitioner details", t("Practitioner Name") === "Dr. Wayne A. Dong" && t("Practitioner College ID") === "21341" && t("Practitioner Phone") === "250-819-0168" && t("Practitioner Postal Code") === "V8Z6R5", ["Practitioner Name", "Practitioner Postal Code"].map(t));
  ok("limited boxes squeezed: PHN 10 digits, postal 6", t("Patient PHN") === "9999999999" && t("Patient Postal Code") === "V8V1A1" && t("Funeral Home Postal Code") === "V0V0V0");
  const g = f.getField("Gender").acroField; ok("gender F ticked, M not", String(g.dict.get(PDFLib.PDFName.of("V"))) === "/Female" && g.getWidgets().map((w) => String(w.getAppearanceState())).join() === "/Off,/Female");
  ok("spouse ticked, others not", c("Relationship to Deceased - Spouse") && !c("Relationship to Deceased - Personal Representative") && !c("Relationship to Deceased - Parent"));
  ok("PDF stays fillable, no notes", f.getFields().length === blank.getForm().getFields().length && r.notes.length === 0, r.notes);
  console.log(fail ? fail + " FAILED" : "all passed"); process.exit(fail ? 1 : 0);
})();
