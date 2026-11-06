/* Kidney transplant rule table. UNVERIFIED DRAFT written by Claude: needs transplant pharmacist / nephrologist review before clinical use.
   Edit the rules here; engine.js reads them. Works in the browser (window.TX_RULES) and in node (require). */
(function () {
  const RULES = {
    "meta": {
      "name": "Kidney transplant inpatient screen - rule table",
      "version": "0.2.0-draft",
      "status": "DRAFT - not clinically validated. Requires review and sign-off by a transplant pharmacist/nephrologist before any clinical use.",
      "units": "SI (Canada)",
      "matching": "Whole-word match of matchTerms/triggerTerms against the medication name and dose text (lower case, punctuation removed). Map to RxNorm or local Cerner codes later.",
      "severityLevels": {
        "critical": "Avoid or contraindicated - hard stop, call transplant",
        "major": "Significant effect - action and/or level check required",
        "moderate": "Monitor - flag and remind",
        "info": "Informational - usually expected (e.g. TMP-SMX at a prophylaxis dose)"
      }
    },
    "immunosuppressants": [
      {
        "id": "tacrolimus",
        "name": "Tacrolimus",
        "matchTerms": [
          "tacrolimus",
          "prograf",
          "advagraf",
          "envarsus"
        ],
        "class": "CNI",
        "levelMonitored": true,
        "levelType": "12-h trough (24-h trough for once-daily formulations), drawn before morning dose",
        "steadyStateDays": 3,
        "routineRecheckDays": [
          2,
          3
        ],
        "notes": "Formulations are NOT interchangeable mg-for-mg. IV dose is much lower than oral and is usually best avoided; sublingual is an option if NPO - discuss with transplant."
      },
      {
        "id": "cyclosporine",
        "name": "Cyclosporine",
        "matchTerms": [
          "cyclosporine",
          "ciclosporin",
          "neoral",
          "sandimmune"
        ],
        "class": "CNI",
        "levelMonitored": true,
        "levelType": "Trough (C0) or 2-h post-dose (C2) per program protocol",
        "steadyStateDays": 3,
        "routineRecheckDays": [
          2,
          3
        ],
        "notes": "Neoral and Sandimmune are not interchangeable."
      },
      {
        "id": "sirolimus",
        "name": "Sirolimus",
        "matchTerms": [
          "sirolimus",
          "rapamune"
        ],
        "class": "mTOR",
        "levelMonitored": true,
        "levelType": "Trough",
        "steadyStateDays": 7,
        "routineRecheckDays": [
          5,
          7
        ],
        "notes": "Long half-life; levels lag dose changes."
      },
      {
        "id": "everolimus",
        "name": "Everolimus",
        "matchTerms": [
          "everolimus",
          "zortress",
          "certican"
        ],
        "class": "mTOR",
        "levelMonitored": true,
        "levelType": "Trough",
        "steadyStateDays": 5,
        "routineRecheckDays": [
          4,
          5
        ],
        "notes": ""
      },
      {
        "id": "mycophenolate",
        "name": "Mycophenolate (MMF or mycophenolate sodium)",
        "matchTerms": [
          "mycophenolate",
          "cellcept",
          "myfortic"
        ],
        "class": "antimetabolite",
        "levelMonitored": false,
        "subtypes": {
          "mmf": [
            "mycophenolate mofetil",
            "cellcept"
          ],
          "mps": [
            "mycophenolate sodium",
            "myfortic"
          ]
        },
        "notes": "Levels not routinely monitored."
      },
      {
        "id": "azathioprine",
        "name": "Azathioprine",
        "matchTerms": [
          "azathioprine",
          "imuran"
        ],
        "class": "antimetabolite",
        "levelMonitored": false,
        "notes": ""
      },
      {
        "id": "prednisone",
        "name": "Maintenance corticosteroid",
        "matchTerms": [
          "prednisone",
          "prednisolone",
          "methylprednisolone"
        ],
        "class": "steroid",
        "levelMonitored": false,
        "notes": "Chronic steroid - consider stress dosing in acute illness or surgery."
      },
      {
        "id": "belatacept",
        "name": "Belatacept",
        "matchTerms": [
          "belatacept",
          "nulojix"
        ],
        "class": "costimulation blocker",
        "levelMonitored": false,
        "notes": "Monthly infusion - often absent from inpatient orders. Ask the patient."
      }
    ],
    "rules": [
      {
        "id": "R01",
        "title": "Strong CYP3A4/P-gp inhibitor - azole antifungals",
        "triggerTerms": [
          "voriconazole",
          "posaconazole",
          "itraconazole",
          "ketoconazole"
        ],
        "affects": [
          "tacrolimus",
          "cyclosporine",
          "sirolimus",
          "everolimus"
        ],
        "effect": "increases_level",
        "severity": "critical",
        "severityOverrides": {
          "sirolimus": "critical",
          "everolimus": "critical"
        },
        "mechanism": "CYP3A4/P-gp inhibition; can raise CNI/mTOR levels several-fold.",
        "action": "Call transplant before starting. Empiric CNI dose reduction is usually needed. Voriconazole and posaconazole with sirolimus are contraindicated per product labelling.",
        "levelCheck": {
          "required": true,
          "daysAfterStart": [
            2,
            3
          ],
          "alsoOnStop": true
        },
        "labsToWatch": [
          "drugLevel",
          "creatinine",
          "potassium",
          "magnesium"
        ]
      },
      {
        "id": "R02",
        "title": "Moderate CYP3A4 inhibitor - fluconazole / isavuconazole",
        "triggerTerms": [
          "fluconazole",
          "isavuconazole",
          "isavuconazonium"
        ],
        "affects": [
          "tacrolimus",
          "cyclosporine",
          "sirolimus",
          "everolimus"
        ],
        "effect": "increases_level",
        "severity": "major",
        "mechanism": "CYP3A4 inhibition; fluconazole effect is dose-dependent (more at higher doses).",
        "action": "Notify transplant. Check a trough after starting and after stopping.",
        "levelCheck": {
          "required": true,
          "daysAfterStart": [
            2,
            3
          ],
          "alsoOnStop": true
        },
        "labsToWatch": [
          "drugLevel",
          "creatinine"
        ]
      },
      {
        "id": "R03",
        "title": "Macrolide - clarithromycin / erythromycin",
        "triggerTerms": [
          "clarithromycin",
          "erythromycin"
        ],
        "affects": [
          "tacrolimus",
          "cyclosporine",
          "sirolimus",
          "everolimus"
        ],
        "effect": "increases_level",
        "severity": "critical",
        "mechanism": "Strong CYP3A4 inhibition; also additive QT prolongation with tacrolimus.",
        "action": "Avoid. Prefer azithromycin (minimal CYP3A4 effect) or a non-macrolide alternative. If unavoidable, discuss with transplant and check levels.",
        "levelCheck": {
          "required": true,
          "daysAfterStart": [
            2,
            3
          ],
          "alsoOnStop": true
        },
        "labsToWatch": [
          "drugLevel",
          "creatinine",
          "qtc"
        ]
      },
      {
        "id": "R04",
        "title": "Ritonavir/cobicistat boosted regimens (incl. Paxlovid)",
        "triggerTerms": [
          "ritonavir",
          "nirmatrelvir",
          "paxlovid",
          "cobicistat"
        ],
        "affects": [
          "tacrolimus",
          "cyclosporine",
          "sirolimus",
          "everolimus"
        ],
        "effect": "increases_level",
        "severity": "critical",
        "mechanism": "Very strong CYP3A4 inhibition; effect persists for days after the last dose.",
        "action": "Hard stop. Do not co-prescribe without transplant input. Consider an alternative COVID-19 therapy. If used, the program will usually hold or reduce the CNI with close level monitoring.",
        "levelCheck": {
          "required": true,
          "daysAfterStart": [
            1,
            2
          ],
          "alsoOnStop": true,
          "note": "Levels can stay high for several days after stopping."
        },
        "labsToWatch": [
          "drugLevel",
          "creatinine",
          "potassium"
        ]
      },
      {
        "id": "R05",
        "title": "Non-dihydropyridine CCB / antiarrhythmics",
        "triggerTerms": [
          "diltiazem",
          "verapamil",
          "amiodarone",
          "dronedarone"
        ],
        "affects": [
          "tacrolimus",
          "cyclosporine",
          "sirolimus",
          "everolimus"
        ],
        "effect": "increases_level",
        "severity": "major",
        "mechanism": "CYP3A4/P-gp inhibition. Amiodarone has a very long half-life, so the effect develops and resolves slowly.",
        "action": "Notify transplant and check levels. For rate control, consider a beta-blocker if appropriate.",
        "levelCheck": {
          "required": true,
          "daysAfterStart": [
            3,
            5
          ],
          "alsoOnStop": true
        },
        "labsToWatch": [
          "drugLevel",
          "creatinine",
          "qtc"
        ]
      },
      {
        "id": "R06",
        "title": "Other inhibitors - metronidazole, letermovir, chloramphenicol",
        "triggerTerms": [
          "metronidazole",
          "letermovir",
          "chloramphenicol"
        ],
        "affects": [
          "tacrolimus",
          "cyclosporine"
        ],
        "effect": "increases_level",
        "severity": "moderate",
        "mechanism": "CYP3A4 inhibition (variable magnitude).",
        "action": "Check a trough after starting.",
        "levelCheck": {
          "required": true,
          "daysAfterStart": [
            3,
            4
          ],
          "alsoOnStop": false
        },
        "labsToWatch": [
          "drugLevel"
        ]
      },
      {
        "id": "R07",
        "title": "Strong inducers - rifamycins and enzyme-inducing antiepileptics",
        "triggerTerms": [
          "rifampin",
          "rifampicin",
          "rifabutin",
          "rifapentine",
          "phenytoin",
          "fosphenytoin",
          "carbamazepine",
          "phenobarbital",
          "primidone",
          "st john",
          "hypericum"
        ],
        "affects": [
          "tacrolimus",
          "cyclosporine",
          "sirolimus",
          "everolimus",
          "mycophenolate",
          "prednisone"
        ],
        "effect": "decreases_level",
        "severity": "critical",
        "mechanism": "CYP3A4/P-gp induction; can drop CNI levels dramatically, with rejection risk. Rifampin also lowers mycophenolic acid exposure and increases steroid clearance.",
        "action": "Call transplant. Large CNI dose increases are often needed. Consider levetiracetam instead of an enzyme-inducing antiepileptic. Watch for toxicity when the inducer is stopped (induction wanes over 1-2 weeks).",
        "levelCheck": {
          "required": true,
          "daysAfterStart": [
            3,
            5
          ],
          "alsoOnStop": true,
          "note": "Recheck repeatedly over 1-2 weeks after stopping."
        },
        "labsToWatch": [
          "drugLevel",
          "creatinine"
        ]
      },
      {
        "id": "R08",
        "title": "Moderate inducers - nafcillin, oxcarbazepine, caspofungin",
        "triggerTerms": [
          "nafcillin",
          "oxcarbazepine",
          "caspofungin"
        ],
        "affects": [
          "tacrolimus",
          "cyclosporine"
        ],
        "effect": "decreases_level",
        "severity": "moderate",
        "mechanism": "Nafcillin/oxcarbazepine: CYP3A4 induction. Caspofungin: modest decrease in tacrolimus levels (mechanism unclear).",
        "action": "Check a trough after starting.",
        "levelCheck": {
          "required": true,
          "daysAfterStart": [
            3,
            5
          ],
          "alsoOnStop": true
        },
        "labsToWatch": [
          "drugLevel"
        ]
      },
      {
        "id": "R09",
        "title": "NSAIDs",
        "triggerTerms": [
          "ibuprofen",
          "naproxen",
          "diclofenac",
          "ketorolac",
          "indomethacin",
          "celecoxib",
          "meloxicam",
          "ketoprofen"
        ],
        "affects": [
          "tacrolimus",
          "cyclosporine"
        ],
        "effect": "nephrotoxicity",
        "severity": "critical",
        "mechanism": "Afferent vasoconstriction plus CNI vasoconstriction leads to acute graft injury.",
        "action": "Avoid. Use acetaminophen; opioids if needed with renal dosing.",
        "levelCheck": {
          "required": false
        },
        "labsToWatch": [
          "creatinine",
          "potassium"
        ]
      },
      {
        "id": "R10",
        "title": "Nephrotoxic antimicrobials",
        "triggerTerms": [
          "gentamicin",
          "tobramycin",
          "amikacin",
          "vancomycin",
          "amphotericin",
          "foscarnet",
          "colistin",
          "polymyxin"
        ],
        "affects": [
          "tacrolimus",
          "cyclosporine"
        ],
        "effect": "nephrotoxicity",
        "severity": "major",
        "mechanism": "Additive nephrotoxicity with CNIs.",
        "action": "Use alternatives if possible. If needed, dose by drug levels, check creatinine daily, and ensure a CNI level is current.",
        "levelCheck": {
          "required": true,
          "daysAfterStart": [
            2,
            3
          ],
          "alsoOnStop": false,
          "note": "Check both the antimicrobial level and the CNI level."
        },
        "labsToWatch": [
          "creatinine",
          "drugLevel"
        ]
      },
      {
        "id": "R11",
        "title": "Trimethoprim-sulfamethoxazole (treatment dose)",
        "triggerTerms": [
          "sulfamethoxazole",
          "trimethoprim",
          "septra",
          "bactrim",
          "co-trimoxazole"
        ],
        "affects": [
          "tacrolimus",
          "cyclosporine"
        ],
        "effect": "hyperkalemia",
        "severity": "major",
        "mechanism": "Trimethoprim blocks ENaC (high K) and inhibits tubular creatinine secretion (creatinine rises without a true GFR drop). Additive with CNI-induced hyperkalemia.",
        "action": "Expected at prophylaxis doses. At treatment doses, monitor potassium and creatinine every 1-2 days. Interpret a small creatinine rise cautiously.",
        "levelCheck": {
          "required": false
        },
        "labsToWatch": [
          "potassium",
          "creatinine"
        ],
        "doseContext": "Suppress or downgrade to informational when the order matches PJP prophylaxis (e.g., SS daily or DS three times weekly)."
      },
      {
        "id": "R12",
        "title": "Potassium-raising drugs",
        "triggerTerms": [
          "spironolactone",
          "eplerenone",
          "amiloride",
          "triamterene",
          "lisinopril",
          "ramipril",
          "perindopril",
          "enalapril",
          "candesartan",
          "losartan",
          "irbesartan",
          "telmisartan",
          "valsartan",
          "potassium chloride"
        ],
        "affects": [
          "tacrolimus",
          "cyclosporine"
        ],
        "effect": "hyperkalemia",
        "severity": "moderate",
        "mechanism": "Additive with CNI-induced type 4 RTA physiology.",
        "action": "Monitor potassium. Consider holding during AKI or volume depletion.",
        "levelCheck": {
          "required": false
        },
        "labsToWatch": [
          "potassium",
          "creatinine"
        ]
      },
      {
        "id": "R13",
        "title": "QT-prolonging drugs",
        "triggerTerms": [
          "ciprofloxacin",
          "levofloxacin",
          "moxifloxacin",
          "azithromycin",
          "ondansetron",
          "haloperidol",
          "methadone",
          "quetiapine",
          "citalopram",
          "escitalopram",
          "domperidone"
        ],
        "affects": [
          "tacrolimus"
        ],
        "effect": "qt_prolongation",
        "severity": "moderate",
        "mechanism": "Additive QT prolongation.",
        "action": "Baseline ECG and correct potassium/magnesium. Avoid stacking multiple QT drugs.",
        "levelCheck": {
          "required": false
        },
        "labsToWatch": [
          "qtc",
          "potassium",
          "magnesium"
        ]
      },
      {
        "id": "R14",
        "title": "Azathioprine + xanthine oxidase inhibitor",
        "triggerTerms": [
          "allopurinol",
          "febuxostat"
        ],
        "affects": [
          "azathioprine"
        ],
        "effect": "marrow_toxicity",
        "severity": "critical",
        "mechanism": "Blocks azathioprine metabolism, causing life-threatening myelosuppression.",
        "action": "Avoid. If unavoidable, the transplant team must substantially reduce the azathioprine dose. Monitor CBC closely.",
        "levelCheck": {
          "required": false
        },
        "labsToWatch": [
          "wbc",
          "neutrophils",
          "platelets",
          "hemoglobin"
        ]
      },
      {
        "id": "R15",
        "title": "Mycophenolate + valganciclovir/ganciclovir",
        "triggerTerms": [
          "valganciclovir",
          "ganciclovir"
        ],
        "affects": [
          "mycophenolate",
          "azathioprine"
        ],
        "effect": "marrow_toxicity",
        "severity": "major",
        "mechanism": "Additive myelosuppression.",
        "action": "Monitor CBC at least twice weekly. Renally dose valganciclovir.",
        "levelCheck": {
          "required": false
        },
        "labsToWatch": [
          "wbc",
          "neutrophils",
          "platelets"
        ]
      },
      {
        "id": "R16",
        "title": "Mycophenolate absorption reducers",
        "triggerTerms": [
          "cholestyramine",
          "colestipol",
          "sevelamer",
          "aluminum hydroxide",
          "magnesium hydroxide",
          "calcium carbonate",
          "ferrous"
        ],
        "affects": [
          "mycophenolate"
        ],
        "effect": "decreases_level",
        "severity": "moderate",
        "mechanism": "Binding/chelation reduces mycophenolic acid absorption. Cholestyramine also interrupts enterohepatic recirculation.",
        "action": "Separate administration by at least 2 hours. Avoid cholestyramine.",
        "levelCheck": {
          "required": false
        },
        "labsToWatch": []
      },
      {
        "id": "R17",
        "title": "PPI with mycophenolate mofetil",
        "triggerTerms": [
          "pantoprazole",
          "omeprazole",
          "esomeprazole",
          "lansoprazole",
          "rabeprazole",
          "dexlansoprazole"
        ],
        "affects": [
          "mycophenolate"
        ],
        "appliesToSubtype": "mmf",
        "effect": "decreases_level",
        "severity": "moderate",
        "mechanism": "Higher gastric pH reduces MMF dissolution and exposure. Mycophenolate sodium is less affected.",
        "action": "Informational. Use the PPI only if indicated.",
        "levelCheck": {
          "required": false
        },
        "labsToWatch": []
      },
      {
        "id": "R18",
        "title": "Statins with cyclosporine",
        "triggerTerms": [
          "simvastatin",
          "lovastatin",
          "atorvastatin",
          "rosuvastatin",
          "pravastatin",
          "fluvastatin"
        ],
        "affects": [
          "cyclosporine"
        ],
        "effect": "myopathy",
        "severity": "major",
        "severityByTrigger": {
          "simvastatin": "critical",
          "lovastatin": "critical"
        },
        "mechanism": "OATP1B1/CYP3A4 inhibition by cyclosporine markedly raises statin exposure.",
        "action": "Simvastatin and lovastatin are contraindicated. Use the lowest statin dose and check product-specific limits (e.g., low-dose rosuvastatin or pravastatin). Watch for myalgias and CK elevation.",
        "levelCheck": {
          "required": false
        },
        "labsToWatch": [
          "ck"
        ]
      },
      {
        "id": "R19",
        "title": "Colchicine with CNI",
        "triggerTerms": [
          "colchicine"
        ],
        "affects": [
          "cyclosporine",
          "tacrolimus"
        ],
        "effect": "colchicine_toxicity",
        "severity": "major",
        "severityOverrides": {
          "cyclosporine": "critical"
        },
        "mechanism": "P-gp inhibition raises colchicine levels, causing neuromyopathy and marrow toxicity (worse with reduced GFR).",
        "action": "Avoid or use greatly reduced doses. For gout flares, consider a short steroid course instead.",
        "levelCheck": {
          "required": false
        },
        "labsToWatch": [
          "ck",
          "wbc",
          "creatinine"
        ]
      },
      {
        "id": "R20",
        "title": "DOACs with cyclosporine",
        "triggerTerms": [
          "dabigatran",
          "rivaroxaban",
          "apixaban",
          "edoxaban"
        ],
        "affects": [
          "cyclosporine",
          "tacrolimus"
        ],
        "effect": "increases_partner_level",
        "severity": "major",
        "severityByTrigger": {
          "dabigatran": "critical"
        },
        "mechanism": "P-gp inhibition raises DOAC levels, increasing bleeding risk.",
        "action": "Dabigatran with cyclosporine is contraindicated. Review other DOACs with pharmacy, with attention to renal function.",
        "levelCheck": {
          "required": false
        },
        "labsToWatch": [
          "hemoglobin",
          "creatinine"
        ]
      },
      {
        "id": "R21",
        "title": "mTOR inhibitor + ACE inhibitor",
        "triggerTerms": [
          "lisinopril",
          "ramipril",
          "perindopril",
          "enalapril",
          "trandolapril",
          "quinapril"
        ],
        "affects": [
          "sirolimus",
          "everolimus"
        ],
        "effect": "angioedema",
        "severity": "moderate",
        "mechanism": "Increased angioedema risk.",
        "action": "Counsel and monitor.",
        "levelCheck": {
          "required": false
        },
        "labsToWatch": []
      },
      {
        "id": "R22",
        "title": "Live vaccines",
        "triggerTerms": [
          "mmr",
          "measles",
          "varicella vaccine",
          "varivax",
          "varicella virus vaccine live",
          "zostavax",
          "yellow fever",
          "bcg",
          "oral typhoid",
          "vivotif",
          "live attenuated"
        ],
        "affects": [
          "tacrolimus",
          "cyclosporine",
          "sirolimus",
          "everolimus",
          "mycophenolate",
          "azathioprine",
          "prednisone",
          "belatacept"
        ],
        "effect": "contraindicated",
        "severity": "critical",
        "mechanism": "Risk of vaccine-strain infection in immunosuppressed hosts.",
        "action": "Contraindicated. Use non-live alternatives (e.g., recombinant zoster vaccine).",
        "levelCheck": {
          "required": false
        },
        "labsToWatch": []
      }
    ],
    "contextChecks": [
      {
        "id": "C01",
        "title": "Diarrhea",
        "detect": {
          "conditionTerms": [
            "diarrhea",
            "diarrhoea",
            "c. difficile",
            "clostridioides",
            "gastroenteritis",
            "colitis"
          ]
        },
        "appliesTo": [
          "tacrolimus"
        ],
        "message": "Diarrhea can RAISE tacrolimus levels (reduced intestinal P-gp/CYP3A4). Check a trough and creatinine. Mycophenolate may be the cause of the diarrhea - discuss with transplant."
      },
      {
        "id": "C02",
        "title": "NPO or unable to take oral meds",
        "detect": {
          "orderTerms": [
            "npo",
            "nothing by mouth"
          ]
        },
        "appliesTo": [
          "tacrolimus",
          "cyclosporine",
          "sirolimus",
          "everolimus",
          "mycophenolate"
        ],
        "message": "Do not simply hold immunosuppression. Contact transplant for a route plan: tacrolimus sublingual is an option; IV tacrolimus uses a much lower dose and is usually avoided; IV mycophenolate is available."
      },
      {
        "id": "C03",
        "title": "Chronic steroid - acute illness or surgery",
        "detect": {
          "always": true
        },
        "appliesTo": [
          "prednisone"
        ],
        "message": "On chronic prednisone. Consider stress-dose steroids if septic, hypotensive, or peri-operative. Watch for adrenal insufficiency if doses are missed."
      },
      {
        "id": "C04",
        "title": "Infection prophylaxis present?",
        "detect": {
          "checkMedsPresent": [
            "sulfamethoxazole",
            "atovaquone",
            "dapsone",
            "pentamidine",
            "valganciclovir"
          ]
        },
        "appliesTo": [
          "tacrolimus",
          "cyclosporine",
          "sirolimus",
          "everolimus",
          "mycophenolate",
          "azathioprine",
          "belatacept"
        ],
        "message": "Confirm whether PJP and CMV prophylaxis are expected (depends on time since transplant and program protocol). Fever = low threshold for workup, including CMV and BK if indicated."
      },
      {
        "id": "C05",
        "title": "IV contrast planned",
        "detect": {
          "orderTerms": [
            "contrast",
            "ct angiogram",
            "cta",
            "with contrast"
          ]
        },
        "appliesTo": [
          "tacrolimus",
          "cyclosporine"
        ],
        "message": "Transplant kidney with CNI - assess contrast risk, ensure euvolemia, and hold nephrotoxins. Check creatinine at 24-48 h."
      },
      {
        "id": "C06",
        "title": "No recent drug level",
        "detect": {
          "levelOlderThanDays": 7
        },
        "appliesTo": [
          "tacrolimus",
          "cyclosporine",
          "sirolimus",
          "everolimus"
        ],
        "message": "No drug level in the last 7 days. Consider an admission trough, especially with AKI, new medications, or GI illness."
      },
      {
        "id": "C07",
        "title": "Do not hold without transplant input",
        "detect": {
          "always": true
        },
        "appliesTo": [
          "tacrolimus",
          "cyclosporine",
          "sirolimus",
          "everolimus",
          "mycophenolate",
          "azathioprine",
          "prednisone"
        ],
        "message": "Do not stop or reduce immunosuppression without discussing with the transplant team (rejection risk). In severe sepsis, the antimetabolite is often held first - transplant decision."
      }
    ],
    "labWatch": {
      "notes": "Default thresholds are configurable placeholders - confirm with local program. Baseline creatinine = lowest value in the prior 90 days outside this admission, if available.",
      "items": [
        {
          "id": "creatinine",
          "label": "Creatinine vs baseline",
          "rule": "rise >= 25% from baseline OR >= 26 umol/L within 48 h",
          "severity": "major",
          "message": "Possible graft dysfunction: CNI toxicity, rejection, volume depletion, obstruction, or nephrotoxins. Notify transplant.",
          "kind": "creatinine",
          "pct": 25,
          "abs": 26,
          "maxAgeDays": 3,
          "unit": "umol/L"
        },
        {
          "id": "potassium",
          "label": "Potassium",
          "rule": "> 5.5 mmol/L",
          "severity": "major",
          "message": "Hyperkalemia - review CNI level, TMP-SMX, RAAS blockers, and diet.",
          "kind": "above",
          "value": 5.5,
          "maxAgeDays": 3,
          "unit": "mmol/L"
        },
        {
          "id": "magnesium",
          "label": "Magnesium",
          "rule": "< 0.65 mmol/L",
          "severity": "moderate",
          "message": "CNI-related magnesium wasting; low Mg increases seizure and QT risk.",
          "kind": "below",
          "value": 0.65,
          "maxAgeDays": 3,
          "unit": "mmol/L"
        },
        {
          "id": "glucose",
          "label": "Glucose",
          "rule": "> 11.1 mmol/L",
          "severity": "moderate",
          "message": "Steroid/CNI-related hyperglycemia (PTDM). Consider basal-bolus insulin.",
          "kind": "above",
          "value": 11.1,
          "maxAgeDays": 2,
          "unit": "mmol/L"
        },
        {
          "id": "wbc",
          "label": "WBC",
          "rule": "< 3.0 x10^9/L",
          "severity": "major",
          "message": "Leukopenia - consider mycophenolate/azathioprine/valganciclovir/TMP-SMX. Discuss dose with transplant.",
          "kind": "below",
          "value": 3,
          "maxAgeDays": 3,
          "unit": "x10^9/L"
        },
        {
          "id": "neutrophils",
          "label": "Neutrophils",
          "rule": "< 1.0 x10^9/L",
          "severity": "major",
          "message": "Neutropenia - infection risk. Discuss with transplant.",
          "kind": "below",
          "value": 1,
          "maxAgeDays": 3,
          "unit": "x10^9/L"
        },
        {
          "id": "platelets",
          "label": "Platelets",
          "rule": "< 100 x10^9/L",
          "severity": "moderate",
          "message": "Thrombocytopenia - consider drug effect. If combined with anemia, high LDH, and low haptoglobin, consider CNI-associated TMA.",
          "kind": "below",
          "value": 100,
          "maxAgeDays": 3,
          "unit": "x10^9/L"
        },
        {
          "id": "hemoglobin",
          "label": "Hemoglobin",
          "rule": "drop >= 20 g/L in 48 h",
          "severity": "moderate",
          "message": "Check for bleeding and hemolysis/TMA.",
          "kind": "drop",
          "value": 20,
          "hours": 48,
          "maxAgeDays": 3,
          "unit": "g/L"
        },
        {
          "id": "drugLevel",
          "label": "CNI/mTOR level",
          "rule": "outside program target range (target range varies by time since transplant - enter per patient)",
          "severity": "major",
          "message": "Level out of target. Discuss with transplant.",
          "kind": "level"
        },
        {
          "id": "qtc",
          "label": "QTc",
          "rule": "> 500 ms",
          "severity": "major",
          "message": "Prolonged QTc - review QT-prolonging drugs and electrolytes.",
          "kind": "above",
          "value": 500,
          "maxAgeDays": 7,
          "unit": "ms"
        },
        {
          "id": "ck",
          "label": "CK",
          "rule": "> 5x ULN",
          "severity": "major",
          "message": "Possible statin/colchicine myopathy.",
          "kind": "uln",
          "times": 5,
          "defaultUln": 170,
          "maxAgeDays": 7,
          "unit": "U/L"
        }
      ]
    },
    "clinicalWatchList": {
      "CNI": [
        "Tremor, headache, confusion, seizures, visual change (consider PRES)",
        "Hypertension",
        "AKI",
        "Hyperkalemia, hypomagnesemia",
        "Hyperglycemia",
        "TMA"
      ],
      "mTOR": [
        "Mouth ulcers",
        "Pneumonitis (new cough/dyspnea)",
        "Poor wound healing",
        "Proteinuria, edema",
        "Hyperlipidemia"
      ],
      "antimetabolite": [
        "Leukopenia/cytopenias",
        "Diarrhea, GI upset (mycophenolate)",
        "Hepatotoxicity, pancreatitis (azathioprine)"
      ],
      "steroid": [
        "Hyperglycemia",
        "Delirium",
        "Adrenal insufficiency if missed",
        "Masked fever/peritonitis"
      ],
      "general": [
        "Opportunistic infection: CMV, PJP, BK, fungal",
        "Atypical presentation of infection",
        "Transplant nephrologist contact should be documented"
      ]
    }
  };
  if (typeof module !== "undefined") module.exports = RULES; else window.TX_RULES = RULES;
})();
