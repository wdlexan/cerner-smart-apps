/* Discharge Clinic tab page. Read-only. UNVERIFIED draft written by Claude: the physician decides and edits every line. */
const R = window.DcRules, C = window.DccRules;
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const STEPS = [
  "Site Chief has granted you proxy access to the Cerner list '" + C.CLINIC.list + "' (one-time).",
  "Add the patient to the Cerner referral list.",
  "Put the referral text (section 4) in your ERP/MRP discharge note: the note is the referral. Say clearly what the clinic is taking over.",
  "Write '" + C.CLINIC.reqPhrase + "' in the reason for test on every Island Health requisition, for expedited testing.",
  "Confirm the patient's phone number in PowerChart (the clinic phones them).",
  "If a subspecialty consult is also needed, send it now, at the same time: the Discharge Clinic must not delay it.",
  "Tell the patient: the clinic phones on the first business day after referral (unscheduled; voicemail if no answer, then more tries), and what to do if they get worse before that call. Suggest a home BP monitor for virtual follow-up."];

let S = null; // { fits:[{id,name,why,take,on}], flags, donot:{}, steps:{}, v:{}, out, dirty, pt }
const storeKey = () => "dcc:" + (S && S.key);
const save = () => { try { if (S) sessionStorage.setItem(storeKey(), JSON.stringify({ fits: S.fits, donot: S.donot, steps: S.steps, v: S.v, out: S.out, dirty: S.dirty })); } catch (e) {} };

function build(raw, key) {
  const f = R.parse(Object.assign({ now: Date.now() }, raw)), sc = C.screen(f, raw);
  const p = raw.patient || {}, n = p.name && p.name[0] ? p.name[0].text || [(p.name[0].given || []).join(" "), p.name[0].family].filter(Boolean).join(" ") : "";
  const mrn = ((p.identifier || []).find((i) => /mrn|medical record/i.test(JSON.stringify(i.type || {}))) || {}).value || "";
  S = { key, sc, pt: { name: n, age: sc.age, sex: p.gender || "", mrn },
    fits: sc.fits.map((x) => ({ id: x.id, name: x.name, why: x.why, take: C.fillTake(x.take, sc.fill), on: true })),
    donot: {}, steps: {}, v: { pending: sc.fill.pending || "", phone: sc.phones[0] || "", subspec: "", fp: "", keep: "", told: false, story: "" }, out: "", dirty: false };
  try { const sv = JSON.parse(sessionStorage.getItem(storeKey()) || "null"); if (sv) Object.assign(S, sv); } catch (e) {}
}

function verdictHtml() {
  if (!S) return [`v-none`, `<b>Load a patient</b>Open from Cerner, or pick a made-up patient below.`];
  const on = S.fits.filter((x) => x.on), hard = S.sc.flags.filter((x) => x.hard), anyDo = Object.values(S.donot).some((v) => v === "yes");
  if (!on.length) return ["v-none", `<b>No clear match in the chart</b>Nothing in the chart matched the clinic's referral examples. If you still think they need close follow-up, add a reason in section 1.`];
  if (hard.length || anyDo) return ["v-flag", `<b>Possible fit, but check first</b>${esc(on.map((x) => x.name).join("; "))}. ${hard.length ? "Chart shows: " + esc(hard.map((x) => x.text.split(":")[0]).join(", ")) + "." : ""}${anyDo ? " You marked a do-not-refer item." : ""}`];
  return ["v-fit", `<b>Looks like a Discharge Clinic patient</b>${esc(on.map((x) => x.name).join("; "))}. Confirm section 2, then follow the steps.`];
}

function render() {
  const [cls, html] = verdictHtml(); $("verdict").className = "verdict " + cls; $("verdict").innerHTML = html;
  if (!S) { ["fits", "flags", "donot"].forEach((id) => ($(id).innerHTML = "")); $("out").value = ""; $("pod").value = ""; return; }
  $("ptsum").textContent = [S.pt.name, S.pt.age != null ? S.pt.age + " y" : "", S.pt.sex].filter(Boolean).join(", ");
  $("fits").innerHTML = S.fits.length ? S.fits.map((x, i) => `<div class="item"><input type="checkbox" data-fit="${i}"${x.on ? " checked" : ""}>
      <div style="flex:1"><b>${esc(x.name)}</b> <span class="why">${esc(x.why ? "(" + x.why + ")" : "(added by you)")}</span>
      ${x.on ? `<input type="text" class="take" data-take="${i}" value="${esc(x.take)}" placeholder="What the clinic takes over">` : ""}</div></div>`).join("")
    : `<p class="muted">No referral examples matched the chart.</p>`;
  const used = new Set(S.fits.map((x) => x.id));
  $("addfit").innerHTML = `<option value="">Add another reason…</option>` + C.FITS.filter((q) => !used.has(q.id)).map((q) => `<option value="${q.id}">${esc(q.name)}</option>`).join("") + `<option value="other">Other (type it)</option>`;
  $("fitsum").textContent = S.fits.filter((x) => x.on).length + " ticked";
  $("flags").innerHTML = S.sc.flags.length ? S.sc.flags.map((x) => `<div class="flag${x.hard ? " hard" : ""}">${esc(x.text)}</div>`).join("") : `<p class="muted" style="margin:4px 0">No do-not-refer flags found in the chart (oxygen, IV medicines, nursing, function, attendance, phone). Still confirm below.</p>`;
  $("donot").innerHTML = C.CLINIC.doNot.map(([k, t]) => `<div class="item"><div style="flex:1">${esc(t)}</div>
      <label><input type="radio" name="dn-${k}" value="no"${S.donot[k] === "no" ? " checked" : ""}> Confirmed not</label>
      <label><input type="radio" name="dn-${k}" value="yes"${S.donot[k] === "yes" ? " checked" : ""}> Yes, applies</label></div>`).join("");
  const conf = C.CLINIC.doNot.filter(([k]) => S.donot[k] === "no").length;
  $("flagsum").textContent = `${S.sc.flags.length} chart flag${S.sc.flags.length === 1 ? "" : "s"} · ${conf}/4 confirmed`;
  $("steps").innerHTML = STEPS.map((t, i) => `<li><label><input type="checkbox" data-step="${i}"${S.steps[i] ? " checked" : ""}> <span>${esc(t)}</span></label></li>`).join("");
  $("stepsum").textContent = Object.values(S.steps).filter(Boolean).length + "/" + STEPS.length + " done";
  ["subspec", "pending", "phone", "fp", "keep", "story"].forEach((k) => ($("v-" + k).value = S.v[k] || "")); $("v-told").checked = !!S.v.told;
  wire(); outputs(); save();
}
function outputs(force) {
  if (!S) return;
  const on = S.fits.filter((x) => x.on);
  if (force || !S.dirty) { S.out = C.noteBlock({ reason: on.map((x) => x.name).join("; "), take: on.map((x) => x.take), subspec: S.v.subspec, pending: S.v.pending, phone: S.v.phone, told: S.v.told, fp: S.v.fp, keep: S.v.keep }); S.dirty = false; }
  $("out").value = S.out; $("dirty").textContent = S.dirty ? "You edited this: changes above no longer update it (Rebuild to start again)." : "";
  $("pod").value = C.podMessage({ name: S.pt.name, age: S.pt.age, sex: S.pt.sex, mrn: S.pt.mrn, story: S.v.story, reason: on.map((x) => x.name.split(" (")[0]).join("; ") });
}
function wire() {
  document.querySelectorAll("[data-fit]").forEach((el) => (el.onchange = () => { S.fits[+el.dataset.fit].on = el.checked; render(); }));
  document.querySelectorAll("[data-take]").forEach((el) => (el.oninput = () => { S.fits[+el.dataset.take].take = el.value; outputs(); save(); }));
  document.querySelectorAll("[data-step]").forEach((el) => (el.onchange = () => { S.steps[el.dataset.step] = el.checked; $("stepsum").textContent = Object.values(S.steps).filter(Boolean).length + "/" + STEPS.length + " done"; save(); }));
  C.CLINIC.doNot.forEach(([k]) => document.querySelectorAll(`[name="dn-${k}"]`).forEach((el) => (el.onchange = () => { S.donot[k] = el.value; render(); })));
}
["subspec", "pending", "phone", "fp", "keep", "story"].forEach((k) => $("v-" + k).addEventListener("input", () => { if (!S) return; S.v[k] = $("v-" + k).value; outputs(); save(); }));
$("v-told").onchange = () => { if (!S) return; S.v.told = $("v-told").checked; outputs(); save(); };
$("addfit").onchange = () => {
  if (!S) return; const id = $("addfit").value; if (!id) return;
  if (id === "other") { const t = prompt("Reason for referral:"); if (t) S.fits.push({ id: "other" + Date.now(), name: t, why: "", take: "", on: true }); }
  else { const q = C.FITS.find((x) => x.id === id); S.fits.push({ id, name: q.name, why: "", take: C.fillTake(q.take, S.sc.fill), on: true }); }
  render();
};
$("out").addEventListener("input", () => { if (!S) return; S.out = $("out").value; S.dirty = true; $("dirty").textContent = "You edited this: changes above no longer update it (Rebuild to start again)."; save(); });
$("rebuild").onclick = () => { if (!S) return; if (S.dirty && !confirm("Rebuild from above? Your edits in the box will be lost.")) return; outputs(true); save(); };
async function copyText(btn, text) { try { await navigator.clipboard.writeText(text); } catch (e) { const t = document.createElement("textarea"); t.value = text; document.body.appendChild(t); t.select(); document.execCommand("copy"); t.remove(); } const o = btn.textContent; btn.textContent = "Copied"; setTimeout(() => (btn.textContent = o), 1500); }
$("copy").onclick = (e) => copyText(e.target, $("out").value);
$("copypod").onclick = (e) => copyText(e.target, $("pod").value);
$("phrase").textContent = C.CLINIC.reqPhrase; $("copyphrase").onclick = (e) => copyText(e.target, C.CLINIC.reqPhrase);
$("oos").textContent = C.CLINIC.outOfScope;
$("ref").innerHTML = `<h3>Appropriate patients</h3><ul>${C.CLINIC.appropriate.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>
  <h3>Do not refer patients who</h3><ul>${C.CLINIC.doNot.map(([, t]) => `<li>${esc(t)}</li>`).join("")}</ul>
  <h3>Examples of appropriate referrals</h3><ul>${C.FITS.map((q) => `<li>${esc(q.name)}</li>`).join("")}</ul>
  <h3>Scope</h3><p>Managed by an Internal Medicine physician or Hospitalist with access to urgent Internal Medicine consultation. Out of scope: ${esc(C.CLINIC.outOfScope)}</p>
  <h3>After referral</h3><ul><li>The referral list is reviewed Monday to Friday; the patient comes off the list once the clinic has assumed care.</li><li>Follow-up by phone or in person. Short-term only: then back to the primary care provider or a UPCC.</li><li>RJH Clinical Nurse Leaders may suggest patients, but the clinic always asks the MRP before assessing.</li><li>A dedicated clinic phone number is still in development: make sure the patient knows what to do if worse before the first call.</li></ul>`;

/* ---------- loading ---------- */
const SAMPLES = (window.DC_SAMPLES || []).concat(window.DCC_SAMPLES || []);
SAMPLES.forEach((p, i) => { const o = document.createElement("option"); o.value = i; o.textContent = p.label; $("testsel").appendChild(o); });
$("testsel").onchange = () => { const p = SAMPLES[$("testsel").value]; if (!p) { S = null; render(); return; } build(p.build(Date.now()), "sample-" + $("testsel").value); $("pstatus").textContent = "Made-up patient: " + p.label; render(); };
async function fromChart() {
  if (typeof FHIR === "undefined" || !(location.search.includes("code=") || location.search.includes("complete=") || sessionStorage.getItem("SMART_KEY"))) return;
  $("pstatus").textContent = "Reading the chart…";
  try {
    const client = await FHIR.oauth2.ready();
    const { raw, errors } = await window.DcChart.gather(client, (m) => ($("pstatus").textContent = m));
    build(raw, "pt-" + client.patient.id); $("pstatus").textContent = "Chart read (read-only). Nothing is sent anywhere.";
    $("errs").textContent = errors && errors.length ? "Could not read: " + errors.join("; ") : "";
    render();
  } catch (e) { $("pstatus").textContent = "Could not read the chart: " + (e && e.message ? e.message : e) + ". The made-up patients still work."; }
}
render(); fromChart();
