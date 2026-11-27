/* FUO page. Read-only from the chart; your selections stay in this page. UNVERIFIED draft. */
const R = window.FUORules, C = window.FUOChart, DAY = C.DAY, HR = C.HR;
const $ = (id) => document.getElementById(id);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const ago = (t) => { const h = (Date.now() - t) / HR; return h < 1 ? Math.max(1, Math.round(h * 60)) + " min ago" : h < 48 ? Math.round(h) + " h ago" : Math.round(h / 24) + " d ago"; };
const when = (t) => new Date(t).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
const ul = (a) => "<ul>" + a.filter(Boolean).map((t) => "<li>" + t + "</li>").join("") + "</ul>";
const num = (id) => { const v = parseFloat($(id).value); return isFinite(v) ? v : null; };
const state = { f: null, override: {}, hideDone: {} };
const has = (k) => !!(state.f && state.f.cls[k] && state.f.cls[k].length);
const prob = (k) => !!(state.f && state.f.prob[k]);

/* bedside clues: id, label, group */
const TICKS = [
  ["Exposures and risks", [["travel", "Travel outside Canada in the past year"], ["animals", "Farm animals, livestock, unpasteurized dairy, hunting"], ["catScratch", "Cat scratch / kittens"],
    ["tbRisk", "TB risk: born/lived in a high-TB area, TB contact, prior TB, shelter/prison, remote community"], ["sexualRisk", "New sexual partner / STI risk"], ["ivdu", "Injection drug use"],
    ["recentSurgery", "Surgery or procedure in the past 3 months"], ["immobile", "Immobile / bed-bound"], ["recurrent", "Recurrent episodes with well periods between"],
    ["factitious", "Fever without matching pulse rise, no daily pattern, or unobserved readings"]]],
  ["Symptoms", [["nightSweats", "Drenching night sweats"], ["weightLoss", "Weight loss over 5%"], ["headache", "New headache (temporal)"], ["jawClaud", "Jaw or tongue claudication"],
    ["visual", "Visual symptoms (blurring, double vision, loss)"], ["girdlePain", "Shoulder/hip girdle pain, morning stiffness"], ["arthralgia", "Joint pain or swelling (2 weeks or more)"],
    ["soreThroat", "Sore throat"], ["abdoPain", "Abdominal or flank pain"], ["diarrhea", "Diarrhea"], ["backPain", "Back pain / spinal tenderness"], ["neckPain", "Painful anterior neck (thyroid)"],
    ["legSwelling", "Leg swelling"], ["pruritus", "Itch (pruritus)"]]],
  ["Exam", [["rash", "Rash"], ["salmonRash", "Salmon-pink evanescent rash with fever spikes"], ["lymphadenopathy", "Lymphadenopathy"], ["splenomegaly", "Splenomegaly"], ["hepatomegaly", "Hepatomegaly"],
    ["murmur", "New or changed murmur"], ["emboli", "Splinters, Janeway lesions, conjunctival petechiae, embolic event"], ["vascSigns", "Sinus/ear disease, mononeuritis, palpable purpura"],
    ["hematuria", "Hematuria or active urine sediment"], ["vexas", "Older man: ear/nose chondritis, macrocytosis, neutrophilic skin lesions"]]]];
const TICK_LABEL = Object.fromEntries(TICKS.flatMap((g) => g[1]));
$("ticks").innerHTML = TICKS.map(([g, items]) => `<fieldset><legend>${esc(g)}</legend><div class="row">${items.map(([id, t]) => `<label class="inl"><input type="checkbox" class="clue" value="${id}"> ${esc(t)}<span class="auto" id="auto-${id}"></span></label>`).join("")}</div></fieldset>`).join("");

const GCA_ITEMS = [["stiffness", "Morning stiffness shoulders/neck"], ["visualLoss", "Sudden visual loss"], ["jawClaud", "Jaw or tongue claudication"], ["headache", "New temporal headache"], ["scalp", "Scalp tenderness"],
  ["taExam", "Abnormal temporal artery (tender, thick, weak pulse)"], ["tabHalo", "Positive biopsy or halo sign on ultrasound"], ["axillary", "Bilateral axillary artery involvement on imaging"], ["petAorta", "FDG-PET activity throughout the aorta"]];
$("gcain").innerHTML = GCA_ITEMS.map(([id, t]) => `<label class="inl"><input type="checkbox" class="gca" value="${id}"> ${esc(t)}</label>`).join(" ");

/* ---------- facts ---------- */
function facts() {
  const f = state.f, now = Date.now(), L = (id, d) => (f ? C.latest(f.l[id], d * DAY, now) : null);
  const c = {}; ["wbc", "anc", "neutPct", "lymph", "mono", "eos", "hb", "plt", "cr", "na", "k", "ca", "alb", "alt", "ast", "alp", "bili", "ldh", "ck", "esr", "crp", "ferritin", "tg", "fib", "tsh", "pct", "lactate", "cd4"].forEach((k) => (c[k] = L(k, k === "tsh" || k === "cd4" ? 90 : 7)));
  const temps = f && f.v.temp ? f.v.temp.filter((x) => now - x.t <= 30 * DAY) : [];
  const fs = R.feverStats(temps, now, 38.3);
  const rb = R.relBrady(temps, f ? f.v.hr : [], has("rate") || prob("pacer"));
  const age = f ? f.age : null;
  // tests in the chart
  const T = (id) => (f && f.tests[id]) || [], Rp = (id) => (f && f.reports[id]) || [];
  const bcs = T("bc"), bcPos = bcs.filter((x) => x.pos), bcDone = bcs.filter((x) => !x.pending);
  const qv = (id) => { const a = T(id).filter((x) => !x.pending); if (!a.length) return null; const x = a[a.length - 1]; return x.pos ? "pos" : x.neg ? "neg" : "done"; };
  const q = { bcPos, ana: qv("ana"), rf: qv("rf"), igra: qv("igra"), hiv: qv("hiv") };
  const lc = R.labClues(c, q);
  // durations
  const fsTyped = num("feverStart"), admTyped = num("admitted");
  const admittedDays = admTyped != null ? admTyped : f && f.admitT ? Math.round(((now - f.admitT) / DAY) * 10) / 10 : null;
  const chartDur = fs.first ? Math.round((now - fs.first.t) / DAY) : null;
  const durationDays = fsTyped != null ? fsTyped : chartDur;
  const poaSel = $("poa").value, presentOnAdmission = poaSel === "yes" ? true : poaSel === "no" ? false : f && f.admitT && fs.first ? (fs.first.t - f.admitT < 2 * DAY ? true : false) : null;
  const feverStartT = fsTyped != null ? now - fsTyped * DAY : fs.first ? fs.first.t : null;
  // drug fever
  const df = R.drugFever(f ? f.activeMeds.concat(f.meds.filter((m) => /stopped|completed/.test(m.status) && m.t && feverStartT && m.t < feverStartT)) : [], feverStartT);
  const abxBeforeCultures = !!(f && f.firstAbx && (f.firstBC == null || f.firstAbx < f.firstBC));
  const immuno = has("immuno") || has("chemo") || prob("transplant") || prob("hiv") || prob("asplenia") || (state.f && f.cls.steroid.some((x) => /prednisone\s*([2-9]\d|1\d\d)\s*mg|dexamethasone/i.test(x)));
  const hb7 = f && f.l.hb ? f.l.hb.filter((x) => now - x.t <= 7 * DAY) : [];
  const hbDrop = hb7.length >= 2 && Math.max(...hb7.map((x) => x.v)) - hb7[hb7.length - 1].v >= 20;
  const uaTxt = T("ua").map((x) => x.text).join(" ");

  // clue set: id -> label (why it is on)
  const x = {};
  $$(".clue:checked").forEach((el) => (x[el.value] = TICK_LABEL[el.value]));
  lc.forEach((l) => (x[l.id] = l.text));
  if (lc.some((l) => l.id === "ferritin10k")) x.ferritin3k = x.ferritin3k || x.ferritin10k;
  if (prob("valve")) x.valve = "valve disease/prosthesis: " + f.prob.valve[0];
  if (prob("device")) x.device = "device: " + f.prob.device[0];
  if (prob("ivdu")) x.ivdu = x.ivdu || "substance use on problem list";
  if (prob("dm")) x.dm = "diabetes";
  if (prob("hiv")) x.hiv = "HIV";
  if (prob("tb")) x.tbRisk = x.tbRisk || "TB on problem list";
  if (prob("cirrhosis")) x.cirrhosis = "cirrhosis";
  if (prob("cancerHx")) x.cancerHx = "cancer history";
  if (prob("neuroEvent")) x.neuroEvent = "stroke/brain injury on problem list";
  if (immuno) x.immuno = "immunosuppressed (drug, transplant, HIV or asplenia)";
  if (has("anticoag")) x.anticoag = "on anticoagulant";
  if (hbDrop) x.hbDrop = "Hb fell 20 g/L or more in 7 days";
  if (age != null && age >= 50) x.age50 = "age " + age;
  if (rb.found) x.relBrady = `pulse-temperature deficit (${rb.pairs[0].temp} °C with HR ${rb.pairs[0].hr})`;
  if (df.length) x.drugAny = "possible culprit drug: " + df[0].text;
  if (df.some((d) => d.fits)) x.drugFit = "drug started 1-21 days before the fever: " + df.find((d) => d.fits).text;
  if (f && f.stoppedSteroid.length) x.steroidStop = "steroid stopped: " + f.stoppedSteroid[0];
  if (abxBeforeCultures) x.priorAbx = "antibiotics before the first blood culture";
  if (bcDone.length && !bcPos.length) x.posBCneg = "blood cultures negative";
  if (/blood\s*[1-4]\+|rbc|hematuria|red cell/i.test(uaTxt)) x.hematuria = x.hematuria || "blood on urinalysis";
  if (q.hiv === "pos") x.hiv = "HIV test reactive";

  const typed = { durationDays, feverEpisodes: temps.length ? fs.episodes : null, admittedDays, presentOnAdmission, anc: c.anc ? c.anc.v : null, hiv: !!x.hiv,
    culturesDays: f && f.firstBC ? (now - f.firstBC) / DAY : null };
  const ddx = R.differential(x);
  const have = workupHave(f, c);
  const wu = R.workup(have, x).map((w) => { const o = state.override[w.id]; return o ? { ...w, status: o === "na" ? "na" : o, manual: true } : w; });
  const s1 = wu.filter((w) => w.stage === 1), s1done = s1.filter((w) => w.status === "done" || w.status === "na").length;
  typed.workupDone = s1done; typed.workupTotal = s1.length;
  const type = R.fuoType(typed);
  const organ = (x.splenomegaly ? 1 : 0) + (x.hepatomegaly ? 1 : 0);
  const hs = R.hscore({ tmax: fs.tmax ? fs.tmax.v : null, organ, hb: c.hb && c.hb.v, wbc: c.wbc && c.wbc.v, plt: c.plt && c.plt.v, ferritin: c.ferritin && c.ferritin.v, tg: c.tg && c.tg.v, fib: c.fib && c.fib.v, ast: c.ast && c.ast.v, hemophago: $("hemophago").checked, immuno: $("hs-immuno").checked });
  if (hs.positive) x.hlhPos = "HScore " + hs.score;
  const yam = R.yamaguchi({ fever39week: !!(fs.tmax && fs.tmax.v >= 39 && ((durationDays != null && durationDays >= 7) || fs.spanDays >= 7)), arthralgia2wk: !!x.arthralgia, rash: !!x.salmonRash,
    leukocytosis: !!(c.wbc && c.wbc.v >= 10 && c.neutPct && c.neutPct.v >= 80), soreThroat: !!x.soreThroat, nodesSpleen: !!(x.lymphadenopathy || x.splenomegaly),
    liverAbn: !!((c.alt && c.alt.v > 40) || (c.ast && c.ast.v > 40)), anaRfNeg: q.ana === "neg" && q.rf === "neg" });
  const g = {}; $$(".gca").forEach((el) => (g[el.value] = el.checked));
  const esrMax = f && f.l.esr ? Math.max(...f.l.esr.map((v) => v.v)) : null, crpMax = f && f.l.crp ? Math.max(...f.l.crp.map((v) => v.v)) : null;
  const gca = R.gca2022({ age, ...g, esrcrp: (esrMax != null && esrMax >= 50) || (crpMax != null && crpMax >= 10) });
  const sbp = f ? C.latest(f.v.sbp, DAY, now) : null;
  const unstable = $("unstable").checked || !!(sbp && sbp.v < 90) || !!(c.lactate && c.lactate.v >= 4);
  const gcaSuspect = !!(x.age50 && (x.headache || x.jawClaud || x.visual || g.visualLoss) && (x.esr50 || x.esr100 || (crpMax != null && crpMax >= 10)));
  const tx = R.treatment({ anc: typed.anc, unstable, immuno: !!x.immuno, gcaVision: !!(x.age50 && (x.visual || g.visualLoss) && (x.headache || x.jawClaud || x.esr50 || x.esr100)), gcaSuspect,
    hlh: hs.positive, ferritin10k: !!x.ferritin10k, malariaRisk: !!x.travel && !(have.malaria && have.malaria.status), ieSuspect: !!(x.posBC || ((x.valve || x.device || x.ivdu) && (x.murmur || x.emboli)) || (x.murmur && x.emboli)),
    miliarySuspect: $("miliary").checked, drugFit: !!x.drugFit, onAbx: has("abx"), stable: !unstable, abxBeforeCultures, onSteroid: has("steroid"),
    undiagnosedStable: !unstable && have.pet && have.pet.status === "done" && !ddx.length });
  const cons = R.consults({ ...x, classicMeets: type.kind === "classic" && type.meets }, ddx);
  return { f, c, q, fs, rb, temps, lc, df, x, ddx, wu, s1, s1done, type, hs, yam, gca, tx, cons, unstable, abxBeforeCultures, durationDays, admittedDays, presentOnAdmission, bcs, bcPos, age, gcaSuspect, have };
}

function workupHave(f, c) {
  const h = {}; if (!f) return h;
  const T = (id) => f.tests[id] || [], Rp = (id) => f.reports[id] || [];
  const fromList = (a) => { if (!a.length) return null; const done = a.filter((x) => !x.pending), x = (done.length ? done : a)[(done.length ? done : a).length - 1]; return { status: done.length ? "done" : "pending", text: x.text || x.name, t: x.t }; };
  const lab = (k) => (c[k] ? { status: "done", text: c[k].v, t: c[k].t } : null);
  const set = (id, v) => { if (v) h[id] = v; };
  set("cbc", c.wbc ? { status: "done", text: "WBC " + c.wbc.v + (c.hb ? ", Hb " + c.hb.v : "") + (c.plt ? ", plt " + c.plt.v : ""), t: c.wbc.t } : null); set("chem", lab("cr") && { ...lab("cr"), text: "creatinine " + c.cr.v }); set("lft", c.alt || c.alp ? { status: "done", text: `ALT ${c.alt ? c.alt.v : "?"}, ALP ${c.alp ? c.alp.v : "?"}`, t: (c.alt || c.alp).t } : null);
  ["ck", "ldh", "esr", "crp", "ferritin", "tsh"].forEach((k) => set(k, lab(k)));
  set("ua", fromList(T("ua").concat(T("uc"))));
  const bc = T("bc"); if (bc.length) { const done = bc.filter((x) => !x.pending), pos = bc.filter((x) => x.pos); h.bc = { status: bc.length >= 3 ? (done.length >= 3 ? "done" : "pending") : "partial", text: `${bc.length} set${bc.length > 1 ? "s" : ""}${pos.length ? ": POSITIVE " + pos[0].text : done.length ? ": " + done[done.length - 1].text : ""}`, t: bc[bc.length - 1].t }; }
  ["hiv", "ana", "rf", "spep", "igra", "syph", "anca", "malaria", "afb", "flc", "cortisol", "sil2r"].forEach((k) => set(k, fromList(T(k))));
  set("hep", T("hbv").length && T("hcv").length ? fromList(T("hbv").concat(T("hcv"))) : T("hbv").length || T("hcv").length ? { ...fromList(T("hbv").concat(T("hcv"))), status: "partial" } : null);
  set("cmvebv", fromList(T("cmv").concat(T("ebv")))); set("comp", fromList(T("c3").concat(T("c4"), T("dsdna")))); set("zoon", fromList(T("qfever").concat(T("bart"), T("bruc"))));
  set("fungal", fromList(T("histo").concat(T("crypto"), T("bdg")))); set("calpro", fromList(T("calpro").concat(Rp("colon"))));
  set("hlhlabs", c.tg && c.fib ? { status: "done", text: `TG ${c.tg.v}, fibrinogen ${c.fib.v}`, t: c.tg.t } : c.tg || c.fib ? { status: "partial", text: c.tg ? "TG only" : "fibrinogen only" } : null);
  ["cxr", "ct", "echo", "pet", "tus", "doppler", "mri", "nodebx", "bmbx", "tab", "liverbx"].forEach((k) => set(k, fromList(Rp(k))));
  return h;
}

/* ---------- draw ---------- */
function tile(k, big, sub, tone) { return `<div class="tile ${tone || ""}"><div class="k">${k}</div><div class="big">${big}</div><div class="s">${sub || ""}</div></div>`; }
const box = (cls, h, items) => (items.length ? `<div class="${cls}"><h3>${h}</h3>${ul(items)}</div>` : "");

function draw() {
  const x = facts();
  $("ptsum").textContent = state.f ? [state.f.sex, state.f.age != null ? state.f.age + " y" : "", x.admittedDays != null ? "in hospital " + x.admittedDays + " d" : ""].filter(Boolean).join(", ") : "";
  Object.keys(TICK_LABEL).forEach((id) => { const a = $("auto-" + id); if (a) a.textContent = ""; });
  const tT = x.type.kind === "neutropenic" ? "t3" : x.type.meets ? "t2" : "t1";
  const top = x.ddx.slice(0, 2).map((d) => d.name.split(" (")[0]);
  $("tiles").innerHTML = [
    tile("Type", esc(x.type.label), x.type.meets === true ? "meets criteria" : x.type.meets === false ? "criteria not met yet" : "needs duration / dates", tT),
    tile("Fever", x.fs.tmax ? x.fs.tmax.v + " °C" : "?", x.fs.tmax ? `${x.fs.feverDays} day${x.fs.feverDays === 1 ? "" : "s"} 38.3+ in chart${x.durationDays != null ? " · ill " + x.durationDays + " d" : ""}` : "no temperatures found", x.fs.tmax && x.fs.tmax.v >= 39.5 ? "t2" : "t1"),
    tile("Fits best", top.length ? esc(top[0]) : "No clue yet", top[1] ? "then " + esc(top[1]) : x.ddx.length ? "" : "go to PET-CT after stage 1-2", top.length ? "t1" : "t0"),
    tile("Stage 1 workup", `${x.s1done}/${x.s1.length}`, x.s1done === x.s1.length ? "complete" : "missing: " + esc(x.s1.filter((w) => !w.status || w.status === "partial").slice(0, 3).map((w) => w.t.split(" (")[0].split(":")[0]).join(", ")), x.s1done === x.s1.length ? "t0" : "t2"),
    tile("HScore (HLH)", x.hs.score, x.hs.band + (x.hs.miss.length ? " · partial" : ""), x.hs.positive ? "t3" : x.hs.score > 90 ? "t2" : "t0"),
    tile("Drug fever", x.df.filter((d) => d.fits).length ? "Possible" : x.df.length ? "Check" : "None found", x.df.length ? esc(x.df[0].text.split(" ").slice(0, 2).join(" ")) + (x.df[0].fits ? " (timing fits)" : "") : "no usual culprits", x.df.some((d) => d.fits) ? "t2" : "t0")].join("");
  drawAlerts(x); drawPlan(x); drawCurve(x); drawClues(x); drawDrugs(x); drawDdx(x); drawAll(); drawWorkup(x); drawScores(x); drawTx(x); drawFU(x); drawHandout(x);
  $("note").value = noteText(x);
}

function alertsOf(x) {
  const A = [], add = (lvl, b, t) => A.push({ lvl, b, t });
  if (x.type.kind === "neutropenic") add("urgent", "Febrile neutropenia", "ANC under 0.5: cultures and empiric antibiotics within 60 minutes. Not an FUO workup first.");
  if (x.unstable) add("urgent", "Unstable", "Low BP or lactate 4+: treat as sepsis now (cultures, then antibiotics).");
  if (x.bcPos.length) add("urgent", "Positive blood culture", esc(x.bcPos[0].text) + ". Echo; S. aureus needs ID consult; S. gallolyticus or C. septicum needs colonoscopy.");
  if (x.hs.positive || x.x.ferritin10k) add("urgent", "Possible HLH", `${esc(x.hs.text)} Call hematology today.`);
  if (x.x.age50 && x.x.visual) add("urgent", "GCA with visual symptoms", "Age 50+ with visual symptoms: IV methylprednisolone and same-day ophthalmology; do not wait for the biopsy.");
  if (x.x.travel && !(x.have.malaria && x.have.malaria.status)) add("urgent", "Travel", "No malaria smear/RDT in the chart: send today (3 sets 12-24 h apart).");
  if ((x.x.valve || x.x.device) && state.f && state.f.reports.echo && !state.f.reports.tee) add("action", "Prosthetic valve or device", "A TTE alone does not exclude endocarditis here: TEE (PET-CT helps for prosthetic valves and devices).");
  if (x.abxBeforeCultures) add("action", "Antibiotics before cultures", "The first antibiotic came before the first blood culture: negative cultures are less reliable.");
  if (has("abx") && !x.bcPos.length && !x.unstable) add("action", "On antibiotics without a proven infection", esc(state.f.cls.abx.slice(0, 2).join("; ")) + ". If stable, consider stopping for 48-72 h and re-culturing.");
  if (x.bcs.length < 3 && x.type.kind !== "neutropenic") add("action", "Blood cultures", `${x.bcs.length} set${x.bcs.length === 1 ? "" : "s"} in the chart: send 3 sets from separate sites (before antibiotics if possible).`);
  if (state.f && state.f.scheduledAntipyretic.length) add("action", "Scheduled antipyretic", esc(state.f.scheduledAntipyretic.join("; ")) + " hides the fever curve. Change to PRN if you can.");
  if (has("steroid")) add("action", "On steroids", esc(state.f.cls.steroid[0]) + ": fever and markers may be blunted; can spoil a lymphoma biopsy and PET-CT.");
  if (x.x.steroidStop && x.x.adrenal) add("action", "Adrenal insufficiency?", "Steroid stopped and Na low / K high: AM cortisol; stress-dose hydrocortisone if unwell.");
  if (x.x.drugFit) add("action", "Drug fever possible", esc(x.x.drugFit) + ". Stop or switch it if you can.");
  if (x.x.eos && x.x.rash && (x.x.transaminitis || x.x.drugAny)) add("action", "DRESS?", "Eosinophilia, rash and a culprit drug or abnormal liver tests: look for DRESS (RegiSCAR); stop the drug.");
  if (has("tnf")) add("action", "TNF inhibitor", esc(state.f.cls.tnf[0]) + ": TB, histoplasma, listeria, legionella. Low threshold for ID.");
  if (prob("hiv") && !(x.c.cd4)) add("info", "HIV", "No CD4 count in 90 days: send CD4 and viral load.");
  if (x.x.posIGRA) add("action", "IGRA positive", "Look for active TB (sputum/urine AFB, tissue). Airborne isolation if lung involvement until 3 negative smears.");
  if (x.rb.found) add("info", "Pulse-temperature deficit", `${x.rb.pairs[0].temp} °C with HR ${x.rb.pairs[0].hr}: drug fever, typhoid, legionella, Q fever, brucella, lymphoma, factitious fever.`);
  if (x.x.immuno) add("info", "Immunosuppressed", "Wider infection list (fungal, viral reactivation, TB, nocardia) and lower threshold for empiric treatment and ID.");
  if (x.fs.afebrile48 && x.fs.tmax) add("info", "No fever in 48 h", "Afebrile for 48 h in the chart: check whether antipyretics, antibiotics or steroids are masking it.");
  return A;
}
function drawAlerts(x) {
  const A = alertsOf(x);
  $("alertsum").textContent = A.length ? `${A.filter((a) => a.lvl === "urgent").length} urgent, ${A.length} total` : "none";
  $("alerts").innerHTML = A.length ? A.map((a) => `<div class="alert ${a.lvl}"><b>${a.b}:</b>${a.t}</div>`).join("") : '<div class="muted">No alerts from the chart and your ticks.</div>';
}

function drawPlan(x) {
  const urgent = x.tx.now.filter((t) => /NOW|today|within 60|Unstable|IV daily|same day/i.test(t)).map(esc);
  const doNow = x.tx.now.filter((t) => !/NOW|today|within 60|Unstable|IV daily|same day/i.test(t)).map(esc);
  const nextTests = x.wu.filter((w) => w.indicated && (!w.status || w.status === "partial")).sort((a, b) => a.stage - b.stage).slice(0, 6).map((w) => `${esc(w.t)} <span class="muted">(stage ${w.stage})</span>`);
  const next = [];
  if (nextTests.length) next.push("<b>Next tests:</b>" + ul(nextTests));
  if (x.ddx.length) next.push(`<b>Fits best:</b> ${x.ddx.slice(0, 3).map((d) => esc(d.name)).join("; ")}. See the Differential tab.`);
  else next.push("No strong clue yet. Finish stage 1; if still nothing, FDG PET-CT is the most useful next test.");
  if (x.cons.length) next.push("<b>Involve:</b> " + x.cons.map((c) => `${esc(c.who)} (${esc(c.when)})`).join(", "));
  $("plansum").textContent = x.type.label;
  $("plan").innerHTML = box("urgent", "Urgent", urgent) + box("action", "Do now", doNow) + box("", "Next", next) + box("", "Avoid", x.tx.avoid.slice(0, 2).map(esc));
}

function drawCurve(x) {
  const pts = x.temps.filter((p) => Date.now() - p.t <= 14 * DAY);
  let svg = "";
  if (pts.length >= 2) {
    const W = 620, H = 150, P = 34, t0 = pts[0].t, t1 = pts[pts.length - 1].t, lo = Math.min(36, ...pts.map((p) => p.v)), hi = Math.max(40, ...pts.map((p) => p.v));
    const xs = (t) => P + ((t - t0) / Math.max(1, t1 - t0)) * (W - P - 10), ys = (v) => H - 18 - ((v - lo) / (hi - lo)) * (H - 30);
    const hrs = state.f && state.f.v.hr ? state.f.v.hr.filter((h) => h.t >= t0 && h.t <= t1) : [];
    const hy = (v) => H - 18 - ((v - 40) / 120) * (H - 30);
    svg = `<svg viewBox="0 0 ${W} ${H}" width="100%" style="max-width:660px;color:var(--muted)"><line x1="${P}" x2="${W - 10}" y1="${ys(38.3)}" y2="${ys(38.3)}" stroke="currentColor" stroke-dasharray="4 3" opacity=".6"/><text x="2" y="${ys(38.3) + 4}">38.3</text><text x="2" y="${ys(hi) + 8}">${hi}</text><text x="2" y="${ys(lo)}">${lo}</text>
      ${hrs.length ? `<path d="${hrs.map((p, i) => (i ? "L" : "M") + xs(p.t).toFixed(1) + "," + hy(p.v).toFixed(1)).join(" ")}" fill="none" stroke="#7a8ca3" stroke-width="1" opacity=".7"/>` : ""}
      <path d="${pts.map((p, i) => (i ? "L" : "M") + xs(p.t).toFixed(1) + "," + ys(p.v).toFixed(1)).join(" ")}" fill="none" stroke="#c0392b" stroke-width="2"/>${pts.map((p) => `<circle cx="${xs(p.t).toFixed(1)}" cy="${ys(p.v).toFixed(1)}" r="2.6" fill="${p.v >= 38.3 ? "#c0392b" : "#e8a49c"}"><title>${p.v} °C, ${ago(p.t)}</title></circle>`).join("")}</svg>
      <div class="muted">Red = temperature (dashed line 38.3 °C). Grey = heart rate (scaled). 14 days.</div>`;
  }
  const daily = x.fs.daily.slice(-14).reverse().map((d) => `<tr><td>${new Date(d.t).toLocaleDateString([], { month: "short", day: "numeric" })}</td><td class="num ${d.v >= 38.3 ? "hi" : ""}">${d.v}</td></tr>`).join("");
  const tone = x.type.kind === "neutropenic" ? "t3" : x.type.meets ? "t2" : "t1";
  $("typesum").textContent = x.type.label;
  $("curve").innerHTML = `<div class="verdict ${tone}"><div class="big">${esc(x.type.label)}${x.type.meets === true ? " ✓" : x.type.meets === false ? " ✗" : ""}</div>${ul(x.type.why.map(esc))}<div>${esc(x.type.text)}</div></div>
    ${svg || '<div class="muted">Fewer than 2 temperatures in 30 days.</div>'}
    ${daily ? `<details><summary><b>Daily maximum temperature</b></summary><div class="scroll"><table><tr><th>Day</th><th>Tmax °C</th></tr>${daily}</table></div></details>` : ""}
    <details style="margin-top:8px"><summary><b>FUO definitions (Durack and Street)</b></summary><table class="ref">
      <tr><th>Type</th><th>Definition</th><th>Main causes</th></tr>
      <tr><td><b>Classic</b></td><td>38.3 °C or more on several occasions, 3 weeks or more, no diagnosis after 3 days in hospital, 3 clinic visits or 1 week of investigation</td><td>Infection, cancer, inflammatory disease; up to a third to a half undiagnosed</td></tr>
      <tr><td><b>Nosocomial</b></td><td>In hospital, fever not present or incubating on admission, no diagnosis after 3 days (2 days of cultures)</td><td>Lines, C. difficile, drug fever, DVT/PE, sinusitis, acalculous cholecystitis, transfusion</td></tr>
      <tr><td><b>Neutropenic</b></td><td>ANC under 0.5, no diagnosis after 3 days (2 days of cultures)</td><td>Bacterial (often not found), fungal (candida, aspergillus), viral (HSV, CMV)</td></tr>
      <tr><td><b>HIV-associated</b></td><td>Over 4 weeks as an outpatient or over 3 days in hospital</td><td>MAC, TB, CMV, PJP, cryptococcus, histoplasma, lymphoma, IRIS, drugs</td></tr></table>
      <div class="muted" style="margin-top:4px">Fever = 38.3 °C (101 °F) or more. Oral readings run about 0.4 °C below core. Older people may mount lower temperatures: a rise of 1.1 °C over baseline counts.</div></details>`;
}

function drawClues(x) {
  const rows = x.lc.map((l) => `<tr class="${l.tone === "urgent" ? "match" : ""}"><td><b>${esc(l.text)}</b></td><td class="wrap">${esc(l.why)}</td></tr>`).join("");
  const chartFlags = ["valve", "device", "ivdu", "immuno", "hiv", "cancerHx", "cirrhosis", "anticoag", "hbDrop", "relBrady", "steroidStop", "priorAbx", "neuroEvent", "hematuria"].filter((k) => x.x[k] && !$$(".clue:checked").some((e) => e.value === k)).map((k) => esc(x.x[k]));
  const devices = chartFlags.length ? ul(chartFlags) : '<div class="muted">None found on the problem list or orders.</div>';
  $("cluesum").textContent = `${x.lc.length} lab clue${x.lc.length === 1 ? "" : "s"}`;
  $("clues").innerHTML = `<div class="mini"><div><div class="ttl">Lab clues (latest 7 days)</div>${rows ? `<div class="scroll"><table class="ref">${rows}</table></div>` : '<div class="muted">No abnormal lab clue found.</div>'}</div>
    <div><div class="ttl">From the problem list, orders and vitals</div>${devices}<div class="ttl" style="margin-top:8px">Your bedside ticks</div>${$$(".clue:checked").length ? ul($$(".clue:checked").map((e) => esc(TICK_LABEL[e.value]))) : '<div class="muted">None ticked: the history and exam give the most useful clues (Patient and situation).</div>'}</div></div>
    <details style="margin-top:8px"><summary><b>Clues worth asking about (Bleeker-Rovers "potentially diagnostic clues")</b></summary>${ul([
      "Travel, animals (farm, pets, birds), food (unpasteurized milk, raw meat), hobbies (hunting, caving), sexual history, drug use, TB contacts, country of birth",
      "Every medicine, supplement and over-the-counter drug started in the past 2 months",
      "Dental work, surgery, devices, prosthetic valve or joint",
      "Exam repeated every few days: temporal arteries, eyes (fundi, conjunctivae), sinuses, teeth, thyroid, every node group, heart murmur, liver, spleen, prostate (rectal), testes, spine, joints, skin and nails",
      "Family history of periodic fevers; ethnicity (FMF: Mediterranean, Armenian, Turkish, Jewish)"])}</details>`;
}

function drawDrugs(x) {
  const rows = x.df.map((d) => `<tr class="${d.fits ? "match" : ""}"><td class="wrap">${esc(d.text)}</td><td>${esc(d.cls)}</td><td class="num">${d.startedDaysBeforeFever != null ? d.startedDaysBeforeFever + " d" : "?"}</td><td>${d.fits === true ? '<span class="chip c-no">fits</span>' : d.fits === false ? '<span class="chip c-yes">timing less typical</span>' : '<span class="chip c-unknown">start date ?</span>'}</td></tr>`).join("");
  $("drugsum").textContent = x.df.length ? `${x.df.length} possible` : "none";
  $("drugs").innerHTML = (rows ? `<div class="scroll"><table><tr><th>Medicine</th><th>Group</th><th>Started before fever</th><th>Timing</th></tr>${rows}</table></div>` : '<div class="muted">No usual drug-fever culprit on the active list. Ask about supplements and recently stopped drugs.</div>') +
    `<div style="margin-top:8px">${ul(["Typical onset 7-10 days after starting (range: hours on re-exposure to weeks; can start after months).",
      "Often looks well for the temperature; pulse-temperature deficit, eosinophilia, rash and mild liver test rise support it, but are often absent.",
      "Test: stop the suspected drug. Fever usually goes within 48-72 h (longer for drugs with long half-life or DRESS).",
      "DRESS: fever, rash, eosinophilia, atypical lymphocytes, liver/kidney injury 2-8 weeks after anticonvulsants, allopurinol, sulfonamides, vancomycin, minocycline.",
      "Fever with rigidity and high CK on an antipsychotic or metoclopramide: neuroleptic malignant syndrome. With clonus and agitation on serotonergic drugs: serotonin syndrome. Both are emergencies."].map(esc))}</div>`;
}

function drawDdx(x) {
  $("ddxsum").textContent = x.ddx.length ? x.ddx.slice(0, 3).map((d) => d.name.split(" (")[0]).join(", ") : "no strong fit";
  $("ddx").innerHTML = x.ddx.length ? x.ddx.slice(0, 8).map((d, i) => `<details class="dd" ${i < 3 ? "open" : ""}><summary><span class="chip ${d.cat === "Infection" ? "c-unknown" : d.cat === "Cancer" ? "c-no" : d.cat === "Inflammatory" ? "c-yes" : ""}">${esc(d.cat)}</span> <b>${esc(d.name)}</b> <span class="muted">score ${d.score}</span></summary>
      <div class="ddb"><div><b>Why it fits:</b> ${d.hits.map((h) => esc(h.label) + (h.w >= 2 ? " <b>(strong)</b>" : "")).join("; ")}</div><div><b>Tests:</b> ${esc(d.tests)}</div>${d.consult ? `<div><b>Involve:</b> ${esc(d.consult)}</div>` : ""}</div></details>`).join("") +
      '<div class="muted" style="margin-top:6px">Ranked by how many of this patient\'s clues point to each cause (strong clues count double). This is a prompt, not a probability. Tick bedside clues in Patient and situation.</div>'
    : '<div class="muted">No cause has 2 or more matching clues. Tick the history and exam findings in Patient and situation, finish the stage 1 workup, then consider FDG PET-CT.</div>';
}
function drawAll() {
  const cat = $("catsel").value;
  const rows = R.DDX.filter((d) => !cat || d.cat === cat).map((d) => `<tr><td><b>${esc(d.name)}</b><div class="muted">${esc(d.cat)}</div></td><td class="wrap">${esc(Object.keys(d.clues).map((k) => TICK_LABEL[k] || CLUE_NAME[k] || k).join(", "))}</td><td class="wrap">${esc(d.tests)}</td></tr>`).join("");
  $("allddx").innerHTML = `<table class="ref"><tr><th>Cause</th><th>Clues</th><th>Tests and next step</th></tr>${rows}</table>`;
}
const CLUE_NAME = { posBC: "positive blood culture", valve: "valve disease/prosthesis", device: "device/line/prosthesis", esr100: "ESR 100+", esr50: "ESR 50+", monocytosis: "monocytosis", priorAbx: "antibiotics before cultures", anemia: "anemia",
  alp: "high ALP", dm: "diabetes", crp100: "CRP 100+", neutrophilia: "neutrophilia", posIGRA: "positive IGRA", lymphopenia: "lymphopenia", hypercal: "high calcium", immuno: "immunosuppression", hiv: "HIV", cytopenias: "cytopenias",
  transaminitis: "high ALT/AST", relBrady: "pulse-temperature deficit", eos: "eosinophilia", ferritin10k: "ferritin 10,000+", ferritin3k: "ferritin 3,000+", ldh: "high LDH", neutropenia: "neutropenia", cirrhosis: "cirrhosis",
  thrombocytosis: "high platelets", negANARF: "ANA and RF negative", age50: "age 50+", posANA: "positive ANA", drugFit: "drug timing fits", drugAny: "culprit drug on list", lowInflam: "normal ESR/CRP", cancerHx: "cancer history",
  lowTSH: "low TSH", adrenal: "low Na / high K", steroidStop: "steroid stopped", hyperTG: "high triglycerides", lowFib: "low fibrinogen", anticoag: "anticoagulant", hbDrop: "Hb drop", neuroEvent: "stroke/brain injury" };

function drawWorkup(x) {
  const stat = (w) => w.status === "done" ? '<span class="chip c-yes">done</span>' : w.status === "pending" ? '<span class="chip c-unknown">pending</span>' : w.status === "partial" ? '<span class="chip c-unknown">partial</span>' : w.status === "na" ? '<span class="chip">not needed</span>' : '<span class="chip c-no">not done</span>';
  const sel = (w) => `<select class="ovr" title="Mark: fix what the chart reader missed" data-id="${w.id}"><option value="">auto</option><option value="done" ${state.override[w.id] === "done" ? "selected" : ""}>done</option><option value="pending" ${state.override[w.id] === "pending" ? "selected" : ""}>pending</option><option value="na" ${state.override[w.id] === "na" ? "selected" : ""}>not needed</option></select>`;
  const table = (stage, onlyIndicated) => {
    const all = x.wu.filter((w) => w.stage === stage), isDone = (w) => w.status === "done" || w.status === "na";
    const hide = !!state.hideDone[stage], nDone = all.filter(isDone).length;
    const rows = all.filter((w) => !(hide && isDone(w))).map((w) => `<tr class="${!w.indicated ? "dim" : ""}"><td class="wrap"><b>${esc(w.t)}</b>${w.why ? ` <span class="muted">· ${esc(w.why)}</span>` : ""}${stage > 1 && !w.indicated ? ' <span class="muted">· not triggered yet</span>' : ""}</td><td class="wrap">${stat(w)} ${esc(w.text)}${w.rt ? ` <span class="muted">${ago(w.rt)}</span>` : ""}</td><td class="noprint">${sel(w)}</td></tr>`).join("");
    const tog = nDone ? `<label class="hidedone noprint"><input type="checkbox" class="hd" data-stage="${stage}" ${hide ? "checked" : ""}> Hide done (${nDone})</label>` : "";
    return `${tog}<div class="scroll"><table class="wk"><tr><th>Test</th><th>Status and result</th><th class="noprint">Mark</th></tr>${rows || '<tr><td colspan="3" class="muted">All done. Untick "Hide done" to see results.</td></tr>'}</table></div>`;
  };
  const n2 = x.wu.filter((w) => w.stage === 2 && w.indicated), n2d = n2.filter((w) => w.status === "done" || w.status === "na").length;
  $("w1sum").textContent = `${x.s1done}/${x.s1.length} done`; $("w2sum").textContent = `${n2.length} triggered, ${n2d} done`;
  $("w1").innerHTML = table(1) + '<div class="muted" style="margin-top:6px">Tests are found by name in the last 90 days of labs and 1 year of reports. "Mark" fixes anything the chart reader missed (kept only on this page).</div>';
  $("w2").innerHTML = table(2) + '<div class="muted" style="margin-top:6px">Stage 2 tests light up when a clue points to them. Greyed rows are not triggered by anything yet.</div>';
  $("w3").innerHTML = table(3) + `<div style="margin-top:8px">${ul(["<b>FDG PET-CT</b> after a negative stage 1 (and CT): finds the cause or a biopsy target in about half to two-thirds of classic FUO; best yield with raised ESR/CRP, before steroids and in older patients. A normal PET-CT predicts a good outcome.",
    "<b>Biopsy</b> the most accessible abnormal site: excisional node (not FNA) for lymphoma; temporal artery for GCA; marrow with cultures for cytopenias, HLH or miliary TB; liver for granulomas when ALP is high and imaging is unhelpful.",
    "<b>Not recommended</b> routinely: blind liver biopsy, ACE level, 'fever panels' of many serologies without a clue, tagged-WBC scan when PET-CT is available."])}</div>`;
  $$(".hd").forEach((c) => (c.onchange = () => { state.hideDone[c.dataset.stage] = c.checked; draw(); }));
  $$(".ovr").forEach((s) => (s.onchange = () => { if (s.value) state.override[s.dataset.id] = s.value; else delete state.override[s.dataset.id]; draw(); }));
}

function drawScores(x) {
  $("hssum").textContent = `${x.hs.score} (${x.hs.band})`;
  $("hs").innerHTML = `<div class="verdict ${x.hs.positive ? "t3" : x.hs.score > 90 ? "t2" : "t0"}"><div class="big">HScore ${x.hs.score}: HLH ${esc(x.hs.band)}</div><div>${esc(x.hs.text)}</div></div>
    <table>${x.hs.items.map((i) => `<tr><td>${esc(i[0])}</td><td class="num">${i[1]}</td></tr>`).join("")}</table>
    <div class="muted" style="margin-top:6px">Organomegaly comes from your Splenomegaly/Hepatomegaly ticks (or imaging). Cytopenia cut-offs: Hb 92 or less, WBC 5.0 or less, platelets 110 or less. Fardet L et al. Arthritis Rheumatol 2014. HLH-2004: 5 of 8 (fever, splenomegaly, 2+ cytopenias, high TG or low fibrinogen, hemophagocytosis, low/absent NK activity, ferritin 500+, sIL-2R 2400+).</div>`;
  $("yamsum").textContent = `${x.yam.total} (${x.yam.nMaj} major)${x.yam.meets ? ": meets" : ""}`;
  const li = (a) => a.map(([t, v]) => `<li class="${v ? "have" : "miss"}">${v ? "✓" : "✗"} ${esc(t)}</li>`).join("");
  $("yam").innerHTML = `<div class="verdict ${x.yam.meets ? "t2" : "t1"}"><div>${esc(x.yam.text)}</div></div><div class="mini"><div><div class="ttl">Major</div><ul class="check">${li(x.yam.major)}</ul></div><div><div class="ttl">Minor</div><ul class="check">${li(x.yam.minor)}</ul></div></div>
    <div class="muted">Filled from the fever curve (39 °C for a week), your ticks (joint pain, salmon rash, sore throat, nodes/spleen) and labs (WBC with neutrophil %, ALT/AST, ANA and RF). Ferritin is not a Yamaguchi criterion but is usually very high; glycosylated ferritin under 20% supports Still's. Watch for macrophage activation syndrome (HScore).</div>`;
  $("gcasum").textContent = x.gca.entry ? `${x.gca.score} points${x.gca.meets ? ": meets" : ""}` : "age under 50";
  $("gcaout").innerHTML = `<div class="verdict ${x.gca.meets ? "t2" : "t1"}">${esc(x.gca.text)}</div><table>${x.gca.items.map(([t, v, p]) => `<tr><td>${v ? "✓" : "✗"} ${esc(t)}</td><td class="num">+${p}</td></tr>`).join("")}</table>
    <div class="muted" style="margin-top:6px">ESR/CRP item is filled from the highest value in 90 days. Ponte C et al. 2022 ACR/EULAR GCA classification criteria (Ann Rheum Dis 2022). In older adults GCA can present as fever alone, with no headache.</div>`;
}

function drawTx(x) {
  $("tx").innerHTML = box("urgent", "Treat now (exceptions to waiting)", x.tx.now.map(esc)) + box("action", "Avoid in stable classic FUO", x.tx.avoid.map(esc)) + box("", "Also", x.tx.why.map(esc)) +
    `<h3>Who to involve</h3>${x.cons.length ? `<table class="ref"><tr><th>Service</th><th>When</th><th>Why</th></tr>${x.cons.map((c) => `<tr><td><b>${esc(c.who)}</b></td><td>${esc(c.when)}</td><td>${esc(c.why)}</td></tr>`).join("")}</table>` : '<div class="muted">No consult flagged yet. ID is a good first call for classic FUO once stage 1 is done.</div>'}
    <div class="muted" style="margin-top:6px">The Consult button (bottom right) builds your message to the specialist with the patient's name, age and MRN.</div>`;
}

function drawFU(x) {
  $("fu").innerHTML = ul(["Discharge before a diagnosis is reasonable if stable, eating and drinking, and a plan is in place: who follows the pending tests (name the physician), and when the patient is seen again (1-2 weeks).",
    "List pending tests (cultures held for 2-3 weeks for slow organisms, AFB cultures 6-8 weeks, serologies, PET-CT, pathology) in the discharge summary with who will act on them.",
    "Ask the patient to keep a fever diary (time, temperature, what they took) and stop scheduled antipyretics so the pattern is visible.",
    "Re-take the history and repeat the exam at follow-up: new clues appear with time (nodes, rash, murmur, joint swelling).",
    "If everything incl. PET-CT is negative and the patient is well: most undiagnosed FUO resolves within months and the outlook is good. Avoid empiric steroids; NSAIDs for comfort.",
    x.cons.length ? "Outpatient follow-up with: " + x.cons.map((c) => c.who).join(", ") + "." : "",
    "Referral to the South Island Discharge Clinic (RJH) may fit if the patient needs a close early review while results come back."].map(esc));
}

function handoutHTML(x) {
  const pend = $("h-pend").value.trim(), fu = $("h-fu").value.trim(), ph = $("h-phone").value.trim();
  const extra = [];
  if (x && x.gcaSuspect) extra.push("You are being checked for <b>giant cell arteritis</b> (inflamed arteries in the head). <b>Call 911 or go to the ER right away</b> for any loss of vision, double vision or a curtain over one eye, even if it gets better. Do not stop prednisone suddenly.");
  if (x && (x.type.kind === "neutropenic" || has("chemo"))) extra.push("Your white cell count is low or you are on chemotherapy: <b>a temperature of 38.3 °C, or 38.0 °C for an hour, means go to the ER now</b> and tell them you are on chemotherapy.");
  if (x && x.x.drugFit) extra.push("A medicine may be causing your fever and was stopped. <b>Do not restart it</b> unless your doctor says so. Go to the ER for a spreading rash, blisters, peeling skin or sores in the mouth or eyes.");
  if (x && (x.x.valve || x.x.murmur)) extra.push("You are being checked for an infection of the heart valve. Go to the ER for sudden weakness or trouble speaking, sudden shortness of breath, or chest pain.");
  return `<h2>Fever that has not been explained yet</h2>
    <p>You have had fevers and the cause has not been found yet. This is common, and most people with an unexplained fever do well. The tests take time, and finding the answer sometimes needs more than one visit.</p>
    <h3>Keep a fever diary</h3><ul><li>Check your temperature (by mouth) twice a day and whenever you feel feverish or have chills or sweats.</li><li>Write the date, time, temperature and anything you took for it (acetaminophen, ibuprofen).</li><li>Take fever medicine only when you need it, not on a schedule, so the doctor can see the fever pattern.</li><li>Bring the diary and all your medicine bottles, including supplements, to your next visit.</li></ul>
    ${pend ? `<h3>Tests still pending</h3><p>${esc(pend)}</p>` : ""}
    ${extra.length ? `<h3>Because of your situation</h3><ul>${extra.map((e) => "<li>" + e + "</li>").join("")}</ul>` : ""}
    <h3>Call 911 or go to the nearest ER if you have</h3><ul><li>Confusion, very hard to wake, or a seizure</li><li>Trouble breathing, or chest pain</li><li>Fainting, or feeling faint when you stand</li><li>A new rash of purple or dark red spots that do not fade when pressed</li><li>A severe headache with a stiff neck</li><li>Shaking chills with a fever of 39.5 °C or higher, or you cannot keep fluids down</li></ul>
    <h3>Call your doctor or clinic${ph ? " (" + esc(ph) + ")" : ""} within a day if</h3><ul><li>The fever pattern changes, or new symptoms appear: a lump, new joint swelling, a rash, cough, belly pain, back pain or pain when passing urine</li><li>You keep losing weight or have drenching night sweats</li></ul>
    ${fu ? `<h3>Your follow-up</h3><p>${esc(fu)}</p>` : ""}`;
}
function drawHandout(x) { $("handout").innerHTML = handoutHTML(x || state.lastX); if (x) state.lastX = x; }

function noteText(x) {
  const f = x.f, L = [];
  L.push(`FEVER OF UNKNOWN ORIGIN (${x.type.label}) - assessment`);
  L.push(`${f ? [f.age != null ? f.age + " y" : "", f.sex].filter(Boolean).join(" ") : "Patient"}; fever ${x.durationDays != null ? "for " + x.durationDays + " days" : "duration unknown"}${x.admittedDays != null ? ", in hospital " + x.admittedDays + " days" : ""}. Tmax ${x.fs.tmax ? x.fs.tmax.v + " °C" : "?"}; ${x.fs.feverDays} days with temperature 38.3 or more in the chart.`);
  if (x.type.why.length) L.push("Category: " + x.type.why.join("; ") + ".");
  const ab = x.lc.map((l) => l.text); if (ab.length) L.push("Key findings: " + ab.join("; ") + ".");
  const ticks = $$(".clue:checked").map((e) => TICK_LABEL[e.value]); if (ticks.length) L.push("History/exam: " + ticks.join("; ") + ".");
  if (x.df.length) L.push("Possible drug fever: " + x.df.slice(0, 3).map((d) => d.text + (d.startedDaysBeforeFever != null ? ` (started ${d.startedDaysBeforeFever} d before fever)` : "")).join("; ") + ".");
  L.push(`Workup: stage 1 ${x.s1done}/${x.s1.length} done.${x.s1.filter((w) => !w.status || w.status === "partial").length ? " Outstanding: " + x.s1.filter((w) => !w.status || w.status === "partial").map((w) => w.t.split(" (")[0].split(":")[0]).join(", ") + "." : ""}`);
  L.push(`HScore ${x.hs.score}${x.hs.miss.length ? " (partial)" : ""}.${x.yam.total >= 3 ? ` Yamaguchi ${x.yam.total} criteria (${x.yam.nMaj} major).` : ""}${x.gca.entry && x.gca.score ? ` GCA 2022 criteria ${x.gca.score} points.` : ""}`);
  L.push("");
  L.push("Differential (in order of fit): " + (x.ddx.length ? x.ddx.slice(0, 5).map((d) => d.name).join("; ") : "no localising clue yet") + ".");
  L.push("");
  L.push("Plan:");
  x.tx.now.forEach((t) => L.push("- " + t));
  x.wu.filter((w) => w.indicated && (!w.status || w.status === "partial")).sort((a, b) => a.stage - b.stage).slice(0, 8).forEach((w) => L.push("- " + w.t));
  if (has("abx") && !x.bcPos.length && !x.unstable) L.push("- Consider stopping empiric antibiotics and re-culturing if remains stable.");
  if (f && f.scheduledAntipyretic.length) L.push("- Change scheduled antipyretics to PRN to see the fever curve.");
  L.push("- Avoid empiric steroids and antibiotics while stable unless a specific indication arises.");
  x.cons.forEach((c) => L.push(`- ${c.who} (${c.when}): ${c.why}.`));
  L.push("- My decision: ");
  return L.join("\n");
}

/* ---------- load ---------- */
function autoTicks(preset) {
  const p = (preset && preset.sit) || {};
  $$(".clue").forEach((el) => (el.checked = (p.ticks || []).includes(el.value)));
  $("feverStart").value = p.feverStartDays ?? ""; $("admitted").value = p.admittedDays ?? "";
  $("poa").value = p.presentOnAdmission === true ? "yes" : p.presentOnAdmission === false ? "no" : "";
  $("unstable").checked = false; $("miliary").checked = false; $("hemophago").checked = false;
  const f = state.f;
  $("hs-immuno").checked = !!(f && (f.cls.immuno.length || f.cls.chemo.length || f.prob.transplant || f.prob.hiv || f.meds.some((m) => /methotrexate|tacrolimus|mycophenolate|azathioprine|rituximab|infliximab|adalimumab/i.test(m.text))));
  const g = p.gca || {}, ticks = new Set(p.ticks || []);
  $$(".gca").forEach((el) => (el.checked = !!g[el.value] || (el.value === "jawClaud" && ticks.has("jawClaud")) || (el.value === "headache" && ticks.has("headache")) || (el.value === "stiffness" && ticks.has("girdlePain"))));
  state.override = {};
  ["h-pend", "h-fu", "h-phone"].forEach((id) => ($(id).value = ""));
}
function load(raw, note, errors, preset) {
  state.f = raw ? C.parse(raw) : null;
  autoTicks(preset);
  $("pstatus").textContent = note; $("clear").hidden = !raw;
  $("errs").innerHTML = errors && errors.length ? "Could not read: " + errors.map(esc).join("; ") + (errors.some((e) => /\b40[13]\b|Unauthorized|Forbidden/i.test(e)) ? ". Check the scopes in the Code Console." : ". Cerner's sandbox can be slow: reload the patient to try again.") : "";
  draw();
}
document.addEventListener("change", (e) => { const t = e.target; if (t.id === "testsel" || t.classList.contains("ovr") || t.closest(".handout")) return; if (t.matches(".inputs input, .inputs select, .clue, .gca, #catsel")) draw(); });
document.addEventListener("input", (e) => { if (e.target.matches(".inputs input[type=number]")) draw(); });
["h-pend", "h-fu", "h-phone"].forEach((id) => ($(id).oninput = () => drawHandout()));
$("h-print").onclick = () => { const w = window.open("", "_blank"); if (!w) return; w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Fever that has not been explained yet</title><style>body{font:16px/1.5 system-ui,sans-serif;max-width:720px;margin:24px auto;padding:0 16px}h3{margin:16px 0 4px}</style></head><body>${handoutHTML(state.lastX)}</body></html>`); w.document.close(); w.focus(); };
$("copy").onclick = () => { $("note").select(); try { navigator.clipboard.writeText($("note").value); } catch (e) { document.execCommand("copy"); } };
$("clear").onclick = () => { $("testsel").value = ""; load(null, "Open from Cerner to read the chart, or pick a made-up patient:"); };
const SAMPLES = window.FUO_SAMPLES || [];
SAMPLES.forEach((p, i) => { const o = document.createElement("option"); o.value = i; o.textContent = p.label; $("testsel").appendChild(o); });
$("testsel").onchange = () => { const p = SAMPLES[$("testsel").value]; if (!p) return $("clear").onclick(); load(p.build(Date.now()), "Made-up patient: " + p.label, [], p); };

async function fromChart() {
  if (typeof FHIR === "undefined" || !(location.search.includes("code=") || location.search.includes("complete=") || sessionStorage.getItem("SMART_KEY"))) return;
  $("pstatus").textContent = "Reading the chart…";
  try {
    const client = await FHIR.oauth2.ready();
    const { raw, errors } = await C.gather(client, (msg) => ($("pstatus").textContent = msg));
    load(raw, "Chart read (read-only). Nothing is sent anywhere. Tick the history and exam clues above.", errors);
  } catch (e) { $("pstatus").textContent = "Could not read the chart: " + (e && e.message ? e.message : e) + ". The made-up patients still work."; }
}
const demo = new URLSearchParams(location.search).get("demo");
if (demo && SAMPLES[+demo - 1]) { $("testsel").value = String(+demo - 1); $("testsel").onchange(); } else { draw(); fromChart(); }
