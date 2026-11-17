/* Liver tab — interactive add-on (needs interact.js, loaded after app.js). UNVERIFIED draft written by Claude.
   Adds: trend chart you can switch between MELD-Na, bilirubin, creatinine, INR, sodium and albumin, with hover / click / zoom and markers
   for paracentesis, albumin, terlipressin, midodrine/octreotide and vasopressors; weight entered in another tab is used if the chart has none;
   printable patient handout. app.js is unchanged. */
(function () {
  if (!window.Interact) return;
  const I = window.Interact;
  const pid = () => I.smartPatientId() || ($("testsel") && $("testsel").value ? "sample-" + $("testsel").value : "none");
  const SERIES = [
    { id: "meld", label: "MELD-Na", color: "#7c3aed", limits: [{ v: 15, label: "15", color: "#a15c00" }, { v: 20, label: "20" }] },
    { id: "bili", label: "Bilirubin", unit: "µmol/L", color: "#a15c00" },
    { id: "creat", label: "Creatinine", unit: "µmol/L", color: "#b42318" },
    { id: "inr", label: "INR", unit: "", color: "#1d5fa8" },
    { id: "na", label: "Sodium", unit: "mmol/L", color: "#0f766e", limits: [{ v: 130, label: "130" }] },
    { id: "alb", label: "Albumin", unit: "g/L", color: "#475569" }
  ];
  let pick = "meld";

  function meldPoints(f) {
    const ends = new Map();
    C.LABS.forEach((d) => (f.labs[d.id] || []).forEach((e) => { const k = new Date(e.t).toDateString(); if (!ends.has(k) || e.t > ends.get(k)) ends.set(k, e.t); }));
    return [...ends.values()].map((t) => { const { x } = inputs(f, t); const r = results(x); return r.m && r.m.meldNa != null ? { t, v: r.m.meldNa, unit: "" } : null; }).filter(Boolean);
  }
  function points(f, id) {
    if (id === "meld") return meldPoints(f);
    const s = SERIES.find((x) => x.id === id);
    return (f.labs[id] || []).map((e) => ({ t: e.t, v: Math.round(e.v * 10) / 10, unit: s.unit }));
  }
  function markers(f) {
    const out = [];
    (f.taps || []).forEach((t) => out.push({ t: t.t, label: "Tap", color: "#0f766e" }));
    (state.manualTaps || []).forEach((t) => out.push({ t: t.t, label: "Tap", color: "#0f766e" }));
    (f.albumin || []).forEach((a) => out.push({ t: a.t, label: "Albumin" + (a.g ? " " + a.g + " g" : ""), color: "#475569" }));
    (f.medList || []).filter((m) => m.t && m.cats.some((c) => ["terlipressin", "midodrine", "octreotide", "norepinephrine", "vasopressor"].includes(c)))
      .forEach((m) => out.push({ t: m.t, label: m.name.split(" ")[0], color: "#b42318" }));
    return out;
  }

  const origTrend = window.drawTrend;
  window.drawTrend = function (f) {
    origTrend(f);
    if (!f) return;
    const avail = SERIES.filter((s) => points(f, s.id).length);
    if (!avail.length) return;
    if (!avail.some((s) => s.id === pick)) pick = avail[0].id;
    const s = SERIES.find((x) => x.id === pick), pts = points(f, pick), now = Date.now();
    const el = $("spark");
    el.innerHTML = "";
    if (!el.__ixSpan) el.__ixSpan = 30 * DAY;
    I.chart(el, { title: s.label, now, series: [{ label: s.label, color: s.color, points: pts }], limits: s.limits || [], markers: markers(f),
      ranges: [["7 d", 7 * DAY], ["30 d", 30 * DAY], ["90 d", 90 * DAY], ["1 y", 365 * DAY]],
      onPick: (se, q) => I.showSource({ title: s.label + " " + q.v + (q.unit ? " " + q.unit : ""), date: new Date(q.t).toLocaleString(),
        text: pick === "meld" ? "MELD-Na calculated from that day's latest bilirubin, creatinine, INR and sodium (see the table below for the values)." : s.label + " from the chart: " + q.v + " " + (q.unit || "") }) });
    el.insertAdjacentHTML("afterbegin", `<div class="row" style="margin-bottom:4px">${avail.map((x) => `<label class="inl"><input type="radio" name="ix-lv" value="${x.id}"${x.id === pick ? " checked" : ""}> ${x.label}</label>`).join(" ")}
      <button type="button" class="btn" id="ix-lv-ho" style="font-size:12px;margin-left:auto">Patient handout</button></div>`);
    el.querySelectorAll("input[name=ix-lv]").forEach((r) => (r.onchange = () => { pick = r.value; draw(); }));
    $("ix-lv-ho").onclick = handout;
  };

  /* weight typed in another tab is used when the chart has none */
  const origLoad = window.load;
  window.load = function (raw, note, errors, preset) {
    origLoad(raw, note, errors, preset);
    const w = I.shared.get(pid(), "weightKg");
    if (state.f && w != null && !(state.f.weights || []).length) { state.f.weights.push({ t: Date.now(), v: +w, src: "entered in another tab" }); draw(); }
  };

  function handout() {
    I.handout("Living with cirrhosis: information for patients", `
      <h2>What it is</h2><p>Cirrhosis is scarring of the liver. The liver still does important work, and the right care can keep you well longer and out of hospital.</p>
      <h2>Every day</h2><ul><li><b>No alcohol</b> at all — it is the single most important step if alcohol played a part.</li><li><b>Low salt:</b> less than 2 grams of sodium a day if you have fluid in the belly or legs. Avoid processed and restaurant food; read labels.</li>
      <li><b>Eat enough protein</b> and have a bedtime snack — do not cut protein unless your team says so.</li><li><b>Avoid</b> ibuprofen, naproxen and other anti-inflammatories; acetaminophen (Tylenol) up to 2 grams a day is usually safe — ask first.</li>
      <li>If you take <b>lactulose</b>, aim for 2–3 soft bowel movements a day.</li><li>Weigh yourself every morning if you take water pills, and write it down.</li></ul>
      <h2>Get help right away for</h2><ul><li>Fever, belly pain or a tender, swollen belly.</li><li>New confusion, very sleepy, or shaky hands.</li><li>Vomiting blood, or black or bloody stools.</li><li>Yellow skin or eyes getting worse, or passing very little urine.</li><li>Weight up more than 1 kg a day for 2 days, or 2 kg in a week.</li></ul>
      <h2>Follow-up</h2><ul><li>Blood tests as your doctor orders.</li><li>Liver ultrasound every 6 months to check for liver cancer.</li><li>Vaccines (hepatitis A and B, flu, pneumonia) if you have not had them.</li></ul>`,
      { meds: (state.f && state.f.medList || []).map((m) => m.name), conds: state.f ? state.f.problems || [] : [], age: state.f ? state.f.age : null });
  }
})();
