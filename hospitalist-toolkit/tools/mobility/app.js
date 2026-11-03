/* Mobility and discharge page. Read-only. UNVERIFIED draft: everything comes from phrase-matching in notes. */
const R = window.MobRules, C = window.MobChart, DAY = C.DAY;
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const fmtD = (t) => new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric" });
const fmtDT = (t) => new Date(t).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
const AIDNAME = Object.fromEntries(R.AIDS.map(([id, name]) => [id, name]));
const aidText = (a) => (a && a.length ? a.map((x) => AIDNAME[x] || x).join(" / ").toLowerCase() : "");
const lv = (n) => (n != null ? R.LEVELS[n] : "");
const days = (d) => (d ? (d[0] === d[1] ? d[0] + " day" + (d[0] === 1 ? "" : "s") : d[0] + "-" + d[1] + " days") : "");
const state = { f: null, x: null };

function ctx() {
  const f = state.f, now = Date.now(), x = { now };
  const recs = f.records;
  const last = (pred) => { for (let i = recs.length - 1; i >= 0; i--) if (pred(recs[i])) return recs[i]; return null; };
  x.walk = recs.filter((r) => r.level != null).map((r) => ({ t: r.t, level: r.level, src: r.src }));
  x.cur = last((r) => r.level != null);
  x.curTransfer = last((r) => r.transfer != null);
  x.curAid = last((r) => r.aids && r.aids.length);
  x.curDist = last((r) => r.dist != null);
  const baseRec = last((r) => r.baseline.level != null), baseAidRec = last((r) => r.baseline.aids.length);
  x.base = baseRec ? baseRec.baseline.level : null; x.baseAids = baseAidRec ? baseAidRec.baseline.aids : [];
  x.home = {}; recs.forEach((r) => Object.entries(r.home).forEach(([k, v]) => { if (v != null) x.home[k] = v; }));
  const destRec = last((r) => r.recs.dest); x.recDest = destRec ? destRec.recs.dest : null; x.recDestSrc = destRec;
  x.notSafe = !!last((r) => r.flags.notSafe && now - r.t <= 2 * DAY);
  x.wb = (last((r) => r.wb) || {}).wb || null;
  x.stairs = (last((r) => r.stairs) || {}).stairs || null;
  x.flags = {}; recs.filter((r) => now - r.t <= 3 * DAY).forEach((r) => Object.keys(r.flags).forEach((k) => (x.flags[k] = true)));
  if (f.prob.cognition) x.flags.cognition = true;
  x.noted = {}; recs.forEach((r) => Object.entries(r.recs.equipment).forEach(([id, st]) => { if (x.noted[id] !== "has") x.noted[id] = st; }));
  x.hasPT = recs.some((r) => r.src === "PT"); x.hasOT = recs.some((r) => r.src === "OT");
  x.ptOrdered = f.orders.some((o) => o.kind === "PT" && /active|draft|on-hold/.test(o.status || "active"));
  x.otOrdered = f.orders.some((o) => o.kind === "OT" && /active|draft|on-hold/.test(o.status || "active"));
  // destination and goal
  x.eitherDest = !!(x.recDest && /home/.test(x.recDest) && /(vs\.?|versus|or)/.test(x.recDest) && /rehab|restorative|transitional/.test(x.recDest));
  const autoDest = !x.recDest ? (x.home.facility ? "facility" : "home") : x.eitherDest ? "home" : /rehab|restorative|transitional|convalescent/.test(x.recDest) ? "rehab" : /long|ltc|alternate|alc|assisted/.test(x.recDest) ? "facility" : "home";
  x.dest = $("dest").value === "auto" ? autoDest : $("dest").value; x.destAuto = $("dest").value === "auto";
  x.goal = $("goal").value === "auto" ? R.target(x.base, x.dest) : +$("goal").value;
  x.est = R.estimate(x.walk, x.goal, parseFloat($("dpl").value) || 2, now);
  x.equip = R.equipment({ noted: x.noted, aids: x.curAid ? x.curAid.aids : [], baseAids: x.baseAids, hip: !!f.prob.hip, cur: x.cur && x.cur.level, alone: x.home.alone, facility: x.dest === "facility" || x.home.facility });
  const needEquip = x.equip.filter((e) => e.status !== "has").map((e) => e.name);
  x.todo = R.todo({ hasPT: x.hasPT, hasOT: x.hasOT, cur: x.cur && x.cur.level, equipNeeded: needEquip.length > 0, ortho: !!f.prob.ortho, wb: x.wb, homeSteps: x.home.steps, upstairs: x.home.upstairs, stairs: x.stairs,
    est: x.est, goalLabel: lv(x.goal), curLabel: x.cur ? lv(x.cur.level) : "", equip: needEquip, alone: x.home.alone, facility: x.dest === "facility" || x.home.facility, dest: x.eitherDest ? null : x.recDest, flags: x.flags, morse: f.morse && f.morse.v });
  if (x.eitherDest && $("dest").value === "auto") x.todo.unshift({ what: "Decide home vs rehab / restorative care", why: `PT: \u201c${x.recDest}\u201d. Aiming for home; refer to rehab early if progress stalls (waits are long).`, days: null, kind: "warn" });
  // a PT/OT order already placed is not a to-do, it is a wait
  x.todo.forEach((t) => { if (/^Physiotherapy assessment/.test(t.what) && x.ptOrdered) { t.what += " (ordered, not yet seen)"; t.kind = "wait"; } if (/^Occupational therapy assessment/.test(t.what) && x.otOrdered) { t.what += " (ordered, not yet seen)"; t.kind = "wait"; } });
  x.overall = x.est.status === "plateau" ? null : R.overall(x.todo);
  return x;
}

function tile(cls, k, big, s) { return `<div class="tile ${cls}"><div class="k">${esc(k)}</div><div class="big" style="font-size:20px">${big}</div><div class="s">${s || ""}</div></div>`; }

function summaryText(x) {
  const f = state.f, P = [];
  const homeBits = [x.home.facility ? "lives in a care facility" : x.home.alone === true ? "lives alone" : x.home.alone === false ? "lives with family / partner" : "", x.home.steps ? x.home.steps + " steps to enter" : "", x.home.upstairs ? "bedroom upstairs" : "", x.home.support ? "has home support" : ""].filter(Boolean);
  P.push("<b>Before admission:</b> " + (x.base != null ? lv(x.base).toLowerCase() + (x.baseAids.length ? " (" + aidText(x.baseAids) + ")" : "") : "not found in the notes") + (homeBits.length ? "; " + homeBits.join(", ") : "") + ".");
  if (x.cur) {
    P.push(`<b>Now</b> (${fmtD(x.cur.t)}, ${esc(x.cur.src)}): walking ${lv(x.cur.level).toLowerCase()}${x.curAid ? " with " + aidText(x.curAid.aids) : ""}${x.curDist && x.curDist.t >= x.cur.t - DAY ? ", " + x.curDist.dist + " m" : ""}` +
      (x.curTransfer ? `; transfers ${lv(x.curTransfer.transfer).toLowerCase()}` : "") + (x.wb ? `; ${x.wb}` : "") + `; stairs ${x.stairs === "done" ? "done" : x.stairs === "not done" ? "not yet done" : "not mentioned"}.`);
    const first = x.walk[0];
    if (x.walk.length > 1) P.push(x.cur.level > first.level ? `<b>Progress:</b> ${lv(first.level).toLowerCase()} on ${fmtD(first.t)} → ${lv(x.cur.level).toLowerCase()} now.` : x.est.status === "plateau" ? `<b>Progress:</b> no change since ${fmtD(x.est.since)}.` : `<b>Progress:</b> no improvement yet (${x.walk.length} assessments).`);
  } else P.push("<b>Now:</b> no walking assessment found in the notes this admission" + (x.curTransfer ? `; transfers ${lv(x.curTransfer.transfer).toLowerCase()} (${fmtD(x.curTransfer.t)}, ${esc(x.curTransfer.src)})` : "") + ".");
  const destText = { home: "home", "home-24h": "home with someone there all the time", rehab: "rehab / restorative care", facility: "a care facility" }[x.dest];
  P.push(`<b>Plan:</b> ${destText}${x.destAuto && x.recDest ? " (from " + esc(x.recDestSrc.src) + " note: “" + esc(x.recDest) + "”)" : x.destAuto ? " (assumed: no recommendation found)" : ""}; mobility goal ${x.goal != null ? lv(x.goal).toLowerCase() : "safe transfers for the next setting"}.`);
  const e = x.est;
  const est = e.status === "met" ? "goal already met" : e.status === "plateau" ? "plateaued: time frame unclear until the plan changes" : e.status === "progressing" ? `about ${e.lo}-${e.hi} days to reach the goal (${e.src === "measured" ? "from the progress so far" : "assumed " + ($("dpl").value || 2) + " days per level; no trend yet"})` : e.status === "nogoal" ? "no home mobility goal" : "cannot estimate (no assessment)";
  P.push(`<b>Time frame:</b> mobility ${est}` + (x.overall ? `; with the other steps below, about <b>${days(x.overall)}</b> before discharge-ready.` : "."));
  if (x.eitherDest && x.destAuto) P.push(`<b>Decision needed:</b> PT suggests \u201c${esc(x.recDest)}\u201d; the estimate assumes home.`);
  if (x.notSafe) P.push("<b>Note:</b> a recent note says not yet safe for discharge.");
  return P;
}

function draw() {
  const f = state.f;
  if (!f) { ["tiles", "summary", "todo", "equip", "timeline"].forEach((id) => ($(id).innerHTML = "")); ["sumsum", "todosum", "eqsum", "tlsum", "ptsum"].forEach((id) => ($(id).textContent = "")); state.x = null; MOB_NOTE.update(); return; }
  const x = state.x = ctx(), e = x.est;
  const t = [];
  t.push(x.cur ? tile(x.cur.level >= 7 ? "t0" : x.cur.level >= 5 ? "t1" : x.cur.level >= 3 ? "t2" : "t3", "Walking now", lv(x.cur.level), [x.curAid ? aidText(x.curAid.aids) : "", x.curDist ? x.curDist.dist + " m" : "", fmtD(x.cur.t)].filter(Boolean).join(" · ")) : tile("t2", "Walking now", "Not found", "No PT or nursing mobility entry"));
  t.push(tile("t1", "Before admission", x.base != null ? lv(x.base) : "Not found", x.baseAids.length ? aidText(x.baseAids) : ""));
  t.push(tile({ met: "t0", progressing: "t1", plateau: "t3", nogoal: "t1", none: "t2" }[e.status], "Progress", { met: "Goal met", progressing: "Improving", plateau: "Plateau", nogoal: "–", none: "No data" }[e.status] || "–", x.goal != null ? "Goal: " + lv(x.goal) : "Goal: safe transfers"));
  t.push(tile(x.overall ? (x.overall[1] > 7 ? "t2" : "t1") : e.status === "met" && !x.todo.length ? "t0" : "t2", "Time frame", x.overall ? days(x.overall) : e.status === "met" && !x.todo.length ? "Ready" : "Unclear",
    e.status === "progressing" ? `mobility ${e.lo}-${e.hi} d (${e.src === "measured" ? "from progress so far" : "assumed rate"})` : e.status === "plateau" ? "plateau: depends on the new plan" : ""));
  $("tiles").innerHTML = t.join("");
  $("summary").innerHTML = summaryText(x).map((p) => `<div style="margin:4px 0">${p}</div>`).join("");
  $("sumsum").textContent = f.records.length + " entr" + (f.records.length === 1 ? "y" : "ies") + " from notes and charting";
  // to-do
  const kindChip = { action: "", mobility: "c-rec", warn: "c-no", wait: "c-unknown" };
  $("todo").innerHTML = x.todo.length ? `<table><tr><th>Step</th><th>Why</th><th>Rough time</th></tr>` + x.todo.map((s) => `<tr><td class="wrap"><span class="chip ${kindChip[s.kind] || ""}">${{ action: "To do", mobility: "Mobility", warn: "Review", wait: "Waiting" }[s.kind]}</span> ${esc(s.what)}</td><td class="wrap muted">${esc(s.why)}</td><td>${s.days ? days(s.days) : s.kind === "warn" ? "varies" : ""}</td></tr>`).join("") + "</table>"
    : '<div class="muted">Nothing outstanding found.</div>';
  $("todosum").textContent = x.todo.length + " step" + (x.todo.length === 1 ? "" : "s") + (x.overall ? " · about " + days(x.overall) : "");
  // equipment
  const st = { recommended: ["c-rec", "Recommended"], suggested: ["c-unknown", "Suggested"], has: ["c-yes", "Already has"] };
  $("equip").innerHTML = x.equip.length ? `<table><tr><th>Item</th><th>Status</th><th>Source</th></tr>` + x.equip.map((q) => `<tr><td>${esc(q.name)}</td><td><span class="chip ${st[q.status][0]}">${st[q.status][1]}</span></td><td class="muted">${esc(q.src)}</td></tr>`).join("") + "</table>" : '<div class="muted">No equipment mentioned or suggested.</div>';
  $("eqsum").textContent = x.equip.filter((q) => q.status !== "has").length + " to arrange";
  // timeline
  const rows = [...f.records].reverse().map((r, i) => `<tr><td>${fmtDT(r.t)}</td><td>${esc(r.src)}${r.author ? "<br><span class='muted'>" + esc(r.author) + "</span>" : ""}</td><td>${r.level != null ? lv(r.level) : ""}</td><td>${esc(aidText(r.aids))}</td><td class="num">${r.dist != null ? r.dist + " m" : ""}</td><td>${r.transfer != null ? lv(r.transfer) : ""}</td><td>${r.stairs || ""}</td>
    <td class="wrap"><details class="q"><summary>${esc((r.quote || r.title || "").slice(0, 70))}${(r.quote || "").length > 70 ? "…" : ""}</summary><pre>${esc(r.text)}</pre></details></td></tr>`);
  $("timeline").innerHTML = rows.length ? `<table><tr><th>When</th><th>Source</th><th>Walking</th><th>Aid</th><th>Distance</th><th>Transfers</th><th>Stairs</th><th>Note (click to open)</th></tr>${rows.join("")}</table>` : '<div class="muted">No PT, OT or nursing mobility entries found this admission.</div>';
  $("tlsum").textContent = (x.hasPT ? "PT" : "no PT") + " · " + (x.hasOT ? "OT" : "no OT") + (f.morse ? " · Morse " + f.morse.v : "");
  MOB_NOTE.update();
}

function load(raw, note, errors) {
  state.f = raw ? C.parse(raw) : null;
  $("dest").value = "auto"; $("goal").value = "auto";
  $("ptsum").textContent = state.f ? [state.f.age != null ? state.f.age + " y" : "", state.f.sex, state.f.problems.slice(0, 2).join("; ")].filter(Boolean).join(", ") : "";
  $("pstatus").textContent = note; $("clear").hidden = !raw;
  $("errs").innerHTML = errors && errors.length ? "Could not read: " + errors.map(esc).join("; ") + ". Check the scopes in the Code Console." : "";
  draw(); MOB_NOTE.reset();
}
["dest", "goal"].forEach((id) => ($(id).onchange = draw)); $("dpl").oninput = draw;
$("clear").onclick = () => { $("testsel").value = ""; load(null, "Open from Cerner to read the chart, or pick a made-up patient:"); };
const SAMPLES = window.MOB_SAMPLES || [];
SAMPLES.forEach((p, i) => { const o = document.createElement("option"); o.value = i; o.textContent = p.label; $("testsel").appendChild(o); });
$("testsel").onchange = () => { const p = SAMPLES[$("testsel").value]; if (!p) return $("clear").onclick(); load(p.build(Date.now()), "Made-up patient: " + p.label, []); };

async function fromChart() {
  if (typeof FHIR === "undefined" || !(location.search.includes("code=") || location.search.includes("complete=") || sessionStorage.getItem("SMART_KEY"))) return;
  $("pstatus").textContent = "Reading the chart…";
  try {
    const client = await FHIR.oauth2.ready();
    const { raw, errors } = await C.gather(client, (msg) => ($("pstatus").textContent = msg));
    load(raw, "Chart read (read-only). Mobility is taken from note text: open the source note to check.", errors);
  } catch (e) { $("pstatus").textContent = "Could not read the chart: " + (e && e.message ? e.message : e) + ". The made-up patients still work."; }
}
draw(); fromChart();
