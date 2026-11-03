/* Mobility note draft. Uses state.x (app.js) plus R, lv, aidText, days, fmtD. UNVERIFIED draft. */
function mobNote(full) {
  const x = state.x, f = state.f; if (!x || !f) return null;
  const S = {}, strip = (h) => h.replace(/<[^>]+>/g, "").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
  S.summary = summaryText(x).map(strip);
  S.todo = x.todo.map((t) => t.what + (t.days ? " (" + days(t.days) + ")" : ""));
  S.equip = x.equip.filter((q) => q.status !== "has").map((q) => q.name + (q.status === "suggested" ? " (to confirm with OT)" : ""));
  if (x.equip.some((q) => q.status === "has")) S.equip.push("Already has: " + x.equip.filter((q) => q.status === "has").map((q) => q.name.toLowerCase()).join(", "));
  const P = [];
  if (!x.hasPT && !x.ptOrdered) P.push("PT consult."); if (!x.hasOT && !x.otOrdered && x.cur && x.cur.level < 8) P.push("OT consult.");
  if (x.est.status === "plateau") P.push("Discuss rehab / restorative care vs more home support with PT and family.");
  if (x.home.alone && x.cur && x.cur.level <= 6 && x.dest === "home") P.push("Home and Community Care referral.");
  if (S.equip.length && x.equip.some((q) => q.status !== "has")) P.push("Equipment to be in place before discharge.");
  if (x.overall) P.push("Estimated discharge-ready in about " + days(x.overall) + "; reassess daily.");
  S.plan = P;
  if (full) S.sources = f.records.slice(-6).map((r) => `${fmtD(r.t)} ${r.src}: ${r.quote || r.title}`);
  const stamp = f.records.length ? f.records[f.records.length - 1].t : null;
  return { stamp, heading: "MOBILITY / DISCHARGE PLANNING", sections: S };
}

const MOB_NOTE = NoteDraft.mount(document.getElementById("note"), {
  title: "Mobility",
  sections: [{ id: "summary", label: "Summary" }, { id: "todo", label: "Outstanding steps" }, { id: "equip", label: "Equipment", noteLabel: "Equipment for discharge" }, { id: "plan", label: "Plan" }, { id: "sources", label: "Sources (Full only)", noteLabel: "From the notes" }],
  build: mobNote
});
