/* MADE-UP patients for testing the Asplenia tab. Times are relative to "now" (h = hours ago). None of these are real people. */
(function () {
  const DAY = 864e5, YEAR = 365.25 * DAY;
  const iso = (now, h) => new Date(now - h * 36e5).toISOString();
  const isoY = (now, y) => new Date(now - y * YEAR).toISOString().slice(0, 10);
  const ob = (cat) => (now, loinc, disp, val, unit, h) => ({ resourceType: "Observation", status: "final", category: [{ coding: [{ code: cat }] }],
    code: { coding: loinc ? [{ system: "http://loinc.org", code: loinc, display: disp }] : [], text: disp }, effectiveDateTime: iso(now, h), valueQuantity: { value: val, unit } });
  const lab = ob("laboratory"), vit = ob("vital-signs");
  const qual = (now, disp, text, h) => ({ resourceType: "Observation", status: "final", category: [{ coding: [{ code: "laboratory" }] }], code: { text: disp }, effectiveDateTime: iso(now, h), valueString: text });
  const rep = (now, disp, conclusion, h) => ({ resourceType: "DiagnosticReport", status: "final", code: { text: disp }, effectiveDateTime: iso(now, h), issued: iso(now, h), conclusion });
  const req = (name, status, hAgo) => ({ resourceType: "MedicationRequest", status: status || "active", authoredOn: hAgo != null ? iso(Date.now(), hAgo) : undefined, medicationCodeableConcept: { text: name }, dosageInstruction: [{ text: name }] });
  const cond = (text, code) => ({ resourceType: "Condition", clinicalStatus: { coding: [{ code: "active" }] }, code: { coding: code ? [{ system: "http://hl7.org/fhir/sid/icd-10", code }] : [], text } });
  const proc = (text, daysAgo, status) => ({ resourceType: "Procedure", status: status || "completed", code: { text }, performedDateTime: new Date(Date.now() - daysAgo * DAY).toISOString() });
  const alg = (text, reaction, crit) => ({ resourceType: "AllergyIntolerance", clinicalStatus: { coding: [{ code: "active" }] }, criticality: crit || "low", code: { text }, reaction: [{ manifestation: [{ text: reaction }] }] });
  const imm = (now, text, yearsAgo) => ({ resourceType: "Immunization", status: "completed", vaccineCode: { text }, occurrenceDateTime: isoY(now, yearsAgo) });
  const pt = (age, gender) => ({ resourceType: "Patient", gender, birthDate: new Date(Date.now() - age * YEAR - 30 * DAY).toISOString().slice(0, 10) });
  const enc = (daysAgo) => ({ resourceType: "Encounter", period: { start: new Date(Date.now() - daysAgo * DAY).toISOString() } });
  const vitals = (now, o) => [vit(now, "8310-5", "Temperature", o.t, "Cel", 2), vit(now, "8867-4", "Heart rate", o.hr, "/min", 2), vit(now, "8480-6", "Systolic BP", o.sbp, "mm[Hg]", 2),
    vit(now, "8462-4", "Diastolic BP", o.dbp, "mm[Hg]", 2), vit(now, "9279-1", "Respiratory rate", o.rr, "/min", 2), vit(now, "59408-5", "SpO2", o.spo2 || 94, "%", 2), vit(now, "29463-7", "Weight", o.wt, "kg", 20)];
  const labs = (now, o) => [lab(now, "6690-2", "WBC", o.wbc, "10*9/L", 6), lab(now, "777-3", "Platelets", o.plt, "10*9/L", 6), lab(now, "718-7", "Hemoglobin", o.hb || 128, "g/L", 6),
    lab(now, "2160-0", "Creatinine", o.cr, "umol/L", 6), lab(now, "22664-7", "Urea", o.urea, "mmol/L", 6), o.lac ? lab(now, "2524-7", "Lactate", o.lac, "mmol/L", 5) : null,
    o.inr ? lab(now, "6301-6", "INR", o.inr, "", 6) : null, lab(now, "1988-5", "CRP", o.crp || 140, "mg/L", 6)].filter(Boolean);

  window.ASPLENIA_SAMPLES = [
    { label: "A: 62 M, trauma splenectomy 2009, community pneumonia on the ward; PPV23 and Men-C only",
      sit: { reason: "pneumonia", setting: "ward" },
      build: (now) => ({ patient: pt(62, "male"), encounter: enc(1),
        conditions: [cond("Acquired absence of spleen", "Z90.81"), cond("Community acquired pneumonia", "J18.9"), cond("Hypertension", "I10")],
        procedures: [proc("Splenectomy (trauma, MVC)", 16.5 * 365)],
        obs: vitals(now, { t: 38.9, hr: 108, sbp: 118, dbp: 72, rr: 24, wt: 86 }).concat(labs(now, { wbc: 17.2, plt: 410, cr: 98, urea: 8.4, lac: 2.3 }), [qual(now, "Influenza A/B PCR", "Influenza A not detected; Influenza B not detected", 4)]),
        reports: [rep(now, "XR Chest PA and lateral", "Right lower lobe consolidation. Small right effusion.", 8)],
        medreqs: [req("Ceftriaxone 1 g IV q24h", "active", 6), req("Ramipril 5 mg PO daily")],
        allergies: [], imms: [imm(now, "Pneumovax 23 (PPV23)", 10), imm(now, "Menjugate (Men-C-C)", 16.4), imm(now, "Act-HIB", 16.4), imm(now, "Influenza vaccine (Fluzone)", 1.2)] }) },
    { label: "B: 45 F, splenectomy for ITP 8 days ago, platelets 980, no vaccines yet; childhood rash to amoxicillin",
      sit: { reason: "other" },
      build: (now) => ({ patient: pt(45, "female"), encounter: enc(9),
        conditions: [cond("Immune thrombocytopenia (ITP), refractory", "D69.3"), cond("Status post laparoscopic splenectomy")],
        procedures: [proc("Laparoscopic splenectomy", 8)],
        obs: vitals(now, { t: 37.2, hr: 84, sbp: 126, dbp: 78, rr: 16, wt: 68 }).concat(labs(now, { wbc: 13.1, plt: 980, cr: 64, urea: 4.1 }), [qual(now, "Peripheral blood smear", "Howell-Jolly bodies present. Target cells. Thrombocytosis.", 20)]),
        reports: [], medreqs: [req("Enoxaparin 40 mg subcut daily"), req("Hydromorphone 1 mg PO q4h PRN pain")],
        allergies: [alg("Amoxicillin", "rash as a child", "low")], imms: [] }) },
    { label: "C: 38 M, sickle cell disease (HbSS), septic shock with pneumonia; penicillin anaphylaxis; Menactra x2 2012, Bexsero x1",
      sit: { reason: "pneumonia", setting: "icu", shock: true },
      build: (now) => ({ patient: pt(38, "male"), encounter: enc(0.3),
        conditions: [cond("Sickle cell anemia HbSS", "D57.1"), cond("Acute chest syndrome, history"), cond("Pneumonia", "J18.9")],
        procedures: [],
        obs: vitals(now, { t: 39.6, hr: 132, sbp: 84, dbp: 48, rr: 32, spo2: 88, wt: 72 }).concat(labs(now, { wbc: 24.8, plt: 88, hb: 71, cr: 142, urea: 11.2, lac: 4.6, inr: 1.7 })),
        reports: [rep(now, "XR Chest portable", "Bilateral lower lobe airspace disease, worse on the left.", 1)],
        medreqs: [req("Hydroxyurea 1000 mg PO daily"), req("Folic acid 1 mg PO daily")],
        allergies: [alg("Penicillin", "anaphylaxis, throat swelling", "high")],
        imms: [imm(now, "Prevnar 13 (PCV13)", 30), imm(now, "Pneumovax 23", 7), imm(now, "Menactra (MenACWY-D)", 14), imm(now, "Menactra (MenACWY-D)", 13.8), imm(now, "Bexsero (4CMenB)", 1.5), imm(now, "Act-HIB", 30)] }) },
    { label: "D: 70 F, lymphoma, splenectomy 14 months ago, rituximab 3 months ago; influenza A pneumonia, CrCl about 35",
      sit: { reason: "pneumonia", setting: "ward" },
      build: (now) => ({ patient: pt(70, "female"), encounter: enc(1),
        conditions: [cond("Splenic marginal zone lymphoma", "C83.0"), cond("Asplenia (post splenectomy)", "D73.0"), cond("Chronic kidney disease stage 3b", "N18.32")],
        procedures: [proc("Open splenectomy", 425)],
        obs: vitals(now, { t: 38.4, hr: 98, sbp: 132, dbp: 70, rr: 22, wt: 58 }).concat(labs(now, { wbc: 6.2, plt: 210, cr: 118, urea: 9.1 }), [qual(now, "Influenza A/B PCR", "Influenza A DETECTED", 5)]),
        reports: [rep(now, "XR Chest", "Patchy left lower lobe opacity.", 6)],
        medreqs: [req("Rituximab 375 mg/m2 IV", "completed", 90 * 24), req("Penicillin V 300 mg PO BID"), req("Pantoprazole 40 mg PO daily")],
        allergies: [],
        imms: [imm(now, "Prevnar 20 (PCV20)", 1.3), imm(now, "Menveo (MenACWY-CRM)", 1.3), imm(now, "Menveo (MenACWY-CRM)", 1.1), imm(now, "Bexsero (4CMenB)", 1.3), imm(now, "Bexsero (4CMenB)", 1.2), imm(now, "Act-HIB", 1.3), imm(now, "Fluzone High-Dose", 0.1)] }) },
    { label: "E: 54 M, celiac disease and alcohol-related cirrhosis, Howell-Jolly bodies on smear; pneumonia; SJS to amoxicillin",
      sit: { reason: "pneumonia", setting: "ward" },
      build: (now) => ({ patient: pt(54, "male"), encounter: enc(0.5),
        conditions: [cond("Celiac disease", "K90.0"), cond("Alcoholic cirrhosis of liver", "K70.3"), cond("Pneumonia, right middle lobe", "J18.1")],
        procedures: [],
        obs: vitals(now, { t: 38.7, hr: 104, sbp: 104, dbp: 62, rr: 26, wt: 70 }).concat(labs(now, { wbc: 14.6, plt: 96, cr: 76, urea: 5.2, inr: 1.6, lac: 2.1 }), [qual(now, "Blood film review", "Howell-Jolly bodies seen. Acanthocytes. Mild macrocytosis.", 10)]),
        reports: [rep(now, "CT abdomen", "Cirrhotic liver. Small atrophic spleen. Moderate ascites.", 24 * 60)],
        medreqs: [req("Lactulose 30 mL PO TID"), req("Thiamine 100 mg PO daily")],
        allergies: [alg("Amoxicillin", "Stevens-Johnson syndrome (2016)", "high")], imms: [imm(now, "Influenza vaccine", 3)] }) },
    { label: "F: 33 F, hereditary spherocytosis, elective splenectomy planned in 20 days; admitted with hemolysis",
      sit: { reason: "other", plannedDays: 20 },
      build: (now) => ({ patient: pt(33, "female"), encounter: enc(2),
        conditions: [cond("Hereditary spherocytosis", "D58.0"), cond("Cholelithiasis", "K80.20")],
        procedures: [],
        obs: vitals(now, { t: 37.0, hr: 92, sbp: 112, dbp: 70, rr: 16, wt: 61 }).concat(labs(now, { wbc: 9.0, plt: 260, hb: 82, cr: 58, urea: 3.5 })),
        reports: [rep(now, "US abdomen", "Splenomegaly 17 cm. Gallstones.", 30)],
        medreqs: [req("Folic acid 5 mg PO daily")], allergies: [], imms: [imm(now, "Influenza vaccine (Flulaval)", 0.15), imm(now, "Spikevax COVID-19", 1.1)] }) },
    { label: "G: 59 M, splenectomy 2018, PNH on eculizumab, dog bite on the hand, febrile",
      sit: { reason: "sepsis", setting: "ward", dog: true },
      build: (now) => ({ patient: pt(59, "male"), encounter: enc(0.2),
        conditions: [cond("Paroxysmal nocturnal hemoglobinuria", "D59.5"), cond("History of splenectomy", "Z90.81"), cond("Dog bite, left hand", "W54")],
        procedures: [proc("Splenectomy", 8 * 365)],
        obs: vitals(now, { t: 38.6, hr: 112, sbp: 102, dbp: 64, rr: 22, wt: 80 }).concat(labs(now, { wbc: 3.1, plt: 74, cr: 90, urea: 6.0, lac: 3.1, inr: 1.4 })),
        reports: [], medreqs: [req("Eculizumab 900 mg IV every 2 weeks"), req("Penicillin V 300 mg PO BID")], allergies: [],
        imms: [imm(now, "PCV20", 2), imm(now, "MenQuadfi", 7.5), imm(now, "MenQuadfi", 7.3), imm(now, "Trumenba", 7.5), imm(now, "Trumenba", 7.4), imm(now, "Trumenba", 7.0), imm(now, "Hib", 8)] }) }];
})();
