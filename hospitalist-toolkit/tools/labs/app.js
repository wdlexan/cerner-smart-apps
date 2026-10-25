/* SMART on FHIR – Lab Results viewer (Cerner R4) */
const $ = (id) => document.getElementById(id);

// Common panels: matched against the lab name text returned by the EHR.
const PANELS = [
  ["All labs", null],
  ["CBC", /\b(wbc|white blood|rbc|red blood|hematocrit|hct|hgb|platelet|plt|mcv|mch|mchc|rdw|mpv|neutrophil|lymphocyte|monocyte|eosinophil|basophil|immature gran)|hemoglobin(?!\s*a1c)/i],
  ["Electrolytes (lytes)", /\b(sodium|potassium|chloride|co2|bicarbonate|carbon dioxide|magnesium|phosph|calcium|anion gap)\b/i],
  ["BMP", /\b(sodium|potassium|chloride|co2|bicarbonate|carbon dioxide|bun|urea nitrogen|creatinine|glucose|calcium|anion gap|egfr|gfr)\b/i],
  ["CMP", /\b(sodium|potassium|chloride|co2|bicarbonate|carbon dioxide|bun|urea nitrogen|creatinine|glucose|calcium|anion gap|egfr|gfr|albumin|total protein|ast|alt|sgot|sgpt|alk(aline)? phos|bilirubin)\b/i],
  ["Renal", /\b(bun|urea nitrogen|creatinine|egfr|gfr|cystatin)\b/i],
  ["Liver / hepatic", /\b(ast|alt|sgot|sgpt|alk(aline)? phos|bilirubin|albumin|total protein|ggt|ammonia)\b/i],
  ["Lipids", /\b(cholesterol|triglyceride|hdl|ldl|vldl)\b/i],
  ["Coagulation", /\b(pt|inr|ptt|aptt|protime|prothrombin|fibrinogen|d-dimer|d dimer)\b/i],
  ["Cardiac markers", /\b(troponin|bnp|nt-?pro ?bnp|ck-?mb|creatine kinase|ck)\b/i],
  ["Thyroid", /\b(tsh|thyroid|t3|t4|thyroxine|triiodothyronine)\b/i],
  ["Diabetes / glucose", /\b(glucose|a1c|hba1c|fructosamine)\b|hemoglobin\s*a1c/i],
  ["Urinalysis", /\b(urine|urinalysis|ua|specific gravity|leukocyte esterase|nitrite|ketone|bacteria)\b/i],
  ["Inflammatory / sepsis", /\b(crp|c-reactive|esr|sed rate|procalcitonin|lactate|lactic)\b/i],
  ["Iron / vitamins", /\b(ferritin|iron|tibc|transferrin|b12|cobalamin|folate|vitamin d|25-oh)\b/i]
];

const state = { client: null, patient: null, results: [], recent: [], off: new Set() };

// ---------- Parse observations ----------
function ccText(cc) { return cc ? (cc.text || (cc.coding || []).map((c) => c.display).find(Boolean) || "") : ""; }

function parse(o) {
  if (["entered-in-error", "cancelled"].includes(o.status)) return null;
  let value = "", unit = "", num = null;
  if (o.valueQuantity && o.valueQuantity.value != null) {
    num = Number(o.valueQuantity.value); value = String(num); unit = o.valueQuantity.unit || o.valueQuantity.code || "";
  } else if (o.valueString) value = o.valueString;
  else if (o.valueCodeableConcept) value = ccText(o.valueCodeableConcept);
  else if (o.valueInteger != null) { num = o.valueInteger; value = String(num); }
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
  const issued = new Date(o.issued || o.effectiveDateTime || when);
  return { name: ccText(o.code) || "Unknown", value, unit, ref, flag, when, issued };
}

const parseAll = (res) => res.filter((r) => r.resourceType === "Observation").map(parse).filter(Boolean);

// ---------- Filters ----------
const panelRx = () => PANELS[$("panel").selectedIndex][1];
const inPanel = (name) => !panelRx() || panelRx().test(name);
const textOk = (name) => !$("q").value.trim() || name.toLowerCase().includes($("q").value.trim().toLowerCase());
const abnOk = (r) => !$("abn").checked || r.flag;
const baseFilter = (list) => list.filter((r) => inPanel(r.name) && textOk(r.name) && abnOk(r));
const shown = (list) => baseFilter(list).filter((r) => !state.off.has(r.name));

// ---------- Start-up ----------
$("panel").innerHTML = PANELS.map((p) => `<option>${p[0]}</option>`).join("");
FHIR.oauth2.ready().then(init).catch((e) => {
  document.querySelector("main").innerHTML = `<div class="card err">Authorization error: ${esc(e.message)}. Launch from launch.html.</div>`;
});

async function init(client) {
  state.client = client;
  try { state.patient = await client.patient.read(); $("patient").textContent = describe(state.patient); }
  catch (e) { $("patient").textContent = "Patient " + client.patient.id; }

  $("range").onchange = () => document.querySelectorAll(".custom").forEach((el) => el.classList.toggle("hidden", $("range").value !== "custom"));
  $("go").onclick = search;
  $("refresh").onclick = loadRecent;
  ["panel", "abn"].forEach((id) => ($(id).onchange = renderAll));
  $("q").oninput = renderAll;
  $("selAll").onclick = () => { state.off.clear(); renderAll(); };
  $("selNone").onclick = () => { baseFilter(state.results).forEach((r) => state.off.add(r.name)); renderAll(); };
  document.querySelectorAll(".tab").forEach((b) => (b.onclick = () => {
    document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("on", t === b));
    $("tab-results").classList.toggle("hidden", b.dataset.tab !== "results");
    $("tab-recent").classList.toggle("hidden", b.dataset.tab !== "recent");
  }));
  $("go").disabled = false;
  loadRecent();
  search();
}

// ---------- Fetching ----------
const iso = (d) => d.toISOString().slice(0, 10);

async function fetchLabs(fromDate, toDate) {
  let url = `Observation?patient=${state.client.patient.id}&category=laboratory&date=ge${fromDate}`;
  if (toDate) url += `&date=le${toDate}`;
  return parseAll(await state.client.request(url + "&_count=100", { pageLimit: 10, flat: true }));
}

async function search() {
  let from, to = null;
  if ($("range").value === "custom") {
    from = $("from").value; to = $("to").value || null;
    if (!from) return setStatus("Pick a From date.", true);
  } else {
    from = iso(new Date(Date.now() - Number($("range").value) * 864e5));
  }
  $("go").disabled = true; setStatus("Searching…");
  try {
    state.results = await fetchLabs(from, to);
    state.off.clear();
    setStatus(`${state.results.length} result(s) from ${from}${to ? " to " + to : " to now"}.`);
    renderAll();
  } catch (e) { setStatus("Search failed: " + (e.message || e), true); }
  $("go").disabled = false;
}

async function loadRecent() {
  $("recentNote").textContent = "Loading…";
  try {
    const all = await fetchLabs(iso(new Date(Date.now() - 2 * 864e5)));
    const cutoff = Date.now() - 864e5;
    state.recent = all.filter((r) => r.issued >= cutoff || r.when >= cutoff);
    $("recentNote").textContent = `Checked ${new Date().toLocaleTimeString()}`;
  } catch (e) { $("recentNote").textContent = "Could not load: " + (e.message || e); }
  renderAll();
}

// ---------- Rendering ----------
function renderAll() {
  // lab checklist (names after panel/text/abnormal filter)
  const base = baseFilter(state.results), names = {};
  base.forEach((r) => (names[r.name] = (names[r.name] || 0) + 1));
  const list = Object.keys(names).sort();
  $("labChecks").innerHTML = list.map((n) =>
    `<label style="flex-direction:row;gap:6px;color:inherit;font-size:13px"><input type="checkbox" data-n="${esc(n)}" ${state.off.has(n) ? "" : "checked"}> ${esc(n)} <span class="note">(${names[n]})</span></label>`).join("");
  document.querySelectorAll("#labChecks input").forEach((c) => (c.onchange = () => {
    c.checked ? state.off.delete(c.dataset.n) : state.off.add(c.dataset.n); renderResults();
  }));
  $("labPickSum").textContent = `Choose which labs (${list.filter((n) => !state.off.has(n)).length} of ${list.length} selected)`;
  renderResults();

  const rec = shown(state.recent).sort((a, b) => b.issued - a.issued);
  $("recRows").innerHTML = rec.map((r) =>
    `<tr><td>${esc(r.name)}</td><td>${val(r)}</td><td>${esc(r.ref)}</td><td>${fmt(r.issued)}</td></tr>`).join("") ||
    `<tr><td colspan="4" class="note">No new labs in the past 24 hours.</td></tr>`;
  $("newCount").textContent = rec.length;
  $("newCount").classList.toggle("hidden", !rec.length);
}

function renderResults() {
  const groups = {};
  shown(state.results).forEach((r) => (groups[r.name] = groups[r.name] || []).push(r));
  const names = Object.keys(groups).sort();
  $("resCount").textContent = `${names.length} test(s), ${names.reduce((n, k) => n + groups[k].length, 0)} result(s) shown. Click a test to see its history.`;
  $("resRows").innerHTML = names.map((n, i) => {
    const rs = groups[n].sort((a, b) => b.when - a.when), l = rs[0];
    return `<tr class="grp" onclick="document.querySelectorAll('.h${i}').forEach(e=>e.classList.toggle('hidden'))">
      <td>${esc(n)}</td><td>${val(l)}</td><td>${esc(l.ref)}</td><td>${fmt(l.when)}</td><td>${rs.length}</td></tr>` +
      rs.map((r) => `<tr class="hist hidden h${i}"><td></td><td>${val(r)}</td><td>${esc(r.ref)}</td><td>${fmt(r.when)}</td><td></td></tr>`).join("");
  }).join("") || noMatch();
}

function noMatch() {
  const total = state.results.length;
  if (!total) return `<tr><td colspan="5" class="note">No lab results were returned for this date range. Try a longer range.</td></tr>`;
  const found = [...new Set(state.results.map((r) => r.name))].sort();
  return `<tr><td colspan="5" class="note">${total} result(s) were found, but none match the current panel / name / abnormal / lab selections.
    <button class="sec" onclick="clearFilters()">Clear filters</button><br>Labs found: ${found.slice(0, 25).map(esc).join(", ")}${found.length > 25 ? "…" : ""}</td></tr>`;
}

function clearFilters() {
  $("panel").selectedIndex = 0; $("q").value = ""; $("abn").checked = false; state.off.clear();
  renderAll();
}

const ARROW = { H: "▲ H", L: "▼ L", C: "‼ CRIT", A: "A" };
function val(r) {
  return `<span class="${r.flag === "A" ? "H" : r.flag}">${esc(r.value)} ${esc(r.unit)} ${r.flag ? ARROW[r.flag] : ""}</span>`;
}
const fmt = (d) => (isNaN(d) ? "" : d.toLocaleString([], { dateStyle: "medium", timeStyle: "short" }));
function setStatus(m, err) { $("status").textContent = m; $("status").style.color = err ? "#b00020" : ""; }
function describe(p) {
  const n = (p.name && (p.name.find((x) => x.use === "official") || p.name[0])) || {};
  return [(n.given || []).join(" "), n.family].filter(Boolean).join(" ") + ` · ${p.gender || ""} · DOB ${p.birthDate || "?"}`;
}
function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
