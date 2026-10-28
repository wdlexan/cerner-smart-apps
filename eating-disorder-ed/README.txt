EATING DISORDER ED REVIEW — SMART on FHIR app, ADULTS (27 Oct 2026)
===================================================================
For adults with an eating disorder who come to the ED often. It answers three questions:
  - What has happened at past visits?
  - Does today's visit meet criteria to consider medical admission?
  - If not, is the discharge plan complete?
Read-only: nothing is written to the chart. Tested on made-up patients only.

Files (keep all in one folder)
  launch.html       SMART launch. CLIENT_ID is set to 09c38f54-fb4d-4664-87b6-67b57983ac01;
                    change it if you register this app separately in the Code Console.
  index.html        The page: Past visits (12/24/36 months), Refresh.
                    Open index.html?demo=1 (or 2–5) to see made-up patients without a launch.
  edr-criteria.js   ALL thresholds and questions. Edit this file to change what is flagged.
  edr.js            FHIR loading, the checks and the display.
  edr.css           Styles.
  edr-mock.js       Made-up patients: 1 = frequent visits, stable today; 2 = red criteria;
                    3 = partly assessed; 4 = admitted day 9, transfer check;
                    5 = admitted day 4, stays with IM.

What the screen shows
  Service card (top, with icon) — Island Health pathway for supervised-feeding admissions
            IM (purple)   In the ED: admission criteria met → "Admit to Internal Medicine"
                          (VGH: GIM is MRP; RJH: CTU with Psychiatry and dietitian consulting).
                          Admitted: an IM criterion was present in the last 7 days → "Stays with IM".
            ? (amber)     Admitted: nothing definitely present, but items need checking, labs are
                          missing, or "refeeding risk resolved" isn't ticked yet.
            H (green)     Admitted: no IM criteria in 7 days and refeeding resolved →
                          "Consider transfer to the hospitalist service" (mutually agreed by House and IM).
            IM criteria checked over the last 7 days: syncope, dysrhythmia, QTc >450, HR <40 with
            symptoms or another metabolic disturbance, postural SBP drop >20 or HR rise >40 with
            symptoms, K <2.7, HCO3 >35, Na <125, PO4 <0.4, glucose <4.0, temperature <35.
            Lab values count automatically. Syncope/dysrhythmia found only in notes, HR <40 without
            symptoms, and glucose <4.0 (may be postprandial) show as "Check"; tick "Reviewed — doesn't
            count" once confirmed. Site (VGH/RJH) is chosen on the card. Rules: ROUTING in edr-criteria.js.
  Verdict   Red     = at least one red criterion → consider medical admission
            Not complete = no red found yet, but required items are not checked
            Amber   = no red, amber flags to review before discharge
            Clear   = no red or amber flags
  1 Today            Worst value this visit for each measure, the patient's usual value
                     (median of past ED visits), the change, and the flag.
  2 Bedside          Lying/standing BP and HR, QTc and weight if not in the chart, weight trend,
                     days of poor intake, and questions (suicide risk, intake, fluids, syncope,
                     ECG, SUSS, purging, exercise, engagement, other acute problems).
                     Today's notes are searched and matching sentences are shown as prompts.
                     Entries stay on screen only; they are not saved anywhere.
  3 Decision         Refeeding risk (NICE CG32), admit or discharge checklist,
                     and a summary to copy into the note.
  4 Care plan        PLACEHOLDER (see below).
  5 Past visits      ED visits and admissions, typical gap between visits, worst values at
                     each visit, weights, past complications and services found in notes.

Criteria (all in edr-criteria.js, SI units)
  Red = MEED 2022 adult red criterion OR an APA 2023 adult hospitalization criterion
  (whichever is more cautious). Amber = MEED amber band. Rows marked "Local" are numbers
  chosen for this app where the guidelines don't give one; check them with your team.
  Required before the app will call a patient clear: HR, SBP, temperature, K, PO4, glucose,
  QTc, weight/BMI, lying/standing BP and HR, suicide risk, food intake, fluids.

Care plan (PLACEHOLDER)
  The app looks for a note whose TITLE contains words such as "care plan", "crisis plan",
  "frequent presenter". When you find where the care plan lives in PowerChart, put its
  document type name in CARE_PLAN.docTypes in edr-criteria.js, e.g.
      docTypes: ['ED Care Plan'],

Code Console settings (if registered as its own app)
  SMART launch URI  = https://wdlexan.github.io/cerner-smart-apps/eating-disorder-ed/launch.html
  Redirect URI      = https://wdlexan.github.io/cerner-smart-apps/eating-disorder-ed/index.html
  Patient scopes (read): Patient, Encounter, Observation, Condition, MedicationRequest,
    DocumentReference, Binary

Limits
  - Lying/standing vitals, SUSS and most bedside items aren't coded in the chart, so they
    must be entered. ED visits are found from Encounter class "EMER"; if Island Health codes
    them differently, all visits are listed instead (a note says so).
  - Only the 40 most recent notes are read (plus anything titled like a care plan).
  - Adult criteria only. A warning shows if the patient is under 18.
  - Decision support only; the clinician makes the decision.
