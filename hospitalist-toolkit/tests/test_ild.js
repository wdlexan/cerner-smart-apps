/* node tests/test_ild.js - hand-worked checks of the ILD tab rules and chart parsing */
const R = require("../tools/ild/rules.js");
const C = require("../tools/ild/chart.js");
const S = require("../tools/ild/samples.js");
let fail = 0;
const ok = (n, c) => { if (!c) fail++; console.log((c ? "ok   " : "FAIL ") + n); };
const eq = (n, g, w) => { const o = g === w; if (!o) fail++; console.log((o ? "ok   " : "FAIL ") + n + ": got " + g + ", want " + w); };
const has = (fl, re, level) => fl.some((x) => re.test(x.text) && (!level || x.level === level));

// classification
eq("IPF", R.classify(["Idiopathic pulmonary fibrosis J84.112"]).sub.map((x) => x.id).join(), "ipf");
eq("HP", R.classify(["Chronic hypersensitivity pneumonitis"]).sub.map((x) => x.id).join(), "hp");
eq("aspiration pneumonitis is not ILD", R.classify(["Aspiration pneumonitis J69.0"]).has, false);
eq("RA picked up as CTD", R.classify(["Rheumatoid arthritis", "Interstitial lung disease"]).ctd.map((x) => x.id).join(), "ra");
eq("fibrotic flag", R.classify(["Idiopathic pulmonary fibrosis"]).fibrotic, true);
// CT words
const ids = (t) => R.ctFindings(t).map((x) => x.id).join(",");
ok("honeycomb + ggo", /honeycomb/.test(ids("Honeycombing with new ground-glass")) && /ggo/.test(ids("Honeycombing with new ground-glass")));
eq("'no pulmonary embolism' is not PE", /(^|,)pe(,|$)/.test(ids("No pulmonary embolism.")), false);
ok("'no pulmonary embolism' recorded as no PE", /nope/.test(ids("No pulmonary embolism.")));
ok("PE found", /(^|,)pe(,|$)/.test(ids("Filling defects in the right lower lobe pulmonary arteries.")));
// prednisone equivalent
eq("prednisone 30 mg daily", R.predEq("prednisone 30 mg PO daily"), 30);
eq("dexamethasone 4 mg BID ≈ 53", Math.round(R.predEq("dexamethasone 4 mg PO BID")), 53);
// GAP: male(1) + age 76 (2) + FVC 62 (1) + DLCO 30 (2) = 6 → stage III
const g = R.gap({ sex: "male", age: 76, fvc: 62, dlco: 30 });
eq("GAP score", g.score, 6); eq("GAP stage", g.stage, "III");
eq("GAP female 58, FVC 85, DLCO 70 = 0", R.gap({ sex: "female", age: 58, fvc: 85, dlco: 70 }).score, 0);
eq("GAP no DLCO adds 3", R.gap({ sex: "female", age: 58, fvc: 85, dlcoNA: true }).score, 3);
// AE criteria
eq("AE all four", R.aeCriteria({ dx: 1, lt1m: 1, newggo: 1, notHF: 1 }).met, true);
eq("AE three", R.aeCriteria({ dx: 1, lt1m: 1, newggo: 1 }).met, false);
// pneumotox matching
eq("amiodarone strong", R.pneumotox(["amiodarone 200 mg"]).map((d) => d.name + d.strong).join(), "Amiodaronetrue");
eq("no false match", R.pneumotox(["acetaminophen 650 mg"]).length, 0);

// samples
const now = Date.now(), F = S.map((s) => C.parse(s.build(now), { now })), FL = F.map((f) => R.flags(f, now));
ok("A: O2 rising red", has(FL[0], /Oxygen need rising \(2 → 6/, "red"));
ok("A: possible acute exacerbation red", has(FL[0], /possible acute exacerbation/, "red"));
ok("A: goals of care at 6 L", has(FL[0], /intubation rarely helps/));
ok("A: CTPA seen", F[0].ctpaRecent === true);
ok("A: no 'PE' flag when CTPA negative", !has(FL[0], /mentions pulmonary embolism/));
ok("A: no serology nag for IPF", !has(FL[0], /No autoimmune serology/));
ok("B: amiodarone red", has(FL[1], /^Amiodarone/, "red"));
ok("B: nitrofurantoin red", has(FL[1], /^Nitrofurantoin/, "red"));
ok("C: methotrexate red", has(FL[2], /^Methotrexate/, "red"));
ok("C: no AE flag without O2 rise", !has(FL[2], /possible acute exacerbation/));
ok("C: no PJP nag for prednisone 5 + MTX", !has(FL[2], /PJP prophylaxis/));
ok("D: MDA5 red", has(FL[3], /anti-MDA5/, "red"));
ok("D: CK anti-synthetase", has(FL[3], /CK 2400/));
ok("D: ANA read as serology", F[3].serologySeen.includes("ANA"));
ok("E: PJP prophylaxis amber", has(FL[4], /≥20 mg\/day.*PJP/, "amber"));
ok("E: PJP suspicion (LDH)", has(FL[4], /PJP\? Beta-D-glucan/));
ok("F: pirfenidone + ciprofloxacin", has(FL[5], /Pirfenidone with ciprofloxacin/, "amber"));
ok("F: steroids in IPF", has(FL[5], /IPF on steroids/));
ok("F: ALT on pirfenidone", has(FL[5], /ALT 150 on pirfenidone/));
ok("flags sorted", FL.every((fl) => fl.every((x, i) => i === 0 || ["red", "amber", "info"].indexOf(fl[i - 1].level) <= ["red", "amber", "info"].indexOf(x.level))));
ok("note builds", /My decision: x/.test(R.note({ ild: "IPF", decision: "x" })));

console.log(fail ? `\n${fail} FAILED` : "\nall passed");
process.exit(fail ? 1 : 0);
