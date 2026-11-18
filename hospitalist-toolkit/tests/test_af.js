/* node tests/test_af.js  - hand-worked checks of the AF rules */
const R = require("../tools/af/rules.js");
const C = require("../tools/af/chart.js");
global.window = {}; require("../tools/af/samples.js");
let fail = 0;
const ok = (n, c) => { if (!c) fail++; console.log((c ? "ok   " : "FAIL ") + n); };
const eq = (n, g, w) => { const o = g === w; if (!o) fail++; console.log((o ? "ok   " : "FAIL ") + n + ": got " + g + ", want " + w); };

// Cockcroft-Gault: 84 F, 54 kg, Cr 92 -> (56*54*1.04)/92 = 34.2
eq("CrCl woman", R.crcl(84, 54, 92, "female"), 34);
eq("CrCl man", R.crcl(70, 80, 100, "male"), 69); // 70*80*1.23/100 = 68.9
// CHADS-65
eq("CHADS-65 age", R.chads65({ age: 70 }).rec, "oac");
eq("CHADS-65 young HTN", R.chads65({ age: 50, htn: true }).rec, "oac");
eq("CHADS-65 young CAD only", R.chads65({ age: 50, vascular: true }).rec, "antiplatelet");
eq("CHADS-65 young nothing", R.chads65({ age: 50 }).rec, "none");
eq("CHA2DS2-VASc 84F HTN", R.chadsvasc({ age: 84, sex: "female", htn: true }).score, 4);
eq("CHA2DS2-VASc 79M HF DM CAD", R.chadsvasc({ age: 79, sex: "male", hf: true, dm: true, vascular: true }).score, 5);
// apixaban
eq("apixaban 84y 54kg Cr 92 -> 2.5", R.apixaban(84, 54, 92, 34).reduced, true);
eq("apixaban 84y 70kg Cr 92 -> 5", R.apixaban(84, 70, 92, 50).reduced, false);
eq("rivaroxaban CrCl 40", /15 mg/.test(R.rivaroxaban(40)), true);
// digoxin
eq("digoxin 88y 50kg CrCl 20 total 0.5", R.digoxin(88, 50, 20, false).total, 0.5);
eq("digoxin 60y 80kg CrCl 80 total 1.0", R.digoxin(60, 80, 80, false).total, 1.0);
ok("digoxin halve with amiodarone", /HALVE/.test(R.digoxin(70, 70, 60, true).maint));

const base = { age: 80, kg: 60, sex: "female", cl: 40, unstable: {}, lvefKnown: true };
const A = (o) => R.assess(Object.assign({}, base, o));
let a = A({ hr: 140, sbp: 130 });
ok("stable fast, normal BP: metoprolol first", /Metoprolol/.test(a.first[0].a));
ok("stable fast 140: IV route", /IV first/.test(a.route));
a = A({ hr: 120, sbp: 130 });
ok("120: oral route", /Oral/.test(a.route));
a = A({ hr: 140, sbp: 95 });
ok("SBP 95: digoxin first", /Digoxin/.test(a.first[0].a));
ok("SBP 95: avoid IV diltiazem", a.avoid.some((x) => /diltiazem/i.test(x.a)));
a = A({ hr: 140, sbp: 110, lvefLow: true });
ok("HFrEF SBP 110: beta-blocker first", /Metoprolol/.test(a.first[0].a));
ok("HFrEF: avoid diltiazem", a.avoid.some((x) => /Diltiazem/.test(x.a)));
a = A({ hr: 140, sbp: 110, decompHF: true });
ok("decompensated HF: digoxin first", /Digoxin/.test(a.first[0].a));
ok("decompensated HF: amiodarone next", a.also.some((x) => /Amiodarone/.test(x.a)));
a = A({ hr: 140, sbp: 84, pressors: true });
ok("pressors: amiodarone first", /Amiodarone/.test(a.first[0].a));
ok("pressors: ICU now", a.escalate.some((e) => e.lvl === "now"));
a = A({ hr: 130, sbp: 130, bronchospasm: true });
ok("bronchospasm: diltiazem first", /Diltiazem/.test(a.first[0].a));
a = A({ hr: 160, sbp: 78, unstable: { hypo: true } });
eq("unstable tier", a.tier, "urgent"); ok("unstable: cardioversion", /cardioversion/i.test(a.first[0].a));
a = A({ hr: 220, sbp: 120, preexc: true });
ok("pre-excitation: avoid AV node blockers", /Beta-blocker/.test(a.avoid[0].a) && /procainamide/.test(a.first[0].a));
a = A({ hr: 96, sbp: 120 });
eq("HR 96: ok tier", a.tier, "ok");
a = A({ hr: 140, sbp: 120, mat: true });
ok("MAT: no digoxin/cardioversion", /Cardioversion, digoxin/.test(a.avoid[0].a));

// anticoagulation
let ac = R.anticoag({ age: 80 }, { ongoing: true, durationH: 72 });
ok("AF 48h+ persisting, CHADS-65+: anticoagulate in hospital", /start therapeutic/.test(ac.advice[0]));
ac = R.anticoag({ age: 80 }, { ongoing: false, durationH: 24 });
ok("AF resolved: decision at follow-up", /follow-up/.test(ac.advice[0]));
ac = R.anticoag({ age: 50 }, { ongoing: true, durationH: 72 });
ok("CHADS-65 negative: no OAC", /no antithrombotic/.test(ac.advice[0]));

// interactions
let it = R.interactions(["azithromycin 500 mg", "salbutamol neb"], { qtc: 478 });
ok("azithro QT alert", it.some((x) => /QT/.test(x.t)));
ok("salbutamol alert", it.some((x) => /ipratropium/.test(x.t)));
it = R.interactions(["digoxin 0.125 mg", "amiodarone 200 mg"], { onAmio: true });
ok("digoxin + amiodarone", it.some((x) => /halve/.test(x.t)));

// samples parse
const S = window.AF_SAMPLES, now = Date.now();
let f = C.parse(S[0].build(now), { now });
eq("sample A HR latest", f.v.hr[f.v.hr.length - 1].v, 134);
eq("sample A K", f.l.k[0].v, 3.4);
ok("sample A azithro found", f.allMeds.some((m) => /azithro/.test(m)));
f = C.parse(S[1].build(now), { now });
ok("sample B HF on problem list", !!f.prob.hf);
eq("sample B held bisoprolol", f.heldBB.length, 1);
ok("sample B held BB not counted as current", f.cls.bb.length === 0);
f = C.parse(S[2].build(now), { now });
ok("sample C vasopressor found", f.cls.pressor.length > 0);

console.log(fail ? fail + " FAILED" : "all passed");
process.exit(fail ? 1 : 0);
