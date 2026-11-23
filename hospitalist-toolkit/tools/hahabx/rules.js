/* Hospital at Home (HaH) IV antibiotics - pure rules (no DOM). UNVERIFIED draft written by Claude from Wayne's notes (Nov 2026):
   verify every dose, stability and device detail with Island Health HaH pharmacy before use.
   Rule from Wayne: HaH nurses can visit at most TID; an antibiotic given more often than BID must be compounded into an elastomeric
   ("ball") infusion. The bolus limit is a setting (default 2 a day) in case the team allows q8h bolus visits.
   node hospitalist-toolkit/tests/test_hahabx.js */
(function () {
  // mode: "bolus"  = nurse gives each dose (fine if doses/day <= limit)
  //       "elasto" = 24-h elastomeric is compatible (stable ~24 h at 25-32 C)
  //       "pharm"  = elastomeric possible but device/duration set by local pharmacy (shorter-stability drug)
  //       "no"     = not possible at home as an infusion device
  //       "po"     = oral, no nurse visit needed
  const DRUGS = [
    { key: "piptazo", name: "Piperacillin-tazobactam", re: /piperacillin|pip[\s\/-]*tazo|tazocin|zosyn/i, elasto: "12 g or 13.5 g (piperacillin-tazobactam) over 24 h",
      mode: "elasto", why: "Workhorse broad-spectrum Gram-negative / Pseudomonas option in HaH/OPAT.", covers: ["gnr", "pseudo", "anaer", "strep", "mssa"] },
    { key: "clox", name: "Cloxacillin", re: /cloxacillin/i, elasto: "8–12 g over 24 h", mode: "elasto",
      why: "Standard Canadian anti-staphylococcal (MSSA) regimen when avoiding q4h–q6h dosing.", covers: ["mssa", "strep"] },
    { key: "cefaz", name: "Cefazolin", re: /cefazolin|ancef/i, elasto: "6 g over 24 h", mode: "elasto",
      bolus: [{ txt: "2 g IV q24h + probenecid 1 g PO (OPAT regimen, selected infections – confirm indication)", perDay: 1 }],
      why: "MSSA or susceptible Gram-negatives when continuous infusion is preferred over q8h bolus.", covers: ["mssa", "strep", "gnr-s"] },
    { key: "peng", name: "Penicillin G", re: /penicillin\s*g|benzylpenicillin|pen\s*g\b/i, elasto: "12–24 million units over 24 h", mode: "elasto",
      why: "Streptococcal endocarditis, neurosyphilis, severe streptococcal infections.", covers: ["strep"] },
    { key: "ceftaz", name: "Ceftazidime", re: /ceftazidime(?![\s\/-]*avi)|fortaz/i, elasto: "6 g over 24 h", mode: "elasto",
      why: "Selected Pseudomonas infections. 24-h stability at body temperature is tighter than piperacillin-tazobactam – often kept cool/insulated.", covers: ["pseudo", "gnr"] },
    { key: "vanco", name: "Vancomycin", re: /vancomycin|vancocin/i, elasto: "continuous infusion with levels (random steady-state target ~20–25 mg/L)", mode: "elasto",
      bolus: [{ txt: "IV q12h intermittent (more common) – dose by levels/pharmacy", perDay: 2 }, { txt: "IV q24h if renal function allows – dose by levels/pharmacy", perDay: 1 }],
      why: "Occasionally continuous in specialized HaH/OPAT with TDM; q12h intermittent is more common.", covers: ["mrsa", "mssa", "strep"] },
    { key: "mero", name: "Meropenem", re: /meropenem|merrem/i, mode: "pharm",
      elasto: "elastomeric per HaH pharmacy – meropenem is unstable after ~4–6 h at room temperature, so device, bag duration and number of changes a day are set by pharmacy",
      why: "Can be made into balls locally; confirm the regimen and how many device changes a day the nurses can do.", covers: ["gnr", "esbl", "pseudo", "anaer"] },
    { key: "imi", name: "Imipenem", re: /imipenem|primaxin/i, mode: "no",
      why: "Unstable at room/body temperature after ~4–6 h – cannot go in a 24-h elastomeric.", covers: ["gnr", "esbl", "pseudo", "anaer"] },
    // once/twice-daily agents that suit nurse bolus visits
    { key: "ctx", name: "Ceftriaxone", re: /ceftriaxone|rocephin/i, mode: "bolus", bolus: [{ txt: "1–2 g IV q24h", perDay: 1 }], covers: ["gnr-s", "strep"] },
    { key: "erta", name: "Ertapenem", re: /ertapenem|invanz/i, mode: "bolus", bolus: [{ txt: "1 g IV q24h (standard OPAT daily bolus)", perDay: 1 }],
      why: "Island Health workaround for ESBL Enterobacterales WITHOUT Pseudomonas in place of meropenem.", covers: ["gnr", "esbl", "anaer"] },
    { key: "dapto", name: "Daptomycin", re: /daptomycin|cubicin/i, mode: "bolus", bolus: [{ txt: "IV q24h, mg/kg per indication – pharmacy to dose (not for pneumonia)", perDay: 1 }], covers: ["mrsa", "mssa", "vre"] },
    { key: "gent", name: "Gentamicin", re: /gentamicin/i, mode: "bolus", bolus: [{ txt: "IV q24h extended-interval – dose by weight/levels (monotherapy mainly for a urinary source)", perDay: 1 }], covers: ["gnr", "pseudo"] },
    { key: "tobra", name: "Tobramycin", re: /tobramycin/i, mode: "bolus", bolus: [{ txt: "IV q24h extended-interval – dose by weight/levels (monotherapy mainly for a urinary source)", perDay: 1 }], covers: ["gnr", "pseudo"] },
    { key: "cefep", name: "Cefepime", re: /cefepime|maxipime/i, mode: "pharm", elasto: "ask HaH pharmacy – limited stability at body temperature; not on the 24-h elastomeric list",
      bolus: [{ txt: "2 g IV q12h where the indication allows (not for most Pseudomonas)", perDay: 2 }], covers: ["gnr", "pseudo"] },
    { key: "amp", name: "Ampicillin", re: /\bampicillin\b/i, mode: "no", why: "Short stability – not on the 24-h elastomeric list. Consider penicillin G elastomeric, ceftriaxone, or oral amoxicillin.", covers: ["strep", "entero"] },
    { key: "metro", name: "Metronidazole", re: /metronidazole|flagyl/i, mode: "po", why: "Oral is essentially fully absorbed – give PO.", covers: ["anaer"] }
  ];
  const PO_RE = /\b(po|oral|by mouth|tab|tablet|capsule|suspension|enteral|ng)\b/i;
  const ABX_RE = new RegExp(DRUGS.map((d) => d.re.source).join("|") + "|cillin|cef|penem|mycin|floxacin|cycline|sulfa|trimethoprim|linezolid|clindamycin|metronidazole|azithro|nitrofurantoin|fosfomycin", "i");

  /* Doses a day from free text or FHIR timing. Returns {perDay, cont} or null. */
  function perDay(text, timing) {
    const r = timing && timing.repeat;
    if (r && r.frequency && r.period && r.periodUnit) {
      const h = { min: 1 / 60, h: 1, d: 24, wk: 168 }[r.periodUnit];
      if (h) return { perDay: Math.round((r.frequency * 24) / (r.period * h) * 10) / 10 };
    }
    const t = String(text || "") + " " + String((timing && timing.code && (timing.code.text || (timing.code.coding || []).map((c) => c.display || c.code).join(" "))) || "");
    if (/continuous|over 24\s*h|24[- ]?h(ou)?r? infusion|elastomeric|cadd/i.test(t)) return { perDay: 1, cont: true };
    let m = t.match(/\bq\s*(\d{1,2})\s*h(rs?|ours?)?\b|\bevery\s*(\d{1,2})\s*h(ours?)?\b/i);
    if (m) return { perDay: Math.round(24 / +(m[1] || m[3])) };
    if (/\bbid\b|twice (a )?daily|\bq12/i.test(t)) return { perDay: 2 };
    if (/\btid\b|three times/i.test(t)) return { perDay: 3 };
    if (/\bqid\b|four times/i.test(t)) return { perDay: 4 };
    if (/\bq\s*d\b|\bdaily\b|\bonce (a )?daily\b|\bq24|\bod\b|\bonce a day\b/i.test(t)) return { perDay: 1 };
    return null;
  }

  const drugOf = (text) => DRUGS.find((d) => d.re.test(text || ""));

  /* Verdict for one current antibiotic order. o = { name, text, timing, route }, limit = max nurse bolus visits a day (default 2). */
  function judge(o, limit) {
    limit = limit || 2;
    const all = [o.name, o.text, o.route].join(" "), d = drugOf(o.name) || drugOf(all), f = perDay(o.text, o.timing);
    const out = { drug: d ? d.name : o.name, freq: f, d, daily: dailyOf(d) };
    if (PO_RE.test(o.route || "") || (!/\biv\b|intravenous/i.test(all) && PO_RE.test(all))) return Object.assign(out, { level: "ok", head: "Oral – no nurse visit needed" });
    if (f && f.cont && d && (d.mode === "elasto" || d.mode === "pharm")) return Object.assign(out, { level: "ok", head: "Already a continuous infusion", detail: d.elasto });
    if (d && d.mode === "no") return Object.assign(out, { level: "bad", head: "Not possible at home as ordered", detail: d.why, alts: alternatives(d) });
    if (!f) return Object.assign(out, { level: "unk", head: "Frequency not read – check the order", detail: d && d.elasto ? "If more than " + times(limit) + ": " + d.elasto : "" });
    if (f.perDay <= limit) return Object.assign(out, { level: "ok", head: `Nurse bolus OK (${times(f.perDay)})` });
    if (d && d.mode === "elasto") return Object.assign(out, { level: "elasto", head: `${times(f.perDay)} → 24-h elastomeric`, detail: d.elasto + (d.why ? ". " + d.why : "") });
    if (d && d.mode === "pharm") return Object.assign(out, { level: "pharm", head: `${times(f.perDay)} → elastomeric per HaH pharmacy`, detail: d.elasto, alts: alternatives(d) });
    const lower = d && (d.bolus || []).filter((b) => b.perDay <= limit);
    return Object.assign(out, { level: "bad", head: `${times(f.perDay)} – more than nurses can give, and not on the elastomeric list`,
      detail: lower && lower.length ? "Lower-frequency regimen: " + lower.map((b) => b.txt).join("; ") : "Change agent – see options.", alts: d ? alternatives(d) : [] });
  }
  /* Once-daily regimens a drug has (nurse gives one dose a day). */
  const dailyOf = (d) => ((d && d.bolus) || []).filter((b) => b.perDay === 1).map((b) => b.txt);
  const times = (n) => (n === 1 ? "once a day" : n === 2 ? "BID" : n === 3 ? "TID" : n === 4 ? "QID" : n + "×/day");

  /* HaH-feasible agents that share coverage with drug d (same targets), best (fewest visits) first. */
  function alternatives(d) {
    return options(d.covers.filter((c) => c !== "anaer")[0] || d.covers[0]).filter((x) => x.d.key !== d.key).slice(0, 4);
  }

  const SCEN = [
    ["esbl", "ESBL Enterobacterales, no Pseudomonas"], ["pseudo", "Pseudomonas"], ["gnr", "Gram-negative, broad (unknown/resistant)"], ["gnr-s", "Susceptible Gram-negative (e.g. pan-S E. coli)"],
    ["mssa", "MSSA"], ["mrsa", "MRSA"], ["strep", "Streptococci"], ["entero", "Enterococcus (amp-S)"], ["anaer", "Anaerobes / intra-abdominal add-on"]];

  /* Options for a scenario, ranked by nurse burden: q24h bolus < BID bolus < elastomeric < pharmacy-dependent. */
  function options(scen, limit) {
    limit = limit || 2;
    const rows = [];
    DRUGS.forEach((d) => {
      if (!d.covers.includes(scen) && !(scen === "gnr-s" && d.covers.includes("gnr"))) return;
      (d.bolus || []).filter((b) => b.perDay <= limit).forEach((b) => rows.push({ d, how: "Nurse bolus", txt: b.txt, rank: b.perDay, once: b.perDay === 1 }));
      if (d.mode === "elasto") rows.push({ d, how: "24-h elastomeric", txt: d.elasto, rank: 3 });
      if (d.mode === "pharm" && d.key === "mero") rows.push({ d, how: "Elastomeric per pharmacy", txt: d.elasto, rank: 4 });
      if (d.mode === "po") rows.push({ d, how: "Oral", txt: d.why, rank: 0 });
    });
    if (scen === "entero") rows.push({ d: { key: "amox", name: "Amoxicillin PO" }, how: "Oral", txt: "if the infection allows oral step-down", rank: 0 },
      { d: DRUGS.find((x) => x.key === "peng"), how: "24-h elastomeric", txt: "Penicillin G 12–24 million units over 24 h (if susceptible)", rank: 3 });
    if (scen === "esbl") rows.forEach((r) => { if (r.d.key === "erta") r.rank = -1; });
    if (scen === "pseudo") rows.forEach((r) => { if (r.d.key === "piptazo") r.rank = 2.5; });
    const seen = new Set();
    return rows.sort((a, b) => a.rank - b.rank).filter((r) => { const k = r.d.key + r.how; if (seen.has(k)) return false; seen.add(k); return true; });
  }

  const api = { dailyOf, DRUGS, SCEN, perDay, judge, options, alternatives, drugOf, ABX_RE, times };
  if (typeof module !== "undefined") module.exports = api; else window.HahAbx = api;
})();
