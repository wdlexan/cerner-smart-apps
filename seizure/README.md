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
Open `index.html?demo=1` (made-up patient: on valproate + meropenem, low VPA level, on OCP and tramadol).

## Deploy
1. Copy the `seizure/` folder into `wdlexan/cerner-smart-apps` and push.
2. In the Cerner code console, add the launch URI `https://wdlexan.github.io/cerner-smart-apps/seizure/launch.html`
   and redirect URI `https://wdlexan.github.io/cerner-smart-apps/seizure/index.html`.
3. Make sure the registration has these scopes: Patient, Observation, MedicationRequest, Condition, DiagnosticReport (read).

## FHIR reads
Labs from the last 7 days, weight, all MedicationRequests (active ones are used; AEDs stopped in the last 30 days are flagged),
Conditions, and DiagnosticReports from the last year (CT, MRI, EEG, ECG are matched by name).
