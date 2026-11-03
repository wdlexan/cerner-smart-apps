/* Consult summary page. Read-only from the chart; nothing is sent from here (clipboard + Teams deep link only). UNVERIFIED draft. */
const R = window.ConsultRules, C = window.ConsultChart, LS = window.LiverScores, DAY = C.DAY, HR = 36e5;
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const fmtDT = (t) => new Date(t).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
const hm = (t) => new Date(t).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
const rd = R.rd;
const state = { f: null, sample: false, pid: null };
const store = { get: (k) => { try { return localStorage.getItem(k) || ""; } catch (e) { return ""; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} } };
const DEFAULT_CALLBACK = "Dr. Wayne A Dong 250-819-0168";

/* ---------- facts for the message ---------- */
function facts() {
  const f = state.f, now = Date.now(), spec = $("spec").value, S = R.SPECIALTIES[spec];
  const L = (id, days) => C.latest(f.labs[id], (days || 3) * DAY, now);
  const val = (id, days) => { const e = L(id, days); return e ? (["mg", "phos", "ca"].includes(id) ? Math.round(e.v * 100) / 100 : rd(e.v)) : null; };
  const lines = [], fullLines = [];
  const join = (pairs) => pairs.filter(([, v]) => v != null && v !== "").map(([k, v]) => k + " " + v).join(", ");
  const tr = (id, days, n) => R.trend(f.labs[id], now, days || 3, n || 4);
  const rbc48 = f.meds.filter((m) => m.given && m.cats.includes("rbc") && now - m.t <= 2 * DAY).length;
  const v = [...f.vit].reverse(), lastV = (k) => { const r = v.find((x) => x[k] != null && now - x.t <= DAY); return r ? r[k] : null; };
  const vitals = { hr: lastV("hr"), sbp: lastV("sbp"), dbp: lastV("dbp"), rr: lastV("rr"), spo2: lastV("spo2"), temp: lastV("temp") };
  let gbs = null, kd = null, meld = null;

  if (spec === "gi") {
    const h = tr("hgb"); if (h) lines.push("Hgb " + h + (rbc48 ? ` (${rbc48} unit${rbc48 > 1 ? "s" : ""} RBC in 48 h)` : ""));
    const a = join([["INR", val("inr")], ["plt", val("plt")], ["urea", val("urea")], ["Cr", val("cr")]]); if (a) lines.push(a);
    const b = join([["albumin", val("alb")], ["bili", val("bili")], ["ALT", val("alt")], ["ALP", val("alp")], ["lipase", val("lipase")]]); if (b) lines.push(b);
    const hg = L("hgb"), ur = L("urea");
    gbs = R.gbs({ urea: ur && ur.v, hgb: hg && hg.v, sbp: vitals.sbp, hr: vitals.hr, sex: f.sex, melena: $("melena").checked, syncope: $("syncope").checked, liver: !!f.prob.liver, hf: !!f.prob.hf });
    if (gbs) lines.push("Glasgow-Blatchford " + gbs.score + (gbs.low ? " (low risk)" : ""));
  } else if (spec === "renal") {
    kd = R.kdigo(f.labs.cr.filter((e) => now - e.t <= 120 * DAY));
    const crt = tr("cr", 90, 4);
    if (crt) lines.push("Cr " + crt + (kd ? ` (baseline ${rd(kd.base)}; ${kd.stage ? "KDIGO stage " + kd.stage : "no AKI by KDIGO"})` : ""));
    const a = join([["K", val("k")], ["HCO3", val("hco3")], ["Na", val("na")], ["urea", val("urea")]]); if (a) lines.push(a);
    const u = [["urine Na", C.latest(f.u.una, 7 * DAY, now)], ["urine prot/Cr", C.latest(f.u.uprotcr, 7 * DAY, now)]].filter(([, e]) => e).map(([k, e]) => k + " " + e.shown.trim());
    if (u.length) lines.push(u.join(", ")); else lines.push("No urine studies in 7 days");
    const b = join([["Hgb", val("hgb")], ["Ca", val("ca", 7)], ["PO4", val("phos", 7)]]); if (b) fullLines.push(b);
  } else if (spec === "cardio") {
    const tp = f.labs.trop.filter((e) => now - e.t <= 3 * DAY);
    if (tp.length) lines.push((tp[tp.length - 1].hs ? "hs-troponin " : "troponin ") + tp.slice(-4).map((e) => rd(e.v)).join(" → ") + (tp[0].unit ? " " + tp[0].unit : "") + " (" + tp.slice(-4).map((e) => fmtDT(e.t)).join(", ") + ")");
    const a = join([["BNP/NT-proBNP", val("bnp", 7)], ["K", val("k")], ["Mg", val("mg")], ["Cr", val("cr")], ["Hgb", val("hgb")]]); if (a) lines.push(a);
    const t = val("tsh", 90); if (t != null) fullLines.push("TSH " + t);
  } else if (spec === "liver") {
    const bi = L("bili", 14), inr = L("inr", 14), cr = L("cr", 14), na = L("na", 14), al = L("alb", 14);
    if (LS && bi && inr && cr) { const m = LS.meld({ bili: bi.v, creat: cr.v, inr: inr.v, na: na && na.v }); if (m) meld = m; }
    if (meld) lines.push("MELD-Na " + (meld.meldNa != null ? meld.meldNa : "n/a") + " (MELD " + meld.meld + ")");
    const a = join([["bili", tr("bili", 14, 3)], ["INR", val("inr", 14)], ["Cr", tr("cr", 90, 3)], ["Na", val("na", 14)]]); if (a) lines.push(a);
    const b = join([["albumin", val("alb", 14)], ["plt", val("plt", 14)], ["ALT", val("alt", 14)], ["AST", val("ast", 14)], ["ALP", val("alp", 14)]]); if (b) lines.push(b);
  } else {
    const a = join([["Hgb", val("hgb")], ["WBC", val("wbc")], ["plt", val("plt")]]); if (a) lines.push(a);
    const b = join([["Na", val("na")], ["K", val("k")], ["Cr", val("cr")], ["glucose", val("glu")], ["lactate", val("lactate")]]); if (b) lines.push(b);
  }
  // full version: all the short lines plus a time stamp for each lab used
  const usedIds = (S ? S.labs : []).map(([id]) => id).filter((id) => f.labs[id] && f.labs[id].length);
  const when = usedIds.map((id) => { const e = f.labs[id][f.labs[id].length - 1]; return C.LABS.find((d) => d.id === id).label + " " + fmtDT(e.t); });
  const full = lines.concat(fullLines, when.length ? ["Latest results drawn: " + when.join("; ")] : []);

  // meds
  const want = S ? S.meds : [];
  const pick = f.meds.filter((m) => m.active && m.cats.some((c) => want.includes(c)));
  const lastGive = (name) => { const g = f.meds.filter((m) => m.given && m.name.split(" ")[0].toLowerCase() === name.split(" ")[0].toLowerCase()).sort((a, b) => b.t - a.t)[0]; return g ? g.t : null; };
  const medStr = (m) => { const short = m.name.replace(/\s+(PO|IV|SC|SL|PR|IM)\b.*$/i, (s) => s.slice(0, 18)).slice(0, 48); const lg = lastGive(m.name); return short + (m.held ? " (held" + (lg ? ", last " + fmtDT(lg) : "") + ")" : ""); };
  const meds = [...new Set(pick.map(medStr))];
  const medsFull = [...new Set(f.meds.filter((m) => m.active).map(medStr))];

  const stampT = Math.max(...Object.values(f.labs).map((a) => (a.length ? a[a.length - 1].t : 0)), ...f.vit.map((r) => r.t), 0);
  return { lines, fullLines: full, vitals, meds, medsFull, stamp: stampT ? fmtDT(stampT) : "", gbs, kd, meld, rbc48 };
}

function linkFor() {
  if (!$("uselink").checked) return "";
  const base = new URL("../../launch-standalone.html", location.href).href;
  if (state.pid) return base + "?patient=" + encodeURIComponent(state.pid) + "&tab=consult";
  if (state.f && state.f.mrn) return base + "?mrn=" + encodeURIComponent(state.f.mrn) + "&tab=consult";
  return "";
}

function consultInput() {
  const f = state.f, x = facts(), spec = $("spec").value;
  const day = f.enc ? Math.floor((Date.now() - f.enc.start) / DAY) + 1 : null;
  return { spec, specName: $("specname").value.trim(), urgency: $("urgency").value, question: $("question").value.trim(), done: $("done").value.trim(), findings: $("findings").value.trim(), callback: $("callback").value.trim(),
    code: $("code").value, who: { age: f.age, sex: f.sex, initials: $("fullname").checked ? f.name : R.initials(f.name), mrn: $("mrn").checked ? f.mrn : "", location: $("loc").value.trim(), day, reason: $("reason").value.trim() },
    vitals: x.vitals, lines: x.lines, fullLines: x.fullLines, meds: x.meds, medsFull: x.medsFull, problems: f.problems.slice(0, 8), stamp: x.stamp, link: linkFor() };
}

/* ---------- two editable outputs ---------- */
function out(id, staleId, gen) {
  const st = { last: "", dirty: false }, ta = $(id), stale = $(staleId);
  ta.addEventListener("input", () => { st.dirty = ta.value !== st.last; });
  const update = (force) => { const g = gen(); if (st.dirty && !force) { if (g !== st.last) stale.hidden = false; return; } ta.value = g; st.last = g; st.dirty = false; stale.hidden = true; };
  return { update, reset: () => { st.dirty = false; update(true); } };
}
const T = out("teams", "t-stale", () => (state.f ? R.teams(consultInput()) : ""));
const F = out("full", "f-stale", () => (state.f ? R.full(consultInput()) : ""));
$("t-redo").onclick = () => T.reset(); $("f-redo").onclick = () => F.reset();

function draw() {
  $("specname").hidden = $("spec").value !== "general";
  $("girow").hidden = $("spec").value !== "gi";
  T.update(); F.update();
  const txt = $("teams").value;
  $("teamsum").textContent = state.f ? txt.split("\n").length + " lines, " + txt.length + " characters" + ($("question").value.trim() ? "" : " · add your question") : "";
}

async function copy(text, msgEl) {
  try { await navigator.clipboard.writeText(text); msgEl.textContent = "Copied."; return true; }
  catch (e) { msgEl.textContent = "Could not copy automatically: select the text and press Ctrl+C."; return false; }
}
$("t-copy").onclick = () => copy($("teams").value, $("t-msg"));
$("f-copy").onclick = () => copy($("full").value, $("f-msg"));
$("t-open").onclick = async () => {
  const text = $("teams").value; if (!text.trim()) return;
  if (!$("question").value.trim() && !/^Q: (?!\[your question\])/m.test(text)) { $("t-msg").textContent = "Add your question first."; $("question").focus(); return; }
  await copy(text, $("t-msg"));
  const to = $("to").value.trim(); store.set("consult-to-" + $("spec").value, to);
  const L = R.teamsLink(to, text);
  window.open(L ? L.url : "https://teams.microsoft.com/", "_blank", "noopener");
  $("t-msg").textContent = L ? (L.cut ? "Copied. The message was too long for the Teams link, so the chat opens with part of it: delete that and paste (Ctrl+V)." : "Copied and opening Teams: check the message, then send.") : "Copied. Teams is opening: pick the chat and paste (Ctrl+V).";
};

function prefillDone(f) {
  const now = Date.now(), d = [];
  const rbc = f.meds.filter((m) => m.given && m.cats.includes("rbc") && now - m.t <= 2 * DAY).length;
  if (rbc) d.push(rbc + " unit" + (rbc > 1 ? "s" : "") + " RBC (48 h)");
  const held = [...new Set(f.meds.filter((m) => m.held).map((m) => m.name.split(" ")[0]))]; if (held.length) d.push(held.join(", ") + " held");
  const inf = [...new Set(f.meds.filter((m) => m.active && /infusion|drip|mg\/h|mcg\/min/i.test(m.name)).map((m) => m.name.replace(/\s+\d.*$/, "")))]; if (inf.length) d.push(inf.join(", ") + " infusion");
  const abx = [...new Set(f.meds.filter((m) => m.active && m.cats.includes("abx")).map((m) => m.name.split(" ")[0]))]; if (abx.length) d.push("on " + abx.join(", "));
  return d.join("; ");
}

function load(raw, note, errors, sample, pid) {
  state.f = raw ? C.parse(raw) : null; state.sample = !!sample; state.pid = pid || null;
  const f = state.f, s = sample || {};
  if (s.spec) $("spec").value = s.spec;
  $("urgency").value = s.urgency || "urgent"; $("question").value = s.question || ""; $("findings").value = s.findings || "";
  $("melena").checked = !!(s.preset && s.preset.melena); $("syncope").checked = false;
  $("loc").value = f && f.enc ? f.enc.location : ""; $("reason").value = f ? (f.enc && f.enc.reason) || "" : ""; $("code").value = "";
  $("done").value = f ? prefillDone(f) : "";
  $("to").value = store.get("consult-to-" + $("spec").value);
  $("ptsum").textContent = f ? [f.name ? R.initials(f.name) : "", f.age != null ? f.age + " y" : "", f.sex, f.mrn ? "MRN " + f.mrn : ""].filter(Boolean).join(", ") : "";
  $("pstatus").textContent = note; $("clear").hidden = !raw;
  $("errs").innerHTML = errors && errors.length ? "Could not read: " + errors.map(esc).join("; ") + ". Check the scopes in the Code Console." : "";
  $("t-msg").textContent = ""; $("f-msg").textContent = "";
  T.reset(); F.reset(); draw();
}

["spec", "urgency", "code", "fullname", "mrn", "uselink", "melena", "syncope"].forEach((id) => ($(id).onchange = () => { if (id === "spec") $("to").value = store.get("consult-to-" + $("spec").value); draw(); }));
["question", "loc", "reason", "findings", "done", "specname"].forEach((id) => ($(id).oninput = draw));
$("callback").oninput = () => { store.set("consult-callback", $("callback").value); draw(); };
$("callback").value = store.get("consult-callback") || DEFAULT_CALLBACK;
$("clear").onclick = () => { $("testsel").value = ""; load(null, "Open from Cerner to read the chart, or pick a made-up patient:"); };
const SAMPLES = window.CONSULT_SAMPLES || [];
SAMPLES.forEach((p, i) => { const o = document.createElement("option"); o.value = i; o.textContent = p.label; $("testsel").appendChild(o); });
$("testsel").onchange = () => { const p = SAMPLES[$("testsel").value]; if (!p) return $("clear").onclick(); load(p.build(Date.now()), "Made-up patient: " + p.label + " (the patient link will not open a real chart)", [], p); };

async function fromChart() {
  if (typeof FHIR === "undefined" || !(location.search.includes("code=") || location.search.includes("complete=") || sessionStorage.getItem("SMART_KEY"))) return;
  $("pstatus").textContent = "Reading the chart…";
  try {
    const client = await FHIR.oauth2.ready();
    const { raw, errors } = await C.gather(client, (msg) => ($("pstatus").textContent = msg));
    load(raw, "Chart read (read-only). Pick the specialty, type your question, check the text, then copy.", errors, null, client.patient.id);
  } catch (e) { $("pstatus").textContent = "Could not read the chart: " + (e && e.message ? e.message : e) + ". The made-up patients still work."; }
}
draw(); fromChart();
