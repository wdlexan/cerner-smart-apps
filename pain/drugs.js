/* Pain Management – drug classes, doses and patient-specific suitability.
 * judge(C) receives the patient context built in app.js and returns {lvl:"ok"|"caution"|"avoid", why:[...]}.
 * Doses are typical adult / frail-older-adult starting points; CHECK against product monographs and Island Health guidance. */
"use strict";
function J() { const why = []; let lvl = "ok"; return { why, lvl, c(t) { why.push(t); if (lvl === "ok") lvl = "caution"; }, a(t) { why.push(t); lvl = "avoid"; }, done() { return { lvl, why }; } }; }

const PAIN_CLASSES = [
  {
    id: "apap", name: "Acetaminophen", role: "Foundation of multimodal analgesia; schedule it rather than PRN.",
    drugs: [{ n: "Acetaminophen", start: "650–1000 mg PO q6h scheduled", max: "4 g/day healthy adult; 3 g/day if ≥65 or frail; 2 g/day if chronic alcohol use, liver disease, malnutrition or weight <50 kg", renal: "CrCl <30: q6h interval is fine; some extend to q8h", hepatic: "Cirrhosis (no active alcohol): ≤2 g/day is generally safe and preferred over NSAIDs" }],
    judge(C) { const j = J(); if (C.acuteLiver) j.a("acute liver injury (ALT >5× ULN)"); if (C.cirrhosis || C.alcohol) j.c("liver disease / alcohol: cap 2 g/day"); if (C.wt && C.wt < 50) j.c("weight <50 kg: cap 2–3 g/day"); if (C.age >= 65) j.c(`age ${C.age}: cap 3 g/day`); if (C.apapDaily > C.apapCap) j.a(`current orders allow ${Math.round(C.apapDaily)} mg/day (cap ${C.apapCap} mg) — count combination products`); return j.done(); },
    pearls: ["Count acetaminophen in combination products (Tylenol #3, Percocet).", "IV acetaminophen is no better than PO when the patient can swallow."]
  },
  {
    id: "nsaid", name: "NSAIDs / COX-2 inhibitors", role: "Strong for inflammatory and musculoskeletal pain, renal colic, gout, bone pain; opioid-sparing.",
    drugs: [
      { n: "Ibuprofen", start: "200–400 mg PO q6–8h with food", max: "1200 mg/day (OTC); 2400 mg/day max", renal: "Avoid if eGFR <30 or AKI", hepatic: "Avoid in cirrhosis" },
      { n: "Naproxen", start: "250–500 mg PO BID", max: "1000 mg/day", renal: "Avoid if eGFR <30", hepatic: "Avoid in cirrhosis", note: "Lowest CV risk of the non-selective NSAIDs" },
      { n: "Celecoxib", start: "100 mg PO daily–BID", max: "200 mg BID (short term)", renal: "Avoid if eGFR <30", hepatic: "Halve dose in moderate impairment", note: "Lower GI risk; with a PPI if high GI risk; sulfonamide allergy caution" },
      { n: "Ketorolac", start: "10 mg PO q6h or 15 mg IV q6h if ≥65 / <50 kg", max: "≤5 days total", renal: "Avoid if eGFR <30, AKI or volume depletion", hepatic: "Avoid" }
    ],
    judge(C) {
      const j = J();
      if (C.egfr != null && C.egfr < 30) j.a(`eGFR ${C.egfr}`); else if (C.egfr != null && C.egfr < 60) j.c(`eGFR ${C.egfr}: short course, monitor creatinine`);
      if (C.aki) j.a("acute kidney injury"); if (C.hf) j.a("heart failure (fluid retention, decompensation)"); if (C.cirrhosis) j.a("cirrhosis (renal failure, bleeding)");
      if (C.gibleed) j.a("prior GI bleed / peptic ulcer"); if (C.anticoag) j.a("on anticoagulant (bleeding)"); if (C.plt != null && C.plt < 50) j.a(`platelets ${C.plt}`);
      if (C.acei && C.diuretic) j.a("ACE inhibitor/ARB + diuretic → 'triple whammy' AKI"); else if (C.acei || C.diuretic) j.c("ACE inhibitor/ARB or diuretic: AKI risk");
      if (C.cad || C.stroke) j.c("coronary disease / stroke: prefer naproxen, shortest course"); if (C.antiplatelet || C.steroid) j.c("antiplatelet or steroid: add PPI");
      if (C.age >= 65) j.c(`age ${C.age}: shortest course, add PPI (Beers)`);
      return j.done();
    },
    pearls: ["Topical NSAID first for knee/hand OA and focal pain.", "Add a PPI when ≥65, on aspirin/SSRI/steroid, or prior ulcer if an oral NSAID is unavoidable."]
  },
  {
    id: "topical", name: "Topical agents", role: "Focal pain (OA of knee/hand, PHN, localized neuropathic pain) with little systemic effect.",
    drugs: [
      { n: "Diclofenac gel 1–2.32%", start: "Apply to painful joint TID–QID", max: "Per product (e.g. 2 g × 4 per knee)", renal: "Minimal systemic absorption", hepatic: "—" },
      { n: "Lidocaine 5% patch / 4% OTC", start: "Up to 3 patches, 12 h on / 12 h off", max: "3 patches", renal: "—", hepatic: "—", note: "PHN, focal neuropathic and rib pain" },
      { n: "Capsaicin 0.075% cream", start: "TID–QID for 2–4 weeks before judging", max: "—", renal: "—", hepatic: "—", note: "Burning at first; PHN, OA" }
    ],
    judge(C) { return { lvl: "ok", why: ["low systemic risk"] }; },
    pearls: ["Good first choice in older adults and in CKD."]
  },
  {
    id: "opioid", name: "Opioids", role: "Moderate–severe acute pain, cancer pain, palliative care. Limited role in chronic non-cancer pain (Canadian 2017 guideline).",
    drugs: [
      { n: "Hydromorphone (IR)", start: "Opioid-naive: 0.5–1 mg PO q4h PRN (0.25–0.5 mg if frail); 0.2–0.4 mg SC/IV q2–4h PRN", max: "Titrate to effect", renal: "Preferred opioid in CKD at reduced dose and longer interval (metabolite can accumulate in dialysis)", hepatic: "Reduce dose 50%, extend interval" },
      { n: "Oxycodone (IR)", start: "2.5–5 mg PO q4h PRN", max: "Titrate", renal: "eGFR <30: reduce dose, extend interval", hepatic: "Reduce dose 50–66%" },
      { n: "Morphine (IR)", start: "2.5–5 mg PO q4h PRN; 1–2.5 mg SC/IV q2–4h PRN", max: "Titrate", renal: "AVOID if eGFR <30 (M3G/M6G accumulate → sedation, myoclonus)", hepatic: "Reduce dose, extend interval" },
      { n: "Tramadol", start: "25–50 mg PO q6h PRN", max: "400 mg/day; 300 mg/day if >75; CrCl <30: q12h, max 200 mg/day", renal: "See max", hepatic: "Avoid in severe impairment", note: "Seizures, serotonin syndrome, hypoglycemia, hyponatremia; CYP2D6 variable" },
      { n: "Tapentadol (IR)", start: "50 mg PO q4–6h PRN", max: "600 mg/day", renal: "Avoid CrCl <30", hepatic: "Avoid severe; reduce moderate", note: "Serotonergic; seizure risk" },
      { n: "Fentanyl patch", start: "ONLY if opioid-tolerant (≥60 mg oral morphine/day for ≥1 week); never for acute pain", max: "Change q72h", renal: "Usable in CKD", hepatic: "Caution", note: "Fever/heat increases absorption; takes 12–24 h to work and to wear off" },
      { n: "Buprenorphine", start: "Transdermal 5 mcg/h q7 days (chronic pain); SL buprenorphine-naloxone for OUD (addiction medicine)", max: "Patch 20 mcg/h", renal: "No adjustment — good choice in CKD", hepatic: "Caution in severe impairment", note: "Ceiling on respiratory depression; continue through surgery for OUD" },
      { n: "Methadone", start: "Experienced prescriber only (non-linear conversion, long half-life)", max: "—", renal: "Usable in CKD/dialysis", hepatic: "Caution", note: "ECG: QTc before and after dose changes; many interactions" },
      { n: "Codeine", start: "Not recommended", max: "—", renal: "Avoid in CKD", hepatic: "Avoid", note: "Prodrug via CYP2D6: no effect in poor metabolizers, toxicity in ultra-rapid" },
      { n: "Meperidine", start: "Avoid", max: "—", renal: "Avoid (normeperidine seizures)", hepatic: "Avoid", note: "Delirium, seizures, serotonergic" }
    ],
    judge(C) {
      const j = J();
      if (C.benzo.length) j.c(`on benzodiazepine/Z-drug (${C.benzo.join(", ")}) — respiratory depression`);
      if (C.gabap.length) j.c("on gabapentinoid — additive sedation/respiratory depression");
      if (C.osa || C.copd || C.hypercapnia) j.c("sleep apnea / COPD / hypercapnia: lowest dose, SpO2 ± capnography");
      if (C.delirium || C.dementia) j.c("delirium/dementia: lowest dose, but untreated pain also causes delirium");
      if (C.age >= 75) j.c(`age ${C.age}: start at 25–50% of adult dose`);
      if (C.egfr != null && C.egfr < 30) j.c(`eGFR ${C.egfr}: hydromorphone (reduced), fentanyl or buprenorphine; avoid morphine, codeine, meperidine, tramadol >200 mg`);
      if (C.cirrhosis) j.c("cirrhosis: reduce dose, extend interval; may precipitate encephalopathy");
      if (C.oud) j.c("opioid use disorder: continue buprenorphine/methadone; higher doses often needed; addiction medicine consult");
      if (C.chronicNonCancer && C.mme >= 90) j.c(`chronic non-cancer pain with MME ${Math.round(C.mme)} ≥90: guideline suggests tapering`);
      return j.done();
    },
    pearls: ["Always: bowel regimen, sedation monitoring (POSS), naloxone available.", "Immediate-release only for acute pain; no long-acting opioids or patches in opioid-naive patients.", "See the Opioid tools tab for MME, conversion and taper."]
  },
  {
    id: "gabap", name: "Gabapentinoids (gabapentin, pregabalin)", role: "Neuropathic pain (first line), fibromyalgia (pregabalin). Not effective for non-radicular back pain or acute post-op pain routinely.",
    drugs: [
      { n: "Gabapentin", start: "100–300 mg PO qHS; increase by 100–300 mg every 1–3 days to TID", max: "3600 mg/day", renal: "CrCl 30–59: 400–1400 mg/day (BID); 15–29: 200–700 mg/day (daily); <15: 100–300 mg/day; dialysis: dose after HD", hepatic: "No adjustment" },
      { n: "Pregabalin", start: "25–75 mg PO qHS–BID (25 mg if frail)", max: "300 mg/day (600 mg/day neuropathic, if tolerated)", renal: "CrCl 30–60: 75–300 mg/day; 15–30: 25–150 mg/day; <15: 25–75 mg/day", hepatic: "No adjustment" }
    ],
    judge(C) {
      const j = J();
      if (C.egfr != null && C.egfr < 60) j.c(`eGFR ${C.egfr}: renal dose (see table)`);
      if (C.gabapOver) j.a(C.gabapOver);
      if (C.opioids.length) j.c("with opioid: respiratory depression (Health Canada warning)");
      if (C.age >= 65 || C.falls) j.c("dizziness, falls, confusion — start low");
      if (C.osa || C.copd) j.c("sleep apnea / COPD");
      if (C.delirium) j.c("delirium");
      return j.done();
    },
    pearls: ["Taper over ≥1 week when stopping (withdrawal, seizures).", "Misuse potential, especially pregabalin with opioids."]
  },
  {
    id: "snri", name: "SNRIs (duloxetine, venlafaxine)", role: "Neuropathic pain, OA, chronic low back pain, fibromyalgia; helps coexisting depression/anxiety.",
    drugs: [
      { n: "Duloxetine", start: "30 mg PO daily × 1–2 weeks, then 60 mg", max: "60 mg/day for pain (120 mg rarely)", renal: "Avoid CrCl <30", hepatic: "Avoid in liver disease or heavy alcohol use" },
      { n: "Venlafaxine XR", start: "37.5 mg PO daily, increase weekly", max: "150–225 mg/day", renal: "Reduce 25–50% if CrCl <30", hepatic: "Reduce 50%", note: "Raises BP; discontinuation symptoms" }
    ],
    judge(C) {
      const j = J();
      if (C.egfr != null && C.egfr < 30) j.a(`eGFR ${C.egfr}: avoid duloxetine (venlafaxine at reduced dose)`);
      if (C.cirrhosis || C.alcohol) j.a("liver disease / heavy alcohol: avoid duloxetine");
      if (C.na != null && C.na < 133) j.c(`Na ${C.na}: SIADH risk`);
      if (C.anticoag || C.antiplatelet) j.c("with anticoagulant/antiplatelet: bleeding (add PPI if GI risk)");
      if (C.serotonergic.length) j.c(`other serotonergic drugs (${C.serotonergic.join(", ")})`);
      if (C.age >= 65 || C.falls) j.c("falls, hyponatremia in older adults");
      return j.done();
    },
    pearls: ["Takes 2–4 weeks for pain effect.", "Don't combine with tramadol or another SNRI/SSRI without review."]
  },
  {
    id: "tca", name: "Tricyclic antidepressants", role: "Neuropathic pain, fibromyalgia, headache prevention (low dose at night).",
    drugs: [
      { n: "Nortriptyline", start: "10 mg PO qHS, increase by 10 mg weekly", max: "75–100 mg/day", renal: "No adjustment", hepatic: "Lower dose", note: "Less anticholinergic than amitriptyline — preferred TCA" },
      { n: "Amitriptyline", start: "10 mg PO qHS", max: "75 mg/day", renal: "—", hepatic: "Lower dose", note: "Most anticholinergic; avoid ≥65 (Beers)" }
    ],
    judge(C) {
      const j = J();
      if (C.age >= 65) j.c(`age ${C.age}: anticholinergic, orthostasis, falls — nortriptyline only, low dose (avoid amitriptyline)`);
      if (C.dementia || C.delirium) j.a("dementia/delirium (anticholinergic)");
      if (C.cad) j.c("coronary disease: ECG first; avoid after recent MI");
      if (C.qtc != null && C.qtc > 470) j.a(`QTc ${C.qtc}`);
      if (C.retention) j.c("urinary retention/BPH");
      if (C.seizure) j.c("lowers seizure threshold");
      if (C.serotonergic.length) j.c("other serotonergic drugs");
      return j.done();
    },
    pearls: ["Overdose is dangerous — consider in patients with suicide risk."]
  },
  {
    id: "aed", name: "Sodium-channel anticonvulsants", role: "Trigeminal neuralgia (first line).",
    drugs: [
      { n: "Carbamazepine", start: "100 mg PO BID, increase by 100–200 mg/day", max: "1200 mg/day (usually 400–800)", renal: "—", hepatic: "Caution", note: "HLA-B*15:02 test in people of Asian ancestry (SJS); hyponatremia; strong CYP3A4 inducer — lowers DOACs, warfarin, many others" },
      { n: "Oxcarbazepine", start: "150 mg PO BID", max: "1200–1800 mg/day", renal: "Halve if CrCl <30", hepatic: "—", note: "More hyponatremia; fewer interactions" }
    ],
    judge(C) { const j = J(); if (C.na != null && C.na < 135) j.c(`Na ${C.na}`); if (C.anticoag) j.c("carbamazepine lowers DOAC/warfarin levels"); if (C.age >= 65) j.c("dizziness, ataxia, falls"); return j.done(); },
    pearls: []
  },
  {
    id: "steroid", name: "Corticosteroids", role: "Bone metastases, nerve/spinal cord compression, liver capsule pain, inflammatory flares (gout, PMR), short-course radicular pain.",
    drugs: [
      { n: "Dexamethasone", start: "Bone/visceral cancer pain: 4–8 mg PO daily (morning); suspected cord compression: 10 mg IV then 4 mg q6h (or 8 mg BID) + urgent MRI", max: "—", renal: "—", hepatic: "—" },
      { n: "Prednisone", start: "Gout flare: 30–35 mg daily × 5 days", max: "—", renal: "—", hepatic: "—" }
    ],
    judge(C) { const j = J(); if (C.diabetes) j.c("diabetes: monitor glucose"); if (C.delirium) j.c("delirium/psychosis"); if (C.gibleed) j.c("GI bleed history: add PPI"); return j.done(); },
    pearls: []
  },
  {
    id: "relax", name: "Muscle relaxants", role: "Limited evidence; short-term acute back spasm in younger adults; baclofen for spasticity.",
    drugs: [
      { n: "Cyclobenzaprine", start: "5 mg PO qHS–TID, ≤2 weeks", max: "30 mg/day", renal: "—", hepatic: "Avoid", note: "TCA-like, anticholinergic" },
      { n: "Methocarbamol", start: "500–750 mg PO TID–QID", max: "—", renal: "Avoid IV form in renal failure", hepatic: "—" },
      { n: "Baclofen", start: "5 mg PO TID (spasticity)", max: "80 mg/day", renal: "Avoid / tiny doses if eGFR <30 (encephalopathy)", hepatic: "—", note: "Abrupt stop → withdrawal, seizures" }
    ],
    judge(C) { const j = J(); if (C.age >= 65) j.a(`age ${C.age}: Beers — sedation, falls, anticholinergic`); if (C.egfr != null && C.egfr < 30) j.c("baclofen toxicity in CKD"); if (C.opioids.length || C.benzo.length) j.c("additive sedation"); return j.done(); },
    pearls: []
  },
  {
    id: "cannabis", name: "Cannabinoids", role: "Third-line for refractory neuropathic pain or spasticity; weak evidence.",
    drugs: [{ n: "Nabilone", start: "0.5 mg PO qHS", max: "2 mg BID", renal: "—", hepatic: "Caution", note: "Dizziness, cognitive effects; avoid with psychosis history" }],
    judge(C) { const j = J(); if (C.age >= 65 || C.dementia || C.falls) j.c("dizziness, confusion, falls"); if (C.psychosis) j.a("psychosis history"); if (C.cad) j.c("tachycardia, hypotension"); return j.done(); },
    pearls: []
  },
  {
    id: "special", name: "Specialist / interventional", role: "When pain is severe, refractory, or opioid-tolerant — involve Acute Pain Service, anaesthesia, palliative care or chronic pain clinic.",
    drugs: [
      { n: "Regional blocks", start: "Hip fracture: fascia iliaca or PENG block; rib fractures: serratus anterior / erector spinae block or epidural (≥3 ribs, elderly); post-op catheters", max: "—", renal: "—", hepatic: "—", note: "Check anticoagulation timing for neuraxial techniques" },
      { n: "Ketamine (low dose)", start: "Acute Pain Service: e.g. 0.1–0.2 mg/kg/h infusion for opioid-tolerant or OUD patients", max: "—", renal: "—", hepatic: "—", note: "Dysphoria, hypertension" },
      { n: "Lidocaine IV", start: "APS/palliative only", max: "—", renal: "—", hepatic: "Caution", note: "Cardiac monitoring" },
      { n: "Radiation / bisphosphonate / denosumab", start: "Bone metastases (single-fraction radiation works fast)", max: "—", renal: "Bisphosphonates: adjust/avoid with low eGFR", hepatic: "—" }
    ],
    judge(C) { return { lvl: "ok", why: C.oud || C.mme >= 90 ? ["opioid tolerance/OUD — involve Acute Pain Service early"] : [] }; },
    pearls: []
  }
];

const NONDRUG = ["Explain the plan and expected recovery; set a functional goal (walk to bathroom, sleep, physio), not pain 0/10.",
  "Physiotherapy, early mobilization, heat/ice, positioning, splints.",
  "Treat sleep, mood and anxiety; CBT-based pain self-management for chronic pain (Pain BC: Live Plan Be, Pain Support Line).",
  "For chronic pain: graded exercise, weight loss for knee OA, pacing; coach the patient that improvement in function is the goal."];
