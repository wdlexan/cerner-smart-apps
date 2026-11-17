# AKI (standalone)

Same app as the toolkit's AKI tab, on its own launch. The page loads its scripts from `../hospitalist-toolkit/tools/aki/`, so there is one copy of the logic and both stay in step.

- Launch from Cerner: `aki/launch.html` (uses the shared client ID in `launch.html`).
- Demo without a launch: `aki/index.html?demo=1` to `5` (pre-renal, ATN, AIN, post-renal, ANCA-positive RPGN).
- Code Console: add `https://wdlexan.github.io/cerner-smart-apps/aki/launch.html` as a launch URI and `https://wdlexan.github.io/cerner-smart-apps/aki/index.html` as a redirect URI.
- Tests: `node hospitalist-toolkit/tests/test_aki.js`. UNVERIFIED draft.
