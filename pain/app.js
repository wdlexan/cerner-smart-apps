/* Pain Management – SMART on FHIR (Cerner)
 * Reads problems, labs, vitals, active meds and notes; builds a risk context; parses current analgesics (MME);
 * judges each drug class OK / caution / avoid; builds acute and chronic plans; opioid conversion and taper tools; note draft.
 * Open index.html?demo=1 … (or with no FHIR context) for made-up test patients.
 * MME factors match the toolkit's Opioid safety tab (CDC 2022 oral; parenteral are common ratios — check local table). */
"use strict";
const S = { mode: "fhir", patient: null, ageY: null, sex: null, conds: [], labs: [], vitals: [], meds: [], docs: [], feat: {}, inp: { nrs: "", peg: "" }, noteEdited: false };
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const round = (x, d = 0) => x == null || isNaN(x) ? "?" : Number(x).toFixed(d).replace(/\.0+$/, "");

/* ------------------------------------------------------------ MME config */
const MME = {
  morphine: { oral: 1, par: 3 }, hydromorphone: { oral: 5, par: 20 }, oxycodone: { oral: 1.5 }, hydrocodone: { oral: 1 }, codeine: { oral: 0.15 },
  tramadol: { oral: 0.2 }, tapentadol: { oral: 0.4 }, oxymorphone: { oral: 3 }, meperidine: { oral: 0.1, par: 0.4 }, fentanyl: { par: 300 }, methadone: { oral: 4.7 }
};
const FENT_PATCH = 2.4; // MME/day per mcg/h
const OPIOID_NAMES = [
  ["hydromorphone", /hydromorph|dilaudid/i], ["oxycodone", /oxycod|percocet|oxyneo|oxycontin|endocet/i], ["morphine", /morphine|m-eslon|kadian|statex/i],
  ["fentanyl", /fentanyl|duragesic/i], ["methadone", /methadone|metadol/i], ["buprenorphine", /buprenorph|suboxone|butrans|sublocade|probuphine/i],
  ["tramadol", /tramadol|tramacet|ultram|zytram|durela/i], ["tapentadol", /tapentadol|nucynta/i], ["codeine", /codeine|tylenol\s*#?\s*[234]|tylenol with codeine/i],
  ["hydrocodone", /hydrocodone/i], ["meperidine", /meperidine|pethidine|demerol/i], ["oxymorphone", /oxymorphone/i]
];

/* --------------------------------------------------------- pain features */
const FEATURES = [
  { id: "acute", g: "Timeline", label: "Acute pain (surgery, fracture, injury, colic, flare)", re: /post-?op|postoperative|fracture|trauma|injur|renal colic|pancreatitis|gout flare|acute (?:\w+ )?pain|cholecystitis|zoster|shingles/i },
  { id: "chronic", g: "Timeline", label: "Chronic pain (>3 months)", re: /chronic (?:\w+ ){0,2}pain|for (?:\d+|several|many) (?:years|months) of pain|(?:years|months) of (?:\w+ )?pain|fibromyalgia|long-?standing pain|chronic pain syndrome/i },
  { id: "cancer", g: "Timeline", label: "Cancer-related pain", re: /metasta|malignan|carcinoma|lymphoma|myeloma|cancer pain|sarcoma/i, cond: true },
  { id: "oudf", g: "Timeline", label: "Opioid use disorder / on opioid agonist therapy", re: /opioid use disorder|\bOUD\b|opioid agonist (?:treatment|therapy)|\bOAT\b|methadone maintenance|suboxone|buprenorphine-naloxone/i, cond: true },
  { id: "noci", g: "Pain type", label: "Nociceptive – somatic (bone, joint, muscle, incision)", re: /fracture|osteoarthritis|\bOA\b|sprain|incision|post-?op|wound|arthroplasty|rib/i, cond: true },
  { id: "visceral", g: "Pain type", label: "Nociceptive – visceral (colicky, poorly localized)", re: /pancreatitis|renal colic|biliary colic|bowel obstruction|cholecystitis|abdominal pain|visceral/i, cond: true },
  { id: "neuro", g: "Pain type", label: "Neuropathic (burning, shooting, electric, numbness, allodynia)", re: /neuropath|radicul|sciatica|post-?herpetic|zoster|shingles|burning|shooting|electric|allodynia|numbness and tingling|trigeminal neuralgia|nerve pain/i, cond: true },
  { id: "nociplastic", g: "Pain type", label: "Nociplastic (widespread, fibromyalgia, central sensitization)", re: /fibromyalgia|widespread pain|central sensiti/i, cond: true },
  { id: "inflam", g: "Pain type", label: "Inflammatory (gout, crystal, rheumatoid flare, PMR)", re: /gout|pseudogout|rheumatoid|polymyalgia|\bPMR\b|inflammatory arthritis/i, cond: true },
  { id: "bonemets", g: "Pain type", label: "Bone metastases / pathological fracture", re: /bone metasta|bony metasta|lytic lesion|osseous metasta|pathologic(?:al)? fracture|skeletal metasta/i, cond: true },
  { id: "hipfx", g: "Condition", label: "Hip fracture", re: /hip fracture|femoral neck fracture|intertrochanteric|subtrochanteric/i, cond: true },
  { id: "ribfx", g: "Condition", label: "Rib fractures", re: /rib fracture|fractured ribs|flail chest/i, cond: true },
  { id: "oa", g: "Condition", label: "Osteoarthritis", re: /osteoarthritis|\bOA\b (?:of the )?(?:knee|hip|hand)/i, cond: true },
  { id: "lbp", g: "Condition", label: "Low back pain", re: /low back pain|lumbar (?:spinal )?stenosis|\bLBP\b|lumbago|degenerative disc/i, cond: true },
  { id: "dpn", g: "Condition", label: "Diabetic or other peripheral neuropathy", re: /diabetic (?:peripheral )?neuropathy|peripheral neuropathy|polyneuropathy/i, cond: true },
  { id: "phn", g: "Condition", label: "Herpes zoster / post-herpetic neuralgia", re: /post-?herpetic|zoster|shingles/i, cond: true },
  { id: "tn", g: "Condition", label: "Trigeminal neuralgia", re: /trigeminal neuralgia/i, cond: true },
  { id: "gout", g: "Condition", label: "Gout flare", re: /gout/i, cond: true },
  { id: "fibro", g: "Condition", label: "Fibromyalgia", re: /fibromyalgia/i, cond: true },
  { id: "sickle", g: "Condition", label: "Sickle cell vaso-occlusive crisis", re: /sickle cell|vaso-?occlusive/i, cond: true },
  { id: "panc", g: "Condition", label: "Pancreatitis", re: /pancreatitis/i, cond: true },
  { id: "colic", g: "Condition", label: "Renal colic", re: /renal colic|ureteric stone|ureterolithiasis|nephrolithiasis/i, cond: true },
  { id: "cord", g: "Red flags", label: "Possible cord compression / cauda equina (new weakness, saddle anaesthesia, retention)", re: /cord compression|cauda equina|saddle an(?:a)?esthesia|new (?:bilateral )?leg weakness|weakness (?:of|in) (?:both )?legs/i },
  { id: "abscess", g: "Red flags", label: "Spinal infection risk (fever + back pain, injection drug use, bacteremia)", re: /epidural abscess|discitis|osteomyelitis|injection drug use|\bIVDU\b|\bPWID\b/i, cond: true },
  { id: "compart", g: "Red flags", label: "Pain out of proportion (compartment syndrome, ischemia, necrotizing infection)", re: /out of proportion|compartment syndrome|mesenteric ischemia|necrotizing/i },
  { id: "osa", g: "Opioid risk", label: "Sleep apnea", re: /sleep apn|\bOSA\b|CPAP/i, cond: true },
  { id: "copd", g: "Opioid risk", label: "COPD / hypercapnia", re: /\bCOPD\b|emphysema|hypercapni/i, cond: true },
  { id: "delirium", g: "Opioid risk", label: "Delirium", re: /\bdelirium\b|delirious|CAM (?:is )?positive/i },
  { id: "dementia", g: "Opioid risk", label: "Dementia / cognitive impairment", re: /dementia|alzheimer|cognitive impairment/i, cond: true },
  { id: "falls", g: "Opioid risk", label: "Falls", re: /\bfalls?\b|fell /i, cond: true },
  { id: "depression", g: "Opioid risk", label: "Depression / anxiety", re: /depress|anxiety/i, cond: true },
  { id: "alcohol", g: "Opioid risk", label: "Heavy alcohol use", re: /alcohol use disorder|alcohol dependence|heavy (?:alcohol|drinking|etoh)|etoh abuse|(?:\d+|several) (?:drinks|beers) (?:a|per) day/i, cond: true },
  { id: "seizure", g: "Opioid risk", label: "Seizure disorder", re: /seizure|epilep/i, cond: true }
];

/* ------------------------------------------------------------ helpers */
function codeText(cc) { if (!cc) return ""; return cc.text || (cc.coding || []).map(c => c.display).filter(Boolean).join(" / ") || ""; }
function codes(cc) { return (cc?.coding || []).map(c => c.code); }
function fmtDate(d) { return d ? String(d).slice(0, 10) : ""; }
const NEG = /\b(?:no|not|denies|denied|without|negative for|absence of|absent|ruled out|r\/o|nor|free of)\b[^.;:\n]{0,40}$/i;
function findMatch(text, re) {
  if (!text || !re) return null;
  text = String(text).replace(/\s+/g, " ");
  const g = new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g"); let m;
  while ((m = g.exec(text))) {
    if (!NEG.test(text.slice(Math.max(0, m.index - 45), m.index))) {
      const a = Math.max(0, m.index - 60), b = Math.min(text.length, m.index + m[0].length + 60);
      return (a > 0 ? "…" : "") + text.slice(a, b).trim() + (b < text.length ? "…" : "");
    }
    if (m[0].length === 0) g.lastIndex++;
  }
  return null;
}
function htmlToText(s) { if (!/<[a-z!/]/i.test(s)) return s; const d = document.createElement("div"); d.innerHTML = s.replace(/<(script|style)[\s\S]*?<\/\1>/gi, "").replace(/<br\s*\/?>/gi, "\n").replace(/<\/(p|div|li|tr|h\d)>/gi, "\n"); return d.textContent || ""; }
function normObs(o) {
  return { name: codeText(o.code), loinc: codes(o.code), date: o.effectiveDateTime || o.issued || "", value: o.valueQuantity?.value ?? (o.valueString ?? codeText(o.valueCodeableConcept)), unit: o.valueQuantity?.unit || "" };
}
const LABDEF = {
  egfr: [["33914-3", "62238-1", "98979-8", "48642-3", "48643-1", "88293-6"], /\beGFR\b|glomerular filtration/i], cr: [["2160-0", "38483-4"], /^creatinine/i],
  alt: [["1742-6", "1743-4"], /\bALT\b|alanine aminotransferase/i], bili: [["1975-2"], /bilirubin,? total|^total bilirubin|^bilirubin$/i], inr: [["6301-6", "34714-6"], /\bINR\b/i],
  alb: [["1751-7"], /^albumin/i], plt: [["777-3", "26515-7"], /platelet/i], na: [["2951-2", "2947-0"], /^sodium/i], qtc: [["8636-3", "8634-8"], /QTc/i],
  hr: [["8867-4"], /heart rate|pulse/i], wt: [["29463-7", "3141-9"], /^weight|body weight/i], rr: [["9279-1"], /resp(?:iratory)? rate/i], spo2: [["59408-5", "2708-6"], /SpO2|oxygen saturation/i]
};
function latest(id) {
  const [lo, re] = LABDEF[id];
  const hits = S.labs.concat(S.vitals).filter(o => (o.loinc || []).some(c => lo.includes(c)) || re.test(o.name || "")).filter(o => o.value !== "" && o.value != null && !isNaN(Number(o.value)));
  hits.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  return hits[0] || null;
}
const num = id => { const o = latest(id); return o ? Number(o.value) : null; };

/* ---------------------------------------------------------- FHIR loading */
async function loadFHIR() {
  const client = await FHIR.oauth2.ready(); const pid = client.patient.id;
  const rq = (u, pages = 3) => client.request(u, { pageLimit: pages, flat: true }).catch(e => { console.warn(u, e); return []; });
  const [pt, conds, labs, vit, meds, docs] = await Promise.all([client.patient.read(), rq(`Condition?patient=${pid}&_count=100`),
    rq(`Observation?patient=${pid}&category=laboratory&_count=100`, 6), rq(`Observation?patient=${pid}&category=vital-signs&_count=100`, 2),
    rq(`MedicationRequest?patient=${pid}&status=active&_count=100`), rq(`DocumentReference?patient=${pid}&_count=50`, 2)]);
  S.patient = pt;
  S.conds = conds.filter(c => c.resourceType === "Condition").map(c => ({ text: codeText(c.code), status: c.clinicalStatus?.coding?.[0]?.code || "" }));
  S.labs = labs.filter(o => o.resourceType === "Observation").map(normObs);
  S.vitals = vit.filter(o => o.resourceType === "Observation").flatMap(o => [normObs(o), ...(o.component || []).map(c => ({ ...normObs(o), name: codeText(c.code), loinc: codes(c.code), value: c.valueQuantity?.value, unit: c.valueQuantity?.unit }))]);
  S.meds = meds.filter(m => m.resourceType === "MedicationRequest").map(m => {
    const name = codeText(m.medicationCodeableConcept) || m.medicationReference?.display || "Medication";
    const sig = (m.dosageInstruction || []).map(d => d.text).filter(Boolean).join("; ");
    return { name: sig && !name.includes(sig) ? `${name} ${sig}` : name };
  });
  const docList = docs.filter(d => d.resourceType === "DocumentReference").sort((a, b) => (b.date || "").localeCompare(a.date || "")).slice(0, 25);
  S.docs = (await Promise.all(docList.map(async d => ({ date: d.date || "", title: codeText(d.type) || "Note", text: await readAttachment(client, (d.content || []).map(c => c.attachment)) })))).filter(d => d.text);
}
async function readAttachment(client, atts) {
  for (const a of (atts || []).filter(Boolean)) {
    try {
      if (a.data) return htmlToText(decodeURIComponent(escape(atob(a.data))));
      if (a.url && /text|html|xml/i.test(a.contentType || "text")) { const r = await client.request({ url: a.url, headers: { Accept: a.contentType || "text/plain" } }); if (typeof r === "string") return htmlToText(r).slice(0, 60000); }
    } catch (e) { console.warn(e); }
  }
  return "";
}
function loadDemo(n) {
  S.mode = "demo"; const all = window.PAIN_DEMOS || []; const i = Math.min(Math.max(1, n || 1), all.length) - 1, P = all[i];
  S.demoIndex = i + 1; S.demo = P; const d = k => new Date(Date.now() - k * 864e5).toISOString();
  S.patient = { name: [{ text: P.name + " (made-up patient)" }], gender: P.sex, birthDate: P.birthDate };
  S.conds = P.conds.map(t => ({ text: t, status: "active" }));
  S.labs = P.labs.map(([name, l, value, unit]) => ({ name, loinc: [l], value, unit, date: d(1) }));
  S.vitals = [["Heart Rate", "8867-4", P.hr, "bpm"], ["Weight", "29463-7", P.wt, "kg"], ["Respiratory Rate", "9279-1", P.rr || 16, "/min"], ["SpO2", "59408-5", P.spo2 || 95, "%"]].map(([name, l, value, unit]) => ({ name, loinc: [l], value, unit, date: d(0) }));
  S.meds = P.meds.map(m => ({ name: m }));
  S.docs = P.docs.map(x => ({ date: d(x.d), title: x.title, text: x.text }));
}

/* ------------------------------------------------------- med parsing */
function parseMed(t) {
  const o = { text: t };
  for (const [k, re] of OPIOID_NAMES) if (re.test(t)) { o.opioid = k; break; }
  o.route = /\bpatch\b|transdermal|mcg\s*\/\s*h(?:r|our)?\b/i.test(t) ? "patch" : /\b(?:IV|SC|SQ|IM|subcut\w*|intraven\w*|sub-?q)\b/i.test(t) ? "par" : "oral";
  let mg = (t.match(/(\d+(?:\.\d+)?)\s*mg\b/i) || [])[1];
  if (!mg && /percocet|endocet/i.test(t)) mg = 5;
  if (!mg && /tylenol\s*#?\s*3/i.test(t)) mg = 30;
  if (!mg && /tylenol\s*#?\s*4/i.test(t)) mg = 60;
  const mcg = (t.match(/(\d+(?:\.\d+)?)\s*mcg\b(?!\s*\/\s*h)/i) || [])[1];
  if (!mg && mcg) mg = Number(mcg) / 1000;
  o.mg = mg != null ? Number(mg) : null;
  const tabs = (t.match(/(\d+(?:\.\d+)?)\s*tabs?\b/i) || [])[1]; if (tabs && o.mg) o.mg *= Number(tabs);
  o.mcgh = Number((t.match(/(\d+(?:\.\d+)?)\s*mcg\s*\/\s*h/i) || [])[1]) || null;
  const q = t.match(/\bq\s*(\d+)\s*(?:-\s*\d+\s*)?h(?:r|ours?)?\b/i);
  o.freq = q ? 24 / Number(q[1]) : /\bQID\b|four times/i.test(t) ? 4 : /\bTID\b|three times/i.test(t) ? 3 : /\bBID\b|twice/i.test(t) ? 2 : /\b(?:daily|qd|once|q\s*AM|qHS|at bedtime|nightly|q24h|weekly)\b/i.test(t) ? (/weekly/i.test(t) ? 1 / 7 : 1) : null;
  o.prn = /\bPRN\b|as needed/i.test(t);
  o.la = /\b(?:CR|ER|SR|XR|XL|LA|contin|oxyneo|oxycontin|kadian|m-eslon|zytram|durela|nucynta (?:CR|ER))\b/i.test(t) || o.route === "patch" || o.opioid === "methadone";
  if (o.opioid) {
    if (o.route === "patch" && o.opioid === "fentanyl") o.mme = o.mcgh ? o.mcgh * FENT_PATCH : null;
    else if (o.opioid === "buprenorphine") o.mme = null;
    else { const f = MME[o.opioid]; const fac = f && (o.route === "par" ? f.par : f.oral); o.mme = fac != null && o.mg != null && o.freq != null ? o.mg * o.freq * fac : null; }
  }
  // acetaminophen content
  let apap = /acetaminophen|paracetamol|tylenol|percocet|endocet|tramacet/i.test(t) ? 0 : null;
  if (apap === 0) {
    if (/percocet|endocet/i.test(t)) apap = 325 * (Number(tabs) || 1); else if (/tylenol\s*#?\s*[234]/i.test(t)) apap = 300 * (Number(tabs) || 1); else if (/tramacet/i.test(t)) apap = 325;
    else apap = (o.opioid ? null : o.mg) || (/(\d+(?:\.\d+)?)\s*g\b/i.test(t) ? Number(t.match(/(\d+(?:\.\d+)?)\s*g\b/i)[1]) * 1000 : 0);
    o.apapDay = apap && o.freq ? apap * o.freq : 0;
  }
  o.daily = o.mg != null && o.freq != null ? o.mg * o.freq : null;
  return o;
}
const RX = {
  benzo: /lorazepam|clonazepam|diazepam|alprazolam|oxazepam|temazepam|midazolam|chlordiazepoxide|zopiclone|zolpidem/i,
  gabap: /gabapentin|pregabalin|lyrica|neurontin/i, naloxone: /naloxone(?!.*bupren)|narcan/i, bowel: /senn|polyethylene glycol|\bPEG\b|lactulose|bisacodyl|picosulfate|methylnaltrexone|naloxegol/i,
  anticoag: /apixaban|rivaroxaban|edoxaban|dabigatran|warfarin|heparin|enoxaparin|dalteparin|tinzaparin/i, antiplatelet: /aspirin|\bASA\b|clopidogrel|ticagrelor|prasugrel/i,
  acei: /pril\b|sartan\b|sacubitril/i, diuretic: /furosemide|hydrochlorothiazide|chlorthalidone|indapamide|spironolactone|bumetanide|torsemide|eplerenone/i,
  steroid: /prednisone|dexamethasone|methylprednisolone|hydrocortisone/i, ppi: /prazole/i,
  serotonergic: /sertraline|citalopram|escitalopram|fluoxetine|paroxetine|fluvoxamine|venlafaxine|desvenlafaxine|duloxetine|linezolid|methylene blue|phenelzine|tranylcypromine|moclobemide|selegiline|rasagiline|lithium|triptan\b|sumatriptan|rizatriptan|trazodone|amitriptyline|nortriptyline|clomipramine/i,
  nsaid: /ibuprofen|naproxen|diclofenac(?!.*(?:gel|topical))|ketorolac|celecoxib|meloxicam|indomethacin|ketoprofen/i,
  tca: /amitriptyline|nortriptyline|imipramine|desipramine|doxepin|clomipramine/i, relax: /cyclobenzaprine|methocarbamol|orphenadrine|baclofen|tizanidine|carisoprodol/i,
  oatMed: /suboxone|buprenorphine-naloxone|sublocade|methadone.*(?:OAT|maintenance|opioid use)|methadone \d+\s*mg (?:PO|oral) (?:daily|once)/i
};
function medsBy(re) { return S.meds.filter(m => re.test(m.name)).map(m => m.name); }

/* ------------------------------------------------------- patient context */
const on = id => !!S.feat[id]?.on;
function ctx() {
  const C = {};
  C.age = S.ageY; C.sex = S.sex; C.wt = num("wt");
  C.egfr = num("egfr"); C.cr = num("cr");
  if (C.egfr == null && C.cr && C.wt && C.age) { let cr = latest("cr"); let c = Number(cr.value); if (/mg/i.test(cr.unit)) c *= 88.4; C.egfr = Math.round(((140 - C.age) * C.wt * 1.23) / c * (C.sex === "female" ? 0.85 : 1)); C.egfrIsCrcl = true; }
  if (C.egfr != null) C.egfr = Math.round(C.egfr);
  C.alt = num("alt"); C.bili = num("bili"); C.inr = num("inr"); C.plt = num("plt"); C.na = num("na"); C.qtc = num("qtc"); C.rr = num("rr"); C.spo2 = num("spo2"); C.hr = num("hr");
  const condTxt = S.conds.filter(c => !/resolved|inactive|entered/i.test(c.status)).map(c => c.text).join("\n");
  const notes = S.docs.map(d => d.text).join("\n");
  const has = re => !!(findMatch(condTxt, re) || findMatch(notes, re));
  C.hf = has(/heart failure|\bHFrEF\b|\bHFpEF\b|\bCHF\b|cardiomyopathy/i); C.cad = has(/coronary|\bCAD\b|myocardial infarction|\bNSTEMI\b|\bSTEMI\b|angina|\bCABG\b|\bPCI\b/i);
  C.stroke = has(/stroke|\bTIA\b|\bCVA\b/i); C.cirrhosis = has(/cirrhosis|portal hypertension|hepatic encephalopathy|ascites/i) || (C.inr > 1.5 && C.alb < 30);
  C.gibleed = has(/GI bleed|gastrointestinal bleed|peptic ulcer|\bPUD\b|duodenal ulcer|gastric ulcer|melena|hematemesis/i); C.aki = has(/acute kidney injury|\bAKI\b/i);
  C.dialysis = has(/hemodialysis|peritoneal dialysis|\bESRD\b|end-stage renal/i); C.diabetes = has(/diabet/i); C.psychosis = has(/schizophren|psychosis|psychotic/i);
  C.retention = has(/urinary retention|\bBPH\b|benign prostatic/i); C.hypercapnia = has(/hypercapni/i);
  C.osa = on("osa"); C.copd = on("copd"); C.delirium = on("delirium"); C.dementia = on("dementia"); C.falls = on("falls"); C.seizure = on("seizure"); C.alcohol = on("alcohol");
  C.acuteLiver = C.alt != null && C.alt > 200;
  C.parsed = S.meds.map(m => parseMed(m.name));
  C.opioidMeds = C.parsed.filter(p => p.opioid);
  C.opioids = C.opioidMeds.map(p => p.text);
  C.mme = C.opioidMeds.reduce((s, p) => s + (p.mme || 0), 0);
  C.mmeSched = C.opioidMeds.filter(p => !p.prn).reduce((s, p) => s + (p.mme || 0), 0);
  C.mmeUnknown = C.opioidMeds.filter(p => p.mme == null);
  C.oud = on("oudf") || medsBy(RX.oatMed).length > 0;
  C.bup = C.opioidMeds.filter(p => p.opioid === "buprenorphine").map(p => p.text);
  C.benzo = medsBy(RX.benzo); C.gabap = medsBy(RX.gabap); C.naloxone = medsBy(RX.naloxone).filter(m => !/bupren|suboxone/i.test(m)); C.bowel = medsBy(RX.bowel);
  C.anticoag = medsBy(RX.anticoag).filter(m => !/prophyla|40 mg SC daily|5000 units/i.test(m)).length > 0; C.anticoagProph = medsBy(RX.anticoag).length > 0;
  C.antiplatelet = medsBy(RX.antiplatelet).length > 0; C.acei = medsBy(RX.acei).length > 0; C.diuretic = medsBy(RX.diuretic).length > 0;
  C.steroid = medsBy(RX.steroid).length > 0; C.ppi = medsBy(RX.ppi).length > 0; C.serotonergic = medsBy(RX.serotonergic).map(m => m.split(/\s/)[0]);
  C.nsaids = medsBy(RX.nsaid); C.tcas = medsBy(RX.tca); C.relax = medsBy(RX.relax);
  C.apapDaily = C.parsed.reduce((s, p) => s + (p.apapDay || 0), 0);
  C.apapCap = (C.cirrhosis || C.alcohol || (C.wt && C.wt < 50)) ? 2000 : C.age >= 65 ? 3000 : 4000;
  // gabapentinoid renal maximum
  const e = C.egfr ?? 90;
  C.parsed.filter(p => /gabapentin|neurontin/i.test(p.text) && p.daily).forEach(p => { const mx = e >= 60 ? 3600 : e >= 30 ? 1400 : e >= 15 ? 700 : 300; if (p.daily > mx) C.gabapOver = `gabapentin ${round(p.daily)} mg/day exceeds the renal maximum ${mx} mg/day for eGFR ${C.egfr}`; });
  C.parsed.filter(p => /pregabalin|lyrica/i.test(p.text) && p.daily).forEach(p => { const mx = e >= 60 ? 600 : e >= 30 ? 300 : e >= 15 ? 150 : 75; if (p.daily > mx) C.gabapOver = `pregabalin ${round(p.daily)} mg/day exceeds the renal maximum ${mx} mg/day for eGFR ${C.egfr}`; });
  C.chronicNonCancer = on("chronic") && !on("cancer");
  C.tolerant = C.mmeSched >= 60 || C.opioidMeds.some(p => p.la && p.opioid !== "buprenorphine" && !(p.route === "patch" && C.opioidMeds.length === 1));
  return C;
}

/* --------------------------------------------------------- don't miss */
function alerts(C) {
  const A = []; const add = (lvl, t) => A.push({ lvl, t });
  if (on("cord")) add("bad", "Possible spinal cord compression / cauda equina: urgent MRI whole spine, dexamethasone 10 mg IV, neurosurgery/radiation oncology — do not just escalate analgesia.");
  if (on("abscess") && (on("lbp") || /back pain/i.test(S.docs.map(d => d.text).join(" ")))) add("bad", "Back pain with infection risk (injection drug use, fever, bacteremia): consider spinal epidural abscess / discitis — blood cultures, CRP, MRI.");
  if (on("compart")) add("bad", "Pain out of proportion: think compartment syndrome, limb/mesenteric ischemia, necrotizing infection before more opioid.");
  if (C.opioids.length && C.benzo.length) add("bad", `Opioid + benzodiazepine/Z-drug (${C.benzo.join("; ")}): highest risk of fatal respiratory depression — taper or stop the benzodiazepine, monitor, naloxone.`);
  if (C.opioids.length && C.gabap.length) add("warn", `Opioid + gabapentinoid (${C.gabap.join("; ")}): additive respiratory depression — lowest doses, sedation monitoring.`);
  if (C.mme >= 90) add(C.chronicNonCancer ? "bad" : "warn", `Opioid orders allow ~${round(C.mme)} MME/day${C.mmeSched !== C.mme ? ` (${round(C.mmeSched)} scheduled)` : ""} — ≥90 MME: high overdose risk${C.chronicNonCancer ? "; chronic non-cancer pain: offer a slow taper (Canadian 2017 guideline)" : ""}.`);
  else if (C.mme >= 50) add("warn", `Opioid orders allow ~${round(C.mme)} MME/day (≥50): review need, naloxone.`);
  if (C.opioids.length && !C.naloxone.length && (C.mme >= 50 || C.benzo.length || C.osa || C.copd || C.oud)) add("warn", "No naloxone ordered: order naloxone PRN in hospital and a BC Take Home Naloxone kit at discharge.");
  if (C.opioids.length && !C.bowel.length) add("warn", "Opioid without a bowel regimen: PEG 3350 17 g daily ± sennosides 8.6–17.2 mg qHS (docusate alone doesn't work).");
  const renalBad = C.opioidMeds.filter(p => ["morphine", "codeine", "meperidine"].includes(p.opioid) || (p.opioid === "tramadol" && (p.daily || 0) > 200));
  const renalMod = C.opioidMeds.filter(p => ["morphine", "codeine"].includes(p.opioid));
  if (C.egfr != null && C.egfr >= 30 && C.egfr < 60 && renalMod.length) add("warn", `eGFR ${C.egfr} with ${renalMod.map(p => p.opioid).join(", ")}: active metabolites accumulate as kidney function falls — lower dose and longer interval, or switch to hydromorphone${C.age >= 75 ? " (especially at this age)" : ""}.`);
  if (C.egfr != null && C.egfr < 30 && renalBad.length) add("bad", `eGFR ${C.egfr} with ${renalBad.map(p => p.opioid).join(", ")}: metabolites accumulate (sedation, myoclonus, seizures) — switch to reduced-dose hydromorphone, fentanyl or buprenorphine.`);
  if (C.opioidMeds.some(p => p.opioid === "codeine")) add("warn", "Codeine: unpredictable (CYP2D6 poor and ultra-rapid metabolizers) — prefer another opioid.");
  if (C.opioidMeds.some(p => p.opioid === "meperidine")) add("bad", "Meperidine: avoid (normeperidine seizures, delirium, serotonin syndrome).");
  if (C.opioidMeds.some(p => p.opioid === "fentanyl" && p.route === "patch") && C.mmeSched - C.opioidMeds.filter(p => p.route === "patch").reduce((s, p) => s + (p.mme || 0), 0) < 60 && !on("chronic") && !on("cancer"))
    add("bad", "Fentanyl patch without documented opioid tolerance (≥60 MME/day for ≥1 week): risk of fatal respiratory depression — confirm tolerance or remove.");
  if (on("acute") && !C.tolerant && C.opioidMeds.some(p => p.la && p.opioid !== "buprenorphine")) add("warn", "Long-acting opioid for acute pain in an opioid-naive patient: use immediate-release PRN/scheduled instead.");
  const tram = C.opioidMeds.filter(p => ["tramadol", "tapentadol"].includes(p.opioid));
  if (tram.length && (C.serotonergic.length || C.seizure)) add("bad", `${tram.map(p => p.opioid).join("/")} with ${C.serotonergic.length ? `serotonergic drugs (${C.serotonergic.join(", ")})` : ""}${C.serotonergic.length && C.seizure ? " and " : ""}${C.seizure ? "seizure disorder" : ""}: serotonin syndrome / seizure risk — choose another analgesic.`);
  if (C.opioidMeds.some(p => p.opioid === "methadone")) add("warn", `Methadone: ECG for QTc${C.qtc ? ` (last ${C.qtc} ms)` : ""}; check interactions; confirm dose and last dose with community pharmacy; do not convert by simple ratio.`);
  if (C.oud) add("warn", `Opioid use disorder${C.bup.length ? ` on buprenorphine (${C.bup.join("; ")})` : ""}: continue opioid agonist therapy (don't stop for surgery or pain); confirm dose with pharmacy/PharmaNet; addiction medicine consult; expect higher analgesic needs.`);
  if (C.nsaids.length) {
    const why = [C.egfr != null && C.egfr < 30 && `eGFR ${C.egfr}`, C.aki && "AKI", C.hf && "heart failure", C.cirrhosis && "cirrhosis", C.gibleed && "GI bleed history", C.anticoag && "anticoagulant", C.acei && C.diuretic && "ACEi/ARB + diuretic (triple whammy)"].filter(Boolean);
    if (why.length) add("bad", `NSAID ordered (${C.nsaids.join("; ")}) with ${why.join(", ")} — stop; use acetaminophen and topical agents.`);
    else if (C.age >= 65 && !C.ppi) add("warn", `NSAID in a patient ≥65 without a PPI (${C.nsaids.join("; ")}).`);
  }
  if (C.apapDaily > C.apapCap) add("bad", `Acetaminophen orders allow ${round(C.apapDaily)} mg/day — above this patient's cap of ${C.apapCap} mg (count combination products).`);
  if (C.gabapOver) add("bad", C.gabapOver + " — reduce (sedation, falls, respiratory depression).");
  if (C.age >= 65 && C.tcas.some(m => /amitriptyline|imipramine|doxepin(?!.*\b(?:3|6)\s*mg)/i.test(m))) add("warn", "Tertiary TCA in a patient ≥65 (anticholinergic, falls, delirium): switch to nortriptyline low dose or an SNRI/gabapentinoid.");
  if (C.age >= 65 && C.relax.filter(m => !/baclofen|tizanidine/i.test(m)).length) add("warn", "Muscle relaxant in a patient ≥65 (Beers): sedation and falls — stop.");
  if ((C.egfr != null && C.egfr < 30 || C.cirrhosis) && medsBy(/duloxetine/i).length) add("bad", "Duloxetine with eGFR <30 or liver disease: avoid.");
  if (C.opioids.length && (C.osa || C.copd || C.hypercapnia)) add("warn", "Opioid with sleep apnea/COPD: CPAP on during sleep, SpO2 (± capnography), lowest dose; see the Opioid safety tab for sedation scoring.");
  if (C.opioids.length && C.rr != null && C.rr < 10) add("bad", `Respiratory rate ${C.rr}: hold opioid, assess sedation, consider naloxone.`);
  if (on("hipfx") && !medsBy(/bupivacaine|ropivacaine|block|fascia iliaca|PENG/i).length && !findMatch(S.docs.map(d => d.text).join(" "), /nerve block|fascia iliaca|PENG block/i)) add("info", "Hip fracture with no nerve block found: fascia iliaca or PENG block reduces opioid need and delirium.");
  if (on("ribfx") && (C.age >= 65 || (S.docs.some(d => /(?:[3-9]|three|four|five|multiple) (?:\w+ )?rib/i.test(d.text))))) add("warn", "Rib fractures (older or ≥3 ribs): pneumonia/respiratory failure risk — regional block or epidural, incentive spirometry, Acute Pain Service.");
  if (C.age >= 65 && !C.parsed.some(p => p.apapDay > 0 && !p.prn) && (on("acute") || C.opioids.length)) add("info", "No scheduled acetaminophen: add it (opioid-sparing).");
  return A;
}

/* ------------------------------------------------------------- plans */
function apapDose(C) { return C.apapCap <= 2000 ? "500–650 mg PO q6h (max 2 g/day)" : C.apapCap <= 3000 ? "650 mg PO q6h or 1 g q8h (max 3 g/day)" : "1 g PO q6h (max 4 g/day)"; }
function opioidChoice(C) {
  const frail = C.age >= 75 || (C.wt && C.wt < 50) || C.dementia || C.delirium || C.osa || C.copd;
  if (C.bup.length) return { drug: "Continue buprenorphine", text: `Continue buprenorphine (${C.bup.join("; ")}); can split into TID–QID dosing for analgesia. Add a full agonist on top for severe pain (e.g. hydromorphone ${frail ? "1–2" : "2–4"} mg PO q3h PRN — higher doses are needed because of receptor occupancy). Acute Pain Service / addiction medicine.` };
  if (C.opioidMeds.some(p => p.opioid === "methadone") && C.oud) return { drug: "Continue methadone", text: "Continue the daily methadone OAT dose (confirm with pharmacy) — it does not treat the acute pain; add immediate-release hydromorphone PRN on top and multimodal agents." };
  if (C.tolerant) return { drug: "Baseline + breakthrough", text: `Opioid-tolerant (~${round(C.mmeSched)} MME/day scheduled): continue the baseline opioid; breakthrough dose = 10–15% of the daily MME as immediate-release q1–2h PRN (see Opioid tools). Don't use opioid-naive doses.` };
  const renal = C.egfr != null && C.egfr < 60, liver = C.cirrhosis;
  const dose = frail ? "0.5 mg PO q4h PRN (0.2 mg SC q2–4h PRN)" : "1–2 mg PO q4h PRN (0.4–0.5 mg SC q2–4h PRN)";
  if (renal || liver) return { drug: "Hydromorphone (reduced)", text: `Hydromorphone ${frail ? "0.25–0.5" : "0.5–1"} mg PO q6h PRN — ${renal ? `eGFR ${C.egfr}: hydromorphone preferred over morphine/codeine${C.egfr < 30 ? "; extend interval; avoid morphine, codeine, meperidine, tramadol >200 mg/day" : ""}` : "cirrhosis: halve dose, extend interval; watch for encephalopathy and constipation"}.` };
  return { drug: "Hydromorphone or oxycodone", text: `Hydromorphone ${dose}, or oxycodone ${frail ? "2.5" : "5"} mg PO q4h PRN. ${frail ? "Frail / older / sleep-disordered breathing: start at the low end and reassess within 1 h." : ""}` };
}
function acutePlan(C) {
  const st = [], judge = id => PAIN_CLASSES.find(c => c.id === id).judge(C);
  const ap = judge("apap"), ns = judge("nsaid"), gb = judge("gabap");
  st.push(["Acetaminophen (scheduled)", ap.lvl === "avoid" ? `Hold/limit: ${ap.why.join("; ")}` : `${apapDose(C)}.`]);
  if (ns.lvl === "avoid") st.push(["NSAID", `Avoid oral NSAIDs: ${ns.why.filter((w, i) => i < 3).join("; ")}. Topical diclofenac or lidocaine for focal pain.`]);
  else st.push(["NSAID", `${C.cad || C.stroke ? "Naproxen 250–500 mg BID" : on("colic") ? "Ketorolac 10 mg PO / 15 mg IV q6h (≤5 days) — first line for renal colic" : C.gibleed || C.age >= 65 ? "Celecoxib 100 mg BID + PPI" : "Ibuprofen 400 mg q6–8h or naproxen 250–500 mg BID"} for ≤3–5 days${ns.lvl === "caution" ? ` — caution: ${ns.why.slice(0, 3).join("; ")}` : ""}.`]);
  if (on("hipfx")) st.push(["Regional block", "Fascia iliaca or PENG block (ED/anaesthesia) — fewer opioids and less delirium."]);
  if (on("ribfx")) st.push(["Regional block", "Serratus anterior or erector spinae block, or thoracic epidural (≥3 ribs, age ≥65); incentive spirometry; Acute Pain Service."]);
  const oc = opioidChoice(C); st.push([`Opioid: ${oc.drug}`, oc.text + " Reassess pain and sedation 30–60 min after each dose; scheduled dosing only while pain is constant."]);
  if (on("neuro") || on("phn")) st.push(["Neuropathic component", `${gb.lvl === "avoid" ? "Gabapentinoid not advised (" + gb.why.join("; ") + ")" : `Gabapentin 100–300 mg qHS (renal max for eGFR ${C.egfr ?? "?"}) or pregabalin 25–75 mg qHS–BID`}; ${on("phn") ? "zoster within 72 h: valacyclovir 1 g TID × 7 days (renal adjust); lidocaine patch" : "topical lidocaine for focal pain"}.`]);
  if (on("gout")) st.push(["Gout flare", `${C.egfr != null && C.egfr < 30 ? "Prednisone 30–35 mg daily × 5 days (colchicine needs major dose reduction in CKD)" : "Colchicine 1.2 mg then 0.6 mg 1 h later, then 0.6 mg daily–BID (check CYP3A4/P-gp interactions), or prednisone 30–35 mg × 5 days"}; NSAID only if suitable; intra-articular steroid for a single joint.`]);
  if (on("colic")) st.push(["Renal colic", "NSAID is first line (if kidney function allows), add opioid for breakthrough; tamsulosin 0.4 mg daily for distal stones 5–10 mm; urology if infection + obstruction."]);
  if (on("panc")) st.push(["Pancreatitis", "Hydromorphone is appropriate; early oral feeding when tolerated; NSAID only if no AKI."]);
  if (on("sickle")) st.push(["Sickle cell crisis", "Parenteral opioid within 60 min of arrival, reassess q15–30 min; PCA if repeated doses; IV fluids, incentive spirometry, watch for acute chest syndrome; use the patient's individualized care plan."]);
  if (on("bonemets") || on("cancer")) st.push(["Cancer pain", "Opioids are appropriate; dexamethasone 4–8 mg daily for bone/visceral pain; radiation oncology for single-fraction RT to painful bone mets; palliative care."]);
  st.push(["Always with an opioid", `Bowel regimen (PEG 3350 ± senna); naloxone PRN; sedation scale (POSS) before each dose and q1–2h at peak; ${C.osa ? "CPAP on while asleep; " : ""}see the Opioid safety tab.`]);
  st.push(["Non-drug", NONDRUG[0] + " " + NONDRUG[1]]);
  st.push(["Discharge", `Immediate-release only; usually ≤3 days, rarely >7 days, with a taper; acetaminophen ± NSAID as base; Take Home Naloxone kit${C.benzo.length ? ", stop the benzodiazepine" : ""}; bowel regimen; safe storage; no driving while sedated; communicate with the family physician.`]);
  return st;
}
function chronicPlan(C) {
  const st = []; const j = id => PAIN_CLASSES.find(c => c.id === id).judge(C);
  st.push(["Foundation", NONDRUG.slice(2).join(" ")]);
  const lvlTxt = r => r.lvl === "avoid" ? ` — <b>avoid for this patient</b> (${r.why.join("; ")})` : r.lvl === "caution" ? ` — caution: ${r.why.slice(0, 2).join("; ")}` : "";
  if (on("oa")) st.push(["Osteoarthritis", `Exercise and weight loss; topical diclofenac first (knee/hand); acetaminophen (modest benefit); oral NSAID intermittently${lvlTxt(j("nsaid"))}; duloxetine${lvlTxt(j("snri"))}; intra-articular steroid. Avoid opioids including tramadol for OA where possible.`]);
  if (on("lbp")) st.push(["Chronic low back pain", `Stay active, physiotherapy/exercise, CBT; NSAID short courses${lvlTxt(j("nsaid"))}; duloxetine${lvlTxt(j("snri"))}. Gabapentinoids don't help non-radicular back pain. Avoid long-term opioids and muscle relaxants.`]);
  if (on("neuro") || on("dpn") || on("phn")) st.push(["Neuropathic pain (Canadian Pain Society)", `First line: gabapentinoid${lvlTxt(j("gabap"))}; SNRI (duloxetine)${lvlTxt(j("snri"))}; TCA (nortriptyline)${lvlTxt(j("tca"))}. Combine two first-line agents if partial response. Focal (PHN): lidocaine patch, capsaicin. Second/third line: tramadol or tapentadol, then opioids (lowest dose, time-limited), cannabinoids third-line.`]);
  if (on("tn")) st.push(["Trigeminal neuralgia", `Carbamazepine${lvlTxt(j("aed"))} or oxcarbazepine; neurology/neurosurgery if refractory.`]);
  if (on("fibro") || on("nociplastic")) st.push(["Fibromyalgia / nociplastic", `Education, graded aerobic exercise, sleep, CBT. Drugs (modest): duloxetine${lvlTxt(j("snri"))}, pregabalin${lvlTxt(j("gabap"))}, low-dose amitriptyline (younger adults) or cyclobenzaprine at night. Avoid opioids (they worsen nociplastic pain).`]);
  if (on("cancer")) st.push(["Cancer pain (chronic)", "Regular long-acting opioid once needs are stable + immediate-release breakthrough (10–15% of daily dose); adjuvants (dexamethasone, gabapentinoid for neuropathic, radiation for bone); palliative care. Opioid MME limits for non-cancer pain don't apply, but safety checks do."]);
  if (C.opioids.length && C.chronicNonCancer) st.push(["Opioid review (Canadian 2017 guideline)", `Current ~${round(C.mme)} MME/day. ${C.mme >= 90 ? "≥90 MME: offer a slow taper (5–10% every 2–4 weeks; pause if withdrawal or distress) — see Opioid tools." : C.mme >= 50 ? "50–90 MME: avoid further increases; reassess benefit (function) vs harm." : "<50 MME preferred ceiling."} Check BC PharmaNet for other prescribers; one prescriber and pharmacy; naloxone kit; avoid benzodiazepines; consider rotation to buprenorphine if high dose, poor function or OUD.`]);
  else if (C.chronicNonCancer) st.push(["Opioids", "Not recommended as first line for chronic non-cancer pain. If tried after non-opioid options: time-limited trial, functional goals, <50 MME (strong limit 90), naloxone, review at 4 weeks."]);
  if (C.oud) st.push(["Opioid use disorder", "Opioid agonist treatment (buprenorphine-naloxone first line; methadone or slow-release oral morphine as alternatives in BC); addiction medicine; naloxone kit; don't discharge on full-agonist opioids without a plan."]);
  st.push(["Referral", "Chronic pain clinic / Pain BC resources, physiotherapy, psychology; palliative care for cancer pain."]);
  return st;
}

/* ------------------------------------------------------------ rendering */
const badge = (txt, cls = "") => `<span class="cnt ${cls}">${txt}</span>`;
const grp = (k, title, b, body, open) => `<details class="card grp" data-k="${k}" ${open ? "open" : ""}><summary><span>${title}</span>${b}</summary><div class="grpbody">${body}</div></details>`;
function keepOpen(sel, fn) { const el = $(sel), st = {}; el.querySelectorAll("details[data-k]").forEach(d => st[d.dataset.k] = d.open); fn(); el.querySelectorAll("details[data-k]").forEach(d => { if (d.dataset.k in st) d.open = st[d.dataset.k]; }); }
const LV = { ok: ["ok", "OK"], caution: ["warn", "Caution"], avoid: ["bad", "Avoid"] };

function demoPicker() {
  const all = window.PAIN_DEMOS || [];
  return `<div class="banner info"><b>Made-up test patient ${S.demoIndex} of ${all.length}.</b>
    <select id="demoPick">${all.map((p, i) => `<option value="${i + 1}" ${i + 1 === S.demoIndex ? "selected" : ""}>${i + 1}. ${esc(p.name)} – ${esc(p.key)}</option>`).join("")}</select>
    <div class="small" style="margin-top:4px"><b>Expected:</b> ${esc(S.demo.expect)}</div></div>`;
}
function renderOverview() { keepOpen("#tab-overview", () => {
  const C = ctx(), A = alerts(C), nBad = A.filter(a => a.lvl === "bad").length;
  const row = (k, v) => `<tr><td>${k}</td><td>${String(v).replace(/[\s·]+/g, " ").trim() ? v : '<span class="muted">—</span>'}</td></tr>`;
  const flag = (b, t) => b ? `<span class="pill bad">${t}</span> ` : "";
  $("#tab-overview").innerHTML = `${S.mode === "demo" ? demoPicker() : ""}
    ${grp("alerts", "⚠ Don't miss", A.length ? badge(`${A.length} item${A.length > 1 ? "s" : ""}`, nBad ? "bad" : "warn") : badge("none", "ok"),
      A.length ? A.map(x => `<div style="margin:4px 0"><span class="pill ${x.lvl === "info" ? "chart" : x.lvl}">${x.lvl === "bad" ? "STOP / ACT" : x.lvl === "warn" ? "CHECK" : "NOTE"}</span> ${esc(x.t)}</div>`).join("") : '<p class="muted small">No safety alerts from the chart.</p>', true)}
    <div class="grid">
      ${grp("ctx", "Patient factors that change drug choice", badge("from chart", ""), `<table class="ctx">
        ${row("Age / weight", `${C.age ?? "?"} y · ${C.wt ? C.wt + " kg" : "weight ?"}`)}
        ${row("Kidney", C.egfr != null ? `${C.egfrIsCrcl ? "CrCl" : "eGFR"} ${C.egfr} ${C.egfr < 30 ? '<span class="pill bad">&lt;30</span>' : C.egfr < 60 ? '<span class="pill warn">30–59</span>' : ""} ${flag(C.dialysis, "dialysis")}${flag(C.aki, "AKI")}` : '<span class="pill grey">not found</span>')}
        ${row("Liver", `${flag(C.cirrhosis, "cirrhosis")}${C.alt != null ? `ALT ${C.alt}` : ""} ${C.bili != null ? `· bili ${C.bili}` : ""} ${C.inr != null ? `· INR ${C.inr}` : ""}` || "—")}
        ${row("Bleeding / GI", `${flag(C.gibleed, "GI bleed/ulcer")}${flag(C.anticoag, "anticoagulant")}${C.antiplatelet ? '<span class="pill warn">antiplatelet</span> ' : ""}${C.plt != null ? `plt ${C.plt}` : ""}`)}
        ${row("Heart / BP", `${flag(C.hf, "heart failure")}${C.cad ? '<span class="pill warn">CAD</span> ' : ""}${C.stroke ? '<span class="pill warn">stroke</span> ' : ""}${C.acei ? '<span class="pill grey">ACEi/ARB</span> ' : ""}${C.diuretic ? '<span class="pill grey">diuretic</span>' : ""}${C.qtc ? ` QTc ${C.qtc}` : ""}`)}
        ${row("Breathing", `${flag(C.osa, "sleep apnea")}${flag(C.copd, "COPD")}${C.rr != null ? `RR ${C.rr}` : ""} ${C.spo2 != null ? `· SpO2 ${C.spo2}%` : ""}`)}
        ${row("Brain", `${flag(C.delirium, "delirium")}${C.dementia ? '<span class="pill warn">dementia</span> ' : ""}${C.falls ? '<span class="pill warn">falls</span> ' : ""}${flag(C.seizure, "seizures")}${on("depression") ? '<span class="pill grey">depression/anxiety</span>' : ""}`)}
        ${row("Substance use", `${flag(C.oud, "opioid use disorder")}${flag(C.alcohol, "alcohol")}${C.benzo.length ? `<span class="pill bad">benzodiazepine</span>` : ""}` || "—")}
        ${row("Interactions", `${C.serotonergic.length ? `serotonergic: ${esc(C.serotonergic.join(", "))}` : "—"}`)}
      </table>`, true)}
      ${grp("cur", "Current analgesics", badge(C.opioids.length ? `~${round(C.mme)} MME/day` : "no opioid", C.mme >= 90 ? "bad" : C.mme >= 50 ? "warn" : C.opioids.length ? "hit" : ""), currentTable(C), true)}
    </div>
    <div class="card small muted">Pain type and conditions are on tab 2; options with OK / caution / avoid for this patient on tab 3; a tailored acute and chronic plan on tab 4.</div>`;
}); }
function currentTable(C) {
  const rel = C.parsed.filter(p => p.opioid || p.apapDay != null || RX.nsaid.test(p.text) || RX.gabap.test(p.text) || RX.tca.test(p.text) || /duloxetine|venlafaxine|carbamazepine|oxcarbazepine|lidocaine|capsaicin|diclofenac|nabilone|ketamine|dexamethasone|baclofen|cyclobenzaprine|methocarbamol/i.test(p.text) || RX.benzo.test(p.text));
  if (!rel.length) return '<p class="muted small">No analgesics on the active medication list.</p>';
  return `<table><tr><th>Medication</th><th>Class</th><th>MME/day</th></tr>${rel.map(p => `<tr><td class="small">${esc(p.text)}</td><td class="small">${p.opioid ? `opioid${p.la ? " (long-acting)" : ""}${p.prn ? " PRN" : ""}` : p.apapDay != null ? "acetaminophen" : RX.benzo.test(p.text) ? '<span class="pill bad">benzodiazepine</span>' : RX.nsaid.test(p.text) ? "NSAID" : RX.gabap.test(p.text) ? "gabapentinoid" : RX.tca.test(p.text) ? "TCA" : "adjuvant"}</td>
    <td>${p.opioid ? (p.mme != null ? `${p.prn ? "≤" : ""}${round(p.mme)}` : p.opioid === "buprenorphine" ? '<span class="pill grey">n/a</span>' : '<span class="pill warn">can’t parse</span>') : ""}</td></tr>`).join("")}</table>
    <p class="small muted">PRN orders are counted at the maximum they allow. Buprenorphine has no reliable MME. ${C.apapDaily ? `Acetaminophen orders allow ${round(C.apapDaily)} mg/day (cap ${C.apapCap}).` : ""}</p>`;
}
function renderAssess() {
  const groups = [...new Set(FEATURES.map(f => f.g))];
  $("#tab-assess").innerHTML = `<div class="card"><h2>Pain score and function</h2>
      <div class="row">Pain now (0–10) <input type="number" min="0" max="10" data-inp="nrs" value="${esc(S.inp.nrs)}"> &nbsp; PEG score (chronic: mean of pain, enjoyment, activity 0–10) <input type="number" min="0" max="10" step="0.1" data-inp="peg" value="${esc(S.inp.peg)}"></div>
      <p class="small muted">Set a functional goal (sit, walk, sleep, physio) rather than a pain score target. In dementia, use PAINAD.</p></div>
    <div class="row" style="margin-bottom:8px"><button class="btn sec" id="grpOpen">Expand all</button><button class="btn sec" id="grpClose">Collapse all</button><span class="small muted">The number on each group is how many items are ticked.</span></div>
    <div class="grid grpgrid">${groups.map(g => `<details class="card grp" data-g="${esc(g)}" ${g === "Red flags" && FEATURES.some(f => f.g === g && on(f.id)) ? "open" : ""}><summary><span>${esc(g)}</span><span class="cnt" data-cnt="${esc(g)}"></span></summary>
      ${FEATURES.filter(f => f.g === g).map(f => { const st = S.feat[f.id]; return `<label class="chk"><input type="checkbox" data-feat="${f.id}" ${st.on ? "checked" : ""}><span>${esc(f.label)}${st.src === "chart" ? '<span class="pill chart">from chart – confirm</span>' : ""}</span></label>${st.snip ? `<div class="snip">${esc(st.snip)}</div>` : ""}`; }).join("")}</details>`).join("")}</div>`;
  updateCounts();
  $("#grpOpen").onclick = () => document.querySelectorAll("#tab-assess details.grp").forEach(d => d.open = true);
  $("#grpClose").onclick = () => document.querySelectorAll("#tab-assess details.grp").forEach(d => d.open = false);
  $("#tab-assess").addEventListener("change", e => {
    const t = e.target;
    if (t.dataset.feat) S.feat[t.dataset.feat] = { ...S.feat[t.dataset.feat], on: t.checked, src: S.feat[t.dataset.feat].src || "user" };
    if (t.dataset.inp) S.inp[t.dataset.inp] = t.value;
    updateCounts(); renderDerived();
  });
}
function updateCounts() {
  document.querySelectorAll("[data-cnt]").forEach(el => { const fs = FEATURES.filter(f => f.g === el.dataset.cnt), n = fs.filter(f => on(f.id)).length; el.textContent = `${n} / ${fs.length}`; el.className = "cnt" + (n ? (el.dataset.cnt === "Red flags" ? " bad" : " hit") : ""); });
}
function renderOptions() { keepOpen("#tab-options", () => {
  const C = ctx();
  $("#tab-options").innerHTML = `<div class="card small muted">Each class is judged for this patient from the chart (kidney, liver, bleeding, heart, breathing, brain, interactions). Open a class for doses and adjustments.</div>
    ${PAIN_CLASSES.map(cl => { const r = cl.judge(C), [c, t] = LV[r.lvl];
      return grp("cls-" + cl.id, esc(cl.name), badge(t, c), `<p class="small"><b>Use:</b> ${esc(cl.role)}</p>
        ${r.why.length ? `<div class="banner ${c === "ok" ? "ok" : c}" style="padding:6px 10px;margin:6px 0"><b>For this patient:</b> ${esc(r.why.join("; "))}</div>` : ""}
        <table><tr><th>Drug</th><th>Start</th><th>Max</th><th>Kidney</th><th>Liver</th></tr>${cl.drugs.map(d => `<tr><td><b>${esc(d.n)}</b>${d.note ? `<div class="small muted">${esc(d.note)}</div>` : ""}</td><td class="small">${esc(d.start)}</td><td class="small">${esc(d.max)}</td><td class="small">${esc(d.renal)}</td><td class="small">${esc(d.hepatic)}</td></tr>`).join("")}</table>
        ${cl.pearls.length ? `<ul class="small">${cl.pearls.map(p => `<li>${esc(p)}</li>`).join("")}</ul>` : ""}`, r.lvl === "avoid"); }).join("")}`;
}); }
function renderPlan() { keepOpen("#tab-plan", () => {
  const C = ctx(); const isAcute = on("acute") || (!on("chronic") && !on("cancer")); const isChronic = on("chronic") || on("cancer");
  const list = st => `<ol class="small">${st.map(([h, t]) => `<li style="margin-bottom:5px"><b>${esc(h)}:</b> ${t.includes("<b>") ? t : esc(t)}</li>`).join("")}</ol>`;
  $("#tab-plan").innerHTML = `${on("acute") && on("chronic") ? '<div class="banner warn"><b>Acute-on-chronic pain:</b> keep the usual regimen (don\'t stop long-acting opioids, buprenorphine or methadone), treat the acute pain on top, and plan the return to baseline at discharge.</div>' : ""}
    ${grp("acute", "Acute pain plan (tailored)", badge(isAcute ? "applies" : "not selected", isAcute ? "hit" : ""), list(acutePlan(C)), isAcute)}
    ${grp("chronic", "Chronic / cancer pain plan (tailored)", badge(isChronic ? "applies" : "not selected", isChronic ? "hit" : ""), list(chronicPlan(C)), isChronic && !isAcute)}`;
}); }

/* --------------------------------------------------------- opioid tools */
const CONV = [["morphine", "oral", "Morphine PO"], ["morphine", "par", "Morphine SC/IV"], ["hydromorphone", "oral", "Hydromorphone PO"], ["hydromorphone", "par", "Hydromorphone SC/IV"],
  ["oxycodone", "oral", "Oxycodone PO"], ["tapentadol", "oral", "Tapentadol PO"], ["tramadol", "oral", "Tramadol PO"], ["codeine", "oral", "Codeine PO"], ["fentanyl", "par", "Fentanyl IV (mg)"], ["fentanylpatch", "patch", "Fentanyl patch (mcg/h)"]];
function factor(d, r) { if (d === "fentanylpatch") return null; const f = MME[d]; return f ? (r === "par" ? f.par : f.oral) : null; }
function renderTools() {
  const C = ctx();
  const opts = sel => CONV.map(([d, r, l]) => `<option value="${d}|${r}" ${sel === d + "|" + r ? "selected" : ""}>${l}</option>`).join("");
  $("#tab-tools").innerHTML = `
    ${grp("mme", "Current opioids → MME", badge(C.opioids.length ? `~${round(C.mme)} MME/day` : "none", C.mme >= 90 ? "bad" : C.mme >= 50 ? "warn" : ""), currentTable(C) + `<p class="small muted">Factors: oral morphine 1, hydromorphone 5, oxycodone 1.5, tapentadol 0.4, tramadol 0.2, codeine 0.15, methadone 4.7 (rough — non-linear), fentanyl patch 2.4 MME/day per mcg/h (CDC 2022); parenteral morphine 3, hydromorphone 20 (common ratios). Same factors as the Opioid safety tab — check against Island Health's table.</p>`, true)}
    ${grp("conv", "Conversion / rotation calculator", badge("calculator", ""), `<div class="calc">
        <label>From<select id="cvFrom">${opts("oxycodone|oral")}</select></label>
        <label>Total daily dose (mg or mcg/h)<input type="number" id="cvDose" value="${C.opioidMeds[0]?.daily ? round(C.opioidMeds[0].daily, 1) : 40}" style="width:120px"></label>
        <label>To<select id="cvTo">${opts("hydromorphone|oral")}</select></label>
        <label>Reduce for incomplete cross-tolerance<select id="cvRed"><option value="0">0% (route change, same drug)</option><option value="25">25%</option><option value="33" selected>33%</option><option value="50">50% (frail, high dose, methadone)</option></select></label>
      </div><div id="cvOut" style="margin-top:10px"></div>
      <p class="small muted">Methadone and buprenorphine are not converted here — they need an experienced prescriber. Fentanyl patch conversions use 2.4 MME per mcg/h; the Canadian product monograph table is more conservative at low doses — check it. Never use a patch for acute pain or in opioid-naive patients.</p>`, true)}
    ${grp("taper", "Taper calculator (chronic non-cancer pain)", badge("calculator", ""), `<div class="calc">
        <label>Current total MME/day<input type="number" id="tpMme" value="${round(C.mmeSched || C.mme || 120)}" style="width:110px"></label>
        <label>Reduce each step by<select id="tpPct"><option value="5">5%</option><option value="10" selected>10%</option><option value="20">20%</option></select></label>
        <label>Of the<select id="tpBase"><option value="orig" selected>original dose (linear)</option><option value="cur">current dose (slows at the end)</option></select></label>
        <label>Step every<select id="tpInt"><option value="1">1 week</option><option value="2" selected>2 weeks</option><option value="4">4 weeks</option></select></label>
        <label>Target MME/day<input type="number" id="tpTarget" value="0" style="width:90px"></label></div>
      <div id="tpOut" style="margin-top:10px"></div>
      <p class="small muted">Canadian 2017 guideline: offer a taper when ≥90 MME/day; go slower (5–10% every 2–4 weeks) and pause if withdrawal, worse pain or mood. Faster tapers increase overdose and suicide risk. Consider buprenorphine rotation. Offer naloxone.</p>`)}`;
  const conv = () => {
    const [fd, fr] = $("#cvFrom").value.split("|"), [td, tr] = $("#cvTo").value.split("|"), dose = Number($("#cvDose").value), red = Number($("#cvRed").value) / 100;
    const mme = fd === "fentanylpatch" ? dose * FENT_PATCH : dose * factor(fd, fr);
    if (!(mme > 0)) { $("#cvOut").innerHTML = ""; return; }
    const target = mme * (1 - red);
    let out;
    if (td === "fentanylpatch") { const p = target / FENT_PATCH; out = `<span class="big">${round(p)} mcg/h</span> fentanyl patch (round down to 12, 25, 37, 50…); keep breakthrough IR for 12–24 h after the first patch.`; }
    else { const daily = target / factor(td, tr), q4 = daily / 6; out = `<span class="big">${round(daily, 1)} mg/day</span> ${CONV.find(c => c[0] === td && c[1] === tr)[2]} ≈ ${round(q4, 2)} mg q4h (or long-acting q12h: ${round(daily / 2, 1)} mg). Breakthrough: ${round(daily * 0.1, 1)}–${round(daily * 0.15, 1)} mg q1–2h PRN.`; }
    $("#cvOut").innerHTML = `<div class="banner info">${round(dose, 1)} ${fd === "fentanylpatch" ? "mcg/h" : "mg/day"} ${CONV.find(c => c[0] === fd && c[1] === fr)[2]} = ${round(mme)} MME/day → minus ${Math.round(red * 100)}% = ${round(target)} MME/day → ${out}</div>`;
  };
  const taper = () => {
    const m = Number($("#tpMme").value), pct = Number($("#tpPct").value) / 100, base = $("#tpBase").value, wk = Number($("#tpInt").value), tgt = Number($("#tpTarget").value);
    if (!(m > 0)) { $("#tpOut").innerHTML = ""; return; }
    const steps = []; let cur = m, i = 0;
    while (cur > tgt && i < 40) { cur = Math.max(tgt, base === "orig" ? cur - m * pct : cur * (1 - pct)); if (base === "cur" && cur < m * 0.05) cur = tgt; steps.push([++i, (i - 1) * wk, Math.round(cur)]); }
    $("#tpOut").innerHTML = `<table><tr><th>Step</th><th>Start week</th><th>MME/day</th></tr><tr><td>0</td><td>0</td><td>${round(m)}</td></tr>${steps.map(([s, w, v]) => `<tr><td>${s}</td><td>${w + wk}</td><td>${v}</td></tr>`).join("")}</table>
      <p class="small">About ${steps.length * wk} weeks in total. Convert each step back to the patient's opioid and available tablet strengths.</p>`;
  };
  ["cvFrom", "cvDose", "cvTo", "cvRed"].forEach(id => $("#" + id).addEventListener("input", conv)); conv();
  ["tpMme", "tpPct", "tpBase", "tpInt", "tpTarget"].forEach(id => $("#" + id).addEventListener("input", taper)); taper();
}

/* ------------------------------------------------------------ note */
function buildNote() {
  const C = ctx(), A = alerts(C), L = [];
  const types = FEATURES.filter(f => ["Timeline", "Pain type", "Condition"].includes(f.g) && on(f.id)).map(f => f.label.split(/[(/–]/)[0].trim());
  L.push("PAIN – ASSESSMENT");
  L.push(`${types.join("; ") || "Pain type not yet specified"}.${S.inp.nrs ? ` Pain ${S.inp.nrs}/10.` : ""}${S.inp.peg ? ` PEG ${S.inp.peg}/10.` : ""}`);
  L.push(`Relevant factors: ${[C.egfr != null && `eGFR ${C.egfr}`, C.cirrhosis && "cirrhosis", C.gibleed && "GI bleed hx", C.anticoag && "anticoagulated", C.hf && "HF", C.osa && "OSA", C.copd && "COPD", C.delirium && "delirium", C.dementia && "dementia", C.oud && "OUD", C.age >= 65 && `age ${C.age}`].filter(Boolean).join(", ") || "none identified"}.`);
  if (C.opioids.length) L.push(`Current opioids ~${round(C.mme)} MME/day (${C.opioidMeds.map(p => p.opioid).join(", ")}).`);
  L.push("", "PLAN");
  const plan = (on("chronic") || on("cancer")) && !on("acute") ? chronicPlan(C) : acutePlan(C);
  plan.filter(([h]) => !/Non-drug|Foundation|Referral/.test(h)).slice(0, 7).forEach(([h, t]) => L.push(`- ${h}: ${t.replace(/<[^>]+>/g, "").split(/(?<=\.) /)[0]}`));
  A.filter(a => a.lvl === "bad").forEach(a => L.push("- SAFETY: " + a.t.split(/(?<=\.) |: /)[0]));
  L.push("- Reassess pain, function and sedation; goal: ______________________");
  L.push("[Decision: ________________________________]");
  return L.join("\n");
}
function renderNote() {
  const el = $("#tab-note");
  if (!el.innerHTML) {
    el.innerHTML = `<div class="card"><h2>Assessment &amp; plan draft</h2><p class="small muted">Edit freely, then copy into the PowerChart note. Regenerate overwrites edits.</p>
      <textarea id="noteBox"></textarea><div class="row"><button class="btn" id="copyNote">Copy</button><button class="btn sec" id="regenNote">Regenerate</button><span id="copied" class="small muted"></span></div></div>`;
    $("#noteBox").addEventListener("input", () => S.noteEdited = true);
    $("#copyNote").onclick = async () => { const t = $("#noteBox"); t.select(); try { await navigator.clipboard.writeText(t.value); } catch { document.execCommand("copy"); } $("#copied").textContent = "Copied"; };
    $("#regenNote").onclick = () => { S.noteEdited = false; $("#noteBox").value = buildNote(); };
  }
  if (!S.noteEdited) $("#noteBox").value = buildNote();
}
function renderDerived() { renderOverview(); renderOptions(); renderPlan(); renderTools(); renderNote(); }

/* --------------------------------------------------------------- boot */
function preFill() {
  const condTxt = S.conds.filter(c => !/resolved|inactive|entered/i.test(c.status)).map(c => c.text).join("\n");
  for (const f of FEATURES) {
    let snip = null, src = null;
    for (const n of S.docs) { snip = findMatch(n.text, f.re); if (snip) { src = `${n.title} ${fmtDate(n.date)}`; break; } }
    if (!snip && f.cond !== false) { snip = findMatch(condTxt, f.re); if (snip) src = "Problem list"; }
    S.feat[f.id] = { on: !!snip, src: snip ? "chart" : null, snip: snip ? `${src}: ${snip}` : "" };
  }
  if (S.patient?.birthDate) S.ageY = Math.floor((Date.now() - new Date(S.patient.birthDate)) / 31557600000);
  S.sex = S.patient?.gender || null;
  const all = S.docs.map(d => d.text).join(" ");
  const nrs = all.match(/pain (?:score )?(?:is |of |at )?(\d{1,2})\s*\/\s*10/i); if (nrs) S.inp.nrs = nrs[1];
}
function renderHeader() {
  const p = S.patient || {}; const name = p.name?.[0]?.text || [p.name?.[0]?.given?.join(" "), p.name?.[0]?.family].filter(Boolean).join(" ") || "Patient";
  $("#ptHeader").textContent = `${name} · ${S.ageY ?? "?"} y · ${p.gender || ""}`; $("#modeTag").textContent = S.mode === "demo" ? "DEMO – made-up patient" : "Live FHIR";
}
(async function init() {
  $("#tabs").addEventListener("click", e => { const b = e.target.closest("button[data-tab]"); if (!b) return;
    document.querySelectorAll("#tabs button").forEach(x => x.classList.toggle("active", x === b)); document.querySelectorAll(".tab").forEach(t => t.classList.toggle("active", t.id === "tab-" + b.dataset.tab)); });
  const params = new URLSearchParams(location.search);
  try {
    if (params.has("demo") || typeof FHIR === "undefined" || (!params.has("code") && !params.has("state") && !sessionStorage.getItem("SMART_KEY"))) loadDemo(parseInt(params.get("demo"), 10) || 1);
    else await loadFHIR();
  } catch (e) { console.error(e); $("#loading").innerHTML = `<div class="banner bad">Could not read the chart: ${esc(e.message || e)}. Showing a test patient instead.</div>`; loadDemo(1); }
  preFill(); renderHeader(); renderAssess(); renderDerived();
  if (!$("#loading .banner")) $("#loading").remove();
  document.addEventListener("change", e => { if (e.target.id === "demoPick") { const u = new URL(location.href); u.searchParams.set("demo", e.target.value); location.href = u.toString(); } });
})();
