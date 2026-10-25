/* Oncology toxicity matrix: reads window.TOX from toxicity-data.js. No patient data, no network. */
const $ = (id) => document.getElementById(id);
const ORDER = { emergent: 0, high: 1, moderate: 2 };
const LABEL = { emergent: "EMERGENT", high: "HIGH RISK", moderate: "MODERATE RISK" };
const CATS = ["All", "irAE", "Targeted TKI", "ADC / Bispecific"];
const state = { cat: "All", emergentOnly: false, q: "", meds: null, hits: {}, onlyHits: false };

const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const rows = () => window.TOX.slice().sort((a, b) => (state.hits[b.id] ? 1 : 0) - (state.hits[a.id] ? 1 : 0) || ORDER[a.urgency] - ORDER[b.urgency]);
const visible = () => rows().filter((r) =>
  (state.cat === "All" || r.category === state.cat) &&
  (!state.emergentOnly || r.urgency === "emergent") && (!state.onlyHits || state.hits[r.id]) &&
  (!state.q || [r.title, r.agentClass, r.drugs.join(" "), r.features, r.differential, r.matchNames.join(" ")].join(" ").toLowerCase().includes(state.q)));

function controls() {
  const box = $("controls");
  box.querySelectorAll(".chip").forEach((n) => n.remove());
  const mk = (text, pressed, fn) => { const b = document.createElement("button"); b.className = "chip"; b.textContent = text; b.setAttribute("aria-pressed", pressed); b.onclick = fn; box.appendChild(b); };
  CATS.forEach((c) => {
    const n = c === "All" ? window.TOX.length : window.TOX.filter((r) => r.category === c).length;
    mk(`${c === "All" ? "All triage" : c} (${n})`, state.cat === c, () => { state.cat = c; draw(); });
  });
  if (state.meds) mk("Matches this patient", state.onlyHits, () => { state.onlyHits = !state.onlyHits; draw(); });
  mk("Emergent only", state.emergentOnly, () => { state.emergentOnly = !state.emergentOnly; draw(); });
}

function cardText(r) {
  return [r.title, `${r.agentClass} (${r.drugs.join(", ")})`, `Urgency: ${LABEL[r.urgency]}`, "", "Features: " + r.features, "Differential: " + r.differential, "",
    ...r.steps.map(([k, v]) => `${k}: ${v}`), "Call oncology: " + r.callOncology, "", `Source: ${r.source.text} (${r.source.date}) [${r.source.status.toUpperCase()}]`,
    "Reference aid only. Verify against your pathway and the treating oncologist."].join("\n");
}

function draw() {
  controls();
  const list = visible();
  $("list").innerHTML = list.length ? list.map((r) => `
    <details class="card${state.hits[r.id] ? " hit" : ""}" id="c-${esc(r.id)}"${state.hits[r.id] ? " open" : ""}><summary>
      <div class="top"><div><div class="title">${esc(r.title)}</div><div class="cls">${esc(r.agentClass)}</div></div><span class="badge ${esc(r.urgency)}">${LABEL[r.urgency]}</span></div>
      <div class="drugs">${esc(r.drugs.join(", "))}</div>${state.hits[r.id] ? `<div><span class="hittag">On medication list: ${esc(state.hits[r.id].join(", "))}</span></div>` : ""}<div class="more">Diagnostic &amp; management protocol</div></summary>
      <div class="body">
        <div class="lab">What you may see</div><div>${esc(r.features)}</div>
        <div class="lab">Differential diagnosis</div><div>${esc(r.differential)}</div>
        <div class="lab">Initial hospitalist management</div>
        <ul class="steps">${r.steps.map(([k, v]) => `<li><b>${esc(k)}:</b> ${esc(v)}</li>`).join("")}</ul>
        <div class="lab">When to call oncology</div><div>${esc(r.callOncology)}</div>
        <div class="src">${r.source.status === "unverified" ? '<span class="unv">UNVERIFIED</span>' : ""}Source: ${esc(r.source.text)} (${esc(r.source.date)})</div>
        <button class="copy" data-id="${esc(r.id)}">Copy this card</button>
      </div></details>`).join("") : '<div class="empty">Nothing matches. Clear the search or filters.</div>';
  $("list").querySelectorAll(".copy").forEach((b) => (b.onclick = () => {
    const r = window.TOX.find((x) => x.id === b.dataset.id);
    navigator.clipboard.writeText(cardText(r)).then(() => { b.textContent = "Copied"; setTimeout(() => (b.textContent = "Copy this card"), 1500); });
  }));
}

/* ---- Medication matching: drug NAME only. A match means "worth reading this card", not that the patient has the toxicity. ---- */
function match(meds) {
  const hits = {};
  const low = meds.map((m) => String(m).toLowerCase());
  window.TOX.forEach((r) => {
    const found = [];
    r.matchNames.forEach((n) => { if (low.some((m) => m.includes(n)) && !found.includes(n)) found.push(n); });
    if (found.length) hits[r.id] = found;
  });
  return hits;
}
function setMeds(meds, note) {
  state.meds = meds; state.hits = meds ? match(meds) : {}; state.onlyHits = false;
  const n = Object.keys(state.hits).length;
  $("clear").hidden = !meds;
  $("pstatus").textContent = meds ? note : "Open from Cerner to match the chart, or pick a made-up test list:";
  $("pout").innerHTML = !meds ? "" : `<div style="margin-top:8px"><b>${meds.length} medication${meds.length === 1 ? "" : "s"} read.</b> ${n ? `${n === 1 ? "1 toxicity card relates" : n + " toxicity cards relate"} to a drug on this list and are shown first.` : "No drug on this list matches a card."}</div>
    <div class="muted" style="margin-top:4px">Matching is by drug name only; it does not mean this patient has the toxicity. Chemotherapy, immunotherapy and bispecifics given in the cancer clinic or day unit may not appear on the medication list, so no match does not rule out exposure. Ask the patient or call oncology.</div>`;
  draw();
}
const medName = (m) => (m.medicationCodeableConcept && (m.medicationCodeableConcept.text || (m.medicationCodeableConcept.coding || []).map((c) => c.display).filter(Boolean).join(" "))) || (m.medicationReference && m.medicationReference.display) || "";
async function fromChart() {
  if (typeof FHIR === "undefined" || !(location.search.includes("code=") || sessionStorage.getItem("SMART_KEY"))) return;
  $("pstatus").textContent = "Reading medication list from the chart…";
  try {
    const client = await FHIR.oauth2.ready();
    const bundle = await client.patient.request("MedicationRequest?_count=50", { pageLimit: 3, flat: true });
    setMeds(bundle.map(medName).filter(Boolean), "Medication names read from the chart. Nothing is sent anywhere; matching runs in this page.");
  } catch (e) { $("pstatus").textContent = "Could not read the chart: " + (e && e.message ? e.message : e) + ". Test lists below still work."; }
}
const sel = $("testsel");
const TESTS = window.TEST_PATIENTS || [];
if (!TESTS.length) $("testsel").hidden = true;
TESTS.forEach((p, i) => { const o = document.createElement("option"); o.value = i; o.textContent = p.label; sel.appendChild(o); });
sel.onchange = () => { const p = TESTS[sel.value]; if (p) setMeds(p.meds, "Made-up test list: " + p.label); else setMeds(null); };
$("clear").onclick = () => { sel.value = ""; setMeds(null); };

$("meta").textContent = `Draft v${window.TOX_META.version} · updated ${window.TOX_META.updated} · ${window.TOX_META.note}`;
$("q").oninput = (e) => { state.q = e.target.value.trim().toLowerCase(); draw(); };
draw();
fromChart();
