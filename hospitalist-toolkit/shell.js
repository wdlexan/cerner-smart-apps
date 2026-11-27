/* Hospitalist Toolkit - one launch, one patient, each tool in its own tab.
   The shell finishes the SMART sign-in once; each tab then loads its tool from tools/<name>/index.html.
   The tools pick up the same sign-in automatically (same browser tab, same site), so they run unchanged.
   A tab is only loaded the first time you open it, and stays loaded when you switch away. */

// To add a tool: put its files in tools/<folder>/ and add a line here.
const TOOL_V = "20261127k"; // bump this whenever a tool changes, so browsers do not show a stale cached tab
const TOOLS = [
  { key: "today", label: "Today (what changed)", tags: "what changed daily trends vitals overnight summary", path: "tools/today/index.html" },
  { key: "plist", label: "Patient list (screenshot)", tags: "patient list screenshot excel spreadsheet rounding list census floor ward ocr", path: "tools/plist/index.html" },
  { key: "round", label: "Rounding notebook", tags: "rounding notebook daily notes handover handoff sign out to do pending tests antibiotic countdown watch for discharge summary follow-up admission summary paste", path: "tools/round/index.html", keepHeader: true }, // its header holds My week, Handover all, OneDrive and Settings
  { key: "labs",  label: "Labs", tags: "lab results cbc lytes electrolytes chemistry blood work",                 path: "tools/labs/index.html" },
  { key: "crit",  label: "Critical labs → MRP", tags: "critical lab alert mrp teams page message",  path: "tools/critical/index.html" },
  { key: "notes", label: "Notes", tags: "notes documents progress note discharge summary compile",                path: "tools/notes/index.html" },
  { key: "exam",  label: "Physical exam", tags: "physical exam template normal",        path: "tools/exam/index.html", keepHeader: true }, // its header holds the template picker and All normal
  { key: "deprx", label: "Deprescribing", tags: "deprescribing deprescribe polypharmacy medication review stopp start stoppfall stoppfrail beers anticholinergic burden acb falls frid renal dose kidney crcl no indication cascade taper stop medstopper ppi benzodiazepine zopiclone antipsychotic", path: "tools/deprx/index.html" },
  { key: "meds",  label: "Meds review (Beers)", tags: "medications beers criteria elderly geriatric polypharmacy deprescribing",  path: "tools/meds/index.html" },
  { key: "ddi",   label: "Drug interactions (QT, serotonin, seizure)", tags: "drug interactions ddi interaction qt qtc prolongation torsades tdp tisdale serotonin syndrome serotonergic hunter linezolid maoi ssri snri tramadol seizure threshold lowers seizure risk bupropion carbapenem valproate cefepime methadone citalopram ondansetron haloperidol", path: "tools/ddi/index.html" },
  { key: "supp",  label: "Supplement interactions", tags: "supplements supplement herbal herbals natural health products vitamins minerals otc naturopath st johns wort ginkgo garlic ginseng turmeric curcumin fish oil omega-3 vitamin k vitamin e vitamin d calcium iron magnesium zinc potassium salt substitute biotin melatonin valerian kava ashwagandha echinacea goldenseal berberine cbd cannabis grapefruit red yeast rice licorice glucosamine cranberry dong quai coq10 probiotic kratom 5-htp chelation spacing levothyroxine quinolone bisphosphonate tacrolimus warfarin pre-op surgery", path: "tools/supp/index.html" },
  { key: "g6pd",  label: "G6PD check", tags: "g6pd hemolysis drug safety rasburicase primaquine dapsone",           path: "tools/g6pd/index.html" },
  { key: "risk",  label: "Risk screen", tags: "risk screen pressure injury ulcer nutrition sleep dysphagia falls",          path: "tools/risk/index.html" },
  { key: "wound", label: "Wound care", tags: "wound care dressing dressings pressure injury ulcer bedsore decubitus sacral heel stage braden npwt vac negative pressure foam hydrocolloid alginate hydrofibre aquacel hydrogel silver iodine honey skin tear diabetic foot venous arterial dehiscence fungating iad incontinence dermatitis nswoc photo picture image review ai", path: "tools/wound/index.html" },
  { key: "opioid", label: "Opioid safety", tags: "opioid safety narcotics naloxone morphine oxycodone hydromorphone",       path: "tools/opioid/index.html" },
  { key: "pain",  label: "Pain management", tags: "pain management analgesia",      path: "tools/pain/index.html" },
  { key: "abx",   label: "Antibiotics", tags: "antibiotics antimicrobial stewardship iv po switch duration",          path: "tools/abx/index.html" },
  { key: "abxmap", label: "Antibiotic chooser (body map)", tags: "antibiotic chooser body map which antibiotic empiric choice site lung skin bladder kidney prostate colon gallbladder joint brain sinus dental groin sepsis c diff allergy mrsa esbl pseudomonas", path: "tools/abxmap/index.html" },
  { key: "hahabx", label: "HaH antibiotics (home IV)", tags: "hospital at home hah opat home iv antibiotics elastomeric ball continuous infusion cadd pump nurse visits bid tid meropenem ertapenem piperacillin tazobactam cloxacillin cefazolin probenecid penicillin ceftazidime vancomycin", path: "tools/hahabx/index.html" },
  { key: "fuo",   label: "Fever of unknown origin (FUO)", tags: "fuo fever of unknown origin pyrexia prolonged fever unexplained fever nosocomial fever neutropenic fever drug fever hlh hscore still disease yamaguchi gca giant cell arteritis temporal arteritis pet-ct pet ct endocarditis culture negative tb tuberculosis lymphoma ferritin night sweats relative bradycardia", path: "tools/fuo/index.html" },
  { key: "asplenia", label: "Asplenia (no spleen)", tags: "asplenia asplenic hyposplenia hyposplenism splenectomy no spleen post-splenectomy opsi overwhelming post splenectomy infection sickle cell howell-jolly encapsulated pneumococcal vaccine pcv20 pcv21 prevnar pneumovax ppv23 meningococcal menacwy menveo menquadfi nimenrix menb bexsero trumenba hib vaccine booster prophylaxis penicillin v standby antibiotic pill in pocket capnocytophaga dog bite babesia malaria pneumonia ceftriaxone", path: "tools/asplenia/index.html" },
  { key: "inf",   label: "Infections by site", tags: "infections sepsis pneumonia uti cellulitis source",   path: "tools/infections/index.html" },
  { key: "cw",    label: "Choosing Wisely", tags: "choosing wisely low value tests overuse",      path: "tools/cw/index.html", keepHeader: true }, // its header holds the Look back control
  { key: "dx",    label: "Diagnosis check", tags: "diagnosis check cognitive bias second look missed differential harm",      path: "tools/dx/index.html", keepHeader: true }, // its header holds the Look back control
  { key: "ed",    label: "ED screen", tags: "ed er emergency screen admission",            path: "tools/ed/index.html" },
  { key: "hah",   label: "Hospital at Home", tags: "hospital at home hah virtual ward escalation risk repatriation predictor asthma transfer matrix death in the home edith expected death",     path: "tools/hah/index.html" },
  { key: "calc",  label: "Calculators", tags: "calculators scores egfr curb chads wells",          path: "tools/calc/index.html" },
  { key: "ai",    label: "AI summary", tags: "ai summary draft llm",           path: "tools/ai/index.html" },
  { key: "pc",    label: "Peritoneal carcinomatosis", tags: "peritoneal carcinomatosis peritoneum metastases omental cake pci sugarbaker hipec crs cytoreduction malignant bowel obstruction mbo sbo octreotide buscopan venting peg malignant ascites paracentesis pleurx indwelling catheter colorectal gastric ovarian pseudomyxoma cea ca-125 chemo oncology prognosis", path: "tools/pc/index.html" },
  { key: "ild",   label: "ILD (interstitial lung disease)", tags: "ild interstitial lung disease pulmonary fibrosis ipf uip nsip organizing pneumonia hypersensitivity pneumonitis sarcoid acute exacerbation ground glass honeycombing drug pneumonitis amiodarone nitrofurantoin methotrexate ctd myositis anti-synthetase mda5 nintedanib pirfenidone home oxygen gap respirology", path: "tools/ild/index.html" },
  { key: "onc",   label: "Oncology (common cancers)", tags: "oncology cancer myeloma plasmacytoma paraprotein light chains bladder urothelial bcg enfortumab melanoma braf ipilimumab head and neck oropharynx larynx tracheostomy laryngectomy kidney renal cell rcc cabozantinib belzutifan pancreas pancreatic folfirinox cholangitis leukemia leukaemia aml apl all cml cll lymphoma hodgkin dlbcl follicular mantle burkitt cns lymphoma car-t venetoclax rituximab r-chop leukostasis differentiation syndrome dic hlh lung nsclc sclc small cell breast colorectal colon rectal prostate metastatic palliative curative chemotherapy immunotherapy targeted egfr alk her2 adt abiraterone enzalutamide febrile neutropenia cord compression mscc hypercalcemia tumour lysis tls svc brain mets mascc emergencies", path: "tools/onc/index.html" },
  { key: "tox",   label: "Oncology toxicity", tags: "oncology toxicity chemotherapy immunotherapy cancer",    path: "tools/tox/index.html", keepHeader: true }, // its header holds the draft/version note
  { key: "watch", label: "Watch-ahead", tags: "watch ahead deterioration early warning",          path: "tools/watch/index.html", keepHeader: true }, // its header holds the draft/version note
  { key: "bsab",  label: "CRS/ICANS (bispecific)", tags: "crs icans bispecific teclistamab myeloma cytokine release", path: "tools/bispecific/index.html" },
  { key: "ibd",   label: "IBD flowsheet (Crohn/UC)", tags: "ibd crohn colitis ulcerative asuc", path: "tools/ibd/index.html" },
  { key: "liver", label: "Liver (cirrhosis)", tags: "liver cirrhosis hepatic encephalopathy ascites meld varices", path: "tools/liver/index.html" },
  { key: "cryo",  label: "Cryoneurolysis", tags: "cryoneurolysis cryoneurotomy cryoablation cryo iovera freeze nerve spasticity spastic contracture clonus botulinum botox baclofen stroke hemiplegic shoulder pain knee osteoarthritis genicular tka peng hip fracture non-operative palliative winston vincent vgh spasticity clinic diagnostic nerve block", path: "tools/cryo/index.html" },
  { key: "sbo",   label: "Small bowel obstruction (SBO)", tags: "sbo small bowel obstruction bowel obstruction ileus lbo large bowel obstruction volvulus ogilvie pseudo-obstruction adhesions hernia incarcerated strangulated closed loop whirl ischemia perforation free air pneumoperitoneum lactate gastrografin water-soluble contrast ng tube nasogastric npo malignant bowel obstruction octreotide vomiting distension", path: "tools/sbo/index.html" },
  { key: "hypona", label: "Sodium (hypo / hyper)", tags: "hyponatremia hypernatremia sodium low high na siadh diabetes insipidus free water deficit", path: "tools/hypona/index.html" },
  { key: "hip",   label: "Hip fracture", tags: "hip fracture fragility orthopedics ortho",         path: "tools/hip/index.html" },
  { key: "consult", label: "Consult summary", tags: "consult summary",    path: "tools/consult/index.html" },
  { key: "mobility", label: "Mobility & discharge", tags: "mobility discharge pt ot function planning", path: "tools/mobility/index.html" },
  { key: "discharge", label: "Discharge note", tags: "discharge summary note instructions what changed medication reconciliation pending results incidental findings follow-up family physician fp return precautions 911 when to call handout", path: "tools/discharge/index.html" },
  { key: "dcclinic", label: "Discharge Clinic (South Island)", tags: "discharge clinic south island rjh sidc rapid follow-up urgent outpatient referral close follow up umac upcc holter gdmt", path: "tools/dcclinic/index.html" },
  { key: "pd",    label: "Parkinson disease", tags: "parkinson pd levodopa",    path: "tools/pd/index.html" },
  { key: "dementia", label: "Dementia workup", tags: "dementia cognitive impairment memory delirium workup",  path: "tools/dementia/index.html" },
  { key: "aki",   label: "AKI", tags: "aki acute kidney injury creatinine renal",                  path: "tools/aki/index.html" },
  { key: "as",    label: "Aortic stenosis", tags: "aortic stenosis as tavi tavr savr avr valve echo gradient low flow low gradient dobutamine calcium score heart team murmur", path: "tools/as/index.html" },
  { key: "echo",  label: "Echo compare", tags: "echo echocardiogram tte tee compare prior current change lvef ef wall motion rvsp tapse valve stenosis regurgitation effusion vegetation aorta hfimpef", path: "../echo/index.html", keepHeader: true }, // its header holds the tool's own tabs
  { key: "chf",   label: "Heart failure (CHF)",  tags: "chf heart failure hf adhf congestion nt-probnp bnp diuretic furosemide lasix bumetanide torsemide metolazone acetazolamide gdmt entresto sglt2 amyloid amyloidosis edema handout dry weight", path: "tools/chf/index.html" },
  { key: "acs",   label: "NSTEMI (ACS)", tags: "nstemi acs acute coronary syndrome mi myocardial infarction heart attack troponin type 2 mi dapt dual antiplatelet aspirin ticagrelor prasugrel clopidogrel heparin enoxaparin fondaparinux cath angiography pci stent cabg bypass syntax grace timi bleeding risk arc-hbr statin beta blocker cardiac rehab", path: "tools/acs/index.html" },
  { key: "pleural", label: "Pleural effusion", tags: "pleural effusion thoracentesis tap chest tube chest drain pigtail ipc indwelling pleural catheter pleurx talc pleurodesis empyema parapneumonic hemothorax chylothorax hepatic hydrothorax light criteria exudate transudate pleural fluid ph ldh glucose ada tpa dnase mist2 rapid lent air leak subcutaneous emphysema re-expansion pulmonary edema", path: "tools/pleural/index.html" },
  { key: "af",    label: "AF (acute illness)",   tags: "atrial fibrillation afib a fib rapid ventricular rvr rate control digoxin metoprolol beta blocker diltiazem amiodarone anticoagulation chads65 pneumonia sepsis", path: "tools/af/index.html" },
  { key: "acls",  label: "ACLS (code & peri-arrest)", tags: "acls code blue cardiac arrest cpr resuscitation rosc code timer epinephrine amiodarone lidocaine defibrillation shock vf vt pea asystole hs and ts reversible causes bradycardia atropine pacing tachycardia cardioversion synchronized adenosine procainamide torsades post arrest targeted temperature dnr most code status goals of care family update", path: "tools/acls/index.html" },
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
  { key: "forms", label: "Forms", tags: "forms referral requisition pdf form 4.1 bc cancer pulse gi heart function umac acute neurology neuro clinic first seizure clinic rjh headache migraine complex headache clinic edith expected death in the home funeral home hlth 3987 palliative end of life",                path: "tools/forms/index.html" }
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
  window.CONSULT_CTX = { client, override: () => { const f = document.querySelector(`#frames iframe.on[data-k="${window.__tkTab}"]`); try { if (f && f.contentWindow.consultPatient) return f.contentWindow.consultPatient(); } catch (e) {}
      // test mode: use the patient open in the Rounding notebook rather than the sandbox test patient
      try { if (sessionStorage.getItem("toolkit-test") === "1") { const r = document.querySelector('#frames iframe[data-k="round"]'); if (r && r.contentWindow.consultPatient) return r.contentWindow.consultPatient(); return notebookConsultPt(); } } catch (e) {}
      return null; }, tabKey: () => window.__tkTab || "", topic: () => { const t = TOOLS.find((x) => x.key === window.__tkTab); return t ? t.label.replace(/\s*\(.*?\)/, "") : ""; } };
  window.TK = { patientId: client.patient.id, isPdfPatient: /^pdfpt-/.test(client.patient.id), switchPatient, backToCerner }; // used by the PDF import button
  try { $("patient").textContent = describe(await client.patient.read()); }
  catch (e) { $("patient").textContent = "Patient " + client.patient.id; }
  if (POCKET) pocketChip();
  else if (window.TK.isPdfPatient) pdfPatientChip();
  let testMode = false; try { testMode = sessionStorage.getItem("toolkit-test") === "1"; } catch (e) {}
  // Test mode: the sandbox test patient is only there so the tabs can load; do not show its name (Forms and Consult use the Rounding notebook patient instead)
  if (testMode) $("patient").innerHTML = `<span style="background:#fff3cd;color:#7a4b00;border-radius:10px;padding:1px 8px;font-weight:700;margin-right:6px">TEST MODE · open sandbox, no login</span>`;
  $("msg").remove();

  buildNav();
  setupSearch();

  // Open the tab named in the address (#labs), else the last one used, else Today
  let first = (target && target.tab) || location.hash.slice(1);
  if (!TOOLS.some((t) => t.key === first)) { try { first = localStorage.getItem(TAB_KEY); } catch (e) {} }
  if (!TOOLS.some((t) => t.key === first)) first = TOOLS[0].key;
  show(first);
  if (window.TKSuggest) window.TKSuggest.init(client); // "Which tool?" pop-up (suggest.js): reads the chart and lists the tabs that fit
}

// ---- Tool menus: a few pinned tools, then pull-down menus by topic (desktop). The phone keeps one scrolling row.
// Every tool also has a (hidden) plain button in #tabs, so search results and links like #tabs button[data-k="…"] keep working.
const PINNED = ["today", "plist", "round"];
const GROUPS = [
  { name: "Chart", keys: ["labs", "crit", "notes", "exam", "watch", "ai", "calc"] },
  { name: "Heart & lung", keys: ["acls", "acs", "chf", "as", "echo", "af", "ild", "pleural"] },
  { name: "Kidney", keys: ["aki", "lytes", "hypona", "acidbase", "ktx"] },
  { name: "Neuro", keys: ["neuro", "stroke", "seizure", "dementia", "pd", "ae", "cryo"] },
  { name: "GI & endo", keys: ["liver", "sbo", "ibd", "dm", "edr"] },
  { name: "Infection", keys: ["abx", "abxmap", "hahabx", "inf", "fuo", "asplenia"] },
  { name: "Onc & heme", keys: ["onc", "tox", "bsab", "pc", "g6pd", "sero"] },
  { name: "Safety", keys: ["ddi", "supp", "deprx", "meds", "opioid", "pain", "risk", "wound", "cw", "dx"] },
  { name: "Admit & discharge", keys: ["ed", "hah", "hip", "consult", "mobility", "discharge", "dcclinic", "forms"] }];
const short = (label) => label.replace(/\s*\(.*?\)\s*/g, " ").trim();
function buildNav() {
  const nav = $("tabs"), have = new Set(TOOLS.map((t) => t.key)), lab = (k) => (TOOLS.find((t) => t.key === k) || {}).label || k;
  const flat = TOOLS.map((t) => `<button data-k="${t.key}">${esc(t.label)}</button>`).join("");
  if (POCKET) { nav.innerHTML = flat; nav.querySelectorAll("button[data-k]").forEach((b) => (b.onclick = () => show(b.dataset.k))); return; }
  const used = new Set(PINNED.concat(GROUPS.flatMap((g) => g.keys)));
  const groups = GROUPS.map((g) => ({ name: g.name, keys: g.keys.filter((k) => have.has(k)) })).concat([{ name: "More", keys: TOOLS.map((t) => t.key).filter((k) => !used.has(k)) }]).filter((g) => g.keys.length);
  nav.classList.add("menus-on");
  const PIN_LABEL = { today: "Today", plist: "Patient list" };
  nav.innerHTML = `<span class="menus">${PINNED.filter((k) => have.has(k)).map((k) => `<button data-k="${k}" title="${esc(lab(k))}">${esc(PIN_LABEL[k] || lab(k))}</button>`).join("")}` +
    groups.map((g, i) => `<button class="gbtn" data-g="${i}" aria-haspopup="menu" aria-expanded="false">${esc(g.name)} <span class="caret">▾</span><span class="gcur"></span></button>`).join("") +
    `</span><span class="flat">${flat}</span>`;
  nav.querySelectorAll("button[data-k]").forEach((b) => (b.onclick = () => show(b.dataset.k)));
  let menu = document.getElementById("gmenu");
  if (!menu) { menu = document.createElement("div"); menu.id = "gmenu"; menu.setAttribute("role", "menu"); menu.hidden = true; document.body.appendChild(menu); }
  let openBtn = null;
  const close = () => { menu.hidden = true; if (openBtn) { openBtn.setAttribute("aria-expanded", "false"); openBtn.classList.remove("open"); } openBtn = null; };
  const open = (btn) => {
    if (openBtn === btn) { close(); return; }
    close(); const g = groups[+btn.dataset.g]; openBtn = btn; btn.setAttribute("aria-expanded", "true"); btn.classList.add("open");
    menu.innerHTML = g.keys.map((k) => `<button role="menuitem" data-k="${k}" class="${k === window.__tkTab ? "on" : ""}">${esc(lab(k))}</button>`).join("");
    menu.querySelectorAll("button").forEach((b) => (b.onclick = () => { close(); show(b.dataset.k); }));
    const r = btn.getBoundingClientRect(); menu.hidden = false;
    menu.style.top = Math.round(r.bottom + 2) + "px"; menu.style.left = Math.round(Math.min(r.left, window.innerWidth - menu.offsetWidth - 8)) + "px";
    (menu.querySelector("button.on") || menu.querySelector("button")).focus();
  };
  nav.querySelectorAll(".gbtn").forEach((b) => { b.onclick = (e) => { e.stopPropagation(); open(b); }; b.onkeydown = (e) => { if (e.key === "ArrowDown") { e.preventDefault(); if (openBtn !== b) open(b); } }; });
  menu.onkeydown = (e) => {
    const items = Array.from(menu.querySelectorAll("button")), i = items.indexOf(document.activeElement);
    if (e.key === "ArrowDown") { e.preventDefault(); items[(i + 1) % items.length].focus(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); }
    else if (e.key === "Escape") { const b = openBtn; close(); if (b) b.focus(); }
    else if (e.key === "Tab") close();
  };
  document.addEventListener("click", (e) => { if (!menu.hidden && !menu.contains(e.target)) close(); });
  window.addEventListener("resize", close); nav.addEventListener("scroll", close);
  window.addEventListener("blur", () => setTimeout(() => { if (document.activeElement && document.activeElement.tagName === "IFRAME") close(); }, 0)); // clicked into a tool
  window.__markMenus = (key) => nav.querySelectorAll(".gbtn").forEach((b) => {
    const g = groups[+b.dataset.g], on = g.keys.includes(key);
    b.classList.toggle("on", on); b.querySelector(".gcur").textContent = on ? " · " + short(lab(key)) : "";
  });
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
    $("tabs").classList.toggle("searching", !!box.value.trim()); // menus give way to a flat list of matches while typing
    document.querySelectorAll("#tabs .flat button[data-k], #tabs.searching button[data-k], #tabs:not(.menus-on) button[data-k]").forEach((b) => (b.hidden = !keys.includes(b.dataset.k)));
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

// Open a tab at one section: showAt("chf", "handout-card", "dc") opens CHF, its "dc" sub-tab, and scrolls to #handout-card.
window.showAt = function (key, id, sub) {
  show(key);
  const f = document.querySelector(`#frames iframe[data-k="${key}"]`);
  const go = () => { try {
      const w = f.contentWindow, d = f.contentDocument, el = d && d.getElementById(id); if (!el) return false;
      if (sub && w.SubTabs && w.SubTabs.show) w.SubTabs.show(sub);
      if (el.tagName === "DETAILS") el.open = true;
      el.scrollIntoView({ behavior: "smooth", block: "start" }); return true; } catch (e) { return false; } };
  if (go()) return;
  let n = 0; const t = setInterval(() => { if (go() || ++n > 60) { clearInterval(t); setTimeout(go, 1200); } }, 250); // first visit: wait for the tab to load, then once more after the chart fills in
};
// Tabs that keep their own list of patients (Rounding notebook, Patient list): the Cerner/test patient in the header does not apply, so hide it there
const OWN_PATIENTS = ["round", "plist"];
// Rounding notebook's open patient, read straight from its saved list (for Consult in test mode before the notebook tab is opened)
function notebookConsultPt() {
  let S = null; try { S = JSON.parse(localStorage.getItem("rounding-notebook-v1") || "null"); } catch (e) {}
  const p = S && (S.patients || []).find((x) => x.id === S.cur); if (!p) return null;
  let n = String(p.name || "").trim(); if (/,/.test(n)) n = n.split(",").map((x) => x.trim()).filter(Boolean).reverse().join(" ");
  const act = ((p.admission && p.admission.problems) || []).filter((x) => x.text && x.status !== "Resolved").map((x) => x.text);
  let hx = (p.admission && p.admission.oneLiner) || p.reason || ""; hx = hx.replace(/^This is an? /i, "").replace(/^\d+[- ]?(year|yr|y)[- ]?old\s+(male|female|man|woman|M|F)\b[,]?\s*(with\s+)?(an?\s+)?/i, "").replace(/\s+/g, " ").trim();
  hx = hx.charAt(0).toUpperCase() + hx.slice(1); const w = hx.split(" "); if (w.length > 28) hx = w.slice(0, 28).join(" ") + "…";
  return { key: p.id, name: n, age: p.age || "", sex: /^f/i.test(p.sex || "") ? "female" : /^m/i.test(p.sex || "") ? "male" : "", mrn: p.mrn || "", problem: act[0] || String(p.reason || "").slice(0, 60), hx, problems: act };
}
function show(key) {
  document.body.classList.toggle("own-pts", OWN_PATIENTS.includes(key));
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
  document.querySelectorAll("#tabs button[data-k]").forEach((b) => b.classList.toggle("on", b.dataset.k === key));
  if (window.__markMenus) window.__markMenus(key);
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
