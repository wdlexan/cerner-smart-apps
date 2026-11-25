/* node tests/test_sbo.js  - hand-worked checks of the small bowel obstruction rules and the made-up patients */
const R = require("../tools/sbo/rules.js");
const C = require("../tools/sbo/chart.js");
global.window = {}; require("../tools/sbo/samples.js");
let fail = 0;
const ok = (n, c) => { if (!c) fail++; console.log((c ? "ok   " : "FAIL ") + n); };
const eq = (n, g, w) => { const o = g === w; if (!o) fail++; console.log((o ? "ok   " : "FAIL ") + n + ": got " + g + ", want " + w); };
const ids = (t) => R.imaging(t).ids;

// imaging scan and negation
ok("transition point found", ids("Dilated small bowel with a transition point in the RLQ.").has("transition"));
ok("no free air ignored", !ids("No free air. No pneumatosis.").has("freeAir"));
ok("no pneumatosis ignored", !ids("No free air. No pneumatosis.").has("pneumatosis"));
ok("normal enhancement is not reduced", !ids("Normal bowel wall enhancement.").has("reducedEnh"));
ok("reduced enhancement found", ids("Loop shows reduced wall enhancement.").has("reducedEnh"));
ok("absent enhancement found", ids("There is no wall enhancement of the herniated loop.").has("reducedEnh"));
ok("'ischemia cannot be excluded' kept", ids("Ischemia cannot be excluded.").has("ischemia"));
ok("pneumoperitoneum = free air", ids("Moderate pneumoperitoneum.").has("freeAir"));
ok("contrast not in colon", ids("Contrast has not reached the colon.").has("noContrastColon") && !ids("Contrast has not reached the colon.").has("contrastColon"));
ok("contrast in colon", ids("Contrast is seen in the colon and rectum.").has("contrastColon"));
eq("cecum diameter", R.imaging("Dilated colon, cecum measures 12.5 cm.").cecum, 12.5);
ok("two transition points alone is not closed loop", !ids("Multiple transition points from implants.").has("closedLoop"));

// red flags and perforation risk
eq("peritonitis -> surgery now", R.pathway({ peritonitis: true, ct: new Set(["sbo"]) }).act, "surgeryNow");
eq("free air -> perforated", R.perforation({ ct: new Set(["freeAir"]) }).level, "perforated");
eq("closed loop -> high", R.perforation({ ct: new Set(["closedLoop", "sbo"]) }).level, "high");
eq("no CT, no flags -> unknown", R.perforation({ ctDone: false, ct: new Set() }).level, "unknown");
eq("clean CT -> low", R.perforation({ ctDone: true, ct: new Set(["sbo", "transition"]) }).level, "low");
eq("lactate 4.0 urgent", R.redFlags({ lactate: 4.0 })[0].lvl, "urgent");
eq("lactate 2.5 action", R.redFlags({ lactate: 2.5 })[0].lvl, "action");
eq("lactate 2.0 nothing", R.redFlags({ lactate: 2.0 }).length, 0);
eq("CRP 75 flagged", R.redFlags({ crp: 75 }).length, 1);
eq("cecum 12 urgent", R.redFlags({ cecum: 12 })[0].lvl, "urgent");
eq("cecum 10 action", R.redFlags({ cecum: 10 })[0].lvl, "action");

// contrast challenge
eq("WSCC offered when clean", R.wscc({ ct: new Set(["sbo"]), cause: "adhesions" }).status, "offer");
eq("WSCC not with closed loop", R.wscc({ ct: new Set(["closedLoop"]) }).status, "no");
eq("WSCC fail at 24 h", R.wscc({ wsccGiven: true, wsccHours: 24, wsccColon: "no" }).status, "fail");
eq("WSCC no colon at 6 h = wait", R.wscc({ wsccGiven: true, wsccHours: 6, wsccColon: "no" }).status, "wait");
eq("WSCC pass", R.wscc({ wsccGiven: true, wsccHours: 10, wsccColon: "yes" }).status, "pass");
eq("72 h no resolution -> surgery", R.pathway({ ct: new Set(["sbo", "transition"]), ctDone: true, nomHours: 73, cause: "adhesions" }).act, "surgeryToday");
eq("LBO pathway", R.pathway({ ct: new Set(["lbo", "mass"]), ctDone: true }).act, "lbo");
eq("ileus pathway", R.pathway({ ct: new Set(["ileus"]), ctDone: true }).act, "ileus");

// medications
const mf = (m) => R.medFlags(m).map((x) => x.id);
ok("metoclopramide = prokinetic", mf(["metoclopramide 10 mg IV q6h"]).includes("prokinetic"));
ok("dimenhydrinate = anticholinergic", mf(["dimenhydrinate 25 mg IV q4h PRN"]).includes("anticholinergic"));
ok("levodopa urgent", R.medFlags(["carbidopa-levodopa 25/100 mg PO QID"]).find((x) => x.id === "levodopa").lvl === "urgent");
ok("semaglutide = GLP-1", mf(["semaglutide 1 mg SC weekly"]).includes("glp1"));
ok("enoxaparin 40 not anticoag", !mf(["enoxaparin 40 mg SC daily"]).includes("anticoag"));
ok("oral-only catches leftovers", mf(["amlodipine 5 mg PO daily"]).includes("oralOnly"));

// fluids: 70 kg, NG 1000 -> 1750 + 1000
const fl = R.fluids({ weight: 70, ngOut: 1000 });
eq("maintenance 70 kg", fl.maint, 1750); eq("total", fl.total, 2750); eq("hourly", fl.hourly, 115);

// made-up patients end to end
const want = ["nom", "surgeryNow", "surgeryNow", "mbo", "crohn", "surgeryToday", "surgeryNow"];
const now = Date.now();
window.SBO_SAMPLES.forEach((p, i) => {
  const f = C.parse(p.build(now), { now }), s = p.sit, L = (src, k) => { const a = f[src][k]; return a && a.length ? a[a.length - 1].v : null; };
  const ct = new Set(); let cecum = null;
  f.reports.forEach((r) => { const sc = R.imaging(r.name + ". " + r.text); sc.ids.forEach((x) => { if (x === "contrastColon") ct.delete("noContrastColon"); if (x === "noContrastColon") ct.delete("contrastColon"); ct.add(x); }); if (sc.cecum) cecum = sc.cecum; });
  const o = { age: f.age, ct, ctDone: f.reports.some((r) => /\bct\b/i.test(r.name)), hr: L("v", "hr"), sbp: L("v", "sbp"), temp: L("v", "temp"), lactate: L("l", "lactate"), wbc: L("l", "wbc"), crp: L("l", "crp"),
    hco3: L("l", "hco3"), ph: L("l", "ph"), k: L("l", "k"), cr: L("l", "cr"), cecum, nomHours: s.nomHours, colicky: s.colicky, continuous: s.continuous, obstipation: s.obstipation,
    peritonitis: s.peritonitis, guarding: s.guarding, hernia: s.hernia || "none", priorSurgery: !!f.prob.priorSurgery, carcinomatosis: !!f.prob.carcinomatosis || ct.has("carcinomatosis"),
    crohn: !!f.prob.crohn, cancer: !!f.prob.cancer, steroid: f.cls.steroid.length > 0, cause: s.cause, wsccGiven: !!s.wsccGiven, wsccHours: s.wsccHours,
    wsccColon: ct.has("contrastColon") ? "yes" : ct.has("noContrastColon") ? "no" : "" };
  if (o.crohn && !o.cause) o.cause = "crohn";
  eq("sample " + "ABCDEFG"[i] + " pathway", R.pathway(o).act, want[i]);
  if (i === 0) { ok("A: prior surgery from procedures", !!f.prob.priorSurgery); ok("A: NG 24 h summed", f.ng24 === 1350); ok("A: WSCC offered", R.wscc(o).status === "offer"); ok("A: crBase", f.crBase === 72); }
  if (i === 3) ok("D: metoclopramide flagged", R.medFlags(f.medTexts).some((m) => m.id === "prokinetic"));
  if (i === 5) ok("F: levodopa + SGLT2 flagged", ["levodopa", "sglt2", "anticholinergic"].every((id) => R.medFlags(f.medTexts).some((m) => m.id === id)));
  if (i === 6) { eq("G: perforated", R.perforation(o).level, "perforated"); ok("G: steroid masked flag", R.redFlags(o).some((x) => x.id === "masked")); }
});

console.log(fail ? `\n${fail} FAILED` : "\nall passed");
process.exit(fail ? 1 : 0);
