/* Liver scores: MELD, MELD-Na, MELD 3.0 and Child-Pugh. Pure functions, no chart access (tested in tests/test_liver.js).
   Inputs are in Canadian SI units: bilirubin umol/L, creatinine umol/L, albumin g/L, sodium mmol/L, INR unitless.
   UNVERIFIED draft written by Claude: check formulas and cut-offs against the OPTN/UNOS definitions and your local references before real use. */
(function (root) {
  const BILI = 17.1, CREAT = 88.4; // umol/L per mg/dL
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const ln = Math.log;
  const ok = (v) => typeof v === "number" && isFinite(v) && v > 0;

  /* Unit conversion to SI. unit is the text the lab sent; guess by value only when the unit is missing. */
  const toSI = {
    bili: (v, u) => (/mg\s*\/\s*dl/i.test(u || "") ? v * BILI : v),
    creat: (v, u) => (/mg\s*\/\s*dl/i.test(u || "") || (!u && v < 20) ? v * CREAT : v),
    alb: (v, u) => (/g\s*\/\s*dl/i.test(u || "") || v < 10 ? v * 10 : v),
    na: (v) => v,
    inr: (v) => v
  };

  /* Original MELD and MELD-Na, OPTN/UNOS method (2016 onward):
     lab values below 1.0 are set to 1.0; creatinine is capped at 4.0 mg/dL and set to 4.0 if dialysed twice or more,
     or on CVVHD for 24 h, in the past week; sodium bounded 125-137; MELD-Na correction only when MELD > 11; maximum 40. */
  function meld(x) {
    if (!ok(x.bili) || !ok(x.creat) || !ok(x.inr)) return null;
    const bili = Math.max(1, x.bili / BILI), inr = Math.max(1, x.inr);
    const creat = x.dialysis ? 4 : clamp(x.creat / CREAT, 1, 4);
    const raw = 0.957 * ln(creat) + 0.378 * ln(bili) + 1.12 * ln(inr) + 0.643;
    const m = Math.min(40, Math.round(raw * 10 * 10) / 10); // MELD(i): rounded to the tenth then x10
    const out = { meld: Math.round(m), meldExact: m, used: { bili, creat, inr } };
    if (ok(x.na)) {
      const na = clamp(x.na, 125, 137);
      const mna = m > 11 ? m + 1.32 * (137 - na) - 0.033 * m * (137 - na) : m;
      out.meldNa = Math.min(40, Math.round(mna));
      out.used.na = na;
    }
    return out;
  }

  /* MELD 3.0 (Kim et al., Gastroenterology 2021; OPTN allocation since 2023).
     Bilirubin, INR and creatinine below 1.0 set to 1.0; creatinine max 3.0 (set to 3.0 on dialysis); sodium 125-137;
     albumin bounded 1.5-3.5 g/dL; maximum 40. */
  function meld3(x) {
    if (!ok(x.bili) || !ok(x.creat) || !ok(x.inr) || !ok(x.na) || !ok(x.alb)) return null;
    const bili = Math.max(1, x.bili / BILI), inr = Math.max(1, x.inr);
    const creat = x.dialysis ? 3 : clamp(x.creat / CREAT, 1, 3);
    const na = clamp(x.na, 125, 137), alb = clamp(x.alb / 10, 1.5, 3.5);
    const female = x.sex === "female" ? 1 : 0;
    const v = 1.33 * female + 4.56 * ln(bili) + 0.82 * (137 - na) - 0.24 * (137 - na) * ln(bili) + 9.09 * ln(inr) +
      11.14 * ln(creat) + 1.85 * (3.5 - alb) - 1.83 * (3.5 - alb) * ln(creat) + 6;
    return { meld3: Math.min(40, Math.max(6, Math.round(v))), sexKnown: x.sex === "female" || x.sex === "male" };
  }

  /* Child-Pugh (Pugh modification). Bilirubin cut-offs 34 / 50 umol/L, or 68 / 170 umol/L for cholestatic disease (PBC, PSC).
     ascites and he: 1 none, 2 mild / controlled, 3 moderate-severe / refractory; null = not chosen yet.
     When either clinical item is missing the result is a range (lowest and highest possible). */
  function childPugh(x) {
    if (!ok(x.bili) || !ok(x.alb) || !ok(x.inr)) return null;
    const pts = {};
    pts.bili = x.cholestatic ? (x.bili < 68 ? 1 : x.bili <= 170 ? 2 : 3) : (x.bili < 34 ? 1 : x.bili <= 50 ? 2 : 3);
    pts.alb = x.alb > 35 ? 1 : x.alb >= 28 ? 2 : 3;
    pts.inr = x.inr < 1.7 ? 1 : x.inr <= 2.3 ? 2 : 3;
    pts.ascites = [1, 2, 3].includes(x.ascites) ? x.ascites : null;
    pts.he = [1, 2, 3].includes(x.he) ? x.he : null;
    const known = pts.bili + pts.alb + pts.inr + (pts.ascites || 0) + (pts.he || 0);
    const missing = (pts.ascites ? 0 : 1) + (pts.he ? 0 : 1);
    const lo = known + missing, hi = known + 3 * missing;
    return { pts, lo, hi, complete: missing === 0, score: missing ? null : lo, cls: cpClass(lo), clsHi: cpClass(hi) };
  }
  const cpClass = (s) => (s <= 6 ? "A" : s <= 9 ? "B" : "C");

  /* Commonly quoted outcome bands. Approximate, from older cohorts: for orientation only. */
  function meldBand(m) {
    if (m == null) return "";
    if (m < 10) return "about 2% 3-month mortality (original MELD cohorts)";
    if (m < 20) return "about 6% 3-month mortality (original MELD cohorts)";
    if (m < 30) return "about 20% 3-month mortality (original MELD cohorts)";
    if (m < 40) return "about 50% 3-month mortality (original MELD cohorts)";
    return "about 70% or more 3-month mortality (original MELD cohorts)";
  }
  const CP_TEXT = { A: "Class A: well-compensated", B: "Class B: significant functional compromise", C: "Class C: decompensated" };

  const api = { meld, meld3, childPugh, cpClass, meldBand, CP_TEXT, toSI, BILI, CREAT,
    VERSION: { version: "0.1 draft", updated: "2026-10-31", note: "Formulas and cut-offs UNVERIFIED (written by Claude, not checked)" } };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.LiverScores = api;
})(typeof window !== "undefined" ? window : globalThis);
