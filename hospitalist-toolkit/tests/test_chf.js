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
console.log(fail ? fail + " FAILED" : "all passed");
process.exit(fail ? 1 : 0);
