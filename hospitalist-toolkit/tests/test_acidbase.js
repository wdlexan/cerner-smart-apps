/* node tests/test_acidbase.js  - hand-worked checks of the acid-base rules */
const R = require("../tools/acidbase/rules.js");
let fail = 0, near;
const eq = (n, g, w) => { const o = g === w; if (!o) fail++; console.log((o ? "ok   " : "FAIL ") + n + ": got " + g + ", want " + w); };
const has = (n, arr, item) => { const o = arr.some((x) => (typeof x === "string" ? x : x.text).indexOf(item) > -1); if (!o) fail++; console.log((o ? "ok   " : "FAIL ") + n + ": " + (o ? "has " : "missing ") + JSON.stringify(item) + (o ? "" : " in " + JSON.stringify(arr))); };
const not = (n, arr, item) => { const o = !arr.some((x) => (typeof x === "string" ? x : x.text).indexOf(item) > -1); if (!o) fail++; console.log((o ? "ok   " : "FAIL ") + n + ": " + (o ? "no " : "unexpected ") + JSON.stringify(item)); };
const stepOk = (out, prefix) => { const s = out.steps.find((x) => x.title.indexOf(prefix) === 0); return s ? s.ok : undefined; };
const stepTxt = (out, prefix) => { const s = out.steps.find((x) => x.title.indexOf(prefix) === 0); return s ? s.text : ""; };

// Henderson-Hasselbalch
eq("calc HCO3 pH 7.40 pCO2 40", Math.round(R.calcHCO3(7.4, 40) * 10) / 10, 24.5);

// A: euglycaemic DKA on empagliflozin. Winter 1.5*9+8 = 21.5 (19.5-23.5); AG 137-(102+9)=26, corr +0.5 = 26.5; delta 16.5/15 = 1.1
let meds = R.classifyMeds(["Empagliflozin 10 mg PO daily", "Metoprolol 25 mg"]);
let o = R.interpret({ pH: 7.22, pCO2: 22, HCO3: 9, tCO2: 9, Na: 137, Cl: 102, K: 4.9, albumin: 38, glucose: 11.2, bhb: 5.8, lactate: 1.6, specimen: "venous" }, meds);
eq("A sglt2 detected", meds.sglt2.length, 1);
has("A metabolic acidosis", o.disorders, "Metabolic acidosis"); has("A HAGMA", o.disorders, "High anion gap");
eq("A Winter's appropriate", stepOk(o, "2."), true); eq("A AG", o.derived.AG, 26); eq("A corrected AG", o.derived.AGcorr, 26.5); eq("A delta ratio", o.derived.deltaRatio, 1.1);
has("A euglycaemic DKA flag", o.flags, "EUGLYCAEMIC DKA"); has("A ketoacidosis flag", o.flags, "ketoacidosis"); has("A venous caveat", o.caveats, "Venous gas");
not("A no NAGMA", o.disorders, "Normal anion gap");

// B: septic shock + metformin; Winter 29 (27-31) but pCO2 48 -> concurrent resp acidosis; AG 24, corr 27, delta 17/11 = 1.55
meds = R.classifyMeds(["metFORMIN 1000 mg PO BID"]);
o = R.interpret({ pH: 7.08, pCO2: 48, HCO3: 14, tCO2: 13, Na: 135, Cl: 98, albumin: 28, lactate: 8.9, lactatePrev: 6.1, creatinine: 310, specimen: "arterial" }, meds);
has("B mixed: resp acidosis", o.disorders, "Respiratory acidosis"); eq("B Winter's not met", stepOk(o, "2."), false);
eq("B AG", o.derived.AG, 24); eq("B corrected AG", o.derived.AGcorr, 27); eq("B delta", o.derived.deltaRatio, 1.55);
has("B severe acidaemia", o.flags, "Severe acidaemia"); has("B metformin flag", o.flags, "metformin-associated"); has("B lactate rising", o.flags, "Lactate rising");
has("B uncompensated flag", o.flags, "without adequate respiratory compensation");

// C: vomiting metabolic alkalosis; expected pCO2 0.7*40+20 = 48 (43-53); AG 133-(84+39) = 10; urine Cl 8
o = R.interpret({ pH: 7.53, pCO2: 48, HCO3: 40, tCO2: 39, Na: 133, Cl: 84, K: 2.8, albumin: 40, uCl: 8 }, {});
has("C met alk", o.disorders, "Metabolic alkalosis"); eq("C compensation ok", stepOk(o, "2."), true); eq("C AG normal", o.derived.highAG, false);
has("C chloride responsive", [stepTxt(o, "6b")], "chloride-responsive"); has("C low K flag", o.flags, "K 2.8");

// D: diarrhoea NAGMA; Winter 29 (27-31) pCO2 30 ok; AG 8, corr 9.25; UAG 30+25-80 = -25
o = R.interpret({ pH: 7.28, pCO2: 30, HCO3: 14, tCO2: 14, Na: 138, Cl: 116, K: 3.0, albumin: 35, uNa: 30, uK: 25, uCl: 80, uPH: 5.2, specimen: "venous" }, {});
has("D NAGMA", o.disorders, "Normal anion gap"); not("D no HAGMA", o.disorders, "High anion gap"); eq("D UAG", o.derived.UAG, -25);
has("D GI loss", [stepTxt(o, "6a")], "GI loss");

// E: COPD on furosemide, pH 7.35 normal (acid side), pCO2 62, HCO3 34 -> chronic compensated respiratory acidosis
meds = R.classifyMeds(["Furosemide 40 mg PO daily"]);
o = R.interpret({ pH: 7.35, pCO2: 62, HCO3: 34, tCO2: 34, Na: 139, Cl: 94, K: 3.4 }, meds);
has("E resp acidosis", o.disorders, "Respiratory acidosis"); has("E chronic", [stepTxt(o, "2.")], "CHRONIC"); not("E no met alk", o.disorders, "Metabolic alkalosis");

// F: ethylene glycol; AG 140-(104+6) = 30; calc osm 2*140+6+5 = 291, gap 31; Winter 17 (15-19)
o = R.interpret({ pH: 7.14, pCO2: 18, HCO3: 6, tCO2: 6, Na: 140, Cl: 104, albumin: 40, glucose: 6, urea: 5, osm: 322, ethanol: 0, lactate: 3.1 }, {});
eq("F osm gap", o.derived.osmGap, 31); has("F toxic alcohol flag", o.flags, "methanol / ethylene glycol"); has("F toxic alcohol disorder", o.disorders, "toxic alcohol");
eq("F Winter's ok", stepOk(o, "2."), true); has("F HCO3 < 10 flag", o.flags, "very little buffer");

// F2: ethanol 40 mmol/L counts x 1.25: calc 2*140+5+5+50 = 340, measured 345 -> gap 5
o = R.interpret({ Na: 140, glucose: 5, urea: 5, ethanol: 40, osm: 345 }, {}); eq("F2 ethanol x1.25", o.derived.calcOsm, 340); eq("F2 gap", o.derived.osmGap, 5);

// G: salicylate; pH 7.46, pCO2 20, HCO3 14; AG 141-(104+14) = 23
o = R.interpret({ pH: 7.46, pCO2: 20, HCO3: 14, tCO2: 14, Na: 141, Cl: 104, salicylate: 3.6 }, {});
has("G resp alk", o.disorders, "Respiratory alkalosis"); has("G HAGMA", o.disorders, "High anion gap"); has("G salicylate toxic", o.flags, "Salicylate 3.6");
o = R.interpret({ pH: 7.46, pCO2: 20, HCO3: 14, tCO2: 14, Na: 141, Cl: 104 }, {});
has("G pattern prompts level", o.flags, "send a salicylate level");

// H: hidden mixed disorder: normal pH and HCO3 but high AG -> HAGMA + met alk
o = R.interpret({ pH: 7.41, pCO2: 40, HCO3: 25, tCO2: 25, Na: 140, Cl: 95 }, {});
has("H HAGMA despite normal pH", o.disorders, "High anion gap"); has("H met alk via delta", o.disorders, "Metabolic alkalosis");

// I: acute respiratory acidosis (opioid); pCO2 70, HCO3 27 -> acute (24+3 = 27)
o = R.interpret({ pH: 7.18, pCO2: 70, HCO3: 27 }, R.classifyMeds(["HYDROmorphone 1 mg IV q1h PRN"]));
has("I acute", [stepTxt(o, "2.")], "ACUTE"); has("I hypercapnia flag", o.flags, "Hypercapnic acidaemia");

// J: mismatched values -> HH caveat
o = R.interpret({ pH: 7.40, pCO2: 40, HCO3: 15 }, {});
has("J HH caveat", o.caveats, "do not fit together");

// K: chemistry only (no gas) still gives the gap
o = R.interpret({ tCO2: 18, Na: 140, Cl: 100, albumin: 20 }, {});
eq("K AG without gas", o.derived.AG, 22); eq("K corrected for albumin 20", o.derived.AGcorr, 27); eq("K primary needs gas", stepOk(o, "1."), null);

// L: all normal
o = R.interpret({ pH: 7.40, pCO2: 40, HCO3: 24, tCO2: 24, Na: 140, Cl: 105, albumin: 40 }, {});
eq("L normal", o.disorders[0], "No acid-base disorder identified"); eq("L no flags", o.flags.length, 0);

// ---- chart parsing of the made-up patients (samples.js -> chart.js -> rules.js) ----
global.window = global.window || {};
const C = require("../tools/acidbase/chart.js");
require("../tools/acidbase/samples.js");
const S = window.ACIDBASE_SAMPLES, now = Date.now();
function run(i) {
  const f = C.parse(S[i].build(now)), g = f.gases[f.gases.length - 1], v = {};
  ["pH", "pCO2", "HCO3", "pO2"].forEach((k) => (v[k] = g ? g[k] : null));
  ["Na", "K", "Cl", "tCO2", "albumin", "glucose", "urea", "creatinine", "lactate", "bhb", "osm", "ethanol", "salicylate", "phos"].forEach((k) => { const e = C.nearLab(f.c[k], g ? g.t : now, 72); v[k] = e ? e.v : null; });
  ["uNa", "uK", "uCl", "uPH", "uOsm", "uUrea", "uGlu"].forEach((k) => { const e = C.near(f.u[k], g ? g.t : now, 48); v[k] = e ? e.v : null; });
  v.specimen = g ? g.spec : "";
  return { f, g, v, o: R.interpret(v, R.classifyMeds(f.medNames)) };
}
let x = run(0); eq("S-A two gases", x.f.gases.length, 2); eq("S-A venous", x.g.spec, "venous"); eq("S-A pH", x.v.pH, 7.22); eq("S-A Cl", x.v.Cl, 102); eq("S-A BHB", x.v.bhb, 5.8);
has("S-A eDKA flag", x.o.flags, "EUGLYCAEMIC"); eq("S-A gap series", C.gapSeries(x.f).length, 2);
x = run(1); eq("S-B arterial", x.g.spec, "arterial"); eq("S-B BE grouped", x.g.BE, -15); has("S-B metformin", x.o.flags, "metformin");
x = run(2); eq("S-C urine Cl", x.v.uCl, 8); has("S-C chloride responsive", x.o.steps.map((s) => s.text), "chloride-responsive");
x = run(3); eq("S-D UAG", x.o.derived.UAG, -25); x = run(4); has("S-E chronic", x.o.steps.map((s) => s.text), "CHRONIC");
x = run(5); eq("S-F osm gap", x.o.derived.osmGap, 31); x = run(6); has("S-G salicylate prompt", x.o.flags, "salicylate level");
// unit conversion: mg/dL glucose and kPa pCO2
const f2 = C.parse({ obs: [
  { resourceType: "Observation", status: "final", code: { text: "Glucose" }, effectiveDateTime: new Date(now - 36e5).toISOString(), valueQuantity: { value: 180, unit: "mg/dL" } },
  { resourceType: "Observation", status: "final", code: { text: "pCO2 Arterial" }, effectiveDateTime: new Date(now - 36e5).toISOString(), valueQuantity: { value: 5.33, unit: "kPa" } },
  { resourceType: "Observation", status: "final", code: { text: "pH Arterial" }, effectiveDateTime: new Date(now - 36e5).toISOString(), valueQuantity: { value: 7.4, unit: "" } },
  { resourceType: "Observation", status: "final", code: { text: "Phosphate" }, effectiveDateTime: new Date(now - 36e5).toISOString(), valueQuantity: { value: 1.1, unit: "mmol/L" } }] }, { now });
near = (n, g, w, t) => { const ok = g != null && Math.abs(g - w) <= t; if (!ok) fail++; console.log((ok ? "ok   " : "FAIL ") + n + ": got " + g + ", want ~" + w); };
near("glucose mg/dL -> mmol/L", f2.c.glucose[0].v, 9.99, 0.02); near("pCO2 kPa -> mmHg", f2.gases[0].pCO2, 40, 0.1); eq("phosphate not read as pH", f2.gases.length, 1); eq("name-only gas grouped", f2.gases[0].pH, 7.4);

// ---- RTA screen (rta.js) ----
const T = require("../tools/acidbase/rta.js");
const rta = (i) => { const y = run(i); return Object.assign(y, { s: T.screen(y.v, y.f.medNames, y.f.probNames, y.o.disorders.some((d) => d.indexOf("Normal anion gap") === 0)) }); };
x = rta(3); eq("RTA D diarrhoea relevant", x.s.relevant, true); eq("RTA D -> GI", x.s.best, "gi"); eq("RTA D UAG", x.s.UAG, -25);
x = rta(7); eq("RTA H NAGMA found", x.s.relevant, true); eq("RTA H -> type 4", x.s.best, "type4"); eq("RTA H UAG", x.s.UAG, 23);
has("RTA H TMP named", x.s.reasons, "Sulfamethoxazole-trimethoprim"); has("RTA H spironolactone", x.s.drugs.map((d) => d.label), "Mineralocorticoid"); has("RTA H heparin", x.s.drugs.map((d) => d.label), "Heparin");
has("RTA H ACEi", x.s.drugs.map((d) => d.label), "ACE inhibitor"); has("RTA H diabetes", x.s.probs.map((p) => p.label), "Diabetes"); has("RTA H nephro K>=6", x.s.nephro, "K 6.1");
x = rta(8); eq("RTA I -> type 1", x.s.best, "type1"); eq("RTA I UOG", x.s.UOG, 30); eq("RTA I NH4", x.s.uNH4, 15); has("RTA I Sjogren", x.s.reasons, "Sjögren"); has("RTA I workup", x.s.missing, "SSA/SSB");
x = rta(9); eq("RTA J -> type 2", x.s.best, "type2"); has("RTA J glucosuria", x.s.fanconi, "Glucose in urine"); has("RTA J low PO4", x.s.fanconi, "phosphate"); has("RTA J tenofovir", x.s.reasons, "Tenofovir"); has("RTA J SPEP", x.s.missing, "SPEP");
// hand cases
let s2 = T.screen({ K: 3.0, tCO2: 14, uNa: 30, uK: 25, uCl: 80, uPH: 6.2 }, [], [], true); eq("diarrhoea with urine pH 6.2 still GI", s2.best, "gi"); has("NH3 pitfall caution", s2.cautions, "NOT distal");
s2 = T.screen({ K: 5.8, tCO2: 18, uNa: 40, uK: 20, uCl: 35, uPH: 6.3 }, ["Amiloride 5 mg"], ["Benign prostatic hyperplasia"], true); eq("high K + urine pH 6.3 -> voltage", s2.best, "hyperKdistal"); has("obstruction test", s2.missing, "Bladder scan");
s2 = T.screen({ K: 3.2, tCO2: 16, uNa: 12, uK: 30, uCl: 30 }, [], [], true); has("UAG unreliable caution", s2.cautions, "urine Na < 20"); has("asks for UOG", s2.missing, "osmolal gap");
s2 = T.screen({ K: 4.0, tCO2: 20 }, [], [], false); eq("not relevant without NAGMA", s2.relevant, false); has("asks for urine lytes", s2.missing, "Urine Na, K, Cl");
s2 = T.screen({ K: 4.6, tCO2: 17, creatinine: 400, uNa: 50, uK: 30, uCl: 60, uPH: 5.2 }, [], [], true); eq("advanced CKD", s2.best, "ckd");
eq("lisinopril is ACEi", T.screen({}, ["Lisinopril 20 mg"], [], true).drugs[0].label, "ACE inhibitor");
// chart reading: urine osmolality / urea in mg/dL
const f3 = C.parse({ obs: [
  { resourceType: "Observation", status: "final", code: { text: "Urea Nitrogen Urine Random" }, effectiveDateTime: new Date(now - 36e5).toISOString(), valueQuantity: { value: 420, unit: "mg/dL" } },
  { resourceType: "Observation", status: "final", code: { text: "Osmolality Urine" }, effectiveDateTime: new Date(now - 36e5).toISOString(), valueQuantity: { value: 410, unit: "mOsm/kg" } }] }, { now });
near("urine urea N mg/dL -> mmol/L", f3.u.uUrea[0].v, 150, 0.5); eq("urine osm read", f3.u.uOsm[0].v, 410); eq("urine osm not urine Na", f3.u.uNa.length, 0);

console.log(fail ? "\n" + fail + " FAILED" : "\nall passed");
process.exit(fail ? 1 : 0);
