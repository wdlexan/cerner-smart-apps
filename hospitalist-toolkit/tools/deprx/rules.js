/* Deprescribing tab - rules engine. Pure functions, no network. Works in the browser (window.DeprxRules) and in node (require).
   Sources (paraphrased, UNVERIFIED transcription written from general knowledge - check before clinical use):
   - AGS Beers Criteria 2023 (loaded from ../meds/beers-data.js when present)
   - STOPP/START v3 (O'Mahony et al., Eur Geriatr Med 2023) - paraphrased, criterion numbers not reproduced
   - STOPPFall (Seppala et al., Age Ageing 2021) - fall-risk-increasing drug classes
   - STOPPFrail v2 (Curtin et al., Age Ageing 2021) - limited life expectancy
   - Anticholinergic Cognitive Burden (ACB) scale, Aging Brain Care 2012 update
   - ThinkCascades (McCarthy et al., Drugs Aging 2022) and other common prescribing cascades
   - Kidney dosing from product monographs / Beers Table 6 (computed with Cockcroft-Gault CrCl when weight is known) */
(function () {
  const node = typeof module !== "undefined" && module.exports;

  // ---------------- drug classes (generic names; matched as whole words in the medication text) ----------------
  const CL = {
    ppi: { n: "PPI", d: ["omeprazole", "esomeprazole", "lansoprazole", "dexlansoprazole", "pantoprazole", "rabeprazole"] },
    h2: { n: "H2 blocker", d: ["famotidine", "ranitidine", "cimetidine", "nizatidine"] },
    benzo: { n: "Benzodiazepine", d: ["alprazolam", "bromazepam", "chlordiazepoxide", "clobazam", "clonazepam", "clorazepate", "diazepam", "flurazepam", "lorazepam", "midazolam", "nitrazepam", "oxazepam", "temazepam", "triazolam"] },
    zdrug: { n: "Z-drug", d: ["zopiclone", "eszopiclone", "zolpidem", "zaleplon"] },
    antipsych: { n: "Antipsychotic", d: ["aripiprazole", "brexpiprazole", "cariprazine", "chlorpromazine", "clozapine", "fluphenazine", "haloperidol", "loxapine", "lurasidone", "methotrimeprazine", "olanzapine", "paliperidone", "perphenazine", "pimavanserin", "quetiapine", "risperidone", "ziprasidone", "zuclopenthixol"] },
    tca: { n: "Tricyclic", d: ["amitriptyline", "clomipramine", "desipramine", "doxepin", "imipramine", "nortriptyline", "trimipramine", "protriptyline"] },
    ssri: { n: "SSRI", d: ["citalopram", "escitalopram", "fluoxetine", "fluvoxamine", "paroxetine", "sertraline"] },
    snri: { n: "SNRI", d: ["venlafaxine", "desvenlafaxine", "duloxetine", "levomilnacipran"] },
    mirt: { n: "Mirtazapine", d: ["mirtazapine"] },
    trazodone: { n: "Trazodone", d: ["trazodone"] },
    bupropion: { n: "Bupropion", d: ["bupropion"] },
    opioid: { n: "Opioid", d: ["buprenorphine", "codeine", "fentanyl", "hydrocodone", "hydromorphone", "meperidine", "methadone", "morphine", "oxycodone", "oxymorphone", "tapentadol", "tramadol"] },
    gaba: { n: "Gabapentinoid", d: ["gabapentin", "pregabalin"] },
    aed: { n: "Antiseizure", d: ["carbamazepine", "oxcarbazepine", "phenytoin", "valproate", "valproic", "divalproex", "lamotrigine", "levetiracetam", "topiramate", "lacosamide", "zonisamide", "phenobarbital", "primidone", "brivaracetam", "eslicarbazepine", "perampanel", "cenobamate"] },
    loop: { n: "Loop diuretic", d: ["furosemide", "bumetanide", "torsemide", "ethacrynic"] },
    thiazide: { n: "Thiazide", d: ["hydrochlorothiazide", "chlorthalidone", "indapamide", "metolazone"] },
    ksp: { n: "K-sparing diuretic / MRA", d: ["spironolactone", "eplerenone", "amiloride", "triamterene", "finerenone"] },
    acei: { n: "ACE inhibitor", d: ["benazepril", "captopril", "cilazapril", "enalapril", "fosinopril", "lisinopril", "perindopril", "quinapril", "ramipril", "trandolapril"] },
    arb: { n: "ARB", d: ["azilsartan", "candesartan", "eprosartan", "irbesartan", "losartan", "olmesartan", "telmisartan", "valsartan"] },
    arni: { n: "ARNI", d: ["sacubitril"] },
    ccb: { n: "Dihydropyridine CCB", d: ["amlodipine", "felodipine", "nifedipine", "nicardipine", "lercanidipine"] },
    ccbnd: { n: "Non-DHP CCB", d: ["diltiazem", "verapamil"] },
    bb: { n: "Beta-blocker", d: ["acebutolol", "atenolol", "bisoprolol", "carvedilol", "labetalol", "metoprolol", "nadolol", "nebivolol", "pindolol", "propranolol", "sotalol", "timolol"] },
    alpha1: { n: "Alpha-1 blocker (BP)", d: ["doxazosin", "prazosin", "terazosin"] },
    alphau: { n: "Alpha-1 blocker (prostate)", d: ["tamsulosin", "silodosin", "alfuzosin"] },
    central: { n: "Central antihypertensive", d: ["clonidine", "methyldopa", "guanfacine", "moxonidine"] },
    hydral: { n: "Hydralazine", d: ["hydralazine"] },
    nitrate: { n: "Nitrate", d: ["isosorbide", "nitroglycerin", "glyceryl trinitrate"] },
    statin: { n: "Statin", d: ["atorvastatin", "fluvastatin", "lovastatin", "pitavastatin", "pravastatin", "rosuvastatin", "simvastatin"] },
    ezetimibe: { n: "Ezetimibe", d: ["ezetimibe"] },
    antiplt: { n: "Antiplatelet", d: ["aspirin", "acetylsalicylic", "asa", "clopidogrel", "prasugrel", "ticagrelor", "dipyridamole", "ticlopidine"] },
    anticoag: { n: "Anticoagulant", d: ["warfarin", "apixaban", "rivaroxaban", "edoxaban", "dabigatran", "enoxaparin", "dalteparin", "tinzaparin", "heparin", "fondaparinux"] },
    nsaid: { n: "NSAID", d: ["celecoxib", "diclofenac", "diflunisal", "etodolac", "flurbiprofen", "ibuprofen", "indomethacin", "ketoprofen", "ketorolac", "meloxicam", "nabumetone", "naproxen", "oxaprozin", "piroxicam", "sulindac", "tenoxicam"] },
    steroid: { n: "Systemic steroid", d: ["prednisone", "prednisolone", "methylprednisolone", "dexamethasone", "hydrocortisone", "cortisone", "budesonide oral"] },
    su: { n: "Sulfonylurea", d: ["gliclazide", "glimepiride", "glipizide", "glyburide", "glibenclamide", "chlorpropamide", "tolbutamide"] },
    metformin: { n: "Metformin", d: ["metformin"] },
    insulin: { n: "Insulin", d: ["insulin", "glargine", "detemir", "degludec", "lispro", "aspart", "glulisine", "nph"] },
    dpp4: { n: "DPP-4 inhibitor", d: ["sitagliptin", "saxagliptin", "linagliptin", "alogliptin"] },
    sglt2: { n: "SGLT2 inhibitor", d: ["canagliflozin", "dapagliflozin", "empagliflozin", "ertugliflozin"] },
    glp1: { n: "GLP-1 / GIP agonist", d: ["semaglutide", "liraglutide", "dulaglutide", "exenatide", "lixisenatide", "tirzepatide"] },
    tzd: { n: "Thiazolidinedione", d: ["pioglitazone", "rosiglitazone"] },
    levo: { n: "Levothyroxine", d: ["levothyroxine", "liothyronine", "desiccated thyroid"] },
    urate: { n: "Urate-lowering", d: ["allopurinol", "febuxostat"] },
    colch: { n: "Colchicine", d: ["colchicine"] },
    bisphos: { n: "Bisphosphonate", d: ["alendronate", "risedronate", "zoledronic", "ibandronate", "etidronate", "pamidronate"] },
    denos: { n: "Denosumab", d: ["denosumab"] },
    boneana: { n: "Bone-building", d: ["teriparatide", "romosozumab", "abaloparatide", "raloxifene"] },
    vitd: { n: "Vitamin D", d: ["vitamin d", "cholecalciferol", "ergocalciferol", "calcitriol", "alfacalcidol"] },
    calcium: { n: "Calcium", d: ["calcium carbonate", "calcium citrate", "calcium supplement"] },
    iron: { n: "Iron", d: ["ferrous", "iron sucrose", "ferric", "iron polysaccharide", "feramax"] },
    b12: { n: "Vitamin B12", d: ["cyanocobalamin", "vitamin b12", "hydroxocobalamin"] },
    kcl: { n: "Potassium supplement", d: ["potassium chloride", "kcl", "potassium citrate", "k-dur", "slow-k"] },
    achei: { n: "Cholinesterase inhibitor", d: ["donepezil", "rivastigmine", "galantamine"] },
    memantine: { n: "Memantine", d: ["memantine"] },
    bladder: { n: "Bladder antimuscarinic", d: ["oxybutynin", "tolterodine", "solifenacin", "darifenacin", "fesoterodine", "trospium", "flavoxate"] },
    mirabeg: { n: "Beta-3 agonist", d: ["mirabegron", "vibegron"] },
    antihist: { n: "1st-generation antihistamine", d: ["diphenhydramine", "hydroxyzine", "dimenhydrinate", "chlorpheniramine", "promethazine", "meclizine", "cyproheptadine", "doxylamine", "brompheniramine", "clemastine", "triprolidine"] },
    smr: { n: "Muscle relaxant", d: ["cyclobenzaprine", "methocarbamol", "carisoprodol", "orphenadrine", "metaxalone", "chlorzoxazone"] },
    baclofen: { n: "Baclofen / tizanidine", d: ["baclofen", "tizanidine"] },
    metoclop: { n: "Dopamine-blocking antiemetic", d: ["metoclopramide", "prochlorperazine", "domperidone"] },
    digoxin: { n: "Digoxin", d: ["digoxin"] },
    amio: { n: "Amiodarone", d: ["amiodarone", "dronedarone"] },
    lithium: { n: "Lithium", d: ["lithium"] },
    levodopa: { n: "Levodopa / dopamine agonist", d: ["levodopa", "carbidopa", "pramipexole", "ropinirole", "rotigotine", "rasagiline", "selegiline", "amantadine"] },
    antiparkac: { n: "Anticholinergic antiparkinsonian", d: ["benztropine", "trihexyphenidyl", "procyclidine"] },
    spasm: { n: "GI antispasmodic", d: ["dicyclomine", "hyoscyamine", "scopolamine", "hyoscine", "clidinium", "belladonna"] },
    inhaler: { n: "Inhaler", d: ["salbutamol", "albuterol", "ipratropium", "tiotropium", "umeclidinium", "glycopyrronium", "aclidinium", "formoterol", "salmeterol", "vilanterol", "olodaterol", "fluticasone", "budesonide", "beclomethasone", "mometasone", "ciclesonide"] },
    laxative: { n: "Laxative", d: ["senna", "sennosides", "polyethylene glycol", "peg 3350", "macrogol", "lactulose", "bisacodyl", "docusate", "picosulfate", "magnesium hydroxide", "prucalopride", "naloxegol", "methylnaltrexone"] },
    ondans: { n: "5-HT3 antiemetic", d: ["ondansetron", "granisetron"] },
    tmpsmx: { n: "TMP-SMX", d: ["sulfamethoxazole", "trimethoprim"] },
    macrolide: { n: "Macrolide", d: ["azithromycin", "clarithromycin", "erythromycin"] },
    fq: { n: "Fluoroquinolone", d: ["ciprofloxacin", "levofloxacin", "moxifloxacin", "norfloxacin"] },
    nitrofur: { n: "Nitrofurantoin", d: ["nitrofurantoin"] },
    cough: { n: "Cough suppressant", d: ["dextromethorphan", "benzonatate"] },
    mtx: { n: "Methotrexate", d: ["methotrexate"] },
    melatonin: { n: "Melatonin", d: ["melatonin"] },
    mvi: { n: "Supplement", d: ["multivitamin", "omega-3", "fish oil", "glucosamine", "coenzyme q10", "ginkgo"] }
  };
  CL.antidep = { n: "Antidepressant", d: [...CL.tca.d, ...CL.ssri.d, ...CL.snri.d, ...CL.mirt.d, ...CL.trazodone.d, ...CL.bupropion.d] };
  CL.ras = { n: "RAS blocker", d: [...CL.acei.d, ...CL.arb.d, ...CL.arni.d] };
  CL.bpmed = { n: "BP-lowering", d: [...CL.acei.d, ...CL.arb.d, ...CL.arni.d, ...CL.ccb.d, ...CL.ccbnd.d, ...CL.bb.d, ...CL.alpha1.d, ...CL.central.d, ...CL.hydral.d, ...CL.thiazide.d, ...CL.loop.d, "spironolactone", "eplerenone"] };
  CL.hypo = { n: "Hypoglycemia-causing", d: [...CL.su.d, ...CL.insulin.d] };
  CL.dm = { n: "Diabetes drug", d: [...CL.su.d, ...CL.metformin.d, ...CL.insulin.d, ...CL.dpp4.d, ...CL.sglt2.d, ...CL.glp1.d, ...CL.tzd.d] };

  // Brand names common in BC / Canada (Beers ALIAS adds US brands when loaded)
  const ALIAS = { imovane: "zopiclone", ativan: "lorazepam", rivotril: "clonazepam", xanax: "alprazolam", valium: "diazepam", restoril: "temazepam", seroquel: "quetiapine", zyprexa: "olanzapine", risperdal: "risperidone", haldol: "haloperidol", abilify: "aripiprazole",
    celexa: "citalopram", cipralex: "escitalopram", zoloft: "sertraline", paxil: "paroxetine", prozac: "fluoxetine", effexor: "venlafaxine", cymbalta: "duloxetine", remeron: "mirtazapine", desyrel: "trazodone", wellbutrin: "bupropion", elavil: "amitriptyline",
    dilaudid: "hydromorphone", oxycontin: "oxycodone", percocet: "oxycodone", "oxy-ir": "oxycodone", "tylenol #3": "codeine", "tylenol 3": "codeine", tramacet: "tramadol", ultram: "tramadol", "ms contin": "morphine", statex: "morphine", "m-eslon": "morphine", suboxone: "buprenorphine",
    neurontin: "gabapentin", lyrica: "pregabalin", tegretol: "carbamazepine", dilantin: "phenytoin", epival: "divalproex", keppra: "levetiracetam", lamictal: "lamotrigine",
    lasix: "furosemide", aldactone: "spironolactone", inspra: "eplerenone", coversyl: "perindopril", altace: "ramipril", vasotec: "enalapril", zestril: "lisinopril", atacand: "candesartan", cozaar: "losartan", diovan: "valsartan", micardis: "telmisartan", entresto: "sacubitril",
    norvasc: "amlodipine", plendil: "felodipine", adalat: "nifedipine", cardizem: "diltiazem", tiazac: "diltiazem", isoptin: "verapamil", lopresor: "metoprolol", betaloc: "metoprolol", monocor: "bisoprolol", tenormin: "atenolol", coreg: "carvedilol", flomax: "tamsulosin", xatral: "alfuzosin", rapaflo: "silodosin", cardura: "doxazosin", hytrin: "terazosin", catapres: "clonidine",
    lipitor: "atorvastatin", crestor: "rosuvastatin", zocor: "simvastatin", ezetrol: "ezetimibe", plavix: "clopidogrel", brilinta: "ticagrelor", effient: "prasugrel", entrophen: "aspirin", asaphen: "aspirin", aggrenox: "dipyridamole aspirin",
    eliquis: "apixaban", xarelto: "rivaroxaban", pradaxa: "dabigatran", lixiana: "edoxaban", savaysa: "edoxaban", coumadin: "warfarin", lovenox: "enoxaparin", fragmin: "dalteparin", innohep: "tinzaparin",
    advil: "ibuprofen", motrin: "ibuprofen", aleve: "naproxen", naprosyn: "naproxen", "anaprox": "naproxen", mobicox: "meloxicam", celebrex: "celecoxib", voltaren: "diclofenac", arthrotec: "diclofenac", toradol: "ketorolac",
    diamicron: "gliclazide", glucophage: "metformin", glumetza: "metformin", januvia: "sitagliptin", janumet: "sitagliptin metformin", trajenta: "linagliptin", jardiance: "empagliflozin", synjardy: "empagliflozin metformin", forxiga: "dapagliflozin", invokana: "canagliflozin", ozempic: "semaglutide", rybelsus: "semaglutide", victoza: "liraglutide", trulicity: "dulaglutide", mounjaro: "tirzepatide",
    lantus: "glargine insulin", basaglar: "glargine insulin", toujeo: "glargine insulin", levemir: "detemir insulin", tresiba: "degludec insulin", humalog: "lispro insulin", novorapid: "aspart insulin", fiasp: "aspart insulin",
    synthroid: "levothyroxine", eltroxin: "levothyroxine", euthyrox: "levothyroxine", zyloprim: "allopurinol", uloric: "febuxostat", fosamax: "alendronate", actonel: "risedronate", aclasta: "zoledronic", prolia: "denosumab", forteo: "teriparatide", evenity: "romosozumab", "d-tabs": "vitamin d", "vitamin d3": "vitamin d",
    "palafer": "ferrous", aricept: "donepezil", exelon: "rivastigmine", reminyl: "galantamine", ebixa: "memantine", ditropan: "oxybutynin", detrol: "tolterodine", vesicare: "solifenacin", enablex: "darifenacin", toviaz: "fesoterodine", trosec: "trospium", myrbetriq: "mirabegron",
    gravol: "dimenhydrinate", benadryl: "diphenhydramine", atarax: "hydroxyzine", flexeril: "cyclobenzaprine", robaxin: "methocarbamol", lioresal: "baclofen", maxeran: "metoclopramide", reglan: "metoclopramide", stemetil: "prochlorperazine", motilium: "domperidone",
    lanoxin: "digoxin", toloxin: "digoxin", cordarone: "amiodarone", multaq: "dronedarone", sinemet: "levodopa carbidopa", prolopa: "levodopa", mirapex: "pramipexole", requip: "ropinirole", cogentin: "benztropine",
    tecta: "pantoprazole", pantoloc: "pantoprazole", losec: "omeprazole", nexium: "esomeprazole", prevacid: "lansoprazole", pariet: "rabeprazole", dexilant: "dexlansoprazole", pepcid: "famotidine",
    senokot: "senna", restoralax: "polyethylene glycol", lax: "polyethylene glycol", colace: "docusate", dulcolax: "bisacodyl", zofran: "ondansetron", septra: "sulfamethoxazole trimethoprim", bactrim: "sulfamethoxazole trimethoprim", macrobid: "nitrofurantoin", cipro: "ciprofloxacin",
    "slow-k": "potassium chloride", "k-dur": "potassium chloride", "micro-k": "potassium chloride", "vitamin b12": "cyanocobalamin" };

  // ---------------- Anticholinergic Cognitive Burden (ACB) scale (Aging Brain Care 2012 update; UNVERIFIED transcription) ----------------
  const ACB = {
    3: ["amitriptyline", "amoxapine", "atropine", "benztropine", "brompheniramine", "carbinoxamine", "chlorpheniramine", "chlorpromazine", "clemastine", "clomipramine", "clozapine", "darifenacin", "desipramine", "dicyclomine", "dimenhydrinate", "diphenhydramine", "doxepin", "doxylamine", "fesoterodine",
      "flavoxate", "hydroxyzine", "hyoscyamine", "imipramine", "meclizine", "nortriptyline", "olanzapine", "orphenadrine", "oxybutynin", "paroxetine", "perphenazine", "promethazine", "propantheline", "quetiapine", "scopolamine", "hyoscine", "solifenacin", "thioridazine", "tolterodine", "trifluoperazine", "trihexyphenidyl", "trimipramine", "trospium", "cyproheptadine", "procyclidine"],
    2: ["amantadine", "belladonna", "carbamazepine", "cyclobenzaprine", "loxapine", "meperidine", "methotrimeprazine", "molindone", "nefopam", "oxcarbazepine", "pimozide"],
    1: ["alprazolam", "aripiprazole", "asenapine", "atenolol", "bupropion", "captopril", "cetirizine", "chlorthalidone", "cimetidine", "clorazepate", "codeine", "colchicine", "desloratadine", "diazepam", "digoxin", "dipyridamole", "disopyramide", "fentanyl", "furosemide", "fluvoxamine", "haloperidol",
      "hydralazine", "hydrocortisone", "iloperidone", "isosorbide", "levocetirizine", "loperamide", "loratadine", "metoprolol", "morphine", "nifedipine", "paliperidone", "prednisone", "quinidine", "ranitidine", "risperidone", "theophylline", "trazodone", "triamterene", "venlafaxine", "warfarin", "mirtazapine", "tramadol"] };
  const ACB_ALT = {
    oxybutynin: "mirabegron, timed voiding, or stop if no clear benefit", tolterodine: "mirabegron or stop", solifenacin: "mirabegron or stop", darifenacin: "mirabegron or stop", fesoterodine: "mirabegron or stop", trospium: "mirabegron or stop",
    diphenhydramine: "for sleep: stop (sleep hygiene, CBT-I); for itch: cetirizine/loratadine or topical", hydroxyzine: "cetirizine or loratadine for itch; for anxiety: non-drug or SSRI", dimenhydrinate: "ondansetron (check QTc) or treat the cause", promethazine: "ondansetron (check QTc)", meclizine: "vestibular rehab; short courses only", chlorpheniramine: "loratadine/cetirizine",
    amitriptyline: "neuropathic pain: duloxetine or a low-dose gabapentinoid (kidney dose); low mood: sertraline", nortriptyline: "duloxetine, gabapentinoid", imipramine: "sertraline / escitalopram", doxepin: "≤6 mg for sleep is acceptable; otherwise stop", paroxetine: "sertraline or escitalopram (taper paroxetine slowly)",
    quetiapine: "if only for sleep: stop (taper); psychosis in Parkinson/Lewy: keep low dose", olanzapine: "lowest dose, review the indication; risperidone/aripiprazole have lower ACB", cyclobenzaprine: "stop; heat, physio, acetaminophen", benztropine: "review the cause of EPS (reduce the antipsychotic)", trihexyphenidyl: "review indication; avoid in dementia", dicyclomine: "stop if unclear benefit", hyoscyamine: "stop if unclear benefit", scopolamine: "glycopyrrolate for secretions at end of life (does not cross into the brain)", carbamazepine: "review indication; levetiracetam for seizures (kidney dose)" };

  // ---------------- QT-prolonging drugs (known risk / commonly used; CredibleMeds-style list, UNVERIFIED) ----------------
  const QT = ["citalopram", "escitalopram", "haloperidol", "quetiapine", "ziprasidone", "chlorpromazine", "methadone", "ondansetron", "domperidone", "amiodarone", "sotalol", "dronedarone", "azithromycin", "clarithromycin", "erythromycin", "ciprofloxacin", "levofloxacin", "moxifloxacin", "hydroxyzine",
    "donepezil", "fluconazole", "hydroxychloroquine", "methotrimeprazine", "olanzapine", "risperidone", "trazodone", "venlafaxine", "tamoxifen", "flecainide", "propafenone", "pentamidine", "tacrolimus", "promethazine", "prochlorperazine", "metoclopramide", "mirtazapine", "amitriptyline", "nortriptyline", "imipramine", "loperamide"];
  // SIADH / hyponatremia drugs
  const SIADH = [...CL.ssri.d, ...CL.snri.d, ...CL.tca.d, "mirtazapine", "carbamazepine", "oxcarbazepine", "eslicarbazepine", ...CL.thiazide.d, ...CL.antipsych.d, "tramadol", "desmopressin", "cyclophosphamide", "vincristine", "chlorpropamide", "valproate", "divalproex", "lamotrigine"];
  // drugs that raise potassium
  const KUP = [...CL.acei.d, ...CL.arb.d, ...CL.arni.d, ...CL.ksp.d, ...CL.kcl.d, "trimethoprim", "sulfamethoxazole", "heparin", "tacrolimus", "cyclosporine", "drospirenone"];
  // bradycardia drugs
  const BRADY = [...CL.bb.d, ...CL.ccbnd.d, "digoxin", "amiodarone", "dronedarone", "donepezil", "rivastigmine", "galantamine", "ivabradine", "clonidine"];

  // ---------------- indications (matched against the problem list) ----------------
  const IND = {
    ppi: /reflux|gerd|esophagitis|oesophagitis|barrett|ulcer|gi bleed|gastrointestinal (hemorrhage|haemorrhage|bleed)|upper gi|dyspepsia|zollinger|pylori|gastritis|melena|hematemesis|eosinophilic esoph|stricture|varices/i,
    h2: /reflux|gerd|esophagitis|ulcer|dyspepsia|gastritis|urticaria|allerg/i,
    benzo: /anxiety|panic|seizure|epilep|alcohol|withdrawal|rem sleep|spastic|palliat|end of life|catatonia|akathisia|status epilepticus/i,
    zdrug: /insomnia|sleep/i,
    antipsych: /schizo|bipolar|psychos|psychotic|delirium|delusion|hallucin|huntington|tourette|nausea|vomit|mania|schizoaffective|palliat/i,
    antidep: /depress|anxiety|panic|obsessive|ocd|ptsd|neuropath|chronic pain|insomnia|migraine|fibromyalgia|bipolar|hot flash|smoking|appetite|mood/i,
    opioid: /pain|fracture|cancer|malignan|metasta|neoplasm|carcinoma|lymphoma|myeloma|opioid use|opioid dependence|\boud\b|palliat|dyspnea|dyspnoea|post-?op|surgery|surgical|arthritis|osteoarth|wound|ulcer|trauma|cough/i,
    gaba: /neuropath|neuralgia|seizure|epilep|pain|restless leg|anxiety|pruritus|itch|hot flash|alcohol|fibromyalgia|radiculopathy|sciatica|spinal stenosis/i,
    aed: /seizure|epilep|bipolar|mood|neuropath|neuralgia|migraine|essential tremor/i,
    anticoag: /atrial fib|atrial flutter|\baf\b|\bafib\b|venous thromb|\bdvt\b|\bvte\b|pulmonary embol|\bpe\b|thrombo|mechanical (heart )?valve|valve replacement|mitral stenosis|lv thromb|antiphospholipid|embol|left atrial/i,
    antiplt: /coronary|\bcad\b|myocardial|\bmi\b|nstemi|stemi|angina|stent|\bpci\b|cabg|bypass|stroke|\btia\b|transient isch|peripheral arter|peripheral vasc|\bpad\b|\bpvd\b|carotid|ischemic heart|ischaemic heart|cerebrovasc|tavi|tavr|valve|acs\b|acute coronary|polycythemia|thrombocytosis/i,
    statin: /hyperlip|dyslipid|cholesterol|hypercholest|coronary|\bcad\b|myocard|stroke|\btia\b|peripheral arter|\bpad\b|diabet|ischemic|ischaemic|carotid|stent|cabg|familial|\bckd\b|chronic kidney/i,
    levo: /hypothyroid|thyroidectomy|thyroid cancer|hashimoto|goiter|goitre|myxedema|thyroiditis|radioactive iodine|\brai\b/i,
    urate: /gout|urate|uric|tophus|tophi|tumou?r lysis|nephrolith|kidney stone/i,
    colch: /gout|pericarditis|familial mediterranean|pseudogout|cppd|coronary|\bcad\b|behcet/i,
    loop: /heart failure|\bchf\b|\bhf\b|cardiomyopathy|edema|oedema|ascites|cirrhosis|\bckd\b|kidney disease|renal failure|nephrotic|pulmonary hypertension|fluid overload|hypercalc|hyperkal|pulmonary edema/i,
    thiazide: /hypertension|\bhtn\b|edema|oedema|heart failure|nephrolith|kidney stone|diabetes insipidus|hypercalciuria/i,
    ksp: /heart failure|\bchf\b|cardiomyopathy|ascites|cirrhosis|hyperaldost|conn|hypertension|\bhtn\b|hypokal|acne|hirsut|edema|nephropathy|\bckd\b/i,
    bp: /hypertension|\bhtn\b|heart failure|\bchf\b|cardiomyopathy|coronary|\bcad\b|myocard|angina|atrial fib|atrial flutter|tachycard|\bckd\b|kidney disease|proteinuria|albuminuria|diabet|stroke|\btia\b|migraine|tremor|raynaud|varices|portal hypert|pheochrom|aortic|aneurysm|arrhythm|\bsvt\b|hcm|hypertroph/i,
    alphau: /bph|benign prostat|prostatic|luts|lower urinary|urinary retention|retention of urine|nephrolith|kidney stone|ureter/i,
    digoxin: /atrial fib|atrial flutter|heart failure|cardiomyopathy/i,
    amio: /atrial fib|atrial flutter|ventricular tach|\bvt\b|ventricular fib|arrhythm|heart failure|cardiomyopathy|icd/i,
    achei: /dementia|alzheimer|lewy|cognitive impair|neurocognitive/i,
    bladder: /overactive bladder|\boab\b|incontinence|urgency|detrusor|bladder spasm|neurogenic bladder|frequency/i,
    metoclop: /gastroparesis|nausea|vomit|hiccup|ileus/i,
    antihist: /allerg|urticaria|pruritus|itch|vertigo|motion sick|nausea|anaphyl|angioedema|rhinitis/i,
    steroid: /asthma|copd|arthritis|polymyalgia|giant cell|lupus|\bsle\b|vasculitis|adrenal|addison|hypopituit|crohn|colitis|\bibd\b|transplant|sarcoid|nephrotic|myasthenia|cancer|lymphoma|myeloma|leukemia|metasta|edema|pneumonia|\bild\b|interstitial|dermatit|psoriasis|gout|autoimmune|hepatitis|multiple sclerosis|rheumat|pemphig|myositis|nausea|palliat|cord compression|hypercalc/i,
    dm: /diabet|\bdm\b|t2dm|t1dm|hyperglyc|prediabet|obesity|\bpcos\b/i,
    sglt2: /diabet|\bdm\b|t2dm|heart failure|\bchf\b|\bhf\b|cardiomyopathy|\bckd\b|chronic kidney|albuminuria|proteinuria/i,
    glp1: /diabet|\bdm\b|t2dm|obesity|overweight/i,
    bone: /osteopor|osteopenia|fragility|fracture|paget|bone metast|hypercalc|myeloma|low bone/i,
    vitd: /vitamin d|osteopor|osteopenia|fracture|hypocalc|hypoparathy|\bckd\b|kidney disease|malabsorp|falls?\b|rickets|osteomalacia/i,
    iron: /anemia|anaemia|iron def|\bckd\b|heart failure|blood loss|bleed|menorrhag/i,
    b12: /b12|pernicious|macrocyt|anemia|anaemia|neuropathy|gastrectomy|bariatric|malabsorp/i,
    kcl: /hypokal|low potassium/i,
    inhaler: /copd|asthma|emphysema|bronch|wheez|chronic obstructive|ild|interstitial/i,
    levodopa: /parkinson|restless leg|dystonia|extrapyramid|\beps\b|parkinsonism/i,
    antiparkac: /parkinson|dystonia|extrapyramid|\beps\b|tremor/i,
    lithium: /bipolar|mood|depress|schizoaffective/i,
    nsaid: /arthritis|gout|pain|pericarditis|dysmenorrh|ankylosing|spondyl|tendin|sprain|fracture|bursitis/i,
    smr: /spasm|back pain|spastic|multiple sclerosis|cerebral palsy|spinal|myofascial/i,
    baclofen: /spastic|multiple sclerosis|cerebral palsy|spinal cord|stroke|hiccup|alcohol/i,
    mirt: /depress|anxiety|insomnia|appetite|weight loss|nausea|pruritus/i,
    trazodone: /depress|insomnia|sleep|anxiety|agitation/i
  };
  // which classes get an indication check, and how loud
  const IND_CHECK = [
    ["ppi", "ppi", "amber"], ["h2", "h2", "info"], ["benzo", "benzo", "amber"], ["zdrug", "zdrug", "info"], ["antipsych", "antipsych", "amber"], ["tca", "antidep", "amber"], ["ssri", "antidep", "amber"], ["snri", "antidep", "amber"], ["mirt", "mirt", "info"], ["trazodone", "trazodone", "info"],
    ["opioid", "opioid", "amber"], ["gaba", "gaba", "amber"], ["aed", "aed", "info"], ["anticoag", "anticoag", "amber"], ["antiplt", "antiplt", "amber"], ["statin", "statin", "info"], ["ezetimibe", "statin", "info"], ["levo", "levo", "info"], ["urate", "urate", "info"], ["colch", "colch", "info"],
    ["loop", "loop", "amber"], ["thiazide", "thiazide", "info"], ["ksp", "ksp", "info"], ["acei", "bp", "info"], ["arb", "bp", "info"], ["ccb", "bp", "info"], ["ccbnd", "bp", "info"], ["bb", "bp", "info"], ["alpha1", "bp", "info"], ["central", "bp", "info"], ["hydral", "bp", "info"],
    ["alphau", "alphau", "info"], ["digoxin", "digoxin", "amber"], ["amio", "amio", "amber"], ["achei", "achei", "info"], ["memantine", "achei", "info"], ["bladder", "bladder", "info"], ["metoclop", "metoclop", "info"], ["antihist", "antihist", "amber"], ["steroid", "steroid", "amber"],
    ["su", "dm", "amber"], ["insulin", "dm", "info"], ["metformin", "dm", "info"], ["dpp4", "dm", "info"], ["sglt2", "sglt2", "info"], ["glp1", "glp1", "info"], ["tzd", "dm", "info"], ["bisphos", "bone", "info"], ["denos", "bone", "info"], ["iron", "iron", "info"], ["b12", "b12", "info"],
    ["kcl", "kcl", "info"], ["inhaler", "inhaler", "info"], ["levodopa", "levodopa", "info"], ["antiparkac", "antiparkac", "amber"], ["lithium", "lithium", "info"], ["nsaid", "nsaid", "amber"], ["smr", "smr", "amber"], ["baclofen", "baclofen", "info"], ["spasm", "metoclop", "info"]];

  // ---------------- how-to-stop guides (keys used by the How to stop tab) ----------------
  const GUIDE_OF = { ppi: "ppi", h2: "ppi", benzo: "bzra", zdrug: "bzra", antipsych: "ap", su: "ahg", insulin: "ahg", metformin: "ahg", dpp4: "ahg", sglt2: "ahg", glp1: "ahg", tzd: "ahg", achei: "chei", memantine: "chei",
    opioid: "opioid", gaba: "gaba", tca: "ad", ssri: "ad", snri: "ad", mirt: "ad", trazodone: "ad", bladder: "bladder", antihist: "achb", spasm: "achb", antiparkac: "achb", smr: "smr", baclofen: "smr", statin: "statin", ezetimibe: "statin",
    bisphos: "bone", denos: "bone", vitd: "bone", calcium: "bone", acei: "bp", arb: "bp", ccb: "bp", ccbnd: "bp", bb: "bp", alpha1: "bp", central: "bp", hydral: "bp", thiazide: "bp", loop: "loop", antiplt: "antiplt", anticoag: "anticoag", steroid: "steroid",
    nsaid: "nsaid", digoxin: "digoxin", aed: "aed", metoclop: "metoclop", levo: "levo", mvi: "supp", iron: "supp", b12: "supp", urate: "urate", alphau: "alphau" };

  // ---------------- matching helpers ----------------
  const rxCache = new Map();
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  function has(hay, name) { let rx = rxCache.get(name); if (!rx) { rx = new RegExp("(^|[^a-z])" + esc(name) + "([^a-z]|$)"); rxCache.set(name, rx); } return rx.test(hay); }
  function expand(text, extraAlias) {
    let hay = " " + String(text || "").toLowerCase() + " ";
    const add = (map) => { for (const [b, g] of Object.entries(map || {})) if (has(hay, b)) hay += " " + g + " "; };
    add(ALIAS); add(extraAlias);
    return hay;
  }
  const matchName = (m, names) => names.find((n) => has(m.hay, n));
  function classesOf(m) { return Object.keys(CL).filter((k) => !["antidep", "ras", "bpmed", "hypo", "dm"].includes(k) && CL[k].d.some((n) => has(m.hay, n))); }
  function acbOf(m) { for (const s of [3, 2, 1]) { const n = ACB[s].find((x) => has(m.hay, x)); if (n) return { score: s, name: n }; } return { score: 0, name: "" }; }
  function mgOf(text) { const t = String(text || "").toLowerCase().replace(/,/g, ""); const m = t.match(/(\d+(?:\.\d+)?)\s*(mg|mcg|microgram|µg|ug)\b/); if (!m) return null; let v = +m[1]; if (/mcg|microgram|µg|ug/.test(m[2])) v = v / 1000; return v; }
  function perDay(text) { const t = String(text || "").toLowerCase(); if (/\bqid\b|four times|q6h/.test(t)) return 4; if (/\btid\b|three times|q8h/.test(t)) return 3; if (/\bbid\b|twice|q12h/.test(t)) return 2; return 1; }

  // ---------------- kidney ----------------
  function crcl(age, sex, wtKg, crUmol) { if (age == null || !wtKg || !crUmol) return null; return Math.round(((140 - age) * wtKg * (sex === "female" ? 1.04 : 1.23)) / crUmol); }

  // ---------------- main analysis ----------------
  // ctx: { meds:[{i,label,sig,hay,prn,status}], probs:[text], age, sex, wt, ht, lab:{cr,egfr,k,na,mg,ca,a1c,tsh,inr,plt,hb,qtc}, vit:{sbpMin,hrMin}, f:{falls,cfs,goals,orthoDrop} , beers:{R_DRUG,R_COMBO,R_DIS} }
  function analyze(ctx) {
    const meds = ctx.meds || [], probs = ctx.probs || [], lab = ctx.lab || {}, vit = ctx.vit || {}, fx = ctx.f || {};
    const age = ctx.age, sex = ctx.sex, flags = [];
    meds.forEach((m) => { m.cls = m.cls || classesOf(m); m.acb = m.acb || acbOf(m); });
    const sched = meds.filter((m) => !m.prn);
    const on = (k, list) => (list || meds).filter((m) => CL[k].d.some((n) => has(m.hay, n)));
    const onAny = (names, list) => (list || meds).filter((m) => names.some((n) => has(m.hay, n)));
    const prob = (re) => probs.find((p) => re.test(p)) || "";
    const ids = (list) => list.map((m) => m.i);
    const nm = (list) => [...new Set(list.map((m) => m.label))].join(", ");
    const add = (g, level, title, text, list, src, data, cls) => flags.push({ g, level, title, text, meds: ids(list || []), src: [].concat(src || []), data: data || "", cls: cls || "" });

    const fallHx = fx.falls || !!prob(/\bfalls?\b|fall[- ]related|fell|fracture|syncope/i);
    const fractureHx = prob(/fracture.{0,30}(femur|hip|radius|humer|vertebra|wrist|pelvi|sacr)|(hip|femoral neck|vertebral|compression|fragility|wrist|pelvic|osteoporotic) fracture|intertrochanteric|subtrochanteric|osteoporo/i);
    const dementia = prob(/dementia|alzheimer|lewy|cognitive impair|neurocognitive/i), delirium = prob(/delirium|acute confus|encephalopathy/i), parkinson = prob(/parkinson/i);
    const hf = prob(/heart failure|\bchf\b|\bhfref\b|\bhfpef\b|cardiomyopathy|reduced ejection/i), ckdProb = prob(/\bckd\b|chronic kidney|renal insufficiency|dialysis|esrd/i);
    const ascvd = prob(IND.antiplt), af = prob(/atrial fib|atrial flutter|\bafib\b|\baf\b/i);
    const limited = fx.goals === "limited" || fx.goals === "palliative" || (fx.cfs != null && fx.cfs >= 7);
    const kd = { crcl: ctx.crcl != null ? ctx.crcl : crcl(age, sex, ctx.wt, lab.cr && lab.cr.v), egfr: lab.egfr ? lab.egfr.v : null };
    const kf = kd.crcl != null ? kd.crcl : kd.egfr; // value used for CrCl-based rules
    const kLabel = kd.crcl != null ? `CrCl ${kd.crcl} mL/min` : kd.egfr != null ? `eGFR ${kd.egfr} (no weight: eGFR used for CrCl)` : "";
    const eg = kd.egfr != null ? kd.egfr : kd.crcl;
    const egLabel = kd.egfr != null ? `eGFR ${kd.egfr}` : kd.crcl != null ? `CrCl ${kd.crcl}` : "";
    const v = (x) => (x ? x.v : null);

    // ===== Labs, ECG and vitals =====
    const K = v(lab.k), Na = v(lab.na), Qt = v(lab.qtc), Mg = v(lab.mg), Ca = v(lab.ca), A1c = v(lab.a1c), TSH = v(lab.tsh), INR = v(lab.inr), PLT = v(lab.plt);
    const kup = onAny(KUP, sched);
    if (K != null && K > 5.5 && kup.length) add("lab", "red", `Potassium ${K} on potassium-raising drugs`, `Hold or reduce: ${nm(kup)}. Repeat K and ECG.`, kup, "STOPP v3 (renal/CV) · general", `K ${K}`, "bp");
    else if (K != null && K > 5.0 && kup.length) add("lab", "amber", `Potassium ${K} on potassium-raising drugs`, `Review ${nm(kup)} (dose, need for K supplement, kidney function).`, kup, "general", `K ${K}`, "bp");
    const dig = on("digoxin");
    if (K != null && K < 3.5 && dig.length) add("lab", "red", `Low potassium (${K}) with digoxin`, "Hypokalemia increases digoxin toxicity: replace K and check a digoxin level.", dig, "general", `K ${K}`);
    const diur = on("loop", sched).concat(on("thiazide", sched)), ksup = on("kcl").concat(on("ksp")).concat(on("ras"));
    if (K != null && K < 3.5 && diur.length && !ksup.length) add("lab", "amber", `Low potassium (${K}) on a diuretic`, `Diuretic without K replacement or K-sparing drug: ${nm(diur)}.`, diur, "general", `K ${K}`, "loop");
    const siadh = onAny(SIADH, sched);
    if (Na != null && Na < 130 && siadh.length) add("lab", Na < 125 ? "red" : "amber", `Sodium ${Na} on drugs that can cause hyponatremia`, `Consider holding or switching: ${nm(siadh)}.`, siadh, "Beers 2023 Table 4 · STOPP v3", `Na ${Na}`, siadh.some((m) => m.cls.includes("thiazide")) ? "bp" : "ad");
    const thz = on("thiazide", sched);
    if (Na != null && Na < 130 && thz.length) add("lab", "red", "Thiazide with hyponatremia", `Stop or hold ${nm(thz)} (STOPP: thiazide with Na <130).`, thz, "STOPP v3 (CV)", `Na ${Na}`, "bp");
    if (Ca != null && Ca > 2.65 && (thz.length || on("calcium").length || on("vitd").length)) add("lab", "amber", `Calcium ${Ca} on calcium-raising drugs`, `Review ${nm(thz.concat(on("calcium"), on("vitd")))}.`, thz.concat(on("calcium"), on("vitd")), "STOPP v3", `Ca ${Ca}`);
    const qt = onAny(QT);
    const qtLim = sex === "female" ? 470 : 450;
    if (Qt != null && Qt >= 500 && qt.length) add("lab", "red", `QTc ${Qt} ms on QT-prolonging drugs`, `Stop or switch where possible: ${nm(qt)}. Check K and Mg.`, qt, "STOPP v3 · CredibleMeds-type list", `QTc ${Qt}`);
    else if (Qt != null && Qt > qtLim && qt.length) add("lab", "amber", `QTc ${Qt} ms on QT-prolonging drugs`, `Review ${nm(qt)}; avoid adding more. Keep K >4 and Mg >0.8.`, qt, "STOPP v3", `QTc ${Qt}`);
    else if (qt.length >= 2) add("lab", Qt == null ? "amber" : "info", `${qt.length} QT-prolonging drugs`, `${nm(qt)}. ${Qt == null ? "No QTc found: get an ECG." : `Latest QTc ${Qt} ms.`}`, qt, "STOPP v3", Qt == null ? "no QTc" : `QTc ${Qt}`);
    const cit = qt.filter((m) => /citalopram/.test(m.hay) && !/escitalopram/.test(m.hay) && (mgOf(m.label + " " + m.sig) || 0) > 20 && age >= 60);
    if (cit.length) add("lab", "amber", "Citalopram above 20 mg/day at age ≥60", "Health Canada max for age >65 is 20 mg/day (QT).", cit, "Health Canada advisory", `age ${age}`, "ad");
    const ppis = on("ppi", sched);
    if (Mg != null && Mg < 0.7 && ppis.length) add("lab", "amber", `Low magnesium (${Mg}) on a PPI`, "Long-term PPIs cause hypomagnesemia: review the need.", ppis, "general", `Mg ${Mg}`, "ppi");
    const hypo = on("su", sched).concat(on("insulin", sched));
    if (A1c != null && hypo.length && ((age >= 65 && A1c < 7.0) || (limited && A1c < 8.0))) add("lab", A1c < 6.5 ? "red" : "amber", `HbA1c ${A1c}% on insulin/sulfonylurea${age >= 65 ? " at age " + age : ""}`, `Likely over-treated for this patient: de-intensify ${nm(hypo)} (target 7.1–8.5% for frail older adults).`, hypo, "Diabetes Canada (frail elderly) · deprescribing.org antihyperglycemic algorithm", `HbA1c ${A1c}`, "ahg");
    const levo = on("levo", sched);
    if (TSH != null && TSH < 0.1 && levo.length) add("lab", "amber", `TSH ${TSH} on thyroid replacement`, "Over-replacement raises AF and fracture risk: reduce the dose unless thyroid cancer suppression is intended.", levo, "general", `TSH ${TSH}`, "levo");
    const warf = onAny(["warfarin"]);
    if (INR != null && INR > 4 && warf.length) add("lab", "red", `INR ${INR} on warfarin`, "Hold warfarin; look for interacting drugs (antibiotics, amiodarone).", warf, "general", `INR ${INR}`, "anticoag");
    const brady = onAny(BRADY, sched);
    if (vit.hrMin != null && vit.hrMin < 50 && brady.length) add("lab", "amber", `Heart rate ${vit.hrMin} on rate-slowing drugs`, `Review ${nm(brady)}.`, brady, "STOPP v3 (CV)", `HR ${vit.hrMin}`, "bp");
    const bpm = onAny(CL.bpmed.d, sched);
    if (vit.sbpMin != null && vit.sbpMin < 100 && bpm.length >= 1) add("lab", bpm.length >= 2 ? "amber" : "info", `Systolic BP down to ${vit.sbpMin} on ${bpm.length} BP-lowering drug${bpm.length > 1 ? "s" : ""}`, `Consider holding or reducing: ${nm(bpm)}${hf ? " (heart failure: reduce diuretic/other drugs before GDMT where possible)" : ""}.`, bpm, "STOPP v3 · STOPPFall", `SBP ${vit.sbpMin}`, "bp");
    if (fx.orthoDrop != null && fx.orthoDrop >= 20 && bpm.length) add("falls", "amber", `Orthostatic drop ${fx.orthoDrop} mmHg`, `BP-lowering drugs: ${nm(bpm)}.`, bpm, "STOPPFall", `drop ${fx.orthoDrop}`, "bp");

    // ===== Bleeding =====
    const ac = on("anticoag"), apl = on("antiplt", sched), ns = on("nsaid", sched).filter((m) => !/topical|gel|cream|patch|ophth|eye/.test(m.hay));
    const acFull = ac.filter((m) => !isProphylaxis(m));
    if (acFull.length >= 2 || (ac.length >= 2 && new Set(ac.map((m) => matchName(m, CL.anticoag.d))).size >= 2)) add("bleed", "red", "Two anticoagulants", `${nm(ac)}: duplicate anticoagulation (e.g. DOAC plus prophylactic heparin).`, ac, "STOPP v3 (duplication)", "", "anticoag");
    if (ac.length && apl.length) add("bleed", apl.length >= 2 ? "red" : "amber", `Anticoagulant + ${apl.length >= 2 ? "two antiplatelets (triple therapy)" : "antiplatelet"}`, `${nm(ac.concat(apl))}. ${apl.length >= 2 ? "Triple therapy is usually limited to weeks after a stent; confirm the plan and end date." : "Without a recent ACS/stent, the antiplatelet usually adds bleeding without benefit in stable CAD on an anticoagulant."}`, ac.concat(apl), "STOPP v3 (antithrombotic)", "", "antiplt");
    if ((ac.length || apl.length) && ns.length) add("bleed", "red", "NSAID with anticoagulant/antiplatelet", `${nm(ns)} with ${nm(ac.concat(apl))}: high GI bleed risk.`, ns.concat(ac, apl), "STOPP v3 · Beers 2023", "", "nsaid");
    if (!ac.length && apl.length >= 2) add("bleed", "info", "Dual antiplatelet therapy", `${nm(apl)}: confirm the stent/ACS date and the stop date (often 6–12 months).`, apl, "general", "", "antiplt");
    const ssr = on("ssri", sched).concat(on("snri", sched));
    if (ssr.length && (ac.length || apl.length) && !ppis.length) add("bleed", "info", "SSRI/SNRI with anticoagulant/antiplatelet, no PPI", "Higher GI bleed risk: consider gastroprotection or a different antidepressant.", ssr.concat(ac, apl), "general");
    if (PLT != null && PLT < 50 && (ac.length || apl.length)) add("bleed", "red", `Platelets ${PLT} on antithrombotics`, `Review ${nm(ac.concat(apl))}.`, ac.concat(apl), "general", `Plt ${PLT}`, "anticoag");
    if (ns.length && onAny(CL.ras.d, sched).length && diur.length) add("bleed", "red", "'Triple whammy': NSAID + ACEi/ARB + diuretic", "High risk of acute kidney injury: stop the NSAID.", ns.concat(onAny(CL.ras.d, sched), diur), "STOPP v3 (renal)", "", "nsaid");
    if (ns.length && on("steroid", sched).length && !ppis.length) add("bleed", "amber", "NSAID + steroid without gastroprotection", "Add a PPI or stop the NSAID.", ns.concat(on("steroid", sched)), "START v3 · Beers 2023", "", "nsaid");
    if (ns.length && (hf || (eg != null && eg < 50))) add("bleed", "amber", `NSAID with ${hf ? "heart failure" : egLabel}`, "NSAIDs worsen fluid retention and kidney function.", ns, "STOPP v3", hf || egLabel, "nsaid");
    // aspirin for primary prevention
    const asa = onAny(["aspirin", "acetylsalicylic", "asa"], sched);
    if (asa.length && !ascvd && !af && !prob(/polycythemia|thrombocyt|valve|kawasaki|essential thromb/i)) add("noind", "amber", "Aspirin without a vascular indication on the problem list", "For primary prevention, aspirin adds bleeding without net benefit in older adults: consider stopping if there is no CAD, stroke/TIA, PAD or stent.", asa, "Beers 2023 · STOPP v3 · ASPREE", "no CAD/stroke/PAD found", "antiplt");

    // ===== Kidney dose =====
    if (kf == null && eg == null) add("renal", "info", "No creatinine found", "Kidney dose checks were skipped. Enter creatinine and weight on the Kidney tab.", [], "", "");
    else {
      const rk = (list, level, title, text, src, cls, useEg) => { if (list.length) add("renal", level, title, text, list, src || "Product monograph · Beers 2023 Table 6", useEg ? egLabel : kLabel, cls); };
      const met = on("metformin", sched);
      if (eg != null && eg < 30) rk(met, "red", "Metformin with eGFR <30", "Stop metformin (lactic acidosis risk).", "Diabetes Canada · monograph", "ahg", true);
      else if (eg != null && eg < 45) rk(met.filter((m) => (mgOf(m.label + " " + m.sig) || 0) * perDay(m.label + " " + m.sig) > 1000), "amber", "Metformin dose with eGFR 30–44", "Maximum about 1,000 mg/day.", "Diabetes Canada", "ahg", true);
      if (kf != null && kf < 30) rk(ns, "red", "NSAID with CrCl <30", "Avoid.", "Beers 2023 Table 6 · STOPP v3", "nsaid");
      const dab = onAny(["dabigatran"]); if (kf != null && kf < 30) rk(dab, "red", "Dabigatran with CrCl <30", "Contraindicated: switch (apixaban is usually preferred).", "", "anticoag"); else if (kf != null && kf <= 50) rk(dab, "amber", "Dabigatran with CrCl 30–50", "Consider 110 mg BID (age ≥80, bleeding risk) or switching.", "", "anticoag");
      const riv = onAny(["rivaroxaban"]); if (kf != null && kf < 15) rk(riv, "red", "Rivaroxaban with CrCl <15", "Avoid.", "", "anticoag"); else if (kf != null && kf <= 50) rk(riv.filter((m) => (mgOf(m.label + " " + m.sig) || 20) > 15), "amber", "Rivaroxaban with CrCl 15–50", "For AF the dose is 15 mg daily with food.", "", "anticoag");
      const edo = onAny(["edoxaban"]); if (kf != null && kf < 15) rk(edo, "red", "Edoxaban with CrCl <15", "Avoid.", "", "anticoag"); else if (kf != null && kf <= 50) rk(edo.filter((m) => (mgOf(m.label + " " + m.sig) || 60) > 30), "amber", "Edoxaban with CrCl 15–50", "Dose is 30 mg daily.", "", "anticoag"); else if (kf != null && kf > 95) rk(edo, "info", "Edoxaban with CrCl >95", "Less effective for AF at high CrCl (monograph caution).", "", "anticoag");
      const enox = onAny(["enoxaparin"]); if (kf != null && kf < 30) rk(enox, "amber", "Enoxaparin with CrCl <30", "Reduce: prophylaxis 30 mg daily; treatment 1 mg/kg once daily (or switch to UFH).", "", "anticoag");
      const fon = onAny(["fondaparinux"]); if (kf != null && kf < 30) rk(fon, "red", "Fondaparinux with CrCl <30", "Avoid.", "", "anticoag");
      const gab = on("gaba", sched); if (kf != null && kf < 30) rk(gab, "amber", "Gabapentin/pregabalin with CrCl <30", "Reduce dose markedly (e.g. gabapentin ≤300 mg/day; pregabalin 25–75 mg/day): sedation and falls.", "", "gaba"); else if (kf != null && kf < 60) rk(gab, "info", "Gabapentin/pregabalin with CrCl 30–59", "Reduce dose (about half).", "", "gaba");
      const kspl = on("ksp", sched); if (kf != null && kf < 30) rk(kspl, "red", "K-sparing diuretic / MRA with CrCl <30", "Avoid (hyperkalemia).", "Beers 2023 · STOPP v3", "bp");
      const nit = on("nitrofur"); if (kf != null && kf < 30) rk(nit, "amber", "Nitrofurantoin with CrCl <30", "Avoid: ineffective and toxic. Choose another antibiotic.", "Beers 2023 Table 2/6");
      const tmp = on("tmpsmx"); if (kf != null && kf < 30) rk(tmp, "amber", "TMP-SMX with CrCl <30", "Reduce dose (15–29) or avoid (<15); watch potassium.", "Beers 2023 Table 6");
      const fqs = on("fq"); if (kf != null && kf < 50) rk(fqs, "info", `Fluoroquinolone with ${kLabel}`, "Adjust dose; tendon, QT and delirium risk in older adults.");
      if (eg != null && eg < 30) rk(dig.filter((m) => (mgOf(m.label + " " + m.sig) || 0) > 0.125), "amber", "Digoxin >125 mcg/day with eGFR <30", "Reduce the dose and check a level.", "STOPP v3 · Beers 2023", "digoxin", true);
      const col = on("colch"); if (kf != null && kf < 30) rk(col, "amber", "Colchicine with CrCl <30", "Reduce dose; avoid with strong CYP3A4/P-gp inhibitors.", "Beers 2023 Table 6");
      const allo = onAny(["allopurinol"], sched); if (eg != null && eg < 30) rk(allo.filter((m) => (mgOf(m.label + " " + m.sig) || 0) > 100), "info", "Allopurinol >100 mg with eGFR <30", "Start low (50–100 mg) and titrate to urate; higher maintenance doses are OK if tolerated.", "ACR gout guideline", "urate", true);
      const sit = onAny(["sitagliptin"], sched); if (eg != null && eg < 30) rk(sit.filter((m) => (mgOf(m.label + " " + m.sig) || 100) > 25), "amber", "Sitagliptin with eGFR <30", "Dose is 25 mg daily.", "monograph", "ahg", true); else if (eg != null && eg < 45) rk(sit.filter((m) => (mgOf(m.label + " " + m.sig) || 100) > 50), "amber", "Sitagliptin with eGFR 30–44", "Dose is 50 mg daily.", "monograph", "ahg", true);
      const gly = onAny(["glyburide", "glibenclamide"], sched); if (eg != null && eg < 60) rk(gly, "red", "Glyburide with reduced kidney function", "Prolonged hypoglycemia: stop or switch to gliclazide / a non-hypoglycemic agent.", "Beers 2023 · Diabetes Canada", "ahg", true);
      const sus = on("su", sched).filter((m) => !/glyburide|glibenclamide/.test(m.hay)); if (eg != null && eg < 30) rk(sus, "amber", "Sulfonylurea with eGFR <30", "High hypoglycemia risk; consider stopping.", "Diabetes Canada", "ahg", true);
      const mor = onAny(["morphine", "codeine", "tramadol", "meperidine"], sched); if (eg != null && eg < 30) rk(mor, "amber", "Morphine / codeine / tramadol with eGFR <30", "Active metabolites build up (sedation, seizures with tramadol): low-dose hydromorphone is usually preferred.", "general · Beers 2023", "opioid", true);
      const bac = onAny(["baclofen"], sched); if (eg != null && eg < 60) rk(bac, "amber", "Baclofen with eGFR <60", "Avoid or use the lowest dose: encephalopathy risk.", "Beers 2023 Table 6", "smr", true);
      const lev = onAny(["levetiracetam"], sched); if (kf != null && kf <= 50) rk(lev, "info", "Levetiracetam with reduced CrCl", "Reduce dose (e.g. 250–750 mg BID at CrCl 30–50).", "monograph", "aed");
      const h2 = on("h2", sched); if (kf != null && kf < 50) rk(h2, "info", "H2 blocker with CrCl <50", "Halve the dose (confusion).", "Beers 2023 Table 6", "ppi");
      const li = on("lithium", sched); if (eg != null && eg < 60) rk(li, "amber", "Lithium with eGFR <60", "Check level; involve psychiatry about the dose or alternatives.", "general", "", true);
      const bis = onAny(["alendronate", "risedronate", "zoledronic", "ibandronate"], sched); if (eg != null && eg < 35) rk(bis, "amber", "Bisphosphonate with eGFR <35", "Avoid (alendronate/risedronate below 30–35; zoledronic acid below 35).", "STOPP v3 · monograph", "bone", true);
      const mtx = on("mtx", sched); if (eg != null && eg < 30) rk(mtx, "red", "Methotrexate with eGFR <30", "Avoid.", "STOPP v3", "", true);
      const duloxe = onAny(["duloxetine"], sched); if (kf != null && kf < 30) rk(duloxe, "amber", "Duloxetine with CrCl <30", "Avoid.", "Beers 2023 Table 6", "ad");
      // apixaban dose check (AF: 2.5 mg BID if 2 of age ≥80, weight ≤60 kg, Cr ≥133 µmol/L)
      const api = onAny(["apixaban"]);
      if (api.length) {
        const crv = lab.cr ? lab.cr.v : null, n = [age >= 80, ctx.wt != null && ctx.wt <= 60, crv != null && crv >= 133].filter(Boolean).length;
        const dose = mgOf(api[0].label + " " + api[0].sig), unknown = ctx.wt == null || crv == null;
        const why = `age ${age}${ctx.wt != null ? `, weight ${ctx.wt} kg` : ", no weight"}${crv != null ? `, Cr ${crv}` : ", no Cr"}`;
        if (dose === 5 && n >= 2) add("renal", "amber", "Apixaban 5 mg BID but 2 dose-reduction criteria met", "For AF the dose is 2.5 mg BID when 2 of: age ≥80, weight ≤60 kg, Cr ≥133. (VTE treatment doses differ.)", api, "Product monograph", why, "anticoag");
        else if (dose === 2.5 && n < 2 && !unknown && (af || !prob(IND.anticoag))) add("renal", "amber", "Apixaban 2.5 mg BID: possible under-dosing", "For AF, fewer than 2 dose-reduction criteria are met; 5 mg BID may be indicated (unless VTE extended prevention or another reason).", api, "Product monograph", why, "anticoag");
        if (kf != null && kf < 15) add("renal", "amber", "Apixaban with CrCl <15", "Limited data: discuss with nephrology/hematology.", api, "Product monograph", kLabel, "anticoag");
      }
    }

    // ===== Falls (STOPPFall) =====
    const FRID = [["benzo", "Benzodiazepine"], ["zdrug", "Z-drug"], ["antipsych", "Antipsychotic"], ["opioid", "Opioid"], ["tca", "Antidepressant"], ["ssri", "Antidepressant"], ["snri", "Antidepressant"], ["mirt", "Antidepressant"], ["trazodone", "Antidepressant"],
      ["aed", "Antiseizure"], ["gaba", "Gabapentinoid"], ["loop", "Diuretic"], ["thiazide", "Diuretic"], ["alpha1", "Alpha-blocker for BP"], ["alphau", "Alpha-blocker for prostate"], ["central", "Central antihypertensive"], ["nitrate", "Vasodilator"], ["antihist", "Sedating antihistamine"], ["bladder", "Bladder antimuscarinic"], ["smr", "Muscle relaxant"], ["baclofen", "Muscle relaxant"]];
    const fr = []; FRID.forEach(([k, n]) => on(k).forEach((m) => { if (!fr.some((x) => x.m === m)) fr.push({ m, n, k }); }));
    if (fallHx && fr.length) {
      fr.forEach(({ m, n, k }) => add("falls", ["benzo", "zdrug", "antipsych", "antihist", "smr"].includes(k) ? "red" : "amber", `${n} after a fall: ${m.label}`, STOPPFALL_TXT[k] || "Fall-risk-increasing drug: reduce or stop if possible.", [m], "STOPPFall", fx.falls ? "fell (ticked)" : prob(/\bfalls?\b|fall[- ]related|fell|fracture|syncope/i), GUIDE_OF[k] || ""));
    } else if (fr.length && age >= 65) add("falls", fr.length >= 3 ? "amber" : "info", `${fr.length} fall-risk-increasing drug${fr.length > 1 ? "s" : ""}`, `${nm(fr.map((x) => x.m))}. No fall on the problem list: tick "fell" on the Falls tab if they did.`, fr.map((x) => x.m), "STOPPFall", `age ${age}`);
    const hypoF = hypo.filter((m) => fallHx && age >= 65);
    if (hypoF.length) add("falls", "amber", "Insulin/sulfonylurea after a fall", "Hypoglycemia causes falls: check glucose lows and consider de-intensifying.", hypoF, "STOPP v3 · Diabetes Canada", "", "ahg");

    // ===== Sedation, delirium and confusion =====
    const bz = on("benzo", sched).concat(on("zdrug", sched)), bzAll = on("benzo").concat(on("zdrug")), op = on("opioid", sched), opAll = on("opioid"), gb = on("gaba", sched);
    if (age >= 65 && bzAll.length) add("cns", (delirium || dementia || fallHx || prob(/copd|respiratory failure|sleep apnea|osa\b/i)) ? "red" : "amber", "Benzodiazepine / Z-drug at age ≥65", `${nm(bzAll)}: cognitive impairment, delirium, falls and fractures. Taper if taken ≥4 weeks; stop if short-term.${delirium || dementia ? " Delirium/dementia on the problem list." : ""}`, bzAll, "Beers 2023 · STOPP v3", delirium || dementia || "", "bzra");
    if (bzAll.length && opAll.length) add("cns", "red", "Opioid + benzodiazepine / Z-drug", "Respiratory depression and overdose risk.", bzAll.concat(opAll), "Beers 2023 Table 5 · STOPP v3", "", "opioid");
    if (gb.length && opAll.length) add("cns", "amber", "Opioid + gabapentinoid", "Sedation and respiratory depression: use the lowest doses or stop one.", gb.concat(opAll), "Beers 2023 Table 5", "", "gaba");
    const ap = on("antipsych", sched).concat(on("antipsych").filter((m) => m.prn));
    if (ap.length && dementia && !prob(/schizo|bipolar|psychos|lewy|parkinson/i)) add("cns", "amber", "Antipsychotic in dementia", `${nm(ap)}: higher stroke and death risk. Use only for severe distress or danger; reassess at 4–12 weeks and taper.`, ap, "Beers 2023 · STOPP v3 · deprescribing.org antipsychotic algorithm", dementia, "ap");
    const apPark = ap.filter((m) => !/quetiapine|clozapine|pimavanserin/.test(m.hay));
    if (apPark.length && parkinson) add("cns", "red", "Antipsychotic (not quetiapine/clozapine) in Parkinson disease", "Worsens parkinsonism: switch or stop.", apPark, "Beers 2023 · STOPP v3", parkinson, "ap");
    const mcp = on("metoclop"); if (mcp.length && (parkinson || prob(/lewy/i))) add("cns", "red", "Metoclopramide/prochlorperazine in Parkinson / Lewy body", "Use domperidone (check QTc) or ondansetron instead.", mcp, "Beers 2023 · STOPP v3", parkinson || "Lewy", "metoclop");
    const cns = meds.filter((m) => !m.prn && m.cls.some((k) => ["benzo", "zdrug", "antipsych", "tca", "ssri", "snri", "mirt", "trazodone", "opioid", "gaba", "aed", "smr", "baclofen", "antihist"].includes(k)));
    if (cns.length >= 3) add("cns", "amber", `${cns.length} CNS-active drugs`, `${nm(cns)}: falls and confusion. Aim for the fewest.`, cns, "Beers 2023 Table 5", "");
    const ster = on("steroid", sched); if (ster.length && delirium) add("cns", "info", "Steroid with delirium", "Lowest dose and shortest course.", ster, "Beers 2023 Table 3", delirium, "steroid");
    const stim = onAny(["bupropion", "theophylline"], sched); if (stim.length && prob(/seizure|epilep/i)) add("cns", "amber", "Seizure-threshold-lowering drug with epilepsy", `${nm(stim)}.`, stim, "STOPP v3");
    const tram = onAny(["tramadol"], sched); if (tram.length && (ssr.length || on("tca").length || on("mirt").length)) add("cns", "amber", "Tramadol + serotonergic antidepressant", "Serotonin syndrome and seizures risk; also hyponatremia.", tram.concat(ssr, on("tca"), on("mirt")), "general", "", "opioid");

    // ===== Anticholinergic load =====
    const achbMeds = meds.filter((m) => m.acb.score > 0), acbTotal = achbMeds.reduce((s, m) => s + m.acb.score, 0);
    if (acbTotal >= 3) add("achb", (dementia || delirium) ? "red" : "amber", `Anticholinergic burden score ${acbTotal}`, `Score ≥3 is linked to confusion, falls and higher mortality. Biggest contributors: ${nm(achbMeds.filter((m) => m.acb.score >= 2)) || nm(achbMeds)}.${dementia || delirium ? " Dementia/delirium on the problem list." : ""} See the Anticholinergic tab for swaps.`, achbMeds.filter((m) => m.acb.score >= 2).length ? achbMeds.filter((m) => m.acb.score >= 2) : achbMeds, "ACB scale (2012) · Beers 2023 Table 7", `ACB ${acbTotal}`, "achb");
    const strong = achbMeds.filter((m) => m.acb.score === 3);
    if (strong.length && (dementia || delirium)) add("achb", "red", "Strong anticholinergic with dementia/delirium", `${nm(strong)}.`, strong, "Beers 2023 Table 3 · STOPP v3", dementia || delirium, "achb");
    const urRet = prob(/urinary retention|retention of urine|bph|prostatic hyperplasia/i);
    if (strong.length && urRet && sex === "male") add("achb", "amber", "Strong anticholinergic with urinary retention/BPH", `${nm(strong)}.`, strong, "Beers 2023 · STOPP v3", urRet, "achb");
    const glauc = prob(/angle[- ]closure|narrow angle/i); if (strong.length && glauc) add("achb", "red", "Anticholinergic with narrow-angle glaucoma", `${nm(strong)}.`, strong, "STOPP v3", glauc, "achb");
    const cons = prob(/constipation/i); if (strong.length && cons) add("achb", "info", "Anticholinergic with constipation", `${nm(strong)} worsen constipation.`, strong, "STOPP v3", cons, "achb");

    // ===== Prescribing cascades =====
    const loopL = on("loop", sched), ccbL = on("ccb", sched);
    if (ccbL.length && (loopL.length || thz.length) && !hf && !prob(/ascites|cirrhosis|nephrotic|ckd|kidney disease/i)) add("cascade", "amber", "Calcium-channel blocker → diuretic (ankle swelling?)", `If the diuretic was started for ankle edema from ${nm(ccbL)}, reduce/stop the CCB instead of adding a diuretic.`, ccbL.concat(loopL, thz), "ThinkCascades", "no heart failure found", "loop");
    if (gb.length && loopL.length && !hf && !prob(/ascites|cirrhosis|nephrotic|kidney/i)) add("cascade", "amber", "Gabapentinoid → loop diuretic (edema?)", "Gabapentin/pregabalin cause peripheral edema; check why the diuretic was started.", gb.concat(loopL), "ThinkCascades", "", "gaba");
    const apMcp = ap.concat(mcp), park = on("antiparkac").concat(onAny(["levodopa", "carbidopa", "amantadine"]));
    if (apMcp.length && park.length && !parkinson) add("cascade", "amber", "Antipsychotic / metoclopramide → antiparkinsonian drug", `${nm(park)} may be treating drug-induced parkinsonism from ${nm(apMcp)}: reduce the cause.`, apMcp.concat(park), "ThinkCascades", "", "ap");
    const chei = on("achei"), bl = on("bladder");
    if (chei.length && bl.length) add("cascade", "amber", "Cholinesterase inhibitor → bladder antimuscarinic", `${nm(bl)} may be treating incontinence caused by ${nm(chei)}, and the two work against each other.`, chei.concat(bl), "ThinkCascades · Beers 2023", "", "bladder");
    const gout = on("urate").concat(on("colch")); if (gout.length && (thz.length || loopL.length)) add("cascade", "info", "Diuretic → gout treatment", "Thiazide/loop diuretics raise urate: if the gout started after the diuretic, consider switching the diuretic (e.g. losartan for BP).", gout.concat(thz, loopL), "ThinkCascades", "", "urate");
    const cough = on("cough").concat(onAny(["codeine"])); if (on("acei").length && cough.length) add("cascade", "info", "ACE inhibitor → cough medicine", "ACE inhibitor cough: switch to an ARB rather than treating the cough.", on("acei").concat(cough), "ThinkCascades", "", "bp");
    const nsBp = ns.length && onAny(CL.bpmed.d, sched).length >= 2; if (nsBp) add("cascade", "info", "NSAID with several BP drugs", "NSAIDs raise BP: BP drugs may have been added because of the NSAID.", ns, "ThinkCascades");

    // ===== Duplicates and interactions =====
    const DUP = [["ppi", "PPIs"], ["antidep", "antidepressants"], ["benzo", "benzodiazepines"], ["zdrug", "Z-drugs"], ["antipsych", "antipsychotics"], ["nsaid", "NSAIDs"], ["statin", "statins"], ["bb", "beta-blockers"], ["antihist", "sedating antihistamines"], ["ras", "RAS blockers (ACEi/ARB/ARNI)"], ["su", "sulfonylureas"], ["bladder", "bladder antimuscarinics"], ["opioid", "long-acting/scheduled opioids"]];
    DUP.forEach(([k, n]) => { const l = on(k, sched); const distinct = new Set(l.map((m) => matchName(m, CL[k].d))); if (distinct.size >= 2) add("dup", k === "ras" ? "red" : "amber", `Two ${n}`, `${nm(l)}: same class twice.${k === "ras" ? " Dual RAS blockade: hyperkalemia and AKI." : ""}`, l, "STOPP v3 (duplication)", "", GUIDE_OF[k] || (k === "antidep" ? "ad" : "")); });
    const bbN = on("bb", sched), nd = on("ccbnd", sched); if (bbN.length && nd.length) add("dup", "amber", "Beta-blocker + verapamil/diltiazem", "Heart block and bradycardia risk.", bbN.concat(nd), "STOPP v3 (CV)", "", "bp");
    if (nd.length && hf && prob(/reduced ejection|hfref|systolic/i)) add("dup", "red", "Verapamil/diltiazem with HFrEF", "Worsens heart failure: stop.", nd, "Beers 2023 · STOPP v3", hf, "bp");
    const amio = on("amio"); if (amio.length && dig.length) add("dup", "amber", "Amiodarone + digoxin", "Amiodarone roughly doubles digoxin levels: halve digoxin and check a level.", amio.concat(dig), "general", "", "digoxin");
    if (amio.length && warf.length) add("dup", "amber", "Amiodarone + warfarin", "INR rises over weeks: monitor closely.", amio.concat(warf), "Beers 2023 Table 5", "", "anticoag");
    const clar = onAny(["clarithromycin", "erythromycin", "fluconazole", "ketoconazole", "itraconazole"]); const simv = onAny(["simvastatin", "lovastatin", "atorvastatin"]); if (clar.length && simv.length) add("dup", "amber", "Statin + CYP3A4 inhibitor", "Myopathy risk: hold the statin during the course.", clar.concat(simv), "general", "", "statin");
    const liRas = on("lithium").length && (onAny(CL.ras.d).length || loopL.length || thz.length || ns.length); if (liRas) add("dup", "amber", "Lithium + ACEi/ARB/diuretic/NSAID", "Lithium toxicity: check the level.", on("lithium").concat(onAny(CL.ras.d), loopL, thz, ns), "Beers 2023 Table 5", "");
    const phen = onAny(["phenytoin"]), tmpL = on("tmpsmx"); if (phen.length && tmpL.length) add("dup", "amber", "Phenytoin + TMP-SMX", "Phenytoin toxicity.", phen.concat(tmpL), "Beers 2023 Table 5");
    const tmpRas = tmpL.length && onAny(CL.ras.d).length && eg != null && eg < 60; if (tmpRas) add("dup", "amber", "TMP-SMX + ACEi/ARB with reduced kidney function", "Hyperkalemia: check K in 2–3 days or choose another antibiotic.", tmpL.concat(onAny(CL.ras.d)), "Beers 2023 Table 4", egLabel);

    // ===== No indication found =====
    IND_CHECK.forEach(([k, ik, level]) => {
      on(k, sched).forEach((m) => {
        if (k === "anticoag" && isProphylaxis(m)) return;
        if (flags.some((f) => f.g === "noind" && f.meds.includes(m.i))) return;
        const hit = prob(IND[ik]);
        if (hit) { (m.ind = m.ind || []).push(hit); return; }
        const co = coIndication(k, m, { on, sched, prob, lab });
        if (co) { (m.ind = m.ind || []).push(co); return; }
        m.noind = true;
        add("noind", level, `No indication found: ${m.label}`, `${CL[k].n}: nothing on the problem list matches. Problem lists are often incomplete, so confirm the reason (or stop it). ${NOIND_TIP[k] || ""}`.trim(), [m], "STOPP v3 (drug without indication)", "problem list checked", GUIDE_OF[k] || "");
      });
    });

    // ===== Limited life expectancy (STOPPFrail v2) =====
    if (limited) {
      const why = fx.goals === "palliative" ? "palliative goals" : fx.goals === "limited" ? "limited life expectancy (ticked)" : `CFS ${fx.cfs}`;
      const sf = (list, title, text, cls, level) => { if (list.length) add("frail", level || "amber", title, text, list, "STOPPFrail v2", why, cls); };
      sf(on("statin").concat(on("ezetimibe")), "Lipid-lowering drug", "Little benefit within the remaining time: consider stopping.", "statin");
      sf(asa.filter(() => !ascvd), "Aspirin for primary prevention", "Stop.", "antiplt");
      sf(on("bisphos").concat(on("calcium"), on("vitd")).filter((m) => !/calcitriol|alfacalcidol/.test(m.hay)), "Bone-protection drugs", "Benefit takes ≥1 year: consider stopping (do not stop denosumab without a plan).", "bone");
      sf(on("denos"), "Denosumab", "Stopping causes rebound vertebral fractures; in the last months of life it can usually be stopped – discuss with the prescriber.", "bone", "info");
      sf(hypo.filter(() => A1c == null || A1c < 8.5), "Tight diabetes control", "Aim to avoid hyperglycemic symptoms only; simplify insulin and stop sulfonylureas.", "ahg");
      sf(on("achei").concat(on("memantine")).filter(() => prob(/dementia|alzheimer/i)), "Dementia drugs", "In advanced dementia (no meaningful benefit): taper and stop.", "chei");
      sf(ppis.filter((m) => (mgOf(m.label + " " + m.sig) || 0) >= 40 || /esomeprazole|pantoprazole 40|omeprazole 40/.test(m.hay)), "Full-dose PPI", "Reduce to the lowest dose or stop unless symptoms or recent GI bleed.", "ppi");
      sf(onAny(CL.bpmed.d, sched).filter(() => vit.sbpMin == null || vit.sbpMin < 130), "BP-lowering drugs", "Relax BP targets: stop drugs that cause dizziness or low BP.", "bp", "info");
      sf(on("mvi").concat(on("b12").filter(() => !prob(IND.b12)), on("iron").filter(() => !prob(IND.iron))), "Supplements", "Stop unless clearly helping symptoms.", "supp");
      sf(on("alphau").filter(() => prob(/catheter|foley/i)), "Alpha-blocker with a long-term catheter", "No benefit with a catheter: stop.", "alphau");
      sf(on("bladder").filter(() => prob(/catheter|foley/i)), "Bladder drug with a long-term catheter", "Stop.", "bladder");
      sf(on("anticoag").filter((m) => fx.goals === "palliative" && !isProphylaxis(m)), "Anticoagulant at end of life", "Review: often stopped in the last weeks of life; discuss with the patient and family.", "anticoag", "info");
    }

    // ===== Possibly missing (START v3) =====
    const lax = on("laxative");
    const opSched = op;
    if (opSched.length && !lax.length) add("start", "amber", "Regular opioid without a laxative", "Add a stimulant/osmotic laxative (senna, PEG).", opSched, "START v3 · Beers", "", "opioid");
    const bone = on("bisphos").concat(on("denos"), on("boneana"));
    if (fractureHx && !bone.length && !limited) add("start", "amber", "Fragility/hip fracture without bone protection", "Start a bisphosphonate (zoledronic acid in hospital or alendronate) or denosumab if eGFR is low, with vitamin D; or refer to fracture liaison/osteoporosis clinic.", [], "START v3 · Osteoporosis Canada", fractureHx, "bone");
    if (fractureHx && !on("vitd").length && !limited) add("start", "info", "Fracture without vitamin D", "Vitamin D 800–2,000 IU daily (check 25-OH vitamin D if available).", [], "START v3", fractureHx, "bone");
    const prednHi = ster.filter((m) => /prednisone|prednisolone/.test(m.hay) && (mgOf(m.label + " " + m.sig) || 0) >= 7.5);
    if (prednHi.length && !bone.length && !limited) add("start", "info", "Prednisone ≥7.5 mg without bone protection", "If ≥3 months expected: add bone protection, calcium and vitamin D.", prednHi, "START v3", "", "steroid");
    if (af && !ac.length && !limited) add("start", "amber", "Atrial fibrillation without an anticoagulant", "Unless there is a documented reason (bleeding, falls are usually not a reason, patient choice), consider a DOAC. CHA₂DS₂-VASc / HAS-BLED on the Calculators tab.", [], "START v3", af, "anticoag");
    if (ascvd && !on("statin").length && age < 85 && !limited) add("start", "info", "Vascular disease without a statin", "Consider a statin unless end of life or intolerance.", [], "START v3", ascvd, "statin");
    if (prob(/copd|chronic obstructive|asthma/i) && !on("inhaler").length) add("start", "info", "COPD/asthma without an inhaler on the list", "Check home inhalers (often missed on admission med rec).", [], "START v3", prob(/copd|chronic obstructive|asthma/i));
    if (ac.length && warf.length === 0 && ns.length === 0 && apl.length && !ppis.length && age >= 65) add("start", "info", "Anticoagulant + antiplatelet without a PPI", "Consider gastroprotection while on both.", ac.concat(apl), "START v3 · ACC/ACG", "", "ppi");

    // ===== Beers 2023 (merged where they repeat a flag above) =====
    if (ctx.beers && age != null && age >= 65) beersMerge(ctx, meds, probs, sex, flags);

    flags.forEach((f, i) => (f.id = "f" + i));
    return { flags, acbTotal, achbMeds, frids: fr, kidney: kd, kLabel, egLabel, fallHx, limited, sched, why: { dementia, delirium, parkinson, hf, af, ascvd, fractureHx, ckd: ckdProb } };
  }

  function isProphylaxis(m) {
    const t = (m.label + " " + m.sig).toLowerCase(), mg = mgOf(t);
    if (/prophyla|dvt prevent|vte prevent/.test(t)) return true;
    if (/enoxaparin/.test(t) && mg != null && mg <= 40 && !/bid|q12/.test(t)) return true;
    if (/dalteparin/.test(t) && /5000|5,000|2500/.test(t)) return true;
    if (/tinzaparin/.test(t) && /4500|3500/.test(t)) return true;
    if (/heparin/.test(t) && !/enoxaparin|dalteparin|tinzaparin/.test(t) && /5000|5,000|7500/.test(t) && /subcut|sc\b|s\/c|subcutaneous|q8|q12|bid|tid/.test(t)) return true;
    if (/fondaparinux/.test(t) && mg === 2.5) return true;
    return false;
  }
  function coIndication(k, m, h) {
    const { on, sched } = h;
    if (k === "ppi" || k === "h2") {
      const ns = on("nsaid", sched), ster = on("steroid", sched), apl = on("antiplt", sched), ac = on("anticoag", sched);
      if (ns.length) return "gastroprotection with an NSAID";
      if (apl.length >= 2) return "gastroprotection with dual antiplatelets";
      if (ac.length && apl.length) return "gastroprotection with anticoagulant + antiplatelet";
      if (ster.length && (apl.length || ac.length)) return "gastroprotection with steroid + antithrombotic";
    }
    if (k === "kcl" && (on("loop", sched).length || on("thiazide", sched).length || (h.lab.k && h.lab.k.v < 3.5))) return "with a diuretic / low K";
    if (k === "loop" && on("ksp").length && h.prob(/ascites|cirrhosis/i)) return "ascites";
    if (k === "b12" && on("metformin").length) return "long-term metformin";
    if (k === "antipsych" && m.prn && h.prob(/nausea|delirium|agitation/i)) return "PRN";
    return "";
  }
  const STOPPFALL_TXT = {
    benzo: "Taper to stop (withdrawal: 10–25% every 2 weeks). Short-term inpatient use can usually just stop.", zdrug: "Stop, or taper if nightly for weeks. Sleep hygiene / CBT-I.", antipsych: "Reduce or stop unless schizophrenia/bipolar/psychosis; taper.", opioid: "Lowest dose that controls pain; regular acetaminophen first.",
    tca: "Switch or taper (TCAs: orthostasis + anticholinergic).", ssri: "Review need; taper if no current indication.", snri: "Review need; taper.", mirt: "Review need (sedation).", trazodone: "If only for sleep, taper and stop.",
    aed: "Do not stop if for seizures; review if for pain/mood.", gaba: "Reduce to the lowest dose (kidney dose); taper.", loop: "Check volume status and lying/standing BP; reduce if dry.", thiazide: "Review BP target; check Na.",
    alpha1: "Stop as an antihypertensive (orthostatic hypotension).", alphau: "Give at bedtime; consider stopping if catheter or no symptoms.", central: "Taper (rebound hypertension).", nitrate: "Review need; orthostasis.", antihist: "Stop.", bladder: "Stop or switch to mirabegron.", smr: "Stop.", baclofen: "Reduce slowly (withdrawal seizures if stopped abruptly)." };
  const NOIND_TIP = {
    ppi: "Often started in hospital for 'stress ulcer prophylaxis' and never stopped.", benzo: "Often a long-standing sleep aid.", antipsych: "Often started for delirium and never stopped.", anticoag: "Check the original reason and end date (e.g. 3–6 months after a provoked VTE).",
    antiplt: "Check for a stent date or vascular event.", opioid: "Check pain scores and the original reason (e.g. fracture now healed).", gaba: "Check for neuropathic pain.", loop: "Check for heart failure, edema, or a CCB/gabapentinoid cascade.", digoxin: "Check for AF/HF.", amio: "Check for AF/VT (thyroid, lung, liver toxicity).",
    steroid: "Check the reason and the taper plan.", su: "Check HbA1c and hypoglycemia.", antihist: "Sedating antihistamines are rarely needed.", nsaid: "Check the reason; acetaminophen first.", smr: "Rarely helpful.", antiparkac: "Check for drug-induced EPS." };

  // Beers flags are mapped to groups; if a flag above already covers the same medication(s) in that group, the Beers source is added to it instead of a new line.
  const BEERS_GROUP = [[/benzodiazepine|z-drug|nonbenzodiazepine|hypnotic|meprobamate|barbiturate/i, "cns"], [/antipsychotic/i, "cns"], [/opioid|gabapentinoid|cns-active/i, "cns"], [/anticholinergic|antihistamine|antispasmodic|antidepressants with strong|antiparkinsonian|muscle relaxant/i, "achb"],
    [/warfarin|rivaroxaban|dabigatran|aspirin|prasugrel|ticagrelor|nsaid|indomethacin|ketorolac|dipyridamole/i, "bleed"], [/siadh|hyponatremia|potassium|ras inhibitor|sulfamethoxazole|lithium|sglt2/i, "lab"], [/sulfonylurea|insulin|nitrofurantoin/i, "renal"],
    [/alpha-1|alpha-agonist|nifedipine|amiodarone|dronedarone|digoxin/i, "other"], [/proton-pump|metoclopramide|mineral oil|desmopressin|megestrol|estrogen|androgen|thyroid|growth hormone|ergoloid|2019 beers/i, "other"]];
  function beersMerge(ctx, meds, probs, sex, flags) {
    const B = ctx.beers, hit = (m, names, skip) => !(skip && skip.test(m.hay)) && names.some((n) => has(m.hay, n));
    const keyOf = (m, names) => names.find((n) => has(m.hay, n));
    const found = [];
    (B.R_DRUG || []).forEach((r) => { if (r.absent && meds.some((m) => hit(m, r.absent))) return; meds.filter((m) => hit(m, r.d, r.skip)).forEach((m) => found.push({ r, meds: [m], src: `Beers 2023 Table ${r.t}` })); });
    (B.R_COMBO || []).forEach((r) => {
      if (r.sex && r.sex !== sex) return;
      if (r.type === "count") { const ms = meds.filter((m) => hit(m, r.g)); if (new Set(ms.map((m) => keyOf(m, r.g))).size >= r.min) found.push({ r, meds: ms, src: "Beers 2023 Table 5" }); }
      else { const A = meds.filter((m) => hit(m, r.a)), Bm = meds.filter((m) => hit(m, r.b)); if (A.length && Bm.length) found.push({ r, meds: [...new Set(A.concat(Bm))], src: "Beers 2023 Table 5", sev: "avoid" }); }
    });
    (B.R_DIS || []).forEach((dz) => { if (dz.sex && dz.sex !== sex) return; const c = probs.find((p) => dz.re.test(p)); if (!c) return; dz.rules.forEach((r) => meds.filter((m) => hit(m, r.d, r.skip)).forEach((m) => found.push({ r: Object.assign({ title: dz.cond }, r), meds: [m], src: "Beers 2023 Table 3", cond: c, dz: dz.cond }))); });
    found.forEach((x) => {
      const t = x.r.title || "";
      let g = (BEERS_GROUP.find(([re]) => re.test(t)) || [0, "other"])[1];
      if (x.dz) g = /fall|fracture/i.test(x.dz) ? "falls" : /delirium|dementia|parkinson/i.test(x.dz) ? "cns" : "other";
      const ids = x.meds.map((m) => m.i);
      const open = (f) => !f.beersOnly && !["start", "frail"].includes(f.g);
      const same = (/cns-active/i.test(t) && flags.find((f) => /CNS-active/.test(f.title))) || flags.find((f) => f.g === g && ids.every((i) => f.meds.includes(i))) || flags.find((f) => open(f) && ids.every((i) => f.meds.includes(i)));
      if (same) { if (!same.src.some((y) => y.includes(x.src))) same.src.push(x.src); (same.beers = same.beers || []).push(x.r.rec); return; }
      const sev = x.sev || x.r.sev || "avoid";
      flags.push({ g, level: sev === "avoid" ? "amber" : "info", title: `${t}: ${[...new Set(x.meds.map((m) => m.label))].join(", ")}`, text: x.r.rec + (x.r.why ? ` (${x.r.why})` : ""), meds: ids, src: [x.src], data: x.cond || "", cls: "", beersOnly: true });
    });
  }

  const GROUPS = [
    ["lab", "Labs, ECG and vitals"], ["bleed", "Bleeding and kidney injury"], ["renal", "Kidney dose"], ["falls", "Fall risk (STOPPFall)"], ["cns", "Sedation, delirium and confusion"], ["achb", "Anticholinergic load"],
    ["cascade", "Prescribing cascades"], ["dup", "Duplicates and interactions"], ["noind", "No indication found"], ["frail", "Limited life expectancy (STOPPFrail)"], ["start", "Possibly missing (START)"], ["other", "Other Beers criteria"]];

  // ---------------- note ----------------
  function note(o) {
    const L = [];
    L.push(`MEDICATION REVIEW / DEPRESCRIBING (${o.date})`);
    L.push([o.pt, o.kidney, o.cfs ? `CFS ${o.cfs}` : "", o.goals].filter(Boolean).join(". ") + ".");
    L.push(`Active meds reviewed: ${o.nMeds} (${o.nSched} scheduled, ${o.nPrn} PRN). Anticholinergic burden score ${o.acb}.${o.frid ? ` Fall-risk drugs: ${o.frid}.` : ""}`);
    if (o.changes.length) { L.push(""); L.push("Changes:"); o.changes.forEach((c) => L.push(`- ${c}`)); }
    if (o.keep.length) { L.push(""); L.push("Reviewed, continue:"); o.keep.forEach((c) => L.push(`- ${c}`)); }
    if (o.flags.length) { L.push(""); L.push("Flags still to address:"); o.flags.forEach((c) => L.push(`- ${c}`)); }
    if (o.decision) { L.push(""); L.push(`Plan: ${o.decision}`); }
    L.push(""); L.push(`Discussed with: ${o.discussed || "___"}. Changes to be communicated to the family physician and community pharmacy in the discharge summary.`);
    L.push("Screened with Beers 2023, STOPP/START v3, STOPPFall, STOPPFrail and ACB scale (decision support; clinical judgment applied).");
    return L.join("\n");
  }

  const api = { CL, ALIAS, ACB, ACB_ALT, QT, IND, GUIDE_OF, GROUPS, analyze, crcl, expand, classesOf, acbOf, mgOf, isProphylaxis, note, has };
  if (node) module.exports = api; else window.DeprxRules = api;
})();
