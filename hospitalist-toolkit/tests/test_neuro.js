/* node tests/test_neuro.js  - hand-worked checks of the Neuro (non-stroke) rules and chart parsing */
const R = require("../tools/neuro/rules.js");
const C = require("../tools/neuro/chart.js");
const REF = require("../tools/neuro/reference.js");
const S = require("../tools/neuro/samples.js");
let fail = 0;
const eq = (n, g, w) => { const o = g === w; if (!o) fail++; console.log((o ? "ok   " : "FAIL ") + n + ": got " + g + ", want " + w); };
const top = (t) => { const f = {}; t.forEach((k) => (f[k] = true)); const r = R.rank(f); return r.length ? r[0].id : null; };
const has = (t, id) => { const f = {}; t.forEach((k) => (f[k] = true)); return R.rank(f).some((d) => d.id === id); };

// ranking
eq("cord: both legs + sensory level + back pain + cancer", top(["para", "sensLevel", "backpain", "cancer"]), "cord");
eq("cauda: saddle + retention + back pain", top(["saddle", "retention", "backpain"]), "cauda");
eq("gbs: ascending + areflexia + recent infection", top(["ascend", "areflex", "recentInf", "para"]), "gbs");
eq("gbs pushed down by a sensory level", has(["ascend", "areflex", "sensLevel", "hyperreflex"], "gbs"), false);
eq("mg: fatigable + ptosis + bulbar", top(["fatig", "ptosis", "bulbar"]), "mg");
eq("sdh: drowsy + fall + anticoagulant", top(["drowsy", "fall", "anticoag"]), "sdh");
eq("stroke for one-sided weakness alone", top(["hemi"]), "stroke");
eq("central vertigo", top(["vertigo", "vConstant", "hitNormal"]), "vcentral");
eq("bppv", top(["vertigo", "vPositional", "dixPos"]), "bppv");
eq("vestibular neuritis when no central sign", top(["vertigo", "vConstant"]), "vneur");
eq("no neuritis if head impulse normal", has(["vertigo", "vConstant", "hitNormal"], "vneur"), false);
eq("empty ticks -> empty list", R.rank({}).length, 0);

// can't-miss additions (Nov 2026)
eq("meningitis: fever + neck stiffness + drowsy", top(["fever", "neckStiff", "drowsy"]), "mening");
eq("no meningitis without fever or neck stiffness", has(["drowsy", "seizure"], "mening"), false);
eq("wernicke: alcohol + ataxia/eye signs", top(["etoh", "ataxiaOph", "drowsy"]), "wernicke");
eq("NCSE: fluctuating confusion after seizure", top(["fluct", "seizure"]), "ncse");
eq("SAH: thunderclap", top(["thunder", "neckStiff"]), "sah");
eq("CVST: positional headache + pregnancy + seizure", top(["headPos", "preg", "seizure"]), "cvst");
eq("CVST: on the pill + positional headache is listed", has(["headPos", "estrogen"], "cvst"), true);
eq("CVST: thrombophilia + seizure + drowsy is listed", has(["thrombo", "seizure", "drowsy"], "cvst"), true);
eq("CVST: on the pill alone with no headache/neuro sign is not listed", has(["estrogen"], "cvst"), false);
eq("dissection: neck pain + Horner", top(["neckPain", "horner", "vertigo"]), "dissect");
eq("myelitis replaces cord when MRI shows no compression", top(["para", "sensLevel", "retention", "mriNoComp"]), "myelitis");
eq("cord still top without that MRI tick", top(["para", "sensLevel", "retention", "backpain"]), "cord");
eq("botulism: descending + pupils + food/wound", top(["descend", "ptosis", "bulbar", "pupils", "noSens", "botRisk"]), "botul");
eq("tick found with ascending weakness tops GBS", top(["ascend", "areflex", "tick", "para"]), "botul");
eq("hypoglycemia with one-sided weakness listed above stroke", top(["lowGlu", "hemi"]), "hypogly");
eq("PRES: high BP + vision + seizure", top(["htn", "visual", "seizure"]), "pres");
eq("every diagnosis card exists", R.DX.filter((d) => d.card && !REF.byId[d.card]).length, 0);
eq("12 can't-miss + stroke-type entries", R.DX.filter((d) => d.cantMiss).length, 17);

// localizer: UMN / LMN / junction / muscle
const lv = (t) => { const f = {}; t.forEach((k) => (f[k] = true)); return R.localize(f); };
eq("one side + brisk = brain", lv(["hemi", "hyperreflex"]).level, "brain");
eq("both legs + brisk + sensory level = cord", lv(["para", "hyperreflex", "sensLevel"]).level, "cord");
eq("absent reflexes + wasting + fasciculations = LMN", lv(["areflex", "wasting", "fascic"]).level, "lmn");
eq("fatigable + ptosis, normal reflexes and sensation = junction", lv(["fatig", "ptosis", "reflexNormal", "sensOK"]).level, "nmj");
eq("proximal + CK high, normal sensation = muscle", lv(["prox", "highCK", "sensOK", "reflexNormal"]).level, "muscle");
let sh = lv(["para", "areflex", "flaccid", "sensLevel", "hyperacute"]);
eq("spinal shock: floppy areflexic legs + sensory level -> cord", sh.level, "cord"); eq("spinal shock warning shown", sh.warn.some((w) => /spinal shock/.test(w)), true);
eq("saddle numbness -> LMN with cauda warning", lv(["saddle", "areflex", "para"]).level, "lmn");
eq("UMN + LMN together warns (ALS etc.)", lv(["hyperreflex", "fascic", "wasting"]).warn.some((w) => /ALS/.test(w)), true);
eq("pupils + ptosis warns not MG", lv(["ptosis", "pupils", "descend"]).warn.some((w) => /botulism/.test(w)), true);
eq("nothing ticked -> no level", lv([]).level, null);

// special bedside tests
eq("every bedside test ticks a known finding", R.EXAM.flatMap((g) => g.tests).every((t) => t.sets.every((k) => R.LABEL[k])), true);
eq("drift alone is not enough to name a level", lv(["drift"]).level, null);
eq("drift + cortical sensory loss -> brain", lv(["drift", "corticalSens"]).level, "brain");
eq("drift alone lists stroke", has(["drift"], "stroke"), true);
eq("Romberg + vibration loss + brisk reflexes -> B12/copper", top(["romberg", "dorsal", "hyperreflex"]), "scd");
eq("Romberg without cerebellar signs warns sensory ataxia", lv(["romberg"]).warn.some((w) => /sensory ataxia/.test(w)), true);
eq("cerebellar signs + constant vertigo -> central vertigo", top(["vertigo", "vConstant", "cerebellar"]), "vcentral");
eq("Hoover positive -> functional listed", has(["functional"], "functional"), true);
eq("functional with brisk reflexes is pushed out", has(["functional", "hyperreflex"], "functional"), false);
eq("upgaze + Cogan (fatig, ptosis) -> MG", top(["fatig", "ptosis"]), "mg");
eq("Kernig positive with fever -> meningitis", top(["neckStiff", "fever"]), "mening");

// breathing 20/30/40
const h = 36e5;
let b = R.breathing([{ t: 0, fvc: 1.5 }], 80); eq("FVC 1.5 L / 80 kg = 19 mL/kg", b.fvcPerKg, 19); eq("-> ICU", b.icu, true);
b = R.breathing([{ t: 0, fvc: 2.2 }], 80); eq("27 mL/kg -> not ICU", b.icu, false); eq("but action flag", b.flags.length, 1);
b = R.breathing([{ t: 0, nif: -25 }], 70); eq("NIF -25 -> ICU", b.icu, true);
b = R.breathing([{ t: 0, nif: 35 }], 70); eq("NIF typed positive 35 treated as -35, not ICU", b.icu, false);
b = R.breathing([{ t: 0, mep: 35 }], 70); eq("MEP 35 -> ICU", b.icu, true);
b = R.breathing([{ t: 0, fvc: 3.0 }, { t: 20 * h, fvc: 2.0 }], 50); eq("drop 33%", b.drop, 33); eq("drop >= 30 -> ICU", b.icu, true);
b = R.breathing([{ t: 0, fvc: 3.0 }, { t: 60 * h, fvc: 2.0 }], 50); eq("best value older than 48 h not used", b.drop, 0);

// MG medicine check
const mg = R.mgCheck(["Ciprofloxacin 500 mg PO BID", "Metoprolol 25 mg", "Magnesium sulfate 2 g IV", "Acetaminophen 1 g", "Timolol 0.5% eye drops"]);
eq("4 MG flags", mg.length, 4); eq("magnesium first (avoid)", mg[0].lvl, "avoid"); eq("timolol eye drops caught", mg.some((m) => /timolol/i.test(m.med)), true);
eq("acetaminophen not flagged", mg.some((m) => /acetaminophen/i.test(m.med)), false);

// antithrombotics
const at = R.antithrombotics(["Apixaban 2.5 mg BID", "Aspirin 81 mg", "Heparin 5000 units flush", "Dabigatran 150 mg"]);
eq("3 antithrombotics (heparin flush ignored)", at.length, 3); eq("dabigatran -> idarucizumab", /idarucizumab/i.test(at.find((a) => /dabigatran/i.test(a.med)).rev), true);

eq("enoxaparin 40 mg is prophylaxis", R.antithrombotics(["Enoxaparin 40 mg subcut daily"])[0].kind, "VTE prophylaxis dose");
eq("enoxaparin 1 mg/kg is LMWH", R.antithrombotics(["Enoxaparin 80 mg subcut q12h"])[0].kind, "LMWH");

// MS pseudo-relapse
eq("UTI -> pseudo", R.pseudoRelapse({ tempMax: 37.2, wbc: 8, uaPositive: true }).verdict, "pseudo");
eq("all normal -> true relapse possible", R.pseudoRelapse({ tempMax: 36.8, wbc: 7, crp: 3, uaPositive: false }).verdict, "true");
eq("no urinalysis -> incomplete", R.pseudoRelapse({ tempMax: 36.8, wbc: 7 }).verdict, "incomplete");

// bladder, GCS, HINTS
eq("bladder 640 urgent", R.bladder(640).lvl, "urgent"); eq("bladder 250 action", R.bladder(250).lvl, "action"); eq("bladder 80 ok", R.bladder(80).lvl, "ok");
eq("GCS 15 -> 13 urgent", R.gcsTrend([{ t: 0, v: 15 }, { t: 1, v: 13 }]).lvl, "urgent");
eq("HINTS central", R.hints({ vConstant: true, skew: true }).lvl, "urgent");
eq("HINTS peripheral", R.hints({ vConstant: true }).lvl, "ok");

// reference cards complete
REF.CARDS.forEach((c) => eq("card " + c.id + " has tests and treatment", c.tests.length > 0 && c.now.length > 0, true));
R.DX.filter((d) => d.card).forEach((d) => eq("dx " + d.id + " card exists", !!REF.byId[d.card], true));

// samples parse and rank as intended
const now = Date.now(); // parse() measures "last 72 h" from the real clock, so samples must be built relative to it
S.forEach((s, i) => {
  const f = C.parse(s.build(now)), ticks = {};
  Object.keys(f.auto).forEach((k) => (ticks[k] = true)); s.ticks.forEach((k) => (ticks[k] = true));
  const want = { gbs: "gbs", mg: "mg", cord: "cord", sdh: "sdh", ms: "ms", vertigo: "vcentral" }[s.card];
  eq(`sample ${i + 1} top dx`, R.rank(ticks)[0] && R.rank(ticks)[0].id, want);
});
const g = C.parse(S[0].build(now)); eq("GBS sample: 3 breathing rows merged", g.resp.length, 3); eq("GBS latest NIF", g.resp[2].nif, -32);
eq("GBS sample ICU by 30% drop", R.breathing(g.resp, g.weight.v).icu, true);
const cord = C.parse(S[2].build(now)); eq("cord sample: cancer auto", !!cord.auto.cancer, true); eq("cord sample: retention auto", !!cord.auto.retention, true);
const ms = C.parse(S[4].build(now)); eq("MS sample: UA positive", ms.ua.pos, true); eq("MS sample: fever auto", !!ms.auto.fever, true);
const m = C.parse(S[1].build(now)); eq("MG sample: knownMG auto", !!m.auto.knownMG, true); eq("MG sample: avoid magnesium", R.mgCheck(m.meds)[0].lvl, "avoid");

{ const C2 = require("../tools/neuro/chart.js"), n = Date.now(), iso = new Date(n - 36e5).toISOString();
  const p = C2.parse({ patient: { birthDate: "1995-01-01" }, obs: [], conditions: [], medreqs: [{ status: "active", medicationCodeableConcept: { text: "levonorgestrel-ethinyl estradiol 0.15-0.03 mg PO daily" } }] });
  eq("chart: birth control pill ticks estrogen only (not pregnancy)", !!p.auto.estrogen && !p.auto.preg && !p.auto.thrombo, true); }

console.log(fail ? `\n${fail} FAILED` : "\nall passed"); process.exit(fail ? 1 : 0);
