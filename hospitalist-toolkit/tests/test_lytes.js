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
has("2 Mg 4 g", all(a.plans.K), "4 g IV"); has("2 digoxin target", all(a.plans.K), "Target K ≥ 4.0");
has("2 diuretic cause", a.plans.K.causes, "Diuretic"); has("2 kidney loss by urine K:Cr", a.plans.K.causes, "kidney losing K");
has("2 metabolic alkalosis cause", a.plans.K.causes, "Metabolic alkalosis");
has("2 digoxin flag", a.flags, "digoxin"); has("2 QTc torsades flag", a.flags, "torsades"); has("2 Mg severe flag", a.flags, "(< 0.5)");

// 3: refeeding, PO4 0.27, weight 41, K 3.0 -> potassium phosphate, 0.32-0.64 mmol/kg = 13-26 mmol
a = run(2);
eq("3 PO4 severe", a.g.phos.sev, 3);
has("3 K phosphate because K < 4", all(a.plans.phos), "IV potassium phosphate (K 3 < 4.0)");
has("3 dose by weight", all(a.plans.phos), "= 13–26 mmol");
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
eq("6 reference cards", REF.ORDER.filter((k) => REF.REF[k] && REF.REF[k].treat.length && REF.REF[k].causes.length).length, 6);

console.log(fail ? `\n${fail} FAILED` : "\nall passed");
process.exit(fail ? 1 : 0);
