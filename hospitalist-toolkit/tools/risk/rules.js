/* Keyword/score rules for the chart screen. w = weight (3 strong, 2 moderate, 1 minor).
   Each rule counts ONCE toward the score no matter how many notes mention it.
   fn rules extract numeric scores (Braden, BMI, Morse) from note text; only the MOST RECENT value counts.
   fn returns null = no score in this note, false = a score was found but it is not in the risk range.
   skip = look-alike phrases to ignore when they overlap the match; with skipNear, when they appear within ~40 characters. */

// A number that is part of a printed scale/legend ("Braden 15-18 at risk", "Morse >=45 high") is not a patient score
const notLegend = (t, m) => !/^\s*(-|–|to)\s*\d/.test(t.slice(m.index + m[0].length, m.index + m[0].length + 6));

const DOMAINS = [
{
  key: "skin", title: "Pressure injury",
  rules: [
    { l: "Pressure injury / ulcer documented", w: 3, re: /pressure\s+(injur(y|ies)|ulcers?|sores?)|decubitus|bed\s*sores?/i },
    // "Stage 3" only counts next to a wound word, so "CKD stage 3" or "stage IV cancer" do not
    { l: "Staged wound", w: 3, re: /(pressure|ulcer|injur|wound|sacr|coccyx|heel|ischi|trochant|buttock|decubit)[^.\n]{0,40}stage\s*([1-4]|i{1,3}|iv)\b|stage\s*([1-4]|i{1,3}|iv)\b[^.\n]{0,40}(pressure|ulcer|injur|wound|sacr|coccyx|heel|ischi|trochant|buttock|decubit)|unstageable|deep tissue (pressure )?injur/i },
    { l: "Skin breakdown / non-blanchable erythema", w: 2, re: /skin breakdown|non-?blanch|open (area|wound)|sacral (wound|breakdown)|heel (wound|ulcer|blister)/i },
    { l: "Immobility / bedbound", w: 2, re: /bed-?bound|immobile|immobility|limited mobility|chair-?bound|unable to (turn|reposition)|paraly[sz]|paraplegi|quadriplegi|hemipleg/i },
    { l: "Incontinence / moisture", w: 1, re: /incontinen|moisture|diaphore|soiled|brief change/i },
    { l: "Wound care / turning orders", w: 1, re: /wound (care|consult|nurse|vac)|wocn|turn(ing)? (q|every)|offloading|pressure (relieving|redistribut)|air mattress|low air loss|barrier cream/i },
    { l: "Edema", w: 1, re: /\bedema\b|anasarca/i },
    { l: "Poor nutrition / low albumin", w: 1, re: /malnutrition|poor intake|low albumin|hypoalbumin|cachex/i },
    { l: "Diabetes / vascular disease", w: 1, re: /diabet|peripheral (arterial|vascular) disease|vascular insufficiency/i },
    { fn: (t) => { const m = /braden[^0-9<>≤≥=]{0,30}(\d{1,2})\b/i.exec(t); if (!m || !notLegend(t, m)) return null; const v = +m[1]; if (v < 6 || v > 23) return null;
        return v <= 12 ? { l: "Braden score " + v + " (high/very high risk)", w: 3, at: m.index } : v <= 18 ? { l: "Braden score " + v + " (at risk)", w: 2, at: m.index } : false; } }
  ],
  gaps: ["Braden score not found", "No skin assessment found"],
  gapRe: [/braden/i, /skin (assessment|integrity|intact|check)|skin:/i]
},
{
  key: "nutrition", title: "Nutrition",
  rules: [
    { l: "Malnutrition / cachexia documented", w: 3, re: /malnutrition|malnourish|cachexi|undernourish|protein[- ]calorie/i },
    { l: "Unintentional weight loss", w: 3, re: /weight loss|lost \d+\s*(lb|lbs|pounds|kg)|losing weight|unintentional weight|unintended weight/i },
    { l: "Poor appetite / intake", w: 2, re: /(poor|decreased|reduced|loss of|low) (appetite|oral intake|po intake|intake)|anorexia|not eating|eating (poorly|little)|refus(es|ing) (meals|food)/i },
    { l: "NPO / tube or parenteral feeding", w: 2, re: /\bnpo\b|nil per os|tube feed|enteral (nutrition|feed)|\bpeg\b|\btpn\b|parenteral nutrition|ng tube|nasogastric/i },
    { l: "Low albumin / prealbumin", w: 2, re: /(albumin|prealbumin)[^.\n]{0,25}\b(low|decreased|[0-2]\.\d|3\.[0-4])\b|hypoalbumin/i },
    // "Ensure"/"Boost" only as products (not "ensure adequate analgesia")
    { l: "Dietitian / nutrition consult or screening tool", w: 1, re: /dietitian|dietician|nutrition (consult|assessment|screen|risk)|\bmna\b|\bmust\b score|\bnrs[- ]?2002\b|(oral )?nutrition(al)? supplement|\bONS\b|\b(ensure|boost)\b\s*(plus|compact|high protein|original|\d|bid|tid|qid|daily|once|twice|with meals|supplement)/i },
    { l: "Dehydration", w: 1, re: /dehydrat|poor skin turgor|dry mucous/i },
    { l: "Needs feeding assistance / dentition problems", w: 1, re: /feeding assist|needs help eating|set-?up for meals|poor dentition|dentures|edentulous|dental (pain|problems)|difficulty chewing/i },
    { l: "Nausea / vomiting / diarrhea", w: 1, re: /nausea|vomiting|diarrhea|early satiety/i },
    { fn: (t) => { const m = /\bbmi\b[^0-9<>≤≥=]{0,15}(\d{1,2}(\.\d)?)/i.exec(t); if (!m || !notLegend(t, m)) return null; const v = +m[1]; if (v < 10) return null;
        return v < 18.5 ? { l: "BMI " + v + " (underweight)", w: 3, at: m.index } : v < 22 ? { l: "BMI " + v + " (low for older adults)", w: 1, at: m.index } : false; } }
  ],
  gaps: ["No weight/BMI found", "No dietitian/nutrition screen found"],
  // MUST must be in capitals here, so the everyday word "must" does not count as a nutrition screen
  gapRe: [/\bbmi\b|weight[: ]+\d/i, /[Dd]ietiti?an|[Dd]ietician|[Nn]utrition (consult|assessment|screen)|\b(MNA|mna)\b|\bMUST\b/]
},
{
  key: "sleep", title: "Sleep",
  rules: [
    { l: "Insomnia / difficulty sleeping", w: 3, re: /insomnia|(difficulty|trouble|unable to|can'?t|cannot|poor) (sleep|falling asleep|staying asleep)|sleep disturbance|poor sleep|not sleeping|sleeping poorly|sleep[- ]onset|early morning awakening/i },
    { l: "Sleep apnea / CPAP", w: 2, re: /sleep apnea|\bosa\b|\bcpap\b|\bbipap\b|snor(es|ing)|apneic/i },
    { l: "Night-time awakenings / nocturia", w: 2, re: /nocturia|awake (at|during the) night|night awakenings?|wakes? (up )?(at night|frequently|multiple times)|up (all|most of the) night|night[- ]?time (agitation|wandering|restless)|sundown/i },
    { l: "Daytime sleepiness / fatigue", w: 1, re: /daytime (sleepiness|somnolence|drowsiness)|excessive sleepiness|somnolen|lethargi|fatigue|\btired\b|napping/i },
    { l: "Restless legs / pain at night", w: 1, re: /restless leg|\brls\b|periodic limb|pain (at|during the) night|night pain/i },
    { l: "Sleep medication in use", w: 1, re: /zolpidem|ambien|eszopiclone|lunesta|zaleplon|temazepam|lorazepam|trazodone|melatonin|diphenhydramine|doxepin|sleep aid|hypnotic|sedative/i },
    { l: "Anxiety / depression / delirium", w: 1, re: /anxiety|depress|delirium|nightmare|\bptsd\b/i },
    { l: "Noise / environment disturbs sleep", w: 1, re: /(noise|light|vitals|labs|interruptions?)[^.\n]{0,25}(sleep|wake|woke|disturb)/i }
  ],
  gaps: ["No sleep history documented"],
  gapRe: [/sleep/i]
},
{
  key: "dysphagia", title: "Dysphagia / aspiration",
  rules: [
    { l: "Dysphagia / swallowing difficulty documented", w: 3, re: /dysphagia|difficulty swallowing|trouble swallowing|swallowing (difficult|problem|impair)|odynophagia|unable to swallow|failed (swallow|bedside swallow)|swallow screen (failed|fail)/i },
    { l: "Aspiration / choking / coughing with meals", w: 3, re: /aspirat|chok(e|es|ed|ing)\b|cough(ing|s)? (with|during|after) (meals|eating|drinking|swallow)|wet (voice|vocal)|pocketing|pooling of secretions/i,
      skipNear: true, // these words anywhere nearby rule it out (a procedure, not aspiration of food)
      skip: /joint|knee|hip|shoulder|elbow|ankle|bursa|effusion|bone marrow|marrow|cyst|abscess|thoracentes|paracentes|arthrocentes|needle|\bfna\b|lumbar|aspirate[ds]?\s*(\d|ml)|ml (of fluid )?aspirated|fluid (was )?(sent|aspirated)|aspiration biopsy/i },
    { l: "Speech-language / swallow evaluation", w: 2, re: /\bslp\b|speech[- ]language|swallow(ing)? (eval|study|assessment)|modified barium|\bmbs\b|\bfees\b|videofluoro/i },
    { l: "Modified diet / thickened liquids", w: 2, re: /thicken|puree|mechanical soft|dysphagia diet|nectar|honey[- ]thick|minced|soft diet|\biddsi\b/i },
    { l: "Neurologic condition", w: 2, re: /stroke|\bcva\b|parkinson|dementia|alzheimer|\bals\b|multiple sclerosis|myasthenia|cerebral palsy|traumatic brain|\btbi\b/i },
    // Plain "pneumonia" no longer counts - only aspiration/recurrent pneumonia or airway issues
    { l: "Aspiration / recurrent pneumonia / airway", w: 2, re: /aspiration pneumoni|recurrent pneumoni|pneumonias\b|tracheostomy|\btrach\b|prolonged intubation|recent(ly)? (extubat|intubat)|post.?extubation/i },
    { l: "Head/neck / esophageal disease", w: 1, re: /head and neck cancer|esophageal (stricture|cancer|dysmotility)|achalasia|gerd|reflux|xerostomia|dry mouth|drooling|hoarse/i },
    { l: "Reduced alertness / poor dentition", w: 1, re: /lethargic|drowsy|decreased level of consciousness|altered mental status|poor dentition|edentulous/i },
    { l: "NPO", w: 1, re: /\bnpo\b/i }
  ],
  gaps: ["No swallow screen/evaluation found"],
  gapRe: [/swallow|\bslp\b|dysphagia/i]
},
{
  key: "falls", title: "Falls risk",
  rules: [
    // "High fall risk", "fall precautions", "BP falls", "fell asleep" are not falls
    { l: "Fall(s) documented", w: 3, re: /\bfalls?\b|\bfell\b|fallen|found on the (floor|ground)|history of falls|fall (at home|in)/i,
      skip: /morse fall|fall scale|falls?[- ](precaution|risk|prevention|bundle|score|mat|alarm|assessment|screen|sock|band)|(high|low|moderate)[- ](fall|falls)|risk (of|for) falls?|at risk|morse|hendrich|falls? (under|within|in(to)? the)|(bp|pressure|sat|sats|saturation|hgb|hemoglobin|sodium|level|count|platelets?)s? (falls?|fell)|(falls?|fell|fallen) (to|below|from \d)|fall(s|ing)? asleep|fell asleep/i },
    { l: "Fracture / hip fracture", w: 3, re: /fracture|hip (fx|fracture|replacement)|compression fracture|\bfx\b/i },
    { l: "Gait / balance impairment", w: 3, re: /unsteady|gait (disturbance|instability|abnormal|impair|problem)|ataxi|balance (problem|issue|impair|deficit|poor)|shuffl|antalgic|(difficulty|trouble) walking|impaired mobility|unable to (walk|ambulate)|foot drop|festinat/i },
    { l: "Mobility aid / assistance needed", w: 2, re: /walker|rollator|\bcane\b|wheelchair|crutch|\bassist(ance)? (of|with) (1|2|one|two)|1[- ]person assist|2[- ]person assist|needs assist(ance)? (to|with) (walk|ambulat|transfer)|\bpt (eval|consult)|physical therapy/i },
    // Plain "hypotension" (e.g. septic shock) no longer counts as orthostatic
    { l: "Orthostatic hypotension / syncope / dizziness", w: 3, re: /orthostat|postural (hypotension|dizziness|drop)|syncop|near[- ]syncope|presyncope|dizz(y|iness)|light-?headed|vertigo|vasovagal/i },
    { l: "Cognitive impairment / delirium / confusion", w: 3, re: /dementia|alzheimer|cognitive impairment|delirium|confus(ed|ion)|disorient|memory (loss|impair)|impulsiv|poor safety awareness|wandering|\bmci\b/i },
    { l: "Sedating / CNS-active medications", w: 3, re: /benzodiazepine|lorazepam|diazepam|alprazolam|clonazepam|temazepam|zolpidem|eszopiclone|opioid|oxycodone|hydrocodone|morphine|hydromorphone|fentanyl|tramadol|gabapentin|pregabalin|antipsychotic|haloperidol|quetiapine|olanzapine|risperidone|amitriptyline|nortriptyline|trazodone|mirtazapine|diphenhydramine|hydroxyzine|promethazine|sedative|muscle relaxant|cyclobenzaprine|methocarbamol|baclofen|tizanidine|anticholinergic|oxybutynin|antiepileptic|phenytoin|carbamazepine/i },
    { l: "BP/diuretic/hypoglycemic medications", w: 1, re: /furosemide|lasix|hydrochlorothiazide|chlorthalidone|torsemide|bumetanide|doxazosin|prazosin|terazosin|clonidine|insulin|glipizide|glyburide|glimepiride|hypoglycemi/i },
    { l: "Neurologic disease", w: 2, re: /parkinson|stroke|\bcva\b|neuropathy|multiple sclerosis|myelopathy|hemipar|hemipleg|seizure|epilep/i },
    { l: "Vision / hearing impairment", w: 2, re: /visual impair|vision (loss|problem|poor|impair)|cataract|macular|glaucoma|blind|retinopath|hearing (loss|impair|aid)/i },
    { l: "Urinary urgency / incontinence / nocturia", w: 2, re: /urinary urgency|urge incontinence|incontinen|nocturia|frequent urination|overactive bladder|toileting needs|bathroom (trips|at night)/i },
    { l: "Weakness / sarcopenia / frailty", w: 2, re: /weakness|deconditioning|sarcopenia|frail|failure to thrive|muscle (loss|wasting)|debilitat|fatigue/i },
    { l: "Osteoporosis / low bone density", w: 1, re: /osteoporosis|osteopenia|low bone (density|mass)|dexa/i },
    { l: "Anemia / hypotension-related labs", w: 1, re: /anemi|low hemoglobin|hyponatremia|hypokalemia|dehydrat/i },
    { l: "Alcohol use", w: 1, re: /alcohol (use|abuse|dependence)|etoh|drinks? (daily|per day)|alcoholism|withdrawal/i },
    { l: "Foot problems / footwear", w: 1, re: /foot (pain|problem|deformity|ulcer)|bunion|neuropathic foot|poor footwear|slippers|barefoot/i },
    { l: "Lives alone / home hazards", w: 1, re: /lives alone|stairs|scatter rugs|home hazard|poor lighting|no (grab bars|railings)/i },
    { l: "Fall precautions in place", w: 1, re: /fall precaution|bed alarm|chair alarm|fall risk|high fall risk|yellow (socks|band)|1:1 (sitter|observation)|restraint/i },
    { fn: (t) => { const m = /morse[^0-9<>≤≥=]{0,30}(\d{1,3})\b/i.exec(t); if (!m || !notLegend(t, m)) return null; const v = +m[1]; if (v > 125) return null;
        return v >= 45 ? { l: "Morse Fall Scale " + v + " (high risk)", w: 3, at: m.index } : v >= 25 ? { l: "Morse Fall Scale " + v + " (moderate risk)", w: 2, at: m.index } : false; } },
    { fn: (t) => { const m = /hendrich[^0-9<>≤≥=]{0,30}(\d{1,2})\b/i.exec(t); if (!m || !notLegend(t, m)) return null; const v = +m[1];
        return v >= 5 ? { l: "Hendrich II score " + v + " (high risk)", w: 3, at: m.index } : false; } }
  ],
  gaps: ["No fall-risk score (Morse/Hendrich/STEADI) found", "No gait/balance assessment found", "No orthostatic vital signs documented"],
  gapRe: [/morse|hendrich|steadi|fall risk (score|assessment)|timed up and go|\btug\b/i, /gait|balance|ambulat/i, /orthostat/i]
}
];

const NEGATION = /\b(no|not|denies|denied|denying|negative for|neg for|without|never|free of|absence of|absent|ruled out|r\/o|resolved|no evidence of|no history of|no h\/o|no signs? of|negative)\b[^.;\n]{0,45}$/i;
