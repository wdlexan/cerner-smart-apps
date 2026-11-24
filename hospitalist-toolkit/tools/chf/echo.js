/* Heart failure page - "Echo" sub-tab: paste an echo report (text or screenshot) and get what matters.
   Reads the numbers and phrases that change management: EF, LV size and walls, regional wall motion, diastolic function / filling
   pressure, LA, RV (TAPSE), RVSP, IVC, valves (AS by AVA / mean gradient / Vmax; MR, AR, TR), effusion, thrombus, LVOT obstruction
   and amyloid clues. Cut-offs from ASE/EACVI chamber quantification (2015), diastolic function (2016), valve guidance
   (2017 ASE regurgitation, 2020 ACC/AHA valve guideline). Written by Claude. UNVERIFIED: always read the full report.
   Nothing leaves the page: text and screenshots are read in the browser. */
(function () {
  const num = (s) => parseFloat(String(s).replace(",", "."));
  const SEV = ["trace", "trivial", "mild", "mild to moderate", "moderate", "moderate to severe", "severe"];
  const SEV_ORDER = [["moderate to severe", 5], ["mild to moderate", 3], ["severe", 6], ["moderate", 4], ["mild", 2], ["trivial", 1], ["trace", 0]];
  const sevRank = (s) => { s = String(s || "").toLowerCase().replace(/-/g, " ").replace(/\s+/g, " "); const h = SEV_ORDER.find(([w]) => s.includes(w)); return h ? h[1] : -1; };
  const sevWord = (s) => { const r = sevRank(s); return r >= 0 ? SEV[r] : ""; };
  const CM = (v, u) => (/mm/i.test(u || "") || v > 8 ? v / 10 : v); // wall thickness / diameters to cm

  // pull "label ... number unit" within a short window
  function grab(t, labelRe, unitRe, win) {
    const re = new RegExp("(?:" + labelRe.source + ")[^0-9\\n]{0," + (win || 25) + "}(-?\\d+(?:[.,]\\d+)?)\\s*(?:(?:-|–|to)\\s*(\\d+(?:[.,]\\d+)?))?\\s*(" + (unitRe ? unitRe.source : "") + ")?", "i");
    const m = t.match(re); if (!m) return null;
    const a = num(m[1]), b = m[2] != null ? num(m[2]) : null;
    return { v: b != null ? (a + b) / 2 : a, lo: a, hi: b, unit: m[3] || "", raw: m[0].trim() };
  }
  // severity word near a structure, e.g. "moderate mitral regurgitation", "mitral regurgitation: moderate"
  function sevNear(t, nounRe) {
    const w = "(trace|trivial|mild(?:\\s*(?:to|-)\\s*moderate)?|moderate(?:\\s*(?:to|-)\\s*severe)?|severe|no|none|no significant)";
    let m = t.match(new RegExp(w + "\\s+(?:\\w+\\s+){0,2}?(?:" + nounRe.source + ")", "i"));
    const m2 = t.match(new RegExp("(?:" + nounRe.source + ")[^.\\n]{0,20}?(?:is|:|-)?\\s*" + w + "\\b", "i"));
    const pick = [m, m2].filter(Boolean).map((x) => x[1].toLowerCase()).sort((a, b) => sevRank(b) - sevRank(a))[0];
    if (!pick) return null; if (/^(no|none|no significant)$/.test(pick)) return "none"; return sevWord(pick);
  }

  function parse(text) {
    const t = String(text || "").replace(/\r/g, "").replace(/[ \t]+/g, " "), low = t.toLowerCase(), F = {};
    // date
    const d = t.match(/(?:date|study date|exam date|performed)[^0-9a-z]{0,6}((?:\d{4}[-/]\d{1,2}[-/]\d{1,2})|(?:\d{1,2}[-/ ](?:[a-z]{3,9}|\d{1,2})[-/ ]\d{2,4})|(?:[a-z]{3,9}\.? \d{1,2},? \d{4}))/i); if (d) F.date = d[1];
    // EF
    let ef = grab(t, /\b(?:LVEF|LV EF|ejection fraction|\bEF)\b(?: \(?(?:biplane|simpson'?s?|visual(?:ly)?|estimated|3D)\)?)?/, /%/, 30);
    if (ef && (ef.v < 5 || ef.v > 85)) ef = null;
    if (ef) F.ef = ef;
    const q = low.match(/(severely|moderately|mildly|low normal|low-normal|normal|hyperdynamic|preserved|reduced)[^.\n]{0,25}(?:lv|left ventricular)?\s*(?:global\s+)?systolic function/) || low.match(/(?:lv|left ventricular)\s+(?:global\s+)?systolic function (?:is |was |appears )?(severely reduced|moderately reduced|mildly reduced|low normal|normal|hyperdynamic|preserved|reduced)/);
    if (q) F.efText = q[1];
    // LV size
    const lvd = grab(t, /\bLVID ?d\b|LV end[- ]diastolic diameter|LVEDD/, /cm|mm/); if (lvd) F.lvidd = { v: CM(lvd.v, lvd.unit), raw: lvd.raw };
    const lvdil = low.match(/(mildly|moderately|severely)?\s*dilated (?:lv|left ventricle)|(?:lv|left ventricle|left ventricular (?:size|cavity))[^.\n]{0,25}?(mildly |moderately |severely )?(dilated|enlarged)/);
    if (lvdil && !/not dilated|normal (?:in )?size/.test(lvdil[0])) F.lvDilated = (lvdil[1] || lvdil[2] || "").trim() || "yes";
    // walls
    const ivs = grab(t, /\bIVS ?d?\b|interventricular septum|septal (?:wall )?thickness/, /cm|mm/), pw = grab(t, /\bLVPW ?d?\b|\bPW ?d\b|posterior wall/, /cm|mm/);
    if (ivs) F.ivs = CM(ivs.v, ivs.unit); if (pw) F.pw = CM(pw.v, pw.unit);
    const lvh = low.match(/(mild|moderate|severe|marked)?\s*(concentric|eccentric|asymmetric(?:al)? septal|septal)?\s*(?:left ventricular |lv )?hypertrophy|(concentric remodel+ing)/);
    if (lvh && !/no (?:\w+ ){0,3}hypertrophy/.test(low)) F.lvh = lvh[0].trim();
    // regional wall motion
    const RW = /(akine\w*|hypokine\w*|dyskine\w*|aneurysm\w*)/i;
    const sentences = t.split(/(?<=[.;])\s+|\n+/).filter((s) => RW.test(s) && !/\bno (?:regional )?wall motion|no regional|without regional/i.test(s));
    const reg = sentences.filter((s) => /inferior|anterior|septal|septum|apical|apex|lateral|posterior|basal|mid|LAD|RCA|circumflex|territory|segment/i.test(s) && !/global(?:ly)? hypokine/i.test(s));
    if (reg.length) F.rwma = reg.map((s) => s.trim().replace(/[.;,]+$/, "")).slice(0, 3);
    if (/global(?:ly)? hypokine|diffuse(?:ly)? hypokine/i.test(t)) F.globalHK = true;
    if (/no regional wall motion abnormalit|regional wall motion (?:is |was )?normal|no rwma/i.test(t)) F.noRwma = true;
    // strain
    const gls = grab(t, /\bGLS\b|global longitudinal strain/, /%/); if (gls) F.gls = -Math.abs(gls.v);
    if (/apical sparing|relative apical/i.test(t)) F.apicalSparing = true;
    if (/granular|sparkl/i.test(t)) F.sparkling = true;
    // diastolic
    const gr = low.match(/grade\s*(i{1,3}|[123])\s*(?:\(?[a-z ]{0,25}\)?\s*)?diastolic dysfunction|(impaired relaxation|pseudonormal\w*|restrictive (?:filling|pattern))/);
    if (gr) F.dd = gr[1] ? ({ i: 1, ii: 2, iii: 3 }[gr[1]] || +gr[1]) : /impaired/.test(gr[2]) ? 1 : /pseudo/.test(gr[2]) ? 2 : 3;
    if (/indeterminate diastolic/i.test(t)) F.ddIndet = true;
    const ee = grab(t, /(?:average |mean |avg )?E\/e['’′]? ?(?:\(?(?:average|avg|mean|septal|lateral)\)?)?|E\/E prime/, null, 15); if (ee && ee.v > 2 && ee.v < 50) F.ee = ee.v;
    if (/elevated (?:lv |left ventricular |left atrial )?filling pressure|elevated la pressure|increased filling pressure/i.test(t)) F.highFP = true;
    if (/normal (?:lv |left ventricular )?filling pressure/i.test(t)) F.normalFP = true;
    // LA
    const lavi = grab(t, /\bLAVI\b|LA volume index(?:ed)?|indexed LA volume|LA vol(?:ume)? ?i\b|left atrial volume index/, /ml\/m2|ml\/m²|ml\/m\^2|mL\/m2/i); if (lavi && lavi.v > 5 && lavi.v < 200) F.lavi = lavi.v;
    const la = low.match(/(mildly|moderately|severely)\s+(?:dilated|enlarged)\s+(?:left atri\w*|la\b)|(?:left atri\w*|\bla\b)[^.\n]{0,20}?(mildly|moderately|severely)\s+(?:dilated|enlarged)/);
    if (la) F.laDil = la[1] || la[2];
    if (/bi-?atrial (?:enlargement|dilat)|both atria (?:are )?(?:dilated|enlarged)/i.test(t)) F.biatrial = true;
    // RV
    const tapse = grab(t, /\bTAPSE\b/, /cm|mm/); if (tapse) F.tapse = /cm/i.test(tapse.unit) || tapse.v < 5 ? tapse.v * 10 : tapse.v;
    const rvf = low.match(/(?:rv|right ventricular)\s+(?:global\s+)?systolic function[^.\n]{0,15}?(normal|mildly reduced|moderately reduced|severely reduced|reduced|low normal)|(normal|mildly reduced|moderately reduced|severely reduced|reduced)\s+(?:rv|right ventricular) (?:systolic )?function/);
    if (rvf) F.rvFn = rvf[1] || rvf[2];
    const rvd = low.match(/(mildly|moderately|severely)?\s*dilated (?:rv|right ventricle)|(?:\brv\b|right ventricle)[^.\n]{0,20}?(mildly |moderately |severely )?dilated/);
    if (rvd && !/not dilated/.test(rvd[0])) F.rvDil = (rvd[1] || rvd[2] || "yes").trim();
    const rvsp = grab(t, /\bRVSP\b|\bPASP\b|\bsPAP\b|PA systolic pressure|pulmonary artery systolic pressure|estimated pa pressure|right ventricular systolic pressure/, /mm ?hg/i, 30); if (rvsp && rvsp.v >= 10 && rvsp.v < 150) F.rvsp = rvsp.v;
    if (/rvsp[^.\n]{0,25}(?:could not|unable|not) (?:be )?(?:estimated|assessed|measured)/i.test(t)) F.rvspNA = true;
    // IVC
    const ivcD = grab(t, /\bIVC\b(?: diameter)?|inferior vena cava/, /cm|mm/); if (ivcD && ivcD.v) F.ivc = CM(ivcD.v, ivcD.unit);
    if (/(?:ivc|inferior vena cava)[^.\n]{0,40}(?:dilated|plethoric|<\s*50 ?%|less than 50|minimal|no|poor|does not) (?:respiratory )?(?:collapse|variation|change)?|plethoric (?:ivc|inferior vena cava)|dilated (?:ivc|inferior vena cava)/i.test(t)) F.ivcPleth = true;
    const rap = grab(t, /\bRAP\b|right atrial pressure|RA pressure/, /mm ?hg/i); if (rap && rap.v <= 25) F.rap = rap.v;
    // aortic stenosis
    const ava = grab(t, /\bAVA\b|aortic valve area|valve area \(?(?:VTI|continuity)\)?/, /cm2|cm²|cm\^2/i, 25); if (ava && ava.v > 0.1 && ava.v < 6) F.ava = ava.v;
    const mg = grab(t, /(?:AV |aortic (?:valve )?)?mean (?:pressure )?gradient|\bAV mean\b|mean PG|MG\b/, /mm ?hg/i, 20); if (mg && mg.v < 150) F.avMG = mg.v;
    const vmax = grab(t, /\bAV ?Vmax\b|\bVmax\b|peak (?:aortic )?velocity|aortic (?:valve )?peak velocity/, /m\/s|cm\/s/i, 20); if (vmax) F.vmax = /cm/i.test(vmax.unit) || vmax.v > 10 ? vmax.v / 100 : vmax.v;
    const di = grab(t, /\bDVI\b|dimensionless (?:index|velocity index)/, null, 10); if (di && di.v < 1.2) F.dvi = di.v;
    F.asText = sevNear(t, /aortic (?:valve )?stenosis|\bAS\b/);
    F.mr = sevNear(t, /mitral (?:valve )?(?:regurgitation|insufficiency)|\bMR\b/);
    F.ar = sevNear(t, /aortic (?:valve )?(?:regurgitation|insufficiency)|\bAR\b|\bAI\b/);
    F.tr = sevNear(t, /tricuspid (?:valve )?(?:regurgitation|insufficiency)|\bTR\b/);
    F.ms = sevNear(t, /mitral (?:valve )?stenosis|\bMS\b/);
    if (/prosthe|bioprosth|mechanical (?:aortic|mitral|valve)|\bTAVI\b|\bTAVR\b|\bAVR\b|\bMVR\b|mitraclip|annuloplasty/i.test(t)) F.prosthetic = (t.match(/[^.\n]*(?:prosthe|bioprosth|mechanical (?:aortic|mitral|valve)|TAVI|TAVR|\bAVR\b|\bMVR\b|mitraclip|annuloplasty)[^.\n]*/i) || [""])[0].trim();
    // effusion, thrombus, obstruction, other
    const eff = low.match(/(trivial|trace|small|small to moderate|moderate|moderate to large|large)\s+(?:circumferential\s+|posterior\s+|loculated\s+)?pericardial effusion/);
    if (eff) F.effusion = eff[1]; else if (/pericardial effusion/.test(low) && !/no (?:significant )?pericardial effusion/.test(low)) F.effusion = "present";
    if (/tamponade|(?:ra|rv|right atrial|right ventricular) (?:diastolic )?(?:collapse|inversion)/i.test(t) && !/no (?:echo\w* )?(?:evidence of |features of |signs of )?tamponade/i.test(t)) F.tamponade = true;
    if (/(?:lv|left ventricular|apical|la|left atrial (?:appendage )?|laa)\s*thromb/i.test(t) && !/no (?:\w+ ){0,3}thromb/i.test(t)) F.thrombus = (t.match(/[^.\n]*thromb[^.\n]*/i) || [""])[0].trim();
    if (/\bSAM\b|systolic anterior motion|lvot obstruction|lvot gradient|dynamic (?:lvot )?obstruction/i.test(t) && !/no (?:\w+ ){0,2}(?:lvot )?obstruction|no sam/i.test(t)) F.lvoto = true;
    if (/hypertrophic cardiomyopathy|\bHCM\b/i.test(t)) F.hcm = true;
    if (/takotsubo|apical ballooning/i.test(t)) F.takotsubo = true;
    if (/vegetation/i.test(t) && !/no (?:\w+ ){0,2}vegetation/i.test(t)) F.vegetation = true;
    if (/(?:shunt|pfo|asd|patent foramen)/i.test(t) && /positive|right[- ]to[- ]left|shunt (?:is )?(?:present|seen)/i.test(t)) F.shunt = true;
    if (/aortic root|ascending aorta/i.test(t)) { const ao = grab(t, /ascending aorta|aortic root/, /cm|mm/, 20); if (ao) F.aorta = CM(ao.v, ao.unit); }
    if (/technically (?:difficult|limited)|poor (?:acoustic )?windows|suboptimal (?:image|study)|limited study/i.test(t)) F.limited = true;
    if (/compared (?:to|with) (?:the )?(?:prior|previous)|since (?:the )?(?:prior|previous)/i.test(t)) F.compare = (t.match(/[^.\n]*(?:compared (?:to|with) (?:the )?(?:prior|previous)|since (?:the )?(?:prior|previous))[^.\n]*/i) || [""])[0].trim();
    return F;
  }

  function efCat(F) {
    let v = F.ef ? F.ef.v : null;
    if (v == null && F.efText) { const s = F.efText; v = /severely/.test(s) ? 25 : /moderately/.test(s) ? 35 : /mildly/.test(s) ? 45 : /low.normal/.test(s) ? 52 : /hyper/.test(s) ? 72 : /normal|preserved/.test(s) ? 60 : /reduced/.test(s) ? 38 : null; }
    if (v == null) return null;
    return { v, est: !F.ef, key: v <= 40 ? "low" : v < 50 ? "mid" : "pres", label: v <= 40 ? "HFrEF range (40% or less)" : v < 50 ? "HFmrEF range (41-49%)" : v > 70 ? "hyperdynamic" : "preserved (50% or more)" };
  }

  function asGrade(F) {
    const sev = [];
    if (F.ava != null) sev.push(F.ava < 1 ? 3 : F.ava <= 1.5 ? 2 : 1);
    if (F.avMG != null) sev.push(F.avMG >= 40 ? 3 : F.avMG >= 20 ? 2 : 1);
    if (F.vmax != null) sev.push(F.vmax >= 4 ? 3 : F.vmax >= 3 ? 2 : 1);
    const txt = F.asText && F.asText !== "none" ? sevRank(F.asText) : -1;
    if (txt >= 0) sev.push(txt >= 6 ? 3 : txt >= 4 ? 2 : 1);
    if (!sev.length) return F.asText === "none" ? { g: 0 } : null;
    const g = Math.max(...sev), lowFlow = F.ava != null && F.ava < 1 && F.avMG != null && F.avMG < 40;
    return { g, word: ["none", "mild", "moderate", "severe"][g], lowFlow };
  }

  // Findings (for the table) and "what matters" (plan bullets), each with a tone: urgent | action | info | ok
  function summarize(F) {
    const rows = [], M = [], E = efCat(F), A = asGrade(F), R = (k, v, tone, note) => rows.push({ k, v, tone, note: note || "" });
    if (E) {
      R("LV ejection fraction", (F.ef ? (F.ef.hi != null ? F.ef.lo + "-" + F.ef.hi : F.ef.v) + "%" : "about " + E.v + "% (from \"" + F.efText + "\")"), E.v <= 30 ? "urgent" : E.v <= 40 ? "action" : E.v < 50 ? "info" : "ok", E.label);
      if (E.key === "low") M.push(["action", `EF ${E.est ? "about " : ""}${Math.round(E.v)}%: HFrEF. Start/titrate all 4 GDMT pillars (ARNI/ACEi/ARB, evidence beta-blocker, MRA, SGLT2i) - see GDMT tab.` + (E.v <= 35 ? " EF 35% or less: repeat echo after 3 months of GDMT for ICD/CRT decision." : "")]);
      else if (E.key === "mid") M.push(["info", `EF ${Math.round(E.v)}%: HFmrEF. SGLT2i; consider ARNI/ACEi/ARB, beta-blocker, MRA (weaker evidence). Re-check EF: often improves or declines.`]);
      else M.push(["info", `EF ${Math.round(E.v)}%: preserved. HFpEF: SGLT2i, diuretic for congestion, treat BP/AF/obesity; look for HFpEF mimics (amyloid, valve, pericardial, HCM).`]);
    } else R("LV ejection fraction", "not found", "info", "check the report");
    if (F.lvDilated || F.lvidd) R("LV size", [F.lvDilated ? F.lvDilated + " dilated" : "", F.lvidd ? "LVIDd " + F.lvidd.v.toFixed(1) + " cm" : ""].filter(Boolean).join(", "), F.lvDilated || (F.lvidd && F.lvidd.v > 5.8) ? "action" : "ok");
    const wall = Math.max(F.ivs || 0, F.pw || 0);
    if (wall || F.lvh) R("LV walls", [F.ivs ? "IVS " + F.ivs.toFixed(1) + " cm" : "", F.pw ? "PW " + F.pw.toFixed(1) + " cm" : "", F.lvh || ""].filter(Boolean).join(", "), wall >= 1.5 ? "action" : wall >= 1.2 || F.lvh ? "info" : "ok", wall >= 1.5 ? "marked thickening" : wall >= 1.2 ? "LVH (1.2 cm or more)" : "");
    if (F.rwma) { R("Regional wall motion", F.rwma.join("; "), "action", "suggests coronary disease (or infarct)"); M.push(["action", "Regional wall motion abnormality: think ischemic cause - see the Ischemia & cardiology tab (ticked there with \"Use in this page\")."]); }
    else if (F.globalHK) R("Wall motion", "global hypokinesis", "info", "non-regional: ischemic or non-ischemic");
    else if (F.noRwma) R("Regional wall motion", "none", "ok");
    if (F.takotsubo) M.push(["action", "Apical ballooning / Takotsubo pattern: troponin and ECG trend, cardiology; coronary angiography usually needed to exclude ACS."]);
    if (F.gls != null || F.apicalSparing) R("Strain (GLS)", (F.gls != null ? F.gls + "%" : "") + (F.apicalSparing ? " apical sparing" : ""), F.apicalSparing ? "action" : F.gls > -16 ? "info" : "ok", F.gls != null && F.gls > -16 ? "abnormal (worse than -16%)" : "");
    // diastolic / filling
    if (F.dd || F.ee || F.highFP || F.ddIndet) R("Diastolic function", [F.dd ? "grade " + F.dd : F.ddIndet ? "indeterminate" : "", F.ee ? "E/e' " + F.ee : "", F.highFP ? "elevated filling pressure" : ""].filter(Boolean).join(", "), F.dd >= 2 || F.highFP || F.ee > 14 ? "action" : "info", F.dd >= 2 || F.highFP || F.ee > 14 ? "raised LA pressure: supports HF as cause of breathlessness" : "");
    if (F.lavi || F.laDil || F.biatrial) R("Left atrium", [F.lavi ? "LAVI " + F.lavi + " mL/m²" : "", F.laDil ? F.laDil + " dilated" : "", F.biatrial ? "biatrial enlargement" : ""].filter(Boolean).join(", "), F.lavi > 34 || F.laDil ? "info" : "ok", F.lavi > 34 ? "enlarged (over 34): chronic raised pressure, AF risk" : "");
    // RV / PA
    if (F.rvFn || F.tapse || F.rvDil) R("Right ventricle", [F.rvFn ? F.rvFn + " function" : "", F.tapse ? "TAPSE " + Math.round(F.tapse) + " mm" : "", F.rvDil ? (F.rvDil === "yes" ? "" : F.rvDil + " ") + "dilated" : ""].filter(Boolean).join(", "), /reduced/.test(F.rvFn || "") || (F.tapse && F.tapse < 17) ? "action" : "ok", F.tapse && F.tapse < 17 ? "TAPSE under 17 mm = RV dysfunction" : "");
    if (F.rvsp) R("RVSP / PA systolic", F.rvsp + " mmHg", F.rvsp >= 60 ? "urgent" : F.rvsp > 40 ? "action" : F.rvsp > 35 ? "info" : "ok", F.rvsp >= 60 ? "severe pulmonary hypertension range" : F.rvsp > 40 ? "pulmonary hypertension likely" : F.rvsp > 35 ? "borderline" : "");
    if ((/reduced/.test(F.rvFn || "") || (F.tapse && F.tapse < 17)) || F.rvsp > 40) M.push(["action", "RV dysfunction / pulmonary hypertension: mostly left-heart (post-capillary) in HF - decongest. If LV and valves look normal, think PE (CTPA / V/Q), lung disease, sleep apnea; avoid over-diuresing a pressure-dependent RV (watch BP, creatinine)."]);
    if (F.ivc != null || F.ivcPleth || F.rap) R("IVC / RA pressure", [F.ivc ? "IVC " + F.ivc.toFixed(1) + " cm" : "", F.ivcPleth ? "dilated, poor collapse" : "", F.rap ? "RAP " + F.rap + " mmHg" : ""].filter(Boolean).join(", "), F.ivcPleth || F.rap >= 15 || F.ivc > 2.1 ? "action" : "ok", F.ivcPleth || F.rap >= 15 ? "venous congestion at the time of the echo" : "");
    // valves
    if (A && A.g) { R("Aortic stenosis", A.word + [F.ava != null ? "; AVA " + F.ava + " cm²" : "", F.avMG != null ? "; mean gradient " + F.avMG + " mmHg" : "", F.vmax != null ? "; Vmax " + F.vmax + " m/s" : "", F.dvi != null ? "; DVI " + F.dvi : ""].join(""), A.g === 3 ? "urgent" : A.g === 2 ? "action" : "info", A.lowFlow ? "AVA under 1 with mean gradient under 40: possible low-flow low-gradient severe AS" : "severe: AVA under 1.0, mean gradient 40+, Vmax 4+");
      if (A.g === 3 || A.lowFlow) M.push(["urgent", "Severe (or possible low-flow) aortic stenosis: refer to cardiology / valve (TAVI) team this admission. Diurese gently; avoid hypotension, big vasodilator doses and nitrates; GDMT titrated with care."]);
      else if (A.g === 2) M.push(["info", "Moderate aortic stenosis: echo every 1-2 years; can progress - recheck sooner if symptoms."]); }
    [["mr", "Mitral regurgitation"], ["ar", "Aortic regurgitation"], ["tr", "Tricuspid regurgitation"], ["ms", "Mitral stenosis"]].forEach(([k, n]) => {
      const s = F[k]; if (!s || s === "none") return; const r = sevRank(s);
      R(n, s, r >= 5 ? "urgent" : r >= 4 ? "action" : "info");
      if (r >= 5) M.push(["urgent", `${s[0].toUpperCase() + s.slice(1)} ${n.toLowerCase()}: cardiology / valve clinic referral.` + (k === "mr" ? " Functional MR often improves with decongestion and GDMT - reassess after; persistent severe MR with HFrEF may suit transcatheter repair (COAPT)." : k === "tr" ? " Often secondary to RV/PA pressure or AF; treat the cause; transcatheter options exist." : k === "ms" ? " Rate control matters (filling time); anticoagulate if AF (warfarin for rheumatic moderate-severe MS)." : "")]);
      else if (r === 4) M.push(["info", `Moderate ${n.toLowerCase()}: follow-up echo; recheck after decongestion.`]);
    });
    if (F.prosthetic) { R("Prosthetic / repaired valve", F.prosthetic, "info"); M.push(["info", "Prosthetic or repaired valve: check gradients against the prior echo; mechanical valve = warfarin (no DOAC); fever → blood cultures and think endocarditis."]); }
    if (F.vegetation) { R("Vegetation", "reported", "urgent"); M.push(["urgent", "Vegetation reported: blood cultures x3, ID and cardiology; see the Infections / endocarditis tools."]); }
    if (F.thrombus) { R("Thrombus", F.thrombus, "urgent"); M.push(["urgent", "Intracardiac thrombus: anticoagulate unless contraindicated (warfarin or DOAC for LV thrombus, usually 3-6 months, repeat imaging)."]); }
    if (F.effusion) { R("Pericardial effusion", F.effusion + (F.tamponade ? " - tamponade features" : ""), F.tamponade ? "urgent" : /moderate|large/.test(F.effusion) ? "action" : "info"); if (F.tamponade) M.push(["urgent", "Echo features of tamponade: call cardiology now; avoid diuretics and vasodilators (preload dependent); pericardiocentesis."]); else if (/moderate|large/.test(F.effusion)) M.push(["action", "Moderate-large pericardial effusion: cause work-up (TSH, renal, malignancy, post-MI, inflammatory), repeat echo; cardiology."]); }
    if (F.lvoto || F.hcm) { R("LVOT obstruction / HCM", F.lvoto ? "SAM / LVOT gradient reported" : "HCM", "action"); M.push(["action", "LVOT obstruction / HCM: avoid over-diuresis, nitrates, vasodilators and inotropes; beta-blocker; cardiology."]); }
    if (F.aorta && F.aorta >= 4.5) R("Aorta", F.aorta.toFixed(1) + " cm", "action", "dilated: imaging follow-up, BP control");
    if (F.shunt) R("Shunt", "reported", "info");
    // amyloid
    const amy = [wall >= 1.2 && (E ? E.key !== "low" : true) ? "LV walls 1.2 cm or more" : "", F.apicalSparing ? "apical sparing on strain" : "", F.sparkling ? "granular / sparkling myocardium" : "", F.biatrial ? "biatrial enlargement" : "", F.effusion && wall >= 1.2 ? "pericardial effusion with thick walls" : "", F.dd === 3 ? "restrictive filling" : ""].filter(Boolean);
    if (amy.length >= 2 || F.apicalSparing) M.push(["action", "Echo clues to cardiac amyloidosis: " + amy.join(", ") + ". Look at the amyloid red flags (Cause & tests): serum free light chains and SPEP/UPEP with IFE, then PYP scan."]);
    if (F.limited) M.push(["info", "Technically limited study: findings may be incomplete - consider contrast echo or CMR if it matters."]);
    if (F.compare) R("Compared with prior", F.compare, "info");
    const ORD = { urgent: 0, action: 1, info: 2, ok: 3 }; M.sort((a, b) => ORD[a[0]] - ORD[b[0]]);
    return { rows, M, E, A, amy };
  }

  function noteLine(F, S) {
    S = S || summarize(F); const E = S.E, bits = [];
    if (E) bits.push(`EF ${F.ef ? (F.ef.hi != null ? F.ef.lo + "-" + F.ef.hi : F.ef.v) + "%" : F.efText}`);
    S.rows.filter((r) => r.k !== "LV ejection fraction" && r.tone !== "ok" && r.k !== "Compared with prior").forEach((r) => bits.push(`${r.k}: ${r.v}`));
    return `Echo${F.date ? " " + F.date : ""}: ` + (bits.length ? bits.join("; ") : "no key findings read") + ".";
  }

  const SAMPLE = `TRANSTHORACIC ECHOCARDIOGRAM   Study date: 2026-11-22
Indication: dyspnea, edema. Image quality: technically limited, poor acoustic windows.
Left ventricle: Mildly dilated. LVIDd 6.1 cm. IVSd 1.0 cm, LVPWd 1.0 cm. LVEF (biplane) 30-35%. Moderately reduced LV systolic function.
Hypokinesis of the inferior and inferolateral walls (RCA territory); remaining segments mildly hypokinetic.
Diastolic function: Grade II diastolic dysfunction (pseudonormal). Average E/e' 16. Elevated filling pressures.
Left atrium: moderately dilated, LA volume index 46 mL/m2.
Right ventricle: normal size. Mildly reduced RV systolic function. TAPSE 15 mm.
Aortic valve: trileaflet, calcified. Peak velocity 3.4 m/s, mean gradient 24 mmHg, AVA 1.2 cm2 (continuity). Moderate aortic stenosis. No aortic regurgitation.
Mitral valve: moderate to severe functional mitral regurgitation.
Tricuspid: mild tricuspid regurgitation. RVSP 52 mmHg (RAP 15 mmHg).
IVC 2.4 cm with less than 50% respiratory collapse.
Pericardium: small pericardial effusion, no tamponade.
Compared with the previous study of 2024-03-10, LVEF has decreased from 50% and the inferior wall motion abnormality is new.`;

  const api = { parse, summarize, noteLine, efCat, asGrade, SAMPLE };
  if (typeof module !== "undefined" && module.exports) { module.exports = api; return; }

  /* ---------- page ---------- */
  const $ = (id) => document.getElementById(id), esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  let last = null;
  const TESS = "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";
  const loadTess = () => (window.Tesseract ? Promise.resolve() : new Promise((ok, bad) => { const sc = document.createElement("script"); sc.src = TESS; sc.onload = ok; sc.onerror = () => bad(new Error("could not load the picture reader (network blocked?): paste the text instead")); document.head.appendChild(sc); }));

  function run() {
    const txt = $("echo-text").value.trim(), out = $("echo-out");
    if (!txt) { out.innerHTML = '<div class="muted">Paste an echo report above (text, or a screenshot with Ctrl+V), then press Summarize.</div>'; $("echosum").textContent = ""; last = null; return; }
    const F = parse(txt), S = summarize(F); last = { F, S };
    $("echosum").textContent = [S.E ? "EF " + Math.round(S.E.v) + "%" : "", S.M.filter((m) => m[0] === "urgent").length ? S.M.filter((m) => m[0] === "urgent").length + " urgent" : ""].filter(Boolean).join(" · ");
    out.innerHTML =
      `<h3>What matters${F.date ? " (echo " + esc(F.date) + ")" : ""}</h3>` +
      (S.M.length ? S.M.map(([t, m]) => `<div class="alert ${t === "ok" ? "info" : t}">${esc(m)}</div>`).join("") : '<div class="muted">Nothing that changes management was found. Read the full report.</div>') +
      `<h3>Key findings</h3><table class="agent"><tr><th>Finding</th><th>Report says</th><th>Meaning</th></tr>` +
      S.rows.map((r) => `<tr><td><span class="chip ${r.tone === "urgent" ? "c-no" : r.tone === "action" ? "c-unknown" : r.tone === "ok" ? "c-yes" : ""}">${r.tone === "urgent" ? "!!" : r.tone === "action" ? "!" : r.tone === "ok" ? "ok" : "·"}</span> <b>${esc(r.k)}</b></td><td>${esc(r.v)}</td><td class="muted">${esc(r.note)}</td></tr>`).join("") + "</table>" +
      `<div class="row"><button id="echo-use" class="primary">Use in this page</button><span class="muted">Sets EF${F.rwma ? ", ticks wall motion abnormality (Ischemia tab)" : ""}${S.A && S.A.g === 3 ? ", severe AS" : ""}${S.amy.length ? ", amyloid flags" : ""}.</span></div>` +
      `<h3>Note line</h3><textarea id="echo-note" style="min-height:70px">${esc(noteLine(F, S))}</textarea><div class="row"><button id="echo-copy">Copy</button><span class="muted">Rule-based reading of the text: values missed or misread are possible. Always read the full report.</span></div>`;
    $("echo-copy").onclick = () => { $("echo-note").select(); try { navigator.clipboard.writeText($("echo-note").value); } catch (e) { document.execCommand("copy"); } };
    $("echo-use").onclick = useIt;
  }

  function useIt() {
    if (!last) return; const { F, S } = last;
    if (S.E && $("ef")) $("ef").value = S.E.key;
    const tick = (id) => { const el = $(id); if (el) el.checked = true; };
    if (F.rwma) tick("ia-rwma");
    if (S.A && S.A.g === 3) tick("ia-sevas");
    if (F.limited) tick("ia-windows");
    try { if (typeof state !== "undefined") { if (Math.max(F.ivs || 0, F.pw || 0) >= 1.2) state.flags.lvh = true; if (F.apicalSparing || F.biatrial || F.sparkling || (F.effusion && Math.max(F.ivs || 0, F.pw || 0) >= 1.2)) state.flags.strain = true; } } catch (e) { /* page without the CHF state */ }
    if (typeof window.draw === "function") window.draw();
    $("echo-use").textContent = "Used ✓";
  }

  async function readImage(file) {
    const st = $("echo-status"); st.textContent = "Reading the picture in this browser… (first time takes ~10 s)";
    try { await loadTess(); const w = await Tesseract.createWorker("eng"); const { data } = await w.recognize(file); await w.terminate();
      $("echo-text").value = ($("echo-text").value ? $("echo-text").value + "\n" : "") + data.text; st.textContent = "Picture read. Check the text for misread numbers, then Summarize."; run();
    } catch (e) { st.textContent = (e && e.message) || String(e); }
  }

  function mount() {
    if (!$("echo-text")) return;
    $("echo-go").onclick = run;
    $("echo-sample").onclick = () => { $("echo-text").value = SAMPLE; run(); };
    $("echo-clear").onclick = () => { $("echo-text").value = ""; $("echo-status").textContent = ""; run(); };
    $("echo-text").addEventListener("paste", (ev) => {
      const its = [...((ev.clipboardData && ev.clipboardData.items) || [])].filter((i) => i.type.startsWith("image/"));
      if (its.length) { ev.preventDefault(); readImage(its[0].getAsFile()); } else setTimeout(run, 0);
    });
    $("echo-file").onchange = (ev) => { const f = ev.target.files[0]; if (f) readImage(f); ev.target.value = ""; };
    run();
  }
  window.CHFEcho = Object.assign({}, api, { run, mount });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount); else mount();
})();
