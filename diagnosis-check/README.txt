DIAGNOSIS CHECK — SMART on FHIR app (26 Oct 2026)
==================================================
Prompts for a second look, never a diagnosis. Read-only.

Files (keep in one folder)
  launch.html  SMART launch (same client ID and scopes as Choosing Wisely)
  index.html   The page. Open index.html?demo=1 for the made-up patient.
  dx.js        Rules, FHIR loading, display
  dx.css       Styles
  dx-mock.js   Demo patient: 71-year-old man, day 4 of "pneumonia", not improving

The four sections
 1 Not improving (from hospital day 3)
   Signs: fever in last 24 h, WBC rising above 12, creatinine up 26.5+, lactate 2+,
   CRP rising, more oxygen, heart rate over 100 or RR over 22 on most readings.
   → a six-question diagnostic time-out.
 2 Can't-miss checks (only when triggered), each with a must-do list ticked from the chart:
   - S. aureus in blood: ID consult, repeat cultures, echo, cefazolin/cloxacillin for MSSA, source, duration
   - Candida in blood: antifungal, remove lines, eye exam, echo, repeat cultures, ID
   - Persistent low BP or vasopressors: cortisol, bleeding, obstruction, drugs, anaphylaxis
   - Confusion with alcohol use or malnutrition: thiamine, magnesium, glucose, other causes
   - Back pain with fever, bacteremia or injection drug use: spine MRI, neuro exam, cultures
 3 Does the data fit? Working diagnosis found from encounter diagnoses and note
   "Impression/Assessment/Admitted with" lines, or ticked by you. Covers heart failure,
   pneumonia, UTI, cellulitis, COPD exacerbation, delirium from infection, SIADH.
 4 Unexplained results: abnormal calcium, ALP, ALT, bilirubin, Hb, platelets, eosinophils,
   Na, K, INR (not on warfarin), TSH, lactate, low glucose, and imaging reports recommending
   follow-up — flagged only if no note mentions them since the result.

Thresholds and rules: CONFIG, FIT_RULES, UNEXPLAINED and bundles() in dx.js.
Checklist icons: ✓ found in chart · ! not found · … pending · ? couldn't check · ○ ask yourself.

Limits: ticks come from notes, orders and reports, so "not found" can mean "not documented".
Tested on made-up patients only.
