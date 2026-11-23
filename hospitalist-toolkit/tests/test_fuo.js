/* node tests/test_fuo.js  - hand-worked checks of the FUO rules and the made-up patients */
const R = require("../tools/fuo/rules.js");
const C = require("../tools/fuo/chart.js");
global.window = {}; require("../tools/fuo/samples.js");
let fail = 0;
const ok = (n, c) => { if (!c) fail++; console.log((c ? "ok   " : "FAIL ") + n); };
const eq = (n, g, w) => { const o = g === w; if (!o) fail++; console.log((o ? "ok   " : "FAIL ") + n + ": got " + g + ", want " + w); };
const DAY = 864e5, now = Date.now();

// fever stats
const temps = [[50, 37.0], [44, 38.6], [26, 37.2], [20, 39.1], [2, 38.0]].map(([h, v]) => ({ t: now - h * 36e5, v }));
const fs = R.feverStats(temps, now);
eq("Tmax", fs.tmax.v, 39.1); eq("readings 38.3+", fs.episodes, 2); ok("no fever in 48 h is false", fs.afebrile48 === false);
// relative bradycardia
eq("rel brady found", R.relBrady([{ t: 0, v: 39.2 }], [{ t: 600000, v: 84 }]).found, true);
eq("rel brady not with HR 112", R.relBrady([{ t: 0, v: 39.2 }], [{ t: 0, v: 112 }]).found, false);
eq("rel brady skipped on beta-blocker", R.relBrady([{ t: 0, v: 39.2 }], [{ t: 0, v: 70 }], true).found, false);

// FUO type
eq("neutropenic wins", R.fuoType({ anc: 0.3, durationDays: 30 }).kind, "neutropenic");
eq("HIV", R.fuoType({ hiv: true, admittedDays: 4 }).kind, "hiv");
eq("HIV meets >3 d inpatient", R.fuoType({ hiv: true, admittedDays: 4 }).meets, true);
eq("nosocomial", R.fuoType({ admittedDays: 9, presentOnAdmission: false, culturesDays: 4 }).kind, "nosocomial");
eq("nosocomial meets", R.fuoType({ admittedDays: 9, presentOnAdmission: false, culturesDays: 4 }).meets, true);
eq("classic 35 d meets", R.fuoType({ durationDays: 35, feverEpisodes: 4 }).meets, true);
eq("classic 10 d not yet", R.fuoType({ durationDays: 10, feverEpisodes: 4 }).meets, false);
eq("unknown duration", R.fuoType({}).meets, null);

// HScore: Fardet worked example-style. temp 40.1 (49) + both organs (38) + 3 cytopenias (34) + ferritin 24000 (50) + TG 4.6 (64) + fib 1.1 (30) + AST 210 (19) + immuno (18) = 302
eq("HScore patient F", R.hscore({ tmax: 40.1, organ: 2, hb: 74, wbc: 1.8, plt: 38, ferritin: 24000, tg: 4.6, fib: 1.1, ast: 210, immuno: true }).score, 302);
// temp 38.0 (0), none (0), 1 cytopenia (0), ferritin 1500 (0), TG 1.2 (0), fib 4 (0), AST 25 (0) = 0
eq("HScore zero", R.hscore({ tmax: 38.0, organ: 0, hb: 120, wbc: 4, plt: 200, ferritin: 1500, tg: 1.2, fib: 4, ast: 25 }).score, 0);
// boundaries: 39.4 -> 33, ferritin 2000 -> 35, 6000 -> 35, 6001 -> 50, TG 1.5 -> 44, 4.0 -> 44, fib 2.5 -> 30, AST 30 -> 19
eq("HScore boundaries", R.hscore({ tmax: 39.4, organ: 1, hb: 92, wbc: 5, plt: 111, ferritin: 6000, tg: 4.0, fib: 2.5, ast: 30 }).score, 33 + 23 + 24 + 35 + 44 + 30 + 19);
eq("HScore 169 positive", R.hscore({ tmax: 39.5, organ: 1, hb: 90, wbc: 4, plt: 200, ferritin: 7000, tg: 1.0, fib: 3, ast: 50 }).score, 49 + 23 + 24 + 50 + 0 + 0 + 19);
ok("HScore 165 not positive", !R.hscore({ tmax: 39.5, organ: 1, hb: 90, wbc: 4, plt: 200, ferritin: 7000, tg: 1.0, fib: 3, ast: 50 }).positive);
ok("HScore partial lists missing", R.hscore({ tmax: 39 }).miss.includes("ferritin"));

// Yamaguchi
const y = R.yamaguchi({ fever39week: true, arthralgia2wk: true, rash: true, leukocytosis: true, soreThroat: true });
eq("Yamaguchi 5 with 4 major", y.meets, true);
eq("Yamaguchi 5 minor-heavy (1 major) fails", R.yamaguchi({ fever39week: true, soreThroat: true, nodesSpleen: true, liverAbn: true, anaRfNeg: true }).meets, false);

// GCA 2022
eq("GCA 76 F stiffness+headache+jaw+ESR = 9", R.gca2022({ age: 76, stiffness: true, headache: true, jawClaud: true, esrcrp: true }).score, 9);
eq("GCA meets", R.gca2022({ age: 76, stiffness: true, headache: true, jawClaud: true, esrcrp: true }).meets, true);
eq("GCA age 45 no entry", R.gca2022({ age: 45, headache: true, tabHalo: true }).meets, false);
eq("GCA halo alone 5 not enough", R.gca2022({ age: 70, tabHalo: true }).meets, false);

// drug fever
const df = R.drugFever([{ text: "phenytoin 100 mg PO TID", t: now - 7 * DAY }, { text: "metformin 500 mg", t: now - 100 * DAY }, { text: "allopurinol 100 mg", t: now - 200 * DAY }], now - 4 * DAY);
eq("drug fever finds 2 culprits", df.length, 2); eq("phenytoin fits first", df[0].text.startsWith("phenytoin") && df[0].fits, true); eq("allopurinol 196 d does not fit timing", df[1].fits, false);

// lab clues
const lc = R.labClues({ ferritin: { v: 12000 }, ldh: { v: 600 }, eos: { v: 0.9 }, hb: { v: 80 }, wbc: { v: 2 }, plt: { v: 50 }, ca: { v: 2.5 }, alb: { v: 25 } }, {});
const ids = lc.map((l) => l.id);
ok("ferritin10k", ids.includes("ferritin10k")); ok("cytopenias", ids.includes("cytopenias")); ok("ldh", ids.includes("ldh")); ok("eos", ids.includes("eos"));
ok("corrected Ca 2.5 + 0.3 = 2.8 high", ids.includes("hypercal"));

// differential
const dd = R.differential({ headache: 1, jawClaud: 1, esr100: 1, age50: 1, girdlePain: 1 });
eq("GCA top with GCA clues", dd[0].id, "gca");
eq("lymphoma top with nodes, spleen, LDH", R.differential({ lymphadenopathy: 1, splenomegaly: 1, ldh: 1, nightSweats: 1 })[0].id, "lymphoma");
eq("nothing with no clues", R.differential({}).length, 0);

// workup
const wu = R.workup({ cbc: { status: "done" } }, { backPain: 1 });
ok("stage 1 always indicated", wu.filter((w) => w.stage === 1).every((w) => w.indicated));
ok("MRI spine triggered by back pain", wu.find((w) => w.id === "mri").indicated);
ok("echo not triggered without clue", !wu.find((w) => w.id === "echo").indicated);
eq("cbc done kept", wu.find((w) => w.id === "cbc").status, "done");
ok("workup keeps test name", wu.find((w) => w.id === "cbc").t.startsWith("CBC"));

// treatment
const tx = R.treatment({ anc: 0.2 });
ok("neutropenic -> antibiotics now", tx.now.some((t) => /neutropenia/i.test(t)));
ok("stable: avoid empiric antibiotics", R.treatment({}).avoid.some((t) => /do NOT start empiric antibiotics/.test(t)));
ok("GCA vision -> IV methylpred", R.treatment({ gcaVision: true }).now.some((t) => /methylprednisolone/.test(t)));

// made-up patients through the chart parser
const S = window.FUO_SAMPLES;
eq("7 made-up patients", S.length, 7);
S.forEach((s, i) => {
  const f = C.parse(s.build(now));
  ok(`patient ${i + 1} parses with temperatures`, f.v.temp && f.v.temp.length >= 4);
  ok(`patient ${i + 1} has age`, f.age > 18);
});
const fA = C.parse(S[0].build(now));
eq("A: LDH read", C.latest(fA.l.ldh).v, 540); eq("A: 3 blood cultures", fA.tests.bc.length, 3); ok("A: CT report found", !!fA.reports.ct); ok("A: PET pending", fA.reports.pet[0].pending);
const fD = C.parse(S[3].build(now));
ok("D: antibiotic before first culture", fD.firstAbx < fD.firstBC); ok("D: valve on problem list", !!fD.prob.valve);
const fE = C.parse(S[4].build(now));
eq("E: eosinophils", C.latest(fE.l.eos).v, 1.1);
const feE = R.feverStats(fE.v.temp, now);
const dE = R.drugFever(fE.activeMeds, feE.first.t);
ok("E: phenytoin or ceftriaxone fits timing", dE.some((d) => d.fits));
ok("E: relative bradycardia", R.relBrady(fE.v.temp, fE.v.hr).found);
const fF = C.parse(S[5].build(now));
const L = (id) => C.latest(fF.l[id]).v;
eq("F: HScore from chart", R.hscore({ tmax: R.feverStats(fF.v.temp, now).tmax.v, organ: 2, hb: L("hb"), wbc: L("wbc"), plt: L("plt"), ferritin: L("ferritin"), tg: L("tg"), fib: L("fib"), ast: L("ast"), immuno: true }).score, 302);
const fC = C.parse(S[2].build(now));
eq("C: neutrophil % read separately", C.latest(fC.l.neutPct).v, 88); eq("C: ANC read", C.latest(fC.l.anc).v, 17);
const fG = C.parse(S[6].build(now));
eq("G: IGRA positive", fG.tests.igra[0].pos, true); ok("G: sputum AFB pending", fG.tests.afb[0].pending);

console.log(fail ? `\n${fail} FAILED` : "\nall passed");
process.exit(fail ? 1 : 0);
