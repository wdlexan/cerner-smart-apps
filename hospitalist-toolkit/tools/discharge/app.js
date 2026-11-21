/* Discharge tab page. Read-only. UNVERIFIED draft written by Claude: the physician checks and edits every line. */
const R = window.DcRules, DAY = R.DAY;
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const isoD = (t) => (t ? new Date(t - new Date(t).getTimezoneOffset() * 6e4).toISOString().slice(0, 10) : "");
const fromD = (s) => (s ? new Date(s + "T12:00:00").getTime() : null);
const num = (v) => (v == null ? "" : Math.abs(v) >= 100 ? String(Math.round(v)) : String(Math.round(v * 10) / 10));
const OWNERS = ["", "Family physician", "Hospitalist (me)", "Specialist", "Ordering physician", "Referral sent by hospital", "Patient to book", "Other"];
const MOD_FIELDS = {
  hf: [["dry", "Weight at discharge (kg)", "number"], ["fluidL", "Fluid limit (L/day, blank = none)", "number"]],
  infection: [["abxEnd", "Last antibiotic dose (date)", "text"]],
  anticoag: [["inrDate", "Warfarin: next INR on", "text"]],
  dm: [["glucose", "Check sugars", "text", "e.g. before breakfast and supper"]],
  stroke: [["driving", "Driving", "text", "e.g. no driving for 1 month; see your doctor first"]],
  gib: [["hbDays", "Repeat CBC in (days)", "number"]],
  kidney: [["crDays", "Repeat creatinine in (days)", "number"]],
  hip: [["wb", "Weight bearing", "text"], ["staples", "Staples out (when/where)", "text"], ["vteWeeks", "Clot prevention (weeks)", "number"]] };
const V_FIELDS = ["admit", "dc", "dx", "ptReason", "fpName", "fpDays", "course", "changedOther", "ptExtra", "fpTasks", "spec", "ptAppts", "labsWhen"];

let S = null; // { key, f, meds, chg, pend, inc, mods:[{id,name,why,on}], v, out:{fp,pt}, dirty:{fp,pt} }
const storeKey = () => "dc:" + (S && S.key);
const save = () => { try { if (S) sessionStorage.setItem(storeKey(), JSON.stringify({ meds: S.meds, chg: S.chg, pend: S.pend, inc: S.inc, fol: S.fol, mods: S.mods, v: S.v, out: S.out, dirty: S.dirty })); } catch (e) {} };

function build(raw, key, sv) {
  const f = R.parse(Object.assign({ now: Date.now() }, raw));
  const chg = R.changes(f); chg.labs.forEach((x) => (x.on = x.n > 1 && (x.big || ["cr", "hb", "wt", "k", "na"].includes(x.id)))); chg.newProbs.forEach((x) => (x.on = true));
  const pr = f.patient || {}, nm = pr.name && pr.name[0] ? pr.name[0].text || [(pr.name[0].given || []).join(" "), pr.name[0].family].filter(Boolean).join(" ") : "";
  const v = Object.assign({ admit: f.admit, dc: Date.now(), fpDays: 7, sex: pr.gender || "", dx: chg.newProbs.map((x) => x.name).join("; ") || f.encReason || "", ptName: nm }, sv || {});
  S = { key, f, chg, v, meds: R.reconcile(f).map((r) => Object.assign(r, { on: r.status !== "inpatient" })),
    pend: R.pending(f).map((p) => Object.assign(p, { status: [p.status, p.detail].filter(Boolean).join(" - "), detail: "", on: true, owner: /micro|path|culture|biopsy/i.test(p.kind + " " + p.what) ? "Hospitalist (me)" : "Family physician" })),
    inc: R.incidentals(f).map((x) => Object.assign(x, { on: true, owner: "Family physician" })),
    fol: [],
    mods: R.modules(f).map((m) => Object.assign(m, { on: true })), out: { fp: "", pt: "" }, dirty: { fp: false, pt: false } };
  // follow-up in the community: plans in notes and reports (not the radiology recommendations already listed as incidental findings)
  const incTxt = S.inc.map((x) => (x.finding + " " + x.followup).toLowerCase());
  S.fol = R.followups(f.notes.concat(f.reports.filter((r) => r.text).map((r) => ({ name: r.name, t: r.t, text: r.text })))).filter((x) => !incTxt.some((t) => t.includes(x.text.toLowerCase().slice(0, 50)))).map((x) => Object.assign(x, { owner: "" })); // who arranges it: only when you set it (the status found in the note is in the text)
  try { const saved = JSON.parse(sessionStorage.getItem(storeKey()) || "null"); if (saved) { Object.assign(S, saved); S.f = f; if (!S.fol) S.fol = []; } } catch (e) {}
}

/* ---------- sections ---------- */
const STATUSES = [["continue", "Continue"], ["new", "New"], ["changed", "Changed"], ["stopped", "Stopped"], ["held", "Held"], ["inpatient", "Stop (hospital only)"]];
function medsHtml() {
  if (!S.meds.length) return `<p class="muted">No medicines found. Add them below, or check the Meds review tab.</p>`;
  return `<table><tr><th></th><th>Status</th><th style="width:36%">Medicine at discharge</th><th style="width:22%">Before admission</th><th>Reason / note</th></tr>${S.meds.map((r, i) => `<tr>
    <td class="ck"><input type="checkbox" data-k="meds" data-i="${i}" data-f="on"${r.on !== false ? " checked" : ""}></td>
    <td class="st"><select data-k="meds" data-i="${i}" data-f="status" class="st-${r.status}">${STATUSES.map(([k, l]) => `<option value="${k}"${r.status === k ? " selected" : ""}>${l}</option>`).join("")}</select></td>
    <td class="wrap"><input type="text" data-k="meds" data-i="${i}" data-f="text" value="${esc(r.text)}"></td>
    <td class="wrap muted">${esc(r.status === "new" || r.status === "inpatient" ? "" : r.before)}</td>
    <td class="wrap"><input type="text" data-k="meds" data-i="${i}" data-f="reason" value="${esc(r.reason)}" placeholder="${esc((r.status === "new" ? "what it is for" : r.status === "stopped" ? "why stopped" : r.status === "changed" ? "why changed" : ""))}">${r.note ? `<div class="muted" style="font-size:11.5px">${esc(r.note)}</div>` : ""}</td></tr>`).join("")}</table>`;
}
function chgHtml() {
  const L = S.chg.labs, P = S.chg.newProbs;
  let h = L.length ? `<table><tr><th></th><th>Test</th><th class="num">Admission</th><th class="num">Latest</th><th></th></tr>${L.map((x, i) => `<tr><td class="ck"><input type="checkbox" data-k="lab" data-i="${i}"${x.on ? " checked" : ""}${x.n > 1 ? "" : " disabled"}></td><td>${esc(x.name)}</td>
    <td class="num">${num(x.first)} <span class="muted">${esc(R.fmtD(x.firstT))}</span></td><td class="num${x.big ? " hi" : ""}">${num(x.last)} <span class="muted">${esc(R.fmtD(x.lastT))}</span></td><td class="muted">${esc(x.unit)}${x.n > 1 ? "" : " (one value)"}</td></tr>`).join("")}</table>` : `<p class="muted">No labs or weights found for this admission.</p>`;
  h += P.length ? `<div style="margin-top:8px"><b>New diagnoses this admission:</b> ${P.map((x, i) => `<label class="inl" style="margin-right:12px"><input type="checkbox" data-k="prob" data-i="${i}"${x.on ? " checked" : ""}> ${esc(x.name)}</label>`).join("")}</div>` : "";
  return h;
}
const ownerSel = (k, i, v) => `<select data-k="${k}" data-i="${i}" data-f="owner">${OWNERS.map((o) => `<option value="${o}"${o === v ? " selected" : ""}>${o || "—"}</option>`).join("")}${OWNERS.includes(v) ? "" : `<option selected>${esc(v)}</option>`}</select>`;
function pendHtml() {
  if (!S.pend.length) return `<p class="muted">No pending results found. Check PowerChart (micro, pathology, send-outs) before saying "none".</p>`;
  return `<table><tr><th></th><th>Test</th><th>Status / detail</th><th>Who follows up</th></tr>${S.pend.map((p, i) => `<tr><td class="ck"><input type="checkbox" data-k="pend" data-i="${i}" data-f="on"${p.on !== false ? " checked" : ""}></td>
    <td class="wrap"><input type="text" data-k="pend" data-i="${i}" data-f="what" value="${esc(p.what)}"></td>
    <td class="wrap"><input type="text" data-k="pend" data-i="${i}" data-f="status" value="${esc(p.status)}"></td><td class="st">${ownerSel("pend", i, p.owner)}</td></tr>`).join("")}</table>`;
}
function incHtml() {
  if (!S.inc.length) return `<p class="muted">No incidental findings found in the reports and notes read.</p>`;
  return `<table><tr><th></th><th>Finding</th><th>Follow-up plan</th><th>Who</th></tr>${S.inc.map((x, i) => `<tr><td class="ck"><input type="checkbox" data-k="inc" data-i="${i}" data-f="on"${x.on !== false ? " checked" : ""}></td>
    <td class="wrap">${esc(x.finding)}<div class="muted" style="font-size:11.5px">${esc(x.source)}${x.t ? ", " + esc(R.fmtD(x.t)) : ""}</div></td>
    <td class="wrap"><input type="text" data-k="inc" data-i="${i}" data-f="followup" value="${esc(x.followup)}" placeholder="e.g. CT chest in 6 to 12 months"></td><td class="st">${ownerSel("inc", i, x.owner)}</td></tr>`).join("")}</table>`;
}
function folHtml() {
  const types = Object.entries(R.FTYPES);
  const rows = S.fol.length ? `<table><tr><th></th><th>Type</th><th>What (edit as needed)</th><th>When</th><th>Who</th></tr>${S.fol.map((x, i) => `<tr><td class="ck"><input type="checkbox" data-k="fol" data-i="${i}" data-f="on"${x.on !== false ? " checked" : ""}></td>
    <td class="st"><select data-k="fol" data-i="${i}" data-f="type">${types.map(([k, l]) => `<option value="${k}"${x.type === k ? " selected" : ""}>${esc(l.split(" ")[0] === "Referrals" ? "Referral" : l.split(" ")[0] === "Imaging" ? "Imaging / procedure" : l.split(" ")[0] === "Lab" ? "Lab test" : "Other")}</option>`).join("")}</select></td>
    <td class="wrap"><input type="text" data-k="fol" data-i="${i}" data-f="text" value="${esc(x.text)}">${x.source ? `<div class="muted" style="font-size:11.5px">${esc(x.source)}${x.t ? ", " + esc(R.fmtD(x.t)) : ""}</div>` : ""}</td>
    <td style="width:130px"><input type="text" data-k="fol" data-i="${i}" data-f="when" value="${esc(x.when)}" placeholder="e.g. in 1 week"></td><td class="st">${ownerSel("fol", i, x.owner)}</td></tr>`).join("")}</table>`
    : `<p class="muted">No referrals, imaging or lab follow-up found in the notes read. Add them below.</p>`;
  return rows;
}
function modsHtml() {
  const present = new Set(S.mods.map((m) => m.id));
  const extra = R.MODULES.filter((m) => !present.has(m.id));
  return S.mods.map((m, i) => `<div class="mod"><label><input type="checkbox" data-k="mod" data-i="${i}"${m.on ? " checked" : ""}${m.id === "general" ? " disabled" : ""}> <b>${esc(m.name)}</b></label> <span class="why">${esc(m.why ? "(" + m.why + ")" : m.id === "general" ? "(always included)" : "(added by you)")}</span>
      ${m.on && MOD_FIELDS[m.id] ? `<div class="fields">${MOD_FIELDS[m.id].map(([k, l, t, ph]) => `<label class="inl">${esc(l)} <input type="${t}" data-v="${k}" value="${esc(S.v[k] == null ? "" : S.v[k])}" placeholder="${esc(ph || "")}" style="width:${t === "number" ? 80 : 220}px"${t === "number" ? ' step="any"' : ""}></label>`).join("")}</div>` : ""}</div>`).join("")
    + (extra.length ? `<div class="row"><select id="addmod"><option value="">Add another condition plan…</option>${extra.map((m) => `<option value="${m.id}">${esc(m.name)}</option>`).join("")}</select></div>` : "");
}

/* ---------- outputs ---------- */
function state() { return { f: S.f, fol: S.fol, meds: S.meds, chg: { labs: S.chg.labs.filter((x) => x.on), newProbs: S.chg.newProbs.filter((x) => x.on) }, pend: S.pend, inc: S.inc, mods: S.mods.filter((m) => m.on).map((m) => m.id), v: S.v }; }
function outputs(force) {
  const st = state();
  ["fp", "pt"].forEach((k) => { if (force === k || force === true || !S.dirty[k]) { S.out[k] = k === "fp" ? R.fpNote(st) : R.patientText(st); S.dirty[k] = false; } $("out-" + k).value = S.out[k]; $("dirty-" + k).textContent = S.dirty[k] ? "You edited this: changes above no longer update it. Rebuild to start again from above (your edits here will be lost)." : ""; });
}

function render() {
  if (!S) { ["meds", "chg", "pend", "inc", "fol", "mods"].forEach((id) => ($(id).innerHTML = "")); ["out-fp", "out-pt"].forEach((id) => ($(id).value = "")); return; }
  V_FIELDS.forEach((k) => { const el = $("v-" + k); if (!el) return; el.value = k === "admit" || k === "dc" ? isoD(S.v[k]) : S.v[k] == null ? "" : S.v[k]; });
  $("meds").innerHTML = medsHtml(); $("chg").innerHTML = chgHtml(); $("pend").innerHTML = pendHtml(); $("inc").innerHTML = incHtml(); $("fol").innerHTML = folHtml(); $("mods").innerHTML = modsHtml();
  const cnt = (a, st) => a.filter((r) => r.on !== false && (!st || st.includes(r.status))).length;
  $("medsum").textContent = `${cnt(S.meds, ["new"])} new, ${cnt(S.meds, ["changed"])} changed, ${cnt(S.meds, ["stopped", "held"])} stopped/held`;
  $("chgsum").textContent = S.chg.labs.filter((x) => x.big).length + " notable lab/weight changes";
  $("folsum").textContent = cnt(S.fol) + " item" + (cnt(S.fol) === 1 ? "" : "s");
  $("pendsum").textContent = cnt(S.pend) + " pending"; $("incsum").textContent = cnt(S.inc) + " finding" + (cnt(S.inc) === 1 ? "" : "s");
  $("modsum").textContent = S.mods.filter((m) => m.on).map((m) => m.name.split(" (")[0]).join(", ");
  $("ptsum").textContent = S.v.admit ? "Admitted " + R.fmtD(S.v.admit) + (S.f.admitGuessed ? " (guessed from first lab: check)" : "") : "";
  wireRows(); outputs(); save();
}
function wireRows() {
  document.querySelectorAll("[data-k]").forEach((el) => {
    const k = el.dataset.k, i = +el.dataset.i, fld = el.dataset.f;
    const arr = k === "meds" ? S.meds : k === "pend" ? S.pend : k === "inc" ? S.inc : k === "fol" ? S.fol : k === "lab" ? S.chg.labs : k === "prob" ? S.chg.newProbs : k === "mod" ? S.mods : null; if (!arr) return;
    const ev = el.type === "text" ? "input" : "change";
    el.addEventListener(ev, () => {
      if (el.type === "checkbox") arr[i][fld || "on"] = el.checked; else arr[i][fld] = el.value;
      if (k === "mod" || (k === "meds" && fld === "status") || (k === "fol" && fld === "type")) return render(); // fields appear / status colours
      outputs(); save();
    });
  });
  document.querySelectorAll("[data-v]").forEach((el) => el.addEventListener("input", () => { const k = el.dataset.v; S.v[k] = el.type === "number" ? (el.value === "" ? null : +el.value) : el.value; outputs(); save(); }));
  const am = $("addmod"); if (am) am.onchange = () => { const m = R.MODULES.find((x) => x.id === am.value); if (m) { S.mods.push({ id: m.id, name: m.name, why: "", on: true }); render(); } };
}
V_FIELDS.forEach((k) => { const el = $("v-" + k); if (!el) return; el.addEventListener("input", () => { if (!S) return; S.v[k] = k === "admit" || k === "dc" ? fromD(el.value) : el.type === "number" ? (el.value === "" ? null : +el.value) : el.value; outputs(); save(); }); });
$("addmed").onclick = () => { if (!S) return; S.meds.push({ key: "", status: "new", text: "", before: "", reason: "", on: true }); render(); };
$("addpend").onclick = () => { if (!S) return; S.pend.push({ what: "", status: "", detail: "", owner: "Family physician", on: true }); render(); };
$("addfol").onclick = () => { if (!S) return; S.fol.push({ type: "referral", text: "", when: "", owner: "", source: "added by you", on: true }); render(); };
$("addinc").onclick = () => { if (!S) return; S.inc.push({ finding: "", source: "added by you", followup: "", owner: "Family physician", on: true }); render(); };
["fp", "pt"].forEach((k) => {
  $("out-" + k).addEventListener("input", () => { if (!S) return; S.out[k] = $("out-" + k).value; S.dirty[k] = true; $("dirty-" + k).textContent = "You edited this: changes above no longer update it. Rebuild to start again from above (your edits here will be lost)."; save(); });
  $("rb-" + k).onclick = () => { if (!S) return; if (S.dirty[k] && !confirm("Rebuild from the sections above? Your edits in this box will be lost.")) return; outputs(k); save(); };
});
async function copy(btn, ta) { try { await navigator.clipboard.writeText(ta.value); } catch (e) { ta.select(); document.execCommand("copy"); } const t = btn.textContent; btn.textContent = "Copied"; setTimeout(() => (btn.textContent = t), 1500); }
$("copy-fp").onclick = (e) => copy(e.target, $("out-fp")); $("copy-pt").onclick = (e) => copy(e.target, $("out-pt"));
$("print-pt").onclick = () => {
  const body = esc($("out-pt").value).split("\n").map((l) => (/^[A-Z0-9][A-Z0-9 ,'()\-:/.]+:?$/.test(l.trim()) && l.trim().length > 3 ? `<h2>${l}</h2>` : /^\s+- /.test(l) ? `<li>${l.replace(/^\s+- /, "")}</li>` : l.trim() ? `<p>${l}</p>` : "")).join("\n").replace(/(<li>[\s\S]*?<\/li>)(?!\s*<li>)/g, "$1</ul>").replace(/(?<!<\/li>\s*)<li>/g, "<ul><li>");
  const w = window.open("", "_blank"); if (!w) return alert("Allow pop-ups to print.");
  w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Your discharge instructions</title><style>body{font:16pt/1.45 Arial,Helvetica,sans-serif;margin:18mm;color:#000} h2{font-size:17pt;margin:16pt 0 4pt;border-bottom:1px solid #999} li{margin:3pt 0} ul{margin:4pt 0 4pt 18pt;padding:0} p{margin:4pt 0}</style></head><body>${body}<script>window.onload=()=>window.print()<\/script></body></html>`); w.document.close();
};

/* ---------- loading ---------- */
const SAMPLES = window.DC_SAMPLES || [];
SAMPLES.forEach((p, i) => { const o = document.createElement("option"); o.value = i; o.textContent = p.label; $("testsel").appendChild(o); });
function load(raw, key, note, errors, sv) {
  if (!raw) { S = null; $("pstatus").textContent = note; $("clear").hidden = true; render(); return; }
  build(raw, key, sv); $("pstatus").textContent = note; $("clear").hidden = false;
  $("errs").innerHTML = errors && errors.length ? "Could not read: " + errors.map(esc).join("; ") + (errors.some((e) => /\b40[13]\b|Unauthorized|Forbidden/i.test(e)) ? ". Check the scopes in the Code Console (MedicationStatement, DiagnosticReport, ServiceRequest, DocumentReference, Encounter)." : "") : "";
  render();
}
let last = null;
$("testsel").onchange = () => { const p = SAMPLES[$("testsel").value]; if (!p) return $("clear").onclick(); last = () => load(p.build(Date.now()), "sample-" + $("testsel").value, "Made-up patient: " + p.label, [], p.v); last(); };
$("clear").onclick = () => { $("testsel").value = ""; load(null, null, "Open from Cerner to read the chart, or pick a made-up patient:"); };
$("reset").onclick = () => { if (!S) return; if (!confirm("Throw away your edits on this page and start again from the chart?")) return; sessionStorage.removeItem(storeKey()); if (last) last(); };
async function fromChart() {
  if (typeof FHIR === "undefined" || !(location.search.includes("code=") || location.search.includes("complete=") || sessionStorage.getItem("SMART_KEY"))) return;
  $("pstatus").textContent = "Reading the chart…";
  try {
    const client = await FHIR.oauth2.ready();
    last = async () => { const { raw, errors } = await window.DcChart.gather(client, (m) => ($("pstatus").textContent = m)); load(raw, "pt-" + client.patient.id, "Chart read (read-only). Nothing is sent anywhere. Check every line.", errors); };
    await last();
  } catch (e) { $("pstatus").textContent = "Could not read the chart: " + (e && e.message ? e.message : e) + ". The made-up patients still work."; }
}
render(); fromChart();
