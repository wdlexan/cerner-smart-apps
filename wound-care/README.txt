WOUND CARE — SMART on FHIR app for the hospitalist (23 Nov 2026)
=================================================================
Which dressing for which wound, how often to change it, NPWT (VAC) for pressure
injuries, and wound care order / consult text. Read-only: nothing is written to
the chart. UNVERIFIED draft from general knowledge — confirm with the wound
clinician (NSWOC) and the local wound formulary before clinical use.

Files (keep both in one folder)
  launch.html   SMART launch (CLIENT_ID 09c38f54-fb4d-4664-87b6-67b57983ac01).
                Scopes: Patient, Condition, Observation, MedicationRequest (read).
  index.html    Everything else (data tables PRODUCTS, PI_STAGES, BRADEN, TYPES and
                the chooser rules are at the top of the script). Opens without a
                launch in reference mode.

Tabs
  Dressing chooser       Dropdowns (type, stage, depth, tissue, exudate, infection,
                         periwound, perfusion, bleeding, odour, bone, anticoagulation)
                         -> primary + secondary dressing, change frequency, act-first
                         flags, avoid list, NPWT candidacy; "Send to order writer".
  Products & change freq Category table with filter box; skin care; what not to use.
  Wound types            Pressure injury, DFU, venous (compression by ABI), arterial,
                         surgical, skin tear, trauma, fungating, IAD, IV sites.
  Pressure injury        NPIAP staging with treatment and change frequency; Braden
                         calculator with plan; prevention bundle.
  NPWT / VAC             Indication / contraindication / precaution checklist;
                         settings, change q48-72 h, 2-h rule, troubleshooting.
  From chart             Wound-related problems, healing labs, medications that
                         matter (steroids, anticoagulants -> NPWT caution, anti-VEGF,
                         thyroid/lithium -> no cadexomer iodine).
  Order & consult        Order text by category (not brand); consult message.
  References
