/* Dementia Workup – MADE-UP test patients (not real people).
 * Used by the app (index.html?demo=1 … ?demo=10) and by make-test-pdfs.js, which turns each one into a chart-extract PDF
 * for the Hospitalist Toolkit "Import PDF" button. Dates are days before today.
 * labs: [name, loinc, value, unit, low, high]; preset: checklist items that cannot come from the chart (bedside-only). */
(function (root) {
  const DEMOS = [
    {
      key: "dlb", expect: "Lewy body dementia (probable) + delirium; vascular/mixed features; haloperidol and oxybutynin to stop; HR 56 on metoprolol.",
      name: "DEMO, Harold", given: "Harold", family: "DEMO", sex: "male", birthDate: "1944-03-12", mrn: "TESTDEM01",
      conds: ["Essential hypertension", "Type 2 diabetes mellitus", "Atrial fibrillation", "Urinary tract infection", "Hearing loss, bilateral", "Constipation"],
      labs: [["Vitamin B12", "2132-9", 182, "pmol/L", 148, 600], ["TSH", "3016-3", 2.1, "mIU/L", 0.35, 5.0], ["Calcium", "17861-6", 2.31, "mmol/L", 2.10, 2.55],
        ["Glucose", "2345-7", 7.8, "mmol/L", 3.6, 7.8], ["Sodium", "2951-2", 131, "mmol/L", 135, 145], ["Hemoglobin", "718-7", 118, "g/L", 135, 175],
        ["MCV", "787-2", 97, "fL", 80, 100], ["Creatinine", "2160-0", 128, "umol/L", 60, 110], ["eGFR", "33914-3", 46, "mL/min/1.73m2", 60, 200], ["ALT", "1742-6", 18, "U/L", 0, 40]],
      hr: 56, bp: "128/70", wt: 71,
      meds: ["Metoprolol tartrate 25 mg PO BID", "Apixaban 2.5 mg PO BID", "Amlodipine 5 mg PO daily", "Oxybutynin 5 mg PO BID", "Lorazepam 0.5 mg PO qHS PRN", "Haloperidol 0.5 mg SC q4h PRN agitation", "Metformin 500 mg PO BID", "Ceftriaxone 1 g IV q24h"],
      docs: [
        { d: 1, title: "Hospitalist Admission Note", text: "82 M admitted with urosepsis and delirium. Collateral from wife: memory decline over the past 2 years, repeats questions, and she now manages his finances and medications (blister pack). Stopped driving 6 months ago after getting lost. For several years he has acted out his dreams, punching in his sleep. Over the past year he describes seeing children in the garden that are not there. Fell twice this year. Orthostatic drop noted in clinic. No alcohol use. No depression history. MoCA 17/30 done by GP in spring (12 yr education)." },
        { d: 0, title: "Hospitalist Progress Note", text: "Day 2. More settled today. Wife at bedside reports he has had good days and bad days for about a year, with daytime drowsiness and staring spells. CAM positive on admission, improving. No hallucinations overnight. Exam: masked facies, mild bradykinesia, cogwheel rigidity at the right wrist, no rest tremor. No focal deficit." }
      ],
      imaging: [{ d: 1, title: "CT HEAD WITHOUT CONTRAST", text: "FINDINGS: Generalized cerebral volume loss. Mild periventricular white matter hypodensities in keeping with chronic small vessel ischemic change. No acute infarct. No hemorrhage. No hydrocephalus. No mass. IMPRESSION: No acute intracranial process. Chronic small vessel ischemic change and age-related atrophy." }]
    },
    {
      key: "ad", expect: "Alzheimer disease (strong): memory-led, gradual, hippocampal + parietal atrophy; dementia stage (IADLs). No delirium. Bloods normal.",
      name: "DEMO, Margaret", given: "Margaret", family: "DEMO", sex: "female", birthDate: "1947-06-02", mrn: "TESTDEM02",
      conds: ["Hip fracture, left femoral neck", "Hypertension", "Osteoporosis", "Hypothyroidism"],
      labs: [["Vitamin B12", "2132-9", 410, "pmol/L", 148, 600], ["TSH", "3016-3", 2.4, "mIU/L", 0.35, 5.0], ["Calcium", "17861-6", 2.32, "mmol/L", 2.10, 2.55],
        ["Glucose", "2345-7", 5.6, "mmol/L", 3.6, 7.8], ["Sodium", "2951-2", 139, "mmol/L", 135, 145], ["Hemoglobin", "718-7", 124, "g/L", 120, 160],
        ["Creatinine", "2160-0", 72, "umol/L", 45, 90], ["eGFR", "33914-3", 68, "mL/min/1.73m2", 60, 200]],
      hr: 74, bp: "142/78", wt: 58,
      meds: ["Levothyroxine 75 mcg PO daily", "Alendronate 70 mg PO weekly", "Amlodipine 5 mg PO daily", "Acetaminophen 1 g PO QID", "Hydromorphone 0.5 mg PO q4h PRN pain"],
      docs: [{ d: 2, title: "Hospitalist Consult Note - Orthopedics", text: "79-year-old woman admitted with a left hip fracture after a fall at home. Daughter reports gradual memory decline over the past 3 years: repeats the same questions, misplaces her keys and purse, forgot appointments. Her daughter now manages her finances and medications. Got lost driving to a familiar store last year and stopped driving. No visual hallucinations. Does not act out dreams. No tremor. Mood is good. No alcohol. Alert and attentive on admission, 4AT 0. MoCA 19/30 (14 years education): recall 0/5, orientation 4/6." }],
      imaging: [{ d: 30, title: "MRI BRAIN", text: "FINDINGS: Bilateral medial temporal lobe atrophy, MTA score 3, with parietal volume loss including the precuneus. No significant white matter disease. No infarcts. No microbleeds. Ventricles proportionate to sulci. IMPRESSION: Pattern of atrophy suggestive of Alzheimer disease." }]
    },
    {
      key: "ftd", expect: "Behavioural-variant FTD (probable): ≥5/6 features + frontal/anterior temporal atrophy; young onset; no cholinesterase inhibitor.",
      name: "DEMO, Gordon", given: "Gordon", family: "DEMO", sex: "male", birthDate: "1967-01-20", mrn: "TESTDEM03",
      conds: ["Community-acquired pneumonia", "Gastroesophageal reflux disease"],
      labs: [["Vitamin B12", "2132-9", 350, "pmol/L", 148, 600], ["TSH", "3016-3", 1.8, "mIU/L", 0.35, 5.0], ["Calcium", "17861-6", 2.40, "mmol/L", 2.10, 2.55],
        ["Glucose", "2345-7", 6.1, "mmol/L", 3.6, 7.8], ["Sodium", "2951-2", 138, "mmol/L", 135, 145], ["Hemoglobin", "718-7", 148, "g/L", 135, 175],
        ["Creatinine", "2160-0", 88, "umol/L", 60, 110], ["eGFR", "33914-3", 88, "mL/min/1.73m2", 60, 200]],
      hr: 82, bp: "126/76", wt: 96,
      meds: ["Amoxicillin-clavulanate 875 mg PO BID", "Pantoprazole 40 mg PO daily"],
      preset: ["early", "execspared"],
      docs: [{ d: 1, title: "Hospitalist Admission Note", text: "59 M admitted with pneumonia. Wife reports 2 years of personality change. Disinhibition: makes socially inappropriate comments to strangers and impulsive spending. Apathy, with loss of interest in golf and friends. Loss of empathy: no reaction when his brother died. New compulsive behaviour: hoarding newspapers and walking the same route every day. Craving sweets and binge eating whole boxes of cookies. Memory for recent events is good and he still finds his way around. Lost his job as an accountant because of poor judgment. Wife now manages the finances. Father had early dementia in his 50s. MoCA 24/30 (loses points on fluency, abstraction and trails)." }],
      imaging: [{ d: 1, title: "MRI BRAIN", text: "FINDINGS: Marked bilateral frontal lobe atrophy and anterior temporal lobe atrophy, right greater than left, with knife-edge gyri. Hippocampi relatively preserved. No white matter disease. No infarct. IMPRESSION: Frontotemporal predominant atrophy." }]
    },
    {
      key: "vad", expect: "Vascular dementia (probable): stroke history, stepwise course, infarcts + extensive white-matter disease, executive/slowed profile, focal signs.",
      name: "DEMO, Raymond", given: "Raymond", family: "DEMO", sex: "male", birthDate: "1950-09-14", mrn: "TESTDEM04",
      conds: ["Ischemic stroke, left MCA (2023)", "Hypertension", "Type 2 diabetes mellitus", "Dyslipidemia", "Tobacco use", "Aspiration pneumonia"],
      labs: [["Vitamin B12", "2132-9", 290, "pmol/L", 148, 600], ["TSH", "3016-3", 1.2, "mIU/L", 0.35, 5.0], ["Calcium", "17861-6", 2.28, "mmol/L", 2.10, 2.55],
        ["Glucose", "2345-7", 9.4, "mmol/L", 3.6, 7.8], ["Sodium", "2951-2", 137, "mmol/L", 135, 145], ["Hemoglobin", "718-7", 139, "g/L", 135, 175],
        ["Creatinine", "2160-0", 104, "umol/L", 60, 110], ["eGFR", "33914-3", 63, "mL/min/1.73m2", 60, 200], ["Hemoglobin A1c", "4548-4", 8.1, "%", 4.0, 6.0], ["LDL cholesterol", "13457-7", 2.9, "mmol/L", 0, 2.0]],
      hr: 78, bp: "158/88", wt: 84,
      meds: ["Clopidogrel 75 mg PO daily", "Atorvastatin 20 mg PO daily", "Ramipril 5 mg PO daily", "Metformin 1000 mg PO BID", "Ceftriaxone 1 g IV q24h"],
      docs: [{ d: 1, title: "Hospitalist Admission Note", text: "76 M admitted with aspiration pneumonia. Wife describes a stepwise decline: clear worsening after his left MCA stroke in 2023 and again after a small stroke this spring. Slowed thinking, difficulty planning and organizing, apathy. Memory relatively preserved. Needs help with his medications (blister pack) and his wife now manages the finances. Small-stepped gait. Exam: right pronator drift, right Babinski, mild dysarthria. Attentive, 4AT 0. MoCA 18/30 with poor trails, cube copy and fluency; recall 3/5 with cues." }],
      imaging: [{ d: 120, title: "MRI BRAIN", text: "FINDINGS: Chronic left MCA territory infarct with encephalomalacia. Multiple lacunar infarcts in the basal ganglia and thalami. Extensive confluent periventricular white matter hyperintensities, Fazekas grade 3. Mild generalized atrophy; hippocampi preserved. IMPRESSION: Extensive small vessel disease and prior infarcts." }]
    },
    {
      key: "nph", expect: "Normal pressure hydrocephalus (strong): gait first, urinary incontinence, ventriculomegaly with DESH; oxybutynin started for the bladder (stop).",
      name: "DEMO, Evelyn", given: "Evelyn", family: "DEMO", sex: "female", birthDate: "1949-04-08", mrn: "TESTDEM05",
      conds: ["Recurrent falls", "Hypertension", "Urge incontinence"],
      labs: [["Vitamin B12", "2132-9", 380, "pmol/L", 148, 600], ["TSH", "3016-3", 3.1, "mIU/L", 0.35, 5.0], ["Calcium", "17861-6", 2.35, "mmol/L", 2.10, 2.55],
        ["Glucose", "2345-7", 5.2, "mmol/L", 3.6, 7.8], ["Sodium", "2951-2", 133, "mmol/L", 135, 145], ["Hemoglobin", "718-7", 126, "g/L", 120, 160],
        ["Creatinine", "2160-0", 70, "umol/L", 45, 90], ["eGFR", "33914-3", 72, "mL/min/1.73m2", 60, 200]],
      hr: 70, bp: "136/74", wt: 64,
      meds: ["Oxybutynin 5 mg PO BID", "Hydrochlorothiazide 25 mg PO daily", "Vitamin D 1000 units PO daily"],
      docs: [{ d: 1, title: "Hospitalist Admission Note", text: "77 F admitted after recurrent falls. Gait difficulty came first, about 9 months ago: her feet feel glued to the floor, magnetic gait with short steps and en bloc turns. Urge incontinence for the past 6 months; oxybutynin was started by her GP. In the last 3 months, slowed thinking and she is more forgetful. Daughter now manages her medications. No resting tremor. No hallucinations. Attentive, 4AT 0. MoCA 21/30." }],
      imaging: [{ d: 1, title: "CT HEAD WITHOUT CONTRAST", text: "FINDINGS: Ventriculomegaly disproportionate to the degree of sulcal atrophy, Evans index 0.36. Crowding of the high convexity sulci with enlarged Sylvian fissures (DESH pattern). No mass. No hemorrhage. IMPRESSION: Findings raise the possibility of normal pressure hydrocephalus." }]
    },
    {
      key: "cjd", expect: "Rapidly progressive dementia – CJD concern (strong): 8-week decline, myoclonus, DWI cortical ribboning + caudate/putamen; urgent neurology, LP with RT-QuIC, infection prevention.",
      name: "DEMO, Douglas", given: "Douglas", family: "DEMO", sex: "male", birthDate: "1959-11-30", mrn: "TESTDEM06",
      conds: ["Hypertension"],
      labs: [["Vitamin B12", "2132-9", 330, "pmol/L", 148, 600], ["TSH", "3016-3", 1.9, "mIU/L", 0.35, 5.0], ["Calcium", "17861-6", 2.30, "mmol/L", 2.10, 2.55],
        ["Glucose", "2345-7", 5.9, "mmol/L", 3.6, 7.8], ["Sodium", "2951-2", 140, "mmol/L", 135, 145], ["Hemoglobin", "718-7", 145, "g/L", 135, 175],
        ["Creatinine", "2160-0", 81, "umol/L", 60, 110], ["eGFR", "33914-3", 90, "mL/min/1.73m2", 60, 200], ["Ammonia", "16362-6", 22, "umol/L", 11, 35]],
      hr: 76, bp: "132/80", wt: 79,
      meds: ["Amlodipine 5 mg PO daily", "Acetaminophen 650 mg PO q6h PRN"],
      docs: [
        { d: 2, title: "Hospitalist Admission Note", text: "67 M, previously independent retired engineer. Rapidly progressive decline over the past 8 weeks: confusion, visual distortions, unsteady gait, now unable to dress or feed himself. Family now manages his finances. Family noticed jerking movements. Exam: multifocal myoclonus with startle, cerebellar ataxia. Afebrile. No recent travel." },
        { d: 0, title: "Hospitalist Progress Note", text: "EEG: periodic sharp-wave complexes. Neurology aware. LP planned for cell count, protein, 14-3-3 and RT-QuIC. Infection prevention notified about instrument handling." }
      ],
      imaging: [{ d: 1, title: "MRI BRAIN WITH DWI", text: "FINDINGS: Cortical ribboning on DWI in the bilateral parietal and frontal cortex, with restricted diffusion in the caudate and putamen bilaterally. No enhancement. No mass. IMPRESSION: Pattern concerning for prion disease (Creutzfeldt-Jakob disease)." }]
    },
    {
      key: "alc", expect: "Korsakoff / alcohol-related (moderate): heavy alcohol, amnesia with confabulation; low B12, macrocytosis; oral thiamine only (needs IV high dose).",
      name: "DEMO, Kevin", given: "Kevin", family: "DEMO", sex: "male", birthDate: "1968-02-17", mrn: "TESTDEM07",
      conds: ["Alcohol use disorder", "Alcohol-related liver disease", "Peripheral neuropathy"],
      labs: [["Vitamin B12", "2132-9", 118, "pmol/L", 148, 600], ["Folate", "2284-8", 6.1, "nmol/L", 10, 45], ["TSH", "3016-3", 2.6, "mIU/L", 0.35, 5.0], ["Calcium", "17861-6", 2.18, "mmol/L", 2.10, 2.55],
        ["Glucose", "2345-7", 4.9, "mmol/L", 3.6, 7.8], ["Sodium", "2951-2", 132, "mmol/L", 135, 145], ["Hemoglobin", "718-7", 112, "g/L", 135, 175], ["MCV", "787-2", 108, "fL", 80, 100],
        ["ALT", "1742-6", 88, "U/L", 0, 40], ["Albumin", "1751-7", 29, "g/L", 35, 50], ["Creatinine", "2160-0", 66, "umol/L", 60, 110], ["eGFR", "33914-3", 104, "mL/min/1.73m2", 60, 200]],
      hr: 92, bp: "138/86", wt: 61,
      meds: ["Thiamine 100 mg PO daily", "Lorazepam 1 mg PO q1h PRN per CIWA", "Multivitamin PO daily", "Folic acid 1 mg PO daily"],
      docs: [{ d: 3, title: "Hospitalist Admission Note", text: "58 M with heavy alcohol use, about 12 beers a day for 20 years, last drink 3 days ago. Poor oral intake for months. Marked short-term memory loss: cannot recall breakfast, and confabulates detailed stories about going to work this morning. Ataxic gait, horizontal nystagmus. Attention intact; no delirium. No myoclonus. MoCA 16/30 (recall 0/5)." }],
      imaging: [{ d: 3, title: "CT HEAD WITHOUT CONTRAST", text: "FINDINGS: Generalized atrophy more than expected for age, with cerebellar vermian atrophy. No subdural hematoma. No acute infarct. IMPRESSION: Atrophy, cerebellar predominant." }]
    },
    {
      key: "pdd", expect: "Parkinson disease dementia (strong, 1-year rule); hallucinations — pramipexole and trihexyphenidyl to reduce/stop; rivastigmine; check orthostatic BP.",
      name: "DEMO, Walter", given: "Walter", family: "DEMO", sex: "male", birthDate: "1946-07-25", mrn: "TESTDEM08",
      conds: ["Parkinson disease", "Orthostatic hypotension", "Constipation", "Benign prostatic hyperplasia"],
      labs: [["Vitamin B12", "2132-9", 300, "pmol/L", 148, 600], ["TSH", "3016-3", 2.0, "mIU/L", 0.35, 5.0], ["Calcium", "17861-6", 2.29, "mmol/L", 2.10, 2.55],
        ["Glucose", "2345-7", 5.4, "mmol/L", 3.6, 7.8], ["Sodium", "2951-2", 138, "mmol/L", 135, 145], ["Hemoglobin", "718-7", 131, "g/L", 135, 175],
        ["Creatinine", "2160-0", 98, "umol/L", 60, 110], ["eGFR", "33914-3", 63, "mL/min/1.73m2", 60, 200]],
      hr: 66, bp: "104/60", wt: 68,
      meds: ["Carbidopa-levodopa 25/100 mg 1.5 tab PO QID", "Pramipexole 0.5 mg PO TID", "Trihexyphenidyl 2 mg PO BID", "Tamsulosin 0.4 mg PO daily", "Polyethylene glycol 17 g PO daily"],
      docs: [{ d: 1, title: "Hospitalist Admission Note", text: "80 M with Parkinson disease diagnosed in 2017; motor symptoms began years before any cognitive change. Over the past 18 months: slowed thinking, difficulty planning, visuospatial problems (misjudges distances, dressing apraxia); now sees small animals in the room at night. Wife now manages his medications. Acts out his dreams. Exam: rest tremor right hand, bradykinesia, rigidity, hypomimia. Attentive, 4AT 1. MoCA 17/30." }],
      imaging: [{ d: 400, title: "CT HEAD WITHOUT CONTRAST", text: "FINDINGS: Mild generalized atrophy. No acute infarct. No hemorrhage. No hydrocephalus. IMPRESSION: No acute findings." }]
    },
    {
      key: "rev", expect: "No clear subtype – reversible contributors first: depression, high TSH (stopped levothyroxine), high calcium, low sodium, strong anticholinergics + benzodiazepine, hearing loss.",
      name: "DEMO, Doris", given: "Doris", family: "DEMO", sex: "female", birthDate: "1943-12-03", mrn: "TESTDEM09",
      conds: ["Major depressive disorder", "Hypothyroidism", "Overactive bladder", "Osteoarthritis", "Insomnia", "Hearing loss"],
      labs: [["Vitamin B12", "2132-9", 260, "pmol/L", 148, 600], ["TSH", "3016-3", 18.5, "mIU/L", 0.35, 5.0], ["Calcium", "17861-6", 2.74, "mmol/L", 2.10, 2.55],
        ["Glucose", "2345-7", 5.0, "mmol/L", 3.6, 7.8], ["Sodium", "2951-2", 131, "mmol/L", 135, 145], ["Hemoglobin", "718-7", 121, "g/L", 120, 160],
        ["Creatinine", "2160-0", 88, "umol/L", 45, 90], ["eGFR", "33914-3", 52, "mL/min/1.73m2", 60, 200]],
      hr: 62, bp: "148/82", wt: 52,
      meds: ["Amitriptyline 25 mg PO qHS", "Oxybutynin 5 mg PO BID", "Lorazepam 1 mg PO qHS", "Diphenhydramine 25 mg PO qHS PRN sleep", "Hydrochlorothiazide 25 mg PO daily", "Calcium carbonate 1250 mg PO BID"],
      docs: [{ d: 1, title: "Hospitalist Admission Note", text: "83 F admitted with falls and 4 months of memory concerns. Daughter notes low mood since her husband died last year, poor sleep, weight loss, and she often answers 'I don't know'. Stopped taking her levothyroxine 6 months ago. Hard of hearing, no hearing aids. On amitriptyline and diphenhydramine for sleep, oxybutynin for bladder, lorazepam nightly. Still manages her own bills. Attentive, 4AT 0. Mini-Cog 2/5. MoCA 22/30 (testing limited by hearing)." }],
      imaging: [{ d: 1, title: "CT HEAD WITHOUT CONTRAST", text: "FINDINGS: Mild age-related atrophy. No acute infarct. No subdural collection. No hydrocephalus. IMPRESSION: No acute findings." }]
    },
    {
      key: "ppa", expect: "Logopenic primary progressive aphasia → usually Alzheimer; young onset; MCI-level (independent); suggests p-tau217/amyloid testing.",
      name: "DEMO, Linda", given: "Linda", family: "DEMO", sex: "female", birthDate: "1963-05-19", mrn: "TESTDEM10",
      conds: ["Cellulitis, right leg", "Migraine"],
      labs: [["Vitamin B12", "2132-9", 450, "pmol/L", 148, 600], ["TSH", "3016-3", 1.4, "mIU/L", 0.35, 5.0], ["Calcium", "17861-6", 2.38, "mmol/L", 2.10, 2.55],
        ["Glucose", "2345-7", 5.3, "mmol/L", 3.6, 7.8], ["Sodium", "2951-2", 141, "mmol/L", 135, 145], ["Hemoglobin", "718-7", 133, "g/L", 120, 160],
        ["Creatinine", "2160-0", 64, "umol/L", 45, 90], ["eGFR", "33914-3", 94, "mL/min/1.73m2", 60, 200]],
      hr: 72, bp: "122/74", wt: 66,
      meds: ["Cefazolin 2 g IV q8h", "Rizatriptan 10 mg PO PRN migraine"],
      preset: ["early"],
      docs: [{ d: 1, title: "Hospitalist Admission Note", text: "63 F admitted with cellulitis. Incidental history: 2 years of progressive word-finding difficulty with long pauses mid-sentence; speech-language pathology described a logopenic pattern with impaired sentence repetition. Single-word comprehension and grammar preserved. More recently a little forgetful. Still independent in all activities and works part-time. MoCA 22/30." }],
      imaging: [{ d: 200, title: "MRI BRAIN", text: "FINDINGS: Left temporoparietal atrophy involving the posterior superior temporal gyrus and inferior parietal lobule, with mild left hippocampal volume loss. No white matter disease. IMPRESSION: Asymmetric left temporoparietal atrophy." }]
    }
  ];
  root.DEMENTIA_DEMOS = DEMOS;
  if (typeof module !== "undefined" && module.exports) module.exports = DEMOS;
})(typeof window !== "undefined" ? window : globalThis);
