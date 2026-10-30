/* "Choosing a medication" guide for Crohn disease and ulcerative colitis. UNVERIFIED draft written by Claude.
   Efficacy tiers for advanced therapy are taken from guideline summaries read on 2026-10-30 (AGA ulcerative colitis guideline 2024 as summarised by MDCalc; ACG 2025 vs AGA comparison by
   Guideline Central; AGA living Crohn disease guideline Nov 2025 as summarised by AGA news). Everything marked "general practice" is from Claude's general knowledge, NOT from those sources.
   Guidelines change: check the current AGA, ACG and CAG documents, Health Canada approval, BC PharmaCare / Special Authority coverage, and local IBD service advice. Pure functions: node-testable. */
(function (root) {
  const SOURCES = [
    ["AGA living guideline, moderate-to-severe Crohn disease (Nov 2025), AGA news summary", "https://news.gastro.org/issues/2025/november/aga-unveils-new-clinical-practice-guideline-for-crohns-disease/"],
    ["AGA pharmacological management of moderate-to-severe ulcerative colitis (2024), MDCalc summary", "https://www.mdcalc.com/guidelines/10594/aga/Pharmacological-Management-of-Ulcerative-Colitis"],
    ["ACG (June 2025) vs AGA ulcerative colitis side by side, Guideline Central", "https://www.guidelinecentral.com/insights/june-2025-severeulcerativecolitis-guideline-sidebyside/"]
  ];
  const T = { H: "Higher efficacy", M: "Intermediate efficacy", L: "Lower efficacy" };
  /* tiers[disease][history] = {H:[drugIds], M:[...], L:[...]} */
  const TIERS = {
    uc: {
      naive: { H: ["infliximab", "vedolizumab", "ozanimod", "etrasimod", "upadacitinib", "risankizumab", "guselkumab"], M: ["golimumab", "ustekinumab", "tofacitinib", "filgotinib", "mirikizumab"], L: ["adalimumab"],
        note: "AGA 2024 tiers. ACG 2025 recommends all of these (it prefers vedolizumab over adalimumab) and suggests infliximab combined with a thiopurine." },
      exposed: { H: ["tofacitinib", "upadacitinib", "ustekinumab"], M: ["filgotinib", "mirikizumab", "risankizumab", "guselkumab"], L: ["adalimumab", "vedolizumab", "ozanimod", "etrasimod"],
        note: "AGA 2024 tiers for patients already exposed to advanced therapy, especially anti-TNF." }
    },
    cd: {
      naive: { H: ["infliximab", "adalimumab", "vedolizumab", "ustekinumab", "risankizumab", "mirikizumab", "guselkumab"], M: [], L: ["certolizumab", "upadacitinib"],
        note: "AGA living guideline (Nov 2025): early advanced therapy preferred over a step-up that starts with steroids or immunomodulators. Infliximab, adalimumab, ustekinumab, risankizumab, mirikizumab, guselkumab, upadacitinib recommended (vedolizumab and certolizumab suggested); higher-efficacy agents suggested over certolizumab or upadacitinib." },
      exposed: { H: ["adalimumab", "risankizumab", "guselkumab", "upadacitinib", "ustekinumab", "mirikizumab"], M: [], L: ["vedolizumab", "certolizumab"],
        note: "AGA living guideline (Nov 2025): after prior advanced therapy, higher or intermediate-efficacy agents suggested over vedolizumab or certolizumab (the summary gives one combined group, so the page does not split it)." }
    }
  };
  /* Stage text. src = "guideline" (from the sources above) or "general practice" (Claude's knowledge, not checked) */
  const LADDER = {
    uc: [
      { id: "mild", title: "Mild to moderate, not severe", src: "general practice",
        lines: ["Check extent: proctitis or left-sided disease starts with rectal 5-ASA (suppository or enema), with or without oral 5-ASA; extensive disease uses oral 5-ASA at an adequate dose.", "Not responding by about 4 to 8 weeks: add or switch to oral budesonide MMX, or a short oral corticosteroid course for a moderate flare.", "Steroids are for induction only. Do not use them for maintenance (ACG 2025)."], next: "Steroid-dependent, steroid-refractory, or relapsing on 5-ASA: go to advanced therapy." },
      { id: "adv", title: "Moderate to severe, or failed 5-ASA / steroid-dependent: advanced therapy", src: "guideline",
        lines: ["Pick from the efficacy tiers below (AGA 2024; ACG 2025 recommends all listed agents).", "Both societies advise against thiopurine monotherapy for induction. AGA suggests adding an immunomodulator to infliximab, adalimumab or golimumab; ACG suggests infliximab plus a thiopurine.", "Stop 5-ASA if it has failed and advanced therapy is started (AGA).", "Before starting: C. difficile, TB, hepatitis B, VZV, vaccines, pregnancy plans."], next: "Primary non-response or loss of response: check drug level and antibodies, then objective activity, then switch (below)." },
      { id: "switch", title: "Not responding to the first advanced therapy", src: "general practice",
        lines: ["Confirm active inflammation first (calprotectin, CRP, endoscopy) and exclude infection (C. difficile, CMV).", "Anti-TNF: therapeutic drug monitoring. Low level and no antibodies: optimise the dose or interval. Antibodies: switch within class with an immunomodulator, or switch class.", "Out of class: use the 'previously exposed' tiers below."], next: "" },
      { id: "asuc", title: "Acute severe colitis (admitted)", src: "general practice",
        lines: ["Admit. Exclude C. difficile. IV corticosteroid (for example methylprednisolone or hydrocortisone) and VTE prophylaxis; avoid opioids and anti-motility drugs.", "Assess response at about day 3 (stool frequency and CRP). Non-response: rescue with infliximab or cyclosporine, involve surgery early.", "Dose, timing and thresholds: take from your local ASUC protocol (not in the sources read here)."], next: "" },
      { id: "surg", title: "Surgery", src: "general practice", lines: ["Refractory disease, toxic megacolon, perforation, or dysplasia or cancer. Involve colorectal surgery early rather than late."], next: "" }
    ],
    cd: [
      { id: "mild", title: "Mild, ileocecal, no high-risk features", src: "general practice",
        lines: ["Oral budesonide for mild ileocecal disease can induce remission; 5-ASA has little role.", "Check risk first: young age at onset, extensive or small-bowel disease, perianal or penetrating disease, deep ulcers, prior resection, smoking, steroids needed at presentation. Any of these favours early advanced therapy instead."], next: "Relapse, steroid-dependent, or high-risk features: go to advanced therapy." },
      { id: "adv", title: "Moderate to severe, or high-risk: early advanced therapy", src: "guideline",
        lines: ["AGA 2025 prefers early use of advanced therapy rather than starting with corticosteroids or immunomodulators.", "Use the efficacy tiers below. Combination with a thiopurine when starting infliximab (AGA); the guideline notes the immunomodulator can be considered for withdrawal after prolonged steroid-free remission.", "No recommendation yet on combining a thiopurine with non-TNF biologics, on targeting mucosal healing over clinical remission, or on the timing of repeat endoscopy.", "Steroids only as a short bridge. Before starting: infection and TB / hepatitis B screen, vaccines, pregnancy plans."], next: "Not responding: check drug level and antibodies, objective activity, then switch (below)." },
      { id: "switch", title: "Not responding to the first advanced therapy", src: "general practice",
        lines: ["Confirm inflammation (calprotectin, CRP, endoscopy or imaging) and exclude other causes: infection, strictures, bile-acid diarrhoea, bacterial overgrowth.", "Anti-TNF: therapeutic drug monitoring, then optimise or switch within class with immunomodulator, or switch class.", "Use the 'previously exposed' tiers below."], next: "" },
      { id: "perianal", title: "Perianal fistulizing disease", src: "general practice",
        lines: ["Define anatomy first (examination under anaesthesia, MRI pelvis), drain sepsis, consider seton.", "Anti-TNF (infliximab, with or without a thiopurine, or adalimumab) has the most evidence. Other classes have less data. Surgical and GI joint care."], next: "" },
      { id: "stricture", title: "Stricturing (fibrostenotic) disease", src: "general practice",
        lines: ["Inflammatory narrowing may respond to medical therapy; a fibrotic stricture does not. Endoscopic dilation or surgery is usually needed for obstructive symptoms."], next: "" },
      { id: "postop", title: "After ileocecal resection", src: "general practice",
        lines: ["Check for recurrence with ileocolonoscopy at about 6 to 12 months (Rutgeerts score). Score i2 or higher is recurrence: escalate.", "High-risk patients (smoking, prior resection, penetrating disease) are usually started on prophylaxis, often an anti-TNF with or without a thiopurine. Stop smoking."], next: "" }
    ]
  };
  /* feature flags -> notes. each: when(f, disease) , text, level */
  const NOTES = [
    { id: "tb", when: (f) => f.tb, level: "urgent", text: "Positive TB test or untreated latent TB: do not start advanced therapy until assessed and treated (ID or respirology)." },
    { id: "hbv", when: (f) => f.hbv, level: "urgent", text: "Hepatitis B positive (surface antigen or core antibody): involve hepatology for antiviral cover before and during immunosuppression." },
    { id: "hf", when: (f) => f.hf, level: "action", drugs: ["infliximab", "adalimumab", "golimumab", "certolizumab"], text: "Heart failure (NYHA III or IV) or demyelinating disease: avoid anti-TNF agents." },
    { id: "jak", when: (f) => f.age >= 50 || f.cvrisk, level: "action", drugs: ["tofacitinib", "upadacitinib", "filgotinib"], text: "JAK inhibitors: caution with age 50 or older, cardiovascular risk factors, current or past smoking, venous thromboembolism or malignancy risk (regulator warnings). Weigh against alternatives." },
    { id: "s1p", when: (f, d) => d === "uc", level: "info", drugs: ["ozanimod", "etrasimod"], text: "S1P modulators are for ulcerative colitis only (not Crohn disease). Baseline ECG and eye review per monograph; caution with heart block, macular edema." },
    { id: "elderly", when: (f) => f.age >= 65, level: "info", drugs: ["vedolizumab", "ustekinumab"], text: "Age 65 or older: infection risk matters more. Gut-selective vedolizumab and ustekinumab are often favoured over JAK inhibitors or high-dose steroids (general practice)." },
    { id: "perianal", when: (f, d) => f.perianal && d === "cd", level: "info", drugs: ["infliximab", "adalimumab"], text: "Perianal fistulizing Crohn disease: anti-TNF has the most evidence. Vedolizumab and newer agents have less fistula data." },
    { id: "eim", when: (f) => f.eim, level: "info", drugs: ["infliximab", "adalimumab", "ustekinumab"], text: "Extraintestinal features (joint, skin, eye): anti-TNF and ustekinumab treat many of them; vedolizumab is gut-selective and may not." },
    { id: "preg", when: (f) => f.preg, level: "action", drugs: ["tofacitinib", "upadacitinib", "filgotinib", "ozanimod", "etrasimod"], text: "Pregnancy or planning: avoid methotrexate, JAK inhibitors and S1P modulators. Anti-TNF, vedolizumab and ustekinumab have the most pregnancy data. Involve the IBD service and obstetrics." },
    { id: "malig", when: (f) => f.malig, level: "action", drugs: ["tofacitinib", "upadacitinib", "filgotinib"], text: "Past or current cancer: JAK inhibitors and combination immunosuppression need oncology input; gut-selective or IL-12/23 or IL-23 agents are often preferred (general practice)." },
    { id: "infect", when: (f) => f.infect, level: "action", text: "Recurrent or serious infections: favour gut-selective vedolizumab or IL-12/23 / IL-23 agents; avoid adding steroids or combination immunosuppression where possible (general practice)." }
  ];

  function history(meds, ADV) {
    // meds: array from IBDRules.meds(); exposed = any advanced therapy ever on record
    const seen = meds.filter((m) => ADV.includes(m.cls.id) && m.status !== "none");
    return { exposed: seen.length > 0, names: seen.map((m) => m.drug.label.split(" (")[0]), classes: Array.from(new Set(seen.map((m) => m.cls.id))) };
  }
  function options(disease, hist) {
    const d = disease === "cd" ? "cd" : "uc"; const t = TIERS[d][hist === "exposed" ? "exposed" : "naive"];
    return { disease: d, hist, tiers: [["H", T.H, t.H], ["M", T.M, t.M], ["L", T.L, t.L]].filter((x) => x[2].length), note: t.note };
  }
  function notes(f, disease) { return NOTES.filter((n) => n.when(f, disease)).map((n) => ({ id: n.id, level: n.level, text: n.text, drugs: n.drugs || [] })); }
  /* which stage to highlight */
  function stage(disease, S) {
    if (disease === "uc") { if (S.acute) return "asuc"; if (S.band === "mild" || S.band === "remission") return "mild"; if (S.exposed && S.failing) return "switch"; return S.band ? "adv" : "mild"; }
    if (disease === "cd") { if (S.postop) return "postop"; if (S.perianal) return "perianal"; if (S.exposed && S.failing) return "switch"; if (S.band === "mild" && !S.highrisk) return "mild"; return S.band ? "adv" : "mild"; }
    return "";
  }
  root.IBDPath = { SOURCES, TIERS, LADDER, NOTES, T, history, options, notes, stage };
  if (typeof module !== "undefined" && module.exports) module.exports = root.IBDPath;
})(typeof window !== "undefined" ? window : globalThis);
