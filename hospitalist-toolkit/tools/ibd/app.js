/* IBD flowsheet page. Everything is read-only from the chart; typed entries live in this page only. UNVERIFIED draft. */
const R = window.IBDRules, IB = window.IBD, DAY = R.DAY;
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const state = { f: null, source: "", disease: "unknown", setting: "outpatient", flaring: false, entries: [], manualMeds: [], manualEndo: [], range: 365, open: {}, hide: {}, now: null };
const nowT = () => state.now || Date.now();
const fmtD = (t) => new Date(t).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
const short = (t) => new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric" }) + "<br><span class='muted'>" + new Date(t).getFullYear() + "</span>";
const toLocal = (t) => { const d = new Date(t), p = (n) => String(n).padStart(2, "0"); return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) + "T" + p(d.getHours()) + ":" + p(d.getMinutes()); };
const EMPTY = () => window.IBDChart.parseChart({});
const S = () => ({ f: state.f || EMPTY(), disease: state.disease, setting: state.setting, flaring: state.flaring, entries: state.entries, manualMeds: state.manualMeds, manualEndo: state.manualEndo });
const LETTER = { started: "S", given: "●", changed: "Δ", held: "H", stopped: "X" };
const BAND = { remission: "t0", mild: "t1", moderate: "t2", severe: "t3" };
const fmtV = (v) => (typeof v === "number" ? (Math.abs(v) >= 100 ? String(Math.round(v)) : String(Math.round(v * 100) / 100)) : v);

function tile(cls, k, big, s) { return `<div class="tile ${cls}"><div class="k">${esc(k)}</div><div class="big">${big}</div><div class="s">${s || ""}</div></div>`; }
function latestEntry() { return R.latest(state.entries); }

/* ---------- tiles ---------- */
function drawTiles() {
  const s = S(), f = s.f, now = nowT(), out = [];
  const le = latestEntry(), sc = le ? R.scoreEntry(le, state.disease) : null;
  if (sc && (sc.pmayo || sc.hbi)) {
    const parts = []; let band = "";
    if (sc.pmayo) { parts.push("Partial Mayo " + sc.pmayo.score + "/9"); band = sc.pmayo.band; }
    if (sc.hbi) { parts.push("HBI " + sc.hbi.score); band = band || sc.hbi.band; }
    out.push(tile(BAND[band] || "t1", "Clinical activity", esc(band), esc(parts.join("; ")) + " on " + fmtD(le.t)));
  } else out.push(tile("t1", "Clinical activity", "Not scored", "Enter stools, bleeding and global scores below"));
  const cr = R.latest(f.labs.crp), ca = R.latest(f.labs.calpro);
  const infl = [];
  if (cr) infl.push(`CRP ${fmtV(cr.v)} mg/L (${fmtD(cr.t)})`);
  if (ca) infl.push(`Calprotectin ${fmtV(ca.v)} ug/g (${fmtD(ca.t)})`);
  const hot = (cr && R.labAbn("crp", cr)) || (ca && R.labAbn("calpro", ca));
  out.push(tile(infl.length ? (hot ? "t2" : "t0") : "t1", "Objective inflammation", infl.length ? (hot ? "Raised" : "Not raised") : "None found", infl.length ? esc(infl.join("; ")) : "No CRP or calprotectin found"));
  const cur = R.current(R.meds(s, now));
  const adv = cur.filter((m) => R.ADVANCED.includes(m.cls.id)).map((m) => m.drug.label.split(" (")[0]);
  out.push(tile("t1", "Current therapy", cur.length + " drug" + (cur.length === 1 ? "" : "s"), cur.length ? esc(cur.map((m) => m.drug.label.split(" (")[0].split(" / ")[0]).join(", ")) : "None found on record"));
  const en = R.endoList(s)[0];
  out.push(tile(en ? "t1" : "t2", "Last endoscopy", en ? fmtD(en.t) : "None found", en ? esc(R.endoBand(en) || en.title) : "Add one below if done elsewhere"));
  $("tiles").innerHTML = out.join("");
}

/* ---------- alerts ---------- */
function drawAlerts() {
  const a = R.alerts(S(), nowT());
  $("alertsum").textContent = a.length ? a.filter((x) => x.level === "urgent").length + " urgent, " + a.filter((x) => x.level === "action").length + " to act on, " + a.filter((x) => x.level === "info").length + " for information" : "none";
  $("alerts").innerHTML = a.length ? a.map((x) => `<div class="alert ${x.level}"><b>${x.level === "urgent" ? "Urgent" : x.level === "action" ? "Action" : "Note"}</b>${esc(x.text)}<div class="src">${esc(x.src)}</div></div>`).join("") : '<div class="empty">Nothing flagged from what the chart holds.</div>';
}

/* ---------- flowsheet ---------- */
function drawFlow() {
  const s = S(), f = s.f, now = nowT(), cutoff = now - state.range * DAY, days = new Map();
  const cell = (t) => { const k = R.dayOf(t); if (!days.has(k)) days.set(k, { t, c: {} }); return days.get(k); };
  const put = (t, row, text, cls) => { if (t < cutoff || t > now + DAY) return; const d = cell(t); if (!d.c[row] || t >= d.c[row].t) d.c[row] = { t, text, cls: cls || "" }; };
  const rows = []; // {g, id, label, unit, cls?}
  const used = new Set();
  // labs
  IB.LABS.forEach((d) => (f.labs[d.id] || []).forEach((e) => {
    const abn = R.labAbn(d.id, e), txt = e.v != null ? fmtV(e.v) : String(e.text).replace(/\s+/g, " ").slice(0, 14);
    put(e.t, "lab:" + d.id, txt, abn === true ? "hi" : ""); }));
  // vitals per day
  const vday = new Map();
  (f.vitals || []).forEach((v) => { const k = R.dayOf(v.t), r = vday.get(k) || { t: v.t }; if (typeof v.temp === "number") r.temp = Math.max(r.temp == null ? -1 : r.temp, v.temp); if (typeof v.hr === "number") r.hr = Math.max(r.hr || 0, v.hr); if (typeof v.sbp === "number") r.sbp = Math.min(r.sbp == null ? 999 : r.sbp, v.sbp); vday.set(k, r); });
  vday.forEach((r) => { if (r.temp != null) put(r.t, "v:temp", fmtV(r.temp), r.temp > 37.8 ? "hi" : ""); if (r.hr) put(r.t, "v:hr", String(r.hr), r.hr > 90 ? "hi" : ""); if (r.sbp != null) put(r.t, "v:sbp", String(r.sbp), r.sbp < 90 ? "hi" : ""); });
  (f.weights || []).forEach((w) => put(w.t, "v:wt", fmtV(w.v)));
  // entered symptom scores
  state.entries.forEach((e) => {
    const sc = R.scoreEntry(e, state.disease);
    if (e.stools !== "" && e.stools != null) put(e.t, "d:stools", String(e.stools), +e.stools >= 6 ? "hi" : "");
    if (e.blood !== "" && e.blood != null) put(e.t, "d:blood", String(e.blood), +e.blood >= 2 ? "hi" : "");
    if (sc.pmayo) put(e.t, "d:pmayo", sc.pmayo.score + " " + sc.pmayo.band.slice(0, 4), sc.pmayo.band === "moderate" || sc.pmayo.band === "severe" ? "hi" : "");
    if (sc.hbi) put(e.t, "d:hbi", sc.hbi.score + " " + sc.hbi.band.slice(0, 4), sc.hbi.band === "moderate" || sc.hbi.band === "severe" ? "hi" : "");
  });
  // meds
  const ms = R.meds(s, now);
  ms.forEach((m) => {
    m.events.forEach((e) => { if (e.t < cutoff || e.t > now + DAY) return; const d = cell(e.t), k = "m:" + m.drug.id, cur = d.c[k] ? d.c[k].text : ""; const L = LETTER[e.type] || "?"; if (!cur.includes(L)) d.c[k] = { t: e.t, text: cur + L, cls: e.type === "stopped" ? "hi" : e.type === "held" ? "hi" : "cur" }; });
  });
  // endoscopy
  R.endoList(s).forEach((e) => put(e.t, "e:endo", (e.title || "Endoscopy").replace(/with.*$/i, "").slice(0, 26) + (R.endoBand(e) ? ": " + R.endoBand(e).replace(/ \(.*/, "") : ""), "endo"));
  let keys = Array.from(days.keys()).sort(); const total = keys.length; keys = keys.slice(-40);
  $("flowsum").textContent = total ? total + " date" + (total === 1 ? "" : "s") + (total > 40 ? " (latest 40 shown)" : "") : "";
  if (!keys.length) { $("flow").innerHTML = '<div class="empty">Nothing in this period. Pick a patient, or widen the range.</div>'; return; }
  const dlist = keys.map((k) => days.get(k));
  const has = (id) => dlist.some((d) => d.c[id]);
  const rowHtml = (id, label, unit) => has(id) ? `<tr><td class="lab">${esc(label)}${unit ? ` <span class="muted">${esc(unit)}</span>` : ""}</td>${dlist.map((d) => { const c = d.c[id]; return `<td class="${c ? c.cls : ""}">${c ? esc(c.text) : ""}</td>`; }).join("")}</tr>` : "";
  const grpRow = (g, name) => `<tr class="grp" data-g="${g}"><td class="lab" colspan="${dlist.length + 1}">${state.hide[g] ? "▸" : "▾"} ${esc(name)}</td></tr>`;
  const head = `<tr><th class="lab">Date</th>${dlist.map((d) => `<th>${short(d.t)}</th>`).join("")}</tr>`;
  let body = "";
  IB.GROUPS.forEach(([g, name]) => {
    let inner = "";
    if (g === "vitals") inner = rowHtml("v:temp", "Temp max", "C") + rowHtml("v:hr", "Heart rate max", "/min") + rowHtml("v:sbp", "Systolic BP min", "mmHg") + rowHtml("v:wt", "Weight", "kg");
    else if (g === "daily") inner = rowHtml("d:stools", "Stools per day") + rowHtml("d:blood", "Rectal bleeding 0-3") + rowHtml("d:pmayo", "Partial Mayo (UC)") + rowHtml("d:hbi", "Harvey-Bradshaw (Crohn)");
    else if (g === "meds") {
      IB.CLASSES.forEach((c) => { const r = c.drugs.map((d) => (has("m:" + d.id) ? `<tr><td class="lab">${esc(d.label.split(" (")[0])}</td>${dlist.map((dd) => { const x = dd.c["m:" + d.id]; return `<td class="${x ? x.cls : ""}">${x ? esc(x.text) : ""}</td>`; }).join("")}</tr>` : "")).join(""); if (r) inner += `<tr class="cls"><td class="lab" colspan="${dlist.length + 1}">${esc(c.label)}</td></tr>` + r; });
    } else if (g === "endo") inner = rowHtml("e:endo", "Endoscopy");
    else inner = IB.LABS.filter((d) => d.g === g).map((d) => rowHtml("lab:" + d.id, d.label, d.unit)).join("");
    if (inner) body += grpRow(g, name) + (state.hide[g] ? "" : inner);
  });
  $("flow").innerHTML = `<table class="fs"><thead>${head}</thead><tbody>${body}</tbody></table>`;
  $("flow").querySelectorAll("tr.grp").forEach((tr) => (tr.onclick = () => { state.hide[tr.dataset.g] = !state.hide[tr.dataset.g]; drawFlow(); }));
}

/* ---------- medications by class ---------- */
function drawMeds() {
  const s = S(), ms = R.meds(s, nowT());
  const nCur = R.current(ms).length;
  $("medsum").textContent = nCur + " current";
  $("meds").innerHTML = IB.CLASSES.map((c) => {
    const mine = ms.filter((m) => m.cls.id === c.id), cur = mine.filter((m) => m.status === "current"), any = mine.filter((m) => m.status !== "none");
    const badge = cur.length ? `<span class="st current">${cur.length} current</span>` : any.length ? `<span class="st past">${any.length} on record, none current</span>` : `<span class="st none">none on record</span>`;
    const open = state.open[c.id] === undefined ? cur.length > 0 : state.open[c.id];
    const rows = mine.map((m) => `<tr><td>${esc(m.drug.label)}</td><td><span class="st ${m.status}">${m.status === "none" ? "not on record" : m.status}</span></td><td>${m.first ? fmtD(m.first.t) : ""}</td><td>${m.last ? fmtD(m.last.t) + " (" + (LETTER[m.last.type] || "") + (m.last.detail ? " " + esc(m.last.detail) : "") + ")" : ""}</td></tr>`).join("");
    const hist = mine.reduce((a, m) => a.concat(m.events.map((e) => ({ e, m }))), []).sort((a, b) => b.e.t - a.e.t).slice(0, 14);
    const hl = hist.length ? `<div class="lab">History (latest 14)</div><ul class="rem">${hist.map(({ e, m }) => `<li>${fmtD(e.t)}: ${esc(m.drug.label.split(" (")[0])} ${esc(e.type)}${e.detail ? " (" + esc(e.detail) + ")" : ""} <span class="muted">${esc(e.src === "entered" ? "entered here" : "chart")}</span>${e.src === "entered" ? ` <button class="x" data-rmm="${state.manualMeds.indexOf(e)}" title="Remove">✕</button>` : ""}</li>`).join("")}</ul>` : "";
    return `<details class="sub" data-cls="${c.id}" ${open ? "open" : ""}><summary>${esc(c.label)} &nbsp;${badge}</summary><div class="in"><table><tr><th>Drug</th><th>Status</th><th>First on record</th><th>Latest</th></tr>${rows}</table>${hl}<div class="lab">Monitoring reminders (UNVERIFIED)</div><ul class="rem">${c.remind.map((r) => `<li>${esc(r)}</li>`).join("")}</ul></div></details>`;
  }).join("");
  $("meds").querySelectorAll("details.sub").forEach((d) => (d.ontoggle = () => (state.open[d.dataset.cls] = d.open)));
  $("meds").querySelectorAll("button[data-rmm]").forEach((b) => (b.onclick = () => { state.manualMeds.splice(+b.dataset.rmm, 1); drawAll(); }));
}
const mc = $("m-class"), md = $("m-drug"), mt = $("m-type");
IB.CLASSES.forEach((c) => { const o = document.createElement("option"); o.value = c.id; o.textContent = c.label; mc.appendChild(o); });
IB.EVENT_TYPES.forEach(([v, l]) => { const o = document.createElement("option"); o.value = v; o.textContent = l; mt.appendChild(o); });
function fillDrugs() { md.innerHTML = ""; IB.CLASSES.find((c) => c.id === mc.value).drugs.forEach((d) => { const o = document.createElement("option"); o.value = d.id; o.textContent = d.label.split(" (")[0]; md.appendChild(o); }); }
mc.onchange = fillDrugs; fillDrugs();
$("m-t").value = toLocal(Date.now());
$("m-add").onclick = () => {
  const t = new Date($("m-t").value).getTime(); if (isNaN(t)) return;
  state.manualMeds.push({ drug: md.value, cls: mc.value, name: md.options[md.selectedIndex].textContent, t, type: mt.value, detail: $("m-detail").value.trim(), src: "entered" });
  state.open[mc.value] = true; $("m-detail").value = ""; drawAll();
};

/* ---------- endoscopy ---------- */
function drawEndo() {
  const en = R.endoList(S());
  $("endosum").textContent = en.length ? en.length + " on record" : "none found";
  $("endo").innerHTML = en.length ? `<table><tr><th>Date</th><th>Type</th><th>Score</th><th>Findings / source</th></tr>${en.map((e) => `<tr><td>${fmtD(e.t)}</td><td>${esc(e.title)}</td><td>${esc(R.endoBand(e) || "")}</td><td>${esc((e.text || e.note || "").slice(0, 300))} <span class="muted">${esc(e.src === "entered" ? "entered here" : e.kind + " in chart")}</span>${e.src === "entered" ? ` <button class="x" data-rme="${state.manualEndo.indexOf(e)}" title="Remove">✕</button>` : ""}</td></tr>`).join("")}</table><div class="muted" style="margin-top:6px">Chart documents are matched by title only: open the report in the chart for the full findings. Scores are read from the text if it states them; check against the report.</div>` : '<div class="empty">No endoscopy found in the chart (procedures, reports, document titles). Add one below if it was done elsewhere.</div>';
  $("endo").querySelectorAll("button[data-rme]").forEach((b) => (b.onclick = () => { state.manualEndo.splice(+b.dataset.rme, 1); drawAll(); }));
}
$("e-t").value = toLocal(Date.now());
$("e-add").onclick = () => {
  const t = new Date($("e-t").value).getTime(); if (isNaN(t)) return;
  const o = { t, title: $("e-kind").value, text: $("e-note").value.trim(), src: "entered", kind: "entered" };
  if ($("e-mayo").value !== "") o.mayo = +$("e-mayo").value; if ($("e-ses").value !== "") o.sescd = +$("e-ses").value; if ($("e-rut").value) o.rutgeerts = $("e-rut").value;
  state.manualEndo.push(o); $("e-note").value = ""; drawAll();
};

/* ---------- symptom scores ---------- */
function readSym() { const v = (id) => $(id).value; return { t: new Date(v("s-t")).getTime(), stools: v("s-stools"), normalStools: v("s-norm"), blood: v("s-blood"), pga: v("s-pga"), wellbeing: v("s-wb"), pain: v("s-pain"), mass: v("s-mass"), comps: v("s-comp") }; }
function symPreview() {
  const e = readSym(), sc = R.scoreEntry(e, state.disease), p = [];
  if (sc.pmayo) p.push("Partial Mayo " + sc.pmayo.score + "/9 (" + sc.pmayo.band + ")"); if (sc.hbi) p.push("Harvey-Bradshaw " + sc.hbi.score + " (" + sc.hbi.band + ")");
  $("s-prev").textContent = p.length ? p.join("   ") : "Fill in stools and the score boxes to see the score";
}
["s-stools", "s-norm", "s-blood", "s-pga", "s-wb", "s-pain", "s-mass", "s-comp"].forEach((id) => ($(id).oninput = $(id).onchange = symPreview));
$("s-t").value = toLocal(Date.now());
$("s-add").onclick = () => { const e = readSym(); if (isNaN(e.t) || e.stools === "") return; state.entries.push(e); ["s-stools", "s-blood", "s-pga", "s-wb", "s-pain", "s-mass"].forEach((id) => ($(id).value = "")); symPreview(); drawAll(); };
function drawSym() {
  $("symsum").textContent = state.entries.length ? state.entries.length + " entered" : "";
  const list = state.entries.slice().sort((a, b) => b.t - a.t);
  $("sym").innerHTML = list.length ? `<div class="lab">Entered scores</div><table><tr><th>Date</th><th>Stools/day</th><th>Partial Mayo</th><th>Harvey-Bradshaw</th><th></th></tr>${list.map((e) => { const sc = R.scoreEntry(e, state.disease); return `<tr><td>${fmtD(e.t)}</td><td>${esc(e.stools)}</td><td>${sc.pmayo ? sc.pmayo.score + " " + sc.pmayo.band : ""}</td><td>${sc.hbi ? sc.hbi.score + " " + sc.hbi.band : ""}</td><td><button class="x" data-rms="${state.entries.indexOf(e)}">✕</button></td></tr>`; }).join("")}</table>` : "";
  $("sym").querySelectorAll("button[data-rms]").forEach((b) => (b.onclick = () => { state.entries.splice(+b.dataset.rms, 1); drawAll(); }));
}

/* ---------- screening ---------- */
function drawScreen() {
  const f = S().f;
  $("screen").innerHTML = `<table><tr><th>Test</th><th>Latest in chart</th><th>Date</th></tr>${R.SCREEN.map(([id, name]) => { const e = R.latest(f.labs[id]); const ab = e ? R.labAbn(id, e) : null; return `<tr><td>${esc(name)}</td><td class="${ab === true ? "abn" : ""}">${e ? esc(e.v != null ? fmtV(e.v) : e.text) : "not found"}</td><td>${e ? fmtD(e.t) : ""}</td></tr>`; }).join("")}</table><div class="muted" style="margin-top:6px">Searched by test name over the last 3 years. Not found does not mean not done: it may have been done elsewhere or be under another name. Vaccination history is not read here. Typical pre-biologic work-up also includes review of live-vaccine status and pregnancy plans (check your guideline).</div>`;
}

/* ---------- header and note ---------- */
function drawPt() {
  const f = S().f;
  $("ptsum").textContent = state.f ? (f.age != null ? f.age + " y " + (f.sex || "") : "") : "";
  $("pt").innerHTML = state.f ? `${f.disease ? "Problem list suggests: " + (f.disease === "cd" ? "Crohn disease" : f.disease === "uc" ? "ulcerative colitis" : "IBD (type not clear)") + ". " : "Disease type not found in the problem list: choose it above. "}${f.onsetT ? "Condition date " + fmtD(f.onsetT) + ". " : ""}${f.notes.map(esc).join(" ")}` : "";
  $("disease").value = state.disease; $("setting").value = state.setting; $("flaring").checked = state.flaring;
}
function noteText() {
  const s = S(), f = s.f, now = nowT(), L = [];
  L.push("IBD summary (draft, generated " + fmtD(now) + "). Disease: " + (state.disease === "cd" ? "Crohn disease" : state.disease === "uc" ? "ulcerative colitis" : "not chosen") + ". Setting: " + state.setting + (state.flaring ? ", flaring" : "") + ".");
  const le = latestEntry(), sc = le && R.scoreEntry(le, state.disease); if (sc) L.push("Activity " + fmtD(le.t) + ": " + [sc.pmayo && "partial Mayo " + sc.pmayo.score + " (" + sc.pmayo.band + ")", sc.hbi && "HBI " + sc.hbi.score + " (" + sc.hbi.band + ")"].filter(Boolean).join("; ") + ".");
  const lab = ["crp", "calpro", "hgb", "alb", "ferritin", "creat", "alt"].map((id) => { const e = R.latest(f.labs[id]); const d = IB.LABS.find((x) => x.id === id); return e && e.v != null ? d.label + " " + fmtV(e.v) + " " + d.unit + " (" + fmtD(e.t) + ")" : null; }).filter(Boolean);
  if (lab.length) L.push("Latest labs: " + lab.join("; ") + ".");
  const cur = R.current(R.meds(s, now)); L.push("Current therapy (by name in chart/entered): " + (cur.length ? cur.map((m) => m.drug.label.split(" (")[0]).join(", ") : "none found") + ".");
  const en = R.endoList(s)[0]; L.push("Last endoscopy: " + (en ? fmtD(en.t) + " " + en.title + (R.endoBand(en) ? ", " + R.endoBand(en) : "") : "none found") + ".");
  const a = R.alerts(s, now); if (a.length) L.push("Flags: " + a.map((x) => x.text).join(" | "));
  L.push("Auto-generated from unverified rules; check against the chart and guidelines.");
  return L.join("\n");
}
$("copy").onclick = () => navigator.clipboard.writeText(noteText()).then(() => { $("copied").textContent = "Copied."; setTimeout(() => ($("copied").textContent = ""), 1500); }, () => { $("copied").textContent = "Could not copy."; });
window.__noteText = noteText;

/* ---------- choosing a medication ---------- */
state.pf = {};
function pathContext() {
  const s = S(), f = s.f, now = nowT(), ms = R.meds(s, now), P = window.IBDPath;
  const h = P.history(ms, R.ADVANCED), sel = $("p-sit").value, hsel = $("p-hist").value;
  const le = latestEntry(), sc = le ? R.scoreEntry(le, state.disease) : null, band = sc ? ((sc.pmayo || sc.hbi || {}).band || "") : "";
  const acuteAuto = state.disease === "uc" && !!R.severeUC(s, now);
  const lab = (id) => { const e = R.latest(f.labs[id]); return e && R.labAbn(id, e) === true; };
  const feats = Object.assign({ age: f.age == null ? 0 : f.age, tb: lab("tb"), hbv: lab("hbsag") }, state.pf);
  const hist = hsel === "auto" ? (h.exposed ? "exposed" : "naive") : hsel;
  let key = sel;
  if (sel === "auto") key = P.stage(state.disease, { acute: acuteAuto, band: band || (state.flaring ? "moderate" : ""), exposed: h.exposed, failing: false, perianal: false, postop: false, highrisk: !!state.pf.highrisk });
  return { s, ms, h, hist, feats, key, auto: sel === "auto", acuteAuto, band };
}
function drawPath() {
  const P = window.IBDPath, el = $("path");
  if (state.disease !== "cd" && state.disease !== "uc") { $("pathsum").textContent = ""; el.innerHTML = '<div class="empty">Choose Crohn disease or ulcerative colitis in the Patient box to see the guide.</div>'; return; }
  const c = pathContext(), o = P.options(state.disease, c.hist), ladder = P.LADDER[state.disease], notes = P.notes(c.feats, state.disease);
  const drugState = {}; c.ms.forEach((m) => { drugState[m.drug.id] = m.status; });
  const label = (id) => { const d = IB.CLASSES.reduce((a, cl) => a || cl.drugs.find((x) => x.id === id), null); return d ? d.label.split(" (")[0] : id; };
  const cautioned = {}; notes.forEach((n) => (n.drugs || []).forEach((d) => { if (n.level !== "info" || n.id === "s1p") (cautioned[d] = cautioned[d] || []).push(n.text); }));
  const here = ladder.find((x) => x.id === c.key);
  $("pathsum").textContent = (here ? here.title : "") + " | " + (c.hist === "exposed" ? "advanced therapy before: " + (c.h.names.join(", ") || "yes") : "no advanced therapy on record");
  let h = `<div class="muted">${state.disease === "cd" ? "Crohn disease" : "Ulcerative colitis"}. ${c.auto ? "Stage chosen from the page" + (c.acuteAuto ? " (meets severe colitis criteria)" : c.band ? " (latest score: " + esc(c.band) + ")" : " (no score entered yet: pick a situation)") + "." : "Stage chosen by you."}</div><div class="muted">Advanced therapy on record: ${c.h.names.length ? esc(c.ms.filter((m) => R.ADVANCED.includes(m.cls.id) && m.status !== "none").map((m) => m.drug.label.split(" (")[0] + " (" + m.status + ")").join(", ")) : "none found"}.</div><div class="lab">Stepwise approach</div>`;
  ladder.forEach((st, i) => {
    h += `<div class="stg ${st.id === c.key ? "here" : ""}"><h4>${st.id === c.key ? "▶ " : ""}${esc(st.title)} <span class="tag" style="${st.src === "guideline" ? "" : "background:var(--line);color:var(--muted)"}">${st.src === "guideline" ? "from guideline summaries" : "general practice, not from the sources read"}</span></h4><ul>${st.lines.map((l) => `<li>${esc(l)}</li>`).join("")}</ul>${st.next ? `<div class="nx">${esc(st.next)}</div>` : ""}</div>`;
    if (st.next && i < ladder.length - 1 && ["mild", "adv"].includes(st.id)) h += '<div class="arrow">▼</div>';
  });
  h += `<div class="lab">Advanced therapy options: ${c.hist === "exposed" ? "previously exposed" : "never exposed"} (guideline efficacy tiers)</div><div class="muted">${esc(o.note)}</div>`;
  o.tiers.forEach(([k, name, ids]) => { h += `<div class="tier"><b>${esc(name)}</b>${ids.map((id) => { const st = drugState[id], warn = cautioned[id]; const cls = st === "current" ? "current" : st && st !== "none" ? "tried" : ""; return `<span class="chip ${cls} ${warn ? "warn" : ""}" title="${esc((warn || []).join(" "))}">${esc(label(id))}${st === "current" ? " (current)" : st && st !== "none" ? " (" + esc(st) + ")" : ""}${warn ? " ⚠" : ""}</span>`; }).join("")}</div>`; });
  h += `<div class="muted">Green = on now. Struck through = already used (same drug usually not repeated). ⚠ = a patient factor below applies; hover for why. Tiers rank average effect in trials, not your patient: availability, route, speed of onset, safety and coverage also decide.</div>`;
  if (notes.length) h += `<div class="lab">Patient factors that change the choice</div>` + notes.map((n) => `<div class="alert ${n.level === "urgent" ? "urgent" : n.level === "action" ? "action" : "info"}">${esc(n.text)}</div>`).join("");
  h += `<div class="lab">Before starting advanced therapy</div><div class="muted">C. difficile and other stool tests, TB, hepatitis B/C, HIV, VZV status, vaccines (live vaccines before starting), pregnancy plans, baseline CBC, liver tests, creatinine. See the screening box below and the drug class reminders above.</div>`;
  h += `<div class="lab">Sources</div><ul class="rem">${P.SOURCES.map(([t, u]) => `<li><a href="${u}" target="_blank" rel="noopener">${esc(t)}</a></li>`).join("")}<li>Full guidelines: AGA, ACG and Canadian Association of Gastroenterology websites (not read here).</li></ul>`;
  el.innerHTML = h;
}
$("p-sit").onchange = $("p-hist").onchange = () => drawPath();
document.querySelectorAll("[data-pf]").forEach((cb) => (cb.onchange = () => { state.pf[cb.dataset.pf] = cb.checked; drawPath(); }));
function drawAll() { drawPt(); drawTiles(); drawAlerts(); drawFlow(); drawMeds(); drawPath(); drawEndo(); drawSym(); drawScreen(); }
$("disease").onchange = () => { state.disease = $("disease").value; drawAll(); symPreview(); };
$("setting").onchange = () => { state.setting = $("setting").value; drawAll(); };
$("flaring").onchange = () => { state.flaring = $("flaring").checked; drawAll(); };
$("range").onchange = () => { state.range = +$("range").value; drawFlow(); };

/* ---------- loading a patient ---------- */
function setChart(raw, note, errors, source) {
  state.f = raw ? window.IBDChart.parseChart(raw, { now: Date.now() }) : null; state.source = raw ? source : "";
  state.entries = []; state.manualMeds = []; state.manualEndo = []; state.open = {}; state.hide = {}; state.pf = {}; document.querySelectorAll('[data-pf]').forEach((cb) => (cb.checked = false)); $('p-sit').value = 'auto'; $('p-hist').value = 'auto';
  state.disease = state.f && state.f.disease ? state.f.disease : "unknown"; state.setting = "outpatient"; state.flaring = false;
  $("pstatus").textContent = note; $("clear").hidden = !raw;
  $("errs").innerHTML = errors && errors.length ? "Could not read: " + errors.map(esc).join("; ") + ". Check that the scopes are enabled in the Code Console. You can still enter things by hand." : "";
  drawAll(); symPreview();
}
$("clear").onclick = () => { $("testsel").value = ""; setChart(null, "Open from Cerner to read the chart, or pick a made-up patient:"); };
const sel = $("testsel"), SAMPLES = window.IBD_SAMPLES || [];
SAMPLES.forEach((p, i) => { const o = document.createElement("option"); o.value = i; o.textContent = p.label; sel.appendChild(o); });
sel.onchange = () => {
  const p = SAMPLES[sel.value]; if (!p) return $("clear").onclick();
  const now = Date.now(), b = p.build(now);
  setChart(b.raw, "Made-up patient: " + p.label, [], "sample");
  state.disease = b.disease || state.disease; state.setting = b.setting || "outpatient"; state.flaring = !!b.flaring;
  state.entries = (b.entries || []).map((e) => Object.assign({ normalStools: 1, blood: "", pga: "", wellbeing: "", pain: "", mass: "", comps: 0 }, e));
  drawAll();
};
async function fromChart() {
  if (typeof FHIR === "undefined" || !(location.search.includes("code=") || sessionStorage.getItem("SMART_KEY"))) return;
  $("pstatus").textContent = "Reading the chart…";
  try {
    const client = await FHIR.oauth2.ready();
    const { raw, errors } = await window.IBDChart.gather(client, (m) => ($("pstatus").textContent = m));
    setChart(raw, "Chart read (read-only). Nothing is sent anywhere. Stool counts and symptom scores are entered below.", errors, "chart");
  } catch (e) { $("pstatus").textContent = "Could not read the chart: " + (e && e.message ? e.message : e) + ". The made-up patients still work."; }
}
drawAll(); symPreview(); fromChart();
