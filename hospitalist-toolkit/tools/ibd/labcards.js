/* IBD: CMV colitis card and albumin card. UNVERIFIED draft written by Claude on 2026-11-13 from general knowledge of the ECCO opportunistic-infection guidance,
   the AGA/ACG UC guidelines and published infliximab pharmacokinetic work. Nothing here was checked against the source documents in this session: verify doses and thresholds before clinical use.
   Pure functions (node-testable) + self-rendering cards for elements with id "cmv" and "alb". update(f) fills them from the chart read (f.labs.alb, f.labs.cmv). */
(function (root) {
  const ALB_LOW = 35, ALB_SEVERE = 30, ALB_VERYLOW = 25; // g/L

  /* Albumin in g/L, and optional calcium (mmol/L). Returns { level, head, lines[], corrCa } */
  function albuminAdvice(a) {
    const alb = a == null || a.alb === "" || a.alb == null || isNaN(a.alb) ? null : +a.alb;
    const ca = a && a.ca !== "" && a.ca != null && !isNaN(a.ca) ? +a.ca : null;
    const L = [];
    let out = { level: "none", head: "Enter an albumin (g/L)", lines: [], corrCa: null };
    if (alb == null) return out;
    if (ca != null) out.corrCa = Math.round((ca + 0.02 * (40 - alb)) * 100) / 100;
    if (alb < ALB_VERYLOW) { out.level = "urgent"; out.head = `Albumin ${alb} g/L: very low`; }
    else if (alb < ALB_SEVERE) { out.level = "action"; out.head = `Albumin ${alb} g/L: low (under ${ALB_SEVERE})`; }
    else if (alb < ALB_LOW) { out.level = "info"; out.head = `Albumin ${alb} g/L: mildly low`; }
    else { out.level = "none"; out.head = `Albumin ${alb} g/L: not low`; return out; }
    L.push("Mostly inflammation (cytokines cut synthesis, the inflamed gut leaks protein) plus poor intake and catabolism. Rule out nephrotic-range proteinuria and liver disease if it does not fit.");
    if (alb < ALB_SEVERE) L.push("In acute severe UC an admission albumin under about 30 g/L goes with steroid failure, rescue therapy or colectomy, and VTE. Involve the surgeon from admission and use pharmacologic VTE prophylaxis unless there is major bleeding.");
    L.push("Infliximab and other anti-TNFs: low albumin and high CRP go with faster clearance, lower trough levels, anti-drug antibodies and primary non-response (fecal loss in severe colitis adds to it). Check a trough level; some centres use higher or accelerated dosing in ASUC (limited evidence: discuss with GI).");
    L.push("Vedolizumab and ustekinumab: clearance also rises with low albumin, less than for infliximab.");
    L.push("Prednisone and other protein-bound drugs (warfarin, phenytoin, valproate): more free drug, so more effect and side effects for the same dose. Interpret total levels with caution.");
    L.push("Total calcium is falsely low: use the corrected value (corrected Ca = measured + 0.02 x (40 - albumin g/L), mmol/L).");
    L.push("Surgery: albumin under about 30 to 35 g/L raises complications and leaks; the surgeon may stage the operation. Treat inflammation and replace calories and protein early (dietitian, enteral first). IV albumin does not fix this.");
    L.push("Albumin has a half-life of about 20 days, so it lags behind CRP. Use the trend: a rise means response, a fall is a warning.");
    out.lines = L; return out;
  }

  /* x = { setting: "inpatient"|"outpatient", severe: bool (moderate-severe UC flare), steroidIV: bool (3 to 5 days IV steroid without response), steroidDep: bool, thio: bool, deepUlcers: bool,
           bx: "none"|"neg"|"low"|"high", blood: "none"|"neg"|"pos", cdiffNeg: bool }
     returns { level, head, lines[] } */
  function cmvAdvice(x) {
    const L = [];
    if (x.bx === "high") {
      L.push("High-density CMV on IHC or typical inclusions: more likely to be driving the colitis. Treat: ganciclovir 5 mg/kg IV every 12 h (adjust for renal function) for about 5 to 10 days, then oral valganciclovir to complete about 2 to 3 weeks (ECCO; verify with ID and pharmacy).");
      L.push("Hold or reduce the thiopurine; taper steroids as far as the colitis allows. Do not delay rescue therapy or colectomy planning: CMV does not remove the need for them. Involve the surgeon.");
      L.push("Monitor CBC (neutropenia; foscarnet is the alternative but nephrotoxic) and creatinine, and reassess clinically at 3 to 5 days.");
      return { level: "action", head: "CMV colitis on biopsy: treat and involve GI, ID and the surgeon", lines: L };
    }
    if (x.bx === "low") {
      L.push("Only a few CMV-positive cells: often a bystander and may not need treatment. Decide with GI and ID, looking at ulcer depth, blood PCR and response so far.");
      L.push("If the colitis is steroid-refractory with deep ulcers and the patient is deteriorating, many would treat. Either way, do not delay rescue therapy.");
      return { level: "info", head: "Low-density CMV in tissue: judgement call", lines: L };
    }
    if (x.bx === "neg") return { level: "none", head: "Biopsy negative for CMV (IHC)", lines: ["CMV is unlikely to be the cause of non-response. Look again for C. difficile, other infection, non-adherence and an inadequate drug level."] };
    // no biopsy result yet
    const reasons = [];
    if (x.setting !== "outpatient" && x.severe) reasons.push("moderate to severe UC flare");
    if (x.steroidIV) reasons.push("no improvement after 3 to 5 days of IV steroids");
    if (x.steroidDep) reasons.push("steroid-dependent or refractory");
    if (x.thio) reasons.push("on a thiopurine");
    if (x.deepUlcers) reasons.push("deep punched-out ulcers at endoscopy");
    if (x.blood === "pos") reasons.push("CMV positive in blood");
    const strong = x.steroidIV || x.steroidDep || x.deepUlcers;
    if (!reasons.length) return { level: "none", head: "CMV colitis: no trigger entered", lines: ["Think of CMV in steroid-refractory or steroid-dependent UC, severe UC not responding at day 3 to 5, or deep ulcers on endoscopy. It is rare in Crohn disease."] };
    L.push("Reasons: " + reasons.join("; ") + ".");
    L.push("Take biopsies from the ulcer base and edge on flexible sigmoidoscopy or colonoscopy and ask for CMV immunohistochemistry (the best test; H&E owl's-eye inclusions are less sensitive). Tissue PCR is supportive.");
    L.push("Blood CMV PCR or antigenemia only supports the diagnosis. IgG serology is not useful (most adults are IgG positive).");
    if (!x.cdiffNeg) L.push("Send C. difficile testing at the same time: it is more common and often coexists.");
    L.push("Do not wait for CMV results to start rescue therapy if the patient is not responding.");
    return { level: strong ? "action" : "info", head: strong ? "Suspect CMV: get biopsies with IHC" : "Consider CMV", lines: L };
  }

  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const LV = { urgent: "#b00020", action: "#c26a00", info: "#0b6bcb", none: "#555" };
  const day = (t) => new Date(t).toISOString().slice(0, 10);
  const out = (a) => a.level === "none" && !a.lines.length ? "" : `<div style="font-weight:700;color:${LV[a.level]};margin:6px 0 2px">${esc(a.head)}</div><ul style="margin:0;padding-left:18px;font-size:13px">${a.lines.map((l) => `<li>${esc(l)}</li>`).join("")}</ul>`;
  const BOX = (c) => `border:2px solid ${c};border-left-width:6px;border-radius:8px;background:${c}12;padding:8px 12px 10px;margin:10px 0`;

  function renderAlb(el) {
    el.innerHTML = `
      <div class="muted">Why albumin matters in IBD and how it changes drug exposure. <b>Unverified draft</b> from general knowledge; confirm thresholds locally.</div>
      <div style="${BOX("#0b6bcb")}"><div style="font-weight:700;font-size:15px;color:#0b6bcb">Albumin check</div>
        <div class="row"><label class="inl">Albumin (g/L) <input type="number" min="0" step="1" id="al-v"></label>
        <label class="inl">Total calcium (mmol/L, optional) <input type="number" min="0" step="0.01" id="al-ca"></label><span class="muted" id="al-src"></span></div>
        <div id="al-out"></div><div id="al-ca-out" class="muted"></div></div>`;
    const g = (id) => el.querySelector("#" + id), upd = () => {
      g("al-out").innerHTML = out(albuminAdvice({ alb: g("al-v").value, ca: g("al-ca").value }));
      const r = albuminAdvice({ alb: g("al-v").value, ca: g("al-ca").value });
      g("al-ca-out").textContent = r.corrCa != null ? "Corrected calcium " + r.corrCa + " mmol/L" : "";
    };
    el.addEventListener("input", (e) => { if (e.target.id === "al-v" && e.isTrusted) delete e.target.dataset.chart; upd(); }); upd();
  }
  function renderCmv(el) {
    const sel = (id, opts) => `<select id="${id}">${opts.map(([v, t]) => `<option value="${v}">${t}</option>`).join("")}</select>`;
    el.innerHTML = `
      <div class="muted">When to suspect CMV colitis, how to confirm it, and how to read the result. <b>Unverified draft</b> from general knowledge of the ECCO guidance; verify doses with ID and pharmacy.</div>
      <div style="${BOX("#c26a00")}"><div style="font-weight:700;font-size:15px;color:#c26a00">CMV: suspect or treat?</div>
        <div class="row"><label class="inl"><input type="checkbox" id="cm-sev"> Moderate to severe UC flare</label>
          <label class="inl"><input type="checkbox" id="cm-iv"> No improvement after 3 to 5 days IV steroids</label>
          <label class="inl"><input type="checkbox" id="cm-dep"> Steroid-dependent or refractory</label>
          <label class="inl"><input type="checkbox" id="cm-thio"> On thiopurine</label>
          <label class="inl"><input type="checkbox" id="cm-deep"> Deep punched-out ulcers</label>
          <label class="inl"><input type="checkbox" id="cm-cd"> C. difficile already negative</label></div>
        <div class="row"><label class="inl">Biopsy CMV IHC ${sel("cm-bx", [["none", "Not done / not back"], ["neg", "Negative"], ["low", "Positive, few cells"], ["high", "Positive, high density / inclusions"]])}</label>
          <label class="inl">Blood CMV PCR ${sel("cm-bl", [["none", "Not done"], ["neg", "Negative"], ["pos", "Positive"]])}</label><span class="muted" id="cm-src"></span></div>
        <div id="cm-out"></div></div>
      <div class="lab">Also remember</div>
      <ul class="chk">${[
        "Reactivation is not the same as disease: CMV in the blood or a few cells in tissue may be a bystander. Tissue (IHC) decides.",
        "Rare in Crohn disease; the concern is mainly ulcerative colitis, especially refractory to steroids.",
        "Surgeon early in every acute severe UC; CMV does not delay rescue therapy or colectomy.",
        "Before starting ganciclovir: CBC, creatinine, weight. During: CBC and creatinine at least twice weekly.",
        "A positive CMV result already in the chart is flagged in the Alerts section above."].map((t) => `<li><input type="checkbox"><span class="t">${esc(t)}</span></li>`).join("")}</ul>`;
    const g = (id) => el.querySelector("#" + id), upd = () => {
      g("cm-out").innerHTML = out(cmvAdvice({ setting: "inpatient", severe: g("cm-sev").checked, steroidIV: g("cm-iv").checked, steroidDep: g("cm-dep").checked, thio: g("cm-thio").checked, deepUlcers: g("cm-deep").checked, cdiffNeg: g("cm-cd").checked, bx: g("cm-bx").value, blood: g("cm-bl").value }));
    };
    el.addEventListener("input", upd); el.addEventListener("change", (e) => { if (e.target.type === "checkbox" && e.target.closest("li")) e.target.closest("li").classList.toggle("done", e.target.checked); upd(); }); upd();
  }

  /* Fill from the chart read f (f.labs.alb, f.labs.cmv: arrays of {t, v, text}). Typed values are never overwritten. */
  function update(f, now) {
    if (typeof document === "undefined") return;
    now = now || Date.now();
    const a = document.getElementById("alb"), c = document.getElementById("cmv");
    if (a && a.querySelector("#al-v")) {
      const v = a.querySelector("#al-v"), tag = a.querySelector("#al-src"), mine = v.value !== "" && !v.dataset.chart;
      const e = f && f.labs && (f.labs.alb || []).filter((x) => x.v != null).sort((p, q) => q.t - p.t)[0];
      if (!mine) {
        if (e) { v.value = Math.round(e.v * 10) / 10; v.dataset.chart = "1"; tag.textContent = "chart " + day(e.t) + (now - e.t > 7 * 864e5 ? " · OLDER THAN 7 DAYS" : ""); }
        else { v.value = ""; delete v.dataset.chart; tag.textContent = f ? "not found in chart" : ""; }
        v.dispatchEvent(new Event("input", { bubbles: true }));
      }
    }
    if (c && c.querySelector("#cm-src")) {
      const tag = c.querySelector("#cm-src"), e = f && f.labs && (f.labs.cmv || []).slice().sort((p, q) => q.t - p.t)[0];
      tag.textContent = e ? "CMV in chart: " + (e.text || (e.v != null ? e.v : "")) + " (" + day(e.t) + "). Tissue IHC decides." : (f ? "no CMV result in chart" : "");
    }
  }

  root.IBDLabCards = { albuminAdvice, cmvAdvice, update, renderAlb, renderCmv, ALB_LOW, ALB_SEVERE, ALB_VERYLOW };
  if (typeof module !== "undefined" && module.exports) module.exports = root.IBDLabCards;
  if (typeof document !== "undefined") { const go = () => { const a = document.getElementById("alb"), c = document.getElementById("cmv"); if (a) renderAlb(a); if (c) renderCmv(c); }; if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", go); else go(); }
})(typeof window !== "undefined" ? window : globalThis);
