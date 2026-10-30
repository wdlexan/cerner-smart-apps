/* Boundary tests for rules.js against the SCCRS / SCICANS tables. Run: node test_rules.js */
const R = require("./rules.js"); const H = 36e5, M = 6e4;
let pass = 0, fail = 0; const ok = (n, c) => { console.log((c ? "PASS " : "FAIL ") + n); c ? pass++ : fail++; };
const now = Date.UTC(2026, 9, 29, 20, 0, 0);
const base = () => ({ now, where: "home", baseSbp: 125, readings: [], doses: [], in: { hypo: "none", o2: "ra", feverMasked: false, fullDoseNoCRS: false, comorbid: false, g1persist: false, crsResolved: false, symptoms: {}, ice: { orient: 4, naming: 3, command: 1, writing: 1, attention: 1 }, iceT: now - H, baselineIce: 10, loc: "awake", seizure: "none", motor: "none", icp: "none" } });
const rd = (minAgo, temp, sbp, spo2) => ({ t: now - minAgo * M, temp, sbp, spo2, hr: 80, rr: 16 });
const crsOf = (mut) => { const S = base(); mut(S); return R.crs(S); };

// ---- CRS grading table
ok("no fever, nothing -> grade 0", crsOf((S) => { S.readings = [rd(10, 37.0, 125, 97)]; }).grade === 0);
ok("fever 38.0 exactly -> grade 1", crsOf((S) => { S.readings = [rd(10, 38.0, 125, 97)]; }).grade === 1);
ok("fever 37.9 -> grade 0", crsOf((S) => { S.readings = [rd(10, 37.9, 125, 97)]; }).grade === 0);
ok("fever + fluid-responsive hypotension -> 2", crsOf((S) => { S.readings = [rd(10, 38.5, 90, 97)]; S.in.hypo = "fluid"; }).grade === 2);
ok("fever + low-flow O2 -> 2", crsOf((S) => { S.readings = [rd(10, 38.5, 120, 94)]; S.in.o2 = "low"; }).grade === 2);
ok("fever + one vasopressor -> 3", crsOf((S) => { S.readings = [rd(10, 38.5, 80, 94)]; S.in.hypo = "one"; }).grade === 3);
ok("fever + high-flow O2 -> 3", crsOf((S) => { S.readings = [rd(10, 38.5, 120, 90)]; S.in.o2 = "high"; }).grade === 3);
ok("fever + multiple vasopressors -> 4", crsOf((S) => { S.readings = [rd(10, 39, 70, 90)]; S.in.hypo = "multi"; }).grade === 4);
ok("fever + positive pressure O2 -> 4", crsOf((S) => { S.readings = [rd(10, 39, 120, 90)]; S.in.o2 = "pp"; }).grade === 4);
ok("highest of hypotension/hypoxia wins", crsOf((S) => { S.readings = [rd(10, 39, 80, 90)]; S.in.hypo = "one"; S.in.o2 = "low"; }).grade === 3);
ok("fever 25h ago does not count", crsOf((S) => { S.readings = [rd(25 * 60, 39, 125, 97), rd(10, 37, 125, 97)]; }).grade === 0);
ok("no fever but hypotension -> provisional only", (() => { const c = crsOf((S) => { S.readings = [rd(10, 37, 88, 97)]; S.in.hypo = "fluid"; }); return c.grade === 0 && c.provisional === 2; })());
ok("fever masked checkbox counts as fever", crsOf((S) => { S.readings = [rd(10, 37, 125, 97)]; S.in.feverMasked = true; }).grade === 1);
ok("persistent grade 1 -> effective 2", crsOf((S) => { S.readings = [rd(10, 38.2, 125, 97)]; S.in.g1persist = true; }).effective === 2);
ok("grade 2 + comorbidities -> manage as 3", crsOf((S) => { S.readings = [rd(10, 38.5, 90, 97)]; S.in.hypo = "fluid"; S.in.comorbid = true; }).manageAs === 3);
ok("grade 1 + comorbidities stays manage as 1", crsOf((S) => { S.readings = [rd(10, 38.5, 125, 97)]; S.in.comorbid = true; }).manageAs === 1);

// ---- ICE and ICANS grading table
const ice = (o, n, c, w, a) => ({ orient: o, naming: n, command: c, writing: w, attention: a });
const nOf = (mut) => { const S = base(); mut(S); return R.icans(S); };
ok("ICE total 10", R.iceTotal(ice(4, 3, 1, 1, 1)) === 10);
ok("ICE blank item -> incomplete (null)", R.iceTotal({ orient: 4, naming: 3, command: 1, writing: 1, attention: "" }) === null);
ok("ICE caps at item max", R.iceTotal(ice(9, 9, 9, 9, 9)) === 10);
ok("ICE 10 -> grade 0, no notify", (() => { const n = nOf(() => {}); return n.grade === 0 && !n.notifyMRP; })());
ok("ICE 9 -> grade 1 and notify (below baseline)", (() => { const n = nOf((S) => { S.in.ice = ice(4, 3, 1, 1, 0); }); return n.grade === 1 && n.notifyMRP; })());
ok("ICE 7 -> grade 1", nOf((S) => { S.in.ice = ice(4, 3, 0, 0, 0); }).grade === 1);
ok("ICE 6 -> grade 2", nOf((S) => { S.in.ice = ice(4, 2, 0, 0, 0); }).grade === 2);
ok("ICE 3 -> grade 2", nOf((S) => { S.in.ice = ice(3, 0, 0, 0, 0); }).grade === 2);
ok("ICE 2 -> grade 3", nOf((S) => { S.in.ice = ice(2, 0, 0, 0, 0); }).grade === 3);
ok("ICE 0 awake -> grade 3", nOf((S) => { S.in.ice = ice(0, 0, 0, 0, 0); }).grade === 3);
ok("ICE 0 unrousable -> grade 4", nOf((S) => { S.in.ice = ice(0, 0, 0, 0, 0); S.in.loc = "unrousable"; }).grade === 4);
ok("awakens to voice alone -> 2", nOf((S) => { S.in.loc = "voice"; }).grade === 2);
ok("tactile only -> 3", nOf((S) => { S.in.loc = "tactile"; }).grade === 3);
ok("any seizure -> 3", nOf((S) => { S.in.seizure = "g3"; }).grade === 3);
ok("prolonged seizure -> 4", nOf((S) => { S.in.seizure = "g4"; }).grade === 4);
ok("focal motor weakness -> 4", nOf((S) => { S.in.motor = "g4"; }).grade === 4);
ok("focal edema -> 3, diffuse -> 4", nOf((S) => { S.in.icp = "g3"; }).grade === 3 && nOf((S) => { S.in.icp = "g4"; }).grade === 4);
ok("most severe domain wins (ICE 8 + seizure)", nOf((S) => { S.in.ice = ice(4, 3, 1, 0, 0); S.in.seizure = "g3"; }).grade === 3);
ok("ICE not done -> not graded from ICE", (() => { const n = nOf((S) => { S.in.ice = {}; }); return n.grade === 0 && !n.done; })());
ok("baseline ICE 9, score 9 -> no notify", !nOf((S) => { S.in.baselineIce = 9; S.in.ice = ice(4, 3, 1, 1, 0); }).notifyMRP);

ok("ICE override uses recorded total", (() => { const n = nOf((S) => { S.in.ice = { orient: "", naming: "", command: "", writing: "", attention: "" }; S.in.iceTotalOverride = 6; }); return n.grade === 2 && n.total === 6 && n.done; })());

// ---- fever pattern (home)
const fp = (list) => R.feverPattern(list, now);
ok("single fever: no persist, no recur", (() => { const f = fp([rd(10, 38.3)]); return f.febrileNow && !f.persist && !f.recur; })());
ok("fever run 60 min -> persist", fp([rd(70, 38.2), rd(10, 38.3)]).persist === true);
ok("fever run 45 min -> not persist", fp([rd(55, 38.2), rd(10, 38.3)]).persist === false);
ok("afebrile latest -> not febrile", fp([rd(70, 38.5), rd(10, 37.2)]).febrileNow === false);
ok("recurs within 6 h", (() => { const f = fp([rd(200, 38.5), rd(120, 37.2), rd(10, 38.4)]); return f.recur === true && f.persist === false; })());
ok("fever 7 h earlier does not count as recurrence", fp([rd(430, 38.5), rd(300, 37.2), rd(10, 38.4)]).recur === false);

// ---- alerts
const al = (mut) => { const S = base(); mut(S); return R.alerts(S).map((a) => a.id); };
ok("SBP 99 -> bolus alert", al((S) => { S.readings = [rd(5, 37, 99, 97)]; }).includes("sbp"));
ok("SBP 100 baseline 125 (drop 25) -> alert", al((S) => { S.readings = [rd(5, 37, 100, 97)]; }).includes("sbp"));
ok("SBP 105 baseline 125 (drop 20) -> no alert", !al((S) => { S.readings = [rd(5, 37, 105, 97)]; }).includes("sbp"));
ok("SBP 104 baseline 125 (drop 21) -> alert", al((S) => { S.readings = [rd(5, 37, 104, 97)]; }).includes("sbp"));
ok("SpO2 92 -> oxygen alert; 93 -> none", al((S) => { S.readings = [rd(5, 37, 120, 92)]; }).includes("spo2") && !al((S) => { S.readings = [rd(5, 37, 120, 93)]; }).includes("spo2"));
ok("home fever persists -> present alert", al((S) => { S.readings = [rd(70, 38.2, 125, 97), rd(10, 38.3, 125, 97)]; }).includes("homefever"));
ok("same at facility -> no home rule", !al((S) => { S.where = "facility"; S.readings = [rd(70, 38.2, 125, 97), rd(10, 38.3, 125, 97)]; }).includes("homefever"));
ok("home BP rule: 95 vs base 125 and <100", al((S) => { S.readings = [rd(5, 37, 95, 97)]; }).includes("homebp"));
ok("home symptoms: dizziness -> alert", al((S) => { S.in.symptoms = { dizziness: true }; }).includes("homesym"));
ok("full dose without CRS + fever -> fullnocrs", al((S) => { S.in.fullDoseNoCRS = true; S.readings = [rd(5, 38.4, 125, 97)]; }).includes("fullnocrs"));
ok("ICE 8 -> icenotify", al((S) => { S.in.ice = ice(4, 3, 1, 0, 0); }).includes("icenotify"));
ok("both CRS and ICANS -> concurrent alert", al((S) => { S.readings = [rd(5, 38.4, 125, 97)]; S.in.loc = "voice"; }).includes("both"));
ok("urgent alerts sort first", (() => { const S = base(); S.readings = [rd(5, 37, 90, 97)]; const a = R.alerts(S); return a[0].level === "urgent"; })());

// ---- doses and tocilizumab
const dS = (doses) => { const S = base(); S.doses = doses; return S; };
const toci = (hAgo) => ({ drug: "toci", t: now - hAgo * H }), tec = (hAgo, label) => ({ drug: "tec", t: now - hAgo * H, label });
ok("48 h window: 47 h inside, 49 h outside", R.doseInfo(dS([tec(47)])).inWindow && !R.doseInfo(dS([tec(49)])).inWindow);
ok("tocilizumab counts: 3 in 24 h", R.doseInfo(dS([toci(20), toci(12), toci(4), toci(60)])).toci24 === 3);
ok("limit alert at 3 in 24 h", R.alerts(dS([toci(20), toci(12), toci(4)])).some((a) => a.id === "tocilimit"));
ok("limit alert at 4 total", R.alerts(dS([toci(100), toci(80), toci(60), toci(40)])).some((a) => a.id === "tocilimit"));
ok("no limit alert at 2", !R.alerts(dS([toci(20), toci(4)])).some((a) => a.id === "tocilimit"));
ok("tocilizumab near first teclistamab found", (() => { const d = R.doseInfo(dS([tec(30, "Step-up 1"), toci(31)])); return d.tociNearFirst && Math.abs(d.tociNearFirst.diffH + 1) < 0.01; })());
ok("tocilizumab 60 h away is not 'near'", R.doseInfo(dS([tec(100), toci(30)])).tociNearFirst === null);
ok("dose 8 mg/kg: 70 kg -> 560", R.tociDose(70).mg === 560);
ok("dose capped at 800 mg: 105 kg", (() => { const d = R.tociDose(105); return d.mg === 800 && d.capped; })());
ok("dose 100 kg -> exactly 800, not capped", (() => { const d = R.tociDose(100); return d.mg === 800 && !d.capped; })());
ok("no weight -> null", R.tociDose(null) === null);

// ---- stable 4 h
const st = (rs, base2) => { const S = base(); S.readings = rs; S.baseSbp = base2 || 125; return R.stable4h(S); };
ok("normal for 4.5 h -> ok", st([rd(10, 36.9, 124, 96), rd(120, 37, 126, 96), rd(270, 37.1, 125, 97)]).ok);
ok("normal for 2 h only -> not ok", !st([rd(10, 36.9, 124, 96), rd(120, 37, 126, 96), rd(300, 38.4, 125, 97)]).ok);
ok("latest reading 3 h old -> not ok", !st([rd(180, 36.9, 124, 96), rd(500, 37, 126, 96)]).ok);
ok("SBP 98 breaks normal", !st([rd(10, 37, 98, 96), rd(300, 37, 125, 96)]).ok);

// ---- monitoring due
const du = (mut) => { const S = base(); mut(S); return R.dueTimes(S, R.crs(S), R.icans(S)); };
ok("grade 1 CRS: hourly, 70 min since last -> overdue", du((S) => { S.readings = [rd(70, 38.4, 125, 97)]; }).vitals.overdue === true);
ok("grade 1 CRS: 30 min since last -> not overdue", du((S) => { S.readings = [rd(30, 38.4, 125, 97)]; }).vitals.overdue === false);
ok("grade 3: interval 15 min", du((S) => { S.readings = [rd(5, 39, 80, 90)]; S.in.hypo = "one"; }).vitals.interval === 15);
ok("ICANS: ICE overdue after 9 h", du((S) => { S.in.ice = ice(4, 3, 1, 0, 0); S.in.iceT = now - 9 * H; }).ice.overdue === true);
ok("ICE 10, no ICANS: no ICE timer", du(() => {}).ice === undefined);

// ---- merge
ok("merge: entered value wins at same minute and newest first", (() => { const m = R.mergeReadings([{ t: now - 10 * M, temp: 37, sbp: 120 }, { t: now - 70 * M, temp: 36.8 }], [{ t: now - 10 * M + 5000, temp: 38.4 }]); return m.length === 2 && m[0].temp === 38.4 && m[0].sbp === 120; })());


// ---- placement (where the patient should be)
const pl = (mut, where) => { const S = base(); if (where) S.where = where; mut(S); return R.placement(S, R.crs(S), R.icans(S)); };
ok("placement: nothing at home -> home", pl((S) => { S.readings = [rd(5, 37, 125, 97)]; }).key === "home");
ok("placement: nothing at facility -> facility", pl((S) => { S.readings = [rd(5, 37, 125, 97)]; }, "facility").key === "facility");
ok("placement: grade 1 at home, single fever -> home with hourly checks", (() => { const p = pl((S) => { S.readings = [rd(5, 38.3, 125, 97)]; }); return p.key === "home" && /hourly/i.test(p.title); })());
ok("placement: grade 1 at facility -> ward", pl((S) => { S.readings = [rd(5, 38.3, 125, 97)]; }, "facility").key === "ward");
ok("placement: home fever persists -> ER", pl((S) => { S.readings = [rd(70, 38.2, 125, 97), rd(5, 38.3, 125, 97)]; }).key === "er");
ok("placement: grade 2 at home -> ER", pl((S) => { S.readings = [rd(5, 38.5, 90, 97)]; S.in.hypo = "fluid"; }).key === "er");
ok("placement: grade 2 at facility -> ward, not ICU", pl((S) => { S.readings = [rd(5, 38.5, 90, 97)]; S.in.hypo = "fluid"; }, "facility").key === "ward");
ok("placement: grade 2 + comorbid at facility -> ICU", pl((S) => { S.readings = [rd(5, 38.5, 90, 97)]; S.in.hypo = "fluid"; S.in.comorbid = true; }, "facility").key === "icu");
ok("placement: grade 3 at facility -> ICU; at home -> ER then ICU", pl((S) => { S.readings = [rd(5, 39, 80, 90)]; S.in.hypo = "one"; }, "facility").key === "icu" && /ICU/.test(pl((S) => { S.readings = [rd(5, 39, 80, 90)]; S.in.hypo = "one"; }).title));
ok("placement: ICANS grade 1 at facility -> ward", pl((S) => { S.in.ice = ice(4, 3, 1, 0, 0); }, "facility").key === "ward");
ok("placement: ICANS grade 3 -> ICU", pl((S) => { S.in.seizure = "g3"; }, "facility").key === "icu");
ok("placement: ICANS 2 + CRS 2 -> consider ICU flag", pl((S) => { S.readings = [rd(5, 38.5, 90, 97)]; S.in.hypo = "fluid"; S.in.loc = "voice"; }, "facility").considerICU === true);
ok("placement: home symptom (dizziness) -> ER", pl((S) => { S.in.symptoms = { dizziness: true }; }).key === "er");

console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
