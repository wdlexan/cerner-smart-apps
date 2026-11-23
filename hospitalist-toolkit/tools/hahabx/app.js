/* Hospital at Home IV antibiotic options - UI. Read-only. UNVERIFIED draft. */
(function () {
  const $ = (id) => document.getElementById(id), H = window.HahAbx;
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const cc = (c) => (c && (c.text || ((c.coding || [])[0] || {}).display)) || "";
  const state = { orders: null };
  const limit = () => +$("limit").value || 2;

  function verdictHtml(v) {
    const alts = (v.alts || []).length ? `<div class="small">Home-friendly alternatives (if the organism is susceptible): ${v.alts.map((a) => `<b>${esc(a.d.name)}</b> – ${esc(a.how.toLowerCase())}: ${esc(a.txt)}`).join("; ")}</div>` : "";
    return `<span class="pill ${v.level}">${esc(v.head)}</span>${v.detail ? `<div class="small" style="margin-top:3px">${esc(v.detail)}</div>` : ""}${alts}`;
  }
  function drawPt() {
    if (!state.orders) return;
    const iv = state.orders.filter((o) => H.ABX_RE.test(o.name));
    if (!iv.length) { $("ptOut").innerHTML = '<span class="muted">No active antibiotic orders found.</span>'; return; }
    $("ptOut").innerHTML = `<table><tr><th>Order</th><th>Doses/day</th><th>At home</th></tr>${iv.map((o) => { const v = H.judge(o, limit());
      return `<tr><td><b>${esc(o.name)}</b><div class="small muted">${esc([o.text, o.route].filter(Boolean).join(" · "))}</div></td><td>${v.freq ? (v.freq.cont ? "continuous" : v.freq.perDay) : "?"}</td><td>${verdictHtml(v)}</td></tr>`; }).join("")}</table>`;
  }
  function drawOrder() {
    const t = $("orderTxt").value.trim(); if (!t) { $("orderOut").innerHTML = ""; return; }
    const d = H.drugOf(t);
    $("orderOut").innerHTML = d || /\biv\b/i.test(t) ? verdictHtml(H.judge({ name: d ? d.name : t, text: t, route: /\bpo\b|oral/i.test(t) ? "PO" : "IV" }, limit())) : '<span class="muted small">Antibiotic not recognized.</span>';
  }
  function drawOpt() {
    const rows = H.options($("scen").value, limit());
    $("optOut").innerHTML = rows.length ? `<table><tr><th>Antibiotic</th><th>How at home</th><th>Regimen</th></tr>${rows.map((r) => `<tr><td><b>${esc(r.d.name)}</b>${r.d.why ? `<div class="small muted">${esc(r.d.why)}</div>` : ""}</td><td><span class="pill ${r.how === "Nurse bolus" || r.how === "Oral" ? "ok" : r.how === "24-h elastomeric" ? "elasto" : "pharm"}">${esc(r.how)}</span></td><td>${esc(r.txt)}</td></tr>`).join("")}</table>
      <div class="small muted" style="margin-top:4px">Pick by susceptibility and source first; this list only ranks by how easy the regimen is at home.</div>` : '<span class="muted">No home option listed – discuss with ID / HaH pharmacy.</span>';
  }
  function drawRef() {
    $("elastoOut").innerHTML = `<table><tr><th>Antibiotic</th><th>Typical 24-h dose</th><th>Notes</th></tr>${H.DRUGS.filter((d) => d.mode === "elasto").map((d) => `<tr><td><b>${esc(d.name)}</b></td><td>${esc(d.elasto)}</td><td class="small">${esc(d.why || "")}</td></tr>`).join("")}</table>`;
  }
  const redraw = () => { drawPt(); drawOrder(); drawOpt(); };

  H.SCEN.forEach(([k, l]) => { const o = document.createElement("option"); o.value = k; o.textContent = l; $("scen").appendChild(o); });
  $("scen").onchange = drawOpt; $("limit").onchange = redraw; $("orderBtn").onclick = drawOrder; $("orderTxt").onkeydown = (e) => e.key === "Enter" && drawOrder();

  const SAMPLES = [
    { label: "ESBL E. coli pyelo on meropenem", orders: [{ name: "meropenem", text: "1 g IV q8h", route: "IV" }, { name: "acetaminophen", text: "1 g PO q6h", route: "PO" }] },
    { label: "MSSA bacteremia on cloxacillin", orders: [{ name: "cloxacillin", text: "2 g IV q4h", route: "IV" }] },
    { label: "Pseudomonas, pip-tazo + vanco", orders: [{ name: "piperacillin-tazobactam", text: "4.5 g IV q6h", route: "IV" }, { name: "vancomycin", text: "1.25 g IV q12h", route: "IV" }] },
    { label: "Cellulitis on cefazolin q8h", orders: [{ name: "cefazolin", text: "2 g IV q8h", route: "IV" }] },
    { label: "Imipenem + metronidazole PO", orders: [{ name: "imipenem", text: "500 mg IV q6h", route: "IV" }, { name: "metronidazole", text: "500 mg PO BID", route: "PO" }] }];
  SAMPLES.forEach((s, i) => { const o = document.createElement("option"); o.value = i; o.textContent = s.label; $("demo").appendChild(o); });
  $("demo").onchange = () => { const s = SAMPLES[$("demo").value]; if (!s) return; state.orders = s.orders; $("ptBanner").textContent = "Made-up patient"; drawPt(); };

  async function fromChart() {
    if (typeof FHIR === "undefined" || !(location.search.includes("code=") || location.search.includes("complete=") || sessionStorage.getItem("SMART_KEY"))) { $("ptBanner").textContent = "Not connected to a chart"; return; }
    $("pstatus").textContent = "Reading the chart…";
    try {
      const client = await FHIR.oauth2.ready(), pid = client.patient.id;
      const [pt, meds] = await Promise.all([client.patient.read().catch(() => null), client.request(`MedicationRequest?patient=${pid}&status=active&_count=100`, { pageLimit: 5, flat: true })]);
      if (pt) { const n = (pt.name || [])[0] || {}; $("ptBanner").textContent = [(n.text || [(n.given || []).join(" "), n.family].join(" ")).trim(), pt.birthDate ? "DOB " + pt.birthDate : ""].filter(Boolean).join(" · "); }
      state.orders = (meds || []).map((m) => {
        let name = cc(m.medicationCodeableConcept);
        if (!name && m.medicationReference) { const r = m.medicationReference.reference || ""; const c = (m.contained || []).find((x) => "#" + x.id === r); name = c ? cc(c.code) : m.medicationReference.display || ""; }
        const di = (m.dosageInstruction || [])[0] || {};
        return { name, text: di.text || "", timing: di.timing, route: cc(di.route) };
      }).filter((o) => o.name);
      $("pstatus").textContent = "Chart read (read-only).";
      drawPt();
    } catch (e) { $("pstatus").textContent = "Could not read the chart: " + (e.message || e) + ". The made-up patients still work."; }
  }
  drawRef(); drawOpt(); fromChart();
  const demo = new URLSearchParams(location.search).get("demo"); if (demo && SAMPLES[+demo - 1]) { $("demo").value = +demo - 1; $("demo").onchange(); }
})();
