/* AF in acute illness page. Read-only from the chart; your selections stay in this page. UNVERIFIED draft. */
const R = window.AFRules, C = window.AFChart, DAY = C.DAY, HR = C.HR;
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const ago = (t) => { const h = (Date.now() - t) / HR; return h < 1 ? Math.max(1, Math.round(h * 60)) + " min ago" : h < 48 ? Math.round(h) + " h ago" : Math.round(h / 24) + " d ago"; };
const ul = (a) => "<ul>" + a.filter(Boolean).map((t) => "<li>" + t + "</li>").join("") + "</ul>";
const num = (id) => { const v = parseFloat($(id).value); return isFinite(v) ? v : null; };
const state = { f: null };
const has = (k) => !!(state.f && state.f.cls[k] && state.f.cls[k].length);
const prob = (k) => !!(state.f && state.f.prob[k]);

/* everything the rules need, chart values with typed overrides */
function facts() {
  const f = state.f, now = Date.now(), L = (id, d) => (f ? C.latest(f.l[id], d * DAY, now) : null), V = (id, d) => (f ? C.latest(f.v[id], d * DAY, now) : null);
  const hrO = num("o-hr"), sbpO = num("o-sbp"), kgO = num("o-kg");
  const hr = hrO != null ? { v: hrO, typed: true } : V("hr", 1), sbp = sbpO != null ? { v: sbpO, typed: true } : V("sbp", 1);
  const kg = kgO != null ? kgO : f && f.kg ? f.kg : null, age = f ? f.age : null, sex = f ? f.sex : "", cr = L("cr", 7);
  const cl = R.crcl(age, kg, cr && cr.v, sex);
  const c = { k: L("k", 3), mg: L("mg", 3), cr, hb: L("hb", 7), tsh: L("tsh", 30), trop: L("trop", 3), bnp: L("bnp", 7), lactate: L("lactate", 2), lft: L("alt", 30), inr: L("inr", 7), dig: L("dig", 7), qtc: L("qtc", 3) };
  const qtc = num("qtc") != null ? num("qtc") : c.qtc ? c.qtc.v : null;
  const onset = $("onset").value, onsetH = onset === "lt48" ? 24 : onset === "ge48" ? 72 : null;
  const s = {
    hr: hr ? Math.round(hr.v) : null, sbp: sbp ? Math.round(sbp.v) : null, age, kg, sex, scr: cr ? cr.v : null, cl, k: c.k && c.k.v, mg: c.mg && c.mg.v, qtc, onsetH,
    unstable: { hypo: $("u-hypo").checked, ischemia: $("u-isch").checked, edema: $("u-edema").checked, mentation: $("u-ment").checked },
    preexc: $("rhythm").value === "preexc", mat: $("rhythm").value === "mat", flutter: $("rhythm").value === "flutter",
    lvefLow: $("lvef").value === "low", lvefKnown: $("lvef").value !== "unknown", decompHF: $("decomp").checked, bronchospasm: $("bronch").checked, npo: $("npo").checked, dry: $("dry").checked,
    pressors: has("pressor"), onBB: has("bb"), onDilt: has("dilt"), onDig: has("dig"), onAmio: has("amio"), homeBBheld: !!(f && f.heldBB.length),
    inSinus: $("ongoing").value === "no", sepsis: prob("sepsis") || (c.lactate && c.lactate.v >= 2), ecgDone: $("ecg").checked, echoDone: $("echo").checked };
  const risk = { age, sex, kg, scr: s.scr, cl, sbp: s.sbp, hf: prob("hf") || s.lvefLow, htn: prob("htn"), dm: prob("dm"), stroke: prob("stroke"), vascular: prob("vascular"),
    ckdSevere: prob("ckd45") || (cl != null && cl < 30), liver: prob("liver"), bleed: prob("bleed"), anemia: c.hb && c.hb.v < 100, antiplatelet: has("antiplt"), nsaid: has("nsaid"),
    alcohol: prob("alcohol"), falls: prob("falls") || prob("dementia"), mechValve: prob("mech"), mitralStenosis: prob("ms") };
  return { s, c, hr, sbp, risk };
}

function tile(k, big, sub, tone) { return `<div class="tile ${tone || ""}"><div class="k">${k}</div><div class="big">${big}</div><div class="s">${sub || ""}</div></div>`; }

function draw() {
  const x = facts(), s = x.s, a = R.assess(s), ac = R.anticoag(x.risk, { ongoing: $("ongoing").value === "yes", durationH: s.onsetH, rhythmControl: s.onAmio });
  // tiles
  const hrT = s.hr == null ? "t1" : s.hr >= 130 ? "t3" : s.hr >= 110 ? "t2" : "t0", bpT = s.sbp == null ? "t1" : s.sbp < 90 ? "t3" : s.sbp < 100 ? "t2" : "t0";
  const kT = (s.k != null && s.k < 4) || (s.mg != null && s.mg < 0.8) ? "t2" : "t0";
  $("tiles").innerHTML = [
    tile("Heart rate", s.hr ?? "?", x.hr ? (x.hr.typed ? "typed" : ago(x.hr.t)) + (s.hr >= 110 ? " · target under 110" : "") : "no recent value", hrT),
    tile("Systolic BP", s.sbp ?? "?", x.sbp ? (x.sbp.typed ? "typed" : ago(x.sbp.t)) + (s.pressors ? " · ON VASOPRESSOR" : "") : "no recent value", s.pressors ? "t3" : bpT),
    tile("CHADS-65", ac.chads65.rec === "oac" ? "OAC" : ac.chads65.rec === "antiplatelet" ? "ASA" : "None", esc(ac.chads65.why), ac.chads65.rec === "oac" ? "t2" : "t0"),
    tile("CHA₂DS₂-VASc", x.risk.age != null ? ac.cv.score : "?", ac.cv.items.map((i) => i[0]).join(", ") || "none", "t1"),
    tile("CrCl (Cockcroft-Gault)", s.cl != null ? s.cl : "?", s.cl != null ? `creatinine ${Math.round(s.scr)}, ${s.kg} kg` : "needs age, weight, creatinine", s.cl != null && s.cl < 30 ? "t3" : s.cl != null && s.cl < 50 ? "t2" : "t1"),
    tile("K / Mg", `${s.k ?? "?"} / ${s.mg != null ? Math.round(s.mg * 100) / 100 : "?"}`, "aim K 4.0+, Mg 0.8-1.0+", kT)].join("");
  // plan
  const box = (cls, h, items) => items.length ? `<div class="${cls}"><h3>${h}</h3>${ul(items)}</div>` : "";
  const fmt = (o) => `<b>${esc(o.a)}</b>${o.why ? `<br><span class="muted">${esc(o.why)}</span>` : ""}`;
  const hint = s.sbp != null && s.sbp < 90 && !s.unstable.hypo ? `<div class="alert action"><b>SBP ${s.sbp}.</b>Is the AF causing the low BP? If yes, tick "Hypotension / shock" above.</div>` : "";
  $("plansum").textContent = a.headline;
  $("plan").innerHTML = `<div class="verdict ${a.tier === "urgent" ? "t3" : a.tier === "ok" ? "t0" : a.tier === "info" ? "t1" : "t2"}"><div class="big">${esc(a.headline)}</div>${a.route ? `<div>${esc(a.route)}</div>` : ""}</div>` + hint +
    box(a.tier === "urgent" ? "urgent" : "action", "Do first", a.first.map(fmt)) + box("", "Also / next", a.also.map(fmt)) + box("urgent", "Avoid", a.avoid.map(fmt)) +
    (a.notes.length ? ul(a.notes.map(esc)) : "") + `<div class="muted">Recheck heart rate and BP 15-30 min after an IV dose and 1-2 h after an oral dose. A rate under 110 at rest is the target; it does not need to be under 80.</div>`;
  drawTrend(); drawAgents(s); drawTrigger(s, x.c); drawTests(x.c, s); drawAlerts(s); drawAC(ac); drawEscalate(a, s);
  $("note").value = noteText(x, a, ac);
}

/* ---- agent comparison ---- */
function drawAgents(s) {
  const lowBP = s.sbp != null && s.sbp < 90, bord = s.sbp != null && s.sbp >= 90 && s.sbp < 100, hf = s.lvefLow || s.decompHF;
  const M = R.metoprolol(s.age || 70, s.sbp), D = R.diltiazem(s.age || 70, s.kg, s.sbp), G = R.digoxin(s.age || 70, s.kg, s.cl, s.onAmio);
  const st = (v, why) => ({ v, why });
  const rows = [
    ["Beta-blocker (metoprolol)", lowBP || s.pressors || s.decompHF ? st("avoid", "Low BP, vasopressor or decompensated HF") : s.bronchospasm ? st("caution", "Active bronchospasm: cardioselective, low dose") : bord ? st("caution", "SBP 90-99: oral low dose only") : st("ok", hf ? "HFrEF: low dose, long-term agent" : "First line (CCS 2020)"),
      `IV: ${M.iv}<br>PO: ${M.po}`, "Minutes (IV), 1-2 h (PO)", "Low BP, bronchospasm, heart block. Best if ischemic heart disease or on one at home."],
    ["Diltiazem", lowBP || s.pressors || hf ? st("avoid", hf ? "LVEF 40% or less / HF" : "Low BP or vasopressor") : !s.lvefKnown ? st("caution", "LVEF unknown: check for HF first") : bord ? st("caution", "SBP 90-99") : st("ok", s.bronchospasm ? "Good choice with bronchospasm" : "First line if LVEF over 40%"),
      `IV: ${D.iv}<br>PO: ${D.po}`, "Minutes (IV), 1-2 h (PO)", "Drops BP the most; negative inotrope. Raises digoxin and some DOAC levels."],
    ["Digoxin", s.cl != null && s.cl < 15 ? st("caution", "CrCl under 15: specialist dosing") : st(hf || bord || lowBP ? "ok" : "caution", hf || bord || lowBP ? "Does not lower BP or weaken the heart" : "Add-on; slow and weak in sepsis"),
      `Load: ${G.load}<br>Maintain: ${G.maint}${G.why.length ? `<br><span class="muted">Lower dose for ${G.why.join(", ")}</span>` : ""}`, "Hours (peak 6 h IV)", "Toxicity with low K/Mg, kidney impairment, amiodarone, clarithromycin. " + G.level],
    ["Amiodarone", s.pressors || lowBP ? st("ok", "Option with low BP / vasopressor (monitored bed)") : hf ? st("caution", "2nd line in HFrEF after digoxin") : st("caution", "Reserve: if 2 agents fail"),
      `IV: ${R.AMIO.iv}<br>PO: ${R.AMIO.po}`, "Hours", "Can convert to sinus: stroke risk if AF 48 h+ without anticoagulation. QT, phlebitis, liver, thyroid; raises warfarin and digoxin levels."]];
  $("agents").innerHTML = `<table class="agent"><tr><th>Drug</th><th>For this patient</th><th>Dose (typical, check pharmacy)</th><th>Onset</th><th>Watch for</th></tr>` +
    rows.map((r) => `<tr><td><b>${r[0]}</b></td><td class="st-${r[1].v}">${r[1].v.toUpperCase()}<br><span class="muted" style="font-weight:400">${esc(r[1].why)}</span></td><td>${r[2]}</td><td>${r[3]}</td><td>${esc(r[4])}</td></tr>`).join("") + "</table>" +
    `<div class="muted" style="margin-top:6px"><b>Oral or IV?</b> IV if the rate is 130 or more with symptoms, or if the patient is nil by mouth; otherwise oral. Switch IV to oral as soon as it works. Older patients: start low, recheck, titrate.</div>`;
}

/* ---- trigger checklist ---- */
function drawTrigger(s, c) {
  const f = state.f, L = [];
  L.push("Treat the pneumonia / sepsis (right antibiotic, source control)" + (has("abx") ? ": on " + esc(state.f.cls.abx.slice(0, 3).join("; ")) : ""));
  L.push("Oxygen to target (88-92% if CO2 retainer, else 92-96%)" + (f && f.v.spo2 ? `: last SpO2 ${C.latest(f.v.spo2).v}%` : ""));
  if (s.k != null && s.k < 4) L.push(`<b>Potassium ${s.k}: replace to 4.0 or more</b>`); else L.push("Keep K 4.0 or more");
  if (s.mg != null && s.mg < 0.8) L.push(`<b>Magnesium ${s.mg}: magnesium sulfate 2-4 g IV</b>`); else L.push("Magnesium: aim 0.8-1.0 or more (IV magnesium 2 g also slows the rate)");
  L.push("Volume: fluids if dry; diuresis if overloaded");
  L.push("Fever, pain, anxiety, urinary retention, alcohol withdrawal: treat");
  if (f && f.heldBB.length) L.push(`<b>Home beta-blocker held (${esc(state.f.heldBB.join(", "))}): restart if BP allows (rebound tachycardia)</b>`);
  const ago2 = f ? f.allMeds.filter((m) => /salbutamol|ventolin|albuterol|terbutaline/i.test(m)) : [];
  if (ago2.length) L.push(`<b>Salbutamol on the chart:</b> use regular ipratropium and give salbutamol only as needed`);
  if (prob("thyro") || (c.tsh && c.tsh.v < 0.1)) L.push("<b>Possible hyperthyroidism: check free T4; a beta-blocker is preferred</b>");
  if (s.pressors) L.push("Vasopressors are pro-arrhythmic: use the lowest dose; in ICU consider switching agent (ICU decision)");
  L.push("Think PE if hypoxia or tachycardia is out of proportion to the pneumonia");
  $("trigger").innerHTML = ul(L) + '<div class="muted">AF secondary to acute illness: management should be directed at the underlying cause (CCS 2020 rec 70). Many patients go back to sinus rhythm as the infection settles.</div>';
}

function drawTests(c, s) {
  const L = R.workup(c, s);
  const val = (v) => (v && typeof v === "object" ? ` <b>${Math.round(v.v * 100) / 100}</b> (${ago(v.t)})` : "");
  $("tests").innerHTML = '<ul class="check">' + L.map((x) => `<li class="${x.have ? "have" : "miss"}">${x.have ? "✓" : "☐"} ${esc(x.t)}${val(x.have)}${x.why ? ` <span class="why">${esc(x.why)}</span>` : ""}</li>`).join("") + "</ul>";
}

function drawAlerts(s) {
  const meds = state.f ? state.f.allMeds : [];
  const A = R.interactions(meds, s);
  if (s.qtc >= 500) A.unshift({ lvl: "urgent", t: `QTc ${s.qtc}: stop or switch QT-prolonging drugs; avoid amiodarone unless essential; replace K and Mg.` });
  $("alertsum").textContent = A.length ? A.length + " to review" : "";
  $("alerts").innerHTML = (A.length ? A.map((x) => `<div class="alert ${x.lvl}">${esc(x.t)}</div>`).join("") : '<div class="muted">No interaction or QT alerts from the medications found.</div>') +
    (meds.length ? `<div class="src">Medications read (orders and doses given in 48 h): ${esc([...new Set(meds)].slice(0, 30).join("; "))}</div>` : "");
}

function drawAC(ac) {
  const f = state.f, onOAC = has("doac") || has("warf");
  $("acsum").textContent = onOAC ? "already anticoagulated" : ac.chads65.rec === "oac" ? "CHADS-65 positive" : "";
  $("ac").innerHTML = (onOAC ? `<div class="alert info">Already on: ${esc(state.f.cls.doac.concat(state.f.cls.warf).join("; "))}</div>` : "") + ul(ac.advice.map(esc)) +
    `<h3>If you anticoagulate</h3>` + ul([esc(ac.apix.dose) + ` <span class="muted">(${esc(ac.apix.why || "")})</span>`, esc(ac.riva), "Edoxaban / dabigatran: dose by CrCl (dabigatran not with CrCl under 30)", "Warfarin only for mechanical valve or moderate/severe mitral stenosis"]) +
    (ac.bleed.length ? `<h3>Bleeding risk factors to fix (not a reason on their own to withhold OAC)</h3>` + ul(ac.bleed.map(esc)) : "") +
    (f && f.cls.lmwh.length ? `<div class="muted">Heparin on the chart: ${esc(f.cls.lmwh.join("; "))} (${f.lmwhTherapeutic ? "looks therapeutic" : "looks like prophylaxis"})</div>` : "") +
    `<div class="muted">Before discharge: arrange follow-up with ambulatory rhythm monitoring and an echo if not done, and tell the patient AF often comes back after the illness (ACC/AHA 2023).</div>`;
}

function drawEscalate(a, s) {
  const tag = { now: "Call now", today: "Same day", later: "Planned" };
  const items = a.escalate.slice();
  if (s.k != null && s.k < 3) items.push({ lvl: "today", t: "Potassium under 3.0 with fast AF: monitored bed while replacing" });
  if (s.qtc >= 500) items.push({ lvl: "today", t: "QTc 500+ with AF and QT drugs: telemetry" });
  $("escalate").innerHTML = items.map((e) => `<div class="esc esc-${e.lvl}"><b>${tag[e.lvl]}:</b>${esc(e.t)}</div>`).join("") +
    `<div class="muted" style="margin-top:6px">IM = internal medicine consult (or the senior hospitalist on call, per your local process). Ward rules on IV boluses and infusions differ: diltiazem and amiodarone infusions usually need a monitored bed.</div>`;
}

/* ---- HR / SBP trend with rate-drug markers ---- */
function drawTrend() {
  const f = state.f; if (!f || !f.v.hr) { $("trend").innerHTML = '<div class="muted">No heart rate values in the last 3 days.</div>'; return; }
  const now = Date.now(), t0 = now - 3 * DAY, W = 900, H = 220, P = 34, xs = (t) => P + ((t - t0) / (now - t0)) * (W - P - 10), ys = (v) => H - 24 - ((v - 40) / 140) * (H - 40);
  const line = (a, cls) => a.filter((p) => p.t >= t0).map((p, i) => (i ? "L" : "M") + xs(p.t).toFixed(1) + "," + ys(Math.max(40, Math.min(180, p.v))).toFixed(1)).join(" ");
  const dots = (a, col) => a.filter((p) => p.t >= t0).map((p) => `<circle cx="${xs(p.t).toFixed(1)}" cy="${ys(Math.max(40, Math.min(180, p.v))).toFixed(1)}" r="3" fill="${col}"><title>${new Date(p.t).toLocaleString()}: ${p.v}</title></circle>`).join("");
  const rate = f.admins.filter((m) => m.t >= t0 && (C.MEDCLASS.bb.test(m.text) || C.MEDCLASS.dilt.test(m.text) || C.MEDCLASS.dig.test(m.text) || C.MEDCLASS.amio.test(m.text)));
  const grid = [60, 80, 100, 110, 130, 150].map((v) => `<line x1="${P}" x2="${W - 10}" y1="${ys(v)}" y2="${ys(v)}" stroke="currentColor" opacity="${v === 110 ? 0.5 : 0.12}" ${v === 110 ? 'stroke-dasharray="4 3"' : ""}/><text x="2" y="${ys(v) + 4}">${v}</text>`).join("");
  const days = [0, 1, 2, 3].map((d) => { const t = now - d * DAY; return `<text x="${xs(t) - 20}" y="${H - 4}">${d ? d + " d ago" : "now"}</text>`; }).join("");
  const marks = rate.map((m) => `<g><line x1="${xs(m.t)}" x2="${xs(m.t)}" y1="10" y2="${H - 24}" stroke="#8a5200" opacity=".5"/><text x="${xs(m.t) + 3}" y="18" style="fill:#8a5200">${esc(m.text.split(/\s+/)[0])}</text><title>${esc(m.text)} ${new Date(m.t).toLocaleString()}</title></g>`).join("");
  $("trend").innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="100%" style="color:var(--muted)">${grid}${days}${marks}
    <path d="${line(f.v.hr)}" fill="none" stroke="#c0392b" stroke-width="2"/>${dots(f.v.hr, "#c0392b")}
    ${f.v.sbp ? `<path d="${line(f.v.sbp)}" fill="none" stroke="#0b6bcb" stroke-width="2"/>${dots(f.v.sbp, "#0b6bcb")}` : ""}</svg>
    <div class="muted"><span style="color:#c0392b">● heart rate</span> · <span style="color:#0b6bcb">● systolic BP</span> · dashed line = 110 · brown lines = rate-control doses given</div>`;
}

function noteText(x, a, ac) {
  const s = x.s, f = state.f, rh = { af: "AF", flutter: "atrial flutter", mat: "MAT", preexc: "pre-excited AF" }[$("rhythm").value];
  const L = [];
  L.push(`New ${rh} in the setting of ${prob("sepsis") ? "sepsis / " : ""}${prob("pneumonia") ? "pneumonia" : "acute illness"}.`);
  L.push(`HR ${s.hr ?? "?"}, SBP ${s.sbp ?? "?"}${s.pressors ? " on vasopressor" : ""}. ${$("ongoing").value === "yes" ? "Still in AF" : "Now back in sinus rhythm"}; onset ${{ lt48: "under 48 h", ge48: "48 h or more", unknown: "unknown" }[$("onset").value]}. LVEF ${{ unknown: "unknown", ok: "over 40%", low: "40% or less" }[$("lvef").value]}${s.qtc ? ", QTc " + s.qtc : ""}.`);
  L.push(`K ${s.k ?? "?"}, Mg ${s.mg ?? "?"}, CrCl ${s.cl ?? "?"} mL/min.`);
  L.push("", "Assessment: " + a.headline + ".");
  L.push("Plan:", "- Treat underlying infection; oxygen to target; replace K to 4.0+ and Mg; volume as needed; minimize beta-agonists.");
  a.first.forEach((o) => L.push("- " + o.a));
  a.avoid.forEach((o) => L.push("- Avoid " + o.a + " (" + o.why + ")"));
  L.push(`- Stroke risk: CHADS-65 ${ac.chads65.rec === "oac" ? "positive (" + ac.chads65.why + ")" : ac.chads65.rec}; CHA2DS2-VASc ${ac.cv.score}. ${ac.advice[0] || ""}`);
  L.push("- Echo if not done; TSH; follow-up with rhythm monitoring after discharge.");
  a.escalate.filter((e) => e.lvl === "now").forEach((e) => L.push("- " + e.t));
  return L.join("\n");
}

/* ---- load ---- */
const INPUTS = ["rhythm", "onset", "ongoing", "lvef", "ecg", "echo", "decomp", "bronch", "npo", "dry", "u-hypo", "u-isch", "u-edema", "u-ment"];
function load(raw, note, errors, preset) {
  state.f = raw ? C.parse(raw) : null; const p = (preset && preset.sit) || {};
  $("rhythm").value = p.rhythm || "af"; $("onset").value = p.onset || "lt48"; $("ongoing").value = p.ongoing || "yes";
  $("lvef").value = p.lvef || (state.f && state.f.prob.hf ? "low" : "unknown");
  $("ecg").checked = !!p.ecg; $("echo").checked = !!p.echo; $("bronch").checked = !!p.bronch; $("decomp").checked = !!p.decomp; $("npo").checked = false; $("dry").checked = false;
  ["u-hypo", "u-isch", "u-edema", "u-ment"].forEach((id) => ($(id).checked = false));
  $("qtc").value = p.qtc || ""; ["o-hr", "o-sbp", "o-kg"].forEach((id) => ($(id).value = ""));
  $("ptsum").textContent = state.f ? [state.f.sex, state.f.age != null ? state.f.age + " y" : "", state.f.kg ? state.f.kg + " kg" : ""].filter(Boolean).join(", ") : "";
  $("pstatus").textContent = note; $("clear").hidden = !raw;
  $("errs").innerHTML = errors && errors.length ? "Could not read: " + errors.map(esc).join("; ") + (errors.some((e) => /\b40[13]\b|Unauthorized|Forbidden/i.test(e)) ? ". Check the scopes in the Code Console." : ". Cerner's sandbox can be slow: reload the patient to try again.") : "";
  draw();
}
INPUTS.forEach((id) => ($(id).onchange = draw));
["qtc", "o-hr", "o-sbp", "o-kg"].forEach((id) => ($(id).oninput = draw));
$("copy").onclick = () => { $("note").select(); try { navigator.clipboard.writeText($("note").value); } catch (e) { document.execCommand("copy"); } };
$("clear").onclick = () => { $("testsel").value = ""; load(null, "Open from Cerner to read the chart, or pick a made-up patient:"); };
const SAMPLES = window.AF_SAMPLES || [];
SAMPLES.forEach((p, i) => { const o = document.createElement("option"); o.value = i; o.textContent = p.label; $("testsel").appendChild(o); });
$("testsel").onchange = () => { const p = SAMPLES[$("testsel").value]; if (!p) return $("clear").onclick(); load(p.build(Date.now()), "Made-up patient: " + p.label, [], p); };

async function fromChart() {
  if (typeof FHIR === "undefined" || !(location.search.includes("code=") || location.search.includes("complete=") || sessionStorage.getItem("SMART_KEY"))) return;
  $("pstatus").textContent = "Reading the chart…";
  try {
    const client = await FHIR.oauth2.ready();
    const { raw, errors } = await C.gather(client, (msg) => ($("pstatus").textContent = msg));
    load(raw, "Chart read (read-only). Nothing is sent anywhere. Set the ECG rhythm, onset and LVEF above.", errors);
  } catch (e) { $("pstatus").textContent = "Could not read the chart: " + (e && e.message ? e.message : e) + ". The made-up patients still work."; }
}
draw(); fromChart();
