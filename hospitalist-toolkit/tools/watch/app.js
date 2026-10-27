/* Watch-ahead page logic. Reads window.WAChart, WARules, WA_DX, WA_SAMPLES. Nothing is sent anywhere; everything runs in this page. */
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const SEV = { high: "WATCH CLOSELY", med: "WATCH", low: "KEEP IN MIND" };
const state = { raw: null, f: null, cards: [], dxOver: {}, useOld: false, note: "", errors: [] };

const VITAL_KEYS = ["sbp", "hr", "rr", "temp", "spo2"], LAB_KEYS = ["k", "na", "creat", "egfr", "hgb", "wbc", "plt", "glucose", "inr", "lactate"];

function recompute() {
  if (!state.raw) { state.f = null; state.cards = []; return; }
  state.f = WAChart.parseChart(state.raw, { useOld: state.useOld, now: state.now });
  state.cards = WARules.run(state.f);
}
function dxList() {
  const f = state.f; if (!f) return [];
  const ruleIds = state.cards.map((c) => c.id);
  return window.WA_DX.map((d) => {
    const fromProblem = f.conditions.some((c) => d.match.test(c));
    const fromChart = d.id === "aki" && ruleIds.includes("aki");
    const auto = fromProblem || fromChart;
    const on = state.dxOver[d.id] != null ? state.dxOver[d.id] : auto;
    return { d, on, how: fromProblem ? "problem list" : fromChart ? "chart values" : "" };
  });
}
const list = (a) => (a && a.length ? `<ul>${a.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : "");
const ifthen = (a) => (a && a.length ? `<ul>${a.map(([i, t]) => `<li><span class="if">If ${esc(i)}:</span> ${esc(t)}</li>`).join("")}</ul>` : "");
const srcLine = (s) => `<div class="src">${s.status === "unverified" ? '<span class="unv">UNVERIFIED</span>' : ""}Source: ${esc(s.text)}</div>`;

function drawPatient() {
  const f = state.f, box = $("pt");
  if (!f) { box.innerHTML = ""; return; }
  const D = WAChart.DEFS, show = (k) => {
    if (f.values[k] == null) return `<div class="kv"><b>${esc(D[k].name)}</b>not read</div>`;
    const stale = f.stale[k] && !f.useOld;
    return `<div class="kv${stale ? " stale" : ""}"><b>${esc(D[k].name)}</b>${esc(f.source[k])}${stale ? "<br>older: not used" : ""}</div>`;
  };
  box.innerHTML = `<div style="margin-top:10px"><b>${f.age != null ? f.age + " years" : "Age not read"}${f.sex ? ", " + esc(f.sex) : ""}</b> &middot; ${f.conditions.length} active problem${f.conditions.length === 1 ? "" : "s"} &middot; ${f.medNames.length} active medication${f.medNames.length === 1 ? "" : "s"} &middot; ${f.allergies.length} allerg${f.allergies.length === 1 ? "y" : "ies"}</div>
    <div class="muted" style="margin-top:4px"><b>Problems:</b> ${esc(f.conditions.join("; ") || "none read")}</div>
    <div class="muted"><b>Medications:</b> ${esc(f.medNames.slice(0, 20).join("; ") || "none read")}${f.medNames.length > 20 ? " (+" + (f.medNames.length - 20) + " more)" : ""}</div>
    <div class="muted"><b>Allergies:</b> ${esc(f.allergies.map((a) => a.text + (a.reaction ? " (" + a.reaction + ")" : "")).join("; ") || "none read")}</div>
    <div class="grid">${VITAL_KEYS.concat(LAB_KEYS).map(show).join("")}</div>
    ${f.notes.length ? `<div class="muted" style="margin-top:8px">${f.notes.map((n) => "&bull; " + esc(n)).join("<br>")}</div>` : ""}
    <div class="muted" style="margin-top:6px">Medicines are matched by name only: a drug that is not listed here may still be taken. Vital signs and labs are the latest values found, not trends (except creatinine and hemoglobin, which use earlier values when present). Notes, ECGs, imaging and the bedside exam are not read.</div>`;
}
function drawWatch() {
  const box = $("watch");
  if (!state.f) { box.innerHTML = '<div class="empty">Pick a made-up patient or open from Cerner.</div>'; return; }
  if (!state.cards.length) { box.innerHTML = '<div class="okbox">No chart-wide watch-outs were triggered by the data that was read. That does not mean none exist: check what was not read (above) and use your own judgment.</div>'; return; }
  box.innerHTML = state.cards.map((c, i) => `<details class="card" style="margin-bottom:8px"${c.sev === "high" ? " open" : ""}><summary><div><div class="title">${esc(c.title)}</div></div><span class="badge ${esc(c.sev)}">${SEV[c.sev]}</span></summary>
    <div class="body"><div class="lab">From the chart</div>${list(c.from)}<div class="lab">What to watch for</div>${list(c.watch)}<div class="lab">If it happens</div>${ifthen(c.ifthen)}${srcLine(c.source)}</div></details>`).join("");
}
function drawDx() {
  const dl = dxList(), chips = $("chips"), box = $("dx");
  chips.innerHTML = "";
  if (!state.f) { box.innerHTML = ""; if (typeof drawAI === "function") drawAI(); return; }
  dl.forEach(({ d, on, how }) => {
    const b = document.createElement("button"); b.className = "chip"; b.setAttribute("aria-pressed", on); b.textContent = d.title + (how ? ` (${how})` : "");
    b.onclick = () => { state.dxOver[d.id] = !on; drawDx(); }; chips.appendChild(b);
  });
  const sel = dl.filter((x) => x.on);
  box.innerHTML = sel.length ? sel.map(({ d }) => `<details class="card" style="margin-bottom:8px" open><summary><div class="title">${esc(d.title)}</div><span class="badge low">COURSE AND PLAN</span></summary><div class="body">
    <div class="lab">What may happen</div>${list(d.mayHappen)}
    <div class="lab">What to watch</div>${list(d.watch)}
    <div class="lab">Contingency plan</div>${ifthen(d.ifthen)}
    <div class="lab">Rough course (qualitative)</div><div>${esc(d.course)}</div>
    <div class="lab">Treatment length and time points</div><ul>${d.length.map(([k, v]) => `<li><b>${esc(k)}:</b> ${esc(v)}</li>`).join("")}</ul>
    ${srcLine(d.source)}</div></details>`).join("") : '<div class="empty">No diagnosis selected. Tick one above to see what may happen, the contingency plan, the expected course and treatment length.</div>';
  if (typeof drawAI === "function") drawAI();
}
function draw() { drawPatient(); drawWatch(); drawDx(); }

/* ---------- AI draft panel (see ai.js, ai-config.js) ---------- */
function aiList(a) { return a && a.length ? `<ul>${a.map((x) => `<li>${esc(x.t)}${x.s ? `<div class="muted">Based on: ${esc(x.s)}</div>` : ""}</li>`).join("")}</ul>` : '<div class="muted">none</div>'; }
function renderAI(R, isSample) {
  const sample = isSample ? '<div class="banner" style="margin-top:8px"><b>SAMPLE OUTPUT.</b> Not generated from this patient. It only shows the layout. Set the AI address in ai-config.js to get a real draft.</div>' : '<div class="banner" style="margin-top:8px"><b>AI-written draft. Not checked.</b> Verify every line against the chart. Not a clinical decision.</div>';
  $("aiout").innerHTML = `${sample}<div style="margin-top:8px">
    <div class="lab">Snapshot</div><div>${esc(R.snapshot)}</div>
    <div class="lab">What to watch</div>${aiList(R.watch)}
    <div class="lab">What may happen</div>${aiList(R.mayHappen)}
    <div class="lab">Contingency plan</div>${R.contingency && R.contingency.length ? `<ul>${R.contingency.map((c) => `<li><span class="if">If ${esc(c.if)}:</span> ${esc(c.then)}</li>`).join("")}</ul>` : '<div class="muted">none</div>'}
    <div class="lab">Rough course (qualitative)</div><div>${esc(R.course)}</div>
    <div class="lab">Treatment length (typical ranges)</div>${R.length && R.length.length ? `<ul>${R.length.map((l) => `<li><b>${esc(l.what)}:</b> ${esc(l.range)}${l.basis ? `<div class="muted">Basis: ${esc(l.basis)}</div>` : ""}</li>`).join("")}</ul>` : '<div class="muted">none</div>'}
    <div class="lab">What would change this / what is missing</div>${R.uncertainty && R.uncertainty.length ? `<ul>${R.uncertainty.map((u) => `<li>${esc(u)}</li>`).join("")}</ul>` : '<div class="muted">none</div>'}</div>`;
  state.aiOut = [isSample ? "SAMPLE OUTPUT (not from this patient)" : "AI draft (physician review required; not checked)", "", "Snapshot: " + R.snapshot, "", "What to watch:", ...(R.watch || []).map((x) => `- ${x.t} [${x.s}]`), "", "What may happen:", ...(R.mayHappen || []).map((x) => `- ${x.t} [${x.s}]`),
    "", "Contingency plan:", ...(R.contingency || []).map((c) => `- if ${c.if}: ${c.then}`), "", "Rough course: " + R.course, "", "Treatment length:", ...(R.length || []).map((l) => `- ${l.what}: ${l.range} (${l.basis})`), "", "Missing or would change this:", ...(R.uncertainty || []).map((u) => "- " + u)].join("\n");
  $("aicopy").disabled = false;
}
function aiText() { return window.WAAI.buildText(state, dxList().filter((x) => x.on).map((x) => x.d.title)); }
function drawAI() {
  const a = window.WAAI.allowed(state), ep = window.WA_AI_ENDPOINT || "";
  $("aimode").textContent = ep ? " Connected to: " + ep : " No AI address is set, so the button shows a fixed sample.";
  $("aigo").disabled = !a.ok; $("aistatus").textContent = a.ok ? "" : a.why;
  $("aitext").textContent = state.f ? aiText() : "";
}
$("aigo").onclick = async () => {
  const ep = window.WA_AI_ENDPOINT || "";
  if (!ep) { renderAI(window.WAAI.SAMPLE, true); $("aistatus").textContent = "Showing a fixed sample."; return; }
  $("aigo").disabled = true; $("aistatus").textContent = "Asking the AI…";
  try { renderAI(await window.WAAI.call(ep, aiText()), false); $("aistatus").textContent = "Done. Draft only."; }
  catch (e) { $("aistatus").textContent = "AI service failed: " + (e && e.message ? e.message : e) + ". The rules above still apply."; }
  $("aigo").disabled = !window.WAAI.allowed(state).ok;
};
$("aicopy").onclick = () => navigator.clipboard.writeText(state.aiOut || "").then(() => ($("aistatus").textContent = "Copied."), () => ($("aistatus").textContent = "Could not copy."));

function planText() {
  const f = state.f; if (!f) return "";
  const L = ["WATCH-AHEAD (reference aid, draft; not a clinical decision)", `${f.age != null ? f.age + " y" : "age ?"} ${f.sex || ""}`.trim(), ""];
  L.push("WATCH-OUTS FROM THE CHART");
  if (!state.cards.length) L.push("- none triggered by the data read");
  state.cards.forEach((c) => { L.push(`- [${SEV[c.sev]}] ${c.title}`); c.from.forEach((x) => L.push("    chart: " + x)); c.ifthen.forEach(([i, t]) => L.push(`    if ${i}: ${t}`)); });
  dxList().filter((x) => x.on).forEach(({ d }) => {
    L.push("", d.title.toUpperCase());
    L.push("May happen: " + d.mayHappen.join("; "));
    d.ifthen.forEach(([i, t]) => L.push(`- if ${i}: ${t}`));
    L.push("Course: " + d.course); d.length.forEach(([k, v]) => L.push(`${k}: ${v}`)); L.push(`Source: ${d.source.text} [${d.source.status.toUpperCase()}]`);
  });
  L.push("", "Thresholds and statements are unverified drafts. Check against your sources.");
  return L.join("\n");
}
$("copy").onclick = () => { const t = planText(); if (!t) { $("copied").textContent = "Nothing to copy yet."; return; } navigator.clipboard.writeText(t).then(() => { $("copied").textContent = "Copied."; setTimeout(() => ($("copied").textContent = ""), 1500); }, () => { $("copied").textContent = "Could not copy."; }); };

function setRaw(raw, note, errors, source, serverUrl) {
  state.raw = raw; state.dxOver = {}; state.errors = errors || []; state.source = raw ? source || "" : ""; state.serverUrl = serverUrl || ""; $("aiout").innerHTML = ""; state.aiOut = "";
  $("pstatus").textContent = note; $("clear").hidden = !raw;
  $("errs").innerHTML = state.errors.length ? "Could not read: " + state.errors.map(esc).join("; ") + ". Check that the scopes are enabled in the Code Console." : "";
  recompute(); draw();
}
$("useold").onchange = (e) => { state.useOld = e.target.checked; recompute(); draw(); };
$("clear").onclick = () => { $("testsel").value = ""; setRaw(null, "Open from Cerner to read the chart, or pick a made-up patient:"); };

const sel = $("testsel"), SAMPLES = window.WA_SAMPLES || [];
if (!SAMPLES.length) sel.hidden = true;
SAMPLES.forEach((p, i) => { const o = document.createElement("option"); o.value = i; o.textContent = p.label; sel.appendChild(o); });
sel.onchange = () => { const p = SAMPLES[sel.value]; if (p) { state.now = Date.now(); setRaw(p.raw, "Made-up patient: " + p.label, [], "sample"); } else $("clear").onclick(); };

async function fromChart() {
  if (typeof FHIR === "undefined" || !(location.search.includes("code=") || sessionStorage.getItem("SMART_KEY"))) return;
  $("pstatus").textContent = "Reading the chart…";
  try {
    const client = await FHIR.oauth2.ready();
    const { raw, errors } = await WAChart.gather(client, (m) => ($("pstatus").textContent = m));
    state.now = Date.now();
    setRaw(raw, "Chart read. The rules run in this page and send nothing anywhere. (Only the optional AI draft can send data, and only when you press its button.)", errors, "chart", (client.state && client.state.serverUrl) || "");
  } catch (e) { $("pstatus").textContent = "Could not read the chart: " + (e && e.message ? e.message : e) + ". The made-up patients still work."; }
}
$("meta").textContent = `Draft v${window.WA_DX_META.version} · updated ${window.WA_DX_META.updated} · ${window.WA_DX_META.note}`;
draw();
fromChart();
