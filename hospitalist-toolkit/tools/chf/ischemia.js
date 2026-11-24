/* Heart failure page - "Ischemia" sub-tab: should we look for coronary disease as the cause, which test
   (treadmill vs SPECT vs stress echo vs stress CMR vs CT coronary angiogram vs invasive angiogram), and when to refer to cardiology.
   Rules written by Claude from the CCS/CHFS 2021 HF guidelines, 2021 ESC HF guideline (2023 update), 2024 ESC chronic coronary
   syndromes guideline, 2021 AHA/ACC chest pain guideline and 2022 AHA/ACC/HFSA HF guideline, STICH and REVIVED-BCIS2.
   UNVERIFIED draft: check with VGH/RJH cardiology and the local imaging departments before real use. READ-ONLY: orders nothing. */
(function () {
  /* ---------- pure rules (tested in tests/test_chf.js) ---------- */
  const RF = [["dm", "Diabetes"], ["smoke", "Smoker (current or past)"], ["htn", "Hypertension"], ["lipid", "High cholesterol"], ["pad", "PAD, stroke or TIA"], ["ckd", "Chronic kidney disease"], ["fam", "Family history of early CAD"]];
  const ECG_BAD = [["lbbb", "LBBB"], ["paced", "Paced rhythm"], ["lvh", "LVH with strain"], ["std", "Resting ST depression 1 mm or more"], ["dig", "On digoxin"], ["wpw", "WPW / pre-excitation"]];

  // Rough likelihood of obstructive CAD. Not a validated score: a bedside sorting aid.
  function likelihood(o) {
    const why = [], rf = o.rf || 0;
    if (o.knownCad) why.push("known CAD (prior MI, PCI or CABG)");
    if (o.rwma) why.push("regional wall motion abnormality in a coronary territory");
    if (o.qwaves) why.push("Q waves / old infarct on ECG");
    if (why.length) return { level: "high", why };
    if (o.angina && ((o.age != null && o.age >= 60) || rf >= 2)) return { level: "high", why: ["exertional angina" + (o.age >= 60 ? ", age " + o.age : "") + (rf >= 2 ? ", " + rf + " risk factors" : "")] };
    if (!o.angina && rf === 0 && o.age != null && o.age < 50) return { level: "low", why: ["under 50, no angina, no risk factors ticked"] };
    if (!o.angina && rf <= 1 && o.age != null && o.age < 40) return { level: "low", why: ["under 40, no angina"] };
    return { level: "intermediate", why: [(o.angina ? "angina" : "no angina") + ", " + rf + " risk factor" + (rf === 1 ? "" : "s") + (o.age != null ? ", age " + o.age : "")] };
  }

  // Should we look for ischemia, how, and when. route: acs | urgent | none | echo | ica | noninv | optional
  function plan(o) {
    const L = o.lik || likelihood(o), low = o.ef === "low" || o.ef === "mid", B = [];
    const out = (route, tone, big, when, bullets) => ({ route, tone, big, when, bullets: bullets.concat(B), lik: L });
    if (o.acs) return out("acs", "t3", "Acute coronary syndrome: treat as NSTEMI/STEMI now", "Today",
      ["Cardiology today; timing of invasive angiography by risk (see the NSTEMI tab). HF with ACS is a high-risk feature: early invasive (within 24 h) usually.", "Do not stress-test an acute coronary syndrome.", "Troponin alone is not ACS: chronic stable elevation is common in HF. Look for a rise and fall with symptoms or new ECG changes."]);
    if (o.shock) return out("urgent", "t3", "Low output / shock: call ICU and cardiology now", "Now", ["Ask cardiology whether ischemia is the cause (urgent angiography if ACS is possible). No stress testing."]);
    if (o.vt) return out("urgent", "t3", "Sustained VT/VF or cardiac arrest: cardiology now", "Today", ["Coronary angiography is usually done to look for an ischemic trigger and substrate; also ICD assessment."]);
    if (o.revasc === "no") return out("none", "t1", "No ischemia testing: it would not change treatment", "",
      ["Not a candidate for (or does not want) PCI or bypass: frailty, limited life expectancy or goals of care. Document the reason.",
        "Treat medically: GDMT; if CAD is known or likely, aspirin and a statin unless reasons not to; for angina a beta-blocker, nitrate (long-acting or spray), then amlodipine (safe in HFrEF), ranolazine or ivabradine with cardiology."]);
    if (o.revasc === "unsure") B.push("Decide first whether the patient would be a revascularization candidate (frailty, other illness, their wishes). If not, testing will not help.");
    if (o.ef === "unknown") return out("echo", "t1", "Get the echo first", "This admission",
      ["The EF and any regional wall motion abnormality decide whether and how to look for coronary disease.", o.angina ? "Angina is present: plan ischemia testing whatever the EF." : "Then come back to this tab."]);
    if (low) {
      if (o.otherCause && !o.angina && L.level !== "high") return out("optional", "t1", "Ischemia less likely: another cause has been found", "Outpatient, if at all",
        ["Most guidelines still advise excluding CAD once in new HFrEF; a CT coronary angiogram (or stress CMR if the cause is in doubt) is enough. Skip it if the other cause clearly explains the EF and it recovers on treatment."]);
      if (L.level === "high" || o.angina) return out("ica", "t2", "Yes: invasive coronary angiography", o.angina ? "This admission once decongested, or early outpatient: ask cardiology" : "Before discharge or early outpatient: ask cardiology",
        ["New HFrEF / HFmrEF with " + (o.angina ? "angina" : "a high likelihood of CAD") + ": go straight to angiography rather than a stress test (CCS/CHFS, ESC). It shows whether bypass or PCI is an option.",
          "Bypass helps survival in ischemic cardiomyopathy with EF 35% or less over 10 years (STICH), mainly with multivessel or left main disease. PCI did not reduce death or HF admission in stable ischemic cardiomyopathy without angina (REVIVED-BCIS2), so angina, ACS and surgical anatomy drive revascularization.",
          "Viability testing is no longer routine; cardiology may ask for it when weighing bypass."]);
      if (L.level === "intermediate") return out("noninv", "t2", "Yes: non-invasive test first", "After decongestion; usually outpatient (arrange before discharge)",
        ["New HFrEF / HFmrEF, intermediate likelihood: a CT coronary angiogram (anatomy) or stress imaging (SPECT, stress echo or stress CMR). See the test chooser below.",
          "Positive or unclear result → invasive angiography with cardiology.", "Stress CMR also shows the cause when it is not ischemic (scar pattern, amyloid, myocarditis, sarcoid)."]);
      return out("noninv", "t1", "Yes, to exclude CAD: CT coronary angiogram", "Outpatient",
        ["Low likelihood but new HFrEF of unknown cause: a normal CT coronary angiogram rules out CAD well. Stress CMR instead if the cause is also unclear.", "Then look harder for non-ischemic causes (Cause & tests tab)."]);
    }
    // HFpEF
    if (o.angina || o.rwma || L.level === "high") return out("noninv", "t2", "Look for ischemia: non-invasive test", "Outpatient once euvolemic",
      ["HFpEF with " + (o.angina ? "angina" : o.rwma ? "a regional wall motion abnormality" : "a high likelihood of CAD") + ": stress imaging or a CT coronary angiogram. Invasive angiography if angina continues despite medicines or the test shows high-risk features.",
        "Ischemia can worsen diastolic function; treating angina may reduce HF episodes."]);
    return out("none", "t0", "No routine ischemia testing", "",
      ["HFpEF without angina, wall motion abnormality or a high likelihood of CAD: testing is not routine (ESC, CCS). Control BP, AF rate, weight and diabetes; statin by risk."]);
  }

  // Which test suits this patient. Status: ok | caution | avoid, with reasons.
  function tests(o) {
    const bad = ECG_BAD.filter(([k]) => o.ecg && o.ecg[k]).map(([, t]) => t), lbbbPaced = !!(o.ecg && (o.ecg.lbbb || o.ecg.paced)), low = o.ef === "low" || o.ef === "mid";
    const lik = (o.lik || likelihood(o)).level, egfr = o.egfr, fat = o.bmi != null && o.bmi >= 35;
    const T = [];
    const add = (key, name, what, gives, ok, cau, avo) => T.push({ key, name, what, gives, status: avo.length ? "avoid" : cau.length ? "caution" : "ok", why: avo.concat(cau), good: ok });
    const stable = o.decompensated ? ["not until euvolemic and stable (still congested)"] : [];
    // treadmill
    { const ok = [], c = [], a = [].concat(stable);
      if (o.canEx === "no") a.push("cannot exercise enough (needs about 5 METs: brisk walk, 2 flights of stairs)"); else if (o.canEx !== "yes") c.push("check they can walk about 5 METs (2 flights of stairs)");
      if (bad.length) a.push("resting ECG cannot be read for ischemia: " + bad.join(", "));
      if (o.severeAS) a.push("severe symptomatic aortic stenosis");
      if (low) c.push("weak test when the ventricle is already abnormal: does not show where or how much; imaging preferred in HFrEF");
      if (lik === "high") c.push("high likelihood: a normal result would not be believed; go to imaging or angiography");
      if (!low && lik !== "high" && o.canEx === "yes" && !bad.length) ok.push("cheap, quick, no radiation; also gives exercise capacity and BP response");
      add("ett", "Exercise treadmill ECG (stress test)", "ST changes on the ECG while walking on a treadmill (Bruce protocol)", "Symptoms, exercise capacity, ST changes; no pictures of the heart", ok, c, a); }
    // exercise SPECT
    { const ok = [], c = [], a = [].concat(stable);
      if (o.canEx === "no") a.push("cannot exercise: use pharmacologic (vasodilator) SPECT"); else if (o.canEx !== "yes") c.push("check they can exercise");
      if (lbbbPaced) a.push("LBBB or paced: exercise causes false septal defects - use vasodilator SPECT instead");
      if (fat) c.push("BMI 35+: attenuation artifacts (PET if available)");
      if (o.canEx === "yes" && !lbbbPaced) ok.push("shows where and how much ischemia, plus exercise capacity; works with an abnormal ECG");
      add("exspect", "Exercise SPECT (MIBI / nuclear perfusion)", "Treadmill plus a radioactive tracer pictured at rest and stress", "Ischemia and scar by territory, EF", ok, c, a); }
    // pharmacologic SPECT
    { const ok = [], c = [], a = [];
      if (o.decompensated) c.push("do it once stable, not while congested");
      if (o.asthma) c.push("asthma / bronchospasm: dipyridamole and adenosine can trigger bronchospasm; regadenoson is better tolerated but avoid in active wheeze; dobutamine echo is the alternative");
      if (o.avb && !(o.ecg && o.ecg.paced)) a.push("2nd or 3rd degree AV block without a pacemaker (vasodilators slow AV conduction)");
      if (o.sbp != null && o.sbp < 90) a.push("SBP under 90");
      if (fat) c.push("BMI 35+: attenuation artifacts (PET if available)");
      if (o.canEx === "no") ok.push("for patients who cannot exercise");
      if (lbbbPaced) ok.push("the nuclear test of choice with LBBB or pacing");
      ok.push("prep: no caffeine for 12-24 h; hold dipyridamole/theophylline. Balanced 3-vessel disease can look normal");
      add("pspect", "Pharmacologic SPECT (regadenoson / dipyridamole)", "Same pictures, with a vasodilator drug instead of exercise", "Ischemia and scar by territory, EF", ok, c, a); }
    // stress echo
    { const ok = [], c = [], a = [].concat(stable);
      if (o.poorWindows || fat) c.push("poor echo windows (obesity, COPD): needs contrast; may be non-diagnostic");
      if (lbbbPaced) c.push("abnormal septal motion with LBBB / pacing is harder to read");
      if (o.vtHx) c.push("dobutamine can trigger arrhythmias: caution with past VT");
      if (o.severeAS) c.push("severe AS: only low-dose dobutamine protocols with cardiology");
      ok.push("no radiation; exercise or dobutamine; low-dose dobutamine also tests viability; also shows valves");
      add("secho", "Stress echo (exercise or dobutamine)", "Ultrasound of wall motion at rest and at stress", "New wall motion abnormality, viability, valves", ok, c, a); }
    // stress CMR
    { const ok = [], c = [], a = [];
      if (o.decompensated) c.push("needs lying flat and breath-holds: do once decongested");
      if (egfr != null && egfr < 30) c.push(`eGFR ${Math.round(egfr)}: gadolinium - group II agent and radiology approval (NSF risk is very low but check local policy)`);
      if (o.ecg && o.ecg.paced) c.push("pacemaker / ICD: only if MRI-conditional, with the device team");
      if (o.af) c.push("AF or frequent ectopics degrade the images");
      if (o.asthma) c.push("vasodilator stress: same bronchospasm caution as SPECT");
      ok.push("ischemia and scar in one test; late gadolinium pattern shows the cause (ischemic vs dilated, amyloid, myocarditis, sarcoid)");
      if (low && !o.otherCause) ok.push("best single test when the cause of new HFrEF is unclear");
      c.push("limited availability; claustrophobia");
      add("cmr", "Stress cardiac MRI (perfusion CMR)", "MRI with adenosine/regadenoson and gadolinium contrast", "Ischemia, scar pattern (cause), exact EF", ok, c, a); }
    // CCTA
    { const ok = [], c = [], a = [];
      if (o.af) c.push("AF or irregular rhythm blurs the images (needs a regular rhythm, HR ideally under 65)");
      if (egfr != null && egfr < 30) a.push(`eGFR ${Math.round(egfr)}: iodinated contrast`); else if (egfr != null && egfr < 45) c.push(`eGFR ${Math.round(egfr)}: contrast - hydrate, hold metformin per policy`);
      if (o.knownCad) c.push("known CAD / stents / bypass: anatomy already known; stents and heavy calcium limit reading");
      if (o.age != null && o.age >= 75) c.push("older patients often have heavy calcium: may be non-diagnostic");
      if (lik === "high") c.push("high likelihood: go to invasive angiography instead");
      if (o.decompensated) c.push("needs breath-holds and beta-blocker for rate: once stable");
      if (lik !== "high" && !o.knownCad) ok.push("best to RULE OUT CAD in low-intermediate likelihood (very high negative predictive value); anatomy, not function (FFR-CT if available)");
      add("ccta", "CT coronary angiogram (CCTA)", "CT with contrast of the coronary arteries", "Plaque and narrowing (anatomy)", ok, c, a); }
    // invasive
    { const ok = [], c = [], a = [];
      if (o.revasc === "no") a.push("not a revascularization candidate: would not change treatment");
      if (egfr != null && egfr < 30) c.push(`eGFR ${Math.round(egfr)}: contrast kidney injury risk - hydration, minimal contrast; still done when the benefit is clear`);
      if (lik === "low" && !o.angina && !o.acs) c.push("low likelihood: start with a non-invasive test");
      if (o.decompensated && !o.acs) c.push("lying flat: decongest first unless ACS");
      if (o.acs || o.vt || o.angina || lik === "high") ok.push("the test to choose with ACS, VT/arrest, angina despite medicines or a high likelihood; leads directly to PCI or bypass planning");
      ok.push("cath lab for Victoria is at RJH: VGH patients transfer or go as outpatients (check local process)");
      add("ica", "Invasive coronary angiogram (cath)", "Catheter through the wrist or groin with contrast", "Exact anatomy; PCI in the same sitting if needed", ok, c, a); }
    return T;
  }

  // Best fit for this patient, given the route.
  function best(route, o, T) {
    const st = (k) => (T.find((t) => t.key === k) || {}).status;
    const pick = (order) => order.find((k) => st(k) === "ok") || order.find((k) => st(k) === "caution") || null;
    if (route === "acs" || route === "urgent" || route === "ica") return st("ica") === "avoid" ? null : "ica";
    if (route === "none" || route === "echo") return null;
    const low = o.ef === "low" || o.ef === "mid", lik = (o.lik || likelihood(o)).level;
    if (lik !== "high" && !o.knownCad && st("ccta") === "ok") return "ccta";
    if (low && !o.otherCause && st("cmr") === "ok") return "cmr";
    if (o.ecg && (o.ecg.lbbb || o.ecg.paced)) return pick(["pspect", "cmr", "secho"]);
    if (o.canEx === "yes") return pick(low ? ["exspect", "secho", "ett"] : ["ett", "secho", "exspect"]);
    return pick(["pspect", "secho", "cmr", "ccta"]);
  }

  // When to refer to cardiology: tiers, with this patient's matches.
  function refer(o, P) {
    const m = (b) => !!b;
    return [
      { tier: "now", label: "Call cardiology now / today", items: [
        ["Acute coronary syndrome with HF (troponin rise and fall with symptoms or new ECG changes)", m(o.acs)],
        ["Cardiogenic shock or low output (also ICU)", m(o.shock)],
        ["Sustained VT/VF, cardiac arrest, syncope with VT", m(o.vt)],
        ["Flash pulmonary edema with suspected ischemia or acute severe mitral regurgitation", false]] },
      { tier: "today", label: "This admission (consult or call before discharge)", items: [
        ["New HFrEF / HFmrEF needing invasive angiography (angina or high likelihood of CAD) in a revascularization candidate", P.route === "ica"],
        ["Angina not controlled by medicines", m(o.angina && o.revasc !== "no")],
        ["Severe valve disease that may be driving the HF (aortic stenosis, mitral regurgitation): TAVI / valve team", m(o.valve)],
        ["Suspected amyloid, sarcoid, myocarditis or peripartum cardiomyopathy (see Cause & tests)", false],
        ["Advanced HF: low BP or kidney limits stop GDMT, repeated admissions, inotropes considered", false]] },
      { tier: "later", label: "After discharge (HF clinic or outpatient cardiology)", items: [
        ["Every new HF diagnosis: HF clinic referral (GDMT titration, follow-up echo)", true],
        ["Non-invasive ischemia test arranged: positive or unclear result → cardiology for angiography", P.route === "noninv" || P.route === "optional"],
        ["EF 35% or less after 3 months of GDMT: ICD / CRT assessment (not during the admission unless VT/arrest)", m(o.ef === "low")],
        ["HFpEF with stable angina: cardiology after the non-invasive test", m(o.ef === "pres" && o.angina)]] },
      { tier: "no", label: "Usually no cardiology referral for ischemia", items: [
        ["Not a revascularization candidate or palliative goals: manage medically, palliative care input", m(o.revasc === "no")],
        ["Ischemia already investigated recently and nothing has changed", false]] }];
  }

  function noteLine(o) {
    const P = plan(o), T = tests(Object.assign({ lik: P.lik }, o)), b = best(P.route, Object.assign({ lik: P.lik }, o), T), bt = b ? T.find((t) => t.key === b).name : "";
    return `Ischemia as cause: likelihood of CAD ${P.lik.level} (${P.lik.why.join("; ")}). ${P.big}${bt && P.route !== "ica" ? " - suggested test: " + bt : ""}${P.when ? " (" + P.when.toLowerCase() + ")" : ""}.`;
  }

  const api = { RF, ECG_BAD, likelihood, plan, tests, best, refer, noteLine };
  if (typeof module !== "undefined" && module.exports) { module.exports = api; return; }

  /* ---------- page ---------- */
  const $ = (id) => document.getElementById(id), esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const ul = (a) => "<ul>" + a.filter(Boolean).map((t) => "<li>" + t + "</li>").join("") + "</ul>";
  let ctx = { s: {}, c: {}, ef: "unknown", shock: false, f: null };

  function buildInputs() {
    const box = $("ia-inputs"); if (!box || box.dataset.built) return; box.dataset.built = "1";
    const cb = (id, t) => `<label class="inl"><input type="checkbox" id="ia-${id}"> ${esc(t)}</label>`;
    box.innerHTML =
      `<div class="row"><b>Coronary clues:</b> ${cb("angina", "Exertional chest pain / pressure (or exertional dyspnea that came first)")} ${cb("knownCad", "Known CAD: prior MI, PCI or bypass")} ${cb("rwma", "Regional wall motion abnormality on echo")} ${cb("qwaves", "Q waves / old infarct on ECG")}</div>` +
      `<div class="row"><b>Acute:</b> ${cb("acs", "ACS now: troponin rise/fall with symptoms or new ischemic ECG")} ${cb("vt", "Sustained VT/VF or arrest")} ${cb("other", "A non-ischemic cause has been found (alcohol, tachycardia, chemo, valve, amyloid, myocarditis…)")}</div>` +
      `<div class="row"><b>Risk factors:</b> ${RF.map(([k, t]) => cb("rf-" + k, t)).join(" ")}</div>` +
      `<div class="row"><b>Resting ECG:</b> ${ECG_BAD.map(([k, t]) => cb("ecg-" + k, t)).join(" ")} ${cb("af", "AF / irregular rhythm")} ${cb("avb", "2nd/3rd degree AV block")}</div>` +
      `<div class="row"><label class="inl">Can exercise on a treadmill? <select id="ia-canEx"><option value="unk">Not sure</option><option value="yes">Yes: walks 2 flights / brisk walk</option><option value="no">No: frail, arthritis, amputation, deconditioned</option></select></label>
        <label class="inl">Revascularization candidate? <select id="ia-revasc"><option value="unsure">Not sure yet</option><option value="yes">Yes: would have PCI or bypass</option><option value="no">No: frailty, life expectancy or patient's wishes</option></select></label></div>` +
      `<div class="row"><b>Test limits:</b> ${cb("asthma", "Asthma / active bronchospasm")} ${cb("windows", "Poor echo windows")} ${cb("sevas", "Severe aortic stenosis")} ${cb("vthx", "Past VT")}</div>`;
    box.querySelectorAll("input,select").forEach((el) => (el.onchange = () => (typeof window.draw === "function" ? window.draw() : render())));
  }

  const chk = (id) => !!($("ia-" + id) && $("ia-" + id).checked);
  function read() {
    const s = ctx.s || {}, ecg = {}; ECG_BAD.forEach(([k]) => (ecg[k] = chk("ecg-" + k)));
    const rf = RF.filter(([k]) => chk("rf-" + k)).length;
    return { age: s.age, sex: s.sex, egfr: s.egfr, bmi: s.bmi, sbp: s.sbp, decompensated: !!s.decompensated, ef: ctx.ef, shock: !!ctx.shock,
      angina: chk("angina"), knownCad: chk("knownCad"), rwma: chk("rwma"), qwaves: chk("qwaves"), acs: chk("acs"), vt: chk("vt"), otherCause: chk("other"), rf, ecg,
      af: chk("af"), avb: chk("avb"), asthma: chk("asthma"), poorWindows: chk("windows"), severeAS: chk("sevas"), vtHx: chk("vthx") || chk("vt"),
      canEx: ($("ia-canEx") || {}).value || "unk", revasc: ($("ia-revasc") || {}).value || "unsure", valve: !!(ctx.f && ctx.f.prob && ctx.f.prob.valve) };
  }

  function prefill(f, preset) {
    buildInputs();
    const p = (preset && preset.isch) || {}, pr = (f && f.prob) || {}, has = (k) => !!(f && f.cls && f.cls[k] && f.cls[k].length);
    const set = (id, v) => { const el = $("ia-" + id); if (el) el.checked = !!v; };
    set("angina", p.angina != null ? p.angina : pr.angina); set("knownCad", p.knownCad != null ? p.knownCad : pr.cad); set("rwma", p.rwma); set("qwaves", p.qwaves);
    set("acs", p.acs); set("vt", p.vt != null ? p.vt : pr.vt); set("other", p.other != null ? p.other : pr.alcohol || pr.chemo);
    const rfAuto = { dm: pr.dm, smoke: pr.smoke, htn: pr.htn, lipid: pr.lipid || has("statin"), pad: pr.pad, ckd: pr.ckd, fam: false };
    RF.forEach(([k]) => set("rf-" + k, p.rf ? p.rf.includes(k) : rfAuto[k]));
    const ecgAuto = { lbbb: pr.lbbb, paced: pr.paced, lvh: false, std: false, dig: has("dig"), wpw: pr.wpw };
    ECG_BAD.forEach(([k]) => set("ecg-" + k, p.ecg ? p.ecg.includes(k) : ecgAuto[k]));
    set("af", p.af != null ? p.af : pr.af); set("avb", pr.avb); set("asthma", p.asthma != null ? p.asthma : pr.asthma); set("windows", p.windows != null ? p.windows : !!(f && f.bmi >= 35));
    set("sevas", p.sevas); set("vthx", pr.vt);
    $("ia-canEx").value = p.canEx || "unk"; $("ia-revasc").value = p.revasc || "unsure";
  }

  function render() {
    buildInputs(); if (!$("ia-out")) return;
    const o = read(), P = plan(o), oo = Object.assign({ lik: P.lik }, o), T = tests(oo), b = best(P.route, oo, T), R = refer(o, P);
    const trop = ctx.f && ctx.f.l && ctx.f.l.trop ? ctx.f.l.trop.slice(-4) : [];
    $("iasum").textContent = P.big;
    $("ia-out").innerHTML =
      `<div class="verdict ${P.tone}"><div class="big">${esc(P.big)}</div>${P.when ? `<div><b>When:</b> ${esc(P.when)}</div>` : ""}<div class="s">Likelihood of CAD: <b>${esc(P.lik.level)}</b> (${esc(P.lik.why.join("; "))}). Rough sorting aid, not a validated score.</div></div>` +
      ul(P.bullets.map(esc)) +
      (trop.length ? `<div class="muted">Troponin (last 7 days): ${trop.map((t) => Math.round(t.v)).join(" → ")} ng/L. A stable mild elevation is common in HF; a rise and fall with symptoms or ECG change is MI.</div>` : "") +
      (b ? `<div class="alert info"><b>Best fit for this patient:</b> ${esc(T.find((t) => t.key === b).name)} (see the test chooser below)</div>` : "");
    const cls = { ok: "st-ok", caution: "st-caution", avoid: "st-avoid" }, word = { ok: "✓ Suitable", caution: "⚠ Caution", avoid: "✗ Avoid" };
    $("ia-tests").innerHTML = `<div class="muted" style="margin-bottom:6px">Ticks and cautions are for this patient (from the boxes in the Ischemia section). Stress tests are done once the patient is euvolemic and stable, usually as an outpatient.</div>` +
      `<table class="agent"><tr><th>Test</th><th>What it is / shows</th><th>For this patient</th></tr>` +
      T.map((t) => `<tr class="${t.key === b ? "me" : ""}"><td><b>${esc(t.name)}</b>${t.key === b ? " ◀ best fit" : ""}</td><td>${esc(t.what)}<br><span class="muted">${esc(t.gives)}</span></td><td><span class="${cls[t.status]}">${word[t.status]}</span>${t.good.length ? "<br>" + t.good.map(esc).join("<br>") : ""}${t.why.length ? ul(t.why.map(esc)) : ""}</td></tr>`).join("") + "</table>" +
      `<h3>Treadmill or SPECT? Quick rules</h3>${ul([
        "<b>Treadmill ECG</b> only if the patient can walk about 5 METs <b>and</b> the resting ECG is normal enough to read (no LBBB, pacing, LVH strain, resting ST depression, digoxin, WPW). In HFrEF it adds little: choose imaging.",
        "<b>Can't exercise</b> → pharmacologic SPECT (regadenoson) or dobutamine stress echo; stress CMR if the cause is also unclear.",
        "<b>LBBB or paced</b> → vasodilator SPECT or stress CMR (not exercise SPECT or treadmill).",
        "<b>Low-intermediate likelihood, younger, sinus rhythm, eGFR 30+</b> → CT coronary angiogram rules CAD out best.",
        "<b>High likelihood, angina, ACS, VT</b> → skip stress testing: invasive angiogram.",
        "<b>Asthma / bronchospasm</b> → dobutamine stress echo rather than a vasodilator test.",
        "<b>Still congested</b> → no stress test of any kind until euvolemic."])}`;
    $("ia-refer").innerHTML = R.map((g) => `<div class="esc esc-${g.tier === "no" ? "later" : g.tier}"><b>${esc(g.label)}</b>${ul(g.items.map(([t, hit]) => (hit ? "<b>◀ " + esc(t) + "</b>" : esc(t))))}</div>`).join("") +
      `<div class="muted">◀ = applies to this patient from the boxes above. Use the Consult button to write the message to cardiology.</div>`;
  }

  window.CHFIsch = Object.assign({}, api, {
    prefill, render,
    draw(c) { ctx = c || ctx; render(); },
    note() { buildInputs(); return $("ia-out") ? noteLine(read()) : ""; } });
})();
