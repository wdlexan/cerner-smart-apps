// Made-up test patients for Import PDF > Load a sample patient. Not real people.
// Files are copies of each app's test-pdfs/ (regenerate there, then copy here). Folder = condition.
window.SAMPLE_PDFS = [
 {
  "folder": "Aortic stenosis",
  "label": "01 Doris - hip fracture with severe AS",
  "file": "Aortic stenosis/01 Doris - hip fracture with severe AS.pdf"
 },
 {
  "folder": "Aortic stenosis",
  "label": "02 Harold - low-flow low-gradient, low EF",
  "file": "Aortic stenosis/02 Harold - low-flow low-gradient, low EF.pdf"
 },
 {
  "folder": "Aortic stenosis",
  "label": "03 Margaret - paradoxical low-flow, CT calcium",
  "file": "Aortic stenosis/03 Margaret - paradoxical low-flow, CT calcium.pdf"
 },
 {
  "folder": "Aortic stenosis",
  "label": "04 Ronald - asymptomatic bicuspid, dilated aorta",
  "file": "Aortic stenosis/04 Ronald - asymptomatic bicuspid, dilated aorta.pdf"
 },
 {
  "folder": "Aortic stenosis",
  "label": "05 Evelyn - very severe AS, frail with dementia",
  "file": "Aortic stenosis/05 Evelyn - very severe AS, frail with dementia.pdf"
 },
 {
  "folder": "Aortic stenosis",
  "label": "06 Frank - high gradient from anemia (GI bleed)",
  "file": "Aortic stenosis/06 Frank - high gradient from anemia (GI bleed).pdf"
 },
 {
  "folder": "Autoimmune encephalitis",
  "label": "01 Amelia - anti-NMDAR",
  "file": "Autoimmune encephalitis/01 Amelia - anti-NMDAR.pdf"
 },
 {
  "folder": "Autoimmune encephalitis",
  "label": "02 Bernard - anti-LGI1",
  "file": "Autoimmune encephalitis/02 Bernard - anti-LGI1.pdf"
 },
 {
  "folder": "Autoimmune encephalitis",
  "label": "03 Carol - GABA-B with small-cell lung cancer",
  "file": "Autoimmune encephalitis/03 Carol - GABA-B with small-cell lung cancer.pdf"
 },
 {
  "folder": "Autoimmune encephalitis",
  "label": "04 Daniel - anti-Ma2",
  "file": "Autoimmune encephalitis/04 Daniel - anti-Ma2.pdf"
 },
 {
  "folder": "Autoimmune encephalitis",
  "label": "05 Elena - post-HSV encephalitis",
  "file": "Autoimmune encephalitis/05 Elena - post-HSV encephalitis.pdf"
 },
 {
  "folder": "Autoimmune encephalitis",
  "label": "06 Felix - mimic: primary psychosis",
  "file": "Autoimmune encephalitis/06 Felix - mimic: primary psychosis.pdf"
 },
 {
  "folder": "Autoimmune serology",
  "label": "01 Grace - SLE with nephritis",
  "file": "Autoimmune serology/01 Grace - SLE with nephritis.pdf"
 },
 {
  "folder": "Autoimmune serology",
  "label": "02 Harold - MPA with rapidly rising creatinine",
  "file": "Autoimmune serology/02 Harold - MPA with rapidly rising creatinine.pdf"
 },
 {
  "folder": "Autoimmune serology",
  "label": "03 Ian - GPA (sinus, cavitating nodules)",
  "file": "Autoimmune serology/03 Ian - GPA (sinus, cavitating nodules).pdf"
 },
 {
  "folder": "Autoimmune serology",
  "label": "04 Joan - seropositive rheumatoid arthritis",
  "file": "Autoimmune serology/04 Joan - seropositive rheumatoid arthritis.pdf"
 },
 {
  "folder": "Autoimmune serology",
  "label": "05 Kenneth - hydralazine drug-induced lupus",
  "file": "Autoimmune serology/05 Kenneth - hydralazine drug-induced lupus.pdf"
 },
 {
  "folder": "Autoimmune serology",
  "label": "06 Muriel - low-titre ANA, no autoimmune disease",
  "file": "Autoimmune serology/06 Muriel - low-titre ANA, no autoimmune disease.pdf"
 },
 {
  "folder": "Autoimmune serology",
  "label": "07 Norman - HCV cryoglobulinemic vasculitis",
  "file": "Autoimmune serology/07 Norman - HCV cryoglobulinemic vasculitis.pdf"
 },
 {
  "folder": "Autoimmune serology",
  "label": "08 Olivia - scleroderma renal crisis",
  "file": "Autoimmune serology/08 Olivia - scleroderma renal crisis.pdf"
 },
 {
  "folder": "Autoimmune serology",
  "label": "09 Paul - antisynthetase syndrome (Jo-1, ILD)",
  "file": "Autoimmune serology/09 Paul - antisynthetase syndrome (Jo-1, ILD).pdf"
 },
 {
  "folder": "Autoimmune serology",
  "label": "10 Rachel - triple-positive antiphospholipid",
  "file": "Autoimmune serology/10 Rachel - triple-positive antiphospholipid.pdf"
 },
 {
  "folder": "Bowel obstruction",
  "label": "01 Test patient - gallstone ileus",
  "file": "Bowel obstruction/01 Test patient - gallstone ileus.pdf"
 },
 {
  "folder": "Dementia",
  "label": "01 Harold - Lewy body",
  "file": "Dementia/01 Harold - Lewy body.pdf"
 },
 {
  "folder": "Dementia",
  "label": "02 Margaret - Alzheimer",
  "file": "Dementia/02 Margaret - Alzheimer.pdf"
 },
 {
  "folder": "Dementia",
  "label": "03 Gordon - frontotemporal (bvFTD)",
  "file": "Dementia/03 Gordon - frontotemporal (bvFTD).pdf"
 },
 {
  "folder": "Dementia",
  "label": "04 Raymond - vascular",
  "file": "Dementia/04 Raymond - vascular.pdf"
 },
 {
  "folder": "Dementia",
  "label": "05 Evelyn - normal pressure hydrocephalus",
  "file": "Dementia/05 Evelyn - normal pressure hydrocephalus.pdf"
 },
 {
  "folder": "Dementia",
  "label": "06 Douglas - rapidly progressive (CJD)",
  "file": "Dementia/06 Douglas - rapidly progressive (CJD).pdf"
 },
 {
  "folder": "Dementia",
  "label": "07 Kevin - alcohol-related",
  "file": "Dementia/07 Kevin - alcohol-related.pdf"
 },
 {
  "folder": "Dementia",
  "label": "08 Walter - Parkinson disease dementia",
  "file": "Dementia/08 Walter - Parkinson disease dementia.pdf"
 },
 {
  "folder": "Dementia",
  "label": "09 Doris - reversible causes",
  "file": "Dementia/09 Doris - reversible causes.pdf"
 },
 {
  "folder": "Dementia",
  "label": "10 Linda - primary progressive aphasia",
  "file": "Dementia/10 Linda - primary progressive aphasia.pdf"
 },
 {
  "folder": "Dementia",
  "label": "11 Arthur - PSP",
  "file": "Dementia/11 Arthur - PSP.pdf"
 },
 {
  "folder": "Dementia",
  "label": "12 Patricia - corticobasal syndrome",
  "file": "Dementia/12 Patricia - corticobasal syndrome.pdf"
 },
 {
  "folder": "Dementia",
  "label": "13 Bernard - MSA",
  "file": "Dementia/13 Bernard - MSA.pdf"
 },
 {
  "folder": "Dementia",
  "label": "14 Natalie - Huntington",
  "file": "Dementia/14 Natalie - Huntington.pdf"
 },
 {
  "folder": "Dementia",
  "label": "15 Frank - ALS-FTD",
  "file": "Dementia/15 Frank - ALS-FTD.pdf"
 },
 {
  "folder": "Dementia",
  "label": "16 Dorothy - LATE",
  "file": "Dementia/16 Dorothy - LATE.pdf"
 },
 {
  "folder": "Eating disorder",
  "label": "01 Sophie - frequent presenter, stable",
  "file": "Eating disorder/01 Sophie - frequent presenter, stable.pdf"
 },
 {
  "folder": "Eating disorder",
  "label": "02 Hannah - red admission criteria",
  "file": "Eating disorder/02 Hannah - red admission criteria.pdf"
 },
 {
  "folder": "Eating disorder",
  "label": "03 Marcus - partly assessed",
  "file": "Eating disorder/03 Marcus - partly assessed.pdf"
 },
 {
  "folder": "Eating disorder",
  "label": "04 Claire - admitted day 9",
  "file": "Eating disorder/04 Claire - admitted day 9.pdf"
 },
 {
  "folder": "Eating disorder",
  "label": "05 Priya - admitted day 4",
  "file": "Eating disorder/05 Priya - admitted day 4.pdf"
 },
 {
  "folder": "Hip fracture",
  "label": "01 Test patient - pathologic (lytic) fracture",
  "file": "Hip fracture/01 Test patient - pathologic (lytic) fracture.pdf"
 },
 {
  "folder": "Infection",
  "label": "01 Ray - necrotizing fasciitis",
  "file": "Infection/01 Ray - necrotizing fasciitis.pdf"
 },
 {
  "folder": "Infection",
  "label": "02 Agnes - pneumonia",
  "file": "Infection/02 Agnes - pneumonia.pdf"
 },
 {
  "folder": "Infection",
  "label": "03 Helen - ESBL pyelonephritis",
  "file": "Infection/03 Helen - ESBL pyelonephritis.pdf"
 },
 {
  "folder": "Infection",
  "label": "04 Tom - diverticulitis with abscess",
  "file": "Infection/04 Tom - diverticulitis with abscess.pdf"
 },
 {
  "folder": "Infection",
  "label": "05 Victor - meningitis",
  "file": "Infection/05 Victor - meningitis.pdf"
 },
 {
  "folder": "Infection",
  "label": "06 Margaret - cholangitis",
  "file": "Infection/06 Margaret - cholangitis.pdf"
 },
 {
  "folder": "Infection",
  "label": "07 Joel - tuberculosis",
  "file": "Infection/07 Joel - tuberculosis.pdf"
 },
 {
  "folder": "Infection",
  "label": "08 Doug - Fournier gangrene",
  "file": "Infection/08 Doug - Fournier gangrene.pdf"
 },
 {
  "folder": "Pain",
  "label": "01 Agnes",
  "file": "Pain/01 Agnes.pdf"
 },
 {
  "folder": "Pain",
  "label": "02 Victor",
  "file": "Pain/02 Victor.pdf"
 },
 {
  "folder": "Pain",
  "label": "03 Jordan",
  "file": "Pain/03 Jordan.pdf"
 },
 {
  "folder": "Pain",
  "label": "04 Glen",
  "file": "Pain/04 Glen.pdf"
 },
 {
  "folder": "Pain",
  "label": "05 Marcel",
  "file": "Pain/05 Marcel.pdf"
 },
 {
  "folder": "Pain",
  "label": "06 Ruth",
  "file": "Pain/06 Ruth.pdf"
 },
 {
  "folder": "Pain",
  "label": "07 Simone",
  "file": "Pain/07 Simone.pdf"
 },
 {
  "folder": "Peritoneal carcinomatosis",
  "label": "01 Arthur - colorectal, SBO, low K, metoclopramide",
  "file": "Peritoneal carcinomatosis/01 Arthur - colorectal, SBO, low K, metoclopramide.pdf"
 },
 {
  "folder": "Peritoneal carcinomatosis",
  "label": "02 Beatrice - ovarian, tense ascites, CA-125 rising",
  "file": "Peritoneal carcinomatosis/02 Beatrice - ovarian, tense ascites, CA-125 rising.pdf"
 },
 {
  "folder": "Peritoneal carcinomatosis",
  "label": "03 Charles - gastric, outlet obstruction, high Ca, lactate",
  "file": "Peritoneal carcinomatosis/03 Charles - gastric, outlet obstruction, high Ca, lactate.pdf"
 },
 {
  "folder": "Peritoneal carcinomatosis",
  "label": "04 Doris - new ascites, unknown primary",
  "file": "Peritoneal carcinomatosis/04 Doris - new ascites, unknown primary.pdf"
 },
 {
  "folder": "Peritoneal carcinomatosis",
  "label": "05 Edward - appendiceal pseudomyxoma, CRS referral",
  "file": "Peritoneal carcinomatosis/05 Edward - appendiceal pseudomyxoma, CRS referral.pdf"
 },
 {
  "folder": "Peritoneal carcinomatosis",
  "label": "06 Florence - pancreatic, inoperable MBO, end of life",
  "file": "Peritoneal carcinomatosis/06 Florence - pancreatic, inoperable MBO, end of life.pdf"
 },
 {
  "folder": "Seizure",
  "label": "01 Kevin - new onset",
  "file": "Seizure/01 Kevin - new onset.pdf"
 },
 {
  "folder": "Seizure",
  "label": "02 Maria - breakthrough",
  "file": "Seizure/02 Maria - breakthrough.pdf"
 },
 {
  "folder": "Seizure",
  "label": "03 Gordon - status epilepticus",
  "file": "Seizure/03 Gordon - status epilepticus.pdf"
 },
 {
  "folder": "Stroke",
  "label": "01 Walter - TNK + EVT",
  "file": "Stroke/01 Walter - TNK + EVT.pdf"
 },
 {
  "folder": "Stroke",
  "label": "02 Linda - posterior circulation, no MRI",
  "file": "Stroke/02 Linda - posterior circulation, no MRI.pdf"
 },
 {
  "folder": "Stroke",
  "label": "03 Nora - ESUS with PFO",
  "file": "Stroke/03 Nora - ESUS with PFO.pdf"
 },
 {
  "folder": "Which tool (mixed admissions)",
  "label": "01 Edith - heart failure, AKI, low sodium",
  "file": "Which tool (mixed admissions)/01 Edith - heart failure, AKI, low sodium.pdf"
 },
 {
  "folder": "Which tool (mixed admissions)",
  "label": "02 Raj - cellulitis, penicillin allergy, high sugar",
  "file": "Which tool (mixed admissions)/02 Raj - cellulitis, penicillin allergy, high sugar.pdf"
 },
 {
  "folder": "Which tool (mixed admissions)",
  "label": "03 Marjorie - hip fracture, 14 meds, confused",
  "file": "Which tool (mixed admissions)/03 Marjorie - hip fracture, 14 meds, confused.pdf"
 },
 {
  "folder": "Which tool (mixed admissions)",
  "label": "04 Leonard - cirrhosis, ascites, rising creatinine",
  "file": "Which tool (mixed admissions)/04 Leonard - cirrhosis, ascites, rising creatinine.pdf"
 },
 {
  "folder": "Which tool (mixed admissions)",
  "label": "05 Kevin - NSTEMI, low K and Mg",
  "file": "Which tool (mixed admissions)/05 Kevin - NSTEMI, low K and Mg.pdf"
 },
 {
  "folder": "Which tool (mixed admissions)",
  "label": "06 Priya - DKA",
  "file": "Which tool (mixed admissions)/06 Priya - DKA.pdf"
 },
 {
  "folder": "Which tool (mixed admissions)",
  "label": "07 Arthur - Parkinson, aspiration pneumonia",
  "file": "Which tool (mixed admissions)/07 Arthur - Parkinson, aspiration pneumonia.pdf"
 },
 {
  "folder": "Which tool (mixed admissions)",
  "label": "08 Doreen - myeloma on teclistamab, fever",
  "file": "Which tool (mixed admissions)/08 Doreen - myeloma on teclistamab, fever.pdf"
 }
];
