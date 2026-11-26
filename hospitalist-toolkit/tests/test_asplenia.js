/* node tests/test_asplenia.js  - hand-worked checks of the Asplenia rules and the made-up patients */
const R = require("../tools/asplenia/rules.js");
const C = require("../tools/asplenia/chart.js");
global.window = {}; require("../tools/asplenia/samples.js");
let fail = 0;
const ok = (n, c, extra) => { if (!c) fail++; console.log((c ? "ok   " : "FAIL ") + n + (c || extra == null ? "" : "  -> " + extra)); };
const eq = (n, g, w) => { const o = g === w; if (!o) fail++; console.log((o ? "ok   " : "FAIL ") + n + ": got " + g + ", want " + w); };
const DAY = 864e5, YEAR = 365.25 * DAY, now = Date.now();
const S = window.ASPLENIA_SAMPLES;
const get = (vp, id) => vp.items.find((i) => i.id === id);

// spleen status
eq("splenectomy -> anatomic", R.spleenStatus({ texts: ["Acquired absence of spleen Z90.81"] }).status, "anatomic");
eq("HbSS -> functional", R.spleenStatus({ texts: ["Sickle cell anemia HbSS D57.1"] }).status, "functional");
eq("sickle trait is not asplenia", R.spleenStatus({ texts: ["Sickle cell trait D57.3"] }).status, "none");
eq("celiac alone -> possible", R.spleenStatus({ texts: ["Celiac disease K90.0"] }).status, "possible");
eq("celiac + Howell-Jolly -> functional", R.spleenStatus({ texts: ["Celiac disease"], smear: "hj" }).status, "functional");
eq("partial splenectomy -> functional, not anatomic", R.spleenStatus({ texts: ["Partial splenectomy"] }).status, "functional");
eq("planned splenectomy", R.spleenStatus({ texts: ["Hereditary spherocytosis"], plannedT: now + 20 * DAY }).status, "planned");
eq("manual overrides", R.spleenStatus({ texts: ["Splenectomy"], manual: "none" }).status, "none");

// vaccine classification
eq("Prevnar 20", R.classify("Prevnar 20"), "pcv20"); eq("Capvaxive", R.classify("Capvaxive"), "pcv21"); eq("Prevnar 13", R.classify("Prevnar 13 (PCV13)"), "pcvOld");
eq("Pneumovax", R.classify("Pneumovax 23"), "ppv23"); eq("Menveo", R.classify("Menveo"), "menacwy"); eq("Menjugate", R.classify("Menjugate (Men-C-C)"), "menc");
eq("Bexsero", R.classify("Bexsero"), "menb4c"); eq("Trumenba", R.classify("Trumenba"), "menbfhbp"); eq("Act-HIB", R.classify("Act-HIB"), "hib"); eq("Fluzone", R.classify("Fluzone High-Dose"), "flu");

// pasted record
const pasted = R.parseImmText("Pneumococcal conjugate 20-valent  2024-10-02\nMenveo 12 Jan 2021\nTdap 2019-05-01\nBexsero Mar 3, 2022");
eq("pasted: 3 relevant lines (Tdap ignored)", pasted.length, 3);
eq("pasted: PCV20 date", R.fmtD(pasted[0].t), "2024-10-02"); eq("pasted: Menveo date", R.fmtD(pasted[1].t), "2021-01-12"); eq("pasted: Bexsero date", R.fmtD(pasted[2].t), "2022-03-03");

// vaccine plan: nothing given
let vp = R.vaccinePlan([], { now });
eq("none: pneumo due", get(vp, "pneumo").status, "due"); eq("none: ACWY due", get(vp, "acwy").status, "due"); eq("none: MenB due", get(vp, "menb").status, "due"); eq("none: Hib due", get(vp, "hib").status, "due");
// PCV20 done, no booster
vp = R.vaccinePlan([{ name: "PCV20", t: now - 2 * YEAR }], { now });
eq("PCV20 given -> done", get(vp, "pneumo").status, "done");
// PPV23 6 months ago -> PCV20 later (1 year after)
vp = R.vaccinePlan([{ name: "Pneumovax 23", t: now - 182 * DAY }], { now });
eq("PPV23 6 mo ago -> later", get(vp, "pneumo").status, "later");
ok("PPV23 6 mo ago -> next about 6 mo away", Math.abs(get(vp, "pneumo").next - (now + 183 * DAY)) < 3 * DAY);
// MenACWY: 1 dose 3 weeks ago -> dose 2 later; 2 doses 6 years ago -> booster due; Men-C doesn't count
vp = R.vaccinePlan([{ name: "Menveo", t: now - 21 * DAY }], { now });
eq("ACWY 1 dose 3 wk ago -> later", get(vp, "acwy").status, "later");
vp = R.vaccinePlan([{ name: "Menactra", t: now - 6.2 * YEAR }, { name: "Menactra", t: now - 6 * YEAR }], { now });
eq("ACWY 2 doses 6 y ago -> booster due", get(vp, "acwy").status, "due");
vp = R.vaccinePlan([{ name: "MenQuadfi", t: now - 2.2 * YEAR }, { name: "MenQuadfi", t: now - 2 * YEAR }], { now });
eq("ACWY 2 doses 2 y ago -> done", get(vp, "acwy").status, "done");
vp = R.vaccinePlan([{ name: "Menjugate", t: now - 10 * YEAR }], { now });
eq("Men-C only -> ACWY still due", get(vp, "acwy").status, "due");
// MenB
vp = R.vaccinePlan([{ name: "Bexsero", t: now - 60 * DAY }], { now });
eq("Bexsero x1 2 mo ago -> due", get(vp, "menb").status, "due");
vp = R.vaccinePlan([{ name: "Bexsero", t: now - 60 * DAY }, { name: "Trumenba", t: now - 20 * DAY }], { now });
eq("mixed MenB brands -> check", get(vp, "menb").status, "check");
vp = R.vaccinePlan([{ name: "Trumenba", t: now - 40 * DAY }], { now });
eq("Trumenba x1 40 d ago -> due (dose 2)", get(vp, "menb").status, "due");
// timing after splenectomy
vp = R.vaccinePlan([], { now, splenectomyT: now - 5 * DAY });
ok("splenectomy 5 d ago -> wait to day 14 message", vp.timing.some((t) => /14 days after surgery/.test(t.t)));
vp = R.vaccinePlan([], { now, plannedT: now + 20 * DAY });
ok("planned in 20 d -> give now", vp.timing.some((t) => /at least 2 weeks before surgery/.test(t.t)));

// prophylaxis
eq("1 y after splenectomy -> daily", R.prophylaxis({ yearsSince: 1 }).daily, true);
eq("10 y after, healthy -> standby only", R.prophylaxis({ yearsSince: 10, age: 50 }).daily, false);
eq("prior OPSI -> daily", R.prophylaxis({ yearsSince: 10, priorOPSI: true }).daily, true);
ok("SJS -> standby levofloxacin", /Levofloxacin/.test(R.prophylaxis({ allergy: "scar" }).standby[0]));
ok("no allergy -> standby amox-clav", /Amoxicillin-clavulanate/.test(R.prophylaxis({ allergy: "none" }).standby[0]));

// CURB-65
eq("CURB-65 3", R.curb65({ confusion: true, urea: 8, rr: 22, sbp: 120, dbp: 70, age: 70 }).score, 3);

// pneumonia antibiotics
let a = R.pneumoniaAbx({ setting: "ward", allergy: "none" });
ok("ward: ceftriaxone 2 g + azithro", a.reg[0].drug === "Ceftriaxone" && /2 g IV q24h/.test(a.reg[0].dose) && a.reg.some((r) => r.drug === "Azithromycin"));
ok("ward: no vancomycin", !a.reg.some((r) => r.drug === "Vancomycin"));
a = R.pneumoniaAbx({ setting: "icu", shock: true, allergy: "none", weight: 80 });
ok("shock: vancomycin added, 2000 mg load at 80 kg", a.reg.some((r) => r.drug === "Vancomycin" && /2000 mg/.test(r.dose)));
a = R.pneumoniaAbx({ setting: "ward", meningitis: true, allergy: "none", age: 60 });
ok("meningitis: ceftriaxone q12h, dexamethasone, ampicillin at 60", /q12h/.test(a.reg[0].dose) && a.add.some((r) => r.drug === "Dexamethasone") && a.add.some((r) => r.drug === "Ampicillin"));
a = R.pneumoniaAbx({ setting: "ward", allergy: "scar", crcl: 35 });
ok("SJS: levofloxacin, renal q48h at CrCl 35", a.reg[0].drug === "Levofloxacin" && /48 h/.test(a.reg[0].renal));
a = R.pneumoniaAbx({ setting: "ward", allergy: "immediate", pseudo: true });
ok("anaphylaxis + Pseudomonas: cefepime not pip-tazo", a.reg[0].drug === "Cefepime");
a = R.pneumoniaAbx({ setting: "ward", allergy: "none", flu: true, crcl: 45 });
ok("flu positive: oseltamivir 30 mg BID at CrCl 45", a.add.some((r) => r.drug === "Oseltamivir" && /30 mg BID/.test(r.renal)));

// OPSI
eq("shock + purpura -> urgent", R.opsi({ sbp: 80, purpura: true }).lvl, "urgent");
eq("fever + HR 115 -> action", R.opsi({ temp: 38.6, hr: 115 }).lvl, "action");
eq("cirrhosis: low plt + INR alone not OPSI", R.opsi({ temp: 38.7, plt: 96, inr: 1.6, liver: true }).lvl, "info");
eq("no cirrhosis: low plt + INR -> urgent (DIC)", R.opsi({ plt: 80, inr: 1.7 }).lvl, "urgent");
ok("anatomic + HJ: HJ not listed as a cause", !R.spleenStatus({ texts: ["Splenectomy"], smear: "hj" }).causes.length);

// made-up patients through the chart parser
const P = (i) => C.parse(S[i].build(now));
let f = P(0);
eq("A: anatomic", R.spleenStatus({ texts: f.probText, splenectomyT: f.splenectomyT }).status, "anatomic");
vp = R.vaccinePlan(f.imms, { now });
eq("A: PCV20 due (PPV23 10 y ago)", get(vp, "pneumo").status, "due"); eq("A: ACWY due (Men-C only)", get(vp, "acwy").status, "due"); eq("A: Hib done", get(vp, "hib").status, "done");
ok("A: ceftriaxone 1 g in orders", f.cls.abx.some((x) => /ceftriaxone 1 g/i.test(x)));
f = P(1);
eq("B: splenectomy found", !!f.splenectomyT, true); eq("B: low-risk allergy", f.allergy, "low"); eq("B: Howell-Jolly", f.smear, "hj");
eq("B: VTE prophylaxis recognized", f.cls.vteProph.length, 1);
f = P(2);
eq("C: functional (HbSS)", R.spleenStatus({ texts: f.probText }).status, "functional"); eq("C: immediate allergy", f.allergy, "immediate");
vp = R.vaccinePlan(f.imms, { now });
eq("C: ACWY booster due", get(vp, "acwy").status, "due"); eq("C: MenB dose 2 due", get(vp, "menb").status, "due"); eq("C: PCV20 due", get(vp, "pneumo").status, "due");
f = P(3);
eq("D: flu positive", f.flu, "pos"); ok("D: recent anti-CD20", f.recentImmuno.some((x) => /anti-CD20/.test(x))); eq("D: on prophylaxis", f.cls.proph.length, 1);
vp = R.vaccinePlan(f.imms, { now });
eq("D: pneumo done", get(vp, "pneumo").status, "done"); eq("D: ACWY done", get(vp, "acwy").status, "done"); eq("D: MenB done", get(vp, "menb").status, "done"); eq("D: flu done", get(vp, "flu").status, "done");
const crD = C.crcl(f.age, f.sex, 58, 118); ok("D: CrCl about 35 (" + crD + ")", crD >= 30 && crD <= 40);
f = P(4);
eq("E: SJS allergy", f.allergy, "scar"); eq("E: functional (celiac + HJ)", R.spleenStatus({ texts: f.probText, smear: f.smear }).status, "functional");
f = P(6);
eq("G: eculizumab found", f.cls.eculizumab.length, 1);
vp = R.vaccinePlan(f.imms, { now });
eq("G: Trumenba series done", get(vp, "menb").status, "done"); eq("G: ACWY booster due (7.3 y)", get(vp, "acwy").status, "due");
ok("G: eculizumab precaution urgent", R.precautions({ eculizumab: true }).some((p) => p.id === "ecul" && p.lvl === "urgent"));

console.log(fail ? `\n${fail} FAILED` : "\nall passed");
process.exit(fail ? 1 : 0);
