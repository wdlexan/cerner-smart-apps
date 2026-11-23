/* Antibiotic chooser - pure rules (no DOM). UNVERIFIED draft written by Claude: verify against Island Health formulary, local antibiogram, pharmacy.
   Regimens come from infections-data.js (INF_SITES) + extra-sites.js; these rules only sort and badge them for the patient's criteria.
   node hospitalist-toolkit/tests/test_abxmap.js */
(function () {
  // drug -> class (class id = page key in ../abx/abx-classes-pages.js)
  const DRUGS = [
    { key: "pen", cls: "pen", name: "penicillin", re: /penicillin|amoxicillin|ampicillin|cloxacillin|piperacillin|pip-?tazo/i, bl: true },
    { key: "amino-pen-sidechain", cls: "ceph", name: "cephalexin/cefadroxil", re: /cephalexin|cefadroxil|cefaclor|cefprozil/i, bl: true, ceph: true, sharedSide: true },
    { key: "ceph", cls: "ceph", name: "cephalosporin", re: /\bcef(?!adroxil)\w*|ceftriaxone|cefazolin|cefepime|ceftazidime|cefuroxime|cefixime|cefotaxime|ceftaroline|cefoxitin/i, bl: true, ceph: true },
    { key: "carb", cls: "carb", name: "carbapenem", re: /meropenem|ertapenem|imipenem/i, bl: true, carb: true },
    { key: "aztreonam", cls: "carb", name: "aztreonam", re: /aztreonam/i },
    { key: "vanco", cls: "mrsa", name: "vancomycin", re: /vancomycin/i },
    { key: "linezolid", cls: "mrsa", name: "linezolid", re: /linezolid/i },
    { key: "dapto", cls: "mrsa", name: "daptomycin", re: /daptomycin/i },
    { key: "rifampin", cls: "mrsa", name: "rifampin", re: /rifampin|rifampicin/i },
    { key: "ag", cls: "ag", name: "aminoglycoside", re: /gentamicin|tobramycin|amikacin|aminoglycoside/i },
    { key: "fq", cls: "fq", name: "fluoroquinolone", re: /ciprofloxacin|levofloxacin|moxifloxacin|fluoroquinolone/i },
    { key: "macro", cls: "mac", name: "macrolide", re: /azithromycin|clarithromycin|erythromycin/i },
    { key: "strongcyp", cls: "mac", name: "clarithro/erythro", re: /clarithromycin|erythromycin/i },
    { key: "tetra", cls: "mac", name: "tetracycline", re: /doxycycline|minocycline|tigecycline/i },
    { key: "tmpsmx", cls: "uti", name: "TMP-SMX", re: /tmp-?smx|trimethoprim-sulfamethoxazole|co-?trimoxazole|septra|bactrim/i },
    { key: "nitro", cls: "uti", name: "nitrofurantoin", re: /nitrofurantoin|macrobid/i },
    { key: "fosfo", cls: "uti", name: "fosfomycin", re: /fosfomycin/i },
    { key: "clinda", cls: "anaer", name: "clindamycin", re: /clindamycin/i },
    { key: "metro", cls: "anaer", name: "metronidazole", re: /metronidazole/i },
    { key: "fidax", cls: "cdiff", name: "fidaxomicin", re: /fidaxomicin/i },
    { key: "acyclovir", cls: null, name: "acyclovir", re: /acyclovir|aciclovir|ganciclovir|foscarnet/i }];

  // true if any vancomycin mention is IV (oral/NG/rectal/taper/pulse/125 mg mentions are gut-only, no levels)
  function ivVanco(text) {
    const re = /vancomycin/gi; let m, any = false;
    while ((m = re.exec(text || ""))) { const after = text.slice(m.index, m.index + 45); if (!/\b(po|oral|ng|rectal|taper|pulse|suppressive)\b|125 mg/i.test(after)) any = true; }
    return any;
  }
  function drugsIn(text) { return DRUGS.filter((d) => d.re.test(text || "")); }

  /* Which risk a regimen row is for, read from its setting text. */
  const COND = { mrsa: /mrsa/i, pseudo: /pseudomonas|hospital-acquired|healthcare|nosocomial|neutropeni/i, esbl: /esbl/i };
  function conditionsOf(setting) { return Object.keys(COND).filter((k) => COND[k].test(setting || "")); }

  /* ctx: { allergy: 'none'|'pen-mild'|'pen-severe'|'bl-delayed', sulfa, otherAllergyText, crcl, qtRisk, valproate, warfarin, serotonergic,
            statinColch, pregnant, steroids, age, cdiffHx, risks:{mrsa,pseudo,esbl} }
     returns { status: 'ok'|'caution'|'avoid', notes:[...] } for one regimen text */
  function assess(text, ctx) {
    const ds = drugsIn(text), has = (k) => ds.some((d) => d.key === k), notes = [];
    // first choice = text before the first "or", bracket, semicolon or "step down"; drugs only named after that are alternatives
    const firstPart = String(text || "").split(/\bor\b|\(|;|step(?:\s|-)?down|\+\/-|±/i)[0];
    const inFirst = (keys) => !keys || keys.some((k) => { const d = DRUGS.find((x) => x.key === k); return d && d.re.test(firstPart); });
    let status = "ok";
    const bump = (s, msg, keys) => {
      if (s === "avoid" && !inFirst(keys)) { s = "caution"; msg = "Alternative in this line: " + msg; }
      notes.push({ s, msg }); if (s === "avoid" || (s === "caution" && status === "ok")) status = s === "avoid" ? "avoid" : "caution"; };
    // "X, or Y" regimens: only judge the whole line; notes say which drug
    const a = ctx.allergy || "none";
    if (a === "pen-severe") {
      if (has("pen")) bump("avoid", "Penicillin anaphylaxis/severe immediate reaction: avoid penicillins (incl. pip-tazo, amox-clav).", ["pen"]);
      if (has("amino-pen-sidechain")) bump("avoid", "Cephalexin/cefadroxil share a side chain with amoxicillin/ampicillin – avoid after penicillin anaphylaxis.", ["amino-pen-sidechain"]);
      else if (has("ceph")) bump("caution", "Cephalosporin with dissimilar side chain (cefazolin, ceftriaxone, cefepime): cross-reactivity ~1–2%; usually given with monitoring – first dose observed.");
      if (has("carb")) bump("caution", "Carbapenem after penicillin anaphylaxis: cross-reactivity <1%; generally acceptable with monitoring.");
    } else if (a === "pen-mild") {
      if (has("pen")) bump("caution", "Non-severe penicillin label: PEN-FAST <3 → direct oral amoxicillin challenge / delabel; otherwise choose a cephalosporin.");
    } else if (a === "bl-delayed") {
      if (has("pen") || has("ceph") || has("amino-pen-sidechain") || has("carb")) bump("avoid", "Severe delayed beta-lactam reaction (SJS/TEN, DRESS): avoid all beta-lactams – ID/allergy input.", ["pen", "ceph", "amino-pen-sidechain", "carb"]);
      if (has("aztreonam")) bump("caution", "Aztreonam: usually tolerated, but ask ID/allergy after a severe delayed reaction.");
    }
    if (ctx.sulfa && has("tmpsmx")) bump("avoid", "Sulfonamide antibiotic allergy: avoid TMP-SMX.", ["tmpsmx"]);
    if (ctx.otherAllergyText) ds.forEach((d) => { const m = (text.match(d.re) || [])[0]; if (m && new RegExp(m, "i").test(ctx.otherAllergyText)) bump("avoid", `Allergy recorded to ${m}.`, [d.key]); });
    if (ctx.crcl != null) {
      if (ctx.crcl < 30 && has("nitro")) bump("avoid", `Nitrofurantoin needs CrCl ≥30 (CrCl ~${ctx.crcl}).`, ["nitro"]);
      if (ctx.crcl < 50 && has("ag")) bump("caution", `Aminoglycoside with CrCl ~${ctx.crcl}: nephro/ototoxicity – single dose or avoid; levels.`);
      if (ctx.crcl < 30 && has("tmpsmx")) bump("caution", `TMP-SMX with CrCl ~${ctx.crcl}: halve dose, watch K.`);
      if (ctx.crcl < 50 && has("ceph") && /cefepime/i.test(text)) bump("caution", "Cefepime: dose to CrCl – neurotoxicity if not adjusted.");
      if (ctx.crcl < 50 && has("vanco") && ivVanco(text)) bump("caution", "IV vancomycin: renal dosing and levels (AUC).");
    }
    if (ctx.crcl != null && ctx.crcl < 50 && has("acyclovir")) bump("caution", `Acyclovir/antiviral with CrCl ~${ctx.crcl}: dose for CrCl, IV fluids, daily creatinine – crystal nephropathy and neurotoxicity.`);
    if (ctx.valproate && has("carb")) bump("avoid", "On valproate: carbapenems drop valproate levels within a day → seizures. Choose another agent.", ["carb"]);
    if (ctx.qtRisk && (has("fq") || has("macro"))) bump("caution", "QT risk (long QTc or other QT drugs): fluoroquinolone/macrolide – ECG, K, Mg.");
    if (ctx.warfarin && (has("tmpsmx") || has("metro") || has("fq") || has("strongcyp"))) bump("caution", "On warfarin: INR rises – check INR in 3–5 days or reduce warfarin.");
    if (ctx.serotonergic && has("linezolid")) bump("caution", "Linezolid with SSRI/SNRI/serotonergic drugs: serotonin syndrome risk.");
    if (ctx.statinColch && has("strongcyp")) bump("caution", "Clarithromycin/erythromycin with statin/colchicine/DOAC/CCB: strong CYP3A4 inhibition – prefer azithromycin or hold the interacting drug.");
    if (ctx.pregnant && (has("fq") || has("tetra") || has("ag"))) bump("caution", "Pregnancy: avoid fluoroquinolones, tetracyclines and aminoglycosides if an alternative exists.");
    if (ctx.pregnant && has("tmpsmx")) bump("caution", "Pregnancy: TMP-SMX – avoid in first trimester and near term.");
    if ((ctx.steroids || (ctx.age || 0) >= 65) && has("fq")) bump("caution", "Age ≥65 or steroids: fluoroquinolone tendon rupture, aortic aneurysm, delirium.");
    if (ctx.cdiffHx && (has("clinda") || has("fq"))) bump("caution", "Previous C. difficile: clindamycin and fluoroquinolones carry the highest risk.");
    if (ctx.susc && ctx.susc.rows && ctx.susc.rows.length) suscNotes(text, ctx.susc).forEach((n) => (n.s === "good" ? notes.push(n) : bump(n.s, n.msg)));
    return { status, notes, classes: [...new Set(ds.map((d) => d.cls).filter(Boolean))] };
  }

  /* Sort a site's regimens for the chosen severity and risks.
     returns { main:[...], matched:[...], ifRisk:[...], other:[...] } each item = {row, conds, a} */
  function choose(site, tier, ctx) {
    const risks = ctx.risks || {};
    const out = { main: [], matched: [], ifRisk: [], other: [] };
    (site.abx || []).forEach((row) => {
      const conds = conditionsOf(row.setting), a = assess(row.regimen, ctx), item = { row, conds, a };
      if (tier && row.tier !== tier) { out.other.push(item); return; }
      if (!conds.length) out.main.push(item);
      else if (conds.some((c) => risks[c])) out.matched.push(item);
      else out.ifRisk.push(item);
    });
    const rank = { ok: 0, caution: 1, avoid: 2 };
    ["main", "matched", "ifRisk"].forEach((k) => out[k].sort((x, y) => rank[x.a.status] - rank[y.a.status]));
    return out;
  }

  /* Allergy lines from the site that apply to the chosen allergy. */
  function allergyLines(site, allergy) {
    const L = site.allergy || [];
    if (allergy === "none") return [];
    const re = allergy === "pen-mild" ? /non-?severe|mild|rash|low.risk/i : allergy === "pen-severe" ? /severe|anaphyla|carbapenem|cross/i : /delayed|sjs|ten|dress|all beta|severe/i;
    const hit = L.filter((x) => re.test(x));
    return hit.length ? hit : L;
  }

  function crcl(age, kg, cr, sex) { if (!age || !kg || !cr) return null; return Math.round(((140 - age) * kg * (sex === "female" ? 1.04 : 1.23)) / cr); }

  function note(site, tier, item, ctx) {
    const L = [];
    L.push(`Infection: ${site.label}${tier ? " – " + tier : ""}.`);
    if (item) L.push(`Antibiotic: ${item.row.regimen} (${item.row.setting}).`);
    const al = { none: "no beta-lactam allergy", "pen-mild": "non-severe penicillin allergy label", "pen-severe": "penicillin anaphylaxis/severe immediate reaction", "bl-delayed": "severe delayed beta-lactam reaction" }[ctx.allergy || "none"];
    L.push(`Allergy: ${al}${ctx.sulfa ? "; sulfonamide allergy" : ""}. CrCl ~${ctx.crcl != null ? ctx.crcl + " mL/min" : "___"}.`);
    const r = Object.keys(ctx.risks || {}).filter((k) => ctx.risks[k]).map((k) => ({ mrsa: "MRSA", pseudo: "Pseudomonas/hospital-acquired", esbl: "ESBL" })[k]);
    if (r.length) L.push("Resistance risk: " + r.join(", ") + ".");
    if (item && item.a.notes.length) L.push("Cautions: " + item.a.notes.map((n) => n.msg).join(" "));
    if ((site.duration || []).length) L.push("Planned duration: " + site.duration[0]);
    L.push("Cultures sent: ___. Review at 48–72 h: narrow to cultures, IV→PO, stop date ___.");
    return L.join("\n");
  }


  /* ---------- culture & sensitivity reading (from OCR'd screenshot or pasted text) ---------- */
  const SUSC_DRUGS = [
    ["ampicillin", /\bampicillin\b|\bampic/i], ["amoxicillin", /\bamoxicillin\b(?![\s\/-]*clav)/i], ["amoxicillin-clavulanate", /amoxicillin[\s\/-]*clav|amox[\s\/-]*clav|clavulan/i],
    ["penicillin", /\bpenicillin\b|\bpen ?g\b/i], ["cloxacillin", /cloxacillin|oxacillin|methicillin/i], ["piperacillin-tazobactam", /piperacillin|pip[\s\/-]*tazo|tazocin/i],
    ["cefazolin", /cefazolin/i], ["cephalexin", /cephalexin|cephalothin/i], ["cefuroxime", /cefuroxime/i], ["cefoxitin", /cefoxitin/i],
    ["ceftriaxone", /ceftriaxone/i], ["cefotaxime", /cefotaxime/i], ["ceftazidime", /ceftazidime(?![\s\/-]*avi)/i], ["ceftazidime-avibactam", /ceftazidime[\s\/-]*avi|avycaz/i], ["cefepime", /cefepime/i], ["ceftaroline", /ceftaroline/i], ["cefixime", /cefixime/i],
    ["ertapenem", /ertapenem/i], ["meropenem", /meropenem/i], ["imipenem", /imipenem/i], ["aztreonam", /aztreonam/i],
    ["gentamicin", /gentamicin/i], ["tobramycin", /tobramycin/i], ["amikacin", /amikacin/i],
    ["ciprofloxacin", /ciprofloxacin|\bcipro\b/i], ["levofloxacin", /levofloxacin/i], ["moxifloxacin", /moxifloxacin/i],
    ["tmp-smx", /trimethoprim[\s\/-]*sulfa|sulfamethoxazole|tmp[\s\/-]*smx|co-?trimoxazole|septra|bactrim/i], ["trimethoprim", /\btrimethoprim\b(?![\s\/-]*sulfa)/i],
    ["nitrofurantoin", /nitrofurantoin/i], ["fosfomycin", /fosfomycin/i], ["vancomycin", /vancomycin/i], ["linezolid", /linezolid/i], ["daptomycin", /daptomycin/i],
    ["clindamycin", /clindamycin/i], ["erythromycin", /erythromycin/i], ["azithromycin", /azithromycin/i], ["doxycycline", /doxycycline/i], ["tetracycline", /\btetracycline/i],
    ["tigecycline", /tigecycline/i], ["rifampin", /rifampin|rifampicin/i], ["metronidazole", /metronidazole/i]];
  const ORG_RE = /(escherichia coli|e\. ?coli|klebsiella \w+|proteus \w+|enterobacter \w+|citrobacter \w+|serratia \w+|morganella \w+|pseudomonas aeruginosa|pseudomonas \w+|acinetobacter \w+|stenotrophomonas \w+|haemophilus influenzae|staphylococcus aureus|s\. ?aureus|coagulase[- ]negative staph\w*|staphylococcus \w+|enterococcus faecalis|enterococcus faecium|enterococcus \w*|streptococcus \w+|group [abcg] strep\w*|candida \w+)/i;
  const INTERP = (t) => { t = t.replace(/[§$]/g, (c) => (c === "§" ? "S" : "")).replace(/^[=:.,;'"`]+|[=:.,;'"`]+$/g, "").toUpperCase(); if (/^(S|SUSC\w*|SENS\w*)$/.test(t)) return "S"; if (/^(R|RES\w*)$/.test(t)) return "R"; if (/^(I|INT\w*|SDD)$/.test(t)) return "I"; return null; };

  function parseSusc(text) {
    const out = { organisms: [], flags: { mrsa: false, esbl: false, cre: false }, rows: [], meta: suscMeta(text) };
    // PowerChart's susceptibility grid has row numbers (1, 2, 3 ...) at the start of each line - drop them so they are not read as MICs
    const lines = String(text || "").replace(/\r/g, "").split("\n").map((l) => l.replace(/[|]/g, " ").trim().replace(/^\d{1,3}[.)]?\s+(?=[A-Za-z])/, "")).filter(Boolean);
    lines.forEach((l) => { const m = l.match(ORG_RE); if (m && !SUSC_DRUGS.some(([, re]) => re.test(l)) && out.organisms.length < 3) { const o = m[1].replace(/\s+/g, " "); if (!out.organisms.some((x) => x.toLowerCase() === o.toLowerCase())) out.organisms.push(o); } });
    const all = lines.join(" ");
    if (!out.organisms.length) { const m = all.match(ORG_RE); if (m) out.organisms.push(m[1].replace(/\s+/g, " ")); } // one-line reports: "E. coli ... resistant to X"
    if (/\bmrsa\b|methicillin[- ]resistant|oxacillin[- ]resistant/i.test(all)) out.flags.mrsa = true;
    if (/\besbl\b|extended[- ]spectrum/i.test(all)) out.flags.esbl = true;
    if (/carbapenemase|\bcre\b|\bcpo\b|\bkpc\b|\bndm\b|\boxa-48\b/i.test(all)) out.flags.cre = true;
    const seen = {};
    // table rows: "Ceftriaxone   >=64   R    <=1   S"
    lines.forEach((l) => {
      const hits = SUSC_DRUGS.filter(([, re]) => re.test(l));
      if (hits.length !== 1) return;
      const [name] = hits[0];
      const m0 = l.match(hits[0][1]), rest = l.slice(m0.index + m0[0].length).replace(/^[\w/-]*/, "");
      const footnote = /^\s*\*/.test(rest);
      const after = rest.replace(/^\s*\*/, " ").split(/\s+/);
      const res = after.map(INTERP).filter(Boolean);
      if (!res.length || res.length > 4) return;
      const mic = (rest.match(/[<>]=?\s*\d+(\.\d+)?|\b\d+(\.\d+)?\b/) || [""])[0];
      if (!seen[name]) { seen[name] = 1; out.rows.push(Object.assign({ drug: name, results: res, mic }, footnote ? { footnote: true } : {})); }
    });
    // prose: "resistant to ceftriaxone and ciprofloxacin; susceptible to ertapenem, nitrofurantoin"
    const prose = (word, r) => { const re = new RegExp(word + "\\s+to\\s+([^.;]+)", "gi"); let m; while ((m = re.exec(all))) SUSC_DRUGS.forEach(([n, dre]) => { if (dre.test(m[1]) && !seen[n]) { seen[n] = 1; out.rows.push({ drug: n, results: [r], mic: "" }); } }); };
    prose("resistant", "R"); prose("(?:susceptible|sensitive)", "S"); prose("intermediate", "I");
    return out;
  }

  /* Specimen / accession / status / date from the report header, when the screenshot or text includes it. */
  function suscMeta(text) {
    const t = String(text || ""), g = (re) => { const m = t.match(re); return m ? m[1].replace(/\s+/g, " ").trim() : ""; };
    const spec = g(/\b(urine|blood|sputum|wound|tissue|csf|bone|joint fluid|fluid|swab|bal|bronchial wash|stool|catheter tip|abscess)\b[^\n]{0,20}?\bculture/i);
    const status = g(/result status\s*[-:]\s*(modified|corrected|amended|auth\s*\(verified\)|verified|final|preliminary|prelim)/i);
    return { specimen: spec ? spec.charAt(0).toUpperCase() + spec.slice(1).toLowerCase() : "", accession: g(/accession\s*(?:no\.?|#)?\s*[:#]?\s*([A-Z0-9-]{6,})/i),
      status, modified: /modified|corrected|amended/i.test(status), date: g(/collect\w*\s*[:-]?\s*(\d{1,2}[- ][A-Za-z]{3}[- ]\d{4}|\d{4}-\d{2}-\d{2})/i) };
  }
  const orgKey = (o) => String(o || "").toLowerCase().replace(/^e\.\s*coli$/, "escherichia coli").replace(/^s\.\s*aureus$/, "staphylococcus aureus").replace(/\s+/g, " ").trim();
  const worstOf = (v) => (v.includes("R") ? "R" : v.includes("I") ? "I" : v.includes("S") ? "S" : "");

  /* Several results (one per screenshot / pasted text / chart report) -> one table, one column per organism per result.
     The same organism from two cultures is never merged: different results are flagged instead.
     list = [{ p: parseSusc() output, label }]. Returns the shape parseSusc returns (so assess/suscNotes/consultMsg work) plus cols and discord. */
  function mergeSusc(list) {
    const out = { organisms: [], flags: { mrsa: false, esbl: false, cre: false }, rows: [], cols: [], discord: [], dupes: [] };
    const byDrug = {}, rowOf = (d) => byDrug[d] || (byDrug[d] = out.rows[out.rows.push({ drug: d, results: [], inf: [], mics: [], footnote: false }) - 1]);
    (list || []).forEach((item, ri) => {
      const raw = item.p, p = expandSusc(JSON.parse(JSON.stringify(raw)));
      ["mrsa", "esbl", "cre"].forEach((k) => (out.flags[k] = out.flags[k] || p.flags[k]));
      const n = Math.max(1, p.organisms.length, ...p.rows.filter((r) => !r.derived).map((r) => r.results.length));
      const first = out.cols.length;
      for (let oc = 0; oc < n; oc++) out.cols.push({ ri, oc, org: p.organisms[oc] || (n > 1 ? "Organism " + (oc + 1) : "Organism"), label: item.label || "", meta: raw.meta || {} });
      const colsHere = (re) => out.cols.slice(first).filter((c) => re.test(c.org)).map((c) => c.oc);
      p.rows.filter((r) => !r.derived).forEach((r) => {
        const row = rowOf(r.drug); if (r.footnote) row.footnote = true;
        for (let oc = 0; oc < n; oc++) if (r.results[oc]) { row.results[first + oc] = r.results[oc]; row.inf[first + oc] = ""; if (r.mic && n === 1) row.mics[first + oc] = r.mic; }
      });
      p.rows.filter((r) => r.derived).forEach((r) => {
        let targets, val = () => r.results[0];
        const same = r.derived.match(/^same as (.+)$/);
        if (same) { const src = p.rows.find((x) => x.drug === same[1] && !x.derived); targets = [...Array(n).keys()]; val = (oc) => (src ? src.results[oc] : r.results[0]); }
        else if (/pseudomonas/i.test(r.derived)) targets = colsHere(/pseudomonas/i);
        else if (/enterococcus/i.test(r.derived)) targets = colsHere(/enterococcus/i);
        else if (/MRSA|MSSA/.test(r.derived)) targets = n === 1 ? [0] : colsHere(/aureus|staph/i);
        else targets = [...Array(n).keys()]; // ESBL / carbapenemase: report-level flag
        const row = rowOf(r.drug);
        targets.forEach((oc) => { const v = val(oc); if (v && !row.results[first + oc]) { row.results[first + oc] = v; row.inf[first + oc] = r.derived; } });
      });
    });
    const N = out.cols.length;
    out.rows = out.rows.filter((r) => r.results.some(Boolean));
    out.rows.forEach((r) => {
      for (let c = 0; c < N; c++) { r.results[c] = r.results[c] || ""; r.inf[c] = r.inf[c] || ""; }
      const filled = r.results.map((v, c) => (v ? c : -1)).filter((c) => c >= 0);
      if (filled.length && filled.every((c) => r.inf[c])) r.derived = [...new Set(filled.map((c) => r.inf[c]))].join("; ");
      r.allS = N > 1 && filled.length === N && r.results.every((v) => v === "S");
    });
    out.organisms = [...new Set(out.cols.map((c) => c.org).filter((o) => !/^Organism/.test(o)))];
    // same organism in two or more results with different calls
    const groups = {};
    out.cols.forEach((c, i) => { const k = orgKey(c.org); if (!/^organism/.test(k)) (groups[k] = groups[k] || []).push(i); });
    Object.keys(groups).forEach((k) => {
      const idx = groups[k]; if (new Set(idx.map((i) => out.cols[i].ri)).size < 2) return;
      out.rows.forEach((r) => {
        const vals = idx.filter((i) => r.results[i] && !r.inf[i]).map((i) => ({ i, v: r.results[i] }));
        if (new Set(vals.map((x) => x.v)).size > 1) { r.discord = true; out.discord.push({ org: out.cols[idx[0]].org, drug: r.drug, vals }); }
      });
    });
    // the same accession loaded twice (e.g. the original and a Modified report)
    const acc = {};
    (list || []).forEach((it, ri) => { const a = it.p.meta && it.p.meta.accession; if (a) (acc[a] = acc[a] || []).push(ri); });
    Object.keys(acc).forEach((a) => acc[a].length > 1 && out.dupes.push({ accession: a, ri: acc[a] }));
    return out;
  }

  /* Add what the report implies but does not list. */
  function expandSusc(p) {
    const has = (n) => p.rows.some((r) => r.drug === n), add = (n, r, why) => { if (!has(n)) p.rows.push({ drug: n, results: [r], mic: "", derived: why }); };
    const res = (n) => { const r = p.rows.find((x) => x.drug === n); return r ? (r.results.includes("R") ? "R" : r.results.includes("I") ? "I" : "S") : null; };
    const staph = p.organisms.some((o) => /aureus|staph/i.test(o));
    if (p.flags.mrsa || (staph && res("cloxacillin") === "R")) {
      p.flags.mrsa = true;
      ["cloxacillin", "cefazolin", "cephalexin", "amoxicillin-clavulanate", "piperacillin-tazobactam", "ceftriaxone", "cefepime", "meropenem", "ertapenem", "penicillin", "ampicillin", "amoxicillin"].forEach((n) => add(n, "R", "MRSA"));
    } else if (staph && res("cloxacillin") === "S") ["cefazolin", "cephalexin", "amoxicillin-clavulanate", "piperacillin-tazobactam"].forEach((n) => add(n, "S", "MSSA (cloxacillin S)"));
    if (p.flags.esbl) ["ampicillin", "amoxicillin", "cefazolin", "cephalexin", "cefuroxime", "ceftriaxone", "cefotaxime", "ceftazidime", "cefepime", "aztreonam"].forEach((n) => add(n, "R", "ESBL"));
    if (p.flags.cre) ["ertapenem", "meropenem", "imipenem"].forEach((n) => add(n, "R", "carbapenemase"));
    if (res("ampicillin")) add("amoxicillin", res("ampicillin"), "same as ampicillin");
    if (res("cefazolin") && p.organisms.length <= 1 && !p.organisms.some((o) => /aureus|staph/i.test(o))) add("cephalexin", res("cefazolin"), "same as cefazolin");
    if (res("ceftriaxone")) add("cefotaxime", res("ceftriaxone"), "same as ceftriaxone");
    if (p.organisms.some((o) => /enterococcus/i.test(o))) ["cefazolin", "cephalexin", "ceftriaxone", "cefepime", "cloxacillin", "clindamycin", "tmp-smx"].forEach((n) => add(n, "R", "Enterococcus: intrinsic"));
    if (p.organisms.some((o) => /pseudomonas/i.test(o))) ["ampicillin", "amoxicillin", "amoxicillin-clavulanate", "cefazolin", "cephalexin", "ceftriaxone", "cefuroxime", "ertapenem", "tmp-smx", "doxycycline", "nitrofurantoin"].forEach((n) => add(n, "R", "Pseudomonas: intrinsic"));
    return p;
  }

  /* Judge a regimen against culture results: returns notes [{s, msg}] - "avoid" only if the first-choice drug is R. */
  function suscNotes(text, susc) {
    const notes = [], first = String(text || "").split(/\bor\b|\(|;|step(?:\s|-)?down|\+\/-|±/i)[0];
    (susc.rows || []).forEach((r) => {
      const d = SUSC_DRUGS.find(([n]) => n === r.drug); if (!d || !d[1].test(text)) return;
      const worst = r.results.includes("R") ? "R" : r.results.includes("I") ? "I" : r.results.length ? "S" : null;
      const src = r.derived ? ` (inferred: ${r.derived})` : " on the culture";
      if (worst === "R") notes.push({ s: d[1].test(first) ? "avoid" : "caution", msg: `${d[1].test(first) ? "" : "Alternative in this line: "}${r.drug} RESISTANT${src}.` });
      else if (worst === "I") notes.push({ s: "caution", msg: `${r.drug} intermediate / dose-dependent${src} – use high dose or another agent.` });
      else if (worst === "S") notes.push({ s: "good", msg: `${r.drug} susceptible${src}.` });
    });
    return notes;
  }

  /* Consult message in Wayne's format, ~50 words between greeting and sign-off. o = { drName, service, name, age, sex, mrn, site, tier,
     abx:[current antibiotics], susc, allergy, reason, extra } */
  const words = (t) => (String(t).trim().match(/\S+/g) || []).length;
  const shortReason = (r) => String(r || "").replace(/\s*\(.*?\)/g, "").split(/ - | – |;/)[0].trim();
  const CONSULT_NOUN = { skin: "a skin and soft tissue infection", lung: "pneumonia", uti: "a urinary tract infection", prostate: "acute bacterial prostatitis", groin: "a groin/perineal infection", joint: "a possible septic joint", divert: "diverticulitis/intra-abdominal infection", biliary: "cholangitis/cholecystitis", mening: "meningitis", enceph: "encephalitis", sinus: "sinusitis", dental: "a deep neck/odontogenic infection", tb: "possible TB", sepsis: "sepsis without a clear source", cdiff: "C. difficile colitis" };
  function consultMsg(o) {
    const sexWord = o.sex === "female" ? "woman" : o.sex === "male" ? "man" : "patient";
    const who = [o.name || "___", o.age != null ? `${o.age}` : "", o.mrn ? `MRN ${o.mrn}` : "MRN ___"].filter(Boolean).join(", ");
    const prob = o.problem || (o.site && (CONSULT_NOUN[o.site.id] || o.site.label)) || "an infection";
    const site = prob.replace(/\s*\(.*?\)/g, "").replace(/^[A-Z](?=[a-z])/, (c) => c.toLowerCase()).trim();
    const bits = [`a ${sexWord} with ${o.tier === "severe" && !/severe|shock|sepsis/i.test(site) ? "severe " : ""}${site}`];
    const org = o.susc && o.susc.organisms && o.susc.organisms.length ? o.susc.organisms.join(" and ") : "";
    const resist = o.susc ? o.susc.rows.filter((r) => !r.derived && r.results.includes("R")).map((r) => r.drug).slice(0, 3) : [];
    const flags = o.susc ? ["mrsa", "esbl", "cre"].filter((k) => o.susc.flags[k]).map((k) => ({ mrsa: "MRSA", esbl: "ESBL", cre: "carbapenemase-producing" })[k]) : [];
    const optional = [];
    if (!org && (flags.length || resist.length)) optional.push(`Cultures show ${flags.length ? flags.join(" ") + " organism" : "a resistant organism"}${resist.length ? " (resistant to " + resist.join(", ") + ")" : ""}.`);
    if (org) optional.push(`Cultures grew ${flags.length ? flags.join(" ") + " " : ""}${org}${resist.length ? " (resistant to " + resist.join(", ") + ")" : ""}.`);
    optional.push(o.abx && o.abx.length ? `Currently on ${o.abx.slice(0, 2).join(" and ")}.` : "No antibiotics started yet.");
    if (o.allergy && o.allergy !== "none") optional.push({ "pen-mild": "Non-severe penicillin allergy label.", "pen-severe": "Penicillin anaphylaxis.", "bl-delayed": "Severe delayed beta-lactam reaction." }[o.allergy]);
    if (o.extra) optional.push(o.extra.trim().replace(/([^.])$/, "$1."));
    const ask = `Could you see ${o.sex === "female" ? "her" : o.sex === "male" ? "him" : "them"} ${o.service === "ID" ? "for advice on " : "to assess "}${shortReason(o.reason) ? shortReason(o.reason).replace(/^[A-Z]/, (c) => c.toLowerCase()) : "management"}?`;
    let body;
    for (let n = optional.length; n >= 0; n--) {   // drop the least important pieces until ~50 words
      body = `I have ${who}, ${bits[0]}. ${optional.slice(0, n).join(" ")} ${ask}`.replace(/\s+/g, " ").trim();
      if (words(body) <= 55) break;
    }
    const sig = String(o.sig || "").trim();
    return { text: `Hello Dr. ${o.drName || "___"},\n\nThis is Wayne, hospitalist. ${body}\n\nYour help is much appreciated.\n\nThanks,\nWayne${sig ? "\n" + sig : ""}`, words: words(body) + 4 };
  }

  const api = { consultMsg, CONSULT_NOUN, parseSusc, expandSusc, mergeSusc, suscMeta, worstOf, suscNotes, SUSC_DRUGS, DRUGS, drugsIn, ivVanco, conditionsOf, assess, choose, allergyLines, crcl, note };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else window.AbxMapRules = api;
})();
