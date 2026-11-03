/* node tests/test_hip.js */
const R = require("../tools/hip/rules.js");
let fail = 0;
const eq = (n, g, w) => { const o = g === w; if (!o) fail++; console.log((o ? "ok   " : "FAIL ") + n + ": got " + g + ", want " + w); };
const near = (n, g, w, t) => { const o = g != null && Math.abs(g - w) <= (t || 0.05); if (!o) fail++; console.log((o ? "ok   " : "FAIL ") + n + ": got " + g + ", want ~" + w); };
const H = 36e5, now = Date.UTC(2026, 10, 2, 20);
near("CrCl 85F 55kg Cr 90", R.crcl(90, 85, 55, "female"), 34.96, 0.05);   // (55*55*1.04)/90
// timeline
let tl = R.timeline(now - 30 * H, null, now); eq("pre-op hours", Math.round(tl.hours), 30); eq("not over 48", tl.over48, false);
tl = R.timeline(now - 80 * H, now - 20 * H, now); eq("time to OR 60", Math.round(tl.hours), 60); eq("over 48", tl.over48, true); eq("POD0", tl.pod, 0);
eq("POD2", R.timeline(now - 80 * H, now - 50 * H, now).pod, 2);
// NHFS: 87 female, Hgb 95, AMTS low, institution -> 4+0+1+1+1 = 7
let n = R.nhfs({ age: 87, sex: "female", hgb: 95, amtsLow: true, institution: true });
eq("NHFS 7", n.score, 7); near("NHFS 7 mortality", n.mort30, 100 / (1 + Math.exp(5.012 - 0.481 * 7)), 0.001); near("NHFS 7 ~16.2%", n.mort30, 16.2, 0.1);
eq("NHFS young", R.nhfs({ age: 60, sex: "male", hgb: 140 }).score, 1);
eq("NHFS age 66 = 3", R.nhfs({ age: 66, sex: "female", hgb: 130 }).score, 3);
// pre-op
const e = (v) => ({ v, t: now });
let p = R.preop({ hgb: e(76), plt: e(210), na: e(134), k: e(4), glu: e(7), cr: e(80), inr: e(1.1), ts: { age: 2 * H } });
eq("Hgb 76 delay", p.delay.length, 1); eq("not ready", p.ready, false);
p = R.preop({ hgb: e(118), plt: e(210), na: e(118), k: e(2.6), glu: e(7), cr: e(80), ts: { age: 80 * H } });
eq("Na and K delay", p.delay.length, 2); eq("T&S old", p.items.find((i) => i.label === "Group and screen").state, "fix");
p = R.preop({ hgb: e(118), plt: e(210), na: e(136), k: e(4.1), glu: e(7), cr: e(80), ts: { age: 1 * H } });
eq("ready", p.ready, true);
// anticoag
let a = R.anticoag({ kind: "xa", last: now - 10 * H }, 50); eq("apixaban GA +24", a.ga, now + 14 * H); eq("apixaban spinal +72", a.neuraxial, now + 62 * H);
a = R.anticoag({ kind: "xa", last: now - 10 * H }, 25); eq("apixaban GA CrCl<30 +48", a.ga, now + 38 * H);
a = R.anticoag({ kind: "dabigatran", last: now - 10 * H }, 60); eq("dabigatran GA +36", a.ga, now + 26 * H); eq("dabigatran spinal 96", a.neuraxial, now + 86 * H);
eq("dabigatran spinal CrCl 25 none", R.anticoag({ kind: "dabigatran", last: now }, 25).neuraxial, null);
a = R.anticoag({ kind: "warfarin" }, 50, e(2.6)); eq("warfarin reverse", a.reverse, true);
eq("warfarin INR 1.4 fine", R.anticoag({ kind: "warfarin" }, 50, e(1.4)).reverse, false);
eq("LMWH proph spinal +12", R.anticoag({ kind: "lmwh-proph", last: now }, 50).neuraxial, now + 12 * H);
eq("DAPT", /continue aspirin/.test(R.antiplatelet(["Aspirin 81 mg", "Clopidogrel 75 mg"])[0]), true);
eq("ASA alone", /continue; no delay/.test(R.antiplatelet(["ASA 81 mg"])[0]), true);
// post-op
eq("transfuse 75", R.transfusion(e(75), false).give, true); eq("cardiac 85 consider", R.transfusion(e(85), true).consider, true); eq("85 no cardiac", R.transfusion(e(85), false).consider, false);
eq("AKI 80->110", R.aki(80, 110), true); eq("no AKI 80->95", R.aki(80, 95), false);
eq("VTE post-op start", R.vtePlan({ pod: 1, crcl: 50 }).state, "start"); eq("VTE 28-35", /28-35 days/.test(R.vtePlan({ pod: 1, crcl: 50 }).text), true);
eq("VTE renal dose", /30 mg/.test(R.vtePlan({ pod: 1, crcl: 20 }).text), true);
eq("VTE low plt", R.vtePlan({ pod: 1, plt: 40 }).state, "hold");
eq("VTE therapeutic", R.vtePlan({ onTherapeutic: true }).state, "ther");
// bone
let b = R.bone({ vitd: 35, ca: 2.3, crcl: 50 }); eq("bone treat", b.treat, true); eq("bone low D", b.items.some((i) => /below 50/.test(i)), true);
eq("bone CrCl<35 denosumab", R.bone({ vitd: 80, crcl: 30 }).items.some((i) => /denosumab 60 mg/.test(i)), true);
eq("bone on treatment", R.bone({ onTreatment: "Alendronate" }).treat, false);
console.log(fail ? fail + " FAILED" : "all passed"); process.exit(fail ? 1 : 0);
