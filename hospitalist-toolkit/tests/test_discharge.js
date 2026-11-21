/* node test_discharge.js : Discharge tab rules on MADE-UP patients. */
global.window = {}; require("../tools/discharge/samples.js"); const R = require("../tools/discharge/rules.js");
let pass = 0, fail = 0; const ok = (n, c, x) => { console.log((c ? "PASS " : "FAIL ") + n + (!c && x ? " | " + JSON.stringify(x).slice(0, 300) : "")); c ? pass++ : fail++; };
const S = window.DC_SAMPLES, now = Date.now(), run = (i) => { const f = R.parse(S[i].build(now)); return { f, meds: R.reconcile(f), chg: R.changes(f), pend: R.pending(f), inc: R.incidentals(f), mods: R.modules(f).map((m) => m.id) }; };
const st = (rows, k) => (rows.find((r) => r.key === k) || {}).status;
// A: heart failure + AF
let a = run(0);
ok("A furosemide changed, metoprolol changed", st(a.meds, "furosemide") === "changed" && st(a.meds, "metoprolol") === "changed", a.meds);
ok("A apixaban + dapagliflozin new, ramipril continue", st(a.meds, "apixaban") === "new" && st(a.meds, "dapagliflozin") === "new" && st(a.meds, "ramipril") === "continue");
ok("A naproxen and ASA flagged stopped", st(a.meds, "naproxen") === "stopped" && st(a.meds, "asa") === "stopped", a.meds.map((r) => r.key));
ok("A stopped heparin not listed, senna hospital-only", !a.meds.some((r) => r.key === "heparin") && st(a.meds, "senna") === "inpatient");
ok("A creatinine and weight changes notable", a.chg.labs.find((x) => x.id === "cr").big && a.chg.labs.find((x) => x.id === "wt").big);
ok("A echo and TSH pending", a.pend.some((p) => /Echo/.test(p.what)) && a.pend.some((p) => p.what === "TSH"), a.pend);
ok("A lung nodule with Fleischner follow-up; no 'no suspicious mass'", a.inc.length === 1 && /7 mm solid nodule/.test(a.inc[0].finding) && /Fleischner/.test(a.inc[0].followup), a.inc);
ok("A modules: hf, anticoag, af, not diabetes for dapagliflozin alone", ["hf", "anticoag", "af"].every((m) => a.mods.includes(m)) && !a.mods.includes("dm"), a.mods);
const sA = { f: a.f, meds: a.meds, chg: a.chg, pend: a.pend, inc: a.inc, mods: a.mods, v: { admit: a.f.admit, dc: now, fpDays: 7, dry: 79.5, fluidL: 1.5 } };
const pt = R.patientText(sA), fp = R.fpNote(sA);
ok("A patient: weight rule, salt, fluid limit, dapagliflozin sick-day + ER line", /1 kg \(2 lb\) in a day/.test(pt) && /2,000 mg of sodium/.test(pt) && /1.5 L a day/.test(pt) && /Stop dapagliflozin on sick days/.test(pt) && /while taking dapagliflozin/.test(pt), pt);
ok("A patient: bleeding signs and head injury for apixaban; 9-1-1 section", /Black, tarry/.test(pt) && /hit your head/.test(pt) && /CALL 9-1-1/.test(pt));
ok("A patient: no low-sugar advice", !/Low sugar/.test(pt));
ok("A patient: no duplicate NSAID line", (pt.match(/anti-inflammatory pain pills/g) || []).length === 1, pt.match(/anti-inflammatory/g));
ok("A FP note: changes, pending, incidental, follow-up", /CHANGED: furosemide 20 mg PO daily -> furosemide 40 mg PO BID/.test(fp) && /Echocardiogram.*Follow-up/.test(fp) && /7 mm solid nodule/.test(fp) && /within 7 days/.test(fp), fp);
ok("A no double periods", !/\.\./.test(fp) && !/\.\./.test(pt));
// B: pneumonia + COPD + diabetes
let b = run(1);
ok("B gliclazide stopped, glargine new, metformin continue", st(b.meds, "gliclazide") === "stopped" && st(b.meds, "insulin glargine") === "new" && st(b.meds, "metformin") === "continue", b.meds);
ok("B completed ceftriaxone not listed", !b.meds.some((r) => r.key === "ceftriaxone"));
ok("B blood culture preliminary, legionella, sputum pending once", b.pend.filter((p) => /Blood culture/.test(p.what)).length === 1 && b.pend.some((p) => /Legionella/.test(p.what)) && b.pend.filter((p) => /[Ss]putum/.test(p.what + p.detail)).length === 1, b.pend);
ok("B follow-up chest X-ray recommendation found", b.inc.some((x) => /6 to 8 weeks/.test(x.followup)), b.inc);
ok("B modules copd, infection, dm", ["copd", "infection", "dm"].every((m) => b.mods.includes(m)), b.mods);
// C: hip fracture, discharge prescriptions present
let c = run(2);
ok("C uses discharge prescriptions: enoxaparin new (not hospital-only), SC hydromorphone not listed", st(c.meds, "enoxaparin") === "new" && !c.meds.some((r) => /0\.5 mg SC/.test(r.text)), c.meds);
ok("C lorazepam stopped", st(c.meds, "lorazepam") === "stopped");
ok("C hemoglobin drop notable", c.chg.labs.find((x) => x.id === "hb").big);
ok("C T12 compression fracture found", c.inc.some((x) => /T12/.test(x.finding)), c.inc);
ok("C modules hip + opioid, no anticoag for prophylactic enoxaparin", c.mods.includes("hip") && c.mods.includes("opioid") && !c.mods.includes("anticoag"), c.mods);
const ptc = R.patientText({ f: c.f, meds: c.meds, chg: c.chg, pend: [], inc: c.inc, mods: c.mods, v: { wb: "full weight bearing as tolerated", vteWeeks: 4 } });
ok("C patient: weight bearing, 4 weeks, naloxone", /full weight bearing as tolerated/.test(ptc) && /for 4 weeks/.test(ptc) && /naloxone/.test(ptc), ptc);
// negation and helpers
ok("negated finding ignored", R.incidentals({ reports: [{ name: "CT abdomen", cat: "radiology", text: "No suspicious mass. No aneurysm.", t: now }], notes: [], admit: now - 864e5, now }).length === 0);
ok("insulins kept apart", R.medKey("insulin glargine 10 units") !== R.medKey("insulin lispro 4 units"));
ok("medKey drops salts", R.medKey("metoprolol tartrate 25 mg PO BID") === "metoprolol" && R.medKey("ASA 81 mg") === "asa");
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
