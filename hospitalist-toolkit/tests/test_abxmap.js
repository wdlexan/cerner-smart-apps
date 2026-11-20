/* node tests/test_abxmap.js - antibiotic chooser rules and chart parsing */
global.window = {};
require("../tools/infections/infections-data.js"); require("../tools/abxmap/extra-sites.js"); require("../tools/abxmap/samples.js");
const R = require("../tools/abxmap/rules.js"), C = require("../tools/abxmap/chart.js");
let fail = 0;
const ok = (n, c, x) => { if (!c) fail++; console.log((c ? "ok   " : "FAIL ") + n + (!c && x !== undefined ? " | " + JSON.stringify(x).slice(0, 300) : "")); };
const st = (txt, c) => R.assess(txt, Object.assign({ allergy: "none", risks: {} }, c)).status;
const SITES = window.INF_SITES.concat(window.ABXMAP_EXTRA_SITES), site = (id) => SITES.find((s) => s.id === id);

// drug classes
ok("pip-tazo is a penicillin", R.drugsIn("Piperacillin-tazobactam 4.5 g").some((d) => d.cls === "pen"));
ok("cephalexin flagged as amoxicillin side chain", R.drugsIn("Cephalexin 500 mg").some((d) => d.sharedSide));
ok("ceftriaxone is ceph, not shared side chain", R.drugsIn("Ceftriaxone 2 g").every((d) => !d.sharedSide) && R.drugsIn("Ceftriaxone 2 g").some((d) => d.ceph));
// allergy
ok("pen anaphylaxis: amoxicillin avoid", st("Amoxicillin 1 g PO TID", { allergy: "pen-severe" }) === "avoid");
ok("pen anaphylaxis: cephalexin avoid", st("Cephalexin 500 mg PO QID", { allergy: "pen-severe" }) === "avoid");
ok("pen anaphylaxis: cefazolin caution", st("Cefazolin 2 g IV q8h", { allergy: "pen-severe" }) === "caution");
ok("pen anaphylaxis: vancomycin ok", st("Vancomycin IV", { allergy: "pen-severe" }) === "ok");
ok("non-severe pen: ceftriaxone ok", st("Ceftriaxone 1 g IV daily", { allergy: "pen-mild" }) === "ok");
ok("non-severe pen: amoxicillin caution", st("Amoxicillin 1 g PO TID", { allergy: "pen-mild" }) === "caution");
ok("SJS to beta-lactam: meropenem avoid", st("Meropenem 1 g IV q8h", { allergy: "bl-delayed" }) === "avoid");
ok("sulfa: TMP-SMX avoid", st("TMP-SMX 1 DS BID", { sulfa: true }) === "avoid");
// kidney, interactions
ok("CrCl 25: nitrofurantoin avoid", st("Nitrofurantoin 100 mg PO BID", { crcl: 25 }) === "avoid");
ok("CrCl 60: nitrofurantoin ok", st("Nitrofurantoin 100 mg PO BID", { crcl: 60 }) === "ok");
ok("valproate: meropenem avoid", st("Meropenem 1 g IV q8h", { valproate: true }) === "avoid");
ok("QT: levofloxacin caution", st("Levofloxacin 750 mg daily", { qtRisk: true }) === "caution");
ok("warfarin: metronidazole caution", st("Metronidazole 500 mg q12h", { warfarin: true }) === "caution");
ok("SSRI: linezolid caution", st("Linezolid 600 mg q12h", { serotonergic: true }) === "caution");
ok("PO vancomycin with CrCl 20 not flagged", st("Vancomycin 125 mg PO QID", { crcl: 20 }) === "ok");
// choose: risks move rows
let ch = R.choose(site("lung"), "severe", { allergy: "none", risks: {} });
ok("lung severe: MRSA row hidden under 'if risk' without MRSA risk", ch.ifRisk.some((i) => /MRSA/.test(i.row.setting)) && !ch.matched.length);
ch = R.choose(site("lung"), "severe", { allergy: "none", risks: { mrsa: true } });
ok("lung severe + MRSA risk: MRSA row matched", ch.matched.some((i) => /MRSA/.test(i.row.setting)));
ch = R.choose(site("sepsis"), "severe", { allergy: "none", risks: { esbl: true } });
ok("sepsis + ESBL: meropenem row matched", ch.matched.some((i) => /Meropenem/.test(i.row.regimen)));
ok("every site has regimens", SITES.every((s) => (s.abx || []).length), SITES.filter((s) => !(s.abx || []).length).map((s) => s.id));
ok("allergy lines for severe", R.allergyLines(site("skin"), "pen-severe").some((x) => /Severe/.test(x)));
ok("CrCl CG 81F 52kg Cr140 = 23", R.crcl(81, 52, 140, "female") === 23, R.crcl(81, 52, 140, "female"));
// chart samples
const S = window.ABXMAP_SAMPLES, now = Date.now();
let f = C.parse(S[0].build(now), { now }), ac = C.allergyCtx(f.allergies);
ok("A: anaphylaxis -> pen-severe", ac.allergy === "pen-severe", ac);
ok("A: warfarin + sertraline", f.cls.warfarin.length && f.cls.serotonergic.length);
ok("A: skin site from problem list", site("skin").match.test(f.probs.map((p) => p.text).join(" ")));
f = C.parse(S[1].build(now), { now });
ok("B: ESBL from culture", f.micro.esbl.length === 1);
ok("B: valproate", f.cls.valproate.length === 1);
f = C.parse(S[2].build(now), { now }); ac = C.allergyCtx(f.allergies);
ok("C: MRSA from culture + problem", f.micro.mrsa.length >= 1);
ok("C: sulfa allergy", ac.sulfa && ac.allergy === "none");
ok("C: QTc 492", f.qtc && f.qtc.v === 492);
f = C.parse(S[3].build(now), { now }); ac = C.allergyCtx(f.allergies);
ok("D: pregnant", f.pregnant === true);
ok("D: childhood amoxicillin rash -> pen-mild", ac.allergy === "pen-mild", ac);
ok("SJS reaction -> bl-delayed", C.allergyCtx([{ sub: "Ceftriaxone", reac: "Stevens-Johnson syndrome", crit: "high" }]).allergy === "bl-delayed");
ok("note includes regimen and CrCl", /Antibiotic: Cefazolin/.test(R.note(site("skin"), "moderate", { row: { regimen: "Cefazolin 2 g IV q8h", setting: "x" }, a: { notes: [] } }, { allergy: "none", crcl: 40, risks: {} })));
ok("valproate: 'ceftriaxone (ertapenem if ESBL)' only caution", st("Ceftriaxone 1-2 g IV daily (ertapenem if ESBL); step down to a fluoroquinolone", { valproate: true }) === "caution");
ok("valproate: 'meropenem or cefepime' still avoid (first choice)", st("Meropenem 1 g IV q8h, or cefepime 2 g", { valproate: true }) === "avoid");
ok("pen anaphylaxis: 'vancomycin, or clindamycin' ok; 'ceftriaxone or amoxicillin' caution", st("Ceftriaxone 2 g IV daily, or amoxicillin-clavulanate", { allergy: "pen-severe" }) === "caution");
ok("CrCl 23: acyclovir caution", st("Acyclovir 10 mg/kg IV q8h", { crcl: 23 }) === "caution");
ok("meningitis and encephalitis are separate sites", site("mening") && site("enceph") && !site("mening").match.test("HSV encephalitis") && site("enceph").match.test("meningoencephalitis"));
ok("meningitis cards: CSF table, dexamethasone, unsure pathway", site("mening").cards.length === 3 && site("mening").cards[0].table.rows.length === 8);
ok("encephalitis cards mention DexEnceph", site("enceph").cards.some((c) => (c.items || []).some((x) => /DexEnceph/.test(x))));
console.log(fail ? `\n${fail} FAILED` : "\nall passed"); process.exit(fail ? 1 : 0);
