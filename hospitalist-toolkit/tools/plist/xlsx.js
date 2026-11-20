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
          I: p.most, J: p.allergy, K: gfr, L: p.vtep, M: p.fp, N: p.isolation, O: iss[0], P: p.iv, Q: p.foley, R: p.lab, S: todo[0] }));
        for (let k = 0; k < 3; k++)
          out.push(cloneRow(proto[4], n++, { F: k === 0 ? "pmhx:" + (pm[0] ? " " + pm[0] : "") : pm[k], O: iss[k + 1], S: todo[k + 1] }));
      });
    });
    for (let i = 0; i < (opts.spare == null ? 3 : opts.spare); i++) { // empty patient rows for new admissions
      out.push(cloneRow(proto[3], n++, {})); out.push(cloneRow(proto[4], n++, { F: "pmhx:" })); out.push(cloneRow(proto[4], n++, {})); out.push(cloneRow(proto[4], n++, {}));
    }
    const last = n - 1;
    xml = xml.replace(/<sheetData>[\s\S]*<\/sheetData>|<sheetData\/>/, "<sheetData>" + out.join("") + "</sheetData>");
    xml = xml.replace(/<dimension ref="[^"]*"\/>/, `<dimension ref="A1:S${last}"/>`);
    // colour rules: stretch every column range to the last row; drop stray single cells left from the old sheet
    xml = xml.replace(/(<conditionalFormatting[^>]*sqref=")([^"]*)(")/g, (m, a, refs, b) =>
      a + refs.split(" ").filter((r) => r.includes(":")).map((r) => r.replace(/^([A-Z]+)\d+:([A-Z]+)\d+$/, `$1${1}:$2${last}`)).join(" ") + b);
    zip.file(path, xml);
    return zip.generateAsync({ type: opts.type || "uint8array", compression: "DEFLATE" });
  }

  const api = { build, cloneRow, spread, lines, halves };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.PListXlsx = api;
})(this);
