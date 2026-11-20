/* Patient list from a screenshot - turn OCR text of a PowerChart patient list into rows, then group them by floor.
   Pure functions (no browser needed) so tests/test_plist.js can run them in node.
   Expected columns (PowerChart list): Name | Location | Age | Sex | Medical Service | Length of Stay | Visit Reason |
   Discharged | Primary Care Physician | FIN | MRN. Any of them may be misread - the tab shows every row for checking. */
(function (root) {
  "use strict";
  const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  // Common OCR slips in this list: O for 0 in numbers, | for I/l, "years" split, "Days" read as "Doys"
  function clean(line) {
    return String(line || "")
      .replace(/[|¦]/g, " ")
      .replace(/[“”"]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  // Location: "S7B-VGH S719 B", "8SW-RJH S835 B", "HAH-VGH HAH20 A", "VGH S5A S505 P", "VGH S5B S5BOCB 2"
  const LOC = /((?:[A-Z0-9]{2,4}-(?:VGH|RJH|SPH|LGH|CHH|NRGH)|VGH|RJH)\s+[A-Z0-9]{2,8}(?:\s+[A-Z0-9]{1,2})?)/;
  const AGE = /(\d{1,3})\s*(?:years?|yrs?|y)\b/i;
  const SEX = /\b(Male|Female|Unknown|M|F)\b/i;
  const LOS = /(\d{1,4}(?:[.,]\d)?)\s*(?:Days?|Doys?|Day5|d)\b/i;
  const DIS = /(\d{1,2}-[A-Za-z]{3}-\d{4})\s+(\d{1,2}:\d{2})(?:\s*P[CDS]T)?/;
  const PCP = /\b(DR|Dr|NP|MD|RN)\s*[,.]/;           // "Friesen DR, Caspar" / "Gray-Schleihauf NP, Christiane"
  const IDS = /(\d{10,12})\s*(\d{7,9})\s*$/;         // FIN then MRN, often run together by OCR

  function parseLine(raw) {
    let s = clean(raw).replace(/\$/g, "S");
    if (!s || /^Name\b.*Location/i.test(s)) return null;  // header row
    const loc = s.match(LOC);
    const age = s.match(AGE);
    if (!loc || !age) return null;                         // not a patient row
    const row = { raw: s, name: "", location: "", age: null, sex: "", service: "", los: null, reason: "",
                  discharged: "", pcp: "", fin: "", mrn: "" };
    row.name = s.slice(0, loc.index).replace(/[^A-Za-z' ,.-]+$/, "").trim();
    row.location = loc[1].trim();
    let rest = s.slice(loc.index + loc[0].length);
    const a = rest.match(AGE);
    if (a) { row.age = +a[1]; rest = rest.slice(a.index + a[0].length); }
    const sx = rest.match(SEX);
    if (sx && sx.index < 4) { row.sex = /^f/i.test(sx[1]) ? "F" : /^m/i.test(sx[1]) ? "M" : "U"; rest = rest.slice(sx.index + sx[0].length); }
    const l = rest.match(LOS);
    if (l) { row.service = tidy(rest.slice(0, l.index)).split(" ")[0] || ""; row.los = fixLos(l[1]); rest = rest.slice(l.index + l[0].length); }
    const ids = rest.match(IDS);
    if (ids) { row.fin = ids[1]; row.mrn = ids[2]; rest = rest.slice(0, ids.index); }
    else { const n = rest.match(/([\d ]{10,14})\s+(\d{7,9})\s*$/); if (n) { row.fin = n[1].replace(/\D/g, ""); row.mrn = n[2]; rest = rest.slice(0, n.index); } }
    const d = rest.match(DIS);
    let reasonPart = rest, pcpPart = "";
    if (d) {
      row.discharged = d[1] + " " + d[2];
      reasonPart = rest.slice(0, d.index); pcpPart = rest.slice(d.index + d[0].length);
    } else {
      const p = rest.match(PCP);
      if (p) {
        // the surname before "DR," is 1 word, or 2 when the first is a particle (Du Plessis, Van Der ...)
        const before = rest.slice(0, p.index).trim().split(" ");
        let n = 1;
        if (before.length >= 3 && /^(Du|De|Da|Di|Van|Von|Der|Den|La|Le|Mac|St\.?|Del|Dos|Al|El|Ten|Ter)$/i.test(before[before.length - 2])) n = 2;
        reasonPart = before.slice(0, before.length - n).join(" ");
        pcpPart = before.slice(before.length - n).join(" ") + " " + rest.slice(p.index);
      }
    }
    row.reason = tidy(reasonPart);
    row.pcp = tidy(pcpPart);
    row.name = fixName(row.name); row.location = fixLocation(row.location); row.floor = floorOf(row.location);
    row.low = [];
    return row;
  }

  function parse(text) {
    const rows = [];
    String(text || "").split(/\r?\n/).forEach((ln) => { const r = parseLine(ln); if (r) rows.push(r); });
    return rows;
  }

  // Floor from location: "S7B-VGH S719 B" -> S7B, "VGH S5A S505 P" -> S5A, "8SW-RJH S835 B" -> 8SW (RJH), "HAH-VGH HAH20 A" -> HAH
  function floorOf(loc) {
    const s = String(loc || "").trim();
    if (/^HAH/i.test(s)) return "HAH";
    const bare = s.match(/^([SN]\d)\d{2}\b/i);           // room only (Room/Bed list): S715 -> S7 (the unit letter isn't shown)
    if (bare) return bare[1].toUpperCase();
    let m = s.match(/^([A-Z0-9]+)-(VGH|[A-Z]{3,4})\b/i);
    if (m) return m[2].toUpperCase() === "VGH" ? m[1].toUpperCase() : m[1].toUpperCase() + " (" + m[2].toUpperCase() + ")";
    m = s.match(/^(VGH|[A-Z]{3})\s+([A-Z0-9]+)/i);
    if (m) return m[1].toUpperCase() === "VGH" ? m[2].toUpperCase() : m[2].toUpperCase() + " (" + m[1].toUpperCase() + ")";
    return s.split(" ")[0] || "Other";
  }
  // VGH south floors, then north, then other VGH units, then other hospitals, then Hospital at Home
  function floorRank(f) {
    if (f === "HAH") return [4, f];
    if (/\(/.test(f)) return [3, f];
    if (/^S\d/.test(f)) return [0, f];
    if (/^N\d/.test(f)) return [1, f];
    return [2, f];
  }
  function group(rows) {
    const g = {};
    rows.forEach((r) => { const f = r.floor || floorOf(r.location); (g[f] = g[f] || []).push(r); });
    return Object.keys(g)
      .sort((a, b) => { const x = floorRank(a), y = floorRank(b); return x[0] - y[0] || x[1].localeCompare(y[1]); })
      .map((f) => ({ floor: f, patients: g[f].sort((a, b) => a.location.localeCompare(b.location)) }));
  }

  function parseDis(s) {
    const m = String(s || "").match(/(\d{1,2})-([A-Za-z]{3})-(\d{4})\s+(\d{1,2}):(\d{2})/);
    if (!m) return null;
    const mo = MON.findIndex((x) => x.toLowerCase() === m[2].toLowerCase());
    return mo < 0 ? null : new Date(+m[3], mo, +m[1], +m[4], +m[5]);
  }
  // Admit date (e.g. 17-Oct) worked out from length of stay, counted back from when the screenshot was taken (or from discharge)
  function admitText(row, takenAt) {
    const real = parseDis(row.admitted);
    if (real) return String(real.getDate()).padStart(2, "0") + "-" + MON[real.getMonth()];
    if (row.los == null || isNaN(row.los)) return "";
    const end = parseDis(row.discharged) || takenAt || new Date();
    const d = new Date(end.getTime() - row.los * 864e5);
    return String(d.getDate()).padStart(2, "0") + "-" + MON[d.getMonth()];
  }

  // Merge rows from several screenshots (either list layout): the same FIN, MRN or name is kept once,
  // and blanks in the kept row are filled from the new one (e.g. Admitted date, MRN)
  function merge(list, add) {
    const same = (a, b) => (a.fin && a.fin === b.fin) || (a.mrn && a.mrn === b.mrn) ||
      (a.name && b.name && a.name.toLowerCase().replace(/\s+/g, " ") === b.name.toLowerCase().replace(/\s+/g, " "));
    add.forEach((r) => {
      const old = list.find((x) => same(x, r));
      if (!old) { list.push(r); return; }
      ["mrn", "fin", "admitted", "dob", "pcp", "service", "sex"].forEach((k) => { if (!old[k] && r[k]) old[k] = r[k]; });
    });
    return list;
  }

  // ---- clean-up of single fields (OCR slips seen on real PowerChart screenshots) ----
  const FL = { S: "5", O: "0", o: "0", I: "1", l: "1", Z: "2", B: "8" };      // where a digit belongs
  const LT = { "5": "S", "$": "S", "4": "A", "8": "B", "0": "D", "1": "I" };  // where a letter belongs
  function fixUnit(u) {   // floor code: S7B, N6D, S4A, 8SW, HAH, S5BOCB...
    u = u.toUpperCase().replace(/\$/g, "S");
    if (/^HAH/.test(u) || /^\d[A-Z]{2}$/.test(u)) return u;
    const c = u.split("");
    if (c.length >= 3) {
      if (c[0] === "5") c[0] = "S";
      if (FL[c[1]]) c[1] = FL[c[1]];
      if (/^[SN]\d/.test(c[0] + c[1]) && LT[c[2]] && c[2] !== "1") c[2] = LT[c[2]];
    }
    return c.join("");
  }
  function fixLocation(s) {
    s = clean(s).toUpperCase().replace(/\$/g, "S").replace(/\s&$/, " A").replace(/(VGH|RJH)(?=[A-Z0-9])/, "$1 ");
    let m = s.match(/^([A-Z0-9$]+)-(VGH|RJH|[A-Z]{3,4})\s*(.*)$/);
    if (m) {
      const unit = fixUnit(m[1]); let rest = m[3].trim();
      rest = rest.replace(/^5(?=\d)/, "S").replace(/^([SN]\d{3})([A-Z])$/, "$1 $2").replace(/^([SN]\d{3})[1l|]$/, "$1 I");
      if (/^S\dAH/.test(unit + "") === false) rest = rest.replace(/^(S\d)4H/, "$1AH");
      return unit + "-" + m[2] + (rest ? " " + rest : "");
    }
    m = s.match(/^(VGH|RJH)\s+([A-Z0-9$]+)\s*(.*)$/);
    if (m) {
      let rest = m[3].trim().replace(/^5(?=\d)/, "S").replace(/^SS(?=[A-Z])/, "S5");
      rest = rest.replace(/^([SN]\d{3})([A-Z])$/, "$1 $2");
      return m[1] + " " + fixUnit(m[2]) + (rest ? " " + rest : "");
    }
    return s;
  }
  function fixLos(t) {
    t = String(t || "").replace(/(\d)[Oo]|[Oo](?=\d)/g, (m, d) => (d ? d + "0" : "0")).replace(",", ".");
    const m = t.match(/(\d+(?:\.\d)?)\s*(?:Days?|Doys?|Day5|d)\b/i) || t.match(/(\d+(?:\.\d)?)/);
    if (!m) return null;
    let v = m[1];
    if (!/\./.test(v) && v.length >= 2) v = v.slice(0, -1) + "." + v.slice(-1);  // the list always shows one decimal: "44" was 4.4
    return parseFloat(v);
  }
  // room and bed only, for the Excel (the floor is already on the green row): "S7B-VGH S715 A" -> "S715 A"
  function roomOf(loc) {
    const s = String(loc || "").trim();
    let m = s.match(/^[A-Z0-9]+-[A-Z]{3,4}\s+(.+)$/i) || s.match(/^(?:VGH|RJH|[A-Z]{3})\s+[A-Z0-9]+\s+(.+)$/i);
    return m ? m[1].trim() : s;
  }
  function fixName(t) {
    t = clean(t).replace(/^\S*[^A-Za-z\s,'.-]+/, "").replace(/^[^A-Za-z]+/, "");   // selection icons etc. before the name
    return t.replace(/^([a-z])/, (c) => c.toUpperCase()).replace(/\s*,\s*/, ", ");
  }
  const digits = (t) => String(t || "").replace(/[Oo]/g, "0").replace(/[Il|]/g, "1").replace(/\D/g, "");
  const tidy = (t) => clean(t).replace(/^[^A-Za-z0-9]+/, "").replace(/[^A-Za-z0-9).]+$/, "");

  // Room + Bed columns: "HAH25" + "A" -> "HAH25 A"; OCR often joins them ("HAH25A")
  function roomBed(room, bed) {
    let r = clean(room).toUpperCase().replace(/\$/g, "S").replace(/\s+/g, "");
    let b = clean(bed).toUpperCase().replace(/[^A-Z0-9]/g, "");
    const m = r.match(/^(HAH\d+|[SN]\d{3}|[A-Z]{1,4}\d{1,4})([A-Z])$/);
    if (!b && m) { r = m[1]; b = m[2]; }
    return (r + (b ? " " + b : "")).trim();
  }

  // ---- column parser: OCR words with positions, columns found from the header row ----
  // words: [{ text, x0, y0, x1, y1, conf, line }] (line = any id shared by words on one row)
  // two PowerChart list layouts: "Location" (S7B-VGH S715 A) or separate "Room" + "Bed" (HAH25 | A), the second with DOB and Admitted
  const HEAD = [["name", /^name$/], ["location", /^location$/], ["room", /^room$/], ["bed", /^bed$/], ["dob", /^dob$/], ["age", /^.?age$/], ["sex", /^sex$/],
                ["service", /^medical$/], ["admitted", /^admit(?:ted)?$/], ["los", /^length$/], ["reason", /^visit$/], ["discharged", /^disch/],
                ["pcp", /^primary$/], ["fin", /^fin$/], ["mrn", /^mrn$/]];
  function parseWords(words) {
    const lines = {};
    words.forEach((w) => { (lines[w.line] = lines[w.line] || []).push(w); });
    const ordered = Object.values(lines).map((ws) => ws.sort((a, b) => a.x0 - b.x0))
      .sort((a, b) => a[0].y0 - b[0].y0);
    const norm = (t) => String(t).toLowerCase().replace(/[^a-z]/g, "");
    const hi = ordered.findIndex((ws) => ws.some((w) => norm(w.text) === "name") && ws.some((w) => /location|room/.test(norm(w.text))));
    if (hi < 0) return null;                                   // no header row in the picture: caller falls back to text
    // header words can run together ("Service|Length"): split them and place each part proportionally
    const hw = [];
    ordered[hi].forEach((w) => {
      const parts = String(w.text).split(/[|¦]+/), total = parts.join("").length || 1;
      let at = 0;
      parts.forEach((p) => { if (p) hw.push({ text: p, x0: w.x0 + (w.x1 - w.x0) * (at / total) }); at += p.length; });
    });
    const cols = [];
    HEAD.forEach(([k, re]) => { const w = hw.find((x) => re.test(norm(x.text))); if (w) cols.push({ k, x: w.x0 }); });
    cols.sort((a, b) => a.x - b.x);
    if (cols.length < 6) return null;
    const lineH = Math.max(8, ...ordered[hi].map((w) => w.y1 - w.y0));
    const tol = lineH * 0.2;
    const rows = [];
    ordered.slice(hi + 1).forEach((ws) => {
      const f = {}, low = new Set();
      ws.forEach((w) => {
        let c = cols[0];
        const mid = (w.x0 + (w.x1 != null ? w.x1 : w.x0)) / 2;   // a word belongs to the column its middle sits in (headers are not always flush with their values)
        for (const x of cols) if (Math.min(mid, w.x0 + tol + lineH) >= x.x) c = x;
        f[c.k] = (f[c.k] ? f[c.k] + " " : "") + w.text;
        // how sure the reader must be before a cell is left white: names and IDs matter most
        const need = { name: 80, fin: 80, mrn: 80, location: 40, age: 40 }[c.k] || 55;
        if (w.conf != null && w.conf < need) low.add(c.k);
      });
      const r = fromFields(f);
      if (r) {
        // a room that still doesn't look like a PowerChart location after clean-up is always flagged
        if (!/^(?:[SN]\d[A-Z]|\d[A-Z]{2}|HAH)-[A-Z]{3} [A-Z0-9]+(?: [A-Z0-9]{1,2})?$|^VGH [SN]\d[A-Z] [A-Z0-9]+(?: [A-Z0-9]{1,2})?$|^[A-Z]{1,4}\d{1,4}(?: [A-Z0-9]{1,2})?$/.test(r.location)) low.add("location");
        if (!(r.age > 0 && r.age < 115)) low.add("age");
        if (!(r.los > 0)) low.add("los");
        if (!r.name || !/^[A-Z][A-Za-z'-]+, [A-Z]/.test(r.name)) low.add("name");
        r.hasPcpCol = cols.some((x) => x.k === "pcp");   // fp is only "n" when the list shows a PCP column and it is empty
        r.low = Array.from(low); rows.push(r);
      }
    });
    return rows;
  }
  function fromFields(f) {
    // the end of a long location can spill into the Age column ("... S5BOCB" | "2 65 years")
    let ageTxt = String(f.age || ""), ageM = ageTxt.match(/(\d{1,3})\s*(?:years?|yrs?)/i);
    if (ageM && ageM.index > 0 && f.location) { f.location = f.location + " " + ageTxt.slice(0, ageM.index); }
    if (!f.location && f.room) f.location = roomBed(f.room, f.bed);
    if (!ageM) ageM = ageTxt.match(/(\d{1,3})/);
    // the length of stay can land in the Medical Service column
    if (!(fixLos(f.los) > 0)) { const m = String(f.service || "").match(/(\d+(?:[.,]\d)?)\s*Days?/i); if (m) f.los = m[1]; }
    // FIN (11 digits) and MRN (8 digits) can be split or run together
    let fin = digits(f.fin), mrn = digits(f.mrn);
    if (fin.length !== 11 && (fin + mrn).length === 19) { const all = fin + mrn; fin = all.slice(0, 11); mrn = all.slice(11); }
    const loc = fixLocation(f.location || "");
    if (!loc || !ageM) return null;
    let sex = String(f.sex || f.age || "");
    sex = /fem/i.test(sex) ? "F" : /male/i.test(sex) ? "M" : "";
    const dis = String(f.discharged || "").match(DIS), adm = String(f.admitted || "").match(DIS);
    return {
      name: fixName(f.name), location: loc, floor: floorOf(loc), age: +ageM[1], sex,
      service: tidy(String(f.service || "").split(" ").filter((x) => /[A-Za-z]{3}/.test(x))[0] || ""),
      los: fixLos(f.los), reason: tidy(f.reason), discharged: dis ? dis[1] + " " + dis[2] : "",
      pcp: tidy(f.pcp), fin, mrn, admitted: adm ? adm[1] + " " + adm[2] : "", dob: (String(f.dob || "").match(/\d{1,2}-[A-Za-z]{3}-\d{4}/) || [""])[0], low: []
    };
  }

  const api = { parse, parseLine, parseWords, floorOf, roomOf, roomBed, group, admitText, merge, fixLocation, fixLos, fixName };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.PList = api;
})(this);
