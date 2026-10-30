/* Pure rules for the IBD flowsheet (no page access, so they can be tested in node). UNVERIFIED draft written by Claude: every threshold and wording below
   must be checked against your IBD guidelines (for example ECCO, ACG, CAG, AGA) and local policy before real use. Nothing here orders anything. */
(function (root) {
  const DAY = 864e5;
  const D = (typeof window !== "undefined" ? window.IBD : root.IBD) || {};
  const CLASSES = D.CLASSES || [];
  /* how long after the last dose/order a drug still counts as "current" (days) */
  const WIN = { asa: 45, steroid: 30, immuno: 45, tnf: 120, integrin: 120, il: 150, jak: 45, s1p: 45, rescue: 30, abx: 21, supp: 90 };
  const BIOLOGIC = ["tnf", "integrin", "il"];
  const ADVANCED = ["tnf", "integrin", "il", "jak", "s1p"];
  /* fallback abnormal ranges [low, high] in the flowsheet units, used only when the lab sent no range of its own */
  const FALLBACK = { crp: [null, 5], esr: [null, 20], calpro: [null, 50], hgb: [120, null], wbc: [4, 11], anc: [2, 7.5], plt: [150, 450], alb: [35, null], ferritin: [30, null], tsat: [20, null], b12: [150, null], vitd: [50, null], creat: [null, 110], k: [3.5, 5.1], alt: [null, 40], alp: [null, 130], bili: [null, 21] };
  const POS = /positive|detected|reactive(?!.*non)|\bpos\b|present/i, NEG = /negative|not detected|non-?reactive|\bneg\b|absent|indeterminate/i;

  function labAbn(id, e) {
    if (e.text != null && e.v == null) return POS.test(e.text) && !NEG.test(e.text) ? true : NEG.test(e.text) ? false : null;
    if (e.abn === true || e.abn === false) return e.abn;
    const r = FALLBACK[id]; if (!r || typeof e.v !== "number") return null;
    return (r[0] != null && e.v < r[0]) || (r[1] != null && e.v > r[1]);
  }
  const latest = (arr) => (arr && arr.length ? arr.slice().sort((a, b) => b.t - a.t)[0] : null);
  const within = (e, now, days) => e && now - e.t <= days * DAY;
  const dayOf = (t) => { const d = new Date(t); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };

  /* ---------- scores ---------- */
  function pmayo(e) {
    const n = (x) => (x === "" || x == null || isNaN(+x) ? null : +x);
    const stools = n(e.stools), norm = n(e.normalStools) == null ? 1 : n(e.normalStools), bl = n(e.blood), pga = n(e.pga);
    if (stools == null || bl == null || pga == null) return null;
    const diff = stools - norm, sub = diff <= 0 ? 0 : diff <= 2 ? 1 : diff <= 4 ? 2 : 3;
    const score = sub + bl + pga;
    return { score, stoolSub: sub, band: score <= 1 ? "remission" : score <= 4 ? "mild" : score <= 6 ? "moderate" : "severe", max: 9 };
  }
  function hbi(e) {
    const n = (x) => (x === "" || x == null || isNaN(+x) ? null : +x);
    const wb = n(e.wellbeing), pain = n(e.pain), st = n(e.stools), mass = n(e.mass), comp = n(e.comps);
    if (wb == null || pain == null || st == null || mass == null) return null;
    const score = wb + pain + st + mass + (comp || 0);
    return { score, band: score < 5 ? "remission" : score <= 7 ? "mild" : score <= 16 ? "moderate" : "severe" };
  }
  function scoreEntry(e, disease) {
    const o = {}; if (disease !== "cd") o.pmayo = pmayo(e); if (disease !== "uc") o.hbi = hbi(e);
    return o;
  }
  /* Truelove and Witts (modified): UC with 6+ bloody stools a day AND one of: pulse >90, temp >37.8, Hgb <105 g/L, ESR >30 mm/h (CRP >30 mg/L is often used too) */
  function severeUC(S, now) {
    const ent = latest((S.entries || []).filter((e) => within(e, now, 3) && e.stools !== "" && e.stools != null));
    if (!ent || +ent.stools < 6 || !(+ent.blood >= 1)) return null;
    const f = S.f || {}, why = [];
    const vit = (f.vitals || []).filter((v) => within(v, now, 3));
    const hr = Math.max.apply(null, vit.map((v) => v.hr).filter((x) => typeof x === "number").concat([-1])), tp = Math.max.apply(null, vit.map((v) => v.temp).filter((x) => typeof x === "number").concat([-1]));
    if (hr > 90) why.push("pulse " + hr); if (tp > 37.8) why.push("temp " + tp);
    const lab = (id) => { const e = latest((f.labs || {})[id]); return within(e, now, 3) ? e : null; };
    const h = lab("hgb"), es = lab("esr"), cr = lab("crp");
    if (h && h.v < 105) why.push("Hgb " + h.v); if (es && es.v > 30) why.push("ESR " + es.v); if (cr && cr.v > 30) why.push("CRP " + cr.v);
    return why.length ? { stools: +ent.stools, why } : null;
  }

  /* ---------- medications ---------- */
  const classOf = (drugId) => CLASSES.find((c) => c.drugs.some((d) => d.id === drugId));
  function meds(S, now) {
    const evs = ((S.f && S.f.meds) || []).concat(S.manualMeds || []);
    const out = [];
    CLASSES.forEach((c) => c.drugs.forEach((d) => {
      const mine = evs.filter((e) => e.drug === d.id).sort((a, b) => a.t - b.t);
      const st = { drug: d, cls: c, events: mine, status: "none", first: mine[0] || null, last: mine[mine.length - 1] || null, reqActive: mine.some((e) => e.reqActive) };
      if (mine.length) {
        const last = st.last, win = (WIN[c.id] || 45) * DAY;
        if (last.type === "stopped") st.status = "stopped";
        else if (last.type === "held") st.status = "held";
        else if (st.reqActive || now - last.t <= win || (last.src === "entered" && (last.type === "started" || last.type === "changed"))) st.status = "current";
        else st.status = "past";
      }
      out.push(st);
    }));
    return out;
  }
  const current = (ms, clsIds) => ms.filter((m) => m.status === "current" && (!clsIds || clsIds.includes(m.cls.id)));

  /* ---------- endoscopy ---------- */
  function endoList(S) { return ((S.f && S.f.endo) || []).concat(S.manualEndo || []).sort((a, b) => b.t - a.t); }
  function endoBand(e) {
    if (e.mayo != null) return "Mayo endoscopic " + e.mayo + (e.mayo <= 1 ? " (mucosal healing range)" : e.mayo === 2 ? " (moderate)" : " (severe)");
    if (e.sescd != null) return "SES-CD " + e.sescd + (e.sescd <= 2 ? " (remission)" : e.sescd <= 6 ? " (mild)" : e.sescd <= 15 ? " (moderate)" : " (severe)");
    if (e.rutgeerts) return "Rutgeerts " + e.rutgeerts + (/^i[01]$/i.test(e.rutgeerts) ? " (no or minimal recurrence)" : " (recurrence)");
    return "";
  }

  /* ---------- alerts ---------- */
  function alerts(S, now) {
    now = now || Date.now();
    const A = [], f = S.f || {}, L = f.labs || {}, disease = S.disease || "unknown", inpt = S.setting === "inpatient";
    const add = (level, text, src) => A.push({ level, text, src: src || "" });
    const ms = meds(S, now), cur = current(ms), curAdv = current(ms, ADVANCED), curBio = current(ms, BIOLOGIC);
    const has = (id) => cur.some((m) => m.drug.id === id);
    const lat = (id) => latest(L[id]), val = (id, days) => { const e = lat(id); return e && (days == null || within(e, now, days)) ? e : null; };
    const flaring = !!S.flaring || inpt;
    const age = f.age, male = /^m/i.test(f.sex || "");

    // infections first
    const cd = lat("cdiff");
    if (cd && labAbn("cdiff", cd) === true && within(cd, now, 30)) add("urgent", "C. difficile result is POSITIVE (" + dayOf(cd.t) + "). Treat per local guideline and review immunosuppression with the GI team.", "stool result in chart");
    else if (flaring && !(cd && within(cd, now, 14))) add("action", "No C. difficile test found in the last 14 days. Test for C. difficile (and other stool pathogens) in every flare before escalating immunosuppression, unless done elsewhere.", "general IBD practice, verify");
    const cm = lat("cmv"); if (cm && labAbn("cmv", cm) === true && within(cm, now, 60)) add("action", "CMV result is positive (" + dayOf(cm.t) + "). In steroid-refractory colitis tissue CMV matters; discuss with GI and ID.", "chart result");

    // severe UC
    const sv = severeUC(S, now);
    if (sv && disease !== "cd") add("urgent", "Meets severe ulcerative colitis criteria (Truelove and Witts, modified): " + sv.stools + " bloody stools a day plus " + sv.why.join(", ") + ". Usual pathway: admit, IV corticosteroid, exclude C. difficile, VTE prophylaxis, early GI and surgical review, and a response check at about day 3.", "entered symptoms and chart, UNVERIFIED");

    // screening before or during advanced therapy
    const tb = val("tb"), hbs = val("hbsag"), hbc = val("hbcab");
    if (tb && labAbn("tb", tb) === true) add("urgent", "TB test is positive or reactive (" + dayOf(tb.t) + "). Do not start or continue biologic or JAK therapy without TB assessment (ID / respirology).", "chart result");
    if (hbs && labAbn("hbsag", hbs) === true) add("urgent", "Hepatitis B surface antigen positive (" + dayOf(hbs.t) + "). Needs hepatology or ID input and antiviral cover before and during immunosuppression.", "chart result");
    else if (hbc && labAbn("hbcab", hbc) === true && (cur.some((m) => m.cls.immuno))) add("action", "Hepatitis B core antibody positive while on immunosuppression. Reactivation risk: check HBV DNA and discuss prophylaxis or monitoring with hepatology.", "chart result");
    if (curAdv.length || has("azathioprine") || has("mercaptopurine") || has("methotrexate")) {
      const miss = []; if (!tb) miss.push("TB test"); if (!hbs && !hbc) miss.push("hepatitis B screen");
      if (miss.length) add("action", "On " + curAdv.concat(cur.filter((m) => ["immuno"].includes(m.cls.id))).map((m) => m.drug.label.split(" (")[0]).join(", ") + " but no " + miss.join(" or ") + " found in the chart (searched back 3 years). It may have been done elsewhere: confirm.", "chart search by name, UNVERIFIED");
    }

    // steroids
    const steroids = ms.filter((m) => m.cls.id === "steroid" && m.drug.id !== "budesonide" && m.status === "current");
    if (steroids.length) {
      const first = Math.min.apply(null, steroids.map((m) => m.first.t)), weeks = Math.floor((now - first) / (7 * DAY));
      if (weeks >= 12) add("action", "Systemic corticosteroid on record for about " + weeks + " weeks (first entry " + dayOf(first) + "). Steroid-dependent disease: review steroid-sparing therapy, bone protection and infection prophylaxis.", "medication dates in chart, UNVERIFIED");
      if (!curAdv.length && !cur.some((m) => m.cls.id === "immuno")) add("info", "On systemic corticosteroid with no steroid-sparing therapy found (biologic, JAK, S1P, thiopurine or methotrexate). Check that a maintenance plan exists.", "medication names in chart");
      const g = val("glucose", 7); if (g && g.v > 10) add("info", "Glucose " + g.v + " mmol/L (" + dayOf(g.t) + ") while on corticosteroid.", "chart result");
    }

    // drug level monitoring
    const cr = val("crp", 30), calp = val("calpro", 60);
    const active = (cr && labAbn("crp", cr) === true) || (calp && calp.v > 250) || !!S.flaring;
    [["infliximab", "ifx", "ifxab"], ["adalimumab", "ada", null]].forEach(([drug, lvl, ab]) => {
      if (has(drug) && active && !val(lvl, 180)) add("info", drug[0].toUpperCase() + drug.slice(1) + " with signs of active disease and no drug level in the last 6 months. Consider a trough level and anti-drug antibodies (therapeutic drug monitoring).", "chart search by name");
    });
    if (has("infliximab") && val("ifxab") && labAbn("ifxab", val("ifxab")) === true) add("action", "Anti-infliximab antibodies are reported. Review the drug level and the plan with GI.", "chart result");

    // thiopurine / methotrexate safety
    if (has("azathioprine") || has("mercaptopurine") || has("thioguanine")) {
      const w = val("wbc", 60), a = val("anc", 60), p = val("plt", 60), ly = val("lymph", 60), al = val("alt", 90);
      const bad = []; if (w && w.v < 3) bad.push("WBC " + w.v); if (a && a.v < 1.5) bad.push("ANC " + a.v); if (p && p.v < 100) bad.push("platelets " + p.v); if (ly && ly.v < 0.5) bad.push("lymphocytes " + ly.v); if (al && labAbn("alt", al) === true) bad.push("ALT " + al.v);
      if (bad.length) add("action", "On a thiopurine with " + bad.join(", ") + ". Review dose, adherence, interacting drugs (allopurinol), infection, and consider a 6-TGN level.", "chart results, UNVERIFIED thresholds");
      else if (!val("wbc", 90)) add("info", "On a thiopurine and no CBC in the last 90 days.", "chart search");
      if (!val("tpmt", 3650)) add("info", "No TPMT / NUDT15 result found for a patient on a thiopurine.", "chart search by name");
    }
    if (has("methotrexate")) {
      const al = val("alt", 90), w = val("wbc", 90); if (!al || !w) add("info", "On methotrexate and no recent CBC or ALT (90 days) found.", "chart search");
      const ce = val("creat", 90); if (ce && labAbn("creat", ce) === true) add("action", "On methotrexate with an abnormal creatinine (" + ce.v + "). Review dose.", "chart result");
    }
    if (has("tofacitinib") || has("upadacitinib") || has("filgotinib")) {
      if (age != null && age >= 50) add("info", "JAK inhibitor at age " + age + ". Review venous thromboembolism, cardiovascular and malignancy risk factors and the lipid profile.", "general, verify");
      const vz = val("vzv", 3650); if (!vz) add("info", "JAK inhibitor: no VZV result found. Herpes zoster risk: consider serology and vaccination.", "chart search");
    }

    // blood counts, iron, nutrition
    const hg = val("hgb", 90);
    if (hg) {
      const cut = male ? 130 : 120;
      if (hg.v < cut) {
        const fe = val("ferritin", 180), ts = val("tsat", 180), infl = cr && cr.v > 5;
        let t = "Anemia: hemoglobin " + hg.v + " g/L (" + dayOf(hg.t) + ").";
        if (!fe && !ts) t += " No iron studies found: check ferritin and transferrin saturation, B12 and folate.";
        else if ((fe && (fe.v < 30 || (infl && fe.v < 100))) || (ts && ts.v < 20)) t += " Pattern fits iron deficiency (ferritin " + (fe ? fe.v : "?") + ", TSAT " + (ts ? ts.v : "?") + "). Replacement is usually indicated; IV iron is often preferred when disease is active.";
        else t += " Iron studies do not clearly show deficiency: consider B12, folate, inflammation, thiopurine or other causes.";
        add(hg.v < 80 ? "action" : "info", t, "chart result, cut-off " + cut + " g/L UNVERIFIED");
      }
    }
    const al = val("alb", 60); if (al && al.v < 35) add("info", "Albumin " + al.v + " g/L (" + dayOf(al.t) + "): a marker of severity and nutritional risk. Consider dietitian input.", "chart result");
    const b12 = val("b12", 365); if (b12 && b12.v < 150) add("info", "Vitamin B12 " + b12.v + " pmol/L is low. Common after ileal disease or resection in Crohn disease.", "chart result");
    const vd = val("vitd", 365); if (vd && vd.v < 50) add("info", "25-OH vitamin D " + vd.v + " nmol/L is low. Consider supplementation, especially with steroid exposure.", "chart result");
    const k = val("k", 7); if (k && k.v < 3.5 && flaring) add("action", "Potassium " + k.v + " mmol/L in an active flare. Replace and check magnesium.", "chart result");
    const wts = (f.weights || []).slice().sort((a, b) => a.t - b.t);
    if (wts.length >= 2) { const l = wts[wts.length - 1], ref = wts.filter((w) => l.t - w.t >= 14 * DAY && l.t - w.t <= 120 * DAY).sort((a, b) => b.v - a.v)[0]; if (ref && (ref.v - l.v) / ref.v >= 0.05) add("info", "Weight down " + Math.round(((ref.v - l.v) / ref.v) * 100) + "% (" + ref.v + " to " + l.v + " kg between " + dayOf(ref.t) + " and " + dayOf(l.t) + "). Nutritional review.", "weights in chart"); }

    // inpatient safety
    if (inpt) {
      if (!cur.some((m) => m.drug.id === "vte")) add("action", "Admitted with IBD and no VTE prophylaxis found by name. Active colitis raises clot risk; prophylaxis is usually given even with rectal bleeding unless there is a contraindication (local policy).", "medication names in chart");
      const lop = cur.filter((m) => m.drug.id === "loperamide"); if (lop.length) add("action", "Loperamide is on the medication list. Avoid anti-motility drugs in severe colitis (toxic megacolon risk).", "medication names in chart");
      (f.watch || []).filter((w) => now - w.t <= 14 * DAY).forEach((w) => { /* handled below */ });
    }
    const nsaid = (f.watch || []).filter((w) => w.kind === "nsaid" && now - w.t <= 30 * DAY), opi = (f.watch || []).filter((w) => w.kind === "opioid" && now - w.t <= 14 * DAY);
    if (nsaid.length) add("info", "NSAID on record (" + nsaid[0].name + "). NSAIDs can trigger IBD flares; confirm they are needed.", "medication names in chart");
    if (opi.length && flaring) add("info", "Opioid on record (" + opi[0].name + ") during a flare. Opioids and anti-motility drugs can mask or worsen colitis and risk megacolon.", "medication names in chart");

    // endoscopy
    const en = endoList(S);
    if (!en.length) add("info", "No endoscopy found in the chart (searched procedures, reports and documents by name). Add it below if it was done elsewhere.", "chart search");
    else {
      const e0 = en[0], months = Math.floor((now - e0.t) / (30.4 * DAY));
      if (months >= 12 && (flaring || active)) add("info", "Last endoscopy was about " + months + " months ago (" + dayOf(e0.t) + ") and disease looks active. Consider repeat endoscopic assessment.", "chart + entered, UNVERIFIED");
    }
    if (f.onsetT && now - f.onsetT >= 8 * 365.25 * DAY && disease !== "unknown") add("info", "Diagnosed about " + Math.floor((now - f.onsetT) / (365.25 * DAY)) + " years ago (" + dayOf(f.onsetT) + "). Colitis of 8 or more years duration usually needs dysplasia surveillance colonoscopy at an interval set by risk; check when the last one was.", "condition date in chart, UNVERIFIED");

    // objective inflammation summary when nothing else is said
    const order = { urgent: 0, action: 1, info: 2 };
    return A.sort((a, b) => order[a.level] - order[b.level]);
  }

  /* ---------- screening checklist for starting advanced therapy ---------- */
  const SCREEN = [["tb", "TB (IGRA or skin test)"], ["hbsag", "Hepatitis B surface antigen"], ["hbcab", "Hepatitis B core antibody"], ["hbsab", "Hepatitis B surface antibody"], ["hcv", "Hepatitis C"], ["hiv", "HIV"], ["vzv", "VZV IgG"], ["tpmt", "TPMT / NUDT15 (before a thiopurine)"]];

  root.IBDRules = { DAY, WIN, ADVANCED, BIOLOGIC, FALLBACK, labAbn, latest, within, dayOf, pmayo, hbi, scoreEntry, severeUC, meds, current, classOf, endoList, endoBand, alerts, SCREEN };
  if (typeof module !== "undefined" && module.exports) module.exports = root.IBDRules;
})(typeof window !== "undefined" ? window : global);
