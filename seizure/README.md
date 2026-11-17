# Seizure Workup & Follow-up (SMART on FHIR, Cerner)

Standalone app for new-onset and breakthrough seizures.

## Files
- `build/` - run `python3 aed_data.py ../aed-data.js` and `python3 make_pdf.py ../aed-dosing-reference.pdf` from inside `build/` to regenerate the data and PDF
- `launch.html` - EHR launch, or standalone launch when opened directly (sandbox)
- `index.html` - UI
- `app.js` - FHIR reads, rules, driving logic, note draft
- `aed-data.js` - AED dosing data (generated)
- `aed-dosing-reference.pdf` - printable dosing PDF (linked from the AED reference tab)

## Test without the EHR
Made-up patients (demo dates move with today):
- `index.html?demo=1` new-onset GTC, left temporal cavernoma + temporal sharp waves (epilepsy hint), Class 1 truck driver
- `index.html?demo=2` breakthrough: juvenile myoclonic epilepsy on lamotrigine, new combined OCP, ciprofloxacin, low level
- `index.html?demo=3` status epilepticus: post-stroke epilepsy, phenytoin (low, albumin 24) + apixaban, Na 114, cefepime with eGFR 24
- `index.html?demo=4` breakthrough on valproate + meropenem, OCP, tramadol

## Test PDFs (toolkit Import PDF)
`test-pdfs/01_new_onset_Kevin.pdf`, `02_breakthrough_Maria.pdf`, `03_status_Gordon.pdf` are the same patients 1-3 as chart extracts.
Regenerate with `python3 make-test-pdfs.py` (also rewrites `demo-patients.js`). PDF dates are fixed at 2026-11-17; the app reads labs from the last 7 days.

## Deploy
1. Copy the `seizure/` folder into `wdlexan/cerner-smart-apps` and push.
2. In the Cerner code console, add the launch URI `https://wdlexan.github.io/cerner-smart-apps/seizure/launch.html`
   and redirect URI `https://wdlexan.github.io/cerner-smart-apps/seizure/index.html`.
3. Make sure the registration has these scopes: Patient, Observation, MedicationRequest, Condition, DiagnosticReport (read).

## FHIR reads
Labs from the last 7 days, weight, all MedicationRequests (active ones are used; AEDs stopped in the last 30 days are flagged),
Conditions, and DiagnosticReports from the last year (CT, MRI, EEG, ECG are matched by name).
