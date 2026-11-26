/* Supplement interactions – common supplements vs prescription medications.
 * Hospitalist Toolkit tab. Rules engine + data (no DOM code here).
 * UNVERIFIED draft written from general knowledge (product monographs, NIH ODS fact sheets,
 * NCCIH, MSKCC About Herbs, Ang-Lee JAMA 2001 for pre-op timing). Curated, not exhaustive.
 * Verify with pharmacy and a licensed database (Natural Medicines, Lexicomp) before changing therapy.
 *
 * SUPPS entry: S(key, name, cls, terms[], {what, excl, tags, preop, ix:[...], cond:[...]})
 *   ix  : {g:[group keys], sev, title, why, todo, space}   sev may be a function (ctx) => sev
 *   cond: {when:(ctx)=>bool, sev, title, why, todo}
 *   tags: 'bleed' (adds bleeding risk), 'ss' (serotonergic), 'sed' (sedating), 'chel' (binds oral drugs)
 * GROUPS: drug classes matched by name/brand in the medication text.
 */
(function (root) {
  'use strict';

  // ---------------- drug groups (interaction partners) ----------------
  const GROUPS = {};
  function G(key, label, terms) { GROUPS[key] = { key, label, terms }; }
  G('warfarin', 'Warfarin', ['warfarin', 'coumadin', 'jantoven']);
  G('doac', 'DOAC', ['apixaban', 'eliquis', 'rivaroxaban', 'xarelto', 'edoxaban', 'lixiana', 'savaysa', 'dabigatran', 'pradaxa']);
  G('heparin', 'Heparin / LMWH', ['heparin', 'enoxaparin', 'lovenox', 'dalteparin', 'fragmin', 'tinzaparin', 'innohep', 'fondaparinux', 'arixtra']);
  G('antiplatelet', 'Antiplatelet', ['aspirin', 'asa', 'acetylsalicylic acid', 'entrophen', 'clopidogrel', 'plavix', 'ticagrelor', 'brilinta', 'prasugrel', 'effient', 'dipyridamole', 'aggrenox', 'cilostazol']);
  G('ticagrelor', 'Ticagrelor', ['ticagrelor', 'brilinta']);
  G('nsaid', 'NSAID', ['ibuprofen', 'advil', 'motrin', 'naproxen', 'aleve', 'naprosyn', 'diclofenac', 'voltaren', 'arthrotec', 'celecoxib', 'celebrex', 'meloxicam', 'mobicox', 'indomethacin', 'ketorolac', 'toradol', 'ketoprofen']);
  G('ss', 'Serotonergic drug', ['sertraline', 'zoloft', 'citalopram', 'celexa', 'escitalopram', 'cipralex', 'lexapro', 'fluoxetine', 'prozac', 'paroxetine', 'paxil', 'fluvoxamine', 'luvox', 'venlafaxine', 'effexor', 'desvenlafaxine', 'pristiq', 'duloxetine', 'cymbalta', 'vortioxetine', 'trintellix', 'vilazodone', 'clomipramine', 'imipramine', 'amitriptyline', 'trazodone', 'tramadol', 'tramacet', 'ultram', 'meperidine', 'demerol', 'pethidine', 'methadone', 'fentanyl', 'tapentadol', 'sumatriptan', 'rizatriptan', 'zolmitriptan', 'naratriptan', 'almotriptan', 'eletriptan', 'frovatriptan', 'lithium', 'buspirone', 'dextromethorphan', 'linezolid', 'methylene blue', 'methylthioninium']);
  G('maoi', 'MAOI', ['phenelzine', 'nardil', 'tranylcypromine', 'parnate', 'moclobemide', 'isocarboxazid', 'selegiline', 'rasagiline', 'azilect', 'safinamide', 'linezolid', 'zyvoxam', 'methylene blue', 'methylthioninium']);
  G('cni', 'Calcineurin inhibitor', ['tacrolimus', 'prograf', 'advagraf', 'envarsus', 'cyclosporine', 'ciclosporin', 'cyclosporin', 'neoral', 'sandimmune']);
  G('mtor', 'mTOR inhibitor', ['sirolimus', 'rapamune', 'everolimus', 'afinitor', 'certican', 'zortress']);
  G('mmf', 'Mycophenolate', ['mycophenolate', 'mycophenolic', 'cellcept', 'myfortic']);
  G('immuno', 'Immunosuppressant', ['azathioprine', 'imuran', 'belatacept', 'rituximab', 'abatacept', 'tofacitinib', 'upadacitinib', 'baricitinib', 'infliximab', 'adalimumab', 'etanercept', 'golimumab', 'certolizumab', 'cyclophosphamide', 'fingolimod', 'ocrelizumab', 'leflunomide', 'methotrexate', 'basiliximab', 'thymoglobulin']);
  G('hiv', 'HIV antiretroviral (CYP3A4/P-gp substrate)', ['ritonavir', 'norvir', 'cobicistat', 'darunavir', 'prezista', 'prezcobix', 'symtuza', 'atazanavir', 'reyataz', 'lopinavir', 'kaletra', 'saquinavir', 'nirmatrelvir', 'paxlovid', 'efavirenz', 'atripla', 'rilpivirine', 'edurant', 'complera', 'odefsey', 'juluca', 'doravirine', 'pifeltro', 'delstrigo', 'etravirine', 'nevirapine', 'maraviroc', 'bictegravir', 'biktarvy', 'dolutegravir', 'tivicay', 'triumeq', 'dovato', 'elvitegravir', 'genvoya', 'stribild', 'cabotegravir', 'tenofovir alafenamide', 'descovy']);
  G('insti', 'Integrase inhibitor (HIV)', ['dolutegravir', 'tivicay', 'triumeq', 'dovato', 'juluca', 'bictegravir', 'biktarvy', 'raltegravir', 'isentress', 'cabotegravir', 'vocabria', 'elvitegravir', 'genvoya', 'stribild']);
  G('ocp', 'Hormonal contraceptive / estrogen', ['ethinyl estradiol', 'ethinylestradiol', 'levonorgestrel', 'norethindrone', 'norgestimate', 'desogestrel', 'drospirenone', 'etonogestrel', 'dienogest', 'oral contraceptive', 'birth control pill', 'alesse', 'yasmin', 'yaz', 'marvelon', 'tri-cyclen', 'nuvaring', 'slynd', 'micronor']);
  G('digoxin', 'Digoxin', ['digoxin', 'lanoxin', 'toloxin']);
  G('levothyroxine', 'Thyroid hormone', ['levothyroxine', 'synthroid', 'eltroxin', 'levoxyl', 'euthyrox', 'liothyronine', 'cytomel', 'desiccated thyroid', 'armour thyroid']);
  G('antithyroid', 'Antithyroid drug', ['methimazole', 'tapazole', 'propylthiouracil', 'ptu', 'carbimazole']);
  G('amiodarone', 'Amiodarone', ['amiodarone', 'cordarone', 'pacerone']);
  G('quinolone', 'Fluoroquinolone (oral)', ['ciprofloxacin', 'cipro', 'levofloxacin', 'levaquin', 'moxifloxacin', 'avelox', 'ofloxacin', 'norfloxacin']);
  G('tetracycline', 'Tetracycline (oral)', ['doxycycline', 'vibramycin', 'doxycin', 'minocycline', 'minocin', 'tetracycline', 'omadacycline', 'sarecycline']);
  G('bisphos', 'Oral bisphosphonate', ['alendronate', 'fosamax', 'binosto', 'fosavance', 'risedronate', 'actonel', 'atelvia', 'ibandronate', 'etidronate', 'didrocal']);
  G('eltrombopag', 'Eltrombopag', ['eltrombopag', 'revolade', 'promacta']);
  G('levodopa', 'Levodopa', ['levodopa', 'carbidopa', 'sinemet', 'prolopa', 'benserazide', 'duodopa', 'stalevo', 'rytary']);
  G('acei_arb', 'ACE inhibitor / ARB / ARNI', ['ramipril', 'altace', 'perindopril', 'coversyl', 'lisinopril', 'zestril', 'enalapril', 'vasotec', 'captopril', 'trandolapril', 'mavik', 'quinapril', 'accupril', 'fosinopril', 'benazepril', 'cilazapril', 'losartan', 'cozaar', 'valsartan', 'diovan', 'irbesartan', 'avapro', 'candesartan', 'atacand', 'telmisartan', 'micardis', 'olmesartan', 'olmetec', 'azilsartan', 'edarbi', 'eprosartan', 'sacubitril', 'entresto', 'aliskiren']);
  G('ksparing', 'Potassium-sparing diuretic / MRA', ['spironolactone', 'aldactone', 'aldactazide', 'eplerenone', 'inspra', 'finerenone', 'kerendia', 'amiloride', 'moduret', 'triamterene', 'dyazide']);
  G('tmp', 'Trimethoprim', ['trimethoprim', 'sulfamethoxazole', 'septra', 'bactrim', 'co-trimoxazole', 'cotrimoxazole', 'tmp-smx', 'tmp/smx']);
  G('diuretic', 'Loop / thiazide diuretic', ['furosemide', 'lasix', 'bumetanide', 'burinex', 'torsemide', 'torasemide', 'ethacrynic', 'hydrochlorothiazide', 'hctz', 'chlorthalidone', 'indapamide', 'metolazone']);
  G('thiazide', 'Thiazide diuretic', ['hydrochlorothiazide', 'hctz', 'chlorthalidone', 'indapamide', 'metolazone']);
  G('steroid', 'Systemic corticosteroid', ['prednisone', 'prednisolone', 'methylprednisolone', 'solu-medrol', 'dexamethasone', 'hydrocortisone', 'solu-cortef', 'fludrocortisone', 'florinef']);
  G('simvalova', 'Simvastatin / lovastatin', ['simvastatin', 'zocor', 'lovastatin', 'mevacor']);
  G('statin3a4', 'Statin (CYP3A4)', ['simvastatin', 'zocor', 'lovastatin', 'mevacor', 'atorvastatin', 'lipitor']);
  G('statin', 'Statin', ['simvastatin', 'zocor', 'lovastatin', 'mevacor', 'atorvastatin', 'lipitor', 'rosuvastatin', 'crestor', 'pravastatin', 'pitavastatin', 'fluvastatin']);
  G('fibrate', 'Fibrate', ['gemfibrozil', 'lopid', 'fenofibrate', 'lipidil', 'bezafibrate']);
  G('cyp3a4inh', 'Strong/moderate CYP3A4 inhibitor', ['clarithromycin', 'biaxin', 'erythromycin', 'ketoconazole', 'itraconazole', 'posaconazole', 'voriconazole', 'fluconazole', 'ritonavir', 'cobicistat', 'nirmatrelvir', 'paxlovid', 'diltiazem', 'verapamil']);
  G('azole', 'Azole antifungal (CYP3A4 substrate)', ['voriconazole', 'vfend', 'itraconazole', 'posaconazole', 'isavuconazole']);
  G('ccb_dhp', 'Felodipine / nifedipine', ['felodipine', 'plendil', 'nifedipine', 'adalat', 'nimodipine', 'nisoldipine']);
  G('hypoglycemic', 'Insulin / sulfonylurea / meglitinide', ['insulin', 'glargine', 'lantus', 'basaglar', 'toujeo', 'detemir', 'levemir', 'degludec', 'tresiba', 'lispro', 'humalog', 'aspart', 'novorapid', 'fiasp', 'humulin', 'novolin', 'gliclazide', 'diamicron', 'glyburide', 'glibenclamide', 'glimepiride', 'amaryl', 'repaglinide', 'gluconorm']);
  G('metformin', 'Metformin', ['metformin', 'glucophage', 'janumet', 'jentadueto', 'synjardy', 'xigduo']);
  G('sedative', 'Sedating drug (opioid, benzodiazepine, Z-drug, gabapentinoid, antipsychotic)', ['lorazepam', 'ativan', 'diazepam', 'valium', 'clonazepam', 'rivotril', 'alprazolam', 'xanax', 'oxazepam', 'temazepam', 'restoril', 'midazolam', 'chlordiazepoxide', 'zopiclone', 'imovane', 'eszopiclone', 'zolpidem', 'sublinox', 'morphine', 'hydromorphone', 'dilaudid', 'oxycodone', 'percocet', 'oxyneo', 'codeine', 'tylenol #3', 'fentanyl', 'methadone', 'tramadol', 'tapentadol', 'buprenorphine', 'suboxone', 'meperidine', 'gabapentin', 'neurontin', 'pregabalin', 'lyrica', 'quetiapine', 'seroquel', 'olanzapine', 'zyprexa', 'trazodone', 'mirtazapine', 'baclofen', 'tizanidine', 'phenobarbital', 'diphenhydramine', 'benadryl', 'dimenhydrinate', 'gravol', 'hydroxyzine', 'cyclobenzaprine', 'clobazam']);
  G('opioid', 'Opioid', ['morphine', 'hydromorphone', 'dilaudid', 'oxycodone', 'percocet', 'oxyneo', 'codeine', 'tylenol #3', 'fentanyl', 'methadone', 'tramadol', 'tapentadol', 'buprenorphine', 'suboxone', 'meperidine', 'sufentanil']);
  G('benzo', 'Benzodiazepine / Z-drug', ['lorazepam', 'ativan', 'diazepam', 'valium', 'clonazepam', 'rivotril', 'alprazolam', 'xanax', 'oxazepam', 'temazepam', 'midazolam', 'chlordiazepoxide', 'zopiclone', 'imovane', 'eszopiclone', 'zolpidem', 'clobazam']);
  G('opioid3a4', 'Methadone / oxycodone / fentanyl', ['methadone', 'metadol', 'oxycodone', 'percocet', 'oxyneo', 'fentanyl']);
  G('fluvoxamine', 'Fluvoxamine', ['fluvoxamine', 'luvox']);
  G('hepatotox', 'Potentially liver-toxic drug', ['methotrexate', 'isoniazid', 'rifampin', 'rifampicin', 'pyrazinamide', 'valproate', 'valproic', 'divalproex', 'epival', 'amiodarone', 'ketoconazole', 'leflunomide', 'azathioprine', 'nevirapine', 'amoxicillin-clavulanate', 'amoxicillin/clavulanate', 'clavulin', 'augmentin', 'tolvaptan', 'flucloxacillin', 'terbinafine', 'bosentan', 'dantrolene']);
  G('valproate', 'Valproate', ['valproic', 'valproate', 'divalproex', 'epival', 'depakene', 'depakote']);
  G('clobazam', 'Clobazam', ['clobazam', 'frisium', 'onfi']);
  G('aed', 'Antiseizure medication', ['phenytoin', 'dilantin', 'fosphenytoin', 'carbamazepine', 'tegretol', 'oxcarbazepine', 'trileptal', 'lamotrigine', 'lamictal', 'levetiracetam', 'keppra', 'lacosamide', 'vimpat', 'topiramate', 'topamax', 'phenobarbital', 'brivaracetam', 'briviact', 'clobazam', 'valproic', 'valproate', 'divalproex', 'epival', 'zonisamide', 'perampanel', 'cenobamate']);
  G('phenytoin', 'Phenytoin', ['phenytoin', 'dilantin', 'fosphenytoin']);
  G('efavirenz', 'Efavirenz', ['efavirenz', 'atripla', 'sustiva']);
  G('oral_onc', 'Anticancer drug (CYP3A4 / P-gp substrate)', ['imatinib', 'gleevec', 'dasatinib', 'nilotinib', 'bosutinib', 'ibrutinib', 'imbruvica', 'acalabrutinib', 'zanubrutinib', 'venetoclax', 'venclexta', 'osimertinib', 'erlotinib', 'gefitinib', 'lapatinib', 'sunitinib', 'pazopanib', 'cabozantinib', 'lenvatinib', 'axitinib', 'palbociclib', 'ribociclib', 'abemaciclib', 'olaparib', 'niraparib', 'abiraterone', 'irinotecan', 'docetaxel', 'paclitaxel', 'etoposide', 'vincristine', 'vinorelbine', 'ruxolitinib', 'midostaurin', 'gilteritinib', 'lorlatinib', 'alectinib', 'crizotinib']);
  G('bortezomib', 'Bortezomib', ['bortezomib', 'velcade']);
  G('hormone_onc', 'Hormone therapy for cancer', ['tamoxifen', 'letrozole', 'femara', 'anastrozole', 'arimidex', 'exemestane', 'aromasin', 'leuprolide', 'lupron', 'eligard', 'goserelin', 'zoladex', 'degarelix', 'firmagon', 'abiraterone', 'zytiga', 'enzalutamide', 'xtandi', 'apalutamide', 'erleada', 'darolutamide', 'nubeqa', 'bicalutamide', 'casodex', 'fulvestrant']);
  G('nadolol', 'Nadolol', ['nadolol', 'corgard']);
  G('antihtn', 'Antihypertensive', ['ramipril', 'perindopril', 'lisinopril', 'enalapril', 'captopril', 'trandolapril', 'quinapril', 'losartan', 'valsartan', 'irbesartan', 'candesartan', 'telmisartan', 'olmesartan', 'amlodipine', 'norvasc', 'nifedipine', 'felodipine', 'diltiazem', 'verapamil', 'metoprolol', 'bisoprolol', 'atenolol', 'carvedilol', 'propranolol', 'nadolol', 'labetalol', 'hydralazine', 'clonidine', 'doxazosin', 'prazosin', 'terazosin', 'hydrochlorothiazide', 'hctz', 'chlorthalidone', 'indapamide']);
  G('nitrate_pde5', 'Nitrate / PDE5 inhibitor', ['nitroglycerin', 'nitroglycerine', 'isosorbide', 'imdur', 'sildenafil', 'viagra', 'revatio', 'tadalafil', 'cialis', 'adcirca', 'vardenafil']);
  G('qt', 'QT-prolonging drug', ['amiodarone', 'sotalol', 'dofetilide', 'citalopram', 'escitalopram', 'haloperidol', 'methadone', 'ondansetron', 'azithromycin', 'clarithromycin', 'erythromycin', 'levofloxacin', 'moxifloxacin', 'ciprofloxacin', 'domperidone', 'quetiapine', 'ziprasidone', 'hydroxychloroquine', 'pentamidine', 'fluconazole']);
  G('stimulant', 'Stimulant / sympathomimetic', ['methylphenidate', 'ritalin', 'concerta', 'amphetamine', 'adderall', 'dextroamphetamine', 'dexedrine', 'lisdexamfetamine', 'vyvanse', 'modafinil', 'pseudoephedrine', 'sudafed', 'phenylephrine', 'midodrine', 'theophylline', 'atomoxetine']);
  G('lithium', 'Lithium', ['lithium', 'carbolith', 'lithmax']);
  G('carbamazepine', 'Carbamazepine', ['carbamazepine', 'tegretol']);
  G('retinoid', 'Oral retinoid', ['isotretinoin', 'accutane', 'clarus', 'epuris', 'acitretin', 'soriatane', 'alitretinoin', 'toctino', 'bexarotene']);
  G('methotrexate', 'Methotrexate', ['methotrexate', 'metoject']);
  G('gabapentin', 'Gabapentin', ['gabapentin', 'neurontin']);
  G('antibiotic', 'Antibiotic', ['amoxicillin', 'ampicillin', 'penicillin', 'cloxacillin', 'piperacillin', 'tazobactam', 'cefazolin', 'cephalexin', 'keflex', 'cefuroxime', 'ceftriaxone', 'cefepime', 'ceftazidime', 'cefixime', 'cefadroxil', 'meropenem', 'ertapenem', 'imipenem', 'vancomycin', 'metronidazole', 'flagyl', 'ciprofloxacin', 'levofloxacin', 'moxifloxacin', 'azithromycin', 'clarithromycin', 'doxycycline', 'minocycline', 'sulfamethoxazole', 'septra', 'trimethoprim', 'nitrofurantoin', 'macrobid', 'clindamycin', 'linezolid', 'daptomycin', 'gentamicin', 'tobramycin', 'fosfomycin', 'aztreonam', 'rifampin', 'fidaxomicin']);
  G('antifungal', 'Systemic antifungal', ['fluconazole', 'voriconazole', 'itraconazole', 'posaconazole', 'isavuconazole', 'caspofungin', 'micafungin', 'anidulafungin', 'amphotericin', 'nystatin']);

  const BLEED = ['warfarin', 'doac', 'heparin', 'antiplatelet', 'nsaid'];
  const ANTICOAG = ['warfarin', 'doac', 'heparin'];
  const IMMUNO = ['cni', 'mtor', 'mmf', 'immuno'];
  const CHELATE = ['levothyroxine', 'quinolone', 'tetracycline', 'bisphos', 'insti', 'eltrombopag'];

  // ---------------- spacing advice (oral drugs that bind to minerals) ----------------
  const SPACE = {
    levothyroxine: 'Thyroid hormone first on an empty stomach; mineral at least 4 h later.',
    quinolone: 'Give the quinolone 2 h before or 6 h after the mineral.',
    tetracycline: 'Give the tetracycline 2 h before or 4–6 h after the mineral.',
    bisphos: 'Bisphosphonate first thing, fasting, with plain water; wait at least 30 min (60 min for ibandronate) before any mineral, food or other drug.',
    insti: 'Dolutegravir / bictegravir 2 h before or 6 h after the mineral (or together with a meal for calcium/iron – confirm with HIV pharmacy); raltegravir: avoid Mg/Al antacids.',
    eltrombopag: 'Eltrombopag 2 h before or 4 h after any mineral-containing product.',
    levodopa: 'Separate iron and levodopa by at least 2 h.',
    mmf: 'Separate mycophenolate from iron and Mg/Al antacids by at least 2 h.',
    gabapentin: 'Give gabapentin at least 2 h after Mg/Al antacids.',
    digoxin: 'Separate digoxin from fibre by at least 2 h.',
    lithium: 'Separate lithium from fibre by at least 2 h; keep the routine consistent.',
    carbamazepine: 'Separate carbamazepine from fibre by at least 2 h.'
  };

  // ---------------- supplements ----------------
  const SUPPS = [];
  function S(key, name, cls, terms, o) { SUPPS.push(Object.assign({ key, name, cls, terms, tags: [], ix: [], cond: [] }, o)); }
  const liverIssue = c => c.pt.liver || (isNum(c.pt.alt) && c.pt.alt > 120);
  const immunoState = c => c.pt.transplant || c.pt.immunosupp || c.has(IMMUNO);
  const surgery = c => !!c.pt.surgery;
  function isNum(v) { return typeof v === 'number' && !isNaN(v); }
  const bleedIx = (sev, why, extra) => Object.assign({ g: BLEED, sev, title: 'Bleeding risk with antithrombotic / NSAID', why, todo: 'Stop the supplement while on an anticoagulant or antiplatelet, especially in older or falls-risk patients. Hold before surgery.' }, extra || {});
  const CHEL_WHY = { levothyroxine: 'Less levothyroxine absorbed → TSH rises.', quinolone: 'Quinolone absorption can fall by more than half → treatment failure.', tetracycline: 'Less tetracycline absorbed → treatment failure.',
    bisphos: 'Bisphosphonate absorption (already under 1%) falls further → less fracture protection.', insti: 'Lower integrase inhibitor levels → HIV treatment failure and resistance.', eltrombopag: 'Lower eltrombopag levels → poorer platelet response.' };
  const chelIx = (mineral, sev) => CHELATE.map(g => ({ g: [g], sev: sev || 'Moderate', title: mineral + ' binds ' + GROUPS[g].label.toLowerCase() + ' in the gut', why: CHEL_WHY[g], todo: g === 'quinolone' || g === 'tetracycline' ? 'Space the doses, or hold the supplement for the length of the antibiotic course.' : 'Space the doses (see the Spacing tab).', space: SPACE[g] }));

  // ----- Herbals -----
  S('sjw', "St John's wort", 'Herbal', ["st\\.? john'?s wort", 'st johns wort', 'saint john', 'hypericum', 'hypericin'], {
    what: 'Used for low mood. A strong inducer of CYP3A4, CYP2C19 and P-glycoprotein (levels of many drugs fall over 1–2 weeks and rise again 1–2 weeks after stopping) and serotonergic. Causes photosensitivity.',
    tags: ['ss'], preop: 'Stop at least 5 days before elective surgery (Ang-Lee 2001).',
    ix: [
      { g: ['cni', 'mtor'], sev: 'Contraindicated', title: "St John's wort lowers tacrolimus / cyclosporine / mTOR levels", why: 'Induction can cut levels by about half → acute rejection reported.', todo: 'Stop it. Check a trough now and again 1–2 weeks after stopping (levels rise as induction wears off). Tell the transplant team.' },
      { g: ['hiv'], sev: 'Contraindicated', title: "St John's wort lowers HIV antiretroviral levels", why: 'PIs, NNRTIs, bictegravir, TAF and nirmatrelvir levels fall → virologic failure and resistance. Monographs contraindicate the combination.', todo: 'Stop it and tell the HIV team / pharmacy.' },
      { g: ['maoi'], sev: 'Contraindicated', title: "St John's wort + MAOI / linezolid", why: 'Serotonin syndrome.', todo: 'Stop it; if linezolid is needed, choose another antibiotic or wait for washout (discuss with pharmacy).' },
      { g: ['doac'], sev: 'High', title: "St John's wort lowers DOAC levels", why: 'P-gp/CYP3A4 induction lowers apixaban, rivaroxaban, edoxaban and dabigatran → stroke or VTE. Monographs advise avoiding.', todo: "Stop it. If the patient will not stop, warfarin with INR monitoring is an option." },
      { g: ['ticagrelor'], sev: 'High', title: "St John's wort lowers ticagrelor levels", why: 'CYP3A4 induction reduces antiplatelet effect (stent thrombosis risk).', todo: 'Stop it.' },
      { g: ['warfarin'], sev: 'High', title: "St John's wort lowers the INR", why: 'Faster warfarin metabolism.', todo: 'Stop it; check INR in 3–5 days and again 1–2 weeks after stopping (INR may climb).' },
      { g: ['oral_onc'], sev: 'High', title: "St John's wort lowers anticancer drug levels", why: 'Lower imatinib, irinotecan, docetaxel and many TKI levels → less effect.', todo: 'Stop it; tell oncology / oncology pharmacy.' },
      { g: ['azole'], sev: 'High', title: "St John's wort lowers azole antifungal levels", why: 'Voriconazole levels fall markedly (contraindicated in the monograph).', todo: 'Stop it; check azole level if available.' },
      { g: ['ocp'], sev: 'High', title: "St John's wort reduces hormonal contraception", why: 'Breakthrough bleeding and unintended pregnancy reported.', todo: 'Stop it or use a non-hormonal / IUD method.' },
      { g: ['ss'], sev: 'High', title: "St John's wort + serotonergic drug", why: 'Serotonin syndrome reported (SSRIs, SNRIs, tramadol, triptans).', todo: 'Stop it; watch for clonus, agitation, sweating (Hunter criteria on the Drug interactions tab).' },
      { g: ['digoxin'], sev: 'Moderate', title: "St John's wort lowers digoxin levels", why: 'P-gp induction lowers digoxin about 25%.', todo: 'Check a digoxin level; watch for toxicity after stopping.' },
      { g: ['opioid3a4'], sev: 'Moderate', title: "St John's wort lowers methadone / oxycodone / fentanyl", why: 'Withdrawal or poor pain control.', todo: 'Stop it; reassess opioid dose after stopping (levels rise).' },
      { g: ['statin3a4'], sev: 'Moderate', title: "St John's wort lowers simvastatin / atorvastatin", why: 'Less LDL lowering.', todo: 'Stop it, or switch to rosuvastatin/pravastatin.' }
    ]
  });
  S('ginkgo', 'Ginkgo biloba', 'Herbal', ['ginkgo', 'gingko', 'ginko', 'egb ?761'], {
    what: 'Used for memory and circulation. Inhibits platelet-activating factor. Seed contaminants (ginkgotoxin) linked to seizures. Weak CYP inducer.',
    tags: ['bleed'], preop: 'Stop at least 36 h before elective surgery (Ang-Lee 2001).',
    ix: [
      bleedIx('Moderate', 'Case reports of intracranial, ocular and post-operative bleeding; effect on INR itself is small.'),
      { g: ['aed'], sev: c => c.pt.seizureHx ? 'Moderate' : 'Low', title: 'Ginkgo and seizure control', why: 'Ginkgotoxin can lower the seizure threshold; case reports of lower valproate/phenytoin levels and breakthrough seizures.', todo: 'Stop it in a patient with epilepsy; check AED level if seizures.' },
      { g: ['efavirenz'], sev: 'Moderate', title: 'Ginkgo lowers efavirenz', why: 'CYP induction; virologic failure case report.', todo: 'Stop it.' }
    ],
    cond: [{ when: c => c.pt.seizureHx && !c.has(['aed']), sev: 'Moderate', title: 'Ginkgo in a patient with seizures', why: 'Ginkgotoxin may lower the seizure threshold.', todo: 'Advise stopping.' },
      { when: c => isNum(c.pt.plt) && c.pt.plt < 50, sev: 'Moderate', title: 'Ginkgo with platelets under 50', why: 'Antiplatelet effect on top of thrombocytopenia.', todo: 'Stop it.' }]
  });
  S('garlic', 'Garlic (supplement)', 'Herbal', ['garlic', 'allicin', 'kyolic'], {
    what: 'Used for cholesterol and BP. Antiplatelet effect at supplement doses (food amounts are fine).',
    tags: ['bleed'], preop: 'Stop at least 7 days before elective surgery (Ang-Lee 2001).',
    ix: [bleedIx('Moderate', 'Inhibits platelet aggregation; post-operative and spinal epidural bleeding case reports.'),
      { g: ['hiv'], sev: 'Moderate', title: 'Garlic supplements lower some HIV drug levels', why: 'Garlic lowered saquinavir levels by about half (CYP3A4/P-gp).', todo: 'Avoid garlic supplements with PIs/NNRTIs; check with HIV pharmacy.' }]
  });
  S('ginseng', 'Ginseng (Panax / American / Siberian)', 'Herbal', ['ginseng', 'panax', 'eleuthero', 'siberian ginseng', 'cold-fx', 'cold fx'], {
    what: 'Used for energy and immunity (COLD-FX is American ginseng). May lower blood glucose; mild antiplatelet effect.',
    tags: ['bleed'], preop: 'Stop at least 7 days before elective surgery (Ang-Lee 2001).',
    ix: [
      { g: ['warfarin'], sev: 'Moderate', title: 'Ginseng lowers the INR', why: 'American ginseng reduced warfarin effect in a controlled study.', todo: 'Stop it or keep it consistent; check INR after starting or stopping.' },
      { g: ['antiplatelet', 'doac', 'heparin', 'nsaid'], sev: 'Low', title: 'Ginseng: mild antiplatelet effect', why: 'Small added bleeding risk.', todo: 'Consider stopping while on antithrombotics.' },
      { g: ['hypoglycemic'], sev: 'Low', title: 'Ginseng may add to glucose lowering', why: 'Hypoglycemia possible with insulin or sulfonylureas.', todo: 'Watch glucose.' },
      { g: ['maoi'], sev: 'Moderate', title: 'Ginseng + MAOI', why: 'Headache, tremor and manic symptoms reported with phenelzine.', todo: 'Avoid.' },
      { g: ['digoxin'], sev: 'Low', title: 'Siberian ginseng and digoxin levels', why: 'Falsely high digoxin levels reported (assay interference).', todo: 'Interpret a high level with the clinical picture.' }]
  });
  S('turmeric', 'Turmeric / curcumin', 'Herbal', ['turmeric', 'curcumin', 'curcuma', 'theracurmin', 'meriva'], {
    what: 'Used for joint pain and inflammation. Antiplatelet effect; products often add black pepper (piperine), which raises absorption of curcumin and of some drugs. Liver injury reported with high-absorption products.',
    tags: ['bleed'], preop: 'Stop about 2 weeks before elective surgery (antiplatelet effect).',
    ix: [bleedIx('Moderate', 'Antiplatelet effect; case reports of raised INR and bleeding with warfarin.'),
      { g: ['cni'], sev: 'Moderate', title: 'Turmeric and tacrolimus levels', why: 'Case reports of raised tacrolimus levels (CYP3A4/P-gp inhibition, especially with piperine).', todo: 'Avoid in transplant patients; check a trough.' },
      { g: ['hypoglycemic'], sev: 'Low', title: 'Turmeric may add to glucose lowering', why: 'Small effect.', todo: 'Watch glucose.' }],
    cond: [{ when: liverIssue, sev: 'Moderate', title: 'Turmeric with liver disease / raised ALT', why: 'Turmeric-associated liver injury reported (often high-bioavailability or piperine products).', todo: 'Stop it; recheck liver tests.' }]
  });
  S('dongquai', 'Dong quai', 'Herbal', ['dong quai', 'dang gui', 'angelica sinensis'], {
    what: "Used for menopausal and menstrual symptoms. Contains coumarins; photosensitizing.",
    tags: ['bleed'], preop: 'Stop about 2 weeks before elective surgery.',
    ix: [{ g: ['warfarin'], sev: 'High', title: 'Dong quai raises the INR', why: 'Contains natural coumarins; raised INR and bleeding reported.', todo: 'Stop it; check INR.' },
      { g: ['doac', 'heparin', 'antiplatelet', 'nsaid'], sev: 'Moderate', title: 'Dong quai adds bleeding risk', why: 'Coumarin and antiplatelet constituents.', todo: 'Stop it while on an antithrombotic.' }]
  });
  S('feverfew', 'Feverfew', 'Herbal', ['feverfew', 'tanacetum'], {
    what: 'Used for migraine prevention. Inhibits platelet aggregation. Stopping suddenly can cause rebound headache.',
    tags: ['bleed'], preop: 'Stop about 2 weeks before elective surgery.',
    ix: [bleedIx('Moderate', 'Antiplatelet effect.')]
  });
  S('ginger', 'Ginger (supplement)', 'Herbal', ['ginger extract', 'ginger capsule', 'ginger root', 'ginger supplement', 'zingiber'], {
    what: 'Used for nausea. Food amounts are fine; high-dose extracts have a mild antiplatelet effect.',
    tags: ['bleed'],
    ix: [{ g: BLEED, sev: 'Low', title: 'High-dose ginger and bleeding', why: 'Mild antiplatelet effect at high doses (case reports with warfarin).', todo: 'Usually fine; avoid high-dose extracts if bleeding risk is high.' }]
  });
  S('sawpalmetto', 'Saw palmetto', 'Herbal', ['saw palmetto', 'serenoa'], {
    what: 'Used for prostate symptoms. Few interactions; case reports of surgical bleeding.',
    tags: ['bleed'], preop: 'Consider stopping about 2 weeks before elective surgery.',
    ix: [{ g: BLEED, sev: 'Low', title: 'Saw palmetto and bleeding', why: 'Case reports of intra-operative bleeding and raised INR.', todo: 'Consider stopping while on antithrombotics.' }]
  });
  S('horsechestnut', 'Horse chestnut', 'Herbal', ['horse chestnut', 'aescin', 'escin'], {
    what: 'Used for venous insufficiency. May add bleeding risk.', tags: ['bleed'],
    ix: [{ g: BLEED, sev: 'Low', title: 'Horse chestnut and bleeding', why: 'Theoretical antiplatelet/anticoagulant effect.', todo: 'Consider stopping while on antithrombotics.' }]
  });
  S('eveprim', 'Evening primrose oil', 'Herbal', ['evening primrose', 'primrose oil', 'oenothera'], {
    what: 'Used for eczema and breast pain (gamma-linolenic acid).', tags: ['bleed'],
    ix: [{ g: BLEED, sev: 'Low', title: 'Evening primrose oil and bleeding', why: 'Mild antiplatelet effect.', todo: 'Usually fine; consider stopping if high bleeding risk.' },
      { g: ['aed'], sev: 'Low', title: 'Evening primrose oil and seizures', why: 'Older reports of seizures (with phenothiazines); evidence weak.', todo: 'No action unless seizures are poorly controlled.' }]
  });
  S('licorice', 'Licorice (glycyrrhizin)', 'Herbal', ['licorice', 'liquorice', 'glycyrrhiza', 'glycyrrhizin'], {
    what: 'Real licorice (root, teas, some candy and herbal blends) causes mineralocorticoid excess: low K, high BP, edema, metabolic alkalosis. DGL (deglycyrrhizinated) licorice does not.',
    excl: /\bdgl\b|deglycyrrhizinated/i,
    ix: [
      { g: ['digoxin'], sev: 'High', title: 'Licorice + digoxin', why: 'Licorice-induced low K raises digoxin toxicity.', todo: 'Stop licorice; check K, Mg and digoxin level.' },
      { g: ['diuretic'], sev: 'Moderate', title: 'Licorice + loop / thiazide diuretic', why: 'Added K loss → hypokalemia.', todo: 'Stop licorice; check K.' },
      { g: ['steroid'], sev: 'Moderate', title: 'Licorice + corticosteroid', why: 'Glycyrrhizin increases corticosteroid effect and K loss.', todo: 'Stop licorice; check K and BP.' },
      { g: ['qt'], sev: 'Moderate', title: 'Licorice + QT-prolonging drug', why: 'Hypokalemia raises torsades risk.', todo: 'Stop licorice; keep K ≥ 4.0.' },
      { g: ['antihtn', 'ksparing'], sev: 'Moderate', title: 'Licorice counteracts BP / heart failure treatment', why: 'Sodium and water retention, higher BP; opposes spironolactone.', todo: 'Stop licorice.' }],
    cond: [{ when: c => isNum(c.pt.k) && c.pt.k < 3.5, sev: 'High', title: 'Licorice with low potassium', why: 'Licorice may be the cause of the low K.', todo: 'Stop licorice; replace K; check renin/aldosterone only if it persists after stopping.' },
      { when: c => c.pt.hf || c.pt.htn, sev: 'Moderate', title: 'Licorice with heart failure / hypertension', why: 'Fluid retention and higher BP.', todo: 'Advise stopping.' }]
  });
  S('redyeast', 'Red yeast rice', 'Herbal', ['red yeast rice', 'red rice yeast', 'monascus', 'cholestin', 'monacolin'], {
    what: 'Used for cholesterol. Contains monacolin K, which is chemically identical to lovastatin; content varies between products and some contain citrinin (kidney toxin).',
    ix: [
      { g: ['statin'], sev: 'High', title: 'Red yeast rice + statin = two statins', why: 'Monacolin K is lovastatin → myopathy / rhabdomyolysis risk.', todo: 'Stop red yeast rice; keep the prescribed statin. Check CK if muscle symptoms.' },
      { g: ['cyp3a4inh'], sev: 'High', title: 'Red yeast rice + CYP3A4 inhibitor', why: 'Clarithromycin, azoles, ritonavir, diltiazem and verapamil raise lovastatin levels many-fold → rhabdomyolysis.', todo: 'Stop red yeast rice (at least while on the inhibitor).' },
      { g: ['fibrate', 'cni'], sev: 'High', title: 'Red yeast rice + gemfibrozil / fibrate / cyclosporine', why: 'Same myopathy risk as lovastatin with these drugs.', todo: 'Stop red yeast rice.' }],
    cond: [{ when: liverIssue, sev: 'Moderate', title: 'Red yeast rice with liver disease / raised ALT', why: 'Statin-like hepatotoxicity.', todo: 'Stop it; recheck liver tests.' }]
  });
  S('glucosamine', 'Glucosamine / chondroitin', 'Other', ['glucosamine', 'chondroitin'], {
    what: 'Used for osteoarthritis.',
    ix: [{ g: ['warfarin'], sev: 'Moderate', title: 'Glucosamine / chondroitin raises the INR', why: 'Raised INR and bleeding reported, mostly with combination products or dose increases.', todo: 'Check INR after starting, stopping or changing dose; keep it consistent.' }]
  });
  S('cranberry', 'Cranberry', 'Herbal', ['cranberry', 'vaccinium macrocarpon', 'cranberry juice'], {
    what: 'Used to prevent UTIs. Evidence for a warfarin interaction is inconsistent.',
    ix: [{ g: ['warfarin'], sev: 'Low', title: 'Cranberry and warfarin', why: 'Case reports of raised INR with large amounts of juice; controlled studies mostly negative.', todo: 'Moderate amounts are fine; check INR if large daily amounts are started or stopped.' }]
  });
  S('fenugreek', 'Fenugreek', 'Herbal', ['fenugreek', 'trigonella'], {
    what: 'Used for glucose control and lactation. Contains coumarin-like compounds.',
    ix: [{ g: ['warfarin'], sev: 'Moderate', title: 'Fenugreek raises the INR', why: 'Case reports of raised INR.', todo: 'Check INR; avoid starting while on warfarin.' },
      { g: ['hypoglycemic'], sev: 'Low', title: 'Fenugreek may add to glucose lowering', why: 'Small effect.', todo: 'Watch glucose.' }]
  });
  S('cinnamon', 'Cinnamon (supplement)', 'Herbal', ['cinnamon capsule', 'cinnamon supplement', 'cinnamon extract', 'cassia'], {
    what: 'Used for glucose control. Cassia cinnamon contains coumarin (liver toxicity at high doses).',
    ix: [{ g: ['hypoglycemic'], sev: 'Low', title: 'Cinnamon may add to glucose lowering', why: 'Small effect.', todo: 'Watch glucose.' }],
    cond: [{ when: liverIssue, sev: 'Low', title: 'Cassia cinnamon with liver disease', why: 'Coumarin content can injure the liver.', todo: 'Advise stopping high-dose cassia.' }]
  });
  S('greentea', 'Green tea extract (EGCG)', 'Herbal', ['green tea extract', 'egcg', 'epigallocatechin', 'green tea capsule', 'green tea pill', 'camellia sinensis'], {
    what: 'Used for weight loss and energy. Concentrated extracts (not brewed tea) are linked to liver injury. Contains caffeine.',
    ix: [{ g: ['nadolol'], sev: 'Moderate', title: 'Green tea lowers nadolol levels', why: 'Nadolol levels fell by about 75% in a study (OATP1A2 inhibition).', todo: 'Avoid together; or switch beta-blocker.' },
      { g: ['bortezomib'], sev: 'Moderate', title: 'Green tea (EGCG) may block bortezomib', why: 'EGCG binds bortezomib and blocked its effect in lab studies.', todo: 'Avoid during bortezomib treatment.' },
      { g: ['hepatotox'], sev: 'Moderate', title: 'Green tea extract + liver-toxic drug', why: 'Additive liver injury risk.', todo: 'Stop the extract; monitor liver tests.' }],
    cond: [{ when: liverIssue, sev: 'Moderate', title: 'Green tea extract with liver disease / raised ALT', why: 'Concentrated EGCG causes hepatitis (Health Canada and USP warnings).', todo: 'Stop it; recheck liver tests.' }]
  });
  S('kava', 'Kava', 'Herbal', ['kava', 'piper methysticum', 'kavalactone'], {
    what: 'Used for anxiety and sleep. Linked to severe liver injury and liver failure; sedating.',
    tags: ['sed'], preop: 'Stop at least 24 h before surgery (Ang-Lee 2001); can deepen anesthesia.',
    ix: [{ g: ['sedative'], sev: 'Moderate', title: 'Kava + sedating drug', why: 'Additive CNS depression, falls, delirium.', todo: 'Stop kava.' },
      { g: ['hepatotox'], sev: 'High', title: 'Kava + liver-toxic drug', why: 'Additive risk of severe liver injury.', todo: 'Stop kava; check liver tests.' },
      { g: ['levodopa'], sev: 'Low', title: 'Kava and Parkinson disease', why: 'Dopamine antagonism; worsened symptoms reported.', todo: 'Advise stopping.' }],
    cond: [{ when: liverIssue, sev: 'High', title: 'Kava with liver disease / raised ALT', why: 'Kava hepatotoxicity can be severe.', todo: 'Stop kava; check liver tests, INR, bilirubin.' }]
  });
  S('valerian', 'Valerian', 'Herbal', ['valerian', 'valeriana'], {
    what: 'Used for sleep and anxiety. Sedating; long-term use then abrupt stopping can cause withdrawal-like symptoms.',
    tags: ['sed'], preop: 'Taper over weeks before elective surgery if possible; if stopped suddenly, watch for withdrawal (benzodiazepines treat it).',
    ix: [{ g: ['sedative'], sev: 'Moderate', title: 'Valerian + sedating drug', why: 'Additive CNS depression; falls and delirium in older adults.', todo: 'Use the lowest doses; consider stopping in hospital.' }],
    cond: [{ when: liverIssue, sev: 'Low', title: 'Valerian with liver disease', why: 'Rare liver injury reports.', todo: 'Consider stopping.' }]
  });
  S('ashwagandha', 'Ashwagandha', 'Herbal', ['ashwagandha', 'withania', 'ksm-66', 'sensoril'], {
    what: 'Used for stress and sleep. May raise thyroid hormone levels and stimulate the immune system; liver injury reports.',
    tags: ['sed'],
    ix: [{ g: ['levothyroxine', 'antithyroid'], sev: 'Moderate', title: 'Ashwagandha and thyroid treatment', why: 'Can raise T4/T3; thyrotoxicosis case reports.', todo: 'Check TSH; advise stopping.' },
      { g: IMMUNO, sev: 'Moderate', title: 'Ashwagandha with immunosuppression', why: 'Immunostimulant effects could counter immunosuppressants (theoretical).', todo: 'Avoid in transplant / immunosuppressed patients.' },
      { g: ['sedative'], sev: 'Low', title: 'Ashwagandha + sedating drug', why: 'Mild additive sedation.', todo: 'Usually minor.' },
      { g: ['hypoglycemic'], sev: 'Low', title: 'Ashwagandha may add to glucose lowering', why: 'Small effect.', todo: 'Watch glucose.' }],
    cond: [{ when: liverIssue, sev: 'Moderate', title: 'Ashwagandha with liver disease / raised ALT', why: 'Drug-induced liver injury reported (cholestatic).', todo: 'Stop it; recheck liver tests.' }]
  });
  S('echinacea', 'Echinacea', 'Herbal', ['echinacea', 'echinaforce'], {
    what: 'Used for colds. Immunostimulant; mild CYP3A4 effects.',
    ix: [{ g: IMMUNO, sev: 'Moderate', title: 'Echinacea with immunosuppression', why: 'Immunostimulant; could counter immunosuppressants (theoretical). Transplant programs advise avoiding.', todo: 'Advise stopping.' }],
    cond: [{ when: c => (c.pt.transplant || c.pt.immunosupp) && !c.has(IMMUNO), sev: 'Moderate', title: 'Echinacea in a transplant / immunosuppressed patient', why: 'Immunostimulant.', todo: 'Advise stopping.' }]
  });
  S('goldenseal', 'Goldenseal / berberine', 'Herbal', ['goldenseal', 'golden seal', 'hydrastis', 'berberine'], {
    what: 'Berberine (also found in goldenseal) is used for glucose and cholesterol. Inhibits CYP3A4, CYP2D6 and P-gp; lowers glucose.',
    ix: [{ g: ['cni'], sev: 'High', title: 'Goldenseal / berberine raises cyclosporine / tacrolimus', why: 'Berberine raised cyclosporine levels in transplant patients (CYP3A4 inhibition).', todo: 'Stop it; check a trough.' },
      { g: ['oral_onc'], sev: 'Moderate', title: 'Goldenseal / berberine with CYP3A4 anticancer drugs', why: 'May raise levels and toxicity.', todo: 'Stop it; tell oncology pharmacy.' },
      { g: ['hypoglycemic', 'metformin'], sev: 'Moderate', title: 'Berberine adds to glucose lowering', why: 'Hypoglycemia with insulin or sulfonylureas.', todo: 'Watch glucose; advise stopping in hospital.' }]
  });
  S('cbd', 'Cannabis / CBD', 'Other', ['cbd', 'cannabidiol', 'cbd oil', 'cannabis', 'marijuana', 'marihuana', 'thc', 'epidiolex', 'sativex', 'nabiximols', 'nabilone', 'cesamet', 'dronabinol'], {
    what: 'CBD inhibits CYP2C19, CYP3A4 and CYP2C9; THC is sedating and can cause tachycardia and orthostatic hypotension.',
    tags: ['sed'],
    ix: [{ g: ['cni', 'mtor'], sev: 'High', title: 'CBD raises tacrolimus / cyclosporine / everolimus', why: 'Several-fold rises in tacrolimus levels reported.', todo: 'Check a trough; tell the transplant team.' },
      { g: ['warfarin'], sev: 'Moderate', title: 'CBD raises the INR', why: 'CYP2C9 inhibition; raised INR reported.', todo: 'Check INR after starting, stopping or changing dose.' },
      { g: ['clobazam'], sev: 'Moderate', title: 'CBD raises clobazam (N-desmethylclobazam)', why: 'Sedation.', todo: 'Consider a lower clobazam dose.' },
      { g: ['valproate'], sev: 'Moderate', title: 'CBD + valproate', why: 'Raised ALT/AST (liver injury) in trials.', todo: 'Check liver tests.' },
      { g: ['sedative'], sev: 'Moderate', title: 'Cannabis / CBD + sedating drug', why: 'Additive sedation, falls, delirium.', todo: 'Lowest doses; watch sedation.' }],
    cond: [{ when: liverIssue, sev: 'Moderate', title: 'CBD with liver disease / raised ALT', why: 'Dose-related liver enzyme rise.', todo: 'Check liver tests; consider stopping.' }]
  });
  S('grapefruit', 'Grapefruit / Seville orange / pomelo', 'Other', ['grapefruit', 'seville orange', 'pomelo'], {
    what: 'Food, not a supplement, but a common cause of interactions: inhibits gut CYP3A4 for about 24 h after one glass.',
    ix: [{ g: ['simvalova'], sev: 'High', title: 'Grapefruit raises simvastatin / lovastatin', why: 'Levels rise several-fold → myopathy.', todo: 'Avoid grapefruit, or switch to rosuvastatin/pravastatin.' },
      { g: ['cni', 'mtor'], sev: 'High', title: 'Grapefruit raises tacrolimus / cyclosporine / sirolimus', why: 'Unpredictable rises in level.', todo: 'Avoid grapefruit.' },
      { g: ['amiodarone', 'ccb_dhp', 'oral_onc'], sev: 'Moderate', title: 'Grapefruit raises amiodarone / felodipine / nifedipine / some anticancer drugs', why: 'CYP3A4 inhibition.', todo: 'Avoid grapefruit.' },
      { g: ['statin3a4'], sev: 'Low', title: 'Grapefruit and atorvastatin', why: 'Smaller rise than with simvastatin.', todo: 'Small amounts are usually fine.' }]
  });
  S('kratom', 'Kratom', 'Other', ['kratom', 'mitragyn', 'ketum'], {
    what: 'Sold as a supplement; opioid-like at higher doses (mitragynine), stimulant at low doses. Dependence and withdrawal; seizures and liver injury reported.',
    tags: ['sed'],
    ix: [{ g: ['opioid', 'benzo'], sev: 'High', title: 'Kratom + opioid / benzodiazepine', why: 'Respiratory depression and deaths reported with combinations.', todo: 'Advise stopping; watch for opioid-like withdrawal in hospital.' },
      { g: ['sedative'], sev: 'Moderate', title: 'Kratom + sedating drug', why: 'Additive CNS depression.', todo: 'Watch sedation.' }],
    cond: [{ when: c => true, sev: 'Low', title: 'Kratom use: withdrawal in hospital', why: 'Opioid-like withdrawal can start 12–48 h after the last dose.', todo: 'Ask about daily amount; COWS monitoring if heavy daily use.' },
      { when: liverIssue, sev: 'Moderate', title: 'Kratom with liver disease / raised ALT', why: 'Cholestatic liver injury reported.', todo: 'Stop it; recheck liver tests.' }]
  });
  S('yohimbe', 'Yohimbe / yohimbine', 'Herbal', ['yohimbe', 'yohimbine'], {
    what: 'Used for sexual function and weight loss. Alpha-2 blocker: raises BP and heart rate, anxiety.',
    ix: [{ g: ['maoi'], sev: 'High', title: 'Yohimbe + MAOI', why: 'Hypertensive crisis.', todo: 'Stop yohimbe.' },
      { g: ['stimulant'], sev: 'High', title: 'Yohimbe + stimulant', why: 'Additive hypertension and tachyarrhythmia.', todo: 'Stop yohimbe.' },
      { g: ['antihtn'], sev: 'Moderate', title: 'Yohimbe counteracts BP treatment', why: 'Raises BP.', todo: 'Stop yohimbe.' }],
    cond: [{ when: c => c.pt.htn, sev: 'Moderate', title: 'Yohimbe with hypertension', why: 'Raises BP.', todo: 'Advise stopping.' }]
  });
  S('bitterorange', 'Bitter orange / ephedra (synephrine)', 'Herbal', ['bitter orange', 'synephrine', 'citrus aurantium', 'ephedra', 'ma huang', 'ephedrine'], {
    what: 'Stimulants in weight-loss and pre-workout products (ephedra is banned in Canada for weight loss). Raise BP and heart rate; arrhythmia, stroke and MI reported.',
    preop: 'Stop at least 24 h before surgery (ephedra; Ang-Lee 2001).',
    ix: [{ g: ['maoi'], sev: 'Contraindicated', title: 'Sympathomimetic supplement + MAOI', why: 'Hypertensive crisis.', todo: 'Stop it.' },
      { g: ['stimulant'], sev: 'High', title: 'Sympathomimetic supplement + stimulant', why: 'Additive hypertension and arrhythmia.', todo: 'Stop it.' },
      { g: ['qt'], sev: 'Moderate', title: 'Synephrine / ephedra + QT drug', why: 'QT prolongation and arrhythmia reported.', todo: 'Stop it; ECG if palpitations.' },
      { g: ['antihtn'], sev: 'Moderate', title: 'Sympathomimetic supplement counteracts BP treatment', why: 'Raises BP.', todo: 'Stop it.' }],
    cond: [{ when: c => c.pt.htn || c.pt.hf, sev: 'Moderate', title: 'Stimulant supplement with hypertension / heart disease', why: 'Raises BP and heart rate.', todo: 'Advise stopping.' }]
  });
  S('fivehtp', '5-HTP / L-tryptophan', 'Other', ['5-htp', '5 htp', '5-hydroxytryptophan', 'oxitriptan', 'tryptophan'], {
    what: 'Serotonin precursors used for mood and sleep.', tags: ['ss'],
    ix: [{ g: ['maoi'], sev: 'Contraindicated', title: '5-HTP / tryptophan + MAOI / linezolid', why: 'Serotonin syndrome.', todo: 'Stop it.' },
      { g: ['ss'], sev: 'High', title: '5-HTP / tryptophan + serotonergic drug', why: 'Serotonin syndrome reported.', todo: 'Stop it; watch for clonus, agitation, sweating.' }]
  });
  S('same', 'SAMe (S-adenosylmethionine)', 'Other', ['same\\b(?= ?\\d| supplement| tablet| 200| 400)', 'sam-e', 's-adenosyl', 'ademetionine'], {
    what: 'Used for mood and osteoarthritis. Serotonergic.', tags: ['ss'],
    ix: [{ g: ['maoi'], sev: 'High', title: 'SAMe + MAOI / linezolid', why: 'Serotonin syndrome.', todo: 'Stop it.' },
      { g: ['ss'], sev: 'Moderate', title: 'SAMe + serotonergic drug', why: 'Serotonin syndrome case reports.', todo: 'Consider stopping; watch for symptoms.' },
      { g: ['levodopa'], sev: 'Low', title: 'SAMe and levodopa', why: 'May reduce levodopa effect (methylation).', todo: 'Watch Parkinson control.' }]
  });
  S('hawthorn', 'Hawthorn', 'Herbal', ['hawthorn', 'crataegus'], {
    what: 'Used for heart failure symptoms. Mild positive inotrope and vasodilator.',
    ix: [{ g: ['digoxin'], sev: 'Moderate', title: 'Hawthorn + digoxin', why: 'Additive cardiac effects (theoretical, small studies).', todo: 'Watch HR and digoxin level; consider stopping.' },
      { g: ['nitrate_pde5', 'antihtn'], sev: 'Low', title: 'Hawthorn + nitrate / BP drug', why: 'Additive hypotension.', todo: 'Watch BP.' }]
  });
  S('milkthistle', 'Milk thistle (silymarin)', 'Herbal', ['milk thistle', 'silymarin', 'silybum', 'silibinin'], {
    what: 'Used for liver health. Few clinically important interactions at usual doses.',
    ix: [{ g: ['warfarin'], sev: 'Low', title: 'Milk thistle and warfarin', why: 'Weak CYP2C9 inhibition in lab studies; clinical effect unlikely.', todo: 'Check INR if started or stopped.' }]
  });
  S('blackcohosh', 'Black cohosh', 'Herbal', ['black cohosh', 'cimicifuga', 'actaea racemosa', 'remifemin'], {
    what: 'Used for menopausal symptoms. Liver injury reported (Health Canada label warning).',
    ix: [{ g: ['hepatotox'], sev: 'Low', title: 'Black cohosh + liver-toxic drug', why: 'Possible additive liver injury.', todo: 'Monitor liver tests.' }],
    cond: [{ when: liverIssue, sev: 'Moderate', title: 'Black cohosh with liver disease / raised ALT', why: 'Hepatitis and liver failure reported.', todo: 'Stop it; recheck liver tests.' }]
  });
  S('dhea', 'DHEA', 'Other', ['dhea', 'dehydroepiandrosterone', 'prasterone'], {
    what: 'Hormone precursor (converted to androgens and estrogens).',
    ix: [{ g: ['hormone_onc'], sev: 'High', title: 'DHEA with hormone therapy for cancer', why: 'May counteract breast or prostate cancer hormone therapy.', todo: 'Stop it; tell oncology.' },
      { g: ['ocp'], sev: 'Low', title: 'DHEA with estrogen', why: 'Additive hormonal effects.', todo: 'Usually minor.' }]
  });
  S('probiotic', 'Probiotic', 'Other', ['probiotic', 'lactobacillus', 'saccharomyces', 'florastor', 'bifidobacter', 'bio-k', 'culturelle', 'align probiotic', 'vsl'], {
    what: 'Live bacteria or yeast. Safe for most people; bloodstream infections reported in high-risk patients.',
    ix: [{ g: ['antibiotic'], sev: 'Low', title: 'Probiotic with antibiotics', why: 'Antibiotics can kill bacterial probiotics.', todo: 'Give the probiotic at least 2 h after the antibiotic dose.' },
      { g: ['antifungal'], sev: 'Low', title: 'Saccharomyces with antifungals', why: 'Antifungals kill S. boulardii.', todo: 'Probiotic will not work; usually stop it.' }],
    cond: [{ when: c => c.pt.immunosupp || c.pt.transplant || c.pt.centralLine || (isNum(c.pt.anc) && c.pt.anc < 1.0) || c.has(IMMUNO), sev: 'Moderate', title: 'Probiotic in an immunocompromised patient or with a central line', why: 'Lactobacillus bacteremia and Saccharomyces fungemia reported (also spread by hand from opened capsules to nearby central lines).', todo: 'Avoid probiotics in neutropenia, transplant, critical illness or central lines.' }]
  });
  S('psyllium', 'Psyllium / fibre supplement', 'Other', ['psyllium', 'metamucil', 'benefiber', 'inulin', 'fibre supplement', 'fiber supplement', 'ispaghula'], {
    what: 'Bulk-forming fibre. Can bind or slow absorption of some drugs.',
    ix: [{ g: ['levothyroxine'], sev: 'Low', title: 'Fibre and thyroid hormone', why: 'Less levothyroxine absorbed.', todo: 'Separate by 4 h.', space: 'Thyroid hormone first; fibre at least 4 h later.' },
      { g: ['digoxin'], sev: 'Low', title: 'Fibre and digoxin', why: 'Slower/lower absorption.', todo: 'Separate by 2 h.', space: SPACE.digoxin },
      { g: ['lithium'], sev: 'Low', title: 'Fibre and lithium', why: 'Lower lithium absorption.', todo: 'Separate by 2 h; check a level if routine changes.', space: SPACE.lithium },
      { g: ['carbamazepine'], sev: 'Low', title: 'Fibre and carbamazepine', why: 'Lower absorption.', todo: 'Separate by 2 h.', space: SPACE.carbamazepine }]
  });
  S('coq10', 'Coenzyme Q10', 'Other', ['coenzyme q10', 'coenzyme q-10', 'coq10', 'co-q10', 'co q10', 'ubiquinone', 'ubiquinol', 'ubidecarenone'], {
    what: 'Used for statin muscle symptoms and heart failure. Structurally similar to vitamin K.',
    ix: [{ g: ['warfarin'], sev: 'Low', title: 'CoQ10 may lower the INR', why: 'Case reports of reduced warfarin effect.', todo: 'Check INR after starting or stopping.' },
      { g: ['antihtn'], sev: 'Low', title: 'CoQ10 and BP', why: 'Small BP-lowering effect.', todo: 'Usually minor.' }]
  });
  S('alphalipoic', 'Alpha-lipoic acid', 'Other', ['alpha-lipoic', 'alpha lipoic', 'lipoic acid', 'thioctic'], {
    what: 'Used for diabetic neuropathy.',
    ix: [{ g: ['hypoglycemic'], sev: 'Low', title: 'Alpha-lipoic acid may add to glucose lowering', why: 'Small effect; rare insulin autoimmune syndrome reports.', todo: 'Watch glucose.' }]
  });
  S('chromium', 'Chromium', 'Mineral', ['chromium'], {
    what: 'Used for glucose control.',
    ix: [{ g: ['hypoglycemic'], sev: 'Low', title: 'Chromium may add to glucose lowering', why: 'Small effect.', todo: 'Watch glucose.' },
      { g: ['levothyroxine'], sev: 'Low', title: 'Chromium and thyroid hormone', why: 'May lower levothyroxine absorption.', todo: 'Separate by 3–4 h.', space: SPACE.levothyroxine }]
  });
  S('iodine', 'Iodine / kelp', 'Mineral', ['iodine', 'kelp', 'iodide', 'bladderwrack', 'seaweed supplement', 'lugol'], {
    what: 'Kelp and iodine products can contain large amounts of iodine.',
    excl: /povidone|betadine|topical|swab|contrast/i,
    ix: [{ g: ['levothyroxine', 'antithyroid', 'amiodarone'], sev: 'Moderate', title: 'Iodine / kelp with thyroid disease, thyroid drugs or amiodarone', why: 'Excess iodine can cause hypo- or hyperthyroidism.', todo: 'Advise stopping; check TSH.' },
      { g: ['lithium'], sev: 'Moderate', title: 'Iodine + lithium', why: 'Additive risk of hypothyroidism.', todo: 'Check TSH.' }]
  });

  // ----- Vitamins -----
  S('vitk', 'Vitamin K (K1 / K2, MK-7)', 'Vitamin', ['vitamin k2?', 'menaquinone', 'mk-?7', 'mk-?4', 'vit\\.? k'], {
    what: 'Often in bone-health products (K2 with D3). Phytonadione ordered for warfarin reversal is intended and is not flagged.',
    excl: /phytonadione|phytomenadione|konakion/i,
    ix: [{ g: ['warfarin'], sev: 'High', title: 'Vitamin K lowers the INR', why: 'Directly reverses warfarin; K2 (MK-7) is long-acting and potent even at 100 mcg.', todo: 'If taken regularly with a stable INR, keep it consistent rather than stopping suddenly; tell the anticoagulation clinic about any change. Check INR.' }]
  });
  S('mvi', 'Multivitamin (± minerals)', 'Vitamin', ['multivitamin', 'multi-vitamin', 'multivit', 'multi vitamin', '\\bmvi\\b', 'centrum', 'one a day', 'one-a-day', 'jamieson multi', 'prenatal vitamin', 'materna', 'vitamins and minerals'], {
    what: 'Most contain vitamin K (about 25–120 mcg) and minerals (calcium, iron, magnesium, zinc) that bind some oral drugs. Check the label.',
    ix: [{ g: ['warfarin'], sev: 'Low', title: 'Multivitamin with vitamin K and warfarin', why: 'Daily vitamin K changes INR if taken irregularly.', todo: 'Take it every day or not at all; check INR after a change.' }].concat(
      CHELATE.map(g => ({ g: [g], sev: 'Low', title: 'Multivitamin with minerals binds ' + GROUPS[g].label.toLowerCase(), why: 'If it contains Ca/Fe/Mg/Zn, less drug is absorbed.', todo: 'Space the doses.', space: SPACE[g] })),
      [{ g: ['retinoid'], sev: 'Moderate', title: 'Multivitamin with vitamin A + oral retinoid', why: 'Additive vitamin A toxicity.', todo: 'Use a product without vitamin A.' }])
  });
  S('vite', 'Vitamin E', 'Vitamin', ['vitamin e', 'tocopherol', 'vit\\.? e\\b'], {
    what: 'Antioxidant. At 400 IU/day or more it has an antiplatelet effect and may raise bleeding risk.',
    tags: ['bleed'],
    ix: [{ g: BLEED, sev: c => (c.dose.iu != null && c.dose.iu >= 400) ? 'Moderate' : 'Low', title: 'Vitamin E and bleeding risk', why: 'Antiplatelet effect at ≥ 400 IU/day; vitamin K antagonism at high doses.', todo: 'Advise ≤ 400 IU/day or stopping on antithrombotics.' }]
  });
  S('vita', 'Vitamin A', 'Vitamin', ['vitamin a\\b', 'retinol', 'retinyl', 'cod liver oil'], {
    what: 'Fat-soluble; toxic in excess (liver injury, raised intracranial pressure, bone loss). Cod liver oil contains vitamin A and D.',
    ix: [{ g: ['retinoid'], sev: 'Contraindicated', title: 'Vitamin A + oral retinoid', why: 'Additive vitamin A toxicity (raised intracranial pressure).', todo: 'Stop vitamin A supplements.' }],
    cond: [{ when: liverIssue, sev: 'Low', title: 'Vitamin A with liver disease', why: 'High doses are hepatotoxic.', todo: 'Avoid high-dose vitamin A.' }]
  });
  S('vitc', 'Vitamin C (high dose)', 'Vitamin', ['vitamin c', 'ascorbic acid', 'ascorbate', 'ester-c', 'vit\\.? c\\b'], {
    what: 'Safe at usual doses. High doses (≥ 1 g/day) raise urinary oxalate; IV high-dose vitamin C causes hemolysis in G6PD deficiency and falsely raises some bedside glucose meter readings.',
    cond: [{ when: c => isNum(c.pt.egfr) && c.pt.egfr < 30 && (c.dose.mg == null || c.dose.mg >= 1000), sev: 'Moderate', title: 'High-dose vitamin C with eGFR under 30', why: 'Oxalate nephropathy and stones reported.', todo: 'Advise ≤ 250 mg/day or stopping.' },
      { when: c => c.pt.g6pd, sev: 'Moderate', title: 'High-dose vitamin C with G6PD deficiency', why: 'Hemolysis with high (especially IV) doses.', todo: 'Avoid high doses; see the G6PD tab.' },
      { when: c => c.dose.mg != null && c.dose.mg >= 1000, sev: 'Low', title: 'High-dose vitamin C and iron absorption', why: 'Raises iron absorption (care with hemochromatosis).', todo: 'Usually no action.' }]
  });
  S('vitd', 'Vitamin D', 'Vitamin', ['vitamin d[23]?', 'cholecalciferol', 'ergocalciferol', 'd-vi-sol', 'ddrops', '\\bd3\\b', 'vit\\.? d'], {
    what: 'Few drug interactions. High doses with thiazides can cause hypercalcemia.',
    excl: /calcitriol|alfacalcidol|rocaltrol|one-alpha/i,
    ix: [{ g: ['thiazide'], sev: 'Low', title: 'Vitamin D + thiazide', why: 'Thiazides reduce urinary calcium; high-dose vitamin D can lead to hypercalcemia.', todo: 'Check Ca if high dose.' },
      { g: ['digoxin'], sev: 'Low', title: 'Vitamin D and digoxin', why: 'Hypercalcemia raises digoxin toxicity.', todo: 'Check Ca.' }],
    cond: [{ when: c => isNum(c.pt.ca) && c.pt.ca > 2.6, sev: 'Moderate', title: 'Vitamin D with high calcium', why: 'May be contributing to hypercalcemia.', todo: 'Hold vitamin D and calcium; check PTH, 25-OH vitamin D.' }]
  });
  S('biotin', 'Biotin (vitamin B7)', 'Vitamin', ['biotin', 'vitamin b7', 'vitamin h\\b', 'hair,? skin', 'hair skin and nails'], {
    what: 'Used for hair and nails (often 5–10 mg). No drug interactions, but it interferes with lab immunoassays that use biotin–streptavidin.',
    lab: true
  });
  S('b6', 'Vitamin B6 (pyridoxine)', 'Vitamin', ['pyridoxine', 'vitamin b6', 'vit\\.? b6', 'b-6'], {
    what: 'Long-term high doses (over ~100 mg/day) can cause sensory neuropathy. Pyridoxine given with isoniazid is intended.',
    ix: [{ g: ['levodopa'], sev: 'Low', title: 'B6 and levodopa', why: 'B6 reduces levodopa effect only without carbidopa/benserazide (rare now).', todo: 'No action with carbidopa-levodopa.' }]
  });
  S('folic', 'Folic acid', 'Vitamin', ['folic acid', 'folate', 'methylfolate', 'levomefolate', 'deplin'], {
    what: 'Can mask B12 deficiency anemia. Leucovorin (folinic acid) is a separate drug and is not flagged.',
    excl: /folinic|leucovorin/i,
    ix: [{ g: ['phenytoin'], sev: 'Low', title: 'Folic acid may lower phenytoin levels', why: 'Faster phenytoin metabolism.', todo: 'Check a phenytoin level if started or stopped.' },
      { g: ['methotrexate'], sev: 'Low', title: 'Folic acid and methotrexate', why: 'Intended with low-dose methotrexate (RA, psoriasis). For cancer doses, extra folate may reduce effect.', todo: 'Check the indication.' }]
  });
  S('niacin', 'Niacin (nicotinic acid)', 'Vitamin', ['niacin', 'nicotinic acid', 'niaspan', 'vitamin b3'], {
    what: 'High doses for cholesterol cause flushing, raise glucose and uric acid; sustained-release forms are hepatotoxic. Niacinamide does not.',
    excl: /niacinamide|nicotinamide/i,
    ix: [{ g: ['statin'], sev: 'Low', title: 'High-dose niacin + statin', why: 'Small added myopathy risk; no cardiovascular benefit in trials.', todo: 'Consider stopping niacin.' },
      { g: ['hypoglycemic', 'metformin'], sev: 'Low', title: 'Niacin raises glucose', why: 'Worse glucose control.', todo: 'Watch glucose.' }],
    cond: [{ when: liverIssue, sev: 'Moderate', title: 'Niacin with liver disease / raised ALT', why: 'Hepatotoxicity, especially sustained-release.', todo: 'Stop it.' }]
  });

  // ----- Minerals -----
  S('calcium', 'Calcium', 'Mineral', ['calcium carbonate', 'calcium citrate', 'calcium acetate', 'caltrate', '\\btums\\b', 'os-cal', 'oscal', 'calcium'], {
    what: 'Binds several oral drugs; high doses with vitamin D or thiazides can cause hypercalcemia (milk-alkali).',
    excl: /channel|gluconate|chloride|folinate|polystyrene|calcium score|ionized|\biv\b|intravenous|infusion|\bmmol\/l\b/i,
    tags: ['chel'],
    ix: chelIx('Calcium').concat([
      { g: ['thiazide'], sev: 'Low', title: 'Calcium + thiazide', why: 'Hypercalcemia / milk-alkali syndrome with high doses.', todo: 'Check Ca.' },
      { g: ['digoxin'], sev: 'Low', title: 'Calcium and digoxin', why: 'Hypercalcemia raises digoxin toxicity.', todo: 'Check Ca.' }]),
    cond: [{ when: c => isNum(c.pt.ca) && c.pt.ca > 2.6, sev: 'Moderate', title: 'Calcium supplement with high calcium', why: 'May be contributing to hypercalcemia.', todo: 'Hold calcium and vitamin D.' }]
  });
  S('iron', 'Iron (oral)', 'Mineral', ['ferrous', 'ferric', 'iron', 'feramax', 'proferrin', 'palafer', 'slow fe', 'heme iron', 'polysaccharide iron'], {
    what: 'Binds several oral drugs. Calcium, antacids, PPIs and tea reduce iron absorption. IV iron is not flagged.',
    excl: /sucrose|venofer|derisomaltose|monoferric|ferumoxytol|feraheme|dextran|carboxymaltose|ferinject|\biv\b|intravenous|infusion|\biron studies|tibc|ferritin/i,
    tags: ['chel'],
    ix: chelIx('Iron').concat([
      { g: ['levodopa'], sev: 'Moderate', title: 'Iron binds levodopa', why: 'Lower levodopa absorption → worse Parkinson control.', todo: 'Separate by at least 2 h.', space: SPACE.levodopa },
      { g: ['mmf'], sev: 'Low', title: 'Iron and mycophenolate', why: 'May lower mycophenolate absorption (evidence mixed).', todo: 'Separate by 2 h.', space: SPACE.mmf }])
  });
  S('magnesium', 'Magnesium (oral / antacid)', 'Mineral', ['magnesium oxide', 'magnesium citrate', 'magnesium glycinate', 'magnesium bisglycinate', 'magnesium hydroxide', 'milk of magnesia', 'maalox', 'diovol', 'mylanta', 'magnesium'], {
    what: 'Binds several oral drugs. Accumulates with kidney impairment. IV magnesium sulfate is not flagged.',
    excl: /sulfate|sulphate|\biv\b|intravenous|infusion|\bmmol\/l\b/i,
    tags: ['chel'],
    ix: chelIx('Magnesium').concat([
      { g: ['gabapentin'], sev: 'Low', title: 'Mg/Al antacid lowers gabapentin', why: 'About 20% less gabapentin absorbed.', todo: 'Give gabapentin at least 2 h after.', space: SPACE.gabapentin },
      { g: ['mmf'], sev: 'Low', title: 'Mg/Al antacid lowers mycophenolate', why: 'Lower absorption.', todo: 'Separate by 2 h.', space: SPACE.mmf }]),
    cond: [{ when: c => isNum(c.pt.egfr) && c.pt.egfr < 30, sev: 'Moderate', title: 'Magnesium supplement with eGFR under 30', why: 'Hypermagnesemia (weakness, hypotension, bradycardia).', todo: 'Avoid routine Mg supplements and Mg laxatives; check Mg.' },
      { when: c => isNum(c.pt.mg) && c.pt.mg > 1.1, sev: 'Moderate', title: 'Magnesium supplement with high Mg', why: 'Mg already high.', todo: 'Hold it.' }]
  });
  S('zinc', 'Zinc', 'Mineral', ['zinc gluconate', 'zinc sulfate', 'zinc sulphate', 'zinc citrate', 'zinc picolinate', 'cold-eeze', 'zinc'], {
    what: 'Binds quinolones, tetracyclines and integrase inhibitors. Long-term doses over 40 mg/day can cause copper deficiency (anemia, neutropenia, myelopathy).',
    excl: /zinc oxide|cream|ointment|paste|topical|calamine/i,
    tags: ['chel'],
    ix: ['quinolone', 'tetracycline', 'insti', 'eltrombopag'].map(g => ({ g: [g], sev: 'Moderate', title: 'Zinc binds ' + GROUPS[g].label.toLowerCase(), why: 'Less drug absorbed.', todo: 'Space the doses or hold zinc during the course.', space: SPACE[g] }))
  });
  S('potassium', 'Potassium supplement / salt substitute', 'Mineral', ['potassium chloride', 'kcl', 'k-dur', 'slow-k', 'micro-k', 'k-lyte', 'potassium citrate', 'potassium gluconate', 'salt substitute', 'no salt', 'nosalt', 'nu-salt', 'lo salt', 'half salt', 'potassium'], {
    what: 'Includes "low-sodium" salt substitutes (mostly potassium chloride). IV potassium is not flagged.',
    excl: /\biv\b|intravenous|infusion|in (ns|d5w|normal saline|ringer)|\bmmol\/l\b|bag/i,
    ix: [{ g: ['ksparing'], sev: c => (c.lowGfr || c.highK) ? 'High' : 'Moderate', title: 'Potassium + K-sparing diuretic / MRA', why: 'Hyperkalemia.', todo: 'Stop the potassium (or salt substitute) unless K is low; check K.' },
      { g: ['acei_arb'], sev: c => (c.lowGfr || c.highK) ? 'High' : 'Moderate', title: 'Potassium + ACE inhibitor / ARB / ARNI', why: 'Hyperkalemia, worse with CKD or with an MRA.', todo: 'Check K; stop the supplement / salt substitute unless K is low.' },
      { g: ['tmp'], sev: 'Moderate', title: 'Potassium + trimethoprim', why: 'Trimethoprim blocks renal K excretion.', todo: 'Check K in 2–3 days.' },
      { g: ['cni', 'heparin'], sev: 'Low', title: 'Potassium + calcineurin inhibitor / heparin', why: 'Both raise K.', todo: 'Check K.' }],
    cond: [{ when: c => c.highK, sev: 'High', title: 'Potassium supplement with K over 5.0', why: 'K already high.', todo: 'Stop the supplement / salt substitute.' },
      { when: c => c.pt.egfr != null && c.pt.egfr < 30 && !c.highK, sev: 'Moderate', title: 'Potassium supplement with eGFR under 30', why: 'Hyperkalemia risk.', todo: 'Check K; advise against salt substitutes.' }]
  });
  S('fishoil', 'Fish oil / omega-3', 'Other', ['fish oil', 'omega-3', 'omega 3', 'omega3', 'krill oil', 'epa\\b', 'dha\\b', 'icosapent', 'vascepa', 'lovaza', 'algal oil'], {
    what: 'Small antiplatelet effect. At usual doses (≤ 3 g/day) the added bleeding risk is small.',
    tags: ['bleed'],
    ix: [{ g: BLEED, sev: c => (c.dose.mg != null && c.dose.mg >= 3000) ? 'Moderate' : 'Low', title: 'Fish oil and bleeding', why: 'Mild antiplatelet effect; clinically small at ≤ 3 g/day (more AF with high-dose icosapent).', todo: 'Usually fine; consider holding with active bleeding, dual antithrombotics or before surgery.' }]
  });
  S('melatonin', 'Melatonin', 'Other', ['melatonin'], {
    what: 'Used for sleep. Few interactions; next-day drowsiness in older adults.', tags: ['sed'],
    ix: [{ g: ['fluvoxamine'], sev: 'Moderate', title: 'Fluvoxamine raises melatonin levels', why: 'CYP1A2 inhibition raises melatonin many-fold → oversedation.', todo: 'Use a much lower melatonin dose or avoid.' },
      { g: ['sedative'], sev: c => (c.pt.age >= 75 ? 'Moderate' : 'Low'), title: 'Melatonin + sedating drug', why: 'Additive sedation; falls and delirium in older adults.', todo: 'Use the lowest dose (0.5–2 mg); reassess the need for other sedatives.' },
      { g: ['warfarin'], sev: 'Low', title: 'Melatonin and warfarin', why: 'Case reports of INR change.', todo: 'Check INR if started or stopped.' }]
  });

  // ---------------- matching ----------------
  const SALT = /\b(\w*(?:statin|prazole|sartan|fenac|cillin|thyroxine|warfarin|naproxen|montelukast|dronate|phenytoin|valproate|divalproex|heparin|parin|mycophenolate|folinate|leucovorin|sulfonate|levomefolate|clavulanate|penicillin v|diclofenac|losartan))\s+(calcium|magnesium|potassium|sodium)\b/ig;
  function clean(text) { return String(text || '').toLowerCase().replace(SALT, '$1').replace(/[’`]/g, "'"); }
  const mkRe = terms => new RegExp('(^|[^a-z0-9])(' + terms.join('|') + ')(?![a-z])', 'i');
  SUPPS.forEach(s => { s.re = mkRe(s.terms); });
  Object.values(GROUPS).forEach(g => { if (g.terms.length) g.re = mkRe(g.terms.map(t => t.replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&'))); });
  /** All supplements named in one line of text (a combination product can name several). */
  function matchSupps(text) {
    const t = clean(text);
    if (!t.trim()) return [];
    return SUPPS.filter(s => s.re.test(t) && !(s.excl && s.excl.test(t)));
  }
  function matchSupp(text) { return matchSupps(text)[0] || null; }
  function groupsOf(text) {
    const t = clean(text), out = [];
    Object.values(GROUPS).forEach(g => { if (g.re && g.re.test(t)) out.push(g.key); });
    return out;
  }
  function parseDose(text) {
    const t = String(text || '').toLowerCase().replace(/,(\d{3})/g, '$1');
    const d = { mg: null, iu: null };
    let m = t.match(/(\d+(?:\.\d+)?)\s*(?:iu|units?)\b/); if (m) d.iu = parseFloat(m[1]);
    m = t.match(/(\d+(?:\.\d+)?)\s*mg\b/); if (m) d.mg = parseFloat(m[1]);
    else if ((m = t.match(/(\d+(?:\.\d+)?)\s*(?:mcg|µg|ug)\b/))) d.mg = parseFloat(m[1]) / 1000;
    else if ((m = t.match(/(\d+(?:\.\d+)?)\s*g\b/))) d.mg = parseFloat(m[1]) * 1000;
    return d;
  }

  /** Find supplement names in free text (notes). Returns [{key, name, snippet}] – first hit per supplement. */
  const GENERIC = /\b(supplements?|herbals?|natural (health )?products?|naturopath\w*|vitamins|otc products?|over[- ]the[- ]counter)\b/ig;
  // In notes, vitamins and minerals are also lab names ("potassium 3.2", "vitamin D level", "iron deficiency"),
  // so for those a dose or a supplement word must follow, and a lab unit must not.
  const STRICT = s => s.cls === 'Vitamin' || s.cls === 'Mineral' || ['fishoil', 'probiotic', 'melatonin', 'coq10'].indexOf(s.key) >= 0;
  const DOSE_AFTER = /^[^.\n]{0,40}?(\d+(\.\d+)?\s*(mg|mcg|µg|ug|iu|units?|g|meq|mmol)\b|\btabs?\b|\btablets?\b|\bcaps?\b|capsules?|softgels?|gumm|supplement|\bdaily\b|\botc\b|\bpo\b|\bbid\b|\bonce a day\b|over the counter)/i;
  const LAB_AFTER = /^[^.\n]{0,25}?(mmol\/l|µmol|umol|nmol|pmol|ng\/ml|g\/l|ug\/l|µg\/l|level|deficien|studies|panel|saturation|low\b|high\b|normal|replace|repletion|protocol|sliding)/i;
  function scanText(text, label) {
    const t = String(text || ''), low = clean(t), hits = [], other = [];
    SUPPS.forEach(s => {
      const re = new RegExp(s.re.source, 'ig'); let m;
      while ((m = re.exec(low))) {
        const at = m.index + m[1].length, end = at + m[2].length;
        const snip = t.slice(Math.max(0, at - 70), Math.min(t.length, end + 70)).replace(/\s+/g, ' ');
        if (s.excl && s.excl.test(low.slice(Math.max(0, at - 25), end + 25))) continue;
        if (/\b(no|denies|denied|not taking|not on|stopped|discontinued|without|avoid)\b[^.]{0,25}$/i.test(t.slice(Math.max(0, at - 30), at))) continue;
        if (STRICT(s)) { const after = low.slice(end, end + 60); if (!DOSE_AFTER.test(after) || LAB_AFTER.test(after)) continue; }
        hits.push({ key: s.key, name: s.name, snippet: snip, label, text: t.slice(at, end + 30).split(/[\n;,]/)[0].trim() });
        break;
      }
    });
    let g; GENERIC.lastIndex = 0;
    while ((g = GENERIC.exec(t)) && other.length < 3) other.push({ label, snippet: t.slice(Math.max(0, g.index - 80), g.index + 100).replace(/\s+/g, ' ') });
    return { hits, other };
  }

  const SEV_ORDER = { Contraindicated: 0, High: 1, Moderate: 2, Low: 3 };
  const BIOTIN_TESTS = 'troponin, TSH / free T4 / free T3, PTH, BNP / NT-proBNP, hCG, cortisol, ferritin, vitamin D, testosterone/estradiol and some tumour markers';

  /**
   * analyze({ meds:[{text}], supps:[{text, source, snippet, label}], pt:{age, egfr, k, ca, mg, alt, inr, plt, anc, liver, transplant,
   *           immunosupp, seizureHx, htn, hf, surgery, centralLine, g6pd, trop, thyroidTest} })
   */
  function analyze(input) {
    const pt = Object.assign({}, input.pt || {});
    const meds = [], suppMap = {}, unmatched = [];
    const addSupp = (s, src) => {
      const x = suppMap[s.key] = suppMap[s.key] || { supp: s, sources: [], texts: [], dose: { mg: null, iu: null }, snippets: [] };
      if (x.sources.indexOf(src.source) < 0) x.sources.push(src.source);
      if (src.text && x.texts.indexOf(src.text) < 0) x.texts.push(src.text);
      if (src.snippet) x.snippets.push({ label: src.label || '', snippet: src.snippet });
      const d = parseDose(src.text);
      if (d.mg != null && (x.dose.mg == null || d.mg > x.dose.mg)) x.dose.mg = d.mg;
      if (d.iu != null && (x.dose.iu == null || d.iu > x.dose.iu)) x.dose.iu = d.iu;
    };
    (input.meds || []).forEach(m => {
      if (!m.text || !m.text.trim()) return;
      const ss = matchSupps(m.text), gs = groupsOf(m.text);
      ss.forEach(s => addSupp(s, { source: m.source || 'chart', text: m.text }));
      if (gs.length || !ss.length) meds.push({ text: m.text, groups: gs }); // a combination product (e.g. alendronate + vitamin D) is both
    });
    (input.supps || []).forEach(x => {
      const ss = x.key ? SUPPS.filter(y => y.key === x.key) : matchSupps(x.text);
      if (ss.length) ss.forEach(s => addSupp(s, x));
      else if (x.text && x.text.trim() && unmatched.indexOf(x.text.trim()) < 0) unmatched.push(x.text.trim());
    });
    const supps = Object.values(suppMap);
    const partners = gs => meds.filter(m => m.groups.some(g => gs.indexOf(g) >= 0));
    const has = gs => partners(gs).length > 0;
    const findings = [];
    const lowGfr = isNum(pt.egfr) && pt.egfr < 45, highK = isNum(pt.k) && pt.k > 5.0;

    supps.forEach(x => {
      const s = x.supp;
      const ctx = { pt, dose: x.dose, has, lowGfr, highK };
      (s.ix || []).forEach(r => {
        const p = partners(r.g); if (!p.length) return;
        const sev = typeof r.sev === 'function' ? r.sev(ctx) : r.sev;
        findings.push({ kind: 'drug', supp: s.key, suppName: s.name, sev, title: r.title, partners: p.map(m => m.text), why: r.why, todo: r.todo, space: r.space || '', sources: x.sources });
      });
      (s.cond || []).forEach(r => {
        if (!r.when(ctx)) return;
        findings.push({ kind: 'patient', supp: s.key, suppName: s.name, sev: r.sev, title: r.title, partners: [], why: r.why, todo: r.todo, sources: x.sources });
      });
      if (s.lab) {
        const hi = x.dose.mg == null || x.dose.mg >= 1;
        const sev = pt.trop ? 'High' : (pt.thyroidTest ? 'Moderate' : (hi ? 'Moderate' : 'Low'));
        findings.push({ kind: 'lab', supp: s.key, suppName: s.name, sev,
          title: pt.trop ? 'Biotin can falsely LOWER troponin (missed MI)' : 'Biotin interferes with lab immunoassays',
          partners: [], sources: x.sources,
          why: 'High-dose biotin (often 5–10 mg in hair/nail products) distorts biotin–streptavidin assays: falsely low troponin; thyroid tests that mimic hyperthyroidism (low TSH, high FT4/FT3); also ' + BIOTIN_TESTS + '. Effect depends on the lab platform.' + (x.dose.mg != null ? ' Dose recorded: ' + (x.dose.mg >= 1 ? x.dose.mg + ' mg' : Math.round(x.dose.mg * 1000) + ' mcg') + '.' : ' Dose not recorded – ask.'),
          todo: 'Ask the dose and time of the last dose; tell the lab (they can use a non-biotin assay). Stop biotin and repeat affected tests after a washout – at least 8 h for low doses, ideally 48–72 h after 5–10 mg or more, longer with kidney impairment. Do not rule out MI on one normal troponin.' });
      }
    });

    // Supplement stacking
    const bleedS = supps.filter(x => (x.supp.tags || []).indexOf('bleed') >= 0);
    if (bleedS.length >= 2 && has(BLEED)) findings.push({ kind: 'stack', supp: 'stack', suppName: bleedS.map(x => x.supp.name).join(' + '), sev: has(ANTICOAG) ? 'High' : 'Moderate',
      title: bleedS.length + ' bleeding-risk supplements with an antithrombotic', partners: partners(BLEED).map(m => m.text), why: 'Each adds a small antiplatelet effect; together with an anticoagulant or antiplatelet the risk adds up.', todo: 'Stop the non-essential ones, especially before surgery or with falls risk.', sources: [] });
    const ssS = supps.filter(x => (x.supp.tags || []).indexOf('ss') >= 0);
    if (ssS.length >= 2) findings.push({ kind: 'stack', supp: 'stack', suppName: ssS.map(x => x.supp.name).join(' + '), sev: 'Moderate', title: 'Two serotonergic supplements', partners: [], why: 'Additive serotonergic effect.', todo: 'Use one at most; watch for serotonin toxicity.', sources: [] });
    const sedS = supps.filter(x => (x.supp.tags || []).indexOf('sed') >= 0);
    if (sedS.length >= 2) findings.push({ kind: 'stack', supp: 'stack', suppName: sedS.map(x => x.supp.name).join(' + '), sev: pt.age >= 75 ? 'Moderate' : 'Low', title: 'Several sedating supplements', partners: [], why: 'Additive sedation; falls and delirium in older adults.', todo: 'Reduce to one, at the lowest dose.', sources: [] });
    if (supps.some(x => x.supp.key === 'calcium') && supps.some(x => x.supp.key === 'iron')) findings.push({ kind: 'stack', supp: 'stack', suppName: 'Calcium + Iron', sev: 'Low', title: 'Calcium reduces iron absorption', partners: [], why: 'Taken together, less iron is absorbed.', todo: 'Separate by at least 2 h (iron in the morning, calcium with supper).', space: 'Separate calcium and iron by at least 2 h.', sources: [] });

    // Pre-op
    const preop = supps.filter(x => x.supp.preop || (x.supp.tags || []).indexOf('bleed') >= 0).map(x => ({ key: x.supp.key, name: x.supp.name, text: x.supp.preop || 'Consider holding before surgery (antiplatelet effect).' }));
    if (surgery({ pt }) && preop.length) findings.push({ kind: 'surgery', supp: 'surgery', suppName: preop.map(p => p.name).join(', '), sev: 'Moderate', title: 'Surgery planned: supplements to hold', partners: [], why: preop.map(p => p.name + ': ' + p.text).join(' '), todo: 'Stop them now and tell anesthesia. For urgent surgery such as hip fracture, do not delay surgery for a supplement washout.', sources: [] });

    // de-duplicate (same supplement + title), keep the worst
    const seen = {};
    const out = [];
    findings.sort((a, b) => SEV_ORDER[a.sev] - SEV_ORDER[b.sev]).forEach(f => { const k = f.supp + '|' + f.title; if (seen[k]) return; seen[k] = 1; out.push(f); });
    const spacing = out.filter(f => f.space).map(f => ({ supp: f.suppName, partners: f.partners, text: f.space, sev: f.sev }));
    return { supps, meds, findings: out, unmatched, spacing, preop };
  }

  function ckdEpi2021(scr, age, sex) {
    if (!scr || !age || !sex) return null;
    const cr = scr / 88.4, f = sex === 'female';
    const k = f ? 0.7 : 0.9, a = f ? -0.241 : -0.302;
    const e = 142 * Math.pow(Math.min(cr / k, 1), a) * Math.pow(Math.max(cr / k, 1), -1.2) * Math.pow(0.9938, age) * (f ? 1.012 : 1);
    return Math.round(e);
  }

  const COMMON = ['vitd', 'calcium', 'mvi', 'fishoil', 'magnesium', 'iron', 'melatonin', 'biotin', 'turmeric', 'probiotic', 'glucosamine', 'coq10', 'sjw', 'ginkgo', 'cbd', 'vitk'];
  const api = { SUPPS, GROUPS, COMMON, SPACE, matchSupp, matchSupps, groupsOf, parseDose, scanText, analyze, ckdEpi2021, SEV_ORDER, clean };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.SUPP = api;
})(typeof window !== 'undefined' ? window : this);
