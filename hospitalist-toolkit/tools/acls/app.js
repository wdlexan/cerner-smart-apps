/* ACLS page. Read-only from the chart; the code timer is kept in this browser only (no patient details). UNVERIFIED draft. */
const R = window.ACLSRules, C = window.ACLSChart, DAY = C.DAY, HR = C.HR, MIN = R.MIN;
const $ = (id) => document.getElementById(id);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const ul = (a) => "<ul>" + a.filter(Boolean).map((t) => "<li>" + t + "</li>").join("") + "</ul>";
const num = (id) => { const v = parseFloat($(id).value); return isFinite(v) ? v : null; };
const alert1 = (o) => `<div class="alert ${o.lvl}">${esc(o.t)}</div>`;
const state = { f: null, events: [] };
const has = (k) => !!(state.f && state.f.cls[k] && state.f.cls[k].length);
const prob = (k) => !!(state.f && state.f.prob[k]);
const STORE = "acls-code-v1";
try { state.events = JSON.parse(localStorage.getItem(STORE) || "[]") || []; } catch (e) { state.events = []; }
const save = () => { try { localStorage.setItem(STORE, JSON.stringify(state.events)); } catch (e) {} };

/* ---------------- chart facts ---------------- */
function facts() {
  const f = state.f, now = Date.now(), L = (id, h) => (f ? C.latest(f.l[id], h * HR, now) : null), V = (id, h) => (f ? C.latest(f.v[id], h * HR, now) : null);
  const val = (o) => (o ? o.v : null);
  const kg = num("o-kg") != null ? num("o-kg") : f && f.kg ? f.kg : null;
  const hbs = f && f.l.hb ? f.l.hb.filter((x) => now - x.t < 3 * DAY) : [];
  const hb = hbs.length ? hbs[hbs.length - 1].v : null, hbDrop = hbs.length > 1 ? Math.round(Math.max(...hbs.map((x) => x.v)) - hb) : null;
  const tr = f && f.l.trop ? f.l.trop.filter((x) => now - x.t < 3 * DAY) : [];
  const tropRise = tr.length > 1 && tr[tr.length - 1].v > 26 && tr[tr.length - 1].v >= tr[tr.length - 2].v * 1.2;
  const sbp = V("sbp", 12), dbp = V("dbp", 12), mapO = V("map", 12);
  const med = {}; Object.keys(C.MED).forEach((k) => (med[k] = f ? f.cls[k] : []));
  const p = f ? Object.fromEntries(Object.keys(f.prob).map((k) => [k, true])) : {};
  const recentProc = !!(p.postop || p.hipfx);
  const s = codeS();
  const x = {
    kg, age: f ? f.age : null, k: val(L("k", 48)), mg: val(L("mg", 72)), ica: val(L("ica", 48)), ca: val(L("ca", 72)), glu: val(L("glu", 24)),
    ph: val(L("ph", 24)) != null ? val(L("ph", 24)) : val(L("phV", 24)), pco2: val(L("pco2", 24)), hco3: val(L("hco3", 48)), lactate: val(L("lactate", 24)),
    hb, hbDrop, temp: val(V("temp", 12)), spo2: val(V("spo2", 12)), sbp: val(sbp), dbp: val(dbp), hr: val(V("hr", 12)), rr: val(V("rr", 12)),
    map: mapO ? mapO.v : sbp && dbp ? Math.round((sbp.v + 2 * dbp.v) / 3) : null,
    inr: val(L("inr", 72)), plt: val(L("plt", 72)), ddimer: val(L("ddimer", 168)), digoxin: val(L("dig", 72)), qtc: val(L("qtc", 72)), tropRise,
    med, prob: p, recentProc, recentOpioidDose: f ? f.recentOpioidDose : false, noVTEppx: !!f && !med.vteppx.length && (recentProc || p.cancer || p.hipfx),
    firstRhythm: s.firstRhythm
  };
  const lact = f && f.l.lactate ? f.l.lactate.filter((y) => now - y.t < DAY) : [];
  x.lactatePrev = lact.length > 1 ? lact[lact.length - 2].v : null;
  return x;
}

/* ---------------- static reference ---------------- */
const ARREST_REF = `
<h3>Every cycle</h3>${ul(["Push hard and fast: 100-120/min, at least 5 cm (not over 6 cm), full recoil, minimal pauses (pauses under 10 s); swap the compressor every 2 min.",
  "No advanced airway: 30 compressions to 2 breaths, each breath just enough to see the chest rise. Advanced airway: 1 breath every 6 s with continuous compressions. Highest oxygen available.",
  "Waveform capnography: ETCO2 under 10 mmHg means improve compressions (aim 20+). A sudden rise above 10 mmHg may mean ROSC.",
  "Access: IV first; IO if IV is not quick. No central lines during CPR; drugs down the ET tube are no longer used (2025)."])}
<h3>Shockable: VF / pulseless VT</h3>${ul(["Shock (biphasic: device setting, often 120-200 J; if unknown use maximum), then CPR straight away for 2 min. No pulse check after the shock.",
  "After the 2nd shock: epinephrine 1 mg, then every 3-5 min (every second cycle).",
  "After the 3rd shock: amiodarone 300 mg IV/IO push (or lidocaine 1-1.5 mg/kg). Second dose: amiodarone 150 mg (or lidocaine 0.5-0.75 mg/kg).",
  "Refractory VF (3+ shocks): fix pad position, think coronary occlusion (cath lab, ECPR if a candidate), K and Mg. Vector change and double sequential shocks are not established."])}
<h3>Non-shockable: PEA / asystole</h3>${ul(["Epinephrine 1 mg as soon as possible, then every 3-5 min.", "CPR 2 min, rhythm check, repeat. Shock only if it turns into VF/VT.",
  "PEA in hospital is often a reversible cause: hypoxia (sedation, airway), hypovolemia (bleeding), hyperkalemia, PE, tamponade, tension pneumothorax, drugs."])}
<h3>Not routine</h3>${ul(["Calcium, sodium bicarbonate and magnesium are not routine: give for hyperkalemia, CCB toxicity, TCA toxicity, torsades.", "Vasopressin and steroids add nothing to epinephrine. High-dose epinephrine is not recommended.",
  "Routine pacing in asystole does not help. POCUS only by an experienced user and only during the pulse check."])}
<h3>Stopping</h3>${ul(["In hospital it is a team decision: time without ROSC, rhythm, reversible causes left, ETCO2 trend (intubated: under 10 after 20 min is one piece), baseline health and what the patient would want.",
  "EMS termination rules do not apply in hospital, to overdose or to trauma."])}`;

const SPECIAL = {
  hyperk: { name: "Hyperkalemia", items: ["Calcium chloride 10% 10 mL IV (or calcium gluconate 10% 30 mL); repeat if ECG changes persist.", "Regular insulin 10 units IV with dextrose 25 g; glucose checks hourly for 6 h.", "Sodium bicarbonate 50 mmol IV (acidosis).", "Salbutamol 10-20 mg nebulized after ROSC; stop K sources; nephrology for urgent dialysis. See the Electrolytes tab."], tab: "lytes" },
  opioid: { name: "Opioid overdose / over-sedation", items: ["Pulse present, not breathing: ventilate (bag-mask) and give naloxone 0.04-0.4 mg IV, repeat every 2-3 min (titrate in opioid-dependent or palliative patients).", "No pulse: CPR first; naloxone may be given but must not delay compressions or shocks.", "Long-acting opioids (methadone, patches): infusion and monitoring; naloxone wears off in 30-90 min. See the Opioid safety tab."], tab: "opioid" },
  pe: { name: "Pulmonary embolism", items: ["Confirmed or strongly suspected PE with arrest: thrombolysis is reasonable (alteplase 50 mg IV push is commonly used; continue CPR 60-90 min after).", "Peri-arrest (shock, no arrest): alteplase 100 mg over 2 h, or catheter-directed therapy; ICU.", "Heparin after; check bleeding risk; consider ECMO where available."] },
  last: { name: "Local anesthetic toxicity (nerve block, epidural, lidocaine infusion)", items: ["Stop the local anesthetic; call for the lipid kit.", "Lipid emulsion 20%: 1.5 mL/kg IV over 1 min, then 0.25 mL/kg/min; repeat bolus up to twice; double infusion if unstable; max about 12 mL/kg.", "Epinephrine 1 mcg/kg or less; avoid vasopressin, CCB, beta-blockers, more local anesthetic. Prolonged CPR may be needed."] },
  bbccb: { name: "Beta-blocker or calcium-channel blocker toxicity", items: ["Calcium chloride 10% 10-20 mL IV (repeat).", "High-dose insulin 1 unit/kg bolus then 1 unit/kg/h with dextrose and K checks.", "Glucagon 3-5 mg IV (beta-blocker), vasopressors, pacing; lipid or ECMO if refractory. Poison Control: BC DPIC 1-800-567-8911."] },
  dig: { name: "Digoxin toxicity", items: ["Arrest or life-threatening arrhythmia: digoxin immune Fab (DigiFab) 10 vials empirically (more if a large ingestion).", "Treat hyperkalemia; calcium is no longer thought harmful but is not the main treatment.", "Avoid cardioversion if possible (use low energy)."] },
  tca: { name: "Tricyclic / sodium-channel blocker (wide QRS)", items: ["Sodium bicarbonate 1-2 mmol/kg IV bolus, repeat to narrow the QRS; target pH 7.45-7.55.", "Avoid procainamide and other class Ia/Ic drugs. Lipid emulsion if refractory."] },
  anaph: { name: "Anaphylaxis", items: ["Epinephrine 0.5 mg IM (1 mg/mL) in the thigh, repeat every 5-15 min; IV epinephrine infusion if not responding.", "Arrest: standard ACLS with large-volume fluids; early airway (swelling).", "Stop the trigger (antibiotic, contrast, blood)."] },
  preg: { name: "Pregnancy", items: ["Manual left uterine displacement during CPR; IV access above the diaphragm.", "Call obstetrics and neonatal teams at once; plan perimortem cesarean delivery if no ROSC by about 4 minutes (aim delivery by 5 min) when the uterus is at or above the umbilicus.", "Magnesium toxicity: stop magnesium, give calcium chloride 10% 10 mL."] },
  hypo: { name: "Hypothermia", items: ["Core temperature; active internal rewarming; ECPR if available for severe hypothermia.", "Below 30 °C: drugs and repeated shocks may not work; one shock then rewarm. Prolonged CPR is reasonable."] },
  lvad: { name: "LVAD patient", items: ["Check perfusion first (MAP by Doppler, skin colour, mental status, ETCO2 over 20 mmHg if intubated); listen for the pump hum and check the controller alarms and power.", "Not perfusing and the device cannot be fixed quickly: start chest compressions. Call the VAD team."] }
};
const TALK = `${ul(["Ask who is at high risk (frail, metastatic cancer, end-stage organ disease, CFS 7+): survival to discharge after in-hospital arrest is about 1 in 4 overall and much lower in these groups.",
  "Ask what matters: \"If your heart stopped, some people want everything done, including CPR and a breathing machine; others want a natural death. What would you want?\"",
  "Recommend, do not just list options: \"Given your illness, I worry CPR would not get you back to the life you value. I recommend we focus on treatments that can help, and not do CPR.\"",
  "Write it on the MOST form (M1-M3: medical treatment without CPR; C designations: critical care), order it in PowerChart, and tell the nurse and family. Check the exact designation wording on the signed form.",
  "Re-visit after any big change (ICU transfer, new diagnosis, a rapid response)."])}`;
const DEBRIEF = `${ul(["Within the hour, 5 minutes, everyone welcome: what went well, what we could improve, any equipment problems.",
  "Check the team is OK; offer support (Employee and Family Assistance Program).", "Replace the code cart and defibrillator pads; report equipment or system issues (patient safety report).",
  "Tell the MRP and family physician; complete the code record and the note."])}`;

/* ---------------- draw (chart sections) ---------------- */
function tile(k, big, sub, tone) { return `<div class="tile ${tone || ""}"><div class="k">${k}</div><div class="big">${big}</div><div class="s">${sub || ""}</div></div>`; }

function draw() {
  const x = facts(), f = state.f;
  // Hs & Ts
  const H = R.hsts(x), likely = H.filter((h) => h.status === "likely"), possible = H.filter((h) => h.status === "possible");
  const STL = { likely: "likely", possible: "possible", nodata: "no data", none: "nothing found" };
  $("hsts").innerHTML = (f ? "" : `<div class="muted">No chart loaded: the list is blank. Open from Cerner or pick a made-up patient.</div>`) +
    `<div class="scroll"><table class="ref"><thead><tr><th></th><th>Cause</th><th>Chart clues</th><th>What to do</th></tr></thead><tbody>` +
    H.map((h) => `<tr><td><span class="chip c-${h.status}">${STL[h.status]}</span></td><td><b>${h.group}</b> ${esc(h.name)}</td><td>${h.ev.length ? h.ev.map(esc).join("<br>") : '<span class="muted">-</span>'}</td><td>${ul(h.tx.map(esc))}${h.lytes ? '<a class="tk" data-toolkit="lytes">Electrolytes tab</a>' : ""}</td></tr>`).join("") + `</tbody></table></div>` +
    `<div class="muted" style="margin-top:6px">"Likely" means a strong chart clue (for example K 6.0 or more). Tension pneumothorax and tamponade are mostly bedside diagnoses: the chart can only raise them.</div>`;
  $("hstsum").textContent = f ? likely.length + " likely, " + possible.length + " possible" : "";

  // bradycardia
  const B = R.brady({ hr: num("b-hr") != null ? num("b-hr") : x.hr, unstable: $("b-unstable").checked, wideOrHighBlock: $("b-wide").checked, transplant: $("b-tx").checked, k: x.k, dig: has("dig"), bb: has("bb"), ccb: has("ndhp"), tropRise: x.tropRise, temp: x.temp, kg: x.kg });
  $("b-hr-auto").textContent = num("b-hr") == null && x.hr != null ? "chart: " + x.hr : "";
  $("brady").innerHTML = B.steps.map(alert1).join("") + `<h3>Causes to look for${f ? " (from the chart)" : ""}</h3>` + ul(B.causes.map(esc));
  // tachycardia
  const T = R.tachy({ rhythm: $("t-rhythm").value, unstable: $("t-unstable").checked, hr: num("t-hr") != null ? num("t-hr") : x.hr, qtc: x.qtc, k: x.k, mg: x.mg, qtDrugs: x.med.qt, kg: x.kg });
  $("t-hr-auto").textContent = num("t-hr") == null && x.hr != null ? "chart: " + x.hr : "";
  $("energy").innerHTML = `<div class="alert ${$("t-unstable").checked || /pvt|torsades/.test($("t-rhythm").value) ? "urgent" : "info"}"><b>Energy if shocking:</b> ${esc(T.energy)}</div>`;
  $("tachy").innerHTML = T.steps.map(alert1).join("") + (T.warn.length ? "<h3>Also</h3>" + ul(T.warn.map(esc)) : "") + ($("t-rhythm").value === "af" || $("t-rhythm").value === "flutter" ? `<div class="muted">More on rate control and anticoagulation: <a class="tk" data-toolkit="af">AF (acute illness) tab</a>.</div>` : "");
  $("tachysum").textContent = $("t-rhythm").selectedOptions[0].textContent + ($("t-unstable").checked ? ", unstable" : "");
  $("bradysum").textContent = $("b-unstable").checked ? "serious signs" : "";

  // doses
  const D = R.doses(x.kg), kgs = D.kg ? " (" + D.kg + " kg)" : " (enter weight for mg)";
  $("dosesum").textContent = D.kg ? D.kg + " kg" : "no weight";
  $("lido-btn").textContent = "Lidocaine " + (D.kg ? Math.round(D.kg * (state.events.some((e) => e.type === "lido") ? 0.5 : 1)) + " mg" : "1 mg/kg");
  $("doses").innerHTML = `<table class="ref"><thead><tr><th>Drug</th><th>Dose</th><th>When</th></tr></thead><tbody>` + [
    ["Epinephrine", "1 mg IV/IO (1 mg/10 mL), flush 20 mL", "Arrest: every 3-5 min"],
    ["Amiodarone", "300 mg IV/IO push, then 150 mg", "Shock-refractory VF/pVT (after 3rd shock, then after 5th)"],
    ["Lidocaine", "1-1.5 mg/kg, then 0.5-0.75 mg/kg, max 3 mg/kg" + (D.kg ? ": " + D.lidoFirst + ", then " + D.lidoSecond + ", max " + D.lidoMax : ""), "Alternative to amiodarone"],
    ["Atropine", "1 mg IV every 3-5 min, max 3 mg", "Symptomatic bradycardia"],
    ["Epinephrine infusion", "2-10 mcg/min", "Bradycardia not responding; post-ROSC hypotension"],
    ["Dopamine", "5-20 mcg/kg/min" + (D.dopa ? ": " + D.dopa : ""), "Bradycardia not responding"],
    ["Norepinephrine", "start 0.05-0.1 mcg/kg/min (or 5-10 mcg/min), titrate to MAP 65+", "Post-ROSC hypotension"],
    ["Adenosine", "6 mg rapid IV push + 20 mL flush, then 12 mg (3 mg via central line / transplant)", "Regular narrow (or regular monomorphic wide) tachycardia"],
    ["Diltiazem", "0.25 mg/kg over 2 min, then 0.35 mg/kg" + (D.kg ? ": " + D.diltFirst + ", then " + D.diltSecond : ""), "Stable AF/flutter or SVT; not in systolic HF or wide complex"],
    ["Metoprolol", "2.5-5 mg IV every 5 min, max 15 mg", "Stable AF/flutter or SVT"],
    ["Procainamide", "20-50 mg/min until suppressed, hypotension, QRS +50% or max 17 mg/kg" + (D.kg ? " (" + D.procMax + ")" : "") + "; then 1-4 mg/min", "Stable wide-complex tachycardia, pre-excited AF; avoid long QT, HF"],
    ["Amiodarone (with a pulse)", "150 mg IV over 10 min, repeat as needed; 1 mg/min for 6 h then 0.5 mg/min", "Stable VT; AF in the critically ill"],
    ["Magnesium sulfate", "2 g IV over 1-2 min (arrest) or 5-20 min (with a pulse)", "Torsades, low Mg"],
    ["Calcium chloride 10%", "10 mL IV (or calcium gluconate 10% 30 mL)", "Hyperkalemia, hypocalcemia, CCB toxicity"],
    ["Sodium bicarbonate", "50 mmol IV; TCA 1-2 mmol/kg" + (D.kg ? " (" + D.bicarbTCA + ")" : ""), "Hyperkalemia, TCA toxicity, severe acidosis"],
    ["Lipid emulsion 20%", "1.5 mL/kg bolus, then 0.25 mL/kg/min" + (D.kg ? ": " + D.lipidBolus + ", then " + D.lipidInf : ""), "Local anesthetic toxicity"],
    ["Naloxone", "0.04-0.4 mg IV (with a pulse), up to 2 mg", "Opioid; never delays CPR"]].map((r) => `<tr><td><b>${r[0]}</b></td><td>${esc(r[1])}</td><td>${esc(r[2])}</td></tr>`).join("") + `</tbody></table><div class="muted" style="margin-top:6px">Usual adult doses${esc(kgs)}. Check the Island Health code cart sheet.</div>`;
  $("energies").innerHTML = `<table class="ref"><thead><tr><th>Rhythm</th><th>Energy (biphasic)</th></tr></thead><tbody>` + [
    ["VF / pulseless VT", "Device setting (often 120-200 J); if unknown use maximum; may escalate"], ["Polymorphic VT / torsades with a pulse", "Defibrillate: unsynchronized, maximum"],
    ["Atrial fibrillation", "200 J synchronized or more (2025 change from 120-200 J); increase if it fails"], ["Atrial flutter", "200 J synchronized (2025)"],
    ["Regular narrow complex (SVT)", "100 J synchronized"], ["Monomorphic VT with a pulse", "100 J synchronized"]].map((r) => `<tr><td>${r[0]}</td><td>${esc(r[1])}</td></tr>`).join("") +
    `</tbody></table><div class="muted" style="margin-top:6px">Sedate when you can. Press SYNC again before each synchronized shock: many defibrillators turn it off after a shock.</div>`;

  // after ROSC (latest 6 h)
  const now = Date.now(), L6 = (id) => (state.f ? C.latest(state.f.l[id], 6 * HR, now) : null), V6 = (id) => (state.f ? C.latest(state.f.v[id], 6 * HR, now) : null);
  const s6 = V6("sbp"), d6 = V6("dbp"), m6 = V6("map");
  const ro = R.rosc({ map: num("r-map") != null ? num("r-map") : m6 ? m6.v : s6 && d6 ? Math.round((s6.v + 2 * d6.v) / 3) : null, spo2: num("r-spo2") != null ? num("r-spo2") : V6("spo2") && V6("spo2").v,
    pco2: num("r-pco2") != null ? num("r-pco2") : L6("pco2") && L6("pco2").v, glu: L6("glu") && L6("glu").v, temp: V6("temp") && V6("temp").v, k: L6("k") && L6("k").v,
    lactate: L6("lactate") && L6("lactate").v, lactatePrev: x.lactatePrev, follows: $("r-follow").value === "yes" ? true : $("r-follow").value === "no" ? false : null, stemi: $("r-stemi").value === "yes" ? true : $("r-stemi").value === "no" ? false : null });
  $("roscitems").innerHTML = `<table><thead><tr><th>Target</th><th>Goal</th><th>Now</th><th></th><th>If not</th></tr></thead><tbody>` + ro.items.map((i) =>
    `<tr><td><b>${i.name}</b></td><td>${esc(i.target)}</td><td>${i.val == null ? '<span class="nd">no value</span>' : esc(i.val)}</td><td>${i.ok == null ? '<span class="nd">?</span>' : i.ok ? '<span class="ok">✓</span>' : '<span class="bad">✗</span>'}</td><td style="white-space:normal">${esc(i.tip)}</td></tr>`).join("") + `</tbody></table>`;
  $("roscplan").innerHTML = ro.plan.map(alert1).join("");
  const miss = ro.items.filter((i) => i.ok === false).length; $("roscsum").textContent = miss ? miss + " off target" : "";

  // code status and risk
  const cs = R.codeStatus(f ? f.code : []), csT = { dnr: "t2", full: "t1", critical: "t1", unknown: "t2", none: "t3" }[cs.kind];
  const csLabel = { dnr: "No CPR (DNR)", full: "Full code", critical: "Critical care", unknown: "Found, unclear", none: "Not found" }[cs.kind];
  $("code").innerHTML = (cs.kind === "none" ? `<div class="alert ${f ? "urgent" : "info"}">${esc(f ? cs.t : "No chart loaded.")}</div>` :
    `<div class="alert ${cs.kind === "dnr" ? "action" : "info"}"><b>${esc(csLabel)}${cs.most ? " · MOST " + esc(cs.most) : ""}</b> ${esc(cs.text)} <span class="muted">(${esc(cs.source)}${cs.when ? ", " + new Date(cs.when).toLocaleDateString() : ""})</span></div>` +
    (cs.all.length > 1 ? `<div class="muted">Also found: ${cs.all.filter((a) => a.text !== cs.text).map((a) => esc(a.text)).join("; ")}</div>` : "") +
    (cs.kind === "dnr" ? `<div class="alert urgent">If an arrest is called for this patient: confirm the signed MOST form and stop CPR if it says no CPR. Treat reversible problems within the designation.</div>` : "")) +
    `<div class="muted" style="margin-top:6px">Found by searching the problem list, observations and document titles for code status / MOST / DNR wording. The signed MOST form and the PowerChart order are the real record.</div>`;
  $("codesum").textContent = f ? csLabel : "";
  const rk = R.arrestRisk({ sbp: x.sbp, hr: x.hr, rr: x.rr, spo2: x.spo2, k: x.k, mg: x.mg, qtc: x.qtc, qtDrugs: x.med.qt, lactate: x.lactate, ph: x.ph, tropRise: x.tropRise, sedRisk: x.med.opioid.length && (x.med.benzo.length || x.med.sedOther.length) });
  $("risk").innerHTML = !f ? `<div class="muted">No chart loaded.</div>` : rk.length ? rk.map((r) => alert1({ lvl: r.lvl, t: r.t })).join("") +
    `<div class="alert ${cs.kind === "none" ? "urgent" : "info"}">${cs.kind === "none" ? "High-risk signs and no code status found: have the goals-of-care conversation now and write it down." : "Review the plan with the nurse; consider a rapid response / ICU review."}</div>` : `<div class="alert info">No arrest-risk signs in the latest vitals and labs.</div>`;
  $("risksum").textContent = f ? rk.length + " flag" + (rk.length === 1 ? "" : "s") : "";

  // tiles
  $("tiles").innerHTML = [
    tile("Code status", f ? csLabel : "-", f ? (cs.most ? "MOST " + cs.most : cs.kind === "none" ? "check MOST form" : "") : "no chart", f ? csT : ""),
    tile("Hs & Ts", f ? likely.length + " likely" : "-", f ? likely.map((h) => h.name.split(" (")[0]).slice(0, 3).join(", ") || possible.slice(0, 3).map((h) => h.name.split(" (")[0]).join(", ") : "no chart", f ? (likely.length ? "t3" : possible.length ? "t2" : "t0") : ""),
    tile("Arrest risk", f ? rk.length + " flag" + (rk.length === 1 ? "" : "s") : "-", f ? rk.slice(0, 3).map((r) => r.t).join(", ") : "", f ? (rk.some((r) => r.lvl === "urgent") ? "t3" : rk.length ? "t2" : "t0") : ""),
    tile("Weight", x.kg ? x.kg + " kg" : "-", x.kg ? "doses calculated" : "type a weight for mg doses", x.kg ? "t1" : "")].join("");
  $("kgauto").textContent = num("o-kg") == null && f && f.kg ? "chart: " + f.kg + " kg" : "";
  if (f) $("ptsum").textContent = [f.sex, f.age != null ? f.age + " y" : "", f.kg ? f.kg + " kg" : ""].filter(Boolean).join(", ");
  state.likely = likely.map((h) => h.name.split(" (")[0] + " (" + h.ev.join(", ") + ")"); state.cs = cs.kind === "none" ? "not documented" : csLabel + (cs.most ? " (MOST " + cs.most + ")" : "");
  state.rosc = ro.items.filter((i) => i.val != null).map((i) => i.name + " " + i.val);
  drawNote(); drawFamily(); drawSpecial();
}

function drawSpecial() { const k = $("special").value, s = SPECIAL[k]; $("specialbox").innerHTML = s ? `<h3>${esc(s.name)}</h3>` + ul(s.items.map(esc)) + (s.tab ? `<a class="tk" data-toolkit="${s.tab}">Open the related tab</a>` : "") : ""; }
let noteEdited = false, famEdited = false;
function drawNote() {
  if (noteEdited) return;
  const s = codeS();
  $("note").value = R.note({ state: s, events: state.events, now: Date.now(), where: $("n-where").value, witnessed: $("n-wit").value, monitored: $("n-mon").value, family: $("n-fam").value,
    likely: state.likely, postRosc: s.roscT ? state.rosc : [], code: state.cs });
}
function drawFamily() {
  if (famEdited) return;
  const s = codeS();
  $("family").value = R.familyScript({ who: $("f-who").value, pt: $("f-pt").value, outcome: $("f-out").value, where: $("f-where").value, cause: $("f-cause").value,
    mins: s.started ? Math.round(((s.roscT || s.endT || Date.now()) - s.start) / MIN) : null, time: s.endT ? R.clock(s.endT).slice(0, 5) : null });
}

/* ---------------- code timer ---------------- */
function codeS() { return R.codeState(state.events, Date.now()); }
let audio = null;
function beep(freq, ms) { try { audio = audio || new (window.AudioContext || window.webkitAudioContext)(); const o = audio.createOscillator(), g = audio.createGain(); o.frequency.value = freq; g.gain.value = 0.15; o.connect(g); g.connect(audio.destination); o.start(); o.stop(audio.currentTime + ms / 1000); } catch (e) {} }
let lastCheckBeep = null, metroTimer = null;
function renderTimer() {
  const s = codeS();
  const set = (id, cls, v, sub) => { $(id).className = "clk " + (cls || ""); $(id + "-v").textContent = v; if (sub != null && $(id + "-s")) $(id + "-s").textContent = sub; };
  if (!s.started) {
    set("c-total", "", "0:00", "Press Start"); set("c-cycle", "", "2:00", "every 2 minutes"); set("c-epi", "", "-", ""); set("c-count", "", "0 / 0");
    $("prompts").innerHTML = `<div class="alert info">Press <b>Start</b> when the arrest is called. Each rhythm button logs a check and restarts the 2-minute cycle. The timer keeps running if you switch tabs.</div>`;
    $("timersum").textContent = ""; renderLog(); return s;
  }
  set("c-total", s.phase === "rosc" ? "good" : s.ended ? "" : "", R.fmt(s.elapsed), s.ended ? "ended " + R.clock(s.endT) : s.phase === "rosc" ? "ROSC at +" + R.fmt(s.roscT - s.start) : "called " + R.clock(s.start));
  if (s.phase === "arrest") {
    set("c-cycle", s.checkIn <= 0 ? "over" : s.checkIn <= 15e3 ? "due" : "wait", s.checkIn <= 0 ? "NOW" : R.fmt(s.checkIn), "cycle " + (s.cycles + 1) + (s.rhythm ? " · last: " + R.RHYTHM[s.rhythm] : ""));
    const ek = s.epiState.k; set("c-epi", ek === "over" ? "over" : ek === "due" ? "due" : "wait", s.lastEpi ? R.fmt(s.epiSince) : ek === "due" ? "GIVE" : "-", s.epiState.t);
    if (s.checkIn <= 0 && lastCheckBeep !== s.nextCheck && $("beep").checked) { lastCheckBeep = s.nextCheck; beep(880, 350); setTimeout(() => beep(880, 350), 450); }
  } else { set("c-cycle", "", "-", s.phase === "rosc" ? "ROSC: no cycles" : "ended"); set("c-epi", "", s.epi ? s.epi + " given" : "-", ""); }
  set("c-count", "", s.shocks + " / " + s.epi);
  $("prompts").innerHTML = s.phase === "rosc" ? `<div class="alert info">ROSC: open the <b>After ROSC</b> tab. Press Re-arrest if the pulse is lost.</div>` : s.ended ? `<div class="alert info">Code ended. Write the note (Note &amp; family tab), then Reset the timer.</div>` : s.prompts.map(alert1).join("");
  $("timersum").textContent = s.ended ? "ended" : s.phase === "rosc" ? "ROSC" : "running " + R.fmt(s.elapsed);
  $("shock-btn").textContent = "Shock " + $("joules").value + " J";
  return s;
}
function renderLog() {
  const ev = state.events.slice().sort((a, b) => a.t - b.t), s0 = ev.find((e) => e.type === "start");
  $("log").querySelector("tbody").innerHTML = ev.length ? ev.map((e) => `<tr><td>${R.clock(e.t)}</td><td>${s0 ? "+" + R.fmt(e.t - s0.t) : ""}</td><td class="wrap">${esc(R.eventText(e))}</td><td><button data-del="${e.t}" title="Delete this entry">×</button></td></tr>`).join("") : `<tr><td colspan="4" class="muted">No events yet.</td></tr>`;
}
function addEvent(type, v) {
  if (type !== "start" && !state.events.some((e) => e.type === "start")) state.events.push({ t: Date.now() - 1, type: "start" });
  if (type === "start" && state.events.some((e) => e.type === "start" && !state.events.some((z) => z.type === "end"))) { renderTimer(); return; }
  state.events.push({ t: Date.now(), type, v: v == null ? undefined : v });
  save(); renderLog(); renderTimer(); draw();
}
$$(".pads button[data-ev]").forEach((b) => (b.onclick = () => {
  const t = b.dataset.ev; let v = b.dataset.v;
  if (t === "shock") v = +$("joules").value;
  if (t === "lido") { const D = R.doses(facts().kg); v = D.kg ? Math.round(D.kg * (state.events.some((e) => e.type === "lido") ? 0.5 : 1)) : state.events.some((e) => e.type === "lido") ? 50 : 100; }
  if (b.dataset.def != null) { v = $("freetext").value.trim() || b.dataset.def; if (!v) { $("freetext").focus(); $("freetext").placeholder = "Type the note here, then press Add note"; return; } $("freetext").value = ""; }
  addEvent(t, v);
}));
$("joules").onchange = renderTimer;
$("otherdrug").onchange = () => { const v = $("otherdrug").value; if (v) addEvent("drug", v); $("otherdrug").value = ""; };
$("endsel").onchange = () => { const v = $("endsel").value; if (v) addEvent("end", v); $("endsel").value = ""; };
$("undo").onclick = () => { if (!state.events.length) return; state.events.sort((a, b) => a.t - b.t).pop(); save(); renderLog(); renderTimer(); draw(); };
$("reset").onclick = () => { if (state.events.length && !confirmReset()) return; state.events = []; save(); noteEdited = false; renderLog(); renderTimer(); draw(); };
function confirmReset() { return window.confirm ? window.confirm("Clear the code timer and event log? Copy the log first if you need it.") : true; }
$("log").onclick = (e) => { const b = e.target.closest("[data-del]"); if (!b) return; state.events = state.events.filter((x) => String(x.t) !== b.dataset.del); save(); renderLog(); renderTimer(); draw(); };
$("practice").onclick = () => { if (state.events.length && !confirmReset()) return; const t0 = Date.now() - 9 * MIN; state.events = (window.ACLS_PRACTICE || []).map(([m, type, v]) => ({ t: Math.round(t0 + m * MIN), type, v })); save(); noteEdited = false; renderLog(); renderTimer(); draw(); };
const copyText = (s) => { try { navigator.clipboard.writeText(s); } catch (e) {} };
$("copylog").onclick = () => copyText(R.logText(state.events));
$("metro").onchange = () => { clearInterval(metroTimer); metroTimer = null; if ($("metro").checked) metroTimer = setInterval(() => beep(1200, 30), Math.round(60000 / 110)); };
setInterval(() => { const s = renderTimer(); if (s.started && !s.ended && !noteEdited && document.activeElement !== $("note")) drawNote(); }, 500);

/* ---------------- load ---------------- */
$("arrestref").innerHTML = ARREST_REF; $("talk").innerHTML = TALK; $("debrief").innerHTML = DEBRIEF;
Object.entries(SPECIAL).forEach(([k, s]) => { const o = document.createElement("option"); o.value = k; o.textContent = s.name; $("special").appendChild(o); });
function autoTicks(preset) {
  const p = (preset && preset.sit) || {}, x = facts();
  $("b-hr").value = ""; $("t-hr").value = ""; ["r-map", "r-spo2", "r-pco2"].forEach((id) => ($(id).value = ""));
  $("b-unstable").checked = !!p.bradyUnstable || (x.hr != null && x.hr < 50 && x.sbp != null && x.sbp < 90);
  $("b-wide").checked = false; $("b-tx").checked = prob("transplant");
  $("t-rhythm").value = p.tachy || (prob("af") ? "af" : "narrow");
  $("t-unstable").checked = !!p.unstable;
  $("r-follow").value = ""; $("r-stemi").value = "";
}
function load(raw, note, errors, preset) {
  state.f = raw ? C.parse(raw) : null;
  if (!raw) $("ptsum").textContent = "";
  autoTicks(preset);
  $("pstatus").textContent = note; $("clear").hidden = !raw;
  $("errs").innerHTML = errors && errors.length ? "Could not read: " + errors.map(esc).join("; ") + (errors.some((e) => /\b40[13]\b|Unauthorized|Forbidden/i.test(e)) ? ". Check the scopes in the Code Console." : ". Cerner's sandbox can be slow: reload the patient to try again.") : "";
  draw();
}
$$(".inputs input, .inputs select").forEach((el) => { if (["testsel", "special", "note", "family"].includes(el.id) || el.closest(".pads")) return; el.addEventListener(el.type === "number" || el.type === "text" || el.tagName === "INPUT" && !el.type.match(/checkbox/) ? "input" : "change", draw); });
$("special").onchange = drawSpecial;
$("note").oninput = () => (noteEdited = true); $("family").oninput = () => (famEdited = true);
$("copy").onclick = () => copyText($("note").value); $("copyfam").onclick = () => copyText($("family").value);
document.addEventListener("click", (e) => {
  const k = e.target.closest("[data-toolkit]"); if (!k) return;
  e.preventDefault();
  try { if (window.parent !== window && typeof window.parent.show === "function") { window.parent.show(k.dataset.toolkit); return; } } catch (err) {}
  window.open((/\/tools\/acls\//.test(location.pathname) ? "../../index.html#" : "../hospitalist-toolkit/index.html#") + k.dataset.toolkit, "_blank", "noopener");
});
$("clear").onclick = () => { $("testsel").value = ""; load(null, "Open from Cerner to read the chart, or pick a made-up patient. The code timer works without a patient."); };
const SAMPLES = window.ACLS_SAMPLES || [];
SAMPLES.forEach((p, i) => { const o = document.createElement("option"); o.value = i; o.textContent = p.label; $("testsel").appendChild(o); });
$("testsel").onchange = () => { const p = SAMPLES[$("testsel").value]; if (!p) return $("clear").onclick(); load(p.build(Date.now()), "Made-up patient: " + p.label, [], p); };

async function fromChart() {
  if (typeof FHIR === "undefined" || !(location.search.includes("code=") || location.search.includes("complete=") || sessionStorage.getItem("SMART_KEY"))) return;
  $("pstatus").textContent = "Reading the chart…";
  try {
    const client = await FHIR.oauth2.ready();
    const { raw, errors } = await C.gather(client, (msg) => ($("pstatus").textContent = msg));
    load(raw, "Chart read (read-only). Nothing is sent anywhere. The code timer works with or without the chart.", errors);
  } catch (e) { $("pstatus").textContent = "Could not read the chart: " + (e && e.message ? e.message : e) + ". The timer and the made-up patients still work."; }
}
renderLog(); renderTimer();
const demo = new URLSearchParams(location.search).get("demo");
if (demo && SAMPLES[+demo - 1]) { $("testsel").value = String(+demo - 1); $("testsel").onchange(); } else { draw(); fromChart(); }
