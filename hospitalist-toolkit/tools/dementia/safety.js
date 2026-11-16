/* Don't-miss safety alerts and delirium/agitation guidance by dementia type. Uses globals from app.js. */
"use strict";
function medsMatching(re) { return S.meds.filter(m => re.test(m.name)).map(m => m.name); }
function dontMiss(R) {
  const fit = new Set(R.filter(r => r.lvl >= 2).map(r => r.id));
  const A = []; // {lvl:"bad"|"warn"|"info", t:string}
  const add = (lvl, t) => A.push({ lvl, t });
  const lewy = ["dlb", "pdd", "psp", "cbs", "msa"].some(x => fit.has(x)) || on("parkinsonism");
  const d2 = medsMatching(/haloperidol|loxapine|chlorpromazine|perphenazine|zuclopenthixol|methotrimeprazine|risperidone|olanzapine|metoclopramide|prochlorperazine|promethazine/i);
  const chei = medsMatching(/donepezil|rivastigmine|galantamine/i);
  const antichol = medHits().find(m => /anticholinergic/.test(m.cls));
  const benzo = medHits().find(m => /Benzo/.test(m.cls));
  const hr = V("hr"), hrv = hr ? Number(hr.value) : null;
  if (lewy) {
    if (d2.length) add("bad", `Lewy body / parkinsonian disorder with dopamine-blocking drug ordered: ${d2.join("; ")}. STOP — risk of severe rigidity, falls, NMS-like reactions and death. Use quetiapine 6.25–12.5 mg or a cholinesterase inhibitor for hallucinations; ondansetron or domperidone (check QTc) for nausea.`);
    else add("warn", "Lewy body / parkinsonian features: avoid haloperidol, typical antipsychotics, risperidone, olanzapine, metoclopramide and prochlorperazine. Put an alert/allergy-style note in the chart.");
  }
  const ldopa = medsMatching(/levodopa|sinemet|prolopa|rasagiline|pramipexole|ropinirole|rotigotine/i);
  if (ldopa.length) add("warn", `On Parkinson medication (${ldopa.join("; ")}): give on time, never stop abruptly (parkinsonism–hyperpyrexia syndrome, aspiration). If NPO: NG tube or ask neurology/pharmacy about a rotigotine patch.`);
  const cheiLikely = chei.length || ["ad", "dlb", "pdd", "vad", "mixed", "late"].some(x => fit.has(x));
  if (cheiLikely) add(hrv != null && hrv < 50 ? "bad" : "warn", `ECG before (or while on) a cholinesterase inhibitor: HR${hrv != null ? " " + hrv : " not found"}, PR interval, AV block, QTc. Avoid with HR <50, 2nd/3rd-degree block or sick sinus without pacemaker, or unexplained syncope.`);
  if (chei.length && antichol) add("bad", `Cholinesterase inhibitor + anticholinergic together (${chei.join("; ")} with ${antichol.meds.join("; ")}): they cancel each other out — often a prescribing cascade (ChEI → incontinence → antimuscarinic). Stop the anticholinergic.`);
  else if (antichol) add("warn", `Strong anticholinergic ordered (${antichol.meds.join("; ")}): worsens confusion, retention, constipation — deprescribe.`);
  if (benzo && !on("alcohol")) add("warn", `Benzodiazepine / Z-drug ordered (${benzo.meds.join("; ")}): worsens delirium, falls and memory — avoid unless alcohol/benzodiazepine withdrawal.`);
  if (chei.length && on("acute")) add("info", "Delirium on a cholinesterase inhibitor: continue it if the patient can swallow — stopping abruptly can worsen cognition and behaviour.");
  if (on("acute")) add("warn", "Delirium present: do not label dementia now; do not start new dementia drugs; avoid restraints and urinary catheters; look for retention, constipation, pain, infection, hypoxia, Na/glucose/Ca, drugs and withdrawal.");
  if (on("alcohol")) {
    const oral = medsMatching(/thiamine/i).filter(m => /\bPO\b|oral/i.test(m));
    add(oral.length ? "bad" : "warn", `Alcohol: thiamine IV before any glucose (e.g. 500 mg IV TID × 3 days if Wernicke possible)${oral.length ? ` — currently oral only (${oral.join("; ")}), poorly absorbed` : ""}. Watch for withdrawal (CIWA).`);
  }
  if (fit.has("ftd") && chei.length) add("bad", `Frontotemporal dementia on a cholinesterase inhibitor (${chei.join("; ")}): no benefit and can worsen agitation — stop.`);
  else if (fit.has("ftd")) add("info", "Frontotemporal dementia: do not start a cholinesterase inhibitor; SSRI/trazodone for behaviour; supervise finances, driving and food access.");
  if (fit.has("hd")) {
    const tbz = medsMatching(/tetrabenazine|deutetrabenazine/i);
    add(tbz.length && on("depression") ? "bad" : "warn", `Huntington disease: screen for suicide risk at every contact${tbz.length && on("depression") ? `; tetrabenazine with depression (${tbz.join("; ")}) — review with neurology/psychiatry` : ""}.`);
  }
  if (fit.has("msa") || on("autfail")) {
    const ab = medsMatching(/tamsulosin|alfuzosin|doxazosin|terazosin|prazosin|silodosin/i);
    add(ab.length ? "bad" : "warn", `Autonomic failure: orthostatic vitals each day; supine hypertension check${ab.length ? `; alpha-blocker ordered (${ab.join("; ")}) — stop or review` : ""}; review all BP-lowering drugs.`);
  }
  if (fit.has("als")) add("bad", "ALS: check CO2 (VBG/ABG) and FVC; hypercapnia causes confusion — treat with BiPAP, not sedatives or high-flow oxygen alone. Avoid respiratory depressants.");
  if (["psp", "als", "hd", "msa"].some(x => fit.has(x)) || on("bulbar") || findMatch(S.docs.map(d => d.text).join(" "), /dysphagia|choking on|aspiration|coughs? (?:with|when) (?:eating|drinking)/i))
    add("warn", "Swallowing risk: SLP assessment before oral diet and medications; crush/liquid forms if needed; aspiration precautions; avoid sedation at mealtimes.");
  if (fit.has("rpd")) add("bad", "Possible prion disease: notify infection prevention BEFORE LP, surgery or endoscopy (instrument handling).");
  if (fit.has("nph")) add("info", "Possible NPH: potentially reversible — arrange tap test/neurosurgery rather than attributing gait and incontinence to age.");
  const aab = medsMatching(/lecanemab|leqembi|donanemab|kisunla/i);
  if (aab.length) add("bad", `On anti-amyloid antibody (${aab.join("; ")}): new headache, confusion, seizures or focal signs = ARIA until proven otherwise → MRI. Thrombolysis is hazardous (bleeding) — involve neurology before tenecteplase.`);
  const cit = S.meds.map(m => m.name.match(/(?:es)?citalopram\D{0,6}(\d+)/i)).find(Boolean);
  if (cit && S.ageY >= 65 && /^citalopram/i.test(cit[0]) && Number(cit[1]) > 20) add("warn", `Citalopram ${cit[1]} mg in a patient ≥65: Health Canada maximum 20 mg/day (QT prolongation) — check ECG.`);
  const ap = medsMatching(/haloperidol|loxapine|risperidone|quetiapine|olanzapine|aripiprazole|brexpiprazole/i);
  if (ap.length && !lewy) add("info", `Antipsychotic in dementia (${ap.join("; ")}): increased stroke and mortality risk — lowest dose, shortest time, document indication, review every 1–2 days in hospital.`);
  return A;
}
const GENERAL_DONT_MISS = [
  "Delirium superimposed on dementia is common and is often hypoactive — screen every shift (CAM/4AT).",
  "Reversible contributors before labelling: B12, TSH, calcium, sodium, glucose, drugs, depression, hearing/vision, sleep apnea.",
  "ECG before a cholinesterase inhibitor; review rate-slowing drugs.",
  "Lewy body / Parkinson spectrum: no haloperidol, typical antipsychotics or metoclopramide.",
  "Never stop levodopa or a cholinesterase inhibitor abruptly in hospital.",
  "Driving: advise and document; report to RoadSafetyBC when required.",
  "Capacity and substitute decision-maker documented; goals of care discussed.",
  "Dysphagia screen in advanced dementia and in PSP, MSA, HD and ALS."
];

const AGITATION = [
  { ids: ["ad", "vad", "mixed", "late", "ppa"], title: "Alzheimer, vascular, mixed, LATE",
    prefer: ["Delirium (severe distress/danger only; NOT if any parkinsonism or Lewy features): haloperidol 0.25–0.5 mg PO/SC, or quetiapine 12.5–25 mg / risperidone 0.25 mg; reassess daily, stop when settled", "Chronic agitation: citalopram (≤20 mg/day if ≥65) or trazodone 25–50 mg; risperidone 0.25–1 mg (only Health Canada–indicated antipsychotic, short term, severe aggression)", "Pain trial: scheduled acetaminophen"],
    avoid: ["Benzodiazepines (except withdrawal)", "Anticholinergics (diphenhydramine, hydroxyzine)", "Long-term antipsychotics without review"] },
  { ids: ["dlb", "pdd", "mixed2"], title: "Lewy body dementia / Parkinson disease dementia",
    prefer: ["Look for and reduce dopamine agonists, amantadine, anticholinergics first; keep levodopa", "Cholinesterase inhibitor (rivastigmine/donepezil) — first-line for hallucinations and agitation", "Quetiapine 6.25–12.5 mg qHS (titrate slowly) if drug needed; clozapine only with specialist and CBC monitoring", "Melatonin for sleep/RBD"],
    avoid: ["Haloperidol and all typical antipsychotics", "Risperidone, olanzapine, aripiprazole (worsen parkinsonism)", "Metoclopramide, prochlorperazine, promethazine (antiemetics)", "Stopping levodopa"] },
  { ids: ["psp", "cbs", "msa"], title: "PSP, corticobasal syndrome, MSA",
    prefer: ["Non-drug first; treat pain, retention, constipation, orthostatic hypotension", "Low-dose quetiapine if needed", "Trazodone for sleep (watch orthostasis)"],
    avoid: ["Dopamine blockers (worsen rigidity and swallowing)", "Sedation around meals (aspiration)", "Anticholinergics"] },
  { ids: ["ftd"], title: "Frontotemporal dementia",
    prefer: ["Behaviour plan: routine, redirection, limit triggers and food access", "SSRI (citalopram, sertraline) or trazodone for disinhibition, compulsions, agitation", "Severe/dangerous: low-dose quetiapine or olanzapine short term (higher sensitivity to extrapyramidal effects)"],
    avoid: ["Cholinesterase inhibitors (can worsen agitation)", "Benzodiazepines (paradoxical disinhibition)", "Arguing or reasoning with lack of insight"] },
  { ids: ["hd"], title: "Huntington disease",
    prefer: ["Atypical antipsychotic (olanzapine, risperidone, aripiprazole) — also reduces chorea", "SSRI for irritability, depression, obsessions", "Suicide risk assessment; high-calorie diet; quiet, predictable environment"],
    avoid: ["Tetrabenazine if depressed or suicidal", "Dehydration and weight loss (worsen confusion)"] },
  { ids: ["als"], title: "ALS / ALS-FTD",
    prefer: ["Check CO2 and oxygenation first — hypercapnia causes agitation; BiPAP", "Low-dose quetiapine or SSRI for behaviour; palliative opioids for dyspnea when goals are comfort"],
    avoid: ["Benzodiazepines and opioids without a plan (respiratory depression)", "High-flow oxygen alone in hypercapnia"] },
  { ids: ["alc"], title: "Alcohol-related / Korsakoff",
    prefer: ["Thiamine IV before glucose", "Alcohol withdrawal: symptom-triggered benzodiazepine (lorazepam if liver disease) per CIWA", "Antipsychotic only as adjunct for hallucinosis"],
    avoid: ["Haloperidol alone in withdrawal (lowers seizure threshold, masks withdrawal)", "Glucose before thiamine"] },
  { ids: ["rpd"], title: "Rapidly progressive dementia / CJD",
    prefer: ["Myoclonus/agitation: clonazepam or levetiracetam", "Palliative approach once diagnosis is clear", "Treat autoimmune/infectious causes if found"],
    avoid: ["Procedures without infection-prevention notice"] },
  { ids: ["nph"], title: "Normal pressure hydrocephalus",
    prefer: ["Treat urinary retention/infection, constipation; falls precautions", "Standard approach as for Alzheimer if drug needed"],
    avoid: ["Antimuscarinics for incontinence (worsen cognition)"] }
];
function agitationHTML(R) {
  const fit = new Set(R.filter(r => r.lvl >= 2).map(r => r.id));
  const lewy = ["dlb", "pdd", "psp", "cbs", "msa", "mixed2"].some(x => fit.has(x)) || on("parkinsonism");
  const score = r => (lewy && /Lewy|PSP/.test(r.title) ? 2 : 0) + (r.ids.some(i => fit.has(i)) ? 1 : 0);
  const rows = AGITATION.slice().sort((a, b) => score(b) - score(a));
  return `${lewy ? '<div class="banner bad" style="margin-top:8px"><b>Lewy body / parkinsonian features present:</b> the Lewy/PSP rows override every other row — no haloperidol, typical antipsychotics, risperidone, olanzapine or metoclopramide, even if another type also fits.</div>' : ""}
    <h3>All types — delirium first steps</h3>
    <ol class="small">
      <li><b>Find the cause</b>: infection, urinary retention (bladder scan), constipation, pain, hypoxia/hypercapnia, Na/Ca/glucose, new drugs, withdrawal (alcohol, benzodiazepines, SSRIs), sleep deprivation.</li>
      <li><b>Non-drug bundle</b>: family presence, reorientation, glasses and hearing aids, daylight and sleep at night, mobilize, hydrate, remove tethers (catheters, lines), no physical restraints, one-to-one if needed.</li>
      <li><b>Continue</b> home cholinesterase inhibitor and Parkinson drugs; stop deliriogenic drugs (anticholinergics, benzodiazepines, opioid excess).</li>
      <li><b>Drug only for severe distress or danger</b>: lowest dose, by type (below), review daily, stop as soon as settled, document indication and consent conversation.</li>
    </ol>
    <table><tr><th>Type</th><th>Prefer</th><th>Avoid</th></tr>
    ${rows.map(r => `<tr${r.ids.some(i => fit.has(i)) ? ' style="background:#e6f4ec"' : ""}><td><b>${esc(r.title)}</b>${r.ids.some(i => fit.has(i)) ? '<br><span class="pill ok">fits this patient</span>' : ""}</td>
      <td class="small"><ul>${r.prefer.map(x => `<li>${esc(x)}</li>`).join("")}</ul></td><td class="small"><ul>${r.avoid.map(x => `<li>${esc(x)}</li>`).join("")}</ul></td></tr>`).join("")}</table>
    <p class="small muted">Doses are typical starting doses for frail older adults; check renal/hepatic function, QTc and the product monograph.</p>`;
}
