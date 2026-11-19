# Antibiotic chooser (standalone)

Same app as the toolkit's "Antibiotic chooser" tab, on its own launch. Scripts load from `../hospitalist-toolkit/tools/abxmap/`; the regimens come from the Infections by site data (`hospitalist-toolkit/tools/infections/infections-data.js`) plus `abxmap/extra-sites.js` (sepsis with unclear source, C. difficile), so both tabs show the same choices.

Hover over the body map and click a site (lungs, skin, kidneys/bladder, prostate, colon, gallbladder/liver, joints, brain, sinuses, teeth, groin/perineum, blood; TB and C. difficile in the list). Criteria (pre-filled from the chart): beta-lactam allergy type, sulfa allergy, CrCl, MRSA / Pseudomonas / ESBL risk, pregnancy, QT risk, valproate, warfarin, serotonergic drugs, CYP3A4 interactions, age ≥65/steroids, prior C. difficile. Each regimen is marked ✓ fits / ⚠ caution / ✗ avoid with the reasons, and links to the antibiotic classes PDF page for doses and side effects. "Use in note" builds a note line.

- Launch from Cerner: `abx-chooser/launch.html` (needs AllergyIntolerance.read).
- Demo without a launch: `abx-chooser/index.html?demo=1` to `4`.
- Code Console: add `https://wdlexan.github.io/cerner-smart-apps/abx-chooser/launch.html` as a launch URI and `https://wdlexan.github.io/cerner-smart-apps/abx-chooser/index.html` as a redirect URI.
- Tests: `node hospitalist-toolkit/tests/test_abxmap.js`. UNVERIFIED draft.
