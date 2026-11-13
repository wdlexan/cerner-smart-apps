/* Hospitalist: acute severe ulcerative colitis (ASUC). UNVERIFIED draft written by Claude from content the user supplied (12 Nov 2026)
   plus the Ho index (Ho et al., Aliment Pharmacol Ther 2004;19:1079) and Oxford/Travis criteria as tabulated in published reviews.
   Pure scoring functions (node-testable) + a self-rendering card that needs only an element with id "asuc". */
(function (root) {
  /* Truelove-Witts severe: >=6 bloody stools/day AND at least one systemic sign */
  function truelove(x) {
    const sys = [];
    if (x.hr > 90) sys.push("HR > 90");
    if (x.temp > 37.8) sys.push("Temp > 37.8 °C");
    if (x.hgb != null && x.hgb < 105) sys.push("Hb < 105 g/L");
    if (x.esr > 30) sys.push("ESR > 30");
    if (x.stools == null) return { known: false, severe: false, sys };
    return { known: true, severe: x.stools >= 6 && sys.length > 0, sys };
  }
  /* Oxford (Travis) day 3: >8 stools, or 3-8 stools with CRP > 45 mg/L */
  function oxford(stools, crp) {
    if (stools == null) return { known: false };
    const non = stools > 8 || (stools >= 3 && stools <= 8 && crp > 45);
    return { known: crp != null || stools > 8, nonResponse: non };
  }
  /* Ho index: mean stools/day over first 3 days (<4:0, 4-6:1, >6-9:2, >9:4) + colonic dilatation >5.5 cm (4) + albumin <30 g/L on admission (1).
     Failure of IV steroids: 0-1 = 11%, 2-3 = 43%, >=4 = 85%. */
  function ho(meanStools, dilated, alb) {
    if (meanStools == null) return null;
    const s = meanStools < 4 ? 0 : meanStools <= 6 ? 1 : meanStools <= 9 ? 2 : 4;
    const score = s + (dilated ? 4 : 0) + (alb != null && alb < 30 ? 1 : 0);
    const risk = score <= 1 ? ["Low", "11%"] : score <= 3 ? ["Intermediate", "43%"] : ["High", "85%"];
    return { score, stoolPts: s, band: risk[0], failure: risk[1] };
  }

  /* Chart suggestions from the IBD facts object (IBDChart.parseChart): f.vitals rows {t, hr, temp}, f.labs.{hgb,esr,crp,alb} [{t, v}] sorted by time.
     HR and temp: the highest value in the 24 h up to the latest reading (Truelove-Witts asks for any sign).
     Hb, ESR, CRP: the latest value. Albumin "on admission": the earliest value in the 14 days before the latest albumin.
     Each has its time so the card can show how old it is. Stool counts and colonic dilatation are never in the chart here. */
  function suggest(f) {
    const out = { hr: null, temp: null, hgb: null, esr: null, crp: null, alb: null };
    if (!f) return out;
    const D = 864e5, rows = (f.vitals || []).filter((r) => r && r.t != null);
    ["hr", "temp"].forEach((k) => {
      const have = rows.filter((r) => typeof r[k] === "number"); if (!have.length) return;
      const last = Math.max(...have.map((r) => r.t));
      have.filter((r) => r.t >= last - D).forEach((r) => { if (!out[k] || r[k] > out[k].v) out[k] = { v: r[k], t: r.t }; });
    });
    const nums = (k) => ((f.labs || {})[k] || []).filter((e) => e && typeof e.v === "number" && e.t != null).sort((a, b) => a.t - b.t);
    ["hgb", "esr", "crp"].forEach((k) => { const a = nums(k); if (a.length) out[k] = { v: a[a.length - 1].v, t: a[a.length - 1].t }; });
    const al = nums("alb");
    if (al.length) { const last = al[al.length - 1].t, first = al.find((e) => e.t >= last - 14 * D); out.alb = { v: first.v, t: first.t }; }
    return out;
  }

  const CHECK = [
    ["Admission", [
      "Send C. difficile testing on everyone.",
      "Limited flexible sigmoidoscopy with biopsies to rule out CMV, especially if steroid-refractory.",
      "IV steroids: methylprednisolone 60 mg/day, or hydrocortisone 100 mg IV 3 to 4 times daily.",
      "VTE prophylaxis with LMWH, even with rectal bleeding (IBD flares are strongly prothrombotic).",
      "GI and colorectal surgery involved from admission.",
      "Early labs so rescue is not delayed: IGRA (QuantiFERON), HBV serologies (HBsAg, anti-HBc, anti-HBs), lipid panel and magnesium (before cyclosporine or a JAK inhibitor).",
      "Daily abdominal exam; low threshold for abdominal x-ray (KUB). Colon > 5.5 to 6 cm suggests toxic megacolon: call surgery urgently."]],
    ["Do not", [
      "No routine broad-spectrum antibiotics.",
      "No TPN for bowel rest.",
      "Avoid opioids, anticholinergics, antidiarrheals (loperamide) and NSAIDs: they can precipitate toxic megacolon."]],
    ["Day 3 decision", [
      "Oxford criteria: non-response = more than 8 stools/day, or 3 to 8 stools/day with CRP > 45 mg/L. Predicts colectomy.",
      "Non-responders: rescue with infliximab 5 mg/kg or cyclosporine; the two are equally effective.",
      "Infliximab is preferred because it can be continued for maintenance. With high inflammatory burden or protein-losing colopathy (low albumin), infliximab is cleared faster, so cyclosporine or a JAK inhibitor may be favoured.",
      "Tofacitinib is emerging as salvage therapy, but the data are observational.",
      "No improvement 4 to 7 days after rescue: proceed to colectomy."]],
    ["Any IBD patient on advanced therapy", [
      "Treat as immunocompromised: treat fever as a possible opportunistic infection, and hold the drug during serious infection (discuss with GI)."]]
  ];
  const CROHN = [
    ["Crohn disease admissions", [
      "Early CT or MR enterography with IV contrast to separate active inflammation from obstruction, abscess or fistula.",
      "Intra-abdominal abscess: IV antibiotics covering GI flora (e.g. ciprofloxacin plus metronidazole). Abscess > 2 to 3 cm: percutaneous drainage. Peritonitis or uncontrolled sepsis: urgent surgery.",
      "Hold steroids and biologics until source control is achieved.",
      "Obstruction: decompress, NPO, IV steroids only if inflammation is present. Before surgery, taper prednisone to 20 mg/day or less where possible (infection risk).",
      "Perianal abscess or fistula: exam under anesthesia, drainage and seton, then antibiotics plus anti-TNF."]],
    ["Supportive care for every IBD admission", [
      "IV fluids, electrolytes, transfusion as needed.",
      "IV iron for active inflammation or Hb < 100 g/L.",
      "Malnutrition screen with dietitian referral; check B12 and vitamin D.",
      "Adequate pain control while minimising opioids."]]
  ];
  const ONDRUGS = [
    ["All advanced therapies", "Treat fever as possible opportunistic infection; hold the drug during serious infection. Screen TB and HBV before starting a new agent."],
    ["Thiopurines", "Leukopenia, pancreatitis, hepatotoxicity. Allopurinol and febuxostat raise thiopurine levels: life-threatening myelosuppression."],
    ["Methotrexate", "Teratogenic; pneumonitis; cytopenias. Do not give with TMP-SMX."],
    ["Anti-TNF", "TB and fungal reactivation, HBV, worsening heart failure, demyelination."],
    ["Vedolizumab, ustekinumab, IL-23 inhibitors", "Low systemic infection risk; usually continue around minor procedures."],
    ["JAK inhibitors", "Herpes zoster, VTE (adds to the flare risk), MACE, lipid rise."],
    ["Cyclosporine", "Nephrotoxicity, hypertension, seizures with low Mg or cholesterol, PJP risk. Follow trough levels."],
    ["Steroids", "More than 20 mg/day prednisone-equivalent for over 4 weeks (especially triple immunosuppression): PJP prophylaxis. Bone protection. Stress-dose steroids perioperatively if on chronic steroids."],
    ["Vaccines", "Live vaccines contraindicated on biologics or immunomodulators. Recombinant zoster vaccine is fine."]
  ];

  function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }
  // card-scoped lookups, so the card works on any page (IBD tab, Calculators tab)
  const $in = (el, id) => el.querySelector("#" + id);
  function num(el, id) { const v = $in(el, id).value; return v === "" ? null : Number(v); }

  const list = (secs) => secs.map(([h, items]) => `<div class="lab">${esc(h)}</div><ul class="chk">${items.map((t) => `<li><input type="checkbox"><span class="t">${esc(t)}</span></li>`).join("")}</ul>`).join("");
  /* Each score in its own box: coloured border, title, when to use it. Inline styles so it looks the same on the IBD and Calculators tabs. */
  const box = (color, tint, title, when, body, resId) => `
      <div style="border:2px solid ${color};border-left-width:6px;border-radius:8px;background:${color}14;padding:8px 12px 10px;margin:10px 0">
        <div style="font-weight:700;font-size:15px;color:${color}">${title}</div>
        <div style="font-size:12.5px;color:var(--muted,#555);margin:2px 0 4px">${when}</div>
        ${body}
        <div id="${resId}" style="font-weight:700;margin-top:4px;color:${color}"></div>
      </div>`;
  const SCORES_HTML =
    box("#0b6bcb", "#f3f8fe", "Truelove-Witts", "On admission: is this acute severe UC? Severe = 6 or more bloody stools/day plus at least one sign.", `
        <div class="row">
          <label class="inl">Bloody stools/day <input type="number" min="0" id="as-st"></label>
          <label class="inl">HR &gt; 90 <input type="number" min="0" id="as-hr"></label>
          <label class="inl">Temp &gt; 37.8 °C <input type="number" step="0.1" id="as-t"></label>
          <label class="inl">Hb &lt; 105 g/L <input type="number" min="0" id="as-hb"></label>
          <label class="inl">ESR &gt; 30 <input type="number" min="0" id="as-esr"></label></div>`, "as-tw") +
    box("#c26a00", "#fff8ef", "Oxford criteria (day 3)", "Day 3 of IV steroids: is the patient responding? Non-response = more than 8 stools/day, or 3 to 8 stools/day with CRP &gt; 45 mg/L.", `
        <div class="row">
          <label class="inl">Stools on day 3 <input type="number" min="0" id="as-d3"></label>
          <label class="inl">CRP day 3 (mg/L) <input type="number" min="0" id="as-crp"></label></div>`, "as-ox") +
    box("#6a3fb5", "#f7f3fd", "Ho index", "Day 3 of IV steroids: risk that steroids fail. Mean stools days 1 to 3 (&lt;4: 0, 4 to 6: 1, &gt;6 to 9: 2, &gt;9: 4) + colon &gt; 5.5 cm (4) + albumin &lt; 30 g/L (1).", `
        <div class="row">
          <label class="inl">Mean stools/day, days 1 to 3 <input type="number" min="0" step="0.1" id="as-mean"></label>
          <label class="inl"><input type="checkbox" id="as-dil"> Colonic dilatation &gt; 5.5 cm</label>
          <label class="inl">Albumin on admission (g/L) <input type="number" min="0" id="as-alb"></label></div>`, "as-ho") + `
      <div class="muted" id="as-src"></div>`;

  /* scoresOnly: just the three calculators (Calculators tab); otherwise the full ASUC card with checklists (IBD tab) */
  function render(el, opts) {
    opts = opts || {};
    el.innerHTML = (opts.scoresOnly ? "" : `
      <div class="muted">For the hospitalist: recognise and treat ASUC, rule out infection, prevent VTE, spot Crohn complications that need surgery or drainage (abscess, obstruction, perforation), and handle patients already on immunosuppressants safely. Content supplied by the user; the scoring was written by Claude and has not been verified.</div>`) +
      SCORES_HTML + (opts.scoresOnly ? "" : `
      ${list(CHECK)}
      <h2 class="sec" style="margin-top:14px">Crohn disease admissions and supportive care</h2>
      ${list(CROHN)}
      <h2 class="sec" style="margin-top:14px">Patients already on IBD drugs</h2>
      <table><tr><th>Drug class</th><th>Inpatient issues</th></tr>${ONDRUGS.map(([a, b]) => `<tr><td><b>${esc(a)}</b></td><td>${esc(b)}</td></tr>`).join("")}</table>
      <div class="muted" style="margin-top:8px">Printable version: <a href="docs/IBD_hospitalist_inpatient_guide.pdf" target="_blank" rel="noopener">hospitalist inpatient IBD guide (PDF)</a>.</div>`);
    const upd = () => {
      const tw = truelove({ stools: num(el, "as-st"), hr: num(el, "as-hr"), temp: num(el, "as-t"), hgb: num(el, "as-hb"), esr: num(el, "as-esr") });
      $in(el, "as-tw").textContent = !tw.known ? "" : tw.severe ? `Acute severe UC (${tw.sys.join(", ")})` : "Not severe by Truelove-Witts";
      const ox = oxford(num(el, "as-d3"), num(el, "as-crp"));
      $in(el, "as-ox").textContent = !ox.known ? "" : ox.nonResponse ? "Oxford: NON-RESPONSE, plan rescue or colectomy with GI and surgery" : "Oxford: responding";
      const h = ho(num(el, "as-mean"), $in(el, "as-dil").checked, num(el, "as-alb"));
      $in(el, "as-ho").textContent = h ? `Ho index ${h.score}: ${h.band} risk, about ${h.failure} steroid failure` : "";
    };
    el._asucUpdate = upd;
    el.addEventListener("input", (e) => { if (e.target.dataset && e.target.dataset.chart) { delete e.target.dataset.chart; const t = tagOf(e.target); t.textContent = "edited"; t.style.color = "#555"; } upd(); });
    el.addEventListener("change", (e) => {
      if (e.target.type === "checkbox" && e.target.closest("li")) e.target.closest("li").classList.toggle("done", e.target.checked);
      upd();
    });
  }
  /* Fill the card from the chart. Only fills boxes that are empty or were filled from the chart before (never overwrites what you typed).
     f = IBDChart.parseChart() facts, or null to clear the chart values. */
  const FILL = [["hr", "as-hr", "highest in last 24 h of readings"], ["temp", "as-t", "highest in last 24 h of readings"], ["hgb", "as-hb", "latest"], ["esr", "as-esr", "latest"], ["crp", "as-crp", "latest: check it is the day-3 value"], ["alb", "as-alb", "earliest in the 14 days before the latest result"]];
  function tagOf(inp) {
    let t = inp.parentNode.querySelector(".as-tag");
    if (!t) { t = document.createElement("span"); t.className = "as-tag"; t.style.cssText = "font-size:11px;color:#2e7d32;margin-left:2px"; inp.parentNode.appendChild(t); }
    return t;
  }
  function when(t) { const d = new Date(t); return d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) + " " + d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }); }
  function prefill(el, f, opts) {
    if (!el || !el.querySelector("#as-hr")) return;
    const now = (opts && opts.now) || Date.now(), sug = suggest(f);
    let n = 0;
    FILL.forEach(([k, id, how]) => {
      const inp = $in(el, id), s = sug[k], tag = tagOf(inp);
      const mine = inp.value !== "" && !inp.dataset.chart;
      if (mine) return;
      if (!s) { inp.value = ""; delete inp.dataset.chart; tag.textContent = f ? "not found in chart" : ""; tag.style.color = "#888"; return; }
      inp.value = Math.round(s.v * 10) / 10; inp.dataset.chart = "1"; n++;
      const old = k !== "alb" && now - s.t > 3 * 864e5; // albumin is the admission value, so older is expected
      tag.textContent = "chart " + when(s.t) + (old ? " · OLDER THAN 3 DAYS" : "");
      tag.title = "From the chart (" + how + "). Type over it to change.";
      tag.style.color = old ? "#b26a00" : "#2e7d32";
    });
    const src = $in(el, "as-src");
    if (src) src.textContent = f ? (n ? "Green = from the chart (hover for which value). Stool counts and colonic dilatation are entered by hand. Confirm every value." : "No HR, temperature, Hb, ESR, CRP or albumin found in the chart: enter by hand.") : "";
    if (el._asucUpdate) el._asucUpdate();
  }

  /* Calculators tab: read just the values these scores need (vitals 7 days, the six labs 30 days), then fill. Needs data.js + chart.js loaded. */
  async function fromClient(el, client) {
    if (!client || !window.IBDChart || !window.IBD) return;
    const src = $in(el, "as-src"); if (src) src.textContent = "Reading the chart…";
    const pid = client.patient.id, iso = (d) => new Date(d).toISOString().slice(0, 10);
    const L = (a) => a.map((c) => "http://loinc.org|" + c).join(",");
    const lab = window.IBD.LABS.filter((d) => ["hgb", "esr", "crp", "alb"].includes(d.id)).flatMap((d) => d.loinc);
    const get = (url, pages) => client.request(url, { pageLimit: pages || 1, flat: true }).then((r) => r.filter((x) => x.resourceType === "Observation")).catch(() => []);
    const [patient, a, b, c] = await Promise.all([
      client.patient.read().catch(() => null),
      get(`Observation?patient=${pid}&category=vital-signs&date=ge${iso(Date.now() - 7 * 864e5)}&_count=100`, 3),
      get(`Observation?patient=${pid}&code=${L(["8867-4", "8310-5", "8331-1"])}&_count=100`, 2), // also finds older readings (test patients)
      get(`Observation?patient=${pid}&code=${L(lab)}&_count=100`, 3)
    ]);
    const seen = new Set(), obs = a.concat(b, c).filter((o) => { const k = o.id || Math.random(); if (seen.has(k)) return false; seen.add(k); return true; });
    prefill(el, window.IBDChart.parseChart({ patient, obs }, { now: Date.now() }));
  }

  root.IBDAsuc = { truelove, oxford, ho, suggest, render, prefill, fromClient, CHECK, CROHN, ONDRUGS };
  if (typeof module !== "undefined" && module.exports) module.exports = root.IBDAsuc;
  if (typeof document !== "undefined") {
    const go = () => { const el = document.getElementById("asuc"); if (el && !el.dataset.manual) render(el); };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", go); else go();
  }
})(typeof window !== "undefined" ? window : globalThis);
