/* ACLS tab rules. Pure functions, no chart access. UNVERIFIED draft written by Claude from the 2025 AHA Guidelines for CPR and ECC
   (Part 9 Adult ALS, Part 10 Special circumstances, Part 11 Post-cardiac arrest care) as taught in Canada by Heart & Stroke.
   Doses are the usual adult ACLS doses: check with Island Health pharmacy and the code cart drug sheet before real use. */
(function () {
  const MIN = 6e4;
  const r1 = (x) => Math.round(x * 10) / 10;

  /* ---------------- code timer ---------------- */
  // event: { t, type, v }   types: start, rhythm (v: vf | pvt | pea | asys | organized), shock (v: joules), epi, amio (v: 300 | 150),
  //                          lido (v: mg), access (v: IV | IO), airway (v: text), rosc, rearrest, drug (v: text), note (v: text), end (v: text)
  const RHYTHM = { vf: "VF", pvt: "pulseless VT", pea: "PEA", asys: "asystole", organized: "organized rhythm" };
  const SHOCKABLE = (r) => r === "vf" || r === "pvt";

  function codeState(events, now) {
    const ev = (events || []).slice().sort((a, b) => a.t - b.t);
    const start = ev.find((e) => e.type === "start");
    const s = { started: !!start, prompts: [], shocks: 0, epi: 0, amio: [], lido: [], phase: "idle" };
    if (!start) return s;
    s.start = start.t;
    const after = ev.filter((e) => e.t >= start.t);
    const end = after.find((e) => e.type === "end");
    s.ended = !!end; s.endT = end ? end.t : null;
    const clock = end ? end.t : now;
    s.elapsed = clock - start.t;
    // phase: arrest until ROSC; a re-arrest restarts the arrest phase (cycle anchor)
    let phase = "arrest", anchor = start.t, roscT = null;
    after.forEach((e) => {
      if (e.type === "rosc") { phase = "rosc"; roscT = e.t; }
      if (e.type === "rearrest") { phase = "arrest"; anchor = e.t; roscT = null; }
      if (e.type === "rhythm" && phase === "arrest") anchor = e.t;
    });
    s.phase = end ? "ended" : phase; s.roscT = roscT;
    s.rhythm = (after.filter((e) => e.type === "rhythm").pop() || {}).v || null;
    s.firstRhythm = (after.find((e) => e.type === "rhythm") || {}).v || null;
    s.shocks = after.filter((e) => e.type === "shock").length;
    const epis = after.filter((e) => e.type === "epi");
    s.epi = epis.length; s.lastEpi = epis.length ? epis[epis.length - 1].t : null;
    s.amio = after.filter((e) => e.type === "amio").map((e) => +e.v);
    s.lido = after.filter((e) => e.type === "lido").map((e) => +e.v);
    s.access = after.some((e) => e.type === "access"); s.airway = after.some((e) => e.type === "airway");
    s.cycles = after.filter((e) => e.type === "rhythm").length;
    if (s.phase !== "arrest") return s;

    // rhythm check every 2 minutes from the last check (or from the start)
    s.nextCheck = anchor + 2 * MIN; s.checkIn = s.nextCheck - now;
    if (s.checkIn <= 0) s.prompts.push({ lvl: "urgent", t: "Rhythm and pulse check now (10 seconds or less). Swap the compressor." });
    else if (s.checkIn <= 15e3) s.prompts.push({ lvl: "action", t: "Rhythm check in " + Math.ceil(s.checkIn / 1000) + " s: next compressor get ready, charge the defibrillator during compressions." });

    // epinephrine: non-shockable as soon as feasible; shockable after initial shocks fail (the algorithm places it after the 2nd shock); then every 3-5 min
    const shockable = SHOCKABLE(s.rhythm);
    s.epiSince = s.lastEpi ? now - s.lastEpi : null;
    if (!s.rhythm) s.epiState = { k: "wait", t: "Pick the rhythm at the first check" };
    else if (!s.epi && shockable && s.shocks < 2) s.epiState = { k: "wait", t: "Shockable: epinephrine after the 2nd shock" };
    else if (!s.epi) s.epiState = { k: "due", t: "Give epinephrine 1 mg IV/IO now" };
    else if (s.epiSince < 3 * MIN) s.epiState = { k: "wait", t: "Next epinephrine in " + fmt(3 * MIN - s.epiSince) + " (window 3-5 min)" };
    else if (s.epiSince <= 5 * MIN) s.epiState = { k: "due", t: "Epinephrine due (3-5 min since last)" };
    else s.epiState = { k: "over", t: "Epinephrine overdue: " + fmt(s.epiSince) + " since last dose" };
    if (s.epiState.k === "due" || s.epiState.k === "over") s.prompts.push({ lvl: s.epiState.k === "over" ? "urgent" : "action", t: s.epiState.t + ". Flush 20 mL, raise the arm." });

    // antiarrhythmic: after the 3rd shock (amiodarone 300 mg or lidocaine), 2nd dose after the 5th shock
    if (shockable) {
      if (s.shocks >= 3 && !s.amio.length && !s.lido.length) s.prompts.push({ lvl: "action", t: "Shock-refractory VF/pVT: amiodarone 300 mg IV/IO push, or lidocaine 1-1.5 mg/kg." });
      else if (s.shocks >= 5 && s.amio.length === 1 && !s.lido.length) s.prompts.push({ lvl: "action", t: "Second amiodarone dose 150 mg IV/IO." });
      else if (s.shocks >= 5 && s.lido.length === 1 && !s.amio.length) s.prompts.push({ lvl: "action", t: "Second lidocaine dose 0.5-0.75 mg/kg (max total 3 mg/kg)." });
      if (s.shocks >= 3) s.prompts.push({ lvl: "info", t: "Refractory VF: check pad position and contact, consider coronary cause (cath lab / ECPR if a candidate), correct K and Mg. Vector change and double sequential shocks are not established (2025)." });
    } else if (s.rhythm === "pea" || s.rhythm === "asys") {
      s.prompts.push({ lvl: "info", t: "Non-shockable: no shock. Look hard for a reversible cause (Hs & Ts tab)." });
    }
    if (!s.access && s.elapsed > MIN) s.prompts.push({ lvl: "action", t: "No access logged: IV first; IO if IV is not quick. Do not stop CPR for a central line." });
    if (s.elapsed > 10 * MIN && !s.airway) s.prompts.push({ lvl: "info", t: "Consider an advanced airway if bag-mask is not working; confirm with waveform capnography." });
    if (s.elapsed > 20 * MIN) s.prompts.push({ lvl: "info", t: "20+ minutes: review reversible causes, goals of care and whether to continue. ETCO2 alone should not decide. TOR rules do not apply in hospital." });
    return s;
  }
  function fmt(ms) { if (ms == null) return "-"; const neg = ms < 0, a = Math.abs(ms), m = Math.floor(a / MIN), sec = Math.floor((a % MIN) / 1000); return (neg ? "-" : "") + m + ":" + String(sec).padStart(2, "0"); }
  function clock(t) { const d = new Date(t); return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0") + ":" + String(d.getSeconds()).padStart(2, "0"); }

  function eventText(e) {
    switch (e.type) {
      case "start": return "Arrest called / CPR started";
      case "rhythm": return "Rhythm check: " + (RHYTHM[e.v] || e.v);
      case "shock": return "Shock " + (e.v ? e.v + " J" : "");
      case "epi": return "Epinephrine 1 mg IV/IO";
      case "amio": return "Amiodarone " + e.v + " mg IV/IO";
      case "lido": return "Lidocaine " + e.v + " mg IV/IO";
      case "access": return "Access: " + e.v;
      case "airway": return "Airway: " + e.v;
      case "rosc": return "ROSC";
      case "rearrest": return "Re-arrest, CPR restarted";
      case "drug": return "Drug: " + e.v;
      case "note": return e.v;
      case "end": return "Code ended: " + (e.v || "");
      default: return e.type;
    }
  }
  function logText(events) {
    const ev = (events || []).slice().sort((a, b) => a.t - b.t), s0 = ev.find((e) => e.type === "start");
    return ev.map((e) => clock(e.t) + (s0 ? " (+" + fmt(e.t - s0.t) + ")" : "") + "  " + eventText(e)).join("\n");
  }

  /* ---------------- weight-based doses ---------------- */
  function doses(kg) {
    const w = kg && kg > 20 && kg < 300 ? kg : null, d = (lo, hi, u) => (w ? (hi ? Math.round(lo * w) + "-" + Math.round(hi * w) : Math.round(lo * w)) + " " + u : null);
    return {
      kg: w,
      lidoFirst: d(1, 1.5, "mg"), lidoSecond: d(0.5, 0.75, "mg"), lidoMax: d(3, null, "mg"),
      diltFirst: w ? Math.round(Math.min(0.25 * w, 25)) + " mg" : null, diltSecond: w ? Math.round(Math.min(0.35 * w, 25)) + " mg" : null,
      procMax: d(17, null, "mg"),
      lipidBolus: w ? Math.round(1.5 * w) + " mL" : null, lipidInf: w ? r1(0.25 * w) + " mL/min" : null,
      bicarbTCA: d(1, 2, "mmol"),
      dopa: w ? r1(5 * w) + "-" + Math.round(20 * w) + " mcg/min" : null
    };
  }

  /* ---------------- Hs & Ts ---------------- */
  // x: { k, mg, ica, ca, glu, ph, pco2, hco3, lactate, hb, hbDrop, temp, spo2, sbp, inr, plt, ddimer, digoxin, qtc, tropRise,
  //      med: {opioid, benzo, bb, ccb, dig, tca, la, qt, anticoag, insulin, su}, prob: {...}, recentProc }
  function hsts(x) {
    const out = [], m = {}, p = x.prob || {};
    ["opioid", "benzo", "bb", "ccb", "dig", "tca", "la", "qt", "anticoag", "insulin", "su", "kup", "loopThiazide"].forEach((k) => (m[k] = (x.med && x.med[k]) || []));
    const add = (id, name, group, ev, nodata, tx, extra) => {
      const strong = ev.filter((e) => e.w === 2).length, any = ev.length;
      out.push(Object.assign({ id, name, group, status: strong ? "likely" : any ? "possible" : nodata ? "nodata" : "none", ev: ev.map((e) => e.t), tx }, extra || {}));
    };
    const E = (t, w) => ({ t, w: w || 1 });
    // Hs
    let ev = [];
    if (x.hb != null && x.hb < 70) ev.push(E("Hb " + x.hb + " g/L", 2));
    if (x.hbDrop != null && x.hbDrop >= 20) ev.push(E("Hb down " + x.hbDrop + " g/L in 72 h", 2));
    if (p.gibleed) ev.push(E("GI bleed on problem list"));
    if (m.anticoag.length && x.hb != null && x.hb < 100) ev.push(E("anticoagulant with Hb " + x.hb));
    if (x.recentProc) ev.push(E("recent surgery or procedure"));
    if (p.sepsis) ev.push(E("sepsis (vasodilatory / volume loss)"));
    add("hypovol", "Hypovolemia (bleeding, sepsis, volume loss)", "H", ev, x.hb == null, ["Fluid bolus wide open; blood (O-negative / massive transfusion protocol) if bleeding.", "Look for the source: GI, retroperitoneal (recent femoral line, anticoagulation), surgical site.", "Reverse anticoagulation if bleeding."]);
    ev = [];
    if (x.spo2 != null && x.spo2 < 88) ev.push(E("SpO2 " + x.spo2 + "% before the arrest", 2));
    if (p.copd) ev.push(E("COPD")); if (m.opioid.length || m.benzo.length) ev.push(E("sedating medications"));
    if (p.osa) ev.push(E("sleep apnea"));
    add("hypoxia", "Hypoxia (airway, respiratory failure)", "H", ev, x.spo2 == null, ["100% oxygen; check the airway, tube position (capnography) and bilateral air entry.", "Respiratory arrest before cardiac arrest is common in hospital: think sedation, aspiration, mucus plug."]);
    ev = [];
    if (x.ph != null && x.ph < 7.2) ev.push(E("pH " + x.ph, 2)); if (x.hco3 != null && x.hco3 < 15) ev.push(E("HCO3 " + x.hco3, 2));
    if (x.lactate != null && x.lactate >= 4) ev.push(E("lactate " + x.lactate)); if (p.dka) ev.push(E("DKA on problem list"));
    add("acid", "Hydrogen ion (acidosis)", "H", ev, x.ph == null && x.hco3 == null, ["Ventilate well. Sodium bicarbonate is not routine in arrest; consider 50 mmol IV for hyperkalemia, TCA or sodium-channel blocker toxicity, or known severe metabolic acidosis."]);
    ev = [];
    if (x.k != null && x.k >= 6) ev.push(E("K " + x.k + " mmol/L", 2)); else if (x.k != null && x.k >= 5.5) ev.push(E("K " + x.k + " mmol/L"));
    if (p.dialysis) ev.push(E("dialysis patient", x.k == null || x.k >= 5.5 ? 2 : 1)); else if (p.ckd) ev.push(E("CKD"));
    if (m.kup.length) ev.push(E("K-raising drugs: " + m.kup.slice(0, 3).join(", ")));
    add("hyperk", "Hyperkalemia", "H", ev, x.k == null, ["Calcium chloride 10% 10 mL IV (or calcium gluconate 10% 30 mL).", "Regular insulin 10 units IV with dextrose 25 g (D50W 50 mL); check glucose after.", "Sodium bicarbonate 50 mmol IV, especially if acidotic.", "Salbutamol nebs after ROSC; call nephrology for urgent dialysis."], { lytes: true });
    ev = [];
    if (x.k != null && x.k <= 2.5) ev.push(E("K " + x.k + " mmol/L", 2)); else if (x.k != null && x.k < 3.2) ev.push(E("K " + x.k + " mmol/L"));
    if (x.mg != null && x.mg < 0.5) ev.push(E("Mg " + x.mg + " mmol/L", 2)); else if (x.mg != null && x.mg < 0.7) ev.push(E("Mg " + x.mg + " mmol/L"));
    if (m.loopThiazide.length && x.k != null && x.k < 3.5) ev.push(E("on diuretic"));
    if (x.k != null && x.k < 3.5 && x.mg != null && x.mg < 0.7) ev.push(E("low K and low Mg together", 2));
    if (x.qtc != null && x.qtc >= 500 && ((x.k != null && x.k < 3.5) || (x.mg != null && x.mg < 0.7))) ev.push(E("QTc " + x.qtc + " ms with low K/Mg (torsades risk)", 2));
    add("hypok", "Hypokalemia / hypomagnesemia", "H", ev, x.k == null && x.mg == null, ["Magnesium sulfate 2 g IV over 1-2 min in arrest (torsades or low Mg).", "Potassium IV (central line preferred) after ROSC or as directed; recheck often."], { lytes: true });
    ev = [];
    if (x.temp != null && x.temp < 35) ev.push(E("temperature " + x.temp + " °C", 2));
    add("hypothermia", "Hypothermia", "H", ev, x.temp == null, ["Core temperature; active rewarming. ECPR if available and severe (< 30 °C). Drugs and shocks may not work until warmer."]);
    ev = [];
    if (x.glu != null && x.glu < 3) ev.push(E("glucose " + x.glu + " mmol/L", 2)); else if (x.glu != null && x.glu < 4) ev.push(E("glucose " + x.glu + " mmol/L"));
    if ((m.insulin.length || m.su.length) && (x.glu == null || x.glu < 5)) ev.push(E("insulin / sulfonylurea"));
    add("hypogly", "Hypoglycemia", "H", ev, x.glu == null, ["Dextrose 25 g IV (D50W 50 mL); point-of-care glucose."]);
    ev = [];
    if (x.ica != null && x.ica < 0.9) ev.push(E("ionized Ca " + x.ica + " mmol/L", 2)); else if (x.ca != null && x.ca < 1.8) ev.push(E("total Ca " + x.ca + " mmol/L"));
    if (m.ccb.length) ev.push(E("calcium-channel blocker"));
    add("hypoca", "Hypocalcemia", "H", ev, x.ica == null && x.ca == null, ["Calcium chloride 10% 10 mL IV. Not routine in arrest, but give for hyperkalemia, hypocalcemia, CCB toxicity, massive transfusion."], { lytes: true });
    // Ts
    ev = [];
    if (p.ptx) ev.push(E("pneumothorax on problem list", 2)); if (p.ventilated) ev.push(E("on positive-pressure ventilation"));
    if (x.recentLine) ev.push(E("recent central line / thoracentesis / pleural procedure"));
    if (p.copd) ev.push(E("COPD / bullae")); if (p.trauma) ev.push(E("chest trauma or rib fractures"));
    add("tension", "Tension pneumothorax", "T", ev, false, ["Absent breath sounds, high airway pressure, JVP up: needle decompression 2nd ICS mid-clavicular or 4th-5th ICS anterior axillary, then chest tube.", "POCUS (lung sliding) only if it does not interrupt compressions."]);
    ev = [];
    if (p.effusion) ev.push(E("pericardial effusion on problem list", 2)); if (p.cardsurg) ev.push(E("recent cardiac surgery, pacemaker lead or ablation", 2));
    if (p.cancer) ev.push(E("cancer")); if (p.dialysis) ev.push(E("ESRD (uremic pericarditis)")); if (m.anticoag.length && p.cardsurg) ev.push(E("anticoagulated after a cardiac procedure"));
    add("tamponade", "Tamponade (cardiac)", "T", ev, false, ["POCUS by an experienced operator during the pulse check; pericardiocentesis (subxiphoid) if seen. Call cardiology / cardiac surgery."]);
    ev = [];
    if (m.opioid.length) ev.push(E("opioids: " + m.opioid.slice(0, 2).join(", "), x.recentOpioidDose ? 2 : 1));
    if (m.benzo.length) ev.push(E("benzodiazepines: " + m.benzo.slice(0, 2).join(", ")));
    if (m.dig.length) ev.push(E("digoxin" + (x.digoxin != null ? " (level " + x.digoxin + ")" : ""), x.digoxin != null && x.digoxin > 2.6 ? 2 : 1));
    if (m.bb.length && m.ccb.length) ev.push(E("beta-blocker plus calcium-channel blocker"));
    if (m.tca.length) ev.push(E("tricyclic: " + m.tca[0]));
    if (m.la.length) ev.push(E("local anesthetic infusion / block: " + m.la[0], 2));
    if (x.qtc != null && x.qtc >= 500) ev.push(E("QTc " + x.qtc + " ms" + (m.qt.length ? " on " + m.qt.slice(0, 3).join(", ") : ""), 2)); else if (m.qt.length >= 2) ev.push(E("2+ QT-prolonging drugs: " + m.qt.slice(0, 3).join(", ")));
    if (p.overdose) ev.push(E("overdose on problem list", 2));
    add("toxins", "Toxins (drugs)", "T", ev, false, ["Opioid: do not delay CPR; naloxone 0.4-2 mg IV may be given, but high-quality CPR comes first.",
      "Local anesthetic (LAST): lipid emulsion 20% 1.5 mL/kg bolus then 0.25 mL/kg/min; epinephrine doses 1 mcg/kg or less.",
      "Beta-blocker / CCB: calcium, high-dose insulin, glucagon, vasopressors; ECMO if refractory.",
      "Digoxin: digoxin immune Fab (DigiFab) empirically 10 vials in arrest.",
      "TCA / sodium-channel blockers (wide QRS): sodium bicarbonate 1-2 mmol/kg.",
      "Torsades: magnesium 2 g IV, stop QT drugs. Call Poison Control (BC DPIC 1-800-567-8911)."]);
    ev = [];
    if (p.pe) ev.push(E("PE / DVT on problem list", 2)); if (x.ddimer != null && x.ddimer > 2) ev.push(E("D-dimer " + x.ddimer));
    if (x.recentProc) ev.push(E("recent surgery / immobility")); if (p.cancer) ev.push(E("cancer"));
    if (p.hipfx) ev.push(E("hip fracture")); if (x.noVTEppx) ev.push(E("no VTE prophylaxis found"));
    add("pe", "Thrombosis, pulmonary (PE)", "T", ev, false, ["Suspected or confirmed PE arrest: thrombolysis is reasonable (alteplase 50 mg IV push is commonly used; continue CPR 60-90 min after). Check bleeding risk.",
      "Call ICU; consider ECMO / catheter or surgical embolectomy where available."]);
    ev = [];
    if (x.tropRise) ev.push(E("troponin rising", 2)); if (p.acs) ev.push(E("ACS / recent MI", 2)); if (p.cad) ev.push(E("known CAD"));
    if (x.firstRhythm === "vf" || x.firstRhythm === "pvt") ev.push(E("shockable first rhythm"));
    add("coronary", "Thrombosis, coronary (MI)", "T", ev, false, ["After ROSC: 12-lead ECG; STEMI or suspected coronary cause with shock / recurrent VF: urgent cardiology for cath (see NSTEMI tab). Refractory VF: ECPR / cath lab if a candidate."]);
    const rank = { likely: 0, possible: 1, nodata: 2, none: 3 };
    return out.sort((a, b) => rank[a.status] - rank[b.status]);
  }

  /* ---------------- bradycardia ---------------- */
  // x: { hr, unstable, wideOrHighBlock, transplant, k, dig, bb, ccb, tropRise, temp, kg }
  function brady(x) {
    const st = [], causes = [], d = doses(x.kg);
    if (x.hr != null && x.hr >= 50) st.push({ lvl: "info", t: "HR " + x.hr + ": the algorithm is for HR usually under 50 with symptoms." });
    st.push({ lvl: "info", t: "Support airway and breathing, oxygen if SpO2 < 90%, monitor, 12-lead ECG, IV access. Look for and treat the cause." });
    if (!x.unstable) st.push({ lvl: "info", t: "No serious signs (hypotension, altered mental status, shock, ischemic chest pain, acute heart failure): monitor and observe; treat the cause; cardiology if Mobitz II or complete block." });
    else {
      st.push({ lvl: "urgent", t: "Atropine 1 mg IV; repeat every 3-5 min, maximum 3 mg." + (x.transplant ? " Heart transplant: atropine usually will not work, go straight to pacing or epinephrine." : x.wideOrHighBlock ? " Mobitz II / complete block with wide QRS: atropine is unlikely to work, do not wait for it." : "") });
      st.push({ lvl: "urgent", t: "If atropine fails: transcutaneous pacing (sedate/analgese), and/or" });
      st.push({ lvl: "action", t: "Epinephrine infusion 2-10 mcg/min, or dopamine 5-20 mcg/kg/min" + (d.dopa ? " (" + d.dopa + " at " + d.kg + " kg)" : "") + ". Titrate to response." });
      st.push({ lvl: "action", t: "Call cardiology for transvenous pacing; ICU." });
    }
    if (x.k != null && x.k >= 5.5) causes.push("K " + x.k + ": treat hyperkalemia now (calcium chloride 10% 10 mL IV, insulin/dextrose).");
    if (x.dig) causes.push("Digoxin: consider toxicity (level, K); DigiFab if severe.");
    if (x.bb) causes.push("Beta-blocker: glucagon 3-5 mg IV (then infusion), high-dose insulin, calcium.");
    if (x.ccb) causes.push("Calcium-channel blocker: calcium chloride 10% 10-20 mL, high-dose insulin.");
    if (x.tropRise) causes.push("Troponin rising: inferior MI / ischemia (ECG); cardiology.");
    if (x.temp != null && x.temp < 35) causes.push("Hypothermia " + x.temp + " °C: rewarm.");
    causes.push("Also: hypoxia, raised intracranial pressure (Cushing), hypothyroidism, vagal (vomiting, suctioning), sick sinus, Lyme.");
    return { steps: st, causes };
  }

  /* ---------------- tachycardia ---------------- */
  // rhythm: narrow | af | flutter | preexcited | mvt | pvt (polymorphic) | torsades | unknownwide
  const ENERGY = { narrow: "100 J synchronized", af: "200 J synchronized (2025: at least 200 J; increase if it fails)", flutter: "200 J synchronized (2025)", preexcited: "200 J synchronized", mvt: "100 J synchronized", unknownwide: "100 J synchronized; increase if it fails",
    pvt: "Unsynchronized defibrillation, maximum energy", torsades: "Unsynchronized defibrillation, maximum energy" };
  function tachy(x) {
    const r = x.rhythm, d = doses(x.kg), st = [], warn = [];
    const unstable = !!x.unstable;
    if (x.hr != null && x.hr < 150 && r !== "pvt" && r !== "torsades") warn.push("HR " + x.hr + ": at rates under 150, instability is often caused by something else (sepsis, bleeding, hypoxia) and the fast rate is a response; cardioversion is generally not needed.");
    if (r === "pvt" || r === "torsades") {
      st.push({ lvl: "urgent", t: "Polymorphic VT is always unstable: defibrillate now (unsynchronized, maximum energy). Pulseless: cardiac arrest algorithm." });
      if (r === "torsades" || (x.qtc != null && x.qtc >= 500)) st.push({ lvl: "action", t: "Long QT / torsades: magnesium sulfate 2 g IV over 1-2 min (may repeat), keep K > 4 and Mg high-normal, stop QT drugs" + (x.qtDrugs && x.qtDrugs.length ? " (" + x.qtDrugs.slice(0, 4).join(", ") + ")" : "") + ". Pause-dependent: overdrive pacing or isoproterenol with expert help." });
      else st.push({ lvl: "action", t: "Normal QT polymorphic VT: think ischemia (cardiology, cath); amiodarone or lidocaine may be considered. Routine magnesium is not recommended." });
      return { steps: st, warn, energy: ENERGY[r] };
    }
    if (unstable) {
      st.push({ lvl: "urgent", t: "Unstable (hypotension, altered mental status, shock, ischemic chest pain, acute heart failure) from the tachycardia: synchronized cardioversion " + ENERGY[r] + ". Sedate if feasible. Re-press SYNC before each shock." });
      if (r === "narrow") st.push({ lvl: "action", t: "Regular narrow complex: adenosine 6 mg rapid IV push may be tried while preparing to cardiovert." });
      if (r === "af" || r === "flutter") st.push({ lvl: "info", t: "AF > 48 h or unknown and not anticoagulated: stroke risk with cardioversion, but instability takes priority; start anticoagulation as soon as safe." });
    } else {
      st.push({ lvl: "info", t: "Stable: 12-lead ECG, IV access, treat the cause, expert help (cardiology) for wide-complex." });
      if (r === "narrow") {
        st.push({ lvl: "action", t: "Vagal maneuver: modified Valsalva (blow 15 s into a 10 mL syringe, then lie flat and lift the legs)." });
        st.push({ lvl: "action", t: "Adenosine 6 mg rapid IV push with 20 mL flush; 12 mg if needed. Use 3 mg (or less) with a central line, heart transplant, or on dipyridamole/carbamazepine; avoid in severe asthma. Record a rhythm strip." });
        st.push({ lvl: "action", t: "Then IV beta-blocker or diltiazem/verapamil (avoid CCB with systolic heart failure)." + (d.diltFirst ? " Diltiazem " + d.diltFirst + " IV over 2 min, then " + d.diltSecond + " after 15 min if needed." : " Diltiazem 0.25 mg/kg IV over 2 min, then 0.35 mg/kg.") });
      } else if (r === "af" || r === "flutter") {
        st.push({ lvl: "action", t: "Rate control: metoprolol 2.5-5 mg IV every 5 min (max 15 mg) or diltiazem " + (d.diltFirst || "0.25 mg/kg") + " IV over 2 min. Avoid both in decompensated HF with low EF." });
        st.push({ lvl: "action", t: "Critically ill / low EF / hypotensive-borderline: amiodarone 150 mg IV over 10 min, then 1 mg/min for 6 h; digoxin is an add-on in HF." });
        st.push({ lvl: "info", t: "Treat the trigger (sepsis, hypovolemia, hypoxia, pain, thyroid). See the AF (acute illness) tab for rate drugs and anticoagulation." });
      } else if (r === "preexcited") {
        st.push({ lvl: "urgent", t: "Pre-excited AF (WPW: irregular, wide, varying QRS): do NOT give adenosine, beta-blockers, calcium-channel blockers, digoxin or amiodarone." });
        st.push({ lvl: "action", t: "Procainamide 20-50 mg/min IV until rhythm suppressed, hypotension, QRS widens by 50%, or max 17 mg/kg" + (d.procMax ? " (" + d.procMax + ")" : "") + "; or elective synchronized cardioversion. Cardiology." });
      } else if (r === "mvt" || r === "unknownwide") {
        st.push({ lvl: "action", t: "Regular monomorphic wide complex: adenosine 6 mg then 12 mg may be tried (diagnostic and may convert SVT with aberrancy). Never for irregular or polymorphic." });
        st.push({ lvl: "action", t: "Procainamide 20-50 mg/min IV until suppressed, hypotension, QRS widens by 50%, or max 17 mg/kg" + (d.procMax ? " (" + d.procMax + ")" : "") + "; maintenance 1-4 mg/min. Avoid with prolonged QT or HF." });
        st.push({ lvl: "action", t: "Or amiodarone 150 mg IV over 10 min, repeat if needed; then 1 mg/min for 6 h." });
        st.push({ lvl: "info", t: "2025: sotalol removed from the algorithm. Do not give diltiazem or verapamil for wide-complex tachycardia." });
        st.push({ lvl: "info", t: "Cardiovert (100 J synchronized) if drugs fail. Assume VT in older patients with heart disease." });
      }
    }
    if (x.k != null && x.k < 3.5) warn.push("K " + x.k + ": replace potassium (target 4+); check Mg.");
    if (x.mg != null && x.mg < 0.7) warn.push("Mg " + x.mg + ": magnesium sulfate 2 g IV.");
    if (x.qtc != null && x.qtc >= 500) warn.push("QTc " + x.qtc + " ms: be careful with amiodarone and procainamide; stop other QT drugs.");
    return { steps: st, warn, energy: ENERGY[r] };
  }

  /* ---------------- after ROSC ---------------- */
  // x: { map, sbp, spo2, pco2, glu, temp, k, lactate, lactatePrev, follows (true/false/null), stemi (true/false/null), onPressor }
  function rosc(x) {
    const items = [], add = (name, target, val, ok, tip) => items.push({ name, target, val, ok, tip });
    add("MAP", "65 or higher", x.map != null ? x.map + " mmHg" : null, x.map == null ? null : x.map >= 65, "Fluids, then norepinephrine (or epinephrine) to MAP 65+; avoid SBP under 90.");
    add("SpO2", "90-98%", x.spo2 != null ? x.spo2 + "%" : null, x.spo2 == null ? null : x.spo2 >= 90 && x.spo2 <= 98, x.spo2 != null && x.spo2 > 98 ? "Turn the FiO2 down: avoid hyperoxia." : "Titrate oxygen to 90-98% (2025 change from 92-98%).");
    add("PaCO2", "35-45 mmHg", x.pco2 != null ? x.pco2 + " mmHg" : null, x.pco2 == null ? null : x.pco2 >= 35 && x.pco2 <= 45, "Normocapnia; start about 10 breaths/min and check a blood gas. Do not hyperventilate.");
    add("Glucose", "4-10 mmol/L", x.glu != null ? x.glu + " mmol/L" : null, x.glu == null ? null : x.glu >= 4 && x.glu <= 10, "Avoid hypoglycemia and glucose over 10.");
    add("Temperature", "37.5 °C or less", x.temp != null ? x.temp + " °C" : null, x.temp == null ? null : x.temp <= 37.5, "Prevent fever: acetaminophen, uncover, surface cooling device.");
    add("Potassium", "4.0-5.0 mmol/L", x.k != null ? x.k + " mmol/L" : null, x.k == null ? null : x.k >= 3.5 && x.k <= 5.5, "Correct K and Mg (arrhythmias).");
    if (x.lactate != null) add("Lactate", "falling", x.lactate + (x.lactatePrev != null ? " (was " + x.lactatePrev + ")" : ""), x.lactatePrev != null ? x.lactate < x.lactatePrev : x.lactate < 2, "Rising lactate: low output, bleeding, ischemic gut; consider echo and mechanical support.");
    const plan = [];
    plan.push({ lvl: "urgent", t: "12-lead ECG now." + (x.stemi === true ? " STEMI: call cardiology for emergent cath." : x.stemi === false ? " No STEMI: cath is selective, if a coronary cause is suspected (shock, recurrent VF, ongoing ischemia)." : "") });
    plan.push({ lvl: "action", t: "Call ICU. Secure airway (capnography), arterial line, Foley, chest X-ray, ABG, lactate, lytes, troponin, CBC, INR." });
    if (x.follows === false || x.follows == null) {
      plan.push({ lvl: "action", t: "Not following commands (or cannot assess): deliberate temperature control 32-37.5 °C as soon as possible, for at least 36 hours; prevent fever (37.5 °C or less) for 72 hours." });
      plan.push({ lvl: "action", t: "CT head (and chest/abdomen if the cause is unclear); EEG for seizures. No prophylactic antiseizure drugs." });
      plan.push({ lvl: "info", t: "Do not prognosticate early: multimodal neuroprognostication at least 72 hours after normothermia, off sedation." });
    } else plan.push({ lvl: "info", t: "Following commands: good sign. Still ICU/step-down, look for the cause, secondary prevention (ICD assessment after VF/VT without a reversible cause)." });
    plan.push({ lvl: "info", t: "Treat the cause found on the Hs & Ts tab. Consider antibiotics if aspiration or sepsis." });
    plan.push({ lvl: "info", t: "Talk with family; re-check code status / goals of care before the next event." });
    return { items, plan };
  }

  /* ---------------- code status and arrest-risk screen ---------------- */
  const MOST_RE = /\b(M[123]|C[012])\b/;
  function codeStatus(found) {
    if (!found || !found.length) return { kind: "none", t: "No code status / MOST designation found in the problem list, observations or document titles. Check the paper MOST form and orders." };
    const best = found.slice().sort((a, b) => (b.t || 0) - (a.t || 0))[0], txt = best.text, mm = txt.match(MOST_RE);
    let kind = "unknown";
    if (/\bDNR\b|do not resuscitate|no cpr|allow natural death|comfort/i.test(txt) || /\bAND\b/.test(txt) || (mm && mm[1][0] === "M")) kind = "dnr";
    else if (/full code|full resuscitation|\bCPR\b(?! not)/i.test(txt)) kind = "full";
    else if (mm && mm[1][0] === "C") kind = "critical";
    return { kind, most: mm ? mm[1] : null, text: txt, source: best.source, when: best.t, all: found };
  }
  // x: { sbp, hr, rr, spo2, k, mg, qtc, qtDrugs, lactate, ph, tropRise, sedNoNaloxone, news }
  function arrestRisk(x) {
    const f = [], add = (lvl, t) => f.push({ lvl, t });
    if (x.sbp != null && x.sbp < 90) add("urgent", "SBP " + x.sbp + " mmHg");
    if (x.hr != null && x.hr < 40) add("urgent", "HR " + x.hr);
    if (x.hr != null && x.hr >= 140) add("urgent", "HR " + x.hr);
    if (x.rr != null && (x.rr >= 30 || x.rr <= 8)) add("urgent", "RR " + x.rr);
    if (x.spo2 != null && x.spo2 < 88) add("urgent", "SpO2 " + x.spo2 + "%");
    if (x.k != null && (x.k >= 6 || x.k <= 2.5)) add("urgent", "K " + x.k + " mmol/L");
    if (x.mg != null && x.mg < 0.5) add("action", "Mg " + x.mg + " mmol/L");
    if (x.qtc != null && x.qtc >= 500) add("action", "QTc " + x.qtc + " ms" + (x.qtDrugs && x.qtDrugs.length ? " on " + x.qtDrugs.slice(0, 3).join(", ") : ""));
    if (x.lactate != null && x.lactate >= 4) add("urgent", "lactate " + x.lactate);
    if (x.ph != null && x.ph < 7.2) add("urgent", "pH " + x.ph);
    if (x.tropRise) add("action", "troponin rising");
    if (x.sedRisk) add("action", "opioid + another sedative (see Opioid safety tab)");
    return f;
  }

  /* ---------------- note draft and family update ---------------- */
  function note(o) {
    const s = o.state || {}, L = [];
    const ev = (o.events || []).slice().sort((a, b) => a.t - b.t);
    L.push("CODE BLUE / CARDIAC ARREST NOTE" + (o.where ? " - " + o.where : ""));
    if (s.started) {
      L.push("Arrest called " + clock(s.start) + ". First rhythm: " + (RHYTHM[s.firstRhythm] || "not recorded") + ". Witnessed: " + (o.witnessed || "___") + ". Monitored: " + (o.monitored || "___") + ".");
      L.push("CPR duration " + fmt((s.roscT || s.endT || o.now) - s.start) + ". Shocks: " + s.shocks + ". Epinephrine 1 mg x " + s.epi + "." + (s.amio.length ? " Amiodarone " + s.amio.join(" + ") + " mg." : "") + (s.lido.length ? " Lidocaine " + s.lido.join(" + ") + " mg." : ""));
      const other = ev.filter((e) => e.type === "drug" || e.type === "airway" || e.type === "access").map(eventText);
      if (other.length) L.push(other.join(". ") + ".");
      if (s.roscT) L.push("ROSC at " + clock(s.roscT) + " (" + fmt(s.roscT - s.start) + " after the arrest call).");
      const endE = ev.find((e) => e.type === "end");
      if (endE && /death|died|stopped|terminated/i.test(endE.v || "")) L.push("Resuscitation stopped at " + clock(endE.t) + ". Time of death " + clock(endE.t) + ".");
    } else L.push("Arrest details: ___");
    L.push("");
    L.push("Likely cause: " + (o.likely && o.likely.length ? o.likely.join("; ") : "___"));
    if (o.postRosc && o.postRosc.length) { L.push("Post-ROSC: " + o.postRosc.join("; ") + "."); }
    L.push("Code status before the event: " + (o.code || "___") + ". Plan going forward: ___");
    L.push("Family: " + (o.family || "___") + ". Team debrief: ___. Most responsible physician informed: ___.");
    if (ev.length) { L.push(""); L.push("Event log:"); L.push(logText(ev)); }
    return L.join("\n");
  }
  function familyScript(o) {
    const who = o.who || "[name]", pt = o.pt || "[patient]";
    const L = [];
    L.push("Hello " + who + ", this is Dr. ___, the hospitalist looking after " + pt + ". I need to tell you about something serious that happened.");
    if (o.outcome === "died") {
      L.push("Earlier today " + pt + "'s heart stopped. The team did CPR and gave medications for " + (o.mins || "__") + " minutes, but we were not able to restart the heart, and " + pt + " died at " + (o.time || "__") + ". I am very sorry.");
      L.push("You are welcome to come in and see them. Is there someone who can come with you?");
    } else {
      L.push("Earlier today " + pt + "'s heart stopped. The team did CPR" + (o.mins ? " for about " + o.mins + " minutes" : "") + " and the heart started again.");
      L.push(pt + " is now " + (o.where || "being moved to the ICU") + ". The next 24 to 72 hours are important; it is too early to know how much the brain was affected.");
      L.push("We think the cause may be " + (o.cause || "still being worked out") + ". I would like to talk with you about what " + pt + " would want if this happens again.");
    }
    L.push("What questions do you have? Here is how to reach us: ___.");
    return L.join("\n\n");
  }

  const api = { codeState, fmt, clock, eventText, logText, doses, hsts, brady, tachy, rosc, codeStatus, arrestRisk, note, familyScript, RHYTHM, SHOCKABLE, ENERGY, MIN };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else window.ACLSRules = api;
})();
