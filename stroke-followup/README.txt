STROKE FOLLOW-UP — SMART on FHIR app for the hospitalist (2 Nov 2026)
====================================================================
For adults the hospitalist follows after the ED and neurology have seen them:
treated with tenecteplase/alteplase and/or EVT, CTA negative with MRI pending, or ESUS.
Read-only: nothing is written to the chart. Tested on made-up patients only.

Files (keep all in one folder)
  launch.html          SMART launch (CLIENT_ID 09c38f54-fb4d-4664-87b6-67b57983ac01).
  index.html           The page: Look back (7/14/30 days), Refresh.
                       index.html?demo=1 (or 2, 3) shows made-up patients without a launch.
  stroke-criteria.js   ALL rules, thresholds, word lists and sources. Edit this file.
  stroke.js            FHIR loading, the checks and the display.
  stroke.css           Styles.
  stroke-mock.js       Made-up patients: 1 = tenecteplase + EVT 20 h ago; 2 = vertigo,
                       CT/CTA negative, no MRI; 3 = 42-year-old ESUS with PFO.

What the screen shows
  Header      Pathway (icon): Treated / CTA negative–MRI pending / Confirmed on MRI /
              MRI negative / ESUS. Lytic time (from the MAR), EVT and TICI, CTA and MRI result,
              NIHSS. Pathway can be changed by hand. Enter onset time and admission NIHSS if missing.
  Alerts      BP >180/105 in the 24 h after treatment, 24 h CT overdue, hemorrhage on follow-up,
              antithrombotic given too early, angioedema, groin problems, NIHSS up ≥4, glucose
              <4 or >10, temperature >37.5, no swallow screen, new AF, LV thrombus,
              posterior-circulation features with no MRI.
  Timeline    Neuro-check phase, BP window, 24 h CT, when antiplatelet / LMWH can start,
              dual antiplatelet for minor stroke, AF anticoagulation window (ELAN, needs infarct size).
              BP chart for 48 h with the target line.
  Posterior   Vertigo, diplopia, ataxia, dysarthria, dysphagia, nystagmus, crossed findings,
              Horner, decreased consciousness, vomiting (found in notes or ticked).
              One strong sign or two features + no MRI → "MRI needed". Early negative MRI with
              ongoing suspicion → "repeat MRI at 48–72 h". HINTS entry with interpretation.
  Prognosis   THRIVE and ASTRAL scores (points shown). Published percentage tables are NOT
              built in (fill PROGNOSIS.thriveTable / astralTable in stroke-criteria.js, or use the
              MDCalc links). Infarct location notes, volume (or ABC/2), malignant MCA warning >145 mL.
  Workup      MRI, CTA, echo, bubble study, telemetry, prolonged monitoring, lipids, A1c, swallow,
              PT/OT/SLP, stroke prevention clinic. ESUS extras: TEE, leg Doppler (if PFO),
              antiphospholipid antibodies, protein C/S/antithrombin (deferred if on heparin/warfarin),
              D-dimer, blood cultures, drug screen, pregnancy test, ESR/CRP. RoPE score if PFO.
  Summary     Text for the note or discharge handoff, with outstanding outpatient items.

Code Console settings (if registered as its own app)
  SMART launch URI  = https://wdlexan.github.io/cerner-smart-apps/stroke-followup/launch.html
  Redirect URI      = https://wdlexan.github.io/cerner-smart-apps/stroke-followup/index.html
  Patient scopes (read): Patient, Encounter, MedicationRequest, MedicationAdministration,
    Observation, DiagnosticReport, Condition, ServiceRequest, Procedure, DocumentReference, Binary

Limits
  - Imaging results are read from report text; wording at VGH/RJH may need new keywords.
  - NIHSS is taken from a coded result if present, otherwise "NIHSS n" in notes.
  - Neurology and local stroke order sets override this app.
