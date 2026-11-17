# Infections by Site (SMART on FHIR, Cerner)

UNVERIFIED draft - check doses against local antibiogram, Island Health guidance and pharmacy.

- `launch.html` / `index.html` / `app.js` - app; `infections-data.js` - all clinical content (edit here)
- Reads Patient, labs (7 days), vitals (48 h), MedicationRequest, Condition, DiagnosticReport (30 days), AllergyIntolerance
- Demos: `index.html?demo=1` leg cellulitis -> necrotizing fasciitis, `2` severe CAP with penicillin allergy, `3` obstructed ESBL pyelonephritis with amoxicillin anaphylaxis, `4` diverticular abscess on prednisone, `5` bacterial meningitis
- `test-pdfs/` same patients for the toolkit Import PDF (allergies are not imported); `python3 make-test-pdfs.py` regenerates PDFs and `demo-patients.js`
- Cerner registration needs `patient/AllergyIntolerance.read` in addition to the usual scopes
