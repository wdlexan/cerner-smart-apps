/* Opioid safety tab - flags patients at risk of opioid-induced over-sedation / respiratory depression.
   FIRST DRAFT for sandbox testing. The scoring is NOT validated: it is a transparent, rules-based
   screen meant to be tuned against real cases before anyone relies on it.

   Layout of this file:
     CONFIG          - every number you might want to change (conversion factors, cut-offs, points)
     drug lists      - which names count as opioids / sedatives
     load(client)    - FHIR searches (same patterns as the Choosing Wisely tab)
     assess(data)    - pure function: resources in, risk result out (no FHIR calls, easy to test)
     render(...)     - draws the tab
   OP.assess() is kept separate so the same logic can later run in a unit-wide sweep. */

(function (root) {
  'use strict';

  const HOUR = 3600 * 1000;

  const CONFIG = {
    windowHours: 72,          // how far back to read administrations and vitals
    // Oral morphine equivalents per mg. Oral factors are CDC 2022; parenteral factors are common
    // equianalgesic ratios and vary between references - CHECK AGAINST ISLAND HEALTH'S TABLE.
    mme: {
      morphine:      { oral: 1,    parenteral: 3 },
      hydromorphone: { oral: 5,    parenteral: 20 },
      oxycodone:     { oral: 1.5 },
      hydrocodone:   { oral: 1 },
      codeine:       { oral: 0.15 },
      tramadol:      { oral: 0.2 },
      tapentadol:    { oral: 0.4 },
      oxymorphone:   { oral: 3 },
      levorphanol:   { oral: 11 },
      meperidine:    { oral: 0.1,  parenteral: 0.4 },
      fentanyl:      { parenteral: 300 },   // per mg IV (100 mcg IV ~ 10 mg IV morphine)
      methadone:     { oral: 4.7 }          // CDC 2022 single factor; methadone is NOT linear - treat as rough
    },
    fentanylPatchPerMcgHr: 2.4,             // MME/day per mcg/h of transdermal fentanyl (CDC 2022)
    noMme: ['buprenorphine', 'sufentanil', 'remifentanil', 'alfentanil'], // flagged, not converted
    renalRiskOpioids: ['morphine', 'codeine', 'meperidine', 'tramadol'],  // active metabolites accumulate

    cut: {
      mmeModerate: 50, mmeHigh: 90,         // MME in last 24 h
      escalationPct: 50,                    // last 24 h vs previous 24 h
      rrRed: 10, rrAmber: 12,               // breaths/min: < red, < amber
      spo2Red: 88, spo2Amber: 92,           // %: < red, < amber
      egfrHigh: 30, egfrModerate: 60,
      bmiHigh: 40,
      ageOld: 65, ageVeryOld: 80
    },
    tiers: { red: 8, amber: 4 },            // total points (any hard trigger makes it red regardless)
    maxParallel: 3,
    searchMs: 25000
  };

  // ---------- drug name matching ----------
  // Brand names map to the generic. Add local brands here as you find them in the sandbox.
  const OPIOIDS = {
    morphine: /\bmorphine|statex|m-?eslon|kadian|ms ?contin|doloral/i,
    hydromorphone: /hydromorphone|dilaudid|hydromorph ?contin|jurnista/i,
    oxycodone: /oxycodone|oxycontin|oxyneo|percocet|endocet|supeudol|targin/i,
    hydrocodone: /hydrocodone|hycodan|tussionex/i,
    codeine: /codeine|tylenol ?(#|no\.? ?)\d|codeine contin/i,
    tramadol: /tramadol|tramacet|ultram|zytram|tridural|durela/i,
    tapentadol: /tapentadol|nucynta/i,
    oxymorphone: /oxymorphone/i,
    levorphanol: /levorphanol/i,
    meperidine: /meperidine|pethidine|demerol/i,
    fentanyl: /fentanyl|duragesic|sublimaze/i,
    sufentanil: /sufentanil/i,
    remifentanil: /remifentanil/i,
    alfentanil: /alfentanil/i,
    methadone: /methadone|metadol|methadose/i,
    buprenorphine: /buprenorphine|suboxone|sublocade|butrans|belbuca/i
  };
  // Not opioids for this purpose (combination products like buprenorphine/naloxone are let through below).
  const NOT_OPIOID = /loperamide|naloxone|narcan|naltrexone|diphenoxylate/i;

  const SEDATIVES = [
    { cls: 'Benzodiazepine', pts: 2, re: /lorazepam|ativan|midazolam|versed|diazepam|valium|clonazepam|rivotril|alprazolam|xanax|oxazepam|temazepam|restoril|chlordiazepoxide|clobazam|bromazepam|nitrazepam/i },
    { cls: 'Z-drug', pts: 1, re: /zopiclone|imovane|zolpidem|sublinox|ambien|eszopiclone/i },
    { cls: 'Gabapentinoid', pts: 1, re: /gabapentin|neurontin|pregabalin|lyrica/i },
    { cls: 'Antipsychotic', pts: 1, re: /quetiapine|seroquel|olanzapine|zyprexa|haloperidol|haldol|risperidone|chlorpromazine|methotrimeprazine|nozinan|loxapine|clozapine/i },
    { cls: 'Sedating antihistamine', pts: 1, re: /diphenhydramine|benadryl|hydroxyzine|atarax|dimenhydrinate|gravol|promethazine|doxylamine|unisom/i },
    { cls: 'Muscle relaxant', pts: 1, re: /cyclobenzaprine|flexeril|baclofen|lioresal|methocarbamol|robaxin|tizanidine|orphenadrine/i },
    { cls: 'Sedating antidepressant', pts: 1, re: /trazodone|desyrel|mirtazapine|remeron|amitriptyline|elavil|nortriptyline|doxepin|sinequan/i },
    { cls: 'Other CNS depressant', pts: 2, re: /phenobarbital|ketamine|dexmedetomidine|precedex|propofol/i }
  ];
  const NALOXONE = /naloxone|narcan/i;

  const CONDITIONS = [
    { key: 'osa', label: 'Sleep apnea', pts: 2, re: /sleep apn|\bosa\b|obesity hypoventilation/i },
    { key: 'lung', label: 'Chronic lung / hypoventilation', pts: 1, re: /copd|chronic obstructive|emphysema|chronic bronchitis|hypercapn|neuromuscular|myasthenia|amyotrophic|\bals\b|restrictive lung|interstitial lung/i },
    { key: 'chf', label: 'Heart failure', pts: 1, re: /heart failure|\bchf\b|hfref|hfpef|cardiomyopathy/i },
    { key: 'liver', label: 'Cirrhosis / liver failure', pts: 1, re: /cirrhosis|hepatic failure|liver failure|hepatic encephalopathy/i },
    { key: 'ckd', label: 'Chronic kidney disease / dialysis', pts: 0, re: /chronic kidney|\bckd\b|esrd|end.stage renal|dialysis/i }, // points come from eGFR instead
    { key: 'neuro', label: 'Dementia / stroke / brain injury', pts: 1, re: /dementia|alzheimer|stroke|cerebrovascular|brain injury|parkinson/i }
  ];

  // LOINC codes
  const L = {
    rr: ['9279-1'], spo2: ['59408-5', '2708-6', '20564-1', '59417-6'],
    o2flow: ['3151-8', '19941-4'], fio2: ['3150-0', '19996-8'],
    weight: ['29463-7', '3141-9'], height: ['8302-2', '8306-3'], bmi: ['39156-5'],
    egfr: ['33914-3', '48642-3', '48643-1', '62238-1', '98979-8', '88293-6', '88294-4', '50210-4'],
    creat: ['2160-0', '38483-4', '14682-9']
  };

  // ---------- small helpers ----------
  const toTime = (s) => { const t = s ? Date.parse(s) : NaN; return isNaN(t) ? null : t; };
  const ccText = (cc) => !cc ? '' : (cc.text || ((cc.coding || []).find((c) => c.display) || {}).display || '');
  const codes = (cc) => ((cc && cc.coding) || []).map((c) => c.code);
  const hasCode = (o, list) => codes(o.code).some((c) => list.includes(c));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const round = (n, d) => { const f = Math.pow(10, d || 0); return Math.round(n * f) / f; };
  const fhirDate = (t) => new Date(t).toISOString().slice(0, 19) + 'Z';

  function medName(r, contained) {
    if (r.medicationCodeableConcept) return ccText(r.medicationCodeableConcept);
    const ref = r.medicationReference;
    if (!ref) return '';
    if (ref.display) return ref.display;
    if (ref.reference && ref.reference.startsWith('#')) {
      const m = (r.contained || []).find((c) => '#' + c.id === ref.reference);
      if (m) return ccText(m.code);
    }
    return (contained && contained[ref.reference]) || '';
  }
  function opioidOf(name) {
    if (!name || NOT_OPIOID.test(name) && !/buprenorphine|oxycodone/i.test(name)) return null;
    for (const k of Object.keys(OPIOIDS)) if (OPIOIDS[k].test(name)) return k;
    return null;
  }
  function sedativeOf(name) { return SEDATIVES.find((s) => s.re.test(name || '')) || null; }

  function routeKind(text) {
    const t = (text || '').toLowerCase();
    if (/epidural|intrathecal|spinal|neurax/.test(t)) return 'neuraxial';
    if (/transderm|patch|topical/.test(t)) return 'transdermal';
    if (/\biv\b|intraven|\bim\b|intramusc|\bsc\b|subcut|sub-q|subq|\bsq\b|parenter|inject/.test(t)) return 'parenteral';
    return 'oral'; // PO, SL, NG, GT, PR, buccal and unknown
  }
  function toMg(value, unit) {
    const u = (unit || '').toLowerCase();
    if (value == null || isNaN(value)) return null;
    if (/^(mcg|ug|µg|microgram)/.test(u)) return value / 1000;
    if (/^mg|milligram/.test(u) || !u) return value;
    if (/^g$|^gram/.test(u)) return value * 1000;
    return null;
  }
  function mmeFor(drug, mg, route) {
    const f = CONFIG.mme[drug];
    if (!f || mg == null) return null;
    const factor = route === 'parenteral' ? (f.parenteral != null ? f.parenteral : null) : (f.oral != null ? f.oral : null);
    return factor == null ? null : mg * factor;
  }

  // ---------- loading ----------
  function withTimeout(p, ms, label) {
    let t;
    return Promise.race([p, new Promise((_, rej) => { t = setTimeout(() => rej(new Error(label + ' timed out')), ms); })])
      .finally(() => clearTimeout(t));
  }
  function throttled(client) {
    let active = 0; const queue = [];
    const next = () => {
      while (active < CONFIG.maxParallel && queue.length) {
        const job = queue.shift(); active++;
        Promise.resolve().then(job.fn).then(job.resolve, job.reject).finally(() => { active--; next(); });
      }
    };
    return { patient: client.patient,
      request: (...a) => new Promise((resolve, reject) => { queue.push({ fn: () => client.request(...a), resolve, reject }); next(); }) };
  }
  async function search(client, url, pages) {
    const r = await withTimeout(client.request(url, { pageLimit: pages || 3, flat: true }), CONFIG.searchMs, 'Search');
    return Array.isArray(r) ? r : (r && r.entry ? r.entry.map((e) => e.resource) : []);
  }
  async function firstWorking(client, urls, pages) {
    let last;
    for (const u of urls) { try { return await search(client, u, pages); } catch (e) { last = e; } }
    throw last;
  }

  async function load(rawClient, opts) {
    const client = throttled(rawClient);
    const pid = client.patient.id;
    const now = (opts && opts.now) || Date.now();
    const ge = fhirDate(now - CONFIG.windowHours * HOUR);
    const geLabs = fhirDate(now - 14 * 24 * HOUR);
    const out = { now, patient: null, medRequests: [], medAdmins: null, vitals: [], labs: [], body: [], survey: [], conditions: [], failed: [] };
    const run = async (label, key, fn, fallback) => {
      try { out[key] = await fn(); } catch (e) { console.warn('[opioid] ' + label, e); out.failed.push(label); out[key] = fallback; }
    };
    await Promise.all([
      run('Patient', 'patient', () => client.patient.read(), null),
      run('Medication orders', 'medRequests', () => firstWorking(client, [
        'MedicationRequest?patient=' + pid + '&status=active&_count=100',
        'MedicationRequest?patient=' + pid + '&_count=100'], 5), []),
      run('Problem list', 'conditions', () => firstWorking(client, [
        'Condition?patient=' + pid + '&category=problem-list-item',
        'Condition?patient=' + pid + '&clinical-status=active'], 3), [])
    ]);
    await Promise.all([
      run('Medication administrations', 'medAdmins', () => search(client,
        'MedicationAdministration?patient=' + pid + '&effective-time=ge' + ge + '&_count=100', 10), null),
      run('Vital signs', 'vitals', () => search(client,
        'Observation?patient=' + pid + '&category=vital-signs&date=ge' + ge + '&_count=100', 10), []),
      run('Kidney labs', 'labs', () => firstWorking(client, [
        'Observation?patient=' + pid + '&code=' + L.egfr.concat(L.creat).map((c) => 'http://loinc.org|' + c).join(',') + '&date=ge' + geLabs + '&_count=50',
        'Observation?patient=' + pid + '&category=laboratory&date=ge' + geLabs + '&_count=100'], 5), [])
    ]);
    await Promise.all([
      run('Height / weight', 'body', () => search(client, 'Observation?patient=' + pid + '&code=' +
        L.weight.concat(L.height, L.bmi).map((c) => 'http://loinc.org|' + c).join(',') + '&_count=50', 2), []),
      // Sedation scores (POSS / RASS) are often charted as "survey" rather than vital signs.
      run('Sedation scores', 'survey', () => search(client,
        'Observation?patient=' + pid + '&category=survey&date=ge' + ge + '&_count=100', 5), [])
    ]);
    // Name any medications that only came as a reference (Medication/123) with no display text.
    const refs = new Set();
    [...out.medRequests, ...(out.medAdmins || [])].forEach((r) => {
      const ref = r && r.medicationReference && r.medicationReference.reference;
      if (ref && !ref.startsWith('#') && !r.medicationReference.display) refs.add(ref);
    });
    out.medNames = {};
    await Promise.all([...refs].slice(0, 30).map(async (ref) => {
      try { const m = await client.request(ref); out.medNames[ref] = ccText(m.code); } catch (e) { /* leave unnamed */ }
    }));
    return out;
  }

  // ---------- assessment (pure) ----------
  function ageOf(p, now) {
    if (!p || !p.birthDate) return null;
    const b = new Date(p.birthDate), d = new Date(now);
    let a = d.getFullYear() - b.getFullYear();
    if (d < new Date(d.getFullYear(), b.getMonth(), b.getDate())) a--;
    return a;
  }
  function obsValue(o) {
    if (o.valueQuantity && o.valueQuantity.value != null) return { v: +o.valueQuantity.value, unit: o.valueQuantity.unit || o.valueQuantity.code || '' };
    if (o.valueInteger != null) return { v: +o.valueInteger, unit: '' };
    if (o.valueString != null) { const m = String(o.valueString).match(/-?\d+(\.\d+)?/); return m ? { v: +m[0], unit: '', text: o.valueString } : null; }
    if (o.valueCodeableConcept) { const t = ccText(o.valueCodeableConcept); const m = t.match(/-?\d+/); return { v: m ? +m[0] : null, unit: '', text: t }; }
    return null;
  }
  function series(list, codeList, textRe) {
    return (list || []).filter((o) => o && o.resourceType === 'Observation' && o.status !== 'entered-in-error' && o.status !== 'cancelled' &&
        (hasCode(o, codeList) || (textRe && textRe.test(ccText(o.code)))))
      .map((o) => { const v = obsValue(o); return v && v.v != null ? { t: toTime(o.effectiveDateTime || (o.effectivePeriod && o.effectivePeriod.start) || o.issued), v: v.v, unit: v.unit, text: v.text } : null; })
      .filter((x) => x && x.t != null).sort((a, b) => a.t - b.t);
  }
  function ckdEpi2021(scrMgDl, age, sex) {
    if (!scrMgDl || age == null) return null;
    const f = sex === 'female';
    const k = f ? 0.7 : 0.9, a = f ? -0.241 : -0.302;
    return 142 * Math.pow(Math.min(scrMgDl / k, 1), a) * Math.pow(Math.max(scrMgDl / k, 1), -1.2) * Math.pow(0.9938, age) * (f ? 1.012 : 1);
  }

  // How many doses a day an order allows, from timing.repeat or text like "q4h" / "Q4-6H PRN".
  function dosesPerDay(di) {
    const rep = (di.timing && di.timing.repeat) || {};
    if (rep.frequency && rep.period) {
      const h = { s: 1 / 3600, min: 1 / 60, h: 1, d: 24, wk: 168 }[rep.periodUnit || 'd'] || 24;
      return rep.frequency * 24 / (rep.period * h);
    }
    const txt = [di.text, di.timing && di.timing.code && ccText(di.timing.code)].filter(Boolean).join(' ').toLowerCase();
    let m = txt.match(/q\s*(\d+)\s*(?:-|to)?\s*\d*\s*h/);
    if (m) return 24 / +m[1];
    if (/\bqid\b|four times/.test(txt)) return 4;
    if (/\btid\b|three times/.test(txt)) return 3;
    if (/\bbid\b|twice/.test(txt)) return 2;
    if (/\bdaily|\bqd\b|once|\bhs\b|bedtime|qhs/.test(txt)) return 1;
    return null;
  }
  function orderDose(di) {
    const dr = (di.doseAndRate || [])[0] || {};
    if (dr.doseQuantity) return { value: +dr.doseQuantity.value, unit: dr.doseQuantity.unit || dr.doseQuantity.code };
    if (dr.doseRange && dr.doseRange.high) return { value: +dr.doseRange.high.value, unit: dr.doseRange.high.unit || dr.doseRange.high.code };
    return null;
  }

  function assess(data) {
    const now = data.now || Date.now();
    const p = data.patient || {};
    const names = data.medNames || {};
    const age = ageOf(p, now);
    const sex = p.gender;
    const t24 = now - 24 * HOUR, t48 = now - 48 * HOUR, t72 = now - 72 * HOUR;
    const notes = [];          // data-quality notes shown at the bottom
    const flags = [];          // { group, text, pts, red }
    const add = (group, text, pts, red) => flags.push({ group, text, pts: pts || 0, red: !!red });

    // --- medications ---
    const orders = (data.medRequests || []).filter((r) => r && r.resourceType === 'MedicationRequest')
      .map((r) => {
        const name = medName(r, names);
        const di = (r.dosageInstruction || [])[0] || {};
        const cat = (r.category || []).flatMap(codes).join(' ');
        return { r, name, opioid: opioidOf(name), sed: sedativeOf(name), naloxone: NALOXONE.test(name),
          prn: !!di.asNeededBoolean || !!di.asNeededCodeableConcept || /prn/i.test(di.text || ''),
          route: routeKind(ccText(di.route) || di.text), di, active: r.status === 'active',
          home: /community|outpatient|home/i.test(cat) || r.reportedBoolean === true };
      });
    const activeOrders = orders.filter((o) => o.active && !o.home);
    const haveMar = Array.isArray(data.medAdmins);
    if (!haveMar) notes.push('Medication administrations (MAR) could not be read, so doses below are what the orders would allow, not what was given.');

    const admins = (haveMar ? data.medAdmins : []).filter((r) => r && r.resourceType === 'MedicationAdministration' && ['completed', 'in-progress'].includes(r.status))
      .map((r) => {
        const name = medName(r, names);
        const d = r.dosage || {};
        const route = routeKind(ccText(d.route) || d.text);
        const t = toTime(r.effectiveDateTime || (r.effectivePeriod && r.effectivePeriod.start));
        const drug = opioidOf(name);
        const mg = d.dose ? toMg(+d.dose.value, d.dose.unit || d.dose.code) : null;
        const infusion = !!(d.rateQuantity || d.rateRatio) || /pca|infusion|drip/i.test(name + ' ' + (d.text || ''));
        let mme = null;
        if (drug && !infusion && route !== 'transdermal' && route !== 'neuraxial') mme = mmeFor(drug, mg, route);
        return { name, t, drug, route, mg, mme, infusion, sed: sedativeOf(name), naloxone: NALOXONE.test(name),
          dose: d.dose ? (d.dose.value + ' ' + (d.dose.unit || d.dose.code || '')) : (d.text || '') };
      }).filter((a) => a.t != null && a.t >= t72 && a.t <= now).sort((a, b) => a.t - b.t);

    const opAdmins = admins.filter((a) => a.drug);
    const sum = (list, from, to) => list.filter((a) => a.t > from && a.t <= to && a.mme != null).reduce((s, a) => s + a.mme, 0);
    let mme24 = sum(opAdmins, t24, now), mmePrev = sum(opAdmins, t48, t24);
    const unconverted = opAdmins.filter((a) => a.t > t24 && a.mme == null);

    // Fentanyl patches: add their daily MME while the order is active.
    activeOrders.filter((o) => o.opioid === 'fentanyl' && o.route === 'transdermal').forEach((o) => {
      const d = orderDose(o.di);
      if (d && d.value) { const v = d.value * CONFIG.fentanylPatchPerMcgHr; mme24 += v; mmePrev += v; }
    });

    // No MAR: estimate the most the orders allow in a day.
    let mmeOrdered = null;
    const opOrders = activeOrders.filter((o) => o.opioid);
    if (opOrders.length) {
      mmeOrdered = 0;
      opOrders.forEach((o) => {
        const d = orderDose(o.di), n = dosesPerDay(o.di);
        if (o.route === 'transdermal' && o.opioid === 'fentanyl') { if (d) mmeOrdered += d.value * CONFIG.fentanylPatchPerMcgHr; return; }
        const mg = d ? toMg(d.value, d.unit) : null;
        const per = mmeFor(o.opioid, mg, o.route);
        if (per != null && n) mmeOrdered += per * n; else o.unparsed = true;
      });
    }

    const onOpioid = opAdmins.some((a) => a.t > t24) || opOrders.length > 0;
    const mmeShown = haveMar ? mme24 : mmeOrdered;
    const mmeBasis = haveMar ? 'given in last 24 h' : 'maximum the active orders allow per day';

    // --- opioid exposure flags ---
    const G1 = 'Opioid exposure';
    if (mmeShown != null && mmeShown >= CONFIG.cut.mmeHigh) add(G1, `MME ${round(mmeShown)} (${mmeBasis}) — ≥${CONFIG.cut.mmeHigh}`, 2);
    else if (mmeShown != null && mmeShown >= CONFIG.cut.mmeModerate) add(G1, `MME ${round(mmeShown)} (${mmeBasis}) — ≥${CONFIG.cut.mmeModerate}`, 1);
    if (haveMar && mmePrev > 0 && mme24 >= mmePrev * (1 + CONFIG.cut.escalationPct / 100))
      add(G1, `Dose escalating: ${round(mme24)} MME in last 24 h vs ${round(mmePrev)} the 24 h before (+${round((mme24 / mmePrev - 1) * 100)}%)`, 1);
    const homeOpioid = orders.some((o) => o.home && o.opioid);
    const firstOpioid = opAdmins.length ? opAdmins[0].t : null;
    const opioidNaive = onOpioid && !homeOpioid && haveMar && firstOpioid != null && firstOpioid > t48;
    if (opioidNaive) add(G1, 'Possibly opioid-naïve: no home opioid on file and first inpatient dose within 48 h', 1);
    const infusions = opAdmins.filter((a) => a.infusion && a.t > t24).length || activeOrders.filter((o) => o.opioid && /pca|infusion/i.test(o.name + ' ' + (o.di.text || ''))).length;
    if (infusions) add(G1, 'Opioid infusion or PCA running', 1);
    const longActing = [...new Set(opOrders.filter((o) => o.opioid === 'methadone' || (o.opioid === 'fentanyl' && o.route === 'transdermal')).map((o) => o.opioid === 'methadone' ? 'methadone' : 'fentanyl patch'))];
    if (longActing.length) add(G1, `Long-acting with delayed peak: ${longActing.join(', ')} (MME conversion is rough)`, 1);
    const neuraxial = opAdmins.some((a) => a.route === 'neuraxial') || opOrders.some((o) => o.route === 'neuraxial');
    if (neuraxial) add(G1, 'Neuraxial (epidural/intrathecal) opioid — delayed respiratory depression possible; not included in MME', 1);
    const noMme = [...new Set(opOrders.filter((o) => CONFIG.noMme.includes(o.opioid)).map((o) => o.opioid))];
    if (noMme.length) notes.push(`${noMme.join(', ')}: not converted to MME.`);
    if (unconverted.length) notes.push(`${unconverted.length} opioid dose(s) in the last 24 h could not be converted to MME (unit or route not recognised, or an infusion).`);
    if (!haveMar && opOrders.some((o) => o.unparsed)) notes.push('Some opioid orders had a dose or frequency that could not be read, so the ordered MME is an underestimate.');

    // --- sedatives ---
    const G2 = 'Other sedating medications';
    const sedSeen = {};
    admins.filter((a) => a.sed && a.t > t24).forEach((a) => { (sedSeen[a.sed.cls] = sedSeen[a.sed.cls] || { s: a.sed, names: new Set(), how: 'given' }).names.add(a.name); });
    activeOrders.filter((o) => o.sed && (!haveMar || !o.prn)).forEach((o) => {
      const e = sedSeen[o.sed.cls] = sedSeen[o.sed.cls] || { s: o.sed, names: new Set(), how: o.prn ? 'ordered PRN' : 'scheduled' };
      e.names.add(o.name);
    });
    let sedPts = 0;
    const sedClasses = Object.values(sedSeen);
    sedClasses.forEach((e) => {
      const pts = Math.min(e.s.pts, 4 - sedPts); sedPts += Math.max(pts, 0);
      add(G2, `${e.s.cls} (${e.how}): ${[...e.names].slice(0, 3).join('; ')}`, Math.max(pts, 0));
    });
    const prnSeds = haveMar ? activeOrders.filter((o) => o.sed && o.prn && !sedSeen[o.sed.cls]) : [];
    if (prnSeds.length) notes.push('Sedatives ordered PRN but not given in 24 h (not scored): ' + prnSeds.map((o) => o.name).slice(0, 4).join('; '));

    // --- patient factors ---
    const G3 = 'Patient factors';
    if (age != null && age >= CONFIG.cut.ageVeryOld) add(G3, `Age ${age}`, 2);
    else if (age != null && age >= CONFIG.cut.ageOld) add(G3, `Age ${age}`, 1);
    const condTexts = (data.conditions || []).filter((c) => c && c.resourceType === 'Condition' &&
      !/resolved|inactive|entered-in-error/i.test(codes(c.clinicalStatus).join(' ') + ' ' + codes(c.verificationStatus).join(' ')))
      .map((c) => ccText(c.code)).filter(Boolean);
    CONDITIONS.forEach((def) => {
      const hit = condTexts.find((t) => def.re.test(t));
      if (hit && def.pts) add(G3, `${def.label}: ${hit}`, def.pts);
      else if (hit) notes.push(`${def.label} on problem list (${hit}); scored from eGFR.`);
    });
    // kidney function
    const egfrS = series(data.labs, L.egfr, /egfr|glomerular/i);
    const creS = series(data.labs, L.creat, /^creatinine|creatinine,? (serum|plasma)/i);
    let egfr = egfrS.length ? egfrS[egfrS.length - 1].v : null, egfrSrc = 'reported eGFR';
    if (egfr == null && creS.length) {
      const c = creS[creS.length - 1];
      const mgdl = /umol|µmol|micromol/i.test(c.unit) || c.v > 20 ? c.v / 88.4 : c.v;
      egfr = ckdEpi2021(mgdl, age, sex); egfrSrc = 'calculated (CKD-EPI 2021) from creatinine ' + c.v + ' ' + c.unit;
    }
    if (egfr != null) {
      const e = round(egfr);
      const renalOps = [...new Set(opOrders.concat(opAdmins).map((x) => x.opioid || x.drug).filter((d) => CONFIG.renalRiskOpioids.includes(d)))];
      if (egfr < CONFIG.cut.egfrHigh) add(G3, `eGFR ${e} (${egfrSrc})` + (renalOps.length ? ` — ${renalOps.join(', ')} accumulate in renal failure; consider hydromorphone or fentanyl` : ''), renalOps.length ? 3 : 2);
      else if (egfr < CONFIG.cut.egfrModerate) add(G3, `eGFR ${e} (${egfrSrc})`, 1);
    } else notes.push('No eGFR or creatinine found in the last 14 days.');
    // obesity
    const bmiS = series(data.body, L.bmi), wS = series(data.body, L.weight), hS = series(data.body, L.height);
    let bmi = bmiS.length ? bmiS[bmiS.length - 1].v : null;
    if (bmi == null && wS.length && hS.length) {
      const w = wS[wS.length - 1], h = hS[hS.length - 1];
      const kg = /lb/i.test(w.unit) ? w.v * 0.4536 : w.v;
      const m = /in/i.test(h.unit) ? h.v * 0.0254 : (h.v > 3 ? h.v / 100 : h.v);
      if (kg > 0 && m > 0) bmi = kg / (m * m);
    }
    if (bmi != null && bmi >= CONFIG.cut.bmiHigh) add(G3, `BMI ${round(bmi, 1)}`, 1);

    // --- early warning signs ---
    const G4 = 'Early warning signs';
    const all = (data.vitals || []).concat(data.survey || []);
    const rr = series(all, L.rr, /resp(iratory)? rate/i).filter((x) => x.t >= t72);
    const spo2 = series(all, L.spo2, /spo2|oxygen saturation|pulse ox/i).filter((x) => x.t >= t72);
    const o2 = series(all, L.o2flow.concat(L.fio2), /oxygen flow|o2 flow|fio2/i).filter((x) => x.t >= t72 && x.v > 0 && !(x.v === 21 || x.v === 0.21));
    const poss = series(all, [], /pasero|\bposs\b|opioid.induced sedation|sedation scale|sedation level/i).filter((x) => x.t >= t72);
    const rass = series(all, [], /\brass\b|richmond/i).filter((x) => x.t >= t72);

    const in24 = (s) => s.filter((x) => x.t > t24);
    const minOf = (s) => s.reduce((m, x) => (m == null || x.v < m.v ? x : m), null);
    const rrMin = minOf(in24(rr)), spMin = minOf(in24(spo2));
    const at = (x) => new Date(x.t).toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' });
    if (rrMin && rrMin.v < CONFIG.cut.rrRed) add(G4, `RR ${rrMin.v} at ${at(rrMin)}`, 4, onOpioid);
    else if (rrMin && rrMin.v < CONFIG.cut.rrAmber) add(G4, `RR ${rrMin.v} at ${at(rrMin)}`, 2);
    if (spMin && spMin.v < CONFIG.cut.spo2Red) add(G4, `SpO₂ ${spMin.v}% at ${at(spMin)}`, 3, onOpioid);
    else if (spMin && spMin.v < CONFIG.cut.spo2Amber) add(G4, `SpO₂ ${spMin.v}% at ${at(spMin)}`, 1);
    if (in24(o2).length && !o2.some((x) => x.t <= t24)) add(G4, 'New oxygen requirement in the last 24 h', 1);
    const possMax = in24(poss).reduce((m, x) => (m == null || x.v > m.v ? x : m), null);
    if (possMax && possMax.v >= 3) add(G4, `POSS ${possMax.v} at ${at(possMax)} (3–4 = unacceptable sedation)`, 4, true);
    else if (possMax && possMax.v === 2) add(G4, `POSS 2 at ${at(possMax)}`, 1);
    const rassMin = minOf(in24(rass));
    if (rassMin && rassMin.v <= -3) add(G4, `RASS ${rassMin.v} at ${at(rassMin)}`, 4, true);
    else if (rassMin && rassMin.v <= -1) add(G4, `RASS ${rassMin.v} at ${at(rassMin)}`, 1);
    if (!poss.length && !rass.length) notes.push('No sedation score (POSS or RASS) found as structured data in the last 72 h.');
    if (!rr.length) notes.push('No respiratory rate found in the last 72 h.');

    // Naloxone given = near miss
    const nalGiven = admins.filter((a) => a.naloxone);
    if (nalGiven.length) add(G4, `Naloxone given ${nalGiven.length}× (last at ${at(nalGiven[nalGiven.length - 1])}) — near miss`, 5, true);

    // --- good-practice prompts (no points) ---
    const prompts = [];
    if (onOpioid && !orders.some((o) => o.naloxone && o.active)) prompts.push('No active naloxone order found — consider naloxone PRN.');
    if (onOpioid && sedClasses.some((e) => e.s.cls === 'Benzodiazepine')) prompts.push('Opioid + benzodiazepine: review whether both are needed; consider continuous SpO₂ monitoring.');
    if (onOpioid && flags.some((f) => /Sleep apnea/.test(f.text))) prompts.push('Sleep apnea: confirm CPAP is in use while sleeping.');

    const points = flags.reduce((s, f) => s + f.pts, 0);
    const hard = flags.filter((f) => f.red);
    let tier = 'none';
    if (onOpioid || hard.length) tier = hard.length || points >= CONFIG.tiers.red ? 'red' : points >= CONFIG.tiers.amber ? 'amber' : 'green';

    return { tier, points, flags, hard, prompts, notes, onOpioid, age, sex,
      mme: { last24: haveMar ? round(mme24) : null, prev24: haveMar ? round(mmePrev) : null, ordered: mmeOrdered != null ? round(mmeOrdered) : null, basis: mmeBasis },
      admins, opAdmins, sedClasses, opOrders: opOrders.map((o) => ({ name: o.name, prn: o.prn, route: o.route })),
      vitals: { rr, spo2, o2, poss, rass }, haveMar, failed: data.failed || [], now };
  }

  // ---------- rendering ----------
  const TIER_TEXT = {
    red: 'High risk — review now', amber: 'Moderate risk — watch closely', green: 'Lower risk', none: 'No opioid in the last 24 h or on active orders'
  };
  function render(el, res) {
    const groups = ['Early warning signs', 'Opioid exposure', 'Other sedating medications', 'Patient factors'];
    const fl = (g) => res.flags.filter((f) => f.group === g);
    const timeFmt = (t) => new Date(t).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    el.innerHTML = `
      <section class="op-summary op-${res.tier}">
        <div class="op-tier">${esc(TIER_TEXT[res.tier])}</div>
        ${res.tier !== 'none' ? `<div class="op-score">${res.points} points${res.hard.length ? ' · ' + res.hard.length + ' red-flag finding' + (res.hard.length > 1 ? 's' : '') : ''}</div>` : ''}
        <div class="op-mme">${res.haveMar
          ? `MME last 24 h <b>${res.mme.last24}</b> · previous 24 h ${res.mme.prev24}${res.mme.ordered != null ? ` · active orders allow up to ${res.mme.ordered}/day` : ''}`
          : `MME: active orders allow up to <b>${res.mme.ordered != null ? res.mme.ordered : '—'}</b>/day (doses given not available)`}</div>
      </section>
      ${res.prompts.length ? `<section class="op-prompts">${res.prompts.map((p) => `<div>• ${esc(p)}</div>`).join('')}</section>` : ''}
      <div class="op-grid">
        ${groups.map((g) => `<section class="op-card"><h3>${esc(g)}</h3>${fl(g).length
          ? '<ul>' + fl(g).map((f) => `<li class="${f.red ? 'red' : ''}"><span>${esc(f.text)}</span><b>${f.red ? 'RED' : '+' + f.pts}</b></li>`).join('') + '</ul>'
          : '<p class="op-none">Nothing found</p>'}</section>`).join('')}
      </div>
      <section class="op-card op-wide"><h3>Last ${CONFIG.windowHours} h: opioid doses, respiratory rate and SpO₂</h3>${timeline(res)}</section>
      <section class="op-card op-wide"><h3>Opioid and sedative doses given (last ${CONFIG.windowHours} h)</h3>${res.admins.filter((a) => a.drug || a.sed || a.naloxone).length
        ? `<table><thead><tr><th>Time</th><th>Medication</th><th>Dose</th><th>Route</th><th>MME</th></tr></thead><tbody>${
          res.admins.filter((a) => a.drug || a.sed || a.naloxone).slice().reverse().map((a) => `<tr class="${a.naloxone ? 'nal' : a.drug ? '' : 'sed'}">
            <td>${esc(timeFmt(a.t))}</td><td>${esc(a.name)}</td><td>${esc(a.dose)}</td><td>${esc(a.route)}</td><td>${a.mme != null ? round(a.mme, 1) : ''}</td></tr>`).join('')}</tbody></table>`
        : `<p class="op-none">${res.haveMar ? 'None recorded' : 'Medication administrations not available'}</p>`}</section>
      <section class="op-notes"><b>Data notes.</b> ${[...res.notes, ...(res.failed.length ? ['Could not load: ' + res.failed.join(', ') + '.'] : [])].map(esc).join(' ') || 'None.'}
        <br>Draft screening tool, not validated. MME factors are approximate (oral: CDC 2022) — check against the local conversion table.
        It supports, and does not replace, nursing assessment and continuous monitoring.</section>`;
  }

  // Small SVG: opioid doses as bars (height = MME), RR and SpO2 as lines, naloxone as markers.
  function timeline(res) {
    const W = 860, pad = 44, now = res.now, from = now - CONFIG.windowHours * HOUR;
    const x = (t) => pad + (t - from) / (now - from) * (W - pad - 10);
    const rows = [{ key: 'dose', h: 70, label: 'Opioid MME' }, { key: 'rr', h: 70, label: 'RR /min' }, { key: 'sp', h: 70, label: 'SpO₂ %' }];
    let y0 = 8, svg = '';
    const ticks = [];
    for (let t = Math.ceil(from / (12 * HOUR)) * 12 * HOUR; t <= now; t += 12 * HOUR) ticks.push(t);
    rows.forEach((row) => {
      const top = y0, bot = y0 + row.h;
      svg += `<text x="4" y="${top + 12}" class="lbl">${row.label}</text><line x1="${pad}" x2="${W - 10}" y1="${bot}" y2="${bot}" class="axis"/>`;
      ticks.forEach((t) => { svg += `<line x1="${x(t)}" x2="${x(t)}" y1="${top}" y2="${bot}" class="grid"/>`; });
      if (row.key === 'dose') {
        const max = Math.max(10, ...res.opAdmins.map((a) => a.mme || 0));
        res.opAdmins.forEach((a) => {
          const h = a.mme != null ? Math.max(3, (a.mme / max) * (row.h - 16)) : 6;
          svg += `<rect x="${x(a.t) - 3}" y="${bot - h}" width="6" height="${h}" class="${a.mme != null ? 'bar' : 'bar unk'}"><title>${esc(a.name)} ${esc(a.dose)}${a.mme != null ? ' = ' + round(a.mme, 1) + ' MME' : ''}</title></rect>`;
        });
        res.admins.filter((a) => a.naloxone).forEach((a) => { svg += `<text x="${x(a.t) - 5}" y="${top + 12}" class="nal">N</text>`; });
        res.admins.filter((a) => a.sed).forEach((a) => { svg += `<circle cx="${x(a.t)}" cy="${bot + 0}" r="3.5" class="sedm"><title>${esc(a.name)} ${esc(a.dose)}</title></circle>`; });
      } else {
        const s = row.key === 'rr' ? res.vitals.rr : res.vitals.spo2;
        const lo = row.key === 'rr' ? 4 : 80, hi = row.key === 'rr' ? 28 : 100;
        const y = (v) => bot - (Math.min(hi, Math.max(lo, v)) - lo) / (hi - lo) * (row.h - 8);
        const cut = row.key === 'rr' ? CONFIG.cut.rrRed : CONFIG.cut.spo2Red;
        svg += `<line x1="${pad}" x2="${W - 10}" y1="${y(cut)}" y2="${y(cut)}" class="cut"/><text x="${pad - 4}" y="${y(cut) + 4}" class="tick" text-anchor="end">${cut}</text>`;
        const pts = s.filter((p) => p.t >= from);
        if (pts.length) svg += `<polyline points="${pts.map((p) => x(p.t) + ',' + y(p.v)).join(' ')}" class="line"/>` +
          pts.map((p) => `<circle cx="${x(p.t)}" cy="${y(p.v)}" r="3" class="${p.v < cut ? 'dot low' : 'dot'}"><title>${p.v}</title></circle>`).join('');
        else svg += `<text x="${pad + 8}" y="${top + row.h / 2}" class="tick">No data</text>`;
      }
      y0 = bot + 14;
    });
    ticks.forEach((t) => { svg += `<text x="${x(t)}" y="${y0 + 2}" class="tick" text-anchor="middle">${new Date(t).toLocaleString([], { weekday: 'short', hour: '2-digit' })}</text>`; });
    return `<svg viewBox="0 0 ${W} ${y0 + 10}" class="op-svg" role="img" aria-label="Timeline of opioid doses, respiratory rate and oxygen saturation">${svg}</svg>
      <div class="op-legend"><span class="k bar"></span>opioid dose (height = MME) <span class="k sedm"></span>sedative given <b class="nal">N</b> naloxone given <span class="k cut"></span>red-flag line</div>`;
  }

  async function mount(el, client, opts) {
    opts = opts || {};
    el.innerHTML = '<p class="op-none">Loading medications, vitals and labs…</p>';
    const data = opts.loader ? await opts.loader() : await load(client, opts);
    if (opts.now) data.now = opts.now;
    const res = assess(data);
    render(el, res);
    return res;
  }

  const OP = { CONFIG, load, assess, render, mount, _test: { opioidOf, sedativeOf, routeKind, dosesPerDay, ckdEpi2021 } };
  if (typeof module !== 'undefined' && module.exports) module.exports = OP; else root.OP = OP;
})(typeof window !== 'undefined' ? window : globalThis);
