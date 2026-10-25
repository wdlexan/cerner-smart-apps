/* SMART on FHIR – ED note review for hospitalist-service suitability (Cerner R4). Decision support only.
   The criteria are NOT in this file: they are read from criteria.csv and measures.csv (edit those in Excel),
   using criteria-loader.js. */
const $ = (id) => document.getElementById(id);
const state = { client: null, patient: null, docs: [], notes: [] };
const ED_RE = /emergency|\bed\b|\ber\b|triage|admission|admit|h\s*&\s*p|history and physical/i;
const encOf = (d) => (d.context && d.context.encounter && d.context.encounter[0] && d.context.encounter[0].reference) || "";
const GROUP_ORDER = ["icu", "stepdown", "specialty", "hospitalist", "obs"];
const GROUP_TITLE = { icu: "ICU-level red flags", stepdown: "Higher-monitoring (step-down) indicators", specialty: "Specialty / surgical service indicators",
  hospitalist: "Hospitalist-appropriate indicators", obs: "Observation / discharge-leaning indicators" };
// A negative before the word ("denies", "no", "negative for") - stops at "but/however" so "denies X but has Y" keeps Y
const NEGATION = /\b(no|not|denies|denied|denying|negative for|neg for|without|never|free of|absence of|absent|ruled out|resolved|no evidence of|no history of|no h\/o|no signs? of|negative)\b[^.;\n]{0,45}$/i;
// A negative right after the word ("Nausea: No", "Chest pain - denies", "Troponin negative")
const NEG_AFTER = /^\s*[:=-]?\s*(no|none|nil|denies|denied|negative|absent|not present)\b/i;

FHIR.oauth2.ready().then(init).catch((e) => {
  $("out").innerHTML = `<div class="card err">Authorization error: ${esc(e.message)}. Launch from launch.html.</div>`;
});

async function init(client) {
  state.client = client;
  try { state.patient = await client.patient.read(); $("patient").textContent = describe(state.patient); }
  catch (e) { $("patient").textContent = "Patient " + client.patient.id; }
  // Load the editable criteria spreadsheets
  try { state.C = await loadCriteria(); }
  catch (e) {
    $("out").innerHTML = `<div class="card err"><b>The criteria spreadsheet could not be read.</b><br>${esc(e.message || e)}</div>`;
    return;
  }
  $("go").onclick = analyze;
  $("range").onchange = loadList;
  await loadList();
}

async function loadList() {
  setStatus("Finding notes…");
  try {
    const days = +$("range").value;
    const cat = encodeURIComponent("http://hl7.org/fhir/us/core/CodeSystem/us-core-documentreference-category|clinical-note");
    let url = `DocumentReference?patient=${state.client.patient.id}&category=${cat}&_count=50`;
    if (days) url += `&date=ge${new Date(Date.now() - days * 864e5).toISOString().slice(0, 10)}`;
    const docs = (await state.client.request(url, { pageLimit: 4, flat: true }))
      .filter((d) => d.resourceType === "DocumentReference" && d.status !== "entered-in-error");
    docs.sort((a, b) => new Date(docDate(b)) - new Date(docDate(a)));
    state.docs = docs;
    $("sel").innerHTML = docs.map((d, i) => `<option value="${i}">${esc(fmt(docDate(d)))} · ${esc(typeLabel(d))}${authorOf(d) ? " · " + esc(authorOf(d)) : ""}</option>`).join("");
    const first = docs.findIndex((d) => ED_RE.test(typeLabel(d)));
    if (docs.length) $("sel").value = String(first >= 0 ? first : 0);
    $("go").disabled = !docs.length;
    setStatus(docs.length ? `${docs.length} note(s) found. ${first >= 0 ? "An ED/admission-type note is preselected." : "No ED-type note found; the most recent note is selected."}` : "No notes found in this date range.");
    if (docs.length) analyze();
  } catch (e) { setStatus("Failed: " + (e.message || e), true); }
}

async function analyze() {
  const d = state.docs[+$("sel").value];
  if (!d) return;
  $("go").disabled = true; $("out").innerHTML = ""; $("viewer").innerHTML = "";
  try {
    let sel = [d];
    const enc = encOf(d);
    if ($("enc").checked && enc) sel = state.docs.filter((x) => encOf(x) === enc).reverse();
    setStatus(`Reading ${sel.length} note(s)…`);
    const notes = [];
    for (const x of sel) notes.push({ type: typeLabel(x), date: docDate(x), author: authorOf(x), text: await getText(x) });
    const readable = notes.filter((n) => n.text && n.text.length > 20 && !/^\[/.test(n.text));
    readable.forEach((n, i) => (n.n = i + 1));
    state.notes = readable;
    if (!readable.length) {
      $("out").innerHTML = `<div class="warn">The selected note has no readable text (${esc(notes.map((n) => n.text).join(" "))}).</div>`;
      setStatus("");
    } else {
      render(evaluate(readable), notes);
      setStatus(`Analyzed ${readable.length} note(s).`);
    }
  } catch (e) { setStatus("Failed: " + (e.message || e), true); }
  $("go").disabled = false;
}

// ---------- Evaluation ----------
function sectionAt(text, at) {
  const head = text.slice(Math.max(0, at - 2500), at).split("\n");
  for (let i = head.length - 2; i >= 0; i--) {
    const h = head[i].trim();
    if (h.length >= 3 && h.length <= 50 && (/^[A-Za-z][A-Za-z0-9 &\/,()-]*:\s*$/.test(h) || /^[A-Z][A-Z0-9 &\/-]{3,}$/.test(h))) return h.replace(/:\s*$/, "");
  }
  return "";
}
function snippet(text, at, len) {
  const a = Math.max(0, at - 60), b = Math.min(text.length, at + len + 80);
  const pre = esc(text.slice(a, at)).replace(/\s+/g, " "), mid = esc(text.slice(at, at + len)), post = esc(text.slice(at + len, b)).replace(/\s+/g, " ");
  return (a > 0 ? "…" : "") + pre + (len ? `<mark>${mid}</mark>` : "") + post + (b < text.length ? "…" : "");
}

function evaluate(notes) {
  const C = state.C;
  const F = {}; GROUP_ORDER.forEach((g) => (F[g] = new Map()));
  const add = (g, label, w, note, at, len, svc, policy) => {
    const e = F[g].get(label) || { w, svc, policy, ev: [], notes: new Set() };
    if (note) {
      e.notes.add(note.n);
      if (e.ev.length < 3) e.ev.push({ n: note.n, date: note.date, type: note.type, author: note.author, section: sectionAt(note.text, at), at, len, snip: snippet(note.text, at, len) });
    }
    F[g].set(label, e);
  };
  const negated = (text, idx, len) => {
    const before = text.slice(Math.max(0, idx - 70), idx);
    const clause = before.slice(before.lastIndexOf("\n") + 1).split(/[.;]/).pop().split(/\b(?:but|however|although|though|except)\b/i).pop();
    return NEGATION.test(clause) || (len != null && NEG_AFTER.test(text.slice(idx + len, idx + len + 25)));
  };
  // "Ignore when nearby" words from the spreadsheet (e.g. "rule out", "history of") within ~40 characters
  const ignored = (r, text, idx, len) => r.ignore && r.ignore.test(text.slice(Math.max(0, idx - 40), idx + len + 40));
  const find = (r, note, cb) => {
    const rx = new RegExp(r.re.source, "gi"); let m;
    while ((m = rx.exec(note.text))) {
      if (m[0].length === 0) { rx.lastIndex++; continue; }
      if (negated(note.text, m.index, m[0].length) || ignored(r, note.text, m.index, m[0].length)) continue;
      if (cb(m) === false) break;
    }
  };

  // 1. Text rules (criteria.csv)
  for (const g of GROUP_ORDER)
    for (const note of notes)
      for (const r of C.groups[g]) find(r, note, (m) => add(g, r.l, r.w, note, m.index, m[0].length, r.svc, r.policy));

  // 2. Vitals and labs (thresholds from measures.csv)
  const measures = [];
  for (const [name, def] of Object.entries(MEASURE_READERS)) {
    const vals = [];
    for (const note of notes) {
      const rx = new RegExp(def.re.source, "gi"); let m;
      while ((m = rx.exec(note.text))) {
        const v = def.pick ? def.pick(m) : +m[1];
        if (v == null || isNaN(v) || v < def.min || v > def.max) continue;
        vals.push({ v, note, at: m.index, len: m[0].length });
      }
    }
    if (!vals.length) continue;
    let flag = null;
    for (const r of C.measureRules[name] || []) {
      const hit = vals.find((x) => r.test(x.v));
      if (hit) { flag = r.l(hit.v); add(r.g, flag, r.w, hit.note, hit.at, hit.len); break; }
    }
    measures.push({ def: { name, unit: def.unit }, vals, flag });
  }

  // 3. qSOFA
  const get = (name) => (measures.find((m) => m.def.name === name) || { vals: [] }).vals;
  const comps = [];
  const rr = get("Respiratory rate").find((x) => x.v >= 22), sbp = get("Systolic BP").find((x) => x.v <= 100);
  if (rr) comps.push({ t: "RR ≥22", h: rr });
  if (sbp) comps.push({ t: "SBP ≤100", h: sbp });
  for (const note of notes) {
    const rx = /altered mental|confus|disorient|lethargic|obtund|unresponsive/gi; let m;
    while ((m = rx.exec(note.text))) if (!negated(note.text, m.index, m[0].length)) { comps.push({ t: "altered mentation", h: { note, at: m.index, len: m[0].length } }); break; }
    if (comps.some((c) => c.t === "altered mentation")) break;
  }
  if (comps.length >= 2) add("stepdown", `qSOFA ${comps.length}/3 (${comps.map((c) => c.t).join(", ")})`, 2, comps[0].h.note, comps[0].h.at, comps[0].h.len);

  // 4. Age and comorbidity burden
  const age = ageOf(state.patient && state.patient.birthDate);
  if (age !== null && age < 18) add("specialty", `Pediatric patient (age ${age})`, 3, null, 0, 0, "Pediatrics");
  else if (age !== null && age >= 65) add("hospitalist", `Age ${age}`, age >= 80 ? 2 : 1, null, 0, 0);
  const found = [];
  for (const c of C.comorb) {
    let ok = null;
    for (const note of notes) {
      find(c, note, (m) => { ok = { note, at: m.index, len: m[0].length }; return false; });
      if (ok) { found.push([c.l, ok]); break; }
    }
  }
  if (found.length >= 3) {
    const label = `Multiple chronic conditions (${found.map((f) => f[0]).join(", ")})`;
    found.slice(0, 3).forEach(([, h]) => add("hospitalist", label, found.length >= 5 ? 3 : 2, h.note, h.at, h.len));
  }

  const S = {}; GROUP_ORDER.forEach((g) => { S[g] = 0; F[g].forEach((v) => (S[g] += v.w)); });
  const all = notes.map((n) => n.text).join("\n");
  const missing = C.checks.filter((g) => !g.re.test(all)).map((g) => g.l);
  return { F, S, measures, rec: recommend(F, S), missing, age, qsofa: comps.length };
}

function recommend(F, S) {
  const strong = [...F.specialty.values()].filter((v) => v.w >= 3);
  const svcs = [...new Set(strong.map((v) => v.svc).filter(Boolean))];
  if (S.icu >= 3) return { code: "icu", title: "Consider ICU / critical care", detail: "Red-flag findings of critical illness are present. Hospitalist admission is generally not the best fit until the patient is stabilized; involve critical care." };
  if (strong.length) {
    if (S.hospitalist >= 6) return { code: "mixed", title: "Hospitalist admission with specialty consult", detail: `Significant medical problems plus a condition that needs ${svcs.join(", ")}. Hospitalist as the primary service with consultation or co-management is reasonable.` };
    return { code: "specialty", title: `Consider ${svcs.join(" / ")} as the primary service`, detail: "The dominant problem appears to need a specialty or surgical service. A hospitalist consult or co-management can address the medical issues." };
  }
  if (S.stepdown >= 3) return { code: "monitored", title: "Hospitalist with higher-level monitoring", detail: "Findings suggest a medical admission that may need step-down or progressive care. Check unit capability and consider a critical care consult." };
  if (S.hospitalist >= 3) return { code: "hospitalist", title: "Likely appropriate for the hospitalist service", detail: "Acute medical problems and/or comorbidity burden are documented, and no ICU or specialty-service red flags were found." };
  if (S.obs >= 3) return { code: "obs", title: "Consider observation or discharge from the ED", detail: "Low-risk or improving features were found without clear acute inpatient medical problems." };
  return { code: "unclear", title: "Not enough information in the note", detail: "Too few clinical indicators were found to suggest a service. Check the missing-information list below." };
}

// ---------- Rendering ----------
const SCORE_LABEL = { icu: "ICU", stepdown: "Step-down", specialty: "Specialty", hospitalist: "Hospitalist", obs: "Observation" };

function evLines(v) {
  const shown = new Set(v.ev.map((e) => e.n)), more = [...v.notes].filter((x) => !shown.has(x));
  return v.ev.map((e) => `<div class="ev"><i>Note #${e.n} · ${esc(fmt(e.date))} · ${esc(e.type)}${e.author ? " · " + esc(e.author) : ""}${e.section ? " · section: " + esc(e.section) : ""}</i> <a href="#" onclick="viewNote(${e.n},${e.at},${e.len});return false">view note</a><br>${e.snip}</div>`).join("") +
    (more.length ? `<div class="ev note">Also in note #${more.join(", #")}</div>` : "");
}

function render(R, allNotes) {
  const { F, S, measures, rec, missing } = R;
  let html = `<section class="banner ${rec.code}"><b>${esc(rec.title)}</b><div>${esc(rec.detail)}</div></section>`;
  html += `<section class="card"><div class="chips">` + GROUP_ORDER.map((g) => `<span class="chip ${S[g] >= 3 ? "on" : ""}">${SCORE_LABEL[g]}: ${S[g]}</span>`).join("") +
    `</div><p class="note">Scores add the weight of each distinct finding (3 strong, 2 moderate, 1 minor); 3 or more in a category counts as a signal. This is a keyword screen of the note and supports, but does not replace, the admitting physician's judgment and your hospital's admission criteria.</p></section>`;

  if (measures.length) {
    html += `<section class="card"><b>Vitals and labs found in the note</b><table><thead><tr><th>Measure</th><th>Values documented</th><th>Flag</th></tr></thead><tbody>` +
      measures.map((m) => { const u = [...new Set(m.vals.map((x) => x.v))].slice(0, 6).join(", ");
        return `<tr><td>${esc(m.def.name)}</td><td>${esc(u)} ${esc(m.def.unit)}</td><td>${m.flag ? `<span class="flag">${esc(m.flag)}</span>` : '<span class="note">—</span>'}</td></tr>`; }).join("") + `</tbody></table></section>`;
  } else html += `<div class="warn">No vitals or labs could be read from the note text.</div>`;

  html += GROUP_ORDER.map((g) => {
    const items = [...F[g].entries()].sort((a, b) => b[1].w - a[1].w);
    return `<details ${S[g] >= 3 && g !== "obs" ? "open" : ""}><summary>${GROUP_TITLE[g]} <span class="note">(score ${S[g]})</span></summary>` +
      (items.map(([label, v]) => `<div class="f"><b>${esc(label)}</b> <span class="note">weight ${v.w}${v.svc ? " · " + esc(v.svc) : ""}${v.policy ? " · " + esc(v.policy) : ""}${v.notes.size ? " · in " + v.notes.size + " note" + (v.notes.size > 1 ? "s" : "") : ""}</span>${evLines(v)}</div>`).join("") || `<p class="note">Nothing found.</p>`) + `</details>`;
  }).join("");

  html += `<section class="card"><b>Clarify with the ED (not found in the note)</b><p class="note">${missing.length ? missing.map(esc).join(" · ") : "Nothing obvious is missing."}</p></section>`;

  const lines = [
    describe(state.patient || {}), `Screen result: ${rec.title}`, rec.detail,
    "Key findings: " + GROUP_ORDER.flatMap((g) => [...F[g].keys()].map((k) => `[${SCORE_LABEL[g]}] ${k}`)).join("; "),
    "Vitals/labs: " + (measures.map((m) => `${m.def.name} ${[...new Set(m.vals.map((x) => x.v))].join("/")}${m.flag ? " (" + m.flag + ")" : ""}`).join("; ") || "none found"),
    "To clarify: " + (missing.join(", ") || "none"), "Keyword screen only; physician review required."
  ].join("\n");
  html += `<section class="card"><b>Handoff summary</b> <button class="sec" id="copy">Copy</button><pre id="sum">${esc(lines)}</pre></section>`;
  const C = state.C;
  html += `<section class="card"><b>Criteria used</b><p class="note">${C.counts.findings} findings, ${C.counts.comorb} comorbidities and ${C.counts.checks} "clarify" checks from <b>criteria.csv</b>;
    ${C.counts.measures} vital/lab thresholds from <b>measures.csv</b>. Edit those files in Excel to change what is screened - no code changes needed.</p>
    ${C.problems.length ? `<div class="warn"><b>${C.problems.length} row(s) in the spreadsheets were skipped:</b><br>${C.problems.map(esc).join("<br>")}</div>` : ""}</section>`;
  html += `<section class="card"><b>Notes analyzed</b><p class="note">${allNotes.map((n) => esc(fmt(n.date) + " " + n.type) + (n.n ? " (#" + n.n + ")" : " (unreadable)")).join(" · ")}</p></section>`;
  $("out").innerHTML = html;
  $("copy").onclick = () => navigator.clipboard.writeText(lines).then(() => setStatus("Summary copied."));
}

// ---------- Note retrieval (same approach as the note compiler) ----------
const docDate = (d) => d.date || (d.context && d.context.period && d.context.period.start) || "";
function typeLabel(d) { return (d.type && (d.type.text || (d.type.coding || []).map((c) => c.display).find(Boolean))) || "Document"; }

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

// Fetch note content with a fresh sign-in token (Cerner tokens expire after ~10 minutes).
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
    let raw = null, bytes = null;
    if (att.data) { bytes = b64ToBytes(att.data); }
    else if (att.url) {
      const url = new URL(att.url, state.client.state.serverUrl + "/").href;
      const res = await authFetch(url, att.contentType || "*/*");
      bytes = new Uint8Array(await res.arrayBuffer());
    }
    if (!bytes) return "[No content]";
    if (ct.startsWith("application/pdf")) return await pdfToText(bytes);
    if (ct.startsWith("image/")) return "[image]";
    raw = new TextDecoder("utf-8").decode(bytes);
    if (/^\s*<\?xml/i.test(raw) || (ct.includes("xml") && !ct.includes("xhtml"))) return await xmlToText(raw);
    if (ct.includes("html")) return htmlToText(raw);
    if (ct.includes("rtf")) return raw.replace(/\\par[d]?/g, "\n").replace(/\\'[0-9a-f]{2}/gi, "").replace(/[{}]|\\[a-z]+-?\d* ?/gi, "").trim();
    return raw;
  } catch (e) { return "[Could not retrieve note: " + e.message + "]"; }
}

// ---------- Full-note viewer ----------
function viewNote(n, at, len) {
  const note = (state.notes || []).find((x) => x.n === n);
  if (!note) return;
  const t = note.text;
  const body = at >= 0 ? esc(t.slice(0, at)) + `<mark id="hit">${esc(t.slice(at, at + len))}</mark>` + esc(t.slice(at + len)) : esc(t);
  $("viewer").innerHTML = `<div class="card"><div class="row" style="justify-content:space-between"><b>Note #${n} · ${esc(fmt(note.date))} · ${esc(note.type)}${note.author ? " · " + esc(note.author) : ""}</b>
    <button class="sec" onclick="document.getElementById('viewer').innerHTML=''">Close</button></div>
    <pre style="white-space:pre-wrap;font-size:13px;max-height:420px;overflow:auto;background:#fbfcfd;border:1px solid var(--line);border-radius:6px;padding:10px">${body}</pre></div>`;
  $("viewer").scrollIntoView({ behavior: "smooth" });
  const h = document.getElementById("hit"); if (h) h.scrollIntoView({ block: "center" });
}
const authorOf = (d) => (d.author && d.author[0] && d.author[0].display) || "";

// ---------- Helpers ----------
function setStatus(m, err) { $("status").textContent = m; $("status").style.color = err ? "#b00020" : ""; }
const fmt = (d) => { const x = new Date(d); return isNaN(x) ? String(d || "") : x.toLocaleDateString([], { dateStyle: "medium" }); };
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
