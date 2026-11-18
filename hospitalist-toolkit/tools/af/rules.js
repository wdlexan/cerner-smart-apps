/* AF in acute illness (pneumonia / sepsis): pure decision rules. No chart access here, so it can be tested with node.
   UNVERIFIED DRAFT written by Claude from CCS 2020 AF guideline (ch. 9 acute management, CHADS-65), BC GPAC AF guideline 2023,
   ACC/AHA/ACCP/HRS 2023 AF guideline (10.10 acute medical illness) and the AHA 2023 statement on AF during acute hospitalization.
   Doses are typical adult starting doses: check against Island Health pharmacy / parenteral drug monograph before use. */
(function () {
  const r1 = (v) => Math.round(v * 10) / 10;

  /* Cockcroft-Gault, creatinine in umol/L, actual body weight (kg). mL/min */
  function crcl(age, kg, scr, sex) {
    if (!(age > 0 && kg > 0 && scr > 0)) return null;
    return Math.round(((140 - age) * kg * (sex === "female" ? 1.04 : 1.23)) / scr);
  }

  /* CCS algorithm (CHADS-65) for non-valvular AF */
  function chads65(f) {
    if (f.age >= 65) return { rec: "oac", why: "Age 65 or over" };
    const rf = [f.hf && "heart failure", f.htn && "hypertension", f.dm && "diabetes", f.stroke && "prior stroke/TIA"].filter(Boolean);
    if (rf.length) return { rec: "oac", why: "Under 65 with " + rf.join(", ") };
    if (f.vascular) return { rec: "antiplatelet", why: "Under 65, no CHADS2 risk factor, but coronary or peripheral artery disease" };
    return { rec: "none", why: "Under 65 with no risk factors" };
  }

  function chadsvasc(f) {
    const items = [];
    if (f.hf) items.push(["Heart failure / LV dysfunction", 1]);
    if (f.htn) items.push(["Hypertension", 1]);
    if (f.age >= 75) items.push(["Age 75 or over", 2]); else if (f.age >= 65) items.push(["Age 65-74", 1]);
    if (f.dm) items.push(["Diabetes", 1]);
    if (f.stroke) items.push(["Stroke / TIA / embolism", 2]);
    if (f.vascular) items.push(["Vascular disease (MI, PAD, aortic plaque)", 1]);
    if (f.sex === "female") items.push(["Female sex", 1]);
    return { score: items.reduce((a, x) => a + x[1], 0), items };
  }

  /* bleeding risk factors to modify (HAS-BLED style, not a score to withhold OAC) */
  function bleedFactors(f) {
    return [f.sbp > 160 && "Uncontrolled blood pressure (SBP over 160)", f.ckdSevere && "Severe kidney disease", f.liver && "Liver disease / cirrhosis",
      f.stroke && "Prior stroke", f.bleed && "Prior major bleeding", f.anemia && "Anemia (Hb under 100)", f.age > 65 && "Age over 65",
      f.antiplatelet && "Antiplatelet on the chart", f.nsaid && "NSAID on the chart", f.alcohol && "Alcohol use disorder", f.falls && "Falls (not a reason on its own to withhold OAC)"].filter(Boolean);
  }

  /* DOAC doses (Canadian monographs, non-valvular AF) */
  function apixaban(age, kg, scr, cl) {
    if (cl != null && cl < 15) return { dose: "Not recommended (CrCl under 15)", reduced: null };
    const n = [age >= 80 && "age 80 or over", kg != null && kg <= 60 && "weight 60 kg or less", scr != null && scr >= 133 && "creatinine 133 umol/L or more"].filter(Boolean);
    return n.length >= 2 ? { dose: "Apixaban 2.5 mg PO BID", reduced: true, why: "2 or more of: " + n.join(", ") } : { dose: "Apixaban 5 mg PO BID", reduced: false, why: n.length ? "Only 1 dose-reduction criterion (" + n[0] + ")" : "No dose-reduction criteria" };
  }
  function rivaroxaban(cl) {
    if (cl == null) return "Rivaroxaban: need creatinine clearance";
    if (cl < 15) return "Rivaroxaban: not recommended (CrCl under 15)";
    return cl < 50 ? "Rivaroxaban 15 mg PO daily with food (CrCl 15-49)" : "Rivaroxaban 20 mg PO daily with food";
  }

  /* digoxin: loading total and maintenance (typical, elderly-aware). onAmio halves maintenance. */
  function digoxin(age, kg, cl, onAmio) {
    const old = age >= 75, low = cl != null && cl < 30, small = kg != null && kg < 60;
    const total = low || (old && small) ? 0.5 : old || small ? 0.75 : 1.0;
    const load = total === 0.5 ? "0.25 mg IV, then 0.25 mg IV in 6 h (total 0.5 mg)" : total === 0.75 ? "0.25 mg IV q6h x 3 (total 0.75 mg)" : "0.5 mg IV, then 0.25 mg IV q6h x 2 (total 1 mg)";
    let maint = low ? 0.0625 : cl != null && cl < 50 || old ? 0.0625 : 0.125;
    const mText = (low ? "0.0625 mg PO daily or every other day" : maint === 0.0625 ? "0.0625 mg PO daily" : "0.125 mg PO daily") + (onAmio ? ", then HALVE it because of amiodarone" : "");
    return { total, load, maint: mText, why: [old && "age 75+", small && "weight under 60 kg", low ? "CrCl under 30" : cl != null && cl < 50 && "CrCl under 50"].filter(Boolean),
      level: "Trough level (6+ h after a dose) after about 5-7 days (longer if CrCl low): keep it under 1.2 ng/mL (1.5 nmol/L) (ESC 2024), aiming for the low end, 0.5-0.9 ng/mL (0.6-1.2 nmol/L), in older patients and heart failure. Check which unit your lab reports. Keep K 4.0 or more and Mg 0.8 or more." };
  }

  /* metoprolol / diltiazem doses, gentler in the elderly or borderline BP */
  function metoprolol(age, sbp) {
    const gentle = age >= 75 || (sbp != null && sbp < 110);
    return { iv: gentle ? "Metoprolol 2.5 mg IV over 2 min; repeat q5-10 min if SBP 100+, up to 10 mg" : "Metoprolol 2.5-5 mg IV over 2 min q5 min, up to 15 mg",
      po: gentle ? "Metoprolol tartrate 12.5 mg PO q6-12h, titrate up every 6-12 h (usual max 100 mg BID)" : "Metoprolol tartrate 25 mg PO q6-12h, titrate up (usual max 100 mg BID)",
      after: "Start oral within about 1 h of the last IV dose that worked; once stable, give the same total daily dose as a twice-daily dose." };
  }
  function diltiazem(age, kg, sbp) {
    const gentle = age >= 75 || (sbp != null && sbp < 110), mgkg = gentle ? 0.15 : 0.25, d = kg ? Math.min(Math.round((mgkg * kg) / 2.5) * 2.5, 20) : null;
    return { iv: `Diltiazem ${d != null ? d + " mg" : mgkg + " mg/kg"} IV over 2-10 min (${mgkg} mg/kg${gentle ? ", lower for age or BP" : ""}); may repeat once in 15 min at 0.35 mg/kg if needed and SBP holds`,
      po: gentle ? "Diltiazem 30 mg PO q6h, titrate to 60 mg q6h; switch to once-daily CD when stable" : "Diltiazem 30-60 mg PO q6h, titrate; switch to once-daily CD when stable" };
  }
  const AMIO = { iv: "Amiodarone 150 mg IV over 10 min (may repeat once), then 1 mg/min x 6 h, then 0.5 mg/min x 18 h (central line preferred; monitored bed per local policy)",
    po: "Oral load if continuing: 400 mg PO BID-TID to about 6-10 g total, then 200 mg daily (short course often enough in secondary AF)" };

  /* main assessment.
     s: { hr, sbp, unstable:{hypo,ischemia,edema,mentation}, preexc, lvefLow, lvefKnown, decompHF, bronchospasm, pressors, npo, onBB, homeBBheld, onDilt, onDig, onAmio,
          age, kg, sex, scr, cl, k, mg, onsetH (hours since AF started, null unknown), qtc, flutter, mat, sepsis, dry, anticoag } */
  function assess(s) {
    const out = { tier: "", headline: "", first: [], also: [], avoid: [], escalate: [], route: "", notes: [] };
    const unstable = s.unstable && (s.unstable.hypo || s.unstable.ischemia || s.unstable.edema || s.unstable.mentation);
    const lowBP = s.sbp != null && s.sbp < 90, bord = s.sbp != null && s.sbp >= 90 && s.sbp < 100;
    const M = metoprolol(s.age || 70, s.sbp), D = diltiazem(s.age || 70, s.kg, s.sbp), G = digoxin(s.age || 70, s.kg, s.cl, s.onAmio);

    if (s.preexc) {
      out.tier = "urgent"; out.headline = "Pre-excited AF (wide, very fast, irregular): no AV-node blockers";
      out.avoid.push({ a: "Beta-blocker, diltiazem/verapamil, digoxin, IV amiodarone", why: "Can speed conduction down the accessory pathway and cause VF" });
      out.first.push({ a: "Synchronized cardioversion if unstable; if stable, procainamide IV is the usual drug", why: "With cardiology/ICU" });
      out.escalate.push({ lvl: "now", t: "Cardiology and ICU/rapid response now" });
      return out;
    }
    if (unstable) {
      out.tier = "urgent"; out.headline = "Unstable: AF with " + [s.unstable.hypo && "hypotension/shock", s.unstable.ischemia && "ischemia", s.unstable.edema && "pulmonary edema", s.unstable.mentation && "reduced level of consciousness"].filter(Boolean).join(", ");
      out.first.push({ a: "Call rapid response / ICU. Synchronized cardioversion (120-200 J biphasic) if the instability is from the fast rate", why: "Rate over about 150 is more likely to be the cause; at 110-130 in septic shock the rate is usually the result, not the cause" });
      out.first.push({ a: AMIO.iv, why: "If cardioversion fails, AF comes back (common in sepsis), or while preparing. Does not drop BP as much as other agents" });
      out.also.push({ a: "Treat shock: fluids if fluid-responsive, vasopressor; correct K and Mg; oxygen", why: "In sepsis, AF often settles once the shock is treated" });
      out.avoid.push({ a: "IV diltiazem and IV metoprolol boluses", why: "Will drop BP further" });
      if (s.onsetH == null || s.onsetH >= 48) out.notes.push("AF 48 h or longer or unknown: give heparin around cardioversion if no bleeding contraindication.");
      out.escalate.push({ lvl: "now", t: "Rapid response / ICU now (hemodynamic instability)" });
      return out;
    }
    if (s.mat) {
      out.tier = "info"; out.headline = "Multifocal atrial tachycardia (not AF)";
      out.first.push({ a: "Treat the lung disease and hypoxia, correct K and Mg (IV magnesium sulfate 2 g)", why: "MAT is driven by the lung disease" });
      out.also.push({ a: "If rate control still needed: diltiazem (LVEF over 40) or cautious cardioselective beta-blocker", why: "" });
      out.avoid.push({ a: "Cardioversion, digoxin, amiodarone", why: "Do not work for MAT" });
      return out;
    }
    if (s.inSinus) {
      out.tier = "ok"; out.headline = "Back in sinus rhythm: treat the trigger, decide on anticoagulation, plan follow-up";
      out.first.push({ a: "No acute rate-control drug needed. Keep or restart a home beta-blocker if BP allows; a short course of low-dose beta-blocker is reasonable if AF keeps coming back", why: "AF in acute illness often recurs (AHA 2023): note it on the discharge summary" });
      return out;
    }
    if (s.hr != null && s.hr < 110) {
      out.tier = "ok"; out.headline = `Heart rate ${s.hr}: under 110 at rest is an acceptable target (lenient)`;
      out.first.push({ a: "No extra rate-control drug now. Keep treating the trigger and recheck", why: "RACE II lenient target under 110 at rest" });
      if (s.homeBBheld) out.also.push({ a: "Restart the home beta-blocker (lower dose if BP is borderline)", why: "Held beta-blockers cause rebound tachycardia" });
      return out;
    }

    out.tier = "treat"; out.headline = `AF with fast rate${s.hr ? " (" + s.hr + ")" : ""}: treat the trigger first, then control the rate`;
    if (s.sepsis || s.dry) out.notes.push("In sepsis or volume depletion a fast rate may be compensating. Give fluids if dry, treat fever and pain, then reassess before chasing the number.");
    const ivWanted = (s.hr != null && s.hr >= 130) || s.npo;
    out.route = ivWanted ? "IV first (rate 130+ or nil by mouth), then switch to oral" : "Oral is reasonable (rate 110-130 and taking pills); use IV if over 130, symptomatic, or not absorbing";

    const hfLow = s.lvefLow || s.decompHF;
    if (lowBP || s.pressors) {
      out.first.push({ a: AMIO.iv, why: "SBP under 90 or on vasopressors" + (s.onsetH != null && s.onsetH < 48 ? "" : ". May convert to sinus rhythm: stroke risk if AF 48 h or longer without anticoagulation") });
      out.also.push({ a: "Digoxin IV load: " + G.load, why: "Does not lower BP; slower onset (hours); weaker when adrenaline is high (sepsis)" });
      out.avoid.push({ a: "Diltiazem and metoprolol boluses", why: "Hypotension" });
      out.escalate.push({ lvl: "now", t: "SBP under 90 or vasopressors: ICU / step-down for IV amiodarone and monitoring" });
    } else if (hfLow) {
      if (s.decompHF || bord) {
        out.first.push({ a: "Digoxin IV load: " + G.load + "; maintenance " + G.maint, why: (s.decompHF ? "Decompensated heart failure" : "LVEF 40 or less with borderline BP") + ": digoxin does not weaken the heart or drop BP (CCS 2020)" });
        out.also.push({ a: "If still over 110-120 after loading: " + AMIO.iv, why: "IV amiodarone for LVEF 40 or less (CCS 2020)" });
      } else {
        out.first.push({ a: (ivWanted ? M.iv + ", then " : "") + M.po, why: "LVEF 40 or less but compensated and SBP 100+: low-dose beta-blocker is still the long-term agent (metoprolol, bisoprolol, carvedilol)" });
        out.also.push({ a: "Add digoxin if not enough: " + G.load + "; maintenance " + G.maint, why: "Combination works better than either alone in HFrEF" });
      }
      out.avoid.push({ a: "Diltiazem / verapamil", why: "Negative inotrope: avoid with LVEF 40 or less or heart failure" });
      out.escalate.push({ lvl: "today", t: "New or worse LVEF 40 or less or decompensated HF with fast AF: IM / cardiology input" });
    } else if (bord) {
      out.first.push({ a: "Digoxin IV load: " + G.load + "; maintenance " + G.maint, why: "SBP 90-99: does not lower BP" });
      out.also.push({ a: M.po, why: "Low-dose oral beta-blocker once SBP 100+ (or if on one at home)" });
      out.avoid.push({ a: "IV diltiazem", why: "Most BP-lowering of the options" });
    } else if (s.bronchospasm) {
      out.first.push({ a: (ivWanted ? D.iv + ", then " : "") + D.po, why: "Active bronchospasm and LVEF not known to be low: diltiazem does not tighten the airways" + (s.lvefKnown ? "" : ". LVEF unknown: check for heart failure signs or POCUS before using diltiazem") });
      out.also.push({ a: "Cardioselective beta-blocker (metoprolol, bisoprolol) at low dose if diltiazem not suitable", why: "COPD is not a contraindication; avoid non-selective beta-blockers" });
    } else {
      out.first.push({ a: (ivWanted ? M.iv + ", then " : "") + M.po, why: "No heart failure, BP fine: beta-blocker or diltiazem are first line (CCS 2020); beta-blocker preferred if ischemic heart disease or on one at home" });
      out.also.push({ a: "Equal alternative: " + (ivWanted ? D.iv + ", then " : "") + D.po, why: s.lvefKnown ? "LVEF over 40" : "Only if LVEF is not low (no HF signs / POCUS or echo)" });
      out.also.push({ a: "Add-on if partial response: digoxin " + G.load + "; maintenance " + G.maint, why: "Adds rate control at rest; slow (hours); weaker in sepsis" });
    }
    if (s.onBB && s.onDilt) out.notes.push("Already on a beta-blocker AND diltiazem: watch for bradycardia and heart block, especially once the infection settles and the rate falls.");
    if (s.onDig) out.notes.push("Already on digoxin: check a level, K, Mg and creatinine before more.");
    if (s.homeBBheld) out.notes.push("Home beta-blocker held: restarting it (lower dose if BP borderline) is often the simplest fix.");
    if (s.flutter) out.notes.push("Flutter (regular, about 150): rate control is harder; cardiology for cardioversion or ablation if it persists.");

    /* escalation */
    if (s.hr >= 140) out.escalate.push({ lvl: "today", t: "Rate 140 or more despite treating the trigger: IM consult (or the hospitalist on call above you) the same day" });
    out.escalate.push({ lvl: "today", t: "Still over 110-120 after 2 agents at adequate doses, or IV boluses needed more than every 4-6 h: IM consult; needs a monitored bed if a diltiazem or amiodarone infusion is planned" });
    out.escalate.push({ lvl: "today", t: "Chest pain with ischemic ECG changes or a rising troponin pattern (not a flat low-level rise), syncope, pauses or slow rate after treatment (tachy-brady): cardiology" });
    out.escalate.push({ lvl: "later", t: "Rhythm control wanted (still symptomatic despite rate control, AF over 48 h): cardiology for cardioversion and TEE; anticoagulation needed first" });
    return out;
  }

  /* anticoagulation advice for AF found during acute illness */
  function anticoag(f, af) {
    const c = chads65(f), v = chadsvasc(f), a = [];
    const hours = af.durationH, persisting = af.ongoing;
    if (f.mechValve || f.mitralStenosis) a.push("Mechanical valve or moderate/severe mitral stenosis: warfarin (not a DOAC). Discuss with cardiology.");
    if (c.rec !== "oac") a.push(c.rec === "antiplatelet" ? "CCS algorithm: antiplatelet only (vascular disease), no OAC for AF." : "CCS algorithm: no antithrombotic for AF.");
    else if (persisting && (hours == null || hours >= 48)) a.push("AF still present 48 h or more (or unknown) and CHADS-65 positive: start therapeutic anticoagulation in hospital if no bleeding contraindication (DOAC preferred). Stop prophylactic heparin when it starts.");
    else if (persisting) a.push("AF under 48 h and CHADS-65 positive: keep VTE prophylaxis; if AF persists to 48 h or recurs, start therapeutic anticoagulation.");
    else a.push("AF has stopped and was driven by the acute illness: the stroke risk is real (recurrence is common), but the long-term OAC decision can be made at follow-up with rhythm monitoring (ACC/AHA 2023, 10.10). Many start OAC before discharge if CHADS-65 positive and bleeding risk is acceptable: document the discussion.");
    if (af.rhythmControl) a.push("Before cardioversion or amiodarone with AF 48 h or longer or unknown: 3 weeks of OAC or a TEE first (unless an emergency).");
    return { chads65: c, cv: v, advice: a, bleed: bleedFactors(f), apix: apixaban(f.age, f.kg, f.scr, f.cl), riva: rivaroxaban(f.cl) };
  }

  /* drug interaction / QT checks */
  const QT = /azithromycin|clarithromycin|erythromycin|levofloxacin|moxifloxacin|ciprofloxacin|ondansetron|haloperidol|quetiapine|olanzapine|citalopram|escitalopram|methadone|domperidone|hydroxychloroquine|fluconazole|sotalol|trazodone/i;
  function interactions(meds, s) {
    const has = (re) => meds.filter((m) => re.test(m));
    const out = [], qt = has(QT), cyp = has(/clarithromycin|erythromycin|ketoconazole|itraconazole|voriconazole|posaconazole|ritonavir|nirmatrelvir/i);
    const ind = has(/rifampin|rifampicin|carbamazepine|phenytoin|phenobarbital|st\.? john/i), ago = has(/salbutamol|albuterol|ventolin|terbutaline|formoterol|salmeterol|theophylline|aminophylline/i);
    if (qt.length) out.push({ lvl: s.qtc >= 500 ? "urgent" : "action", t: `QT-prolonging drugs: ${uniq(qt).join(", ")}${s.qtc ? " (QTc " + s.qtc + ")" : ""}. Amiodarone adds to this; check QTc daily if combined, keep K 4.0+ and Mg 1.0+. For pneumonia consider doxycycline instead of azithromycin or a fluoroquinolone if QTc is long.` });
    if (cyp.length) out.push({ lvl: "action", t: `${uniq(cyp).join(", ")} raise levels of DOACs, digoxin, diltiazem and amiodarone (CYP3A4 / P-gp). Clarithromycin + digoxin can cause toxicity.` });
    if (ind.length) out.push({ lvl: "action", t: `${uniq(ind).join(", ")} lower DOAC levels: avoid DOACs with strong inducers (rifampin, carbamazepine, phenytoin).` });
    if (ago.length) out.push({ lvl: "info", t: `Beta-agonist / theophylline (${uniq(ago).join(", ")}) speed up the heart: use regular ipratropium instead of frequent salbutamol where possible; check theophylline level.` });
    if (s.onAmio && has(/warfarin/i).length) out.push({ lvl: "action", t: "Amiodarone + warfarin: INR rises within 1-2 weeks; cut warfarin by about 30-50% and check INR often." });
    if (s.onAmio && has(/simvastatin|lovastatin/i).length) out.push({ lvl: "info", t: "Amiodarone + simvastatin: limit simvastatin to 20 mg (or switch statin)." });
    if (has(/digoxin/i).length && (s.onAmio || has(/diltiazem|verapamil/i).length)) out.push({ lvl: "action", t: "Digoxin with amiodarone, diltiazem or verapamil: digoxin level rises (amiodarone about doubles it): halve the digoxin dose and check a level." });
    if (has(/apixaban|rivaroxaban|edoxaban|dabigatran|warfarin/i).length && has(/aspirin|\basa\b|clopidogrel|ticagrelor|prasugrel/i).length) out.push({ lvl: "info", t: "Anticoagulant plus antiplatelet: is the antiplatelet still needed (stent in the last 12 months)? If not, stopping it lowers bleeding risk." });
    if (has(/apixaban|rivaroxaban|edoxaban|dabigatran|warfarin/i).length && has(/enoxaparin|dalteparin|tinzaparin|heparin/i).length) out.push({ lvl: "action", t: "Anticoagulant AND heparin both on the chart: make sure there is no double anticoagulation." });
    return out;
  }
  const uniq = (a) => [...new Set(a.map((x) => x.split(/\s+/)[0]))];

  /* workup checklist given facts. chart: {k, mg, tsh, trop, bnp, hb, cr, lft, inr, dig, lactate, echoDone} values or null */
  function workup(c, s) {
    const L = [];
    const add = (t, have, why) => L.push({ t, have, why });
    add("12-lead ECG: confirm AF (not flutter, MAT or sinus tachycardia), look for pre-excitation, ischemia, QTc", !!s.ecgDone, "Also repeat when the rate settles");
    add("Potassium (aim 4.0 or more)", c.k, c.k && c.k.v < 4 ? "LOW: replace" : "");
    add("Magnesium (aim 0.8-1.0 or more)", c.mg, c.mg && c.mg.v < 0.8 ? "LOW: give magnesium sulfate 2-4 g IV (also helps rate control)" : "IV magnesium 2 g is reasonable even if normal-low");
    add("Creatinine / CrCl", c.cr, "For digoxin and DOAC dosing");
    add("CBC (Hb, platelets)", c.hb, c.hb && c.hb.v < 100 ? "Anemia: bleeding? affects rate and anticoagulation" : "");
    add("TSH (free T4 if abnormal)", c.tsh, c.tsh && c.tsh.v < 0.1 ? "LOW TSH: check free T4 (sick euthyroid or hyperthyroid; amiodarone also affects it)" : "Once; interpret cautiously in acute illness");
    add("Troponin", c.trop, "Only if chest pain or ischemic ECG changes: a small flat rise is common in sepsis and fast AF");
    add("BNP / NT-proBNP", c.bnp, "If heart failure is suspected (low value helps rule it out)");
    add("Lactate, blood cultures, gas", c.lactate, "If septic");
    add("Liver enzymes, TSH baseline", c.lft, "Before amiodarone");
    add("INR", c.inr, "Before anticoagulation, liver disease");
    if (s.onDig) add("Digoxin level", c.dig, "On digoxin");
    add("Echo (TTE)", s.echoDone, "In hospital if heart failure signs, murmur, or rhythm control / amiodarone planned; otherwise as outpatient (LV function, valves, atrial size)");
    add("Chest X-ray", true, "Pneumonia, effusion, edema (usually done)");
    add("Consider PE", null, "Immobile older patient with unexplained hypoxia or tachycardia out of keeping with the pneumonia: Wells / CTPA");
    return L;
  }

  const api = { crcl, chads65, chadsvasc, bleedFactors, apixaban, rivaroxaban, digoxin, metoprolol, diltiazem, AMIO, assess, anticoag, interactions, workup, QT, r1 };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else window.AFRules = api;
})();
