// Cryoneurolysis SMART on FHIR tab — Hospitalist Toolkit
// Works with a Cerner SMART launch, or in demo mode when opened without one.
(function () {
  const $ = (id) => document.getElementById(id);
  const S = { pt: null, conds: [], meds: [], obs: [], allergies: [] };

  // ---------- tabs ----------
  document.querySelectorAll('#nav button').forEach((b) =>
    b.addEventListener('click', () => {
      document.querySelectorAll('#nav button').forEach((x) => x.classList.remove('on'));
      document.querySelectorAll('.tab').forEach((x) => x.classList.remove('on'));
      b.classList.add('on');
      $(b.dataset.t).classList.add('on');
    })
  );

  // ---------- keyword sets ----------
  const RX = {
    spasCause: /stroke|cerebral infarct|cva|hemipleg|hemipar|traumatic brain|tbi|spinal cord injur|tetrapleg|quadripleg|parapleg|multiple sclerosis|cerebral palsy|anoxic brain/i,
    spasticity: /spastic|contracture|clonus|equinovarus|hypertonia|dystonia/i,
    kneeOA: /(osteoarthritis|oa|gonarthrosis|degenerative).*(knee)|(knee).*(osteoarthritis|arthrosis)/i,
    tka: /total knee|knee arthroplasty|tka/i,
    hipfx: /hip fracture|femoral neck fracture|intertrochanteric|subcapital|proximal femur fracture|fracture of (the )?neck of femur/i,
    shoulder: /shoulder pain|hemiplegic shoulder|frozen shoulder|adhesive capsulitis/i,
    coldCI: /cold urticaria|cryoglobulin|cold agglutinin|paroxysmal cold/i,
    raynaud: /raynaud/i,
    bleed: /hemophilia|von willebrand|thrombocytopeni|coagulopathy|bleeding disorder/i,
    central: /central pain|fibromyalgia|thalamic pain|complex regional/i,
    anticoag: /apixaban|rivaroxaban|edoxaban|dabigatran|warfarin|heparin|enoxaparin|dalteparin|tinzaparin|fondaparinux/i,
    antiplt: /clopidogrel|ticagrelor|prasugrel/i,
    botox: /botulinum|onabotulinum|abobotulinum|incobotulinum|botox|dysport|xeomin/i,
    oralSpas: /baclofen|tizanidine|dantrolene/i,
    opioid: /morphine|hydromorphone|oxycodone|fentanyl|tramadol|codeine|methadone|tapentadol/i,
  };

  const text = (cc) => (cc && (cc.text || (cc.coding || []).map((c) => c.display).join(' '))) || '';

  // ---------- load ----------
  async function load() {
    let client = null;
    try { client = await FHIR.oauth2.ready(); } catch (e) { client = null; }
    if (!client) return demo();
    try {
      const pid = client.patient.id;
      const [pt, conds, meds, plt, inr, alg] = await Promise.all([
        client.patient.read(),
        client.request(`Condition?patient=${pid}&_count=200`, { flat: true, pageLimit: 3 }),
        client.request(`MedicationRequest?patient=${pid}&_count=200`, { flat: true, pageLimit: 3 }),
        client.request(`Observation?patient=${pid}&code=http://loinc.org|777-3,http://loinc.org|26515-7&_sort=-date&_count=5`, { flat: true }).catch(() => []),
        client.request(`Observation?patient=${pid}&code=http://loinc.org|6301-6,http://loinc.org|34714-6&_sort=-date&_count=5`, { flat: true }).catch(() => []),
        client.request(`AllergyIntolerance?patient=${pid}`, { flat: true }).catch(() => []),
      ]);
      S.pt = pt;
      S.conds = conds.filter((c) => c.resourceType === 'Condition').map((c) => text(c.code));
      S.meds = meds.filter((m) => m.resourceType === 'MedicationRequest' && (!m.status || ['active', 'on-hold', 'draft'].includes(m.status)))
        .map((m) => text(m.medicationCodeableConcept) || (m.medicationReference && m.medicationReference.display) || '');
      const val = (o) => (o && o.valueQuantity ? o.valueQuantity.value : null);
      S.obs = { plt: val(plt.find((o) => o.resourceType === 'Observation')), inr: val(inr.find((o) => o.resourceType === 'Observation')) };
      S.allergies = alg.filter((a) => a.resourceType === 'AllergyIntolerance').map((a) => text(a.code));
      render();
    } catch (e) {
      $('screenOut').innerHTML = `<div class="flag r">FHIR read failed: ${e.message}. Showing demo patient.</div>`;
      demo();
    }
  }

  function demo() {
    S.pt = { name: [{ given: ['Demo'], family: 'Patient' }], birthDate: '1952-04-10', gender: 'male', identifier: [{ value: 'MRN-DEMO' }] };
    S.conds = ['Cerebral infarction, left MCA', 'Spastic hemiparesis right side', 'Hemiplegic shoulder pain', 'Atrial fibrillation'];
    S.meds = ['apixaban 5 mg PO BID', 'baclofen 10 mg PO TID', 'onabotulinumtoxinA 300 units IM q3mo'];
    S.obs = { plt: 212, inr: 1.1 };
    S.allergies = [];
    render(true);
  }

  // ---------- helpers ----------
  function age(bd) { if (!bd) return '?'; const d = new Date(bd), n = new Date(); let a = n.getFullYear() - d.getFullYear(); if (n < new Date(n.getFullYear(), d.getMonth(), d.getDate())) a--; return a; }
  function ptName() { const n = (S.pt.name || [])[0] || {}; return n.text || `${(n.given || []).join(' ')} ${n.family || ''}`.trim(); }
  function mrn() { const i = (S.pt.identifier || []).find((x) => /mrn/i.test((x.type && text(x.type)) || '')) || (S.pt.identifier || [])[0]; return i ? i.value : '—'; }
  const any = (arr, rx) => arr.filter((s) => rx.test(s));
  const flag = (cls, html) => `<div class="flag ${cls}">${html}</div>`;

  // ---------- render chart screen ----------
  function render(isDemo) {
    $('ptbar').textContent = `${ptName()} · ${age(S.pt.birthDate)} y · ${S.pt.gender || ''} · MRN ${mrn()}${isDemo ? '  (DEMO – no SMART launch)' : ''}`;
    const C = S.conds, M = S.meds, A = S.allergies;
    let out = '';

    // indications
    const cause = any(C, RX.spasCause), spas = any(C, RX.spasticity), knee = any(C, RX.kneeOA), tka = any(C, RX.tka), hip = any(C, RX.hipfx), sh = any(C, RX.shoulder);
    const bot = any(M, RX.botox), oral = any(M, RX.oralSpas);
    if (spas.length || (cause.length && (bot.length || oral.length))) {
      out += flag('g', `<b>Possible candidate — focal spasticity.</b> ${[...cause, ...spas].join('; ')}${bot.length ? `<br>On botulinum toxin (${bot.join(', ')}) → ask if it wears off / has plateaued: cryoneurolysis is a longer-lasting option.` : ''}${oral.length ? `<br>Oral antispasticity: ${oral.join(', ')}.` : ''}<br>Next: VGH Peripheral Nerve &amp; Spasticity Clinic referral (see <i>How to get it</i>).`);
    } else if (cause.length) {
      out += flag('b', `Neuro diagnosis present (${cause.join('; ')}) but no spasticity coded. Examine for focal tone, clonus, clenched hand, equinovarus.`);
    }
    if (sh.length) out += flag('g', `<b>Shoulder pain:</b> ${sh.join('; ')} — suprascapular ± lateral pectoral cryoneurolysis has been used for hemiplegic shoulder pain.`);
    if (knee.length) out += flag('g', `<b>Knee OA:</b> ${knee.join('; ')} — genicular nerve cryoneurolysis gives relief for about 3 months; repeatable.`);
    if (tka.length) out += flag('b', `<b>TKA in chart:</b> ${tka.join('; ')} — pre-op cryoneurolysis reduces post-op pain/opioids for ~12 weeks (pre-op timing only).`);
    if (hip.length) out += flag('y', `<b>Hip fracture:</b> ${hip.join('; ')} — if going to surgery use standard fascia iliaca/PENG block. If non-operative/palliative, cryo-PENG has case-report support only: discuss with Acute Pain Service.`);

    // cautions
    const ci = [...any(C, RX.coldCI), ...any(A, RX.coldCI)];
    if (ci.length) out += flag('r', `<b>Contraindication:</b> ${ci.join('; ')} (cold-induced disorder).`);
    const ray = any(C, RX.raynaud); if (ray.length) out += flag('y', `<b>Caution:</b> ${ray.join('; ')}.`);
    const bl = any(C, RX.bleed), ac = any(M, RX.anticoag), ap = any(M, RX.antiplt);
    if (bl.length || ac.length || ap.length) out += flag('y', `<b>Bleeding risk:</b> ${[...bl, ...ac, ...ap].join('; ')} — proceduralist to advise on holding (deep targets e.g. obturator/PENG carry more risk than superficial).`);
    if (S.obs.plt != null) out += flag(S.obs.plt < 50 ? 'r' : S.obs.plt < 100 ? 'y' : 'g', `Platelets ${S.obs.plt}`);
    if (S.obs.inr != null) out += flag(S.obs.inr > 1.5 ? 'y' : 'g', `INR ${S.obs.inr}`);
    const cen = any(C, RX.central); if (cen.length) out += flag('y', `<b>Less likely to help:</b> ${cen.join('; ')} — central/diffuse pain has no single nerve target.`);
    const op = any(M, RX.opioid); if (op.length && (knee.length || hip.length || sh.length)) out += flag('b', `On opioids (${op.join(', ')}) — a nerve-targeted option could be opioid-sparing.`);

    if (!out) out = flag('b', 'No coded indication found. Use the bedside check below.');
    $('screenOut').innerHTML = out + `<p class="mut">Problems read: ${C.length} · Active meds: ${M.length}</p>`;
    buildConsult();
  }

  // ---------- bedside check ----------
  function bedside() {
    const p = $('selProb').value, d = $('selDNB').value, b = $('selBot').value;
    let h = '';
    const map = {
      spas: ['g', 'Good fit if the problem is focal and goal-directed (hygiene, brace, gait, transfers).'],
      spaspain: ['g', 'Reasonable — target sensory/mixed nerves to the joint (suprascapular, genicular).'],
      kneeoa: ['g', 'RCT-supported: expect ~3 months relief, repeatable.'],
      tka: ['g', 'Do it 1–2 weeks before surgery for post-op pain benefit.'],
      hipfx: ['y', 'Only for non-operative/palliative cases; case-report evidence. Ask Acute Pain Service.'],
      genspas: ['r', 'Generalized: oral agents or intrathecal baclofen usually better.'],
      fixed: ['r', 'Fixed contracture will not respond — casting/surgery.'],
      diffuse: ['r', 'No peripheral target — unlikely to help.'],
    };
    if (map[p]) h += flag(map[p][0], map[p][1]);
    if (d === 'yes') h += flag('g', 'Reducible on DNB → spasticity component present; this is the main predictor of response.');
    if (d === 'no') h += flag('r', 'No lengthening on DNB → true contracture; cryoneurolysis unlikely to change range.');
    if (d === '' && ['spas', 'spaspain', 'fixed'].includes(p)) h += flag('b', 'DNB not done — the spasticity clinic will do lidocaine diagnostic blocks first.');
    if (b === 'good') h += flag('g', 'Botulinum works but wears off → strong case for a longer-lasting option.');
    if (b === 'poor') h += flag('g', 'Plateaued/refractory to botulinum → VGH cohort showed benefit up to 1 year in this group.');
    $('bedsideOut').innerHTML = h;
  }
  ['selProb', 'selDNB', 'selBot'].forEach((id) => $(id).addEventListener('change', bedside));

  // ---------- timing ----------
  const TIME = {
    spas: { onset: 'Immediate — tone drops on the table (motor block from the freeze), then Wallerian degeneration.', dur: 'Sustained at 12 months in VGH cohorts; case reports to 15–17 months. Range-of-motion gains can outlast nerve regrowth.', n: 'Usually 1 session (multiple nerves at once). Average under 1 treatment per year; repeat only if tone returns. Extra cycle sometimes given for early nerve pain.', pre: '1+ lidocaine diagnostic nerve blocks first.' },
    spaspain: { onset: 'Immediate to days.', dur: 'Months; VGH reports durable benefit to 1 year in many.', n: '1 session, repeat as needed.', pre: 'Diagnostic block to confirm the pain generator.' },
    kneeoa: { onset: 'Immediate (same day).', dur: 'About 90 days; responders still better at ~day 150.', n: 'Repeat every ~3–6 months when pain returns (case reports of 3+ repeat treatments).', pre: 'Usually none; some use a test block.' },
    tka: { onset: 'Done 3–7 days (up to ~2 weeks) before surgery.', dur: 'Lower pain and opioid use to ~12 weeks after surgery.', n: 'Single pre-op treatment.', pre: 'None.' },
    hipfx: { onset: 'Immediate after the freeze.', dur: 'Weeks–months in case reports (enough for palliative mobilization).', n: 'Single treatment; can be repeated.', pre: 'Local anesthetic PENG block first to confirm relief.' },
  };
  function timing() {
    const t = TIME[$('selTime').value];
    $('timeOut').innerHTML = `<table><tr><th>When does it start working?</th><td>${t.onset}</td></tr><tr><th>How long does it last?</th><td>${t.dur}</td></tr><tr><th>How many treatments?</th><td>${t.n}</td></tr><tr><th>Before treatment</th><td>${t.pre}</td></tr></table>`;
  }
  $('selTime').addEventListener('change', timing); timing();

  // ---------- consult ----------
  function buildConsult() {
    if (!S.pt) return;
    const probs = S.conds.slice(0, 3).join(', ');
    const bot = any(S.meds, RX.botox).length ? ' Has had botulinum toxin.' : '';
    const ac = any(S.meds, RX.anticoag).length ? ' On anticoagulation.' : '';
    $('cMsg').value = `Hello Dr. ${$('cDr').value}, This is Wayne, hospitalist. I have ${ptName()}, ${age(S.pt.birthDate)}, MRN ${mrn()}, with ${probs}. Main issue: ${$('cGoal').value}.${bot}${ac} Would they be a candidate for cryoneurolysis assessment? Your help is much appreciated. Thanks, Wayne`;
  }
  ['cDr', 'cGoal'].forEach((id) => $(id).addEventListener('input', buildConsult));
  $('cCopy').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText($('cMsg').value); $('cDone').textContent = 'Copied'; }
    catch { $('cMsg').select(); document.execCommand('copy'); $('cDone').textContent = 'Copied'; }
  });

  const launched = typeof FHIR !== 'undefined' &&
    (location.search.includes('code=') || location.search.includes('complete=') || sessionStorage.getItem('SMART_KEY'));
  if (launched) load(); else demo();
})();
