/* Hip fracture co-management page. Read-only from the chart; your entries stay in this page. UNVERIFIED draft. */
const R = window.HipRules, C = window.HipChart, DAY = C.DAY, HR = 36e5;
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const fmtD = (t) => new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric" });
const fmtDT = (t) => new Date(t).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
const r1 = (v) => Math.round(v * 10) / 10;
const ul = (a) => "<ul style='margin:4px 0 6px 18px;padding:0'>" + a.filter(Boolean).map((t) => "<li style='margin:3px 0'>" + t + "</li>").join("") + "</ul>";
const toLocal = (t) => { if (t == null) return ""; const d = new Date(t), p = (n) => String(n).padStart(2, "0"); return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) + "T" + p(d.getHours()) + ":" + p(d.getMinutes()); };
const fromLocal = (s) => (s ? new Date(s).getTime() : null);
const state = { f: null, x: null };
const CHIP = { ok: ["c-yes", "OK"], fix: ["c-unknown", "Fix / watch"], delay: ["c-no", "Reason to delay"], missing: ["c-unknown", "Not found"], bad: ["c-no", "Act"], na: ["", "–"] };
const chip = (s) => `<span class="chip ${CHIP[s][0]}">${CHIP[s][1]}</span>`;

function ctx() {
  const f = state.f, now = Date.now(), x = { now };
  const L = (id, days) => C.latest(f.labs[id], days * DAY, now);
  x.arrival = fromLocal($("arrival").value); x.surgery = fromLocal($("surgery").value);
  x.tl = R.timeline(x.arrival, x.surgery, now);
  x.done = !!(x.tl && x.tl.done);
  ["hgb", "plt", "na", "k", "glu", "cr", "inr", "alb", "ptt", "tt"].forEach((k) => (x[k] = L(k, 3)));
  x.ca = L("ca", 14); x.vitd = L("vitd", 180);
  x.wt = parseFloat($("wt").value); if (!isFinite(x.wt)) x.wt = null;
  x.crcl = x.cr ? R.crcl(x.cr.v, f.age, x.wt, f.sex) : null;
  const since = (arr, t) => arr.filter((e) => e.t >= t);
  const adm = x.arrival ? since(f.labs.hgb, x.arrival - 12 * HR)[0] : f.labs.hgb[0];
  x.admHgb = adm || null;
  const crPre = x.arrival ? f.labs.cr.filter((e) => e.t >= x.arrival - 24 * HR && (!x.done || e.t <= x.surgery)) : f.labs.cr;
  x.baseCr = crPre.length ? Math.min(...crPre.map((e) => e.v)) : null;
  x.akiNow = x.cr && x.baseCr != null && x.cr.t > (crPre.find((e) => e.v === x.baseCr) || {}).t ? R.aki(x.baseCr, x.cr.v) : false;
  x.ts = f.ts ? { t: f.ts.t, age: now - f.ts.t } : null;
  x.nhfs = R.nhfs({ age: f.age, sex: f.sex, hgb: x.admHgb && x.admHgb.v, amtsLow: $("amts").checked, institution: $("inst").checked, comorbid2: $("comorb").checked, malignancy: !!f.prob.malignancy });
  // anticoagulants
  const rec = (cat, days) => C.recent(f, cat, days || 7, now);
  x.ac = [];
  const lastOf = (cat) => { const g = C.lastGiven(f, cat); return g ? g.t : null; };
  const manualLast = fromLocal($("aclast") ? $("aclast").value : "");
  if (rec("xa").length) x.ac.push({ kind: "xa", name: C.names(rec("xa")).join(", "), last: manualLast || lastOf("xa"), reduced: rec("xa").some((m) => /2\.5 ?mg|10 ?mg.*rivaroxaban|rivaroxaban.*10 ?mg|edoxaban.*30/i.test(m.name)) });
  if (rec("dabigatran").length) x.ac.push({ kind: "dabigatran", name: C.names(rec("dabigatran")).join(", "), last: manualLast || lastOf("dabigatran") });
  if (rec("warfarin").length) x.ac.push({ kind: "warfarin", name: C.names(rec("warfarin")).join(", ") });
  const lmwh = rec("lmwh", 3), ther = lmwh.filter((m) => { const mg = m.name.match(/(\d+)\s*mg/i), u = m.name.match(/(\d[\d,]*)\s*(units|iu)/i); return (mg && +mg[1] > 40) || (u && +u[1].replace(/,/g, "") > 5000) || /bid|q12h|1(\.5)?\s*mg\s*\/\s*kg/i.test(m.name); });
  if (ther.length) x.ac.push({ kind: "lmwh-ther", name: C.names(ther).join(", "), last: lastOf("lmwh") });
  else if (lmwh.length) x.ac.push({ kind: "lmwh-proph", name: C.names(lmwh).join(", "), last: lastOf("lmwh") });
  const ufh = rec("ufh", 2); if (ufh.length) x.ac.push({ kind: /infusion|drip|iv\b|nomogram/i.test(ufh.map((m) => m.name).join(" ")) ? "ufh" : "ufh-sc", name: C.names(ufh).join(", "), last: lastOf("ufh") });
  x.acRes = x.ac.map((d) => Object.assign({ name: d.name, last: d.last }, R.anticoag(d, x.crcl, x.inr)));
  x.therapeutic = x.ac.find((d) => ["xa", "dabigatran", "warfarin", "lmwh-ther", "ufh"].includes(d.kind));
  x.onProph = x.ac.find((d) => d.kind === "lmwh-proph" || d.kind === "ufh-sc");
  x.ap = C.names([].concat(rec("asa", 7), rec("p2y12", 7)));
  x.vitk = C.names(rec("vitk", 2));
  // pain, bowels, delirium
  x.opioidGiven = f.meds.filter((m) => m.given && m.cats.includes("opioid") && now - m.t <= DAY).length;
  x.opioid = C.names(rec("opioid", 2));
  x.apapSched = rec("acetaminophen", 2).some((m) => m.active && !/prn|as needed/i.test(m.name));
  x.apap = C.names(rec("acetaminophen", 2));
  x.block = f.meds.some((m) => m.cats.includes("block") && x.arrival && m.t >= x.arrival - 12 * HR);
  x.bowel = C.names(rec("bowel", 2));
  x.nsaid = C.names(rec("nsaid", 2));
  x.delMeds = C.names(rec("delirium", 3));
  x.antipsych = C.names(rec("antipsych", 3));
  x.osteo = C.names(rec("osteo", 365)); x.onVitD = rec("vitd", 7).length > 0;
  // vitals
  const v = f.vit.filter((r) => now - r.t <= DAY), lastV = (k) => { const r = [...v].reverse().find((q) => q[k] != null); return r ? r[k] : null; };
  x.spo2 = lastV("spo2"); x.hr = lastV("hr"); x.temp = lastV("temp");
  x.vte = R.vtePlan({ pod: x.tl && x.tl.pod, onTherapeutic: !!x.therapeutic, onProph: !!x.onProph, crcl: x.crcl, plt: x.plt && x.plt.v, bleeding: $("bleed").checked, preop: !x.done });
  const albv = x.alb ? x.alb.v : null;
  x.caCorr = x.ca ? r1(x.ca.v + (albv ? 0.02 * (40 - albv) : 0) * 1) : null;
  x.bone = R.bone({ vitd: x.vitd && x.vitd.v, ca: x.caCorr, crcl: x.crcl, onTreatment: x.osteo.join(", "), onVitD: x.onVitD });
  x.pre = R.preop({ hgb: x.hgb, plt: x.plt, na: x.na, k: x.k, glu: x.glu, cr: x.cr, inr: x.inr, crRise: !x.done && x.akiNow, crcl: x.crcl, warfarin: x.ac.some((d) => d.kind === "warfarin"), ts: x.ts });
  return x;
}

function tile(cls, k, big, s) { return `<div class="tile ${cls}"><div class="k">${esc(k)}</div><div class="big">${big}</div><div class="s">${s || ""}</div></div>`; }

function draw() {
  const f = state.f;
  if (!f) { ["tiles", "alerts", "preop", "ac", "post", "pain", "vte", "bone", "hints"].forEach((id) => ($(id).innerHTML = "")); ["alertsum", "presum", "acsum", "postsum", "painsum", "vtesum", "bonesum", "ptsum", "crclnote", "surgname"].forEach((id) => ($(id).textContent = "")); $("alerts").innerHTML = '<div class="muted">No patient loaded.</div>'; state.x = null; HIP_NOTE.update(); return; }
  const x = state.x = ctx();
  $("crclnote").textContent = x.crcl != null ? `CrCl ${Math.round(x.crcl)} mL/min (Cockcroft-Gault, actual weight)` : "CrCl needs weight, age and creatinine";
  $("postrow").style.opacity = x.done ? 1 : 0.5;
  drawTiles(x); drawAlerts(x); drawPre(x); drawAc(x); drawPost(x); drawPain(x); drawVte(x); drawBone(x);
  HIP_NOTE.update();
}

function drawTiles(x) {
  const t = [], tl = x.tl;
  if (!tl) t.push(tile("t2", "Time to theatre", "–", "Enter the arrival time"));
  else if (tl.done) t.push(tile(tl.over48 ? "t3" : tl.over36 ? "t2" : "t0", "Time to theatre", Math.round(tl.hours) + " h", tl.over48 ? "Over the 48 h target" : "Within 48 h"));
  else t.push(tile(tl.over48 ? "t3" : tl.over36 ? "t2" : "t1", "Waiting for theatre", Math.round(tl.hours) + " h", "48 h mark: " + fmtDT(tl.deadline)));
  t.push(tile("t1", "Stage", x.done ? "Day " + tl.pod : "Pre-op", x.done ? "after " + esc(state.f.surgery ? state.f.surgery.n : "surgery") : x.pre.delay.length ? x.pre.delay.length + " reason(s) to delay" : x.pre.ready ? "Labs ready" : "Labs missing"));
  t.push(x.nhfs ? tile(x.nhfs.score >= 7 ? "t3" : x.nhfs.score >= 5 ? "t2" : "t1", "Nottingham score", x.nhfs.score, `About ${r1(x.nhfs.mort30)}% 30-day mortality`) : tile("", "Nottingham score", "–", "Needs age and admission Hgb"));
  if (!x.done) {
    const ga = x.acRes.map((a) => a.ga).filter(Boolean), latestGa = ga.length ? Math.max(...ga) : null, war = x.acRes.find((a) => a.kind === "warfarin");
    if (war && war.reverse) t.push(tile("t3", "Anticoagulation", "Reverse", "INR " + x.inr.v + ": vitamin K, recheck"));
    else if (latestGa && latestGa > x.now) t.push(tile("t2", "Anticoagulation", "From " + new Date(latestGa).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }), "General anaesthesia from " + fmtDT(latestGa)));
    else t.push(tile("t0", "Anticoagulation", x.ac.length ? "Clear for GA" : "None", x.ac.length ? "Check spinal timing below" : x.ap.length ? "Antiplatelet only" : "No anticoagulant found"));
  } else t.push(tile({ on: "t0", ther: "t1", start: "t2", hold: "t3" }[x.vte.state] || "t1", "VTE prophylaxis", { on: "Ordered", ther: "Restart plan", start: "Start", hold: "Mechanical" }[x.vte.state], x.vte.state === "on" ? "28-35 days in total" : ""));
  $("tiles").innerHTML = t.join("");
}

function alerts(x) {
  const a = [], f = state.f, tl = x.tl;
  if (tl && !tl.done && tl.over48) a.push(["urgent", `Waiting ${Math.round(tl.hours)} h for theatre: over the 48 h target.`, "Escalate: each delay adds mortality and complications."]);
  else if (tl && !tl.done && tl.over36) a.push(["action", `Waiting ${Math.round(tl.hours)} h: 48 h mark at ${fmtDT(tl.deadline)}.`, ""]);
  if (!x.done) x.pre.delay.forEach((i) => a.push(["action", i.label + (i.value ? " " + i.value.v : "") + ": " + i.note + ".", "Fix now so theatre is not delayed further."]));
  if (!x.done && f.prob.cardiac && f.prob.cardiac.some((p) => /aortic stenosis|I35/i.test(p)) && tl && tl.hours > 24) a.push(["info", "Aortic stenosis on the problem list.", "An echo should not delay surgery unless there are new symptoms or an unexplained murmur; tell anaesthesia (GA is often preferred)."]);
  const war = x.acRes.find((r) => r.kind === "warfarin");
  if (!x.done && war && war.reverse && !x.vitk.length) a.push(["urgent", `On warfarin, INR ${x.inr.v}, no vitamin K found.`, "Give IV vitamin K and recheck INR in 6 h."]);
  if (!x.done && !x.ts) a.push(["action", "No group and screen found.", "Send one so theatre is not held up."]);
  if (x.done) {
    if (x.hgb && x.hgb.v < 80) a.push(["urgent", `Hgb ${x.hgb.v} after surgery.`, "Transfuse 1 unit (restrictive threshold 80) and recheck."]);
    if (tl.pod >= 1 && !state.f.labs.hgb.some((e) => e.t > x.surgery)) a.push(["action", "No hemoglobin since surgery.", "Check Hgb, electrolytes and creatinine on day 1."]);
    if (x.akiNow) a.push(["action", `Creatinine ${Math.round(x.cr.v)} vs ${Math.round(x.baseCr)} before surgery: acute kidney injury.`, "Fluids if dry; hold NSAIDs, ACE inhibitors / ARBs, diuretics; review opioid dose."]);
    if ($("cam").value === "positive") a.push(["action", "Delirium screen positive.", "Look for causes (pain, retention, constipation, hypoxia, infection, drugs, low Na); see the bundle below."]);
    if (tl.pod >= 1 && $("cath").checked) a.push(["action", "Urinary catheter still in on day " + tl.pod + ".", "Remove by day 1 unless needed; bladder scan after."]);
    if (tl.pod >= 1 && !$("mobil").checked) a.push(["action", "Not out of bed yet on day " + tl.pod + ".", "Mobilise on day 1 (weight bearing as tolerated unless the surgeon says otherwise)."]);
    if (tl.pod >= 3 && !$("bm").checked) a.push(["action", "No bowel movement by day " + tl.pod + ".", "Step up laxatives; check for impaction."]);
  }
  if (x.spo2 != null && x.spo2 < 92) a.push(["action", `SpO2 ${x.spo2}%.`, x.done ? "Think atelectasis, pneumonia, fluid overload, PE, fat embolism." : "Look for pneumonia or heart failure before theatre."]);
  if (x.na && x.na.v < 130) a.push(["action", `Sodium ${x.na.v}.`, "Common after hip fracture (pain, opioids, fluids): review fluids and drugs."]);
  if (x.delMeds.length) a.push(["action", "Drugs that worsen delirium: " + x.delMeds.join(", ") + ".", "Stop or swap."]);
  if (x.opioid.length && !x.bowel.length) a.push(["action", "Opioid without a bowel regimen.", "Add PEG 3350 17 g daily and/or sennosides."]);
  if (x.nsaid.length && ((x.crcl != null && x.crcl < 30) || (state.f.age >= 75))) a.push(["action", "NSAID: " + x.nsaid.join(", ") + ".", "Avoid in older adults and when CrCl is low."]);
  if (!x.apapSched) a.push(["info", "No scheduled acetaminophen found.", "Regular acetaminophen 1 g q6h (lower dose if under 50 kg or liver disease) reduces opioid need."]);
  if (x.onProph && /enoxaparin|lovenox/i.test(x.onProph.name) && /40\s*mg/i.test(state.f.meds.filter((m) => m.cats.includes("lmwh")).map((m) => m.name).join(" ")) && x.crcl != null && x.crcl < 30) a.push(["action", `Enoxaparin 40 mg with CrCl ${Math.round(x.crcl)}.`, "Reduce to 30 mg SC daily (or heparin 5,000 units SC q12h)."]);
  if (x.done && x.vte.state === "start") a.push(["action", "No VTE prophylaxis found after surgery.", x.vte.dose + ", for 28-35 days."]);
  return a;
}
function drawAlerts(x) {
  const a = alerts(x);
  $("alertsum").textContent = a.length ? a.length + " item" + (a.length > 1 ? "s" : "") : "none";
  $("alerts").innerHTML = a.length ? a.map(([l, t, s]) => `<div class="alert ${l}"><b>${l === "urgent" ? "Urgent" : l === "action" ? "Action" : "Note"}</b>${esc(t)}${s ? '<div class="muted">' + esc(s) + "</div>" : ""}</div>`).join("") : '<div class="muted">Nothing flagged.</div>';
}

function drawPre(x) {
  $("sec-pre").open = !x.done;
  if (x.done) { $("presum").textContent = "surgery done"; $("preop").innerHTML = '<div class="muted">Surgery done: see post-op checks. Clear the surgery time to see pre-op readiness again.</div>'; return; }
  $("presum").textContent = x.done ? "surgery done" : x.pre.delay.length ? x.pre.delay.length + " reason(s) to delay" : x.pre.ready ? "ready" : "labs missing";
  $("preop").innerHTML = `<table><tr><th>Check</th><th>Status</th><th>Latest</th><th>Note</th></tr>` + x.pre.items.map((i) => `<tr><td>${esc(i.label)}</td><td>${chip(i.state)}</td>
    <td class="num">${i.value ? esc(r1(i.value.v)) + " <span class='muted'>(" + fmtD(i.value.t) + ")</span>" : i.label === "Group and screen" && x.ts ? fmtDT(x.ts.t) : ""}</td><td class="wrap muted">${esc(i.note)}</td></tr>`).join("") + "</table>";
}

function drawAc(x) {
  const out = [];
  if (!x.ac.length && !x.ap.length) { $("ac").innerHTML = '<div class="muted">No anticoagulant or antiplatelet found (ordered now or given in the past 7 days).</div>'; $("acsum").textContent = "none"; return; }
  const needLast = x.ac.some((d) => ["xa", "dabigatran"].includes(d.kind));
  if (needLast) out.push(`<div class="row"><label class="inl"><b>Last DOAC dose</b> <input type="datetime-local" id="aclast" value="${toLocal(x.ac.find((d) => ["xa", "dabigatran"].includes(d.kind)).last)}"></label><span class="muted">From the MAR; change it if the home dose was taken later.</span></div>`);
  x.acRes.forEach((a) => {
    const times = [a.ga && `General anaesthesia from <b>${fmtDT(a.ga)}</b>${a.ga <= x.now ? " (now)" : ""}`, a.neuraxial && `spinal from <b>${fmtDT(a.neuraxial)}</b>${a.neuraxial <= x.now ? " (now)" : ""}`].filter(Boolean).join("; ");
    out.push(`<div style="margin:8px 0"><b>${esc(a.name)}</b>${a.last ? ` <span class="muted">(last dose ${fmtDT(a.last)})</span>` : ""}${times && !x.done ? "<div>" + times + "</div>" : ""}${ul(a.notes.map(esc))}</div>`);
  });
  R.antiplatelet(x.ap).forEach((t) => out.push(`<div style="margin:8px 0"><b>${esc(x.ap.join(", "))}</b>${ul([esc(t)])}</div>`));
  if (x.done && x.therapeutic) out.push(`<div><b>After surgery:</b> prophylactic LMWH from 12 h after surgery, then restart ${esc(x.therapeutic.name)} at full dose 24-72 h after surgery once bleeding risk allows (first DOAC dose at least 24 h after the last LMWH; warfarin from 24 h with LMWH until the INR is in range if high clot risk).</div>`);
  $("acsum").textContent = x.ac.concat(x.ap.map((n) => ({ name: n }))).map((d) => d.name).join("; ");
  $("ac").innerHTML = out.join("");
  const al = $("aclast"); if (al) al.onchange = draw;
}

function drawPost(x) {
  if (!x.done) { $("post").innerHTML = '<div class="muted">Shows once a surgery time is entered or found in the chart.</div>'; $("postsum").textContent = "pre-op"; return; }
  const rows = [], tr = R.transfusion(x.hgb, !!state.f.prob.cardiac), postHgb = state.f.labs.hgb.filter((e) => e.t > x.surgery);
  const row = (k, st, val, note) => rows.push(`<tr><td>${k}</td><td>${chip(st)}</td><td>${val || ""}</td><td class="wrap muted">${esc(note || "")}</td></tr>`);
  row("Hemoglobin", !postHgb.length ? "missing" : tr && tr.give ? "bad" : tr && tr.consider ? "fix" : "ok", state.f.labs.hgb.filter((e) => e.t >= x.arrival - 12 * HR).map((e) => Math.round(e.v)).join(" → "), tr ? tr.text : "Check on day 1");
  row("Kidneys", !x.cr ? "missing" : x.akiNow ? "bad" : "ok", x.cr ? Math.round(x.baseCr) + " → " + Math.round(x.cr.v) : "", x.akiNow ? "AKI after surgery" : "");
  row("Sodium", !x.na ? "missing" : x.na.v < 130 ? "fix" : "ok", x.na ? x.na.v : "", "");
  row("Oxygen", x.spo2 == null ? "missing" : x.spo2 < 92 ? "fix" : "ok", x.spo2 != null ? x.spo2 + "%" : "", x.temp != null && x.temp >= 38 ? "Temperature " + x.temp : "");
  const cam = $("cam").value; row("Delirium screen", !cam ? "missing" : cam === "positive" ? "bad" : "ok", cam || "", !cam ? "Screen at least daily (4AT / CAM)" : "");
  row("Mobilised", $("mobil").checked ? "ok" : x.tl.pod >= 1 ? "bad" : "fix", $("mobil").checked ? "yes" : "no", "Out of bed day 1");
  row("Urinary catheter", $("cath").checked ? (x.tl.pod >= 1 ? "bad" : "fix") : "ok", $("cath").checked ? "in" : "out", "Remove by day 1");
  row("Bowels", $("bm").checked ? "ok" : x.tl.pod >= 3 ? "bad" : x.bowel.length ? "fix" : "bad", $("bm").checked ? "moved" : "not yet", x.bowel.length ? "Regimen: " + x.bowel.join(", ") : "No laxative ordered");
  $("postsum").textContent = "day " + x.tl.pod;
  $("post").innerHTML = `<table><tr><th>Check</th><th>Status</th><th>Value</th><th>Note</th></tr>${rows.join("")}</table>`;
}

function drawPain(x) {
  const it = [];
  it.push(x.apapSched ? "Scheduled acetaminophen: yes." : "<b>Scheduled acetaminophen: not found.</b> 1 g PO q6h (650 mg if under 50 kg; max 3 g/day if frail or liver disease).");
  it.push(x.block ? "Nerve block on record." : (x.done ? "No nerve block found." : "<b>No nerve block found:</b> fascia iliaca or PENG block lowers opioid need and delirium; ask anaesthesia / ED."));
  it.push(x.opioid.length ? `Opioid: ${esc(x.opioid.join(", "))}; ${x.opioidGiven} dose(s) in 24 h. Low dose, short-acting; avoid meperidine and codeine.` : "No opioid ordered.");
  if (x.nsaid.length) it.push("<b>NSAID:</b> " + esc(x.nsaid.join(", ")) + " — avoid in older adults, AKI or CrCl below 30.");
  it.push(x.bowel.length ? "Bowel regimen: " + esc(x.bowel.join(", ")) + "." : "<b>No bowel regimen:</b> PEG 3350 17 g daily ± sennosides 17.2 mg qhs.");
  if (x.delMeds.length) it.push("<b>Delirium-risk drugs:</b> " + esc(x.delMeds.join(", ")) + ".");
  if (x.antipsych.length) it.push("Antipsychotic on record (" + esc(x.antipsych.join(", ")) + "): lowest dose, only for distress or danger, review daily.");
  const bundle = ["Glasses, hearing aids, clock and calendar; family at the bedside", "Sleep at night: no routine night vitals or meds where safe", "Fluids and food; dentures in", "Treat pain, retention and constipation", "Mobilise early; avoid restraints", "Daily 4AT / CAM"];
  $("painsum").textContent = [x.apapSched ? "" : "no scheduled acetaminophen", x.bowel.length ? "" : "no bowel regimen", x.delMeds.length ? x.delMeds.length + " delirium-risk drug(s)" : ""].filter(Boolean).join(" · ") || "no gaps found";
  $("pain").innerHTML = ul(it) + "<b>Delirium prevention bundle</b>" + ul(bundle.map(esc));
}

function drawVte(x) {
  $("vtesum").textContent = { on: "ordered", ther: "therapeutic anticoagulant", start: "not found", hold: "mechanical only" }[x.vte.state];
  $("vte").innerHTML = `<div class="alert ${x.vte.state === "start" || x.vte.state === "hold" ? "action" : "info"}">${esc(x.vte.text)}</div>` +
    `<div class="muted">${x.onProph ? "On record: " + esc(x.onProph.name) + ". " : ""}${x.plt ? "Platelets " + x.plt.v + ". " : ""}${x.crcl != null ? "CrCl " + Math.round(x.crcl) + " mL/min." : ""}</div>`;
}

function drawBone(x) {
  const facts = [x.vitd ? `25-OH vitamin D ${Math.round(x.vitd.v)} nmol/L (${fmtD(x.vitd.t)})` : "No vitamin D level (6 months)", x.ca ? `calcium ${x.ca.v}${x.alb ? " (corrected " + x.caCorr + ")" : ""}` : "no calcium", x.crcl != null ? "CrCl " + Math.round(x.crcl) : ""].filter(Boolean);
  $("bonesum").textContent = x.bone.treat ? "start treatment" : "on treatment";
  $("bone").innerHTML = `<div class="muted">${esc(facts.join(" · "))}</div>` + ul(x.bone.items.map(esc).concat(["Falls: review sedatives and blood pressure drugs, check orthostatic BP, vision, home safety and physiotherapy before discharge."]));
}

function load(raw, note, errors, preset) {
  state.f = raw ? C.parse(raw) : null; const p = preset || {}, f = state.f;
  $("amts").checked = !!p.amtsLow || !!(f && f.prob.dementia); $("inst").checked = !!p.institution || !!(f && f.prob.institution);
  const comorb = f ? ["cardiac", "cerebro", "resp", "renal", "diabetes", "parkinson", "dementia"].filter((k) => f.prob[k]).length : 0;
  $("comorb").checked = comorb >= 2;
  $("cam").value = p.cam || ""; $("mobil").checked = !!p.mobilized; $("cath").checked = !!p.catheter; $("bm").checked = !!p.bm; $("bleed").checked = false;
  $("arrival").value = f && f.arrival ? toLocal(f.arrival.t) : ""; $("surgery").value = f && f.surgery ? toLocal(f.surgery.t) : "";
  $("surgname").textContent = f ? [f.arrival ? "arrival from " + f.arrival.src : "", f.surgery ? "surgery: " + f.surgery.n : "no hip surgery found yet"].filter(Boolean).join(" · ") : "";
  const w = f && f.weights.length ? f.weights[f.weights.length - 1].v : null; $("wt").value = w ? r1(w) : "";
  $("ptsum").textContent = f ? [f.sex, f.age != null ? f.age + " y" : "", f.fracture ? f.fracture.n : "no hip fracture on the problem list"].filter(Boolean).join(", ") : "";
  const h = [];
  if (f && comorb) h.push("Comorbidities on the problem list: " + ["cardiac", "cerebro", "resp", "renal", "diabetes", "parkinson", "dementia"].filter((k) => f.prob[k]).map((k) => f.prob[k][0]).join("; "));
  if (f && f.prob.dementia) h.push("Dementia on the problem list: abbreviated mental test box ticked; untick if the test was above 6.");
  $("hints").innerHTML = h.length ? "<b>From the chart (check):</b><br>" + h.map(esc).join("<br>") : "";
  $("pstatus").textContent = note; $("clear").hidden = !raw;
  $("errs").innerHTML = errors && errors.length ? "Could not read: " + errors.map(esc).join("; ") + ". Check the scopes in the Code Console." : "";
  draw(); HIP_NOTE.reset();
}
["arrival", "surgery", "amts", "inst", "comorb", "cam", "mobil", "cath", "bm", "bleed"].forEach((id) => ($(id).onchange = draw)); $("wt").oninput = draw;
$("clear").onclick = () => { $("testsel").value = ""; load(null, "Open from Cerner to read the chart, or pick a made-up patient:"); };
const SAMPLES = window.HIP_SAMPLES || [];
SAMPLES.forEach((p, i) => { const o = document.createElement("option"); o.value = i; o.textContent = p.label; $("testsel").appendChild(o); });
$("testsel").onchange = () => { const p = SAMPLES[$("testsel").value]; if (!p) return $("clear").onclick(); load(p.build(Date.now()), "Made-up patient: " + p.label, [], p.preset); };

async function fromChart() {
  if (typeof FHIR === "undefined" || !(location.search.includes("code=") || location.search.includes("complete=") || sessionStorage.getItem("SMART_KEY"))) return;
  $("pstatus").textContent = "Reading the chart…";
  try {
    const client = await FHIR.oauth2.ready();
    const { raw, errors } = await C.gather(client, (msg) => ($("pstatus").textContent = msg));
    load(raw, "Chart read (read-only). Nothing is sent anywhere. Check the arrival and surgery times above.", errors);
  } catch (e) { $("pstatus").textContent = "Could not read the chart: " + (e && e.message ? e.message : e) + ". The made-up patients still work."; }
}
draw(); fromChart();
