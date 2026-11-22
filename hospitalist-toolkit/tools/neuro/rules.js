/* Neuro (non-stroke) tab: rules. Pure functions, no page or chart access, so they can be tested with node (tests/test_neuro.js).
   UNVERIFIED draft written by Claude from general knowledge: thresholds and scores are aids to thinking, not validated tools. */
(function (root) {
  /* ---------- findings the clinician ticks (some are ticked automatically from the chart) ---------- */
  const FINDINGS = [
    { group: "Weakness pattern", items: [
      ["hemi", "One side: face, arm and/or leg"],
      ["para", "Both legs (± arms)"],
      ["ascend", "Ascending over days, starting in the legs"],
      ["prox", "Proximal (rising from chair, arms above head)"],
      ["fatig", "Fatigable, worse later in the day"],
      ["single", "One limb or one nerve (wrist or foot drop)"]] },
    { group: "Signs", items: [
      ["areflex", "Reflexes reduced or absent"],
      ["hyperreflex", "Brisk reflexes, upgoing plantar or clonus"],
      ["sensLevel", "Sensory level on the trunk"],
      ["saddle", "Saddle (perineal) numbness"],
      ["retention", "New urinary retention or incontinence"],
      ["distalNumb", "Tingling that started in the feet or hands"],
      ["ptosis", "Ptosis or double vision"],
      ["bulbar", "Trouble swallowing or speaking, weak neck"],
      ["facial", "Facial weakness"],
      ["dyspnea", "Breathless, weak cough, accessory muscles"],
      ["autonomic", "BP or heart rate swings"],
      ["backpain", "New back pain or spine tenderness"]] },
    { group: "Motor exam: tone, bulk, reflexes", items: [
      ["spastic", "Tone increased (spastic, catch)"],
      ["flaccid", "Tone reduced (floppy)"],
      ["wasting", "Muscle wasting"],
      ["fascic", "Fasciculations"],
      ["reflexNormal", "Reflexes normal"],
      ["sensOK", "Sensation normal"],
      ["hyperacute", "Came on over hours to 2 days"]] },
    { group: "From special bedside tests", items: [
      ["drift", "Pronator drift / Barré leg drift / slow finger tapping on one side (subtle UMN)"],
      ["cerebellar", "Limb ataxia: finger-nose, heel-shin, rapid alternating movements or rebound abnormal"],
      ["romberg", "Romberg positive (steady eyes open, falls eyes closed)"],
      ["dorsal", "Joint position or vibration sense reduced"],
      ["corticalSens", "Cortical sensory loss (graphesthesia, stereognosis) with normal primary sensation"],
      ["frontal", "Frontal release signs (grasp, palmomental, glabellar tap not habituating)"],
      ["functional", "Positive functional signs (Hoover, give-way, drift without pronation)"]] },
    { group: "Head / level of consciousness", items: [
      ["drowsy", "Drowsy, confused, or new headache"],
      ["fall", "Fall or head injury"],
      ["gradual", "Getting worse over days to weeks"]] },
    { group: "Confusion, headache, fever", items: [
      ["fluct", "Confusion that fluctuates, staring, subtle twitching, or not back to baseline after a seizure"],
      ["seizure", "Seizure"],
      ["thunder", "Sudden severe headache, worst at onset (thunderclap)"],
      ["neckStiff", "Neck stiffness or photophobia"],
      ["headPos", "Headache worse lying down or on waking, or papilledema"],
      ["neckPain", "Neck pain (after neck movement, trauma, or with headache)"],
      ["horner", "Horner (small pupil, mild ptosis) on one side"],
      ["visual", "Vision loss, blurred vision or cortical blindness"],
      ["htn", "BP very high (SBP 180 or more)"],
      ["ataxiaOph", "Unsteady gait plus eye movement problem (nystagmus, gaze palsy)"]] },
    { group: "Weakness from the top down", items: [
      ["descend", "Starts in eyes, face or throat, then spreads down (descending)"],
      ["pupils", "Dilated or sluggish pupils"],
      ["noSens", "No sensory loss, alert, no fever"],
      ["tick", "Tick bite or outdoor exposure (check scalp, hairline, ears)"],
      ["botRisk", "Home-canned or fermented food, or injection drug use (wound)"],
      ["mriNoComp", "MRI spine: no compression (cord signal change, or normal)"]] },
    { group: "Vertigo", items: [
      ["vertigo", "Vertigo or dizziness"],
      ["vPositional", "Brief (under 1 min), set off by head position"],
      ["vConstant", "Constant for hours to days, with nystagmus"],
      ["hitNormal", "Head impulse test NORMAL (no catch-up saccade)"],
      ["nysCentral", "Nystagmus changes direction or is vertical"],
      ["skew", "Skew deviation on cover test"],
      ["hearing", "New hearing loss"],
      ["cantWalk", "Cannot walk unaided / severe truncal ataxia"],
      ["dixPos", "Dix-Hallpike positive"]] },
    { group: "Multiple sclerosis", items: [
      ["msNew", "New or worse MS symptoms for over 24 h"],
      ["heat", "Hot, exercising, or recent heat exposure"]] },
    { group: "Preceding history (prodrome)", items: [
      ["recentInf", "Diarrhea (e.g. Campylobacter) or chest infection in the past 6 weeks"],
      ["viralURI", "Viral illness, flu-like or cold in the past 6 weeks"],
      ["vaccine", "Vaccination in the past 6 weeks"],
      ["uti", "UTI or other infection now (urinary symptoms, cough)"],
      ["newMed", "New or changed medicine in the past 2 weeks"],
      ["drugStop", "Stopped alcohol, benzodiazepines or an antiseizure medicine recently"],
      ["neckManip", "Neck manipulation (chiropractic), neck trauma, violent coughing or vomiting"],
      ["icuSepsis", "Recent ICU stay, sepsis or prolonged ventilation"],
      ["stressSleep", "Poor sleep, high stress or overexertion"],
      ["toxExp", "Recreational drugs or toxin exposure (nitrous oxide, organophosphates)"]] },
    { group: "Background (chart fills some)", items: [
      ["cancer", "Cancer history"],
      ["fever", "Fever or sepsis"],
      ["anticoag", "On an anticoagulant"],
      ["antiplt", "On an antiplatelet"],
      ["spineProc", "Recent spinal procedure, epidural or LP"],
      ["absRisk", "IV drug use, bacteremia or diabetes"],
      ["knownMS", "Known MS"],
      ["knownMG", "Known myasthenia gravis"],
      ["lowK", "Potassium under 3.0"],
      ["highCK", "CK over 1000"],
      ["lowGlu", "Glucose under 4, or on insulin / sulfonylurea"],
      ["etoh", "Alcohol use disorder, malnutrition, bariatric surgery, or weeks of vomiting"],
      ["immuno", "Immunosuppressed (steroids, transplant, chemo, HIV)"],
      ["preg", "Pregnant or postpartum (up to 12 weeks)"],
      ["estrogen", "On a birth control pill, patch or ring, or estrogen therapy"],
      ["thrombo", "Past blood clots or a known clotting disorder (e.g. factor V Leiden, antiphospholipid)"],
      ["presRisk", "Tacrolimus/cyclosporine, chemo (e.g. bevacizumab), kidney failure, or pre-eclampsia"]] }];
  const LABEL = {}; FINDINGS.forEach((g) => g.items.forEach(([k, l]) => (LABEL[k] = l)));

  /* ---------- ranked list of diagnoses ---------- */
  const DX = [
    { id: "cord", name: "Spinal cord compression (tumour, abscess, hematoma)", card: "cord", urg: "now", cantMiss: true,
      score: (f) => s(f, { para: 2, sensLevel: 3, retention: 2, backpain: 2, spineProc: 1 }) + (f.hyperreflex && f.para ? 1 : 0)
        + (f.cancer && (f.backpain || f.para || f.sensLevel) ? 2 : 0) + (f.fever && f.backpain ? 2 : 0) + (f.absRisk && f.backpain ? 1 : 0)
        + (f.anticoag && f.spineProc ? 2 : 0) - (f.mriNoComp ? 5 : 0) },
    { id: "cauda", name: "Cauda equina syndrome", card: "cauda", urg: "now", cantMiss: true,
      score: (f) => s(f, { saddle: 4, retention: 2, backpain: 2 }) + (f.para ? 1 : 0) + (f.areflex && f.para ? 1 : 0) + (f.cancer && f.backpain ? 1 : 0) },
    { id: "gbs", name: "Guillain-Barré syndrome", card: "gbs", urg: "today", cantMiss: true,
      score: (f) => s(f, { ascend: 3, areflex: 2, recentInf: 1, viralURI: 1, vaccine: 1, distalNumb: 1, facial: 1, bulbar: 1, autonomic: 1, dyspnea: 1 })
        + (f.para ? 1 : 0) - (f.sensLevel ? 2 : 0) - (f.hyperreflex ? 2 : 0) - (f.fatig ? 1 : 0) - (f.tick ? 3 : 0) - (f.descend ? 2 : 0) },
    { id: "mg", name: "Myasthenia gravis (crisis if breathing or swallowing affected)", card: "mg", urg: "today", cantMiss: true,
      score: (f) => s(f, { fatig: 3, ptosis: 3, bulbar: 2, knownMG: 3, dyspnea: 1 }) - (f.areflex ? 1 : 0) - (f.distalNumb ? 1 : 0) - (f.sensLevel ? 2 : 0) },
    { id: "ms", name: "MS relapse or pseudo-relapse", card: "ms", urg: "today",
      score: (f) => s(f, { knownMS: 2, msNew: 2, heat: 1 }) + (f.knownMS && (f.uti || f.viralURI || f.stressSleep) ? 1 : 0) },
    { id: "sdh", name: "Subdural hematoma (acute or chronic)", card: "sdh", urg: "now", cantMiss: true,
      score: (f) => s(f, { drowsy: 2, fall: 2, gradual: 1 }) + ((f.anticoag || f.antiplt) && (f.drowsy || f.fall || f.hemi) ? 2 : 0) + (f.hemi && (f.drowsy || f.fall) ? 1 : 0) },
    { id: "stroke", name: "Stroke or TIA (use the Stroke tab / code stroke)", card: null, urg: "now", cantMiss: true,
      score: (f) => (f.hemi ? 3 : 0) + (f.drift ? (f.hemi ? 1 : 3) : 0) + (f.corticalSens ? 1 : 0) + (f.facial && !f.bulbar ? 1 : 0) - (f.fall && f.drowsy ? 1 : 0) - (f.functional && !f.hyperreflex ? 1 : 0) },
    { id: "vcentral", name: "Central vertigo: posterior circulation stroke", card: "vertigo", urg: "now", cantMiss: true,
      score: (f) => f.vertigo || f.vConstant ? s(f, { hitNormal: 3, nysCentral: 3, skew: 3, hearing: 2, cantWalk: 2, cerebellar: 2 }) + (f.vConstant ? 1 : 0) : 0 },
    { id: "bppv", name: "BPPV", card: "vertigo", urg: "routine",
      score: (f) => s(f, { vPositional: 3, dixPos: 3 }) - (f.vConstant ? 2 : 0) - (f.nysCentral ? 3 : 0) },
    { id: "vneur", name: "Vestibular neuritis / labyrinthitis", card: "vertigo", urg: "routine",
      score: (f) => (f.vConstant ? 3 + (f.viralURI ? 1 : 0) : 0) - (f.hitNormal || f.nysCentral || f.skew || f.cantWalk ? 4 : 0) - (f.vPositional ? 1 : 0) },
    { id: "mening", name: "Meningitis / encephalitis (bacterial, HSV)", card: "mening", urg: "now", cantMiss: true,
      score: (f) => (f.fever || f.neckStiff ? s(f, { fever: 2, neckStiff: 3, drowsy: 1, fluct: 1, seizure: 1, immuno: 1 }) : 0) },
    { id: "wernicke", name: "Wernicke encephalopathy", card: "wernicke", urg: "now", cantMiss: true,
      score: (f) => (f.etoh || f.ataxiaOph ? s(f, { etoh: 2, ataxiaOph: 3, drowsy: 1, fluct: 1, cerebellar: 1 }) : 0) },
    { id: "ncse", name: "Non-convulsive status epilepticus", card: "ncse", urg: "now", cantMiss: true,
      score: (f) => s(f, { fluct: 3, seizure: 2 }) + (f.drowsy && (f.fluct || f.seizure) ? 1 : 0) + ((f.fluct || f.seizure || f.drowsy) && (f.drugStop || f.newMed) ? 1 : 0) },
    { id: "sah", name: "Subarachnoid hemorrhage", card: "headache", urg: "now", cantMiss: true,
      score: (f) => s(f, { thunder: 4, neckStiff: 1, drowsy: 1, seizure: 1 }) + (f.thunder && (f.anticoag || f.antiplt) ? 1 : 0) },
    { id: "cvst", name: "Cerebral venous sinus thrombosis", card: "headache", urg: "now", cantMiss: true,
      score: (f) => { const risk = f.preg || f.estrogen || f.thrombo || f.cancer;
        return f.headPos || (risk && (f.seizure || f.drowsy || f.hemi)) ? s(f, { headPos: 2, preg: 2, estrogen: 1, thrombo: 2, cancer: 1, seizure: 1, hemi: 1, drowsy: 1, visual: 1 }) : 0; } },
    { id: "dissect", name: "Vertebral or carotid artery dissection", card: "dissect", urg: "now", cantMiss: true,
      score: (f) => (f.neckPain || f.horner ? s(f, { neckPain: 2, horner: 2, hemi: 1, vertigo: 1, cantWalk: 1, neckManip: 2 }) + (f.neckPain && f.horner ? 1 : 0) : 0) },
    { id: "myelitis", name: "Transverse myelitis (cord not compressed)", card: "myelitis", urg: "today", cantMiss: true,
      score: (f) => (f.mriNoComp ? 3 + s(f, { sensLevel: 1, para: 1, retention: 1, hyperreflex: 1, knownMS: 1, viralURI: 1, vaccine: 1 }) : 0) },
    { id: "botul", name: "Botulism or tick paralysis (GBS / MG mimic)", card: "botul", urg: "now", cantMiss: true,
      score: (f) => s(f, { descend: 3, pupils: 2, tick: 5, botRisk: 3, noSens: 1, toxExp: 1 }) + (f.bulbar && f.ptosis && f.pupils ? 1 : 0) - (f.fatig ? 1 : 0) },
    { id: "hypogly", name: "Hypoglycemia (can cause focal deficit, seizure, coma)", card: "hypogly", urg: "now", cantMiss: true,
      score: (f) => (f.lowGlu ? 2 + (f.hemi || f.drowsy || f.seizure || f.fluct ? 2 : 0) : 0) },
    { id: "pres", name: "PRES (posterior reversible encephalopathy)", card: "pres", urg: "now", cantMiss: true,
      score: (f) => (f.htn || f.presRisk || f.visual ? s(f, { htn: 2, presRisk: 2, visual: 2, seizure: 1, drowsy: 1, preg: 1 }) : 0) },
    { id: "hypok", name: "Hypokalemic weakness", card: "weak", urg: "today", score: (f) => (f.lowK ? 3 : 0) + (f.para || f.prox ? 1 : 0) },
    { id: "myo", name: "Myopathy / rhabdomyolysis / myositis", card: "weak", urg: "today", score: (f) => s(f, { prox: 2, highCK: 3 }) + (f.prox && f.newMed ? 1 : 0) - (f.areflex ? 1 : 0) },
    { id: "neurop", name: "Peripheral neuropathy (B12, alcohol, diabetes, chemo)", card: "weak", urg: "routine",
      score: (f) => s(f, { distalNumb: 2, areflex: 1, dorsal: 1, romberg: 1 }) - (f.ascend ? 2 : 0) - (f.sensLevel ? 2 : 0) },
    { id: "scd", name: "B12 or copper deficiency (subacute combined degeneration)", card: "weak", urg: "today",
      score: (f) => (f.dorsal || f.romberg || f.toxExp ? s(f, { dorsal: 2, romberg: 2, hyperreflex: 1, distalNumb: 1, etoh: 1, toxExp: 1 }) : 0) },
    { id: "cip", name: "Critical illness neuropathy / myopathy", card: "weak", urg: "routine",
      score: (f) => (f.icuSepsis ? 2 + s(f, { para: 1, areflex: 1, prox: 1, flaccid: 1 }) : 0) - (f.sensLevel ? 2 : 0) },
    { id: "functional", name: "Functional neurological disorder (positive signs)", card: "weak", urg: "routine",
      score: (f) => (f.functional ? 3 : 0) - (f.hyperreflex || f.sensLevel || f.wasting ? 2 : 0) },
    { id: "mono", name: "Single nerve or root lesion (compression palsy, radiculopathy)", card: "weak", urg: "routine", score: (f) => (f.single ? 3 : 0) }];
  function s(f, w) { let n = 0; for (const k in w) if (f[k]) n += w[k]; return n; }

  /* ---------- special bedside tests: how to do them, what abnormal means, which finding an abnormal result ticks ----------
     UNVERIFIED summaries written by Claude from general knowledge; sensitivity notes are approximate. */
  const EXAM = [
    { group: "Subtle upper motor neuron (corticospinal)", tests: [
      { id: "pronator", name: "Pronator drift", how: "Arms out straight, palms up, eyes closed, 20–30 s.", abn: "One arm pronates and drifts down.", means: "Subtle corticospinal weakness on that side (opposite brain).", sets: ["drift"] },
      { id: "barre", name: "Barré leg drift", how: "Prone with knees flexed to 90°, or supine with hips and knees flexed, hold 30 s.", abn: "One leg drifts down.", means: "Subtle pyramidal weakness of that leg.", sets: ["drift"] },
      { id: "tapping", name: "Finger / foot tapping speed", how: "Tap index finger on thumb (or foot on floor) fast for 10 s, each side.", abn: "Slower or smaller on one side.", means: "Subtle corticospinal deficit; smaller and fading amplitude suggests parkinsonism.", sets: ["drift"] },
      { id: "hoffmann", name: "Hoffmann sign", how: "Flick the nail of the middle finger downward.", abn: "Thumb and index finger flex.", means: "Hyperreflexia: corticospinal lesion above C5-6 (cervical cord or brain). Can be normal if symmetric with brisk reflexes everywhere.", sets: ["hyperreflex"] },
      { id: "babinski", name: "Plantar response (Babinski)", how: "Stroke the outer sole from heel toward the little toe, then across.", abn: "Big toe goes up, other toes fan.", means: "Upper motor neuron lesion.", sets: ["hyperreflex"] }] },
    { group: "Cerebellar", tests: [
      { id: "fnf", name: "Finger-nose-finger", how: "Touch your finger then their nose, with your finger moving; eyes open.", abn: "Intention tremor, past-pointing.", means: "Cerebellar hemisphere on the same side. (Weakness can make it look clumsy: test strength first.)", sets: ["cerebellar"] },
      { id: "hks", name: "Heel-knee-shin", how: "Lying down, heel on the opposite knee, slide down the shin to the ankle.", abn: "Wobbles or falls off the shin.", means: "Cerebellar (same side); with eyes-closed worsening, think proprioception loss.", sets: ["cerebellar"] },
      { id: "dysdiado", name: "Rapid alternating movements", how: "Pat the palm then the back of the hand on the thigh, fast.", abn: "Slow, irregular, clumsy rhythm (dysdiadochokinesia).", means: "Cerebellar on the same side.", sets: ["cerebellar"] },
      { id: "rebound", name: "Rebound (check) test", how: "Patient pulls against your hand with arm flexed; let go suddenly (guard their face).", abn: "Arm overshoots and hits.", means: "Cerebellar.", sets: ["cerebellar"] },
      { id: "tandem", name: "Tandem gait", how: "Heel-to-toe walk in a straight line, 10 steps.", abn: "Cannot do it, steps off the line.", means: "Non-specific: midline cerebellar (vermis), sensory or vestibular. Inability to walk at all with acute vertigo is a central sign.", sets: [] }] },
    { group: "Sensory and balance", tests: [
      { id: "romberg", name: "Romberg", how: "Feet together, steady with eyes open first; then close eyes for 30 s. Stand close to catch.", abn: "Steady with eyes open, sways or falls with eyes closed.", means: "Sensory ataxia (dorsal columns, large-fibre neuropathy) or vestibular loss. Not a cerebellar test.", sets: ["romberg"] },
      { id: "jps", name: "Joint position and vibration", how: "Eyes closed: move the great toe up or down in small steps; 128 Hz tuning fork on the great toe, then ankle, knee.", abn: "Wrong direction, or vibration reduced.", means: "Dorsal columns or large-fibre neuropathy: B12, copper, diabetes, syphilis, cord compression.", sets: ["dorsal"] },
      { id: "cortical", name: "Graphesthesia / stereognosis", how: "Eyes closed: trace a number on the palm; place a coin or key in the hand.", abn: "Cannot identify, with normal touch and pain.", means: "Opposite parietal cortex.", sets: ["corticalSens"] }] },
    { group: "Meningeal irritation", tests: [
      { id: "kernig", name: "Kernig sign", how: "Supine, hip and knee at 90°, then straighten the knee.", abn: "Pain and resistance in the hamstrings or back.", means: "Meningeal irritation. Low sensitivity: a negative test does NOT rule out meningitis.", sets: ["neckStiff"] },
      { id: "brudz", name: "Brudzinski sign", how: "Supine, passively flex the neck.", abn: "Hips and knees flex.", means: "Meningeal irritation. Low sensitivity, like Kernig.", sets: ["neckStiff"] },
      { id: "jolt", name: "Jolt accentuation", how: "Turn the head side to side 2–3 times a second.", abn: "Headache gets worse.", means: "Suggests meningitis in fever + headache; later studies found it less sensitive than first reported. Do LP if suspected anyway.", sets: ["neckStiff"] }] },
    { group: "Neuromuscular junction (myasthenia)", tests: [
      { id: "upgaze", name: "Sustained upgaze (Simpson)", how: "Look up without blinking for 60 s.", abn: "Eyelids droop progressively (± double vision).", means: "Fatigable ptosis: myasthenia.", sets: ["fatig", "ptosis"] },
      { id: "curtain", name: "Curtain sign (enhanced ptosis)", how: "Lift the more droopy lid by hand.", abn: "The other lid drops.", means: "Bilateral NMJ weakness masked by frontalis effort: myasthenia.", sets: ["ptosis"] },
      { id: "cogan", name: "Cogan lid twitch", how: "Look down 10–15 s, then quickly back to straight ahead.", abn: "Upper lid overshoots upward briefly.", means: "Myasthenia.", sets: ["fatig", "ptosis"] },
      { id: "icepack", name: "Ice-pack test", how: "Ice pack (in a glove) on the closed droopy lid for 2 min.", abn: "Ptosis improves by 2 mm or more.", means: "Supports myasthenia (cold improves NMJ transmission).", sets: ["fatig", "ptosis"] },
      { id: "neckflex", name: "Neck flexion / count to 50", how: "Test neck flexion strength; count aloud on one breath.", abn: "Weak neck flexion; cannot count past about 20.", means: "Bulbar/respiratory involvement in MG or GBS: measure FVC/NIF now.", sets: ["bulbar"] }] },
    { group: "Frontal release", tests: [
      { id: "grasp", name: "Grasp reflex", how: "Stroke the palm from wrist to fingers while distracting the patient.", abn: "Involuntary grasp.", means: "Opposite frontal lobe, especially if one-sided.", sets: ["frontal"] },
      { id: "palmomental", name: "Palmomental reflex", how: "Stroke the thenar eminence.", abn: "Same-side chin twitch.", means: "Non-specific; common in older adults.", sets: ["frontal"] },
      { id: "glabellar", name: "Glabellar tap (Myerson)", how: "Tap between the eyebrows from above (out of view), 10 times.", abn: "Keeps blinking, does not habituate.", means: "Parkinsonism or diffuse frontal dysfunction.", sets: ["frontal"] }] },
    { group: "Functional (positive signs)", tests: [
      { id: "hoover", name: "Hoover sign", how: "Hand under the weak heel: ask to push the weak leg down (weak), then to lift the good leg against resistance.", abn: "Weak leg pushes down strongly when the good leg lifts.", means: "Functional leg weakness (positive sign, not exclusion).", sets: ["functional"] },
      { id: "giveway", name: "Give-way / collapsing weakness", how: "Test power with steady pressure.", abn: "Full power briefly, then sudden collapse.", means: "Supports functional weakness; pain or poor effort can do the same.", sets: ["functional"] },
      { id: "driftNoPron", name: "Drift without pronation", how: "As for pronator drift.", abn: "Arm drops straight down without pronating.", means: "Suggests functional weakness.", sets: ["functional"] },
      { id: "abductor", name: "Hip abductor sign", how: "Supine, ask to abduct each leg against resistance while feeling the other leg.", abn: "Weak leg abducts strongly when the good leg abducts.", means: "Functional leg weakness.", sets: ["functional"] }] },
    { group: "Brainstem and vestibular", tests: [
      { id: "hints", name: "HINTS (constant vertigo with nystagmus only)", how: "Head impulse, nystagmus direction, test of skew (alternate cover). Use the Vertigo ticks above for each part.", abn: "Normal head impulse, direction-changing or vertical nystagmus, or skew.", means: "Central (posterior circulation stroke). Any one central sign is enough.", sets: ["vertigo", "vConstant"] },
      { id: "dix", name: "Dix-Hallpike", how: "Sit, head turned 45°, lie back quickly with the head 20° below the bed; watch 30 s.", abn: "Brief up-beating torsional nystagmus toward the lower ear, with vertigo.", means: "Posterior canal BPPV: Epley manoeuvre.", sets: ["vertigo", "vPositional", "dixPos"] },
      { id: "dolls", name: "Doll's eyes (oculocephalic)", how: "Comatose patient only, cervical spine cleared: turn the head side to side.", abn: "Eyes move with the head (no counter-rotation).", means: "Brainstem dysfunction in coma. In an awake patient, use the head impulse test instead.", sets: ["drowsy"] }] }];

  /* ---------- where is the lesion? UMN (brain / cord) vs LMN (root, nerve) vs junction vs muscle ---------- */
  const LEVELS = {
    brain: { name: "Brain (upper motor neuron)", test: "CT head now (code stroke if within the window), then MRI brain. Fingerstick glucose first.",
      dx: ["stroke", "sdh", "pres", "cvst", "hypogly", "mening", "ncse"] },
    cord: { name: "Spinal cord (upper motor neuron below the level)", test: "MRI whole spine with contrast, urgently. Bladder scan; check for a sensory level.",
      dx: ["cord", "myelitis"] },
    lmn: { name: "Root or peripheral nerve (lower motor neuron)", test: "Root/cauda: MRI lumbar spine. Nerves (GBS, neuropathy): LP and NCS/EMG; K, Mg, glucose, B12; FVC/NIF if spreading.",
      dx: ["cauda", "gbs", "neurop", "mono", "botul"] },
    nmj: { name: "Neuromuscular junction", test: "FVC/NIF now; AChR and MuSK antibodies; EMG with repetitive stimulation (single-fibre if negative); ice-pack test for ptosis. Think botulism if pupils are involved or weakness descends.",
      dx: ["mg", "botul"] },
    muscle: { name: "Muscle", test: "CK, K, phosphate, TSH, creatinine, urine myoglobin; medication review (statins, steroids, checkpoint inhibitors); myositis antibodies and MRI/EMG/biopsy if CK high without a clear cause.",
      dx: ["myo", "hypok"] } };
  function localize(f) {
    const umn = f.hyperreflex || f.spastic, lmnSigns = f.areflex || f.flaccid || f.wasting || f.fascic, pure = f.reflexNormal && f.sensOK && !umn && !lmnSigns;
    const sc = {
      brain: (f.hemi ? 3 : 0) + (f.drift ? 2 : 0) + (f.corticalSens ? 2 : 0) + (f.frontal ? 1 : 0) + (f.hemi && umn ? 1 : 0) + (f.facial && f.hemi ? 1 : 0) - (f.sensLevel ? 3 : 0),
      cord: (f.sensLevel ? 3 : 0) + (f.para && umn ? 2 : 0) + (f.retention && f.para ? 1 : 0) + (f.para && f.hyperacute && lmnSigns && (f.sensLevel || f.retention) ? 1 : 0) - (f.hemi && !f.para ? 2 : 0) - (f.saddle ? 2 : 0),
      lmn: s(f, { areflex: 2, flaccid: 1, wasting: 2, fascic: 2, single: 2, distalNumb: 1, saddle: 3, ascend: 1 }) + (f.dorsal && f.areflex ? 1 : 0) - (f.sensLevel ? 3 : 0) - (umn ? 2 : 0),
      nmj: s(f, { fatig: 3, ptosis: 2, bulbar: 1, descend: 2, pupils: 1 }) + (pure ? 1 : 0) - (f.areflex && !f.descend ? 1 : 0) - (f.distalNumb ? 1 : 0),
      muscle: s(f, { prox: 2, highCK: 3, lowK: 1 }) + (pure ? 1 : 0) - (f.ptosis ? 2 : 0) - (f.distalNumb ? 1 : 0) };
    const order = Object.keys(sc).sort((a, b) => sc[b] - sc[a]);
    const top = sc[order[0]] >= 3 ? order[0] : null;
    const warn = [];
    if ((f.areflex || f.flaccid) && f.para && (f.sensLevel || f.retention) && !f.saddle) warn.push("Floppy legs with absent reflexes but a sensory level or retention: acute cord lesion in spinal shock can look LMN. Treat as cord: MRI whole spine now.");
    if (umn && (f.wasting || f.fascic)) warn.push("UMN and LMN signs together: think ALS, cervical myelopathy with radiculopathy, or B12/copper deficiency (subacute combined degeneration).");
    if (f.saddle) warn.push("Cauda equina is LMN (absent ankle reflexes, floppy) even though it is in the spinal canal: MRI lumbosacral spine now.");
    if (f.ascend && !f.areflex && !umn) warn.push("Reflexes can still be present in the first 1–2 days of GBS: do not rule it out on reflexes alone.");
    if (f.ptosis && f.pupils) warn.push("Pupils involved: not myasthenia (MG spares the pupil). Think botulism or a third nerve palsy (aneurysm).");
    if (f.cerebellar && !f.hemi) warn.push("Limb ataxia without weakness: cerebellum (same side as the clumsy limb). With vertigo, treat as posterior circulation stroke until MRI; think Wernicke if alcohol or malnutrition.");
    if (f.romberg && !f.cerebellar) warn.push("Romberg positive means sensory ataxia (dorsal columns or large-fibre neuropathy) or vestibular loss, not cerebellar: check vibration and joint position; B12, copper, syphilis, diabetes.");
    if (f.romberg && f.cerebellar) warn.push("Cerebellar signs plus Romberg: the cerebellar patient is unsteady with eyes open too, so Romberg is unreliable here.");
    if (f.dorsal && (f.hyperreflex || f.spastic)) warn.push("Dorsal column loss with brisk reflexes (± absent ankle jerks): subacute combined degeneration (B12, copper, nitrous oxide) or cervical myelopathy.");
    if (f.functional) warn.push("Functional signs support functional disorder but do not exclude disease: about 1 in 10 also have a neurological condition. Still image if the history or other signs fit.");
    if (f.frontal) warn.push("Frontal release signs are non-specific in older or delirious patients; significant only if new, one-sided (grasp), or with other frontal signs.");
    if (f.hemi && f.lowGlu) warn.push("One-sided weakness with low glucose: correct glucose and re-examine before calling it a stroke.");
    return { level: top, name: top ? LEVELS[top].name : null, test: top ? LEVELS[top].test : null, scores: sc, next: order[1] && sc[order[1]] >= 3 && sc[order[1]] >= sc[order[0]] - 1 ? order[1] : null, warn };
  }

  /* mimics to keep in mind for the top diagnosis (general knowledge, written by Claude; a prompt, not a list to rule out one by one) */
  const MIMICS = {
    cord: ["Transverse myelitis", "Spinal cord infarct (sudden, painful)", "Guillain-Barré", "Cauda equina / conus", "Dural AV fistula", "B12 or copper deficiency"],
    cauda: ["Conus or cord compression", "Guillain-Barré", "Lumbar radiculopathy", "Retention from drugs or prostate (only after saddle sensation is normal)"],
    gbs: ["Botulism or tick paralysis", "Myasthenia gravis", "Cord compression or transverse myelitis", "Low K, PO4 or high Mg", "Critical illness neuropathy", "CIDP", "Vasculitic neuropathy", "Acute porphyria"],
    mg: ["Botulism", "Lambert-Eaton", "Miller Fisher (GBS)", "Brainstem stroke", "Third nerve palsy (aneurysm)", "Thyroid eye disease", "Myopathy / myositis (checkpoint inhibitor)"],
    ms: ["Pseudo-relapse (UTI, heat)", "NMOSD / MOGAD", "Stroke", "PML (natalizumab)", "B12 deficiency"],
    sdh: ["Stroke", "Seizure / post-ictal", "Hypoglycemia", "Delirium (sepsis, drugs)", "Hyponatremia", "Tumour"],
    stroke: ["Hypoglycemia", "Seizure with Todd paresis", "Migraine with aura", "Subdural", "Tumour", "PRES", "Old stroke unmasked by infection", "Functional", "Bell palsy (face only)"],
    vcentral: ["Vestibular neuritis", "BPPV", "Vestibular migraine", "Cerebellar hemorrhage", "Wernicke", "Drug toxicity (anticonvulsants, lithium)"],
    bppv: ["Vestibular neuritis", "Central vertigo", "Orthostatic hypotension", "Arrhythmia"],
    vneur: ["Posterior circulation stroke", "Labyrinthitis (hearing loss)", "Vestibular migraine", "Ramsay Hunt (VZV)", "Ménière disease"],
    hypok: ["Thyrotoxic periodic paralysis", "Guillain-Barré", "Myopathy", "Low phosphate", "High magnesium"],
    myo: ["Statin or steroid myopathy", "Inflammatory myositis", "Polymyalgia rheumatica", "Hypothyroidism", "Myasthenia", "Lambert-Eaton", "Rhabdomyolysis"],
    neurop: ["B12 or copper deficiency", "Guillain-Barré / CIDP", "Diabetes, alcohol, chemotherapy", "Vasculitic neuropathy", "Paraprotein (SPEP)"],
    mono: ["Cortical stroke (hand knob)", "Radiculopathy", "Compression palsy", "Mononeuritis multiplex (vasculitis, diabetes)"],
    mening: ["Autoimmune encephalitis", "Subarachnoid hemorrhage", "Sepsis-associated delirium", "Non-convulsive status", "Brain abscess", "NMS / serotonin syndrome"],
    wernicke: ["Delirium (sepsis, withdrawal)", "Hepatic encephalopathy", "Posterior circulation stroke", "Non-convulsive status", "Hypoglycemia"],
    ncse: ["Delirium", "Metabolic encephalopathy", "Prolonged post-ictal state", "Encephalitis", "Drug toxicity (cefepime, lithium)", "Catatonia"],
    sah: ["Reversible cerebral vasoconstriction (RCVS)", "CVST", "Pituitary apoplexy", "Dissection", "Meningitis", "Hypertensive emergency", "Migraine (diagnosis of exclusion)"],
    cvst: ["Idiopathic intracranial hypertension", "Migraine", "SAH", "Tumour", "Meningitis", "PRES"],
    dissect: ["Migraine", "Musculoskeletal neck pain", "Stroke from another cause", "Cluster headache (Horner)"],
    myelitis: ["Cord compression", "Spinal cord infarct", "Dural AV fistula", "B12 or copper deficiency", "NMOSD / MOGAD / MS", "Infection (HSV, VZV, HIV, syphilis)"],
    botul: ["Miller Fisher (GBS)", "Myasthenia gravis", "Brainstem stroke", "Lambert-Eaton", "Organophosphate poisoning", "Diphtheria"],
    hypogly: ["Stroke", "Seizure", "Wernicke", "Sepsis", "Adrenal insufficiency"],
    pres: ["Eclampsia", "Posterior circulation stroke", "RCVS", "CVST", "Hypertensive encephalopathy", "Encephalitis"],
    scd: ["Cervical myelopathy", "MS", "Diabetic neuropathy", "Syphilis (tabes dorsalis)", "HIV myelopathy", "Nitrous oxide use"],
    cip: ["Guillain-Barré", "Myasthenia (unmasked by drugs)", "Cord lesion", "Electrolyte weakness (K, PO4, Mg)", "Steroid myopathy"],
    functional: ["MS", "Stroke", "Myasthenia", "Myopathy", "Stiff-person syndrome", "Functional overlay on a real disease"] };

  /* every diagnosis with at least one supporting finding, for the "partly fits" list */
  function rankAll(f) {
    const loc = localize(f), boost = loc.level ? LEVELS[loc.level].dx : [];
    return DX.map((d) => { let sc = d.score(f); if (sc > 0 && boost.includes(d.id)) sc += 1; return { id: d.id, name: d.name, card: d.card, urg: d.urg, cantMiss: !!d.cantMiss, score: sc, why: why(d, f) }; })
      .filter((d) => d.score > 0).sort((a, b) => b.score - a.score || (b.cantMiss ? 1 : 0) - (a.cantMiss ? 1 : 0));
  }
  function differential(f) {
    const all = rankAll(f), fits = all.filter((d) => d.score >= 3), partial = all.filter((d) => d.score < 3).sort((a, b) => (b.cantMiss ? 1 : 0) - (a.cantMiss ? 1 : 0) || b.score - a.score);
    const top = fits[0] || null;
    return { top, also: fits.slice(1, 6), partial: partial.slice(0, 6), mimics: top ? (MIMICS[top.id] || []) : [] };
  }

  function rank(f) {
    const loc = localize(f), boost = loc.level ? LEVELS[loc.level].dx : [];
    return DX.map((d) => {
      let sc = d.score(f); if (sc > 0 && boost.includes(d.id)) sc += 1;
      return { id: d.id, name: d.name, card: d.card, urg: d.urg, cantMiss: !!d.cantMiss, score: sc, why: why(d, f) };
    }).filter((d) => d.score >= 3).sort((a, b) => b.score - a.score || (a.urg === "now" ? -1 : 1));
  }
  const WHY = {
    cord: ["para", "sensLevel", "retention", "backpain", "hyperreflex", "cancer", "fever", "spineProc", "anticoag", "absRisk"],
    cauda: ["saddle", "retention", "backpain", "para", "areflex", "cancer"],
    gbs: ["ascend", "areflex", "recentInf", "distalNumb", "facial", "bulbar", "autonomic", "dyspnea"],
    mg: ["fatig", "ptosis", "bulbar", "knownMG", "dyspnea"],
    ms: ["knownMS", "msNew", "heat"], sdh: ["drowsy", "fall", "gradual", "anticoag", "antiplt", "hemi"],
    stroke: ["hemi", "facial"], vcentral: ["hitNormal", "nysCentral", "skew", "hearing", "cantWalk", "vConstant"],
    bppv: ["vPositional", "dixPos"], vneur: ["vConstant"], hypok: ["lowK", "para", "prox"], myo: ["prox", "highCK"],
    neurop: ["distalNumb", "areflex"], mono: ["single"],
    mening: ["fever", "neckStiff", "drowsy", "fluct", "seizure", "immuno"], wernicke: ["etoh", "ataxiaOph", "drowsy", "fluct"],
    ncse: ["fluct", "seizure", "drowsy"], sah: ["thunder", "neckStiff", "drowsy", "seizure", "anticoag", "antiplt"],
    cvst: ["headPos", "preg", "estrogen", "thrombo", "cancer", "seizure", "hemi", "drowsy", "visual"], dissect: ["neckPain", "horner", "hemi", "vertigo", "cantWalk"],
    myelitis: ["mriNoComp", "sensLevel", "para", "retention", "hyperreflex", "knownMS"], botul: ["descend", "pupils", "tick", "botRisk", "noSens", "bulbar", "ptosis"],
    hypogly: ["lowGlu", "hemi", "drowsy", "seizure", "fluct"], pres: ["htn", "presRisk", "visual", "seizure", "drowsy", "preg"],
    scd: ["dorsal", "romberg", "hyperreflex", "distalNumb", "etoh", "toxExp"], functional: ["functional"], cip: ["icuSepsis", "para", "areflex", "prox", "flaccid"] };
  WHY.gbs.push("viralURI", "vaccine"); WHY.myelitis.push("viralURI", "vaccine"); WHY.vneur.push("viralURI"); WHY.dissect.push("neckManip");
  WHY.ncse.push("drugStop", "newMed"); WHY.ms.push("uti", "viralURI", "stressSleep"); WHY.botul.push("toxExp"); WHY.myo.push("newMed");
  ["drift", "corticalSens"].forEach((k) => WHY.stroke.push(k)); WHY.vcentral.push("cerebellar"); WHY.wernicke.push("cerebellar"); WHY.neurop.push("dorsal", "romberg");
  const why = (d, f) => (WHY[d.id] || []).filter((k) => f[k]).map((k) => LABEL[k]);

  /* ---------- breathing in GBS / MG: the 20/30/40 rule ----------
     rows: [{t, fvc (L), nif (cmH2O, negative), mep (cmH2O)}]; weight kg */
  function breathing(rows, weightKg) {
    const r = (rows || []).filter((x) => x && x.t != null).sort((a, b) => a.t - b.t);
    const last = (k) => { for (let i = r.length - 1; i >= 0; i--) if (r[i][k] != null && !isNaN(r[i][k])) return r[i]; return null; };
    const out = { flags: [], fvc: last("fvc"), nif: last("nif"), mep: last("mep"), fvcPerKg: null, drop: null, icu: false };
    if (out.fvc && weightKg) out.fvcPerKg = Math.round((out.fvc.fvc * 1000) / weightKg);
    if (out.fvcPerKg != null && out.fvcPerKg < 20) out.flags.push({ lvl: "urgent", text: `FVC ${out.fvcPerKg} mL/kg: under 20 mL/kg. ICU now; consider intubation.` });
    else if (out.fvcPerKg != null && out.fvcPerKg < 30) out.flags.push({ lvl: "action", text: `FVC ${out.fvcPerKg} mL/kg: under 30 mL/kg. Close to the ICU threshold; tell ICU, check every 2–4 h.` });
    if (out.fvc && !weightKg && out.fvc.fvc < 1.5) out.flags.push({ lvl: "action", text: `FVC ${out.fvc.fvc} L with no weight on file: enter the weight to apply the 20 mL/kg rule.` });
    if (out.nif) {
      const n = -Math.abs(out.nif.nif);
      if (n > -30) out.flags.push({ lvl: "urgent", text: `NIF ${n} cmH₂O: weaker than −30. ICU now.` });
      else if (n > -40) out.flags.push({ lvl: "action", text: `NIF ${n} cmH₂O: approaching −30.` });
    }
    if (out.mep && out.mep.mep < 40) out.flags.push({ lvl: "urgent", text: `MEP ${out.mep.mep} cmH₂O: under 40, weak cough. ICU now.` });
    // fall of 30% or more from the best FVC in the past 48 h
    const fv = r.filter((x) => x.fvc != null);
    if (fv.length >= 2) {
      const lastT = fv[fv.length - 1].t, recent = fv.filter((x) => lastT - x.t <= 48 * 36e5);
      const best = Math.max(...recent.map((x) => x.fvc)), cur = fv[fv.length - 1].fvc;
      out.drop = best > 0 ? Math.round(((best - cur) / best) * 100) : null;
      if (out.drop >= 30) out.flags.push({ lvl: "urgent", text: `FVC has fallen ${out.drop}% from the best value in 48 h (${best} → ${cur} L). Falling fast: ICU review.` });
      else if (out.drop >= 15) out.flags.push({ lvl: "action", text: `FVC down ${out.drop}% from the best value in 48 h. Increase checks.` });
    }
    out.icu = out.flags.some((x) => x.lvl === "urgent");
    return out;
  }

  /* ---------- myasthenia: medicines that can make it worse ---------- */
  const MG_DRUGS = [
    { re: /succinylcholine|suxamethonium|rocuronium|vecuronium|cisatracurium|atracurium|pancuronium/i, lvl: "avoid", why: "neuromuscular blocker: prolonged weakness; tell anesthesia the patient has MG" },
    { re: /magnesium sulfate|magnesium sulphate|mg sulfate/i, lvl: "avoid", why: "IV magnesium can cause crisis; avoid unless essential (e.g. eclampsia) and monitor" },
    { re: /botulinum|botox|dysport|xeomin/i, lvl: "avoid", why: "botulinum toxin worsens weakness" },
    { re: /telithromycin/i, lvl: "avoid", why: "contraindicated in MG" },
    { re: /pembrolizumab|nivolumab|ipilimumab|atezolizumab|durvalumab|avelumab|cemiplimab|dostarlimab|tremelimumab/i, lvl: "avoid", why: "checkpoint inhibitor: can cause or worsen MG (often with myositis/myocarditis)" },
    { re: /gentamicin|tobramycin|amikacin|streptomycin|neomycin/i, lvl: "caution", why: "aminoglycoside: use only if no alternative; monitor strength" },
    { re: /ciprofloxacin|levofloxacin|moxifloxacin|norfloxacin|ofloxacin/i, lvl: "caution", why: "fluoroquinolone: FDA warning, can worsen MG" },
    { re: /azithromycin|clarithromycin|erythromycin/i, lvl: "caution", why: "macrolide: can worsen MG" },
    { re: /colistin|polymyxin/i, lvl: "caution", why: "polymyxin: neuromuscular blockade" },
    { re: /\b\w+olol\b|labetalol|carvedilol/i, lvl: "caution", why: "beta-blocker (including eye drops): can worsen weakness" },
    { re: /procainamide|quinidine|quinine/i, lvl: "caution", why: "can worsen MG" },
    { re: /hydroxychloroquine|chloroquine/i, lvl: "caution", why: "can cause or worsen MG" },
    { re: /penicillamine/i, lvl: "caution", why: "can cause MG" },
    { re: /phenytoin|lithium/i, lvl: "caution", why: "case reports of worsening" },
    { re: /verapamil|diltiazem|nifedipine|amlodipine/i, lvl: "minor", why: "calcium channel blocker: occasional worsening" },
    { re: /atorvastatin|rosuvastatin|simvastatin|pravastatin|lovastatin/i, lvl: "minor", why: "statin: occasional worsening; usually continue" },
    { re: /prednisone|methylprednisolone|dexamethasone|hydrocortisone/i, lvl: "info", why: "steroid: a high starting dose can worsen MG for 5–10 days unless covered by IVIG or PLEX" }];
  function mgCheck(meds) {
    const out = [], seen = new Set();
    (meds || []).forEach((m) => MG_DRUGS.forEach((d) => {
      if (d.re.test(m) && !seen.has(m + d.lvl)) { seen.add(m + d.lvl); out.push({ med: m, lvl: d.lvl, why: d.why }); }
    }));
    const order = { avoid: 0, caution: 1, minor: 2, info: 3 };
    return out.sort((a, b) => order[a.lvl] - order[b.lvl]);
  }

  /* ---------- antithrombotics and reversal (subdural, cord hematoma, before LP or surgery) ---------- */
  const ANTITHROMB = [
    { re: /warfarin|coumadin/i, kind: "warfarin", rev: "4-factor PCC (dose by INR and weight) + vitamin K 10 mg IV. Recheck INR 15–30 min after PCC." },
    { re: /dabigatran|pradaxa/i, kind: "dabigatran", rev: "Idarucizumab 5 g IV. Check creatinine (renal clearance). Dialysis removes it." },
    { re: /apixaban|eliquis|rivaroxaban|xarelto|edoxaban|lixiana|savaysa/i, kind: "factor Xa inhibitor", rev: "4-factor PCC (often 2000 units, or 50 units/kg) or andexanet where available. Note time of last dose." },
    { re: /enoxaparin\s*(30|40)\s*mg|dalteparin\s*5,?000|tinzaparin\s*4,?500|heparin\s*5,?000\s*units?\s*(subcut|sc|s\.c)|fondaparinux\s*2\.5/i, kind: "VTE prophylaxis dose", rev: "Prophylactic dose: hold if bleeding; reversal usually not needed. Note time of last dose before LP or surgery." },
    { re: /enoxaparin|dalteparin|tinzaparin|fondaparinux/i, kind: "LMWH", rev: "Protamine (partial reversal of LMWH; none for fondaparinux). Note time of last dose." },
    { re: /\bheparin\b(?!.*(flush|lock))/i, kind: "heparin", rev: "Stop infusion; protamine 1 mg per 100 units given in the past 2–3 h (max 50 mg)." },
    { re: /\baspirin\b|\basa\b|acetylsalicylic/i, kind: "antiplatelet", rev: "Hold. Platelet transfusion is not routine; discuss with neurosurgery if surgery is planned." },
    { re: /clopidogrel|ticagrelor|prasugrel|plavix|brilinta/i, kind: "antiplatelet", rev: "Hold. Platelet transfusion is not routine; discuss with neurosurgery if surgery is planned." }];
  function antithrombotics(meds) {
    const out = [];
    (meds || []).forEach((m) => { const a = ANTITHROMB.find((x) => x.re.test(m)); if (a && !out.some((o) => o.med === m)) out.push({ med: m, kind: a.kind, rev: a.rev }); });
    return out;
  }

  /* ---------- MS: true relapse or pseudo-relapse ----------
     x: { tempMax, wbc, crp, uaPositive (bool|null), heat (bool) } */
  function pseudoRelapse(x) {
    const trig = [];
    if (x.tempMax != null && x.tempMax >= 37.8) trig.push(`temperature ${x.tempMax} °C`);
    if (x.wbc != null && x.wbc > 11) trig.push(`WBC ${x.wbc}`);
    if (x.crp != null && x.crp > 10) trig.push(`CRP ${x.crp}`);
    if (x.uaPositive) trig.push("urinalysis positive (leukocyte esterase or nitrite)");
    if (x.heat) trig.push("heat or exertion");
    const missing = [];
    if (x.tempMax == null) missing.push("temperature");
    if (x.wbc == null) missing.push("WBC");
    if (x.uaPositive == null) missing.push("urinalysis");
    return {
      verdict: trig.length ? "pseudo" : missing.length ? "incomplete" : "true",
      triggers: trig, missing,
      text: trig.length
        ? "Possible pseudo-relapse: a trigger is present (" + trig.join("; ") + "). Treat the trigger and recheck in 24–48 h before giving steroids."
        : missing.length ? "Check for a trigger first: " + missing.join(", ") + " not found."
        : "No trigger found: a true relapse is possible if symptoms are new, last over 24 h and are at least 30 days after the last relapse."
    };
  }

  /* ---------- MS: weigh all six features (not only "is there a trigger") ----------
     a: { sx: "new"|"old", dur24: "yes"|"no", days30: "yes"|"no", trig: "yes"|"no", fluct: "yes"|"no", improve: "yes"|"no", mri: "new"|"none" }
     chartTriggers: strings from pseudoRelapse() (fever, WBC, CRP, UA, heat). UNVERIFIED weights written by Claude. */
  const MS_Q = [
    { k: "sx", q: "Is the symptom brand new, or one they have had before?", opts: [["new", "Brand new (or a major worsening of an old one)"], ["old", "Old symptom coming back"]] },
    { k: "dur24", q: "Has it lasted 24 hours or more?", opts: [["yes", "Yes, 24 h or more"], ["no", "No, under 24 h"]] },
    { k: "days30", q: "Did it start 30 days or more after the start of the last relapse?", opts: [["yes", "Yes, 30 days or more"], ["no", "No, within 30 days"]] },
    { k: "trig", q: "Is there a trigger: fever, infection (UTI, chest, virus), heat, poor sleep, stress or overexertion?", opts: [["yes", "Yes"], ["no", "No (checked)"]] },
    { k: "fluct", q: "Does it fluctuate with temperature or fatigue, or improve within hours to 2 days of treating the trigger?", opts: [["yes", "Yes, fluctuates / improving"], ["no", "No, steady or worsening"]] },
    { k: "mri", q: "MRI compared with baseline?", opts: [["new", "New or enhancing lesion"], ["none", "No new activity"]] }];
  function msRelapse(a, chartTriggers) {
    a = a || {}; const ct = chartTriggers || [], trig = a.trig || (ct.length ? "yes" : null);
    let t = 0, p = 0; const forT = [], forP = [], notes = [];
    if (a.sx === "new") { t += 2; forT.push("brand-new symptom"); } else if (a.sx === "old") { p += 2; forP.push("old symptom recurring"); }
    if (a.dur24 === "yes") { t += 1; forT.push("lasted 24 h or more"); } else if (a.dur24 === "no") { p += 3; forP.push("under 24 h (not a relapse by definition)"); }
    if (a.days30 === "no") notes.push("Within 30 days of the last relapse: counts as part of that relapse, not a new one.");
    else if (a.days30 === "yes") { t += 1; forT.push("30 days or more since the last relapse"); }
    if (trig === "yes") { p += 2; forP.push("trigger present" + (ct.length && !a.trig ? " (chart: " + ct.join("; ") + ")" : "")); } else if (trig === "no") { t += 1; forT.push("no trigger found"); }
    if (a.fluct === "yes") { p += 2; forP.push("fluctuates / improving quickly"); } else if (a.fluct === "no") { t += 1; forT.push("steady or worsening"); }
    if (a.mri === "new") { t += 4; forT.push("new or enhancing MRI lesion"); } else if (a.mri === "none") { p += 2; forP.push("no new MRI activity"); }
    const answered = MS_Q.filter((q) => a[q.k]).length + (!a.trig && ct.length ? 1 : 0);
    if (a.sx === "new" && trig === "yes") notes.push("A trigger does not rule out a true relapse when the symptom is brand new: treat the trigger, reassess in 24–48 h, and get an MRI if it persists.");
    if (a.sx === "old" && a.mri === "new") notes.push("Old symptom but new MRI activity: the MRI wins, so treat as a true relapse.");
    const verdict = !answered ? "none" : a.mri === "new" || t - p >= 3 ? "true" : p - t >= 3 ? "pseudo" : "unclear";
    const text = verdict === "true" ? "True MS relapse likely (" + forT.join("; ") + "). If it limits function: methylprednisolone 500–1000 mg IV daily for 3–5 days (check glucose and infection first); tell the MS clinic and review DMT."
      : verdict === "pseudo" ? "Pseudo-relapse likely (" + forP.join("; ") + "). Treat the trigger, cool, rest; no steroids. Expect improvement within 24–48 h; if not, reassess and consider MRI."
      : verdict === "unclear" ? "Unclear (" + [forT.length ? "for relapse: " + forT.join(", ") : "", forP.length ? "for pseudo-relapse: " + forP.join(", ") : ""].filter(Boolean).join("; ") + "). Treat any trigger, reassess in 24–48 h; MRI brain ± spine with contrast if it persists or is new."
      : "";
    return { verdict, t, p, forT, forP, notes, text, answered };
  }

  /* ---------- medicines that cause or unmask neuro problems (chart list; "new" = ordered in the past 14 days) ---------- */
  const MED_CLUES = [
    { re: /pembrolizumab|nivolumab|ipilimumab|atezolizumab|durvalumab|cemiplimab|dostarlimab|tremelimumab/i, text: "Checkpoint inhibitor: myasthenia, myositis (± myocarditis), GBS-like neuropathy, encephalitis. Check CK and troponin." },
    { re: /cefepime/i, text: "Cefepime (especially with poor kidney function): encephalopathy, myoclonus, non-convulsive status." },
    { re: /ciprofloxacin|levofloxacin|moxifloxacin|gentamicin|tobramycin|amikacin|azithromycin|clarithromycin|magnesium sulfate/i, text: "Fluoroquinolone, aminoglycoside, macrolide or IV magnesium: can unmask or worsen myasthenia." },
    { re: /atorvastatin|rosuvastatin|simvastatin|pravastatin|lovastatin/i, text: "Statin: myopathy (check CK); rarely immune-mediated necrotizing myopathy." },
    { re: /prednisone|dexamethasone|methylprednisolone|hydrocortisone/i, text: "Steroids: proximal myopathy, hyperglycemia, delirium; high doses can worsen myasthenia at first." },
    { re: /tacrolimus|cyclosporine|bevacizumab/i, text: "Tacrolimus / cyclosporine / bevacizumab: PRES, tremor, seizures. Check the level and BP." },
    { re: /natalizumab|rituximab|ocrelizumab|fingolimod|dimethyl fumarate/i, text: "MS / immunosuppressive drug: PML or opportunistic infection with new symptoms." },
    { re: /lithium/i, text: "Lithium: tremor, ataxia, confusion, seizures (check level)." },
    { re: /phenytoin|carbamazepine|oxcarbazepine|lacosamide|lamotrigine/i, text: "Antiseizure drug: ataxia, nystagmus, dizziness, diplopia when levels are high (oxcarbazepine/carbamazepine: low sodium)." },
    { re: /metronidazole/i, text: "Metronidazole: neuropathy and cerebellar toxicity with long courses." },
    { re: /linezolid|isoniazid|vincristine|paclitaxel|docetaxel|oxaliplatin|cisplatin|bortezomib|thalidomide/i, text: "Neuropathy-causing drug (linezolid, isoniazid without B6, chemotherapy)." },
    { re: /ondansetron|tramadol|linezolid|methylene blue|fentanyl|ssri|sertraline|citalopram|escitalopram|fluoxetine|paroxetine|venlafaxine|duloxetine|trazodone/i, text: "Serotonergic drugs together: serotonin syndrome (clonus, agitation, fever, diarrhea)." },
    { re: /haloperidol|olanzapine|quetiapine|risperidone|metoclopramide|prochlorperazine/i, text: "Dopamine blocker: NMS (rigidity, fever, high CK), parkinsonism, akathisia; avoid in Lewy body or Parkinson." },
    { re: /apixaban|rivaroxaban|edoxaban|dabigatran|warfarin|enoxaparin|heparin|clopidogrel|ticagrelor/i, text: "Antithrombotic: bleeding (subdural, cord hematoma after LP or epidural)." },
    { re: /estradiol|ethinyl|estrogen|premarin/i, text: "Estrogen: venous sinus thrombosis risk." },
    { re: /insulin|glargine|gliclazide|glyburide|glimepiride/i, text: "Insulin or sulfonylurea: hypoglycemia can cause focal deficits, seizures or coma." },
    { re: /zopiclone|lorazepam|diazepam|clonazepam|gabapentin|pregabalin|oxycodone|hydromorphone|morphine|baclofen/i, text: "Sedating drug (benzodiazepine, gabapentinoid, opioid, baclofen): drowsiness, falls, ataxia, delirium." }];
  function medClues(meds, newMeds) {
    const out = [], isNew = new Set((newMeds || []).map((m) => m.toLowerCase()));
    MED_CLUES.forEach((c) => { const hit = (meds || []).filter((m) => c.re.test(m)); if (hit.length) out.push({ text: c.text, meds: hit, isNew: hit.some((m) => isNew.has(m.toLowerCase())) }); });
    return out.sort((a, b) => (b.isNew ? 1 : 0) - (a.isNew ? 1 : 0));
  }

  /* ---------- bladder scan / post-void residual (mL) ---------- */
  function bladder(ml) {
    if (ml == null || isNaN(ml)) return null;
    if (ml >= 500) return { lvl: "urgent", text: `Bladder ${ml} mL: retention. Catheterize; with back pain or leg symptoms, this is cord/cauda equina until MRI says otherwise.` };
    if (ml > 200) return { lvl: "action", text: `Post-void residual ${ml} mL (over 200): abnormal. Ask about saddle numbness; check anal tone and perianal sensation.` };
    return { lvl: "ok", text: `Post-void residual ${ml} mL.` };
  }

  /* ---------- GCS trend (subdural) ---------- */
  function gcsTrend(rows) {
    const r = (rows || []).filter((x) => x.v != null).sort((a, b) => a.t - b.t);
    if (!r.length) return null;
    const cur = r[r.length - 1].v, best = Math.max(...r.map((x) => x.v)), drop = best - cur;
    return { cur, best, drop, lvl: drop >= 2 || cur <= 8 ? "urgent" : drop === 1 ? "action" : "ok",
      text: drop >= 2 ? `GCS fell ${drop} points (${best} → ${cur}): urgent repeat CT head and neurosurgery.` : cur <= 8 ? `GCS ${cur}: protect the airway.` : drop === 1 ? `GCS down 1 point (${best} → ${cur}): recheck within the hour.` : `GCS ${cur}, stable.` };
  }

  /* ---------- vertigo: HINTS+ ---------- */
  function hints(f) {
    if (!f.vConstant && !f.vertigo) return null;
    if (f.vPositional && !f.vConstant) return { lvl: "ok", text: f.dixPos ? "Brief positional vertigo with a positive Dix-Hallpike: BPPV. Treat with the Epley manoeuvre." : "Brief positional vertigo: do the Dix-Hallpike (or supine roll test). HINTS is only for constant vertigo with nystagmus." };
    if (!f.vConstant) return { lvl: "info", text: "Tick whether the vertigo is brief and positional, or constant with nystagmus." };
    const central = ["hitNormal", "nysCentral", "skew", "hearing", "cantWalk"].filter((k) => f[k]).map((k) => LABEL[k]);
    return central.length
      ? { lvl: "urgent", text: "Central features: " + central.join("; ") + ". Treat as posterior circulation stroke: MRI with DWI (CTA head and neck), stroke team. A negative CT does not rule it out." }
      : { lvl: "ok", text: "Constant vertigo with an ABNORMAL head impulse, one-direction horizontal nystagmus, no skew, normal hearing and able to walk: peripheral (vestibular neuritis) is likely. Only reliable if HINTS was done by a confident examiner." };
  }

  const api = { FINDINGS, LABEL, DX, rank, medClues, MED_CLUES, rankAll, differential, MIMICS, localize, LEVELS, EXAM, MS_Q, msRelapse, breathing, mgCheck, MG_DRUGS, antithrombotics, pseudoRelapse, bladder, gcsTrend, hints };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.NeuroRules = api;
})(typeof window !== "undefined" ? window : globalThis);
