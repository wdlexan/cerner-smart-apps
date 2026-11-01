/* Hyponatremia rules. Pure functions, no chart access (tested in tests/test_hypona.js).
   Units: sodium, potassium, glucose, urea mmol/L; osmolality mOsm/kg; uric acid mmol/L; weight kg; times in ms.
   Sources summarised (read 2026-11-01): US expert panel (Verbalis 2013), European guideline (Spasovski 2014), SALSA trial (2021),
   Southern Health (Manitoba) adult hyponatremia guideline. UNVERIFIED draft written by Claude: check doses and limits against your local protocol. */
(function (root) {
  const H = 36e5, DAY = 864e5;
  const ok = (v) => typeof v === "number" && isFinite(v);
  const r1 = (v) => Math.round(v * 10) / 10;

  /* correction limits: standard (European / Canadian: 10 in any 24 h, 18 in any 48 h), high ODS risk (US panel: 8 in any 24 h) */
  function limits(highRisk) { return highRisk ? { l24: 8, l48: 16, tLo: 4, tHi: 6, high: true } : { l24: 10, l48: 18, tLo: 4, tHi: 8, high: false }; }

  function severity(na) {
    if (!ok(na)) return null;
    return na >= 135 ? "none" : na >= 130 ? "mild" : na >= 125 ? "moderate" : "profound";
  }
  /* glucose correction (Hillier): +2.4 mmol/L sodium per 5.55 mmol/L (100 mg/dL) glucose above 5.55 */
  const glucoseCorrected = (na, glu) => (ok(na) && ok(glu) && glu > 5.55 ? na + (2.4 / 5.55) * (glu - 5.55) : na);
  const calcOsm = (na, glu, urea) => (ok(na) ? 2 * na + (ok(glu) ? glu : 5) + (ok(urea) ? urea : 5) : null);
  const tonicity = (na, glu) => (ok(na) ? 2 * na + (ok(glu) ? glu : 5) : null);

  /* total body water: 0.6 / 0.5 (male under / 65 and over), 0.5 / 0.45 (female) */
  function tbw(wt, age, sex) {
    if (!ok(wt)) return null;
    const old = ok(age) && age >= 65, f = sex === "female";
    return wt * (f ? (old ? 0.45 : 0.5) : old ? 0.5 : 0.6);
  }
  /* Adrogue-Madias: change in serum Na after 1 L of infusate. An estimate: ignores urine losses (often the main error). */
  const adrogue = (sNa, infNa, infK, water) => (ok(sNa) && ok(water) ? (infNa + (infK || 0) - sNa) / (water + 1) : null);
  const FLUIDS = [
    { id: "3", label: "3% saline", na: 513, k: 0 }, { id: "ns", label: "0.9% saline", na: 154, k: 0 }, { id: "lr", label: "Ringer's lactate", na: 130, k: 4 },
    { id: "pl", label: "Plasma-Lyte A", na: 140, k: 5 }, { id: "half", label: "0.45% saline", na: 77, k: 0 }, { id: "d5w", label: "D5W", na: 0, k: 0 }];

  /* Furst ratio: (urine Na + urine K) / serum Na. Predicts whether fluid restriction can work in SIAD. */
  function furst(una, uk, sna) {
    if (![una, uk, sna].every(ok)) return null;
    const ratio = (una + uk) / sna;
    return { ratio, advice: ratio >= 1 ? "Fluid restriction alone will not work (urine has more salt than plasma): add urea or another treatment." : ratio >= 0.5 ? "Restrict fluids to about 500 mL/day." : "Restrict fluids to about 1 L/day." };
  }

  /* ---- sodium series ----
     series: [{t, v}] any order. All windows are measured back from each value. */
  function sorted(series) { return (series || []).filter((e) => ok(e.v) && ok(e.t)).sort((a, b) => a.t - b.t); }

  /* rise over the past 24 h / 48 h ending at the latest value, and the biggest 24 h rise in the past 48 h */
  function rises(series) {
    const s = sorted(series); if (!s.length) return null;
    const last = s[s.length - 1];
    const low = (end, span) => s.filter((e) => e.t >= end.t - span && e.t <= end.t).reduce((m, e) => (e.v < m.v ? e : m), end);
    const l24 = low(last, DAY), l48 = low(last, 2 * DAY);
    let max24 = 0, at = null;
    s.filter((e) => e.t >= last.t - 2 * DAY).forEach((e) => { const lo = low(e, DAY), d = e.v - lo.v; if (d > max24) { max24 = d; at = { from: lo, to: e }; } });
    return { last, rise24: last.v - l24.v, low24: l24, rise48: last.v - l48.v, low48: l48, max24, max24at: at };
  }

  /* Highest sodium allowed right now: for every value in the past 24 h, value + 24 h limit; for every value in the past 48 h, value + 48 h limit.
     Returns the lowest of these, the value that sets it, and when that value drops out of its window. */
  function ceiling(series, lim, now) {
    const s = sorted(series).filter((e) => e.t <= now); if (!s.length) return null;
    let best = null;
    s.forEach((e) => {
      if (now - e.t <= DAY) { const c = e.v + lim.l24; if (!best || c < best.v) best = { v: c, from: e, win: 24, until: e.t + DAY }; }
      if (now - e.t <= 2 * DAY) { const c = e.v + lim.l48; if (!best || c < best.v) best = { v: c, from: e, win: 48, until: e.t + 2 * DAY }; }
    });
    return best;
  }

  /* rate from the latest value and the most recent value at least 2 h earlier (within 12 h) */
  function rate(series) {
    const s = sorted(series); if (s.length < 2) return null;
    const last = s[s.length - 1], prev = [...s].reverse().find((e) => last.t - e.t >= 2 * H && last.t - e.t <= 12 * H);
    if (!prev) return null;
    return { perH: (last.v - prev.v) / ((last.t - prev.t) / H), from: prev, to: last };
  }

  /* state of the correction: over the limit, close to it, too slow, or fine */
  function status(series, lim, now) {
    const rs = rises(series); if (!rs) return null;
    const c = ceiling(series, lim, now), rt = rate(series);
    const over = rs.rise24 > lim.l24 || rs.rise48 > lim.l48;
    const room = c ? c.v - rs.last.v : null;
    const hoursToCeiling = rt && rt.perH > 0 && room != null ? room / rt.perH : null;
    const near = !over && room != null && (room <= 2 || (hoursToCeiling != null && hoursToCeiling <= 6));
    const slow = !over && rs.last.v < 125 && now - rs.low24.t >= 20 * H && rs.rise24 < lim.tLo;
    return { rs, c, rt, over, near, room, hoursToCeiling, slow };
  }

  /* acute if a value of 135 or more was seen within 48 h before the latest low value */
  function onset(series) {
    const s = sorted(series); if (!s.length) return "unknown";
    const lowIdx = s.reduce((mi, e, i) => (e.v < s[mi].v ? i : mi), 0), low = s[lowIdx];
    if (low.v >= 135) return "none";
    const before = s.slice(0, lowIdx).filter((e) => low.t - e.t <= 2 * DAY && e.v >= 135);
    return before.length ? "acute" : "chronic";
  }

  /* ---- cause (European 2014 algorithm) ----
     x: { na, glu, sosm, uosm, una, volume: "hypo"|"eu"|"hyper"|"", diuretic, ckd, urea } */
  function cause(x) {
    const steps = [], out = { steps, label: "", likely: [], missing: [], warn: "" };
    const cna = glucoseCorrected(x.na, x.glu);
    if (ok(x.glu) && x.glu > 5.55 && cna >= 135) {
      steps.push(`Glucose ${r1(x.glu)}: corrected sodium ${r1(cna)} (135 or more).`);
      out.label = "hyperglycemia"; out.likely = ["Hyperglycemia: water moves out of cells. Treat the glucose; the sodium rises as glucose falls. Not true hypotonic hyponatremia."]; return out;
    }
    if (ok(x.sosm)) {
      if (x.sosm >= 275) {
        steps.push(`Measured osmolality ${Math.round(x.sosm)} (275 or more): not hypotonic.`);
        out.label = "nonhypotonic";
        out.likely = ["Extra osmoles: glucose, mannitol, glycine, contrast (check the osmolal gap)", "Pseudohyponatremia from very high triglycerides or protein: check a blood gas (direct electrode) sodium",
          "High urea or alcohol raise measured osmolality without changing tonicity: true hypotonic hyponatremia is still possible if urea or alcohol is high"];
        return out;
      }
      steps.push(`Measured osmolality ${Math.round(x.sosm)} (below 275): hypotonic hyponatremia.`);
    } else { steps.push("No serum osmolality found: assumed hypotonic. Order serum osmolality (with glucose) before treatment if possible."); out.missing.push("sosm"); }

    if (!ok(x.uosm)) { steps.push("No urine osmolality: cannot tell water excess from ADH-driven causes yet."); out.missing.push("uosm"); }
    else if (x.uosm <= 100) {
      steps.push(`Urine osmolality ${Math.round(x.uosm)} (100 or less): ADH is switched off.`);
      out.label = "lowuosm"; out.likely = ["Primary polydipsia", "Low solute intake (beer potomania, tea and toast diet)"];
      out.warn = "ADH is already off: once intake changes the sodium can rise very fast. High overcorrection risk."; return out;
    } else steps.push(`Urine osmolality ${Math.round(x.uosm)} (above 100): ADH is active.`);

    if (!ok(x.una)) { steps.push("No urine sodium: send a spot urine sodium (and potassium, creatinine)."); out.missing.push("una"); out.label = out.label || "incomplete"; return out; }
    if (x.una <= 30) {
      steps.push(`Urine sodium ${Math.round(x.una)} (30 or less): low effective arterial blood volume.`);
      const hyper = ["Heart failure", "Cirrhosis", "Nephrotic syndrome"], hypo = ["Diarrhea or vomiting (urine Na can be high with vomiting)", "Third spacing (pancreatitis, burns, bowel obstruction)", "Diuretics stopped some time ago"];
      if (x.volume === "hyper") { out.label = "hypervolemic"; out.likely = hyper; }
      else if (x.volume === "hypo") { out.label = "hypovolemic"; out.likely = hypo; }
      else { out.label = "lowvol"; out.likely = hyper.concat(hypo); steps.push("Volume status not chosen: pick it above to narrow this."); }
      if (out.missing.includes("uosm")) out.label = "incomplete";
      return out;
    }
    steps.push(`Urine sodium ${Math.round(x.una)} (above 30).`);
    if (x.diuretic || x.ckd) { steps.push((x.diuretic ? "On a diuretic" : "Chronic kidney disease") + ": urine sodium cannot be interpreted."); out.likely.push(x.diuretic ? "Diuretics (especially thiazides)" : "Kidney disease"); }
    if (x.volume === "hypo") { out.label = "renalloss"; out.likely.push("Vomiting", "Primary adrenal insufficiency", "Renal or cerebral salt wasting", "Hidden diuretic use"); }
    else if (x.volume === "eu") { out.label = x.diuretic ? "diuretic" : "siad"; out.likely.push("SIAD (syndrome of inappropriate antidiuresis)", "Secondary adrenal insufficiency", "Hypothyroidism", "Hidden diuretic use"); }
    else if (x.volume === "hyper") { out.label = "diuretic"; out.likely.push("Diuretics or kidney disease in an edematous patient"); }
    else { out.label = x.diuretic ? "diuretic" : "highuna"; out.likely.push("SIAD", "Adrenal insufficiency", "Hypothyroidism", "Vomiting", "Salt wasting"); steps.push("Volume status not chosen: pick it above to narrow this."); }
    if (x.diuretic && !["diuretic", "renalloss"].includes(out.label)) out.label = "diuretic";
    if (out.missing.includes("uosm")) out.label = "incomplete";
    return out;
  }

  /* SIAD criteria (European 2014). Each { label, state: true|false|null, value } */
  function siad(x) {
    const eff = tonicity(x.na, x.glu);
    const c = [
      { label: "Effective osmolality below 275", state: ok(x.sosm) ? x.sosm < 275 : ok(eff) ? eff < 275 : null, value: ok(x.sosm) ? "measured " + Math.round(x.sosm) : ok(eff) ? "calculated " + Math.round(eff) : "" },
      { label: "Urine osmolality above 100", state: ok(x.uosm) ? x.uosm > 100 : null, value: ok(x.uosm) ? Math.round(x.uosm) + "" : "" },
      { label: "Clinically euvolemic", state: x.volume === "eu" ? true : x.volume ? false : null, value: x.volume || "not chosen" },
      { label: "Urine sodium above 30 on a normal salt intake", state: ok(x.una) ? x.una > 30 : null, value: ok(x.una) ? Math.round(x.una) + "" : "" },
      { label: "No recent diuretics", state: x.diuretic == null ? null : !x.diuretic, value: x.diuretic ? "diuretic on record" : "" },
      { label: "Normal thyroid function (TSH)", state: ok(x.tsh) ? x.tsh <= 10 : null, value: ok(x.tsh) ? "TSH " + x.tsh : "" },
      { label: "Normal adrenal function (cortisol)", state: ok(x.cortisol) ? (x.cortisol >= 300 ? true : x.cortisol < 100 ? false : null) : null, value: ok(x.cortisol) ? "cortisol " + Math.round(x.cortisol) + " nmol/L" + (x.cortisol >= 100 && x.cortisol < 300 ? " (indeterminate: consider ACTH stimulation)" : "") : "" }];
    const support = [];
    if (ok(x.uric) && x.uric < 0.24) support.push("uric acid " + x.uric + " (below 0.24)");
    if (ok(x.urea) && x.urea < 3.6) support.push("urea " + x.urea + " (below 3.6)");
    const met = c.every((i) => i.state === true), failed = c.some((i) => i.state === false);
    return { criteria: c, support, met, failed };
  }

  /* ---- doses ---- */
  function bolus(wt, sna, water) {
    const per = adrogue(sna, 513, 0, water);
    return { fixed: 150, perKg2: ok(wt) ? Math.round(wt * 2) : null, perKg4: ok(wt) ? Math.round(wt * 4) : null, rise150: per != null ? per * 0.15 : null };
  }
  /* overcorrection rescue: D5W 6 mL/kg over 1-2 h (Manitoba guideline, lean weight) or 10 mL/kg over 1 h (European / SALSA); desmopressin 2 mcg IV/SC q6-8h (max 4 mcg) */
  function rescue(wt) { return { d5w6: ok(wt) ? Math.round(wt * 6 / 10) * 10 : null, d5w10: ok(wt) ? Math.round(wt * 10 / 10) * 10 : null }; }

  /* ---- treatment plan ---- returns [{h, items, level}] */
  function plan(x) {
    const P = [], lim = x.lim, st = x.st, w = x.wt;
    const add = (h, items, level) => { const it = items.filter(Boolean); if (it.length) P.push({ h, items: it, level: level || "" }); };
    if (st && st.over) {
      const rs = rescue(w);
      add("Overcorrection: act now", [
        `Sodium rose ${r1(Math.max(st.rs.rise24, 0))} in 24 h${st.rs.rise48 > st.rs.rise24 ? " / " + r1(st.rs.rise48) + " in 48 h" : ""}: above the limit of ${lim.l24} per 24 h (${lim.l48} per 48 h).`,
        "Stop everything that raises sodium: hypertonic or 0.9% saline, salt tablets, urea, tolvaptan, potassium if not essential.",
        "Desmopressin 2 mcg IV or SC now, repeated every 6-8 h (up to 4 mcg) to stop the water diuresis.",
        rs.d5w6 ? `D5W ${rs.d5w6} mL IV over 1-2 h (6 mL/kg; lowers sodium about 2 mmol/L), repeated with a sodium check after each, until sodium is back below ${st.c ? st.c.v : "the limit"}. Some protocols use 10 mL/kg over 1 h (${rs.d5w10} mL).` : "D5W 6 mL/kg over 1-2 h (no weight found), repeated with a sodium check after each.",
        "Sodium every 1-2 h while relowering. Involve ICU / HAU or nephrology. Watch for new neurology over the next 2-6 days."], "urgent");
    } else if (st && st.near && x.symptoms !== "severe") {
      add("Close to the limit: slow down", [
        `Room left: ${r1(st.room)} mmol/L before the ceiling of ${st.c.v}` + (st.hoursToCeiling != null ? `; at the current rate (+${r1(st.rt.perH)} per h) it will be reached in about ${r1(st.hoursToCeiling)} h.` : "."),
        "Stop or reduce saline, salt tablets, urea or tolvaptan. If a water diuresis has started (urine above 100 mL/h), give desmopressin 2 mcg IV or SC.",
        "Recheck sodium in 2 h."], "action");
    }
    const sym = x.symptoms;
    const b = bolus(w, x.na, x.water), given = x.bolusesGiven || 0, up = st ? Math.max(0, st.rs.rise24) : 0;
    const dose = `3% saline 150 mL IV over 20 min, or 2 mL/kg${b.perKg2 ? " (" + b.perKg2 + " mL)" : ""}` + (b.rise150 != null ? `. Expected rise per 150 mL about ${r1(b.rise150)} mmol/L.` : ".");
    if (sym === "severe" && !(st && st.over)) {
      const room = st && st.c ? ` Room left before the ceiling of ${st.c.v}: ${r1(st.room)} mmol/L.` : "";
      add("Severe symptoms: hypertonic saline", [
        given ? `${given} bolus${given > 1 ? "es" : ""} of 3% saline found in the past 6 h; sodium up ${r1(up)} in 24 h.${room}` : "",
        up >= 5 ? `Target of +5 reached. If symptoms have improved: stop boluses and treat the cause. If not: continue 3% saline aiming for +1 mmol/L per h, stopping at +10 in total${st && st.c ? " (or " + st.c.v + ")" : ""} or sodium 130, and look for another cause of the symptoms.`
          : dose + (b.perKg4 && !given ? ` SALSA used 4 mL/kg (${b.perKg4} mL) over 40 min for severe symptoms.` : "") + ` Check sodium 20 min after each bolus. Up to ${Math.max(0, 3 - given)} more (3 in total) until symptoms improve or sodium is up 5 mmol/L.`,
        `Stay within ${lim.l24} mmol/L in the first 24 h.`, "Monitored bed (ICU / HAU). Treat seizures as usual. Watch urine output: a sudden water diuresis means a fast rise."], "urgent");
    }
    if (!(st && (st.over || st.near))) {
      if (sym === "moderate") add("Moderate symptoms", [dose + " Usually a single bolus.", `Aim for about 5 mmol/L in 24 h, within the limit of ${lim.l24}. Check sodium every 4 h.`, "Treat the cause (below)."], "action");
      else if (x.acute && x.na < 130) add("Acute hyponatremia (under 48 h), few symptoms", ["Stop the cause (hypotonic fluids, drugs, water intake). A single 150 mL 3% saline bolus is reasonable if sodium is falling further. Check sodium every 4 h."], "action");
    }
    // cause-specific (held back while overcorrected: the rescue comes first)
    const m = x.meds || {}, L = x.causeLabel, fu = x.furst;
    if (st && st.over) {
      add("After relowering", [`Likely cause: ${L || "not worked out"}. Restart cause-specific treatment only once sodium is back under the ceiling, and more slowly.`,
        m.culprits && m.culprits.length ? "Then review: " + m.culprits.join("; ") + "." : ""]);
      add("Targets and monitoring", [`Limit: ${lim.l24} in any 24 h and ${lim.l48} in any 48 h. Sodium every 1-2 h while relowering, then every 4 h.`]);
      return P;
    }
    if (m.hypotonic && m.hypotonic.length) add("Stop hypotonic fluids", ["Running or recent: " + m.hypotonic.join(", ") + ". Use isotonic fluid only if fluid is needed."], "action");
    if (m.culprits && m.culprits.length) add("Review drugs that can cause hyponatremia", m.culprits.map((d) => d + ": hold or switch if possible."), "action");
    if (L === "siad" || L === "highuna") {
      const restrictFails = (fu && fu.ratio >= 1) || (ok(x.uosm) && x.uosm > 500);
      add(L === "siad" ? "SIAD treatment" : "If SIAD (euvolemic, urine Na above 30)", [
        "Find the cause: drugs, pain, nausea, lung disease (pneumonia, cancer), brain disease, surgery. Check TSH and morning cortisol first.",
        fu ? `Furst ratio ${r1(fu.ratio)}: ${fu.advice}` : "Fluid restriction 500 mL-1 L/day (urine Na and K let the page choose: send them).",
        restrictFails ? "Restriction is unlikely to work alone" + (ok(x.uosm) && x.uosm > 500 ? ` (urine osmolality ${Math.round(x.uosm)})` : "") + ": add urea 15-30 g/day PO (first choice in European guidance), or salt tablets 1 g TID with furosemide 20 mg daily." : "",
        x.liver ? "Tolvaptan: avoid (liver disease)." : x.highRisk ? "Tolvaptan: avoid while at high risk of osmotic demyelination." : "Tolvaptan 7.5-15 mg PO daily is an option (specialist): no fluid restriction in the first 24 h, sodium every 6 h, high risk of fast correction; avoid in liver disease.",
        ok(x.uosm) && x.uosm > 530 ? `Avoid 0.9% saline: urine osmolality ${Math.round(x.uosm)} is higher than saline, so it can lower the sodium.` : "Avoid 0.9% saline unless volume depleted: in SIAD it often does not help."]);
    }
    if (L === "hypovolemic" || L === "renalloss" || (L === "lowvol" && x.volume !== "hyper")) add("Volume depletion", [
      "0.9% saline (or a balanced crystalloid) 500 mL-1 L, then reassess volume and sodium.",
      "Once volume is restored ADH switches off: urine output rises and sodium can climb fast. Check sodium every 4-6 h and urine output hourly; have desmopressin ready.",
      L === "renalloss" ? "If adrenal insufficiency is possible, draw cortisol (and ACTH) then give hydrocortisone if unwell. Steroids can make sodium rise quickly." : ""]);
    if (L === "hypervolemic" || (L === "lowvol" && x.volume === "hyper")) add("Hypervolemic (heart failure, cirrhosis, nephrotic)", [
      "Fluid restriction 1-1.5 L/day and treat the underlying disease.",
      x.liver ? "Cirrhosis: hold diuretics if sodium is 125 or less; avoid tolvaptan. Albumin may help in selected patients (hepatology)." : "Heart failure: loop diuretic; stop thiazides; optimise guideline therapy.",
      "3% saline only for severe symptoms."]);
    if (L === "diuretic") add("Diuretic-related", ["Stop thiazides (and review loop diuretic dose). Correct potassium and magnesium.", "Thiazide hyponatremia often has low potassium and ADH turns off after stopping: watch for fast correction."]);
    if (L === "lowuosm") add("Water excess or low solute intake", [
      "Restrict water. Restart a normal diet slowly (protein and salt are the solute that lets the kidney excrete water).",
      "Very high risk of rapid correction: sodium every 2-4 h and urine output hourly. Discuss a planned desmopressin strategy with nephrology or ICU.",
      x.alcohol ? "Thiamine before glucose; replace potassium, magnesium and phosphate." : ""], "action");
    if (L === "hyperglycemia" || L === "nonhypotonic") add("Not hypotonic hyponatremia", ["Do not treat the sodium itself. Treat hyperglycemia or the extra osmole; confirm with a blood gas sodium if lipids or protein are very high."]);
    if (L === "incomplete") add("Send before treating (if safe)", ["Serum osmolality, glucose, urea, creatinine; spot urine osmolality, sodium, potassium; TSH; morning cortisol. Draw them before saline or steroids."]);
    if (L === "hyperglycemia" || L === "nonhypotonic") return P;
    // targets and monitoring
    const freq = sym === "severe" || x.na < 120 || (st && (st.over || st.near)) || L === "lowuosm" || (m.hypertonic && m.hypertonic.length) ? "every 2-4 h" : x.na < 125 ? "every 4-6 h" : "every 6-12 h, then daily once stable";
    add("Targets and monitoring", [
      `Goal: ${lim.tLo}-${lim.tHi} mmol/L per 24 h. Limit: ${lim.l24} in any 24 h and ${lim.l48} in any 48 h${lim.high ? " (high risk of osmotic demyelination)" : ""}.`,
      st && st.c ? `Highest sodium allowed now: ${st.c.v} (from ${st.c.from.v} at ${new Date(st.c.from.t).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}, ${st.c.win} h limit).` : "",
      `Sodium ${freq}. Watch urine output: more than 100 mL/h means the sodium may be rising fast; check it now.`,
      x.hypoK ? "Low potassium: potassium replacement also raises sodium, so count it in the daily rise." : "",
      st && st.slow ? `Rise only ${r1(st.rs.rise24)} in 24 h: below the ${lim.tLo} mmol/L minimum. Recent studies link very slow correction with higher mortality: review the plan.` : ""]);
    return P;
  }

  const api = { limits, severity, glucoseCorrected, calcOsm, tonicity, tbw, adrogue, FLUIDS, furst, rises, ceiling, rate, status, onset, cause, siad, bolus, rescue, plan, H, DAY };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.HypoRules = api;
})(typeof window !== "undefined" ? window : globalThis);
