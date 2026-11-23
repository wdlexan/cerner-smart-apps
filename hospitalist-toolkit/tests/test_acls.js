/* node tests/test_acls.js  - hand-worked checks of the ACLS rules and the made-up patients */
const R = require("../tools/acls/rules.js");
const C = require("../tools/acls/chart.js");
global.window = {}; require("../tools/acls/samples.js");
let fail = 0;
const ok = (n, c) => { if (!c) fail++; console.log((c ? "ok   " : "FAIL ") + n); };
const eq = (n, g, w) => { const o = g === w; if (!o) fail++; console.log((o ? "ok   " : "FAIL ") + n + ": got " + g + ", want " + w); };
const M = 6e4, now = Date.now();
const evs = (list) => list.map(([m, type, v]) => ({ t: now - 20 * M + m * M, type, v }));
const at = (m) => now - 20 * M + m * M;

// ---- code timer
let s = R.codeState([], now); eq("not started", s.started, false);
s = R.codeState(evs([[0, "start"]]), at(1)); eq("cycle: 1 min to check", Math.round(s.checkIn / 1000), 60); eq("no rhythm yet", s.epiState.k, "wait");
s = R.codeState(evs([[0, "start"]]), at(2.1)); ok("check overdue prompt", s.prompts.some((p) => /Rhythm and pulse check now/.test(p.t)));
s = R.codeState(evs([[0, "start"], [2, "rhythm", "pea"]]), at(2.2)); eq("PEA: epi now", s.epiState.k, "due");
s = R.codeState(evs([[0, "start"], [2, "rhythm", "pea"], [2.3, "epi"]]), at(4)); eq("epi wait <3 min", s.epiState.k, "wait");
s = R.codeState(evs([[0, "start"], [2, "rhythm", "pea"], [2.3, "epi"]]), at(6)); eq("epi due at 3.7 min", s.epiState.k, "due");
s = R.codeState(evs([[0, "start"], [2, "rhythm", "pea"], [2.3, "epi"]]), at(8)); eq("epi overdue at 5.7 min", s.epiState.k, "over");
s = R.codeState(evs([[0, "start"], [2, "rhythm", "vf"], [2.1, "shock", 200]]), at(3)); eq("VF after 1 shock: wait for 2nd", s.epiState.k, "wait");
s = R.codeState(evs([[0, "start"], [2, "rhythm", "vf"], [2.1, "shock", 200], [4, "rhythm", "vf"], [4.1, "shock", 200]]), at(4.3)); eq("VF after 2 shocks: epi due", s.epiState.k, "due");
s = R.codeState(evs([[0, "start"], [2, "rhythm", "vf"], [2.1, "shock"], [4, "rhythm", "vf"], [4.1, "shock"], [4.3, "epi"], [6, "rhythm", "vf"], [6.1, "shock"]]), at(6.3));
ok("3 shocks: amiodarone 300 prompt", s.prompts.some((p) => /amiodarone 300/.test(p.t))); eq("cycle anchored at last check", Math.round(s.checkIn / 1000), 102);
s = R.codeState(evs([[0, "start"], [2, "rhythm", "vf"], [2.1, "shock"], [4, "rhythm", "vf"], [4.1, "shock"], [6, "rhythm", "vf"], [6.1, "shock"], [6.3, "amio", 300], [8, "rhythm", "vf"], [8.1, "shock"], [10, "rhythm", "vf"], [10.1, "shock"]]), at(10.2));
ok("5 shocks: amiodarone 150 prompt", s.prompts.some((p) => /150 mg/.test(p.t)));
s = R.codeState(evs([[0, "start"], [2, "rhythm", "pea"], [5, "rosc"]]), at(6)); eq("ROSC phase", s.phase, "rosc"); eq("no prompts in ROSC", s.prompts.length, 0);
s = R.codeState(evs([[0, "start"], [2, "rhythm", "pea"], [5, "rosc"], [7, "rearrest"]]), at(8)); eq("re-arrest phase", s.phase, "arrest"); eq("re-arrest restarts cycle", Math.round(s.checkIn / 1000), 60);
s = R.codeState(evs([[0, "start"], [12, "end", "Resuscitation stopped, patient died"]]), at(15)); eq("ended: elapsed frozen", Math.round(s.elapsed / M), 12);
eq("fmt", R.fmt(125000), "2:05");

// ---- doses
const d = R.doses(80); eq("lidocaine 80 kg", d.lidoFirst, "80-120 mg"); eq("diltiazem 80 kg capped 20", d.diltFirst, "20 mg"); eq("procainamide max", d.procMax, "1360 mg"); eq("lipid bolus", d.lipidBolus, "120 mL");
eq("no weight", R.doses(null).lidoFirst, null);

// ---- tachy / brady
eq("AF energy 2025", /200 J/.test(R.tachy({ rhythm: "af", unstable: true }).energy), true);
eq("SVT energy", R.tachy({ rhythm: "narrow", unstable: true }).energy, "100 J synchronized");
ok("pVT defibrillate", /Unsynchronized/.test(R.tachy({ rhythm: "pvt" }).energy));
ok("pre-excited: no AV nodal", R.tachy({ rhythm: "preexcited" }).steps.some((x) => /do NOT give adenosine/.test(x.t)));
ok("wide: sotalol removed note", R.tachy({ rhythm: "mvt" }).steps.some((x) => /sotalol removed/.test(x.t)));
ok("HR 130 warning", R.tachy({ rhythm: "af", hr: 130 }).warn.some((w) => /under 150/.test(w)));
ok("brady atropine 1 mg", R.brady({ hr: 38, unstable: true }).steps.some((x) => /Atropine 1 mg/.test(x.t)));
ok("brady K cause", R.brady({ hr: 38, unstable: true, k: 6.2 }).causes.some((c) => /hyperkalemia/.test(c)));

// ---- ROSC
const ro = R.rosc({ map: 60, spo2: 100, pco2: 40, glu: 12, temp: 38, k: 4, follows: false, stemi: true });
eq("MAP off", ro.items.find((i) => i.name === "MAP").ok, false); eq("SpO2 100 hyperoxia", ro.items.find((i) => i.name === "SpO2").ok, false);
eq("PaCO2 ok", ro.items.find((i) => i.name === "PaCO2").ok, true); ok("STEMI -> cath", ro.plan.some((p) => /emergent cath/.test(p.t))); ok("TTM 36 h", ro.plan.some((p) => /36 hours/.test(p.t)));

// ---- code status
eq("MOST M2 -> dnr", R.codeStatus([{ text: "DNR - MOST M2", source: "problem list", t: 1 }]).kind, "dnr");
eq("full code", R.codeStatus([{ text: "Code status: Full code", source: "obs", t: 1 }]).kind, "full");
eq("none", R.codeStatus([]).kind, "none");

// ---- made-up patients through parse + hsts
const S = window.ACLS_SAMPLES;
function run(i) {
  const f = C.parse(S[i].build(now)), L = (id) => C.latest(f.l[id]), V = (id) => C.latest(f.v[id]), v = (o) => (o ? o.v : null);
  const med = {}; Object.keys(C.MED).forEach((k) => (med[k] = f.cls[k]));
  const p = Object.fromEntries(Object.keys(f.prob).map((k) => [k, true]));
  const hbs = f.l.hb || [], hb = hbs.length ? hbs[hbs.length - 1].v : null;
  const tr = f.l.trop || [];
  const x = { k: v(L("k")), mg: v(L("mg")), glu: v(L("glu")), ph: v(L("ph")), hco3: v(L("hco3")), lactate: v(L("lactate")), hb, hbDrop: hbs.length > 1 ? Math.max(...hbs.map((y) => y.v)) - hb : null,
    temp: v(V("temp")), spo2: v(V("spo2")), ddimer: v(L("ddimer")), digoxin: v(L("dig")), qtc: v(L("qtc")), tropRise: tr.length > 1 && tr[tr.length - 1].v > 26 && tr[tr.length - 1].v >= 1.2 * tr[tr.length - 2].v,
    med, prob: p, recentProc: !!(p.postop || p.hipfx), recentOpioidDose: f.recentOpioidDose, noVTEppx: !med.vteppx.length && (p.postop || p.cancer || p.hipfx) };
  return { f, x, h: Object.fromEntries(R.hsts(x).map((y) => [y.id, y.status])) };
}
let r = run(0); eq("A: hyperK likely", r.h.hyperk, "likely"); eq("A: acidosis likely", r.h.acid, "likely"); eq("A: code status full", R.codeStatus(r.f.code).kind, "full");
r = run(1); eq("B: toxins likely (opioid 2 h ago / block)", r.h.toxins, "likely"); eq("B: hypoxia likely", r.h.hypoxia, "likely"); eq("B: hypovolemia likely (Hb drop 24)", r.h.hypovol, "likely"); eq("B: no code status", R.codeStatus(r.f.code).kind, "none");
ok("B: bupivacaine found", r.f.cls.la.length > 0);
r = run(2); eq("C: PE possible/likely", ["likely", "possible"].includes(r.h.pe), true); ok("C: no VTE prophylaxis flagged", r.x.noVTEppx); eq("C: coronary (trop rising)", r.h.coronary, "likely");
r = run(3); eq("D: toxins likely (QTc 521)", r.h.toxins, "likely"); eq("D: hypoK/Mg likely", r.h.hypok, "likely"); eq("D: coronary likely", r.h.coronary, "likely");
r = run(4); const cs = R.codeStatus(r.f.code); eq("E: DNR", cs.kind, "dnr"); eq("E: MOST M2", cs.most, "M2");
r = run(5); eq("F: digoxin level parsed", r.x.digoxin, 3.4); eq("F: toxins likely (dig)", r.h.toxins, "likely"); ok("F: bb + ccb", r.f.cls.bb.length && r.f.cls.ndhp.length);

// ---- note
const n = R.note({ state: R.codeState(evs([[0, "start"], [2, "rhythm", "vf"], [2.1, "shock", 200], [5, "rosc"]]), at(6)), events: evs([[0, "start"], [2, "rhythm", "vf"], [2.1, "shock", 200], [5, "rosc"]]), now: at(6), likely: ["Hyperkalemia"], code: "Full code" });
ok("note: first rhythm VF", /First rhythm: VF/.test(n)); ok("note: ROSC line", /ROSC at/.test(n)); ok("note: log", /Event log/.test(n));
ok("family script died", /died at 14:05/.test(R.familyScript({ outcome: "died", time: "14:05", mins: 25 })));

console.log(fail ? fail + " FAILED" : "all passed"); process.exit(fail ? 1 : 0);
