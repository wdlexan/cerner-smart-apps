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

  const api = { DRUGS, BRANDS, POST_TREATMENT, ELAN, DAPT, POSTERIOR, HINTS, PROGNOSIS, WORKUP, ESUS_TESTS, ROPE, ESUS_TREATMENT, TEXT };
  root.StrokeCriteria = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof self !== 'undefined' ? self : this);
