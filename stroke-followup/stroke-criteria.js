/*
 * stroke-criteria.js — rules used by the Stroke Follow-up app (hospitalist). Edit here; no other file needs to change.
 *
 * Sources
 *   Post-lytic care:  BC (Northern Health) post-thrombolysis order set, matching Canadian Stroke Best Practices (CSBPR):
 *                     BP ≤180/105 for 24 h, no antithrombotics for 24 h and until follow-up CT shows no hemorrhage,
 *                     SCDs first 24 h, NPO until swallow screen passed, glucose 6–10, treat temp >37.5, angioedema watch.
 *   AF anticoagulation timing: ELAN trial (NEJM 2023) — early = within 48 h for minor/moderate, day 6–7 for major.
 *   PFO:              CSBPR 7th ed. Secondary Prevention, section 10 (age 18–60, non-lacunar embolic stroke).
 *   Prognosis scores: ASTRAL (Ntaios, Neurology 2012); THRIVE (Flint, AJNR 2010).
 *   Posterior circulation: non-contrast CT detects a minority of posterior fossa strokes; early DWI MRI misses
 *                     about 1 in 4 brainstem strokes in the first 48 h (Newman-Toker et al.).
 *   Local = a choice made for this app. Check against VGH / Island Health stroke order sets and neurology advice.
 */
(function (root) {
  'use strict';

  const DRUGS = {
    lytic: ['tenecteplase', 'alteplase', 'tnkase', 'activase', 'tnk', 't-pa', 'tpa'],
    antiplatelet: ['acetylsalicylic', 'aspirin', 'asa', 'clopidogrel', 'ticagrelor', 'prasugrel', 'dipyridamole'],
    anticoag: ['apixaban', 'rivaroxaban', 'dabigatran', 'edoxaban', 'warfarin', 'heparin', 'enoxaparin', 'dalteparin', 'tinzaparin'],
    prophylacticLmwh: /\b(?:enoxaparin\s*40|dalteparin\s*5000|tinzaparin\s*4500|heparin\s*5000)\b/i,
    statin: ['atorvastatin', 'rosuvastatin', 'simvastatin', 'pravastatin', 'lovastatin', 'fluvastatin', 'pitavastatin'],
    lipidOther: ['ezetimibe', 'evolocumab', 'alirocumab', 'inclisiran'],
    antihypertensive: ['amlodipine', 'ramipril', 'perindopril', 'lisinopril', 'candesartan', 'irbesartan', 'losartan', 'telmisartan',
      'valsartan', 'hydrochlorothiazide', 'chlorthalidone', 'indapamide', 'metoprolol', 'bisoprolol', 'labetalol', 'nifedipine', 'diltiazem']
  };
  const BRANDS = { eliquis: 'apixaban', xarelto: 'rivaroxaban', pradaxa: 'dabigatran', lixiana: 'edoxaban', coumadin: 'warfarin',
    lovenox: 'enoxaparin', fragmin: 'dalteparin', plavix: 'clopidogrel', brilinta: 'ticagrelor', lipitor: 'atorvastatin', crestor: 'rosuvastatin' };

  // Post-treatment care windows (hours after the lytic bolus, or after the end of EVT).
  const POST_TREATMENT = {
    neuroChecks: [ { untilH: 2, text: 'Neuro and vital signs every 15 min' }, { untilH: 8, text: 'every 30 min' }, { untilH: 24, text: 'every hour' } ],
    bpWindowH: 24,
    bpTreated: { sbp: 180, dbp: 105, text: 'SBP ≤180 and DBP ≤105 for 24 h after tenecteplase/alteplase or EVT' },
    bpEvtNote: 'After EVT, follow neurology’s target. Intensive lowering below 140 after successful thrombectomy did worse in trials, so avoid over-treating.',
    bpUntreated: { sbp: 220, dbp: 120, text: 'No lytic or EVT: allow BP up to 220/120 in the first 24–48 h unless another condition needs lower' },
    followUpImagingH: 24,      // CT (or MRI with blood-sensitive sequence) at 24 h
    imagingEarliestH: 18,      // imaging this soon or later counts as the follow-up scan
    antithromboticHoldH: 24,
    glucose: { low: 4, high: 10, target: '6–10 mmol/L' },
    tempHigh: 37.5,
    angioedemaWatchH: 24
  };

  // ELAN: early DOAC start. size: 'minor' ≤1.5 cm; 'moderate' cortical superficial branch of MCA/ACA/PCA, MCA deep branch, or internal
  // border zone; 'major' whole territory of MCA/ACA/PCA, ≥2 MCA cortical branches, or brainstem/cerebellar lesion >1.5 cm.
  const ELAN = {
    minor: { fromH: 0, toH: 48, text: 'within 48 h' },
    moderate: { fromH: 0, toH: 48, text: 'within 48 h' },
    major: { fromH: 120, toH: 168, text: 'day 6–7' },
    sizes: { minor: 'Minor (≤1.5 cm)', moderate: 'Moderate (one cortical or deep branch, border zone)', major: 'Major (whole territory, ≥2 MCA branches, or brainstem/cerebellum >1.5 cm)' },
    note: 'Start only once imaging shows no hemorrhage; neurology to confirm. ELAN found early start was at least as safe as later start.'
  };

  // Dual antiplatelet therapy (minor stroke or high-risk TIA, not treated with a lytic, no indication for anticoagulation).
  const DAPT = {
    nihssMax: 3, ticagrelorNihssMax: 5, abcd2Min: 4,
    text: 'Consider aspirin + clopidogrel for 21 days, then one antiplatelet (CHANCE/POINT), ideally started within 24 h. Ticagrelor + aspirin for 30 days is an option for NIHSS ≤5 (THALES). Confirm with neurology.'
  };

  // Posterior circulation features. Searched in notes; the clinician can also tick them.
  const POSTERIOR = {
    features: [
      ['vertigo', 'Vertigo / dizziness', /\bvertig\w*|\bdizz\w*|\bspinning\b|\broom (?:is )?spinning\b/i],
      ['diplopia', 'Double vision', /\bdiplopi\w*|\bdouble vision\b/i],
      ['ataxia', 'Ataxia / unable to walk', /\bataxi\w*|\bunsteady gait\b|\bunable to (?:walk|stand)\b|\btruncal\b|\bdysmetri\w*|\bfinger[- ]nose\b[^.]{0,30}\babnormal/i],
      ['dysarthria', 'Dysarthria', /\bdysarthri\w*|\bslurred speech\b/i],
      ['dysphagia', 'Dysphagia', /\bdysphagi\w*|\bdifficulty swallowing\b/i],
      ['nystagmus', 'Nystagmus', /\bnystagmus\b/i],
      ['visual', 'Visual field loss / hemianopia', /\bhemianopi\w*|\bvisual field\b|\bcortical blind\w*|\bquadrantanopi\w*/i],
      ['crossed', 'Crossed face/body findings', /\bcrossed\b|\bipsilateral face\b[^.]{0,40}\bcontralateral\b|\bwallenberg\b|\blateral medullary\b/i],
      ['horner', 'Horner syndrome', /\bhorner\w*|\bptosis\b[^.]{0,20}\bmiosis\b/i],
      ['loc', 'Decreased consciousness', /\bdecreased (?:LOC|level of consciousness)\b|\bobtunded\b|\bdrowsy\b|\bGCS (?:[3-9]|1[0-3])\b/i],
      ['vomiting', 'Vomiting with vertigo', /\bvomit\w*/i]
    ],
    // "suspect posterior" when at least this many features, or any one strong feature
    strong: ['diplopia', 'ataxia', 'crossed', 'horner', 'nystagmus'],   // hemianopia alone isn't counted: MCA strokes cause it too
    minCount: 2,
    earlyMriH: 48,
    text: 'Non-contrast CT misses most posterior fossa strokes, and a normal CTA does not exclude a small brainstem or cerebellar infarct.',
    earlyMriText: 'Early DWI MRI misses about 1 in 4 brainstem strokes in the first 48 h. If suspicion stays high, repeat MRI at 48–72 h.'
  };

  // HINTS (+ new hearing loss = HINTS-plus). Valid only for acute, continuous vertigo with nystagmus, done by a trained examiner.
  const HINTS = {
    applies: 'Use only for acute continuous vertigo (hours to days) WITH nystagmus at the time of the exam, done by someone trained in it. Not for brief positional vertigo (use Dix-Hallpike) or dizziness without nystagmus.',
    central: { impulse: 'normal', nystagmus: ['changing', 'vertical'], skew: 'present', hearing: 'new' },
    labels: {
      impulse: [['', 'Not done'], ['abnormal', 'Abnormal (corrective saccade) — peripheral'], ['normal', 'Normal — central sign in this setting']],
      nystagmus: [['', 'Not done'], ['unidirectional', 'Horizontal, one direction — peripheral'], ['changing', 'Direction-changing on gaze — central'], ['vertical', 'Vertical or pure torsional — central']],
      skew: [['', 'Not done'], ['absent', 'No skew'], ['present', 'Skew present — central']],
      hearing: [['', 'Not asked'], ['none', 'No new hearing loss'], ['new', 'New hearing loss — central (AICA) in HINTS-plus']]
    }
  };

  // Prognosis. Scores are calculated; the percentage tables from the original papers are NOT included yet
  // (couldn't verify them). To show percentages, fill these from the papers or MDCalc, e.g. thriveTable: { '0-2': '…%', ... }.
  const PROGNOSIS = {
    thriveTable: null,
    astralTable: null,
    links: { astral: 'https://www.mdcalc.com/calc/3967/astral-score-stroke', thrive: 'https://www.mdcalc.com/calc/1706/thrive-score-stroke-outcome' },
    thriveBands: [ { max: 2, label: 'Low risk of poor outcome' }, { max: 5, label: 'Intermediate risk' }, { max: 9, label: 'High risk of poor outcome' } ],
    malignantMcaMl: 145,  // DWI volume within 14 h predicting malignant MCA edema (Oppenheim 2000)
    locations: [
      ['lacunar', 'Small deep (lacunar) infarct', 'Usually a better chance of functional recovery than cortical strokes of similar NIHSS. Small-vessel cause: BP, statin, antiplatelet.'],
      ['cortical', 'Cortical MCA / ACA branch', 'Recovery depends mostly on NIHSS and deficits (aphasia, neglect). Embolic pattern: complete the cardiac workup.'],
      ['largeMca', 'Large MCA territory (≥ half the territory)', 'Risk of malignant swelling, usually days 2–5. Watch level of consciousness; involve neurosurgery early if age ≤60 (decompressive hemicraniectomy within 48 h improves survival).'],
      ['cerebellar', 'Cerebellar', 'Risk of swelling and hydrocephalus (days 2–4). Watch level of consciousness; involve neurosurgery early for large infarcts.'],
      ['brainstem', 'Brainstem / basilar', 'Swallowing and airway risk; can worsen in the first days. Basilar occlusion has the worst outlook.'],
      ['thalamic', 'Thalamic / PCA', 'Visual field loss and memory problems are common and affect driving and independence.'],
      ['multiple', 'Several vascular territories', 'Suggests a heart, aortic or cancer-related source. Complete the embolic workup.']
    ]
  };

  // Secondary prevention / workup tracker. Each item: how to find it in the chart, when it applies.
  // find: regex against order names, report names/text and note text. 'pathways' limits where it shows.
  const WORKUP = [
    { key: 'mri', label: 'MRI brain with DWI', find: /\bMRI\b[^.\n]{0,20}\b(?:head|brain)\b|\bMR brain\b|\bDWI\b/i, always: true },
    { key: 'cta', label: 'CTA head and neck (or carotid imaging)', find: /\bCTA\b|\bCT angio\w*|\bcarotid (?:doppler|duplex|ultrasound)\b|\bMRA\b/i, always: true },
    { key: 'echo', label: 'Echocardiogram (with bubble study if age ≤60 or ESUS)', find: /\becho\w*|\bTTE\b|\bTEE\b/i, always: true },
    { key: 'bubble', label: 'Bubble (agitated saline) study', find: /\bbubble\b|\bagitated saline\b|\bsaline contrast\b|\bTCD\b[^.]{0,20}\bbubble/i, esus: true, ageMax: 60 },
    { key: 'tele', label: 'Telemetry / ECG monitoring during admission', find: /\btelemetry\b|\bcardiac monitor\w*/i, always: true },
    { key: 'prolonged', label: 'Prolonged ECG monitoring after discharge (≈2 weeks or more; loop recorder if negative)', find: /\bholter\b|\bzio\b|\bevent monitor\b|\bloop recorder\b|\bILR\b|\b14[- ]day\b[^.]{0,20}\bmonitor/i, esus: true, outpatient: true },
    { key: 'lipids', label: 'Lipid panel', lab: 'ldl', always: true },
    { key: 'a1c', label: 'HbA1c', lab: 'a1c', always: true },
    { key: 'swallow', label: 'Swallow screen before anything by mouth', find: /\bswallow(?:ing)? screen\b|\bbedside swallow\b|\bSLP\b[^.]{0,20}\bswallow/i, always: true },
    { key: 'rehab', label: 'PT / OT / SLP assessments', find: /\b(?:physio|physical) therap\w*|\bPT consult\b|\boccupational therap\w*|\bOT consult\b|\bspeech[- ]language\b|\bSLP\b/i, always: true },
    { key: 'clinic', label: 'Stroke prevention clinic referral', find: /\bstroke prevention clinic\b|\bSPC\b|\bTIA clinic\b|\bneurovascular clinic\b/i, always: true, outpatient: true }
  ];

  // ESUS: extra tests and when the app suggests them.
  const ESUS_TESTS = [
    { key: 'tee', label: 'TEE (or CT of the aortic arch)', when: 'Suspected endocarditis, aortic arch atheroma, PFO anatomy before closure, or LV/LAA thrombus TTE can’t exclude', find: /\bTEE\b|\btransesophageal\b|\baortic arch\b/i },
    { key: 'legDoppler', label: 'Leg venous Doppler', when: 'PFO found — a DVT supports paradoxical embolism and changes treatment', find: /\b(?:venous )?doppler\b[^.]{0,20}\b(?:leg|lower (?:extremity|limb))\b|\bDVT (?:study|scan)\b/i, needs: 'pfo' },
    { key: 'apl', label: 'Antiphospholipid antibodies (lupus anticoagulant, anticardiolipin, β2-glycoprotein I); repeat at 12 weeks', when: 'Age under ~60, VTE history, pregnancy loss, or no other cause. Positive → warfarin, not a DOAC.', find: /\blupus anticoag\w*|\banticardiolipin\b|\bbeta[- ]?2[- ]?glycoprotein\b|\bβ2[- ]?glycoprotein\b|\bantiphospholipid\b/i, ageMax: 60 },
    { key: 'thrombophilia', label: 'Protein C, protein S, antithrombin (outpatient)', when: 'Only if young or VTE history. Falsely low acutely, on heparin (antithrombin) or warfarin (C, S): usually defer.', find: /\bprotein [CS]\b|\bantithrombin\b/i, ageMax: 50, defer: true },
    { key: 'ddimer', label: 'D-dimer (hidden cancer screen)', when: 'Several territories, cancer history, weight loss or anemia. Very high D-dimer → consider CT chest/abdomen/pelvis.', find: /\bd[- ]?dimer\b/i, lab: 'ddimer' },
    { key: 'cultures', label: 'Blood cultures', when: 'Fever, new murmur, or several territories (endocarditis)', find: /\bblood cultures?\b/i },
    { key: 'drugs', label: 'Urine drug screen', when: 'Age under 50 (cocaine, amphetamines)', find: /\b(?:urine )?drug screen\b|\btox(?:icology)? screen\b|\bUDS\b/i, ageMax: 50 },
    { key: 'pregnancy', label: 'Pregnancy test', when: 'Female under 50', find: /\bbeta[- ]?hcg\b|\bpregnancy test\b|\bβ-?hCG\b/i, ageMax: 50, female: true },
    { key: 'inflam', label: 'ESR / CRP (vasculitis)', when: 'Headache, several territories, systemic symptoms, or young without risk factors', find: /\bESR\b|\bCRP\b|\bsed(?:imentation)? rate\b|\bC[- ]reactive\b/i }
  ];

  // RoPE score (Kent 2013): higher = PFO more likely the cause.
  const ROPE = {
    age: [[29, 5], [39, 4], [49, 3], [59, 2], [69, 1], [200, 0]],
    noHtn: 1, noDm: 1, noPriorStroke: 1, nonSmoker: 1, cortical: 1,
    pfoClosure: { ageMin: 18, ageMax: 60, text: 'Closure + long-term antiplatelet is recommended for age 18–60 with an imaging-confirmed non-lacunar embolic stroke when a stroke expert judges the PFO the likely cause. Less favoured without an atrial septal aneurysm, a large shunt (>20 bubbles) or a large PFO (≥2 mm). (CSBPR 2020)' }
  };

  const ESUS_TREATMENT = 'Do not start anticoagulation empirically for ESUS: NAVIGATE ESUS, RE-SPECT ESUS and ARCADIA (atrial cardiopathy) were negative. Default is antiplatelet + statin + risk factors. Switch to anticoagulation if AF is found or there is another clear indication (LV thrombus, antiphospholipid syndrome, DVT with PFO).';

  // Words in reports and notes.
  const TEXT = {
    hemorrhage: /\bhemorrhag\w*|\bhaemorrhag\w*|\bh(?:a)?ematoma\b|\bPH[12]\b|\bHI[12]\b|\bhemorrhagic transformation\b|\bbleed\b/i,
    noHemorrhage: /\bno (?:evidence of )?(?:acute )?(?:intracranial )?(?:hemorrhage|haemorrhage|bleed|hemorrhagic transformation)\b/i,
    lvo: /\bocclu(?:sion|ded)\b|\bcut[- ]?off\b|\bLVO\b|\bthrombus\b/i,
    noLvo: /\bno (?:large vessel |significant |flow[- ]limiting )?(?:occlusion|LVO|stenosis)\b|\bpatent\b|\bunremarkable CTA\b|\bnormal CTA\b/i,
    infarct: /\b(?:acute|subacute) (?:\w+ )?infarct\w*|\brestricted diffusion\b|\bdiffusion restriction\b|\bDWI (?:positive|hyperintens\w*)\b/i,
    noInfarct: /\bno (?:evidence of )?(?:acute )?(?:infarct\w*|restricted diffusion|diffusion restriction|ischemi\w*)\b/i,
    pfo: /\bPFO\b|\bpatent foramen ovale\b|\bright[- ]to[- ]left shunt\b|\binteratrial shunt\b|\batrial septal (?:defect|aneurysm)\b/i,
    noPfo: /\bno (?:evidence of )?(?:PFO|shunt|interatrial shunt|right[- ]to[- ]left shunt)\b|\bbubble study (?:was )?negative\b|\bnegative bubble\b/i,
    lvThrombus: /\bLV thrombus\b|\bleft ventricular thrombus\b|\bapical thrombus\b/i,
    af: /\batrial fibrillation\b|\bA\.?\s?fib\b|\bAF\b|\batrial flutter\b/,
    noAf: /\bno (?:atrial fibrillation|AF|arrhythmia)\b|\bsinus rhythm throughout\b/i,
    angioedema: /\bangioedema\b|\btongue swelling\b|\blip swelling\b|\borolingual\b/i,
    access: /\bgroin (?:hematoma|haematoma|bleed\w*|swelling)\b|\bpseudoaneurysm\b|\baccess[- ]site (?:hematoma|bleed\w*|complication)\b|\bretroperitoneal\b/i,
    worse: /\b(?:neuro(?:logical)?ly )?(?:worse|worsening|deteriorat\w*)\b|\bnew (?:weakness|deficit)\b/i,
    swallowPass: /\bswallow\w* screen\b[^.\n]{0,40}\b(?:pass\w*)\b|\bpassed\b[^.\n]{0,30}\bswallow/i,
    swallowFail: /\bswallow\w* screen\b[^.\n]{0,40}\b(?:fail\w*)\b|\bfailed\b[^.\n]{0,30}\bswallow|\bNPO\b/i,
    evt: /\bthrombectomy\b|\bEVT\b|\bendovascular (?:therapy|treatment)\b|\bTICI\s*[0-3]/i,
    tici: /\b(?:m?TICI|eTICI)\s*(0|1|2a|2b|2c|3)\b/i,
    onset: /\b(?:last (?:known|seen) well|LKW|onset)\b[^.\n]{0,20}?\b(\d{1,2})[:h]?(\d{2})\b/i,
    nihss: /\bNIHSS\b[^0-9\n]{0,15}(\d{1,2})\b/i,
    smoker: /\b(?:current )?smok(?:er|es|ing)\b|\bcigarettes?\b|\bpack[- ]years?\b/i,
    nonSmoker: /\bnon[- ]?smoker\b|\bnever smok\w*|\bdenies smoking\b|\bdoes not smoke\b/i,
    priorStroke: /\b(?:prior|previous|history of|old) (?:stroke|CVA|TIA|infarct)\b/i,
    cancer: /\bcancer\b|\bmalignan\w*|\bcarcinoma\b|\bmetasta\w*|\blymphoma\b/i,
    fever: /\bfebrile\b|\bfever\b|\btemp(?:erature)? (?:of )?3[89]\.\d/i
  };


  // BP targets for the first 48 h and after. Sources: CSBPR acute management 2022 (section 4.3: not lytic-eligible — do not routinely
  // treat up to 220 systolic; if >220/120 lower ~15%, not >25%, over 24 h; lytic — below 185/110 during and for the next 24 h) and CSBPR
  // Secondary Prevention 2020 (start/adjust antihypertensives after the acute phase and before discharge; long-term <140/90, lacunar
  // systolic <130, diabetes <130/80). AHA/ASA and ESO use ≤180/105 after lytic/EVT; the app keeps that line. Checked Nov 2026 against
  // strokebestpractices.ca; confirm against the current CSBPR and local order sets.
  const BP_TARGETS = {
    treated: [
      { fromH: 0, toH: 24, sbp: 180, dbp: 105, label: '0–24 h after lytic/EVT', target: '≤180/105',
        text: 'Keep BP ≤180/105 (CSBPR wording after thrombolysis: below 185/110 during and for 24 h). After successful EVT, follow neurology; do not push SBP below 140 (intensive lowering did worse in trials). Hold home antihypertensives unless directed.' },
      { fromH: 24, toH: 48, sbp: 180, dbp: 105, label: '24–48 h', target: '≤180/105, lower gradually',
        text: 'Still avoid >180/105 and avoid sudden drops. Once neurologically stable, swallowing safely (or by NG), and the 24 h scan shows no hemorrhage, restart home antihypertensives at low dose.' }
    ],
    untreated: [
      { fromH: 0, toH: 24, sbp: 220, dbp: 120, label: '0–24 h (no lytic/EVT)', target: 'Treat only if >220/120',
        text: 'Do not routinely treat up to 220 systolic. If SBP >220 or DBP >120, lower by about 15% (not more than 25%) over the first 24 h. Lower sooner if another condition needs it (aortic dissection, ACS, acute heart failure, hypertensive encephalopathy, pre-eclampsia).' },
      { fromH: 24, toH: 48, sbp: 220, dbp: 120, label: '24–48 h', target: 'Permissive; avoid >220/120',
        text: 'Still permissive. Gradual lowering toward the long-term target can begin once the patient is neurologically stable; avoid rapid drops.' }
    ],
    after: { fromH: 48, label: 'After 48 h', target: 'Start/adjust if ≥140/90',
      text: 'If neurologically stable and BP is consistently ≥140/90, start or adjust antihypertensives (CSBPR: after the acute phase, which it counts as 0–72 h, and before discharge). Lower gradually.' },
    longTerm: {
      general: { sbp: 140, dbp: 90, target: '<140/90', text: 'Long term: consistently <140/90 (CSBPR).' },
      lacunar: { sbp: 130, dbp: null, target: 'SBP <130', text: 'Long term (lacunar / small subcortical stroke): systolic consistently <130 (CSBPR).' },
      diabetes: { sbp: 130, dbp: 80, target: '<130/80', text: 'Long term (diabetes): <130/80 (CSBPR).' },
      note: 'AHA/ASA 2021 suggests <130/80 for most patients after stroke or TIA.'
    },
    hemorrhage: 'Hemorrhage or hemorrhagic transformation on imaging: BP target per neurology (often lower).'
  };

  // LDL. Source: CSBPR Secondary Prevention (lipid management): statin for non-cardioembolic ischemic stroke/TIA; target LDL <1.8 mmol/L;
  // ezetimibe if LDL >1.8 on maximal tolerated statin with atherosclerotic disease, then PCSK9 inhibitor; no statin started for ICH.
  // Treat Stroke to Target (TST, NEJM 2020): <1.8 vs 2.3–2.8 mmol/L reduced vascular events. Checked Nov 2026; confirm against current CSBPR/CCS.
  const LIPIDS = {
    target: 1.8,
    highIntensity: /\batorvastatin\b[^0-9]{0,15}\b(40|80)\b|\brosuvastatin\b[^0-9]{0,15}\b(20|40)\b/i,
    recheckWeeks: '4–12 weeks',
    start: 'Start a high-intensity statin (atorvastatin 40–80 mg or rosuvastatin 20–40 mg) unless contraindicated.',
    intensify: 'Increase to a high-intensity statin (atorvastatin 40–80 mg or rosuvastatin 20–40 mg).',
    addEze: 'Add ezetimibe 10 mg (LDL above target on maximal tolerated statin).',
    pcsk9: 'If still above target on statin + ezetimibe: PCSK9 inhibitor (evolocumab, alirocumab) — usually outpatient.',
    cardioembolic: 'AF / cardioembolic stroke without other atherosclerotic disease: CSBPR statin recommendation is for non-cardioembolic stroke; follow CCS lipid guidelines for the patient\'s overall risk.'
  };

  // PT / OT / SLP note summary. Notes are matched by title first, then by the start of the note text.
  // Each topic pulls sentences that mention it from the latest notes. Source for timing: CSBPR (rehabilitation
  // assessment by PT/OT/SLP as early as possible after admission).
  const REHAB = {
    disciplines: [
      { key: 'pt', label: 'Physiotherapy (PT)', title: /\bphysio\w*|\bphysical therap\w*|\bPT\b(?! ?INR)/i, lead: /\bphysiotherap\w*|\bphysical therap\w*|\bPT (?:assessment|note|initial|progress)\b/i,
        topics: ['mobility', 'balance', 'dc'] },
      { key: 'ot', label: 'Occupational therapy (OT)', title: /\boccupational therap\w*|\bOT\b/i, lead: /\boccupational therap\w*|\bOT (?:assessment|note|initial|progress)\b/i,
        topics: ['adl', 'cog', 'mobility', 'dc'] },
      { key: 'slp', label: 'Speech-language pathology (SLP)', title: /\bspeech\b|\bSLP\b|\blanguage path\w*|\bswallow\w*/i, lead: /\bspeech[- ]language\b|\bSLP\b|\bswallowing assessment\b|\bclinical swallow\w*/i,
        topics: ['swallow', 'comm', 'dc'] }
    ],
    topics: {
      mobility: { label: 'Mobility / transfers', re: /\b(?:independent\w*|supervision|stand-?by|contact guard|min(?:imal)? assist\w*|mod(?:erate)? assist\w*|max(?:imal)? assist\w*|(?:1|2|one|two)[- ]person|assist (?:x|of) ?\d|transfer\w*|ambulat\w*|gait|walk\w*|walker|cane|wheelchair|mechanical lift|hoyer|bed mobility|stairs?|sit to stand)\b/i },
      balance: { label: 'Balance / falls', re: /\b(?:fall\w*|balance|berg|TUG|timed up and go|unsteady)\b/i },
      adl: { label: 'ADLs / function', re: /\b(?:ADLs?|IADLs?|dressing|toileting|bathing|shower\w*|grooming|feeding|self[- ]care|meal prep\w*)\b/i },
      cog: { label: 'Cognition / perception', re: /\b(?:cognit\w*|MoCA|neglect|inattention|impulsiv\w*|insight|safety awareness|apraxi\w*|visual field|judg(?:e)?ment|orient\w*)\b/i },
      swallow: { label: 'Swallow / diet', re: /\b(?:NPO|nil by mouth|IDDSI|pur[eé]e?d?|minced|soft and bite[- ]sized|regular (?:diet|texture)|thin (?:fluids|liquids)|(?:mildly|moderately|extremely) thick\w*|nectar|honey[- ]thick|aspirat\w*|VFSS|FEES|modified barium|dysphagi\w*|NG tube|nasogastric|cough\w* (?:on|with)|wet voice|oral trials?)\b/i },
      comm: { label: 'Communication', re: /\b(?:aphasi\w*|dysarthri\w*|word[- ]finding|comprehension|expressive|receptive|communicat\w*|speech)\b/i },
      dc: { label: 'Recommendation / discharge', re: /\b(?:recommend\w*|discharge\w*|rehab\w*|GRU|home with|home support|home care|LTC|long[- ]term care|assisted living|equipment|follow[- ]up|plan)\b/i }
    },
    noneText: 'No note found. CSBPR: all stroke patients should be assessed by PT, OT and SLP as early as possible after admission.'
  };

  const api = { DRUGS, BRANDS, POST_TREATMENT, ELAN, DAPT, POSTERIOR, HINTS, PROGNOSIS, WORKUP, ESUS_TESTS, ROPE, ESUS_TREATMENT, TEXT, BP_TARGETS, LIPIDS, REHAB };
  root.StrokeCriteria = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof self !== 'undefined' ? self : this);
