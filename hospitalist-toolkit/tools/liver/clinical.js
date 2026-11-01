/* Liver tab: kidneys and BP, HRS-AKI plan, ascitic fluid, nutrition, VTE. Uses the page's globals ($, esc, fmtD, fmtDT, ago, r1, state, R, C, S, DAY, draw).
   UNVERIFIED draft written by Claude. */
const HR = 36e5;
const ul = (arr) => "<ul>" + arr.filter(Boolean).map((t) => "<li>" + t + "</li>").join("") + "</ul>";
const block = (h, items) => (items.filter(Boolean).length ? `<h3>${esc(h)}</h3>` + ul(items) : "");
const chip = (st) => `<span class="chip c-${st}">${{ yes: "Yes", likely: "Likely", no: "No", unknown: "Not known" }[st]}</span>`;
const lastOf = (arr) => (arr && arr.length ? arr[arr.length - 1] : null);
const crAt = (f, t) => { const a = f.labs.creat.filter((e) => e.t <= t && t - e.t <= 3 * DAY); return a.length ? a[a.length - 1].v : null; };
const recent = (f, cat, days, now) => f.medList.filter((m) => m.cats.includes(cat) && (m.active || (m.t && now - m.t <= days * DAY)));
const names = (list) => [...new Set(list.map((m) => m.name.split(/\s\d/)[0].trim()))];

function context(f, v, x, cp, now) {
  const c = { now };
  c.creats = f.labs.creat.filter((e) => now - e.t <= 365 * DAY);
  const latestCr = lastOf(c.creats);
  c.crFresh = latestCr && now - latestCr.t <= 3 * DAY;
  const mb = parseFloat($("basecr").value);
  c.esrd = !!f.prob.esrd;
  c.aki = c.creats.length && !c.esrd ? R.aki(c.creats, { manualBaseline: isFinite(mb) ? mb : null, age: f.age, sex: x.sex || f.sex }) : null;
  if (c.aki && !c.crFresh) c.aki.stale = true;
  const vit = f.vitals.filter((r) => now - r.t <= 3 * DAY);
  c.bp = [...vit].reverse().find((r) => r.sbp != null && r.dbp != null) || null;
  c.map = c.bp ? (c.bp.map != null ? c.bp.map : R.mapOf(c.bp.sbp, c.bp.dbp)) : null;
  const maps = vit.filter((r) => now - r.t <= DAY).map((r) => (r.map != null ? r.map : R.mapOf(r.sbp, r.dbp))).filter((m) => m != null);
  c.minMap = maps.length ? Math.min(...maps) : null;
  const sp = [...vit].reverse().find((r) => r.spo2 != null); c.spo2 = sp ? sp.spo2 : null;
  const hrr = [...vit].reverse().find((r) => r.hr != null); c.hr = hrr ? hrr.hr : null;
  c.wt = lastOf(f.weights); c.ht = lastOf(f.heights);
  c.ex = {}; Object.keys(f.extra).forEach((k) => (c.ex[k] = C.latest(f.extra[k], 3 * DAY, now)));
  c.u = {}; Object.keys(f.urine).forEach((k) => (c.u[k] = C.latest(f.urine[k], 7 * DAY, now)));
  c.taps = f.taps.concat(state.manualTaps).sort((a, b) => b.t - a.t);
  c.asciteGrade = x.ascites;
  c.ascitesHint = !!(f.prob.ascites || (f.meds.spironolactone && f.meds.spironolactone.active) || (f.meds.furosemide && f.meds.furosemide.active) || c.taps.length);
  c.ascites = x.ascites >= 2;
  c.nephro = names([].concat(recent(f, "nsaid", 7, now), recent(f, "aminoglycoside", 7, now), recent(f, "acearb", 7, now), recent(f, "contrast", 7, now)));
  c.diuretics = names([].concat(recent(f, "spironolactone", 1, now), recent(f, "furosemide", 1, now)));
  c.nsbb = names(recent(f, "nsbb", 1, now));
  c.cp = cp;
  return c;
}

function drawClinical(f, v, x, cp, now) {
  const c = context(f, v, x, cp, now);
  drawKidney(f, v, x, c); drawHrs(f, v, x, c); drawFluid(f, v, x, c); drawNutrition(f, v, x, c); drawVte(f, v, x, c);
}

/* ---------- kidneys and blood pressure ---------- */
function drawKidney(f, v, x, c) {
  const a = c.aki, out = [];
  if (c.esrd) { $("kidney").innerHTML = '<div class="result alert info">On chronic dialysis (problem list): creatinine-based AKI and HRS-AKI assessment do not apply.</div>'; $("kidsum").textContent = "chronic dialysis"; }
  else if (!a) { $("kidney").innerHTML = '<div class="muted">No creatinine found in the past year.</div>'; $("kidsum").textContent = ""; }
  else {
    const st = a.stale ? "No creatinine in the past 72 h" : a.isAki ? "AKI stage " + a.sub : "No AKI by creatinine";
    $("kidsum").textContent = st;
    out.push(`<div class="result ${a.isAki && !a.stale ? (a.stage >= 2 ? "alert urgent" : "alert action") : "alert info"}">${esc(st)}</div>`);
    out.push(`<div class="kv"><div>Creatinine now</div><div>${r1(a.cur.v)} umol/L (${fmtDT(a.cur.t)})</div>
      <div>Baseline</div><div>${r1(a.base)} umol/L <span class="muted">(${esc(a.src)})</span></div>
      <div>Ratio to baseline</div><div>${Math.round(a.ratio * 100) / 100}x</div>
      <div>Change in 48 h</div><div>${a.rise48 != null ? (a.rise48 >= 0 ? "+" : "") + r1(a.rise48) + " umol/L" : "no earlier value in 48 h"}</div>
      <div>eGFR (CKD-EPI 2021)</div><div>${f.age != null ? Math.round(R.egfr(a.cur.v, f.age, x.sex || f.sex)) + " mL/min/1.73m² <span class='muted'>(overestimates in cirrhosis)</span>" : "age unknown"}</div>
      ${c.ex.urea ? `<div>Urea</div><div>${r1(c.ex.urea.v)} mmol/L</div>` : ""}${c.ex.k ? `<div>Potassium</div><div>${r1(c.ex.k.v)} mmol/L</div>` : ""}</div>`);
    const recentCr = c.creats.slice(-6).reverse();
    out.push(`<div class="muted" style="margin-top:6px">Recent creatinine: ${recentCr.map((e) => r1(e.v) + " (" + fmtD(e.t) + ")").join(", ")}</div>`);
    // urine studies
    const u = c.u, uout = [];
    if (u.una) uout.push("Urine Na " + esc(u.una.shown));
    let fe = null;
    if (u.una && u.ucr && v.na && a) { fe = R.fena(u.una.v, u.ucr.v, u.ucr.unit, v.na.v, a.cur.v); if (fe != null) uout.push("FENa " + (Math.round(fe * 100) / 100) + "%"); }
    if (u.uprotcr) uout.push("Urine protein/creatinine " + esc(u.uprotcr.shown));
    else if (u.uprot) uout.push("Urine protein " + esc(u.uprot.shown));
    if (u.urbc) uout.push("Urine RBC " + esc(u.urbc.shown));
    out.push(uout.length ? `<div style="margin-top:6px"><b>Urine (7 days):</b> ${uout.join(" · ")}${fe != null ? '<div class="muted">FENa is often below 1% in cirrhosis even without AKI, so it does not prove HRS; below 0.1-0.2% supports it (ICA-ADQI 2024).</div>' : ""}</div>` : '<div class="muted" style="margin-top:6px">No urine sodium, protein or sediment found in 7 days. In AKI: urinalysis with microscopy, urine protein/creatinine, urine sodium and creatinine, and a renal ultrasound.</div>');
    $("kidney").innerHTML = out.join("");
  }
  // blood pressure
  const b = [], nb = R.nsbbCheck({ map: c.map, sbp: c.bp && c.bp.sbp, na: v.na && v.na.v, cr: a && a.cur.v, aki: a && a.isAki && !a.stale });
  if (!c.bp) b.push('<div class="muted">No blood pressure found in the past 72 h.</div>');
  else b.push(`<div class="kv"><div>Latest BP</div><div>${c.bp.sbp}/${c.bp.dbp} (${fmtDT(c.bp.t)})</div><div>MAP</div><div>${Math.round(c.map)}${c.map < 65 ? ' <b class="err">below 65</b>' : ""}</div>
    ${c.minMap != null ? `<div>Lowest MAP, 24 h</div><div>${Math.round(c.minMap)}</div>` : ""}${c.hr != null ? `<div>Heart rate</div><div>${c.hr}</div>` : ""}${c.spo2 != null ? `<div>SpO2</div><div>${c.spo2}%</div>` : ""}</div>`);
  const items = [];
  if (c.nsbb.length) {
    if (nb.hold.length) items.push(`<b>Hold or reduce ${esc(c.nsbb.join(", "))}:</b> ${esc(nb.hold.join("; "))}.`);
    else if (nb.caution.length) items.push(`<b>Use ${esc(c.nsbb.join(", "))} with caution:</b> ${esc(nb.caution.join("; "))}.`);
    else items.push(`${esc(c.nsbb.join(", "))}: no hold criteria met.`);
  }
  if (c.map != null && c.map < 65) items.push("MAP below 65: look for sepsis (including SBP) and bleeding; review sedatives, antihypertensives and diuretics.");
  const avoid = names([].concat(recent(f, "acearb", 1, c.now), recent(f, "alpha", 1, c.now)));
  if (avoid.length && (c.ascites || c.ascitesHint)) items.push(`Ascites with ${esc(avoid.join(", "))}: ACE inhibitors, ARBs and alpha-blockers are best avoided in ascites (AASLD 2021).`);
  b.push(items.length ? ul(items) : "");
  $("bp").innerHTML = b.join("");
}

/* ---------- HRS-AKI ---------- */
function drawHrs(f, v, x, c) {
  const a = c.aki;
  if (!a || !a.isAki || a.stale) { $("hrs").innerHTML = '<div class="muted">' + (c.esrd ? "On chronic dialysis: HRS-AKI does not apply." : a && a.stale ? "No creatinine in the past 72 h: HRS cannot be assessed." : "No AKI by creatinine, so HRS-AKI does not apply now.") + "</div>"; $("plan").innerHTML = ""; $("hrssum").textContent = "not applicable"; return; }
  // volume challenge: albumin in the past 4 days
  const alb = f.albumin.filter((e) => c.now - e.t <= 4 * DAY);
  const firstAlb = alb[0];
  const alt = [];
  const vaso = names([].concat(recent(f, "vasopressor", 1, c.now)));
  if (c.map != null && c.map < 65) alt.push("MAP " + r1(c.map) + " (shock?)" + (vaso.length ? " on " + vaso.join(", ") : ""));
  else if (vaso.length) alt.push("on vasopressors: " + vaso.join(", "));
  const nephro7 = names([].concat(recent(f, "nsaid", 7, c.now), recent(f, "aminoglycoside", 7, c.now), recent(f, "contrast", 7, c.now)));
  if (nephro7.length) alt.push("drug injury possible (" + nephro7.join(", ") + "): counts against HRS only if kidney function is expected to recover once stopped");
  const u = c.u;
  if (u.uprotcr) { let pc = u.uprotcr.v; if (/g\/g|mg\/mg/i.test(u.uprotcr.unit)) pc *= 113; else if (/mg\/g/i.test(u.uprotcr.unit)) pc *= 0.113; if (pc > 50) alt.push("urine protein/creatinine " + u.uprotcr.shown + " (above about 50 mg/mmol: glomerular injury?)"); }
  if (u.urbc && u.urbc.v > 50) alt.push("urine RBC " + u.urbc.shown + " (above 50/hpf)");
  const h = R.hrs({ ascites: c.ascites, ascitesHint: c.ascitesHint, ascitesEv: c.ascites ? "Ascites grade chosen above" : c.ascitesHint ? "Ascites suggested by the chart (problem list, diuretics or paracentesis): confirm" : "No ascites recorded",
    aki: a, volGiven: !!firstAlb, crAtVol: firstAlb ? crAt(f, firstAlb.t) : null, hoursSinceVol: firstAlb ? (c.now - firstAlb.t) / HR : null, altCauses: alt, manual: state.hrsManual });
  const resText = { yes: "Meets HRS-AKI criteria", likely: "Probable HRS-AKI: confirm the items marked Likely", no: "Does not meet HRS-AKI criteria", incomplete: "HRS-AKI not decided: answer the items marked Not known" }[h.result];
  $("hrssum").textContent = resText;
  $("hrs").innerHTML = `<table><tr><th>Criterion</th><th>Status</th><th>From the chart</th><th>Your answer</th></tr>` +
    h.items.map((i) => `<tr><td class="wrap">${esc(i.label)}</td><td>${chip(i.state)}</td><td class="wrap muted">${esc(i.ev)}</td>
      <td><select data-hrs="${i.id}"><option value="">Auto</option><option value="yes"${state.hrsManual[i.id] === "yes" ? " selected" : ""}>Yes</option><option value="no"${state.hrsManual[i.id] === "no" ? " selected" : ""}>No</option></select></td></tr>`).join("") +
    `</table><div class="result alert ${h.result === "yes" ? "urgent" : h.result === "likely" ? "action" : "info"}">${esc(resText)}</div>`;
  document.querySelectorAll("[data-hrs]").forEach((s) => (s.onchange = () => { state.hrsManual[s.dataset.hrs] = s.value || undefined; draw(); }));
  // when did a vasoconstrictor start? (for the 25% response target)
  const vc = f.medList.filter((m) => m.given && m.t && c.now - m.t <= 14 * DAY && m.cats.some((k) => ["terlipressin", "norepinephrine", "midodrine"].includes(k))).sort((p, q) => p.t - q.t);
  const crStart = vc.length ? crAt(f, vc[0].t) : a.cur.v;
  const steps = R.akiPlan({ aki: a, hrsResult: h.result, wt: c.wt && c.wt.v, map: c.map, spo2: c.spo2, cr: a.cur.v, nephrotoxins: c.nephro, diuretics: c.diuretics, nsbb: c.nsbb, crAtStart: crStart });
  const now = [];
  if (vc.length) now.push(`Vasoconstrictor on record since ${fmtD(vc[0].t)} (${esc(vc[0].name)}). Creatinine then ${r1(crStart)}, now ${r1(a.cur.v)}: ${a.cur.v <= crStart * 0.75 ? "responding (25% or more fall)" : "not yet a 25% fall"}.`);
  if (alb.length) now.push(`Albumin given in the past 4 days: ${alb.length} dose(s)${alb.some((e) => e.g) ? ", about " + Math.round(alb.reduce((s2, e) => s2 + (e.g || 0), 0)) + " g in total" : ""}.`);
  $("plan").innerHTML = (now.length ? block("Already done", now.map(esc)) : "") + steps.map((s2) => block(s2.h, s2.items.map(esc))).join("");
}

/* ---------- ascitic fluid ---------- */
function drawFluid(f, v, x, c) {
  const serumAlbAt = (t) => { const a = f.labs.alb.filter((e) => Math.abs(e.t - t) <= DAY); return a.length ? a[a.length - 1].v : null; };
  const ldh = c.ex.ldh || lastOf(f.extra.ldh);
  const rows = c.taps.slice(0, 6).map((tap) => {
    const it = R.fluid(tap, { alb: serumAlbAt(tap.t), ldhUln: ldh && ldh.hi });
    const n = (val, d) => (val != null ? r1(val) : '<span class="muted">–</span>');
    const notes = [];
    if (it.sbp) notes.push("<b class='err'>SBP</b> (PMN " + Math.round(it.corr) + (tap.rbc ? ", corrected for RBC" : "") + ")");
    else if (it.corr != null) notes.push("PMN " + Math.round(it.corr) + ": no SBP");
    if (it.bacterascites) notes.push("<b>Bacterascites</b> (culture positive, PMN below 250)");
    if (it.secondary) notes.push("<b class='err'>Possible secondary peritonitis</b>" + (it.runyon.length ? " (" + it.runyon.join(", ") + ")" : " (polymicrobial culture)"));
    if (it.saag != null) notes.push("SAAG " + r1(it.saag) + " g/L: " + (it.portal ? "portal hypertension" : "<b>not portal hypertension</b> (check cytology, TB, pancreas, nephrotic)"));
    if (it.lowProt) notes.push("protein below 15 g/L");
    if (it.hemorrhagic) notes.push("bloody (RBC above 50,000)");
    if (tap.site === "unspecified") notes.push("<span class='muted'>fluid site not stated: assumed ascitic</span>");
    tap._it = it;
    return `<tr><td>${fmtD(tap.t)}${tap.src === "manual" ? " <span class='muted'>(entered)</span>" : ""}</td><td class="num">${n(tap.wbc)}</td><td class="num">${tap.pmn != null ? n(tap.pmn) : tap.pmnPct != null ? n(tap.pmnPct) + "%" : n(null)}</td>
      <td class="num">${n(tap.alb)}</td><td class="num">${n(tap.prot)}</td><td class="num">${n(tap.glu)}</td><td class="num">${n(tap.ldh)}</td><td class="wrap">${esc(tap.culture || tap.gram || "")}</td><td class="wrap">${notes.join("; ")}</td></tr>`;
  });
  $("taps").innerHTML = rows.length ? `<table><tr><th>Date</th><th>WBC/uL</th><th>PMN</th><th>Alb g/L</th><th>Prot g/L</th><th>Glu</th><th>LDH</th><th>Culture</th><th>Interpretation</th></tr>${rows.join("")}</table>` +
    (ldh && !ldh.hi ? "" : "") : '<div class="muted">No ascitic fluid results found. Add one below if the paracentesis was done elsewhere, or if your lab names fluid tests differently.</div>';
  const last = c.taps[0], it = last ? last._it : null;
  $("fluidsum").textContent = last ? "last tap " + fmtD(last.t) + (it && it.sbp ? ": SBP" : "") : "no tap found";

  const wt = c.wt && c.wt.v, plan = [];
  // diagnostic tap
  const recentTap = c.taps.find((t2) => c.now - t2.t <= 3 * DAY);
  if ((c.ascites || c.ascitesHint) && !recentTap) plan.push(block("Diagnostic paracentesis", ["No ascitic fluid result in the past 3 days. AASLD 2021: tap every admitted patient with ascites, and anyone with ascites and fever, abdominal pain, encephalopathy, AKI, GI bleed or clinical decline.",
    "Send cell count with differential, albumin (with a same-day serum albumin for SAAG), total protein, and culture in blood-culture bottles at the bedside. Add glucose and LDH if secondary peritonitis is possible; cytology if malignancy is possible.",
    "No need to correct INR or platelets first (AGA 2021, AASLD 2021)."]));
  // LVP albumin
  const lit = parseFloat($("lvp").value), lv = R.albuminLvp(lit);
  $("lvpout").innerHTML = isFinite(lit) && lit > 0 ? (lv ? `<b>Give ${lv.lo}-${lv.hi} g albumin</b> (6-8 g per litre removed; 25% albumin ${lv.lo * 4}-${lv.hi * 4} mL).` : "5 L or less: albumin not routinely needed.") + (lit > 8 ? " More than 8 L raises the risk of circulatory dysfunction." : "") : "";
  if (it && it.sbp) {
    const ad = R.albuminSbp(wt), onAbx = names([].concat(recent(f, "sbpabx", 2, c.now), recent(f, "broadabx", 2, c.now)));
    const bili = v.bili && v.bili.v, cr = v.creat && v.creat.v, urea = c.ex.urea && c.ex.urea.v;
    const hi = [cr > 88 ? "creatinine above 88" : "", urea > 10.7 ? "urea above 10.7 (BUN 30)" : "", bili > 68 ? "bilirubin above 68" : ""].filter(Boolean);
    plan.push(block("Spontaneous bacterial peritonitis: treat now", [
      onAbx.length ? "Antibiotics on record: " + onAbx.join(", ") + ". Check they fit the setting below." : "No antibiotic found in the past 2 days.",
      "Community-acquired, no recent antibiotics, not septic: ceftriaxone 2 g IV every 24 h (or cefotaxime). Hospital-acquired, recent antibiotics or sepsis: broader cover (for example piperacillin-tazobactam or meropenem) per the Island Health antibiogram.",
      "Usual duration 5-7 days. Repeat the tap at 48 h if not improving: a PMN fall under 25% means broaden antibiotics and look for secondary peritonitis.",
      ad ? `IV albumin 1.5 g/kg within 6 h (${ad.d1} g for ${r1(wt)} kg) and 1 g/kg on day 3 (${ad.d3} g). Many protocols cap at 150 g and 100 g.` : "IV albumin 1.5 g/kg on day 1 and 1 g/kg on day 3 (no weight found).",
      hi.length ? "Albumin matters most here: " + hi.join(", ") + "." : "Albumin benefit is greatest with creatinine above 88, urea above 10.7 or bilirubin above 68.",
      "Hold the beta-blocker if MAP is below 65 or AKI develops. Avoid large-volume paracentesis without albumin during the infection.",
      "After recovery: long-term secondary prophylaxis (ciprofloxacin 500 mg daily or trimethoprim-sulfamethoxazole DS daily; norfloxacin is often unavailable)."]));
  }
  if (it && it.secondary) plan.push(block("Possible secondary peritonitis", ["CT abdomen and pelvis and an urgent surgical consult.", "Add anaerobic cover (for example metronidazole, or use piperacillin-tazobactam)."]));
  if (it && it.bacterascites) plan.push(block("Bacterascites", ["If symptomatic (fever, pain, encephalopathy): treat as SBP.", "If well: no antibiotics yet; repeat the tap and treat if PMN is 250 or more or the culture grows again."]));
  if (it && it.portal === false) plan.push(block("SAAG below 11 g/L", ["Not portal-hypertensive ascites: send cytology, AFB smear and culture or ADA (TB), amylase; consider peritoneal carcinomatosis, nephrotic syndrome, pancreatitis."]));
  if (it && it.lowProt && !it.sbp) {
    const pr = R.sbpProphylaxis({ prot: last.prot, cr: v.creat && v.creat.v, urea: c.ex.urea && c.ex.urea.v, na: v.na && v.na.v, cp: c.cp && c.cp.complete ? c.cp.score : c.cp ? c.cp.lo : null, bili: v.bili && v.bili.v });
    const already = names(recent(f, "sbpabx", 2, c.now));
    if (pr) plan.push(block("Primary SBP prophylaxis", [pr.meets ? "Consider it: ascitic protein below 15 g/L with " + pr.why.join("; ") + "." : "Ascitic protein below 15 g/L, but no kidney or liver criterion met: prophylaxis not indicated by AASLD 2021.",
      pr.meets ? (already.length ? "On record: " + already.join(", ") + "." : "Options: ciprofloxacin 500 mg daily or trimethoprim-sulfamethoxazole DS daily.") : ""]));
  }
  // ascites treatment
  if (c.ascites || c.ascitesHint) {
    const holds = R.diureticHolds({ aki: c.aki && c.aki.isAki && !c.aki.stale, na: v.na && v.na.v, k: c.ex.k && c.ex.k.v, heBad: x.he === 3 });
    const sp = recent(f, "spironolactone", 1, c.now)[0], fu = recent(f, "furosemide", 1, c.now)[0];
    const spMg = sp ? C.dailyMg(sp.name) : null, fuMg = fu ? C.dailyMg(fu.name) : null;
    const doses = sp || fu ? `Current: ${sp ? esc(sp.name) + (spMg ? " (" + spMg + " mg/day)" : "") : "no aldosterone antagonist"}; ${fu ? esc(fu.name) + (fuMg ? " (" + fuMg + " mg/day)" : "") : "no loop diuretic"}.` + (spMg && fuMg ? ` Ratio ${Math.round((spMg / fuMg) * 40)}:40 (target 100:40).` : "") : "No diuretics on record.";
    plan.push(block("Ascites treatment", [
      "Sodium 2 g (about 88 mmol) per day; loosen this if it stops the patient eating.",
      holds.length ? "<b>" + holds.map(esc).join(" ") + "</b>" : "",
      doses,
      holds.length ? "" : (sp || fu ? "If weight loss is below target, raise both together every 3-5 days keeping the 100:40 ratio, to a maximum of 400 mg + 160 mg." : "Start spironolactone 100 mg + furosemide 40 mg daily; raise together every 3-5 days to a maximum of 400 mg + 160 mg.") + " Aim for weight loss of about 0.5 kg/day (1 kg/day with leg edema). Urine Na:K above 1 with no weight loss suggests dietary sodium.",
      v.na && v.na.v <= 125 ? "Fluid restriction about 1 L/day (sodium 125 or lower)." : "No fluid restriction needed unless sodium is 125 or lower.",
      "Tense or refractory ascites: large-volume paracentesis with albumin (calculator above); refer for TIPS assessment and transplant evaluation.",
      "Avoid NSAIDs, ACE inhibitors, ARBs, alpha-blockers and aminoglycosides."]));
  }
  $("fluidplan").innerHTML = plan.join("") || '<div class="muted">No ascites recorded: choose the ascites grade above if present.</div>';
}

/* ---------- nutrition ---------- */
function drawNutrition(f, v, x, c) {
  if (!c.wt) { $("nut").innerHTML = '<div class="muted">No weight found: targets need a weight (and height for BMI).</div>'; $("nutsum").textContent = ""; return; }
  const sel = $("drylevel").value, level = sel === "auto" ? (x.ascites === 3 ? 2 : x.ascites === 2 ? 1 : 0) : +sel;
  const n = R.nutrition({ wt: c.wt.v, ht: c.ht && c.ht.v, sex: x.sex || f.sex, ascitesLevel: level, edema: $("edema").checked, childC: c.cp && c.cp.complete && c.cp.cls === "C" });
  $("nutsum").textContent = (n.risk === "high" ? "high malnutrition risk · " : "") + n.kcal[0] + (n.kcal[1] !== n.kcal[0] ? "-" + n.kcal[1] : "") + " kcal, " + n.prot[0] + "-" + n.prot[1] + " g protein/day";
  const refeed = [];
  if (c.ex.k && c.ex.k.v < 3.5) refeed.push("potassium " + r1(c.ex.k.v)); if (c.ex.mg && c.ex.mg.v < 0.7) refeed.push("magnesium " + c.ex.mg.v.toFixed(2)); if (c.ex.phos && c.ex.phos.v < 0.8) refeed.push("phosphate " + c.ex.phos.v.toFixed(2));
  const alcohol = f.problems.concat(f.prob.ascites || []).some((p) => /alcohol|K70/i.test(p));
  const thiamine = f.meds.thiamine && (f.meds.thiamine.active || (f.meds.thiamine.lastGiven && c.now - f.meds.thiamine.lastGiven <= 2 * DAY));
  $("nut").innerHTML = `<div class="kv"><div>Weight</div><div>${r1(c.wt.v)} kg (${fmtD(c.wt.t)})${c.ht ? " · height " + r1(c.ht.v) + " cm" : " · no height found"}</div>
    <div>Dry weight</div><div>${r1(n.dry)} kg${level || $("edema").checked ? "" : " (no fluid subtracted)"}</div>
    <div>BMI (dry)</div><div>${n.bmi != null ? r1(n.bmi) : "needs height"}</div>
    <div>Energy</div><div><b>${n.kcal[0]}${n.kcal[1] !== n.kcal[0] ? "-" + n.kcal[1] : ""} kcal/day</b> <span class="muted">(${esc(n.basis)})</span></div>
    <div>Protein</div><div><b>${n.prot[0]}-${n.prot[1]} g/day</b> (1.2-1.5 g/kg)</div>
    <div>Malnutrition risk</div><div>${n.risk === "high" ? "<b>High</b> (BMI below 18.5 or Child-Pugh C)" : "At risk: all patients with cirrhosis should be screened"}</div></div>` +
    ul(["Do <b>not</b> restrict protein, including in hepatic encephalopathy.", "Avoid fasting: small frequent meals, breakfast, and a late-evening snack with complex carbohydrate.",
      x.ascites >= 2 ? "Sodium 2 g/day for ascites, loosened if it stops the patient eating. No fluid restriction unless sodium is 125 or lower." : "",
      refeed.length ? "<b>Refeeding risk:</b> " + esc(refeed.join(", ")) + ". Replace before and during feeding; check potassium, magnesium and phosphate daily for the first days." : "",
      alcohol && !thiamine ? "<b>Alcohol-related disease and no thiamine found:</b> give thiamine before glucose or feeding." : "",
      "Refer to the dietitian. If oral intake cannot meet the targets, start enteral feeding (varices are not a reason to avoid a nasogastric tube); avoid PEG with ascites.",
      "Replace micronutrients as needed (zinc, vitamin D, other vitamins) and keep the patient moving to limit muscle loss."]);
}

/* ---------- VTE ---------- */
function drawVte(f, v, x, c) {
  const bmiAct = c.wt && c.ht ? c.wt.v / Math.pow(c.ht.v / 100, 2) : null;
  const inf = (f.prob.infection || []).length > 0 || c.taps.some((t2) => c.now - t2.t <= 7 * DAY && t2._it && t2._it.sbp);
  const auto = { age: f.age != null && f.age >= 70, obese: bmiAct != null && bmiAct >= 30, cancer: !!f.prob.cancer, prevvte: !!f.prob.prevvte, hfrf: !!f.prob.hfrf, infection: inf };
  if (!state.padua) state.padua = Object.assign({}, auto);
  $("padua").innerHTML = "<b>Padua score:</b> " + R.PADUA.map(([id, lab2, p]) => `<label class="inl"><input type="checkbox" data-pad="${id}"${state.padua[id] ? " checked" : ""}> ${esc(lab2)} (${p})${auto[id] ? ' <span class="muted">from chart</span>' : ""}</label>`).join(" ");
  document.querySelectorAll("[data-pad]").forEach((cb) => (cb.onchange = () => { state.padua[cb.dataset.pad] = cb.checked; draw(); }));
  const score = R.padua(state.padua);
  const anticoag = f.medList.filter((m) => m.active || (m.t && c.now - m.t <= 2 * DAY));
  const doac = anticoag.find((m) => m.cats.includes("doac") || m.cats.includes("warfarin"));
  const hep = anticoag.filter((m) => m.cats.includes("lmwh") || m.cats.includes("heparin"));
  const ther = doac ? doac.name : (hep.find((m) => C.heparinKind(m.name) === "therapeutic") || {}).name;
  const proph = (hep.find((m) => C.heparinKind(m.name) !== "therapeutic") || {}).name;
  const hg = f.extra.hgb.filter((e) => c.now - e.t <= 2 * DAY), drop = hg.length >= 2 ? Math.max(...hg.map((e) => e.v)) - hg[hg.length - 1].v : null;
  const crcl = v.creat && c.wt && f.age != null ? R.crcl(v.creat.v, f.age, c.wt.v, x.sex || f.sex) : null;
  const bleedProb = (f.prob.bleed || []).length;
  const res = R.vte({ therapeutic: ther, prophylaxis: proph, bleeding: $("bleeding").checked, hgbDrop: drop, plt: c.ex.plt && c.ex.plt.v, crcl, padua: score });
  $("vtesum").textContent = { na: "on anticoagulation", on: "prophylaxis ordered", review: "review prophylaxis", mechanical: "mechanical only for now", start: "start prophylaxis", low: "low risk" }[res.state];
  const facts = [c.ex.plt ? "Platelets " + r1(c.ex.plt.v) + " (" + fmtD(c.ex.plt.t) + ")" : "No platelet count in 72 h", drop != null ? "Hemoglobin change in 48 h: " + (drop > 0 ? "-" : "+") + r1(Math.abs(drop)) + " g/L" : "",
    v.inr ? "INR " + r1(v.inr.v) + " (does not protect against clots)" : "", crcl != null ? "CrCl " + Math.round(crcl) + " mL/min (overestimates in cirrhosis)" : ""].filter(Boolean);
  $("vte").innerHTML = `<div class="result alert ${res.state === "start" ? "action" : res.state === "mechanical" || res.state === "review" ? "urgent" : "info"}">${esc(res.head)}</div>` +
    (res.why && res.why.length && res.state === "mechanical" ? "<div>Reason: " + esc(res.why.join("; ")) + "</div>" : "") + (res.start ? "<div>" + esc(res.start) + "</div>" : "") +
    `<div class="muted" style="margin-top:6px">${esc(facts.join(" · "))}</div>` +
    (bleedProb && !$("bleeding").checked ? `<div class="muted">Problem list mentions bleeding (${esc(f.prob.bleed.slice(0, 2).join("; "))}): tick the box above if it is active.</div>` : "") +
    ul(["Paracentesis is not a reason to hold prophylaxis.", "Anti-Xa levels are unreliable in cirrhosis; do not correct the INR to give prophylaxis."]);
}
