/* node tests/test_deprx.js - hand-worked checks of the Deprescribing tab (rules, chart parsing, made-up patients) */
const vm = require("vm"), fs = require("fs"), path = require("path");
const R = require("../tools/deprx/rules.js"), C = require("../tools/deprx/chart.js"), S = require("../tools/deprx/samples.js");
const box = {}; vm.createContext(box); vm.runInContext(fs.readFileSync(path.join(__dirname, "../tools/meds/beers-data.js"), "utf8") + ";this.B={R_DRUG,R_COMBO,R_DIS,ALIAS};", box);
const B = box.B;
let fail = 0;
const ok = (n, c) => { if (!c) fail++; console.log((c ? "ok   " : "FAIL ") + n); };
const eq = (n, g, w) => { const o = g === w; if (!o) fail++; console.log((o ? "ok   " : "FAIL ") + n + ": got " + g + ", want " + w); };
const run = (i, fx) => { const s = S[i], f = C.parse(s.build(Date.now()), { alias: B.ALIAS }); return { f, r: R.analyze({ meds: f.meds, probs: f.probs, age: f.age, sex: f.sex, wt: f.wt, lab: f.lab, vit: f.vit, f: Object.assign({}, s.factors, fx || {}), beers: B }) }; };
const has = (r, re, level, g) => r.flags.some((x) => re.test(x.title) && (!level || x.level === level) && (!g || x.g === g));

// Cockcroft-Gault: (140-86) * 54 * 1.04 / 118 = 25.7 -> 26
eq("CrCl female", R.crcl(86, "female", 54, 118), 26);
eq("CrCl male", R.crcl(79, "male", 72, 210), 26);
eq("mg parse mcg", R.mgOf("digoxin 125 mcg daily"), 0.125);
eq("prophylactic enoxaparin", R.isProphylaxis({ label: "enoxaparin 40 mg subcut daily", sig: "" }), true);
eq("treatment enoxaparin", R.isProphylaxis({ label: "enoxaparin 80 mg subcut BID", sig: "" }), false);
eq("brand alias", R.classesOf({ hay: R.expand("Imovane 7.5 mg") }).includes("zdrug"), true);
eq("ACB amitriptyline", R.acbOf({ hay: R.expand("amitriptyline 10 mg") }).score, 3);

// 1: hip fracture after a fall
let { f, r } = run(0);
eq("1 meds parsed", f.meds.length, 12);
eq("1 ACB total (oxybutynin 3 + dimenhydrinate 3 + furosemide 1)", r.acbTotal, 7);
ok("1 Z-drug after a fall is red", has(r, /Z-drug after a fall/, "red", "falls"));
ok("1 apixaban dose reduction (age 86, 54 kg)", has(r, /Apixaban 5 mg BID/, "amber", "renal"));
ok("1 hip fracture without bone protection", has(r, /without bone protection/, null, "start"));
ok("1 opioid without laxative", has(r, /without a laxative/));
ok("1 CCB -> diuretic cascade", has(r, /Calcium-channel blocker/, null, "cascade"));
ok("1 ChEI -> bladder cascade", has(r, /Cholinesterase inhibitor/, null, "cascade"));
ok("1 PPI no indication", has(r, /No indication found: pantoprazole/));
ok("1 citalopram >20 mg", has(r, /Citalopram above 20/));
ok("1 Beers merged, not duplicated (one benzo/Z age flag)", r.flags.filter((x) => /Benzodiazepine \/ Z-drug at age/.test(x.title)).length === 1);
ok("1 limited goals switch off fracture START", !has(run(0, { goals: "limited" }).r, /without bone protection/));

// 2: CKD
({ r } = run(1));
ok("2 metformin eGFR <30 red", has(r, /Metformin with eGFR <30/, "red"));
ok("2 K 5.8 red", has(r, /Potassium 5.8/, "red"));
ok("2 triple whammy", has(r, /Triple whammy/i, "red"));
ok("2 glyburide", has(r, /Glyburide/, "red"));
ok("2 A1c 6.2 over-treatment", has(r, /HbA1c 6.2/));
ok("2 K-sparing CrCl <30", has(r, /K-sparing/, "red"));

// 3: dementia, limited life expectancy
({ r } = run(2));
ok("3 ACB ≥9", r.acbTotal >= 9);
ok("3 STOPPFrail statin", has(r, /Lipid-lowering/, null, "frail"));
ok("3 antipsychotic in dementia", has(r, /Antipsychotic in dementia/));
ok("3 TSH suppressed", has(r, /TSH 0.05/));
ok("3 tramadol + serotonergic", has(r, /Tramadol \+ serotonergic/));

// 4: AF + CAD
({ r } = run(3));
ok("4 triple therapy red", has(r, /two antiplatelets/, "red"));
ok("4 INR 4.6", has(r, /INR 4.6/, "red"));
ok("4 digoxin with eGFR <30", has(r, /Digoxin >125/));
ok("4 BB + diltiazem", has(r, /Beta-blocker \+ verapamil/));
ok("4 low K with digoxin", has(r, /Low potassium \(3.3\) with digoxin/, "red"));

// 5: clean list
({ r } = run(4));
eq("5 no red or amber flags", r.flags.filter((x) => x.level !== "info").length, 0);

// note
const n = R.note({ date: "2026-11-24", pt: "86 y female", kidney: "CrCl 26", nMeds: 12, nSched: 10, nPrn: 2, acb: 7, changes: ["STOP NOW: lorazepam"], keep: [], flags: [], decision: "", discussed: "patient" });
ok("note has changes", /STOP NOW: lorazepam/.test(n) && /Discussed with: patient/.test(n));
console.log(fail ? `\n${fail} FAILED` : "\nall passed"); process.exit(fail ? 1 : 0);
