/* Antibiotic chooser - UI. Body map → site → regimens badged for this patient's criteria. Read-only; nothing is sent anywhere. */
(function () {
  const $ = (id) => document.getElementById(id);
  const R = window.AbxMapRules, C = window.AbxMapChart;
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const SITES = (window.INF_SITES || []).concat(window.ABXMAP_EXTRA_SITES || []);
  const byId = (id) => SITES.find((s) => s.id === id);
  const PAGES = {}; (window.ABX_CLASS_PAGES || []).forEach((c) => (PAGES[c.id] = c.page));
  const CLASS_NAME = { pen: "Penicillins", ceph: "Cephalosporins", carb: "Carbapenems", mrsa: "Anti-MRSA", ag: "Aminoglycosides", fq: "Fluoroquinolones", mac: "Macrolides/tetracyclines", uti: "TMP-SMX/urinary", anaer: "Clindamycin/metronidazole", cdiff: "C. difficile" };
  const PDF = window.ABXMAP_PDF || "../abx/abx-classes.pdf?v=20261119a"; // standalone page sets ABXMAP_PDF
  const TIERS = [["mild", "Mild / outpatient"], ["moderate", "Moderate / ward"], ["severe", "Severe / sepsis / ICU"], ["", "Show all"]];
  const state = { site: null, tier: "moderate", f: null, chartSites: [] };

  // ---- body map: hover + click ----
  const svg = $("body"), tip = $("tip");
  svg.querySelectorAll("g[data-site]").forEach((g) => {
    const s = byId(g.dataset.site); if (!s) return;
    const t = document.createElementNS("http://www.w3.org/2000/svg", "title"); t.textContent = s.label; g.prepend(t);
    g.addEventListener("mousemove", (e) => {
      const box = svg.parentElement.getBoundingClientRect();
      tip.textContent = s.label + (g.dataset.sub ? " (" + g.dataset.sub + ")" : ""); tip.style.display = "block";
      tip.style.left = e.clientX - box.left + 12 + "px"; tip.style.top = e.clientY - box.top - 8 + "px";
      svg.querySelectorAll(`g[data-site="${s.id}"] .org, g[data-site="${s.id}"] .skin`).forEach((x) => x.classList.add("hov"));
    });
    g.addEventListener("mouseleave", () => { tip.style.display = "none"; svg.querySelectorAll(".hov").forEach((x) => x.classList.remove("hov")); });
    g.addEventListener("click", (e) => { e.stopPropagation(); pick(s.id); });
  });
  SITES.forEach((s) => { const b = document.createElement("button"); b.textContent = s.label; b.dataset.site = s.id; b.onclick = () => pick(s.id); $("siteBtns").appendChild(b); });

  function markMap() {
    svg.querySelectorAll(".on, .chart").forEach((x) => x.classList.remove("on", "chart"));
    if (state.site) svg.querySelectorAll(`g[data-site="${state.site}"] .org, g[data-site="${state.site}"] .skin`).forEach((x) => x.classList.add("on"));
    state.chartSites.forEach((id) => svg.querySelectorAll(`g[data-site="${id}"] .org, g[data-site="${id}"] .skin`).forEach((x) => x.classList.add("chart")));
    $("siteBtns").querySelectorAll("button").forEach((b) => { b.classList.toggle("on", b.dataset.site === state.site); b.classList.toggle("chartsite", state.chartSites.includes(b.dataset.site)); });
  }

  function pick(id) {
    state.site = id;
    const s = byId(id);
    if (state.tier && !(s.abx || []).some((r) => r.tier === state.tier)) state.tier = (s.abx && s.abx[0] && s.abx[0].tier) || "";
    markMap(); draw();
    if (window.innerWidth < 860) $("panel").scrollIntoView({ behavior: "smooth" });
  }

  // ---- criteria ----
  const CK = { cSulfa: "sulfa", cPreg: "pregnant", cQt: "qtRisk", cVpa: "valproate", cWarf: "warfarin", cSero: "serotonergic", cStatin: "statinColch", cSteroid: "steroids", cCdiff: "cdiffHx" };
  function ctx() {
    const c = { allergy: $("cAllergy").value, crcl: $("cCrcl").value === "" ? null : +$("cCrcl").value,
      risks: { mrsa: $("rMrsa").checked, pseudo: $("rPseudo").checked, esbl: $("rEsbl").checked },
      otherAllergyText: state.f ? state.f.allergies.map((a) => a.sub).join(" ") : "" };
    Object.entries(CK).forEach(([id, k]) => (c[k] = $(id).checked));
    return c;
  }
  document.querySelectorAll(".crit input, .crit select").forEach((el) => { el.oninput = draw; el.onchange = draw; });

  // ---- panel ----
  function rxCard(item, s) {
    const a = item.a, lab = { ok: "✓ fits", caution: "⚠ caution", avoid: "✗ avoid" }[a.status];
    const chips = a.classes.map((k) => (PAGES[k] ? `<a class="chip" target="_blank" rel="noopener" href="${PDF}#page=${PAGES[k]}">${esc(CLASS_NAME[k] || k)}: doses &amp; side effects</a>` : "")).join("");
    const idx = s.abx.indexOf(item.row);
    return `<div class="rx ${a.status}">
      <div class="set"><span class="badge b-${a.status}">${lab}</span>${esc(item.row.setting)} <span class="muted">· ${esc(item.row.tier)}</span></div>
      <div class="reg">${esc(item.row.regimen)}</div>
      ${a.notes.length ? `<ul>${a.notes.map((n) => `<li class="${n.s}">${esc(n.msg)}</li>`).join("")}</ul>` : ""}
      <div class="acts"><button data-use="${idx}">Use in note</button>${chips}</div></div>`;
  }
  const list = (h, items, open) => (items && items.length ? `<details${open ? " open" : ""}><summary>${h}</summary><ul>${items.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></details>` : "");

  function draw() {
    const s = state.site && byId(state.site);
    if (!s) return;
    const c = ctx(), ch = R.choose(s, state.tier, c);
    const tiersHtml = TIERS.filter(([t]) => !t || (s.abx || []).some((r) => r.tier === t)).map(([t, n]) => `<button data-tier="${t}" class="${state.tier === t ? "on" : ""}">${n}</button>`).join("");
    const al = R.allergyLines(s, c.allergy);
    const riskOn = Object.keys(c.risks).filter((k) => c.risks[k]);
    let h = `<h2>${esc(s.label)}</h2><div class="muted">${esc(s.sub || "")}${state.chartSites.includes(s.id) ? ' · <span class="from">on the problem list</span>' : ""}</div>
      <div class="tiers">${tiersHtml}</div>`;
    if (s.watch && s.watch.length) h += `<div class="alert red"><b>Red flag:</b> ${esc(s.watch[0])}</div>`;
    (s.cards || []).forEach((cd, i) => {
      const t = cd.table ? `<table style="width:100%;border-collapse:collapse;font-size:12.5px;margin:4px 0 8px">${"<tr>" + cd.table.head.map((x) => `<th style="text-align:left;border:1px solid var(--line);padding:3px 6px">${esc(x)}</th>`).join("") + "</tr>"}${cd.table.rows.map((r) => "<tr>" + r.map((x, j) => `<td style="border:1px solid var(--line);padding:3px 6px">${j ? esc(x) : "<b>" + esc(x) + "</b>"}</td>`).join("") + "</tr>").join("")}</table>` : "";
      h += `<details${i === 0 ? " open" : ""}><summary>Key decision: ${esc(cd.title)}</summary>${cd.items ? `<ul>${cd.items.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}${t}${cd.note ? `<p class="small muted">${esc(cd.note)}</p>` : ""}</details>`;
    });
    if (ch.matched.length) h += `<h3>Matches this patient's resistance risk (${riskOn.map((k) => ({ mrsa: "MRSA", pseudo: "Pseudomonas/hospital", esbl: "ESBL" })[k]).join(", ")})</h3>` + ch.matched.map((i) => rxCard(i, s)).join("");
    h += `<h3>${ch.matched.length ? "Standard choices" : "Choices"}</h3>` + (ch.main.length ? ch.main.map((i) => rxCard(i, s)).join("") : '<div class="muted">None at this severity – try another level.</div>');
    if (ch.ifRisk.length) h += `<details><summary>Only if risk factors (${ch.ifRisk.length}) – tick MRSA / Pseudomonas / ESBL above if they apply</summary>${ch.ifRisk.map((i) => rxCard(i, s)).join("")}</details>`;
    if (al.length) h += `<div class="alert warn"><b>Allergy alternatives for this site:</b><ul style="margin:4px 0 0 18px;padding:0">${al.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>`;
    h += list("Red flags / what to watch for", s.watch, true) + list("Likely organisms", s.organisms);
    if (s.ix) h += list("Tests before / with antibiotics", [].concat(s.ix.blood || [], s.ix.imaging || [], s.ix.other || []));
    h += list("Source control", s.source) + list("Duration", s.duration) + list("IV → PO", s.ivpo) + list("When to call ID", s.idc) + list("When to call a surgeon", s.surgeon);
    h += `<p class="small muted">Full class reference: <a target="_blank" rel="noopener" href="${PDF}">antibiotic classes PDF</a>. Same content as the Infections by site tab.</p>`;
    $("panel").innerHTML = h;
    $("panel").querySelectorAll("[data-tier]").forEach((b) => (b.onclick = () => { state.tier = b.dataset.tier; draw(); }));
    $("panel").querySelectorAll("[data-use]").forEach((b) => (b.onclick = () => {
      const row = s.abx[+b.dataset.use], item = { row, a: R.assess(row.regimen, c) };
      $("note").value = R.note(s, row.tier, item, c);
    }));
  }
  $("copy").onclick = () => { $("note").select(); try { navigator.clipboard.writeText($("note").value); } catch (e) { document.execCommand("copy"); } };

  // ---- chart ----
  function prefill(f) {
    const set = (id, v) => ($(id).checked = !!v);
    const ac = C.allergyCtx(f.allergies);
    $("cAllergy").value = ac.allergy; set("cSulfa", ac.sulfa);
    $("allergyFrom").hidden = !ac.why.length; $("allergyFrom").textContent = ac.why.length ? "chart: " + ac.why.join("; ") : "";
    const kg = f.kg && f.kg.v, cr = f.cr && f.cr.v, cl = R.crcl(f.age, kg, cr, f.sex);
    $("cCrcl").value = cl != null ? cl : "";
    set("rMrsa", f.micro.mrsa.length); set("rEsbl", f.micro.esbl.length); set("rPseudo", f.micro.pseudo.length || f.probs.some((p) => /hospital.acquired|ventilator|\bhap\b|\bvap\b|nosocomial|neutropeni/i.test(p.text)));
    set("cPreg", f.pregnant); set("cQt", (f.qtc && f.qtc.v >= 470) || f.cls.qtDrug.length >= 2); set("cVpa", f.cls.valproate.length); set("cWarf", f.cls.warfarin.length);
    set("cSero", f.cls.serotonergic.length); set("cStatin", f.cls.statinColch.length); set("cSteroid", (f.age || 0) >= 65 || f.cls.steroids.length); set("cCdiff", f.micro.cdiff.length);
    const why = [];
    if (cl != null) why.push(`CrCl ${cl} (Cockcroft-Gault: age ${f.age}, ${kg} kg, Cr ${cr})`); else why.push("CrCl: no recent creatinine/weight – type it");
    if (f.micro.mrsa.length) why.push("MRSA in past results/problems"); if (f.micro.esbl.length) why.push("ESBL/CRE in past results"); if (f.micro.pseudo.length) why.push("Pseudomonas in past results");
    if (f.qtc) why.push(`QTc ${f.qtc.v}`); ["valproate", "warfarin", "serotonergic", "statinColch", "steroids"].forEach((k) => f.cls[k].length && why.push(f.cls[k][0]));
    if (f.pregnant) why.push("pregnancy on problem list");
    if (f.cls.abx.length) why.push("current antibiotics: " + f.cls.abx.join("; "));
    $("critFrom").textContent = "From the chart: " + why.join(" · ");
    state.chartSites = SITES.filter((s) => s.match && f.probs.some((p) => s.match.test(p.text))).map((s) => s.id);
    if (state.chartSites.length) pick(state.chartSites[0]); else markMap();
  }

  function load(raw, msg, errors) {
    state.f = raw ? C.parse(raw) : null;
    const p = raw && raw.patient;
    $("ptLine").textContent = p ? [state.f.age != null ? state.f.age + " y" : "", state.f.sex].filter(Boolean).join(" · ") : "";
    $("pstatus").textContent = msg;
    $("errs").textContent = errors && errors.length ? "Could not read: " + errors.join("; ") : "";
    if (state.f) prefill(state.f); else { state.chartSites = []; markMap(); }
    draw();
  }
  const SAMPLES = window.ABXMAP_SAMPLES || [];
  SAMPLES.forEach((p, i) => { const o = document.createElement("option"); o.value = i; o.textContent = p.label; $("testsel").appendChild(o); });
  $("testsel").onchange = () => { const p = SAMPLES[$("testsel").value]; if (!p) return load(null, "Open from Cerner to read the chart, or pick a made-up patient:"); load(p.build(Date.now()), "Made-up patient", []); };

  async function fromChart() {
    if (typeof FHIR === "undefined" || !(location.search.includes("code=") || location.search.includes("complete=") || sessionStorage.getItem("SMART_KEY"))) return false;
    $("pstatus").textContent = "Reading the chart…";
    try { const client = await FHIR.oauth2.ready(); const { raw, errors } = await C.gather(client, (m) => ($("pstatus").textContent = m)); load(raw, "Chart read (read-only).", errors); return true; }
    catch (e) { $("pstatus").textContent = "Could not read the chart: " + (e && e.message ? e.message : e) + ". The made-up patients still work."; return false; }
  }
  markMap();
  const demo = new URLSearchParams(location.search).get("demo");
  fromChart().then((ok) => { if (!ok && demo && SAMPLES[+demo - 1]) { $("testsel").value = +demo - 1; $("testsel").onchange(); } });
})();
