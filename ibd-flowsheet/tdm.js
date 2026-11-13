/* Anti-TNF drug levels and anti-drug antibodies (therapeutic drug monitoring). UNVERIFIED draft written by Claude, 13 Nov 2026.
   Timing and targets from: AGA 2017 TDM guideline (reactive testing in active disease; no recommendation on proactive testing),
   Cheifetz et al. Am J Gastroenterol 2021 expert consensus (proactive testing post-induction and at least once in maintenance;
   infliximab >= 7-10 ug/mL at week 14, >= 5-10 in maintenance; adalimumab >= 8-12 ug/mL), timing week 12-14 (infliximab) / week 6-8 (adalimumab).
   Pure functions (node-testable). Antibody titre cut-offs are assay-specific, so titres are not graded here. */
(function (root) {
  const DAY = 864e5, WK = 7 * DAY;
  const DRUGS = {
    infliximab: { name: "Infliximab", level: "ifx", ab: "ifxab", win: [12, 14], postTarget: 7, maintTarget: 5, targetText: "post-induction (week 14) at least 7 to 10 ug/mL; maintenance at least 5 to 10 ug/mL" },
    adalimumab: { name: "Adalimumab", level: "ada", ab: "adaab", win: [6, 8], postTarget: 8, maintTarget: 8, targetText: "at least 8 to 12 ug/mL (post-induction and maintenance)" }
  };
  /* antibody result -> "pos" | "neg" | "unknown" */
  function abState(e) {
    if (!e) return null;
    const t = String(e.text != null ? e.text : "").toLowerCase();
    if (/not detected|undetect|negative|none detected|absent|^\s*</.test(t)) return "neg";
    if (/detected|positive|present/.test(t)) return "pos";
    if (e.v != null && /^\s*$/.test(t)) return e.v > 0 ? "unknown" : "neg";
    return "unknown";
  }
  const latest = (arr) => (arr && arr.length ? arr.slice().sort((a, b) => b.t - a.t)[0] : null);

  /* interpret one level (+ antibody within 14 days of it) */
  function interpret(drugId, lvl, ab, phase, active) {
    const D = DRUGS[drugId]; if (!lvl || lvl.v == null) return null;
    const target = phase === "post" ? D.postTarget : D.maintTarget, low = lvl.v < target, a = abState(ab);
    if (low && a === "neg") return { level: active ? "action" : "info", key: "low-noab", text: `Low level (${lvl.v} below ${target}), no antibodies: likely fast clearance${active ? " with active inflammation" : ""}. Usual step: increase the dose or shorten the interval (GI decision).` };
    if (low && a === "pos") return { level: "action", key: "low-ab", text: `Low level (${lvl.v} below ${target}) WITH antibodies. Low titre: dose increase ± add an immunomodulator may overcome them. High titre: usually switch to another anti-TNF. Titre cut-offs depend on the lab's assay: read the report.` };
    if (low) return { level: "action", key: "low-noabtest", text: `Low level (${lvl.v} below ${target}); antibody result ${a === "unknown" ? "not clear (check the lab report)" : "not on record within 2 weeks"}. Antibodies change the plan: check them with the next trough.` };
    if (a === "pos") return { level: "info", key: "ok-ab", text: `Level in target (${lvl.v}) but antibodies reported: often low titre or transient. Recheck level and antibodies.` };
    if (active) return { level: "action", key: "ok-active", text: `Level in target (${lvl.v}) with active disease: suggests the drug's mechanism is failing (not exposure). Confirm inflammation (CRP, calprotectin, scope) and exclude infection; usual step is switching to a different drug class.` };
    return { level: "ok", key: "ok", text: `Level in target (${lvl.v} ug/mL, target ${target} or more).` };
  }

  /* assess one current anti-TNF. med = { drugId, startT }, labs = f.labs, now, active (flaring / severe) */
  function assess(med, labs, now, active) {
    const D = DRUGS[med.drugId]; if (!D) return null;
    const wks = med.startT != null ? (now - med.startT) / WK : null;
    const lv = (labs[D.level] || []).filter((e) => e.v != null).sort((a, b) => a.t - b.t);
    const abs = (labs[D.ab] || []).slice().sort((a, b) => a.t - b.t);
    const last = lv[lv.length - 1] || null;
    const abNear = last ? latest(abs.filter((a) => Math.abs(a.t - last.t) <= 14 * DAY)) : latest(abs);
    const phaseOf = (t) => (med.startT != null && (t - med.startT) / WK <= D.win[1] + 4 ? "post" : "maint");
    const flags = [];
    const winStart = med.startT != null ? med.startT + D.win[0] * WK : null;
    if (active) {
      if (!last || now - last.t > 30 * DAY) flags.push({ level: "action", key: "reactive", text: `Active disease on ${D.name.toLowerCase()}: send a trough level and antibodies (just before the next dose) to guide the next step (reactive testing, AGA).` });
    }
    if (wks != null && wks < D.win[0]) {
      if (!active) flags.push({ level: "info", key: "due", text: `If this is a new start: post-induction level due at week ${D.win[0]} to ${D.win[1]}: about ${new Date(winStart).toLocaleDateString()} (trough, before that dose).` });
    } else if (wks != null && wks <= D.win[1] + 8 && !active && !lv.some((e) => e.t >= winStart - 7 * DAY)) {
      flags.push({ level: "action", key: "post-missing", text: `If this is a new start: no post-induction level on record (week ${Math.round(wks)} of therapy). Expert consensus: check a trough level and antibodies after induction.` });
    } else if (!last) {
      flags.push({ level: "action", key: "none", text: `No ${D.name.toLowerCase()} level on record. Expert consensus: at least one trough level and antibody check during maintenance${wks == null ? "" : " (start date on record: week " + Math.round(wks) + ")"}.` });
    } else if (now - last.t > 365 * DAY) {
      flags.push({ level: "info", key: "old", text: `Last level ${Math.round((now - last.t) / (30.4 * DAY))} months ago. No fixed interval in guidelines; recheck when the result would change management (many clinics: every 6 to 12 months on monotherapy).` });
    }
    const interp = last ? interpret(med.drugId, last, abNear, phaseOf(last.t), active) : null;
    return { drug: D, weeks: wks, last, ab: abNear, abState: abState(abNear), interp, flags };
  }
  const TABLE = [
    ["Low", "None", "Fast clearance (high inflammation)", "Increase dose or shorten interval"],
    ["Low", "Low titre", "Early immunogenicity", "Increase dose ± add immunomodulator"],
    ["Low", "High titre", "Antibody-driven failure", "Switch to another anti-TNF"],
    ["In target", "None", "Mechanism failure", "Switch to a different class"]];
  root.IBDTdm = { DRUGS, abState, interpret, assess, TABLE };
  if (typeof module !== "undefined" && module.exports) module.exports = root.IBDTdm;
})(typeof window !== "undefined" ? window : globalThis);
