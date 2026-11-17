/* Kidney transplant tab – "Tacrolimus when NPO": route options and dose calculator.
 * Reads the current tacrolimus order; NG 1:1, sublingual = half each IR dose, IV ≈ ¼ of total oral daily dose (range ⅕–⅓)
 * as a continuous 24 h infusion, checked against 0.03–0.05 mg/kg/day. UNVERIFIED DRAFT – route changes go through the transplant team.
 * Sources: Prograf product monograph (IV dose, anaphylaxis, PVC, switch-back timing); UW Health renal transplant protocol (SL = dose ÷ 2);
 * Pennington & Park AJHP 2015 and Doligalski Pharmacotherapy 2014 (SL); CHEO parenteral manual (oral = 4 × IV). */
(function () {
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const r = (v, step) => Math.round(v / step) * step;
  const fmt = (v) => (Math.round(v * 100) / 100).toString();
  function parseTac(name) {
    const mg = parseFloat((name.match(/(\d+(?:\.\d+)?)\s*mg/i) || [])[1]);
    const freq = /\bBID\b|q12h|twice daily|every 12/i.test(name) ? 2 : /\bTID\b|q8h/i.test(name) ? 3 : /daily|once|\bqd\b|q24h|qam|qhs/i.test(name) ? 1 : null;
    const form = /envarsus|LCP/i.test(name) ? "envarsus" : /advagraf|\bXL\b|\bXR\b|\bER\b|extended|prolonged|once daily/i.test(name) ? "advagraf" : "ir";
    return { name, mg: isNaN(mg) ? null : mg, freq: freq || (form === "ir" ? 2 : 1), form };
  }
  function render(el, sumEl, state) {
    if (!state.f) { el.innerHTML = '<div class="muted">No patient loaded.</div>'; sumEl.textContent = ""; return; }
    const inp = state.infx || (state.infx = {});
    const orders = (state.f.meds || []).filter((m) => m.kind === "order" && m.current && /tacrolimus|prograf|advagraf|envarsus/i.test(m.name)).map((m) => parseTac(m.name));
    const t = inp.tacOverride ? parseTac(inp.tacOverride) : orders[0];
    const wt = inp.wt ? +inp.wt : null;
    sumEl.textContent = state.ctx.npo ? "NPO ticked" : t ? "calculator" : "no tacrolimus found";
    let calc = "";
    if (t && t.mg) {
      const daily = t.mg * t.freq;
      const irDaily = t.form === "envarsus" ? daily / 0.8 : daily; // Envarsus label: IR -> Envarsus at ~80% of the IR daily dose
      const irDose = irDaily / 2;
      const iv = irDaily / 4, ivLo = irDaily / 5, ivHi = irDaily / 3;
      const wLo = wt ? 0.03 * wt : null, wHi = wt ? 0.05 * wt : null;
      calc = `<table><tr><th>Route</th><th>Dose</th><th>How</th></tr>
        ${t.form !== "ir" ? `<tr><td><b>Step 1: convert to immediate-release</b></td><td><b>${fmt(irDaily)} mg/day</b> → ${fmt(r(irDose, 0.5))} mg BID</td><td>${t.form === "envarsus" ? "Envarsus is dosed lower than immediate-release (its monograph converts IR → Envarsus at about 80%); going back to IR is roughly 1.25× — <b>confirm with transplant pharmacy</b>." : "Advagraf → immediate-release (Prograf) is 1:1 for the total daily dose, split BID."} Extended-release capsules can't be opened, crushed, given by tube or sublingually.</td></tr>` : ""}
        <tr><td>NG / feeding tube</td><td>${fmt(r(irDose, 0.5))} mg BID (1:1 with IR oral)</td><td>Immediate-release capsule contents or pharmacy suspension; flush; give consistently relative to feeds.</td></tr>
        <tr><td><b>Sublingual</b> (preferred if no gut access)</td><td><b>${fmt(r(irDose / 2, 0.5))} mg SL BID</b> <span class="muted">(half of each IR dose: ${fmt(irDose / 2)} mg)</span></td><td>Open the IR capsule, contents under the tongue, nothing by mouth for ~15 min. Off-label; ratios vary between studies — trough in 2–3 days and again after.</td></tr>
        <tr><td>IV (last resort)</td><td><b>≈ ${fmt(iv)} mg per 24 h</b> continuous infusion <span class="muted">(range ${fmt(ivLo)}–${fmt(ivHi)} mg = ⅕–⅓ of the oral daily dose)</span>${wt ? `<div class="muted">Weight check: 0.03–0.05 mg/kg/day × ${wt} kg = ${fmt(wLo)}–${fmt(wHi)} mg/day (adults: lower end)${iv > wHi * 1.1 ? ' — <b style="color:var(--r-ink)">ratio dose is above the weight-based range; use the lower one</b>' : ""}</div>` : '<div class="muted">Enter weight above for the 0.03–0.05 mg/kg/day check.</div>'}</td>
          <td>Transplant pharmacist + transplant MD first. Non-PVC tubing and containers. Watch continuously for 30 min (castor-oil vehicle anaphylaxis; epinephrine at bedside). More nephro- and neurotoxicity. Levels during infusion are not troughs. Restart oral 8–12 h after stopping the infusion.</td></tr></table>`;
    } else if (t) calc = `<div class="muted">Found "${esc(t.name)}" but couldn't read the dose — type the order below.</div>`;
    el.innerHTML = `${state.ctx.npo ? '<div class="alert major"><div class="h"><span class="sev">Act</span>NPO: make a route plan with transplant — don\'t just hold immunosuppression</div></div>' : ""}
      <div class="row"><span><b>Current tacrolimus:</b> ${t ? esc(t.name) + ` <span class="muted">(${t.form === "ir" ? "immediate-release" : t.form === "advagraf" ? "extended-release (Advagraf)" : "extended-release (Envarsus)"}${t.mg ? ", " + fmt(t.mg * t.freq) + " mg/day" : ""})</span>` : '<span class="muted">none found</span>'}</span>
        <label class="inl">Weight <input type="number" id="npo-wt" min="20" max="250" value="${esc(inp.wt || "")}" style="width:70px"> kg</label>
        <label class="inl">Or type an order <input type="text" id="npo-ov" placeholder="e.g. Tacrolimus 4 mg PO BID" value="${esc(inp.tacOverride || "")}" style="width:230px"></label></div>
      ${calc}
      <h3>Order of preference</h3><ol class="tight" style="margin-left:18px"><li>Most "NPO for a procedure" orders still allow medications with sips of water — check first.</li><li>NG/feeding tube at the same immediate-release dose.</li><li>Sublingual at half the dose.</li><li>IV only if none of the above, with the transplant team.</li></ol>
      <h3>The rest of the regimen when NPO</h3>
      <table><tr><th>Drug</th><th>Option</th></tr>
        <tr><td>Mycophenolate mofetil (CellCept)</td><td>IV mycophenolate mofetil at the same dose (1:1), infused over ≥2 h.</td></tr>
        <tr><td>Mycophenolate sodium (Myfortic)</td><td>720 mg ≈ CellCept 1000 mg → give IV mycophenolate mofetil at the equivalent dose. Enteric-coated: don't crush.</td></tr>
        <tr><td>Prednisone</td><td>IV methylprednisolone (5 mg prednisone ≈ 4 mg methylprednisolone) or hydrocortisone; stress-dose hydrocortisone if septic or for major surgery.</td></tr>
        <tr><td>Cyclosporine</td><td>IV ≈ ⅓ of the oral daily dose (same castor-oil anaphylaxis precautions); oral solution can go by NG.</td></tr>
        <tr><td>Sirolimus / everolimus</td><td>No IV form; sirolimus oral solution by NG; otherwise hold briefly only with transplant input (long half-life).</td></tr>
        <tr><td>Azathioprine</td><td>IV available (1:1) where stocked; or crush tablets for NG.</td></tr></table>
      <div class="src">Unverified draft. Sublingual and IV dosing from the Prograf monograph, UW Health renal transplant protocol and published SL studies; mycophenolate/steroid/cyclosporine conversions are standard equivalences. Every route change goes through the transplant team and pharmacy, with close trough monitoring.</div>`;
    el.querySelector("#npo-wt").onchange = (e) => { inp.wt = e.target.value; window.TxRefresh ? window.TxRefresh() : render(el, sumEl, state); };
    const ov = el.querySelector("#npo-ov");
    ov.onchange = () => { inp.tacOverride = ov.value.trim() || null; render(el, sumEl, state); };
  }
  window.TxNpo = { render, parseTac };
})();
