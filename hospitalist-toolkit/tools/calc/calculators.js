/* =====================================================================
   Hospitalist Toolkit – Calculators tab
   CHA2DS2-VASc (+ CHA2DS2-VA, CCS CHADS-65), HAS-BLED, HEART score, GRACE (in-hospital mortality)

   Usage in the combined app (after FHIR.oauth2.ready()):
       HospitalistCalculators.mount(document.getElementById("calcTab"), client);
   Usage without Cerner (manual entry / testing):
       HospitalistCalculators.mount(document.getElementById("calcTab"), null);

   FHIR scopes used (add to launch.html if missing):
       patient/Patient.read patient/Condition.read
       patient/Observation.read patient/MedicationRequest.read

   Pre-filled items are SUGGESTIONS from the chart. Problem lists are often
   incomplete: "not found in chart" does not mean the condition is absent.
   Decision support only – always confirm each item clinically.
   ===================================================================== */
(function () {
  "use strict";

  // ---------------------------------------------------------------
  // 1. Pure scoring functions (no DOM) – easy to test
  // ---------------------------------------------------------------
  function ageBand(age) {
    if (age == null || isNaN(age)) return null;
    return age >= 75 ? "75+" : age >= 65 ? "65-74" : "<65";
  }

  function scoreChadsVasc(f) {
    // f: {chf, htn, age, dm, stroke, vascular, female}
    let s = 0;
    if (f.chf) s += 1;
    if (f.htn) s += 1;
    if (f.age >= 75) s += 2; else if (f.age >= 65) s += 1;
    if (f.dm) s += 1;
    if (f.stroke) s += 2;
    if (f.vascular) s += 1;
    const vaScore = s;                 // CHA2DS2-VA (ESC 2024) = without sex point
    if (f.female) s += 1;
    return { vasc: s, va: vaScore };
  }

  function interpretChadsVasc(score, female) {
    const lowCut = female ? 1 : 0;      // female sex point alone = low risk
    if (score <= lowCut) return { level: "low", text: "Low risk – oral anticoagulation generally not recommended." };
    if (score === lowCut + 1) return { level: "mod", text: "Consider oral anticoagulation (shared decision)." };
    return { level: "high", text: "Oral anticoagulation recommended (unless contraindicated)." };
  }

  function interpretChadsVa(score) {
    if (score === 0) return "CHA₂DS₂-VA 0 – OAC not recommended";
    if (score === 1) return "CHA₂DS₂-VA 1 – consider OAC";
    return "CHA₂DS₂-VA " + score + " – OAC recommended";
  }

  function ccsChads65(f) {
    // CCS algorithm: age >=65 OR any CHADS2 risk factor -> OAC
    // otherwise CAD/arterial vascular disease -> antiplatelet; otherwise none
    if (f.age >= 65 || f.chf || f.htn || f.dm || f.stroke) return "CCS CHADS-65: OAC indicated";
    if (f.vascular) return "CCS CHADS-65: antiplatelet (vascular disease, no OAC criteria)";
    return "CCS CHADS-65: no antithrombotic indicated";
  }

  function scoreHasBled(f) {
    // f: {htn, renal, liver, stroke, bleeding, labileInr, elderly, drugs, alcohol}
    return ["htn", "renal", "liver", "stroke", "bleeding", "labileInr", "elderly", "drugs", "alcohol"]
      .reduce((s, k) => s + (f[k] ? 1 : 0), 0);
  }

  function interpretHasBled(score) {
    if (score >= 3) return { level: "high", text: "High bleeding risk – address modifiable factors and review more often. A high score alone is not a reason to withhold anticoagulation." };
    return { level: "low", text: "Lower bleeding risk – still address modifiable factors." };
  }

  function heartRiskPoints(rf) {
    // rf: {htn, lipids, dm, obesity, smoking, famhx, athero}
    if (rf.athero) return 2;
    const n = ["htn", "lipids", "dm", "obesity", "smoking", "famhx"].reduce((c, k) => c + (rf[k] ? 1 : 0), 0);
    return n >= 3 ? 2 : n >= 1 ? 1 : 0;
  }

  function heartAgePoints(age) {
    if (age == null || isNaN(age)) return null;
    return age >= 65 ? 2 : age >= 45 ? 1 : 0;
  }

  function scoreHeart(h) {
    // h: {history, ecg, agePts, riskPts, trop} each 0-2
    return [h.history, h.ecg, h.agePts, h.riskPts, h.trop].reduce((s, v) => s + (Number(v) || 0), 0);
  }

  function interpretHeart(score) {
    if (score <= 3) return { level: "low", text: "Low risk (0–3): 6-week MACE ≈ 0.9–1.7%. Consider early discharge with follow-up." };
    if (score <= 6) return { level: "mod", text: "Moderate risk (4–6): 6-week MACE ≈ 12–16.6%. Admit for observation / further testing." };
    return { level: "high", text: "High risk (7–10): 6-week MACE ≈ 50–65%. Early invasive strategy should be considered." };
  }

  // GRACE (Granger 2003, in-hospital death) - banded point table
  const band = (v, cuts, pts) => { for (let i = 0; i < cuts.length; i++) if (v < cuts[i]) return pts[i]; return pts[pts.length - 1]; };
  const graceAgePts = (a) => band(a, [30, 40, 50, 60, 70, 80, 90], [0, 8, 25, 41, 58, 75, 91, 100]);
  const graceHrPts = (h) => band(h, [50, 70, 90, 110, 150, 200], [0, 3, 9, 15, 24, 38, 46]);
  const graceSbpPts = (b) => band(b, [80, 100, 120, 140, 160, 200], [58, 53, 43, 34, 24, 10, 0]);
  const graceCrPts = (mgdl) => band(mgdl, [0.4, 0.8, 1.2, 1.6, 2.0, 4.0], [1, 4, 7, 10, 13, 21, 28]);
  const KILLIP_PTS = { 1: 0, 2: 20, 3: 39, 4: 59 };

  function scoreGrace(g) {
    // g: {age, hr, sbp, crUmol, killip 1-4, arrest, stDev, enzymes}; returns null if anything needed is missing
    if ([g.age, g.hr, g.sbp, g.crUmol, g.killip].some((v) => v == null || isNaN(v))) return null;
    const parts = {
      age: graceAgePts(g.age), hr: graceHrPts(g.hr), sbp: graceSbpPts(g.sbp), cr: graceCrPts(g.crUmol / 88.4),
      killip: KILLIP_PTS[g.killip], arrest: g.arrest ? 39 : 0, st: g.stDev ? 28 : 0, enz: g.enzymes ? 14 : 0
    };
    return { total: Object.values(parts).reduce((a, b) => a + b, 0), parts };
  }

  function interpretGrace(score, type) {
    // In-hospital death risk categories (low / intermediate / high)
    if (type === "stemi") {
      if (score <= 125) return { level: "low", text: "Low risk (≤125): in-hospital death < 2% (STEMI)." };
      if (score <= 154) return { level: "mod", text: "Intermediate risk (126–154): in-hospital death 2–5% (STEMI)." };
      return { level: "high", text: "High risk (>154): in-hospital death > 5% (STEMI)." };
    }
    if (score <= 108) return { level: "low", text: "Low risk (≤108): in-hospital death < 1% (NSTE-ACS)." };
    if (score <= 140) return { level: "mod", text: "Intermediate risk (109–140): in-hospital death 1–3% (NSTE-ACS)." };
    return { level: "high", text: "High risk (>140): in-hospital death > 3% (NSTE-ACS). Guidelines link a GRACE score > 140 to an early invasive strategy (within 24 h) for NSTE-ACS." };
  }

  // Clinical Frailty Scale (Rockwood, v2.0) – clinician judgement of baseline
  const CFS_LEVELS = [
    [1, "Very fit", "Robust, active, energetic, motivated; exercises regularly."],
    [2, "Fit", "No active disease symptoms but less fit than level 1; exercises occasionally."],
    [3, "Managing well", "Medical problems well controlled; not regularly active beyond routine walking."],
    [4, "Living with very mild frailty", "Not dependent for daily help, but symptoms limit activities; slowed up or tired during the day."],
    [5, "Living with mild frailty", "Evident slowing; needs help with higher-order IADLs (finances, transport, heavy housework)."],
    [6, "Living with moderate frailty", "Needs help with all outside activities and housekeeping; trouble with stairs; help with bathing, may need minimal help dressing."],
    [7, "Living with severe frailty", "Completely dependent for personal care (physical or cognitive), but stable and not at high risk of dying within ~6 months."],
    [8, "Living with very severe frailty", "Completely dependent for personal care and approaching end of life; typically could not recover even from a minor illness."],
    [9, "Terminally ill", "Approaching end of life, life expectancy < 6 months, not otherwise living with severe frailty."]
  ];

  function interpretCfs(level) {
    if (level == null) return { level: "", text: "Choose the level that best describes the patient's baseline about 2 weeks before this illness." };
    if (level <= 3) return { level: "low", text: "CFS " + level + " – not frail." };
    if (level === 4) return { level: "mod", text: "CFS 4 – living with very mild frailty (pre-frail)." };
    if (level <= 6) return { level: "mod", text: "CFS " + level + " – frail. Higher risk of delirium, falls, functional decline and longer stay; consider early mobility, geriatric input and goals-of-care discussion." };
    return { level: "high", text: "CFS " + level + " – severe frailty / end of life. Prioritise goals of care (MOST) and comfort-focused planning where appropriate." };
  }

  // Delirium risk factors (NICE CG103): any one = at risk
  function deliriumRisk(f) {
    // f: {age, dementia, hipFracture, severeIllness, priorDelirium}
    const reasons = [];
    if (f.age != null && f.age >= 65) reasons.push("age ≥ 65");
    if (f.dementia) reasons.push("cognitive impairment / dementia");
    if (f.hipFracture) reasons.push("current hip fracture");
    if (f.severeIllness) reasons.push("severe illness / risk of deterioration");
    if (f.priorDelirium) reasons.push("previous delirium");
    return reasons;
  }

  // 4AT delirium screening (detection, not risk)
  function score4AT(a) {
    // a: {alert 0|4, amt4 0|1|2, months 0|1|2, acute 0|4}
    return [a.alert, a.amt4, a.months, a.acute].reduce((s, v) => s + (Number(v) || 0), 0);
  }
  function interpret4AT(score) {
    if (score >= 4) return { level: "high", text: "4AT " + score + " – possible delirium ± cognitive impairment. Assess for causes and manage." };
    if (score >= 1) return { level: "mod", text: "4AT " + score + " – possible cognitive impairment; delirium still possible if acute change is unclear." };
    return { level: "low", text: "4AT 0 – delirium or severe cognitive impairment unlikely (delirium still possible if information incomplete)." };
  }

  // ---------------------------------------------------------------
  // 2. Chart matching rules (ICD-10 prefixes + text keywords)
  // ---------------------------------------------------------------
  const RULES = {
    chf:      { icd: ["I50", "I110", "I130", "I132"], kw: /heart failure|\bchf\b|cardiomyopathy/i },
    htn:      { icd: ["I10", "I11", "I12", "I13", "I15"], kw: /hypertension|\bhtn\b/i },
    dm:       { icd: ["E10", "E11", "E13", "E14"], kw: /diabet/i },
    stroke:   { icd: ["I63", "I64", "I693", "G45", "I74", "Z8673"], kw: /stroke|cerebral infarct|transient ischemic|\btia\b|systemic embol/i },
    vascular: { icd: ["I21", "I22", "I252", "I70", "I739"], kw: /myocardial infarction|\bnstemi\b|\bstemi\b|peripheral (arter|vascular)|aortic plaque|claudication/i },
    lipids:   { icd: ["E78"], kw: /hyperlipid|dyslipid|hypercholesterol/i },
    obesity:  { icd: ["E66"], kw: /obesity|obese/i },
    smoking:  { icd: ["F17", "Z720"], kw: /tobacco|smok|nicotine dependence/i },
    famhx:    { icd: ["Z824", "Z8249"], kw: /family history of (ischemic|coronary|heart)/i },
    athero:   { icd: ["I20", "I21", "I22", "I23", "I24", "I25", "I63", "G45", "I70", "I739", "Z951", "Z955"], kw: /coronary|myocardial infarction|angina|\bcabg\b|\bpci\b|stent|stroke|\btia\b|peripheral arter/i },
    renal:    { icd: ["N185", "N186", "Z992", "Z940"], kw: /dialysis|end.stage renal|kidney transplant|renal transplant|ckd stage 5/i },
    liver:    { icd: ["K703", "K704", "K717", "K74"], kw: /cirrhosis/i },
    bleeding: { icd: ["K922", "K920", "K921", "D62", "I60", "I61", "I62", "D696"], kw: /hemorrhage|haemorrhage|bleed|thrombocytopenia|melena|hematemesis/i },
    alcohol:  { icd: ["F10"], kw: /alcohol (use|abuse|dependence)/i },
    // Frailty / delirium clues
    dementia:      { icd: ["F00", "F01", "F02", "F03", "G30", "G310", "G311", "G318"], kw: /dementia|alzheimer|cognitive impairment|lewy body/i },
    hipFracture:   { icd: ["S720", "S721", "S722"], kw: /hip fracture|fractured neck of femur|femoral neck fracture|intertrochanteric/i },
    priorDelirium: { icd: ["F05"], kw: /delirium/i },
    frailtyDx:     { icd: ["R54"], kw: /frailty|senility|age.related physical debility/i },
    falls:         { icd: ["R296", "W19", "W18", "W10", "W01", "Z9181"], kw: /\bfall(s)?\b|repeated falls/i },
    pressure:      { icd: ["L89"], kw: /pressure (injury|ulcer|sore)|decubitus/i },
    palliative:    { icd: ["Z515"], kw: /palliative/i }
  };

  const ANTIPLATELET_NSAID = /aspirin|\basa\b|acetylsalicylic|clopidogrel|ticagrelor|prasugrel|dipyridamole|ibuprofen|naproxen|diclofenac|ketorolac|celecoxib|meloxicam|indomethacin|ketoprofen/i;

  const LOINC = {
    creat:  ["2160-0", "14682-9", "38483-4"],
    sbp:    ["8480-6"],
    hr:     ["8867-4"],
    bpPanel: ["85354-9", "55284-4"],
    bmi:    ["39156-5"],
    trop:   ["89579-7", "10839-9", "42757-5", "6598-7", "67151-1", "48425-3", "49563-0"]
  };

  // ---------------------------------------------------------------
  // 3. Read the chart (all failures are non-fatal)
  // ---------------------------------------------------------------
  function normCode(c) { return String(c || "").replace(/\./g, "").toUpperCase(); }

  function conditionLabel(cond) {
    const cc = cond.code || {};
    return cc.text || (cc.coding && cc.coding[0] && (cc.coding[0].display || cc.coding[0].code)) || "condition";
  }

  function isActiveCondition(cond) {
    const st = cond.clinicalStatus && cond.clinicalStatus.coding && cond.clinicalStatus.coding[0] && cond.clinicalStatus.coding[0].code;
    return !st || ["active", "recurrence", "relapse"].includes(st);
  }

  function matchConditions(conditions, rule) {
    for (const cond of conditions) {
      const codes = ((cond.code && cond.code.coding) || []).map(c => normCode(c.code));
      const text = [cond.code && cond.code.text].concat(((cond.code && cond.code.coding) || []).map(c => c.display)).join(" ");
      const codeHit = codes.some(code => rule.icd.some(p => code.startsWith(p)));
      if (codeHit || rule.kw.test(text)) return conditionLabel(cond);
    }
    return null;
  }

  function obsTime(o) { return o.effectiveDateTime || o.issued || (o.effectivePeriod && o.effectivePeriod.start) || ""; }

  function latestObs(observations, codes) {
    const hits = observations.filter(o => ((o.code && o.code.coding) || []).some(c => codes.includes(c.code)) && o.valueQuantity);
    hits.sort((a, b) => obsTime(b).localeCompare(obsTime(a)));
    return hits[0] || null;
  }

  // Latest systolic BP: a stand-alone systolic result or the systolic part of a blood-pressure panel
  function latestSbp(observations) {
    const vals = [];
    observations.forEach((o) => {
      const codes = ((o.code && o.code.coding) || []).map((c) => c.code);
      if (codes.some((c) => LOINC.sbp.includes(c)) && o.valueQuantity) vals.push({ v: o.valueQuantity.value, t: obsTime(o) });
      (o.component || []).forEach((c) => {
        if (((c.code && c.code.coding) || []).some((x) => LOINC.sbp.includes(x.code)) && c.valueQuantity) vals.push({ v: c.valueQuantity.value, t: obsTime(o) });
      });
    });
    vals.sort((a, b) => String(b.t).localeCompare(String(a.t)));
    return vals[0] || null;
  }

  async function readChart(client) {
    const chart = { age: null, female: false, conditions: [], observations: [], meds: [], errors: [] };
    if (!client) return chart;

    try {
      const pt = await client.patient.read();
      if (pt.birthDate) {
        const b = new Date(pt.birthDate), n = new Date();
        chart.age = n.getFullYear() - b.getFullYear() - ((n.getMonth() < b.getMonth() || (n.getMonth() === b.getMonth() && n.getDate() < b.getDate())) ? 1 : 0);
      }
      chart.female = pt.gender === "female";
    } catch (e) { chart.errors.push("patient"); }

    const pid = client.patient.id;
    try {
      chart.conditions = (await client.request("Condition?patient=" + pid, { pageLimit: 5, flat: true })).filter(isActiveCondition);
    } catch (e) { chart.errors.push("problem list"); }

    try {
      const codes = [].concat(LOINC.creat, LOINC.sbp, LOINC.bpPanel, LOINC.hr, LOINC.bmi, LOINC.trop).map(c => "http://loinc.org|" + c).join(",");
      chart.observations = await client.request("Observation?patient=" + pid + "&code=" + encodeURIComponent(codes), { pageLimit: 3, flat: true });
    } catch (e) { chart.errors.push("labs/vitals"); }

    try {
      chart.meds = await client.request("MedicationRequest?patient=" + pid + "&status=active", { pageLimit: 3, flat: true });
    } catch (e) { chart.errors.push("medications"); }

    return chart;
  }

  function buildSuggestions(chart) {
    const s = {};   // key -> {value, source}
    for (const key of Object.keys(RULES)) {
      const label = matchConditions(chart.conditions, RULES[key]);
      if (label) s[key] = { value: true, source: "problem list: " + label };
    }

    // Uncontrolled HTN for HAS-BLED: latest SBP > 160
    const sbp = latestSbp(chart.observations);
    if (sbp && sbp.v > 160) s.hbHtn = { value: true, source: "latest SBP " + sbp.v };
    if (sbp) s.sbpVal = { value: Math.round(sbp.v), source: "latest SBP " + sbp.v + (sbp.t ? " (" + String(sbp.t).slice(0, 10) + ")" : "") };
    const hr = latestObs(chart.observations, LOINC.hr);
    if (hr) s.hrVal = { value: Math.round(hr.valueQuantity.value), source: "latest HR " + hr.valueQuantity.value + " (" + String(obsTime(hr)).slice(0, 10) + ")" };

    // Renal for HAS-BLED: creatinine > 200 µmol/L (≈ 2.26 mg/dL)
    const cr = latestObs(chart.observations, LOINC.creat);
    if (cr) {
      const unit = (cr.valueQuantity.unit || cr.valueQuantity.code || "").toLowerCase();
      const umol = unit.includes("mg") ? cr.valueQuantity.value * 88.4 : cr.valueQuantity.value;
      s.creatNote = "Latest creatinine " + cr.valueQuantity.value + " " + (cr.valueQuantity.unit || "");
      s.crUmol = { value: Math.round(umol), source: "latest creatinine " + cr.valueQuantity.value + " " + (cr.valueQuantity.unit || "") + " (" + String(obsTime(cr)).slice(0, 10) + ")" };
      if (umol > 200 && !s.renal) s.renal = { value: true, source: "creatinine " + cr.valueQuantity.value + " " + (cr.valueQuantity.unit || "") };
    }

    // Obesity for HEART: BMI > 30
    const bmi = latestObs(chart.observations, LOINC.bmi);
    if (bmi && bmi.valueQuantity.value > 30 && !s.obesity) s.obesity = { value: true, source: "BMI " + bmi.valueQuantity.value };

    // Troponin for HEART: ratio to reference upper limit
    const tr = latestObs(chart.observations, LOINC.trop);
    if (tr) {
      const hi = tr.referenceRange && tr.referenceRange[0] && tr.referenceRange[0].high && tr.referenceRange[0].high.value;
      const label = "troponin " + tr.valueQuantity.value + " " + (tr.valueQuantity.unit || "") + (hi ? " (ULN " + hi + ")" : "");
      if (hi) {
        const ratio = tr.valueQuantity.value / hi;
        s.trop = { value: ratio <= 1 ? 0 : ratio <= 3 ? 1 : 2, source: label };
        if (ratio > 1) s.enzymes = { value: true, source: label };
      } else {
        s.tropNote = label + " – no reference range in chart, choose manually";
      }
    }

    // Drugs for HAS-BLED: active antiplatelet / NSAID
    for (const m of chart.meds) {
      const cc = m.medicationCodeableConcept || {};
      const name = [cc.text].concat((cc.coding || []).map(c => c.display)).join(" ");
      if (ANTIPLATELET_NSAID.test(name)) { s.drugs = { value: true, source: "active med: " + (cc.text || name.trim()) }; break; }
    }
    return s;
  }

  // ---------------------------------------------------------------
  // 4. UI
  // ---------------------------------------------------------------
  const CSS = `
  .calc-wrap{font-family:"Segoe UI",Arial,sans-serif;color:#222;max-width:820px;margin:0 auto;padding:8px 0}
  .calc-note{font-size:13px;color:#555;background:#fff8e1;border:1px solid #f0d78c;border-radius:6px;padding:8px 10px;margin-bottom:12px}
  .calc-pt{font-size:14px;margin-bottom:12px;color:#333}
  .calc-card{background:#fff;border:1px solid #d8d8d8;border-radius:8px;margin-bottom:16px;overflow:hidden}
  .calc-card h3{margin:0;padding:10px 14px;font-size:16px;background:#f3eef8;color:#5b2a86;display:flex;justify-content:space-between;align-items:center;cursor:pointer;user-select:none}
  .calc-card h3:hover{background:#ebe2f4}
  .calc-card h3 .calc-chev{display:inline-block;width:18px;font-size:13px;transition:transform .15s}
  .calc-card:not(.collapsed) h3 .calc-chev{transform:rotate(90deg)}
  .calc-card.collapsed .calc-body{display:none}
  .calc-bar{display:flex;gap:8px;margin-bottom:12px}
  .calc-bar button{background:#fff;color:#5b2a86;border:1px solid #5b2a86;border-radius:6px;padding:6px 12px;font-size:13px;cursor:pointer}
  .calc-score{font-size:22px;font-weight:700}
  .calc-body{padding:8px 14px 12px}
  .calc-row{display:flex;align-items:flex-start;gap:8px;padding:6px 0;border-bottom:1px solid #f0f0f0}
  .calc-row:last-child{border-bottom:none}
  .calc-row label{flex:1;cursor:pointer;font-size:14px}
  .calc-row .pts{color:#666;font-size:12px;white-space:nowrap}
  .calc-src{display:block;font-size:11px;margin-top:2px}
  .calc-src.found{color:#1e7b34}.calc-src.none{color:#888}.calc-src.info{color:#555}
  .calc-radio{display:flex;flex-direction:column;gap:3px;flex:1}
  .calc-radio .ttl{font-size:14px;font-weight:600}
  .calc-radio label{font-size:13px}
  .calc-result{margin-top:10px;padding:8px 10px;border-radius:6px;font-size:13px;line-height:1.4}
  .calc-result.low{background:#e8f5e9;border:1px solid #b9dfbe}
  .calc-result.mod{background:#fff8e1;border:1px solid #f0d78c}
  .calc-result.high{background:#fdecea;border:1px solid #f3b7b0}
  .calc-sub{font-size:12px;color:#444;margin-top:4px}
  .calc-btn{background:#5b2a86;color:#fff;border:none;border-radius:6px;padding:10px 14px;font-size:14px;font-weight:600;cursor:pointer}
  .calc-copy{margin-top:8px;font-size:13px;color:#1e7b34;min-height:18px}
  .calc-age{width:70px;padding:4px;font-size:14px;border:1px solid #ccc;border-radius:4px}
  `;

  function el(tag, attrs, html) {
    const e = document.createElement(tag);
    if (attrs) for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (html != null) e.innerHTML = html;
    return e;
  }
  function esc(t) { const d = document.createElement("div"); d.textContent = t == null ? "" : String(t); return d.innerHTML; }

  function srcTag(sug, key, hasChart) {
    if (sug[key]) return '<span class="calc-src found">✓ from chart – ' + esc(sug[key].source) + "</span>";
    return hasChart ? '<span class="calc-src none">not found in chart – check manually</span>' : "";
  }

  function checkRow(id, text, pts, sug, sugKey, hasChart) {
    const checked = sug[sugKey] && sug[sugKey].value ? "checked" : "";
    return '<div class="calc-row"><input type="checkbox" id="' + id + '" ' + checked + '>' +
      '<label for="' + id + '">' + text + srcTag(sug, sugKey, hasChart) + "</label>" +
      '<span class="pts">' + pts + "</span></div>";
  }

  function radioGroup(name, title, options, selected, note) {
    let h = '<div class="calc-row"><div class="calc-radio"><span class="ttl">' + title + "</span>";
    options.forEach(([val, txt]) => {
      h += '<label><input type="radio" name="' + name + '" value="' + val + '" ' + (String(selected) === String(val) ? "checked" : "") + "> " + txt + "</label>";
    });
    if (note) h += note;
    return h + "</div></div>";
  }

  function render(container, chart, sug) {
    const hasChart = chart.conditions.length > 0 || chart.observations.length > 0 || chart.meds.length > 0;
    const ageVal = chart.age != null ? chart.age : "";

    container.innerHTML = "";
    if (!document.getElementById("calc-style")) {
      const st = el("style", { id: "calc-style" }); st.textContent = CSS; document.head.appendChild(st);
    }
    const w = el("div", { class: "calc-wrap" });

    let notes = "Pre-filled items are suggestions from the chart. Problem lists are often incomplete – confirm every item. Decision support only.";
    if (chart.errors.length) notes += " Could not read: " + chart.errors.join(", ") + ".";
    w.appendChild(el("div", { class: "calc-note" }, esc(notes)));
    w.appendChild(el("div", { class: "calc-bar" },
      '<button type="button" id="calc_expand">Expand all</button><button type="button" id="calc_collapse">Collapse all</button>'));

    w.appendChild(el("div", { class: "calc-pt" },
      'Age <input class="calc-age" id="c_age" type="number" min="0" max="120" value="' + esc(ageVal) + '"> ' +
      '<label><input type="checkbox" id="c_female" ' + (chart.female ? "checked" : "") + "> Female</label>" +
      (chart.age != null ? ' <span class="calc-src found" style="display:inline">✓ from chart</span>' : "")));

    // CHA2DS2-VASc
    w.appendChild(el("div", { class: "calc-card" },
      '<h3>CHA₂DS₂-VASc <span class="calc-score" id="cv_score">–</span></h3><div class="calc-body">' +
      '<div class="calc-sub">Non-valvular atrial fibrillation – stroke risk</div>' +
      checkRow("cv_chf", "Congestive heart failure / LV dysfunction", "+1", sug, "chf", hasChart) +
      checkRow("cv_htn", "Hypertension", "+1", sug, "htn", hasChart) +
      '<div class="calc-row"><label>Age <span class="calc-src info" id="cv_agetxt"></span></label><span class="pts">65–74 +1 · ≥75 +2</span></div>' +
      checkRow("cv_dm", "Diabetes mellitus", "+1", sug, "dm", hasChart) +
      checkRow("cv_stroke", "Prior stroke / TIA / systemic thromboembolism", "+2", sug, "stroke", hasChart) +
      checkRow("cv_vasc", "Vascular disease (prior MI, PAD, aortic plaque)", "+1", sug, "vascular", hasChart) +
      '<div class="calc-row"><label>Sex category (female) <span class="calc-src info" id="cv_sextxt"></span></label><span class="pts">+1</span></div>' +
      '<div class="calc-result" id="cv_result"></div></div>'));

    // HAS-BLED
    w.appendChild(el("div", { class: "calc-card" },
      '<h3>HAS-BLED <span class="calc-score" id="hb_score">–</span></h3><div class="calc-body">' +
      '<div class="calc-sub">Bleeding risk on anticoagulation</div>' +
      checkRow("hb_htn", "Uncontrolled hypertension (SBP &gt; 160)", "+1", sug, "hbHtn", hasChart) +
      checkRow("hb_renal", "Abnormal renal function (dialysis, transplant, Cr &gt; 200 µmol/L)" + (sug.creatNote ? '<span class="calc-src info">' + esc(sug.creatNote) + "</span>" : ""), "+1", sug, "renal", hasChart) +
      checkRow("hb_liver", "Abnormal liver function (cirrhosis, or bili &gt; 2× ULN with AST/ALT/ALP &gt; 3× ULN)", "+1", sug, "liver", hasChart) +
      checkRow("hb_stroke", "Prior stroke", "+1", sug, "stroke", hasChart) +
      checkRow("hb_bleed", "Prior major bleeding or predisposition (e.g. anemia, low platelets)", "+1", sug, "bleeding", hasChart) +
      checkRow("hb_inr", "Labile INR (TTR &lt; 60%) – only if on warfarin", "+1", {}, "none", false) +
      '<div class="calc-row"><label>Elderly (age &gt; 65) <span class="calc-src info" id="hb_agetxt"></span></label><span class="pts">+1</span></div>' +
      checkRow("hb_drugs", "Drugs predisposing to bleeding (antiplatelets, NSAIDs)", "+1", sug, "drugs", hasChart) +
      checkRow("hb_alc", "Alcohol ≥ 8 drinks/week", "+1", sug, "alcohol", hasChart) +
      '<div class="calc-result" id="hb_result"></div></div>'));

    // HEART
    const tropSel = sug.trop ? sug.trop.value : "";
    const tropNote = sug.trop ? '<span class="calc-src found">✓ from chart – ' + esc(sug.trop.source) + "</span>"
      : sug.tropNote ? '<span class="calc-src info">' + esc(sug.tropNote) + "</span>"
      : hasChart ? '<span class="calc-src none">no troponin found in chart – choose manually</span>' : "";
    w.appendChild(el("div", { class: "calc-card" },
      '<h3>HEART score <span class="calc-score" id="ht_score">–</span></h3><div class="calc-body">' +
      '<div class="calc-sub">Chest pain – 6-week risk of major adverse cardiac events</div>' +
      radioGroup("ht_hist", "History", [[0, "Slightly suspicious (0)"], [1, "Moderately suspicious (1)"], [2, "Highly suspicious (2)"]], "") +
      radioGroup("ht_ecg", "ECG", [[0, "Normal (0)"], [1, "Non-specific repolarization disturbance (1)"], [2, "Significant ST deviation (2)"]], "") +
      '<div class="calc-row"><label>Age <span class="calc-src info" id="ht_agetxt"></span></label><span class="pts">&lt;45: 0 · 45–64: 1 · ≥65: 2</span></div>' +
      '<div class="calc-row"><div class="calc-radio"><span class="ttl">Risk factors <span class="pts" id="ht_rftxt"></span></span></div></div>' +
      checkRow("ht_htn", "Hypertension", "", sug, "htn", hasChart) +
      checkRow("ht_lip", "Hypercholesterolemia", "", sug, "lipids", hasChart) +
      checkRow("ht_dm", "Diabetes", "", sug, "dm", hasChart) +
      checkRow("ht_obes", "Obesity (BMI &gt; 30)", "", sug, "obesity", hasChart) +
      checkRow("ht_smk", "Smoking (current, or quit ≤ 3 months)", "", sug, "smoking", hasChart) +
      checkRow("ht_fam", "Family history of premature CAD", "", sug, "famhx", hasChart) +
      checkRow("ht_ath", "Known atherosclerotic disease (MI, PCI/CABG, stroke/TIA, PAD) → 2 points", "", sug, "athero", hasChart) +
      radioGroup("ht_trop", "Initial troponin", [[0, "≤ normal limit (0)"], [1, "1–3× normal limit (1)"], [2, "&gt; 3× normal limit (2)"]], tropSel, tropNote) +
      '<div class="calc-result" id="ht_result"></div></div>'));

    // GRACE
    const numRow = (id, text, unit, sugKey) => {
      const v = sug[sugKey] ? sug[sugKey].value : "";
      const src = sug[sugKey] ? '<span class="calc-src found">✓ from chart – ' + esc(sug[sugKey].source) + "</span>"
        : hasChart ? '<span class="calc-src none">not found in chart – enter it</span>' : "";
      return '<div class="calc-row"><label for="' + id + '">' + text + src + '</label><input class="calc-age" id="' + id + '" type="number" step="any" value="' + esc(v) + '"> <span class="pts">' + unit + "</span></div>";
    };
    w.appendChild(el("div", { class: "calc-card" },
      '<h3>GRACE (ACS) <span class="calc-score" id="gr_score">–</span></h3><div class="calc-body">' +
      '<div class="calc-sub">Acute coronary syndrome – risk of death in hospital. Use the values at presentation.</div>' +
      radioGroup("gr_type", "Type of ACS", [["nste", "NSTE-ACS (NSTEMI / unstable angina)"], ["stemi", "STEMI"]], "nste") +
      '<div class="calc-row"><label>Age <span class="calc-src info" id="gr_agetxt"></span></label></div>' +
      numRow("gr_hr", "Heart rate", "bpm", "hrVal") +
      numRow("gr_sbp", "Systolic BP", "mmHg", "sbpVal") +
      numRow("gr_cr", "Creatinine", "µmol/L", "crUmol") +
      radioGroup("gr_killip", "Killip class", [[1, "I – no heart failure (0)"], [2, "II – rales, S3 or raised JVP (20)"], [3, "III – pulmonary edema (39)"], [4, "IV – cardiogenic shock (59)"]], "") +
      checkRow("gr_arrest", "Cardiac arrest at admission", "+39", {}, "none", false) +
      checkRow("gr_st", "ST-segment deviation", "+28", {}, "none", false) +
      checkRow("gr_enz", "Elevated cardiac enzymes (troponin above the reference limit)", "+14", sug, "enzymes", hasChart) +
      '<div class="calc-result" id="gr_result"></div>' +
      '<div class="calc-sub">Points: original GRACE in-hospital model (Granger 2003). Online calculators using the newer continuous version (GRACE 2.0) can differ by a few points.</div></div>'));

    // Clinical Frailty Scale
    const clueKeys = [["dementia", "dementia / cognitive impairment"], ["frailtyDx", "frailty diagnosis"], ["falls", "falls"], ["pressure", "pressure injury"], ["palliative", "palliative care"]];
    const clues = clueKeys.filter(([k]) => sug[k]).map(([k, n]) => esc(n) + " (" + esc(sug[k].source.replace("problem list: ", "")) + ")");
    const clueHtml = hasChart
      ? '<div class="calc-sub">Chart clues: ' + (clues.length ? clues.join("; ") : "none found – base the score on history from patient/family") + "</div>"
      : "";
    let cfsRows = "";
    CFS_LEVELS.forEach(([n, name, desc]) => {
      cfsRows += '<div class="calc-row"><input type="radio" name="cfs" id="cfs_' + n + '" value="' + n + '">' +
        '<label for="cfs_' + n + '"><b>' + n + " – " + esc(name) + '</b><span class="calc-src info">' + esc(desc) + "</span></label></div>";
    });
    w.appendChild(el("div", { class: "calc-card" },
      '<h3>Clinical Frailty Scale <span class="calc-score" id="cfs_score">–</span></h3><div class="calc-body">' +
      '<div class="calc-sub">Score the baseline about 2 weeks before this illness, not the acute presentation. Clinician judgement – not calculated from the chart.</div>' +
      clueHtml + cfsRows + '<div class="calc-result" id="cfs_result"></div></div>'));

    // Delirium risk + 4AT
    w.appendChild(el("div", { class: "calc-card" },
      '<h3>Delirium <span class="calc-score" id="del_score">–</span></h3><div class="calc-body">' +
      '<div class="calc-sub"><b>Risk factors on admission</b> (NICE) – any one means at risk</div>' +
      '<div class="calc-row"><label>Age ≥ 65 <span class="calc-src info" id="del_agetxt"></span></label></div>' +
      checkRow("del_dem", "Cognitive impairment / dementia", "", sug, "dementia", hasChart) +
      checkRow("del_hip", "Current hip fracture", "", sug, "hipFracture", hasChart) +
      checkRow("del_sev", "Severe illness / at risk of deterioration", "", {}, "none", false) +
      checkRow("del_prev", "Previous delirium", "", sug, "priorDelirium", hasChart) +
      '<div class="calc-result" id="del_result"></div>' +
      '<div class="calc-sub" style="margin-top:12px"><b>4AT screen</b> – is delirium present now?</div>' +
      radioGroup("at_alert", "1. Alertness", [[0, "Normal, or mildly sleepy &lt; 10 s after waking (0)"], [4, "Clearly abnormal (4)"]], "") +
      radioGroup("at_amt", "2. AMT4 – age, date of birth, place, current year", [[0, "No mistakes (0)"], [1, "1 mistake (1)"], [2, "2 or more mistakes / untestable (2)"]], "") +
      radioGroup("at_mon", "3. Attention – months of the year backwards", [[0, "7 or more correct (0)"], [1, "Starts but &lt; 7 correct / refuses (1)"], [2, "Untestable (2)"]], "") +
      radioGroup("at_acu", "4. Acute change or fluctuating course", [[0, "No (0)"], [4, "Yes (4)"]], "") +
      '<div class="calc-result" id="at_result"></div></div>'));

    w.appendChild(el("div", null, '<button class="calc-btn" id="calc_copy">Copy summary for note</button><div class="calc-copy" id="calc_copymsg"></div>'));
    container.appendChild(w);
    setupCollapse(container);

    container.addEventListener("input", () => update(container));
    container.addEventListener("change", () => update(container));
    container.querySelector("#calc_copy").addEventListener("click", () => copySummary(container));
    update(container);
  }

  // Collapse / expand each calculator; remembers the choice in this browser
  const CARD_KEYS = ["chadsvasc", "hasbled", "heart", "grace", "cfs", "delirium"];
  const STORE_KEY = "hospitalistCalcOpen";

  function loadOpen() {
    try { const v = JSON.parse(localStorage.getItem(STORE_KEY)); return Array.isArray(v) ? v : null; }
    catch (e) { return null; }
  }
  function saveOpen(c) {
    try {
      const open = [...c.querySelectorAll(".calc-card")].filter(k => !k.classList.contains("collapsed")).map(k => k.dataset.key);
      localStorage.setItem(STORE_KEY, JSON.stringify(open));
    } catch (e) { /* storage unavailable – ignore */ }
  }

  function setupCollapse(c) {
    const saved = loadOpen();               // null = first visit: start all open
    c.querySelectorAll(".calc-card").forEach((card, i) => {
      card.dataset.key = CARD_KEYS[i] || "card" + i;
      const h = card.querySelector("h3");
      // chevron + title on the left, score stays on the right
      const score = h.querySelector(".calc-score");
      const left = document.createElement("span");
      left.innerHTML = '<span class="calc-chev">▸</span>';
      [...h.childNodes].forEach(n => { if (n !== score) left.appendChild(n); });
      h.insertBefore(left, score);
      h.setAttribute("role", "button");
      h.setAttribute("tabindex", "0");
      if (saved && !saved.includes(card.dataset.key)) card.classList.add("collapsed");
      h.setAttribute("aria-expanded", String(!card.classList.contains("collapsed")));
      const toggle = () => {
        card.classList.toggle("collapsed");
        h.setAttribute("aria-expanded", String(!card.classList.contains("collapsed")));
        saveOpen(c);
      };
      h.addEventListener("click", toggle);
      h.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); } });
    });
    const setAll = collapsed => {
      c.querySelectorAll(".calc-card").forEach(card => {
        card.classList.toggle("collapsed", collapsed);
        card.querySelector("h3").setAttribute("aria-expanded", String(!collapsed));
      });
      saveOpen(c);
    };
    q(c, "calc_expand").addEventListener("click", () => setAll(false));
    q(c, "calc_collapse").addEventListener("click", () => setAll(true));
  }

  function q(c, id) { return c.querySelector("#" + id); }
  function chk(c, id) { const e = q(c, id); return !!(e && e.checked); }
  function radio(c, name) { const e = c.querySelector('input[name="' + name + '"]:checked'); return e ? Number(e.value) : null; }

  function readState(c) {
    const ageRaw = q(c, "c_age").value;
    const age = ageRaw === "" ? null : Number(ageRaw);
    const female = chk(c, "c_female");
    const cv = { chf: chk(c, "cv_chf"), htn: chk(c, "cv_htn"), age: age, dm: chk(c, "cv_dm"), stroke: chk(c, "cv_stroke"), vascular: chk(c, "cv_vasc"), female: female };
    const hb = { htn: chk(c, "hb_htn"), renal: chk(c, "hb_renal"), liver: chk(c, "hb_liver"), stroke: chk(c, "hb_stroke"), bleeding: chk(c, "hb_bleed"), labileInr: chk(c, "hb_inr"), elderly: age != null && age > 65, drugs: chk(c, "hb_drugs"), alcohol: chk(c, "hb_alc") };
    const rf = { htn: chk(c, "ht_htn"), lipids: chk(c, "ht_lip"), dm: chk(c, "ht_dm"), obesity: chk(c, "ht_obes"), smoking: chk(c, "ht_smk"), famhx: chk(c, "ht_fam"), athero: chk(c, "ht_ath") };
    const ht = { history: radio(c, "ht_hist"), ecg: radio(c, "ht_ecg"), agePts: heartAgePoints(age), riskPts: heartRiskPoints(rf), trop: radio(c, "ht_trop") };
    const num = (id) => { const e = q(c, id); return e && e.value !== "" ? Number(e.value) : null; };
    const grTypeEl = c.querySelector('input[name="gr_type"]:checked');
    const gr = { type: grTypeEl ? grTypeEl.value : "nste", age, hr: num("gr_hr"), sbp: num("gr_sbp"), crUmol: num("gr_cr"), killip: radio(c, "gr_killip"),
      arrest: chk(c, "gr_arrest"), stDev: chk(c, "gr_st"), enzymes: chk(c, "gr_enz") };
    const cfs = radio(c, "cfs");
    const del = { age: age, dementia: chk(c, "del_dem"), hipFracture: chk(c, "del_hip"), severeIllness: chk(c, "del_sev"), priorDelirium: chk(c, "del_prev") };
    const at = { alert: radio(c, "at_alert"), amt4: radio(c, "at_amt"), months: radio(c, "at_mon"), acute: radio(c, "at_acu") };
    return { age, female, cv, hb, rf, ht, gr, cfs, del, at };
  }

  function setResult(c, id, level, html) {
    const r = q(c, id); r.className = "calc-result " + (level || ""); r.innerHTML = html;
  }

  function update(c) {
    const s = readState(c);
    const ageKnown = s.age != null && !isNaN(s.age);

    // CHA2DS2-VASc
    q(c, "cv_agetxt").textContent = ageKnown ? "age " + s.age + " (" + ageBand(s.age) + ")" : "enter age above";
    q(c, "cv_sextxt").textContent = s.female ? "female" : "male";
    if (ageKnown) {
      const r = scoreChadsVasc(s.cv), i = interpretChadsVasc(r.vasc, s.female);
      q(c, "cv_score").textContent = r.vasc;
      setResult(c, "cv_result", i.level, esc(i.text) + '<div class="calc-sub">' + esc(interpretChadsVa(r.va)) + " (ESC 2024) · " + esc(ccsChads65(s.cv)) + "</div>");
    } else { q(c, "cv_score").textContent = "–"; setResult(c, "cv_result", "", "Enter age to calculate."); }

    // HAS-BLED
    q(c, "hb_agetxt").textContent = ageKnown ? (s.age > 65 ? "yes – age " + s.age : "no – age " + s.age) : "enter age above";
    if (ageKnown) {
      const hbS = scoreHasBled(s.hb), i = interpretHasBled(hbS);
      q(c, "hb_score").textContent = hbS; setResult(c, "hb_result", i.level, esc(i.text));
    } else { q(c, "hb_score").textContent = "–"; setResult(c, "hb_result", "", "Enter age to calculate."); }

    // HEART
    q(c, "ht_agetxt").textContent = ageKnown ? "age " + s.age + " → " + s.ht.agePts + " point(s)" : "enter age above";
    q(c, "ht_rftxt").textContent = "→ " + s.ht.riskPts + " point(s)";
    const missing = [];
    if (s.ht.history == null) missing.push("history");
    if (s.ht.ecg == null) missing.push("ECG");
    if (!ageKnown) missing.push("age");
    if (s.ht.trop == null) missing.push("troponin");
    if (missing.length) { q(c, "ht_score").textContent = "–"; setResult(c, "ht_result", "", "Still needed: " + esc(missing.join(", ")) + "."); }
    else { const hS = scoreHeart(s.ht), i = interpretHeart(hS); q(c, "ht_score").textContent = hS; setResult(c, "ht_result", i.level, esc(i.text)); }

    // GRACE
    q(c, "gr_agetxt").textContent = ageKnown ? "age " + s.age + " → " + graceAgePts(s.age) + " points" : "enter age above";
    const grMissing = [];
    if (!ageKnown) grMissing.push("age");
    if (s.gr.hr == null) grMissing.push("heart rate");
    if (s.gr.sbp == null) grMissing.push("systolic BP");
    if (s.gr.crUmol == null) grMissing.push("creatinine");
    if (s.gr.killip == null) grMissing.push("Killip class");
    const g = grMissing.length ? null : scoreGrace(s.gr);
    if (!g) { q(c, "gr_score").textContent = "–"; setResult(c, "gr_result", "", "Still needed: " + esc(grMissing.join(", ")) + "."); }
    else {
      const i = interpretGrace(g.total, s.gr.type), pp = g.parts;
      q(c, "gr_score").textContent = g.total;
      setResult(c, "gr_result", i.level, esc(i.text) + '<div class="calc-sub">Age ' + pp.age + " · HR " + pp.hr + " · SBP " + pp.sbp + " · creatinine " + pp.cr +
        " · Killip " + pp.killip + (pp.arrest ? " · arrest 39" : "") + (pp.st ? " · ST deviation 28" : "") + (pp.enz ? " · enzymes 14" : "") + "</div>");
    }

    // Clinical Frailty Scale
    const ci = interpretCfs(s.cfs);
    q(c, "cfs_score").textContent = s.cfs == null ? "–" : s.cfs;
    setResult(c, "cfs_result", ci.level, esc(ci.text));

    // Delirium risk
    q(c, "del_agetxt").textContent = ageKnown ? (s.age >= 65 ? "yes – age " + s.age : "no – age " + s.age) : "enter age above";
    const reasons = deliriumRisk(s.del);
    if (reasons.length) setResult(c, "del_result", "mod", "<b>At risk of delirium</b>: " + esc(reasons.join(", ")) + ". Start prevention: orientation, sleep, mobility, hydration and nutrition, glasses/hearing aids, avoid deliriogenic drugs, screen daily (4AT).");
    else setResult(c, "del_result", "low", "No NICE risk factors ticked. Reassess if condition changes.");

    // 4AT
    const atMissing = ["alert", "amt4", "months", "acute"].filter(k => s.at[k] == null);
    if (atMissing.length) { q(c, "del_score").textContent = reasons.length ? "At risk" : "–"; setResult(c, "at_result", "", "Answer all four 4AT items to score."); }
    else { const a = score4AT(s.at), i = interpret4AT(a); q(c, "del_score").textContent = "4AT " + a; setResult(c, "at_result", i.level, esc(i.text)); }
  }

  function copySummary(c) {
    const s = readState(c);
    const lines = [];
    if (s.age != null && !isNaN(s.age)) {
      const cvItems = [];
      if (s.cv.chf) cvItems.push("CHF"); if (s.cv.htn) cvItems.push("HTN");
      if (s.age >= 75) cvItems.push("age ≥75"); else if (s.age >= 65) cvItems.push("age 65–74");
      if (s.cv.dm) cvItems.push("DM"); if (s.cv.stroke) cvItems.push("stroke/TIA/TE");
      if (s.cv.vascular) cvItems.push("vascular disease"); if (s.female) cvItems.push("female");
      const r = scoreChadsVasc(s.cv);
      lines.push("CHA2DS2-VASc " + r.vasc + (cvItems.length ? " (" + cvItems.join(", ") + ")" : "") + "; CHA2DS2-VA " + r.va + "; " + ccsChads65(s.cv).replace("CCS CHADS-65: ", "CCS CHADS-65 – "));
      const hbItems = [];
      const hbNames = { htn: "uncontrolled HTN", renal: "renal", liver: "liver", stroke: "stroke", bleeding: "bleeding hx", labileInr: "labile INR", elderly: "age >65", drugs: "antiplatelet/NSAID", alcohol: "alcohol" };
      for (const k in hbNames) if (s.hb[k]) hbItems.push(hbNames[k]);
      lines.push("HAS-BLED " + scoreHasBled(s.hb) + (hbItems.length ? " (" + hbItems.join(", ") + ")" : ""));
    }
    if (s.ht.history != null && s.ht.ecg != null && s.ht.trop != null && s.age != null) {
      lines.push("HEART " + scoreHeart(s.ht) + " (H" + s.ht.history + " E" + s.ht.ecg + " A" + s.ht.agePts + " R" + s.ht.riskPts + " T" + s.ht.trop + ")");
    }
    const gs = scoreGrace(s.gr);
    if (gs && s.age != null) lines.push("GRACE " + gs.total + " (" + (s.gr.type === "stemi" ? "STEMI" : "NSTE-ACS") + "; " + interpretGrace(gs.total, s.gr.type).text.split(":")[0] +
      "; HR " + s.gr.hr + ", SBP " + s.gr.sbp + ", Cr " + s.gr.crUmol + " umol/L, Killip " + s.gr.killip + (s.gr.arrest ? ", arrest" : "") + (s.gr.stDev ? ", ST deviation" : "") + (s.gr.enzymes ? ", enzymes up" : "") + ")");
    if (s.cfs != null) lines.push("Clinical Frailty Scale " + s.cfs + " (" + CFS_LEVELS[s.cfs - 1][1] + ", baseline)");
    const reasons = deliriumRisk(s.del);
    if (reasons.length) lines.push("Delirium risk: at risk (" + reasons.join(", ") + ")");
    if (["alert", "amt4", "months", "acute"].every(k => s.at[k] != null)) lines.push("4AT " + score4AT(s.at));
    const text = lines.join("\n");
    const msg = q(c, "calc_copymsg");
    if (!text) { msg.textContent = "Nothing to copy yet."; return; }
    const shown = () => { msg.textContent = "Copy this text: " + text.replace(/\n/g, " · "); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(
        () => { msg.textContent = "Copied: " + text.replace(/\n/g, " · "); },
        shown
      );
    } else { shown(); }
  }

  async function mount(container, client) {
    container.innerHTML = '<div class="calc-wrap" style="color:#666;padding:16px">Loading chart data for calculators…</div>';
    const chart = await readChart(client);
    const sug = buildSuggestions(chart);
    render(container, chart, sug);
  }

  const api = {
    mount,
    // exposed for testing
    _score: { scoreGrace, interpretGrace, graceAgePts, graceHrPts, graceSbpPts, graceCrPts, scoreChadsVasc, interpretChadsVasc, ccsChads65, scoreHasBled, interpretHasBled, heartRiskPoints, heartAgePoints, scoreHeart, interpretHeart, interpretCfs, deliriumRisk, score4AT, interpret4AT },
    _chart: { buildSuggestions, matchConditions, RULES }
  };
  if (typeof window !== "undefined") window.HospitalistCalculators = api;
  if (typeof module !== "undefined") module.exports = api;
})();
