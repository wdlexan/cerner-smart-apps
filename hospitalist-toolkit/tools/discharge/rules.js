/* Discharge tab: rules. READ-ONLY, orders nothing. UNVERIFIED draft written by Claude (general knowledge, Canadian/BC wording, to mid-2026):
   the physician reviews and edits every line before it goes in a note or to a patient.
   parse(raw)          raw FHIR -> facts (admission, meds, labs, problems, reports, notes)
   reconcile(f)        home vs current/discharge medication list -> new / changed / stopped / continue / inpatient only
   changes(f)          labs and weight on admission vs latest, new problems this admission
   pending(f)          results not final yet, orders with no result
   incidentals(f)      sentences in imaging reports and notes that look like incidental findings needing follow-up
   modules(f)          condition plans that apply (heart failure, COPD, anticoagulant, diabetes, ...): home care, call the family doctor, 9-1-1
   fpNote(s), patientText(s)  the two outputs, built from the physician's choices (s) */
(function () {
  const DAY = 864e5;
  const label = (cc) => (cc && (cc.text || (cc.coding || []).map((c) => c.display).find(Boolean))) || "";
  const codes = (cc) => ((cc && cc.coding) || []).map((c) => String(c.code || ""));
  const tOf = (r) => { const d = r.effectiveDateTime || (r.effectivePeriod && r.effectivePeriod.start) || r.issued || r.authoredOn || r.recordedDate || r.onsetDateTime || r.date || (r.meta && r.meta.lastUpdated) || ""; const t = d ? new Date(d).getTime() : NaN; return isNaN(t) ? null : t; };
  const fmtD = (t) => (t ? new Date(t).toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" }) : "");
  const num = (v) => (v == null ? "" : Math.abs(v) >= 100 ? String(Math.round(v)) : String(Math.round(v * 10) / 10));

  /* ---------- labs worth comparing on admission vs discharge ---------- */
  const mgdl = (f) => (v, u) => (/mg\s*\/\s*dl/i.test(u || "") ? v * f : v);
  const URINE = /urine|\bur\b/i;
  const KEYLABS = [
    { id: "hb", name: "Hemoglobin", unit: "g/L", loinc: ["718-7"], re: /hemoglobin|haemoglobin|^hgb/i, not: /a1c|glyc/i, conv: (v, u) => (/g\s*\/\s*dl/i.test(u || "") ? v * 10 : v), big: 15 },
    { id: "wbc", name: "WBC", unit: "x10^9/L", loinc: ["6690-2", "26464-8"], re: /white blood|^wbc|leukocyte/i, not: URINE, big: 4 },
    { id: "plt", name: "Platelets", unit: "x10^9/L", loinc: ["777-3", "26515-7"], re: /platelet/i, big: 50 },
    { id: "na", name: "Sodium", unit: "mmol/L", loinc: ["2951-2", "2947-0"], re: /sodium/i, not: URINE, big: 4 },
    { id: "k", name: "Potassium", unit: "mmol/L", loinc: ["2823-3", "6298-4"], re: /potassium/i, not: URINE, big: 0.6 },
    { id: "cr", name: "Creatinine", unit: "umol/L", loinc: ["2160-0", "38483-4"], re: /creatinine/i, not: /ratio|kinase|clearance|urine/i, conv: mgdl(88.4), bigPct: 0.25 },
    { id: "egfr", name: "eGFR", unit: "mL/min/1.73m2", loinc: ["33914-3", "62238-1", "98979-8", "48642-3", "48643-1"], re: /egfr|glomerular filtration/i, big: 10 },
    { id: "alb", name: "Albumin", unit: "g/L", loinc: ["1751-7", "61151-7"], re: /albumin/i, not: URINE, big: 5 },
    { id: "crp", name: "CRP", unit: "mg/L", loinc: ["1988-5", "30522-7"], re: /c.?reactive/i, bigPct: 0.5 },
    { id: "nt", name: "NT-proBNP", unit: "ng/L", loinc: ["33762-6", "83107-3", "71425-3"], re: /nt-?pro ?bnp|n-terminal/i, bigPct: 0.3 },
    { id: "inr", name: "INR", unit: "", loinc: ["6301-6", "34714-6"], re: /\binr\b|international normali/i, big: 0.5 },
    { id: "a1c", name: "Hemoglobin A1c", unit: "%", loinc: ["4548-4", "17856-6"], re: /a1c|glycated/i, big: 0.5 },
    { id: "wt", name: "Weight", unit: "kg", loinc: ["29463-7", "3141-9", "8350-1"], re: /body weight|^weight|daily weight/i, conv: (v, u) => (/lb/i.test(u || "") ? v * 0.4536 : v), big: 2 }];
  const pickLab = (r) => { const c = codes(r.code), n = label(r.code); return KEYLABS.find((d) => c.some((x) => d.loinc.includes(x)) || (d.re.test(n) && !(d.not && d.not.test(n)))); };

  /* ---------- medicines ---------- */
  const medName = (m) => {
    let t = label(m.medicationCodeableConcept) || (m.medicationReference && m.medicationReference.display) || "";
    if (!t && m.medicationReference && m.contained) { const c = m.contained.find((x) => m.medicationReference.reference === "#" + x.id); if (c) t = label(c.code); }
    return t;
  };
  const medText = (m) => {
    const di = (m.dosageInstruction || m.dosage || [])[0] || (m.dosage && !Array.isArray(m.dosage) ? m.dosage : null);
    const t = medName(m), extra = di && di.text && !t.toLowerCase().includes(String(di.text).toLowerCase()) ? " " + di.text : "";
    return (t + extra).replace(/\s+/g, " ").trim();
  };
  // ingredient key: first real word, salts dropped ("metoprolol tartrate 25 mg" -> metoprolol)
  const SALT = /^(?:sodium|potassium|calcium|magnesium|hydrochloride|hcl|tartrate|succinate|besylate|maleate|mesylate|citrate|acetate|sulfate|sulphate|phosphate|er|xr|sr|cr|xl|la|dr|ec|extended|release|tablet|tab|capsule|cap|oral|injection|inj)$/i;
  const STOPWORD = /^(?:start|started|restart|new|take|give|hold|held|continue|po|iv|sc|subcut|im|sl|pr|prn|daily|bid|tid|qid|qhs|mg|mcg|g|ml|units?|unit)$/i;
  function medKey(text) {
    const w = String(text || "").toLowerCase().replace(/[^a-z\s-]/g, " ").split(/\s+/).filter((x) => x.length > 2 && !SALT.test(x) && !STOPWORD.test(x));
    if (w[0] === "insulin" && w[1]) return "insulin " + w[1]; // glargine, lispro, nph… are different medicines
    return w[0] || String(text || "").toLowerCase().trim();
  }
  const doseOf = (text) => { const m = /(\d+(?:\.\d+)?)\s*(mg|mcg|g|units?|ml|mmol|meq)\b/i.exec(text || ""); return m ? (+m[1] + " " + m[2].toLowerCase()) : ""; };
  const freqOf = (text) => { const m = /\b(daily|once daily|od|qd|bid|twice daily|tid|qid|q\d+h|qhs|at bedtime|weekly|prn|as needed|every \d+ hours?)\b/i.exec(text || ""); if (!m) return ""; const f = m[1].toLowerCase(); return { od: "daily", qd: "daily", "once daily": "daily", "twice daily": "bid", "at bedtime": "qhs", "as needed": "prn" }[f] || f; };
  const routeOf = (text) => { const m = /\b(iv|intravenous|sc|subcut|subcutaneous|im|po|oral|sl|pr|inhaled|inh|topical|patch)\b/i.exec(text || ""); if (!m) return ""; const r = m[1].toLowerCase(); return { intravenous: "iv", subcut: "sc", subcutaneous: "sc", oral: "po", inh: "inhaled" }[r] || r; };
  // usually hospital-only: suggested "stop at discharge" (physician confirms)
  const INPT_ONLY = /\b(?:heparin|sodium chloride|normal saline|ringer|plasma-?lyte|dextrose|d5w|potassium chloride (?:iv|in)|ondansetron|dimenhydrinate|lorazepam prn|zopiclone|melatonin|senna|sennosides|docusate|lactulose prn|polyethylene glycol prn|acetaminophen prn|hydromorphone (?:iv|sc|inj)|morphine (?:iv|sc|inj)|nicotine|chlorhexidine|insulin (?:regular|lispro|aspart) (?:sliding|correction|scale)|correction insulin|sliding scale|oxygen)\b/i;
  const PROPHYLAXIS = /\b(?:enoxaparin 40 ?mg|dalteparin 5000|tinzaparin 4500|heparin 5,?000)\b/i;

  function catOf(m) { const c = (m.category || []).flatMap((x) => codes(x).concat(label(x))).join(" ").toLowerCase(); return /discharge/.test(c) ? "discharge" : /community|outpatient|home|patientspecified/.test(c) ? "home" : /inpatient/.test(c) ? "inpatient" : ""; }

  /* ---------- problems and condition modules ---------- */
  const PROB = {
    hf: /heart failure|I50|cardiomyopathy|I42|HFrEF|HFpEF/i, copd: /\bcopd\b|J44|emphysema|chronic bronchitis/i, asthma: /asthma|J45/i,
    pna: /pneumonia|J1[2-8]|lower respiratory (tract )?infection|J22/i, uti: /urinary tract infection|\buti\b|pyelonephritis|N39\.0|N10|urosepsis/i, cell: /cellulitis|L03|skin and soft tissue/i, sepsis: /sepsis|A41|bacteremia|R78\.81/i,
    af: /atrial fib|flutter|I48/i, vte: /pulmonary embol|I26|deep vein thromb|\bdvt\b|I82\.4|venous thromboembol/i, stroke: /stroke|cerebral infarct|I6[3-4]|transient ischemic|\btia\b|G45/i,
    dm: /diabetes|E1[0-4]/i, gib: /gastrointestinal (hemorrhage|bleed)|gi bleed|K92\.[0-2]|melena|hematemesis|peptic ulcer.*bleed|upper gi bleed/i,
    aki: /acute kidney injury|\baki\b|N17|acute renal failure/i, ckd: /chronic kidney|N18/i, hip: /hip fracture|fracture of (the )?(neck of )?femur|S72|intertrochanteric|femoral neck/i,
    falls: /\bfalls?\b|W1[0-9]|R29\.6/i, delirium: /delirium|F05/i, hypona: /hyponatremia|E87\.1/i, cirrhosis: /cirrho|K74|K70\.3/i };
  const MEDCLASS = {
    anticoag: /apixaban|eliquis|rivaroxaban|xarelto|edoxaban|lixiana|dabigatran|pradaxa|warfarin|coumadin|enoxaparin (?:[5-9]\d|1\d\d) ?mg|dalteparin (?:[1-9]\d{4})|tinzaparin (?:[1-9]\d{4})/i,
    warfarin: /warfarin|coumadin/i, insulin: /insulin|glargine|lantus|basaglar|toujeo|detemir|levemir|degludec|tresiba|lispro|humalog|aspart|novorapid|fiasp|humulin|novolin/i,
    su: /gliclazide|diamicron|glyburide|glimepiride/i, sglt2: /dapagliflozin|forxiga|empagliflozin|jardiance|canagliflozin|invokana|ertugliflozin/i, metformin: /metformin|glumetza|janumet|jentadueto|synjardy|xigduo/i,
    loop: /furosemide|lasix|bumetanide|torsemide|torasemide/i, opioid: /morphine|hydromorphone|dilaudid|oxycodone|percocet|tramadol|tapentadol|codeine|tylenol #3|fentanyl|methadone|buprenorphine/i,
    antibiotic: /amoxicillin|clavulan|cefuroxime|cefalexin|cephalexin|cefixime|cefadroxil|ceftriaxone|cefazolin|doxycycline|azithromycin|clarithromycin|levofloxacin|moxifloxacin|ciprofloxacin|nitrofurantoin|macrobid|trimethoprim|sulfamethoxazole|septra|bactrim|metronidazole|clindamycin|linezolid|penicillin|cloxacillin|fosfomycin|piperacillin|meropenem|vancomycin/i,
    steroid: /prednisone|prednisolone|dexamethasone|methylprednisolone/i, inhaler: /salbutamol|ventolin|tiotropium|spiriva|umeclidinium|glycopyrronium|formoterol|salmeterol|budesonide|fluticasone|trelegy|breo|symbicort|advair|anoro|ultibro|inspiolto|breztri|indacaterol/i,
    ppi: /pantoprazole|omeprazole|esomeprazole|rabeprazole|lansoprazole|dexlansoprazole/i, nsaid: /ibuprofen|naproxen|diclofenac|ketorolac|celecoxib|meloxicam|indomethacin/i,
    acei: /pril\b|sartan\b|sacubitril|entresto/i, bisphos: /alendronate|risedronate|zoledronic|denosumab|prolia/i };

  /* Condition modules. Each: why it applies, things to do at home, call the family doctor (or clinic) the same day, go to Emergency or call 9-1-1, family doctor tasks.
     Plain language for patients (about grade 6); "fp" lines are for the family doctor note. Fields in {braces} are filled from the form or left blank. */
  const MODULES = [
    { id: "general", name: "Everyone (general)", always: true,
      home: ["Take your medicines exactly as listed on your new medicine list. Throw away or set aside old lists so you do not mix them up.", "Bring this sheet and all your pill bottles to your family doctor visit.", "Rest, eat well and walk a little more each day, unless you were told otherwise."],
      call: ["You have a fever over 38 °C (100.4 °F), or chills.", "You are vomiting or cannot keep fluids or pills down for more than a day.", "You have new pain, or pain that is getting worse and is not helped by your pain medicine.", "You are peeing much less than usual, or feel dizzy when you stand up.", "You are not sure how to take a medicine, or think a medicine is causing side effects."],
      er: ["Chest pain or pressure.", "Severe trouble breathing.", "Fainting, or new confusion or very hard to wake up.", "Signs of a stroke: face drooping, arm or leg weakness, trouble speaking, sudden loss of vision (BE FAST: call 9-1-1 right away).", "Bleeding that will not stop after 10 minutes of firm pressure.", "A seizure."],
      fp: [] },
    { id: "hf", name: "Heart failure", prob: "hf", med: null,
      home: ["Weigh yourself every morning after you pee and before you eat, on the same scale. Write it down and bring the log to your appointments.{dry}", "Eat less salt: aim for less than 2,000 mg of sodium a day. Avoid canned soups, deli meats, frozen dinners, chips, pickles, soy sauce and fast food.", "{fluid}", "Do not take anti-inflammatory pain pills: ibuprofen (Advil, Motrin) or naproxen (Aleve). Acetaminophen (Tylenol) is OK.", "Sick days: if you are vomiting, have diarrhea or cannot eat or drink, call your doctor or pharmacist about holding your water pill and some heart pills until you are eating and drinking again.", "{sglt2}"],
      call: ["Your weight goes up more than 1 kg (2 lb) in a day or more than 2 kg (5 lb) in a week.", "You are more short of breath, need more pillows to sleep, or wake up short of breath.", "Your legs, ankles or belly are more swollen."],
      er: ["You are very short of breath at rest or cannot lie flat, or cough up pink frothy spit.", "{sglt2er}"],
      fp: ["Electrolytes and creatinine in 1 week (diuretic / RAAS changes).", "Review daily weight log and diuretic dose at the first visit.", "Titrate guideline-directed medical therapy as tolerated."], handout: "Heart failure tab → Patient handout (daily weight log)" },
    { id: "copd", name: "COPD", prob: "copd",
      home: ["Use your inhalers every day as prescribed, even when you feel well. Ask your pharmacist to check how you use them.", "Finish any prednisone or antibiotic course exactly as written.", "If you smoke, stopping is the best thing you can do for your lungs. QuitNow (1-877-455-2233, quitnow.ca) is free in BC.", "Ask your doctor about pulmonary rehabilitation and about your flu, COVID, pneumococcal and RSV vaccines."],
      call: ["You are more short of breath than usual, or need your rescue inhaler (salbutamol/Ventolin) much more often.", "Your spit (sputum) changes colour or there is more of it.", "You have a fever."],
      er: ["You are too short of breath to speak in sentences, your lips or fingertips look blue or grey, or you are drowsy or confused."],
      fp: ["Review inhaler technique and COPD action plan.", "Pulmonary rehabilitation referral if not done.", "Spirometry if not done before."] },
    { id: "infection", name: "Infection on antibiotics", prob: ["pna", "uti", "cell", "sepsis"], med: "antibiotic",
      home: ["Finish your antibiotic: last dose on {abxEnd}. Do not stop early even if you feel better.", "Tiredness and some cough can last 2 to 6 weeks after pneumonia. Build up your activity slowly.", "Drink plenty of fluids unless you were told to limit fluids."],
      call: ["Your fever comes back, or you are not getting better after 2 to 3 days at home.", "You have 3 or more watery stools a day, or diarrhea with blood or belly pain (this can be a bowel infection from antibiotics).", "You get a new rash, hives or itch after taking the antibiotic.", "Skin infection: the redness spreads past the line drawn on your skin, or the area becomes more painful or swollen."],
      er: ["Very short of breath, confused, very drowsy, or feel faint (these can be signs of a serious infection)."],
      fp: ["Confirm clinical response and completion of antibiotics.", "Pneumonia in a smoker or age over 50: consider follow-up chest imaging in 6 to 8 weeks if not already planned."] },
    { id: "anticoag", name: "Blood thinner", prob: ["af", "vte"], med: "anticoag",
      home: ["Take your blood thinner ({anticoag}) every day at the same time. Do not skip doses. If you miss one, ask your pharmacist what to do; never take a double dose.", "Tell every doctor, dentist and pharmacist that you take a blood thinner before any procedure or new medicine.", "Do not take anti-inflammatory pain pills: ibuprofen (Advil, Motrin) or naproxen (Aleve). Acetaminophen (Tylenol) is OK.", "Do not take ASA (Aspirin) unless your doctor says so.", "{warfarin}"],
      call: ["Bruising more than usual, nosebleeds or bleeding gums that are hard to stop.", "Pink, red or brown urine.", "Heavier periods than usual."],
      er: ["Black, tarry or bloody stools, or vomiting blood or what looks like coffee grounds.", "A fall where you hit your head, a bad headache that is new, or any head injury (even if you feel fine).", "A new swollen, painful leg, or sudden shortness of breath."],
      fp: ["Check CBC and creatinine (DOAC dose review) at follow-up; review bleeding risk and continuing need/duration."] },
    { id: "af", name: "Atrial fibrillation", prob: "af",
      home: ["Take your heart rate medicine every day. Check your pulse if you were shown how."],
      call: ["Your heart races or flutters more often, or you feel dizzy, weak or more short of breath."],
      er: ["Fast heartbeat with chest pain, fainting or feeling like you will pass out."],
      fp: ["Review rate control (resting heart rate) and CHA2DS2-VASc / anticoagulation; outpatient echocardiogram if not done."] },
    { id: "dm", name: "Diabetes (insulin or pills that can cause low sugar)", prob: "dm", med: ["insulin", "su"],
      home: ["Check your blood sugar {glucose}. Write it down and bring the log to your doctor.", "Low sugar (under 4 mmol/L, or shaky, sweaty, confused): take 15 g of fast sugar (4 glucose tablets, 3/4 cup of juice or regular pop), check again in 15 minutes, repeat if still under 4, then eat a snack.", "Sick days: if you cannot eat or drink, call your doctor or pharmacist about which diabetes, water and blood pressure pills to hold (\"SADMANS\" list).", "{sglt2}"],
      call: ["More than one low sugar in a week, or any low sugar you needed help with.", "Sugars above 20 mmol/L on two checks in a row."],
      er: ["A low sugar that does not improve with treatment, or you are confused or cannot stay awake.", "{sglt2er}"],
      fp: ["Review glucose log and diabetes medicines within 1 to 2 weeks (dose changes made in hospital).", "A1c if not done in 3 months."] },
    { id: "stroke", name: "Stroke or TIA", prob: "stroke",
      home: ["Take your stroke prevention medicines every day (blood thinner or antiplatelet, cholesterol and blood pressure pills).", "Driving: {driving}.", "Keep moving and do the exercises your therapists gave you."],
      call: ["New trouble swallowing, low mood, or you are not managing at home."],
      er: ["Any new stroke sign: Face drooping, Arm weakness, Speech trouble, sudden loss of Balance or Eyesight. Note the time and call 9-1-1 right away, even if it goes away."],
      fp: ["Stroke prevention clinic / neurology follow-up as arranged.", "Blood pressure, lipid and glucose targets; driving status per guidelines."] },
    { id: "gib", name: "Stomach or bowel bleeding", prob: "gib",
      home: ["Take your stomach-protecting medicine ({ppi}) as prescribed.", "Do not take anti-inflammatory pain pills: ibuprofen (Advil, Motrin) or naproxen (Aleve). Acetaminophen (Tylenol) is OK.", "Do not take ASA (Aspirin) unless your doctor says so, and avoid alcohol."],
      call: ["You feel more tired or short of breath than when you left hospital (this can mean a low blood count)."],
      er: ["Black, tarry or bloody stools, vomiting blood or coffee-ground material, or fainting."],
      fp: ["Repeat CBC in {hbDays} days.", "Confirm endoscopy follow-up / H. pylori result and PPI duration."] },
    { id: "kidney", name: "Kidney injury", prob: ["aki"],
      home: ["Drink to thirst (unless you were told to limit fluids).", "Do not take anti-inflammatory pain pills: ibuprofen (Advil, Motrin) or naproxen (Aleve). Acetaminophen (Tylenol) is OK.", "Sick days: if you are vomiting, have diarrhea or cannot drink, ask your doctor or pharmacist which pills to hold (water pills, some blood pressure pills, metformin).", "{sglt2}"],
      call: ["You are peeing much less than usual, or your legs are more swollen."],
      er: [],
      fp: ["Repeat creatinine and electrolytes in {crDays} days.", "Review medicines held for kidney function and restart if appropriate."] },
    { id: "hip", name: "Hip fracture (co-managed with orthopedics)", prob: "hip",
      home: ["Weight bearing: {wb}. Do your physiotherapy exercises every day.", "Use your walker or cane as shown, and wear firm shoes. Remove loose rugs and clutter, use night lights, and have a grab bar in the bathroom.", "Keep the wound clean and dry. Staples or stitches out on {staples}.", "Take your blood thinner to prevent clots for {vteWeeks} weeks after surgery.", "Take your pain medicine and a laxative to prevent constipation."],
      call: ["The wound gets red, hot, more painful, or drains fluid.", "Your calf is swollen or painful.", "You are constipated for more than 3 days."],
      er: ["You cannot put weight on the leg when you could before, or the leg looks shorter or turned out.", "Sudden shortness of breath or chest pain.", "Another fall with a new injury."],
      fp: ["Bone health: start or continue osteoporosis treatment (e.g. bisphosphonate or denosumab) after vitamin D and calcium are replete; BMD if needed.", "Falls risk review (medicines, vision, home safety); confirm orthopedic follow-up and staple removal."] },
    { id: "opioid", name: "Opioid pain medicine", med: "opioid",
      home: ["Take the lowest dose you need and stop as the pain improves. Use acetaminophen (Tylenol) regularly first if you can.", "Do not drive, drink alcohol, or take sleeping pills or cannabis with this medicine.", "Take a laxative every day while on it.", "Keep it locked away from children and others. Return unused pills to a pharmacy.", "Ask your pharmacist for a free take-home naloxone kit."],
      call: ["You are constipated for more than 3 days, or very sleepy during the day."],
      er: ["Someone cannot wake you, your breathing is slow or shallow, or your lips are blue: they should call 9-1-1 and use naloxone."],
      fp: ["Opioid supply given: plan taper and stop; check PharmaNet before renewing."] }];

  function parse(raw) {
    raw = raw || {}; const f = { patient: raw.patient || null, now: raw.now || Date.now() };
    const enc = (raw.encounters || []).filter((e) => e.period && e.period.start).sort((a, b) => new Date(b.period.start) - new Date(a.period.start))[0];
    f.admit = enc ? new Date(enc.period.start).getTime() : null; f.encEnd = enc && enc.period.end ? new Date(enc.period.end).getTime() : null;
    f.encReason = enc ? ((enc.reasonCode || []).map(label).filter(Boolean).join(", ") || ((enc.diagnosis || []).map((d) => d.condition && d.condition.display).filter(Boolean).join(", "))) : "";
    // problems
    f.conditions = (raw.conditions || []).filter((c) => !c.clinicalStatus || codes(c.clinicalStatus).some((x) => /active|recurrence|relapse/.test(x)) || !codes(c.clinicalStatus).length)
      .map((c) => ({ name: label(c.code), code: codes(c.code).join(" "), t: tOf(c) })).filter((c) => c.name);
    const probText = f.conditions.map((c) => c.name + " " + c.code).join(" | ") + " | " + f.encReason;
    f.prob = {}; Object.keys(PROB).forEach((k) => { if (PROB[k].test(probText)) f.prob[k] = true; });
    // medicines
    const reqs = (raw.medreqs || []).map((m) => ({ text: medText(m), status: m.status || "active", cat: catOf(m), t: tOf(m), intent: m.intent })).filter((m) => m.text);
    const stmts = (raw.medstatements || []).filter((m) => !/entered-in-error|not-taken/.test(m.status || "")).map((m) => ({ text: medText(m), status: m.status || "active", cat: "home", t: tOf(m) })).filter((m) => m.text);
    f.meds = { home: stmts.concat(reqs.filter((m) => m.cat === "home" && /active|completed|on-hold|unknown/.test(m.status))),
      current: reqs.filter((m) => m.cat !== "home" && m.cat !== "discharge" && /active|on-hold|draft/.test(m.status)),
      discharge: reqs.filter((m) => m.cat === "discharge" && /active|draft|on-hold/.test(m.status)) };
    const allMed = f.meds.current.concat(f.meds.discharge).map((m) => m.text).join(" | ");
    f.medClass = {}; Object.keys(MEDCLASS).forEach((k) => { const m = allMed.match(MEDCLASS[k]); if (m) f.medClass[k] = m[0]; });
    // labs / weight
    f.labs = {};
    (raw.obs || []).forEach((o) => {
      const d = pickLab(o), q = o.valueQuantity, t = tOf(o); if (!d || !q || q.value == null || !t) return;
      if (/registered|preliminary|cancelled|entered-in-error/.test(o.status || "")) return;
      (f.labs[d.id] = f.labs[d.id] || []).push({ t, v: d.conv ? d.conv(+q.value, q.unit) : +q.value });
    });
    Object.values(f.labs).forEach((a) => a.sort((x, y) => x.t - y.t));
    if (!f.admit) { const first = Object.values(f.labs).flat().map((x) => x.t).filter((t) => f.now - t < 30 * DAY).sort((a, b) => a - b)[0]; f.admit = first || null; f.admitGuessed = !!first; }
    // reports, orders, notes
    f.reports = (raw.reports || []).map((r) => ({ name: label(r.code), status: r.status || "", t: tOf(r), cat: (r.category || []).map((c) => codes(c).concat(label(c)).join(" ")).join(" ").toLowerCase(), text: [r.conclusion].concat(r._text || []).filter(Boolean).join("\n"), id: r.id, basedOn: (r.basedOn || []).map((b) => b.reference) }));
    f.pendingObs = (raw.obs || []).filter((o) => /registered|preliminary/.test(o.status || "")).map((o) => ({ name: label(o.code), status: o.status, t: tOf(o), value: o.valueString || (o.valueCodeableConcept && label(o.valueCodeableConcept)) || (o.valueQuantity ? o.valueQuantity.value + " " + (o.valueQuantity.unit || "") : "") }));
    f.orders = (raw.orders || []).filter((s) => /active|on-hold|draft/.test(s.status || "")).map((s) => ({ name: label(s.code), status: s.status, t: tOf(s), cat: (s.category || []).map((c) => label(c) + " " + codes(c).join(" ")).join(" "), ref: "ServiceRequest/" + s.id }));
    f.notes = (raw.notes || []).map((n) => ({ name: n.name || "Note", t: n.t || null, text: n.text || "" })).filter((n) => n.text);
    return f;
  }

  /* ---------- medicine reconciliation ---------- */
  function reconcile(f) {
    const cur = f.meds.discharge.length ? f.meds.discharge : f.meds.current, fromDc = !!f.meds.discharge.length, rows = [], used = new Set();
    const homeBy = {}; f.meds.home.forEach((m) => { const k = medKey(m.text); if (!homeBy[k]) homeBy[k] = m; });
    const seenCur = new Set();
    cur.forEach((m) => {
      const k = medKey(m.text); if (seenCur.has(k + "|" + m.text)) return; seenCur.add(k + "|" + m.text);
      const h = homeBy[k];
      if (h) {
        used.add(k);
        const same = doseOf(h.text) === doseOf(m.text) && (freqOf(h.text) || "daily") === (freqOf(m.text) || "daily") && (routeOf(h.text) || "po") === (routeOf(m.text) || "po");
        const ivNow = routeOf(m.text) === "iv" && routeOf(h.text) !== "iv";
        rows.push(same ? { key: k, status: "continue", text: m.text, before: h.text, reason: "" }
          : ivNow ? { key: k, status: "continue", text: h.text, before: h.text, reason: "", note: "IV in hospital (" + m.text + "): back to home dose? confirm" }
          : { key: k, status: "changed", text: m.text, before: h.text, reason: "" });
      } else {
        const inpt = !fromDc && (INPT_ONLY.test(m.text) || PROPHYLAXIS.test(m.text) || (routeOf(m.text) === "iv" && !MEDCLASS.antibiotic.test(m.text)) || /\bprn\b/i.test(m.text) && /sleep|zopiclone|lorazepam|ondansetron|dimenhydrinate/i.test(m.text));
        rows.push({ key: k, status: inpt ? "inpatient" : "new", text: m.text, before: "", reason: "", note: inpt ? "Looks hospital-only: not on the discharge list unless you change it" : routeOf(m.text) === "iv" ? "IV: oral step-down at discharge?" : "" });
      }
    });
    f.meds.home.forEach((h) => { const k = medKey(h.text); if (used.has(k) || rows.some((r) => r.key === k)) return; used.add(k); rows.push({ key: k, status: "stopped", text: h.text, before: h.text, reason: "", note: "Home medicine not ordered now: stopped, or held? confirm" }); });
    const order = { changed: 0, new: 1, stopped: 2, held: 3, continue: 4, inpatient: 5 };
    return rows.sort((a, b) => order[a.status] - order[b.status] || a.text.localeCompare(b.text));
  }

  /* ---------- what changed: labs and weight on admission vs latest; new problems ---------- */
  function changes(f) {
    const out = [], since = f.admit || f.now - 14 * DAY;
    KEYLABS.forEach((d) => {
      const a = (f.labs[d.id] || []).filter((x) => x.t >= since - 2 * DAY); if (!a.length) return;
      const first = a[0], last = a[a.length - 1], diff = last.v - first.v;
      const big = a.length > 1 && (d.big != null ? Math.abs(diff) >= d.big : first.v ? Math.abs(diff) / Math.abs(first.v) >= (d.bigPct || 0.25) : false);
      out.push({ id: d.id, name: d.name, unit: d.unit, first: first.v, firstT: first.t, last: last.v, lastT: last.t, n: a.length, big });
    });
    const newProbs = f.conditions.filter((c) => c.t && c.t >= since - DAY);
    return { labs: out, newProbs };
  }

  /* ---------- pending results ---------- */
  const PEND_TEXT = /\b(?:pending|to follow|no growth (?:to date|at \d+ (?:hours|days))|preliminary|final report to follow|sent out|referred (?:to|out)|awaiting|in progress|incubating)\b/i;
  function pending(f) {
    const out = [], since = (f.admit || f.now - 14 * DAY) - DAY;
    f.reports.filter((r) => !r.t || r.t >= since).forEach((r) => {
      if (/registered|partial|preliminary/.test(r.status)) out.push({ what: r.name || "Report", status: r.status === "registered" ? "ordered, no result yet" : "preliminary", detail: (r.text || "").replace(/\s+/g, " ").slice(0, 140), t: r.t, kind: /micro|culture/i.test(r.name + " " + r.cat) ? "micro" : /path/i.test(r.name + " " + r.cat) ? "path" : /rad|imag|ct|mri|ultra|x-?ray/i.test(r.name + " " + r.cat) ? "imaging" : "lab" });
      else if (r.status === "final" && PEND_TEXT.test(r.text) && /culture|micro|path|biopsy|cytology|send ?out|genetic/i.test(r.name + " " + r.cat)) out.push({ what: r.name, status: "final, but report says more to follow", detail: (PEND_TEXT.exec(r.text) || [""])[0], t: r.t, kind: "check" });
    });
    f.pendingObs.filter((o) => !o.t || o.t >= since).forEach((o) => { if (!out.some((x) => x.what === o.name)) out.push({ what: o.name, status: o.status === "registered" ? "ordered, no result yet" : "preliminary", detail: o.value || "", t: o.t, kind: /culture/i.test(o.name) ? "micro" : "lab" }); });
    const resultRefs = new Set(f.reports.flatMap((r) => r.basedOn));
    f.orders.filter((o) => (!o.t || o.t >= since) && !resultRefs.has(o.ref) && /lab|imag|rad|path|micro|diagnostic|procedure/i.test(o.cat + " " + o.name)).forEach((o) => { if (!out.some((x) => x.what === o.name)) out.push({ what: o.name, status: "ordered, result not found", detail: o.status !== "active" ? o.status : "", t: o.t, kind: "order" }); });
    // notes and imported text that say something is pending
    f.notes.forEach((n) => sentences(n.text).forEach((s) => { if (out.some((x) => x.what && s.toLowerCase().includes(x.what.toLowerCase().replace(/\s*x\s*\d+$/, "")))) return; if (/\b(?:pending|awaiting|to follow|sent out)\b/i.test(s) && /\b(?:culture|biopsy|patholog|cytolog|result|level|serolog|antibod|panel|test|scan|ct|mri|echo|report)\b/i.test(s) && s.length < 260 && !out.some((x) => x.detail === s)) out.push({ what: "Mentioned in " + n.name, status: "in note text: check", detail: s, t: n.t, kind: "note" }); }));
    return out;
  }

  /* ---------- incidental findings ---------- */
  const INCID = /\b(?:incidental(?:ly)?|nodules?|mass(?:es)?|lesions?|cysts?|aneurysm(?:al)?|ectasia|indeterminate|suspicious|lymphadenopathy|enlarged (?:lymph )?nodes?|thickening|adenoma|hypodensit(?:y|ies)|hypoechoic|opacity|ground[- ]glass|compression fracture|osteopeni|calcified plaque|polyp|thyroid nodule|adrenal)\b/i;
  const RECOMMEND = /\b(?:recommend(?:ed|s)?|suggest(?:ed|s)?|advised?|consider|follow[- ]?up|further (?:evaluation|assessment|imaging)|dedicated|correlat(?:e|ion)|fleischner|repeat (?:ct|imaging|ultrasound|mri)|in \d+\s*(?:-\s*\d+\s*)?(?:weeks?|months?|years?))\b/i;
  const NEGATED = /\b(?:no|without|negative for|resolved|unchanged and benign|no evidence of|not seen|absence of|free of)\b[^.;,]{0,40}$/i;
  function sentences(text) { return String(text || "").replace(/\s+/g, " ").split(/(?<=[.!?])\s+(?=[A-Z0-9])|\s*\n+\s*|;\s+(?=[A-Z])/).map((s) => s.trim()).filter((s) => s.length > 12); }
  function incidentals(f) {
    const out = [], seen = new Set(), since = (f.admit || f.now - 14 * DAY) - 30 * DAY;
    const srcs = f.reports.filter((r) => /rad|imag|ct\b|mri|ultra|x-?ray|echo|scan|pet/i.test(r.name + " " + r.cat) && (!r.t || r.t >= since)).map((r) => ({ name: r.name || "Imaging report", t: r.t, text: r.text }))
      .concat(f.notes.filter((n) => !n.t || n.t >= since));
    const FOLLOW = /\b(?:recommend(?:ed|s)?|suggest(?:ed|s)?|advised?)\b[^.]*\b(?:follow[- ]?up|repeat|dedicated|further|ultrasound|ct|mri|imaging|radiograph|correlation|assessment|referral)\b|\bfleischner\b/i;
    srcs.forEach((s) => { const ss = sentences(s.text); ss.forEach((sen, i) => {
      const m = INCID.exec(sen), next = ss[i + 1] || "";
      const add = (finding, followup, rec) => { const key = finding.toLowerCase().slice(0, 80); if (seen.has(key)) return; seen.add(key); out.push({ finding: finding.length > 300 ? finding.slice(0, 300) + " …" : finding, source: s.name, t: s.t, rec, followup }); };
      if (m && !NEGATED.test(sen.slice(0, m.index))) {
        const nextRec = FOLLOW.test(next) && !INCID.test(next) ? next : "";
        const rec = RECOMMEND.test(sen) || !!nextRec;
        if (rec || /incidental|indeterminate|suspicious|aneurysm|mass\b|nodule/i.test(sen)) { add(sen, nextRec || (rec ? (sen.match(/(?:repeat|follow[- ]?up|dedicated|further|recommend)[^.;]{0,90}/i) || [""])[0] : ""), rec); if (nextRec) seen.add(nextRec.toLowerCase().slice(0, 80)); return; }
      }
      // a radiologist's follow-up recommendation without an "incidental" word (e.g. repeat chest X-ray to document resolution)
      if (FOLLOW.test(sen) && !seen.has(sen.toLowerCase().slice(0, 80)) && /rad|imag|ct|mri|ultra|x-?ray|scan|radiograph/i.test(s.name)) add((ss[i - 1] && !FOLLOW.test(ss[i - 1]) ? ss[i - 1] + " " : "") + sen, sen, true);
    }); });
    return out.sort((a, b) => (b.rec ? 1 : 0) - (a.rec ? 1 : 0));
  }

  /* ---------- which condition modules apply ---------- */
  function modules(f) {
    const has = (x, map) => (Array.isArray(x) ? x : [x]).some((k) => k && map[k]);
    return MODULES.filter((m) => m.always || has(m.prob, f.prob) || has(m.med, f.medClass)).map((m) => {
      const why = m.always ? "" : [].concat(m.prob || []).filter((k) => f.prob[k]).map((k) => "problem: " + k).concat([].concat(m.med || []).filter((k) => f.medClass[k]).map((k) => "medicine: " + f.medClass[k])).join("; ");
      return { id: m.id, name: m.name, why };
    });
  }
  const modById = (id) => MODULES.find((m) => m.id === id);

  /* ---------- fill {fields} ---------- */
  function fill(line, v, f) {
    const F = {
      dry: v.dry ? " Your weight when you left hospital: " + v.dry + " kg (" + Math.round(v.dry * 2.2046) + " lb)." : "",
      fluid: v.fluidL ? "Limit all fluids to " + v.fluidL + " L a day (about " + Math.round(v.fluidL * 4.2) + " cups)." : "",
      abxEnd: v.abxEnd || "____", anticoag: (f && f.medClass.anticoag) || "as prescribed",
      warfarin: f && f.medClass.warfarin ? "Warfarin: get your INR checked on " + (v.inrDate || "____") + ". Keep the amount of green leafy vegetables you eat about the same each week." : "",
      glucose: v.glucose || "as your team showed you", sglt2: f && f.medClass.sglt2 ? "Stop " + f.medClass.sglt2 + " on sick days and 3 days before surgery, and restart when you are eating and drinking normally." : "",
      sglt2er: f && f.medClass.sglt2 ? "Vomiting, belly pain or fast, deep breathing while taking " + f.medClass.sglt2 + ", even if your blood sugar is normal (a rare but serious acid problem)." : "",
      driving: v.driving || "do not drive until your doctor tells you it is safe", ppi: (f && f.medClass.ppi) || "as prescribed", hbDays: v.hbDays || "7", crDays: v.crDays || "7",
      wb: v.wb || "as advised by orthopedics", staples: v.staples || "____ (at your family doctor's office)", vteWeeks: v.vteWeeks || "____" };
    return line.replace(/\{(\w+)\}/g, (_, k) => (F[k] != null ? F[k] : "")).trim();
  }
  const lines = (arr, v, f) => (arr || []).map((l) => fill(l, v, f)).filter(Boolean);

  /* ---------- outputs ---------- */
  const STATUS = { new: "NEW", changed: "CHANGED", stopped: "STOPPED", held: "HELD", continue: "CONTINUE", inpatient: "STOP (hospital only)" };
  // s = { f, meds:[rows with status/text/before/reason], chg, pend:[{what,status,detail,owner,on}], inc:[{finding,followup,on}], mods:[ids], v:{...}, fu:{...} }
  function fpNote(s) {
    const v = s.v || {}, L = [], f = s.f || { medClass: {} };
    L.push("DISCHARGE SUMMARY - KEY POINTS FOR FAMILY PHYSICIAN");
    L.push(`Admitted: ${fmtD(v.admit) || "____"}   Discharged: ${fmtD(v.dc) || "____"}${v.admit && v.dc ? "   (" + Math.max(0, Math.round((v.dc - v.admit) / DAY)) + " days)" : ""}`);
    if (v.dx) L.push("Diagnoses: " + v.dx);
    if (v.course) L.push("", "COURSE", v.course);
    L.push("", "WHAT CHANGED");
    const mc = (s.meds || []).filter((r) => r.on !== false && /new|changed|stopped|held/.test(r.status));
    if (mc.length) { L.push("Medication changes:"); mc.forEach((r) => L.push(`- ${STATUS[r.status]}: ${r.status === "changed" ? r.before + " -> " + r.text : r.text}${r.reason ? " (" + r.reason + ")" : ""}`)); }
    else L.push("Medication changes: none.");
    const lc = (s.chg && s.chg.labs || []).filter((x) => x.on !== false && x.n > 1);
    if (lc.length) L.push("Labs/weight (admission -> discharge): " + lc.map((x) => `${x.name} ${num(x.first)} -> ${num(x.last)}${x.unit && !/\^/.test(x.unit) ? " " + x.unit : ""}`).join("; ") + ".");
    const np = (s.chg && s.chg.newProbs || []).filter((x) => x.on !== false); if (np.length) L.push("New diagnoses this admission: " + np.map((x) => x.name).join("; ") + ".");
    if (v.changedOther) L.push(v.changedOther);
    L.push("", "PENDING RESULTS AT DISCHARGE");
    const pd = (s.pend || []).filter((p) => p.on !== false);
    if (pd.length) pd.forEach((p) => L.push(`- ${p.what}: ${(p.status + (p.detail ? " - " + p.detail : "")).replace(/[.\s]+$/, "")}. Follow-up: ${p.owner || "____"}`)); else L.push("None identified.");
    L.push("", "INCIDENTAL FINDINGS NEEDING FOLLOW-UP");
    const ic = (s.inc || []).filter((x) => x.on !== false);
    if (ic.length) ic.forEach((x) => L.push(`- ${x.finding.replace(/[.\s]+$/, "")} [${x.source}${x.t ? ", " + fmtD(x.t) : ""}]. Plan: ${x.followup || "____"}${x.owner ? " (" + x.owner + ")" : ""}`)); else L.push("None identified.");
    L.push("", "FOLLOW-UP");
    L.push(`- Family physician: within ${v.fpDays || "____"} days${v.fpName ? " (" + v.fpName + ")" : ""}.`);
    const tasks = []; (s.mods || []).forEach((id) => { const m = modById(id); if (m) lines(m.fp, v, f).forEach((t) => tasks.push(t)); });
    if (v.fpTasks) v.fpTasks.split(/\n+/).filter(Boolean).forEach((t) => tasks.push(t.replace(/^[-*]\s*/, "")));
    tasks.forEach((t) => L.push("  - " + t));
    if (v.spec) v.spec.split(/\n+/).filter(Boolean).forEach((t) => L.push("- " + t.replace(/^[-*]\s*/, "")));
    const handouts = (s.mods || []).map((id) => modById(id)).filter((m) => m && m.handout).map((m) => m.handout);
    L.push("", "Patient given: written discharge instructions with return precautions (when to call the family doctor, 8-1-1 or 9-1-1)" + (handouts.length ? "; " + handouts.join("; ") : "") + ".");
    return L.join("\n");
  }

  function patientText(s) {
    const v = s.v || {}, f = s.f || { medClass: {} }, L = [], mods = (s.mods || []).map(modById).filter(Boolean);
    const plain = (t) => String(t).replace(/\b(?:PO|po)\b/g, "by mouth").replace(/\bBID\b|\bbid\b/g, "twice a day").replace(/\bTID\b|\btid\b/g, "3 times a day").replace(/\bQID\b|\bqid\b/g, "4 times a day").replace(/\b(?:daily|DAILY|OD|od)\b/g, "once a day").replace(/\b(?:QHS|qhs)\b/g, "at bedtime").replace(/\b(?:PRN|prn)\b(?=\s+[a-z])/g, "only if needed, for").replace(/\b(?:PRN|prn)\b/g, "only if needed").replace(/\b(?:SC|sc|subcut)\b/g, "injection under the skin");
    L.push("YOUR HOSPITAL STAY: WHAT TO DO AT HOME");
    if (v.ptName) L.push("For: " + v.ptName);
    L.push(`You were in hospital ${fmtD(v.admit) ? "from " + fmtD(v.admit) : ""}${fmtD(v.dc) ? " to " + fmtD(v.dc) : ""}${v.ptReason ? " for " + v.ptReason : ""}.`);
    const by = (st) => (s.meds || []).filter((r) => r.on !== false && r.status === st);
    L.push("", "CHANGES TO YOUR MEDICINES");
    const nw = by("new"), ch = by("changed"), sp = by("stopped").concat(by("held"));
    if (!nw.length && !ch.length && !sp.length) L.push("No changes. Keep taking your usual medicines.");
    if (nw.length) { L.push("NEW - start taking:"); nw.forEach((r) => L.push("  - " + plain(r.text) + (r.reason ? " (for " + r.reason + ")" : ""))); }
    if (ch.length) { L.push("CHANGED - take the new dose:"); ch.forEach((r) => L.push("  - " + plain(r.text) + "  (before: " + plain(r.before) + ")" + (r.reason ? " - " + r.reason : ""))); }
    if (sp.length) { L.push("STOP taking" + (by("held").length ? " (or hold until your doctor says to restart)" : "") + ":"); sp.forEach((r) => L.push("  - " + plain(r.text) + (r.status === "held" ? " (on hold)" : "") + (r.reason ? " (" + r.reason + ")" : ""))); }
    L.push("Ask your pharmacist to go over your new list with you.");
    const home = [], call = [], er = [];
    mods.forEach((m) => { lines(m.home, v, f).forEach((x) => home.push(x)); lines(m.call, v, f).forEach((x) => call.push(x)); lines(m.er, v, f).forEach((x) => er.push(x)); });
    if (v.ptExtra) v.ptExtra.split(/\n+/).filter(Boolean).forEach((x) => home.push(x.replace(/^[-*]\s*/, "")));
    const uniq = (a) => a.filter((x, i) => a.indexOf(x) === i);
    L.push("", "WHAT TO DO AT HOME"); uniq(home).forEach((x) => L.push("  - " + x));
    L.push("", "CALL YOUR FAMILY DOCTOR (or 8-1-1, HealthLink BC, nurse 24/7) THE SAME DAY IF:"); uniq(call).forEach((x) => L.push("  - " + x));
    L.push("", "CALL 9-1-1 OR GO TO THE NEAREST EMERGENCY DEPARTMENT IF:"); uniq(er).forEach((x) => L.push("  - " + x));
    L.push("", "YOUR APPOINTMENTS");
    L.push(`  - See your family doctor${v.fpName ? " (" + v.fpName + ")" : ""} within ${v.fpDays || "____"} days. Bring this sheet and your pill bottles.`);
    if (v.ptAppts) v.ptAppts.split(/\n+/).filter(Boolean).forEach((x) => L.push("  - " + x.replace(/^[-*]\s*/, "")));
    const labs = [v.labsWhen].filter(Boolean); if (labs.length) L.push("  - Blood tests: " + labs.join("; "));
    const pd = (s.pend || []).filter((p) => p.on !== false);
    if (pd.length) L.push("", "TESTS STILL PENDING", "  Some test results were not back when you left. Your family doctor or the hospital team will get them and contact you if anything needs to change.");
    const ho = mods.filter((m) => m.handout); if (ho.length) L.push("", "You were also given: " + ho.map((m) => m.name.toLowerCase() + " handout").join(", ") + ".");
    return L.join("\n");
  }

  const api = { parse, reconcile, changes, pending, incidentals, modules, fpNote, patientText, fill, medKey, doseOf, MODULES, KEYLABS, PROB, MEDCLASS, STATUS, DAY, fmtD, sentences };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else window.DcRules = api;
})();
