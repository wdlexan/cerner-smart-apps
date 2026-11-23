/* Pleural effusion page. Read-only from the chart; your selections stay in this page. UNVERIFIED draft. */
const R = window.PleuralRules, C = window.PleuralChart, DAY = C.DAY, HR = C.HR;
const $ = (id) => document.getElementById(id);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const ago = (t) => { const h = (Date.now() - t) / HR; return h < 1 ? Math.max(1, Math.round(h * 60)) + " min ago" : h < 48 ? Math.round(h) + " h ago" : Math.round(h / 24) + " d ago"; };
const ul = (a) => "<ul>" + a.filter(Boolean).map((t) => "<li>" + t + "</li>").join("") + "</ul>";
const num = (id) => { const el = $(id); if (!el) return null; const v = parseFloat(el.value); return isFinite(v) ? v : null; };
const val = (id) => ($(id) ? $(id).value : "");
const chk = (id) => !!($(id) && $(id).checked);
const state = { f: null };
const has = (k) => !!(state.f && state.f.cls[k] && state.f.cls[k].length);
const prob = (k) => !!(state.f && state.f.prob[k]);
const box = (cls, h, items) => (items.length ? `<div class="${cls}"><h3>${h}</h3>${ul(items)}</div>` : "");
function tile(k, big, sub, tone) { return `<div class="tile ${tone || ""}"><div class="k">${k}</div><div class="big">${big}</div><div class="s">${sub || ""}</div></div>`; }

/* fluid inputs: id, label, unit, chart source [where, key] */
const FLUID_IN = [["p-prot", "Protein", "g/L", ["pf", "prot"]], ["p-ldh", "LDH", "U/L", ["pf", "ldh"]], ["p-glu", "Glucose", "mmol/L", ["pf", "glu"]], ["p-ph", "pH", "", ["pf", "ph"]],
  ["p-alb", "Albumin", "g/L", ["pf", "alb"]], ["p-tg", "Triglycerides", "mmol/L", ["pf", "tg"]], ["p-chol", "Cholesterol", "mmol/L", ["pf", "chol"]], ["p-hct", "Hematocrit", "%", ["pf", "hct"]],
  ["p-cr", "Creatinine", "umol/L", ["pf", "cr"]], ["p-amy", "Amylase", "U/L", ["pf", "amy"]], ["p-ada", "ADA", "U/L", ["pf", "ada"]], ["p-bnp", "NT-proBNP", "ng/L", ["pf", "bnp"]],
  ["p-wbc", "Nucleated cells", "×10⁶/L", ["pf", "wbc"]], ["p-n", "Neutrophils", "%", ["pf", "neutPct"]], ["p-ly", "Lymphocytes", "%", ["pf", "lymphPct"]], ["p-eo", "Eosinophils", "%", ["pf", "eosPct"]]];
const SERUM_IN = [["s-prot", "Protein", "g/L", ["l", "prot"]], ["s-ldh", "LDH", "U/L", ["l", "ldh"]], ["s-uln", "LDH upper limit", "U/L", null], ["s-alb", "Albumin", "g/L", ["l", "alb"]],
  ["s-glu", "Glucose", "mmol/L", ["l", "glu"]], ["s-hct", "Hematocrit", "L/L or %", ["l", "hct"]], ["s-cr", "Creatinine", "umol/L", ["l", "cr"]], ["s-amy", "Amylase", "U/L", ["l", "amy"]]];
const inp = ([id, lab, unit]) => `<label>${esc(lab)} <input type="number" step="any" id="${id}"> <span class="u">${esc(unit)}</span></label>`;
$("fluidin").innerHTML = `<fieldset><legend>Pleural fluid <span class="auto" id="pfwhen"></span></legend>${FLUID_IN.map(inp).join("")}
  <label>Appearance <select id="p-app"><option value="">?</option><option value="serous">Clear / straw</option><option value="turbid">Turbid</option><option value="bloody">Bloody</option><option value="pus">Frank pus</option><option value="milky">Milky</option></select></label>
  <label>Gram stain <select id="p-gram"><option value="">?</option><option value="neg">No organisms</option><option value="pos">Organisms seen</option></select></label>
  <label>Culture <select id="p-cult"><option value="">?</option><option value="neg">No growth</option><option value="pos">Positive</option></select></label>
  <label>Cytology <select id="p-cyto"><option value="">?</option><option value="neg">Negative</option><option value="atypical">Atypical / suspicious</option><option value="pos">Malignant</option></select></label></fieldset>
  <fieldset><legend>Blood (same day if possible)</legend>${SERUM_IN.map(inp).join("")}</fieldset>`;
$("trouble").innerHTML = '<option value="">Pick a problem…</option>' + Object.entries(R.TROUBLE).map(([k, v]) => `<option value="${k}">${esc(v.t)}</option>`).join("");
$("causecat").innerHTML = '<option value="">All causes</option><option>Transudate</option><option>Exudate</option>';

/* ---------- facts ---------- */
function facts() {
  const f = state.f, now = Date.now(), L = (id, d) => (f ? C.latest(f.l[id], (d || 3) * DAY, now) : null);
  const o = { pProt: num("p-prot"), pLDH: num("p-ldh"), pGlu: num("p-glu"), pH: num("p-ph"), pAlb: num("p-alb"), pTG: num("p-tg"), pChol: num("p-chol"), pHct: num("p-hct"), pCr: num("p-cr"), pAmy: num("p-amy"),
    ada: num("p-ada"), pBNP: num("p-bnp"), wbcFl: num("p-wbc"), neutPct: num("p-n"), lymphPct: num("p-ly"), eosPct: num("p-eo"),
    sProt: num("s-prot"), sLDH: num("s-ldh"), ldhULN: num("s-uln") || 250, sAlb: num("s-alb"), sGlu: num("s-glu"), bHct: num("s-hct"), sCr: num("s-cr"), sAmy: num("s-amy"),
    appearance: val("p-app"), gram: val("p-gram"), culture: val("p-cult"), cytology: val("p-cyto"), onDiuretic: has("diuretic"), hf: prob("hf") || val("context") === "hf" };
  const reps = f ? f.reports : [];
  const img = reps.map((r) => ({ ...r, finds: R.imaging(r.text + " " + r.name) }));
  const imgIds = new Set(img.flatMap((r) => r.finds.map((x) => x.id)));
  o.loculated = chk("loc") || imgIds.has("loculated") || imgIds.has("split");
  o.large = ["large", "massive"].includes(val("size"));
  const fl = R.fluid(o);
  const ctx = val("context"), purpose = val("purpose");
  const para = R.parapneumonic(o, fl.findings);
  const tapped = [o.pProt, o.pLDH, o.pGlu, o.pH].some((x) => x != null) || !!o.appearance;
  const age = f ? f.age : null;
  const urea = L("urea", 7), alb = L("alb", 7), anc = L("anc", 7), ly = L("lymph", 7);
  const rp = R.rapid({ urea: urea && urea.v, age, purulent: o.appearance === "pus", hospitalAcquired: chk("hosp"), albumin: alb && alb.v });
  const nlr = anc && ly && ly.v > 0 ? anc.v / ly.v : null;
  const ln = R.lent({ pLDH: o.pLDH, ecog: val("ecog") === "" ? null : +val("ecog"), nlr, tumour: val("tumour") });
  const tube = val("tubetype");
  const rm = R.removal({ purpose: { empyema: "empyema", parapneumonic: "parapneumonic", hemothorax: "hemothorax", pneumothorax: "pneumothorax", malignant: val("talc") === "yes" ? "pleurodesis" : "effusion" }[purpose] || "effusion",
    out24: num("out24"), bubbling: chk("bubbling"), lungExpanded: val("expanded") === "yes" ? true : val("expanded") === "no" ? false : null, sepsisSettled: chk("settled"), fluidLeft: chk("fluidleft"), daysIn: num("daysin") });
  const inr = L("inr", 3), plt = L("plt", 3), hbs = f && f.l.hb ? f.l.hb.filter((x) => now - x.t <= 2 * DAY) : [];
  // hemothorax surgery criteria from charted drain output
  const dr = f ? f.drain.filter((d) => now - d.t <= 2 * DAY) : [];
  const first = dr[0], later = dr.slice(1), over200 = later.filter((d) => d.v >= 200).length;
  const bleedCtx = purpose === "hemothorax" || ctx === "trauma" || fl.findings.some((g) => g.id === "hemothorax");
  const surg = bleedCtx && ((first && first.v >= 1500) || over200 >= 3);
  const infection = ctx === "pneumonia" || prob("pneumonia") || purpose === "empyema" || purpose === "parapneumonic" || fl.findings.some((g) => ["empyema", "infected", "lowpH"].includes(g.id) && !(g.id === "lowpH" && (ctx === "cancer" || ctx === "autoimmune")));
  const drSum = dr.length ? dr.reduce((a2, d) => a2 + d.v, 0) : null;
  const cl = R.clamp({ purpose, drained: num("c-drained") != null ? num("c-drained") : null, minutes: num("c-min"), symptoms: chk("c-sym"), bubbling: chk("bubbling"), lytics: chk("c-lytics"), large: ["large", "massive"].includes(val("size")), clampMin: +val("c-clampmin") || 60 });
  return { f, o, fl, para, ctx, purpose, tapped, img, imgIds, rp, ln, nlr, rm, tube, inr, plt, hbs, dr, surg, over200, age, infection, bleedCtx, cl, drSum };
}

/* ---------- alerts ---------- */
function alertsOf(x) {
  const A = [], add = (lvl, b, t) => A.push({ lvl, b, t }), ids = new Set(x.fl.findings.map((f) => f.id));
  if ((x.ctx === "cirrhosis" || prob("cirrhosis")) && (x.purpose === "hepatic" || x.fl.light.kind === "transudate") && (x.tube && x.tube !== "none" && x.tube !== "ipc" || x.purpose === "hepatic"))
    add("urgent", "Hepatic hydrothorax", "Avoid a chest tube: massive fluid and protein loss, kidney failure, infection, high mortality. Therapeutic tap, diuretics, TIPS / transplant referral (hepatology).");
  if ((ids.has("empyema") || ids.has("infected") || ids.has("lowpH")) && (!x.tube || x.tube === "none")) add("urgent", "Needs drainage", "Pus, organisms or pH under 7.2: chest tube now (12-14 F, ultrasound-guided) plus antibiotics.");
  if (x.infection && x.tube && x.tube !== "none" && chk("fluidleft") && !chk("settled")) add("action", "Residual infected collection", "Tube in but collection remains and infection not settling: flush/check the tube, then intrapleural tPA 10 mg + DNase 5 mg BID × 3 days or thoracic surgery (VATS).");
  if (x.cl.act === "now") add("urgent", "Clamp the chest tube", x.cl.label + ". " + x.cl.why[0]);
  if (x.cl.act === "never" && x.tube && x.tube !== "none") add("action", "Bubbling drain", "Do not clamp.");
  if (x.surg) add("urgent", "Hemothorax: surgery criteria", `${x.dr[0] && x.dr[0].v >= 1500 ? "1.5 L or more at insertion" : x.over200 + " hourly outputs of 200 mL or more"}: call thoracic surgery now; reverse anticoagulation; transfuse.`);
  if (ids.has("hemothorax") && !x.surg && x.bleedCtx) add("action", "Hemothorax", "Watch hourly output and Hb. Surgery if over 200 mL/h for 2-4 h or 1.5 L at insertion.");
  if (x.hbs.length >= 2 && x.hbs[0].v - x.hbs[x.hbs.length - 1].v >= 20) add("action", "Hb falling", `Hb ${x.hbs[0].v} → ${x.hbs[x.hbs.length - 1].v} in 48 h.`);
  if (has("anticoag")) add("action", "On anticoagulant", esc(state.f.cls.anticoag[0]) + ": hold for an elective chest tube (see Tap & tube); usually fine for an ultrasound-guided tap by an experienced operator.");
  if (has("antiplatelet")) add("info", "On P2Y12 inhibitor", esc(state.f.cls.antiplatelet[0]) + ": tap is fine; for an elective drain consider holding 5 days if safe.");
  if ((x.inr && x.inr.v > 1.5) || (x.plt && x.plt.v < 50)) add("action", "Bleeding risk", `INR ${x.inr ? x.inr.v : "?"}, platelets ${x.plt ? x.plt.v : "?"}. Tap under ultrasound is still usually reasonable; for a drain correct or discuss.`);
  if ((x.ctx === "pneumonia" || prob("pneumonia")) && x.tapped && x.o.pH == null && x.o.appearance !== "pus") add("action", "Parapneumonic without pH", "Send pleural pH on a blood gas analyser (no air, no lidocaine in the sample; not pH paper).");
  if ((x.ctx === "pneumonia" || prob("pneumonia")) && !x.tapped) add("action", "Parapneumonic effusion not tapped", "Any parapneumonic effusion over 10 mm deep on ultrasound needs a diagnostic tap.");
  if (x.ctx === "hf" && (val("side") === "left" || chk("fever") || chk("pleuritic"))) add("action", "Atypical for heart failure", "Unilateral left, fever or pleuritic pain: tap it, do not just diurese.");
  if (["large", "massive"].includes(val("size"))) add("info", "Large effusion", "Drain no more than about 1.5 L at a time; stop for chest tightness or cough (re-expansion edema).");
  if (x.o.pTG > 1.24 || (num("out24") || 0) > 1000) add("action", "High output", "Over 1 L/day: watch Na, albumin, creatinine and nutrition.");
  if (has("causative")) add("info", "Drug that can cause effusions", esc(state.f.cls.causative.join("; ")));
  if (ids.has("tb") || (chk("tbrisk") && x.o.lymphPct >= 50)) add("action", "TB possible", "Airborne precautions until pulmonary TB is excluded (sputum AFB ×3); pleural biopsy for culture.");
  if (chk("bubbling")) add("action", "Air leak", "Never clamp a bubbling tube.");
  if ((num("daysin") || 0) > 7) add("info", "Tube day " + num("daysin"), "Is it still needed? Infection risk rises with time.");
  if (ids.has("amylase") && x.o.pH != null && x.o.pH < 7.0) add("urgent", "Esophageal rupture?", "High amylase with pH under 7: CT with oral contrast, NPO, antibiotics + antifungal, thoracic surgery.");
  return A;
}

/* ---------- likely causes ---------- */
function likely(x) {
  const L = [], ids = new Set(x.fl.findings.map((f) => f.id)), k = x.fl.light.kind;
  const PROVEN = { "Parapneumonic effusion / empyema": ["empyema", "infected"], "Malignant effusion": ["malignant"], "TB pleuritis": ["tb"], Hemothorax: ["hemothorax"], Chylothorax: ["chylo"], Urinothorax: ["urino"], Pseudochylothorax: ["pseudochylo"] };
  const add = (n, why) => L.push({ n, why, w: (PROVEN[n] || []).some((i) => ids.has(i)) ? 2 : n === "Heart failure" && k === "pseudo" ? 2 : 1 });
  if (k === "pseudo" || ((k === "transudate" || k === "transudate?") && (x.ctx === "hf" || prob("hf")))) add("Heart failure", [prob("hf") ? "HF on problem list" : "", x.fl.light.notes.join("; ")].filter(Boolean).join("; "));
  if ((k.startsWith("transudate") || !x.tapped) && (x.ctx === "cirrhosis" || prob("cirrhosis"))) add("Hepatic hydrothorax", "cirrhosis" + (prob("ascites") ? " with ascites" : ""));
  if ((k.startsWith("transudate") || !x.tapped) && (prob("nephrotic") || prob("dialysis") || x.ctx === "kidney")) add("Kidney disease / nephrotic / dialysis", (state.f && (state.f.prob.nephrotic || state.f.prob.dialysis || state.f.prob.ckd || [""])[0]) || "kidney context");
  if (ids.has("empyema") || ids.has("infected") || ids.has("lowpH") || x.ctx === "pneumonia" || prob("pneumonia")) add("Parapneumonic effusion / empyema", x.para.label);
  if (ids.has("malignant") || ids.has("atypical") || x.ctx === "cancer" || prob("cancer") || x.imgIds.has("malignantPleura")) add("Malignant effusion", ids.has("malignant") ? "cytology positive" : prob("cancer") ? state.f.prob.cancer[0] : "pleural nodularity / cancer context");
  if (ids.has("tb") || (chk("tbrisk") && k === "exudate")) add("TB pleuritis", ids.has("tb") ? "high ADA" : "TB risk with an exudate");
  if (ids.has("hemothorax") || x.ctx === "trauma") add("Hemothorax", ids.has("hemothorax") ? "hematocrit ratio 0.5 or more" : "trauma");
  if (ids.has("chylo")) add("Chylothorax", "triglycerides over 1.24" + (prob("lymphoma") ? "; lymphoma" : ""));
  if (ids.has("pseudochylo")) add("Pseudochylothorax", "high cholesterol");
  if (ids.has("urino")) add("Urinothorax", "fluid/serum creatinine over 1");
  if (ids.has("amylase") || prob("pancreatitis")) add("Pancreatic or esophageal", "amylase / pancreatitis");
  if (x.ctx === "pe" || prob("pe")) add("Pulmonary embolism", "PE context");
  if (prob("ra") || prob("sle") || x.ctx === "autoimmune") add("Rheumatoid / lupus pleuritis", (state.f && (state.f.prob.ra || state.f.prob.sle || [""])[0]) || "autoimmune");
  if (prob("cabg") || x.ctx === "cardiac") add("Post-cardiac injury (post-CABG, Dressler)", "recent cardiac surgery/MI");
  if (has("causative")) add("Drug-induced", state.f.cls.causative.join("; "));
  if (prob("asbestos") || chk("asbestos")) add("Benign asbestos effusion / mesothelioma", "asbestos exposure");
  return L.map((l, i) => ({ ...l, i })).sort((a, b) => b.w - a.w || a.i - b.i);
}

/* ---------- draw ---------- */
function draw() {
  const x = facts(), lk = likely(x), ids = new Set(x.fl.findings.map((f) => f.id));
  const lt = x.fl.light;
  $("ptsum").textContent = state.f ? [state.f.sex, state.f.age != null ? state.f.age + " y" : "", val("side"), val("size")].filter(Boolean).join(", ") : "";
  const bleedTone = (x.inr && x.inr.v > 1.5) || (x.plt && x.plt.v < 50) || has("anticoag") ? "t2" : "t0";
  $("tiles").innerHTML = [
    tile("Fluid", { exudate: "Exudate", transudate: "Transudate", "transudate?": "Transudate?", pseudo: "Pseudo-exudate", unknown: x.tapped ? "Incomplete" : "Not tapped" }[lt.kind], lt.crit.length ? lt.crit.filter((c) => c.met).length + " of " + lt.crit.length + " Light's criteria" : "enter fluid and blood values", lt.kind === "exudate" ? "t2" : "t1"),
    tile("Likely cause", lk.length ? esc(lk[0].n) : "?", lk[1] ? "also: " + esc(lk[1].n) : "", "t1"),
    x.infection ? tile("Infection", x.para.label.replace(" effusion", "").replace("Parapneumonic: needs a diagnostic tap", "Tap needed?"), x.para.drain ? "DRAIN" : x.para.drain === false ? "antibiotics alone" : "", x.para.drain ? "t3" : "t0")
      : tile("Infection", "Not suspected", "set Context to pneumonia if it is", "t0"),
    tile("Bleeding risk", has("anticoag") ? "Anticoagulated" : (x.inr && x.inr.v > 1.5) || (x.plt && x.plt.v < 50) ? "Check" : "Low", `INR ${x.inr ? x.inr.v : "?"} · plt ${x.plt ? x.plt.v : "?"}`, bleedTone),
    tile("Chest tube", x.tube && x.tube !== "none" ? x.rm.label : "None", x.tube && x.tube !== "none" ? (num("out24") != null ? num("out24") + " mL/24 h" : "enter output") : esc(R.tubeChoice(x.purpose || "parapneumonic").pick.split("(")[0]), x.tube && x.tube !== "none" ? (x.rm.ready ? "t0" : "t1") : "t1"),
    x.purpose === "malignant" || ids.has("malignant") ? tile("LENT", x.ln.score, x.ln.band + " risk", x.ln.band === "high" ? "t3" : x.ln.band === "moderate" ? "t2" : "t0")
      : x.infection ? tile("RAPID", x.rp.score, x.rp.band + " risk", x.rp.band === "high" ? "t3" : x.rp.band === "medium" ? "t2" : "t0") : ""].join("");
  const A = alertsOf(x);
  $("alertsum").textContent = A.length ? `${A.filter((a) => a.lvl === "urgent").length} urgent, ${A.length} total` : "none";
  $("alerts").innerHTML = A.length ? A.map((a) => `<div class="alert ${a.lvl}"><b>${a.b}:</b>${a.t}</div>`).join("") : '<div class="muted">No alerts.</div>';
  drawPlan(x, lk); drawFluid(x); drawCauses(x, lk); drawImaging(x); drawTap(x); drawTube(x); drawClamp(x); drawTrouble(); drawRemoval(x); drawInfection(x); drawMalignant(x); drawFU(x, lk); drawHandout();
  $("note").value = noteText(x, lk);
  state.lastX = x;
}

function drawPlan(x, lk) {
  const urgent = [], now = [], next = [], ids = new Set(x.fl.findings.map((f) => f.id));
  alertsOf(x).filter((a) => a.lvl === "urgent").forEach((a) => urgent.push(`<b>${a.b}:</b> ${a.t}`));
  if (!x.tapped) {
    if (x.ctx === "hf" && val("side") !== "left" && !chk("fever")) now.push("Typical heart failure picture: diurese and re-image in about 3 days. Tap if it does not shrink or is atypical.");
    else now.push("Diagnostic ultrasound-guided tap (and therapeutic if breathless: up to 1.5 L). Send the panel in 'What to send'.");
  } else {
    now.push(`Fluid: <b>${esc(x.fl.light.label)}</b>${x.fl.light.notes.length ? " (" + esc(x.fl.light.notes.join("; ")) + ")" : ""}.`);
    x.fl.findings.filter((f) => f.tone !== "info").forEach((f) => now.push(`<b>${esc(f.text)}:</b> ${esc(f.why)}`));
  }
  if (x.infection) next.push(`<b>${esc(x.para.label)}:</b> ${esc(x.para.text)}`);
  if (x.purpose) { const tc = R.tubeChoice(x.purpose); next.push(`<b>Drain:</b> ${esc(tc.pick)}. ${esc(tc.why)}`); }
  if (x.tube && x.tube !== "none") next.push(`<b>Tube removal:</b> ${esc(x.rm.label)}${x.rm.no.length ? " (" + esc(x.rm.no[0]) + ")" : ""}.`);
  if (x.fl.light.kind === "exudate" && !lk.length) next.push("Unexplained exudate: contrast CT chest (pleural phase) before draining it dry, then image-guided or thoracoscopic pleural biopsy.");
  $("plansum").textContent = lk.length ? lk[0].n : "";
  $("plan").innerHTML = box("urgent", "Urgent", urgent) + box("action", "Now", now) + box("", "Next", next);
}

function drawFluid(x) {
  const lt = x.fl.light, f = state.f;
  const crit = lt.crit.map((c) => `<tr><td>${c.met ? "✓" : "✗"} ${esc(c.t)}</td><td class="num">${c.v}</td></tr>`).join("");
  $("fluidsum").textContent = lt.label;
  $("pfwhen").textContent = f && f.pf.prot ? "from the chart " + ago(f.pf.prot[f.pf.prot.length - 1].t) + " (type over any value)" : "type values (none found in the chart)";
  $("fluid").innerHTML = `<div class="verdict ${lt.kind === "exudate" ? "t2" : lt.kind === "unknown" ? "" : "t1"}"><div class="big">${esc(lt.label)}</div>${lt.miss.length ? `<div>Missing: ${esc(lt.miss.join(", "))}</div>` : ""}${lt.notes.length ? ul(lt.notes.map(esc)) : ""}</div>
    ${crit ? `<table>${crit}</table><div class="muted">Any one criterion = exudate (Light 1972). LDH upper limit defaults to 250 U/L: type your lab's value.</div>` : ""}
    <h3 style="font-size:14px;margin:12px 0 4px">What the fluid says</h3>
    ${x.fl.findings.length ? x.fl.findings.map((g) => `<div class="alert ${g.tone}"><b>${esc(g.text)}:</b>${esc(g.why)}</div>`).join("") : '<div class="muted">No specific finding yet.</div>'}
    <details style="margin-top:8px"><summary><b>Reference cut-offs (SI)</b></summary><table class="ref">
      <tr><th>Test</th><th>Cut-off</th><th>Means</th></tr>
      <tr><td>pH (blood gas analyser)</td><td>under 7.2</td><td>Drain a parapneumonic effusion. 7.2-7.4: drain if LDH over 900, loculated or large</td></tr>
      <tr><td>Glucose</td><td>under 3.3 mmol/L (under 1.6 very low)</td><td>Empyema, RA, TB, malignancy, lupus, esophageal rupture</td></tr>
      <tr><td>LDH</td><td>over 1000 U/L</td><td>Empyema, RA, malignancy</td></tr>
      <tr><td>Albumin gradient (serum - pleural)</td><td>over 12 g/L</td><td>Transudate despite Light's (diuresed HF)</td></tr>
      <tr><td>Pleural NT-proBNP</td><td>over 1500 ng/L</td><td>Heart failure</td></tr>
      <tr><td>Triglycerides</td><td>over 1.24 mmol/L (0.56-1.24 indeterminate)</td><td>Chylothorax</td></tr>
      <tr><td>Cholesterol</td><td>over 5.18 mmol/L</td><td>Pseudochylothorax</td></tr>
      <tr><td>Hematocrit ratio (pleural/blood)</td><td>0.5 or more</td><td>Hemothorax</td></tr>
      <tr><td>ADA</td><td>over 40 U/L</td><td>TB (with lymphocytes); also empyema, lymphoma, RA</td></tr>
      <tr><td>Creatinine ratio (pleural/serum)</td><td>over 1</td><td>Urinothorax</td></tr>
      <tr><td>Eosinophils</td><td>10% or more</td><td>Air/blood in pleura, drugs, parasites, EGPA, asbestos</td></tr>
      <tr><td>Lymphocytes</td><td>50% or more</td><td>Malignancy, TB, HF, post-CABG, lymphoma, chylothorax</td></tr></table></details>`;
  $("send").innerHTML = ul(["<b>Always:</b> protein, LDH (with blood protein and LDH the same day), glucose, cell count with differential, Gram stain and culture (put 5-10 mL in aerobic and anaerobic blood culture bottles as well as a sterile pot), cytology 25-50 mL (more adds little).",
    "<b>pH</b> if not frankly purulent: heparinised syringe, no air, no lidocaine, run on the blood gas analyser (pH paper and pH meters are unreliable).",
    "<b>If HF suspected:</b> albumin (with blood albumin) and/or NT-proBNP.", "<b>If milky:</b> triglycerides and cholesterol (lipoprotein electrophoresis if TG 0.56-1.24).",
    "<b>If bloody:</b> hematocrit with blood hematocrit.", "<b>If TB possible:</b> ADA, AFB smear/culture (low yield in fluid: pleural biopsy is better), lymphocyte count.",
    "<b>Selected:</b> amylase (pancreas, esophagus), creatinine (urinothorax), flow cytometry (lymphoma), beta-2 transferrin (CSF leak), glucose (peritoneal dialysis).",
    "<b>Not useful:</b> routine tumour markers in fluid, pleural fluid 'rheumatoid factor/ANA' panels, cholesterol in every tap."]);
}

function drawCauses(x, lk) {
  $("causesum").textContent = lk.length ? lk.map((l) => l.n).slice(0, 2).join(", ") : "";
  $("causes").innerHTML = lk.length ? `<table class="ref"><tr><th>Likely here</th><th>Why</th></tr>${lk.map((l) => `<tr><td><b>${esc(l.n)}</b></td><td>${esc(l.why)}</td></tr>`).join("")}</table>` : '<div class="muted">No cause suggested yet: set the context and enter the fluid results.</div>';
  const cat = val("causecat");
  $("allcauses").innerHTML = `<table class="ref"><tr><th>Cause</th><th>Clues</th><th>Management</th></tr>${R.CAUSES.filter((c) => !cat || c.cat === cat).map((c) => `<tr><td><b>${esc(c.name)}</b><div class="muted">${esc(c.cat)}</div></td><td>${esc(c.clue)}</td><td>${esc(c.tx)}</td></tr>`).join("")}</table>`;
}

function drawImaging(x) {
  const rows = x.img.slice().reverse().map((r) => `<tr><td>${r.t ? new Date(r.t).toLocaleDateString([], { month: "short", day: "numeric" }) : ""}</td><td class="wrap"><b>${esc(r.name)}</b><div class="muted">${esc(r.text)}</div></td><td class="wrap">${r.finds.map((g) => `<span class="chip ${/split|massive|hydroptx|trapped|malignant/.test(g.id) ? "c-no" : "c-unknown"}">${esc(g.label)}</span>`).join(" ")}</td></tr>`).join("");
  $("imgsum").textContent = x.img.length ? x.img.length + " report" + (x.img.length > 1 ? "s" : "") : "none";
  $("imgrep").innerHTML = rows ? `<div class="scroll"><table class="ref"><tr><th>Date</th><th>Report</th><th>Flags</th></tr>${rows}</table></div>` : '<div class="muted">No chest imaging reports found in a year.</div>';
}

function drawTap(x) {
  const ac = state.f ? state.f.cls.anticoag : [];
  $("tap").innerHTML = box(x.inr && x.inr.v > 1.5 || x.plt && x.plt.v < 50 || ac.length ? "action" : "", "This patient", [`INR ${x.inr ? x.inr.v : "?"}, platelets ${x.plt ? x.plt.v : "?"}${ac.length ? ", on " + esc(ac.join("; ")) : ""}${has("antiplatelet") ? ", on " + esc(state.f.cls.antiplatelet.join("; ")) : ""}.`]) +
    `<h3>Bleeding safety (BTS 2023 and common practice; follow local policy)</h3>${ul([
      "<b>Diagnostic or therapeutic tap with ultrasound by an experienced operator:</b> low bleeding risk. No need to correct mild coagulopathy routinely; many proceed with platelets over about 50 and INR up to about 2-3. Aspirin and prophylactic heparin: continue.",
      "<b>Elective chest tube:</b> hold apixaban/rivaroxaban/edoxaban 48 h (longer if CrCl under 30), dabigatran 48-96 h by CrCl, warfarin to INR 1.5 or less, therapeutic LMWH 24 h, UFH infusion 4-6 h, clopidogrel/ticagrelor 5 days, prasugrel 7 days (if the indication allows: discuss with cardiology for recent stents). Aim platelets over 50.",
      "<b>Urgent drain (empyema, tension, massive hemothorax):</b> do not delay for anticoagulant timing; correct what you can (reversal agent, platelets, vitamin K/PCC) and go."])}
    <h3>How much to drain</h3>${ul(["Stop at 1.5 L for a single tap, or earlier with chest tightness, cough or vasovagal symptoms.",
      "Chest tube on a large effusion: drain 1-1.5 L, clamp 1 h, then release; or limit to about 500 mL/h after the first litre.",
      "Contralateral mediastinal shift = expect good drainage. No shift with a large effusion, or shift toward it = trapped lung, bronchial obstruction or mesothelioma: drain cautiously; chest pain on drainage suggests non-expandable lung.",
      "Pleural manometry (if available): stop if pressure falls below -20 cmH2O."])}
    <h3>Ultrasound</h3>${ul(["Use ultrasound for every pleural procedure (BTS: mark the site and insert straight away, same position).", "Safe site: triangle of safety (mid-axillary line, above the 5th intercostal space) for drains; just above a rib to avoid the neurovascular bundle.",
      "Ultrasound depth over 10 mm is enough for a diagnostic tap; more than 3 cm fluid ideal for a drain."])}`;
}

function drawTube(x) {
  const tc = R.tubeChoice(x.purpose || "parapneumonic");
  $("tubesum").textContent = tc.pick.split("(")[0];
  $("tubechoice").innerHTML = `<div class="verdict t1"><div class="big">${esc(tc.pick)}</div><div>${esc(tc.why)}</div>${tc.alt ? `<div class="muted">${esc(tc.alt)}</div>` : ""}</div>
    <table class="ref"><tr><th>Option</th><th>Best for</th><th>Notes</th></tr>
      <tr><td><b>Therapeutic tap</b></td><td>Breathless transudate, first malignant effusion, short prognosis</td><td>Up to 1.5 L; repeat as needed. Shows whether breathing improves and whether the lung re-expands.</td></tr>
      <tr><td><b>Small-bore chest tube 10-14 F (Seldinger)</b></td><td>Pleural infection, most effusions, pneumothorax, talc slurry</td><td>Less pain; flush 20-30 mL saline every 6-8 h; fibrinolytics can go through it.</td></tr>
      <tr><td><b>Large-bore chest tube 24-32 F (blunt dissection)</b></td><td>Traumatic hemothorax, failed small-bore with thick pus, post-surgery, large air leak on a ventilator</td><td>More painful; needs blunt dissection training.</td></tr>
      <tr><td><b>Indwelling pleural catheter (IPC, tunnelled)</b></td><td>Recurrent malignant effusion, trapped lung, failed pleurodesis, refractory HF/kidney effusion (selected)</td><td>Outpatient drainage at home (home care, daily to 3 times a week); spontaneous pleurodesis in about half; infection about 5%.</td></tr>
      <tr><td><b>Talc pleurodesis</b></td><td>Malignant effusion with expandable lung and reasonable prognosis</td><td>Slurry 4 g via chest tube (premedicate, NSAIDs are OK) or thoracoscopic poudrage; about 70-80% success.</td></tr>
      <tr><td><b>VATS / decortication</b></td><td>Empyema failing tube + antibiotics + fibrinolytics, retained hemothorax, trapped lung from infection</td><td>Early referral (day 5-7) gives better results.</td></tr></table>`;
  $("lytics").innerHTML = ul(["<b>Indication:</b> pleural infection with a tube in place and residual or loculated collection after 24-48 h (MIST2), when surgery is not immediately planned or not suitable.",
    "<b>Dose:</b> alteplase (tPA) 10 mg in 30 mL saline + dornase alfa (DNase) 5 mg in 30 mL sterile water, given into the tube one after the other (or together), clamp 1 h, then unclamp; twice daily for 3 days (6 doses). Some centres use tPA 5 mg for bleeding risk.",
    "<b>Do not use</b> with a bronchopleural fistula (air leak), active bleeding, recent stroke or intracranial bleed, or as a substitute for surgery in fit patients with a thick peel.",
    "<b>Watch:</b> pleural bleeding (about 2-4%: blood in the drain, falling Hb), pain (give analgesia before), fluid output can rise sharply (that is the point).",
    "tPA alone or DNase alone does not work better than placebo; it is the combination."].map((t) => t));
  $("orders").innerHTML = ul(["Drain bottle below the chest, never clamp a bubbling tube, keep the tubing free of loops.", "Record output every 4-8 h (hourly for hemothorax), bubbling (yes/no, with cough), swinging, and site.",
    "Small-bore flushes: 20 mL saline every 6-8 h via three-way tap; subtract flush volume from output.", "Suction is not routine; -10 to -20 cmH2O if the lung does not re-expand or air leak persists.",
    "Daily CXR is not routine: image after insertion, if the clinical picture changes, and before removal decisions.", "Analgesia: regular acetaminophen, NSAID if safe, opioid PRN. Mobilise with the drain.",
    "Antibiotics are not needed for the drain itself (except trauma per local practice)."]);
}

function drawClamp(x) {
  const c = x.cl;
  $("clampsum").textContent = c.label;
  $("clamp").innerHTML = `<div class="verdict ${c.tone}"><div class="big">${esc(c.label)}</div>${ul(c.why.map(esc))}</div><ol>${c.steps.map((t) => "<li>" + esc(t) + "</li>").join("")}</ol>
    <details><summary><b>The rules (BTS 2023 clinical statement on pleural procedures)</b></summary>${ul([
      "In general, drain a maximum of 1.5 L in one attempt.",
      "Stop (clamp) for chest tightness, pain, persistent cough or worsening breathlessness. Clamp a drain promptly for repetitive coughing or chest pain: re-expansion pulmonary edema can be fatal.",
      "Large effusions are drained in a controlled way; observations every 15 min for the first hour (NHS rapid-offload safety alert).",
      "How long to clamp is a local choice (commonly about 1 h; some protocols 15-30 min with reassessment). Write the limit and clamp time on the drain order.",
      "Never clamp a bubbling drain. Do not clamp a hemothorax to slow bleeding. Pneumothorax drains are not clamped routinely.",
      "After intrapleural tPA/DNase: clamp 1 h after each dose (to keep the drugs in)."].map(esc))}</details>`;
}
function drawTrouble() {
  const k = val("trouble"), t = R.TROUBLE[k];
  $("troubleout").innerHTML = t ? `<div class="verdict ${t.urgent ? "t3" : "t1"}"><div class="big">${esc(t.t)}</div></div><ol>${t.steps.map((s) => "<li>" + esc(s) + "</li>").join("")}</ol>` : '<div class="muted">Pick a problem from the dropdown.</div>';
}

function drawRemoval(x) {
  const rm = x.rm;
  $("rmsum").textContent = x.tube && x.tube !== "none" ? rm.label : "no tube";
  $("removal").innerHTML = `<div class="verdict ${rm.ready ? "t0" : "t1"}"><div class="big">${esc(rm.label)}</div></div>
    <div class="mini"><div><div class="ttl">For removal</div>${rm.yes.length ? ul(rm.yes.map((t) => "✓ " + esc(t))) : '<div class="muted">nothing yet</div>'}</div><div><div class="ttl">Against removal</div>${rm.no.length ? ul(rm.no.map((t) => "✗ " + esc(t))) : '<div class="muted">nothing</div>'}</div></div>
    ${ul(rm.how.map(esc))}
    ${x.dr.length ? `<details><summary><b>Charted drain output (48 h)</b></summary><table>${x.dr.slice().reverse().map((d) => `<tr><td>${new Date(d.t).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</td><td class="num">${d.v} mL</td></tr>`).join("")}</table></details>` : ""}`;
}

function drawInfection(x) {
  const li = (a) => a.items.map((i) => `<tr><td>${esc(i[0])}</td><td class="num">${i[1]}</td></tr>`).join("");
  $("rapidsum").textContent = `${x.rp.score} (${x.rp.band})`;
  $("infection").innerHTML = (x.infection ? `<div class="verdict ${x.para.drain ? "t3" : "t1"}"><div class="big">${esc(x.para.label)}</div><div>${esc(x.para.text)}</div></div>` : '<div class="muted">Infection not suspected from the context or fluid. Set Context to "Pneumonia / infection" to apply the parapneumonic rules. The reference below still applies.</div>') + `
    <h3>Antibiotics (BTS 2023; adjust to culture, allergies and local ID guidance)</h3>${ul([
      "<b>Community-acquired:</b> amoxicillin-clavulanate (IV then PO), or ceftriaxone + metronidazole. Penicillin allergy: clindamycin alone or with ciprofloxacin/levofloxacin per local guidance.",
      "<b>Hospital-acquired / recent antibiotics:</b> piperacillin-tazobactam or meropenem; add vancomycin if MRSA risk.",
      "Cover anaerobes in all cases unless culture shows pneumococcus only. Avoid aminoglycosides (poor pleural penetration, inactivated by low pH). Macrolides only for atypical pneumonia.",
      "Switch to oral when fever settles and drainage is adequate. Duration: commonly 2-6 weeks total; about 2 weeks after drainage can be enough when drained well and responding (Porcel 2020). Follow CRP.",
      "Streptococcus anginosus group: often needs longer, look for other abscesses (brain, liver)."])}
    <h3>When to call thoracic surgery</h3>${ul(["Ongoing sepsis after 5-7 days of drainage + antibiotics (+ fibrinolytics)", "Residual collection that cannot be drained, thick peel with trapped lung", "Bronchopleural fistula, necrotising pneumonia", "Early: frankly purulent, heavily loculated in a fit patient (local practice varies)"])}
    <h3>RAPID score (3-month mortality)</h3><div class="mini"><div><table>${li(x.rp)}</table></div><div>${esc(x.rp.text)}</div></div>`;
}

function drawMalignant(x) {
  const li = x.ln.items.map((i) => `<tr><td>${esc(i[0])}</td><td class="num">${i[1]}</td></tr>`).join("");
  $("lentsum").textContent = `${x.ln.score} (${x.ln.band})`;
  $("malig").innerHTML = `<div class="mini"><div><table>${li}</table><div class="muted">NLR from blood counts${x.nlr ? " = " + Math.round(x.nlr * 10) / 10 : " (not found)"}. Pleural LDH from the fluid box.</div></div><div class="verdict ${x.ln.band === "high" ? "t3" : x.ln.band === "moderate" ? "t2" : "t0"}">${esc(x.ln.text)}</div></div>
    <h3>Plan</h3>${ul(R.mpePlan({ relief: val("relief") === "yes" ? true : val("relief") === "no" ? false : null, reexpand: val("reexpand") || "unknown", lentBand: x.ln.band }))}
    <h3>Diagnosis when cytology is negative</h3>${ul(["Cytology finds about 60% of malignant effusions (better for adenocarcinoma, poor for mesothelioma and lymphoma). A second sample adds little.",
      "Contrast CT chest (pleural phase) BEFORE draining to dryness: nodular, circumferential or mediastinal pleural thickening, or thickening over 1 cm, suggests malignancy.", "Then image-guided (CT/ultrasound) pleural biopsy or local anaesthetic thoracoscopy (can do talc at the same time).",
      "Send biopsy for molecular markers (EGFR, ALK, PD-L1 in lung; ER/PR/HER2 in breast)."])}`;
}

function drawFU(x, lk) {
  const L = [];
  const ids = new Set(x.fl.findings.map((f) => f.id));
  if (x.ctx === "pneumonia" || ids.has("empyema") || ids.has("lowpH")) L.push("Pleural infection: CXR (or ultrasound) and CRP in 2-4 weeks; respirology/ID clinic; antibiotics end date written down.");
  if (ids.has("malignant") || x.purpose === "malignant") L.push("Malignant effusion: oncology follow-up; IPC: home care drainage orders, supplies and an IPC clinic contact; palliative care if LENT high.");
  if (ids.has("tb")) L.push("TB pleuritis: public health notification, TB clinic, start/continue 6-month therapy; AFB cultures take 6-8 weeks.");
  if (x.fl.light.kind === "exudate" && !lk.length) L.push("Unexplained exudate: respirology follow-up with CT and consider thoracoscopy; repeat imaging in 6-8 weeks.");
  if (x.ctx === "hf" || x.fl.light.kind === "pseudo") L.push("Heart failure: diuretic plan, daily weights, follow-up CXR only if symptoms.");
  if (x.ctx === "cirrhosis" || prob("cirrhosis")) L.push("Hepatic hydrothorax: hepatology (TIPS/transplant assessment), sodium restriction, diuretic titration, plan for therapeutic taps.");
  L.push("List pending results in the discharge summary with who follows them: cytology, cultures, AFB cultures, flow cytometry, biopsy.");
  L.push("A CXR 6-8 weeks after a parapneumonic effusion or unexplained effusion makes sure it has resolved (and screens for an underlying cancer in smokers over 50).");
  $("fu").innerHTML = ul(L.map(esc));
}

function handoutHTML() {
  const kind = val("h-kind"), fu = $("h-fu").value.trim(), ph = $("h-phone").value.trim(), sched = $("h-sched").value.trim();
  const call911 = "<h3>Call 911 if you have</h3><ul><li>Severe shortness of breath or breathing that gets worse quickly</li><li>Chest pain or pressure</li><li>Coughing up more than a little blood</li><li>Fainting or feeling faint</li></ul>";
  const phone = ph ? ` (${esc(ph)})` : "";
  const H = {
    tap: `<h2>After your pleural tap or chest tube removal</h2><p>Fluid was removed from around your lung. A small dressing covers the site.</p><ul><li>Keep the dressing on and dry for 48 hours, then you can shower.</li><li>Some soreness for a few days is normal: acetaminophen helps.</li><li>Some people cough for a while after the lung re-expands. This settles.</li></ul>${call911}<h3>Call your doctor or clinic${phone} or go to the ER if</h3><ul><li>Fever, or redness, swelling or pus at the site</li><li>Fluid leaking through the dressing for more than a day</li><li>Your breathing gets worse again over days (the fluid may be coming back)</li></ul>`,
    ipc: `<h2>Going home with an indwelling pleural catheter (IPC)</h2><p>A soft tube stays in your chest so fluid can be drained at home without coming to hospital.</p><ul><li>Drainage: ${sched ? esc(sched) : "as your team arranged (often every 1-3 days) by home care nurses or a trained family member"}.</li><li>Drain no more than 1 litre at a time. Stop if you get chest pain, tightness or coughing.</li><li>Keep the dressing clean and dry; it is changed with each drainage. Cover it to shower (no baths or swimming).</li><li>Write down how much drains each time. If it is very little three times in a row and you feel well, tell your team: the catheter may be ready to come out.</li></ul>${call911}<h3>Call your IPC clinic or home care${phone} the same day if</h3><ul><li>Fever, chills, or redness, warmth, pain or pus around the catheter</li><li>The catheter is damaged, leaks, or partly comes out (cover it and call)</li><li>No fluid drains but you are getting more breathless</li><li>The fluid becomes cloudy, bloody or smells bad</li></ul>`,
    infection: `<h2>Going home after a chest infection with fluid (empyema)</h2><ul><li>Take every dose of your antibiotic until ${$("h-abx").value.trim() ? esc($("h-abx").value.trim()) : "the date your team gave you"}, even if you feel better.</li><li>Tiredness and some chest discomfort can last a few weeks. Walk a little more each day.</li><li>You will have a chest X-ray and blood test in 2-4 weeks to check the infection has cleared.</li></ul>${call911}<h3>Call your doctor${phone} or go to the ER if</h3><ul><li>Fever comes back, or you get night sweats or shaking chills</li><li>More cough, more phlegm, or worse breathing</li><li>You cannot keep the antibiotic down, or get severe diarrhea</li><li>Redness or pus where the drain was</li></ul>` }[kind] || "";
  return H + (fu ? `<h3>Your follow-up</h3><p>${esc(fu)}</p>` : "");
}
function drawHandout() { $("handout").innerHTML = handoutHTML(); }

function noteText(x, lk) {
  const f = x.f, o = x.o, Lx = [];
  Lx.push(`PLEURAL EFFUSION - ${[val("side"), val("size")].filter(Boolean).join(", ") || "side/size not set"}`);
  Lx.push(`${f ? [f.age != null ? f.age + " y" : "", f.sex].filter(Boolean).join(" ") : "Patient"}.${x.ctx ? " Context: " + $("context").selectedOptions[0].text + "." : ""}`);
  const imgF = x.img.length ? x.img[x.img.length - 1] : null; if (imgF) Lx.push(`Imaging (${imgF.name}): ${imgF.text}`);
  if (x.tapped) {
    const v = (lab, val, u) => (val != null && val !== "" ? `${lab} ${val}${u ? " " + u : ""}` : "");
    Lx.push("Fluid: " + [o.appearance, v("protein", o.pProt, "g/L"), v("LDH", o.pLDH, "U/L"), v("glucose", o.pGlu, "mmol/L"), v("pH", o.pH), v("albumin", o.pAlb, "g/L"), v("TG", o.pTG), v("Hct", o.pHct, "%"), v("ADA", o.ada), v("NT-proBNP", o.pBNP),
      v("cells", o.wbcFl), v("neut", o.neutPct, "%"), v("lymph", o.lymphPct, "%"), o.gram ? "Gram " + o.gram : "", o.culture ? "culture " + o.culture : "", o.cytology ? "cytology " + o.cytology : ""].filter(Boolean).join(", ") + ".");
    Lx.push(`Blood: protein ${o.sProt ?? "?"}, LDH ${o.sLDH ?? "?"} (ULN ${o.ldhULN}), albumin ${o.sAlb ?? "?"}.`);
    Lx.push(`Light's: ${x.fl.light.label}${x.fl.light.crit.length ? " (" + x.fl.light.crit.map((c) => (c.met ? "+" : "-") + c.t.split(" over")[0] + " " + c.v).join("; ") + ")" : ""}.${x.fl.light.notes.length ? " " + x.fl.light.notes.join("; ") + "." : ""}`);
    x.fl.findings.forEach((g) => Lx.push(`- ${g.text}: ${g.why}`));
  } else Lx.push("Not yet tapped.");
  Lx.push("");
  Lx.push("Impression: " + (lk.length ? lk.map((l) => l.n).join("; ") : "cause not yet clear") + ".");
  if (x.infection) Lx.push(`${x.para.label}. RAPID ${x.rp.score} (${x.rp.band}).`);
  if (x.purpose === "malignant" || x.fl.findings.some((g) => g.id === "malignant")) Lx.push(`LENT ${x.ln.score} (${x.ln.band}).`);
  Lx.push("");
  Lx.push("Plan:");
  if (x.purpose) Lx.push("- Drainage: " + R.tubeChoice(x.purpose).pick + ".");
  if (x.para.drain) Lx.push("- " + x.para.text);
  if (x.tube && x.tube !== "none") Lx.push(`- Chest tube (${$("tubetype").selectedOptions[0].text}), day ${num("daysin") ?? "?"}, output ${num("out24") ?? "?"} mL/24 h, ${chk("bubbling") ? "bubbling" : "no air leak"}. Removal: ${x.rm.label}${x.rm.no.length ? " - " + x.rm.no.join("; ") : ""}.`);
  if (x.tube && x.tube !== "none" && x.cl.act !== "drain") Lx.push(`- Clamping: ${x.cl.label}. ${x.cl.steps[0]}`);
  alertsOf(x).filter((a) => a.lvl !== "info").forEach((a) => Lx.push(`- ${a.b}: ${a.t.replace(/<[^>]+>/g, "")}`));
  Lx.push("- My decision: ");
  return Lx.join("\n");
}

/* ---------- load ---------- */
function autoFill(preset) {
  const p = (preset && preset.sit) || {}, f = state.f;
  const latestOf = (src) => { if (!f || !src) return ""; const a = f[src[0]][src[1]]; return a && a.length ? a[a.length - 1].v : ""; };
  FLUID_IN.concat(SERUM_IN).forEach(([id, , , src]) => { $(id).value = latestOf(src); $(id).classList.toggle("typed", false); });
  $("s-uln").value = "";
  const tx = (k) => (f && f.pft[k] && f.pft[k].length ? f.pft[k][f.pft[k].length - 1].text : "");
  $("p-app").value = C.appearanceRead(tx("appearance")); $("p-gram").value = C.microRead(tx("gram")); $("p-cult").value = C.microRead(tx("culture")); $("p-cyto").value = C.cytoRead(tx("cyto"));
  const ctx = p.context || (f ? (f.prob.pneumonia ? "pneumonia" : f.prob.cirrhosis ? "cirrhosis" : f.prob.hf ? "hf" : f.prob.cancer ? "cancer" : f.prob.trauma ? "trauma" : f.prob.pe ? "pe" : f.prob.dialysis || f.prob.nephrotic ? "kidney" : f.prob.cabg ? "cardiac" : f.prob.ra || f.prob.sle ? "autoimmune" : "") : "");
  $("context").value = ctx; $("side").value = p.side || ""; $("size").value = p.size || "";
  const rep = f && f.reports.length ? f.reports.map((r) => r.text).join(" ").toLowerCase() : "";
  if (!p.side && rep) $("side").value = /bilateral/.test(rep) ? "bilateral" : /right[^.]*effusion/.test(rep) ? "right" : /left[^.]*effusion/.test(rep) ? "left" : "";
  if (!p.size && rep) $("size").value = /massive|white.?out/.test(rep) ? "massive" : /large[^.]*effusion/.test(rep) ? "large" : /moderate[^.]*effusion/.test(rep) ? "moderate" : /small[^.]*effusion/.test(rep) ? "small" : "";
  $("sympt").checked = !!p.sympt; $("fever").checked = !!p.fever; $("pleuritic").checked = false; $("tbrisk").checked = !!p.tbRisk || !!(f && f.prob.tb); $("asbestos").checked = !!(f && f.prob.asbestos); $("loc").checked = false; $("hosp").checked = !!p.hospitalAcquired;
  $("purpose").value = p.purpose || (ctx === "pneumonia" ? "parapneumonic" : ctx === "cirrhosis" ? "hepatic" : ctx === "hf" ? "transudate" : ctx === "cancer" ? "malignant" : ctx === "trauma" ? "hemothorax" : "");
  const hasDrain = f && f.drain.length;
  $("tubetype").value = p.tube || (p.purpose === "hemothorax" && hasDrain ? "large" : hasDrain ? "small" : "none");
  $("daysin").value = p.daysIn ?? (hasDrain ? Math.max(0, Math.round((Date.now() - f.drain[0].t) / DAY)) : "");
  $("out24").value = f && f.drain24 != null ? f.drain24 : "";
  $("bubbling").checked = false; $("expanded").value = p.reexpand === "no" ? "no" : ""; $("settled").checked = !!p.sepsisSettled; $("fluidleft").checked = !!p.fluidLeft; $("talc").value = "";
  $("trouble").value = p.trouble || "";
  const recent = f && f.drain.length && Date.now() - f.drain[0].t <= 6 * HR ? f.drain.filter((d) => d.t - f.drain[0].t <= 2 * HR) : [];
  $("c-drained").value = p.drained ?? (recent.length ? recent.reduce((a2, d) => a2 + d.v, 0) : ""); $("c-min").value = p.drainMin ?? "";
  $("c-sym").checked = !!p.clampSym; $("c-lytics").checked = false; $("c-clampmin").value = "60";
  $("ecog").value = p.ecog != null ? String(p.ecog) : "";
  $("tumour").value = p.tumour || (f ? (f.prob.meso || f.prob.lymphoma || f.prob.heme ? "low" : f.prob.breastCa || f.prob.ovary || f.prob.kidneyCa ? "mod" : f.prob.cancer ? "high" : "") : "");
  $("reexpand").value = p.reexpand || ""; $("relief").value = p.relief === true ? "yes" : p.relief === false ? "no" : "";
  $("h-kind").value = p.purpose === "malignant" ? "ipc" : p.purpose === "empyema" || p.purpose === "parapneumonic" ? "infection" : "tap";
  ["h-fu", "h-phone", "h-sched", "h-abx"].forEach((id) => ($(id).value = ""));
}
function load(raw, note, errors, preset) {
  state.f = raw ? C.parse(raw) : null;
  autoFill(preset);
  $("pstatus").textContent = note; $("clear").hidden = !raw;
  $("errs").innerHTML = errors && errors.length ? "Could not read: " + errors.map(esc).join("; ") + (errors.some((e) => /\b40[13]\b|Unauthorized|Forbidden/i.test(e)) ? ". Check the scopes in the Code Console." : ". Cerner's sandbox can be slow: reload the patient to try again.") : "";
  draw();
}
document.addEventListener("change", (e) => { const t = e.target; if (t.id === "testsel" || t.closest(".handout") || /^h-/.test(t.id)) { if (/^h-/.test(t.id)) drawHandout(); return; } if (t.matches("input, select")) draw(); });
document.addEventListener("input", (e) => { const t = e.target; if (/^h-/.test(t.id)) return drawHandout(); if (t.matches("input[type=number]")) { t.classList.add("typed"); draw(); } });
$("h-print").onclick = () => { const w = window.open("", "_blank"); if (!w) return; w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Pleural effusion: patient information</title><style>body{font:16px/1.5 system-ui,sans-serif;max-width:720px;margin:24px auto;padding:0 16px}h3{margin:16px 0 4px}</style></head><body>${handoutHTML()}</body></html>`); w.document.close(); w.focus(); };
$("copy").onclick = () => { $("note").select(); try { navigator.clipboard.writeText($("note").value); } catch (e) { document.execCommand("copy"); } };
$("clear").onclick = () => { $("testsel").value = ""; load(null, "Open from Cerner to read the chart, or pick a made-up patient:"); };
const SAMPLES = window.PLEURAL_SAMPLES || [];
SAMPLES.forEach((p, i) => { const o = document.createElement("option"); o.value = i; o.textContent = p.label; $("testsel").appendChild(o); });
$("testsel").onchange = () => { const p = SAMPLES[$("testsel").value]; if (!p) return $("clear").onclick(); load(p.build(Date.now()), "Made-up patient: " + p.label, [], p); };

async function fromChart() {
  if (typeof FHIR === "undefined" || !(location.search.includes("code=") || location.search.includes("complete=") || sessionStorage.getItem("SMART_KEY"))) return;
  $("pstatus").textContent = "Reading the chart…";
  try {
    const client = await FHIR.oauth2.ready();
    const { raw, errors } = await C.gather(client, (msg) => ($("pstatus").textContent = msg));
    load(raw, "Chart read (read-only). Nothing is sent anywhere. Check side, size and context above.", errors);
  } catch (e) { $("pstatus").textContent = "Could not read the chart: " + (e && e.message ? e.message : e) + ". The made-up patients still work."; }
}
const demo = new URLSearchParams(location.search).get("demo");
if (demo && SAMPLES[+demo - 1]) { $("testsel").value = String(+demo - 1); $("testsel").onchange(); } else { draw(); fromChart(); }
