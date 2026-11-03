/* MADE-UP patients for testing the Parkinson's tab. Times relative to "now" (h = hours ago). None of these are real people. */
(function () {
  const iso = (now, h) => new Date(now - h * 36e5).toISOString();
  const req = (now, name, h, status) => ({ resourceType: "MedicationRequest", status: status || "active", medicationCodeableConcept: { text: name }, authoredOn: iso(now, h) });
  const adm = (now, name, h) => ({ resourceType: "MedicationAdministration", status: "completed", medicationCodeableConcept: { text: name }, effectiveDateTime: iso(now, h) });
  const cond = (text, code) => ({ resourceType: "Condition", code: { coding: [{ system: "http://hl7.org/fhir/sid/icd-10", code }], text } });
  const lab = (now, code, name, v, unit, h) => ({ resourceType: "Observation", code: { coding: [{ system: "http://loinc.org", code }], text: name }, effectiveDateTime: iso(now, h), valueQuantity: { value: v, unit } });
  const note = (now, h, title, text) => ({ title, t: Date.now() - h * 36e5, text });
  const pt = (age, gender) => ({ resourceType: "Patient", gender, birthDate: new Date(Date.now() - age * 365.25 * 864e5).toISOString().slice(0, 10) });
  /* MAR for a schedule given as hours-ago list */
  const mar = (now, name, hs) => hs.map((h) => adm(now, name, h));

  window.PD_SAMPLES = [
    { label: "A: 76 M, pneumonia + delirium; haloperidol and metoclopramide ordered; late doses", build: (now) => ({
      patient: pt(76, "male"), conditions: [cond("Parkinson disease", "G20"), cond("Community acquired pneumonia", "J18.9")],
      medreqs: [req(now, "Carbidopa-levodopa 25/100 1.5 tab PO at 07:00, 11:00, 15:00, 19:00", 50), req(now, "Entacapone 200 mg PO with each levodopa dose QID", 50), req(now, "Rasagiline 1 mg PO daily", 50),
        req(now, "Haloperidol 0.5 mg IV q4h PRN agitation", 20), req(now, "Metoclopramide 10 mg IV q6h PRN nausea", 30), req(now, "Tramadol 50 mg PO q6h PRN pain", 30), req(now, "Ceftriaxone 1 g IV q24h", 48)],
      admins: [].concat(mar(now, "Carbidopa-levodopa 25/100 1.5 tab PO", [37, 33, 29, 25, 13, 7.5, 1]), mar(now, "Haloperidol 0.5 mg IV", [10])),
      obs: [lab(now, "2160-0", "Creatinine", 96, "umol/L", 6), lab(now, "29463-7", "Body weight", 68, "kg", 40), lab(now, "8461-6", "Systolic BP supine", 134, "mm[Hg]", 5), lab(now, "8460-8", "Systolic BP standing", 104, "mm[Hg]", 4.9)],
      notes: [note(now, 9, "Nursing Shift Note", "Patient agitated overnight, seeing animals in the room. Haloperidol given x1 with increased rigidity after. Constipated, no BM x4 days."),
        note(now, 20, "Hospitalist Progress Note", "PD with wearing-off before doses per wife. Delirium likely from pneumonia. Coughing with thin fluids at lunch.")] }) },

    { label: "B: 68 F, small bowel obstruction, NPO; CR levodopa + pramipexole", npo: true, build: (now) => ({
      patient: pt(68, "female"), conditions: [cond("Parkinson's disease", "G20"), cond("Small bowel obstruction", "K56.60")],
      medreqs: [req(now, "Carbidopa-levodopa CR 50/200 1 tab PO BID", 30, "on-hold"), req(now, "Carbidopa-levodopa 25/100 1 tab PO TID", 30, "on-hold"), req(now, "Pramipexole 0.5 mg PO TID", 30, "on-hold"), req(now, "Ondansetron 4 mg IV q8h PRN", 30)],
      admins: mar(now, "Carbidopa-levodopa 25/100 1 tab PO", [30]),
      obs: [lab(now, "2160-0", "Creatinine", 70, "umol/L", 4), lab(now, "29463-7", "Body weight", 61, "kg", 30)],
      notes: [note(now, 6, "Surgery Progress Note", "SBO, NPO, NG to low suction. Plan conservative management for 48-72 h."), note(now, 3, "Nursing Shift Note", "Very stiff, unable to turn in bed. Tremor ++.")] }) },

    { label: "C: 82 F, dementia, dyskinesia and falls, orthostatic hypotension, CrCl 30", build: (now) => ({
      patient: pt(82, "female"), conditions: [cond("Parkinson disease with dementia", "G20 F02.80"), cond("Falls, recurrent", "R29.6"), cond("Orthostatic hypotension", "I95.1")],
      medreqs: [req(now, "Carbidopa-levodopa 25/100 2 tab PO 5 times daily", 200), req(now, "Amantadine 100 mg PO BID", 200), req(now, "Ropinirole 1 mg PO TID", 200), req(now, "Oxybutynin 5 mg PO BID", 300), req(now, "Hydrochlorothiazide 12.5 mg PO daily", 300)],
      admins: mar(now, "Carbidopa-levodopa 25/100 2 tab PO", [27, 24, 21, 18, 15, 3]),
      obs: [lab(now, "2160-0", "Creatinine", 120, "umol/L", 8), lab(now, "29463-7", "Body weight", 50, "kg", 40), lab(now, "8461-6", "Systolic BP supine", 142, "mm[Hg]", 6), lab(now, "8460-8", "Systolic BP standing", 108, "mm[Hg]", 5.9)],
      notes: [note(now, 10, "Physiotherapy Progress Note", "Marked dyskinesia 1 h after doses, freezing at doorways. Fell on the unit yesterday. Drooling noted."), note(now, 30, "Nursing Shift Note", "Urinary urgency and incontinence overnight. Sleeping poorly, acting out dreams per daughter.")] }) },

    { label: "D: 64 M, newly diagnosed, not on treatment, tremor", build: (now) => ({
      patient: pt(64, "male"), conditions: [cond("Parkinson disease, newly diagnosed", "G20")], medreqs: [req(now, "Atorvastatin 20 mg PO daily", 500)], admins: [],
      obs: [lab(now, "2160-0", "Creatinine", 82, "umol/L", 20), lab(now, "29463-7", "Body weight", 84, "kg", 20)],
      notes: [note(now, 20, "Neurology Consult", "Right-hand resting tremor and mild bradykinesia, consistent with early Parkinson disease. Mood low; works full time.")] }) }
  ];
})();
