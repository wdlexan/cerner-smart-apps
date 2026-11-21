/* node test_discharge.js : Discharge tab rules on MADE-UP patients. */
global.window = {}; require("../tools/discharge/samples.js"); const R = require("../tools/discharge/rules.js");
let pass = 0, fail = 0; const ok = (n, c, x) => { console.log((c ? "PASS " : "FAIL ") + n + (!c && x ? " | " + JSON.stringify(x).slice(0, 300) : "")); c ? pass++ : fail++; };
const S = window.DC_SAMPLES, now = Date.now(), run = (i) => { const f = R.parse(S[i].build(now)); return { f, meds: R.reconcile(f), chg: R.changes(f), pend: R.pending(f), inc: R.incidentals(f), mods: R.modules(f).map((m) => m.id) }; };
const st = (rows, k) => (rows.find((r) => r.key === k) || {}).status;
// A: heart failure + AF
let a = run(0);
ok("A furosemide changed, metoprolol changed", st(a.meds, "furosemide") === "changed" && st(a.meds, "metoprolol") === "changed", a.meds);
ok("A apixaban + dapagliflozin new, ramipril continue", st(a.meds, "apixaban") === "new" && st(a.meds, "dapagliflozin") === "new" && st(a.meds, "ramipril") === "continue");
ok("A naproxen and ASA flagged stopped", st(a.meds, "naproxen") === "stopped" && st(a.meds, "asa") === "stopped", a.meds.map((r) => r.key));
ok("A stopped heparin not listed, senna hospital-only", !a.meds.some((r) => r.key === "heparin") && st(a.meds, "senna") === "inpatient");
ok("A creatinine and weight changes notable", a.chg.labs.find((x) => x.id === "cr").big && a.chg.labs.find((x) => x.id === "wt").big);
ok("A echo and TSH pending", a.pend.some((p) => /Echo/.test(p.what)) && a.pend.some((p) => p.what === "TSH"), a.pend);
ok("A lung nodule with Fleischner follow-up; no 'no suspicious mass'", a.inc.length === 1 && /7 mm solid nodule/.test(a.inc[0].finding) && /Fleischner/.test(a.inc[0].followup), a.inc);
ok("A modules: hf, anticoag, af, not diabetes for dapagliflozin alone", ["hf", "anticoag", "af"].every((m) => a.mods.includes(m)) && !a.mods.includes("dm"), a.mods);
const sA = { f: a.f, meds: a.meds, chg: a.chg, pend: a.pend, inc: a.inc, mods: a.mods, v: { admit: a.f.admit, dc: now, fpDays: 7, dry: 79.5, fluidL: 1.5 } };
const pt = R.patientText(sA), fp = R.fpNote(sA);
ok("A patient: weight rule, salt, fluid limit, dapagliflozin sick-day + ER line", /1 kg \(2 lb\) in a day/.test(pt) && /2,000 mg of sodium/.test(pt) && /1.5 L a day/.test(pt) && /Stop dapagliflozin on sick days/.test(pt) && /while taking dapagliflozin/.test(pt), pt);
ok("A patient: bleeding signs and head injury for apixaban; 9-1-1 section", /Black, tarry/.test(pt) && /hit your head/.test(pt) && /CALL 9-1-1/.test(pt));
ok("A patient: no low-sugar advice", !/Low sugar/.test(pt));
ok("A patient: no duplicate NSAID line", (pt.match(/anti-inflammatory pain pills/g) || []).length === 1, pt.match(/anti-inflammatory/g));
ok("A FP note: changes, pending, incidental, follow-up", /CHANGED: furosemide 20 mg PO daily -> furosemide 40 mg PO BID/.test(fp) && /Echocardiogram.*Follow-up/.test(fp) && /7 mm solid nodule/.test(fp) && /within 7 days/.test(fp), fp);
ok("A no double periods", !/\.\./.test(fp) && !/\.\./.test(pt));
// B: pneumonia + COPD + diabetes
let b = run(1);
ok("B gliclazide stopped, glargine new, metformin continue", st(b.meds, "gliclazide") === "stopped" && st(b.meds, "insulin glargine") === "new" && st(b.meds, "metformin") === "continue", b.meds);
ok("B completed ceftriaxone not listed", !b.meds.some((r) => r.key === "ceftriaxone"));
ok("B blood culture preliminary, legionella, sputum pending once", b.pend.filter((p) => /Blood culture/.test(p.what)).length === 1 && b.pend.some((p) => /Legionella/.test(p.what)) && b.pend.filter((p) => /[Ss]putum/.test(p.what + p.detail)).length === 1, b.pend);
ok("B follow-up chest X-ray recommendation found", b.inc.some((x) => /6 to 8 weeks/.test(x.followup)), b.inc);
ok("B modules copd, infection, dm", ["copd", "infection", "dm"].every((m) => b.mods.includes(m)), b.mods);
// C: hip fracture, discharge prescriptions present
let c = run(2);
ok("C uses discharge prescriptions: enoxaparin new (not hospital-only), SC hydromorphone not listed", st(c.meds, "enoxaparin") === "new" && !c.meds.some((r) => /0\.5 mg SC/.test(r.text)), c.meds);
ok("C lorazepam stopped", st(c.meds, "lorazepam") === "stopped");
ok("C hemoglobin drop notable", c.chg.labs.find((x) => x.id === "hb").big);
ok("C T12 compression fracture found", c.inc.some((x) => /T12/.test(x.finding)), c.inc);
ok("C modules hip + opioid, no anticoag for prophylactic enoxaparin", c.mods.includes("hip") && c.mods.includes("opioid") && !c.mods.includes("anticoag"), c.mods);
const ptc = R.patientText({ f: c.f, meds: c.meds, chg: c.chg, pend: [], inc: c.inc, mods: c.mods, v: { wb: "full weight bearing as tolerated", vteWeeks: 4 } });
ok("C patient: weight bearing, 4 weeks, naloxone", /full weight bearing as tolerated/.test(ptc) && /for 4 weeks/.test(ptc) && /naloxone/.test(ptc), ptc);
// negation and helpers
ok("negated finding ignored", R.incidentals({ reports: [{ name: "CT abdomen", cat: "radiology", text: "No suspicious mass. No aneurysm.", t: now }], notes: [], admit: now - 864e5, now }).length === 0);
ok("insulins kept apart", R.medKey("insulin glargine 10 units") !== R.medKey("insulin lispro 4 units"));
ok("medKey drops salts", R.medKey("metoprolol tartrate 25 mg PO BID") === "metoprolol" && R.medKey("ASA 81 mg") === "asa");
// follow-up in the community + draft discharge note (MADE-UP text)
{
  const t = "Plan:\n1. Refer to heart function clinic in 4-6 weeks.\n2. Repeat lytes and creatinine in 1 week.\n3. Outpatient echocardiogram.\n4. CT chest showed RUL nodule; repeat CT chest in 6 months.\n5. No need for GI follow-up.\n6. Follow up with family doctor in 7 days.\nCT head was normal.";
  const fu = R.followups([{ name: "note", text: t }]), ty = (re) => (fu.find((x) => re.test(x.text)) || {}).type;
  ok("followups: referral with timing, one line per service", ty(/heart function/i) === "referral" && fu.find((x) => /heart function/i.test(x.text)).text === "Heart function clinic: to refer; in 4-6 weeks", fu);
  ok("followups: imaging (echo, repeat CT) and lab", ty(/echocardiogram/) === "imaging" && ty(/repeat CT/) === "imaging" && ty(/lytes/) === "lab");
  ok("followups: 'No need for GI follow-up' and a normal result are not follow-ups", !fu.some((x) => /GI follow-up|CT head/.test(x.text)), fu.map((x) => x.text));
  ok("followups: page header lines skipped", R.followups([{ name: "p", text: "Onc. Medical Follow-Up Clinic Note\nMRN: 1234567 PHN: 9999999999" }]).length === 0);
  ok("detect: 'April' is not an ACE inhibitor", !R.detect("Seen in April 2025 for review.").medClass.acei && R.detect("ramipril 5 mg daily").medClass.acei === "ramipril");
  ok("detect: negated problem ignored", !R.detect("No history of atrial fibrillation.").prob.af && R.detect("New atrial fibrillation.").prob.af);
  const det = R.detect("Heart failure. Started apixaban 5 mg BID.");
  const note = R.draftNote({ title: "made-up", patient: "Test Patient", sections: [{ name: "Plan", body: "1. Refer to heart function clinic." }], meds: ["apixaban 5 mg BID"], follow: fu, pending: ["TSH pending."], mods: ["general"].concat(R.modules(det).map((m) => m.id).filter((x) => x !== "general")), v: { fpDays: 7 }, f: det });
  ok("draftNote: headings", ["DISCHARGE NOTE (DRAFT)", "FOLLOW-UP IN THE COMMUNITY", "Specialist follow-up, referrals and services:", "Imaging and procedures:", "Lab tests:", "PENDING RESULTS", "WHAT TO WATCH FOR", "Call 9-1-1", "family doctor or primary care provider"].every((h) => note.includes(h)), note);
  ok("draftNote: heart failure and blood thinner warnings", /1 kg \(2 lb\)/.test(note) && /Black, tarry/.test(note));
  const a = run(0), fp = R.fpNote({ f: a.f, fol: R.followups(a.f.notes), meds: a.meds, chg: a.chg, pend: a.pend, inc: a.inc, mods: a.mods, v: { fpDays: 7 } });
  ok("fpNote: follow-up in the community + what to watch for", /FOLLOW-UP IN THE COMMUNITY\nSpecialist follow-up, referrals and services:\n  - Heart function clinic: to refer; in 4 to 6 weeks/.test(fp) && /WHAT TO WATCH FOR/.test(fp) && /Holter/.test(fp), fp);
}
// hospital-course style note (MADE-UP names): Dr./Nov. abbreviations, doctor named elsewhere, "him", services, past appointments
{
  const t = "Hospital Course\n40-year-old woman followed by nephrology (Dr. Testerson) and internal medicine (Dr. Sampleton) in community. She had an appointment with Dr. Testerson last Friday but was unable to keep it. She has a scheduled follow up with Dr. Sampleton Dec. 3.\nShe was seen by Dr. Fakename (ENT). She has a follow up with him in early 2027.\nShe has been restarted on regularly scheduled metoclopramide 10 mg QID. She has been seen by dietitian and understands the need to re-introduce oral intake. She was re-referred to Hospital at Home for monitoring of her electrolytes. I have completed a referral to GI Central for consideration of EGD as an outpatient.";
  const fu = R.followups([{ name: "n", text: t }]), f = (re) => fu.find((x) => re.test(x.text));
  const txt = fu.map((x) => x.text);
  ok("hc: one line per service, doctor and specialty from elsewhere in the note, no pronouns", JSON.stringify(txt) === JSON.stringify([
    "Nephrology (Dr. Testerson): missed appointment last Friday: rebook", "Internal medicine (Dr. Sampleton): booked Dec. 3", "ENT (Dr. Fakename): follow-up in early 2027",
    "Hospital at Home: referral sent; monitoring of electrolytes", "Gastroenterology (GI Central): referral sent; EGD as an outpatient"]), txt);
  ok("hc: no 'she' and no owner guessed", !txt.some((x) => /\bshe\b/i.test(x)) && fu.every((x) => !x.owner));
  const fu2 = R.followups([{ name: "n", text: t + "\nFollow up will be with nephrology (Testerson) and internal medicine (Sampleton) as well as gastroenterology (via referral to GI Central).\nFollow up Dr. Sampleton through UMAC Dec. 3." }]);
  ok("hc: repeated mentions merged, 'via UMAC' kept", fu2.length === 5 && fu2[1].text === "Internal medicine (Dr. Sampleton): booked Dec. 3; via UMAC", fu2.map((x) => x.text));
  const note = R.draftNote({ sections: [{ name: "Hospital Course", body: "Course text." }], follow: fu, mods: ["general"], v: {} });
  ok("hc: course in SUMMARY; missed appointment marked to rebook", /SUMMARY\nCourse text\./.test(note) && /missed appointment last Friday: rebook/.test(note), note);
}
// discharge-summary style note (MADE-UP): consults, initials, cc lines, "US Renal", divider, own drafts not read back
{
  const t = "Plan\nLeave catheter in situ at discharge\n- Home Care referral at discharge for catheter changes\nUrology consult as an outpatient for cystoscopy\n- cc Dr. Madeup on DC Summary\nUS Renal booked [1]\nOutpatient urology consult for cystoscopy.\n- cc Dr. J. Madeup on DC summary[2]\nSpecialists Consulted\nUrology: Dr. J. Madeup\nDisposition\nOutpatient urology consult with cystoscopy. CC Dr. Madeup on discharge summary\n------------------------------\nNB: This document has been created with Dragon Dictate.";
  const fu = R.followups([{ name: "n", text: t }]), txt = fu.map((x) => x.text);
  ok("dc: urology once, with cystoscopy and cc; home care; US renal", JSON.stringify(txt) === JSON.stringify(["Home and community care: to refer; catheter changes", "Urology (Dr. Madeup): outpatient consult for cystoscopy; cc on discharge summary", "US Renal booked"]), txt);
  const det = R.detect(t + " Discharge with urinary catheter. On apixaban for atrial fibrillation.");
  ok("dc: catheter plan applies", R.modules(det).some((m) => m.id === "catheter"));
  const w = R.watchFor(["general"].concat(R.modules(det).map((m) => m.id)), { sex: "male" }, det);
  ok("dc: catheter blocked = Emergency; no 'periods' line for a male patient", w.er.some((x) => /No urine has drained/.test(x)) && !w.call.some((x) => /periods/.test(x)));
  ok("dc: 'us' as a word is not ultrasound", R.followups([{ name: "n", text: "Please call us to book a follow up appointment." }]).every((x) => x.type !== "imaging"));
  const f = R.parse({ notes: [{ name: "Imported PDF: x (draft discharge note)", text: "DISCHARGE NOTE (DRAFT)\nFOLLOW-UP IN THE COMMUNITY" }, { name: "Imported PDF: y", text: "DISCHARGE SUMMARY - KEY POINTS FOR FAMILY PHYSICIAN" }, { name: "Progress note", text: "Refer to urology." }] });
  ok("dc: the toolkit's own drafts are not read back as notes", f.notes.length === 1 && f.notes[0].name === "Progress note");
}
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
