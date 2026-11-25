/* Small bowel obstruction page. Read-only from the chart; your selections stay in this page. UNVERIFIED draft. */
const R = window.SboRules, C = window.SboChart, DAY = C.DAY, HR = C.HR;
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const ago = (t) => { if (!t) return ""; const h = (Date.now() - t) / HR; return h < 1 ? Math.max(1, Math.round(h * 60)) + " min ago" : h < 48 ? Math.round(h) + " h ago" : Math.round(h / 24) + " d ago"; };
const ul = (a) => "<ul>" + a.filter(Boolean).map((t) => "<li>" + t + "</li>").join("") + "</ul>";
const num = (id) => { const el = $(id); if (!el) return null; const v = parseFloat(el.value); return isFinite(v) ? v : null; };
const val = (id) => ($(id) ? $(id).value : "");
const chk = (id) => !!($(id) && $(id).checked);
const state = { f: null, preset: null };
const tile = (k, big, sub, tone) => `<div class="tile ${tone || ""}"><div class="k">${k}</div><div class="big">${big}</div><div class="s">${sub || ""}</div></div>`;
const NUMS = [["n-hr", "v", "hr", 0.5], ["n-sbp", "v", "sbp", 0.5], ["n-temp", "v", "temp", 1], ["n-lactate", "l", "lactate", 2], ["n-wbc", "l", "wbc", 2], ["n-crp", "l", "crp", 3],
  ["n-hco3", "l", "hco3", 2], ["n-ph", "l", "ph", 1], ["n-k", "l", "k", 2], ["n-cr", "l", "cr", 3], ["n-weight", "v", "weight", 30]];

/* remember which sections are open (per browser) */
(function () {
  let st = {}; try { st = JSON.parse(localStorage.getItem("sbo-open") || "{}"); } catch (e) {}
  document.querySelectorAll("details.card").forEach((d) => {
    const k = (d.querySelector("summary span") || {}).textContent || ""; if (k in st) d.open = st[k];
    d.addEventListener("toggle", () => { st[k] = d.open; try { localStorage.setItem("sbo-open", JSON.stringify(st)); } catch (e) {} });
  });
})();

$("causepick").innerHTML = R.CAUSES.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join("");
$("symptoms").innerHTML = `<table><tr><th>Feature</th><th>What it tells you</th></tr>${R.SYMPTOMS.map(([a, b]) => `<tr><td><b>${esc(a)}</b></td><td>${esc(b)}</td></tr>`).join("")}</table>
  <p class="muted">Classic triad: colicky pain, vomiting, distension, plus obstipation. X-ray: dilated small bowel over 3 cm with air-fluid levels. Pain that becomes constant, fever, tachycardia, peritonism = think strangulation.</p>`;

/* ---------- facts from chart + inputs ---------- */
function facts() {
  const f = state.f;
  const reps = (f ? f.reports : []).slice();
  if (val("pasted").trim()) reps.push({ t: Date.now(), name: "Pasted report", text: val("pasted").trim(), pasted: true });
  const scans = reps.map((r) => ({ ...r, scan: R.imaging(r.name + ". " + r.text) }));
  const ct = new Set(); let cecum = null;
  // later reports override earlier contrast-colon reads
  scans.forEach((r) => { r.scan.ids.forEach((id) => { if (id === "contrastColon") ct.delete("noContrastColon"); if (id === "noContrastColon") ct.delete("contrastColon"); ct.add(id); }); if (r.scan.cecum) cecum = r.scan.cecum; });
  const ctDone = scans.some((r) => /\bct\b|computed|enterograph/i.test(r.name)) || reps.some((r) => r.pasted);
  const o = { age: f ? f.age : null, sex: f ? f.sex : "", ct, ctDone,
    hr: num("n-hr"), sbp: num("n-sbp"), temp: num("n-temp"), lactate: num("n-lactate"), wbc: num("n-wbc"), crp: num("n-crp"), hco3: num("n-hco3"), ph: num("n-ph"), k: num("n-k"), cr: num("n-cr"),
    weight: num("n-weight"), cecum: num("n-cecum") ?? cecum, nomHours: num("n-nom"), ngOut: num("n-ng"), npoDays: num("n-npo"),
    colicky: chk("colicky"), continuous: chk("continuous"), vomiting: chk("vomiting"), feculent: chk("feculent"), distension: chk("distension"), obstipation: chk("obstipation"),
    peritonitis: chk("peritonitis"), guarding: chk("guarding"), hernia: val("hernia"), dry: chk("dry"),
    priorSurgery: chk("priorSurgery"), recentSurgery: chk("recentSurgery"), bypass: chk("bypass"), cancer: chk("cancer"), carcinomatosis: chk("carcinomatosis") || ct.has("carcinomatosis"),
    crohn: chk("crohn"), radiation: chk("radiation"), steroid: chk("steroid"), cause: val("cause"),
    wsccGiven: val("w-given") === "yes", wsccHours: num("w-hours"), wsccColon: val("w-colon") || (ct.has("contrastColon") ? "yes" : ct.has("noContrastColon") ? "no" : ""), aspiration: chk("w-asp"), contrastAllergy: chk("w-allergy") };
  if (!o.cause && o.crohn) o.cause = "crohn";
  if (!o.cause && o.carcinomatosis) o.cause = "malignant";
  o.biliaryProc = !!(f && f.prob.biliaryProc);
  o.virgin = !o.priorSurgery && (o.hernia === "none") && !o.crohn && !o.cancer;
  const meds = f ? f.medTexts : [];
  const crBase = f && f.crBase;
  return { f, o, scans, meds, crBase, flags: R.redFlags(o), kind: R.kind(o), perf: R.perforation(o), w: R.wscc(o), path: R.pathway(o), mf: R.medFlags(meds),
    likely: R.likelyCauses({ priorSurgery: o.priorSurgery, hernia: o.hernia === "notchecked" ? "none" : o.hernia, herniaCT: ct.has("hernia"), bypass: o.bypass, cancer: o.cancer, carcinomatosis: o.carcinomatosis, mass: ct.has("mass"),
      crohn: o.crohn, radiation: o.radiation, whirl: ct.has("whirl"), intussCT: ct.has("intuss"), gallCT: ct.has("gallstone"), pneumobilia: ct.has("pneumobilia"), biliaryProc: !!(f && f.prob.biliaryProc), bezoarRisk: !!(f && f.cls.bezoar.length), anticoag: !!(f && f.cls.anticoag.length), inrHigh: !!(f && C.latest(f.l.inr) && C.latest(f.l.inr).v > 3) }),
    fl: R.fluids({ weight: o.weight, ngOut: o.ngOut, k: o.k, dry: o.dry, alkalosis: o.hco3 != null && o.hco3 > 29, npoDays: o.npoDays }) };
}

/* ---------- draw ---------- */
function alertsOf(x) {
  const a = x.flags.map((g) => ({ lvl: g.lvl, b: g.t, t: g.why }));
  x.mf.filter((m) => m.lvl === "urgent").forEach((m) => a.push({ lvl: "urgent", b: m.t + ": " + m.drugs.join(", "), t: m.why }));
  if (x.o.ct.has("pneumobilia") && !x.o.ct.has("gallstone")) a.push({ lvl: "action", b: "Pneumobilia on imaging", t: (x.f && x.f.prob.biliaryProc ? "Previous biliary procedure on file (" + esc(x.f.prob.biliaryProc[0]) + ") may explain it, but " : "") + "with SBO this is gallstone ileus until proven otherwise (Rigler triad: pneumobilia, SBO, ectopic gallstone). Ask radiology to look for the stone, often at the ileocecal valve; check for a cholecystoduodenal fistula. Surgery (enterolithotomy)." });
  if (x.o.hernia === "notchecked") a.push({ lvl: "action", b: "Hernia sites not checked", t: "Examine inguinal, femoral, umbilical and incisional sites: an incarcerated hernia changes the plan to surgery." });
  if (x.o.virgin && x.kind.id === "sbo") a.push({ lvl: "action", b: "No previous surgery and no hernia", t: "Adhesions unlikely: look for a cause (cancer, internal hernia, Crohn, gallstone, bezoar). Surgery to see early." });
  const ngOld = x.f && x.f.ng.length ? x.f.ng[x.f.ng.length - 1] : null;
  if (x.o.ngOut != null && x.o.ngOut > 1500) a.push({ lvl: "action", b: `NG output ${x.o.ngOut} mL/24 h`, t: "High output: replace losses with K, check Mg; high-volume ongoing output argues against resolution." });
  if (x.o.k != null && x.o.k < 3.0) a.push({ lvl: "action", b: `K ${x.o.k}`, t: "Replace IV and check Mg; hypokalemia prolongs ileus." });
  const mg = chartVal("l", "mg"); if (mg && mg.v < 0.7) a.push({ lvl: "action", b: `Mg ${mg.v}`, t: "Low magnesium: replace IV (magnesium sulfate 2 g or 5 g per local sheet); it keeps K low and slows the gut." });
  if (x.o.cr != null && x.crBase && x.o.cr >= x.crBase * 1.5) a.push({ lvl: "action", b: `Creatinine ${x.o.cr} (baseline about ${x.crBase})`, t: "AKI (pre-renal from losses most often): fluids, hold ACE/ARB/diuretics/NSAIDs/metformin; IV contrast is still reasonable when ischemia is suspected." });
  if (ngOld && Date.now() - ngOld.t > DAY && !x.o.ngOut) a.push({ lvl: "info", b: "No NG output charted in 24 h", t: "Check whether the tube is draining or was removed." });
  const pend = x.scans.filter((r) => r.pending); if (pend.length) a.push({ lvl: "info", b: "Preliminary imaging report", t: pend.map((r) => esc(r.name)).join(", ") + ": read again when final." });
  return a;
}
function draw() {
  const x = facts(); state.x = x;
  const o = x.o, f = x.f;
  // tiles
  const lac = o.lactate;
  $("tiles").innerHTML = tile("Picture", esc(x.kind.label.split(":")[0]), esc(x.kind.id === "sbo" ? (o.ct.has("highGrade") ? "high-grade / complete" : o.ct.has("partial") ? "partial" : "") : ""), x.kind.id === "unclear" ? "t1" : "")
    + tile("Ischemia / perforation", esc(x.perf.label), esc(x.perf.why.slice(0, 3).join(", ")), x.perf.tone)
    + tile("Lactate", lac != null ? lac : "?", lac == null ? "not found: order" : lac >= 4 ? "high" : lac > 2 ? "raised" : "normal", lac == null ? "t2" : lac >= 4 ? "t3" : lac > 2 ? "t2" : "t0")
    + tile("WBC / CRP", `${o.wbc ?? "?"} / ${o.crp ?? "?"}`, "", (o.wbc > 12 || o.crp >= 75) ? "t2" : "")
    + tile("K / creatinine", `${o.k ?? "?"} / ${o.cr ?? "?"}`, x.crBase ? "baseline Cr " + x.crBase : "", (o.k != null && o.k < 3.5) || (o.cr && x.crBase && o.cr >= x.crBase * 1.5) ? "t2" : "")
    + tile("Pathway", esc(x.path.label.split(":")[0]), o.nomHours != null ? `${Math.round(o.nomHours)} h of non-op care` : "", x.path.tone);
  // alerts
  const al = alertsOf(x);
  $("alerts").innerHTML = al.length ? al.map((a) => `<div class="alert ${a.lvl}"><b>${esc(a.b)}</b>${a.t}</div>`).join("") : '<div class="muted">No alerts from the chart and your entries. Re-examine: the picture changes.</div>';
  $("alertsum").textContent = al.length ? `${al.filter((a) => a.lvl === "urgent").length} urgent, ${al.filter((a) => a.lvl === "action").length} to act on` : "";
  $("ptsum").textContent = f ? [f.age != null ? f.age + " y" : "", f.sex].filter(Boolean).join(" ") : "";
  $("surgList").textContent = f && f.surgeries.length ? "Past surgery found: " + [...new Set(f.surgeries.map((s) => s.name))].join("; ") : "";
  // plan
  const p = x.path;
  $("plan").innerHTML = `<div class="verdict ${p.tone}"><div class="big">${esc(p.label)}</div><div>${p.why.map(esc).join("; ")}</div></div><ol>${p.steps.map((s) => "<li>" + esc(s) + "</li>").join("")}</ol>`;
  $("plansum").textContent = p.label.split(":")[0];
  // mimics
  $("kindsum").textContent = x.kind.label;
  $("mimics").innerHTML = `<div class="verdict ${x.kind.id === "sbo" ? "t1" : x.kind.id === "unclear" ? "" : "t2"}"><div class="big">${esc(x.kind.label)}</div><div>${esc(x.kind.why)}</div></div>
    <table><tr><th>Mimic</th><th>How to tell / what to do</th></tr>${R.MIMICS.map(([a, b]) => `<tr><td><b>${esc(a)}</b></td><td>${esc(b)}</td></tr>`).join("")}</table>`;
  // causes
  $("likely").innerHTML = x.likely.length ? `<table><tr><th>Cause</th><th>Why for this patient</th><th>What to do</th></tr>${x.likely.slice(0, 5).map((c) => `<tr><td><b>${esc(c.name)}</b></td><td>${esc(c.why.join("; "))}</td><td>${esc(c.tx)}</td></tr>`).join("")}</table>` : '<div class="muted">Nothing on the chart points to a cause yet. Ask about previous surgery and check hernia sites.</div>';
  drawCause();
  drawLabs(x); drawImaging(x); drawPerf(x); drawTx(x);
  if (state.note) state.note.update();
  drawHandout();
}
function drawCause() {
  const c = R.CAUSES.find((z) => z.id === val("causepick")) || R.CAUSES[0];
  $("causeout").innerHTML = `<table><tr><th>How common</th><td>${esc(c.freq)}</td></tr><tr><th>Clues</th><td>${esc(c.clue)}</td></tr><tr><th>Imaging</th><td>${esc(c.img)}</td></tr><tr><th>Management</th><td>${esc(c.tx)}</td></tr></table>`;
}
function chartVal(src, id, days) { const f = state.f; if (!f) return null; return C.latest(f[src][id], (days || 3) * DAY); }
function drawLabs(x) {
  const rows = [["Lactate", "l", "lactate", "Ischemia, shock"], ["VBG pH", "l", "ph", "Acidosis (ischemia) vs alkalosis (vomiting)"], ["WBC", "l", "wbc", "Leukocytosis, leukopenia"], ["Hemoglobin", "l", "hb", "Pre-op, bleeding"],
    ["Platelets", "l", "plt", "Pre-op"], ["Sodium", "l", "na", "Losses"], ["Potassium", "l", "k", "Usually low from vomiting/NG"], ["Chloride", "l", "cl", "Hypochloremic alkalosis"], ["Bicarbonate", "l", "hco3", "Low = ischemia/AKI; high = vomiting"],
    ["Creatinine", "l", "cr", "AKI from losses; contrast plan"], ["Urea", "l", "urea", "Volume status"], ["Magnesium", "l", "mg", "Low Mg worsens ileus and hypokalemia"], ["Phosphate", "l", "po4", "Refeeding risk"],
    ["Glucose", "l", "glu", "Stress, DKA mimic"], ["CRP", "l", "crp", "Strangulation if 75 or more; trend"], ["Lipase", "l", "lipase", "Pancreatitis mimic"], ["ALT / bilirubin", "l", "alt", "Biliary cause, gallstone ileus"],
    ["Albumin", "l", "alb", "Nutrition; RAPID-like frailty"], ["INR", "l", "inr", "Pre-op; warfarin hematoma"], ["CK", "l", "ck", "Late infarction marker (optional)"]];
  let miss = 0;
  $("labs").innerHTML = `<table><tr><th>Test</th><th>Latest (3 days)</th><th>Why</th></tr>${rows.map(([n, s, id, why]) => { const v = chartVal(s, id, id === "alb" ? 7 : 3); if (!v) miss++;
    return `<tr><td>${esc(n)}</td><td>${v ? `<span class="chip c-have">${v.v}</span> <span class="muted">${ago(v.t)}</span>` : '<span class="chip c-miss">not found</span>'}</td><td>${esc(why)}</td></tr>`; }).join("")}
    <tr><td>Group and screen</td><td><span class="muted">check orders</span></td><td>If surgery is possible</td></tr><tr><td>Blood cultures</td><td><span class="muted">check orders</span></td><td>Fever, hypotension, perforation</td></tr>
    <tr><td>Urinalysis, β-hCG (if could be pregnant)</td><td><span class="muted">check orders</span></td><td>Mimics; before CT</td></tr></table>`;
  $("labsum").textContent = state.f ? `${miss} not found in the last 3 days` : "";
}
function drawImaging(x) {
  $("imgwhich").innerHTML = `<table><tr><th>Test</th><th>Use</th></tr>${R.PERF_IMG.map(([a, b]) => `<tr><td><b>${esc(a)}</b></td><td>${esc(b)}</td></tr>`).join("")}
    <tr><td><b>Water-soluble contrast follow-up X-ray</b></td><td>8-24 h after Gastrografin: contrast in the colon predicts resolution (sensitivity about 92%, specificity about 93%).</td></tr>
    <tr><td><b>MR or CT enterography</b></td><td>Crohn disease, low-grade recurrent obstruction, radiation enteritis: not for the acute decision.</td></tr></table>`;
  const sc = x.scans.slice().reverse();
  $("reports").innerHTML = sc.length ? sc.map((r) => `<div class="rep"><div class="ttl">${esc(r.name)} <span class="muted">${r.pasted ? "pasted" : ago(r.t)}${r.pending ? " · preliminary" : ""}</span></div><div>${esc(r.text) || '<span class="muted">No report text (impression) in the chart.</span>'}</div>
    ${r.scan.finds.length ? `<div class="row">${r.scan.finds.map((g) => `<span class="chip ${g.lvl === "urgent" ? "c-bad" : g.lvl === "action" ? "c-miss" : "c-have"}">${esc(g.label)}</span>`).join(" ")}${r.scan.cecum ? ` <span class="chip c-miss">cecum ${r.scan.cecum} cm</span>` : ""}</div>` : ""}</div>`).join("")
    : '<div class="muted">No abdominal imaging reports found. CT abdomen/pelvis with IV contrast is the test of choice.</div>';
  $("imgsum").textContent = sc.length ? `${sc.length} report(s)` : "none found";
}
function drawPerf(x) {
  const p = x.perf;
  $("perf").innerHTML = `<div class="verdict ${p.tone}"><div class="big">${esc(p.label)}</div><div>${esc(p.why.join("; "))}</div></div>
    ${x.flags.length ? `<table><tr><th>Red flag</th><th>Meaning</th></tr>${x.flags.map((g) => `<tr><td class="${g.lvl === "urgent" ? "hi" : ""}">${esc(g.t)}</td><td>${esc(g.why)}</td></tr>`).join("")}</table>` : '<p class="muted">No red flags from the chart and your entries.</p>'}
    <p class="muted">No single lab rules ischemia in or out. WSES predictors of ischemia: fever, tachycardia, continuous pain, peritonism, leukocytosis, raised lactate/CRP/CK, and CT signs. Free air on any study = perforated.</p>`;
  $("perfsum").textContent = p.label;
  const have = (id) => { const v = chartVal("l", id); return v ? `<span class="chip c-have">${v.v}</span>` : '<span class="chip c-miss">order</span>'; };
  const labMap = ["lactate", "wbc", "crp", "cr", "lipase", "inr"];
  const ctDone = x.o.ctDone;
  $("perfneed").innerHTML = `<h4 style="margin:6px 0">Labs</h4><table><tr><th>Test</th><th>Chart</th><th>Why</th></tr>${R.PERF_LABS.map(([a, b], i) => `<tr><td><b>${esc(a)}</b></td><td>${labMap[i] ? have(labMap[i]) : '<span class="muted">check</span>'}</td><td>${esc(b)}</td></tr>`).join("")}</table>
    <h4 style="margin:10px 0 6px">Imaging</h4><table><tr><th>Test</th><th>Done?</th><th>Use</th></tr>${R.PERF_IMG.map(([a, b], i) => `<tr><td><b>${esc(a)}</b></td><td>${i === 0 ? (ctDone ? '<span class="chip c-have">CT found</span>' : '<span class="chip c-miss">not found</span>') : ""}</td><td>${esc(b)}</td></tr>`).join("")}</table>`;
  $("perfneedsum").textContent = ctDone ? "CT found" : "no CT found";
}
function drawTx(x) {
  const o = x.o, w = x.w;
  $("nom").innerHTML = `<h3>Bundle (adhesive SBO without red flags)</h3>${ul(["<b>NPO</b>; sips/ice chips only if surgery agrees.",
    "<b>NG tube</b> (14-16 Fr Salem sump) to low intermittent suction if vomiting or distended; confirm position on X-ray; record output each shift.",
    "<b>IV fluids</b>: balanced crystalloid; boluses until perfused, then maintenance + NG losses (see Fluids). Urine output goal 0.5 mL/kg/h.",
    "<b>Electrolytes</b>: K 4 or more, Mg over 1.0 (low K and Mg prolong ileus).",
    "<b>Analgesia</b>: IV opioid titrated, IV/PR acetaminophen; avoid NSAIDs with AKI.",
    "<b>Antiemetic</b>: ondansetron 4 mg IV q8h; haloperidol 0.5-1 mg if refractory. Avoid metoclopramide (prokinetic) while mechanically obstructed.",
    "<b>VTE prophylaxis</b> (heparin SC or LMWH); mobilize.",
    "<b>Water-soluble contrast challenge</b> once surgery agrees and red flags are absent: diagnostic and may be therapeutic (shorter stay, fewer operations).",
    "<b>Surgery involved from admission</b>; re-examine every 4-6 h; operate for red flags or no resolution by 72 h.",
    "<b>Nutrition</b>: dietitian if NPO 5 days or more or malnourished; PN if not eating by day 7 (sooner if malnourished)."])}`;
  $("wscc").innerHTML = `<div class="verdict ${w.status === "fail" ? "t3" : w.status === "pass" ? "t0" : w.status === "no" ? "t2" : "t1"}"><div class="big">${esc(w.label)}</div>${w.no.length ? "<div>Reasons: " + esc(w.no.join("; ")) + "</div>" : ""}</div>
    <div class="plan"><h3>How (common protocol, check local order set)</h3><ol><li>Aspirate the NG tube, then give 100 mL diatrizoate (Gastrografin) via NG (or 50-150 mL PO). Clamp the NG for 2-4 h if tolerated.</li>
    <li>Abdominal X-ray at 8-24 h (most centres 24 h; some 4-8 h).</li><li>Contrast in the colon: start clear fluids, advance as tolerated. No contrast in the colon at 24 h: discuss surgery.</li></ol>
    <h3>Cautions</h3><ul><li>Aspiration of hyperosmolar contrast can cause chemical pneumonitis / pulmonary edema: decompress first, head up 30°.</li><li>Hyperosmolar: pulls fluid into the gut; keep the patient well hydrated.</li><li>Not a substitute for surgery when there are signs of ischemia.</li></ul></div>`;
  $("wsccsum").textContent = w.label.split(":")[0];
  $("fluids").innerHTML = ul(x.fl.lines.map(esc)) + '<p class="muted">Rough guide only: adjust to exam, urine output, lytes, heart and kidney function.</p>';
  const mf = x.mf;
  $("meds").innerHTML = state.f ? (mf.length ? `<table><tr><th>Medication</th><th>On the chart</th><th>What to do</th></tr>${mf.map((m) => `<tr><td class="${m.lvl === "urgent" ? "hi" : ""}"><b>${esc(m.t)}</b></td><td>${esc(m.drugs.join("; "))}</td><td>${esc(m.why)}</td></tr>`).join("")}</table>` : '<div class="muted">No medications of concern found.</div>')
    : '<div class="muted">Open from Cerner or pick a made-up patient to check the medication list. Checks: prokinetics, laxatives, anticholinergics, opioids, constipating and bezoar-forming drugs, GLP-1 agonists, anticoagulants, steroids, SGLT2i, metformin, insulin, sulfonylureas, diuretics/ACE-ARB/NSAIDs, Parkinson drugs, antiseizure drugs, transplant drugs, levothyroxine.</div>';
  $("medsum").textContent = state.f ? `${mf.filter((m) => m.lvl === "urgent").length} urgent, ${mf.length} groups` : "";
  $("dc").innerHTML = ul(["Diet: clear fluids once flatus and NG removed, then full fluids → low-residue diet over 24-48 h. Discharge when tolerating diet, pain controlled on oral meds, passing flatus/stool.",
    "Restart held medications (diuretic, ACE/ARB, metformin, SGLT2i once eating 24-48 h; anticoagulant per surgeon if operated).",
    "Bowel regimen if going home on opioids (osmotic laxative).",
    "Recurrence after adhesive SBO is common (about 1 in 5 within 5 years with non-operative care); no diet has been shown to prevent it. Hernia found: elective repair referral.",
    "Virgin abdomen or unclear cause: make sure a cause has been found (colonoscopy for age-appropriate or iron deficiency, CT follow-up).",
    "Malignant obstruction: goals of care, palliative care follow-up, home care with SC meds, venting G-tube care."].map(esc));
}
function handoutHTML() {
  const k = val("h-kind"), fu = val("h-fu").trim(), ph = val("h-phone").trim();
  const H = (t) => `<h3>${t}</h3>`;
  let s = `<h2 style="margin:0 0 6px">Bowel obstruction: going home</h2>`;
  s += H("What happened") + (k === "surgery" ? "<p>Your small bowel was blocked and you had surgery to fix it.</p>" : k === "mbo" ? "<p>Your bowel is blocked by the cancer. The plan is to keep you comfortable and control nausea, vomiting and pain.</p>" : "<p>Your small bowel was blocked (most often by scar tissue from earlier surgery). It settled with rest, fluids through a vein and a tube to empty your stomach.</p>");
  if (k === "mbo") s += H("Your comfort plan") + ul(["Small sips and soft or liquid foods as you wish; eating is for comfort.", "Take your anti-nausea and pain medicines as prescribed; your home care nurse can give them under the skin.", "If you have a venting tube, open it to drain when you feel full or sick."]);
  else s += H("Eating") + ul(["Start with liquids and soft, low-fibre foods for a few days (soups, eggs, white rice, bananas, yogurt), then go back to your usual diet.", "Eat small meals, chew well, drink plenty of fluids.", "Have a bowel movement at least every 2-3 days; if you take pain pills that constipate, use the laxative you were given."]);
  if (k === "surgery") s += H("Your wound") + ul(["Keep it clean and dry; showering is fine unless you were told otherwise.", "No lifting more than 5-10 kg (a full grocery bag) for 4-6 weeks."]);
  s += H("Come back to the Emergency Department if") + ul(["You keep vomiting, or vomit green or brown fluid.", "Your belly gets more swollen or the cramps come back.", "You stop passing gas or stool for more than a day with pain or bloating.", "Your belly pain becomes constant or severe.", "You have a fever over 38°C" + (k === "surgery" ? ", or your wound becomes red, swollen or leaks pus" : "") + "."]);
  s += H("Call 9-1-1 if") + ul(["You faint, are very weak or confused, or have severe belly pain with a fast heartbeat."]);
  if (fu || ph) s += H("Follow-up") + `<p>${esc(fu)}${ph ? "<br>Questions: " + esc(ph) : ""}</p>`;
  return s;
}
function drawHandout() { $("handout").innerHTML = handoutHTML(); }

/* ---------- note ---------- */
function noteBuild(full) {
  const x = state.x; if (!x) return null;
  const o = x.o, f = x.f, L = [];
  const summary = [`${f ? [f.age != null ? f.age + " y" : "", f.sex].filter(Boolean).join(" ") : "Patient"} with ${x.kind.label.toLowerCase()}.`];
  const sx = ["colicky pain", "constant pain", "vomiting", "feculent vomiting", "distension", "obstipation"].filter((_, i) => [o.colicky, o.continuous, o.vomiting, o.feculent, o.distension, o.obstipation][i]);
  if (sx.length) summary.push("Symptoms: " + sx.join(", ") + ".");
  summary.push(`Exam: ${o.peritonitis ? "peritonitis" : o.guarding ? "guarding" : "no peritonitis"}; hernia: ${$("hernia").selectedOptions[0].text.toLowerCase()}.`);
  const hx = [o.priorSurgery ? "previous abdominal surgery" + (f && f.surgeries.length ? " (" + [...new Set(f.surgeries.map((s) => s.name))].join("; ") + ")" : "") : "no previous abdominal surgery", o.cancer ? "cancer" : "", o.carcinomatosis ? "carcinomatosis" : "", o.crohn ? "Crohn disease" : "", o.radiation ? "radiation" : "", o.steroid ? "on steroids" : ""].filter(Boolean);
  summary.push("History: " + hx.join(", ") + ".");
  const vit = [o.hr != null ? "HR " + o.hr : "", o.sbp != null ? "SBP " + o.sbp : "", o.temp != null ? "T " + o.temp : ""].filter(Boolean).join(", ");
  const labs = [o.lactate != null ? "lactate " + o.lactate : "", o.wbc != null ? "WBC " + o.wbc : "", o.crp != null ? "CRP " + o.crp : "", o.k != null ? "K " + o.k : "", o.hco3 != null ? "HCO3 " + o.hco3 : "", o.cr != null ? "Cr " + o.cr + (x.crBase ? " (baseline " + x.crBase + ")" : "") : ""].filter(Boolean).join(", ");
  if (vit) summary.push("Vitals: " + vit + "."); if (labs) summary.push("Labs: " + labs + ".");
  const img = x.scans.length ? x.scans.slice(full ? 0 : -1).map((r) => `${r.name}${r.pasted ? "" : " (" + ago(r.t) + ")"}: ${r.text}`) : ["No abdominal imaging found."];
  const risk = [`${x.perf.label}${x.perf.why.length ? ": " + x.perf.why.join(", ") : ""}.`].concat(x.flags.filter((g) => g.lvl !== "info").map((g) => g.t));
  const plan = [x.path.label + "."].concat(full ? x.path.steps : x.path.steps.slice(0, 4));
  if (o.wsccGiven) plan.push(`Water-soluble contrast given ${o.wsccHours ?? "?"} h ago: ${x.w.label}.`);
  if (o.nomHours != null) plan.push(`${Math.round(o.nomHours)} h of non-operative care so far.`);
  const meds = x.mf.filter((m) => m.lvl !== "info" || full).map((m) => `${m.t} (${m.drugs.join("; ")}): ${m.why}`);
  const lab = R.PERF_LABS.map((z) => z[0]);
  return { stamp: Date.now(), heading: "SMALL BOWEL OBSTRUCTION", sections: { summary, imaging: img, risk, plan, meds, labs: lab } };
}
state.note = NoteDraft.mount($("note"), { title: "Small bowel obstruction", sections: [{ id: "summary", label: "Summary" }, { id: "imaging", label: "Imaging" }, { id: "risk", label: "Ischemia / perforation risk", noteLabel: "Ischemia / perforation risk" },
  { id: "plan", label: "Plan" }, { id: "meds", label: "Medications", noteLabel: "Medications while NPO" }, { id: "labs", label: "Labs to send", on: false }], build: noteBuild });

/* ---------- load ---------- */
function autoFill(preset) {
  const p = (preset && preset.sit) || {}, f = state.f;
  NUMS.forEach(([id, src, key, days]) => { const v = f ? C.latest(f[src][key], days * DAY) : null; $(id).value = v ? v.v : ""; $(id).classList.remove("typed"); });
  ["colicky", "continuous", "vomiting", "feculent", "distension", "obstipation", "peritonitis", "guarding", "dry"].forEach((id) => ($(id).checked = !!p[id]));
  $("hernia").value = p.hernia || (f ? "notchecked" : "none");
  $("priorSurgery").checked = !!(f && f.prob.priorSurgery);
  $("recentSurgery").checked = !!(f && f.recentSurgery);
  $("bypass").checked = !!(f && f.prob.bypass); $("cancer").checked = !!(f && f.prob.cancer); $("carcinomatosis").checked = !!(f && f.prob.carcinomatosis);
  $("crohn").checked = !!(f && f.prob.crohn); $("radiation").checked = !!(f && f.prob.radiation); $("steroid").checked = !!(f && (f.cls.steroid.length || f.prob.transplant));
  $("cause").value = p.cause || "";
  $("n-cecum").value = ""; $("n-nom").value = p.nomHours ?? (f && f.admitT ? Math.round((Date.now() - f.admitT) / HR) : "");
  $("n-ng").value = f && f.ng24 != null ? f.ng24 : ""; $("n-npo").value = p.npoDays ?? "";
  $("w-given").value = p.wsccGiven ? "yes" : ""; $("w-hours").value = p.wsccHours ?? ""; $("w-colon").value = ""; $("w-asp").checked = false; $("w-allergy").checked = false;
  $("pasted").value = "";
  $("h-kind").value = p.cause === "malignant" ? "mbo" : "nonop"; $("h-fu").value = ""; $("h-phone").value = "";
  if (p.cause && $("causepick").querySelector(`option[value="${p.cause}"]`)) $("causepick").value = p.cause;
}
function load(raw, note, errors, preset) {
  state.f = raw ? C.parse(raw) : null; state.preset = preset || null;
  autoFill(preset);
  $("pstatus").textContent = note; $("clear").hidden = !raw;
  $("errs").innerHTML = errors && errors.length ? "Could not read: " + errors.map(esc).join("; ") + (errors.some((e) => /\b40[13]\b|Unauthorized|Forbidden/i.test(e)) ? ". Check the scopes in the Code Console." : ". Cerner's sandbox can be slow: reload the patient to try again.") : "";
  state.note.reset();
  draw();
}
document.addEventListener("change", (e) => { const t = e.target; if (t.id === "testsel") return; if (t.id === "causepick") return drawCause(); if (/^h-/.test(t.id)) return drawHandout(); if (t.closest("#note")) return; if (t.matches("input, select, textarea")) draw(); });
document.addEventListener("input", (e) => { const t = e.target; if (t.closest("#note")) return; if (/^h-/.test(t.id)) return drawHandout(); if (t.matches("input[type=number]")) { t.classList.add("typed"); draw(); } if (t.id === "pasted") draw(); });
$("h-print").onclick = () => { const w = window.open("", "_blank"); if (!w) return; w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Bowel obstruction: patient information</title><style>body{font:16px/1.5 system-ui,sans-serif;max-width:720px;margin:24px auto;padding:0 16px}h3{margin:16px 0 4px}</style></head><body>${handoutHTML()}</body></html>`); w.document.close(); w.focus(); };
$("clear").onclick = () => { $("testsel").value = ""; load(null, "Open from Cerner to read the chart, or pick a made-up patient:"); };
const SAMPLES = window.SBO_SAMPLES || [];
SAMPLES.forEach((p, i) => { const op = document.createElement("option"); op.value = i; op.textContent = p.label; $("testsel").appendChild(op); });
$("testsel").onchange = () => { const p = SAMPLES[$("testsel").value]; if (!p) return $("clear").onclick(); load(p.build(Date.now()), "Made-up patient: " + p.label, [], p); };

async function fromChart() {
  if (typeof FHIR === "undefined" || !(location.search.includes("code=") || location.search.includes("complete=") || sessionStorage.getItem("SMART_KEY"))) return;
  $("pstatus").textContent = "Reading the chart…";
  try {
    const client = await FHIR.oauth2.ready();
    const { raw, errors } = await C.gather(client, (msg) => ($("pstatus").textContent = msg));
    load(raw, "Chart read (read-only). Nothing is sent anywhere. Fill in the symptoms and exam above.", errors);
  } catch (e) { $("pstatus").textContent = "Could not read the chart: " + (e && e.message ? e.message : e) + ". The made-up patients still work."; }
}
const demo = new URLSearchParams(location.search).get("demo");
if (demo && SAMPLES[+demo - 1]) { $("testsel").value = String(+demo - 1); $("testsel").onchange(); } else { draw(); fromChart(); }
