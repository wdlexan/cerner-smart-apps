/* Seizure Workup & Follow-up - SMART on FHIR (Cerner) app
 * Reads: Patient, Observation (labs, weight), MedicationRequest, Condition, DiagnosticReport.
 * Open index.html?demo=1 to run with a made-up patient (no EHR needed).
 */
(() => {
"use strict";

// ---------- Links ----------
const LINKS = {
  bcSeizure: "https://www2.gov.bc.ca/gov/content/transportation/driving-and-cycling/roadsafetybc/medical-fitness/medical-prof/med-standards/17-seizures",
  bcIndex: "https://www2.gov.bc.ca/gov/content/transportation/driving-and-cycling/roadsafetybc/medical-fitness/medical-prof/med-standards",
  bcPolicies: "https://www2.gov.bc.ca/gov/content/transportation/driving-and-cycling/roadsafetybc/medical-fitness/medical-prof/policies",
  ccmta: "https://www.gov.nl.ca/motorregistration/files/determining-fitness-to-drive-in-canada.pdf",
  aedPdf: "aed-dosing-reference.pdf",
  sanderPdf: "https://epilepsysociety.org.uk/sites/default/files/2020-08/Chapter28Sander2015.pdf",
  ontarioPdf: "https://epilepsytoronto.org/wp-content/uploads/2020/09/Epilepsy_Management-guidelines_final.pdf",
  bcEpilepsy: "https://www.bcepilepsy.com/"
};

// ---------- Helpers ----------
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const parseD = d => (typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d)) ? new Date(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) : new Date(d);
const fmtDate = d => d ? parseD(d).toLocaleDateString("en-CA") : "";
const daysAgo = n => new Date(Date.now() - n * 864e5);
const addMonths = (d, m) => { const x = parseD(d); x.setMonth(x.getMonth() + m); return x; };
const today = () => new Date().toLocaleDateString("en-CA");

const S = { patient: null, labs: [], meds: [], stoppedMeds: [], conds: [], reports: [], weight: null, demo: false, noteDirty: false };

// ---------- Lab dictionary (regex on name + LOINC) ----------
const LABS = {
  sodium:     { re: /\bsodium\b|^na\b/i, loinc: ["2951-2", "2947-0"], label: "Sodium" },
  glucose:    { re: /glucose/i, loinc: ["2345-7", "2339-0", "41653-7", "14749-6"], label: "Glucose" },
  calcium:    { re: /^calcium\b|calcium,? (total|serum)|^ca\b/i, loinc: ["17861-6", "2000-8"], label: "Calcium (total)" },
  ica:        { re: /ionized calcium|calcium,? ionized|ica\b/i, loinc: ["1994-3", "17863-2"], label: "Ionized calcium" },
  magnesium:  { re: /magnesium/i, loinc: ["19123-9", "2601-3"], label: "Magnesium" },
  phosphate:  { re: /phosph(ate|orus)/i, loinc: ["2777-1", "14879-1"], label: "Phosphate" },
  potassium:  { re: /potassium/i, loinc: ["2823-3", "6298-4"], label: "Potassium" },
  creatinine: { re: /creatinine(?!.*(urine|clearance))/i, loinc: ["2160-0", "14682-9"], label: "Creatinine" },
  urea:       { re: /\burea\b|\bbun\b|urea nitrogen/i, loinc: ["3094-0", "22664-7", "14937-7"], label: "Urea / BUN" },
  egfr:       { re: /egfr|glomerular/i, loinc: ["33914-3", "62238-1", "98979-8"], label: "eGFR" },
  alt:        { re: /\balt\b|alanine/i, loinc: ["1742-6", "1743-4"], label: "ALT" },
  albumin:    { re: /^albumin|albumin,? serum/i, loinc: ["1751-7", "2862-1"], label: "Albumin" },
  wbc:        { re: /\bwbc\b|white blood/i, loinc: ["6690-2", "26464-8"], label: "WBC" },
  hgb:        { re: /hemoglobin|haemoglobin|\bhgb\b/i, loinc: ["718-7"], label: "Hemoglobin" },
  plt:        { re: /platelet/i, loinc: ["777-3", "26515-7"], label: "Platelets" },
  ck:         { re: /\bck\b|creatine kinase|\bcpk\b/i, loinc: ["2157-6"], label: "CK" },
  lactate:    { re: /lactate|lactic/i, loinc: ["2524-7", "32693-4", "2518-9"], label: "Lactate" },
  prolactin:  { re: /prolactin/i, loinc: ["2842-3"], label: "Prolactin" },
  ethanol:    { re: /ethanol|alcohol,? (serum|blood)/i, loinc: ["5643-2", "5640-8"], label: "Ethanol" },
  ammonia:    { re: /ammonia/i, loinc: ["16362-6", "1841-6"], label: "Ammonia" },
  osm:        { re: /osmolality(?!.*urine)/i, loinc: ["2692-2"], label: "Serum osmolality" },
  hcg:        { re: /hcg|chorionic/i, loinc: ["2106-3", "21198-7", "2118-8"], label: "beta-hCG" },
  tox:        { re: /drug screen|toxicology|urine drug/i, loinc: [], label: "Urine drug screen" },
  troponin:   { re: /troponin/i, loinc: ["6598-7", "10839-9", "89579-7"], label: "Troponin" },
  tsh:        { re: /\btsh\b|thyrotropin/i, loinc: ["3016-3"], label: "TSH" },
  bcx:        { re: /blood culture/i, loinc: ["600-7"], label: "Blood culture" },
  ua:         { re: /urinalysis|urine (culture|leuk|nitrite)/i, loinc: ["5804-0", "630-4"], label: "Urinalysis / culture" },
  csf:        { re: /\bcsf\b|cerebrospinal/i, loinc: [], label: "CSF studies" },
  // AED levels
  phenytoin:  { re: /phenytoin(?!.*free)/i, loinc: ["3968-5"], label: "Phenytoin level", lvl: [40, 80, "umol/L"], molw: 252.27 },
  phenytoinFree: { re: /phenytoin.*free|free phenytoin/i, loinc: ["3969-3"], label: "Free phenytoin", lvl: [4, 8, "umol/L"], molw: 252.27 },
  valproate:  { re: /valpro/i, loinc: ["4086-5"], label: "Valproate level", lvl: [350, 700, "umol/L"], molw: 144.21 },
  carbamazepine: { re: /carbamazepine(?!.*epoxide)/i, loinc: ["3432-2"], label: "Carbamazepine level", lvl: [17, 51, "umol/L"], molw: 236.27 },
  phenobarb:  { re: /phenobarb/i, loinc: ["3948-7"], label: "Phenobarbital level", lvl: [65, 170, "umol/L"], molw: 232.24 },
  levetiracetam: { re: /levetiracetam/i, loinc: ["30533-4"], label: "Levetiracetam level" },
  lamotrigine: { re: /lamotrigine/i, loinc: ["6948-4"], label: "Lamotrigine level" }
};

// Convert common US units to SI so thresholds work in either sandbox.
function toSI(key, v, unit) {
  const u = (unit || "").toLowerCase().replace(/\s/g, "");
  if (v == null) return v;
  const mgdl = u.includes("mg/dl");
  switch (key) {
    case "glucose": return mgdl ? v / 18.016 : v;
    case "calcium": return mgdl ? v / 4.008 : v;
    case "ica": return mgdl ? v / 4.008 : v;
    case "magnesium": return mgdl ? v / 2.431 : (u.includes("meq") ? v / 2 : v);
    case "phosphate": return mgdl ? v / 3.097 : v;
    case "creatinine": return mgdl ? v * 88.4 : v;
    case "urea": return mgdl ? v * 0.357 : v;
    case "albumin": return u.includes("g/dl") ? v * 10 : v;
    default: {
      const L = LABS[key];
      if (L && L.molw && (u.includes("mg/l") || u.includes("ug/ml") || u.includes("mcg/ml"))) return v * 1000 / L.molw;
      return v;
    }
  }
}
const SI_UNIT = { glucose: "mmol/L", calcium: "mmol/L", ica: "mmol/L", magnesium: "mmol/L", phosphate: "mmol/L", creatinine: "umol/L", urea: "mmol/L", albumin: "g/L" };

function obsName(o) { return o.code?.text || o.code?.coding?.[0]?.display || ""; }
function obsLoinc(o) { return (o.code?.coding || []).map(c => c.code); }
function classifyObs(o) {
  const n = obsName(o), codes = obsLoinc(o);
  // specific matches first (free phenytoin, ionized Ca)
  const order = ["phenytoinFree", "ica", "egfr", ...Object.keys(LABS).filter(k => !["phenytoinFree", "ica", "egfr"].includes(k))];
  for (const k of order) {
    const L = LABS[k];
    if (L.loinc.some(c => codes.includes(c)) || L.re.test(n)) return k;
  }
  return null;
}
function latest(key) {
  const arr = S.labs.filter(l => l.key === key).sort((a, b) => b.t - a.t);
  return arr[0] || null;
}
function labRow(key) {
  const l = latest(key);
  if (!l) return null;
  return l;
}
function valStr(l) {
  if (!l) return "";
  if (l.v == null) return esc(l.text || "resulted");
  const si = SI_UNIT[l.key];
  const shown = si && l.si != null && Math.abs(l.si - l.v) > 1e-6 ? `${round(l.si)} ${si} <span class="muted">(${l.v} ${esc(l.unit)})</span>` : `${round(l.v)} ${esc(l.unit)}`;
  return shown;
}
const round = x => (Math.abs(x) >= 100 ? Math.round(x) : Math.round(x * 10) / 10);

// ---------- Medication dictionaries ----------
const AED_MATCH = [
  ["lev", /levetiracetam|keppra/i], ["ltg", /lamotrigine|lamictal/i], ["vpa", /valpro|divalproex|epival|depakene/i],
  ["cbz", /carbamazepine|tegretol/i], ["oxc", /oxcarbazepine|trileptal/i], ["esl", /eslicarbazepine|aptiom/i],
  ["lcm", /lacosamide|vimpat/i], ["brv", /brivaracetam|briv/i], ["pht", /phenytoin|dilantin|cerebyx/i],
  ["tpm", /topiramate|topamax/i], ["zns", /zonisamide/i], ["clb", /clobazam|frisium/i], ["per", /perampanel|fycompa/i],
  ["esm", /ethosuximide|zarontin/i], ["cnb", /cenobamate|xcopri/i], ["pb", /phenobarb|primidone/i]
];
const LOWER_THRESHOLD = [
  [/tramadol/i, "Tramadol"], [/bupropion/i, "Bupropion"], [/meperidine|pethidine/i, "Meperidine"],
  [/cefepime/i, "Cefepime (esp. with renal impairment)"], [/imipenem/i, "Imipenem"], [/meropenem|ertapenem/i, "Carbapenem"],
  [/ciprofloxacin|levofloxacin|moxifloxacin/i, "Fluoroquinolone"], [/clozapine/i, "Clozapine"], [/chlorpromazine/i, "Chlorpromazine"],
  [/lithium/i, "Lithium (check level)"], [/theophylline|aminophylline/i, "Theophylline"], [/tacrolimus|cyclosporin/i, "Calcineurin inhibitor (PRES, low Mg)"],
  [/ifosfamide/i, "Ifosfamide"], [/isoniazid/i, "Isoniazid (give pyridoxine)"], [/flumazenil/i, "Flumazenil"],
  [/amitriptyline|nortriptyline|imipramine/i, "Tricyclic"], [/metronidazole/i, "Metronidazole (rare)"],
  [/methylphenidate|amphetamine/i, "Stimulant"], [/baclofen/i, "Baclofen (seizures on abrupt withdrawal)"]
];
const DOAC = /apixaban|rivaroxaban|dabigatran|edoxaban|warfarin/i;
const OCP = /ethinyl|estradiol|levonorgestrel|norethindrone|drospirenone|desogestrel|norgestimate|etonogestrel/i;
const CARBAPENEM = /meropenem|ertapenem|imipenem/i;
const OPIOID = /morphine|hydromorphone|oxycodone|fentanyl|methadone|codeine|tramadol|tapentadol/i;
const BENZO = /lorazepam|diazepam|midazolam|clonazepam|alprazolam|oxazepam|temazepam|clobazam/i;
const PR_DRUG = /metoprolol|bisoprolol|atenolol|carvedilol|propranolol|diltiazem|verapamil|digoxin|amiodarone/i;
const INDUCER_IDS = ["cbz", "pht", "pb"];

const medName = m => m.medicationCodeableConcept?.text || m.medicationCodeableConcept?.coding?.[0]?.display || m.medicationReference?.display || "Unnamed medication";
const medDose = m => m.dosageInstruction?.[0]?.text || "";
const aedIdsOn = () => S.meds.map(m => AED_MATCH.find(([, re]) => re.test(medName(m)))?.[0]).filter(Boolean);
const onMed = re => S.meds.some(m => re.test(medName(m)));

// ---------- Conditions & reports ----------
const condText = c => c.code?.text || c.code?.coding?.[0]?.display || "";
const hasCond = re => S.conds.some(c => re.test(condText(c)));
const REPORTS = {
  ct: { re: /\bct\b.*(head|brain)|(head|brain).*\bct\b|computed tomography.*(head|brain)/i, label: "CT head" },
  cta: { re: /cta|ct angio|ct venogra|ctv/i, label: "CT angiogram / venogram" },
  mri: { re: /mri.*(brain|head|epilep)|(brain|head).*mri|magnetic resonance.*brain/i, label: "MRI brain" },
  eeg: { re: /\beeg\b|electroencephalo/i, label: "EEG" },
  ecg: { re: /\becg\b|\bekg\b|electrocardio/i, label: "ECG" },
  echo: { re: /echocardio|\becho\b/i, label: "Echocardiogram" }
};
function reportFor(key) {
  const R = REPORTS[key];
  return S.reports.filter(r => R.re.test((r.code?.text || r.code?.coding?.[0]?.display || ""))).sort((a, b) => new Date(b.effectiveDateTime || b.issued || 0) - new Date(a.effectiveDateTime || a.issued || 0))[0] || null;
}
const repDate = r => fmtDate(r?.effectiveDateTime || r?.issued);
const repConcl = r => r?.conclusion || r?.conclusionCode?.[0]?.text || "";

// ---------- State from form ----------
function state() {
  const g = id => $("#" + id);
  return {
    presentation: g("presentation").value, cause: g("cause").value, stype: g("stype").value, driver: g("driver").value,
    lastSz: g("lastSz").value, resolved: g("resolvedDate").value,
    epilepsyDx: g("epilepsyDx").checked || g("presentation").value === "breakthrough",
    asleepOnly: g("asleepOnly").checked, medChange: g("medChange").checked, surgery: g("surgery").checked,
    aud: g("aud").checked, wocbp: g("wocbp").checked, notBaseline: g("notBaseline").checked,
    weight: parseFloat(g("weight").value) || null
  };
}
const STYPE_LABEL = { unknown: "unknown-onset", focal_aware: "focal aware", focal_impaired: "focal impaired-awareness", focal_bilateral: "focal to bilateral tonic-clonic", gtc: "generalized tonic-clonic", absence: "absence", myoclonic: "myoclonic" };
const CAUSE_LABEL = { unknown: "cause not yet determined", unprovoked: "unprovoked", prov_metabolic: "provoked (metabolic/toxic)", prov_structural: "provoked (acute structural)", alcohol: "alcohol-withdrawal" };
const PRES_LABEL = { first: "new-onset (first) seizure", breakthrough: "breakthrough seizure in known epilepsy", status: "status epilepticus / cluster" };
const specOf = st => ({ focal_aware: "focal", focal_impaired: "focal", focal_bilateral: "focal", gtc: "gtc", absence: "absence", myoclonic: "myoclonic", unknown: "gtc" }[st]);

// ---------- Chart-derived flags ----------
function acuteSymptomaticFlags() {
  // ILAE (Beghi 2010) thresholds for acute symptomatic (provoked) seizures, labs within 24 h of seizure
  // Uses the worst value in the window (a corrected sodium afterwards does not hide the one at the time of the seizure).
  const out = [];
  const chk = (key, test, msg) => {
    const hit = S.labs.filter(l => l.key === key && l.si != null && test(l.si)).sort((a, b) => b.t - a.t)[0];
    if (hit) out.push(`${msg} (${round(hit.si)} ${SI_UNIT[key] || hit.unit}, ${fmtDate(hit.t)}${hit !== latest(key) ? `; latest ${round(latest(key).si)}` : ""})`);
  };
  chk("sodium", v => v < 115, "Sodium &lt;115 mmol/L");
  chk("glucose", v => v < 2.0, "Glucose &lt;2.0 mmol/L");
  chk("glucose", v => v > 25, "Glucose &gt;25 mmol/L (provoking if with ketoacidosis/HHS)");
  chk("calcium", v => v < 1.2, "Total calcium &lt;1.2 mmol/L");
  chk("magnesium", v => v < 0.3, "Magnesium &lt;0.3 mmol/L");
  chk("urea", v => v > 35.7, "Urea &gt;35.7 mmol/L");
  chk("creatinine", v => v > 884, "Creatinine &gt;884 umol/L");
  return out;
}
function softLabFlags() {
  const out = [];
  const chk = (key, test, msg) => { const l = latest(key); if (l && l.si != null && test(l.si)) out.push(`${msg}: ${round(l.si)} ${SI_UNIT[key] || l.unit}`); };
  chk("sodium", v => v >= 115 && v < 125, "Sodium low (below ILAE threshold but may contribute)");
  chk("sodium", v => v > 150, "Sodium high");
  chk("glucose", v => v >= 2.0 && v < 3.5, "Glucose low");
  chk("magnesium", v => v >= 0.3 && v < 0.6, "Magnesium low");
  chk("calcium", v => v >= 1.2 && v < 1.9, "Calcium low");
  chk("ica", v => v < 0.9, "Ionized calcium low");
  chk("ammonia", v => v > 50, "Ammonia elevated (valproate? liver?)");
  chk("ethanol", v => v > 0, "Ethanol detected");
  return out;
}
function levelFlags() {
  const out = [];
  for (const k of ["phenytoin", "phenytoinFree", "valproate", "carbamazepine", "phenobarb"]) {
    const l = latest(k); if (!l || l.si == null) continue;
    const [lo, hi] = LABS[k].lvl;
    let cls = "p-grn", txt = "in range";
    if (l.si < lo) { cls = "p-amb"; txt = "LOW (adherence? interaction? needs dose increase?)"; }
    if (l.si > hi) { cls = "p-red"; txt = "HIGH (toxicity?)"; }
    let extra = "";
    if (k === "phenytoin") {
      const alb = latest("albumin");
      if (alb && alb.si != null && alb.si < 35) {
        const egfr = latest("egfr"); const esrd = egfr && egfr.si < 15;
        const corr = l.si / ((esrd ? 0.1 : 0.2) * (alb.si / 10) + 0.1);
        extra = ` - albumin-corrected ~${Math.round(corr)} umol/L (${esrd ? "ESRD " : ""}Winter-Tozer); check a free level`;
      }
    }
    out.push(`<span class="pill ${cls}">${LABS[k].label}: ${round(l.si)} umol/L - ${txt}</span>${extra} <span class="muted">${fmtDate(l.t)}; range ${lo}-${hi}</span>`);
  }
  for (const k of ["levetiracetam", "lamotrigine"]) { const l = latest(k); if (l) out.push(`<span class="pill p-blu">${LABS[k].label}: ${valStr(l)}</span> <span class="muted">${fmtDate(l.t)} (adherence check)</span>`); }
  return out;
}
function medFlags(st) {
  const out = []; const ids = aedIdsOn();
  if (ids.includes("vpa") && onMed(CARBAPENEM)) out.push(["alert", "Valproate + carbapenem: valproate levels fall 60-100% within 24 h. Change antibiotic or switch/bridge the AED (e.g. levetiracetam). Raising the valproate dose does not work."]);
  if (ids.includes("vpa") && st.wocbp) out.push(["alert", "Valproate in a woman of childbearing potential: major teratogen. Needs pregnancy prevention plan and specialist review; plan to switch."]);
  if (ids.includes("ltg") && ids.includes("vpa")) out.push(["warn", "Lamotrigine + valproate: lamotrigine levels about double - use the slower titration and lower target."]);
  if (ids.includes("ltg") && onMed(/ethinyl|estradiol|conjugated estrogen/i)) out.push(["alert", "Lamotrigine + estrogen-containing contraceptive/HRT: lamotrigine levels fall by about half (and rise in the pill-free week). Check a level; increase dose or use a non-estrogen method."]);
  if (ids.some(i => INDUCER_IDS.includes(i)) && onMed(DOAC)) out.push(["alert", "Strong enzyme inducer AED (carbamazepine/phenytoin/phenobarbital) with DOAC/warfarin: anticoagulant levels reduced. Avoid with DOACs; monitor INR closely with warfarin."]);
  if (ids.some(i => ["cbz", "pht", "pb", "oxc", "tpm", "per", "cnb"].includes(i)) && onMed(OCP)) out.push(["warn", "Enzyme-inducing AED with hormonal contraception: contraceptive failure risk. Use IUD/depot or non-inducing AED."]);
  if (ids.includes("lcm") && onMed(PR_DRUG)) out.push(["warn", "Lacosamide with AV-nodal/PR-prolonging drug: check ECG (PR interval)."]);
  if ((ids.includes("clb") || onMed(BENZO)) && onMed(OPIOID)) out.push(["warn", "Benzodiazepine + opioid: additive respiratory depression."]);
  if ((ids.includes("cbz") || ids.includes("oxc") || ids.includes("esl"))) { const na = latest("sodium"); if (na && na.si < 130) out.push(["warn", `Carbamazepine/oxcarbazepine/eslicarbazepine with Na ${round(na.si)}: drug-induced hyponatremia may be provoking seizures.`]); }
  const egfr = latest("egfr");
  if (egfr && egfr.si < 50 && ids.includes("lev")) out.push(["info", `eGFR ${round(egfr.si)}: check levetiracetam dose against renal adjustment (AED reference tab).`]);
  if (egfr && egfr.si < 30 && onMed(/cefepime/i)) out.push(["alert", "Cefepime with eGFR <30: cefepime neurotoxicity (encephalopathy, NCSE) - consider EEG and dose change."]);
  const lowering = [];
  for (const [re, label] of LOWER_THRESHOLD) if (onMed(re)) lowering.push(label);
  if (lowering.length) out.push(["warn", "Medications that lower seizure threshold: " + [...new Set(lowering)].join(", ") + "."]);
  if (S.stoppedMeds.length) out.push(["warn", "AED recently stopped or completed in chart: " + S.stoppedMeds.map(m => esc(medName(m))).join(", ") + " - possible withdrawal trigger."]);
  return out;
}

// ---------- Driving rules (CCMTA Medical Standards with BC-specific guidelines, ch. 17) ----------
function drivingRule(st) {
  const com = st.driver === "com";
  const r = { section: "", title: "", months: null, from: st.lastSz, text: "", conditions: [], alt: "" };
  if (st.driver === "none") { r.title = "Patient does not drive"; r.text = "Document that the patient does not hold a licence / does not drive. Counsel about other safety risks (cycling, heights, water)."; return r; }
  if (st.surgery) {
    Object.assign(r, com ? { section: "17.6.10", title: "Epilepsy surgery - commercial", months: 60, text: "5 years seizure-free after surgery (may be reduced to 3 years on neurologist/specialist recommendation)." }
      : { section: "17.6.9", title: "Epilepsy surgery - non-commercial", months: 12, text: "12 months seizure-free after surgery (may be reduced to 6 months on neurologist recommendation)." });
    r.conditions.push("Follows treatment; stops driving and reports if a seizure occurs");
    return r;
  }
  if (st.medChange) {
    Object.assign(r, com ? { section: "17.6.15", title: "Medication change/withdrawal - commercial", months: 6, text: "Must already meet the commercial epilepsy standard. 6 months seizure-free after the change. If a seizure occurs, re-establish the previous regimen and be seizure-free 6 months after resuming it." }
      : { section: "17.6.11", title: "Medication change/withdrawal - non-commercial", months: 3, text: "Prior treatment must have been effective (no seizure for 6 months before the change). If a seizure occurs after the change, re-establish the previous effective regimen; may drive after 3 months seizure-free on it." });
    r.conditions.push("Count from the date the previous regimen was re-established (or the last seizure, whichever is later)");
    return r;
  }
  if (st.cause === "alcohol") {
    if (!st.aud) { Object.assign(r, { section: "17.6.2 (BC)", title: "Alcohol-related seizure, no alcohol use disorder diagnosis", months: null, text: "BC applies the provoked-seizure (no structural lesion) standard: may drive once the provoking factor has resolved and the physician judges further seizures unlikely." }); return r; }
    Object.assign(r, { section: "17.6.3", title: "Alcohol-withdrawal seizure", months: null, text: "No fixed interval. Requires participation in addiction treatment and a favourable report from an addiction counsellor/specialist." });
    r.conditions.push("Regular follow-up and compliance with treatment", "Stop driving and report if another seizure occurs");
    return r;
  }
  if (st.cause === "prov_structural") {
    Object.assign(r, { section: "17.6.1", title: "Provoked seizure with structural brain abnormality", months: 6, from: st.resolved || st.lastSz,
      text: "6 months after the provoking factor has stabilized, resolved or been corrected, with no seizure in that time, and the treating neurologist/neurosurgeon judges further seizures unlikely. Same for commercial and non-commercial." });
    if (!st.resolved) r.conditions.push("Enter the date the provoking cause stabilized/resolved for an accurate date (currently counted from the seizure)");
    return r;
  }
  if (st.epilepsyDx) {
    if (st.asleepOnly) {
      Object.assign(r, com ? { section: "17.6.13", title: "Epilepsy, seizures only asleep/on awakening - commercial", months: 60, text: "Pattern of seizures only while asleep or on awakening consistent for at least 5 years, with no prolonged post-ictal impairment in wakefulness." }
        : { section: "17.6.7", title: "Epilepsy, seizures only asleep/on awakening - non-commercial", months: 6, text: "6 months since the last seizure, OR an established pattern of seizures only while asleep/on awakening for at least 1 year." });
      r.alt = com ? "" : "Alternative: pattern consistent for >= 1 year";
      return r;
    }
    if (st.stype === "focal_aware") {
      Object.assign(r, com ? { section: "17.6.14", title: "Epilepsy, simple partial (focal aware) seizures only - commercial", months: 60, text: "5 years since the last seizure, OR pattern consistent for 3 years, with a favourable neurologist assessment." }
        : { section: "17.6.8", title: "Epilepsy, simple partial (focal aware) seizures only - non-commercial", months: 6, text: "6 months since the last seizure, OR seizure pattern consistent for at least 1 year, with a favourable physician/neurologist assessment." });
      r.conditions.push("No impairment of consciousness or cognition, no motor involvement affecting driving, no head or eye deviation");
      r.alt = com ? "Alternative: pattern consistent for >= 3 years" : "Alternative: pattern consistent for >= 1 year";
      return r;
    }
    Object.assign(r, com ? { section: "17.6.12", title: "Epilepsy - commercial", months: 60, text: "5 years without a seizure, with or without medication." }
      : { section: "17.6.6", title: "Epilepsy - non-commercial", months: 6, text: "6 months seizure-free (may be reduced to no less than 3 months on neurologist recommendation with rationale)." });
    r.conditions.push("Follows treatment; stops driving and reports if a seizure occurs");
    if (st.cause === "prov_metabolic") r.conditions.push("A provoking factor was also present: the epilepsy standard is used because the patient has epilepsy; the neurologist may advise otherwise");
    if (com) r.conditions.push("BC restriction R22 (Code W) on Class 1-4; invalid in the USA");
    return r;
  }
  if (st.cause === "prov_metabolic") {
    Object.assign(r, { section: "17.6.2", title: "Provoked seizure without structural abnormality", months: null,
      text: "No fixed interval: may drive once the provoking factor (e.g. hyponatremia, hypoglycemia, drug toxicity) has resolved or been corrected and the treating physician judges further seizures unlikely. Same for commercial and non-commercial." });
    return r;
  }
  // first unprovoked or not yet determined
  Object.assign(r, com ? { section: "17.6.5", title: "Single unprovoked seizure - commercial", months: 12, text: "At least 12 months since the seizure, complete neurological assessment, epilepsy not diagnosed, and satisfactory CNS imaging and EEG." }
    : { section: "17.6.4", title: "Single unprovoked seizure - non-commercial", months: 3, text: "CCMTA/BC: no fixed interval - may drive once a complete neurological assessment is done, epilepsy is NOT diagnosed, and CNS imaging and EEG are satisfactory. The CMA Driver's Guide advises at least 3 months, so the app uses 3 months." });
  if (st.cause === "unknown") r.conditions.unshift("Cause not yet determined: advise NO driving until workup is complete, then reclassify");
  return r;
}

// Plain-language waiting period: "in 6 months", "in 5 years", plus how long is left from today.
function waitText(months) {
  if (months == null) return "";
  if (months >= 12 && months % 12 === 0) return `${months / 12} year${months > 12 ? "s" : ""}`;
  return `${months} months`;
}
function remainingText(date) {
  if (!date) return "";
  const days = Math.round((date - new Date()) / 864e5);
  if (days <= 0) return "waiting period already passed (if seizure-free and conditions met)";
  if (days < 45) return `about ${days} days from today`;
  const m = Math.round(days / 30.44);
  return m >= 24 ? `about ${Math.round(m / 12)} years from today` : `about ${m} months from today`;
}
function driveLine(dr) {
  // e.g. "Can drive in 6 months (on or after 2027-05-17, about 6 months from today)"
  if (dr.months == null) return "No fixed waiting period";
  const d = dr.from ? addMonths(dr.from, dr.months) : null;
  return `Can drive in ${waitText(dr.months)}${d ? ` (on or after ${fmtDate(d)}; ${remainingText(d)})` : " from the last seizure"}`;
}

// ---------- Rendering ----------
function render() {
  const st = state();
  renderSummary(st); renderDriving(st); renderIx(st); renderTx(st); renderAED(st); renderFU(st); renderReport(st);
  if (!S.noteDirty) $("#note").value = buildNote(st);
}

// After one unprovoked seizure, an epileptiform EEG or a structural lesion means epilepsy (ILAE 2014) - changes treatment and driving.
function epilepsyHint(st) {
  if (st.epilepsyDx || st.presentation !== "first" || /^prov|alcohol/.test(st.cause)) return "";
  const why = [];
  const eeg = reportFor("eeg"), concl = r => (repConcl(r) || "").toLowerCase();
  if (eeg && /sharp wave|spike|epileptiform|polyspike|periodic discharge|electrographic seizure/.test(concl(eeg)) && !/no epileptiform|without epileptiform|normal eeg/.test(concl(eeg))) why.push("EEG: " + repConcl(eeg));
  for (const k of ["mri", "ct"]) { const r = reportFor(k); if (r && /cavern|tumou?r|mass|glioma|metasta|old .*infarct|encephalomalacia|gliosis|dysplasia|hippocampal sclerosis|mesial temporal sclerosis|heterotopia|avm|arteriovenous/.test(concl(r))) { why.push(REPORTS[k].label + ": " + repConcl(r)); break; } }
  if (!why.length) return "";
  return `<div class="warn"><b>May already meet the definition of epilepsy after one seizure</b> (ILAE 2014: recurrence risk &ge;60%).<br>${why.map(esc).join("<br>")}<br>If neurology agrees, tick <i>Epilepsy diagnosed</i> above - this changes the AED decision and the driving wait (epilepsy: 6 months private, 5 years commercial).</div>`;
}
function renderSummary(st) {
  const p = S.patient;
  const ids = [...new Set(aedIdsOn())];
  const acute = acuteSymptomaticFlags(), soft = softLabFlags(), lv = levelFlags(), mf = medFlags(st);
  const epiCond = S.conds.filter(c => /seizure|epilep|convuls|status epilepticus/i.test(condText(c)));
  const riskConds = S.conds.filter(c => /stroke|infarct|hemorrhage|haemorrhage|tumou?r|glioma|meningioma|metasta|traumatic brain|tbi|subdural|alcohol|dementia|encephalitis|meningitis|pregnan|cirrhosis|renal failure|kidney disease/i.test(condText(c)));
  const rep = ["ct", "mri", "eeg", "ecg"].map(k => [k, reportFor(k)]);
  const dr = drivingRule(st);
  const earliest = dr.months != null && dr.from ? fmtDate(addMonths(dr.from, dr.months)) : null;

  $("#t-summary").innerHTML = `
  <div class="twocol">
    <div>
      <div class="card"><h2>Snapshot</h2>
        <p><b>${esc(PRES_LABEL[st.presentation])}</b> - ${esc(STYPE_LABEL[st.stype])}, ${esc(CAUSE_LABEL[st.cause])}${st.lastSz ? `, last seizure ${fmtDate(st.lastSz)}` : ""}.</p>
        ${st.presentation === "status" || st.notBaseline ? `<div class="alert"><b>Not back to baseline / status:</b> treat as status epilepticus (Treatment tab) and get an urgent EEG to exclude non-convulsive status.</div>` : ""}
        ${epilepsyHint(st)}
        ${acute.length ? `<div class="alert"><b>Meets ILAE acute-symptomatic (provoked) threshold:</b><br>${acute.join("<br>")}<br><span class="muted">If this was within ~24 h of the seizure, classify as provoked - metabolic.</span></div>` : ""}
        ${soft.length ? `<div class="warn">${soft.join("<br>")}</div>` : ""}
        <h3>Driving</h3>
        <p class="drive">${st.driver === "none" ? "Does not drive." : `<b>No driving now.</b> <b>${esc(driveLine(dr))}</b>${dr.months == null ? " - see Driving tab for conditions" : ""}. <span class="muted">${esc(dr.title)}, CCMTA ${esc(dr.section)}</span>`}</p>
      </div>
      <div class="card"><h2>AEDs on the medication list</h2>
        ${ids.length ? `<table><tr><th>Medication</th><th>Dose</th><th>Status</th></tr>${S.meds.filter(m => AED_MATCH.some(([, re]) => re.test(medName(m)))).map(m => `<tr><td>${esc(medName(m))}</td><td>${esc(medDose(m))}</td><td>${esc(m.status)}</td></tr>`).join("")}</table>` : `<p class="muted">No antiseizure medication found on the active list.</p>`}
        ${lv.length ? `<h3>Levels</h3>${lv.map(x => `<div style="margin:3px 0">${x}</div>`).join("")}` : (st.presentation === "breakthrough" && ids.length ? `<div class="warn">Breakthrough seizure with no AED level in chart - order trough level(s) where useful (phenytoin, valproate, carbamazepine; levetiracetam/lamotrigine for adherence).</div>` : "")}
      </div>
    </div>
    <div>
      <div class="card"><h2>Medication safety flags</h2>
        ${mf.length ? mf.map(([c, t]) => `<div class="${c}">${t}</div>`).join("") : `<p class="muted">No AED interactions or seizure-threshold-lowering drugs found.</p>`}
      </div>
      <div class="card"><h2>Imaging / EEG / ECG in chart (past year)</h2>
        <table>${rep.map(([k, r]) => `<tr><td style="width:110px"><span class="status ${r ? "s-yes" : "s-no"}">${r ? "&#10003;" : "&#9675;"}</span>${REPORTS[k].label}</td><td>${r ? `${repDate(r)} - ${esc(repConcl(r) || (r.code?.text || "report on file"))}` : '<span class="muted">Not found</span>'}</td></tr>`).join("")}</table>
      </div>
      <div class="card"><h2>Relevant problem list</h2>
        ${epiCond.length || riskConds.length ? `<ul style="margin:0;padding-left:18px">${[...epiCond, ...riskConds].map(c => `<li>${esc(condText(c))}${c.onsetDateTime ? ` <span class="muted">(${fmtDate(c.onsetDateTime)})</span>` : ""}</li>`).join("")}</ul>` : `<p class="muted">No seizure-related or risk conditions on the problem list.</p>`}
      </div>
    </div>
  </div>`;
}

function renderDriving(st) {
  const dr = drivingRule(st);
  const earliest = dr.months != null && dr.from ? addMonths(dr.from, dr.months) : null;
  $("#t-driving-main").innerHTML = `
  <div class="card drive"><h2>When can this patient drive again?</h2>
    ${st.driver === "none" ? `<p>${esc(dr.text)}</p>` : `
    <p class="big">${esc(driveLine(dr))}</p>
    ${dr.months != null ? `<p>Waiting period: <b>${waitText(dr.months)} seizure-free</b>, counted from ${dr.from === st.resolved && st.resolved ? "the date the provoking cause resolved" : "the last seizure"}${dr.from ? ` (${fmtDate(dr.from)})` : ""}. Any further seizure restarts the clock.</p>` : ""}
    <p><span class="pill p-blu">CCMTA ${esc(dr.section)}</span> <b>${esc(dr.title)}</b></p>
    <p>${esc(dr.text)}</p>
    ${dr.alt ? `<p class="muted">${esc(dr.alt)}</p>` : ""}
    ${dr.conditions.length ? `<ul>${dr.conditions.map(c => `<li>${esc(c)}</li>`).join("")}</ul>` : ""}
    ${!st.lastSz ? `<div class="warn">Enter the date of the most recent seizure to calculate the driving date.</div>` : ""}
    <div class="info"><b>Tell the patient today:</b> do not drive until cleared. RoadSafetyBC generally reassesses in 1 year when a seizure occurred in the past 12 months, and may request a Driver's Medical Examination Report (DMER) or neurology assessment. Document the advice in the chart.</div>
    <div class="warn"><b>Physician reporting (BC):</b> under the Motor Vehicle Act (s. 230), a physician must report to RoadSafetyBC a patient who has a condition that makes driving dangerous <i>and</i> continues to drive after being warned. Use the RoadSafetyBC report form or DMER.</div>`}
  </div>
  <div class="card"><h2>All seizure standards at a glance (CCMTA, adopted by BC)</h2>
    <table>
      <tr><th>Situation</th><th>Non-commercial (Class 5-8)</th><th>Commercial (Class 1-4)</th></tr>
      <tr><td>Provoked - structural (stroke, bleed, tumour, TBI) <span class="muted">17.6.1</span></td><td colspan="2">6 months after the cause stabilized/resolved, seizure-free, neurologist/neurosurgeon judges recurrence unlikely</td></tr>
      <tr><td>Provoked - no structural lesion (metabolic, drug) <span class="muted">17.6.2</span></td><td colspan="2">No fixed interval: cause corrected and physician judges recurrence unlikely</td></tr>
      <tr><td>Alcohol withdrawal <span class="muted">17.6.3</span></td><td colspan="2">Addiction treatment + favourable counsellor report (BC: no AUD diagnosis &rarr; 17.6.2)</td></tr>
      <tr><td>Single unprovoked <span class="muted">17.6.4 / 17.6.5</span></td><td>Complete neuro assessment, imaging + EEG satisfactory, epilepsy not diagnosed (CMA guide: &ge;3 months)</td><td>12 months + same assessment</td></tr>
      <tr><td>Epilepsy <span class="muted">17.6.6 / 17.6.12</span></td><td>6 months seizure-free (neurologist may reduce to &ge;3 months)</td><td>5 years seizure-free (with or without medication)</td></tr>
      <tr><td>Only asleep / on awakening <span class="muted">17.6.7 / 17.6.13</span></td><td>6 months, or pattern consistent &ge;1 year</td><td>Pattern consistent &ge;5 years</td></tr>
      <tr><td>Simple partial (focal aware) only <span class="muted">17.6.8 / 17.6.14</span></td><td>6 months, or pattern &ge;1 year; no impaired awareness, no head/eye deviation</td><td>5 years, or pattern &ge;3 years; neurologist favourable</td></tr>
      <tr><td>After epilepsy surgery <span class="muted">17.6.9 / 17.6.10</span></td><td>12 months (may reduce to 6)</td><td>5 years (may reduce to 3)</td></tr>
      <tr><td>Seizure after physician-directed med change/withdrawal <span class="muted">17.6.11 / 17.6.15</span></td><td>Back on previous regimen + 3 months seizure-free (needed 6 months seizure-free before the change)</td><td>Back on previous regimen + 6 months; must meet commercial epilepsy standard</td></tr>
    </table>
    <p class="muted">Commercial epilepsy standards in BC carry restriction R22 (Code W), Class 1-4, invalid in the USA. Auras alone count as simple partial seizures.</p>
  </div>
  <div class="card"><h2>Guideline links</h2>
    <ul class="links">
      <li><a target="_blank" href="${LINKS.bcSeizure}">BC - RoadSafetyBC: CCMTA Medical Standards ch. 17, Seizures and epilepsy (with BC-specific guidelines)</a></li>
      <li><a target="_blank" href="${LINKS.bcIndex}">BC - Full CCMTA Medical Standards index (RoadSafetyBC)</a></li>
      <li><a target="_blank" href="${LINKS.bcPolicies}">BC - RoadSafetyBC policies for medical professionals (reporting)</a></li>
      <li><a target="_blank" href="${LINKS.ccmta}">Canada - CCMTA National Safety Code Standard 6: Determining Driver Fitness in Canada (PDF, 2020)</a></li>
    </ul>
  </div>`;
}

// Investigations
function ixItem(name, why, key, opts = {}) {
  let found = null, txt = "";
  if (key && LABS[key]) { found = latest(key); txt = found ? `${valStr(found)} <span class="muted">${fmtDate(found.t)}</span>` : ""; }
  if (key && REPORTS[key]) { found = reportFor(key); txt = found ? `${repDate(found)} - ${esc(repConcl(found) || "report on file")}` : ""; }
  const pri = opts.pri ? `<span class="pill ${opts.pri === "Needed" ? "p-red" : opts.pri === "Consider" ? "p-amb" : "p-gry"}">${opts.pri}</span>` : "";
  return `<tr><td style="width:24px"><span class="status ${found ? "s-yes" : "s-no"}">${found ? "&#10003;" : "&#9675;"}</span></td><td><b>${name}</b> ${pri}<div class="muted">${why}</div></td><td style="width:34%">${txt || '<span class="muted">Not in chart</span>'}</td></tr>`;
}
function renderIx(st) {
  const first = st.presentation === "first", bt = st.presentation === "breakthrough", status = st.presentation === "status" || st.notBaseline;
  const ids = aedIdsOn();
  const need = c => c ? "Needed" : "Consider";
  $("#t-ix").innerHTML = `
  <div class="card"><h2>Investigations</h2><p class="muted">&#10003; = found in the chart (labs: last 7 days; reports: last year). Priority tags adjust to the classification above. Click a heading to expand.</p>
  <details ${first || status ? "open" : ""}><summary>Blood tests - core</summary><div class="body"><table>
    ${ixItem("Point-of-care glucose", "Exclude hypo/hyperglycemia immediately", "glucose", { pri: "Needed" })}
    ${ixItem("Sodium, potassium", "Hyponatremia &lt;115 mmol/L is provoking; drugs (CBZ/OXC, SSRIs, thiazides)", "sodium", { pri: "Needed" })}
    ${ixItem("Calcium (+ ionized)", "Hypocalcemia; post-thyroid/parathyroid surgery", "calcium", { pri: "Needed" })}
    ${ixItem("Magnesium", "Low Mg (PPIs, alcohol, calcineurin inhibitors)", "magnesium", { pri: "Needed" })}
    ${ixItem("Phosphate", "Refeeding, alcohol", "phosphate", { pri: "Consider" })}
    ${ixItem("Urea, creatinine, eGFR", "Uremia; renal dosing of AEDs (levetiracetam, lacosamide, cefepime)", "creatinine", { pri: "Needed" })}
    ${ixItem("CBC", "Infection, baseline before valproate/carbamazepine", "wbc", { pri: "Needed" })}
    ${ixItem("ALT / liver panel, albumin", "Hepatic dosing; low albumin raises free phenytoin/valproate", "alt", { pri: "Needed" })}
    ${ixItem("Albumin", "Needed to interpret total phenytoin/valproate levels", "albumin", { pri: bt ? "Needed" : "Consider" })}
  </table></div></details>
  <details ${bt ? "open" : ""}><summary>Blood tests - AED levels (trough)</summary><div class="body"><table>
    ${ixItem("Phenytoin (total &plusmn; free)", "Target 40-80 umol/L; correct for albumin", "phenytoin", { pri: ids.includes("pht") ? "Needed" : "" })}
    ${ixItem("Valproate", "Target 350-700 umol/L; falls with carbapenems", "valproate", { pri: ids.includes("vpa") ? "Needed" : "" })}
    ${ixItem("Carbamazepine", "Target 17-51 umol/L", "carbamazepine", { pri: ids.includes("cbz") ? "Needed" : "" })}
    ${ixItem("Phenobarbital", "Target 65-170 umol/L", "phenobarb", { pri: ids.includes("pb") ? "Needed" : "" })}
    ${ixItem("Levetiracetam / lamotrigine", "Adherence check only (send-out); lamotrigine falls in pregnancy and with estrogen", "levetiracetam", { pri: (ids.includes("lev") || ids.includes("ltg")) && bt ? "Consider" : "" })}
  </table></div></details>
  <details><summary>Blood tests - supportive / cause-finding</summary><div class="body"><table>
    ${ixItem("CK", "Rises 24-48 h after GTC; rhabdomyolysis", "ck", { pri: "Consider" })}
    ${ixItem("Lactate", "Transient rise within 2 h supports GTC over syncope", "lactate", { pri: "Consider" })}
    ${ixItem("Prolactin (10-20 min post-event)", "Raised after GTC/focal impaired; helps vs psychogenic events, normal value does not exclude", "prolactin", { pri: "Consider" })}
    ${ixItem("Ethanol level", "Alcohol intoxication/withdrawal", "ethanol", { pri: st.cause === "alcohol" ? "Needed" : "Consider" })}
    ${ixItem("Serum osmolality", "Toxic alcohols, osmolar gap", "osm")}
    ${ixItem("Ammonia", "Hepatic encephalopathy; valproate hyperammonemia", "ammonia", { pri: ids.includes("vpa") ? "Consider" : "" })}
    ${ixItem("beta-hCG", "All women of childbearing potential (AED choice, eclampsia)", "hcg", { pri: st.wocbp ? "Needed" : "" })}
    ${ixItem("Troponin", "If arrhythmic syncope is in the differential", "troponin")}
    ${ixItem("TSH", "Thyrotoxicosis (rare provocation)", "tsh")}
    ${ixItem("Blood cultures", "Fever, sepsis", "bcx")}
  </table></div></details>
  <details><summary>Lab tests - urine, toxicology, CSF</summary><div class="body"><table>
    ${ixItem("Urine drug screen", "Stimulants, cocaine, withdrawal states", "tox", { pri: first ? "Needed" : "Consider" })}
    ${ixItem("Urinalysis / culture", "Infection as a breakthrough trigger", "ua", { pri: bt ? "Consider" : "" })}
    ${ixItem("Lumbar puncture (cell count, protein, glucose, Gram/culture, HSV/VZV/enterovirus PCR, cryptococcal Ag; autoimmune encephalitis panel if suspected)", "Fever, meningism, immunocompromise, persistent confusion, new psychiatric/memory symptoms (link to autoimmune encephalitis app). CT first if focal deficit/reduced GCS.", "csf", { pri: "Consider" })}
  </table></div></details>
  <details ${first || status ? "open" : ""}><summary>EEG</summary><div class="body"><table>
    ${ixItem("Routine EEG (ideally within 24-48 h)", "Early EEG has higher yield; epileptiform discharges raise recurrence risk and support an epilepsy diagnosis", "eeg", { pri: first ? "Needed" : "Consider" })}
    <tr><td></td><td><b>Sleep-deprived EEG</b> <span class="pill p-gry">If routine normal</span><div class="muted">Outpatient, when diagnosis still unclear</div></td><td></td></tr>
    <tr><td></td><td><b>Continuous EEG</b> <span class="pill ${status ? "p-red" : "p-gry"}">${status ? "Needed" : "If not at baseline"}</span><div class="muted">Not back to baseline within ~30-60 min, fluctuating awareness, ICU/sedated patient, suspected non-convulsive status (incl. cefepime/ifosfamide neurotoxicity)</div></td><td></td></tr>
  </table></div></details>
  <details ${first ? "open" : ""}><summary>Imaging</summary><div class="body"><table>
    ${ixItem("CT head (non-contrast)", "Urgent in ED for first seizure, focal deficit, head injury, anticoagulation, age &gt;40, persistent confusion, malignancy/immunocompromise", "ct", { pri: first ? "Needed" : "Consider" })}
    ${ixItem("MRI brain - epilepsy protocol (3T if available)", "All new-onset seizures unless clearly provoked/generalized genetic epilepsy; hippocampal sclerosis, cortical dysplasia, tumour, cavernoma. Add gadolinium for tumour/infection/inflammation", "mri", { pri: first ? "Needed" : "Consider" })}
    ${ixItem("CT angiogram / venogram", "Suspected venous sinus thrombosis (headache, postpartum, OCP, hypercoagulable), AVM, acute stroke", "cta")}
  </table></div></details>
  <details><summary>Cardiac / other (mimics)</summary><div class="body"><table>
    ${ixItem("12-lead ECG", "Syncope mimics: QTc, Brugada, WPW, heart block; baseline before lacosamide/phenytoin", "ecg", { pri: "Needed" })}
    <tr><td></td><td><b>Telemetry, orthostatic vitals</b><div class="muted">If convulsive syncope or arrhythmia possible</div></td><td></td></tr>
    ${ixItem("Echocardiogram", "Structural heart disease if syncope suspected", "echo")}
    <tr><td></td><td><b>HLA-B*15:02 (&plusmn; HLA-A*31:01)</b><div class="muted">Before carbamazepine/phenytoin/oxcarbazepine in patients of Asian ancestry</div></td><td></td></tr>
  </table></div></details>
  </div>`;
}

// Treatment
function suggestAEDs(st) {
  const sp = specOf(st.stype);
  const egfr = latest("egfr");
  const onAnticoag = onMed(DOAC), onOcp = onMed(OCP);
  const age = S.patient?.age || 0;
  const order = { focal: ["ltg", "lev", "lcm", "oxc", "cbz", "brv", "esl", "zns", "tpm"], gtc: st.wocbp ? ["lev", "ltg", "zns", "tpm"] : ["vpa", "lev", "ltg", "zns", "tpm"], absence: st.wocbp ? ["esm", "ltg", "lev"] : ["esm", "vpa", "ltg"], myoclonic: st.wocbp ? ["lev", "zns", "clb"] : ["vpa", "lev", "zns", "clb"] }[sp];
  return order.map(id => {
    const a = AED_DATA.find(x => x.id === id), notes = [];
    if (st.wocbp && (id === "vpa" || id === "tpm")) notes.push("teratogenic");
    if (onAnticoag && INDUCER_IDS.includes(id)) notes.push("reduces DOAC/warfarin");
    if (onOcp && ["cbz", "oxc", "tpm", "pht"].includes(id)) notes.push("reduces OCP");
    if (onOcp && id === "ltg") notes.push("estrogen OCP lowers level");
    if (age >= 65 && INDUCER_IDS.includes(id)) notes.push("avoid in elderly");
    if (egfr && egfr.si < 50 && ["lev", "lcm", "oxc", "esl", "tpm", "zns"].includes(id)) notes.push("renal dose adjust");
    return { a, notes };
  });
}
function loadCalc(st) {
  const w = st.weight;
  if (!w) return `<p class="muted">Enter weight (top panel) to calculate loading doses.</p>`;
  const r = (x, max, u) => `${Math.round(Math.min(x, max))} ${u}${x > max ? ` (capped at max ${max})` : ""}`;
  return `<table>
    <tr><th>Drug</th><th>Dose for ${w} kg</th><th>Notes</th></tr>
    <tr><td>Lorazepam IV</td><td>${(Math.min(0.1 * w, 4)).toFixed(1)} mg</td><td>0.1 mg/kg, max 4 mg/dose; repeat once after 5 min</td></tr>
    <tr><td>Midazolam IM</td><td>${w > 40 ? "10 mg" : "5 mg"}</td><td>If no IV access</td></tr>
    <tr><td>Levetiracetam IV (status)</td><td>${r(60 * w, 4500, "mg")}</td><td>60 mg/kg over 10-15 min</td></tr>
    <tr><td>Fosphenytoin IV</td><td>${r(20 * w, 1500, "mg PE")}</td><td>20 mg PE/kg at &le;150 mg PE/min, cardiac monitor</td></tr>
    <tr><td>Valproate IV</td><td>${r(40 * w, 3000, "mg")}</td><td>40 mg/kg over 10 min; avoid in WOCBP, liver disease</td></tr>
    <tr><td>Lacosamide IV</td><td>200-400 mg</td><td>Fixed; check PR interval</td></tr>
    <tr><td>Phenobarbital IV</td><td>${Math.round(15 * w)}-${Math.round(20 * w)} mg</td><td>15-20 mg/kg; airway support</td></tr>
  </table>`;
}
function renderTx(st) {
  const sugg = suggestAEDs(st);
  const status = st.presentation === "status" || st.notBaseline;
  const isOpen = c => c ? "open" : "";
  $("#t-tx").innerHTML = `
  <div class="card"><h2>Treatment</h2><p class="muted">The section matching the classification opens automatically.</p>
  <details ${isOpen(status)}><summary>Status epilepticus / seizure now (time-based)</summary><div class="body">
    <table>
      <tr><th>Time</th><th>Action</th></tr>
      <tr><td>0-5 min</td><td>ABCs, O2, monitor, POC glucose. Thiamine 100 mg IV before glucose if malnourished/alcohol. IV access; labs incl. AED levels.</td></tr>
      <tr><td>5-20 min</td><td><b>Benzodiazepine:</b> lorazepam 0.1 mg/kg IV (max 4 mg/dose), repeat once; OR midazolam 10 mg IM; OR diazepam 0.15-0.2 mg/kg IV (max 10 mg).</td></tr>
      <tr><td>20-40 min</td><td><b>Second line (one of):</b> levetiracetam 60 mg/kg (max 4500 mg), fosphenytoin 20 mg PE/kg (max 1500), valproate 40 mg/kg (max 3000). Similar efficacy (ESETT).</td></tr>
      <tr><td>40+ min</td><td><b>Refractory:</b> ICU/anesthesia, intubation, midazolam or propofol infusion, continuous EEG; treat the cause.</td></tr>
    </table>
    <h3>Loading dose calculator</h3>${loadCalc(st)}
  </div></details>
  <details ${isOpen(st.cause === "prov_metabolic" || st.cause === "prov_structural")}><summary>Provoked (acute symptomatic) seizure</summary><div class="body">
    <ul>
      <li>Treat the cause: correct Na slowly (hypertonic saline 100-150 mL 3% bolus for seizures with severe hyponatremia), glucose, Ca, Mg; stop/reduce offending drug.</li>
      <li>Metabolic/toxic: long-term AED usually <b>not</b> needed. Short-term AED only if seizures recur while the cause is being corrected.</li>
      <li>Acute structural (stroke, ICH, TBI, encephalitis, tumour): AED often started while acute; no routine primary prophylaxis after stroke/ICH. Brain tumour with seizure: levetiracetam preferred (few interactions with chemo).</li>
      <li>Reassess need for AED at follow-up - late (remote) seizures after stroke/TBI carry high recurrence risk and count as epilepsy.</li>
    </ul>
  </div></details>
  <details ${isOpen(st.cause === "alcohol")}><summary>Alcohol-withdrawal seizure</summary><div class="body">
    <ul>
      <li>Typically 6-48 h after last drink. Benzodiazepine (lorazepam/diazepam) is the treatment; symptom-triggered CIWA protocol afterwards.</li>
      <li>Thiamine 100-500 mg IV before glucose; replete Mg, phosphate, K.</li>
      <li>Phenytoin is not effective for withdrawal seizures; long-term AED not indicated unless separate epilepsy.</li>
      <li>Still image (CT) if first seizure, focal features, head injury or atypical timing.</li>
      <li>Addiction medicine referral; driving needs addiction treatment and favourable report (17.6.3).</li>
    </ul>
  </div></details>
  <details ${isOpen(st.presentation === "first" && (st.cause === "unprovoked" || st.cause === "unknown"))}><summary>First unprovoked seizure - start an AED or not?</summary><div class="body">
    <p>Recurrence risk after one unprovoked seizure is ~21-45% at 2 years (AAN/AES 2015). Starting an AED reduces early recurrence by about a third but does not change long-term remission (FIRST, MESS).</p>
    <p><b>Usually start (= epilepsy, ILAE 2014: recurrence risk &ge;60%) if any:</b></p>
    <ul>
      <li>Epileptiform discharges on EEG</li>
      <li>Structural lesion on imaging (remote stroke, TBI, tumour, cortical dysplasia)</li>
      <li>Prior brain insult or neurological deficit</li>
      <li>Seizure arose from sleep (nocturnal)</li>
      <li>Second unprovoked seizure &gt;24 h after the first; or an epilepsy syndrome identified</li>
    </ul>
    <p><b>Usually defer</b> if normal EEG and MRI with none of the above - but individualize (driving, job, patient preference, living alone).</p>
  </div></details>
  <details ${isOpen(st.presentation === "breakthrough")}><summary>Breakthrough seizure in known epilepsy</summary><div class="body">
    <ol>
      <li><b>Find the trigger:</b> missed doses (most common), sleep deprivation, alcohol, infection/fever, new interacting drug (Summary tab flags), vomiting/malabsorption, pregnancy or estrogen start (lamotrigine), recent AED change.</li>
      <li><b>Levels:</b> trough levels where meaningful; low level + adherent &rarr; increase dose.</li>
      <li><b>Missed doses:</b> resume usual regimen; for a short gap give the missed dose; if days missed, consider partial reload (levetiracetam/phenytoin/valproate) - don't restart lamotrigine at full dose after &gt;5 half-lives (re-titrate).</li>
      <li><b>Cannot take PO:</b> switch to IV equivalent (levetiracetam, lacosamide, valproate, phenytoin, brivaracetam 1:1) or bridge with benzodiazepine.</li>
      <li><b>True failure on adequate dose:</b> uptitrate toward max tolerated, then add/switch a second drug of a different mechanism. Failure of 2 appropriate AEDs = drug-resistant epilepsy &rarr; refer to a comprehensive epilepsy program.</li>
      <li><b>Short bridge:</b> clobazam 10 mg BID x 3-7 days during clusters or uptitration.</li>
      <li>Rescue plan at discharge (e.g. intranasal/buccal midazolam for cluster/prolonged seizure) - neurology to advise.</li>
    </ol>
  </div></details>
  <details ${isOpen(st.presentation !== "status")}><summary>Choosing an AED for this patient (${esc(STYPE_LABEL[st.stype])})</summary><div class="body">
    <table><tr><th>Option</th><th>Start</th><th>Target</th><th>Flags for this patient</th></tr>
    ${sugg.map(({ a, notes }) => `<tr><td><b>${esc(a.name)}</b>${a.iv ? ' <span class="pill p-grn">IV</span>' : ""}</td><td>${esc(a.start)}</td><td>${esc(a.target)}</td><td>${notes.length ? notes.map(n => `<span class="pill p-amb">${esc(n)}</span>`).join("") : '<span class="pill p-grn">no flags</span>'}</td></tr>`).join("")}
    </table>
    <p class="muted">Order reflects SANAD II and common Canadian practice: lamotrigine for focal, valproate for generalized (except women of childbearing potential, where levetiracetam/lamotrigine are preferred). Unknown onset is treated with broad-spectrum options. Full details in the AED reference tab.</p>
  </div></details>
  <details><summary>Special populations</summary><div class="body">
    <ul>
      <li><b>Women of childbearing potential:</b> lamotrigine or levetiracetam; folic acid (at least 0.4-1 mg daily; many use higher doses with AEDs); avoid valproate and topiramate; inducers reduce OCP. Pregnancy: lamotrigine/levetiracetam levels fall - check monthly; register with pregnancy registry.</li>
      <li><b>Older adults:</b> lamotrigine, levetiracetam or lacosamide at lower start doses; avoid enzyme inducers and sedating drugs; watch hyponatremia with oxcarbazepine/carbamazepine.</li>
      <li><b>Renal impairment / dialysis:</b> reduce levetiracetam, lacosamide, topiramate, oxcarbazepine; supplemental levetiracetam after HD; free phenytoin level.</li>
      <li><b>Liver disease:</b> avoid valproate; levetiracetam preferred; reduce lamotrigine/lacosamide/brivaracetam.</li>
      <li><b>On DOAC, chemotherapy, HIV ART, transplant drugs:</b> levetiracetam, lacosamide, brivaracetam (no induction).</li>
      <li><b>Psychiatric comorbidity:</b> lamotrigine (mood-stabilising) or valproate; caution levetiracetam, perampanel, topiramate.</li>
    </ul>
  </div></details>
  </div>`;
}

function renderAED(st) {
  const sp = specOf(st.stype);
  const sel = $("#aedSel")?.value || aedIdsOn()[0] || "lev";
  const filt = $("#aedFilt")?.value || "all";
  const list = AED_DATA.filter(a => filt === "all" || a.spectrum.includes(filt));
  const a = AED_DATA.find(x => x.id === sel) || AED_DATA[0];
  const SPEC = { focal: "Focal", gtc: "Generalized tonic-clonic", absence: "Absence", myoclonic: "Myoclonic" };
  $("#t-aed").innerHTML = `
  <div class="card"><h2>Antiseizure medication reference (adult)</h2>
    <p><a class="btn" target="_blank" href="${LINKS.aedPdf}">&#128196; Open dosing PDF (start, target, side effects, best use)</a></p>
    <ul class="links">
      <li><a target="_blank" href="${LINKS.sanderPdf}">Epilepsy Society (UK) - Antiepileptic drugs: dosing and adverse-effect tables (PDF)</a></li>
      <li><a target="_blank" href="${LINKS.ontarioPdf}">Ontario Clinical Guidelines for the Management of Epilepsy, v2.0 2020 (PDF)</a></li>
    </ul>
    <div class="grid">
      <div><label class="f">Drug</label><select id="aedSel">${AED_DATA.map(x => `<option value="${x.id}" ${x.id === a.id ? "selected" : ""}>${esc(x.name)}${aedIdsOn().includes(x.id) ? " (on med list)" : ""}</option>`).join("")}</select></div>
      <div><label class="f">Filter table by seizure type</label><select id="aedFilt">
        <option value="all">All</option>${Object.entries(SPEC).map(([k, v]) => `<option value="${k}" ${k === filt ? "selected" : ""}>${v}${k === sp ? " (this patient)" : ""}</option>`).join("")}</select></div>
    </div>
  </div>
  <div class="card"><h2>${esc(a.name)} ${a.brand ? `<span class="muted">(${esc(a.brand)})</span>` : ""} ${a.iv ? '<span class="pill p-grn">IV available</span>' : '<span class="pill p-gry">Oral only</span>'}</h2>
    <p>${a.spectrum.map(s => `<span class="pill p-blu">${SPEC[s]}</span>`).join("")}${a.worsens.map(s => `<span class="pill p-red">May worsen ${SPEC[s]}</span>`).join("")}</p>
    <table>
      <tr><th style="width:170px">Starting dose</th><td>${esc(a.start)}</td></tr>
      <tr><th>Titration</th><td>${esc(a.titrate)}</td></tr>
      <tr><th>Target (maintenance)</th><td>${esc(a.target)}</td></tr>
      <tr><th>Maximum</th><td>${esc(a.max)}</td></tr>
      <tr><th>Loading / IV</th><td>${esc(a.load)}</td></tr>
      <tr><th>Renal / hepatic</th><td>${esc(a.renal)}</td></tr>
      <tr><th>Levels</th><td>${esc(a.levels)}</td></tr>
      <tr><th>Side effects</th><td>${esc(a.se)}</td></tr>
      <tr><th>Monitor</th><td>${esc(a.monitor)}</td></tr>
      <tr><th>Best suited for</th><td>${esc(a.best)}</td></tr>
      <tr><th>Avoid / caution</th><td>${esc(a.avoid)}</td></tr>
      ${a.interact ? `<tr><th>Interactions</th><td>${esc(a.interact)}</td></tr>` : ""}
    </table>
  </div>
  <div class="card"><h2>Comparison table</h2>
    <table><tr><th>Drug</th><th>Start</th><th>Target</th><th>Key side effects</th><th>Suited for</th></tr>
    ${list.map(x => `<tr><td><b>${esc(x.name)}</b>${x.iv ? ' <span class="pill p-grn">IV</span>' : ""}</td><td>${esc(x.start)}</td><td>${esc(x.target)}</td><td>${esc(x.se)}</td><td>${x.spectrum.map(s => SPEC[s]).join(", ")}${x.worsens.length ? `<br><span class="muted">worsens: ${x.worsens.map(s => SPEC[s]).join(", ")}</span>` : ""}</td></tr>`).join("")}
    </table>
  </div>`;
  $("#aedSel").onchange = () => renderAED(state());
  $("#aedFilt").onchange = () => renderAED(state());
}

function followUpItems(st) {
  const ids = aedIdsOn(); const items = [];
  const add = (when, what, show = true) => show && items.push([when, what]);
  const first = st.presentation === "first";
  add("Before discharge", "Driving advice given and documented (see Driving tab); patient told not to drive until cleared");
  add("Before discharge", "Safety counselling: showers not baths, no swimming alone, heights/ladders, power tools, cooking (back burners), sleep and alcohol; seizure first aid for family; SUDEP discussed when epilepsy diagnosed");
  add("Before discharge", "Rescue plan for prolonged (&gt;5 min) or cluster seizures; when to call 911", st.epilepsyDx || st.presentation === "status");
  add("Before discharge", "AED prescription, dose titration schedule written out, adherence aids (blister pack, phone alarms)", ids.length > 0 || st.epilepsyDx);
  add("Within 2-4 weeks", "Neurology / first seizure clinic referral (urgent if recurrent seizures, abnormal imaging/EEG, or AED started)", first);
  add("Within 2-4 weeks", "Outpatient EEG (sleep-deprived if routine normal) if not done in hospital", first && !reportFor("eeg"));
  add("Within 4-6 weeks", "Outpatient MRI brain (epilepsy protocol) if not done in hospital", (first || st.cause === "unknown") && !reportFor("mri"));
  add("1-2 weeks", "Family physician visit: tolerability, mood, adherence, titration progress", true);
  add("2-4 weeks", "Sodium (oxcarbazepine, carbamazepine, eslicarbazepine)", ids.some(i => ["oxc", "cbz", "esl"].includes(i)));
  add("2-4 weeks then every 3-6 months", "CBC/platelets, LFTs, ammonia if confused (valproate)", ids.includes("vpa"));
  add("First 8 weeks", "Watch for rash - stop lamotrigine and seek care if rash with fever/mucosal involvement", ids.includes("ltg"));
  add("4 weeks", "Bicarbonate, renal function (topiramate, zonisamide)", ids.some(i => ["tpm", "zns"].includes(i)));
  add("At each visit", "Mood/behaviour screen (all AEDs carry suicidality warning; especially levetiracetam, perampanel, topiramate)", ids.length > 0);
  add("Ongoing", "Bone health: vitamin D, consider BMD (enzyme inducers, long-term valproate)", ids.some(i => ["cbz", "pht", "pb", "vpa"].includes(i)));
  add("Ongoing", "Folic acid, contraception review (enzyme-inducer interaction), pregnancy planning with neurology; avoid valproate", st.wocbp);
  add("After trigger correction", "Recheck the provoking abnormality (Na, glucose, etc.) and stop any temporary AED at follow-up if cause resolved", st.cause === "prov_metabolic");
  add("3 months", "Reassess AED need after acute structural cause (stroke, TBI, encephalitis); late seizures = epilepsy", st.cause === "prov_structural");
  add("Before discharge", "Addiction medicine referral; driving requires addiction treatment report", st.cause === "alcohol");
  add("Ongoing", "Breakthrough seizures despite 2 appropriate AEDs = drug-resistant: refer to comprehensive epilepsy program for surgery/device evaluation", st.presentation === "breakthrough");
  add("Driving date", "Reassess fitness to drive; complete DMER if requested by RoadSafetyBC", st.driver !== "none");
  return items;
}
function renderFU(st) {
  const items = followUpItems(st);
  $("#t-fu").innerHTML = `
  <div class="card"><h2>Follow-up plan</h2>
    <table><tr><th style="width:160px">When</th><th>What</th></tr>
    ${items.map(([w, t]) => `<tr><td><b>${w}</b></td><td><label class="chk"><input type="checkbox"> ${t}</label></td></tr>`).join("")}
    </table>
  </div>
  <div class="card"><h2>Patient resources</h2>
    <ul class="links">
      <li><a target="_blank" href="${LINKS.bcEpilepsy}">BC Epilepsy Society - patient education and support</a></li>
      <li><a target="_blank" href="${LINKS.bcSeizure}">RoadSafetyBC seizure driving standards</a></li>
    </ul>
  </div>`;
}

function buildNote(st) {
  const dr = drivingRule(st);
  const earliest = dr.months != null && dr.from ? fmtDate(addMonths(dr.from, dr.months)) : null;
  const ids = [...new Set(aedIdsOn())];
  const aeds = S.meds.filter(m => AED_MATCH.some(([, re]) => re.test(medName(m)))).map(m => (medName(m).includes(medDose(m)) ? medName(m) : `${medName(m)} ${medDose(m)}`).trim());
  const acute = acuteSymptomaticFlags().map(x => x.replace(/&lt;/g, "<").replace(/&gt;/g, ">"));
  const flags = medFlags(st).map(([, t]) => "- " + t.replace(/<[^>]+>/g, ""));
  const ix = [];
  for (const k of ["sodium", "glucose", "calcium", "magnesium", "creatinine", "phenytoin", "valproate", "carbamazepine"]) { const l = latest(k); if (l) ix.push(`${LABS[k].label} ${l.si != null ? round(l.si) : l.v} ${SI_UNIT[k] || l.unit}`); }
  const rep = ["ct", "mri", "eeg"].map(k => { const r = reportFor(k); return `${REPORTS[k].label}: ${r ? `${repDate(r)} ${repConcl(r)}`.trim() : "not done / pending"}`; });
  const fu = followUpItems(st).map(([w, t]) => `- ${t.replace(/&gt;/g, ">")} (${w})`);
  const p = S.patient;
  return [
`SEIZURE - ASSESSMENT & PLAN`,
`${p ? `${p.name}, ${p.age ?? "?"} ${p.gender || ""}` : ""}`.trim(),
``,
`Assessment: ${PRES_LABEL[st.presentation]}, ${STYPE_LABEL[st.stype]}, ${CAUSE_LABEL[st.cause]}${st.lastSz ? `, last seizure ${fmtDate(st.lastSz)}` : ""}.`,
acute.length ? `Meets ILAE acute-symptomatic threshold: ${acute.join("; ")}.` : ``,
`Current AEDs: ${aeds.length ? aeds.join("; ") : "none"}.`,
ix.length ? `Key labs: ${ix.join(", ")}.` : ``,
rep.join("\n"),
flags.length ? `Medication flags:\n${flags.join("\n")}` : ``,
``,
`Plan:`,
`- Investigations: [edit] e.g. lytes/Ca/Mg/glucose, AED levels, EEG, MRI brain epilepsy protocol.`,
`- Treatment: [edit] __________________`,
`- Decision: ____________________________`,
``,
`Driving: ${st.driver === "none" ? "Patient does not drive." : `Advised not to drive. CCMTA/RoadSafetyBC ${dr.section} (${dr.title}): ${dr.text}${dr.months != null ? ` Can drive in ${waitText(dr.months)}${earliest ? ` (on or after ${earliest})` : ""} if seizure-free and conditions met.` : " No fixed waiting period; may drive once the conditions above are met."}`}`,
``,
`Follow-up:`,
...fu
  ].filter((l, i, a) => !(l === "" && a[i - 1] === "")).join("\n");
}

// ---------- RoadSafetyBC report (MV2351) ----------
const store = {
  get(k, d) { try { const v = localStorage.getItem("seizure." + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem("seizure." + k, JSON.stringify(v)); } catch (e) { /* storage blocked */ } }
};
const MV = { built: false, dirty: { details: false, further: false } };
const ymd = d => d ? fmtDate(d).replace(/-/g, "/") : "";
function mvDetails(st) {
  const ids = S.meds.filter(m => AED_MATCH.some(([, re]) => re.test(medName(m)))).map(m => medName(m));
  const lv = ["phenytoin", "phenytoinFree", "valproate", "carbamazepine", "phenobarb", "lamotrigine", "levetiracetam"].map(k => latest(k)).filter(Boolean).map(l => `${LABS[l.key].label} ${l.si != null ? round(l.si) : l.v} ${l.si != null && LABS[l.key].lvl ? "umol/L" : l.unit} (${fmtDate(l.t)})`);
  const acute = acuteSymptomaticFlags().map(x => x.replace(/&lt;/g, "<").replace(/&gt;/g, ">"));
  const reps = ["ct", "mri", "eeg"].map(k => { const r = reportFor(k); return r ? `${REPORTS[k].label} ${repDate(r)}: ${repConcl(r)}` : null; }).filter(Boolean);
  return [
    `Diagnosis: ${PRES_LABEL[st.presentation]} - ${STYPE_LABEL[st.stype]}, ${CAUSE_LABEL[st.cause]}${st.epilepsyDx ? "; epilepsy diagnosed" : ""}.`,
    `Most recent seizure: ${st.lastSz ? fmtDate(st.lastSz) : "[date]"}.${st.notBaseline ? " Not back to baseline at time of report." : ""} Seizures cause sudden loss of awareness and control (risk of sudden incapacitation).`,
    acute.length ? `Provoking factors: ${acute.join("; ")}.` : "",
    `Antiseizure medication: ${ids.length ? ids.join("; ") : "none"}.${lv.length ? " Levels: " + lv.join("; ") + "." : ""}`,
    reps.length ? `Investigations: ${reps.join(" ")}` : "Investigations: [EEG / imaging pending].",
    `Treatment adherence / seizure control: [edit]. Insight into driving restriction: [edit].`
  ].filter(Boolean).join("\n");
}
function mvFurther(st) {
  const dr = drivingRule(st);
  const d = dr.months != null && dr.from ? fmtDate(addMonths(dr.from, dr.months)) : null;
  return [
    `Patient advised not to drive on ${fmtDate(today())}.`,
    dr.section ? `Applicable standard: CCMTA ${dr.section} (${dr.title}). ${dr.months != null ? `May be fit to drive in ${waitText(dr.months)}${d ? ` (on or after ${d})` : ""} if seizure-free and conditions met.` : dr.text}` : "",
    dr.conditions.length ? `Conditions: ${dr.conditions.join("; ")}.` : "",
    `Recommend licence not be reinstated until the seizure-free period is met, with a Driver's Medical Examination Report / neurology assessment at that time.`
  ].filter(Boolean).join(" ");
}
function physicians() { return store.get("physicians", []); }
function renderReport(st) {
  const box = $("#mvReport"); if (!box) return;
  if (!MV.built) {
    MV.built = true;
    const p = S.patient || {};
    const phs = physicians(), last = store.get("lastPhysician", phs.length ? 0 : "new");
    box.innerHTML = `
    <div class="card"><h2>Report to RoadSafetyBC - MV2351 (filled PDF)</h2>
      <div class="info"><b>When you must report (Motor Vehicle Act s. 230):</b> the patient has a medical condition that makes it dangerous to drive <i>and</i> continues to drive after being warned. You may also report concerns that do not meet this. Uncontrolled seizures are a listed example. No action for damages lies for a report made in good faith (s. 230(3)).<br>
      Fax the signed form to <b>250-952-6888</b> (printed on the form). RoadSafetyBC nurse case manager: <b>250-953-8612</b> (Mon-Fri 8:30-4:30).</div>
      <h3>Patient</h3>
      <div class="mvgrid">
        <div><label class="f">Name</label><input type="text" id="mvName" value="${esc([p.given, p.family].filter(Boolean).join(" ") || p.name || "")}"></div>
        <div><label class="f">Date of birth (YYYY/MM/DD)</label><input type="text" id="mvDob" value="${esc(ymd(p.birthDate))}"></div>
        <div><label class="f">Driver's licence # (if known)</label><input type="text" id="mvLic" placeholder="Not in Cerner - ask patient"></div>
        <div><label class="f">Address</label><input type="text" id="mvAddr" value="${esc(p.address || "")}"></div>
        <div><label class="f">City</label><input type="text" id="mvCity" value="${esc(p.city || "")}"></div>
        <div><label class="f">Postal code</label><input type="text" id="mvPostal" value="${esc(p.postal || "")}"></div>
      </div>
      <h3>Clinician</h3>
      <div class="mvgrid">
        <div><label class="f">Saved clinicians (this browser only)</label><select id="mvPhSel">${phs.map((x, i) => `<option value="${i}" ${String(last) === String(i) ? "selected" : ""}>${esc(x.name)}</option>`).join("")}<option value="new" ${last === "new" ? "selected" : ""}>Other / new clinician...</option></select></div>
        <div><label class="f">Name</label><input type="text" id="mvPhName"></div>
        <div><label class="f">Phone</label><input type="text" id="mvPhPhone"></div>
        <div><label class="f">Secure fax for receipt confirmation</label><input type="text" id="mvPhFax"></div>
        <div><label class="f">Qualification</label><select id="mvPhQual"><option value="family">Family physician</option><option value="specialist">Specialist physician</option><option value="np">Nurse practitioner</option><option value="other">Other (type below)</option></select></div>
        <div><label class="f">Other qualification</label><input type="text" id="mvPhOther" placeholder="e.g. Hospitalist"></div>
        <div><label class="f">Patient under your care for</label><input type="text" id="mvCare" placeholder="e.g. 3 days (admission)"></div>
      </div>
      <div style="margin-top:6px;display:flex;gap:8px;flex-wrap:wrap"><button class="btn sec" id="mvPhSave">Save clinician on this computer</button><button class="btn sec" id="mvPhDel">Remove saved clinician</button>
        <span class="muted">Clinician details are kept in this browser only - none are stored in the app (public repo).</span></div>
      <h3>Form boxes</h3>
      <div class="mvgrid">
        <div><label class="chk"><input type="checkbox" id="mvOpinion" checked> In my opinion the patient has a condition that puts the public or themselves at risk when driving</label>
             <label class="chk"><input type="checkbox" id="mvContinues"> Patient continues to drive after being warned (s. 230 duty)</label></div>
        <div><b class="muted">Impairments</b>
             <label class="chk"><input type="checkbox" id="mvSudden" checked> Risk of sudden incapacitation</label>
             <label class="chk"><input type="checkbox" id="mvMotor"> Motor</label>
             <label class="chk"><input type="checkbox" id="mvCog"> Cognitive</label>
             <label class="chk"><input type="checkbox" id="mvOther"> Other</label></div>
        <div><b class="muted">Optional recommendations</b>
             <label class="chk"><input type="checkbox" id="mvRecCancel"> Recommend cancellation of driver's licence</label>
             <label class="chk"><input type="checkbox" id="mvRecMed" checked> Recommend further medical assessment</label>
             <label class="chk"><input type="checkbox" id="mvRecDrive"> Recommend driving assessment</label></div>
      </div>
      <h3>Details of medical condition <span class="muted">(auto-filled; edit freely - long text continues on an attached page)</span></h3>
      <textarea id="mvDetails" rows="7"></textarea>
      <h3>Further recommendations</h3>
      <textarea id="mvFurther" rows="4"></textarea>
      <div style="display:flex;gap:8px;align-items:center;margin-top:8px;flex-wrap:wrap">
        <label class="f" style="margin:0">Date</label><input type="date" id="mvDate" value="${today()}" style="width:auto">
        <button class="btn sec" id="mvRebuild">Rebuild text from chart</button>
        <button class="btn" id="mvGen">Create filled MV2351 PDF</button>
        <span id="mvMsg" class="muted"></span>
      </div>
      <p class="muted">Signature is left blank - print, sign and fax. Official form: <a target="_blank" href="https://www2.gov.bc.ca/assets/gov/driving-and-transportation/driving/roadsafetybc/medical-fitness/medical-prof/mv2351_condition_affecting_ability_to_drive_2022may.pdf">MV2351 (RoadSafetyBC)</a> &middot; <a target="_blank" href="https://www2.gov.bc.ca/gov/content/transportation/driving-and-cycling/roadsafetybc/medical-fitness/medical-prof/reporting-person">Reporting a patient who may be unfit to drive</a></p>
    </div>`;
    const loadPh = () => {
      const v = $("#mvPhSel").value, x = v === "new" ? {} : (physicians()[+v] || {});
      $("#mvPhName").value = x.name || ""; $("#mvPhPhone").value = x.phone || ""; $("#mvPhFax").value = x.fax || "";
      $("#mvPhQual").value = x.qual || "other"; $("#mvPhOther").value = x.otherQual ?? "Hospitalist";
      store.set("lastPhysician", v === "new" ? "new" : +v);
    };
    const phOptions = sel => { $("#mvPhSel").innerHTML = physicians().map((x, i) => `<option value="${i}">${esc(x.name)}</option>`).join("") + `<option value="new">Other / new clinician...</option>`; $("#mvPhSel").value = String(sel); };
    $("#mvPhSel").onchange = loadPh; loadPh();
    $("#mvPhSave").onclick = () => {
      const x = { name: $("#mvPhName").value.trim(), phone: $("#mvPhPhone").value.trim(), fax: $("#mvPhFax").value.trim(), qual: $("#mvPhQual").value, otherQual: $("#mvPhOther").value.trim() };
      if (!x.name) { $("#mvMsg").textContent = "Enter the clinician name first."; return; }
      const list = physicians(), v = $("#mvPhSel").value, i = list.findIndex(y => y.name === x.name);
      if (v !== "new") list[+v] = x; else if (i >= 0) list[i] = x; else list.push(x);
      const idx = list.findIndex(y => y.name === x.name);
      store.set("physicians", list); store.set("lastPhysician", idx);
      phOptions(idx); $("#mvMsg").textContent = "Saved " + x.name + " on this computer.";
    };
    $("#mvPhDel").onclick = () => {
      const v = $("#mvPhSel").value; if (v === "new") return;
      const list = physicians(); list.splice(+v, 1); store.set("physicians", list); store.set("lastPhysician", "new");
      phOptions("new"); loadPh();
    };
    $("#mvDetails").oninput = () => MV.dirty.details = true;
    $("#mvFurther").oninput = () => MV.dirty.further = true;
    $("#mvRebuild").onclick = () => { MV.dirty = { details: false, further: false }; renderReport(state()); };
    $("#mvGen").onclick = () => mvGenerate();
  }
  if (!MV.dirty.details) $("#mvDetails").value = mvDetails(st);
  if (!MV.dirty.further) $("#mvFurther").value = mvFurther(st);
}
let MV_TEMPLATE = null;
async function mvGenerate() {
  const msg = t => $("#mvMsg").textContent = t;
  try {
    if (!window.PDFLib || !window.MV2351Fill) throw new Error("PDF library did not load (check internet access to cdn.jsdelivr.net).");
    if (!MV_TEMPLATE) { const r = await fetch("mv2351-roadsafetybc.pdf"); if (!r.ok) throw new Error("Could not load mv2351-roadsafetybc.pdf (" + r.status + ")"); MV_TEMPLATE = await r.arrayBuffer(); }
    const v = id => $("#" + id).value.trim(), c = id => $("#" + id).checked;
    if (!v("mvPhName")) { msg("Enter the clinician name."); return; }
    const bytes = await window.MV2351Fill.fillMV2351(window.PDFLib, MV_TEMPLATE.slice(0), {
      patient: { name: v("mvName"), address: v("mvAddr"), city: v("mvCity"), postal: v("mvPostal"), dob: v("mvDob"), licence: v("mvLic") },
      clinician: { name: v("mvPhName"), phone: v("mvPhPhone"), fax: v("mvPhFax"), qual: v("mvPhQual"), otherQual: v("mvPhOther"), lengthOfCare: v("mvCare") },
      boxes: { opinionRisk: c("mvOpinion"), continuesToDrive: c("mvContinues"), impSudden: c("mvSudden"), impMotor: c("mvMotor"), impCognitive: c("mvCog"), impOther: c("mvOther"),
               recCancel: c("mvRecCancel"), recMedical: c("mvRecMed"), recDriving: c("mvRecDrive") },
      details: $("#mvDetails").value, further: $("#mvFurther").value, date: ymd($("#mvDate").value),
      attachTitle: "Attachment to MV2351 - seizure details"
    });
    const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
    const a = document.createElement("a"); a.href = url; a.download = `MV2351_RoadSafetyBC_${(v("mvName") || "patient").replace(/\W+/g, "_")}.pdf`;
    document.body.appendChild(a); a.click(); a.remove(); window.open(url, "_blank");
    setTimeout(() => URL.revokeObjectURL(url), 120000);
    msg("Created. Review, sign and fax to 250-952-6888.");
  } catch (e) { msg("Error: " + e.message); console.error(e); }
}

// ---------- FHIR loading ----------
async function loadFHIR(client) {
  const pid = client.patient.id;
  const req = async url => { try { return await client.request(url, { pageLimit: 3, flat: true }); } catch (e) { console.warn("FHIR failed", url, e); return []; } };
  const since7 = daysAgo(7).toISOString().slice(0, 10), since365 = daysAgo(365).toISOString().slice(0, 10);
  const [pt, labs, wt, meds, conds, reps] = await Promise.all([
    client.patient.read().catch(() => null),
    req(`Observation?patient=${pid}&category=laboratory&date=ge${since7}&_count=200`),
    req(`Observation?patient=${pid}&code=http://loinc.org|29463-7,http://loinc.org|3141-9&_count=10`),
    req(`MedicationRequest?patient=${pid}&_count=100`),
    req(`Condition?patient=${pid}&_count=100`),
    req(`DiagnosticReport?patient=${pid}&date=ge${since365}&_count=100`)
  ]);
  return { pt, labs, wt, meds, conds, reps };
}
function ingest({ pt, labs, wt, meds, conds, reps }) {
  if (pt) {
    const n = pt.name?.[0];
    const name = n?.text || [n?.given?.join(" "), n?.family].filter(Boolean).join(" ") || "Patient";
    const age = pt.birthDate ? Math.floor((Date.now() - new Date(pt.birthDate)) / 3.15576e10) : null;
    const mrn = pt.identifier?.find(i => /mrn|medical record/i.test(i.type?.text || i.type?.coding?.[0]?.display || ""))?.value || pt.identifier?.[0]?.value || "";
    const ad = (pt.address || []).find(a => a.use === "home") || (pt.address || [])[0] || {};
    const phone = (pt.telecom || []).find(t => t.system === "phone")?.value || "";
    S.patient = { name, age, gender: pt.gender, birthDate: pt.birthDate, mrn, family: n?.family || "", given: (n?.given || []).join(" "),
      address: (ad.line || []).join(", ") || ad.text || "", city: ad.city || "", postal: ad.postalCode || "", phone };
  }
  S.labs = (labs || []).map(o => {
    const key = classifyObs(o); if (!key) return null;
    const v = o.valueQuantity?.value ?? null, unit = o.valueQuantity?.unit || o.valueQuantity?.code || "";
    return { key, v, unit, si: v != null ? toSI(key, v, unit) : null, t: new Date(o.effectiveDateTime || o.issued || 0), text: o.valueString || o.valueCodeableConcept?.text || o.interpretation?.[0]?.text };
  }).filter(Boolean);
  const w = (wt || []).filter(o => o.valueQuantity).sort((a, b) => new Date(b.effectiveDateTime || 0) - new Date(a.effectiveDateTime || 0))[0];
  if (w) { let kg = w.valueQuantity.value; if (/lb/i.test(w.valueQuantity.unit || "")) kg = kg * 0.4536; S.weight = Math.round(kg * 10) / 10; }
  const all = meds || [];
  S.meds = all.filter(m => ["active", "on-hold", "draft"].includes(m.status));
  const cutoff = daysAgo(30);
  S.stoppedMeds = all.filter(m => ["stopped", "completed", "cancelled"].includes(m.status) && AED_MATCH.some(([, re]) => re.test(medName(m)))
    && new Date(m.authoredOn || 0) > cutoff && !S.meds.some(a => medName(a).split(" ")[0].toLowerCase() === medName(m).split(" ")[0].toLowerCase()));
  S.conds = (conds || []).filter(c => !c.clinicalStatus || /active|recurrence|relapse/i.test(c.clinicalStatus?.coding?.[0]?.code || c.clinicalStatus?.text || "active"));
  S.reports = reps || [];
}
function prefill() {
  const p = S.patient;
  if (p) {
    $("#banner").innerHTML = `<b>${esc(p.name)}</b> &nbsp; ${p.age ?? "?"} y ${esc(p.gender || "")} &nbsp; DOB ${esc(p.birthDate || "")}${p.mrn ? ` &nbsp; MRN ${esc(p.mrn)}` : ""}${S.demo ? '<span class="demo">DEMO PATIENT</span>' : ""}`;
    if (p.gender === "female" && p.age >= 12 && p.age <= 50) $("#wocbp").checked = true;
  }
  if (S.weight) $("#weight").value = S.weight;
  const epi = S.conds.some(c => /epilep|seizure disorder/i.test(condText(c)));
  if (epi) { $("#presentation").value = "breakthrough"; $("#epilepsyDx").checked = true; }
  if (hasCond(/status epilepticus/i)) { $("#presentation").value = "status"; $("#notBaseline").checked = true; }
  if (!epi && hasCond(/unprovoked seizure|first seizure|new.onset seizure/i)) { $("#presentation").value = "first"; $("#cause").value = "unprovoked"; }
  if (hasCond(/alcohol (use|dependence|abuse|withdrawal)/i)) $("#aud").checked = true;
  if (acuteSymptomaticFlags().length) $("#cause").value = "prov_metabolic"; // provoked; the epilepsy driving standard still applies if epilepsy is ticked
  $("#lastSz").value = today();
}

// ---------- Demo patients (made up) ----------
// ?demo=1..3 come from demo-patients.js (same patients as test-pdfs/); ?demo=4 is the valproate + meropenem patient below.
function demoFrom(D) {
  const d = h => new Date(Date.now() - h * 36e5).toISOString();
  return {
    pt: D.pt,
    labs: D.labs.map(l => ({ resourceType: "Observation", code: { text: l.text, coding: l.loinc ? [{ system: "http://loinc.org", code: l.loinc }] : [] }, valueQuantity: l.v != null ? { value: l.v, unit: l.unit } : undefined, effectiveDateTime: d(l.h) })),
    wt: [{ valueQuantity: { value: D.weight, unit: "kg" }, effectiveDateTime: d(1) }],
    meds: D.meds.map(t => ({ status: "active", medicationCodeableConcept: { text: t } })),
    conds: D.conds.map(t => ({ code: { text: t }, clinicalStatus: { coding: [{ code: "active" }] } })),
    reps: D.reps.map(r => ({ code: { text: r.text }, effectiveDateTime: d(r.h), conclusion: r.conclusion }))
  };
}
function demoData(n) {
  if (n >= 1 && n <= 3 && window.SEIZURE_DEMOS && SEIZURE_DEMOS[n - 1]) return demoFrom(SEIZURE_DEMOS[n - 1]);
  return demoDana();
}
function demoDana() {
  const d = n => daysAgo(n).toISOString();
  const lab = (text, loinc, v, unit, n = 0) => ({ resourceType: "Observation", code: { text, coding: [{ system: "http://loinc.org", code: loinc }] }, valueQuantity: { value: v, unit }, effectiveDateTime: d(n) });
  return {
    pt: { resourceType: "Patient", name: [{ given: ["Dana"], family: "Testpatient" }], gender: "female", birthDate: "1991-04-12", identifier: [{ type: { text: "MRN" }, value: "DEMO-0042" }], address: [{ use: "home", line: ["100 Example Street"], city: "Victoria", postalCode: "V8Z 0A0" }] },
    labs: [lab("Sodium", "2951-2", 132, "mmol/L"), lab("Glucose", "2345-7", 6.1, "mmol/L"), lab("Calcium", "17861-6", 2.31, "mmol/L"),
      lab("Magnesium", "19123-9", 0.72, "mmol/L"), lab("Creatinine", "2160-0", 68, "umol/L"), lab("eGFR", "33914-3", 98, "mL/min/1.73m2"),
      lab("Albumin", "1751-7", 31, "g/L"), lab("ALT", "1742-6", 22, "U/L"), lab("WBC", "6690-2", 11.2, "x10^9/L"), lab("CK", "2157-6", 640, "U/L"),
      lab("Lactate", "2524-7", 3.4, "mmol/L", 0.9), lab("Valproic acid level", "4086-5", 210, "umol/L")],
    wt: [{ valueQuantity: { value: 64, unit: "kg" }, effectiveDateTime: d(1) }],
    meds: [
      { status: "active", medicationCodeableConcept: { text: "divalproex sodium (Epival) 500 mg PO BID" }, dosageInstruction: [{ text: "500 mg PO BID" }] },
      { status: "active", medicationCodeableConcept: { text: "meropenem 1 g IV q8h" }, dosageInstruction: [{ text: "1 g IV q8h" }] },
      { status: "active", medicationCodeableConcept: { text: "levonorgestrel-ethinyl estradiol" }, dosageInstruction: [{ text: "1 tab daily" }] },
      { status: "active", medicationCodeableConcept: { text: "tramadol 50 mg PO q6h PRN" }, dosageInstruction: [{ text: "50 mg q6h PRN" }] }
    ],
    conds: [{ code: { text: "Epilepsy, generalized" }, clinicalStatus: { coding: [{ code: "active" }] }, onsetDateTime: "2014-06-01" },
      { code: { text: "Pyelonephritis" }, clinicalStatus: { coding: [{ code: "active" }] } }],
    reps: [{ code: { text: "CT Head without contrast" }, effectiveDateTime: d(1), conclusion: "No acute intracranial abnormality." },
      { code: { text: "ECG 12 lead" }, effectiveDateTime: d(1), conclusion: "Sinus tachycardia, QTc 438 ms." }]
  };
}

// ---------- Wiring ----------
function wire() {
  document.querySelectorAll("#tabs button").forEach(b => b.onclick = () => {
    document.querySelectorAll("#tabs button").forEach(x => x.classList.toggle("on", x === b));
    document.querySelectorAll(".tab").forEach(t => t.classList.toggle("on", t.id === "t-" + b.dataset.t));
  });
  $("#classify").addEventListener("change", render);
  $("#classify").addEventListener("input", e => { if (e.target.type === "number") render(); });
  $("#note").addEventListener("input", () => S.noteDirty = true);
  $("#rebuildNote").onclick = () => { S.noteDirty = false; $("#note").value = buildNote(state()); };
  $("#copyNote").onclick = async () => {
    try { await navigator.clipboard.writeText($("#note").value); } catch { $("#note").select(); document.execCommand("copy"); }
    $("#copied").textContent = "Copied"; setTimeout(() => $("#copied").textContent = "", 1500);
  };
}

async function start() {
  wire();
  const dm = /[?&]demo=(\d+)/.exec(location.search), demo = !!dm;
  try {
    if (demo) throw new Error("demo");
    const client = await FHIR.oauth2.ready();
    ingest(await loadFHIR(client));
  } catch (e) {
    if (!demo) {
      // Never fall back to the made-up patient silently - it could be mistaken for the real chart.
      $("#banner").textContent = "Not connected";
      $("#t-summary").innerHTML = `<div class="card"><div class="alert"><b>Not launched from the EHR</b> (${esc(e.message || e)}).<br>Launch via launch.html from PowerChart / the Cerner sandbox, or open <a href="?demo=1">demo mode</a> with a made-up patient.</div></div>`;
      return;
    }
    S.demo = true; ingest(demoData(+dm[1]));
  }
  prefill(); render();
  if (S.demo) $("main").insertAdjacentHTML("afterbegin", `<div class="warn" style="margin-bottom:10px"><b>DEMO - made-up patient.</b> Not real chart data. Other demos: <a href="?demo=1">1 new onset</a> &middot; <a href="?demo=2">2 breakthrough</a> &middot; <a href="?demo=3">3 status</a> &middot; <a href="?demo=4">4 valproate + carbapenem</a></div>`);
}
window.SeizureApp = { S, drivingRule, state, toSI, render };
start();
})();
