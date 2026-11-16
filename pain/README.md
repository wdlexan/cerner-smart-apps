# Pain Management – SMART on FHIR app (Cerner)

Acute and chronic pain decision support: risk factors from the chart, current analgesics with MME, don't-miss alerts, drug-class options judged OK / caution / avoid for the patient, tailored acute and chronic plans, opioid conversion and taper calculators, and an editable note draft.

Files: `launch.html`, `index.html`, `app.js` (chart reading, context, alerts, plans, tools), `drugs.js` (drug classes, doses, kidney/liver adjustments, suitability rules), `demo-patients.js`.
Also a Hospitalist Toolkit tab (`hospitalist-toolkit/tools/pain/`), next to Opioid safety. MME factors match the Opioid safety tab.

## Try it
`https://wdlexan.github.io/cerner-smart-apps/pain/index.html?demo=1` … `?demo=7`

| # | Patient | Tests |
|---|---------|-------|
| 1 | Agnes, 85 F | Hip fracture, dementia, eGFR 34 on morphine PRN; no acetaminophen, bowel regimen, naloxone or nerve block |
| 2 | Victor, 70 M | Diabetic neuropathy, eGFR 24: pregabalin above renal max, amitriptyline ≥65, oxycodone + gabapentinoid, duloxetine avoid |
| 3 | Jordan, 38 M | Post-op on buprenorphine-naloxone (OUD): continue it, add full agonist, naloxone kit |
| 4 | Glen, 59 M | Chronic back pain: 180–270 MME + lorazepam + gabapentin + OSA: taper, naloxone, benzodiazepine taper |
| 5 | Marcel, 70 M | Bone metastases + cirrhosis: acetaminophen cap 2 g, NSAID avoid, cord compression red flag |
| 6 | Ruth, 81 F | Knee OA on ibuprofen + apixaban + ACEi + diuretic (triple whammy) |
| 7 | Simone, 44 F | Fibromyalgia on tramadol + sertraline + epilepsy |

`test-pdfs/` has the same patients as PDFs for the toolkit's Import PDF button (rebuild: `node make-test-pdfs.js && python3 make-test-pdfs.py`).

## Cerner Code Console (standalone)
Launch: `https://wdlexan.github.io/cerner-smart-apps/pain/launch.html` · Redirect: `https://wdlexan.github.io/cerner-smart-apps/pain/index.html` · same scopes as the Dementia app.
Doses are typical starting points — check product monographs and Island Health guidance.
