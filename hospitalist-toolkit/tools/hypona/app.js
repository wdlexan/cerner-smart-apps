/* Hyponatremia page. Read-only from the chart; your selections stay in this page. UNVERIFIED draft. */
const R = window.HypoRules, C = window.HypoChart, DAY = C.DAY, HR = 36e5;
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const fmtD = (t) => new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric" });
const fmtDT = (t) => new Date(t).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
const ago = (t) => { const h = (Date.now() - t) / HR; return h < 1 ? Math.max(1, Math.round(h * 60)) + " min ago" : h < 48 ? Math.round(h) + " h ago" : Math.round(h / 24) + " d ago"; };
const r1 = (v) => Math.round(v * 10) / 10;
const sgn = (v) => (v > 0 ? "+" : "") + r1(v);
const ul = (a) => "<ul>" + a.filter(Boolean).map((t) => "<li>" + t + "</li>").join("") + "</ul>";
const RISKS = [["na105", "Sodium 105 or less"], ["hypoK", "Low potassium"], ["alcohol", "Alcohol use disorder"], ["malnut", "Malnutrition"], ["liver", "Advanced liver disease"]];
const LABEL = { siad: "SIAD likely", highuna: "Urine Na above 30: choose volume status", diuretic: "Diuretic-related", renalloss: "Kidney or adrenal salt loss", hypovolemic: "Volume depletion (non-kidney loss)",
  hypervolemic: "Hypervolemic (HF, cirrhosis, nephrotic)", lowvol: "Low effective volume: choose volume status", lowuosm: "Water excess or low solute", hyperglycemia: "Hyperglycemia (not hypotonic)",
  nonhypotonic: "Not hypotonic", incomplete: "Workup incomplete" };
const state = { f: null, risk: {}, auto: {} };

/* ---- cause helper: typed values, falling back to the chart ---- */
const MF = ["na", "sosm", "glu", "urea", "uosm", "una", "uk", "scr", "ucr", "suric", "uuric"];
function typed() { const o = {}; MF.forEach((k) => { const v = parseFloat($("m-" + k).value); o[k] = isFinite(v) ? v : null; }); return o; }
function chartVals() {
  if (!state.f) return {};
  const f = state.f, now = Date.now(), L = (id, d) => C.latest(f.s[id], d * DAY, now), U = (id, d) => C.latest(f.u[id], d * DAY, now);
  const na = f.na.filter((e) => $("usegas").checked || e.src !== "gas");
  return { na: na[na.length - 1] || null, sosm: L("sosm", 7), glu: L("glu", 1), urea: L("urea", 3), uosm: U("uosm", 7), una: U("una", 7), uk: U("uk", 7), scr: L("creat", 3), ucr: U("ucr", 7), suric: L("uric", 14) };
}
/* merged values: typed wins, else chart. Returns { v: {key: number}, src: {key: "typed"|"chart"} } */
function merged() {
  const t = typed(), c = chartVals(), v = {}, src = {};
  MF.forEach((k) => { if (t[k] != null) { v[k] = t[k]; src[k] = "typed"; } else if (c[k]) { v[k] = k === "suric" ? Math.round(c[k].v * 100) / 100 : r1(c[k].v); src[k] = "chart"; } else v[k] = null; });
  return { v, src, chart: c };
}
const PATTERNS = [
  { h: "Hyperglycemia, pseudohyponatremia, extra osmoles", s: "275 or more", u: "any", n: "any", vol: "any", labels: ["hyperglycemia", "nonhypotonic"] },
  { h: "Primary polydipsia, low solute (beer potomania, tea and toast)", s: "below 275", u: "100 or less", n: "usually low", vol: "normal", labels: ["lowuosm"] },
  { h: "Fluid loss outside the kidney (diarrhea, third spacing, remote diuretics)", s: "below 275", u: "above 100", n: "30 or less", vol: "low", labels: ["hypovolemic", "lowvol"] },
  { h: "Heart failure, cirrhosis, nephrotic syndrome", s: "below 275", u: "above 100", n: "30 or less (higher on diuretics)", vol: "high", labels: ["hypervolemic", "lowvol"] },
  { h: "Diuretics, vomiting, primary adrenal insufficiency, salt wasting", s: "below 275", u: "above 100", n: "above 30", vol: "low", labels: ["renalloss", "diuretic", "highuna"] },
  { h: "SIAD, hypothyroidism, secondary adrenal insufficiency", s: "below 275", u: "above 100", n: "above 30", vol: "normal", labels: ["siad", "highuna"] }];

function drawManual() {
  const { v, src, chart } = merged(), t = typed();
  MF.forEach((k) => { const el = $("m-" + k), c = chart[k]; el.placeholder = c ? String(k === "suric" ? Math.round(c.v * 100) / 100 : r1(c.v)) : ""; el.title = c ? "Chart: " + el.placeholder + " (" + fmtDT(c.t) + ")" : ""; el.classList.toggle("typed", t[k] != null); });
  const nTyped = MF.filter((k) => t[k] != null).length, nChart = MF.filter((k) => src[k] === "chart").length;
  $("m-src").textContent = (nTyped ? nTyped + " typed" : "") + (nTyped && nChart ? ", " : "") + (nChart ? nChart + " from the chart (grey)" : "");
  $("m-clear").hidden = !nTyped;
  if (v.na == null) { $("m-out").innerHTML = '<div class="muted">Enter at least the serum sodium.</div>'; $("msum").textContent = ""; return; }
  const vol = $("volume").value, diuretic = $("m-diur").checked;
  const c = R.cause({ na: v.na, glu: v.glu, sosm: v.sosm, uosm: v.uosm, una: v.una, volume: vol, diuretic, ckd: $("m-ckd").checked });
  const sd = R.siad({ na: v.na, glu: v.glu, sosm: v.sosm, uosm: v.uosm, una: v.una, volume: vol, diuretic, urea: v.urea, uric: v.suric,
    tsh: state.f ? (C.latest(state.f.s.tsh, 90 * DAY) || {}).v : null, cortisol: state.f ? (C.latest(state.f.s.cort, 90 * DAY) || {}).v : null });
  const lines = R.interpret(Object.assign({ diuretic }, v));
  const tag = (k) => (src[k] === "chart" ? ' <span class="muted">(chart)</span>' : "");
  const KEY = { "Serum sodium": "na", "Serum osmolality": "sosm", "Urine osmolality": "uosm", "Urine sodium": "una" };
  $("msum").textContent = LABEL[c.label] || "";
  const cls = c.label === "incomplete" || /highuna|lowvol/.test(c.label) ? "t2" : c.label === "lowuosm" || c.label === "hyperglycemia" || c.label === "nonhypotonic" ? "t3" : "t1";
  const chip = (s) => `<span class="chip c-${s === true ? "yes" : s === false ? "no" : "unknown"}">${s === true ? "Met" : s === false ? "Not met" : "Unknown"}</span>`;
  const next = [];
  if (c.missing.length) next.push("Send: " + c.missing.map((k) => ({ sosm: "serum osmolality", uosm: "urine osmolality", una: "urine sodium (with urine potassium and creatinine)" }[k])).join(", ") + ".");
  if (!vol && !/hyperglycemia|nonhypotonic|lowuosm/.test(c.label)) next.push("Choose volume status: it decides between the causes listed.");
  if (diuretic && /siad|highuna|diuretic|renalloss/.test(c.label) && R.fe(v.uuric, v.suric, v.ucr, v.scr) == null) next.push("On a diuretic: urine sodium cannot separate SIAD from diuretic effect. Add serum and urine uric acid and creatinine (More, below) for the fractional excretion of urate.");
  if (/siad|highuna|renalloss/.test(c.label)) next.push("Before calling it SIAD: TSH and morning cortisol; review drugs, pain, nausea, lung and brain causes.");
  $("m-out").innerHTML =
    `<div class="verdict ${cls}"><div class="k" style="font-size:12px;text-transform:uppercase;opacity:.8">Most likely</div><div class="big">${esc(LABEL[c.label] || "–")}</div>` +
    (c.likely.length ? `<div>${esc(c.likely.join("; "))}.</div>` : "") + (c.warn ? `<div style="margin-top:4px"><b>${esc(c.warn)}</b></div>` : "") + `</div>` +
    (next.length ? `<div class="alert action"><b>Next</b>${ul(next.map(esc))}</div>` : "") +
    `<h3 style="font-size:14px;margin:12px 0 4px">What each value means</h3><div class="scroll"><table>` +
    lines.map((l) => `<tr><td>${esc(l.k)}${KEY[l.k] ? tag(KEY[l.k]) : ""}</td><td class="num lv-${l.level}">${esc(l.v)}</td><td class="wrap">${esc(l.text)}</td></tr>`).join("") + `</table></div>` +
    `<h3 style="font-size:14px;margin:12px 0 4px">Steps</h3><ol style="margin:4px 0 4px 18px;padding:0">${c.steps.map((s) => "<li>" + esc(s) + "</li>").join("")}</ol>` +
    `<h3 style="font-size:14px;margin:12px 0 4px">Typical patterns <span class="muted" style="font-weight:400">(highlighted: matches these values)</span></h3><div class="scroll"><table><tr><th>Cause</th><th>Serum osm</th><th>Urine osm</th><th>Urine Na</th><th>Volume</th></tr>` +
    PATTERNS.map((p) => `<tr class="${p.labels.includes(c.label) && (!vol || p.vol === "any" || p.vol === { hypo: "low", eu: "normal", hyper: "high" }[vol]) ? "match" : ""}"><td class="wrap">${esc(p.h)}</td><td>${p.s}</td><td>${p.u}</td><td class="wrap">${p.n}</td><td>${p.vol}</td></tr>`).join("") + `</table></div>` +
    `<h3 style="font-size:14px;margin:12px 0 4px">SIAD criteria</h3><div class="scroll"><table>${sd.criteria.map((i) => `<tr><td class="wrap">${esc(i.label)}</td><td>${chip(i.state)}</td><td class="muted">${esc(i.value)}</td></tr>`).join("")}</table></div>` +
    `<div style="margin-top:6px">${sd.met ? "<b>All essential SIAD criteria met.</b>" : sd.failed ? "At least one essential criterion is not met: SIAD less likely." : "Not all criteria known yet."}${sd.support.length ? " Supporting: " + esc(sd.support.join("; ")) + "." : ""}</div>`;
}

function ctx() {
  const f = state.f, now = Date.now(), x = {};
  x.now = now;
  x.na = f.na.filter((e) => $("usegas").checked || e.src !== "gas");
  x.last = x.na[x.na.length - 1] || null;
  const L = (id, days) => C.latest(f.s[id], days * DAY, now), U = (id, days) => C.latest(f.u[id], days * DAY, now);
  x.glu = L("glu", 1); x.urea = L("urea", 3); x.creat = L("creat", 3); x.k = L("k", 2); x.sosm = L("sosm", 7); x.tsh = L("tsh", 90); x.cort = L("cort", 90); x.uric = L("uric", 14);
  x.tg = L("tg", 90); x.prot = L("prot", 14); x.mg = L("mg", 3); x.phos = L("phos", 3);
  x.uosm = U("uosm", 7); x.una = U("una", 7); x.uk = U("uk", 7);
  // values typed in the cause helper replace the chart value (sodium only for the cause, never the trend)
  const T = typed(), typedE = (v) => ({ v, t: now, src: "typed" });
  ["sosm", "glu", "urea", "uosm", "una", "uk"].forEach((k) => { if (T[k] != null) x[k] = typedE(T[k]); });
  if (T.scr != null) x.creat = typedE(T.scr);
  if (T.suric != null) x.uric = typedE(T.suric);
  x.causeNa = T.na != null ? T.na : x.last ? x.last.v : null;
  x.wt = parseFloat($("wt").value); if (!isFinite(x.wt)) x.wt = null;
  x.sex = f.sex; x.age = f.age;
  x.water = R.tbw(x.wt, f.age, f.sex);
  x.high = RISKS.some(([k]) => state.risk[k]);
  x.lim = R.limits(x.high);
  x.st = x.na.length ? R.status(x.na.filter((e) => now - e.t <= 7 * DAY), x.lim, now) : null;
  x.onsetAuto = R.onset(x.na);
  x.acute = $("onset").value === "acute" || ($("onset").value === "auto" && x.onsetAuto === "acute");
  const rec = (cat, days) => C.recent(f, cat, days, now);
  x.diuretic = $("m-diur").checked;
  x.meds = {
    hypotonic: C.names(rec("hypotonic", 1)), isotonic: C.names(rec("isotonic", 1)), hypertonic: C.names(rec("hypertonic", 1)),
    culprits: [], salttab: C.names(rec("salttab", 1)), urea: C.names(rec("urea", 1)), tolvaptan: C.names(rec("tolvaptan", 2)), desmo: C.names(rec("desmo", 2)), steroid: C.names(rec("steroid", 2)), kcl: C.names(rec("kcl", 1)) };
  const CUL = { thiazide: "Thiazide", ssri: "SSRI / SNRI", tca: "Tricyclic", mirtaz: "Mirtazapine / trazodone", aed: "Antiepileptic", antipsych: "Antipsychotic", ppi: "PPI (rare)", opioid: "Opioid", nsaid: "NSAID", chemo: "Chemotherapy", tmp: "Trimethoprim", amio: "Amiodarone", sulfonylurea: "Chlorpropamide", oxytocin: "Oxytocin" };
  Object.keys(CUL).forEach((k) => { const n = C.names(rec(k, 3)); if (n.length) x.meds.culprits.push(n.join(", ") + " (" + CUL[k] + ")"); });
  x.cause = x.last ? R.cause({ na: x.causeNa, glu: x.glu && x.glu.v, sosm: x.sosm && x.sosm.v, uosm: x.uosm && x.uosm.v, una: x.una && x.una.v, volume: $("volume").value, diuretic: x.diuretic, ckd: $("m-ckd").checked }) : null;
  x.furst = x.last && x.una && x.uk ? R.furst(x.una.v, x.uk.v, x.causeNa) : null;
  x.siad = x.last ? R.siad({ na: x.causeNa, glu: x.glu && x.glu.v, sosm: x.sosm && x.sosm.v, uosm: x.uosm && x.uosm.v, una: x.una && x.una.v, volume: $("volume").value, diuretic: x.diuretic,
    tsh: x.tsh && x.tsh.v, cortisol: x.cort && x.cort.v, uric: x.uric && Math.round(x.uric.v * 100) / 100, urea: x.urea && r1(x.urea.v) }) : null;
  // urine output over the last 3 h
  const uo = f.uo.filter((e) => now - e.t <= 3 * HR);
  x.uoRate = uo.length >= 2 ? uo.reduce((s, e) => s + e.v, 0) / Math.max(1, (now - uo[0].t) / HR + 1) : null;
  return x;
}

function tile(cls, k, big, s) { return `<div class="tile ${cls}"><div class="k">${esc(k)}</div><div class="big">${big}</div><div class="s">${s || ""}</div></div>`; }

function draw() {
  const f = state.f;
  drawManual();
  if (!f) { ["tiles", "alerts", "spark", "trend", "plan", "tests", "steps", "siad", "meds", "calc", "hints", "riskrow"].forEach((id) => ($(id).innerHTML = "")); ["alertsum", "trendsum", "plansum", "causesum", "ptsum"].forEach((id) => ($(id).textContent = "")); $("alerts").innerHTML = '<div class="muted">No patient loaded.</div>'; HYPO_NOTE.update(); return; }
  const x = ctx();
  drawRisk(x);
  if (!x.last) { $("tiles").innerHTML = ""; $("alerts").innerHTML = '<div class="muted">No sodium found in the past 14 days.</div>'; HYPO_NOTE.update(); return; }
  drawTiles(x); drawAlerts(x); drawTrend(x); drawPlan(x); drawWorkup(x); drawCalc(x);
  HYPO_NOTE.update();
}

function drawRisk(x) {
  $("riskrow").innerHTML = "<b>High risk of osmotic demyelination:</b> " + RISKS.map(([k, l]) => `<label class="inl"><input type="checkbox" data-risk="${k}"${state.risk[k] ? " checked" : ""}> ${esc(l)}${state.auto[k] ? ' <span class="muted">(chart)</span>' : ""}</label>`).join(" ") +
    ` <span class="muted">→ limit ${x.lim.l24} per 24 h</span>`;
  document.querySelectorAll("[data-risk]").forEach((cb) => (cb.onchange = () => { state.risk[cb.dataset.risk] = cb.checked; draw(); }));
  const h = [], p = state.f.prob;
  if (p.hf || p.cirrhosis || p.nephrotic) h.push("Problem list suggests possible high volume: " + [].concat(p.hf || [], p.cirrhosis || [], p.nephrotic || []).slice(0, 3).join("; "));
  if (p.gi) h.push("Problem list suggests possible fluid loss: " + p.gi.slice(0, 2).join("; "));
  if (x.onsetAuto === "acute") h.push("A sodium of 135 or more was recorded within 48 h before the low value: may be acute.");
  $("hints").innerHTML = h.length ? "<b>From the chart (check, then choose above):</b><br>" + h.map(esc).join("<br>") : "";
}

function drawTiles(x) {
  const n = x.last, sev = R.severity(n.v), cna = x.glu ? R.glucoseCorrected(n.v, x.glu.v) : n.v, t = [];
  t.push(tile({ none: "t0", mild: "t1", moderate: "t2", profound: "t3" }[sev], "Sodium now", n.v + (n.src === "gas" ? " <span style='font-size:13px'>(gas)</span>" : ""),
    ago(n.t) + (x.glu && x.glu.v > 10 ? ` · corrected for glucose ${r1(cna)}` : "") + (sev !== "none" ? " · " + (sev === "profound" ? "profound (below 125)" : sev) : "")));
  const st = x.st;
  if (st) {
    t.push(tile(st.over ? "t3" : st.near ? "t2" : st.slow ? "t2" : "t0", "Change in 24 h", sgn(st.rs.rise24), `Limit ${x.lim.l24} per 24 h${st.rs.rise48 > st.rs.rise24 ? " · " + sgn(st.rs.rise48) + " in 48 h (limit " + x.lim.l48 + ")" : ""}` + (st.rt ? ` · now ${sgn(st.rt.perH)}/h` : "")));
    t.push(st.c ? tile(st.over ? "t3" : st.near ? "t2" : "t1", "Highest allowed now", st.c.v, `Set by ${st.c.from.v} at ${fmtDT(st.c.from.t)} (${st.c.win} h limit), until ${fmtDT(st.c.until)}`) : tile("", "Highest allowed now", "–", ""));
  }
  const cl = x.cause ? x.cause.label : "";
  t.push(tile(cl === "incomplete" ? "t2" : "t1", "Likely cause", "<span style='font-size:17px'>" + esc(LABEL[cl] || "–") + "</span>", x.cause && x.cause.likely.length ? esc(x.cause.likely.slice(0, 3).join("; ")) : ""));
  $("tiles").innerHTML = t.join("");
}

function drawAlerts(x) {
  const a = [], st = x.st, m = x.meds;
  if (st && st.over) a.push(["urgent", `Overcorrection: up ${r1(st.rs.rise24)} in 24 h${st.rs.rise48 > x.lim.l48 ? " / " + r1(st.rs.rise48) + " in 48 h" : ""} (limit ${x.lim.l24} / ${x.lim.l48}).`, "See the plan: stop sodium sources, desmopressin, D5W."]);
  else if (st && st.near) a.push(["action", `Close to the ceiling: ${r1(st.room)} mmol/L left before ${st.c.v}` + (st.hoursToCeiling != null ? `, reached in about ${r1(st.hoursToCeiling)} h at the current rate.` : "."), $("symptoms").value === "severe" ? "Severe symptoms: give only what relieves them, then stop." : "Slow down and recheck in 2 h."]);
  if (x.uoRate != null && x.uoRate > 100) a.push(["action", `Urine output about ${Math.round(x.uoRate)} mL/h over the last 3 h.`, "A water diuresis can raise sodium fast: check sodium now."]);
  if (x.last.v < 125 && Date.now() - x.last.t > 8 * HR) a.push(["action", `Last sodium was ${ago(x.last.t)} and below 125.`, "Recheck sodium."]);
  if (m.hypotonic.length && !(st && st.over)) a.push(["action", "Hypotonic fluid ordered or given: " + m.hypotonic.join(", ") + ".", "Stop it unless treating overcorrection."]);
  if (m.isotonic.length && x.uosm && x.uosm.v > 530 && $("volume").value !== "hypo") a.push(["action", `0.9% saline or similar running with urine osmolality ${Math.round(x.uosm.v)}.`, "With urine more concentrated than saline, saline can lower the sodium (SIAD)."]);
  if (m.tolvaptan.length && (state.risk.liver || x.high)) a.push(["urgent", "Tolvaptan with liver disease or high demyelination risk.", "Usually avoided: review."]);
  if (m.tolvaptan.length && (m.hypertonic.length || m.salttab.length || m.urea.length)) a.push(["action", "Tolvaptan with another sodium-raising treatment.", "Combined treatments raise the risk of overcorrection."]);
  if (m.culprits.length) a.push(["info", "Drugs that can cause hyponatremia: " + m.culprits.join("; ") + ".", ""]);
  if (m.steroid.length && x.cause && /siad|highuna|renalloss|incomplete/.test(x.cause.label) && !x.cort) a.push(["info", "On a steroid and no cortisol on record.", "Cortisol is hard to interpret on steroids; steroids can also make sodium rise quickly."]);
  if (x.k && x.k.v < 3.5) a.push(["info", `Potassium ${x.k.v}.`, "Replacing potassium also raises sodium: count it in the daily rise."]);
  if (x.cause && x.cause.missing.length) a.push(["info", "Missing for the workup: " + x.cause.missing.map((k) => ({ sosm: "serum osmolality", uosm: "urine osmolality", una: "urine sodium" }[k])).join(", ") + ".", "Send before treatment if safe."]);
  const gas = x.na.filter((e) => e.src === "gas" && Date.now() - e.t <= 2 * DAY).length, labn = x.na.filter((e) => e.src === "lab" && Date.now() - e.t <= 2 * DAY).length;
  if (gas && labn) a.push(["info", "Trend mixes blood gas and lab sodium.", "They can differ by 2-4 mmol/L: untick blood gas sodium above to compare like with like."]);
  if (st && st.slow) a.push(["info", `Rise only ${r1(st.rs.rise24)} in 24 h (goal ${x.lim.tLo}-${x.lim.tHi}).`, "Review the plan."]);
  $("alertsum").textContent = a.length ? a.length + " item" + (a.length > 1 ? "s" : "") : "none";
  $("alerts").innerHTML = a.length ? a.map(([l, t, s]) => `<div class="alert ${l}"><b>${l === "urgent" ? "Urgent" : l === "action" ? "Action" : "Note"}</b>${esc(t)}${s ? '<div class="muted">' + esc(s) + "</div>" : ""}</div>`).join("") : '<div class="muted">Nothing flagged.</div>';
}

function drawTrend(x) {
  const now = Date.now(), pts = x.na.filter((e) => now - e.t <= 7 * DAY), st = x.st;
  $("trendsum").textContent = pts.length + " sodium value" + (pts.length === 1 ? "" : "s") + " in 7 days";
  const rows = [...pts].reverse().slice(0, 24).map((e) => {
    const lo = pts.filter((p) => p.t >= e.t - DAY && p.t <= e.t).reduce((m, p) => Math.min(m, p.v), e.v), d = e.v - lo;
    return `<tr><td>${fmtDT(e.t)}</td><td class="num"><b>${e.v}</b></td><td>${e.src === "gas" ? "blood gas" : "lab"}</td><td class="num ${d > x.lim.l24 ? "hi" : ""}">${d ? "+" + r1(d) : "0"}</td><td class="muted">${d > x.lim.l24 ? "over the 24 h limit" : ""}</td></tr>`;
  });
  $("trend").innerHTML = `<table><tr><th>Time</th><th>Na</th><th>Source</th><th>Rise from lowest in prior 24 h</th><th></th></tr>${rows.join("")}</table>`;
  if (pts.length < 2) { $("spark").innerHTML = ""; return; }
  const W = 640, Hh = 150, t0 = pts[0].t, t1 = Math.max(now, pts[pts.length - 1].t), ceil = st && st.c ? st.c.v : null;
  const vals = pts.map((p) => p.v).concat(ceil ? [ceil] : []), lo = Math.min(...vals) - 2, hi = Math.max(...vals) + 2;
  const X = (t) => 36 + ((t - t0) / Math.max(1, t1 - t0)) * (W - 50), Y = (v) => Hh - 20 - ((v - lo) / (hi - lo)) * (Hh - 34);
  const path = pts.map((p, i) => (i ? "L" : "M") + X(p.t).toFixed(1) + " " + Y(p.v).toFixed(1)).join(" ");
  const ticks = []; for (let v = Math.ceil(lo / 5) * 5; v <= hi; v += 5) ticks.push(`<line x1="36" x2="${W - 14}" y1="${Y(v)}" y2="${Y(v)}" stroke="currentColor" stroke-opacity=".08"/><text x="0" y="${Y(v) + 4}">${v}</text>`);
  $("spark").innerHTML = `<svg viewBox="0 0 ${W} ${Hh}" width="100%" style="max-width:${W}px" role="img" aria-label="Sodium trend">${ticks.join("")}
    ${ceil ? `<line x1="36" x2="${W - 14}" y1="${Y(ceil)}" y2="${Y(ceil)}" stroke="var(--r-ink)" stroke-dasharray="5 4"/><text x="${W - 14}" y="${Y(ceil) - 4}" text-anchor="end" style="fill:var(--r-ink)">ceiling ${ceil}</text>` : ""}
    <path d="${path}" fill="none" stroke="var(--accent)" stroke-width="2"/>
    ${pts.map((p) => `<circle cx="${X(p.t)}" cy="${Y(p.v)}" r="${p.src === "gas" ? 3 : 3.5}" fill="${p.src === "gas" ? "var(--card)" : "var(--accent)"}" stroke="var(--accent)" stroke-width="1.5"><title>${fmtDT(p.t)}: ${p.v} (${p.src})</title></circle>`).join("")}
    <text x="36" y="${Hh - 4}">${fmtDT(t0)}</text><text x="${W - 14}" y="${Hh - 4}" text-anchor="end">now</text></svg>
    <div class="muted">Filled dots = lab; open dots = blood gas. Dashed line = highest sodium allowed now.</div>`;
}

function drawPlan(x) {
  const sym = $("symptoms").value;
  const blocks = R.plan({ lim: x.lim, st: x.st, wt: x.wt, water: x.water, na: x.last.v, symptoms: sym || "none", acute: x.acute, highRisk: x.high, meds: x.meds,
    causeLabel: x.cause ? x.cause.label : "", bolusesGiven: state.f.meds.filter((m) => m.given && m.cats.includes("hypertonic") && Date.now() - m.t <= 6 * HR).length, volume: $("volume").value, furst: x.furst, uosm: x.uosm && x.uosm.v, liver: !!state.risk.liver, alcohol: !!state.risk.alcohol, hypoK: x.k && x.k.v < 3.5 });
  $("plansum").textContent = blocks.length ? blocks[0].h : "";
  $("plan").innerHTML = (sym ? "" : '<div class="alert info"><b>Note</b>Symptoms not assessed: the plan assumes none or mild. Choose symptoms above.</div>') +
    blocks.map((b) => `<div class="${b.level}"><h3>${esc(b.h)}</h3>${ul(b.items.map(esc))}</div>`).join("") +
    (x.cause && x.cause.warn ? `<div class="alert action"><b>Note</b>${esc(x.cause.warn)}</div>` : "");
}

function drawWorkup(x) {
  const T = [["Serum osmolality", x.sosm, "mOsm/kg", "Confirms hypotonic hyponatremia"], ["Glucose", x.glu, "mmol/L", "High glucose lowers sodium"], ["Urea", x.urea, "mmol/L", ""], ["Creatinine", x.creat, "umol/L", ""], ["Potassium", x.k, "mmol/L", "Low K: higher demyelination risk"],
    ["Urine osmolality", x.uosm, "mOsm/kg", "Is ADH on?"], ["Urine sodium", x.una, "mmol/L", "Volume vs SIAD / salt loss"], ["Urine potassium", x.uk, "mmol/L", "With urine Na: fluid restriction plan"],
    ["TSH", x.tsh, "mU/L", "Hypothyroidism"], ["Cortisol", x.cort, "nmol/L", "Adrenal insufficiency (morning sample)"], ["Uric acid", x.uric, "mmol/L", "Low in SIAD"], ["Triglycerides", x.tg, "mmol/L", "Very high: pseudohyponatremia"], ["Total protein", x.prot, "g/L", "Very high: pseudohyponatremia"]];
  const fmt = (e, id) => (id === "Uric acid" ? (Math.round(e.v * 100) / 100) : r1(e.v));
  $("tests").innerHTML = `<table><tr><th>Test</th><th>Latest</th><th>When</th><th>Why</th></tr>` + T.map(([n, e, u, why]) => e ? `<tr><td>${n}</td><td class="num">${fmt(e, n)} ${u}</td><td>${e.src === "typed" ? "typed in" : fmtDT(e.t)}</td><td class="muted wrap">${why}</td></tr>`
    : `<tr><td>${n}</td><td class="old" colspan="2">Not found</td><td class="muted wrap">${why}</td></tr>`).join("") + "</table>" +
    (x.sosm && x.last ? `<div class="muted" style="margin-top:6px">Calculated osmolality ${Math.round(R.calcOsm(x.causeNa, x.glu && x.glu.v, x.urea && x.urea.v))}; osmolal gap ${Math.round(x.sosm.v - R.calcOsm(x.causeNa, x.glu && x.glu.v, x.urea && x.urea.v))} (above 10: unmeasured osmoles or pseudohyponatremia).</div>` : "");
  const c = x.cause;
  $("causesum").textContent = c ? LABEL[c.label] || "" : "";
  $("steps").innerHTML = c ? "<ol style='margin:4px 0 4px 18px;padding:0'>" + c.steps.map((s) => "<li>" + esc(s) + "</li>").join("") + "</ol>" + (c.likely.length ? "<b>Consider:</b> " + esc(c.likely.join("; ")) + "." : "") : "";
  const sd = x.siad, chip = (s) => `<span class="chip c-${s === true ? "yes" : s === false ? "no" : "unknown"}">${s === true ? "Met" : s === false ? "Not met" : "Unknown"}</span>`;
  $("siad").innerHTML = sd ? `<table>${sd.criteria.map((i) => `<tr><td class="wrap">${esc(i.label)}</td><td>${chip(i.state)}</td><td class="muted">${esc(i.value)}</td></tr>`).join("")}</table>
    <div style="margin-top:6px">${sd.met ? "<b>All essential SIAD criteria met.</b>" : sd.failed ? "At least one essential criterion is not met: SIAD less likely." : "Not all criteria known yet."}${sd.support.length ? " Supporting: " + esc(sd.support.join("; ")) + "." : ""}</div>` : "";
  const m = x.meds, list = [];
  if (m.culprits.length) list.push("<b>May cause hyponatremia:</b> " + esc(m.culprits.join("; ")));
  if (m.hypotonic.length) list.push("<b>Hypotonic fluids:</b> " + esc(m.hypotonic.join(", ")));
  if (m.isotonic.length) list.push("<b>Isotonic fluids:</b> " + esc(m.isotonic.join(", ")));
  const tx = [].concat(m.hypertonic, m.salttab, m.urea, m.tolvaptan, m.desmo);
  if (tx.length) list.push("<b>Sodium treatments / desmopressin:</b> " + esc(tx.join(", ")));
  if (m.steroid.length) list.push("<b>Steroids:</b> " + esc(m.steroid.join(", ")));
  $("meds").innerHTML = list.length ? ul(list) : '<div class="muted">No relevant medications or IV fluids found (ordered now or given in the past 1-3 days).</div>';
}

function drawCalc(x) {
  const sel = $("c-fluid");
  if (!sel.options.length) { R.FLUIDS.forEach((fl) => { const o = document.createElement("option"); o.value = fl.id; o.textContent = fl.label + " (Na " + fl.na + ")"; sel.appendChild(o); }); }
  const fl = R.FLUIDS.find((q) => q.id === sel.value) || R.FLUIDS[0], vol = parseFloat($("c-vol").value) || 0, k = parseFloat($("c-k").value) || 0;
  if (!x.water) { $("calc").innerHTML = '<div class="muted">Enter a weight above to estimate total body water.</div>'; $("calcsum").textContent = ""; return; }
  const per = R.adrogue(x.last.v, fl.na, fl.k + k, x.water), d = per * vol / 1000;
  const room = x.st && x.st.c ? x.st.c.v - x.last.v : null;
  $("calcsum").textContent = `${vol} mL ${fl.label}: ${sgn(d)} mmol/L`;
  $("calc").innerHTML = `<div class="row"><b>Estimated change: ${sgn(d)} mmol/L</b> (sodium ${x.last.v} → about ${r1(x.last.v + d)})</div>
    <div class="muted">Total body water ${r1(x.water)} L (${x.wt} kg × ${r1(x.water / x.wt * 100) / 100}, ${x.sex || "sex unknown"}, ${x.age != null ? x.age + " y" : "age unknown"}). Per litre: ${sgn(per)} mmol/L.` +
    (room != null && per > 0 ? ` Volume that would reach the ceiling (${x.st.c.v}): about ${Math.round(room / per * 1000)} mL.` : "") + "</div>";
}

function load(raw, note, errors, preset) {
  state.f = raw ? C.parse(raw) : null; preset = preset || {};
  $("symptoms").value = preset.symptoms || ""; $("volume").value = preset.volume || ""; $("onset").value = "auto"; $("usegas").checked = true;
  state.risk = {}; state.auto = {};
  if (state.f) {
    const f = state.f, now = Date.now(), k = C.latest(f.s.k, 2 * DAY, now);
    state.auto = { na105: f.na.some((e) => now - e.t <= 7 * DAY && e.v <= 105), hypoK: !!(k && k.v < 3.5), alcohol: !!f.prob.alcohol, malnut: !!f.prob.malnutrition, liver: !!f.prob.cirrhosis };
    state.risk = Object.assign({}, state.auto);
    $("m-diur").checked = C.recent(f, "thiazide", 7, now).length + C.recent(f, "loop", 7, now).length > 0; $("m-ckd").checked = !!f.prob.ckd;
    const w = f.weights[f.weights.length - 1]; $("wt").value = w ? r1(w.v) : "";
    $("ptsum").textContent = [f.sex, f.age != null ? f.age + " y" : ""].filter(Boolean).join(", ");
  } else { $("wt").value = ""; $("ptsum").textContent = ""; $("m-diur").checked = false; $("m-ckd").checked = false; }
  $("m-volume").value = $("volume").value;
  $("pstatus").textContent = note; $("clear").hidden = !raw;
  $("errs").innerHTML = errors && errors.length ? "Could not read: " + errors.map(esc).join("; ") + ". Check the scopes in the Code Console." : "";
  draw(); HYPO_NOTE.reset();
}
["symptoms", "onset", "volume", "usegas", "c-fluid"].forEach((id) => ($(id).onchange = draw));
["wt", "c-vol", "c-k"].forEach((id) => ($(id).oninput = draw));
MF.forEach((k) => ($("m-" + k).oninput = draw));
["m-diur", "m-ckd"].forEach((id) => ($(id).onchange = draw));
// one volume status: the helper's box and the one above stay in step
$("m-volume").onchange = () => { $("volume").value = $("m-volume").value; draw(); };
$("volume").addEventListener("change", () => ($("m-volume").value = $("volume").value));
$("m-clear").onclick = () => { MF.forEach((k) => ($("m-" + k).value = "")); draw(); };
$("clear").onclick = () => { $("testsel").value = ""; load(null, "Open from Cerner to read the chart, or pick a made-up patient:"); };
const SAMPLES = window.HYPO_SAMPLES || [];
SAMPLES.forEach((p, i) => { const o = document.createElement("option"); o.value = i; o.textContent = p.label; $("testsel").appendChild(o); });
$("testsel").onchange = () => { const p = SAMPLES[$("testsel").value]; if (!p) return $("clear").onclick(); load(p.build(Date.now()), "Made-up patient: " + p.label, [], p); };

async function fromChart() {
  if (typeof FHIR === "undefined" || !(location.search.includes("code=") || location.search.includes("complete=") || sessionStorage.getItem("SMART_KEY"))) return;
  $("pstatus").textContent = "Reading the chart…";
  try {
    const client = await FHIR.oauth2.ready();
    const { raw, errors } = await C.gather(client, (msg) => ($("pstatus").textContent = msg));
    load(raw, "Chart read (read-only). Nothing is sent anywhere. Choose symptoms and volume status above.", errors);
  } catch (e) { $("pstatus").textContent = "Could not read the chart: " + (e && e.message ? e.message : e) + ". The made-up patients still work."; }
}
draw(); fromChart();
