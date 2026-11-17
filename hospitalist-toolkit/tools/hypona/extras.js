/* Hyponatremia tab — interactive add-on (needs interact.js, loaded after app.js). UNVERIFIED draft written by Claude.
   Adds: sodium chart with hover / click / zoom and treatment markers; countdowns (next sodium check, when the ceiling rises);
   weight shared with the other tabs; ✓/✗ on chart-ticked risk factors; printable patient handout. app.js is unchanged. */
(function () {
  if (!window.Interact) return;
  const I = window.Interact, HRMS = 36e5;
  const pid = () => I.smartPatientId() || ($("testsel") && $("testsel").value ? "sample-" + $("testsel").value : "none");

  /* ---- chart + countdowns, drawn after the original trend ---- */
  const origTrend = window.drawTrend;
  window.drawTrend = function (x) {
    origTrend(x);
    const f = state.f; if (!f || !x.last) return;
    const now = Date.now();
    const ceilNow = x.st && x.st.c ? x.st.c.v : Infinity;
    const lab = x.na.filter((e) => e.src !== "gas").map((e) => ({ t: e.t, v: e.v, unit: "mmol/L", src: "lab", flag: e.v > ceilNow }));
    const gas = x.na.filter((e) => e.src === "gas").map((e) => ({ t: e.t, v: e.v, unit: "mmol/L", src: "blood gas", flag: e.v > ceilNow }));
    const cats = [["hypertonic", "3% saline", "#b42318"], ["tolvaptan", "Tolvaptan", "#7c3aed"], ["desmo", "DDAVP", "#0f766e"], ["urea", "Urea", "#a15c00"], ["salttab", "Salt tabs", "#a15c00"]];
    const markers = [];
    cats.forEach(([c, label, color]) => (C.recent(f, c, 7, now) || []).forEach((m) => { if (m.t) markers.push({ t: m.t, label, color }); }));
    const ceil = x.st && x.st.c ? x.st.c.v : null;
    const el = $("spark");
    el.innerHTML = "";
    I.chart(el, {
      title: "Sodium", now, markers,
      series: [{ label: "Sodium (lab)", color: "#1d5fa8", points: lab }].concat(gas.length ? [{ label: "Sodium (blood gas)", color: "#94a3b8", points: gas, dash: true }] : []),
      limits: ceil ? [{ v: ceil, label: "ceiling " + ceil }] : [],
      ranges: [["48 h", 2 * DAY], ["7 d", 7 * DAY], ["14 d", 14 * DAY]],
      onPick: (se, q) => I.showSource({ title: "Sodium " + q.v + " (" + q.src + ")", date: new Date(q.t).toLocaleString(),
        text: "Sodium from the chart: " + q.v + " mmol/L, " + q.src + ".\nHighest allowed now: " + (ceil != null ? ceil : "not set") + ".\nRise from the lowest value in the prior 24 h is in the table below." })
    });
    el.insertAdjacentHTML("afterbegin", countdowns(x, now));
    const sel = $("ix-every"); if (sel) sel.onchange = () => { window.__hyNext = +sel.value; draw(); };
    const al = $("ix-alerts"); if (al) al.onclick = async () => ($("ix-alertmsg").textContent = await I.enableAlerts());
    const ho = $("ix-handout"); if (ho) ho.onclick = () => handout(x);
    I.startTicker();
  };
  function countdowns(x, now) {
    const st = x.st, hyper = (x.meds.hypertonic || []).length > 0;
    const auto = st && (st.over || st.near) ? 2 : hyper || $("symptoms").value === "severe" ? 2 : st && st.rt && st.rt.perH > 0 ? 4 : 6;
    const every = window.__hyNext || auto;
    const next = x.last.t + every * HRMS;
    const rows = [`<tr><td>Next sodium check</td><td><span data-due="${next}" data-label="Sodium check"></span></td><td><select id="ix-every">${[2, 4, 6, 12, 24].map((h) => `<option value="${h}"${h === every ? " selected" : ""}>every ${h} h${h === auto ? " (suggested)" : ""}</option>`).join("")}</select></td><td class="muted">from the last value at ${new Date(x.last.t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</td></tr>`];
    if (st && st.c && st.c.until > now) rows.push(`<tr><td>Ceiling (${st.c.v}) rises</td><td><span data-due="${st.c.until}" data-label="Sodium ceiling rises"></span></td><td></td><td class="muted">when the value of ${st.c.from.v} leaves its ${st.c.win} h window</td></tr>`);
    if (st && st.hoursToCeiling != null && st.hoursToCeiling > 0) rows.push(`<tr><td>Ceiling reached at the current rate</td><td><span data-due="${x.last.t + st.hoursToCeiling * HRMS}" data-label="Sodium reaches the ceiling"></span></td><td></td><td class="muted">+${Math.round(st.rt.perH * 10) / 10} per h</td></tr>`);
    return `<div style="margin-bottom:8px"><table>${rows.join("")}</table>
      <div class="row"><button type="button" class="btn" id="ix-alerts" style="font-size:12px">Turn on pop-up alerts</button><span class="muted" id="ix-alertmsg">Countdowns update every 30 s while this page is open.</span>
      <button type="button" class="btn" id="ix-handout" style="font-size:12px">Patient handout</button></div></div>`;
  }

  /* ---- weight typed once, shared with the other tabs ---- */
  const origLoad = window.load;
  window.load = function (raw, note, errors, preset) {
    origLoad(raw, note, errors, preset);
    const w = I.shared.get(pid(), "weightKg");
    if (w != null && raw) { $("wt").value = w; draw(); }
  };
  $("wt").addEventListener("input", () => { const v = parseFloat($("wt").value); I.shared.set(pid(), "weightKg", isFinite(v) ? v : "", "Hyponatremia"); });
  I.shared.on((p, key) => { if (p === pid() && key === "weightKg" && document.activeElement !== $("wt")) { const w = I.shared.get(p, key); if (w != null) { $("wt").value = w; draw(); } } });

  /* ---- ✓/✗ beside risk factors ticked from the chart ---- */
  const origRisk = window.drawRisk;
  window.drawRisk = function (x) {
    origRisk(x);
    document.querySelectorAll("[data-risk]").forEach((cb) => {
      const k = cb.dataset.risk; if (!state.auto[k]) return;
      cb.parentElement.insertAdjacentHTML("beforeend", I.voteButtons("hypona", k, k + " | " + (x.last ? "Na " + x.last.v : "")));
    });
  };

  /* ---- patient handout ---- */
  function handout(x) {
    const cause = x.cause ? x.cause.label : "";
    I.handout("Low sodium (hyponatremia): information for patients", `
      <h2>What it means</h2><p>Sodium is a salt in the blood. When it is low, the body has too much water compared with salt. It can cause tiredness, headache, nausea, unsteadiness, falls and confusion; very low levels can cause seizures.</p>
      <h2>Why it is corrected slowly</h2><p>Raising sodium too fast can injure the brain, so the team checks blood tests often and limits how fast it rises. That is why you may have frequent blood tests.</p>
      ${cause === "siad" ? `<h2>Fluid restriction</h2><p>Your team may ask you to limit all drinks (water, tea, coffee, soup, juice, milk) to the amount they give you — often about 1 to 1.5 litres a day. Use a marked bottle to keep track, sip slowly, and suck ice chips or sugar-free candy for thirst.</p>` : ""}
      <h2>Medicines</h2><p>Some medicines lower sodium (for example some water pills, antidepressants and seizure medicines). Do not stop a medicine on your own — ask your doctor or pharmacist.</p>
      <h2>After you go home</h2><ul><li>Have the blood test your doctor orders, usually within a few days.</li><li>Avoid drinking large amounts of water or beer at once.</li><li>Get help right away for new confusion, severe headache, vomiting, a fall, or a seizure.</li></ul>`);
  }
})();
