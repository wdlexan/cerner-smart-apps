/* Parkinson disease page. Read-only. UNVERIFIED draft. */
const R = window.PdRules, C = window.PdChart, DAY = C.DAY, HR = 36e5;
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const fmtDT = (t) => new Date(t).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
const hm = (t) => new Date(t).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
const ul = (a) => "<ul style='margin:4px 0 6px 18px;padding:0'>" + a.filter(Boolean).map((t) => "<li style='margin:3px 0'>" + t + "</li>").join("") + "</ul>";
const state = { f: null, x: null, rows: [], sym: {}, symAuto: {} };

function buildRows(f) {
  const seen = new Set();
  return f.orders.filter((o) => { const k = o.drug.id + o.name; if (seen.has(k)) return false; seen.add(k); return true; }).map((o) => Object.assign(R.row(o.name), { held: o.held, prn: o.prn, interval: R.listedInterval(o.name) }));
}

function ctx() {
  const f = state.f, now = Date.now(), x = { now };
  x.rows = state.rows;
  x.L = R.ledd(x.rows.filter((r) => !r.prn));
  x.crcl = f.cr && f.wt && f.age != null ? ((140 - f.age) * f.wt.v * (f.sex === "female" ? 1.04 : 1.23)) / f.cr.v : null;
  x.onMaob = x.rows.some((r) => r.drug.cls === "maob"); x.onApo = x.rows.some((r) => r.drug.id === "apomorphine");
  // timing per scheduled levodopa / agonist row
  x.timing = x.rows.filter((r) => !r.prn && ["levodopa", "agonist", "comt"].includes(r.drug.cls) && r.drug.id !== "rotigotine" && !r.drug.device).map((r) => {
    const gives = f.gives.filter((g) => g.drug && g.drug.id === r.drug.id);
    return Object.assign({ r, gives }, R.timing(gives, r.n, now, 72, r.interval));
  });
  x.lateCount = x.timing.reduce((s, t) => s + t.late.length, 0);
  x.overdue = x.timing.filter((t) => t.overdue);
  x.heldNoNpo = x.rows.filter((r) => r.held && !$("npo").checked);
  x.avoid = R.avoid(f.meds.filter((m) => !m.isPd && !m.given), x.onMaob, x.onApo);
  // haloperidol / metoclopramide actually given
  x.avoidGiven = f.gives.filter((g) => !g.drug && R.AVOID.slice(0, 2).some((a) => a.re.test(g.name)) && now - g.t <= 3 * DAY);
  x.orth = f.orth.length ? f.orth[f.orth.length - 1] : null;
  x.sym = Object.keys(state.sym).filter((k) => state.sym[k]);
  const has = (id) => x.sym.includes(id);
  x.choices = R.choices({ age: f.age, cognition: has("cog"), psych: has("psych") || has("delirium"), oh: has("oh") || (x.orth && x.orth.drop >= 20), crcl: x.crcl, icd: has("icd"), sleepy: has("sleep") && !!(state.symAuto.sleep && /daytime|somnolen|sleep attack|falls asleep/i.test(state.symAuto.sleep.quote)), falls: has("freeze"), onMaob: x.onMaob, dysk: has("dysk"), off: has("off") });
  x.npo = $("npo").checked ? R.npo(x.rows.filter((r) => !r.prn), x.L) : null;
  return x;
}

function tile(cls, k, big, s) { return `<div class="tile ${cls}"><div class="k">${esc(k)}</div><div class="big" style="font-size:24px">${big}</div><div class="s">${s || ""}</div></div>`; }

function draw() {
  const f = state.f;
  if (!f) { ["tiles", "alerts", "meds", "timing", "npoplan", "avoid", "symptoms", "choices"].forEach((id) => ($(id).innerHTML = "")); ["alertsum", "leddsum", "timesum", "npsum", "avsum", "symsum", "ptsum", "npohint"].forEach((id) => ($(id).textContent = "")); state.x = null; PD_NOTE.update(); return; }
  const x = state.x = ctx();
  // tiles
  $("tiles").innerHTML = [
    tile(x.rows.length ? "t1" : "t2", "LEDD", x.rows.length ? x.L.total + " mg" : "–", x.rows.length ? `levodopa ${x.L.levodopa} mg/day` : "No PD medication found"),
    tile(x.lateCount || x.overdue.length ? "t3" : "t0", "Doses on time", x.lateCount ? x.lateCount + " late" : x.overdue.length ? "Overdue" : x.timing.length ? "On time" : "–", x.timing.length ? "last 72 h, more than 30 min" : ""),
    tile(x.avoid.length ? "t3" : "t0", "Drugs to avoid", x.avoid.length ? x.avoid.length + " found" : "None", x.avoidGiven.length ? x.avoidGiven.length + " given in 72 h" : ""),
    tile(x.orth ? (x.orth.drop >= 20 ? "t3" : "t0") : "", "Orthostatic BP", x.orth ? "−" + x.orth.drop : "Not done", x.orth ? `${x.orth.base} → ${x.orth.stand} standing (${fmtDT(x.orth.t)})` : "Lying and standing BP")].join("");
  drawAlerts(x); drawMeds(x); drawTiming(x); drawNpo(x); drawAvoid(x); drawSymptoms(x); drawChoices(x);
  PD_NOTE.update();
}

function drawAlerts(x) {
  const a = [];
  if (x.heldNoNpo.length) a.push(["urgent", "PD medication on hold: " + x.heldNoNpo.map((r) => r.name.split(" PO")[0]).join(", ") + ".", "Do not stop PD drugs abruptly. If the patient can swallow, restart; if not, tick nil by mouth for the plan."]);
  if ($("npo").checked && x.rows.length) a.push(["urgent", "Nil by mouth on PD medication.", "See the nil-by-mouth plan: NG levodopa first; patch if no tube."]);
  x.overdue.forEach((t) => a.push(["urgent", `${t.r.drug.name}: next dose overdue by about ${t.overdue} min.`, "Give now."]));
  if (x.lateCount) a.push(["action", `${x.lateCount} late PD dose${x.lateCount > 1 ? "s" : ""} in 72 h (more than 30 min).`, "Ask nursing to set exact times (patient's home schedule) and allow self-administration if able."]);
  x.avoidGiven.forEach((g) => a.push(["urgent", `${g.name} given ${fmtDT(g.t)}.`, "Watch for severe rigidity, swallowing problems and fever; stop it."]));
  x.avoid.forEach((v) => a.push([/Contraindicated|Avoid$/.test(v.sev) ? "action" : "info", `${v.sev}: ${v.name}.`, v.why + (v.alt ? " " + v.alt : "")]));
  if (x.orth && x.orth.drop >= 20) a.push(["action", `Orthostatic drop ${x.orth.drop} mmHg.`, "See orthostatic hypotension management."]);
  if (state.f.npoHint && !$("npo").checked) a.push(["info", "A recent note mentions NPO / nil by mouth.", "Tick nil by mouth above if that is current."]);
  if (!x.rows.length && state.f.problems.some((p) => /parkinson|G20/i.test(p))) a.push(["info", "Parkinson disease on the problem list but no PD medication found.", "Check home medications (best possible medication history)."]);
  $("alertsum").textContent = a.length ? a.length + " item" + (a.length > 1 ? "s" : "") : "none";
  $("alerts").innerHTML = a.length ? a.map(([l, t, s]) => `<div class="alert ${l}"><b>${l === "urgent" ? "Urgent" : l === "action" ? "Action" : "Note"}</b>${esc(t)}${s ? '<div class="muted">' + esc(s) + "</div>" : ""}</div>`).join("") : '<div class="muted">Nothing flagged.</div>';
}

function drawMeds(x) {
  if (!x.rows.length) { $("meds").innerHTML = '<div class="muted">No Parkinson medication found in the orders.</div>'; $("leddsum").textContent = ""; return; }
  const parts = new Map(x.L.parts.map((p) => [p.r, p]));
  $("meds").innerHTML = `<table><tr><th>Order</th><th>Class</th><th>mg per dose</th><th>Doses / day</th><th>LED / day</th></tr>` + x.rows.map((r, i) => {
    const p = parts.get(r), led = r.prn ? "PRN (not counted)" : p && p.led != null ? Math.round(p.led) : "?";
    return `<tr><td class="wrap">${esc(r.name)}${r.held ? ' <span class="chip c-no">on hold</span>' : ""}</td><td>${esc(r.drug.name)}</td>
      <td><input class="sm" type="number" step="any" data-row="${i}" data-k="mgDose" value="${r.mgDose != null ? r.mgDose : ""}"></td>
      <td><input class="sm" type="number" step="any" data-row="${i}" data-k="n" value="${r.n != null ? r.n : ""}"></td><td class="num">${led}</td></tr>`;
  }).join("") + `<tr><th colspan="4">Total LEDD${x.L.missing ? " (some doses unreadable: fill them in)" : ""}</th><th class="num">${x.L.total} mg</th></tr></table>`;
  document.querySelectorAll("[data-row]").forEach((inp) => (inp.oninput = () => { const v = parseFloat(inp.value); state.rows[+inp.dataset.row][inp.dataset.k] = isFinite(v) ? v : null; draw(); }));
  $("leddsum").textContent = x.L.total + " mg/day";
}

function drawTiming(x) {
  if (!x.timing.length) { $("timing").innerHTML = '<div class="muted">No scheduled oral PD medication to check.</div>'; $("timesum").textContent = ""; return; }
  $("timing").innerHTML = x.timing.map((t) => {
    const late = new Set(t.late.map((l) => l.t));
    const doses = t.gives.filter((g) => x.now - g.t <= 72 * HR).sort((a, b) => a.t - b.t).map((g) => `<span class="flag ${late.has(g.t) ? "f-avoid" : "f-good"}">${fmtDT(g.t)}${late.has(g.t) ? " (+" + t.late.find((l) => l.t === g.t).by + " min)" : ""}</span>`).join(" ");
    return `<div style="margin:8px 0"><b>${esc(t.r.drug.name)}</b> <span class="muted">${t.r.n || "?"}× daily${t.r.interval ? ", every " + t.r.interval + " h while awake" : ""}; ${t.got24} given in the last 24 h${t.r.n && t.got24 < t.r.n ? ` (expected ${t.r.n})` : ""}</span><div>${doses || '<span class="muted">No doses recorded in 72 h.</span>'}</div></div>`;
  }).join("");
  $("timesum").textContent = x.lateCount ? x.lateCount + " late" : "no late doses found";
}

function drawNpo(x) {
  $("sec-npo").open = !!x.npo;
  $("npsum").textContent = x.npo ? "nil by mouth" : "tick nil by mouth to show";
  $("npoplan").innerHTML = x.npo ? ul(x.npo.map(esc)) : '<div class="muted">Not nil by mouth. Tick the box above if the patient cannot take tablets.</div>';
}

function drawAvoid(x) {
  const safe = ["Nausea: domperidone 10 mg up to TID (max 30 mg/day; QT caution) or ondansetron (not with apomorphine).", "Agitation / psychosis: quetiapine 12.5-25 mg at night, or clozapine (specialist). Never haloperidol.",
    "Pain: acetaminophen; opioids other than meperidine / tramadol / methadone if on an MAO-B inhibitor.", "Bladder: mirabegron rather than oxybutynin / tolterodine."];
  $("avsum").textContent = x.avoid.length ? x.avoid.length + " found" : "none found";
  $("avoid").innerHTML = (x.avoid.length ? `<table><tr><th>Order</th><th>Problem</th><th>Instead</th></tr>` + x.avoid.map((v) => `<tr><td class="wrap"><span class="chip ${/Contraindicated|Avoid/.test(v.sev) ? "c-no" : "c-unknown"}">${esc(v.sev)}</span> ${esc(v.name)}</td><td class="wrap">${esc(v.why)}</td><td class="wrap muted">${esc(v.alt)}</td></tr>`).join("") + "</table>"
    : '<div class="muted">No dopamine blockers, anticholinergics or MAO-B interactions found in the orders.</div>') + "<b>Safer choices in PD</b>" + ul(safe.map(esc));
}

function drawSymptoms(x) {
  const groups = ["Motor", "Non-motor"];
  $("symptoms").innerHTML = groups.map((g) => `<h3 style="font-size:14px;margin:12px 0 4px">${g}</h3>` + R.SYMPTOMS.filter((s) => s.g === g).map((s) => {
    const on = !!state.sym[s.id], auto = state.symAuto[s.id];
    return `<div class="sym ${on ? "on" : ""}"><label class="inl"><input type="checkbox" data-sym="${s.id}"${on ? " checked" : ""}> <b>${esc(s.label)}</b></label>${auto ? ` <span class="muted">— ${esc(auto.src)}: “${esc(auto.quote)}”</span>` : ""}${on ? ul(s.mgmt.map(esc)) : ""}</div>`;
  }).join("")).join("");
  document.querySelectorAll("[data-sym]").forEach((cb) => (cb.onchange = () => { state.sym[cb.dataset.sym] = cb.checked; draw(); }));
  $("symsum").textContent = x.sym.length + " ticked";
}

function drawChoices(x) {
  $("choices").innerHTML = `<table><tr><th>Option</th><th>When</th><th>Downsides</th><th>Typical start</th><th>For this patient</th></tr>` + x.choices.map((c) => {
    const on = x.rows.some((r) => r.drug.cls === c.cls || (c.cls === "apo" && r.drug.id === "apomorphine") || (c.cls === "device" && r.drug.device));
    return `<tr><td class="wrap"><b>${esc(c.name)}</b>${on ? ' <span class="chip c-yes">on now</span>' : ""}</td><td class="wrap">${esc(c.when)}</td><td class="wrap muted">${esc(c.cons)}</td><td class="wrap">${esc(c.start)}</td>
      <td class="wrap">${c.flags.length ? c.flags.map((fl) => `<span class="flag f-${fl.lvl}">${esc(fl.text)}</span>`).join("") : '<span class="muted">–</span>'}</td></tr>`;
  }).join("") + "</table>";
}

function load(raw, note, errors, sample) {
  state.f = raw ? C.parse(raw) : null; const f = state.f;
  state.rows = f ? buildRows(f) : [];
  state.symAuto = f ? R.detect(f.notes.map((n) => ({ src: n.title, text: n.text })), f.problems) : {};
  state.sym = Object.fromEntries(Object.keys(state.symAuto).map((k) => [k, true]));
  $("npo").checked = !!(sample && sample.npo);
  $("npohint").textContent = f && f.npoHint ? `(${f.npoHint.title}: mentions NPO)` : "";
  $("ptsum").textContent = f ? [f.age != null ? f.age + " y" : "", f.sex, f.problems.slice(0, 2).map((p) => p.replace(/\s+[A-Z]\d.*$/, "")).join("; ")].filter(Boolean).join(", ") : "";
  $("pstatus").textContent = note; $("clear").hidden = !raw;
  $("errs").innerHTML = errors && errors.length ? "Could not read: " + errors.map(esc).join("; ") + ". Check the scopes in the Code Console." : "";
  draw(); PD_NOTE.reset();
}
$("npo").onchange = draw;
$("clear").onclick = () => { $("testsel").value = ""; load(null, "Open from Cerner to read the chart, or pick a made-up patient:"); };
const SAMPLES = window.PD_SAMPLES || [];
SAMPLES.forEach((p, i) => { const o = document.createElement("option"); o.value = i; o.textContent = p.label; $("testsel").appendChild(o); });
$("testsel").onchange = () => { const p = SAMPLES[$("testsel").value]; if (!p) return $("clear").onclick(); load(p.build(Date.now()), "Made-up patient: " + p.label, [], p); };

async function fromChart() {
  if (typeof FHIR === "undefined" || !(location.search.includes("code=") || location.search.includes("complete=") || sessionStorage.getItem("SMART_KEY"))) return;
  $("pstatus").textContent = "Reading the chart…";
  try {
    const client = await FHIR.oauth2.ready();
    const { raw, errors } = await C.gather(client, (msg) => ($("pstatus").textContent = msg));
    load(raw, "Chart read (read-only). Check the LEDD table and the symptom quotes.", errors);
  } catch (e) { $("pstatus").textContent = "Could not read the chart: " + (e && e.message ? e.message : e) + ". The made-up patients still work."; }
}
draw(); fromChart();
