/* SMART on FHIR – Beers Criteria medication review (Cerner R4). Requires beers-data.js. */
const $ = (id) => document.getElementById(id);
const SEV_ORDER = { avoid: 0, conditional: 1, caution: 2 };
const SEV_LABEL = { avoid: "Avoid", conditional: "Avoid in some situations", caution: "Use with caution" };
const TABLE_LABEL = { 2: "Table 2", 3: "Table 3", 4: "Table 4", 5: "Table 5", 6: "Table 6", 8: "Table 8 (2019 list)" };

// ---------- Name matching ----------
const rxCache = new Map();
function has(hay, name) {
  let rx = rxCache.get(name);
  if (!rx) {
    rx = new RegExp("(^|[^a-z])" + name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "([^a-z]|$)");
    rxCache.set(name, rx);
  }
  return rx.test(hay);
}
const hit = (m, names, skip) => !(skip && skip.test(m.hay)) && names.some((n) => has(m.hay, n));
const keyOf = (m, names) => names.find((n) => has(m.hay, n));
function expand(text) {
  let hay = text.toLowerCase();
  for (const [brand, generic] of Object.entries(ALIAS)) if (has(hay, brand)) hay += " " + generic;
  return hay;
}

// ---------- Start-up ----------
FHIR.oauth2.ready().then(run).catch((e) => {
  $("main").innerHTML = `<div class="card err">Authorization error: ${esc(e.message)}. Launch from launch.html.</div>`;
});

async function run(client) {
  const pid = client.patient.id;
  const patient = await client.patient.read();
  $("patient").textContent = describe(patient);

  const medResources = await fetchMeds(client, pid);
  const medMap = {};
  medResources.filter((r) => r.resourceType === "Medication").forEach((r) => (medMap[r.id] = r));
  const meds = buildMeds(medResources.filter((r) => r.resourceType === "MedicationRequest"), medMap);

  let conds = [], condNote = "";
  try { conds = await fetchConditions(client, pid); }
  catch (e) { condNote = "Problem list could not be retrieved (" + (e.message || e) + "); drug-disease checks (Table 3) were skipped."; }

  const flags = analyze(meds, conds, patient);
  render({ patient, meds, conds, flags, condNote });
}

async function fetchMeds(client, pid) {
  const base = `MedicationRequest?patient=${pid}&status=active`;
  try { return await client.request(base + "&_include=MedicationRequest:medication", { pageLimit: 5, flat: true }); }
  catch (e) { return client.request(base, { pageLimit: 5, flat: true }); }
}

async function fetchConditions(client, pid) {
  const cat = encodeURIComponent("http://terminology.hl7.org/CodeSystem/condition-category|problem-list-item");
  const res = await client.request(`Condition?patient=${pid}&category=${cat}`, { pageLimit: 5, flat: true });
  return res.filter((c) => c.resourceType === "Condition")
    .filter((c) => { const s = c.clinicalStatus && c.clinicalStatus.coding && c.clinicalStatus.coding[0]; return !s || s.code === "active" || s.code === "recurrence" || s.code === "relapse"; })
    .map((c) => ccText(c.code)).filter(Boolean);
}

// ---------- Build medication list ----------
const ccText = (cc) => cc ? [cc.text, ...(cc.coding || []).map((c) => c.display)].filter(Boolean).join(" | ") : "";

function buildMeds(requests, medMap) {
  const seen = new Set(), meds = [];
  for (const mr of requests) {
    let cc = mr.medicationCodeableConcept, label = "";
    if (!cc && mr.medicationReference) {
      const id = (mr.medicationReference.reference || "").split("/").pop().replace("#", "");
      const m = (mr.contained || []).find((c) => c.id === id) || medMap[id];
      cc = m && m.code;
      label = mr.medicationReference.display || "";
    }
    const names = ccText(cc);
    label = (cc && (cc.text || (cc.coding || []).map((c) => c.display).find(Boolean))) || label || "Unknown medication";
    const di = (mr.dosageInstruction || [])[0] || {};
    const sig = di.text || "";
    const route = ccText(di.route);
    const key = (label + sig).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    meds.push({ i: meds.length, label, sig, hay: expand([names, label, route, sig].join(" ")) });
  }
  return meds;
}

// ---------- Analysis ----------
function analyze(meds, conds, patient) {
  const sex = (patient.gender || "").toLowerCase();
  const flags = [];
  const add = (f) => flags.push(f);

  for (const r of R_DRUG) {
    if (r.absent && meds.some((m) => hit(m, r.absent))) continue;
    meds.filter((m) => hit(m, r.d, r.skip)).forEach((m) => add({ ...r, kind: "drug", meds: [m.i] }));
  }

  for (const r of R_COMBO) {
    if (r.sex && r.sex !== sex) continue;
    if (r.type === "count") {
      const ms = meds.filter((m) => hit(m, r.g));
      const distinct = new Set(ms.map((m) => keyOf(m, r.g)));
      if (distinct.size >= r.min) add({ ...r, t: 5, sev: "avoid", kind: "combo", meds: ms.map((m) => m.i) });
    } else {
      const A = meds.filter((m) => hit(m, r.a)), B = meds.filter((m) => hit(m, r.b));
      if (A.length && B.length) add({ ...r, t: 5, sev: "avoid", kind: "combo", meds: [...new Set([...A, ...B].map((m) => m.i))] });
    }
  }

  for (const dz of R_DIS) {
    if (dz.sex && dz.sex !== sex) continue;
    const found = conds.find((c) => dz.re.test(c));
    if (!found) continue;
    for (const r of dz.rules)
      meds.filter((m) => hit(m, r.d, r.skip)).forEach((m) =>
        add({ ...r, t: 3, kind: "disease", title: dz.cond, cond: found, meds: [m.i] }));
  }

  for (const r of R_RENAL)
    meds.filter((m) => hit(m, r.d, r.skip)).forEach((m) =>
      add({ ...r, t: 6, sev: "conditional", kind: "renal", title: "Kidney function: " + keyOf(m, r.d), meds: [m.i], why: "Applies when CrCl/eGFR is " + r.cr + " mL/min. This app does not retrieve kidney function; please check it." }));

  return flags.sort((a, b) => SEV_ORDER[a.sev] - SEV_ORDER[b.sev]);
}

// ---------- Rendering ----------
function render({ patient, meds, conds, flags, condNote }) {
  const age = ageOf(patient.birthDate);
  const byMed = {};
  flags.forEach((f) => f.meds.forEach((i) => (byMed[i] = byMed[i] || []).push(f)));
  const flaggedCount = Object.keys(byMed).length;
  const count = (sev) => new Set(flags.filter((f) => f.sev === sev && f.kind !== "renal").flatMap((f) => f.meds.map((i) => i + f.title))).size;

  let html = "";
  if (age !== null && age < 65) html += `<div class="warn">Patient is ${age} years old. The Beers Criteria are designed for adults 65 and older.</div>`;
  if (condNote) html += `<div class="warn">${esc(condNote)}</div>`;

  html += `<section class="card"><h2>Summary</h2><div class="sum">
    <div class="stat"><b>${meds.length}</b><span>active medications reviewed</span></div>
    <div class="stat"><b>${flaggedCount}</b><span>medications with a Beers match</span></div>
    <div class="stat"><b>${count("avoid")}</b><span>"avoid" flags</span></div>
    <div class="stat"><b>${count("conditional")}</b><span>"avoid in some situations" flags</span></div>
    <div class="stat"><b>${count("caution")}</b><span>"use with caution" flags</span></div></div>
    <p class="note">Matches are by drug name only. Indication, dose, duration and kidney function change whether a match is truly inappropriate. Use as decision support alongside clinical judgment and shared decision-making.</p></section>`;

  html += `<section class="card"><h2>Medications</h2><div class="toolbar">
      <label><input type="checkbox" id="onlyFlagged"> Show only flagged</label>
      <button onclick="window.print()">Print</button><button id="copyBtn">Copy summary</button></div>
    <table><thead><tr><th>Medication</th><th>Directions</th><th>Beers flags</th></tr></thead><tbody id="medRows">` +
    meds.map((m) => {
      const fl = byMed[m.i] || [];
      const badges = fl.map((f) => `<span class="b ${f.sev}" title="${esc(SEV_LABEL[f.sev])}">${esc(f.title)}</span>`).join("") || `<span class="note">no match</span>`;
      return `<tr class="${fl.length ? "flagged" : "ok"}"><td>${esc(m.label)}</td><td>${esc(m.sig)}</td><td>${badges}</td></tr>`;
    }).join("") + `</tbody></table></section>`;

  if (flags.length) {
    html += `<section class="card"><h2>Flag details</h2>` + flags.map((f) => {
      const medNames = f.meds.map((i) => esc(meds[i].label)).join("; ");
      return `<details><summary><span class="b ${f.sev}">${esc(SEV_LABEL[f.sev])}</span> <b>${esc(f.title)}</b> <span class="note">${esc(TABLE_LABEL[f.t] || "")}</span></summary><dl>
        <dt>Medication(s)</dt><dd>${medNames}</dd>
        ${f.cond ? `<dt>Problem list</dt><dd>${esc(f.cond)}</dd>` : ""}
        <dt>Recommendation</dt><dd>${esc(f.rec)}</dd>
        <dt>Rationale</dt><dd>${esc(f.why)}</dd>
        <dt>Evidence / strength</dt><dd>${esc(f.q)} quality; ${esc(f.s)} recommendation</dd>
        ${f.cav ? `<dt>Verify</dt><dd>${esc(f.cav)}</dd>` : ""}</dl></details>`;
    }).join("") + `</section>`;
  }

  html += `<section class="card"><h2>Active problems considered (Table 3 checks)</h2><p class="note">${conds.length ? conds.map(esc).join(" · ") : "None retrieved."}</p>
    <p class="note">Not covered: Table 6 dose rules need CrCl/eGFR (flagged as prompts only), and the criteria do not apply to hospice or end-of-life care.</p></section>`;

  $("main").innerHTML = html;
  $("onlyFlagged").onchange = (e) => document.querySelectorAll("#medRows tr.ok").forEach((r) => (r.style.display = e.target.checked ? "none" : ""));
  $("copyBtn").onclick = () => {
    const lines = flags.map((f) => `[${SEV_LABEL[f.sev]}] ${f.title} - ${f.meds.map((i) => meds[i].label).join("; ")}: ${f.rec}`);
    navigator.clipboard.writeText(describe(patient) + "\nBeers Criteria (AGS 2023) review\n" + lines.join("\n"));
  };
}

function describe(p) {
  const n = (p.name && (p.name.find((x) => x.use === "official") || p.name[0])) || {};
  const name = [(n.given || []).join(" "), n.family].filter(Boolean).join(" ") || "Unknown";
  const age = ageOf(p.birthDate);
  return `${name} · ${p.gender || ""}${age !== null ? " · " + age + " y" : ""} · DOB ${p.birthDate || "?"}`;
}
function ageOf(dob) {
  if (!dob) return null;
  const d = new Date(dob), t = new Date();
  let a = t.getFullYear() - d.getFullYear();
  if (t < new Date(t.getFullYear(), d.getMonth(), d.getDate())) a--;
  return isNaN(a) ? null : a;
}
function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
