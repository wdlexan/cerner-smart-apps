/* South Island Discharge Clinic (RJH, takes RJH and VGH referrals): screen the chart against the clinic's referral criteria
   (clinic handout, last updated July 11, 2026) and build the referral text for the ERP/MRP discharge note.
   Pure rules, no network. Uses DcRules.parse (tools/discharge/rules.js) for meds, problems and key labs.
   UNVERIFIED draft written by Claude: the physician decides. Nothing is ordered or sent. */
(function () {
  const DAY = 864e5;
  const label = (cc) => (cc && (cc.text || (cc.coding || []).map((c) => c.display).find(Boolean))) || "";
  const codes = (cc) => ((cc && cc.coding) || []).map((c) => c.code).filter(Boolean);
  const tOf = (o) => { const v = o.effectiveDateTime || (o.effectivePeriod && o.effectivePeriod.start) || o.issued || o.authoredOn || o.recordedDate || o.onsetDateTime; return v ? new Date(v).getTime() : null; };
  const last = (a) => (a && a.length ? a[a.length - 1] : null);
  const r1 = (v) => (Math.abs(v) >= 100 ? Math.round(v) : Math.round(v * 10) / 10);

  /* extra results this tab needs that the Discharge rules do not keep */
  const EXTRA = [
    { id: "glu", name: "Glucose", re: /glucose/i, not: /urine|csf|fluid|tolerance/i, loinc: ["2345-7", "2339-0", "41653-7"], conv: (v, u) => (/mg/i.test(u || "") ? v / 18 : v) },
    { id: "alt", name: "ALT", re: /\balt\b|alanine amino/i, loinc: ["1742-6", "1743-4"] },
    { id: "bili", name: "Bilirubin (total)", re: /bilirubin/i, not: /direct|conjugated|urine/i, loinc: ["1975-2"] },
    { id: "sbp", name: "Systolic BP", re: /systolic/i, loinc: ["8480-6"] },
    { id: "spo2", name: "SpO2", re: /spo2|oxygen saturation|pulse ox/i, loinc: ["59408-5", "2708-6"] },
    { id: "o2flow", name: "O2 flow", re: /oxygen flow|o2 flow|inhaled oxygen flow/i, loinc: ["3151-8", "19941-4"] },
    { id: "temp", name: "Temperature", re: /temperature|^temp/i, loinc: ["8310-5", "8331-1"] }];
  function extraLabs(obs) {
    const out = {};
    (obs || []).forEach((o) => {
      if (/registered|preliminary|cancelled|entered-in-error/.test(o.status || "")) return;
      const c = codes(o.code), n = label(o.code), t = tOf(o);
      const push = (id, v, u, conv) => { if (v == null || !t) return; (out[id] = out[id] || []).push({ t, v: conv ? conv(+v, u) : +v }); };
      (o.component || []).forEach((cp) => { const cc = codes(cp.code), cn = label(cp.code); if (cc.includes("8480-6") || /systolic/i.test(cn)) push("sbp", cp.valueQuantity && cp.valueQuantity.value); });
      const d = EXTRA.find((x) => c.some((k) => x.loinc.includes(k)) || (x.re.test(n) && !(x.not && x.not.test(n))));
      if (d && o.valueQuantity) push(d.id, o.valueQuantity.value, o.valueQuantity.unit, d.conv);
    });
    Object.values(out).forEach((a) => a.sort((x, y) => x.t - y.t));
    return out;
  }

  /* clinic criteria, in the clinic's words (used for the checklist and the reference card) */
  const CLINIC = {
    name: "South Island Discharge Clinic", list: "Discharge Clinic South Island - Referrals", reqPhrase: "Discharge Clinic patient",
    appropriate: ["Patients who require physician assessment at a frequency and urgency similar to an inpatient admission, but who can be safely managed as outpatients.",
      "Patients requiring close follow-up while awaiting a high-stakes investigation.",
      "Patients at high risk of returning to the hospital because of an acute medical condition."],
    doNot: [["nursing", "Require nursing care, intravenous medications, or oxygen therapy."], ["function", "Are not functionally independent for discharge."],
      ["stable", "Are clinically stable to wait for assessment through UMAC or an UPCC."], ["attend", "Cannot reliably attend clinic appointments, laboratory testing, imaging, or pharmacy visits."]],
    outOfScope: "Pediatrics, Surgery, Obstetrics and Gynecology, Dermatology, Ophthalmology, and Neurology." };

  /* each referral example: how the chart can show it, and what the clinic would be taking over */
  const FITS = [
    { id: "pending", name: "Urgent pending investigation with high suspicion of abnormality", take: "Follow up {pending}; act on the result and arrange the next step." },
    { id: "hf", name: "Acute heart failure", take: "Weight, volume status and diuretic adjustment; repeat creatinine and K in 3 to 7 days." },
    { id: "gdmt", name: "Starting / up-titrating heart failure GDMT", take: "Titrate GDMT ({gdmt}) with BP, K and creatinine checks." },
    { id: "af", name: "Rapid atrial fibrillation", take: "Review rate control (heart rate, symptoms) and adjust; anticoagulation plan." },
    { id: "holter", name: "Follow-up of Holter / ambulatory ECG", take: "Follow up the Holter result and act on it." },
    { id: "peri", name: "Pericarditis", take: "Symptom review, NSAID/colchicine course, repeat CRP." },
    { id: "copd", name: "COPD exacerbation", take: "Review breathing and steroid/antibiotic course; inhaler review." },
    { id: "htn", name: "Severe hypertension", take: "BP review (home readings) and medication titration." },
    { id: "anemia", name: "Significant but stable anemia / thrombocytopenia", take: "Repeat CBC in {cbcDays} days; complete the workup ({anemiaWhat})." },
    { id: "kidney", name: "New or worsening kidney disease", take: "Repeat creatinine and electrolytes in {crDays} days; medication review for kidney function." },
    { id: "liver", name: "New or worsening liver disease (not for the liver care clinic)", take: "Repeat liver tests; complete the workup." },
    { id: "cancer", name: "New metastatic disease / suspected malignancy needing expedited workup", take: "Expedite the workup (biopsy / staging) and refer on to oncology." },
    { id: "dm", name: "Very poorly controlled diabetes", take: "Review sugars and adjust insulin / diabetes medicines." },
    { id: "na", name: "Hyponatremia appropriate for outpatient assessment", take: "Repeat sodium in 48 to 72 hours; follow fluid restriction / medication changes." },
    { id: "abx", name: "Infection being treated with oral antibiotics", take: "Review response to oral antibiotics ({abx}) and stop date." },
    { id: "fuo", name: "Inflammation or fever of unknown etiology", take: "Complete the workup for fever / inflammation; repeat CRP." }];

  const RX = {
    peri: /pericarditis|I30|I31\.9/i, htn: /hypertensive (urgency|emergency|crisis)|severe hypertension|malignant hypertension|I16/i,
    liver: /hepatitis|cirrhosis|liver (disease|injury)|hepatic|transaminitis|cholestasis|K7[0-6]|R74/i,
    cancer: /metasta|malignan|neoplasm|carcinoma|lymphoma|leukemia|sarcoma|myeloma|\bC[0-9]{2}\b|suspicious for (malignancy|neoplasm)|concerning for (malignancy|neoplasm|metasta)/i,
    fuo: /fever of unknown|\bfuo\b|R50|unexplained (fever|inflammation)|pyrexia of unknown/i,
    anemia: /anemia|anaemia|thrombocytopenia|D5[0-9]|D6[0-4]|D69\.6/i, na: /hyponatremia|hyponatraemia|E87\.1|siadh/i,
    preg: /pregnan|O[0-9]{2}\b|postpartum/i, neuro: /stroke|tia|transient ischemic|seizure|epilepsy|I6[3-4]|G4[05]|multiple sclerosis|guillain/i,
    holter: /holter|ambulatory (ecg|ekg|cardiac monitor)|event monitor|zio patch/i,
    pendingHi: /biopsy|patholog|ct\b|mri|echo|bone marrow|endoscop|colonoscop|bronchoscop|pet\b|spep|flow cytometry|cytology|holter/i,
    oxygen: /\boxygen\b|\bo2\b/i, oxygenNote: /home oxygen|on (?:\d+(?:\.\d+)?\s*l(?:pm|\/min)?\s*(?:np|nasal|o2)|oxygen)|requir\w* (?:supplemental )?oxygen|new o2 requirement/i,
    nursing: /home (?:care )?nursing|community nursing|wound care nurse|opat|picc line (?:for|to) (?:home|outpatient)|iv antibiotics at home|daily dressing/i,
    function: /\balc\b|alternate level of care|awaiting (?:ltc|placement|long[- ]term care)|long[- ]term care|two[- ]person assist|2[- ]person assist|max(?:imal|imum)? assist|bed[- ]?bound|non[- ]?ambulatory|hoyer|not safe (?:for|to go) home/i,
    attend: /no fixed address|\bnfa\b|homeless|unhoused|no (?:working )?phone|no telephone|unable to attend|lives (?:remotely|on [a-z]+ island)/i };

  /* f: DcRules.parse(raw); raw: same raw bundle (for extra results and age) */
  function screen(f, raw) {
    const x = extraLabs(raw && raw.obs), L = f.labs || {}, prob = f.prob || {}, mc = f.medClass || {};
    const probText = (f.conditions || []).map((c) => c.name + " " + c.code).join(" | ") + " | " + (f.encReason || "");
    const repText = (f.reports || []).filter((r) => r.text).map((r) => r.name + ": " + r.text).join("\n");
    const noteText = (f.notes || []).map((n) => n.text).join("\n");
    const allText = probText + "\n" + repText + "\n" + noteText;
    const curMeds = (f.meds.discharge.length ? f.meds.discharge : f.meds.current).map((m) => m.text);
    const fits = [], flags = [], fill = {};
    const add = (id, why) => { const d = FITS.find((q) => q.id === id); if (d && !fits.some((q) => q.id === id)) fits.push({ id, name: d.name, why, take: d.take }); };
    const lv = (id) => last(L[id] || x[id]);
    const minOf = (a) => (a && a.length ? Math.min(...a.map((p) => p.v)) : null), maxOf = (a) => (a && a.length ? Math.max(...a.map((p) => p.v)) : null);

    // pending high-stakes investigations
    const pend = (f.reports || []).filter((r) => /registered|preliminary|partial/.test(r.status)).map((r) => r.name)
      .concat((f.pendingObs || []).map((o) => o.name), (f.orders || []).filter((o) => RX.pendingHi.test(o.name)).map((o) => o.name))
      .filter((n, i, a) => n && a.indexOf(n) === i && RX.pendingHi.test(n));
    if (pend.length) { add("pending", "Pending: " + pend.join(", ")); fill.pending = pend.join(", "); }
    if (RX.holter.test(allText) || (f.orders || []).some((o) => RX.holter.test(o.name))) add("holter", "Holter / ambulatory ECG mentioned in orders or notes");
    // cardiorespiratory
    if (prob.hf) add("hf", "Heart failure on the problem list" + (lv("nt") ? `; NT-proBNP ${r1(lv("nt").v)}` : ""));
    if (prob.hf) {
      const gd = []; if (mc.acei) gd.push("ACEi/ARB/ARNI"); if (curMeds.some((m) => /metoprolol|bisoprolol|carvedilol/i.test(m))) gd.push("beta-blocker");
      if (curMeds.some((m) => /spironolactone|eplerenone|finerenone/i.test(m))) gd.push("MRA"); if (mc.sglt2) gd.push("SGLT2i");
      const missing = ["ACEi/ARB/ARNI", "beta-blocker", "MRA", "SGLT2i"].filter((p) => !gd.includes(p));
      fill.gdmt = gd.length ? "on " + gd.join(", ") + (missing.length ? "; not on " + missing.join(", ") : "") : "none started";
      add("gdmt", gd.length < 4 ? "On " + (gd.length || "none") + (gd.length ? " (" + gd.join(", ") + ")" : "") + " of the 4 pillars: room to titrate" : "On all 4 pillars: doses to titrate?");
    }
    if (prob.af) add("af", "Atrial fibrillation / flutter on the problem list");
    if (RX.peri.test(probText)) add("peri", "Pericarditis on the problem list");
    if (prob.copd && /exacerbation|J44\.1/i.test(probText)) add("copd", "COPD exacerbation"); else if (prob.copd) add("copd", "COPD on the problem list (exacerbation?)");
    const sbpMax = maxOf((x.sbp || []).filter((p) => f.now - p.t < 3 * DAY));
    if (RX.htn.test(probText) || (sbpMax != null && sbpMax >= 180)) add("htn", sbpMax != null && sbpMax >= 180 ? `SBP up to ${Math.round(sbpMax)} in the last 3 days` : "Severe hypertension on the problem list");
    // blood counts
    const hb = lv("hb"), plt = lv("plt"), an = [];
    if (hb && hb.v < 90) an.push(`Hb ${r1(hb.v)}`); if (plt && plt.v < 100) an.push(`platelets ${r1(plt.v)}`);
    if (an.length || RX.anemia.test(probText)) { add("anemia", an.length ? an.join(", ") + " (latest)" : "Anemia / thrombocytopenia on the problem list"); fill.anemiaWhat = hb && hb.v < 90 ? "iron studies, B12, folate, retics; GI workup if iron deficient" : "smear, repeat count"; fill.cbcDays = hb && hb.v < 80 ? "3 to 5" : "5 to 7"; }
    // kidney
    const cr = L.cr || [], crFirst = cr[0], crLast = last(cr), crMin = minOf(cr);
    if (prob.aki || prob.ckd || (crLast && crMin && (crLast.v - crMin >= 26.5 || crLast.v >= 1.5 * crMin))) {
      add("kidney", prob.aki ? "AKI on the problem list" + (crLast ? `; creatinine ${r1(crLast.v)}` : "") : crLast && crMin && crLast.v - crMin >= 26.5 ? `Creatinine ${r1(crMin)} → ${r1(crLast.v)}` : "CKD on the problem list (worsening?)");
      fill.crDays = "3 to 7";
    }
    // liver
    const alt = last(x.alt), bili = last(x.bili);
    if (RX.liver.test(probText) || (alt && alt.v >= 200) || (bili && bili.v >= 50)) add("liver", [RX.liver.test(probText) ? "Liver problem on the list" : "", alt && alt.v >= 200 ? `ALT ${r1(alt.v)}` : "", bili && bili.v >= 50 ? `bilirubin ${r1(bili.v)}` : ""].filter(Boolean).join("; "));
    // malignancy
    const cm = (probText + "\n" + repText).match(RX.cancer);
    if (cm) add("cancer", `"${cm[0]}" in the ${RX.cancer.test(probText) ? "problem list" : "reports"}`);
    // diabetes
    const a1c = lv("a1c"), gluMax = maxOf((x.glu || []).filter((p) => f.now - p.t < 3 * DAY));
    if ((a1c && a1c.v >= 10) || (gluMax != null && gluMax >= 20) || (prob.dm && mc.insulin && f.meds.home.every((m) => !/insulin|glargine|detemir|degludec|lispro|aspart/i.test(m.text))))
      add("dm", [a1c && a1c.v >= 10 ? `A1c ${r1(a1c.v)}%` : "", gluMax != null && gluMax >= 20 ? `glucose up to ${r1(gluMax)}` : "", prob.dm && mc.insulin && f.meds.home.every((m) => !/insulin|glargine/i.test(m.text)) ? "insulin new this admission" : ""].filter(Boolean).join("; "));
    // sodium
    const na = lv("na"), naMin = minOf((L.na || []).filter((p) => f.now - p.t < 7 * DAY));
    if ((na && na.v < 130) || RX.na.test(probText)) add("na", na ? `Sodium ${r1(na.v)} (lowest ${r1(naMin)} this week)` : "Hyponatremia on the problem list");
    // oral antibiotics for an infection
    const poAbx = curMeds.filter((m) => /amoxicillin|clavulan|cefuroxime|cefalexin|cephalexin|cefixime|cefadroxil|doxycycline|azithromycin|clarithromycin|levofloxacin|moxifloxacin|ciprofloxacin|nitrofurantoin|trimethoprim|sulfamethoxazole|septra|clindamycin|metronidazole|linezolid|penicillin v/i.test(m) && !/\b(iv|intravenous)\b/i.test(m));
    if (poAbx.length && (prob.pna || prob.uti || prob.cell || prob.sepsis || /infection|abscess|osteomyelitis|pyelo|cellulitis|pneumonia/i.test(probText))) { add("abx", "On " + poAbx.join("; ")); fill.abx = poAbx.map((m) => m.split(" ")[0]).join(", "); }
    // fever / inflammation
    const tMax = maxOf((x.temp || []).filter((p) => f.now - p.t < 3 * DAY)), crp = lv("crp");
    if (RX.fuo.test(probText)) add("fuo", "Fever / inflammation of unknown cause on the problem list");

    /* do-not-refer / out-of-scope flags found in the chart (the physician confirms) */
    const pr = (raw && raw.patient) || f.patient || {}, age = pr.birthDate ? Math.floor((f.now - new Date(pr.birthDate)) / (365.25 * DAY)) : null;
    if (age != null && age < 18) flags.push({ id: "scope", hard: true, text: `Age ${age}: pediatrics is out of scope.` });
    if (RX.preg.test(probText)) flags.push({ id: "scope", text: "Pregnancy / postpartum on the problem list: obstetrics is out of scope." });
    if (RX.neuro.test(probText) && !fits.length) flags.push({ id: "scope", text: "Main problem looks neurological: neurology is out of scope." });
    const o2Now = (x.o2flow || []).filter((p) => f.now - p.t < DAY && p.v > 0), o2Med = curMeds.find((m) => RX.oxygen.test(m) && !/oxygen saturation/i.test(m)), o2Note = noteText.match(RX.oxygenNote);
    if (o2Now.length || o2Med || o2Note) flags.push({ id: "nursing", hard: true, text: "Oxygen: " + (o2Now.length ? `O2 flow ${r1(last(o2Now).v)} L/min charted in the last 24 h` : o2Med ? `order "${o2Med}"` : `"${o2Note[0]}" in a note`) + ". Patients needing oxygen therapy should not be referred." });
    const ivMeds = curMeds.filter((m) => /\b(iv|intravenous)\b/i.test(m) && !/flush|saline|lock/i.test(m));
    if (ivMeds.length) flags.push({ id: "nursing", hard: !!f.meds.discharge.length, text: `IV medicine ${f.meds.discharge.length ? "on the discharge list" : "still ordered (stopping before discharge?)"}: ${ivMeds.slice(0, 3).join("; ")}.` });
    const nm = noteText.match(RX.nursing); if (nm) flags.push({ id: "nursing", text: `"${nm[0]}" in a note: needs nursing care?` });
    const fm = noteText.match(RX.function); if (fm) flags.push({ id: "function", text: `"${fm[0]}" in a note: functionally independent for discharge?` });
    const am = noteText.match(RX.attend); if (am) flags.push({ id: "attend", text: `"${am[0]}" in a note: can they reliably attend appointments, labs, imaging and pharmacy?` });
    const phones = (pr.telecom || []).filter((t) => t.system === "phone" && t.value).map((t) => t.value + (t.use ? " (" + t.use + ")" : ""));
    if (!phones.length) flags.push({ id: "phone", text: "No phone number found in the chart: the clinic phones the patient. Add or confirm it in PowerChart." });

    const hard = flags.some((q) => q.hard);
    const verdict = !fits.length ? "none" : hard ? "flag" : "fit";
    return { fits, flags, verdict, phones, age, fill, signs: { tMax, crp: crp ? crp.v : null } };
  }

  function fillTake(t, fill) { return t.replace(/\{(\w+)\}/g, (_, k) => fill[k] || "…"); }

  /* the referral block for the ERP/MRP discharge note (the note is the referral) */
  function noteBlock(o) {
    const L = [];
    L.push("SOUTH ISLAND DISCHARGE CLINIC REFERRAL");
    L.push("Patient added to the Cerner list '" + CLINIC.list + "' on " + new Date(o.date || Date.now()).toISOString().slice(0, 10) + ".");
    if (o.reason) L.push("Reason for referral: " + o.reason);
    const take = (o.take || []).filter((t) => t && t.trim());
    if (take.length) { L.push("Responsibilities transferred to the Discharge Clinic:"); take.forEach((t) => L.push("- " + t.trim())); }
    const keep = (o.keep || "").trim(); if (keep) L.push("Not transferred (stays with " + keep + ").");
    if (o.subspec && o.subspec.trim()) L.push("Subspecialty referral(s) sent at the same time: " + o.subspec.trim() + ".");
    if (o.pending && o.pending.trim()) L.push("Pending at discharge: " + o.pending.trim() + ".");
    L.push("Investigations ordered as '" + CLINIC.reqPhrase + "' on the requisition.");
    if (o.phone) L.push("Patient phone confirmed in PowerChart: " + o.phone + ".");
    if (o.told) L.push("Patient told the clinic will phone on the first business day after referral (unscheduled call; voicemail if no answer), and what to do if worse before that call.");
    if (o.fp) L.push("After the clinic, care returns to: " + o.fp + ".");
    return L.join("\n");
  }

  /* short message to the Discharge Clinic Physician of the Day (Mon to Fri 08:00 to 17:00, schedule via Switchboard), in the user's consult format */
  function podMessage(o) {
    const who = [o.name, o.age ? o.age + (o.sex ? o.sex[0].toUpperCase() : "") : "", o.mrn ? "MRN " + o.mrn : ""].filter(Boolean).join(", ");
    return `Hello Dr. ___, This is Wayne, hospitalist at VGH. I have ${who || "[name, age, MRN]"}, ${o.story || "[brief history]"}. I think they fit the Discharge Clinic for: ${o.reason || "[reason]"}. Would you be able to take them? Your help is much appreciated. Thanks, Wayne`;
  }

  const api = { screen, extraLabs, noteBlock, podMessage, fillTake, CLINIC, FITS, DAY };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else window.DccRules = api;
})();
