/* Asplenia / hyposplenia: pure decision rules. No chart access here, so it can be tested with node.
   UNVERIFIED DRAFT written by Claude from: Canadian Immunization Guide (immunocompromised persons; meningococcal and pneumococcal
   chapters, 2024-2025 updates); NACI 2024 statement on pneumococcal vaccines in adults incl. Pneu-C-21; BCCDC Immunization Manual
   Part 4 (PCV20: asplenia is indication C, one dose, no booster); ACIP 2020 meningococcal recommendations (MenB boosters);
   British Society for Haematology 2011 guideline (Davies et al.) on prevention of infection in asplenia; CPS 2019 (reaffirmed 2024)
   asplenia statement; IDSA/ATS 2019 CAP guideline; IDSA bacterial meningitis guideline; Rubin & Schaffner NEJM 2014 "Care of the
   asplenic patient". Check with infectious diseases, pharmacy and public health before real use. */
(function () {
  const DAY = 864e5, WEEK = 7 * DAY, YEAR = 365.25 * DAY;
  const fmtD = (t) => (t == null ? "" : new Date(t).toISOString().slice(0, 10));

  /* ---------- spleen status ---------- */
  // Words in problem list / procedures / reports. "possible" = conditions that can cause hyposplenism but need a smear (Howell-Jolly bodies) to confirm.
  const ANATOMIC = /splenectomy|asplenia|absent spleen|absence of (the )?spleen|post.?splenectomy|Z90\.81|Z90\.88.*spleen|Q89\.01|congenital asplenia|heterotaxy/i;
  const FUNCTIONAL = [
    ["Sickle cell disease", /sickle cell (disease|anemia|anaemia)|hb ?ss\b|hb ?sc\b|sickle.?beta|D57\.[0-2]|D57\.8/i],
    ["Hyposplenism documented", /hyposplen|functional asplenia|D73\.0/i],
    ["Splenic irradiation", /splenic (irradiation|radiation)|radiation to (the )?spleen/i],
    ["Splenic infarction (extensive)", /splenic infarct/i],
    ["Splenic artery embolization", /splenic (artery )?emboli[sz]ation/i],
    ["Chronic graft-versus-host disease", /graft.?versus.?host|gvhd/i],
    ["Partial splenectomy", /partial splenectomy|hemisplenectomy/i]];
  const POSSIBLE = [
    ["Celiac disease", /celiac|coeliac|K90\.0/i], ["Inflammatory bowel disease", /ulcerative colitis|crohn|K5[01]\b/i],
    ["Cirrhosis / alcohol-related liver disease", /cirrho|alcoholic liver|K70\.3|K74/i], ["Systemic lupus", /lupus|\bSLE\b|M32/i],
    ["Amyloidosis", /amyloid/i], ["Allogeneic stem cell transplant", /stem cell transplant|bone marrow transplant|\bhsct\b|allo.?sct/i],
    ["Thalassemia major", /thalass[ae]mia major|beta thalass/i], ["Splenic vein thrombosis / portal hypertension", /splenic vein thromb/i],
    ["Sarcoidosis (splenic)", /sarcoid/i], ["Hereditary spherocytosis", /spherocytosis/i]];
  const SICKLE_TRAIT = /sickle cell trait|D57\.3/i;

  // o: { texts: [problem / procedure / report text], smear: "hj"|"none"|"", manual: ""|"anatomic"|"functional"|"possible"|"none", splenectomyT, plannedT }
  function spleenStatus(o) {
    const texts = (o.texts || []).filter(Boolean), why = [], causes = [];
    let status = "unknown";
    const anat = texts.filter((t) => ANATOMIC.test(t) && !/partial splenectomy|hemisplenectomy/i.test(t));
    if (anat.length || o.splenectomyT) { status = "anatomic"; why.push(anat[0] || "splenectomy date entered"); }
    FUNCTIONAL.forEach(([name, re]) => { const hit = texts.find((t) => re.test(t) && !SICKLE_TRAIT.test(t)); if (hit) { causes.push(name); if (status === "unknown") status = "functional"; why.push(hit); } });
    if (o.smear === "hj") { why.push("Howell-Jolly bodies on the smear"); if (status !== "anatomic") { if (status === "unknown") status = "functional"; causes.push("Howell-Jolly bodies (proves hyposplenism)"); } }
    const poss = [];
    POSSIBLE.forEach(([name, re]) => { const hit = texts.find((t) => re.test(t)); if (hit) poss.push(name); });
    if (status === "unknown" && poss.length) status = "possible";
    if (status === "unknown" && texts.length) status = "none";
    if (o.manual) { status = o.manual; why.unshift("set by you"); }
    if (o.plannedT && status !== "anatomic") { why.push("splenectomy planned " + fmtD(o.plannedT)); if (status === "none" || status === "unknown" || status === "possible") status = "planned"; }
    const label = { anatomic: "Anatomic asplenia (no spleen)", functional: "Functional asplenia / hyposplenia", possible: "Possible hyposplenia: check a blood smear", planned: "Splenectomy planned", none: "No asplenia found in the chart", unknown: "Spleen status unknown" }[status];
    const atRisk = status === "anatomic" || status === "functional" || status === "planned";
    return { status, label, atRisk, why, causes, possible: poss };
  }

  /* ---------- vaccine record ---------- */
  const VAX = [
    ["pcv21", /pcv.?21|capvaxive|pneu.?c.?21|21.valent/i], ["pcv20", /pcv.?20|prevnar.?20|pneu.?c.?20|20.valent/i],
    ["pcvOld", /pcv.?1[035]|prevnar.?1[03]|prevnar(?!.?2)|vaxneuvance|synflorix|pneu.?c.?1[035]|1[035].valent|pneumococcal conjugate/i],
    ["ppv23", /ppv.?23|ppsv|pneumovax|pneu.?p.?23|23.valent|pneumococcal polysaccharide/i],
    ["menabcwy", /penbraya|penmenvy|men.?abcwy|pentavalent mening/i],
    ["menacwy", /menactra|menveo|menquadfi|nimenrix|men.?c.?acyw|men.?acwy|mcv4|quadrivalent mening|mening\w* (conj\w* )?acyw|acyw|acwy/i],
    ["menc", /menjugate|neisvac|men.?c.?c\b|meningococcal (group |serogroup )?c\b|men.?c conj/i],
    ["menb4c", /bexsero|4cmenb|men.?b.?4c|multicomponent mening/i], ["menbfhbp", /trumenba|men.?b.?fhbp|rlp2086|bivalent.*men.?b/i],
    ["menbAny", /men.?b\b|meningococcal (group |serogroup )?b\b/i],
    ["hib", /\bhib\b|haemophilus|hemophilus|act.?hib|pentacel|pediacel|infanrix.?hexa|hexaxim|pentavalent dtap/i],
    ["flu", /influenza|\bflu\b|fluzone|fluad|flucelvax|flulaval|fluviral|afluria|influvac|vaxigrip|agriflu|supemtek|flumist/i],
    ["covid", /covid|sars.?cov|comirnaty|spikevax|nuvaxovid|novavax|mnexspike/i]];
  function classify(name) { const n = String(name || ""); const hit = VAX.find(([, re]) => re.test(n)); return hit ? hit[0] : null; }

  // Read a pasted immunization record (CareConnect / ImmsBC / clinic letter): one vaccine per line with a date.
  const MON = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
  function parseDate(s) {
    let m = s.match(/\b(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})\b/); if (m) return Date.UTC(+m[1], +m[2] - 1, +m[3]);
    m = s.match(/\b(\d{1,2})[-\s\/]?([A-Za-z]{3})[a-z]*[-\s\/,]*(\d{4})\b/); if (m && MON[m[2].toLowerCase()] != null) return Date.UTC(+m[3], MON[m[2].toLowerCase()], +m[1]);
    m = s.match(/\b([A-Za-z]{3})[a-z]*\.?\s+(\d{1,2}),?\s+(\d{4})\b/); if (m && MON[m[1].toLowerCase()] != null) return Date.UTC(+m[3], MON[m[1].toLowerCase()], +m[2]);
    m = s.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/); if (m) return Date.UTC(+m[3], +m[2] - 1, +m[1]); // dd/mm/yyyy (Canadian)
    m = s.match(/\b([A-Za-z]{3})[a-z]*\.?\s+(\d{4})\b/); if (m && MON[m[1].toLowerCase()] != null) return Date.UTC(+m[2], MON[m[1].toLowerCase()], 15);
    m = s.match(/\b(19|20)\d{2}\b/); if (m) return Date.UTC(+m[0], 6, 1);
    return null;
  }
  function parseImmText(text) {
    const out = [];
    String(text || "").split(/\n|;/).forEach((line) => {
      const l = line.trim(); if (!l) return;
      const k = classify(l); if (!k) return;
      const t = parseDate(l);
      out.push({ name: l.replace(/\s+/g, " ").slice(0, 80), t, k, pasted: true, noDate: t == null });
    });
    return out;
  }

  // imms: [{ name, t, k? }]. ctx: { now, splenectomyT, plannedT, immunoRecent (anti-CD20 / chemo text), age }
  function vaccinePlan(imms, ctx) {
    ctx = ctx || {}; const now = ctx.now || Date.now();
    const list = (imms || []).map((x) => ({ ...x, k: x.k || classify(x.name) })).filter((x) => x.k).sort((a, b) => (a.t || 0) - (b.t || 0));
    const of = (...ks) => list.filter((x) => ks.includes(x.k));
    const last = (a) => (a.length ? a[a.length - 1] : null);
    const out = [];
    const item = (id, name, status, text, next, given, extra) => out.push(Object.assign({ id, name, status, text, next: next || null, given: given || [] }, extra || {}));

    // Pneumococcal: one dose of PCV20 (or PCV21); no booster. PPV23 earlier: PCV20 one year later (8 weeks may be considered).
    const pcvNew = of("pcv20", "pcv21"), ppv = of("ppv23"), pcvOld = of("pcvOld");
    if (pcvNew.length) item("pneumo", "Pneumococcal", "done", `${pcvNew[0].k === "pcv21" ? "PCV21" : "PCV20"} given ${fmtD(last(pcvNew).t) || "(date not recorded)"}. No booster is recommended at this time (BC / NACI). No PPV23 needed.`, null, pcvNew);
    else {
      const lp = last(ppv), lo = last(pcvOld);
      let next = now, why = [];
      if (lp && lp.t && now - lp.t < YEAR) { next = lp.t + YEAR; why.push(`PPV23 given ${fmtD(lp.t)}: give PCV20 one year after it (an 8-week gap can be considered if immunosuppression is coming)`); }
      if (lo && lo.t && now - lo.t < 8 * WEEK) { next = Math.max(next, lo.t + 8 * WEEK); why.push(`older conjugate vaccine given ${fmtD(lo.t)}: wait at least 8 weeks`); }
      item("pneumo", "Pneumococcal", next > now + DAY ? "later" : "due",
        `PCV20 (Prevnar 20) 0.5 mL IM, one dose (PCV21 / Capvaxive is an alternative). Publicly funded in BC for asplenia regardless of PPV23 history. No PPV23 afterwards.${why.length ? " " + why.join("; ") + "." : ""}${pcvOld.length || ppv.length ? " Prior: " + pcvOld.concat(ppv).map((x) => x.name + (x.t ? " " + fmtD(x.t) : "")).join(", ") + "." : ""}`, next, pcvOld.concat(ppv));
    }

    // Meningococcal ACWY conjugate: 2 doses at least 8 weeks apart, then a booster every 5 years (first dose at age 7 or older).
    const acwy = of("menacwy", "menabcwy"), menc = of("menc");
    const mencNote = menc.length ? ` Men-C only (${menc.map((x) => x.name).join(", ")}) does not count: it covers serogroup C only.` : "";
    if (!acwy.length) item("acwy", "Meningococcal ACWY", "due", `Quadrivalent conjugate (Menveo, MenQuadfi or Nimenrix): dose 1 now, dose 2 at least 8 weeks later, then a booster every 5 years for life.${mencNote}`, now, [], { series: "0 of 2" });
    else if (acwy.length === 1) {
      const l = last(acwy), next = l.t ? l.t + 8 * WEEK : now;
      item("acwy", "Meningococcal ACWY", next > now + DAY ? "later" : "due", `One dose recorded (${fmtD(l.t) || "date unknown"}). Asplenia needs a 2-dose primary series: dose 2 at least 8 weeks after dose 1${next > now ? " (from " + fmtD(next) + ")" : " (due now)"}, then a booster every 5 years.${mencNote}`, next, acwy, { series: "1 of 2" });
    } else {
      const l = last(acwy), next = l.t ? l.t + 5 * YEAR : null;
      item("acwy", "Meningococcal ACWY", next && next <= now + DAY ? "due" : next ? "done" : "check", next && next <= now + DAY ? `Primary series done; last dose ${fmtD(l.t)}, booster now due (every 5 years).` : next ? `Primary series done. Next booster ${fmtD(next)} (every 5 years).` : "Primary series recorded but no date: check when the last dose was (booster every 5 years).", next, acwy, { series: "2 of 2" });
    }

    // Meningococcal B: Bexsero 2 doses at least 4 weeks apart, or Trumenba 3 doses at 0, 1-2 and 6 months. Brands are not interchangeable.
    const b4 = of("menb4c").concat(of("menabcwy").filter((x) => /penmenvy/i.test(x.name))), bf = of("menbfhbp").concat(of("menabcwy").filter((x) => !/penmenvy/i.test(x.name))), bAny = of("menbAny");
    const boostNote = "Booster: NACI / BC have not set booster timing yet; the US (ACIP) gives a booster 1 year after the series and then every 2-3 years while at risk. Ask ID or public health.";
    if (b4.length && bf.length) item("menb", "Meningococcal B", "check", `Both MenB brands recorded (${b4.concat(bf).map((x) => x.name).join(", ")}): they are not interchangeable. Ask public health or ID how to finish the series.`, null, b4.concat(bf));
    else if (b4.length >= 2) item("menb", "Meningococcal B", "done", `Bexsero series done (${b4.map((x) => fmtD(x.t)).join(", ")}). ${boostNote}`, last(b4).t ? last(b4).t + YEAR : null, b4, { series: "2 of 2", boosterUS: true });
    else if (b4.length === 1) { const n = b4[0].t ? b4[0].t + 4 * WEEK : now; item("menb", "Meningococcal B", n > now + DAY ? "later" : "due", `Bexsero dose 1 given ${fmtD(b4[0].t) || "(date unknown)"}: dose 2 at least 4 weeks later. Same brand.`, n, b4, { series: "1 of 2" }); }
    else if (bf.length >= 3) item("menb", "Meningococcal B", "done", `Trumenba series done. ${boostNote}`, last(bf).t ? last(bf).t + YEAR : null, bf, { series: "3 of 3", boosterUS: true });
    else if (bf.length) {
      const l = last(bf), n = bf.length === 1 ? (l.t ? l.t + 4 * WEEK : now) : (bf[0].t ? bf[0].t + 26 * WEEK : now);
      item("menb", "Meningococcal B", n > now + DAY ? "later" : "due", `Trumenba ${bf.length} of 3 doses (high-risk schedule 0, 1-2 and 6 months). Next dose ${bf.length === 1 ? "1-2 months after dose 1" : "6 months after dose 1"}. Same brand.`, n, bf, { series: bf.length + " of 3" });
    } else if (bAny.length) item("menb", "Meningococcal B", "check", `MenB recorded (${bAny.map((x) => x.name).join(", ")}) but the brand is not clear: Bexsero needs 2 doses, Trumenba 3. Check the record.`, null, bAny);
    else item("menb", "Meningococcal B", "due", "Bexsero (4CMenB) 0.5 mL IM: 2 doses at least 4 weeks apart (or Trumenba: 3 doses at 0, 1-2 and 6 months). Finish with the same brand. Funded in BC for asplenia (check the BC Immunization Manual).", now, [], { series: "0 of 2" });

    // Hib: one dose if not given before (childhood series counts).
    const hib = of("hib");
    if (hib.length) item("hib", "Haemophilus influenzae type b (Hib)", "done", `Hib recorded (${hib.map((x) => fmtD(x.t) || x.name).join(", ")}). No further adult dose needed.`, null, hib);
    else item("hib", "Haemophilus influenzae type b (Hib)", "due", "One dose of Hib conjugate (Act-HIB) 0.5 mL IM if never given (or the childhood record cannot be found). No booster.", now, []);

    // Influenza: every season (season starts September 1).
    const d = new Date(now), seasonStart = Date.UTC(d.getUTCMonth() >= 8 ? d.getUTCFullYear() : d.getUTCFullYear() - 1, 8, 1);
    const flu = of("flu").filter((x) => x.t && x.t >= seasonStart);
    if (flu.length) item("flu", "Influenza", "done", `Given this season (${fmtD(last(flu).t)}). Every fall. Household contacts should be vaccinated too.`, null, flu);
    else { const inSeason = d.getUTCMonth() >= 8 || d.getUTCMonth() <= 3; item("flu", "Influenza", inSeason ? "due" : "later", `Inactivated influenza vaccine every fall${inSeason ? ": not recorded this season, give before discharge" : " (next season from September)"}. Influenza raises the risk of secondary pneumococcal and S. aureus pneumonia. Vaccinate household contacts.`, inSeason ? now : seasonStart + YEAR, of("flu")); }

    // COVID-19: follow the current provincial schedule (asplenia alone is not an immunocompromising condition for COVID vaccine).
    const cov = of("covid");
    item("covid", "COVID-19", "check", `${cov.length ? "Last dose " + (fmtD(last(cov).t) || "(date unknown)") + ". " : "None recorded. "}Follow the current BC schedule for the patient's age and other conditions.`, null, cov);

    // Timing around splenectomy and immunosuppression
    const timing = [];
    const sT = ctx.splenectomyT, pT = ctx.plannedT;
    if (pT && pT > now) {
      const daysTo = Math.round((pT - now) / DAY);
      timing.push(daysTo >= 14 ? { lvl: "action", t: `Splenectomy planned in ${daysTo} days: give all due vaccines now (at least 2 weeks before surgery for the best response).` }
        : { lvl: "action", t: `Splenectomy planned in ${daysTo} days (under 2 weeks): give the vaccines now anyway if surgery cannot wait, or 2 weeks after surgery. Do not delay surgery for vaccines.` });
    }
    if (sT) {
      const daysSince = Math.floor((now - sT) / DAY);
      if (daysSince < 14) timing.push({ lvl: "action", t: `Splenectomy ${daysSince} days ago: give vaccines from ${fmtD(sT + 14 * DAY)} (14 days after surgery). If the patient goes home before then and follow-up is uncertain, give them before discharge rather than miss them.` });
      else timing.push({ lvl: "info", t: `Splenectomy ${daysSince} days ago: past the 14-day point, so give anything due now.` });
    }
    if (ctx.immunoRecent && ctx.immunoRecent.length) timing.push({ lvl: "action", t: `Recent ${ctx.immunoRecent.join(", ")}: vaccine response is reduced. Ideally vaccinate 2 weeks before, or 3 months after chemotherapy (6 months after rituximab / anti-CD20). If the window cannot be met, vaccinate now and repeat the doses later.` });
    timing.push({ lvl: "info", t: "Asplenia alone does not stop live vaccines (MMR, varicella, yellow fever): check for other immunosuppression first. Several vaccines can be given at the same visit in different arms. Avoid giving MenACWY-D (Menactra) within 4 weeks after PCV (not an issue with Menveo, MenQuadfi or Nimenrix)." });

    const due = out.filter((x) => x.status === "due"), later = out.filter((x) => x.status === "later");
    return { items: out, due, later, timing, records: list };
  }

  /* ---------- daily prophylaxis and standby antibiotics ---------- */
  // o: { yearsSince, age, priorOPSI, immuno, heme, gvhd, sickle, onProph, allergy: "none"|"low"|"immediate"|"scar", poorResponse }
  function prophylaxis(o) {
    const reasons = [];
    if (o.priorOPSI) reasons.push("previous overwhelming / invasive pneumococcal infection (lifelong)");
    if (o.yearsSince != null && o.yearsSince < 2) reasons.push(`within 2 years of splenectomy (${o.yearsSince < 1 ? Math.max(0, Math.round(o.yearsSince * 12)) + " months" : o.yearsSince.toFixed(1) + " years"})`);
    if (o.heme) reasons.push("hematologic cancer or ongoing chemotherapy");
    if (o.gvhd) reasons.push("chronic GVHD / allogeneic transplant");
    if (o.immuno) reasons.push("other immunosuppression");
    if (o.poorResponse) reasons.push("poor or uncertain vaccine response");
    if (o.age != null && o.age < 16) reasons.push("age under 16");
    if (o.sickle && o.age != null && o.age < 5) reasons.push("sickle cell disease in a young child");
    const daily = reasons.length > 0;
    const a = o.allergy || "none";
    const dailyRx = a === "none" || a === "low"
      ? [a === "low" ? "Low-risk penicillin allergy label: assess and de-label (direct oral amoxicillin challenge) rather than avoid penicillin." : "", "Penicillin V 300 mg PO BID (usual range 250-500 mg BID)", "or amoxicillin 250-500 mg PO once daily"]
      : a === "immediate" ? ["Penicillin anaphylaxis or hives: clarithromycin 250 mg PO BID (pneumococcal macrolide resistance limits it: discuss with ID), or refer for penicillin allergy testing"]
      : ["Severe delayed reaction (SJS/TEN/DRESS) to a beta-lactam: avoid all beta-lactams; discuss options with ID (macrolide or doxycycline with resistance caveats)"];
    const standby = a === "none" || a === "low"
      ? ["Amoxicillin-clavulanate 875/125 mg PO BID", "(or cefuroxime 500 mg PO BID)"]
      : a === "immediate" ? ["Levofloxacin 750 mg PO once daily (or moxifloxacin 400 mg PO once daily)", "cefuroxime 500 mg PO BID is often still tolerated: decide with allergy / ID"]
      : ["Levofloxacin 750 mg PO once daily (or moxifloxacin 400 mg PO once daily)"];
    return {
      daily, reasons, dailyRx: dailyRx.filter(Boolean), standby,
      label: daily ? (o.onProph ? "Daily prophylaxis: on it, keep going" : "Daily prophylaxis recommended") : o.onProph ? "On daily prophylaxis (optional now)" : "Standby antibiotic only (daily optional)",
      text: daily
        ? `Daily antibiotic prophylaxis is recommended: ${reasons.join("; ")}. Duration: at least 1-2 years after splenectomy (lifelong after an invasive infection or with ongoing immunosuppression; many give it lifelong). Adherence falls off: re-check at every visit.`
        : "No strong reason for daily prophylaxis found (more than 2 years after splenectomy, no prior invasive infection, not immunosuppressed). Offer it anyway (some patients prefer lifelong daily penicillin) and make sure there is a standby antibiotic.",
      standbyText: "Everyone without a spleen should have a standby (\"pill in the pocket\") antibiotic at home: take the first dose at the first sign of fever, chills or feeling unwell, then go to the ER the same day. It does not replace being seen." };
  }

  /* ---------- CURB-65 ---------- */
  // o: { confusion, urea (mmol/L), rr, sbp, dbp, age }
  function curb65(o) {
    const parts = [["Confusion", !!o.confusion], ["Urea over 7 mmol/L", o.urea != null && o.urea > 7], ["RR 30 or more", o.rr != null && o.rr >= 30],
      ["SBP under 90 or DBP 60 or less", (o.sbp != null && o.sbp < 90) || (o.dbp != null && o.dbp <= 60)], ["Age 65 or older", o.age != null && o.age >= 65]];
    const score = parts.filter((p) => p[1]).length;
    const missing = [o.urea == null ? "urea" : "", o.rr == null ? "RR" : "", o.sbp == null ? "BP" : "", o.age == null ? "age" : ""].filter(Boolean);
    return { score, parts, missing, text: `CURB-65 ${score}${missing.length ? " (missing " + missing.join(", ") + ")" : ""}. In asplenia a low score does not mean safe for home: admit with IV antibiotics if febrile or unwell.` };
  }

  /* ---------- pneumonia antibiotics ---------- */
  // o: { setting: "ward"|"icu", shock, meningitis, allergy: "none"|"low"|"immediate"|"scar", crcl, weight, mrsa, pseudo, flu, fluSeason, age, immuno, purpura, aspiration, dog }
  function renal(drug, crcl) {
    if (crcl == null) return "";
    if (drug === "levo") return crcl < 20 ? "CrCl under 20: 750 mg once, then 500 mg every 48 h" : crcl < 50 ? "CrCl 20-49: 750 mg every 48 h" : "";
    if (drug === "pip") return crcl < 20 ? "CrCl under 20: 2.25 g IV q6h" : crcl <= 40 ? "CrCl 20-40: 3.375 g IV q6h" : "";
    if (drug === "cefepime") return crcl < 11 ? "CrCl under 11: 1 g IV q24h" : crcl < 30 ? "CrCl 11-29: 2 g IV q24h" : crcl <= 60 ? "CrCl 30-60: 2 g IV q12h" : "";
    if (drug === "osel") return crcl < 10 ? "CrCl under 10 / dialysis: ask pharmacy" : crcl <= 30 ? "CrCl 10-30: 30 mg once daily" : crcl <= 60 ? "CrCl 31-60: 30 mg BID" : "";
    if (drug === "amp") return crcl < 10 ? "CrCl under 10: 2 g IV q12h" : crcl < 30 ? "CrCl 10-29: 2 g IV q8h" : "";
    if (drug === "amox") return crcl < 30 ? "CrCl under 30: amoxicillin 500 mg-1 g q12h; avoid amoxicillin-clavulanate 875 mg" : "";
    return "";
  }
  function pneumoniaAbx(o) {
    const a = o.allergy || "none", severe = o.setting === "icu" || o.shock, men = !!o.meningitis;
    const reg = [], add = [], notes = [], step = [];
    const vanc = (why) => ({ drug: "Vancomycin", dose: `${o.weight ? Math.round(Math.min(3000, 25 * o.weight) / 250) * 250 + " mg" : "25 mg/kg"} IV load, then by pharmacy (AUC / levels)`, why });
    const azi = { drug: "Azithromycin", dose: "500 mg IV/PO once daily for 3 days", why: "atypical cover (doxycycline 100 mg PO BID if QT long or macrolide not wanted)" };
    let headline;
    if (a === "scar") {
      headline = "No beta-lactams (severe delayed reaction): levofloxacin" + (severe || men ? " + vancomycin" : "");
      reg.push({ drug: "Levofloxacin", dose: "750 mg IV/PO once daily", why: "covers pneumococcus, H. influenzae and atypicals; no macrolide needed", renal: renal("levo", o.crcl) });
      if (severe || men) reg.push(vanc("possible penicillin-resistant pneumococcus while cultures are pending"));
      if (men) add.push({ drug: "Meningitis without beta-lactams", dose: "vancomycin + moxifloxacin 400 mg IV daily; TMP-SMX 5 mg/kg (TMP) IV q6-8h if Listeria risk", why: "call ID now" });
      notes.push("Call ID: a beta-lactam is the best drug for pneumococcus and meningococcus, and an allergy specialist may find a safe one.");
    } else {
      const ctxDose = men ? "2 g IV q12h (meningitis dose)" : "2 g IV q24h";
      const allergyWhy = a === "immediate" ? "penicillin anaphylaxis/hives: ceftriaxone has a different side chain and is usually tolerated (cross-reaction about 1%). Give the first dose monitored, or as a graded dose per local policy. If you must avoid it: levofloxacin 750 mg + vancomycin." : a === "low" ? "low-risk penicillin allergy label: ceftriaxone is fine" : "";
      if (o.pseudo) {
        headline = "Pseudomonas risk: piperacillin-tazobactam (or cefepime) + azithromycin" + (severe || men ? " + vancomycin" : "");
        if (a === "immediate") reg.push({ drug: "Cefepime", dose: "2 g IV q8h", why: "Pseudomonas + pneumococcus; penicillin anaphylaxis so avoid pip-tazo", renal: renal("cefepime", o.crcl) });
        else reg.push({ drug: "Piperacillin-tazobactam", dose: "4.5 g IV q6h (extended infusion if local practice)", why: "covers Pseudomonas and pneumococcus (or cefepime 2 g IV q8h)", renal: renal("pip", o.crcl) });
        if (men) reg.push({ drug: "Ceftriaxone", dose: "2 g IV q12h", why: "pip-tazo does not reach the CSF well: use ceftriaxone + vancomycin for meningitis (cefepime 2 g q8h covers both)" });
      } else {
        headline = "Ceftriaxone 2 g" + (men ? " q12h + vancomycin + dexamethasone" : severe ? " + azithromycin + vancomycin" : " + azithromycin");
        reg.push({ drug: "Ceftriaxone", dose: ctxDose, why: (men ? "meningitis dosing. " : "Use 2 g (top of the range): bacteremic pneumococcus is common and meningitis may not be clear early. ") + allergyWhy });
      }
      if (!men || o.pseudo) reg.push(azi); else reg.push({ drug: "Azithromycin", dose: "500 mg IV daily", why: "add if pneumonia is also present (atypical cover)" });
      if (severe || men) reg.push(vanc(men ? "until pneumococcal susceptibility is known (meningitis)" : "septic shock / possible OPSI: covers penicillin-resistant pneumococcus until cultures and susceptibilities are back; stop at 48-72 h if not needed"));
    }
    if (men) {
      add.push({ drug: "Dexamethasone", dose: "10 mg IV q6h for 4 days, first dose with or just before the first antibiotic", why: "suspected bacterial meningitis (stop if not pneumococcal)" });
      if ((o.age != null && o.age >= 50) || o.immuno) add.push({ drug: "Ampicillin", dose: "2 g IV q4h", why: "Listeria cover (age 50+ or immunosuppressed)", renal: renal("amp", o.crcl) });
      notes.push("Do not delay antibiotics for the LP or CT. Draw blood cultures first if it takes minutes, not hours.");
    }
    if (o.mrsa && !(severe || men)) add.push(vanc("MRSA risk (prior MRSA, necrotizing or post-influenza pneumonia): linezolid 600 mg q12h is the alternative"));
    if (o.flu || o.fluSeason) add.push({ drug: "Oseltamivir", dose: "75 mg PO BID for 5 days", why: o.flu ? "influenza positive" : "influenza season: start now, stop if the swab is negative", renal: renal("osel", o.crcl) });
    if (o.dog) notes.push("Dog / cat bite or exposure: Capnocytophaga canimorsus. Ceftriaxone is active; piperacillin-tazobactam or meropenem if sepsis with a bite wound. Tell the lab (slow-growing).");
    if (o.aspiration) notes.push("Aspiration alone does not need extra anaerobic cover unless there is an abscess or empyema.");
    if (o.purpura) notes.push("Purpura or rapidly spreading rash: think meningococcemia or pneumococcal purpura fulminans. Treat as OPSI (ceftriaxone 2 g IV now + vancomycin), ICU, check INR, fibrinogen, platelets.");

    notes.unshift("Blood cultures x2, then the first dose within 1 hour (sooner if hypotensive). Sputum culture, pneumococcal urine antigen, and a respiratory virus PCR.");
    notes.push("Do not use a macrolide or doxycycline alone, and do not send home on oral therapy while febrile: asplenic patients can go from well to septic shock in hours.");
    notes.push("Not better in 48-72 h: look for empyema (ultrasound), lung abscess, a resistant organism, Babesia / malaria (smear) after tick or travel exposure, or another diagnosis.");

    if (a === "scar") step.push("Oral step-down: levofloxacin 750 mg PO once daily (same dose)" + (renal("levo", o.crcl) ? " (" + renal("levo", o.crcl) + ")" : "") + ".");
    else if (a === "immediate") step.push("Oral step-down: cefuroxime 500 mg PO BID if ceftriaxone was tolerated, or levofloxacin 750 mg PO daily.");
    else step.push("Oral step-down (afebrile 24-48 h, eating, stable): amoxicillin 1 g PO TID, or amoxicillin-clavulanate 875/125 mg PO BID" + (renal("amox", o.crcl) ? " (" + renal("amox", o.crcl) + ")" : "") + "; switch to the culture result if one grows.");
    const duration = "At least 5 days and until afebrile for 48 h with no more than 1 sign of instability. Pneumococcal bacteremia: usually 7-10 days. Empyema, abscess or meningitis: longer (ID). Asplenia alone is not a reason for a longer course.";
    return { headline, reg, add, notes, step, duration, severe };
  }

  /* ---------- OPSI (overwhelming post-splenectomy infection) ---------- */
  // o: { sbp, lactate, plt, inr, temp, hr, purpura, shock, liver (cirrhosis: low platelets / high INR may be baseline) }
  function opsi(o) {
    const s = [];
    if (o.temp != null && o.temp >= 38) s.push("fever " + o.temp + " °C");
    if (o.hr != null && o.hr >= 110) s.push("HR " + o.hr);
    if (o.sbp != null && o.sbp < 90) s.push("SBP " + o.sbp);
    if (o.lactate != null && o.lactate >= 2) s.push("lactate " + o.lactate);
    const lv = o.liver ? " (may be cirrhosis)" : "";
    if (o.plt != null && o.plt < 100) s.push("platelets " + o.plt + lv);
    if (o.inr != null && o.inr >= 1.5) s.push("INR " + o.inr + lv);
    if (o.purpura) s.push("purpura");
    if (o.shock) s.push("septic shock");
    const major = (o.sbp != null && o.sbp < 90) || (o.lactate != null && o.lactate >= 4) || o.purpura || o.shock || (!o.liver && (o.plt != null && o.plt < 100) && (o.inr != null && o.inr >= 1.5));
    const nCount = s.filter((x) => !/may be cirrhosis/.test(x)).length;
    const lvl = major ? "urgent" : nCount >= 2 ? "action" : s.length ? "info" : "none";
    return { lvl, signs: s, text: major ? "Looks like OPSI / septic shock: ceftriaxone 2 g IV + vancomycin NOW, fluids, ICU / outreach, check DIC labs. Mortality is up to 50%, most deaths in the first 24-48 h." : nCount >= 2 ? "Early sepsis in an asplenic patient: antibiotics within 1 hour, lactate, watch closely for shock and DIC." : s.length ? "Watch: one sepsis sign. Asplenic patients deteriorate fast." : "" };
  }

  /* ---------- other precautions (auto-flagged) ---------- */
  // o: { status, sinceDays, plt, onAnticoag, onVteProph, dogExposure, tickTravel, travelPlanned, eculizumab, allergy, onProph }
  function precautions(o) {
    const L = [], add = (id, lvl, t, why) => L.push({ id, lvl, t, why });
    add("flag", "action", "Put \"Asplenia\" (or \"Hyposplenism\") on the problem list and as a chart alert so every ER visit treats fever as an emergency.", "most missed step");
    add("id", "info", "Medical alert bracelet or wallet card stating no spleen / hyposplenism.", "");
    add("standby", "action", "Standby antibiotic prescription at discharge, with written instructions to take the first dose and come to the ER.", o.onProph ? "already on daily prophylaxis: still give a standby course" : "");
    if (o.allergy === "low") add("delabel", "action", "Low-risk penicillin allergy label: de-label (oral amoxicillin challenge) - penicillin is the best prophylaxis drug.", "");
    if (o.sinceDays != null && o.sinceDays < 90) {
      add("vte", o.plt != null && o.plt > 1000 ? "action" : "info", `Recent splenectomy: high risk of portal / splenic / mesenteric vein thrombosis and VTE (more after splenectomy for big spleens, myeloproliferative disease or hemolytic anemia). Keep VTE prophylaxis while in hospital; CT with contrast for new abdominal pain or fever.${o.plt != null && o.plt > 600 ? " Platelets " + o.plt + ": reactive thrombocytosis is expected (peaks at 1-3 weeks); ask hematology about aspirin if very high or other thrombosis risks." : ""}`, "");
      if (!o.onAnticoag && !o.onVteProph) add("vteproph", "action", "No VTE prophylaxis or anticoagulant found: check whether it should be ordered.", "");
    }
    add("bites", o.dogExposure ? "action" : "info", "Dog or cat bite (even small): amoxicillin-clavulanate for 3-5 days and see a doctor the same day (Capnocytophaga canimorsus can cause fulminant sepsis).", o.dogExposure ? "pet / bite exposure ticked" : "");
    add("ticks", o.tickTravel ? "action" : "info", "Tick bites: babesiosis is severe without a spleen (northeastern / upper-midwest US, Europe). Use repellent and check for ticks; fever after a tick bite or travel: thick and thin blood smear.", o.tickTravel ? "tick / travel exposure ticked" : "");
    add("malaria", o.travelPlanned ? "action" : "info", "Malaria is more severe without a spleen: avoid endemic areas if possible; otherwise strict chemoprophylaxis, bite avoidance and a travel clinic visit. Carry the standby antibiotic and the vaccine record.", o.travelPlanned ? "travel planned" : "");
    if (o.eculizumab) add("ecul", "urgent", "On a complement inhibitor (eculizumab / ravulizumab) as well: meningococcal risk is extremely high even after vaccination. Usually needs daily penicillin and MenB boosters; involve hematology / ID.", "");
    add("contacts", "info", "Household contacts: influenza vaccine every year and routine vaccines up to date.", "");
    add("dental", "info", "Dental work and minor procedures: no routine antibiotic prophylaxis needed for asplenia alone.", "");
    add("long", "info", "Long term: more pulmonary hypertension (especially after splenectomy for hemolytic anemia) and arterial disease; keep cardiovascular risk factors treated.", "");
    if (o.status === "functional" || o.status === "possible") add("smear", "info", "Functional hyposplenia: Howell-Jolly bodies or pitted red cells on the smear support it; a normal-size spleen on imaging does not mean it works.", "");
    if (o.status === "anatomic") add("splenosis", "info", "After splenectomy for ITP or hemolysis, no Howell-Jolly bodies on the smear suggests an accessory spleen or splenosis (relapse cause). It does not mean the patient is protected.", "");
    return L;
  }

  const api = { spleenStatus, classify, parseImmText, parseDate, vaccinePlan, prophylaxis, curb65, pneumoniaAbx, opsi, precautions, renal, DAY, WEEK, YEAR, fmtD, FUNCTIONAL, POSSIBLE };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else window.AspleniaRules = api;
})();
