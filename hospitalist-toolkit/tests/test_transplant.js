/* node tests/test_transplant.js  - hand-worked checks of the kidney transplant engine */
const E = require("../tools/transplant/engine.js"), R = require("../tools/transplant/rules-data.js");
let fail = 0;
const eq = (n, g, w) => { const o = JSON.stringify(g) === JSON.stringify(w); if (!o) fail++; console.log((o ? "ok   " : "FAIL ") + n + ": got " + JSON.stringify(g) + ", want " + JSON.stringify(w)); };
const H = 36e5, D = 864e5, now = Date.UTC(2026, 10, 5, 18);
const iso = (h) => new Date(now - h * H).toISOString();
const req = (name, h, status, endH) => { const r = { resourceType: "MedicationRequest", status: status || "active", medicationCodeableConcept: { text: name }, authoredOn: iso(h) };
  if (endH != null) r.dosageInstruction = [{ timing: { repeat: { boundsPeriod: { start: iso(h), end: iso(endH) } } } }]; return r; };
const adm = (name, h) => ({ resourceType: "MedicationAdministration", status: "completed", medicationCodeableConcept: { text: name }, effectiveDateTime: iso(h) });
const obs = (name, v, unit, h, loinc) => ({ resourceType: "Observation", status: "final", code: { coding: loinc ? [{ system: "http://loinc.org", code: loinc }] : [], text: name }, effectiveDateTime: iso(h), valueQuantity: { value: v, unit } });
const run = (raw, ctx, targets) => E.evaluate(E.parse(raw, { now }), R, { now, ctx: ctx || {}, targets: targets || {} });
const TAC = req("Tacrolimus 3 mg PO BID", 3000), MMF = req("Mycophenolate mofetil 750 mg PO BID", 3000);

// matching
eq("whole word: st john", E.has("St. John's Wort 300 mg", "st john"), true);
eq("whole word: no partial", E.has("Methylprednisolone 40 mg", "prednisone"), false);
eq("co-trimoxazole normalised", E.has("Co-Trimoxazole DS", "co-trimoxazole"), true);

// no immunosuppressant -> nothing
let ev = run({ medreqs: [req("Clarithromycin 500 mg BID", 10)] });
eq("not transplant", ev.transplant.detected, false); eq("no alerts", ev.alerts.length, 0);

// clarithromycin with tacrolimus: critical, level due 2-3 days after start
ev = run({ medreqs: [TAC, req("Clarithromycin 500 mg PO BID", 50)], obs: [obs("Tacrolimus Level", 6, "ug/L", 120)] });
eq("clari critical", ev.alerts[0].id + " " + ev.alerts[0].severity, "R03 critical");
eq("clari level event", ev.levels[0].events.map((e) => e.kind + ":" + e.status), ["started:due"]);
// same with a level drawn after the window opened -> done
ev = run({ medreqs: [TAC, req("Clarithromycin 500 mg PO BID", 50)], obs: [obs("Tacrolimus Level", 6, "ug/L", 120), obs("Tacrolimus Level", 11, "ug/L", 4)] }, {}, { tacrolimus: [5, 8] });
eq("level done", ev.levels[0].events[0].status, "done"); eq("out of range high", ev.levels[0].outOfRange, "high");
// started 10 h ago -> upcoming
ev = run({ medreqs: [TAC, req("Clarithromycin 500 mg PO BID", 10)], obs: [obs("Tacrolimus Level", 6, "ug/L", 30)] });
eq("upcoming", ev.levels[0].events[0].status, "upcoming"); eq("next due = start + 2 d", ev.levels[0].nextDue, now - 10 * H + 2 * D);

// rifampin stopped 6 days ago: still flagged (levels swing back), recheck overdue after stop + 5 d
ev = run({ medreqs: [TAC, req("Rifampin 600 mg PO daily", 400, "stopped", 144)] });
eq("inducer stopped flagged", ev.alerts[0].id + " " + ev.alerts[0].onlyStopped, "R07 true");
eq("inducer stop event overdue", ev.levels[0].events[0].kind + ":" + ev.levels[0].events[0].status, "stopped:overdue");
// rifampin also affects prednisone and mycophenolate
ev = run({ medreqs: [MMF, req("Prednisone 5 mg daily", 3000), req("Rifampin 600 mg daily", 20)] });
eq("rifampin affects MMF + pred", ev.alerts[0].affects, ["Mycophenolate (MMF or mycophenolate sodium)", "Maintenance corticosteroid"]);

// Paxlovid matched twice (ritonavir + paxlovid) is one drug
ev = run({ medreqs: [TAC, req("Nirmatrelvir/ritonavir (Paxlovid) 300/100 mg BID", 20)], admins: [adm("Nirmatrelvir/ritonavir 300/100 mg", 19)] });
eq("paxlovid one trigger", ev.alerts[0].triggers.length, 1); eq("paxlovid one level event", ev.levels[0].events.length, 1);

// TMP-SMX: prophylaxis -> info, treatment -> major
eq("septra prophylaxis info", run({ medreqs: [TAC, req("Sulfamethoxazole-trimethoprim SS 400-80 mg daily", 100)] }).alerts[0].severity, "info");
eq("septra 3x/week info", run({ medreqs: [TAC, req("Septra DS 1 tab PO three times a week", 100)] }).alerts[0].severity, "info");
eq("septra treatment major", run({ medreqs: [TAC, req("Sulfamethoxazole-trimethoprim DS 2 tabs PO BID", 10)] }).alerts[0].severity, "major");

// severity overrides: statin by trigger, colchicine by drug
eq("simvastatin + cyclosporine critical", run({ medreqs: [req("Cyclosporine 100 mg BID", 3000), req("Simvastatin 20 mg qHS", 3000)] }).alerts[0].severity, "critical");
eq("rosuvastatin + cyclosporine major", run({ medreqs: [req("Cyclosporine 100 mg BID", 3000), req("Rosuvastatin 5 mg daily", 3000)] }).alerts[0].severity, "major");
eq("colchicine + cyclosporine critical", run({ medreqs: [req("Cyclosporine 100 mg BID", 3000), req("Colchicine 0.6 mg BID", 10)] }).alerts[0].severity, "critical");
eq("colchicine + tacrolimus major", run({ medreqs: [TAC, req("Colchicine 0.6 mg BID", 10)] }).alerts[0].severity, "major");
eq("statin + tacrolimus: no rule", run({ medreqs: [TAC, req("Simvastatin 20 mg qHS", 3000)] }).alerts.length, 0);

// PPI only for mofetil
eq("PPI + MMF flagged", run({ medreqs: [MMF, req("Pantoprazole 40 mg daily", 100)] }).alerts.map((a) => a.id), ["R17"]);
eq("PPI + Myfortic not flagged", run({ medreqs: [req("Mycophenolate sodium 540 mg BID", 3000), req("Pantoprazole 40 mg daily", 100)] }).alerts.length, 0);

// azathioprine + allopurinol
eq("aza + allopurinol critical", run({ medreqs: [req("Azathioprine 75 mg daily", 3000), req("Allopurinol 100 mg daily", 3000)] }).alerts[0].severity, "critical");

// an old, stopped order does not count as current
eq("NSAID stopped 20 d ago ignored", run({ medreqs: [TAC, req("Ibuprofen 400 mg PRN", 900, "stopped", 480)] }).alerts.length, 0);
// given in the past 36 h with no order still counts
eq("NSAID given 10 h ago counts", run({ medreqs: [TAC], admins: [adm("Ketorolac 15 mg IV", 10)] }).alerts[0].id, "R09");

// creatinine: baseline 100 (3-90 d old), now 130 = +30% -> flag; +20 in 48 h alone would not
let c = E.creatinineCheck([{ t: now - 30 * D, v: 100 }, { t: now - 40 * H, v: 110 }, { t: now - 2 * H, v: 130 }], R.labWatch.items[0], now);
eq("creat pct", Math.round(c.pct), 30); eq("creat flag", c.flag, true); eq("creat 48 h", c.abs48, 20);
c = E.creatinineCheck([{ t: now - 30 * D, v: 100 }, { t: now - 2 * H, v: 120 }], R.labWatch.items[0], now); eq("creat +20% no flag", c.flag, false);
c = E.creatinineCheck([{ t: now - 30 * H, v: 90 }, { t: now - 2 * H, v: 118 }], R.labWatch.items[0], now); eq("creat +28 in 48 h flags without baseline", c.flag, true);
// mg/dL converted
ev = run({ medreqs: [TAC], obs: [obs("Creatinine", 1.5, "mg/dL", 2, "2160-0")] });
eq("creat mg/dL -> umol/L", Math.round(ev.labs.find((x) => x.id === "creatinine").latest.v), 133);

// labs: potassium, hemoglobin drop, CK over 5x ULN (reference range used)
ev = run({ medreqs: [TAC], obs: [obs("Potassium", 5.9, "mmol/L", 2, "2823-3"), obs("Hemoglobin", 125, "g/L", 30, "718-7"), obs("Hemoglobin", 102, "g/L", 2, "718-7"),
  Object.assign(obs("Creatine Kinase", 900, "U/L", 2, "2157-6"), { referenceRange: [{ high: { value: 150 } }] })] });
const fl = (id) => ev.labs.find((x) => x.id === id).flag;
eq("K flag", fl("potassium"), true); eq("Hb drop flag", fl("hemoglobin"), true); eq("CK flag (900 > 5x150)", fl("ck"), true);
// urine potassium is not serum potassium
ev = run({ medreqs: [TAC], obs: [obs("Potassium, Urine Random", 60, "mmol/L", 2)] }); eq("urine K ignored", ev.labs.find((x) => x.id === "potassium").latest, null);

// context: diarrhea prompt on tacrolimus, NPO, level older than 7 days, prophylaxis listing
ev = run({ medreqs: [TAC, req("Valganciclovir 450 mg daily", 3000)], obs: [obs("Tacrolimus Level", 6, "ug/L", 240)] }, { diarrhea: true, npo: true });
eq("context ids", ev.context.map((x) => x.id), ["C01", "C02", "C04", "C06", "C07"]);
eq("prophylaxis found", ev.prophylaxis.found, ["Valganciclovir 450 mg daily"]);
eq("level prompts", ev.levels[0].prompts.length, 3);
eq("detect diarrhea from problem list", E.detectContext(E.parse({ conditions: [{ code: { text: "C. difficile colitis" } }] }, { now }), R).diarrhea.length, 1);

console.log(fail ? "\n" + fail + " FAILED" : "\nall passed");
process.exit(fail ? 1 : 0);
