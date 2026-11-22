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
  cerebellum: [300, 240]
};
const MID_LABEL_IMG = { // midline label points, in illustration pixels (converted with midPt)
  medfrontal: [330, 300], precuneus: [610, 290], occipital: [775, 450], hippocampus: [405, 600], mamillary: [395, 515], thalamus: [470, 472],
  caudate: [350, 470], ventricles: [430, 436], whitematter: [470, 404], midbrain: [512, 532], pons: [520, 630], cerebellum: [668, 620]
};

const MID = { x0: 440, y0: 24, k: 0.47 }; // where the illustration sits in the 800×300 drawing
const midPt = (x, y) => [Math.round(MID.x0 + (x - 150) * MID.k), Math.round(MID.y0 + (y - 210) * MID.k)];
function brainSVG(fills, opts = {}) {
  // fills: {regionId: {fill, stroke}}; opts.labels: show region names
  const f = id => fills[id] || {};
  const R = (id, shape) => {
    const st = f(id), tag = shape.match(/^<(\w+)/)[1];
    const base = /cerebellum|pons|midbrain|thalamus|caudate|hippocampus|mamillary|ventricles|whitematter/.test(id) ? "#d3d9e2" : "#e7ebf1";
    return shape.replace(/\/>$/, ` data-r="${id}" fill="${st.fill || base}" fill-opacity="${st.fill ? 0.85 : 1}" stroke="${st.stroke || "#ffffff"}" stroke-width="${st.stroke ? 3 : 1.5}"><title>${esc(BRAIN_REGIONS[id].name)} — ${esc(BRAIN_REGIONS[id].fn)}</title></${tag}>`);
  };
  const outlineL = "M40,150 C38,80 110,28 200,28 C292,28 352,78 352,138 C352,176 336,196 314,206 C298,212 282,210 268,215 L248,223 C222,233 188,236 162,229 C138,223 118,226 98,216 C68,206 42,190 40,150 Z";
  // midline view: the watercolor illustration (brain-midline.jpg, cropped 730×580 from the 1024×834 original) with regions traced over it in image pixels
  const M = (id, shape) => {
    const st = f(id), tag = shape.match(/^<(\w+)/)[1];
    return shape.replace(/\/>$/, ` data-r="${id}" fill="${st.fill || "#ffffff"}" fill-opacity="${st.fill ? 0.55 : 0}" stroke="${st.fill ? (st.stroke || st.fill) : "none"}" stroke-width="${st.stroke ? 7 : 4}"><title>${esc(BRAIN_REGIONS[id].name)} — ${esc(BRAIN_REGIONS[id].fn)}</title></${tag}>`);
  };
  let s = `<svg viewBox="0 0 800 300" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:820px;font-family:system-ui,sans-serif">
  <defs><clipPath id="cpL"><path d="${outlineL}"/></clipPath></defs>
  <text x="196" y="16" text-anchor="middle" font-size="12" fill="#5b6575">Side view (left hemisphere, front ←)</text>
  <text x="612" y="16" text-anchor="middle" font-size="12" fill="#5b6575">Midline view (cut down the middle, front ←)</text>
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
  <g transform="translate(${MID.x0},${MID.y0}) scale(${MID.k}) translate(-150,-210)">
    <image href="brain-midline.jpg" x="150" y="210" width="730" height="580" preserveAspectRatio="none"/>
    ${M("medfrontal", `<path d="M176,430 C180,380 205,330 250,290 C300,262 360,246 420,236 L490,232 L495,342 C460,344 400,348 370,352 C330,362 300,380 285,400 C268,425 266,470 275,505 C300,520 330,535 345,545 C340,565 330,580 300,582 C260,575 222,556 200,528 C182,500 175,465 176,430 Z"/>`)}
    ${M("precuneus", `<path d="M490,232 C560,226 625,242 680,270 C705,290 722,312 730,335 C722,365 700,398 670,430 L655,445 C648,410 630,385 612,368 C590,352 560,344 495,342 Z"/>`)}
    ${M("occipital", `<path d="M730,332 C760,325 790,340 805,365 C825,405 842,460 846,520 C844,545 835,560 820,564 C780,562 740,556 705,546 C670,534 635,516 600,500 L596,486 C620,478 640,470 655,450 C672,430 700,400 722,366 Z"/>`)}
    ${M("whitematter", `<path d="M300,470 C298,440 312,410 338,398 C380,386 440,380 510,381 C565,384 600,400 622,430 C630,448 624,462 612,464 C600,440 570,418 520,410 C460,404 400,406 360,418 C335,428 322,448 318,470 Z"/>`)}
    ${M("ventricles", `<ellipse cx="418" cy="440" rx="74" ry="21" transform="rotate(-6 418 440)"/>`)}
    ${M("caudate", `<ellipse cx="352" cy="454" rx="18" ry="12" transform="rotate(-20 352 454)"/>`)}
    ${M("thalamus", `<ellipse cx="466" cy="470" rx="44" ry="27"/>`)}
    ${M("mamillary", `<circle cx="412" cy="490" r="12"/>`)}
    ${M("hippocampus", `<path d="M336,560 C350,540 390,532 430,538 C460,544 476,566 476,592 C474,622 452,644 418,648 C380,650 350,634 340,608 C334,592 332,575 336,560 Z"/>`)}
    ${M("midbrain", `<path d="M470,502 C490,494 525,494 545,505 C556,520 558,545 548,563 C530,570 500,570 480,556 C468,540 466,520 470,502 Z"/>`)}
    ${M("pons", `<path d="M480,560 C500,570 535,572 552,563 C564,590 568,635 560,675 C556,690 566,712 584,742 L604,766 L586,776 C566,748 548,724 532,702 C510,696 492,680 484,650 C474,620 472,588 480,560 Z"/>`)}
    ${M("cerebellum", `<ellipse cx="668" cy="618" rx="94" ry="98"/>`)}
  </g>`;
  if (opts.labels) {
    const pts = Object.entries(LABEL_POS).concat(Object.entries(MID_LABEL_IMG).map(([id, [x, y]]) => [id, midPt(x, y)]));
    for (const [id, [x, y]] of pts) {
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
    <p class="small muted" style="margin:2px 0 8px">Side view is a schematic; midline view is an illustration with regions traced over it. Shapes are approximate. Hover a region for its function. ★ = fits this patient.</p>
    ${rows}`;
  document.getElementById("brainMode").onchange = e => { S.brainMode = e.target.value; renderBrain(R); };
}
