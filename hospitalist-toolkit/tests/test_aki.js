/* node tests/test_aki.js  - hand-worked checks of the AKI rules */
const R = require("../tools/aki/rules.js");
const REF = require("../tools/aki/reference.js");
let fail = 0;
const eq = (n, g, w) => { const o = g === w; if (!o) fail++; console.log((o ? "ok   " : "FAIL ") + n + ": got " + g + ", want " + w); };
const near = (n, g, w, tol) => { const o = g != null && Math.abs(g - w) <= (tol || 0.05); if (!o) fail++; console.log((o ? "ok   " : "FAIL ") + n + ": got " + g + ", want ~" + w); };
const H = 36e5, D = 24 * H, now = Date.UTC(2026, 10, 17, 18);
const s = (pairs) => pairs.map(([h, v]) => ({ t: now - h * H, v }));

// creatinine staging
let c = R.creatStage(s([[100, 90], [48, 130], [0, 150]]));
eq("base = lowest in 7 d", c.base.v, 90); near("ratio", c.ratio, 1.667, 0.01); eq("stage 1 by ratio", c.stage, 1);
c = R.creatStage(s([[40, 100], [0, 127]])); eq("rise 27 in 48 h -> stage 1", c.stage, 1); eq("rise48", c.rise48, 27);
c = R.creatStage(s([[40, 100], [0, 126]])); eq("rise 26 -> stage 0", c.stage, 0);
c = R.creatStage(s([[120, 80], [0, 170]])); eq("2.1x -> stage 2", c.stage, 2);
c = R.creatStage(s([[120, 80], [0, 245]])); eq("3.06x -> stage 3", c.stage, 3);
c = R.creatStage(s([[120, 300], [30, 330], [0, 360]])); eq("354+ with 48 h rise of 30 -> stage 3", c.stage, 3);
c = R.creatStage(s([[120, 400], [0, 410]])); eq("354+ but no acute rise -> stage 0", c.stage, 0);
c = R.creatStage(s([[24 * 60, 70], [0, 140]])); eq("older baseline used (2x) -> stage 2", c.stage, 2); eq("baseline kind", /7-365 days/.test(c.baseKind), true);
c = R.creatStage(s([[24 * 100, 80], [24 * 180, 76], [24 * 30, 84], [26, 196], [0, 171]])); eq("admission value not used as baseline (median 80)", c.base.v, 80); eq("-> stage 2", c.stage, 2);
c = R.creatStage(s([[24 * 60, 150], [100, 95], [0, 150]])); eq("lower recent value wins over older median", c.base.v, 95);
c = R.creatStage(s([[0, 140]]), { baseline: 70 }); eq("typed baseline -> stage 2", c.stage, 2);
c = R.creatStage(s([[0, 140]])); eq("single value, no baseline -> 0", c.stage, 0); eq("trend", c.trend, "single value");
c = R.creatStage(s([[120, 80], [48, 300], [0, 220]])); eq("recovering (27% below peak)", c.recovering, true); eq("falling", c.trend, "falling");
c = R.creatStage(s([[10, 90]]), { rrt: true }); eq("on RRT -> stage 3", c.stage, 3);

// urine output: 70 kg, 20 mL/h for 24 h = 0.286 mL/kg/h -> stage 3 (under 0.3 for 24 h)
const uo = (mlh, hrs) => Array.from({ length: hrs }, (_, i) => ({ t: now - (i + 0.5) * H, v: mlh }));
let u = R.uoStage(uo(20, 25), 70, now); eq("uo 0.29 x 24 h -> stage 3", u.stage, 3);
u = R.uoStage(uo(30, 25), 70, now); eq("uo 0.43 x 24 h -> stage 2", u.stage, 2);
u = R.uoStage(uo(30, 7), 70, now); eq("uo 0.43 x 6 h only -> stage 1", u.stage, 1); eq("12 h not judged", u.r12, null);
u = R.uoStage(uo(60, 25), 70, now); eq("uo 0.86 -> stage 0", u.stage, 0);
eq("no weight -> null", R.uoStage(uo(20, 25), null, now), null);

// eGFR CKD-EPI 2021: creatinine 1.0 mg/dL (88.4), male 50 -> about 92; female 1.0 mg/dL 50 -> about 69
near("eGFR male 50, Cr 88.4", R.egfr(88.4, 50, "male"), 92, 1);
near("eGFR female 50, Cr 88.4", R.egfr(88.4, 50, "female"), 69, 1);
near("CrCl 70 y 70 kg male Cr 100", R.crcl(100, 70, "male", 70), 60.27, 0.1);

// FENa: UNa 10, SNa 140, UCr 10 mmol/L, SCr 200 umol/L -> (10*200)/(140*10000)*100 = 0.143%
near("FENa", R.fe(10, 140, 10, 200), 0.143, 0.001);
near("FEUrea", R.fe(200, 20, 10, 200), 20, 0.01);
eq("FE missing value", R.fe(10, 140, null, 200), null);
near("urea:creat ratio", R.ureaCrRatio(20, 200), 100);

// pattern
let p = R.pattern({ fena: 0.3, una: 10, uosm: 650, volumeLow: true });
eq("pre-renal lean", p.lean, "prerenal");
p = R.pattern({ fena: 0.4, diuretic: true, feurea: 55, una: 15, uosm: 320, muddyCasts: true, sepsis: true });
eq("on diuretic: FEUrea + casts win -> ATN", p.lean, "atn");
p = R.pattern({ rbcCasts: true, hematuriaProteinuria: true, serology: "MPO-ANCA positive" }); eq("GN lean", p.lean, "gn");
p = R.pattern({ hydro: true, pvr: 900, retention: true }); eq("post-renal lean", p.lean, "postrenal");
p = R.pattern({ wbcCasts: true, sterilePyuria: true, eos: true, ainDrug: "pantoprazole" }); eq("AIN lean", p.lean, "ain");
p = R.pattern({}); eq("nothing -> unclear", p.lean, "unclear");

// dialysis indications and nephrology
let r = R.rrt({ k: 6.8, ph: 7.1, urea: 40 });
eq("rrt: K and pH urgent", r.filter((i) => i.level === "urgent").length, 2); eq("rrt: urea action", r.some((i) => /Urea/.test(i.text)), true);
eq("rrt: none", R.rrt({ k: 4.5, ph: 7.38, urea: 10 }).length, 0);
let n = R.nephro({ stage: 3, rrtList: r });
eq("nephro: urgent + today", n.map((i) => i.level).join(","), "urgent,today");
n = R.nephro({ stage: 1, hematuriaProteinuria: true, baseEgfr: 25, noRecovery72: true });
eq("nephro: hematuria+proteinuria today, CKD and no recovery discuss", n.map((i) => i.level).join(","), "today,discuss,discuss");
eq("nephro: RBC casts urgent", R.nephro({ stage: 1, rbcCasts: true })[0].level, "urgent");
eq("nephro: stage 1 pre-renal, nothing else", R.nephro({ stage: 1 }).length, 0);

// reference content present
eq("3 AKI types", REF.TYPES.length, 3); eq("renal causes include AIN and GN", ["ain", "gn", "atn"].every((id) => REF.RENAL.some((x) => x.id === id)), true);
eq("every renal cause has recovery and nephrology text", REF.RENAL.every((x) => x.recovery && x.nephro && x.tests.length && x.tx.length), true);

console.log(fail ? `\n${fail} FAILED` : "\nall passed");
process.exit(fail ? 1 : 0);
