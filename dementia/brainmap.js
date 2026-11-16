/* Brain map – schematic lateral + midline views.
 * "This patient": regions implied by ticked symptoms (orange), regions abnormal on imaging (blue), both = concordant (green).
 * "Typical pattern of <type>": the usual regions for that dementia (purple).
 * Schematic only – region shapes are approximate. Uses globals from app.js: S, on, evaluate, esc. */
"use strict";
const BRAIN_REGIONS = {
  frontal:     { name: "Frontal lobe (lateral)", fn: "Planning, judgement, multitasking, initiative (executive function)" },
  medfrontal:  { name: "Medial & orbitofrontal cortex", fn: "Motivation, social conduct, empathy, eating behaviour" },
  perirolandic:{ name: "Motor & sensory strip (perirolandic)", fn: "Limb movement, praxis, cortical sensation; upper motor neurons" },
  parietal:    { name: "Parietal lobe", fn: "Visuospatial skills, praxis, calculation, dressing, navigation" },
  precuneus:   { name: "Precuneus / posterior cingulate", fn: "Memory retrieval, visual imagery — affected early in Alzheimer disease" },
  temporal:    { name: "Lateral temporal lobe", fn: "Word retrieval, comprehension, auditory processing" },
  anttemp:     { name: "Anterior temporal pole", fn: "Meaning of words and objects, recognizing people, social-emotional knowledge" },
  perisylvian: { name: "Language network (left perisylvian)", fn: "Fluency and grammar (Broca), comprehension and repetition (Wernicke)" },
  occipital:   { name: "Occipital / visual cortex", fn: "Vision and visual perception; involvement → visual hallucinations, misperception" },
  hippocampus: { name: "Hippocampus / medial temporal lobe", fn: "Forming new memories (episodic memory)" },
  mamillary:   { name: "Mamillary bodies (Papez circuit)", fn: "Memory consolidation — damaged by thiamine deficiency" },
  thalamus:    { name: "Thalamus", fn: "Relay hub: attention, alertness, memory (anterior/medial nuclei)" },
  caudate:     { name: "Caudate / striatum", fn: "Movement selection, executive control, behaviour" },
  ventricles:  { name: "Lateral ventricles (CSF)", fn: "Enlargement stretches nearby fibres → gait, bladder, slowed thinking" },
  whitematter: { name: "Periventricular white matter", fn: "Connections for processing speed, gait and bladder control" },
  midbrain:    { name: "Midbrain (substantia nigra, gaze centres)", fn: "Dopamine (movement), vertical gaze, posture" },
  pons:        { name: "Pons & brainstem nuclei", fn: "REM-sleep atonia, autonomic control (BP, bladder), swallowing/speech (bulbar)" },
  cerebellum:  { name: "Cerebellum", fn: "Coordination, balance, speech rhythm" }
};
const SYM_REGIONS = {
  amnestic: ["hippocampus"], memonly: ["hippocampus"], executive: ["frontal"], speed: ["whitematter"], visuo: ["parietal"], language: ["perisylvian"],
  confab: ["mamillary", "medfrontal"], fluct: ["thalamus"], vh: ["occipital"], rbd: ["pons"], parkinsonism: ["midbrain"], autonomic: ["pons"],
  disinhib: ["medfrontal", "frontal"], apathy: ["medfrontal"], empathy: ["anttemp", "medfrontal"], compulsive: ["medfrontal", "caudate"], hyperoral: ["medfrontal", "anttemp"],
  svppa: ["anttemp"], nfvppa: ["perisylvian", "frontal"], lvppa: ["perisylvian", "parietal"], mnd: ["perirolandic", "pons"], focal: ["perirolandic"],
  gaitnph: ["ventricles", "whitematter"], urinary: ["whitematter"], myoclonus: ["perirolandic"], falls1y: ["midbrain"], vgaze: ["midbrain"], axial: ["midbrain"],
  asym: ["perirolandic"], apraxia: ["parietal", "perirolandic"], autfail: ["pons"], cereb: ["cerebellum"], stridor: ["pons"], chorea: ["caudate"], psych: ["medfrontal"],
  bulbar: ["pons"], umnlmn: ["perirolandic"]
};
const IMG_REGIONS = {
  mta: ["hippocampus"], hipdisp: ["hippocampus"], parietal: ["parietal", "precuneus"], ftatrophy: ["frontal", "anttemp", "medfrontal"], svd: ["whitematter"], infarct: ["whitematter"],
  vent: ["ventricles"], cjdmri: ["caudate", "parietal", "frontal"], pspmri: ["midbrain"], cbsmri: ["perirolandic", "parietal"], msamri: ["pons", "cerebellum"], caudate: ["caudate"]
};
const TYPE_REGIONS = {
  ad: ["hippocampus", "precuneus", "parietal", "temporal"], late: ["hippocampus"], dlb: ["occipital", "parietal", "midbrain", "pons", "thalamus"],
  pdd: ["midbrain", "frontal", "parietal", "pons"], ftd: ["frontal", "medfrontal", "anttemp"], ppa: ["perisylvian", "anttemp"], vad: ["whitematter", "frontal", "thalamus"],
  mixed: ["hippocampus", "parietal", "whitematter"], mixed2: ["hippocampus", "occipital", "midbrain"], nph: ["ventricles", "whitematter"],
  rpd: ["frontal", "parietal", "occipital", "caudate", "thalamus"], alc: ["mamillary", "thalamus", "cerebellum"], dep: ["medfrontal"],
  psp: ["midbrain", "frontal"], cbs: ["perirolandic", "parietal", "frontal"], msa: ["pons", "cerebellum", "caudate"], hd: ["caudate", "frontal"], als: ["perirolandic", "pons", "frontal"]
};
const LABEL_POS = { // label anchor points for the labelled (PDF) version
  frontal: [95, 105], perirolandic: [205, 70], parietal: [265, 85], occipital: [335, 140], temporal: [225, 195], anttemp: [92, 205], perisylvian: [170, 158],
  cerebellum: [300, 240], medfrontal: [500, 140], precuneus: [685, 85], hippocampus: [592, 222], mamillary: [566, 190], thalamus: [628, 150], caudate: [570, 128],
  ventricles: [612, 108], whitematter: [560, 82], midbrain: [690, 172], pons: [660, 222]
};

function brainSVG(fills, opts = {}) {
  // fills: {regionId: {fill, stroke}}; opts.labels: show region names
  const f = id => fills[id] || {};
  const R = (id, shape) => {
    const st = f(id), tag = shape.match(/^<(\w+)/)[1];
    const base = /cerebellum|pons|midbrain|thalamus|caudate|hippocampus|mamillary|ventricles|whitematter/.test(id) ? "#d3d9e2" : "#e7ebf1";
    return shape.replace(/\/>$/, ` data-r="${id}" fill="${st.fill || base}" fill-opacity="${st.fill ? 0.85 : 1}" stroke="${st.stroke || "#ffffff"}" stroke-width="${st.stroke ? 3 : 1.5}"><title>${esc(BRAIN_REGIONS[id].name)} — ${esc(BRAIN_REGIONS[id].fn)}</title></${tag}>`);
  };
  const outlineL = "M40,150 C38,80 110,28 200,28 C292,28 352,78 352,138 C352,176 336,196 314,206 C298,212 282,210 268,215 L248,223 C222,233 188,236 162,229 C138,223 118,226 98,216 C68,206 42,190 40,150 Z";
  const outlineM = "M450,150 C448,80 520,28 610,28 C702,28 762,78 762,138 C762,176 746,196 724,206 C708,212 692,210 678,215 L658,223 C632,233 598,236 572,229 C548,223 528,226 508,216 C478,206 452,190 450,150 Z";
  let s = `<svg viewBox="0 0 800 300" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:820px;font-family:system-ui,sans-serif">
  <defs><clipPath id="cpL"><path d="${outlineL}"/></clipPath><clipPath id="cpM"><path d="${outlineM}"/></clipPath></defs>
  <text x="196" y="16" text-anchor="middle" font-size="12" fill="#5b6575">Side view (left hemisphere, front ←)</text>
  <text x="606" y="16" text-anchor="middle" font-size="12" fill="#5b6575">Midline view (cut down the middle, front ←)</text>
  <g clip-path="url(#cpL)">
    ${R("frontal", `<polygon points="0,0 205,0 186,166 100,180 0,195"/>`)}
    ${R("parietal", `<polygon points="205,0 322,0 302,140 256,149 186,166"/>`)}
    ${R("occipital", `<polygon points="322,0 420,0 420,240 300,210 302,140"/>`)}
    ${R("temporal", `<polygon points="140,176 186,166 256,149 302,140 300,212 250,240 140,240"/>`)}
    ${R("anttemp", `<polygon points="40,176 140,174 140,245 40,245"/>`)}
    ${R("perirolandic", `<polygon points="196,0 228,0 210,160 178,168"/>`)}
    ${R("perisylvian", `<ellipse cx="178" cy="160" rx="62" ry="20" transform="rotate(-14 178 160)"/>`)}
  </g>
  <path d="${outlineL}" fill="none" stroke="#8a94a6" stroke-width="1.6"/>
  ${R("cerebellum", `<ellipse cx="292" cy="236" rx="46" ry="26"/>`)}
  ${R("pons", `<path d="M232,214 L258,212 L256,262 L250,292 L238,292 L234,262 Z"/>`)}
  <g clip-path="url(#cpM)">
    <rect x="440" y="20" width="340" height="230" fill="#eef1f5"/>
    ${R("medfrontal", `<ellipse cx="505" cy="140" rx="55" ry="62"/>`)}
    ${R("precuneus", `<ellipse cx="688" cy="88" rx="42" ry="38"/>`)}
    ${R("occipital", `<ellipse cx="748" cy="150" rx="34" ry="46"/>`)}
  </g>
  <path d="${outlineM}" fill="none" stroke="#8a94a6" stroke-width="1.6"/>
  <path d="M528,112 C560,70 660,62 700,104 C690,96 640,80 600,86 C565,92 545,104 536,118 Z" fill="#c7ced9" stroke="none"><title>Corpus callosum</title></path>
  ${R("whitematter", `<path d="M540,122 C565,82 655,74 690,112 C676,126 650,104 612,104 C578,104 556,118 552,132 Z"/>`)}
  ${R("ventricles", `<path d="M556,130 C575,104 640,96 672,118 C660,124 636,112 610,113 C586,114 570,124 566,138 Z"/>`)}
  ${R("caudate", `<ellipse cx="572" cy="132" rx="20" ry="11" transform="rotate(-25 572 132)"/>`)}
  ${R("thalamus", `<ellipse cx="626" cy="146" rx="26" ry="16"/>`)}
  ${R("mamillary", `<circle cx="600" cy="174" r="6"/>`)}
  ${R("hippocampus", `<ellipse cx="596" cy="202" rx="34" ry="11" transform="rotate(10 596 202)"/>`)}
  ${R("midbrain", `<path d="M636,166 L668,166 L670,196 L640,198 Z"/>`)}
  ${R("pons", `<path d="M640,198 L672,196 C682,210 680,232 668,240 L650,242 L644,262 L656,292 L640,292 L632,262 C626,240 628,212 640,198 Z"/>`)}
  ${R("cerebellum", `<ellipse cx="712" cy="232" rx="44" ry="28"/>`)}`;
  if (opts.labels) {
    for (const [id, [x, y]] of Object.entries(LABEL_POS)) {
      const SHORT = { medfrontal: "Medial frontal", perirolandic: "Motor strip", perisylvian: "Language", whitematter: "White matter", ventricles: "Ventricle", mamillary: "Mamillary body", hippocampus: "Hippocampus", temporal: "Temporal lobe", anttemp: "Temporal pole", frontal: "Frontal lobe", parietal: "Parietal lobe", occipital: "Occipital", precuneus: "Precuneus", thalamus: "Thalamus", caudate: "Caudate", midbrain: "Midbrain", pons: "Pons", cerebellum: "Cerebellum" };
      const n = SHORT[id] || BRAIN_REGIONS[id].name;
      s += `<text x="${x}" y="${y}" text-anchor="middle" font-size="9.5" font-weight="600" fill="#1d2430" stroke="#ffffff" stroke-width="2.6" paint-order="stroke">${esc(n)}</text>`;
    }
  }
  return s + "</svg>";
}

function brainState() {
  const sym = {}, img = {};
  for (const [f, rs] of Object.entries(SYM_REGIONS)) if (on(f)) rs.forEach(r => (sym[r] = sym[r] || []).push(f));
  for (const [f, rs] of Object.entries(IMG_REGIONS)) if (on(f)) rs.forEach(r => (img[r] = img[r] || []).push(f));
  return { sym, img };
}
const COL = { sym: "#e67e22", img: "#2e86c1", both: "#1e9e5a", type: "#8e44ad" };

function renderBrain(R) {
  const el = document.getElementById("brainCard"); if (!el) return;
  const mode = S.brainMode || "patient";
  const label = id => (typeof FEATURES !== "undefined" ? FEATURES : []).find(x => x.id === id)?.label?.split(/[(—:]/)[0].trim() || id;
  let fills = {}, rows = "", legend = "";
  if (mode === "patient") {
    const { sym, img } = brainState();
    const ids = [...new Set([...Object.keys(sym), ...Object.keys(img)])];
    ids.forEach(r => { fills[r] = { fill: sym[r] && img[r] ? COL.both : sym[r] ? COL.sym : COL.img, stroke: img[r] ? "#1d2a44" : null }; });
    legend = `<span class="sw" style="background:${COL.sym}"></span> symptoms point here &nbsp; <span class="sw" style="background:${COL.img}"></span> imaging abnormal here &nbsp; <span class="sw" style="background:${COL.both}"></span> both (concordant)`;
    rows = ids.sort((a, b) => (!!sym[b] + !!img[b]) - (!!sym[a] + !!img[a])).map(r => `<tr><td><b>${esc(BRAIN_REGIONS[r].name)}</b><div class="small muted">${esc(BRAIN_REGIONS[r].fn)}</div></td>
      <td class="small">${(sym[r] || []).map(f => esc(label(f))).join("; ") || "—"}</td><td class="small">${(img[r] || []).map(f => esc(label(f))).join("; ") || "—"}</td>
      <td>${sym[r] && img[r] ? '<span class="pill ok">Concordant</span>' : sym[r] ? '<span class="pill warn">Symptoms only</span>' : '<span class="pill chart">Imaging only</span>'}</td></tr>`).join("");
    rows = rows ? `<table><tr><th>Region (function)</th><th>Symptoms ticked</th><th>Imaging finding</th><th></th></tr>${rows}</table>
      <p class="small muted">Symptoms only: imaging may be normal early, or the scan type (CT) may miss it. Imaging only: check whether the finding fits the clinical picture (e.g. mild white-matter change is common with age).</p>`
      : '<p class="muted small">No symptoms or imaging findings ticked yet (tab 2).</p>';
  } else {
    const t = R.find(x => x.id === mode) || { name: mode };
    (TYPE_REGIONS[mode] || []).forEach(r => fills[r] = { fill: COL.type });
    legend = `<span class="sw" style="background:${COL.type}"></span> typical regions in ${esc(t.name)}`;
    rows = `<table><tr><th>Region</th><th>Function → symptom when affected</th></tr>${(TYPE_REGIONS[mode] || []).map(r => `<tr><td><b>${esc(BRAIN_REGIONS[r].name)}</b></td><td class="small">${esc(BRAIN_REGIONS[r].fn)}</td></tr>`).join("")}</table>`;
  }
  const opts = R.filter(r => TYPE_REGIONS[r.id]);
  el.innerHTML = `<div class="row" style="margin-bottom:6px"><label class="small"><b>Show:</b></label>
      <select id="brainMode"><option value="patient" ${mode === "patient" ? "selected" : ""}>This patient — symptoms vs imaging</option>
      <optgroup label="Typical pattern of…">${opts.map(r => `<option value="${r.id}" ${mode === r.id ? "selected" : ""}>${r.lvl >= 2 ? "★ " : ""}${esc(r.name)}</option>`).join("")}</optgroup></select>
      <span class="small">${legend}</span></div>
    ${brainSVG(fills)}
    <p class="small muted" style="margin:2px 0 8px">Schematic — shapes are approximate. Hover a region for its function. ★ = fits this patient.</p>
    ${rows}`;
  document.getElementById("brainMode").onchange = e => { S.brainMode = e.target.value; renderBrain(R); };
}
