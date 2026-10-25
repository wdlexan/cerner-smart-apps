// form41.js — writes data onto the flat BC Form 4.1 (HLTH 3504.1 2022/12/06) PDF.
// Positions were measured from the official PDF (US Letter, 612 x 792 pt).
// "top" values are measured from the TOP of the page, like the form layout.
// Works in the browser (window.Form41) and in Node (module.exports) for testing.

(function (root) {
    const PAGE_H = 792;

    // ---- measured positions ----
    const P1 = {
        name:      { x: 30,  top: 152, maxW: 392 },
        phn:       { x: 432, top: 152, maxW: 150 },
        site:      { x: 30,  top: 180, maxW: 345 },
        examDate:  { x: 466, top: 180, maxW: 118 },
        physician: { x: 114, top: 556, maxW: 212 },
        phone:     { x: 114, top: 583, maxW: 112 },
        collegeId: { x: 233, top: 583, maxW: 92 },
        // radio-button circle centres
        radioDesignated: { cx: 385.75, ctop: 165.45 },
        radioOtherSite:  { cx: 385.75, ctop: 177.65 },
        radioPhysician:  { cx: 39.3,   ctop: 555.2 },
        radioNP:         { cx: 39.3,   ctop: 569.7 },
        radioPoliceYes:  { cx: 33.0,   ctop: 596.6 },
        radioPoliceNo:   { cx: 65.95,  ctop: 596.6 },
        // checkbox: "Check if summary continued on back of this page"
        boxContinued: { x0: 288.2, top0: 521.9, x1: 297.4, top1: 531.0 },
        // the four "reasons" boxes
        reasons: [
            { top: 247, bottom: 291 },
            { top: 319, bottom: 363 },
            { top: 403, bottom: 447 },
            { top: 475, bottom: 519 }
        ],
        reasonX: 51,
        reasonW: 528
    };

    const P2 = {
        name:     { x: 30,  top: 78,  maxW: 392 },
        phn:      { x: 432, top: 78,  maxW: 150 },
        site:     { x: 30,  top: 105, maxW: 308 },
        examDate: { x: 347, top: 105, maxW: 122 },
        examTime: { x: 528, top: 105, maxW: 56 },
        bodyX: 30,
        bodyW: 552,
        bodyTop: 140,
        bodyBottom: 760
    };

    // ---- helpers ----
    function toDMY(iso) {
        if (!iso) return "";
        const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
        return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
    }

    // Standard PDF fonts only support Latin characters; swap out the rest.
    function clean(s) {
        return String(s || "")
            .replace(/[‘’]/g, "'")
            .replace(/[“”]/g, '"')
            .replace(/[–—]/g, "-")
            .replace(/…/g, "...")
            .replace(/\t/g, " ")
            .replace(/[^\n\x20-\x7E\xA0-\xFF]/g, "?");
    }

    function wrap(text, font, size, maxW) {
        const out = [];
        for (const para of clean(text).split(/\r?\n/)) {
            if (!para.trim()) { out.push(""); continue; }
            let line = "";
            for (let w of para.split(/\s+/).filter(Boolean)) {
                // break words that are longer than the whole line
                while (font.widthOfTextAtSize(w, size) > maxW) {
                    let i = w.length;
                    while (i > 1 && font.widthOfTextAtSize(w.slice(0, i), size) > maxW) i--;
                    if (line) { out.push(line); line = ""; }
                    out.push(w.slice(0, i));
                    w = w.slice(i);
                }
                if (!w) continue;
                const t = line ? `${line} ${w}` : w;
                if (font.widthOfTextAtSize(t, size) <= maxW) line = t;
                else { out.push(line); line = w; }
            }
            if (line) out.push(line);
        }
        while (out.length && out[out.length - 1] === "") out.pop();
        return out;
    }

    async function fill(PDFLib, templateBytes, d) {
        const { PDFDocument, StandardFonts, rgb } = PDFLib;
        const pdf = await PDFDocument.load(templateBytes);
        const font = await pdf.embedFont(StandardFonts.Helvetica);
        const [p1, p2] = pdf.getPages();
        const ink = rgb(0, 0, 0);

        // one line of text, shrunk to fit its box
        const single = (page, str, pos, size = 10) => {
            str = clean(str).replace(/\s*\n\s*/g, ", ").trim();
            if (!str) return;
            let s = size;
            while (s > 6 && font.widthOfTextAtSize(str, s) > pos.maxW) s -= 0.5;
            page.drawText(str, { x: pos.x, y: PAGE_H - pos.top, size: s, font, color: ink });
        };
        const dot = (page, c) =>
            page.drawCircle({ x: c.cx, y: PAGE_H - c.ctop, size: 2.6, color: ink });
        const tick = (page, b) => {
            const pad = 1.8;
            const o = { thickness: 1.2, color: ink };
            page.drawLine({ start: { x: b.x0 + pad, y: PAGE_H - b.top0 - pad }, end: { x: b.x1 - pad, y: PAGE_H - b.top1 + pad }, ...o });
            page.drawLine({ start: { x: b.x0 + pad, y: PAGE_H - b.top1 + pad }, end: { x: b.x1 - pad, y: PAGE_H - b.top0 - pad }, ...o });
        };

        // ---- Section 1, page 1 ----
        single(p1, d.patientName, P1.name);
        single(p1, d.phn, P1.phn);
        single(p1, d.examSite, P1.site);
        single(p1, toDMY(d.examDate), P1.examDate);
        if (d.siteType === "designated") dot(p1, P1.radioDesignated);
        if (d.siteType === "other") dot(p1, P1.radioOtherSite);

        single(p1, d.physicianName, P1.physician);
        if (d.professional === "np") dot(p1, P1.radioNP);
        else dot(p1, P1.radioPhysician);
        single(p1, d.physicianPhone, P1.phone);
        single(p1, d.collegeId, P1.collegeId);

        if (d.police === "yes") dot(p1, P1.radioPoliceYes);
        if (d.police === "no") dot(p1, P1.radioPoliceNo);

        // ---- reasons 1-4, overflow goes to the back page ----
        const overflow = [];
        (d.reasons || []).forEach((text, i) => {
            if (!text || !String(text).trim()) return;
            const box = P1.reasons[i];
            let size, lead, fitLines, lines;
            for (size of [9, 8.5, 8]) {
                lead = size * 1.22;
                fitLines = Math.floor((box.bottom - box.top - size) / lead) + 1;
                lines = wrap(text, font, size, P1.reasonW);
                if (lines.length <= fitLines) break;
            }
            let shown = lines;
            if (lines.length > fitLines) {
                shown = lines.slice(0, fitLines - 1).concat(["(continued on back of this page)"]);
                overflow.push({ heading: `${i + 1}. (continued)`, text: lines.slice(fitLines - 1).join(" ") });
            }
            shown.forEach((ln, j) => {
                if (!ln) return;
                p1.drawText(ln, { x: P1.reasonX, y: PAGE_H - (box.top + size + j * lead), size, font, color: ink });
            });
        });

        // ---- back page, only when something overflowed ----
        if (overflow.length) {
            tick(p1, P1.boxContinued);
            single(p2, d.patientName, P2.name);
            single(p2, d.phn, P2.phn);
            single(p2, d.examSite, P2.site);
            single(p2, toDMY(d.examDate), P2.examDate);
            single(p2, d.examTime, P2.examTime);

            const size = 9, lead = 11;
            let top = P2.bodyTop;
            for (const part of overflow) {
                const lines = [part.heading].concat(wrap(part.text, font, size, P2.bodyW), [""]);
                for (const ln of lines) {
                    if (top > P2.bodyBottom) {
                        throw new Error("The reasons are too long to fit on the form, even using the back page. Shorten them and try again.");
                    }
                    if (ln) p2.drawText(ln, { x: P2.bodyX, y: PAGE_H - top, size, font, color: ink });
                    top += lead;
                }
            }
        }

        return { bytes: await pdf.save(), continuedOnBack: overflow.length > 0 };
    }

    const api = { fill, toDMY };
    if (typeof module !== "undefined" && module.exports) module.exports = api;
    else root.Form41 = api;
})(typeof window !== "undefined" ? window : globalThis);
