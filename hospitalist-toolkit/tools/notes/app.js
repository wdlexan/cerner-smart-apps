/* SMART on FHIR – Clinical Note Compiler (Cerner R4)
   v2: notes grouped by heading (Progress, Consult, PT/OT …), a key-section summary per heading,
   a complete summary across all notes, and downloads (.txt and Word).
   Everything runs in this browser; note text is not sent anywhere except back to you. */

// Note-type headings. A note goes under the FIRST rule that matches its type/category text,
// so the specific services (PT/OT, SLP …) are checked before the general words (consult, progress).
// "abbr" is matched case-sensitively, so "PT" counts but "Pt" (patient) does not. Edit freely.
const TYPE_RULES = [
  { key: "ptot",      label: "PT / OT (Rehab)",          re: /physio|physical therap|occupational therap|rehab/i, abbr: /\b(PT|OT)\b/ },
  { key: "slp",       label: "Speech-Language (SLP)",    re: /speech|swallow|dysphagia/i, abbr: /\bSLP\b/ },
  { key: "diet",      label: "Dietitian / Nutrition",    re: /dietit|nutrition/i },
  { key: "sw",        label: "Social Work",              re: /social work/i },
  { key: "pharm",     label: "Pharmacy",                 re: /pharmac/i },
  { key: "nursing",   label: "Nursing",                  re: /nurs/i },
  { key: "discharge", label: "Discharge Summaries",      re: /discharge/i },
  { key: "hp",        label: "H&P / Admission",          re: /history and physical|h&p|admission|h\s*&\s*p/i },
  { key: "consult",   label: "Consults",                 re: /consult/i },
  { key: "progress",  label: "Progress Notes",           re: /progress/i },
  { key: "procedure", label: "Operative / Procedure",    re: /operative|procedure|surgery/i },
  { key: "radiology", label: "Radiology / Imaging",      re: /radiolog|imaging|x-ray|\bct\b|\bmri\b|ultrasound/i },
  { key: "other",     label: "Everything else",          re: null } // catch-all
];
// The order the headings appear in the compiled document
const HEADING_ORDER = ["hp", "progress", "consult", "ptot", "slp", "nursing", "diet", "sw", "pharm", "procedure", "radiology", "discharge", "other"];
const LABEL = Object.fromEntries(TYPE_RULES.map((t) => [t.key, t.label]));

// Which section of each note type is the "summary" part. Checked in order; the first one found is used.
const AP = /^(assessment\s*(and|&|\/)\s*plan|a\s*\/\s*p|impression\s*(and|&|\/)\s*plan)\b/i;
const KEY_SECTIONS = {
  progress:  [AP, /^assessment\b/i, /^impression\b/i, /^plan\b/i],
  hp:        [AP, /^assessment\b/i, /^impression\b/i, /^plan\b/i],
  consult:   [/^recommendations?\b/i, /^impression\b/i, AP, /^assessment\b/i, /^plan\b/i],
  ptot:      [/^(discharge )?recommendations?\b/i, /^assessment\b/i, /^discharge plan\b/i, /^plan\b/i, /^goals?\b/i],
  slp:       [/^(diet )?recommendations?\b/i, /^impression\b/i, /^assessment\b/i, /^plan\b/i],
  diet:      [/^recommendations?\b/i, /^nutrition (diagnosis|intervention)\b/i, /^assessment\b/i, /^plan\b/i],
  sw:        [/^(discharge )?plan(ning)?\b/i, /^assessment\b/i, /^summary\b/i],
  pharm:     [/^recommendations?\b/i, /^assessment\b/i, /^plan\b/i],
  nursing:   [/^(shift )?summary\b/i, /^events?\b/i, /^assessment\b/i, /^plan\b/i],
  discharge: [/^discharge diagnos[ie]s\b/i, /^(final |principal )?diagnos[ie]s\b/i, /^hospital course\b/i, /^follow.?up\b/i],
  procedure: [/^(impression|conclusion)\b/i, /^findings\b/i, /^post.?op(erative)? diagnosis\b/i],
  radiology: [/^(impression|conclusion)\b/i, /^findings\b/i],
  other:     [AP, /^impression\b/i, /^recommendations?\b/i, /^summary\b/i, /^assessment\b/i, /^plan\b/i]
};
// A summary section ends when one of these sections starts
const STOP = /^(subjective|objective|hpi|history of present|review of systems|ros\b|physical exam|exam\b|vital|labs?\b|laboratory|results|current medications|medications?\s*:|allergies|past (medical|surgical)|social history|family history|electronically signed|signed by|signature|cc\s*:|copy to|dictated|transcribed|time spent|attestation|reason for (consult|referral)|chief complaint)/i;

// Symptom scan (same as the What Changed panel)
const SYMPTOMS = [
  { key: "pain",    label: "Pain",                  re: /\bpain(ful)?\b|\baching\b|\bdiscomfort\b/gi, skip: /pain (scale|assessment tool)|acute pain service|pain team/i },
  { key: "chest",   label: "Chest pain",            re: /chest (pain|tightness|pressure)|\bangina\b/gi },
  { key: "nausea",  label: "Nausea / vomiting",     re: /\bnause\w*|\bvomit\w*|\bemesis\b|\bretching\b/gi },
  { key: "confus",  label: "Confusion / delirium",  re: /\bconfus\w*|\bdelirium\b|\bdelirious\b|\bdisorient\w*|\bagitat\w*|altered mental|\bAMS\b|hallucinat\w*|sundown\w*/gi },
  { key: "fall",    label: "Fall",                  re: /\bfall\b|\bfell\b|\bfallen\b|found on (the )?floor|\bfalls\b/gi,
    skip: /falls? (risk|precaution|prevention|score|bundle|mat|alarm)|risk (of|for) falls?|morse|fall-risk|prevent\w* falls?/i },
  { key: "sob",     label: "Shortness of breath",   re: /short(ness)? of breath|\bSOB\b|\bdyspn\w*|\bdesat\w*|increas\w* (O2|oxygen)|work of breathing/gi },
  { key: "fever",   label: "Fever / rigors",        re: /\bfebrile\b|\bfevers?\b|\brigou?rs\b|\bchills\b/gi },
  { key: "bleed",   label: "Bleeding",              re: /\bbleed\w*|hematemesis|haematemesis|melena|melaena|hematochezia|hemoptysis|blood in (the )?(stool|urine)|coffee.?ground/gi },
  { key: "diarr",   label: "Diarrhea",              re: /diarrh\w*|loose stools?|watery stools?/gi },
  { key: "constip", label: "Constipation",          re: /constipat\w*|no bowel movement|no BM\b|impaction/gi, noNeg: true },
  { key: "dizzy",   label: "Dizziness / syncope",   re: /\bdizz\w*|light.?headed\w*|\bsyncop\w*|presyncop\w*|\bvertigo\b/gi },
  { key: "intake",  label: "Poor oral intake",      re: /poor (oral |po )?intake|not eating|decreased appetite|\banorexi\w*|refus\w* (meals|food|to eat)/gi, noNeg: true },
  { key: "rrt",     label: "Rapid response / code", re: /rapid response|code blue|\bMET call|\bRRT\b|transfer\w* to (the )?ICU/gi, noNeg: true },
  { key: "goc",     label: "Goals of care",         re: /goals of care|\bGOC\b|\bDNR\b|palliative|comfort care/g, noNeg: true }
];
const NEG_BEFORE = /\b(no|denies|denied|deny|denying|without|negative for|not|nil|absence of|free of|resolved|ruled out|r\/o)\b(?![^,;]*\b(but|however|although|except|now)\b)[^.;]{0,45}$/i;
const NEG_AFTER = /^\s*[:=-]?\s*(no|none|denies|denied|negative|absent|nil|0\s*\/\s*10|not present)\b/i;

const MAX_PER_TYPE = 25;
const state = { client: null, patient: null, docs: [], texts: new Map(), compiled: null };
const $ = (id) => document.getElementById(id);

// ---------- Start-up ----------
FHIR.oauth2.ready().then(init).catch((err) => {
  setStatus("Authorization error: " + err.message + ". Launch the app from launch.html.", true);
  $("patient").textContent = "Not connected";
});

async function init(client) {
  state.client = client;
  buildTypeBoxes();
  try {
    state.patient = await client.patient.read();
    $("patient").textContent = describePatient(state.patient);
  } catch (e) {
    $("patient").textContent = "Patient ID: " + client.patient.id;
  }
  $("searchBtn").disabled = false;
  $("searchBtn").onclick = searchDocs;
  $("selAll").onclick = () => setAllChecked(true);
  $("selNone").onclick = () => setAllChecked(false);
  $("compileBtn").onclick = compile;
  $("order").onchange = () => { if (!$("outCard").classList.contains("hidden")) compile(); };
  $("copyBtn").onclick = copyOutput;
  $("dlBtn").onclick = downloadText;
  $("docBtn").onclick = downloadWord;
  $("printBtn").onclick = printOutput;
  $("openAll").onclick = () => document.querySelectorAll("#output details").forEach((d) => (d.open = true));
  $("closeAll").onclick = () => document.querySelectorAll("#output details.full").forEach((d) => (d.open = false));
}

function buildTypeBoxes() {
  $("typeBoxes").innerHTML = HEADING_ORDER.map((k) =>
    `<label><input type="checkbox" class="typeChk" value="${k}" checked> ${esc(LABEL[k])}</label>`
  ).join("");
  // "Select all types" / "Unselect all types" buttons, placed just above the tick boxes
  if (!$("typeAll")) {
    const bar = document.createElement("div");
    bar.className = "toolbar";
    bar.innerHTML = `<button type="button" class="secondary" id="typeAll">Select all types</button>` +
      `<button type="button" class="secondary" id="typeNone">Unselect all types</button>`;
    $("typeBoxes").before(bar);
    const setTypes = (v) => document.querySelectorAll(".typeChk").forEach((c) => (c.checked = v));
    $("typeAll").onclick = () => setTypes(true);
    $("typeNone").onclick = () => setTypes(false);
  }
}

function describePatient(p) {
  const n = (p.name && (p.name.find((x) => x.use === "official") || p.name[0])) || {};
  const name = [(n.given || []).join(" "), n.family].filter(Boolean).join(" ") || "Unknown";
  const mrn = (p.identifier || []).find((i) => /MR/i.test(JSON.stringify(i.type || "")));
  return `${name} · DOB ${p.birthDate || "?"} · ${p.gender || ""}` + (mrn ? ` · MRN ${mrn.value}` : "");
}

// ---------- Search ----------
function classify(doc) {
  const text = docTypeText(doc);
  for (const t of TYPE_RULES) if ((t.re && t.re.test(text)) || (t.abbr && t.abbr.test(text))) return t.key;
  return "other";
}

function docTypeText(doc) {
  const parts = [];
  if (doc.type) parts.push(doc.type.text, ...(doc.type.coding || []).map((c) => c.display));
  (doc.category || []).forEach((c) => parts.push(c.text, ...(c.coding || []).map((x) => x.display)));
  return parts.filter(Boolean).join(" ");
}

function docTypeLabel(doc) {
  return (doc.type && (doc.type.text || (doc.type.coding || []).map((c) => c.display).find(Boolean))) || "Document";
}
function docAuthor(doc) { return (doc.author && doc.author[0] && doc.author[0].display) || ""; }
function docDate(doc) {
  return doc.date || (doc.context && doc.context.period && doc.context.period.start) || "";
}

async function searchDocs() {
  const selected = [...document.querySelectorAll(".typeChk:checked")].map((c) => c.value);
  if (!selected.length) return setStatus("Pick at least one document type.", true);

  let n = parseInt($("count").value, 10);
  if (!n || n < 1) n = 5;
  n = Math.min(n, MAX_PER_TYPE);
  $("count").value = n;

  $("searchBtn").disabled = true;
  $("listCard").classList.add("hidden");
  $("outCard").classList.add("hidden");
  setStatus("Searching…");

  try {
    const pid = state.client.patient.id;
    const cat = encodeURIComponent("http://hl7.org/fhir/us/core/CodeSystem/us-core-documentreference-category|clinical-note");
    let url = `DocumentReference?patient=${pid}&category=${cat}&_count=50`;
    const since = $("since").value;
    if (since) url += `&date=ge${since}`;

    // Follow paging links (up to 10 pages) and flatten to resources.
    const resources = await state.client.request(url, { pageLimit: 10, flat: true });

    const all = resources.filter((r) => r.resourceType === "DocumentReference")
      .filter((d) => d.status !== "entered-in-error")
      .map((d) => ((d._group = classify(d)), d))
      .filter((d) => selected.includes(d._group))
      .sort((a, b) => new Date(docDate(b)) - new Date(docDate(a)));

    // Keep the newest n of EACH type, so one busy type (e.g. nursing) can't crowd out the others
    const perType = {};
    state.docs = all.filter((d) => (perType[d._group] = (perType[d._group] || 0) + 1) <= n);
    state.texts.clear();

    if (!state.docs.length) {
      setStatus("No matching documents found.");
    } else {
      renderList();
      setStatus(`Found ${state.docs.length} document(s) (of ${all.length} matching; newest ${n} per type).`);
    }
  } catch (e) {
    setStatus("Search failed: " + (e.message || e), true);
  } finally {
    $("searchBtn").disabled = false;
  }
}

function renderList() {
  const rows = [];
  HEADING_ORDER.forEach((g) => {
    const items = state.docs.map((d, i) => [d, i]).filter(([d]) => d._group === g);
    if (!items.length) return;
    rows.push(`<tr class="grprow"><td><input type="checkbox" class="grpChk" data-g="${g}" checked></td>
      <td colspan="4"><b>${esc(LABEL[g])}</b> <span class="muted">(${items.length})</span></td></tr>`);
    items.forEach(([d, i]) => {
      const fmt = (d.content || []).map((c) => c.attachment && c.attachment.contentType).filter(Boolean).join(", ");
      rows.push(`<tr>
        <td><input type="checkbox" class="docChk" data-i="${i}" data-g="${g}" checked></td>
        <td>${esc(fmtDate(docDate(d)))}</td>
        <td>${esc(docTypeLabel(d))}</td>
        <td>${esc(docAuthor(d))}</td>
        <td class="muted">${esc(fmt)}</td></tr>`);
    });
  });
  $("docRows").innerHTML = rows.join("");
  document.querySelectorAll(".grpChk").forEach((g) => (g.onchange = () =>
    document.querySelectorAll(`.docChk[data-g="${g.dataset.g}"]`).forEach((c) => (c.checked = g.checked))));
  $("listCard").classList.remove("hidden");
}

function setAllChecked(v) {
  document.querySelectorAll(".docChk, .grpChk").forEach((c) => (c.checked = v));
}

// ---------- Retrieve note content ----------
function pickAttachment(doc) {
  const atts = (doc.content || []).map((c) => c.attachment).filter(Boolean);
  const pref = ["text/plain", "text/html", "application/xhtml+xml", "text/rtf", "application/xml"];
  for (const p of pref) {
    const a = atts.find((x) => (x.contentType || "").toLowerCase().startsWith(p));
    if (a) return a;
  }
  return atts[0];
}

function b64ToUtf8(b64) {
  const bin = atob(b64);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder("utf-8").decode(bytes);
}

function htmlToText(html) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll("script,style").forEach((n) => n.remove());
  doc.querySelectorAll("br").forEach((n) => n.replaceWith("\n"));
  doc.querySelectorAll("p,div,tr,li,h1,h2,h3,h4,h5,h6").forEach((n) => n.append("\n"));
  return (doc.body.textContent || "").replace(/\n{3,}/g, "\n\n").trim();
}

// Cerner often returns notes as XML (<report><clinical-data><document-data>...).
// Pull out the text; if the body is escaped/embedded HTML, convert that too.
function b64ToBytes(b64) {
  const bin = atob(b64.replace(/\s+/g, ""));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

// Extract text from PDF bytes using pdf.js (loaded in index.html).
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
    out += line;
    pages.push(out.trim());
  }
  const text = pages.join("\n\n").trim();
  return text || "[PDF contained no extractable text (it may be a scanned image)]";
}

async function xmlToText(xml) {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  if (doc.querySelector("parsererror")) return htmlToText(xml);

  // Cerner embeds the note as a base64 PDF inside the XML.
  const pdfEl = [...doc.querySelectorAll("*")].find(
    (el) => !el.children.length && /^\s*JVBER/.test(el.textContent)
  );
  if (pdfEl) return await pdfToText(b64ToBytes(pdfEl.textContent));

  // Put a line break after every element so fields don't run together.
  doc.querySelectorAll("*").forEach((el) => {
    if (!el.children.length) el.append("\n");
  });

  const root = doc.querySelector("document-data") || doc.documentElement;
  let text = (root.textContent || "").trim();

  // Body may be HTML-in-XML (escaped or CDATA).
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
  if (state.texts.has(doc.id)) return state.texts.get(doc.id);
  const att = pickAttachment(doc);
  let text;
  if (!att) {
    text = "[No content attached]";
  } else {
    const ct = (att.contentType || "").toLowerCase();
    try {
      let raw;
      if (att.data) {
        raw = b64ToUtf8(att.data);
      } else if (att.url) {
        const url = new URL(att.url, state.client.state.serverUrl + "/").href;
        const res = await authFetch(url, att.contentType || "*/*");
        if (ct.startsWith("application/pdf")) {
          raw = await pdfToText(new Uint8Array(await res.arrayBuffer()));
        } else if (ct.startsWith("image/")) {
          raw = null;
        } else {
          raw = await res.text();
        }
      }
      if (raw === null || raw === undefined) text = `[${ct || "binary"} content cannot be shown as text]`;
      else if (/^\s*<\?xml/i.test(raw) || (ct.includes("xml") && !ct.includes("xhtml"))) text = await xmlToText(raw);
      else if (ct.includes("html")) text = htmlToText(raw);
      else if (ct.includes("rtf")) text = raw.replace(/\\par[d]?/g, "\n").replace(/\\'[0-9a-f]{2}/gi, "").replace(/[{}]|\\[a-z]+-?\d* ?/gi, "").trim();
      else text = raw;
    } catch (e) {
      text = "[Could not retrieve note: " + e.message + "]";
    }
  }
  state.texts.set(doc.id, text);
  return text;
}

// ---------- Summaries ----------
// Pull the key section (A&P, Recommendations, Impression …) out of a note.
function keySection(text, group) {
  const lines = (text || "").replace(/\r/g, "").split("\n").map((l) => l.trim());
  const isHeaderLine = (l) => l.length <= 70 || /^[A-Za-z][A-Za-z &\/()-]{1,45}:/.test(l);
  for (const re of KEY_SECTIONS[group] || KEY_SECTIONS.other) {
    const i = lines.findIndex((l) => re.test(l) && isHeaderLine(l));
    if (i < 0) continue;
    const head = lines[i].replace(/:.*$/, "").trim();
    const first = lines[i].includes(":") ? lines[i].slice(lines[i].indexOf(":") + 1).trim() : "";
    const out = first ? [first] : [];
    let chars = first.length;
    for (let j = i + 1; j < lines.length && out.length < 30 && chars < 1500; j++) {
      const l = lines[j];
      if (STOP.test(l)) break;
      if (!l && out.length && !lines[j + 1]) break; // two blank lines in a row = end of section
      if (!l) continue;
      out.push(l); chars += l.length;
    }
    if (out.length) return { head, text: out.join("\n"), found: true };
  }
  // No recognisable section: use the opening lines so there is still something to read
  const opening = lines.filter(Boolean).slice(0, 6).join("\n");
  return { head: "Opening lines (no summary section found)", text: opening.slice(0, 500) + (opening.length > 500 ? "…" : ""), found: false };
}

function findSymptoms(notes) {
  const hits = SYMPTOMS.map((s) => ({ s, pos: [], neg: [] }));
  notes.forEach((n, ni) => {
    const sentences = (n.text || "").replace(/\r/g, "").split(/(?<=[.!?])\s+|\n+/).map((x) => x.trim()).filter(Boolean);
    sentences.forEach((sen) => {
      hits.forEach((h) => {
        h.s.re.lastIndex = 0;
        let m;
        while ((m = h.s.re.exec(sen))) {
          const around = sen.slice(Math.max(0, m.index - 30), m.index + m[0].length + 30);
          if (h.s.skip && h.s.skip.test(around)) continue;
          const before = sen.slice(Math.max(0, m.index - 60), m.index);
          const after = sen.slice(m.index + m[0].length, m.index + m[0].length + 20);
          const negated = !h.s.noNeg && (NEG_BEFORE.test(before) || NEG_AFTER.test(after));
          (negated ? h.neg : h.pos).push({ ni, sen });
          break;
        }
      });
    });
  });
  return hits;
}
// "Confusion / delirium (2 notes, last Oct 17)"
function symptomLines(notes) {
  const hits = findSymptoms(notes);
  const pos = hits.filter((h) => h.pos.length).map((h) => {
    const ns = [...new Set(h.pos.map((x) => x.ni))];
    const last = Math.max(...ns.map((i) => +notes[i].when));
    return `${h.s.label} (${ns.length} note${ns.length > 1 ? "s" : ""}, last ${fmtShort(new Date(last))})`;
  });
  const neg = hits.filter((h) => !h.pos.length && h.neg.length).map((h) => h.s.label);
  return { pos, neg };
}

function rangeStr(ts) {
  const a = fmtShort(new Date(Math.min(...ts))), b = fmtShort(new Date(Math.max(...ts)));
  return a === b ? a : `${a} to ${b}`;
}
const trim = (s, n) => (s.length > n ? s.slice(0, n).replace(/\s+\S*$/, "") + " …" : s);
const noteTag = (n) => `${n.type}, ${fmtShort(n.when)}${n.author ? ", " + n.author : ""}`;

// Builds the compiled document as a list of blocks; the screen view, .txt and Word file are all made from it.
function buildCompiled(docs) {
  const order = $("order").value;
  const notes = docs.map((d) => ({ doc: d, group: d._group, type: docTypeLabel(d), author: docAuthor(d),
    when: new Date(docDate(d)), status: d.status || "", text: state.texts.get(d.id) || "" }));
  notes.forEach((n) => (n.key = keySection(n.text, n.group)));
  const byNewest = (a, b) => b.when - a.when;
  const groups = HEADING_ORDER.map((g) => {
    const ns = notes.filter((n) => n.group === g).sort(byNewest);
    if (order === "asc") ns.reverse();
    return { g, label: LABEL[g], notes: ns };
  }).filter((x) => x.notes.length);

  // ----- Complete summary -----
  const all = notes.slice().sort(byNewest);
  const dates = all.map((n) => +n.when).filter((t) => !isNaN(t));
  const overview = [];
  overview.push(`${notes.length} document(s)` + (dates.length ? `, ${rangeStr(dates)}` : "") +
    ": " + groups.map((x) => `${x.label} ${x.notes.length}`).join(", "));
  const items = []; // {title, tag, text}
  const latest = (g) => all.find((n) => n.group === g);
  const ap = all.find((n) => (n.group === "progress" || n.group === "hp") && n.key.found);
  if (ap) items.push({ title: "Latest assessment & plan", tag: noteTag(ap), text: trim(ap.key.text, 900) });
  // Each consulting service once (newest note per note type/author)
  const seen = new Set();
  all.filter((n) => n.group === "consult").forEach((n) => {
    const k = (n.type + "|" + n.author).toLowerCase();
    if (seen.has(k) || seen.size >= 4) return; seen.add(k);
    items.push({ title: "Consult", tag: noteTag(n), text: trim(n.key.text, 500) });
  });
  [["ptot", "PT / OT"], ["slp", "Speech-language"], ["diet", "Dietitian"], ["sw", "Social work"], ["pharm", "Pharmacy"], ["nursing", "Latest nursing note"]]
    .forEach(([g, t]) => { const n = latest(g); if (n) items.push({ title: t, tag: noteTag(n), text: trim(n.key.text, 400) }); });
  all.filter((n) => n.group === "radiology").slice(0, 3)
    .forEach((n) => items.push({ title: "Imaging", tag: noteTag(n), text: trim(n.key.text, 350) }));
  all.filter((n) => n.group === "procedure").slice(0, 2)
    .forEach((n) => items.push({ title: "Procedure", tag: noteTag(n), text: trim(n.key.text, 350) }));
  const dc = latest("discharge");
  if (dc) items.push({ title: "Discharge summary", tag: noteTag(dc), text: trim(dc.key.text, 600) });
  const sym = symptomLines(all);

  // ----- Per-heading summaries -----
  groups.forEach((x) => {
    const ds = x.notes.map((n) => +n.when).filter((t) => !isNaN(t));
    x.range = ds.length ? rangeStr(ds) : "";
    x.authors = [...new Set(x.notes.map((n) => n.author).filter(Boolean))];
    x.summ = x.notes.slice().sort(byNewest).slice(0, 5); // key sections of the 5 newest
    x.sym = symptomLines(x.notes);
  });
  return { notes, groups, overview, items, sym, created: new Date() };
}

// ---------- Compile ----------
async function compile() {
  const idx = [...document.querySelectorAll(".docChk:checked")].map((c) => +c.dataset.i);
  if (!idx.length) return setStatus("Select at least one document.", true);

  $("compileBtn").disabled = true;
  const docs = idx.map((i) => state.docs[i]);

  // Fetch in small batches to be gentle on the server.
  const BATCH = 5;
  for (let i = 0; i < docs.length; i += BATCH) {
    setStatus(`Retrieving notes ${Math.min(i + BATCH, docs.length)} of ${docs.length}…`);
    await Promise.all(docs.slice(i, i + BATCH).map(getText));
  }

  state.compiled = buildCompiled(docs);
  $("output").innerHTML = toHtml(state.compiled);
  $("outCard").classList.remove("hidden");
  $("compileBtn").disabled = false;
  setStatus("Done.");
  $("outCard").scrollIntoView({ behavior: "smooth" });
}

function patientLine() { return state.patient ? describePatient(state.patient) : "Patient " + state.client.patient.id; }

// Screen view
function toHtml(c, forWord) {
  // Word ignores "pre-wrap", so line breaks become <br> there
  const pre = (t) => `<div class="excerpt">${forWord ? esc(t).replace(/\n/g, "<br>") : esc(t)}</div>`;
  const symHtml = (s) => (s.pos.length ? `<p><b>Symptoms mentioned:</b> ${esc(s.pos.join("; "))}</p>` : "") +
    (s.neg.length ? `<p class="muted"><b>Documented as absent / denied:</b> ${esc(s.neg.join(", "))}</p>` : "");
  let h = `<div class="docmeta"><b>${esc(patientLine())}</b><br>Compiled ${esc(c.created.toLocaleString())}</div>`;
  h += `<section class="block summary"><h3>Complete summary</h3><p>${esc(c.overview.join(" "))}</p>` +
    c.items.map((it) => `<div class="item"><div class="ititle">${esc(it.title)} <span class="muted">(${esc(it.tag)})</span></div>${pre(it.text)}</div>`).join("") +
    symHtml(c.sym) +
    `<p class="muted small">Built from the key sections of each note (Assessment &amp; Plan, Recommendations, Impression…) plus a keyword symptom scan. Not an interpretation - read the source notes below.</p></section>`;
  h += `<section class="block"><h3>Contents</h3><ol>${c.groups.map((x) => `<li><a href="#grp-${x.g}">${esc(x.label)}</a> <span class="muted">(${x.notes.length}${x.range ? ", " + esc(x.range) : ""})</span></li>`).join("")}</ol></section>`;
  c.groups.forEach((x) => {
    h += `<section class="block group" id="grp-${x.g}"><h3>${esc(x.label)} <span class="muted">(${x.notes.length} · ${esc(x.range)})</span></h3>`;
    h += `<div class="gsum"><div class="ititle">Summary</div>` +
      (x.authors.length ? `<p class="muted">Authors: ${esc(x.authors.join(", "))}</p>` : "") +
      x.summ.map((n) => `<div class="item"><div class="ititle">${esc(fmtShort(n.when))} · ${esc(n.type)}${n.author ? " · " + esc(n.author) : ""} <span class="muted">- ${esc(n.key.head)}</span></div>${pre(trim(n.key.text, 700))}</div>`).join("") +
      (x.notes.length > 5 ? `<p class="muted">Key sections shown for the 5 newest notes; all ${x.notes.length} are below.</p>` : "") +
      symHtml(x.sym) + `</div>`;
    h += `<details class="full"><summary>Full notes (${x.notes.length})</summary>` + x.notes.map((n, i) =>
      `<div class="note"><div class="nhead">[${i + 1}/${x.notes.length}] ${esc(n.type)}<br><span class="muted">Date: ${esc(fmtDate(n.when))} · Author: ${esc(n.author || "unknown")} · Status: ${esc(n.status)}</span></div>
       <pre>${esc(n.text)}</pre></div>`).join("") + `</details></section>`;
  });
  return h;
}

// Plain-text version (Copy and .txt download)
function toText(c) {
  const L = [], line = (ch) => ch.repeat(70);
  L.push("COMPILED CLINICAL NOTES", patientLine(), `Compiled: ${c.created.toLocaleString()}`, line("="));
  L.push("COMPLETE SUMMARY", ...c.overview, "");
  c.items.forEach((it) => L.push(`${it.title} (${it.tag}):`, it.text, ""));
  if (c.sym.pos.length) L.push("Symptoms mentioned: " + c.sym.pos.join("; "));
  if (c.sym.neg.length) L.push("Documented as absent / denied: " + c.sym.neg.join(", "));
  L.push("(Key sections of each note plus a keyword symptom scan - read the source notes.)", line("="));
  L.push("CONTENTS", ...c.groups.map((x, i) => `${i + 1}. ${x.label} (${x.notes.length}${x.range ? ", " + x.range : ""})`), line("="));
  c.groups.forEach((x) => {
    L.push(`${x.label.toUpperCase()} (${x.notes.length} · ${x.range})`, line("-"), "SUMMARY");
    if (x.authors.length) L.push("Authors: " + x.authors.join(", "));
    x.summ.forEach((n) => L.push("", `* ${fmtShort(n.when)} · ${n.type}${n.author ? " · " + n.author : ""} - ${n.key.head}`, trim(n.key.text, 700)));
    if (x.sym.pos.length) L.push("", "Symptoms mentioned: " + x.sym.pos.join("; "));
    if (x.sym.neg.length) L.push("Documented as absent / denied: " + x.sym.neg.join(", "));
    L.push(line("-"), "NOTES");
    x.notes.forEach((n, i) => L.push("", `[${i + 1}/${x.notes.length}] ${n.type}`,
      `Date: ${fmtDate(n.when)}   Author: ${n.author || "unknown"}   Status: ${n.status}`, line("-"), n.text));
    L.push(line("="));
  });
  return L.join("\n");
}

// ---------- Output helpers ----------
function copyOutput() {
  if (!state.compiled) return;
  navigator.clipboard.writeText(toText(state.compiled)).then(() => setStatus("Copied to clipboard."),
    () => setStatus("Copy failed - use Download .txt instead.", true));
}

function save(blob, name) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
const fileDate = () => new Date().toISOString().slice(0, 10);

function downloadText() {
  if (!state.compiled) return;
  save(new Blob([toText(state.compiled)], { type: "text/plain" }), `compiled-notes-${fileDate()}.txt`);
}

// Word opens this HTML file as a normal document (headings show in Word's navigation pane).
function downloadWord() {
  if (!state.compiled) return;
  const css = `body{font-family:Calibri,Arial,sans-serif;font-size:11pt}h1{font-size:16pt}h2{font-size:14pt;color:#0b6bcb;border-bottom:1px solid #999}
    h3{font-size:12pt}.muted{color:#666;font-weight:normal}.ititle{font-weight:bold;margin-top:8px}.nhead{font-weight:bold;margin-top:12px}.excerpt{white-space:pre-wrap;border-left:3px solid #0b6bcb;padding-left:8px;margin:4px 0 10px}
    pre{white-space:pre-wrap;font-family:Consolas,monospace;font-size:9.5pt}`;
  const body = toHtml(state.compiled, true)
    .replace(/<div class="ititle">([\s\S]*?)<\/div>/g, '<p class="ititle"><b>$1</b></p>')
    .replace(/<details class="full"><summary>(.*?)<\/summary>/g, "<h3>$1</h3>").replace(/<\/details>/g, "")
    .replace(/<h3>/g, "<h2>").replace(/<\/h3>/g, "</h2>");
  const html = `<html><head><meta charset="utf-8"><title>Compiled notes</title><style>${css}</style></head><body><h1>Compiled clinical notes</h1>${body}</body></html>`;
  save(new Blob(["﻿" + html], { type: "application/msword" }), `compiled-notes-${fileDate()}.doc`);
}

// Print everything, with the full notes opened
function printOutput() {
  const ds = [...document.querySelectorAll("#output details")];
  const was = ds.map((d) => d.open);
  ds.forEach((d) => (d.open = true));
  window.print();
  ds.forEach((d, i) => (d.open = was[i]));
}

function setStatus(msg, isErr) {
  const s = $("status");
  s.textContent = msg;
  s.className = isErr ? "error" : "";
}

function fmtDate(d) {
  if (!d) return "";
  const dt = new Date(d);
  return isNaN(dt) ? String(d) : dt.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}
function fmtShort(d) {
  const dt = new Date(d);
  return isNaN(dt) ? "" : dt.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
