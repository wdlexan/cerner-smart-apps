/* Physical Exam – click-to-document SMART on FHIR app (Cerner)
 * Each system has elements; each element has one normal phrase and a list of
 * abnormal phrases. Clicking builds a note to paste into PowerChart.
 */

// ---------------------------------------------------------------- exam content
const SYSTEMS = [
  { id: "gen", name: "General", els: [
    { id: "app", label: "Appearance", n: "well-appearing, in no acute distress",
      a: ["unwell-appearing", "in mild distress", "in moderate distress", "in severe distress",
          "diaphoretic", "pale", "cachectic", "frail", "obese", "in pain at rest"] },
    { id: "ms", label: "Mental status", n: "alert and oriented x3",
      a: ["oriented to person and place only", "oriented to person only", "disoriented",
          "drowsy but rousable to voice", "rousable to pain only", "unresponsive",
          "inattentive (CAM positive)", "agitated", "hypoactive and withdrawn"] },
    { id: "hyd", label: "Hydration", n: "mucous membranes moist",
      a: ["dry mucous membranes", "reduced skin turgor", "appears volume overloaded"] },
  ]},
  { id: "heent", name: "HEENT / Neck", els: [
    { id: "eyes", label: "Eyes", n: "pupils equal and reactive, sclerae anicteric, no conjunctival pallor",
      a: ["scleral icterus", "conjunctival pallor", "anisocoria", "pupils sluggish",
          "pinpoint pupils", "periorbital edema", "conjunctival injection"] },
    { id: "oro", label: "Mouth / throat", n: "oropharynx clear",
      a: ["oral thrush", "poor dentition", "dental abscess", "tonsillar exudate",
          "tongue laceration", "mucositis", "dry tongue"] },
    { id: "neck", label: "Neck", n: "neck supple, no lymphadenopathy",
      a: ["cervical lymphadenopathy", "supraclavicular lymphadenopathy", "meningismus",
          "neck stiffness", "thyromegaly", "thyroid nodule", "tracheal deviation"] },
  ]},
  { id: "cvs", name: "Cardiovascular", els: [
    { id: "rhy", label: "Rate / rhythm", n: "regular rate and rhythm",
      a: ["irregularly irregular", "tachycardic", "bradycardic", "regularly irregular"] },
    { id: "hs", label: "Heart sounds", n: "normal S1 S2, no murmurs, rubs or gallops",
      a: ["systolic ejection murmur at RUSB", "holosystolic murmur at apex", "diastolic murmur",
          "new murmur", "S3 present", "S4 present", "pericardial rub", "muffled heart sounds",
          "mechanical valve click"] },
    { id: "jvp", label: "JVP", n: "JVP not elevated",
      a: ["JVP elevated", "JVP elevated to angle of jaw", "positive abdominojugular reflux",
          "JVP not seen", "Kussmaul sign"] },
    { id: "ed", label: "Edema", n: "no peripheral edema",
      a: ["trace pedal edema", "1+ pitting edema to ankles", "2+ pitting edema to mid-shin",
          "3+ pitting edema to knees", "pitting edema to thighs", "sacral edema",
          "asymmetric leg swelling L > R", "asymmetric leg swelling R > L"] },
    { id: "perf", label: "Perfusion", n: "extremities warm and well perfused, capillary refill < 2 s",
      a: ["cool peripheries", "mottled knees", "capillary refill > 3 s",
          "diminished pedal pulses", "absent pedal pulses", "radial-radial delay"] },
  ]},
  { id: "resp", name: "Respiratory", els: [
    { id: "wob", label: "Work of breathing", n: "no increased work of breathing, speaking in full sentences",
      a: ["tachypneic", "accessory muscle use", "speaking in short phrases", "speaking in single words",
          "pursed-lip breathing", "paradoxical breathing", "stridor", "on nasal prongs",
          "on high-flow nasal cannula", "on BiPAP"] },
    { id: "ae", label: "Air entry", n: "good air entry bilaterally",
      a: ["reduced air entry right base", "reduced air entry left base",
          "reduced air entry bilateral bases", "silent chest", "absent breath sounds right",
          "absent breath sounds left"] },
    { id: "bs", label: "Added sounds", n: "vesicular breath sounds, no crackles or wheeze",
      a: ["bibasilar crackles", "right basal crackles", "left basal crackles",
          "crackles to mid-zones", "diffuse expiratory wheeze", "polyphonic wheeze",
          "bronchial breathing right base", "bronchial breathing left base",
          "prolonged expiratory phase", "coarse crackles that clear with cough"] },
    { id: "perc", label: "Percussion", n: "resonant to percussion",
      a: ["dull to percussion right base", "dull to percussion left base", "hyperresonant"] },
  ]},
  { id: "abdo", name: "Abdomen", els: [
    { id: "insp", label: "Inspection", n: "abdomen soft and non-distended",
      a: ["distended", "tense", "obese", "surgical scars", "caput medusae", "ostomy present",
          "PEG tube in situ"] },
    { id: "tend", label: "Tenderness", n: "non-tender, no guarding or rebound",
      a: ["RUQ tenderness", "epigastric tenderness", "LUQ tenderness", "RLQ tenderness",
          "LLQ tenderness", "suprapubic tenderness", "diffuse tenderness", "voluntary guarding",
          "involuntary guarding", "rebound tenderness", "Murphy sign positive",
          "right CVA tenderness", "left CVA tenderness"] },
    { id: "org", label: "Organs / masses", n: "no hepatosplenomegaly or masses",
      a: ["hepatomegaly", "splenomegaly", "palpable mass", "shifting dullness", "fluid wave",
          "palpable bladder", "reducible hernia", "irreducible hernia"] },
    { id: "bow", label: "Bowel sounds", n: "normal bowel sounds",
      a: ["hypoactive bowel sounds", "absent bowel sounds", "hyperactive bowel sounds",
          "tinkling bowel sounds"] },
    { id: "pr", label: "DRE (if done)", n: "DRE: normal tone, brown stool, no melena or blood",
      a: ["DRE: melena", "DRE: bright red blood", "DRE: fecal impaction", "DRE: reduced tone",
          "DRE: enlarged prostate"] },
  ]},
  { id: "lines", name: "Lines / devices", els: [
    { id: "iv", label: "IV sites", n: "IV site clean, no erythema or tenderness",
      a: ["IV site erythematous", "IV site tender with cord (phlebitis)", "PICC site clean",
          "PICC site erythematous", "central line site clean", "central line site erythematous"] },
    { id: "dev", label: "Other devices", n: "no urinary catheter",
      a: ["urinary catheter in situ", "drain in situ", "chest tube in situ", "NG tube in situ",
          "telemetry on", "nephrostomy tube in situ"] },
  ]},
  { id: "skin", name: "Skin / wounds", els: [
    { id: "sk", label: "Skin", n: "warm and dry, no rashes",
      a: ["jaundice", "pallor", "cyanosis", "petechiae", "purpura", "ecchymoses",
          "maculopapular rash", "urticaria", "spider angiomata", "palmar erythema",
          "cellulitis of lower leg", "skin tears"] },
    { id: "pi", label: "Pressure areas", n: "no pressure injuries",
      a: ["sacral pressure injury stage 1", "sacral pressure injury stage 2",
          "sacral pressure injury stage 3–4", "heel pressure injury", "unstageable pressure injury",
          "deep tissue injury"] },
    { id: "wd", label: "Wounds", n: "no wounds",
      a: ["surgical wound clean, dry and intact", "wound erythema", "wound discharge",
          "wound dehiscence", "venous ulcer", "arterial ulcer", "diabetic foot ulcer"] },
  ]},
  { id: "msk", name: "Musculoskeletal", els: [
    { id: "jt", label: "Joints", n: "no joint swelling, effusion or tenderness",
      a: ["knee effusion", "hot swollen joint", "gouty tophi", "synovitis of hands",
          "reduced range of motion", "joint deformity"] },
    { id: "limb", label: "Limbs / hip", n: "no limb deformity",
      a: ["right leg shortened and externally rotated", "left leg shortened and externally rotated",
          "pain on hip movement", "calf tenderness", "compartments soft",
          "distal neurovascular status intact", "post-op dressing clean and dry"] },
    { id: "sp", label: "Spine", n: "no spinal tenderness",
      a: ["midline spinal tenderness", "paraspinal tenderness", "kyphosis"] },
  ]},
  { id: "neuro", name: "Neurological", els: [
    { id: "gcs", label: "Level", n: "GCS 15",
      a: ["GCS 13–14", "GCS 9–12", "GCS ≤ 8"] },
    { id: "spch", label: "Speech", n: "speech fluent, no dysarthria or aphasia",
      a: ["dysarthria", "expressive aphasia", "receptive aphasia", "word-finding difficulty"] },
    { id: "cn", label: "Cranial nerves", n: "cranial nerves II–XII grossly intact",
      a: ["left facial droop", "right facial droop", "gaze deviation", "visual field defect",
          "nystagmus", "diplopia", "tongue deviation"] },
    { id: "mot", label: "Motor", n: "power 5/5 in all limbs, normal tone",
      a: ["left hemiparesis", "right hemiparesis", "proximal weakness", "bilateral leg weakness",
          "pronator drift", "increased tone", "cogwheel rigidity", "generalized weakness"] },
    { id: "sens", label: "Sensation", n: "sensation grossly intact",
      a: ["reduced sensation left side", "reduced sensation right side",
          "stocking distribution sensory loss", "sensory level"] },
    { id: "refl", label: "Reflexes", n: "reflexes symmetric, plantars downgoing",
      a: ["hyperreflexia", "hyporeflexia", "upgoing plantar left", "upgoing plantar right", "clonus"] },
    { id: "coord", label: "Coordination / gait", n: "no dysmetria, gait not assessed",
      a: ["gait normal", "dysmetria", "ataxic gait", "shuffling gait", "unable to assess gait",
          "asterixis", "rest tremor", "action tremor", "myoclonus"] },
  ]},
  { id: "psych", name: "Psychiatric", els: [
    { id: "mood", label: "Mood / affect", n: "calm and cooperative, affect appropriate",
      a: ["anxious", "low mood", "flat affect", "labile affect", "irritable", "agitated"] },
    { id: "tp", label: "Thought", n: "thought process linear, no perceptual disturbance",
      a: ["tangential", "disorganized", "paranoid ideation", "responding to internal stimuli",
          "poor insight"] },
  ]},
];

// Exam templates: which systems are shown (and filled by "All normal")
const TEMPLATES = {
  "Admission – full":        ["gen","heent","cvs","resp","abdo","lines","skin","msk","neuro","psych"],
  "Daily progress":          ["gen","cvs","resp","abdo","lines","skin"],
  "Heart failure":           ["gen","heent","cvs","resp","abdo","skin"],
  "Pneumonia / COPD":        ["gen","heent","cvs","resp"],
  "Sepsis / fever":          ["gen","heent","cvs","resp","abdo","lines","skin","msk","neuro"],
  "Stroke / neuro":          ["gen","cvs","neuro"],
  "Delirium":                ["gen","abdo","lines","skin","neuro","psych"],
  "Hip fracture / ortho":    ["gen","cvs","resp","lines","skin","msk","neuro"],
  "GI bleed / liver":        ["gen","heent","cvs","abdo","skin","neuro"],
};

const VITALS = [
  { id: "t",    label: "Temp (°C)",  codes: ["8310-5","8331-1"] },
  { id: "hr",   label: "HR",         codes: ["8867-4"] },
  { id: "bp",   label: "BP",         codes: ["85354-9","55284-4"] },
  { id: "rr",   label: "RR",         codes: ["9279-1"] },
  { id: "spo2", label: "SpO2 (%)",   codes: ["59408-5","2708-6"] },
  { id: "o2",   label: "O2",         codes: [] },
  { id: "wt",   label: "Weight (kg)",codes: ["29463-7","3141-9"] },
  { id: "pain", label: "Pain (/10)", codes: ["72514-3"] },
];

// ---------------------------------------------------------------- state
const state = {
  tpl: "Admission – full",
  shown: new Set(TEMPLATES["Admission – full"]),
  el: {},      // "sys.el" -> "n" | Set of abnormal phrases
  free: {},    // sys -> free text
  vit: {},     // vital id -> value
  vitTime: "",
  edited: false,
};
const $ = (s) => document.querySelector(s);
const key = (s, e) => s + "." + e;

// ---------------------------------------------------------------- render
function renderTemplates() {
  const sel = $("#tpl");
  sel.innerHTML = Object.keys(TEMPLATES).map(t => `<option>${t}</option>`).join("");
  sel.value = state.tpl;
  sel.onchange = () => {
    state.tpl = sel.value;
    state.shown = new Set(TEMPLATES[sel.value]);
    renderSystems(); build();
  };
}

function renderVitals() {
  $("#vitals").innerHTML = VITALS.map(v => v.id === "o2"
    ? `<div><label>${v.label}</label><select data-v="o2">
         ${["room air","nasal prongs","face mask","high-flow nasal cannula","non-rebreather","BiPAP"]
           .map(o => `<option ${state.vit.o2 === o ? "selected" : ""}>${o}</option>`).join("")}
       </select></div>`
    : `<div><label>${v.label}</label><input data-v="${v.id}" value="${state.vit[v.id] || ""}"></div>`
  ).join("");
  $("#vitals").querySelectorAll("[data-v]").forEach(inp => {
    inp.oninput = inp.onchange = () => { state.vit[inp.dataset.v] = inp.value; build(); };
  });
  $("#vsrc").textContent = state.vitTime;
}

function sysStatus(sys) {
  let any = false, ab = false, all = true;
  sys.els.forEach(e => {
    const v = state.el[key(sys.id, e.id)];
    if (!v) { all = false; return; }
    any = true;
    if (v !== "n") ab = true;
  });
  if (ab) return ["ab", "abnormal"];
  if (all) return ["ok", "normal"];
  if (any) return ["ok", "partly done"];
  return ["", "not done"];
}

function renderSystems() {
  const box = $("#systems");
  box.innerHTML = "";
  SYSTEMS.forEach(sys => {
    const card = document.createElement("div");
    card.className = "card" + (state.shown.has(sys.id) ? "" : " off");
    const [cls, txt] = sysStatus(sys);
    card.innerHTML = `
      <h2><span style="cursor:pointer" data-toggle title="Show / hide this system">${state.shown.has(sys.id) ? "▾" : "▸"} ${sys.name}</span>
        <span class="st ${cls}">${state.shown.has(sys.id) ? txt : "hidden"}</span><span class="sp"></span>
        ${state.shown.has(sys.id) ? `<button class="norm" data-alln>All normal</button><button data-clr>Clear</button>` : ""}
      </h2>
      <div class="els">
        ${sys.els.map(e => {
          const v = state.el[key(sys.id, e.id)];
          return `<div class="el"><div class="lab">${e.label}</div><div class="chips">
            <button class="chip n ${v === "n" ? "on" : ""}" data-e="${e.id}" data-n>✓ ${e.n}</button>
            ${e.a.map((a, i) => `<button class="chip a ${v instanceof Set && v.has(a) ? "on" : ""}" data-e="${e.id}" data-a="${i}">${a}</button>`).join("")}
          </div></div>`;
        }).join("")}
        <div class="free"><input placeholder="Other ${sys.name.toLowerCase()} findings (free text)…" value="${(state.free[sys.id] || "").replace(/"/g, "&quot;")}" data-free></div>
      </div>`;
    card.querySelector("[data-toggle]").onclick = () => {
      state.shown.has(sys.id) ? state.shown.delete(sys.id) : state.shown.add(sys.id);
      renderSystems(); build();
    };
    const alln = card.querySelector("[data-alln]");
    if (alln) alln.onclick = () => { sys.els.forEach(e => { if (!isAbn(sys, e)) state.el[key(sys.id, e.id)] = "n"; }); renderSystems(); build(); };
    const clr = card.querySelector("[data-clr]");
    if (clr) clr.onclick = () => { sys.els.forEach(e => delete state.el[key(sys.id, e.id)]); state.free[sys.id] = ""; renderSystems(); build(); };
    card.querySelectorAll(".chip").forEach(b => b.onclick = () => clickChip(sys, b));
    const fr = card.querySelector("[data-free]");
    if (fr) fr.oninput = () => { state.free[sys.id] = fr.value; build(); };
    box.appendChild(card);
  });
}

function isAbn(sys, e) { const v = state.el[key(sys.id, e.id)]; return v instanceof Set && v.size; }

function clickChip(sys, b) {
  const e = sys.els.find(x => x.id === b.dataset.e);
  const k = key(sys.id, e.id);
  if ("n" in b.dataset) {
    state.el[k] = state.el[k] === "n" ? undefined : "n";
  } else {
    const a = e.a[+b.dataset.a];
    let v = state.el[k];
    if (!(v instanceof Set)) v = new Set();
    v.has(a) ? v.delete(a) : v.add(a);
    state.el[k] = v.size ? v : undefined;
  }
  if (!state.el[k]) delete state.el[k];
  renderSystems(); build();
}

// ---------------------------------------------------------------- note
const cap = s => s ? s[0].toUpperCase() + s.slice(1) : s;

function vitalsLine() {
  const v = state.vit, p = [];
  if (v.t) p.push(`T ${v.t}`);
  if (v.hr) p.push(`HR ${v.hr}`);
  if (v.bp) p.push(`BP ${v.bp}`);
  if (v.rr) p.push(`RR ${v.rr}`);
  if (v.spo2) p.push(`SpO2 ${v.spo2}%${v.o2 ? " on " + v.o2 : ""}`);
  if (v.wt) p.push(`Wt ${v.wt} kg`);
  if (v.pain) p.push(`Pain ${v.pain}/10`);
  return p.length ? "Vitals: " + p.join(", ") : "";
}

function noteLines(abnOnly) {
  const flag = $("#optFlag").checked;
  const lines = [], notDone = [];
  SYSTEMS.forEach(sys => {
    if (!state.shown.has(sys.id)) return;
    const parts = [];
    sys.els.forEach(e => {
      const v = state.el[key(sys.id, e.id)];
      if (!v) return;
      if (v === "n") { if (!abnOnly) parts.push(cap(e.n)); }
      else parts.push((flag ? "*" : "") + cap([...v].join(", ")));
    });
    const fr = (state.free[sys.id] || "").trim();
    if (fr) parts.push(cap(fr.replace(/\.$/, "")));
    if (parts.length) lines.push(`${sys.name}: ${parts.join(". ")}.`);
    else notDone.push(sys.name);
  });
  return { lines, notDone };
}

function buildText(abnOnly = false) {
  const { lines, notDone } = noteLines(abnOnly);
  const out = [];
  if ($("#optHdr").checked) {
    const d = new Date();
    out.push(`PHYSICAL EXAMINATION (${d.toLocaleDateString("en-CA")} ${d.toTimeString().slice(0,5)})`);
  }
  if ($("#incVit").checked && !abnOnly) { const vl = vitalsLine(); if (vl) out.push(vl); }
  const body = $("#optPara").checked ? [lines.join(" ")] : lines;
  out.push(...body.filter(Boolean));
  if ($("#optNE").checked && notDone.length && !abnOnly) out.push(`Not examined: ${notDone.join(", ")}.`);
  return out.join("\n");
}

function build() {
  if (state.edited) return;
  $("#out").value = buildText();
}

// ---------------------------------------------------------------- FHIR
function obsValue(o) {
  if (o.valueQuantity) return round(o.valueQuantity.value);
  if (o.component) {
    const sys = o.component.find(c => c.code?.coding?.some(x => x.code === "8480-6"));
    const dia = o.component.find(c => c.code?.coding?.some(x => x.code === "8462-4"));
    if (sys?.valueQuantity && dia?.valueQuantity) return `${round(sys.valueQuantity.value)}/${round(dia.valueQuantity.value)}`;
  }
  return null;
}
const round = n => (typeof n === "number" ? Math.round(n * 10) / 10 : n);

async function loadFhir(client) {
  const pt = await client.patient.read();
  const nm = pt.name?.[0];
  const name = nm ? (nm.text || `${(nm.given || []).join(" ")} ${nm.family || ""}`) : "Unknown";
  $("#pt").textContent = `${name} · DOB ${pt.birthDate || "?"} · ${pt.gender || ""}`;

  const obs = await client.request(
    `Observation?patient=${client.patient.id}&category=vital-signs&_count=200`,
    { pageLimit: 3, flat: true });
  const latest = {};
  let newest = null;
  (obs || []).forEach(o => {
    const t = o.effectiveDateTime || o.issued;
    const codes = (o.code?.coding || []).map(c => c.code);
    VITALS.forEach(v => {
      if (!v.codes.some(c => codes.includes(c))) return;
      const val = obsValue(o);
      if (val == null) return;
      if (!latest[v.id] || t > latest[v.id].t) latest[v.id] = { val, t };
    });
  });
  // separate SBP/DBP observations if no BP panel
  if (!latest.bp) {
    const pick = code => (obs || []).filter(o => o.code?.coding?.some(c => c.code === code) && o.valueQuantity)
      .sort((a, b) => (b.effectiveDateTime || "").localeCompare(a.effectiveDateTime || ""))[0];
    const s = pick("8480-6"), d = pick("8462-4");
    if (s && d) latest.bp = { val: `${round(s.valueQuantity.value)}/${round(d.valueQuantity.value)}`, t: s.effectiveDateTime };
  }
  Object.entries(latest).forEach(([k, v]) => {
    state.vit[k] = String(v.val);
    if (!newest || v.t > newest) newest = v.t;
  });
  state.vit.o2 = state.vit.o2 || "room air";
  state.vitTime = newest
    ? `Latest charted vitals, most recent ${new Date(newest).toLocaleString("en-CA")}. Edit any value before copying.`
    : "No vital signs found in the chart — enter them by hand.";
}

function loadDemo() {
  $("#demo").style.display = "";
  $("#pt").textContent = "TEST, Demo · 81 y · F";
  Object.assign(state.vit, { t: "37.9", hr: "104", bp: "102/58", rr: "22", spo2: "91", o2: "nasal prongs", wt: "58" });
  state.vitTime = "Demo values (no SMART launch detected).";
}

// ---------------------------------------------------------------- wire up
function toast(msg) { const t = $("#toast"); t.textContent = msg; t.classList.add("show"); setTimeout(() => t.classList.remove("show"), 1600); }

async function copyText(txt) {
  try { await navigator.clipboard.writeText(txt); }
  catch { const ta = document.createElement("textarea"); ta.value = txt; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); ta.remove(); }
  toast("Copied — paste into your PowerChart note");
}

async function init() {
  renderTemplates();
  const launched = /[?&](code|state)=/.test(location.search) || sessionStorage.getItem("SMART_KEY");
  if (launched && window.FHIR && !window.FHIR_FAILED) {
    try { await loadFhir(await FHIR.oauth2.ready()); }
    catch (e) { console.error(e); $("#pt").textContent = "FHIR error: " + e.message; }
  } else loadDemo();

  renderVitals(); renderSystems(); build();

  $("#allNormal").onclick = () => {
    SYSTEMS.forEach(s => { if (state.shown.has(s.id)) s.els.forEach(e => { if (!isAbn(s, e)) state.el[key(s.id, e.id)] = "n"; }); });
    renderSystems(); build();
  };
  $("#clearAll").onclick = () => { state.el = {}; state.free = {}; state.edited = false; $("#edited").style.display = "none"; renderSystems(); build(); };
  ["#optFlag","#optPara","#optNE","#optHdr","#incVit"].forEach(s => $(s).onchange = build);
  $("#out").oninput = () => { state.edited = true; $("#edited").style.display = "block"; };
  $("#rebuild").onclick = (e) => { e.preventDefault(); state.edited = false; $("#edited").style.display = "none"; build(); };
  $("#copy").onclick = () => copyText($("#out").value);
  $("#copyAbn").onclick = () => {
    const t = buildText(true);
    copyText(t.split("\n").length > 1 ? t : t + "\nNo abnormal findings selected.");
  };
}

if (typeof document !== "undefined") document.addEventListener("DOMContentLoaded", init);
