/* node tests/test_abxmap.js - antibiotic chooser rules and chart parsing */
global.window = {};
require("../tools/infections/infections-data.js"); require("../tools/abxmap/extra-sites.js"); require("../tools/abxmap/samples.js"); // extra-sites now empty: sepsis and cdiff live in INF_SITES
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
ok("C. diff: recurrence rows and card", site("cdiff").abx.filter((r) => /recurrence/i.test(r.setting)).length >= 3 && /Recurrent/.test(site("cdiff").cards[0].title));
ok("C. diff and sepsis are in the shared infections data", window.INF_SITES.some((s) => s.id === "cdiff") && window.INF_SITES.some((s) => s.id === "sepsis"));
ok("oral vanco taper not flagged as IV", st("Fidaxomicin or vancomycin taper and pulse", { crcl: 20 }) === "ok");
ok("IV vanco still flagged", st("Piperacillin-tazobactam 4.5 g IV q6h + vancomycin IV", { crcl: 20 }) === "caution");
ok("ivVanco: 'vancomycin 500 mg PO/NG QID' is oral", !R.ivVanco("Vancomycin 500 mg PO/NG QID + metronidazole 500 mg IV q8h"));
// culture & sensitivities
const ocr = require("fs").readFileSync(__dirname + "/fixtures-susc-ocr.txt", "utf8"); // real Tesseract output of a made-up 2-organism screenshot
let sp = R.parseSusc(ocr);
ok("OCR: 2 organisms", sp.organisms.length === 2, sp.organisms);
ok("OCR: 12 antibiotics", sp.rows.length === 12, sp.rows.map((r) => r.drug));
ok("OCR: cefepime S/R, cipro S/I", sp.rows.find((r) => r.drug === "cefepime").results.join("/") === "S/R" && sp.rows.find((r) => r.drug === "ciprofloxacin").results.join("/") === "S/I");
sp = R.expandSusc(sp);
ok("Pseudomonas -> ertapenem inferred R", sp.rows.some((r) => r.drug === "ertapenem" && r.derived && r.results[0] === "R"));
let as = R.assess("Cefepime 2 g IV q8h or piperacillin-tazobactam", { allergy: "none", risks: {}, susc: sp });
ok("first-choice cefepime R -> avoid; pip-tazo S noted", as.status === "avoid" && as.notes.some((n) => n.s === "good" && /piperacillin/.test(n.msg)));
as = R.assess("Piperacillin-tazobactam 4.5 g IV q6h (or cefepime 2 g IV q8h)", { allergy: "none", risks: {}, susc: sp });
ok("cefepime only as alternative -> caution", as.status === "caution");
sp = R.expandSusc(R.parseSusc("Staphylococcus aureus\nOxacillin  >=4  R\nVancomycin  1  S\nClindamycin  R\nTrimethoprim/Sulfamethoxazole  S"));
ok("oxacillin R -> MRSA, cefazolin inferred R", sp.flags.mrsa && sp.rows.some((r) => r.drug === "cefazolin" && r.results[0] === "R"));
sp = R.expandSusc(R.parseSusc("Escherichia coli, ESBL producer. Resistant to ceftriaxone and ciprofloxacin; susceptible to ertapenem, nitrofurantoin, TMP-SMX."));
ok("prose report: ESBL, cipro R, nitrofurantoin S", sp.flags.esbl && sp.rows.find((r) => r.drug === "ciprofloxacin").results[0] === "R" && sp.rows.find((r) => r.drug === "nitrofurantoin").results[0] === "S");
ok("OCR noise 'S$' / '§$' read as S", R.parseSusc("Gentamicin <=1 §$\nTobramycin <=1 S$").rows.every((r) => r.results[0] === "S"));
// consult message
let cm = R.consultMsg({ drName: "Lee", service: "ID", name: "Alma TEST", age: 81, sex: "female", mrn: "TEST0001", site: site("skin"), tier: "moderate", abx: ["cefazolin 2 g IV q8h"], allergy: "pen-severe", reason: "S. aureus bacteremia (always)" });
ok("consult: format start and end", /^Hello Dr\. Lee,\n\nThis is Wayne, hospitalist\. I have Alma TEST, 81, MRN TEST0001/.test(cm.text) && /Your help is much appreciated\.\n\nThanks,\nWayne$/.test(cm.text), cm.text);
ok("consult: about 50 words", cm.words <= 60, cm.words);
ok("consult: says skin infection, current antibiotic, allergy and the ask", /skin and soft tissue infection/.test(cm.text) && /cefazolin/.test(cm.text) && /anaphylaxis/.test(cm.text) && /advice on s\. aureus bacteremia\?/i.test(cm.text), cm.text);
cm = R.consultMsg({ service: "General surgery", age: 70, sex: "male", site: site("biliary"), tier: "severe", abx: [], allergy: "none", reason: "", extra: "Lactate 4 despite fluids, CT shows dilated CBD with stone, needs ERCP or drainage and surgical opinion on gallbladder today please" });
ok("consult: long extra still trimmed to ~55 words", cm.words <= 60, cm.words);
ok("consult: blank doctor and MRN placeholders", /Hello Dr\. ___/.test(cm.text) && /MRN ___/.test(cm.text));
ok("one-line report: organism found", R.parseSusc("Escherichia coli >10^8 CFU/L, ESBL producer. Resistant to ceftriaxone and ciprofloxacin; susceptible to ertapenem.").organisms[0] === "Escherichia coli");
// several screenshots: PowerChart grid row numbers, one column per result, same organism kept apart and flagged
const ecoli = R.parseSusc("Urine Culture - Accession: 000002025009003905\nResult Status - Auth (Verified)\n1 Escherichia coli\n2 MIC Intrp\n4 Ampicillin R\n5 Cefazolin R\n13 Ertapenem S\n15 Gentamicin S\n21 Trimethoprim/Sulfamethoxazole S");
ok("grid row numbers are not MICs", ecoli.rows.every((r) => r.mic === ""), ecoli.rows.map((r) => r.mic));
ok("header: urine, accession, verified", ecoli.meta.specimen === "Urine" && ecoli.meta.accession === "000002025009003905" && /verified/i.test(ecoli.meta.status) && !ecoli.meta.modified, ecoli.meta);
const psA = R.parseSusc("Result Status - Modified\n1 Pseudomonas aeruginosa\n2 E Interp\n3 Ceftazidime* I\n4 Ciprofloxacin R\n5 Gentamicin S\n6 Piperacillin/Tazobactam R\n7 Tobramycin S");
const psB = R.parseSusc("Result Status - Auth (Verified)\n1 Pseudomonas aeruginosa\n2 MIC Intrp\n3 Ceftazidime S\n4 Ciprofloxacin R\n5 Gentamicin S\n6 Piperacillin/Tazobactam S\n7 Tobramycin S");
ok("Pseudomonas grid: 5 drugs, ceftazidime footnote, modified", psA.rows.length === 5 && psA.rows.find((r) => r.drug === "ceftazidime").footnote && psA.meta.modified, psA);
const mg = R.mergeSusc([{ p: ecoli }, { p: psA }, { p: psB }]);
ok("merge: 3 columns, 2 organism names", mg.cols.length === 3 && mg.organisms.length === 2, mg.cols);
ok("merge: Pseudomonas results disagree on pip-tazo and ceftazidime", mg.discord.map((d) => d.drug).sort().join() === "ceftazidime,piperacillin-tazobactam", mg.discord);
ok("merge: gentamicin S in all three", mg.rows.find((r) => r.drug === "gentamicin").allS);
const ert = mg.rows.find((r) => r.drug === "ertapenem");
ok("merge: Pseudomonas ertapenem inferred only in the Pseudomonas columns", ert.results.join() === "S,R,R" && !ert.inf[0] && ert.inf[1], ert);
ok("merge: worst result drives the regimen badge", R.assess("Piperacillin-tazobactam 4.5 g IV q6h", { allergy: "none", risks: {}, susc: mg }).status === "avoid");
const mk = R.mergeSusc([{ p: R.parseSusc(ocr) }]);
const kEr = mk.rows.find((r) => r.drug === "ertapenem");
ok("2-organism report: Pseudomonas-intrinsic R goes to the Pseudomonas column, not Klebsiella", kEr.results[0] === "" && kEr.results[1] === "R", kEr);
ok("same accession loaded twice is flagged", R.mergeSusc([{ p: ecoli }, { p: ecoli }]).dupes.length === 1);
const fz = R.parseSusc("| 1 | Escherichia coli |\n| 3 | Amoxicilin-Clavulinic Acid | S |\n| 9 | Ceftiaxone | R |\n| 14 | Fosfornycin | R |\n| 17 | Nitrofurantcin | S |\n| 18 | Piperacilin/T azobactam | S |\n| 19 | Tetracyciine* | S |\n| 21 | Trimethoprim-sulfamethoxazole | S |");
ok("OCR misspellings still read (ceftriaxone, nitrofurantoin, pip-tazo, amox-clav, fosfomycin)", ["amoxicillin-clavulanate:S", "ceftriaxone:R", "fosfomycin:R", "nitrofurantoin:S", "piperacillin-tazobactam:S", "tetracycline:S", "tmp-smx:S"].every((x) => fz.rows.some((r) => r.drug + ":" + r.results[0] === x)), fz.rows);
ok("header lines are not read as drugs", R.parseSusc("Result Status - Modified\nMicro Reports Susceptibilities Specimen Action List\n1 Escherichia coli\n4 Ampicillin R").rows.length === 1);
console.log(fail ? `\n${fail} FAILED` : "\nall passed"); process.exit(fail ? 1 : 0);
