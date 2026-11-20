# Autoimmune Serology Interpreter (SMART on FHIR, Cerner)

Helps interpret autoimmune serology — ANA (titre + pattern), ENA (dsDNA, Sm, RNP, Ro, La, Scl-70, centromere, RNA pol III, histone), myositis antibodies, ANCA (IIF, PR3, MPO), anti-GBM, RF, anti-CCP, C3/C4/CH50, antiphospholipid antibodies, cryoglobulins, AMA/ASMA/LKM, HLA-B27 — together with supporting labs (CBC, creatinine, UPCR, urine, ESR/CRP, CK, liver tests, IgG).

## What it does
- **Pulls labs from the chart** (Observation, category = laboratory), plus the problem list (pre-ticks clinical features, highlighted for you to verify) and active medications.
- **Matches results by test name**, so it works across lab naming. Anything antibody-like it cannot match is listed under *Serology & labs → not recognised*.
- **Every result can be entered or overridden** (sandbox patients rarely have these tests). Blue = chart, orange = entered.
- **Scores each condition with ✓ / ✗ / ? lines**: SLE (2019 EULAR/ACR), drug-induced lupus, RA (2010 ACR/EULAR), Sjögren (2016), systemic sclerosis (2013), MCTD, myositis/antisynthetase, GPA / MPA / EGPA (2022 ACR/EULAR), anti-GBM, APS, cryoglobulinemic vasculitis, PBC/AIH, spondyloarthritis, PMR/GCA.
- **ANA, complement and ANCA pattern boxes**: what the titre, pattern and C3/C4 combination point to.
- **Red flags**: RPGN, pulmonary-renal syndrome, anti-GBM, scleroderma renal crisis, anti-MDA5 ILD, myositis with dysphagia, GCA, catastrophic APS, active lupus nephritis.
- **Medication checks**: drugs that cause drug-induced lupus or ANCA, anticoagulants that make lupus anticoagulant unreliable, statins with anti-HMGCR.
- **Suggested next tests**, an **editable note draft**, and a **consult message** in your format.
- **7 made-up teaching cases** (top-right dropdown, or `index.html?demo=sle|mpa|ra|dil|lowana|cryo|ssc`).

## Files
| File | Purpose |
|---|---|
| `launch.html` | SMART launch (EHR launch from PowerChart, or standalone to the sandbox) |
| `index.html` | App page |
| `engine.js` | All rules (no DOM). Runs in Node for testing. |
| `app.js` | FHIR loading and the interface |
| `demo.js` | Made-up patients |

## Put it on GitHub Pages (wdlexan/cerner-smart-apps)
1. Unzip so the folder is `cerner-smart-apps/autoimmune-serology/`.
2. In VS Code terminal, from the repo folder:
   ```
   git pull
   git add autoimmune-serology
   git commit -m "Add autoimmune serology interpreter"
   git push
   ```
3. Wait ~1 minute, then open `https://wdlexan.github.io/cerner-smart-apps/autoimmune-serology/index.html?demo=sle` to check it loads.

## Register in Cerner Code Console
1. Go to code-console.cerner.com → **My Applications** → click your app (client ID `09c38f54-…`), or **+ New App** to register it separately.
2. Click **Edit**.
3. **SMART Launch URI**: `https://wdlexan.github.io/cerner-smart-apps/autoimmune-serology/launch.html`
4. **Redirect URI**: add `https://wdlexan.github.io/cerner-smart-apps/autoimmune-serology/index.html` (keep your existing ones).
5. **Product family / scopes** — make sure these are ticked: Patient (read), Observation (read), Condition (read), MedicationRequest (read), plus `launch`, `launch/patient`, `openid`, `fhirUser`, `online_access`.
6. **Save**. If you made a new app, copy its client ID into `launch.html` (line `CLIENT_ID`).
7. Test: in Code Console click **Begin Testing** → pick a sandbox patient (e.g. Joe Test) → the app opens. Because sandbox patients have few autoimmune labs, go to **Serology & labs** and enter results to try it.

## Notes
- Classification criteria are research tools; they support, not replace, the diagnosis.
- Unit handling: creatinine mg/dL → µmol/L; UPCR mg/mmol or g/mol → g/g (÷113); counts per µL → ×10⁹/L; C3/C4 mg/dL → g/L.
- To add a lab name your hospital uses, edit the matching regular expression in `TESTS` at the top of `engine.js`.
