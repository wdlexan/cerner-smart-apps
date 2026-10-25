/* Hospitalist Toolkit - one launch, one patient, each tool in its own tab.
   The shell finishes the SMART sign-in once; each tab then loads its tool from tools/<name>/index.html.
   The tools pick up the same sign-in automatically (same browser tab, same site), so they run unchanged.
   A tab is only loaded the first time you open it, and stays loaded when you switch away. */

// To add a tool: put its files in tools/<folder>/ and add a line here.
const TOOLS = [
  { key: "today", label: "Today (what changed)", path: "tools/today/index.html" },
  { key: "labs",  label: "Labs",                 path: "tools/labs/index.html" },
  { key: "notes", label: "Notes",                path: "tools/notes/index.html" },
  { key: "meds",  label: "Meds review (Beers)",  path: "tools/meds/index.html" },
  { key: "risk",  label: "Risk screen",          path: "tools/risk/index.html" },
  { key: "ed",    label: "ED screen",            path: "tools/ed/index.html" },
  { key: "calc",  label: "Calculators",          path: "tools/calc/index.html" },
  { key: "ai",    label: "AI summary",           path: "tools/ai/index.html" },
  { key: "tox",   label: "Oncology toxicity",    path: "tools/tox/index.html", keepHeader: true }, // its header holds the draft/version note
  { key: "forms", label: "Forms",                path: "tools/forms/index.html" }
];

const $ = (id) => document.getElementById(id);

FHIR.oauth2.ready().then(start).catch((e) => {
  $("patient").textContent = "Not connected";
  $("msg").innerHTML = `<b class="err">Not signed in:</b> ${esc(e.message || e)}<br><br>
    Launch the toolkit from the Cerner sandbox (it opens launch.html), rather than opening this page directly.`;
});

async function start(client) {
  try { $("patient").textContent = describe(await client.patient.read()); }
  catch (e) { $("patient").textContent = "Patient " + client.patient.id; }
  $("msg").remove();

  $("tabs").innerHTML = TOOLS.map((t) => `<button data-k="${t.key}">${esc(t.label)}</button>`).join("");
  document.querySelectorAll("#tabs button").forEach((b) => (b.onclick = () => show(b.dataset.k)));

  // Open the tab named in the address (#labs), else the last one used, else Today
  let first = location.hash.slice(1);
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
    f.src = tool.path + "?complete=1";
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

function describe(p) {
  const n = (p.name && (p.name.find((x) => x.use === "official") || p.name[0])) || {};
  const name = [(n.given || []).join(" "), n.family].filter(Boolean).join(" ") || "Unknown";
  const dob = p.birthDate ? new Date(p.birthDate) : null, now = new Date();
  let age = dob ? now.getFullYear() - dob.getFullYear() : null;
  if (dob && now < new Date(now.getFullYear(), dob.getMonth(), dob.getDate())) age--;
  return `${name} · ${p.gender || ""}${age != null && !isNaN(age) ? " · " + age + " y" : ""} · DOB ${p.birthDate || "?"}`;
}
function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
