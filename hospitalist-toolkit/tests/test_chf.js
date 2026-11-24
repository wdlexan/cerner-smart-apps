/* node tests/test_chf.js  - hand-worked checks of the heart failure rules */
const R = require("../tools/chf/rules.js");
const C = require("../tools/chf/chart.js");
global.window = {}; require("../tools/chf/samples.js");
const H = require("../tools/chf/handout.js");
let fail = 0;
const ok = (n, c) => { if (!c) fail++; console.log((c ? "ok   " : "FAIL ") + n); };
const eq = (n, g, w) => { const o = g === w; if (!o) fail++; console.log((o ? "ok   " : "FAIL ") + n + ": got " + g + ", want " + w); };

// NT-proBNP by age (ICON-RELOADED)
eq("age 45 cut", R.ntBand(45).cut, 450); eq("age 50 cut", R.ntBand(50).cut, 900); eq("age 75 cut", R.ntBand(75).cut, 900); eq("age 76 cut", R.ntBand(76).cut, 1800);
eq("250 rule-out", R.ntInterp(250, 80).zone, "out");
eq("1000 at 80 grey", R.ntInterp(1000, 80).zone, "grey");
eq("1000 at 60 likely", R.ntInterp(1000, 60).zone, "in");
eq("500 at 40 likely", R.ntInterp(500, 40).zone, "in");
ok("obesity note", R.ntInterp(640, 79, { bmi: 36 }).notes.some((n) => /obesity/i.test(n)));
ok("ARNI note", R.ntInterp(2000, 70, { arni: true }).notes.some((n) => /sacubitril/i.test(n)));
eq("BNP 80", R.bnpInterp(80).zone, "out");
let ch = R.ntChange([{ t: 1, v: 9800 }, { t: 2, v: 3900 }]); eq("NT change -60%", ch.pct, -60);
ok("NT change reassuring", /reassuring/.test(ch.text));

// loop equivalents
eq("furosemide IV 40 = PO 80", R.furoPOeq("furosemide", 40, "IV"), 80);
eq("bumetanide 1 = 40", R.furoPOeq("bumetanide", 1, "po"), 40);
eq("torsemide 20 = 40", R.furoPOeq("torsemide", 20, "po"), 40);
eq("start naive", R.startDose(0).daily, 40);
eq("start naive eGFR 25", R.startDose(0, 25).daily, 80);
eq("start home 40 PO -> 80 IV/day", R.startDose(40).daily, 80);
eq("start home 160 PO -> 320 IV/day", R.startDose(160).daily, 320);
// response
eq("UNa 38 poor", R.response({ una: 38 }).ok, false);
eq("UNa 90 + UO 200 good", R.response({ una: 90, uoPerH: 200 }).ok, true);
eq("UO 80 poor even with UNa 90", R.response({ una: 90, uoPerH: 80 }).ok, false);
eq("weight -1.2 good", R.response({ wt24: -1.2 }).ok, true);
eq("weight -0.3 poor", R.response({ wt24: -0.3 }).ok, false);
ok("ladder doubles 80 -> 160", /160 mg\/day/.test(R.ladder(80)[0].t));
ok("ladder acetazolamide fit with HCO3 29", /good fit/.test(R.ladder(80, 29)[2].t));
eq("days to target 89.4->85 at 1", R.daysTo(89.4, 85, 1), 5);
eq("days at target", R.daysTo(84, 85, 1), 0);
eq("creatinine +17 ok", R.creatinine(121, 138, true).lvl, "ok");
eq("creatinine +40 congested", R.creatinine(100, 140, true).lvl, "action");
eq("creatinine +40 dry", R.creatinine(100, 140, false).lvl, "urgent");
// IV to PO
let sw = R.switchPO(160, 40);
eq("IV 160 -> PO furosemide 320", sw.furoPO, 320);
ok("torsemide 160", /Torsemide 160/.test(sw.opts[1].a));
ok("bumetanide 8", /Bumetanide 8/.test(sw.opts[2].a));
ok("no warning when higher than home", sw.note === "");
ok("warning when not above home dose", R.switchPO(20, 80).note !== "");
// GDMT
let g = R.gdmt("low", { k: 4.3, egfr: 62, sbp: 116, hr: 72 }, ["bisoprolol 2.5 mg", "ramipril 2.5 mg"]);
eq("HFrEF 4 pillars + extra", g.length, 5);
ok("HFrEF MRA missing", g.find((x) => /MRA/.test(x.name)).on === false);
ok("HFrEF SGLT2 missing", g.find((x) => /SGLT2/.test(x.name)).on === false);
ok("HFrEF ACEi counted", g[0].on === true);
g = R.gdmt("pres", {}, ["dapagliflozin 10 mg"]); ok("HFpEF SGLT2 on", g[0].on === true);
// iron
eq("ferritin 62 deficient", R.iron(62, 14).def, true); eq("ferritin 240 TSAT 24 ok", R.iron(240, 24).def, false); eq("ferritin 200 TSAT 15 deficient", R.iron(200, 15).def, true);
// amyloid
eq("3 flags high", R.amyloid({ ctsBil: true, spinal: true, lvh: true }).level, "high");
ok("AL first", /AL/.test(R.amyloid({}).steps[0]));

// samples
const S = window.CHF_SAMPLES, now = Date.now();
let f = C.parse(S[0].build(now), { now });
eq("A IV furosemide in 24 h", f.loop.iv24, 80);
eq("A NT latest", f.l.nt[f.l.nt.length - 1].v, 5900);
ok("A carpal tunnel", !!f.prob.cts); ok("A NSAID", f.cls.nsaid.length === 1);
eq("A weight change 24 h", Math.round(C.wtChange(f.v.wt).d * 10) / 10, -0.3);
f = C.parse(S[1].build(now), { now });
eq("B IV furosemide 160/day", f.loop.iv24, 160); ok("B HFrEF", !!f.prob.hfref);
f = C.parse(S[3].build(now), { now }); ok("D BMI about 36", f.bmi > 35 && f.bmi < 37);
// loop dose parser
eq("parse 80 mg IV BID", C.loopDose("furosemide 80 mg IV BID").perDay, 160);
eq("parse torsemide 20 mg daily", C.loopDose("torsemide 20 mg PO daily").perDay, 20);
// handout
const hb = H.body({ dry: 72, diur: "furosemide 80 mg every morning", flex: true, flexdose: "40 mg", fluid: true, fluidL: 1.5 });
ok("handout dry weight lb", /159 lb/.test(hb)); ok("handout 2 lb / 5 lb", /2 lb\) in a day/.test(hb) && /5 lb\) in a week/.test(hb)); ok("handout sodium 2,000", /2,000 mg/.test(hb)); ok("handout fluid 1.5", /1\.5 litres/.test(hb));

// four GDMT pillars
{
  const P = (m) => Object.fromEntries(R.pillars(m).map((p) => [p.id, p]));
  let p = P(["furosemide 80 mg IV BID", "bisoprolol 2.5 mg PO daily", "ramipril 2.5 mg PO daily", "aspirin 81 mg PO daily"]);
  ok("pillars: ramipril + bisoprolol on, below target; MRA and SGLT2 not on", p.raas.on === true && p.raas.below && p.bb.on === true && p.bb.below && p.mra.on === false && p.sglt2.on === false);
  ok("pillars: ACEi advice to switch to ARNI", /sacubitril\/valsartan/.test(p.raas.advice));
  p = P(["metoprolol 25 mg PO BID"]); ok("pillars: metoprolol tartrate is partial (not a trial beta-blocker)", p.bb.on === "partial");
  p = P(["Toprol XL 200 mg daily"]); ok("pillars: metoprolol succinate at target", p.bb.on === true && !p.bb.below);
  p = P(["sacubitril/valsartan 97/103 mg PO BID", "carvedilol 25 mg PO BID", "spironolactone 25 mg PO daily", "dapagliflozin 10 mg PO daily"]);
  ok("pillars: all four at target", Object.values(p).every((x) => x.on === true && !x.below));
  p = P(["Entresto 24/26 mg BID"]); eq("pillars: Entresto 24/26 BID daily sacubitril mg", p.raas.daily, 48);
  ok("pillars: atenolol partial", P(["atenolol 50 mg daily"]).bb.on === "partial");
  ok("gdmt table: metoprolol tartrate no longer counts as beta-blocker", R.gdmt("low", {}, ["metoprolol 25 mg BID"]).find((g) => /Beta-blocker/.test(g.name)).on === false);
}

// ischemia sub-tab
const I = require("../tools/chf/ischemia.js");
eq("lik known CAD high", I.likelihood({ knownCad: true }).level, "high");
eq("lik angina 64 high", I.likelihood({ angina: true, age: 64, rf: 0 }).level, "high");
eq("lik 45 no rf low", I.likelihood({ age: 45, rf: 0 }).level, "low");
eq("lik 58 3 rf no angina intermediate", I.likelihood({ age: 58, rf: 3 }).level, "intermediate");
eq("plan ACS", I.plan({ acs: true, ef: "low" }).route, "acs");
eq("plan not revasc candidate", I.plan({ revasc: "no", ef: "low", knownCad: true }).route, "none");
eq("plan EF unknown -> echo", I.plan({ ef: "unknown", age: 70, rf: 2 }).route, "echo");
eq("plan HFrEF angina -> ICA", I.plan({ ef: "low", angina: true, age: 58, rf: 3, revasc: "yes" }).route, "ica");
eq("plan HFrEF intermediate -> noninv", I.plan({ ef: "low", age: 58, rf: 2, revasc: "yes" }).route, "noninv");
eq("plan HFpEF no clues -> none", I.plan({ ef: "pres", age: 82, rf: 1 }).route, "none");
eq("plan HFrEF other cause -> optional", I.plan({ ef: "low", age: 46, rf: 0, otherCause: true }).route, "optional");
let T = I.tests({ ef: "low", canEx: "no", ecg: { lbbb: true }, age: 58, rf: 2 });
eq("treadmill avoid: can't exercise + LBBB", T.find((t) => t.key === "ett").status, "avoid");
eq("exercise SPECT avoid with LBBB", T.find((t) => t.key === "exspect").status, "avoid");
T = I.tests({ ef: "pres", canEx: "yes", ecg: {}, age: 55, rf: 1 });
eq("treadmill ok: HFpEF, exercises, normal ECG", T.find((t) => t.key === "ett").status, "ok");
eq("best = CCTA low-intermediate", I.best("noninv", { ef: "pres", canEx: "yes", ecg: {}, age: 55, rf: 1 }, T), "ccta");
T = I.tests({ ef: "low", canEx: "no", ecg: { lbbb: true }, af: true, age: 72, rf: 2, egfr: 40 });
eq("best with LBBB, AF, can't exercise", I.best("noninv", { ef: "low", canEx: "no", ecg: { lbbb: true }, af: true, age: 72, rf: 2, otherCause: true }, T), "pspect");
eq("CCTA avoid eGFR 25", I.tests({ egfr: 25, ecg: {} }).find((t) => t.key === "ccta").status, "avoid");
eq("treadmill avoid while congested", I.tests({ decompensated: true, canEx: "yes", ecg: {} }).find((t) => t.key === "ett").status, "avoid");
ok("refer: ACS in 'now'", I.refer({ acs: true }, { route: "acs" })[0].items[0][1] === true);
ok("note line", /Ischemia as cause: likelihood of CAD high/.test(I.noteLine({ ef: "low", angina: true, age: 64, rf: 2, revasc: "yes" })));

// echo sub-tab
const EC = require("../tools/chf/echo.js");
let EF_ = EC.parse(EC.SAMPLE);
eq("echo EF range mid", EF_.ef.v, 32.5); eq("echo TAPSE", EF_.tapse, 15); eq("echo RVSP", EF_.rvsp, 52); eq("echo AVA", EF_.ava, 1.2); eq("echo mean gradient", EF_.avMG, 24);
eq("echo MR moderate-severe", EF_.mr, "moderate to severe"); eq("echo AR none", EF_.ar, "none"); eq("echo LAVI", EF_.lavi, 46); eq("echo diastolic grade", EF_.dd, 2);
ok("echo RWMA found", EF_.rwma && /inferior/.test(EF_.rwma[0]));
eq("echo EF category", EC.efCat(EF_).key, "low"); eq("echo AS moderate", EC.asGrade(EF_).word, "moderate");
let E2 = EC.parse("Normal LV size. Severe concentric LVH, IVSd 16 mm, LVPWd 15 mm. LVEF 60%. Apical sparing pattern of GLS -11%. Biatrial enlargement. Small pericardial effusion. Severe aortic stenosis: AVA 0.8 cm2, mean gradient 32 mmHg, peak velocity 3.6 m/s. No regional wall motion abnormalities.");
eq("echo2 IVS mm->cm", E2.ivs, 1.6); eq("echo2 AS severe", EC.asGrade(E2).word, "severe"); ok("echo2 low-flow", EC.asGrade(E2).lowFlow); ok("echo2 no RWMA", !E2.rwma && E2.noRwma);
ok("echo2 amyloid message", EC.summarize(E2).M.some((m) => /amyloid/i.test(m[1]))); ok("echo2 AS urgent", EC.summarize(E2).M.some((m) => m[0] === "urgent" && /aortic stenosis/i.test(m[1])));
let E3 = EC.parse("Severely reduced left ventricular systolic function. Large pericardial effusion with right atrial collapse. Apical LV thrombus seen.");
eq("echo3 qualitative EF", EC.efCat(E3).key, "low"); ok("echo3 tamponade", E3.tamponade); ok("echo3 thrombus", !!E3.thrombus);
let E4 = EC.parse("No pericardial effusion. No LV thrombus. LVEF 55-60%. Mild mitral regurgitation.");
ok("echo4 negatives", !E4.effusion && !E4.thrombus && E4.mr === "mild");

// labs from a screenshot
const LS = require("../tools/chf/labshot.js");
let LR = LS.parseLabs(LS.SAMPLE, C.LABS);
eq("labshot count", LR.length, 24);
ok("labshot NT-proBNP in the 3rd date column", LR.find((e) => e.id === "nt").t === new Date(2026, 10, 22, 21, 15).getTime());
ok("labshot newest sodium 134 dated 24 Nov", LR.find((e) => e.id === "na" && e.v === 134).t === new Date(2026, 10, 24, 5, 40).getTime());
LR = LS.parseLabs("Creatinine 112 umol/L H  Ref 60-110\neGFR 52 mL/min/1.73m2\nHemoglobin A1c 7.6 %\nUrine Sodium 42 mmol/L\nTroponin I HS <5 ng/L\nCO2 24\nHgb 98 L", C.LABS);
eq("labshot ref range ignored", LR.filter((e) => e.id === "cr").length, 1); eq("labshot eGFR not 1.73", LR.find((e) => e.id === "egfr").v, 52);
eq("labshot A1c not Hb", LR.find((e) => e.v === 7.6).id, "a1c"); eq("labshot urine Na", LR.find((e) => e.v === 42).id, "una"); eq("labshot CO2", LR.find((e) => e.v === 24).id, "hco3");
LR = LS.parseLabs("\t24-Nov-2026 05:40\t23-Nov-2026 06:10\t22-Nov-2026 21:15\nNT-proBNP\t\t\t8450\nSodium\t134\t136\t138", C.LABS);
ok("labshot tab columns", LR.find((e) => e.id === "nt").t === new Date(2026, 10, 22, 21, 15).getTime());
const LO = C.parse({ obs: LS.toObs(LS.parseLabs("Creatinine 131\nMagnesium 0.68", C.LABS, { now: 1e12 }), C.LABS) }, { now: 1e12 });
ok("labshot -> chart reader", LO.l.cr[0].v === 131 && LO.l.mg[0].v === 0.68);
console.log(fail ? fail + " FAILED" : "all passed");
process.exit(fail ? 1 : 0);
