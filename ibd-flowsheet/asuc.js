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
  function num(id) { const v = document.getElementById(id).value; return v === "" ? null : Number(v); }

  const list = (secs) => secs.map(([h, items]) => `<div class="lab">${esc(h)}</div><ul class="chk">${items.map((t) => `<li><input type="checkbox"><span class="t">${esc(t)}</span></li>`).join("")}</ul>`).join("");
  function render(el) {
    el.innerHTML = `
      <div class="muted">For the hospitalist: recognise and treat ASUC, rule out infection, prevent VTE, spot Crohn complications that need surgery or drainage (abscess, obstruction, perforation), and handle patients already on immunosuppressants safely. Content supplied by the user; the scoring was written by Claude and has not been verified.</div>
      <div class="lab">Truelove-Witts (severe = 6 or more bloody stools/day plus at least one sign)</div>
      <div class="row">
        <label class="inl">Bloody stools/day <input type="number" min="0" id="as-st"></label>
        <label class="inl">HR <input type="number" min="0" id="as-hr"></label>
        <label class="inl">Temp °C <input type="number" step="0.1" id="as-t"></label>
        <label class="inl">Hb g/L <input type="number" min="0" id="as-hb"></label>
        <label class="inl">ESR <input type="number" min="0" id="as-esr"></label>
        <span id="as-tw" style="font-weight:700"></span></div>
      <div class="lab">Day 3 on IV steroids</div>
      <div class="row">
        <label class="inl">Stools on day 3 <input type="number" min="0" id="as-d3"></label>
        <label class="inl">CRP day 3 (mg/L) <input type="number" min="0" id="as-crp"></label>
        <span id="as-ox" style="font-weight:700"></span></div>
      <div class="row">
        <label class="inl">Mean stools/day, days 1 to 3 <input type="number" min="0" step="0.1" id="as-mean"></label>
        <label class="inl"><input type="checkbox" id="as-dil"> Colonic dilatation > 5.5 cm</label>
        <label class="inl">Albumin on admission (g/L) <input type="number" min="0" id="as-alb"></label>
        <span id="as-ho" style="font-weight:700"></span></div>
      ${list(CHECK)}
      <h2 class="sec" style="margin-top:14px">Crohn disease admissions and supportive care</h2>
      ${list(CROHN)}
      <h2 class="sec" style="margin-top:14px">Patients already on IBD drugs</h2>
      <table><tr><th>Drug class</th><th>Inpatient issues</th></tr>${ONDRUGS.map(([a, b]) => `<tr><td><b>${esc(a)}</b></td><td>${esc(b)}</td></tr>`).join("")}</table>
      <div class="muted" style="margin-top:8px">Printable version: <a href="docs/IBD_hospitalist_inpatient_guide.pdf" target="_blank" rel="noopener">hospitalist inpatient IBD guide (PDF)</a>.</div>`;
    const upd = () => {
      const tw = truelove({ stools: num("as-st"), hr: num("as-hr"), temp: num("as-t"), hgb: num("as-hb"), esr: num("as-esr") });
      document.getElementById("as-tw").textContent = !tw.known ? "" : tw.severe ? `Acute severe UC (${tw.sys.join(", ")})` : "Not severe by Truelove-Witts";
      const ox = oxford(num("as-d3"), num("as-crp"));
      document.getElementById("as-ox").textContent = !ox.known ? "" : ox.nonResponse ? "Oxford: NON-RESPONSE, plan rescue or colectomy with GI and surgery" : "Oxford: responding";
      const h = ho(num("as-mean"), document.getElementById("as-dil").checked, num("as-alb"));
      document.getElementById("as-ho").textContent = h ? `Ho index ${h.score}: ${h.band} risk, about ${h.failure} steroid failure` : "";
    };
    el.addEventListener("input", upd); el.addEventListener("change", (e) => {
      if (e.target.type === "checkbox" && e.target.closest("li")) e.target.closest("li").classList.toggle("done", e.target.checked);
      upd();
    });
  }
  root.IBDAsuc = { truelove, oxford, ho, CHECK, CROHN, ONDRUGS };
  if (typeof module !== "undefined" && module.exports) module.exports = root.IBDAsuc;
  if (typeof document !== "undefined") {
    const go = () => { const el = document.getElementById("asuc"); if (el) render(el); };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", go); else go();
  }
})(typeof window !== "undefined" ? window : globalThis);
