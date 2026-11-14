/* Hospitalist Toolkit - one launch, one patient, each tool in its own tab.
   The shell finishes the SMART sign-in once; each tab then loads its tool from tools/<name>/index.html.
   The tools pick up the same sign-in automatically (same browser tab, same site), so they run unchanged.
   A tab is only loaded the first time you open it, and stays loaded when you switch away. */

// To add a tool: put its files in tools/<folder>/ and add a line here.
const TOOL_V = "20261113f"; // bump this whenever a tool changes, so browsers do not show a stale cached tab
const TOOLS = [
  { key: "today", label: "Today (what changed)", path: "tools/today/index.html" },
  { key: "labs",  label: "Labs",                 path: "tools/labs/index.html" },
  { key: "crit",  label: "Critical labs → MRP",  path: "tools/critical/index.html" },
  { key: "notes", label: "Notes",                path: "tools/notes/index.html" },
  { key: "meds",  label: "Meds review (Beers)",  path: "tools/meds/index.html" },
  { key: "g6pd",  label: "G6PD check",           path: "tools/g6pd/index.html" },
  { key: "risk",  label: "Risk screen",          path: "tools/risk/index.html" },
  { key: "opioid", label: "Opioid safety",       path: "tools/opioid/index.html" },
  { key: "abx",   label: "Antibiotics",          path: "tools/abx/index.html" },
  { key: "cw",    label: "Choosing Wisely",      path: "tools/cw/index.html", keepHeader: true }, // its header holds the Look back control
  { key: "dx",    label: "Diagnosis check",      path: "tools/dx/index.html", keepHeader: true }, // its header holds the Look back control
  { key: "ed",    label: "ED screen",            path: "tools/ed/index.html" },
  { key: "hah",   label: "Hospital at Home",     path: "tools/hah/index.html" },
  { key: "calc",  label: "Calculators",          path: "tools/calc/index.html" },
  { key: "ai",    label: "AI summary",           path: "tools/ai/index.html" },
  { key: "tox",   label: "Oncology toxicity",    path: "tools/tox/index.html", keepHeader: true }, // its header holds the draft/version note
  { key: "watch", label: "Watch-ahead",          path: "tools/watch/index.html", keepHeader: true }, // its header holds the draft/version note
  { key: "bsab",  label: "CRS/ICANS (bispecific)", path: "tools/bispecific/index.html" },
  { key: "ibd",   label: "IBD flowsheet (Crohn/UC)", path: "tools/ibd/index.html" },
  { key: "liver", label: "Liver (cirrhosis)", path: "tools/liver/index.html" },
  { key: "hypona", label: "Hyponatremia", path: "tools/hypona/index.html" },
  { key: "hip",   label: "Hip fracture",         path: "tools/hip/index.html" },
  { key: "consult", label: "Consult summary",    path: "tools/consult/index.html" },
  { key: "mobility", label: "Mobility & discharge", path: "tools/mobility/index.html" },
  { key: "pd",    label: "Parkinson disease",    path: "tools/pd/index.html" },
  { key: "ktx",   label: "Kidney transplant",    path: "tools/transplant/index.html" },
  { key: "forms", label: "Forms",                path: "tools/forms/index.html" }
];

const $ = (id) => document.getElementById(id);

FHIR.oauth2.ready().then(start).catch((e) => {
  $("patient").textContent = "Not connected";
  $("msg").innerHTML = `<b class="err">Not signed in:</b> ${esc(e.message || e)}<br><br>
    Launch the toolkit from the Cerner sandbox (it opens launch.html), rather than opening this page directly.`;
});

async function start(client) {
  // Opened from a link (launch-standalone.html) instead of PowerChart: there is no patient yet,
  // so find the one named in the link and hand it to every tab.
  let target = null;
  try { target = JSON.parse(sessionStorage.getItem("toolkit-target") || "null"); } catch (e) {}
  if (!client.patient.id) {
    try {
      if (!target) throw new Error("No patient was chosen. Open the toolkit from PowerChart, or from a link ending in ?patient=…, ?mrn=… or ?fin=….");
      $("msg").textContent = "Finding the patient…";
      const found = await resolveTarget(client, target);
      setPatient(client, found.patient, found.encounter);
    } catch (e) {
      $("patient").textContent = "No patient";
      $("msg").innerHTML = `<b class="err">Could not open the patient:</b> ${esc(e.message || e)}`;
      return;
    }
  }
  try { sessionStorage.removeItem("toolkit-target"); } catch (e) {}

  window.TK = { patientId: client.patient.id, isPdfPatient: /^pdfpt-/.test(client.patient.id), switchPatient, backToCerner }; // used by the PDF import button
  try { $("patient").textContent = describe(await client.patient.read()); }
  catch (e) { $("patient").textContent = "Patient " + client.patient.id; }
  if (window.TK.isPdfPatient) pdfPatientChip();
  let testMode = false; try { testMode = sessionStorage.getItem("toolkit-test") === "1"; } catch (e) {}
  if (testMode) $("patient").innerHTML = `<span style="background:#fff3cd;color:#7a4b00;border-radius:10px;padding:1px 8px;font-weight:700;margin-right:6px">TEST MODE · open sandbox, no login</span>${esc($("patient").textContent)}`;
  $("msg").remove();

  $("tabs").innerHTML = TOOLS.map((t) => `<button data-k="${t.key}">${esc(t.label)}</button>`).join("");
  document.querySelectorAll("#tabs button").forEach((b) => (b.onclick = () => show(b.dataset.k)));

  // Open the tab named in the address (#labs), else the last one used, else Today
  let first = (target && target.tab) || location.hash.slice(1);
  if (!TOOLS.some((t) => t.key === first)) { try { first = localStorage.getItem("toolkit-tab"); } catch (e) {} }
  if (!TOOLS.some((t) => t.key === first)) first = TOOLS[0].key;
  show(first);
}

function show(key) {
  const tool = TOOLS.find((t) => t.key === key);
  let f = document.querySelector(`#frames iframe[data-k="${key}"]`);
  if (!f) { // first visit: load the tool
    f = document.createElement("iframe");
    f.dataset.k = key;
    f.title = tool.label;
    f.onload = () => { if (!tool.keepHeader) tidy(f); };
    // "complete=1" tells the fhirclient library inside the tool that sign-in is already finished.
    // Without it, a tool running inside a frame waits for a pop-up/frame sign-in that never comes.
    f.src = tool.path + "?complete=1&v=" + TOOL_V; // v forces a fresh copy of each tool page after an update
    $("frames").appendChild(f);
  }
  document.querySelectorAll("#frames iframe").forEach((x) => x.classList.toggle("on", x === f));
  document.querySelectorAll("#tabs button").forEach((b) => b.classList.toggle("on", b.dataset.k === key));
  history.replaceState(null, "", "#" + key);
  try { localStorage.setItem("toolkit-tab", key); } catch (e) {}
}

// Each tool has its own blue title bar with the patient's name; the toolkit header already shows it.
function tidy(frame) {
  try {
    const d = frame.contentDocument;
    const s = d.createElement("style");
    s.textContent = "body > header { display:none !important; } main { margin-top:12px !important; }";
    d.head.appendChild(s);
  } catch (e) { /* not same-site - leave it */ }
}

// ---- PDF-only patients (Import PDF > "Open as a separate patient") ----
// Switch every tab to another patient: rewrite the patient in the saved sign-in record and reload. Leaving a Cerner patient for a
// PDF-only one remembers the Cerner patient so the header can offer a way back. pdf-overlay.js answers all requests for pdfpt- IDs locally.
function switchPatient(id, encounter) {
  const key = JSON.parse(sessionStorage.getItem("SMART_KEY")), saved = JSON.parse(sessionStorage.getItem(key));
  saved.tokenResponse = saved.tokenResponse || {};
  const cur = saved.tokenResponse.patient;
  if (cur && !/^pdfpt-/.test(cur) && /^pdfpt-/.test(id)) sessionStorage.setItem("pdfpt-return", JSON.stringify({ patient: cur, encounter: saved.tokenResponse.encounter || null, label: $("patient").textContent }));
  saved.tokenResponse.patient = id;
  if (encounter) saved.tokenResponse.encounter = encounter; else delete saved.tokenResponse.encounter;
  sessionStorage.setItem(key, JSON.stringify(saved));
  location.hash = ""; location.reload();
}
function backToCerner() {
  let r = null; try { r = JSON.parse(sessionStorage.getItem("pdfpt-return") || "null"); } catch (e) {}
  if (r && r.patient) switchPatient(r.patient, r.encounter);
}
function pdfPatientChip() {
  let r = null; try { r = JSON.parse(sessionStorage.getItem("pdfpt-return") || "null"); } catch (e) {}
  const el = $("patient");
  el.innerHTML = `<span style="background:#fde8e8;color:#7a1b1b;border-radius:10px;padding:1px 8px;font-weight:700;margin-right:6px">PDF-only patient</span>${esc(el.textContent)}` +
    (r && r.patient ? ` <button id="tocerner" style="margin-left:8px;background:#fff;color:#0b6bcb;border:0;border-radius:6px;padding:3px 9px;font-size:12px;cursor:pointer" title="${esc(r.label || "")}">Back to Cerner patient</button>` : "");
  const b = document.getElementById("tocerner"); if (b) b.onclick = backToCerner;
}

// ---- standalone launch: find the patient named in the link ----
async function resolveTarget(client, t) {
  if (t.patient) return { patient: t.patient };

  if (t.mrn) {
    const hits = (await client.request("Patient?identifier=" + encodeURIComponent(t.mrn), { flat: true }))
      .filter((r) => r.resourceType === "Patient");
    if (hits.length === 1) return { patient: hits[0].id };
    if (!hits.length) throw new Error(`No patient found with MRN ${t.mrn}.`);
    throw new Error(`${hits.length} patients matched MRN ${t.mrn} - open the patient from PowerChart instead.`);
  }

  if (t.fin) {
    const encs = (await client.request("Encounter?identifier=" + encodeURIComponent(t.fin), { flat: true }))
      .filter((r) => r.resourceType === "Encounter");
    if (encs.length !== 1) throw new Error(encs.length ? `${encs.length} visits matched FIN ${t.fin}.` : `No visit found with FIN ${t.fin}.`);
    const ref = (encs[0].subject && encs[0].subject.reference) || "";
    const id = ref.split("/").pop();
    if (!id) throw new Error(`The visit with FIN ${t.fin} has no patient attached.`);
    return { patient: id, encounter: encs[0].id };
  }
  throw new Error("The link doesn't say which patient to open.");
}

// Store the patient in the sign-in record the fhirclient library keeps for this browser tab.
// Every tab reads client.patient.id from that record, so they all open on this patient unchanged.
function setPatient(client, patientId, encounterId) {
  client.state.tokenResponse = client.state.tokenResponse || {};
  client.state.tokenResponse.patient = patientId;
  if (encounterId) client.state.tokenResponse.encounter = encounterId;
  const key = JSON.parse(sessionStorage.getItem("SMART_KEY"));
  const saved = JSON.parse(sessionStorage.getItem(key));
  saved.tokenResponse = saved.tokenResponse || {};
  saved.tokenResponse.patient = patientId;
  if (encounterId) saved.tokenResponse.encounter = encounterId;
  sessionStorage.setItem(key, JSON.stringify(saved));
}

function describe(p) {
  const n = (p.name && (p.name.find((x) => x.use === "official") || p.name[0])) || {};
  const name = [(n.given || []).join(" "), n.family].filter(Boolean).join(" ") || "Unknown";
  const dob = p.birthDate ? new Date(p.birthDate) : null, now = new Date();
  let age = dob ? now.getFullYear() - dob.getFullYear() : null;
  if (dob && now < new Date(now.getFullYear(), dob.getMonth(), dob.getDate())) age--;
  if (!(n.given || n.family) && n.text) return `${n.text} · ${p.gender || ""}${p.birthDate ? " · DOB " + p.birthDate : ""}`;
  return `${name} · ${p.gender || ""}${age != null && !isNaN(age) ? " · " + age + " y" : ""} · DOB ${p.birthDate || "?"}`;
}
function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
