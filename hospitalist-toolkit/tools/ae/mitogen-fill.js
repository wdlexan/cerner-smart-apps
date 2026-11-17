/* Fills the MitogenDx "Outside of Alberta Test Requisition Form" (2025).
   Works in the browser (window.MitogenFill) and in Node (module.exports). Needs pdf-lib. */
(function (root) {
  // Checkbox field names in the PDF, mapped to the tests printed beside them.
  const TESTS = [
    { field: 'encep1', label: 'Anti-NMDA (NR1) receptor', group: 'Encephalitis', def: true },
    { field: 'encep3', label: 'Anti-VGKC complex: LGI1 & CASPR2', group: 'Encephalitis', def: true },
    { field: 'encep4', label: 'Anti-GABA-B receptor', group: 'Encephalitis', def: true },
    { field: 'encep5', label: 'Anti-AMPA receptor', group: 'Encephalitis', def: true },
    { field: 'encep2', label: 'Anti-DPPX', group: 'Encephalitis', def: true },
    { field: 'can2', label: 'Paraneoplastic Disease Panel PLUS (Hu, Yo, Ri, Ma2, CV2, amphiphysin, SOX1, GAD65, Tr, ...)', group: 'Cancer', def: true },
    { field: 'can1', label: 'Cancer-associated autoantibody panel (LDT)', group: 'Cancer', def: false },
    { field: 'sleepother 1', label: 'Anti-IgLON5 (sleep disorder, bulbar, gait)', group: 'Other', def: false },
    { field: 'neuro4', label: 'Anti-GAD65 (standalone titre)', group: 'Neuro', def: false },
    { field: 'neuro2', label: 'NMOSD panel: AQP4 & MOG', group: 'Neuro', def: false },
    { field: 'neuro6', label: 'High-sensitivity neurofilament light chain (LDT)', group: 'Neuro', def: false },
    { field: 'GLS1', label: 'Advanced ANA (HEp-2)', group: 'General', def: false }
  ];

  const SAMPLE_BOX = { serum: 'serum', plasma: 'plasma', csf: 'csf' };

  function setText(form, name, value) {
    if (value === undefined || value === null) return;
    try { form.getTextField(name).setText(String(value)); } catch (e) { console.warn('Field not set:', name, e.message); }
  }
  function setBox(form, name, on) {
    try { const b = form.getCheckBox(name); on ? b.check() : b.uncheck(); } catch (e) { console.warn('Box not set:', name, e.message); }
  }

  /**
   * d = { patient:{surname, first, sex:'female'|'male'|'', phn, dob}, physician:{name, phone, fax, email, comments},
   *       lab:{name, address, phone, fax, email}, sample:{type:'serum'|'csf'|'plasma', collected, ref, comments},
   *       tests:[field names], page2Comments }
   */
  async function fillMitogen(PDFLib, templateBytes, d) {
    const doc = await PDFLib.PDFDocument.load(templateBytes);
    const form = doc.getForm();
    const p = d.patient || {}, ph = d.physician || {}, lab = d.lab || {}, s = d.sample || {};

    setText(form, 'patient last name', p.surname || '');
    setText(form, 'patient first name', p.first || '');
    setText(form, 'Patient health care number', p.phn || '');
    setText(form, 'Patient date of birth', p.dob || '');
    setText(form, 'patient name', [p.surname, p.first].filter(Boolean).join(', '));
    setBox(form, 'Female', p.sex === 'female');
    setBox(form, 'male', p.sex === 'male');

    setText(form, 'Physician name', ph.name || '');
    setText(form, 'Physician phone number', ph.phone || '');
    setText(form, 'Physician fax number', ph.fax || '');
    setText(form, 'Physician email address', ph.email || '');
    setText(form, 'Physician name comments', ph.comments || '');

    setText(form, 'Laboratory name', lab.name || '');
    setText(form, 'referring lab address', lab.address || '');
    setText(form, 'Laboratory phone number', lab.phone || '');
    setText(form, 'Laboratory fax number', lab.fax || '');
    setText(form, 'Laboratory email address', lab.email || '');

    Object.values(SAMPLE_BOX).forEach(f => setBox(form, f, f === SAMPLE_BOX[s.type]));
    setText(form, 'sample date and time collected', s.collected || '');
    setText(form, 'Ordering lab reference #', s.ref || '');
    setText(form, 'sample information comments', s.comments || '');

    const want = new Set(d.tests || []);
    TESTS.forEach(t => setBox(form, t.field, want.has(t.field)));
    setText(form, 'Page 2 comments box', d.page2Comments || '');

    return await doc.save();
  }

  const api = { fillMitogen, TESTS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.MitogenFill = api;
})(typeof window !== 'undefined' ? window : globalThis);
