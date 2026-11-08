/* Second look UI for the Watch-ahead tab. Uses $, esc, state and dxList from app.js (loaded after this file; nothing here runs at load).
   Logic and wording live in secondlook.js. Nothing is sent anywhere; ticks and typed text are not saved. Only the role choice is remembered in this browser. */
function slState() {
  if (!state.sl) {
    let role = "mrp"; try { role = localStorage.getItem("wa-sl-role") || "mrp"; } catch (e) {}
    state.sl = { role, service: "ortho", consulted: [], question: "", situation: "reasoning", talkTo: "", fill: {}, ticks: {} };
  }
  return state.sl;
}
function slTalkTo() {
  const s = slState();
  if (s.role === "mrp") return s.consulted.includes(s.talkTo) ? s.talkTo : s.consulted[0] || s.talkTo || "other";
  return s.service;
}
const slOpts = (sel) => Object.entries(WASL.SERVICES).map(([k, v]) => `<option value="${k}"${k === sel ? " selected" : ""}>${esc(v.label)}</option>`).join("");

function drawRole() {
  const s = slState(), chips = $("rolechips"), box = $("roledetail");
  chips.innerHTML = Object.entries(WASL.ROLES).map(([k, r]) => `<button class="chip" data-r="${k}" aria-pressed="${k === s.role}">${esc(r.label)}</button>`).join("");
  chips.querySelectorAll("button").forEach((b) => (b.onclick = () => { s.role = b.dataset.r; try { localStorage.setItem("wa-sl-role", s.role); } catch (e) {} drawRole(); drawSL(); }));
  if (s.role === "mrp") {
    box.innerHTML = `<div class="muted" style="margin-top:6px">Which services are consulted? (tick all)</div><div class="chips" id="consulted">${Object.entries(WASL.SERVICES).map(([k, v]) =>
      `<button class="chip" data-s="${k}" aria-pressed="${s.consulted.includes(k)}">${esc(v.label)}</button>`).join("")}</div>`;
    box.querySelectorAll("#consulted button").forEach((b) => (b.onclick = () => {
      const k = b.dataset.s; s.consulted = s.consulted.includes(k) ? s.consulted.filter((x) => x !== k) : s.consulted.concat(k); drawRole(); drawSL();
    }));
  } else {
    const q = s.role === "consult";
    box.innerHTML = `<div style="margin-top:8px;display:flex;flex-wrap:wrap;gap:10px;align-items:center">
      <label class="muted">${q ? "Who consulted you?" : "Co-managing with"} <select id="slsvc">${slOpts(s.service)}</select></label>
      ${q ? `<label class="muted" style="flex:1;min-width:260px">Consult question <input id="slq" type="text" value="${esc(s.question)}" placeholder="e.g. pre-op medical assessment, hip fracture" style="width:100%;font-size:13px;padding:5px 8px;border:1px solid var(--line);border-radius:6px;background:var(--card);color:var(--ink)"></label>` : ""}</div>`;
    $("slsvc").onchange = (e) => { s.service = e.target.value; drawSL(); };
    if (q) $("slq").oninput = (e) => { s.question = e.target.value; };
  }
}

function drawSL() {
  const s = slState(), box = $("sl");
  if (!box) return;
  const f = state.f, dx = typeof dxList === "function" ? dxList().filter((x) => x.on).map((x) => x.d.title) : [];
  const bias = WASL.biasPrompts(s.role, f, state.cards, dx);
  const miss = WASL.missing(f, s.role, state.cards);
  const talk = slTalkTo(), svc = WASL.SERVICES[talk] || WASL.SERVICES.other;
  const checks = WASL.checklist(s.role, s.role === "mrp" ? (s.consulted.includes("ortho") ? "ortho" : s.consulted[0]) : s.service);
  const talkSel = s.role === "mrp" && s.consulted.length > 1
    ? `<label class="muted">Talking to <select id="sltalk">${s.consulted.map((k) => `<option value="${k}"${k === talk ? " selected" : ""}>${esc(WASL.SERVICES[k].label)}</option>`).join("")}</select></label>`
    : s.role === "mrp" && !s.consulted.length ? `<label class="muted">Talking to <select id="sltalk">${slOpts(talk)}</select></label>` : `<span class="muted">Talking to <b>${esc(svc.label)}</b></span>`;
  const field = (k, ph) => `<label class="muted" style="display:block;margin-top:6px">${ph}<input data-fill="${k}" type="text" value="${esc(s.fill[k] || "")}" style="width:100%;font-size:13px;padding:5px 8px;border:1px solid var(--line);border-radius:6px;background:var(--card);color:var(--ink)"></label>`;

  box.innerHTML = `
  <details class="card" style="margin-bottom:8px" open><summary><div class="title">Bias check (${esc(WASL.ROLES[s.role].short)})</div><span class="badge low">REFLECT</span></summary><div class="body">
    <ul>${bias.map((b) => `<li><span class="if">${esc(b.trap)}:</span> ${esc(b.ask)}${b.from ? ' <span class="muted">(from the chart)</span>' : ""}</li>`).join("")}</ul></div></details>

  <details class="card" style="margin-bottom:8px"${miss.length ? " open" : ""}><summary><div class="title">What may be missing</div><span class="badge ${miss.length ? "med" : "low"}">${miss.length ? miss.length + " TO CHECK" : "CHECKLIST"}</span></summary><div class="body">
    ${!f ? '<div class="muted">Open a chart or a made-up patient to check the data.</div>' : miss.length ? `<div class="lab">From the chart</div><ul>${miss.map((m) => `<li><span class="if">${esc(m.kind)}:</span> ${esc(m.text)}${m.from ? `<div class="muted">${esc(m.from)}</div>` : ""}</li>`).join("")}</ul>` : '<div class="okbox">Nothing unexplained found in the data read. The problem list may still be incomplete.</div>'}
    <div class="lab">Things the chart can't show (ticks are not saved)</div>
    <ul style="list-style:none;padding-left:0">${checks.map((c, i) => `<li><label><input type="checkbox" data-tick="${esc(c)}"${s.ticks[c] ? " checked" : ""}> ${esc(c)}</label></li>`).join("")}</ul>
    <div class="src"><span class="unv">UNVERIFIED</span>Matched by problem-list words and drug names only. A missing match often means the problem list is incomplete, not that the care is wrong.</div></div></details>

  <details class="card" style="margin-bottom:8px" open><summary><div class="title">Raising a concern with ${esc(svc.label)}</div><span class="badge low">COMMUNICATE</span></summary><div class="body">
    <div style="display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin-top:8px">${talkSel}
      <label class="muted">Situation <select id="slsit">${Object.entries(WASL.SITUATIONS).map(([k, v]) => `<option value="${k}"${k === s.situation ? " selected" : ""}>${esc(v)}</option>`).join("")}</select></label></div>
    <div class="lab">Where disagreements with ${esc(svc.label)} usually happen</div><ul>${svc.friction.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
    <div class="lab">Fill in (optional, not saved)</div>
    ${field("patient", "Patient and room")}${field("concern", "Your concern, one sentence")}${field("data", "Key facts (vitals, labs, exam)")}${field("ask", "What you need from them")}${field("background", "Background (for the written message)")}
    <div class="lab">What to say (phone or in person)</div><div id="slscript"></div>
    ${s.situation === "urgent" ? '<div class="banner" style="margin-top:8px">Urgent concerns: <b>call</b>, don\'t message. If the patient is in danger now, call a rapid response.</div>' : `<div class="lab">Written follow-up (Teams, non-urgent only)</div><pre id="slsbar" style="white-space:pre-wrap;font-size:12.5px;margin:4px 0;border:1px solid var(--line);border-radius:8px;padding:8px"></pre><button id="slcopy">Copy message</button> <span class="muted" id="slcopied"></span>`}
    <div class="lab">If it isn't resolved: escalation ladder</div><ol style="margin:4px 0 0;padding-left:20px">${WASL.LADDER.map((x) => `<li style="margin:4px 0">${esc(x)}</li>`).join("")}</ol>
    <div class="lab">Avoid</div><ul>${WASL.AVOID.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
    <div class="src"><span class="unv">DRAFT</span>Based on common teaching: CMPA guidance on team communication and speaking up, TeamSTEPPS (SBAR, CUS, two-challenge rule). Edit secondlook.js to match your service's norms.</div></div></details>`;

  box.querySelectorAll("[data-tick]").forEach((x) => (x.onchange = () => { s.ticks[x.dataset.tick] = x.checked; }));
  box.querySelectorAll("[data-fill]").forEach((x) => (x.oninput = () => { s.fill[x.dataset.fill] = x.value; drawScript(); }));
  $("slsit").onchange = (e) => { s.situation = e.target.value; drawSL(); };
  if ($("sltalk")) $("sltalk").onchange = (e) => { s.talkTo = e.target.value; drawSL(); };
  if ($("slcopy")) $("slcopy").onclick = () => navigator.clipboard.writeText($("slsbar").textContent).then(() => ($("slcopied").textContent = "Copied."), () => ($("slcopied").textContent = "Could not copy."));
  drawScript();
}
function drawScript() {
  const s = slState(), t = slTalkTo();
  $("slscript").innerHTML = `<ol style="margin:4px 0 0;padding-left:20px">${WASL.script(s.role, t, s.situation, s.fill).map((x) => `<li style="margin:4px 0">${esc(x)}</li>`).join("")}</ol>`;
  if ($("slsbar")) $("slsbar").textContent = WASL.sbar(s.role, t, s.fill);
}
function slText() {
  const s = slState(), checks = WASL.checklist(s.role, s.role === "mrp" ? (s.consulted.includes("ortho") ? "ortho" : s.consulted[0]) : s.service);
  return WASL.asText({ role: s.role, service: s.role === "mrp" ? "" : s.service, consulted: s.role === "mrp" ? s.consulted : [], question: s.role === "consult" ? s.question : "",
    missing: WASL.missing(state.f, s.role, state.cards), unticked: checks.filter((c) => !s.ticks[c]) });
}
function slRoleLine() {
  const s = slState();
  if (s.role === "mrp") return "Hospitalist role: MRP" + (s.consulted.length ? "; consulted services: " + s.consulted.map((k) => WASL.SERVICES[k].label).join(", ") : "");
  return `Hospitalist role: ${s.role === "consult" ? "consultant, asked by " : "co-managing with "}${WASL.SERVICES[s.service].label}${s.role === "consult" && s.question ? "; consult question: " + s.question : ""}`;
}
