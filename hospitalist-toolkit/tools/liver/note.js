/* Liver note draft. Uses the page's state, inputs(), results(), S, R, C, DAY, fmtD, fmtDT, r1, $ (app.js) and NF (clinical.js). UNVERIFIED draft. */
function liverNote(full) {
  const f = state.f; if (!f) return null;
  const now = Date.now(), { v, x } = inputs(f, now), { m, m3, cp } = results(x), c = NF.c || {};
  const used = Object.values(v).map((e) => e.t).concat(NF.tap ? [NF.tap.last.t] : []);
  if (!used.length) return null;
  const Sx = {};
  const ASC = ["", "none", "mild/controlled", "moderate-severe"], HE = ["", "none", "grade 1-2/controlled", "grade 3-4"];

  // scores
  const prior = results(inputs(f, now - 7 * DAY).x).m;
  Sx.scores = [
    m && m.meldNa != null ? `MELD-Na ${m.meldNa}${m3 ? ", MELD 3.0 " + m3.meld3 : ""}${prior && prior.meldNa != null && prior.meldNa !== m.meldNa ? " (" + prior.meldNa + " a week ago)" : ""}${x.dialysis ? "; creatinine set to maximum for dialysis" : ""}.` : "MELD-Na not calculable (missing recent labs).",
    cp ? (cp.complete ? `Child-Pugh ${cp.score}, class ${cp.cls} (ascites ${ASC[x.ascites]}, encephalopathy ${HE[x.he]}).` : `Child-Pugh ${cp.lo}-${cp.hi} (ascites/encephalopathy not graded).`) : "",
    f.meds.warfarin ? "On warfarin: INR-based scores overstate liver dysfunction." : "",
    m && m.meldNa != null && m.meldNa >= 15 ? "MELD-Na 15 or more: transplant referral threshold if a candidate." : ""];

  // kidneys
  const a = c.aki;
  if (c.esrd) Sx.kidney = ["On chronic dialysis: AKI / HRS-AKI assessment not applicable."];
  else if (a && !a.stale) {
    Sx.kidney = [a.isAki ? `AKI stage ${a.sub}: creatinine ${Math.round(a.cur.v)} vs baseline ${Math.round(a.base)} (${Math.round(a.ratio * 100) / 100}x; ${a.src}).` : `No AKI: creatinine ${Math.round(a.cur.v)} (baseline ${Math.round(a.base)}).`];
    if (NF.hrs) Sx.kidney.push(NF.hrs.resText.replace(/:.*$/, "") + (NF.hrs.h.items.some((i) => i.manual) ? " (checklist reviewed by me)." : "."), ...NF.hrs.done);
    if (c.map != null) Sx.kidney.push(`MAP ${Math.round(c.map)}` + (NF.nb && NF.nb.hold.length && c.nsbb.length ? `; ${c.nsbb.join(", ")} meets hold criteria (${NF.nb.hold.join(", ")}).` : "."));
    if (full && NF.hrs) NF.hrs.steps.forEach((st) => Sx.kidney.push(st.h + ": " + st.items.join(" ")));
  } else Sx.kidney = [a && a.stale ? "No creatinine in the past 72 h." : "No creatinine found."];

  // ascites
  const A = [];
  if (NF.tap && NF.tap.it) {
    const t = NF.tap.last, it = NF.tap.it;
    A.push(`Paracentesis ${fmtD(t.t)}: ${it.corr != null ? "PMN " + Math.round(it.corr) + (it.sbp ? " (SBP)" : " (no SBP)") : "PMN not found"}${it.saag != null ? ", SAAG " + r1(it.saag) + " g/L" + (it.portal ? "" : " (not portal hypertension)") : ""}${t.prot != null ? ", protein " + r1(t.prot) + " g/L" : ""}${t.culture ? ", culture: " + t.culture : ""}.`);
    if (it.secondary) A.push("Possible secondary peritonitis: " + (it.runyon.length ? it.runyon.join(", ") : "polymicrobial culture") + ".");
    if (it.bacterascites) A.push("Bacterascites (culture positive, PMN below 250).");
  } else if (c.ascites || c.ascitesHint) A.push("No paracentesis result found.");
  if (NF.diagTap) A.push("No diagnostic paracentesis in the past 3 days.");
  if (NF.sbp) {
    A.push(NF.sbp.onAbx.length ? "Antibiotics: " + NF.sbp.onAbx.join(", ") + "." : "No antibiotic on record yet.");
    if (NF.sbp.ad) A.push(`Albumin for SBP: ${NF.sbp.ad.d1} g day 1, ${NF.sbp.ad.d3} g day 3 (1.5 and 1 g/kg, ${r1(NF.sbp.wt)} kg).`);
  }
  if (NF.proph && NF.proph.pr.meets) A.push("Meets primary SBP prophylaxis criteria (" + NF.proph.pr.why.join("; ") + ")" + (NF.proph.already.length ? "; on " + NF.proph.already.join(", ") : "") + ".");
  if (NF.diuretic) {
    const d = NF.diuretic;
    if (d.holds.length) A.push(d.holds.join(" ").replace(/^Hold all diuretics: (.*?)\./, "Diuretics held ($1)."));
    else if (d.sp || d.fu) A.push(`Diuretics: ${[d.sp && d.sp.name, d.fu && d.fu.name].filter(Boolean).join("; ")}${d.spMg && d.fuMg ? " (ratio " + Math.round((d.spMg / d.fuMg) * 40) + ":40)" : ""}.`);
    else if (!c.esrd) A.push("No diuretics on record.");
  }
  if (NF.lvp) A.push(`Large-volume paracentesis ${NF.lvp.lit} L` + (NF.lvp.lv ? `: albumin ${NF.lvp.lv.lo}-${NF.lvp.lv.hi} g.` : ": 5 L or less, albumin not routinely needed."));
  Sx.ascites = A;

  // nutrition
  if (NF.nut) {
    const n = NF.nut.n;
    Sx.nutrition = [`Targets ${n.kcal[0]}${n.kcal[1] !== n.kcal[0] ? "-" + n.kcal[1] : ""} kcal and ${n.prot[0]}-${n.prot[1]} g protein/day (${n.basis}); ${n.risk === "high" ? "high" : "at"} malnutrition risk.`,
      "No protein restriction; avoid fasting, late-evening snack.",
      NF.nut.refeed.length ? "Refeeding risk: " + NF.nut.refeed.join(", ") + "." : "", NF.nut.needThiamine ? "Thiamine needed (alcohol-related, none on record)." : ""];
  } else Sx.nutrition = ["No weight found for nutrition targets."];

  // VTE
  if (NF.vte) Sx.vte = [NF.vte.res.head.replace(/\s*\(or dalteparin[^)]*\)/, ""), NF.vte.res.state === "mechanical" && NF.vte.res.start ? NF.vte.res.start : ""];

  // plan
  const P = [];
  if (a && a.isAki && !a.stale && !c.esrd) {
    const stop = [].concat(c.diuretics || [], c.nephro || []);
    if (stop.length) P.push("Hold " + stop.join(", ") + ".");
    P.push("Look for infection (incl. SBP) and GI bleeding; daily creatinine, weight, urine output.");
    if (NF.hrs && /^(Meets|Probable)/.test(NF.hrs.resText)) P.push("HRS-AKI: albumin 20-40 g/day with vasoconstrictor (terlipressin if available, else norepinephrine in ICU/HAU); hepatology.");
    else if (NF.hrs) P.push("If no response 24 h after volume: treat as HRS-AKI.");
  }
  if (NF.diagTap) P.push("Diagnostic paracentesis (cell count, albumin, protein, culture in blood-culture bottles).");
  if (NF.sbp) P.push("SBP: ceftriaxone 2 g IV q24h (or per antibiogram) 5-7 days; albumin as above; repeat tap at 48 h if not improving.");
  if (NF.tap && NF.tap.it && NF.tap.it.secondary) P.push("CT abdomen/pelvis and surgical consult.");
  if (NF.proph && NF.proph.pr.meets && !NF.proph.already.length) P.push("Start SBP prophylaxis.");
  if (NF.diuretic && NF.diuretic.fluidR) P.push("Fluid restriction about 1 L/day (Na 125 or lower).");
  if (m && m.meldNa != null && m.meldNa >= 15) P.push("Discuss transplant referral / goals of care.");
  if (NF.nut) P.push("Dietitian referral" + (NF.nut.needThiamine ? "; thiamine" : "") + (NF.nut.refeed.length ? "; replace K/Mg/phosphate" : "") + ".");
  if (NF.vte) { const s2 = NF.vte.res.state; if (s2 === "start") P.push("Start VTE prophylaxis (" + (NF.vte.res.dose || "enoxaparin").replace(/\s*\(or dalteparin[^)]*\)/, "") + ")."); if (s2 === "mechanical") P.push("Mechanical VTE prophylaxis; reassess drug prophylaxis daily."); }
  if (full && NF.sbp) P.push("After SBP: long-term secondary prophylaxis.");
  Sx.plan = P;

  Sx.labs = ["bili", "creat", "inr", "na", "alb"].filter((k) => v[k]).map((k) => ({ bili: "bilirubin", creat: "creatinine", inr: "INR", na: "Na", alb: "albumin" }[k]) + " " + r1(v[k].v) + " (" + fmtD(v[k].t) + ")");
  Sx.labs = Sx.labs.length ? [Sx.labs.join(", ") + "."] : [];
  return { stamp: Math.max(...used), heading: "CIRRHOSIS", sections: Sx };
}

const LIVER_NOTE = NoteDraft.mount(document.getElementById("note"), {
  title: "Liver",
  sections: [{ id: "scores", label: "Scores" }, { id: "kidney", label: "Kidneys / HRS", noteLabel: "Kidneys" }, { id: "ascites", label: "Ascites / SBP", noteLabel: "Ascites" },
    { id: "nutrition", label: "Nutrition" }, { id: "vte", label: "VTE", noteLabel: "VTE prophylaxis" }, { id: "plan", label: "Plan" }, { id: "labs", label: "Lab values", on: false }],
  build: liverNote
});
