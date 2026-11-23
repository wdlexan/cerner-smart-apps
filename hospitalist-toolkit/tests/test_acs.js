/* node tests/test_acs.js  - hand-worked checks of the NSTEMI rules and the made-up patients */
const R = require("../tools/acs/rules.js");
const C = require("../tools/acs/chart.js");
global.window = {}; require("../tools/acs/samples.js");
let fail = 0;
const ok = (n, c) => { if (!c) fail++; console.log((c ? "ok   " : "FAIL ") + n); };
const eq = (n, g, w) => { const o = g === w; if (!o) fail++; console.log((o ? "ok   " : "FAIL ") + n + ": got " + g + ", want " + w); };
const T = (vals) => vals.map((v, i) => ({ t: i * 36e5, v }));

// troponin pattern
eq("trop: none", R.tropPattern([], 26).kind, "none");
eq("trop: normal series", R.tropPattern(T([5, 8, 10]), 26).kind, "normal");
eq("trop: rise 34->410->1650", R.tropPattern(T([34, 410, 1650]), 26).kind, "acute");
eq("trop: chronic stable 60->64", R.tropPattern(T([60, 64]), 26).kind, "chronic");  // 6.7% change
eq("trop: rise 48->132", R.tropPattern(T([48, 96, 132]), 26).kind, "acute");
eq("trop: small absolute change 27->31 (15%) chronic", R.tropPattern(T([27, 31]), 26).kind, "chronic");
eq("trop: single high", R.tropPattern(T([300]), 26).kind, "single-high");

// MI type
const acute = R.tropPattern(T([34, 410, 1650]), 26);
eq("type 1: symptoms + ECG, no trigger", R.mitype({ trop: acute, symptoms: true, ecgIschemia: true }).kind, "t1");
eq("type 2: trigger + troponin, no ECG/WMA", R.mitype({ trop: acute, symptoms: false, triggers: ["anemia"] }).kind, "injury"); // no ischemia at all = injury
eq("type 2: symptoms + trigger, no ECG", R.mitype({ trop: acute, symptoms: true, triggers: ["anemia"] }).kind, "t2");
eq("uncertain: ECG change + trigger", R.mitype({ trop: acute, ecgIschemia: true, triggers: ["tachyarrhythmia"] }).kind, "uncertain");
eq("thrombus on angio wins", R.mitype({ trop: acute, ecgIschemia: true, angioThrombus: true, triggers: ["anemia"] }).kind, "t1");
eq("normal troponin -> noMI", R.mitype({ trop: R.tropPattern(T([3, 4]), 26), symptoms: true }).kind, "noMI");

// GRACE: 66 y (58), HR 84 (9), SBP 142 (24), Cr 96 umol = 1.09 mg/dL (7), Killip 1 (0), ST dev (28), enzymes (14) = 140
eq("GRACE patient A", R.grace({ age: 66, hr: 84, sbp: 142, cr: 96, killip: 1, stDev: true, enz: true }).score, 140);
// 72 y (75), HR 112 (24), SBP 86 (53), Cr 141 = 1.59 (10), Killip 3 (39), ST (28), enz (14) = 243
eq("GRACE patient E", R.grace({ age: 72, hr: 112, sbp: 86, cr: 141, killip: 3, stDev: true, enz: true }).score, 243);
eq("GRACE risk band 140 = intermediate", R.grace({ age: 66, hr: 84, sbp: 142, cr: 96, killip: 1, stDev: true, enz: true }).risk, "intermediate");
ok("GRACE missing age", R.grace({ hr: 80, sbp: 120, cr: 90 }).score === null);
// TIMI
eq("TIMI 7", R.timi({ age: 70, rf: 3, knownCAD: true, asa7: true, angina2: true, stDev: true, enz: true }).score, 7);

// invasive timing
eq("very high -> immediate", R.invasive({ type: "t1", veryHigh: { shock: true } }).tier, "immediate");
eq("type 1 -> early", R.invasive({ type: "t1", veryHigh: {}, grace: 120 }).tier, "early");
eq("type 2 -> none", R.invasive({ type: "t2", veryHigh: {} }).tier, "none");
ok("frail notes conservative", R.invasive({ type: "t1", veryHigh: {}, frail: 7 }).notes.some((n) => /conservative/.test(n)));
eq("uncertain -> selective", R.invasive({ type: "uncertain", veryHigh: {} }).tier, "selective");

// revascularization
eq("3VD + diabetes -> CABG", R.revasc({ anatomy: "3v", dm: true }).tone, "cabg");
eq("3VD no DM SYNTAX 18 -> both", R.revasc({ anatomy: "3v", syntax: 18 }).tone, "both");
eq("3VD no DM SYNTAX 30 -> CABG", R.revasc({ anatomy: "3v", syntax: 30 }).tone, "cabg");
eq("LM SYNTAX 35 -> CABG", R.revasc({ anatomy: "lm", syntax: 35 }).tone, "cabg");
eq("LM SYNTAX 20 -> both", R.revasc({ anatomy: "lm", syntax: 20 }).tone, "both");
eq("1VD non-LAD -> PCI", R.revasc({ anatomy: "1v" }).tone, "pci");
eq("2VD low EF -> CABG", R.revasc({ anatomy: "2v", lvef: 30 }).tone, "cabg");
ok("high surgical risk note", R.revasc({ anatomy: "3v", dm: true, surgRisk: ["Frailty 7+", "Dialysis"] }).notes.some((n) => /High surgical risk/.test(n)));
eq("MINOCA", R.revasc({ anatomy: "minoca" }).tone, "info");

// ARC-HBR
ok("HBR: OAC alone", R.hbr({ oac: true }).isHBR);
ok("HBR: age 76 + eGFR 50", R.hbr({ age: 76, egfr: 50 }).isHBR);
ok("not HBR: age 76 only", !R.hbr({ age: 76, egfr: 80, hb: 140, sex: "male" }).isHBR);
ok("HBR: Hb 105", R.hbr({ hb: 105 }).isHBR);

// P2Y12
eq("default ticagrelor", R.p2y12({ type: "t1", age: 60, managed: "pending" }).pick, "Ticagrelor");
eq("OAC -> clopidogrel", R.p2y12({ type: "t1", age: 60, oac: true }).pick, "Clopidogrel");
eq("prior ICH -> clopidogrel", R.p2y12({ type: "t1", age: 60, ich: true }).pick, "Clopidogrel");
eq("clarithromycin -> clopidogrel", R.p2y12({ type: "t1", age: 60, cyp3a4strong: ["clarithromycin 500 mg"] }).pick, "Clopidogrel");
eq("type 2 -> none", R.p2y12({ type: "t2" }).pick, "None");
ok("prior stroke: prasugrel avoided", R.p2y12({ type: "t1", age: 60, strokeTIA: true }).avoid.some((a) => /Prasugrel/.test(a)));

// anticoagulant doses: 80 kg -> enox 80 mg, UFH bolus 4,000 (60*80=4800 capped), infusion 950 (12*80=960 -> 950)
const ac = R.anticoag({ kg: 80, cl: 70, tier: "early" });
ok("enox 80 mg", /80 mg q12h/.test(ac.enox)); ok("UFH bolus capped 4000", /= 4000 units/.test(ac.ufh)); ok("UFH 950/h", /= 950 units\/h/.test(ac.ufh));
ok("CrCl 25 -> enox daily", /once daily/.test(R.anticoag({ kg: 60, cl: 25 }).enox));
ok("CrCl 18 -> no fondaparinux", R.anticoag({ kg: 60, cl: 18 }).fond === null);
eq("immediate -> UFH", R.anticoag({ kg: 70, cl: 60, tier: "immediate" }).pick, "ufh");

// DAPT plan
eq("DAPT default 12", R.daptPlan({ type: "t1", managed: "pci" }).months, 12);
eq("DAPT HBR 1", R.daptPlan({ type: "t1", managed: "pci", hbr: true }).months, 1);
ok("OAC + PCI triple 1 week", /Triple/.test(R.daptPlan({ type: "t1", managed: "pci", oac: true }).headline));
eq("type 2 no DAPT", R.daptPlan({ type: "t2" }).months, 0);

// alerts
ok("alert: P2Y12 for type 2", R.alerts({ type: "t2", ticagrelor: true, meds: [] }).some((a) => /type 2/.test(a.t)));
ok("alert: ticagrelor + clarithromycin", R.alerts({ type: "t1", ticagrelor: true, meds: ["clarithromycin 500 mg PO BID"] }).some((a) => /CYP3A4/.test(a.t)));
ok("alert: OAC + heparin tx", R.alerts({ type: "t1", meds: ["apixaban 5 mg"], heparinTx: true }).some((a) => /both on the chart/.test(a.t)));

// made-up patients through the chart parser
const S = window.ACS_SAMPLES, now = Date.now();
const run = (i) => { const f = C.parse(S[i].build(now), { now }); return f; };
let f = run(0);
eq("A: troponin values", f.l.trop.length, 3); eq("A: age", f.age, 66); ok("A: ticagrelor found", f.cls.tic.length === 1); ok("A: enox therapeutic", f.heparinTx); ok("A: diabetes", !!f.prob.dm);
f = run(1); ok("B: apixaban (OAC)", f.cls.doac.length === 1); ok("B: dementia", !!f.prob.dementia); ok("B: CKD", !!f.prob.ckd);
eq("B: P2Y12", R.p2y12({ type: "t1", oac: true, age: 87 }).pick, "Clopidogrel");
f = run(2); ok("C: sepsis", !!f.prob.sepsis); eq("C: last Hb", f.l.hb[f.l.hb.length - 1].v, 76); ok("C: enox prophylactic not tx", !f.heparinTx);
f = run(3); ok("D: sildenafil", f.cls.pde5.length === 1); ok("D: UFH infusion tx", f.heparinTx);
f = run(5); ok("F: clarithromycin flagged CYP3A4", f.cls.cyp3a4.length === 1); ok("F: stroke history", !!f.prob.stroke); ok("F: NSAID + steroid", f.cls.nsaid.length && f.cls.steroid.length);
eq("F: P2Y12 (stroke + clarithro)", R.p2y12({ type: "t1", age: 70, strokeTIA: true, cyp3a4strong: f.cls.cyp3a4, managed: "pci", anatomyKnown: true }).pick, "Clopidogrel");
// unit conversion: conventional troponin 0.04 ug/L -> 40 ng/L
const g = C.parse({ obs: [{ resourceType: "Observation", status: "final", code: { text: "Troponin I" }, effectiveDateTime: new Date().toISOString(), valueQuantity: { value: 0.04, unit: "ug/L" } }] });
eq("ug/L -> ng/L", g.l.trop[0].v, 40);

console.log(fail ? `\n${fail} FAILED` : "\nall passed");
process.exit(fail ? 1 : 0);
