/* Parkinson's disease rules: PD drug recognition, LEDD (Jost 2023), dose timing, drugs to avoid and MAO-B interactions, nil-by-mouth plan,
   symptom management, and motor drug choices tailored to the patient. Pure functions (tests/test_pd.js).
   Sources summarised (read 2026-11-02): Jost et al. Mov Disord 2023 (LEDD); Parkinson's UK emergency management guide (2025); NHS Grampian
   inpatient PD guide (30-minute rule); Canadian Guideline for Parkinson Disease, 2nd ed (CMAJ 2019). UNVERIFIED draft written by Claude. */
(function (root) {
  const H = 36e5, DAY = 864e5;
  const ok = (v) => typeof v === "number" && isFinite(v);

  /* PD drugs. factor: LED per mg per day; fixed: LED regardless of dose; comt: multiplier added to levodopa LED */
  const DRUGS = [
    { id: "ld-stalevo", cls: "levodopa", name: "Levodopa/carbidopa/entacapone (Stalevo)", re: /stalevo|carbidopa[\s\/-]*levodopa[\s\/-]*entacapone|levodopa[\s\/-]*carbidopa[\s\/-]*entacapone/i, factor: 1, comt: 0.33 },
    { id: "entacapone", cls: "comt", name: "Entacapone", re: /entacapone|comtan/i, comt: 0.33 },
    { id: "opicapone", cls: "comt", name: "Opicapone", re: /opicapone|ongentys/i, comt: 0.5 },
    { id: "tolcapone", cls: "comt", name: "Tolcapone", re: /tolcapone|tasmar/i, comt: 0.5 },
    { id: "pramipexole", cls: "agonist", name: "Pramipexole", re: /pramipexole|mirapex/i, factor: 100 },
    { id: "ropinirole", cls: "agonist", name: "Ropinirole", re: /ropinirole|requip/i, factor: 20 },
    { id: "rotigotine", cls: "agonist", name: "Rotigotine patch", re: /rotigotine|neupro/i, factor: 30 },
    { id: "apomorphine", cls: "agonist", name: "Apomorphine (SC)", re: /apomorphine|movapo|kynmobi/i, factor: 10, sublingual: /kynmobi|sublingual/i },
    { id: "rasagiline", cls: "maob", name: "Rasagiline", re: /rasagiline|azilect/i, factor: 100 },
    { id: "selegiline", cls: "maob", name: "Selegiline", re: /selegiline|eldepryl/i, factor: 10 },
    { id: "safinamide", cls: "maob", name: "Safinamide", re: /safinamide|onstryv|xadago/i, fixed: 150 },
    { id: "amantadine", cls: "amantadine", name: "Amantadine", re: /amantadine/i, factor: 1 },
    { id: "trihex", cls: "anticholinergic", name: "Trihexyphenidyl / benztropine", re: /trihexyphenidyl|artane|benztropine|cogentin/i, factor: 0 },
    { id: "ld-cr", cls: "levodopa", name: "Levodopa/carbidopa CR", re: /(sinemet|levodopa|carbidopa|prolopa|benserazide).*(\bcr\b|controlled|extended|\ber\b|sustained|\bhbs\b)|(\bcr\b|controlled release).*(levodopa|sinemet)/i, factor: 0.75, cr: true },
    { id: "ld-lcig", cls: "levodopa", name: "Levodopa/carbidopa intestinal gel (Duodopa)", re: /duodopa|intestinal gel|lcig/i, factor: 1.11, device: true },
    { id: "fosld", cls: "levodopa", name: "Foslevodopa/foscarbidopa SC (Vyalev)", re: /foslevodopa|vyalev/i, factor: 0.75, device: true },
    { id: "ld", cls: "levodopa", name: "Levodopa/carbidopa (or benserazide) IR", re: /levodopa|sinemet|prolopa|benserazide|carbidopa/i, factor: 1 }];
  const drugOf = (name) => DRUGS.find((d) => d.re.test(name)) || null;

  /* levodopa mg in one tablet: "25/100", "100/25", "Sinemet 100-25", "levodopa 100 mg" -> the larger strength */
  function levodopaPerTab(name) {
    const pair = name.match(/(\d{2,3})\s*[\/-]\s*(\d{2,3})/);
    if (pair) return Math.max(+pair[1], +pair[2]);
    const m = name.match(/levodopa\s*(\d{2,3})\s*mg/i) || name.match(/(\d{2,3})\s*mg/i);
    return m ? +m[1] : null;
  }
  /* mg per dose for non-levodopa drugs */
  function mgPerDose(name) { const m = name.match(/(\d+(?:\.\d+)?)\s*(mg|mcg)/i); return m ? (/mcg/i.test(m[2]) ? +m[1] / 1000 : +m[1]) : null; }
  function tabsPerDose(text) { const m = text.match(/(\d+(?:\.\d+)?|one|two|half|1\/2)\s*(tab|tablet|cap|capsule)s?/i); if (!m) return 1; const w = { one: 1, two: 2, half: 0.5, "1/2": 0.5 }; return w[m[1].toLowerCase()] || +m[1]; }
  /* doses per day from the sig */
  function perDay(text) {
    const t = String(text || "");
    const times = t.match(/(?<![\d\/.])([01]\d|2[0-3]):?([0-5]\d)(?![\d\/.])/g); if (times && times.length >= 2) return times.length;
    const n = t.match(/(\d)\s*(times|x)\s*(a |per )?(day|daily)/i); if (n) return +n[1];
    const word = { once: 1, twice: 2 }; const w = t.match(/\b(once|twice)\s*(a |per )?(day|daily)/i); if (w) return word[w[1].toLowerCase()];
    if (/\bq\s*2\s*h/i.test(t)) return 8; if (/\bq\s*3\s*h/i.test(t)) return 6; if (/\bq\s*4\s*h/i.test(t)) return 5; if (/\bq\s*6\s*h/i.test(t)) return 4; if (/\bq\s*8\s*h/i.test(t)) return 3; if (/\bq\s*12\s*h/i.test(t)) return 2;
    if (/\bqid\b|four times/i.test(t)) return 4; if (/\btid\b|three times/i.test(t)) return 3; if (/\bbid\b|twice/i.test(t)) return 2;
    if (/\bqhs\b|\bhs\b|bedtime|\bdaily\b|\bqam\b|once|q24h|every morning|per 24 ?h|\/24 ?h/i.test(t)) return 1;
    return null;
  }
  /* one order -> a LEDD row (editable in the page) */
  function row(name) {
    const d = drugOf(name); if (!d) return null;
    const r = { drug: d, name, n: perDay(name) };
    if (d.cls === "levodopa") { r.mg = levodopaPerTab(name); r.tabs = tabsPerDose(name); r.mgDose = r.mg != null ? r.mg * r.tabs : null; }
    else if (d.cls === "comt") r.mgDose = mgPerDose(name);
    else { r.mgDose = mgPerDose(name); if (d.id === "rotigotine") r.n = 1; }
    return r;
  }
  /* LEDD from rows [{drug, mgDose, n}] */
  function ledd(rows) {
    let ld = 0, ldWithComt = 0, other = 0, comt = 0;
    const parts = rows.map((r) => {
      const d = r.drug, daily = ok(r.mgDose) && ok(r.n) ? r.mgDose * r.n : null;
      let led = null;
      if (d.cls === "levodopa") { led = daily != null ? daily * d.factor : null; if (led != null) { ld += led; if (d.comt) ldWithComt += daily * d.comt; } }
      else if (d.cls === "comt") { comt = Math.max(comt, d.comt); }
      else if (d.fixed) led = d.fixed;
      else if (d.sublingual && d.sublingual.test(r.name)) led = daily != null ? daily * 1.5 : null;
      else led = daily != null ? daily * (d.factor || 0) : null;
      if (d.cls !== "levodopa" && d.cls !== "comt" && led != null) other += led;
      return { r, daily, led };
    });
    // a separate COMT inhibitor adds to the plain levodopa (not to Stalevo, which already includes it)
    const plainLd = rows.filter((r) => r.drug.cls === "levodopa" && !r.drug.comt && !r.drug.device).reduce((s, r) => s + (ok(r.mgDose) && ok(r.n) ? r.mgDose * r.n * r.drug.factor : 0), 0);
    const comtLed = comt ? plainLd * comt : 0;
    parts.filter((p) => p.r.drug.cls === "comt").forEach((p) => (p.led = Math.round(comtLed)));
    const total = ld + ldWithComt + comtLed + other;
    return { total: Math.round(total), levodopa: Math.round(ld), parts, missing: parts.some((p) => p.led == null && p.r.drug.cls !== "comt") };
  }

  /* dose timing from MAR: gives [{t}] for one drug, expected doses per day; late = gap more than interval + 30 min */
  /* intervalH: the gap between listed dose times if the order names them (e.g. 07:00, 11:00, 15:00 -> 4) */
  function timing(gives, n, now, hours, intervalH) {
    const span = (hours || 72) * H, g = gives.filter((x) => now - x.t <= span).map((x) => x.t).sort((a, b) => a - b);
    if (!n || n < 1) return { late: [], given: g.length };
    const interval = Math.min(24, 24 / n) * H, awake = intervalH ? intervalH * H : n >= 3 ? 16 / (n - 1) * H : interval; // most PD schedules run through the day, not overnight
    const late = [];
    for (let i = 1; i < g.length; i++) { const gap = g[i] - g[i - 1], expect = gap > 10 * H && n >= 3 ? null : awake; if (expect && gap > expect + 30 * 60e3) late.push({ t: g[i], by: Math.round((gap - expect) / 60e3) }); }
    const last = g.length ? g[g.length - 1] : null, overdue = last && n >= 3 && now - last > awake + 30 * 60e3 && now - last < 10 * H ? Math.round((now - last - awake) / 60e3) : null;
    const expected24 = n, got24 = g.filter((t) => now - t <= DAY).length;
    return { late, given: g.length, overdue, missed24: Math.max(0, expected24 - got24 - (n >= 3 ? 0 : 0)), got24 };
  }

  /* drugs to avoid in PD, and MAO-B inhibitor interactions */
  const AVOID = [
    { re: /haloperidol|haldol|droperidol|chlorpromazine|loxapine|perphenazine|fluphenazine|zuclopenthixol|methotrimeprazine|nozinan|risperidone|paliperidone|olanzapine|ziprasidone|lurasidone|aripiprazole|brexpiprazole|pimozide/i,
      why: "Dopamine-blocking antipsychotic: can cause severe worsening of parkinsonism.", alt: "Agitation or psychosis: quetiapine 12.5-25 mg at night (titrate slowly) or clozapine (specialist, CBC monitoring); treat the cause of delirium first." },
    { re: /metoclopramide|maxeran|reglan|prochlorperazine|stemetil|promethazine|trimethobenzamide|amisulpride/i,
      why: "Dopamine-blocking antiemetic: worsens parkinsonism.", alt: "Domperidone 10 mg PO up to TID (max 30 mg/day in Canada; QT and cardiac caution) or ondansetron (not with apomorphine)." },
    { re: /tetrabenazine|deutetrabenazine|reserpine|flunarizine|cinnarizine|amoxapine/i, why: "Depletes or blocks dopamine.", alt: "Review with neurology / pharmacy." },
    { re: /oxybutynin|tolterodine|diphenhydramine|hydroxyzine|dimenhydrinate|gravol|benztropine|trihexyphenidyl|amitriptyline|scopolamine/i,
      why: "Anticholinergic: confusion, hallucinations, constipation, retention in PD.", alt: "Bladder: mirabegron; sleep or itch: non-anticholinergic options; nausea: domperidone." }];
  const MAOB_X = [
    { re: /meperidine|pethidine|demerol/i, sev: "Contraindicated", why: "Serotonin syndrome / hypertensive reaction with MAO-B inhibitors." },
    { re: /tramadol|methadone|tapentadol|dextromethorphan|linezolid|methylene blue|st\.? john/i, sev: "Avoid or monitor closely", why: "Serotonin syndrome risk with MAO-B inhibitors." },
    { re: /pseudoephedrine|phenylephrine|ephedrine/i, sev: "Caution", why: "Blood pressure rise with MAO-B inhibitors." },
    { re: /fluoxetine|fluvoxamine|venlafaxine|duloxetine|sertraline|paroxetine|citalopram|escitalopram|amitriptyline|nortriptyline|mirtazapine/i, sev: "Usually OK at standard doses", why: "Small serotonin syndrome risk with MAO-B inhibitors: watch for agitation, tremor, fever." }];
  function avoid(meds, onMaob, onApo) {
    const out = [];
    meds.forEach((m) => { AVOID.forEach((a) => { if (a.re.test(m.name) && !(m.isPd)) out.push({ name: m.name, why: a.why, alt: a.alt, sev: "Avoid" }); }); });
    if (onMaob) meds.forEach((m) => MAOB_X.forEach((x) => { if (x.re.test(m.name)) out.push({ name: m.name, why: x.why, alt: "", sev: x.sev }); }));
    if (onApo) meds.filter((m) => /ondansetron|granisetron|palonosetron/i.test(m.name)).forEach((m) => out.push({ name: m.name, why: "5-HT3 antagonist with apomorphine: severe hypotension and loss of consciousness.", alt: "Domperidone instead.", sev: "Contraindicated" }));
    return out;
  }

  /* nil by mouth plan */
  function npo(rows, L) {
    const items = [];
    const crRows = rows.filter((r) => r.drug.id === "ld-cr"), irRows = rows.filter((r) => r.drug.id === "ld" || r.drug.id === "ld-stalevo");
    items.push("Do not stop PD medication. Missed doses risk severe rigidity, aspiration and parkinsonism-hyperpyrexia (neuroleptic malignant-like) syndrome.");
    items.push("First choice: NG (or existing PEG/NJ) tube, same times as at home. Immediate-release carbidopa-levodopa can be crushed and dispersed in water; give right away and flush.");
    if (crRows.length) { const crDaily = crRows.reduce((s, r) => s + (ok(r.mgDose) && ok(r.n) ? r.mgDose * r.n : 0), 0); items.push(`Controlled-release levodopa must not be crushed: convert ${crDaily} mg/day CR to about ${Math.round(crDaily * 0.75)} mg/day immediate-release levodopa, split across the day (CR is about 75% as available).`); }
    if (rows.some((r) => r.drug.id === "ld-stalevo")) items.push("Stalevo: give plain IR carbidopa-levodopa by tube instead; entacapone can usually be left out for a short time (its LED is lost: monitor).");
    if (rows.some((r) => r.drug.cls === "comt" || r.drug.cls === "maob")) items.push("COMT and MAO-B inhibitors can usually be held for a short time while nil by mouth; restart when swallowing returns.");
    if (rows.some((r) => r.drug.cls === "agonist" && r.drug.id !== "rotigotine")) items.push("Oral dopamine agonists: if no tube, they are included in the patch estimate below; do not give both.");
    if (L && L.total) {
      const raw = L.total / 30, mg = Math.min(16, Math.max(2, Math.floor(raw / 2) * 2));
      items.push(`If no tube is possible: rotigotine patch, rough estimate ${mg} mg/24 h (LEDD ${L.total} ÷ 30 = ${Math.round(raw * 10) / 10}, rounded down to 2 mg steps, maximum 16 mg). Check with the Parkinson's UK / OPTIMAL calculator and neurology; use a lower dose if confused, frail or hallucinating, and review daily.` + (L.total > 480 ? " LEDD is high: 16 mg will not cover it fully; ask neurology about apomorphine." : ""));
    }
    items.push("Restart the usual oral regimen as soon as the patient can swallow (SLP assessment if dysphagia).");
    return items;
  }

  /* symptoms: id, label, group, detection pattern (notes / problem list), management */
  const SYMPTOMS = [
    { id: "off", g: "Motor", label: "Wearing-off / 'off' periods, bradykinesia, rigidity", re: /wearing[- ]off|end[- ]of[- ]dose|\boff\b (period|state|episode)|rigid|stiff|bradykines|slow(ness)? of movement|akines/i,
      mgmt: ["Check doses are given on time (within 30 min) and not with high-protein meals.", "Shorten the interval between levodopa doses or add a dose; add a COMT inhibitor (entacapone with each dose, or opicapone at night) or MAO-B inhibitor.", "Sudden severe off: look for infection, missed doses, gastric stasis, interacting drugs."] },
    { id: "tremor", g: "Motor", label: "Tremor", re: /tremor/i, mgmt: ["Usually improves with levodopa optimisation; worse with anxiety, pain and fever.", "Anticholinergics only in younger patients without cognitive problems."] },
    { id: "dysk", g: "Motor", label: "Dyskinesia", re: /dyskines|choreiform|writhing/i, mgmt: ["Peak-dose: smaller, more frequent levodopa doses; reduce or stop agonists, MAO-B or COMT inhibitors.", "Amantadine 100 mg daily up to 100 mg BID-TID (renal dosing; can cause hallucinations, edema, livedo).", "Severe or troublesome: neurology (device therapy)."] },
    { id: "freeze", g: "Motor", label: "Freezing of gait, falls", re: /freez|fall(s|en)?\b|fell|unsteady|postural instability/i, mgmt: ["Physiotherapy: cueing strategies, gait aid, falls prevention.", "Check whether freezing happens 'off' (adjust levodopa) or 'on' (not levodopa-responsive).", "Review sedatives and orthostatic hypotension; hip protectors and bed alarm if high risk."] },
    { id: "dystonia", g: "Motor", label: "Dystonia / cramps (often early morning)", re: /dystoni|toe curl|foot cramp|painful cramp/i, mgmt: ["Early-morning dystonia: controlled-release levodopa at bedtime or an early-morning dose; rotigotine patch overnight.", "Focal dystonia: botulinum toxin (neurology)."] },
    { id: "swallow", g: "Motor", label: "Dysphagia / aspiration risk", re: /dysphag|swallow|aspirat|cough(ing)? (with|after|on) (thin |thick )?(food|meals|drinks|fluids|liquids)|choking|modified diet/i, mgmt: ["SLP swallow assessment; upright for meals; time meals 30-60 min after levodopa ('on' period).", "If unable to swallow tablets: nil-by-mouth plan above."] },
    { id: "oh", g: "Non-motor", label: "Orthostatic hypotension", re: /orthostat|postural (hypotension|drop)|dizz\w* (on|when) stand|lightheaded/i, mgmt: ["Stop or reduce antihypertensives, diuretics, alpha-blockers; review dopamine agonists.", "Fluids 2 L/day if no heart failure, salt, compression stockings, head-of-bed up, rise slowly.", "Drugs: midodrine 2.5 mg TID (daytime, titrate to 10 mg TID; avoid supine hypertension) or fludrocortisone 0.1 mg daily; domperidone helps when levodopa causes it."] },
    { id: "constip", g: "Non-motor", label: "Constipation", re: /constipat|no (bowel movement|bm)|bowels not|impaction/i, mgmt: ["PEG 3350 17 g daily, add sennosides; fluids and fibre.", "Constipation slows levodopa absorption and worsens 'off' periods and delirium."] },
    { id: "bladder", g: "Non-motor", label: "Urinary urgency, frequency or retention", re: /urinary (urgency|frequency|retention|incontinen)|nocturia|overactive bladder|bladder scan/i, mgmt: ["Check for retention and infection.", "Overactive bladder: mirabegron 25-50 mg daily rather than anticholinergics."] },
    { id: "psych", g: "Non-motor", label: "Hallucinations / psychosis", re: /hallucinat|seeing (things|people|animals)|visual disturb|psychos|delusion|paranoi/i, mgmt: ["Look for triggers: infection, dehydration, constipation, new drugs.", "Reduce PD drugs in this order: anticholinergics, amantadine, dopamine agonists, MAO-B inhibitors, COMT inhibitors; then levodopa only if needed.", "If still distressing: quetiapine 12.5-25 mg at night (titrate slowly) or clozapine (specialist, CBC monitoring). Rivastigmine if dementia. Never haloperidol."] },
    { id: "delirium", g: "Non-motor", label: "Delirium / acute confusion", re: /delirium|acute(ly)? confus|agitat|4at|cam positive|disorient/i, mgmt: ["Treat the cause; keep PD meds on time (missed doses cause delirium and rigidity).", "Non-drug measures first; if medication is needed, low-dose quetiapine; avoid haloperidol, other antipsychotics and benzodiazepines where possible."] },
    { id: "cog", g: "Non-motor", label: "Cognitive impairment / dementia", re: /dementia|cognitive impair|memory (loss|problem)|moca\s*\d|mmse\s*\d/i, mgmt: ["Avoid anticholinergics and amantadine; use dopamine agonists with great caution.", "Rivastigmine (oral or patch) or donepezil for Parkinson's disease dementia."] },
    { id: "mood", g: "Non-motor", label: "Depression / anxiety / apathy", re: /depress|low mood|anxi|apath|tearful/i, mgmt: ["SSRIs or SNRIs are reasonable (watch serotonin syndrome with MAO-B inhibitors); avoid tricyclics in older adults.", "Anxiety during 'off' periods: improve 'on' time first."] },
    { id: "sleep", g: "Non-motor", label: "Sleep: insomnia, REM sleep behaviour disorder, night-time 'off'", re: /insomnia|not sleeping|poor sleep|acting out (dreams|their dreams)|rem sleep|rbd\b|night(time)? (off|stiff)|daytime sleep|somnolen/i, mgmt: ["REM sleep behaviour disorder: melatonin 3-12 mg at bedtime; clonazepam only with caution.", "Night-time stiffness: controlled-release levodopa at bedtime or rotigotine patch.", "Daytime sleepiness: review dopamine agonists and sedatives."] },
    { id: "saliva", g: "Non-motor", label: "Drooling (sialorrhea)", re: /drool|sialorrh|saliva/i, mgmt: ["Glycopyrrolate (does not cross into the brain much) or botulinum toxin injections (neurology).", "Check swallowing: drooling often means dysphagia."] },
    { id: "pain", g: "Non-motor", label: "Pain", re: /\bpain\b|aching/i, mgmt: ["'Off'-related pain improves with better dopaminergic coverage.", "Acetaminophen first; avoid tramadol and meperidine with MAO-B inhibitors."] },
    { id: "icd", g: "Non-motor", label: "Impulse control problems", re: /gambl|compulsive|hypersexual|binge eating|impulse control|punding|shopping/i, mgmt: ["Usually from dopamine agonists: taper the agonist slowly (watch for agonist withdrawal: anxiety, pain, dysphoria).", "Involve family; neurology follow-up."] },
    { id: "weight", g: "Non-motor", label: "Weight loss / poor intake", re: /weight loss|poor (oral )?intake|cachexi|malnutrition/i, mgmt: ["Dietitian; protein spread through the day (high-protein meals can block levodopa absorption).", "Check swallowing, constipation, mood and dyskinesia."] }];
  function detect(texts, problems) {
    const out = {};
    SYMPTOMS.forEach((s) => {
      outer: for (const t of texts) {
        const re = new RegExp(s.re.source, "gi"); let m;
        while ((m = re.exec(t.text))) {
          const before = t.text.slice(Math.max(0, m.index - 30), m.index);
          if (/\b(no|denies|denied|without|negative for|nil)\b[^.]*$/i.test(before)) continue;
          const a = Math.max(0, t.text.lastIndexOf(".", m.index) + 1), b = t.text.indexOf(".", m.index); 
          out[s.id] = { src: t.src, quote: t.text.slice(a, b < 0 ? undefined : b + 1).trim().slice(0, 180) }; break outer;
        }
      }
      if (!out[s.id]) { const p = (problems || []).find((x) => s.re.test(x)); if (p) out[s.id] = { src: "problem list", quote: p }; }
    });
    return out;
  }

  /* motor drug classes, tailored. p: { age, cognition, psych, oh, crcl, icd, sleepy, falls, onMaob } */
  function choices(p) {
    const mark = (lvl, text) => ({ lvl, text }); // lvl: good | caution | avoid
    const C = [
      { cls: "levodopa", name: "Levodopa (carbidopa-levodopa IR/CR, levodopa-benserazide)", when: "First line for most people, and for anyone over about 70 or with cognitive problems. Most effective for slowness and stiffness.",
        cons: "Nausea, orthostatic hypotension, dyskinesia and wearing-off over time. Give 30-60 min before or after high-protein meals.", start: "Carbidopa-levodopa 25/100: half tablet TID with food, increase every 3-7 days to 1 tablet TID.", led: "1 (CR 0.75)", flags: [] },
      { cls: "agonist", name: "Dopamine agonists (pramipexole, ropinirole, rotigotine patch)", when: "Younger patients (often under 65) to delay levodopa; rotigotine patch for nil by mouth or night-time symptoms.",
        cons: "Impulse control disorders, sleep attacks, hallucinations, confusion, leg edema, orthostatic hypotension. Never stop suddenly (withdrawal).", start: "Pramipexole 0.125 mg TID (renal dosing); ropinirole 0.25 mg TID; rotigotine 2 mg/24 h.", led: "Pramipexole 100, ropinirole 20, rotigotine 30", flags: [] },
      { cls: "maob", name: "MAO-B inhibitors (rasagiline, selegiline, safinamide)", when: "Mild early symptoms, or add-on for wearing-off.",
        cons: "Modest effect. Interactions: meperidine, tramadol, methadone, dextromethorphan, linezolid. Selegiline can cause insomnia.", start: "Rasagiline 0.5-1 mg daily; selegiline 5 mg in the morning (and at noon); safinamide 50-100 mg daily (add-on).", led: "Rasagiline 100, selegiline 10, safinamide 150 fixed", flags: [] },
      { cls: "comt", name: "COMT inhibitors (entacapone, opicapone)", when: "Wearing-off on levodopa: lengthens each dose.",
        cons: "Can bring on dyskinesia (often need to lower levodopa); entacapone: diarrhea, orange urine. Tolcapone: liver monitoring.", start: "Entacapone 200 mg with each levodopa dose (max 8/day); opicapone 50 mg at bedtime.", led: "Adds 33% (entacapone) or 50% (opicapone) of levodopa", flags: [] },
      { cls: "amantadine", name: "Amantadine", when: "Troublesome peak-dose dyskinesia; sometimes tremor.",
        cons: "Hallucinations, confusion, leg edema, livedo; renally cleared.", start: "100 mg daily, increase to 100 mg BID (reduce in kidney disease).", led: "1", flags: [] },
      { cls: "anticholinergic", name: "Anticholinergics (trihexyphenidyl)", when: "Tremor in younger patients with normal thinking.",
        cons: "Confusion, hallucinations, constipation, urinary retention, glaucoma. Generally avoid over 65.", start: "Trihexyphenidyl 1 mg daily, slowly to 2 mg TID.", led: "–", flags: [] },
      { cls: "apo", name: "Apomorphine (SC pen, sublingual film)", when: "Rescue for sudden 'off' episodes despite optimised oral therapy (specialist).",
        cons: "Nausea (domperidone pre-treatment), hypotension; never with ondansetron.", start: "Specialist test dose.", led: "SC 10, sublingual 1.5", flags: [] },
      { cls: "device", name: "Device-aided therapy (DBS, levodopa intestinal gel, foslevodopa SC infusion)", when: "Advanced disease with motor fluctuations or dyskinesia despite optimised oral treatment.",
        cons: "Specialist assessment; selected patients only.", start: "Movement disorders referral.", led: "Gel 1.11, foslevodopa 0.75", flags: [] }];
    const f = (cls, m) => C.find((c) => c.cls === cls).flags.push(m);
    const old = ok(p.age) && p.age >= 70;
    if (old) { f("levodopa", mark("good", "Age " + p.age + ": levodopa preferred.")); f("agonist", mark("caution", "Age " + p.age + ": more confusion and hallucinations.")); f("anticholinergic", mark("avoid", "Age " + p.age + ".")); }
    if (p.cognition) { f("agonist", mark("avoid", "Cognitive impairment.")); f("amantadine", mark("avoid", "Cognitive impairment.")); f("anticholinergic", mark("avoid", "Cognitive impairment.")); }
    if (p.psych) { f("agonist", mark("avoid", "Hallucinations / psychosis.")); f("amantadine", mark("avoid", "Hallucinations / psychosis.")); f("anticholinergic", mark("avoid", "Hallucinations / psychosis.")); f("maob", mark("caution", "Hallucinations.")); }
    if (p.oh) { f("agonist", mark("caution", "Orthostatic hypotension.")); f("levodopa", mark("caution", "Can worsen orthostatic hypotension: domperidone may help.")); }
    if (ok(p.crcl) && p.crcl < 50) { f("amantadine", mark("caution", `CrCl ${Math.round(p.crcl)}: reduce the dose (e.g. 100 mg every 1-2 days).`)); f("agonist", mark("caution", `CrCl ${Math.round(p.crcl)}: pramipexole needs renal dosing.`)); }
    if (p.icd) f("agonist", mark("avoid", "Impulse control problems."));
    if (p.sleepy) f("agonist", mark("caution", "Daytime sleepiness."));
    if (p.falls) f("anticholinergic", mark("avoid", "Falls."));
    if (p.onMaob) f("maob", mark("caution", "Already on one: check interacting drugs."));
    if (p.dysk) f("amantadine", mark("good", "Dyskinesia present."));
    if (p.off) f("comt", mark("good", "Wearing-off present."));
    return C;
  }

  /* hours between listed times, e.g. "at 07:00, 11:00, 15:00, 19:00" -> 4 */
  function listedInterval(text) {
    const t = (String(text).match(/(?<![\d\/.])([01]\d|2[0-3]):?([0-5]\d)(?![\d\/.])/g) || []).map((x) => { const d = x.replace(":", ""); return +d.slice(0, 2) + +d.slice(2) / 60; }).sort((a, b) => a - b);
    if (t.length < 2) return null; let m = 24; for (let i = 1; i < t.length; i++) m = Math.min(m, t[i] - t[i - 1]); return m > 0 ? m : null;
  }
  const api = { listedInterval, DRUGS, drugOf, levodopaPerTab, mgPerDose, tabsPerDose, perDay, row, ledd, timing, AVOID, MAOB_X, avoid, npo, SYMPTOMS, detect, choices, H, DAY };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.PdRules = api;
})(typeof window !== "undefined" ? window : globalThis);
