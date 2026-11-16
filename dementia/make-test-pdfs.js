/* node make-test-pdfs.js  → writes test-pdfs/<n>_<key>.txt (chart-extract text in the toolkit fixture format).
   Then: python3 make-test-pdfs.py  → turns each .txt into a PDF for the Hospitalist Toolkit "Import PDF" button.
   All patients are MADE-UP (demo-patients.js). Dates are counted back from BASE. */
const fs = require("fs"), path = require("path");
const DEMOS = require("./demo-patients.js");
const BASE = new Date(process.argv[2] || "2026-11-15T08:00:00");
const day = (n, hm = "09:00") => { const d = new Date(BASE - n * 864e5); return d.toISOString().slice(0, 10) + " " + hm; };
const pad = (s, n) => String(s).padEnd(n);
const wrap = (t, w = 92) => t.trim().split(/\s+/).reduce((a, word) => { if ((a[a.length - 1] + " " + word).trim().length > w) a.push(word); else a[a.length - 1] = (a[a.length - 1] + " " + word).trim(); return a; }, [""]).join("\n");
const out = path.join(__dirname, "test-pdfs"); fs.mkdirSync(out, { recursive: true });
DEMOS.forEach((P, i) => {
  const age = Math.floor((BASE - new Date(P.birthDate)) / 31557600000), foot = `MADE-UP TEST PATIENT - NOT A REAL PERSON | ${P.family}, ${P.given} MRN ${P.mrn}`;
  const L = [];
  L.push("PATIENT CHART EXTRACT - VICTORIA GENERAL HOSPITAL (TEST)", "MADE-UP TEST PATIENT - NOT A REAL PERSON - FOR SANDBOX TESTING ONLY");
  L.push(`Patient: ${P.family}, ${P.given}`.padEnd(42) + `DOB: ${P.birthDate}     Sex: ${P.sex === "male" ? "M" : "F"}`);
  L.push(`MRN: ${P.mrn}`.padEnd(42) + `Age: ${age}`, `Admitted: ${day(Math.max(...P.docs.map(d => d.d)), "").trim()} (Hospitalist)`, "");
  P.docs.slice().sort((a, b) => b.d - a.d).forEach((d, k) => {
    L.push(d.title.toUpperCase(), `Date of service: ${day(d.d, k ? "08:30" : "14:10")}`, wrap(d.text));
    L.push(`${day(d.d, "08:00")} BP: ${P.bp} HR: ${P.hr} RR: 16 Temp: 36.8 C SpO2: 96% Weight: ${P.wt} kg`, "");
  });
  L.push("LABORATORY RESULTS", `Collected: ${day(1, "05:30")}`, "Test                      Result           Units           Reference       Flag", "");
  P.labs.forEach(([n, , v, u, lo, hi]) => L.push(pad(n, 30) + pad(v, 17) + pad(u, 16) + pad(`${lo} - ${hi}`, 16) + (v < lo ? "L" : v > hi ? "H" : "")));
  L.push("", `ACTIVE MEDICATION ORDERS (${day(0, "").trim()})`, ...P.meds, "", "ACTIVE PROBLEM LIST", ...P.conds, "", "", "", foot + "         Page 1", "RADIOLOGY REPORTS");
  P.imaging.forEach(im => {
    const [f, imp] = im.text.split(/IMPRESSION:\s*/);
    L.push(im.title, `Date of exam: ${day(im.d, "11:00")}`, "FINDINGS:", wrap(f.replace(/^FINDINGS:\s*/, "")), "IMPRESSION:", wrap(imp || ""), "");
  });
  L.push("", "", foot + "         Page 2");
  fs.writeFileSync(path.join(out, `${String(i + 1).padStart(2, "0")}_${P.key}_${P.given}.txt`), L.join("\n") + "\n");
});
console.log("wrote", DEMOS.length, "files to", out);
