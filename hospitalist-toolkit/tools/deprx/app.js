/* Deprescribing tab - UI. Reads the chart (chart.js), applies rules (rules.js), shows guides (content.js). Read-only; nothing is sent anywhere. */
(function () {
  const $ = (id) => document.getElementById(id);
  const R = window.DeprxRules, C = window.DeprxChart, K = window.DeprxContent;
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const fmtD = (t) => (t ? new Date(t).toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "2-digit" }) : "");
  const BEERS = typeof R_DRUG !== "undefined" ? { R_DRUG, R_COMBO, R_DIS, ALIAS } : null; // from ../meds/beers-data.js
  const LV = { red: 0, amber: 1, info: 2 };
  const DECISIONS = ["", "Continue", "Continue – indication confirmed", "Reduce dose", "Taper and stop", "Stop now", "Hold", "Switch", "Discuss with patient/family", "Ask pharmacy"];
  const state = { f: null, r: null, fx: {}, ov: {}, dec: {}, pid: "" };

  // ---- collapsible sections, remembered in this browser ----
  const OPEN_KEY = "deprx-open";
  let openMap = {}; try { openMap = JSON.parse(localStorage.getItem(OPEN_KEY) || "{}"); } catch (e) { openMap = {}; }
  const saveOpen = () => { try { localStorage.setItem(OPEN_KEY, JSON.stringify(openMap)); } catch (e) {} };
  function wireDetails(root) {
    root.querySelectorAll("details[data-k]").forEach((d) => {
      if (d.dataset.wired) return; d.dataset.wired = "1";
      if (openMap[d.dataset.k] != null && !d.dataset.force) d.open = openMap[d.dataset.k];
      d.addEventListener("toggle", () => { openMap[d.dataset.k] = d.open; saveOpen(); });
    });
  }
  document.addEventListener("click", (e) => {
    const ex = e.target.closest("[data-expand]"), co = e.target.closest("[data-collapse]");
    if (ex || co) $((ex || co).dataset.expand || (ex || co).dataset.collapse).querySelectorAll("details").forEach((d) => (d.open = !!ex));
    const g = e.target.closest("[data-guide]"); if (g) { e.preventDefault(); openGuide(g.dataset.guide); return; }
    const a = e.target.closest("[data-goto]"); if (a) { e.preventDefault(); show(a.dataset.goto); return; }
    const k = e.target.closest("[data-toolkit]");
    if (k) { e.preventDefault(); try { if (window.parent !== window && typeof window.parent.show === "function") { window.parent.show(k.dataset.toolkit); return; } } catch (err) {} window.open((location.pathname.includes("/tools/deprx/") ? "../../index.html#" : "../hospitalist-toolkit/index.html#") + k.dataset.toolkit, "_blank", "noopener"); }
  });
  function show(t) {
    document.querySelectorAll("nav button").forEach((b) => b.classList.toggle("on", b.dataset.t === t));
    document.querySelectorAll("section.tab").forEach((s) => s.classList.toggle("on", s.id === "tab-" + t));
    if (t === "note") buildNote(false);
    window.scrollTo(0, 0);
  }
  $("nav").onclick = (e) => { const b = e.target.closest("button"); if (b && b.dataset.t) show(b.dataset.t); };

  // ---- analysis ----
  function analyze() {
    const f = state.f; if (!f) { state.r = null; return; }
    const wt = state.ov.wt != null ? state.ov.wt : f.wt, crv = state.ov.cr != null ? state.ov.cr : f.lab.cr && f.lab.cr.v;
    const lab = Object.assign({}, f.lab, crv != null ? { cr: Object.assign({}, f.lab.cr || { name: "Creatinine", u: "µmol/L" }, { v: crv }) } : {});
    f.meds.forEach((m) => { delete m.cls; delete m.acb; delete m.ind; delete m.noind; });
    state.r = R.analyze({ meds: f.meds, probs: f.probs, age: f.age, sex: f.sex, wt, lab, vit: f.vit, f: state.fx, beers: BEERS });
    state.r.wt = wt; state.r.cr = crv;
  }
  const medName = (i) => (state.f.meds[i] || {}).label || "";
  const levelOf = (list) => list.reduce((b, x) => (LV[x.level] < LV[b] ? x.level : b), "info");
  function flagHtml(x, opts) {
    const g = x.cls ? ` <a href="#" data-guide="${x.cls}">How to stop →</a>` : "";
    const meds = (opts && opts.meds) && x.meds.length ? `<div class="src">Drugs: ${esc([...new Set(x.meds.map(medName))].join("; "))}</div>` : "";
    const extra = x.beers && x.beers.length ? `<div class="src">Beers 2023 also says: ${esc([...new Set(x.beers)].join(" "))}</div>` : "";
    return `<div class="flag ${x.level}"><b>${esc(x.title)}</b> – ${esc(x.text)}${g}${meds}${extra}<div class="src">${x.data ? "Why: " + esc(x.data) + " · " : ""}Source: ${esc(x.src.join("; "))}</div></div>`;
  }
  const passes = (x) => { const s = $("rShow").value; return s === "all" || (s === "ra" && x.level !== "info") || (s === "red" && x.level === "red"); };

  // ---- render ----
  function render() {
    analyze();
    const f = state.f, r = state.r;
    ["groups", "medTable", "achbBody", "fallsBody", "kFlags", "kTable"].forEach((id) => { if (!f) $(id).innerHTML = '<span class="muted">No patient loaded.</span>'; });
    if (!f) { $("stats").innerHTML = ""; $("actNowCard").hidden = true; $("factorLine").textContent = ""; drawHow(); buildNote(true); return; }
    const fl = r.flags, red = fl.filter((x) => x.level === "red"), amb = fl.filter((x) => x.level === "amber");
    $("factorLine").textContent = [f.age != null ? `${f.age} y ${f.sex}` : "", r.wt != null ? `weight ${r.wt} kg` : "no weight", r.kLabel || "no creatinine", r.kidney.egfr != null ? `eGFR ${r.kidney.egfr}` : "",
      r.fallHx ? "fall/fracture history" : "", r.limited ? "STOPPFrail checks ON" : ""].filter(Boolean).join(" · ");
    // stats
    const noind = fl.filter((x) => x.g === "noind").length;
    $("stats").innerHTML = [[f.meds.length, `medications (${r.sched.length} scheduled)`], [red.length, "red flags", red.length ? "red" : ""], [amb.length, "amber flags", amb.length ? "amber" : ""],
      [r.acbTotal, "anticholinergic score", r.acbTotal >= 3 ? "amber" : ""], [r.frids.length, "fall-risk drugs", r.frids.length >= 3 ? "amber" : ""], [noind, "no indication found", noind ? "amber" : ""],
      [r.kidney.crcl != null ? r.kidney.crcl : r.kidney.egfr != null ? r.kidney.egfr : "–", r.kidney.crcl != null ? "CrCl (mL/min)" : "eGFR"]].map(([n, t, c]) => `<div class="stat ${c || ""}"><b>${esc(n)}</b><span>${esc(t)}</span></div>`).join("");
    // act now
    $("actNowCard").hidden = !red.length;
    $("actNow").innerHTML = red.slice(0, 4).map((x) => `<div class="flag red" style="margin:4px 0"><b>${esc(x.title)}</b> – ${esc(x.text)}${x.cls ? ` <a href="#" data-guide="${x.cls}">How to stop →</a>` : ""}</div>`).join("") + (red.length > 4 ? `<div class="muted">+ ${red.length - 4} more red flag${red.length > 5 ? "s" : ""} on the <a href="#" data-goto="review">Review</a> tab.</div>` : "");
    // groups
    if ($("rGroup").value === "med") {
      const byMed = {}; fl.forEach((x) => (x.meds.length ? x.meds : [-1]).forEach((i) => (byMed[i] = byMed[i] || []).push(x)));
      const order = Object.keys(byMed).map(Number).sort((a, b) => LV[levelOf(byMed[a])] - LV[levelOf(byMed[b])] || b - a);
      $("groups").innerHTML = order.map((i) => { const l = byMed[i].filter(passes); if (!l.length) return ""; const lv = levelOf(l);
        return `<details data-k="m-${i}" open><summary>${i < 0 ? "Whole list / missing drugs" : esc(medName(i))} <span class="cnt ${lv}">${l.length}</span></summary>${l.sort((a, b) => LV[a.level] - LV[b.level]).map((x) => flagHtml(x)).join("")}</details>`; }).join("") || '<div class="flag green">Nothing at this level.</div>';
    } else {
      const gs = R.GROUPS.map(([g, n]) => ({ g, n, l: fl.filter((x) => x.g === g && passes(x)).sort((a, b) => LV[a.level] - LV[b.level]) })).filter((x) => x.l.length);
      gs.sort((a, b) => LV[levelOf(a.l)] - LV[levelOf(b.l)]);
      $("groups").innerHTML = gs.length ? gs.map(({ g, n, l }) => { const lv = levelOf(l);
        return `<details data-k="g-${g}" ${lv !== "info" ? "open" : ""}><summary>${esc(n)} <span class="cnt ${lv}">${l.length}</span></summary>${l.map((x) => flagHtml(x, { meds: true })).join("")}${GROUP_TIP[g] || ""}</details>`; }).join("")
        : '<div class="flag green">No flags from the data found. Still check the doses, the reasons and what the patient wants.</div>';
    }
    wireDetails($("groups"));
    drawMeds(); drawAchb(); drawKidney(); drawFalls(); drawHow(); buildNote(true);
  }
  const GROUP_TIP = {
    noind: '<p class="muted">Indications are matched against the problem list (and for PPIs, co-prescribed NSAIDs/antithrombotics). Mark "Continue – indication confirmed" on the Medications tab when you know the reason.</p>',
    renal: '<p class="muted">Kidney rules use Cockcroft-Gault CrCl (DOACs, antibiotics) or eGFR (metformin, SGLT2, bisphosphonates). Change weight/creatinine on the <a href="#" data-goto="kidney">Kidney tab</a>.</p>',
    falls: '<p class="muted">Tick "fell" or add lying/standing BP on the <a href="#" data-goto="falls">Falls tab</a>. <a href="#" data-toolkit="hip">→ Hip fracture tab</a></p>',
    achb: '<p class="muted">Swaps for each drug are on the <a href="#" data-goto="achb">Anticholinergic tab</a>.</p>' };

  // ---- medications ----
  function drawMeds() {
    const f = state.f, r = state.r; if (!f) return;
    const flagsOf = (i) => r.flags.filter((x) => x.meds.includes(i));
    const frid = new Set(r.frids.map((x) => x.m.i)), sel = $("mShow").value;
    const rows = f.meds.filter((m) => {
      const fl = flagsOf(m.i);
      return sel === "all" || (sel === "flag" && fl.length) || (sel === "noind" && m.noind) || (sel === "frid" && frid.has(m.i)) || (sel === "achb" && m.acb.score) || (sel === "renal" && fl.some((x) => x.g === "renal")) || (sel === "undecided" && !(state.dec[m.i] || {}).d);
    }).sort((a, b) => { const la = flagsOf(a.i), lb = flagsOf(b.i); return (la.length ? LV[levelOf(la)] : 3) - (lb.length ? LV[levelOf(lb)] : 3); });
    $("medTable").innerHTML = rows.length ? `<table><tr><th>Medication</th><th>Group</th><th>ACB</th><th>Indication</th><th>Flags</th><th class="noprint">Decision</th></tr>${rows.map((m) => {
      const fl = flagsOf(m.i).sort((a, b) => LV[a.level] - LV[b.level]), lv = fl.length ? levelOf(fl) : "";
      const guide = (m.cls || []).map((k) => R.GUIDE_OF[k]).find(Boolean);
      const ind = m.noind ? '<span class="pill amber">✗ none found</span>' : m.ind && m.ind.length ? `<span class="pill green" title="${esc(m.ind.join("; "))}">✓ ${esc(m.ind[0].split("|")[0].slice(0, 40))}</span>` : '<span class="muted">–</span>';
      const d = state.dec[m.i] || {};
      return `<tr class="${lv === "red" ? "redrow" : lv ? "flagged" : ""}"><td><b>${esc(m.label)}</b>${m.prn ? ' <span class="pill">PRN</span>' : ""}<div class="muted">${esc(m.sig)}</div></td>
        <td>${(m.cls || []).filter((k) => R.CL[k]).slice(0, 2).map((k) => `<span class="pill">${esc(R.CL[k].n)}</span>`).join("")}</td>
        <td>${m.acb.score ? `<b>${m.acb.score}</b>` : ""}</td><td>${ind}</td>
        <td>${fl.map((x) => `<span class="pill ${x.level}" title="${esc(x.text)}">${esc(x.title.replace(/: .*$/, "").slice(0, 48))}</span>`).join("") || '<span class="muted">none</span>'}${guide ? `<div><a href="#" data-guide="${guide}">How to stop →</a></div>` : ""}</td>
        <td class="noprint"><select data-dec="${m.i}">${DECISIONS.map((o) => `<option${o === (d.d || "") ? " selected" : ""} value="${esc(o)}">${o || "–"}</option>`).join("")}</select>
          <input data-dose="${m.i}" placeholder="new dose / taper / note" value="${esc(d.dose || "")}" style="width:180px;margin-top:4px;display:${/Reduce|Taper|Switch|Hold/.test(d.d || "") ? "block" : "none"}"></td></tr>`; }).join("")}</table>`
      : '<span class="muted">No medications match.</span>';
  }
  $("mShow").onchange = drawMeds;
  $("medTable").addEventListener("change", (e) => {
    const s = e.target.closest("[data-dec]"); if (s) { const i = +s.dataset.dec; state.dec[i] = Object.assign(state.dec[i] || {}, { d: s.value }); saveDec(); const inp = document.querySelector(`[data-dose="${i}"]`); if (inp) inp.style.display = /Reduce|Taper|Switch|Hold/.test(s.value) ? "block" : "none"; buildNote(true); }
  });
  $("medTable").addEventListener("input", (e) => { const s = e.target.closest("[data-dose]"); if (s) { const i = +s.dataset.dose; state.dec[i] = Object.assign(state.dec[i] || {}, { dose: s.value }); saveDec(); buildNote(true); } });
  $("mAllCont").onclick = () => { if (!state.f) return; state.f.meds.forEach((m) => { if (!state.r.flags.some((x) => x.meds.includes(m.i)) && !(state.dec[m.i] || {}).d) state.dec[m.i] = { d: "Continue" }; }); saveDec(); drawMeds(); buildNote(true); };
  const decKey = () => "deprx-dec:" + state.pid;
  function saveDec() { try { sessionStorage.setItem(decKey(), JSON.stringify(state.dec)); } catch (e) {} }
  function loadDec() { try { state.dec = JSON.parse(sessionStorage.getItem(decKey()) || "{}") || {}; } catch (e) { state.dec = {}; } }

  // ---- anticholinergic ----
  function drawAchb() {
    const r = state.r; if (!r) return;
    const list = r.achbMeds.slice().sort((a, b) => b.acb.score - a.acb.score), t = r.acbTotal;
    const lv = t >= 3 ? (r.why.dementia || r.why.delirium ? "red" : "amber") : t > 0 ? "info" : "green";
    $("achbBody").innerHTML = `<div class="flag ${lv}"><span class="score">${t}</span> total ACB score${t >= 3 ? " – clinically relevant (≥3): confusion, delirium, falls, constipation, retention." : t ? " – below 3, but check whether each drug is needed." : " – no anticholinergic drugs found."}${r.why.dementia || r.why.delirium ? ` <b>${esc(r.why.dementia || r.why.delirium)}</b> on the problem list.` : ""}</div>
      ${list.length ? `<table><tr><th>Medication</th><th>ACB</th><th>Lower-burden option</th></tr>${list.map((m) => `<tr><td>${esc(m.label)}${m.prn ? ' <span class="pill">PRN</span>' : ""}</td><td><b>${m.acb.score}</b></td><td>${esc(R.ACB_ALT[m.acb.name] || (m.acb.score === 1 ? "Low score: keep if needed" : "Review need"))}</td></tr>`).join("")}</table>` : ""}`;
  }

  // ---- kidney ----
  function drawKidney() {
    const f = state.f, r = state.r; if (!f) return;
    if (document.activeElement && /^k(Age|Wt|Cr)$/.test(document.activeElement.id)) { /* keep typing */ } else {
      $("kAge").value = f.age != null ? f.age : ""; $("kSex").value = f.sex === "male" ? "male" : "female"; $("kWt").value = r.wt != null ? r.wt : ""; $("kCr").value = r.cr != null ? r.cr : "";
    }
    const k = r.kidney, crT = f.lab.cr ? ` (chart ${f.lab.cr.v} on ${fmtD(f.lab.cr.t)})` : "";
    $("kOut").innerHTML = `<div class="flag ${k.crcl != null && k.crcl < 30 ? "red" : k.crcl != null && k.crcl < 60 ? "amber" : "info"}">${k.crcl != null ? `<span class="score">${k.crcl}</span> mL/min CrCl (Cockcroft-Gault)` : "CrCl needs age, weight and creatinine."}
      ${k.egfr != null ? ` · eGFR <b>${k.egfr}</b>${f.lab.egfr ? ` (${fmtD(f.lab.egfr.t)})` : ""}` : ""}<div class="muted">${r.wt == null ? "No weight in the chart (30 days): enter one. " : ""}${esc(crT)}</div></div>`;
    const rf = r.flags.filter((x) => x.g === "renal");
    $("kFlags").innerHTML = rf.length ? rf.map((x) => flagHtml(x)).join("") : '<div class="flag green">No kidney-dose flags for this list at this kidney function.</div>';
    const RENAL = ["metformin", "sitagliptin", "saxagliptin", "alogliptin", "glyburide", "gliclazide", "glimepiride", "dabigatran", "rivaroxaban", "apixaban", "edoxaban", "enoxaparin", "dalteparin", "tinzaparin", "fondaparinux", "gabapentin", "pregabalin", "spironolactone", "eplerenone", "amiloride", "triamterene",
      "nitrofurantoin", "sulfamethoxazole", "ciprofloxacin", "levofloxacin", "digoxin", "colchicine", "allopurinol", "morphine", "codeine", "tramadol", "baclofen", "levetiracetam", "famotidine", "ranitidine", "lithium", "alendronate", "risedronate", "zoledronic", "methotrexate", "duloxetine", "empagliflozin", "dapagliflozin", "canagliflozin", "ibuprofen", "naproxen", "diclofenac", "celecoxib", "meloxicam", "ketorolac", "valacyclovir", "acyclovir", "oseltamivir"];
    const rows = f.meds.filter((m) => RENAL.some((n) => R.has(m.hay, n)));
    $("kTable").innerHTML = rows.length ? `<table><tr><th>Medication</th><th>Flag at this kidney function</th></tr>${rows.map((m) => { const l = rf.filter((x) => x.meds.includes(m.i)); return `<tr><td>${esc(m.label)}<div class="muted">${esc(m.sig)}</div></td><td>${l.map((x) => `<span class="pill ${x.level}">${esc(x.title)}</span> ${esc(x.text)}`).join("<br>") || '<span class="pill green">no change needed</span>'}</td></tr>`; }).join("")}</table>` : '<span class="muted">None of the medications on this list are in the kidney-check list.</span>';
  }
  const num = (id) => ($(id).value === "" ? null : +$(id).value);
  ["kWt", "kCr"].forEach((id) => ($(id).oninput = () => { state.ov.wt = num("kWt"); state.ov.cr = num("kCr"); clearTimeout(drawKidney.t); drawKidney.t = setTimeout(render, 350); }));
  $("kAge").oninput = () => { if (state.f && num("kAge") != null) { state.f.age = num("kAge"); clearTimeout(drawKidney.t); drawKidney.t = setTimeout(render, 350); } };
  $("kSex").onchange = () => { if (state.f) { state.f.sex = $("kSex").value; render(); } };
  $("kReset").onclick = () => { if (!state.f) return; state.ov = {}; state.f.age = state.f.age0; state.f.sex = state.f.sex0; render(); };

  // ---- falls ----
  function drawFalls() {
    const r = state.r; if (!r) return;
    const ff = r.flags.filter((x) => x.g === "falls");
    $("fallsBody").innerHTML = (r.fallHx ? `<div class="flag amber">Fall or fracture history${state.fx.falls ? " (ticked)" : ""}: every fall-risk drug below is a target.</div>` : '<div class="flag info">No fall on the problem list. Tick the box if they fell.</div>')
      + (r.frids.length ? `<table><tr><th>Fall-risk drug</th><th>Class</th><th>What to do</th></tr>${r.frids.map(({ m, n, k }) => { const x = ff.find((y) => y.meds.includes(m.i) && y.meds.length === 1); return `<tr><td>${esc(m.label)}${m.prn ? ' <span class="pill">PRN</span>' : ""}</td><td>${esc(n)}</td><td>${esc(x ? x.text : "Reduce or stop if possible.")} ${R.GUIDE_OF[k] ? `<a href="#" data-guide="${R.GUIDE_OF[k]}">How to stop →</a>` : ""}</td></tr>`; }).join("")}</table>` : '<div class="flag green">No STOPPFall drugs on the list.</div>')
      + ff.filter((x) => !r.frids.some((y) => x.meds.length === 1 && x.meds[0] === y.m.i)).map((x) => flagHtml(x)).join("");
  }
  function syncFalls(v) { state.fx.falls = v; $("fFalls").checked = v; $("fFalls2").checked = v; render(); }
  $("fFalls").onchange = () => syncFalls($("fFalls").checked); $("fFalls2").onchange = () => syncFalls($("fFalls2").checked);
  function ortho() { const l = num("oLie"), s = num("oStand"); state.fx.orthoDrop = l != null && s != null ? l - s : null; $("oOut").innerHTML = state.fx.orthoDrop == null ? "" : state.fx.orthoDrop >= 20 ? `<b style="color:var(--red)">Drop ${state.fx.orthoDrop}: orthostatic hypotension</b>` : `Drop ${state.fx.orthoDrop}: not orthostatic`; render(); }
  $("oLie").onchange = ortho; $("oStand").onchange = ortho;
  $("fCfs").onchange = () => { state.fx.cfs = $("fCfs").value === "" ? null : +$("fCfs").value; render(); };
  $("fGoals").onchange = () => { state.fx.goals = $("fGoals").value; render(); };
  $("rShow").onchange = render; $("rGroup").onchange = render;

  // ---- how to stop ----
  Object.entries(K.G).forEach(([k, g]) => { const o = document.createElement("option"); o.value = k; o.textContent = g.t; $("hSel").appendChild(o); });
  const mine = () => { const s = new Set(); if (state.f) state.f.meds.forEach((m) => (m.cls || []).forEach((k) => R.GUIDE_OF[k] && s.add(R.GUIDE_OF[k]))); if (state.r) state.r.flags.forEach((x) => x.cls && s.add(x.cls)); return s; };
  function drawHow() {
    const sel = $("hSel").value, my = mine();
    const keys = sel ? [sel] : my.size ? [...my].filter((k) => K.G[k]) : Object.keys(K.G);
    const medsFor = (k) => (state.f ? state.f.meds.filter((m) => (m.cls || []).some((c) => R.GUIDE_OF[c] === k)).map((m) => m.label) : []);
    $("howBody").innerHTML = (!sel && !my.size ? '<p class="muted">No patient loaded: showing all guides. Pick one from the list above.</p>' : "")
      + keys.map((k) => { const g = K.G[k], on = medsFor(k);
        return `<details data-k="h-${k}" id="guide-${k}" ${sel || on.length ? "open" : ""}><summary>${esc(g.t)}${on.length ? ` <span class="pill amber">${esc(on.join(", ").slice(0, 80))}</span>` : ""}</summary>
          <p><b>Consider stopping when:</b> ${g.when}</p><p><b>How:</b> ${g.how}</p><p><b>Watch for:</b> ${g.watch}</p><p class="muted">${g.link}</p></details>`; }).join("")
      + (!sel && my.size ? '<p class="muted">Only this patient\'s drug groups are shown. Pick another group from the list above.</p>' : "")
      + '<p class="muted">UNVERIFIED draft: confirm with the linked algorithm, the ward pharmacist, and the patient.</p>';
  }
  $("hSel").onchange = drawHow;
  function openGuide(k) { show("howto"); if (!mine().has(k)) $("hSel").value = k; drawHow(); const d = $("guide-" + k); if (d) { d.open = true; d.scrollIntoView({ block: "start" }); } }

  // ---- note ----
  let noteEdited = false; $("noteText").oninput = () => (noteEdited = true);
  function buildNote(force) {
    if (noteEdited && !force) return;
    const f = state.f, r = state.r;
    if (!f) { $("noteText").value = ""; return; }
    const changes = [], keep = [], decided = new Set();
    f.meds.forEach((m) => {
      const d = state.dec[m.i]; if (!d || !d.d) return; decided.add(m.i);
      const why = r.flags.filter((x) => x.meds.includes(m.i)).sort((a, b) => LV[a.level] - LV[b.level])[0];
      const reason = why ? ` – ${why.title.replace(/: .*$/, "")}${why.data ? ` (${why.data})` : ""}` : "";
      const line = `${m.label}${m.sig ? " " + m.sig : ""}`;
      if (/^Continue/.test(d.d)) keep.push(`${line}${d.d.includes("indication") ? " (indication confirmed)" : ""}`);
      else changes.push(`${d.d.toUpperCase()}: ${line}${d.dose ? ` → ${d.dose}` : ""}${reason}`);
    });
    const open = $("nFlags").checked ? r.flags.filter((x) => x.level !== "info" && !(x.meds.length && x.meds.every((i) => decided.has(i)))).sort((a, b) => LV[a.level] - LV[b.level]).map((x) => `[${x.level}] ${x.title}${x.meds.length && !/: /.test(x.title) ? ` (${[...new Set(x.meds.map(medName))].join(", ")})` : ""}`) : [];
    const goals = { active: "Goals: active treatment", limited: "Limited life expectancy", palliative: "Palliative/comfort goals" }[state.fx.goals] || "";
    $("noteText").value = R.note({ date: new Date().toLocaleDateString("en-CA"), pt: `${f.age != null ? f.age + " y " : ""}${f.sex || ""}`.trim(), kidney: [r.kidney.crcl != null ? `CrCl ${r.kidney.crcl} mL/min (CG, wt ${r.wt} kg, Cr ${r.cr})` : "", r.kidney.egfr != null ? `eGFR ${r.kidney.egfr}` : ""].filter(Boolean).join(", "),
      cfs: state.fx.cfs, goals, nMeds: f.meds.length, nSched: r.sched.length, nPrn: f.meds.length - r.sched.length, acb: r.acbTotal, frid: r.frids.length ? `${r.frids.length} (${r.frids.map((x) => x.m.label.split(" ")[0]).join(", ")})` : "",
      changes, keep, flags: open, decision: $("noteDecision").value.trim(), discussed: $("nWho").value });
    noteEdited = false;
  }
  ["nWho", "nFlags", "noteDecision"].forEach((id) => { $(id).oninput = () => buildNote(true); $(id).onchange = () => buildNote(true); });
  $("noteRebuild").onclick = () => buildNote(true);
  $("noteCopy").onclick = () => { $("noteText").select(); try { navigator.clipboard.writeText($("noteText").value); } catch (e) { document.execCommand("copy"); } $("noteCopy").textContent = "Copied"; setTimeout(() => ($("noteCopy").textContent = "Copy"), 1200); };

  // ---- loading ----
  function load(raw, msg, errors, factors, pid) {
    state.f = raw ? C.parse(raw, { alias: BEERS && BEERS.ALIAS }) : null;
    state.ov = {}; state.fx = Object.assign({ falls: false, cfs: null, goals: "", orthoDrop: null }, factors || {}); state.pid = pid || "";
    loadDec();
    if (state.f) { state.f.age0 = state.f.age; state.f.sex0 = state.f.sex; }
    $("fCfs").value = state.fx.cfs != null ? String(state.fx.cfs) : ""; $("fGoals").value = state.fx.goals || ""; $("fFalls").checked = $("fFalls2").checked = !!state.fx.falls; $("oLie").value = $("oStand").value = ""; $("oOut").textContent = "";
    $("ptLine").textContent = state.f ? [state.f.name, state.f.age != null ? state.f.age + " y" : "", state.f.sex].filter(Boolean).join(" · ") : "";
    $("pstatus").textContent = msg;
    $("errs").textContent = errors && errors.length ? "Could not read: " + errors.join("; ") + (errors.some((e) => /\b40[13]\b|Unauthorized|Forbidden/i.test(e)) ? ". Check the scopes in the Code Console." : ". Cerner's sandbox can be slow: reload to try again.") : "";
    noteEdited = false; render();
  }
  const SAMPLES = window.DEPRX_SAMPLES || [];
  SAMPLES.forEach((p, i) => { const o = document.createElement("option"); o.value = i; o.textContent = p.label; $("testsel").appendChild(o); });
  $("testsel").onchange = () => { const p = SAMPLES[$("testsel").value]; if (!p) return load(null, "Open from Cerner to read the chart, or pick a made-up patient:"); load(p.build(Date.now()), "Made-up patient: " + p.label, [], p.factors, "demo" + $("testsel").value); };
  async function fromChart() {
    if (typeof FHIR === "undefined" || !(location.search.includes("code=") || location.search.includes("complete=") || sessionStorage.getItem("SMART_KEY"))) return false;
    $("pstatus").textContent = "Reading the chart…";
    try { const client = await FHIR.oauth2.ready(); const { raw, errors } = await C.gather(client, (m) => ($("pstatus").textContent = m)); load(raw, "Chart read (read-only). Nothing is sent anywhere.", errors, {}, client.patient.id); return true; }
    catch (e) { $("pstatus").textContent = "Could not read the chart: " + (e && e.message ? e.message : e) + ". The made-up patients still work."; return false; }
  }
  if (!BEERS) $("errs").textContent = "Beers data (../meds/beers-data.js) did not load: Beers checks are off.";
  wireDetails(document); render();
  const q = new URLSearchParams(location.search), demo = q.get("demo");
  if (q.get("tab") && $("tab-" + q.get("tab"))) show(q.get("tab"));
  fromChart().then((ok) => { if (!ok && demo && SAMPLES[+demo - 1]) { $("testsel").value = +demo - 1; $("testsel").onchange(); } });
})();
