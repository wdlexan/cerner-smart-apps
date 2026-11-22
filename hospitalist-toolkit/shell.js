/* Hospitalist Toolkit - one launch, one patient, each tool in its own tab.
   The shell finishes the SMART sign-in once; each tab then loads its tool from tools/<name>/index.html.
   The tools pick up the same sign-in automatically (same browser tab, same site), so they run unchanged.
   A tab is only loaded the first time you open it, and stays loaded when you switch away. */

// To add a tool: put its files in tools/<folder>/ and add a line here.
const TOOL_V = "20261121k"; // bump this whenever a tool changes, so browsers do not show a stale cached tab
const TOOLS = [
  { key: "today", label: "Today (what changed)", tags: "what changed daily trends vitals overnight summary", path: "tools/today/index.html" },
  { key: "plist", label: "Patient list (screenshot)", tags: "patient list screenshot excel spreadsheet rounding list census floor ward ocr", path: "tools/plist/index.html" },
  { key: "labs",  label: "Labs", tags: "lab results cbc lytes electrolytes chemistry blood work",                 path: "tools/labs/index.html" },
  { key: "crit",  label: "Critical labs → MRP", tags: "critical lab alert mrp teams page message",  path: "tools/critical/index.html" },
  { key: "notes", label: "Notes", tags: "notes documents progress note discharge summary compile",                path: "tools/notes/index.html" },
  { key: "exam",  label: "Physical exam", tags: "physical exam template normal",        path: "tools/exam/index.html", keepHeader: true }, // its header holds the template picker and All normal
  { key: "meds",  label: "Meds review (Beers)", tags: "medications beers criteria elderly geriatric polypharmacy deprescribing",  path: "tools/meds/index.html" },
  { key: "g6pd",  label: "G6PD check", tags: "g6pd hemolysis drug safety rasburicase primaquine dapsone",           path: "tools/g6pd/index.html" },
  { key: "risk",  label: "Risk screen", tags: "risk screen pressure injury ulcer nutrition sleep dysphagia falls",          path: "tools/risk/index.html" },
  { key: "opioid", label: "Opioid safety", tags: "opioid safety narcotics naloxone morphine oxycodone hydromorphone",       path: "tools/opioid/index.html" },
  { key: "pain",  label: "Pain management", tags: "pain management analgesia",      path: "tools/pain/index.html" },
  { key: "abx",   label: "Antibiotics", tags: "antibiotics antimicrobial stewardship iv po switch duration",          path: "tools/abx/index.html" },
  { key: "abxmap", label: "Antibiotic chooser (body map)", tags: "antibiotic chooser body map which antibiotic empiric choice site lung skin bladder kidney prostate colon gallbladder joint brain sinus dental groin sepsis c diff allergy mrsa esbl pseudomonas", path: "tools/abxmap/index.html" },
  { key: "inf",   label: "Infections by site", tags: "infections sepsis pneumonia uti cellulitis source",   path: "tools/infections/index.html" },
  { key: "cw",    label: "Choosing Wisely", tags: "choosing wisely low value tests overuse",      path: "tools/cw/index.html", keepHeader: true }, // its header holds the Look back control
  { key: "dx",    label: "Diagnosis check", tags: "diagnosis check cognitive bias second look missed differential harm",      path: "tools/dx/index.html", keepHeader: true }, // its header holds the Look back control
  { key: "ed",    label: "ED screen", tags: "ed er emergency screen admission",            path: "tools/ed/index.html" },
  { key: "hah",   label: "Hospital at Home", tags: "hospital at home hah virtual ward",     path: "tools/hah/index.html" },
  { key: "calc",  label: "Calculators", tags: "calculators scores egfr curb chads wells",          path: "tools/calc/index.html" },
  { key: "ai",    label: "AI summary", tags: "ai summary draft llm",           path: "tools/ai/index.html" },
  { key: "pc",    label: "Peritoneal carcinomatosis", tags: "peritoneal carcinomatosis peritoneum metastases omental cake pci sugarbaker hipec crs cytoreduction malignant bowel obstruction mbo sbo octreotide buscopan venting peg malignant ascites paracentesis pleurx indwelling catheter colorectal gastric ovarian pseudomyxoma cea ca-125 chemo oncology prognosis", path: "tools/pc/index.html" },
  { key: "ild",   label: "ILD (interstitial lung disease)", tags: "ild interstitial lung disease pulmonary fibrosis ipf uip nsip organizing pneumonia hypersensitivity pneumonitis sarcoid acute exacerbation ground glass honeycombing drug pneumonitis amiodarone nitrofurantoin methotrexate ctd myositis anti-synthetase mda5 nintedanib pirfenidone home oxygen gap respirology", path: "tools/ild/index.html" },
  { key: "onc",   label: "Oncology (common cancers)", tags: "oncology cancer bladder urothelial bcg enfortumab melanoma braf ipilimumab head and neck oropharynx larynx tracheostomy laryngectomy kidney renal cell rcc cabozantinib belzutifan pancreas pancreatic folfirinox cholangitis leukemia leukaemia aml apl all cml cll lymphoma hodgkin dlbcl follicular mantle burkitt cns lymphoma car-t venetoclax rituximab r-chop leukostasis differentiation syndrome dic hlh lung nsclc sclc small cell breast colorectal colon rectal prostate metastatic palliative curative chemotherapy immunotherapy targeted egfr alk her2 adt abiraterone enzalutamide febrile neutropenia cord compression mscc hypercalcemia tumour lysis tls svc brain mets mascc emergencies", path: "tools/onc/index.html" },
  { key: "tox",   label: "Oncology toxicity", tags: "oncology toxicity chemotherapy immunotherapy cancer",    path: "tools/tox/index.html", keepHeader: true }, // its header holds the draft/version note
  { key: "watch", label: "Watch-ahead", tags: "watch ahead deterioration early warning",          path: "tools/watch/index.html", keepHeader: true }, // its header holds the draft/version note
  { key: "bsab",  label: "CRS/ICANS (bispecific)", tags: "crs icans bispecific teclistamab myeloma cytokine release", path: "tools/bispecific/index.html" },
  { key: "ibd",   label: "IBD flowsheet (Crohn/UC)", tags: "ibd crohn colitis ulcerative asuc", path: "tools/ibd/index.html" },
  { key: "liver", label: "Liver (cirrhosis)", tags: "liver cirrhosis hepatic encephalopathy ascites meld varices", path: "tools/liver/index.html" },
  { key: "hypona", label: "Sodium (hypo / hyper)", tags: "hyponatremia hypernatremia sodium low high na siadh diabetes insipidus free water deficit", path: "tools/hypona/index.html" },
  { key: "hip",   label: "Hip fracture", tags: "hip fracture fragility orthopedics ortho",         path: "tools/hip/index.html" },
  { key: "consult", label: "Consult summary", tags: "consult summary",    path: "tools/consult/index.html" },
  { key: "mobility", label: "Mobility & discharge", tags: "mobility discharge pt ot function planning", path: "tools/mobility/index.html" },
  { key: "discharge", label: "Discharge note", tags: "discharge summary note instructions what changed medication reconciliation pending results incidental findings follow-up family physician fp return precautions 911 when to call handout", path: "tools/discharge/index.html" },
  { key: "dcclinic", label: "Discharge Clinic (South Island)", tags: "discharge clinic south island rjh sidc rapid follow-up urgent outpatient referral close follow up umac upcc holter gdmt", path: "tools/dcclinic/index.html" },
  { key: "pd",    label: "Parkinson disease", tags: "parkinson pd levodopa",    path: "tools/pd/index.html" },
  { key: "dementia", label: "Dementia workup", tags: "dementia cognitive impairment memory delirium workup",  path: "tools/dementia/index.html" },
  { key: "aki",   label: "AKI", tags: "aki acute kidney injury creatinine renal",                  path: "tools/aki/index.html" },
  { key: "chf",   label: "Heart failure (CHF)",  tags: "chf heart failure hf adhf congestion nt-probnp bnp diuretic furosemide lasix bumetanide torsemide metolazone acetazolamide gdmt entresto sglt2 amyloid amyloidosis edema handout dry weight", path: "tools/chf/index.html" },
  { key: "af",    label: "AF (acute illness)",   tags: "atrial fibrillation afib a fib rapid ventricular rvr rate control digoxin metoprolol beta blocker diltiazem amiodarone anticoagulation chads65 pneumonia sepsis", path: "tools/af/index.html" },
  { key: "lytes", label: "Electrolytes (K, PO4, Ca, Mg)", tags: "electrolytes hypomagnesemia hypermagnesemia potassium hypokalemia hyperkalemia phosphate phosphorus hypophosphatemia hyperphosphatemia calcium hypocalcemia hypercalcemia magnesium lytes refeeding tumour lysis", path: "tools/lytes/index.html" },
  { key: "acidbase", label: "Acid-base", tags: "acid base abg vbg blood gas anion gap ph co2 bicarbonate",         path: "tools/acidbase/index.html" },
  { key: "ktx",   label: "Kidney transplant", tags: "kidney transplant renal tacrolimus immunosuppression",    path: "tools/transplant/index.html" },
  { key: "dm",    label: "Diabetes (inpatient)", tags: "diabetes insulin glucose sugar hyperglycemia hypoglycemia", path: "tools/diabetes/index.html", keepHeader: true }, // its header holds the Look back control
  { key: "stroke", label: "Stroke follow-up", tags: "stroke tia cva nihss neuro",    path: "tools/stroke/index.html", keepHeader: true }, // its header holds the Look back control
  { key: "seizure", label: "Seizure", tags: "seizure epilepsy status antiseizure",          path: "tools/seizure/index.html" },
  { key: "neuro",  label: "Neuro (non-stroke)", tags: "neuro neurology weakness headache non-stroke", path: "tools/neuro/index.html" },
  { key: "edr",   label: "Eating disorder (ED)", tags: "eating disorder anorexia bulimia refeeding", path: "tools/edr/index.html", keepHeader: true }, // its header holds the Look back control
  { key: "sero",  label: "Autoimmune serology", tags: "autoimmune serology which test to order rheumatology pbc ama celiac myasthenia ana ena dsdna anca pr3 mpo rf ccp rheumatoid factor complement c3 c4 lupus sle vasculitis gpa mpa egpa sjogren scleroderma myositis antiphospholipid aps cryoglobulin anti-gbm", path: "tools/serology/index.html" },
  { key: "ae",    label: "Autoimmune encephalitis", tags: "autoimmune encephalitis nmda", path: "tools/ae/index.html", keepHeader: true }, // its header holds the tool's own tabs
  { key: "forms", label: "Forms", tags: "forms referral requisition pdf form 4.1 bc cancer pulse gi",                path: "tools/forms/index.html" }
];

// POCKET MODE (index.html?pocket=1, the iPhone home-screen app; see pocket.js): no Cerner connection, so hide the tabs that only read the chart.
const POCKET_HIDE = ["today", "plist", "labs", "crit", "notes", "ai", "forms", "consult", "ed", "hah", "risk", "watch", "dx", "cw", "mobility", "discharge"];
const POCKET = window.TK_POCKET === true;
if (POCKET) for (let i = TOOLS.length - 1; i >= 0; i--) if (POCKET_HIDE.includes(TOOLS[i].key)) TOOLS.splice(i, 1);
const TAB_KEY = POCKET ? "pocket-tab" : "toolkit-tab";

const $ = (id) => document.getElementById(id);

// index.html?test=1 (optionally &patient=…&tab=…) opens TEST MODE directly: Cerner's open sandbox, no login.
const _q = new URLSearchParams(location.search);
if (_q.get("test") === "1") {
  const p = new URLSearchParams();
  if (_q.get("patient")) p.set("patient", _q.get("patient"));
  const tab = _q.get("tab") || location.hash.slice(1);
  if (tab) p.set("tab", tab);
  location.replace("launch-test.html" + (p.toString() ? "?" + p : ""));
} else {
  FHIR.oauth2.ready().then(start).catch((e) => {
    $("patient").textContent = "Not connected";
    const tab = location.hash.slice(1);
    $("msg").innerHTML = `<b class="err">Not signed in:</b> ${esc(e.message || e)}<br><br>
      Launch the toolkit from the Cerner sandbox (it opens launch.html), or open it without logging in, using Cerner's public test patients:<br><br>
      <a href="launch-test.html${tab ? "?tab=" + encodeURIComponent(tab) : ""}" style="display:inline-block;background:#0b6bcb;color:#fff;text-decoration:none;border-radius:6px;padding:8px 14px;font-weight:600">Open in test mode (no login)</a>`;
  });
}

async function start(client) {
  // Opened from a link (launch-standalone.html) instead of PowerChart: there is no patient yet,
  // so find the one named in the link and hand it to every tab.
  let target = null;
  try { target = JSON.parse(sessionStorage.getItem("toolkit-target") || "null"); } catch (e) {}
  if (!client.patient.id) {
    try {
      if (!target) throw new Error("No patient was chosen. Open the toolkit from PowerChart, or from a link ending in ?patient=…, ?mrn=… or ?fin=….");
      $("msg").textContent = "Finding the patient…";
      const found = await resolveTarget(client, target);
      setPatient(client, found.patient, found.encounter);
    } catch (e) {
      $("patient").textContent = "No patient";
      $("msg").innerHTML = `<b class="err">Could not open the patient:</b> ${esc(e.message || e)}`;
      return;
    }
  }
  try { sessionStorage.removeItem("toolkit-target"); } catch (e) {}

  // Consult button (consult-widget.js): patient from this client, topic and usual service from the open tab
  window.CONSULT_CTX = { client, tabKey: () => window.__tkTab || "", topic: () => { const t = TOOLS.find((x) => x.key === window.__tkTab); return t ? t.label.replace(/\s*\(.*?\)/, "") : ""; } };
  window.TK = { patientId: client.patient.id, isPdfPatient: /^pdfpt-/.test(client.patient.id), switchPatient, backToCerner }; // used by the PDF import button
  try { $("patient").textContent = describe(await client.patient.read()); }
  catch (e) { $("patient").textContent = "Patient " + client.patient.id; }
  if (POCKET) pocketChip();
  else if (window.TK.isPdfPatient) pdfPatientChip();
  let testMode = false; try { testMode = sessionStorage.getItem("toolkit-test") === "1"; } catch (e) {}
  if (testMode) $("patient").innerHTML = `<span style="background:#fff3cd;color:#7a4b00;border-radius:10px;padding:1px 8px;font-weight:700;margin-right:6px">TEST MODE · open sandbox, no login</span>${esc($("patient").textContent)}`;
  $("msg").remove();

  $("tabs").innerHTML = TOOLS.map((t) => `<button data-k="${t.key}">${esc(t.label)}</button>`).join("");
  document.querySelectorAll("#tabs button").forEach((b) => (b.onclick = () => show(b.dataset.k)));
  setupSearch();

  // Open the tab named in the address (#labs), else the last one used, else Today
  let first = (target && target.tab) || location.hash.slice(1);
  if (!TOOLS.some((t) => t.key === first)) { try { first = localStorage.getItem(TAB_KEY); } catch (e) {} }
  if (!TOOLS.some((t) => t.key === first)) first = TOOLS[0].key;
  show(first);
}

// ---- Find a tool: type to filter the tabs. Matches the tab name and clinical words (e.g. "sodium" finds Hyponatremia).
// Enter opens the first match, Esc clears. Press "/" anywhere in the header to jump to the box.
function setupSearch() {
  const box = $("toolsearch"), none = $("nomatch");
  box.hidden = false;
  const norm = (x) => String(x || "").toLowerCase().replace(/[^a-z0-9]+/g, " ");
  const hay = Object.fromEntries(TOOLS.map((t) => [t.key, " " + norm(t.label + " " + (t.tags || "")) + " "]));
  const matches = () => {
    const words = norm(box.value).split(" ").filter(Boolean);
    return TOOLS.filter((t) => words.every((w) => hay[t.key].includes(" " + w))).map((t) => t.key);
  };
  const filter = () => {
    const keys = box.value.trim() ? matches() : TOOLS.map((t) => t.key);
    document.querySelectorAll("#tabs button").forEach((b) => (b.hidden = !keys.includes(b.dataset.k)));
    none.hidden = keys.length > 0;
    return keys;
  };
  box.oninput = filter;
  box.onkeydown = (e) => {
    if (e.key === "Enter") { const k = filter()[0]; if (k) { show(k); box.blur(); } }
    else if (e.key === "Escape") { box.value = ""; filter(); box.blur(); }
  };
  document.addEventListener("keydown", (e) => {
    if (e.key === "/" && document.activeElement !== box && !/INPUT|TEXTAREA|SELECT/.test((document.activeElement || {}).tagName)) { e.preventDefault(); box.focus(); box.select(); }
  });
}

function show(key) {
  const tool = TOOLS.find((t) => t.key === key);
  window.__tkTab = key;
  let f = document.querySelector(`#frames iframe[data-k="${key}"]`);
  if (!f) { // first visit: load the tool
    f = document.createElement("iframe");
    f.dataset.k = key;
    f.title = tool.label;
    f.onload = () => { if (!tool.keepHeader) tidy(f); if (POCKET) pocketFit(f); };
    // "complete=1" tells the fhirclient library inside the tool that sign-in is already finished.
    // Without it, a tool running inside a frame waits for a pop-up/frame sign-in that never comes.
    f.src = tool.path + "?complete=1" + (POCKET ? "&pocket=1" : "") + "&v=" + TOOL_V; // v forces a fresh copy of each tool page after an update
    $("frames").appendChild(f);
  }
  document.querySelectorAll("#frames iframe").forEach((x) => x.classList.toggle("on", x === f));
  document.querySelectorAll("#tabs button").forEach((b) => b.classList.toggle("on", b.dataset.k === key));
  if (POCKET) { const b = document.querySelector(`#tabs button[data-k="${key}"]`); if (b) b.scrollIntoView({ inline: "center", block: "nearest" }); }
  history.replaceState(null, "", "#" + key);
  try { localStorage.setItem(TAB_KEY, key); } catch (e) {}
}

// Each tool has its own blue title bar with the patient's name; the toolkit header already shows it.
function tidy(frame) {
  try {
    const d = frame.contentDocument;
    const s = d.createElement("style");
    s.textContent = "body > header { display:none !important; } main { margin-top:12px !important; }";
    d.head.appendChild(s);
  } catch (e) { /* not same-site - leave it */ }
}

// ---- PDF-only patients (Import PDF > "Open as a separate patient") ----
// Switch every tab to another patient: rewrite the patient in the saved sign-in record and reload. Leaving a Cerner patient for a
// PDF-only one remembers the Cerner patient so the header can offer a way back. pdf-overlay.js answers all requests for pdfpt- IDs locally.
function switchPatient(id, encounter) {
  const key = JSON.parse(sessionStorage.getItem("SMART_KEY")), saved = JSON.parse(sessionStorage.getItem(key));
  saved.tokenResponse = saved.tokenResponse || {};
  const cur = saved.tokenResponse.patient;
  if (cur && !/^pdfpt-/.test(cur) && /^pdfpt-/.test(id)) sessionStorage.setItem("pdfpt-return", JSON.stringify({ patient: cur, encounter: saved.tokenResponse.encounter || null, label: $("patient").textContent }));
  saved.tokenResponse.patient = id;
  if (encounter) saved.tokenResponse.encounter = encounter; else delete saved.tokenResponse.encounter;
  sessionStorage.setItem(key, JSON.stringify(saved));
  location.hash = ""; location.reload();
}
function backToCerner() {
  let r = null; try { r = JSON.parse(sessionStorage.getItem("pdfpt-return") || "null"); } catch (e) {}
  if (r && r.patient) switchPatient(r.patient, r.encounter);
}
function pdfPatientChip() {
  let r = null; try { r = JSON.parse(sessionStorage.getItem("pdfpt-return") || "null"); } catch (e) {}
  const el = $("patient");
  el.innerHTML = `<span style="background:#fde8e8;color:#7a1b1b;border-radius:10px;padding:1px 8px;font-weight:700;margin-right:6px">PDF-only patient</span>${esc(el.textContent)}` +
    (r && r.patient ? ` <button id="tocerner" style="margin-left:8px;background:#fff;color:#0b6bcb;border:0;border-radius:6px;padding:3px 9px;font-size:12px;cursor:pointer" title="${esc(r.label || "")}">Back to Cerner patient</button>` : "");
  const b = document.getElementById("tocerner"); if (b) b.onclick = backToCerner;
}

// Pocket mode: the tabs were laid out for a PowerChart window, so squeeze each one to the phone's width.
function pocketFit(frame) {
  let d; try { d = frame.contentDocument; } catch (e) { return; }
  if (!d || !d.head) return;
  const s = d.createElement("style");
  s.textContent = `html, body { max-width:100vw; overflow-x:hidden; -webkit-text-size-adjust:100%; }
    body { padding-bottom:calc(env(safe-area-inset-bottom) + 70px) !important; }
    main, .wrap, .container { margin-left:0 !important; margin-right:0 !important; padding-left:8px !important; padding-right:8px !important; max-width:100% !important; }
    * { min-width:0 !important; }
    div, section, article, aside, details, fieldset, form, label, p, ul, ol, pre, img, svg, canvas, iframe { max-width:100%; }
    pre, code { white-space:pre-wrap; word-break:break-word; }
    table { display:block; overflow-x:auto; max-width:100%; }
    input, select, textarea { max-width:100%; font-size:16px; }`;
  d.head.appendChild(s);
  const fix = () => {
    d.querySelectorAll("body *").forEach((el) => {
      const cs = d.defaultView.getComputedStyle(el);
      if (cs.display.includes("flex") && cs.flexWrap === "nowrap" && cs.flexDirection.startsWith("row") && el.scrollWidth > el.clientWidth + 2) el.style.flexWrap = "wrap";
      if (cs.display.includes("grid") && el.scrollWidth > el.clientWidth + 2) el.style.gridTemplateColumns = "minmax(0,1fr)";
    });
  };
  fix(); setTimeout(fix, 800); setTimeout(fix, 2500);
  let t; new d.defaultView.MutationObserver(() => { clearTimeout(t); t = setTimeout(fix, 300); }).observe(d.body, { childList: true, subtree: true });
}

function pocketChip() {
  $("patient").innerHTML = `<span style="background:#e6f4ea;color:#14532d;border-radius:10px;padding:1px 8px;font-weight:700">Pocket · not connected to Cerner</span>`;
  const b = document.getElementById("pdfbar"); if (b) b.remove(); // no Import PDF on the phone (keeps patient documents off the device)
}

// ---- standalone launch: find the patient named in the link ----
async function resolveTarget(client, t) {
  if (t.patient) return { patient: t.patient };

  if (t.mrn) {
    const hits = (await client.request("Patient?identifier=" + encodeURIComponent(t.mrn), { flat: true }))
      .filter((r) => r.resourceType === "Patient");
    if (hits.length === 1) return { patient: hits[0].id };
    if (!hits.length) throw new Error(`No patient found with MRN ${t.mrn}.`);
    throw new Error(`${hits.length} patients matched MRN ${t.mrn} - open the patient from PowerChart instead.`);
  }

  if (t.fin) {
    const encs = (await client.request("Encounter?identifier=" + encodeURIComponent(t.fin), { flat: true }))
      .filter((r) => r.resourceType === "Encounter");
    if (encs.length !== 1) throw new Error(encs.length ? `${encs.length} visits matched FIN ${t.fin}.` : `No visit found with FIN ${t.fin}.`);
    const ref = (encs[0].subject && encs[0].subject.reference) || "";
    const id = ref.split("/").pop();
    if (!id) throw new Error(`The visit with FIN ${t.fin} has no patient attached.`);
    return { patient: id, encounter: encs[0].id };
  }
  throw new Error("The link doesn't say which patient to open.");
}

// Store the patient in the sign-in record the fhirclient library keeps for this browser tab.
// Every tab reads client.patient.id from that record, so they all open on this patient unchanged.
function setPatient(client, patientId, encounterId) {
  client.state.tokenResponse = client.state.tokenResponse || {};
  client.state.tokenResponse.patient = patientId;
  if (encounterId) client.state.tokenResponse.encounter = encounterId;
  const key = JSON.parse(sessionStorage.getItem("SMART_KEY"));
  const saved = JSON.parse(sessionStorage.getItem(key));
  saved.tokenResponse = saved.tokenResponse || {};
  saved.tokenResponse.patient = patientId;
  if (encounterId) saved.tokenResponse.encounter = encounterId;
  sessionStorage.setItem(key, JSON.stringify(saved));
}

function describe(p) {
  const n = (p.name && (p.name.find((x) => x.use === "official") || p.name[0])) || {};
  const name = [(n.given || []).join(" "), n.family].filter(Boolean).join(" ") || "Unknown";
  const dob = p.birthDate ? new Date(p.birthDate) : null, now = new Date();
  let age = dob ? now.getFullYear() - dob.getFullYear() : null;
  if (dob && now < new Date(now.getFullYear(), dob.getMonth(), dob.getDate())) age--;
  if (!(n.given || n.family) && n.text) return `${n.text} · ${p.gender || ""}${p.birthDate ? " · DOB " + p.birthDate : ""}`;
  return `${name} · ${p.gender || ""}${age != null && !isNaN(age) ? " · " + age + " y" : ""} · DOB ${p.birthDate || "?"}`;
}
function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
