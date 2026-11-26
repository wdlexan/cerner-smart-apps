/* node tests/test_ddi.js - checks of the Drug interactions tab (QT, serotonin, seizure) on made-up patients */
const D = require("../tools/ddi/rules.js");
let fail = 0;
const ok = (n, c) => { if (!c) fail++; console.log((c ? "ok   " : "FAIL ") + n); };
const eq = (n, g, w) => { const o = g === w; if (!o) fail++; console.log((o ? "ok   " : "FAIL ") + n + ": got " + g + ", want " + w); };
const run = (meds, pt) => D.analyze({ meds: meds.map((t) => (typeof t === "string" ? { text: t } : t)), pt });
const has = (r, re, sev, cat) => r.findings.some((f) => re.test(f.title) && (!sev || f.sev === sev) && (!cat || f.cat === cat));

// matching
eq("brand Celexa", (D.matchDrug("Celexa 20 mg") || {}).name, "citalopram");
eq("desvenlafaxine not venlafaxine", (D.matchDrug("Pristiq / desvenlafaxine 50 mg") || {}).name, "desvenlafaxine");
eq("salbutamol not matched", D.matchDrug("salbutamol inh 2 puffs"), null);
eq("eGFR CKD-EPI 2021 (F 82, Cr 160)", D.ckdEpi2021(160, 82, "female"), 28);

// 1: elderly woman, pneumonia, prolonged QTc
let r = run(["Azithromycin 500 mg PO daily", "Citalopram 40 mg PO daily", "Ondansetron 4 mg IV q8h", "Furosemide 40 mg IV BID"], { age: 82, sex: "female", qtc: 492, k: 3.3, mg: 0.68, hf: true });
ok("1 three QT drugs = High", has(r, /3 QT-prolonging drugs/, "High", "qt"));
ok("1 citalopram 40 mg over elderly max", has(r, /citalopram 40 mg above max 20/, "High"));
eq("1 Tisdale (1+1+1+2+2+3+3+3)", r.qt.tisdale.score, 16);
// 2: QTc >= 500
r = run(["Haloperidol 2 mg IV q4h PRN"], { age: 60, sex: "male", qtc: 512 });
ok("2 QTc 512 on haloperidol = High", has(r, /QTc 512/, "High"));
// 3: CYP3A4 inhibitor + methadone
r = run(["Methadone 60 mg daily", "Clarithromycin 500 mg BID"], { age: 45, sex: "male" });
ok("3 clarithro raises methadone", has(r, /CYP3A4 inhibitor raises methadone/, "High"));
ok("3 no QTc prompt", has(r, /No QTc found/, "Low"));
// 4: serotonin
r = run(["Phenelzine 15 mg TID", "Sertraline 50 mg"], {});
ok("4 MAOI + SSRI contraindicated", has(r, /MAOI \+ serotonergic/, "Contraindicated", "ss"));
r = run(["Sertraline 100 mg", { text: "linezolid 600 mg IV q12h", proposed: true }], {});
ok("4 linezolid + SSRI High", has(r, /linezolid \(weak MAOI\)/, "High", "ss"));
r = run(["Rasagiline 1 mg", "Tramadol 50 mg"], {});
ok("4 MAO-B + tramadol contraindicated", has(r, /MAO-B inhibitor \+ tramadol/, "Contraindicated"));
r = run(["Paroxetine 20 mg", "Tramadol 50 mg q6h"], {});
ok("4 SSRI + tramadol High", has(r, /2 serotonergic drugs/, "High"));
ok("4 2D6 inhibitor + tramadol", has(r, /CYP2D6 inhibitor \+ tramadol/, "Moderate"));
r = run(["Sertraline 50 mg", "Ondansetron 4 mg"], {});
ok("4 SSRI + ondansetron only Low", r.findings.filter((f) => f.cat === "ss").every((f) => f.sev === "Low"));
// 5: seizure
r = run(["Divalproex 500 mg BID", "Meropenem 1 g IV q8h"], {});
ok("5 carbapenem + valproate High", has(r, /Carbapenem \+ valproate/, "High", "sz"));
r = run(["Bupropion XL 300 mg"], { seizureHx: true });
ok("5 bupropion + epilepsy contraindicated", has(r, /Bupropion with seizure disorder/, "Contraindicated"));
r = run(["Cefepime 2 g IV q8h"], { egfr: 22 });
ok("5 cefepime eGFR 22 High", has(r, /cefepime with eGFR 22/, "High"));
r = run(["Ciprofloxacin 500 mg BID", "Theophylline 300 mg BID"], {});
ok("5 cipro raises theophylline", has(r, /raises theophylline/, "High"));
r = run(["Lamotrigine 200 mg BID", "Rifampin 600 mg daily"], {});
ok("5 rifampin lowers AED", has(r, /rifampin lowers antiseizure/, "Moderate"));
// 6: clean list
r = run(["Apixaban 5 mg BID", "Atorvastatin 40 mg", "Metformin 500 mg BID"], { age: 70, sex: "male", qtc: 430 });
eq("6 no findings", r.findings.length, 0);
eq("6 unmatched listed", r.unmatched.length, 3);

console.log(fail ? `\n${fail} FAILED` : "\nall passed");
process.exit(fail ? 1 : 0);
