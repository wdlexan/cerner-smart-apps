/* SMART on FHIR - "What Changed" daily panel (Cerner R4)
   Stage 1: vital-sign trends + lab changes.   Stage 2: medication changes.
   Stage 4: days since last bowel movement + intake/output.   Stage 5: symptom scan of recent notes.
   Stage 6: time window, settings, note-ready summary, print view, sections appear as their data arrives.
   Read-only: nothing is written back to the chart. Everything is processed in this browser. */
const $ = (id) => document.getElementById(id);
const H = 3600e3, DAY = 24 * H;

// Vital signs we track (LOINC codes). Flag thresholds live in the Settings panel (DEFAULTS below).
const VITALS = [
  { key: "temp", label: "Temp", short: "T", codes: ["8310-5", "8331-1", "8332-9", "8333-7"], unit: "°C" },
  { key: "hr",   label: "Heart rate", short: "HR", codes: ["8867-4"], unit: "/min" },
  { key: "rr",   label: "Resp rate", short: "RR", codes: ["9279-1"], unit: "/min" },
  { key: "sbp",  label: "Systolic BP", short: "SBP", codes: ["8480-6"], unit: "mmHg" },
  { key: "dbp",  label: "Diastolic BP", short: "DBP", codes: ["8462-4"], unit: "mmHg" },
  { key: "spo2", label: "SpO2", short: "SpO2", codes: ["59408-5", "2708-6"], unit: "%" },
  { key: "wt",   label: "Weight", short: "Wt", codes: ["29463-7", "3141-9"], unit: "kg" }
];

// ---------- Settings (saved in this browser only) ----------
const DEFAULTS = {
  win: 24,
  vitals: { temp: { lo: 35.5, hi: 38 }, hr: { lo: 50, hi: 100 }, rr: { lo: 10, hi: 22 }, sbp: { lo: 90, hi: 180 },
            dbp: { lo: 40, hi: 110 }, spo2: { lo: 92, hi: null }, wt: { lo: null, hi: null } },
  labPct: 20, bmDays: 3, uoKg: 0.5, uoDay: 400, symptomsOff: [], customTerms: "",
  secWin: {} // per-section period in hours, e.g. { notes: 720 }; missing = same as the panel window
};
const clone = (o) => JSON.parse(JSON.stringify(o));
function loadCfg() {
  const d = clone(DEFAULTS);
  try {
    const c = JSON.parse(localStorage.getItem("wc-settings") || "{}");
    Object.keys(d).forEach((k) => { if (k !== "vitals" && c[k] !== undefined) d[k] = c[k]; });
    Object.keys(d.vitals).forEach((k) => { if (c.vitals && c.vitals[k]) d.vitals[k] = c.vitals[k]; });
  } catch (e) {}
  return d;
}
function saveCfg() { try { localStorage.setItem("wc-settings", JSON.stringify(state.cfg)); } catch (e) {} }

const state = { client: null, patient: null, vitals: [], labs: [], meds: [], other: [], docs: [], loaded: {},
  diag: [], texts: new Map(), notes: null, noteHits: null, scanKey: null, anchor: null, stale: false,
  now: Date.now(), cfg: loadCfg(), printing: false, openK: new Set() };
const win = () => state.cfg.win * H;

// ---------- Per-section period ----------
// Each section can look back further than the panel window (e.g. notes scan over 30 days).
const PERIODS = [[12, "12 h"], [24, "24 h"], [48, "48 h"], [72, "72 h"], [168, "7 days"], [720, "30 days"], [2160, "90 days"], [8760, "1 year"]];
const secH = (k) => (state.cfg.secWin && state.cfg.secWin[k]) || state.cfg.win;
const W = (k) => secH(k) * H;
const winLabel = (k) => { const h = secH(k), p = PERIODS.find((x) => x[0] === h); return p ? p[1] : h + " h"; };
const SEC_DATA = { vitals: "vitals", labs: "labs", meds: "meds", bowels: "other", io: "other", notes: "docs" };
state.span = {};       // days of history currently loaded for each data set (Infinity = everything)
state.refetching = {}; // data sets being re-loaded for a longer period
const busy = (k) => !state.loaded[k] || state.refetching[k];
const FETCH = { vitals: (d) => fetchObs("vital-signs", d), labs: (d) => fetchObs("laboratory", d), meds: fetchMeds, other: fetchOther, docs: fetchNotes };

// Load more history if a section's period needs it. Vitals, labs and I&O also need the period
// before (for the "Previous" column), so they need twice as far back.
function ensureData() {
  if (!state.anchor) return;
  const gap = Math.max(0, Math.floor((Date.now() - state.anchor) / DAY)); // sandbox data can be weeks old
  const need = {};
  Object.entries(SEC_DATA).forEach(([sec, k]) => {
    const d = secH(sec) / 24, days = Math.ceil(sec === "notes" || sec === "meds" ? d : 2 * d + 1) + gap;
    need[k] = Math.max(need[k] || 0, days);
  });
  Object.entries(need).forEach(([k, days]) => {
    if (!state.loaded[k] || state.refetching[k] || (state.span[k] || 0) >= days) return;
    state.refetching[k] = true;
    render();
    FETCH[k](days).catch((e) => { state.diag.push(`${k} (longer period): error ${e.message || e}`); state.span[k] = Infinity; return state[k]; })
      .then((v) => { state[k] = v; state.refetching[k] = false; render(); scanNotes(); });
  });
}

// ---------- Start-up ----------
FHIR.oauth2.ready().then(init).catch((e) => {
  $("main").innerHTML = `<div class="card err">Authorization error: ${esc(e.message)}. Launch from launch.html.</div>`;
});

async function init(client) {
  state.client = client;
  client.patient.read().then((p) => { state.patient = p; $("patient").textContent = describe(p); })
    .catch(() => ($("patient").textContent = "Patient " + client.patient.id));
  setupPrint();
  renderSettings();
  render();
  // Each search runs in parallel; every section is drawn as soon as its own data arrives.
  const load = (key, label, promise) => promise
    .catch((e) => { state.diag.push(`${label}: error ${e.message || e}`); return []; })
    .then((v) => { state[key] = v; state.loaded[key] = true; render(); scanNotes(); ensureData(); });
  load("vitals", "vital signs", fetchObs("vital-signs"));
  load("labs", "labs", fetchObs("laboratory"));
  load("meds", "medications", fetchMeds());
  load("other", "bowels / I&O", fetchOther());
  load("docs", "notes", fetchNotes());
}

// ---------- Fetching ----------
const iso = (d) => new Date(d).toISOString().slice(0, 10);

async function fetchObs(category, minDays = 0) {
  const pid = state.client.patient.id, sk = category === "laboratory" ? "labs" : "vitals";
  // Labs: always look back a year so each new result has a previous value to compare with.
  // Vitals: start with 7 days (enough for a 72 h window plus the 72 h before it) and widen only if nothing is found.
  const tries = (category === "laboratory" ? [365, 3650, null] : [7, 30, 365, 3650, null]).filter((d) => d === null || d >= minDays);
  for (const days of tries) {
    const url = `Observation?patient=${pid}&category=${category}` + (days ? `&date=ge${iso(Date.now() - days * DAY)}` : "") + "&_count=100";
    let raw = [];
    try { raw = await state.client.request(url, { pageLimit: days && days <= 30 ? 20 : 10, flat: true }); }
    catch (e) { state.diag.push(`${category} (${days ? days + " days" : "no date"}): error ${e.message || e}`); continue; }
    const res = parseAll(raw);
    state.diag.push(`${category} (${days ? "last " + days + " days" : "no date limit"}): ${raw.length} returned, ${res.length} usable`);
    if (res.length) { state.span[sk] = days || Infinity; return res; }
  }
  state.span[sk] = Infinity;
  return [];
}

// ---------- Medications (Stage 2) ----------
async function fetchMeds(minDays = 0) {
  const pid = state.client.patient.id;
  let raw = [];
  state.span.meds = Infinity;
  for (const days of [30, 365, null].filter((d) => d === null || d >= minDays)) {
    const base = `MedicationRequest?patient=${pid}&_count=100` + (days ? `&_lastUpdated=ge${new Date(Date.now() - days * DAY).toISOString().slice(0, 19)}Z` : "");
    try {
      try { raw = await state.client.request(base + "&_include=MedicationRequest:medication", { pageLimit: 10, flat: true }); }
      catch (e) { raw = await state.client.request(base, { pageLimit: 10, flat: true }); }
    } catch (e) { state.diag.push(`medications (${days ? days + " days" : "no date"}): error ${e.message || e}`); continue; }
    const n = raw.filter((r) => r.resourceType === "MedicationRequest").length;
    state.diag.push(`medications (${days ? "updated in last " + days + " days" : "no date limit"}): ${n} orders`);
    if (n) { state.span.meds = days || Infinity; break; }
  }
  const medMap = {};
  raw.filter((r) => r.resourceType === "Medication").forEach((r) => (medMap[r.id] = r));
  return raw.filter((r) => r.resourceType === "MedicationRequest" && r.status !== "entered-in-error")
    .map((mr) => medInfo(mr, medMap)).filter(Boolean);
}

const STOPPED = ["stopped", "cancelled", "completed"];
function medInfo(mr, medMap) {
  let cc = mr.medicationCodeableConcept, label = "";
  if (!cc && mr.medicationReference) {
    const id = (mr.medicationReference.reference || "").split("/").pop().replace("#", "");
    const m = (mr.contained || []).find((c) => c.id === id) || medMap[id];
    cc = m && m.code;
    label = mr.medicationReference.display || "";
  }
  label = (cc && (cc.text || (cc.coding || []).map((c) => c.display).find(Boolean))) || label || "Unknown medication";
  const di = (mr.dosageInstruction || [])[0] || {};
  const bounds = (di.timing && di.timing.repeat && di.timing.repeat.boundsPeriod) || {};
  const validity = (mr.dispenseRequest && mr.dispenseRequest.validityPeriod) || {};
  const start = new Date(mr.authoredOn || bounds.start || validity.start || NaN);
  let end = new Date(bounds.end || validity.end || NaN);
  if (isNaN(end) && STOPPED.includes(mr.status) && mr.meta && mr.meta.lastUpdated) end = new Date(mr.meta.lastUpdated);
  const key = (label.toLowerCase().match(/[a-z][a-z-]{2,}/) || [label.toLowerCase()])[0]; // first word of the drug name
  return { id: mr.id, label, sig: di.text || "", status: mr.status, start, end, key, prior: (mr.priorPrescription || {}).reference };
}


function medRows() {
  const a = state.anchor, w0 = a - W("meds");
  const inWin = (d) => !isNaN(d) && d >= w0 && d <= a;
  const meds = state.meds || [];
  const rows = [];
  const startedIds = new Set();
  // Started in the window - and if the same drug had an earlier order, call it a dose/order change
  meds.filter((m) => inWin(m.start)).forEach((m) => {
    const older = meds.filter((o) => o !== m && o.key === m.key && !isNaN(o.start) && o.start < m.start)
      .sort((x, y) => y.start - x.start)[0];
    const isPrior = m.prior && older && m.prior.endsWith(older.id);
    if (older && (isPrior || older.sig !== m.sig)) {
      rows.push({ type: "changed", m, old: older, when: m.start });
      startedIds.add(older.id);
    } else rows.push({ type: "started", m, when: m.start });
  });
  // Stopped in the window (skip the old half of a dose change, already shown)
  meds.filter((m) => STOPPED.includes(m.status) && inWin(m.end) && !startedIds.has(m.id))
    .forEach((m) => rows.push({ type: "stopped", m, when: m.end }));
  return rows.sort((x, y) => y.when - x.when);
}

// ---------- Bowels + intake/output (Stage 4) ----------
// Nursing documentation (stool, I&O) is searched across ALL observation categories except labs,
// because each Cerner site files it differently. Matching is by name, so the Diagnostics box
// lists every observation name found - use it to see what your site calls these.
const BM_RE = /stool|bowel mov|\bbm\b|bowel (pattern|elimin|function)|f(a|ae|e)c(es|al)|defecat|bristol|last bowel/i;
const BM_EXCL = /sound|culture|occult|guaiac|immunochem|c\.? ?diff|pathogen|ova|parasite|calprotectin|elastase|softener/i;
const IN_RE = /intake|\boral\b|\bpo\b|iv fluid|\bivf\b|infus|tube feed|enteral|\btpn\b|parenteral|flush|transfus|fluid in/i;
const OUT_RE = /output|urine|void|catheter|foley|drain|emesis|vomit|\bng\b|gastric|ostomy|stool|chest tube|hemovac|fluid out|blood loss|\bebl\b/i;
const URINE_RE = /urine|void|foley|catheter/i;

async function fetchOther(minDays = 0) {
  const pid = state.client.patient.id;
  const notLab = (rs) => rs.filter((r) => !r.cats.some((c) => /laboratory/i.test(c)));
  const useful = (rs) => rs.some(isBM) || rs.some((r) => ioSide(r));
  let found = [], failed = false;
  // 1) All categories at once (patient only), widening the date range until something turns up
  state.span.other = Infinity;
  for (const days of [30, 365, null].filter((d) => d === null || d >= minDays)) {
    const url = `Observation?patient=${pid}` + (days ? `&date=ge${iso(Date.now() - days * DAY)}` : "") + "&_count=100";
    let raw;
    try { raw = await state.client.request(url, { pageLimit: 10, flat: true }); }
    catch (e) { state.diag.push(`all observations (${days ? days + " days" : "no date"}): error ${e.message || e}`); failed = true; break; }
    found = notLab(parseAll(raw));
    state.diag.push(`all observations (${days ? "last " + days + " days" : "no date limit"}): ${raw.length} returned, ${found.length} non-lab`);
    if (useful(found)) { state.span.other = days || Infinity; return found; }
  }
  // 2) If nothing found yet, search one category at a time. Cerner's all-categories search does NOT
  //    return everything (e.g. "therapy" items only appear when asked for by category).
  if (failed || !useful(found)) {
    for (const cat of ["survey", "exam", "procedure", "activity", "therapy"]) {
      try {
        const raw = await state.client.request(`Observation?patient=${pid}&category=${cat}&_count=100`, { pageLimit: 5, flat: true });
        const res = notLab(parseAll(raw));
        state.diag.push(`category ${cat}: ${raw.length} returned`);
        found = found.concat(res);
      } catch (e) { state.diag.push(`category ${cat}: error ${e.message || e}`); }
    }
  }
  return found;
}

const isBM = (r) => BM_RE.test(r.name) && !BM_EXCL.test(r.name);
function vol(r) {
  if (r.num == null) return null;
  const u = (r.unit || "").trim().toLowerCase();
  if (u === "ml" || u === "cc") return r.num;
  if (u === "l") return r.num * 1000;
  return null;
}
function ioSide(r) {
  if (vol(r) == null) return null;
  const n = r.name;
  if (/output|\bout\b/i.test(n)) return "out";
  if (/intake|\bin\b/i.test(n)) return "in";
  if (IN_RE.test(n)) return "in";
  if (OUT_RE.test(n)) return "out";
  return null;
}


function bowelInfo() {
  const a = state.anchor;
  const all = (state.other || []).filter(isBM);
  const events = all.map((r) => {
    if (r.dateVal && !isNaN(r.dateVal)) return { when: r.dateVal, r };          // e.g. "Last BM date"
    if (/^\s*(no|none|not|absent|0\b)/i.test(r.value) || r.num === 0) return null; // charted "no BM"
    return { when: r.when, r };
  }).filter((e) => e && !isNaN(e.when) && e.when <= a).sort((x, y) => y.when - x.when);
  const last = events[0];
  const days = last ? (a - last.when) / DAY : null;
  // Occurrence + consistency charted together = one BM: count distinct times (to the minute)
  const inWin = new Set(events.filter((e) => e.when >= a - W("bowels")).map((e) => Math.floor(e.when / 60e3))).size;
  const recent = all.filter((r) => r.when <= a).sort((x, y) => y.when - x.when).slice(0, 6);
  return { last, days, inWin, recent, any: all.length > 0, flag: days != null && days >= state.cfg.bmDays };
}

function ioWindow(w0, w1) {
  const side = { in: {}, out: {} };
  (state.other || []).filter((r) => r.when >= w0 && r.when <= w1).forEach((r) => {
    const s = ioSide(r); if (!s) return;
    side[s][r.name] = (side[s][r.name] || 0) + vol(r);
  });
  // If the site charts running totals ("Intake total"), use those instead of adding items twice
  const tot = (o) => { const n = Object.keys(o), t = n.filter((x) => /total/i.test(x)); return (t.length ? t : n).reduce((s, x) => s + o[x], 0); };
  const urine = Object.keys(side.out).filter((n) => URINE_RE.test(n) && !/total/i.test(n)).reduce((s, n) => s + side.out[n], 0);
  const has = (o) => Object.keys(o).length > 0;
  return { in: side.in, out: side.out, tin: has(side.in) ? tot(side.in) : null, tout: has(side.out) ? tot(side.out) : null,
           urine: Object.keys(side.out).some((n) => URINE_RE.test(n)) ? urine : null, any: has(side.in) || has(side.out) };
}

function ioInfo() {
  const a = state.anchor, w = W("io"), cur = ioWindow(a - w, a), prev = ioWindow(a - 2 * w, a - w);
  const net = cur.tin != null || cur.tout != null ? (cur.tin || 0) - (cur.tout || 0) : null;
  const pnet = prev.tin != null || prev.tout != null ? (prev.tin || 0) - (prev.tout || 0) : null;
  // Latest weight, for urine output in mL/kg/h
  const wt = (state.vitals || []).concat(state.other || []).filter((r) => r.num != null && r.codes.some((c) => ["29463-7", "3141-9"].includes(c)))
    .sort((x, y) => y.when - x.when)[0];
  const kg = wt ? (/lb/i.test(wt.unit) ? wt.num / 2.2046 : wt.num) : null;
  const hours = w / H;
  const perKg = cur.urine != null && kg ? cur.urine / kg / hours : null;
  const cfg = state.cfg;
  const oliguria = cur.urine != null && (perKg != null ? (cfg.uoKg != null && perKg < cfg.uoKg) : (cfg.uoDay != null && cur.urine < cfg.uoDay * hours / 24));
  const lastAny = Math.max(0, ...(state.other || []).filter((r) => ioSide(r) && r.when <= a).map((r) => +r.when));
  return { cur, prev, net, pnet, kg, perKg, oliguria, lastAny };
}
const mL = (n) => (n == null ? "" : Math.round(n).toLocaleString() + " mL");
const sgn = (n) => (n == null ? "" : (n > 0 ? "+" : n < 0 ? "−" : "") + Math.abs(Math.round(n)).toLocaleString() + " mL");

// ---------- Note symptom scan (Stage 5) ----------
// Each symptom: what to look for (re) and look-alikes to ignore (skip, tested on ~30 characters around the match).
const SYMPTOMS = [
  { key: "pain",    label: "Pain",                  re: /\bpain(ful)?\b|\baching\b|\bdiscomfort\b/gi, skip: /pain (scale|assessment tool)|acute pain service|pain team/i },
  { key: "chest",   label: "Chest pain",            re: /chest (pain|tightness|pressure)|\bangina\b/gi },
  { key: "nausea",  label: "Nausea / vomiting",     re: /\bnause\w*|\bvomit\w*|\bemesis\b|\bretching\b/gi },
  { key: "confus",  label: "Confusion / delirium",  re: /\bconfus\w*|\bdelirium\b|\bdelirious\b|\bdisorient\w*|\bagitat\w*|altered mental|\bAMS\b|hallucinat\w*|sundown\w*/gi },
  { key: "fall",    label: "Fall",                  re: /\bfall\b|\bfell\b|\bfallen\b|found on (the )?floor|\bfalls\b/gi,
    skip: /falls? (risk|precaution|prevention|score|bundle|mat|alarm)|risk (of|for) falls?|morse|fall-risk|prevent\w* falls?/i },
  { key: "sob",     label: "Shortness of breath",   re: /short(ness)? of breath|\bSOB\b|\bdyspn\w*|\bdesat\w*|increas\w* (O2|oxygen)|work of breathing/gi },
  { key: "fever",   label: "Fever / rigors",        re: /\bfebrile\b|\bfevers?\b|\brigou?rs\b|\bchills\b/gi },
  { key: "bleed",   label: "Bleeding",              re: /\bbleed\w*|hematemesis|haematemesis|melena|melaena|hematochezia|hemoptysis|blood in (the )?(stool|urine)|coffee.?ground/gi },
  { key: "diarr",   label: "Diarrhea",              re: /diarrh\w*|loose stools?|watery stools?/gi },
  { key: "constip", label: "Constipation",          re: /constipat\w*|no bowel movement|no BM\b|impaction/gi, noNeg: true },
  { key: "dizzy",   label: "Dizziness / syncope",   re: /\bdizz\w*|light.?headed\w*|\bsyncop\w*|presyncop\w*|\bvertigo\b/gi },
  { key: "intake",  label: "Poor oral intake",      re: /poor (oral |po )?intake|not eating|decreased appetite|\banorexi\w*|refus\w* (meals|food|to eat)/gi, noNeg: true },
  { key: "cough",   label: "Cough",                 re: /\bcough\w*/gi },
  { key: "rrt",     label: "Rapid response / code", re: /rapid response|code blue|\bMET call|\bRRT\b|transfer\w* to (the )?ICU/gi, noNeg: true },
  { key: "goc",     label: "Goals of care",         re: /goals of care|\bGOC\b|\bDNR\b|palliative|comfort care|\bMOST\b/g, noNeg: true }
];
// Negation: a negating word shortly before the match (same clause), or "Nausea: No" / "Pain 0/10" right after it.
const NEG_BEFORE = /\b(no|denies|denied|deny|denying|without|negative for|not|nil|absence of|free of|resolved|ruled out|r\/o)\b(?![^,;]*\b(but|however|although|except|now)\b)[^.;]{0,45}$/i;
const NEG_AFTER = /^\s*[:=-]?\s*(no|none|denies|denied|negative|absent|nil|0\s*\/\s*10|not present)\b/i;
const maxNotes = () => (secH("notes") <= 72 ? 10 : 25); // more notes allowed for longer periods

async function fetchNotes(minDays = 0) {
  const pid = state.client.patient.id;
  state.span.docs = Infinity;
  const cat = encodeURIComponent("http://hl7.org/fhir/us/core/CodeSystem/us-core-documentreference-category|clinical-note");
  for (const days of [30, 365, null].filter((d) => d === null || d >= minDays)) {
    for (const withCat of [true, false]) {
      const url = `DocumentReference?patient=${pid}` + (withCat ? `&category=${cat}` : "") +
        (days ? `&date=ge${iso(Date.now() - days * DAY)}` : "") + "&_count=50";
      try {
        const raw = await state.client.request(url, { pageLimit: 4, flat: true });
        const docs = raw.filter((r) => r.resourceType === "DocumentReference" && r.status !== "entered-in-error" && (r.content || []).length);
        state.diag.push(`notes (${days ? "last " + days + " days" : "no date limit"}${withCat ? "" : ", any category"}): ${docs.length}`);
        if (docs.length) { state.span.docs = days || Infinity; return docs.sort((a, b) => new Date(docDate(b)) - new Date(docDate(a))); }
        break; // search worked but found nothing: widen the date range
      } catch (e) {
        state.diag.push(`notes (${days ? days + " days" : "no date"}${withCat ? "" : ", any category"}): error ${e.message || e}`);
      }
    }
  }
  return [];
}


// The symptom list in use: built-in items not switched off in Settings, plus your own extra words.
function activeSymptoms() {
  const cfg = state.cfg;
  const custom = (cfg.customTerms || "").split(",").map((t) => t.trim()).filter(Boolean).map((t) => ({
    key: "custom:" + t.toLowerCase(), label: t,
    re: new RegExp("\\b" + t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+"), "gi")
  }));
  return SYMPTOMS.filter((s) => !(cfg.symptomsOff || []).includes(s.key)).concat(custom);
}

async function scanNotes() {
  if (!state.anchor || busy("docs")) return;
  const key = [state.anchor, W("notes"), (state.docs || []).length, JSON.stringify(state.cfg.symptomsOff), state.cfg.customTerms].join("|");
  if (state.scanKey === key) return;
  state.scanKey = key;
  const a = state.anchor, docs = state.docs || [];
  let pick = docs.filter((d) => { const t = new Date(docDate(d)); return t >= a - W("notes") && t <= a; });
  state.notesTotal = pick.length;
  const fallback = !pick.length && docs.length > 0;
  if (fallback) pick = docs.slice(0, 3);
  pick = pick.slice(0, maxNotes()); // newest first
  const needText = pick.some((d) => !state.texts.has(d.id));
  if (needText) { state.noteHits = null; state.notesMsg = `Reading ${pick.length} note(s)…`; render(); }
  try {
    const texts = await Promise.all(pick.map(async (d) => {
      if (!state.texts.has(d.id)) state.texts.set(d.id, await getText(d));
      return state.texts.get(d.id);
    }));
    if (state.scanKey !== key) return; // the window or settings changed while reading - a newer scan is running
    state.notes = pick.map((d, i) => ({ doc: d, text: texts[i] || "", when: new Date(docDate(d)), type: docTypeLabel(d),
      author: (d.author && d.author[0] && d.author[0].display) || "" }));
    state.notesFallback = fallback;
    state.noteHits = findSymptoms(state.notes);
  } catch (e) {
    state.diag.push("note scan: error " + (e.message || e));
    state.notes = []; state.noteHits = [];
  }
  render();
}

function findSymptoms(notes) {
  const hits = activeSymptoms().map((s) => ({ s, pos: [], neg: [] }));
  notes.forEach((n, ni) => {
    const sentences = n.text.replace(/\r/g, "").split(/(?<=[.!?])\s+|\n+/).map((x) => x.trim()).filter(Boolean);
    sentences.forEach((sen) => {
      hits.forEach((h) => {
        h.s.re.lastIndex = 0;
        let m;
        while ((m = h.s.re.exec(sen))) {
          const around = sen.slice(Math.max(0, m.index - 30), m.index + m[0].length + 30);
          if (h.s.skip && h.s.skip.test(around)) continue;
          const before = sen.slice(Math.max(0, m.index - 60), m.index);
          const after = sen.slice(m.index + m[0].length, m.index + m[0].length + 20);
          const negated = !h.s.noNeg && (NEG_BEFORE.test(before) || NEG_AFTER.test(after));
          const hit = { ni, sen, start: m.index, len: m[0].length };
          (negated ? h.neg : h.pos).push(hit);
          break; // one hit per sentence per symptom is enough
        }
      });
    });
  });
  return hits;
}

function snippet(hit) {
  const s = hit.sen, from = Math.max(0, hit.start - 90), to = Math.min(s.length, hit.start + hit.len + 110);
  return (from > 0 ? "…" : "") + esc(s.slice(from, hit.start)) + "<mark>" + esc(s.slice(hit.start, hit.start + hit.len)) + "</mark>" +
    esc(s.slice(hit.start + hit.len, to)) + (to < s.length ? "…" : "");
}


// ---- Note text retrieval (from the note compiler app) ----
function docDate(doc) { return doc.date || (doc.context && doc.context.period && doc.context.period.start) || (doc.meta && doc.meta.lastUpdated) || ""; }
function docTypeLabel(doc) { return (doc.type && (doc.type.text || (doc.type.coding || []).map((c) => c.display).find(Boolean))) || "Note"; }
function pickAttachment(doc) {
  const atts = (doc.content || []).map((c) => c.attachment).filter(Boolean);
  for (const p of ["text/plain", "text/html", "application/xhtml+xml", "text/rtf", "application/xml", "application/pdf"]) {
    const a = atts.find((x) => (x.contentType || "").toLowerCase().startsWith(p));
    if (a) return a;
  }
  return atts[0];
}
function b64ToBytes(b64) { const bin = atob(b64.replace(/\s+/g, "")); return Uint8Array.from(bin, (c) => c.charCodeAt(0)); }
function htmlToText(html) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll("script,style").forEach((n) => n.remove());
  doc.querySelectorAll("br").forEach((n) => n.replaceWith("\n"));
  doc.querySelectorAll("p,div,tr,li,h1,h2,h3,h4,h5,h6").forEach((n) => n.append("\n"));
  return (doc.body.textContent || "").replace(/\n{3,}/g, "\n\n").trim();
}
async function pdfToText(bytes) {
  if (typeof pdfjsLib === "undefined") return "[PDF reader library failed to load]";
  pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js";
  const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
  const pages = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const content = await (await pdf.getPage(p)).getTextContent();
    let line = "", lastY = null, out = "";
    for (const it of content.items) {
      const y = it.transform[5];
      if (lastY !== null && Math.abs(y - lastY) > 2) { out += line.trimEnd() + "\n"; line = ""; }
      line += it.str + (it.hasEOL ? "\n" : "");
      lastY = y;
    }
    pages.push((out + line).trim());
  }
  return pages.join("\n\n").trim() || "[PDF contained no extractable text (it may be a scanned image)]";
}
async function xmlToText(xml) {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  if (doc.querySelector("parsererror")) return htmlToText(xml);
  const pdfEl = [...doc.querySelectorAll("*")].find((el) => !el.children.length && /^\s*JVBER/.test(el.textContent));
  if (pdfEl) return await pdfToText(b64ToBytes(pdfEl.textContent));
  doc.querySelectorAll("*").forEach((el) => { if (!el.children.length) el.append("\n"); });
  const root = doc.querySelector("document-data") || doc.documentElement;
  let text = (root.textContent || "").trim();
  if (/<\/?(p|div|br|span|table|html|body)\b[^>]*>/i.test(text)) text = htmlToText(text);
  return text.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}
// Fetch note content with a fresh sign-in token (Cerner tokens expire after ~10 minutes).
async function authFetch(url, accept) {
  const go = () => fetch(url, { headers: { Authorization: "Bearer " + state.client.state.tokenResponse.access_token, Accept: accept } });
  try { await state.client.refreshIfNeeded(); } catch (e) {}
  let res = await go();
  if (res.status === 401) {
    try { await state.client.refresh(); } catch (e) { throw new Error("sign-in expired - relaunch the app from the sandbox"); }
    res = await go();
  }
  if (res.status === 401) throw new Error("HTTP 401 - sign-in expired, relaunch the app from the sandbox");
  if (!res.ok) throw new Error("HTTP " + res.status);
  return res;
}

async function getText(doc) {
  const att = pickAttachment(doc);
  if (!att) return "";
  const ct = (att.contentType || "").toLowerCase();
  try {
    let raw;
    if (att.data) {
      const bytes = b64ToBytes(att.data);
      raw = ct.startsWith("application/pdf") ? await pdfToText(bytes) : new TextDecoder("utf-8").decode(bytes);
      if (ct.startsWith("application/pdf")) return raw;
    } else if (att.url) {
      const url = new URL(att.url, state.client.state.serverUrl + "/").href;
      const res = await authFetch(url, att.contentType || "*/*");
      if (ct.startsWith("application/pdf")) return await pdfToText(new Uint8Array(await res.arrayBuffer()));
      if (ct.startsWith("image/")) return "";
      raw = await res.text();
    } else return "";
    if (/^\s*<\?xml/i.test(raw) || (ct.includes("xml") && !ct.includes("xhtml"))) return await xmlToText(raw);
    if (ct.includes("html")) return htmlToText(raw);
    if (ct.includes("rtf")) return raw.replace(/\\par[d]?/g, "\n").replace(/\\'[0-9a-f]{2}/gi, "").replace(/[{}]|\\[a-z]+-?\d* ?/gi, "").trim();
    return raw;
  } catch (e) {
    state.diag.push(`note ${doc.id}: could not read (${e.message || e})`);
    return "";
  }
}


// ---------- Parse observations (from the lab app, plus BP components and LOINC codes) ----------
function ccText(cc) { return cc ? (cc.text || (cc.coding || []).map((c) => c.display).find(Boolean) || "") : ""; }
const loincs = (cc) => (cc && cc.coding || []).filter((c) => !c.system || /loinc/i.test(c.system)).map((c) => c.code);

function parseAll(res) {
  const out = [];
  res.filter((r) => r.resourceType === "Observation").forEach((o) => {
    // Blood pressure often arrives as one panel with systolic/diastolic components
    if (o.component && o.component.length && !o.valueQuantity) {
      o.component.forEach((c) => {
        const p = parse({ ...o, code: c.code, valueQuantity: c.valueQuantity, interpretation: c.interpretation || o.interpretation, referenceRange: c.referenceRange });
        if (p) out.push(p);
      });
    } else {
      const p = parse(o);
      if (p) out.push(p);
    }
  });
  return out;
}

function parse(o) {
  if (["entered-in-error", "cancelled"].includes(o.status)) return null;
  let value = "", unit = "", num = null;
  if (o.valueQuantity && o.valueQuantity.value != null) {
    num = Number(o.valueQuantity.value); value = String(num); unit = o.valueQuantity.unit || o.valueQuantity.code || "";
  } else if (o.valueString) value = o.valueString;
  else if (o.valueCodeableConcept) value = ccText(o.valueCodeableConcept);
  else if (o.valueInteger != null) { num = o.valueInteger; value = String(num); }
  let dateVal = null;
  if (!value && o.valueDateTime) { dateVal = new Date(o.valueDateTime); value = fmt(dateVal); }
  if (!value && o.valueBoolean != null) value = o.valueBoolean ? "Yes" : "No";
  if (!value) return null;

  const rr = (o.referenceRange || [])[0] || {};
  const low = rr.low && rr.low.value, high = rr.high && rr.high.value;
  const ref = rr.text || (low != null || high != null ? `${low != null ? low : ""} – ${high != null ? high : ""}` : "");

  const codes = (o.interpretation || []).flatMap((i) => (i.coding || []).map((c) => (c.code || "").toUpperCase()).concat((i.text || "").toUpperCase()));
  let flag = "";
  if (codes.some((c) => ["HH", "LL", "AA", "CRIT", "CRITICAL"].includes(c))) flag = "C";
  else if (codes.some((c) => c === "H" || c === "HIGH")) flag = "H";
  else if (codes.some((c) => c === "L" || c === "LOW")) flag = "L";
  else if (codes.some((c) => c === "A" || c === "ABNORMAL")) flag = "A";
  else if (num != null && low != null && num < low) flag = "L";
  else if (num != null && high != null && num > high) flag = "H";

  const when = new Date(o.effectiveDateTime || (o.effectivePeriod && o.effectivePeriod.start) || o.issued);
  const cats = (o.category || []).flatMap((c) => (c.coding || []).map((x) => x.code).concat(c.text || "")).filter(Boolean);
  return { name: ccText(o.code) || "Unknown", codes: loincs(o.code), value, num, unit, ref, flag, when, dateVal, cats };
}


// ---------- Vitals: this window vs the window before ----------
function vitalRows() {
  const a = state.anchor, w = W("vitals"), cur = [a - w, a], prev = [a - 2 * w, a - w];
  const inWin = (r, x) => r.when >= x[0] && r.when <= x[1];
  return VITALS.map((v) => {
    const t = state.cfg.vitals[v.key] || {};
    const all = state.vitals.filter((r) => r.num != null && r.codes.some((c) => v.codes.includes(c)))
      .map((r) => ({ ...r, num: v.key === "temp" ? toC(r.num, r.unit) : v.key === "wt" && /lb/i.test(r.unit) ? r.num / 2.2046 : r.num }));
    const now = all.filter((r) => inWin(r, cur)).sort((x, y) => y.when - x.when);
    const before = all.filter((r) => inWin(r, prev));
    if (!now.length) return { v, none: true };
    const nums = now.map((r) => r.num), min = Math.min(...nums), max = Math.max(...nums);
    const pmin = before.length ? Math.min(...before.map((r) => r.num)) : null;
    const pmax = before.length ? Math.max(...before.map((r) => r.num)) : null;
    const flags = [];
    if (t.hi != null && max >= t.hi) flags.push("high " + fmtN(max));
    if (t.lo != null && min <= t.lo) flags.push("low " + fmtN(min));
    return { v, latest: now[0], min, max, n: now.length, pmin, pmax, flags };
  });
}

// ---------- Labs: resulted in the window, compared with the previous result of the same test ----------
function labRows() {
  const a = state.anchor, start = a - W("labs");
  const byName = {};
  state.labs.forEach((r) => (byName[r.name] = byName[r.name] || []).push(r));
  const rows = [];
  for (const name of Object.keys(byName)) {
    const rs = byName[name].sort((x, y) => y.when - x.when);
    const latest = rs[0];
    if (!(latest.when >= start && latest.when <= a)) continue; // only tests resulted in the window
    const prev = rs.find((r) => r.when < start);
    let delta = null, pct = null;
    if (prev && latest.num != null && prev.num != null) {
      delta = latest.num - prev.num;
      pct = prev.num !== 0 ? (delta / Math.abs(prev.num)) * 100 : null;
    }
    const big = pct != null && state.cfg.labPct != null && Math.abs(pct) >= state.cfg.labPct;
    rows.push({ name, latest, prev, delta, pct, big });
  }
  // Abnormal and big changes first
  return rows.sort((x, y) => (rank(y) - rank(x)) || x.name.localeCompare(y.name));
}
const rank = (r) => (r.latest.flag === "C" ? 3 : 0) + (r.latest.flag ? 2 : 0) + (r.big ? 1 : 0);

// ---------- Rendering ----------
// Collapsible section header; the open/closed choice is remembered in this browser.
function sec(id, title, info, alert, def = true) {
  return `<details class="card sec" data-sec="${id}" ${isOpen(id, def) ? "open" : ""}><summary><h2>${title}</h2>` +
    `<span class="pill ${alert ? "alert" : ""}">${esc(info)}</span>${SEC_DATA[id] ? periodSel(id) : ""}</summary>`;
}
// "Period" drop-down shown in each section's title bar
function periodSel(id) {
  const cur = state.cfg.secWin && state.cfg.secWin[id];
  return `<label class="per noprint">Period <select class="per" data-sec="${id}">` +
    `<option value="">Same as panel (${PERIODS.find((x) => x[0] === state.cfg.win)[1]})</option>` +
    PERIODS.map(([h, l]) => `<option value="${h}" ${cur === h ? "selected" : ""}>${l}</option>`).join("") + `</select></label>`;
}
function isOpen(id, def = true) { try { const v = localStorage.getItem("wc-" + id); return v ? v === "open" : def; } catch (e) { return def; } }
function saveOpen(id, open) { if (state.printing) return; try { localStorage.setItem("wc-" + id, open ? "open" : "closed"); } catch (e) {} }
const loadingSec = (id, title) => `${sec(id, title, "loading…", false)}<p class="note">Loading…</p></details>`;

function computeAnchor() {
  // "Now" for the windows. In the sandbox the newest data can be months old, so if nothing falls in the
  // window we anchor it to the newest vital/lab result instead (and say so on screen).
  const newest = Math.max(0, ...state.vitals.concat(state.labs).map((r) => +r.when).filter((t) => !isNaN(t) && t <= state.now));
  if (newest && state.now - newest > win()) { state.anchor = newest; state.stale = true; }
  else { state.anchor = state.now; state.stale = false; }
}

function render() {
  const ready = state.loaded.vitals && state.loaded.labs;
  if (ready) computeAnchor();
  const has = (k) => ready && !busy(k);
  const Hh = state.cfg.win;
  const vr = has("vitals") ? vitalRows() : [], lr = has("labs") ? labRows() : [], mr = has("meds") ? medRows() : [];
  const bw = has("other") ? bowelInfo() : null, io = has("other") ? ioInfo() : null;
  const vFlags = vr.filter((r) => r.flags && r.flags.length);
  const lFlags = lr.filter((r) => r.latest.flag || r.big);
  const notesDone = has("docs") && state.noteHits;
  const nPos = notesDone ? state.noteHits.filter((h) => h.pos.length).length : null;
  const dots = '<span class="note">…</span>';
  let html = "";

  if (ready && state.stale) {
    html += `<div class="warn">No results in the past ${Hh} hours (common in the sandbox). Showing the ${Hh} hours up to the most recent result: ${fmt(new Date(state.anchor))}.</div>`;
  }

  html += `<section class="card"><h2>At a glance</h2><div class="sum">
    <div class="stat"><b>${has("vitals") ? vFlags.length : dots}</b><span>vital signs out of range</span></div>
    <div class="stat"><b>${has("labs") ? lr.length : dots}</b><span>labs resulted in ${winLabel("labs")}</span></div>
    <div class="stat"><b>${has("labs") ? lFlags.length : dots}</b><span>abnormal or changed ≥${esc(state.cfg.labPct)}%</span></div>
    <div class="stat"><b>${has("meds") ? mr.length : dots}</b><span>medication changes</span></div>
    <div class="stat"><b class="${bw && bw.flag ? "H" : ""}">${bw ? (bw.days == null ? "–" : fmtN(bw.days)) : dots}</b><span>days since last BM</span></div>
    <div class="stat"><b class="${io && io.oliguria ? "H" : ""}">${io ? (io.net == null ? "–" : sgn(io.net)) : dots}</b><span>net fluid balance (${winLabel("io")})</span></div>
    <div class="stat"><b>${notesDone ? ((state.notes || []).length ? nPos : "–") : dots}</b><span>items flagged in notes</span></div></div>
    <div class="toolbar" style="margin-top:10px">
      <label class="note">Window (all sections) <select id="winSel">${[12, 24, 48, 72].map((h) => `<option value="${h}" ${h === Hh ? "selected" : ""}>last ${h} h</option>`).join("")}</select></label>
      <button id="copyBtn">Copy summary</button><button id="printBtn">Print</button>
      <button id="collapseAll">Collapse all</button><button id="expandAll">Expand all</button><span id="copied" class="note"></span></div>
    ${ready ? `<p class="note">Window: ${fmt(new Date(state.anchor - win()))} to ${fmt(new Date(state.anchor))}. Decision support only; verify in the chart.</p>` : `<p class="note">Loading vital signs and labs…</p>`}
    <p class="note printonly">Printed ${fmt(new Date())}. Decision support only; verify in the chart.</p>
    <details class="noprint" data-k="sum"><summary class="note">Preview summary</summary><pre class="sumpre">${esc(summaryText())}</pre></details>
    <details class="noprint" data-k="diag"><summary class="note">Diagnostics</summary><p class="note">${state.diag.map(esc).join("<br>")}</p>${otherNames()}</details></section>`;

  html += has("vitals") ? vitalsHtml(vr, vFlags) : loadingSec("vitals", `Vital signs (last ${winLabel("vitals")})`);
  html += has("labs") ? labsHtml(lr, lFlags) : loadingSec("labs", `Lab changes (resulted in last ${winLabel("labs")})`);
  html += has("meds") ? medsHtml(mr) : loadingSec("meds", `Medication changes (last ${winLabel("meds")})`);
  html += bw ? bowelsHtml(bw) : loadingSec("bowels", "Bowels");
  html += io ? ioHtml(io) : loadingSec("io", `Intake / output (last ${winLabel("io")})`);
  html += notesHtml(has("docs"));

  $("main").innerHTML = html;
  wire();
}

function wire() {
  document.querySelectorAll("#main details.sec").forEach((d) => (d.ontoggle = () => saveOpen(d.dataset.sec, d.open)));
  // Small fold-outs (Diagnostics, Preview summary, Notes scanned) stay open when the panel redraws
  document.querySelectorAll("#main details[data-k]").forEach((d) => {
    d.open = state.openK.has(d.dataset.k);
    d.ontoggle = () => (d.open ? state.openK.add(d.dataset.k) : state.openK.delete(d.dataset.k));
  });
  $("collapseAll").onclick = () => document.querySelectorAll("#main details.sec").forEach((d) => (d.open = false));
  $("expandAll").onclick = () => document.querySelectorAll("#main details.sec").forEach((d) => (d.open = true));
  $("printBtn").onclick = () => window.print();
  $("copyBtn").onclick = () => copyText(summaryText());
  $("winSel").onchange = (e) => { state.cfg.win = Number(e.target.value); saveCfg(); render(); scanNotes(); ensureData(); };
  document.querySelectorAll("select.per").forEach((sel) => {
    // Using the drop-down must not fold/unfold the section it sits in
    sel.parentElement.onclick = (e) => { e.preventDefault(); e.stopPropagation(); };
    sel.onchange = () => {
      state.cfg.secWin = state.cfg.secWin || {};
      if (sel.value) state.cfg.secWin[sel.dataset.sec] = Number(sel.value); else delete state.cfg.secWin[sel.dataset.sec];
      saveCfg(); render(); scanNotes(); ensureData();
    };
  });
}

function vitalsHtml(vr, vFlags) {
  const Hh = winLabel("vitals");
  return `${sec("vitals", `Vital signs (last ${Hh})`, `${vFlags.length} out of range`, vFlags.length)}<table>
    <thead><tr><th>Vital</th><th>Latest</th><th>${Hh} range</th><th>Previous ${Hh}</th><th>Readings</th><th>Flags</th></tr></thead><tbody>` +
    vr.map((r) => r.none
      ? `<tr class="none"><td>${r.v.label}</td><td colspan="5" class="note">no readings</td></tr>`
      : `<tr class="${r.flags.length ? "flagged" : "ok"}"><td>${r.v.label}</td>
         <td>${fmtN(r.latest.num)} ${esc(r.v.unit)} <span class="note">${fmtT(r.latest.when)}</span></td>
         <td>${fmtN(r.min)}–${fmtN(r.max)}</td>
         <td>${r.pmin == null ? '<span class="note">–</span>' : fmtN(r.pmin) + "–" + fmtN(r.pmax)}</td>
         <td>${r.n}</td>
         <td>${r.flags.map((f) => `<span class="b avoid">${esc(f)}</span>`).join("")}</td></tr>`).join("") +
    `</tbody></table></details>`;
}

function labsHtml(lr, lFlags) {
  const Hh = winLabel("labs");
  return `${sec("labs", `Lab changes (resulted in last ${Hh})`, `${lr.length} resulted, ${lFlags.length} flagged`, lFlags.length)}<table>
    <thead><tr><th>Test</th><th>Latest</th><th>Previous</th><th>Change</th><th>Reference</th></tr></thead><tbody>` +
    (lr.map((r) => `<tr class="${r.latest.flag || r.big ? "flagged" : "ok"}"><td>${esc(r.name)}</td>
       <td>${val(r.latest)} <span class="note">${fmtT(r.latest.when)}</span></td>
       <td>${r.prev ? esc(r.prev.value) + " " + esc(r.prev.unit) + ` <span class="note">${fmtD(r.prev.when)}</span>` : '<span class="note">none</span>'}</td>
       <td>${change(r)}</td><td class="note">${esc(r.latest.ref)}</td></tr>`).join("") ||
     `<tr><td colspan="5" class="note">No labs resulted in this window.</td></tr>`) +
    `</tbody></table></details>`;
}

function medsHtml(mr) {
  const Hh = winLabel("meds");
  const MTYPE = { started: ["Started", "start"], stopped: ["Stopped", "stop"], changed: ["Dose / order changed", "chg"] };
  const activeN = (state.meds || []).filter((m) => m.status === "active").length;
  let body = mr.map((r) => `<tr class="${r.type === "changed" ? "flagged" : "ok"}">
      <td><span class="b ${MTYPE[r.type][1]}">${MTYPE[r.type][0]}</span></td>
      <td>${esc(r.m.label)}</td>
      <td>${r.type === "changed" ? `<span class="note">was:</span> ${esc(r.old.sig || r.old.label)}<br><span class="note">now:</span> ${esc(r.m.sig)}` : esc(r.m.sig)}</td>
      <td class="note">${fmtT(r.when)}</td></tr>`).join("");
  if (!body) {
    const last = Math.max(0, ...(state.meds || []).flatMap((m) => [+m.start, +m.end]).filter((t) => !isNaN(t) && t <= state.anchor));
    body = `<tr><td colspan="4" class="note">No medication changes in this window.${last ? " Most recent change: " + fmt(new Date(last)) + "." : ""}</td></tr>`;
  }
  return `${sec("meds", `Medication changes (last ${Hh})`, `${mr.length} change(s)`, mr.length)}
    <p class="note">${activeN} active medication order(s) on file.</p>
    <table><thead><tr><th>Change</th><th>Medication</th><th>Directions</th><th>When</th></tr></thead><tbody>${body}</tbody></table></details>`;
}

function bowelsHtml(bw) {
  const info = bw.days == null ? (bw.any ? "no BM charted" : "not documented") : `last BM ${fmtN(bw.days)} day(s) ago`;
  return `${sec("bowels", "Bowels", info, bw.flag)}` + (bw.any
    ? `<table><tbody>
        <tr class="${bw.flag ? "flagged" : "ok"}"><td style="width:220px">Days since last BM</td><td><b class="${bw.flag ? "H" : ""}">${bw.days == null ? "none charted" : fmtN(bw.days)}</b>${bw.flag ? ` <span class="b chg">≥ ${esc(state.cfg.bmDays)} days - consider bowel regimen</span>` : ""}</td></tr>
        <tr><td>Last BM</td><td>${bw.last ? fmt(bw.last.when) + ` <span class="note">(${esc(bw.last.r.name)}: ${esc(bw.last.r.value)})</span>` : '<span class="note">–</span>'}</td></tr>
        <tr><td>BMs charted in last ${winLabel("bowels")}</td><td>${bw.inWin}</td></tr></tbody></table>
       <p class="note" style="margin:10px 0 4px">Recent stool / bowel entries:</p>
       <table><thead><tr><th>When</th><th>Item</th><th>Value</th></tr></thead><tbody>` +
       bw.recent.map((r) => `<tr><td class="note">${fmtT(r.when)}</td><td>${esc(r.name)}</td><td>${esc(r.value)} ${esc(r.unit)}</td></tr>`).join("") +
       `</tbody></table>`
    : `<p class="note">No stool or bowel-movement charting was found for this patient. Open Diagnostics to see which observation names the server returned.</p>`) + `</details>`;
}

function ioHtml(io) {
  const Hh = winLabel("io");
  const line = (name, c, p) => `<tr><td>${esc(name)}</td><td>${mL(c)}</td><td class="note">${p == null ? "–" : mL(p)}</td></tr>`;
  const sideRows = (s) => [...new Set(Object.keys(io.cur[s]).concat(Object.keys(io.prev[s])))].sort()
    .map((n) => line(n, io.cur[s][n] || 0, io.prev[s][n])).join("");
  const pill = io.cur.any ? `in ${mL(io.cur.tin || 0)} / out ${mL(io.cur.tout || 0)}` : "none charted";
  let body;
  if (io.cur.any || io.prev.any) {
    body = `<table><thead><tr><th>Item</th><th>Last ${Hh}</th><th>Previous ${Hh}</th></tr></thead><tbody>
      <tr><td colspan="3"><b>Intake</b></td></tr>${sideRows("in") || '<tr><td colspan="3" class="note">none charted</td></tr>'}
      <tr><td><b>Total intake</b></td><td><b>${mL(io.cur.tin || 0)}</b></td><td class="note">${io.prev.tin == null ? "–" : mL(io.prev.tin)}</td></tr>
      <tr><td colspan="3"><b>Output</b></td></tr>${sideRows("out") || '<tr><td colspan="3" class="note">none charted</td></tr>'}
      <tr><td><b>Total output</b></td><td><b>${mL(io.cur.tout || 0)}</b></td><td class="note">${io.prev.tout == null ? "–" : mL(io.prev.tout)}</td></tr>
      <tr class="flagged"><td><b>Net balance</b></td><td><b>${sgn(io.net)}</b></td><td class="note">${io.pnet == null ? "–" : sgn(io.pnet)}</td></tr>
      ${io.cur.urine != null ? `<tr class="${io.oliguria ? "flagged" : "ok"}"><td>Urine output</td><td>${mL(io.cur.urine)}${io.perKg != null ? ` (${io.perKg.toFixed(2)} mL/kg/h, wt ${fmtN(io.kg)} kg)` : ""}${io.oliguria ? ' <span class="b avoid">low urine output</span>' : ""}</td><td class="note">${io.prev.urine == null ? "–" : mL(io.prev.urine)}</td></tr>` : ""}
      </tbody></table>
      <p class="note">Totals depend on complete charting. Items named "total" are used instead of adding the individual entries.</p>`;
  } else {
    body = `<p class="note">No intake/output charted in this window.${io.lastAny ? " Most recent I&amp;O entry: " + fmt(new Date(io.lastAny)) + "." : " None found for this patient - open Diagnostics to see which observation names the server returned."}</p>`;
  }
  return `${sec("io", `Intake / output (last ${Hh})`, pill, io.oliguria)}${body}</details>`;
}

function notesHtml(docsLoaded) {
  const title = `Notes scan (last ${winLabel("notes")})`;
  if (!docsLoaded || !state.anchor) return loadingSec("notes", title);
  const capped = state.notesTotal > (state.notes || []).length && !state.notesFallback
    ? `<p class="note">Scanning the newest ${(state.notes || []).length} of ${state.notesTotal} notes in this period.</p>` : "";
  if (!state.noteHits) return `${sec("notes", title, "scanning…", false)}<p class="note">${esc(state.notesMsg || "Scanning notes…")}</p></details>`;
  const notes = state.notes || [], hits = state.noteHits;
  const pos = hits.filter((h) => h.pos.length), negOnly = hits.filter((h) => !h.pos.length && h.neg.length);
  const pill = notes.length ? `${pos.length} flagged in ${notes.length} note(s)` : "no notes";
  if (!notes.length) return `${sec("notes", title, pill, false)}<p class="note">No notes found for this patient. Open Diagnostics for details.</p></details>`;
  const noteLabel = (ni) => { const n = notes[ni]; return `${esc(n.type)} · ${fmtT(n.when)}${n.author ? " · " + esc(n.author) : ""}`; };
  const item = (x, m) => `<div style="margin:${m}">${snippet(x)}<br><span class="note">${noteLabel(x.ni)}</span></div>`;
  let html = capped + (state.notesFallback
    ? `<div class="warn" style="margin-bottom:10px">No notes were written in the last ${winLabel("notes")}, so the ${notes.length} most recent note(s) were scanned instead (dates below).</div>` : "");
  html += `<table><thead><tr><th style="width:190px">Symptom</th><th>Mentioned (most recent first)</th><th style="width:120px">Mentions</th></tr></thead><tbody>`;
  html += pos.map((h) => {
    const list = h.pos.slice().sort((x, y) => notes[y.ni].when - notes[x.ni].when);
    const more = list.length > 2 ? `<details><summary class="note">${list.length - 2} more</summary>${list.slice(2).map((x) => item(x, "6px 0")).join("")}</details>` : "";
    return `<tr class="flagged"><td><b>${esc(h.s.label)}</b></td><td>${list.slice(0, 2).map((x) => item(x, "0 0 6px")).join("")}${more}</td><td>${h.pos.length}${h.neg.length ? ` <span class="note">(+${h.neg.length} negative)</span>` : ""}</td></tr>`;
  }).join("") || `<tr><td colspan="3" class="note">None of the tracked symptoms were mentioned (other than as negatives).</td></tr>`;
  html += `</tbody></table>`;
  if (negOnly.length) html += `<p class="note" style="margin-top:10px"><b>Documented as absent / denied:</b> ${negOnly.map((h) => esc(h.s.label)).join(", ")}</p>`;
  html += `<details class="noprint" data-k="notesread" style="margin-top:8px"><summary class="note">Notes scanned (${notes.length}) - click to read</summary>` +
    notes.map((n, i) => `<details style="margin:6px 0 6px 12px"><summary class="note">${noteLabel(i)}</summary>
      <pre class="notetext">${esc(n.text || "[no readable text]")}</pre></details>`).join("") +
    `</details><p class="note">Keyword scan with simple negation handling ("denies", "no", "Nausea: No"). It will miss some phrasing and occasionally misread a sentence - always read the note. Edit the list under Settings.</p>`;
  return `${sec("notes", title, pill, pos.length)}${html}</details>`;
}

// ---------- Settings panel ----------
function renderSettings() {
  const c = state.cfg;
  const v = (x) => (x == null ? "" : esc(x));
  const box = $("settingsWrap");
  box.innerHTML = `${sec("settings", "Settings", "saved in this browser", false, false)}
    <div class="setgrid">
      <div><h3>Vital-sign flags</h3>
        <table><thead><tr><th>Vital</th><th>Low (≤)</th><th>High (≥)</th></tr></thead><tbody>
        ${VITALS.map((x) => `<tr><td>${x.label} <span class="note">${esc(x.unit)}</span></td>
          <td><input type="number" step="any" data-v="${x.key}" data-b="lo" value="${v(c.vitals[x.key].lo)}"></td>
          <td><input type="number" step="any" data-v="${x.key}" data-b="hi" value="${v(c.vitals[x.key].hi)}"></td></tr>`).join("")}
        </tbody></table><p class="note">Leave a box blank for no flag.</p></div>
      <div><h3>Other flags</h3>
        <label class="setrow">Flag a lab change of ≥ <input id="setLabPct" type="number" step="any" value="${v(c.labPct)}"> %</label>
        <label class="setrow">Flag no BM after <input id="setBm" type="number" step="any" value="${v(c.bmDays)}"> days</label>
        <label class="setrow">Low urine output below <input id="setUoKg" type="number" step="any" value="${v(c.uoKg)}"> mL/kg/h</label>
        <label class="setrow">…or, if no weight on file, below <input id="setUoDay" type="number" step="any" value="${v(c.uoDay)}"> mL per 24 h</label></div>
      <div><h3>Notes scan</h3>
        <div class="symgrid">${SYMPTOMS.map((s) => `<label><input type="checkbox" class="symChk" value="${s.key}" ${(c.symptomsOff || []).includes(s.key) ? "" : "checked"}> ${esc(s.label)}</label>`).join("")}</div>
        <label class="setrow" style="display:block;margin-top:8px">Extra words or phrases to look for (comma-separated):<br>
          <textarea id="setCustom" rows="2" placeholder="e.g. pressure injury, hypoglycemia, restraint, wandering">${esc(c.customTerms || "")}</textarea></label></div>
    </div>
    <div class="toolbar" style="margin-top:10px"><button id="setSave">Save &amp; apply</button><button id="setReset">Reset to defaults</button><span id="setMsg" class="note"></span></div></details>`;
  const d = box.querySelector("details");
  d.ontoggle = () => saveOpen("settings", d.open);
  $("setSave").onclick = () => {
    const num = (s) => { const t = String(s).trim(); if (t === "") return null; const n = Number(t); return isNaN(n) ? null : n; };
    box.querySelectorAll("input[data-v]").forEach((i) => (c.vitals[i.dataset.v][i.dataset.b] = num(i.value)));
    c.labPct = num($("setLabPct").value); c.bmDays = num($("setBm").value);
    c.uoKg = num($("setUoKg").value); c.uoDay = num($("setUoDay").value);
    c.symptomsOff = [...box.querySelectorAll(".symChk")].filter((x) => !x.checked).map((x) => x.value);
    c.customTerms = $("setCustom").value;
    saveCfg(); render(); scanNotes();
    $("setMsg").textContent = "Saved - the panel has been updated.";
  };
  $("setReset").onclick = () => {
    const keepWin = state.cfg.win;
    state.cfg = clone(DEFAULTS); state.cfg.win = keepWin;
    saveCfg(); renderSettings(); render(); scanNotes();
    $("setMsg").textContent = "Defaults restored.";
  };
}

// ---------- Print: open every section for printing, then put them back ----------
function setupPrint() {
  let saved = [];
  window.addEventListener("beforeprint", () => {
    state.printing = true;
    saved = [...document.querySelectorAll("#main details:not(.noprint)")].map((d) => [d, d.open]);
    saved.forEach(([d]) => (d.open = true));
  });
  window.addEventListener("afterprint", () => {
    saved.forEach(([d, o]) => (d.open = o));
    setTimeout(() => (state.printing = false), 0); // toggle events fire after this; don't save them
  });
}

// ---------- Copy summary: a ready-to-paste "events" block for the progress note ----------
function copyText(t) {
  const done = () => ($("copied").textContent = "Copied - paste into your note and edit.");
  const fallback = () => {
    const ta = document.createElement("textarea");
    ta.value = t; ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select();
    try { document.execCommand("copy"); done(); } catch (e) { $("copied").textContent = "Copy failed - use Preview summary and copy by hand."; }
    ta.remove();
  };
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(done, fallback);
  else fallback();
}

function summaryText() {
  const ready = state.loaded.vitals && state.loaded.labs && state.anchor;
  if (!ready) return "Still loading.";
  const has = (k) => !busy(k);
  const Hh = state.cfg.win, a = state.anchor;
  const sfx = (k) => (secH(k) !== Hh ? ` (last ${winLabel(k)})` : ""); // a section with its own period says so
  const rng = (lo, hi) => (fmtN(lo) === fmtN(hi) ? fmtN(lo) : `${fmtN(lo)}-${fmtN(hi)}`);
  const out = [`Last ${Hh} h (${fmt(new Date(a - win()))} to ${fmt(new Date(a))}):`];

  // Vitals, with systolic/diastolic combined as BP
  if (busy("vitals") || busy("labs")) return "Still loading.";
  const vr = {}; vitalRows().filter((r) => !r.none).forEach((r) => (vr[r.v.key] = r));
  const fl = (r) => (r.flags.length ? " (" + r.flags.join(", ") + ")" : "");
  const v = [];
  if (vr.temp) v.push(`T ${rng(vr.temp.min, vr.temp.max)}${fl(vr.temp)}`);
  if (vr.hr) v.push(`HR ${rng(vr.hr.min, vr.hr.max)}${fl(vr.hr)}`);
  if (vr.sbp || vr.dbp) {
    const s = vr.sbp ? rng(vr.sbp.min, vr.sbp.max) : "?", d = vr.dbp ? rng(vr.dbp.min, vr.dbp.max) : "?";
    const f = [].concat(vr.sbp ? vr.sbp.flags.map((x) => "SBP " + x) : [], vr.dbp ? vr.dbp.flags.map((x) => "DBP " + x) : []);
    const lbl = vr.sbp && vr.dbp ? `BP ${s}/${d}` : vr.sbp ? `SBP ${s}` : `DBP ${d}`;
    v.push(`${lbl}${f.length ? " (" + f.join(", ") + ")" : ""}`);
  }
  if (vr.rr) v.push(`RR ${rng(vr.rr.min, vr.rr.max)}${fl(vr.rr)}`);
  if (vr.spo2) v.push(`SpO2 ${rng(vr.spo2.min, vr.spo2.max)}%${fl(vr.spo2)}`);
  if (vr.wt) v.push(`Wt ${fmtN(vr.wt.latest.num)} kg`);
  out.push(`- Vitals${sfx("vitals")}: ` + (v.join(", ") || "none charted"));

  const lr = labRows();
  out.push(`- Labs${sfx("labs")}: ` + (lr.map((r) => `${r.name} ${r.latest.value}${r.latest.flag ? " " + r.latest.flag : ""}` +
    (r.prev ? ` (prev ${r.prev.value}${r.pct != null ? ", " + (r.pct > 0 ? "+" : "") + Math.round(r.pct) + "%" : ""})` : "")).join("; ") || "none resulted"));

  if (has("meds")) {
    const m = medRows().map((r) => r.type === "changed" ? `Changed ${r.m.label}: ${r.old.sig || r.old.label} -> ${r.m.sig}`
      : r.type === "started" ? `Started ${r.m.label}${r.m.sig ? " " + r.m.sig : ""}` : `Stopped ${r.m.label}`);
    out.push(`- Meds${sfx("meds")}: ` + (m.join("; ") || "no changes"));
  } else out.push("- Meds: (still loading)");

  if (has("other")) {
    const bw = bowelInfo(), io = ioInfo();
    out.push("- Bowels: " + (bw.days == null ? "no BM charted" : `last BM ${fmtN(bw.days)} d ago (${fmtT(bw.last.when)})`));
    out.push(`- I/O${sfx("io")}: ` + (io.cur.any ? `in ${mL(io.cur.tin || 0)}, out ${mL(io.cur.tout || 0)}, net ${sgn(io.net).replace("−", "-")}` +
      (io.cur.urine != null ? `; urine ${mL(io.cur.urine)}${io.perKg != null ? " (" + io.perKg.toFixed(2) + " mL/kg/h)" : ""}` : "") : "none charted"));
  } else out.push("- Bowels / I/O: (still loading)");

  if (!state.noteHits) out.push("- Notes: (still scanning)");
  else if (!(state.notes || []).length) out.push("- Notes: no notes found");
  else {
    const notes = state.notes;
    const pos = state.noteHits.filter((h) => h.pos.length), neg = state.noteHits.filter((h) => !h.pos.length && h.neg.length);
    out.push(`- Notes${sfx("notes")}${state.notesFallback ? " (none written in this period; from the most recent notes)" : ""}: ` + (pos.length ? "" : "none of the tracked symptoms mentioned"));
    pos.forEach((h) => {
      const x = h.pos.slice().sort((p, q) => notes[q.ni].when - notes[p.ni].when)[0];
      const s = x.sen.length > 140 ? x.sen.slice(0, 137) + "..." : x.sen;
      out.push(`   - ${h.s.label}: "${s}" (${notes[x.ni].type}, ${fmtT(notes[x.ni].when)})`);
    });
    if (neg.length) out.push(`   - Denied / absent: ${neg.map((h) => h.s.label).join(", ")}`);
  }
  return out.join("\n");
}

// Diagnostics: every non-lab observation name the server returned (helps match your site's charting names)
function otherNames() {
  const vit = new Set(VITALS.flatMap((v) => v.codes));
  const counts = {};
  (state.other || []).filter((r) => !r.codes.some((c) => vit.has(c))).forEach((r) => (counts[r.name] = (counts[r.name] || 0) + 1));
  const names = Object.keys(counts).sort();
  if (!state.loaded.other) return "";
  if (!names.length) return `<p class="note">No non-lab, non-vital observations returned.</p>`;
  const tag = (n) => (BM_RE.test(n) && !BM_EXCL.test(n) ? " [bowel]" : "");
  return `<p class="note"><b>Other observation names found (${names.length}):</b><br>` +
    names.slice(0, 80).map((n) => esc(n + " ×" + counts[n] + tag(n))).join("<br>") + `</p>`;
}

const ARROW = { H: "▲ H", L: "▼ L", C: "‼ CRIT", A: "A" };
function val(r) { return `<span class="${r.flag === "A" ? "H" : r.flag}">${esc(r.value)} ${esc(r.unit)} ${r.flag ? ARROW[r.flag] : ""}</span>`; }
function change(r) {
  if (r.delta == null) return '<span class="note">–</span>';
  const arrow = r.delta > 0 ? "↑" : r.delta < 0 ? "↓" : "→";
  const txt = `${arrow} ${fmtN(Math.abs(r.delta))}${r.pct != null ? " (" + Math.round(r.pct) + "%)" : ""}`;
  return r.big ? `<b>${txt}</b>` : txt;
}
function toC(n, unit) { return /f/i.test(unit || "") ? (n - 32) * 5 / 9 : n; }
const fmtN = (n) => (n == null || isNaN(n) ? "" : (Math.round(n * 10) / 10).toString());
const fmt = (d) => (isNaN(d) ? "" : d.toLocaleString([], { dateStyle: "medium", timeStyle: "short" }));
const fmtT = (d) => (isNaN(d) ? "" : d.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }));
const fmtD = (d) => (isNaN(d) ? "" : d.toLocaleDateString([], { month: "short", day: "numeric" }));
function describe(p) {
  const n = (p.name && (p.name.find((x) => x.use === "official") || p.name[0])) || {};
  return [(n.given || []).join(" "), n.family].filter(Boolean).join(" ") + ` · ${p.gender || ""} · DOB ${p.birthDate || "?"}`;
}
function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

