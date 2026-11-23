/* NSTEMI page. Read-only from the chart; your selections stay in this page. UNVERIFIED draft. */
const R = window.ACSRules, C = window.ACSChart, DAY = C.DAY, HR = C.HR;
const $ = (id) => document.getElementById(id);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const ago = (t) => { const h = (Date.now() - t) / HR; return h < 1 ? Math.max(1, Math.round(h * 60)) + " min ago" : h < 48 ? Math.round(h) + " h ago" : Math.round(h / 24) + " d ago"; };
const ul = (a) => "<ul>" + a.filter(Boolean).map((t) => "<li>" + t + "</li>").join("") + "</ul>";
const num = (id) => { const v = parseFloat($(id).value); return isFinite(v) ? v : null; };
const state = { f: null };
const has = (k) => !!(state.f && state.f.cls[k] && state.f.cls[k].length);
const prob = (k) => !!(state.f && state.f.prob[k]);
const TRIG_LABEL = { anemia: "anemia/bleeding", tachy: "tachyarrhythmia", hypotension: "hypotension", hypoxia: "hypoxia", sepsis: "sepsis", htn: "severe hypertension", brady: "bradycardia", spasm: "spasm/cocaine" };

/* everything the rules need: chart values with typed overrides */
function facts() {
  const f = state.f, now = Date.now(), L = (id, d) => (f ? C.latest(f.l[id], d * DAY, now) : null), V = (id, d) => (f ? C.latest(f.v[id], d * DAY, now) : null);
  const hrO = num("o-hr"), sbpO = num("o-sbp"), kgO = num("o-kg");
  const hr = hrO != null ? { v: hrO, typed: true } : V("hr", 1), sbp = sbpO != null ? { v: sbpO, typed: true } : V("sbp", 1), spo2 = V("spo2", 1);
  const kg = kgO != null ? kgO : f && f.kg ? f.kg : null, age = f ? f.age : null, sex = f ? f.sex : "";
  const c = { cr: L("cr", 7), egfr: L("egfr", 7), hb: L("hb", 3), plt: L("plt", 7), k: L("k", 3), mg: L("mg", 3), ldl: L("ldl", 365), a1c: L("a1c", 120), inr: L("inr", 7), tsh: L("tsh", 90), lactate: L("lactate", 2), qtc: L("qtc", 3) };
  const cl = R.crcl(age, kg, c.cr && c.cr.v, sex);
  const tropS = f && f.l.trop ? f.l.trop.filter((x) => now - x.t < 4 * DAY) : [];
  const url = num("url") || (f && f.tropT ? 14 : 26);
  const tp = R.tropPattern(tropS, url);
  const trigs = $$(".trig:checked").map((x) => TRIG_LABEL[x.value]);
  const type = R.mitype({ trop: tp, symptoms: $("symp").checked, ecgIschemia: $("ecgisch").checked, newWMA: $("wma").checked, angioThrombus: $("thromb").checked, triggers: trigs });
  const vh = {}; $$(".vh").forEach((x) => (vh[x.value] = x.checked));
  const killip = +$("killip").value, lvef = num("lvef");
  const g = R.grace({ age, hr: hr && Math.round(hr.v), sbp: sbp && Math.round(sbp.v), cr: c.cr && c.cr.v, killip, arrest: $("arrest").checked, stDev: $("stdev").checked, enz: tp.kind === "acute" || tp.kind === "single-high" || tp.kind === "chronic" });
  const rf = ["dm", "htn", "lipid", "smoke", "fhx"].filter(prob).length;
  const tm = R.timi({ age, rf, knownCAD: prob("cad"), asa7: has("asa"), angina2: $("angina2").checked, stDev: $("stdev").checked, enz: tp.kind === "acute" || tp.kind === "single-high" });
  const cfs = $("cfs").value ? +$("cfs").value : null;
  const inv = R.invasive({ type: type.kind, veryHigh: vh, dynamicST: $("dynst").checked, transientSTE: $("tste").checked, grace: g.score, frail: cfs, dementia: $("dementia").checked, lifeLimited: $("lifelim").checked, declines: $("declines").checked, activeBleed: $("bleeding").checked, age });
  const oac = has("doac") || has("warf") || prob("mechValve");
  const surgRisk = $$(".sr:checked").map((x) => x.value);
  const rv = R.revasc({ anatomy: $("anatomy").value, proxLAD: $("plad").checked, syntax: num("syntax"), dm: prob("dm") || has("insulin"), lvef, complexPCI: $("complex").checked, surgRisk, valveSurgery: $("valve").checked, culpritPCIdone: $("culprit").checked });
  const egfr = c.egfr ? Math.round(c.egfr.v) : cl;
  const hb = R.hbr({ age, egfr, hb: c.hb && c.hb.v, sex, plt: c.plt && c.plt.v, oac, priorBleed6mo: $("b6").checked, priorBleed12mo: $("b12").checked, cirrhosisPH: prob("cirrhosis"), cancer: $("bca").checked, ich: prob("ich"),
    stroke: prob("stroke") && !prob("ich"), nsaidSteroid: has("nsaid") || has("steroid"), surgery30: $("bsurg").checked, bleedDiathesis: prob("bleedDx") });
  const managed = $("managed").value;
  const p2 = R.p2y12({ type: type.kind, oac, ich: prob("ich"), strokeTIA: prob("stroke"), age, kg, activeBleed: $("bleeding").checked, cyp3a4strong: f ? f.cls.cyp3a4 : [], avBlock: prob("avb") && !prob("pacer"), dialysis: prob("dialysis"), hbr: hb.isHBR, managed, anatomyKnown: $("anatomy").value !== "unknown" });
  const ac = R.anticoag({ kg, cl, onDOAC: has("doac"), onWarfarin: has("warf"), inr: c.inr && c.inr.v, tier: inv.tier, plt: c.plt && c.plt.v, hitHx: prob("hit") });
  const dp = R.daptPlan({ type: type.kind, managed, hbr: hb.isHBR, oac });
  const s = { age, sex, kg, cl, egfr, hr: hr && Math.round(hr.v), sbp: sbp && Math.round(sbp.v), spo2: spo2 && spo2.v, killip, lvef, cfs };
  return { f, c, s, hr, sbp, tp, tropS, url, type, g, tm, inv, rv, hb, p2, ac, dp, oac, surgRisk, trigs, managed };
}

function tile(k, big, sub, tone) { return `<div class="tile ${tone || ""}"><div class="k">${k}</div><div class="big">${big}</div><div class="s">${sub || ""}</div></div>`; }
const box = (cls, h, items) => (items.length ? `<div class="${cls}"><h3>${h}</h3>${ul(items)}</div>` : "");

function draw() {
  const x = facts(), s = x.s, f = x.f;
  const tT = { t1: "t3", t2: "t1", uncertain: "t2", injury: "t1", chronic: "t0", noMI: "t0", pending: "t2" }[x.type.kind] || "t1";
  const invT = { immediate: "t3", early: "t2", inpatient: "t2", selective: "t1", none: "t0" }[x.inv.tier] || "t1";
  $("tiles").innerHTML = [
    tile("MI type", x.type.label.replace(/ \(NSTEMI\)/, ""), x.type.dapt === true ? "ACS treatment indicated" : x.type.dapt === false ? "no DAPT / no urgent cath" : "needs more information", tT),
    tile("hs-troponin peak", x.tp.peak ? Math.round(x.tp.peak.v) : "?", x.tp.peak ? `ng/L · ${x.tropS.length} value${x.tropS.length > 1 ? "s" : ""}${x.tp.deltaPct != null ? " · change " + x.tp.deltaPct + "%" : ""}` : "none in 4 days", x.tp.kind === "acute" ? "t2" : "t1"),
    tile("GRACE", x.g.score ?? "?", x.g.score != null ? x.g.risk + " risk" : "needs " + x.g.miss.join(", "), x.g.risk === "high" ? "t3" : x.g.risk === "intermediate" ? "t2" : "t1"),
    tile("Cath", { immediate: "Within 2 h", early: "Within 24 h", inpatient: "This admission", selective: "Decide", none: "Not urgent" }[x.inv.tier] || "?", x.inv.against.length ? "discuss: " + x.inv.against[0] : x.inv.why[0] || "", invT),
    tile("P2Y12", x.p2.pick || "?", x.p2.maint ? esc(x.p2.maint.split("(")[0]) : "", x.p2.pick === "None" ? "t0" : "t1"),
    tile("Bleeding risk", x.hb.isHBR ? "HIGH" : "Not high", `ARC-HBR ${x.hb.major.length} major, ${x.hb.minor.length} minor`, x.hb.isHBR ? "t2" : "t0")].join("");

  /* plan now */
  const urgent = [], doNow = [], next = [];
  if (x.inv.tier === "immediate") urgent.push(`<b>Call cardiology / CCU now: ${esc(x.inv.when)}</b> (${esc(x.inv.why.join("; "))})`);
  if ($("bleeding").checked) urgent.push("<b>Active bleeding:</b> stop anticoagulant, hold P2Y12, resuscitate, call GI/cardiology together.");
  if (x.type.kind === "t2" || x.type.kind === "injury") {
    doNow.push(`<b>Treat the cause</b>${x.trigs.length ? ": " + esc(x.trigs.join(", ")) : ""}. Rate control, transfuse if Hb under 80 (MINT: about 100 is reasonable with MI), oxygen, antibiotics, BP.`);
    doNow.push("No DAPT and no therapeutic heparin for type 2 MI / injury. Aspirin 81 mg only if known CAD. Prophylactic anticoagulation as usual.");
    next.push("Repeat ECG and troponin after the trigger is fixed; if ischemia persists, re-classify as type 1.", "Echo this admission; outpatient ischemia testing or cardiology follow-up if CAD is suspected; statin if atherosclerosis.");
  } else if (x.type.kind === "t1" || x.type.kind === "uncertain") {
    doNow.push("Aspirin 160-325 mg chewed (non-enteric) once, then 81 mg daily.");
    if (x.p2.pick && x.p2.pick !== "None" && x.p2.pick !== "Hold") doNow.push(`P2Y12: <b>${esc(x.p2.pick)}</b> ${esc(x.p2.load)} then ${esc(x.p2.maint)}${x.p2.timing ? ` <span class="muted">(${esc(x.p2.timing)})</span>` : ""}`);
    const acPick = { fond: x.ac.fond, enox: x.ac.enox, ufh: x.ac.ufh, "ufh-or-enox": x.ac.ufh }[x.ac.pick];
    if (!has("doac") && !has("warf")) doNow.push(`Anticoagulant: ${acPick || x.ac.ufh}`); else doNow.push(esc((x.ac.list[0] || {}).a || ""));
    doNow.push("High-intensity statin now (atorvastatin 80 mg). Oral beta-blocker within 24 h if no HF, low BP or shock risk. Nitroglycerin for pain. Oxygen only if SpO2 under 90%.");
    next.push(`Cath: ${esc(x.inv.when)}.`, "Echo (LVEF), lipids, A1c. Keep K 4.0+ and Mg 0.8+. Telemetry 24-48 h.", "Discuss DAPT duration with cardiology after the cath: " + esc(x.dp.headline) + ".");
  } else if (x.type.kind === "pending") doNow.push("Repeat hs-troponin (0/1-3 h per assay pathway) and ECG. If the story is convincing for ACS, give aspirin now while waiting.");
  else doNow.push(esc(x.type.text));
  if (x.inv.notes.length) next.push(...x.inv.notes.map(esc));
  $("plansum").textContent = x.type.label;
  $("plan").innerHTML = box("urgent", "Urgent", urgent) + box("action", "Do now", doNow) + box("", "Next", next);

  drawType(x); drawRisk(x); drawInv(x); drawRv(x); drawAT(x); drawDapt(x); drawMeds(x); drawAlerts(x); drawTests(x); drawFU(x); drawHandout();
  $("note").value = noteText(x);
}

function drawType(x) {
  const rows = x.tropS.map((p) => `<tr><td>${new Date(p.t).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</td><td>${ago(p.t)}</td><td class="num ${p.v > x.url ? "hi" : ""}">${Math.round(p.v)}</td></tr>`).join("");
  const W = 520, H = 120, P = 34, pts = x.tropS;
  let svg = "";
  if (pts.length >= 2) {
    const t0 = pts[0].t, t1 = pts[pts.length - 1].t, mx = Math.max(x.url * 1.5, ...pts.map((p) => p.v));
    const xs = (t) => P + ((t - t0) / Math.max(1, t1 - t0)) * (W - P - 10), ys = (v) => H - 18 - (v / mx) * (H - 30);
    svg = `<svg viewBox="0 0 ${W} ${H}" width="100%" style="max-width:560px;color:var(--muted)"><line x1="${P}" x2="${W - 10}" y1="${ys(x.url)}" y2="${ys(x.url)}" stroke="currentColor" stroke-dasharray="4 3" opacity=".6"/><text x="2" y="${ys(x.url) + 4}">${x.url}</text><text x="2" y="${ys(mx) + 8}">${Math.round(mx)}</text>
      <path d="${pts.map((p, i) => (i ? "L" : "M") + xs(p.t).toFixed(1) + "," + ys(p.v).toFixed(1)).join(" ")}" fill="none" stroke="#c0392b" stroke-width="2"/>${pts.map((p) => `<circle cx="${xs(p.t).toFixed(1)}" cy="${ys(p.v).toFixed(1)}" r="3" fill="#c0392b"><title>${Math.round(p.v)} ng/L, ${ago(p.t)}</title></circle>`).join("")}</svg>
      <div class="muted">dashed line = 99th percentile (${x.url} ng/L)</div>`;
  }
  const tone = { t1: "t3", t2: "t1", uncertain: "t2", injury: "t1", chronic: "t0", noMI: "t0", pending: "t2" }[x.type.kind];
  $("typesum").textContent = x.type.label;
  $("type").innerHTML = `<div class="verdict ${tone}"><div class="big">${esc(x.type.label)}</div><div>${esc(x.type.text)}</div></div>
    <div class="alert info"><b>Troponin:</b>${esc(x.tp.text)}${state.f && state.f.tropName ? ` <span class="muted">(${esc(state.f.tropName)})</span>` : ""}</div>
    ${rows ? `<div class="mini"><div class="scroll"><table><tr><th>When</th><th></th><th>ng/L</th></tr>${rows}</table></div><div>${svg}</div></div>` : ""}
    <div class="mini" style="margin-top:10px">
      <div><div class="ttl">Ischemia evidence</div>${x.type.isch.length ? ul(x.type.isch.map(esc)) : '<div class="muted">None ticked</div>'}</div>
      <div><div class="ttl">Supply/demand triggers</div>${x.type.trig.length ? ul(x.type.trig.map(esc)) : '<div class="muted">None ticked</div>'}</div></div>
    <details style="margin-top:8px"><summary><b>How to tell type 1 from type 2 (Fourth Universal Definition)</b></summary>${ul([
      "<b>MI</b> = troponin rise and/or fall with at least one value above the 99th percentile, PLUS at least one of: ischemic symptoms, new ischemic ECG changes, new Q waves, new wall-motion loss on imaging, or thrombus on angiography.",
      "<b>Type 1</b>: plaque rupture or erosion with thrombus. This is the NSTEMI that gets DAPT, anticoagulation and a cath.",
      "<b>Type 2</b>: oxygen supply/demand mismatch (anemia, tachyarrhythmia, hypotension, hypoxia, severe hypertension, spasm, coronary embolism) usually with stable CAD. Treat the cause. No DAPT, no urgent cath. Prognosis is often worse than type 1 because of the illness.",
      "<b>Non-ischemic myocardial injury</b>: troponin rises without ischemia (sepsis, PE, myocarditis, HF, stroke, renal failure, chemo, contusion). Chronic injury: stable elevated values (CKD, HF, amyloid).",
      "A trigger does not rule out type 1: older patients with sepsis can rupture a plaque. Persisting ECG changes or a new regional wall-motion abnormality after the trigger is fixed should push you to type 1 and a cardiology discussion."])}</details>`;
}

function drawRisk(x) {
  $("risksum").textContent = x.g.score != null ? x.g.text : "";
  $("risk").innerHTML = `<div class="mini"><div><div class="ttl">${x.g.score != null ? esc(x.g.text) : "GRACE: needs " + esc(x.g.miss.join(", "))}</div>${x.g.items ? `<table>${x.g.items.map((i) => `<tr><td>${esc(i[0])}</td><td class="num">${i[1]}</td></tr>`).join("")}</table>` : ""}
    <div class="muted" style="margin-top:4px">GRACE 108 or less low, 109-140 intermediate, over 140 high (early cath within 24 h). Killip, ST deviation and arrest are your entries.</div></div>
    <div><div class="ttl">${esc(x.tm.text)}</div>${ul(x.tm.items.map(esc))}<div class="muted">TIMI risk factors counted from the problem list (diabetes, hypertension, lipids, smoking, family history). Aspirin in 7 days counted from the medication list.</div></div></div>`;
}

function drawInv(x) {
  const i = x.inv, cls = i.tier === "immediate" ? "t3" : i.tier === "early" ? "t2" : i.tier === "none" ? "t0" : "t1";
  $("invsum").textContent = i.when;
  $("inv").innerHTML = `<div class="verdict ${cls}"><div class="big">${esc(i.when)}</div>${ul(i.why.map(esc))}</div>` + (i.notes.length ? `<div class="alert action">${i.notes.map(esc).join("<br>")}</div>` : "") +
    `<h3>Timing tiers (ESC 2023 / 2025 ACC/AHA)</h3><table class="ref"><tr><th>Tier</th><th>When</th><th>Who</th></tr>
    <tr><td><b>Immediate</b></td><td>Within 2 h</td><td>Shock or unstable, refractory pain, VT/VF or arrest, mechanical complication, acute HF from ischemia, recurrent intermittent ST elevation. Treat as STEMI: call the interventional cardiologist directly.</td></tr>
    <tr><td><b>Early</b></td><td>Within 24 h</td><td>Confirmed NSTEMI (ESC), dynamic ST/T changes, transient ST elevation, GRACE over 140.</td></tr>
    <tr><td><b>Inpatient</b></td><td>This admission</td><td>Intermediate risk: diabetes, eGFR under 60, LVEF under 40%, early post-infarct angina, prior PCI/CABG, GRACE 109-140.</td></tr>
    <tr><td><b>Selective</b></td><td>After testing</td><td>Low risk with no recurrence: non-invasive ischemia test or CT coronary angiography first.</td></tr>
    <tr><td><b>Conservative</b></td><td>No cath</td><td>Type 2 MI / injury; or after shared decision when frailty, dementia, life expectancy, bleeding or patient wishes outweigh benefit. Still give medical therapy (DAPT if type 1 and bleeding risk allows).</td></tr></table>
    <h3>What to have ready when you call cardiology</h3>${ul(["Troponin values with times, ECGs (first and with pain), GRACE score", "Creatinine/eGFR (contrast), Hb, platelets, INR, last DOAC dose and time", "Allergies (contrast), bleeding history, frailty and goals of care, prior PCI/CABG", "What antiplatelets and anticoagulant have been given (drug, dose, time)"])}`;
}

function drawRv(x) {
  const r = x.rv;
  $("rvsum").textContent = r.rec;
  $("rv").innerHTML = `<div class="rv rv-${r.tone || "info"}"><div class="big">${esc(r.rec)}</div>${ul(r.why.map(esc))}${r.heart ? '<div><b>Heart team</b> (interventional cardiologist + cardiac surgeon) should decide.</div>' : ""}</div>` + (r.notes.length ? ul(r.notes.map(esc)) : "");
  $("rvref").innerHTML = `<table class="ref"><tr><th>Anatomy</th><th>Usually</th><th>Notes</th></tr>
    <tr><td>No obstructive CAD</td><td>No stent/bypass</td><td>MINOCA work-up: cardiac MRI, spasm, SCAD, embolism, takotsubo, myocarditis.</td></tr>
    <tr><td>1-vessel, not proximal LAD</td><td><b>PCI</b></td><td>Culprit PCI at the time of angiography.</td></tr>
    <tr><td>1-2 vessel with proximal LAD</td><td>PCI or CABG</td><td>CABG (LIMA to LAD) favoured with diabetes, low EF or complex anatomy.</td></tr>
    <tr><td>3-vessel, no diabetes</td><td>SYNTAX 22 or less: either. Over 22: <b>CABG</b></td><td>SYNTAX trial.</td></tr>
    <tr><td>3-vessel with diabetes</td><td><b>CABG</b></td><td>FREEDOM: fewer deaths and MIs than PCI. PCI if surgery is high risk.</td></tr>
    <tr><td>Left main</td><td>SYNTAX 22 or less: either. 23-32: CABG favoured. Over 32: <b>CABG</b></td><td>EXCEL, NOBLE.</td></tr>
    <tr><td>Multivessel with LVEF 35% or less</td><td><b>CABG</b></td><td>STICH: better 10-year survival.</td></tr>
    <tr><td>Needs valve or aortic surgery</td><td><b>CABG</b> with it</td><td></td></tr>
    <tr><td>Any anatomy, very high surgical risk</td><td>PCI or medical</td><td>Frailty, porcelain aorta, prior sternotomy with patent LIMA, severe lung or liver disease, dialysis, limited life expectancy. STS score.</td></tr>
    <tr><td>Medical therapy only</td><td>No revascularization</td><td>Diffuse small-vessel disease, no suitable targets, patient choice, high bleeding or procedural risk.</td></tr></table>
    <div class="muted" style="margin-top:6px">In NSTEMI the culprit is usually stented during the first angiogram; other significant lesions are treated during the same admission or soon after (complete revascularization, 2025 ACC/AHA). If CABG is likely, the cath lab may hold the P2Y12 load until the anatomy is known.</div>`;
}

function drawAT(x) {
  const p = x.p2, f = state.f, cur = f ? [].concat(f.cls.asa, f.cls.tic, f.cls.pra, f.cls.clop, f.cls.doac, f.cls.warf, f.cls.lmwh, f.cls.ufh, f.cls.fond) : [];
  $("atsum").textContent = p.pick ? "P2Y12: " + p.pick : "";
  const acRows = [["Fondaparinux", x.ac.fond, x.ac.pick === "fond"], ["Enoxaparin", x.ac.enox, x.ac.pick === "enox" || x.ac.pick === "ufh-or-enox"], ["Unfractionated heparin", x.ac.ufh, x.ac.pick === "ufh" || x.ac.pick === "ufh-or-enox"]];
  const typeNo = ["t2", "injury", "chronic", "noMI"].includes(x.type.kind);
  $("at").innerHTML = (cur.length ? `<div class="alert info"><b>On the chart now:</b>${esc(cur.join("; "))}</div>` : "") +
    (typeNo ? `<div class="verdict t1"><div class="big">No DAPT, no therapeutic anticoagulation for this troponin</div><div>${esc(x.type.label)}. Aspirin 81 mg alone if known CAD; VTE prophylaxis as usual.</div></div>` :
    `<h3>1. Aspirin (everyone with type 1 NSTEMI unless true allergy)</h3>${ul(["160-325 mg chewed once (non-enteric coated), then 81 mg daily lifelong.", "True aspirin allergy: clopidogrel alone, or desensitization (cardiology)."])}
    <h3>2. P2Y12 inhibitor: <span style="color:var(--accent)">${esc(p.pick)}</span></h3>${p.load ? ul([`Load: ${esc(p.load)}`, `Then: ${esc(p.maint)}`]) : ""}${ul(p.why.map(esc))}${p.avoid.length ? box("urgent", "Not for this patient / caution", p.avoid.map(esc)) : ""}${p.timing ? `<div class="muted">${esc(p.timing)}</div>` : ""}
    <h3>3. Parenteral anticoagulant (pick one)</h3>${x.ac.list.map((a) => `<div class="alert ${a.lvl}">${esc(a.a)}</div>`).join("")}
    <table class="ref"><tr><th>Drug</th><th>Dose for this patient (check pharmacy)</th></tr>${acRows.map((r) => `<tr${r[2] ? ' class="match"' : ""}><td><b>${r[0]}</b>${r[2] ? "<br>suggested" : ""}</td><td>${r[1] || "<span class='err'>Not with this kidney function</span>"}</td></tr>`).join("")}</table>
    <div class="muted">${esc(x.ac.duration)} Immediate cath or CrCl under 15: UFH. Going to cath within 24 h: enoxaparin or UFH. Medical / later cath: fondaparinux. Do not switch between heparins.</div>`) +
    `<h3>Comparison of P2Y12 inhibitors</h3><table class="ref"><tr><th></th><th>Ticagrelor</th><th>Prasugrel</th><th>Clopidogrel</th></tr>
    <tr><td>Dose</td><td>180 mg, then 90 mg BID</td><td>60 mg, then 10 mg daily (5 mg if under 60 kg)</td><td>300-600 mg, then 75 mg daily</td></tr>
    <tr><td>Use when</td><td>Default for NSTEMI: PCI, CABG-bound or medical</td><td>At PCI once anatomy known; under 75, no stroke/TIA</td><td>With OAC; high bleeding risk; ticagrelor/prasugrel not possible</td></tr>
    <tr><td>Avoid</td><td>Prior ICH, strong CYP3A4 inhibitors/inducers, ASA over 100 mg</td><td>Prior stroke/TIA, ICH, age 75+, medical management</td><td>Omeprazole/esomeprazole (use pantoprazole)</td></tr>
    <tr><td>Hold before CABG</td><td>3 days (often 5)</td><td>7 days</td><td>5 days</td></tr>
    <tr><td>Side effects</td><td>Dyspnea (about 14%, usually mild), bradycardia, more bleeding</td><td>Most bleeding</td><td>Variable response (CYP2C19)</td></tr></table>`;
}

function drawDapt(x) {
  const h = x.hb, d = x.dp;
  $("daptsum").textContent = d.headline;
  $("hbr").innerHTML = `<div class="alert ${h.isHBR ? "action" : "info"}"><b>${esc(h.text)}</b>${h.major.length ? "<br>Major: " + esc(h.major.join("; ")) : ""}${h.minor.length ? "<br>Minor: " + esc(h.minor.join("; ")) : ""}</div>
    <div class="muted">High bleeding risk = 1 major or 2 minor criteria (ARC-HBR). Chart finds anticoagulants, eGFR, Hb, platelets, cirrhosis, ICH/stroke, bleeding disorders, NSAIDs/steroids; tick the rest above.</div>`;
  $("dapt").innerHTML = `<div class="verdict ${d.months >= 12 ? "t1" : d.months ? "t2" : "t0"}"><div class="big">${esc(d.headline)}</div></div>${ul(d.steps.map(esc))}
    <h3>Who needs DAPT</h3>${ul(["<b>Yes:</b> type 1 NSTEMI, whether treated with PCI, CABG or medicines alone. Default 12 months.", "<b>Shorter (1-3 months):</b> high bleeding risk; after 1 month most can drop aspirin and stay on ticagrelor alone.", "<b>Not DAPT:</b> type 2 MI, non-ischemic injury, chronic troponin elevation, MINOCA without plaque (decide with cardiology).", "<b>On an anticoagulant:</b> no long-term DAPT: anticoagulant + clopidogrel, aspirin for up to 1 week only."])}`;
}

function drawMeds(x) {
  const f = state.f, s = x.s;
  const giRisk = [];
  if (s.age >= 65) giRisk.push("age 65+"); if (prob("gibleed")) giRisk.push("prior GI bleed / ulcer"); if (x.oac) giRisk.push("on anticoagulant"); if (has("steroid")) giRisk.push("steroid"); if (has("nsaid")) giRisk.push("NSAID");
  const shockRisk = (s.age > 70 ? 1 : 0) + (s.hr > 110 ? 1 : 0) + (s.sbp != null && s.sbp < 120 ? 1 : 0) >= 2;
  const L = R.otherMeds({ sbp: s.sbp, hr: s.hr, killip: s.killip, lvef: s.lvef, shockRisk, avBlock: prob("avb") && !prob("pacer"), asthma: prob("asthma"), cocaine: has("cocaine") || $$(".trig:checked").some((c) => c.value === "spasm"),
    ldl: x.c.ldl && x.c.ldl.v, onStatin: f ? f.cls.statin.join("; ") : "", dm: prob("dm"), ckd: prob("ckd") || (s.egfr != null && s.egfr < 60), htn: prob("htn"), hf: prob("hf") || s.killip >= 2, k: x.c.k && x.c.k.v,
    pde5: has("pde5"), rvInfarct: false, spo2: s.spo2, giRisk, onPPI: has("ppi"), ppiName: f ? f.cls.ppi.join("; ") : "", onClop: has("clop") || x.p2.pick === "Clopidogrel", nsaids: f ? f.cls.nsaid : [],
    onBB: has("bb"), onACE: has("acei") || has("arb") || has("arni"), onMRA: has("mra"), onSGLT2: has("sglt2") });
  const lab = { ok: "GIVE", have: "ON IT", caution: "CAUTION", avoid: "AVOID", consider: "CONSIDER", info: "" };
  const cls = { ok: "st-ok", have: "st-ok", caution: "st-caution", avoid: "st-avoid", consider: "muted", info: "muted" };
  $("meds").innerHTML = `<table class="agent"><tr><th>Medication</th><th></th><th>For this patient</th></tr>${L.map((m) => `<tr><td><b>${esc(m.name)}</b></td><td class="${cls[m.st]}">${lab[m.st]}</td><td>${m.text}</td></tr>`).join("")}</table>`;
}

function drawAlerts(x) {
  const f = state.f;
  const hbs = f && f.l.hb ? f.l.hb.filter((p) => Date.now() - p.t < 4 * DAY) : [];
  const hbDrop = hbs.length >= 2 ? Math.round(Math.max(...hbs.map((p) => p.v)) - hbs[hbs.length - 1].v) : null;
  const A = R.alerts({ meds: f ? f.allMeds : [], type: x.type.kind, hb: x.c.hb && x.c.hb.v, hbDrop, plt: x.c.plt && x.c.plt.v, k: x.c.k && x.c.k.v, mg: x.c.mg && x.c.mg.v, qtc: num("qtc") || (x.c.qtc && x.c.qtc.v), cl: x.s.cl,
    ticagrelor: has("tic"), prasugrel: has("pra"), clopidogrel: has("clop"), asaHigh: f && f.asaHigh, oac: has("doac") || has("warf"), heparinTx: f && f.heparinTx, heparin: has("lmwh") || has("ufh"), lowEF: x.s.lvef != null && x.s.lvef <= 40 });
  if (x.managed === "cabg" && (has("tic") || has("pra") || has("clop"))) A.unshift({ lvl: "action", t: "CABG planned and a P2Y12 inhibitor is ordered: ask the surgeon when to stop it (ticagrelor 3-5 days, clopidogrel 5, prasugrel 7). Keep aspirin." });
  $("alertsum").textContent = A.length ? A.length + " to review" : "";
  $("alerts").innerHTML = (A.length ? A.map((a) => `<div class="alert ${a.lvl}">${esc(a.t)}</div>`).join("") : '<div class="muted">No alerts from the medications and labs found.</div>') +
    (f && f.allMeds.length ? `<div class="src">Medications read: ${esc([...new Set(f.allMeds)].slice(0, 30).join("; "))}</div>` : "");
}

function drawTests(x) {
  const c = x.c, L = R.workup({ trop: x.tropS.length, tropLast: x.tropS[x.tropS.length - 1], ecgDone: $("ecgisch").checked || $("stdev").checked ? true : null, echo: num("lvef") != null ? { v: num("lvef"), lvef: 1 } : null, hb: c.hb, cr: c.cr, ldl: c.ldl, a1c: c.a1c, inr: c.inr, tsh: c.tsh });
  const val = (v) => (v && typeof v === "object" ? (v.lvef ? ` <b>LVEF ${v.v}%</b>` : ` <b>${Math.round(v.v * 100) / 100}</b>${v.t ? " (" + ago(v.t) + ")" : ""}`) : "");
  $("tests").innerHTML = '<ul class="check">' + L.map((t) => `<li class="${t.have ? "have" : "miss"}">${t.have ? "✓" : "☐"} ${esc(t.t)}${val(t.have)}${t.why ? ` <span class="why">${esc(t.why)}</span>` : ""}</li>`).join("") + "</ul>";
}

function drawFU(x) {
  const typeNo = ["t2", "injury", "chronic", "noMI"].includes(x.type.kind);
  $("fu").innerHTML = typeNo ? ul(["Discharge summary: say clearly <b>type 2 MI / myocardial injury, not type 1</b>, and the trigger, so the next team does not start DAPT.", "Echo result and any outpatient ischemia testing or cardiology referral.", "Statin and aspirin only if atherosclerosis is known or found."]) :
    ul(["<b>Antiplatelet plan in writing:</b> drugs, doses, stop date for each (e.g. 'ticagrelor until ___, then aspirin alone'), and who to call before stopping for a procedure.",
      "Cardiology follow-up in 4-6 weeks; family physician in 1-2 weeks (BP, HR, K/creatinine after ACEi/MRA).",
      "<b>Cardiac rehabilitation referral</b> before discharge (class 1; fewer deaths and readmissions).",
      "Lipids 4-12 weeks after starting the statin: add ezetimibe if LDL 1.8 or more.",
      "Repeat echo at about 3 months if LVEF 35% or less (ICD decision is made after 40 days post-MI / 90 days post-revascularization).",
      "Smoking cessation (varenicline is safe after MI), A1c and diabetes plan (SGLT2i or GLP-1 RA if diabetic), BP under 130/80.",
      "Sublingual nitroglycerin prescription and teaching. Influenza and COVID vaccines.",
      "Driving: no driving for about 1 week after NSTEMI with successful PCI and 1 month without revascularization (private licence; CCS fitness-to-drive): check current CCMTA/RoadSafetyBC rules.",
      "Sexual activity usually fine after 1 week if no symptoms with moderate exertion; no PDE5 inhibitor within 24-48 h of nitrates."]);
}

function drawHandout() { $("handout").innerHTML = handoutHTML(); }
function handoutHTML() {
  const v = (id) => esc($(id).value.trim()), a = v("h-a") || "aspirin ___", b = v("h-b"), until = v("h-until"), fu = v("h-fu"), ph = v("h-phone"), stent = $("h-stent").checked;
  return `<h2 style="margin:0 0 6px">After your heart attack</h2>
    <p>You had a heart attack (a blocked heart artery)${stent ? " and had a stent put in to open it" : ""}. These medicines and steps lower the chance of another one.</p>
    <h3>Your blood thinners: do not stop them on your own</h3><ul><li>${a}</li>${b ? `<li>${b}${until ? ` <b>until ${until}</b>` : ""}</li>` : ""}</ul>
    <p>${stent ? "Stopping these early can cause a clot in the stent, which can be deadly. " : ""}Before any surgery, dental work or procedure, tell the doctor or dentist you take them. They must talk to your heart doctor before stopping either one.</p>
    <h3>Call 9-1-1 if you have</h3><ul><li>Chest pain, pressure or tightness, or pain in the arm, jaw or back, that lasts more than 5 minutes or does not go away 5 minutes after one nitroglycerin spray</li><li>Sudden shortness of breath, fainting, or a very fast or irregular heartbeat</li><li>Signs of a stroke: face drooping, arm weakness, trouble speaking</li><li>Vomiting blood or black, tarry stools; bleeding that will not stop after 10 minutes of pressure</li></ul>
    <p><b>Do not drive yourself.</b> If you have chest pain, sit down and use your nitroglycerin spray: 1 spray under the tongue. If the pain is not gone in 5 minutes, call 9-1-1, then you may take a 2nd spray.</p>
    <h3>Go to the emergency department or call your doctor the same day if</h3><ul><li>Bruising much more than usual, nosebleeds that last over 10 minutes, blood in your urine</li><li>Swelling, pain or a lump at the wrist or groin where the catheter went in</li><li>New shortness of breath when lying flat, or legs swelling${$("h-a").value.match(/ticagrelor/i) || $("h-b").value.match(/ticagrelor/i) ? "</li><li>Shortness of breath from ticagrelor is common and usually mild: tell your doctor, do not just stop it" : ""}</li></ul>
    <h3>Other things that help</h3><ul><li>Take a cholesterol pill (statin) every day, even if your cholesterol was normal</li><li>Go to cardiac rehab: it lowers the chance of dying and coming back to hospital</li><li>Stop smoking (ask about free help: QuitNow 1-877-455-2233)</li><li>No ibuprofen (Advil, Motrin) or naproxen (Aleve). Use acetaminophen (Tylenol) for pain</li><li>No Viagra or Cialis within 24-48 hours of nitroglycerin</li></ul>
    ${fu || ph ? `<h3>Follow-up</h3><p>${fu}${ph ? `<br>Phone: ${ph}` : ""}</p>` : ""}`;
}

function noteText(x) {
  const s = x.s, L = [];
  L.push(`${s.age ?? "?"}${s.sex ? s.sex[0].toUpperCase() : ""} with ${x.type.label}.`);
  L.push(`hs-troponin: ${x.tropS.map((p) => Math.round(p.v)).join(" -> ") || "none"} ng/L (99th percentile ${x.url}). ${x.type.isch.length ? "Ischemia: " + x.type.isch.join(", ") + "." : ""}${x.trigs.length ? " Triggers: " + x.trigs.join(", ") + "." : ""}`);
  L.push(`HR ${s.hr ?? "?"}, SBP ${s.sbp ?? "?"}, Killip ${s.killip}. ${x.g.score != null ? x.g.text + ". " : ""}${x.tm.text}. ${s.lvef != null ? "LVEF " + s.lvef + "%. " : ""}CrCl ${s.cl ?? "?"} mL/min. ${x.hb.text}${x.hb.major.concat(x.hb.minor).length ? " (" + x.hb.major.concat(x.hb.minor).join(", ") + ")" : ""}.`);
  L.push("", "Assessment: " + x.type.label + ". " + x.type.text, "", "Plan:");
  if (["t2", "injury", "chronic", "noMI"].includes(x.type.kind)) {
    L.push("- Treat underlying cause" + (x.trigs.length ? ": " + x.trigs.join(", ") : "") + ".", "- No DAPT / therapeutic anticoagulation for this troponin pattern. VTE prophylaxis.", "- Repeat ECG/troponin after trigger corrected; echo; outpatient ischemia assessment if CAD suspected.");
  } else {
    L.push(`- Cath: ${x.inv.when}.${x.inv.against.length ? " Discuss conservative approach given " + x.inv.against.join(", ") + "." : ""}`);
    L.push("- ASA 81 mg daily (loaded).");
    if (x.p2.pick && !["None", "Hold"].includes(x.p2.pick)) L.push(`- ${x.p2.pick} ${x.p2.maint.split("(")[0].trim()}.`);
    if (!(has("doac") || has("warf"))) L.push(`- Anticoagulation: ${{ fond: "fondaparinux 2.5 mg SC daily", enox: "enoxaparin 1 mg/kg SC q12h", ufh: "IV heparin per ACS nomogram", "ufh-or-enox": "IV heparin per ACS nomogram (or enoxaparin 1 mg/kg daily)" }[x.ac.pick]} until PCI or up to 8 days if medical.`);
    else L.push("- On oral anticoagulant: held; parenteral anticoagulation timing per cardiology.");
    L.push(`- DAPT plan: ${x.dp.headline}.`);
    if (x.rv.rec && $("anatomy").value !== "unknown") L.push(`- Revascularization: ${x.rv.rec}${x.rv.heart ? " (heart team)" : ""}.`);
    L.push("- High-intensity statin; beta-blocker if no HF/shock risk; ACEi/ARB as indicated; PPI; stop NSAIDs.", "- Echo, lipids, A1c. K 4.0+, Mg 0.8+. Telemetry.", "- Cardiac rehab referral; written antiplatelet stop dates at discharge.");
  }
  return L.join("\n");
}

/* ---- load ---- */
$("srisk").innerHTML = ["Frailty 7+", "Prior sternotomy (CABG)", "Severe COPD", "Cirrhosis", "Dialysis", "Porcelain aorta", "Prior chest radiation", "Prohibitive STS risk"].map((o) => `<label class="inl"><input type="checkbox" class="sr" value="${esc(o)}"> ${esc(o)}</label>`).join(" ");
function autoTicks(preset) {
  const f = state.f, p = (preset && preset.sit) || {}, now = Date.now();
  const L = (id, d) => (f ? C.latest(f.l[id], d * DAY, now) : null), V = (id) => (f && f.v[id] ? f.v[id].filter((x) => now - x.t < DAY) : []);
  const trig = new Set(p.triggers || []);
  if (f) {
    const hb = L("hb", 3); if (hb && hb.v < 90) trig.add("anemia");
    if (V("hr").some((x) => x.v >= 120)) trig.add("tachy"); if (V("sbp").some((x) => x.v < 90) && !(p.vh || []).includes("shock")) trig.add("hypotension");
    if (V("spo2").some((x) => x.v < 88)) trig.add("hypoxia"); if (prob("sepsis") || (L("lactate", 2) && L("lactate", 2).v >= 2 && !(p.vh || []).includes("shock"))) trig.add("sepsis");
    if (V("sbp").some((x) => x.v >= 180)) trig.add("htn"); if (V("hr").some((x) => x.v < 40)) trig.add("brady"); if (has("cocaine")) trig.add("spasm");
  }
  $$(".trig").forEach((el) => (el.checked = trig.has(el.value)));
  $$(".vh").forEach((el) => (el.checked = (p.vh || []).includes(el.value)));
  $("symp").checked = !!p.symptoms; $("ecgisch").checked = !!p.ecgIsch; $("wma").checked = !!p.wma; $("thromb").checked = !!p.angioThrombus;
  $("stdev").checked = !!p.stDev; $("dynst").checked = !!p.dynamicST; $("tste").checked = false; $("url").value = "";
  $("killip").value = String(p.killip || 1); $("arrest").checked = false; $("angina2").checked = false; $("lvef").value = p.lvef ?? "";
  $("cfs").value = p.frail ? String(p.frail) : ""; $("dementia").checked = !!p.dementia || prob("dementia"); $("lifelim").checked = false; $("declines").checked = false; $("bleeding").checked = false;
  $("managed").value = p.managed || "pending"; $("anatomy").value = p.anatomy || "unknown"; $("plad").checked = !!p.proxLAD; $("syntax").value = p.syntax ?? "";
  $("complex").checked = false; $("valve").checked = false; $("culprit").checked = !!p.culpritPCI;
  $("b6").checked = !!p.bleed6; $("b12").checked = !!p.bleed12; $("bsurg").checked = false; $("bca").checked = prob("cancer");
  ["o-hr", "o-sbp", "o-kg", "qtc"].forEach((id) => ($(id).value = ""));
  const sr = { "Prior sternotomy (CABG)": prob("priorCABG"), "Severe COPD": prob("copd"), Cirrhosis: prob("cirrhosis"), Dialysis: prob("dialysis"), "Frailty 7+": (p.frail || 0) >= 7 };
  $$(".sr").forEach((el) => { el.checked = !!sr[el.value]; });
}
function load(raw, note, errors, preset) {
  state.f = raw ? C.parse(raw) : null;
  autoTicks(preset);
  $("ptsum").textContent = state.f ? [state.f.sex, state.f.age != null ? state.f.age + " y" : "", state.f.kg ? state.f.kg + " kg" : ""].filter(Boolean).join(", ") : "";
  $("pstatus").textContent = note; $("clear").hidden = !raw;
  $("errs").innerHTML = errors && errors.length ? "Could not read: " + errors.map(esc).join("; ") + (errors.some((e) => /\b40[13]\b|Unauthorized|Forbidden/i.test(e)) ? ". Check the scopes in the Code Console." : ". Cerner's sandbox can be slow: reload the patient to try again.") : "";
  draw();
}
$$(".inputs input, .inputs select").forEach((el) => { if (el.id === "testsel" || el.closest(".handout")) return; el.addEventListener(el.type === "number" ? "input" : "change", draw); });
["h-a", "h-b", "h-until", "h-fu", "h-phone"].forEach((id) => ($(id).oninput = drawHandout)); $("h-stent").onchange = drawHandout;
$("h-print").onclick = () => { const w = window.open("", "_blank"); if (!w) return; w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>After your heart attack</title><style>body{font:16px/1.5 system-ui,sans-serif;max-width:720px;margin:24px auto;padding:0 16px}h3{margin:16px 0 4px}</style></head><body>${handoutHTML()}</body></html>`); w.document.close(); w.focus(); };
$("copy").onclick = () => { $("note").select(); try { navigator.clipboard.writeText($("note").value); } catch (e) { document.execCommand("copy"); } };
$("clear").onclick = () => { $("testsel").value = ""; load(null, "Open from Cerner to read the chart, or pick a made-up patient:"); };
const SAMPLES = window.ACS_SAMPLES || [];
SAMPLES.forEach((p, i) => { const o = document.createElement("option"); o.value = i; o.textContent = p.label; $("testsel").appendChild(o); });
$("testsel").onchange = () => { const p = SAMPLES[$("testsel").value]; if (!p) return $("clear").onclick(); load(p.build(Date.now()), "Made-up patient: " + p.label, [], p); };

async function fromChart() {
  if (typeof FHIR === "undefined" || !(location.search.includes("code=") || location.search.includes("complete=") || sessionStorage.getItem("SMART_KEY"))) return;
  $("pstatus").textContent = "Reading the chart…";
  try {
    const client = await FHIR.oauth2.ready();
    const { raw, errors } = await C.gather(client, (msg) => ($("pstatus").textContent = msg));
    load(raw, "Chart read (read-only). Nothing is sent anywhere. Tick the ECG and symptom boxes above.", errors);
  } catch (e) { $("pstatus").textContent = "Could not read the chart: " + (e && e.message ? e.message : e) + ". The made-up patients still work."; }
}
const demo = new URLSearchParams(location.search).get("demo");
if (demo && SAMPLES[+demo - 1]) { $("testsel").value = String(+demo - 1); $("testsel").onchange(); } else { draw(); fromChart(); }
