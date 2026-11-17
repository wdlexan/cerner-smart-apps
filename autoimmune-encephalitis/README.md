# Autoimmune / Limbic Encephalitis – SMART on FHIR app (Cerner)

## What's in the folder

| File | What it does |
|---|---|
| `launch.html` | The EHR opens this first. It signs in to Cerner and then redirects to `index.html`. |
| `index.html` | The app page, with these tabs: Findings, Criteria, Antibody & tumour, Workup, Treatment, MitogenDx requisition, Note draft and Reference. |
| `app.js` | Fetches the chart, detects findings, applies the Graus 2016 criteria, runs the treatment checks and fills the requisition. |
| `config.js` | Holds your settings: the client ID, the scopes, the **default referring physician** and how many notes to scan. |
| `mitogen-fill.js` | Fills the MitogenDx PDF. It uses pdf-lib. |
| `mitogen-requisition-2025.pdf` | The blank MitogenDx "Outside of Alberta" requisition form. |

## Choosing the referring physician (requisition tab)
- **Physician** dropdown: physicians saved on that computer, then **Other physician…** (No default physician is set in `config.js` because the repo is public. The first time you use the app, enter yourself under **Other physician…** and click **Save as a physician on this computer**.)
- Choose **Other physician…**, fill in name (Surname, First), phone, fax, email and comments (college ID / MSP number), then press **Generate**. That physician's details go on the PDF.
- To keep them for next time, click **Save as a physician on this computer**. They'll show up in the dropdown in that browser. To delete one, choose it and click **Remove saved physician**.
- Any field can be edited before you generate, even for a saved physician (for example, to add a fax number).
- Saved physicians and the ordering-lab details are stored in that browser's local storage. They never go into the repo.

## Manual mode
Opening `index.html` directly, without a launch from the EHR, starts the app in manual mode. In manual mode you tick the findings yourself, and the criteria checks and the requisition still work. This lets anyone fill out the MitogenDx form without opening a chart.

## Putting it on GitHub Pages (wdlexan/cerner-smart-apps)
1. Go to https://github.com/wdlexan/cerner-smart-apps.
2. Click **Add file** → **Upload files**.
3. Drag the whole `autoimmune-encephalitis` folder from your computer onto the page. GitHub keeps the folder name.
4. In the **Commit changes** box, type `Add autoimmune encephalitis app`.
5. Click **Commit changes**.
6. Wait about 1–2 minutes for Pages to rebuild. Then open
   `https://wdlexan.github.io/cerner-smart-apps/autoimmune-encephalitis/index.html`
   You should see the "Manual mode" banner, which means the files are being served.

## Registering it with Cerner (sandbox)
1. Open the Cerner Code Console (https://code-console.cerner.com) and sign in.
2. Click **My Applications**, then click your existing app (client ID `09c38f54-…`), or click **+ New App** to register this one separately.
3. For a new app:
   - **App type:** Provider.
   - **SMART version:** SMART v1 (to match the `patient/X.read` scopes in `config.js`).
   - **Type of access:** Online.
   - **Application privacy:** Public.
   - **SMART Launch URI:** `https://wdlexan.github.io/cerner-smart-apps/autoimmune-encephalitis/launch.html`
   - **Redirect URI:** `https://wdlexan.github.io/cerner-smart-apps/autoimmune-encephalitis/index.html`
4. On **Product Selection**, choose **Millennium R4**.
5. On the scopes page, tick these **Patient** scopes: Patient, Observation, Condition, MedicationRequest, DocumentReference, DiagnosticReport and Binary (read). Then tick **launch**, **openid**, **fhirUser** and **online_access**.
6. Click **Done** and copy the **Client ID** that Cerner shows.
7. If you registered a new app, open `config.js` on GitHub, click the pencil icon, replace `clientId` with the new value, and click **Commit changes**.
8. In the Code Console, open the app and click **Begin Testing**. Choose a sandbox patient (e.g. Joe Test) and launch.
   If launch fails, the usual causes are scopes that don't match or a mistyped redirect URI. Compare them character by character with step 3.

## Notes / limits
- The symptoms come from keyword matching on up to `maxNotes` recent notes. A simple negation check drops matches like "denies seizure". Every match comes with its chart evidence, so you can confirm it or untick it.
- "Subacute onset < 3 months" and "alternatives excluded" are never detected from the chart. You tick those yourself.
- Before you use real patient data, the Island Health privacy review still applies. The app runs entirely in the browser and sends nothing anywhere, but it does read notes.
- `config.js` is in a **public** repo, so no physician details are stored there.
