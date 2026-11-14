/* IBD: VTE prophylaxis card. UNVERIFIED draft written by Claude on 2026-11-13 from general knowledge of ACG, ECCO and ACCP guidance (not looked up in this session).
   Doses and durations are typical values: confirm against your local protocol and pharmacy. Pure advice function (node-testable) + a self-rendering card for id "vte".
   x = { ctx: "medical"|"surgery", flare: bool, bleed: "none"|"rectal"|"severe", plt: number|"", crcl: number|"", kg: number|"", prior: bool, surg: "colectomy"|"major"|"minor", neuraxial: bool }
   returns { level: "urgent"|"action"|"info"|"none", head, lines[] } */
(function (root) {
  const PLT_HOLD = 50;
  const num = (v) => (v === "" || v == null || isNaN(v) ? null : +v);
  function vteAdvice(x) {
    const L = [], plt = num(x.plt), crcl = num(x.crcl), kg = num(x.kg);
    if (x.bleed === "severe") return { level: "urgent", head: "Severe or life-threatening bleeding: hold drugs, use mechanical prophylaxis", lines: ["Use intermittent pneumatic compression (SCDs) and review daily. Restart pharmacologic prophylaxis as soon as bleeding is controlled (general practice).", "Treat the bleeding source and involve GI and the surgeon."] };
    if (plt != null && plt < PLT_HOLD) return { level: "urgent", head: `Platelets ${plt}: below ${PLT_HOLD}, usually hold the drug`, lines: ["Use SCDs. Many protocols hold prophylaxis under 50 and reassess daily; discuss with haematology if the count falls further or there is a clot.", "Look for a reason (sepsis, drug, DIC)."] };
    const surgical = x.ctx === "surgery";
    if (!surgical && !x.flare) return { level: "info", head: "Not an active flare: routine hospital VTE assessment applies", lines: ["Use your usual risk score. Quiescent IBD adds little; active disease, immobility, a central line, steroids and prior VTE all add risk."] };
    let head = surgical ? "After IBD surgery: prophylaxis, usually extended" : "Active IBD flare in hospital: give pharmacologic prophylaxis";
    L.push(x.bleed === "rectal" ? "Rectal bleeding from colitis is NOT a reason to withhold prophylaxis unless it is severe or the patient is unstable." : "Start on admission (within about 24 h); do not wait for endoscopy or the diagnosis.");
    if (plt != null && plt < 100) L.push(`Platelets ${plt}: monitor the count and watch for bleeding.`);
    const renal = crcl != null && crcl < 30;
    if (renal) L.push(`CrCl ${crcl}: use unfractionated heparin 5,000 units SC every 8 to 12 h, or enoxaparin 30 mg SC once daily with anti-Xa monitoring per pharmacy.`);
    else L.push("Usual agent: enoxaparin 40 mg SC once daily (LMWH). Alternative: unfractionated heparin 5,000 units SC every 8 to 12 h.");
    if (kg != null && kg >= 120 && !renal) L.push(`Weight ${kg} kg: many protocols increase the dose in obesity (for example enoxaparin 40 mg every 12 h); follow local protocol.`);
    if (kg != null && kg < 50 && !renal) L.push(`Weight ${kg} kg: consider a lower dose and check renal function.`);
    L.push("Add SCDs if the patient is immobile. Mechanical prophylaxis alone is for patients who cannot take drugs.");
    if (x.prior) L.push("Prior VTE: higher risk. Strongly consider continuing prophylaxis after discharge and ask haematology.");
    if (!surgical) {
      L.push("Duration: until discharge and the patient is walking. Routine extended prophylaxis after discharge is not standard; consider it for prior VTE, prolonged immobility or a severe unresolved flare (judgement).");
    } else {
      L.push("Timing: first dose before surgery or within 6 to 12 h after, once haemostasis is secure. Time doses around epidural or spinal anaesthesia with the anaesthesia team." + (x.neuraxial ? " Neuraxial catheter in place: do not give LMWH until the catheter timing rule is met (about 4 h after removal; 12 h before insertion)." : ""));
      if (x.surg === "minor") L.push("Minor surgery: until the patient is walking, plus the usual hospital rule.");
      else L.push("Duration: at least until discharge and mobile. After major abdominal or pelvic surgery many guidelines advise about 28 days" + (x.surg === "colectomy" ? "; after a colectomy for UC many surgeons extend to 4 weeks (the evidence is modest and mostly observational)." : ".") + " Agree the plan with the surgeon and write the stop date in the discharge summary.");
    }
    L.push("If a VTE occurs: therapeutic anticoagulation, even with rectal bleeding unless it is severe; discuss with GI and haematology.");
    return { level: "action", head, lines: L };
  }
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const LV = { urgent: "#b00020", action: "#c26a00", info: "#0b6bcb", none: "#555" };
  const day = (t) => new Date(t).toISOString().slice(0, 10);
  function render(el) {
    const sel = (id, o) => `<select id="${id}">${o.map(([v, t]) => `<option value="${v}">${t}</option>`).join("")}</select>`;
    el.innerHTML = `
      <div class="muted">VTE prophylaxis in IBD: who, when to start, which drug and how long. <b>Unverified draft</b> from general knowledge; confirm doses and duration with your local protocol and pharmacy.</div>
      <div style="border:2px solid #c26a00;border-left-width:6px;border-radius:8px;background:#c26a0012;padding:8px 12px 10px;margin:10px 0"><div style="font-weight:700;font-size:15px;color:#c26a00">VTE prophylaxis</div>
        <div class="row"><label class="inl">Situation ${sel("vt-ctx", [["medical", "Medical admission"], ["surgery", "After or around IBD surgery"]])}</label>
          <label class="inl"><input type="checkbox" id="vt-flare" checked> Active flare</label>
          <label class="inl">Surgery ${sel("vt-surg", [["colectomy", "Colectomy"], ["major", "Other major abdominal or pelvic"], ["minor", "Minor"]])}</label>
          <label class="inl"><input type="checkbox" id="vt-neur"> Epidural or spinal catheter</label></div>
        <div class="row"><label class="inl">Bleeding ${sel("vt-bleed", [["none", "None"], ["rectal", "Rectal bleeding from colitis"], ["severe", "Severe, or unstable"]])}</label>
          <label class="inl">Platelets (x10^9/L) <input type="number" id="vt-plt" min="0"></label>
          <label class="inl">CrCl (mL/min) <input type="number" id="vt-crcl" min="0"></label>
          <label class="inl">Weight (kg) <input type="number" id="vt-kg" min="0"></label>
          <label class="inl"><input type="checkbox" id="vt-prior"> Prior VTE</label><span class="muted" id="vt-src"></span></div>
        <div id="vt-out"></div></div>`;
    const g = (id) => el.querySelector("#" + id), upd = () => {
      const a = vteAdvice({ ctx: g("vt-ctx").value, flare: g("vt-flare").checked, surg: g("vt-surg").value, neuraxial: g("vt-neur").checked, bleed: g("vt-bleed").value, plt: g("vt-plt").value, crcl: g("vt-crcl").value, kg: g("vt-kg").value, prior: g("vt-prior").checked });
      g("vt-out").innerHTML = `<div style="font-weight:700;color:${LV[a.level]};margin:6px 0 2px">${esc(a.head)}</div><ul style="margin:0;padding-left:18px;font-size:13px">${a.lines.map((l) => `<li>${esc(l)}</li>`).join("")}</ul>`;
    };
    el.addEventListener("input", (e) => { if (e.target.id === "vt-plt" && e.isTrusted) delete e.target.dataset.chart; upd(); }); el.addEventListener("change", upd); upd();
  }
  /* Fill platelets from the chart read; typed values are kept. Shows the latest creatinine as a hint (CrCl needs weight and age: enter by hand). */
  function update(f, now) {
    if (typeof document === "undefined") return; now = now || Date.now();
    const el = document.getElementById("vte"); if (!el || !el.querySelector("#vt-plt")) return;
    const v = el.querySelector("#vt-plt"), tag = el.querySelector("#vt-src"), mine = v.value !== "" && !v.dataset.chart;
    const last = (id) => f && f.labs && (f.labs[id] || []).filter((x) => x.v != null).sort((a, b) => b.t - a.t)[0];
    const p = last("plt"), c = last("creat");
    if (!mine) { if (p) { v.value = Math.round(p.v); v.dataset.chart = "1"; } else { v.value = ""; delete v.dataset.chart; } v.dispatchEvent(new Event("input", { bubbles: true })); }
    tag.textContent = f ? [p ? "platelets from chart " + day(p.t) : "no platelets in chart", c ? "creatinine " + Math.round(c.v) + " umol/L (" + day(c.t) + ")" : ""].filter(Boolean).join("; ") : "";
  }
  root.IBDVte = { vteAdvice, render, update, PLT_HOLD };
  if (typeof module !== "undefined" && module.exports) module.exports = root.IBDVte;
  if (typeof document !== "undefined") { const go = () => { const el = document.getElementById("vte"); if (el) render(el); }; if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", go); else go(); }
})(typeof window !== "undefined" ? window : globalThis);
