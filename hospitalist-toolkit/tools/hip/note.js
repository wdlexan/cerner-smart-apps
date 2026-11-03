/* Hip fracture note draft. Uses state.x (worked out in app.js draw) plus state, R, $, fmtDT, r1. UNVERIFIED draft. */
function hipNote(full) {
  const x = state.x, f = state.f; if (!x || !f) return null;
  const S = {}, tl = x.tl, stampSrc = [x.hgb, x.cr, x.na, x.inr].filter(Boolean).map((e) => e.t);
  const fx = f.fracture ? f.fracture.n : "hip fracture";
  // summary
  S.summary = [
    `${f.age != null ? f.age + " y " : ""}${f.sex || ""} with ${fx}${f.surgery && x.done ? "; " + f.surgery.n + " " + fmtDT(x.surgery) : ""}.`,
    tl ? (x.done ? `Day ${tl.pod} after surgery. Time to theatre ${Math.round(tl.hours)} h${tl.over48 ? " (over the 48 h target)" : ""}.` : `Pre-op, waiting ${Math.round(tl.hours)} h` + (tl.over48 ? " (over the 48 h target)." : ` (48 h mark ${fmtDT(tl.deadline)}).`)) : "",
    x.nhfs ? `Nottingham Hip Fracture Score ${x.nhfs.score} (about ${r1(x.nhfs.mort30)}% 30-day mortality).` : ""];
  // pre-op
  if (!x.done) {
    const issues = x.pre.items.filter((i) => i.state !== "ok").map((i) => i.label + (i.value ? " " + r1(i.value.v) : "") + (i.state === "delay" ? " (reason to delay)" : i.state === "missing" ? " not found" : ""));
    S.preop = [issues.length ? "Issues: " + issues.join("; ") + "." : "Pre-op labs acceptable; group and screen done."];
  }
  // anticoagulation
  const A = [];
  x.acRes.forEach((a) => {
    if (a.kind === "warfarin") A.push(`${a.name}: INR ${x.inr ? x.inr.v : "not found"}${a.reverse ? (x.vitk.length ? "; vitamin K given" : "; for vitamin K reversal") : ""}.`);
    else if (!x.done && (a.ga || a.neuraxial)) A.push(`${a.name}${a.last ? " (last dose " + fmtDT(a.last) + ")" : ""}: GA from ${a.ga ? fmtDT(a.ga) : "?"}${a.neuraxial ? ", spinal from " + fmtDT(a.neuraxial) : ""}.`);
    else A.push(a.name + ".");
  });
  R.antiplatelet(x.ap).forEach((t) => A.push(x.ap.join(" + ") + ": " + t.split(". ")[0].replace(/^[^:]*:\s*/, "") + "."));
  if (x.done && x.therapeutic) A.push(`Restart ${x.therapeutic.name} 24-72 h after surgery once haemostasis is secure.`);
  S.anticoag = A.length ? A : ["No anticoagulant or antiplatelet."];
  // post-op
  if (x.done) {
    const P = [];
    const hg = f.labs.hgb.filter((e) => e.t >= x.arrival - 12 * HR).map((e) => Math.round(e.v));
    if (hg.length) P.push("Hgb " + hg.join(" → ") + (x.hgb && x.hgb.v < 80 ? " (below transfusion threshold)" : "") + ".");
    if (x.cr) P.push(x.akiNow ? `AKI: creatinine ${Math.round(x.baseCr)} → ${Math.round(x.cr.v)}.` : `Creatinine ${Math.round(x.cr.v)} (pre-op ${Math.round(x.baseCr)}).`);
    if (x.na && x.na.v < 130) P.push("Na " + x.na.v + ".");
    if (x.spo2 != null && x.spo2 < 92) P.push("SpO2 " + x.spo2 + "%.");
    const cam = $("cam").value;
    P.push(`Delirium screen ${cam || "not recorded"}; ${$("mobil").checked ? "mobilised" : "not yet mobilised"}; catheter ${$("cath").checked ? "in" : "out"}; bowels ${$("bm").checked ? "moved" : "not yet moved"}.`);
    S.postop = P;
  }
  // pain/delirium
  S.pain = [`${x.apapSched ? "Scheduled acetaminophen" : "No scheduled acetaminophen"}; ${x.block ? "nerve block done" : "no nerve block"}; ${x.opioid.length ? x.opioidGiven + " opioid dose(s) in 24 h" : "no opioid"}; ${x.bowel.length ? "bowel regimen in place" : "no bowel regimen"}.`,
    x.delMeds.length ? "Delirium-risk drugs: " + x.delMeds.join(", ") + "." : ""];
  // VTE and bone
  S.vte = [x.vte.state === "on" ? `${x.onProph.name}${x.done ? "; continue 28-35 days total" : "; hold 12 h before spinal"}.` : x.vte.text];
  S.bone = x.bone.treat ? [x.vitd ? `Vitamin D ${Math.round(x.vitd.v)} nmol/L${x.vitd.v < 50 ? " (low: replace first)" : ""}.` : "Vitamin D level not found.",
    x.crcl != null && x.crcl < 35 ? "CrCl below 35: denosumab rather than a bisphosphonate." : "Plan bisphosphonate (zoledronic acid or alendronate) after hip fracture.", "Fracture liaison / falls follow-up."] : ["On " + x.osteo.join(", ") + "."];
  // plan
  const P = [];
  if (!x.done) {
    const war = x.acRes.find((a) => a.kind === "warfarin");
    x.pre.delay.filter((i) => !(i.label === "INR" && war)).forEach((i) => P.push("Correct " + (/^[A-Z]{2}/.test(i.label) ? i.label : i.label.toLowerCase()) + " (" + r1(i.value.v) + ") before theatre."));
    if (x.k && x.k.v < 3.5 && x.k.v >= 2.8) P.push("Replace potassium (" + x.k.v + ").");
    if (x.na && x.na.v < 130 && x.na.v >= 120) P.push("Sodium " + x.na.v + ": review fluids and drugs; recheck.");
    if (war && war.reverse && !x.vitk.length) P.push("IV vitamin K; recheck INR in 6 h (target 1.5 or less for spinal).");
    if (!x.ts) P.push("Group and screen.");
    if (x.vte.state === "start") P.push("Start " + x.vte.dose + " while waiting; hold 12 h before a spinal.");
    P.push(x.tl && x.tl.over48 ? "Past 48 h: escalate for the next theatre slot." : "Theatre as soon as fit (target within 48 h).");
  } else {
    if (x.hgb && x.hgb.v < 80) P.push("Transfuse 1 unit RBC; recheck Hgb.");
    else if (x.tl.pod <= 2) P.push("CBC, electrolytes and creatinine tomorrow.");
    if (x.akiNow) P.push("AKI: fluids if dry, hold nephrotoxins, adjust drug doses.");
    if ($("cath").checked && x.tl.pod >= 1) P.push("Remove urinary catheter; bladder scan.");
    if (!$("mobil").checked) P.push("Mobilise with physiotherapy, weight bearing as tolerated unless restricted.");
    if (x.vte.state === "start") P.push("Start " + x.vte.dose + "; continue 28-35 days.");
  }
  if (x.onProph && /enoxaparin/i.test(x.onProph.name) && x.crcl != null && x.crcl < 30 && /40\s*mg/i.test(f.meds.filter((m) => m.cats.includes("lmwh")).map((m) => m.name).join(" "))) P.push("Reduce enoxaparin to 30 mg SC daily (CrCl " + Math.round(x.crcl) + ").");
  if (!x.apapSched) P.push("Acetaminophen 1 g PO q6h scheduled.");
  if (x.opioid.length && !x.bowel.length) P.push("PEG 3350 17 g daily + sennosides 17.2 mg qhs.");
  if (x.delMeds.length) P.push("Stop " + x.delMeds.join(", ") + ".");
  if (x.bone.treat) P.push((x.vitd && x.vitd.v < 50 ? "Replace vitamin D, then " : "Vitamin D 1,000-2,000 IU daily; ") + "osteoporosis treatment before or after discharge; falls assessment.");
  if (x.nhfs && x.nhfs.score >= 6) P.push("Goals of care discussion (Nottingham score " + x.nhfs.score + ").");
  if (full && x.done) P.push("Delirium bundle: glasses/hearing aids, sleep, hydration, early mobility, daily 4AT.");
  S.plan = P;
  S.labs = [["Hgb", x.hgb], ["plt", x.plt], ["Na", x.na], ["K", x.k], ["creatinine", x.cr], ["INR", x.inr], ["glucose", x.glu]].filter(([, e]) => e).map(([n, e]) => n + " " + r1(e.v)).join(", ") + (x.crcl != null ? ", CrCl " + Math.round(x.crcl) : "") + ".";
  S.labs = [S.labs];
  return { stamp: stampSrc.length ? Math.max(...stampSrc) : null, heading: "HIP FRACTURE (co-management)", sections: S };
}

const HIP_NOTE = NoteDraft.mount(document.getElementById("note"), {
  title: "Hip fracture",
  sections: [{ id: "summary", label: "Summary" }, { id: "preop", label: "Pre-op", noteLabel: "Pre-op readiness" }, { id: "anticoag", label: "Anticoagulation" }, { id: "postop", label: "Post-op", noteLabel: "Post-op" },
    { id: "pain", label: "Pain / delirium", noteLabel: "Pain, delirium, bowels" }, { id: "vte", label: "VTE", noteLabel: "VTE prophylaxis" }, { id: "bone", label: "Bone health" }, { id: "plan", label: "Plan" }, { id: "labs", label: "Lab values", on: false }],
  build: hipNote
});
