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
