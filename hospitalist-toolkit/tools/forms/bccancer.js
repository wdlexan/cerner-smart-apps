// bccancer.js — writes data onto the flat BC Cancer Patient Referral Form ("revised 2 Mar 23").
// Boxes are [x0, top, x1, bottom] in PDF points, measured from the TOP of the page (612 x 792).
// Works in the browser (window.BCCancerForm) and in Node (module.exports) for testing.

(function (root) {
    const PAGE_H = 792;

    // ---- text boxes: [x0, top, x1, bottom], default font size ----
    const T = {
        referralDate:   [[446, 97, 590, 110], 9],
        oncologist:     [[315, 156, 555, 169], 9],
        diagnosis:      [[245, 235, 537, 247], 9],
        specialty:      [[234, 247, 537, 259], 9],
        lastName:       [[115, 275, 205, 289], 10],
        firstName:      [[215, 275, 300, 289], 10],
        initial:        [[310, 275, 345, 289], 10],
        dobDay:         [[520, 276, 537, 289], 8],
        dobMonth:       [[543, 276, 561, 289], 8],
        dobYear:        [[567, 276, 600, 289], 8],
        phnLine:        [[112, 304, 390, 316], 10],
        street:         [[118, 328, 250, 341], 10],
        city:           [[265, 328, 350, 341], 10],
        province:       [[425, 328, 490, 341], 10],
        postal:         [[505, 328, 580, 341], 10],
        homePhone:      [[133, 353, 233, 365], 9],
        workPhone:      [[283, 353, 395, 365], 9],
        contactPhone:   [[489, 353, 600, 365], 9],
        referring:      [[154, 368, 325, 380], 8],
        referringPhone: [[359, 368, 465, 380], 9],
        referringBill:  [[501, 368, 600, 380], 9],
        familyName:     [[146, 384, 323, 396], 9],
        familyPhone:    [[359, 384, 465, 396], 9],
        familyBill:     [[501, 384, 600, 396], 9],
        consultName:    [[124, 400, 323, 412], 9],
        consultPhone:   [[359, 400, 465, 412], 9],
        consultBill:    [[501, 400, 600, 412], 9],
        proc1:          [[78, 434, 290, 447], 8],
        proc1Hosp:      [[296, 434, 494, 447], 8],
        proc1Date:      [[500, 434, 590, 447], 8],
        proc2:          [[78, 450, 290, 463], 8],
        proc2Hosp:      [[296, 450, 494, 463], 8],
        proc2Date:      [[500, 450, 590, 463], 8],
        interpreterSpec:[[303, 488, 400, 499], 8],
        counselReason:  [[448, 489, 582, 500], 8],
        facilityName:   [[386, 556, 582, 566], 8]
    };
    const OTHER_NEEDS = [[83, 516, 585, 527], [83, 529, 585, 540]];

    // ---- checkboxes: [x0, top, x1, bottom] ----
    const C = {
        referral:      [73.1, 98.5, 82.3, 107.8],
        reReferral:    [133.6, 98.5, 142.8, 107.8],
        informedYes:   [397.1, 223.6, 406.4, 232.8],
        informedNo:    [469.2, 223.6, 478.4, 232.8],
        male:          [413.4, 277.2, 422.6, 286.5],
        female:        [447.2, 277.2, 456.4, 286.5],
        selfPayYes:    [470.4, 303.8, 479.6, 313.0],
        selfPayNo:     [515.4, 304.0, 524.6, 313.2],
        accommodation: [84.3, 485.1, 93.5, 494.4],
        interpreter:   [273.3, 479.5, 282.5, 488.7],
        counseling:    [417.3, 479.0, 426.6, 488.2],
        hospitalBed:   [84.3, 549.4, 93.5, 558.7],
        inFacility:    [363.3, 543.3, 372.6, 552.5]
    };
    const CENTRES = {
        Abbotsford: 625.2, Kelowna: 634.3, "Prince George": 643.5, Surrey: 652.8,
        Vancouver: 661.9, Victoria: 671.1, Kamloops: 680.4, Nanaimo: 689.5, Vernon: 698.7
    };

    // ---- helpers ----
    function toDMY(iso) {
        if (!iso) return "";
        const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
        return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
    }
    function clean(s) {
        return String(s || "")
            .replace(/[‘’]/g, "'")
            .replace(/[“”]/g, '"')
            .replace(/[–—]/g, "-")
            .replace(/…/g, "...")
            .replace(/\s*\n\s*/g, ", ")
            .replace(/\t/g, " ")
            .replace(/[^\x20-\x7E\xA0-\xFF]/g, "?")
            .trim();
    }
    function wrap(text, font, size, maxW) {
        const out = [];
        let line = "";
        for (const w of clean(text).split(/\s+/).filter(Boolean)) {
            const t = line ? `${line} ${w}` : w;
            if (font.widthOfTextAtSize(t, size) <= maxW || !line) line = t;
            else { out.push(line); line = w; }
        }
        if (line) out.push(line);
        return out;
    }

    async function fill(PDFLib, templateBytes, d) {
        const { PDFDocument, StandardFonts, rgb } = PDFLib;
        const pdf = await PDFDocument.load(templateBytes);
        const font = await pdf.embedFont(StandardFonts.Helvetica);
        const page = pdf.getPages()[0];
        const ink = rgb(0, 0, 0);
        const warnings = [];

        const text = (key, value) => {
            const str = clean(value);
            if (!str) return;
            const [[x0, , x1, bottom], size0] = T[key];
            const maxW = x1 - x0 - 2;
            let s = size0;
            while (s > 6 && font.widthOfTextAtSize(str, s) > maxW) s -= 0.5;
            if (font.widthOfTextAtSize(str, s) > maxW) warnings.push(`"${key}" is too long and may run past its box.`);
            page.drawText(str, { x: x0 + 1, y: PAGE_H - (bottom - 2.5), size: s, font, color: ink });
        };
        const x = (box) => {
            if (!box) return;
            const [x0, top, x1, bottom] = box;
            const size = 7;
            const w = font.widthOfTextAtSize("X", size);
            const cx = (x0 + x1) / 2, cmid = (top + bottom) / 2;
            page.drawText("X", { x: cx - w / 2, y: PAGE_H - cmid - size * 0.35, size, font, color: ink });
        };

        // header
        x(d.referralType === "re" ? C.reReferral : C.referral);
        text("referralDate", toDMY(d.referralDate));
        text("oncologist", d.oncologist);
        if (d.informed === "yes") x(C.informedYes);
        if (d.informed === "no") x(C.informedNo);
        text("diagnosis", d.diagnosis);
        text("specialty", d.specialty);

        // patient
        text("lastName", d.lastName);
        text("firstName", d.firstName);
        text("initial", d.initial);
        if (d.sex === "male") x(C.male);
        if (d.sex === "female") x(C.female);
        const dob = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d.dob || "");
        if (dob) { text("dobDay", dob[3]); text("dobMonth", dob[2]); text("dobYear", dob[1]); }

        const phnDigits = String(d.phn || "").replace(/\D/g, "");
        const phnShown = phnDigits.length === 10
            ? `${phnDigits.slice(0, 4)} ${phnDigits.slice(4, 7)} ${phnDigits.slice(7)}`
            : (d.phn || "");
        if (d.phn && !/^9\d{9}$/.test(phnDigits)) warnings.push("PHN is not 10 digits starting with 9. Check it.");
        text("phnLine", [phnShown, d.mrn ? `MRN: ${d.mrn}` : ""].filter(Boolean).join("        "));
        if (d.selfPay === "yes") x(C.selfPayYes);
        if (d.selfPay === "no") x(C.selfPayNo);

        text("street", d.street);
        text("city", d.city);
        text("province", d.province);
        text("postal", d.postal);
        text("homePhone", d.homePhone);
        text("workPhone", d.workPhone);
        text("contactPhone", d.contactPhone);

        // physicians
        text("referring", d.referring);
        text("referringPhone", d.referringPhone);
        text("referringBill", d.referringBill);
        text("familyName", d.familyName);
        text("familyPhone", d.familyPhone);
        text("familyBill", d.familyBill);
        text("consultName", d.consultName);
        text("consultPhone", d.consultPhone);
        text("consultBill", d.consultBill);

        // procedures
        text("proc1", d.proc1); text("proc1Hosp", d.proc1Hosp); text("proc1Date", toDMY(d.proc1Date));
        text("proc2", d.proc2); text("proc2Hosp", d.proc2Hosp); text("proc2Date", toDMY(d.proc2Date));

        // special needs
        if (d.accommodation) x(C.accommodation);
        if (d.interpreter) x(C.interpreter);
        text("interpreterSpec", d.interpreterSpec);
        if (d.counseling) x(C.counseling);
        text("counselReason", d.counselReason);

        if (d.otherNeeds) {
            let size = 8, lines;
            for (size of [8, 7.5, 7]) {
                lines = wrap(d.otherNeeds, font, size, OTHER_NEEDS[0][2] - OTHER_NEEDS[0][0] - 2);
                if (lines.length <= 2) break;
            }
            if (lines.length > 2) warnings.push("Other special needs is too long. Only the first two lines were printed.");
            lines.slice(0, 2).forEach((ln, i) => {
                const [x0, , , bottom] = OTHER_NEEDS[i];
                page.drawText(ln, { x: x0 + 1, y: PAGE_H - (bottom - 2.5), size, font, color: ink });
            });
        }

        if (d.hospitalBed) x(C.hospitalBed);
        if (d.inFacility) x(C.inFacility);
        text("facilityName", d.facilityName);

        // receiving centre
        if (d.centre && CENTRES[d.centre] !== undefined) {
            const top = CENTRES[d.centre];
            x([82.1, top, 89.1, top + 6.95]);
        }

        return { bytes: await pdf.save(), warnings };
    }

    const api = { fill, toDMY, CENTRES: Object.keys(CENTRES) };
    if (typeof module !== "undefined" && module.exports) module.exports = api;
    else root.BCCancerForm = api;
})(typeof window !== "undefined" ? window : globalThis);
