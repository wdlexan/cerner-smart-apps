/* Patient list - "Chart info" for one patient: pull the list columns out of a pasted note or a chart screenshot's text.
   Fills: MOST, allergy, gfr (eGFR, or CKD-EPI 2021 from creatinine), vtep, iv, foley, isolation, issues (numbered
   Assessment/Plan items), lab (pending), to do (plan lines), pmhx (Past Medical History / chronic problems).
   Only what is found is filled; every field stays editable in the tab. Pure functions so tests can run in node. */
(function (root) {
  "use strict";
  const lines = (t) => String(t || "").replace(/\r/g, "").split("\n");
  const squash = (s) => String(s || "").replace(/\s+/g, " ").trim();

  // CKD-EPI 2021 (no race term), creatinine in umol/L - same formula as the AKI tab
  function egfr(scrUmol, age, sex) {
    if (!(scrUmol > 0) || !(age > 0) || !/^[MF]/i.test(sex || "")) return null;
    const f = /^F/i.test(sex), k = f ? 0.7 : 0.9, a = f ? -0.241 : -0.302, s = scrUmol / 88.4 / k;
    return Math.round(142 * Math.pow(Math.min(s, 1), a) * Math.pow(Math.max(s, 1), -1.2) * Math.pow(0.9938, age) * (f ? 1.012 : 1));
  }

  // text between a heading and the next of several headings
  function section(text, start, ends) {
    const m = text.match(start);
    if (!m) return "";
    const rest = text.slice(m.index + m[0].length);
    let cut = rest.length;
    ends.forEach((re) => { const e = rest.match(re); if (e && e.index < cut) cut = e.index; });
    return rest.slice(0, cut);
  }
  const HEADS = [/\n\s*(?:Specialists? Consulted|Disposition|Discharge (?:Plan|Medications)|Medications|Follow[- ]?up|Physical Exam(?:ination)?|Objective|Labs?|Investigations|Code Status)\b/i];

  // anticoagulants / VTE prophylaxis, loose enough for OCR slips ("apbxaban")
  const ANTICOAG = /\b(\w{2,7}xaban|eliquis|xarelto|lixiana|dabig\w*|pradaxa|w\w{2}farin|coumadin|\w{2,5}aparin|lovenox|fragmin|innohep|fondaparinux|heparin\s+\d[\d,]*\s*(?:units?|intunit)\s*(?:sub-?cut|sc|subcutaneous))\b/i;
  const FLUID = /\b(NS|normal saline|0\.9\s*%?\s*(?:NaCl|saline)|RL|LR|ringer'?s?(?: lactate)?|plasma-?lyte|D5W|D5\s*1\/2\s*NS|2\/3\s*[-–]?\s*1\/3)\b[^.\n]{0,25}?(?:at\s*)?(\d{2,3})\s*(?:mL|ml|cc)\s*\/\s*(?:h|hr|hour)\b/i;
  const TODO = /\b(repeat|recheck|re-?check|follow[- ]?up|f\/u|refer(?:red|ral)?|consider|plan(?:ned)?|if\b.*\b(?:start|consider|give)|until|x\s*\d+\s*(?:d|days)\b|replace|book|arrange|await(?:ing)?|pending|discontinue\b|stop\b|wean|taper)/i;

  function parse(text, ctx) {
    ctx = ctx || {};
    const t = "\n" + String(text || "") + "\n", out = {}, found = [];
    const note = (k, v, why) => { out[k] = v; found.push({ field: k, value: v, from: squash(why).slice(0, 90) }); };

    let m = t.match(/\bMOST\b\s*(?:status)?\s*[:\-]?\s*([MC])\s*-?\s*([0-3])\b/i);
    if (m) note("most", (m[1] + m[2]).toUpperCase(), m[0]);

    // Allergy: "No Known (Drug) Allergies" in any spacing (screenshots keep wide gaps, or run words together) means n.
    // A listed allergy means y. If the text says both, the field is left empty for you to check.
    const neg = t.match(/\bno\s*kn[o0]wn\s*(?:drug\s*|medication\s*|med\s*)?al+er\w*|\bNKD?A\b|\ballerg(?:y|ies)\s*[:\-]?\s*(?:none|nil)\b/i);
    let pos = null;
    const pre = /\ballerg(?:y|ies)[ \t]*:[ \t]*([^\n]+)/gi;
    let am; while ((am = pre.exec(t))) {
      const v = am[1].trim();
      if (/^(none|nil|no\b|no\s*kn|nk|not (?:recorded|assessed)|unknown|n\/a)/i.test(v) || !/[a-z]{3}/i.test(v) || /^(alerts|precautions|dosing|most)\b/i.test(v)) continue;
      pos = am; break;
    }
    if (neg && pos) found.push({ field: "allergy", value: "", from: "both “" + squash(neg[0]) + "” and “" + squash(pos[0]).slice(0, 50) + "” – check" });
    else if (neg) note("allergy", "n", neg[0]);
    else if (pos) note("allergy", "y", pos[0]);

    m = t.match(/\beGFR\b[^0-9\n]{0,20}(\d{1,3})\b/i);
    if (m) note("gfr", +m[1], m[0]);
    else if ((m = t.match(/\bCreatinine\b[^0-9\n]{0,30}(\d{2,4}(?:\.\d)?)\s*(?:umol|µmol|μmol)/i))) {
      const g = egfr(+m[1], ctx.age, ctx.sex);
      if (g != null) note("gfr", g, m[0] + ` → eGFR ${g} (CKD-EPI 2021, age ${ctx.age} ${ctx.sex})`);
      out.creatinine = +m[1];
    }

    m = t.match(ANTICOAG);
    if (m) note("vtep", "y", (t.slice(Math.max(0, m.index - 10), m.index + 60).split("\n").find((l) => ANTICOAG.test(l)) || m[0]));

    m = t.match(FLUID);
    if (m) note("iv", m[1].replace(/normal saline|0\.9.*/i, "NS").replace(/ringer'?s?(?: lactate)?|LR/i, "RL").toUpperCase().replace("PLASMA-LYTE", "Plasma-Lyte") + " " + m[2] + " mL/h", m[0]);

    // Foley: the last statement in the text wins (in situ / replaced vs removed)
    const fy = [], fre = /[^.\n]*\b(foley|indwelling (?:urinary )?catheter|IDC)\b[^.\n]*/gi;
    let f; while ((f = fre.exec(t))) {
      const s = f[0];
      if (/\b(removed|discontinued|d\/c'?d|out\b|pulled|taken out|no longer)\b/i.test(s) && !/\b(replace|reinsert|re-?insert)/i.test(s)) fy.push(["n", s]);
      else if (/\b(in situ|in place|inserted|replace|reinsert|re-?insert|indwelling|has a|with a|draining|change)\b/i.test(s)) fy.push(["y", s]);
    }
    if (fy.length) note("foley", fy[fy.length - 1][0], fy[fy.length - 1][1]);

    m = t.match(/\b(contact|droplet|airborne)(?:\s*(?:\/|and|plus|\+)\s*(contact|droplet|airborne))?\s*(?:plus\s*)?(?:precautions|isolation)\b/i);
    if (m) note("isolation", squash(m[0]).replace(/\s*(precautions|isolation)$/i, "").toLowerCase(), m[0]);
    else if ((m = t.match(/\bPrecautions[ \t]*:[ \t]*([A-Za-z][^\n]{1,40})/)) && !/^(none|nil|alerts|dosing|most\b|allerg|pcp|mrn|code status)/i.test(m[1].trim())) note("isolation", squash(m[1]).toLowerCase(), m[0]);

    // Issues: the numbered Assessment/Plan items. To do: plan lines under them, labelled with their problem.
    const ap = section(t, /\n\s*(?:Assessment\s*(?:\/|and|&)\s*Plan|Assessment|Impression and Plan|A\/P|Plan)\s*:?\s*\n/i, HEADS) || "";
    const issues = [], todo = [];
    let cur = "";
    const L = lines(ap);
    L.forEach((ln, i) => {
      const n = ln.match(/^\s*\d{1,2}[.)]\s*(.+?)\s*$/);
      if (n && n[1].length < 80) { cur = n[1].replace(/\s*\(.*?\)\s*$/, ""); issues.push(cur); return; }
      // unnumbered heading (chronic / resolved problems): short title line, next line indented, a bullet, or "resolved"
      const next = L.slice(i + 1).find((x) => x.trim()) || "";
      if (/^[A-Z][A-Za-z ,'/-]{2,45}$/.test(ln.trim()) && !/^\s/.test(ln) && ln.trim().split(" ").length <= 5 && !TODO.test(ln) &&
          (/^\s+\S/.test(next) || /^\s*[-•*]/.test(next) || /^\s*(resolved|stable|improving|ongoing)\b/i.test(next))) { cur = ln.trim(); return; }
      ln.split(/(?<=\.)\s+(?=[A-Z])/).forEach((s) => {
        s = squash(s).replace(/^[-•*]\s*/, "");
        if (!s || !TODO.test(s) || /\b(completed|resolved|discontinued\.?$|was treated|showed)\b|\b(?:are|is|was|were) (?:stable|normal|negative|unremarkable|done)\b/i.test(s)) return;
        const lab = cur ? short(cur) + ": " : "";
        todo.push(lab + s.replace(/\.$/, ""));
      });
    });
    if (issues.length) note("issues", issues, issues.join("; "));
    const dispo = t.match(/\n\s*Disposition\s*:?\s*\n?\s*([^\n]{2,40})/i);
    if (dispo && !/^\s*(pending|tbd)?\s*$/i.test(dispo[1])) todo.unshift("Dispo: " + squash(dispo[1]).replace(/\.\s*$/, ""));
    const seen = new Set(), td = todo.filter((x) => { const k = x.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 10);
    if (td.length) note("todo", td, td.join("; "));

    // Pending labs / imaging
    const pend = [];
    lines(t).forEach((ln) => { if (/\b(pending|awaiting|to follow|sent out|send-?out)\b/i.test(ln) && !/no (results )?pending/i.test(ln)) pend.push(squash(ln).replace(/^[-•*]\s*/, "").slice(0, 60)); });
    if (pend.length) note("lab", pend.slice(0, 3).join("; "), pend.join("; "));

    // PMHx: chronic / past medical history list
    const pm = section(t, /\n\s*(?:Past Medical History(?:\/Chronic Problems)?|PMHx?|Chronic Problems)\s*:?\s*\n/i,
      [/\n\s*(?:Historical|Assessment|Plan|Medications|Social|Family|Allergies|Hospital Course|Surgical History|Review of Systems)\b/i]);
    const pmh = lines(pm).map((l) => squash(l).replace(/^[-•*]\s*/, "")).filter((l) => l && !/^(ongoing|active|none|no problems recorded)$/i.test(l) && l.length < 70);
    if (pmh.length) note("pmhx", pmh.join(", "), pmh.join(", "));

    return { fields: out, found };
  }
  function short(s) { return s.replace(/\b(right|left)\b/i, (x) => x[0].toUpperCase()).split(" ").slice(0, 3).join(" "); }

  // does the text belong to this patient? its surname, MRN or FIN appears in it
  function mentions(text, row) {
    row = row || {}; text = String(text || "");
    const sur = String(row.name || "").split(",")[0].trim();
    if (!sur && !row.mrn && !row.fin) return true;
    if (sur && new RegExp("\\b" + sur.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b", "i").test(text)) return true;
    const digits = text.replace(/\D+/g, " ");
    return [row.mrn, row.fin].some((id) => id && id.length >= 7 && (" " + digits + " ").includes(" " + id + " "));
  }

  const api = { parse, egfr, mentions };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.PChart = api;
})(this);
