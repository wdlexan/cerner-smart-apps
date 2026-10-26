CHOOSING WISELY — SMART on FHIR app (26 Oct 2026)
==================================================

Files (keep all in one folder)
  launch.html   SMART launch. CLIENT_ID is set to 09c38f54-fb4d-4664-87b6-67b57983ac01;
                change it if you register this app separately in the Code Console.
  index.html    The page: header, Look back (3/7/14/30 days), Refresh.
                Open index.html?demo=1 to see the made-up demo patient without a launch.
  cw.js         The 8 checks, FHIR loading and display.
  cw.css        Styles (white background, red/green summary boxes, blue heading strips).
  cw-mock.js    Made-up demo patient (84-year-old woman, admitted 5 days ago).

The 8 checks (Choosing Wisely Canada)
  1 Urinary catheter in place without a documented reason (2+ days)
  2 Antibiotic for a positive urine culture with no fever or urinary symptoms
  3 Benzodiazepine, Z-drug, antipsychotic or sedating antihistamine in a patient 65+
  4 Daily CBC/chemistry stable for 3+ days
  5 Telemetry running 48+ hours
  6 High-risk patient with no MOST or goals-of-care discussion found
  7 Maintenance inhaler with no spirometry on file
  8 PPI with no indication on the problem list (or started this admission)
Each item shows Review / OK / Not applicable / Couldn't check, the evidence, and a link.

Code Console settings (if registered as its own app)
  SMART launch URI  = .../choosing-wisely/launch.html
  Redirect URI      = .../choosing-wisely/index.html
  Patient scopes (read): Patient, Encounter, MedicationRequest, MedicationAdministration,
    Observation, DiagnosticReport, Condition, ServiceRequest, Procedure, DocumentReference, Binary

As a tab in the Hospitalist Toolkit
  Copy cw.js and cw.css next to the toolkit's index.html, then:
    <link rel="stylesheet" href="cw.css">
    <script src="cw.js"></script>
  and when the tab opens:
    CW.mount(document.getElementById('cw-tab'), client, { lookbackDays: 7 });
  Add any missing scopes above to the toolkit's launch.html.

Adjusting thresholds
  All in CW.CONFIG at the top of cw.js: age 65, catheter 2 days, telemetry 48 h,
  fever 38.0 °C, lab stability ranges and allowed change per test.
  Site-specific codes (for example Cerner's code for telemetry or code status)
  go in CONFIG.extraCodes.

Limits
  Catheter, telemetry and goals of care are found from orders, flowsheets and notes,
  so they depend on how Island Health documents them. Expect to tune keywords and codes
  after testing in the sandbox and TRAIN1. Tested on made-up patients only.
