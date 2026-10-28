// Critical Labs → MRP (Teams) — settings
// Edit this file only; app.js reads everything from here.
window.CRIT_CONFIG = {
  // Cerner app registration
  clientId: "09c38f54-fb4d-4664-87b6-67b57983ac01",
  // EHR launch scopes. Standalone launch swaps "launch" for "launch/patient" automatically.
  scope: "launch openid fhirUser online_access patient/Patient.read patient/Observation.read patient/Encounter.read user/Practitioner.read",
  redirectUri: "index.html",
  // Used for standalone launch (no ?iss= in the URL) — Cerner R4 sandbox
  sandboxIss: "https://fhir-ehr-code.cerner.com/r4/ec2458f2-1e24-41c8-b71b-0e701af7583d",

  // How far back to look for labs
  lookbackHours: 48,

  // Paste the Power Automate "When a HTTP request is received" URL here.
  // WARNING: this repo is public on GitHub Pages — anyone who sees this URL can post to the flow.
  // Fine for the test tenant with made-up patients ONLY. See README "Before real patients".
  flowUrl: "",

  // PLACEHOLDER thresholds (SI units). Replace with the VGH / Island Health lab critical-value list.
  // A result only checks against a threshold when its unit matches one listed here,
  // so a US-unit result (e.g. mg/dL) is skipped instead of mis-flagged.
  // Results the lab itself flags critical (HH / LL / AA) are always caught, whatever the units.
  thresholds: [
    { name: "Potassium",       loinc: ["2823-3", "6298-4"],  units: ["mmol/L"],          low: 2.8,  high: 6.2 },
    { name: "Sodium",          loinc: ["2951-2", "2947-0"],  units: ["mmol/L"],          low: 120,  high: 160 },
    { name: "Glucose",         loinc: ["2345-7", "2339-0"],  units: ["mmol/L"],          low: 2.5,  high: 25 },
    { name: "Calcium (total)", loinc: ["17861-6", "2000-8"], units: ["mmol/L"],          low: 1.75, high: 3.25 },
    { name: "Calcium (ionized)", loinc: ["1994-3", "1995-0"], units: ["mmol/L"],         low: 0.8,  high: 1.6 },
    { name: "Magnesium",       loinc: ["19123-9", "2601-3"], units: ["mmol/L"],          low: 0.4,  high: 2.5 },
    { name: "Phosphate",       loinc: ["2777-1"],            units: ["mmol/L"],          low: 0.3,  high: null },
    { name: "Hemoglobin",      loinc: ["718-7"],             units: ["g/L"],             low: 70,   high: 200 },
    { name: "Platelets",       loinc: ["777-3", "26515-7"],  units: ["10*9/L", "x10E9/L", "10^9/L", "x10*9/L"], low: 20, high: 1000 },
    { name: "WBC",             loinc: ["6690-2", "26464-8"], units: ["10*9/L", "x10E9/L", "10^9/L", "x10*9/L"], low: 1.0, high: 50 },
    { name: "INR",             loinc: ["6301-6", "34714-6"], units: ["", "{INR}", "INR", "1", "{ratio}"], low: null, high: 5.0 },
    { name: "Lactate",         loinc: ["2524-7", "32693-4"], units: ["mmol/L"],          low: null, high: 4.0 }
  ]
};
