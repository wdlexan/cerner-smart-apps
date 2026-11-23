/* NSTEMI (NSTE-ACS) medical treatment and revascularization: pure decision rules. No chart access here, so it can be tested with node.
   UNVERIFIED DRAFT written by Claude from: 2025 ACC/AHA/ACEP/NAEMSP/SCAI ACS guideline; 2023 ESC ACS guideline; 2021 ACC/AHA/SCAI coronary
   revascularization guideline; 2018 ESC/EACTS myocardial revascularization guideline; CCS/CAIC 2023 antiplatelet focused update;
   Fourth Universal Definition of MI (2018); ARC-HBR (Urban, Circulation 2019); GRACE (Granger, Arch Intern Med 2003); TIMI (Antman, JAMA 2000);
   CCS 2021 dyslipidemia guideline. Doses are typical adult doses: check against Island Health pharmacy and cardiology before use. */
(function () {
  const r0 = (v) => Math.round(v), r1 = (v) => Math.round(v * 10) / 10;

  /* ---------- Cockcroft-Gault CrCl (mL/min), creatinine in umol/L ---------- */
  function crcl(age, kg, scr, sex) {
    if (!(age > 0 && kg > 0 && scr > 0)) return null;
    return r0(((140 - age) * kg * (/^f/i.test(sex || "") ? 1.04 : 1.23)) / scr);
  }

  /* ---------- troponin pattern ---------- */
  // series: [{t, v}] in ng/L, oldest first. url = 99th percentile upper reference limit of the assay.
  function tropPattern(series, url) {
    if (!series || !series.length) return { kind: "none", text: "No troponin found: send a high-sensitivity troponin now and repeat at 1-3 h (assay pathway)" };
    url = url || 26;
    const first = series[0], last = series[series.length - 1], peak = series.reduce((a, x) => (x.v > a.v ? x : a), series[0]);
    const low = series.reduce((a, x) => (x.v < a.v ? x : a), series[0]);
    const above = peak.v > url, n = series.length;
    if (n === 1) return { kind: above ? "single-high" : "single-normal", peak, first, last, text: above ? `One value (${first.v}) above the 99th percentile (${url}): repeat to see a rise or fall` : `One value (${first.v}) at or under ${url}: repeat per the 0/1-3 h pathway; one normal value early after pain onset does not rule out MI` };
    const deltaAbs = peak.v - low.v, deltaPct = low.v > 0 ? r0((deltaAbs / low.v) * 100) : 999;
    const rising = last.v > first.v;
    if (!above) return { kind: "normal", peak, first, last, deltaAbs, deltaPct, text: `All values at or under ${url}: no myocardial injury. Not an MI (unstable angina still possible if the story fits)` };
    // dynamic change: at least 20% when baseline is elevated (4th UDMI) and a meaningful absolute change (5 ng/L or more for hs assays)
    const dynamic = deltaPct >= 20 && deltaAbs >= 5;
    if (!dynamic) return { kind: "chronic", peak, first, last, deltaAbs, deltaPct, text: `Above ${url} but stable (change ${deltaPct}%): chronic myocardial injury pattern (CKD, HF, LVH, AS, amyloid). Not an acute MI on its own` };
    return { kind: "acute", rising, peak, first, last, deltaAbs, deltaPct, text: `Acute myocardial injury: ${rising ? "rise" : "rise and fall"} from ${low.v} to ${peak.v} ng/L (${deltaPct}% change) with at least one value above ${url}` };
  }

  /* ---------- Type 1 vs type 2 MI vs injury (4th Universal Definition) ---------- */
  // o: { trop (tropPattern result), symptoms, ecgIschemia, newWMA, angioThrombus, triggers: [text], knownCAD }
  function mitype(o) {
    const t = o.trop || {}, trig = o.triggers || [], isch = [];
    if (o.symptoms) isch.push("ischemic symptoms"); if (o.ecgIschemia) isch.push("new ischemic ECG changes"); if (o.newWMA) isch.push("new wall-motion abnormality"); if (o.angioThrombus) isch.push("thrombus / culprit lesion on angiography");
    const acute = t.kind === "acute" || t.kind === "single-high";
    if (t.kind === "normal") return { kind: "noMI", label: "No myocardial injury", dapt: false, text: "Troponin not raised: not an MI. If the story is anginal, this may be unstable angina: discuss with cardiology; otherwise look for another cause.", isch, trig };
    if (t.kind === "none" || t.kind === "single-normal") return { kind: "pending", label: "Troponin incomplete", dapt: null, text: "Need serial troponins before calling this an MI.", isch, trig };
    if (t.kind === "chronic") return { kind: "chronic", label: "Chronic myocardial injury", dapt: false, text: "Stable raised troponin: chronic injury. No ACS treatment unless symptoms and ECG point to ACS (then repeat troponin and discuss).", isch, trig };
    if (!isch.length) return { kind: "injury", label: "Acute myocardial injury (not MI)", dapt: false, text: "Troponin is rising or falling but there is no evidence of ischemia: acute non-ischemic myocardial injury (sepsis, PE, myocarditis, HF, renal, stroke, contusion). Treat the cause. No DAPT or cath for this alone.", isch, trig };
    if (o.angioThrombus) return { kind: "t1", label: "Type 1 MI (NSTEMI)", dapt: true, text: "Thrombus or culprit plaque on angiography: type 1 MI.", isch, trig };
    if (trig.length && !o.ecgIschemia && !o.newWMA) return { kind: "t2", label: "Probable type 2 MI", dapt: false, text: `Supply/demand mismatch (${trig.join(", ")}) with ischemic evidence limited to symptoms or troponin: favours type 2 MI. Treat the trigger. DAPT and urgent cath are NOT indicated for type 2 MI; aspirin only if known CAD. Arrange outpatient ischemia testing / echo if CAD is suspected.`, isch, trig };
    if (trig.length) return { kind: "uncertain", label: "Type 1 or type 2: unclear", dapt: null, text: `Ischemic changes (${isch.join(", ")}) AND a supply/demand trigger (${trig.join(", ")}). Treat the trigger first; if ECG changes, wall-motion abnormality or symptoms persist after it is corrected, treat as type 1 and discuss with cardiology. A significant trigger does not exclude plaque rupture.`, isch, trig };
    return { kind: "t1", label: "Probable type 1 MI (NSTEMI)", dapt: true, text: `Acute troponin rise with ${isch.join(", ")} and no clear supply/demand trigger: treat as type 1 NSTEMI.`, isch, trig };
  }

  /* ---------- GRACE (in-hospital death, Granger 2003) ---------- */
  // creatinine in umol/L; killip 1-4; arrest, stDev, enz booleans
  const band = (v, cuts, pts) => { for (let i = 0; i < cuts.length; i++) if (v < cuts[i]) return pts[i]; return pts[pts.length - 1]; };
  function grace(o) {
    const miss = [];
    ["age", "hr", "sbp", "cr"].forEach((k) => { if (o[k] == null) miss.push(k); });
    if (miss.length) return { score: null, miss };
    const crMg = o.cr / 88.4;
    const items = [
      ["Age " + o.age, band(o.age, [30, 40, 50, 60, 70, 80, 90], [0, 8, 25, 41, 58, 75, 91, 100])],
      ["HR " + o.hr, band(o.hr, [50, 70, 90, 110, 150, 200], [0, 3, 9, 15, 24, 38, 46])],
      ["SBP " + o.sbp, band(o.sbp, [80, 100, 120, 140, 160, 200], [58, 53, 43, 34, 24, 10, 0])],
      ["Creatinine " + r0(o.cr), band(crMg, [0.4, 0.8, 1.2, 1.6, 2.0, 4.0], [1, 4, 7, 10, 13, 21, 28])],
      ["Killip " + (o.killip || 1), [0, 0, 20, 39, 59][o.killip || 1]]];
    if (o.arrest) items.push(["Cardiac arrest at admission", 39]);
    if (o.stDev) items.push(["ST deviation", 28]);
    if (o.enz !== false) items.push(["Raised troponin", 14]);
    const score = items.reduce((a, x) => a + x[1], 0);
    const risk = score <= 108 ? "low" : score <= 140 ? "intermediate" : "high";
    return { score, items, risk, text: `GRACE ${score}: ${risk} risk (in-hospital death ${risk === "low" ? "under 1%" : risk === "intermediate" ? "1-3%" : "over 3%"})` };
  }

  /* ---------- TIMI UA/NSTEMI ---------- */
  function timi(o) {
    const items = [];
    if (o.age >= 65) items.push("Age 65+"); if ((o.rf || 0) >= 3) items.push("3+ CAD risk factors"); if (o.knownCAD) items.push("Known CAD (stenosis 50%+)");
    if (o.asa7) items.push("Aspirin in the past 7 days"); if (o.angina2) items.push("2+ angina episodes in 24 h"); if (o.stDev) items.push("ST deviation 0.5 mm+"); if (o.enz) items.push("Raised troponin");
    const score = items.length, risk14 = [4.7, 4.7, 8.3, 13.2, 19.9, 26.2, 40.9, 40.9][score];
    return { score, items, text: `TIMI ${score}/7: about ${risk14}% death, MI or urgent revascularization at 14 days` };
  }

  /* ---------- Invasive strategy and timing ---------- */
  // o: { type (mitype kind), veryHigh: {shock, refractory, arrhythmia, mech, ahf, stElevIntermittent}, dynamicST, transientSTE, grace, frail (CFS), dementia, lifeLimited, declines, activeBleed, age }
  function invasive(o) {
    const vh = o.veryHigh || {}, vhList = [];
    if (vh.shock) vhList.push("hemodynamic instability or cardiogenic shock"); if (vh.refractory) vhList.push("recurrent or refractory chest pain despite medical treatment");
    if (vh.arrhythmia) vhList.push("life-threatening arrhythmia or cardiac arrest"); if (vh.mech) vhList.push("mechanical complication (new murmur: MR, VSD)");
    if (vh.ahf) vhList.push("acute heart failure from ongoing ischemia"); if (vh.stElevIntermittent) vhList.push("recurrent dynamic or intermittent ST elevation");
    const against = [];
    if (o.frail >= 7) against.push(`Clinical Frailty Scale ${o.frail}`); if (o.dementia) against.push("moderate-severe dementia");
    if (o.lifeLimited) against.push("limited life expectancy / comfort-focused goals"); if (o.declines) against.push("patient declines invasive care");
    if (o.activeBleed) against.push("active bleeding (cath and DAPT risk)");
    const res = { tier: "", when: "", why: [], against, notes: [] };
    if (o.type === "t2" || o.type === "injury" || o.type === "chronic" || o.type === "noMI") {
      res.tier = "none"; res.when = "No urgent cath for this troponin pattern"; res.why.push("Not a type 1 MI. Treat the cause; consider outpatient ischemia testing or echo if CAD is suspected.");
      if (vhList.length) { res.tier = "immediate"; res.when = "But: very high-risk features present: call cardiology now"; res.why = vhList; }
      return res;
    }
    if (vhList.length) { res.tier = "immediate"; res.when = "IMMEDIATE invasive strategy (cath within 2 h): call cardiology / CCU now"; res.why = vhList; }
    else if (o.dynamicST || o.transientSTE || (o.grace != null && o.grace > 140) || o.type === "t1") {
      res.tier = "early"; res.when = "EARLY invasive strategy (cath within 24 h)";
      if (o.type === "t1") res.why.push("Confirmed NSTEMI (ESC 2023: early invasive for all NSTEMI)");
      if (o.dynamicST) res.why.push("Dynamic ST or T-wave changes"); if (o.transientSTE) res.why.push("Transient ST elevation");
      if (o.grace != null && o.grace > 140) res.why.push(`GRACE ${o.grace} (over 140)`);
    } else if (o.type === "uncertain" || o.type === "pending") {
      res.tier = "selective"; res.when = "Decide after the trigger is treated and troponins are complete";
      res.why.push("Type of MI not settled yet. If ischemia persists after correcting the trigger, or troponin keeps rising with ECG changes, treat as type 1 (cath this admission).");
    } else { res.tier = "inpatient"; res.when = "Invasive strategy during this admission (or selective, after non-invasive testing)"; res.why.push("Intermediate or low risk"); }
    if (against.length && res.tier !== "none") res.notes.push(`Reasons to discuss a conservative (medical) approach: ${against.join(", ")}. Shared decision with the patient/family and cardiology.`);
    if (o.age >= 75 && res.tier !== "none") res.notes.push("Age 75+: invasive care is still reasonable for most; in SENIOR-RITA (NEJM 2024, age 75+ NSTEMI) a routine invasive strategy reduced later MI and urgent revascularization but not CV death. Frailty and goals matter more than age.");
    return res;
  }

  /* ---------- Revascularization: PCI vs CABG (after angiography) ---------- */
  // o: { anatomy: none|minoca|1v|2v|3v|lm, proxLAD, syntax, dm, lvef (number), complexPCI (CTO, heavy calcium, bifurcation), surgRisk: [text], valveSurgery, culpritPCIdone }
  function revasc(o) {
    const out = { rec: "", tone: "", why: [], heart: false, notes: [] };
    const sr = o.surgRisk || [], highSurg = sr.length >= 2 || sr.some((x) => /prohibitive|porcelain|frailty 7|STS 8/i.test(x));
    const lowEF = o.lvef != null && o.lvef <= 35, sx = o.syntax;
    switch (o.anatomy) {
      case "unknown": case undefined: case "": out.rec = "Angiography not done yet"; out.tone = "info"; out.why.push("PCI vs CABG is decided after angiography by the cath team (heart team for left main or multivessel disease)."); return out;
      case "minoca": out.rec = "No obstructive CAD (MINOCA): no stent or bypass"; out.tone = "info";
        out.why.push("Work up the cause: cardiac MRI (myocarditis, takotsubo, MI with non-obstructive arteries), consider spasm, SCAD (review the films), embolism/thrombophilia, PE.");
        out.why.push("DAPT is not automatic: aspirin + statin if atherosclerotic plaque or plaque disruption; ACEi/ARB, beta-blocker as indicated. Decide with cardiology."); return out;
      case "1v": out.rec = o.proxLAD ? "PCI (or CABG with LIMA if anatomy is complex)" : "PCI (culprit lesion), usually at the time of angiography"; out.tone = "pci";
        out.why.push(o.proxLAD ? "Single-vessel proximal LAD: PCI and CABG are both reasonable; PCI usually chosen." : "Single-vessel disease: PCI of the culprit lesion."); break;
      case "2v": out.rec = o.proxLAD && (o.dm || lowEF) ? "Heart team: CABG or PCI" : "PCI (culprit, then complete revascularization)"; out.tone = o.proxLAD && (o.dm || lowEF) ? "both" : "pci";
        out.why.push(o.proxLAD ? "Two-vessel disease with proximal LAD: CABG or PCI (ESC class I for both); CABG favoured with diabetes or low EF." : "Two-vessel disease without proximal LAD: PCI favoured.");
        out.heart = !!(o.proxLAD && (o.dm || lowEF)); break;
      case "3v": out.heart = true;
        if (o.dm) { out.rec = "CABG favoured (diabetes + 3-vessel disease)"; out.tone = "cabg"; out.why.push("FREEDOM: CABG lowered death and MI vs PCI in diabetes with multivessel CAD (ACC/AHA class I)."); }
        else if (sx != null && sx > 22) { out.rec = "CABG favoured (SYNTAX over 22)"; out.tone = "cabg"; out.why.push(`SYNTAX ${sx}: intermediate/high complexity; CABG has better long-term outcomes (SYNTAX trial).`); }
        else if (sx != null) { out.rec = "PCI or CABG (SYNTAX 22 or less)"; out.tone = "both"; out.why.push(`SYNTAX ${sx}: low complexity, PCI and CABG similar.`); }
        else { out.rec = "Heart team: CABG often favoured"; out.tone = "both"; out.why.push("3-vessel disease: SYNTAX score needed (ask the cath report); CABG favoured if SYNTAX over 22 or complex."); }
        break;
      case "lm": out.heart = true;
        if (sx == null) { out.rec = "Heart team: CABG favoured (left main)"; out.tone = "cabg"; out.why.push("Left main disease: CABG is class I; PCI reasonable if low-intermediate anatomic complexity (SYNTAX 32 or less)."); }
        else if (sx <= 22) { out.rec = "PCI or CABG (left main, low SYNTAX)"; out.tone = "both"; out.why.push(`SYNTAX ${sx}: PCI and CABG similar (EXCEL, NOBLE: more repeat revascularization with PCI).`); }
        else if (sx <= 32) { out.rec = "CABG favoured, PCI reasonable (left main, SYNTAX 23-32)"; out.tone = "cabg"; out.why.push(`SYNTAX ${sx}.`); }
        else { out.rec = "CABG (left main, SYNTAX over 32)"; out.tone = "cabg"; out.why.push(`SYNTAX ${sx}: PCI not recommended.`); }
        break;
    }
    if (lowEF && (o.anatomy === "2v" || o.anatomy === "3v" || o.anatomy === "lm")) { out.why.push(`LVEF ${o.lvef}% with multivessel disease: CABG improves long-term survival (STICH/STICHES).`); if (out.tone === "pci" || out.tone === "both") { out.tone = "cabg"; out.rec = "CABG favoured (LVEF 35% or less, multivessel)"; } out.heart = true; }
    if (o.complexPCI && out.tone !== "cabg") out.why.push("Complex lesions (CTO, heavy calcium, bifurcation): lean toward CABG if surgical risk is acceptable.");
    if (o.valveSurgery) { out.why.push("Needs valve or aortic surgery too: combined CABG + valve surgery."); out.tone = "cabg"; out.rec = "CABG with the valve operation"; out.heart = true; }
    if (highSurg && (out.tone === "cabg" || out.tone === "both")) out.notes.push(`High surgical risk (${sr.join(", ")}): PCI or medical therapy may be preferred even when anatomy favours CABG. STS score and heart team.`);
    else if (sr.length) out.notes.push(`Surgical risk factors to weigh: ${sr.join(", ")}.`);
    if (o.culpritPCIdone && (o.anatomy === "2v" || o.anatomy === "3v")) out.notes.push("Culprit already stented: complete revascularization of other significant lesions (staged PCI, during or soon after admission) is recommended (2025 ACC/AHA).");
    if (o.anatomy !== "1v") out.notes.push("Radial access preferred for PCI. Patient preference counts after a balanced heart-team discussion.");
    return out;
  }

  /* ---------- ARC-HBR high bleeding risk ---------- */
  // o: { age, egfr, hb, sex, plt, oac, priorBleed6mo, priorBleed12mo, cirrhosisPH, cancer, ich, stroke, nsaidSteroid, surgery30, plannedSurgery, bleedDiathesis }
  function hbr(o) {
    const major = [], minor = [];
    if (o.oac) major.push("long-term oral anticoagulant");
    if (o.egfr != null && o.egfr < 30) major.push(`eGFR ${o.egfr} (under 30)`); else if (o.egfr != null && o.egfr < 60) minor.push(`eGFR ${o.egfr} (30-59)`);
    if (o.hb != null && o.hb < 110) major.push(`Hb ${o.hb} (under 110)`); else if (o.hb != null && o.hb < (/^f/i.test(o.sex || "") ? 120 : 130)) minor.push(`Hb ${o.hb} (mild anemia)`);
    if (o.plt != null && o.plt < 100) major.push(`platelets ${o.plt} (under 100)`);
    if (o.priorBleed6mo) major.push("bleed needing admission or transfusion in the past 6 months"); else if (o.priorBleed12mo) minor.push("bleed needing admission or transfusion in the past 12 months");
    if (o.bleedDiathesis) major.push("chronic bleeding disorder");
    if (o.cirrhosisPH) major.push("cirrhosis with portal hypertension");
    if (o.cancer) major.push("active cancer (past 12 months)");
    if (o.ich) major.push("prior intracranial hemorrhage / brain AVM");
    if (o.stroke) minor.push("prior ischemic stroke");
    if (o.surgery30 || o.plannedSurgery) major.push(o.plannedSurgery ? "major surgery that cannot wait while on DAPT" : "major surgery or trauma in the past 30 days");
    if (o.age >= 75) minor.push("age 75+");
    if (o.nsaidSteroid) minor.push("long-term NSAID or steroid");
    const isHBR = major.length >= 1 || minor.length >= 2;
    return { isHBR, major, minor, text: isHBR ? `HIGH BLEEDING RISK (ARC-HBR: ${major.length} major, ${minor.length} minor)` : `Not high bleeding risk by ARC-HBR (${major.length} major, ${minor.length} minor)` };
  }

  /* ---------- PRECISE-DAPT (Costa, Lancet 2017): bleeding risk at PCI / discharge ---------- */
  // age y, crcl mL/min (Cockcroft-Gault), hb g/L, wbc x10^9/L, priorBleed = prior spontaneous bleeding. Official calculator equation:
  // score = 100/5.52784356 * [0.02595618(age-50) - 0.0140439(CrCl-100) - 0.40551264(Hb g/dL-12) + 0.05697497(WBC-5) + 1.41955653(prior bleed)]
  // with age clamped 50-90, CrCl 0-100, Hb 10-12 g/dL, WBC 5-20; total 0-100.
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  function preciseDapt(o) {
    const miss = []; ["age", "crcl", "hb", "wbc"].forEach((k) => { if (o[k] == null) miss.push(k); });
    if (miss.length) return { score: null, miss };
    const k = 100 / 5.52784356, hbdl = o.hb / 10;
    const parts = [
      ["Age " + o.age, 0.02595618 * (clamp(o.age, 50, 90) - 50) * k],
      ["CrCl " + Math.round(o.crcl), -0.0140439 * (clamp(o.crcl, 0, 100) - 100) * k],
      ["Hb " + Math.round(o.hb) + " g/L", -0.40551264 * (clamp(hbdl, 10, 12) - 12) * k],
      ["WBC " + o.wbc, 0.05697497 * (clamp(o.wbc, 5, 20) - 5) * k],
      ["Prior spontaneous bleeding", o.priorBleed ? 1.41955653 * k : 0]];
    const raw = parts.reduce((a, x) => a + x[1], 0), score = Math.min(100, r0(raw));
    parts.forEach((x) => (x[1] = r1(x[1]))); // shown to 1 decimal; the total is rounded once
    const high = score >= 25;
    return { score, parts, high, text: `PRECISE-DAPT ${score}: ${high ? "high bleeding risk (25 or more): short DAPT (3-6 months) favoured" : "under 25: standard (12 months) or longer DAPT acceptable"}` };
  }

  /* ---------- DAPT score (Yeh, JAMA 2016): extend past 12 months? ---------- */
  // Use at about 12 months after PCI in a patient with no major bleed or ischemic event on DAPT.
  function daptScore(o) {
    const items = [];
    if (o.age >= 75) items.push(["Age 75+", -2]); else if (o.age >= 65) items.push(["Age 65-74", -1]);
    if (o.smoker) items.push(["Current smoker", 1]); if (o.dm) items.push(["Diabetes", 1]); if (o.miPresent) items.push(["MI at presentation", 1]);
    if (o.priorMIPCI) items.push(["Prior PCI or prior MI", 1]); if (o.paclitaxel) items.push(["Paclitaxel-eluting stent", 1]); if (o.small) items.push(["Stent diameter under 3 mm", 1]);
    if (o.chf) items.push(["CHF or LVEF under 30%", 2]); if (o.veinGraft) items.push(["Vein graft PCI", 2]);
    const score = items.reduce((a, x) => a + x[1], 0);
    return { score, items, extend: score >= 2, text: `DAPT score ${score}: ${score >= 2 ? "2 or more: benefit of continuing DAPT past 12 months likely outweighs bleeding (fewer MI and stent thrombosis)" : "under 2: stop the P2Y12 inhibitor at 12 months (more bleeding, little ischemic benefit)"}` };
  }

  /* ---------- P2Y12 choice ---------- */
  // o: { type, oac, ich, strokeTIA, age, kg, activeBleed, cyp3a4strong: [], avBlock, dialysis, hbr, managed: pci|cabg|medical|pending, anatomyKnown }
  function p2y12(o) {
    const out = { pick: "", load: "", maint: "", why: [], avoid: [], timing: "" };
    if (o.type === "t2" || o.type === "injury" || o.type === "chronic" || o.type === "noMI") { out.pick = "None"; out.why.push("Not a type 1 MI: no P2Y12 inhibitor. Aspirin alone only if known CAD."); return out; }
    if (o.activeBleed) { out.pick = "Hold"; out.why.push("Active bleeding: hold antiplatelets other than aspirin (if bleeding allows) and discuss with cardiology/GI."); return out; }
    const tic = { ok: true, why: [] }, pra = { ok: true, why: [] };
    if (o.ich) { tic.ok = pra.ok = false; tic.why.push("prior intracranial hemorrhage"); pra.why.push("prior intracranial hemorrhage"); }
    if (o.strokeTIA) { pra.ok = false; pra.why.push("prior stroke/TIA (TRITON: net harm)"); }
    if (o.oac) { tic.ok = pra.ok = false; tic.why.push("on an oral anticoagulant: clopidogrel is the P2Y12 of choice with OAC"); pra.why.push("on an oral anticoagulant"); }
    if (o.cyp3a4strong && o.cyp3a4strong.length) { tic.ok = false; tic.why.push(`strong CYP3A4 drug: ${o.cyp3a4strong.join(", ")}`); }
    if (o.avBlock) tic.why.push("caution: high-grade AV block or sick sinus without pacemaker (bradyarrhythmia)");
    if (o.dialysis) tic.why.push("caution: dialysis (little trial data)");
    if (o.age >= 75) pra.why.push("age 75+: not recommended (5 mg only if high risk and no alternative)");
    if (o.kg != null && o.kg < 60) pra.why.push("weight under 60 kg: 5 mg daily maintenance");
    if (o.managed === "medical") { pra.ok = false; pra.why.push("medically managed (TRILOGY: no benefit)"); }
    if (!o.anatomyKnown && o.managed !== "pci") { pra.why.push("NSTE-ACS: prasugrel only once coronary anatomy is known and PCI is planned"); }
    const CLOP = { pick: "Clopidogrel", load: "300-600 mg PO once (600 mg if going for PCI; 300 mg if age 75+ and medically managed, some use 75 mg with OAC)", maint: "75 mg PO daily" };
    const TIC = { pick: "Ticagrelor", load: "180 mg PO once", maint: "90 mg PO BID (with aspirin 81 mg; aspirin over 100 mg/day reduces its effect)" };
    const PRA = { pick: "Prasugrel", load: "60 mg PO once (at PCI)", maint: o.kg != null && o.kg < 60 ? "5 mg PO daily (weight under 60 kg)" : "10 mg PO daily" };
    if (o.oac) Object.assign(out, CLOP);
    else if (tic.ok && !o.hbr) Object.assign(out, TIC);
    else if (tic.ok && o.hbr) { Object.assign(out, TIC); out.why.push("High bleeding risk: ticagrelor is still acceptable but plan a short DAPT (1-3 months) then single antiplatelet; clopidogrel is a reasonable alternative."); }
    else Object.assign(out, CLOP);
    if (out.pick === "Ticagrelor") out.why.push("Preferred over clopidogrel in NSTE-ACS whether managed with PCI or medically (PLATO; 2025 ACC/AHA class 1 with PCI).");
    if (out.pick === "Clopidogrel" && !o.oac) out.why.push("Ticagrelor/prasugrel not suitable: " + tic.why.concat(pra.ok ? [] : pra.why).join("; "));
    if (out.pick === "Clopidogrel" && o.oac) out.why.push("With OAC: DOAC + clopidogrel (+ aspirin for up to 1 week). Avoid ticagrelor/prasugrel in triple therapy.");
    if (pra.ok && !o.oac && !o.strokeTIA && !(o.age >= 75)) out.why.push("Prasugrel 60 mg load then 10 mg daily is an alternative at PCI once anatomy is known (ISAR-REACT 5 favoured it over ticagrelor).");
    if (!tic.ok) out.avoid.push("Ticagrelor: " + tic.why.join("; ")); else if (tic.why.length) out.avoid.push("Ticagrelor " + tic.why.join("; "));
    if (!pra.ok || pra.why.length) out.avoid.push("Prasugrel: " + pra.why.join("; "));
    out.timing = o.managed === "pending" ? "Pre-treatment before angiography: not routine if cath is expected within 24 h (ESC 2023); if cath will be over 24 h, upstream ticagrelor or clopidogrel may be considered (2025 ACC/AHA 2b). Follow local cardiology practice." : "";
    return out;
  }

  /* ---------- parenteral anticoagulant ---------- */
  function anticoag(o) {
    // o: { kg, cl, onDOAC, onWarfarin, inr, tier (invasive tier), plt, hitHx }
    const L = [], kg = o.kg, cl = o.cl;
    if (o.onDOAC) L.push({ a: "Already on a DOAC: do not add heparin on top. Hold the DOAC and ask cardiology when to start parenteral anticoagulation (usually 12-24 h after the last dose, or at the cath).", lvl: "action" });
    if (o.onWarfarin) L.push({ a: `On warfarin${o.inr != null ? " (INR " + o.inr + ")" : ""}: hold; start heparin when INR is under 2.0. Radial cath can be done on warfarin.`, lvl: "action" });
    if (o.hitHx) L.push({ a: "History of HIT: no heparin. Use fondaparinux, or bivalirudin at PCI.", lvl: "urgent" });
    const enoxDose = kg ? r0(kg / 10) * 10 : null;
    const fond = cl != null && cl < 20 ? null : "Fondaparinux 2.5 mg SC daily (best bleeding profile, OASIS-5; ESC preferred if not going to cath soon). Cath lab gives a UFH bolus at PCI. Not if CrCl under 20.";
    const enox = cl != null && cl < 15 ? null : `Enoxaparin 1 mg/kg SC q12h${enoxDose ? ` (${enoxDose} mg q12h for ${r1(kg)} kg; max 100 mg per dose for the first 2 doses is a common local cap: check)` : ""}${cl != null && cl < 30 ? ` <b>CrCl ${cl}: 1 mg/kg SC once daily</b>` : ""}`;
    const bolus = kg ? Math.min(r0((60 * kg) / 100) * 100, 4000) : null, inf = kg ? Math.min(r0((12 * kg) / 50) * 50, 1000) : null;
    const ufh = `Unfractionated heparin 60 units/kg IV bolus (max 4,000)${bolus ? ` = ${bolus} units` : ""}, then 12 units/kg/h (max 1,000/h)${inf ? ` = ${inf} units/h` : ""}, aPTT/anti-Xa by the ACS nomogram`;
    const pick = o.tier === "immediate" || (cl != null && cl < 15) ? "ufh" : cl != null && cl < 30 ? "ufh-or-enox" : o.tier === "early" ? "enox" : "fond";
    return { list: L, fond, enox, ufh, pick, duration: "Continue until PCI (stop after an uncomplicated PCI), or for the hospital stay up to 8 days if managed medically. Switch to prophylactic doses after that if needed." };
  }

  /* ---------- DAPT duration ---------- */
  // o: { type, managed: pci|cabg|medical|pending, hbr (bool), oac (bool), tolerated1mo }
  function daptPlan(o) {
    if (o.type === "t2" || o.type === "injury" || o.type === "chronic" || o.type === "noMI") return { headline: "No DAPT", steps: ["Not type 1 MI: DAPT is not indicated. Aspirin 81 mg alone if known CAD or atherosclerosis. Stop any P2Y12 inhibitor started for 'NSTEMI' once type 2 is confirmed (with cardiology input if a stent was placed)."], months: 0 };
    const S = [];
    if (o.oac) {
      if (o.managed === "medical") return { headline: "OAC + clopidogrel, then OAC alone", months: 12, steps: ["Medically managed ACS on OAC: DOAC + clopidogrel 75 mg up to 12 months (6 months if high bleeding risk), then DOAC alone.", "No aspirin long-term with the OAC unless cardiology wants it."] };
      S.push("Aspirin + clopidogrel + DOAC (triple therapy) for up to 1 week after PCI (until discharge), then stop aspirin.", "DOAC + clopidogrel to 12 months (6 months if high bleeding risk), then DOAC alone (AUGUSTUS, ENTRUST-AF PCI; 2025 ACC/AHA).", "Use the standard stroke-prevention DOAC dose (apixaban preferred in trials). Do not use ticagrelor or prasugrel in triple therapy. Warfarin: INR 2.0-2.5.");
      if (o.stentThrombRisk) S.push("High stent-thrombosis risk: cardiology may extend triple therapy up to 30 days.");
      return { headline: "Triple therapy for 1 week, then DOAC + clopidogrel", months: 12, steps: S };
    }
    if (o.managed === "cabg") return { headline: "Aspirin lifelong; restart P2Y12 after CABG", months: 12, steps: ["Continue aspirin 81 mg through surgery.", "Hold before CABG: ticagrelor 3 days (some surgeons 5), clopidogrel 5 days, prasugrel 7 days.", "Restart the P2Y12 inhibitor after CABG when bleeding is settled, to complete 12 months of DAPT (2025 ACC/AHA; ESC 2023)."] };
    if (o.hbr) { S.push("Aspirin + P2Y12 for 1 month (up to 3 months) after PCI, then single antiplatelet (P2Y12 inhibitor or aspirin) (2025 ACC/AHA: HBR, MASTER DAPT).", "Medically managed with HBR: consider DAPT for 1-3 months, then single antiplatelet (discuss with cardiology).", "PPI while on DAPT."); return { headline: "High bleeding risk: short DAPT (1-3 months)", months: 1, steps: S }; }
    S.push("Default: aspirin 81 mg + ticagrelor 90 mg BID (or prasugrel / clopidogrel) for 12 months, whether treated with PCI or medically (2025 ACC/AHA class 1).");
    S.push("Options to reduce bleeding after at least 1 month without problems: stop aspirin and continue ticagrelor alone (TWILIGHT; 2025 ACC/AHA class 1), or de-escalate ticagrelor/prasugrel to clopidogrel.");
    S.push("After 12 months: aspirin alone (or clopidogrel alone) lifelong. Longer DAPT (ticagrelor 60 mg BID, PEGASUS) or aspirin + rivaroxaban 2.5 mg BID (COMPASS) only if high ischemic and low bleeding risk.");
    S.push("Do not stop DAPT early for elective surgery: defer elective surgery for 6 months after a stent if possible; for urgent surgery, discuss (keep aspirin).");
    return { headline: "DAPT for 12 months", months: 12, steps: S };
  }

  /* ---------- other medications (in hospital and at discharge) ---------- */
  // o: { sbp, hr, killip, lvef, shockRisk (bool), avBlock, asthma, cocaine, ldl, onStatin (text), onEze, onPCSK9, dm, ckd, htn, hf, k, egfr, pde5, rvInfarct, spo2, giRisk: [], onPPI, ppiName, onClop, nsaids: [], onBB, onACE, onMRA, onSGLT2, dmMed }
  function otherMeds(o) {
    const L = [];
    const add = (name, st, text) => L.push({ name, st, text });
    // nitrates
    if ((o.sbp != null && o.sbp < 90) || o.pde5 || o.rvInfarct) add("Nitroglycerin", "avoid", `Avoid${o.sbp != null && o.sbp < 90 ? " (SBP " + o.sbp + ")" : ""}${o.pde5 ? " (PDE5 inhibitor: sildenafil within 24 h, tadalafil within 48 h)" : ""}${o.rvInfarct ? " (RV infarct)" : ""}.`);
    else add("Nitroglycerin", "ok", "SL 0.4 mg q5min x3 for pain; IV infusion 5-10 mcg/min, titrate, for ongoing pain, hypertension or pulmonary edema. Relief of pain does not mean it was angina.");
    // beta-blocker
    const bbStop = [];
    if (o.killip >= 2 || o.hf) bbStop.push("heart failure / Killip 2+"); if (o.shockRisk) bbStop.push("risk of cardiogenic shock (age over 70, HR over 110, SBP under 120)");
    if (o.sbp != null && o.sbp < 100) bbStop.push("SBP under 100"); if (o.hr != null && o.hr < 60) bbStop.push("HR under 60"); if (o.avBlock) bbStop.push("PR over 0.24 s or 2nd/3rd degree block"); if (o.asthma) bbStop.push("active bronchospasm"); if (o.cocaine) bbStop.push("cocaine / stimulant");
    if (bbStop.length) add("Beta-blocker", "caution", `Hold for now: ${bbStop.join(", ")} (COMMIT). Start low once stable${o.onBB ? " (home beta-blocker: restart when safe to avoid rebound)" : ""}.`);
    else add("Beta-blocker", "ok", `Oral, start within 24 h: metoprolol 12.5-25 mg PO BID (or bisoprolol 1.25-2.5 mg daily), titrate to HR 55-70. ${o.lvef != null && o.lvef <= 40 ? "LVEF 40% or less: continue long-term (bisoprolol, carvedilol or metoprolol succinate)." : o.lvef != null && o.lvef >= 50 ? "LVEF 50%+ with no other reason: long-term benefit is uncertain (REDUCE-AMI 2024, REBOOT 2025 neutral; BETAMI-DANBLOCK 2025 favourable): reasonable for about a year, then review." : "Long-term: depends on LVEF (check echo)."} No IV beta-blocker unless hypertensive with ongoing ischemia and no HF.`);
    // statin / lipid
    const hiStatin = /atorvastatin\s*(40|80)|rosuvastatin\s*(20|40)/i.test(o.onStatin || "");
    add("High-intensity statin", hiStatin ? "have" : "ok", `${hiStatin ? "On " + o.onStatin + ". " : o.onStatin ? "On " + o.onStatin + ": increase to " : "Start "}atorvastatin 80 mg or rosuvastatin 20-40 mg daily now, regardless of LDL.${o.ldl != null ? ` LDL ${o.ldl} mmol/L.` : " Check fasting or non-fasting lipids (LDL, non-HDL, ApoB)."} Recheck lipids in 4-12 weeks: add ezetimibe 10 mg if LDL stays 1.8 or more (CCS 2021; 2025 ACC/AHA), then a PCSK9 inhibitor; ESC target is under 1.4 mmol/L and 50% lower.${o.ldl != null && o.ldl >= 3.5 ? " LDL 3.5+: reasonable to add ezetimibe now (unlikely to reach target on a statin alone)." : ""}`);
    // ACEi / ARB
    const aceWhy = []; if (o.lvef != null && o.lvef <= 40) aceWhy.push("LVEF 40% or less"); if (o.htn) aceWhy.push("hypertension"); if (o.dm) aceWhy.push("diabetes"); if (o.ckd) aceWhy.push("CKD");
    add("ACE inhibitor / ARB", o.onACE ? "have" : aceWhy.length ? "ok" : "consider", `${o.onACE ? "Already on one. " : ""}${aceWhy.length ? "Indicated (" + aceWhy.join(", ") + ")" : "Reasonable for all after MI (class 2a without the indications below)"}: ramipril 2.5 mg daily or BID, titrate to 10 mg/day; ARB (candesartan, valsartan) if ACEi cough. Hold if SBP under 100, AKI or K over 5.0.${o.k != null && o.k > 5 ? ` K now ${o.k}: wait.` : ""}${o.lvef != null && o.lvef <= 40 ? " HFrEF: sacubitril/valsartan is an alternative once stable (no ACEi in the past 36 h)." : ""}`);
    // MRA
    if (o.lvef != null && o.lvef <= 40 && (o.hf || o.dm)) add("MRA (eplerenone / spironolactone)", o.onMRA ? "have" : "ok", `LVEF ${o.lvef}% with ${o.hf ? "heart failure" : "diabetes"} (EPHESUS): eplerenone 25 mg daily or spironolactone 12.5-25 mg daily, if eGFR over 30 and K under 5.0.`);
    // SGLT2
    if ((o.lvef != null && o.lvef <= 40) || o.hf || o.dm || o.ckd) add("SGLT2 inhibitor", o.onSGLT2 ? "have" : "ok", `${[o.lvef != null && o.lvef <= 40 && "HFrEF", o.hf && "heart failure", o.dm && "diabetes", o.ckd && "CKD"].filter(Boolean).join(", ")}: empagliflozin or dapagliflozin 10 mg daily. (Not for MI alone: EMPACT-MI, DAPA-MI neutral.)`);
    // PPI
    const ppi = o.giRisk && o.giRisk.length;
    if (o.onPPI && o.onClop && /omeprazole|esomeprazole/i.test(o.ppiName || "")) add("PPI", "caution", `On ${o.ppiName} with clopidogrel: switch to pantoprazole 40 mg daily (omeprazole/esomeprazole reduce clopidogrel activation).`);
    else add("PPI", o.onPPI ? "have" : ppi ? "ok" : "consider", ppi ? `Recommended while on DAPT/OAC: ${o.giRisk.join(", ")}. Pantoprazole 40 mg daily.` : "Reasonable for most on DAPT (2025 ACC/AHA recommends with GI bleeding risk). Pantoprazole 40 mg daily.");
    // NSAIDs
    if (o.nsaids && o.nsaids.length) add("NSAIDs", "avoid", `Stop ${o.nsaids.join(", ")}: higher risk of death, reinfarction, HF and bleeding after MI. Use acetaminophen.`);
    // oxygen, morphine
    add("Oxygen", "info", o.spo2 != null && o.spo2 < 90 ? `SpO2 ${o.spo2}%: give oxygen to 90%+.` : "Only if SpO2 under 90% (DETO2X: no benefit if normal).");
    add("Morphine", "caution", "Avoid routine use: delays absorption of oral P2Y12 inhibitors. Use for severe pain only; crush ticagrelor if given.");
    add("Colchicine", "consider", "Not routine (CLEAR SYNERGY 2024 neutral after MI; COLCOT positive). Cardiology may use 0.5 mg daily in selected patients; avoid with CrCl under 30 and strong CYP3A4/P-gp inhibitors.");
    add("Influenza vaccine", "ok", "Give this admission if due (IAMI: fewer deaths after MI).");
    return L;
  }

  /* ---------- interactions and chart alerts ---------- */
  function alerts(o) {
    // o: { meds: [text], type, p2: p2y12 result, hb, hbDrop, plt, k, mg, qtc, cl, ticagrelor, prasugrel, clopidogrel, asaHigh, oac, simva }
    const A = [], has = (re) => (o.meds || []).filter((m) => re.test(m));
    if ((o.type === "t2" || o.type === "injury") && (o.ticagrelor || o.prasugrel || o.clopidogrel)) A.push({ lvl: "urgent", t: "A P2Y12 inhibitor is ordered but this looks like type 2 MI / non-ischemic injury: is DAPT really indicated? (Bleeding risk without benefit.)" });
    if (o.ticagrelor && (o.prasugrel || o.clopidogrel)) A.push({ lvl: "urgent", t: "Two P2Y12 inhibitors ordered: keep one." });
    if (o.oac && (o.ticagrelor || o.prasugrel)) A.push({ lvl: "urgent", t: "Oral anticoagulant + ticagrelor/prasugrel: high bleeding risk; clopidogrel is the P2Y12 of choice with OAC." });
    if (o.ticagrelor && o.asaHigh) A.push({ lvl: "action", t: "Aspirin over 100 mg/day with ticagrelor reduces its benefit (PLATO): use aspirin 81 mg." });
    const cyp = has(/clarithromycin|ketoconazole|itraconazole|voriconazole|posaconazole|ritonavir|cobicistat|nefazodone|rifampin|rifampicin|carbamazepine|phenytoin|phenobarbital/i);
    if (o.ticagrelor && cyp.length) A.push({ lvl: "urgent", t: `Ticagrelor + ${cyp.join(", ")}: strong CYP3A4 inhibitor/inducer, contraindicated combination.` });
    const sim = has(/simvastatin\s*(80|60)|lovastatin\s*([5-9]\d)/i);
    if (o.ticagrelor && sim.length) A.push({ lvl: "action", t: `Ticagrelor raises simvastatin/lovastatin levels: ${sim.join(", ")} (keep simvastatin at 40 mg or less; atorvastatin/rosuvastatin preferred).` });
    if (o.clopidogrel && has(/\bomeprazole|esomeprazole/i).length) A.push({ lvl: "action", t: "Clopidogrel + omeprazole/esomeprazole: switch to pantoprazole." });
    const nsaid = has(/ibuprofen|naproxen|diclofenac|ketorolac|celecoxib|meloxicam|indomethacin/i);
    if (nsaid.length) A.push({ lvl: "action", t: `NSAID after MI: ${nsaid.join(", ")}. Stop.` });
    const pde = has(/sildenafil|tadalafil|vardenafil/i);
    if (pde.length) A.push({ lvl: "urgent", t: `PDE5 inhibitor (${pde.join(", ")}): no nitrates for 24 h (sildenafil/vardenafil) or 48 h (tadalafil).` });
    const nsBB = has(/\bdiltiazem|verapamil/i);
    if (nsBB.length && o.lowEF) A.push({ lvl: "action", t: `Non-dihydropyridine calcium blocker (${nsBB.join(", ")}) with LVEF 40% or less: avoid.` });
    if (has(/rivaroxaban|apixaban|edoxaban|dabigatran|warfarin/i).length && o.heparinTx)
      A.push({ lvl: "urgent", t: "Oral anticoagulant AND a treatment-dose heparin/LMWH both on the chart: check one is held." });
    if (o.hb != null && o.hb < 80) A.push({ lvl: "urgent", t: `Hb ${o.hb}: anemia can cause type 2 MI and raises bleeding risk. Transfuse to Hb 100 in active MI is reasonable (MINT 2023: liberal 100 vs restrictive 70-80 favoured liberal).` });
    else if (o.hb != null && o.hb < 100) A.push({ lvl: "action", t: `Hb ${o.hb}: MINT 2023 suggests a transfusion threshold of about 100 g/L in acute MI with anemia. Look for bleeding.` });
    if (o.hbDrop != null && o.hbDrop >= 20) A.push({ lvl: "urgent", t: `Hb has fallen ${o.hbDrop} g/L: check for bleeding (GI, access site, retroperitoneal).` });
    if (o.plt != null && o.plt < 100) A.push({ lvl: o.plt < 50 ? "urgent" : "action", t: `Platelets ${o.plt}${o.heparin ? ": on heparin: think HIT (4Ts score)" : ""}.` });
    if (o.k != null && o.k < 4) A.push({ lvl: "action", t: `K ${o.k}: keep K 4.0+ and Mg 0.8+ after MI (arrhythmia risk).` });
    if (o.mg != null && o.mg < 0.8) A.push({ lvl: "action", t: `Mg ${o.mg}: replace.` });
    if (o.qtc != null && o.qtc >= 500) A.push({ lvl: "urgent", t: `QTc ${o.qtc}: review QT drugs, replace K and Mg.` });
    if (o.cl != null && o.cl < 30 && has(/enoxaparin.*(bid|q12)|(bid|q12).*enoxaparin/i).length) A.push({ lvl: "urgent", t: `CrCl ${o.cl}: enoxaparin should be once daily (1 mg/kg q24h).` });
    if (o.cl != null && o.cl < 20 && has(/fondaparinux/i).length) A.push({ lvl: "urgent", t: `CrCl ${o.cl}: fondaparinux not recommended.` });
    return A;
  }

  /* ---------- work-up checklist ---------- */
  function workup(c) {
    // c: { trop: count, ecgDone, echo, lipid, a1c, hb, cr, k, mg, tsh, cxr, inr }
    return [
      { t: "Serial ECGs (on arrival, with pain, at 15-30 min if ongoing, after treatment)", have: c.ecgDone },
      { t: "High-sensitivity troponin 0 h and 1-3 h (assay pathway)", have: c.trop >= 2 ? c.tropLast : null, why: c.trop < 2 ? "need at least 2 values" : "" },
      { t: "Echocardiogram (LVEF, wall motion, valve, mechanical complication, LV thrombus)", have: c.echo, why: "LVEF changes long-term drugs and the PCI vs CABG choice" },
      { t: "CBC, creatinine/eGFR, electrolytes incl. Mg", have: c.hb && c.cr },
      { t: "Lipid panel (LDL, non-HDL; ApoB and Lp(a) once)", have: c.ldl },
      { t: "HbA1c", have: c.a1c },
      { t: "INR/aPTT before anticoagulation and cath", have: c.inr },
      { t: "TSH if AF or tachycardia", have: c.tsh },
      { t: "Chest X-ray", have: null },
      { t: "Bleeding risk (ARC-HBR) and frailty (Clinical Frailty Scale) documented", have: null }];
  }

  const api = { crcl, tropPattern, mitype, grace, timi, invasive, revasc, hbr, preciseDapt, daptScore, p2y12, anticoag, daptPlan, otherMeds, alerts, workup };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else window.ACSRules = api;
})();
