# Neuro (non-stroke) (standalone)

Same app as the toolkit's Neuro (non-stroke) tab, on its own launch. The page loads its scripts from `../hospitalist-toolkit/tools/neuro/`, so there is one copy of the logic.

- Launch from Cerner: `neuro/launch.html` (shared client ID).
- Demo without a launch: `neuro/index.html?demo=1` to `6` (GBS with falling FVC, myasthenia on ciprofloxacin/metoprolol/IV magnesium, malignant cord compression with retention, chronic subdural on apixaban, MS pseudo-relapse with UTI, central vertigo).
- Code Console: add `https://wdlexan.github.io/cerner-smart-apps/neuro/launch.html` as a launch URI and `https://wdlexan.github.io/cerner-smart-apps/neuro/index.html` as a redirect URI.
- Tests: `node hospitalist-toolkit/tests/test_neuro.js`. UNVERIFIED draft.
