# Peritoneal carcinomatosis (standalone)

Same app as the toolkit's "Peritoneal carcinomatosis" tab, on its own launch. The page loads its scripts from `../hospitalist-toolkit/tools/pc/`, so there is one copy of the logic.

Covers: chart flags (labs, MBO medication rules, tumour markers, reports), signs and symptoms, tests, PCI calculator (Sugarbaker, click the regions), approach by primary (colorectal, gastric, ovarian, other), malignant bowel obstruction (what to watch for, surgery/stent checklist, medical management), malignant ascites, chemo by primary, prognosis, printable patient handout (when to return / call 911), and an editable A&P note draft.

- Launch from Cerner: `peritoneal-carcinomatosis/launch.html`.
- Demo without a launch: `peritoneal-carcinomatosis/index.html?demo=1` to `3` (colorectal SBO, ovarian ascites, gastric outlet obstruction).
- Code Console: add `https://wdlexan.github.io/cerner-smart-apps/peritoneal-carcinomatosis/launch.html` as a launch URI and `https://wdlexan.github.io/cerner-smart-apps/peritoneal-carcinomatosis/index.html` as a redirect URI.
- Tests: `node hospitalist-toolkit/tests/test_pc.js`. UNVERIFIED draft.
- Sample PDFs for the toolkit's Import PDF (6 made-up patients: colorectal SBO, ovarian ascites, gastric outlet obstruction, unknown primary, appendiceal PMP, pancreatic inoperable MBO): `python3 make-test-pdfs.py` writes `test-pdfs/`; copies are in `hospitalist-toolkit/sample-pdfs/Peritoneal carcinomatosis/`.
