/* Consult message button - shared by the toolkit shell and the standalone apps. Read-only; nothing is sent anywhere.
   Builds a ~50-word message in Wayne's format:
     Hello Dr. ___,  This is Wayne, hospitalist. I have NAME, AGE, MRN ___, ... Could you see ... ?  Your help is much appreciated.  Thanks, Wayne
   Patient comes from window.CONSULT_CTX (set by the toolkit shell: { client, topic(), tabKey() }) or from the page's own SMART session.
   Inside toolkit iframes the shell shows the button, so tool pages do not. UNVERIFIED draft written by Claude. */
(function () {
  if (window.__consultWidget) return; window.__consultWidget = true;
  try { if (window.top !== window && window.top.__consultWidget) return; } catch (e) { /* cross-origin parent: show it */ }

  const SERVICES = ["Infectious diseases", "General surgery", "Internal medicine", "Cardiology", "Nephrology", "Neurology", "Gastroenterology", "Respirology", "Hematology", "Medical oncology", "Endocrinology", "Geriatrics", "Palliative care", "Psychiatry", "Orthopedics", "Urology", "Neurosurgery", "Vascular surgery", "Thoracic surgery", "Interventional radiology", "ICU", "Other"];
  // toolkit tab key -> usual service
  const BY_TAB = { abx: "Infectious diseases", abxmap: "Infectious diseases", infections: "Infectious diseases", aki: "Nephrology", transplant: "Nephrology", hypona: "Nephrology", lytes: "Nephrology", acidbase: "Nephrology",
    stroke: "Neurology", neuro: "Neurology", seizure: "Neurology", ae: "Neurology", dementia: "Geriatrics", pd: "Neurology", chf: "Cardiology", af: "Cardiology", liver: "Gastroenterology", ibd: "Gastroenterology",
    pc: "Medical oncology", tox: "Medical oncology", bispecific: "Medical oncology", g6pd: "Hematology", hip: "Orthopedics", pain: "Palliative care", diabetes: "Endocrinology", ed: "Psychiatry", edr: "Psychiatry",
    opioid: "Palliative care", hah: "Internal medicine", mobility: "Geriatrics", falls: "Geriatrics" };
  const BY_TITLE = [[/infect|antibiot|abx|sepsis/i, "Infectious diseases"], [/\baki\b|kidney|renal|transplant|electrolyte|sodium|acid/i, "Nephrology"], [/stroke|seizure|neuro|encephalit/i, "Neurology"],
    [/dementia|falls|mobility/i, "Geriatrics"], [/heart|chf|atrial|cardi/i, "Cardiology"], [/liver|cirrho|ibd|crohn|colitis/i, "Gastroenterology"], [/carcinomatosis|oncolog|myeloma|bispecific|toxicit/i, "Medical oncology"],
    [/g6pd|hemat/i, "Hematology"], [/hip|fracture|ortho/i, "Orthopedics"], [/pain|opioid|palliat/i, "Palliative care"], [/diabet/i, "Endocrinology"], [/eating disorder/i, "Psychiatry"]];

  const css = `
  #cw-btn{position:fixed;right:16px;bottom:16px;z-index:99998;background:#0b6bcb;color:#fff;border:0;border-radius:22px;padding:9px 15px;font:600 13.5px system-ui,-apple-system,"Segoe UI",sans-serif;box-shadow:0 3px 10px rgba(0,0,0,.25);cursor:pointer}
  #cw-btn:hover{background:#0957a6}
  #cw-pan{position:fixed;right:16px;bottom:62px;z-index:99999;width:min(460px,calc(100vw - 32px));max-height:calc(100vh - 90px);overflow:auto;background:#fff;color:#1f2933;border:1px solid #cfd6df;border-radius:12px;box-shadow:0 8px 28px rgba(0,0,0,.25);padding:12px 14px;font:13.5px system-ui,-apple-system,"Segoe UI",sans-serif;display:none}
  #cw-pan h3{margin:0 0 6px;font-size:15px} #cw-pan .row{display:flex;gap:6px;flex-wrap:wrap;margin:5px 0;align-items:center}
  #cw-pan label{font-size:12px;color:#5f6c7b;display:flex;flex-direction:column;gap:2px;flex:1;min-width:120px}
  #cw-pan input,#cw-pan select,#cw-pan textarea{font:13px system-ui,sans-serif;padding:4px 6px;border:1px solid #cfd6df;border-radius:6px;background:#fff;color:#1f2933;width:100%;box-sizing:border-box}
  #cw-pan textarea{min-height:150px;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12.5px}
  #cw-pan .acts{display:flex;justify-content:space-between;align-items:center;margin-top:6px} #cw-pan .muted{color:#5f6c7b;font-size:12px}
  #cw-pan button{font:600 13px system-ui,sans-serif;border-radius:6px;padding:5px 12px;cursor:pointer;border:1px solid #0b6bcb;background:#0b6bcb;color:#fff} #cw-pan button.ghost{background:#fff;color:#0b6bcb}
  @media (prefers-color-scheme: dark){#cw-pan{background:#1a1f26;color:#e8edf2;border-color:#2b333d}#cw-pan input,#cw-pan select,#cw-pan textarea{background:#111418;color:#e8edf2;border-color:#2b333d}#cw-pan .muted,#cw-pan label{color:#9aa7b5}#cw-pan button.ghost{background:#1a1f26}}
  @media print{#cw-btn,#cw-pan{display:none!important}}`;

  const words = (t) => (String(t).trim().match(/\S+/g) || []).length;
  const ageOf = (b) => { if (!b) return null; const d = new Date(b), n = new Date(); let a = n.getFullYear() - d.getFullYear(); if (n < new Date(n.getFullYear(), d.getMonth(), d.getDate())) a--; return isNaN(a) ? null : a; };


  /* ---- labs: short names, which are pertinent to each service ---- */
  const LAB_SHORT = [[/creatinine(?!.*(urine|clearance|kinase|ratio))/i, "Cr"], [/^potassium|potassium,? (serum|plasma|blood)/i, "K"], [/^sodium|sodium,? (serum|plasma|blood)/i, "Na"], [/bicarbonate|total co2|\bco2\b|\bhco3/i, "HCO3"], [/urea|\bbun\b/i, "Urea"],
    [/hemoglobin(?!.*a1c)|haemoglobin(?!.*a1c)|^hgb\b|^hb\b/i, "Hb"], [/platelet/i, "Plt"], [/^wbc|white blood|leukocyte(?!.*esterase)/i, "WBC"], [/neutrophil/i, "Neut"], [/c.reactive|^crp/i, "CRP"], [/lactate(?! dehydrogenase)|lactic/i, "Lactate"],
    [/procalcitonin/i, "PCT"], [/troponin/i, "Trop"], [/bnp|natriuretic/i, "NT-proBNP"], [/bilirubin/i, "Bili"], [/\balt\b|alanine/i, "ALT"], [/\bast\b|aspartate/i, "AST"], [/alkaline phos|\balp\b/i, "ALP"],
    [/\binr\b|prothrombin/i, "INR"], [/albumin(?!.*urine)/i, "Alb"], [/lipase/i, "Lipase"], [/glucose/i, "Gluc"], [/a1c/i, "A1c"], [/^calcium|calcium,? (total|serum)/i, "Ca"], [/magnesium/i, "Mg"], [/phosph(?!atase)/i, "PO4"],
    [/lactate dehydrogenase|\bldh\b/i, "LDH"], [/ferritin/i, "Ferritin"], [/haptoglobin/i, "Hapto"], [/reticulocyte/i, "Retic"], [/\bpco2\b/i, "pCO2"], [/^ph\b|\bph,? (arterial|venous|blood)/i, "pH"], [/\btsh\b|thyrotropin/i, "TSH"], [/b12|cobalamin/i, "B12"],
    [/\bcea\b/i, "CEA"], [/ca[ -]?125/i, "CA-125"], [/ck\b|creatine kinase/i, "CK"], [/ammonia/i, "NH3"], [/osmolal/i, "Osm"]];
  const PERTINENT = { "Infectious diseases": ["WBC", "CRP", "Lactate", "PCT", "Cr", "Neut"], "General surgery": ["WBC", "Lactate", "Hb", "Lipase", "Bili", "Cr", "INR"], "Internal medicine": ["Hb", "WBC", "Na", "K", "Cr"],
    Cardiology: ["Trop", "NT-proBNP", "K", "Mg", "Cr", "Hb"], Nephrology: ["Cr", "Urea", "K", "Na", "HCO3", "PO4", "Ca"], Neurology: ["Na", "Gluc", "Ca", "WBC"], Gastroenterology: ["Hb", "Bili", "ALT", "ALP", "INR", "Alb", "Lipase", "Plt"],
    Respirology: ["WBC", "CRP", "pCO2", "pH", "NT-proBNP"], Hematology: ["Hb", "Plt", "WBC", "Neut", "INR", "LDH", "Bili", "Retic", "Hapto"], "Medical oncology": ["Hb", "Plt", "WBC", "Neut", "Ca", "Cr", "Alb", "Bili"],
    Endocrinology: ["Gluc", "A1c", "Na", "K", "HCO3", "Ca", "TSH"], Geriatrics: ["Na", "Ca", "Hb", "Cr", "TSH", "B12"], "Palliative care": ["Ca", "Cr", "Na", "Alb", "Hb"], Psychiatry: ["Na", "K", "PO4", "Mg", "Gluc"],
    Orthopedics: ["Hb", "Cr", "INR", "Plt", "WBC"], Urology: ["Cr", "K", "WBC", "Hb"], Neurosurgery: ["Na", "INR", "Plt", "Hb"], "Vascular surgery": ["Hb", "Cr", "Lactate", "INR"], "Thoracic surgery": ["WBC", "Hb", "INR"],
    "Interventional radiology": ["INR", "Plt", "Hb", "Cr"], ICU: ["Lactate", "pH", "pCO2", "HCO3", "Cr", "K", "WBC", "Hb"], Other: [] };
  const shortName = (n) => { const h = LAB_SHORT.find(([re]) => re.test(n || "")); return h ? h[1] : null; };
  const fmtV = (v) => (Math.abs(v) >= 100 ? Math.round(v) : +(+v).toFixed(Math.abs(v) < 10 ? 2 : 1)).toString().replace(/\.0+$/, "");
  /* observations -> [{key, label, v, prev, unit, t, flag}] latest per short name, newest first */
  function summarizeLabs(obs) {
    const by = {};
    (obs || []).forEach((o) => {
      if (!o || !o.valueQuantity || o.valueQuantity.value == null || /entered-in-error|cancelled/.test(o.status || "")) return;
      const name = (o.code && (o.code.text || ((o.code.coding || [])[0] || {}).display)) || "", key = shortName(name);
      if (!key || /urine|fluid|csf|ascit|pleural/i.test(name)) return;
      const t = new Date(o.effectiveDateTime || o.issued || 0).getTime(); if (!t) return;
      const interp = ((o.interpretation || [])[0] || {}), code = ((interp.coding || [])[0] || {}).code || interp.text || "";
      (by[key] = by[key] || []).push({ v: +o.valueQuantity.value, unit: o.valueQuantity.unit || "", t, flag: /^(H|HH|L|LL|A|AA|HU|LU)$/.test(code) ? code : "" });
    });
    return Object.entries(by).map(([key, a]) => { a.sort((x, y) => y.t - x.t); return { key, v: a[0].v, unit: a[0].unit, t: a[0].t, flag: a[0].flag, prev: a.length > 1 ? a[1].v : null }; }).sort((x, y) => y.t - x.t);
  }
  function labLine(labs) { return labs.length ? "Labs: " + labs.map((l) => `${l.key} ${fmtV(l.v)}${l.prev != null && fmtV(l.prev) !== fmtV(l.v) ? ` (prev ${fmtV(l.prev)})` : ""}`).join(", ") + "." : ""; }

  /* Pure builder (also used by tests): o = { dr, service, name, age, sex, mrn, problem, hx, why } */
  function build(o) {
    const sexWord = o.sex === "female" ? "woman" : o.sex === "male" ? "man" : "patient", pro = o.sex === "female" ? "her" : o.sex === "male" ? "him" : "them";
    const who = [o.name || "___", o.age != null && o.age !== "" ? String(o.age) : "", "MRN " + (o.mrn || "___")].filter(Boolean).join(", ");
    const prob = String(o.problem || "___").trim().replace(/^[A-Z](?=[a-z])/, (c) => c.toLowerCase());
    const art = /^(a|an|the|possible|suspected|new|acute|chronic|severe|recurrent)\b/i.test(prob) || /^[A-Z0-9]{2,}/.test(prob) || /s$/.test(prob) || prob === "___" ? "" : /^[aeiou]/i.test(prob) ? "an " : "a ";
    const hx = String(o.hx || "").trim().replace(/([^.!?])$/, "$1.");
    const why = String(o.why || "").trim().replace(/[.?]+$/, "");
    const ask = why ? (o.service === "Infectious diseases" || /advice|recommend|antibiotic|dose|which/i.test(why) ? `Could you see ${pro} for advice on ${why.replace(/^[A-Z](?=[a-z])/, (c) => c.toLowerCase())}?` : `Could you see ${pro} to ${/^(assess|review|help|consider|see|evaluate|manage)\b/i.test(why) ? why.replace(/^[A-Z]/, (c) => c.toLowerCase()) : "assess " + why.replace(/^[A-Z](?=[a-z])/, (c) => c.toLowerCase())}?`) : `Could you see ${pro}? ___`;
    const labs = String(o.labs || "").trim().replace(/([^.])$/, "$1.");
    const body = `I have ${who}, a ${sexWord} with ${art}${prob}. ${hx} ${labs === "." ? "" : labs} ${ask}`.replace(/\s+/g, " ").trim();
    const sig = String(o.sig || "").trim();
    return { text: `Hello Dr. ${o.dr || "___"},\n\nThis is Wayne, hospitalist. ${body}\n\nYour help is much appreciated.\n\nThanks,\nWayne${sig ? "\n" + sig : ""}`, words: words(body) + 4 };
  }
  window.ConsultWidget = { build, summarizeLabs, labLine, shortName, PERTINENT };
  if (typeof document === "undefined") return;

  let pt = null, probs = [], labs = [], labsLoaded = false;
  async function loadPatient() {
    const ctx = window.CONSULT_CTX || {};
    let client = ctx.client || null;
    if (!client && window.FHIR && (location.search.includes("code=") || sessionStorage.getItem("SMART_KEY"))) { try { client = await FHIR.oauth2.ready(); } catch (e) {} }
    if (ctx.patient) pt = ctx.patient;
    else if (client) { try { pt = await client.patient.read(); } catch (e) {} }
    if (ctx.labs && !labsLoaded) { labs = summarizeLabs(ctx.labs); labsLoaded = true; }
    if (client && !labsLoaded) {
      try {
        const since = new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10);
        const obs = await client.request(`Observation?patient=${client.patient.id}&category=laboratory&date=ge${since}&_count=200`, { pageLimit: 3, flat: true });
        labs = summarizeLabs(obs); labsLoaded = true;
      } catch (e) { labsLoaded = true; }
    }
    if (client && !probs.length) {
      try {
        const cs = await client.request(`Condition?patient=${client.patient.id}&_count=100`, { flat: true });
        probs = [...new Set(cs.filter((c) => !(c.clinicalStatus && /resolved|inactive/.test(JSON.stringify(c.clinicalStatus)))).map((c) => (c.code && (c.code.text || ((c.code.coding || [])[0] || {}).display)) || "").filter(Boolean))].slice(0, 40);
      } catch (e) {}
    }
  }
  function patientFields() {
    if (!pt) return { name: "", age: "", sex: "", mrn: "" };
    const n = (pt.name || []).find((x) => x.use === "official") || (pt.name || [])[0] || {};
    let name = [(n.given || []).join(" "), n.family].filter(Boolean).join(" ") || n.text || "";
    if (/,/.test(name)) name = name.split(",").map((x) => x.trim()).reverse().join(" ");
    const id = (pt.identifier || []).find((i) => /\bMR\b|mrn|medical record/i.test(JSON.stringify(i.type || "") + " " + (i.system || "")));
    return { name, age: ageOf(pt.birthDate), sex: String(pt.gender || "").toLowerCase(), mrn: id ? id.value : "" };
  }
  function topic() { const c = window.CONSULT_CTX; try { return (c && c.topic && c.topic()) || document.title.replace(/\s*[–-]\s*(Hospitalist Toolkit|launching).*$/i, ""); } catch (e) { return document.title; } }
  function defaultService() {
    const c = window.CONSULT_CTX; let k = ""; try { k = (c && c.tabKey && c.tabKey()) || ""; } catch (e) {}
    if (BY_TAB[k]) return BY_TAB[k];
    const t = topic(); const hit = BY_TITLE.find(([re]) => re.test(t)); return hit ? hit[1] : "Internal medicine";
  }

  function el(tag, attrs, html) { const e = document.createElement(tag); Object.assign(e, attrs || {}); if (html != null) e.innerHTML = html; return e; }
  function init() {
    document.head.appendChild(el("style", {}, css));
    const btn = el("button", { id: "cw-btn", type: "button", title: "Draft a consult message (ID, surgery, any service)" }, "✉ Consult");
    const pan = el("div", { id: "cw-pan", role: "dialog" }, `
      <h3>Consult message</h3>
      <div class="muted">~50 words to text or send by Teams. Edit anything. Nothing is sent from here.</div>
      <div class="row"><label>Service<select id="cw-svc">${SERVICES.map((s) => `<option>${s}</option>`).join("")}</select></label><label>Dr.<input id="cw-dr" placeholder="name"></label></div>
      <div class="row"><label>Patient<input id="cw-name"></label><label style="max-width:70px;min-width:60px">Age<input id="cw-age"></label><label style="max-width:120px">MRN<input id="cw-mrn"></label>
        <label style="max-width:90px;min-width:80px">Sex<select id="cw-sex"><option value="">–</option><option value="female">F</option><option value="male">M</option></select></label></div>
      <div class="row"><label>Problem<input id="cw-prob" list="cw-probs" placeholder="e.g. ESBL pyelonephritis"><datalist id="cw-probs"></datalist></label></div>
      <div class="row"><label>Brief history (1–2 key facts)<input id="cw-hx" placeholder="e.g. Febrile on day 3 of ceftriaxone, creatinine rising."></label></div>
      <div class="row"><label>Why you need their help<input id="cw-why" placeholder="e.g. antibiotic choice and duration / drainage / dialysis"></label></div>
      <div class="row" style="flex-direction:column;align-items:stretch"><label style="flex:none">Labs to include <span id="cw-labnote"></span></label>
        <div id="cw-labs" style="display:flex;flex-wrap:wrap;gap:3px 10px;font-size:12.5px;max-height:120px;overflow:auto"></div>
        <div style="display:flex;gap:8px;align-items:center;margin-top:3px"><a href="#" id="cw-laball" style="font-size:12px;color:#0b6bcb">show all results</a><input id="cw-labx" placeholder="other results to add, e.g. CT: 4 cm abscess" style="flex:1"></div></div>
      <div class="row"><label>Sign-off line under "Thanks, Wayne" <span class="muted">(saved on this computer only – not in the app code)</span><input id="cw-sig" placeholder="e.g. Dr. Wayne Dong · MSP ##### · cell ###-###-####"></label></div>
      <textarea id="cw-msg"></textarea>
      <div class="acts"><span id="cw-words" class="muted"></span><span><button class="ghost" id="cw-close" type="button">Close</button> <button id="cw-copy" type="button">Copy</button></span></div>`);
    document.body.appendChild(btn); document.body.appendChild(pan);
    const $ = (id) => pan.querySelector("#" + id);
    let edited = false, showAll = false, picked = null; // picked: Set of lab keys the user ticked (null = use the service defaults)
    const pickedLabs = () => labs.filter((l) => (picked || new Set(PERTINENT[$("cw-svc").value] || [])).has(l.key));
    const drawLabs = () => {
      const pert = new Set(PERTINENT[$("cw-svc").value] || []), sel = picked || pert;
      const list = showAll ? labs : labs.filter((l) => pert.has(l.key) || sel.has(l.key));
      $("cw-labnote").textContent = labs.length ? `(last 7 days; ticked = usual for ${$("cw-svc").value})` : "(no lab results read – type them below)";
      $("cw-labs").innerHTML = list.map((l) => `<label style="flex-direction:row;align-items:center;gap:3px;min-width:0;flex:none;color:inherit"><input type="checkbox" data-k="${l.key}" style="width:auto"${sel.has(l.key) ? " checked" : ""}>${l.key} <b${l.flag ? ' style="color:#b42318"' : ""}>${fmtV(l.v)}</b>${l.prev != null ? ` <span class="muted">(${fmtV(l.prev)})</span>` : ""}</label>`).join("") || '<span class="muted">none for this service – "show all results"</span>';
      $("cw-labs").querySelectorAll("input").forEach((x) => (x.onchange = () => { picked = picked || new Set(sel); x.checked ? picked.add(x.dataset.k) : picked.delete(x.dataset.k); edited = false; refresh(); }));
      $("cw-laball").textContent = showAll ? "show usual only" : `show all results (${labs.length})`;
    };
    const refresh = () => {
      if (edited) return;
      const m = build({ dr: $("cw-dr").value.trim(), service: $("cw-svc").value, name: $("cw-name").value.trim(), age: $("cw-age").value.trim(), sex: $("cw-sex").value, mrn: $("cw-mrn").value.trim(), problem: $("cw-prob").value, hx: $("cw-hx").value, why: $("cw-why").value,
        sig: $("cw-sig").value,
        labs: [labLine(pickedLabs()).replace(/\.$/, ""), $("cw-labx").value.trim()].filter(Boolean).join("; ") });
      $("cw-msg").value = m.text; $("cw-words").textContent = `~${m.words} words` + (m.words > 60 ? " – a bit long, trim the history" : "");
    };
    ["cw-svc", "cw-dr", "cw-name", "cw-age", "cw-mrn", "cw-sex", "cw-prob", "cw-hx", "cw-why", "cw-labx"].forEach((id) => { $(id).addEventListener("input", () => { edited = false; refresh(); }); $(id).addEventListener("change", () => { edited = false; refresh(); }); });
    $("cw-svc").addEventListener("change", () => { picked = null; drawLabs(); refresh(); });
    try { $("cw-sig").value = localStorage.getItem("consult-signoff") || ""; } catch (e) {}
    $("cw-sig").addEventListener("input", () => { try { localStorage.setItem("consult-signoff", $("cw-sig").value); } catch (e) {} edited = false; refresh(); });
    $("cw-laball").onclick = (e) => { e.preventDefault(); showAll = !showAll; drawLabs(); };
    $("cw-msg").addEventListener("input", () => { edited = true; $("cw-words").textContent = "edited by hand"; });
    $("cw-close").onclick = () => (pan.style.display = "none");
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") pan.style.display = "none"; });
    $("cw-copy").onclick = () => { $("cw-msg").select(); try { navigator.clipboard.writeText($("cw-msg").value); } catch (e) { document.execCommand("copy"); } $("cw-copy").textContent = "Copied"; setTimeout(() => ($("cw-copy").textContent = "Copy"), 1200); };
    btn.onclick = async () => {
      if (pan.style.display === "block") { pan.style.display = "none"; return; }
      pan.style.display = "block"; $("cw-words").textContent = "Reading the patient…";
      await loadPatient();
      const f = patientFields();
      if (f.name) $("cw-name").value = f.name; if (f.age != null && f.age !== "") $("cw-age").value = f.age; if (f.mrn) $("cw-mrn").value = f.mrn; if (f.sex) $("cw-sex").value = f.sex;
      $("cw-probs").innerHTML = probs.map((p) => `<option value="${p.replace(/"/g, "&quot;")}">`).join("");
      const t = topic().replace(/\s*\b(check|tab|review|by site|follow-?up|toolkit|calculator|summary|chooser|flowsheet|screen|monitor|app|pathway|matrix|tracker)\b.*$/i, "").trim();
      if (!$("cw-prob").value && t && !/^(today|notes|labs|forms|meds|physical exam|infections|antibiotic|what changed|ai|diagnosis|choosing wisely|consult|mobility|watch)/i.test(t)) $("cw-prob").value = t;
      $("cw-prob").placeholder = probs.length ? "pick from the problem list or type" : "e.g. ESBL pyelonephritis";
      $("cw-svc").value = defaultService(); picked = null; drawLabs(); edited = false; refresh();
      if (!pt) $("cw-words").textContent = "No chart patient (demo or not launched) – type name, age and MRN.";
    };
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
