/* AGS 2023 Beers Criteria data, transcribed from the supplied paper (J Am Geriatr Soc 2023, Tables 2-8).
   Matching is by generic/brand name text, so always verify results clinically.
   sev: "avoid" | "conditional" (avoid in some situations) | "caution" (Table 4). q = quality of evidence, s = strength. */

const C = {
  antihist: ["brompheniramine","chlorpheniramine","cyproheptadine","dimenhydrinate","diphenhydramine","doxylamine","hydroxyzine","meclizine","promethazine","triprolidine"],
  tcaAD: ["amitriptyline","amoxapine","clomipramine","desipramine","doxepin","imipramine","nortriptyline","paroxetine"],
  tcaAll: ["amitriptyline","amoxapine","clomipramine","desipramine","doxepin","imipramine","nortriptyline","protriptyline","trimipramine"],
  tcaTert: ["amitriptyline","clomipramine","doxepin","imipramine"],
  parkAC: ["benztropine","trihexyphenidyl"],
  antipsych: ["aripiprazole","brexpiprazole","cariprazine","chlorpromazine","clozapine","fluphenazine","haloperidol","lurasidone","olanzapine","paliperidone","perphenazine","pimavanserin","quetiapine","risperidone","ziprasidone"],
  barb: ["butalbital","phenobarbital","primidone"],
  benzo: ["alprazolam","chlordiazepoxide","clobazam","clonazepam","clorazepate","diazepam","estazolam","lorazepam","midazolam","oxazepam","temazepam","triazolam"],
  zdrug: ["eszopiclone","zaleplon","zolpidem"],
  alpha1: ["doxazosin","prazosin","terazosin"],
  sulfonylurea: ["gliclazide","glimepiride","glipizide","glyburide","glibenclamide"],
  ppi: ["dexlansoprazole","esomeprazole","lansoprazole","omeprazole","pantoprazole","rabeprazole"],
  spasm: ["atropine","clidinium","dicyclomine","homatropine","hyoscyamine","scopolamine"],
  nsaid: ["diclofenac","diflunisal","etodolac","flurbiprofen","ibuprofen","indomethacin","ketorolac","meloxicam","nabumetone","naproxen","oxaprozin","piroxicam","sulindac"],
  smr: ["carisoprodol","chlorzoxazone","cyclobenzaprine","metaxalone","methocarbamol","orphenadrine"],
  opioid: ["buprenorphine","codeine","fentanyl","hydrocodone","hydromorphone","meperidine","methadone","morphine","oxycodone","oxymorphone","tapentadol","tramadol"],
  gaba: ["gabapentin","pregabalin"],
  aed: ["carbamazepine","oxcarbazepine","phenytoin","valproate","divalproex","lamotrigine","levetiracetam","topiramate","lacosamide","zonisamide","phenobarbital","primidone","gabapentin","pregabalin"],
  ssri: ["citalopram","escitalopram","fluoxetine","fluvoxamine","paroxetine","sertraline"],
  snri: ["venlafaxine","desvenlafaxine","duloxetine","levomilnacipran"],
  diuretic: ["furosemide","bumetanide","torsemide","ethacrynic","hydrochlorothiazide","chlorthalidone","indapamide","metolazone","spironolactone","triamterene","amiloride","eplerenone"],
  loop: ["furosemide","bumetanide","torsemide","ethacrynic"],
  acei: ["benazepril","captopril","enalapril","fosinopril","lisinopril","moexipril","perindopril","quinapril","ramipril","trandolapril"],
  arni: ["sacubitril"],
  arb: ["azilsartan","candesartan","eprosartan","irbesartan","losartan","olmesartan","telmisartan","valsartan"],
  cortico: ["prednisone","prednisolone","methylprednisolone","dexamethasone","hydrocortisone","cortisone","betamethasone"],
  h2: ["cimetidine","famotidine","nizatidine"],
  achei: ["donepezil","galantamine","rivastigmine"],
  sglt2: ["canagliflozin","dapagliflozin","empagliflozin","ertugliflozin"],
  estrogen: ["estradiol","conjugated estrogens","esterified estrogens","estropipate","premarin"],
  insFast: ["insulin lispro","insulin aspart","insulin glulisine","insulin regular","regular insulin","humalog","novolog","apidra","humulin r","novolin r"],
  insBasal: ["glargine","detemir","degludec","nph","isophane","lantus","levemir","tresiba","toujeo","basaglar","humulin n","novolin n"],
  table8: ["carbinoxamine","clemastine","dexbrompheniramine","dexchlorpheniramine","pyrilamine","belladonna","methscopolamine","propantheline","guanabenz","methyldopa","reserpine","disopyramide","protriptyline","trimipramine","amobarbital","butabarbital","mephobarbital","pentobarbital","secobarbital","flurazepam","quazepam","isoxsuprine","chlorpropamide","fenoprofen","ketoprofen","meclofenamate","mefenamic","tolmetin","rosiglitazone","thioridazine","ranitidine","loxapine","trifluoperazine"]
};
C.ras = [...C.acei, ...C.arni, ...C.arb];
C.rasK = [...C.ras, "aliskiren", "amiloride", "triamterene"];
// Table 7 strongly anticholinergic drugs
C.ach = [...C.tcaAD, "prochlorperazine", "promethazine", ...C.antihist, "darifenacin","fesoterodine","flavoxate","oxybutynin","solifenacin","tolterodine","trospium", ...C.parkAC, "chlorpromazine","clozapine","olanzapine","perphenazine", ...C.spasm, "cyclobenzaprine","orphenadrine"];
// CNS-active classes for the "3 or more CNS-active drugs" criterion (Table 5)
C.cns = [...C.aed, ...C.tcaAll, ...C.ssri, ...C.snri, ...C.antipsych, ...C.benzo, ...C.zdrug, ...C.opioid, ...C.smr];

// Brand name -> generic (appended to the text before matching)
const ALIAS = {
  benadryl:"diphenhydramine", "tylenol pm":"diphenhydramine", unisom:"doxylamine", atarax:"hydroxyzine", vistaril:"hydroxyzine", antivert:"meclizine", phenergan:"promethazine",
  macrobid:"nitrofurantoin", macrodantin:"nitrofurantoin", coumadin:"warfarin", jantoven:"warfarin", xarelto:"rivaroxaban", pradaxa:"dabigatran", brilinta:"ticagrelor", effient:"prasugrel",
  cardura:"doxazosin", minipress:"prazosin", hytrin:"terazosin", catapres:"clonidine", procardia:"nifedipine", cordarone:"amiodarone", pacerone:"amiodarone", multaq:"dronedarone", lanoxin:"digoxin",
  elavil:"amitriptyline", pamelor:"nortriptyline", tofranil:"imipramine", paxil:"paroxetine", zoloft:"sertraline", lexapro:"escitalopram", celexa:"citalopram", prozac:"fluoxetine", effexor:"venlafaxine", cymbalta:"duloxetine",
  cogentin:"benztropine", abilify:"aripiprazole", haldol:"haloperidol", zyprexa:"olanzapine", seroquel:"quetiapine", risperdal:"risperidone",
  ativan:"lorazepam", xanax:"alprazolam", valium:"diazepam", klonopin:"clonazepam", restoril:"temazepam", ambien:"zolpidem", lunesta:"eszopiclone", sonata:"zaleplon",
  glucotrol:"glipizide", amaryl:"glimepiride", diabeta:"glyburide", glynase:"glyburide", prilosec:"omeprazole", nexium:"esomeprazole", prevacid:"lansoprazole", protonix:"pantoprazole", aciphex:"rabeprazole",
  reglan:"metoclopramide", bentyl:"dicyclomine", levsin:"hyoscyamine", ditropan:"oxybutynin", detrol:"tolterodine", vesicare:"solifenacin",
  motrin:"ibuprofen", advil:"ibuprofen", aleve:"naproxen", naprosyn:"naproxen", mobic:"meloxicam", voltaren:"diclofenac", toradol:"ketorolac", indocin:"indomethacin", celebrex:"celecoxib",
  flexeril:"cyclobenzaprine", soma:"carisoprodol", robaxin:"methocarbamol", skelaxin:"metaxalone", norflex:"orphenadrine", demerol:"meperidine",
  jardiance:"empagliflozin", farxiga:"dapagliflozin", invokana:"canagliflozin", steglatro:"ertugliflozin", neurontin:"gabapentin", lyrica:"pregabalin", ultram:"tramadol",
  bactrim:"sulfamethoxazole trimethoprim", septra:"sulfamethoxazole trimethoprim", "sulfamethoxazole-trimethoprim":"sulfamethoxazole trimethoprim", lasix:"furosemide", lithobid:"lithium", dilantin:"phenytoin",
  armour:"desiccated thyroid", "np thyroid":"desiccated thyroid", "thyroid tablets":"desiccated thyroid", ddavp:"desmopressin", megace:"megestrol", persantine:"dipyridamole", cipro:"ciprofloxacin", biaxin:"clarithromycin"
};

// ---- Tables 2 and 4: drugs/classes to avoid or use with caution (independent of diagnosis) ----
const R_DRUG = [
  {t:2,title:"First-generation antihistamines",d:C.antihist,sev:"avoid",rec:"Avoid. Diphenhydramine may be appropriate for acute treatment of severe allergic reactions.",why:"Highly anticholinergic; confusion, constipation, falls, delirium and dementia risk.",q:"Moderate",s:"Strong",skip:/topical|cream|gel|ointment|ophthalm|otic/},
  {t:2,title:"Nitrofurantoin",d:["nitrofurantoin"],sev:"conditional",rec:"Avoid if CrCl <30 mL/min or for long-term suppression.",why:"Pulmonary toxicity, hepatotoxicity, peripheral neuropathy with long-term use.",q:"Low",s:"Strong"},
  {t:2,title:"Aspirin for primary prevention of CVD",d:["aspirin"],sev:"conditional",rec:"Avoid initiating for primary prevention; consider deprescribing if already taking. Generally indicated for secondary prevention.",why:"Major bleeding risk rises markedly with age; lack of net benefit.",q:"High",s:"Strong",cav:"Verify the indication (primary vs secondary prevention)."},
  {t:2,title:"Warfarin for AF or VTE",d:["warfarin"],sev:"conditional",rec:"Avoid starting as initial therapy unless DOACs are contraindicated or have substantial barriers. Reasonable to continue long-term if INR well controlled (>70% time in range) and no adverse effects.",why:"Higher bleeding risk (esp. intracranial) than DOACs with similar or lower effectiveness.",q:"High",s:"Strong"},
  {t:2,title:"Rivaroxaban (long-term AF/VTE)",d:["rivaroxaban"],sev:"avoid",rec:"Avoid for long-term treatment of nonvalvular AF or VTE in favor of safer anticoagulants (may be reasonable in special situations, e.g. once-daily dosing needed for adherence).",why:"Higher risk of major and GI bleeding than other DOACs, particularly apixaban.",q:"Moderate",s:"Strong"},
  {t:2,title:"Dipyridamole, oral short-acting",d:["dipyridamole"],sev:"avoid",rec:"Avoid (does not apply to the extended-release combination with aspirin).",why:"May cause orthostatic hypotension; more effective alternatives exist.",q:"Moderate",s:"Strong",skip:/aspirin|aggrenox|extended/},
  {t:2,title:"Non-selective peripheral alpha-1 blockers",d:C.alpha1,sev:"conditional",rec:"Avoid use as an antihypertensive.",why:"High risk of orthostatic hypotension and associated harms.",q:"Moderate",s:"Strong"},
  {t:2,title:"Central alpha-agonists",d:["clonidine","guanfacine"],sev:"conditional",rec:"Avoid clonidine as first-line for hypertension; avoid other central alpha-agonists for hypertension.",why:"High risk of CNS adverse effects, bradycardia, orthostatic hypotension.",q:"Low",s:"Strong"},
  {t:2,title:"Nifedipine, immediate release",d:["nifedipine"],sev:"conditional",rec:"Avoid immediate-release nifedipine.",why:"Potential for hypotension and precipitating myocardial ischemia.",q:"High",s:"Strong",skip:/extended|\ber\b|\bxl\b|\bsr\b|\bcc\b|sustained|24 hr/},
  {t:2,title:"Amiodarone",d:["amiodarone"],sev:"conditional",rec:"Avoid as first-line AF therapy unless heart failure or substantial LVH.",why:"Greater toxicities than other antiarrhythmics used in AF.",q:"High",s:"Strong"},
  {t:2,title:"Dronedarone",d:["dronedarone"],sev:"conditional",rec:"Avoid in permanent AF or severe/recently decompensated HF. Caution in HFrEF with NYHA I-II symptoms.",why:"Worse outcomes in permanent AF and heart failure.",q:"High",s:"Strong"},
  {t:2,title:"Digoxin",d:["digoxin"],sev:"conditional",rec:"Avoid as first-line therapy for AF or heart failure. If used, avoid doses >0.125 mg/day.",why:"Safer, more effective alternatives; higher doses add toxicity without benefit; renal clearance decreases with age.",q:"AF/HF: Low; dose >0.125 mg: Moderate",s:"Strong"},
  {t:2,title:"Antidepressants with strong anticholinergic activity",d:C.tcaAD,sev:"avoid",rec:"Avoid (doxepin ≤6 mg/day is acceptable).",why:"Highly anticholinergic, sedating, cause orthostatic hypotension.",q:"High",s:"Strong",cav:"Doxepin: only >6 mg/day is a PIM. Verify dose."},
  {t:2,title:"Antiparkinsonian agents with strong anticholinergic activity",d:C.parkAC,sev:"avoid",rec:"Avoid (oral benztropine, trihexyphenidyl).",why:"Not recommended for EPS from antipsychotics; better agents exist for Parkinson disease.",q:"Moderate",s:"Strong",skip:/inject|\biv\b|\bim\b/},
  {t:2,title:"Antipsychotics (first and second generation)",d:C.antipsych,sev:"conditional",rec:"Avoid except for FDA-approved indications (e.g. schizophrenia, bipolar disorder, Parkinson disease psychosis, adjunct in MDD, short-term antiemetic). Avoid for behavioral problems of dementia/delirium unless nonpharmacologic options have failed and there is risk of substantial harm.",why:"Increased risk of stroke, cognitive decline and mortality in dementia.",q:"Moderate",s:"Strong"},
  {t:2,title:"Barbiturates",d:C.barb,sev:"avoid",rec:"Avoid.",why:"High rate of physical dependence, tolerance, greater overdose risk at low doses.",q:"High",s:"Strong",cav:"Phenobarbital/primidone are also used as antiepileptics; confirm indication."},
  {t:2,title:"Benzodiazepines",d:C.benzo,sev:"avoid",rec:"Avoid. May be appropriate for seizure disorders, REM sleep behavior disorder, benzodiazepine or ethanol withdrawal, severe generalized anxiety, periprocedural anesthesia.",why:"Abuse, misuse, addiction; cognitive impairment, delirium, falls, fractures, crashes; profound sedation with opioids.",q:"Moderate",s:"Strong"},
  {t:2,title:"Nonbenzodiazepine hypnotics (Z-drugs)",d:C.zdrug,sev:"avoid",rec:"Avoid.",why:"Adverse events similar to benzodiazepines (delirium, falls, fractures); minimal sleep benefit.",q:"Moderate",s:"Strong"},
  {t:2,title:"Meprobamate",d:["meprobamate"],sev:"avoid",rec:"Avoid.",why:"High rate of physical dependence; very sedating.",q:"Moderate",s:"Strong"},
  {t:2,title:"Ergoloid mesylates",d:["ergoloid"],sev:"avoid",rec:"Avoid.",why:"Lack of efficacy.",q:"High",s:"Strong"},
  {t:2,title:"Androgens",d:["methyltestosterone","testosterone"],sev:"conditional",rec:"Avoid unless indicated for confirmed hypogonadism with clinical symptoms.",why:"Potential cardiac problems; risks in men with prostate cancer.",q:"Moderate",s:"Weak"},
  {t:2,title:"Estrogens with or without progestins",d:C.estrogen,sev:"conditional",rec:"Do not initiate systemic (oral/transdermal) estrogen; consider deprescribing. Low-dose vaginal estrogen is acceptable.",why:"Carcinogenic potential (breast, endometrium); no cardioprotective or cognitive benefit.",q:"Oral/patch: High",s:"Oral/patch: Strong",skip:/vagin|cream|ring|ovule|estring|vagifem/},
  {t:2,title:"Insulin, sliding scale (no basal insulin)",d:C.insFast,absent:C.insBasal,sev:"conditional",rec:"Avoid regimens with only short/rapid-acting insulin dosed to current glucose without basal or long-acting insulin.",why:"Higher hypoglycemia risk without improved glycemic control.",q:"Moderate",s:"Strong",cav:"Flagged because no basal insulin was found on the list; confirm it is a sliding-scale-only regimen."},
  {t:2,title:"Sulfonylureas",d:C.sulfonylurea,sev:"conditional",rec:"Avoid as first- or second-line monotherapy or add-on unless substantial barriers to safer agents. If used, prefer short-acting (e.g. glipizide) over long-acting (glyburide, glimepiride).",why:"Higher risk of CV events, all-cause mortality and hypoglycemia.",q:"Hypoglycemia: High; CV/mortality: Moderate",s:"Strong"},
  {t:2,title:"Desiccated thyroid",d:["desiccated thyroid"],sev:"avoid",rec:"Avoid.",why:"Cardiac effects; safer alternatives available.",q:"Low",s:"Strong"},
  {t:2,title:"Megestrol",d:["megestrol"],sev:"avoid",rec:"Avoid.",why:"Minimal effect on weight; increases thrombotic events and possibly death.",q:"Moderate",s:"Strong"},
  {t:2,title:"Growth hormone",d:["somatropin"],sev:"conditional",rec:"Avoid except for rigorously diagnosed GH deficiency with established etiology.",why:"Small body-composition effect; edema, arthralgia, carpal tunnel, impaired fasting glucose.",q:"High",s:"Strong"},
  {t:2,title:"Proton-pump inhibitors",d:C.ppi,sev:"conditional",rec:"Avoid scheduled use >8 weeks unless high-risk (e.g. chronic NSAID/oral steroid use), erosive esophagitis, Barrett's, pathologic hypersecretion, or failed discontinuation trial.",why:"C. difficile infection, pneumonia, GI malignancies, bone loss and fractures.",q:"C. diff/fractures: High; pneumonia/GI cancer: Moderate",s:"Strong",cav:"Check duration and indication."},
  {t:2,title:"Metoclopramide",d:["metoclopramide"],sev:"conditional",rec:"Avoid unless for gastroparesis, and not >12 weeks except in rare cases.",why:"Extrapyramidal effects including tardive dyskinesia.",q:"Moderate",s:"Strong"},
  {t:2,title:"GI antispasmodics (strongly anticholinergic)",d:C.spasm,sev:"avoid",rec:"Avoid (atropine excluding ophthalmic, clidinium-chlordiazepoxide, dicyclomine, hyoscyamine, scopolamine).",why:"Highly anticholinergic with uncertain effectiveness.",q:"Moderate",s:"Strong",skip:/ophthalm|eye/},
  {t:2,title:"Mineral oil, oral",d:["mineral oil"],sev:"avoid",rec:"Avoid.",why:"Aspiration risk and adverse effects; safer alternatives.",q:"Moderate",s:"Strong"},
  {t:2,title:"Desmopressin",d:["desmopressin"],sev:"avoid",rec:"Avoid for nocturia or nocturnal polyuria.",why:"High risk of hyponatremia.",q:"Moderate",s:"Strong"},
  {t:2,title:"Oral non-COX-2-selective NSAIDs",d:C.nsaid,sev:"conditional",rec:"Avoid chronic use unless alternatives fail and a gastroprotective agent can be taken. Avoid short-term scheduled use with oral/parenteral corticosteroids, anticoagulants or antiplatelets.",why:"GI bleeding and ulcers (higher in >75, steroids, anticoagulants), raised BP, kidney injury.",q:"Moderate",s:"Strong",skip:/topical|gel|patch|cream|ointment|ophthalm|solution/},
  {t:2,title:"Indomethacin / ketorolac",d:["indomethacin","ketorolac"],sev:"avoid",rec:"Avoid.",why:"Higher risk of GI bleeding/ulcer and acute kidney injury; indomethacin has the most CNS effects.",q:"Moderate",s:"Strong"},
  {t:2,title:"Meperidine",d:["meperidine"],sev:"avoid",rec:"Avoid.",why:"Ineffective oral analgesic at common doses; higher neurotoxicity/delirium risk.",q:"Moderate",s:"Strong"},
  {t:2,title:"Skeletal muscle relaxants",d:C.smr,sev:"avoid",rec:"Avoid (does not apply to baclofen or tizanidine for spasticity).",why:"Poorly tolerated: anticholinergic effects, sedation, fractures; questionable effectiveness.",q:"Moderate",s:"Strong"},
  {t:8,title:"On the 2019 Beers list (moved off main tables for low U.S. use/unavailability)",d:C.table8,sev:"avoid",rec:"Still considered potentially inappropriate (Table 8).",why:"Removed from the main tables only because of low use or U.S. unavailability.",q:"-",s:"-"},
  // Table 4: use with caution
  {t:4,title:"Dabigatran",d:["dabigatran"],sev:"caution",rec:"Use caution in selecting dabigatran over other DOACs (e.g. apixaban) for long-term AF/VTE.",why:"Higher GI and major bleeding risk than warfarin and apixaban.",q:"Moderate",s:"Strong"},
  {t:4,title:"Prasugrel / ticagrelor",d:["prasugrel","ticagrelor"],sev:"caution",rec:"Use with caution, particularly age ≥75. If prasugrel is used, consider 5 mg dose in those ≥75.",why:"Higher major bleeding risk than clopidogrel, especially at ≥75.",q:"Moderate",s:"Strong"},
  {t:4,title:"Drugs that can cause SIADH/hyponatremia",d:["mirtazapine",...C.ssri,...C.snri,...C.tcaAll,"carbamazepine","oxcarbazepine",...C.antipsych,...C.diuretic,"tramadol"],sev:"caution",rec:"Use with caution; monitor sodium when starting or changing doses.",why:"May exacerbate or cause SIADH or hyponatremia.",q:"Moderate",s:"Strong"},
  {t:4,title:"Dextromethorphan-quinidine",d:["dextromethorphan-quinidine","dextromethorphan/quinidine","nuedexta"],sev:"caution",rec:"Use with caution.",why:"Limited efficacy in dementia behaviors; falls, drug interactions, heart failure concerns.",q:"Moderate",s:"Strong"},
  {t:4,title:"Trimethoprim-sulfamethoxazole",d:["sulfamethoxazole"],sev:"caution",rec:"Use with caution in patients on ACEI, ARB or ARNI with decreased CrCl.",why:"Increased risk of hyperkalemia.",q:"Low",s:"Strong"},
  {t:4,title:"SGLT2 inhibitors",d:C.sglt2,sev:"caution",rec:"Use with caution; monitor for urogenital infections and ketoacidosis.",why:"Urogenital infections; euglycemic diabetic ketoacidosis.",q:"Moderate",s:"Weak"}
];

// ---- Table 5: drug-drug interactions. type "count": >= min distinct drugs in group g; type "pair": >=1 drug from a AND from b ----
const R_COMBO = [
  {title:"2 or more RAS inhibitors / potassium-sparing diuretics",type:"count",g:C.rasK,min:2,rec:"Avoid routinely using 2 or more, particularly in CKD stage 3a or higher.",why:"Increased risk of hyperkalemia.",q:"Moderate",s:"Strong"},
  {title:"Opioid + benzodiazepine",type:"pair",a:C.opioid,b:C.benzo,rec:"Avoid.",why:"Increased risk of overdose and adverse events.",q:"Moderate",s:"Strong"},
  {title:"Opioid + gabapentinoid",type:"pair",a:C.opioid,b:C.gaba,rec:"Avoid (except when transitioning from opioid to gabapentinoid or using gabapentinoids to reduce opioid dose; use caution).",why:"Severe sedation-related adverse events, respiratory depression, death.",q:"Moderate",s:"Strong"},
  {title:"2 or more anticholinergic drugs",type:"count",g:C.ach,min:2,rec:"Avoid; minimize the number of anticholinergic drugs.",why:"Increased risk of cognitive decline, delirium, falls or fractures.",q:"Moderate",s:"Strong"},
  {title:"3 or more CNS-active drugs",type:"count",g:C.cns,min:3,rec:"Avoid concurrent use of 3 or more CNS-active drugs; minimize the number.",why:"Increased risk of falls and fractures.",q:"High",s:"Strong"},
  {title:"Lithium + ACEI/ARB/ARNI",type:"pair",a:["lithium"],b:C.ras,rec:"Avoid; monitor lithium concentrations.",why:"Increased risk of lithium toxicity.",q:"Moderate",s:"Strong"},
  {title:"Lithium + loop diuretic",type:"pair",a:["lithium"],b:C.loop,rec:"Avoid; monitor lithium concentrations.",why:"Increased risk of lithium toxicity.",q:"Moderate",s:"Strong"},
  {title:"Non-selective alpha-1 blocker + loop diuretic (women)",type:"pair",a:C.alpha1,b:C.loop,sex:"female",rec:"Avoid in older women unless conditions warrant both drugs.",why:"Increased risk of urinary incontinence.",q:"Moderate",s:"Strong"},
  {title:"Phenytoin + trimethoprim-sulfamethoxazole",type:"pair",a:["phenytoin"],b:["sulfamethoxazole"],rec:"Avoid.",why:"Increased risk of phenytoin toxicity.",q:"Moderate",s:"Strong"},
  {title:"Theophylline + cimetidine or ciprofloxacin",type:"pair",a:["theophylline"],b:["cimetidine","ciprofloxacin"],rec:"Avoid.",why:"Increased risk of theophylline toxicity.",q:"Moderate",s:"Strong"},
  {title:"Warfarin + interacting drug",type:"pair",a:["warfarin"],b:["amiodarone","ciprofloxacin","clarithromycin","erythromycin","sulfamethoxazole",...C.ssri],rec:"Avoid when possible; if used together, monitor INR closely.",why:"Increased risk of bleeding (amiodarone, ciprofloxacin, macrolides except azithromycin, TMP-SMX, SSRIs).",q:"Moderate",s:"Strong"}
];

// ---- Table 3: drug-disease / drug-syndrome interactions (matched against active problem list text) ----
const R_DIS = [
  {cond:"Heart failure",re:/heart failure|congestive|\bchf\b|hfref|hfpef|cardiomyopathy/i,rules:[
    {d:["cilostazol","dextromethorphan-quinidine","nuedexta"],sev:"avoid",rec:"Avoid.",why:"May promote fluid retention/increase mortality; QT concerns.",q:"Low",s:"Strong"},
    {d:["diltiazem","verapamil"],sev:"avoid",rec:"Avoid in HFrEF.",why:"Non-dihydropyridine CCBs may worsen heart failure.",q:"Moderate",s:"Strong"},
    {d:["dronedarone",...C.nsaid,"celecoxib","pioglitazone"],sev:"conditional",rec:"Use caution if asymptomatic heart failure; avoid if symptomatic.",why:"Fluid retention / worse outcomes (NSAIDs, COX-2 inhibitors, thiazolidinediones, dronedarone).",q:"Moderate-High",s:"Strong",skip:/topical|gel|patch|cream/}]},
  {cond:"Syncope",re:/syncope|fainting/i,rules:[
    {d:[...C.achei,...C.alpha1,...C.tcaTert,"chlorpromazine","olanzapine"],sev:"avoid",rec:"Avoid.",why:"Orthostatic hypotension (antipsychotics, tertiary TCAs, alpha-1 blockers) or bradycardia (cholinesterase inhibitors).",q:"High",s:"Strong"}]},
  {cond:"Delirium",re:/delirium/i,rules:[
    {d:[...C.ach,...C.antipsych,...C.benzo,...C.cortico,...C.h2,...C.zdrug,...C.opioid],sev:"avoid",rec:"Avoid in older adults with or at high risk of delirium (corticosteroids: lowest dose/shortest duration if needed).",why:"May induce or worsen delirium.",q:"Moderate (H2 blockers: Low)",s:"Strong",skip:/inhal|topical|cream|ointment|nasal|ophthalm|otic/}]},
  {cond:"Dementia or cognitive impairment",re:/dementia|alzheimer|cognitive impairment|lewy/i,rules:[
    {d:[...C.ach,...C.antipsych,...C.benzo,...C.zdrug],sev:"avoid",rec:"Avoid.",why:"Adverse CNS effects; antipsychotics raise stroke and mortality risk.",q:"Moderate",s:"Strong"}]},
  {cond:"History of falls or fractures",re:/\bfalls?\b|fracture/i,rules:[
    {d:[...C.ach,...C.ssri,...C.snri,...C.tcaAll,...C.aed,...C.antipsych,...C.benzo,...C.zdrug,...C.opioid],sev:"avoid",rec:"Avoid unless safer alternatives are not available (antiepileptics: except seizures/mood disorders; opioids: except severe acute pain).",why:"Ataxia, impaired psychomotor function, syncope, further falls.",q:"High (antidepressants/opioids: Moderate)",s:"Strong"}]},
  {cond:"Parkinson disease",re:/parkinson/i,rules:[
    {d:["metoclopramide","prochlorperazine","promethazine",...C.antipsych.filter(x=>!["clozapine","pimavanserin","quetiapine"].includes(x))],sev:"avoid",rec:"Avoid (clozapine, pimavanserin, quetiapine are exceptions).",why:"Dopamine-receptor antagonists may worsen parkinsonian symptoms.",q:"Moderate",s:"Strong"}]},
  {cond:"History of gastric or duodenal ulcers",re:/(gastric|duodenal|peptic|stomach)\s+ulcer|ulcer.*(gastric|duodenal)/i,rules:[
    {d:["aspirin",...C.nsaid],sev:"avoid",rec:"Avoid unless alternatives are ineffective and a gastroprotective agent can be taken.",why:"May exacerbate existing ulcers or cause new ulcers.",q:"Moderate",s:"Strong",skip:/topical|gel|patch|cream/}]},
  {cond:"Urinary incontinence (women)",re:/incontinence/i,sex:"female",rules:[
    {d:[...C.alpha1,...C.estrogen],sev:"avoid",rec:"Avoid in women (oral/transdermal estrogen; vaginal estrogen is fine).",why:"Aggravates incontinence (alpha-1 blockers); lack of efficacy (oral estrogen).",q:"Moderate-High",s:"Strong",skip:/vagin|cream|ring/}]},
  {cond:"Lower urinary tract symptoms / BPH (men)",re:/benign prostat|\bbph\b|prostatic hyperplasia|lower urinary tract|\bluts\b/i,sex:"male",rules:[
    {d:C.ach.filter(x=>!["darifenacin","fesoterodine","flavoxate","oxybutynin","solifenacin","tolterodine","trospium"].includes(x)),sev:"avoid",rec:"Avoid strongly anticholinergic drugs in men (except antimuscarinics for urinary incontinence).",why:"May decrease urinary flow and cause urinary retention.",q:"Moderate",s:"Strong"}]}
];

// ---- Table 6: kidney function. cr = CrCl rule text (CrCl is not retrieved by this app, so these are "check CrCl" prompts) ----
const R_RENAL = [
  {d:["ciprofloxacin"],cr:"<30",rec:"Reduce dose when CrCl <30 mL/min.",q:"Moderate",s:"Strong"},
  {d:["nitrofurantoin"],cr:"<30",rec:"Avoid if CrCl <30 mL/min.",q:"Low",s:"Strong"},
  {d:["sulfamethoxazole"],cr:"<30",rec:"Reduce dose if CrCl 15-29; avoid if <15 mL/min.",q:"Moderate",s:"Strong"},
  {d:["amiloride","triamterene","spironolactone"],cr:"<30",rec:"Avoid if CrCl <30 mL/min.",q:"Moderate",s:"Strong"},
  {d:["dabigatran"],cr:"<30",rec:"Avoid if CrCl <30 mL/min; adjust dose with interacting drugs.",q:"Moderate",s:"Strong"},
  {d:["dofetilide"],cr:"<60",rec:"Reduce dose if CrCl 20-59; avoid if <20 mL/min.",q:"Moderate",s:"Strong"},
  {d:["edoxaban"],cr:"15-50 or >95",rec:"Reduce dose if CrCl 15-50; avoid if <15 or >95 mL/min.",q:"Moderate",s:"Strong"},
  {d:["enoxaparin"],cr:"<30",rec:"Reduce dose.",q:"Moderate",s:"Strong"},
  {d:["fondaparinux"],cr:"<30",rec:"Avoid.",q:"Moderate",s:"Strong"},
  {d:["rivaroxaban"],cr:"<50",rec:"Avoid if CrCl <15; reduce dose if 15-50 mL/min per label.",q:"Moderate",s:"Strong"},
  {d:["baclofen"],cr:"eGFR <60",rec:"Avoid if eGFR <60; if unavoidable use lowest dose and monitor for CNS toxicity.",q:"Moderate",s:"Strong"},
  {d:["duloxetine"],cr:"<30",rec:"Avoid if CrCl <30 mL/min.",q:"Moderate",s:"Weak"},
  {d:["gabapentin","pregabalin"],cr:"<60",rec:"Reduce dose.",q:"Moderate",s:"Strong"},
  {d:["levetiracetam"],cr:"≤80",rec:"Reduce dose.",q:"Moderate",s:"Strong"},
  {d:[...C.nsaid,"celecoxib"],cr:"<30",rec:"Avoid NSAIDs if CrCl <30 mL/min.",q:"Moderate",s:"Strong",skip:/topical|gel|patch|cream/},
  {d:["tramadol"],cr:"<30",rec:"Immediate release: reduce dose; extended-release: avoid.",q:"Low",s:"Weak"},
  {d:C.h2,cr:"<50",rec:"Reduce dose (mental status changes).",q:"Moderate",s:"Strong"},
  {d:["colchicine"],cr:"<30",rec:"Reduce dose; monitor for toxicity.",q:"Moderate",s:"Strong"},
  {d:["probenecid"],cr:"<30",rec:"Avoid (loss of effectiveness).",q:"Moderate",s:"Strong"}
];
