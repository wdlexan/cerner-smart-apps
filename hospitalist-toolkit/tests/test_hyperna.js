/* node tests/test_hyperna.js  - hand-worked checks of the hypernatremia rules (Sodium tab) */
const H = require("../tools/hypona/hyper.js");
let fail = 0;
const eq = (n, g, w) => { const o = g === w; if (!o) fail++; console.log((o ? "ok   " : "FAIL ") + n + ": got " + g + ", want " + w); };
const has = (n, arr, s) => { const o = arr.some((x) => (x.text || x).indexOf(s) > -1); if (!o) fail++; console.log((o ? "ok   " : "FAIL ") + n + " has " + JSON.stringify(s) + (o ? "" : " in " + JSON.stringify(arr.map((x) => x.text || x)))); };
const not = (n, arr, s) => { const o = !arr.some((x) => (x.text || x).indexOf(s) > -1); if (!o) fail++; console.log((o ? "ok   " : "FAIL ") + n + " lacks " + JSON.stringify(s)); };

eq("grade 148", H.grade(148).label, "mild"); eq("grade 155", H.grade(155).label, "moderate"); eq("grade 162", H.grade(162).label, "severe"); eq("grade 140", H.grade(140).sev, 0);
eq("grade 148 + severe symptoms", H.grade(148, "severe").sev, 3);
eq("TBW 70 kg man 50", H.tbw(70, 50, "male"), 42); eq("TBW 60 kg woman 85", H.tbw(60, 85, "female"), 27); eq("TBW 80 kg man 80", H.tbw(80, 80, "male"), 40);
// deficit: 27 × (162/140 − 1) = 27 × 0.157 = 4.24 → 4.2 L
eq("deficit 162, TBW 27", H.deficit(162, 27), 4.2);
// D5W per litre: (0 − 162)/(27 + 1) = −5.79 → −5.8
eq("D5W per L", H.perLitre(162, 27, 0, 0), -5.8);
// chronic plan: drop 10 → 10/5.8 = 1.72 L → 1724/24 = 71.8 + 40 = 112 mL/h
let p = H.plan(162, 27, false); eq("chronic drop", p.drop24, 10); eq("litres", p.litres, 1.7); eq("rate", p.rate, 111);
// acute plan: drop min(162−145, 24) = 17
p = H.plan(162, 27, true); eq("acute drop to 145", p.drop24, 17);
eq("mild 147 chronic drop capped at 7", H.plan(147, 40, false).drop24, 7);

// causes
let c = H.cause({ uosm: 150, uoMlH: 250, volume: "eu" }); eq("DI", c.label, "di"); has("DI desmopressin step", c.steps, "desmopressin 1–2 mcg"); has("polyuria", c.likely, "polyuria");
c = H.cause({ uosm: 800, volume: "hypo" }); eq("extrarenal", c.label, "extrarenal"); has("dry", c.likely, "isotonic fluid first");
c = H.cause({ uosm: 450, glu: 35 }); eq("partial / osmotic", c.label, "partial"); has("HHS", c.likely, "HHS");
c = H.cause({ uosm: 700, una: 180, volume: "hyper" }); has("salt gain", c.likely, "sodium gain");
c = H.cause({}); eq("incomplete", c.label, "incomplete");

// treatment: elderly woman, 60 kg, 85 y, Na 162, dry, urine osm 820
const m = H.meds(["Furosemide 40 mg PO daily", "Lithium 300 mg PO BID", "Lactulose 30 mL PO TID"]);
eq("lithium found", m.lithium.length, 1); eq("lactulose found", m.lactulose.length, 1);
let x = { na: 162, water: 27, acute: false, volume: "hypo", symptoms: "moderate", meds: m, glu: 6, cause: H.cause({ uosm: 820, volume: "hypo" }) };
let t = H.treatment(x);
has("shock first", t, "0.9% saline or Ringer"); has("deficit 4.2 L", t, "4.2 L deficit"); has("D5W rate 111", t, "about 111 mL/h");
has("stop lactulose", t, "Lactulose"); has("lithium level", t, "Lithium: check a level"); has("severe care", t, "monitored bed");
x = { na: 154, water: 42, acute: false, volume: "eu", meds: H.meds([]), glu: 14, uoMlH: 300, cause: H.cause({ uosm: 120, uoMlH: 300 }) };
t = H.treatment(x); has("DI treatment", t, "desmopressin 1–2 mcg"); has("glucose caution", t, "D5W adds glucose"); has("replace urine", t, "PLUS replace the dilute urine");
not("no shock line when euvolemic", t, "Shock or poor perfusion");
let r = H.recheck({ na: 162, symptoms: "moderate" }); has("severe recheck 2-4 h", r.map((i) => i.when), "Every 2–4 h");
r = H.recheck({ na: 152 }); has("moderate recheck 4-6 h", r.map((i) => i.when), "Every 4–6 h");
eq("no plan when Na normal", H.treatment({ na: 140 }).length, 0);

console.log(fail ? `\n${fail} FAILED` : "\nall passed");
process.exit(fail ? 1 : 0);
