/* node tests/test_pc.js - hand-worked checks of the peritoneal carcinomatosis rules and chart parsing */
const R = require("../tools/pc/rules.js");
const C = require("../tools/pc/chart.js");
global.window = {}; require("../tools/pc/samples.js");
let fail = 0;
const ok = (n, c) => { if (!c) fail++; console.log((c ? "ok   " : "FAIL ") + n); };
const eq = (n, g, w) => { const o = g === w; if (!o) fail++; console.log((o ? "ok   " : "FAIL ") + n + ": got " + g + ", want " + w); };

// PCI
eq("PCI empty", R.pciTotal({}), 0);
const all3 = {}; for (let i = 0; i <= 12; i++) all3[i] = 3;
eq("PCI max", R.pciTotal(all3), 39);
eq("PCI clamps bad values", R.pciTotal({ 0: 5, 1: -2, 2: 2 }), 5);
eq("colorectal PCI 8 green", R.pciInterp(8, "colorectal").level, "green");
eq("colorectal PCI 18 amber", R.pciInterp(18, "colorectal").level, "amber");
eq("colorectal PCI 25 red", R.pciInterp(25, "colorectal").level, "red");
eq("gastric PCI 5 amber", R.pciInterp(5, "gastric").level, "amber");
eq("gastric PCI 9 red", R.pciInterp(9, "gastric").level, "red");
eq("ovarian PCI 25 amber (no fixed cut-off)", R.pciInterp(25, "ovarian").level, "amber");
eq("PMP high PCI still green", R.pciInterp(30, "pmp").level, "green");
// MBO checklist
eq("mbo none", R.mboAdvice([]).level, "info");
eq("mbo favourable", R.mboAdvice([1, 1, 1]).level, "green");
eq("mbo two against", R.mboAdvice([1, 1, -1, -1]).level, "red");
eq("mbo mixed", R.mboAdvice([1, -1]).level, "amber");
// prognosis
eq("prog good", R.prognosis({ ecog: 1, alb: 38 }).level, "green");
eq("prog months", R.prognosis({ ecog: 2, alb: 25, mbo: true }).level, "amber");
eq("prog weeks", R.prognosis({ ecog: 3, alb: 25, mbo: true, pps: "30" }).level, "red");
// corrected calcium: 2.15 + 0.02*(40-26) = 2.43
eq("corrected Ca", R.corrCa(2.15, 26), 2.43);
// primary detection
eq("primary sigmoid", R.detectPrimary(["Malignant neoplasm of sigmoid colon C18.7"])[0].k, "colorectal");
eq("primary ovary", R.detectPrimary(["High grade serous carcinoma of ovary C56.9"])[0].k, "ovarian");
eq("primary stomach", R.detectPrimary(["Adenocarcinoma of stomach C16.9"])[0].k, "gastric");
eq("not a cancer: colonic polyp", R.detectPrimary(["Colonic polyp"]).length, 0);

// sample A: colorectal SBO
const S = window.PC_SAMPLES, now = Date.now();
let f = C.parse(S[0].build(now), { now });
ok("A: MBO found", f.prob.mbo && f.prob.mbo.length === 1);
ok("A: PC found", f.prob.pc && f.prob.pc.length === 1);
eq("A: K latest", f.latest.k.v, 3.1);
ok("A: creatinine rise flagged", f.crRise && f.crRise.from === 82 && f.crRise.to === 131);
eq("A: dex days", f.dexDays, 7);
eq("A: CEA trend length", f.l.cea.length, 3);
let fl = R.flags(f), txt = fl.map((x) => x.level + ":" + x.text).join("\n");
ok("A: low K red with MBO", /red:K 3\.1/.test(txt));
ok("A: metoclopramide + anticholinergic red", /red:Metoclopramide.*opposed/.test(txt));
ok("A: stimulant laxative flagged", /Stimulant laxative/.test(txt));
ok("A: dex >5 days flagged", /Dexamethasone for ~7 days/.test(txt));
ok("A: no 'no antiemetic' (metoclopramide counts)", !/No antiemetic/.test(txt));
ok("A: report found", f.reports.length === 1);
// sample B: ovarian ascites
f = C.parse(S[1].build(now), { now }); fl = R.flags(f); txt = fl.map((x) => x.level + ":" + x.text).join("\n");
ok("B: ascites", f.prob.ascites && f.prob.ascites.length >= 1);
ok("B: no MBO", !f.prob.mbo);
ok("B: ascites info flag", /Ascites on the problem list/.test(txt));
eq("B: CA-125 latest", f.latest.ca125.v, 780);
ok("B: olaparib seen as anticancer", f.cls.chemo.length === 1);
// sample C: gastric outlet obstruction, hypercalcemia, lactate
f = C.parse(S[2].build(now), { now }); fl = R.flags(f); txt = fl.map((x) => x.level + ":" + x.text).join("\n");
eq("C: corrected Ca 2.85 alb 24 -> 3.17", f.corrCa, 3.17);
ok("C: hypercalcemia red", /red:Corrected Ca 3\.17/.test(txt));
ok("C: lactate red", /red:Lactate 3\.4/.test(txt));
ok("C: no antisecretory prompt", /no octreotide/.test(txt));
ok("C: no antiemetic prompt", /No antiemetic/.test(txt));
// unit conversion: calcium mg/dL
f = C.parse({ obs: [{ resourceType: "Observation", status: "final", code: { coding: [{ system: "http://loinc.org", code: "17861-6" }], text: "Calcium" }, effectiveDateTime: new Date().toISOString(), valueQuantity: { value: 10, unit: "mg/dL" } }] });
eq("Ca mg/dL -> mmol/L", f.latest.ca.v, 2.5);
// note
const n = R.note({ primary: "ovarian", primaryLabel: "Ovarian", mbo: true, asc: true, decision: "Conservative" });
ok("note has MBO + ascites + decision + gyne-onc", /Malignant bowel obstruction/.test(n) && /Ascites/.test(n) && /Decision: Conservative/.test(n) && /gyne-oncology/.test(n));

// tumour markers
let ma = R.markerAdvice("colorectal", "male", 68, { cea: 96 });
eq("colorectal: send CA 19-9", ma.send.join(","), "ca199");
ok("CEA >10x ULN noted", ma.notes.some((x) => /over 10/.test(x.text)));
ma = R.markerAdvice(null, "female", 45, {});
ok("unknown primary young woman: CEA, CA19-9, CA-125, HE4, CA15-3, AFP, hCG", ["cea", "ca199", "ca125", "he4", "ca153", "afp", "hcg"].every((k) => ma.send.includes(k)));
ma = R.markerAdvice(null, "female", 70, { ca125: 800, cea: 2 });
ok("ratio 400 -> Mullerian", ma.notes.some((x) => /ratio 400.*ovarian/.test(x.text)));
ma = R.markerAdvice("gastric", "male", 74, { ca125: 300, cea: 30 });
ok("ratio 10 -> GI", ma.notes.some((x) => /ratio 10 .*GI/.test(x.text)));
ok("CA-125 non-specific note when not ovarian", ma.notes.some((x) => /any ascites/.test(x.text)));
ok("CA19-9 with high bili note", R.markerAdvice("gastric", "male", 74, { ca199: 500, bili: 80 }).notes.some((x) => /biliary/.test(x.text)));
f = C.parse({ obs: [{ resourceType: "Observation", status: "final", code: { coding: [{ system: "http://loinc.org", code: "55180-3" }], text: "HE4" }, effectiveDateTime: new Date().toISOString(), valueQuantity: { value: 120, unit: "pmol/L" } }] });
eq("HE4 parsed", f.latest.he4 && f.latest.he4.v, 120);

// daily progress note
let dn = R.dailyNote({ date: "2026-11-19", primaryLabel: "Colorectal", mbo: true, asc: false, d: { ng: "1400", ngc: "feculent", flat: "no", pain: "6" }, labs: "K 3.1 (3.4)", mboMeds: ["octreotide 100 mcg subcut q8h"], dexDays: 6, decision: "Venting PEG" });
ok("daily: NG output and character", /NG output 1400 mL\/24 h \(feculent\)/.test(dn));
ok("daily: dex day 6 reassess", /Dexamethasone day ~6 – reassess/.test(dn));
ok("daily: blanks stay ___", /last BM ___/.test(dn) && /code status ___/.test(dn));
ok("daily: no ascites line when no ascites", !/Malignant ascites –/.test(dn));
ok("daily: decision", /Decision: Venting PEG/.test(dn));
dn = R.dailyNote({ asc: true, d: { tap: "4800" } });
ok("daily: ascites line with tap", /Malignant ascites – last tap 4800 mL/.test(dn) && !/Malignant bowel obstruction –/.test(dn));

console.log(fail ? `\n${fail} FAILED` : "\nall passed");
process.exit(fail ? 1 : 0);
