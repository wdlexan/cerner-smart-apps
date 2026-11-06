/* Kidney transplant page. Read-only from the chart; tick-boxes and targets stay in this page. UNVERIFIED draft. */
const RULES = window.TX_RULES, E = window.TxEngine, DAY = E.DAY, HR = E.HR;
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const fmtD = (t) => new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric" });
const fmtDT = (t) => new Date(t).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
const ago = (t) => { const h = (Date.now() - t) / HR; return h < 1 ? Math.max(1, Math.round(h * 60)) + " min ago" : h < 48 ? Math.round(h) + " h ago" : Math.round(h / 24) + " d ago"; };
const r1 = (v) => Math.round(v * 10) / 10;
const short = (n) => n.replace(/\s+\d.*$/, "").trim() || n;
const SEVLABEL = { critical: "Avoid / call transplant", major: "Act", moderate: "Monitor", info: "Note" };
const CTX = [["npo", "NPO / can't take oral"], ["diarrhea", "Diarrhea"], ["contrast", "IV contrast planned"], ["unwell", "Acutely unwell or going to surgery"]];
const state = { f: null, ctx: {}, auto: {}, targets: {} };

function evalNow() { return E.evaluate(state.f, RULES, { ctx: state.ctx, targets: state.targets }); }

function draw() {
  $("rulever").textContent = RULES.meta.version;
  const ids = ["tiles", "alerts", "levels", "labs", "context", "watch", "imm", "ctxrow", "targetrow"];
  if (!state.f) { ids.forEach((id) => ($(id).innerHTML = "")); ["alertsum", "levelsum", "labsum", "ctxsum", "watchsum", "immsum", "ptsum"].forEach((id) => ($(id).textContent = "")); $("alerts").innerHTML = '<div class="muted">No patient loaded.</div>'; return; }
  const ev = evalNow();
  drawCtx(ev); drawTargets(ev); drawTiles(ev); drawAlerts(ev); drawLevels(ev); drawLabs(ev); drawContext(ev); drawWatch(ev); drawImm(ev);
}

function drawCtx(ev) {
  const hint = { npo: state.auto.npo, diarrhea: state.auto.diarrhea, contrast: state.auto.contrast };
  $("ctxrow").innerHTML = "<b>Situation:</b> " + CTX.map(([k, l]) => `<label class="inl" title="${esc((hint[k] || []).join("; "))}"><input type="checkbox" data-ctx="${k}"${state.ctx[k] ? " checked" : ""}> ${esc(l)}${hint[k] && hint[k].length ? ' <span class="muted">(chart)</span>' : ""}</label>`).join(" ");
  document.querySelectorAll("[data-ctx]").forEach((cb) => (cb.onchange = () => { state.ctx[cb.dataset.ctx] = cb.checked; draw(); }));
}

function drawTargets(ev) {
  const lv = ev.levels;
  if (!lv.length) { $("targetrow").innerHTML = ""; return; }
  $("targetrow").innerHTML = "<b>Level target</b> <span class=\"muted\">(from the transplant team; depends on time since transplant):</span> " + lv.map((l) => {
    const t = state.targets[l.id] || ["", ""];
    return `<span class="inl">${esc(l.name)} <input type="number" step="0.1" min="0" data-tg="${l.id}" data-i="0" value="${t[0]}" aria-label="${esc(l.name)} low"> to <input type="number" step="0.1" min="0" data-tg="${l.id}" data-i="1" value="${t[1]}" aria-label="${esc(l.name)} high"></span>`;
  }).join(" ");
  document.querySelectorAll("[data-tg]").forEach((inp) => (inp.onchange = () => {
    const id = inp.dataset.tg, cur = (state.targets[id] || ["", ""]).slice(); cur[+inp.dataset.i] = inp.value === "" ? "" : parseFloat(inp.value);
    if (cur[0] === "" && cur[1] === "") delete state.targets[id]; else state.targets[id] = [cur[0] === "" ? -Infinity : cur[0], cur[1] === "" ? Infinity : cur[1]];
    draw();
  }));
}

function tile(cls, k, big, s) { return `<div class="tile ${cls}"><div class="k">${esc(k)}</div><div class="big">${big}</div><div class="s">${s || ""}</div></div>`; }

function drawTiles(ev) {
  const t = [], c = ev.counts;
  if (!ev.transplant.detected) t.push(tile("t1", "Transplant", "Not found", "No kidney transplant on the problem list and no immunosuppressant ordered. Nothing below applies unless this is wrong."));
  else t.push(tile("t1", "Transplant", ev.immunos.length ? esc(ev.immunos.map((i) => { const w = short(i.names[0]).split(/[\s(]/)[0]; return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase(); }).join(" + ")) : "No immunosuppressant",
    ev.transplant.problems.length ? esc(ev.transplant.problems[0]) : "Not on the problem list (found from medications)"));
  const worst = c.critical ? "t3" : c.major ? "t2" : c.moderate ? "t1" : "t0";
  t.push(tile(worst, "Interactions", (c.critical + c.major + c.moderate) || "None",
    [c.critical && c.critical + " avoid / call", c.major && c.major + " act", c.moderate && c.moderate + " monitor", c.info && c.info + " note"].filter(Boolean).join(" · ") || "Nothing flagged"));
  if (ev.levels.length) {
    const due = ev.levels.filter((l) => l.dueNow), next = ev.levels.map((l) => l.nextDue).filter(Boolean).sort((a, b) => a - b)[0];
    t.push(due.length ? tile("t2", "Drug level", "Check now", esc(due.map((l) => l.name).join(", ")))
      : next ? tile("t1", "Drug level", "From " + fmtD(next), "After a new or stopped interacting drug") : tile("t0", "Drug level", "Up to date", esc(ev.levels.map((l) => l.last ? l.name + " " + l.last.v + " " + ago(l.last.t) : l.name).join("; "))));
  }
  const cr = ev.labs.find((x) => x.id === "creatinine");
  if (cr && cr.latest) t.push(tile(cr.flag ? "t3" : "t0", "Creatinine", Math.round(cr.latest.v) + " <span style='font-size:13px'>umol/L</span>", esc(ago(cr.latest.t) + " · " + cr.detail)));
  $("tiles").innerHTML = t.join("");
}

function trig(t) {
  const when = t.current ? (t.start ? "started " + fmtD(t.start) : "ordered") : t.stop ? "stopped " + fmtD(t.stop) : "stopped";
  return `<b>${esc(short(t.names[0]))}</b> <span class="muted">(${esc(when)})</span>`;
}

function drawAlerts(ev) {
  const a = ev.alerts;
  $("alertsum").textContent = a.length ? a.length + " item" + (a.length > 1 ? "s" : "") : ev.immunos.length ? "none" : "";
  if (!ev.immunos.length) { $("alerts").innerHTML = '<div class="muted">No current immunosuppressant found, so no interaction rules apply.</div>'; return; }
  $("alerts").innerHTML = a.length ? a.map((x) => `<div class="alert ${x.severity}">
      <div class="h"><span class="sev">${esc(SEVLABEL[x.severity])}</span>${esc(x.title)}</div>
      <div class="meta">${x.triggers.map(trig).join(", ")} with ${esc(x.affects.join(", "))}${x.onlyStopped ? " · <i>recently stopped: levels can swing back</i>" : ""}</div>
      <div class="act">${esc(x.action)}</div>
      <div class="meta muted">${esc(x.mechanism)}${x.note ? " " + esc(x.note) : ""}</div></div>`).join("")
    : '<div class="muted">No interacting drugs found among current orders or drugs given recently.</div>';
}

const STATUS = { done: "Done", upcoming: "Upcoming", due: "Due now", overdue: "Overdue" };
function drawLevels(ev) {
  const L = ev.levels;
  $("levelsum").textContent = L.length ? L.map((l) => l.name + (l.dueNow ? ": check" : "")).join(" · ") : "";
  if (!L.length) { $("levels").innerHTML = '<div class="muted">No level-monitored immunosuppressant (tacrolimus, cyclosporine, sirolimus, everolimus) found.</div>'; return; }
  $("levels").innerHTML = L.map((l) => {
    const tg = l.target, tgTxt = tg ? (isFinite(tg[0]) ? tg[0] : "") + "–" + (isFinite(tg[1]) ? tg[1] : "") : "not entered";
    const hist = l.recent.length ? `<table><tr><th>When</th><th>Level</th><th></th></tr>${l.recent.map((x, i) => `<tr><td>${fmtDT(x.t)}</td><td class="num ${tg && (x.v < tg[0] || x.v > tg[1]) ? "hi" : ""}">${x.v} ${esc(x.unit)}</td><td class="muted">${i === 0 ? ago(x.t) : ""}</td></tr>`).join("")}</table>` : '<div class="muted">No level found in the past 90 days.</div>';
    const evs = l.events.length ? `<h3>Rechecks needed after a drug change</h3><table><tr><th>Drug</th><th>Change</th><th>Check a trough</th><th>Status</th></tr>${l.events.map((e) =>
      `<tr><td>${esc(short(e.drug))}</td><td>${e.kind === "on" ? "on it (start date unknown)" : esc(e.kind) + " " + (e.t ? fmtD(e.t) : "")}</td><td>${e.windowStart ? fmtD(e.windowStart) + (e.windowEnd !== e.windowStart ? " – " + fmtD(e.windowEnd) : "") : "now"}${e.note ? '<div class="muted">' + esc(e.note) + "</div>" : ""}</td>
       <td><span class="chip c-${e.status}">${STATUS[e.status]}</span>${e.doneWith ? ' <span class="muted">' + e.doneWith.v + " on " + fmtD(e.doneWith.t) + "</span>" : ""}</td></tr>`).join("")}</table>` : "";
    const pr = l.prompts.length ? `<ul class="tight">${l.prompts.map((p) => "<li>" + esc(p) + "</li>").join("")}</ul>` : "";
    return `<h3>${esc(l.name)} <span class="muted" style="font-weight:400">· ${esc(l.levelType)} · target ${esc(tgTxt)}</span></h3>${pr}<div class="scroll">${hist}</div><div class="scroll">${evs}</div>`;
  }).join("") + '<div class="src">Timing assumes steady state in about 3 days for tacrolimus and cyclosporine and 5-7 days for sirolimus/everolimus. A strong inhibitor or inducer usually needs a dose change from the transplant team, not just a level.</div>';
}

function drawLabs(ev) {
  const rows = ev.labs, flagged = rows.filter((x) => x.flag);
  $("labsum").textContent = flagged.length ? flagged.length + " flagged" : "nothing flagged";
  const unit = (id) => (RULES.labWatch.items.find((i) => i.id === id) || {}).unit || "";
  $("labs").innerHTML = `<table><tr><th>Test</th><th>Latest</th><th>When</th><th>Flag at</th><th>What it may mean</th></tr>${rows.map((x) => {
    if (!x.latest) return `<tr><td>${esc(x.label)}</td><td class="muted" colspan="2">Not found</td><td class="muted">${esc(x.rule)}</td><td></td></tr>`;
    const v = x.id === "creatinine" || x.id === "platelets" || x.id === "hemoglobin" || x.id === "qtc" || x.id === "ck" ? Math.round(x.latest.v) : r1(x.latest.v);
    return `<tr><td>${esc(x.label)}</td><td class="num ${x.flag ? "hi" : ""}">${v} ${esc(unit(x.id))}${x.detail ? '<div class="muted" style="font-weight:400">' + esc(x.detail) + "</div>" : ""}</td><td class="${x.fresh ? "" : "muted"}">${ago(x.latest.t)}${x.fresh ? "" : " (old)"}</td>
      <td class="muted">${esc(x.rule)}</td><td>${x.flag ? esc(x.message) : ""}</td></tr>`;
  }).join("")}</table><div class="src">Thresholds are placeholders: confirm with the transplant program. Creatinine baseline = lowest value 3-90 days old.</div>`;
}

function drawContext(ev) {
  const c = ev.context;
  $("ctxsum").textContent = c.length ? c.length + " item" + (c.length > 1 ? "s" : "") : "";
  $("context").innerHTML = c.length ? c.map((x) => `<div class="alert ${x.urgent ? "major" : "moderate"}"><div class="h">${esc(x.title)}</div><div class="act">${esc(x.message)}</div>${x.extra ? '<div class="meta">' + esc(x.extra) + "</div>" : ""}</div>`).join("")
    : '<div class="muted">' + (ev.immunos.length ? "Nothing extra for the situation ticked above." : "No immunosuppressant found.") + "</div>";
}

function drawWatch(ev) {
  $("watchsum").textContent = ev.watch.length ? ev.watch.length + " group" + (ev.watch.length > 1 ? "s" : "") : "";
  $("watch").innerHTML = ev.watch.length ? ev.watch.map(([h, items]) => `<h3>${esc(h)}</h3><ul class="tight">${items.map((i) => "<li>" + esc(i) + "</li>").join("")}</ul>`).join("") : '<div class="muted">No immunosuppressant found.</div>';
}

function drawImm(ev) {
  $("immsum").textContent = ev.immunos.length ? ev.immunos.length + " found" : "none";
  const bel = ev.immunos.some((i) => i.id === "belatacept");
  $("imm").innerHTML = (ev.immunos.length ? `<table><tr><th>Drug</th><th>Order(s) found</th><th>Notes</th></tr>${ev.immunos.map((i) =>
    `<tr><td><b>${esc(i.name)}</b>${i.subtype && i.subtype !== "unknown" ? '<div class="muted">' + (i.subtype === "mmf" ? "mofetil (CellCept)" : "sodium (Myfortic)") + "</div>" : ""}</td><td>${i.names.map(esc).join("<br>")}</td><td class="muted">${esc(i.notes)}</td></tr>`).join("")}</table>`
    : '<div class="muted">None found among current orders.</div>') +
    (ev.transplant.detected && !bel ? '<div class="src">Belatacept is a monthly infusion and often does not appear on inpatient orders: ask the patient.</div>' : "");
}

function load(raw, note, errors, preset) {
  state.f = raw ? E.parse(raw) : null; preset = preset || {};
  state.ctx = {}; state.auto = {}; state.targets = Object.assign({}, preset.targets || {});
  if (state.f) {
    state.auto = E.detectContext(state.f, RULES);
    state.ctx = { npo: state.auto.npo.length > 0, diarrhea: state.auto.diarrhea.length > 0, contrast: state.auto.contrast.length > 0, unwell: false };
    const f = state.f; $("ptsum").textContent = [f.sex, f.age != null ? f.age + " y" : ""].filter(Boolean).join(", ");
  } else $("ptsum").textContent = "";
  $("pstatus").textContent = note; $("clear").hidden = !raw;
  $("errs").innerHTML = errors && errors.length ? "Could not read: " + errors.map(esc).join("; ") + ". Check the scopes in the Code Console." : "";
  draw();
}

$("clear").onclick = () => { $("testsel").value = ""; load(null, "Open from Cerner to read the chart, or pick a made-up patient:"); };
const SAMPLES = window.TX_SAMPLES || [];
SAMPLES.forEach((p, i) => { const o = document.createElement("option"); o.value = i; o.textContent = p.label; $("testsel").appendChild(o); });
$("testsel").onchange = () => { const p = SAMPLES[$("testsel").value]; if (!p) return $("clear").onclick(); load(p.build(Date.now()), "Made-up patient: " + p.label, [], p); };

async function fromChart() {
  if (typeof FHIR === "undefined" || !(location.search.includes("code=") || location.search.includes("complete=") || sessionStorage.getItem("SMART_KEY"))) return;
  $("pstatus").textContent = "Reading the chart…";
  try {
    const client = await FHIR.oauth2.ready();
    const { raw, errors } = await window.TxChart.gather(client, (msg) => ($("pstatus").textContent = msg));
    load(raw, "Chart read (read-only). Nothing is sent anywhere. Tick the situation boxes and enter level targets above.", errors);
  } catch (e) { $("pstatus").textContent = "Could not read the chart: " + (e && e.message ? e.message : e) + ". The made-up patients still work."; }
}
draw(); fromChart();
// ?demo=1 .. 6 opens a made-up patient directly (for checking without Cerner)
(() => { const m = location.search.match(/demo=(\d)/); if (m && SAMPLES[+m[1] - 1]) { $("testsel").value = +m[1] - 1; $("testsel").onchange(); } })();
