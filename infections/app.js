/* Infections by Site - SMART on FHIR (Cerner). UNVERIFIED draft written by Claude; content lives in infections-data.js.
 * Reads: Patient, Observation (labs 7 days, vitals 48 h), MedicationRequest, Condition, DiagnosticReport (30 days), AllergyIntolerance.
 * Open index.html?demo=1..4 for made-up patients (same as test-pdfs/).
 */
(() => {
"use strict";
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const fmtDate = d => d ? new Date(d).toLocaleDateString("en-CA") : "";
const fmtDT = d => d ? new Date(d).toLocaleString("en-CA", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "";
const daysAgo = n => new Date(Date.now() - n * 864e5);
const round = x => (Math.abs(x) >= 100 ? Math.round(x) : Math.round(x * 10) / 10);

const S = { patient: null, labs: [], vitals: [], meds: [], conds: [], reports: [], allergies: [], demo: false,
            site: null, tier: null, confused: false, open: {}, pen: { recent: false, severe: false, treated: false }, noteDirty: false };

// ---------- Labs ----------
const LABS = {
  wbc: { re: /\bwbc\b|white blood|leukocyte/i, loinc: ["6690-2", "26464-8"], label: "WBC", unit: "x10^9/L" },
  hgb: { re: /hemoglobin(?!\s*a1c)|haemoglobin|\bhgb\b/i, loinc: ["718-7"], label: "Hemoglobin", unit: "g/L" },
  plt: { re: /platelet/i, loinc: ["777-3", "26515-7"], label: "Platelets", unit: "x10^9/L" },
  sodium: { re: /\bsodium\b/i, loinc: ["2951-2", "2947-0"], label: "Sodium", unit: "mmol/L" },
  glucose: { re: /glucose/i, loinc: ["2345-7", "2339-0"], label: "Glucose", unit: "mmol/L" },
  creatinine: { re: /creatinine(?!.*(urine|clearance))/i, loinc: ["2160-0"], label: "Creatinine", unit: "umol/L" },
  egfr: { re: /egfr|glomerular/i, loinc: ["33914-3", "62238-1", "98979-8"], label: "eGFR", unit: "mL/min" },
  urea: { re: /\burea\b|\bbun\b|urea nitrogen/i, loinc: ["3094-0", "22664-7"], label: "Urea", unit: "mmol/L" },
  crp: { re: /c.?reactive|\bcrp\b/i, loinc: ["1988-5", "30522-7"], label: "CRP", unit: "mg/L" },
  pct: { re: /procalcitonin/i, loinc: ["33959-8"], label: "Procalcitonin", unit: "ug/L" },
  lactate: { re: /lactate(?! dehydrogenase)|lactic acid/i, loinc: ["2524-7", "32693-4"], label: "Lactate", unit: "mmol/L" },
  albumin: { re: /^albumin/i, loinc: ["1751-7"], label: "Albumin", unit: "g/L" },
  esr: { re: /sed(imentation)? rate|\besr\b/i, loinc: ["4537-7"], label: "ESR", unit: "mm/h" },
  alt: { re: /\balt\b|alanine/i, loinc: ["1742-6"], label: "ALT", unit: "U/L" },
  ck: { re: /creatine kinase|\bck\b/i, loinc: ["2157-6"], label: "CK", unit: "U/L" },
  bili: { re: /bilirubin(?!.*(direct|conjugated|urine))/i, loinc: ["1975-2", "14631-6"], label: "Bilirubin", unit: "umol/L" },
  alp: { re: /alkaline phosphatase|\balp\b/i, loinc: ["6768-6"], label: "ALP", unit: "U/L" },
  ast: { re: /\bast\b|aspartate/i, loinc: ["1920-8"], label: "AST", unit: "U/L" },
  ggt: { re: /\bggt\b|gamma.?glutamyl/i, loinc: ["2324-2"], label: "GGT", unit: "U/L" },
  inr: { re: /\binr\b/i, loinc: ["6301-6", "34714-6"], label: "INR", unit: "" },
  lipase: { re: /lipase/i, loinc: ["3040-3"], label: "Lipase", unit: "U/L" }
};
function toSI(key, v, unit) {
  const u = (unit || "").toLowerCase().replace(/\s/g, "");
  const mgdl = u.includes("mg/dl");
  if (key === "glucose" && mgdl) return v / 18.016;
  if (key === "creatinine" && mgdl) return v * 88.4;
  if (key === "urea" && mgdl) return v * 0.357;
  if (key === "crp" && mgdl) return v * 10;
  if ((key === "hgb" || key === "albumin") && u.includes("g/dl")) return v * 10;
  if (key === "lactate" && mgdl) return v / 9.01;
  if (key === "bili" && mgdl) return v * 17.1;
  return v;
}
const obsName = o => o.code?.text || o.code?.coding?.[0]?.display || "";
const obsCodes = o => (o.code?.coding || []).map(c => c.code);
function classifyLab(o) {
  const n = obsName(o), c = obsCodes(o);
  for (const k of ["egfr", "ast", ...Object.keys(LABS).filter(x => x !== "egfr" && x !== "ast")]) { const L = LABS[k]; if (L.loinc.some(x => c.includes(x)) || L.re.test(n)) return k; }
  return null;
}
const latest = k => S.labs.filter(l => l.key === k && l.si != null).sort((a, b) => b.t - a.t)[0] || null;
const labTxt = k => { const l = latest(k); return l ? `${round(l.si)} ${LABS[k].unit}` : "-"; };

// ---------- Vitals ----------
const VIT = { temp: ["8310-5", /temp/i], hr: ["8867-4", /heart rate|pulse/i], rr: ["9279-1", /resp/i], spo2: ["59408-5", /spo2|oxygen sat|o2 sat/i], sbp: ["8480-6", /systolic/i], dbp: ["8462-4", /diastolic/i], wt: ["29463-7", /weight/i] };
function ingestVital(o, out) {
  const t = new Date(o.effectiveDateTime || o.issued || 0), codes = obsCodes(o), n = obsName(o);
  const push = (k, v) => v != null && out.push({ k, v, t });
  if (o.component && (codes.includes("85354-9") || /blood pressure/i.test(n))) {
    for (const c of o.component) { const cc = (c.code?.coding || []).map(x => x.code); if (cc.includes("8480-6")) push("sbp", c.valueQuantity?.value); if (cc.includes("8462-4")) push("dbp", c.valueQuantity?.value); }
    return;
  }
  for (const [k, [code, re]] of Object.entries(VIT)) if (codes.includes(code) || re.test(n)) {
    let v = o.valueQuantity?.value; if (v == null) return;
    if (k === "temp" && /f/i.test(o.valueQuantity?.unit || "") && v > 50) v = (v - 32) * 5 / 9;
    if (k === "wt" && /lb/i.test(o.valueQuantity?.unit || "")) v = v * 0.4536;
    push(k, v); return;
  }
}
const lastV = k => S.vitals.filter(v => v.k === k).sort((a, b) => b.t - a.t)[0] || null;
const maxV = (k, h = 24) => S.vitals.filter(v => v.k === k && v.t > Date.now() - h * 36e5).reduce((m, v) => (m == null || v.v > m.v ? v : m), null);
const minV = (k, h = 24) => S.vitals.filter(v => v.k === k && v.t > Date.now() - h * 36e5).reduce((m, v) => (m == null || v.v < m.v ? v : m), null);

// ---------- Medications ----------
const ABX = /amoxicillin|ampicillin|penicillin|cloxacillin|piperacillin|cefazolin|cephalexin|cefuroxime|ceftriaxone|cefotaxime|ceftazidime|cefepime|cefixime|cefprozil|ceftaroline|ertapenem|meropenem|imipenem|aztreonam|vancomycin|linezolid|daptomycin|clindamycin|doxycycline|minocycline|azithromycin|clarithromycin|erythromycin|ciprofloxacin|levofloxacin|moxifloxacin|sulfamethoxazole|trimethoprim|tmp-smx|septra|nitrofurantoin|fosfomycin|metronidazole|gentamicin|tobramycin|amikacin|rifampin|fidaxomicin|acyclovir|valacyclovir|fluconazole|tigecycline|tazobactam|clavulan/i;
const IMMUNO_MED = /prednisone|methylprednisolone|dexamethasone|hydrocortisone|tacrolimus|cyclosporin|mycophenolate|azathioprine|methotrexate|sirolimus|everolimus|rituximab|infliximab|adalimumab|etanercept|tocilizumab|cyclophosphamide|ibrutinib|teclistamab|chemotherapy/i;
const medName = m => m.medicationCodeableConcept?.text || m.medicationCodeableConcept?.coding?.[0]?.display || m.medicationReference?.display || "";
const medText = m => [medName(m), m.dosageInstruction?.[0]?.text].filter(Boolean).join(" ");
const isIV = m => /\b(iv|intravenous)\b/i.test(medText(m)) || /intravenous/i.test(m.dosageInstruction?.[0]?.route?.text || "");
const abxMeds = () => S.meds.filter(m => ABX.test(medName(m)));
const dayOf = m => m.authoredOn ? Math.max(1, Math.floor((Date.now() - new Date(m.authoredOn)) / 864e5) + 1) : null;

// ---------- Conditions / reports / allergies ----------
const condText = c => c.code?.text || c.code?.coding?.[0]?.display || "";
const hasCond = re => S.conds.some(c => re.test(condText(c)));
const repText = r => r.code?.text || r.code?.coding?.[0]?.display || "";
const repConcl = r => r.conclusion || r.conclusionCode?.[0]?.text || "";
const repDate = r => r.effectiveDateTime || r.issued;
const BETA = /penicillin|amoxicillin|ampicillin|cloxacillin|piperacillin|ceph|cef|carbapenem|meropenem|ertapenem|imipenem|beta.?lactam/i;
const SEVERE_RX = /anaphyla|angioedema|stevens|johnson|\bsjs\b|\bten\b|toxic epidermal|dress|blister|desquam|serum sickness|hypotension|airway|throat swelling/i;
const allergyName = a => a.code?.text || a.code?.coding?.[0]?.display || "";
const allergyReactions = a => (a.reaction || []).flatMap(r => (r.manifestation || []).map(m => m.text || m.coding?.[0]?.display || "")).filter(Boolean).join(", ");
const betaAllergies = () => S.allergies.filter(a => BETA.test(allergyName(a)));

function immunocompromised() {
  const why = [];
  S.conds.forEach(c => { if (/transplant|\bhiv\b|neutropeni|leuk[a]?emia|lymphoma|myeloma|chemotherapy|asplenia|splenectomy|immunodeficien/i.test(condText(c))) why.push(condText(c)); });
  S.meds.forEach(m => { if (IMMUNO_MED.test(medName(m))) why.push(medName(m)); });
  return [...new Set(why)];
}

// ---------- Scores ----------
function sepsis() {
  const rr = maxV("rr"), sbp = minV("sbp"), hr = maxV("hr"), t = maxV("temp"), tl = minV("temp"), lac = latest("lactate"), wbc = latest("wbc");
  const q = [rr && rr.v >= 22 ? `RR ${rr.v}` : null, sbp && sbp.v <= 100 ? `SBP ${sbp.v}` : null, S.confused ? "altered mentation" : null].filter(Boolean);
  const sirs = [(t && t.v > 38) || (tl && tl.v < 36) ? "temp" : null, hr && hr.v > 90 ? "HR" : null, rr && rr.v > 20 ? "RR" : null, wbc && (wbc.si > 12 || wbc.si < 4) ? "WBC" : null].filter(Boolean);
  const shock = (sbp && sbp.v < 90) || (lac && lac.si >= 4);
  return { q, qsofa: q.length, sirs, shock, lac, rr, sbp, hr, t, data: !!(rr || sbp || hr || t) };
}
// Tokyo Guidelines 2018 - acute cholangitis diagnosis and severity. Auto from chart; each item can be ticked/unticked.
function tg18() {
  const t = maxV("temp", 48), wbc = latest("wbc"), crp = latest("crp"), bili = latest("bili"), alp = latest("alp"), ggt = latest("ggt"), ast = latest("ast"), alt = latest("alt");
  const alb = latest("albumin"), cr = latest("creatinine"), inr = latest("inr"), plt = latest("plt"), sbp = minV("sbp", 48), spo2 = minV("spo2", 48), age = S.patient?.age;
  const img = S.reports.filter(r => /(us|ultrasound|ct|mri|mrcp|ercp|abdom)/i.test(repText(r))).map(repConcl).join(" ");
  const ov = S.tgOv || (S.tgOv = {});
  const it = (k, label, auto, src) => ({ k, label, on: ov[k] != null ? ov[k] : !!auto, auto: !!auto, src });
  const A = [it("a1", "Fever >38 C and/or shaking chills", t && t.v > 38, t ? `Tmax ${round(t.v)}` : "no temp"),
             it("a2", "Inflammation: WBC <4 or >10, or CRP >=10 mg/L", (wbc && (wbc.si < 4 || wbc.si > 10)) || (crp && crp.si >= 10), [wbc ? `WBC ${round(wbc.si)}` : "", crp ? `CRP ${round(crp.si)}` : ""].filter(Boolean).join(", ") || "none")];
  const B = [it("b1", "Jaundice: bilirubin >=34 umol/L (2 mg/dL)", bili && bili.si >= 34, bili ? `bili ${round(bili.si)}` : "no bilirubin"),
             it("b2", "Abnormal liver tests >1.5x ULN (ALP >180, GGT >90, AST/ALT >60)", (alp && alp.si > 180) || (ggt && ggt.si > 90) || (ast && ast.si > 60) || (alt && alt.si > 60), [alp ? `ALP ${round(alp.si)}` : "", ggt ? `GGT ${round(ggt.si)}` : "", ast ? `AST ${round(ast.si)}` : "", alt ? `ALT ${round(alt.si)}` : ""].filter(Boolean).join(", ") || "none")];
  const C = [it("c1", "Biliary dilatation on imaging", /dilat/i.test(img) && /(bile|biliary|cbd|duct)/i.test(img), "imaging report"),
             it("c2", "Cause on imaging (stone, stricture, stent, mass)", /choledocholith|cbd stone|duct stone|stricture|stent|ampullary|pancreatic head mass|obstructing/i.test(img), "imaging report")];
  const III = [it("g3cv", "Hypotension needing vasopressors", sbp && sbp.v < 90, sbp ? `SBP min ${sbp.v}` : ""),
               it("g3neuro", "Disturbed consciousness", S.confused, "confusion box above"),
               it("g3resp", "PaO2/FiO2 <300", spo2 && spo2.v < 90, spo2 ? `SpO2 min ${spo2.v}% (proxy)` : ""),
               it("g3renal", "Oliguria or creatinine >176 umol/L (2 mg/dL)", cr && cr.si > 176, cr ? `creat ${round(cr.si)}` : ""),
               it("g3liver", "INR >1.5", inr && inr.si > 1.5, inr ? `INR ${round(inr.si)}` : ""),
               it("g3heme", "Platelets <100", plt && plt.si < 100, plt ? `plt ${round(plt.si)}` : "")];
  const II = [it("g2wbc", "WBC >12 or <4", wbc && (wbc.si > 12 || wbc.si < 4), wbc ? `WBC ${round(wbc.si)}` : ""),
              it("g2fever", "Fever >=39 C", t && t.v >= 39, t ? `Tmax ${round(t.v)}` : ""),
              it("g2age", "Age >=75", age != null && age >= 75, age != null ? `age ${age}` : ""),
              it("g2bili", "Bilirubin >=85 umol/L (5 mg/dL)", bili && bili.si >= 85, bili ? `bili ${round(bili.si)}` : ""),
              it("g2alb", "Albumin <25 g/L (<0.7 x lower limit)", alb && alb.si < 25, alb ? `alb ${round(alb.si)}` : "")];
  const a = A.some(x => x.on), b = B.some(x => x.on), c = C.some(x => x.on);
  const dx = a && b && c ? "DEFINITE cholangitis" : a && (b || c) ? "SUSPECTED cholangitis" : "Criteria not met";
  const grade = III.some(x => x.on) ? 3 : II.filter(x => x.on).length >= 2 ? 2 : 1;
  return { A, B, C, III, II, dx, grade, met: a && (b || c) };
}
function tgHTML() {
  const g = tg18();
  const row = x => `<label class="chk"><input type="checkbox" class="tgc" data-k="${x.k}" ${x.on ? "checked" : ""}> ${esc(x.label)} <span class="muted">${x.src ? "(" + esc(x.src) + ")" : ""}${x.on !== x.auto ? " - changed by you" : ""}</span></label>`;
  const act = { 3: "Grade III (severe): organ support + URGENT biliary drainage as soon as resuscitated (ERCP/PTBD); broad antibiotics; ICU", 2: "Grade II (moderate): EARLY drainage within 24-48 h; IV antibiotics", 1: "Grade I (mild): antibiotics; drain if no response within 24 h; treat the cause (e.g. cholecystectomy)" }[g.grade];
  return `<div class="${g.met ? (g.grade === 3 ? "alert" : g.grade === 2 ? "warn" : "info") : "info"}" style="padding:10px 12px">
    <b>Tokyo Guidelines 2018 - acute cholangitis</b> <span class="muted">(pre-ticked from the chart; tick/untick to correct)</span>
    <div class="grid" style="margin-top:6px;gap:6px 14px">
      <div><b class="muted">A. Systemic inflammation</b>${g.A.map(row).join("")}<b class="muted">B. Cholestasis</b>${g.B.map(row).join("")}<b class="muted">C. Imaging</b>${g.C.map(row).join("")}</div>
      <div><b class="muted">Grade III - any organ dysfunction</b>${g.III.map(row).join("")}<b class="muted">Grade II - any 2</b>${g.II.map(row).join("")}</div>
    </div>
    <div style="margin-top:6px"><span class="score">${esc(g.dx)}</span>${g.met ? ` - <b>Grade ${g.grade}</b><br>${esc(act)}` : '<br><span class="muted">Definite = A + B + C; suspected = A + (B or C). Cholecystitis uses separate TG18 criteria (Murphy sign, RUQ mass/pain, inflammation, imaging).</span>'}</div>
    <button class="btn sec" id="tgReset" style="padding:4px 10px;margin-top:6px">Reset to chart</button>
  </div>`;
}

// Think TB - risk factors from the chart plus ticked symptoms
const TB_SYMPTOMS = [["cough", "Cough >2-3 weeks"], ["hemoptysis", "Hemoptysis"], ["sweats", "Night sweats / prolonged fever"], ["weight", "Weight loss"], ["nonresp", "Pneumonia not responding to usual antibiotics"]];
const TB_EXPOSURE = [["country", "Born or lived in a high-incidence country"], ["community", "Lived in a community with high TB incidence (incl. some First Nations and Inuit communities)"], ["contact", "Known TB contact or prior TB / untreated TB infection"], ["social", "Homelessness, incarceration or substance use"]];
function tbRisk() {
  const chart = [];
  S.conds.forEach(c => { const t = condText(c); if (/\bhiv\b|transplant|end.stage renal|esrd|dialysis|silicosis|tuberculosis|\btb\b|diabetes/i.test(t)) chart.push(t); });
  S.meds.forEach(m => { if (/infliximab|adalimumab|etanercept|golimumab|certolizumab|tocilizumab|tacrolimus|mycophenolate|prednisone|methylprednisolone/i.test(medName(m))) chart.push(medName(m)); });
  const rad = S.reports.filter(r => /cavit|apical|upper lobe|miliary|tree.in.bud|hilar (adeno|lymph)|lymphocytic|tuberc|\bafb\b|granulom/i.test(repConcl(r))).map(r => `${repText(r)}: ${repConcl(r)}`);
  const tb = S.tb || (S.tb = {});
  const sym = TB_SYMPTOMS.filter(([k]) => tb[k]).map(x => x[1]), exp = TB_EXPOSURE.filter(([k]) => tb[k]).map(x => x[1]);
  const think = rad.length > 0 || (sym.length > 0 && (chart.length + exp.length) > 0) || sym.length >= 2;
  return { chart: [...new Set(chart)], rad, sym, exp, think };
}
function tbCard() {
  const r = tbRisk(), tb = S.tb;
  return `<div class="card"><h2>Think TB?</h2>
    ${r.think ? `<div class="alert"><b>Consider tuberculosis.</b> Airborne isolation now; 3 sputum AFB smear + culture + TB NAAT; chest X-ray; HIV test; avoid fluoroquinolones until TB excluded; TB specialist and public health. <button class="btn sec" id="tbGo" style="padding:2px 8px">Open TB site</button></div>` : ""}
    ${r.think && abxMeds().some(m => /levofloxacin|moxifloxacin|ciprofloxacin/i.test(medName(m))) ? `<div class="alert"><b>On a fluoroquinolone while TB is possible</b> - it can partly treat TB, make smears/cultures falsely negative and select resistance. Collect sputum now and discuss with the TB specialist.</div>` : ""}
    ${r.rad.length ? `<div class="warn"><b>Imaging/report clue:</b> ${r.rad.map(esc).join("<br>")}</div>` : ""}
    <div class="muted">Chart risk factors: ${r.chart.length ? r.chart.map(esc).join(", ") : "none found"}</div>
    <div style="margin-top:4px"><b class="muted">Symptoms</b>${TB_SYMPTOMS.map(([k, l]) => `<label class="chk"><input type="checkbox" class="tbc" data-k="${k}" ${tb[k] ? "checked" : ""}> ${l}</label>`).join("")}</div>
    <div><b class="muted">Exposure / risk (ask)</b>${TB_EXPOSURE.map(([k, l]) => `<label class="chk"><input type="checkbox" class="tbc" data-k="${k}" ${tb[k] ? "checked" : ""}> ${l}</label>`).join("")}</div>
  </div>`;
}

// LRINEC (Wong 2004). Values kept in SI units in S.lrVals; pre-filled from the chart, editable in the calculator.
const LR_ITEMS = [
  { k: "crp", lab: "crp", label: "CRP", si: "mg/L", us: "mg/dL", toSI: v => v * 10, pts: v => v >= 150 ? 4 : 0, rule: "&ge;150 mg/L (15 mg/dL) = 4" },
  { k: "wbc", lab: "wbc", label: "WBC", si: "x10^9/L", us: "x10^3/uL", toSI: v => v, pts: v => v > 25 ? 2 : v >= 15 ? 1 : 0, rule: "15-25 = 1, &gt;25 = 2" },
  { k: "hgb", lab: "hgb", label: "Hemoglobin", si: "g/L", us: "g/dL", toSI: v => v * 10, pts: v => v < 110 ? 2 : v <= 135 ? 1 : 0, rule: "110-135 g/L (11-13.5 g/dL) = 1, &lt;110 = 2" },
  { k: "na", lab: "sodium", label: "Sodium", si: "mmol/L", us: "mEq/L", toSI: v => v, pts: v => v < 135 ? 2 : 0, rule: "&lt;135 = 2" },
  { k: "cr", lab: "creatinine", label: "Creatinine", si: "umol/L", us: "mg/dL", toSI: v => v * 88.4, pts: v => v > 141 ? 2 : 0, rule: "&gt;141 umol/L (1.6 mg/dL) = 2" },
  { k: "glu", lab: "glucose", label: "Glucose", si: "mmol/L", us: "mg/dL", toSI: v => v / 18.016, pts: v => v > 10 ? 1 : 0, rule: "&gt;10 mmol/L (180 mg/dL) = 1" }
];
function lrInit(force) {
  if (S.lrVals && !force) return;
  S.lrVals = {}; LR_ITEMS.forEach(it => { const l = latest(it.lab); S.lrVals[it.k] = l ? Math.round(l.si * 10) / 10 : null; });
}
function lrinec() {
  lrInit();
  const parts = [], missing = [], pts = {};
  let s = 0;
  LR_ITEMS.forEach(it => { const v = S.lrVals[it.k]; if (v == null || isNaN(v)) { missing.push(it.label); pts[it.k] = null; return; } const p = it.pts(v); pts[it.k] = p; s += p; parts.push(`${it.label} ${round(v)} (${p})`); });
  return { s, parts, missing, pts, ...lrRisk(s, missing.length) };
}
function lrRisk(s, nMissing) {
  if (s >= 8) return { cls: "alert", risk: "HIGH risk (score >=8; >75% probability in the original study)" };
  if (s >= 6) return { cls: "warn", risk: "INTERMEDIATE risk (6-7; 50-75%)" };
  return { cls: "info", risk: `LOW risk (<=5; <50%)${nMissing ? " - incomplete, missing values count as 0" : ""}` };
}
function lrCalcHTML() {
  const r = lrinec(), us = S.lrUnits === "us";
  const show = (it, v) => v == null ? "" : us ? round(it.k === "crp" ? v / 10 : it.k === "hgb" ? v / 10 : it.k === "cr" ? v / 88.4 : it.k === "glu" ? v * 18.016 : v) : v;
  return `<div id="lrBox" class="${r.cls}" style="padding:10px 12px">
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
      <div><b>LRINEC calculator</b> <span class="muted">(Laboratory Risk Indicator for Necrotizing Fasciitis)</span></div>
      <div class="seg"><button data-lru="si" class="${us ? "" : "on"}">SI units</button><button data-lru="us" class="${us ? "on" : ""}">US units</button></div>
    </div>
    <table style="margin-top:6px;background:#fff">
      <tr><th>Lab</th><th style="width:130px">Value</th><th>Unit</th><th>Points</th><th>Rule</th><th>Chart</th></tr>
      ${LR_ITEMS.map(it => { const l = latest(it.lab); return `<tr><td>${it.label}</td>
        <td><input type="number" step="any" class="lrIn" data-k="${it.k}" value="${show(it, S.lrVals[it.k])}" style="width:110px;font:inherit;padding:4px 6px;border:1px solid var(--line);border-radius:6px"></td>
        <td class="muted">${us ? it.us : it.si}</td><td><b id="lrp-${it.k}">${r.pts[it.k] == null ? "-" : r.pts[it.k]}</b></td><td class="muted">${it.rule}</td>
        <td class="muted">${l ? `${round(l.si)} ${it.si} (${fmtDate(l.t)})` : "none"}</td></tr>`; }).join("")}
    </table>
    <div style="margin-top:8px;display:flex;gap:12px;align-items:center;flex-wrap:wrap">
      <span class="score" id="lrScore">${r.s}</span><span>/13</span> <b id="lrRisk">${r.risk}</b>
      <button class="btn sec" id="lrReset" style="padding:4px 10px">Reset to chart values</button>
    </div>
    <div class="muted" style="margin-top:6px">Score &ge;6 should raise suspicion; &ge;8 strongly predictive. Later studies show LOW sensitivity (a low score misses many cases) - pain out of proportion, rapid spread, bullae, crepitus, anesthesia or toxicity mean surgical exploration regardless of the score.</div>
  </div>`;
}
function lrUpdate() {
  const r = lrinec();
  LR_ITEMS.forEach(it => { const e = $("#lrp-" + it.k); if (e) e.textContent = r.pts[it.k] == null ? "-" : r.pts[it.k]; });
  $("#lrScore").textContent = r.s; $("#lrRisk").textContent = r.risk; $("#lrBox").className = r.cls;
  if (!S.noteDirty) { const site = INF_SITES.find(x => x.id === S.site); $("#note").value = buildNote(site, sepsis()); }
}
function curb65() {
  const urea = latest("urea"), rr = maxV("rr"), sbp = minV("sbp"), dbp = minV("dbp"), age = S.patient?.age;
  const items = [["Confusion", S.confused], ["Urea >7 mmol/L", urea ? urea.si > 7 : null], ["RR >=30", rr ? rr.v >= 30 : null],
    ["SBP <90 or DBP <=60", sbp || dbp ? ((sbp && sbp.v < 90) || (dbp && dbp.v <= 60)) : null], ["Age >=65", age != null ? age >= 65 : null]];
  return { s: items.filter(i => i[1]).length, items };
}
function penFast() {
  const p = S.pen; const s = (p.recent ? 2 : 0) + (p.severe ? 2 : 0) + (p.treated ? 1 : 0);
  return { s, risk: s <= 2 ? (s === 0 ? "very low (<1%)" : "low (5%)") : s === 3 ? "moderate (20%)" : "high (50%)" };
}

// ---------- Auto-suggest ----------
function suggestedSites() {
  const text = S.conds.map(condText).join(" | "); // problem list only - report text is too noisy ("no abscess")
  return INF_SITES.filter(s => s.match.test(text)).map(s => s.id);
}
function suggestedTier() {
  const sp = sepsis();
  if (sp.shock || sp.qsofa >= 2) return "severe";
  return "moderate";
}

// ---------- Rendering ----------
function render() {
  const sp = sepsis(), sug = suggestedSites();
  if (!S.site) S.site = sug[0] || INF_SITES[0].id;
  if (!S.tier) S.tier = suggestedTier();
  const site = INF_SITES.find(s => s.id === S.site);
  $("#main").innerHTML = `
  ${S.demo ? `<div class="warn"><b>DEMO - made-up patient.</b> Not real chart data. Demos: ${(window.INF_DEMOS || []).map((d, i) => `<a href="?demo=${i + 1}">${i + 1} ${esc(d.short)}</a>`).join(" &middot; ")}</div>` : ""}
  <div class="toolbar"><button class="btn sec" id="collapseAll">Collapse all</button><button class="btn sec" id="expandAll">Expand all</button></div>
  ${chartCards(sp)}
  <div class="card">
    <h2>Site of infection</h2>
    <div class="sites">${INF_SITES.map(s => `<button data-site="${s.id}" class="${s.id === S.site ? "on" : ""}" title="${esc(s.sub)}">${esc(s.label)}${sug.includes(s.id) ? '<span class="dot" title="Matches the problem list / reports"></span>' : ""}</button>`).join("")}</div>
    <div style="margin-top:10px;display:flex;gap:10px;align-items:center;flex-wrap:wrap">
      <span class="muted">Severity:</span>
      <div class="seg">${[["mild", "Mild / outpatient"], ["moderate", "Moderate / inpatient"], ["severe", "Severe / sepsis"]].map(([k, l]) => `<button data-tier="${k}" class="${k === S.tier ? "on" : ""}">${l}</button>`).join("")}</div>
      <button class="btn sec" id="lrJump" style="padding:4px 10px">LRINEC calculator</button>
      <span class="muted">${suggestedTier() === "severe" ? '<span class="pill p-red">Suggested: severe (qSOFA/shock)</span>' : "Suggested from vitals: moderate"}</span>
    </div>
  </div>
  ${siteBlock(site, sp)}
  ${sec("note", "Assessment &amp; plan draft", `<p class="muted">Edit, then copy into the PowerChart note. "Rebuild" overwrites your edits.</p>
    <div style="display:flex;gap:8px;margin-bottom:8px"><button class="btn" id="copyNote">Copy</button><button class="btn sec" id="rebuildNote">Rebuild</button><span id="copied" class="muted"></span></div>
    <textarea id="note"></textarea>`)}
  <p class="muted" style="text-align:center">Decision support only - UNVERIFIED draft. Adult doses for normal renal function; adjust for renal/hepatic function and check local antibiogram, Island Health guidance and pharmacy. Not a substitute for clinical judgment.</p>`;
  $("#note").value = S.noteText != null && S.noteDirty ? S.noteText : buildNote(site, sp);
  wire();
}

// Collapsible coloured section. Open/closed state survives re-renders (S.open); badge shows when collapsed too.
const SEC_COLORS = { sepsis: "#b42318", abx: "#175cd3", allergy: "#b54708", tb: "#6941c6", micro: "#0e7c86",
  org: "#2b4a6f", cards: "#0b6bcb", watch: "#b42318", ix: "#0e7c86", rx: "#067647", src: "#c4320a", dur: "#6941c6", ivpo: "#3538cd", idc: "#475467", stew: "#667085", note: "#2b4a6f" };
function sec(key, title, body, { open = true, badge = "" } = {}) {
  const isOpen = S.open[key] != null ? S.open[key] : open;
  return `<details class="sec" data-sec="${key}" style="--c:${SEC_COLORS[key] || "#2b4a6f"}" ${isOpen ? "open" : ""}>
    <summary><span class="sec-t">${title}</span><span class="sec-b">${badge}</span></summary><div class="body">${body}</div></details>`;
}
function chartCards(sp) {
  const abx = abxMeds(), ba = betaAllergies(), imm = immunocompromised(), egfr = latest("egfr"), pf = penFast(), tbr = tbRisk(), mm = mismatch();
  const cultures = S.reports.filter(r => /culture|gram stain|blood c|urine c|sputum|wound|csf|aspirate|pcr/i.test(repText(r)));
  const qp = `<span class="pill ${sp.qsofa >= 2 ? "p-red" : sp.qsofa === 1 ? "p-amb" : "p-grn"}">qSOFA ${sp.qsofa}/3</span>`;
  const sirs = `<span class="pill ${sp.sirs.length >= 2 ? "p-amb" : "p-gry"}">SIRS ${sp.sirs.length}/4</span>`;
  const lac = sp.lac ? `<span class="pill ${sp.lac.si >= 4 ? "p-red" : sp.lac.si >= 2 ? "p-amb" : "p-grn"}">Lactate ${round(sp.lac.si)}</span>` : '<span class="pill p-gry">No lactate</span>';
  const sepsisBody = `<div class="hrow">
      <div class="hcell">${sp.data ? `<b>Last 24 h:</b> Tmax ${sp.t ? round(sp.t.v) + " C" : "-"} &middot; HR max ${sp.hr ? sp.hr.v : "-"} &middot; RR max ${sp.rr ? sp.rr.v : "-"} &middot; SBP min ${sp.sbp ? sp.sbp.v : "-"} &middot; SpO2 ${lastV("spo2") ? lastV("spo2").v + "%" : "-"}` : `<span class="muted">No vitals in the last 24 h.</span>`}
        <label class="chk"><input type="checkbox" id="confused" ${S.confused ? "checked" : ""}> Altered mentation / new confusion (GCS &lt;15)</label></div>
      <div class="hcell">${qp} <span class="muted">${sp.q.join(", ")}</span> ${sirs} ${lac}
        <div class="muted" style="margin-top:4px">WBC ${labTxt("wbc")} &middot; CRP ${labTxt("crp")} &middot; PCT ${labTxt("pct")} &middot; Creatinine ${labTxt("creatinine")} &middot; eGFR ${labTxt("egfr")}</div></div>
      <div class="hcell wide">${sp.shock ? `<div class="alert"><b>Possible septic shock</b> (SBP &lt;90 or lactate &ge;4): cultures, broad antibiotics within 1 hour, 30 mL/kg crystalloid, vasopressors if MAP &lt;65, source control, ICU review.</div>` : sp.qsofa >= 2 ? `<div class="alert">qSOFA &ge;2: higher risk of poor outcome - treat as sepsis, lactate, cultures, antibiotics within 1 hour.</div>` : ""}
        ${egfr && egfr.si < 30 ? `<div class="warn">eGFR ${round(egfr.si)}: renally adjust (piperacillin-tazobactam, cefepime, meropenem, vancomycin, acyclovir, TMP-SMX, levofloxacin); avoid nitrofurantoin.</div>` : ""}</div>
    </div>`;
  const abxBody = `<div class="hrow">
      <div class="hcell wide">${abx.length ? `<table><tr><th>Medication</th><th>Route</th><th>Day</th></tr>${abx.map(m => { const d = dayOf(m); return `<tr><td>${esc(medText(m))}</td><td>${isIV(m) ? '<span class="pill p-blu">IV</span>' : '<span class="pill p-gry">PO/other</span>'}</td><td>${d ? `<b>Day ${d}</b>${d >= 3 ? ' <span class="pill p-amb">48-72 h review</span>' : ""}` : "-"}</td></tr>`; }).join("")}</table>` : `<p class="muted">No antibiotics on the active list.</p>`}</div>
      <div class="hcell">${mm.map(x => `<div class="alert"><b>Bug-drug mismatch:</b> ${esc(x)}</div>`).join("")}
        ${egfr && egfr.si < 30 && abx.some(m => /nitrofurantoin/i.test(medName(m))) ? `<div class="alert">Nitrofurantoin with eGFR ${round(egfr.si)}: ineffective and toxic below CrCl 30 - stop.</div>` : ""}
        ${abx.some(isIV) ? `<div class="info">On IV therapy: check switch-to-PO criteria (IV vs oral section).</div>` : ""}
        ${imm.length ? `<div class="warn"><b>Immunocompromised:</b> ${imm.map(esc).join(", ")} - broader differential, lower threshold for ID.</div>` : ""}</div>
    </div>`;
  const allergyBody = `<div class="hrow">
      <div class="hcell">${S.allergies.length ? `<ul>${S.allergies.map(a => `<li>${BETA.test(allergyName(a)) ? '<span class="pill p-amb">beta-lactam</span> ' : ""}${esc(allergyName(a))}${allergyReactions(a) ? ` - <i>${esc(allergyReactions(a))}</i>` : ""}${a.criticality === "high" ? ' <span class="pill p-red">high</span>' : ""}</li>`).join("")}</ul>` : `<p class="muted">No allergies recorded (confirm with patient).</p>`}</div>
      ${ba.length ? `<div class="hcell"><b>PEN-FAST</b> (penicillin allergy risk)
        <label class="chk"><input type="checkbox" class="pen" data-k="recent" ${S.pen.recent ? "checked" : ""}> Reaction 5 years ago or less (2)</label>
        <label class="chk"><input type="checkbox" class="pen" data-k="severe" ${S.pen.severe ? "checked" : ""}> Anaphylaxis/angioedema OR severe cutaneous reaction (SJS, TEN, DRESS) (2)</label>
        <label class="chk"><input type="checkbox" class="pen" data-k="treated" ${S.pen.treated ? "checked" : ""}> Treatment required for the reaction (1)</label></div>
      <div class="hcell"><span class="score">${pf.s}</span>/5 - <b>${pf.risk}</b> risk of positive test.
        ${pf.s < 3 && !S.pen.severe ? '<div class="ok">Low risk: cephalosporins are fine; consider a direct oral amoxicillin challenge (delabel) per local allergy pathway.</div>' : '<div class="warn">Use non-beta-lactam alternatives or ID/allergy advice; avoid all beta-lactams after SJS/TEN/DRESS.</div>'}</div>` : ""}
    </div>`;
  const tb = S.tb;
  const tbBody = `${tbr.think ? `<div class="alert"><b>Consider tuberculosis.</b> Airborne isolation now; 3 sputum AFB smear + culture + TB NAAT; chest X-ray; HIV test; avoid fluoroquinolones until TB excluded; TB specialist and public health. <button class="btn sec" id="tbGo" style="padding:2px 8px">Open TB site</button></div>` : ""}
    ${tbr.think && abx.some(m => /levofloxacin|moxifloxacin|ciprofloxacin/i.test(medName(m))) ? `<div class="alert"><b>On a fluoroquinolone while TB is possible</b> - it can partly treat TB, make smears/cultures falsely negative and select resistance. Collect sputum now and discuss with the TB specialist.</div>` : ""}
    <div class="hrow">
      <div class="hcell">${tbr.rad.length ? `<div class="warn"><b>Imaging/report clue:</b> ${tbr.rad.map(esc).join("<br>")}</div>` : '<span class="muted">No imaging clues in reports.</span>'}
        <div class="muted">Chart risk factors: ${tbr.chart.length ? tbr.chart.map(esc).join(", ") : "none found"}</div></div>
      <div class="hcell"><b class="muted">Symptoms</b>${TB_SYMPTOMS.map(([k, l]) => `<label class="chk"><input type="checkbox" class="tbc" data-k="${k}" ${tb[k] ? "checked" : ""}> ${l}</label>`).join("")}</div>
      <div class="hcell"><b class="muted">Exposure / risk (ask)</b>${TB_EXPOSURE.map(([k, l]) => `<label class="chk"><input type="checkbox" class="tbc" data-k="${k}" ${tb[k] ? "checked" : ""}> ${l}</label>`).join("")}</div>
    </div>`;
  const microBody = `${cultures.length ? `<ul class="cols">${cultures.sort((a, b) => new Date(repDate(b)) - new Date(repDate(a))).map(r => `<li><b>${esc(repText(r))}</b> <span class="muted">${fmtDT(repDate(r))}</span><br>${esc(repConcl(r) || "pending")}</li>`).join("")}</ul>` : `<p class="muted">No culture reports found.</p>`}
    ${cultures.some(r => /staph(ylococcus)? aureus|\bmrsa\b|\bmssa\b/i.test(repConcl(r)) && /blood/i.test(repText(r))) ? `<div class="alert"><b>S. aureus bacteremia:</b> ID consult, repeat blood cultures q24-48h until negative, echo, source control, IV therapy (cefazolin or cloxacillin for MSSA; vancomycin for MRSA).</div>` : ""}
    ${cultures.some(r => /candida/i.test(repConcl(r)) && /blood/i.test(repText(r))) ? `<div class="alert"><b>Candidemia:</b> ID consult, echinocandin, remove lines, ophthalmology exam, repeat cultures.</div>` : ""}`;
  return sec("sepsis", "Sepsis screen", sepsisBody, { badge: `${qp}${sirs}${lac}` })
    + sec("abx", "Current antibiotics", abxBody, { badge: `<span class="pill p-blu">${abx.length} active</span>${mm.length ? '<span class="pill p-red">mismatch</span>' : ""}${abx.some(isIV) ? '<span class="pill p-gry">IV</span>' : ""}` })
    + sec("allergy", "Allergies", allergyBody, { badge: S.allergies.length ? `<span class="pill ${ba.length ? "p-amb" : "p-gry"}">${S.allergies.length} recorded${ba.length ? " - beta-lactam" : ""}</span>${ba.length ? `<span class="pill p-gry">PEN-FAST ${pf.s}</span>` : ""}` : '<span class="pill p-gry">none recorded</span>' })
    + sec("tb", "Think TB?", tbBody, { open: tbr.think, badge: tbr.think ? '<span class="pill p-red">consider TB</span>' : '<span class="pill p-grn">no flags</span>' })
    + sec("micro", "Cultures &amp; micro (30 days)", microBody, { badge: `<span class="pill p-gry">${cultures.length} report${cultures.length === 1 ? "" : "s"}</span>` });
}

// Culture text "resistant to X, Y and Z" vs current antibiotics
const DRUG_ALIASES = { "ceftriaxone": /ceftriaxone/i, "ciprofloxacin": /ciprofloxacin/i, "levofloxacin": /levofloxacin/i, "cefazolin": /cefazolin|cephalexin/i, "ampicillin": /ampicillin|amoxicillin/i,
  "trimethoprim": /sulfamethoxazole|trimethoprim|tmp-smx|septra/i, "tmp-smx": /sulfamethoxazole|trimethoprim|tmp-smx|septra/i, "nitrofurantoin": /nitrofurantoin/i, "piperacillin": /piperacillin/i,
  "gentamicin": /gentamicin/i, "cefepime": /cefepime/i, "ertapenem": /ertapenem/i, "meropenem": /meropenem/i, "clindamycin": /clindamycin/i, "oxacillin": /cloxacillin|cefazolin|cephalexin/i,
  "cloxacillin": /cloxacillin|cefazolin|cephalexin/i, "erythromycin": /azithromycin|clarithromycin|erythromycin/i, "doxycycline": /doxycycline/i, "vancomycin": /vancomycin/i };
function mismatch() {
  const out = [], abx = abxMeds();
  S.reports.forEach(r => {
    const t = repConcl(r); const m = /resistant to ([^.;]+)/i.exec(t); if (!m) return;
    const res = m[1].toLowerCase().split(/,|\band\b/).map(x => x.trim()).filter(Boolean);
    if (/\bmrsa\b|methicillin.resistant/i.test(t)) res.push("oxacillin");
    if (/\besbl\b/i.test(t)) res.push("ceftriaxone", "cefepime", "piperacillin");
    for (const d of res) { const re = DRUG_ALIASES[d.replace(/[^a-z-]/g, "")]; if (!re) continue; abx.filter(x => re.test(medName(x))).forEach(x => out.push(`${medName(x)} - ${repText(r)} reports resistance (${d}).`)); }
  });
  return [...new Set(out)];
}
function list(items) { return `<ul>${(items || []).map(x => `<li>${esc(x)}</li>`).join("")}</ul>`; }
function cardHTML(c) {
  const t = c.table ? `<table><tr>${c.table.head.map(h => `<th>${esc(h)}</th>`).join("")}</tr>${c.table.rows.map(r => `<tr>${r.map((x, i) => i === 0 ? `<td><b>${esc(x)}</b></td>` : `<td>${esc(x)}</td>`).join("")}</tr>`).join("")}</table>` : "";
  return `<h3>${esc(c.title)}</h3>${c.items ? list(c.items) : ""}${t}${c.note ? `<p class="muted">${esc(c.note)}</p>` : ""}`;
}
function siteBlock(site, sp) {
  const ba = betaAllergies(), severeAllergy = ba.some(a => SEVERE_RX.test(allergyReactions(a)) || a.criticality === "high") || S.pen.severe;
  const imaging = S.reports.filter(r => /ct|mri|x-?ray|ultrasound|\bus\b|radiograph|scan|echo/i.test(repText(r)) && !/culture/i.test(repText(r)));
  const bc = S.reports.some(r => /blood c/i.test(repText(r)));
  const lr = ["skin", "groin"].includes(site.id) ? lrinec() : null, cb = site.id === "lung" ? curb65() : null;
  return `
  <div class="sitehead"><h2>${esc(site.label)}</h2><span class="muted">${esc(site.sub)}</span></div>
  <div>
  ${sec("org", "Likely organisms", list(site.organisms))}
  ${sec("watch", `What to watch out for${site.id === "skin" ? " - necrotizing fasciitis" : site.id === "groin" ? " - Fournier gangrene" : site.id === "biliary" ? " - cholangitis needs drainage" : site.id === "tb" ? " - when to think of TB" : ""}`, `
    ${lr ? lrCalcHTML() : ""}
    ${site.id === "biliary" ? tgHTML() : ""}
    ${["groin", "skin"].includes(site.id) && S.meds.some(m => /empagliflozin|dapagliflozin|canagliflozin|ertugliflozin|jardiance|forxiga|invokana|synjardy|xigduo/i.test(medName(m))) ? `<div class="alert"><b>On an SGLT2 inhibitor</b> (${esc(S.meds.filter(m => /gliflozin|jardiance|forxiga|invokana|synjardy|xigduo/i.test(medName(m))).map(medName).join(", "))}): associated with Fournier gangrene and euglycemic DKA - stop it, check ketones.</div>` : ""}
    ${site.isolation ? `<div class="alert"><b>Airborne isolation</b>${list(site.isolation)}</div>` : ""}
    ${cb ? `<div class="${cb.s >= 3 ? "alert" : cb.s === 2 ? "warn" : "info"}"><b>CURB-65 ${cb.s}/5</b> ${cb.s >= 3 ? "- severe, consider ICU review" : cb.s === 2 ? "- admit" : "- low risk (outpatient if otherwise OK)"}<br><span class="muted">${cb.items.map(([n, v]) => `${v === null ? "?" : v ? "&#10003;" : "&#10007;"} ${n}`).join(" &middot; ")}</span></div>` : ""}
    ${list(site.watch)}
  `, { badge: [lr ? `<span class="pill ${lr.s >= 8 ? "p-red" : lr.s >= 6 ? "p-amb" : "p-gry"}">LRINEC ${lr.s}</span>` : "", cb ? `<span class="pill ${cb.s >= 3 ? "p-red" : cb.s === 2 ? "p-amb" : "p-gry"}">CURB-65 ${cb.s}</span>` : "", site.id === "biliary" ? (g => g.met ? `<span class="pill ${g.grade === 3 ? "p-red" : g.grade === 2 ? "p-amb" : "p-blu"}">Tokyo grade ${g.grade}</span>` : "")(tg18()) : ""].join("") })}
  ${(site.cards || []).length ? sec("cards", "Key decisions", site.cards.map(cardHTML).join("")) : ""}
  ${sec("ix", "Investigations - blood, imaging, cultures", `
    <h3>Blood</h3>${list(site.ix.blood)}
    <p class="muted">In chart: WBC ${labTxt("wbc")}, CRP ${labTxt("crp")}, lactate ${labTxt("lactate")}, creatinine ${labTxt("creatinine")}, ESR ${labTxt("esr")} &middot; Blood cultures ${bc ? '<span class="pill p-grn">sent</span>' : '<span class="pill p-amb">none found</span>'}</p>
    <h3>Imaging</h3>${list(site.ix.imaging)}
    ${imaging.length ? `<p class="muted">In chart:</p><ul>${imaging.map(r => `<li>${esc(repText(r))} <span class="muted">${fmtDate(repDate(r))}</span> - ${esc(repConcl(r))}</li>`).join("")}</ul>` : `<p class="muted">No imaging reports in the last 30 days.</p>`}
    <h3>Cultures / other</h3>${list(site.ix.other)}
  `, { open: false, badge: `<span class="pill ${bc ? "p-grn" : "p-amb"}">blood cultures ${bc ? "sent" : "not found"}</span>` })}
  ${sec("rx", "Treatment - antibiotics <span class=\"muted\">(adult doses, normal renal function)</span>", `
    <table><tr><th style="width:120px">Severity</th><th style="width:28%">Situation</th><th>Regimen</th></tr>
    ${site.abx.map(r => `<tr class="${r.tier === S.tier || !site.abx.some(x => x.tier === S.tier) ? "hl" : ""}"><td><span class="pill ${r.tier === "severe" ? "p-red" : r.tier === "moderate" ? "p-amb" : "p-grn"}">${r.tier}</span></td><td>${esc(r.setting)}</td><td>${esc(r.regimen)}</td></tr>`).join("")}
    </table>
    <h3>Penicillin / beta-lactam allergy ${ba.length ? `<span class="pill ${severeAllergy ? "p-red" : "p-amb"}">patient has ${severeAllergy ? "SEVERE " : ""}beta-lactam allergy</span>` : ""}</h3>${list(site.allergy)}
  `, { badge: `<span class="pill p-blu">showing: ${S.tier}</span>${ba.length ? `<span class="pill ${severeAllergy ? "p-red" : "p-amb"}">beta-lactam allergy</span>` : ""}` })}
  ${sec("src", "Treatment - surgery / source control", `${list(site.source)}<h3>Call the surgeon</h3>${list(site.surgeon)}`)}
  ${sec("dur", "How long", `${list(site.duration)}
    ${abxMeds().length ? `<p class="muted">Current: ${abxMeds().map(m => `${esc(medName(m))} day ${dayOf(m) ?? "?"}`).join("; ")}</p>` : ""}`)}
  ${sec("ivpo", "IV vs oral - when to use IV and when to switch", `${list(site.ivpo)}<h3>All sites</h3>${list(INF_GENERAL.ivpo)}`, { open: false })}
  ${sec("idc", "When to get ID involved", `${list(site.idc)}<h3>All sites</h3>${list(INF_GENERAL.id)}`, { open: false })}
  ${sec("stew", "Stewardship reminders", list(INF_GENERAL.stewardship), { open: false })}
  </div>`;
}

function buildNote(site, sp) {
  const abx = abxMeds(), ba = betaAllergies(), lr = ["skin", "groin"].includes(site.id) ? lrinec() : null, cb = site.id === "lung" ? curb65() : null;
  const tg = site.id === "biliary" ? tg18() : null, tbr = tbRisk();
  const reg = site.abx.find(r => r.tier === S.tier) || site.abx.find(r => r.tier === "severe") || site.abx[0];
  const severeAllergy = ba.some(a => SEVERE_RX.test(allergyReactions(a)) || a.criticality === "high") || S.pen.severe;
  const dur = site.duration[S.tier === "mild" ? 0 : Math.min(1, site.duration.length - 1)];
  const mm = mismatch();
  const p = S.patient;
  return [
    `INFECTION - ASSESSMENT & PLAN`,
    p ? `${p.name}, ${p.age ?? "?"} ${p.gender || ""}` : "",
    "",
    `Site: ${site.label} (${site.sub}). Severity: ${S.tier}.`,
    `Sepsis screen: qSOFA ${sp.qsofa}/3${sp.q.length ? ` (${sp.q.join(", ")})` : ""}, SIRS ${sp.sirs.length}/4, lactate ${sp.lac ? round(sp.lac.si) : "not done"}${sp.shock ? " - possible septic shock" : ""}.`,
    lr ? `LRINEC ${lr.s}/13 - ${lr.risk} (${lr.parts.join(", ")}${lr.missing.length ? `; missing ${lr.missing.join(", ")}` : ""}).` : "",
    cb ? `CURB-65 ${cb.s}/5.` : "",
    tg ? `Tokyo 2018: ${tg.dx}${tg.met ? `, Grade ${tg.grade}` : ""}.` : "",
    tbr.think ? `TB considered: ${[...tbr.sym, ...tbr.exp, ...tbr.chart, ...tbr.rad].join("; ")} - airborne isolation, sputum AFB x3 + NAAT.` : "",
    `Labs: WBC ${labTxt("wbc")}, CRP ${labTxt("crp")}, creatinine ${labTxt("creatinine")}, eGFR ${labTxt("egfr")}.`,
    `Allergies: ${S.allergies.length ? S.allergies.map(a => allergyName(a) + (allergyReactions(a) ? ` (${allergyReactions(a)})` : "")).join("; ") : "none recorded"}.${ba.length ? ` PEN-FAST ${penFast().s}/5.` : ""}`,
    `Current antibiotics: ${abx.length ? abx.map(m => `${medText(m)} (day ${dayOf(m) ?? "?"})`).join("; ") : "none"}.`,
    "",
    "Plan:",
    `- Cultures/investigations: [edit]`,
    `- Source control: [edit / not required]`,
    mm.length ? `- BUG-DRUG MISMATCH: ${mm.join(" ")}` : "",
    `- Antibiotics: ${severeAllergy ? `SEVERE beta-lactam allergy - choose from: ${site.allergy.filter(a => /severe|carbapenem/i.test(a)).join(" / ")}.` : reg.regimen} [edit to final choice; narrow to cultures]`,
    `- Duration [pick one]:`, ...site.duration.map(d => `    * ${d}`),
    `- Review at 48-72 h: narrow to culture results, IV-to-PO when criteria met.`,
    `- ID consult: [yes/no - reason]`,
    `- Decision: ____________________________`
  ].filter((l, i, a) => l !== "" || a[i - 1] !== "").join("\n");
}

function wire() {
  document.querySelectorAll("[data-site]").forEach(b => b.onclick = () => { S.site = b.dataset.site; render(); });
  document.querySelectorAll("[data-tier]").forEach(b => b.onclick = () => { S.tier = b.dataset.tier; render(); });
  const c = $("#confused"); if (c) c.onchange = () => { S.confused = c.checked; render(); };
  document.querySelectorAll(".pen").forEach(x => x.onchange = () => { S.pen[x.dataset.k] = x.checked; render(); });
  document.querySelectorAll(".lrIn").forEach(x => x.oninput = () => {
    const it = LR_ITEMS.find(i => i.k === x.dataset.k), v = parseFloat(x.value);
    S.lrVals[it.k] = isNaN(v) ? null : Math.round((S.lrUnits === "us" ? it.toSI(v) : v) * 10) / 10; lrUpdate();
  });
  document.querySelectorAll("[data-lru]").forEach(b => b.onclick = () => { S.lrUnits = b.dataset.lru; render(); });
  const lrr = $("#lrReset"); if (lrr) lrr.onclick = () => { lrInit(true); render(); };
  const lrj = $("#lrJump"); if (lrj) lrj.onclick = () => { S.site = "skin"; render(); setTimeout(() => $("#lrBox")?.scrollIntoView({ behavior: "smooth", block: "center" }), 50); };
  document.querySelectorAll("details.sec").forEach(d => d.addEventListener("toggle", () => { S.open[d.dataset.sec] = d.open; }));
  const setAll = v => document.querySelectorAll("details.sec").forEach(d => { d.open = v; S.open[d.dataset.sec] = v; });
  $("#collapseAll").onclick = () => setAll(false);
  $("#expandAll").onclick = () => setAll(true);
  document.querySelectorAll(".tgc").forEach(x => x.onchange = () => { S.tgOv[x.dataset.k] = x.checked; render(); });
  const tgr = $("#tgReset"); if (tgr) tgr.onclick = () => { S.tgOv = {}; render(); };
  document.querySelectorAll(".tbc").forEach(x => x.onchange = () => { S.tb[x.dataset.k] = x.checked; render(); });
  const tbg = $("#tbGo"); if (tbg) tbg.onclick = () => { S.site = "tb"; render(); };
  $("#note").oninput = () => { S.noteDirty = true; S.noteText = $("#note").value; };
  $("#rebuildNote").onclick = () => { S.noteDirty = false; S.noteText = null; render(); };
  $("#copyNote").onclick = async () => { try { await navigator.clipboard.writeText($("#note").value); } catch { $("#note").select(); document.execCommand("copy"); } $("#copied").textContent = "Copied"; setTimeout(() => { const e = $("#copied"); if (e) e.textContent = ""; }, 1500); };
}

// ---------- Loading ----------
async function loadFHIR(client) {
  const pid = client.patient.id;
  const req = async url => { try { return await client.request(url, { pageLimit: 3, flat: true }); } catch (e) { console.warn("FHIR failed", url, e); return []; } };
  const d = n => daysAgo(n).toISOString().slice(0, 10);
  const [pt, labs, vit, meds, conds, reps, alg] = await Promise.all([
    client.patient.read().catch(() => null),
    req(`Observation?patient=${pid}&category=laboratory&date=ge${d(7)}&_count=200`),
    req(`Observation?patient=${pid}&category=vital-signs&date=ge${d(2)}&_count=200`),
    req(`MedicationRequest?patient=${pid}&_count=100`),
    req(`Condition?patient=${pid}&_count=100`),
    req(`DiagnosticReport?patient=${pid}&date=ge${d(30)}&_count=100`),
    req(`AllergyIntolerance?patient=${pid}&_count=50`)
  ]);
  return { pt, labs, vit, meds, conds, reps, alg };
}
function ingest({ pt, labs, vit, meds, conds, reps, alg }) {
  if (pt) {
    const n = pt.name?.[0];
    S.patient = { name: n?.text || [n?.given?.join(" "), n?.family].filter(Boolean).join(" ") || "Patient",
      age: pt.birthDate ? Math.floor((Date.now() - new Date(pt.birthDate)) / 3.15576e10) : null, gender: pt.gender, birthDate: pt.birthDate,
      mrn: pt.identifier?.find(i => /mrn/i.test(i.type?.text || i.type?.coding?.[0]?.display || ""))?.value || pt.identifier?.[0]?.value || "" };
  }
  S.labs = (labs || []).map(o => { const key = classifyLab(o); const v = o.valueQuantity?.value; return key && v != null ? { key, si: toSI(key, v, o.valueQuantity.unit), t: new Date(o.effectiveDateTime || o.issued || 0) } : null; }).filter(Boolean);
  S.vitals = []; (vit || []).forEach(o => ingestVital(o, S.vitals));
  S.meds = (meds || []).filter(m => ["active", "on-hold", "draft"].includes(m.status));
  S.conds = (conds || []).filter(c => !c.clinicalStatus || /active|recurrence|relapse/i.test(c.clinicalStatus?.coding?.[0]?.code || "active"));
  S.reports = reps || [];
  S.allergies = (alg || []).filter(a => !a.clinicalStatus || /active/i.test(a.clinicalStatus?.coding?.[0]?.code || "active"));
  const ba = betaAllergies();
  if (ba.some(a => SEVERE_RX.test(allergyReactions(a)))) S.pen.severe = true;
  if (ba.some(a => /anaphyla|epinephrine|admitted|hospital/i.test(allergyReactions(a)))) S.pen.treated = true;
  if (ba.some(a => a.onsetDateTime && new Date(a.onsetDateTime) > daysAgo(5 * 365))) S.pen.recent = true;
}

// Made-up demo patients (demo-patients.js); h = hours before now.
function demoFrom(D) {
  const at = h => new Date(Date.now() - h * 36e5).toISOString();
  const vit = [];
  D.vitals.forEach(([h, sbp, dbp, hr, rr, temp, spo2]) => {
    vit.push({ code: { coding: [{ code: "85354-9" }], text: "Blood pressure" }, effectiveDateTime: at(h), component: [{ code: { coding: [{ code: "8480-6" }] }, valueQuantity: { value: sbp } }, { code: { coding: [{ code: "8462-4" }] }, valueQuantity: { value: dbp } }] });
    [["8867-4", hr, "/min"], ["9279-1", rr, "/min"], ["8310-5", temp, "Cel"], ["59408-5", spo2, "%"]].forEach(([c, v, u]) => vit.push({ code: { coding: [{ code: c }] }, effectiveDateTime: at(h), valueQuantity: { value: v, unit: u } }));
  });
  return {
    pt: D.pt,
    labs: D.labs.map(l => ({ code: { text: l.text, coding: l.loinc ? [{ code: l.loinc }] : [] }, valueQuantity: { value: l.v, unit: l.unit }, effectiveDateTime: at(l.h) })),
    vit,
    meds: D.meds.map(([t, h]) => ({ status: "active", medicationCodeableConcept: { text: t }, authoredOn: h != null ? at(h) : undefined })),
    conds: D.conds.map(t => ({ code: { text: t }, clinicalStatus: { coding: [{ code: "active" }] } })),
    reps: D.reps.map(r => ({ code: { text: r.text }, effectiveDateTime: at(r.h), conclusion: r.conclusion })),
    alg: D.allergies.map(([sub, rx, crit, yearsAgo]) => ({ code: { text: sub }, reaction: rx ? [{ manifestation: [{ text: rx }] }] : [], criticality: crit, onsetDateTime: yearsAgo != null ? daysAgo(yearsAgo * 365).toISOString() : undefined, clinicalStatus: { coding: [{ code: "active" }] } }))
  };
}

async function start() {
  const dm = /[?&]demo=(\d+)/.exec(location.search);
  try {
    if (dm) throw new Error("demo");
    const client = await FHIR.oauth2.ready();
    ingest(await loadFHIR(client));
  } catch (e) {
    if (!dm) {
      $("#banner").textContent = "Not connected";
      $("#main").innerHTML = `<div class="card"><div class="alert"><b>Not launched from the EHR</b> (${esc(e.message || e)}).<br>Launch via launch.html from PowerChart / the Cerner sandbox, or open <a href="?demo=1">demo mode</a> with made-up patients.</div></div>`;
      return;
    }
    const D = (window.INF_DEMOS || [])[+dm[1] - 1] || (window.INF_DEMOS || [])[0];
    if (!D) { $("#main").textContent = "Demo patients not loaded."; return; }
    S.demo = true; ingest(demoFrom(D));
  }
  const p = S.patient;
  $("#banner").innerHTML = p ? `<b>${esc(p.name)}</b> &nbsp; ${p.age ?? "?"} y ${esc(p.gender || "")} &nbsp; DOB ${esc(p.birthDate || "")}${p.mrn ? ` &nbsp; MRN ${esc(p.mrn)}` : ""}` : "Patient";
  render();
}
window.InfApp = { S, sepsis, lrinec, curb65, penFast, suggestedSites, mismatch, tg18, tbRisk };
start();
})();
