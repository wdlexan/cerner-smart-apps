/* node tests/test_daily.js  - daily list update (Patient list tab). Made-up patients only. */
global.window = {};
require("../tools/discharge/samples.js");
const R = require("../tools/discharge/rules.js"), D = require("../tools/plist/daily.js");
let fail = 0;
const eq = (n, g, w) => { const o = JSON.stringify(g) === JSON.stringify(w); if (!o) fail++; console.log((o ? "ok   " : "FAIL ") + n + ": got " + JSON.stringify(g) + ", want " + JSON.stringify(w)); };
const done = () => { console.log(fail ? fail + " FAILED" : "all passed"); process.exit(fail ? 1 : 0); };

// ---- rules on made-up charts ----
const now = Date.now(), H = 36e5;
const A = window.DC_SAMPLES[0].build(now), fA = R.parse(Object.assign({ now }, A));
const vA = D.values(fA, A, [{ resourceType: "AllergyIntolerance", code: { text: "Penicillin" }, clinicalStatus: { coding: [{ code: "active" }] } }], { pending: R.pending });
eq("allergy listed -> y", vA.allergy, "y");
eq("gfr is a number", typeof vA.gfr, "number");
eq("vtep y/n from current meds", ["y", "n"].includes(vA.vtep), true);
eq("check today is a list", Array.isArray(vA.check), true);
eq("NKA only -> allergy n", D.values(fA, A, [{ code: { text: "No Known Allergies" } }], {}).allergy, "n");
eq("no allergy records -> blank (not n)", D.values(fA, A, [], {}).allergy, undefined);
eq("egfr 2021: 90 umol/L, 80 F (142 x 0.638 x 0.608 x 1.012 = 55.7)", D.egfr(90, 80, "female"), 56);

// abnormal results, vitals and antibiotics made up on purpose
const iso = (h) => new Date(now - h * H).toISOString();
const raw = {
  patient: { birthDate: "1944-03-01", gender: "male" },
  obs: [
    { resourceType: "Observation", status: "final", category: [{ coding: [{ code: "laboratory" }] }], code: { coding: [{ code: "2823-3" }], text: "Potassium" }, effectiveDateTime: iso(5), valueQuantity: { value: 6.4 }, interpretation: [{ coding: [{ code: "HH" }] }] },
    { resourceType: "Observation", status: "final", category: [{ coding: [{ code: "laboratory" }] }], code: { coding: [{ code: "2951-2" }], text: "Sodium" }, effectiveDateTime: iso(40), valueQuantity: { value: 126 }, interpretation: [{ coding: [{ code: "L" }] }] },
    { resourceType: "Observation", status: "final", category: [{ coding: [{ code: "laboratory" }] }], code: { coding: [{ code: "2160-0" }], text: "Creatinine" }, effectiveDateTime: iso(5), valueQuantity: { value: 180 } },
    { resourceType: "Observation", status: "final", category: [{ coding: [{ code: "vital-signs" }] }], code: { coding: [{ code: "85354-9" }] }, effectiveDateTime: iso(3), component: [{ code: { coding: [{ code: "8480-6" }] }, valueQuantity: { value: 84 } }] },
    { resourceType: "Observation", status: "final", category: [{ coding: [{ code: "vital-signs" }] }], code: { coding: [{ code: "8310-5" }] }, effectiveDateTime: iso(2), valueQuantity: { value: 38.6 } }],
  medreqs: [
    { resourceType: "MedicationRequest", status: "active", intent: "order", authoredOn: iso(24 * 4.5), medicationCodeableConcept: { text: "ceftriaxone 2 g IV q24h" } },
    { resourceType: "MedicationRequest", status: "active", intent: "order", authoredOn: iso(24 * 2), medicationCodeableConcept: { text: "enoxaparin 40 mg subcut daily" } },
    { resourceType: "MedicationRequest", status: "active", intent: "order", authoredOn: iso(10), medicationCodeableConcept: { text: "sodium chloride 0.9% IV continuous 75 mL/h" } }],
  orders: [{ resourceType: "ServiceRequest", status: "active", code: { text: "Insert indwelling urinary catheter (Foley)" }, authoredOn: iso(30) }],
  encounters: [{ resourceType: "Encounter", status: "in-progress", class: { code: "IMP" }, period: { start: iso(24 * 5) } }],
  reports: [{ resourceType: "DiagnosticReport", status: "registered", code: { text: "CT abdomen" }, effectiveDateTime: iso(20) }], notes: [] };
const f = R.parse(Object.assign({ now }, raw)), v = D.values(f, raw, [], { pending: R.pending });
eq("critical K listed first", /^CRITICAL Potassium 6\.4/.test(v.check[0]), true);
eq("low SBP and fever in vitals", v.check.some((c) => /vitals 24 h: SBP 84.*T 38\.6/.test(c)), true);
eq("ceftriaxone day 5 IV to PO", v.check.some((c) => /ceftriaxone IV day 5: IV to PO\?/.test(c)), true);
eq("Na 126 from 40 h ago -> recheck", v.check.some((c) => /recheck Na 126/.test(c)), true);
eq("enoxaparin -> vtep y", v.vtep, "y");
eq("IV fluid with rate", v.iv, "NS 75/h");
eq("foley from the order", v.foley, "y");
eq("pending CT", /CT abdomen/.test(v.lab || ""), true);
eq("GFR < 30 on enoxaparin -> renal dosing", v.check.some((c) => /renal dosing/.test(c)), v.gfr < 30);

// ---- the Excel file: fill only empty cells, rebuild "check today" ----
let JSZip = null; try { JSZip = require("jszip"); } catch (e) { try { JSZip = require("/opt/node-tools/node_modules/jszip"); } catch (e2) { try { JSZip = require("/opt/npm-tools/node_modules/jszip"); } catch (e3) {} } }
if (!JSZip) { console.log("skip Excel test (jszip not installed)"); done(); }
else {
  const X = require("../tools/plist/xlsx.js"), fs = require("fs");
  const tpl = fs.readFileSync(__dirname + "/../tools/plist/template.xlsx");
  const cell = (x, ref) => { const m = x.match(new RegExp(`<c r="${ref}"[^>]*?(?:/>|>([\\s\\S]*?)</c>)`)); if (!m || !m[1]) return ""; return ((m[1].match(/<t[^>]*>([\s\S]*?)<\/t>/) || m[1].match(/<v>([\s\S]*?)<\/v>/) || [])[1] || ""); };
  const sheet = (u8) => JSZip.loadAsync(u8).then((z) => z.file("xl/worksheets/sheet1.xml").async("string"));
  X.build(JSZip, tpl, [{ floor: "S7B", patients: [
    { name: "Sample, Ann", location: "S7B-VGH S715 A", age: 82, reason: "Pneumonia", gfr: 55, mrn: "0012345", sex: "F", todo: ["call daughter"] },
    { name: "Sample, Bo", location: "S7B-VGH S716 B", age: 70, reason: "CHF", mrn: "0067890", sex: "M" }] }])
    .then((u8) => X.daily(JSZip, u8, (p) => (/Ann/.test(p.name) ? { gfr: 31, allergy: "y", vtep: "n", check: ["new K 5.9 H", "cefazolin IV day 4: IV to PO?"] } : p.name.includes("Bo") ? { gfr: 42, lab: "CT chest", check: [] } : null), { date: "22 Nov" }))
    .then((res) => {
      eq("report: Ann filled allergy+vtep, not her typed gfr", res.report.find((r) => /Ann/.test(r.name)).filled, ["allergy", "vtep"]);
      eq("report: Bo filled gfr and lab", res.report.find((r) => /Bo/.test(r.name)).filled, ["gfr", "lab"]);
      return sheet(res.data).then((x) => ({ x, col: res.column, data: res.data }));
    })
    .then(({ x, col, data }) => {
      const rowOf = (name) => { const m = x.match(new RegExp(`<row r="(\\d+)"[^>]*>(?:(?!</row>)[\\s\\S])*${name}`)); return m ? +m[1] : null; };
      const rA = rowOf("Sample, Ann"), rB = rowOf("Sample, Bo");
      eq("Ann typed gfr 55 kept", cell(x, "K" + rA), "55");
      eq("Ann allergy filled y", cell(x, "J" + rA), "y");
      eq("Ann typed to-do kept", cell(x, "S" + rA), "call daughter");
      eq("header 'check today' added", cell(x, col + "1"), "check today");
      eq("Ann check today, dated", cell(x, col + rA), "22 Nov: new K 5.9 H");
      eq("Ann second item on the next row", cell(x, col + (rA + 1)), "cefazolin IV day 4: IV to PO?");
      eq("Bo gfr filled 42", cell(x, "K" + rB), "42");
      // second run the next day: check today replaced, nothing else changes
      return X.daily(JSZip, data, (p) => (/Ann/.test(p.name) ? { gfr: 20, allergy: "n", check: ["recheck Na 128"] } : null), { date: "23 Nov" })
        .then((res2) => sheet(res2.data).then((x2) => {
          eq("day 2: Ann check today replaced", cell(x2, col + rA), "23 Nov: recheck Na 128");
          eq("day 2: yesterday's 2nd item cleared", cell(x2, col + (rA + 1)), "");
          eq("day 2: allergy y kept (not overwritten)", cell(x2, "J" + rA), "y");
          eq("day 2: same check column reused", res2.column, col);
          eq("day 2: Bo skipped and untouched", cell(x2, "K" + rB), "42");
        }));
    })
    .then(done).catch((e) => { console.log("FAIL", e); fail++; done(); });
}
