G6PD CHECK — SMART on FHIR app for the hospitalist (13 Nov 2026)
=================================================================
Checks a patient's active medications against the CPIC 2023 G6PD risk categories,
shows G6PD status from the chart and recent hemolysis labs, and carries the
G6PD reference sheet with a section dropdown.
Read-only: nothing is written to the chart. Tested on made-up patients only.

Files (keep all in one folder)
  launch.html   SMART launch (CLIENT_ID 09c38f54-fb4d-4664-87b6-67b57983ac01).
                Scopes: Patient, MedicationRequest, Observation, Condition, AllergyIntolerance (read).
  index.html    The page and the reference text (edit the reference sections here).
                index.html?demo=1 shows a made-up patient without a launch.
  app.js        Drug rules (RULES at the top), G6PD/hemolysis lab codes, FHIR loading, display.

What the screen shows (top to bottom)
  Banner        STOP (deficient + high-risk drug), amber (high-risk drug, G6PD unknown),
                blue/green otherwise. Also flags methemoglobinemia-risk drugs.
  Recognizing acute hemolysis
                Criteria, plus latest and previous Hb, retic, bilirubin, LDH, haptoglobin,
                DAT, methemoglobin, creatinine, K (last 14 days).
  G6PD status   From problem list (text or ICD-10 D55.0), allergies/alerts, and G6PD labs
                (LOINC 2357-2, 32546-4, 2356-4, then any lab whose name contains G6PD).
  Current meds  Active / on-hold MedicationRequests matched by name and brand to:
                high risk, medium risk, low-to-no risk, no recommendation, MetHb risk.
  Drug lookup   Type a drug name to see its category before ordering.
  Reference     Dropdown: key facts, testing pitfalls, high/medium/low risk, triggers,
                management, inpatient scenarios, pearls, references.

To check before real use
  - Confirm the local Cerner lab codes for G6PD and the hemolysis labs (app.js: G6PD_LOINC, HEMO).
  - Name matching may miss combination products or local naming; confirm with pharmacy.
  - Toolkit tab: app.js exposes window.G6PD = { loadAll, renderAll, classify, RULES }.

Source: Gammal RS et al. Clin Pharmacol Ther 2023;113(5):973–985 (CPIC G6PD guideline).
