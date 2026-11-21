/* ILD tab - UI. Reads the chart (chart.js), applies rules (rules.js), shows content (content.js). Read-only; nothing is sent anywhere. */
(function () {
  const $ = (id) => document.getElementById(id);
  const R = window.IldRules, C = window.IldChart, K = window.IldContent;
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const fmtD = (t) => (t ? new Date(t).toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "2-digit" }) : "");
  const fmtT = (t) => (t ? new Date(t).toLocaleString("en-CA", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "");
  const TKNAME = { tox: "Oncology toxicity", sero: "Autoimmune serology", onc: "Oncology", chf: "CHF" };
  const GONAME = { acute: "Acute worsening", drug: "Drug pneumonitis", ctd: "CTD / serology", types: "ILD types", disch: "Discharge" };
  const state = { f: null };

  // ---- collapsible sections, remembered in this browser ----
  const OPEN_KEY = "ild-open";
  let openMap = {}; try { openMap = JSON.parse(localStorage.getItem(OPEN_KEY) || "{}"); } catch (e) { openMap = {}; }
  const saveOpen = () => { try { localStorage.setItem(OPEN_KEY, JSON.stringify(openMap)); } catch (e) {} };
  function wireDetails(root) {
    root.querySelectorAll("details[data-k]").forEach((d) => {
      if (d.dataset.wired) return; d.dataset.wired = "1";
      if (openMap[d.dataset.k] != null) d.open = openMap[d.dataset.k];
      d.addEventListener("toggle", () => { openMap[d.dataset.k] = d.open; saveOpen(); });
    });
  }
  document.addEventListener("click", (e) => {
    const ex = e.target.closest("[data-expand]"), co = e.target.closest("[data-collapse]");
    if (ex || co) $((ex || co).dataset.expand || (ex || co).dataset.collapse).querySelectorAll("details").forEach((d) => (d.open = !!ex));
    const a = e.target.closest("[data-goto]"); if (a) { e.preventDefault(); show(a.dataset.goto); return; }
    const k = e.target.closest("[data-toolkit]");
    if (k) { e.preventDefault(); try { if (window.parent !== window && typeof window.parent.show === "function") { window.parent.show(k.dataset.toolkit); return; } } catch (err) {} window.open("../../index.html#" + k.dataset.toolkit, "_blank", "noopener"); }
  });
  function show(t) {
    document.querySelectorAll("nav button").forEach((b) => b.classList.toggle("on", b.dataset.t === t));
    document.querySelectorAll("section.tab").forEach((s) => s.classList.toggle("on", s.id === "tab-" + t));
    if (t === "note") buildNote(false); if (t === "handout") drawHandout();
    window.scrollTo(0, 0);
  }
  $("nav").onclick = (e) => { const b = e.target.closest("button"); if (b) show(b.dataset.t); };
  const linkFor = (x) => (x.go ? ` <a href="#" data-goto="${x.go}">→ ${esc(GONAME[x.go])}</a>` : x.tk ? ` <a href="#" data-toolkit="${x.tk}">→ ${esc(TKNAME[x.tk] || x.tk)} tab</a>` : "");
  const flagHtml = (list) => list.map((x) => `<div class="flag ${x.level}">${esc(x.text)}${linkFor(x)}</div>`).join("");

  // ---- reference tabs ----
  function drawSections() {
    Object.entries(K.SECTIONS).forEach(([tab, secs]) => {
      $("tab-" + tab).innerHTML = `<div id="pt-${tab}"></div>
        <div class="tools noprint"><button class="btn ghost small" data-expand="tab-${tab}">Expand all</button><button class="btn ghost small" data-collapse="tab-${tab}">Collapse all</button></div>
        ${secs.map((s, i) => `<details data-k="${tab}-${i}"${s.open ? " open" : ""}><summary>${esc(s.t)}</summary>${s.h}</details>`).join("")}
        <p class="muted">UNVERIFIED draft. Confirm with respirology and current guidelines.</p>`;
    });
    // acute exacerbation checker
    $("aeBox").innerHTML = `<div class="card"><b>Acute exacerbation – 2016 definition (all 4 needed)</b><div class="chk" id="aeChk">
      <label><input type="checkbox" data-ae="dx"> Previous or concurrent diagnosis of IPF (or other fibrotic ILD)</label>
      <label><input type="checkbox" data-ae="lt1m"> Acute worsening or new dyspnea, usually &lt;1 month</label>
      <label><input type="checkbox" data-ae="newggo"> CT: new bilateral ground glass and/or consolidation on a background of UIP/fibrosis</label>
      <label><input type="checkbox" data-ae="notHF"> Not fully explained by heart failure or fluid overload</label></div><div id="aeOut"></div></div>`;
    $("aeChk").onchange = drawAe;
    // work-up checklist
    $("workupBox").innerHTML = `<div class="card"><b>Work-up checklist</b> <span class="muted">(✓ = found in the chart; tick the rest yourself)</span><div id="wuList" class="chk"></div></div>`;
    // GAP
    $("gapBox").innerHTML = `<div class="card"><b>GAP index</b> <span class="muted">(IPF: gender, age, FVC and DLCO % predicted from the last PFTs)</span>
      <div class="calc"><label>Sex <select id="gSex"><option value="male">Male</option><option value="female">Female</option></select></label><label>Age <input type="number" id="gAge"></label>
      <label>FVC % <input type="number" id="gFvc"></label><label>DLCO % <input type="number" id="gDlco"></label><label><input type="checkbox" id="gNA"> Could not do DLCO</label></div><div id="gapOut"></div></div>`;
    ["gSex", "gAge", "gFvc", "gDlco", "gNA"].forEach((id) => { $(id).oninput = drawGap; $(id).onchange = drawGap; });
    drawAe(); drawGap();
  }
  function drawAe() {
    const sel = {}; document.querySelectorAll("#aeChk [data-ae]").forEach((i) => (sel[i.dataset.ae] = i.checked));
    const r = R.aeCriteria(sel); $("aeOut").innerHTML = `<div class="flag ${r.met ? "red" : r.n >= 2 ? "amber" : "info"}">${esc(r.text)}</div>`;
  }
  function drawGap() {
    const num = (id) => ($(id).value === "" ? null : +$(id).value);
    if (num("gAge") == null || (num("gFvc") == null && num("gDlco") == null && !$("gNA").checked)) { $("gapOut").innerHTML = '<span class="muted">Enter age and the last FVC/DLCO % predicted (from PFTs).</span>'; return; }
    const g = R.gap({ sex: $("gSex").value, age: num("gAge"), fvc: num("gFvc"), dlco: num("gDlco"), dlcoNA: $("gNA").checked });
    $("gapOut").innerHTML = `<div class="flag ${g.stage === "III" ? "red" : g.stage === "II" ? "amber" : "green"}"><span class="score">${g.score}</span> ${esc(g.text)}</div>`;
  }

  // ---- chart ----
  const LAB_ORDER = ["wbc", "eos", "crp", "pct", "bnp", "ntbnp", "ddimer", "trop", "ldh", "bdg", "ck", "ferritin", "alt", "cr"];
  function render() {
    const f = state.f;
    document.querySelectorAll("[id^=pt-]").forEach((d) => (d.innerHTML = ""));
    if (!f) { ["cFlags", "cIld", "cO2", "cCt", "cLabs", "cMeds"].forEach((id) => ($(id).innerHTML = '<span class="muted">No patient loaded.</span>')); $("wuList").innerHTML = ""; return; }
    const fl = R.flags(f);
    $("cFlags").innerHTML = fl.length ? flagHtml(fl) : '<div class="flag green">No ILD flags from the data found.</div>';
    const byTab = (t) => fl.filter((x) => x.go === t && x.level !== "info");
    Object.keys(K.SECTIONS).forEach((t) => { const l = byTab(t); if (l.length && $("pt-" + t)) $("pt-" + t).innerHTML = `<div class="card"><b>This patient</b>${flagHtml(l.map((x) => Object.assign({}, x, { go: null })))}</div>`; });

    const c = f.cls;
    $("cIld").innerHTML = (c.has ? `<p><b>ILD on the problem list:</b> ${esc(c.ild.join("; "))}</p>${c.sub.length ? `<p>Type: ${c.sub.map((x) => `<span class="pill">${esc(x.name)}</span>`).join("")}${c.fibrotic ? '<span class="pill">fibrotic</span>' : ""}</p>` : ""}` : '<p class="muted">No ILD on the problem list.</p>')
      + (c.ctd.length ? `<p><b>Autoimmune disease:</b> ${c.ctd.map((x) => `<span class="pill">${esc(x.name)}</span>`).join("")}</p>` : "");

    const sp = f.spo2.filter((x) => Date.now() - x.t <= 72 * 36e5).sort((a, b) => b.t - a.t).slice(0, 6);
    $("cO2").innerHTML = (f.o2 ? `<p>O2 flow: <b>${f.o2.from} → ${f.o2.to} L/min</b> (max ${f.o2.max})${f.o2.rise ? ' <span style="color:var(--red);font-weight:600">rising</span>' : ""}</p>` : '<p class="muted">No O2 flow recorded in 72 h.</p>')
      + (sp.length ? `<table><tr><th>Time</th><th>SpO2</th></tr>${sp.map((x) => `<tr><td class="muted">${fmtT(x.t)}</td><td${x.v < 88 ? ' style="color:var(--red);font-weight:600"' : ""}>${x.v}%</td></tr>`).join("")}</table>` : '<p class="muted">No SpO2 in 72 h.</p>');

    $("cCt").innerHTML = f.ct.length ? `<table><tr><th>Date</th><th>Study</th><th>Findings</th></tr>${f.ct.slice(0, 8).map((x) => `<tr><td class="muted">${fmtD(x.t)}</td><td>${esc(x.title)}</td><td>${x.findings.map((y) => `<span class="pill" style="${y.kind === "fib" ? "background:var(--amber-soft)" : y.kind === "acute" ? "background:var(--red-soft)" : ""}">${esc(y.name)}</span>`).join("")}<div class="muted">${esc(x.text)}</div></td></tr>`).join("")}</table><p class="muted">Amber = fibrosis words, red = acute words. Compare old and new: fibrosis that was already there is not the acute problem.</p>`
      : '<span class="muted">No chest imaging reports found (5 years).</span>';

    const rows = LAB_ORDER.filter((k) => f.latest[k] && !(k === "ntbnp" && f.latest.bnp === f.latest.ntbnp)).map((k) => { const x = f.latest[k]; return `<tr><td>${esc(x.name)}</td><td${x.hi ? ' style="font-weight:600"' : ""}>${esc(x.v)} <span class="muted">${esc(x.u)}</span></td><td class="muted">${fmtD(x.t)}</td></tr>`; });
    $("cLabs").innerHTML = (rows.length ? `<table>${rows.join("")}</table>` : '<span class="muted">No relevant labs found.</span>')
      + (f.serology.length ? `<p><b>Serology in the chart:</b> ${f.serology.slice(-8).map((x) => `<span class="pill">${esc(x.name)}: ${esc(x.v)}</span>`).join("")} <a href="#" data-toolkit="sero">→ Autoimmune serology tab</a></p>` : "");

    const meds = f.meds.map((m) => m.text), S = R.S;
    const grp = [["Antifibrotic", meds.filter((m) => S.nintedanib.test(m) || S.pirfenidone.test(m) || S.nerandomilast.test(m))], ["Steroids", meds.filter((m) => S.steroid.test(m))],
      ["Immunosuppressants", meds.filter((m) => S.immuno.test(m) && !S.steroid.test(m))], ["PJP prophylaxis", meds.filter((m) => S.pjp.test(m))], ["Possible pneumonitis cause", f.tox.map((d) => `${d.name}: ${d.orders[0]}`)]];
    $("cMeds").innerHTML = `<table>${grp.map(([n, l]) => `<tr><td>${n}</td><td>${l.length ? l.map(esc).join("<br>") : '<span class="muted">none</span>'}</td></tr>`).join("")}</table>`;

    // patient-specific boxes on reference tabs
    $("drugBox").innerHTML = f.tox.length ? `<div class="card"><b>This patient's possible culprits</b><ul>${f.tox.map((d) => `<li><b>${esc(d.name)}</b> – ${esc(d.orders.join("; "))}</li>`).join("")}</ul></div>` : '<p class="muted">No listed pneumonitis drugs on this patient\'s medication list (check outpatient meds, recent chemo and past amiodarone).</p>';
    $("seroBox").innerHTML = f.serology.length ? `<div class="card"><b>Serology found</b> ${f.serology.map((x) => `<span class="pill">${esc(x.name)}: ${esc(x.v)} (${fmtD(x.t)})</span>`).join("")}</div>` : '<div class="flag info">No autoimmune serology found in the last year.</div>';
    $("dischBox").innerHTML = `<div class="card"><b>From the chart</b><ul>
      <li>${grp[0][1].length ? "✓ Antifibrotic: " + esc(grp[0][1].join("; ")) : "✗ No antifibrotic on the list" + (c.fibrotic ? " (fibrotic ILD – ask about home meds/eligibility)" : "")}</li>
      <li>${grp[1][1].length ? (grp[3][1].length ? "✓ PJP prophylaxis with steroids" : "✗ On steroids, no PJP prophylaxis listed") : "– No steroids"}</li>
      <li>${f.o2 ? `O2 now ${f.o2.to} L/min – walk test before discharge` : "No O2 recorded – still check exertional SpO2"}</li></ul></div>`;

    // work-up list
    const now = Date.now(), within = (k, h) => f.latest[k] && now - f.latest[k].t <= h * 36e5;
    const ims = (f.meds || []).some((m) => S.steroid.test(m.text) || S.immuno.test(m.text));
    const items = [
      [within("pct", 72), `Procalcitonin${f.latest.pct ? ` (${f.latest.pct.v})` : ""}`], [within("bnp", 72) || within("ntbnp", 72), `BNP / NT-proBNP${f.latest.bnp ? ` (${f.latest.bnp.v})` : ""}`],
      [f.ctpaRecent, "CTPA or PE excluded (7 days)"], [f.ctRecent, "CT chest in the last 14 days"], [null, "Blood and sputum cultures"], [null, "Viral swab (influenza, COVID, RSV)"],
      [null, "Echo (RV, LV function)"], [null, "Medication review for pneumotoxic drugs"]].concat(ims ? [[within("ldh", 72), "LDH (PJP)"], [!!f.latest.bdg, "Beta-D-glucan / PJP PCR"]] : []);
    $("wuList").innerHTML = items.map(([ok, t], i) => `<label>${ok === true ? '<span style="color:var(--green);font-weight:700">✓</span>' : ok === false ? '<span style="color:var(--red);font-weight:700">✗</span>' : ""} <input type="checkbox" ${ok ? "checked" : ""}> ${esc(t)}</label>`).join("");

    // prefill AE and GAP
    const ctIds = new Set(f.ctNew.map((x) => x.id));
    const set = (k, v) => { const i = document.querySelector(`#aeChk [data-ae="${k}"]`); if (i) i.checked = !!v; };
    set("dx", c.has && (c.fibrotic || c.sub.some((x) => x.id === "ipf"))); set("lt1m", f.o2 && f.o2.rise); set("newggo", (ctIds.has("ggo") || ctIds.has("consol")) && ["honeycomb", "traction", "uip", "fibrosis", "reticul"].some((k) => ctIds.has(k))); set("notHF", false);
    drawAe();
    if (f.age != null) $("gAge").value = f.age; if (f.sex === "female" || f.sex === "male") $("gSex").value = f.sex; drawGap();

    // handout + note defaults
    const ho = { oxygen: !!(f.o2 && f.o2.to > 0), nintedanib: meds.some((m) => S.nintedanib.test(m)), pirfenidone: meds.some((m) => S.pirfenidone.test(m)), steroid: meds.some((m) => S.steroid.test(m)),
      immuno: meds.some((m) => S.immuno.test(m) && !S.steroid.test(m)), hp: c.sub.some((x) => x.id === "hp"), drug: f.tox.some((d) => d.strong) };
    document.querySelectorAll("#hoChk [data-ho]").forEach((i) => (i.checked = !!ho[i.dataset.ho]));
    $("hoDrug").value = f.tox.filter((d) => d.strong).map((d) => d.name).join(", ");
    $("nIld").value = c.has ? c.ild[0].replace(/\s+[A-Z]\d\d(\.\d+)?$/, "") : (f.ctNew.length ? "ILD pattern on CT (no diagnosis yet)" : "");
    $("nType").value = c.sub.map((x) => x.name).join(", ");
    drawHandout(); buildNote(true);
  }

  // ---- handout ----
  const HO = {
    oxygen: `<h3>Home oxygen</h3><ul><li>Use it at the flow you were prescribed, especially when walking, washing and sleeping.</li><li><b>No smoking or open flames</b> near oxygen (candles, gas stoves, fireplaces). Keep tubing away from heat.</li><li>A pulse oximeter at home helps: call your team if your number is lower than your usual target at your usual flow.</li></ul>`,
    nintedanib: `<h3>Nintedanib (Ofev)</h3><ul><li>Diarrhea is common: start loperamide at the first loose stool and drink fluids. Call if more than 4–6 times a day or you cannot keep fluids down.</li><li>Blood tests for the liver are needed regularly. Tell surgeons and dentists you take it (it can slow healing and increase bleeding).</li></ul>`,
    pirfenidone: `<h3>Pirfenidone (Esbriet)</h3><ul><li>Take with food to reduce nausea.</li><li>It makes skin burn easily: sunscreen (SPF 50), hat and long sleeves outdoors.</li><li>Do not start ciprofloxacin or fluvoxamine without checking with your doctor or pharmacist. Liver blood tests are needed.</li></ul>`,
    steroid: `<h3>Steroids (prednisone)</h3><ul><li><b>Do not stop suddenly</b> – follow the taper.</li><li>They raise blood sugar, can affect sleep and mood, and thin the bones (calcium, vitamin D).</li><li>Take your infection-prevention antibiotic (e.g. Septra) if prescribed.</li></ul>`,
    immuno: `<h3>Immune-suppressing medicine</h3><ul><li>You are more likely to get infections: fever, chills or a new cough → call the same day.</li><li>Keep up with blood tests; get the flu, COVID, pneumonia, RSV and shingles (Shingrix) vaccines.</li></ul>`,
    hp: `<h3>Hypersensitivity pneumonitis</h3><ul><li>The most important treatment is <b>avoiding the trigger</b> your team identified (birds, feather pillows/duvets, mould, hot tubs, some work dusts).</li><li>Damp or mouldy homes may need professional cleaning.</li></ul>`,
    drug: `<h3>A medicine that harmed your lungs</h3><ul><li>Do not take <b>{DRUG}</b> again unless a lung specialist says it is safe. Add it to your allergy/intolerance list and tell your pharmacist.</li></ul>` };
  function drawHandout() {
    const on = {}; document.querySelectorAll("#hoChk [data-ho]").forEach((i) => (on[i.dataset.ho] = i.checked));
    const phone = $("hoPhone").value.trim() || "________________", drug = $("hoDrug").value.trim() || "this medicine";
    const name = state.f && $("ptLine").textContent.split(" · ")[0];
    $("handout").innerHTML = `<h2>Living with interstitial lung disease (lung scarring): what to watch for</h2>
      ${name ? `<p class="muted">For: ${esc(name)} · ${new Date().toLocaleDateString("en-CA")}</p>` : ""}
      <div class="box"><b>Call 911 if you have:</b><ul><li>Severe shortness of breath at rest, or you cannot speak in full sentences</li><li>Blue or grey lips or face</li><li>Chest pain, fainting, or new confusion or drowsiness</li><li>Coughing up a lot of blood</li></ul></div>
      <div class="box amber"><b>Go to the Emergency Department or call your team the same day if:</b><ul><li>You are more breathless than usual over a few days, or need more oxygen than usual</li><li>Fever, chills, or coughing up coloured phlegm</li><li>Sudden sharp chest pain with breathlessness</li><li>One leg swollen and painful</li><li>Swollen ankles and weight gain over a few days</li></ul></div>
      <p>Respirology / clinic: <b>${esc(phone)}</b>. After hours or unsure: <b>HealthLink BC 8-1-1</b>.</p>
      ${Object.keys(HO).filter((k) => on[k]).map((k) => HO[k].replace("{DRUG}", esc(drug))).join("")}
      <h3>Every day</h3><ul><li>Pace yourself; pursed-lip breathing; pulmonary rehabilitation helps.</li><li>Stay away from smoke and dusts; stop smoking.</li><li>Vaccines: flu every year, COVID, pneumonia, RSV.</li><li>Talk with your team about your wishes for care if your breathing gets much worse.</li></ul>
      <p class="muted">General information, not a replacement for advice from your care team.</p>`;
  }
  $("hoChk").onchange = drawHandout; $("hoPhone").oninput = drawHandout; $("hoDrug").oninput = drawHandout;

  // ---- note ----
  let noteEdited = false; $("noteText").oninput = () => (noteEdited = true);
  function buildNote(force) {
    if (noteEdited && !force) return;
    const f = state.f, fl = f ? R.flags(f) : [];
    const aeSel = {}; document.querySelectorAll("#aeChk [data-ae]").forEach((i) => (aeSel[i.dataset.ae] = i.checked));
    const ae = R.aeCriteria(aeSel);
    $("noteText").value = R.note({ date: new Date().toLocaleDateString("en-CA"), ild: $("nIld").value.trim(), type: $("nType").value.trim(), baseO2: $("nBase").value.trim(), resp: $("nResp").value.trim(),
      ct: f && f.ct[0] ? `${fmtD(f.ct[0].t)} ${f.ct[0].title}: ${f.ct[0].findings.map((x) => x.name).join(", ") || f.ct[0].text.slice(0, 120)}` : "",
      o2: f && f.o2 ? `O2 ${f.o2.from} → ${f.o2.to} L/min over 72 h${f.spo2min != null ? `, lowest SpO2 ${f.spo2min}%` : ""}` : "",
      labs: f ? ["wbc", "eos", "crp", "pct", "bnp", "ldh", "ck", "ferritin"].filter((k) => f.latest[k]).map((k) => `${f.latest[k].name} ${f.latest[k].v}`).join(", ") : "",
      meds: f ? f.meds.map((m) => m.text).filter((m) => R.S.nintedanib.test(m) || R.S.pirfenidone.test(m) || R.S.steroid.test(m) || R.S.immuno.test(m) || R.S.pjp.test(m)) : [],
      tox: f ? f.tox.map((d) => d.name) : [], ae: ae.n ? `${ae.n}/4${ae.met ? " – met" : ""}` : "",
      flags: fl.filter((x) => x.level === "red" || x.level === "amber").map((x) => x.text), code: $("nCode").value, respAware: $("nAware").checked, decision: $("noteDecision").value.trim() });
    noteEdited = false;
  }
  ["nIld", "nType", "nBase", "nResp", "nCode", "nAware", "noteDecision"].forEach((id) => { $(id).oninput = () => buildNote(true); $(id).onchange = () => buildNote(true); });
  $("noteRebuild").onclick = () => buildNote(true);
  $("noteCopy").onclick = () => { $("noteText").select(); try { navigator.clipboard.writeText($("noteText").value); } catch (e) { document.execCommand("copy"); } $("noteCopy").textContent = "Copied"; setTimeout(() => ($("noteCopy").textContent = "Copy"), 1200); };

  // ---- loading ----
  function load(raw, msg, errors) {
    state.f = raw ? C.parse(raw) : null;
    const p = raw && raw.patient;
    $("ptLine").textContent = p ? [p.name && p.name[0] && (p.name[0].text || [p.name[0].family, (p.name[0].given || []).join(" ")].filter(Boolean).join(", ")), state.f.age != null ? state.f.age + " y" : "", state.f.sex].filter(Boolean).join(" · ") : "";
    $("pstatus").textContent = msg;
    $("errs").textContent = errors && errors.length ? "Could not read: " + errors.join("; ") + (errors.some((e) => /\b40[13]\b|Unauthorized|Forbidden/i.test(e)) ? ". Check the scopes in the Code Console." : ". Cerner's sandbox can be slow: reload to try again.") : "";
    render();
  }
  const SAMPLES = window.ILD_SAMPLES || [];
  SAMPLES.forEach((p, i) => { const o = document.createElement("option"); o.value = i; o.textContent = p.label; $("testsel").appendChild(o); });
  $("testsel").onchange = () => { const p = SAMPLES[$("testsel").value]; if (!p) return load(null, "Open from Cerner to read the chart, or pick a made-up patient:"); load(p.build(Date.now()), "Made-up patient: " + p.label, []); };
  async function fromChart() {
    if (typeof FHIR === "undefined" || !(location.search.includes("code=") || location.search.includes("complete=") || sessionStorage.getItem("SMART_KEY"))) return false;
    $("pstatus").textContent = "Reading the chart…";
    try { const client = await FHIR.oauth2.ready(); const { raw, errors } = await C.gather(client, (m) => ($("pstatus").textContent = m)); load(raw, "Chart read (read-only). Nothing is sent anywhere.", errors); return true; }
    catch (e) { $("pstatus").textContent = "Could not read the chart: " + (e && e.message ? e.message : e) + ". The made-up patients still work."; return false; }
  }
  drawSections(); wireDetails(document); render(); drawHandout(); buildNote(true);
  const q = new URLSearchParams(location.search), demo = q.get("demo");
  if (q.get("tab") && $("tab-" + q.get("tab"))) show(q.get("tab"));
  fromChart().then((ok) => { if (!ok && demo && SAMPLES[+demo - 1]) { $("testsel").value = +demo - 1; $("testsel").onchange(); } });
})();
