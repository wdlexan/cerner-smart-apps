/* node tests/test_pd.js */
const R = require("../tools/pd/rules.js");
let fail = 0;
const eq = (n, g, w) => { const o = JSON.stringify(g) === JSON.stringify(w); if (!o) fail++; console.log((o ? "ok   " : "FAIL ") + n + ": got " + JSON.stringify(g) + ", want " + JSON.stringify(w)); };
const H = 36e5, now = Date.UTC(2026, 10, 3, 20);
// parsing
eq("drug IR", R.drugOf("Carbidopa-levodopa 25/100 1.5 tab PO QID").id, "ld");
eq("drug CR", R.drugOf("Carbidopa-levodopa CR 50/200 1 tab PO BID").id, "ld-cr");
eq("drug Stalevo", R.drugOf("Stalevo 100/25/200 PO TID").id, "ld-stalevo");
eq("ld per tab", R.levodopaPerTab("Carbidopa-levodopa 25/100"), 100); eq("ld per tab CR", R.levodopaPerTab("Sinemet CR 50/200"), 200);
eq("tabs 1.5", R.tabsPerDose("1.5 tab"), 1.5); eq("tabs default", R.tabsPerDose("PO TID"), 1);
eq("per day times", R.perDay("at 07:00, 11:00, 15:00, 19:00"), 4); eq("per day QID", R.perDay("PO QID"), 4); eq("5 times", R.perDay("5 times daily"), 5); eq("q3h", R.perDay("q3h"), 6); eq("qhs", R.perDay("1 mg PO qhs"), 1);
// LEDD: levodopa 150 x4 = 600; entacapone -> +0.33*600 = 198; rasagiline 1 mg = 100 -> 898
let rows = [R.row("Carbidopa-levodopa 25/100 1.5 tab PO QID"), R.row("Entacapone 200 mg PO QID"), R.row("Rasagiline 1 mg PO daily")];
let L = R.ledd(rows); eq("LEDD levodopa", L.levodopa, 600); eq("LEDD total", L.total, 898);
// CR 200 x2 = 400*0.75=300; IR 100 x3 = 300; pramipexole 0.5 x3 = 1.5 mg*100 = 150 -> 750
L = R.ledd([R.row("Carbidopa-levodopa CR 50/200 1 tab PO BID"), R.row("Carbidopa-levodopa 25/100 1 tab PO TID"), R.row("Pramipexole 0.5 mg PO TID")]);
eq("LEDD CR + agonist", L.total, 750);
// Stalevo 100 x3 = 300 + 0.33*300 = 99 -> 399; safinamide fixed 150 -> 549
L = R.ledd([R.row("Stalevo 100/25/200 PO TID"), R.row("Safinamide 50 mg PO daily")]); eq("LEDD Stalevo + safinamide", L.total, 549);
eq("LEDD rotigotine 4 mg", R.ledd([R.row("Rotigotine 4 mg/24 h patch")]).total, 120);
eq("LEDD amantadine", R.ledd([R.row("Amantadine 100 mg PO BID")]).total, 200);
// timing: QID, doses at -14h, -10h, -4h (one 2h late: gap 6h vs expected 16/3 = 5.33 h -> 40 min late)
let tm = R.timing([{ t: now - 14 * H }, { t: now - 10 * H }, { t: now - 4 * H }], 4, now);
eq("late count", tm.late.length, 1); eq("late by ~40", tm.late[0].by, 40);
eq("overnight gap not late", R.timing([{ t: now - 14 * H }, { t: now - 2 * H }], 4, now).late.length, 0);
// avoid
let A = R.avoid([{ name: "Haloperidol 0.5 mg PO q4h PRN" }, { name: "Metoclopramide 10 mg IV q6h PRN" }, { name: "Tramadol 50 mg PO q6h PRN" }, { name: "Acetaminophen 1 g" }], true, false);
eq("avoid count", A.length, 3); eq("tramadol flagged with MAO-B", A.some((a) => /Tramadol/.test(a.name)), true);
eq("tramadol not flagged without MAO-B", R.avoid([{ name: "Tramadol 50 mg" }], false).length, 0);
eq("ondansetron + apomorphine", R.avoid([{ name: "Ondansetron 4 mg IV" }], false, true)[0].sev, "Contraindicated");
eq("meperidine contraindicated", R.avoid([{ name: "Meperidine 25 mg IV" }], true)[0].sev, "Contraindicated");
// NPO: LEDD 750 -> 750/30 = 25 -> capped 16
const N = R.npo([R.row("Carbidopa-levodopa CR 50/200 1 tab PO BID"), R.row("Pramipexole 0.5 mg PO TID")], { total: 750 });
eq("npo CR conversion", N.some((i) => /400 mg\/day CR to about 300 mg\/day/.test(i)), true); eq("npo rotigotine 16", N.some((i) => /estimate 16 mg\/24 h/.test(i)), true);
eq("npo rotigotine 300 -> 10", R.npo([R.row("Carbidopa-levodopa 25/100 1 tab PO TID")], { total: 300 }).some((i) => /estimate 10 mg\/24 h/.test(i)), true);
// detect
const d = R.detect([{ src: "Nursing", text: "Pt seeing animals in the room overnight. Constipated, no BM x4 days." }, { src: "PT", text: "Denies falls. Freezing at doorways." }], ["Orthostatic hypotension"]);
const T = (x) => Object.keys(R.detect([{ src: "n", text: x }], [])).sort();
eq("negated list (no falls ... or chest pain)", T("No reported head trauma, falls, fever, cough, shortness of breath, or chest pain."), []);
eq("negation across a line break", T("over the last 36 hours. No reported\nhead trauma, falls, fever, or chest pain."), []);
eq("fall precautions is not a fall", T("Fall precautions active due to combined motor deficits."), []);
eq("negation ended by 'but'", T("No fever but he fell twice this week and has back pain."), ["freeze", "pain"]);
eq("detect hallucination", !!d.psych, true); eq("detect constipation", !!d.constip, true); eq("detect freezing", !!d.freeze, true); eq("detect OH from problem list", d.oh.src, "problem list");
eq("negated not detected", !!R.detect([{ src: "x", text: "No hallucinations." }], []).psych, false);
// choices
const C = R.choices({ age: 82, cognition: true, psych: true, oh: true, crcl: 35, dysk: true });
const ag = C.find((c) => c.cls === "agonist").flags.map((f) => f.lvl); eq("agonist avoid", ag.includes("avoid"), true);
eq("levodopa preferred", C.find((c) => c.cls === "levodopa").flags.some((f) => f.lvl === "good"), true);
eq("amantadine renal caution", C.find((c) => c.cls === "amantadine").flags.some((f) => /CrCl 35/.test(f.text)), true);
eq("listed interval", R.listedInterval("at 07:00, 11:00, 15:00, 19:00"), 4);
eq("late with listed interval", R.timing([{ t: now - 13 * H }, { t: now - 7.5 * H }, { t: now - 1 * H }], 4, now, 72, 4).late.map((l) => l.by), [90, 150]);
eq("entacapone alone is not Stalevo", R.drugOf("Entacapone 200 mg PO with each levodopa dose QID").id, "entacapone");
eq("LEDD with separate entacapone", R.ledd([R.row("Carbidopa-levodopa 25/100 1.5 tab PO at 07:00, 11:00, 15:00, 19:00"), R.row("Entacapone 200 mg PO with each levodopa dose QID"), R.row("Rasagiline 1 mg PO daily")]).total, 898);
eq("detect swallow from thin fluids", !!R.detect([{ src: "x", text: "Coughing with thin fluids at lunch." }], []).swallow, true);
console.log(fail ? fail + " FAILED" : "all passed"); process.exit(fail ? 1 : 0);
