/* Reads the editable criteria spreadsheets (criteria.csv and measures.csv) that sit next to index.html.
   Edit them in Excel and save as "CSV UTF-8". Nothing in this file needs changing to update the criteria.

   criteria.csv columns:
     Category           ICU | Step-down / monitored | Specialty service | Hospitalist | Observation / discharge
                        | Comorbidity (3 or more found = multiple chronic conditions)
                        | Check documented (listed under "Clarify with the ED" if NONE of the words appear)
     Finding            the name shown on screen
     Weight             3 strong, 2 moderate, 1 minor (blank for Comorbidity / Check documented)
     Words to look for  phrases separated by ;   * = any ending (pneumon* = pneumonia, pneumonitis)
                        "a ... b" = a then b in the same sentence (troponin ... elevated)
     Ignore when nearby phrases that cancel a match when they appear within ~40 characters (rule out; history of)
     Service            (Specialty only) the service to suggest
     Policy reference   optional text shown next to the finding, e.g. "VGH criteria 2.3"
   measures.csv columns: Measure | Condition (< 90, >= 5.5 or < 3.5) | Category | Weight | Label ({v} = the value)
     For each measure, the FIRST row (top to bottom) that a documented value meets is used, so list the most severe first. */

const CATEGORY_KEYS = [
  ["icu", /\bicu\b|critical/i], ["stepdown", /step|monitor/i], ["specialty", /special|surg/i],
  ["obs", /observ|discharge/i], ["comorb", /comorb/i], ["check", /check|document|missing|clarify/i], ["hospitalist", /hospitalist|accept|medicine/i]
];
function categoryKey(text) {
  const t = String(text || "").trim();
  const hit = CATEGORY_KEYS.find(([, re]) => re.test(t));
  return hit ? hit[0] : null;
}

// Minimal CSV reader (handles quotes, commas inside quotes, Windows line endings, Excel's BOM)
function parseCSV(text) {
  text = text.replace(/^﻿/, "");
  const rows = []; let row = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((x) => x.trim()));
}

// Turn the plain words in a cell into a search pattern
const escRe = (s) => s.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
function phraseSource(p) {
  p = p.trim();
  if (!p) return null;
  const parts = p.split(/\s*\.\.\.\s*/).filter(Boolean).map((part) =>
    part.split(/\s+/).map((w) => w.split("*").map(escRe).join("\\w*")).join("[\\s-]+"));
  const src = parts.join("[^.\\n]{0,40}?");
  return (/^\w/.test(p) ? "\\b" : "") + src + (/\w$/.test(p) ? "\\b" : "");
}
function phrasesRe(cell) {
  const list = String(cell || "").split(";").map(phraseSource).filter(Boolean);
  return list.length ? new RegExp("(?:" + list.join("|") + ")", "i") : null;
}

function headerIndex(head, ...names) {
  const h = head.map((x) => x.trim().toLowerCase());
  for (const n of names) { const i = h.findIndex((x) => x.startsWith(n)); if (i >= 0) return i; }
  return -1;
}

async function fetchText(name) {
  const res = await fetch(name, { cache: "no-store" });
  if (!res.ok) throw new Error(`${name} could not be loaded (HTTP ${res.status}). It must be in the same folder as index.html.`);
  return res.text();
}

// Returns { groups, comorb, checks, measureRules, problems, counts }
async function loadCriteria() {
  const problems = [];
  const groups = { icu: [], stepdown: [], specialty: [], hospitalist: [], obs: [] }, comorb = [], checks = [];
  const crit = parseCSV(await fetchText("criteria.csv"));
  const head = crit[0] || [];
  const ix = { cat: headerIndex(head, "category"), find: headerIndex(head, "finding"), w: headerIndex(head, "weight"),
               words: headerIndex(head, "words"), ign: headerIndex(head, "ignore"), svc: headerIndex(head, "service"), pol: headerIndex(head, "policy") };
  if (ix.cat < 0 || ix.find < 0 || ix.words < 0) problems.push("criteria.csv: the first row must have the column names Category, Finding, Weight, Words to look for …");
  else crit.slice(1).forEach((r, i) => {
    const rowNo = i + 2, get = (k) => (ix[k] >= 0 ? (r[ix[k]] || "").trim() : "");
    const key = categoryKey(get("cat")), finding = get("find");
    if (!key) return problems.push(`criteria.csv row ${rowNo}: unknown Category "${get("cat")}" (use ICU, Step-down / monitored, Specialty service, Hospitalist, Observation / discharge, Comorbidity or Check documented).`);
    if (!finding) return problems.push(`criteria.csv row ${rowNo}: Finding is empty.`);
    let re;
    try { re = phrasesRe(get("words")); } catch (e) { return problems.push(`criteria.csv row ${rowNo} (${finding}): could not read the words (${e.message}).`); }
    if (!re) return problems.push(`criteria.csv row ${rowNo} (${finding}): "Words to look for" is empty.`);
    let ignore = null;
    try { ignore = phrasesRe(get("ign")); } catch (e) { problems.push(`criteria.csv row ${rowNo} (${finding}): could not read "Ignore when nearby" - ignored.`); }
    if (key === "comorb") return comorb.push({ l: finding, re, ignore });
    if (key === "check") return checks.push({ l: finding, re });
    const w = Number(get("w"));
    if (![1, 2, 3].includes(w)) return problems.push(`criteria.csv row ${rowNo} (${finding}): Weight must be 1, 2 or 3 (found "${get("w")}").`);
    groups[key].push({ l: finding, w, re, ignore, svc: get("svc"), policy: get("pol") });
  });

  const measureRules = {};
  let mcount = 0;
  try {
    const meas = parseCSV(await fetchText("measures.csv"));
    const mh = meas[0] || [];
    const mi = { m: headerIndex(mh, "measure"), cond: headerIndex(mh, "condition"), cat: headerIndex(mh, "category"), w: headerIndex(mh, "weight"), lab: headerIndex(mh, "label") };
    if (mi.m < 0 || mi.cond < 0) problems.push("measures.csv: the first row must have the column names Measure, Condition, Category, Weight, Label.");
    else meas.slice(1).forEach((r, i) => {
      const rowNo = i + 2, get = (k) => (mi[k] >= 0 ? (r[mi[k]] || "").trim() : "");
      const name = Object.keys(MEASURE_READERS).find((n) => n.toLowerCase() === get("m").toLowerCase());
      if (!name) return problems.push(`measures.csv row ${rowNo}: unknown Measure "${get("m")}" (choose from: ${Object.keys(MEASURE_READERS).join(", ")}).`);
      const test = parseCondition(get("cond"));
      if (!test) return problems.push(`measures.csv row ${rowNo} (${name}): Condition "${get("cond")}" not understood (examples: < 90, >= 5.5 or < 3.5).`);
      const key = categoryKey(get("cat"));
      if (!key || !groups[key]) return problems.push(`measures.csv row ${rowNo} (${name}): Category must be ICU, Step-down / monitored, Specialty service, Hospitalist or Observation / discharge.`);
      const w = Number(get("w"));
      if (![1, 2, 3].includes(w)) return problems.push(`measures.csv row ${rowNo} (${name}): Weight must be 1, 2 or 3.`);
      const label = get("lab") || `${name} {v}`;
      (measureRules[name] = measureRules[name] || []).push({ test, g: key, w, l: (v) => label.replace(/\{v\}/g, v), cond: get("cond") });
      mcount++;
    });
  } catch (e) { problems.push(e.message + " Vitals and labs will not be scored."); }

  const counts = { findings: Object.values(groups).reduce((n, g) => n + g.length, 0), comorb: comorb.length, checks: checks.length, measures: mcount };
  return { groups, comorb, checks, measureRules, problems, counts };
}

// "< 90", ">= 5.5 or < 3.5", "≤ 120"
function parseCondition(text) {
  const parts = String(text || "").replace(/≤/g, "<=").replace(/≥/g, ">=").split(/\bor\b/i).map((s) => s.trim()).filter(Boolean);
  if (!parts.length) return null;
  const tests = [];
  for (const p of parts) {
    const m = /^(<=|>=|<|>|=)\s*(-?\d+(?:\.\d+)?)$/.exec(p.replace(/\s+/g, " "));
    if (!m) return null;
    const n = +m[2], op = m[1];
    tests.push(op === "<" ? (v) => v < n : op === "<=" ? (v) => v <= n : op === ">" ? (v) => v > n : op === ">=" ? (v) => v >= n : (v) => v === n);
  }
  return (v) => tests.some((t) => t(v));
}

/* How each measure is read from note text (kept in code; the thresholds are in measures.csv).
   Values are converted to SI units: creatinine umol/L, hemoglobin g/L, glucose mmol/L, temperature C. */
const NUM = "(\\d+(?:\\.\\d+)?)";
const MEASURE_READERS = {
  "Systolic BP": { unit: "mmHg", min: 40, max: 300, re: /\b(?:bp|blood pressure)\b[^0-9]{0,12}(\d{2,3})\s*\/\s*\d{2,3}/gi },
  "Heart rate": { unit: "bpm", min: 20, max: 250, re: /\b(?:hr|heart rate|pulse)\b[^0-9]{0,10}(\d{2,3})\b/gi },
  "Respiratory rate": { unit: "/min", min: 4, max: 70, re: /\b(?:rr|resp(?:iratory)? rate|resp)\b[^0-9]{0,10}(\d{1,2})\b/gi },
  "SpO2": { unit: "%", min: 50, max: 100, re: /(?:\bspo2|\bo2 sat(?:uration)?s?\b|\boxygen saturation\b|\bsats?\b)[^0-9]{0,10}(\d{2,3})\s*%?/gi },
  "Temperature": { unit: "°C", min: 30, max: 43, re: /\btemp(?:erature)?\b[^0-9]{0,12}(\d{2,3}(?:\.\d)?)\s*(?:°|deg)?\s*([CF])?\b/gi,
    pick: (m) => { let v = +m[1]; if ((m[2] || "").toUpperCase() === "F" || v > 50) v = (v - 32) * 5 / 9; return Math.round(v * 10) / 10; } },
  // GCS total only: "GCS 7", "GCS: 14", "GCS of 6" - not the components "GCS E4V5M6"
  "GCS": { unit: "", min: 3, max: 15, re: /\bgcs\b\s*(?:score\s*)?(?:of|is|was|=|:)?\s*(\d{1,2})\b(?!\s*[EVM]\d)/gi },
  "Lactate": { unit: "mmol/L", min: 0.1, max: 30, re: new RegExp("\\blact(?:ate|ic acid)\\b[^0-9]{0,15}" + NUM, "gi") },
  "pH": { unit: "", min: 6.7, max: 7.8, re: /\bph\b[^0-9]{0,8}(7\.\d{1,2})\b/gi },
  "Potassium": { unit: "mmol/L", min: 1.5, max: 9.9, re: /\bpotassium\b[^0-9]{0,10}(\d(?:\.\d+)?)|\bk\+?\s*[:=]?\s*(\d\.\d)\b/gi, pick: (m) => +(m[1] || m[2]) },
  "Sodium": { unit: "mmol/L", min: 100, max: 199, re: /\bsodium\b[^0-9]{0,10}(1\d{2})\b|\bna\+?\s*[:=]?\s*(1\d{2})\b/gi, pick: (m) => +(m[1] || m[2]) },
  // umol/L; a value under 20 (or written in mg/dL) is converted from mg/dL
  "Creatinine": { unit: "umol/L", min: 10, max: 2500, re: /\b(?:creatinine|creat|cr|scr)\b[^0-9]{0,10}(\d+(?:\.\d+)?)\s*(mg|µmol|umol|mmol)?/gi,
    pick: (m) => { let v = +m[1]; if (/mg/i.test(m[2] || "") || v < 20) v = v * 88.4; return Math.round(v); } },
  // g/L; a value under 25 (or written in g/dL) is converted from g/dL. "Hemoglobin A1c" is skipped.
  "Hemoglobin": { unit: "g/L", min: 20, max: 250, re: /\b(?:hemoglobin|haemoglobin|hgb|hb)\b(?!\s*a1c)[^0-9]{0,10}(\d{1,3}(?:\.\d)?)\s*(g\/dl|g\/l)?/gi,
    pick: (m) => { let v = +m[1]; if (/dl/i.test(m[2] || "") || v < 25) v = v * 10; return Math.round(v); } },
  // mmol/L; a value over 40 (or written in mg/dL) is converted from mg/dL
  "Glucose": { unit: "mmol/L", min: 0.5, max: 100, re: /\b(?:glucose|blood sugar|bg|cbg)\b[^0-9]{0,10}(\d{1,4}(?:\.\d+)?)\s*(mg|mmol)?/gi,
    pick: (m) => { let v = +m[1]; if (/mg/i.test(m[2] || "") || v > 40) v = v / 18; return Math.round(v * 10) / 10; } },
  "WBC": { unit: "x10^9/L", min: 0.1, max: 99, re: /\bwbc\b[^0-9]{0,10}(\d{1,3}(?:\.\d+)?)/gi },
  "HEART score": { unit: "", min: 0, max: 10, re: /\bheart score\b[^0-9]{0,10}(\d{1,2})\b/gi }
};
