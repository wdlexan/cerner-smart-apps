// forms.js — the list of forms. Each form is a definition: inputs + where they print.
//
// To add a form: put its blank PDF in this folder and add an entry to window.FORMS.
//
// Field types: text, date, time, textarea, radio, select, check, checks (multi), fixed (read-only).
// Pre-fill (src):  "pt.<x>"  from the chart  (fullName, last, first, initial, dob, sex, sexLabel,
//                  phn, mrn, street, city, province, postal, addressOneLine,
//                  homePhone, workPhone, mobile, email)
//                  "cfg.<x>" from config.js physician details   |  "today" | "now"
// Placement (put): { box:[x0,top,x1,bottom], size, fmt, text:(v)=>string } one line
//                  { lines:[box, box...] }  wraps over several lines
//                  { area:{x0,x1,top,bottom}, size } wraps in a block
//                  page: put.p (0 = first page). Coordinates are PDF points from the TOP-left.
// Check marks:     option.mark / field.mark = [x0,top,x1,bottom] of the printed box (option.marks = several boxes).
// span: grid width of the input in the app (1-4, default 2).

(function () {
    // box for text sitting on an underline from x0..x1 at height y
    const uline = (x0, x1, y) => [x0 + 2, y - 11, x1, y + 1];
    // Pulse checkbox from its top-left corner
    const pcb = (x, t) => [x, t - 1, x + 9.8, t + 9];
    const phnWithMrn = v => {
        const d = String(v.phn || "").replace(/\D/g, "");
        const phn = d.length === 10 ? `${d.slice(0, 4)} ${d.slice(4, 7)} ${d.slice(7)}` : (v.phn || "");
        return [phn, v.mrn ? `MRN: ${v.mrn}` : ""].filter(Boolean).join("   ");
    };

    window.FORMS = [
        // =====================================================================
        {
            id: "form41",
            title: "Form 4.1 – First Medical Certificate",
            description: "Mental Health Act involuntary admission (HLTH 3504.1)",
            category: "Mental Health Act",
            template: "Form4.1.pdf",
            filePrefix: "Form4.1",
            fileNameFrom: "patientName",
            footer: "Sign it, and add Date and Time Signed, by hand.",
            sections: [
                {
                    legend: "Person examined", fields: [
                        { id: "patientName", label: "First and last name", type: "text", src: "pt.fullName", required: true },
                        { id: "phn", label: "PHN (if available)", type: "text", src: "pt.phn", phn: true }
                    ]
                },
                {
                    legend: "Examination", fields: [
                        { id: "examSite", label: "Name and address of examination site", type: "text", src: "cfg.defaultExamSite", required: true, span: 4 },
                        { id: "siteType", label: "Site type", type: "radio", important: true, options: [
                            { value: "designated", label: "Designated Facility" }, { value: "other", label: "Other Site" }] },
                        { id: "police", label: "Brought by police under s.28?", type: "radio", important: true, options: [
                            { value: "yes", label: "Yes" }, { value: "no", label: "No" }] },
                        { id: "examDate", label: "Examination date", type: "date", src: "today", required: true },
                        { id: "examTime", label: "Examination time", type: "time", src: "now", hint: "Printed only if reasons continue on the back." }
                    ]
                },
                {
                    legend: "Reasons (leave blank to handwrite)", fields: [
                        { id: "reason1", label: "1. Disorder of the mind that requires treatment and seriously impairs ability to react to environment or associate with others", type: "textarea", important: true },
                        { id: "reason2", label: "2. Requires treatment in or through a designated facility", type: "textarea", important: true },
                        { id: "reason3", label: "3. Requires care, supervision and control to prevent substantial deterioration or to protect the person or others", type: "textarea", important: true },
                        { id: "reason4", label: "4. Cannot suitably be admitted as a voluntary patient", type: "textarea", important: true }
                    ]
                },
                {
                    legend: "Examining physician", fields: [
                        { id: "doc", label: "Physician", type: "fixed", src: "cfg.fullName", span: 4,
                          display: c => `${c.fullName} · ${c.phone} · College ID ${c.collegeId}` }
                    ]
                }
            ],
            // tested custom filler (handles the back page)
            fill: async (PDFLib, bytes, v, cfg) => {
                const r = await Form41.fill(PDFLib, bytes, {
                    ...v,
                    reasons: [v.reason1, v.reason2, v.reason3, v.reason4],
                    professional: "physician",
                    physicianName: cfg.physician.fullName,
                    physicianPhone: cfg.physician.phone,
                    collegeId: cfg.physician.collegeId
                });
                return { bytes: r.bytes, notes: r.continuedOnBack ? ["Reasons continue on the back page (box ticked)."] : [] };
            }
        },

        // =====================================================================
        {
            id: "bccancer",
            title: "BC Cancer – Patient Referral",
            description: "Referral / re-referral to a BC Cancer centre (revised 2 Mar 23)",
            category: "Referral",
            template: "BCCancerReferral.pdf",
            filePrefix: "BCCancerReferral",
            fileNameFrom: "lastName",
            footer: "Fax it with the referral letter, pathology and imaging reports.",
            sections: [
                {
                    legend: "Referral", fields: [
                        { id: "referralType", label: "Type", type: "radio", value: "referral", options: [
                            { value: "referral", label: "Referral" }, { value: "re", label: "Re-referral (seen at BCCA before)" }] },
                        { id: "referralDate", label: "Date of referral", type: "date", src: "today" },
                        { id: "centre", label: "Send to centre / clinic", type: "select", src: "cfg.defaultBCCancerCentre", options:
                            ["Abbotsford", "Kelowna", "Prince George", "Surrey", "Vancouver", "Victoria", "Kamloops", "Nanaimo", "Vernon"]
                                .map(c => ({ value: c, label: ["Kamloops", "Nanaimo", "Vernon"].includes(c) ? `${c} Clinic` : `BC Cancer - ${c}` })) },
                        { id: "oncologist", label: "Oncologist contacted (urgent)", type: "text" },
                        { id: "informed", label: "Patient informed of cancer diagnosis?", type: "radio", important: true, options: [
                            { value: "yes", label: "Yes" }, { value: "no", label: "No" }] },
                        { id: "diagnosis", label: "Clinical / pathological diagnosis", type: "text", important: true },
                        { id: "specialty", label: "Requested specialty (if known)", type: "text", span: 4 }
                    ]
                },
                {
                    legend: "Patient", fields: [
                        { id: "lastName", label: "Last name", type: "text", src: "pt.last", upper: true, required: true },
                        { id: "firstName", label: "First name", type: "text", src: "pt.first", upper: true, required: true },
                        { id: "initial", label: "Initial", type: "text", src: "pt.initial", upper: true, span: 1 },
                        { id: "sex", label: "Sex", type: "radio", src: "pt.sex", span: 1, options: [
                            { value: "male", label: "Male" }, { value: "female", label: "Female" }] },
                        { id: "dob", label: "Date of birth", type: "date", src: "pt.dob", required: true },
                        { id: "phn", label: "PHN", type: "text", src: "pt.phn", phn: true },
                        { id: "mrn", label: "MRN (printed after PHN)", type: "text", src: "pt.mrn" },
                        { id: "selfPay", label: "Self pay", type: "radio", value: "no", options: [
                            { value: "yes", label: "Yes" }, { value: "no", label: "No" }] },
                        { id: "street", label: "Street", type: "text", src: "pt.street" },
                        { id: "city", label: "City", type: "text", src: "pt.city", span: 1 },
                        { id: "province", label: "Province", type: "text", src: "pt.province", span: 1 },
                        { id: "postal", label: "Postal code", type: "text", src: "pt.postal", span: 1 },
                        { id: "homePhone", label: "Home phone", type: "text", src: "pt.homePhone", span: 1 },
                        { id: "workPhone", label: "Work phone", type: "text", src: "pt.workPhone", span: 1 },
                        { id: "contactPhone", label: "Contact / message phone", type: "text", src: "pt.mobile", span: 1 }
                    ]
                },
                {
                    legend: "Physicians", fields: [
                        { id: "doc", label: "Referring physician", type: "fixed", span: 4,
                          display: c => `${c.shortName} (College #${c.collegeId}) · ${c.phone} · Billing # ${c.msp}` },
                        { id: "familyName", label: "Family physician", type: "text" },
                        { id: "familyPhone", label: "Phone", type: "text", span: 1 },
                        { id: "familyBill", label: "Billing #", type: "text", span: 1 },
                        { id: "consultName", label: "Consultant", type: "text" },
                        { id: "consultPhone", label: "Phone", type: "text", span: 1 },
                        { id: "consultBill", label: "Billing #", type: "text", span: 1 }
                    ]
                },
                {
                    legend: "Procedures / imaging (up to 2)", fields: [
                        { id: "proc1", label: "Procedure / imaging", type: "text" },
                        { id: "proc1Hosp", label: "Hospital / office", type: "text", span: 1 },
                        { id: "proc1Date", label: "Date", type: "date", span: 1 },
                        { id: "proc2", label: "Procedure / imaging", type: "text" },
                        { id: "proc2Hosp", label: "Hospital / office", type: "text", span: 1 },
                        { id: "proc2Date", label: "Date", type: "date", span: 1 }
                    ]
                },
                {
                    legend: "Special patient needs", fields: [
                        { id: "accommodation", label: "Needs accommodation (CSI/VC/VIC only)", type: "check", span: 4 },
                        { id: "interpreter", label: "Needs interpreter", type: "check" },
                        { id: "interpreterSpec", label: "Language / dialect", type: "text" },
                        { id: "counseling", label: "Patient & family counseling referral", type: "check" },
                        { id: "counselReason", label: "Counseling reason", type: "text" },
                        { id: "otherNeeds", label: "Other special needs (sight, hearing, mobility, oxygen, MRSA, latex…) – about 25 words", type: "textarea", span: 4 },
                        { id: "hospitalBed", label: "Hospital bed required (contact BCCA oncologist)", type: "check" },
                        { id: "inFacility", label: "Patient currently in facility", type: "check" },
                        { id: "facilityName", label: "Facility name", type: "text", span: 4 }
                    ]
                }
            ],
            // tested custom filler
            fill: async (PDFLib, bytes, v, cfg) => {
                const r = await BCCancerForm.fill(PDFLib, bytes, {
                    ...v,
                    referring: `${cfg.physician.shortName} (College #${cfg.physician.collegeId})`,
                    referringPhone: cfg.physician.phone,
                    referringBill: cfg.physician.msp
                });
                return { bytes: r.bytes, notes: r.warnings };
            }
        },

        // =====================================================================
        {
            id: "pulse",
            title: "Pulse – Cardiology & Respirology Referral",
            description: "Pulse Complete Cardiac Care (Version: March 2026, fax 250-595-1000)",
            category: "Referral",
            template: "PulseCardioReferral.pdf",
            filePrefix: "PulseReferral",
            fileNameFrom: "patientName",
            footer: "Incomplete referrals may be returned. Heart Rhythm Management uses a separate Pulse form (pulsemd.ca/referring).",
            sections: [
                {
                    legend: "Referral", fields: [
                        { id: "date", label: "Date", type: "date", src: "today", put: { box: [62, 52, 205, 65], size: 10, fmt: "dmon" } },
                        { id: "urgency", label: "Urgency", type: "radio", important: true, options: [
                            { value: "urgent", label: "Urgent", mark: pcb(29.4, 256.1) },
                            { value: "semi", label: "Semi-urgent", mark: pcb(95.0, 256.1) },
                            { value: "non", label: "Non-urgent", mark: pcb(187.1, 256.1) }] },
                        { id: "faast", label: "FAAST (first available)", type: "radio", important: true, options: [
                            { value: "yes", label: "Yes", mark: pcb(29.4, 295.2) },
                            { value: "no", label: "No – specific doctor", mark: pcb(71.7, 295.2) }] },
                        { id: "specificDr", label: "Specific doctor (if FAAST No)", type: "text", put: { box: [214, 293, 322, 305], size: 8 } },
                        { id: "refType", label: "Referral type", type: "radio", important: true, span: 4, options: [
                            { value: "diag", label: "Diagnostic Testing Only", mark: pcb(29.4, 334.9) },
                            { value: "consult", label: "Specialist Consultation – Cardiology", mark: pcb(29.4, 386.2) },
                            { value: "resp", label: "Specialist Consultation – Respirologist", marks: [pcb(29.4, 414.0), pcb(174.7, 414.0)] }] },
                        { id: "tests", label: "Tests (Diagnostic Testing Only)", type: "checks", span: 4, options: [
                            { value: "treadmill", label: "Treadmill", mark: pcb(181.1, 334.9) },
                            { value: "h24", label: "24h Holter", mark: pcb(242.8, 334.9) },
                            { value: "h48", label: "48h Holter", mark: pcb(310.2, 334.9) },
                            { value: "d7", label: "7 Day Holter", mark: pcb(377.5, 334.9) },
                            { value: "ecg", label: "ECG", mark: pcb(453.0, 334.9) }] },
                        { id: "consultWith", label: "Cardiology consultation with", type: "checks", span: 4, options: [
                            { value: "cardiologist", label: "Cardiologist", mark: pcb(174.7, 386.2) },
                            { value: "im", label: "Internal Medicine (special interest in cardiology)", mark: pcb(247.5, 386.2) },
                            { value: "direct", label: "Direct Interventional (IM / CV surgeon referrers only)", mark: pcb(260.6, 436.0) }] }
                    ]
                },
                {
                    legend: "Patient", fields: [
                        { id: "patientName", label: "Patient name", type: "text", src: "pt.fullName", required: true, put: { box: [62, 130, 298, 143], size: 10 } },
                        { id: "phn", label: "PHN", type: "text", src: "pt.phn", phn: true, put: { box: [55, 144, 196, 157], size: 10, text: phnWithMrn } },
                        { id: "mrn", label: "MRN (printed after PHN)", type: "text", src: "pt.mrn" },
                        { id: "dob", label: "Date of birth", type: "date", src: "pt.dob", required: true, put: { box: [55, 157, 196, 170], size: 10, fmt: "dmon" } },
                        { id: "height", label: "Height (ft/in)", type: "text", span: 1, put: { box: [243, 144, 300, 157], size: 9 } },
                        { id: "weight", label: "Weight (lbs)", type: "text", span: 1, put: { box: [239, 157, 300, 170], size: 9 } },
                        { id: "gender", label: "Gender", type: "text", src: "pt.sexLabel", put: { box: [69, 170, 298, 183], size: 10 } },
                        { id: "address", label: "Address (one line)", type: "text", src: "pt.addressOneLine", span: 4, put: { box: [71, 184, 298, 197], size: 9 } },
                        { id: "homePhone", label: "Home phone", type: "text", src: "pt.homePhone", put: { box: [93, 197, 298, 210], size: 10 } },
                        { id: "cellPhone", label: "Cell phone", type: "text", src: "pt.mobile", put: { box: [83, 211, 298, 224], size: 10 } },
                        { id: "email", label: "Email", type: "text", src: "pt.email", span: 4, put: { box: [60, 224, 298, 237], size: 10 } }
                    ]
                },
                {
                    legend: "Referring practitioner", fields: [
                        { id: "refName", label: "Name", type: "fixed", src: "cfg.shortName", put: { box: [337, 130, 585, 143], size: 10 } },
                        { id: "refMsp", label: "MSP", type: "fixed", src: "cfg.msp", put: { box: [330, 144, 585, 157], size: 10 } },
                        { id: "refPhone", label: "Phone", type: "fixed", src: "cfg.phone", put: { box: [339, 170, 585, 183], size: 10 } },
                        { id: "refAddress", label: "Address", type: "text", src: "cfg.clinicAddress", put: { box: [346, 157, 585, 170], size: 9 } },
                        { id: "refFax", label: "Fax", type: "text", src: "cfg.fax", put: { box: [325, 184, 585, 197], size: 10 } },
                        { id: "walkIn", label: "Walk-in clinic", type: "text", put: { box: [448, 198, 585, 211], size: 8 } },
                        { id: "familyPhysician", label: "Family physician / NP", type: "text", span: 4, put: { box: [306, 225, 585, 238], size: 9 } }
                    ]
                },
                {
                    legend: "Reason for referral", fields: [
                        { id: "conditions", label: "Conditions", type: "checks", important: true, span: 4, options: [
                            { value: "palp", label: "Palpitations (include Holter)", mark: pcb(29.4, 508.2) },
                            { value: "syncope", label: "Syncope", mark: pcb(244.1, 508.2) },
                            { value: "hf", label: "Heart failure", mark: pcb(306.4, 508.2) },
                            { value: "valve", label: "Valve disease", mark: pcb(389.2, 508.2) },
                            { value: "cp", label: "Chest pain", mark: pcb(469.9, 508.2) },
                            { value: "rfm", label: "Cardiac risk factor modification", mark: pcb(29.4, 527.7) },
                            { value: "congenital", label: "Congenital heart disease", mark: pcb(193.0, 527.7) },
                            { value: "cad", label: "Coronary artery disease", mark: pcb(324.8, 527.7) },
                            { value: "other", label: "Other", mark: pcb(458.0, 527.7) }] },
                        { id: "otherCondition", label: "Other condition", type: "text", put: { box: [499, 527, 583, 539], size: 8 } },
                        { id: "details", label: "Details (6 lines on the form, about 110 words; required for respirology)", type: "textarea", important: true, span: 4,
                          put: { size: 9, lines: Array.from({ length: 6 }, (_, i) => [31, 557 + i * 12.4, 585, 568 + i * 12.4]) } },
                        { id: "attached", label: "Documents attached", type: "checks", important: true, span: 4, options: [
                            { value: "history", label: "History", mark: pcb(120.5, 651.2) },
                            { value: "ecg", label: "ECG", mark: pcb(121.6, 665.2) },
                            { value: "labs", label: "Recent labwork", mark: pcb(122.9, 679.2) },
                            { value: "meds", label: "Medication list", mark: pcb(122.2, 693.2) },
                            { value: "allergies", label: "Allergies", mark: pcb(121.7, 707.2) }] }
                    ]
                }
            ]
        },

        // =====================================================================
        {
            id: "gi",
            title: "GI Central Access & Triage – Referral",
            description: "Island gastroenterology referral (May 2021, secure fax 1-888-398-7091)",
            category: "Referral",
            template: "GIReferral.pdf",
            filePrefix: "GIReferral",
            fileNameFrom: "patientName",
            footer: "Incomplete referrals are rejected. Fax individually to 1-888-398-7091.",
            sections: [
                {
                    legend: "Referral", fields: [
                        { id: "referralDate", label: "Date of referral", type: "date", src: "today", put: { box: uline(120.2, 291.2, 223.5), fmt: "mdy" } },
                        { id: "previousOf", label: "Previous patient of", type: "text", put: { box: uline(412, 578.4, 224.2) } },
                        { id: "urgency", label: "Urgency (see guidelines on page 2)", type: "radio", important: true, options: [
                            { value: "urgent", label: "URGENT", mark: [131.4, 235.8, 140.8, 245.2] },
                            { value: "semi", label: "Semi-urgent", mark: [201.7, 235.8, 211.1, 245.2] },
                            { value: "non", label: "Non-urgent", mark: [201.7, 250.1, 211.1, 259.5] }] },
                        { id: "refType", label: "Type of referral", type: "radio", important: true, options: [
                            { value: "er", label: "Hospital ER", mark: [412.3, 243.4, 421.8, 252.8] },
                            { value: "new", label: "New", mark: [412.3, 258.7, 421.8, 268.2] },
                            { value: "re", label: "Re-referral", mark: [498.3, 243.4, 507.8, 252.8] },
                            { value: "second", label: "2nd Opinion", mark: [498.3, 258.7, 507.8, 268.2] }] },
                        { id: "seeing", label: "Specialist", type: "radio", important: true, options: [
                            { value: "first", label: "First available", mark: [321.7, 291.4, 331.1, 300.8] },
                            { value: "prefers", label: "Prefers to see", mark: [412.3, 291.4, 421.8, 300.8] }] },
                        { id: "prefersDr", label: "Preferred gastroenterologist", type: "text", put: { box: uline(491.8, 578.4, 299.6), size: 8 } }
                    ]
                },
                {
                    legend: "Patient", fields: [
                        { id: "patientName", label: "Patient name", type: "text", src: "pt.fullName", required: true, put: { box: uline(101, 291.2, 279.8) } },
                        { id: "dob", label: "Date of birth", type: "date", src: "pt.dob", required: true, put: { box: uline(120.2, 291.2, 298.5), fmt: "mdy" } },
                        { id: "sex", label: "Sex", type: "radio", src: "pt.sex", important: true, options: [
                            { value: "male", label: "M", mark: [34.6, 311.4, 44.0, 320.8] },
                            { value: "female", label: "F", mark: [71.5, 311.4, 81.0, 320.8] },
                            { value: "unknown", label: "U", mark: [104.6, 311.4, 114.0, 320.8] }] },
                        { id: "phn", label: "PHN", type: "text", src: "pt.phn", phn: true, important: true, put: { box: uline(61.7, 291.2, 340.8), text: phnWithMrn } },
                        { id: "mrn", label: "MRN (printed after PHN)", type: "text", src: "pt.mrn" },
                        { id: "address", label: "Address", type: "text", src: "pt.addressOneLine", span: 4,
                          put: { lines: [uline(79.3, 291.3, 359.0), uline(33.6, 291.3, 376.7)] } },
                        { id: "tel", label: "Tel", type: "text", src: "pt.homePhone", span: 1, put: { box: uline(56.7, 291.2, 393.7) } },
                        { id: "cell", label: "Cell", type: "text", src: "pt.mobile", span: 1, put: { box: uline(58.6, 291.2, 411.7) } },
                        { id: "altContact", label: "Alt contact", type: "text", put: { box: uline(94, 291.2, 430.6) } }
                    ]
                },
                {
                    legend: "Referring physician", fields: [
                        { id: "refMd", label: "Referring MD", type: "fixed", src: "cfg.shortName", put: { box: uline(387.2, 503, 322.1) } },
                        { id: "msp", label: "MSP #", type: "fixed", src: "cfg.msp", put: { box: uline(539.9, 578.4, 322.1) } },
                        { id: "clinicName", label: "Clinic name", type: "text", src: "cfg.clinicName", important: true, put: { box: uline(382.5, 578.4, 339.9) } },
                        { id: "clinicAddress", label: "Clinic address", type: "text", src: "cfg.clinicAddress", important: true,
                          put: { lines: [uline(393.8, 578.4, 358.1), uline(320.7, 578.4, 375.8)] } },
                        { id: "clinicFax", label: "Clinic fax", type: "text", src: "cfg.fax", important: true, span: 1, put: { box: uline(372.8, 578.4, 392.8) } },
                        { id: "clinicTel", label: "Clinic tel", type: "text", src: "cfg.phone", span: 1, put: { box: uline(372.8, 578.4, 410.8) } },
                        { id: "familyMd", label: "Family MD", type: "text", put: { box: uline(376.8, 578.4, 429.7) } }
                    ]
                },
                {
                    legend: "Reason for referral", fields: [
                        { id: "reason", label: "Reason for referral (write it here – not as a separate attachment)", type: "textarea", important: true, span: 4,
                          put: { size: 9, area: { x0: 36, x1: 576, top: 476, bottom: 626 } } }
                    ]
                },
                {
                    legend: "Clinical warnings", fields: [
                        { id: "warnings", label: "Tick all that apply (or NONE)", type: "checks", important: true, span: 4, options: [
                            { value: "none", label: "NONE", mark: [204.2, 640.9, 213.6, 650.3] },
                            { value: "anticoag", label: "Anticoagulant / antiplatelet", mark: [34.2, 659.5, 43.7, 669.0] },
                            { value: "icd", label: "ICD", mark: [34.2, 676.7, 43.7, 686.1] },
                            { value: "egfr", label: "eGFR < 60", mark: [34.2, 694.1, 43.7, 703.5] },
                            { value: "language", label: "Language barrier", mark: [34.2, 711.5, 43.7, 720.9] },
                            { value: "allergies", label: "Allergies", mark: [34.2, 728.9, 43.7, 738.3] },
                            { value: "other", label: "Other", mark: [34.2, 746.3, 43.7, 755.8] },
                            { value: "obesity", label: "Morbid obesity", mark: [204.2, 659.5, 213.6, 669.0] },
                            { value: "diabetes", label: "Diabetes", mark: [204.2, 676.7, 213.6, 686.1] },
                            { value: "cognitive", label: "Cognitive impairment", mark: [204.2, 694.1, 213.6, 703.5] },
                            { value: "mrsa", label: "MRSA", mark: [204.2, 711.5, 213.6, 720.9] },
                            { value: "vre", label: "VRE", mark: [250.7, 711.5, 260.1, 720.9] },
                            { value: "cdiff", label: "C.diff", mark: [289.4, 711.5, 298.8, 720.9] },
                            { value: "infectious", label: "Other infectious disease", mark: [204.2, 728.9, 213.6, 738.3] },
                            { value: "mobility", label: "Mobility impairment", mark: [204.2, 746.3, 213.6, 755.8] }] },
                        { id: "languageText", label: "Language", type: "text", span: 1, put: { box: uline(125, 194.6, 719.7), size: 8 } },
                        { id: "allergiesText", label: "Allergies", type: "text", span: 1, put: { box: uline(88.8, 194.6, 737.1), size: 8 } },
                        { id: "otherWarning", label: "Other warning", type: "text", span: 2, put: { box: uline(77.7, 194.6, 754.5), size: 8 } }
                    ]
                },
                {
                    legend: "Supporting documents", fields: [
                        { id: "supporting", label: "Supporting documents (bloodwork, imaging, path, letters)", type: "radio", important: true, options: [
                            { value: "attached", label: "Attached", mark: [354.7, 672.0, 364.1, 681.4] },
                            { value: "none", label: "NONE", mark: [425.3, 672.0, 434.8, 681.4] }] },
                        { id: "pending", label: "Pending", type: "check", mark: [354.7, 690.8, 364.1, 700.2] },
                        { id: "pendingText", label: "Pending tests", type: "text", put: { box: uline(409, 578.7, 698.9), size: 8 } },
                        { id: "medHx", label: "Relevant medical history", type: "radio", important: true, options: [
                            { value: "attached", label: "Attached", mark: [475.9, 718.5, 485.3, 727.9] },
                            { value: "none", label: "NONE", mark: [537.6, 718.5, 547.0, 727.9] }] },
                        { id: "meds", label: "Current medications", type: "radio", important: true, options: [
                            { value: "attached", label: "Attached", mark: [475.9, 746.6, 485.3, 756.0] },
                            { value: "none", label: "NONE", mark: [537.6, 746.6, 547.0, 756.0] }] }
                    ]
                }
            ]
        }
    ];
})();
