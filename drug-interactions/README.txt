DRUG INTERACTIONS — QT · SEROTONIN SYNDROME · SEIZURE THRESHOLD (26 Nov 2026)
=============================================================================
Checks the patient's active medications for three hospitalist-relevant interaction
groups, using the patient's own QTc, K, Mg, Ca, HR, Na, glucose, eGFR and problem list.
Read-only: nothing is written to the chart. Tested on made-up patients only. UNVERIFIED draft.

Files (keep all in one folder)
  launch.html  SMART launch (CLIENT_ID 09c38f54-fb4d-4664-87b6-67b57983ac01).
               Scopes: Patient, MedicationRequest, Observation, Condition (read).
  index.html   Page layout and styles. index.html?demo=1 shows a made-up patient.
  rules.js     Drug list (~150 drugs, brand names included) and all interaction rules.
               Add a drug with one D('name', ['brand'], {qt, ss, sz, ...}) line.
  app.js       FHIR loading, manual mode (paste a med list), sub-tabs, consult message, copy to note.

Sub-tabs
  Summary      All findings by severity, drugs in more than one risk group, check a drug
               before ordering, consult message (Wayne format), copy to note.
  QT           QT drugs (known / possible TdP risk), risk factors, Tisdale score, CYP3A4/2C19
               level interactions, elderly citalopram/escitalopram dose, reference dropdown.
  Serotonin    MAOI / weak MAOI (linezolid, MAO-B) / strong / moderate / weak serotonergic
               drugs, CYP2D6 + tramadol, Hunter criteria checklist, reference dropdown.
  Seizure      Carbapenem + valproate, bupropion contraindications, renal accumulation
               (cefepime, imipenem, meperidine, tramadol, baclofen), CYP1A2 (theophylline,
               clozapine), inducers/estrogen lowering AED levels, reference dropdown.
  Med list     Recognized and NOT-checked medications; paste a list for manual mode.
  Patient data Editable labs/ECG/conditions (QTc often has to be typed in from the ECG).

Sources: CredibleMeds categories, ONC high-priority DDI list, Health Canada/product
monographs, Tisdale 2013, Hunter criteria (Dunkley 2003). Lists are curated, not exhaustive.
Tests: node hospitalist-toolkit/tests/test_ddi.js
Also a toolkit tab: Drug interactions (hospitalist-toolkit/tools/ddi/, key ddi, Safety menu).
