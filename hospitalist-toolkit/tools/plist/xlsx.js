/* Patient list from a screenshot - write the Excel file in Wayne's VGH list format.
   template.xlsx holds the format with no patient data: row 1 headers, row 2 a green floor row,
   rows 3-4 one patient (yellow name row; the white pmhx row is used for the 3 rows under it).
   The rows are copied for each floor and patient, so colours, column colours, frozen header and the
   colour rules (allergy y red, gfr <=60 pink, vtep n red, fp n red, ...) stay exactly as in the template.
   Runs in the browser (JSZip from the CDN) and in node for tests (JSZip passed in). */
(function (root) {
  "use strict";
  const xmlEsc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  function rowsOf(xml) {
    const out = {};
    xml.replace(/<row r="(\d+)"[^>]*?(?:\/>|>[\s\S]*?<\/row>)/g, (m, r) => { out[r] = m; return m; });
    return out;
  }
  // copy a template row to row n, putting values into the named columns ({ F: "Smith, Ann", E: 81 })
  function cloneRow(proto, n, vals) {
    let x = proto.replace(/^<row r="\d+"/, `<row r="${n}"`).replace(/(<c r="[A-Z]+)\d+"/g, `$1${n}"`);
    Object.keys(vals || {}).forEach((col) => {
      const v = vals[col];
      if (v == null || v === "") return;
      const re = new RegExp(`<c r="${col}${n}"([^>]*?)(?:\\/>|>[\\s\\S]*?<\\/c>)`);
      const cell = (attrs) => {
        attrs = attrs.replace(/\s*t="[^"]*"/, "");
        return typeof v === "number" ? `<c r="${col}${n}"${attrs}><v>${v}</v></c>`
                                     : `<c r="${col}${n}"${attrs} t="inlineStr"><is><t xml:space="preserve">${xmlEsc(v)}</t></is></c>`;
      };
      if (re.test(x)) x = x.replace(re, (m, attrs) => cell(attrs));
      else x = x.replace(/<\/row>$/, cell("") + "</row>").replace(/\/>$/, ">" + cell("") + "</row>");
    });
    return x;
  }

  // a list (or "a; b; c" text) split over up to n cells, one item per cell when it fits
  function spread(list, n) {
    n = n || 3;
    if (!list) return [];
    if (!Array.isArray(list)) list = String(list).split(/\s*;\s*/);
    list = list.map((x) => String(x).trim()).filter(Boolean);
    if (list.length <= n) return list;
    const per = Math.ceil(list.length / n), out = [];
    for (let i = 0; i < list.length; i += per) out.push(list.slice(i, i + per).join("; "));
    return out;
  }
  // pmhx over up to n lines: short text stays on one line, a long list is split at commas into even lines
  function lines(text, n) {
    n = n || 3;
    const t = String(text || "").trim(), parts = t.split(/\s*[,;]\s*/).filter(Boolean);
    if (t.length <= 40 || parts.length < 2) return [t];
    const k = Math.min(n, parts.length, Math.ceil(t.length / 40));
    const target = t.length / k, out = [];
    let cur = [];
    parts.forEach((p, i) => {
      cur.push(p);
      const left = parts.length - i - 1, slots = k - out.length - 1;
      if (slots > 0 && (cur.join(", ").length >= target || left === slots)) { out.push(cur.join(", ")); cur = []; }
    });
    if (cur.length) out.push(cur.join(", "));
    return out;
  }
  const halves = (t) => { const x = lines(t, 2); return [x[0] || "", x[1] || ""]; };

  // groups: [{ floor, patients: [{ name, location, age, admit, reason, fp, note }] }]
  async function build(JSZip, template, groups, opts) {
    opts = opts || {};
    const zip = await JSZip.loadAsync(template);
    const path = "xl/worksheets/sheet1.xml";
    let xml = await zip.file(path).async("string");
    const proto = rowsOf(xml);
    if (!proto[1] || !proto[2] || !proto[3] || !proto[4] || !proto[5]) throw new Error("template.xlsx is missing its pattern rows");
    const out = [proto[1]];
    let n = 2;
    groups.forEach((g) => {
      out.push(cloneRow(proto[2], n++, { A: g.floor }));
      g.patients.forEach((p) => {
        // each patient: the yellow row, then 3 rows under it. issues (O) and to do (S) use all 4 rows; pmhx (F) the 3 under the name.
        const iss = spread(p.issues, 4), todo = spread([].concat(p.note ? [p.note] : [], p.todo || []), 4), pm = lines(p.pmhx, 3);
        const gfr = p.gfr === "" || p.gfr == null || isNaN(+p.gfr) ? p.gfr : +p.gfr;
        out.push(cloneRow(proto[3], n++, { A: p.contact, B: p.hc, C: p.nurse, D: p.location, E: p.age == null ? "" : +p.age, F: p.name, G: p.admit, H: p.reason,
          I: p.most, J: p.allergy, K: gfr, L: p.vtep, M: p.fp, N: p.isolation, O: iss[0], P: p.iv, Q: p.foley, R: p.lab, S: todo[0], T: p.mrn == null ? "" : String(p.mrn), U: p.sex }));
        for (let k = 0; k < 3; k++)
          out.push(cloneRow(proto[4], n++, { F: k === 0 ? "pmhx:" + (pm[0] ? " " + pm[0] : "") : pm[k], O: iss[k + 1], S: todo[k + 1] }));
      });
    });
    for (let i = 0; i < (opts.spare == null ? 3 : opts.spare); i++) { // empty patient rows for new admissions
      out.push(cloneRow(proto[3], n++, {})); out.push(cloneRow(proto[4], n++, { F: "pmhx:" })); out.push(cloneRow(proto[4], n++, {})); out.push(cloneRow(proto[4], n++, {}));
    }
    const last = n - 1;
    xml = xml.replace(/<sheetData>[\s\S]*<\/sheetData>|<sheetData\/>/, "<sheetData>" + out.join("") + "</sheetData>");
    xml = xml.replace(/<dimension ref="[^"]*"\/>/, `<dimension ref="A1:U${last}"/>`);
    // colour rules: stretch every column range to the last row; drop stray single cells left from the old sheet
    xml = xml.replace(/(<conditionalFormatting[^>]*sqref=")([^"]*)(")/g, (m, a, refs, b) =>
      a + refs.split(" ").filter((r) => r.includes(":")).map((r) => r.replace(/^([A-Z]+)(\d+):([A-Z]+)\d+$/, `$1$2:$3${last}`)).join(" ") + b);
    zip.file(path, xml);
    return zip.generateAsync({ type: opts.type || "uint8array", compression: "DEFLATE" });
  }

  // ---- update a list file the user already has (partly filled in by hand) ----
  // New patients from the screenshot go in under their floor (copying the row look of the user's own file); patients already
  // in the file are left as typed, except that empty age / mrn / sex cells are filled. Nothing is deleted.
  const unx = (t) => String(t).replace(/<[^>]+>/g, "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
  const colNum = (c) => c.split("").reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0);
  const colName = (n) => { let s = ""; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };
  function cellText(rowXml, col, sst) {
    const m = rowXml.match(new RegExp(`<c r="${col}\\d+"([^>]*?)(?:\\/>|>([\\s\\S]*?)<\\/c>)`)); if (!m || !m[2]) return "";
    const t = (m[1].match(/t="(\w+)"/) || [])[1];
    if (t === "inlineStr") return unx((m[2].match(/<t[^>]*>[\s\S]*?<\/t>/g) || []).join("")).trim();
    const v = (m[2].match(/<v>([\s\S]*?)<\/v>/) || [])[1]; if (v == null) return "";
    return String(t === "s" ? sst[+v] || "" : unx(v)).trim();
  }
  const blankRow = (x) => x.replace(/(<c r="[A-Z]+\d+")([^>]*?)(?:\/>|>[\s\S]*?<\/c>)/g, (m, a, attrs) => `${a}${attrs.replace(/\s*t="[^"]*"/, "")}/>`);
  const normName = (n) => { const t = String(n || "").toLowerCase().replace(/[^a-z,\s'-]/g, "").trim(); const [sur, first] = t.includes(",") ? t.split(",") : [t.split(/\s+/).pop(), t.split(/\s+/)[0]];
    return (sur || "").replace(/[^a-z]/g, "") + "|" + (first || "").trim().replace(/[^a-z]/g, "").slice(0, 3); };
  const normFloor = (f) => String(f || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const sameP = (a, b) => (a.mrn && b.mrn && String(a.mrn).replace(/\D/g, "") === String(b.mrn).replace(/\D/g, "")) || (a.name && b.name && normName(a.name) === normName(b.name));

  async function readList(JSZip, data) {
    const zip = await JSZip.loadAsync(data);
    let path = "xl/worksheets/sheet1.xml";
    try { // the first sheet in the workbook, wherever Excel put it
      const wb = await zip.file("xl/workbook.xml").async("string"), rels = await zip.file("xl/_rels/workbook.xml.rels").async("string");
      const rid = (wb.match(/<sheet\b[^>]*r:id="([^"]+)"/) || [])[1], tgt = rid && (rels.match(new RegExp(`<Relationship[^>]*Id="${rid}"[^>]*Target="([^"]+)"`)) || rels.match(new RegExp(`<Relationship[^>]*Target="([^"]+)"[^>]*Id="${rid}"`)) || [])[1];
      if (tgt) path = tgt.replace(/^\/?(xl\/)?/, "xl/");
    } catch (e) {}
    const xml = await zip.file(path).async("string");
    const sst = []; if (zip.file("xl/sharedStrings.xml")) (await zip.file("xl/sharedStrings.xml").async("string")).replace(/<si>([\s\S]*?)<\/si>/g, (m, x) => { sst.push(unx((x.match(/<t[^>]*>[\s\S]*?<\/t>/g) || []).join(""))); return m; });
    const rows = []; xml.replace(/<row r="(\d+)"[^>]*?(?:\/>|>[\s\S]*?<\/row>)/g, (m, r) => { rows.push({ n: +r, xml: m }); return m; });
    const txt = (r, c) => cellText(r.xml, c, sst);
    const hdr = rows[0] && rows[0].n === 1 ? rows[0] : null, hcols = {};
    if (hdr) hdr.xml.replace(/<c r="([A-Z]+)1"/g, (m, c) => { hcols[txt(hdr, c).toLowerCase()] = c; return m; });
    // classify rows: patient (name row), pmhx/under rows, floor rows, spare (empty patient slot)
    const patients = [], floors = []; let cur = null;
    rows.forEach((r, i) => {
      if (r === hdr) return;
      const f = txt(r, "F"), next = rows[i + 1], nextPm = next && /^pmhx:?/i.test(txt(next, "F"));
      // rows under a patient (pmhx lines, issues, to do) have no room in D; a name with a room starts the next patient
      if (/^pmhx:?/i.test(f) || (cur && !txt(r, "D") && !nextPm && !(!f && txt(r, "A") && !/<v>|<t[ >]/.test(r.xml.replace(/<c r="A\d+"[^>]*?(?:\/>|>[\s\S]*?<\/c>)/, ""))) && r.n - cur.last <= 1 && cur.rows < 4)) { if (cur) { cur.last = r.n; cur.rows++; } return; }
      if ((f && txt(r, "D")) || nextPm) { cur = { first: r.n, last: r.n, rows: 1, name: f, mrn: hcols.mrn ? txt(r, hcols.mrn) : "", age: txt(r, "E"), room: txt(r, "D"), spare: !f, floor: floors.length ? floors[floors.length - 1].name : "", rowRef: r };
        if (f) patients.push(cur); else (floors.length ? floors[floors.length - 1] : { spares: [] }).spares.push(cur); return; }
      cur = null;
      const a = txt(r, "A"), others = r.xml.replace(/<c r="A\d+"[^>]*?(?:\/>|>[\s\S]*?<\/c>)/, "");
      if (a && !/<v>|<t[ >]/.test(others)) floors.push({ name: a, row: r.n, spares: [] });
    });
    const firstP = patients[0] || floors.flatMap((f) => f.spares)[0];
    const at = (n) => rows.find((r) => r.n === n);
    const proto = firstP ? { main: blankRow(firstP.rowRef.xml), pm: at(firstP.first + 1) ? blankRow(at(firstP.first + 1).xml) : null, under: at(firstP.first + 2) ? blankRow(at(firstP.first + 2).xml) : null } : null;
    const floorProto = floors.length ? blankRow(at(floors[0].row).xml) : null;
    const risky = /<f[ >]/.test(xml) || Object.keys(zip.files).some((k) => /comments|drawings|threadedComments/.test(k)) || /<dataValidations|<hyperlinks/.test(xml);
    return { zip, path, xml, sst, rows, hcols, patients, floors, proto, floorProto, risky, lastRow: rows.length ? rows[rows.length - 1].n : 1 };
  }

  // groups: as for build(); returns { data, added: [names], filled: [names], missing: [names in the file but not on the screenshot] }
  async function update(JSZip, data, groups, opts) {
    opts = opts || {};
    const L = await readList(JSZip, data);
    if (!L.proto) throw new Error("couldn't find a patient row in that file to copy (is it your VGH list?)");
    let xml = L.xml; const rowXml = {}; L.rows.forEach((r) => (rowXml[r.n] = r.xml));
    // mrn / sex columns: use the file's own, or add them after the last header
    const hdr = rowXml[1] || "";
    let cM = L.hcols.mrn, cS = L.hcols.sex || L.hcols.gender, lastCol = 0;
    hdr.replace(/<c r="([A-Z]+)1"/g, (m, c) => { if (cellText(hdr, c, L.sst)) lastCol = Math.max(lastCol, colNum(c)); return m; });
    if (rowXml[1]) {
      if (!cM) { cM = colName(Math.max(lastCol, colNum("S")) + 1); lastCol = colNum(cM); rowXml[1] = cloneRow(rowXml[1], 1, { [cM]: "mrn" }); }
      if (!cS) { cS = colName(Math.max(lastCol, colNum("S")) + 1); rowXml[1] = cloneRow(rowXml[1], 1, { [cS]: "sex" }); }
    }
    const all = groups.flatMap((g) => g.patients.map((p) => Object.assign({ floor: g.floor }, p)));
    const filled = [], added = [];
    // patients already in the file: fill only empty cells
    L.patients.forEach((ep) => {
      const p = all.find((x) => sameP(x, { name: ep.name, mrn: ep.mrn })); if (!p) return; p._inFile = true;
      const vals = {}, r = ep.first, x = rowXml[r];
      if (p.mrn && !cellText(x, cM, L.sst)) vals[cM] = String(p.mrn);
      if (p.sex && !cellText(x, cS, L.sst)) vals[cS] = p.sex;
      if (p.age != null && p.age !== "" && !cellText(x, "E", L.sst)) vals.E = +p.age;
      if (Object.keys(vals).length) { rowXml[r] = cloneRow(x, r, vals); filled.push(ep.name); }
    });
    const missing = L.patients.filter((ep) => !all.some((p) => sameP(p, { name: ep.name, mrn: ep.mrn }))).map((ep) => ep.name);
    const fresh = all.filter((p) => !p._inFile);
    // where each new patient goes: an empty patient slot on their floor, else after the floor's last patient, else a new floor at the end
    const inserts = {}; // before old row n -> [row xml with placeholder numbers]
    const addAt = (n, xs) => (inserts[n] = (inserts[n] || []).concat(xs));
    const block = (p) => {
      const iss = spread(p.issues, 4), todo = spread([].concat(p.note ? [p.note] : [], p.todo || []), 4), pm = lines(p.pmhx, 3);
      const gfr = p.gfr === "" || p.gfr == null || isNaN(+p.gfr) ? p.gfr : +p.gfr;
      const main = { A: p.contact, B: p.hc, C: p.nurse, D: p.location, E: p.age == null || p.age === "" ? "" : +p.age, F: p.name, G: p.admit, H: p.reason,
        I: p.most, J: p.allergy, K: gfr, L: p.vtep, M: p.fp, N: p.isolation, O: iss[0], P: p.iv, Q: p.foley, R: p.lab, S: todo[0], [cM]: p.mrn == null ? "" : String(p.mrn), [cS]: p.sex };
      const under = [0, 1, 2].map((k) => ({ F: k === 0 ? "pmhx:" + (pm[0] ? " " + pm[0] : "") : pm[k], O: iss[k + 1], S: todo[k + 1] }));
      return { main, under };
    };
    const asRows = (b) => [cloneRow(L.proto.main, 0, b.main)].concat(b.under.map((u, k) => cloneRow((k === 0 ? L.proto.pm : L.proto.under) || L.proto.main, 0, u)));
    const endFloors = {};
    fresh.forEach((p) => {
      const b = block(p), fl = L.floors.find((f) => normFloor(f.name) === normFloor(p.floor));
      const slot = fl && fl.spares.find((s) => !s.used);
      if (slot) { // fill the empty slot in place
        slot.used = true; rowXml[slot.first] = cloneRow(rowXml[slot.first], slot.first, b.main);
        b.under.forEach((u, k) => { const n = slot.first + 1 + k; if (rowXml[n]) rowXml[n] = cloneRow(rowXml[n], n, u); });
      } else if (fl) {
        const mine = L.patients.filter((ep) => ep.floor === fl.name), lastN = mine.length ? Math.max(...mine.map((e) => e.last)) : fl.row;
        addAt(lastN + 1, asRows(b));
      } else (endFloors[p.floor] = endFloors[p.floor] || []).push(b);
      added.push(p.name);
    });
    const tail = [];
    Object.keys(endFloors).forEach((f) => { if (L.floorProto) tail.push(cloneRow(L.floorProto, 0, { A: f })); endFloors[f].forEach((b) => tail.push(...asRows(b))); });
    if (tail.length) addAt(L.lastRow + 1, tail);
    // renumber: every old row moves down by the rows put in above it (gaps between rows are kept)
    const cuts = Object.keys(inserts).map(Number).sort((a, b) => a - b);
    const shift = (n) => n + cuts.filter((c) => c <= n).reduce((s, c) => s + inserts[c].length, 0);
    if (L.risky && cuts.some((c) => c <= L.lastRow)) { // formulas, comments, links: don't move rows - put everything at the end instead
      const moved = cuts.filter((c) => c <= L.lastRow).flatMap((c) => { const xs = inserts[c]; delete inserts[c]; return xs; });
      addAt(L.lastRow + 1, moved); cuts.length = 0; Object.keys(inserts).map(Number).sort((a, b) => a - b).forEach((c) => cuts.push(c));
    }
    const renum = (x, n) => x.replace(/^<row r="\d+"/, `<row r="${n}"`).replace(/(<c r="[A-Z]+)\d+"/g, `$1${n}"`);
    // Excel wants the cells of a row in column order, and the optional spans hint can't be stale
    const tidyRow = (x) => { const m = x.match(/^(<row\b[^>]*>)([\s\S]*)(<\/row>)$/); if (!m) return x.replace(/ spans="[^"]*"/, "");
      const cells = m[2].match(/<c r="[A-Z]+\d+"[^>]*?(?:\/>|>[\s\S]*?<\/c>)/g) || [];
      cells.sort((p, q) => colNum(p.match(/<c r="([A-Z]+)/)[1]) - colNum(q.match(/<c r="([A-Z]+)/)[1]));
      return m[1].replace(/ spans="[^"]*"/, "") + cells.join("") + m[3]; };
    const out = []; let newLast = 1;
    const emit = (x, n) => { out.push(tidyRow(renum(x, n))); newLast = Math.max(newLast, n); };
    const oldNs = L.rows.map((r) => r.n);
    oldNs.forEach((n) => {
      if (inserts[n]) inserts[n].forEach((x, k) => emit(x, shift(n) - inserts[n].length + k));
      emit(rowXml[n], shift(n));
    });
    cuts.filter((c) => c > L.lastRow).forEach((c) => inserts[c].forEach((x, k) => emit(x, shift(L.lastRow) + 1 + k)));
    const refShift = (ref) => ref.replace(/([A-Z]+)(\d+)/g, (m, c, n) => c + shift(+n));
    xml = xml.replace(/<sheetData>[\s\S]*<\/sheetData>|<sheetData\/>/, "<sheetData>" + out.join("") + "</sheetData>");
    const lastColName = colName(Math.max(colNum("U"), colNum(cM), colNum(cS)));
    xml = xml.replace(/<dimension ref="[^"]*"\/>/, `<dimension ref="A1:${lastColName}${newLast}"/>`);
    xml = xml.replace(/(<conditionalFormatting[^>]*sqref=")([^"]*)(")/g, (m, a, refs, b) => a + refs.split(" ").map((r) => {
      const mm = r.match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/); if (!mm) return refShift(r);
      return `${mm[1]}${shift(+mm[2])}:${mm[3]}${+mm[4] >= L.lastRow ? Math.max(newLast, shift(+mm[4])) : shift(+mm[4])}`; }).join(" ") + b);
    xml = xml.replace(/(<mergeCell ref=")([^"]+)(")/g, (m, a, r, b) => a + refShift(r) + b).replace(/(<autoFilter ref=")([^"]+)(")/, (m, a, r, b) => a + refShift(r) + b);
    xml = xml.replace(/(<pane[^>]*topLeftCell=")([^"]+)(")/, (m, a, r, b) => a + r + b);
    if (/<cols>/.test(xml) && !new RegExp(`<col [^>]*min="${colNum(cM)}"`).test(xml)) xml = xml.replace("</cols>", `<col min="${colNum(cM)}" max="${colNum(cM)}" width="10.7109375" customWidth="1"/></cols>`);
    L.zip.file(L.path, xml);
    return { data: await L.zip.generateAsync({ type: opts.type || "uint8array", compression: "DEFLATE" }), added, filled, missing };
  }

  // ---- daily update of a list file: fill EMPTY chart cells, rebuild the app's own "check today" column ----
  // valsFor(patient) -> { age, allergy, gfr, vtep, iv, foley, lab, check: [..] } or null (skip). Nothing typed by the user is changed.
  const FILL = [["E", "age"], ["J", "allergy"], ["K", "gfr"], ["L", "vtep"], ["P", "iv"], ["Q", "foley"], ["R", "lab"]];
  function setCell(x, col, n, val) { // blank the cell (keeping its look), then put the value in
    const re = new RegExp(`<c r="${col}${n}"([^>]*?)(?:\\/>|>[\\s\\S]*?<\\/c>)`);
    if (re.test(x)) x = x.replace(re, (m, attrs) => `<c r="${col}${n}"${attrs.replace(/\s*t="[^"]*"/, "")}/>`);
    return val === "" || val == null ? x : cloneRow(x, n, { [col]: val });
  }
  // quiet colours for "check today", added once: soft red for CRITICAL, soft amber for things to do
  async function addCheckCF(zip, xml, cC, lastRow, sC) {
    if (!zip.file("xl/styles.xml")) return xml;
    if (/SEARCH\("discharge Rx"/.test(xml) && (!sC || new RegExp(`sqref="${sC}2:`).test(xml))) return xml; // already current
    xml = xml.replace(/<conditionalFormatting\b[^>]*>(?:(?!<\/conditionalFormatting>)[\s\S])*?priority="9\d\d"[\s\S]*?<\/conditionalFormatting>/g, ""); // older check-today rules
    let st = await zip.file("xl/styles.xml").async("string");
    const red = '<dxf><font><b/><color rgb="FF8E1F14"/></font><fill><patternFill><bgColor rgb="FFF8D7D3"/></patternFill></fill></dxf>';
    const amb = '<dxf><font><color rgb="FF7A4B00"/></font><fill><patternFill><bgColor rgb="FFFCE8C8"/></patternFill></fill></dxf>';
    const ambB = '<dxf><font><b/><color rgb="FF7A4B00"/></font><fill><patternFill><bgColor rgb="FFFCE8C8"/></patternFill></fill></dxf>';
    const grn = '<dxf><font><color rgb="FF2F5321"/></font></dxf>';
    const first = addDxfs(st, red + amb + ambB + grn, 4); st = first.st;
    zip.file("xl/styles.xml", st);
    const c2 = cC + "2", rng = `${cC}2:${cC}${Math.max(lastRow, 200)}`;
    const todo = ["recheck", "IV to PO", "stop date", "renal dosing", "vitals 24", "Discharge Clinic", "pending", "discharge Rx"].map((w) => `ISNUMBER(SEARCH("${w}",${c2}))`).join(",");
    let cf = `<conditionalFormatting sqref="${rng}"><cfRule type="containsText" dxfId="${first.at}" priority="901" operator="containsText" text="CRITICAL"><formula>NOT(ISERROR(SEARCH("CRITICAL",${c2})))</formula></cfRule>` +
      `<cfRule type="expression" dxfId="${first.at + 1}" priority="902"><formula>OR(${todo})</formula></cfRule></conditionalFormatting>`;
    if (sC) { // stay: green while on track, amber (bold) from the day before target, red at or past target
      const s2 = sC + "2", n = `VALUE(MID(${s2},FIND(" ",${s2})+1,FIND("/",${s2})-FIND(" ",${s2})-1))`, t = `VALUE(MID(${s2},FIND("/",${s2})+1,3))`;
      cf += `<conditionalFormatting sqref="${sC}2:${sC}${Math.max(lastRow, 200)}">` +
        `<cfRule type="expression" dxfId="${first.at}" priority="903" stopIfTrue="1"><formula>IFERROR(${n}&gt;=${t},FALSE)</formula></cfRule>` +
        `<cfRule type="expression" dxfId="${first.at + 2}" priority="904" stopIfTrue="1"><formula>IFERROR(${n}&gt;=${t}-1,FALSE)</formula></cfRule>` +
        `<cfRule type="expression" dxfId="${first.at + 3}" priority="905"><formula>IFERROR(${n}&gt;=0,FALSE)</formula></cfRule></conditionalFormatting>`;
    }
    return insertCF(xml, cf);
  }
  function insertCF(xml, cf) {
    const at = xml.search(/<conditionalFormatting|<dataValidations|<hyperlinks|<printOptions|<pageMargins|<pageSetup|<headerFooter|<drawing|<legacyDrawing|<tableParts|<extLst/);
    return at >= 0 ? xml.slice(0, at) + cf + xml.slice(at) : xml.replace("</worksheet>", cf + "</worksheet>");
  }
  function addDxfs(st, items, n) { // append dxf entries; returns the index of the first one
    let at;
    if (/<dxfs count="\d+"\s*\/>/.test(st)) { at = 0; st = st.replace(/<dxfs count="\d+"\s*\/>/, `<dxfs count="${n}">${items}</dxfs>`); }
    else if (/<dxfs count="\d+">/.test(st)) { at = +st.match(/<dxfs count="(\d+)">/)[1]; st = st.replace(/<dxfs count="\d+">/, `<dxfs count="${at + n}">`).replace("</dxfs>", items + "</dxfs>"); }
    else { at = 0; st = st.replace(/(<tableStyles|<colors|<extLst|<\/styleSheet>)/, `<dxfs count="${n}">${items}</dxfs>$1`); }
    return { st, at };
  }

  /* ---------- give an existing list the template's look, keeping every value ---------- */
  const kids = (st, tag, child) => { const m = st.match(new RegExp(`<${tag}\\b[^>]*?(?:/>|>([\\s\\S]*?)</${tag}>)`)); if (!m || !m[1]) return [];
    return m[1].match(new RegExp(`<${child}\\b[^>]*?/>|<${child}\\b[^>]*>[\\s\\S]*?</${child}>`, "g")) || []; };
  function appendKids(st, tag, child, items) {
    const have = kids(st, tag, child).length;
    if (new RegExp(`<${tag}\\b[^>]*/>`).test(st)) st = st.replace(new RegExp(`<${tag}\\b[^>]*/>`), `<${tag} count="${items.length}">${items.join("")}</${tag}>`);
    else st = st.replace(new RegExp(`(<${tag}\\b)[^>]*>([\\s\\S]*?)</${tag}>`), (m, a, inner) => `${a} count="${have + items.length}">${inner}${items.join("")}</${tag}>`);
    return { st, at: have };
  }
  async function restyle(JSZip, data, template, opts) {
    opts = opts || {};
    const L = await readList(JSZip, data), T = await readList(JSZip, template);
    if (!L.patients.length && !L.floors.length) throw new Error("this does not look like your VGH list (no patients or floors found)");
    // 1. copy the template's fonts, fills, borders, cell styles and colour-rule styles into the file
    const ts = await T.zip.file("xl/styles.xml").async("string");
    let st = L.zip.file("xl/styles.xml") ? await L.zip.file("xl/styles.xml").async("string") : ts;
    const f = appendKids(st, "fonts", "font", kids(ts, "fonts", "font")); st = f.st;
    const fl = appendKids(st, "fills", "fill", kids(ts, "fills", "fill")); st = fl.st;
    const b = appendKids(st, "borders", "border", kids(ts, "borders", "border")); st = b.st;
    const xfs = kids(ts, "cellXfs", "xf").map((x) => x.replace(/\bfontId="(\d+)"/, (m, n) => `fontId="${+n + f.at}"`).replace(/\bfillId="(\d+)"/, (m, n) => `fillId="${+n + fl.at}"`)
      .replace(/\bborderId="(\d+)"/, (m, n) => `borderId="${+n + b.at}"`).replace(/\bxfId="\d+"/, 'xfId="0"').replace(/\bnumFmtId="(\d+)"/, (m, n) => +n >= 164 ? 'numFmtId="0"' : m));
    const x = appendKids(st, "cellXfs", "xf", xfs); st = x.st;
    const tdx = kids(ts, "dxfs", "dxf"), d = addDxfs(st, tdx.join(""), tdx.length); st = d.st;
    L.zip.file("xl/styles.xml", st);
    // 2. the template's style for each column, by kind of row
    const sOf = (rx, col) => { const m = rx.match(new RegExp(`<c r="${col}\\d+"[^>]*?\\ss="(\\d+)"`)); return m ? +m[1] + x.at : null; };
    const tRow = (n) => (T.rows.find((r) => r.n === n) || {}).xml || "";
    const KIND = { head: tRow(1), floor: tRow(2), name: tRow(3), pm: tRow(4), under: tRow(5) };
    const tCols = []; KIND.head.replace(/<c r="([A-Z]+)1"/g, (m, c) => (tCols.push(c), m));
    const lastT = Math.max(...tCols.map(colNum));
    const kindOf = {}; L.rows.forEach((r) => (kindOf[r.n] = r.n === 1 ? "head" : "under"));
    L.floors.forEach((fl2) => (kindOf[fl2.row] = "floor"));
    [...L.patients, ...L.floors.flatMap((q) => q.spares)].forEach((p) => { kindOf[p.first] = "name"; for (let n = p.first + 1; n <= p.last; n++) kindOf[n] = "under";
      const r2 = L.rows.find((r) => r.n === p.first + 1); if (r2 && /^pmhx:?/i.test(cellText(r2.xml, "F", L.sst))) kindOf[p.first + 1] = "pm"; });
    let maxCol = lastT;
    L.rows.forEach((r) => r.xml.replace(/<c r="([A-Z]+)\d+"[^>]*?\ss?="?[^>]*?(?:\/>|>[\s\S]*?<\/c>)/g, (m, c) => { if (/<v>|<t[ >]/.test(m)) maxCol = Math.max(maxCol, colNum(c)); return m; }));
    const allCols = Array.from({ length: maxCol }, (_, i) => colName(i + 1)).filter((c) => colNum(c) > lastT).concat(tCols);
    const rowsXml = L.rows.map((r) => {
      const k = kindOf[r.n], proto = KIND[k], cells = {};
      r.xml.replace(/<c r="([A-Z]+)\d+"[^>]*?(?:\/>|>[\s\S]*?<\/c>)/g, (m, c) => { cells[c] = m; return m; });
      allCols.forEach((c) => { if (!cells[c]) cells[c] = `<c r="${c}${r.n}"/>`; });
      Object.keys(cells).forEach((c) => {
        const s2 = colNum(c) <= lastT ? sOf(proto, c) : sOf(proto, "S"); // columns past the template (e.g. check today) look like "to do"
        cells[c] = cells[c].replace(/^<c r="[A-Z]+\d+"[^>]*?(?=\/?>)/, (open) => { open = open.replace(/\s+s="\d+"/, ""); return s2 == null ? open : `${open} s="${s2}"`; });
      });
      const open = r.xml.match(/^<row\b[^>]*?(?=\/?>)/)[0].replace(/\s+(s|customFormat)="[^"]*"/g, "");
      const heads = k === "head" ? open.replace(/\s+(ht|customHeight)="[^"]*"/g, "") + ' ht="30" customHeight="1"' : open;
      return `${heads}>${Object.keys(cells).sort((p, q) => colNum(p) - colNum(q)).map((c) => cells[c]).join("")}</row>`;
    });
    let xml = L.xml.replace(/<sheetData>[\s\S]*<\/sheetData>|<sheetData\/>/, "<sheetData>" + rowsXml.join("") + "</sheetData>");
    // 3. column widths, frozen header and name column, no grid lines, print setup
    const txml = T.xml, grab = (re) => (txml.match(re) || [])[0] || "";
    const tColsXml = kids(txml, "cols", "col").filter((c) => +c.match(/min="(\d+)"/)[1] <= lastT).map((c) => c.replace(/\s+style="\d+"/, ""));
    const keep = kids(xml, "cols", "col").filter((c) => +c.match(/min="(\d+)"/)[1] > lastT);
    const colsXml = `<cols>${tColsXml.join("")}${keep.join("")}</cols>`;
    xml = /<cols>[\s\S]*?<\/cols>/.test(xml) ? xml.replace(/<cols>[\s\S]*?<\/cols>/, colsXml) : xml.replace(/<sheetData/, colsXml + "<sheetData");
    xml = xml.replace(/<sheetViews>[\s\S]*?<\/sheetViews>/, grab(/<sheetViews>[\s\S]*?<\/sheetViews>/));
    if (!/<sheetViews>/.test(xml)) xml = xml.replace(/(<sheetFormatPr|<cols>)/, grab(/<sheetViews>[\s\S]*?<\/sheetViews>/) + "$1");
    if (/<sheetPr\b[^>]*\/>/.test(xml)) xml = xml.replace(/<sheetPr\b([^>]*)\/>/, '<sheetPr$1><pageSetUpPr fitToPage="1"/></sheetPr>');
    else if (/<sheetPr\b/.test(xml)) xml = /<pageSetUpPr/.test(xml) ? xml.replace(/<pageSetUpPr\b[^>]*\/>/, '<pageSetUpPr fitToPage="1"/>') : xml.replace("</sheetPr>", '<pageSetUpPr fitToPage="1"/></sheetPr>');
    else xml = xml.replace(/(<dimension|<sheetViews)/, '<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>$1');
    xml = xml.replace(/<printOptions\b[^>]*\/>|<pageMargins\b[^>]*\/>|<pageSetup\b[^>]*\/>/g, "");
    const print = grab(/<printOptions\b[^>]*\/>/) + grab(/<pageMargins\b[^>]*\/>/) + grab(/<pageSetup\b[^>]*\/>/);
    const at2 = xml.search(/<headerFooter|<rowBreaks|<colBreaks|<drawing|<legacyDrawing|<tableParts|<extLst|<\/worksheet>/); xml = xml.slice(0, at2) + print + xml.slice(at2);
    // 4. the template's colour rules (same meaning, softer colours), stretched to the last row
    const lastRow = Math.max(...L.rows.map((r) => r.n), 2);
    xml = xml.replace(/<conditionalFormatting\b[\s\S]*?<\/conditionalFormatting>/g, "");
    const cfs = (txml.match(/<conditionalFormatting\b[\s\S]*?<\/conditionalFormatting>/g) || []).map((c) => c.replace(/dxfId="(\d+)"/g, (m, n) => `dxfId="${+n + d.at}"`)
      .replace(/sqref="([^"]*)"/, (m, refs) => `sqref="${refs.split(" ").map((q) => q.replace(/^([A-Z]+)(\d+):([A-Z]+)\d+$/, `$1$2:$3${lastRow}`)).join(" ")}"`)).join("");
    if (cfs) xml = insertCF(xml, cfs);
    const cC = L.hcols["check today"]; if (cC) xml = await addCheckCF(L.zip, xml.replace(/SEARCH\("discharge Rx"/g, "SEARCH(\"x\""), cC, lastRow, L.hcols["stay"]);
    if (maxCol > lastT) xml = xml.replace(/<dimension ref="A1:[A-Z]+(\d+)"\/>/, (m, n) => `<dimension ref="A1:${colName(maxCol)}${n}"/>`);
    L.zip.file(L.path, xml);
    // 5. repeat the header row on every printed page
    const wbx = await L.zip.file("xl/workbook.xml").async("string");
    if (!/_xlnm\.Print_Titles"[^>]*localSheetId="0"|localSheetId="0"[^>]*_xlnm\.Print_Titles/.test(wbx)) {
      const nm = ((wbx.match(/<sheet\b[^>]*name="([^"]+)"/) || [])[1] || "Sheet1").replace(/'/g, "''");
      const dn = `<definedName name="_xlnm.Print_Titles" localSheetId="0">'${nm}'!$1:$1</definedName>`;
      L.zip.file("xl/workbook.xml", /<definedNames>/.test(wbx) ? wbx.replace("</definedNames>", () => dn + "</definedNames>") : wbx.replace(/(<calcPr|<oleSize|<customWorkbookViews|<pivotCaches|<extLst|<\/workbook>)/, (m) => `<definedNames>${dn}</definedNames>${m}`));
    }
    return { data: await L.zip.generateAsync({ type: opts.type || "uint8array", compression: "DEFLATE" }), patients: L.patients.length, floors: L.floors.length };
  }

  /* ---------- stay bar: "▰▰▰▰▰▱▱ 5/7" ---------- */
  const STAY_TARGET = 7;
  function stayTarget(txt) { // what you typed in the stay cell sets the target: "10", "/10" or an old bar "… 5/10"; else 7
    const t = String(txt || "").trim(), m = t.match(/\/\s*(\d{1,2})\s*$/) || t.match(/^(\d{1,2})$/);
    const n = m ? +m[1] : STAY_TARGET; return n >= 1 && n <= 60 ? n : STAY_TARGET;
  }
  function stayBar(los, target) {
    const slots = target <= 14 ? target : 10, done = Math.min(slots, Math.round((Math.min(los, target) / target) * slots));
    return "▰".repeat(done) + "▱".repeat(slots - done) + (los > target ? "+" + (los - target) : "") + " " + los + "/" + target;
  }
  const MON = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
  function losFromCell(txt, now) { // "17-Nov (LOS 5 d)" in the admit date column, when the chart gives no admission
    const t = String(txt || ""), d = t.match(/(\d{1,2})[-\s]([A-Za-z]{3})/);
    if (d && MON[d[2].toLowerCase()] != null) { const n = new Date(now); let a = new Date(n.getFullYear(), MON[d[2].toLowerCase()], +d[1]);
      if (a.getTime() > now + 86400000) a = new Date(n.getFullYear() - 1, a.getMonth(), a.getDate());
      const t0 = new Date(n.getFullYear(), n.getMonth(), n.getDate()).getTime(); return Math.max(0, Math.round((t0 - a.getTime()) / 86400000)); }
    const l = t.match(/LOS\s*(\d+)/i); return l ? +l[1] : null;
  }
  function stayCheck(los, target) {
    if (los == null) return null;
    if (los >= target) return `day ${los}/${target}: past target, discharge Rx and note ready?`;
    if (los >= target - 1) return `day ${los}/${target}: start discharge Rx and note`;
    return null;
  }

  async function daily(JSZip, data, valsFor, opts) {
    opts = opts || {};
    const L = await readList(JSZip, data);
    if (!L.patients.length) throw new Error("no patients found in that file (is it your VGH list?)");
    let xml = L.xml; const rowXml = {}; L.rows.forEach((r) => (rowXml[r.n] = r.xml));
    const hdr = rowXml[1] || ""; let lastCol = 0;
    hdr.replace(/<c r="([A-Z]+)1"/g, (m, c) => { if (cellText(hdr, c, L.sst)) lastCol = Math.max(lastCol, colNum(c)); return m; });
    let cC = L.hcols["check today"];
    // the new column borrows the look of the "to do" column (S): header style in row 1, cell style in each row
    const styleOf = (x, col) => ((x || "").match(new RegExp(`<c r="${col}\\d+"[^>]*?\\ss="(\\d+)"`)) || [])[1];
    const ensure = (x, col, n, from) => { if (!x || new RegExp(`<c r="${col}${n}"`).test(x)) return x; const st = styleOf(x, from || "S");
      return x.replace(/<\/row>$/, `<c r="${col}${n}"${st ? ` s="${st}"` : ""}/></row>`).replace(/\/>$/, `><c r="${col}${n}"${st ? ` s="${st}"` : ""}/></row>`); };
    let sC = L.hcols["stay"];
    if (!sC) { sC = colName(Math.max(lastCol, colNum("S")) + 1); lastCol = colNum(sC); if (rowXml[1]) rowXml[1] = cloneRow(ensure(rowXml[1], sC, 1), 1, { [sC]: "stay" }); }
    if (!cC) { cC = colName(Math.max(lastCol, colNum("S")) + 1); if (rowXml[1]) rowXml[1] = cloneRow(ensure(rowXml[1], cC, 1), 1, { [cC]: "check today" }); }
    const now = opts.now || Date.now();
    const stamp = opts.date || new Date().toLocaleDateString("en-CA", { day: "numeric", month: "short" });
    const report = [];
    for (const ep of L.patients) {
      let v = null; try { v = await valsFor(ep); } catch (e) { report.push({ name: ep.name, error: e.message || String(e) }); continue; }
      if (!v) { report.push({ name: ep.name, skipped: true }); continue; }
      const r = ep.first, x = rowXml[r], vals = {}, fills = [];
      FILL.forEach(([col, k]) => { const val = v[k]; if (val == null || val === "") return; if (!cellText(x, col, L.sst)) { vals[col] = typeof val === "number" ? val : String(val); fills.push(k); } });
      if (Object.keys(vals).length) rowXml[r] = cloneRow(x, r, vals);
      // stay bar: days from the chart's admission, else from the admit date you typed; target from the stay cell (7 if blank)
      const target = stayTarget(cellText(rowXml[r], sC, L.sst)), los = v.los != null ? v.los : losFromCell(cellText(rowXml[r], "G", L.sst), now);
      rowXml[r] = setCell(ensure(rowXml[r], sC, r, "G"), sC, r, los == null ? (cellText(rowXml[r], sC, L.sst) || "") : stayBar(los, target));
      const list = (v.check || []).slice(), sc = stayCheck(los, target);
      if (sc) list.splice(list.filter((c) => /^CRITICAL/.test(c)).length, 0, sc); // right after any CRITICAL results
      if (list.length) list[0] = stamp + ": " + list[0];
      const items = spread(list, 4), lastN = Math.max(ep.last || r, r);
      for (let k = 0; k < 4; k++) { const n = r + k; if (!rowXml[n] || (k > 0 && n > lastN)) break; rowXml[n] = setCell(ensure(rowXml[n], cC, n), cC, n, items[k] || ""); }
      report.push({ name: ep.name, filled: fills, check: list.map((c, i) => (i === 0 ? c.slice(stamp.length + 2) : c)), stay: los == null ? "" : stayBar(los, target) });
    }
    const tidyRow = (x) => { const m = x.match(/^(<row\b[^>]*>)([\s\S]*)(<\/row>)$/); if (!m) return x.replace(/ spans="[^"]*"/, "");
      const cells = m[2].match(/<c r="[A-Z]+\d+"[^>]*?(?:\/>|>[\s\S]*?<\/c>)/g) || [];
      cells.sort((p, q) => colNum(p.match(/<c r="([A-Z]+)/)[1]) - colNum(q.match(/<c r="([A-Z]+)/)[1]));
      return m[1].replace(/ spans="[^"]*"/, "") + cells.join("") + m[3]; };
    xml = xml.replace(/<sheetData>[\s\S]*<\/sheetData>|<sheetData\/>/, "<sheetData>" + L.rows.map((r) => tidyRow(rowXml[r.n])).join("") + "</sheetData>");
    xml = xml.replace(/<dimension ref="A1:([A-Z]+)(\d+)"\/>/, (m, c, n) => `<dimension ref="A1:${colName(Math.max(colNum(c), colNum(cC)))}${n}"/>`);
    if (/<cols>/.test(xml) && !new RegExp(`<col [^>]*min="${colNum(sC)}"`).test(xml)) xml = xml.replace("</cols>", `<col min="${colNum(sC)}" max="${colNum(sC)}" width="17" customWidth="1"/></cols>`);
    if (/<cols>/.test(xml) && !new RegExp(`<col [^>]*min="${colNum(cC)}"`).test(xml)) xml = xml.replace("</cols>", `<col min="${colNum(cC)}" max="${colNum(cC)}" width="48" customWidth="1"/></cols>`);
    xml = await addCheckCF(L.zip, xml, cC, Math.max(...L.rows.map((r) => r.n)), sC);
    L.zip.file(L.path, xml);
    return { data: await L.zip.generateAsync({ type: opts.type || "uint8array", compression: "DEFLATE" }), report, column: cC, stayColumn: sC };
  }

  const api = { build, cloneRow, spread, lines, halves, readList, update, sameP, daily, restyle, stayBar, stayTarget, losFromCell, stayCheck };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.PListXlsx = api;
})(this);
