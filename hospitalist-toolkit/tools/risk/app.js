/* SMART on FHIR – chart screen for pressure injury, nutrition, sleep, dysphagia and falls (Cerner R4). Needs rules.js. */
const $ = (id) => document.getElementById(id);
const state = { client: null, patient: null };

FHIR.oauth2.ready().then(init).catch((e) => {
  $("out").innerHTML = `<div class="card err">Authorization error: ${esc(e.message)}. Launch from launch.html.</div>`;
});

async function init(client) {
  state.client = client;
  try { state.patient = await client.patient.read(); $("patient").textContent = describe(state.patient); }
  catch (e) { $("patient").textContent = "Patient " + client.patient.id; }
  $("go").disabled = false;
  $("go").onclick = run;
  run();
}

// ---------- Fetch notes ----------
async function run() {
  $("go").disabled = true;
  $("out").innerHTML = "";
  try {
    const n = Math.min(50, Math.max(5, parseInt($("count").value, 10) || 30));
    const days = +$("range").value;
    const cat = encodeURIComponent("http://hl7.org/fhir/us/core/CodeSystem/us-core-documentreference-category|clinical-note");
    let url = `DocumentReference?patient=${state.client.patient.id}&category=${cat}&_count=50`;
    if (days) url += `&date=ge${new Date(Date.now() - days * 864e5).toISOString().slice(0, 10)}`;
    setStatus("Finding notes…");
    let docs = (await state.client.request(url, { pageLimit: 10, flat: true }))
      .filter((d) => d.resourceType === "DocumentReference" && d.status !== "entered-in-error");
    docs.sort((a, b) => new Date(docDate(b)) - new Date(docDate(a)));
    docs = docs.slice(0, n);

    const notes = [];
    for (let i = 0; i < docs.length; i += 5) {
      setStatus(`Reading notes ${Math.min(i + 5, docs.length)} of ${docs.length}…`);
      const batch = await Promise.all(docs.slice(i, i + 5).map(async (d) => ({ type: typeLabel(d), date: docDate(d), author: authorOf(d), text: await getText(d) })));
      notes.push(...batch);
    }
    const readable = notes.filter((x) => x.text && x.text.length > 20 && !/^\[/.test(x.text));
    readable.forEach((n, i) => (n.n = i + 1));
    state.notes = readable;
    setStatus(`${readable.length} of ${notes.length} notes had readable text.`);
    render(assess(readable), notes, readable);
  } catch (e) {
    setStatus("Failed: " + (e.message || e), true);
  }
  $("go").disabled = false;
}

// ---------- Screening ----------
// "Nausea: No", "Falls: none", "Dizziness - denies" (the negative comes AFTER the word)
const NEG_AFTER = /^\s*[:=-]?\s*(no|none|nil|denies|denied|negative|absent|not present)\b/i;

// Is this match one of the rule's look-alike phrases ("high fall risk", "knee aspirated")?
function isLookAlike(r, text, m) {
  const skip = r.skip || r.skipNeg;
  if (!skip) return false;
  const a = Math.max(0, m.index - 40), win = text.slice(a, m.index + m[0].length + 40);
  const rx = new RegExp(skip.source, skip.flags.includes("g") ? skip.flags : skip.flags + "g");
  const s = m.index - a, e = s + m[0].length;
  if (r.skipNear) return rx.test(win); // a nearby word rules it out (e.g. "knee" near "aspirated")
  let k;
  while ((k = rx.exec(win))) {
    if (k[0].length === 0) { rx.lastIndex++; continue; }
    if (k.index < e && k.index + k[0].length > s) return true; // the look-alike phrase overlaps this match
  }
  return false;
}

function assess(notes) {
  const age = ageOf(state.patient && state.patient.birthDate);
  return DOMAINS.map((dom) => {
    const found = new Map(); // label -> {w, ev:[], negated}
    const negCount = {};
    const scoreDone = new Set(); // numeric scores (Braden, Morse, BMI): only the most recent note's value counts
    for (const note of notes) { // notes are newest first
      for (const [ri, r] of dom.rules.entries()) {
        if (r.fn) {
          if (scoreDone.has(ri)) continue;
          const hit = r.fn(note.text);
          if (hit === null) continue;
          scoreDone.add(ri); // the newest value was found (even if it is a normal/low-risk value)
          if (hit) addEv(found, hit.l + " - most recent", hit.w, note, hit.at, 0);
          continue;
        }
        const rx = new RegExp(r.re.source, r.re.flags.includes("g") ? r.re.flags : r.re.flags + "g");
        let m;
        while ((m = rx.exec(note.text))) {
          if (m[0].length === 0) { rx.lastIndex++; continue; }
          if (isLookAlike(r, note.text, m)) continue;
          const before = note.text.slice(Math.max(0, m.index - 70), m.index);
          const lineStart = before.lastIndexOf("\n");
          // A negative stops at "but/however" - "denies chest pain but has dizziness" keeps dizziness
          const sentence = before.slice(lineStart + 1).split(/[.;]/).pop().split(/\b(?:but|however|although|though|except)\b/i).pop();
          const after = note.text.slice(m.index + m[0].length, m.index + m[0].length + 25);
          if (NEGATION.test(sentence) || NEG_AFTER.test(after)) { negCount[r.l] = (negCount[r.l] || 0) + 1; continue; }
          addEv(found, r.l, r.w, note, m.index, m[0].length);
        }
      }
    }
    if (dom.key === "falls" && age !== null) {
      if (age >= 80) found.set("Age " + age + " (80 or older)", { w: 2, ev: [] });
      else if (age >= 65) found.set("Age " + age + " (65 or older)", { w: 1, ev: [] });
    }
    let score = 0, strong = false;
    found.forEach((v) => { score += v.w; if (v.w >= 3) strong = true; });
    // Cut-offs scale with how many rules the domain has (falls has far more than sleep),
    // and the top level needs at least one strong (weight 3) indicator.
    const max = dom.rules.reduce((t, r) => t + (r.fn ? 3 : r.w), 0);
    const hiCut = Math.max(8, Math.round(max * 0.3)), modCut = Math.max(4, Math.round(max * 0.15));
    const level = !notes.length ? "Insufficient data" : score >= hiCut && strong ? "High" : score >= modCut ? "Moderate" : score >= 1 ? "Low" : "None found";
    const allText = notes.map((n) => n.text).join("\n");
    const gaps = dom.gaps.filter((_, i) => !dom.gapRe[i].test(allText));
    const negated = Object.keys(negCount).filter((k) => !found.has(k));
    return { dom, found: [...found.entries()].sort((a, b) => b[1].w - a[1].w), score, level, gaps, negated, hiCut, modCut };
  });
}

function addEv(found, label, w, note, at, len) {
  const e = found.get(label) || { w, ev: [], notes: new Set() };
  e.notes.add(note.n);
  if (e.ev.length < 3) e.ev.push({ n: note.n, date: note.date, type: note.type, author: note.author, section: sectionAt(note.text, at), at, len, snip: snippet(note.text, at, len) });
  found.set(label, e);
}

// Nearest heading line (e.g. "Assessment/Plan:") above the match, for "where in the note".
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

// ---------- Render ----------
// Shown instead of "High/Moderate/Low" so the screen is not mistaken for a validated risk score
const LEVEL_TEXT = { High: "Many indicators", Moderate: "Some indicators", Low: "Few indicators", "None found": "None found", "Insufficient data": "Insufficient data" };
const lvl = (l) => LEVEL_TEXT[l] || l;
// "last mentioned Oct 12 (6 days before newest note)"
function lastSeen(v, newest) {
  if (!v.ev.length) return "";
  const d = new Date(v.ev[0].date);
  if (isNaN(d)) return "";
  const days = newest ? Math.round((newest - d) / 864e5) : 0;
  return ` · last mentioned ${esc(fmt(d))}` + (days > 30 ? ` <span class="old">(${days} days before the newest note)</span>` : "");
}
function render(results, allNotes, readable) {
  let html = "";
  if (!readable.length) html += `<div class="warn">No readable note text was found, so nothing could be screened. (${allNotes.length} notes found.)</div>`;
  html += `<section class="card"><div class="grid">` + results.map((r) =>
    `<div class="tile ${r.level}" onclick="document.getElementById('d-${r.dom.key}').open=true;document.getElementById('d-${r.dom.key}').scrollIntoView({behavior:'smooth'})">
      <b>${r.dom.title}</b><span class="lvl ${r.level}">${lvl(r.level)}</span> <span class="note">· ${r.found.length} indicator(s)</span></div>`).join("") + `</div>
    <p class="note">Keyword screen of ${readable.length} note(s) from ${esc(range(readable))}. It supports, and does not replace, a clinical assessment or validated tools (Braden, MNA/MUST, bedside swallow screen, Morse/STEADI).
    The labels describe how much supporting documentation was found, not a validated risk level.</p></section>`;
  const newest = Math.max(0, ...readable.map((n) => +new Date(n.date)).filter((t) => !isNaN(t)));

  html += results.map((r) => `<details id="d-${r.dom.key}" ${r.level === "High" || r.level === "Moderate" ? "open" : ""}>
    <summary>${r.dom.title} — <span class="lvl ${r.level}">${lvl(r.level)}</span> <span class="note">(score ${r.score}; "many" from ${r.hiCut} with a strong indicator, "some" from ${r.modCut})</span></summary>
    ${r.found.map(([label, v]) => { const total = v.notes ? v.notes.size : 0, shown = new Set(v.ev.map((e) => e.n)); const more = v.notes ? [...v.notes].filter((x) => !shown.has(x)) : [];
      return `<div class="f"><b>${esc(label)}</b> <span class="note">weight ${v.w}${total ? " · in " + total + " note" + (total > 1 ? "s" : "") : ""}${lastSeen(v, newest)}</span>${v.ev.map((e) =>
      `<div class="ev"><i>Note #${e.n} · ${esc(fmt(e.date))} · ${esc(e.type)}${e.author ? " · " + esc(e.author) : ""}${e.section ? " · section: " + esc(e.section) : ""}</i> <a href="#" onclick="viewNote(${e.n},${e.at},${e.len});return false">view note</a><br>${e.snip}</div>`).join("")}
      ${more.length ? `<div class="ev note">Also in note #${more.join(", #")} <a href="#" onclick="viewNote(${more[0]},-1,0);return false">view</a></div>` : ""}</div>`; }).join("") || `<p class="note">No indicators found in the notes reviewed.</p>`}
    ${r.negated.length ? `<div class="neg">Documented as absent/denied: ${r.negated.map(esc).join("; ")}</div>` : ""}
    ${r.gaps.length ? `<div class="neg">Not documented in these notes: ${r.gaps.map(esc).join("; ")}</div>` : ""}
  </details>`).join("");

  html += `<section class="card"><b>Notes reviewed</b><p class="note">${allNotes.map((n) => esc(fmt(n.date) + " " + n.type) + (n.text && !/^\[/.test(n.text) ? "" : " (unreadable)")).join(" · ") || "none"}</p></section>`;
  $("out").innerHTML = html;
}

const range = (ns) => { const d = ns.map((n) => new Date(n.date)).filter((x) => !isNaN(x)).sort((a, b) => a - b); return d.length ? fmt(d[0]) + " to " + fmt(d[d.length - 1]) : "unknown dates"; };

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

// Fetch note content with a fresh sign-in token. Cerner tokens expire after ~10 minutes, so renew first,
// and if the server still says 401 (expired), renew once more and retry.
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
