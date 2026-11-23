# Hospital at Home – IV antibiotic options (standalone)

Same app as the toolkit's "HaH antibiotics" tab, on its own launch (`launch.html`, scope MedicationRequest + Patient read). Scripts load from `../hospitalist-toolkit/tools/hahabx/`.

- **This patient**: reads active antibiotic orders, works out doses a day, and marks each: nurse bolus OK / needs a 24-h elastomeric / elastomeric per HaH pharmacy (meropenem) / not possible at home, with home-friendly alternatives. Or type an order to check it.
- **Options by organism**: ESBL, Pseudomonas, MSSA, MRSA, strep, enterococcus etc., ranked by fewest nurse visits (q24h bolus → BID → elastomeric).
- **Elastomeric reference**: compatible drugs and 24-h doses; drugs that cannot go in a 24-h device and the Island Health workarounds.
- Setting: nurse bolus visits allowed a day (default 2: anything more than BID needs an elastomeric).

UNVERIFIED draft from the hospitalist's notes (Nov 2026). Tests: `node hospitalist-toolkit/tests/test_hahabx.js`.
