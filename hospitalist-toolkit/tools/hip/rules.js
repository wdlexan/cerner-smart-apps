/* Hip fracture co-management rules. Pure functions (tested in tests/test_hip.js).
   Units: Hgb g/L, platelets x10^9/L, creatinine umol/L, Na/K/glucose mmol/L, calcium mmol/L, 25-OH vitamin D nmol/L, weight kg; times in ms.
   Sources summarised (read 2026-11-02): NHS GGC hip fracture anticoagulation guideline (v5, 2024); ASRA neuraxial intervals; AAGBI 2011 hip fracture
   ("acceptable reasons to delay"); FOCUS trial (transfusion); CHEST 2012 (VTE duration); Osteoporosis Canada 2023; NHFS (Maxwell 2008, Moppett 2012 recalibration).
   UNVERIFIED draft written by Claude: check against Island Health / VGH hip fracture orders before real use. */
(function (root) {
  const H = 36e5, DAY = 864e5;
  const ok = (v) => typeof v === "number" && isFinite(v);

  /* Cockcroft-Gault, actual weight, creatinine umol/L */
  const crcl = (cr, age, wt, sex) => (ok(cr) && ok(age) && ok(wt) ? ((140 - age) * wt * (sex === "female" ? 1.04 : 1.23)) / cr : null);

  /* ---- timeline ---- */
  function timeline(arrival, surgery, now) {
    if (!ok(arrival)) return null;
    const done = ok(surgery) && surgery <= now;
    const hours = ((done ? surgery : now) - arrival) / H;
    return { hours, done, pod: done ? Math.floor((now - surgery) / DAY) : null, over48: hours > 48, over36: hours > 36, deadline: arrival + 48 * H };
  }

  /* ---- Nottingham Hip Fracture Score (2012 version). x: { age, sex, hgb (admission, g/L), amtsLow, institution, comorbid2, malignancy } */
  function nhfs(x) {
    if (!ok(x.age) || !ok(x.hgb)) return null;
    const pts = { age: x.age >= 86 ? 4 : x.age >= 66 ? 3 : 0, male: x.sex === "male" ? 1 : 0, hgb: x.hgb <= 100 ? 1 : 0, amts: x.amtsLow ? 1 : 0,
      institution: x.institution ? 1 : 0, comorbid: x.comorbid2 ? 1 : 0, malignancy: x.malignancy ? 1 : 0 };
    const score = Object.values(pts).reduce((a, b) => a + b, 0);
    const mort30 = 100 / (1 + Math.exp(5.012 - 0.481 * score));
    return { score, pts, mort30 };
  }

  /* ---- pre-op: AAGBI 2011 acceptable reasons to delay surgery ---- */
  function preop(x) {
    const items = [];
    const add = (label, state, value, note) => items.push({ label, state, value, note: note || "" }); // state: ok | fix | delay | missing
    const has = (e) => e && ok(e.v);
    add("Hemoglobin", !has(x.hgb) ? "missing" : x.hgb.v < 80 ? "delay" : x.hgb.v < 100 ? "fix" : "ok", x.hgb, has(x.hgb) && x.hgb.v < 80 ? "Below 80: transfuse before theatre" : has(x.hgb) && x.hgb.v < 100 ? "Cross-match 2 units; expect a 20-30 g/L fall" : "");
    add("Platelets", !has(x.plt) ? "missing" : x.plt.v < 50 ? "delay" : x.plt.v < 80 ? "fix" : "ok", x.plt, has(x.plt) && x.plt.v < 80 ? "Below 80: spinal usually avoided; below 50: discuss platelets" : "");
    add("Sodium", !has(x.na) ? "missing" : x.na.v < 120 || x.na.v > 150 ? "delay" : x.na.v < 130 ? "fix" : "ok", x.na, has(x.na) && (x.na.v < 120 || x.na.v > 150) ? "Below 120 or above 150: acceptable reason to delay (AAGBI)" : "");
    add("Potassium", !has(x.k) ? "missing" : x.k.v < 2.8 || x.k.v > 6 ? "delay" : x.k.v < 3.5 || x.k.v > 5.5 ? "fix" : "ok", x.k, has(x.k) && (x.k.v < 2.8 || x.k.v > 6) ? "Below 2.8 or above 6.0: acceptable reason to delay" : "");
    add("Glucose", !has(x.glu) ? "missing" : x.glu.v > 20 || x.glu.v < 4 ? "fix" : "ok", x.glu, has(x.glu) && x.glu.v > 20 ? "Uncontrolled diabetes: correct, but do not delay long" : "");
    add("Creatinine", !has(x.cr) ? "missing" : x.crRise ? "fix" : "ok", x.cr, x.crRise ? "Above the earlier value: AKI? Fluids, hold nephrotoxins" : ok(x.crcl) ? "CrCl " + Math.round(x.crcl) + " mL/min" : "");
    add("INR", !has(x.inr) ? (x.warfarin ? "missing" : "ok") : x.inr.v > 1.8 ? "delay" : x.inr.v > 1.5 ? "fix" : "ok", x.inr,
      has(x.inr) && x.inr.v > 1.5 ? (x.inr.v > 1.8 ? "Above 1.8: reverse (vitamin K) before theatre" : "1.5-1.8: GA possible, spinal needs 1.5 or less") : !has(x.inr) && !x.warfarin ? "Not needed unless on warfarin or liver disease" : "");
    add("Group and screen", x.ts ? (x.ts.age > 72 * H ? "fix" : "ok") : "missing", null, x.ts ? (x.ts.age > 72 * H ? "Older than 72 h: repeat" : "") : "Not found in the chart");
    const delay = items.filter((i) => i.state === "delay");
    return { items, delay, ready: !delay.length && !items.some((i) => i.state === "missing" && i.label !== "Group and screen") };
  }

  /* ---- anticoagulants ----
     drug: { kind: "xa"|"dabigatran"|"warfarin"|"lmwh-proph"|"lmwh-ther"|"ufh", last: ms|null, reduced: bool }. Returns earliest times. */
  function anticoag(drug, cl, inr) {
    const out = { kind: drug.kind, ga: null, neuraxial: null, notes: [] };
    const L = drug.last;
    if (drug.kind === "xa") {
      out.ga = L ? L + (cl != null && cl < 30 ? 48 : 24) * H : null;
      out.neuraxial = L ? L + (drug.reduced ? 48 : 72) * H : null;
      out.notes.push(`General anaesthesia: ${cl != null && cl < 30 ? 48 : 24} h after the last dose (CrCl ${cl != null ? Math.round(cl) : "?"}). Spinal: ASRA advises ${drug.reduced ? 48 : 72} h; local hip-fracture protocols may accept 24-48 h if GA risk is higher.`);
      if (cl != null && cl < 30) out.notes.push("CrCl below 30: drug level (anti-Xa calibrated) if available; discuss with haematology.");
    } else if (drug.kind === "dabigatran") {
      out.ga = L ? L + (cl != null && cl < 30 ? 48 : 36) * H : null;
      const nx = cl == null ? null : cl >= 80 ? 72 : cl >= 50 ? 96 : cl >= 30 ? 120 : null;
      out.neuraxial = L && nx ? L + nx * H : null;
      out.notes.push(`General anaesthesia: about ${cl != null && cl < 30 ? 48 : 36} h after the last dose. Spinal (ASRA): ${nx ? nx + " h" : cl != null && cl < 30 ? "not recommended (CrCl below 30)" : "depends on CrCl"}. A normal thrombin time excludes a significant effect; idarucizumab if urgent.`);
    } else if (drug.kind === "warfarin") {
      const i = inr && ok(inr.v) ? inr.v : null;
      out.notes.push(i == null ? "No INR found: check now." : i <= 1.5 ? `INR ${i}: fine for GA or spinal.` : i <= 1.8 ? `INR ${i}: GA possible; spinal needs 1.5 or less.` : `INR ${i}: give IV vitamin K (dose per local protocol, often 2-5 mg) and recheck INR in 6 h. PCC only if surgery cannot wait (INR above 4.5 or delay over 24 h).`);
      out.reverse = i != null && i > 1.5;
    } else if (drug.kind === "lmwh-proph") {
      out.neuraxial = L ? L + 12 * H : null;
      out.notes.push("Prophylactic LMWH: last dose at least 12 h before a spinal.");
    } else if (drug.kind === "lmwh-ther") {
      out.neuraxial = L ? L + 24 * H : null; out.ga = L ? L + 24 * H : null;
      out.notes.push("Therapeutic LMWH: last dose at least 24 h before surgery or a spinal.");
    } else if (drug.kind === "ufh") {
      out.ga = L ? L + 4 * H : null; out.neuraxial = L ? L + 4 * H : null;
      out.notes.push("IV heparin: stop 4 h before; check aPTT.");
    }
    return out;
  }
  function antiplatelet(names) {
    const n = names.join(" ").toLowerCase(), out = [];
    if (!names.length) return out;
    if (/clopidogrel|prasugrel|ticagrelor/.test(n) && /aspirin|asa\b|acetylsalicylic/.test(n)) out.push("Dual antiplatelet: continue aspirin, hold the P2Y12 inhibitor (check stent date with cardiology). Do not delay surgery; GA preferred over spinal.");
    else if (/clopidogrel|prasugrel|ticagrelor/.test(n)) out.push("P2Y12 inhibitor: do not delay surgery; GA preferred (spinal needs 5-7 days off). Watch blood loss; platelets if bleeding.");
    if (/aspirin|asa\b|acetylsalicylic/.test(n) && !/clopidogrel|prasugrel|ticagrelor/.test(n)) out.push("Aspirin alone: continue; no delay; spinal acceptable.");
    return out;
  }

  /* ---- post-op ---- */
  /* restrictive transfusion (FOCUS): Hgb below 80, or symptoms / cardiac disease */
  function transfusion(hgb, cardiac) {
    if (!hgb || !ok(hgb.v)) return null;
    return { give: hgb.v < 80, consider: hgb.v < 90 && cardiac, text: hgb.v < 80 ? "Below 80: transfuse 1 unit and recheck" : hgb.v < 90 && cardiac ? "80-89 with heart disease: transfuse if symptomatic (chest pain, hypotension, tachycardia)" : "Above threshold: no transfusion" };
  }
  /* 1 = up from the pre-op/admission value by 26.5 or 50% */
  const aki = (base, cur) => (ok(base) && ok(cur) ? cur - base >= 26.5 || cur >= base * 1.5 : false);

  function vtePlan(x) {
    // x: { pod, onTherapeutic, onProph, crcl, plt, bleeding, preop, delayedHours }
    const dose = x.crcl != null && x.crcl < 30 ? "enoxaparin 30 mg SC daily (CrCl below 30) or heparin 5,000 units SC q12h" : "enoxaparin 40 mg SC daily (or dalteparin 5,000 units SC daily)";
    if (x.onTherapeutic) return { state: "ther", text: "On therapeutic anticoagulation: " + (x.preop ? "held for surgery; " : "") + "restart at full dose 24-72 h after surgery once haemostasis is secure (first DOAC dose at least 24 h after the last LMWH)." , dose };
    if (x.bleeding || (ok(x.plt) && x.plt < 50)) return { state: "hold", text: "Mechanical prophylaxis (IPC) for now: " + (x.bleeding ? "bleeding" : "platelets below 50") + ". Start drug prophylaxis when safe.", dose };
    if (x.preop) return { state: x.onProph ? "on" : "start", text: x.onProph ? "Prophylaxis ordered: last dose at least 12 h before a spinal." : `Start ${dose} on admission if surgery is not within about 12 h; hold the dose 12 h before a spinal.`, dose };
    return { state: x.onProph ? "on" : "start", text: (x.onProph ? "Prophylaxis ordered. " : `Start ${dose} 12 h after surgery. `) + "Continue for 28-35 days after hip fracture surgery, including after discharge.", dose };
  }

  /* ---- bone health (Osteoporosis Canada 2023: treat after any hip fracture without needing BMD) ---- */
  function bone(x) {
    // x: { vitd (nmol/L), ca (mmol/L, corrected), crcl, onTreatment, onVitD }
    const out = [];
    if (x.onTreatment) { out.push("Osteoporosis treatment on record: " + x.onTreatment + ". Check adherence; continue."); return { treat: false, items: out }; }
    out.push("A hip fracture is enough to start osteoporosis treatment; no bone density test needed first (Osteoporosis Canada 2023).");
    if (!ok(x.vitd)) out.push("Check 25-OH vitamin D, calcium, albumin, creatinine before an IV bisphosphonate.");
    else if (x.vitd < 50) out.push(`Vitamin D ${Math.round(x.vitd)} nmol/L (below 50): replace before zoledronic acid (risk of low calcium), e.g. a loading course per local protocol, then 1,000-2,000 IU daily.`);
    if (!x.onVitD) out.push("Vitamin D 1,000-2,000 IU daily; calcium from diet (1,200 mg/day), supplement only the gap.");
    if (x.crcl != null && x.crcl < 35) out.push(`CrCl ${Math.round(x.crcl)}: avoid zoledronic acid and alendronate; denosumab 60 mg SC every 6 months (check calcium; never stop without a plan).`);
    else out.push("Options: zoledronic acid 5 mg IV yearly (often given 2 weeks to 3 months after surgery, once vitamin D and calcium are normal) or alendronate 70 mg PO weekly. Denosumab if bisphosphonates are not suitable.");
    if (ok(x.ca) && x.ca < 2.1) out.push(`Calcium ${x.ca}: correct before any antiresorptive.`);
    out.push("Refer to the fracture liaison / osteoporosis clinic and arrange falls assessment.");
    return { treat: true, items: out };
  }

  const api = { crcl, timeline, nhfs, preop, anticoag, antiplatelet, transfusion, aki, vtePlan, bone, H, DAY };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.HipRules = api;
})(typeof window !== "undefined" ? window : globalThis);
