/* Bispecific CRS/ICANS monitor: page logic. Reads window.BSChart, BSRules, BS_PROTOCOL, BS_SAMPLES. Nothing is sent anywhere. */
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const H = 36e5, MIN = 6e4, R = window.BSRules, P = window.BS_PROTOCOL;
const freshIn = () => ({ hypo: "none", o2: "ra", feverMasked: false, g1persist: false, comorbid: false, fullDoseNoCRS: false, crsResolved: false, symptoms: {},
  ice: { orient: "", naming: "", command: "", writing: "", attention: "" }, iceT: null, baselineIce: 10, loc: "awake", seizure: "none", motor: "none", icp: "none", gcs: "", pupilL: "", pupilR: "", baseSbp: "", kg: "" });
const state = { f: null, source: "", where: "home", entered: [], manualDoses: [], iceLog: [], open: {}, in: freshIn(), checks: {}, errors: [], now: null };
const nowT = () => state.now || Date.now();
const two = (n) => String(n).padStart(2, "0");
const toLocal = (ms) => { const d = new Date(ms); return `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}T${two(d.getHours())}:${two(d.getMinutes())}`; };
const fromLocal = (s) => { const t = s ? new Date(s).getTime() : NaN; return isNaN(t) ? null : t; };
const fmt = (t) => { const d = new Date(t); return `${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][d.getMonth()]} ${d.getDate()} ${two(d.getHours())}:${two(d.getMinutes())}`; };
const ago = (ms) => { const m = Math.round(ms / MIN); return m < 90 ? m + " min" : (m / 60).toFixed(1) + " h"; };

/* ---------- build the input object for rules.js ---------- */
function buildS() {
  const f = state.f || { readings: [], doses: [] };
  const baseSbp = state.in.baseSbp !== "" && !isNaN(Number(state.in.baseSbp)) ? Number(state.in.baseSbp) : f.baseSbpGuess || null;
  const doses = (f.doses || []).concat(state.manualDoses);
  return { now: nowT(), where: state.where, baseSbp, readings: R.mergeReadings(f.readings, state.entered), doses, in: effectiveIn() };
}
/* The ICE that drives grading and timers is the NEWEST of: the boxes on the form (if all five are filled) and every recorded ICE (chart or entered here). */
function iceRecords() { return ((state.f && state.f.ice) || []).concat(state.iceLog).sort((a, b) => b.t - a.t); }
function pendingIce() {
  const total = R.iceTotal(state.in.ice); if (total == null) return null;
  const t = state.in.iceT || nowT(), dup = iceRecords().some((x) => x.total === total && Math.abs(x.t - t) < 2 * MIN);
  return { total, t, dup };
}
function effectiveIn() {
  const i = state.in, p = pendingIce(), latest = iceRecords()[0];
  if (latest && (!p || latest.t > p.t)) return Object.assign({}, i, { iceTotalOverride: latest.total, iceT: latest.t });
  return i;
}
const weightKg = () => (state.in.kg !== "" && Number(state.in.kg) > 0 ? Number(state.in.kg) : state.f && state.f.weightKg);

/* ---------- drawing ---------- */
function drawPatient() {
  const f = state.f;
  $("pt").innerHTML = f ? `<b>${f.age != null ? f.age + " years" : "Age not read"}${f.sex ? ", " + esc(f.sex) : ""}</b>${weightKg() ? " &middot; " + weightKg() + " kg" : " &middot; weight not read"}${f.notes.length ? "<br>" + f.notes.map((n) => "&bull; " + esc(n)).join("<br>") : ""}` : "";
  $("ptsum").textContent = f ? `${f.age != null ? f.age + " y" : ""}${f.sex ? " " + f.sex : ""}${weightKg() ? " · " + weightKg() + " kg" : ""}` : "";
  const g = f && f.baseSbpGuess;
  $("basenote").textContent = g ? `From the chart: ${g} (median of ${f.baseSbpN} reading${f.baseSbpN === 1 ? "" : "s"}${f.baseFromBefore ? " before the first teclistamab dose" : ", no pre-dose readings, so the earliest on record"}). Type a number to override.` : "Not found in the chart: type it in (drives the low-BP rule).";
  $("basesbp").placeholder = g ? String(g) : "";
}
function tile(cls, k, big, s) { return `<div class="tile ${cls}"><div class="k">${esc(k)}</div><div class="big">${esc(big)}</div><div class="s">${s}</div></div>`; }
function drawTiles(S, c, n, d, due) {
  let crsT;
  if (c.grade === 0 && !c.provisional) crsT = tile("t0", "CRS (ASTCT)", "None", "No fever ≥ 38.0 °C in the last 24 h" + (c.tmax != null ? ` (highest ${c.tmax.toFixed(1)})` : ""));
  else if (c.grade === 0) crsT = tile("t" + c.provisional, "CRS (ASTCT)", "Provisional " + c.provisional, "No fever documented. " + esc(c.notes[0] || ""));
  else crsT = tile("t" + c.grade, "CRS (ASTCT)", "Grade " + c.grade, esc(c.notes.join(" ")) + (c.unlikely ? " <b>Full dose already given without CRS: CRS unlikely per protocol.</b>" : "") + (c.manageAs !== c.grade ? ` Managing as grade ${c.manageAs}.` : ""));
  let icT;
  if (!n.done && n.grade === 0) icT = tile("", "ICANS (ASTCT)", "Not assessed", "Enter an ICE score. Baseline before treatment is also useful.");
  else if (n.grade === 0) icT = tile("t0", "ICANS (ASTCT)", "None", `ICE ${n.total}/10`);
  else icT = tile("t" + n.grade, "ICANS (ASTCT)", "Grade " + n.grade, (n.total != null ? `ICE ${n.total}/10. ` : "") + esc(n.parts.map((p) => p.why).filter((w) => w && !(n.total != null && /^ICE \d/.test(w))).join("; ")));
  let wT;
  if (d.lastTec) wT = tile(d.inWindow ? "t2" : "t0", "Since last teclistamab", d.hrs.toFixed(1) + " h", `${esc(d.lastTec.label || "dose")}, ${fmt(d.lastTec.t)}. ${d.inWindow ? "<b>Inside the 48 h CRS window.</b>" : "Outside the 48 h CRS window."}`);
  else wT = tile("", "Since last teclistamab", "No dose", "None found. Add one below.");
  const dueLines = [];
  if (due.vitals) dueLines.push(due.vitals.ago == null ? "Vitals: none recorded" : due.vitals.overdue ? `<b>Vitals overdue</b> (${due.vitals.ago} min since last; every ${due.vitals.interval} min)` : `Vitals due in ${due.vitals.dueIn} min (every ${due.vitals.interval} min)`);
  if (due.ice) dueLines.push(due.ice.ago == null ? "<b>ICE: none recorded</b> (every 8 h)" : due.ice.overdue ? `<b>ICE overdue</b> (${due.ice.ago} h since last; every 8 h)` : `ICE due in ${due.ice.dueInMin} min (every 8 h)`);
  const dT = tile(dueLines.length ? (due.vitals && due.vitals.overdue) || (due.ice && due.ice.overdue ? "t2" : "t1") : "", "Next checks", dueLines.length ? "Timers" : "None running", dueLines.join("<br>") || "No CRS or ICANS grade now.");
  $("tiles").innerHTML = crsT + icT + wT + dT;
}
function drawAlerts(S) {
  const a = R.alerts(S);
  $("alertsum").textContent = a.length ? `${a.length} alert${a.length === 1 ? "" : "s"}${a.some((x) => x.level === "urgent") ? " (urgent)" : ""}` : "none";
  $("alerts").innerHTML = a.length ? a.map((x) => `<div class="alert ${x.level}"><b>${esc(x.title)}</b>${esc(x.text)}${x.src ? `<div class="src">${esc(x.src)}</div>` : ""}</div>`).join("") : '<div class="empty">No alerts from the data and entries so far.</div>';
  return a;
}
const op = (k, d) => ((state.open[k] !== undefined ? state.open[k] : d) ? " open" : "");
document.addEventListener("toggle", (e) => { const k = e.target.dataset && e.target.dataset.det; if (k) state.open[k] = e.target.open; }, true);
const KIND_TAG = { crs: "CRS", icans: "ICANS" };
function planEntries(kind, grade, S) {
  return (P[kind === "crs" ? "CRS" : "ICANS"][grade] || []).map((it, i) => ({ it, kind, key: `${kind}:${grade}:${i}` })).filter((x) => !x.it.w || x.it.w === S.where);
}
/* group entries by category (where / notify / stop / meds / labs / imaging / consults / monitoring); identical lines from CRS and ICANS are merged */
function groupedHTML(entries) {
  const out = [];
  P.CATS.forEach(([cat, title]) => {
    const seen = new Map();
    entries.filter((e) => e.it.c === cat).forEach((e) => { const k = e.it.t; if (seen.has(k)) seen.get(k).kinds.add(e.kind); else seen.set(k, { e, kinds: new Set([e.kind]) }); });
    if (!seen.size) return;
    out.push(`<div class="lab">${esc(title)}</div><ul class="chk">${Array.from(seen.values()).map(({ e, kinds }) => {
      const on = !!state.checks[e.key];
      return `<li class="${on ? "done" : ""}${cat === "where" ? " where" : ""}"><input type="checkbox" data-chk="${esc(e.key)}"${on ? " checked" : ""}><span class="t">${Array.from(kinds).map((k) => `<span class="tag ${k}">${KIND_TAG[k]}</span>`).join("")}${esc(e.it.t)}</span></li>`;
    }).join("")}</ul>`);
  });
  return out.join("");
}
function drawMgmt(S, c, n) {
  const pl = R.placement(S, c, n), gC = c.manageAs;
  const banner = `<div class="place ${pl.key}"><div class="k">Where the patient should be</div><div class="big">${esc(pl.title)}</div><div>${esc(pl.text)}</div>${pl.reasons.length ? `<div class="s">Because: ${esc(pl.reasons.join("; "))}.</div>` : ""}${pl.considerICU ? '<div class="s"><b>Consider a higher level of care (ICU)</b> if there is no response to fluids and steroids, or the oxygen need rises.</div>' : ""}<div class="s">Ward, ER and ICU are the app's reading of the protocols' "health-care facility / admit / higher level of care / ER/ICU" wording; the protocols do not name a ward.</div></div>`;
  const active = [];
  if (gC >= 1) active.push(...planEntries("crs", Math.min(gC, 3), S));
  if (n.grade >= 1) active.push(...planEntries("icans", n.grade, S));
  const title = [gC >= 1 ? `CRS ${gC >= 3 ? "grade 3 or 4" : "grade " + gC}${c.provisional && !c.grade ? " (provisional)" : ""}` : "", n.grade >= 1 ? `ICANS grade ${n.grade}` : ""].filter(Boolean).join(" + ");
  const card = active.length ? `<details class="card" data-det="plan"${op("plan", true)}><summary><span>Action plan: ${esc(title)}</span><span class="muted">${S.where === "home" ? "patient at home" : "patient at a facility"}</span></summary><div class="body">${groupedHTML(active)}<div class="muted" style="margin-top:10px">Sources: ${esc(P.META.crs)}; ${esc(P.META.icans)}. Doses as printed: verify against the current protocols and your orders.</div></div></details>`
    : `<div class="empty">No CRS or ICANS grade now, so there is no action plan. If fever ≥ 38.0 °C occurs, CRS grade 1 actions apply (see the reference below).</div>`;
  const refs = [1, 2, 3].map((g) => `<details class="card" data-det="ref-crs-${g}"${op("ref-crs-" + g, false)}><summary><span>Reference: CRS grade ${g === 3 ? "3 or 4" : g}</span></summary><div class="body">${groupedHTML(planEntries("crs", g, S))}</div></details>`)
    .concat([1, 2, 3, 4].map((g) => `<details class="card" data-det="ref-icans-${g}"${op("ref-icans-" + g, false)}><summary><span>Reference: ICANS grade ${g}</span></summary><div class="body">${groupedHTML(planEntries("icans", g, S))}</div></details>`));
  $("mgmtsum").textContent = pl.title;
  $("mgmt").innerHTML = banner + card + `<details class="card" data-det="ref-all"${op("ref-all", false)} style="margin-top:8px"><summary><span>Reference: every grade, grouped the same way</span></summary><div class="body" style="display:grid;gap:8px">${refs.join("")}</div></details>`;
}
function drawDoses(S) {
  const d = R.doseInfo(S), rows = (arr) => arr.length ? arr.map((x) => `<tr><td>${fmt(x.t)}</td><td>${esc(x.label || x.name || "")}${x.detail ? " <span class=\"muted\">" + esc(x.detail) + "</span>" : ""}</td><td>${esc(x.src === "entered" ? "entered" : "chart")}</td><td>${ago(S.now - x.t)} ago</td></tr>`).join("") : '<tr><td colspan="4" class="muted">none</td></tr>';
  const kg = weightKg(), td = R.tociDose(kg), f = state.f;
  const near = d.tociNearFirst ? `Tocilizumab documented ${Math.abs(d.tociNearFirst.diffH).toFixed(1)} h ${d.tociNearFirst.diffH < 0 ? "before" : "after"} the first teclistamab dose (${fmt(d.tociNearFirst.d.t)}).` : d.firstTec ? "<b>No tocilizumab documented within 48 h of the first teclistamab dose.</b> If it was given, add it above." : "";
  const ordered = f && f.ordered && f.ordered.length ? `<div class="muted" style="margin-top:6px">Orders found (not proof of administration): ${f.ordered.map((o) => esc(o.name) + (o.t ? " " + fmt(o.t) : "") + (o.status ? " [" + esc(o.status) + "]" : "")).join("; ")}</div>` : "";
  const wrap = (cap, arr) => `<div class="lab">${cap}</div><table><tr><th>Time</th><th>Dose</th><th>Source</th><th>Ago</th></tr>${rows(arr)}</table>`;
  $("doses").innerHTML = wrap("Teclistamab", d.tec) + wrap("Tocilizumab", d.toci) + `<div style="margin-top:8px">${near}</div>
    <div style="margin-top:6px"><b>Tocilizumab:</b> ${d.toci24} dose${d.toci24 === 1 ? "" : "s"} in the last 24 h, ${d.tociTotal} in total in this record. Protocol limit: 3 doses in 24 hours, 4 doses total.</div>
    <div style="margin-top:6px"><b>Protocol dose check:</b> ${td ? `8 mg/kg × ${kg} kg = ${Math.round(td.raw)} mg${td.capped ? ", capped at the 800 mg maximum" : ""}. <b>${Math.round(td.mg)} mg</b> IV in 100 mL NS over 1 hour. Confirm with pharmacy.` : "enter a weight to see the 8 mg/kg dose (maximum 800 mg)."}</div>${ordered}`;
}
function drawReadings(S) {
  const rs = S.readings.slice(0, 16);
  if (!rs.length) { $("readings").innerHTML = '<div class="empty">No vital signs yet. Add a reading above.</div>'; return; }
  const base = S.baseSbp;
  $("readings").innerHTML = `<table><tr><th>Time</th><th>Temp °C</th><th>SBP</th><th>HR</th><th>RR</th><th>SpO2 %</th><th>Source</th><th></th></tr>${rs.map((r) => {
    const cell = (v, hot) => `<td${hot ? ' class="hot"' : ""}>${v == null ? "" : v}</td>`;
    return `<tr><td>${fmt(r.t)}</td>${cell(r.temp, r.temp >= 38)}${cell(r.sbp, r.sbp != null && (r.sbp < 100 || (base && base - r.sbp > 20)))}${cell(r.hr)}${cell(r.rr)}${cell(r.spo2, r.spo2 != null && r.spo2 <= 92)}<td>${esc(r.src)}</td><td>${r.src === "entered" ? `<button data-rm="${Math.floor(r.t / MIN)}">remove</button>` : ""}</td></tr>`;
  }).join("")}</table><div class="muted" style="margin-top:4px">Red = fever ≥ 38.0, SBP under 100 or more than 20 below baseline${base ? " (" + base + ")" : ""}, SpO2 92 or below.</div>`;
}
function drawLabs(S, c, n) {
  const f = state.f, labs = (f && f.labs) || {}, active = c.manageAs >= 1 || n.grade >= 1;
  $("labs").innerHTML = `<div class="muted">CRS panel (persistent grade 1 or 2, and as required) plus the ICANS panel (all grades). Repeat every 4 hours if abnormal, and before discharge. “Abnormal” uses the lab's own reference range or flag.</div><table><tr><th>Test</th><th>Latest</th><th>When</th><th>Ref range</th><th>Used in</th></tr>${P.LABS.map(([k, name, use]) => {
    const l = labs[k]; if (!l) return `<tr><td>${esc(name)}</td><td colspan="3" class="muted">not found in the chart</td><td>${esc(use)}</td></tr>`;
    const age = S.now - l.t, due = active && l.abn && age > 4 * H;
    return `<tr><td>${esc(name)}</td><td${l.abn ? ' class="abn"' : ""}>${l.v} ${esc(l.unit)}${l.abn ? " (abnormal)" : ""}</td><td>${fmt(l.t)} (${ago(age)} ago)${due ? ' <b class="err">repeat due</b>' : ""}</td><td>${l.low != null || l.high != null ? (l.low != null ? l.low : "") + " – " + (l.high != null ? l.high : "") : ""}</td><td>${esc(use)}</td></tr>`;
  }).join("")}</table>`;
}
function noteText(S, c, n, alerts) {
  const d = R.doseInfo(S), L = [], rs = S.readings.slice(0, 8), sy = Object.keys(state.in.symptoms).filter((k) => state.in.symptoms[k]);
  L.push(`CRS/ICANS MONITORING NOTE (draft, generated ${fmt(S.now)}; check against the chart and protocols)`);
  L.push(`Setting: ${S.where === "home" ? "Hospital at Home" : "health-care facility"}`);
  L.push(d.lastTec ? `Teclistamab: last dose ${fmt(d.lastTec.t)} (${d.lastTec.label || "dose"}), ${d.hrs.toFixed(1)} h ago${d.inWindow ? ", inside the 48 h CRS window" : ""}` : "Teclistamab: no dose recorded");
  L.push(`Tocilizumab: ${d.toci24} in 24 h, ${d.tociTotal} total`);
  L.push("", c.grade === 0 && !c.provisional ? "CRS: none (no fever >= 38.0 C in 24 h)" : c.grade === 0 ? `CRS: provisional grade ${c.provisional} (no fever documented)` : `CRS: grade ${c.grade}${c.manageAs !== c.grade ? ` (managing as grade ${c.manageAs})` : ""}`);
  L.push(`  oxygen: ${{ ra: "room air", low: "low-flow", high: "high-flow/mask", pp: "positive pressure" }[state.in.o2]}; hypotension support: ${{ none: "none", fluid: "IV fluids", one: "one vasopressor", multi: "multiple vasopressors" }[state.in.hypo]}`);
  if (sy.length) L.push("  symptoms: " + sy.join(", "));
  L.push(n.done || n.grade ? `ICANS: grade ${n.grade}${n.total != null ? `, ICE ${n.total}/10` : ""} (baseline ${n.baseline})${S.in.iceT ? ", ICE at " + fmt(S.in.iceT) : ""}` : "ICANS: ICE not done");
  L.push(`  consciousness: ${state.in.loc}; seizure: ${state.in.seizure}; motor: ${state.in.motor}; edema/ICP: ${state.in.icp}${state.in.gcs ? "; GCS " + state.in.gcs : ""}${state.in.pupilL || state.in.pupilR ? `; pupils L ${state.in.pupilL || "?"} / R ${state.in.pupilR || "?"} mm` : ""}`);
  const iceAll = ((state.f && state.f.ice) || []).concat(state.iceLog).sort((p, q) => q.t - p.t).slice(0, 8);
  if (iceAll.length) L.push("ICE record (newest first): " + iceAll.map((x) => `${x.total}/10 ${fmt(x.t)}${x.src === "entered" ? " (entered)" : ""}`).join("; "));
  L.push("", "Recent vital signs (newest first):");
  rs.forEach((r) => L.push(`  ${fmt(r.t)}  T ${r.temp != null ? r.temp : "-"}  SBP ${r.sbp != null ? r.sbp : "-"}  HR ${r.hr != null ? r.hr : "-"}  RR ${r.rr != null ? r.rr : "-"}  SpO2 ${r.spo2 != null ? r.spo2 : "-"}`));
  L.push(`  baseline SBP ${S.baseSbp || "not set"}`);
  L.push("", "Alerts at this time:"); (alerts.length ? alerts : [{ title: "none", text: "" }]).forEach((a) => L.push(`  - ${a.title}${a.text ? ": " + a.text : ""}`));
  const done = Object.keys(state.checks).filter((k) => state.checks[k]).length;
  L.push("", `Protocol checklist items ticked in this page: ${done}`, "Source: BC Cancer SCCRS (rev 1 Jun 2026) and SCICANS (rev 1 Dec 2024), transcribed into this tool and not independently verified.");
  return L.join("\n");
}
const iceGrade = (t) => (t === 10 ? "none" : t >= 7 ? "1" : t >= 3 ? "2" : "3 (4 if unrousable)");
function drawIceRec(S) {
  const f = state.f || {}, all = (f.ice || []).concat(state.iceLog).sort((a, b) => b.t - a.t);
  const gcs = (f.gcs || []).slice(0, 6), gr = (f.icansGrades || []).slice(0, 6);
  if (!all.length && !gcs.length && !gr.length && !pendingIce()) { $("icerec").innerHTML = '<div class="empty">No ICE scores found in the chart or recorded here. Nursing ICE scores are found by name; if your nursing ICE form is free text it will not appear. Enter an ICE score and press "Record this ICE" to start the record.</div>'; $("icesum").textContent = ""; return; }
  const trend = all.slice(0, 10).reverse().map((x) => x.total).join(" → ");
  $("icesum").textContent = all.length ? `latest ${all[0].total}/10 (${fmt(all[0].t)})` : "";
  const items = (x) => (x.items ? ["orient", "naming", "command", "writing", "attention"].map((k) => k.slice(0, 4) + " " + (x.items[k] != null ? x.items[k] : "?")).join(", ") : "");
  const pend = pendingIce(), pendRow = pend && !pend.dup ? `<tr style="background:var(--a-bg)"><td>${fmt(pend.t)}</td><td${pend.total < 9 ? ' class="hot"' : ""}>${pend.total}/10</td><td>${iceGrade(pend.total)}</td><td></td><td><b>Not saved yet.</b> Press Record to add it to the record.</td><td>entered here</td><td><button class="primary" data-recnow="1">Record</button></td></tr>` : "";
  const rows = pendRow + all.slice(0, 20).map((x, i) => {
    const prev = all[i + 1], d = prev ? x.total - prev.total : null;
    const detail = x.src === "entered" ? esc(x.detail || "") + (x.items ? (x.detail ? "; " : "") + esc(items(x)) : "") : esc((x.by ? x.by + ". " : "") + items(x));
    return `<tr><td>${fmt(x.t)}</td><td${x.total < 9 ? ' class="hot"' : ""}>${x.total}/10</td><td>${iceGrade(x.total)}</td><td>${d == null ? "" : d === 0 ? "no change" : d > 0 ? "+" + d + " (better)" : d + " (worse)"}</td><td>${detail}</td><td>${x.src === "entered" ? "entered here" : "chart (nursing)"}</td><td>${x.src === "entered" ? `<button data-rmice="${esc(x.id)}">remove</button>` : ""}</td></tr>`;
  }).join("");
  const base = (f.ice || []).slice().sort((p, q) => p.t - q.t).find((x) => !(S.doses.find((d) => d.drug === "tec")) || x.t < S.doses.filter((d) => d.drug === "tec").sort((p, q) => p.t - q.t)[0].t);
  $("icerec").innerHTML = (all.length || pendRow ? `<div style="margin-bottom:6px"><b>Trend (oldest to newest):</b> ${esc(trend || "none recorded yet")}</div><table><tr><th>Time</th><th>ICE</th><th>ICANS grade from ICE</th><th>Change</th><th>Detail</th><th>Source</th><th></th></tr>${rows}</table>` : "")
    + (base ? `<div class="muted" style="margin-top:6px">Earliest charted ICE before treatment: ${base.total}/10 (${fmt(base.t)}). Set the baseline in the ICE section if it differs from 10.</div>` : "")
    + (gr.length ? `<div style="margin-top:6px"><b>ICANS grade charted by nursing:</b> ${gr.map((x) => `grade ${x.grade} (${fmt(x.t)})`).join("; ")}</div>` : "")
    + (gcs.length ? `<div style="margin-top:6px"><b>Glasgow coma score (chart):</b> ${gcs.map((x) => `${x.v} (${fmt(x.t)})`).join("; ")}</div>` : "")
    + '<div class="muted" style="margin-top:6px">Chart records are matched by their name, so check them against the nursing flowsheet. “ICANS grade from ICE” uses only the ICE score; the app\'s overall grade also uses consciousness, seizure, motor and edema.</div>';
}
let lastAlerts = [];
function drawResults() {
  drawPatient();
  const S = buildS(), c = R.crs(S), n = R.icans(S), d = R.doseInfo(S), due = R.dueTimes(S, c, n);
  const has = state.f || state.entered.length || state.manualDoses.length;
  if (!has) { $("tiles").innerHTML = ""; $("icerec").innerHTML = ""; $("icesum").textContent = ""; $("alertsum").textContent = ""; $("mgmtsum").textContent = ""; $("alerts").innerHTML = '<div class="empty">Pick a made-up patient, open from Cerner, or add readings and doses by hand.</div>'; $("mgmt").innerHTML = ""; $("doses").innerHTML = ""; $("readings").innerHTML = ""; $("labs").innerHTML = ""; return; }
  drawTiles(S, c, n, d, due); lastAlerts = drawAlerts(S); drawMgmt(S, c, n); drawDoses(S); drawReadings(S); drawLabs(S, c, n); drawIceRec(S);
  const t = R.iceTotal(state.in.ice); $("icetotal").textContent = t == null ? "ICE incomplete" : "ICE " + t + "/10";
}
window.__state = state; window.__draw = drawResults; // used by tests

/* ---------- form <-> state ---------- */
const ICE_IDS = ["orient", "naming", "command", "writing", "attention"];
(function fillSelects() {
  const mk = (id, max, withBlank) => { const s = $(id); s.innerHTML = (withBlank ? '<option value="">-</option>' : "") + Array.from({ length: max + 1 }, (_, i) => `<option value="${i}">${i}</option>`).join(""); };
  mk("ice-orient", 4, true); mk("ice-naming", 3, true); mk("ice-command", 1, true); mk("ice-writing", 1, true); mk("ice-attention", 1, true); mk("baselineIce", 10, false); $("baselineIce").value = "10";
})();
function readForm() {
  const i = state.in;
  ["o2", "hypo", "loc", "seizure", "motor", "icp", "gcs", "pupilL", "pupilR", "basesbp", "kg"].forEach((k) => { if ($(k)) i[k === "basesbp" ? "baseSbp" : k] = $(k).value; });
  ["feverMasked", "g1persist", "comorbid", "fullDoseNoCRS", "crsResolved"].forEach((k) => (i[k] = $(k).checked));
  document.querySelectorAll("[data-sym]").forEach((e) => (i.symptoms[e.dataset.sym] = e.checked));
  ICE_IDS.forEach((k) => (i.ice[k] = $("ice-" + k).value));
  i.baselineIce = Number($("baselineIce").value); i.iceT = fromLocal($("iceT").value);
  state.where = (document.querySelector("input[name=where]:checked") || {}).value || "home";
}
function setForm() {
  const i = state.in;
  ["o2", "hypo", "loc", "seizure", "motor", "icp", "gcs", "pupilL", "pupilR", "kg"].forEach((k) => { if ($(k)) $(k).value = i[k]; });
  $("basesbp").value = i.baseSbp;
  ["feverMasked", "g1persist", "comorbid", "fullDoseNoCRS", "crsResolved"].forEach((k) => ($(k).checked = !!i[k]));
  document.querySelectorAll("[data-sym]").forEach((e) => (e.checked = !!i.symptoms[e.dataset.sym]));
  ICE_IDS.forEach((k) => ($("ice-" + k).value = i.ice[k])); $("baselineIce").value = String(i.baselineIce); $("iceT").value = i.iceT ? toLocal(i.iceT) : "";
  document.querySelectorAll("input[name=where]").forEach((e) => (e.checked = e.value === state.where));
}
document.addEventListener("input", (e) => { if (e.target.closest("#entry, #panel") && !e.target.id.startsWith("r") && !e.target.id.startsWith("dd-")) { readForm(); drawResults(); } });
document.addEventListener("change", (e) => { if (e.target.closest("#entry, #panel") && e.target.id !== "testsel" && !e.target.id.startsWith("dd-")) { readForm(); drawResults(); } });
$("icenow").onclick = () => { $("iceT").value = toLocal(nowT()); readForm(); drawResults(); };
$("rt").value = toLocal(Date.now()); $("dd-t").value = toLocal(Date.now());
$("radd").onclick = () => {
  const num = (id) => (isNaN(parseFloat($(id).value)) ? null : parseFloat($(id).value)), r = { t: fromLocal($("rt").value) || nowT(), temp: num("rtemp"), sbp: num("rsbp"), hr: num("rhr"), rr: num("rrr"), spo2: num("rspo2") };
  if (["temp", "sbp", "hr", "rr", "spo2"].every((k) => r[k] == null)) return;
  state.entered.push(r); ["rtemp", "rsbp", "rhr", "rrr", "rspo2"].forEach((id) => ($(id).value = "")); $("rt").value = toLocal(Date.now()); drawResults();
};
$("dd-add").onclick = () => {
  const t = fromLocal($("dd-t").value); if (t == null) return;
  const drug = $("dd-drug").value, label = $("dd-label").value.trim() || { tec: "Teclistamab dose", toci: "Tocilizumab", dex: "Dexamethasone" }[drug];
  state.manualDoses.push({ drug, t, label, src: "entered" }); $("dd-label").value = ""; $("dd-t").value = toLocal(Date.now()); drawResults();
};
function recordIce() {
  readForm(); const p = pendingIce(); if (!p) { $("icetotal").textContent = "Complete all five ICE items first"; return; }
  const i = state.in, n = R.icans(Object.assign({}, buildS(), { in: Object.assign({}, i, { iceTotalOverride: null }) }));
  const detail = [`consciousness ${i.loc}`, i.seizure !== "none" ? "seizure " + i.seizure : "", i.gcs ? "GCS " + i.gcs : "", `overall ICANS grade ${n.grade}`].filter(Boolean).join(", ");
  state.iceLog.push({ id: String(Date.now()) + Math.random().toString(36).slice(2, 6), t: p.t, total: p.total, items: Object.assign({}, i.ice), detail, src: "entered", by: "" });
  // clear the boxes ready for the next ICE; grading carries on from the newest recorded score
  state.in.ice = { orient: "", naming: "", command: "", writing: "", attention: "" }; state.in.iceT = null; setForm();
  drawResults();
}
$("icerec-add").onclick = recordIce;
document.addEventListener("click", (e) => {
  if (e.target.dataset && e.target.dataset.recnow) { recordIce(); return; }
  const ri = e.target.dataset && e.target.dataset.rmice; if (ri) { state.iceLog = state.iceLog.filter((x) => x.id !== ri); drawResults(); return; }
  const rm = e.target.dataset && e.target.dataset.rm;
  if (rm) { state.entered = state.entered.filter((r) => String(Math.floor(r.t / MIN)) !== rm); drawResults(); }
});
document.addEventListener("change", (e) => { const k = e.target.dataset && e.target.dataset.chk; if (k) { state.checks[k] = e.target.checked; e.target.closest("li").classList.toggle("done", e.target.checked); } });
$("copy").onclick = () => {
  const S = buildS(); if (!state.f && !state.entered.length) { $("copied").textContent = "Nothing to copy yet."; return; }
  const t = noteText(S, R.crs(S), R.icans(S), lastAlerts);
  navigator.clipboard.writeText(t).then(() => { $("copied").textContent = "Copied."; setTimeout(() => ($("copied").textContent = ""), 1500); }, () => { $("copied").textContent = "Could not copy."; });
};
window.__noteText = () => { const S = buildS(); return noteText(S, R.crs(S), R.icans(S), lastAlerts); };

/* ---------- loading a patient ---------- */
function setChart(raw, note, errors, source) {
  state.f = raw ? BSChart.parseChart(raw, { now: Date.now() }) : null; state.source = raw ? source : ""; state.errors = errors || [];
  state.entered = []; state.manualDoses = []; state.iceLog = []; state.checks = {}; state.in = freshIn(); state.now = null;
  $("pstatus").textContent = note; $("clear").hidden = !raw;
  $("errs").innerHTML = state.errors.length ? "Could not read: " + state.errors.map(esc).join("; ") + ". Check that the scopes are enabled in the Code Console. You can still enter readings and doses by hand." : "";
  setForm(); drawResults();
}
$("clear").onclick = () => { $("testsel").value = ""; state.where = "home"; setChart(null, "Open from Cerner to read the chart, or pick a made-up patient:"); };
const sel = $("testsel"), SAMPLES = window.BS_SAMPLES || [];
SAMPLES.forEach((p, i) => { const o = document.createElement("option"); o.value = i; o.textContent = p.label; sel.appendChild(o); });
sel.onchange = () => {
  const p = SAMPLES[sel.value]; if (!p) return $("clear").onclick();
  const now = Date.now(), b = p.build(now);
  setChart(b.raw, "Made-up patient: " + p.label, [], "sample");
  state.where = b.where; Object.assign(state.in, b.set || {}); if (b.set && b.set.ice) state.in.ice = Object.assign({}, b.set.ice);
  setForm(); drawResults();
};
async function fromChart() {
  if (typeof FHIR === "undefined" || !(location.search.includes("code=") || sessionStorage.getItem("SMART_KEY"))) return;
  $("pstatus").textContent = "Reading the chart…";
  try {
    const client = await FHIR.oauth2.ready();
    const { raw, errors } = await BSChart.gather(client, (m) => ($("pstatus").textContent = m));
    setChart(raw, "Chart read (read-only). Nothing is sent anywhere. Oxygen delivery, vasopressors, ICE and neuro findings are entered below.", errors, "chart");
  } catch (e) { $("pstatus").textContent = "Could not read the chart: " + (e && e.message ? e.message : e) + ". The made-up patients still work."; }
}
setInterval(() => { if (state.f || state.entered.length || state.manualDoses.length) drawResults(); }, 60000);
setForm(); drawResults(); fromChart();
