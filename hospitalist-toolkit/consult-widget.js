/* Consult message button - shared by the toolkit shell and the standalone apps. Read-only; nothing is sent anywhere.
   Builds a ~50-word message in Wayne's format:
     Hello Dr. ___,  This is Wayne, hospitalist. I have NAME, AGE, MRN ___, ... Could you see ... ?  Your help is much appreciated.  Thanks, Wayne
   Patient comes from window.CONSULT_CTX (set by the toolkit shell: { client, topic(), tabKey() }) or from the page's own SMART session.
   Inside toolkit iframes the shell shows the button, so tool pages do not. UNVERIFIED draft written by Claude. */
(function () {
  if (window.__consultWidget) return; window.__consultWidget = true;
  try { if (window.top !== window && window.top.__consultWidget) return; } catch (e) { /* cross-origin parent: show it */ }

  const SERVICES = ["Infectious diseases", "General surgery", "Internal medicine", "Cardiology", "Nephrology", "Neurology", "Gastroenterology", "Respirology", "Hematology", "Rheumatology", "Medical oncology", "Endocrinology", "Geriatrics", "Palliative care", "Psychiatry", "Orthopedics", "Urology", "Neurosurgery", "Vascular surgery", "Thoracic surgery", "Interventional radiology", "ICU", "Other"];
  // toolkit tab key -> usual service
  const BY_TAB = { abx: "Infectious diseases", fuo: "Infectious diseases", abxmap: "Infectious diseases", infections: "Infectious diseases", aki: "Nephrology", transplant: "Nephrology", hypona: "Nephrology", lytes: "Nephrology", acidbase: "Nephrology",
    stroke: "Neurology", neuro: "Neurology", seizure: "Neurology", ae: "Neurology", dementia: "Geriatrics", pd: "Neurology", acs: "Cardiology", chf: "Cardiology", af: "Cardiology", liver: "Gastroenterology", ibd: "Gastroenterology",
    pc: "Medical oncology", onc: "Medical oncology", ild: "Respirology", tox: "Medical oncology", bispecific: "Medical oncology", g6pd: "Hematology", sero: "Rheumatology", hip: "Orthopedics", pain: "Palliative care", diabetes: "Endocrinology", ed: "Psychiatry", edr: "Psychiatry",
    opioid: "Palliative care", hah: "Internal medicine", mobility: "Geriatrics", falls: "Geriatrics" };
  const BY_TITLE = [[/serolog|rheumat|lupus|vasculitis/i, "Rheumatology"], [/infect|antibiot|abx|sepsis|fever|fuo/i, "Infectious diseases"], [/\baki\b|kidney|renal|transplant|electrolyte|sodium|acid/i, "Nephrology"], [/stroke|seizure|neuro|encephalit/i, "Neurology"],
    [/dementia|falls|mobility/i, "Geriatrics"], [/heart|chf|atrial|cardi|nstemi|coronary/i, "Cardiology"], [/liver|cirrho|ibd|crohn|colitis/i, "Gastroenterology"], [/carcinomatosis|oncolog|myeloma|bispecific|toxicit/i, "Medical oncology"],
    [/g6pd|hemat/i, "Hematology"], [/hip|fracture|ortho/i, "Orthopedics"], [/pain|opioid|palliat/i, "Palliative care"], [/diabet/i, "Endocrinology"], [/eating disorder/i, "Psychiatry"]];

  const css = `
  #cw-btn{position:fixed;right:16px;bottom:16px;z-index:99998;background:#0b6bcb;color:#fff;border:0;border-radius:22px;padding:9px 15px;font:600 13.5px system-ui,-apple-system,"Segoe UI",sans-serif;box-shadow:0 3px 10px rgba(0,0,0,.25);cursor:pointer}
  #cw-btn:hover{background:#0957a6}
  #cw-pan{position:fixed;right:16px;bottom:62px;z-index:99999;width:min(460px,calc(100vw - 32px));max-height:calc(100vh - 90px);overflow:auto;background:#fff;color:#1f2933;border:1px solid #cfd6df;border-radius:12px;box-shadow:0 8px 28px rgba(0,0,0,.25);padding:12px 14px;font:13.5px system-ui,-apple-system,"Segoe UI",sans-serif;display:none}
  #cw-pan h3{margin:0 0 6px;font-size:15px} #cw-pan .row{display:flex;gap:6px;flex-wrap:wrap;margin:5px 0;align-items:center}
  #cw-pan label{font-size:12px;color:#5f6c7b;display:flex;flex-direction:column;gap:2px;flex:1;min-width:120px}
  #cw-pan input,#cw-pan select,#cw-pan textarea{font:13px system-ui,sans-serif;padding:4px 6px;border:1px solid #cfd6df;border-radius:6px;background:#fff;color:#1f2933;width:100%;box-sizing:border-box}
  #cw-pan textarea{min-height:150px;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12.5px}
  #cw-pan .acts{display:flex;justify-content:space-between;align-items:center;margin-top:6px} #cw-pan .muted{color:#5f6c7b;font-size:12px}
  #cw-pan button{font:600 13px system-ui,sans-serif;border-radius:6px;padding:5px 12px;cursor:pointer;border:1px solid #0b6bcb;background:#0b6bcb;color:#fff} #cw-pan button.ghost{background:#fff;color:#0b6bcb}
  @media (prefers-color-scheme: dark){#cw-pan{background:#1a1f26;color:#e8edf2;border-color:#2b333d}#cw-pan input,#cw-pan select,#cw-pan textarea{background:#111418;color:#e8edf2;border-color:#2b333d}#cw-pan .muted,#cw-pan label{color:#9aa7b5}#cw-pan button.ghost{background:#1a1f26}}
  @media print{#cw-btn,#cw-pan{display:none!important}}`;

  const words = (t) => (String(t).trim().match(/\S+/g) || []).length;
  const ageOf = (b) => { if (!b) return null; const d = new Date(b), n = new Date(); let a = n.getFullYear() - d.getFullYear(); if (n < new Date(n.getFullYear(), d.getMonth(), d.getDate())) a--; return isNaN(a) ? null : a; };


  /* ---- labs: short names, which are pertinent to each service ---- */
  const LAB_SHORT = [[/creatinine(?!.*(urine|clearance|kinase|ratio))/i, "Cr"], [/^potassium|potassium,? (serum|plasma|blood)/i, "K"], [/^sodium|sodium,? (serum|plasma|blood)/i, "Na"], [/bicarbonate|total co2|\bco2\b|\bhco3/i, "HCO3"], [/urea|\bbun\b/i, "Urea"],
    [/hemoglobin(?!.*a1c)|haemoglobin(?!.*a1c)|^hgb\b|^hb\b/i, "Hb"], [/platelet/i, "Plt"], [/^wbc|white blood|leukocyte(?!.*esterase)/i, "WBC"], [/neutrophil/i, "Neut"], [/c.reactive|^crp/i, "CRP"], [/lactate(?! dehydrogenase)|lactic/i, "Lactate"],
    [/procalcitonin/i, "PCT"], [/troponin/i, "Trop"], [/bnp|natriuretic/i, "NT-proBNP"], [/bilirubin/i, "Bili"], [/\balt\b|alanine/i, "ALT"], [/\bast\b|aspartate/i, "AST"], [/alkaline phos|\balp\b/i, "ALP"],
    [/\binr\b|prothrombin/i, "INR"], [/albumin(?!.*urine)/i, "Alb"], [/lipase/i, "Lipase"], [/glucose/i, "Gluc"], [/a1c/i, "A1c"], [/^calcium|calcium,? (total|serum)/i, "Ca"], [/magnesium/i, "Mg"], [/phosph(?!atase)/i, "PO4"],
    [/lactate dehydrogenase|\bldh\b/i, "LDH"], [/ferritin/i, "Ferritin"], [/haptoglobin/i, "Hapto"], [/reticulocyte/i, "Retic"], [/\bpco2\b/i, "pCO2"], [/^ph\b|\bph,? (arterial|venous|blood)/i, "pH"], [/\btsh\b|thyrotropin/i, "TSH"], [/b12|cobalamin/i, "B12"],
    [/\bcea\b/i, "CEA"], [/ca[ -]?125/i, "CA-125"], [/ck\b|creatine kinase/i, "CK"], [/ammonia/i, "NH3"], [/osmolal/i, "Osm"]];
  const PERTINENT = { "Infectious diseases": ["WBC", "CRP", "Lactate", "PCT", "Cr", "Neut"], "General surgery": ["WBC", "Lactate", "Hb", "Lipase", "Bili", "Cr", "INR"], "Internal medicine": ["Hb", "WBC", "Na", "K", "Cr"],
    Cardiology: ["Trop", "NT-proBNP", "K", "Mg", "Cr", "Hb"], Nephrology: ["Cr", "Urea", "K", "Na", "HCO3", "PO4", "Ca"], Neurology: ["Na", "Gluc", "Ca", "WBC"], Gastroenterology: ["Hb", "Bili", "ALT", "ALP", "INR", "Alb", "Lipase", "Plt"],
    Respirology: ["WBC", "CRP", "pCO2", "pH", "NT-proBNP"], Hematology: ["Hb", "Plt", "WBC", "Neut", "INR", "LDH", "Bili", "Retic", "Hapto"], "Medical oncology": ["Hb", "Plt", "WBC", "Neut", "Ca", "Cr", "Alb", "Bili"],
    Endocrinology: ["Gluc", "A1c", "Na", "K", "HCO3", "Ca", "TSH"], Geriatrics: ["Na", "Ca", "Hb", "Cr", "TSH", "B12"], "Palliative care": ["Ca", "Cr", "Na", "Alb", "Hb"], Psychiatry: ["Na", "K", "PO4", "Mg", "Gluc"],
    Orthopedics: ["Hb", "Cr", "INR", "Plt", "WBC"], Urology: ["Cr", "K", "WBC", "Hb"], Neurosurgery: ["Na", "INR", "Plt", "Hb"], "Vascular surgery": ["Hb", "Cr", "Lactate", "INR"], "Thoracic surgery": ["WBC", "Hb", "INR"],
    "Interventional radiology": ["INR", "Plt", "Hb", "Cr"], ICU: ["Lactate", "pH", "pCO2", "HCO3", "Cr", "K", "WBC", "Hb"], Other: [] };
  const shortName = (n) => { const h = LAB_SHORT.find(([re]) => re.test(n || "")); return h ? h[1] : null; };
  const fmtV = (v) => (Math.abs(v) >= 100 ? Math.round(v) : +(+v).toFixed(Math.abs(v) < 10 ? 2 : 1)).toString().replace(/\.0+$/, "");
  /* observations -> [{key, label, v, prev, unit, t, flag}] latest per short name, newest first */
  function summarizeLabs(obs) {
    const by = {};
    (obs || []).forEach((o) => {
      if (!o || !o.valueQuantity || o.valueQuantity.value == null || /entered-in-error|cancelled/.test(o.status || "")) return;
      const name = (o.code && (o.code.text || ((o.code.coding || [])[0] || {}).display)) || "", key = shortName(name);
      if (!key || /urine|fluid|csf|ascit|pleural/i.test(name)) return;
      const t = new Date(o.effectiveDateTime || o.issued || 0).getTime(); if (!t) return;
      const interp = ((o.interpretation || [])[0] || {}), code = ((interp.coding || [])[0] || {}).code || interp.text || "";
      (by[key] = by[key] || []).push({ v: +o.valueQuantity.value, unit: o.valueQuantity.unit || "", t, flag: /^(H|HH|L|LL|A|AA|HU|LU)$/.test(code) ? code : "" });
    });
    return Object.entries(by).map(([key, a]) => { a.sort((x, y) => y.t - x.t); const vs = a.map((x) => x.v);
      return { key, v: a[0].v, unit: a[0].unit, t: a[0].t, flag: a[0].flag, prev: a.length > 1 ? a[1].v : null, min: Math.min(...vs), max: Math.max(...vs), n: a.length }; }).sort((x, y) => y.t - x.t);
  }
  function labLine(labs) { return labs.length ? "Labs: " + labs.map((l) => `${l.key} ${fmtV(l.v)}${l.prev != null && fmtV(l.prev) !== fmtV(l.v) ? ` (prev ${fmtV(l.prev)})` : ""}`).join(", ") + "." : ""; }

  /* Pure builder (also used by tests): o = { dr, service, name, age, sex, mrn, problem, hx, why } */
  function build(o) {
    const sexWord = o.sex === "female" ? "woman" : o.sex === "male" ? "man" : "patient", pro = o.sex === "female" ? "her" : o.sex === "male" ? "him" : "them";
    const who = [o.name || "___", o.age != null && o.age !== "" ? String(o.age) : "", "MRN " + (o.mrn || "___")].filter(Boolean).join(", ");
    const prob = String(o.problem || "___").trim().replace(/^[A-Z](?=[a-z])/, (c) => c.toLowerCase());
    const art = /^(a|an|the|possible|suspected|new|acute|chronic|severe|recurrent)\b/i.test(prob) || /^[A-Z0-9]{2,}/.test(prob) || /^[A-Z]\.\s/.test(prob) || /s$/.test(prob) || prob === "___" ? "" : /^[aeiou]/i.test(prob) ? "an " : "a ";
    const hx = String(o.hx || "").trim().replace(/([^.!?])$/, "$1.");
    const why = String(o.why || "").trim().replace(/[.?]+$/, "");
    const ask = why ? (o.service === "Infectious diseases" || /advice|recommend|antibiotic|dose|which/i.test(why) ? `Could you see ${pro} for advice on ${why.replace(/^[A-Z](?=[a-z])/, (c) => c.toLowerCase())}?` : `Could you see ${pro} to ${/^(assess|review|help|consider|see|evaluate|manage)\b/i.test(why) ? why.replace(/^[A-Z]/, (c) => c.toLowerCase()) : "assess " + why.replace(/^[A-Z](?=[a-z])/, (c) => c.toLowerCase())}?`) : `Could you see ${pro}? ___`;
    const labs = String(o.labs || "").trim().replace(/([^.])$/, "$1.");
    const body = `I have ${who}, a ${sexWord} with ${art}${prob}. ${hx} ${labs === "." ? "" : labs} ${ask}`.replace(/\s+/g, " ").trim();
    const sig = String(o.sig || "").trim();
    return { text: `Hello Dr. ${o.dr || "___"},\n\nThis is Wayne, hospitalist. ${body}\n\nYour help is much appreciated.\n\nThanks,\nWayne${sig ? "\n" + sig : ""}`, words: words(body) + 4 };
  }
  // Specialist list: one per line "Name | Service | cell". Kept in this browser only (localStorage), never in the public code.
  function parseContacts(txt) {
    return String(txt || "").split(/\r?\n/).filter((l) => !/^\s*#/.test(l)).map((l) => l.split("|").map((x) => x.trim())).filter((p) => p[0]).map(([name, svc, cell]) => {
      if (!cell && /\d{3}/.test(svc || "")) { cell = svc; svc = ""; }
      const s = svc ? SERVICES.find((x) => x.toLowerCase().startsWith(svc.toLowerCase())) || "" : "";
      return { name: name.replace(/^dr\.?\s+/i, ""), service: s, cell: String(cell || "").trim() };
    });
  }
  const digits = (c) => { let d = String(c || "").replace(/[^\d+]/g, ""); if (/^\d{10}$/.test(d)) d = "+1" + d; else if (/^1\d{10}$/.test(d)) d = "+" + d; return d; };
  // iPhone Messages wants sms:NUMBER&body=… ; Android wants ?body=
  function smsLink(cell, text, ios) { return "sms:" + digits(cell) + (ios ? "&" : "?") + "body=" + encodeURIComponent(text || ""); }
  // Contacts from the iPhone: vCard (.vcf) files shared from the Contacts app, or the Contact Picker where Safari has it.
  const SVC_ALIAS = [[/\bID\b|infectio/i, "Infectious diseases"], [/gen(eral)?\.? ?surg/i, "General surgery"], [/cardio|\bcard\b/i, "Cardiology"], [/nephro|renal|kidney/i, "Nephrology"], [/neurosurg/i, "Neurosurgery"], [/neuro/i, "Neurology"],
    [/\bGI\b|gastro/i, "Gastroenterology"], [/resp|pulm|lung/i, "Respirology"], [/hemat|haemat/i, "Hematology"], [/rheum/i, "Rheumatology"], [/onc/i, "Medical oncology"], [/endo|diabet/i, "Endocrinology"], [/geriat/i, "Geriatrics"],
    [/palliat/i, "Palliative care"], [/psych/i, "Psychiatry"], [/ortho/i, "Orthopedics"], [/urol/i, "Urology"], [/vascular/i, "Vascular surgery"], [/thoracic/i, "Thoracic surgery"], [/\bIR\b|interv/i, "Interventional radiology"], [/\bICU\b|intensiv|critical care/i, "ICU"], [/internal med|\bIM\b/i, "Internal medicine"]];
  const guessService = (t) => { const h = SVC_ALIAS.find(([re]) => re.test(t || "")); return h ? h[1] : ""; };
  function parseVcards(txt) {
    const out = [];
    String(txt || "").replace(/\r?\n[ \t]/g, "").split(/BEGIN:VCARD/i).slice(1).forEach((card) => {
      const lines = card.split(/\r?\n/), get = (k) => lines.filter((l) => new RegExp("^(item\\d+\\.)?" + k + "[;:]", "i").test(l));
      const val = (l) => l.slice(l.indexOf(":") + 1).replace(/\\,/g, ",").replace(/\\;/g, ";").replace(/\\n/gi, " ").trim();
      const n = (get("N")[0] && val(get("N")[0]).split(";")) || [], fn = get("FN")[0] ? val(get("FN")[0]) : "";
      const tels = get("TEL"); const tel = tels.find((l) => /cell|mobile|iphone/i.test(l.split(":")[0])) || tels[0];
      const extra = [...get("ORG"), ...get("TITLE"), ...get("NOTE")].map(val).join(" ") + " " + fn;
      const name = (n[0] || fn.replace(/^dr\.?\s+/i, "").split(/\s+/).pop() || "").trim();
      if (name && tel) out.push({ name, service: guessService(extra), cell: val(tel) });
    });
    return out;
  }
  const contactLine = (c) => [c.name, c.service || "", c.cell].join(" | ");
  // Patients from Wayne's VGH list Excel (tools/plist format): D room, E age, F name ("Smith, Ann"), H admit reason, O issues, pmhx rows under the name.
  // Read in the browser only; nothing from the file is saved.
  const unx = (t) => String(t).replace(/<[^>]+>/g, "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
  function readSheet(sheetXml, sstXml) {
    const sst = []; String(sstXml || "").replace(/<si>([\s\S]*?)<\/si>/g, (m, x) => { sst.push(unx((x.match(/<t[^>]*>[\s\S]*?<\/t>/g) || []).join(""))); return m; });
    const rows = {};
    String(sheetXml).replace(/<c r="([A-Z]+)(\d+)"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g, (m, col, r, attrs, body) => {
      if (!body) return m; const t = (attrs.match(/t="(\w+)"/) || [])[1]; let v;
      if (t === "inlineStr") v = unx((body.match(/<t[^>]*>[\s\S]*?<\/t>/g) || []).join(""));
      else { const x = (body.match(/<v>([\s\S]*?)<\/v>/) || [])[1]; if (x == null) return m; v = t === "s" ? sst[+x] || "" : unx(x); }
      v = String(v).trim(); if (v) (rows[r] = rows[r] || {})[col] = v; return m;
    });
    return rows;
  }
  function listPatients(rows) {
    const nums = Object.keys(rows).map(Number).sort((a, b) => a - b), hdr = rows[nums[0]] || {};
    const colOf = (re) => Object.keys(hdr).find((c) => re.test(hdr[c]));
    const cMrn = colOf(/\bmrn\b|medical record/i), cSex = colOf(/^\s*(sex|gender)\s*$/i);
    const out = []; let cur = null;
    nums.slice(1).forEach((n) => {
      const r = rows[n], f = r.F || "";
      // a patient is a name with a room (D) on the same row; text in the name column without a room is that patient's pmhx
      if (/^pmhx:?/i.test(f) || (cur && !r.D)) { if (cur) { const t = f.replace(/^pmhx:?\s*/i, ""); if (t) cur.pmhx.push(t); if (r.O) cur.issues.push(r.O); } return; }
      if (!f || !r.D || /^(name|patient)$/i.test(f)) { cur = null; return; }
      let name = f; if (/,/.test(name)) name = name.split(",").map((x) => x.trim()).filter(Boolean).reverse().join(" ");
      const sx = String(cSex ? r[cSex] || "" : "").toLowerCase();
      cur = { name, age: r.E && /^\d+(\.\d+)?$/.test(r.E) ? String(Math.floor(+r.E)) : (r.E || ""), room: r.D || "", reason: r.H || "", mrn: cMrn ? r[cMrn] || "" : "",
        sex: /^f/.test(sx) ? "female" : /^m/.test(sx) ? "male" : "", issues: r.O ? [r.O] : [], pmhx: [] };
      out.push(cur);
    });
    return out;
  }
  /* ---- when to consult: chart findings -> suggested consults (rules only; a prompt to think, not an order) ----
     d = { labs: summarizeLabs(...) output, probs: [active problem strings], micro: [culture result strings] }
     returns [{ service, problem, why, labs:[keys], reason, urgent }] most urgent first. SI units assumed (Hb g/L, Cr µmol/L); g/dL and mg/dL are converted. */
  function suggest(d) {
    const L = {}; (d.labs || []).forEach((l) => (L[l.key] = l));
    const conv = (l, k) => { if (!l) return null; const f = (x) => (x == null ? null : k === "Hb" && x < 25 ? x * 10 : k === "Cr" && x < 20 ? x * 88.4 : x); return Object.assign({}, l, { v: f(l.v), prev: f(l.prev), min: f(l.min), max: f(l.max) }); };
    const g = (k) => conv(L[k], k), P = (d.probs || []).join(" | "), M = (d.micro || []).join(" | "), has = (re) => re.test(P);
    const out = [], add = (o) => out.push(Object.assign({ labs: [], urgent: false }, o));
    // Infectious diseases
    if (/staph[a-z]*\.? aureus|\bS\.? ?aureus\b|\bMRSA\b|\bMSSA\b/i.test(M) || has(/staph[a-z]* aureus bacter|\bMRSA bacter|\bMSSA bacter|S\.? aureus bacter/i))
      add({ service: "Infectious diseases", problem: "S. aureus bacteremia", why: "S. aureus bacteremia management (echo, source control, antibiotic and duration)", labs: ["WBC", "CRP", "Cr"], urgent: true,
        reason: "S. aureus in a blood culture. An ID consult is recommended for every S. aureus bacteremia (linked with lower mortality)." });
    if (/candida/i.test(M) || has(/candidemia|candidaemia/i))
      add({ service: "Infectious diseases", problem: "candidemia", why: "candidemia management (eye exam, line removal, antifungal and duration)", labs: ["WBC", "CRP", "Cr"], urgent: true, reason: "Candida in a blood culture – ID input is standard for candidemia." });
    if (has(/necroti[sz]ing fasciitis/i)) add({ service: "General surgery", problem: "possible necrotizing fasciitis", why: "urgent surgical assessment and debridement", labs: ["WBC", "CRP", "Lactate", "Cr"], urgent: true, reason: "Necrotizing fasciitis on the problem list – needs urgent surgery." });
    // Nephrology
    const K = g("K"), Cr = g("Cr"), HC = g("HCO3"), PH = g("pH"), Na = g("Na"), Lac = g("Lactate"), Hb = g("Hb"), Plt = g("Plt"), Tr = g("Trop"), CO2 = g("pCO2");
    if (K && K.v >= 6.5) add({ service: "Nephrology", problem: `severe hyperkalemia (K ${fmtV(K.v)})`, why: "assess need for urgent dialysis", labs: ["K", "Cr", "HCO3", "Urea"], urgent: true, reason: `K ${fmtV(K.v)} (≥ 6.5) – treat now and involve nephrology if it does not settle or with AKI.` });
    const aki3 = Cr && Cr.n > 1 && (Cr.v >= 3 * Cr.min || (Cr.v >= 354 && Cr.v - Cr.min >= 26.5));
    if (aki3) add({ service: "Nephrology", problem: "AKI (KDIGO stage 3)", why: "AKI work-up and need for dialysis", labs: ["Cr", "Urea", "K", "HCO3", "Na"], reason: `Cr ${fmtV(Cr.v)} from ${fmtV(Cr.min)} in the past week – stage 3 AKI.` });
    if (has(/glomerulonephritis|\bGN\b|vasculitis|interstitial nephritis|\bAIN\b|nephrotic/i)) add({ service: "Nephrology", problem: (P.match(/glomerulonephritis|vasculitis|interstitial nephritis|nephrotic syndrome/i) || ["possible glomerulonephritis"])[0].toLowerCase(), why: "diagnosis (urine sediment, serology, ± biopsy) and treatment", labs: ["Cr", "Urea", "K", "Alb"], reason: "GN / AIN / vasculitis on the problem list – nephrology usually leads." });
    if (Na && Na.v <= 120) add({ service: "Nephrology", problem: `severe hyponatremia (Na ${fmtV(Na.v)})`, why: "safe correction plan and cause", labs: ["Na", "K", "Cr", "Gluc"], reason: `Na ${fmtV(Na.v)} (≤ 120) – high risk of seizures and overcorrection.` });
    // ICU
    if ((Lac && Lac.v >= 4) || (PH && PH.v < 7.2) || (PH && PH.v < 7.3 && CO2 && CO2.v > 60))
      add({ service: "ICU", problem: Lac && Lac.v >= 4 ? `lactate ${fmtV(Lac.v)}` : CO2 && CO2.v > 60 && PH.v < 7.3 ? "hypercapnic respiratory failure" : `severe acidosis (pH ${fmtV(PH.v)})`, why: "assessment for ICU / higher level of care", labs: ["Lactate", "pH", "pCO2", "HCO3", "Cr", "K"], urgent: true,
        reason: [Lac && Lac.v >= 4 ? `lactate ${fmtV(Lac.v)} (≥ 4)` : "", PH && PH.v < 7.2 ? `pH ${fmtV(PH.v)}` : "", PH && PH.v < 7.3 && CO2 && CO2.v > 60 ? `pCO2 ${fmtV(CO2.v)} with pH ${fmtV(PH.v)}` : ""].filter(Boolean).join(", ") + " – consider ICU / outreach." });
    else if (HC && HC.v <= 12) add({ service: "Nephrology", problem: `severe metabolic acidosis (HCO3 ${fmtV(HC.v)})`, why: "cause and need for dialysis", labs: ["HCO3", "Cr", "K", "Lactate"], reason: `HCO3 ${fmtV(HC.v)} (≤ 12).` });
    // GI
    const hbDrop = Hb && Hb.max - Hb.v;
    if (hbDrop >= 20 && has(/gi bleed|gastrointestinal (bleed|hemorrhage|haemorrhage)|melena|melaena|hematemesis|haematemesis|hematochezia|peptic ulcer|varic/i))
      add({ service: "Gastroenterology", problem: /hematochezia|lower gi/i.test(P) ? "lower GI bleed" : "upper GI bleed", why: "endoscopy", labs: ["Hb", "Plt", "INR", "Urea", "Cr"], urgent: true, reason: `Hb ${fmtV(Hb.v)} from ${fmtV(Hb.max)} (fall of ${fmtV(hbDrop)} g/L) with a GI bleed on the problem list.` });
    // Cardiology
    const trHigh = Tr && (/^H/.test(Tr.flag || "") || (/ng\/l/i.test(Tr.unit) && Tr.v > 26) || (/(ug|µg|mcg)\/l|ng\/ml/i.test(Tr.unit) && Tr.v > 0.04));
    if (trHigh && Tr.prev != null && Tr.v >= 1.2 * Tr.prev)
      add({ service: "Cardiology", problem: "rising troponin", why: "assess for acute coronary syndrome", labs: ["Trop", "Hb", "K", "Cr"], reason: `Troponin ${fmtV(Tr.v)} from ${fmtV(Tr.prev)} – rising. Check ECG and symptoms first (type 2 MI is common).` });
    if (has(/complete heart block|third.degree|mobitz (type )?(ii|2)|ventricular tachycardia|\bVT\b|torsade/i))
      add({ service: "Cardiology", problem: (P.match(/complete heart block|third.degree (av )?block|mobitz (type )?(ii|2)|ventricular tachycardia|torsades?/i) || ["arrhythmia"])[0].toLowerCase(), why: "pacing / arrhythmia management", labs: ["K", "Mg", "Trop"], urgent: true, reason: "High-grade AV block or ventricular arrhythmia on the problem list." });
    // Hematology
    if (Plt && Plt.v < 50) add({ service: "Hematology", problem: `thrombocytopenia (platelets ${fmtV(Plt.v)})`, why: "work-up (HIT, TTP/HUS, marrow, drugs) and transfusion threshold", labs: ["Plt", "Hb", "WBC", "INR", "LDH", "Bili"], reason: `Platelets ${fmtV(Plt.v)} (< 50). Check for a known cause (chemo, cirrhosis) before calling.` });
    // Neuro / neurosurgery
    if (has(/cauda equina|cord compression|spinal cord compression|epidural (abscess|hematoma)|subdural/i))
      add({ service: "Neurosurgery", problem: (P.match(/cauda equina( syndrome)?|(spinal )?cord compression|epidural (abscess|hematoma)|(acute |chronic )?subdural (hematoma|haematoma)?/i) || ["spinal emergency"])[0].toLowerCase(), why: "urgent neurosurgical assessment", labs: ["INR", "Plt", "Hb"], urgent: true, reason: "Spinal or subdural emergency on the problem list." });
    if (has(/status epilepticus|guillain|myasthenia|\bGBS\b/i))
      add({ service: "Neurology", problem: (P.match(/status epilepticus|guillain[- ]barr[eé]( syndrome)?|myasthenia( gravis)?/i) || ["neuromuscular emergency"])[0].toLowerCase(), why: "diagnosis and treatment (watch breathing – FVC/NIF)", labs: ["Na", "Gluc", "Ca"], urgent: true, reason: "Status epilepticus, GBS or myasthenia on the problem list." });
    // General surgery
    if (has(/bowel obstruction|perforat|ischemic (bowel|colitis)|mesenteric ischemia|appendicitis|cholecystitis|cholangitis/i) && !out.some((o) => o.service === "General surgery"))
      add({ service: "General surgery", problem: (P.match(/(small |large )?bowel obstruction|perforat\w*( viscus)?|ischemic (bowel|colitis)|mesenteric ischemia|appendicitis|cholecystitis|cholangitis/i) || ["acute abdomen"])[0].toLowerCase(), why: "surgical assessment", labs: ["WBC", "Lactate", "Hb", "Cr", "Lipase"], reason: "Surgical abdominal problem on the problem list." });
    // one card per service, urgent first
    const by = {}; out.forEach((o) => { if (!by[o.service]) by[o.service] = o; else { by[o.service].reason += " Also: " + o.reason; by[o.service].urgent = by[o.service].urgent || o.urgent; by[o.service].problem += " and " + o.problem; by[o.service].labs = [...new Set(by[o.service].labs.concat(o.labs))]; } });
    return Object.values(by).sort((a, b) => b.urgent - a.urgent);
  }
  // culture results as text, from lab Observations (blood cultures only)
  function microText(obs) {
    return (obs || []).filter((o) => o && /culture|blood c/i.test((o.code && (o.code.text || ((o.code.coding || [])[0] || {}).display)) || "") && /blood/i.test(JSON.stringify(o.code || "") + JSON.stringify(o.specimen || "")))
      .map((o) => [o.valueString, o.valueCodeableConcept && (o.valueCodeableConcept.text || ((o.valueCodeableConcept.coding || [])[0] || {}).display), ...(o.note || []).map((n) => n.text), o.conclusion].filter(Boolean).join(" "))
      .filter((t) => t && !/no growth|negative|pending/i.test(t));
  }
  window.ConsultWidget = { build, suggest, microText, summarizeLabs, labLine, shortName, PERTINENT, parseContacts, smsLink, SERVICES, parseVcards, guessService, contactLine, readSheet, listPatients };
  if (typeof document === "undefined") return;

  let pt = null, probs = [], labs = [], labsLoaded = false, micro = [], probsLoaded = false;
  async function loadPatient() {
    const ctx = window.CONSULT_CTX || {};
    let client = ctx.client || null;
    if (!client && window.FHIR && (location.search.includes("code=") || sessionStorage.getItem("SMART_KEY"))) { try { client = await FHIR.oauth2.ready(); } catch (e) {} }
    if (ctx.patient) pt = ctx.patient;
    else if (client) { try { pt = await client.patient.read(); } catch (e) {} }
    if (ctx.labs && !labsLoaded) { labs = summarizeLabs(ctx.labs); micro = microText(ctx.labs); labsLoaded = true; }
    if (client && !labsLoaded) {
      try {
        const since = new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10);
        const obs = await client.request(`Observation?patient=${client.patient.id}&category=laboratory&date=ge${since}&_count=200`, { pageLimit: 3, flat: true });
        labs = summarizeLabs(obs); micro = microText(obs); labsLoaded = true;
      } catch (e) { labsLoaded = true; }
    }
    if (client && !probsLoaded) { probsLoaded = true;
      try {
        const cs = await client.request(`Condition?patient=${client.patient.id}&_count=100`, { flat: true });
        probs = [...new Set(cs.filter((c) => !(c.clinicalStatus && /resolved|inactive/.test(JSON.stringify(c.clinicalStatus)))).map((c) => (c.code && (c.code.text || ((c.code.coding || [])[0] || {}).display)) || "").filter(Boolean))].slice(0, 40);
      } catch (e) {}
    }
  }
  function patientFields() {
    if (!pt) return { name: "", age: "", sex: "", mrn: "" };
    const n = (pt.name || []).find((x) => x.use === "official") || (pt.name || [])[0] || {};
    let name = [(n.given || []).join(" "), n.family].filter(Boolean).join(" ") || n.text || "";
    if (/,/.test(name)) name = name.split(",").map((x) => x.trim()).reverse().join(" ");
    const id = (pt.identifier || []).find((i) => /\bMR\b|mrn|medical record/i.test(JSON.stringify(i.type || "") + " " + (i.system || "")));
    return { name, age: ageOf(pt.birthDate), sex: String(pt.gender || "").toLowerCase(), mrn: id ? id.value : "" };
  }
  function topic() { const c = window.CONSULT_CTX; try { return (c && c.topic && c.topic()) || document.title.replace(/\s*[–-]\s*(Hospitalist Toolkit|launching).*$/i, ""); } catch (e) { return document.title; } }
  function defaultService() {
    const c = window.CONSULT_CTX; let k = ""; try { k = (c && c.tabKey && c.tabKey()) || ""; } catch (e) {}
    // a tab can name a better service for the loaded patient (e.g. Oncology tab → Hematology for leukemia/lymphoma)
    const ov = window.CONSULT_SERVICE_OVERRIDE || {}; if (k && ov[k]) return ov[k]; if (!k && window.CONSULT_SERVICE) return window.CONSULT_SERVICE;
    if (BY_TAB[k]) return BY_TAB[k];
    const t = topic(); const hit = BY_TITLE.find(([re]) => re.test(t)); return hit ? hit[1] : "Internal medicine";
  }

  function el(tag, attrs, html) { const e = document.createElement(tag); Object.assign(e, attrs || {}); if (html != null) e.innerHTML = html; return e; }
  function init() {
    document.head.appendChild(el("style", {}, css));
    const btn = el("button", { id: "cw-btn", type: "button", title: "Draft a consult message (ID, surgery, any service)" }, "✉ Consult");
    const pan = el("div", { id: "cw-pan", role: "dialog" }, `
      <h3>Consult message</h3>
      <div id="cw-sug" style="display:none;margin:4px 0 8px;padding:6px 8px;border:1px solid #f0c36d;background:#fff8e6;border-radius:8px;color:#3d2e00"></div>
      <div class="muted">~50 words. Pick a specialist, then 💬 Text opens Messages with their number and this message filled in – you tap Send.</div>
      <div class="row"><label>Find a specialist<input id="cw-q" type="search" placeholder="type a name or service…" autocomplete="off"></label></div>
      <div class="row"><label><span>Send to <span id="cw-whonote" class="muted"></span> <a href="#" id="cw-allsvc" style="color:#0b6bcb;font-size:11.5px"></a></span><select id="cw-who"></select></label><label style="max-width:150px">Cell<input id="cw-cell" inputmode="tel" placeholder="250-555-1234"></label></div>
      <div id="cw-ed" style="display:none;margin:4px 0"><div class="muted">One per line: <b>Name | Service | cell</b> – e.g. <code>Smith | Infectious diseases | 250-555-1234</code>. Saved in this browser/phone only.</div>
        <textarea id="cw-list" style="min-height:90px" placeholder="Smith | Infectious diseases | 250-555-1234"></textarea>
        <div style="display:flex;justify-content:space-between;align-items:center;gap:6px"><span><button type="button" class="ghost" id="cw-imp">📇 From Contacts</button><input type="file" id="cw-vcf" accept=".vcf,text/vcard,text/x-vcard" multiple style="display:none"></span><button type="button" id="cw-save">Save list</button></div>
        <div style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap"><button type="button" class="ghost" id="cw-exp">⬆ Export list</button><button type="button" class="ghost" id="cw-impf">⬇ Import list file</button><input type="file" id="cw-lf" accept=".txt,text/plain,.vcf,text/vcard" style="display:none">
          <span class="muted" style="flex:1;min-width:180px">Move the list between phone and desktop: Export on one (email / AirDrop / OneDrive it to yourself), Import on the other. Your sign-off line goes with it.</span></div>
        <div class="muted" id="cw-impnote" style="margin-top:3px">On iPhone: Contacts → open the specialist → Share Contact → Save to Files, then tap 📇 From Contacts and pick the file. Check the service after importing.</div></div>
      <div class="row"><label>Service<select id="cw-svc">${SERVICES.map((s) => `<option>${s}</option>`).join("")}</select></label><label>Dr.<input id="cw-dr" placeholder="name"></label></div>
      <div class="row"><label>Patient from my Excel list<select id="cw-xp"><option value="">– choose the list file first –</option></select></label><span style="align-self:flex-end"><button type="button" class="ghost" id="cw-xbtn">📋 Excel list…</button><input type="file" id="cw-xf" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" style="display:none"></span></div>
      <div class="row"><label>Patient<input id="cw-name"></label><label style="max-width:70px;min-width:60px">Age<input id="cw-age"></label><label style="max-width:120px">MRN<input id="cw-mrn"></label>
        <label style="max-width:90px;min-width:80px">Sex<select id="cw-sex"><option value="">–</option><option value="female">F</option><option value="male">M</option></select></label></div>
      <div class="row"><label>Problem<input id="cw-prob" list="cw-probs" placeholder="e.g. ESBL pyelonephritis"><datalist id="cw-probs"></datalist></label></div>
      <div class="row"><label>Brief history (1–2 key facts)<input id="cw-hx" placeholder="e.g. Febrile on day 3 of ceftriaxone, creatinine rising."></label></div>
      <div class="row"><label>Why you need their help<input id="cw-why" placeholder="e.g. antibiotic choice and duration / drainage / dialysis"></label></div>
      <div class="row" style="flex-direction:column;align-items:stretch"><label style="flex:none">Labs to include <span id="cw-labnote"></span></label>
        <div id="cw-labs" style="display:flex;flex-wrap:wrap;gap:3px 10px;font-size:12.5px;max-height:120px;overflow:auto"></div>
        <div style="display:flex;gap:8px;align-items:center;margin-top:3px"><a href="#" id="cw-laball" style="font-size:12px;color:#0b6bcb">show all results</a><input id="cw-labx" placeholder="other results to add, e.g. CT: 4 cm abscess" style="flex:1"></div></div>
      <div class="row"><label>Sign-off line under "Thanks, Wayne" <span class="muted">(saved on this computer only – not in the app code)</span><input id="cw-sig" placeholder="e.g. Dr. Wayne Dong · MSP ##### · cell ###-###-####"></label></div>
      <textarea id="cw-msg"></textarea>
      <div id="cw-qr" style="display:none;text-align:center;margin:8px 0;padding:8px;border:1px solid #cfd6df;border-radius:8px">
        <div style="font-weight:600;margin-bottom:4px">Scan with your iPhone camera</div><div id="cw-qrimg" style="background:#fff;display:inline-block;padding:6px;border-radius:6px"></div>
        <div class="muted" style="margin-top:4px">Messages opens on your phone with the number and message filled in – tap Send.<br><a href="#" id="cw-sms-here" style="color:#0b6bcb">or open this computer's messaging app</a> · <a href="#" id="cw-qrx" style="color:#0b6bcb">hide</a></div></div>
      <div class="acts"><span id="cw-words" class="muted"></span><span><button class="ghost" id="cw-close" type="button">Close</button> <button class="ghost" id="cw-copy" type="button">Copy</button> <button id="cw-text" type="button">💬 Text</button></span></div>`);
    document.body.appendChild(btn); document.body.appendChild(pan);
    const $ = (id) => pan.querySelector("#" + id);
    let edited = false, showAll = false, picked = null; // picked: Set of lab keys the user ticked (null = use the service defaults)
    const pickedLabs = () => labs.filter((l) => (picked || new Set(PERTINENT[$("cw-svc").value] || [])).has(l.key));
    const drawLabs = () => {
      const pert = new Set(PERTINENT[$("cw-svc").value] || []), sel = picked || pert;
      const list = showAll ? labs : labs.filter((l) => pert.has(l.key) || sel.has(l.key));
      $("cw-labnote").textContent = labs.length ? `(last 7 days; ticked = usual for ${$("cw-svc").value})` : "(no lab results read – type them below)";
      $("cw-labs").innerHTML = list.map((l) => `<label style="flex-direction:row;align-items:center;gap:3px;min-width:0;flex:none;color:inherit"><input type="checkbox" data-k="${l.key}" style="width:auto"${sel.has(l.key) ? " checked" : ""}>${l.key} <b${l.flag ? ' style="color:#b42318"' : ""}>${fmtV(l.v)}</b>${l.prev != null ? ` <span class="muted">(${fmtV(l.prev)})</span>` : ""}</label>`).join("") || '<span class="muted">none for this service – "show all results"</span>';
      $("cw-labs").querySelectorAll("input").forEach((x) => (x.onchange = () => { picked = picked || new Set(sel); x.checked ? picked.add(x.dataset.k) : picked.delete(x.dataset.k); edited = false; refresh(); }));
      $("cw-laball").textContent = showAll ? "show usual only" : `show all results (${labs.length})`;
    };
    // suggested consults from the chart: click one to fill in service, problem, why and the labs
    let sugs = [];
    const drawSug = () => {
      const box = $("cw-sug");
      if (!sugs.length) { box.style.display = "none"; return; }
      box.style.display = "block";
      if ($("cw-xp").value) { box.innerHTML = `<b>Suggested consults</b> are for the chart patient, not the patient picked from the Excel list.`; return; }
      box.innerHTML = `<div style="font-weight:600;margin-bottom:3px">Suggested consults – from the chart, your call</div>` + sugs.map((x, i) =>
        `<div style="margin:4px 0"><button type="button" data-sug="${i}" style="${x.urgent ? "background:#b42318;border-color:#b42318" : ""}">${x.urgent ? "⚠ " : ""}${x.service}</button> <b>${x.problem.replace(/</g, "&lt;")}</b><div style="font-size:11.5px;margin-top:2px">${x.reason.replace(/</g, "&lt;")}</div></div>`).join("") +
        `<div style="font-size:11px;margin-top:3px">Rules only – check the patient. Place the consult order in PowerChart too.</div>`;
      box.querySelectorAll("[data-sug]").forEach((b) => (b.onclick = () => {
        const x = sugs[+b.dataset.sug];
        $("cw-svc").value = x.service; $("cw-svc").dispatchEvent(new Event("change"));
        $("cw-prob").value = x.problem; $("cw-why").value = x.why;
        const have = new Set(labs.map((l) => l.key)); picked = new Set(x.labs.filter((k) => have.has(k))); drawLabs();
        const only = [...$("cw-who").options].filter((o) => /^\d+$/.test(o.value));
        if (only.length === 1 && !/showing all/.test($("cw-whonote").textContent)) { $("cw-who").value = only[0].value; $("cw-who").onchange(); }
        edited = false; refresh(); (only.length === 1 ? $("cw-text") : $("cw-q")).focus();
      }));
    };
    const refresh = () => {
      if (edited) return;
      const m = build({ dr: $("cw-dr").value.trim(), service: $("cw-svc").value, name: $("cw-name").value.trim(), age: $("cw-age").value.trim(), sex: $("cw-sex").value, mrn: $("cw-mrn").value.trim(), problem: $("cw-prob").value, hx: $("cw-hx").value, why: $("cw-why").value,
        sig: $("cw-sig").value,
        labs: [labLine(pickedLabs()).replace(/\.$/, ""), $("cw-labx").value.trim()].filter(Boolean).join("; ") });
      $("cw-msg").value = m.text; $("cw-words").textContent = `~${m.words} words` + (m.words > 60 ? " – a bit long, trim the history" : "");
    };
    ["cw-svc", "cw-dr", "cw-name", "cw-age", "cw-mrn", "cw-sex", "cw-prob", "cw-hx", "cw-why", "cw-labx"].forEach((id) => { $(id).addEventListener("input", () => { edited = false; refresh(); }); $(id).addEventListener("change", () => { edited = false; refresh(); }); });
    $("cw-svc").addEventListener("change", () => { picked = null; drawLabs(); refresh(); });
    try { $("cw-sig").value = localStorage.getItem("consult-signoff") || ""; } catch (e) {}
    $("cw-sig").addEventListener("input", () => { try { localStorage.setItem("consult-signoff", $("cw-sig").value); } catch (e) {} edited = false; refresh(); });
    $("cw-laball").onclick = (e) => { e.preventDefault(); showAll = !showAll; drawLabs(); };
    $("cw-msg").addEventListener("input", () => { edited = true; $("cw-words").textContent = "edited by hand"; });
    const IOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const MAC = !IOS && /Macintosh|Mac OS X/.test(navigator.userAgent);   // Mac Messages (iMessage + iPhone text forwarding)
    const PHONE = IOS || /Android/i.test(navigator.userAgent);
    let qrLib = null;
    const loadQr = () => qrLib || (qrLib = new Promise((ok, no) => { if (window.qrcode) return ok(window.qrcode); const sc = document.createElement("script");
      sc.src = "https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js"; sc.onload = () => (window.qrcode ? ok(window.qrcode) : no()); sc.onerror = () => { qrLib = null; no(); }; document.head.appendChild(sc); }));
    const showQr = async (link, hereLink) => {
      $("cw-qr").style.display = "block"; $("cw-qrimg").textContent = "Making QR code…";
      try { const qrcode = await loadQr(); const q = qrcode(0, "L"); q.addData(link); q.make();
        const cell = Math.max(2, Math.min(5, Math.floor(260 / q.getModuleCount()))); $("cw-qrimg").innerHTML = q.createSvgTag(cell, 8);
      } catch (e) { $("cw-qrimg").textContent = "Couldn't load the QR maker (no internet?). Use Copy instead."; }
      $("cw-sms-here").onclick = (ev) => { ev.preventDefault(); window.location.href = hereLink || link; };
    };
    let xPts = [], zipLib = null;
    const loadZip = () => zipLib || (zipLib = new Promise((ok, no) => { if (window.JSZip) return ok(window.JSZip); const sc = document.createElement("script");
      sc.src = "https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js"; sc.onload = () => (window.JSZip ? ok(window.JSZip) : no()); sc.onerror = () => { zipLib = null; no(); }; document.head.appendChild(sc); }));
    $("cw-xbtn").onclick = () => $("cw-xf").click();
    $("cw-xf").onchange = async () => {
      const f = $("cw-xf").files[0]; $("cw-xf").value = ""; if (!f) return;
      $("cw-words").textContent = "Reading " + f.name + "…";
      try {
        const zip = await (await loadZip()).loadAsync(await f.arrayBuffer());
        const first = Object.keys(zip.files).filter((k) => /^xl\/worksheets\/sheet\d+\.xml$/.test(k)).sort((a, b) => parseInt(a.match(/\d+/)) - parseInt(b.match(/\d+/)))[0];
        const sst = zip.file("xl/sharedStrings.xml") ? await zip.file("xl/sharedStrings.xml").async("string") : "";
        xPts = listPatients(readSheet(await zip.file(first).async("string"), sst));
        $("cw-xp").innerHTML = `<option value="">– pick a patient (${xPts.length}) –</option>` + xPts.map((p, i) => `<option value="${i}">${[p.room, p.name, p.age].filter(Boolean).join(" · ").replace(/</g, "&lt;")}</option>`).join("");
        $("cw-words").textContent = xPts.length ? `${xPts.length} patients from ${f.name}` : "No patients found in that file (expects your VGH list format).";
      } catch (e) { $("cw-words").textContent = "Couldn't read that Excel file" + (window.JSZip ? "." : " (no internet to load the reader?)."); }
    };
    ["cw-name", "cw-mrn"].forEach((id) => $(id).addEventListener("input", () => { $("cw-xp").value = ""; }));
    $("cw-xp").addEventListener("change", () => drawSug());
    $("cw-xp").onchange = () => {
      const p = xPts[+$("cw-xp").value]; if (!p || $("cw-xp").value === "") return;
      $("cw-name").value = p.name; $("cw-age").value = p.age; $("cw-mrn").value = p.mrn; $("cw-sex").value = p.sex;
      $("cw-prob").value = p.reason;
      const hx = [p.issues.join("; "), p.pmhx.length ? "PMHx " + p.pmhx.join(", ") : ""].filter(Boolean).join(". ");
      $("cw-hx").value = hx.length > 160 ? hx.slice(0, 157).replace(/[,;\s]+\S*$/, "") + "…" : hx;
      edited = false; refresh();
      if (!p.mrn) $("cw-words").textContent = "MRN and sex aren't in the list – type them in.";
    };
    $("cw-qrx").onclick = (ev) => { ev.preventDefault(); $("cw-qr").style.display = "none"; };
    let contacts = [];
    let allSvc = false;
    // the Send to list: only the chosen service's specialists, unless searching (search looks through everyone) or "all services" is on
    const drawWho = (autoPick) => {
      const q = $("cw-q").value.trim().toLowerCase(), svc = $("cw-svc").value, keep = $("cw-who").value;
      const all = contacts.map((c, i) => Object.assign({ i }, c));
      let list = q ? all.filter((c) => (c.name + " " + c.service + " " + c.cell).toLowerCase().includes(q)) : allSvc ? all : all.filter((c) => c.service === svc);
      let note = q ? `(${list.length} found)` : allSvc ? "(all services)" : `(${svc})`;
      if (!q && !allSvc && !list.length && contacts.length) { list = all; note = `(none saved for ${svc} – showing all)`; }
      $("cw-whonote").textContent = contacts.length ? note : "";
      $("cw-allsvc").textContent = q || !contacts.length ? "" : allSvc ? "only this service" : "show all services";
      $("cw-who").innerHTML = `<option value="">${!contacts.length ? "– no list yet –" : list.length ? "– pick a specialist –" : "– no match –"}</option>` +
        list.sort((a, b) => a.name.localeCompare(b.name)).map((c) => `<option value="${c.i}">${c.name.replace(/</g, "&lt;")}${c.service ? " · " + c.service : ""}</option>`).join("") + `<option value="edit">✎ Add / edit list…</option>`;
      if (keep !== "" && keep !== "edit" && list.some((c) => String(c.i) === keep)) $("cw-who").value = keep;
      else if (autoPick && q && list.length === 1) { $("cw-who").value = String(list[0].i); $("cw-who").onchange(); }
    };
    const loadContacts = () => { let t = ""; try { t = localStorage.getItem("consult-contacts") || ""; } catch (e) {} $("cw-list").value = t; contacts = parseContacts(t); drawWho(); };
    $("cw-q").addEventListener("input", () => drawWho(true));
    $("cw-allsvc").onclick = (e) => { e.preventDefault(); allSvc = !allSvc; drawWho(); };
    let chosen = null; // the saved specialist now in Dr./Cell
    $("cw-svc").addEventListener("change", () => {
      const c = chosen != null && contacts[chosen];
      if (c && c.service && c.service !== $("cw-svc").value) { $("cw-dr").value = ""; $("cw-cell").value = ""; chosen = null; $("cw-who").value = ""; edited = false; refresh(); }
      drawWho();
    });
    $("cw-who").onchange = () => {
      const v = $("cw-who").value;
      if (v === "edit") { $("cw-ed").style.display = "block"; $("cw-who").value = ""; $("cw-list").focus(); return; }
      const c = contacts[+v]; if (!c || v === "") return;
      $("cw-dr").value = c.name; $("cw-cell").value = c.cell; chosen = +v;
      if (c.service && c.service !== $("cw-svc").value) { $("cw-svc").value = c.service; picked = null; drawLabs(); }
      edited = false; refresh(); $("cw-q").value = ""; drawWho();
    };
    const addImported = (list) => {
      const have = new Set(parseContacts($("cw-list").value).map((c) => c.cell.replace(/\D/g, "").slice(-10)));
      const fresh = list.filter((c) => c.cell && !have.has(c.cell.replace(/\D/g, "").slice(-10)));
      if (fresh.length) $("cw-list").value = ($("cw-list").value.trim() ? $("cw-list").value.trim() + "\n" : "") + fresh.map(contactLine).join("\n");
      $("cw-impnote").textContent = list.length ? `Added ${fresh.length} (${list.length - fresh.length} already in the list). Fill in any missing service, then Save list.` : "No name + phone number found in that file.";
    };
    $("cw-imp").onclick = async () => {
      if (navigator.contacts && navigator.contacts.select) {
        try { const r = await navigator.contacts.select(["name", "tel"], { multiple: true });
          addImported(r.filter((c) => (c.tel || [])[0]).map((c) => { const fn = ((c.name || [])[0] || "").trim(); return { name: fn.replace(/^dr\.?\s+/i, "").split(/\s+/).pop(), service: guessService(fn), cell: c.tel[0] }; })); return;
        } catch (e) {}
      }
      $("cw-vcf").click();
    };
    // export / import the whole list (plus the sign-off line) as a small text file
    const exportText = () => ["# Hospitalist Toolkit – consult specialist list (Name | Service | cell)", "# sign-off: " + $("cw-sig").value.trim(),
      ...parseContacts($("cw-list").value).map(contactLine)].join("\n") + "\n";
    $("cw-exp").onclick = async () => {
      const name = "specialists.txt", text = exportText();
      try { const f = new File([text], name, { type: "text/plain" });
        if (PHONE && navigator.canShare && navigator.canShare({ files: [f] })) { await navigator.share({ files: [f], title: "Specialist list" }); $("cw-impnote").textContent = "List shared."; return; }
      } catch (e) { if (e && e.name === "AbortError") return; }
      const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type: "text/plain" })); a.download = name;
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      $("cw-impnote").textContent = "Saved specialists.txt (" + parseContacts($("cw-list").value).length + " specialists). Send it to your other device and use ⬇ Import list file there.";
    };
    $("cw-impf").onclick = () => $("cw-lf").click();
    $("cw-lf").onchange = async () => {
      const f = $("cw-lf").files[0]; $("cw-lf").value = ""; if (!f) return;
      let t = ""; try { t = await f.text(); } catch (e) {}
      if (/BEGIN:VCARD/i.test(t)) { addImported(parseVcards(t)); return; }
      const sig = (t.match(/^#\s*sign-off:\s*(.+)$/im) || [])[1];
      if (sig && !$("cw-sig").value.trim()) { $("cw-sig").value = sig.trim(); try { localStorage.setItem("consult-signoff", sig.trim()); } catch (e) {} }
      addImported(parseContacts(t));
      try { localStorage.setItem("consult-contacts", $("cw-list").value); } catch (e) {} loadContacts(); refresh();
      $("cw-impnote").textContent = $("cw-impnote").textContent.replace(/ Fill in any missing service, then Save list\./, "") + " Saved on this device.";
    };
    $("cw-vcf").onchange = async () => { let all = []; for (const f of $("cw-vcf").files) { try { all = all.concat(parseVcards(await f.text())); } catch (e) {} } $("cw-vcf").value = ""; addImported(all); };
    loadContacts();
    $("cw-save").onclick = () => { try { localStorage.setItem("consult-contacts", $("cw-list").value); } catch (e) {} loadContacts(); $("cw-ed").style.display = "none"; };
    $("cw-text").onclick = () => {
      const cell = $("cw-cell").value.trim();
      if (!/\d{3}/.test(cell)) { $("cw-cell").focus(); $("cw-words").textContent = "Pick a specialist or type a cell number first."; return; }
      const msg = $("cw-msg").value;
      if (PHONE || MAC) window.location.href = smsLink(cell, msg, IOS || MAC);
      else showQr(smsLink(cell, msg, true), smsLink(cell, msg, false));   // QR is scanned by the iPhone; the "this computer" link is for Windows Phone Link
    };
    $("cw-close").onclick = () => (pan.style.display = "none");
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") pan.style.display = "none"; });
    $("cw-copy").onclick = () => { $("cw-msg").select(); try { navigator.clipboard.writeText($("cw-msg").value); } catch (e) { document.execCommand("copy"); } $("cw-copy").textContent = "Copied"; setTimeout(() => ($("cw-copy").textContent = "Copy"), 1200); };
    // count of suggested consults on the button, worked out in the background once the chart is reachable
    const badge = () => { const n = pt ? sugs.length : 0, u = sugs.some((x) => x.urgent);
      btn.textContent = n ? `✉ Consult · ${n} suggested` : "✉ Consult"; btn.style.background = n ? (u ? "#b42318" : "#b7791f") : "";
      btn.title = n ? "Suggested: " + sugs.map((x) => x.service + " – " + x.problem).join("; ") : "Draft a consult message (ID, surgery, any service)"; };
    let tries = 0;
    const pre = async () => {
      const ctx = window.CONSULT_CTX || {};
      if (!(ctx.client || ctx.patient || ctx.labs) && !(window.FHIR && (location.search.includes("code=") || sessionStorage.getItem("SMART_KEY")))) { if (++tries < 10) setTimeout(pre, 3000); return; }
      try { await loadPatient(); if (pt) { sugs = suggest({ labs, probs, micro }); badge(); } } catch (e) {}
    };
    setTimeout(pre, 2000);
    btn.onclick = async () => {
      if (pan.style.display === "block") { pan.style.display = "none"; return; }
      pan.style.display = "block"; $("cw-words").textContent = "Reading the patient…";
      await loadPatient();
      const f = patientFields();
      // a patient picked from the Excel list stays picked; otherwise the chart patient fills in
      if (!$("cw-xp").value) { if (f.name) $("cw-name").value = f.name; if (f.age != null && f.age !== "") $("cw-age").value = f.age; if (f.mrn) $("cw-mrn").value = f.mrn; if (f.sex) $("cw-sex").value = f.sex; }
      $("cw-probs").innerHTML = probs.map((p) => `<option value="${p.replace(/"/g, "&quot;")}">`).join("");
      const t = topic().replace(/\s*\b(check|tab|review|by site|follow-?up|toolkit|calculator|summary|chooser|flowsheet|screen|monitor|app|pathway|matrix|tracker)\b.*$/i, "").trim();
      if (!$("cw-prob").value && t && !/^(today|notes|labs|forms|meds|physical exam|infections|antibiotic|what changed|ai|diagnosis|choosing wisely|consult|mobility|watch)/i.test(t)) $("cw-prob").value = t;
      $("cw-prob").placeholder = probs.length ? "pick from the problem list or type" : "e.g. ESBL pyelonephritis";
      if (!$("cw-dr").value) { $("cw-svc").value = defaultService(); picked = null; drawLabs(); } drawWho(); edited = false; refresh();
      if (!pt) $("cw-words").textContent = "No chart patient (demo or not launched) – type name, age and MRN.";
      sugs = pt ? suggest({ labs, probs, micro }) : []; drawSug(); badge();
    };
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
