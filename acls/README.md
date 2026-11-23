# ACLS (standalone)

Same app as the toolkit's ACLS tab ("ACLS (code & peri-arrest)", key `acls`, open with `#acls`), on its own launch. The page loads its scripts from `../hospitalist-toolkit/tools/acls/`, so there is one copy of the logic.

- Launch from Cerner: `acls/launch.html` (shared client ID).
- Demo without a launch: `acls/index.html?demo=1` to `6` (made-up patients: hyperkalemia, opioid over-sedation after hip fracture, post-op PE, torsades risk, MOST M2 with AF RVR, digoxin/AV-nodal bradycardia).
- Code Console: add `https://wdlexan.github.io/cerner-smart-apps/acls/launch.html` as a launch URI and `https://wdlexan.github.io/cerner-smart-apps/acls/index.html` as a redirect URI.
- The code timer also works in the iPhone pocket app (no Cerner connection).
- Tests: `node hospitalist-toolkit/tests/test_acls.js`. UNVERIFIED draft.
