/* AKI page. Read-only from the chart; ticks and typed values stay in this page. UNVERIFIED draft written by Claude. */
const R = window.AkiRules, C = window.AkiChart, REF = window.AkiRef, DAY = C.DAY, HR = 36e5;
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const fmtDT = (t) => new Date(t).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
const fmtD = (t) => new Date(t).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
const r1 = (v) => Math.round(v * 10) / 10, r2 = (v) => Math.round(v * 100) / 100;
const ul = (a) => "<ul>" + a.filter(Boolean).map((t) => "<li>" + t + "</li>").join("") + "</ul>";
const state = { f: null, auto: {} };

/* ---------- bedside ticks (some set from the chart) ---------- */
const TICKS = [
  ["hydro", "Hydronephrosis on ultrasound"], ["muddy", "Muddy brown granular casts"], ["rbccast", "Red cell casts or dysmorphic red cells"], ["wbccast", "White cell casts"],
  ["rash", "Rash, fever or joint pain"], ["hypot", "Hypotension or shock in the past 72 h"], ["sepsis", "Sepsis"], ["contrast", "IV contrast in the past 72 h"],
  ["retention", "Retention risk (prostate, anticholinergic, opioid, catheter problem)"], ["overload", "Fluid overload not responding to diuretics"], ["ecg", "ECG changes from potassium"],
  ["uremic", "Uremic pericarditis, encephalopathy or bleeding"], ["toxin", "Dialysable poisoning suspected (methanol, ethylene glycol, salicylate, metformin)"], ["rrt", "On dialysis or CRRT now"],
  ["single", "Single functioning kidney"], ["transplant", "Kidney transplant"], ["pregnant", "Pregnant"]];
function drawTicks() {
  $("ticks").innerHTML = TICKS.map(([id, l]) => `<label><input type="checkbox" id="tk-${id}"${state.auto[id] ? " checked" : ""}> <span>${esc(l)}${state.auto[id] ? `<span class="auto" title="${esc(state.auto[id])}">chart</span>` : ""}</span></label>`).join("");
  TICKS.forEach(([id]) => ($("tk-" + id).onchange = draw));
}
const tick = (id) => { const el = $("tk-" + id); return !!(el && el.checked); };
function autoTicks(f) {
  const now = Date.now(), a = {}, within = (arr, h) => arr.filter((e) => now - e.t <= h * HR);
  const qpos = (id, d) => (f.q[id] || []).filter((e) => now - e.t <= d * DAY && e.pos === true);
  if (qpos("grancast", 7).length) a.muddy = "Granular casts on urine microscopy";
  if (qpos("rbccast", 7).length) a.rbccast = "Red cell casts on urine microscopy";
  if (qpos("wbccast", 7).length) a.wbccast = "White cell casts on urine microscopy";
  const lowBp = within(f.sbp, 72).filter((e) => e.v < 90).concat(within(f.map, 72).filter((e) => e.v < 65));
  if (lowBp.length) a.hypot = "Lowest SBP " + Math.min(...within(f.sbp, 72).map((e) => e.v)) + " in the past 72 h";
  if (f.prob.sepsis) a.sepsis = f.prob.sepsis[0];
  const ctr = C.recent(f, "contrast", 3, now); if (ctr.length) a.contrast = C.names(ctr).join(", ");
  const ret = C.recent(f, "anticholinergic", 3, now).concat(C.recent(f, "opioid", 3, now));
  if (f.prob.bph || ret.length) a.retention = [].concat(f.prob.bph || [], C.names(ret)).join(", ");
  if (f.prob.single) a.single = f.prob.single[0];
  if (f.prob.transplant) a.transplant = f.prob.transplant[0];
  if (f.prob.pregnant) a.pregnant = f.prob.pregnant[0];
  return a;
}

/* ---------- urine indices: typed values win, else chart ---------- */
const MF = ["scr", "sna", "surea", "una", "ucr", "uurea", "uosm"];
function chartUrine() {
  const f = state.f; if (!f) return {};
  const now = Date.now(), U = (id) => C.latest(f.u[id], 7 * DAY, now);
  const ref = U("una") || U("ucr") || U("uosm") || U("uurea");
  const near = (id) => { // serum value closest in time to the urine sample (within 48 h), else the latest
    const a = f.s[id] || []; if (!a.length) return null;
    if (!ref) return C.latest(a, 3 * DAY, now);
    const best = a.reduce((m, e) => (!m || Math.abs(e.t - ref.t) < Math.abs(m.t - ref.t) ? e : m), null);
    return Math.abs(best.t - ref.t) <= 2 * DAY ? best : null;
  };
  return { scr: near("creat"), sna: near("na"), surea: near("urea"), una: U("una"), ucr: U("ucr"), uurea: U("uurea"), uosm: U("uosm") };
}
function urineVals() {
  const c = chartUrine(), v = {}, src = {};
  MF.forEach((k) => { const t = parseFloat($("m-" + k).value); if (isFinite(t)) { v[k] = t; src[k] = "typed"; } else if (c[k]) { v[k] = r1(c[k].v); src[k] = "chart"; } else v[k] = null; });
  MF.forEach((k) => { const el = $("m-" + k); el.placeholder = c[k] ? String(r1(c[k].v)) : ""; el.title = c[k] ? "Chart: " + el.placeholder + " (" + fmtDT(c[k].t) + ")" : ""; el.classList.toggle("typed", src[k] === "typed"); });
  const nT = MF.filter((k) => src[k] === "typed").length, nC = MF.filter((k) => src[k] === "chart").length;
  $("m-src").textContent = [nT && nT + " typed", nC && nC + " from the chart (grey)"].filter(Boolean).join(", ");
  $("m-clear").hidden = !nT;
  return v;
}

/* ---------- everything worked out from the chart + page ---------- */
const AIN_CATS = ["ppi", "betalactam", "nsaid", "rifampin", "tmp", "allopurinol", "ici", "mesalamine"];
const TOX_CATS = ["nsaid", "amino", "vanc", "ampho", "platin", "contrast", "colistin", "foscarnet", "mtx", "acyclo", "zoledronic", "tenofovir", "cni", "lithium"];
function ctx() {
  const f = state.f, now = Date.now(), x = { now };
  const L = (id, d) => (f ? C.latest(f.s[id], d * DAY, now) : null), Q = (id, d) => (f ? (f.q[id] || []).filter((e) => now - e.t <= d * DAY) : []);
  x.wt = parseFloat($("wt").value) || null;
  x.cr = f ? R.creatStage(f.s.creat, { baseline: parseFloat($("base").value) || null, rrt: tick("rrt") }) : null;
  x.uo = f ? R.uoStage(f.uo, x.wt, now) : null;
  x.stage = Math.max(x.cr ? x.cr.stage : 0, x.uo ? x.uo.stage : 0, tick("rrt") ? 3 : 0);
  ["urea", "k", "hco3", "ph", "ck", "ca", "phos", "alb", "prot", "urate", "ldh", "hb", "plt", "eos", "lith", "c3", "c4", "vanc", "genta", "na"].forEach((id) => (x[id] = L(id, id === "c3" || id === "c4" ? 30 : id === "ck" || id === "eos" ? 7 : 3)));
  x.base = x.cr && x.cr.base;
  x.baseEgfr = x.base && f ? R.egfr(x.base.v, f.age, f.sex) : null;
  x.crcl = x.cr && f ? R.crcl(x.cr.cur.v, f.age, f.sex, x.wt) : null;
  // urine
  const U = urineVals(); x.U = U;
  x.fena = R.fe(U.una, U.sna, U.ucr, U.scr); x.feurea = R.fe(U.uurea, U.surea, U.ucr, U.scr); x.ratio = R.ureaCrRatio(x.urea && x.urea.v, x.cr && x.cr.cur.v);
  const last = (arr) => (arr.length ? arr[arr.length - 1] : null), num = (id) => (f ? C.latest(f.u[id], 7 * DAY, now) : null);
  const blood = last(Q("ublood", 7)), prot = last(Q("uprot", 7)), leuk = last(Q("uleuk", 7)), nit = last(Q("unit", 7)), cult = last(Q("uculture", 7));
  x.urbc = num("urbc"); x.uwbc = num("uwbc"); x.upcr = num("upcr"); x.uacr = num("uacr");
  x.hematuria = !!((blood && blood.pos && !/trace/i.test(blood.shown)) || (x.urbc && x.urbc.v > 5));
  x.proteinuria = !!((prot && prot.pos && !/trace/i.test(prot.shown)) || (x.upcr && x.upcr.v >= 0.05) || (x.uacr && x.uacr.v >= 30));
  x.pyuria = !!((x.uwbc && x.uwbc.v > 5) || (leuk && leuk.pos));
  x.infection = !!((nit && nit.pos) || (cult && cult.pos));
  x.sterilePyuria = x.pyuria && !x.infection;
  x.urinalysisDone = !!(blood || prot || leuk || x.urbc || x.uwbc);
  // serology
  const sero = [];
  [["mpo", "MPO-ANCA positive"], ["pr3", "PR3-ANCA positive"], ["anca", "ANCA positive"], ["gbm", "anti-GBM positive"]].forEach(([id, t]) => { const e = last(Q(id, 60)); if (e && e.pos) sero.push(t); });
  if (x.c3 && x.c3.v < 0.9) sero.push("low C3"); if (x.c4 && x.c4.v < 0.1) sero.push("low C4");
  x.serology = sero.join(", ");
  x.dsdna = last(Q("dsdna", 60)); x.ana = last(Q("ana", 60));
  x.tma = !!(x.plt && x.plt.v < 100 && x.ldh && x.ldh.v > 300 && x.hb && x.hb.v < 110);
  const flc = last(Q("flc", 90)), spep = last(Q("spep", 90));
  x.myeloma = !!(f && f.prob.myeloma) || !!(flc && flc.pos) || !!(spep && spep.pos) || !!(x.ca && x.ca.v > 2.6 && x.hb && x.hb.v < 100) || !!(x.prot && x.alb && x.prot.v - x.alb.v > 45);
  // drugs
  const rec = (cats, d) => (f ? cats.flatMap((c) => C.recent(f, c, d, now)) : []);
  x.ainDrugs = f ? C.names(rec(AIN_CATS, 30)) : []; x.toxDrugs = f ? C.names(rec(TOX_CATS, 7)) : [];
  x.diuretic = f ? rec(["loop", "thiazide"], 2).length > 0 : false;
  x.ckd = !!(f && f.prob.ckd) || (x.baseEgfr != null && x.baseEgfr < 60);
  x.pvr = f ? C.latest(f.pvr, 2 * DAY, now) : null;
  const exam = $("exam").value;
  x.pat = R.pattern({ fena: x.fena, feurea: x.feurea, una: U.una, uosm: U.uosm, ratio: x.ratio, diuretic: x.diuretic, ckd: x.ckd,
    volumeLow: exam === "dry" || exam === "loweff", muddyCasts: tick("muddy"), recentHypotension: tick("hypot"), sepsis: tick("sepsis"), contrast: tick("contrast"),
    ck: x.ck && x.ck.v, nephrotoxin: x.toxDrugs.slice(0, 3).join(", "), wbcCasts: tick("wbccast"), sterilePyuria: x.sterilePyuria, eos: !!(x.eos && x.eos.v > 0.5), rash: tick("rash"),
    ainDrug: x.ainDrugs.slice(0, 3).join(", "), rbcCasts: tick("rbccast"), hematuriaProteinuria: x.hematuria && x.proteinuria, serology: x.serology,
    hydro: tick("hydro"), pvr: x.pvr && x.pvr.v, retention: tick("retention"), anuria: !!(x.uo && x.uo.r12 === 0) });
  x.rrtList = R.rrt({ k: x.k && x.k.v, ph: x.ph && x.ph.v, hco3: x.hco3 && x.hco3.v, urea: x.urea && x.urea.v, overload: tick("overload") || exam === "overloaded" && tick("overload"),
    pericarditis: tick("uremic"), toxin: tick("toxin") ? "ticked" : "", lithium: x.lith && x.lith.v });
  if (tick("ecg") && !x.rrtList.some((r) => /Potassium/.test(r.text) && r.level === "urgent")) x.rrtList.unshift({ level: "urgent", text: "ECG changes from potassium: calcium gluconate now, insulin-dextrose, then remove potassium." });
  // no improvement 72 h after AKI was first met
  let noRec = false;
  if (x.cr && x.cr.base && x.stage >= 1) {
    const first = f.s.creat.find((e) => x.cr.cur.t - e.t <= 7 * DAY && (e.v >= 1.5 * x.cr.base.v || e.v - x.cr.base.v >= 26.5));
    noRec = !!(first && now - first.t >= 72 * HR && !x.cr.recovering && x.cr.trend !== "falling");
  }
  x.nephro = R.nephro({ stage: x.stage, rrtList: x.rrtList, rbcCasts: tick("rbccast"), serology: /ANCA|GBM/.test(x.serology) ? x.serology : "", hematuriaProteinuria: x.hematuria && x.proteinuria,
    tma: x.tma, myeloma: x.myeloma, transplant: tick("transplant"), baseEgfr: x.baseEgfr, noRecovery72: noRec, unclear: /unclear|\+/.test(x.pat.lean), ain: x.pat.order[0] === "ain" && x.pat.scores.ain >= 3,
    single: tick("single"), pregnancy: tick("pregnant") });
  return x;
}

const LEAN = { prerenal: "Pre-renal", atn: "Renal: acute tubular necrosis", ain: "Renal: acute interstitial nephritis", gn: "Renal: glomerulonephritis", postrenal: "Post-renal (obstruction)", unclear: "Not enough information yet" };
const leanText = (l) => l.split("+").map((k) => LEAN[k] || k).join(" or ");

/* ---------- drawing ---------- */
function draw() {
  if (!state.f) {
    $("tiles").innerHTML = ""; $("alerts").innerHTML = '<div class="muted">Open from Cerner or pick a made-up patient. The reference sections below work without a patient.</div>';
    ["trend", "spark", "uo", "meds", "tests"].forEach((id) => ($(id).innerHTML = "")); ["alertsum", "trendsum", "typesum", "medsum", "testsum", "ptsum"].forEach((id) => ($(id).textContent = ""));
    urineVals(); drawTypeManual(); drawRef(null); AKI_NOTE.update(); return;
  }
  const x = ctx();
  drawTiles(x); drawAlerts(x); drawTrend(x); drawType(x); drawMeds(x); drawTests(x); drawRef(x); AKI_NOTE.update();
}

function drawTiles(x) {
  const cr = x.cr, f = state.f, tiles = [];
  const st = x.stage;
  tiles.push(`<div class="tile t${st}"><div class="k">KDIGO stage</div><div class="big">${st ? "Stage " + st : cr ? "No AKI" : "–"}</div><div class="s">${esc([].concat(cr ? cr.reasons : [], x.uo ? x.uo.reasons.map((r) => "urine " + r) : []).join("; ") || (cr ? "Criteria not met" : "No creatinine found"))}</div></div>`);
  if (cr) tiles.push(`<div class="tile"><div class="k">Creatinine now</div><div class="big">${Math.round(cr.cur.v)}</div><div class="s">${fmtDT(cr.cur.t)} · ${cr.trend}${cr.recovering ? " (recovering: 20% or more below peak " + Math.round(cr.peak.v) + ")" : ""}${cr.ratio ? " · " + r1(cr.ratio) + " × baseline" : ""}</div></div>`);
  tiles.push(`<div class="tile ${cr && cr.base ? "" : "t2"}"><div class="k">Baseline</div><div class="big">${cr && cr.base ? Math.round(cr.base.v) : "?"}</div><div class="s">${cr && cr.base ? esc(cr.baseKind) + (cr.base.t ? " (" + fmtD(cr.base.t) + ")" : "") : "No earlier value: enter a baseline above (old records, family doctor)"}${x.baseEgfr ? " · eGFR about " + Math.round(x.baseEgfr) : ""}</div></div>`);
  const u = x.uo;
  tiles.push(`<div class="tile ${u && u.stage ? "t" + u.stage : ""}"><div class="k">Urine output</div><div class="big">${u ? (u.r6 != null ? r2(u.r6) : u.r12 != null ? r2(u.r12) : r2(u.r24)) : "–"}</div><div class="s">${u ? "mL/kg/h (6 h" + (u.r24 != null ? "; 24 h " + r2(u.r24) : "") + ")" : x.wt ? "Not charted, or charting incomplete" : "Enter a weight to calculate"}</div></div>`);
  tiles.push(`<div class="tile t1"><div class="k">Most likely type</div><div class="big" style="font-size:18px">${esc(leanText(x.pat.lean))}</div><div class="s">See "Pre-renal, renal or post-renal?" below</div></div>`);
  $("tiles").innerHTML = tiles.join("");
  $("ptsum").textContent = [f.sex, f.age != null ? f.age + " y" : "", x.wt ? x.wt + " kg" : ""].filter(Boolean).join(", ");
}

function drawAlerts(x) {
  const a = [];
  x.rrtList.forEach((r) => a.push([r.level, "Dialysis indication? " + r.text]));
  const LV = { urgent: "urgent", today: "action", discuss: "info" }, LB = { urgent: "Call nephrology now", today: "Nephrology today", discuss: "Discuss with nephrology" };
  x.nephro.forEach((n) => a.push([LV[n.level], n.text, LB[n.level]]));
  if (x.k && x.k.v >= 5.5 && !x.rrtList.length) a.push(["action", `Potassium ${x.k.v}: low-potassium diet, stop potassium-raising drugs, recheck.`]);
  if (x.cr && x.cr.stage && !x.urinalysisDone) a.push(["action", "No urinalysis found: send urinalysis with microscopy (blood, protein, white cells, casts)."]);
  if (x.cr && x.cr.stage && !x.pvr && !tick("hydro")) a.push(["info", "Bladder scan not found: exclude retention (and flush or change any catheter)."]);
  if (x.tma) a.push(["urgent", `Platelets ${x.plt.v}, LDH ${x.ldh.v}, Hb ${x.hb.v}: possible thrombotic microangiopathy. Smear for schistocytes.`]);
  if (x.ck && x.ck.v > 5000) a.push(["action", `CK ${Math.round(x.ck.v)}: rhabdomyolysis. Aggressive isotonic fluid (if not overloaded), check calcium, phosphate, potassium.`]);
  if (x.crcl != null && x.stage) a.push(["info", `Cockcroft-Gault ${Math.round(x.crcl)} mL/min overestimates function while creatinine is rising: dose drugs as if GFR is lower (pharmacy review).`]);
  if (!x.stage && x.cr) a.push(["info", "KDIGO criteria not met on the values found. If you know an older baseline, enter it above."]);
  const ORD = { urgent: 0, action: 1, info: 2 }; a.sort((p, q) => ORD[p[0]] - ORD[q[0]]);
  $("alertsum").textContent = a.filter((i) => i[0] === "urgent").length ? a.filter((i) => i[0] === "urgent").length + " urgent" : a.length ? a.length + " items" : "none";
  $("alerts").innerHTML = a.length ? a.map(([l, t, b]) => `<div class="alert ${l}"><b>${esc(b || (l === "urgent" ? "Urgent" : l === "action" ? "Action" : "Note"))}</b>${esc(t)}</div>`).join("") : '<div class="muted">Nothing flagged.</div>';
}

function drawTrend(x) {
  const f = state.f, now = Date.now(), pts = f.s.creat.filter((e) => now - e.t <= 14 * DAY), base = x.cr && x.cr.base;
  $("trendsum").textContent = pts.length + " value" + (pts.length === 1 ? "" : "s") + " in 14 days";
  $("trend").innerHTML = pts.length ? `<table><tr><th>Time</th><th>Creatinine</th><th>× baseline</th><th>Change from previous</th></tr>` + [...pts].reverse().slice(0, 20).map((e, i, a) => {
    const prev = a[i + 1], d = prev ? e.v - prev.v : null, rt = base ? e.v / base.v : null;
    return `<tr><td>${fmtDT(e.t)}</td><td class="num"><b>${Math.round(e.v)}</b></td><td class="num ${rt >= 2 ? "hi" : ""}">${rt ? r1(rt) : "–"}</td><td class="num">${d == null ? "" : (d > 0 ? "+" : "") + Math.round(d)}</td></tr>`;
  }).join("") + "</table>" : '<div class="muted">No creatinine in the past 14 days.</div>';
  const u = x.uo;
  $("uo").innerHTML = u ? `<div class="muted" style="margin-top:6px">Urine output (mL/kg/h, from charted volumes, weight ${x.wt} kg): 6 h ${u.r6 != null ? r2(u.r6) : "–"} · 12 h ${u.r12 != null ? r2(u.r12) : "–"} · 24 h ${u.r24 != null ? r2(u.r24) : "–"}. Missed charting makes these look low.</div>` : "";
  if (pts.length < 2) { $("spark").innerHTML = ""; return; }
  const W = 640, H = 170, t0 = pts[0].t, t1 = Math.max(now, pts[pts.length - 1].t);
  const lines = base ? [[1, "baseline"], [1.5, "1.5×"], [2, "2×"], [3, "3×"]].map(([m, l]) => [base.v * m, l]) : [];
  const vals = pts.map((p) => p.v).concat(lines.map((l) => l[0]).filter((v) => v <= Math.max(...pts.map((p) => p.v)) * 1.25));
  const lo = Math.max(0, Math.min(...vals) * 0.85), hi = Math.max(...vals) * 1.08;
  const X = (t) => 40 + ((t - t0) / Math.max(1, t1 - t0)) * (W - 54), Y = (v) => H - 20 - ((v - lo) / (hi - lo)) * (H - 34);
  const path = pts.map((p, i) => (i ? "L" : "M") + X(p.t).toFixed(1) + " " + Y(p.v).toFixed(1)).join(" ");
  $("spark").innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="100%" style="max-width:${W}px" role="img" aria-label="Creatinine trend">
    ${lines.filter(([v]) => v >= lo && v <= hi).map(([v, l], i) => `<line x1="40" x2="${W - 14}" y1="${Y(v)}" y2="${Y(v)}" stroke="${i ? "var(--r-ink)" : "var(--g-ink)"}" stroke-opacity="${i ? 0.5 : 0.8}" stroke-dasharray="5 4"/><text x="${W - 14}" y="${Y(v) - 3}" text-anchor="end">${l} ${Math.round(v)}</text>`).join("")}
    <path d="${path}" fill="none" stroke="var(--accent)" stroke-width="2"/>
    ${pts.map((p) => `<circle cx="${X(p.t)}" cy="${Y(p.v)}" r="3.5" fill="var(--accent)"><title>${fmtDT(p.t)}: ${Math.round(p.v)} umol/L</title></circle>`).join("")}
    <text x="40" y="${H - 4}">${fmtDT(t0)}</text><text x="${W - 14}" y="${H - 4}" text-anchor="end">now</text><text x="0" y="${Y(hi) + 10}">${Math.round(hi)}</text><text x="0" y="${Y(lo)}">${Math.round(lo)}</text></svg>`;
}

const NEXT = {
  prerenal: ["If dry: balanced crystalloid 250-500 mL, reassess after each bolus; if low effective volume (HF, cirrhosis), treat the cause instead", "Hold NSAIDs, ACEi/ARB/ARNI, diuretics, SGLT2i, metformin", "Expect creatinine to fall within 24-72 h; if not, think ATN or another cause"],
  atn: ["Supportive: restore perfusion (MAP 65 or more), stop nephrotoxins, avoid contrast", "Fluids only if dry; avoid overload once euvolemic", "Daily potassium, bicarbonate, phosphate, weight; dialysis for the usual indications", "Expect 1-3 weeks to recover; urine output often recovers first"],
  ain: ["Stop the suspected drug (and record it as an intolerance)", "Urine culture to exclude infection; CBC for eosinophils", "Discuss with nephrology: steroids if not improving within about 3-7 days, biopsy if unclear"],
  gn: ["Urgent ANCA (MPO, PR3), anti-GBM, C3/C4, ANA, anti-dsDNA, hepatitis B/C, HIV, cryoglobulins, ASO, blood cultures, protein:creatinine ratio", "Same-day nephrology (biopsy, pulse steroids, plasma exchange)", "Chest imaging if any hemoptysis or low oxygen"],
  postrenal: ["Bladder scan; urinary catheter if retention; flush or change an existing catheter", "Renal ultrasound for hydronephrosis; urology or IR for stent or nephrostomy if upper tract", "After relief: hourly urine output, watch for post-obstructive diuresis, electrolytes every 6-12 h", "Stop anticholinergics, reduce opioids; tamsulosin before a trial without catheter"],
  unclear: ["Send urinalysis with microscopy, urine sodium, creatinine, urea and osmolality, protein:creatinine ratio", "Bladder scan and renal ultrasound", "Assess volume status at the bedside", "Review every drug and any contrast in the past week"] };

function drawTypeManual() {
  $("type").innerHTML = '<div class="muted">Pick a patient, or type values above to calculate FENa and FEUrea.</div>';
  const v = urineVals(), fena = R.fe(v.una, v.sna, v.ucr, v.scr), feu = R.fe(v.uurea, v.surea, v.ucr, v.scr);
  if (fena != null || feu != null) $("type").innerHTML = `<div class="verdict t1">${fena != null ? `<div class="big">FENa ${r2(fena)}%</div>` : ""}${feu != null ? `<div class="big">FEUrea ${r1(feu)}%</div>` : ""}<div>Under 1% (FENa) or under 35% (FEUrea) suggests pre-renal; over 2% or over 50% suggests ATN.</div></div>`;
}
function drawType(x) {
  const p = x.pat, U = x.U, lines = [];
  if (x.fena != null) lines.push(["FENa", r2(x.fena) + "%", x.fena < 1 ? "Under 1%: pre-renal (also contrast, rhabdo, early obstruction, GN, HRS)" : x.fena > 2 ? "Over 2%: tubular injury (ATN) or diuretic/CKD" : "1-2%: indeterminate"]);
  else lines.push(["FENa", "–", "Needs urine Na and creatinine with serum Na and creatinine"]);
  if (x.feurea != null) lines.push(["FEUrea", r1(x.feurea) + "%", x.feurea < 35 ? "Under 35%: pre-renal (works on diuretics)" : x.feurea > 50 ? "Over 50%: ATN" : "35-50%: indeterminate"]);
  else lines.push(["FEUrea", "–", "Needs urine urea and creatinine (best test if on a diuretic)"]);
  if (U.una != null) lines.push(["Urine sodium", U.una, U.una < 20 ? "Under 20: kidney holding salt (pre-renal, HRS)" : U.una > 40 ? "Over 40: tubules not holding salt (ATN, diuretic, CKD)" : "20-40: indeterminate"]);
  if (U.uosm != null) lines.push(["Urine osmolality", U.uosm, U.uosm > 500 ? "Over 500: concentrating well (pre-renal)" : U.uosm < 350 ? "Under 350: not concentrating (ATN)" : "350-500: indeterminate"]);
  if (x.ratio != null) lines.push(["Urea:creatinine", Math.round(x.ratio), x.ratio > 100 ? "High: pre-renal, GI bleed, steroids, high protein intake" : x.ratio < 40 ? "Low: intrinsic or low protein intake, liver disease" : "Usual range"]);
  if (x.diuretic) lines.push(["Diuretic", "yes (past 48 h)", "FENa and urine Na are unreliable: use FEUrea"]);
  const sed = [x.hematuria && "blood", x.proteinuria && "protein", x.pyuria && "white cells" + (x.sterilePyuria ? " (no infection found)" : ""), tick("muddy") && "granular casts", tick("rbccast") && "red cell casts", tick("wbccast") && "white cell casts"].filter(Boolean);
  lines.push(["Urine sediment", sed.length ? sed.join(", ") : x.urinalysisDone ? "bland" : "not found", sed.length ? "" : x.urinalysisDone ? "Bland: pre-renal, post-renal, or early ATN" : "Send urinalysis with microscopy"]);
  const max = Math.max(1, ...Object.values(p.scores));
  const BL = { prerenal: "Pre-renal", atn: "ATN", ain: "AIN", gn: "GN", postrenal: "Post-renal" };
  $("typesum").textContent = leanText(p.lean);
  const lean0 = p.lean.split("+")[0];
  $("type").innerHTML = `<div class="verdict ${p.lean === "unclear" ? "t2" : "t1"}"><div class="k" style="font-size:12px;text-transform:uppercase;opacity:.8">Most likely</div><div class="big">${esc(leanText(p.lean))}</div></div>
    <div class="scroll"><table>${lines.map(([k, v, t]) => `<tr><td>${esc(k)}</td><td class="num">${esc(v)}</td><td class="wrap">${esc(t)}</td></tr>`).join("")}</table></div>
    <h3 style="font-size:14px;margin:12px 0 4px">Evidence for each type <span class="muted" style="font-weight:400">(points from the chart and your ticks)</span></h3>
    ${p.order.map((k) => `<div class="bar"><span class="lbl">${BL[k]}</span><span class="b" style="width:${(p.scores[k] / max) * 200}px;opacity:${p.scores[k] ? 1 : 0.15}"></span><span class="muted">${p.scores[k]}${p.reasons[k].length ? " · " + esc(p.reasons[k].join("; ")) : ""}</span></div>`).join("")}
    <div class="alert action" style="margin-top:10px"><b>Next</b>${ul((NEXT[lean0] || NEXT.unclear).map(esc))}</div>
    <div class="muted">A guide only: causes often overlap (for example pre-renal turning into ATN in sepsis). Exclude obstruction in every unexplained AKI.</div>`;
}

const MEDGROUPS = [
  ["Stop if possible (nephrotoxic)", ["nsaid", "amino", "ampho", "colistin", "foscarnet", "zoledronic"], 3, "action"],
  ["Hold while the AKI is active ('sick day' drugs)", ["acei", "arb", "loop", "thiazide", "mra", "sglt2", "metformin"], 2, "action", "Diuretics: keep or increase if overloaded. Restart the rest once creatinine is back to baseline and eating and drinking."],
  ["Check levels / monitor closely", ["vanc", "amino", "lithium", "cni", "mtx"], 3, "info", "Vancomycin with piperacillin-tazobactam raises AKI risk: consider cefepime or meropenem instead, and AUC dosing."],
  ["Can cause acute interstitial nephritis (past 30 days)", AIN_CATS, 30, "info"],
  ["Can cause crystals or tubular injury", ["acyclo", "mtx", "platin", "tenofovir", "contrast"], 7, "info"],
  ["Can cause urinary retention", ["anticholinergic", "opioid"], 3, "info"],
  ["Raise potassium", ["kraise", "acei", "arb", "mra", "tmp"], 2, "info"],
  ["Dose for kidney function (pharmacy)", ["renaldose"], 2, "info", "Morphine and codeine metabolites build up: prefer hydromorphone at low dose or fentanyl. Enoxaparin: reduce or switch to heparin if CrCl under 30."]];
function drawMeds(x) {
  const f = state.f, now = Date.now(), out = [];
  MEDGROUPS.forEach(([h, cats, days, lvl, tip]) => {
    const n = C.names(cats.flatMap((c) => C.recent(f, c, days, now)));
    if (n.length) out.push(`<div class="alert ${lvl}"><b>${esc(h)}</b>${esc(n.join("; "))}${tip ? '<div class="muted">' + esc(tip) + "</div>" : ""}</div>`);
  });
  if (C.recent(f, "vanc", 3, now).length && C.recent(f, "piptazo", 3, now).length) out.unshift(`<div class="alert action"><b>Combination</b>Vancomycin with piperacillin-tazobactam: higher AKI risk than either alone. Review the need for both.</div>`);
  $("medsum").textContent = out.length ? out.length + " group" + (out.length > 1 ? "s" : "") : "none found";
  $("meds").innerHTML = out.length ? out.join("") : '<div class="muted">No relevant medicines found (ordered now or given recently). Check the home medication list too.</div>';
}

function drawTests(x) {
  const f = state.f, now = Date.now();
  const S = (id, d) => C.latest(f.s[id], d * DAY, now), U = (id) => C.latest(f.u[id], 7 * DAY, now), Q = (id, d) => { const a = (f.q[id] || []).filter((e) => now - e.t <= d * DAY); return a[a.length - 1] || null; };
  const sv = (e, dp) => (e ? `${dp ? r2(e.v) : r1(e.v)}` : null), qv = (e) => (e ? e.shown || (e.pos ? "positive" : "negative") : null);
  const gn = x.hematuria || tick("rbccast") || x.pat.order[0] === "gn";
  const rows = [
    ["Blood", "Creatinine, urea", x.cr ? Math.round(x.cr.cur.v) + " / " + (x.urea ? r1(x.urea.v) : "–") : null, x.cr && x.cr.cur.t, "Daily (more often if stage 2-3)"],
    ["Blood", "Potassium", sv(x.k), x.k && x.k.t, "Hyperkalemia"], ["Blood", "Bicarbonate / pH", x.hco3 || x.ph ? (x.hco3 ? r1(x.hco3.v) : "–") + " / " + (x.ph ? x.ph.v : "–") : null, (x.hco3 || x.ph || {}).t, "Acidosis"],
    ["Blood", "Calcium, phosphate", x.ca || x.phos ? (x.ca ? r2(x.ca.v) : "–") + " / " + (x.phos ? r2(x.phos.v) : "–") : null, (x.ca || x.phos || {}).t, "High phosphate in AKI; high calcium in myeloma"],
    ["Blood", "CK", sv(S("ck", 7)), (S("ck", 7) || {}).t, "Rhabdomyolysis (over 5000)"], ["Blood", "Uric acid", sv(S("urate", 7), true), (S("urate", 7) || {}).t, "Tumour lysis"],
    ["Blood", "CBC: Hb, platelets, eosinophils", x.hb || x.plt ? [x.hb && Math.round(x.hb.v), x.plt && Math.round(x.plt.v), x.eos && r2(x.eos.v)].map((v) => v == null ? "–" : v).join(" / ") : null, (x.hb || x.plt || {}).t, "TMA (low platelets), AIN (eosinophils)"],
    ["Blood", "LDH (+ smear, haptoglobin if platelets low)", sv(x.ldh), x.ldh && x.ldh.t, "Hemolysis / TMA"],
    ["Urine", "Urinalysis: blood / protein / leukocytes", [Q("ublood", 7), Q("uprot", 7), Q("uleuk", 7)].some(Boolean) ? [Q("ublood", 7), Q("uprot", 7), Q("uleuk", 7)].map((e) => qv(e) || "–").join(" / ") : null, (Q("ublood", 7) || Q("uprot", 7) || {}).t, "Every AKI"],
    ["Urine", "Microscopy: red cells / white cells /HPF", x.urbc || x.uwbc ? (x.urbc ? x.urbc.v : "–") + " / " + (x.uwbc ? x.uwbc.v : "–") : null, (x.urbc || x.uwbc || {}).t, "Casts and cell types point to ATN, AIN or GN"],
    ["Urine", "Sodium, creatinine, urea, osmolality", [U("una"), U("ucr"), U("uurea"), U("uosm")].some(Boolean) ? [U("una"), U("ucr"), U("uurea"), U("uosm")].map((e) => (e ? r1(e.v) : "–")).join(" / ") : null, (U("una") || U("ucr") || {}).t, "FENa, FEUrea (send before diuretics)"],
    ["Urine", "Protein:creatinine ratio", sv(x.upcr, true), x.upcr && x.upcr.t, "Over 0.05 g/mmol is significant; over 0.3 nephrotic range"],
    ["Urine", "Culture", qv(Q("uculture", 14)), (Q("uculture", 14) || {}).t, "Infection vs sterile pyuria (AIN)"],
    ["Bedside", "Bladder scan (post-void residual)", x.pvr ? Math.round(x.pvr.v) + " mL" : null, x.pvr && x.pvr.t, "Over 200 mL: retention"],
    ["Imaging", "Renal ultrasound", tick("hydro") ? "hydronephrosis (ticked)" : null, null, "Obstruction, kidney size (small = CKD). Check the imaging report"],
    ["Drug levels", "Vancomycin / aminoglycoside / lithium", [x.vanc, x.genta, x.lith].some(Boolean) ? [x.vanc, x.genta, x.lith].map((e) => (e ? r1(e.v) : "–")).join(" / ") : null, (x.vanc || x.genta || x.lith || {}).t, "If on them"],
    [gn ? "GN screen (send now)" : "GN screen (if blood + protein)", "MPO-ANCA / PR3-ANCA / anti-GBM", [Q("mpo", 60), Q("pr3", 60), Q("gbm", 60)].some(Boolean) ? [Q("mpo", 60), Q("pr3", 60), Q("gbm", 60)].map((e) => qv(e) || "–").join(" / ") : null, (Q("mpo", 60) || Q("gbm", 60) || {}).t, "Rapidly progressive GN"],
    [gn ? "GN screen (send now)" : "GN screen (if blood + protein)", "C3 / C4 / ANA / anti-dsDNA", x.c3 || x.c4 || x.ana || x.dsdna ? [x.c3 && r2(x.c3.v), x.c4 && r2(x.c4.v), qv(x.ana), qv(x.dsdna)].map((v) => v == null ? "–" : v).join(" / ") : null, (x.c3 || x.ana || {}).t, "Lupus, post-infectious, cryoglobulins, endocarditis"],
    [gn ? "GN screen (send now)" : "GN screen (if blood + protein)", "Hepatitis B, C, HIV; cryoglobulins; ASO; blood cultures", null, null, "Secondary causes of GN"],
    [x.myeloma ? "Myeloma screen (send now)" : "Myeloma screen (if age over 50, anemia, high calcium)", "Serum free light chains, protein electrophoresis", qv(Q("flc", 90)) || qv(Q("spep", 90)), (Q("flc", 90) || Q("spep", 90) || {}).t, "Cast nephropathy"]];
  const missing = rows.filter((r) => r[2] == null).length;
  $("testsum").textContent = missing + " not found";
  $("tests").innerHTML = `<table><tr><th></th><th>Test</th><th>Latest</th><th>When</th><th>Why</th></tr>` + rows.map(([g, n, v, t, why]) => `<tr><td class="muted wrap" style="width:18%">${esc(g)}</td><td class="wrap">${esc(n)}</td>${v == null ? `<td class="old" colspan="2">Not found</td>` : `<td class="num">${esc(v)}</td><td>${t ? fmtDT(t) : ""}</td>`}<td class="muted wrap">${esc(why)}</td></tr>`).join("") + "</table>";
}

function drawRef(x) {
  const lean = x ? x.pat.lean : "", on = (id) => (x && (lean.split("+").includes(id) || (id === "renal" && /atn|ain|gn/.test(lean))));
  const L = (h, a) => `<h4>${esc(h)}</h4>${ul(a.map(esc))}`;
  $("bundle").innerHTML = ul(REF.BUNDLE.map(esc));
  $("types").innerHTML = REF.TYPES.map((t) => `<details${on(t.id) ? " open class=\"hit\"" : ""}><summary>${esc(t.title)}${on(t.id) ? ' <span class="chip c-yes">matches this patient</span>' : ""}</summary>
    <p>${esc(t.what)}</p>${L("Causes", t.causes)}${L("Signs and symptoms", t.signs)}${L("Investigations", t.tests)}${L("Treatment", t.tx)}<div class="rec"><b>Expected recovery:</b> ${esc(t.recovery)}</div></details>`).join("");
  const hitR = (id) => x && ((["atn", "ain", "gn"].includes(id) && lean.split("+").includes(id)) || (id === "gn" && (x.hematuria && x.proteinuria)) || (id === "tma" && x.tma) || (id === "cast" && x.myeloma) || (id === "hrs" && state.f && state.f.prob.cirrhosis));
  const hits = REF.RENAL.filter((r) => hitR(r.id)).map((r) => r.name.split(" (")[0]);
  $("renalsum").textContent = hits.length ? "matches: " + hits.join(", ") : "reference";
  $("renal").innerHTML = REF.RENAL.map((r) => `<details${hitR(r.id) ? " open class=\"hit\"" : ""}><summary>${esc(r.name)}${hitR(r.id) ? ' <span class="chip c-yes">consider</span>' : ""}</summary>
    <p><b>Clues:</b> ${esc(r.clues)}</p>${L("Tests", r.tests)}${L("Treatment", r.tx)}<div class="rec"><b>Expected recovery:</b> ${esc(r.recovery)}</div><div class="neph"><b>Nephrology:</b> ${esc(r.nephro)}</div></details>`).join("");
  $("whennephro").innerHTML = REF.WHEN_NEPHRO.map(([h, a]) => L(h, a)).join("");
}

/* ---------- note draft ---------- */
function akiNote() {
  if (!state.f) return null;
  const x = ctx(), cr = x.cr; if (!cr) return null;
  const S = {};
  S.assess = [`AKI KDIGO stage ${x.stage || "0 (criteria not met)"}: creatinine ${Math.round(cr.cur.v)} umol/L (${fmtDT(cr.cur.t)})` + (cr.base ? `, baseline ${Math.round(cr.base.v)} (${cr.baseKind}), ${r1(cr.ratio)} × baseline` : ", baseline unknown") + `; ${cr.trend}${cr.recovering ? ", recovering" : ""}.`];
  if (x.uo) S.assess.push(`Urine output ${x.uo.r6 != null ? r2(x.uo.r6) : "–"} mL/kg/h (6 h), ${x.uo.r24 != null ? r2(x.uo.r24) : "–"} (24 h).`);
  const ex = { dry: "dry", euvolemic: "euvolemic", overloaded: "overloaded", loweff: "low effective volume" }[$("exam").value];
  if (ex) S.assess.push("Volume status: " + ex + ".");
  S.assess.push(`K ${x.k ? x.k.v : "–"}, HCO3 ${x.hco3 ? r1(x.hco3.v) : "–"}, urea ${x.urea ? r1(x.urea.v) : "–"}.`);
  S.cause = ["Most likely: " + leanText(x.pat.lean) + "."];
  const idx = [x.fena != null && "FENa " + r2(x.fena) + "%", x.feurea != null && "FEUrea " + r1(x.feurea) + "%", x.U.una != null && "urine Na " + x.U.una, x.U.uosm != null && "urine osm " + x.U.uosm].filter(Boolean);
  if (idx.length) S.cause.push(idx.join(", ") + (x.diuretic ? " (on diuretic)" : "") + ".");
  const sed = [x.hematuria && "hematuria", x.proteinuria && "proteinuria", x.sterilePyuria && "sterile pyuria", tick("muddy") && "granular casts", tick("rbccast") && "RBC casts", tick("wbccast") && "WBC casts"].filter(Boolean);
  S.cause.push("Urine: " + (sed.length ? sed.join(", ") : x.urinalysisDone ? "bland sediment" : "urinalysis pending") + (x.pvr ? `; bladder scan ${Math.round(x.pvr.v)} mL` : "") + (tick("hydro") ? "; hydronephrosis" : "") + ".");
  if (x.serology) S.cause.push("Serology: " + x.serology + ".");
  const top = x.pat.order[0]; if (x.pat.reasons[top] && x.pat.reasons[top].length) S.cause.push("Supporting: " + x.pat.reasons[top].join("; ") + ".");
  S.meds = [];
  const now = Date.now(), f = state.f;
  [["Hold", ["nsaid", "acei", "arb", "mra", "sglt2", "metformin"].concat($("exam").value === "overloaded" ? [] : ["loop", "thiazide"])], ["Nephrotoxins", ["amino", "vanc", "ampho", "contrast", "colistin"]], ["Possible AIN culprits", AIN_CATS]].forEach(([h, cats]) => {
    const n = C.names(cats.flatMap((c) => C.recent(f, c, h === "Possible AIN culprits" ? 30 : 3, now))); if (n.length) S.meds.push(h + ": " + n.join(", ") + ".");
  });
  S.plan = (NEXT[x.pat.lean.split("+")[0]] || NEXT.unclear).map((t) => t + ".");
  x.rrtList.forEach((r) => S.plan.push(r.text));
  if (x.nephro.length) S.plan.push("Nephrology: " + x.nephro.map((n) => n.text.replace(/:.*$/, "").replace(/\.$/, "")).join("; ") + ".");
  S.plan.push("Repeat creatinine and electrolytes daily; strict intake and output; daily weight; renally dose all drugs.");
  return { stamp: cr.cur.t, heading: "ACUTE KIDNEY INJURY", sections: S };
}
const AKI_NOTE = NoteDraft.mount($("note"), {
  title: "AKI",
  sections: [{ id: "assess", label: "Assessment" }, { id: "cause", label: "Cause workup", noteLabel: "Cause" }, { id: "meds", label: "Medicines" }, { id: "plan", label: "Plan" }],
  build: akiNote
});

/* ---------- loading ---------- */
function load(raw, note, errors, preset) {
  state.f = raw ? C.parse(raw) : null; preset = preset || {};
  state.auto = state.f ? autoTicks(state.f) : {};
  drawTicks();
  $("exam").value = preset.exam || ""; $("base").value = "";
  MF.forEach((k) => ($("m-" + k).value = ""));
  const w = state.f && state.f.weights[state.f.weights.length - 1]; $("wt").value = w ? r1(w.v) : "";
  $("pstatus").textContent = note; $("clear").hidden = !raw;
  $("errs").innerHTML = errors && errors.length ? "Could not read: " + errors.map(esc).join("; ") + ". Check the scopes in the Code Console." : "";
  draw(); AKI_NOTE.reset();
}
["base", "wt"].forEach((id) => ($(id).oninput = draw));
$("exam").onchange = draw;
MF.forEach((k) => ($("m-" + k).oninput = draw));
$("m-clear").onclick = () => { MF.forEach((k) => ($("m-" + k).value = "")); draw(); };
$("clear").onclick = () => { $("testsel").value = ""; load(null, "Open from Cerner to read the chart, or pick a made-up patient:"); };
const SAMPLES = window.AKI_SAMPLES || [];
SAMPLES.forEach((p, i) => { const o = document.createElement("option"); o.value = i; o.textContent = p.label; $("testsel").appendChild(o); });
$("testsel").onchange = () => { const p = SAMPLES[$("testsel").value]; if (!p) return $("clear").onclick(); load(p.build(Date.now()), "Made-up patient: " + p.label, [], p); };

async function fromChart() {
  if (typeof FHIR === "undefined" || !(location.search.includes("code=") || location.search.includes("complete=") || sessionStorage.getItem("SMART_KEY"))) return;
  $("pstatus").textContent = "Reading the chart…";
  try {
    const client = await FHIR.oauth2.ready();
    const { raw, errors } = await C.gather(client, (msg) => ($("pstatus").textContent = msg));
    load(raw, "Chart read (read-only). Nothing is sent anywhere. Check the bedside ticks and volume status above.", errors);
  } catch (e) { $("pstatus").textContent = "Could not read the chart: " + (e && e.message ? e.message : e) + ". The made-up patients still work."; }
}
drawTicks(); draw(); fromChart();
// ?demo=1..5 opens a made-up patient directly
(() => { const d = parseInt(new URLSearchParams(location.search).get("demo"), 10); if (d >= 1 && d <= SAMPLES.length) { $("testsel").value = d - 1; $("testsel").onchange(); } })();
