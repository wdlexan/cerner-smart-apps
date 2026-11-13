/* node tests/test_hypona.js  - hand-worked checks of the hyponatremia rules */
const R = require("../tools/hypona/rules.js");
let fail = 0;
const eq = (n, g, w) => { const o = g === w; if (!o) fail++; console.log((o ? "ok   " : "FAIL ") + n + ": got " + g + ", want " + w); };
const near = (n, g, w, tol) => { const o = g != null && Math.abs(g - w) <= (tol || 0.05); if (!o) fail++; console.log((o ? "ok   " : "FAIL ") + n + ": got " + g + ", want ~" + w); };
const H = 36e5, now = Date.UTC(2026, 10, 1, 18);

// basics
eq("limits standard", R.limits(false).l24, 10); eq("limits high", R.limits(true).l24, 8);
eq("severity 128", R.severity(128), "moderate"); eq("severity 124", R.severity(124), "profound"); eq("severity 132", R.severity(132), "mild");
near("glucose-corrected 125 @ glucose 30", R.glucoseCorrected(125, 30), 135.57);   // 125 + 2.4/5.55*24.45
eq("glucose normal: no change", R.glucoseCorrected(130, 5), 130);
eq("calc osm", R.calcOsm(130, 5, 5), 270);
eq("TBW 70 kg man 40y", R.tbw(70, 40, "male"), 42); near("TBW 60 kg woman 80y", R.tbw(60, 80, "female"), 27);
near("Adrogue 1 L 3% at 115, TBW 42", R.adrogue(115, 513, 0, 42), 9.256, 0.01);
near("Adrogue 1 L D5W at 130, TBW 42", R.adrogue(130, 0, 0, 42), -3.023, 0.01);
// Furst
near("Furst ratio", R.furst(80, 40, 120).ratio, 1.0); eq("Furst >=1 fails", /will not work/.test(R.furst(80, 40, 120).advice), true);
eq("Furst 0.5-1", /500 mL/.test(R.furst(40, 30, 120).advice), true); eq("Furst <0.5", /1 L/.test(R.furst(20, 20, 120).advice), true);

// series: 112 at -20h, 118 at -10h, 121 now
let s = [{ t: now - 20 * H, v: 112 }, { t: now - 10 * H, v: 118 }, { t: now, v: 121 }];
let rs = R.rises(s); eq("rise24", rs.rise24, 9);
let c = R.ceiling(s, R.limits(false), now); eq("ceiling standard", c.v, 122); eq("ceiling set by 112", c.from.v, 112); eq("ceiling until", c.until, now + 4 * H);
eq("ceiling high risk", R.ceiling(s, R.limits(true), now).v, 120);
let st = R.status(s, R.limits(false), now); eq("near limit (1 left)", st.near, true); eq("not over", st.over, false);
st = R.status(s, R.limits(true), now); eq("over (high risk, 9 > 8)", st.over, true);
// rate: 118 -> 121 over 10 h = 0.3/h
near("rate", R.rate(s).perH, 0.3);
// once 112 is more than 24 h old, the 24 h ceiling moves to 118+10 = 128, but the 48 h limit 112+18 = 130 -> 128
eq("ceiling later", R.ceiling(s, R.limits(false), now + 5 * H).v, 128);
// overcorrection 116 -> 128 in 20 h
st = R.status([{ t: now - 20 * H, v: 116 }, { t: now, v: 128 }], R.limits(false), now); eq("over 12 in 24h", st.over, true);
// 48 h: 110 -> 120 (day 1) -> 129 (day 2) = 19 in 48 h
st = R.status([{ t: now - 47 * H, v: 110 }, { t: now - 23 * H, v: 120 }, { t: now, v: 129 }], R.limits(false), now); eq("over 19 in 48h", st.over, true);
// too slow: 118 -> 120 over 24 h
st = R.status([{ t: now - 24 * H, v: 118 }, { t: now, v: 120 }], R.limits(false), now); eq("too slow", st.slow, true);
// onset
eq("acute", R.onset([{ t: now - 30 * H, v: 138 }, { t: now, v: 124 }]), "acute");
eq("chronic", R.onset([{ t: now - 30 * H, v: 126 }, { t: now, v: 124 }]), "chronic");

// cause algorithm
eq("hyperglycemia", R.cause({ na: 126, glu: 40 }).label, "hyperglycemia");
eq("non-hypotonic", R.cause({ na: 128, glu: 6, sosm: 290 }).label, "nonhypotonic");
eq("low urine osm", R.cause({ na: 112, sosm: 240, uosm: 70 }).label, "lowuosm");
eq("hypervolemic", R.cause({ na: 126, sosm: 262, uosm: 400, una: 12, volume: "hyper" }).label, "hypervolemic");
eq("siad", R.cause({ na: 123, sosm: 255, uosm: 520, una: 70, volume: "eu", diuretic: false }).label, "siad");
eq("diuretic", R.cause({ na: 123, sosm: 255, uosm: 450, una: 70, volume: "eu", diuretic: true }).label, "diuretic");
eq("renal loss", R.cause({ na: 123, sosm: 255, uosm: 450, una: 60, volume: "hypo" }).label, "renalloss");
eq("missing urine Na", R.cause({ na: 123, sosm: 255, uosm: 450 }).label, "incomplete");
// SIAD criteria
let sd = R.siad({ na: 123, sosm: 255, uosm: 520, una: 70, volume: "eu", diuretic: false, tsh: 2.1, cortisol: 450, uric: 0.15 });
eq("SIAD met", sd.met, true); eq("SIAD support uric", sd.support.length, 1);
eq("SIAD fails with diuretic", R.siad({ na: 123, sosm: 255, uosm: 520, una: 70, volume: "eu", diuretic: true }).failed, true);
// doses
eq("bolus 2 mL/kg 70 kg", R.bolus(70, 115, 42).perKg2, 140); near("bolus 150 mL rise", R.bolus(70, 115, 42).rise150, 1.388, 0.01);
eq("rescue D5W 6 mL/kg 70 kg", R.rescue(70).d5w6, 420);
// plan
let p = R.plan({ lim: R.limits(false), st: R.status([{ t: now - 20 * H, v: 116 }, { t: now, v: 128 }], R.limits(false), now), wt: 70, na: 128, symptoms: "none", meds: {}, causeLabel: "hypovolemic" });
eq("plan overcorrection first", p[0].h, "Overcorrection: act now");
p = R.plan({ lim: R.limits(true), st: R.status([{ t: now, v: 114 }], R.limits(true), now), wt: 70, water: 35, na: 114, symptoms: "severe", meds: {}, causeLabel: "diuretic" });
eq("plan severe bolus first", p[0].h, "Severe symptoms: hypertonic saline");
// severe symptoms close to the ceiling: still shows the severe block, not "slow down"
p = R.plan({ lim: R.limits(true), st: R.status([{ t: now - 3 * H, v: 112 }, { t: now, v: 116 }], R.limits(true), now), wt: 58, water: 26, na: 116, symptoms: "severe", bolusesGiven: 2, meds: {}, causeLabel: "diuretic" });
eq("severe near ceiling keeps severe block", p[0].h, "Severe symptoms: hypertonic saline"); eq("no slow-down block", p.some((b) => /slow down/.test(b.h)), false);
eq("1 more bolus allowed", /Up to 1 more/.test(p[0].items.join(" ")), true);
// overcorrected: no saline advice
p = R.plan({ lim: R.limits(false), st: R.status([{ t: now - 20 * H, v: 116 }, { t: now, v: 128 }], R.limits(false), now), wt: 80, na: 128, symptoms: "none", meds: {}, causeLabel: "hypovolemic" });
eq("overcorrected: no saline block", p.some((b) => b.items.some((i) => /0.9% saline \(or a balanced/.test(i))), false);
p = R.plan({ lim: R.limits(false), st: null, wt: 70, na: 123, symptoms: "none", meds: {}, causeLabel: "siad", furst: R.furst(80, 40, 123), uosm: 600 });
eq("plan SIAD urea", p.some((b) => b.items.some((i) => /urea 15-30/.test(i))), true);
eq("plan SIAD avoid saline", p.some((b) => b.items.some((i) => /Avoid 0.9% saline: urine/.test(i))), true);
// typed-in cause helper
// FE urate: urine urate 3, serum urate 0.15, urine creat 8 mmol/L, serum creat 60 umol/L -> 100*3*0.06/(0.15*8) = 15%
near("FE urate", R.fe(3, 0.15, 8, 60), 15, 0.01);
// FENa: uNa 60, sNa 120, uCr 8, sCr 60 -> 100*60*0.06/(120*8) = 0.375%
near("FENa", R.fe(60, 120, 8, 60), 0.375, 0.001);
eq("FE missing value", R.fe(3, null, 8, 60), null);
let I = R.interpret({ na: 122, sosm: 255, uosm: 450, una: 55, uk: 40, glu: 5, urea: 4 });
eq("interpret: hypotonic", I.find((l) => l.k === "Serum osmolality").level, "ok");
eq("interpret: gap small", /10 or less/.test(I.find((l) => l.k === "Osmolal gap").text), true);
near("interpret: Furst", I.find((l) => /Furst/.test(l.k)).v, 0.8, 0.01);
I = R.interpret({ na: 125, sosm: 290, glu: 6, urea: 5 });
eq("interpret: normal sOsm flagged", I.find((l) => l.k === "Serum osmolality").level, "flag");
eq("interpret: gap > 10", /above 10/.test(I.find((l) => l.k === "Osmolal gap").text), true);  // 290 - 261 = 29
eq("interpret: uOsm 80", /ADH is off/.test(R.interpret({ uosm: 80 })[0].text), true);
eq("interpret: diuretic flags uNa", R.interpret({ una: 50, diuretic: true })[0].level, "flag");
// end-to-end cause from typed values
eq("cause SIAD", R.cause({ na: 122, sosm: 255, uosm: 450, una: 55, volume: "eu", diuretic: false }).label, "siad");
eq("cause polydipsia", R.cause({ na: 118, sosm: 245, uosm: 70, una: 15, volume: "eu" }).label, "lowuosm");
eq("cause hypovolemic", R.cause({ na: 126, sosm: 262, uosm: 520, una: 12, volume: "hypo" }).label, "hypovolemic");
eq("cause hypervolemic", R.cause({ na: 127, sosm: 265, uosm: 400, una: 10, volume: "hyper" }).label, "hypervolemic");
eq("cause pseudo", R.cause({ na: 128, sosm: 285 }).label, "nonhypotonic");

console.log(fail ? fail + " FAILED" : "all passed"); process.exit(fail ? 1 : 0);
