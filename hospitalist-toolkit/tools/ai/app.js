/* SMART on FHIR – AI summary tab, Phase 1 (Cerner sandbox). Decision support only.
   Phase 1: builds a de-identified data summary from FHIR and shows a FIXED SAMPLE output.
   To connect a real model later, set AI_ENDPOINT to an approved server function (never put an API key in this file). */
const AI_ENDPOINT = "http://localhost:7071/summary"; // empty = sample output only
const $ = (id) => document.getElementById(id);
const state = { client: null, patient: null, text: "", lastOutput: "", errors: [] };

FHIR.oauth2.ready().then(init).catch((e) => {
  $("out").innerHTML = `<div class="card err">Authorization error: ${esc(e.message)}. Launch from launch.html.</div>`;
});

async function init(client) {
  state.client = client;
  try { state.patient = await client.patient.read(); } catch (e) { state.patient = {}; }
  const age = ageOf(state.patient.birthDate);
  $("patient").textContent = `${state.patient.gender || "?"}${age !== null ? ", " + age + " y" : ""} (identifiers hidden)`;
  $("go").onclick = generate;
  $("copy").onclick = () => copyText(state.lastOutput).then(() => setStatus("Copied."), () => setStatus("Copy failed.", true));
  $("copilotCopy").onclick = copyForCopilot;
  $("copilotOpen").onclick = () => window.open(COPILOT_URL, "_blank", "noopener");
  try {
    state.text = await buildSummary();
    $("sent").textContent = state.text;
    $("go").disabled = false;
    $("copilotCopy").disabled = false;
    setStatus("Ready.");
  } catch (e) { setStatus("Failed to read chart: " + (e.message || e), true); }
}

// ---------- Build the de-identified text ----------
async function get(url, name, pages) {
  const t0 = Date.now();
  const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error("timed out after 60 s")), 60000));
  try {
    const r = (await Promise.race([state.client.request(url, { pageLimit: pages || 1, flat: true }), timeout])).filter((x) => x.resourceType && x.resourceType !== "OperationOutcome");
    setStatus(`Loaded ${name} (${r.length}, ${((Date.now() - t0) / 1000).toFixed(1)} s)…`);
    return r;
  } catch (e) {
    state.errors.push(`${name}: ${e.message || e}`);
    setStatus(`${name} failed: ${e.message || e}`, true);
    return [];
  }
}
const pid = () => state.client.patient.id;
const label = (cc) => (cc && (cc.text || (cc.coding || []).map((c) => c.display).find(Boolean))) || "";
const dt = (r) => r.effectiveDateTime || (r.effectivePeriod && r.effectivePeriod.start) || r.issued || r.recordedDate || r.authoredOn || "";
const day = (d) => (d ? String(d).slice(0, 10) : "");

function obsValue(o) {
  if (o.component && o.component.length) {
    const parts = o.component.filter((c) => c.valueQuantity).map((c) => `${/systol/i.test(label(c.code)) ? "SBP " : /diastol/i.test(label(c.code)) ? "DBP " : ""}${c.valueQuantity.value}`);
    if (parts.length) return parts.join(" / ") + ((o.component.find((c) => c.valueQuantity) || {}).valueQuantity.unit ? " " + o.component.find((c) => c.valueQuantity).valueQuantity.unit : "");
  }
  if (o.valueQuantity) return `${o.valueQuantity.value}${o.valueQuantity.unit ? " " + o.valueQuantity.unit : ""}`;
  if (o.valueString) return o.valueString;
  if (o.valueCodeableConcept) return label(o.valueCodeableConcept);
  return "";
}
function latestByName(obs, keep) {
  const m = new Map();
  obs.sort((a, b) => new Date(dt(b)) - new Date(dt(a)));
  for (const o of obs) {
    const n = label(o.code) || "Observation", v = obsValue(o);
    if (!v) continue;
    const list = m.get(n) || [];
    if (list.length < keep) list.push(`${v} (${day(dt(o))})`);
    m.set(n, list);
  }
  return [...m.entries()].map(([n, l]) => `- ${n}: ${l.join("; ")}`);
}


// Cerner's Condition search can be slow or return 504 when it is too broad, so try narrower queries first.
async function getConditions() {
  const tries = [
    `Condition?patient=${pid()}&category=problem-list-item&clinical-status=active&_count=50`,
    `Condition?patient=${pid()}&category=problem-list-item&_count=50`,
    `Condition?patient=${pid()}&category=encounter-diagnosis&_count=50`
  ];
  const keep = state.errors.length;
  for (let i = 0; i < tries.length; i++) {
    const before = state.errors.length;
    const r = await get(tries[i], "problems (try " + (i + 1) + ")");
    if (state.errors.length === before) { state.errors.length = keep; return r; } // success: drop earlier failures
  }
  return [];
}

async function buildSummary() {
  const [conds, meds, alls, vit, labs] = await Promise.all([
    getConditions(),
    get(`MedicationRequest?patient=${pid()}&status=active&_count=50`, "medications", 3),
    get(`AllergyIntolerance?patient=${pid()}&_count=50`, "allergies", 2),
    get(`Observation?patient=${pid()}&category=vital-signs&date=ge${new Date(Date.now() - 60 * 864e5).toISOString().slice(0, 10)}&_count=50`, "vitals (last 60 days)"),
    get(`Observation?patient=${pid()}&category=laboratory&_count=50`, "labs")
  ]);
  const age = ageOf(state.patient.birthDate);
  const condTotal = conds.length;
  const problems = [...new Set(conds.filter((c) => !["resolved", "inactive"].includes(((c.clinicalStatus || {}).coding || [{}])[0].code)).map((c) => label(c.code)).filter(Boolean))];
  const medName = (m) => {
    let n = label(m.medicationCodeableConcept) || (m.medicationReference || {}).display || "medication";
    n = n.replace(/^template non-formulary \(medication\)\s*/i, "");
    const w = n.match(/^\((.*)\)$/); if (w) n = w[1];
    const dup = n.match(/^(.+?) \(\1 (.*)\)$/i); if (dup) n = `${dup[1]} ${dup[2]}`;
    return `${n.trim()}${m.intent ? " [" + m.intent + "]" : ""}`;
  };
  const cap = (arr, n, what) => (arr.length > n ? arr.slice(0, n).concat([`(+${arr.length - n} more ${what} not shown)`]) : arr);
  const medLines = cap([...new Set(meds.map(medName))].sort((a, b) => (b.includes("[order]") - a.includes("[order]"))), 25, "medications");
  const allergy = cap([...new Set(alls.filter((a) => !/no known/i.test(JSON.stringify(a.code || {}))).map((a) => label(a.code)).filter(Boolean))], 15, "allergies");
  const out = [
    `Patient: ${state.patient.gender || "unknown sex"}, ${age !== null ? age + " years" : "age unknown"}`,
    "", "Active problems:", ...(problems.length ? cap(problems, 25, "problems").map((p) => (p.startsWith("(+") ? p : "- " + p)) : [`- none found (${condTotal} condition record(s) returned, none active)`]),
    "", "Active medications ([order] = inpatient, [plan] = home):", ...(medLines.length ? medLines.map((m) => "- " + m) : ["- none found"]),
    "", "Allergies (excluding 'no known'):", ...(allergy.length ? allergy.map((a) => "- " + a) : ["- none recorded"]),
    "", "Vital signs (latest 3 per type, from the most recent 50 records returned):", ...(latestByName(vit, 3).length ? latestByName(vit, 3) : ["- none found"]),
    "", "Lab results (latest 2 per test, from the most recent 50 records returned):", ...(latestByName(labs, 2).length ? latestByName(labs, 2) : ["- none found"])
  ];
  if (state.errors.length) out.push("", "Not loaded (errors): " + state.errors.join(" | "));
  return out.join("\n");
}

// ---------- Generate (sample in Phase 1) ----------
const SAMPLE = {
  snapshot: "EXAMPLE ONLY: 78-year-old with heart failure and CKD admitted with pneumonia. Creatinine rising over 48 hours. BP lower than on admission. On enoxaparin and an ACE inhibitor.",
  gaps: [
    { t: "Possible: ACE inhibitor continued with rising creatinine and lower BP.", s: "Creatinine trend, BP trend, active medication list" },
    { t: "Possible: enoxaparin dose may need renal review.", s: "GFR value, enoxaparin order" },
    { t: "Possible: no documented code status or MOST in the data provided.", s: "Not provided" }
  ],
  questions: [
    "Is the creatinine rise explained by the diuretic or infection?",
    "Should the ACE inhibitor be held until BP and creatinine stabilize?",
    "Has a goals-of-care conversation been documented?"
  ]
};

async function generate() {
  $("go").disabled = true; setStatus("Generating…");
  let R = SAMPLE, isSample = true;
  if (AI_ENDPOINT) {
    try {
      // Error lines can hold chart URLs with patient IDs, so they are cut off before sending.
      const res = await fetch(AI_ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: state.text.split("\n\nNot loaded")[0] }) });
      if (!res.ok) throw new Error("HTTP " + res.status);
      R = await res.json(); isSample = false;
    } catch (e) { setStatus("AI service failed: " + e.message, true); $("go").disabled = false; return; }
  }
  render(R, isSample);
  $("go").disabled = false; $("copy").disabled = false; setStatus(isSample ? "Showing fixed sample." : "Done.");
}

function render(R, isSample) {
  const sample = isSample ? `<div class="sample"><b>SAMPLE OUTPUT.</b> This text is not generated from this patient. It only shows the layout.</div>` : "";
  $("out").innerHTML = `<section class="card">${sample}
    <h2>Snapshot</h2><p style="margin:0;font-size:14px">${esc(R.snapshot)}</p>
    <h2 style="margin-top:14px">Possible gaps <span class="note">(each with the data behind it)</span></h2>
    <ul>${(R.gaps || []).map((g) => `<li>${esc(g.t)}<span class="src">Based on: ${esc(g.s)}</span></li>`).join("")}</ul>
    <h2 style="margin-top:14px">Questions to consider</h2>
    <ul>${(R.questions || []).map((q) => `<li>${esc(q)}</li>`).join("")}</ul>
    <p class="note" style="margin-top:14px">Draft for physician review. Check against the chart. Not a clinical decision.</p></section>`;
  state.lastOutput = [isSample ? "SAMPLE OUTPUT (not from this patient)" : "AI draft (physician review required)", "", "Snapshot: " + R.snapshot, "", "Possible gaps:",
  ...(R.gaps || []).map((g) => `- ${g.t} [Based on: ${g.s}]`), "", "Questions to consider:", ...(R.questions || []).map((q) => "- " + q)].join("\n");
}

// ---------- Copy for Copilot (manual paste into Microsoft 365 Copilot Chat) ----------
const COPILOT_URL = "https://m365.cloud.microsoft/chat";
const COPILOT_PROMPT = [
  "You are helping a hospitalist physician review a de-identified inpatient chart summary.",
  "Use ONLY the data below. Do not invent values, diagnoses or history. If something is not in the data, say \"not in data provided\".",
  "Do not search my email, files or the web for this task.",
  "",
  "Reply in plain text with exactly these three sections:",
  "1. Snapshot: 2-3 sentences summarizing the patient and the main active issues.",
  "2. Possible gaps: up to 6 bullets. Start each with \"Possible:\" and end each with [Based on: the specific data used].",
  "   Look for medication-problem mismatches, renal or hepatic dosing concerns, abnormal or worsening vitals or labs without an obvious plan, missing VTE prophylaxis or code status, and Beers-list medications in older adults.",
  "3. Questions to consider: up to 4 short questions for the care team.",
  "",
  "End with: \"Draft for physician review. Check against the chart. Not a clinical decision.\"",
  "",
  "----- DE-IDENTIFIED DATA -----"
].join("\n");

function copyForCopilot() {
  // Same cut as the AI service: error lines can hold chart URLs with patient IDs.
  const data = state.text.split("\n\nNot loaded")[0];
  const msg = (t, err) => { $("copilotStatus").textContent = t; $("copilotStatus").style.color = err ? "#b00020" : ""; };
  copyText(COPILOT_PROMPT + "\n" + data + "\n----- END OF DATA -----").then(
    () => msg("Copied. Open Copilot Chat and paste (Ctrl+V)."),
    () => msg("Copy failed. Open 'Show data that would be sent to the AI', select the text and copy it by hand.", true)
  );
}

// Clipboard API first; falls back to a hidden textarea when the browser blocks it (e.g. inside a frame).
function copyText(t) {
  if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(t).catch(() => legacyCopy(t));
  return legacyCopy(t);
}
function legacyCopy(t) {
  return new Promise((ok, fail) => {
    const ta = document.createElement("textarea");
    ta.value = t; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select();
    let done = false;
    try { done = document.execCommand("copy"); } catch (e) {}
    ta.remove();
    done ? ok() : fail(new Error("copy blocked"));
  });
}

// ---------- Helpers ----------
function setStatus(m, err) { $("status").textContent = m; $("status").style.color = err ? "#b00020" : ""; }
function ageOf(dob) {
  if (!dob) return null;
  const d = new Date(dob), t = new Date();
  let a = t.getFullYear() - d.getFullYear();
  if (t < new Date(t.getFullYear(), d.getMonth(), d.getDate())) a--;
  return isNaN(a) ? null : a;
}
function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
