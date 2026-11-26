/* Drug interactions – QT, serotonin syndrome, seizure threshold
 * Hospitalist Toolkit tab. Rules engine + drug data (no DOM code here).
 * Decision support only: lists are curated, not exhaustive. Verify with
 * pharmacy, CredibleMeds (crediblemeds.org) and the product monograph.
 *
 * Drug fields:
 *  qt : 'known' (known TdP risk) | 'possible' (possible/conditional risk)
 *  ss : 'maoi' | 'maoi_weak' | 'strong' | 'moderate' | 'weak'   (serotonergic)
 *  sz : 'high' | 'moderate' | 'low'                              (lowers seizure threshold)
 *  renal: [{egfr, sev, cat, text}]  eGFR-triggered rules
 *  tags: interaction hooks (see PK rules below)
 *  alt : safer-alternative hint
 */
(function (root) {
  'use strict';

  const DRUGS = [];
  function D(name, aliases, o) { DRUGS.push(Object.assign({ name, aliases: aliases || [], tags: [] }, o)); }

  // ---------- Antiarrhythmics ----------
  D('amiodarone', ['cordarone', 'pacerone'], { cls: 'Antiarrhythmic', qt: 'known', tags: ['cyp3a4inh'], qtNote: 'Marked QT prolongation, TdP less common than with sotalol. Also CYP3A4/P-gp inhibitor (raises levels of other QT drugs).' });
  D('sotalol', ['sotacor', 'betapace'], { cls: 'Antiarrhythmic', qt: 'known', qtNote: 'Dose-related TdP; renally cleared.', renal: [{ egfr: 60, sev: 'Moderate', cat: 'qt', text: 'Sotalol is renally cleared – check dosing interval for eGFR; accumulation raises TdP risk.' }] });
  D('dofetilide', ['tikosyn'], { cls: 'Antiarrhythmic', qt: 'known', renal: [{ egfr: 60, sev: 'High', cat: 'qt', text: 'Dofetilide requires CrCl-based dosing; contraindicated CrCl <20.' }] });
  D('dronedarone', ['multaq'], { cls: 'Antiarrhythmic', qt: 'known', tags: ['3a4sub_qt'] });
  D('flecainide', ['tambocor'], { cls: 'Antiarrhythmic', qt: 'known' });
  D('procainamide', [], { cls: 'Antiarrhythmic', qt: 'known' });
  D('disopyramide', ['rythmodan'], { cls: 'Antiarrhythmic', qt: 'known' });
  D('quinidine', [], { cls: 'Antiarrhythmic', qt: 'known' });
  D('ibutilide', ['corvert'], { cls: 'Antiarrhythmic', qt: 'known' });
  D('propafenone', ['rythmol'], { cls: 'Antiarrhythmic', qt: 'possible' });

  // ---------- Antimicrobials ----------
  D('azithromycin', ['zithromax'], { cls: 'Macrolide', qt: 'known', alt: 'Doxycycline for atypical coverage if appropriate.' });
  D('clarithromycin', ['biaxin'], { cls: 'Macrolide', qt: 'known', tags: ['cyp3a4inh'], alt: 'Doxycycline or azithromycin (fewer CYP interactions).' });
  D('erythromycin', ['eryc'], { cls: 'Macrolide', qt: 'known', tags: ['cyp3a4inh'] });
  D('ciprofloxacin', ['cipro'], { cls: 'Fluoroquinolone', qt: 'known', sz: 'moderate', tags: ['cyp1a2inh'], szNote: 'GABA-A antagonism; higher risk with NSAIDs, renal impairment, CNS disease.' });
  D('levofloxacin', ['levaquin'], { cls: 'Fluoroquinolone', qt: 'known', sz: 'moderate', renal: [{ egfr: 50, sev: 'Moderate', cat: 'sz', text: 'Levofloxacin needs renal dose adjustment (eGFR <50) – accumulation increases CNS toxicity and QT effect.' }] });
  D('moxifloxacin', ['avelox'], { cls: 'Fluoroquinolone', qt: 'known', sz: 'moderate', qtNote: 'Largest QT effect of the fluoroquinolones.' });
  D('fluconazole', ['diflucan'], { cls: 'Azole antifungal', qt: 'known', tags: ['cyp3a4inh', 'cyp2c19inh'], alt: 'Echinocandin if clinically appropriate.' });
  D('voriconazole', ['vfend'], { cls: 'Azole antifungal', qt: 'possible', tags: ['cyp3a4inh', 'cyp2c19inh'] });
  D('posaconazole', ['posanol', 'noxafil'], { cls: 'Azole antifungal', qt: 'possible', tags: ['cyp3a4inh'] });
  D('itraconazole', ['sporanox'], { cls: 'Azole antifungal', qt: 'possible', tags: ['cyp3a4inh'] });
  D('ketoconazole', [], { cls: 'Azole antifungal', qt: 'possible', tags: ['cyp3a4inh'] });
  D('pentamidine', ['pentam'], { cls: 'Antimicrobial', qt: 'known' });
  D('hydroxychloroquine', ['plaquenil'], { cls: 'Antimalarial', qt: 'known' });
  D('chloroquine', [], { cls: 'Antimalarial', qt: 'known' });
  D('quinine', [], { cls: 'Antimalarial', qt: 'possible' });
  D('bedaquiline', ['sirturo'], { cls: 'Anti-TB', qt: 'known' });
  D('metronidazole', ['flagyl'], { cls: 'Antimicrobial', qt: 'possible', sz: 'low', szNote: 'Neurotoxicity (encephalopathy, seizures) mostly with high cumulative doses.' });
  D('trimethoprim-sulfamethoxazole', ['sulfamethoxazole', 'co-trimoxazole', 'cotrimoxazole', 'septra', 'bactrim', 'tmp-smx', 'tmp/smx'], { cls: 'Antimicrobial', qt: 'possible', qtNote: 'Conditional risk – mainly via hyperkalemia/renal effects and high doses.' });
  D('linezolid', ['zyvox'], { cls: 'Oxazolidinone', ss: 'maoi_weak', ssNote: 'Weak reversible MAO inhibitor.', alt: 'Vancomycin/daptomycin if appropriate; if linezolid is needed with an SSRI/SNRI, monitor closely for 2 weeks (ID/pharmacy input).' });
  D('tedizolid', ['sivextro'], { cls: 'Oxazolidinone', ss: 'maoi_weak', ssNote: 'Weaker MAO inhibition than linezolid.' });
  D('methylene blue', ['methylthioninium'], { cls: 'Dye / MAOI', ss: 'maoi', ssNote: 'Potent reversible MAO-A inhibitor at IV doses.' });
  D('imipenem', ['primaxin', 'imipenem-cilastatin'], { cls: 'Carbapenem', sz: 'high', tags: ['carbapenem'], szNote: 'Highest seizure risk of the carbapenems.', renal: [{ egfr: 70, sev: 'Moderate', cat: 'sz', text: 'Imipenem needs renal dose reduction; seizure risk rises with renal impairment and CNS disease.' }], alt: 'Meropenem has lower seizure risk.' });
  D('meropenem', ['merrem'], { cls: 'Carbapenem', sz: 'low', tags: ['carbapenem'] });
  D('ertapenem', ['invanz'], { cls: 'Carbapenem', sz: 'low', tags: ['carbapenem'] });
  D('cefepime', ['maxipime'], { cls: 'Cephalosporin', sz: 'high', szNote: 'Neurotoxicity (encephalopathy, myoclonus, non-convulsive status) mainly in renal impairment.', renal: [{ egfr: 60, sev: 'Moderate', cat: 'sz', text: 'Cefepime: confirm renal dose adjustment; watch for confusion/myoclonus (EEG for possible NCSE).' }, { egfr: 30, sev: 'High', cat: 'sz', text: 'Cefepime with eGFR <30 – high risk of neurotoxicity/NCSE. Confirm dose; consider alternative.' }] });
  D('ceftazidime', ['fortaz'], { cls: 'Cephalosporin', sz: 'moderate', renal: [{ egfr: 50, sev: 'Moderate', cat: 'sz', text: 'Ceftazidime accumulates in renal impairment – confirm dose adjustment.' }] });
  D('penicillin g', ['benzylpenicillin', 'penicillin g sodium', 'penicillin g potassium'], { cls: 'Penicillin', sz: 'moderate', szNote: 'High IV doses, especially with renal impairment.', renal: [{ egfr: 30, sev: 'Moderate', cat: 'sz', text: 'High-dose penicillin G with eGFR <30 – reduce dose.' }] });
  D('isoniazid', [], { cls: 'Anti-TB', sz: 'moderate', szNote: 'Pyridoxine depletion; give pyridoxine with isoniazid.' });
  D('foscarnet', [], { cls: 'Antiviral', qt: 'possible', sz: 'moderate', szNote: 'Via low ionized Ca/Mg.' });
  D('rifampin', ['rifampicin', 'rifadin', 'rofact'], { cls: 'Rifamycin', tags: ['inducer_ext'] });
  D('nirmatrelvir-ritonavir', ['paxlovid', 'ritonavir', 'nirmatrelvir'], { cls: 'Antiviral', tags: ['cyp3a4inh'] });

  // ---------- Antipsychotics ----------
  D('haloperidol', ['haldol'], { cls: 'Antipsychotic', qt: 'known', sz: 'low', tags: ['3a4sub_qt'], qtNote: 'Higher risk with IV route and high cumulative doses.', alt: 'Lowest effective dose; non-drug delirium measures.' });
  D('chlorpromazine', ['largactil'], { cls: 'Antipsychotic', qt: 'known', sz: 'high' });
  D('droperidol', [], { cls: 'Antipsychotic', qt: 'known' });
  D('pimozide', ['orap'], { cls: 'Antipsychotic', qt: 'known', tags: ['3a4sub_qt'] });
  D('thioridazine', [], { cls: 'Antipsychotic', qt: 'known', sz: 'moderate' });
  D('quetiapine', ['seroquel'], { cls: 'Antipsychotic', qt: 'possible', sz: 'low', tags: ['3a4sub_qt'] });
  D('olanzapine', ['zyprexa', 'zydis'], { cls: 'Antipsychotic', qt: 'possible', sz: 'moderate', tags: ['cyp1a2sub'] });
  D('risperidone', ['risperdal'], { cls: 'Antipsychotic', qt: 'possible', sz: 'low' });
  D('paliperidone', ['invega'], { cls: 'Antipsychotic', qt: 'possible' });
  D('ziprasidone', ['zeldox', 'geodon'], { cls: 'Antipsychotic', qt: 'possible' });
  D('aripiprazole', ['abilify'], { cls: 'Antipsychotic', qt: 'possible', qtNote: 'Low QT effect.' });
  D('clozapine', ['clozaril'], { cls: 'Antipsychotic', qt: 'possible', sz: 'high', tags: ['cyp1a2sub', 'clozapine'], szNote: 'Dose-related (higher >600 mg/day or high levels). Levels rise if the patient stops smoking in hospital (loss of CYP1A2 induction).' });
  D('loxapine', ['loxapac', 'xylac'], { cls: 'Antipsychotic', sz: 'moderate' });
  D('prochlorperazine', ['stemetil'], { cls: 'Antiemetic / phenothiazine', qt: 'possible', sz: 'low' });

  // ---------- Antidepressants ----------
  D('citalopram', ['celexa'], { cls: 'SSRI', qt: 'known', ss: 'strong', tags: ['2c19sub_qt'], doseMaxElderly: 20, qtNote: 'Dose-dependent. Health Canada: max 20 mg/day if age >65 or hepatic impairment or CYP2C19 inhibitor.', alt: 'Sertraline has the least QT effect of the SSRIs.' });
  D('escitalopram', ['cipralex', 'lexapro'], { cls: 'SSRI', qt: 'known', ss: 'strong', tags: ['2c19sub_qt'], doseMaxElderly: 10, qtNote: 'Dose-dependent. Max 10 mg/day if age >65.', alt: 'Sertraline has the least QT effect of the SSRIs.' });
  D('fluoxetine', ['prozac'], { cls: 'SSRI', qt: 'possible', ss: 'strong', tags: ['cyp2d6inh'], ssNote: 'Very long half-life (norfluoxetine) – 5-week washout before an MAOI.' });
  D('paroxetine', ['paxil'], { cls: 'SSRI', qt: 'possible', ss: 'strong', tags: ['cyp2d6inh'] });
  D('sertraline', ['zoloft'], { cls: 'SSRI', qt: 'possible', ss: 'strong', qtNote: 'Minimal QT effect at usual doses.' });
  D('fluvoxamine', ['luvox'], { cls: 'SSRI', qt: 'possible', ss: 'strong', tags: ['cyp1a2inh', 'cyp2c19inh', 'cyp3a4inh'] });
  D('venlafaxine', ['effexor'], { cls: 'SNRI', qt: 'possible', ss: 'strong', sz: 'low' });
  D('desvenlafaxine', ['pristiq'], { cls: 'SNRI', ss: 'strong' });
  D('duloxetine', ['cymbalta'], { cls: 'SNRI', ss: 'strong' });
  D('vortioxetine', ['trintellix'], { cls: 'Serotonin modulator', ss: 'strong' });
  D('clomipramine', ['anafranil'], { cls: 'TCA', qt: 'possible', ss: 'strong', sz: 'high' });
  D('imipramine', ['tofranil'], { cls: 'TCA', qt: 'possible', ss: 'moderate', sz: 'moderate' });
  D('amitriptyline', ['elavil'], { cls: 'TCA', qt: 'possible', ss: 'moderate', sz: 'moderate' });
  D('nortriptyline', ['aventyl'], { cls: 'TCA', qt: 'possible', ss: 'weak', sz: 'moderate' });
  D('desipramine', ['norpramin'], { cls: 'TCA', qt: 'possible', sz: 'moderate' });
  D('doxepin', ['sinequan', 'silenor'], { cls: 'TCA', qt: 'possible', ss: 'weak', sz: 'moderate' });
  D('maprotiline', [], { cls: 'Tetracyclic', sz: 'high' });
  D('trazodone', ['desyrel', 'oleptro'], { cls: 'SARI', qt: 'possible', ss: 'moderate' });
  D('mirtazapine', ['remeron'], { cls: 'NaSSA', qt: 'possible', ss: 'weak' });
  D('bupropion', ['wellbutrin', 'zyban'], { cls: 'NDRI', sz: 'high', tags: ['cyp2d6inh', 'bupropion'], szNote: 'Dose-related. Contraindicated with seizure disorder, current/prior eating disorder, or abrupt alcohol/benzodiazepine withdrawal.' });
  D('phenelzine', ['nardil'], { cls: 'MAOI', ss: 'maoi' });
  D('tranylcypromine', ['parnate'], { cls: 'MAOI', ss: 'maoi' });
  D('moclobemide', ['manerix'], { cls: 'MAOI (reversible MAO-A)', ss: 'maoi' });
  D('selegiline', ['eldepryl'], { cls: 'MAO-B inhibitor', ss: 'maoi_weak', tags: ['maob'] });
  D('rasagiline', ['azilect'], { cls: 'MAO-B inhibitor', ss: 'maoi_weak', tags: ['maob'] });
  D('safinamide', ['xadago'], { cls: 'MAO-B inhibitor', ss: 'maoi_weak', tags: ['maob'] });
  D('lithium', ['carbolith', 'lithane', 'lithmax'], { cls: 'Mood stabilizer', qt: 'possible', ss: 'moderate', sz: 'moderate', szNote: 'Seizures with toxicity (check level, renal function, Na).' });
  D("st john's wort", ["st. john's wort", 'st johns wort', 'hypericum'], { cls: 'Herbal', ss: 'moderate', tags: ['inducer_ext'] });
  D('buspirone', ['buspar'], { cls: 'Anxiolytic', ss: 'weak' });

  // ---------- Opioids / analgesics ----------
  D('methadone', ['metadol', 'methadose'], { cls: 'Opioid', qt: 'known', ss: 'moderate', tags: ['3a4sub_qt', 'maob_contra'], qtNote: 'Dose-related; ECG at baseline, 30 days and annually, and with dose >100 mg/day.', alt: 'Do not stop abruptly – involve addictions/pain/pharmacy before changing.' });
  D('tramadol', ['ultram', 'tramacet', 'durela', 'ralivia', 'zytram', 'tridural'], { cls: 'Opioid', ss: 'strong', sz: 'high', tags: ['2d6_tramadol', 'maob_contra'], szNote: 'Seizures even at therapeutic doses; higher with renal impairment, SSRIs/TCAs, seizure history.', renal: [{ egfr: 30, sev: 'Moderate', cat: 'sz', text: 'Tramadol with eGFR <30 – max 200 mg/day, q12h; avoid ER forms.' }], alt: 'Non-serotonergic opioid (e.g. hydromorphone, oxycodone at low dose) or non-opioid analgesia.' });
  D('meperidine', ['pethidine', 'demerol'], { cls: 'Opioid', ss: 'strong', sz: 'high', tags: ['maob_contra'], szNote: 'Normeperidine accumulates (renal) → myoclonus, seizures.', renal: [{ egfr: 50, sev: 'High', cat: 'sz', text: 'Avoid meperidine with eGFR <50 (normeperidine accumulation → seizures).' }], alt: 'Avoid meperidine; use another opioid.' });
  D('tapentadol', ['nucynta'], { cls: 'Opioid', ss: 'strong', sz: 'moderate', tags: ['maob_contra'] });
  D('fentanyl', ['duragesic', 'sublimaze'], { cls: 'Opioid', ss: 'moderate' });
  D('dextromethorphan', ['benylin dm'], { cls: 'Antitussive', ss: 'moderate', tags: ['maob_contra'] });
  D('buprenorphine', ['suboxone', 'sublocade', 'butrans', 'belbuca'], { cls: 'Opioid', qt: 'possible', ss: 'weak' });
  D('oxycodone', ['oxycontin', 'percocet', 'oxyneo', 'supeudol'], { cls: 'Opioid', ss: 'weak' });

  // ---------- Antiemetics / GI ----------
  D('ondansetron', ['zofran'], { cls: '5-HT3 antagonist', qt: 'known', ss: 'weak', qtNote: 'Dose-related, mainly IV. Avoid single IV doses >16 mg.', alt: 'Lower dose / PO; avoid in congenital long QT.' });
  D('granisetron', ['kytril'], { cls: '5-HT3 antagonist', qt: 'possible', ss: 'weak' });
  D('domperidone', ['motilium'], { cls: 'Prokinetic', qt: 'known', tags: ['3a4sub_qt'], qtNote: 'Health Canada: max 30 mg/day; avoid with strong CYP3A4 inhibitors.' });
  D('metoclopramide', ['maxeran', 'reglan'], { cls: 'Prokinetic', qt: 'possible', ss: 'weak', sz: 'low' });
  D('famotidine', ['pepcid'], { cls: 'H2 blocker', qt: 'possible', renal: [{ egfr: 50, sev: 'Low', cat: 'qt', text: 'Famotidine accumulates in renal impairment (QT reports, delirium) – reduce dose.' }] });
  D('loperamide', ['imodium'], { cls: 'Antidiarrheal', qt: 'possible', qtNote: 'TdP mainly with high/misuse doses.' });

  // ---------- Others with QT risk ----------
  D('hydroxyzine', ['atarax'], { cls: 'Antihistamine', qt: 'possible' });
  D('diphenhydramine', ['benadryl'], { cls: 'Antihistamine', qt: 'possible', sz: 'low' });
  D('donepezil', ['aricept'], { cls: 'Cholinesterase inhibitor', qt: 'known' });
  D('galantamine', ['reminyl'], { cls: 'Cholinesterase inhibitor', qt: 'possible' });
  D('propofol', ['diprivan'], { cls: 'Anesthetic', qt: 'known' });
  D('anagrelide', ['agrylin'], { cls: 'Antiplatelet', qt: 'known' });
  D('cilostazol', ['pletal'], { cls: 'Antiplatelet', qt: 'known' });
  D('tacrolimus', ['prograf', 'advagraf', 'envarsus'], { cls: 'Calcineurin inhibitor', qt: 'possible', sz: 'moderate', szNote: 'Neurotoxicity/PRES; worse with high levels and low Mg.' });
  D('cyclosporine', ['neoral', 'sandimmune', 'ciclosporin'], { cls: 'Calcineurin inhibitor', sz: 'moderate', szNote: 'Neurotoxicity/PRES; worse with high levels and low Mg.' });
  D('tamoxifen', ['nolvadex'], { cls: 'SERM', qt: 'possible' });
  D('arsenic trioxide', ['trisenox'], { cls: 'Antineoplastic', qt: 'known' });
  D('vandetanib', ['caprelsa'], { cls: 'TKI', qt: 'known' });
  D('nilotinib', ['tasigna'], { cls: 'TKI', qt: 'known' });
  D('ribociclib', ['kisqali'], { cls: 'CDK4/6 inhibitor', qt: 'known' });
  D('osimertinib', ['tagrisso'], { cls: 'TKI', qt: 'possible' });
  D('sunitinib', ['sutent'], { cls: 'TKI', qt: 'possible' });
  D('lapatinib', ['tykerb'], { cls: 'TKI', qt: 'possible' });
  D('crizotinib', ['xalkori'], { cls: 'TKI', qt: 'possible' });
  D('vemurafenib', ['zelboraf'], { cls: 'BRAF inhibitor', qt: 'possible' });
  D('ifosfamide', ['ifex'], { cls: 'Antineoplastic', sz: 'moderate', szNote: 'Encephalopathy; methylene blue is sometimes used to treat it (serotonin risk with SSRIs).' });

  // ---------- Seizure threshold (non-QT) ----------
  D('theophylline', ['uniphyl', 'theo-dur'], { cls: 'Methylxanthine', sz: 'high', tags: ['theophylline'], szNote: 'Seizures with toxicity – often refractory; phenytoin ineffective.' });
  D('aminophylline', [], { cls: 'Methylxanthine', sz: 'high', tags: ['theophylline'] });
  D('flumazenil', ['anexate'], { cls: 'Benzodiazepine antagonist', sz: 'high', tags: ['flumazenil'], szNote: 'Can precipitate seizures in benzodiazepine-dependent patients or TCA overdose.' });
  D('baclofen', ['lioresal'], { cls: 'Muscle relaxant', sz: 'moderate', szNote: 'Seizures with abrupt withdrawal (esp. intrathecal) and with toxicity in renal impairment.', renal: [{ egfr: 50, sev: 'High', cat: 'sz', text: 'Baclofen accumulates with eGFR <50 → encephalopathy/seizures. Reduce dose or avoid.' }] });
  D('lidocaine (IV)', ['lidocaine infusion', 'lidocaine iv', 'xylocaine iv'], { cls: 'Local anesthetic', sz: 'moderate', szNote: 'CNS toxicity at high levels (infusions).' });
  D('amphetamine', ['dextroamphetamine', 'lisdexamfetamine', 'vyvanse', 'adderall', 'dexedrine'], { cls: 'Stimulant', ss: 'weak', sz: 'low' });
  D('methylphenidate', ['ritalin', 'concerta', 'biphentin'], { cls: 'Stimulant', sz: 'low' });
  D('cyclobenzaprine', ['flexeril'], { cls: 'Muscle relaxant', ss: 'moderate', sz: 'low' });
  D('sumatriptan', ['imitrex'], { cls: 'Triptan', ss: 'weak' });
  D('rizatriptan', ['maxalt'], { cls: 'Triptan', ss: 'weak' });
  D('zolmitriptan', ['zomig'], { cls: 'Triptan', ss: 'weak' });
  D('varenicline', ['champix'], { cls: 'Smoking cessation', sz: 'low' });

  // ---------- Antiseizure meds (markers + interaction partners) ----------
  D('valproate', ['valproic acid', 'divalproex', 'epival', 'depakene'], { cls: 'Antiseizure', tags: ['aed', 'vpa', 'aed_level'] });
  D('lamotrigine', ['lamictal'], { cls: 'Antiseizure', tags: ['aed', 'lamotrigine', 'aed_level'] });
  D('levetiracetam', ['keppra'], { cls: 'Antiseizure', tags: ['aed'] });
  D('phenytoin', ['dilantin', 'fosphenytoin'], { cls: 'Antiseizure', tags: ['aed', 'aed_level'] });
  D('carbamazepine', ['tegretol'], { cls: 'Antiseizure', tags: ['aed', 'aed_level'] });
  D('oxcarbazepine', ['trileptal'], { cls: 'Antiseizure', tags: ['aed'] });
  D('lacosamide', ['vimpat'], { cls: 'Antiseizure', tags: ['aed'] });
  D('brivaracetam', ['brivlera'], { cls: 'Antiseizure', tags: ['aed'] });
  D('topiramate', ['topamax'], { cls: 'Antiseizure', tags: ['aed'] });
  D('clobazam', ['frisium'], { cls: 'Antiseizure', tags: ['aed', 'benzo'] });
  D('phenobarbital', ['phenobarb'], { cls: 'Antiseizure', tags: ['aed', 'aed_level'] });
  D('perampanel', ['fycompa'], { cls: 'Antiseizure', tags: ['aed'] });
  D('eslicarbazepine', ['aptiom'], { cls: 'Antiseizure', tags: ['aed'] });
  D('cenobamate', ['xcopri'], { cls: 'Antiseizure', tags: ['aed'] });

  // ---------- Modifiers / partners ----------
  D('ethinyl estradiol', ['ethinylestradiol', 'alesse', 'yasmin', 'yaz', 'marvelon', 'diane-35', 'min-ovral', 'tri-cyclen'], { cls: 'Estrogen (combined OCP)', tags: ['estrogen'] });
  ['lorazepam|ativan', 'diazepam|valium', 'clonazepam|rivotril', 'alprazolam|xanax', 'oxazepam', 'temazepam|restoril', 'midazolam|versed'].forEach(s => { const p = s.split('|'); D(p[0], p.slice(1), { cls: 'Benzodiazepine', tags: ['benzo'] }); });
  ['furosemide|lasix', 'bumetanide|burinex', 'torsemide|torasemide|soaanz', 'ethacrynic acid|edecrin'].forEach(s => { const p = s.split('|'); D(p[0], p.slice(1), { cls: 'Loop diuretic', tags: ['loop'] }); });
  ['hydrochlorothiazide|hctz', 'chlorthalidone', 'indapamide|lozide', 'metolazone|zaroxolyn'].forEach(s => { const p = s.split('|'); D(p[0], p.slice(1), { cls: 'Thiazide', tags: ['thiazide'] }); });
  ['pantoprazole|pantoloc|tecta', 'omeprazole|losec', 'esomeprazole|nexium', 'lansoprazole|prevacid', 'rabeprazole|pariet', 'dexlansoprazole|dexilant'].forEach(s => { const p = s.split('|'); D(p[0], p.slice(1), { cls: 'PPI', tags: ['ppi'].concat(/omeprazole|esomeprazole/.test(p[0]) ? ['cyp2c19inh_weak'] : []) }); });
  D('diltiazem', ['cardizem', 'tiazac'], { cls: 'CCB', tags: ['cyp3a4inh'] });
  D('verapamil', ['isoptin'], { cls: 'CCB', tags: ['cyp3a4inh'] });

  // ---------- matching ----------
  function esc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  DRUGS.forEach(d => {
    const terms = [d.name].concat(d.aliases).map(t => esc(t.trim()).replace(/\s+/g, '[\\s-]*'));
    d.re = new RegExp('(^|[^a-z])(' + terms.join('|') + ')(?![a-z])', 'i');
  });
  DRUGS.sort((a, b) => b.name.length - a.name.length);

  function matchDrug(text) {
    if (!text) return null;
    const t = String(text).toLowerCase();
    // valproate vs "valproic", desvenlafaxine vs venlafaxine: longest name wins (sorted)
    for (const d of DRUGS) if (d.re.test(t)) return d;
    return null;
  }

  function parseDoseMg(text) {
    const m = String(text || '').match(/(\d+(?:\.\d+)?)\s*mg\b/i);
    return m ? parseFloat(m[1]) : null;
  }

  const SEV_ORDER = { Contraindicated: 0, High: 1, Moderate: 2, Low: 3, Info: 4 };
  const has = (d, tag) => d.tags && d.tags.indexOf(tag) >= 0;
  const names = arr => arr.map(x => x.drug.name).join(' + ');
  const uniq = arr => arr.filter((x, i) => arr.findIndex(y => y.drug.name === x.drug.name) === i);

  /**
   * analyze({meds:[{text}], pt:{age, sex, qtc, k, mg, ca, ica, hr, egfr, na, glucose,
   *          hf, ami, sepsis, seizureHx, withdrawal, longQT}})
   */
  function analyze(input) {
    const pt = Object.assign({}, input.pt || {});
    const matched = [], unmatched = [];
    (input.meds || []).forEach(m => {
      const d = matchDrug(m.text);
      if (d) matched.push({ text: m.text, drug: d, dose: parseDoseMg(m.text), proposed: !!m.proposed });
      else if (m.text && m.text.trim() && unmatched.indexOf(m.text.trim()) < 0) unmatched.push(m.text.trim());
    });
    const meds = uniq(matched);
    const findings = [];
    const F = (cat, sev, title, drugs, why, todo) => findings.push({ cat, sev, title, drugs: drugs || [], why, todo });
    const isNum = v => typeof v === 'number' && !isNaN(v);
    const female = pt.sex === 'female';
    const tagged = tag => meds.filter(x => has(x.drug, tag));
    const onAED = tagged('aed').length > 0;
    const seizureHx = !!pt.seizureHx || onAED;

    // ================= QT =================
    const qtDrugs = meds.filter(x => x.drug.qt);
    const qtKnown = qtDrugs.filter(x => x.drug.qt === 'known');
    const qtcProlongCut = female ? 480 : 470;
    const qtc = isNum(pt.qtc) ? pt.qtc : null;
    const qtc500 = qtc !== null && qtc >= 500;
    const qtcProlonged = qtc !== null && qtc >= qtcProlongCut;
    const qtRisks = [];
    if (isNum(pt.k) && pt.k < 3.5) qtRisks.push('K ' + pt.k + ' mmol/L (<3.5)');
    if (isNum(pt.mg) && pt.mg < 0.7) qtRisks.push('Mg ' + pt.mg + ' mmol/L (<0.7)');
    if ((isNum(pt.ica) && pt.ica < 1.1) || (!isNum(pt.ica) && isNum(pt.ca) && pt.ca < 2.1)) qtRisks.push('Low calcium');
    if (isNum(pt.hr) && pt.hr < 50) qtRisks.push('HR ' + pt.hr + ' (<50)');
    if (isNum(pt.age) && pt.age >= 65) qtRisks.push('Age ≥65');
    if (female) qtRisks.push('Female');
    if (pt.hf) qtRisks.push('Heart failure');
    if (pt.ami) qtRisks.push('Acute MI');
    if (pt.sepsis) qtRisks.push('Sepsis');
    if (pt.longQT) qtRisks.push('Congenital long QT / prior TdP');
    if (tagged('loop').length || tagged('thiazide').length) qtRisks.push('Loop/thiazide diuretic (K/Mg loss)');
    if (tagged('ppi').length) qtRisks.push('PPI (long-term use → low Mg)');
    if (isNum(pt.egfr) && pt.egfr < 30) qtRisks.push('eGFR <30');
    const qtRiskCount = qtRisks.length;
    const lytesTodo = 'Keep K ≥4.0 mmol/L and Mg ≥0.8 mmol/L.';

    // Tisdale (Circ Cardiovasc Qual Outcomes 2013)
    const tis = [];
    const T = (label, pts, on) => tis.push({ label, pts, on: !!on });
    T('Age ≥68', 1, isNum(pt.age) && pt.age >= 68);
    T('Female', 1, female);
    T('Loop diuretic', 1, tagged('loop').length > 0);
    T('K ≤3.5 mmol/L', 2, isNum(pt.k) && pt.k <= 3.5);
    T('Admission QTc ≥450 ms', 2, qtc !== null && qtc >= 450);
    T('Acute MI', 2, pt.ami);
    T('Sepsis', 3, pt.sepsis);
    T('Heart failure', 3, pt.hf);
    T('One QTc-prolonging drug', 3, qtDrugs.length >= 1);
    T('≥2 QTc-prolonging drugs', 3, qtDrugs.length >= 2);
    const tisScore = tis.reduce((s, x) => s + (x.on ? x.pts : 0), 0);
    const tisBand = tisScore >= 11 ? 'High' : tisScore >= 7 ? 'Moderate' : 'Low';

    if (pt.longQT && qtDrugs.length) F('qt', 'High', 'QT drug with congenital long QT / prior TdP', qtDrugs, 'Known long QT syndrome or prior torsades.', 'Avoid QT-prolonging drugs where possible; cardiology input.');
    if (qtc500 && qtDrugs.length) F('qt', 'High', 'QTc ' + qtc + ' ms on QT-prolonging drug(s)', qtDrugs, 'QTc ≥500 ms is associated with a 2–3× higher TdP risk.', 'Stop or switch the QT drug(s) if possible. Telemetry. ' + lytesTodo + ' Repeat ECG.');
    if (qtDrugs.length >= 2) {
      let sev;
      if (qtKnown.length >= 1) sev = (qtcProlonged || qtRiskCount >= 2) ? 'High' : 'Moderate';
      else sev = (qtcProlonged || qtRiskCount >= 3) ? 'Moderate' : 'Low';
      F('qt', sev, qtDrugs.length + ' QT-prolonging drugs combined', qtDrugs,
        (qtKnown.length ? 'Includes known-TdP drug(s): ' + names(qtKnown) + '. ' : 'Possible/conditional risk drugs only. ') + (qtRiskCount ? 'Risk factors: ' + qtRisks.join(', ') + '.' : ''),
        'Ask whether each drug is needed; use the alternative where one exists. ' + (qtc === null ? 'Get a baseline ECG. ' : 'Repeat ECG after steady state / after IV doses. ') + lytesTodo);
    } else if (qtDrugs.length === 1 && qtKnown.length === 1 && !qtc500 && (qtcProlonged || qtRiskCount >= 3)) {
      F('qt', 'Moderate', 'Known-TdP drug with QT risk factors', qtKnown, (qtcProlonged ? 'QTc ' + qtc + ' ms (prolonged). ' : '') + 'Risk factors: ' + qtRisks.join(', ') + '.', (qtKnown[0].drug.alt ? qtKnown[0].drug.alt + ' ' : '') + 'ECG monitoring. ' + lytesTodo);
    }
    if (qtKnown.length && qtc === null) F('qt', 'Low', 'No QTc found', qtKnown, 'On a known-TdP drug and no QTc in the chart window.', 'Get a 12-lead ECG (enter the QTc on the Patient data tab).');
    // dose checks (elderly SSRIs)
    meds.forEach(x => {
      if (x.drug.doseMaxElderly && isNum(pt.age) && pt.age > 65) {
        const over = x.dose !== null && x.dose > x.drug.doseMaxElderly;
        F('qt', over ? 'High' : 'Low', x.drug.name + (over ? ' ' + x.dose + ' mg above' : ': check dose vs') + ' max ' + x.drug.doseMaxElderly + ' mg/day for age >65', [x], x.drug.qtNote, over ? 'Reduce to ≤' + x.drug.doseMaxElderly + ' mg/day or switch (sertraline).' : 'Confirm daily dose ≤' + x.drug.doseMaxElderly + ' mg.');
      }
    });
    // PK: CYP3A4 inhibitor raises level of QT drug
    const inh3a4 = tagged('cyp3a4inh'), sub3a4 = tagged('3a4sub_qt');
    sub3a4.forEach(s => {
      const inh = inh3a4.filter(i => i.drug.name !== s.drug.name);
      if (inh.length) F('qt', s.drug.qt === 'known' ? 'High' : 'Moderate', 'CYP3A4 inhibitor raises ' + s.drug.name + ' levels', [s].concat(inh), names(inh) + ' inhibits CYP3A4 → higher ' + s.drug.name + ' exposure (QT effect is concentration-dependent).', 'Choose a non-interacting alternative or reduce dose; ECG.' + (s.drug.name === 'domperidone' ? ' Domperidone is contraindicated with strong CYP3A4 inhibitors.' : ''));
    });
    const inh2c19 = tagged('cyp2c19inh').concat(tagged('cyp2c19inh_weak'));
    tagged('2c19sub_qt').forEach(s => {
      if (inh2c19.length) F('qt', tagged('cyp2c19inh').length ? 'Moderate' : 'Low', 'CYP2C19 inhibitor raises ' + s.drug.name + ' levels', [s].concat(inh2c19), names(inh2c19) + ' inhibits CYP2C19.', s.drug.name === 'citalopram' ? 'Citalopram max 20 mg/day with a CYP2C19 inhibitor.' : 'Use lower dose; consider sertraline.');
    });

    // ================= SEROTONIN =================
    const ssDrugs = meds.filter(x => x.drug.ss);
    const lvl = l => ssDrugs.filter(x => x.drug.ss === l);
    const maoi = lvl('maoi'), maoiW = lvl('maoi_weak'), sStrong = lvl('strong'), sMod = lvl('moderate'), sWeak = lvl('weak');
    const sNonMaoi = sStrong.concat(sMod);
    let ssPairFound = false;
    if (maoi.length && (sNonMaoi.length || maoi.length > 1)) {
      ssPairFound = true;
      F('ss', 'Contraindicated', 'MAOI + serotonergic drug', maoi.concat(sNonMaoi), 'MAO inhibition with serotonin reuptake inhibition/release can cause severe serotonin toxicity (hyperthermia, rigidity, death).', 'Do not combine. Washout: 2 weeks after most SSRIs/SNRIs, 5 weeks after fluoxetine, 2 weeks after stopping an MAOI. If methylene blue is essential, discuss with toxicology/anesthesia.');
    } else if (maoi.length && sWeak.length) {
      F('ss', 'Moderate', 'MAOI + weakly serotonergic drug', maoi.concat(sWeak), 'Lower risk but reported.', 'Avoid if possible; monitor (Hunter criteria).');
    }
    if (maoiW.length && sNonMaoi.length) {
      ssPairFound = true;
      const maob = maoiW.filter(x => has(x.drug, 'maob'));
      const contra = sNonMaoi.filter(x => has(x.drug, 'maob_contra'));
      if (maob.length && contra.length) F('ss', 'Contraindicated', 'MAO-B inhibitor + ' + names(contra), maob.concat(contra), 'Product monographs contraindicate meperidine, tramadol, methadone, tapentadol and dextromethorphan with MAO-B inhibitors.', 'Use a different analgesic/antitussive.');
      const rest = sNonMaoi.filter(x => !(maob.length && has(x.drug, 'maob_contra')));
      if (rest.length) F('ss', 'High', names(maoiW) + ' (weak MAOI) + serotonergic drug', maoiW.concat(rest), 'Serotonin toxicity reported, mostly within the first days of the combination.', (maoiW[0].drug.alt || 'Use the lowest doses and monitor.') + ' Check Hunter criteria daily; tell the patient/nurse what to watch for.');
    }
    if (!maoi.length) {
      const total = sStrong.length + sMod.length;
      let sev = null;
      if (sStrong.length >= 2) sev = 'High';
      else if (sStrong.length === 1 && sMod.length >= 1) sev = 'Moderate';
      else if (sMod.length >= 2) sev = 'Moderate';
      if (sev && total >= 3) sev = 'High';
      if (sev) {
        ssPairFound = true;
        F('ss', sev, total + ' serotonergic drugs combined', sStrong.concat(sMod), 'Strong: ' + (names(sStrong) || '–') + '. Moderate: ' + (names(sMod) || '–') + '.', 'Is each one needed? Avoid starting/increasing two at once. Watch for tremor, hyperreflexia, inducible clonus, agitation, diaphoresis, fever (Hunter criteria tab).');
      }
      if (!sev && total >= 1 && sWeak.length) F('ss', 'Low', 'Serotonergic drug + weak serotonergic drug', sStrong.concat(sMod, sWeak), 'Low-risk combination (e.g. with ondansetron, triptan, mirtazapine).', 'No change usually needed; know the signs.');
    }
    const dup = ['SSRI', 'SNRI'].map(c => sStrong.filter(x => x.drug.cls === c)).filter(a => a.length > 1);
    dup.forEach(a => F('ss', 'Moderate', 'Two ' + a[0].drug.cls + 's listed', a, 'Duplication – cross-taper or order error?', 'Confirm intended regimen with patient/pharmacy.'));
    const inh2d6 = tagged('cyp2d6inh');
    tagged('2d6_tramadol').forEach(s => {
      const inh = inh2d6.filter(i => i.drug.name !== s.drug.name);
      if (inh.length) F('ss', 'Moderate', 'CYP2D6 inhibitor + tramadol', [s].concat(inh), names(inh) + ' blocks conversion to the active opioid metabolite → less analgesia, more parent tramadol (serotonergic, seizures).', 'Use a different opioid.');
    });

    // ================= SEIZURE =================
    const szDrugs = meds.filter(x => x.drug.sz);
    const szHigh = szDrugs.filter(x => x.drug.sz === 'high'), szMod = szDrugs.filter(x => x.drug.sz === 'moderate');
    const szRisks = [];
    if (pt.seizureHx) szRisks.push('Seizure disorder on problem list');
    if (onAED) szRisks.push('On antiseizure medication (' + names(tagged('aed')) + ')');
    if (isNum(pt.na) && pt.na < 125) szRisks.push('Na ' + pt.na + ' (<125)');
    if (isNum(pt.glucose) && pt.glucose < 3.0) szRisks.push('Glucose ' + pt.glucose + ' (<3.0)');
    if (isNum(pt.mg) && pt.mg < 0.5) szRisks.push('Mg ' + pt.mg + ' (<0.5)');
    if ((isNum(pt.ica) && pt.ica < 1.0) || (!isNum(pt.ica) && isNum(pt.ca) && pt.ca < 1.9)) szRisks.push('Low calcium');
    if (isNum(pt.egfr) && pt.egfr < 30) szRisks.push('eGFR <30 (drug accumulation)');
    if (pt.withdrawal) szRisks.push('Alcohol/benzodiazepine withdrawal');
    const metabolic = szRisks.filter(r => !/Seizure disorder|antiseizure/.test(r));

    const vpa = tagged('vpa'), carb = tagged('carbapenem');
    if (vpa.length && carb.length) F('sz', 'High', 'Carbapenem + valproate', vpa.concat(carb), 'Carbapenems drop valproate levels by 60–100% within 24 h (blocks enterohepatic recycling/increases glucuronidation). Raising the VPA dose does not overcome it; levels recover only 1–2 weeks after stopping the carbapenem.', 'Use a non-carbapenem antibiotic, or switch/bridge the antiseizure drug (e.g. levetiracetam) – involve neurology/pharmacy.');
    const bup = tagged('bupropion');
    const hxLabel = pt.seizureHx ? 'seizure disorder' : 'antiseizure drug (seizure disorder?)';
    if (bup.length && (seizureHx || pt.withdrawal)) F('sz', (pt.seizureHx || pt.withdrawal) ? 'Contraindicated' : 'High', 'Bupropion with ' + (seizureHx ? hxLabel : 'alcohol/benzodiazepine withdrawal'), bup, 'Bupropion is contraindicated in seizure disorders and during abrupt alcohol/benzodiazepine withdrawal.', 'Hold/stop bupropion; choose another antidepressant/smoking-cessation aid.');
    const flu = tagged('flumazenil');
    if (flu.length && tagged('benzo').length) F('sz', 'High', 'Flumazenil in patient on benzodiazepines', flu.concat(tagged('benzo')), 'Flumazenil can precipitate withdrawal seizures in benzodiazepine-dependent patients.', 'Avoid unless short procedural sedation reversal in a benzo-naïve patient; support ventilation instead.');
    // CYP1A2
    const inh1a2 = tagged('cyp1a2inh');
    tagged('theophylline').forEach(s => { if (inh1a2.length) F('sz', 'High', names(inh1a2) + ' raises ' + s.drug.name + ' levels', [s].concat(inh1a2), 'CYP1A2 inhibition → theophylline toxicity (arrhythmia, seizures).', 'Avoid the combination or reduce theophylline dose and check levels.'); });
    tagged('cyp1a2sub').forEach(s => { const inh = inh1a2.filter(i => i.drug.name !== s.drug.name); if (inh.length) F('sz', has(s.drug, 'clozapine') ? 'High' : 'Low', names(inh) + ' raises ' + s.drug.name + ' levels', [s].concat(inh), 'CYP1A2 inhibition (fluvoxamine can raise clozapine levels several-fold).', has(s.drug, 'clozapine') ? 'Avoid or reduce clozapine dose and check clozapine level; psychiatry/pharmacy.' : 'Monitor for sedation.'); });
    // Inducers lowering AED levels
    const ind = tagged('inducer_ext'), aedLvl = tagged('aed_level');
    if (ind.length && aedLvl.length) F('sz', 'Moderate', names(ind) + ' lowers antiseizure drug levels', ind.concat(aedLvl), 'Enzyme induction lowers ' + names(aedLvl) + ' levels → breakthrough seizures.', 'Check levels; adjust dose; neurology/pharmacy.');
    if (tagged('estrogen').length && tagged('lamotrigine').length) F('sz', 'Moderate', 'Estrogen-containing contraceptive + lamotrigine', tagged('estrogen').concat(tagged('lamotrigine')), 'Ethinyl estradiol roughly halves lamotrigine levels (and levels rise in the pill-free week).', 'Lamotrigine dose adjustment usually needed; neurology.');
    // Threshold-lowering drugs in at-risk patients
    const strongish = szHigh.concat(szMod);
    if (seizureHx && szHigh.length) F('sz', 'High', 'High-risk seizure drug + ' + hxLabel, szHigh, 'Seizure history/AED therapy plus ' + names(szHigh) + '.', 'Avoid if an alternative exists (see drug notes); ensure antiseizure drugs are not missed.');
    else if (seizureHx && szMod.length) F('sz', 'Moderate', 'Seizure-threshold-lowering drug + ' + hxLabel, szMod, 'Seizure history/AED therapy plus ' + names(szMod) + '.', 'Use if needed, with lowest effective dose; correct metabolic factors.');
    if (!seizureHx && strongish.length && metabolic.length) F('sz', szHigh.length ? 'Moderate' : 'Low', 'Seizure-threshold-lowering drug with metabolic risk', strongish, 'Risk factors: ' + metabolic.join(', ') + '.', 'Correct Na/glucose/Ca/Mg; check renal dosing.');
    if (strongish.length >= 2) F('sz', strongish.length >= 3 || szHigh.length >= 2 ? 'High' : 'Moderate', strongish.length + ' seizure-threshold-lowering drugs combined', strongish, names(strongish) + '.', 'Additive risk – review need for each; renal dosing.');

    // ================= renal rules (any cat) =================
    if (isNum(pt.egfr)) meds.forEach(x => {
      const rs = (x.drug.renal || []).filter(r => pt.egfr < r.egfr);
      if (!rs.length) return;
      const r = rs.sort((a, b) => a.egfr - b.egfr)[0]; // strictest threshold triggered
      F(r.cat, r.sev, x.drug.name + ' with eGFR ' + pt.egfr, [x], r.text, x.drug.alt || 'Check renal dose with pharmacy.');
    });

    findings.sort((a, b) => SEV_ORDER[a.sev] - SEV_ORDER[b.sev]);
    findings.forEach(f => { f.drugNames = f.drugs.map(x => x.drug.name + (x.proposed ? ' (proposed)' : '')); delete f.drugs; });
    return {
      meds, unmatched, findings,
      qt: { drugs: qtDrugs, risks: qtRisks, qtc, qtcProlonged, qtc500, qtcProlongCut, tisdale: { items: tis, score: tisScore, band: tisBand } },
      ss: { drugs: ssDrugs, pairFound: ssPairFound },
      sz: { drugs: szDrugs, risks: szRisks, seizureHx }
    };
  }

  // CKD-EPI 2021 (creatinine in µmol/L)
  function ckdEpi2021(scrUmol, age, sex) {
    if (!scrUmol || !age || !sex) return null;
    const scr = scrUmol / 88.4, f = sex === 'female';
    const k = f ? 0.7 : 0.9, a = f ? -0.241 : -0.302;
    const e = 142 * Math.pow(Math.min(scr / k, 1), a) * Math.pow(Math.max(scr / k, 1), -1.2) * Math.pow(0.9938, age) * (f ? 1.012 : 1);
    return Math.round(e);
  }

  const api = { DRUGS, matchDrug, analyze, ckdEpi2021, SEV_ORDER, parseDoseMg };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.DDI = api;
})(this);
