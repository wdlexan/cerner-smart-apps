/* Dementia Workup – SMART on FHIR (Cerner)
 * Reads problems, labs, vitals, meds, notes and imaging reports; pre-fills a feature checklist
 * by keyword matching; scores fit against the main dementia subtypes; lists the workup and
 * treatment options for each type; drafts an assessment & plan.
 * Open index.html?demo=1 (or with no FHIR context) to run on a built-in made-up patient.
 */
"use strict";

/* ------------------------------------------------------------------ state */
const S = {
  mode: "fhir", patient: null, ageY: null, sex: null,
  conds: [], labs: [], vitals: [], meds: [], docs: [], imaging: [],
  feat: {},          // id -> {on:bool, src:"chart"|"user"|null, snip:string}
  inp: { moca: "", mocaLowEdu: false, mmse: "", minicog: "", rudas: "" },
  bio: { amyloid: "nd", dat: "nd", psg: "nd", rtquic: "nd", apoe: "nd", tap: "nd", emg: "nd", hdgene: "nd" },
  noteEdited: false
};
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/* ------------------------------------------------------------ feature list
 * where: notes | imaging | cond | manual.  re = regex used on that source. */
const FEATURES = [
  // Course & function
  { id: "acute", g: "Course & function", label: "Acute onset / fluctuating attention over hours–days (delirium?)", where: "notes", re: /\bdelirium\b|delirious|CAM (?:is )?(?:positive|\+|pos)|acute(?:ly)? confus|acute encephalopathy|hyperactive|hypoactive delir/i },
  { id: "gradual", g: "Course & function", label: "Insidious onset, gradual progression over months–years", where: "notes", re: /(?:gradual|slowly|insidious(?:ly)?|progressive(?:ly)?)\s+(?:worsening\s+|onset\s+|decline in\s+)?(?:of\s+)?(?:memory|cognitive|cognition|forgetful)|(?:memory|cognitive)\s+decline\s+over\s+(?:the\s+)?(?:past\s+|last\s+)?(?:\d+|several|few|many)\s+(?:years|yrs)/i },
  { id: "stepwise", g: "Course & function", label: "Stepwise decline linked to strokes", where: "notes", re: /step-?wise (?:decline|deteriorat|progress)/i },
  { id: "rapid", g: "Course & function", label: "Rapid progression (weeks–months; <1–2 yr to dementia)", where: "notes", re: /rapid(?:ly)?[- ]progressive|rapid (?:cognitive )?decline|declin\w+ over (?:the )?(?:past |last )?(?:few |several |\d+ )?weeks/i },
  { id: "iadl", g: "Course & function", label: "Decline interferes with independence (IADLs: finances, meds, cooking, driving) — dementia rather than MCI", where: "notes", re: /(?:needs?|requires?|requiring) (?:help|assistance|support) with (?:his |her |their )?(?:finances|bills|medications|meds|banking|cooking|shopping)|(?:family|wife|husband|daughter|son) (?:now )?(?:manages|does|handles) (?:his |her |their |the )?(?:finances|bills|medications|meds)|blister pack|no longer (?:able to )?(?:drive|driving|cook|manage)|stopped driving|dependent for (?:i?adls|iadl)/i },
  { id: "early", g: "Course & function", label: "Symptom onset before age 65 (young-onset)", where: "manual" },
  // Cognitive domains
  { id: "amnestic", g: "Cognitive profile", label: "Memory-led (repeats questions, misplaces items, forgets recent events)", where: "notes", re: /memory (?:loss|impair|decline|problems|difficult|concerns)|short[- ]term memory|forgetful|repeat(?:s|ing) (?:the same )?(?:questions|stories|himself|herself|themselves)|misplac/i },
  { id: "executive", g: "Cognitive profile", label: "Executive dysfunction (planning, multitasking, judgement)", where: "notes", re: /executive (?:dys)?function|poor (?:planning|judg(?:e)?ment|insight)|difficulty (?:planning|organizing|multitask)/i },
  { id: "speed", g: "Cognitive profile", label: "Slowed processing / psychomotor slowing", where: "notes", re: /slow(?:ed)? (?:processing|thinking|mentation)|psychomotor (?:slowing|retardation)|bradyphrenia/i },
  { id: "visuo", g: "Cognitive profile", label: "Visuospatial / visuoperceptual problems (getting lost, misjudging)", where: "notes", re: /getting lost|got lost|visuospatial|visuoperceptual|dressing apraxia|misjudg|posterior cortical atrophy/i },
  { id: "language", g: "Cognitive profile", label: "Language is the earliest and main problem", where: "notes", re: /word[- ]finding|aphasi|anomi|agrammat|apraxia of speech|primary progressive aphasia/i },
  { id: "confab", g: "Cognitive profile", label: "Confabulation", where: "notes", re: /confabulat/i },
  // Lewy body
  { id: "fluct", g: "Lewy body features", label: "Fluctuating cognition / alertness (day-to-day, staring spells) — outside delirium", where: "notes", re: /fluctuat\w* (?:in )?(?:cognition|alertness|attention|level of (?:alertness|consciousness)|confusion|mental status)|good days and bad days|staring spells|daytime drowsiness/i },
  { id: "vh", g: "Lewy body features", label: "Recurrent well-formed visual hallucinations", where: "notes", re: /visual hallucinat|seeing (?:people|children|animals|things|small)|sees (?:people|children|animals|things|small)|(?:people|children|animals) (?:in|at) the (?:house|room|garden|yard) (?:that|who) (?:are|were)n'?t there/i },
  { id: "rbd", g: "Lewy body features", label: "REM sleep behaviour disorder (acts out dreams; may precede by years)", where: "notes", re: /REM sleep behavio(?:u)?r|\bRBD\b|act(?:s|ing)? out (?:his |her |their )?dreams|dream enactment|punch\w* (?:in his|in her) sleep/i },
  { id: "parkinsonism", g: "Lewy body features", label: "Parkinsonism (bradykinesia + rest tremor or rigidity)", where: "notes", re: /parkinsonism|bradykinesia|cogwheel|lead[- ]pipe|rigidity|shuffling gait|resting tremor|rest tremor|hypomimia|masked fac/i },
  { id: "neurolep", g: "Lewy body features", label: "Severe sensitivity to antipsychotics", where: "notes", re: /neuroleptic sensitivity|(?:worse|rigid|severe reaction) after (?:haloperidol|antipsychotic)/i },
  { id: "autonomic", g: "Lewy body features", label: "Supportive: orthostatic hypotension, falls, syncope, hypersomnia, anosmia", where: "notes", re: /orthostatic hypotension|orthostatic drop|anosmia|hyposmia|unexplained (?:falls|syncope)/i },
  { id: "pdfirst", g: "Lewy body features", label: "Parkinson disease motor symptoms began ≥1 year before cognitive decline", where: "both", re: /parkinson(?:'s)? disease|\bparkinsons\b|\bPD\b/i },
  // FTD
  { id: "disinhib", g: "Frontotemporal features (bvFTD)", label: "Early disinhibition (socially inappropriate, impulsive, loss of manners)", where: "notes", re: /disinhibit|socially inappropriate|inappropriate (?:sexual )?(?:behaviou?r|comments)|impulsiv/i },
  { id: "apathy", g: "Frontotemporal features (bvFTD)", label: "Early apathy or inertia", where: "notes", re: /apath|abulia|inertia|loss of (?:interest|motivation|initiative)/i },
  { id: "empathy", g: "Frontotemporal features (bvFTD)", label: "Early loss of sympathy or empathy", where: "notes", re: /(?:loss|lack) of (?:empathy|sympathy)|emotionally (?:cold|blunted|detached)/i },
  { id: "compulsive", g: "Frontotemporal features (bvFTD)", label: "Perseverative, stereotyped or compulsive/ritualistic behaviour", where: "notes", re: /compulsive|perseverat|hoarding|ritualistic|stereotyp/i },
  { id: "hyperoral", g: "Frontotemporal features (bvFTD)", label: "Hyperorality / dietary change (sweet craving, binge eating)", where: "notes", re: /hyperoral|binge eating|sweet (?:craving|tooth)|craving sweets|change in (?:food|dietary) preference|eats inedible/i },
  { id: "execspared", g: "Frontotemporal features (bvFTD)", label: "Executive deficits with relative sparing of memory and visuospatial function", where: "manual" },
  { id: "svppa", g: "Primary progressive aphasia", label: "Semantic: impaired naming AND single-word comprehension", where: "notes", re: /semantic (?:variant|dementia)|svPPA|loss of word meaning/i },
  { id: "nfvppa", g: "Primary progressive aphasia", label: "Non-fluent: agrammatism and/or effortful speech, apraxia of speech", where: "notes", re: /non-?fluent|agrammat|apraxia of speech|effortful speech|nfvPPA/i },
  { id: "lvppa", g: "Primary progressive aphasia", label: "Logopenic: word-retrieval pauses AND impaired sentence repetition", where: "notes", re: /logopenic|lvPPA|impaired (?:sentence )?repetition/i },
  { id: "mnd", g: "Primary progressive aphasia", label: "Motor neuron disease signs (fasciculations, weakness) — FTD-ALS", where: "notes", re: /motor neuron disease|amyotrophic|\bALS\b|fasciculation/i },
  // Vascular
  { id: "strokehx", g: "Vascular features", label: "Clinical stroke/TIA, with cognitive change after it", where: "both", re: /stroke|cerebrovascular accident|\bCVA\b|cerebral infarct|\bTIA\b|transient ischemic|lacunar/i },
  { id: "focal", g: "Vascular features", label: "Focal neurological signs (hemiparesis, Babinski, pronator drift, dysarthria)", where: "notes", re: /hemiparesis|focal (?:neurolog\w* )?deficit|pronator drift|babinski|upgoing (?:toe|plantar)|dysarthri/i },
  { id: "vrf", g: "Vascular features", label: "Vascular risk factors (HTN, diabetes, AF, dyslipidemia, smoking)", where: "both", re: /hypertension|\bHTN\b|diabetes|atrial fibrillation|\bA-?fib\b|hyperlipid|dyslipid|hypercholesterol|tobacco|smok/i },
  // NPH
  { id: "gaitnph", g: "Normal pressure hydrocephalus", label: "Gait disorder early: magnetic, short-stepped, wide-based, en-bloc turns", where: "notes", re: /magnetic gait|gait apraxia|apraxic gait|wide[- ]based gait|broad[- ]based gait|en bloc turn|feet (?:stuck|glued)/i },
  { id: "urinary", g: "Normal pressure hydrocephalus", label: "Urinary urgency / incontinence", where: "notes", re: /urinary (?:urgency|incontinence)|incontinent of urine|urge incontinence/i },
  // Rapid / other
  { id: "myoclonus", g: "Rapid / other causes", label: "Myoclonus, ataxia, cortical blindness (CJD / autoimmune)", where: "notes", re: /myoclon|startle myoclonus|cerebellar ataxia|cortical blindness/i },
  { id: "alcohol", g: "Rapid / other causes", label: "Heavy alcohol use (Wernicke–Korsakoff / alcohol-related)", where: "both", re: /alcohol use disorder|alcohol dependence|alcoholism|alcohol abuse|etoh (?:abuse|use disorder|dependence)|heavy (?:alcohol|etoh|drinking)|(?:\d+|several) (?:drinks|beers) (?:a|per) day|wernicke|korsakoff/i },
  { id: "depression", g: "Rapid / other causes", label: "Depression (can mimic or coexist)", where: "both", re: /major depress|depressive disorder|\bMDD\b|depression/i },
  { id: "osa", g: "Rapid / other causes", label: "Sleep apnea / poor sleep", where: "both", re: /sleep apn|\bOSA\b/i },
  { id: "sensory", g: "Rapid / other causes", label: "Hearing or vision loss", where: "both", re: /hearing loss|hard of hearing|\bHOH\b|hearing aid|deaf|macular degeneration|cataract|legally blind|visual impairment/i },
  // Atypical parkinsonism (PSP, CBS, MSA)
  { id: "falls1y", g: "Atypical parkinsonism (PSP / CBS / MSA)", label: "PSP: falls in the first years, typically backwards; postural instability", where: "notes", re: /falls? backwards|falling backwards|backward falls|retropulsion|postural instability/i },
  { id: "vgaze", g: "Atypical parkinsonism (PSP / CBS / MSA)", label: "PSP: vertical supranuclear gaze palsy or slow vertical saccades (downgaze first)", where: "notes", re: /vertical (?:supranuclear )?gaze palsy|supranuclear gaze|(?:down|up)-?gaze (?:palsy|limitation|restriction)|limited (?:down|up)-?gaze|slow vertical saccades/i },
  { id: "axial", g: "Atypical parkinsonism (PSP / CBS / MSA)", label: "PSP: axial > limb rigidity, surprised stare, reduced blink, applause sign", where: "notes", re: /axial rigidity|nuchal rigidity|applause sign|surprised (?:stare|look|expression)|astonished|reduced blink/i },
  { id: "asym", g: "Atypical parkinsonism (PSP / CBS / MSA)", label: "CBS: asymmetric limb rigidity, dystonia or focal myoclonus", where: "notes", re: /asymmetric (?:rigidity|parkinsonism|limb)|limb dystonia|(?:arm|hand) dystonia|dystonia of the (?:left|right)|\bfocal (?:limb )?myoclonus/i },
  { id: "apraxia", g: "Atypical parkinsonism (PSP / CBS / MSA)", label: "CBS: limb apraxia, alien limb, cortical sensory loss (astereognosis, agraphesthesia)", where: "notes", re: /limb apraxia|ideomotor apraxia|alien (?:limb|hand)|cortical sensory (?:loss|deficit)|astereognosis|agraphesthesia/i },
  { id: "autfail", g: "Atypical parkinsonism (PSP / CBS / MSA)", label: "MSA: early autonomic failure (orthostatic hypotension, urinary retention/incontinence, erectile dysfunction)", where: "both", re: /orthostatic hypotension|neurogenic orthostatic|urinary retention|neurogenic bladder|erectile dysfunction|intermittent catheteri/i },
  { id: "cereb", g: "Atypical parkinsonism (PSP / CBS / MSA)", label: "MSA-C: cerebellar signs (ataxic gait, dysmetria, scanning speech, nystagmus)", where: "notes", re: /cerebellar ataxia|ataxic gait|limb ataxia|dysmetria|intention tremor|scanning speech|nystagmus/i },
  { id: "poorldopa", g: "Atypical parkinsonism (PSP / CBS / MSA)", label: "Poor or no response to levodopa (≥600–1000 mg/day)", where: "notes", re: /levodopa[- ]unresponsive|(?:poor|no|minimal|little) (?:response|benefit) (?:from|to) (?:levodopa|sinemet|carbidopa)|not (?:responsive|responding) to (?:levodopa|sinemet)/i },
  { id: "stridor", g: "Atypical parkinsonism (PSP / CBS / MSA)", label: "MSA: stridor, inspiratory sighs, antecollis or Pisa syndrome", where: "notes", re: /stridor|inspiratory sighs|antecollis|pisa syndrome/i },
  // Huntington disease
  { id: "chorea", g: "Huntington disease", label: "Chorea (involuntary flowing movements), motor impersistence (milkmaid grip)", where: "notes", re: /chorea|choreiform|choreoathet|motor impersistence|milkmaid/i },
  { id: "hdfam", g: "Huntington disease", label: "Huntington disease in a parent/family, or known CAG expansion", where: "both", re: /huntington|CAG repeat|CAG expansion/i },
  { id: "psych", g: "Huntington disease", label: "Early psychiatric change (irritability, obsessive behaviour, psychosis, personality change)", where: "notes", re: /irritab|obsessive|\bOCD\b|psychosis|psychotic|personality change/i },
  // ALS
  { id: "bulbar", g: "Motor neuron disease (ALS)", label: "Bulbar: dysarthria/dysphagia with tongue wasting or fasciculation", where: "notes", re: /tongue (?:fasciculation|atrophy|wasting)|bulbar (?:weakness|palsy|symptoms|onset)|fasciculations in (?:both arms and )?the tongue/i },
  { id: "umnlmn", g: "Motor neuron disease (ALS)", label: "Upper and lower motor neuron signs together (wasting + brisk reflexes, split hand)", where: "notes", re: /upper and lower motor neuron|UMN and LMN|split hand|wasting with (?:brisk|hyperactive)|hyperreflexia with (?:wasting|fasciculations)/i },
  // Imaging (from CT/MRI reports)
  { id: "imgdone", g: "Imaging findings", label: "CT or MRI head on file", where: "imgany" },
  { id: "mta", g: "Imaging findings", label: "Medial temporal / hippocampal atrophy (AD pattern)", where: "imaging", re: /(?:mesial|medial) temporal (?:lobe )?atrophy|hippocamp\w* (?:volume loss|atrophy)|MTA score [2-4]/i },
  { id: "parietal", g: "Imaging findings", label: "Parietal / precuneus / posterior atrophy", where: "imaging", re: /parietal (?:lobe )?(?:atrophy|volume loss)|precuneus|posterior cortical atrophy/i },
  { id: "ftatrophy", g: "Imaging findings", label: "Frontal and/or anterior temporal atrophy (FTD pattern)", where: "imaging", re: /frontal (?:lobe |predominant )?(?:atrophy|volume loss)|frontotemporal (?:atrophy|volume loss)|anterior temporal (?:lobe )?atrophy|knife[- ]edge/i },
  { id: "svd", g: "Imaging findings", label: "Small-vessel disease / white-matter change", where: "imaging", re: /white matter (?:hypo|hyper)?(?:intens|dens|change|disease|lesion)|periventricular (?:white matter )?(?:hypo|hyper|change)|small[- ]vessel (?:ischemic )?(?:disease|change)|microangiopath|leuko-?araiosis|fazekas (?:grade |score )?[1-3]/i },
  { id: "infarct", g: "Imaging findings", label: "Infarcts (cortical, strategic, or lacunes)", where: "imaging", re: /(?:chronic|old|remote|prior)\s+(?:\w+\s+){0,3}infarct|lacunar infarct|lacune|encephalomalacia/i },
  { id: "vent", g: "Imaging findings", label: "Ventriculomegaly out of proportion to atrophy (Evans index >0.3)", where: "imaging", re: /ventriculomegaly|hydrocephalus|disproportionate(?:ly)? (?:enlarged )?ventric|evans index|DESH/i },
  { id: "cjdmri", g: "Imaging findings", label: "DWI cortical ribboning or caudate/putamen restricted diffusion (CJD)", where: "imaging", re: /cortical ribbon|ribboning|restricted diffusion (?:in|of|involving) the (?:caudate|putamen|basal ganglia|cortex)|pulvinar sign/i },
  { id: "bleeds", g: "Imaging findings", label: "Microbleeds or superficial siderosis (amyloid angiopathy — anti-amyloid caution)", where: "imaging", re: /microbleed|micro-?hemorrhag|micro-?haemorrhag|superficial siderosis|cerebral amyloid angiopathy/i },
  { id: "pspmri", g: "Imaging findings", label: "Midbrain atrophy — hummingbird / morning glory sign (PSP)", where: "imaging", re: /hummingbird|morning glory|mickey mouse|midbrain atrophy|midbrain[- ]to[- ]pons/i },
  { id: "cbsmri", g: "Imaging findings", label: "Asymmetric frontoparietal / perirolandic atrophy (CBS)", where: "imaging", re: /asymmetric (?:\w+ ){0,2}(?:frontoparietal|perirolandic|parietal)|(?:frontoparietal|perirolandic) (?:\(\w+\) )?atrophy/i },
  { id: "msamri", g: "Imaging findings", label: "Hot cross bun sign, putaminal rim, pontine / middle cerebellar peduncle atrophy (MSA)", where: "imaging", re: /hot cross bun|putaminal rim|(?:pontine|middle cerebellar peduncle) (?:atrophy|hyperintens)|olivopontocerebellar/i },
  { id: "caudate", g: "Imaging findings", label: "Caudate atrophy, boxcar frontal horns (Huntington)", where: "imaging", re: /caudate (?:head )?(?:atrophy|volume loss)|boxcar|loss of (?:the )?caudate/i },
  { id: "structural", g: "Imaging findings", label: "Treatable structural lesion (subdural, tumour, abscess)", where: "imaging", re: /subdural (?:hematoma|haematoma|collection|hygroma)|\bmass\b|neoplasm|metasta|meningioma|glioma|abscess/i }
];

/* ------------------------------------------------------------------- labs */
const LABS = [
  { id: "b12", label: "Vitamin B12", loinc: ["2132-9", "14685-3"], re: /\b(?:vitamin )?b-?12\b|cobalamin/i, core: true },
  { id: "tsh", label: "TSH", loinc: ["3016-3", "11580-8"], re: /\bTSH\b|thyroid stimulating/i, core: true },
  { id: "ca", label: "Calcium", loinc: ["17861-6", "49765-1", "2000-8"], re: /^calcium(?! ionized)|calcium,? (?:total|serum)/i, core: true },
  { id: "glu", label: "Glucose", loinc: ["2345-7", "2339-0", "41653-7"], re: /^glucose/i, core: true },
  { id: "na", label: "Sodium", loinc: ["2951-2", "2947-0"], re: /^sodium/i, core: true },
  { id: "hgb", label: "Hemoglobin (CBC)", loinc: ["718-7"], re: /^h(?:a)?emoglobin$|^hgb$/i, core: true },
  { id: "mcv", label: "MCV", loinc: ["787-2"], re: /\bMCV\b|mean corpuscular volume/i },
  { id: "cr", label: "Creatinine", loinc: ["2160-0", "38483-4"], re: /^creatinine/i },
  { id: "egfr", label: "eGFR", loinc: ["33914-3", "62238-1", "98979-8", "48642-3", "48643-1", "88293-6"], re: /\beGFR\b|glomerular filtration/i },
  { id: "alb", label: "Albumin", loinc: ["1751-7"], re: /^albumin/i },
  { id: "alt", label: "ALT", loinc: ["1742-6", "1743-4"], re: /\bALT\b|alanine aminotransferase/i },
  { id: "folate", label: "Folate", loinc: ["2284-8", "2282-2"], re: /folate|folic/i },
  { id: "a1c", label: "HbA1c", loinc: ["4548-4", "17856-6"], re: /a1c|glycated h/i },
  { id: "ldl", label: "LDL cholesterol", loinc: ["13457-7", "2089-1", "18262-6"], re: /\bLDL\b/i },
  { id: "rpr", label: "Syphilis serology", loinc: ["20507-0", "47236-4", "24110-9", "5292-8"], re: /syphilis|treponema|\bRPR\b|\bVDRL\b/i },
  { id: "hiv", label: "HIV screen", loinc: ["75622-1", "56888-1", "7917-8"], re: /\bHIV\b/i },
  { id: "nh3", label: "Ammonia", loinc: ["16362-6", "1988-5"], re: /ammonia/i },
  { id: "ptau", label: "Plasma p-tau217 / Aβ42/40", loinc: ["106954-2", "99779-1"], re: /p-?tau ?217|amyloid.*42\/40|ab ?42\/40/i }
];
const VITALS = [
  { id: "hr", loinc: ["8867-4"], re: /heart rate|pulse/i },
  { id: "wt", loinc: ["29463-7", "3141-9"], re: /^weight|body weight/i },
  { id: "sbp", loinc: ["8480-6"], re: /systolic/i }
];

/* ------------------------------------------------------- medication flags */
const MEDFLAGS = [
  { cls: "Strong anticholinergic", why: "Worsens cognition; deprescribe before diagnosing/treating (Beers, CCCDTD)", re: /diphenhydramine|dimenhydrinate|hydroxyzine|chlorpheniramine|promethazine|meclizine|oxybutynin|tolterodine|solifenacin|darifenacin|trospium|fesoterodine|amitriptyline|nortriptyline|imipramine|desipramine|clomipramine|doxepin|paroxetine|benztropine|trihexyphenidyl|scopolamine|hyoscine|cyclobenzaprine|orphenadrine|olanzapine|clozapine/i },
  { cls: "Benzodiazepine / Z-drug", why: "Impairs memory and attention, falls; taper if possible", re: /lorazepam|clonazepam|diazepam|alprazolam|oxazepam|temazepam|chlordiazepoxide|midazolam|zopiclone|zolpidem|eszopiclone/i },
  { cls: "Opioid", why: "Sedation and confusion; review dose", re: /morphine|hydromorphone|oxycodone|codeine|tramadol|fentanyl|methadone|tapentadol/i },
  { cls: "Antipsychotic", why: "Mortality/stroke warning in dementia; AVOID typical agents in Lewy body / PDD", re: /haloperidol|loxapine|risperidone|quetiapine|olanzapine|aripiprazole|brexpiprazole|methotrimeprazine|chlorpromazine|perphenazine|zuclopenthixol/i },
  { cls: "Dopamine agonist / amantadine", why: "Common cause of hallucinations and confusion; reduce or stop before adding an antipsychotic (keep levodopa)", re: /pramipexole|ropinirole|rotigotine|amantadine|bromocriptine|selegiline|rasagiline|safinamide/i },
  { cls: "Other CNS-active", why: "Can add to confusion", re: /tetrabenazine|deutetrabenazine|gabapentin|pregabalin|baclofen|levetiracetam|phenytoin|carbamazepine|lithium|tizanidine|prednisone|dexamethasone|digoxin|metoclopramide/i },
  { cls: "Already on dementia drug", why: "Check dose, adherence and side effects", re: /donepezil|rivastigmine|galantamine|memantine|lecanemab|donanemab/i },
  { cls: "Rate-slowing (ChEI caution)", why: "Additive bradycardia with cholinesterase inhibitors", re: /metoprolol|bisoprolol|atenolol|carvedilol|propranolol|nadolol|sotalol|labetalol|verapamil|diltiazem|digoxin|amiodarone|ivabradine/i },
  { cls: "Alpha-blocker", why: "Worsens orthostatic hypotension and falls (MSA, Lewy body, Parkinson disease)", re: /tamsulosin|alfuzosin|doxazosin|terazosin|prazosin|silodosin/i },
  { cls: "Anticoagulant / antiplatelet", why: "Relative contraindication for anti-amyloid antibodies (bleeding with ARIA)", re: /apixaban|rivaroxaban|edoxaban|dabigatran|warfarin|heparin|enoxaparin|dalteparin|tinzaparin|clopidogrel|ticagrelor|prasugrel/i }
];

/* --------------------------------------------------------------- helpers */
function codeText(cc) {
  if (!cc) return "";
  return cc.text || (cc.coding || []).map(c => c.display).filter(Boolean).join(" / ") || "";
}
function codes(cc) { return (cc?.coding || []).map(c => c.code); }
function obsDate(o) { return o.effectiveDateTime || o.effectivePeriod?.start || o.issued || ""; }
function fmtDate(d) { return d ? String(d).slice(0, 10) : ""; }
function daysAgo(d) { return d ? Math.round((Date.now() - new Date(d)) / 864e5) : null; }

const NEG = /\b(?:no|not|denies|denied|without|negative for|absence of|absent|ruled out|r\/o|nor|free of|unremarkable for)\b[^.;:\n]{0,40}$/i;
function findMatch(text, re) {
  if (!text || !re) return null;
  text = String(text).replace(/\s+/g, " "); // wrapped lines in notes/PDFs split phrases
  const g = new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g");
  let m;
  while ((m = g.exec(text))) {
    const before = text.slice(Math.max(0, m.index - 45), m.index);
    if (!NEG.test(before)) {
      const a = Math.max(0, m.index - 60), b = Math.min(text.length, m.index + m[0].length + 60);
      return (a > 0 ? "…" : "") + text.slice(a, b).replace(/\s+/g, " ").trim() + (b < text.length ? "…" : "");
    }
    if (m[0].length === 0) g.lastIndex++;
  }
  return null;
}
function htmlToText(s) {
  if (!/<[a-z!/]/i.test(s)) return s;
  const d = document.createElement("div");
  d.innerHTML = s.replace(/<(script|style)[\s\S]*?<\/\1>/gi, "").replace(/<br\s*\/?>/gi, "\n").replace(/<\/(p|div|li|tr|h\d)>/gi, "\n");
  return d.textContent || "";
}

/* ---------------------------------------------------------- FHIR loading */
async function loadFHIR() {
  const client = await FHIR.oauth2.ready();
  S.client = client;
  const pid = client.patient.id;
  const rq = (u, pages = 3) => client.request(u, { pageLimit: pages, flat: true }).catch(e => { console.warn(u, e); return []; });
  const [pt, conds, labs, vit, meds, docs, reps] = await Promise.all([
    client.patient.read(),
    rq(`Condition?patient=${pid}&_count=100`),
    rq(`Observation?patient=${pid}&category=laboratory&_count=100`, 6),
    rq(`Observation?patient=${pid}&category=vital-signs&_count=100`, 2),
    rq(`MedicationRequest?patient=${pid}&status=active&_count=100`),
    rq(`DocumentReference?patient=${pid}&_count=50`, 2),
    rq(`DiagnosticReport?patient=${pid}&_count=50`, 2)
  ]);
  S.patient = pt;
  S.conds = conds.filter(c => c.resourceType === "Condition").map(c => ({
    text: codeText(c.code), status: c.clinicalStatus?.coding?.[0]?.code || c.clinicalStatus?.text || "", onset: c.onsetDateTime || c.recordedDate || ""
  }));
  S.labs = labs.filter(o => o.resourceType === "Observation").map(normObs);
  S.vitals = vit.filter(o => o.resourceType === "Observation").flatMap(o => {
    const base = normObs(o);
    const comps = (o.component || []).map(c => ({ ...base, name: codeText(c.code), loinc: codes(c.code), value: c.valueQuantity?.value, unit: c.valueQuantity?.unit }));
    return [base, ...comps];
  });
  S.meds = meds.filter(m => m.resourceType === "MedicationRequest").map(m => ({
    name: codeText(m.medicationCodeableConcept) || m.medicationReference?.display || "Medication",
    sig: (m.dosageInstruction || []).map(d => d.text).filter(Boolean).join("; ")
  }));

  // Notes: newest 25 with readable attachments
  const docList = docs.filter(d => d.resourceType === "DocumentReference")
    .sort((a, b) => (b.date || "").localeCompare(a.date || "")).slice(0, 25);
  S.docs = (await Promise.all(docList.map(async d => ({
    date: d.date || d.context?.period?.start || "", title: codeText(d.type) || d.description || "Note",
    text: await readAttachment(client, (d.content || []).map(c => c.attachment))
  })))).filter(d => d.text);

  // Imaging reports: DiagnosticReports that look like radiology
  const imgReps = reps.filter(r => r.resourceType === "DiagnosticReport").filter(r => {
    const cat = (r.category || []).map(codeText).join(" ") + " " + (r.category || []).flatMap(codes).join(" ");
    return /rad|imag|LP29684-5|\bRAD\b/i.test(cat) || /\bCT\b|\bMRI?\b|\bMR\b|tomograph|magnetic|head|brain|SPECT|PET/i.test(codeText(r.code));
  }).sort((a, b) => (b.effectiveDateTime || b.issued || "").localeCompare(a.effectiveDateTime || a.issued || "")).slice(0, 15);
  S.imaging = (await Promise.all(imgReps.map(async r => ({
    date: r.effectiveDateTime || r.issued || "", title: codeText(r.code) || "Imaging",
    text: (r.conclusion || "") + "\n" + (await readAttachment(client, r.presentedForm || []))
  })))).filter(r => r.text.trim());
  // Imaging reports filed as notes
  S.docs.filter(d => /radiol|imaging|\bCT\b|\bMRI?\b|diagnostic imag/i.test(d.title)).forEach(d => S.imaging.push(d));
}
function normObs(o) {
  return {
    name: codeText(o.code), loinc: codes(o.code), date: obsDate(o),
    value: o.valueQuantity?.value ?? (o.valueString ?? codeText(o.valueCodeableConcept)),
    unit: o.valueQuantity?.unit || "", interp: codeText(o.interpretation?.[0]) || o.interpretation?.[0]?.coding?.[0]?.code || "",
    low: o.referenceRange?.[0]?.low?.value, high: o.referenceRange?.[0]?.high?.value
  };
}
async function readAttachment(client, atts) {
  atts = (atts || []).filter(Boolean);
  const pref = ["text/plain", "text/html", "application/xhtml+xml", "text/rtf", "application/xml"];
  atts.sort((a, b) => (pref.indexOf(a.contentType) + 99) % 99 - (pref.indexOf(b.contentType) + 99) % 99);
  for (const a of atts) {
    try {
      if (a.data) return htmlToText(decodeURIComponent(escape(atob(a.data))));
      if (a.url && /text|html|xml/i.test(a.contentType || "text")) {
        const r = await client.request({ url: a.url, headers: { Accept: a.contentType || "text/plain" } });
        const txt = typeof r === "string" ? r : (r?.data ? decodeURIComponent(escape(atob(r.data))) : "");
        if (txt) return htmlToText(txt).slice(0, 60000);
      }
    } catch (e) { console.warn("attachment", e); }
  }
  return "";
}

/* ---------------------------------------------------------- demo patient */
function loadDemo(n) {
  S.mode = "demo";
  const all = window.DEMENTIA_DEMOS || [];
  const i = Math.min(Math.max(1, n || 1), all.length) - 1, P = all[i];
  S.demoIndex = i + 1; S.demo = P;
  const d = n => new Date(Date.now() - n * 864e5).toISOString();
  S.patient = { name: [{ text: P.name + " (made-up patient)" }], gender: P.sex, birthDate: P.birthDate };
  S.conds = P.conds.map(t => ({ text: t, status: "active" }));
  S.labs = P.labs.map(([name, l, value, unit, low, high]) => ({ name, loinc: [l], value, unit, low, high, date: d(1) }));
  S.vitals = [{ name: "Heart Rate", loinc: ["8867-4"], value: P.hr, unit: "bpm", date: d(0) }, { name: "Weight", loinc: ["29463-7"], value: P.wt, unit: "kg", date: d(1) }];
  S.meds = P.meds.map(m => ({ name: m }));
  S.docs = P.docs.map(x => ({ date: d(x.d), title: x.title, text: x.text }));
  S.imaging = P.imaging.map(x => ({ date: d(x.d), title: x.title, text: x.text }));
  Object.assign(S.bio, P.bio || {});
}
function demoPicker() {
  const all = window.DEMENTIA_DEMOS || [];
  return `<div class="banner info"><b>Made-up test patient ${S.demoIndex} of ${all.length}.</b>
    <select id="demoPick">${all.map((p, i) => `<option value="${i + 1}" ${i + 1 === S.demoIndex ? "selected" : ""}>${i + 1}. ${esc(p.name)} – ${esc(p.key.toUpperCase())}</option>`).join("")}</select>
    <div class="small" style="margin-top:4px"><b>Expected:</b> ${esc(S.demo.expect)}</div>
    <div class="small muted">Launch from Cerner (launch.html) for live data.</div></div>`;
}

/* --------------------------------------------------------- chart parsing */
function imagingInNotes() {
  // Imaging reports pasted inside notes or imported PDFs: take the text from each CT/MRI heading to the next blank-line heading.
  const HEAD = /^\s*(?:CT|MRI?|MR|COMPUTED TOMOGRAPHY|MAGNETIC RESONANCE)\b[^\n]*(?:HEAD|BRAIN|CRANI)[^\n]*$/gim;
  const out = [];
  for (const n of S.docs) {
    if (S.imaging.includes(n)) continue;
    let m; HEAD.lastIndex = 0;
    while ((m = HEAD.exec(n.text))) {
      const rest = n.text.slice(m.index + m[0].length);
      const stop = rest.search(/\n\s*\n\s*[A-Z][A-Z /()-]{6,}\n|MADE-UP TEST PATIENT/);
      const body = rest.slice(0, stop > 0 ? stop : 3000);
      if (!S.imaging.some(i => i.text.includes(body.trim().slice(0, 60)))) out.push({ date: n.date, title: m[0].trim(), text: body, fromNote: true });
    }
  }
  S.imaging.push(...out);
}
function preFill() {
  imagingInNotes();
  const notes = S.docs.filter(d => !S.imaging.includes(d));
  const condText = S.conds.filter(c => !/resolved|inactive|refuted|entered/i.test(c.status)).map(c => c.text).join("\n");
  for (const f of FEATURES) {
    let snip = null, src = null;
    if (f.where === "notes" || f.where === "both") for (const n of notes) { snip = findMatch(n.text, f.re); if (snip) { src = `${n.title} ${fmtDate(n.date)}`; break; } }
    if (!snip && (f.where === "cond" || f.where === "both")) { snip = findMatch(condText, f.re); if (snip) src = "Problem list"; }
    if (!snip && f.where === "imaging") for (const im of S.imaging) { snip = findMatch(im.text, f.re); if (snip) { src = `${im.title} ${fmtDate(im.date)}`; break; } }
    if (f.where === "imgany" && S.imaging.length) { snip = S.imaging.map(i => `${i.title} ${fmtDate(i.date)}`).join("; "); src = "Imaging"; }
    if (f.id === "pdfirst" && snip) snip += " — confirm motor symptoms preceded cognitive change by ≥1 year";
    S.feat[f.id] = { on: !!snip, src: snip ? "chart" : null, snip: snip ? `${src}: ${snip}` : "" };
  }
  (S.demo?.preset || []).forEach(id => { S.feat[id] = { on: true, src: "user", snip: "Preset for this test patient (bedside item)" }; });
  // Cognitive scores in notes
  const all = notes.map(n => n.text).join("\n");
  const moca = all.match(/MoCA[^0-9\n]{0,20}(\d{1,2})\s*(?:\/|out of)\s*30/i);
  if (moca) S.inp.moca = moca[1];
  const mmse = all.match(/MMSE[^0-9\n]{0,20}(\d{1,2})\s*(?:\/|out of)\s*30/i);
  if (mmse) S.inp.mmse = mmse[1];
  const mc = all.match(/mini-?cog[^0-9\n]{0,20}([0-5])\s*(?:\/|out of)\s*5/i);
  if (mc) S.inp.minicog = mc[1];
  if (S.patient?.birthDate) S.ageY = Math.floor((Date.now() - new Date(S.patient.birthDate)) / 31557600000);
  S.sex = S.patient?.gender || null;
}

function latest(list, def) {
  const hits = list.filter(o => o.loinc?.some(c => def.loinc.includes(c)) || def.re.test(o.name || ""))
    .filter(o => o.value !== undefined && o.value !== null && o.value !== "");
  hits.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  return hits[0] || null;
}
const L = id => latest(S.labs, LABS.find(x => x.id === id));
const V = id => latest(S.vitals, VITALS.find(x => x.id === id));

function labFlag(id, o) {
  if (!o) return { cls: "grey", txt: "Not found" };
  const v = Number(o.value), u = (o.unit || "").toLowerCase();
  if (/^(h|hh|l|ll|a|aa|high|low|abnormal|critical)/i.test(o.interp)) return { cls: "warn", txt: "Abnormal (flagged)" };
  if (!isNaN(v)) {
    const out = (lo, hi) => v < lo ? { cls: "warn", txt: "Low" } : v > hi ? { cls: "warn", txt: "High" } : { cls: "ok", txt: "Normal" };
    switch (id) {
      case "b12": { const p = /pg/.test(u) ? v * 0.738 : v; return p < 148 ? { cls: "bad", txt: "Low – treat" } : p < 221 ? { cls: "warn", txt: "Borderline – check MMA / treat" } : { cls: "ok", txt: "Normal" }; }
      case "ca": return /mg/.test(u) ? out(8.5, 10.5) : out(2.1, 2.6);
      case "glu": return /mg/.test(u) ? out(70, 200) : out(4, 11);
      case "na": return out(135, 145);
      case "hgb": return /g\/dl/.test(u) ? out(12, 17.5) : out(120, 175);
      case "tsh": return o.low != null && o.high != null ? out(o.low, o.high) : out(0.35, 5);
      case "egfr": return v < 30 ? { cls: "bad", txt: "<30" } : v < 60 ? { cls: "warn", txt: "Reduced" } : { cls: "ok", txt: "≥60" };
      case "mcv": return out(80, 100);
      default: if (o.low != null && o.high != null) return out(o.low, o.high);
    }
  }
  return { cls: "grey", txt: "Review" };
}

function crcl() {
  const cr = L("cr"), wt = V("wt");
  if (!cr || !wt || !S.ageY) return null;
  let c = Number(cr.value); if (/mg/i.test(cr.unit)) c = c * 88.4;
  const w = Number(wt.value) * (/lb/i.test(wt.unit) ? 0.4536 : 1);
  let v = ((140 - S.ageY) * w * 1.23) / c; if (S.sex === "female") v *= 0.85;
  return Math.round(v);
}
function medHits() {
  return MEDFLAGS.map(f => ({ ...f, meds: S.meds.filter(m => f.re.test(m.name)).map(m => m.name) })).filter(f => f.meds.length);
}
const on = id => !!S.feat[id]?.on;
function cogImpaired() {
  const m = parseInt(S.inp.moca, 10), mm = parseInt(S.inp.mmse, 10);
  return on("iadl") || on("amnestic") || on("executive") || on("visuo") || on("speed") || on("language") || (!isNaN(m) && m < 26) || (!isNaN(mm) && mm < 25) || (isNaN(m) && isNaN(mm));
}

/* ---------------------------------------------------------- subtype rules */
function evaluate() {
  const R = [];
  const dementiaLevel = on("iadl");
  const add = (o) => R.push(o);
  const amy = S.bio.amyloid;

  // Alzheimer
  {
    const why = [], next = [];
    let lvl = 0;
    if (on("amnestic")) { why.push("memory-led presentation"); lvl++; }
    if (on("gradual")) { why.push("gradual progression"); lvl++; }
    if (on("mta")) { why.push("medial temporal atrophy on imaging"); lvl++; }
    if (on("parietal")) { why.push("parietal atrophy"); lvl++; }
    if (on("lvppa")) { why.push("logopenic aphasia (usually AD)"); lvl++; }
    if (on("visuo") && !on("amnestic")) why.push("visuospatial-led (possible posterior cortical atrophy variant)");
    if (amy === "pos") { why.push("amyloid/p-tau biomarker POSITIVE"); lvl += 2; }
    if (amy === "neg") { why.push("amyloid/p-tau biomarker NEGATIVE — AD unlikely"); lvl = Math.min(lvl, 1) - 1; }
    if (amy === "nd") next.push("If early-stage and treatment-eligible, or atypical/young: plasma p-tau217 (LifeLabs/Dynacare) → confirm with amyloid PET or CSF");
    next.push("MRI brain (coronal hippocampal views) if not done", "Exclude reversible contributors (Workup tab)");
    add({ id: "ad", name: dementiaLevel ? "Alzheimer disease" : "Alzheimer disease (MCI vs dementia — function not yet documented)", lvl: lvl >= 4 ? 3 : lvl >= 2 ? 2 : lvl >= 1 ? 1 : 0, why, next });
  }
  // DLB (McKeith 2017) and PDD
  {
    const core = ["fluct", "vh", "rbd", "parkinsonism"].filter(on);
    const ind = [S.bio.dat === "pos" && "reduced DaT uptake", S.bio.psg === "pos" && "REM sleep without atonia on PSG"].filter(Boolean);
    const names = { fluct: "fluctuations", vh: "visual hallucinations", rbd: "RBD", parkinsonism: "parkinsonism" };
    const why = core.map(c => names[c]).concat(ind);
    if (on("neurolep")) why.push("neuroleptic sensitivity (supportive)");
    if (on("autonomic")) why.push("autonomic / falls (supportive)");
    if (on("pdfirst")) {
      add({ id: "pdd", name: "Parkinson disease dementia", lvl: (on("executive") || on("visuo") || on("amnestic") || on("speed") || dementiaLevel) ? 3 : 2,
        why: ["Parkinson disease diagnosis — motor onset ≥1 year before dementia (1-year rule)"].concat(why),
        next: ["Confirm timeline: PD motor symptoms ≥1 year before cognitive decline", "MoCA (better than MMSE for executive/visuospatial deficits)", "Screen orthostatic BP, hallucinations, RBD"] });
    } else {
      let lvl = (core.length >= 2 || (core.length >= 1 && ind.length >= 1)) ? 3 : (core.length === 1 || ind.length >= 1) ? 2 : 0;
      if (lvl && !cogImpaired()) { lvl = 1; why.push("cognition not impaired — Lewy features without dementia: consider Parkinson disease, MSA or prodromal DLB"); }
      add({ id: "dlb", name: lvl === 3 ? "Dementia with Lewy bodies — meets PROBABLE criteria" : "Dementia with Lewy bodies", lvl, why,
        next: ["Ask specifically about RBD, fluctuations (Mayo Fluctuations Scale) and hallucinations", "DaT-SPECT (ioflupane) if diagnosis uncertain — reduced striatal uptake", "Polysomnography for RBD if available", "AVOID haloperidol / typical antipsychotics"] });
    }
  }
  // bvFTD (Rascovsky 2011)
  {
    const six = ["disinhib", "apathy", "empathy", "compulsive", "hyperoral", "execspared"];
    const n = six.filter(on).length;
    const labels = { disinhib: "disinhibition", apathy: "apathy", empathy: "loss of empathy", compulsive: "compulsive behaviour", hyperoral: "hyperorality", execspared: "dysexecutive with spared memory" };
    const why = [`${n}/6 bvFTD features: ` + (six.filter(on).map(x => labels[x]).join(", ") || "none")];
    if (on("early")) why.push("young onset");
    if (on("ftatrophy")) why.push("frontal/anterior temporal atrophy");
    if (on("mnd")) why.push("motor neuron disease signs (FTD-ALS)");
    const lvl = n >= 3 && on("ftatrophy") && dementiaLevel ? 3 : n >= 3 ? 2 : n >= 1 ? 1 : 0;
    add({ id: "ftd", name: n >= 3 && on("ftatrophy") ? "Behavioural-variant FTD — PROBABLE (≥3 features + imaging)" : n >= 3 ? "Behavioural-variant FTD — POSSIBLE (≥3/6 features)" : "Behavioural-variant FTD", lvl, why,
      next: ["MRI brain (frontal/anterior temporal atrophy); FDG-PET if MRI normal", "Exclude primary psychiatric disorder (late-life onset mania/depression)", "Family history ×3 generations → genetics (C9orf72, GRN, MAPT) via neurology/genetics", "EMG if fasciculations/weakness (ALS)", "Do NOT start cholinesterase inhibitors"] });
  }
  // PPA
  if (on("language") || on("svppa") || on("nfvppa") || on("lvppa")) {
    const v = [on("svppa") && "semantic", on("nfvppa") && "non-fluent/agrammatic", on("lvppa") && "logopenic"].filter(Boolean);
    add({ id: "ppa", name: "Primary progressive aphasia" + (v.length ? ` — ${v.join(" / ")} variant` : ""), lvl: v.length ? 2 : 1,
      why: ["language is the leading deficit"].concat(on("lvppa") ? ["logopenic variant → usually Alzheimer pathology"] : []),
      next: ["Speech-language pathology assessment (naming, comprehension, repetition, grammar)", "MRI: left anterior temporal (svPPA), left posterior fronto-insular (nfvPPA), left temporoparietal (lvPPA)", on("lvppa") ? "Amyloid biomarker — likely AD" : "Neurology referral"] });
  }
  // Vascular (VASCOG / NINDS-AIREN style)
  {
    const img = on("svd") || on("infarct");
    const why = [];
    if (on("strokehx")) why.push("stroke/TIA history");
    if (on("stepwise")) why.push("stepwise course");
    if (on("focal")) why.push("focal signs");
    if (on("svd")) why.push("small-vessel disease on imaging");
    if (on("infarct")) why.push("infarcts on imaging");
    if (on("executive") || on("speed")) why.push("executive / processing-speed profile");
    if (on("vrf")) why.push("vascular risk factors");
    if (on("gaitnph") || on("urinary")) why.push("early gait / urinary change (also seen in vascular)");
    const lvl = img && (on("strokehx") || on("stepwise") || ((on("executive") || on("speed")) && on("infarct"))) ? 3 : img ? 2 : on("strokehx") ? 2 : on("vrf") ? 1 : 0;
    add({ id: "vad", name: lvl === 3 ? "Vascular cognitive impairment / dementia — PROBABLE" : "Vascular cognitive impairment / dementia", lvl, why,
      next: [img ? "Correlate imaging burden with clinical picture (mild white-matter change is common with age)" : "CT or MRI head to look for infarcts / white-matter disease", "Check BP, A1c, lipids, AF/anticoagulation, smoking"] });
  }
  // Mixed
  {
    const ad = R.find(r => r.id === "ad"), vad = R.find(r => r.id === "vad"), dlb = R.find(r => r.id === "dlb");
    if (ad && vad && ad.lvl >= 2 && vad.lvl >= 2) add({ id: "mixed", name: "Mixed dementia (Alzheimer + vascular)", lvl: 2, why: ["features of both AD and cerebrovascular disease — the most common pattern in people over 80"], next: ["Treat as AD (ChEI) plus aggressive vascular risk control"] });
    if (ad && dlb && ad.lvl >= 2 && dlb.lvl >= 2) add({ id: "mixed2", name: "Mixed Alzheimer + Lewy body pathology", lvl: 1, why: ["memory-led course plus Lewy features — co-pathology is common"], next: ["Manage as DLB for drug safety (avoid antipsychotics)"] });
  }
  // NPH
  {
    const lvl = on("gaitnph") && on("vent") ? 3 : on("vent") && (on("urinary") || on("gaitnph")) ? 2 : (on("gaitnph") && on("urinary")) || on("vent") ? 1 : 0;
    add({ id: "nph", name: "Normal pressure hydrocephalus", lvl, why: [on("gaitnph") && "early gait disorder", on("urinary") && "urinary urgency/incontinence", on("vent") && "ventriculomegaly on imaging"].filter(Boolean),
      next: ["Measure Evans index (>0.3) and look for DESH on MRI", "Timed Up and Go / 10 m walk before and after high-volume LP (30–50 mL tap test)", "Neurosurgery referral if tap test positive → VP shunt"] });
  }
  // Rapidly progressive / CJD
  if (on("rapid") || on("cjdmri") || S.bio.rtquic === "pos") {
    const cjd = on("cjdmri") || S.bio.rtquic === "pos" || (on("rapid") && on("myoclonus"));
    add({ id: "rpd", name: cjd ? "Rapidly progressive dementia — prion disease (CJD) concern" : "Rapidly progressive dementia", lvl: cjd ? 3 : 2,
      why: [on("rapid") && "rapid course", on("myoclonus") && "myoclonus/ataxia", on("cjdmri") && "CJD-pattern DWI", S.bio.rtquic === "pos" && "RT-QuIC positive"].filter(Boolean),
      next: ["Urgent neurology", "MRI brain with DWI/FLAIR", "EEG (periodic sharp-wave complexes; non-convulsive status)", "LP: cell count, protein, glucose, oligoclonal bands, 14-3-3, total tau, RT-QuIC", "Serum + CSF autoimmune encephalitis panel (NMDA, LGI1, CASPR2…), paraneoplastic panel, consider CT chest/abdo/pelvis", "TSH, anti-TPO (steroid-responsive encephalopathy), HIV, syphilis, B12, ammonia, drugs/toxins", "If CJD suspected: notify infection prevention (instrument handling) and public health"] });
  }
  // PSP (MDS 2017)
  {
    const why = [on("vgaze") && "vertical supranuclear gaze palsy / slow vertical saccades", on("falls1y") && "early backward falls / postural instability", on("axial") && "axial rigidity / stare", on("pspmri") && "midbrain atrophy (hummingbird)", on("poorldopa") && "poor levodopa response", (on("executive") || on("apathy")) && "frontal-executive change"].filter(Boolean);
    const lvl = on("vgaze") && (on("falls1y") || on("axial") || on("pspmri")) ? 3 : (on("vgaze") || on("pspmri") || (on("falls1y") && on("axial"))) ? 2 : (on("falls1y") || on("axial")) ? 1 : 0;
    add({ id: "psp", name: lvl === 3 ? "Progressive supranuclear palsy — PROBABLE (Richardson syndrome)" : "Progressive supranuclear palsy (PSP)", lvl, why,
      next: ["Examine vertical saccades and downgaze (doll's eyes overcome the palsy = supranuclear); pull test", "MRI brain: midbrain atrophy, midbrain-to-pons ratio", "Levodopa trial to ~1000 mg/day for 1–2 months (usually little benefit)", "Swallow assessment (SLP) — aspiration is the leading cause of death", "Neurology / movement disorders referral"] });
  }
  // Corticobasal syndrome (Armstrong 2013)
  {
    const why = [on("asym") && "asymmetric rigidity / dystonia / myoclonus", on("apraxia") && "limb apraxia / alien limb / cortical sensory loss", on("cbsmri") && "asymmetric frontoparietal atrophy", on("nfvppa") && "non-fluent aphasia", (on("executive") || on("visuo")) && "executive / visuospatial deficits"].filter(Boolean);
    const lvl = on("asym") && on("apraxia") ? 3 : (on("apraxia") || (on("asym") && (on("cbsmri") || on("nfvppa")))) ? 2 : (on("asym") || on("cbsmri")) ? 1 : 0;
    add({ id: "cbs", name: lvl === 3 ? "Corticobasal syndrome — PROBABLE" : "Corticobasal syndrome (CBS)", lvl, why: why.concat(lvl ? ["underlying pathology may be CBD, PSP or Alzheimer disease"] : []),
      next: ["Amyloid biomarker (p-tau217, PET or CSF): about a quarter of CBS is Alzheimer pathology — changes treatment", "MRI: asymmetric frontoparietal/perirolandic atrophy", "Levodopa trial (usually little benefit)", "OT/PT/SLP; neurology"] });
  }
  // MSA (MDS 2022)
  {
    const motor = on("parkinsonism") || on("cereb");
    const sup = [on("poorldopa") && "poor levodopa response", on("stridor") && "stridor / antecollis", on("msamri") && "MSA MRI signs", on("rbd") && "RBD"].filter(Boolean);
    const why = [on("autfail") && "autonomic failure", on("parkinsonism") && "parkinsonism (MSA-P)", on("cereb") && "cerebellar syndrome (MSA-C)"].filter(Boolean).concat(sup);
    let lvl = on("autfail") && motor && (on("poorldopa") || on("msamri") || on("stridor")) ? 3 : (on("autfail") && motor) || on("msamri") ? 2 : (on("autfail") && (on("stridor") || on("rbd"))) ? 1 : 0;
    if (lvl && on("pdfirst") && !on("msamri") && !on("poorldopa")) { lvl = Math.min(lvl, 1); why.push("autonomic failure also occurs late in Parkinson disease"); }
    if (lvl && (on("iadl") || on("amnestic")) && !on("cereb")) why.push("note: early prominent dementia argues against MSA");
    add({ id: "msa", name: lvl === 3 ? "Multiple system atrophy — clinically probable" : "Multiple system atrophy (MSA)", lvl, why,
      next: ["Orthostatic vitals (lying 5 min, standing 1 and 3 min): drop ≥20/10 (≥30/15 supports MSA)", "Post-void residual (bladder scan) for retention", "MRI brain: hot cross bun, putaminal rim, pontine/MCP atrophy", "Stridor or snoring change → laryngoscopy / sleep study (sudden death risk)", "Neurology / movement disorders referral"] });
  }
  // Huntington disease
  {
    const why = [on("chorea") && "chorea", on("hdfam") && "family history / known expansion", on("caudate") && "caudate atrophy", on("psych") && "psychiatric change", (on("executive") || on("speed")) && "subcortical-executive dementia", S.bio.hdgene === "pos" && "HTT CAG expansion POSITIVE"].filter(Boolean);
    const lvl = S.bio.hdgene === "pos" || (on("chorea") && (on("hdfam") || on("caudate"))) ? 3 : on("chorea") || on("hdfam") ? 2 : on("caudate") ? 1 : 0;
    add({ id: "hd", name: "Huntington disease", lvl, why,
      next: ["HTT genetic test (CAG repeat) with genetic counselling and consent — results affect the whole family", "Screen for suicide risk at every contact (high in HD)", "Exclude other chorea: drugs (levodopa, antipsychotic/tardive, stimulants, estrogen), non-ketotic hyperglycemia, hyperthyroidism, SLE/antiphospholipid, polycythemia, Wilson (young)", "Swallow assessment, weight, nutrition", "HD clinic / neurology"] });
  }
  // ALS / ALS-FTD
  {
    const mot = [on("mnd") && "fasciculations / weakness", on("bulbar") && "bulbar involvement", on("umnlmn") && "mixed upper + lower motor neuron signs", S.bio.emg === "pos" && "EMG denervation"].filter(Boolean);
    const ftdN = ["disinhib", "apathy", "empathy", "compulsive", "hyperoral"].filter(on).length;
    const lvl = S.bio.emg === "pos" || mot.length >= 2 ? 3 : mot.length === 1 ? 2 : 0;
    add({ id: "als", name: lvl && (ftdN >= 2 || on("ftatrophy")) ? "ALS with frontotemporal dementia (ALS-FTD)" : "Motor neuron disease (ALS)", lvl,
      why: mot.concat(ftdN ? [`${ftdN} bvFTD behaviour feature(s)`] : []),
      next: ["EMG/nerve conduction (urgent outpatient or inpatient)", "Respiratory: FVC sitting and supine, overnight oximetry or capnography, venous/arterial CO2 — orthopnea suggests diaphragm weakness", "Swallow assessment; early feeding-tube discussion (before FVC <50%)", "Cognitive/behavioural screen (ECAS) — affects capacity and decisions", "Genetic counselling (C9orf72 most common in ALS-FTD); ALS clinic and early goals-of-care conversation"] });
  }
  // Alcohol
  if (on("alcohol")) add({ id: "alc", name: on("confab") ? "Korsakoff syndrome / alcohol-related brain damage" : "Alcohol-related cognitive impairment", lvl: on("confab") || on("amnestic") ? 2 : 1,
    why: ["heavy alcohol use"].concat(on("confab") ? ["confabulation"] : []),
    next: ["IV thiamine NOW if any Wernicke features (confusion, ataxia, ophthalmoplegia) or malnourished — before glucose", "Reassess cognition after ≥3 months of abstinence (partial recovery is common)", "Check liver function, ammonia, Mg, phosphate"] });
  // Depression
  if (on("depression")) add({ id: "dep", name: "Depression contributing (pseudodementia / coexisting)", lvl: 1, why: ["depression on chart"], next: ["PHQ-9 or Geriatric Depression Scale; Cornell Scale if advanced dementia", "Treat depression and re-test cognition"] });

  R.sort((a, b) => b.lvl - a.lvl);
  return R;
}

/* ------------------------------------------------------------- rendering */
function lvlInfo(l) { return l >= 3 ? ["strong", "Strong fit"] : l === 2 ? ["mod", "Moderate fit"] : l === 1 ? ["weak", "Weak fit"] : ["weak", "Little support"]; }

function deliriumBanner() {
  if (!on("acute")) return "";
  return `<div class="banner bad"><b>Delirium flag — do not diagnose dementia today.</b> ${esc(S.feat.acute.snip)}<br>
  Treat the delirium (precipitants, meds, sleep, mobility, sensory aids), document <i>“cognitive impairment, likely pre-existing — formal assessment after recovery”</i>,
  and arrange cognitive testing ≥4–12 weeks after discharge. Collateral history about the <i>pre-admission</i> baseline is still valid now and is the most useful thing to collect.</div>`;
}

function renderHeader() {
  const p = S.patient || {};
  const name = p.name?.[0]?.text || [p.name?.[0]?.given?.join(" "), p.name?.[0]?.family].filter(Boolean).join(" ") || "Patient";
  $("#ptHeader").textContent = `${name} · ${S.ageY ?? "?"} y · ${p.gender || ""}`;
  $("#modeTag").textContent = S.mode === "demo" ? "DEMO – made-up patient" : "Live FHIR";
}

function cogInterp() {
  const out = [];
  const m = parseInt(S.inp.moca, 10);
  if (!isNaN(m)) {
    const adj = Math.min(30, m + (S.inp.mocaLowEdu ? 1 : 0));
    out.push(`MoCA ${adj}/30 → ` + (adj >= 26 ? "within normal range" : adj >= 18 ? "mild impairment range" : adj >= 10 ? "moderate impairment range" : "severe impairment range"));
  }
  const mm = parseInt(S.inp.mmse, 10);
  if (!isNaN(mm)) out.push(`MMSE ${mm}/30 → ` + (mm >= 25 ? "normal–very mild" : mm >= 20 ? "mild" : mm >= 10 ? "moderate" : "severe"));
  const mc = parseInt(S.inp.minicog, 10);
  if (!isNaN(mc)) out.push(`Mini-Cog ${mc}/5 → ` + (mc <= 2 ? "positive screen" : mc === 3 ? "borderline — positive if clock abnormal (some use <4)" : "negative screen"));
  const ru = parseInt(S.inp.rudas, 10);
  if (!isNaN(ru)) out.push(`RUDAS ${ru}/30 → ` + (ru <= 22 ? "suggests cognitive impairment" : "not suggestive"));
  return out;
}
function stageText() {
  if (on("acute")) return "Not stageable during delirium";
  const mo = parseInt(S.inp.moca, 10);
  if (!on("iadl") && !isNaN(mo) && mo >= 26) return "No objective cognitive impairment (MoCA ≥26)";
  if (!on("iadl")) return "Function not documented → cannot separate MCI from dementia yet";
  const m = parseInt(S.inp.moca, 10);
  if (!isNaN(m)) return m >= 18 ? "Mild dementia (likely)" : m >= 10 ? "Moderate dementia (likely)" : "Severe dementia (likely)";
  return "Dementia (function impaired) — severity: use MoCA/MMSE + ADLs";
}

function renderOverview() {
  const R = evaluate().filter(r => r.lvl >= 2).slice(0, 4);
  const mh = medHits();
  const missingCore = LABS.filter(l => l.core && !L(l.id));
  const abn = LABS.filter(l => L(l.id) && ["warn", "bad"].includes(labFlag(l.id, L(l.id)).cls));
  $("#tab-overview").innerHTML = `
    ${deliriumBanner()}
    ${S.mode === "demo" ? demoPicker() : ""}
    <div class="grid">
      <div class="card"><h2>Where things stand</h2>
        <table>
          <tr><th>Cognitive tests</th><td>${cogInterp().map(esc).join("<br>") || '<span class="muted">None found — enter on tab 2</span>'}</td></tr>
          <tr><th>Stage</th><td>${esc(stageText())}</td></tr>
          <tr><th>Imaging</th><td>${S.imaging.length ? S.imaging.slice(0, 2).map(i => esc(i.title + " " + fmtDate(i.date))).join("<br>") : '<span class="pill warn">No CT/MRI head report found</span>'}</td></tr>
          <tr><th>Core bloods</th><td>${missingCore.length ? `<span class="pill warn">Missing: ${missingCore.map(l => l.label).join(", ")}</span>` : '<span class="pill ok">All found</span>'}
            ${abn.length ? `<br><span class="pill bad">Abnormal: ${abn.map(l => l.label).join(", ")}</span>` : ""}</td></tr>
          <tr><th>Meds affecting cognition</th><td>${mh.filter(m => !/dementia drug|Rate-slowing|Anticoag|Alpha-blocker/.test(m.cls)).map(m => `<span class="pill bad">${esc(m.cls)}</span> ${esc(m.meds.join(", "))}`).join("<br>") || '<span class="pill ok">None flagged</span>'}</td></tr>
        </table>
      </div>
      <div class="card"><h2>Leading subtype fits</h2>
        ${R.length ? R.map(r => { const [c, t] = lvlInfo(r.lvl); return `<div class="fit ${c}"><b class="t">${esc(r.name)}</b> <span class="pill ${c === "strong" ? "ok" : "warn"}">${t}</span><div class="small">${esc(r.why.join("; "))}</div></div>`; }).join("")
          : (abn.length || mh.some(m => /anticholinergic|Benzo|Dopamine/.test(m.cls)) || on("depression"))
          ? '<div class="fit mod"><b class="t">No clear subtype yet — reversible contributors first</b><div class="small">Correct the abnormal bloods, deprescribe the flagged medications, treat mood, hearing and sleep, then re-test cognition in 3 months.</div></div>'
          : '<p class="muted">Not enough features yet. Complete tab 2.</p>'}
        <p class="small muted">Rules-based fit from checklist items — not a diagnosis. See tab 3 for all types and reasons.</p>
      </div>
    </div>
    <div class="card"><h2>Diagnostic steps (CCCDTD5 approach)</h2>
      <ol class="small">
        <li><b>Rule out delirium</b> (CAM / 4AT). If present, treat and defer the dementia diagnosis.</li>
        <li><b>Collateral history</b>: first symptom, onset (sudden vs insidious), course (gradual, stepwise, rapid), function (IADLs then ADLs), behaviour, sleep (RBD), hallucinations, falls, family history, alcohol.</li>
        <li><b>Objective testing</b>: MoCA (or MMSE, Mini-Cog; RUDAS if language/education/culture barriers). Correct hearing and vision first.</li>
        <li><b>Dementia vs MCI</b>: dementia = decline in ≥1 domain that interferes with independence in everyday activities.</li>
        <li><b>Reversible contributors</b>: CBC, lytes, Ca, glucose, TSH, B12 + others by suspicion; review meds; screen depression and sleep apnea.</li>
        <li><b>Neuroimaging</b> (CT or MRI) when indicated — most inpatients with new cognitive impairment will already have a CT head.</li>
        <li><b>Subtype</b> from the clinical pattern (tab 3); biomarkers (p-tau217, PET, CSF, DaT-SPECT) when the result would change management.</li>
        <li><b>Plan</b>: treatment by type, safety (driving, capacity, meds, home), advance care planning, caregiver support, follow-up.</li>
      </ol>
    </div>`;
}

function renderScreen() {
  const groups = [...new Set(FEATURES.map(f => f.g))];
  const bioSel = (k, label, opts = [["nd", "Not done"], ["pos", "Positive / abnormal"], ["neg", "Negative / normal"]]) =>
    `<div class="row"><label style="min-width:260px">${label}</label><select data-bio="${k}">${opts.map(([v, t]) => `<option value="${v}" ${S.bio[k] === v ? "selected" : ""}>${t}</option>`).join("")}</select></div>`;
  $("#tab-screen").innerHTML = `
    ${deliriumBanner()}
    <div class="card"><h2>Cognitive tests</h2>
      <div class="row">MoCA <input type="number" min="0" max="30" data-inp="moca" value="${esc(S.inp.moca)}">/30
        <label class="chk" style="display:inline-flex"><input type="checkbox" data-inp="mocaLowEdu" ${S.inp.mocaLowEdu ? "checked" : ""}> ≤12 yrs education (+1)</label></div>
      <div class="row">MMSE <input type="number" min="0" max="30" data-inp="mmse" value="${esc(S.inp.mmse)}">/30
        &nbsp; Mini-Cog <input type="number" min="0" max="5" data-inp="minicog" value="${esc(S.inp.minicog)}">/5
        &nbsp; RUDAS <input type="number" min="0" max="30" data-inp="rudas" value="${esc(S.inp.rudas)}">/30</div>
      <div id="coginterp" class="small"></div>
      <p class="small muted">Pre-filled from notes where a score was found. Scores done during delirium or acute illness under-estimate baseline.</p>
    </div>
    <div class="grid">
      ${groups.map(g => `<div class="card"><h2>${esc(g)}</h2>${FEATURES.filter(f => f.g === g).map(f => {
        const st = S.feat[f.id];
        return `<label class="chk"><input type="checkbox" data-feat="${f.id}" ${st.on ? "checked" : ""}><span>${esc(f.label)}${st.src === "chart" ? '<span class="pill chart">from chart – confirm</span>' : ""}${f.where === "manual" ? '<span class="pill grey">bedside</span>' : ""}</span></label>${st.snip ? `<div class="snip">${esc(st.snip)}</div>` : ""}`;
      }).join("")}</div>`).join("")}
      <div class="card"><h2>Biomarkers &amp; special tests</h2>
        ${bioSel("amyloid", "Amyloid / p-tau217 (blood, CSF or PET)")}
        ${bioSel("dat", "DaT-SPECT (reduced striatal uptake = abnormal)")}
        ${bioSel("psg", "Polysomnography: REM sleep without atonia")}
        ${bioSel("tap", "NPH high-volume LP tap test (gait improves = positive)")}
        ${bioSel("rtquic", "CSF RT-QuIC (prion)")}
        ${bioSel("emg", "EMG: active + chronic denervation in ≥2 regions (ALS)")}
        ${bioSel("hdgene", "HTT gene test (CAG ≥40 = positive)")}
        ${bioSel("apoe", "APOE genotype", [["nd", "Not done"], ["e4neg", "No ε4"], ["e4het", "One ε4 (heterozygote)"], ["e4hom", "Two ε4 (homozygote)"]])}
      </div>
    </div>`;
  updateCogInterp();
  $("#tab-screen").addEventListener("change", e => {
    const t = e.target;
    if (t.dataset.feat) S.feat[t.dataset.feat] = { ...S.feat[t.dataset.feat], on: t.checked, src: S.feat[t.dataset.feat].src || "user" };
    if (t.dataset.inp) S.inp[t.dataset.inp] = t.type === "checkbox" ? t.checked : t.value;
    if (t.dataset.bio) S.bio[t.dataset.bio] = t.value;
    updateCogInterp(); renderDerived();
  });
  $("#tab-screen").addEventListener("input", e => { if (e.target.dataset.inp) { S.inp[e.target.dataset.inp] = e.target.value; updateCogInterp(); } });
}
function updateCogInterp() { const el = $("#coginterp"); if (el) el.innerHTML = cogInterp().map(esc).join("<br>") || ""; }

function renderSubtype() {
  const R = evaluate();
  $("#tab-subtype").innerHTML = `${deliriumBanner()}
    <div class="card"><h2>Fit against each dementia type</h2>
      <p class="small muted">Driven by the checklist on tab 2. Uses DLB consensus (McKeith 2017), bvFTD (Rascovsky 2011), PPA (Gorno-Tempini 2011), VASCOG-style vascular criteria, the PD 1-year rule, and simplified MDS PSP (2017), CBS (Armstrong 2013), MDS MSA (2022) and ALS (Gold Coast 2020) criteria. Many older patients have mixed pathology.</p>
      ${R.map(r => { const [c, t] = lvlInfo(r.lvl); return `<div class="fit ${c}"><b class="t">${esc(r.name)}</b> <span class="pill ${c === "strong" ? "ok" : c === "mod" ? "warn" : "grey"}">${t}</span>
        <div class="small"><b>Why:</b> ${esc(r.why.join("; ") || "no supporting features checked")}</div>
        ${r.lvl >= 1 ? `<div class="small"><b>Next:</b><ul>${r.next.map(n => `<li>${esc(n)}</li>`).join("")}</ul></div>` : ""}</div>`; }).join("")}
    </div>`;
}

function renderWorkup() {
  const R = evaluate();
  const rows = LABS.map(l => {
    const o = L(l.id), f = labFlag(l.id, o);
    if (!l.core && !o) return "";
    return `<tr><td>${esc(l.label)}${l.core ? ' <span class="pill grey">core</span>' : ""}</td><td>${o ? esc(o.value + " " + o.unit) : "—"}</td><td>${o ? esc(fmtDate(o.date)) : ""}</td><td><span class="pill ${f.cls}">${esc(f.txt)}</span></td></tr>`;
  }).join("");
  const mh = medHits();
  const per = {
    ad: "MRI (hippocampal atrophy, exclude vascular/other); plasma p-tau217 or Aβ42/40 → amyloid PET or CSF Aβ42/40 + p-tau if it will change management (anti-amyloid eligibility, young/atypical); APOE genotype only if anti-amyloid therapy is planned (with counselling).",
    dlb: "History for the 4 core features; orthostatic BP; DaT-SPECT if uncertain; polysomnography for RBD.",
    pdd: "MoCA; orthostatic vitals; screen for hallucinations and RBD; review dopaminergic and anticholinergic drugs.",
    ftd: "MRI ± FDG-PET; neuropsychology; family history → genetic testing; exclude psychiatric illness; EMG if ALS signs.",
    ppa: "Speech-language pathology; MRI pattern; amyloid biomarker for logopenic variant.",
    vad: "MRI with FLAIR/SWI preferred over CT; vascular risk work-up (BP, A1c, lipids, ECG/AF, carotid imaging if recent event).",
    nph: "Evans index, DESH on MRI; timed gait before/after high-volume LP; neurosurgery.",
    rpd: "Urgent MRI DWI, EEG, LP (RT-QuIC, 14-3-3, autoimmune panel), paraneoplastic work-up.",
    alc: "Thiamine first; LFTs, Mg, PO4; re-test after abstinence.",
    dep: "PHQ-9 / GDS; treat and re-test.",
    psp: "Eye movements (vertical saccades, downgaze), pull test; MRI midbrain (hummingbird, midbrain/pons ratio); levodopa trial; swallow assessment.",
    cbs: "MRI (asymmetric frontoparietal atrophy); amyloid biomarker (AD-CBS); DaT-SPECT may be abnormal; neuropsychology for apraxia/cortical sensory loss.",
    msa: "Orthostatic vitals, post-void residual, MRI (hot cross bun, putaminal rim), autonomic testing, sleep study / laryngoscopy for stridor; DaT-SPECT abnormal (does not separate from PD).",
    hd: "HTT CAG repeat (≥40 full penetrance) after genetic counselling; MRI caudate; exclude other causes of chorea (glucose, TSH, CBC/smear, ANA/APL, drugs, ceruloplasmin if young).",
    als: "EMG/NCS; MRI spine/brain to exclude mimics (cervical myelopathy); CK; FVC, overnight oximetry, CO2; B12, TSH, calcium/PTH, SPEP/free light chains; C9orf72 testing with counselling."
  };
  $("#tab-workup").innerHTML = `${deliriumBanner()}
    <div class="grid">
      <div class="card"><h2>Bloodwork — reversible contributors</h2>
        <table><tr><th>Test</th><th>Latest</th><th>Date</th><th>Status</th></tr>${rows}</table>
        <p class="small muted">Core panel (CCCDTD): CBC, electrolytes, calcium, glucose, TSH, B12. Add by suspicion: syphilis, HIV, folate (if malnourished), LFTs/ammonia, renal function, A1c and lipids (vascular risk), heavy metals/toxicology.</p>
      </div>
      <div class="card"><h2>Medications to review</h2>
        ${mh.length ? `<table><tr><th>Class</th><th>On list</th><th>Why it matters</th></tr>${mh.map(m => `<tr><td>${esc(m.cls)}</td><td>${esc(m.meds.join("; "))}</td><td class="small">${esc(m.why)}</td></tr>`).join("")}</table>` : '<p class="muted">No flagged medications on the active list.</p>'}
      </div>
    </div>
    <div class="grid">
      <div class="card"><h2>Neuroimaging</h2>
        ${S.imaging.length ? S.imaging.map(i => `<details><summary>${esc(i.title)} · ${esc(fmtDate(i.date))}</summary><div class="small" style="white-space:pre-wrap">${esc(i.text.slice(0, 3000))}</div></details>`).join("") : '<p><span class="pill warn">No CT/MRI head report found</span></p>'}
        <p class="small muted">CCCDTD: image when onset &lt;60, rapid decline (1–2 months), short duration (&lt;2 yr), recent head trauma, unexplained neurological symptoms, anticoagulation, cancer history, focal signs, early incontinence/gait disorder, or atypical presentation. MRI preferred when available.</p>
      </div>
      <div class="card"><h2>Other screens</h2>
        <ul class="small">
          <li><b>Delirium</b>: CAM or 4AT each shift while in hospital.</li>
          <li><b>Mood</b>: PHQ-9 / Geriatric Depression Scale (Cornell Scale in advanced dementia).</li>
          <li><b>Sleep</b>: STOP-BANG for OSA; ask about RBD.</li>
          <li><b>Hearing and vision</b>: correct before testing (pocket talker, glasses).</li>
          <li><b>Function</b>: Lawton IADL and Katz ADL, or the Functional Activities Questionnaire with a caregiver.</li>
          <li><b>Behaviour</b>: NPI-Q with caregiver.</li>
        </ul>
      </div>
    </div>
    <div class="card"><h2>Type-specific tests for the types that fit</h2>
      <table><tr><th>Type</th><th>Tests</th></tr>${R.filter(r => r.lvl >= 1 && per[r.id]).map(r => `<tr><td>${esc(r.name)}</td><td class="small">${esc(per[r.id])}</td></tr>`).join("") || '<tr><td colspan=2 class="muted">Complete the checklist on tab 2.</td></tr>'}</table>
    </div>`;
}

function renderTreat() {
  const R = evaluate();
  const fits = new Set(R.filter(r => r.lvl >= 2).map(r => r.id));
  const hr = V("hr"), eg = L("egfr"), cc = crcl(), mh = medHits();
  const rate = mh.find(m => /Rate-slowing/.test(m.cls)), anti = mh.find(m => /Antipsychotic/.test(m.cls)), ac = mh.find(m => /Anticoag/.test(m.cls));
  const hrv = hr ? Number(hr.value) : null;
  const renal = eg ? Number(eg.value) : cc;
  const chk = [];
  chk.push(hrv == null ? ["grey", "Heart rate not found — check HR and ECG (PR interval, heart block) before a cholinesterase inhibitor"]
    : hrv < 50 ? ["bad", `HR ${hrv} — avoid cholinesterase inhibitors until bradycardia is explained`]
    : hrv < 60 ? ["warn", `HR ${hrv} — caution with cholinesterase inhibitors; ECG; review rate-slowing drugs`]
    : ["ok", `HR ${hrv} — no bradycardia`]);
  if (rate) chk.push(["warn", `On rate-slowing drug(s): ${rate.meds.join(", ")} — additive bradycardia/syncope risk with ChEI`]);
  chk.push(renal == null ? ["grey", "Renal function not found"] : renal < 30 ? ["warn", `${eg ? "eGFR" : "CrCl"} ${renal} — memantine max 5 mg BID; galantamine avoid if CrCl <9`] : ["ok", `${eg ? "eGFR" : "CrCl (Cockcroft–Gault)"} ${renal}`]);
  if (anti) chk.push([fits.has("dlb") || fits.has("pdd") ? "bad" : "warn", `On antipsychotic: ${anti.meds.join(", ")}` + (fits.has("dlb") || fits.has("pdd") ? " — Lewy features present: STOP haloperidol/typicals (severe sensitivity reactions)" : " — reassess need; mortality/stroke risk in dementia")]);
  const acNote = ac ? `On ${ac.meds.join(", ")} — anticoagulation is a relative contraindication.` : "";

  const sec = (id, title, body) => `<details ${fits.has(id) ? "open" : ""}><summary>${esc(title)} ${fits.has(id) ? '<span class="pill ok">fits this patient</span>' : ""}</summary>${body}</details>`;
  $("#tab-treat").innerHTML = `${deliriumBanner()}
    <div class="card"><h2>Safety checks before starting a drug</h2>${chk.map(([c, t]) => `<div><span class="pill ${c}">${c === "ok" ? "OK" : c === "grey" ? "?" : "!"}</span> ${esc(t)}</div>`).join("")}
      ${on("acute") ? '<p class="small"><b>Delirium active:</b> usually defer starting dementia drugs until recovered and the diagnosis is confirmed.</p>' : ""}</div>

    <div class="card"><h2>For every type (non-drug, first)</h2><ul class="small">
      <li><b>Deprescribe</b> anticholinergics, benzodiazepines and sedatives (see Workup tab).</li>
      <li><b>Hearing aids / glasses</b>, treat depression and sleep apnea, correct B12/thyroid.</li>
      <li><b>Exercise</b> (aerobic + strength), social and cognitive activity, Mediterranean-style diet; manage BP, diabetes, lipids, smoking, alcohol.</li>
      <li><b>Safety</b>: driving (BC: report to RoadSafetyBC under Motor Vehicle Act s.230 if the condition makes driving dangerous and they continue after warning), firearms, stove, wandering, finances/fraud, medication supervision (blister packs).</li>
      <li><b>Capacity and planning</b>: representation agreement, enduring power of attorney, advance care plan and MOST while capacity allows.</li>
      <li><b>Supports</b>: Alzheimer Society of BC First Link, Island Health home and community care, adult day programs, caregiver respite; OT home assessment.</li>
      <li><b>Behaviour (BPSD)</b>: DICE approach — Describe, Investigate (pain, constipation, retention, infection, meds), Create plan, Evaluate. Non-drug first.</li>
      <li><b>Follow-up</b>: specialist (geriatrics / neurology / memory clinic) for atypical, young-onset, rapid, or diagnostic uncertainty.</li>
    </ul></div>

    <div class="card"><h2>By type</h2>
    ${sec("ad", "Alzheimer disease", `<ul class="small">
      <li><b>Cholinesterase inhibitor</b> (mild–moderate–severe): donepezil, rivastigmine or galantamine — similar efficacy; choose by side effects and route. Reassess benefit at 3–6 months.</li>
      <li><b>Memantine</b>: moderate–severe AD, alone or added to a ChEI; useful when ChEI not tolerated.</li>
      <li><b>Anti-amyloid antibodies</b> (MCI or mild dementia due to AD with confirmed amyloid): lecanemab (Health Canada conditional approval Oct 2025, APOE ε4 non-carriers/heterozygotes) and donanemab (approved May 2026). Need amyloid PET/CSF, APOE genotype, baseline MRI and scheduled MRIs for ARIA, infusion capacity. Not yet on public drug plans — specialist-led. ${esc(acNote)} ${on("bleeds") ? "<b>Imaging shows microbleeds/siderosis — likely ineligible.</b>" : ""} ${S.bio.apoe === "e4hom" ? "<b>APOE ε4 homozygote — excluded from lecanemab in Canada.</b>" : ""}</li>
      <li><b>Agitation/psychosis</b> after non-drug measures: risperidone is the only Health Canada–indicated antipsychotic (short-term, severe AD aggression/psychosis); citalopram or trazodone are alternatives. Review and taper every 3 months.</li></ul>`)}
    ${sec("dlb", "Dementia with Lewy bodies", `<ul class="small">
      <li><b>Cholinesterase inhibitor</b> — often a larger benefit than in AD, including hallucinations and fluctuations (rivastigmine or donepezil). Memantine can be added.</li>
      <li><b>Hallucinations/psychosis</b>: reduce anticholinergics, dopamine agonists and amantadine first; if treatment needed, very low-dose quetiapine (6.25–12.5 mg) or clozapine with monitoring. <b>Never haloperidol or typical antipsychotics</b>; avoid risperidone/olanzapine.</li>
      <li><b>Parkinsonism</b>: levodopa (carbidopa/levodopa) at the lowest effective dose — can worsen hallucinations.</li>
      <li><b>RBD</b>: bed safety; melatonin 3–12 mg qHS first; clonazepam only with caution (falls, confusion).</li>
      <li><b>Orthostatic hypotension</b>: stop offending drugs, fluids/salt, compression, then midodrine or fludrocortisone. Constipation and falls prevention.</li></ul>`)}
    ${sec("pdd", "Parkinson disease dementia", `<ul class="small">
      <li><b>Rivastigmine</b> (Health Canada indication for mild–moderate PDD); donepezil is an alternative. Watch for worse tremor.</li>
      <li>Simplify PD drugs: stop anticholinergics (trihexyphenidyl), then amantadine, dopamine agonists, MAO-B inhibitors; keep levodopa.</li>
      <li>Psychosis: low-dose quetiapine or clozapine; avoid typical antipsychotics. Treat orthostasis, constipation, RBD as for DLB.</li></ul>`)}
    ${sec("ftd", "Frontotemporal dementia (bvFTD / PPA)", `<ul class="small">
      <li><b>No disease-modifying or approved drug.</b> Cholinesterase inhibitors do not help and can worsen behaviour — avoid. Memantine not effective.</li>
      <li><b>Behaviour</b>: SSRI (citalopram, sertraline) or trazodone for disinhibition, compulsions and hyperorality. Antipsychotics only for severe risk, lowest dose.</li>
      <li>Speech-language therapy and communication aids for PPA; caregiver education (behaviour is not deliberate); supervise finances, driving, food access.</li>
      <li>Genetic counselling if family history; screen for ALS (swallowing, breathing).</li>
      <li>Logopenic PPA is usually Alzheimer disease — treat as AD.</li></ul>`)}
    ${sec("vad", "Vascular dementia", `<ul class="small">
      <li><b>Prevent further strokes</b>: BP control (target per patient, avoid hypotension/orthostasis), antiplatelet if ischemic, anticoagulate AF, statin, diabetes control, smoking cessation, exercise.</li>
      <li>Cholinesterase inhibitors and memantine give small benefits (off-label) — reasonable to try, especially in mixed AD + vascular.</li>
      <li>Treat depression and apathy; physiotherapy for gait; continence management.</li></ul>`)}
    ${sec("mixed", "Mixed Alzheimer + vascular", `<p class="small">Treat as Alzheimer disease (ChEI ± memantine) plus full vascular risk reduction.</p>`)}
    ${sec("nph", "Normal pressure hydrocephalus", `<ul class="small">
      <li>High-volume LP tap test (or lumbar drain) → if gait improves, <b>ventriculoperitoneal shunt</b> (neurosurgery). Gait responds best; cognition less.</li>
      <li>Physiotherapy, falls prevention, continence care while awaiting assessment.</li></ul>`)}
    ${sec("rpd", "Rapidly progressive dementia / CJD", `<ul class="small">
      <li>Treat the treatable: autoimmune encephalitis → steroids/IVIG/plasma exchange (neurology); infection; metabolic; malignancy.</li>
      <li>CJD: no disease-modifying therapy — supportive and palliative care; infection prevention notification; report to public health and the Canadian CJD Surveillance System.</li></ul>`)}
    ${sec("psp", "Progressive supranuclear palsy", `<ul class="small">
      <li><b>No disease-modifying treatment.</b> Levodopa trial (titrate to ~1000 mg/day over 1–2 months; stop if no benefit) — a minority get modest help early. Amantadine sometimes tried.</li>
      <li><b>Falls</b>: PT, weighted wheeled walker, hip protectors, home safety; avoid sedatives.</li>
      <li><b>Swallowing</b>: SLP, texture-modified diet, aspiration precautions; feeding-tube discussion in advance.</li>
      <li>Eyes: lubricants for reduced blinking; botulinum toxin for blepharospasm/eyelid-opening apraxia. Pseudobulbar affect: SSRI.</li>
      <li>Cholinesterase inhibitors not shown to help and may worsen gait. Early goals of care (median survival about 6–8 years from onset).</li></ul>`)}
    ${sec("cbs", "Corticobasal syndrome", `<ul class="small">
      <li><b>No disease-modifying treatment.</b> Levodopa trial for rigidity (usually little effect).</li>
      <li>Myoclonus: levetiracetam or clonazepam (caution: sedation, falls). Painful dystonia: botulinum toxin.</li>
      <li>OT for apraxia and alien limb safety; PT; SLP for aphasia/dysphagia.</li>
      <li><b>If amyloid-positive</b>, treat as Alzheimer disease (cholinesterase inhibitor). Early goals of care.</li></ul>`)}
    ${sec("msa", "Multiple system atrophy", `<ul class="small">
      <li><b>Orthostatic hypotension</b>: stop or reduce alpha-blockers (tamsulosin), diuretics, nitrates and other BP-lowering drugs; head-up bed tilt, 2–2.5 L fluid and extra salt, abdominal binder/compression, small low-carbohydrate meals. Drugs: midodrine (daytime only, last dose ≥4 h before bed), fludrocortisone, pyridostigmine. Watch for supine hypertension.</li>
      <li><b>Bladder</b>: check post-void residual; intermittent catheterization if retention; antimuscarinics only with caution (prefer trospium/mirabegron — less CNS effect).</li>
      <li><b>Parkinsonism</b>: levodopa trial up to ~1000 mg/day (about a third respond early; may worsen orthostasis).</li>
      <li><b>Stridor / sleep breathing</b>: sleep study, CPAP; discuss tracheostomy. RBD: melatonin.</li>
      <li>Cognition usually spared — involve the patient fully in decisions. Early goals of care (median survival about 6–10 years).</li></ul>`)}
    ${sec("hd", "Huntington disease", `<ul class="small">
      <li><b>Chorea</b> (treat only if disabling): tetrabenazine (start 12.5 mg daily, titrate slowly; can cause depression, suicidality, parkinsonism — avoid if depressed or suicidal; CYP2D6) <i>or</i> an antipsychotic (olanzapine, risperidone, aripiprazole), preferred when psychosis or irritability coexist.</li>
      <li><b>Mood and behaviour</b>: SSRI for depression, irritability and obsessions; suicide risk assessment every contact; mood stabilizer for severe irritability (specialist).</li>
      <li>High-calorie diet (weight loss is common), SLP for dysphagia, PT/OT, falls prevention.</li>
      <li>Genetic counselling for at-risk relatives; advance care planning while capacity allows; HD clinic and Huntington Society of Canada.</li></ul>`)}
    ${sec("als", "ALS / ALS-FTD", `<ul class="small">
      <li><b>Riluzole</b> 50 mg BID (modest survival benefit; check LFTs and CBC). Edaravone and gene-targeted therapy (SOD1-ALS) are specialist decisions.</li>
      <li><b>Breathing</b>: non-invasive ventilation (BiPAP) for orthopnea, FVC &lt;50–80%, or nocturnal hypoventilation/raised CO2 — improves survival and quality of life. Avoid high-flow oxygen alone in hypercapnia.</li>
      <li><b>Nutrition</b>: early feeding-tube (PEG/RIG) discussion, ideally before FVC &lt;50%; SLP texture advice. Sialorrhea: glycopyrrolate, botulinum toxin; pseudobulbar affect: SSRI.</li>
      <li><b>FTD component</b>: behaviour strategies, SSRI/trazodone; impaired insight affects capacity and adherence to NIV/PEG — involve substitute decision-maker early.</li>
      <li>ALS clinic (multidisciplinary care improves survival), ALS Society of BC, early and repeated goals-of-care conversations.</li></ul>`)}
    ${sec("alc", "Alcohol-related / Korsakoff", `<ul class="small">
      <li><b>Thiamine</b>: IV high dose if Wernicke suspected (e.g. 500 mg IV TID × 3 days, then 250 mg daily), otherwise oral thiamine; give before glucose.</li>
      <li>Abstinence support (naltrexone/acamprosate if appropriate), nutrition, re-test cognition after months of abstinence.</li></ul>`)}
    ${sec("dep", "Depression contributing", `<p class="small">SSRI (sertraline, escitalopram/citalopram — check QTc), behavioural activation; avoid TCAs and paroxetine (anticholinergic). Re-test cognition once mood improves.</p>`)}
    </div>

    <div class="card"><h2>Dementia drug dosing (Canadian products)</h2>
      <table>
        <tr><th>Drug</th><th>Start</th><th>Titrate</th><th>Target / max</th><th>Key cautions</th></tr>
        <tr><td>Donepezil</td><td>5 mg qHS (or AM if vivid dreams)</td><td>after 4–6 weeks</td><td>10 mg daily</td><td>Bradycardia, syncope, GI, weight loss, insomnia/dreams, urinary incontinence</td></tr>
        <tr><td>Rivastigmine patch</td><td>4.6 mg/24 h</td><td>after ≥4 weeks</td><td>9.5 mg/24 h (13.3 mg max)</td><td>Fewer GI effects than capsules; rotate site; restart at 4.6 if off &gt;3 days</td></tr>
        <tr><td>Rivastigmine capsule</td><td>1.5 mg BID with food</td><td>by 1.5 mg BID every 2–4 weeks</td><td>3–6 mg BID</td><td>Nausea/vomiting, weight loss</td></tr>
        <tr><td>Galantamine ER</td><td>8 mg daily with breakfast</td><td>every 4 weeks</td><td>16–24 mg daily</td><td>Avoid if CrCl &lt;9 or severe hepatic impairment; max 16 mg if moderate renal/hepatic</td></tr>
        <tr><td>Memantine</td><td>5 mg daily</td><td>by 5 mg weekly</td><td>10 mg BID (20 mg/day)</td><td>Dizziness, confusion, constipation; CrCl &lt;30: max 5 mg BID</td></tr>
      </table>
      <p class="small muted">All ChEIs: check HR/ECG first, warn about GI effects, stop or reduce if HR &lt;50, syncope or weight loss. Switching between ChEIs is reasonable if one is not tolerated. Check current product monographs and BC PharmaCare coverage (Special Authority may apply).</p>
    </div>`;
}

const REF = [
  ["Alzheimer disease", "~60–70%", "Insidious, gradually progressive memory loss (learning new information); later language, visuospatial, executive. Atypical: logopenic aphasia, posterior cortical atrophy, dysexecutive.", "Often normal early; anosognosia; apraxia later. Head-turning sign.", "Medial temporal/hippocampal + parietal atrophy; amyloid PET/CSF/p-tau217 positive", "ChEI, memantine; anti-amyloid mAb in early AD (specialist)"],
  ["Vascular", "~15–20% (often mixed)", "Abrupt or stepwise after stroke, or gradual with small-vessel disease; slowed thinking, executive dysfunction, apathy, depression; memory relatively spared early.", "Focal signs, pseudobulbar affect, small-stepped gait, early urinary symptoms.", "Infarcts, lacunes, white-matter hyperintensities", "Vascular risk control; ChEI/memantine modest"],
  ["Dementia with Lewy bodies", "~5–10%", "Fluctuating attention/alertness, recurrent visual hallucinations, REM sleep behaviour disorder, parkinsonism; attention and visuospatial deficits more than memory early.", "Parkinsonism, orthostatic hypotension, falls, neuroleptic sensitivity.", "Relative preservation of medial temporal lobes; reduced DaT-SPECT uptake; PSG REM sleep without atonia", "ChEI (good response); avoid antipsychotics; levodopa, melatonin"],
  ["Parkinson disease dementia", "~30–80% of people with PD over time", "Dementia ≥1 year after established PD motor symptoms; executive, attention, visuospatial; hallucinations.", "Established PD signs.", "As DLB", "Rivastigmine; simplify PD drugs"],
  ["Frontotemporal (bvFTD)", "Common under 65", "Early change in personality/behaviour: disinhibition, apathy, loss of empathy, compulsions, hyperorality, executive dysfunction; memory relatively spared; poor insight.", "Frontal release signs; may have ALS signs.", "Frontal/anterior temporal atrophy; FDG-PET hypometabolism", "No ChEI; SSRIs/trazodone; supports"],
  ["Primary progressive aphasia", "Rare", "Language first: semantic (loses word meaning), non-fluent (agrammatic, effortful), logopenic (word-finding pauses, poor repetition → AD).", "Language exam.", "Left anterior temporal / fronto-insular / temporoparietal atrophy", "Speech therapy; treat logopenic as AD"],
  ["Normal pressure hydrocephalus", "Uncommon, treatable", "Gait disturbance first (magnetic, wide-based), then urinary urgency/incontinence and slowed cognition.", "Gait apraxia.", "Ventriculomegaly (Evans >0.3), DESH", "Tap test → VP shunt"],
  ["Creutzfeldt–Jakob / rapidly progressive", "Rare", "Decline over weeks–months; myoclonus, ataxia, visual and behavioural change.", "Myoclonus, startle, ataxia, pyramidal/extrapyramidal signs.", "DWI cortical ribboning, caudate/putamen; EEG PSWCs; CSF RT-QuIC", "Supportive; exclude autoimmune/treatable causes"],
  ["Progressive supranuclear palsy (PSP)", "Uncommon; age 60s+", "Early falls (backwards), slowed thinking, apathy, executive problems, dysarthria/dysphagia.", "Vertical supranuclear gaze palsy (downgaze), slow vertical saccades, axial rigidity, surprised stare, applause sign; little tremor.", "Midbrain atrophy (hummingbird), low midbrain/pons ratio", "Supportive; levodopa trial; falls and swallow care"],
  ["Corticobasal syndrome (CBS)", "Rare", "Asymmetric clumsy, stiff limb; apraxia; alien limb; non-fluent speech; executive and visuospatial deficits; memory relatively spared early.", "Asymmetric rigidity, dystonia, myoclonus, cortical sensory loss.", "Asymmetric frontoparietal atrophy; amyloid testing (≈¼ are AD)", "Supportive; levodopa trial; myoclonus/dystonia treatment; treat as AD if amyloid+"],
  ["Multiple system atrophy (MSA)", "Rare; age 50s–60s", "Autonomic failure (fainting on standing, bladder, erectile dysfunction) plus parkinsonism (MSA-P) or ataxia (MSA-C); RBD, stridor. Cognition usually spared.", "Orthostatic hypotension, poor levodopa response, cerebellar signs, antecollis, stridor.", "Hot cross bun sign, putaminal rim, pontine/MCP atrophy", "Orthostatic hypotension and bladder care; levodopa trial; CPAP/airway"],
  ["Huntington disease", "Rare; onset 30–50", "Chorea, psychiatric change (depression, irritability, OCD, psychosis; high suicide risk), slowed executive dementia; autosomal dominant.", "Chorea, motor impersistence, slowed saccades, dysarthria.", "Caudate atrophy (boxcar ventricles); HTT CAG ≥40", "Tetrabenazine or antipsychotic for chorea; SSRI; suicide screening; genetic counselling"],
  ["ALS (Lou Gehrig disease) / ALS-FTD", "Rare; ~15% of ALS meet FTD criteria, ~50% have some cognitive/behavioural change", "Progressive weakness, cramps, dysarthria, dysphagia, breathlessness/orthopnea; behaviour change as in bvFTD.", "Upper + lower motor neuron signs: wasting, fasciculations (incl. tongue), brisk reflexes, Babinski.", "EMG denervation; MRI to exclude mimics; C9orf72", "Riluzole, NIV, feeding tube, ALS clinic, early goals of care"],
  ["Alcohol-related / Korsakoff", "Variable", "Amnesia with confabulation; executive problems; history of heavy alcohol use or malnutrition.", "Ataxia, nystagmus, neuropathy.", "Atrophy; mamillary bodies", "Thiamine, abstinence"],
  ["Reversible contributors", "—", "B12 deficiency, hypothyroidism, hypercalcemia, hyponatremia, hypoglycemia, medications, depression, sleep apnea, subdural hematoma, neurosyphilis, HIV.", "Depends on cause.", "CT/MRI for structural causes", "Treat cause; re-test"]
];
function renderRef() {
  $("#tab-ref").innerHTML = `<div class="card"><h2>Types of dementia — symptoms, signs, tests, treatment</h2>
    <table><tr><th>Type</th><th>Share</th><th>Symptoms</th><th>Signs</th><th>Imaging / biomarkers</th><th>Treatment</th></tr>
    ${REF.map(r => `<tr>${r.map((c, i) => `<td class="${i ? "small" : ""}">${i ? esc(c) : `<b>${esc(c)}</b>`}</td>`).join("")}</tr>`).join("")}</table></div>
    <div class="card"><h2>Delirium vs dementia vs depression</h2>
    <table><tr><th></th><th>Delirium</th><th>Dementia</th><th>Depression</th></tr>
      <tr><td>Onset</td><td>Hours–days</td><td>Months–years (except vascular / RPD)</td><td>Weeks–months</td></tr>
      <tr><td>Attention</td><td>Impaired, fluctuating</td><td>Usually normal early (not DLB)</td><td>Poor effort, “don't know” answers</td></tr>
      <tr><td>Consciousness</td><td>Altered</td><td>Clear</td><td>Clear</td></tr>
      <tr><td>Course</td><td>Fluctuates; usually reversible</td><td>Progressive</td><td>Improves with treatment</td></tr>
      <tr><td>Test</td><td>CAM, 4AT</td><td>MoCA, MMSE, Mini-Cog + function</td><td>PHQ-9, GDS</td></tr></table></div>
    <div class="card"><h2>Sources</h2><ul class="small">
      <li>Ismail Z et al. Recommendations of the 5th Canadian Consensus Conference on the diagnosis and treatment of dementia (CCCDTD5). Alzheimer's Dement 2020.</li>
      <li>McKeith IG et al. Diagnosis and management of dementia with Lewy bodies: fourth consensus report. Neurology 2017.</li>
      <li>Rascovsky K et al. Sensitivity of revised diagnostic criteria for bvFTD. Brain 2011. Gorno-Tempini ML et al. Classification of PPA. Neurology 2011.</li>
      <li>Sachdev P et al. VASCOG criteria for vascular cognitive disorders. Alzheimer Dis Assoc Disord 2014.</li>
      <li>Emre M et al. Clinical diagnostic criteria for dementia associated with Parkinson's disease. Mov Disord 2007.</li>
      <li>Höglinger GU et al. MDS clinical diagnostic criteria for PSP. Mov Disord 2017. Armstrong MJ et al. Criteria for corticobasal degeneration. Neurology 2013.</li>
      <li>Wenning GK et al. MDS criteria for the diagnosis of multiple system atrophy. Mov Disord 2022.</li>
      <li>Shefner JM et al. Gold Coast criteria for ALS. Clin Neurophysiol 2020. Strong MJ et al. ALS-FTSD revised criteria. ALS Frontotemporal Degener 2017.</li>
      <li>Health Canada: lecanemab (Leqembi) NOC/c Oct 2025; donanemab (Kisunla) May 2026. Plasma p-tau217 available in Canada through LifeLabs/Dynacare.</li>
      <li>American Geriatrics Society 2023 Beers Criteria.</li></ul></div>`;
}

function buildNote() {
  const R = evaluate().filter(r => r.lvl >= 2);
  const mh = medHits().filter(m => /anticholinergic|Benzo|Opioid|Antipsychotic|Dopamine|Other CNS/.test(m.cls));
  const missing = LABS.filter(l => l.core && !L(l.id)).map(l => l.label);
  const abn = LABS.filter(l => L(l.id) && ["warn", "bad"].includes(labFlag(l.id, L(l.id)).cls)).map(l => `${l.label} ${L(l.id).value} ${L(l.id).unit}`);
  const lines = [];
  lines.push("COGNITIVE IMPAIRMENT – ASSESSMENT");
  if (on("acute")) lines.push("Delirium present this admission; dementia diagnosis deferred until recovered. Collateral suggests pre-existing cognitive decline.");
  const hx = [on("gradual") && "gradual progression", on("stepwise") && "stepwise course", on("rapid") && "rapid progression", on("amnestic") && "memory-led", on("iadl") && "loss of independence in IADLs"].filter(Boolean);
  if (hx.length) lines.push("History: " + hx.join(", ") + ".");
  const cg = cogInterp(); if (cg.length) lines.push("Testing: " + cg.join("; ") + ".");
  lines.push("Stage: " + stageText() + ".");
  if (R.length) lines.push("Most consistent with: " + R.map(r => `${r.name} (${r.why.join(", ")})`).join("; ") + ".");
  if (S.imaging.length) lines.push("Imaging: " + S.imaging[0].title + " " + fmtDate(S.imaging[0].date) + (on("svd") ? " – small-vessel change" : "") + (on("mta") ? " – medial temporal atrophy" : "") + (on("vent") ? " – ventriculomegaly" : "") + ".");
  if (abn.length) lines.push("Abnormal bloods: " + abn.join(", ") + ".");
  lines.push("");
  lines.push("PLAN");
  if (on("acute")) lines.push("- Delirium bundle: treat precipitant, reorientation, sleep, mobility, glasses/hearing aids; avoid sedatives.");
  if (missing.length) lines.push("- Bloods: " + missing.join(", ") + ".");
  if (!S.imaging.length) lines.push("- CT head (or MRI brain).");
  if (mh.length) lines.push("- Deprescribe/review: " + mh.flatMap(m => m.meds).join(", ") + ".");
  R.slice(0, 2).forEach(r => r.next.slice(0, 2).forEach(n => lines.push("- " + n)));
  lines.push("- Formal cognitive testing after recovery (MoCA) with collateral; family physician / geriatrics follow-up.");
  lines.push("- Driving: advised not to drive pending assessment; RoadSafetyBC as required.");
  lines.push("- Discuss goals of care, substitute decision-maker; Alzheimer Society of BC First Link referral.");
  lines.push("[Decision: ________________________________]");
  return lines.join("\n");
}
function renderNote() {
  const el = $("#tab-note");
  if (!el.innerHTML) {
    el.innerHTML = `<div class="card"><h2>Assessment &amp; plan draft</h2>
      <p class="small muted">Edit freely, then copy into the PowerChart note. Regenerate rebuilds from the current checklist (overwrites edits).</p>
      <textarea id="noteBox"></textarea>
      <div class="row"><button class="btn" id="copyNote">Copy</button><button class="btn sec" id="regenNote">Regenerate</button><span id="copied" class="small muted"></span></div></div>`;
    $("#noteBox").addEventListener("input", () => S.noteEdited = true);
    $("#copyNote").onclick = async () => { const t = $("#noteBox"); t.select(); try { await navigator.clipboard.writeText(t.value); } catch { document.execCommand("copy"); } $("#copied").textContent = "Copied"; };
    $("#regenNote").onclick = () => { S.noteEdited = false; $("#noteBox").value = buildNote(); };
  }
  if (!S.noteEdited) $("#noteBox").value = buildNote();
}

function renderDerived() { renderOverview(); renderSubtype(); renderWorkup(); renderTreat(); renderNote(); }

/* ------------------------------------------------------------------ boot */
function wireTabs() {
  $("#tabs").addEventListener("click", e => {
    const b = e.target.closest("button[data-tab]"); if (!b) return;
    document.querySelectorAll("#tabs button").forEach(x => x.classList.toggle("active", x === b));
    document.querySelectorAll(".tab").forEach(t => t.classList.toggle("active", t.id === "tab-" + b.dataset.tab));
  });
}
(async function init() {
  wireTabs();
  const params = new URLSearchParams(location.search);
  try {
    if (params.has("demo") || typeof FHIR === "undefined" || (!params.has("code") && !params.has("state") && !sessionStorage.getItem("SMART_KEY"))) loadDemo(parseInt(params.get("demo"), 10) || 1);
    else await loadFHIR();
  } catch (e) {
    console.error(e);
    $("#loading").innerHTML = `<div class="banner bad">Could not read the chart: ${esc(e.message || e)}. Showing demo patient instead.</div>`;
    loadDemo();
  }
  preFill();
  renderHeader(); renderScreen(); renderRef(); renderDerived();
  if (!$("#loading .banner")) $("#loading").remove();
  document.addEventListener("change", e => {
    if (e.target.id === "demoPick") { const u = new URL(location.href); u.searchParams.set("demo", e.target.value); location.href = u.toString(); }
  });
})();
