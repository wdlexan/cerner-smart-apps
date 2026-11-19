/* Peritoneal carcinomatosis tab - UI. Reads the chart (chart.js), applies rules (rules.js). Read-only; nothing is sent anywhere. */
(function () {
  const $ = (id) => document.getElementById(id);
  const R = window.PCRules, C = window.PCChart;
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const fmtD = (t) => (t ? new Date(t).toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "2-digit" }) : "");
  const PRIMARY_LABEL = { colorectal: "Colorectal", gastric: "Gastric / GEJ", ovarian: "Ovarian / tubal / primary peritoneal", pmp: "Appendiceal / pseudomyxoma", other: "Other" };
  const state = { f: null, primary: null, ls: {} };

  // ---- tabs ----
  function show(t) {
    document.querySelectorAll("nav button").forEach((b) => b.classList.toggle("on", b.dataset.t === t));
    document.querySelectorAll("section.tab").forEach((s) => s.classList.toggle("on", s.id === "tab-" + t));
    if (t === "note") buildNote(false);
    window.scrollTo(0, 0);
  }
  $("nav").onclick = (e) => { const b = e.target.closest("button"); if (b) show(b.dataset.t); };
  document.addEventListener("click", (e) => { const a = e.target.closest("[data-goto]"); if (a) { e.preventDefault(); show(a.dataset.goto); } });

  // ---- PCI ----
  const ABD = [1, 2, 3, 8, 0, 4, 7, 6, 5], SB = [9, 10, 11, 12];
  const nameOf = (n) => R.REGIONS.find((r) => r.n === n).name;
  function cell(n) {
    const d = document.createElement("div");
    d.className = "reg"; d.dataset.n = n; d.dataset.ls = state.ls[n] || 0;
    d.innerHTML = `<span>${n} · ${esc(nameOf(n))}</span><b>${state.ls[n] || 0}</b>`;
    d.title = "Click to change lesion size (0–3)";
    d.onclick = () => { state.ls[n] = ((state.ls[n] || 0) + 1) % 4; drawPci(); };
    return d;
  }
  function drawPci() {
    $("abdGrid").replaceChildren(...ABD.map(cell));
    $("sbGrid").replaceChildren(...SB.map(cell));
    const tot = R.pciTotal(state.ls), it = R.pciInterp(tot, $("pciPrimary").value);
    $("pciTotal").textContent = tot;
    const sbHeavy = SB.some((n) => (state.ls[n] || 0) >= 2);
    $("pciInterp").innerHTML = `<div class="flag ${it.level}">${esc(it.text)}</div>` + (sbHeavy ? `<div class="flag amber">${esc(it.sb)}</div>` : "");
  }
  $("pciReset").onclick = () => { state.ls = {}; drawPci(); };
  $("pciPrimary").onchange = drawPci;

  // ---- MBO checklist ----
  function mboWeights() { return [...document.querySelectorAll("#mboChk input:checked")].map((i) => +i.dataset.w); }
  function drawMbo() { const a = R.mboAdvice(mboWeights()); $("mboChkOut").className = "flag " + a.level; $("mboChkOut").textContent = a.text; }
  $("mboChk").onchange = drawMbo;

  // ---- prognosis ----
  function progInputs() { return { ecog: +$("pgEcog").value, alb: $("pgAlb").value, mbo: $("pgMbo").checked, asc: $("pgAsc").checked, lines: $("pgLines").checked, pps: $("pgPps").value }; }
  function drawProg() {
    const p = R.prognosis(progInputs());
    $("pgOut").innerHTML = `<div class="flag ${p.level}">${esc(p.text)}${p.reasons.length ? `<div class="muted" style="margin-top:4px">Based on: ${esc(p.reasons.join(", "))}</div>` : ""}</div>
      <p class="muted">A rough prompt for a goals-of-care conversation, not a validated score. Validated tools: PPS, Palliative Prognostic Index (PPI), PaP score.</p>`;
  }
  ["pgEcog", "pgAlb", "pgMbo", "pgAsc", "pgLines", "pgPps"].forEach((id) => { $(id).oninput = drawProg; $(id).onchange = drawProg; });

  // ---- handout ----
  function drawHandout() { $("hoDrainSec").style.display = $("hoDrain").checked ? "" : "none"; $("hoMboSec").style.display = $("hoMbo").checked ? "" : "none"; }
  $("hoDrain").onchange = drawHandout; $("hoMbo").onchange = drawHandout;

  // ---- chart ----
  function flagHtml(list) { return list.map((x) => `<div class="flag ${x.level}">${esc(x.text)}${x.tab ? ` <a href="#" data-goto="${x.tab}">→ ${x.tab === "mbo" ? "Bowel obstruction" : "Ascites"}</a>` : ""}</div>`).join(""); }
  function render() {
    const f = state.f;
    if (!f) {
      ["chartFlags", "mboFlags"].forEach((id) => ($(id).innerHTML = ""));
      ["chartConds", "chartPrimary", "chartLabs", "chartMarkers", "chartMeds", "chartReports"].forEach((id) => ($(id).innerHTML = '<span class="muted">No patient loaded.</span>'));
      return;
    }
    const fl = R.flags(f);
    $("chartFlags").innerHTML = flagHtml(fl);
    $("mboFlags").innerHTML = flagHtml(fl.filter((x) => x.tab === "mbo"));
    const keys = ["pc", "mbo", "ascites", "cancer", "vte", "hydro"], seen = new Set(), probs = [];
    keys.forEach((k) => (f.prob[k] || []).forEach((t) => { if (!seen.has(t)) { seen.add(t); probs.push(t); } }));
    $("chartConds").innerHTML = probs.length ? "<ul>" + probs.map((t) => `<li>${esc(t)}</li>`).join("") + "</ul>" : '<span class="muted">None found on the problem list.</span>';
    const hits = R.detectPrimary(f.probText);
    const prim = hits.length ? hits[0].k : null;
    state.primary = prim;
    if (prim) $("pciPrimary").value = prim;
    $("chartPrimary").innerHTML = prim
      ? `<b>${esc(PRIMARY_LABEL[prim])}</b><div class="muted">from: ${esc(hits[0].t.replace(/\s+[A-Z]\d\d(\.\d+)?$/, ""))}</div><p><a href="#" data-goto="primary">Approach</a> · <a href="#" data-goto="chemo">Chemo</a></p>`
      : '<span class="muted">No primary cancer found on the problem list. Unknown primary → core biopsy with IHC (see Tests).</span>';
    const LAB_ORDER = ["na", "k", "mg", "po4", "ca", "alb", "cr", "lactate", "wbc", "hb", "bili", "alp"];
    const rows = LAB_ORDER.filter((k) => f.latest[k]).map((k) => { const x = f.latest[k], d = C.LABS.find((l) => l.id === k); return `<tr><td>${esc(d.name)}</td><td>${esc(x.v)} ${esc(x.u)}</td><td class="muted">${fmtD(x.t)}</td></tr>`; });
    if (f.corrCa != null) rows.push(`<tr><td>Corrected Ca</td><td>${f.corrCa} mmol/L</td><td class="muted">calc</td></tr>`);
    $("chartLabs").innerHTML = rows.length ? `<table>${rows.join("")}</table>` : '<span class="muted">No recent labs found.</span>';
    const mk = ["cea", "ca125", "ca199", "ca724"].filter((k) => f.l[k]).map((k) => { const d = C.LABS.find((l) => l.id === k); return `<tr><td>${esc(d.name)}</td><td>${f.l[k].slice(-3).map((x) => `${esc(x.v)} <span class="muted">(${fmtD(x.t)})</span>`).join(" → ")}</td></tr>`; });
    $("chartMarkers").innerHTML = mk.length ? `<table>${mk.join("")}</table><p class="muted">CA-125 rises with any ascites; use the trend, not one value.</p>` : '<span class="muted">No tumour markers in the past year.</span>';
    const MC = [["octreo", "Octreotide"], ["anticholin", "Antisecretory anticholinergic"], ["dex", "Dexamethasone"], ["antiemetic", "Antiemetics"], ["opioid", "Opioids"], ["anyLax", "Bowel regimen"], ["chemo", "Anticancer"], ["anticoag", "Anticoagulant"], ["diuretic", "Diuretic"]];
    const mr = MC.filter(([k]) => f.cls[k] && f.cls[k].length).map(([k, n]) => `<tr><td>${n}${k === "dex" && f.dexDays != null ? ` <span class="pill">day ~${f.dexDays}</span>` : ""}</td><td>${f.cls[k].map(esc).join("<br>")}</td></tr>`);
    $("chartMeds").innerHTML = mr.length ? `<table>${mr.join("")}</table>` : '<span class="muted">None of the relevant drug classes found.</span>';
    $("chartReports").innerHTML = f.reports.length ? "<ul>" + f.reports.slice(0, 5).map((r) => `<li><span class="muted">${fmtD(r.t)}</span> ${esc(r.text)}</li>`).join("") + "</ul>" : '<span class="muted">No report in the last 90 days mentioning peritoneal disease (only titles/conclusions are searched).</span>';
    // prefill elsewhere
    if (f.latest.alb) $("pgAlb").value = f.latest.alb.v;
    $("pgMbo").checked = !!(f.prob.mbo && f.prob.mbo.length);
    $("pgAsc").checked = !!(f.prob.ascites && f.prob.ascites.length);
    $("hoMbo").checked = $("pgMbo").checked || !$("pgAsc").checked;
    $("hoDrain").checked = $("pgAsc").checked;
    drawProg(); drawHandout(); drawPci(); buildNote(true);
  }

  // ---- note ----
  let noteEdited = false;
  $("noteText").oninput = () => (noteEdited = true);
  function buildNote(force) {
    if (noteEdited && !force) return;
    const f = state.f, tot = R.pciTotal(state.ls);
    const L = (k) => f && f.latest[k] ? `${C.LABS.find((l) => l.id === k).name} ${f.latest[k].v}` : null;
    const o = {
      primary: state.primary, primaryLabel: state.primary ? PRIMARY_LABEL[state.primary] : "",
      probs: f ? [].concat(f.prob.pc || [], f.prob.mbo || [], f.prob.ascites || []) : [],
      labs: f ? ["na", "k", "mg", "cr", "alb", "lactate"].map(L).filter(Boolean).concat(f.corrCa != null ? ["corr Ca " + f.corrCa] : []).join(", ") : "",
      markers: f ? ["cea", "ca125", "ca199"].filter((k) => f.l[k]).map((k) => `${C.LABS.find((l) => l.id === k).name} ${f.l[k].slice(-3).map((x) => x.v).join("→")}`).join("; ") : "",
      pci: tot, pciText: tot ? R.pciInterp(tot, $("pciPrimary").value).text.replace(/^PCI \d+: /, "") : "",
      mbo: $("pgMbo").checked, asc: $("pgAsc").checked,
      mboText: mboWeights().length ? R.mboAdvice(mboWeights()).text : "",
      flags: f ? R.flags(f).filter((x) => x.level === "red" || x.level === "amber").map((x) => x.text) : [],
      prog: R.prognosis(progInputs()).text,
      decision: $("noteDecision").value.trim() };
    $("noteText").value = R.note(o);
    noteEdited = false;
  }
  $("noteRebuild").onclick = () => buildNote(true);
  $("noteDecision").oninput = () => buildNote(true);
  $("noteCopy").onclick = () => { $("noteText").select(); try { navigator.clipboard.writeText($("noteText").value); } catch (e) { document.execCommand("copy"); } $("noteCopy").textContent = "Copied"; setTimeout(() => ($("noteCopy").textContent = "Copy"), 1200); };

  // ---- loading ----
  function load(raw, msg, errors) {
    state.f = raw ? C.parse(raw) : null;
    state.ls = {};
    const p = raw && raw.patient;
    $("ptLine").textContent = p ? [p.name && p.name[0] && (p.name[0].text || [p.name[0].family, (p.name[0].given || []).join(" ")].filter(Boolean).join(", ")), state.f.age != null ? state.f.age + " y" : "", state.f.sex].filter(Boolean).join(" · ") : "";
    $("pstatus").textContent = msg;
    $("errs").textContent = errors && errors.length ? "Could not read: " + errors.join("; ") + (errors.some((e) => /\b40[13]\b|Unauthorized|Forbidden/i.test(e)) ? ". Check the scopes in the Code Console." : ". Cerner's sandbox can be slow: reload to try again.") : "";
    render();
  }
  const SAMPLES = window.PC_SAMPLES || [];
  SAMPLES.forEach((p, i) => { const o = document.createElement("option"); o.value = i; o.textContent = p.label; $("testsel").appendChild(o); });
  $("testsel").onchange = () => { const p = SAMPLES[$("testsel").value]; if (!p) return load(null, "Open from Cerner to read the chart, or pick a made-up patient:"); load(p.build(Date.now()), "Made-up patient: " + p.label, []); };

  async function fromChart() {
    if (typeof FHIR === "undefined" || !(location.search.includes("code=") || location.search.includes("complete=") || sessionStorage.getItem("SMART_KEY"))) return false;
    $("pstatus").textContent = "Reading the chart…";
    try {
      const client = await FHIR.oauth2.ready();
      const { raw, errors } = await C.gather(client, (m) => ($("pstatus").textContent = m));
      load(raw, "Chart read (read-only). Nothing is sent anywhere.", errors);
      return true;
    } catch (e) { $("pstatus").textContent = "Could not read the chart: " + (e && e.message ? e.message : e) + ". The made-up patients still work."; return false; }
  }

  drawPci(); drawMbo(); drawProg(); drawHandout(); render();
  const demo = new URLSearchParams(location.search).get("demo");
  fromChart().then((ok) => { if (!ok && demo && SAMPLES[+demo - 1]) { $("testsel").value = +demo - 1; $("testsel").onchange(); } });
})();
