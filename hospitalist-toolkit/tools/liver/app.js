/* Liver scores page. Read-only from the chart; the grades you choose stay in this page. UNVERIFIED draft. */
const S = window.LiverScores, R = window.LiverRules, C = window.LiverChart, DAY = C.DAY, MAX_AGE = 14 * DAY;
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const fmtD = (t) => new Date(t).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
const fmtDT = (t) => new Date(t).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
const ago = (t) => { const d = (Date.now() - t) / DAY; return d < 1 ? Math.max(1, Math.round(d * 24)) + " h ago" : Math.round(d) + " d ago"; };
const r1 = (v) => (Math.abs(v) >= 100 ? Math.round(v) : Math.round(v * 10) / 10);
const state = { f: null, manualTaps: [], hrsManual: {}, padua: null };

function inputs(f, t) {
  const v = C.at(f, t, MAX_AGE);
  return { v, x: { bili: v.bili && v.bili.v, creat: v.creat && v.creat.v, inr: v.inr && v.inr.v, na: v.na && v.na.v, alb: v.alb && v.alb.v,
    sex: $("sex").value, dialysis: $("dialysis").checked, cholestatic: $("cholestatic").checked,
    ascites: +$("ascites").value || null, he: +$("he").value || null } };
}
function results(x) { return { m: S.meld(x), m3: S.meld3(x), cp: S.childPugh(x) }; }

function tile(cls, k, big, s) { return `<div class="tile ${cls}"><div class="k">${esc(k)}</div><div class="big">${big}</div><div class="s">${s || ""}</div></div>`; }
const meldCls = (m) => (m == null ? "" : m < 15 ? "t0" : m < 20 ? "t1" : m < 30 ? "t2" : "t3");

function draw() {
  const f = state.f;
  if (!f) { $("tiles").innerHTML = ""; $("alerts").innerHTML = '<div class="muted">No patient loaded.</div>'; ["inputs", "cp", "trend", "spark", "hints", "kidney", "bp", "hrs", "plan", "taps", "fluidplan", "nut", "padua", "vte", "lvpout"].forEach((id) => ($(id).innerHTML = "")); ["kidsum", "hrssum", "fluidsum", "nutsum", "vtesum"].forEach((id) => ($(id).textContent = "")); $("alertsum").textContent = ""; LIVER_NOTE.update(); return; }
  const now = Date.now(), { v, x } = inputs(f, now), { m, m3, cp } = results(x);

  // tiles
  const t = [];
  t.push(m && m.meldNa != null ? tile(meldCls(m.meldNa), "MELD-Na", m.meldNa, esc(S.meldBand(m.meldNa))) : tile("", "MELD-Na", "–", "Needs bilirubin, creatinine, INR and sodium"));
  t.push(m3 ? tile(meldCls(m3.meld3), "MELD 3.0", m3.meld3, m3.sexKnown ? "Adds albumin and sex" : "Sex unknown: calculated as male") : tile("", "MELD 3.0", "–", "Also needs albumin"));
  t.push(m ? tile("", "MELD (original)", m.meld, "No sodium term") : tile("", "MELD (original)", "–", "Needs bilirubin, creatinine and INR"));
  if (!cp) t.push(tile("", "Child-Pugh", "–", "Needs bilirubin, albumin and INR"));
  else if (cp.complete) t.push(tile({ A: "t0", B: "t2", C: "t3" }[cp.cls], "Child-Pugh", cp.score + " · " + cp.cls, esc(S.CP_TEXT[cp.cls])));
  else t.push(tile("t1", "Child-Pugh", cp.lo + "–" + cp.hi, `Class ${cp.cls}${cp.clsHi !== cp.cls ? " to " + cp.clsHi : ""}: choose ascites and encephalopathy above`));
  $("tiles").innerHTML = t.join("");

  // values used
  const rows = C.LABS.map((d) => {
    const e = v[d.id], last = f.labs[d.id][f.labs[d.id].length - 1];
    if (!e) return `<tr><td>${esc(d.label)}</td><td colspan="3" class="old">${last ? "Last result " + esc(last.shown) + " on " + fmtD(last.t) + " is older than 14 days: not used" : "Not found in the chart"}</td></tr>`;
    const old = now - e.t > 3 * DAY;
    return `<tr><td>${esc(d.label)}</td><td class="num">${r1(e.v)} ${esc(d.unit)}</td><td class="muted">${esc(e.shown !== r1(e.v) + (d.unit ? " " + d.unit : "") ? "as reported: " + e.shown : "")}</td><td class="${old ? "old" : ""}">${fmtDT(e.t)} (${ago(e.t)})</td></tr>`;
  });
  $("inputs").innerHTML = `<table><tr><th>Lab</th><th>Value (SI)</th><th></th><th>Drawn</th></tr>${rows.join("")}</table>` +
    (m ? `<div class="muted" style="margin-top:6px">After the MELD bounds: bilirubin ${r1(m.used.bili)} mg/dL, creatinine ${r1(m.used.creat)} mg/dL${x.dialysis ? " (dialysis: set to 4.0)" : ""}, INR ${r1(m.used.inr)}${m.used.na ? ", sodium " + m.used.na : ""}.</div>` : "");

  // Child-Pugh table
  if (cp) {
    const P = cp.pts, g = (n) => (n == null ? "?" : n);
    const asc = ["", "None", "Mild / controlled", "Moderate-severe / refractory"], he = ["", "None", "Grade 1-2 / controlled", "Grade 3-4 / refractory"];
    $("cp").innerHTML = `<table class="cp"><tr><th>Item</th><th>Value</th><th>Points</th></tr>
      <tr><td>Bilirubin${x.cholestatic ? " (cholestatic cut-offs)" : ""}</td><td>${r1(x.bili)} umol/L</td><td class="num">${P.bili}</td></tr>
      <tr><td>Albumin</td><td>${r1(x.alb)} g/L</td><td class="num">${P.alb}</td></tr>
      <tr><td>INR</td><td>${r1(x.inr)}</td><td class="num">${P.inr}</td></tr>
      <tr><td>Ascites</td><td>${P.ascites ? asc[P.ascites] : '<span class="old">not chosen</span>'}</td><td class="num">${g(P.ascites)}</td></tr>
      <tr><td>Encephalopathy</td><td>${P.he ? he[P.he] : '<span class="old">not chosen</span>'}</td><td class="num">${g(P.he)}</td></tr>
      <tr><th>Total</th><th>${cp.complete ? "Class " + cp.cls : "Class " + cp.cls + (cp.clsHi !== cp.cls ? " to " + cp.clsHi : "")}</th><th class="num">${cp.complete ? cp.score : cp.lo + "–" + cp.hi}</th></tr></table>
      <div class="muted" style="margin-top:6px">Bilirubin &lt;${x.cholestatic ? "68" : "34"} = 1, ${x.cholestatic ? "68-170" : "34-50"} = 2, &gt;${x.cholestatic ? "170" : "50"} = 3 · Albumin &gt;35 = 1, 28-35 = 2, &lt;28 = 3 · INR &lt;1.7 = 1, 1.7-2.3 = 2, &gt;2.3 = 3. Class A 5-6, B 7-9, C 10-15.</div>`;
    $("cpsum").textContent = cp.complete ? cp.score + " points, class " + cp.cls : "incomplete";
  } else { $("cp").innerHTML = '<div class="muted">Needs bilirubin, albumin and INR within 14 days.</div>'; $("cpsum").textContent = ""; }

  // hints from the chart (suggestions only: nothing is set for you)
  const h = [];
  if (f.problems.length) h.push("Problem list: " + [...new Set(f.problems)].slice(0, 4).join("; "));
  const diur = ["spironolactone", "furosemide"].filter((k) => f.meds[k]);
  if (diur.length) h.push("Diuretics on record (" + diur.join(", ") + "): ascites is likely at least \"mild / controlled\"");
  const heRx = ["lactulose", "rifaximin"].filter((k) => f.meds[k]);
  if (heRx.length) h.push("Encephalopathy treatment on record (" + heRx.join(", ") + "): grade is likely at least \"controlled on treatment\"");
  if (f.dialysis.length) h.push("Dialysis in the past week: " + f.dialysis.length + " session(s) found");
  $("hints").innerHTML = h.length ? "<b>From the chart (check, then choose above):</b><br>" + h.map(esc).join("<br>") : "";

  drawAlerts(f, v, x, m, m3, cp, now);
  drawTrend(f);
  drawClinical(f, v, x, cp, now);
  LIVER_NOTE.update();
}

function drawAlerts(f, v, x, m, m3, cp, now) {
  const a = [];
  const missing = C.LABS.filter((d) => !v[d.id]).map((d) => d.label);
  if (missing.length) a.push(["action", "No recent " + missing.join(", ") + " (14 days): scores that need " + (missing.length > 1 ? "them" : "it") + " are not shown.", "Order if a current score is needed."]);
  const old = C.LABS.filter((d) => v[d.id] && now - v[d.id].t > 3 * DAY).map((d) => d.label);
  if (old.length) a.push(["info", old.join(", ") + " older than 3 days: the score may not reflect today.", ""]);
  if (f.meds.warfarin) a.push(["action", "Warfarin on record: INR is raised by the drug, so MELD and Child-Pugh overstate liver dysfunction.", "Interpret the INR terms with care."]);
  if (f.dialysis.length >= 2 && !x.dialysis) a.push(["action", f.dialysis.length + " dialysis sessions found in the past week but the dialysis box is not ticked.", "MELD sets creatinine to 4.0 mg/dL (MELD 3.0: 3.0) when dialysed twice or more in a week."]);
  const best = m && m.meldNa != null ? m.meldNa : m3 ? m3.meld3 : null;
  if (best != null && best >= 15) a.push([best >= 30 ? "urgent" : "action", `MELD-Na ${m && m.meldNa != null ? m.meldNa : "–"}${m3 ? ", MELD 3.0 " + m3.meld3 : ""}: at or above 15.`, "Commonly used threshold to discuss transplant referral (BC Transplant liver program), if a candidate. Check current criteria."]);
  if (cp && cp.complete && cp.cls === "C") a.push(["action", "Child-Pugh class C.", "Review goals of care and transplant candidacy."]);
  // rise over the past week
  if (m && m.meldNa != null) {
    // earliest score in the past 7 days (at least 1 day before now), compared with now
    const times = [].concat(...C.LABS.map((d) => f.labs[d.id].map((e) => e.t))).filter((t) => t >= now - 7 * DAY && t <= now - DAY).sort((p, q) => p - q);
    for (const t of times) {
      const pr = C.at(f, t, MAX_AGE), pm = S.meld(Object.assign({}, x, { bili: pr.bili && pr.bili.v, creat: pr.creat && pr.creat.v, inr: pr.inr && pr.inr.v, na: pr.na && pr.na.v }));
      if (!pm || pm.meldNa == null) continue;
      if (m.meldNa - pm.meldNa >= 3) a.push(["action", `MELD-Na up ${m.meldNa - pm.meldNa} points since ${fmtD(t)} (${pm.meldNa} → ${m.meldNa}).`, "Look for a cause: infection / SBP, GI bleed, AKI or HRS, alcohol hepatitis, drugs."]);
      break;
    }
  }
  if (v.creat && v.na && v.na.v < 130) a.push(["info", "Sodium " + r1(v.na.v) + " mmol/L.", "Hyponatremia in cirrhosis carries its own risk: correct slowly."]);
  $("alertsum").textContent = a.length ? a.length + " item" + (a.length > 1 ? "s" : "") : "none";
  $("alerts").innerHTML = a.length ? a.map(([lvl, txt, src]) => `<div class="alert ${lvl}"><b>${lvl === "urgent" ? "Urgent" : lvl === "action" ? "Action" : "Note"}</b>${esc(txt)}${src ? '<div class="muted">' + esc(src) + "</div>" : ""}</div>`).join("") : '<div class="muted">Nothing flagged.</div>';
}

function drawTrend(f) {
  const dayEnds = new Map();
  C.LABS.forEach((d) => f.labs[d.id].forEach((e) => { const k = new Date(e.t).toDateString(); if (!dayEnds.has(k) || e.t > dayEnds.get(k)) dayEnds.set(k, e.t); }));
  const pts = [...dayEnds.values()].sort((a, b) => b - a).slice(0, 20).map((t) => { const { v, x } = inputs(f, t); return Object.assign({ t, v }, results(x)); });
  if (!pts.length) { $("trend").innerHTML = '<div class="muted">No liver labs found in the past year.</div>'; $("spark").innerHTML = ""; return; }
  const c = (e) => (e ? r1(e.v) : '<span class="muted">–</span>');
  $("trend").innerHTML = `<table><tr><th>Date</th><th>Bili</th><th>Creat</th><th>INR</th><th>Na</th><th>Alb</th><th>MELD-Na</th><th>MELD 3.0</th><th>Child-Pugh (labs only)</th></tr>` +
    pts.map((p) => `<tr><td>${fmtD(p.t)}</td><td class="num">${c(p.v.bili)}</td><td class="num">${c(p.v.creat)}</td><td class="num">${c(p.v.inr)}</td><td class="num">${c(p.v.na)}</td><td class="num">${c(p.v.alb)}</td>
      <td class="num"><b>${p.m && p.m.meldNa != null ? p.m.meldNa : "–"}</b></td><td class="num">${p.m3 ? p.m3.meld3 : "–"}</td><td>${p.cp ? (p.cp.complete ? p.cp.score + " " + p.cp.cls : p.cp.lo + "–" + p.cp.hi) : "–"}</td></tr>`).join("") + "</table>";
  // small MELD-Na line, oldest to newest
  const s = pts.filter((p) => p.m && p.m.meldNa != null).reverse();
  if (s.length < 2) { $("spark").innerHTML = ""; return; }
  const W = 600, H = 110, t0 = s[0].t, t1 = s[s.length - 1].t, lo = 6, hi = Math.max(25, ...s.map((p) => p.m.meldNa));
  const X = (t) => 30 + ((t - t0) / Math.max(1, t1 - t0)) * (W - 40), Y = (v) => H - 18 - ((v - lo) / (hi - lo)) * (H - 30);
  const path = s.map((p, i) => (i ? "L" : "M") + X(p.t).toFixed(1) + " " + Y(p.m.meldNa).toFixed(1)).join(" ");
  $("spark").innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="100%" style="max-width:${W}px" role="img" aria-label="MELD-Na trend">
    <line x1="30" x2="${W - 10}" y1="${Y(15)}" y2="${Y(15)}" stroke="currentColor" stroke-opacity=".25" stroke-dasharray="4 4"/><text x="0" y="${Y(15) + 4}">15</text>
    <path d="${path}" fill="none" stroke="var(--accent)" stroke-width="2"/>
    ${s.map((p) => `<circle cx="${X(p.t)}" cy="${Y(p.m.meldNa)}" r="3" fill="var(--accent)"><title>${fmtD(p.t)}: MELD-Na ${p.m.meldNa}</title></circle>`).join("")}
    <text x="30" y="${H - 2}">${fmtD(t0)}</text><text x="${W - 10}" y="${H - 2}" text-anchor="end">${fmtD(t1)}</text></svg>`;
}


/* add a paracentesis result by hand */
$("f-add").onclick = () => {
  const num = (id) => { const n = parseFloat($(id).value); return isFinite(n) ? n : null; };
  const t = $("f-t").value ? new Date($("f-t").value).getTime() : Date.now();
  const tap = { t, src: "manual", site: "ascitic", wbc: num("f-wbc"), pmnPct: num("f-pct"), pmn: num("f-pmn"), rbc: num("f-rbc"), alb: num("f-alb"), prot: num("f-prot"), glu: num("f-glu"), ldh: num("f-ldh"), culture: $("f-cult").value.trim() };
  if (tap.wbc == null && tap.pmn == null && tap.alb == null && tap.prot == null && !tap.culture) return;
  state.manualTaps.push(tap);
  ["f-t", "f-wbc", "f-pct", "f-pmn", "f-rbc", "f-alb", "f-prot", "f-glu", "f-ldh", "f-cult"].forEach((id) => ($(id).value = ""));
  draw();
};

function load(raw, note, errors, preset) {
  state.f = raw ? C.parse(raw) : null;
  preset = preset || {};
  state.manualTaps = []; state.hrsManual = {}; state.padua = null; $("basecr").value = ""; $("lvp").value = ""; $("bleeding").checked = false; $("edema").checked = !!preset.edema; $("drylevel").value = "auto";
  $("ascites").value = preset.ascites || ""; $("he").value = preset.he || ""; $("cholestatic").checked = !!preset.cholestatic;
  $("sex").value = state.f && ["female", "male"].includes(state.f.sex) ? state.f.sex : "";
  $("dialysis").checked = !!(state.f && state.f.dialysis.length >= 2);
  $("cholestatic").checked = $("cholestatic").checked || !!(state.f && state.f.problems.some((p) => /biliary cholangitis|biliary cirrhosis|sclerosing cholangitis|K74\.3|K74\.4|K74\.5|K83\.01/i.test(p)));
  $("pstatus").textContent = note; $("clear").hidden = !raw;
  $("ptsum").textContent = state.f ? [state.f.sex, state.f.age != null ? state.f.age + " y" : ""].filter(Boolean).join(", ") : "";
  $("errs").innerHTML = errors && errors.length ? "Could not read: " + errors.map(esc).join("; ") + ". Check the scopes in the Code Console." : "";
  draw(); LIVER_NOTE.reset();
}
["ascites", "he", "sex", "dialysis", "cholestatic", "basecr", "lvp", "bleeding", "edema", "drylevel"].forEach((id) => ($(id).onchange = draw)); $("lvp").oninput = draw;
$("clear").onclick = () => { $("testsel").value = ""; load(null, "Open from Cerner to read the chart, or pick a made-up patient:"); };
const SAMPLES = window.LIVER_SAMPLES || [];
SAMPLES.forEach((p, i) => { const o = document.createElement("option"); o.value = i; o.textContent = p.label; $("testsel").appendChild(o); });
$("testsel").onchange = () => { const p = SAMPLES[$("testsel").value]; if (!p) return $("clear").onclick(); load(p.build(Date.now()), "Made-up patient: " + p.label, [], p); };

async function fromChart() {
  if (typeof FHIR === "undefined" || !(location.search.includes("code=") || location.search.includes("complete=") || sessionStorage.getItem("SMART_KEY"))) return;
  $("pstatus").textContent = "Reading the chart…";
  try {
    const client = await FHIR.oauth2.ready();
    const { raw, errors } = await C.gather(client, (msg) => ($("pstatus").textContent = msg));
    load(raw, "Chart read (read-only). Nothing is sent anywhere. Choose the ascites and encephalopathy grades above.", errors);
  } catch (e) { $("pstatus").textContent = "Could not read the chart: " + (e && e.message ? e.message : e) + ". The made-up patients still work."; }
}
draw(); fromChart();
