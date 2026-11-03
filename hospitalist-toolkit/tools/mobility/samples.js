/* MADE-UP patients for testing the mobility tab. Notes are invented text. Times relative to "now" (h = hours ago). None of these are real people. */
(function () {
  const iso = (now, h) => new Date(now - h * 36e5).toISOString();
  const b64 = (s) => btoa(unescape(encodeURIComponent(s)));
  const note = (now, h, type, text, author) => ({ doc: { resourceType: "DocumentReference", status: "current", type: { text: type }, date: iso(now, h), author: author ? [{ display: author }] : [],
    content: [{ attachment: { contentType: "text/plain", data: b64(text) } }] }, text });
  const obs = (now, h, name, val) => ({ resourceType: "Observation", status: "final", code: { text: name }, effectiveDateTime: iso(now, h), valueString: val });
  const num = (now, h, name, v) => ({ resourceType: "Observation", status: "final", code: { text: name }, effectiveDateTime: iso(now, h), valueQuantity: { value: v } });
  const cond = (text, code) => ({ resourceType: "Condition", code: { coding: [{ system: "http://hl7.org/fhir/sid/icd-10", code }], text } });
  const sr = (now, h, text, status) => ({ resourceType: "ServiceRequest", status: status || "active", code: { text }, authoredOn: iso(now, h) });
  const enc = (now, h) => ({ resourceType: "Encounter", status: "in-progress", period: { start: iso(now, h) } });
  const pt = (age, gender) => ({ resourceType: "Patient", gender, birthDate: new Date(Date.now() - age * 365.25 * 864e5).toISOString().slice(0, 10) });

  window.MOB_SAMPLES = [
    { label: "A: 88 F, day 3 after hip hemiarthroplasty, improving, lives alone", build: (now) => {
      const docs = [
        note(now, 66, "Physiotherapy Assessment", "PT initial assessment. Baseline: independent with cane, lives alone in a bungalow with 3 steps to enter, no home support. Bed mobility max assist. Transfers sit to stand assist x2. Stood at bedside with FWW, unable to walk today, limited by pain. WBAT per ortho.", "A. Physio, PT"),
        note(now, 42, "Physiotherapy Progress Note", "Transfers min assist. Ambulated 5 m with FWW, moderate assist. Mild dizziness on standing, BP dropped. Plan daily PT.", "A. Physio, PT"),
        note(now, 20, "Physiotherapy Progress Note", "Transfers bed to chair with CGA. Ambulated 20 m with 2WW, min assist. Stairs not yet assessed. Recommend rehab vs home with supports depending on progress.", "A. Physio, PT"),
        note(now, 18, "Occupational Therapy Assessment", "OT assessment. Patient owns a cane. Toileting min assist. Recommend raised toilet seat, tub transfer bench and hip kit (reacher, sock aid). Hip precautions reviewed. Some confusion in the evenings per nursing; poor safety awareness at times.", "B. OT, OT")];
      return { patient: pt(88, "female"), encounters: [enc(now, 90)], docs, conditions: [cond("Displaced fracture of neck of right femur", "S72.031A"), cond("Hypertension", "I10")],
        obs: [obs(now, 30, "Ambulation assist level", "Moderate assist"), num(now, 10, "Morse Fall Scale score", 65)], serviceRequests: [sr(now, 70, "Physiotherapy consult"), sr(now, 40, "Occupational therapy consult")] };
    } },
    { label: "B: 79 M, pneumonia, stuck at supervision for 4 days, bedroom upstairs", build: (now) => {
      const docs = [
        note(now, 100, "Physiotherapy Assessment", "PT assessment. Prior to admission independent without aid, walks daily. Lives with wife in a two-storey house, bedroom upstairs with 14 steps. Transfers supervision. Ambulated 30 m with 4WW, standby assist, desaturated to 86% on room air, fatigue.", "C. Physio, PT"),
        note(now, 76, "Physiotherapy Progress Note", "Ambulated 30 m with rollator, SBA. SOB with exertion. Stairs deferred.", "C. Physio, PT"),
        note(now, 28, "Physiotherapy Progress Note", "Ambulated 35 m with 4WW, supervision. Fatigue limiting. Stairs not attempted. Recommend home with home support and 4WW for discharge if stairs managed.", "C. Physio, PT")];
      return { patient: pt(79, "male"), encounters: [enc(now, 120)], docs, conditions: [cond("Pneumonia", "J18.9"), cond("COPD", "J44.9")],
        obs: [obs(now, 6, "Ambulation assist level", "Standby assist"), num(now, 6, "Morse Fall Scale score", 35)], serviceRequests: [sr(now, 110, "Physiotherapy consult")] };
    } },
    { label: "C: 70 F, heart failure, no PT or OT yet", build: (now) => {
      const docs = [note(now, 8, "Nursing Shift Note", "Up to chair with 1 assist. Unsteady on feet, uses walker at home per daughter. Lives with daughter, 2 steps to enter.", "D. Nurse, RN")];
      return { patient: pt(70, "female"), encounters: [enc(now, 50)], docs, conditions: [cond("Heart failure", "I50.9"), cond("Atrial fibrillation", "I48.91")], obs: [num(now, 8, "Morse Fall Scale score", 50)], serviceRequests: [] };
    } },
    { label: "D: 65 M, cellulitis, independent and ready", build: (now) => {
      const docs = [note(now, 22, "Physiotherapy Assessment", "Baseline independent, no aid, lives with partner, 4 steps to enter. Ambulated 100 m independently, no aid. Stairs: managed 12 steps independently with one rail. No PT needs; safe for discharge home from a mobility point of view.", "E. Physio, PT")];
      return { patient: pt(65, "male"), encounters: [enc(now, 72)], docs, conditions: [cond("Cellulitis of right leg", "L03.115")], obs: [], serviceRequests: [sr(now, 30, "Physiotherapy consult", "completed")] };
    } }
  ];
})();
