/* Fever of unknown origin (FUO): pure decision rules. No chart access here, so it can be tested with node.
   UNVERIFIED DRAFT written by Claude from: Durack & Street 1991 FUO categories (classic, nosocomial, neutropenic, HIV);
   Petersdorf & Beeson 1961; Haidar & Singh, NEJM 2022 "Fever of Unknown Origin" review; Wright & Auwaerter, Am Fam Physician 2022;
   Bleeker-Rovers et al. 2007 structured approach and potentially diagnostic clues (PDCs); Kouijzer et al. 2018 PET-CT meta-analysis;
   Fardet et al. 2014 HScore (Arthritis Rheumatol); Yamaguchi et al. 1992 adult-onset Still's criteria; 2022 ACR/EULAR GCA classification
   criteria (Ponte et al.); Cunha 2000 relative bradycardia; Patel & Gallagher drug fever review; 2023 Duke-ISCVID endocarditis criteria.
   Check with infectious diseases, rheumatology and hematology before real use. */
(function () {
  const DAY = 864e5, HR = 36e5;
  const r0 = (v) => Math.round(v), r1 = (v) => Math.round(v * 10) / 10;

  /* ---------- fever curve ---------- */
  // temps: [{t, v (°C)}] oldest first. thr 38.3 (Petersdorf).
  function feverStats(temps, now, thr) {
    thr = thr || 38.3; now = now || Date.now();
    const out = { n: (temps || []).length, tmax: null, feverDays: 0, first: null, last: null, spanDays: 0, daily: [], t24: null, thr };
    if (!temps || !temps.length) return out;
    const byDay = {};
    temps.forEach((x) => { const d = new Date(x.t); const k = d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate(); if (!byDay[k] || x.v > byDay[k].v) byDay[k] = { t: x.t, v: x.v }; });
    out.daily = Object.values(byDay).sort((a, b) => a.t - b.t);
    out.tmax = temps.reduce((a, x) => (x.v > a.v ? x : a), temps[0]);
    const fev = temps.filter((x) => x.v >= thr);
    out.feverDays = out.daily.filter((d) => d.v >= thr).length;
    out.episodes = fev.length;
    if (fev.length) { out.first = fev[0]; out.last = fev[fev.length - 1]; out.spanDays = r1((out.last.t - out.first.t) / DAY); }
    const recent = temps.filter((x) => now - x.t <= DAY);
    out.t24 = recent.length ? recent.reduce((a, x) => (x.v > a.v ? x : a), recent[0]) : null;
    out.afebrile48 = !temps.some((x) => now - x.t <= 2 * DAY && x.v >= thr) && temps.some((x) => now - x.t <= 2 * DAY);
    return out;
  }

  // pulse-temperature deficit (relative bradycardia, Cunha): temp >= 38.9 with HR < 100 measured within 1 h, not on rate-slowing drugs / pacer
  function relBrady(temps, hrs, rateDrugs) {
    if (rateDrugs) return { found: false, skipped: true, pairs: [] };
    const pairs = [];
    (temps || []).filter((x) => x.v >= 38.9).forEach((t) => {
      const h = (hrs || []).filter((x) => Math.abs(x.t - t.t) <= HR).sort((a, b) => Math.abs(a.t - t.t) - Math.abs(b.t - t.t))[0];
      if (h && h.v < 100) pairs.push({ t: t.t, temp: t.v, hr: h.v });
    });
    return { found: pairs.length > 0, pairs };
  }

  /* ---------- FUO category (Durack & Street) ---------- */
  // o: { feverDays (duration in days), feverEpisodes, admittedDays, presentOnAdmission, anc, hiv, workupDone, workupTotal, culturesDays }
  function fuoType(o) {
    const why = [], dur = o.durationDays;
    if (o.anc != null && o.anc < 0.5) {
      return { kind: "neutropenic", label: "Neutropenic fever", meets: null, urgent: true,
        why: [`ANC ${o.anc} ×10⁹/L (under 0.5)`], text: "Treat as febrile neutropenia NOW (cultures then empiric broad-spectrum antibiotic within 60 min). Neutropenic FUO = still undiagnosed after 3 days of treatment including 2 days of cultures." };
    }
    if (o.hiv) {
      const meets = (o.admittedDays != null && o.admittedDays >= 3) || (dur != null && dur >= 28);
      return { kind: "hiv", label: "HIV-associated FUO", meets: dur == null && o.admittedDays == null ? null : meets,
        why: ["HIV on the problem list", dur != null ? `fever ${dur} days` : "", o.admittedDays != null ? `in hospital ${o.admittedDays} days` : ""].filter(Boolean),
        text: "Fever over 4 weeks as an outpatient or over 3 days in hospital. Get the CD4 count and viral load: with CD4 under 200 think MAC, TB, CMV, PJP, cryptococcus, histoplasmosis, lymphoma, IRIS and drug fever." };
    }
    if (o.admittedDays != null && o.presentOnAdmission === false) {
      const meets = o.admittedDays >= 3 && (o.culturesDays == null || o.culturesDays >= 2);
      return { kind: "nosocomial", label: "Nosocomial (hospital-acquired) FUO", meets,
        why: [`fever began after admission (in hospital ${o.admittedDays} days)`],
        text: "Fever not present or incubating on admission, still undiagnosed after 3 days including 2 days of cultures. Think lines, C. difficile, drug fever, DVT/PE, sinusitis (NG tubes), acalculous cholecystitis, pancreatitis, transfusion, hematoma, surgical site, gout/pseudogout, aspiration." };
    }
    if (dur == null) return { kind: "classic", label: "Classic FUO?", meets: null, why: ["fever duration unknown: enter when the fever started"], text: "Classic FUO: temperature 38.3 °C or more on several occasions, for 3 weeks or longer, with no diagnosis after 3 outpatient visits, 3 days in hospital, or 1 week of good investigation." };
    if (dur >= 21) why.push(`fever for ${dur} days (3 weeks or more)`); else why.push(`fever for ${dur} days (under 3 weeks: not yet FUO, but the same approach helps)`);
    if (o.feverEpisodes != null) why.push(o.feverEpisodes >= 2 ? `${o.feverEpisodes} readings 38.3 °C or more` : "fewer than 2 readings 38.3 °C or more in the chart");
    if (o.workupTotal) why.push(`minimum workup ${o.workupDone}/${o.workupTotal} done`);
    const meets = dur >= 21 && (o.feverEpisodes == null || o.feverEpisodes >= 2);
    return { kind: "classic", label: meets ? "Classic FUO" : "Prolonged fever (not yet FUO)", meets, why,
      text: "Classic FUO: temperature 38.3 °C or more on several occasions, for 3 weeks or longer, with no diagnosis after 3 outpatient visits, 3 days in hospital, or 1 week of good investigation. Causes: infection, cancer and inflammatory disease in roughly equal thirds in recent series, with up to a third to a half never diagnosed (most of these settle on their own)." };
  }

  /* ---------- lab and chart clues ---------- */
  // c: latest values { wbc, anc, lymph, mono, eos, hb, plt, ferritin, ldh, alp, alt, ast, esr, crp, ca, alb, tg, fib, na, k, tsh, cr, crBase, pct, neutPct }
  // q: qualitative { bcPos, bcNeg (count no growth), ana: 'pos'|'neg', rf, igra, hiv, ... }
  function labClues(c, q) {
    const L = [], add = (id, text, why, tone) => L.push({ id, text, why, tone: tone || "info" });
    const v = (x) => (x && x.v != null ? x.v : null);
    const wbc = v(c.wbc), anc = v(c.anc), ly = v(c.lymph), mo = v(c.mono), eo = v(c.eos), hb = v(c.hb), plt = v(c.plt);
    if (anc != null && anc < 0.5) add("neutropenia", `Neutropenia: ANC ${anc}`, "Febrile neutropenia pathway now; marrow failure, drug, leukemia, HLH", "urgent");
    if (ly != null && ly < 1.0) add("lymphopenia", `Lymphopenia ${ly}`, "TB, HIV, lymphoma, SLE, sarcoid, steroids", "info");
    if (mo != null && mo > 1.0) add("monocytosis", `Monocytosis ${mo}`, "TB, endocarditis, brucella, lymphoma, CMML, IBD", "info");
    if (eo != null && eo > 0.5) add("eos", `Eosinophilia ${eo}`, "Drug fever/DRESS, parasites (Strongyloides), EGPA, Hodgkin lymphoma, adrenal insufficiency", "action");
    if (wbc != null && wbc >= 15 && c.neutPct && c.neutPct.v >= 80) add("neutrophilia", `WBC ${wbc} with ${c.neutPct.v}% neutrophils`, "Bacterial infection/abscess, adult-onset Still's, vasculitis", "info");
    const low = [hb != null && hb <= 92, wbc != null && wbc <= 5, plt != null && plt <= 110].filter(Boolean).length;
    if (low >= 2) add("cytopenias", `Cytopenia in ${low} lines (Hb ${hb ?? "?"}, WBC ${wbc ?? "?"}, plt ${plt ?? "?"})`, "HLH, marrow infiltration (lymphoma, leukemia, TB, fungus), SLE, hypersplenism: smear, then marrow", "action");
    if (plt != null && plt > 450) add("thrombocytosis", `Platelets ${plt}`, "Reactive: GCA, abscess, IBD, cancer", "info");
    if (hb != null && hb < 100 && low < 2) add("anemia", `Hb ${hb}`, "Anemia of inflammation; iron deficiency points to colon cancer / IBD; hemolysis", "info");
    const fer = v(c.ferritin);
    if (fer != null && fer >= 10000) add("ferritin10k", `Ferritin ${r0(fer)}`, "Very high: HLH first, also adult-onset Still's, disseminated infection (histoplasma, TB, EBV), lymphoma", "urgent");
    else if (fer != null && fer >= 3000) add("ferritin3k", `Ferritin ${r0(fer)}`, "High: adult-onset Still's, HLH, lymphoma, liver disease. Calculate the HScore", "action");
    else if (fer != null && fer >= 1000) add("ferritin1k", `Ferritin ${r0(fer)}`, "Raised: inflammation, Still's, lymphoma, liver disease", "info");
    const ldh = v(c.ldh);
    if (ldh != null && ldh > 250) add("ldh", `LDH ${r0(ldh)}`, ldh > 500 ? "Much raised: lymphoma, HLH, hemolysis, PJP, leukemia" : "Lymphoma, HLH, hemolysis, PJP", ldh > 500 ? "action" : "info");
    const alp = v(c.alp);
    if (alp != null && alp > 150) add("alp", `ALP ${r0(alp)}`, "Granulomatous disease (TB, sarcoid), lymphoma, liver abscess or metastases, GCA, cholangitis", "info");
    const alt = v(c.alt), ast = v(c.ast);
    if ((alt != null && alt > 80) || (ast != null && ast > 80)) add("transaminitis", `ALT ${alt ?? "?"} / AST ${ast ?? "?"}`, "Viral (EBV, CMV, hepatitis), Q fever, Still's, drug, HLH, typhoid, leptospirosis", "info");
    const esr = v(c.esr), crp = v(c.crp);
    if (esr != null && esr >= 100) add("esr100", `ESR ${esr}`, "Over 100: GCA, endocarditis, osteomyelitis, abscess, TB, myeloma, lymphoma, Still's", "action");
    else if (esr != null && esr >= 50) add("esr50", `ESR ${esr}`, "Supports an inflammatory or infectious cause", "info");
    if (crp != null && crp >= 100) add("crp100", `CRP ${r0(crp)}`, "Bacterial infection, abscess, Still's, vasculitis", "info");
    if (esr != null && esr < 20 && crp != null && crp < 10) add("lowInflam", `ESR ${esr}, CRP ${crp}`, "Normal inflammatory markers with fever: think drug fever, factitious fever, central fever, thyroid", "info");
    const ca = v(c.ca), alb = v(c.alb), cca = ca != null ? (alb != null ? Math.round((ca + 0.02 * (40 - alb)) * 100) / 100 : ca) : null;
    if (cca != null && cca > 2.6) add("hypercal", `Corrected Ca ${cca}`, "Sarcoid, TB, fungal granulomas, lymphoma, cancer", "action");
    const tg = v(c.tg), fib = v(c.fib);
    if (tg != null && tg > 3) add("hyperTG", `Triglycerides ${tg}`, "HLH (fasting TG over 3.0)", "action");
    if (fib != null && fib <= 1.5) add("lowFib", `Fibrinogen ${fib}`, "HLH, DIC", "action");
    const na = v(c.na), k = v(c.k);
    if (na != null && na < 133 && k != null && k > 5.0) add("adrenal", `Na ${na}, K ${k}`, "Adrenal insufficiency (check AM cortisol), especially after steroids were stopped", "action");
    const tsh = v(c.tsh); if (tsh != null && tsh < 0.1) add("lowTSH", `TSH ${tsh}`, "Subacute thyroiditis, thyrotoxicosis", "action");
    const pct = v(c.pct); if (pct != null && pct >= 0.5) add("pct", `Procalcitonin ${pct}`, "Favours bacterial infection (also raised in Still's)", "info");
    if (q.bcPos && q.bcPos.length) add("posBC", `Positive blood culture: ${q.bcPos[0].text}`, "S. aureus, strep, enterococcus or HACEK: endocarditis until proven otherwise (echo). S. gallolyticus/bovis or C. septicum: colon cancer", "urgent");
    if (q.ana === "pos") add("posANA", "ANA positive", "SLE, mixed CTD; low-titre ANA is common and not specific", "info");
    if (q.ana === "neg" && q.rf === "neg") add("negANARF", "ANA and RF negative", "Fits adult-onset Still's (Yamaguchi minor criterion)", "info");
    if (q.igra === "pos") add("posIGRA", "IGRA (QuantiFERON) positive", "TB infection: look for active TB (cannot tell latent from active)", "action");
    if (q.hiv === "pos") add("posHIV", "HIV test reactive", "HIV-associated FUO; CD4 and viral load", "urgent");
    return L;
  }

  /* ---------- drug fever ---------- */
  const DRUG_FEVER = [
    { re: /piperacillin|penicillin|amoxicillin|ampicillin|cloxacillin|cefazolin|ceftriaxone|cefepime|ceftazidime|cephalexin|cefuroxime|meropenem|ertapenem|imipenem/i, cls: "beta-lactam", common: true },
    { re: /sulfamethoxazole|septra|bactrim|co-trimoxazole|sulfasalazine|sulfadiazine|dapsone/i, cls: "sulfonamide / dapsone", common: true },
    { re: /vancomycin/i, cls: "vancomycin", common: true }, { re: /rifampin|rifampicin|isoniazid|pyrazinamide/i, cls: "TB drug" },
    { re: /minocycline|nitrofurantoin/i, cls: "minocycline / nitrofurantoin" }, { re: /amphotericin/i, cls: "amphotericin (infusion fever)" },
    { re: /phenytoin|dilantin|carbamazepine|tegretol|lamotrigine|phenobarbital|oxcarbazepine/i, cls: "anticonvulsant (also DRESS)", common: true },
    { re: /allopurinol/i, cls: "allopurinol (also DRESS)", common: true }, { re: /\bheparin\b|enoxaparin|dalteparin/i, cls: "heparin" },
    { re: /procainamide|quinidine|hydralazine|methyldopa/i, cls: "cardiovascular (lupus-like)" },
    { re: /haloperidol|olanzapine|quetiapine|risperidone|chlorpromazine|metoclopramide/i, cls: "antipsychotic / metoclopramide (NMS: rigidity, CK)" },
    { re: /sertraline|fluoxetine|citalopram|escitalopram|paroxetine|venlafaxine|linezolid|tramadol|fentanyl|methadone|ondansetron|trazodone/i, cls: "serotonergic (serotonin syndrome if combined: clonus, agitation)" },
    { re: /azathioprine|mesalamine|bleomycin|interferon|gemcitabine|nivolumab|pembrolizumab|ipilimumab|atezolizumab|durvalumab/i, cls: "immunomodulator / chemo / checkpoint inhibitor" },
    { re: /abacavir|nevirapine/i, cls: "antiretroviral hypersensitivity" }, { re: /clopidogrel|ticagrelor/i, cls: "antiplatelet (rare)" },
    { re: /iodine|iodinated contrast|propylthiouracil|methimazole/i, cls: "antithyroid / iodine" }];
  // meds: [{text, t (start), status}], feverStart t
  function drugFever(meds, feverStart) {
    const out = [];
    (meds || []).forEach((m) => {
      const d = DRUG_FEVER.find((x) => x.re.test(m.text)); if (!d) return;
      let days = null, fits = null;
      if (m.t && feverStart) { days = r1((feverStart - m.t) / DAY); fits = days >= 1 && days <= 21; }
      if (days != null && days < 0) return; // started after the fever began: cannot have caused it
      out.push({ text: m.text, cls: d.cls, common: !!d.common, startedDaysBeforeFever: days, fits });
    });
    return out.sort((a, b) => (b.fits === true) - (a.fits === true) || b.common - a.common);
  }

  /* ---------- differential ---------- */
  // clue ids come from bedside ticks, labClues ids and chart flags. w: 2 strong, 1 supportive.
  const DDX = [
    // Infection
    { id: "ie", cat: "Infection", name: "Endocarditis (incl. culture-negative)", clues: { posBC: 2, murmur: 2, valve: 2, emboli: 2, ivdu: 2, device: 1, esr100: 1, monocytosis: 1, priorAbx: 1, anemia: 1 },
      tests: "3 sets of blood cultures before antibiotics (hold antibiotics in a stable patient to re-culture); TTE then TEE (or PET-CT with prosthetic valve/device); 2023 Duke-ISCVID criteria. Culture-negative: Coxiella (Q fever), Bartonella, Brucella serology; Tropheryma whipplei PCR on valve; fungal.", consult: "Infectious diseases, Cardiology (echo)" },
    { id: "abscess", cat: "Infection", name: "Abscess (liver, spleen, kidney, psoas, pelvic, prostate)", clues: { recentSurgery: 2, abdoPain: 2, alp: 1, dm: 1, backPain: 1, crp100: 1, neutrophilia: 1, esr100: 1, posBC: 1 },
      tests: "CT abdomen/pelvis with contrast; ultrasound liver; MRI for psoas/spine; drainage with culture. Amoebic serology if travel.", consult: "Infectious diseases, IR for drainage" },
    { id: "tb", cat: "Infection", name: "Tuberculosis (extrapulmonary, miliary, TB lymphadenitis)", clues: { tbRisk: 2, posIGRA: 2, lymphopenia: 1, monocytosis: 1, hypercal: 1, alp: 1, lymphadenopathy: 1, nightSweats: 1, weightLoss: 1, immuno: 1, hiv: 1, cytopenias: 1 },
      tests: "IGRA (negative does NOT exclude active TB); sputum AFB smear/culture/NAAT ×3 (induced if needed); early-morning urine AFB ×3; biopsy of any lesion for AFB culture + histology (send fresh tissue, not all in formalin); marrow or liver biopsy for miliary. Airborne isolation if lung involvement.", consult: "Infectious diseases / TB clinic; public health" },
    { id: "osteo", need: ["backPain"], cat: "Infection", name: "Vertebral osteomyelitis / discitis", clues: { backPain: 2, posBC: 1, ivdu: 1, esr100: 1, dm: 1, device: 1 },
      tests: "MRI spine with gadolinium; blood cultures; CT-guided biopsy before antibiotics if cultures negative.", consult: "Infectious diseases, spine surgery if neuro deficit" },
    { id: "device", need: ["device"], cat: "Infection", name: "Line, device, prosthetic joint or vascular graft infection", clues: { device: 2, posBC: 1, recentSurgery: 1 },
      tests: "Cultures from line and periphery; joint aspiration; PET-CT or labelled-WBC scan for grafts; TEE for pacemaker leads.", consult: "Infectious diseases, the surgeon who placed it" },
    { id: "viral", cat: "Infection", name: "Viral: CMV, EBV, acute HIV, hepatitis", clues: { lymphadenopathy: 1, soreThroat: 1, transaminitis: 2, sexualRisk: 1, splenomegaly: 1, rash: 1, immuno: 1 },
      tests: "EBV VCA IgM/IgG and EBNA; CMV IgM/PCR (PCR if immunosuppressed); HIV Ag/Ab + viral load (acute HIV: Ab can be negative); hepatitis A/B/C/E.", consult: "Infectious diseases" },
    { id: "zoon", need: ["animals", "catScratch"], cat: "Infection", name: "Zoonoses: Q fever, brucellosis, Bartonella, tularemia, leptospirosis", clues: { animals: 2, relBrady: 1, transaminitis: 1, splenomegaly: 1, lymphadenopathy: 1, catScratch: 2 },
      tests: "Coxiella burnetii phase I/II serology; Brucella serology + prolonged blood cultures (tell the lab); Bartonella serology/PCR; Leptospira serology/PCR.", consult: "Infectious diseases" },
    { id: "travel", need: ["travel"], cat: "Infection", name: "Travel: malaria, typhoid, dengue, rickettsia, leishmaniasis, amoebic abscess", clues: { travel: 2, relBrady: 1, splenomegaly: 1, cytopenias: 1, transaminitis: 1, eos: 1, rash: 1 },
      tests: "Malaria thick/thin smears + RDT ×3 (12-24 h apart) TODAY if travel to an endemic area in the past year; blood/stool cultures (typhoid); dengue NS1/serology; rickettsial serology; Strongyloides serology before steroids.", consult: "Infectious diseases / tropical medicine" },
    { id: "fungal", need: ["immuno", "travel", "hiv"], cat: "Infection", name: "Endemic or invasive fungal (histoplasma, blastomyces, coccidioides, cryptococcus)", clues: { immuno: 2, travel: 1, hiv: 1, cytopenias: 1, transaminitis: 1, ferritin10k: 1 },
      tests: "Urine and serum histoplasma antigen; serum cryptococcal antigen; beta-D-glucan; fungal blood cultures; biopsy with fungal stains.", consult: "Infectious diseases" },
    { id: "syph", need: ["sexualRisk"], cat: "Infection", name: "Secondary syphilis", clues: { sexualRisk: 2, rash: 1, lymphadenopathy: 1, transaminitis: 1 },
      tests: "Syphilis serology (treponemal EIA, then RPR).", consult: "Infectious diseases / STI clinic" },
    // Cancer
    { id: "lymphoma", cat: "Cancer", name: "Lymphoma (Hodgkin, non-Hodgkin, intravascular)", clues: { lymphadenopathy: 2, splenomegaly: 2, ldh: 2, nightSweats: 1, weightLoss: 1, cytopenias: 1, hypercal: 1, alp: 1, eos: 1, pruritus: 1, ferritin3k: 1 },
      tests: "CT neck/chest/abdomen/pelvis; FDG PET-CT; EXCISIONAL (not FNA) biopsy of the most PET-avid node; LDH, smear, flow cytometry; marrow if cytopenias. Avoid steroids before the biopsy. Intravascular lymphoma: random skin biopsy.", consult: "Hematology" },
    { id: "leuk", cat: "Cancer", name: "Leukemia / MDS / myeloproliferative", clues: { cytopenias: 2, neutropenia: 1, splenomegaly: 1, ldh: 1 },
      tests: "Peripheral smear (blasts), flow cytometry, marrow biopsy.", consult: "Hematology" },
    { id: "solid", cat: "Cancer", name: "Solid tumour: renal cell, liver (HCC/metastases), colon, pancreas", clues: { weightLoss: 1, anemia: 1, alp: 1, hematuria: 2, cirrhosis: 1, thrombocytosis: 1, posBC: 1 },
      tests: "CT chest/abdomen/pelvis; AFP if cirrhosis; colonoscopy if iron deficiency or S. gallolyticus/C. septicum bacteremia.", consult: "Medical oncology after tissue" },
    { id: "myxoma", need: ["emboli", "murmur"], cat: "Cancer", name: "Atrial myxoma", clues: { emboli: 2, murmur: 1, weightLoss: 1, esr50: 1 },
      tests: "Echocardiogram.", consult: "Cardiology, cardiac surgery" },
    // Inflammatory
    { id: "aosd", cat: "Inflammatory", name: "Adult-onset Still's disease", clues: { salmonRash: 2, arthralgia: 2, soreThroat: 1, neutrophilia: 2, ferritin3k: 2, ferritin10k: 1, transaminitis: 1, negANARF: 1, lymphadenopathy: 1, splenomegaly: 1 },
      tests: "Yamaguchi criteria (score below) after excluding infection and cancer; ferritin and glycosylated ferritin under 20% if available; watch for macrophage activation syndrome (HLH).", consult: "Rheumatology" },
    { id: "gca", cat: "Inflammatory", name: "Giant cell arteritis / polymyalgia rheumatica", clues: { age50: 1, headache: 2, jawClaud: 2, visual: 2, girdlePain: 2, esr100: 2, esr50: 1, thrombocytosis: 1, anemia: 1, alp: 1 },
      tests: "Temporal artery ultrasound (halo sign) or biopsy (within 1-2 weeks of starting steroids); PET-CT or CT angiography for large-vessel GCA (fever can be the only symptom in older people).", consult: "Rheumatology; ophthalmology same day if visual symptoms" },
    { id: "vasc", cat: "Inflammatory", name: "Systemic vasculitis (GPA, MPA, PAN, EGPA)", clues: { vascSigns: 2, hematuria: 2, eos: 1, esr50: 1, weightLoss: 1, rash: 1 },
      tests: "ANCA (PR3, MPO); urinalysis with microscopy (red cell casts); creatinine; hepatitis B (PAN); biopsy of skin, kidney or nerve.", consult: "Rheumatology, nephrology if kidney" },
    { id: "sle", cat: "Inflammatory", name: "SLE and other connective tissue disease", clues: { posANA: 2, rash: 1, arthralgia: 1, cytopenias: 1, lymphopenia: 1, hematuria: 1 },
      tests: "ANA, anti-dsDNA, ENA, C3/C4, urinalysis, protein:creatinine ratio, CK (myositis).", consult: "Rheumatology" },
    { id: "sarcoid", cat: "Inflammatory", name: "Sarcoidosis", clues: { hypercal: 2, lymphadenopathy: 1, alp: 1, rash: 1, lymphopenia: 1 },
      tests: "CT chest (hilar nodes); biopsy showing non-caseating granulomas (and stains to exclude TB/fungus); ACE is not diagnostic.", consult: "Respirology" },
    { id: "ibd", need: ["diarrhea", "abdoPain"], cat: "Inflammatory", name: "Inflammatory bowel disease (Crohn's)", clues: { diarrhea: 2, abdoPain: 1, weightLoss: 1, anemia: 1, thrombocytosis: 1 },
      tests: "Fecal calprotectin; CT or MR enterography; colonoscopy with ileal intubation.", consult: "Gastroenterology" },
    { id: "crystal", need: ["arthralgia"], cat: "Inflammatory", name: "Crystal arthritis (polyarticular gout or pseudogout)", clues: { arthralgia: 2, age50: 1, crp100: 1 },
      tests: "Aspirate any effusion: crystals, cell count, culture.", consult: "Rheumatology" },
    { id: "autoinfl", need: ["recurrent", "vexas"], cat: "Inflammatory", name: "Autoinflammatory: periodic fever syndromes, VEXAS", clues: { recurrent: 2, vexas: 2 },
      tests: "Episode diary with CRP during and between attacks; MEFV (FMF); UBA1 gene testing for VEXAS (older man, macrocytosis, chondritis, skin lesions, steroid-dependent inflammation).", consult: "Rheumatology" },
    // Other
    { id: "drug", cat: "Other", name: "Drug fever (incl. DRESS)", clues: { drugFit: 2, drugAny: 1, eos: 1, rash: 1, relBrady: 1, lowInflam: 1, transaminitis: 1 },
      tests: "Stop or switch the most likely drug: fever should settle within 48-72 h (longer with DRESS). Look for eosinophilia, rash, liver and kidney involvement (DRESS, RegiSCAR).", consult: "Pharmacy; dermatology for DRESS" },
    { id: "vte", need: ["legSwelling", "immobile", "recentSurgery", "cancerHx"], cat: "Other", name: "DVT / PE", clues: { legSwelling: 2, immobile: 1, cancerHx: 1, recentSurgery: 1 },
      tests: "Leg Doppler; CTPA.", consult: "" },
    { id: "thyroid", need: ["neckPain", "lowTSH"], cat: "Other", name: "Subacute thyroiditis / thyrotoxicosis", clues: { neckPain: 2, lowTSH: 2 },
      tests: "TSH, free T4/T3; thyroid ultrasound / uptake.", consult: "Endocrinology" },
    { id: "adrenal", need: ["adrenal", "steroidStop"], cat: "Other", name: "Adrenal insufficiency", clues: { adrenal: 2, steroidStop: 2 },
      tests: "AM cortisol (with ACTH); cosyntropin test. Give stress-dose hydrocortisone first if unstable.", consult: "Endocrinology" },
    { id: "hlh", cat: "Other", name: "HLH (hemophagocytic lymphohistiocytosis), incl. macrophage activation syndrome", clues: { ferritin10k: 2, ferritin3k: 1, cytopenias: 2, splenomegaly: 1, hyperTG: 2, lowFib: 2, transaminitis: 1, ldh: 1 },
      tests: "HScore (below); soluble IL-2 receptor (sCD25); marrow biopsy; look for the trigger (EBV/CMV PCR, lymphoma, Still's/SLE).", consult: "Hematology URGENTLY" },
    { id: "hematoma", need: ["anticoag", "hbDrop"], cat: "Other", name: "Hematoma (retroperitoneal, muscle) or other tissue injury", clues: { anticoag: 1, hbDrop: 2, recentSurgery: 1 },
      tests: "CT abdomen/pelvis.", consult: "" },
    { id: "central", need: ["neuroEvent"], cat: "Other", name: "Central fever (stroke, ICH, brain injury)", clues: { neuroEvent: 2, lowInflam: 1 },
      tests: "Diagnosis of exclusion; no diurnal pattern, poor antipyretic response.", consult: "" },
    { id: "factitious", need: ["factitious"], cat: "Other", name: "Factitious or fabricated fever", clues: { factitious: 2, lowInflam: 1 },
      tests: "Supervised (observed) temperature; simultaneous urine temperature; look for polymicrobial bacteremia from self-injection.", consult: "Psychiatry once proven" }];

  function differential(clueSet) {
    return DDX.filter((d) => !d.need || d.need.some((k) => clueSet[k])).map((d) => {
      const hits = Object.entries(d.clues).filter(([k]) => clueSet[k]).map(([k, w]) => ({ k, w, label: clueSet[k] }));
      return { ...d, score: hits.reduce((a, h) => a + h.w, 0), strong: hits.filter((h) => h.w >= 2).length, hits };
    }).filter((d) => d.score >= 2).sort((a, b) => b.score - a.score || b.strong - a.strong);
  }

  /* ---------- HScore (Fardet 2014) ---------- */
  // o: { tmax °C, organ: 0 none / 1 liver or spleen / 2 both, hb g/L, wbc, plt, ferritin ug/L, tg mmol/L, fib g/L, ast U/L, hemophago bool, immuno bool }
  function hscore(o) {
    const items = [], miss = [];
    const add = (n, pts, val) => items.push([n + (val != null ? ` (${val})` : ""), pts]);
    add("Known immunosuppression", o.immuno ? 18 : 0, o.immuno ? "yes" : "no");
    if (o.tmax == null) miss.push("temperature"); else add("Temperature", o.tmax > 39.4 ? 49 : o.tmax >= 38.4 ? 33 : 0, o.tmax + " °C");
    add("Organomegaly", o.organ === 2 ? 38 : o.organ === 1 ? 23 : 0, ["none", "liver or spleen", "liver and spleen"][o.organ || 0]);
    if (o.hb == null && o.wbc == null && o.plt == null) miss.push("CBC");
    else { const n = [o.hb != null && o.hb <= 92, o.wbc != null && o.wbc <= 5, o.plt != null && o.plt <= 110].filter(Boolean).length; add("Cytopenias", n === 3 ? 34 : n === 2 ? 24 : 0, n + " line" + (n === 1 ? "" : "s")); }
    if (o.ferritin == null) miss.push("ferritin"); else add("Ferritin", o.ferritin > 6000 ? 50 : o.ferritin >= 2000 ? 35 : 0, r0(o.ferritin) + " ug/L");
    if (o.tg == null) miss.push("triglycerides"); else add("Triglycerides", o.tg > 4 ? 64 : o.tg >= 1.5 ? 44 : 0, o.tg + " mmol/L");
    if (o.fib == null) miss.push("fibrinogen"); else add("Fibrinogen", o.fib <= 2.5 ? 30 : 0, o.fib + " g/L");
    if (o.ast == null) miss.push("AST"); else add("AST", o.ast >= 30 ? 19 : 0, r0(o.ast) + " U/L");
    add("Hemophagocytosis on marrow", o.hemophago ? 35 : 0, o.hemophago ? "yes" : "not seen / not done");
    const score = items.reduce((a, i) => a + i[1], 0);
    const band = score >= 250 ? "very likely" : score >= 169 ? "likely" : score > 90 ? "possible" : "unlikely";
    return { score, items, miss, band, positive: score >= 169,
      text: `HScore ${score}${miss.length ? " (partial: missing " + miss.join(", ") + ")" : ""}: HLH ${band}. Cut-off 169 (sensitivity 93%, specificity 86% in the derivation study).` };
  }

  /* ---------- Adult-onset Still's: Yamaguchi 1992 ---------- */
  // o: { fever39week, arthralgia2wk, rash, leukocytosis (WBC>=10 with >=80% neutrophils), soreThroat, nodesSpleen, liverAbn, anaRfNeg, exclusionsDone }
  function yamaguchi(o) {
    const major = [["Fever 39 °C or more for 1 week or more", o.fever39week], ["Arthralgia or arthritis for 2 weeks or more", o.arthralgia2wk], ["Typical rash (salmon, evanescent, with fever)", o.rash], ["WBC 10 or more with 80% or more neutrophils", o.leukocytosis]];
    const minor = [["Sore throat", o.soreThroat], ["Lymphadenopathy and/or splenomegaly", o.nodesSpleen], ["Abnormal liver enzymes", o.liverAbn], ["Negative ANA and RF", o.anaRfNeg]];
    const nMaj = major.filter((x) => x[1]).length, nMin = minor.filter((x) => x[1]).length, total = nMaj + nMin;
    const meets = total >= 5 && nMaj >= 2;
    return { major, minor, nMaj, nMin, total, meets,
      text: `${total} criteria (${nMaj} major). ${meets ? "Meets Yamaguchi criteria (5 or more, at least 2 major)" : "Does not meet Yamaguchi criteria (needs 5 or more with at least 2 major)"}. Only valid after infection, cancer (especially lymphoma) and other rheumatic disease are excluded.` };
  }

  /* ---------- GCA: 2022 ACR/EULAR classification criteria ---------- */
  // entry: age >= 50. o: { age, stiffness, visualLoss, jawClaud, headache, scalp, taExam, esrcrp, tabHalo, axillary, petAorta }
  function gca2022(o) {
    const items = [["Morning stiffness in shoulders/neck", o.stiffness, 2], ["Sudden visual loss", o.visualLoss, 3], ["Jaw or tongue claudication", o.jawClaud, 2], ["New temporal headache", o.headache, 2],
      ["Scalp tenderness", o.scalp, 2], ["Abnormal temporal artery exam", o.taExam, 2], ["Maximum ESR 50 or more, or CRP 10 mg/L or more", o.esrcrp, 3],
      ["Positive temporal artery biopsy or halo sign on ultrasound", o.tabHalo, 5], ["Bilateral axillary artery involvement on imaging", o.axillary, 2], ["FDG-PET activity throughout the aorta", o.petAorta, 2]];
    const score = items.filter((x) => x[1]).reduce((a, x) => a + x[2], 0);
    const entry = o.age != null && o.age >= 50;
    return { items, score, entry, meets: entry && score >= 6,
      text: !entry ? `Entry criterion not met (age ${o.age ?? "?"}: needs 50 or older)` : `${score} points: ${score >= 6 ? "meets" : "does not meet"} classification criteria (6 or more). Classification criteria help, but a high clinical suspicion is enough to treat.` };
  }

  /* ---------- workup checklist ---------- */
  // have: map id -> {status:'done'|'pending'|null, text, t}
  // ctx: clue set + age etc. returns items with stage and whether indicated
  const WORKUP = [
    { id: "cbc", stage: 1, t: "CBC with differential and smear review" }, { id: "chem", stage: 1, t: "Electrolytes, creatinine, calcium, albumin" },
    { id: "lft", stage: 1, t: "Liver tests (ALT, AST, ALP, bilirubin)" }, { id: "ck", stage: 1, t: "CK" }, { id: "ldh", stage: 1, t: "LDH" },
    { id: "esr", stage: 1, t: "ESR" }, { id: "crp", stage: 1, t: "CRP" }, { id: "ferritin", stage: 1, t: "Ferritin" },
    { id: "ua", stage: 1, t: "Urinalysis with microscopy and urine culture" }, { id: "bc", stage: 1, t: "Blood cultures: 3 sets, ideally before antibiotics", why: "Endocarditis is the infection most often missed" },
    { id: "hiv", stage: 1, t: "HIV antigen/antibody" }, { id: "hep", stage: 1, t: "Hepatitis B and C serology" }, { id: "ana", stage: 1, t: "ANA" }, { id: "rf", stage: 1, t: "Rheumatoid factor" },
    { id: "spep", stage: 1, t: "Serum protein electrophoresis" }, { id: "tsh", stage: 1, t: "TSH" }, { id: "igra", stage: 1, t: "IGRA (QuantiFERON) or TST", why: "Negative does not rule out active TB" },
    { id: "cxr", stage: 1, t: "Chest X-ray" }, { id: "ct", stage: 1, t: "CT chest, abdomen and pelvis with contrast", why: "Now part of the first look in most approaches" },
    { id: "echo", stage: 2, t: "Echocardiogram (TTE; TEE if prosthetic valve, device, positive cultures or high suspicion)", when: (x) => x.posBC || x.murmur || x.valve || x.emboli || x.ivdu || x.device, why: "Murmur, valve, device, emboli or positive culture" },
    { id: "cmvebv", stage: 2, t: "CMV and EBV serology (PCR if immunosuppressed)", when: (x) => x.transaminitis || x.lymphadenopathy || x.soreThroat || x.immuno || x.splenomegaly || x.cytopenias, why: "Liver tests, nodes, sore throat or immunosuppression" },
    { id: "syph", stage: 2, t: "Syphilis serology", when: (x) => x.sexualRisk || x.rash, why: "Sexual risk or rash" },
    { id: "anca", stage: 2, t: "ANCA (PR3, MPO)", when: (x) => x.vascSigns || x.hematuria || x.eos, why: "Kidney, sinus, nerve or skin signs" },
    { id: "comp", stage: 2, t: "C3, C4, anti-dsDNA", when: (x) => x.posANA || x.hematuria, why: "ANA positive or active urine" },
    { id: "malaria", stage: 2, t: "Malaria smears/RDT ×3, typhoid blood cultures, dengue", when: (x) => x.travel, why: "Travel in the past year" },
    { id: "zoon", stage: 2, t: "Q fever, Brucella, Bartonella serology", when: (x) => x.animals || x.catScratch || (x.posBCneg && (x.valve || x.murmur)), why: "Animal exposure or culture-negative endocarditis" },
    { id: "fungal", stage: 2, t: "Histoplasma urine antigen, cryptococcal antigen, beta-D-glucan", when: (x) => x.immuno || x.hiv, why: "Immunosuppression or HIV" },
    { id: "afb", stage: 2, t: "Sputum/urine AFB smear, culture and NAAT", when: (x) => x.tbRisk || x.posIGRA, why: "TB risk or positive IGRA" },
    { id: "hlhlabs", stage: 2, t: "Triglycerides and fibrinogen (for the HScore)", when: (x) => x.ferritin3k || x.ferritin10k || x.cytopenias || x.splenomegaly, why: "High ferritin, cytopenias or big spleen" },
    { id: "flc", stage: 2, t: "Serum free light chains", when: (x) => x.age50 && (x.anemia || x.hypercal || x.cytopenias), why: "Older with anemia, calcium or cytopenias" },
    { id: "cortisol", stage: 2, t: "AM cortisol", when: (x) => x.adrenal || x.steroidStop, why: "Low Na/high K or steroids stopped" },
    { id: "doppler", stage: 2, t: "Leg Doppler ultrasound", when: (x) => x.legSwelling || x.immobile || x.recentSurgery, why: "Swelling, immobility or recent surgery" },
    { id: "tus", stage: 2, t: "Temporal artery ultrasound", when: (x) => x.age50 && (x.headache || x.jawClaud || x.visual || x.girdlePain || x.esr50 || x.esr100), why: "50 or older with GCA symptoms or high ESR" },
    { id: "calpro", stage: 2, t: "Fecal calprotectin / colonoscopy", when: (x) => x.diarrhea || (x.anemia && x.weightLoss), why: "Diarrhea, or anemia with weight loss" },
    { id: "mri", stage: 2, t: "MRI spine", when: (x) => x.backPain, why: "Back pain" },
    { id: "pet", stage: 3, t: "FDG PET-CT", why: "Best next test when stage 1-2 give no clue: helpful in about half to two-thirds of FUO; shows where to biopsy. Most useful when ESR/CRP are raised and before steroids" },
    { id: "nodebx", stage: 3, t: "Excisional lymph node biopsy (histology, flow, AFB and fungal culture)", when: (x) => x.lymphadenopathy || x.ldh, why: "Nodes or high LDH" },
    { id: "bmbx", stage: 3, t: "Bone marrow biopsy with cultures (AFB, fungal)", when: (x) => x.cytopenias || x.ferritin10k || x.hyperTG || x.lowFib || (x.immuno && x.tbRisk), why: "Cytopenias, possible HLH, or miliary TB in an immunosuppressed patient" },
    { id: "tab", stage: 3, t: "Temporal artery biopsy", when: (x) => x.age50 && (x.esr50 || x.esr100 || x.headache || x.jawClaud || x.visual || x.girdlePain), why: "50 or older with high ESR or GCA symptoms" },
    { id: "liverbx", stage: 3, t: "Liver biopsy (granulomas, lymphoma)", when: (x) => x.alp, why: "Raised ALP with no answer on imaging" },
    { id: "sil2r", stage: 3, t: "Soluble IL-2 receptor (sCD25)", when: (x) => x.ferritin3k || x.ferritin10k || x.cytopenias, why: "Possible HLH" }];
  function workup(have, x) {
    return WORKUP.map((w) => {
      const indicated = w.stage === 1 || w.id === "pet" || (w.when ? !!w.when(x) : true);
      const h = have[w.id] || {};
      return { ...w, indicated, status: h.status || null, text: h.text || "", rt: h.t || null };
    });
  }

  /* ---------- empiric treatment and escalation ---------- */
  // o: { type kind, unstable, anc, immuno, hiv, gcaVision, gcaSuspect, ieSuspect, emboli, miliarySuspect, hlh (hscore positive), ferritin10k, onAbx, abxBeforeCultures, onSteroid, nodesPlanned, malariaRisk, drugFit }
  function treatment(o) {
    const now = [], avoid = [], why = [];
    if (o.anc != null && o.anc < 0.5) now.push("Febrile neutropenia: cultures, then piperacillin-tazobactam (or cefepime) within 60 minutes; add vancomycin only for line infection, skin, MRSA, pneumonia or instability. Use the Oncology tab's MASCC score.");
    if (o.unstable) now.push("Unstable (sepsis or shock): cultures, then broad empiric antibiotics now. Do not wait for the FUO workup.");
    if (o.gcaVision) now.push("Suspected GCA with visual symptoms: methylprednisolone 500-1000 mg IV daily for 3 days, then prednisone 1 mg/kg (max 60-80 mg). Same-day ophthalmology. Biopsy or ultrasound within 1-2 weeks (still positive on steroids).");
    else if (o.gcaSuspect) now.push("Suspected GCA without visual loss: prednisone 40-60 mg daily now; temporal artery ultrasound/biopsy within 1-2 weeks; rheumatology.");
    if (o.hlh || o.ferritin10k) now.push("Possible HLH: call hematology today. Dexamethasone/etoposide decisions belong to hematology; find and treat the trigger.");
    if (o.malariaRisk) now.push("Travel to a malaria area: malaria smears/RDT today; if positive, treat the same day.");
    if (o.ieSuspect) now.push("Endocarditis suspected: 3 sets of cultures from separate sites before antibiotics. If stable, wait for cultures; if emboli, heart failure or unstable, start empiric therapy after cultures (vancomycin + ceftriaxone, adjusted with ID; prosthetic valve: add gentamicin/rifampin per ID).");
    if (o.miliarySuspect) now.push("Miliary TB or TB meningitis suspected: start 4-drug TB therapy after samples (sputum, urine, marrow/liver if possible); do not wait for cultures if sick. Airborne isolation; ID/TB clinic.");
    if (o.immuno && !(o.anc != null && o.anc < 0.5)) why.push("Immunosuppressed (transplant, chemo, biologics, high-dose steroids): lower threshold for empiric antibiotics and early ID input.");
    if (o.drugFit) now.push("A drug fits drug fever: stop or switch it if you can and watch the fever over 48-72 h (this is both test and treatment).");
    avoid.push("Stable classic FUO: do NOT start empiric antibiotics. They can make cultures falsely negative and hide endocarditis, osteomyelitis and abscess, and rarely cure the cause.");
    avoid.push("Do NOT start empiric steroids unless GCA, HLH or another clear indication: they mask lymphoma (and spoil the biopsy), TB and infection, and make PET-CT less useful.");
    avoid.push("Therapeutic trials (naproxen 'test', empiric TB drugs, colchicine) are not recommended except in specific settings with ID/rheumatology.");
    if (o.onAbx && o.stable) why.push("Already on antibiotics and stable with no clear infection: consider stopping them (antibiotic holiday 48-72 h) and re-culturing.");
    if (o.abxBeforeCultures) why.push("Antibiotics were started before the first blood culture: a negative culture is less reliable (culture-negative endocarditis risk).");
    if (o.onSteroid) why.push("On steroids: fever and inflammation may be blunted; get tissue before more steroids if lymphoma is possible.");
    if (o.undiagnosedStable) why.push("If everything incl. PET-CT is unrevealing and the patient is well: watchful waiting is reasonable. Most undiagnosed FUO resolves on its own with a good outlook. Use NSAIDs or acetaminophen for comfort; re-examine and repeat targeted tests if new clues appear.");
    return { now, avoid, why };
  }

  // who to involve
  function consults(x, ddx) {
    const L = [];
    const top = (ddx || []).slice(0, 5).map((d) => d.id);
    if (x.neutropenia || x.ferritin10k || x.hlhPos || x.cytopenias || top.includes("lymphoma") || top.includes("leuk")) L.push({ who: "Hematology", when: x.hlhPos || x.ferritin10k ? "today" : "soon", why: "HLH, cytopenias, high LDH or suspected lymphoma/leukemia" });
    if (x.posBC || x.classicMeets || x.travel || x.immuno || x.hiv || x.posIGRA || top.includes("ie") || top.includes("tb")) L.push({ who: "Infectious diseases", when: x.posBC ? "today" : "soon", why: "Classic FUO after stage 1, positive cultures, TB, travel, HIV or immunosuppression" });
    if (top.some((t) => ["aosd", "gca", "vasc", "sle", "autoinfl", "crystal"].includes(t)) || x.posANA) L.push({ who: "Rheumatology", when: x.visual ? "today" : "soon", why: "Still's, GCA/PMR, vasculitis, CTD or autoinflammatory disease" });
    if (x.visual) L.push({ who: "Ophthalmology", when: "today", why: "Visual symptoms with possible GCA" });
    if (x.posBC || x.murmur || x.valve || x.emboli) L.push({ who: "Cardiology / echo lab", when: "soon", why: "TTE/TEE for endocarditis" });
    if (x.lymphadenopathy || x.alp || x.abscessSeen) L.push({ who: "Interventional radiology / surgery", when: "after PET-CT/CT", why: "Biopsy or drainage of the best target" });
    return L;
  }

  const api = { feverStats, relBrady, fuoType, labClues, drugFever, DRUG_FEVER, DDX, differential, hscore, yamaguchi, gca2022, WORKUP, workup, treatment, consults, DAY, HR };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else window.FUORules = api;
})();
