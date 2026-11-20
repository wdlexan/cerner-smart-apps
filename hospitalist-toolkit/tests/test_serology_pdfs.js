/* node test_serology_pdfs.js : the made-up Autoimmune serology chart extracts, read by the PDF importer and fed to the serology engine. */
const path = require("path"), fs = require("fs");
const X = require("../pdf-extract.js"), E = require("../tools/serology/engine.js"); require("../tools/serology/criteria.js");
const dir = path.join(__dirname, "../../autoimmune-serology/test-pdfs"), cases = JSON.parse(fs.readFileSync(path.join(dir, "cases.json")));
let pass = 0, fail = 0; const ok = (n, c, x) => { console.log((c ? "PASS " : "FAIL ") + n + (!c && x ? " | " + JSON.stringify(x).slice(0, 400) : "")); c ? pass++ : fail++; };
for (const k of cases) {
  const r = X.fromText(fs.readFileSync(path.join(dir, k.file + ".txt"), "utf8"), { fileName: k.file + ".pdf" });
  const res = r.items.map((it) => X.toResource(it, { patientId: "t", fileName: k.file, now: Date.now() })).filter(Boolean);
  const obs = res.filter((x) => x.resourceType === "Observation");
  const meds = res.filter((x) => x.resourceType === "MedicationRequest").map((m) => (m.medicationCodeableConcept || {}).text || "");
  const F = {}; res.filter((x) => x.resourceType === "Condition").forEach((c) => E.CONDITION_MAP.forEach(([re, f]) => { if (re.test(c.code.text)) F[f] = true; }));
  const { S } = E.stateFromObservations(obs);
  const R = E.evaluate(S, F, { age: k.age, sex: k.sex === "F" ? "female" : "male", meds });
  const meets = R.cards.filter((c) => c.verdict === "meets").map((c) => c.key);
  const card = R.cards.find((c) => c.key === k.expect);
  if (k.expect) ok(`${k.label}: ${k.expect} ${k.verdict}`, card && card.verdict === k.verdict, { meets, S: Object.fromEntries(Object.entries(S).map(([a, b]) => [a, b.v])), F, meds });
  else ok(`${k.label}: nothing meets`, meets.length === 0, { meets, S: Object.fromEntries(Object.entries(S).map(([a, b]) => [a, b.v])) });
}
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
