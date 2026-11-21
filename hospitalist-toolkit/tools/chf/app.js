/* Heart failure page. Read-only from the chart; your entries stay in this page. UNVERIFIED draft. */
const R = window.CHFRules, C = window.CHFChart, H = window.CHFHandout, DAY = C.DAY, HR = C.HR;
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const ago = (t) => { const h = (Date.now() - t) / HR; return h < 1 ? Math.max(1, Math.round(h * 60)) + " min ago" : h < 48 ? Math.round(h) + " h ago" : Math.round(h / 24) + " d ago"; };
const ul = (a) => "<ul>" + a.filter(Boolean).map((t) => "<li>" + t + "</li>").join("") + "</ul>";
const num = (id) => { const v = parseFloat($(id).value); return isFinite(v) ? v : null; };
const r1 = R.r1;
const state = { f: null, flags: {}, why: {} }; // why: reason a GDMT pillar is not on, per pillar id
const WHY = ["", "Starting before discharge", "Start at follow-up (titrating one at a time)", "Low BP", "Slow heart rate / heart block", "High potassium", "Low eGFR / kidney injury", "Not tolerated before", "Allergy / angioedema", "Contraindicated (other)", "Patient declined", "Palliative / goals of care"];
const pillarList = () => R.pillars(state.f ? state.f.allMeds : []);
// pillars counted as "covered": on, or not on with a reason recorded
function pillarSummary(ef) {
  const PL = pillarList(), on = PL.filter((p) => p.on === true), miss = PL.filter((p) => p.on !== true), open = miss.filter((p) => !state.why[p.id]), below = on.filter((p) => p.below);
  return { PL, on, miss, open, below, relevant: ef === "low" || ef === "unknown" };
}
const has = (k) => !!(state.f && state.f.cls[k] && state.f.cls[k].length);
const prob = (k) => !!(state.f && state.f.prob[k]);
const cong = () => [...document.querySelectorAll(".cong:checked")].map((x) => x.value);

function facts() {
  const f = state.f, now = Date.now(), L = (id, d) => (f ? C.latest(f.l[id], d * DAY, now) : null), V = (id, d) => (f ? C.latest(f.v[id], d * DAY, now) : null);
  const c = { nt: L("nt", 14), bnp: L("bnp", 14), na: L("na", 3), k: L("k", 3), cr: L("cr", 3), egfr: L("egfr", 7), mg: L("mg", 3), hco3: L("hco3", 3), hb: L("hb", 7), ferritin: L("ferritin", 365), tsat: L("tsat", 365),
    tsh: L("tsh", 365), a1c: L("a1c", 365), trop: L("trop", 7), alb: L("alb", 14), una: L("una", 2), flc: L("flc", 365) };
  const wt = f && f.v.wt ? f.v.wt : [], w = wt.length ? wt[wt.length - 1] : null, w24 = C.wtChange(wt);
  const crs = f && f.l.cr ? f.l.cr : [], cr0 = crs.length ? crs[0] : null;
  const s = { age: f ? f.age : null, sex: f ? f.sex : "", kg: w ? w.v : null, sbp: V("sbp", 1) ? V("sbp", 1).v : null, hr: V("hr", 1) ? V("hr", 1).v : null, spo2: V("spo2", 1) ? V("spo2", 1).v : null,
    k: c.k && c.k.v, na: c.na && c.na.v, egfr: c.egfr ? c.egfr.v : null, cr: c.cr && c.cr.v, bmi: f ? f.bmi : null, decompensated: cong().filter((k) => k !== "o2").length > 0 };
  return { c, s, wt, w, w24, cr0, crs };
}
function tile(k, big, sub, tone) { return `<div class="tile ${tone || ""}"><div class="k">${k}</div><div class="big">${big}</div><div class="s">${sub || ""}</div></div>`; }

function draw() {
  const x = facts(), { c, s } = x, f = state.f, ef = $("ef").value, dry = num("dry"), home = num("home"), rate = parseFloat($("rate").value);
  const nt = c.nt ? R.ntInterp(Math.round(c.nt.v), s.age, { egfr: s.egfr, bmi: s.bmi, af: prob("af"), sepsis: false, arni: has("arni") }) : null;
  const ntc = f && f.l.nt ? R.ntChange(f.l.nt) : null;
  const ivDaily = f ? (f.loop.iv24 || f.loop.ivOrderDaily) : 0;
  const resp = R.response({ una: num("una") != null ? num("una") : c.una ? c.una.v : null, uoPerH: num("uo"), wt24: x.w24 ? x.w24.d : null });
  const toGo = x.w && dry ? r1(x.w.v - dry) : null, days = x.w && dry ? R.daysTo(x.w.v, dry, rate) : null;
  const crc = x.cr0 && c.cr && x.crs.length > 1 ? R.creatinine(x.cr0.v, c.cr.v, s.decompensated) : null;
  const shock = $("shock").checked || $("cool").checked;
  const G4 = pillarSummary(ef), nm = (a) => a.map((p) => p.on === "partial" ? p.name.toLowerCase() + " (" + p.drug + ": not a trial drug)" : p.name).join(", ");

  // tiles
  $("tiles").innerHTML = [
    tile("NT-proBNP", c.nt ? Math.round(c.nt.v) : c.bnp ? "BNP " + Math.round(c.bnp.v) : "?", nt ? (nt.zone === "in" ? "HF likely" : nt.zone === "out" ? "HF unlikely" : "grey zone") + (nt.band ? ` · age cut-off ${nt.band.cut}` : "") + (ntc ? ` · ${ntc.pct}% from peak` : "") : "not found", nt ? (nt.zone === "in" ? "t2" : nt.zone === "out" ? "t0" : "t1") : "t1"),
    tile("Weight", x.w ? r1(x.w.v) + " kg" : "?", (x.w24 ? `${x.w24.d > 0 ? "+" : ""}${r1(x.w24.d)} kg in 24 h` : "no 24 h change") + (toGo != null ? ` · ${toGo > 0 ? toGo + " kg to target" : "at target"}` : ""), x.w24 && x.w24.d > -0.5 && s.decompensated ? "t2" : "t0"),
    tile("Loop diuretic (24 h)", ivDaily ? ivDaily + " mg IV" : f && f.loop.po24 ? f.loop.po24 + " mg PO-eq" : "none", ivDaily ? "furosemide IV given/ordered per day" : "", ivDaily ? "t1" : s.decompensated ? "t2" : "t1"),
    tile("Creatinine / eGFR", c.cr ? Math.round(c.cr.v) : "?", (c.egfr ? "eGFR " + Math.round(c.egfr.v) : "") + (crc ? ` · ${x.cr0 ? "admit " + Math.round(x.cr0.v) : ""}` : ""), crc ? (crc.lvl === "urgent" ? "t3" : crc.lvl === "action" ? "t2" : "t0") : "t1"),
    tile("K / Na / Mg", `${c.k ? r1(c.k.v) : "?"} / ${c.na ? Math.round(c.na.v) : "?"} / ${c.mg ? Math.round(c.mg.v * 100) / 100 : "?"}`, "K 4.0-5.0, Mg 0.8+", (c.k && (c.k.v < 3.8 || c.k.v > 5.2)) || (c.na && c.na.v < 133) || (c.mg && c.mg.v < 0.8) ? "t2" : "t0"),
    tile("GDMT pillars", f ? G4.on.length + " / 4" : "?", f ? (G4.open.length ? "not on: " + G4.open.map((p) => ({ raas: "ARNI/ACEi/ARB", bb: "BB", mra: "MRA", sglt2: "SGLT2i" }[p.id])).join(", ") : "all covered") + (G4.below.length ? ` · ${G4.below.length} below target` : "") : "", !f ? "t1" : ef === "low" ? (G4.open.length >= 2 ? "t3" : G4.open.length || G4.below.length ? "t2" : "t0") : G4.open.length ? "t1" : "t0"),
    tile("BP / HR / SpO2", `${s.sbp ?? "?"} / ${s.hr ?? "?"}`, s.spo2 ? "SpO2 " + s.spo2 + "%" : "", s.sbp != null && s.sbp < 90 ? "t3" : "t0")].join("");

  // plan now
  const P = [], A = [];
  if (shock) A.push("<b>Low output / cardiogenic shock: call ICU and cardiology now.</b> Diuretics alone will not fix it; may need inotropes.");
  if (s.spo2 != null && s.spo2 < 90) A.push("SpO2 under 90: oxygen; consider CPAP/BiPAP for pulmonary edema (with ICU/outreach)");
  if (!ivDaily && s.decompensated) P.push(R.startDose(home, s.egfr).text);
  if (ivDaily && resp.ok === false) P.push(`<b>Diuretic response not enough</b> (${esc(resp.why.join("; "))}): double the IV dose (step 1 below)`);
  if (ivDaily && resp.ok === true && s.decompensated) P.push(`Response adequate (${esc(resp.why.join("; "))}): continue the same dose; recheck weight and labs daily`);
  if (!s.decompensated && ivDaily) P.push("No congestion ticked: is the patient ready to switch to oral? (see below)");
  if (c.k && c.k.v < 4) P.push(`K ${r1(c.k.v)}: replace to 4.0+ (or start/raise MRA)`);
  if (c.mg && c.mg.v < 0.8) P.push(`Mg ${Math.round(c.mg.v * 100) / 100}: replace`);
  if (crc && crc.lvl !== "ok") P.push(esc(crc.text));
  if (f && ef === "low" && G4.open.length) P.unshift(`<span class="flag">GDMT: ${G4.on.length} of 4 pillars.</span> Not on: <b>${esc(nm(G4.open))}</b>. Start before discharge unless there is a reason not to (record it in the GDMT section)${G4.below.length ? `; ${G4.below.length} below target dose` : ""}.`);
  else if (f && ef === "low" && G4.below.length) P.push(`GDMT: all 4 pillars covered; ${G4.below.length} below target dose (${esc(G4.below.map((p) => p.drug).join(", "))}): plan titration every 1-2 weeks.`);
  if (f && ef === "unknown" && G4.open.length) P.push(`If EF is 40% or less: ${G4.on.length} of 4 GDMT pillars (not on: ${esc(nm(G4.open))}). SGLT2 inhibitor helps at any EF.`);
  if (f && (ef === "mid" || ef === "pres") && G4.PL[3].on !== true && !state.why.sglt2) P.push(`<span class="flag">Not on an SGLT2 inhibitor:</span> recommended at any EF (dapagliflozin or empagliflozin 10 mg daily) unless eGFR under 20 or type 1 diabetes.`);
  if (ef === "unknown") P.push("Ejection fraction unknown: order an echo (or set EF from the last echo) to choose GDMT");
  if (!dry) P.push("Set a target (dry) weight to plan the days of diuresis and write it on the handout");
  if (nt && nt.zone === "out" && !s.decompensated) P.unshift("<b>NT-proBNP under 300: acute heart failure is unlikely.</b> Look for another cause of the breathlessness (see mimics below)");
  if (nt && nt.zone === "grey" && !s.decompensated) P.unshift("NT-proBNP in the grey zone and no congestion ticked: confirm with exam, POCUS (B-lines, IVC) or echo before diuresing");
  $("plansum").textContent = shock ? "Low output: ICU" : s.decompensated ? "Congested: decongest" : nt && nt.zone === "out" ? "HF unlikely" : ivDaily ? "Decongested: switch to oral" : "Tick congestion signs to plan";
  $("plan").innerHTML = (A.length ? `<div class="urgent"><h3>Now</h3>${ul(A)}</div>` : "") + ul(P.length ? P : ["Nothing urgent flagged. Review the sections below."]) +
    `<div class="muted">Treat the precipitant too: ${R.PRECIP.join(" · ")}</div>`;

  drawNT(nt, ntc, c, s); drawTrend(); drawDiu(x, ivDaily, resp, dry, rate, toGo, days, crc, home); drawPO(x, ivDaily, home, dry); drawGDMT(ef, s, c); drawDDX(ef, s, c); drawTests(c); drawAlerts(ef, s, c); drawFU(); drawHandout(dry, ivDaily);
  $("note").value = noteText(x, nt, ntc, ivDaily, resp, dry, days, crc);
}

function drawNT(nt, ntc, c, s) {
  if (!nt && !c.bnp) { $("nt").innerHTML = '<div class="muted">No NT-proBNP or BNP found in the last 14 days. Rule-out: under 300 (acute). Rule-in by age: 450 / 900 / 1800.</div>'; $("ntsum").textContent = ""; return; }
  const b = nt && nt.band;
  $("ntsum").textContent = nt ? nt.text.split(":")[0] : "";
  const rows = R.NT_BANDS.map((x) => `<tr class="${b && x.cut === b.cut ? "me" : ""}"><td>Age ${x.label}</td><td>under 300</td><td>300 to ${x.cut - 1}</td><td>${x.cut} or more</td></tr>`).join("");
  $("nt").innerHTML = (nt ? `<div class="verdict ${nt.zone === "in" ? "t2" : nt.zone === "out" ? "t0" : "t1"}"><div class="big">${esc(nt.text)}</div></div>` : "") +
    (c.bnp ? `<div>${esc(R.bnpInterp(Math.round(c.bnp.v)).text)} (BNP ${Math.round(c.bnp.v)})</div>` : "") +
    `<table class="bands"><tr><th>Acute dyspnea</th><th>Heart failure unlikely</th><th>Grey zone</th><th>Heart failure likely</th></tr>${rows}</table>
    <div class="muted" style="margin-top:6px">ng/L = pg/mL. Non-acute (clinic) rule-out is lower: under 125. ICON-RELOADED cut-offs for acutely short-of-breath patients.</div>` +
    (nt && nt.notes.length ? ul(nt.notes.map(esc)) : "") + (ntc ? `<div class="alert ${ntc.pct <= -30 ? "info" : "action"}">${esc(ntc.text)} (${Math.round(ntc.peak.v)} → ${Math.round(ntc.last.v)})</div>` : '<div class="muted">Repeat NT-proBNP before discharge: a fall of 30% or more from admission is reassuring; a rise or small fall means higher readmission risk.</div>');
}

function drawDiu(x, ivDaily, resp, dry, rate, toGo, days, crc, home) {
  const s = x.s, c = x.c, f = state.f, L = [];
  L.push(`<h3>Starting dose</h3>${ul([esc(R.startDose(home, s.egfr).text), "Give IV (bolus BID or infusion work equally - DOSE). Low BP alone should not delay IV diuretic unless in shock (ESC)."])}`);
  L.push(`<h3>Check the response early (ESC 2021)</h3>${ul(["Spot urine sodium 2 h after the dose: aim <b>50-70 mmol/L or more</b>", "Urine output over the first 6 h: aim <b>100-150 mL/h or more</b> (strict input/output, consider a urinal or condom catheter rather than a Foley)",
    resp.why.length ? `<b>${resp.ok === false ? "NOT enough" : resp.ok ? "Adequate" : "Borderline"}:</b> ${esc(resp.why.join("; "))}` : "Enter urine Na or output above, or record daily weights"])}`);
  L.push(`<h3>Escalate if the response is poor</h3>${ul(R.ladder(ivDaily, c.hco3 && c.hco3.v, s.egfr).map((x) => `<b>Step ${x.step}:</b> ${esc(x.t)}`))}`);
  const tgt = [`A weight loss of about <b>0.5-1 kg a day</b> (net fluid balance about 1-2 L negative) is a common target in practice; up to 1.5 kg/day if very overloaded and BP and kidneys hold. Faster than this risks low BP and kidney injury, slower usually means the dose is too low.`,
    x.w && dry ? `Now ${r1(x.w.v)} kg, target ${dry} kg: <b>${toGo > 0 ? toGo + " kg to go, about " + days + " day" + (days === 1 ? "" : "s") + " at " + rate + " kg/day" : "at or below target"}</b>` : "Set a target weight above (estimate from the last known dry weight, the clinic weight, or when the patient was well)",
    "Decongestion means no edema, no orthopnea, normal JVP - not just a number on the scale. Weigh daily, same scale, same time, after voiding."];
  L.push(`<h3>Weight target</h3>${ul(tgt)}`);
  L.push(`<h3>Monitor daily on IV diuretic</h3>${ul(["Weight, strict input/output, BP lying and standing", "Electrolytes, creatinine, urea daily; Mg every 1-2 days (daily with metolazone)", "K: keep 4.0-5.0; Mg 0.8+", "Sodium: if it falls below 130, limit free water and review thiazide", crc ? esc(crc.text) : "Creatinine: a rise up to about 26 umol/L is expected; a larger rise while still congested is usually OK if decongestion continues"])}`);
  $("diusum").textContent = ivDaily ? `${ivDaily} mg IV/day` + (resp.ok === false ? " · response poor" : resp.ok ? " · responding" : "") : "";
  $("diu").innerHTML = L.join("");
}

function drawPO(x, ivDaily, home, dry) {
  const s = x.s, c = x.c, wtOk = x.w && dry ? x.w.v - dry <= 1 : null;
  const ready = R.readyForPO({ decongested: !s.decompensated, nearTarget: wtOk, offO2: !cong().includes("o2") && !(s.spo2 != null && s.spo2 < 90), labsStable: null, bpOk: s.sbp == null ? null : s.sbp >= 90, eating: $("eating").checked });
  const ok = ready.filter((r) => r[1] === true).length, sw = R.switchPO(ivDaily || 0, home);
  $("posum").textContent = `${ok} of ${ready.length} ready`;
  $("po").innerHTML = `<h3>Ready to switch?</h3><ul class="check">${ready.map(([t, v]) => `<li>${v === true ? "✓" : v === false ? "✗" : "?"} ${esc(t)}</li>`).join("")}</ul>` +
    (sw ? `<h3>Oral dose (from ${ivDaily} mg/day IV furosemide)</h3>${ul(sw.opts.map((o) => `<b>${esc(o.a)}</b><br><span class="muted">${esc(o.why)}</span>`))}${sw.note ? `<div class="alert action">${esc(sw.note)}</div>` : ""}`
      : '<div class="muted">No IV loop diuretic found: enter the IV dose on the chart to see the oral equivalent. Furosemide IV 20 mg = PO 40 mg = torsemide 20 mg = bumetanide 1 mg.</div>') +
    `<h3>How</h3>${ul(["Give the first oral dose the morning after the last IV dose (or 12 h after)", "Watch <b>24-48 h on the oral dose</b> before discharge: weight should stay within about 0.5 kg; if it rises, the oral dose is too low", "The discharge dose is usually HIGHER than the pre-admission dose (that dose failed)", "Start or continue GDMT before discharge (below); SGLT2i and MRA also help keep the patient dry", "Write the discharge (dry) weight and the diuretic plan on the summary and the handout"])}`;
}

function drawGDMT(ef, s, c) {
  const meds = state.f ? state.f.allMeds : [], G = R.gdmt(ef, { k: s.k, egfr: s.egfr, sbp: s.sbp, hr: s.hr, decompensated: s.decompensated, dka: prob("dm1") }, meds);
  const ir = R.iron(c.ferritin ? Math.round(c.ferritin.v) : null, c.tsat ? Math.round(c.tsat.v) : null);
  const PL = pillarList();
  const pillarsHtml = state.f ? `<h3>The four pillars${ef === "low" ? "" : ef === "unknown" ? " (if EF is 40% or less)" : " (HFrEF; at this EF the SGLT2 inhibitor is the main one)"}</h3><table class="agent"><tr><th>Pillar</th><th>Status</th><th>Order found</th><th>Dose vs target</th><th>If not on: why?</th></tr>` +
    PL.map((p) => `<tr><td><b>${esc(p.name)}</b></td><td class="${p.on === true ? (p.below ? "st-caution" : "st-ok") : state.why[p.id] ? "" : "st-avoid"}">${p.on === true ? (p.below ? "ON, below target" : "ON") : p.on === "partial" ? "WRONG DRUG" : "NOT ON"}</td>
      <td>${esc(p.text || "none found")}</td><td>${esc(p.advice || "")}</td>
      <td>${p.on === true ? "" : `<select class="gwhy" data-p="${p.id}">${WHY.map((w) => `<option${state.why[p.id] === w ? " selected" : ""}>${esc(w)}</option>`).join("")}</select>`}</td></tr>`).join("") +
    `</table><div class="muted" style="margin:4px 0 10px">Matched by drug name in active orders and doses given in the last 2 days (home medicines not read here). Targets: CCS / ACC. A pillar with a reason chosen is no longer flagged and the reason goes in the note.</div><h3>By ejection fraction</h3>` : "";
  $("gdmt").innerHTML = pillarsHtml + `<table class="agent"><tr><th>Treatment</th><th>On it?</th><th>How to start</th><th>Watch</th></tr>` +
    G.map((g) => `<tr><td><b>${esc(g.name)}</b></td><td class="${g.on === true ? "st-ok" : g.on === false ? "st-avoid" : ""}">${g.on === true ? "YES" : g.on === false ? "NOT YET" : ""}</td><td>${esc(g.dose)}</td><td>${esc(g.caution.join("; "))}</td></tr>`).join("") + "</table>" +
    `<div class="alert ${ir.def ? "action" : "info"}" style="margin-top:8px">${esc(ir.text)}</div>` +
    `<div class="muted">Start what you can before discharge, one or two at a time, with labs in 1-2 weeks. Do not stop GDMT for a small creatinine rise during decongestion.</div>`;
  $("gdmt").querySelectorAll(".gwhy").forEach((el) => (el.onchange = () => { if (el.value) state.why[el.dataset.p] = el.value; else delete state.why[el.dataset.p]; draw(); }));
}

function drawDDX(ef, s, c) {
  const f = state.f, auto = { hfpefOld: (ef === "pres" || ef === "mid") && s.age >= 65, ctsBil: prob("cts"), spinal: prob("spinal"), as: prob("as") && s.age >= 65, neuro: prob("neuro"), conduction: prob("pacer") || prob("af"), mgus: prob("mgus"),
    trop: !!(f && f.l.trop && f.l.trop.length >= 2 && f.l.trop.every((t) => t.v > 14) && Math.abs(f.l.trop[f.l.trop.length - 1].v - f.l.trop[0].v) / f.l.trop[0].v < 0.2), renal: prob("nephrotic") };
  const flags = Object.assign({}, auto, state.flags), am = R.amyloid(flags);
  $("amysum").textContent = am.level === "high" ? `amyloid red flags: ${am.on.length}` : am.on.length ? `${am.on.length} amyloid red flag${am.on.length > 1 ? "s" : ""}` : "";
  const hit = { cad: prob("cad"), htn: prob("htn"), valve: prob("valve"), af: prob("af"), amyloid: am.on.length > 0, alcohol: prob("alcohol"), chemo: prob("chemo"), thyroid: prob("thyroid"), copd: prob("copd"), drugs: has("nsaid") || has("ndhp") || has("tzd") || has("dron") };
  $("ddx").innerHTML = `<table class="agent"><tr><th>Cause</th><th>Clues</th><th>How to look for it</th></tr>` +
    R.DDX.map(([n, cl, t, k]) => `<tr class="${k && hit[k] ? "me" : ""}"><td><b>${esc(n)}</b>${k && hit[k] ? " ◀ chart" : ""}</td><td>${esc(cl)}</td><td>${esc(t)}</td></tr>`).join("") + "</table>" +
    `<h3>Cardiac amyloidosis red flags</h3><div class="mini">${R.AMYLOID_FLAGS.map(([k, t]) => `<label class="inl" style="align-items:flex-start"><input type="checkbox" class="amy" value="${k}" ${flags[k] ? "checked" : ""}> <span>${esc(t)}${auto[k] ? ' <span class="muted">(chart)</span>' : ""}</span></label>`).join("")}</div>` +
    `<div class="alert ${am.level === "high" ? "action" : "info"}" style="margin-top:8px"><b>${am.level === "high" ? "Suspect cardiac amyloidosis: work it up." : am.on.length ? "Some red flags: consider amyloid if there is no other cause." : "No red flags ticked."}</b></div>` + ul(am.steps.map(esc)) +
    `<h3>Not heart failure? Mimics of edema and dyspnea</h3>${ul(R.MIMICS.map(esc))}`;
  document.querySelectorAll(".amy").forEach((b) => (b.onchange = () => { state.flags[b.value] = b.checked; draw(); }));
}

function drawTests(c) {
  const L = R.workup(c), val = (v) => (v && typeof v === "object" ? ` <b>${Math.round(v.v * 100) / 100}</b> (${ago(v.t)})` : "");
  $("tests").innerHTML = '<ul class="check">' + L.map((x) => `<li class="${x.have ? "have" : "miss"}">${x.have ? "✓" : "☐"} ${esc(x.t)}${val(x.have)} <span class="why">${esc(x.why)}</span></li>`).join("") + "</ul>";
}

function drawAlerts(ef, s, c) {
  const f = state.f, A = [];
  if (f) {
    if (has("nsaid")) A.push(["urgent", `NSAID on the chart (${f.cls.nsaid.join("; ")}): causes salt and water retention and kidney injury in HF. Stop; use acetaminophen.`]);
    if (has("ndhp") && ef === "low") A.push(["urgent", `Diltiazem/verapamil with EF 40% or less (${f.cls.ndhp.join("; ")}): negative inotrope, avoid.`]);
    if (has("tzd")) A.push(["urgent", "Pioglitazone/rosiglitazone: causes fluid retention, avoid in HF."]);
    if (has("dron")) A.push(["urgent", "Dronedarone: harmful in recent decompensated or severe HF."]);
    if (has("ivfluid") && s.decompensated) A.push(["action", `IV saline / crystalloid running while congested: stop unless needed (${f.cls.ivfluid.join("; ")}).`]);
    if (has("amlo")) A.push(["info", "Amlodipine/nifedipine can cause ankle edema that is not HF (and is not helped by diuretic)."]);
    if (has("gaba")) A.push(["info", "Pregabalin/gabapentin can cause edema."]);
    if (has("steroid")) A.push(["info", "Steroids cause salt and water retention."]);
    if (has("kcl") && has("mra")) A.push(["action", "Potassium supplement plus MRA: hyperkalemia risk; stop KCl when the MRA starts unless K stays low."]);
    if (has("mra") && s.k != null && s.k > 5.5) A.push(["urgent", `K ${s.k} on an MRA: hold the MRA.`]);
    if (has("arni") && (has("acei"))) A.push(["urgent", "Sacubitril/valsartan AND an ACE inhibitor: angioedema risk; need a 36 h gap."]);
    if (has("acz") && f.cls.acz.length) A.push(["info", "Acetazolamide: limit to about 3 days; watch bicarbonate and K."]);
    if (has("thiaz")) A.push(["action", "Metolazone/thiazide with a loop: check Na, K, Mg and creatinine daily; can cause big drops."]);
  }
  $("alertsum").textContent = A.length ? A.length + " to review" : "";
  $("alerts").innerHTML = (A.length ? A.map(([l, t]) => `<div class="alert ${l}">${esc(t)}</div>`).join("") : '<div class="muted">No alerts from the medications found.</div>') +
    (f && f.allMeds.length ? `<div class="src">Medications read: ${esc([...new Set(f.allMeds)].slice(0, 30).join("; "))}</div>` : "");
}
function drawFU() { $("fu").innerHTML = ul(R.FOLLOWUP.map(esc)); }

function handoutOpts(dry, ivDaily) {
  return { dry, diur: $("h-diur").value.trim(), flex: $("h-flex").checked, flexdose: $("h-flexdose").value.trim(), fluid: $("h-fluid").checked, fluidL: num("h-fluidL") || 1.5, phone: $("h-phone").value.trim(), fu: $("h-fu").value.trim(), lab: $("h-lab").value.trim() };
}
function drawHandout(dry, ivDaily) { $("handout").innerHTML = H.body(handoutOpts(dry, ivDaily)); }
$("h-print").onclick = () => {
  const html = H.page(handoutOpts(num("dry"))), w = window.open("", "_blank");
  if (w) { w.document.open(); w.document.write(html); w.document.close(); }
  else { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([html], { type: "text/html" })); a.target = "_blank"; a.click(); }
};

/* ---- trends: weight, NT-proBNP, creatinine ---- */
function spark(a, title, unit, color, fmt) {
  if (!a || !a.length) return `<div><div class="ttl">${title}</div><div class="muted">none</div></div>`;
  const W = 280, Hh = 90, P = 6, t0 = a[0].t, t1 = Math.max(a[a.length - 1].t, t0 + HR), lo = Math.min(...a.map((p) => p.v)), hi = Math.max(...a.map((p) => p.v)), span = hi - lo || 1;
  const xs = (t) => P + ((t - t0) / (t1 - t0)) * (W - 2 * P), ys = (v) => Hh - 16 - ((v - lo) / span) * (Hh - 30);
  const pts = a.map((p) => `${xs(p.t).toFixed(1)},${ys(p.v).toFixed(1)}`).join(" ");
  return `<div><div class="ttl">${title}: ${fmt(a[a.length - 1].v)} ${unit} <span class="muted">(first ${fmt(a[0].v)})</span></div><svg viewBox="0 0 ${W} ${Hh}" width="100%"><polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2"/>${a.map((p) => `<circle cx="${xs(p.t).toFixed(1)}" cy="${ys(p.v).toFixed(1)}" r="3" fill="${color}"><title>${new Date(p.t).toLocaleString()}: ${fmt(p.v)}</title></circle>`).join("")}<text x="${P}" y="${Hh - 2}">${new Date(t0).toLocaleDateString()}</text><text x="${W - 70}" y="${Hh - 2}">${new Date(t1).toLocaleDateString()}</text></svg></div>`;
}
function drawTrend() {
  const f = state.f; if (!f) { $("trend").innerHTML = '<div class="muted">No patient loaded.</div>'; return; }
  $("trend").innerHTML = `<div class="mini">${spark(f.v.wt, "Weight", "kg", "#0b6bcb", r1)}${spark(f.l.nt, "NT-proBNP", "ng/L", "#c0392b", Math.round)}${spark(f.l.cr, "Creatinine", "umol/L", "#8a5200", Math.round)}</div>`;
}

function noteText(x, nt, ntc, ivDaily, resp, dry, days, crc) {
  const s = x.s, c = x.c, ef = { unknown: "EF unknown", low: "HFrEF (EF 40% or less)", mid: "HFmrEF", pres: "HFpEF" }[$("ef").value];
  const L = [`Acute decompensated heart failure, ${ef}.`];
  L.push(`Congestion: ${cong().length ? cong().map((k) => ({ orth: "orthopnea", jvp: "raised JVP", edema: "edema", crackles: "crackles/effusions", o2: "oxygen requirement", ascites: "ascites" }[k])).join(", ") : "none on exam"}.`);
  if (c.nt) L.push(`NT-proBNP ${Math.round(c.nt.v)} ng/L (${nt ? nt.text.split(":")[0].toLowerCase() : ""}${nt && nt.band ? ", age cut-off " + nt.band.cut : ""})${ntc ? ", " + ntc.pct + "% from peak" : ""}.`);
  if (x.w) L.push(`Weight ${r1(x.w.v)} kg${x.w24 ? " (" + (x.w24.d > 0 ? "+" : "") + r1(x.w24.d) + " kg/24 h)" : ""}${dry ? ", target " + dry + " kg" + (days ? " (about " + days + " days)" : "") : ""}.`);
  L.push(`Cr ${c.cr ? Math.round(c.cr.v) : "?"}, K ${c.k ? r1(c.k.v) : "?"}, Na ${c.na ? Math.round(c.na.v) : "?"}, Mg ${c.mg ? Math.round(c.mg.v * 100) / 100 : "?"}.`);
  L.push("", "Plan:");
  L.push(ivDaily ? `- Furosemide ${ivDaily} mg/day IV; response ${resp.ok === false ? "inadequate: double dose" : resp.ok ? "adequate: continue" : "to reassess (urine Na 2 h, UO 6 h)"}.` : "- " + R.startDose(num("home"), s.egfr).text);
  L.push("- Daily weight, strict I/O, daily lytes/Cr; K 4-5, Mg 0.8+.");
  if (crc && crc.lvl !== "ok") L.push("- " + crc.text);
  if (state.f) { const PL = pillarList(), efv = $("ef").value;
    L.push(`- GDMT${efv === "low" ? "" : efv === "unknown" ? " (if EF 40% or less)" : ""}: ` + PL.map((p) => `${p.name}: ${p.on === true ? p.text + (p.below ? " (below target " + p.targetText + ")" : "") : p.on === "partial" ? p.text + " (not a trial beta-blocker: switch)" : "not on" + (state.why[p.id] ? " - " + state.why[p.id].toLowerCase() : "")}`).join("; ") + ".");
    L.push("- Iron studies; echo if none recent.");
  } else L.push("- GDMT: start/titrate per EF before discharge; iron studies; echo if none recent.");
  L.push("- Look for precipitant and cause" + (document.querySelectorAll(".amy:checked").length >= 3 ? "; amyloid red flags: free light chains, SPEP/UPEP with IFE, then PYP scan." : "."));
  L.push("- Discharge: oral diuretic observed 24-48 h, dry weight documented, HF handout, follow-up within 7 days, labs in 1 week, HF clinic referral.");
  return L.join("\n");
}

/* ---- load ---- */
function load(raw, note, errors, preset) {
  state.f = raw ? C.parse(raw) : null; state.flags = {}; state.why = {}; const p = (preset && preset.sit) || {}, f = state.f;
  $("ef").value = p.ef || (f && f.prob.hfref ? "low" : f && f.prob.hfpef ? "pres" : "unknown");
  $("dry").value = p.dry != null ? p.dry : ""; $("una").value = p.una != null ? p.una : ""; $("uo").value = "";
  // home loop dose: from preset, else from an oral loop order
  const poOrder = f && f.loop.orders.find((d) => !d.iv); $("home").value = p.homePO != null ? p.homePO : poOrder ? R.furoPOeq(poOrder.drug, poOrder.perDay, "po") : "";
  document.querySelectorAll(".cong").forEach((b) => (b.checked = (p.cong || []).includes(b.value)));
  $("cool").checked = false; $("shock").checked = false; $("eating").checked = !!p.ready;
  if (p.flags) state.flags = Object.assign({}, p.flags);
  const loopTxt = f && f.loop.orders[0] ? f.meds.find((m) => C.loopDose(m.text)) : null;
  $("h-diur").value = ""; $("h-flex").checked = false; $("h-flexdose").value = ""; $("h-fluid").checked = !!(f && f.l.na && f.l.na[f.l.na.length - 1].v < 130);
  $("ptsum").textContent = f ? [f.sex, f.age != null ? f.age + " y" : "", f.kg ? r1(f.kg) + " kg" : "", f.bmi ? "BMI " + f.bmi : ""].filter(Boolean).join(", ") : "";
  $("pstatus").textContent = note; $("clear").hidden = !raw;
  $("errs").innerHTML = errors && errors.length ? "Could not read: " + errors.map(esc).join("; ") + (errors.some((e) => /\b40[13]\b|Unauthorized|Forbidden/i.test(e)) ? ". Check the scopes in the Code Console." : ". Cerner's sandbox can be slow: reload the patient to try again.") : "";
  draw();
}
["ef", "rate", "cool", "shock", "eating", "h-flex", "h-fluid"].forEach((id) => ($(id).onchange = draw));
["dry", "home", "una", "uo", "h-diur", "h-flexdose", "h-fluidL", "h-phone", "h-fu", "h-lab"].forEach((id) => ($(id).oninput = draw));
document.querySelectorAll(".cong").forEach((b) => (b.onchange = draw));
$("copy").onclick = () => { $("note").select(); try { navigator.clipboard.writeText($("note").value); } catch (e) { document.execCommand("copy"); } };
$("clear").onclick = () => { $("testsel").value = ""; load(null, "Open from Cerner to read the chart, or pick a made-up patient:"); };
const SAMPLES = window.CHF_SAMPLES || [];
SAMPLES.forEach((p, i) => { const o = document.createElement("option"); o.value = i; o.textContent = p.label; $("testsel").appendChild(o); });
$("testsel").onchange = () => { const p = SAMPLES[$("testsel").value]; if (!p) return $("clear").onclick(); load(p.build(Date.now()), "Made-up patient: " + p.label, [], p); };

async function fromChart() {
  if (typeof FHIR === "undefined" || !(location.search.includes("code=") || location.search.includes("complete=") || sessionStorage.getItem("SMART_KEY"))) return;
  $("pstatus").textContent = "Reading the chart…";
  try {
    const client = await FHIR.oauth2.ready();
    const { raw, errors } = await C.gather(client, (msg) => ($("pstatus").textContent = msg));
    load(raw, "Chart read (read-only). Nothing is sent anywhere. Set EF, target weight and congestion above.", errors);
  } catch (e) { $("pstatus").textContent = "Could not read the chart: " + (e && e.message ? e.message : e) + ". The made-up patients still work."; }
}
draw(); fromChart();
