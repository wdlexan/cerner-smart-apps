/* Hypernatremia card for the Sodium tab. Loaded after app.js and extras.js; wraps draw() so it redraws with everything else.
   Uses the tab's own inputs (weight, volume status, symptoms, onset, the cause-helper boxes) and chart. UNVERIFIED draft. */
(function () {
  const H = window.HyperRules, C = window.HypoChart, DAY = C.DAY, HR = 36e5;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const num = (id) => { const v = parseFloat(($(id) || {}).value); return isFinite(v) ? v : null; };
  const SEVCLS = ["t0", "t1", "t2", "t3"];

  /* reference content (always available) */
  const REF = [
    ["Grading used here", "Mild 146–149 · moderate 150–159 · severe ≥ 160 mmol/L. Symptoms raise the urgency at any level. Acute = known to have risen within 48 h."],
    ["Symptoms", "Thirst (often absent in the elderly), lethargy, weakness, irritability, confusion, delirium, hyperreflexia, myoclonus, seizures, coma. Acute severe rises can shrink the brain and tear bridging veins (subdural / intracerebral bleeding). Also rhabdomyolysis, and polyuria in DI."],
    ["Water loss: GI and skin", "Vomiting, diarrhea (lactulose, osmotic laxatives), NG or fistula losses, fever, sweating, burns, tachypnea. Urine is concentrated (osmolality > 600), urine Na low."],
    ["Water loss: kidney", "Osmotic diuresis (glucose in HHS/DKA, urea from high-protein feeds or recovering AKI, mannitol, SGLT2 inhibitors), loop diuretics, post-obstructive or recovering ATN diuresis. Urine osmolality 300–600."],
    ["Diabetes insipidus", "Central: pituitary surgery, head injury, tumour, infiltration, idiopathic. Nephrogenic: lithium, high calcium, low potassium, demeclocycline, foscarnet, amphotericin, cidofovir, ifosfamide, tolvaptan (aquaresis), kidney disease. Urine osmolality < 300 with polyuria."],
    ["Not enough water in", "Impaired thirst or no access to water: dementia, stroke, delirium, sedation, intubation, frailty, tube feeds without free water flushes. The commonest inpatient cause in older adults."],
    ["Sodium gain", "Hypertonic saline, sodium bicarbonate, large volumes of 0.9% saline, salt tablets, salt-rich tube feeds, primary hyperaldosteronism (mild). Urine Na often > 100, patient may be overloaded."],
    ["Tests", "Serum Na, glucose, urea, creatinine, K, Ca; serum osmolality; urine osmolality and Na (spot); hourly urine output / 24-h volume; volume status; CK if severe. If DI suspected: desmopressin response (urine osmolality 1–2 h after 1–2 mcg); lithium level; MRI pituitary if central."],
    ["Treatment principles", "1) Restore circulation with isotonic fluid if in shock. 2) Replace free water (enteral water or D5W) for the deficit plus ongoing losses. 3) Chronic: lower Na ≤ 10 mmol/L in 24 h; acute: about 1 mmol/L/h. 4) Treat the cause: stop drugs, desmopressin for central DI, thiazide + amiloride for nephrogenic DI, loop diuretic + water for sodium overload. 5) Recheck often and adjust to the sodium, not the formula."],
    ["Free water deficit", "TBW × (Na/140 − 1). TBW = weight × 0.6 (men) / 0.5 (women); 0.5 / 0.45 if 65 or older. 1 L of D5W lowers Na by about Na ÷ (TBW + 1) (Adrogue-Madias); 0.45% saline by about half that. Formulas ignore urine and insensible losses (≈ 1 L/day)."]];
  const SOURCES = 'Adrogue HJ, Madias NE. Hypernatremia. N Engl J Med 2000;342:1493–9. Chauhan K, et al. Rate of correction of hypernatremia and health outcomes in critically ill patients. Clin J Am Soc Nephrol 2019;14:656–63 (faster correction not associated with harm in adults). Muhsin SA, Mount DB. Diagnosis and treatment of hypernatremia. Best Pract Res Clin Endocrinol Metab 2016;30:189–203. Unverified summary: follow Island Health protocols.';

  /* insert the card after the tiles */
  const css = document.createElement("style");
  css.textContent = `body.is-hyper .hypo-only { display:none; } .hx-banner { background:var(--a-bg); color:var(--a-ink); border-radius:8px; padding:8px 12px; margin:0 0 8px; }
    #sec-hyper table td:first-child { font-weight:600; width:24%; vertical-align:top; } #sec-hyper table.hx-calc td:first-child { width:18%; } #sec-hyper table.hx-calc th { text-align:left; color:var(--muted); font-weight:600; } .hx-tier { display:inline-block; min-width:44px; font-size:11px; font-weight:700; text-transform:uppercase; border-radius:4px; padding:0 5px; margin-right:6px; text-align:center; }
    .hx-tier.now { background:var(--r-bg); color:var(--r-ink); } .hx-tier.next { background:var(--a-bg); color:var(--a-ink); } .hx-tier.also { background:var(--b-bg); color:var(--b-ink); }
    #sec-hyper ul { margin:4px 0 8px 18px; padding:0; } #sec-hyper li { margin:4px 0; } #sec-hyper h3 { font-size:14px; margin:12px 0 4px; }`;
  document.head.appendChild(css);
  const card = document.createElement("details");
  card.className = "card"; card.id = "sec-hyper";
  card.innerHTML = `<summary><span>Hypernatremia (high sodium)</span><span class="muted" id="hx-sum"></span></summary><div class="body">
    <div id="hx-out"></div>
    <details style="margin-top:8px" id="hx-refbox"><summary class="muted" style="cursor:pointer;font-weight:600">Reference: symptoms, causes, tests and treatment</summary>
      <table>${REF.map((r) => `<tr><td>${esc(r[0])}</td><td>${esc(r[1])}</td></tr>`).join("")}</table></details>
    <div class="src">${esc(SOURCES)}</div>
    <h3 class="noprint">Note draft</h3><div id="hx-note" class="noprint"></div></div>`;
  $("tiles").insertAdjacentElement("afterend", card);

  /* mark the low-sodium-only cards so they step aside when Na is high */
  document.querySelectorAll("details.card").forEach((d) => {
    const s = (d.querySelector("summary") || {}).textContent || "";
    if (/^(Alerts|Treatment plan|Cause workup|Fluid calculator|Sodium trend and safe ceiling)/.test(s.trim()) || d.id === "sec-note") d.classList.add("hypo-only");
  });
  $("tiles").classList.add("hypo-only"); if ($("m-out")) $("m-out").classList.add("hypo-only");

  function current() {
    const st = typeof state !== "undefined" ? state : {}, f = st.f, now = Date.now(), typedNa = num("m-na");
    const naE = f && f.na.length ? f.na[f.na.length - 1] : null;
    const x = { na: typedNa != null ? typedNa : naE ? naE.v : null, naT: typedNa != null ? null : naE && naE.t };
    const L = (id, d) => (f ? C.latest(f.s[id], d * DAY, now) : null), U = (id, d) => (f ? C.latest(f.u[id], d * DAY, now) : null);
    const pick = (id, chart) => { const t = num(id); return t != null ? t : chart ? Math.round(chart.v * 10) / 10 : null; };
    x.glu = pick("m-glu", L("glu", 1)); x.uosm = pick("m-uosm", U("uosm", 7)); x.una = pick("m-una", U("una", 7)); x.k = L("k", 2) ? L("k", 2).v : null;
    x.wt = num("wt"); x.age = f ? f.age : null; x.sex = f ? f.sex : ""; x.water = H.tbw(x.wt, x.age, x.sex);
    x.volume = $("volume").value; x.symptoms = $("symptoms").value;
    // acute if the onset box says so, or Na rose ≥ 10 within 48 h from a normal value
    let autoAcute = false;
    if (f && naE) { const prior = f.na.filter((e) => e.t < naE.t && naE.t - e.t <= 2 * DAY && e.v <= 145); autoAcute = prior.length > 0 && naE.v - Math.min(...prior.map((e) => e.v)) >= 10; }
    x.acute = $("onset").value === "acute" || ($("onset").value === "auto" && autoAcute);
    if (f) { const uo = f.uo.filter((e) => now - e.t <= DAY); x.uoMlH = uo.length >= 3 ? uo.reduce((s, e) => s + e.v, 0) / Math.max(1, (now - uo[0].t) / HR + 1) : null; }
    x.medNames = f ? f.meds.filter((m) => m.active || (m.t && now - m.t <= 3 * DAY)).map((m) => m.name) : [];
    x.meds = H.meds(x.medNames);
    x.cause = H.cause(x);
    x.g = H.grade(x.na, x.symptoms);
    x.pl = H.plan(x.na, x.water, x.acute, null);
    return x;
  }

  let last = null;
  function drawHyper() {
    const x = current(); last = x;
    const high = x.g && x.g.sev > 0;
    document.body.classList.toggle("is-hyper", !!high);
    card.open = !!high || card.dataset.userOpen === "1";
    if (!high) {
      $("hx-sum").textContent = x.na != null ? "sodium " + x.na + ": not high" : "";
      $("hx-out").innerHTML = '<div class="muted">Sodium is not above 145. Open the reference below for causes and treatment of high sodium.</div>';
      NOTE.update(); return;
    }
    if ($("msum")) $("msum").textContent = "Sodium high: see the Hypernatremia card";
    const f = (typeof state !== "undefined" && state.f) || null, trend = f ? f.na.filter((e) => Date.now() - e.t <= 7 * DAY).slice(-8).reverse() : [];
    const trendHtml = trend.length ? `<h3>Sodium, last 7 days</h3><table>${trend.map((e, i) => { const prev = trend[i + 1], d = prev ? Math.round((e.v - prev.v) * 10) / 10 : null, h = prev ? Math.round((e.t - prev.t) / HR) : null;
      return `<tr><td>${esc(new Date(e.t).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }))}</td><td><b>${esc(e.v)}</b>${e.src === "gas" ? " (gas)" : ""}</td><td class="muted">${d != null ? (d > 0 ? "+" : "") + d + " in " + h + " h" + (h ? " (" + (Math.round(d / h * 100) / 100) + "/h)" : "") : ""}</td></tr>`; }).join("")}</table>
      <div class="muted">While lowering: aim about −${x.acute ? "1" : "0.5"} mmol/L/h; slow or stop free water if it falls faster.</div>` : "";
    $("hx-sum").innerHTML = `<span class="chip" style="background:var(--${["g", "b", "a", "r"][x.g.sev]}-bg);color:var(--${["g", "b", "a", "r"][x.g.sev]}-ink);padding:1px 9px;border-radius:10px;font-weight:700">${esc(x.g.label)} · Na ${esc(x.na)}</span>`;
    const def = H.deficit(x.na, x.water), tiles = [
      ["Sodium", x.na, x.g.label + (x.acute ? " · acute (< 48 h)" : " · chronic or unknown"), SEVCLS[x.g.sev]],
      ["Free water deficit", def != null ? def + " L" : "–", x.water ? "TBW " + x.water + " L" : "enter weight", "t1"],
      ["Aim in 24 h", x.pl ? "−" + x.pl.drop24 : "–", x.pl ? "to about " + x.pl.target24 + " (≈ " + x.pl.perHour + " mmol/L/h)" : "", "t1"],
      ["D5W rate (start)", x.pl && x.pl.rate != null ? x.pl.rate + " mL/h" : "–", x.pl && x.pl.perL ? "1 L lowers Na ≈ " + -x.pl.perL : "enter weight", "t2"]];
    const tiers = { now: "Now", next: "Next", also: "Also" };
    const med = Object.keys(x.meds).filter((k) => x.meds[k].length && H.MEDLABEL[k]).map((k) => `<li>${esc(H.MEDLABEL[k])}: ${esc(x.meds[k].join("; "))}</li>`);
    $("hx-out").innerHTML = `<div class="hx-banner">Sodium is high: the low-sodium plan, alerts and note are hidden. This card has the plan for high sodium.</div>
      <div class="tiles">${tiles.map((t) => `<div class="tile ${t[3]}"><div class="k">${esc(t[0])}</div><div class="big">${esc(t[1])}</div><div class="s">${esc(t[2])}</div></div>`).join("")}</div>
      <h3>Likely cause</h3><ul>${x.cause.likely.map((l) => `<li>${esc(l)}</li>`).join("") || "<li class='muted'>Not enough information yet.</li>"}</ul>
      ${x.cause.steps.length ? `<div class="muted">${x.cause.steps.map(esc).join(" ")}</div>` : ""}
      ${med.length ? `<h3>Medications that can raise sodium</h3><ul>${med.join("")}</ul>` : ""}
      <h3>Treatment</h3><ul>${H.treatment(x).map((t) => `<li><span class="hx-tier ${t.tier}">${tiers[t.tier]}</span>${esc(t.text)}</li>`).join("")}</ul>
      <h3>How it was calculated</h3><table class="hx-calc"><tr><th>Step</th><th>Formula</th><th>This patient</th></tr>${H.explain(x).map((r) => `<tr><td>${esc(r.step)}</td><td>${esc(r.formula)}</td><td><b>${esc(r.calc)}</b></td></tr>`).join("")}</table>
      <div class="muted">Formulas ignore ongoing losses (fever, diarrhea, dilute urine) and can be off with obesity or edema; 0.45% saline lowers Na about half as much per litre as D5W. Recheck sodium and adjust to the result.</div>
      ${trendHtml}
      <h3>When to repeat labs</h3><table>${H.recheck(x).map((r) => `<tr><td>${esc(r.when)}</td><td>${esc(r.what)}</td></tr>`).join("")}</table>
      <div class="src">Uses weight, volume status, symptoms and onset from the top of the page, and the urine values from the cause helper (typed or chart). Doses and rates are starting points: recheck sodium and adjust.</div>`;
    NOTE.update();
  }
  card.addEventListener("toggle", () => { if (!document.body.classList.contains("is-hyper")) card.dataset.userOpen = card.open ? "1" : ""; });

  const NOTE = window.NoteDraft.mount($("hx-note"), { title: "Hypernatremia",
    sections: [{ id: "assess", label: "Assessment" }, { id: "data", label: "Data" }, { id: "cause", label: "Likely cause" }, { id: "plan", label: "Plan" }],
    build: (full) => {
      const x = last; if (!x || !x.g || !x.g.sev) return null;
      const t = H.treatment(x).filter((i) => full || i.tier === "now").map((i) => i.text);
      H.recheck(x).slice(0, full ? 9 : 1).forEach((r) => t.push("Repeat labs: " + r.when + ": " + r.what));
      return { stamp: x.naT, heading: "HYPERNATREMIA",
        sections: { assess: [x.g.label.charAt(0).toUpperCase() + x.g.label.slice(1) + " hypernatremia, Na " + x.na + (x.acute ? " (acute)" : " (chronic / unknown onset)") + (x.volume ? ", volume " + ({ hypo: "low", eu: "normal", hyper: "high" })[x.volume] : "") + "."],
          data: [["Na " + x.na, x.glu != null ? "glucose " + x.glu : "", x.uosm != null ? "urine osm " + x.uosm : "", x.una != null ? "urine Na " + x.una : "", x.water ? "TBW " + x.water + " L" : "", H.deficit(x.na, x.water) != null ? "free water deficit " + H.deficit(x.na, x.water) + " L" : ""].filter(Boolean).join(", ")],
          cause: x.cause.likely, plan: t } };
    } });

  const orig = window.draw;
  window.draw = function () { orig.apply(this, arguments); drawHyper(); };
  drawHyper();
  window.drawHyper = drawHyper;
})();
