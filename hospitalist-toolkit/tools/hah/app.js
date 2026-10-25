/* SMART on FHIR – Hospital at Home (HaH) screen (Cerner R4).
   Finds POTENTIAL Hospital at Home candidates from the chart, using the items on the Island Health
   Hospital at Home Referral Form (9-90886 V.2 FEB 2024), and pre-fills that form as a PDF.
   It does not decide eligibility: the patient/family must be asked and must consent, and the HaH team decides.
   The criteria are in hah-criteria.csv, catchment.csv and hah-stability.csv (edit in Excel - no code changes).
   Everything runs in this browser. Needs criteria-loader.js (CSV reader) and pdf-lib. */

const CONFIG = {
  referringMrp: "Dr. Wayne A. Dong",   // pre-filled "Referring MRP" (editable on screen)
  defaultSite: "vgh",                  // rjh | vgh | cdh | other
  noteDays: [7, 30, 365, null],        // how far back to look for notes (widens only if none found)
  maxNotes: 12
};
const $ = (id) => document.getElementById(id);
const state = { client: null, patient: null, notes: [], vitals: [], conds: [], items: [], diag: [], answers: {} };
const DAY = 864e5;

// ---------- Start-up ----------
FHIR.oauth2.ready().then(init).catch((e) => {
  $("out").innerHTML = `<div class="card err">Authorization error: ${esc(e.message)}. Launch from launch.html.</div>`;
});

async function init(client) {
  state.client = client;
  setStatus("Reading the chart and the criteria…");
  try { state.patient = await client.patient.read(); $("patient").textContent = describe(state.patient); }
  catch (e) { state.patient = {}; $("patient").textContent = "Patient " + client.patient.id; }
  try { await loadSheets(); }
  catch (e) { $("out").innerHTML = `<div class="card err"><b>The criteria spreadsheets could not be read.</b><br>${esc(e.message || e)}</div>`; return; }
  const [notes, vitals, conds] = await Promise.all([fetchNotes(), fetchVitals(), fetchConditions()]);
  state.notes = notes; state.vitals = vitals; state.conds = conds;
  evaluate();
  render();
  setStatus(`Read ${notes.length} note(s), ${vitals.length} vital sign(s), ${conds.length} diagnosis record(s).`);
}

// ---------- Criteria spreadsheets ----------
async function loadSheets() {
  const problems = [];
  const crit = parseCSV(await fetchText("hah-criteria.csv"));
  const h = crit[0] || [];
  const ix = { key: headerIndex(h, "key"), sec: headerIndex(h, "section"), item: headerIndex(h, "form item"), fav: headerIndex(h, "favourable", "favorable"),
    hard: headerIndex(h, "hard"), how: headerIndex(h, "how"), yes: headerIndex(h, "words meaning yes"), no: headerIndex(h, "words meaning no"),
    ign: headerIndex(h, "ignore"), ref: headerIndex(h, "reference") };
  if (ix.key < 0 || ix.item < 0) throw new Error("hah-criteria.csv: the first row must keep its column names (Key, Section, Form item …).");
  state.rows = [];
  crit.slice(1).forEach((r, i) => {
    const get = (k) => (ix[k] >= 0 ? (r[ix[k]] || "").trim() : "");
    const row = { key: get("key"), section: get("sec") || "Other", item: get("item"), fav: get("fav") || "Info", hard: /^y/i.test(get("hard")),
      how: get("how"), ref: get("ref") };
    if (!row.key || !row.item) return problems.push(`hah-criteria.csv row ${i + 2}: Key and Form item are needed.`);
    if (!/^(yes|no|info)$/i.test(row.fav)) problems.push(`hah-criteria.csv row ${i + 2} (${row.item}): Favourable answer should be Yes, No or Info.`);
    row.fav = row.fav.charAt(0).toUpperCase() + row.fav.slice(1).toLowerCase();
    try { row.yes = phrasesRe(get("yes")); row.no = phrasesRe(get("no")); row.ignore = phrasesRe(get("ign")); }
    catch (e) { problems.push(`hah-criteria.csv row ${i + 2} (${row.item}): could not read the words (${e.message}).`); }
    state.rows.push(row);
  });
  state.catch = {};
  try {
    const c = parseCSV(await fetchText("catchment.csv"));
    c.slice(1).forEach((r) => { if (r[0] && r[0].trim()) state.catch[r[0].trim().toUpperCase().replace(/\s/g, "").slice(0, 3)] = { status: (r[1] || "").trim(), area: (r[2] || "").trim(), site: (r[3] || "").trim() }; });
  } catch (e) { problems.push(e.message + " The catchment check will show Unknown."); }
  state.stab = [];
  try {
    const s = parseCSV(await fetchText("hah-stability.csv"));
    s.slice(1).forEach((r, i) => {
      const name = (r[0] || "").trim(), test = parseCondition(r[1]);
      if (!name) return;
      if (!VITAL_CODES[name]) return problems.push(`hah-stability.csv row ${i + 2}: unknown measure "${name}" (use ${Object.keys(VITAL_CODES).join(", ")}).`);
      if (!test) return problems.push(`hah-stability.csv row ${i + 2} (${name}): "Unstable if" not understood (examples: < 100, > 110).`);
      state.stab.push({ name, test, label: (r[2] || name).trim(), cond: r[1] });
    });
  } catch (e) { problems.push(e.message + " Vital-sign stability will not be checked."); }
  state.problems = problems;
}

// ---------- Chart data ----------
const iso = (d) => new Date(d).toISOString().slice(0, 10);
async function fetchNotes() {
  const pid = state.client.patient.id;
  const cat = encodeURIComponent("http://hl7.org/fhir/us/core/CodeSystem/us-core-documentreference-category|clinical-note");
  let docs = [];
  for (const days of CONFIG.noteDays) {
    try {
      const raw = await state.client.request(`DocumentReference?patient=${pid}&category=${cat}` + (days ? `&date=ge${iso(Date.now() - days * DAY)}` : "") + "&_count=50", { pageLimit: 4, flat: true });
      docs = raw.filter((d) => d.resourceType === "DocumentReference" && d.status !== "entered-in-error" && (d.content || []).length);
      state.diag.push(`notes (${days ? "last " + days + " days" : "no date limit"}): ${docs.length}`);
      if (docs.length) break;
    } catch (e) { state.diag.push(`notes: error ${e.message || e}`); }
  }
  docs.sort((a, b) => new Date(docDate(b)) - new Date(docDate(a)));
  docs = docs.slice(0, CONFIG.maxNotes);
  const out = [];
  for (let i = 0; i < docs.length; i += 4) {
    const batch = await Promise.all(docs.slice(i, i + 4).map(async (d) => ({ type: typeLabel(d), date: docDate(d), author: authorOf(d), text: await getText(d) })));
    out.push(...batch);
  }
  const readable = out.filter((n) => n.text && n.text.length > 20 && !/^\[/.test(n.text));
  readable.forEach((n, i) => (n.n = i + 1));
  return readable;
}

const VITAL_CODES = { "Systolic BP": ["8480-6"], "Heart rate": ["8867-4"], "Respiratory rate": ["9279-1"], "SpO2": ["59408-5", "2708-6"], "Temperature": ["8310-5", "8331-1", "8332-9", "8333-7"] };
async function fetchVitals() {
  const pid = state.client.patient.id;
  for (const days of [2, 30, 365, null]) {
    try {
      const raw = await state.client.request(`Observation?patient=${pid}&category=vital-signs` + (days ? `&date=ge${iso(Date.now() - days * DAY)}` : "") + "&_count=100", { pageLimit: days && days <= 30 ? 10 : 5, flat: true });
      const vals = [];
      raw.filter((o) => o.resourceType === "Observation" && !["entered-in-error", "cancelled"].includes(o.status)).forEach((o) => {
        const when = new Date(o.effectiveDateTime || (o.effectivePeriod && o.effectivePeriod.start) || o.issued);
        const push = (code, q) => {
          if (!q || q.value == null) return;
          const name = Object.keys(VITAL_CODES).find((k) => VITAL_CODES[k].some((c) => (code.coding || []).some((x) => x.code === c)));
          if (!name) return;
          let v = Number(q.value);
          if (name === "Temperature" && /f/i.test(q.unit || q.code || "")) v = Math.round(((v - 32) * 5 / 9) * 10) / 10;
          vals.push({ name, v, when });
        };
        if (o.component && o.component.length) o.component.forEach((c) => push(c.code || {}, c.valueQuantity));
        push(o.code || {}, o.valueQuantity);
      });
      state.diag.push(`vital signs (${days ? "last " + days + " days" : "no date limit"}): ${vals.length}`);
      if (vals.length) return vals;
    } catch (e) { state.diag.push(`vital signs: error ${e.message || e}`); }
  }
  return [];
}

async function fetchConditions() {
  const pid = state.client.patient.id;
  for (const q of [`Condition?patient=${pid}&category=encounter-diagnosis&_count=50`, `Condition?patient=${pid}&category=problem-list-item&_count=50`]) {
    try {
      const raw = (await state.client.request(q, { pageLimit: 2, flat: true })).filter((c) => c.resourceType === "Condition");
      const active = raw.filter((c) => { const s = ((c.clinicalStatus || {}).coding || [{}])[0].code; return !s || ["active", "recurrence", "relapse"].includes(s); });
      state.diag.push(`diagnoses (${q.includes("encounter") ? "encounter" : "problem list"}): ${active.length}`);
      if (active.length) return active.sort((a, b) => new Date(b.recordedDate || b.onsetDateTime || 0) - new Date(a.recordedDate || a.onsetDateTime || 0));
    } catch (e) { state.diag.push(`diagnoses: error ${e.message || e}`); }
  }
  return [];
}

// ---------- Matching words in the notes ----------
const NEGATION = /\b(no|not|denies|denied|denying|negative for|neg for|without|never|free of|absence of|absent|ruled out|no evidence of|no history of|no h\/o|no signs? of|negative)\b[^.;\n]{0,45}$/i;
const NEG_AFTER = /^\s*[:=-]?\s*(no|none|nil|denies|denied|negative|absent|not present)\b/i;
function negated(text, idx, len) {
  const before = text.slice(Math.max(0, idx - 70), idx);
  const clause = before.slice(before.lastIndexOf("\n") + 1).split(/[.;]/).pop().split(/\b(?:but|however|although|though|except)\b/i).pop();
  return NEGATION.test(clause) || NEG_AFTER.test(text.slice(idx + len, idx + len + 25));
}
// Returns hits {pos:[], neg:[]} for a word pattern across the notes (newest first)
function search(re, ignore) {
  const out = { pos: [], neg: [] };
  if (!re) return out;
  for (const note of state.notes) {
    const rx = new RegExp(re.source, "gi"); let m;
    while ((m = rx.exec(note.text))) {
      if (m[0].length === 0) { rx.lastIndex++; continue; }
      if (ignore && ignore.test(note.text.slice(Math.max(0, m.index - 40), m.index + m[0].length + 40))) continue;
      (negated(note.text, m.index, m[0].length) ? out.neg : out.pos).push({ note, at: m.index, len: m[0].length });
    }
  }
  return out;
}
const ev = (h) => ({ note: h.note.n, label: `${h.note.type} · ${fmt(h.note.date)}`, snip: snippet(h.note.text, h.at, h.len), at: h.at, len: h.len });

// ---------- Assess each form item ----------
function evaluate() {
  const age = ageOf(state.patient.birthDate);
  state.items = state.rows.map((row) => {
    const r = { row, answer: "Unknown", evidence: [], note: "" };
    if (row.key === "age19") {
      if (age != null) { r.answer = age >= 19 ? "Yes" : "No"; r.note = `age ${age} (date of birth ${state.patient.birthDate})`; }
      else r.note = "no date of birth in the chart";
      return r;
    }
    if (row.key === "catchment") {
      const pc = postalCode(), pre = pc.replace(/\s/g, "").slice(0, 3).toUpperCase(), c = state.catch[pre];
      if (!pc) r.note = "no postal code in the chart";
      else if (!c) r.note = `postal code ${pc} – not in catchment.csv; check drive time`;
      else {
        r.answer = /^in/i.test(c.status) ? "Yes" : /^out/i.test(c.status) ? "No" : "Unknown";
        r.note = `postal code ${pc} → ${c.area || pre} (${c.status}${c.site ? ", " + c.site : ""})` + (r.answer === "Unknown" ? " – check drive time" : "");
      }
      return r;
    }
    const yes = search(row.yes, row.ignore), no = search(row.no, row.ignore);
    if (yes.pos.length && no.pos.length) { r.answer = "Unknown"; r.note = "conflicting entries in the notes"; }
    else if (yes.pos.length) r.answer = "Yes";
    else if (no.pos.length || yes.neg.length) r.answer = "No";
    r.evidence = yes.pos.slice(0, 2).map(ev).concat(no.pos.slice(0, 2).map(ev));
    if (r.answer === "No" && !no.pos.length) { r.evidence = yes.neg.slice(0, 1).map(ev); r.note = "documented as absent / denied"; }

    // Exclusions assessed from the chart (stroke, pain crisis, LTC …) that are never mentioned: pre-set to "No", to confirm
    if (row.hard && row.fav === "No" && r.answer === "Unknown" && !/ask/i.test(row.how) && !r.note) {
      r.answer = "No"; r.assumed = true; r.note = "not mentioned in the notes read – confirm";
    }
    if (row.key === "stable") {
      const vs = vitalCheck();
      r.vitals = vs;
      if (vs.unstable.length) { r.answer = "No"; r.note = "vital signs: " + vs.unstable.join("; "); }
      else if (vs.checked && !no.pos.length) { r.answer = "Yes"; r.note = "latest vital signs within limits: " + vs.summary; }
      else if (vs.checked) r.note = "vital signs within limits (" + vs.summary + "), but the notes describe instability";
      else if (r.answer === "Unknown") r.note = "no recent vital signs found";
    }
    if (row.key === "homeCareFreq" && r.answer === "Unknown") {
      const hs = search((state.rows.find((x) => x.key === "homeSupports") || {}).yes);
      if (!hs.pos.length) { r.note = "no home care found in the chart – confirm; if none, this is fine"; }
      else r.note = "home care mentioned but how often is not clear – confirm (no more than twice a day)";
    }
    if (row.key === "knownDx") {
      const dx = diagnosisText();
      if (dx) { r.answer = "Yes"; r.note = "diagnosis: " + dx; }
    }
    return r;
  });
  state.items.forEach((it) => (state.answers[it.row.key] = it.answer));
}

// Latest value of each vital sign (from the most recent 24 h of charting) against hah-stability.csv
function vitalCheck() {
  if (!state.vitals.length) return { checked: false, unstable: [], summary: "" };
  const newest = Math.max(...state.vitals.map((v) => +v.when).filter((t) => !isNaN(t)));
  const latest = {};
  state.vitals.filter((v) => +v.when >= newest - DAY).sort((a, b) => b.when - a.when).forEach((v) => { if (!(v.name in latest)) latest[v.name] = v; });
  const unstable = [];
  state.stab.forEach((s) => { const v = latest[s.name]; if (v && s.test(v.v)) unstable.push(`${s.label} (${v.v}, ${fmtT(v.when)})`); });
  const summary = Object.values(latest).map((v) => `${short(v.name)} ${v.v}`).join(", ");
  return { checked: Object.keys(latest).length > 0, unstable, summary, when: new Date(newest) };
}
const short = (n) => ({ "Systolic BP": "SBP", "Heart rate": "HR", "Respiratory rate": "RR", "SpO2": "SpO2", "Temperature": "T" }[n] || n);

function diagnosisText() {
  const c = state.conds[0];
  if (c) return (c.code && (c.code.text || ((c.code.coding || [])[0] || {}).display)) || "";
  for (const n of state.notes) {
    const m = /(?:admitting diagnosis|diagnosis|impression)\s*:\s*([^\n]{3,90})/i.exec(n.text);
    if (m) return m[1].trim().replace(/^\d+\.\s*/, "").replace(/[.;,]+$/, "");
  }
  return "";
}
function postalCode() {
  const a = (state.patient.address || []).find((x) => x.use === "home") || (state.patient.address || [])[0] || {};
  return (a.postalCode || "").toUpperCase();
}
function identifier(words) {
  const hit = (state.patient.identifier || []).find((id) => {
    const t = [(id.system || ""), (id.type && id.type.text) || "", ...(((id.type && id.type.coding) || []).map((c) => `${c.code || ""} ${c.display || ""}`))].join(" ").toLowerCase();
    return words.some((w) => t.includes(w));
  });
  return hit ? hit.value : "";
}

// ---------- Outcome (recalculated from the Yes/No/Unknown choices on screen) ----------
function statusOf(row, answer) {
  if (answer === "Unknown") return "unknown";
  if (row.fav === "Info") return "info";
  return answer === row.fav ? "ok" : "concern";
}
function outcome() {
  const items = state.items.map((it) => ({ ...it, answer: state.answers[it.row.key] }));
  const hard = items.filter((it) => it.row.hard && statusOf(it.row, it.answer) === "concern");
  const soft = items.filter((it) => !it.row.hard && statusOf(it.row, it.answer) === "concern");
  const ask = items.filter((it) => /ask/i.test(it.row.how) && it.answer === "Unknown" || (it.row.hard && it.answer === "Unknown"));
  const assumed = items.filter((it) => it.assumed && it.answer === "No");
  const thin = !state.notes.length && !state.vitals.length;
  let code, title, detail;
  if (hard.length) { code = "no"; title = "Probably not suitable for Hospital at Home right now"; detail = "Excluded by: " + hard.map((h) => h.row.item).join("; ") + ". Recheck if this changes."; }
  else if (thin) { code = "thin"; title = "Not enough information in the chart"; detail = "No notes or vital signs were found. Complete the checklist by asking the patient and the team."; }
  else { code = "yes"; title = "Potential Hospital at Home candidate"; detail = "No exclusion was found in the chart. Talk with the patient and family, confirm the items below, and get consent before referring."; }
  return { code, title, detail, hard, soft, ask, assumed };
}

// ---------- Rendering ----------
function render() {
  const sections = [...new Set(state.items.map((it) => it.row.section))];
  let html = `<div id="banner"></div>`;
  html += `<section class="card"><h2>Checklist <span class="note">(same items as the Hospital at Home Referral Form; change any answer – the result and the PDF follow)</span></h2>
    <table class="chk"><thead><tr><th>Item</th><th class="c">Yes</th><th class="c">No</th><th class="c">Unknown</th><th>Found in the chart</th></tr></thead><tbody>` +
    sections.map((s) => `<tr class="sec"><td colspan="5">${esc(s)}</td></tr>` + state.items.filter((it) => it.row.section === s).map(rowHtml).join("")).join("") +
    `</tbody></table></section>`;
  html += referralHtml();
  html += `<section class="card"><b>Criteria used</b><p class="note">${state.rows.length} items from <b>hah-criteria.csv</b>, ${Object.keys(state.catch).length} postal-code prefixes from <b>catchment.csv</b>,
    ${state.stab.length} vital-sign limits from <b>hah-stability.csv</b>. Edit them in Excel – no code changes needed. ${esc(state.diag.join(" · "))}</p>
    ${state.problems.length ? `<div class="warn"><b>Spreadsheet rows skipped:</b><br>${state.problems.map(esc).join("<br>")}</div>` : ""}
    <p class="note">Notes read: ${state.notes.map((n) => `#${n.n} ${esc(n.type)} (${esc(fmt(n.date))})`).join(" · ") || "none"}</p></section>`;
  $("out").innerHTML = html;
  document.querySelectorAll("input[data-k]").forEach((i) => (i.onchange = () => { state.answers[i.dataset.k] = i.value; refresh(); }));
  $("pdfBtn").onclick = makePdf;
  $("copyBtn").onclick = () => copyText(summaryText());
  refresh();
}

function rowHtml(it) {
  const k = it.row.key, a = state.answers[k];
  const tags = (it.row.hard ? '<span class="tag hard">exclusion if unfavourable</span>' : "") + (/ask/i.test(it.row.how) ? '<span class="tag ask">ask patient / family</span>' : "");
  const evid = (it.note ? `<div class="note">${esc(it.note)}</div>` : "") +
    it.evidence.map((e) => `<div class="ev"><i>${esc(e.label)}</i> <a href="#" onclick="viewNote(${e.note},${e.at},${e.len});return false">view</a><br>${e.snip}</div>`).join("") ||
    (it.note ? "" : '<span class="note">nothing found</span>');
  return `<tr data-row="${esc(k)}"><td><b>${esc(it.row.item)}</b><br>${tags}</td>` +
    ["Yes", "No", "Unknown"].map((v) => `<td class="c"><input type="radio" name="a_${esc(k)}" data-k="${esc(k)}" value="${v}" ${a === v ? "checked" : ""}></td>`).join("") +
    `<td>${evid}</td></tr>`;
}

function refresh() {
  const o = outcome();
  state.items.forEach((it) => {
    const tr = document.querySelector(`tr[data-row="${it.row.key}"]`);
    if (tr) tr.className = statusOf(it.row, state.answers[it.row.key]);
  });
  $("banner").innerHTML = `<section class="banner ${o.code}"><b>${esc(o.title)}</b><div>${esc(o.detail)}</div></section>` +
    (o.code !== "no" ? `<section class="card"><b>Before referring – confirm with the patient / family and team</b><ul>${o.ask.map((a) => `<li>${esc(a.row.item)}</li>`).join("") || "<li>All items answered.</li>"}</ul>` +
      (o.assumed.length ? `<p class="note"><b>Not mentioned in the chart (pre-set to No – confirm):</b> ${o.assumed.map((a) => esc(a.row.item)).join(", ")}</p>` : "") +
      (o.soft.length ? `<b>Things to consider</b><ul>${o.soft.map((s) => `<li>${esc(s.row.item)}: ${esc(state.answers[s.row.key])}</li>`).join("")}</ul>` : "") +
      `<p class="note">This screen finds possible candidates only. Hospital at Home is voluntary: the patient must prefer and consent to care at home, and the Hospital at Home team decides.</p></section>` : "");
}

// ---------- Referral form fields ----------
function referralHtml() {
  const p = state.patient, n = (p.name || []).find((x) => x.use === "official") || (p.name || [])[0] || {};
  const iso_ = isoToday();
  const isolation = isolationText();
  const violence = state.answers.violence === "Yes";
  const site = CONFIG.defaultSite;
  const f = (id, label, val, span) => `<label class="${span || ""}">${label}<input type="text" id="${id}" value="${esc(val || "")}"></label>`;
  return `<section class="card"><h2>Referral form details</h2><div class="grid">
    ${f("rf_last", "Last name", (n.family || "").toUpperCase())}${f("rf_first", "First name", ((n.given || [])[0] || "").toUpperCase())}
    ${f("rf_dob", "Date of birth (year-month-day)", p.birthDate || "")}${f("rf_mrn", "MRN", identifier(["mrn", "medical record"]))}
    ${f("rf_postal", "Postal code", postalCode())}${f("rf_mrp", "Referring MRP", CONFIG.referringMrp)}
    ${f("rf_unit", "Referring unit", "")}${f("rf_admit", "Admission date", iso_)}
    ${f("rf_dx", "Diagnosis", diagnosisText(), "wide")}
    <div class="radios">MRP aware of referral? <label><input type="radio" name="rf_aware" value="yes" checked> yes</label> <label><input type="radio" name="rf_aware" value="no"> no</label></div>
    <div class="radios">Referring site: ${[["rjh", "Royal Jubilee"], ["vgh", "Victoria General"], ["cdh", "Cowichan District"], ["other", "Other"]].map(([v, l]) => `<label><input type="radio" name="rf_site" value="${v}" ${v === site ? "checked" : ""}> ${l}</label>`).join(" ")}</div>
    <div class="radios"><label><input type="checkbox" id="rf_violence" ${violence ? "checked" : ""}> Violence alert</label>
      <label><input type="checkbox" id="rf_disease" ${isolation ? "checked" : ""}> Disease alert</label></div>
    ${f("rf_disease_txt", "Disease alert – specify", isolation)}
    <label class="wide">Additional information (2 lines on the form)<textarea id="rf_info">${esc(extraInfo())}</textarea></label>
    ${f("rf_sent", "Date referral sent", iso_)}${f("rf_pages", "Total # of pages", "1")}
    </div>
    <div class="toolbar"><button id="pdfBtn">Create referral PDF</button><button class="sec" id="copyBtn">Copy summary</button><span id="pdfMsg" class="note"></span></div>
    <p class="note">The Yes / No / Unknown boxes on the PDF come from the checklist above. Review the PDF, then fax it to Hospital at Home (RJH 250-370-8188 · VGH 250-727-4013 · CDH 250-709-3018).</p></section>`;
}
// Items that are not on the form (home care frequency, staff safety, cirrhosis, consent) go into "Additional information"
function extraInfo() {
  const parts = state.items.filter((it) => /extra/i.test(it.row.section) && it.row.key !== "violence").map((it) => {
    const a = state.answers[it.row.key];
    return a === "Unknown" || (it.assumed && a === "No") ? null : `${it.row.item}: ${a}`;
  }).filter(Boolean);
  return parts.join("; ");
}
function isolationText() {
  const found = [];
  [["MRSA", /\bMRSA\b/], ["VRE", /\bVRE\b/], ["C. difficile", /\bC\.?\s?diff/i], ["CPO", /\bCPO\b/], ["COVID-19", /\bCOVID/i], ["Influenza", /\binfluenza\b/i], ["TB", /\btuberculosis\b|\bTB\b/]]
    .forEach(([name, re]) => { if (state.notes.some((n) => { const m = re.exec(n.text); return m && !negated(n.text, m.index, m[0].length); })) found.push(name); });
  return found.join(", ");
}

// ---------- PDF (pdf-lib) ----------
// Positions measured from the form (612 x 792 pt; "top" values from the top of the page).
const FORM = {
  text: { rf_last: [98, 130, 300], rf_first: [98, 154, 300], rf_dob: [142, 177, 160], rf_mrn: [78, 200, 220], rf_postal: [102, 224, 196],
    rf_mrp: [372, 130, 185], rf_unit: [369, 154, 188], rf_admit: [374, 177, 183], rf_dx: [352, 200, 205], rf_disease_txt: [142, 257, 128],
    rf_sent: [122, 709, 100], rf_pages: [460, 709, 90] },
  info: { x: 58, tops: [312, 322], maxW: 500 },
  aware: { yes: [419.4, 220.3], no: [454.2, 220.3] },
  violence: [55.2, 243.5], disease: [55.2, 255.5],
  site: { rjh: [381.25, 243.5], vgh: [381.25, 255.5], cdh: [381.25, 267.5], other: [381.25, 279.5] },
  cols: { left: { Yes: 189.7, No: 218.2, Unknown: 246.7 }, right: { Yes: 466.4, No: 494.75, Unknown: 523.1 } },
  rows: { age19: ["left", 363.4], safeHome: ["left", 380.2], phone: ["left", 396.8], fridge: ["left", 413.6], catchment: ["left", 430.4], caregiver: ["left", 458.6],
    homeSupports: ["left", 492.2], ltc: ["left", 509.0], mobility: ["left", 525.7], cognition: ["left", 542.5], ptot: ["left", 559.3], fallRisk: ["left", 576.8], language: ["left", 595.8],
    hospLevel: ["right", 363.4], knownDx: ["right", 380.2], stable: ["right", 396.8], los: ["right", 413.6], multiTests: ["right", 430.4], ambulatory: ["right", 458.6],
    selfCare: ["right", 475.4], painCrisis: ["right", 492.2], stroke: ["right", 509.0], psych: ["right", 525.7], substance: ["right", 542.5] }
};

async function makePdf() {
  const msg = $("pdfMsg");
  try {
    if (typeof PDFLib === "undefined") throw new Error("the PDF library did not load (check the internet connection)");
    msg.textContent = "Building PDF…";
    const res = await fetch("HospitalAtHomeReferral.pdf");
    if (!res.ok) throw new Error("HospitalAtHomeReferral.pdf is missing from this folder");
    const { PDFDocument, StandardFonts, rgb } = PDFLib;
    const pdf = await PDFDocument.load(await res.arrayBuffer());
    const font = await pdf.embedFont(StandardFonts.Helvetica), page = pdf.getPages()[0], ink = rgb(0, 0, 0), H = 792;
    const clean = (s) => String(s || "").replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, "-").replace(/[^\n\x20-\x7E\xA0-\xFF]/g, "?").trim();
    const text = (str, x, top, maxW, size = 10) => {
      str = clean(str).replace(/\s*\n\s*/g, ", ");
      if (!str) return;
      while (size > 6 && font.widthOfTextAtSize(str, size) > maxW) size -= 0.5;
      page.drawText(str, { x, y: H - top, size, font, color: ink });
    };
    const mark = ([cx, cy]) => { const s = 8, w = font.widthOfTextAtSize("X", s); page.drawText("X", { x: cx - w / 2, y: H - cy - s * 0.36, size: s, font, color: ink }); };
    Object.entries(FORM.text).forEach(([id, [x, top, w]]) => text($(id).value, x, top, w));
    const radio = (name) => (document.querySelector(`input[name="${name}"]:checked`) || {}).value;
    if (radio("rf_aware")) mark(FORM.aware[radio("rf_aware")]);
    if (radio("rf_site")) mark(FORM.site[radio("rf_site")]);
    if ($("rf_violence").checked) mark(FORM.violence);
    if ($("rf_disease").checked) mark(FORM.disease);
    // Additional information: up to 2 lines
    const words = clean($("rf_info").value).replace(/\n/g, " ").split(/\s+/).filter(Boolean), lines = [""];
    words.forEach((w) => { const t = (lines[lines.length - 1] + " " + w).trim(); if (font.widthOfTextAtSize(t, 8.5) <= FORM.info.maxW) lines[lines.length - 1] = t; else lines.push(w); });
    lines.slice(0, 2).forEach((ln, i) => page.drawText(ln, { x: FORM.info.x, y: H - FORM.info.tops[i], size: 8.5, font, color: ink }));
    // Yes / No / Unknown boxes from the checklist
    Object.entries(FORM.rows).forEach(([key, [side, top]]) => {
      const a = state.answers[key];
      if (a && FORM.cols[side][a]) mark([FORM.cols[side][a], top]);
    });
    const bytes = await pdf.save();
    const name = `HospitalAtHome_${($("rf_last").value || "patient").replace(/[^A-Za-z0-9-]/g, "")}_${isoToday()}.pdf`;
    const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
    const a = document.createElement("a"); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    window.open(url, "_blank");
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    msg.textContent = (lines.length > 2 ? "Additional information was too long – only the first 2 lines were printed. " : "") + `PDF created (${name}). Review it, add anything missing by hand, and fax it.`;
  } catch (e) { msg.textContent = "Could not create the PDF: " + (e.message || e); }
}

// ---------- Summary text ----------
function summaryText() {
  const o = outcome();
  const by = (st) => state.items.filter((it) => statusOf(it.row, state.answers[it.row.key]) === st).map((it) => it.row.item);
  return [`Hospital at Home screen: ${o.title}`, o.code === "no" ? o.detail : "",
    "Favourable: " + (by("ok").join("; ") || "none"),
    "Concerns: " + (by("concern").join("; ") || "none"),
    "To confirm: " + (o.ask.map((a) => a.row.item).join("; ") || "none"),
    "Screen only – patient/family consent and Hospital at Home team review required."].filter(Boolean).join("\n");
}
function copyText(t) {
  const done = () => ($("pdfMsg").textContent = "Summary copied.");
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(done, () => ($("pdfMsg").textContent = "Copy failed."));
}

// ---------- Note retrieval (same approach as the other tools) ----------
const docDate = (d) => d.date || (d.context && d.context.period && d.context.period.start) || "";
function typeLabel(d) { return (d.type && (d.type.text || (d.type.coding || []).map((c) => c.display).find(Boolean))) || "Document"; }
const authorOf = (d) => (d.author && d.author[0] && d.author[0].display) || "";
function pickAttachment(doc) {
  const atts = (doc.content || []).map((c) => c.attachment).filter(Boolean);
  for (const p of ["text/plain", "text/html", "application/xhtml+xml", "application/pdf", "application/xml", "text/rtf"]) {
    const a = atts.find((x) => (x.contentType || "").toLowerCase().startsWith(p));
    if (a) return a;
  }
  return atts[0];
}
const b64ToBytes = (b64) => Uint8Array.from(atob(b64.replace(/\s+/g, "")), (c) => c.charCodeAt(0));
function htmlToText(html) {
  const d = new DOMParser().parseFromString(html, "text/html");
  d.querySelectorAll("script,style").forEach((n) => n.remove());
  d.querySelectorAll("br").forEach((n) => n.replaceWith("\n"));
  d.querySelectorAll("p,div,tr,li,h1,h2,h3,h4,h5,h6").forEach((n) => n.append("\n"));
  return (d.body.textContent || "").replace(/\n{3,}/g, "\n\n").trim();
}
async function pdfToText(bytes) {
  if (typeof pdfjsLib === "undefined") return "[PDF reader library failed to load]";
  pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js";
  const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
  const pages = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const content = await (await pdf.getPage(p)).getTextContent();
    let line = "", lastY = null, out = "";
    for (const it of content.items) {
      const y = it.transform[5];
      if (lastY !== null && Math.abs(y - lastY) > 2) { out += line.trimEnd() + "\n"; line = ""; }
      line += it.str + (it.hasEOL ? "\n" : "");
      lastY = y;
    }
    pages.push((out + line).trim());
  }
  return pages.join("\n\n").trim() || "[PDF had no extractable text]";
}
async function xmlToText(xml) {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  if (doc.querySelector("parsererror")) return htmlToText(xml);
  const pdfEl = [...doc.querySelectorAll("*")].find((el) => !el.children.length && /^\s*JVBER/.test(el.textContent));
  if (pdfEl) return pdfToText(b64ToBytes(pdfEl.textContent));
  doc.querySelectorAll("*").forEach((el) => { if (!el.children.length) el.append("\n"); });
  const root = doc.querySelector("document-data") || doc.documentElement;
  let text = (root.textContent || "").trim();
  if (/<\/?(p|div|br|span|table|html|body)\b[^>]*>/i.test(text)) text = htmlToText(text);
  return text.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}
async function authFetch(url, accept) {
  const go = () => fetch(url, { headers: { Authorization: "Bearer " + state.client.state.tokenResponse.access_token, Accept: accept } });
  try { await state.client.refreshIfNeeded(); } catch (e) {}
  let res = await go();
  if (res.status === 401) {
    try { await state.client.refresh(); } catch (e) { throw new Error("sign-in expired - relaunch the app from the sandbox"); }
    res = await go();
  }
  if (res.status === 401) throw new Error("HTTP 401 - sign-in expired, relaunch the app from the sandbox");
  if (!res.ok) throw new Error("HTTP " + res.status);
  return res;
}
async function getText(doc) {
  const att = pickAttachment(doc);
  if (!att) return "[No content attached]";
  const ct = (att.contentType || "").toLowerCase();
  try {
    let bytes = null;
    if (att.data) bytes = b64ToBytes(att.data);
    else if (att.url) bytes = new Uint8Array(await (await authFetch(new URL(att.url, state.client.state.serverUrl + "/").href, att.contentType || "*/*")).arrayBuffer());
    if (!bytes) return "[No content]";
    if (ct.startsWith("application/pdf")) return await pdfToText(bytes);
    if (ct.startsWith("image/")) return "[image]";
    const raw = new TextDecoder("utf-8").decode(bytes);
    if (/^\s*<\?xml/i.test(raw) || (ct.includes("xml") && !ct.includes("xhtml"))) return await xmlToText(raw);
    if (ct.includes("html")) return htmlToText(raw);
    if (ct.includes("rtf")) return raw.replace(/\\par[d]?/g, "\n").replace(/\\'[0-9a-f]{2}/gi, "").replace(/[{}]|\\[a-z]+-?\d* ?/gi, "").trim();
    return raw;
  } catch (e) { return "[Could not retrieve note: " + e.message + "]"; }
}
function viewNote(n, at, len) {
  const note = state.notes.find((x) => x.n === n);
  if (!note) return;
  const t = note.text;
  $("viewer").innerHTML = `<div class="card"><div class="toolbar" style="justify-content:space-between"><b>Note #${n} · ${esc(fmt(note.date))} · ${esc(note.type)}</b>
    <button class="sec" onclick="document.getElementById('viewer').innerHTML=''">Close</button></div>
    <pre>${esc(t.slice(0, at))}<mark id="hit">${esc(t.slice(at, at + len))}</mark>${esc(t.slice(at + len))}</pre></div>`;
  $("viewer").scrollIntoView({ behavior: "smooth" });
  const h = document.getElementById("hit"); if (h) h.scrollIntoView({ block: "center" });
}
window.viewNote = viewNote;

// ---------- Helpers ----------
function snippet(text, at, len) {
  const a = Math.max(0, at - 60), b = Math.min(text.length, at + len + 80);
  return (a > 0 ? "…" : "") + esc(text.slice(a, at)).replace(/\s+/g, " ") + `<mark>${esc(text.slice(at, at + len))}</mark>` + esc(text.slice(at + len, b)).replace(/\s+/g, " ") + (b < text.length ? "…" : "");
}
function setStatus(m) { $("status").textContent = m; }
const fmt = (d) => { const x = new Date(d); return isNaN(x) ? String(d || "") : x.toLocaleDateString([], { dateStyle: "medium" }); };
const fmtT = (d) => (isNaN(d) ? "" : d.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }));
function isoToday() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }
function ageOf(dob) {
  if (!dob) return null;
  const d = new Date(dob), t = new Date();
  let a = t.getFullYear() - d.getFullYear();
  if (t < new Date(t.getFullYear(), d.getMonth(), d.getDate())) a--;
  return isNaN(a) ? null : a;
}
function describe(p) {
  const n = (p.name && (p.name.find((x) => x.use === "official") || p.name[0])) || {};
  const a = ageOf(p.birthDate);
  return [(n.given || []).join(" "), n.family].filter(Boolean).join(" ") + ` · ${p.gender || ""}${a !== null ? " · " + a + " y" : ""} · DOB ${p.birthDate || "?"}`;
}
function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
