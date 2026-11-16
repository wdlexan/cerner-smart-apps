# Dementia Workup – SMART on FHIR app (Cerner)

Files: `launch.html`, `index.html`, `app.js` (no other dependencies; fhirclient.js loads from CDN).

## Try it first with the made-up patient
1. Put the three files in one folder on your computer.
2. Double-click `index.html` (or open `index.html?demo=1`). It runs on "DEMO, Harold", a made-up 82-year-old with delirium plus Lewy body, vascular and Alzheimer features.

## Put it on GitHub Pages (wdlexan/cerner-smart-apps)
1. Go to github.com/wdlexan/cerner-smart-apps.
2. Click **Add file** → **Upload files**.
3. Drag the three files in, but first create the folder: in the "Drag files here" page, click **choose your files**, or drag the whole `dementia` folder so the path becomes `dementia/launch.html`, etc.
4. Scroll down, type a commit message ("Add dementia workup app"), click **Commit changes**.
5. Wait 1–2 minutes. The URLs will be:
   - Launch: `https://wdlexan.github.io/cerner-smart-apps/dementia/launch.html`
   - Redirect: `https://wdlexan.github.io/cerner-smart-apps/dementia/index.html`

## Register in the Cerner Code Console
1. Go to code-console.cerner.com → **My Applications** → open your app (client ID `09c38f54-fb4d-4664-87b6-67b57983ac01`), or click **+ New App** if you want this one registered separately.
2. Click **Edit**.
3. **SMART Launch URI**: paste the Launch URL above.
4. **Redirect URI**: click **Add** and paste the Redirect URL above (keep your other apps' URIs).
5. **Patient scopes** – tick **read** for: Patient, Condition, Observation, MedicationRequest, DocumentReference, DiagnosticReport, Binary.
6. Click **Save**.
7. Launch it from the sandbox against a test patient (e.g. Joe Test).

If your registration uses SMART v2 scopes, change `.read` to `.rs` in `launch.html`.
If a different client ID is registered for this app, change it on line 15 of `launch.html`.

## What each tab does
1. **Overview** – delirium flag, cognitive scores, stage, imaging, core bloods, meds affecting cognition, leading subtype fits, CCCDTD5 steps.
2. **Cognition & features** – MoCA/MMSE/Mini-Cog/RUDAS entry; ~50 checklist items pre-ticked from notes, problem list and imaging reports (with the source snippet, labelled "from chart – confirm"); biomarker results.
3. **Subtype fit** – each dementia type scored with reasons and next steps (DLB McKeith 2017, bvFTD Rascovsky, PPA Gorno-Tempini, vascular, PD 1-year rule, NPH, rapidly progressive/CJD, alcohol, depression, mixed).
4. **Workup** – reversible-cause bloods with status, medication review, imaging reports, other screens, type-specific tests.
5. **Treatment** – bradycardia/renal/antipsychotic safety checks from the chart, non-drug care for everyone, treatment by type, Canadian dosing table, anti-amyloid notes.
6. **Types reference** – symptoms, signs, imaging, treatment for each type; delirium vs dementia vs depression.
7. **Note draft** – editable assessment & plan with a decision line; Copy button.

Keyword matching is simple (with basic negation such as "no hydrocephalus"), so every chart flag needs bedside confirmation.

## Test patients (all made up)
In the app: open `index.html?demo=1` … `?demo=10`, or pick from the dropdown in the blue box on the Overview tab. The box shows what the app should conclude.

| # | Patient | Type | What it tests |
|---|---------|------|---------------|
| 1 | Harold, 82 M | Lewy body + delirium | Delirium banner, probable DLB (4 core features), haloperidol warning, HR 56 on metoprolol, apixaban |
| 2 | Margaret, 79 F | Alzheimer | Hip fracture admission, hippocampal + parietal atrophy, mild dementia, normal bloods |
| 3 | Gordon, 59 M | Behavioural FTD | 5–6/6 features, frontal/temporal atrophy, young onset, no ChEI |
| 4 | Raymond, 76 M | Vascular | Prior stroke, stepwise, infarcts + Fazekas 3, focal signs, A1c/LDL high |
| 5 | Evelyn, 77 F | NPH | Gait first, urge incontinence, Evans 0.36/DESH, oxybutynin to stop |
| 6 | Douglas, 67 M | Rapid / CJD | 8-week decline, myoclonus, DWI ribboning, RT-QuIC, infection prevention |
| 7 | Kevin, 58 M | Korsakoff | Alcohol, confabulation, low B12/folate, macrocytosis, oral thiamine only |
| 8 | Walter, 80 M | Parkinson disease dementia | 1-year rule, hallucinations, pramipexole + trihexyphenidyl, low BP |
| 9 | Doris, 83 F | Reversible causes | Depression, TSH 18.5, Ca 2.74, Na 131, amitriptyline/oxybutynin/diphenhydramine/lorazepam |
| 10 | Linda, 63 F | Logopenic PPA | Usually Alzheimer, MCI-level, young onset, prompts p-tau217 |

As PDFs: `test-pdfs/` has the same 10 patients as chart-extract PDFs for the Hospitalist Toolkit **Import PDF** button
(choose "Open as a separate patient"; leave "Also keep the PDF text as a note" ticked). Rebuild them with
`node make-test-pdfs.js && python3 make-test-pdfs.py` after editing `demo-patients.js`.
