/* Oncology tab - UI. Reads the chart (chart.js), applies rules (rules.js), shows content (content.js). Read-only; nothing is sent anywhere. */
(function () {
  const $ = (id) => document.getElementById(id);
  const R = window.OncRules, C = window.OncChart, K = window.OncContent, DR = window.OncDrugs;
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const fmtD = (t) => (t ? new Date(t).toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "2-digit" }) : "");
  const CNAME = { lung: "Lung", breast: "Breast", crc: "Colorectal", prostate: "Prostate", leuk: "Leukemia", lymph: "Lymphoma" };
  const subTxt = (c) => (c && c.sub && c.sub.length ? c.sub.map((x) => R.SUBNAME[x] || x).join(", ") : "");
  const noteName = (k, c) => (k === "leuk" ? "Leukemia" + (subTxt(c) ? " (" + subTxt(c) + ")" : "") : k === "lymph" ? "Lymphoma" + (subTxt(c) ? " (" + subTxt(c) + ")" : "") : CNAME[k] + (k === "lung" && c.sclc ? " (small cell)" : "") + " cancer");
  const TKNAME = { tox: "Oncology toxicity", bsab: "CRS/ICANS", pc: "Peritoneal carcinomatosis", hypona: "Sodium", lytes: "Electrolytes", g6pd: "G6PD", aki: "AKI" };
  const state = { f: null };

  // ---- remembered open/closed sections (browser only; harmless if storage is blocked) ----
  const OPEN_KEY = "onc-open";
  let openMap = {}; try { openMap = JSON.parse(localStorage.getItem(OPEN_KEY) || "{}"); } catch (e) { openMap = {}; }
  const saveOpen = () => { try { localStorage.setItem(OPEN_KEY, JSON.stringify(openMap)); } catch (e) {} };
  function wireDetails(root) {
    root.querySelectorAll("details[data-k]").forEach((d) => {
      if (d.dataset.wired) return; d.dataset.wired = "1";
      if (openMap[d.dataset.k] != null) d.open = openMap[d.dataset.k];
      d.addEventListener("toggle", () => { openMap[d.dataset.k] = d.open; saveOpen(); });
    });
  }
  document.addEventListener("click", (e) => {
    const ex = e.target.closest("[data-expand]"), co = e.target.closest("[data-collapse]");
    if (ex || co) { $((ex || co).dataset.expand || (ex || co).dataset.collapse).querySelectorAll("details").forEach((d) => (d.open = !!ex)); }
  });

  // ---- tabs and links ----
  function show(t) {
    document.querySelectorAll("nav button").forEach((b) => b.classList.toggle("on", b.dataset.t === t));
    document.querySelectorAll("section.tab").forEach((s) => s.classList.toggle("on", s.id === "tab-" + t));
    if (t === "note") buildNote(false);
    if (t === "handout") drawHandout();
    window.scrollTo(0, 0);
  }
  $("nav").onclick = (e) => { const b = e.target.closest("button"); if (b) show(b.dataset.t); };
  document.addEventListener("click", (e) => {
    const a = e.target.closest("[data-goto]");
    if (a) { e.preventDefault(); show(a.dataset.goto); return; }
    const k = e.target.closest("[data-toolkit]");
    if (k) {
      e.preventDefault();
      // Inside the toolkit: switch the parent's tab. Standalone: open the toolkit on that tab.
      try { if (window.parent !== window && typeof window.parent.show === "function") { window.parent.show(k.dataset.toolkit); return; } } catch (err) {}
      window.open("../hospitalist-toolkit/index.html#" + k.dataset.toolkit, "_blank", "noopener");
    }
  });
  const linkFor = (x) => (x.go ? ` <a href="#" data-goto="${x.go}">→ Emergencies</a>` : x.tk ? ` <a href="#" data-toolkit="${x.tk}">→ ${esc(TKNAME[x.tk] || x.tk)} tab</a>` : "");
  const flagHtml = (list) => list.map((x) => `<div class="flag ${x.level}">${esc(x.text)}${linkFor(x)}</div>`).join("");

  // ---- static content ----
  function drawCancerTabs() {
    K.CANCERS.forEach((c) => {
      $("tab-" + c.key).innerHTML = `
        <h2>${esc(c.full)}</h2>
        <div id="ptBanner-${c.key}"></div>
        <div class="flag info">${c.intro}</div>
        <div class="tools noprint"><button class="btn ghost small" data-expand="tab-${c.key}">Expand all</button><button class="btn ghost small" data-collapse="tab-${c.key}">Collapse all</button>
          <a href="${c.link}" target="_blank" rel="noopener">BC Cancer ${esc(c.name.toLowerCase())} protocols (doses)</a></div>
        ${c.sections.map((s, i) => `<details data-k="${c.key}-${i}"${s.open ? " open" : ""}><summary>${esc(s.t)}</summary>${s.h}</details>`).join("")}
        <p class="muted">UNVERIFIED draft. Treatment changes quickly in oncology: confirm with the treating oncologist and the current BC Cancer protocol.</p>`;
    });
  }
  function drawEmerg() {
    $("emergCards").innerHTML = K.EMERG.map((x) => `<details data-k="em-${x.key}"${x.open ? " open" : ""}><summary>${esc(x.t)}</summary>${x.h}</details>`).join("");
    // MASCC
    $("masccBox").innerHTML = `<div class="card"><b>MASCC risk index</b> <span class="muted">(febrile neutropenia; ≥21 = low risk)</span><div class="chk" id="mascc">
      ${K.MASCC.map((m) => m.choices ? `<label>${esc(m.text)}: <select data-m="${m.id}">${m.choices.map(([v, t]) => `<option value="${v}">${esc(t)} (${v})</option>`).join("")}</select></label>`
        : `<label><input type="checkbox" data-m="${m.id}"> ${esc(m.text)} (${m.pts})</label>`).join("")}</div>
      <div id="masccOut"></div></div>`;
    $("mascc").onchange = drawMascc;
    // corrected calcium
    $("caBox").innerHTML = `<div class="card"><b>Corrected calcium</b> <span class="muted">= Ca + 0.02 × (40 − albumin g/L)</span>
      <div class="calc"><label>Ca (mmol/L) <input type="number" step="0.01" id="cCa"></label><label>Albumin (g/L) <input type="number" id="cAlb"></label></div><div id="caOut"></div></div>`;
    ["cCa", "cAlb"].forEach((id) => ($(id).oninput = drawCa));
    // TLS
    $("tlsBox").innerHTML = `<div class="card"><b>Cairo-Bishop laboratory TLS</b> <span class="muted">(fills from the chart; type to change)</span>
      <div class="calc"><label>Urate (µmol/L) <input type="number" id="tU"></label><label>K <input type="number" step="0.1" id="tK"></label><label>PO4 <input type="number" step="0.01" id="tP"></label><label>Corrected Ca <input type="number" step="0.01" id="tC"></label>
      <label><input type="checkbox" id="tCr"> Creatinine ≥1.5 × ULN</label><label><input type="checkbox" id="tAr"> Arrhythmia / seizure</label></div><div id="tlsOut"></div></div>`;
    ["tU", "tK", "tP", "tC", "tCr", "tAr"].forEach((id) => { $(id).oninput = drawTls; $(id).onchange = drawTls; });
    drawMascc(); drawCa(); drawTls();
  }
  function drawMascc() {
    const sel = {}; document.querySelectorAll("#mascc [data-m]").forEach((i) => (sel[i.dataset.m] = i.tagName === "SELECT" ? i.value : i.checked));
    const m = R.mascc(sel); $("masccOut").innerHTML = `<div class="flag ${m.low ? "green" : "amber"}"><span class="score">${m.score}</span> / 26 – ${esc(m.text)}</div>`;
  }
  const num = (id) => { const v = $(id).value; return v === "" ? null : +v; };
  function drawCa() {
    const ca = num("cCa"), alb = num("cAlb");
    if (ca == null) { $("caOut").innerHTML = '<span class="muted">Enter calcium (and albumin).</span>'; return; }
    const c = alb == null ? ca : R.corrCa(ca, alb), l = R.caLevel(c);
    $("caOut").innerHTML = `<div class="flag ${l.level}">${esc(l.text)}${alb == null ? " (no albumin: uncorrected)" : ""}</div>`;
  }
  function drawTls() {
    const t = R.tls({ urate: num("tU"), k: num("tK"), po4: num("tP"), ca: num("tC"), crHigh: $("tCr").checked, arrhythmia: $("tAr").checked });
    $("tlsOut").innerHTML = `<div class="flag ${t.clinical ? "red" : t.lab ? "red" : t.n ? "amber" : "green"}">${t.n} of 4 lab criteria${t.n ? ": " + esc(t.crit.join(", ")) : ""}. ${t.clinical ? "<b>Clinical TLS.</b>" : t.lab ? "<b>Laboratory TLS.</b>" : t.n ? "Not TLS yet – repeat labs in 6–8 h if at risk." : "No TLS criteria met."}</div>`;
  }

  // ---- chart ----
  const LAB_ORDER = ["anc", "wbc", "blasts", "hb", "plt", "inr", "fib", "na", "k", "mg", "po4", "ca", "alb", "cr", "urate", "ldh", "glu", "alt", "bili", "lipase", "ferritin", "tsh", "cortisol", "trop", "lactate"];
  function render() {
    const f = state.f;
    K.CANCERS.forEach((c) => ($("ptBanner-" + c.key).innerHTML = ""));
    document.querySelectorAll("nav .dot").forEach((d) => d.remove());
    if (!f) {
      $("chartFlags").innerHTML = '<span class="muted">No patient loaded.</span>'; $("emergFlags").innerHTML = "";
      ["chartCancer", "chartLabs", "chartDrugs", "chartMarkers", "chartReports"].forEach((id) => ($(id).innerHTML = '<span class="muted">No patient loaded.</span>'));
      return;
    }
    const fl = R.flags(f);
    $("chartFlags").innerHTML = fl.length ? flagHtml(fl) : '<div class="flag green">No emergency or drug-safety flags from the data found.</div>';
    const em = fl.filter((x) => x.level === "red" || x.go === "emerg");
    $("emergFlags").innerHTML = em.length ? `<div class="card"><b>This patient</b>${flagHtml(em.map((x) => Object.assign({}, x, { go: null })))}</div>` : "";
    const red = fl.some((x) => x.level === "red"), amb = fl.some((x) => x.level === "amber");
    if (red || amb) document.querySelector('nav button[data-t="emerg"]').insertAdjacentHTML("beforeend", `<span class="dot${red ? "" : " amber"}" title="flags"></span>`);

    // cancer
    const ck = Object.keys(f.cancers || {});
    $("chartCancer").innerHTML = ck.length ? ck.map((k) => { const c = f.cancers[k];
      $("ptBanner-" + k).innerHTML = `<div class="flag green"><b>This patient:</b> ${esc(c.from.join("; ") || "suggested by " + c.drugs.join(", "))}${k === "lung" && c.sclc ? " (small cell)" : ""}${subTxt(c) ? " – " + esc(subTxt(c)) : ""}. Current drugs: ${esc(f.drugs.filter((d) => d.cancers.includes(k)).map((d) => d.name).join(", ") || "none found")}.</div>`;
      document.querySelector(`nav button[data-t="${k}"]`).insertAdjacentHTML("beforeend", '<span class="dot pt" title="this patient"></span>');
      return `<p><b>${esc(CNAME[k])}</b>${k === "lung" && c.sclc ? " – small cell" : ""}${subTxt(c) ? " – " + esc(subTxt(c)) : ""} <a href="#" data-goto="${k}">open card →</a><br><span class="muted">${c.from.length ? "Problem list: " + esc(c.from.join("; ")) : "Not on the problem list; suggested by: " + esc(c.drugs.join(", "))}</span></p>`; }).join("")
      + siteLine(f)
      : '<span class="muted">None of lung, breast, colorectal, prostate cancer, leukemia or lymphoma found on the problem list or suggested by the medications. The Emergencies tab still applies to any cancer.</span>' + siteLine(f);

    // labs
    const rows = [];
    LAB_ORDER.filter((k) => f.latest[k]).forEach((k) => { const x = f.latest[k], d = C.LABS.find((l) => l.id === k), prev = f.l[k].length > 1 ? f.l[k][f.l[k].length - 2] : null;
      rows.push(`<tr><td>${esc(d.name)}</td><td>${esc(x.v)} <span class="muted">${esc(x.u)}</span>${prev ? ` <span class="muted">(prev ${esc(prev.v)})</span>` : ""}</td><td class="muted">${fmtD(x.t)}</td></tr>`);
      if (k === "ca" && f.corrCa != null) rows.push(`<tr><td>Corrected Ca</td><td><b>${f.corrCa}</b> mmol/L</td><td class="muted">calc</td></tr>`); });
    if (f.tmax48 != null) rows.unshift(`<tr><td>T max 48 h</td><td${f.tmax48 >= 38 ? ' style="color:var(--red);font-weight:600"' : ""}>${f.tmax48} °C</td><td class="muted">vitals</td></tr>`);
    $("chartLabs").innerHTML = rows.length ? `<table>${rows.join("")}</table>` : '<span class="muted">No recent labs found (14 days).</span>';

    // drugs
    $("chartDrugs").innerHTML = f.drugs.length ? `<table><tr><th>Drug (order)</th><th>Class</th><th>Watch for</th></tr>${f.drugs.map((d) => `<tr><td><b>${esc(d.name)}</b><div class="muted">${d.orders.map(esc).join("<br>")}</div></td><td>${esc(d.cls)}</td><td>${esc(d.watch)}${d.tags.includes("ici") ? ' <a href="#" data-toolkit="tox">→ Oncology toxicity</a>' : ""}${d.tags.includes("bispec") ? ' <a href="#" data-toolkit="bsab">→ CRS/ICANS</a>' : ""}</td></tr>`).join("")}</table>`
      : '<span class="muted">No anticancer drugs found on the inpatient medication list. Many are given in clinic (IV) or taken at home: ask the patient, check PharmaNet and the BC Cancer treatment record.</span>';

    // markers
    const MK = ["psa", "cea", "ca153", "ca199", "testo"];
    const mk = MK.filter((k) => f.l[k]).map((k) => `<tr><td>${esc(C.LABS.find((l) => l.id === k).name)}</td><td>${f.l[k].slice(-3).map((x) => `${esc(x.v)} <span class="muted">(${fmtD(x.t)})</span>`).join(" → ")}</td></tr>`);
    $("chartMarkers").innerHTML = mk.length ? `<table>${mk.join("")}</table>${f.latest.testo && f.cancers && f.cancers.prostate ? `<p class="muted">Testosterone ${f.latest.testo.v} nmol/L: ${f.latest.testo.v < 1.7 ? "castrate level (rising PSA here = castration-resistant)" : "not castrate"}.</p>` : ""}<p class="muted">Use the trend, same lab. Markers support, never make, the diagnosis.</p>` : '<span class="muted">None in the past year.</span>';

    $("chartReports").innerHTML = f.reports.length ? "<ul>" + f.reports.slice(0, 6).map((r) => `<li><span class="muted">${fmtD(r.t)}</span> ${esc(r.text)}</li>`).join("") + "</ul>" : '<span class="muted">None in the last 90 days (only titles/conclusions are searched).</span>';

    // prefill calculators
    if (f.latest.ca) $("cCa").value = f.latest.ca.v; if (f.latest.alb) $("cAlb").value = f.latest.alb.v;
    if (f.latest.urate) $("tU").value = f.latest.urate.v; if (f.latest.k) $("tK").value = f.latest.k.v; if (f.latest.po4) $("tP").value = f.latest.po4.v; if (f.corrCa != null) $("tC").value = f.corrCa;
    $("tCr").checked = !!(f.crRise && f.crRise.to >= 1.5 * f.crRise.from);
    const age = document.querySelector('#mascc [data-m="young"]'); if (age) age.checked = f.age != null && f.age < 60;
    const solid = document.querySelector('#mascc [data-m="solid"]'); if (solid) solid.checked = ck.length > 0;
    const copd = document.querySelector('#mascc [data-m="nocopd"]'); if (copd) copd.checked = !f.probText.some((t) => /copd|emphysema|chronic obstructive|J44/i.test(t));
    drawCa(); drawTls(); drawMascc();
    // handout and note defaults
    const hd = R.handoutDefaults(f.drugs, f.meds.map((m) => m.text));
    hd.bonemets = !!(f.sites.bone); hd.radiation = false; hd.blood = !!(f.cancers.leuk || f.cancers.lymph); hd.cellular = f.drugs.some((d) => d.tags.includes("bispec"));
    document.querySelectorAll("#hoChk [data-ho]").forEach((i) => (i.checked = !!hd[i.dataset.ho]));
    $("nCancer").value = ck.map((k) => noteName(k, f.cancers[k])).join(" + ");
    // consult button: Hematology for blood cancers (unless a solid cancer is also present)
    const svc = ck.length && ck.every((k) => k === "leuk" || k === "lymph") ? "Hematology" : "Medical oncology";
    window.CONSULT_SERVICE = svc;
    try { const P = window.parent; (P.CONSULT_SERVICE_OVERRIDE = P.CONSULT_SERVICE_OVERRIDE || {}).onc = svc; } catch (e) {}
    $("wbcBox").innerHTML = f.latest.wbc ? `<div class="flag ${f.latest.wbc.v >= 100 ? "red" : f.latest.wbc.v >= 50 ? "amber" : "green"}">This patient: WBC ${f.latest.wbc.v} ×10⁹/L${f.latest.blasts ? `, blasts ${f.latest.blasts.v}%` : ""} (${fmtD(f.latest.wbc.t)}).</div>` : "";
    drawHandout(); buildNote(true);
  }
  function siteLine(f) {
    const s = f.sites || {}, names = { bone: "bone", brain: "brain", liver: "liver", lungmet: "lung", pleural: "pleural effusion", peritoneal: "peritoneum" };
    const found = Object.keys(names).filter((k) => s[k]).map((k) => names[k]);
    return found.length ? `<p class="muted">Metastatic sites / findings in the chart: ${esc(found.join(", "))}.</p>` : "";
  }

  // ---- handout ----
  const HO = {
    chemo: `<h3>Chemotherapy</h3><ul><li>Your infection-fighting cells are lowest about 7–14 days after treatment. <b>A fever is an emergency</b> (see the red box).</li><li>Wash hands often; avoid people who are sick.</li><li>Mouth sores, diarrhea or vomiting that stops you drinking: call the cancer centre the same day.</li></ul>`,
    immuno: `<h3>Immunotherapy</h3><ul><li>Side effects can start <b>any time, even months after the last dose</b>.</li><li>Tell any doctor or nurse you are on immunotherapy; carry your wallet card.</li><li>Call the same day for: new diarrhea, cough or breathlessness, rash, yellow eyes or skin, dark urine, extreme tiredness, headache, dizziness, very thirsty or passing lots of urine.</li></ul>`,
    targeted: `<h3>Targeted pill or antibody</h3><ul><li>Take it exactly as prescribed. <b>Do not stop or restart it</b> without asking your cancer doctor.</li><li>Check with a pharmacist before starting any new medicine, herbal product or grapefruit juice.</li><li>Call the same day for: new cough or breathlessness, rash, diarrhea, swelling, palpitations.</li></ul>`,
    hormone: `<h3>Hormone therapy</h3><ul><li>Hot flashes, tiredness and joint aches are common.</li><li>It can thin the bones: take calcium and vitamin D as advised; ask about bone density.</li><li>Prostate cancer: keep up exercise; take care to avoid falls.</li><li>If you take <b>abiraterone</b>, also take your prednisone every day. If you are very sick or vomiting, go to the ER – you may need extra steroid.</li></ul>`,
    radiation: `<h3>Radiation</h3><ul><li>Skin in the treatment area may get red and sore: use mild soap and the cream you were given.</li><li>Tiredness is common and can last weeks after treatment.</li><li>Chest radiation: sore swallowing is common; new cough or breathlessness 1–6 months later needs a call.</li></ul>`,
    steroid: `<h3>Steroids (dexamethasone or prednisone)</h3><ul><li><b>Do not stop suddenly.</b> Follow the taper you were given.</li><li>They raise blood sugar: watch for thirst and passing lots of urine; check sugars if you have diabetes.</li><li>Take with food. Trouble sleeping and mood change can happen.</li></ul>`,
    anticoag: `<h3>Blood thinner</h3><ul><li>Call 911 for: vomiting blood, black or bloody stools, a severe headache, or any fall with a head injury.</li><li>Go to the ER for: bleeding that will not stop after 10 minutes of pressure, blood in urine, large bruises.</li><li>Tell every doctor and dentist you take a blood thinner.</li></ul>`,
    bone: `<h3>Bone-strengthening drug (denosumab or zoledronic acid)</h3><ul><li>Take calcium and vitamin D as advised.</li><li>See your dentist before dental work; tell them about this drug. Report jaw pain or loose teeth.</li><li>Muscle cramps or tingling around the mouth can mean low calcium: call the same day.</li></ul>`,
    blood: `<h3>Leukemia or lymphoma</h3><ul><li>Low platelets: watch for bleeding gums, nosebleeds, tiny red or purple spots on the skin, blood in urine or stool – go to the ER for bleeding that will not stop.</li><li>Low blood counts: avoid crowds and sick contacts, wash hands, no raw or undercooked meat, eggs or fish.</li><li>Take your preventive pills (for infection, gout/uric acid) exactly as prescribed.</li><li>New headache, confusion, or vision change: go to the ER.</li></ul>`,
    cellular: `<h3>CAR-T cells or bispecific antibody</h3><ul><li>Stay within the distance your team gave you and keep a caregiver with you for the first weeks.</li><li><b>Fever, shivering, dizziness or feeling faint</b>: go to the ER and show your wallet card – this may be cytokine release syndrome.</li><li><b>Confusion, trouble finding words, shaky handwriting, very sleepy or a seizure</b>: call 911.</li><li>No driving for 8 weeks after CAR-T.</li></ul>`,
    bonemets: `<h3>Cancer in the bones</h3><ul><li><b>New back or neck pain</b>, pain around the chest like a band, weakness or numbness in the legs, or trouble passing urine or stool: <b>go to the ER now</b> – this can be pressure on the spinal cord and early treatment saves walking.</li><li>Sudden severe pain in a bone after a small injury: you may have a fracture – go to the ER.</li><li>Very thirsty, confused, constipated or sick to your stomach can mean high calcium: go to the ER.</li></ul>` };
  function drawHandout() {
    const on = {}; document.querySelectorAll("#hoChk [data-ho]").forEach((i) => (on[i.dataset.ho] = i.checked));
    const phone = $("hoPhone").value.trim() || "________________";
    const f = state.f, name = f && $("ptLine").textContent.split(" · ")[0];
    $("handout").innerHTML = `
      <h2>Going home with cancer treatment: what to watch for</h2>
      ${name ? `<p class="muted">For: ${esc(name)} · ${new Date().toLocaleDateString("en-CA")}</p>` : ""}
      <div class="box"><b>Call 911 if you have:</b><ul>
        <li>Trouble breathing, chest pain or pressure, fainting, or a seizure</li>
        <li>Sudden weakness or numbness of the face, arm or legs, or you cannot walk</li>
        <li>Coughing up or vomiting a lot of blood</li>
        <li>New confusion or you are very hard to wake</li>
        <li>Sudden swelling of the face, neck or tongue</li></ul></div>
      <div class="box amber"><b>Go to the Emergency Department now (say "I am on cancer treatment") if you have:</b><ul>
        <li><b>Temperature 38.0 °C or higher</b>, or shaking chills – do not wait, do not take acetaminophen first to hide the fever</li>
        <li>New back pain, or weakness/numbness in the legs, or you cannot pass urine</li>
        <li>Diarrhea more than 4–6 times a day, or you cannot keep fluids down for 24 hours</li>
        <li>New cough or shortness of breath</li>
        <li>Swelling of the face, neck or arms; one leg swollen and painful</li>
        <li>Bleeding that will not stop, or black stools</li>
        <li>Very thirsty, confused, constipated and sick to your stomach</li></ul></div>
      <p>Cancer centre / oncology: <b>${esc(phone)}</b>. After hours or unsure: <b>HealthLink BC 8-1-1</b>.</p>
      ${Object.keys(HO).filter((k) => on[k]).map((k) => HO[k]).join("")}
      <h3>Bring to every visit</h3><ul><li>Your medication list (including pills from the cancer centre), and your wallet card if you have one.</li></ul>
      <p class="muted">General information, not a replacement for advice from your care team.</p>`;
  }
  $("hoChk").onchange = drawHandout; $("hoPhone").oninput = drawHandout;

  // ---- note ----
  let noteEdited = false;
  $("noteText").oninput = () => (noteEdited = true);
  function buildNote(force) {
    if (noteEdited && !force) return;
    const f = state.f;
    const L = (k) => (f && f.latest[k] ? `${C.LABS.find((l) => l.id === k).name} ${f.latest[k].v}` : null);
    const fl = f ? R.flags(f) : [];
    $("noteText").value = R.note({
      date: new Date().toLocaleDateString("en-CA"), cancer: $("nCancer").value.trim(), stage: $("nStage").value.trim(), intent: $("nIntent").value,
      oncologist: $("nOnc").value.trim(), lastTx: $("nLast").value.trim(), code: $("nCode").value, oncNotified: $("nAware").checked,
      treatment: f ? f.drugs.filter((d) => !d.tags.includes("bone")).map((d) => d.name) : [],
      labs: f ? ["anc", "hb", "plt", "na", "k", "mg", "cr"].map(L).filter(Boolean).concat(f.corrCa != null ? ["corr Ca " + f.corrCa] : [], f.tmax48 != null ? ["Tmax " + f.tmax48] : []).join(", ") : "",
      flags: fl.filter((x) => x.level === "red" || x.level === "amber").map((x) => x.text),
      plan: [], decision: $("noteDecision").value.trim() });
    noteEdited = false;
  }
  ["nCancer", "nStage", "nIntent", "nOnc", "nLast", "nCode", "nAware", "noteDecision"].forEach((id) => { $(id).oninput = () => buildNote(true); $(id).onchange = () => buildNote(true); });
  $("noteRebuild").onclick = () => buildNote(true);
  $("noteCopy").onclick = () => { $("noteText").select(); try { navigator.clipboard.writeText($("noteText").value); } catch (e) { document.execCommand("copy"); } $("noteCopy").textContent = "Copied"; setTimeout(() => ($("noteCopy").textContent = "Copy"), 1200); };

  // ---- loading ----
  function load(raw, msg, errors) {
    state.f = raw ? C.parse(raw) : null;
    const p = raw && raw.patient;
    $("ptLine").textContent = p ? [p.name && p.name[0] && (p.name[0].text || [p.name[0].family, (p.name[0].given || []).join(" ")].filter(Boolean).join(", ")), state.f.age != null ? state.f.age + " y" : "", state.f.sex].filter(Boolean).join(" · ") : "";
    $("pstatus").textContent = msg;
    $("errs").textContent = errors && errors.length ? "Could not read: " + errors.join("; ") + (errors.some((e) => /\b40[13]\b|Unauthorized|Forbidden/i.test(e)) ? ". Check the scopes in the Code Console." : ". Cerner's sandbox can be slow: reload to try again.") : "";
    render();
  }
  const SAMPLES = window.ONC_SAMPLES || [];
  SAMPLES.forEach((p, i) => { const o = document.createElement("option"); o.value = i; o.textContent = p.label; $("testsel").appendChild(o); });
  $("testsel").onchange = () => { const p = SAMPLES[$("testsel").value]; if (!p) return load(null, "Open from Cerner to read the chart, or pick a made-up patient:"); load(p.build(Date.now()), "Made-up patient: " + p.label, []); };

  async function fromChart() {
    if (typeof FHIR === "undefined" || !(location.search.includes("code=") || location.search.includes("complete=") || sessionStorage.getItem("SMART_KEY"))) return false;
    $("pstatus").textContent = "Reading the chart…";
    try {
      const client = await FHIR.oauth2.ready();
      const { raw, errors } = await C.gather(client, (m) => ($("pstatus").textContent = m));
      load(raw, "Chart read (read-only). Nothing is sent anywhere.", errors);
      return true;
    } catch (e) { $("pstatus").textContent = "Could not read the chart: " + (e && e.message ? e.message : e) + ". The made-up patients still work."; return false; }
  }

  drawCancerTabs(); drawEmerg(); wireDetails(document); render(); drawHandout(); buildNote(true);
  const q = new URLSearchParams(location.search), demo = q.get("demo");
  if (q.get("tab") && document.getElementById("tab-" + q.get("tab"))) show(q.get("tab"));
  fromChart().then((ok) => { if (!ok && demo && SAMPLES[+demo - 1]) { $("testsel").value = +demo - 1; $("testsel").onchange(); } });
})();
