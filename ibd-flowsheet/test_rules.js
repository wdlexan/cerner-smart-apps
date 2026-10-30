/* node test_rules.js : tests the IBD rules, chart parsing and made-up patients. No browser needed. */
global.window = global; 
require("./data.js"); const R = require("./rules.js"); require("./chart.js"); require("./samples.js");
let pass = 0, fail = 0; const ok = (n, c) => { console.log((c ? "PASS " : "FAIL ") + n); c ? pass++ : fail++; };
const now = Date.now();
const build = (i) => { const b = window.IBD_SAMPLES[i].build(now); const f = window.IBDChart.parseChart(b.raw, { now }); return { b, f, S: { f, disease: b.disease, setting: b.setting, flaring: b.flaring, entries: b.entries || [], manualMeds: [], manualEndo: [] } }; };
const al = (i) => R.alerts(build(i).S, now), has = (a, re) => a.some((x) => re.test(x.text));

// scores
ok("partial Mayo 0 = remission", R.pmayo({ stools: 1, normalStools: 1, blood: 0, pga: 0 }).band === "remission");
ok("partial Mayo stool subscore 3 for 5+ above normal", R.pmayo({ stools: 7, normalStools: 1, blood: 1, pga: 1 }).stoolSub === 3);
ok("partial Mayo 9 = severe", R.pmayo({ stools: 9, normalStools: 1, blood: 3, pga: 3 }).score === 9 && R.pmayo({ stools: 9, normalStools: 1, blood: 3, pga: 3 }).band === "severe");
ok("partial Mayo moderate 5", R.pmayo({ stools: 4, normalStools: 1, blood: 2, pga: 1 }).band === "moderate");
ok("partial Mayo incomplete = null", R.pmayo({ stools: 4 }) === null);
ok("HBI 4 remission, 5 mild", R.hbi({ wellbeing: 1, pain: 1, stools: 2, mass: 0, comps: 0 }).band === "remission" && R.hbi({ wellbeing: 1, pain: 1, stools: 3, mass: 0, comps: 0 }).band === "mild");
ok("HBI 17 severe, 16 moderate", R.hbi({ wellbeing: 4, pain: 3, stools: 8, mass: 1, comps: 1 }).band === "severe" && R.hbi({ wellbeing: 4, pain: 3, stools: 8, mass: 1, comps: 0 }).band === "moderate");
ok("scoreEntry respects disease", !R.scoreEntry({ stools: 3, wellbeing: 1, pain: 1, mass: 0, blood: 0, pga: 0 }, "cd").pmayo && !!R.scoreEntry({ stools: 3, wellbeing: 1, pain: 1, mass: 0, blood: 0, pga: 0 }, "uc").pmayo === true);

// parsing
const A = build(0).f;
ok("A: age and sex read", A.age === 34 && A.sex === "female");
ok("A: disease Crohn and onset from problem list", A.disease === "cd" && A.onsetT && now - A.onsetT > 5 * 365 * 864e5);
ok("A: CRP series has 2 values in mg/L", A.labs.crp.length === 2 && A.labs.crp[1].v === 2);
ok("A: calprotectin matched by name with no code", A.labs.calpro.length === 2);
ok("A: adalimumab level not confused with other drugs", A.labs.ada.length === 1 && A.labs.ifx.length === 0);
ok("A: adalimumab classified as tnf", A.meds.filter((m) => m.drug === "adalimumab").length >= 3);
ok("A: endoscopy found with SES-CD 2", A.endo.length === 1 && A.endo[0].sescd === 2);
ok("A: weights read", A.weights.length === 2);
ok("A: text lab TB stays text", A.labs.tb.length === 1 && A.labs.tb[0].text === "Negative");
ok("A: WBC not mixed with neutrophils", A.labs.wbc.length === 1 && A.labs.anc.length === 0);
ok("A: HBsAg vs HBcAb vs HBsAb separated", A.labs.hbsag.length === 1 && A.labs.hbcab.length === 1 && A.labs.hbsab.length === 0);
const Eb = build(4).f;
ok("E: Rutgeerts i3 parsed", Eb.endo[0].rutgeerts === "i3");
ok("E: ustekinumab and cyanocobalamin classified", Eb.meds.some((m) => m.drug === "ustekinumab") && Eb.meds.some((m) => m.drug === "b12"));
ok("D: ibuprofen goes to the watch list, not a drug class", build(3).f.watch.some((w) => w.kind === "nsaid") && !build(3).f.meds.some((m) => /ibuprofen/i.test(m.name)));
ok("C: Hgb g/dL conversion", window.IBDChart.parseChart({ obs: [{ resourceType: "Observation", category: [{ coding: [{ code: "laboratory" }] }], code: { coding: [{ system: "http://loinc.org", code: "718-7" }], text: "Hemoglobin" }, effectiveDateTime: new Date().toISOString(), valueQuantity: { value: 10.2, unit: "g/dL" } }] }).labs.hgb[0].v === 102);
ok("CRP mg/dL converts to mg/L", window.IBDChart.parseChart({ obs: [{ resourceType: "Observation", category: [{ coding: [{ code: "laboratory" }] }], code: { text: "C reactive protein" }, effectiveDateTime: new Date().toISOString(), valueQuantity: { value: 1.2, unit: "mg/dL" } }] }).labs.crp[0].v === 12);

// medication state
let ms = R.meds(build(0).S, now), by = (id) => ms.find((m) => m.drug.id === id);
ok("A: adalimumab current", by("adalimumab").status === "current");
ms = R.meds(build(2).S, now);
ok("C: infliximab current (last 25 days ago, window 120)", ms.find((m) => m.drug.id === "infliximab").status === "current");
ok("C: azathioprine current via active order", ms.find((m) => m.drug.id === "azathioprine").status === "current");
const sd = build(2).S; sd.manualMeds = [{ drug: "azathioprine", cls: "immuno", t: now, type: "stopped", src: "entered", name: "x" }];
ok("manual stop wins", R.meds(sd, now).find((m) => m.drug.id === "azathioprine").status === "stopped");
const sh = build(2).S; sh.manualMeds = [{ drug: "infliximab", cls: "tnf", t: now, type: "held", src: "entered", name: "x" }];
ok("manual hold wins", R.meds(sh, now).find((m) => m.drug.id === "infliximab").status === "held");
const old = build(0).S; old.f.meds = old.f.meds.map((m) => Object.assign({}, m, { t: now - 400 * 864e5, reqActive: false }));
ok("old doses become past", R.meds(old, now).find((m) => m.drug.id === "adalimumab").status === "past");

// alerts
const a0 = al(0), a1 = al(1), a2 = al(2), a3 = al(3), a4 = al(4), a5 = al(5);
ok("A: no urgent alerts for a well patient", !a0.some((x) => x.level === "urgent"));
ok("A: no C diff nag when not flaring/outpatient", !has(a0, /C\. difficile/));
ok("B: severe UC urgent", a1.some((x) => x.level === "urgent" && /severe ulcerative colitis/i.test(x.text)));
ok("B: no C diff test flagged", has(a1, /No C\. difficile test/));
ok("B: no VTE prophylaxis flagged", has(a1, /VTE prophylaxis/));
ok("B: loperamide flagged", has(a1, /Loperamide/));
ok("B: low potassium in flare", has(a1, /Potassium 3\.1/));
ok("B: anemia with iron deficiency pattern", has(a1, /Anemia.*iron deficiency/));
ok("B: low albumin", has(a1, /Albumin 26/));
ok("B: weight loss", has(a1, /Weight down/));
ok("B: urgent sorted first", a1[0].level === "urgent");
ok("C: thiopurine with low WBC/ANC/ALT", has(a2, /thiopurine with WBC 2\.7.*ANC 1\.3.*ALT 96/));
ok("C: no TPMT result", has(a2, /TPMT/));
ok("C: infliximab level suggested", has(a2, /Infliximab with signs of active disease and no drug level/));
ok("C: no TB/HBV screen flagged", has(a2, /no TB test or hepatitis B screen/));
ok("C: low B12 and vitamin D", has(a2, /B12 128/) && has(a2, /vitamin D 38/));
ok("D: steroid 14 weeks", has(a3, /corticosteroid on record for about 14 weeks/));
ok("D: steroid with only vedolizumab = no 'no steroid sparing' nag", !has(a3, /no steroid-sparing/));
ok("D: NSAID flagged", has(a3, /NSAID on record/));
ok("D: glucose on steroid", has(a3, /Glucose 11\.8/));
ok("D: advanced therapy w/o screening", has(a3, /no TB test or hepatitis B screen/));
ok("D: surveillance colonoscopy reminder (10 y)", has(a3, /8 or more years/));
ok("E: B12 and vitamin D low", has(a4, /B12 98/) && has(a4, /vitamin D 44/));
ok("E: screening present so no screening nag", !has(a4, /no TB test/));
ok("F: C diff positive urgent", a5.some((x) => x.level === "urgent" && /C\. difficile result is POSITIVE/.test(x.text)));
ok("F: no endoscopy info", has(a5, /No endoscopy found/));
// edge cases
ok("empty chart: only the endoscopy info", R.alerts({ f: window.IBDChart.parseChart({}), disease: "unknown", setting: "outpatient", entries: [], manualMeds: [], manualEndo: [] }, now).every((x) => x.level === "info"));
ok("endoBand text", /mucosal healing/.test(R.endoBand({ mayo: 1 })) && /severe/.test(R.endoBand({ sescd: 20 })) && /recurrence/.test(R.endoBand({ rutgeerts: "i3" })));
ok("manual endoscopy removes 'no endoscopy' info", !has(R.alerts(Object.assign(build(5).S, { manualEndo: [{ t: now - 864e5, title: "x", mayo: 2, src: "entered" }] }), now), /No endoscopy found/));
ok("every drug regex compiles and classifies its own label", window.IBD.CLASSES.every((c) => c.drugs.every((d) => ["ironiv", "vte"].includes(d.id) || window.IBDChart.classifyDrug(d.label.split(" (")[0]) && window.IBDChart.classifyDrug(d.label.split(" (")[0]).drug === d.id)));
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
