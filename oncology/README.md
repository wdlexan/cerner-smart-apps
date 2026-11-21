# Oncology – common cancers (standalone)

Same app as the toolkit's "Oncology (common cancers)" tab, on its own launch. The page loads its scripts from `../hospitalist-toolkit/tools/onc/`, so there is one copy of the logic.

Covers lung (NSCLC and SCLC), breast, colorectal, prostate, bladder, kidney, pancreatic and head and neck cancer, melanoma, leukemia (AML, APL, ALL, CML, CLL) and lymphoma (DLBCL, Hodgkin, Burkitt, CNS, follicular, mantle cell and others): intent and biomarkers, treatment for cure, palliative options, what to watch for in hospital, when to call oncology, rough prognosis (regimens named, not dosed; links to BC Cancer protocols). Emergencies tab with MASCC, corrected calcium and Cairo-Bishop TLS calculators. Chart flags from labs, temperature, problems, reports and anticancer drugs. Printable patient handout and note draft.

- Launch from Cerner: `oncology/launch.html`.
- Demo without a launch: `oncology/index.html?demo=1` to `16` (7–11 leukemia/lymphoma, 12–16 bladder, melanoma, head and neck, kidney, pancreas).
- Code Console: add `https://wdlexan.github.io/cerner-smart-apps/oncology/launch.html` as a launch URI and `https://wdlexan.github.io/cerner-smart-apps/oncology/index.html` as a redirect URI.
- Scopes: Patient, Observation (labs and vital signs), MedicationRequest, Condition, DiagnosticReport (read).
- Tests: `node hospitalist-toolkit/tests/test_onc.js`. UNVERIFIED draft.
