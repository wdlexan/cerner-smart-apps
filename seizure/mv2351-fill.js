/* Fills RoadSafetyBC MV2351 "Report of a Condition Affecting Fitness and Ability to Drive" (form version 20180413, 2022 PDF).
   Works in the browser (window.MV2351Fill) and in Node (module.exports). Needs pdf-lib.
   Field names below were read from the PDF's form fields; checkbox meanings were matched by position on page 1. */
(function (root) {
  const BOX = {
    family: "Check Box1", specialist: "Check Box3", psychologist: "Check Box5", np: "Check Box2", optometrist: "Check Box4", other: "Check Box6",
    opinionRisk: "Check Box7",        // IN MY OPINION THIS PATIENT HAS A MEDICAL CONDITION THAT PUTS THE PUBLIC OR THEMSELVES AT RISK
    continuesToDrive: "Check Box8",   // THIS PATIENT CONTINUES TO DRIVE AFTER BEING WARNED OF THE DANGER
    impCognitive: "Check Box9", impVision: "Check Box10", impMotor: "Check Box11", impSudden: "Check Box12", impOther: "Check Box13",
    sevMild: "Check Box14", sevModerate: "Check Box15", sevSevere: "Check Box16",
    recCancel: "Check Box17", recMedical: "Check Box18", recDriving: "Check Box19"
  };
  const TEXT = {
    name: "Name of Patient", address: "Address of Patient", city: "City of Patient", postal: "Postal Code of Patient",
    dob: "Date of Birth of Patient", licence: "Drivers Licence Number of Patient",
    clinician: "Name and Phone #, Stamp or Sticker", clinicianPhone: "Phone # of Clinician", fax: "Enter Fax Number to receive confirmation",
    otherQual: "Other Qualification(s)", lengthOfCare: "Length of Care",
    mmse: "Cognitive Impairment  Screening scores ie MMSE", moca: "M0CA", trailsB: "Trails B", otherScore: "Other Screening Score",
    details: "Details of medical condition or functional impairment impacting driving including if relevant level of insight and judgement 1",
    further: "Further Recommendations", date: "Date", signature: "Signature"
  };
  const DETAILS_MAX = 520, FURTHER_MAX = 420; // what fits legibly in the boxes; the full text goes on an attached page

  function setText(form, name, value, size) {
    if (value === undefined || value === null) return;
    try { const f = form.getTextField(name); f.setText(String(value)); if (size) f.setFontSize(size); } catch (e) { console.warn("Field not set:", name, e.message); }
  }
  function setBox(form, name, on) { try { const b = form.getCheckBox(name); on ? b.check() : b.uncheck(); } catch (e) { console.warn("Box not set:", name, e.message); } }
  function wrap(font, text, size, width) {
    const out = [];
    for (const para of String(text).split("\n")) {
      let line = "";
      for (const w of para.split(/\s+/)) {
        const t = line ? line + " " + w : w;
        if (font.widthOfTextAtSize(t, size) > width && line) { out.push(line); line = w; } else line = t;
      }
      out.push(line);
    }
    return out;
  }
  function clip(s, n) { s = String(s || ""); return s.length <= n ? s : s.slice(0, n - 40).replace(/\s+\S*$/, "") + " ... (continued on attached page)"; }

  /**
   * d = { patient:{name, address, city, postal, dob, licence}, clinician:{name, phone, fax, qual:'family'|'specialist'|'np'|'other', otherQual, lengthOfCare},
   *       boxes:{opinionRisk, continuesToDrive, impSudden, impMotor, impCognitive, impVision, impOther, recCancel, recMedical, recDriving},
   *       details, further, date, attachTitle }
   */
  async function fillMV2351(PDFLib, templateBytes, d) {
    const doc = await PDFLib.PDFDocument.load(templateBytes);
    const form = doc.getForm();
    const p = d.patient || {}, c = d.clinician || {}, b = d.boxes || {};
    setText(form, TEXT.name, p.name || ""); setText(form, TEXT.address, p.address || ""); setText(form, TEXT.city, p.city || "");
    setText(form, TEXT.postal, p.postal || ""); setText(form, TEXT.dob, p.dob || ""); setText(form, TEXT.licence, p.licence || "");
    setText(form, TEXT.clinician, c.name || ""); setText(form, TEXT.clinicianPhone, c.phone || ""); setText(form, TEXT.fax, c.fax || "");
    setText(form, TEXT.lengthOfCare, c.lengthOfCare || "", 8);
    ["family", "specialist", "np", "other"].forEach(k => setBox(form, BOX[k], c.qual === k));
    setText(form, TEXT.otherQual, c.qual === "other" ? (c.otherQual || "") : "", 7);
    Object.keys(b).forEach(k => { if (BOX[k]) setBox(form, BOX[k], !!b[k]); });
    const longDetails = String(d.details || "").length > DETAILS_MAX, longFurther = String(d.further || "").length > FURTHER_MAX;
    setText(form, TEXT.details, clip(d.details, DETAILS_MAX), 7);
    setText(form, TEXT.further, clip(d.further, FURTHER_MAX), 7);
    setText(form, TEXT.date, d.date || "", 9);
    setText(form, TEXT.signature, ""); // signed by hand

    if (longDetails || longFurther || d.alwaysAttach) {
      const font = await doc.embedFont(PDFLib.StandardFonts.Helvetica), bold = await doc.embedFont(PDFLib.StandardFonts.HelveticaBold);
      let page = doc.addPage([612, 792]), y = 750;
      const line = (t, f, s, gap) => { if (y < 50) { page = doc.addPage([612, 792]); y = 750; } page.drawText(t, { x: 50, y, size: s, font: f }); y -= gap; };
      line(d.attachTitle || "Attachment to MV2351 - Report of a Condition Affecting Fitness and Ability to Drive", bold, 11, 18);
      line(`Patient: ${p.name || ""}   DOB: ${p.dob || ""}   Driver's licence: ${p.licence || "not known"}`, font, 9, 14);
      line(`Reporting clinician: ${c.name || ""}   Phone: ${c.phone || ""}   Date: ${d.date || ""}`, font, 9, 22);
      for (const [title, body] of [["Details of medical condition / functional impairment", d.details], ["Further recommendations", d.further]]) {
        if (!body) continue;
        line(title, bold, 10, 15);
        wrap(font, body, 9, 512).forEach(t => line(t, font, 9, 12));
        y -= 10;
      }
    }
    form.updateFieldAppearances();
    return await doc.save();
  }

  const api = { fillMV2351, BOX, TEXT };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.MV2351Fill = api;
})(typeof window !== "undefined" ? window : globalThis);
