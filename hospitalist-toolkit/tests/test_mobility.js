/* node tests/test_mobility.js */
const R = require("../tools/mobility/rules.js");
let fail = 0;
const eq = (n, g, w) => { const o = JSON.stringify(g) === JSON.stringify(w); if (!o) fail++; console.log((o ? "ok   " : "FAIL ") + n + ": got " + JSON.stringify(g) + ", want " + JSON.stringify(w)); };
const D = 864e5, now = Date.UTC(2026, 10, 3, 18);
// levels
eq("max x2", R.levelIn("Transfers bed to chair with assist x2."), 2);
eq("mod assist", R.levelIn("Ambulated 5 m with FWW, mod assist."), 3);
eq("CGA", R.levelIn("Gait: CGA with FWW"), 5);
eq("SBA", R.levelIn("Walked 30 m with 4WW, standby assist."), 6);
eq("indep with walker = 7", R.levelIn("Independent with walker for 50 m."), 7);
eq("modified independent = 7", R.levelIn("Mod I with rollator"), 7);
eq("independent = 8", R.levelIn("Ambulates independently, no aid."), 8);
eq("hoyer = 1", R.levelIn("Hoyer lift for transfers."), 1);
eq("aids fww", R.aidsIn("Ambulated with 2WW"), ["fww"]);
eq("aids rollator", R.aidsIn("uses a rollator"), ["4ww"]);
eq("distance ft->m", R.distIn("ambulated 66 ft"), 20);
// extract a PT note
const note = `Physiotherapy progress note. Baseline: independent with cane, lives alone in a house with 3 steps to enter.
Bed mobility min assist. Transfers sit to stand with CGA. Ambulated 20 m with FWW, min assist, limited by pain. WBAT per ortho.
Stairs not yet assessed. Recommend rehab vs home with supports. Recommend raised toilet seat and tub transfer bench. Patient owns a cane.`;
const x = R.extract(note);
eq("current level min assist", x.level, 4); eq("transfer CGA", x.transfer, 5); eq("aid fww", x.aids, ["fww"]); eq("dist 20", x.dist, 20);
eq("baseline 7", x.baseline.level, 7); eq("baseline cane", x.baseline.aids, ["cane"]);
eq("lives alone", x.home.alone, true); eq("3 steps", x.home.steps, 3); eq("stairs not done", x.stairs, "not done"); eq("WBAT", x.wb, "WBAT");
eq("rec rehab vs home kept", x.recs.dest, "rehab vs home with supports"); eq("rec plain rehab", R.extract("Recommend rehab.").recs.dest, "rehab"); eq("RTS recommended", x.recs.equipment.rts, "recommended"); eq("TTB recommended", x.recs.equipment.ttb, "recommended"); eq("cane has", x.recs.equipment.cane, "has");
eq("pain flag", !!x.flags.pain, true);
eq("stairs done", R.extract("Stairs: managed 12 steps with one rail, step-to pattern.").stairs, "done");
eq("not safe", !!R.extract("Not safe for discharge home yet.").flags.notSafe, true);
// target
eq("target baseline", R.target(7, "home"), 7); eq("target 24h", R.target(8, "home-24h"), 6); eq("target unknown", R.target(null, "home"), 7); eq("target rehab", R.target(7, "rehab"), null);
// estimate: 2 -> 4 over 2 days = 1 level/day; goal 7 -> gap 3 -> mid 3 days -> 2..5
let e = R.estimate([{ t: now - 2 * D, level: 2 }, { t: now - D, level: 3 }, { t: now, level: 4 }], 7, 2, now);
eq("progressing", e.status, "progressing"); eq("measured", e.src, "measured"); eq("range", [e.lo, e.hi], [2, 5]);
e = R.estimate([{ t: now - 4 * D, level: 6 }, { t: now - 2 * D, level: 6 }, { t: now, level: 6 }], 8, 2, now); eq("plateau", e.status, "plateau");
e = R.estimate([{ t: now, level: 4 }], 7, 2, now); eq("assumed", e.src, "assumed"); eq("assumed range", [e.lo, e.hi], [4, 9]);
eq("met", R.estimate([{ t: now, level: 8 }], 8, 2, now).status, "met");
// todo and overall
const T = R.todo({ hasPT: true, hasOT: false, cur: 4, equipNeeded: true, ortho: true, wb: "WBAT", homeSteps: 3, stairs: "not done", est: { status: "progressing", lo: 2, hi: 5 }, goalLabel: "Independent with aid", curLabel: "Minimal assist",
  equip: ["Raised toilet seat"], alone: true, dest: "rehab", flags: { pain: true } });
eq("todo has OT", T.some((t) => /Occupational/.test(t.what)), true); eq("todo stairs", T.some((t) => /Stair/.test(t.what)), true); eq("todo rehab", T.some((t) => /Rehab/.test(t.what)), true);
eq("overall", R.overall(T), [3, 14]);
// equipment
const E = R.equipment({ noted: { rts: "recommended", cane: "has" }, aids: ["fww"], baseAids: ["cane"], hip: true, cur: 4, alone: true });
eq("equip rts recommended", E.find((q) => q.id === "rts").status, "recommended"); eq("equip fww suggested", E.find((q) => q.id === "fww").status, "suggested");
eq("equip hip kit", !!E.find((q) => q.id === "hipkit"), true); eq("equip commode", !!E.find((q) => q.id === "commode"), true); eq("equip cane has", E.find((q) => q.id === "cane").status, "has");
eq("conditional stairs not done", R.extract("Stairs not attempted. Recommend home if stairs managed.").stairs, "not done");
eq("toileting is not a transfer", R.extract("Toileting min assist.").transfer, null);
eq("uses walker at home = baseline", R.extract("Uses walker at home per daughter.").baseline.aids, ["walker"]);
console.log(fail ? fail + " FAILED" : "all passed"); process.exit(fail ? 1 : 0);
