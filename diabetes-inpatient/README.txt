INPATIENT DIABETES — SMART on FHIR app for the hospitalist (3 Nov 2026)
======================================================================
Type 1 (insulin-dependent) and Type 2 (non-insulin-dependent) views. Read-only; tested on made-up patients only.

Files (keep all in one folder)
  launch.html      SMART launch (CLIENT_ID 09c38f54-fb4d-4664-87b6-67b57983ac01)
  index.html       The page. index.html?demo=1 (or 2, 3) shows made-up patients.
  dm-criteria.js   ALL targets, dose rules, drug list, vascular-protection rules and sources. Edit this file.
  dm.js            FHIR loading, checks and display.   dm.css  Styles.
  dm-mock.js       1 = 78 F type 2, eGFR 28, lows; 2 = 64 M type 2 on prednisone with HF; 3 = 26 F type 1, NPO, no basal.

Sections (click a heading to open/close; Expand all / Collapse all)
  Header        Type 1 / Type 2 switch (auto from the problem list), A1C, eGFR, weight, NPO, steroid, IV insulin, pump/CGM.
  Alerts        Type 1 without basal, severe lows, lows on a sulfonylurea, correction-only with highs, SU while NPO,
                SGLT2i while NPO/ill, metformin with eGFR <30, pump/CGM policy.
  Glucose       3-day grid by time of day (overnight, fasting, pre-lunch, pre-supper, bedtime) with insulin given
                (basal, meal B/L/S, correction) and a chart with the 4–10 band.
  Lows          Each low with likely contributors (insulin in the hours before, basal the night before, sulfonylurea,
                poor intake/NPO from notes, eGFR <30, steroid taper), hypoglycemia risk level and the Island Health
                treatment steps.
  Dose          Proposals with the calculation shown and an "Accept into the plan" box (accepted items go into the
                summary). Lows → reduce the responsible insulin 10–20%; fasting/pre-meal >8 on 2 of 3 days → +10%
                (never while there were lows in 48 h); NPO → basal 80% (type 1) / 60% (type 2), hold meal doses;
                poor intake → halve meal doses; correction-only with highs → start 0.4 u/kg/day (0.2–0.3 if older,
                eGFR <30, <50 kg, poor intake), half basal; recent basal not reordered → restart; steroids → morning
                NPH 0.1 u/kg per 10 mg prednisone (max 0.4 u/kg). Not shown for IV insulin, DKA or pumps.
                IV insulin / DKA → subcutaneous checklist.
  Options       Type 2: metformin, SGLT2i, GLP-1 RA, DPP-4i, sulfonylurea, pioglitazone, repaglinide, insulin —
                each marked Suitable / Caution / Avoid for this patient (eGFR, HF, lows, age, MTC, pancreatitis),
                with "Consider adding" for cardiorenal benefit (ASCVD, HF, CKD).
  Discharge     A1C-guided regimen (type 2: Umpierrez 2014 bands; relaxed target with lows/frailty), checklist:
                teaching, supplies, glucagon and ketones (type 1), sick-day rules, follow-up, repeat A1C.
  Vascular      Statin, ACEi/ARB, ASA (secondary prevention only), SGLT2i/GLP-1 RA — On it / Gap / Not indicated /
                Review; A1C, LDL, ACR, eGFR, BP against targets; outpatient eye and foot exams.
  Summary       Text for the note, including accepted dose changes.

Code Console: launch URI .../diabetes-inpatient/launch.html, redirect URI .../diabetes-inpatient/index.html
  Scopes (read): Patient, Encounter, MedicationRequest, MedicationAdministration, Observation, Condition,
  ServiceRequest, NutritionOrder, DocumentReference, Binary.

Limits
  - Meal vs correction doses are told apart from the order/MAR text ("correction", "scale", "with meals").
    Check how Island Health orders read in the sandbox and adjust INSULIN in dm-criteria.js.
  - NPO and intake come from diet orders or notes; set "NPO now" by hand if needed.
  - Dose proposals are decision support; the prescriber decides.
