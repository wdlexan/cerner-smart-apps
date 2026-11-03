/* Parkinson's note draft. Uses state.x / state.f (app.js) and R. UNVERIFIED draft. */
function pdNote(full) {
  const x = state.x, f = state.f; if (!x || !f) return null;
  const S = {};
  S.meds = x.rows.length ? x.rows.map((r) => r.name + (r.held ? " (on hold)" : "")).concat([`LEDD ${x.L.total} mg/day.`]) : ["No PD medication found."];
  const T = [];
  if (x.lateCount) T.push(`${x.lateCount} PD dose${x.lateCount > 1 ? "s" : ""} more than 30 min late in 72 h.`);
  x.overdue.forEach((t) => T.push(`${t.r.drug.name} overdue by ${t.overdue} min.`));
  x.timing.filter((t) => t.r.n && t.got24 < t.r.n).forEach((t) => T.push(`${t.r.drug.name}: ${t.got24} of ${t.r.n} doses given in 24 h.`));
  S.timing = !f.gives.length ? (x.timing.length ? ["No MAR available to check dose times."] : []) : T.length ? T : x.timing.length ? ["Doses given on time in the last 72 h."] : [];
  S.avoid = x.avoid.map((v) => `${v.sev}: ${v.name.replace(/\s+\d.*$/, "")} (${v.why.replace(/:.*$/, "").replace(/\.$/, "")}).`).concat(x.avoidGiven.map((g) => `${g.name} given ${fmtDT(g.t)}.`));
  S.symptoms = x.sym.map((id) => R.SYMPTOMS.find((s) => s.id === id).label + (state.symAuto[id] && full ? ` (${state.symAuto[id].src})` : "")).concat(x.orth ? [`Orthostatic BP ${x.orth.base} → ${x.orth.stand} (drop ${x.orth.drop}).`] : []);
  const P = [];
  if (x.heldLd.length) P.push("Restart levodopa now (do not stop abruptly).");
  if (x.heldOther.length) P.push(x.heldOther.map((r) => r.drug.name).join(", ") + " on hold (intended); levodopa continued.");
  if (x.npo) P.push("Nil by mouth: NG carbidopa-levodopa IR at usual times" + (x.rows.some((r) => r.drug.id === "ld-cr") ? " (CR converted to IR)" : "") + "; if no tube, rotigotine patch per calculator after neurology discussion.");
  if (x.lateCount || x.overdue.length) P.push("PD meds at exact home times (time-critical); consider self-administration.");
  x.avoid.filter((v) => /Avoid|Contraindicated/.test(v.sev)).forEach((v) => P.push(`Stop ${v.name.replace(/\s+\d.*$/, "")}.`));
  if (x.avoid.some((v) => /metoclopramide|prochlorperazine|promethazine/i.test(v.name))) P.push("Antiemetic: domperidone 10 mg PO TID PRN (QT) or ondansetron.");
  if (x.avoid.some((v) => /haloperidol|risperidone|olanzapine|loxapine|chlorpromazine/i.test(v.name))) P.push("Agitation: non-drug measures; quetiapine 12.5 mg PO qhs PRN if needed.");
  if (full) x.sym.forEach((id) => { const s = R.SYMPTOMS.find((q) => q.id === id); P.push(s.label + ": " + s.mgmt[0]); });
  else {
    if (x.sym.includes("constip")) P.push("PEG 3350 17 g daily ± sennosides.");
    if (x.sym.includes("oh") || (x.orth && x.orth.drop >= 20)) P.push("Orthostatic hypotension: review antihypertensives/diuretics, fluids, stockings; midodrine if persistent.");
    if (x.sym.includes("swallow")) P.push("SLP swallow assessment; meals timed with 'on' periods.");
    if (x.sym.includes("psych") || x.sym.includes("delirium")) P.push("Hallucinations/delirium: treat triggers; reduce anticholinergics, amantadine, agonists first.");
    if (x.sym.includes("freeze")) P.push("PT for gait/freezing; falls precautions.");
  }
  P.push("Neurology / movement disorders input for changes to the PD regimen.");
  S.plan = P;
  const stamp = Math.max(0, ...f.gives.map((g) => g.t), ...(f.orth || []).map((o) => o.t)) || null;
  return { stamp, heading: "PARKINSON DISEASE", sections: S };
}

const PD_NOTE = NoteDraft.mount(document.getElementById("note"), {
  title: "Parkinson disease",
  sections: [{ id: "meds", label: "PD medications", noteLabel: "PD medications" }, { id: "timing", label: "Dose timing" }, { id: "avoid", label: "Drugs to avoid", noteLabel: "Drugs to avoid" },
    { id: "symptoms", label: "Symptoms", noteLabel: "Active issues" }, { id: "plan", label: "Plan" }],
  build: pdNote
});
