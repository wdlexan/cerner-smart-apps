/* Hypernatremia rules for the Sodium tab. Pure functions (tested in tests/test_hyperna.js). SI units.
   Written by Claude from general knowledge and the sources named in the card (UNVERIFIED): check against Island Health protocols before use. */
(function (root) {
  const ok = (v) => typeof v === "number" && isFinite(v);
  const r1 = (v) => Math.round(v * 10) / 10;

  /* grading used here: mild 146–149, moderate 150–159, severe ≥ 160 (symptoms raise it) */
  function grade(na, symptoms) {
    if (!ok(na) || na <= 145) return { sev: 0, label: "not high" };
    let s = na >= 160 ? 3 : na >= 150 ? 2 : 1;
    if (symptoms === "severe") s = 3; else if (symptoms === "moderate" && s < 2) s = 2;
    return { sev: s, label: ["", "mild", "moderate", "severe"][s] };
  }
  /* total body water: 0.6 man, 0.5 woman; 0.5 and 0.45 if 65+ (elderly) */
  function tbw(wt, age, sex) {
    if (!ok(wt)) return null;
    const old = ok(age) && age >= 65, f = sex === "female" ? (old ? 0.45 : 0.5) : (old ? 0.5 : 0.6);
    return r1(wt * f);
  }
  /* free water deficit (L) to bring Na to target */
  function deficit(na, water, target) { if (!ok(na) || !ok(water)) return null; const t = target || 140; return na <= t ? 0 : r1(water * (na / t - 1)); }
  /* Adrogue-Madias: change in serum Na from 1 L of infusate */
  function perLitre(na, water, infNa, infK) { if (!ok(na) || !ok(water)) return null; return r1(((infNa || 0) + (infK || 0) - na) / (water + 1)); }

  /* correction plan: chronic ≤ 10 mmol/L in 24 h (about 0.5/h); acute (< 48 h) about 1 mmol/L/h toward 145 */
  function plan(na, water, acute, ongoingMlH) {
    if (!ok(na) || na <= 145) return null;
    const drop24 = acute ? Math.min(na - 145, 24) : Math.min(10, na - 140), perL = water ? perLitre(na, water, 0, 0) : null;
    const litres = perL ? r1(drop24 / -perL) : null;
    const extra = ok(ongoingMlH) ? ongoingMlH : 40; // insensible ≈ 40 mL/h (about 1 L/day) unless entered
    const rate = litres != null ? Math.round((litres * 1000) / 24 + extra) : null;
    return { drop24, perL, litres, extra, rate, target24: na - drop24, perHour: r1(drop24 / 24) };
  }

  /* medications that raise sodium (name patterns UNVERIFIED) */
  const MEDS = [
    ["lithium", /lithium|carbolith|lithane/i, "Lithium (nephrogenic DI)"],
    ["loop", /furosemide|lasix|bumetanide|torsemide/i, "Loop diuretic (water loss greater than salt)"],
    ["osmotic", /mannitol|\burea\b|ure-?na/i, "Osmotic diuresis (mannitol, urea)"],
    ["lactulose", /lactulose|polyethylene glycol|peg ?3350/i, "Lactulose / osmotic laxative (watery stool loss)"],
    ["hypertonic", /3\s*%\s*(nacl|sodium chloride|saline)|hypertonic saline|23\.4/i, "Hypertonic saline"],
    ["bicarb", /sodium bicarbonate|nahco3|bicarbonate/i, "Sodium bicarbonate"],
    ["salt", /sodium chloride (1 ?g|tab)|salt tab/i, "Salt tablets"],
    ["tolvaptan", /tolvaptan|jinarc|samsca/i, "Tolvaptan (aquaresis)"],
    ["dimpair", /demeclocycline|foscarnet|amphotericin|cidofovir|ifosfamide|ofloxacin/i, "Drug causing nephrogenic DI"],
    ["enteral", /enteral|tube feed|jevity|isosource|peptamen|nepro|glucerna|osmolite|ensure|boost|resource/i, "Tube feeds without enough free water"],
    ["sglt2", /empagliflozin|dapagliflozin|canagliflozin|jardiance|forxiga|invokana/i, "SGLT2 inhibitor (glycosuria, osmotic diuresis)"],
    ["steroid", /dexamethasone|methylprednisolone|hydrocortisone|fludrocortisone/i, "Corticosteroid (mild; with glucose diuresis)"],
    ["freeWater", /free water|water flush|d5w|dextrose 5\s*%\s*(in )?water/i, ""],
    ["ddavp", /desmopressin|ddavp/i, ""]];
  function meds(names) {
    const out = {}; MEDS.forEach(([k]) => (out[k] = []));
    (names || []).forEach((n) => MEDS.forEach(([k, re]) => { if (re.test(n) && out[k].indexOf(n) === -1) out[k].push(n); }));
    return out;
  }
  const MEDLABEL = {}; MEDS.forEach(([k, , l]) => (MEDLABEL[k] = l));

  /* likely mechanism from urine osmolality, urine Na, glucose, volume, urine output */
  function cause(x) {
    const out = { label: "incomplete", likely: [], tests: [], steps: [] }, uo = x.uosm, vol = x.volume, polyuria = ok(x.uoMlH) && x.uoMlH > 125; // > 3 L/day
    if (ok(x.glu) && x.glu > 20) out.likely.push("Glucose " + x.glu + ": osmotic diuresis from hyperglycemia (HHS / DKA). The corrected sodium is higher still.");
    if (!ok(uo)) { out.tests.push("urine osmolality", "urine sodium", "urine output over 24 h"); out.steps.push("Send urine osmolality and sodium, and measure urine output: they separate DI, osmotic diuresis and non-kidney water loss."); }
    else if (uo < 300) { out.label = "di"; out.likely.push("Urine osmolality " + uo + " (< 300) with high sodium: diabetes insipidus (urine too dilute)."); out.steps.push("Give desmopressin 1–2 mcg IV/SC and recheck urine osmolality in 1–2 h: rises > 50% = central DI; little change = nephrogenic DI (lithium, high Ca, low K, drugs)."); }
    else if (uo <= 600) { out.label = "partial"; out.likely.push("Urine osmolality " + uo + " (300–600): partial DI or osmotic diuresis (glucose, urea, mannitol, high-protein feeds, recovering AKI)."); out.steps.push("Check total urine osmoles: urine osmolality × 24 h urine volume > 1000 mOsm/day suggests osmotic diuresis."); }
    else { out.label = "extrarenal"; out.likely.push("Urine osmolality " + uo + " (> 600): the kidney is holding water correctly; water was lost elsewhere or not taken in (no access to water, fever, sweating, burns, diarrhea, vomiting, NG losses) — or sodium was gained."); }
    if (ok(x.una) && x.una > 100 && vol !== "hypo") out.likely.push("Urine sodium " + x.una + " (> 100) without dehydration: sodium gain (hypertonic saline, bicarbonate, salt tablets, salt-rich feeds) — or recovering ATN.");
    if (polyuria) out.likely.push("Urine output about " + Math.round(x.uoMlH * 24 / 1000 * 10) / 10 + " L/day (polyuria): DI or osmotic diuresis; ongoing losses must be added to the replacement.");
    if (vol === "hypo") out.likely.push("Dry: water and salt loss (GI, sweating, osmotic or loop diuresis). Restore circulation with isotonic fluid first.");
    if (vol === "hyper") out.likely.push("Overloaded: sodium gain (IV saline, bicarbonate, hypertonic saline, salt). Give free water with a loop diuretic.");
    if (ok(x.k) && x.k < 3.0) out.likely.push("K " + x.k + ": low K impairs urine concentration (nephrogenic DI).");
    if (ok(x.ca) && x.ca > 2.75) out.likely.push("Calcium " + x.ca + ": high calcium causes nephrogenic DI.");
    return out;
  }

  /* treatment lines { tier, text } */
  function treatment(x) {
    const t = [], add = (tier, text) => t.push({ tier, text });
    const g = grade(x.na, x.symptoms), water = x.water, pl = plan(x.na, water, x.acute, x.ongoingMlH), m = x.meds || meds([]);
    if (!g.sev) return t;
    if (x.volume === "hypo") add("now", "Shock or poor perfusion first: 0.9% saline or Ringer's lactate boluses (250–500 mL, reassess) until perfused; isotonic fluid also lowers the sodium a little. Then switch to free water.");
    if (pl) {
      add("now", "Free water: about " + (deficit(x.na, water) != null ? deficit(x.na, water) + " L deficit (TBW " + water + " L × (Na/140 − 1))" : "deficit needs weight") +
        ". Aim to lower Na by " + pl.drop24 + " mmol/L in the first 24 h (" + (x.acute ? "acute, < 48 h: about 1 mmol/L/h is safe" : "chronic or unknown: no more than 10 mmol/L/day, about 0.5/h") + ").");
      if (pl.rate != null) add("now", "D5W: each litre lowers Na by about " + -pl.perL + " mmol/L. " + pl.litres + " L over 24 h + " + pl.extra + " mL/h for ongoing insensible loss = about " + pl.rate + " mL/h" +
        (ok(x.uoMlH) && x.uoMlH > 125 ? ", PLUS replace the dilute urine (polyuria about " + Math.round(x.uoMlH) + " mL/h) or the sodium will keep rising" : "") + ". Adjust to each sodium result, not to the formula.");
    }
    add("next", "Enteral route when the gut works: free water 200–250 mL every 4 h by mouth or NG (plus tube-feed flushes), with or instead of IV.");
    if (ok(x.glu) && x.glu > 10) add("now", "Glucose " + x.glu + ": D5W adds glucose. Use enteral water, or 0.45% saline / D5W at a lower rate with insulin; in HHS follow the HHS protocol (sodium often rises at first as glucose falls).");
    if (x.cause && x.cause.label === "di") add("now", "Diabetes insipidus: if central (or unknown and severe), desmopressin 1–2 mcg IV/SC (or 0.1–0.2 mg PO) and recheck Na in 4–6 h; watch for a rapid fall once the urine concentrates. Nephrogenic: stop the cause; thiazide + amiloride (especially lithium), low-salt low-protein diet; desmopressin does not work.");
    if (x.volume === "hyper") add("now", "Sodium gain with overload: free water plus furosemide 20–40 mg IV (loop diuretic removes salt and water; replace the water lost). Dialysis if kidney failure and Na very high.");
    const stop = [].concat(m.hypertonic, m.bicarb, m.salt, m.lactulose, m.osmotic, m.tolvaptan, m.loop.filter(() => x.volume !== "hyper"), m.dimpair);
    if (stop.length) add("now", "Stop or review: " + stop.join("; ") + ".");
    if (m.lithium.length) add("now", "Lithium: check a level; nephrogenic DI can persist after stopping. Discuss with psychiatry; amiloride helps if lithium must continue.");
    if (m.enteral.length) add("next", "Tube feeds: add free water flushes (e.g. 200 mL every 4 h) and review feed concentration with the dietitian.");
    if (g.sev === 3 || x.symptoms === "severe") add("now", "Severe: monitored bed; look for seizures, reduced level of consciousness, and rhabdomyolysis (CK). Acute severe rises (e.g. salt poisoning, hypertonic saline) can cause brain shrinkage and bleeding: CT head if focal signs or coma.");
    add("next", "Do not overshoot: if Na falls faster than planned, slow or stop the free water (cerebral edema risk in chronic hypernatremia, mainly reported in children). Recent adult cohorts did not find harm from faster correction, but the usual cap is still ≤ 10 mmol/L/day for chronic.");
    add("also", "Elderly and frail: hypernatremia usually means no access to water. Water within reach, prompted drinking, and look for the illness that stopped them drinking (infection, stroke, delirium).");
    return t;
  }
  /* when to repeat labs */
  function recheck(x) {
    const g = grade(x.na, x.symptoms), r = []; if (!g.sev) return r;
    if (g.sev === 3 || x.acute) r.push({ when: "Every 2–4 h at first", what: "Sodium and glucose (with D5W), until the rate of fall is predictable" });
    else if (g.sev === 2) r.push({ when: "Every 4–6 h for the first 24 h", what: "Sodium; glucose if on D5W" });
    else r.push({ when: "Every 12–24 h", what: "Sodium while replacing water" });
    r.push({ when: "Every shift", what: "Urine output and fluid balance (ongoing dilute urine changes the plan); daily weight" });
    if (x.cause && x.cause.label === "di") r.push({ when: "1–2 h after desmopressin", what: "Urine osmolality and urine output (central vs nephrogenic), then sodium in 4–6 h" });
    return r;
  }

  /* step-by-step working with the patient's numbers (shown in the card) */
  function tbwFactor(age, sex) { const old = ok(age) && age >= 65; return sex === "female" ? (old ? 0.45 : 0.5) : (old ? 0.5 : 0.6); }
  function explain(x) {
    const s = [], na = x.na, w = x.wt;
    if (!ok(na) || na <= 145) return s;
    const fac = tbwFactor(x.age, x.sex), who = (x.sex === "female" ? "woman" : x.sex === "male" ? "man" : "sex unknown (man's factor used)") + (ok(x.age) ? ", " + x.age + " y" + (x.age >= 65 ? " (65 or older)" : " (under 65)") : ", age unknown (under-65 factor used)");
    s.push({ step: "1. Total body water", formula: "TBW = weight × factor (man 0.6, woman 0.5; 65 or older: man 0.5, woman 0.45)",
      calc: ok(w) ? w + " kg × " + fac + " [" + who + "] = " + r1(w * fac) + " L" : "Enter weight to calculate (" + who + ": factor " + fac + ")" });
    if (!ok(w)) return s;
    const water = r1(w * fac), ratio = Math.round((na / 140 - 1) * 1000) / 1000;
    s.push({ step: "2. Free water deficit", formula: "Deficit = TBW × (Na ÷ 140 − 1)", calc: water + " × (" + na + " ÷ 140 − 1) = " + water + " × " + ratio + " = " + deficit(na, water) + " L" });
    const pl = plan(na, water, x.acute, null), perL = -pl.perL;
    s.push({ step: "3. Effect of 1 L D5W", formula: "Change per litre = (infusate Na − serum Na) ÷ (TBW + 1); D5W has no Na", calc: "(0 − " + na + ") ÷ (" + water + " + 1) = −" + perL + " mmol/L per litre" });
    s.push({ step: "4. Target for 24 h", formula: x.acute ? "Acute (< 48 h): lower toward 145, about 1 mmol/L/h" : "Chronic / unknown: fall of no more than 10 mmol/L in 24 h", calc: "Lower by " + pl.drop24 + " → about " + pl.target24 });
    s.push({ step: "5. Litres in 24 h", formula: "Litres = target fall ÷ change per litre", calc: pl.drop24 + " ÷ " + perL + " = " + pl.litres + " L" });
    s.push({ step: "6. Starting rate", formula: "Rate = litres × 1000 ÷ 24 + insensible loss (≈ 40 mL/h)" + (ok(x.uoMlH) && x.uoMlH > 125 ? " + dilute urine" : ""),
      calc: pl.litres + " × 1000 ÷ 24 + 40 = " + Math.round(pl.litres * 1000 / 24) + " + 40 = " + pl.rate + " mL/h" + (ok(x.uoMlH) && x.uoMlH > 125 ? " (+ urine losses ≈ " + Math.round(x.uoMlH) + " mL/h)" : "") });
    return s;
  }

  const api = { grade, tbw, tbwFactor, explain, deficit, perLitre, plan, meds, MEDS, MEDLABEL, cause, treatment, recheck };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.HyperRules = api;
})(this);
