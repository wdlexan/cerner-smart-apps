/* node tests/test_pleural.js  - hand-worked checks of the pleural effusion rules and the made-up patients */
const R = require("../tools/pleural/rules.js");
const C = require("../tools/pleural/chart.js");
global.window = {}; require("../tools/pleural/samples.js");
let fail = 0;
const ok = (n, c) => { if (!c) fail++; console.log((c ? "ok   " : "FAIL ") + n); };
const eq = (n, g, w) => { const o = g === w; if (!o) fail++; console.log((o ? "ok   " : "FAIL ") + n + ": got " + g + ", want " + w); };
const now = Date.now();

// Light's
eq("classic transudate", R.lights({ pProt: 15, sProt: 70, pLDH: 80, sLDH: 200, ldhULN: 250 }).kind, "transudate");   // 0.21, 0.4, 80 < 167
eq("exudate by protein", R.lights({ pProt: 40, sProt: 70, pLDH: 80, sLDH: 200 }).kind, "exudate");                     // 0.57
eq("exudate by LDH 2/3 ULN", R.lights({ pProt: 20, sProt: 70, pLDH: 170, sLDH: 300, ldhULN: 250 }).kind, "exudate");  // 170 > 166.7
eq("LDH ratio exactly 0.6 not met", R.lights({ pProt: 20, sProt: 70, pLDH: 120, sLDH: 200 }).crit[1].met, false);
eq("pseudo-exudate by albumin gradient 16 (on diuretic)", R.lights({ pProt: 31, sProt: 58, pLDH: 140, sLDH: 210, pAlb: 18, sAlb: 34, onDiuretic: true }).kind, "pseudo");
eq("gradient without HF context stays exudate", R.lights({ pProt: 31, sProt: 58, pLDH: 140, sLDH: 210, pAlb: 18, sAlb: 34 }).kind, "exudate");
eq("pseudo by NT-proBNP", R.lights({ pProt: 35, sProt: 60, pLDH: 100, sLDH: 200, pBNP: 2500 }).kind, "pseudo");
eq("true exudate stays (gradient 8)", R.lights({ pProt: 45, sProt: 70, pLDH: 400, sLDH: 200, pAlb: 26, sAlb: 34 }).kind, "exudate");
eq("incomplete", R.lights({ pProt: 20 }).kind, "unknown");

// fluid findings
const ids = (o) => R.fluid(o).findings.map((f) => f.id);
ok("pH 7.1 -> lowpH", ids({ pH: 7.1 }).includes("lowpH")); ok("pH 7.3 -> midpH", ids({ pH: 7.3 }).includes("midpH")); ok("pH 7.45 nothing", !ids({ pH: 7.45 }).some((i) => /pH/.test(i)));
ok("TG 1.3 chylo", ids({ pTG: 1.3 }).includes("chylo")); ok("chol 6 pseudochylo", ids({ pChol: 6, pTG: 0.4 }).includes("pseudochylo")); ok("chol 6 with TG 2 = chylo not pseudo", !ids({ pChol: 6, pTG: 2 }).includes("pseudochylo"));
ok("Hct 30% / 0.36 hemothorax", ids({ pHct: 30, bHct: 0.36 }).includes("hemothorax")); ok("Hct 10% / 40% not hemothorax", !ids({ pHct: 10, bHct: 40 }).includes("hemothorax"));
ok("creatinine ratio urinothorax", ids({ pCr: 200, sCr: 150 }).includes("urino")); ok("ADA 60 + lymph 80 TB", ids({ ada: 60, lymphPct: 80 }).includes("tb"));
ok("eos 12%", ids({ eosPct: 12 }).includes("eos")); ok("pus", ids({ appearance: "pus" }).includes("empyema")); ok("cytology pos", ids({ cytology: "pos" }).includes("malignant"));

// parapneumonic
const para = (o) => R.parapneumonic(o, R.fluid(o).findings).cat;
eq("pus -> empyema", para({ appearance: "pus" }), "empyema"); eq("pH 7.1 -> complicated", para({ pH: 7.1 }), "complicated");
eq("glucose 2.5 no pH -> complicated", para({ pGlu: 2.5 }), "complicated"); eq("pH 7.3 + LDH 1200 -> borderline", para({ pH: 7.3, pLDH: 1200 }), "borderline");
eq("pH 7.35 LDH 400 -> simple", para({ pH: 7.35, pLDH: 400 }), "simple"); eq("nothing -> unknown", para({}), "unknown");

// RAPID: urea 9.1 (2) + age 66 (1) + not purulent (1) + community (0) + albumin 24 (1) = 5
eq("RAPID patient B", R.rapid({ urea: 9.1, age: 66, purulent: false, hospitalAcquired: false, albumin: 24 }).score, 5);
eq("RAPID band high", R.rapid({ urea: 9.1, age: 66, purulent: false, hospitalAcquired: false, albumin: 24 }).band, "high");
eq("RAPID 0", R.rapid({ urea: 4, age: 40, purulent: true, albumin: 35 }).score, 0);
eq("RAPID boundaries urea 5, age 50, alb 27", R.rapid({ urea: 5, age: 50, purulent: true, albumin: 27 }).score, 2);
eq("RAPID max 7", R.rapid({ urea: 12, age: 80, purulent: false, hospitalAcquired: true, albumin: 20 }).score, 7);
// LENT: LDH 1700 (1) + ECOG 2 (2) + NLR 10 (1) + breast (1) = 5 high
eq("LENT patient C", R.lent({ pLDH: 1700, ecog: 2, nlr: 10, tumour: "mod" }).score, 5); eq("LENT band", R.lent({ pLDH: 1700, ecog: 2, nlr: 10, tumour: "mod" }).band, "high");
eq("LENT ECOG 4 caps at 3", R.lent({ pLDH: 100, ecog: 4, nlr: 2, tumour: "low" }).score, 3); eq("LENT 1 low", R.lent({ pLDH: 100, ecog: 1, nlr: 2, tumour: "low" }).band, "low");

// removal
eq("bubbling blocks removal", R.removal({ purpose: "pneumothorax", bubbling: true, lungExpanded: true, out24: 0 }).ready, false);
eq("effusion 120 mL, lung up -> ready", R.removal({ purpose: "effusion", out24: 120, lungExpanded: true }).ready, true);
eq("empyema not settled -> not ready", R.removal({ purpose: "empyema", out24: 50, lungExpanded: true, sepsisSettled: false }).ready, false);
eq("empyema settled -> ready", R.removal({ purpose: "empyema", out24: 50, lungExpanded: true, sepsisSettled: true }).ready, true);
eq("pleurodesis 240 ok", R.removal({ purpose: "pleurodesis", out24: 240, lungExpanded: true }).ready, true);
eq("effusion 300 not ready", R.removal({ purpose: "effusion", out24: 300 }).ready, false);
ok("tube choice hepatic = avoid", /AVOID/.test(R.tubeChoice("hepatic").pick));
ok("all troubleshoot items have steps", Object.values(R.TROUBLE).every((t) => t.steps.length >= 2));

// imaging scan
const im = R.imaging("Loculated right pleural collection with enhancing split pleura sign. Large right effusion.").map((x) => x.id);
ok("imaging: split", im.includes("split")); ok("imaging: loculated", im.includes("loculated")); ok("imaging: large", im.includes("large"));
ok("imaging: no septations not loculated", !R.imaging("Moderate right effusion, anechoic, no septations.").some((x) => x.id === "loculated"));
ok("imaging: no pleural nodularity not malignant", !R.imaging("Smooth pleural thickening. No pleural nodularity.").some((x) => x.id === "malignantPleura"));
ok("imaging: 'no pneumothorax' not flagged", !R.imaging("No pneumothorax.").some((x) => x.id === "ptx"));

// chart readers
eq("cyto read", C.cytoRead("Malignant cells present: metastatic adenocarcinoma"), "pos"); eq("cyto neg", C.cytoRead("Negative for malignant cells"), "neg");
eq("micro neg", C.microRead("No growth at 48 hours"), "neg"); eq("micro pos", C.microRead("Gram-positive cocci in chains"), "pos"); eq("appearance milky", C.appearanceRead("Milky white"), "milky");

// made-up patients through the parser
const S = window.PLEURAL_SAMPLES; eq("7 made-up patients", S.length, 7);
const P = S.map((s) => C.parse(s.build(now)));
P.forEach((f, i) => ok(`patient ${i + 1} has pleural fluid or drain data`, Object.keys(f.pf).length > 0 || f.drain.length > 0));
const lat = (f, src, k) => { const a = f[src][k]; return a && a.length ? a[a.length - 1].v : null; };
// A: pseudo-exudate
const A = P[0];
eq("A: Light's from chart -> pseudo", R.lights({ pProt: lat(A, "pf", "prot"), sProt: lat(A, "l", "prot"), pLDH: lat(A, "pf", "ldh"), sLDH: lat(A, "l", "ldh"), pAlb: lat(A, "pf", "alb"), sAlb: lat(A, "l", "alb"), pBNP: lat(A, "pf", "bnp"), onDiuretic: A.cls.diuretic.length > 0 }).kind, "pseudo");
eq("A: pleural lymph % not mistaken for blood", lat(A, "pf", "lymphPct"), 72); eq("A: blood lymphocytes absolute", lat(A, "l", "lymph"), 1.8);
// B: empyema, drain output
const B = P[1]; eq("B: pH", lat(B, "pf", "ph"), 7.02); eq("B: gram text read pos", C.microRead(B.pft.gram[0].text), "pos"); ok("B: drain entries", B.drain.length === 6);
// F: hemothorax
const F = P[5]; eq("F: blood hct", lat(F, "l", "hct"), 0.36); eq("F: pleural hct", lat(F, "pf", "hct"), 30); ok("F: anticoagulant on hold not counted", F.cls.anticoag.length === 0);
ok("F: first drain 1100 mL", F.drain[0].v === 1100);
// D: cirrhosis
ok("D: cirrhosis problem", !!P[3].prob.cirrhosis); eq("D: INR", lat(P[3], "l", "inr"), 1.9);
// G: chylo
ok("G: TG chylothorax", R.fluid({ pTG: lat(P[6], "pf", "tg") }).findings.some((f) => f.id === "chylo")); eq("G: drain 24 h", P[6].drain24, 1400);

console.log(fail ? `\n${fail} FAILED` : "\nall passed");
process.exit(fail ? 1 : 0);
