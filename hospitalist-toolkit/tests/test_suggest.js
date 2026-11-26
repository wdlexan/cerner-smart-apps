/* node tests/test_suggest.js */
const R = require("../suggest-rules.js");
let fail = 0;
const ok = (n, c, extra) => { if (!c) fail++; console.log((c ? "ok   " : "FAIL ") + n + (c || !extra ? "" : "  -> " + extra)); };
const keys = (list) => list.map((x) => x.key);
const top = (list, n) => keys(list).slice(0, n || 3);

// ---- typed questions ----
let r = R.ask("Na 121 and confused, on HCTZ");
ok("Na 121 -> sodium tab first", (r[0] || {}).key === "hypona", top(r));
ok("Na 121 reason shows the value", /Sodium 121/.test(r[0].reasons.map((x) => x.text).join()), JSON.stringify(r[0].reasons));
ok("confused -> dementia/delirium also listed", keys(r).includes("dementia"), keys(r));
r = R.ask("which antibiotic for cellulitis with penicillin allergy");
ok("cellulitis + pen allergy -> antibiotic chooser first", (r[0] || {}).key === "abxmap", top(r));
r = R.ask("how much potassium do I give, K 2.9");
ok("K 2.9 -> electrolytes first", (r[0] || {}).key === "lytes", top(r));
r = R.ask("creatinine went from 80 to 190, low urine output");
ok("creatinine rise words -> AKI", (r[0] || {}).key === "aki", top(r));
r = R.ask("trop 85 chest pain, do they need DAPT?");
ok("trop + chest pain -> NSTEMI first", (r[0] || {}).key === "acs", top(r));
r = R.ask("SOB, leg swelling, NT-proBNP 4200, how much lasix");
ok("CHF words + BNP -> CHF first", (r[0] || {}).key === "chf", top(r));
r = R.ask("pH 7.18 HCO3 9 anion gap");
ok("acidosis -> acid-base first", (r[0] || {}).key === "acidbase", top(r));
r = R.ask("cirrhotic with tense ascites, should I tap for SBP");
ok("ascites -> liver first", (r[0] || {}).key === "liver", top(r));
r = R.ask("patient not improving, what am I missing");
ok("not improving -> diagnosis check", (r[0] || {}).key === "dx", top(r));
r = R.ask("which meds should I stop in this 88 year old");
ok("stop meds -> deprescribing", (r[0] || {}).key === "deprx", top(r));
r = R.ask("pleural effusion, when do I pull the chest tube");
ok("chest tube -> pleural", (r[0] || {}).key === "pleural", top(r));
r = R.ask("new onset seizure, can he drive");
ok("seizure + drive -> seizure", (r[0] || {}).key === "seizure", top(r));
r = R.ask("hip fracture going to OR tomorrow on apixaban");
ok("hip fracture -> hip pathway", (r[0] || {}).key === "hip", top(r));
r = R.ask("drowsy after hydromorphone, RR 8");
ok("drowsy on hydromorphone -> opioid safety", (r[0] || {}).key === "opioid", top(r));
ok("nothing typed -> nothing", R.ask("").length === 0);
ok("gibberish -> nothing", R.ask("zzqx blorp").length === 0);

// ---- negation in ER notes ----
r = R.ask("Denies chest pain. No fever. Presents with vomiting and distension, small bowel obstruction on CT.");
ok("denied chest pain not counted", !keys(r).includes("acs"), keys(r));
ok("SBO counted", (r[0] || {}).key === "sbo", top(r));

// ---- typed lab parsing and units ----
let L = R.labsFromText("Cr 2.1 mg/dL, glucose 450, trop 0.12, Hb 7.9");
ok("creat mg/dL -> µmol/L", Math.round(L.creat[0].v) === 186, L.creat[0].v);
ok("glucose 450 -> 25 mmol/L", Math.round(L.glucose[0].v) === 25, L.glucose[0].v);
ok("trop 0.12 ng/mL -> 120 ng/L", Math.round(L.trop[0].v) === 120, L.trop[0].v);
ok("Hb 7.9 g/dL -> 79 g/L", Math.round(L.hgb[0].v) === 79, L.hgb[0].v);
ok("40 mg furosemide is not a magnesium", !R.labsFromText("furosemide 40 mg IV BID").mg);

// ---- chart facts (FHIR) ----
const obs = (code, v, unit, daysAgo, display) => ({ resourceType: "Observation", status: "final", code: { coding: [{ system: "http://loinc.org", code, display }], text: display },
  valueQuantity: { value: v, unit }, effectiveDateTime: new Date(Date.now() - (daysAgo || 0) * 864e5).toISOString() });
const labs = R.labsFromObs([obs("2951-2", 124, "mmol/L", 0, "Sodium"), obs("2160-0", 160, "umol/L", 0, "Creatinine"), obs("2160-0", 85, "umol/L", 3, "Creatinine"),
  obs("33762-6", 5200, "ng/L", 0, "NT-proBNP"), obs("2823-3", 4.1, "mmol/L", 0, "Potassium"), obs("xx", 7.25, "", 0, "pH Venous")]);
r = R.suggest({ labs, conditions: ["Heart failure with reduced ejection fraction", "Type 2 diabetes mellitus"], meds: ["Hydromorphone 1 mg PO q4h PRN", "Insulin glargine 20 units", "Furosemide 40 mg IV"], age: 84 });
const k = keys(r);
ok("chart: sodium", k.includes("hypona"), k);
ok("chart: AKI from 85 -> 160", k.includes("aki") && /up from 85/.test(r.find((x) => x.key === "aki").reasons[0].text), JSON.stringify(r.find((x) => x.key === "aki")));
ok("chart: CHF from problem + BNP ranks first", (r[0] || {}).key === "chf", top(r));
ok("chart: normal K -> no electrolytes", !k.includes("lytes"), k);
ok("chart: pH by name", k.includes("acidbase"), k);
ok("chart: opioid", k.includes("opioid"), k);
ok("chart: diabetes", k.includes("dm"), k);
ok("every suggestion has a hint", r.every((x) => x.hint), r.filter((x) => !x.hint).map((x) => x.key));
const many = Array.from({ length: 12 }, (_, i) => "Drug" + i + " 10 mg");
ok("12 meds -> deprescribing", keys(R.suggest({ meds: many })).includes("deprx"));
ok("urine creatinine ignored", !R.labsFromObs([obs("zz", 9000, "umol/L", 0, "Creatinine urine")]).creat);

// ---- every topic points at a real toolkit tab ----
const shell = require("fs").readFileSync(__dirname + "/../shell.js", "utf8");
const tabKeys = Array.from(shell.matchAll(/\{ key: "([a-z0-9]+)"/g)).map((m) => m[1]);
const bad = R.TOPICS.map((t) => t.key).filter((x) => !tabKeys.includes(x));
ok("all topic keys exist in shell.js TOOLS", bad.length === 0, bad);
console.log(fail ? fail + " FAILED" : "all passed"); process.exit(fail ? 1 : 0);
