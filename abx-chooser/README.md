# Antibiotic chooser (standalone)

Same app as the toolkit's "Antibiotic chooser" tab, on its own launch. Scripts load from `../hospitalist-toolkit/tools/abxmap/`; the regimens come from the Infections by site data (`hospitalist-toolkit/tools/infections/infections-data.js`) plus `abxmap/extra-sites.js` (sepsis with unclear source, C. difficile), so both tabs show the same choices.

Hover over the body map and click a site (lungs, skin, kidneys/bladder, prostate, colon, gallbladder/liver, joints, brain, sinuses, teeth, groin/perineum, blood; TB and C. difficile in the list). Criteria (pre-filled from the chart): beta-lactam allergy type, sulfa allergy, CrCl, MRSA / Pseudomonas / ESBL risk, pregnancy, QT risk, valproate, warfarin, serotonergic drugs, CYP3A4 interactions, age ≥65/steroids, prior C. difficile. Each regimen is marked ✓ fits / ⚠ caution / ✗ avoid with the reasons, and links to the antibiotic classes PDF page for doses and side effects. "Use in note" builds a note line.

- Launch from Cerner: `abx-chooser/launch.html` (needs AllergyIntolerance.read).
- Demo without a launch: `abx-chooser/index.html?demo=1` to `4`.
- Code Console: add `https://wdlexan.github.io/cerner-smart-apps/abx-chooser/launch.html` as a launch URI and `https://wdlexan.github.io/cerner-smart-apps/abx-chooser/index.html` as a redirect URI.
- Tests: `node hospitalist-toolkit/tests/test_abxmap.js`. UNVERIFIED draft.

## Culture & sensitivities

Paste (Ctrl+V), drop or choose a screenshot of the susceptibility result, or paste the result text. Screenshots are read in the browser with Tesseract OCR (tesseract.js loaded from jsDelivr on first use; the image is not uploaded). Before OCR the image is converted to grey, table gridlines are erased, it is enlarged up to 3x and thresholded. The parser finds organisms, MRSA/ESBL/carbapenemase flags and S/I/R per antibiotic (table rows or "resistant to ... / susceptible to ..." prose), shows an editable table, and infers unreported results (MRSA -> beta-lactams R; ESBL -> cephalosporins/aztreonam R; Enterococcus and Pseudomonas intrinsic resistance; ampicillin -> amoxicillin). Regimens get "susceptible on the culture" notes, and a first-choice drug that is R is marked avoid. The latest chart micro report with results is read automatically.

Tested on a made-up 2-organism screenshot: 12/12 antibiotics found, 2 second-organism cells missed - always check the table against the report.
