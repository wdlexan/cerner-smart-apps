/* Consult summary rules: specialty templates, Glasgow-Blatchford, KDIGO stage, message builders, Teams deep link. Pure functions (tests/test_consult.js).
   Units: Hgb g/L, urea / K / Na / HCO3 mmol/L, creatinine umol/L, bilirubin umol/L, albumin g/L. UNVERIFIED draft written by Claude. */
(function (root) {
  const H = 36e5, DAY = 864e5;
  const ok = (v) => typeof v === "number" && isFinite(v);
  const rd = (v) => (Math.abs(v) >= 100 ? Math.round(v) : Math.round(v * 10) / 10);

  /* lab ids each template shows (in order); "trend" = show a short trend instead of one value */
  const SPECIALTIES = {
    gi: { label: "GI", labs: [["hgb", "trend"], ["plt"], ["inr"], ["urea"], ["cr"], ["alb"], ["bili"], ["alt"], ["alp"], ["lipase"]], meds: ["anticoag", "antiplatelet", "ppi", "nsaid", "steroid"] },
    renal: { label: "Nephrology", labs: [["cr", "trend"], ["k"], ["na"], ["hco3"], ["urea"], ["hgb"], ["ca"], ["phos"], ["una"], ["uprotcr"]], meds: ["nephrotoxic", "diuretic", "acearb", "k"] },
    cardio: { label: "Cardiology", labs: [["trop", "trend"], ["bnp"], ["k"], ["mg"], ["cr"], ["hgb"], ["tsh"], ["inr"]], meds: ["anticoag", "antiplatelet", "rate", "hfmeds", "qt"] },
    liver: { label: "Hepatology", labs: [["bili", "trend"], ["inr"], ["cr"], ["na"], ["alb"], ["plt"], ["alt"], ["ast"], ["alp"]], meds: ["liver", "diuretic", "nsbb", "anticoag", "nephrotoxic"] },
    general: { label: "", labs: [["hgb"], ["wbc"], ["plt"], ["na"], ["k"], ["cr"], ["glu"]], meds: [] }
  };
  const URGENCY = { emergent: "EMERGENT (now)", urgent: "URGENT (today)", routine: "ROUTINE (next 24-48 h)" };

  /* Glasgow-Blatchford (urea mmol/L, Hgb g/L, SBP, HR). x.melena, x.syncope, x.liver, x.hf: booleans */
  function gbs(x) {
    if (![x.urea, x.hgb, x.sbp, x.hr].every(ok)) return null;
    let s = 0;
    s += x.urea >= 25 ? 6 : x.urea >= 10 ? 4 : x.urea >= 8 ? 3 : x.urea >= 6.5 ? 2 : 0;
    if (x.sex === "female") s += x.hgb < 100 ? 6 : x.hgb < 120 ? 1 : 0;
    else s += x.hgb < 100 ? 6 : x.hgb < 120 ? 3 : x.hgb < 130 ? 1 : 0;
    s += x.sbp < 90 ? 3 : x.sbp < 100 ? 2 : x.sbp < 110 ? 1 : 0;
    s += x.hr >= 100 ? 1 : 0;
    s += (x.melena ? 1 : 0) + (x.syncope ? 2 : 0) + (x.liver ? 2 : 0) + (x.hf ? 2 : 0);
    return { score: s, low: s <= 1 };
  }

  /* KDIGO stage from creatinine: baseline = lowest in the 90 days before the latest; rise in 48 h */
  function kdigo(series) {
    const s = (series || []).filter((e) => ok(e.v)).sort((a, b) => a.t - b.t); if (s.length < 2) return null;
    const cur = s[s.length - 1], prior = s.slice(0, -1).filter((e) => cur.t - e.t <= 90 * DAY);
    if (!prior.length) return null;
    const base = Math.min(...prior.map((e) => e.v)), r = cur.v / base;
    const p48 = prior.filter((e) => cur.t - e.t <= 48 * H), rise48 = p48.length ? cur.v - Math.min(...p48.map((e) => e.v)) : 0;
    const stage = r >= 3 || (cur.v >= 353.6 && (rise48 >= 26.5 || r >= 1.5)) ? 3 : r >= 2 ? 2 : r >= 1.5 || rise48 >= 26.5 ? 1 : 0;
    return { stage, base, cur: cur.v, ratio: r };
  }

  /* trend text: up to n values, oldest to newest, within `days` */
  function trend(arr, now, days, n) {
    const a = (arr || []).filter((e) => now - e.t <= (days || 3) * DAY).slice(-(n || 4));
    return a.length ? a.map((e) => rd(e.v)).join(" → ") : "";
  }
  const initials = (name) => String(name || "").split(/[\s,]+/).filter(Boolean).map((w) => w[0].toUpperCase()).join("");

  /* ---- message builders ----
     c: { spec, urgency, question, done, findings, callback, who: {age, sex, initials, mrn, location, day, reason}, vitals: {hr, sbp, dbp, spo2, temp, rr},
          lines: [string] (specialty data, one per line), meds: [string], problems: [string], code, stamp, link } */
  function teams(c) {
    const S = SPECIALTIES[c.spec] || SPECIALTIES.general, w = c.who || {};
    const head = `${(S.label || c.specName || "Consult").toUpperCase()} CONSULT – ${URGENCY[c.urgency] || "URGENT (today)"}`;
    const id = [w.age != null ? w.age + (w.sex ? w.sex[0].toUpperCase() : "") : "", w.initials, w.location, w.day != null ? "admitted day " + w.day : "", w.reason ? "for " + w.reason : ""].filter(Boolean).join(", ") + (w.mrn ? ` (MRN ${w.mrn})` : "");
    const v = c.vitals || {}, vit = [v.hr != null && "HR " + v.hr, v.sbp != null && "BP " + v.sbp + (v.dbp != null ? "/" + v.dbp : ""), v.spo2 != null && "SpO2 " + v.spo2 + "%", v.temp != null && "T " + v.temp].filter(Boolean).join(", ");
    const out = [head, "Q: " + (c.question || "[your question]"), id];
    (c.lines || []).slice(0, 6).forEach((l) => out.push(l));
    if (vit) out.push(vit);
    if (c.meds && c.meds.length) out.push("Meds: " + c.meds.slice(0, 5).join("; "));
    if (c.findings) out.push("Findings: " + c.findings);
    if (c.done) out.push("Done: " + c.done);
    if (c.code) out.push("Code status: " + c.code);
    out.push("Callback: " + (c.callback || "[name, number]"));
    if (c.link) out.push("Open patient: " + c.link);
    if (c.stamp) out.push("Data as of " + c.stamp);
    return out.filter(Boolean).join("\n");
  }
  function full(c) {
    const S = SPECIALTIES[c.spec] || SPECIALTIES.general, w = c.who || {}, v = c.vitals || {};
    const sec = (h, lines) => (lines.filter(Boolean).length ? [h + ":"].concat(lines.filter(Boolean).map((l) => "- " + l)) : []);
    return [].concat(
      [`CONSULT REQUEST: ${S.label || c.specName || "Specialist"} – ${URGENCY[c.urgency] || ""}` + (c.stamp ? ` (data as of ${c.stamp})` : "")],
      sec("Question", [c.question || "[your question]"]),
      sec("Background", [[w.age != null ? w.age + " y" : "", w.sex, w.location, w.day != null ? "hospital day " + w.day : "", w.reason ? "admitted for " + w.reason : ""].filter(Boolean).join(", ") + (w.mrn ? " (MRN " + w.mrn + ")" : ""),
        c.problems && c.problems.length ? "Active problems: " + c.problems.join("; ") : "", c.code ? "Code status: " + c.code : ""]),
      sec("Current status", [[v.hr != null && "HR " + v.hr, v.sbp != null && "BP " + v.sbp + (v.dbp != null ? "/" + v.dbp : ""), v.rr != null && "RR " + v.rr, v.spo2 != null && "SpO2 " + v.spo2 + "%", v.temp != null && "temp " + v.temp].filter(Boolean).join(", ")]),
      sec("Relevant results", (c.fullLines || c.lines || []).concat(c.findings ? ["Other findings: " + c.findings] : [])),
      sec("Relevant medications", c.medsFull || c.meds || []),
      sec("Done so far", [c.done]),
      sec("Contact", [c.callback || "[name, number]", c.link ? "Open patient in the Toolkit: " + c.link : ""])
    ).join("\n");
  }

  /* Teams deep link to a 1:1 chat with a prefilled draft. Teams caps the URL, so a long message is cut (the clipboard keeps the whole text). */
  function teamsLink(emails, text, max) {
    const users = (emails || "").split(/[,;\s]+/).filter((e) => /@/.test(e)).join(",");
    if (!users) return null;
    let msg = text || "", url;
    const limit = max || 1800;
    do { url = "https://teams.microsoft.com/l/chat/0/0?users=" + encodeURIComponent(users) + "&message=" + encodeURIComponent(msg); if (url.length > limit) msg = msg.slice(0, Math.floor(msg.length * 0.85)); } while (url.length > limit && msg.length > 20);
    return { url, cut: msg.length < (text || "").length };
  }

  const api = { SPECIALTIES, URGENCY, gbs, kdigo, trend, initials, teams, full, teamsLink, rd, H, DAY };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.ConsultRules = api;
})(typeof window !== "undefined" ? window : globalThis);
