# Critical Labs → MRP (Teams)

A SMART on FHIR app for the Cerner sandbox. When opened on a patient it:

1. Pulls the last 48 h of labs (`Observation?category=laboratory`).
2. Flags a result as critical if the lab marked it `HH`, `LL` or `AA`, **or** it's beyond a backup threshold in `config.js`. Thresholds only apply when the units match, so a result in mg/dL is never compared against a mmol/L cut-off.
3. Shows the critical results with checkboxes, plus an optional note box.
4. When you press **Send selected to MRP in Teams**, it posts to a Power Automate flow. The flow looks up the MRP in your SharePoint patient list and sends that doctor a Teams chat from the Flow bot. It replies to the app with the MRP's name, or "MRP not found".

Nothing is sent without a click. If the MRP can't be found or the send fails, the app says so and tells you to call.

Files: `launch.html`, `index.html`, `app.js`, `config.js` (all settings live in `config.js`).

---

## Part 1 — Build the Power Automate flow (test tenant)

> The "When a HTTP request is received" trigger is a **Premium** connector. Your test tenant needs a Power Automate Premium (or trial) licence.

### 1.1 Create the flow
1. Go to **make.powerautomate.com** and sign in to the **test tenant**.
2. In the left menu click **My flows**.
3. Click **+ New flow** → **Instant cloud flow**.
4. Flow name: `Critical Lab to MRP`.
5. Don't pick a trigger in the list. Click **Skip** (bottom of the dialog).
6. In the designer click **Add a trigger**.
7. In the search box type `When a HTTP request is received` and click it (Request connector).

### 1.2 Set up the trigger
1. In the trigger panel, set **Who can trigger the flow?** to **Anyone** (test tenant only; see Part 4).
2. Find **Request Body JSON Schema** and paste:

```json
{
  "type": "object",
  "properties": {
    "patientName":   { "type": "string" },
    "patientFamily": { "type": "string" },
    "patientGiven":  { "type": "string" },
    "mrn":           { "type": "string" },
    "fhirPatientId": { "type": "string" },
    "location":      { "type": "string" },
    "sentBy":        { "type": "string" },
    "note":          { "type": "string" },
    "messageHtml":   { "type": "string" },
    "labs": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "name":  { "type": "string" },
          "value": { "type": "string" },
          "flag":  { "type": "string" },
          "time":  { "type": "string" }
        }
      }
    }
  }
}
```

3. Click **Advanced parameters** → **Method** → choose **POST**.

### 1.3 Look up the MRP in SharePoint
1. Click the **+** under the trigger → **Add an action**.
2. Search `Get items` and choose **Get items (SharePoint)**.
3. **Site Address**: pick the site that holds your MRP lists.
4. **List Name**: pick the list that maps patient → MRP (your *active intake patients* list).
5. Click **Advanced parameters** → tick **Filter Query** and **Top Count**.
6. **Top Count**: `1`
7. **Filter Query**: type the text below. Then, where it says `PATIENT_NAME`, delete that word, click the **lightning bolt** (dynamic content) and choose **patientName** from the trigger:

```
Title eq 'PATIENT_NAME'
```

   - Replace `Title` with the **internal name** of the column that holds the patient's name. To find it: open the list → **List settings** (gear) → click the column → the internal name is at the end of the browser address after `Field=`.
   - Cerner sends the name as `LAST, First`. If your list stores it differently, filter on the last name instead: change `patientName` to **patientFamily** and use `startswith(Title,'PATIENT_FAMILY')`.
8. Click the three dots (**…**) on the action → **Rename** → `Get MRP row`.

### 1.4 Check a match was found
1. Click **+** under *Get MRP row* → **Add an action** → search `Condition` → **Condition (Control)**.
2. Left box: click it → the **fx** (expression) tab → paste and click **Add**:
   `length(body('Get_MRP_row')?['value'])`
3. Middle dropdown: **is greater than**.
4. Right box: `0`.

### 1.5 "False" branch: MRP not found
1. Under **False** click **+** → **Add an action** → search `Response` → **Response (Request)**.
2. **Status Code**: `404`
3. **Body**:
```json
{ "status": "mrp_not_found" }
```

### 1.6 "True" branch: send the Teams message
1. Under **True** click **+** → **Add an action** → search `Post message in a chat or channel` → choose it (Microsoft Teams).
2. **Post as**: `Flow bot`
3. **Post in**: `Chat with Flow bot`
4. **Recipient**: click the box → **fx** → paste the expression below (change `MRP` to your Person column's internal name) → **Add**:
   `first(body('Get_MRP_row')?['value'])?['MRP']?['Email']`
5. **Message**: click the box → lightning bolt → choose **messageHtml** from the trigger.
   - If the message box only lets you format text, click the **</>** (code view) button first, then insert **messageHtml**.
6. Click **+** under the Teams action → **Add an action** → **Response (Request)**.
7. **Status Code**: `200`
8. **Body**: type the text below. Where it says `MRP_NAME`, delete it, click **fx** and paste `first(body('Get_MRP_row')?['value'])?['MRP']?['DisplayName']`:
```json
{ "status": "sent", "mrpName": "MRP_NAME" }
```

### 1.7 Report a failed Teams send back to the app
1. Under the Teams action, add another **Response (Request)** next to (parallel with) the 200 one: hover the arrow below the Teams action → **+** → **Add a parallel branch** → **Response**.
2. **Status Code**: `500`. **Body**: `{ "status": "teams_failed" }`
3. Click the **…** on this Response → **Settings** → **Run after** → untick **is successful**, tick **has failed** and **has timed out** → **Done**.

### 1.8 Save and copy the URL
1. Click **Save** (top right).
2. Click the trigger card again. The **HTTP URL** field is now filled in. Click the **copy** icon.
3. Paste that URL into `config.js` as `flowUrl: "https://…"`.

---

## Part 2 — Put the app on GitHub Pages

1. Go to **github.com/wdlexan/cerner-smart-apps**.
2. Click **Add file** → **Upload files**.
3. Drag in the whole `critical-labs` folder (all four files, with `flowUrl` filled in).
4. Commit message: `Add critical labs app` → **Commit changes**.
5. Wait about 1 minute, then open:
   `https://wdlexan.github.io/cerner-smart-apps/critical-labs/index.html?demo=1`
   This is **demo mode**: a made-up patient with a K of 6.9 and Hgb of 62, with no chart connection. Press **Send**. You should get a Teams chat from the Flow bot, **but only if** your SharePoint list has a row for `TEST, Demo` with an MRP in the test tenant. Add that row first.

## Part 3 — Register in the Cerner code console

1. Open your app in the Cerner Code Console (client ID `09c38f54-…`) → **Edit**.
2. **SMART Launch URI**: `https://wdlexan.github.io/cerner-smart-apps/critical-labs/launch.html`
3. **Redirect URI**: add `https://wdlexan.github.io/cerner-smart-apps/critical-labs/index.html`
4. **Scopes**: make sure these are ticked: Patient read, Observation read, Encounter read, Practitioner read (user), `launch`, `openid`, `fhirUser`, `online_access`.
5. Save, then launch it on a sandbox patient (e.g. Joe Test). Sandbox patients rarely have critical labs, so "No critical results" is the normal outcome there. Use demo mode to test the Teams side.

---

## Part 4 — Before real patients (must do)

- **Lock the flow URL.** With "Anyone" the URL works like a password, and it sits in a public repo. For production, switch the trigger to **Any user in my tenant** and have the app sign in with Microsoft (MSAL) to send a token, or route through Island Health's integration platform. Ask IH IT which they allow.
- **Thresholds are placeholders.** Replace them in `config.js` with the VGH lab's official critical-value list.
- **It's a backup, not the callback.** The lab's phone call to the responsible clinician stays the official process.
- **PHI in Teams.** The message contains the name, MRN and results. Take this to the IH privacy office with the MRP project brief.
- **MRP matching by name is fragile.** Once the list has MRN or FIN, filter on that instead (the app already sends `mrn`).
- **Automatic alerts** (no one opens the app) need a SMART **backend services** client running on a schedule. That's a separate approval from IH/Cerner.

## Troubleshooting

| Problem | Fix |
|---|---|
| "No flow URL set" | Paste the HTTP URL into `config.js` → `flowUrl`. |
| Browser console shows a **CORS** error | In `app.js`, change `"Content-Type": "application/json"` to `"text/plain"`. Then in the flow, replace every `triggerBody()?['x']` with `json(triggerBody())?['x']`. |
| "MRP not found" | The filter didn't match. Check the column's internal name and how the name is stored (`LAST, First`?). |
| Teams action fails | The recipient email must be a user in the **same** tenant as the flow. |
| Already-sent results show green | Stored in this browser only (`localStorage`). Another computer won't know it was sent. |
