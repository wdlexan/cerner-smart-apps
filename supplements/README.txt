SUPPLEMENT INTERACTIONS (26 Nov 2026)
=====================================
Checks common supplements (vitamins, minerals, herbal and other natural health products)
against the patient's prescription medications and their labs / problem list.
Read-only: nothing is written to the chart. Tested on made-up patients only. UNVERIFIED draft.

Files
  launch.html  SMART launch (CLIENT_ID 09c38f54-fb4d-4664-87b6-67b57983ac01).
               Scopes: Patient, MedicationRequest, Observation, Condition, DocumentReference, Binary (read).
  index.html   Page layout; loads the toolkit's copy of the scripts:
               ../hospitalist-toolkit/tools/supp/rules.js and app.js (one source for both).
               index.html?demo=1 … ?demo=6 shows a made-up patient.

Where supplements come from
  - Chart orders and documented home meds (MedicationRequest) – e.g. calcium, vitamin D, KCl.
    Salt names are ignored (atorvastatin calcium, losartan potassium, esomeprazole magnesium);
    IV potassium, IV iron, IV magnesium and phytonadione are not flagged.
  - Recent clinical notes (last 30 days, up to 15 notes): supplement names with a snippet.
    Vitamins and minerals need a dose or "daily/tab/supplement" after the name, so lab values
    ("potassium 3.2", "iron deficiency") are not picked up. "Denies…/stopped…" is skipped.
    Each note hit has an "include" tick box.
  - Patient-reported: pull-down menu (grouped Vitamins / Minerals / Herbals / Other), quick tick
    boxes for the 16 most common, or paste a list from the bottles.

Sub-tabs
  Summary      Findings by severity, supplements checked, "ask the patient" prompt,
               consult message (Wayne format, default Pharmacy), copy to note.
  Supplements  Add / remove supplements, notes hits, medications checked, manual paste.
  By supplement  One collapsible card per supplement: what it is, its findings, pre-op advice.
  Spacing, surgery & labs  Dose-spacing table (Ca/Fe/Mg/Zn/fibre vs levothyroxine, quinolones,
               tetracyclines, bisphosphonates, integrase inhibitors, eltrombopag, levodopa, MMF),
               surgery hold list (auto-ticked for hip fracture), biotin and other lab interference.
  Reference    Searchable list of all 57 supplements (search by supplement or by drug), with a
               type pull-down; sources.
  Patient data Editable labs and conditions.

Rules (hospitalist-toolkit/tools/supp/rules.js)
  57 supplements, 64 drug groups. Add a supplement with one S(key, name, class, [terms], {...}) entry;
  add a drug to a group by adding its name/brand to the G(...) line.
  Highlights: St John's wort (CNI/mTOR, HIV, MAOI contraindicated; DOAC, ticagrelor, warfarin,
  OCP, anticancer, azole, serotonergic high), bleeding-risk herbals with antithrombotics and a
  stacking rule, vitamin K / dong quai / glucosamine / CBD with warfarin, red yeast rice = lovastatin,
  licorice and low K, potassium / salt substitutes with ACEi/ARB/MRA/TMP (worse with eGFR < 45 or K > 5),
  Mg and vitamin C with eGFR < 30, kava / green tea extract / ashwagandha / black cohosh liver injury,
  probiotics in immunocompromised patients or with central lines, biotin vs troponin and thyroid tests,
  Ang-Lee 2001 pre-op hold times.

Sources: product monographs, NIH ODS fact sheets, NCCIH Herbs at a Glance, MSKCC About Herbs,
Ang-Lee JAMA 2001. Curated, not exhaustive. Confirm with pharmacy / Natural Medicines.
Tests: node hospitalist-toolkit/tests/test_supp.js
Also a toolkit tab: Supplement interactions (hospitalist-toolkit/tools/supp/, key supp, Safety menu).
