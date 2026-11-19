/* node tests/test_lytes.js  - hand-worked checks of the Electrolytes (K, PO4, Ca) rules and the made-up patients */
const R = require("../tools/lytes/rules.js"), C = require("../tools/lytes/chart.js"), S = require("../tools/lytes/samples.js"), REF = require("../tools/lytes/reference.js");
let fail = 0;
const ok = (n, c, info) => { if (!c) fail++; console.log((c ? "ok   " : "FAIL ") + n + (c || info === undefined ? "" : ": " + JSON.stringify(info))); };
const eq = (n, g, w) => ok(n + ": got " + g + ", want " + w, g === w);
const has = (n, arr, s) => ok(n + " has " + JSON.stringify(s), arr.some((x) => (typeof x === "string" ? x : x.text).indexOf(s) > -1), arr.map((x) => x.text || x));
const not = (n, arr, s) => ok(n + " lacks " + JSON.stringify(s), !arr.some((x) => (typeof x === "string" ? x : x.text).indexOf(s) > -1), arr.map((x) => x.text || x));

// formulas
eq("corrected Ca 2.00 alb 30", R.correctedCa(2.0, 30), 2.2);
eq("corrected Ca alb 40 unchanged", R.correctedCa(2.3, 40), 2.3);
eq("eGFR 80 y F creat 100", R.egfr(100, 80, "female"), 49);   // CKD-EPI 2021 hand calc: 142 × 1.616^-1.2 (0.562) × 0.9938^80 (0.608) × 1.012 = 49.1
eq("eGFR 50 y M creat 80", R.egfr(80, 50, "male"), 103);   // 142 × 1.0056^-1.2 (0.993) × 0.9938^50 (0.733) = 103.3

// grading boundaries
eq("K 3.4 mild low", R.gradeK(3.4).sev, 1); eq("K 2.9 moderate", R.gradeK(2.9).sev, 2); eq("K 2.4 severe", R.gradeK(2.4).sev, 3);
eq("K 3.2 + symptoms severe", R.gradeK(3.2, { symptoms: true }).sev, 3);
eq("K 5.5 mild high", R.gradeK(5.5).sev, 1); eq("K 6.2 moderate", R.gradeK(6.2).sev, 2); eq("K 6.5 severe", R.gradeK(6.5).sev, 3);
eq("K 5.8 + ECG severe", R.gradeK(5.8, { ecg: true }).sev, 3); eq("K 4.2 normal", R.gradeK(4.2).dir, "normal");
eq("PO4 0.30 severe", R.gradePhos(0.30).sev, 3); eq("PO4 0.5 moderate", R.gradePhos(0.5).sev, 2); eq("PO4 0.7 mild", R.gradePhos(0.7).sev, 1); eq("PO4 2.5 high moderate", R.gradePhos(2.5).sev, 2);
let g = R.gradeCa({ Ca: 1.96, albumin: 21 }); eq("Ca 1.96 alb 21 corrected 2.34 normal", g.dir + " " + g.val, "normal 2.34");
g = R.gradeCa({ Ca: 1.96, albumin: 21, iCa: 1.0 }); eq("ionized wins", g.basis + " " + g.dir + " " + g.sev, "ionized low 1");
g = R.gradeCa({ Ca: 3.40, albumin: 22 }); eq("corrected 3.76 severe high", g.val + " " + g.sev, "3.76 3");
g = R.gradeCa({ Ca: 2.7 }); eq("no albumin: total basis", g.basis, "total (no albumin)");

// medication classes
const m = R.classifyMeds(["Ramipril 10 mg", "Sulfamethoxazole-trimethoprim DS", "Lokelma 10 g", "Fleet enema", "Phosphate Novartis 500 mg tab", "Pantoprazole 40 mg", "Metoprolol 25 mg"]);
eq("ACEi", m.acei.length, 1); eq("TMP", m.tmp.length, 1); eq("binder K", m.kbinder.length, 1); eq("fleet enema laxative", m.phosLaxative.length, 1);
eq("phosphate tab supplement", m.phosSupp.length, 1); eq("PPI", m.ppi.length, 1); eq("BB", m.bb.length, 1); eq("no ARB", m.arb.length, 0);

// run each made-up patient through parse + assess, as the page does
const NOW = Date.UTC(2026, 10, 18, 20, 0);
function run(i) {
  const s = S[i], f = C.parse(s.build(NOW), { now: NOW }), v = {};
  ["K", "phos", "Ca", "iCa", "Mg", "albumin", "creatinine", "glucose", "tCO2", "Na", "weight", "QTc", "CK", "urate", "LDH", "plt", "wbc", "PTH", "vitD", "uK", "uCr"].forEach((k) => { const e = C.latest(f.c[k], 9000 * C.HR, NOW); v[k] = e ? Math.round(e.v * 1000) / 1000 : null; });
  v.age = f.age; v.sex = f.sex; v.crRise = C.crRise(f.c.creatinine, NOW);
  const kL = C.latest(f.c.K, null, NOW), kP = C.previous(f.c.K, kL, 4, 48); if (kP) v.Kprev = { v: kP.v, when: "earlier" };
  return R.assess(v, s.x, f.medNames, f.probs);
}
const all = (p) => p.treat;

// 1: hyperK 6.9 with ECG, AKI, ramipril + spironolactone + Septra
let a = run(0);
eq("1 K severe high", a.g.K.key + " " + a.g.K.sev, "hyperK 3");
has("1 calcium gluconate", all(a.plans.K), "calcium gluconate 10% 30 mL");
has("1 insulin 10 units (eGFR ~20? check)", all(a.plans.K), "insulin regular");
has("1 SZC TID", all(a.plans.K), "10 g PO TID");
has("1 hold culprits", all(a.plans.K), "Spironolactone");
has("1 causes TMP", a.plans.K.causes, "Trimethoprim"); has("1 causes MRA", a.plans.K.causes, "MRA"); has("1 causes AKI", a.plans.K.causes, "Creatinine rising");
has("1 bicarbonate (tCO2 17)", all(a.plans.K), "sodium bicarbonate");
has("1 urgent flag", a.flags, "life-threatening hyperkalemia"); has("1 AKI flag", a.flags, "AKI");
ok("1 eGFR < 30 so 5 units", all(a.plans.K).some((t) => t.text.indexOf("5 units") > -1), a.v.eGFR);
has("1 PO4 1.9 mild high plan exists", [{ text: a.plans.phos ? a.plans.phos.key : "" }], "hyperPhos");

// 2: hypoK 2.6, Mg 0.48, digoxin, QTc 512, furosemide, urine K:Cr 6.1
a = run(1);
eq("2 K moderate low", a.g.K.key + " " + a.g.K.sev, "hypoK 2");
has("2 Mg 5 g in K plan", all(a.plans.K), "magnesium sulfate 5 g in 100 mL NS"); has("2 digoxin target", all(a.plans.K), "Target K ≥ 4.0");
has("2 diuretic cause", a.plans.K.causes, "Diuretic"); has("2 kidney loss by urine K:Cr", a.plans.K.causes, "kidney losing K");
has("2 metabolic alkalosis cause", a.plans.K.causes, "Metabolic alkalosis");
has("2 digoxin flag", a.flags, "digoxin"); has("2 QTc torsades flag", a.flags, "torsades"); has("2 Mg severe flag", a.flags, "(< 0.5)");

// 3: refeeding, PO4 0.27, weight 41, K 3.0 -> potassium phosphate, 0.32-0.64 mmol/kg = 13-26 mmol
a = run(2);
eq("3 PO4 severe", a.g.phos.sev, 3);
has("3 PO4 0.27 → 30 mmol", all(a.plans.phos), "IV phosphate 30 mmol (PO4 0.27 < 0.3)"); has("3 KPO4 15 × 2 peripheral", all(a.plans.phos), "KPO4 15 mmol (22 mmol K) in 255 mL IV over 4–6 h, peripheral OK, × 2");
has("3 PO line 32 mmol", all(a.plans.phos), "4 mL PO BID");
has("3 thiamine", all(a.plans.phos), "thiamine 100 mg"); has("3 refeeding flag", a.flags, "Refeeding pattern");
has("3 refeeding cause", a.plans.phos.causes, "Refeeding");

// 4: hypercalcemia of malignancy, corrected 3.76, eGFR low, HCTZ + calcium + vit D
a = run(3);
eq("4 Ca severe high corrected", a.g.Ca.key + " " + a.g.Ca.sev + " " + a.g.Ca.basis, "hyperCa 3 corrected");
has("4 calcitonin weight dose 280", all(a.plans.Ca), "≈ 280 units"); has("4 PTH suppressed cause", a.plans.Ca.causes, "PTH suppressed");
has("4 stop HCTZ", all(a.plans.Ca), "Hydrochlorothiazide"); has("4 malignancy cause", a.plans.Ca.causes, "Malignancy");
has("4 albumin unreliable flag", a.flags, "Albumin 22");
ok("4 eGFR ≥ 30 or < 30 path present", all(a.plans.Ca).some((t) => /Zoledronic|denosumab/.test(t.text)), a.v.eGFR);

// 5: post-thyroidectomy, iCa 0.86 symptomatic
a = run(4);
eq("5 Ca severe low ionized", a.g.Ca.key + " " + a.g.Ca.sev + " " + a.g.Ca.basis, "hypoCa 3 ionized");
has("5 IV calcium gluconate", all(a.plans.Ca), "Calcium gluconate 10% 10–20 mL"); has("5 calcitriol", all(a.plans.Ca), "calcitriol 0.25–0.5 mcg");
has("5 Mg first", all(a.plans.Ca), "Magnesium 0.6"); has("5 hypopara cause", a.plans.Ca.causes, "thyroid or parathyroid surgery");
has("5 QTc flag", a.flags, "QTc 486"); not("5 not torsades (< 500)", a.flags, "torsades");

// 6: tumour lysis
a = run(5);
has("6 TLS flag", a.flags, "TUMOUR LYSIS"); has("6 TLS plan", all(a.plans.phos), "rasburicase");
has("6 Ca x P product", a.flags, "Ca × PO4 product"); eq("6 K moderate", a.g.K.sev, 2);

// 7: pseudohypocalcemia: total 1.96, albumin 21, iCa 1.17
a = run(6);
eq("7 Ca normal by ionized", a.g.Ca.dir + " " + a.g.Ca.basis, "normal ionized");
ok("7 no calcium plan", !a.plans.Ca);

// 8: pseudohyperkalemia with platelets 1100
a = run(7);
has("8 pseudo flag", a.flags, "falsely high"); has("8 pseudo plan line", all(a.plans.K), "pseudohyperkalemia");
has("8 pseudo cause", a.plans.K.causes, "pseudohyperkalemia");

// repeat-lab schedules
const rc = (p) => p.recheck.map((r) => ({ text: r.when + " | " + r.what + " | " + r.src }));
a = run(0); has("1 UKKA K times", rc(a.plans.K), "1, 2, 4, 6 and 24 h"); has("1 UKKA glucose", rc(a.plans.K), "360 min");
a = run(3); has("4 Ca recheck 6 h", rc(a.plans.Ca), "6 h after starting IV saline"); has("4 nadir day 2-4 SfE", rc(a.plans.Ca), "Day 2–4 after bisphosphonate");
has("4 saline 1 L/h", all(a.plans.Ca), "1 L/h for the first 2–3 h"); not("4 no 2 L", all(a.plans.Ca), "1–2 L over");
let o2 = R.assess({ Ca: 3.5, albumin: 40, creatinine: 80, age: 60, sex: "male" }, {}, [], []);
has("Ca exactly 3.5 → 6 h", rc(o2.plans.Ca), "6 h after starting IV saline");
o2 = R.assess({ Ca: 3.2, albumin: 40, creatinine: 80, age: 60, sex: "male" }, {}, [], []);
has("Ca 3.2 → 12-24 h", rc(o2.plans.Ca), "Every 12–24 h"); not("Ca 3.2 not 6 h", rc(o2.plans.Ca), "6 h after starting");
o2 = R.assess({ Ca: 2.7, albumin: 40 }, {}, [], []); has("Ca 2.7 → 24-48 h", rc(o2.plans.Ca), "24–48 h");
a = run(2); has("3 refeeding daily labs", rc(a.plans.phos), "first 3–5 days of feeding");
a = run(4); has("5 infusion q4-6h", rc(a.plans.Ca), "Every 4–6 h on infusion");

// phosphate salt choice
let ph = R.assess({ phos: 0.25, K: 5.3, weight: 70 }, {}, [], []); has("PO4 low + K 5.3 → NaPO4 30", all(ph.plans.phos), "NaPO4 30 mmol (40 mmol Na) in 260 mL");
ph = R.assess({ phos: 0.25, K: 4.6, creatinine: 400, age: 70, sex: "male" }, {}, [], []); has("eGFR < 30 + K 4.6 → NaPO4 15 (halved)", all(ph.plans.phos), "50% dose for eGFR < 30): NaPO4 15 mmol");
ph = R.assess({ phos: 0.5, K: 4.2 }, { npo: true }, [], []); has("moderate NPO → KPO4 15", all(ph.plans.phos), "IV phosphate 15 mmol (PO4 0.5): KPO4 15 mmol");
ph = R.assess({ phos: 0.45, K: 4.2, weight: 72 }, { npo: true }, [], []); has("PO4 0.45 and 72 kg → 30 mmol", all(ph.plans.phos), "IV phosphate 30 mmol (PO4 0.45 < 0.5 and weight 72 kg ≥ 60)");
ph = R.assess({ phos: 0.45, K: 4.2, weight: 52 }, { npo: true }, [], []); has("PO4 0.45 and 52 kg → 15 mmol", all(ph.plans.phos), "IV phosphate 15 mmol");
ph = R.assess({ phos: 0.5, K: 4.2 }, {}, [], []); has("moderate eating → PO first", all(ph.plans.phos), "sodium phosphate oral solution 4 mmol/mL");

// magnesium
eq("Mg 0.65 mild", R.gradeMg(0.65).sev, 1); eq("Mg 0.55 moderate", R.gradeMg(0.55).sev, 2); eq("Mg 0.45 severe", R.gradeMg(0.45).sev, 3);
eq("Mg 1.5 mild high", R.gradeMg(1.5).sev, 1); eq("Mg 2.4 moderate high", R.gradeMg(2.4).sev, 2); eq("Mg 3.0 severe high", R.gradeMg(3.0).sev, 3); eq("Mg 2.2 + symptoms severe", R.gradeMg(2.2, { symptoms: true }).sev, 3);
a = run(1); eq("2 Mg plan", a.plans.Mg.key + " " + a.plans.Mg.sev, "hypoMg 3");
has("2 Mg 5 g", all(a.plans.Mg), "Magnesium sulfate 5 g in 100 mL NS IV, no faster than 2 g/h"); ok("2 single torsades line", all(a.plans.Mg).filter((t) => /Torsades/.test(t.text)).length === 1); has("2 QTc 512 → 2 g bolus", all(a.plans.Mg), "2 g IV over 10–15 min");
has("2 PPI cause", a.plans.Mg.causes, "PPI"); has("2 diuretic cause", a.plans.Mg.causes, "diuretic"); has("2 K low too", all(a.plans.Mg), "replace Mg with K");
ok("2 no 4 g anywhere", !JSON.stringify(a.plans).match(/\b4 g\b|1–2 g IV|2–4 g/), "");
has("2 Mg recheck ≥ 1 h local", rc(a.plans.Mg), "At least 1 h after the IV dose");
a = run(8); eq("9 Mg severe high", a.plans.Mg.key + " " + a.plans.Mg.sev, "hyperMg 3");
has("9 calcium gluconate", all(a.plans.Mg), "Calcium gluconate 10% 10–20 mL"); has("9 stop MoM", all(a.plans.Mg), "Milk of Magnesia");
has("9 dialysis", all(a.plans.Mg), "nephrology for dialysis"); has("9 cause Mg load", a.plans.Mg.causes, "Magnesium intake");
has("9 urgent flag", a.flags, "severe hypermagnesemia"); has("9 hourly reflexes", rc(a.plans.Mg), "Patellar reflexes");
let mr = R.assess({ Mg: 0.55, creatinine: 400, age: 70, sex: "male" }, {}, [], []); has("renal hypoMg 2 g", all(mr.plans.Mg), "2 g in 50 mL NS IV over at least 1 h (50% dose");

// local sheet: K
let kk = R.assess({ K: 3.2, weight: 70 }, {}, ["Digoxin 0.125 mg"], []); has("K need to 4.0 on digoxin", all(kk.plans.K), "80–160 mEq if acute loss"); has("K-Dur mild", all(kk.plans.K), "K-Dur 20 mEq");
kk = R.assess({ K: 2.3 }, { npo: true }, [], []); has("severe K peripheral bags", all(kk.plans.K), "KCl 10 mEq/100 mL bags, each over at least 30 min");
has("SR level ≥ 4 h", rc(R.assess({ K: 2.8 }, {}, [], []).plans.K), "At least 4 h after K-Dur");

// unit conversion: mg/dL calcium and phosphate
const conv = C.parse({ patient: null, obs: [
  { resourceType: "Observation", status: "final", code: { text: "Calcium" }, effectiveDateTime: new Date(NOW - 36e5).toISOString(), valueQuantity: { value: 10.0, unit: "mg/dL" } },
  { resourceType: "Observation", status: "final", code: { text: "Phosphorus" }, effectiveDateTime: new Date(NOW - 36e5).toISOString(), valueQuantity: { value: 3.1, unit: "mg/dL" } },
  { resourceType: "Observation", status: "final", code: { text: "Magnesium" }, effectiveDateTime: new Date(NOW - 36e5).toISOString(), valueQuantity: { value: 2.0, unit: "mg/dL" } },
  { resourceType: "Observation", status: "final", code: { text: "Alkaline Phosphatase" }, effectiveDateTime: new Date(NOW - 36e5).toISOString(), valueQuantity: { value: 90, unit: "U/L" } },
  { resourceType: "Observation", status: "final", code: { text: "Calcium Ionized" }, effectiveDateTime: new Date(NOW - 36e5).toISOString(), valueQuantity: { value: 1.2, unit: "mmol/L" } }] }, { now: NOW });
eq("mg/dL Ca → 2.5", Math.round(conv.c.Ca[0].v * 100) / 100, 2.5); eq("mg/dL PO4 → 1.0", Math.round(conv.c.phos[0].v * 100) / 100, 1);
eq("mg/dL Mg → 0.82", Math.round(conv.c.Mg[0].v * 100) / 100, 0.82); eq("ALP not phosphate", conv.c.phos.length, 1); eq("ionized not total", conv.c.Ca.length + "/" + conv.c.iCa.length, "1/1");

// reference covers all six
eq("8 reference cards", REF.ORDER.filter((k) => REF.REF[k] && REF.REF[k].treat.length && REF.REF[k].causes.length && REF.REF[k].repeat).length, 8);

console.log(fail ? `\n${fail} FAILED` : "\nall passed");
process.exit(fail ? 1 : 0);
