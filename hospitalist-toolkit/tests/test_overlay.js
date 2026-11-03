/* node test_overlay.js : tests how imported items are matched to FHIR searches. */
const store = {}; global.sessionStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => (store[k] = v) };
global.window = global; global.document = { body: null, addEventListener() {} };
const X = require("../pdf-extract.js"); require("../pdf-overlay.js");
const T = window.__pdfOverlayTest; let pass = 0, fail = 0; const ok = (n, c, x) => { console.log((c ? "PASS " : "FAIL ") + n + (!c && x ? " | " + JSON.stringify(x).slice(0, 200) : "")); c ? pass++ : fail++; };
const r = X.fromText("Collected: 2026-10-12\nHemoglobin 98 g/L 130 - 170 L\nC-Reactive Protein 78 mg/L\nAdalimumab 40 mg subcut every 2 weeks\nBP 118/72 HR 78\nDiagnosis: Crohn disease", { fileName: "f.pdf" });
const items = r.items.map((it) => X.toResource(it, { patientId: "p1", fileName: "f.pdf", now: Date.now() }));
store["pdfimport:p1"] = JSON.stringify({ items, files: [] });
const st = T.load("p1"); const m = (url) => st.items.filter((x) => T.parse(url) && x.resourceType === T.parse(url).type && T.matches(x, T.parse(url)));
ok("parse ignores non-search", T.parse("Binary/123") === null && T.parse("Observation/123") === null && T.parse("https://x/fhir/r4/Observation?patient=1").type === "Observation");
ok("lab category search returns labs only", m("Observation?patient=p1&category=laboratory").length === 2, m("Observation?patient=p1&category=laboratory"));
ok("vital-signs category returns BP and HR", m("Observation?patient=p1&category=vital-signs").length === 2);
ok("code search matches LOINC", m("Observation?patient=p1&code=http://loinc.org|718-7,http://loinc.org|2160-0").length === 1);
ok("code search with no match returns none", m("Observation?patient=p1&code=http://loinc.org|2160-0").length === 0);
ok("date ge in the past includes", m("Observation?patient=p1&category=laboratory&date=ge2026-01-01").length === 2);
ok("date ge in the future excludes", m("Observation?patient=p1&category=laboratory&date=ge2027-01-01").length === 0);
ok("date le before excludes", m("Observation?patient=p1&category=laboratory&date=le2026-10-01").length === 0);
ok("MedicationRequest active", m("MedicationRequest?patient=p1&status=active").length === 1 && m("MedicationRequest?patient=p1&status=completed").length === 0);
ok("Condition problem-list category", m("Condition?patient=p1&category=problem-list-item").length === 1 && m("Condition?patient=p1&category=encounter-diagnosis").length === 0);
const flat = T.merge([{ id: "a", resourceType: "Observation" }], "Observation?patient=p1&category=laboratory", st); ok("merge into flat array", flat.length === 3);
const bun = T.merge({ resourceType: "Bundle", entry: [] }, "Observation?patient=p1&category=laboratory", st); ok("merge into Bundle", bun.entry.length === 2);
ok("no duplicate ids on repeat", T.merge(flat, "Observation?patient=p1&category=laboratory", st).length === 3);
ok("non-search left alone", T.merge("text", "Binary/1", st) === "text");
ok("Condition has no onsetDateTime", !items.find((x) => x.resourceType === "Condition").onsetDateTime);

// ---- PDF-only patient (ID starts with pdfpt-) ----
ok("LOCAL detects pdfpt ids", T.LOCAL("pdfpt-abc") && !T.LOCAL("12724066") && !T.LOCAL(null));
const litems = r.items.map((it) => X.toResource(it, { patientId: "pdfpt-1", fileName: "f.pdf", now: Date.now() }));
const lst = { items: litems, files: [], patient: { resourceType: "Patient", id: "pdfpt-1", name: [{ text: "Made-Up Test", family: "Test", given: ["Made-Up"] }], gender: "female", birthDate: "1946-03-02" } };
ok("local Patient read", T.localResult("Patient/pdfpt-1", {}, lst, "pdfpt-1").name[0].family === "Test");
ok("local Patient read via object arg", T.localResult({ url: "Patient/pdfpt-1" }, {}, lst, "pdfpt-1").gender === "female");
ok("local lab search flat", T.localResult("Observation?patient=pdfpt-1&category=laboratory", { flat: true }, lst, "pdfpt-1").length === 2);
ok("local search as Bundle", T.localResult("Observation?patient=pdfpt-1&category=vital-signs", {}, lst, "pdfpt-1").entry.length === 2);
ok("local search pageLimit>1 gives array of bundles", Array.isArray(T.localResult("Observation?patient=pdfpt-1", { pageLimit: 5 }, lst, "pdfpt-1")));
ok("local unknown type empty", T.localResult("Encounter?patient=pdfpt-1", { flat: true }, lst, "pdfpt-1").length === 0 && T.localResult("MedicationAdministration?patient=pdfpt-1", { flat: true }, lst, "pdfpt-1").length === 0);
ok("local read by id", T.localResult("Observation/" + litems[0].id, {}, lst, "pdfpt-1").id === litems[0].id);
let threw = false; try { T.localResult("Observation/nope", {}, lst, "pdfpt-1"); } catch (e) { threw = e.status === 404; } ok("local missing read 404", threw);
// wrap: a pdfpt client never calls the server
store["pdfimport:pdfpt-1"] = JSON.stringify(lst);
let serverCalls = 0; const fake = { request: () => { serverCalls++; return Promise.resolve([]); }, patient: { id: "pdfpt-1" } };
fake.patient.read = () => fake.request({ url: "Patient/pdfpt-1" }); T.wrap(fake);
Promise.all([fake.request("Observation?patient=pdfpt-1&category=laboratory", { flat: true }), fake.patient.read()]).then(([labs, pt]) => {
  ok("wrapped local search", labs.length === 2); ok("wrapped patient read", pt.id === "pdfpt-1"); ok("no server calls", serverCalls === 0);
  // a real patient still goes to the server and gets merged items
  let real = 0; const fr = { request: () => { real++; return Promise.resolve([{ id: "srv", resourceType: "Observation" }]); }, patient: { id: "p1" } }; T.wrap(fr);
  return fr.request("Observation?patient=p1&category=laboratory", { flat: true }).then((res) => { ok("real patient hits server and merges", real === 1 && res.length === 3); });
}).then(() => { console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0); });

