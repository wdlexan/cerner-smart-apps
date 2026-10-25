// app.js — Forms launcher for the Cerner SMART on FHIR sandbox.
// Loads the patient once, lists the forms in forms.js, builds each form's inputs,
// and fills the blank PDF in the browser. Patient data never leaves this page.

const CFG = window.APP_CONFIG;
const FORMS = window.FORMS;
const PAGE_H = 792;

// ---------- small helpers ----------
const pad = n => String(n).padStart(2, "0");
const localDate = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const localTime = (d = new Date()) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const el = id => document.getElementById(id);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fid = (form, f) => `${form.id}__${f.id}`;
const allFields = form => form.sections.flatMap(s => s.fields);

function fmtDate(iso, fmt) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
    if (!m) return iso || "";
    const [, y, mo, d] = m;
    if (fmt === "mdy") return `${mo}/${d}/${y}`;
    if (fmt === "dmon") return `${d}-${MONTHS[+mo - 1]}-${y}`;
    return `${d}/${mo}/${y}`; // dmy (default)
}

// ---------- patient ----------
let PT = null; // normalized patient

function findIdentifier(patient, words) {
    const hit = (patient.identifier || []).find(id => {
        const sys = (id.system || "").toLowerCase();
        const typeText = ((id.type && id.type.text) || "").toLowerCase();
        const codes = ((id.type && id.type.coding) || []).map(c => `${(c.code || "").toLowerCase()} ${(c.display || "").toLowerCase()}`);
        return words.some(w => sys.includes(w) || typeText.includes(w) || codes.some(c => c.includes(w)));
    });
    return hit ? hit.value : "";
}

function normalizePatient(p) {
    const n = (p.name || []).find(x => x.use === "official") || (p.name || [])[0] || {};
    const given = n.given || [];
    const first = given[0] || "";
    const last = n.family || "";
    const addr = (p.address || []).find(a => a.use === "home") || (p.address || [])[0] || {};
    const street = (addr.line || []).join(", ");
    const province = addr.state === "British Columbia" ? "BC" : (addr.state || "");
    const phones = { home: "", work: "", mobile: "" };
    let email = "";
    for (const t of p.telecom || []) {
        if (t.system === "email") { if (!email) email = t.value; continue; }
        if (t.system && t.system !== "phone") continue;
        const use = t.use || "home";
        if (use in phones && !phones[use]) phones[use] = t.value;
    }
    const sex = ["male", "female"].includes(p.gender) ? p.gender : (p.gender ? "unknown" : "");
    return {
        fullName: n.text || `${given.join(" ")} ${last}`.trim(),
        first, last,
        initial: given[1] ? given[1][0] : "",
        dob: p.birthDate || "",
        sex,
        sexLabel: { male: "Male", female: "Female", unknown: p.gender === "other" ? "Other" : "Unknown" }[sex] || "",
        // Only an identifier that is clearly a PHN — never the MRN/FIN
        phn: findIdentifier(p, ["phn", "personal health"]),
        mrn: findIdentifier(p, ["mrn", "medical record", "mr "]),
        street,
        city: addr.city || "",
        province,
        postal: addr.postalCode || "",
        addressOneLine: [street, addr.city, [province, addr.postalCode].filter(Boolean).join(" ")].filter(Boolean).join(", "),
        homePhone: phones.home,
        workPhone: phones.work,
        mobile: phones.mobile,
        email
    };
}

function resolveSrc(src) {
    if (!src) return "";
    if (src === "today") return localDate();
    if (src === "now") return localTime();
    const [ns, key] = src.split(".");
    if (ns === "pt") return PT ? (PT[key] ?? "") : "";
    if (ns === "cfg") return CFG.physician[key] ?? CFG[key] ?? "";
    return "";
}

function renderBanner() {
    const b = el("ptBanner");
    if (!PT) { b.textContent = "No patient loaded"; return; }
    const parts = [PT.fullName || "(no name)"];
    if (PT.dob) parts.push(`DOB ${fmtDate(PT.dob, "dmon")}`);
    if (PT.sexLabel) parts.push(PT.sexLabel);
    parts.push(PT.phn ? `PHN ${PT.phn}` : "PHN not in chart");
    if (PT.mrn) parts.push(`MRN ${PT.mrn}`);
    b.textContent = parts.join(" · ");
}

// ---------- home screen ----------
function renderHome() {
    const list = el("formList");
    const q = (el("search").value || "").toLowerCase();
    list.innerHTML = "";
    for (const form of FORMS) {
        const hay = `${form.title} ${form.description} ${form.category}`.toLowerCase();
        if (q && !hay.includes(q)) continue;
        const card = document.createElement("button");
        card.className = "formCard";
        card.type = "button";
        card.innerHTML = `
            <span class="cat">${esc(form.category)}</span>
            <span class="title">${esc(form.title)}</span>
            <span class="desc">${esc(form.description)}</span>
            <span class="file" id="file__${form.id}">${esc(form.template)}</span>`;
        card.onclick = () => openForm(form.id);
        list.appendChild(card);
        checkTemplate(form);
    }
    if (!list.children.length) list.innerHTML = `<p class="empty">No forms match “${esc(q)}”.</p>`;
}

const templateOk = {};
async function checkTemplate(form) {
    if (!(form.id in templateOk)) {
        try { templateOk[form.id] = (await fetch(form.template, { method: "HEAD" })).ok; }
        catch { templateOk[form.id] = false; }
    }
    const tag = el(`file__${form.id}`);
    if (tag && !templateOk[form.id]) {
        tag.textContent = `Blank PDF missing: add ${form.template} to the folder`;
        tag.classList.add("missing");
    }
}

// ---------- building a form's inputs ----------
const built = {};

function fieldHtml(form, f) {
    const id = fid(form, f);
    const span = `span${f.span || (f.type === "textarea" ? 4 : 2)}`;
    const req = f.required ? ' <span class="req">*</span>' : "";
    const hint = f.hint ? `<div class="hint">${esc(f.hint)}</div>` : "";
    switch (f.type) {
        case "textarea":
            return `<div class="field ${span}"><label for="${id}">${esc(f.label)}${req}</label><textarea id="${id}"></textarea>${hint}</div>`;
        case "radio":
        case "checks": {
            const t = f.type === "radio" ? "radio" : "checkbox";
            const opts = f.options.map(o =>
                `<label><input type="${t}" name="${id}" value="${esc(o.value)}"> ${esc(o.label)}</label>`).join("");
            return `<div class="field ${span}"><span class="label">${esc(f.label)}${req}</span><div class="radios">${opts}</div>${hint}</div>`;
        }
        case "select": {
            const opts = f.options.map(o => `<option value="${esc(o.value)}">${esc(o.label)}</option>`).join("");
            return `<div class="field ${span}"><label for="${id}">${esc(f.label)}</label><select id="${id}">${opts}</select>${hint}</div>`;
        }
        case "check":
            return `<div class="field ${span}"><div class="radios"><label><input type="checkbox" id="${id}"> ${esc(f.label)}</label></div>${hint}</div>`;
        case "fixed":
            return `<div class="field ${span}"><span class="label">${esc(f.label)}</span><div class="static" id="${id}"></div></div>`;
        default: {
            const t = f.type === "date" ? "date" : f.type === "time" ? "time" : "text";
            const extra = f.phn ? ' inputmode="numeric" maxlength="12"' : "";
            return `<div class="field ${span}"><label for="${id}">${esc(f.label)}${req}</label><input type="${t}" id="${id}" autocomplete="off"${extra}>${hint}</div>`;
        }
    }
}

function buildForm(form) {
    const panel = document.createElement("div");
    panel.className = "card";
    panel.id = `panel__${form.id}`;
    panel.hidden = true;
    panel.innerHTML = `
        <button type="button" class="back" onclick="showHome()">← All forms</button>
        <h1>${esc(form.title)}</h1>
        <p class="subtitle">${esc(form.description)}. Chart details are pre-filled and can be edited. The PDF is built on this computer.</p>
        <form id="form__${form.id}">
            ${form.sections.map(s => `<fieldset><legend>${esc(s.legend)}</legend><div class="grid">${s.fields.map(f => fieldHtml(form, f)).join("")}</div></fieldset>`).join("")}
            <button type="submit" class="go" id="go__${form.id}">Create PDF</button>
            <div class="status" id="status__${form.id}" role="status" aria-live="polite"></div>
        </form>`;
    el("forms").appendChild(panel);
    panel.querySelector("form").addEventListener("submit", e => { e.preventDefault(); generate(form); });
    built[form.id] = true;
    prefill(form);
}

// fill empty inputs from chart / config / defaults (never overwrites what you typed)
function prefill(form) {
    for (const f of allFields(form)) {
        const id = fid(form, f);
        if (f.type === "fixed") {
            const node = el(id);
            if (node) node.textContent = f.display ? f.display(CFG.physician) : resolveSrc(f.src);
            continue;
        }
        let v = f.src ? resolveSrc(f.src) : (f.value ?? "");
        if (f.upper && v) v = String(v).toUpperCase();
        if (!v) continue;
        if (f.type === "radio") {
            if (document.querySelector(`input[name="${id}"]:checked`)) continue;
            let opt = document.querySelector(`input[name="${id}"][value="${v}"]`);
            if (!opt && v === "unknown") continue;
            if (opt) opt.checked = true;
        } else if (f.type === "select") {
            const s = el(id);
            if (s && !s.dataset.touched) s.value = v;
        } else if (f.type === "check" || f.type === "checks") {
            continue;
        } else {
            const i = el(id);
            if (i && !i.value) i.value = v;
        }
    }
}

function readValues(form) {
    const v = {};
    for (const f of allFields(form)) {
        const id = fid(form, f);
        switch (f.type) {
            case "radio": {
                const r = document.querySelector(`input[name="${id}"]:checked`);
                v[f.id] = r ? r.value : "";
                break;
            }
            case "checks":
                v[f.id] = [...document.querySelectorAll(`input[name="${id}"]:checked`)].map(i => i.value);
                break;
            case "check":
                v[f.id] = !!(el(id) && el(id).checked);
                break;
            case "fixed":
                v[f.id] = resolveSrc(f.src);
                break;
            default:
                v[f.id] = el(id) ? el(id).value.trim() : "";
        }
    }
    return v;
}

// ---------- navigation ----------
function showHome() {
    for (const f of FORMS) { const p = el(`panel__${f.id}`); if (p) p.hidden = true; }
    el("home").hidden = false;
    window.scrollTo(0, 0);
}
function openForm(id) {
    const form = FORMS.find(f => f.id === id);
    if (!built[id]) buildForm(form);
    el("home").hidden = true;
    for (const f of FORMS) { const p = el(`panel__${f.id}`); if (p) p.hidden = f.id !== id; }
    window.scrollTo(0, 0);
}
window.showHome = showHome;
window.openForm = openForm;

// ---------- generic PDF filler (for forms without a custom fill) ----------
function cleanText(s, keepNewlines) {
    let t = String(s ?? "")
        .replace(/[‘’]/g, "'").replace(/[“”]/g, '"')
        .replace(/[–—]/g, "-").replace(/…/g, "...").replace(/\t/g, " ");
    t = keepNewlines ? t.replace(/\r/g, "") : t.replace(/\s*\n\s*/g, ", ");
    return t.replace(/[^\n\x20-\x7E\xA0-\xFF]/g, "?").trim();
}

function wrapText(text, font, size, maxW) {
    const out = [];
    for (const para of cleanText(text, true).split("\n")) {
        if (!para.trim()) { out.push(""); continue; }
        let line = "";
        for (let w of para.split(/\s+/).filter(Boolean)) {
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

async function genericFill(PDFLib, bytes, form, v) {
    const { PDFDocument, StandardFonts, rgb } = PDFLib;
    const pdf = await PDFDocument.load(bytes);
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const pages = pdf.getPages();
    const ink = rgb(0, 0, 0);
    const notes = [];

    const drawLine = (page, str, box, size) => {
        const [x0, , x1, bottom] = box;
        const maxW = x1 - x0 - 2;
        let s = size;
        while (s > 6 && font.widthOfTextAtSize(str, s) > maxW) s -= 0.5;
        page.drawText(str, { x: x0 + 1, y: PAGE_H - (bottom - 2.5), size: s, font, color: ink });
        return font.widthOfTextAtSize(str, s) <= maxW;
    };
    const mark = (page, box) => {
        const [x0, top, x1, bottom] = box;
        const size = 7, w = font.widthOfTextAtSize("X", size);
        page.drawText("X", { x: (x0 + x1) / 2 - w / 2, y: PAGE_H - (top + bottom) / 2 - size * 0.35, size, font, color: ink });
    };

    for (const f of allFields(form)) {
        const page = pages[(f.put && f.put.p) || 0];
        const val = v[f.id];

        // check marks
        if (f.type === "check") { if (val && f.mark) mark(page, f.mark); continue; }
        if (f.type === "radio" || f.type === "select") {
            const o = (f.options || []).find(o => o.value === val);
            if (o) for (const m of o.marks || (o.mark ? [o.mark] : [])) mark(page, m);
            if (!f.put) continue;
        }
        if (f.type === "checks") {
            for (const o of f.options) if ((val || []).includes(o.value)) for (const m of o.marks || (o.mark ? [o.mark] : [])) mark(page, m);
            continue;
        }
        if (!f.put) continue;

        // text
        let str = f.put.text ? f.put.text(v) : val;
        if (f.type === "date" || f.put.fmt) str = fmtDate(str, f.put.fmt);
        if (!str) continue;
        const size = f.put.size || 9;

        if (f.put.box) {
            if (!drawLine(page, cleanText(str), f.put.box, size)) notes.push(`“${f.label}” is too long for its box.`);
        } else if (f.put.lines) {
            const boxes = f.put.lines;
            const maxW = boxes[0][2] - boxes[0][0] - 2;
            let s = size, lines;
            for (s of [size, size - 0.5, size - 1, size - 1.5, 7].filter(x => x >= 7)) {
                lines = wrapText(str, font, s, maxW);
                if (lines.length <= boxes.length) break;
            }
            if (lines.length > boxes.length) notes.push(`“${f.label}” is too long. Only the first ${boxes.length} line(s) were printed.`);
            lines.slice(0, boxes.length).forEach((ln, i) => {
                if (ln) page.drawText(ln, { x: boxes[i][0] + 1, y: PAGE_H - (boxes[i][3] - 2.5), size: s, font, color: ink });
            });
        } else if (f.put.area) {
            const a = f.put.area;
            let s = size, lead, fit, lines;
            for (s of [size, 8.5, 8, 7.5, 7]) {
                lead = s * 1.22;
                fit = Math.floor((a.bottom - a.top - s) / lead) + 1;
                lines = wrapText(str, font, s, a.x1 - a.x0);
                if (lines.length <= fit) break;
            }
            if (lines.length > fit) notes.push(`“${f.label}” is too long. Only the first ${fit} lines were printed.`);
            lines.slice(0, fit).forEach((ln, i) => {
                if (ln) page.drawText(ln, { x: a.x0, y: PAGE_H - (a.top + s + i * lead), size: s, font, color: ink });
            });
        }
    }
    return { bytes: await pdf.save(), notes };
}

// ---------- create the PDF ----------
function setStatus(form, msg, isError) {
    const s = el(`status__${form.id}`);
    if (s) { s.textContent = msg; s.style.color = isError ? "#b00020" : "#1b7f3b"; }
    (isError ? console.warn : console.log)(msg);
}

function isEmpty(x) { return Array.isArray(x) ? x.length === 0 : !x; }

async function generate(form) {
    const v = readValues(form);
    const fields = allFields(form);

    const missing = fields.filter(f => f.required && isEmpty(v[f.id])).map(f => f.label);
    if (missing.length) { setStatus(form, `Missing: ${missing.join(", ")}`, true); return; }

    const btn = el(`go__${form.id}`);
    btn.disabled = true;
    setStatus(form, "Building PDF…");
    try {
        const res = await fetch(form.template);
        if (!res.ok) throw new Error(`Could not load ${form.template} (${res.status}). Put the blank form in the same folder as index.html, named exactly ${form.template}.`);
        const bytes = await res.arrayBuffer();

        const out = form.fill
            ? await form.fill(window.PDFLib, bytes, v, CFG)
            : await genericFill(window.PDFLib, bytes, form, v);

        const nameVal = String(v[form.fileNameFrom] || "patient").trim();
        const last = (form.fileNameFrom === "patientName" ? nameVal.split(/\s+/).pop() : nameVal).replace(/[^A-Za-z0-9-]/g, "") || "patient";
        download(out.bytes, `${form.filePrefix}_${last}_${localDate()}.pdf`);

        const notes = [...(out.notes || [])];
        for (const f of fields.filter(f => f.phn)) {
            const d = String(v[f.id] || "").replace(/\D/g, "");
            if (d && !/^9\d{9}$/.test(d)) notes.push("PHN is not 10 digits starting with 9. Check it.");
        }
        const blanks = fields.filter(f => f.important && isEmpty(v[f.id])).map(f => f.label.replace(/\s*\(.*\)$/, ""));
        let msg = "PDF created. Review it before sending. " + (form.footer || "");
        if (blanks.length) msg += ` Still blank: ${blanks.join("; ")}.`;
        if (notes.length) msg += ` Check: ${notes.join(" ")}`;
        setStatus(form, msg, notes.length > 0);
    } catch (err) {
        setStatus(form, `Failed: ${err.message}`, true);
    } finally {
        btn.disabled = false;
    }
}

function download(bytes, filename) {
    const blob = new Blob([bytes], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.open(url, "_blank"); // also open for review / printing
    setTimeout(() => URL.revokeObjectURL(url), 60000);
}

// ---------- start ----------
document.addEventListener("DOMContentLoaded", () => {
    el("search").addEventListener("input", renderHome);
    document.addEventListener("change", e => { if (e.target.tagName === "SELECT") e.target.dataset.touched = "1"; });
    renderHome();
    renderBanner();
});

function patientLoaded(p) {
    PT = normalizePatient(p);
    renderBanner();
    for (const form of FORMS) if (built[form.id]) prefill(form);
}

FHIR.oauth2.ready()
    .then(client => client.patient.read())
    .then(p => { console.log("FHIR Patient Resource:", p); patientLoaded(p); })
    .catch(err => {
        console.warn("No SMART session:", err);
        const isLocal = ["localhost", "127.0.0.1"].includes(location.hostname);
        if (isLocal) {
            // Test data ONLY when running locally — never silently on a real launch
            patientLoaded({
                name: [{ use: "official", family: "Patchtest", given: ["Nancy", "J"] }],
                gender: "female",
                birthDate: "1990-01-02",
                identifier: [{ type: { text: "PHN" }, value: "9876543210" }, { type: { text: "MRN" }, value: "123456" }]
            });
            el("ptBanner").textContent += "   (TEST DATA – no EHR session)";
        } else {
            el("ptBanner").textContent = "Could not load the patient from Cerner. Enter details manually.";
        }
    });
