/* G6PD Check – SMART on FHIR (Cerner R4)
 * - Finds G6PD status (labs, problem list, allergies)
 * - Compares current MedicationRequests with CPIC 2023 G6PD risk categories
 * - Shows recent hemolysis labs
 * - Reference sheet with section dropdown
 * Open index.html?demo=1 to preview with sample data (no launch needed).
 */
(function () {
  "use strict";

  // ---------- CPIC 2023 drug rules (name/brand matching, word boundaries) ----------
  const RULES = [
    // HIGH RISK – avoid
    { cat: "high", names: ["rasburicase", "fasturtec", "elitek"], note: "Avoid. Causes hemolysis and methemoglobinemia. Use allopurinol + hydration; test G6PD before use." },
    { cat: "high", names: ["pegloticase", "krystexxa"], note: "Avoid. Test G6PD before use; choose other urate-lowering therapy." },
    { cat: "high", names: ["dapsone", "aczone"], note: "Avoid. PJP prophylaxis: TMP-SMX, atovaquone or pentamidine." },
    { cat: "high", names: ["primaquine"], note: "Avoid standard dose. Low weekly P. vivax dose is medium risk (specialist only). PJP: use TMP-SMX/atovaquone/pentamidine." },
    { cat: "high", names: ["tafenoquine", "krintafel", "arakoda"], note: "Contraindicated if deficient or untested (needs quantitative G6PD)." },
    { cat: "high", names: ["methylene blue", "methylthioninium", "provayblue"], note: "Avoid: ineffective and hemolytic. MetHb: O2, exchange transfusion, hyperbaric O2. Vasoplegia: hydroxocobalamin." },
    { cat: "high", names: ["toluidine blue", "tolonium"], note: "Avoid. Flag to surgery / endoscopy." },
    // MEDIUM RISK – caution
    { cat: "medium", names: ["nitrofurantoin", "macrobid", "macrodantin"], note: "Use with caution. Prefer fosfomycin, cephalexin or TMP-SMX for cystitis when reasonable." },
    // Methemoglobinemia risk (not a CPIC category; antidote methylene blue is contraindicated)
    { cat: "methb", names: ["benzocaine", "prilocaine", "emla", "nitric oxide"], note: "Not a CPIC G6PD drug, but can cause methemoglobinemia and methylene blue cannot be used as antidote." },
    // LOW-TO-NO RISK
    { cat: "low", names: ["sulfamethoxazole", "co-trimoxazole", "cotrimoxazole", "septra", "bactrim"], note: "Low-to-no risk (CPIC). OK at usual doses." },
    { cat: "low", names: ["sulfadiazine", "sulfisoxazole", "sulfanilamide", "sulfadimidine"], note: "Low-to-no risk (CPIC)." },
    { cat: "low", names: ["sulfasalazine", "salazopyrin"], note: "Low-to-no risk (CPIC)." },
    { cat: "low", names: ["ciprofloxacin", "cipro", "ofloxacin", "norfloxacin", "nalidixic acid"], note: "Low-to-no risk (CPIC)." },
    { cat: "low", names: ["chloramphenicol"], note: "Low-to-no risk (CPIC)." },
    { cat: "low", names: ["chloroquine", "hydroxychloroquine", "plaquenil", "quinine"], note: "Low-to-no risk (CPIC)." },
    { cat: "low", names: ["aspirin", "acetylsalicylic acid", "asa"], note: "Low-to-no risk at ≤ 1 g/day. No recommendation above 1 g/day – check dose." },
    { cat: "low", names: ["glyburide", "glibenclamide", "tolbutamide"], note: "Low-to-no risk (CPIC)." },
    { cat: "low", names: ["phytonadione", "phytomenadione", "vitamin k"], note: "Low-to-no risk (CPIC)." },
    { cat: "low", names: ["ascorbic acid", "vitamin c"], note: "Low-to-no risk at usual doses. Avoid megadose IV vitamin C (case reports of hemolysis/AKI)." , ivWarn: true },
    { cat: "low", names: ["phenazopyridine", "pyridium", "dimercaprol", "doxorubicin", "aminosalicylic acid", "mafenide"], note: "Low-to-no risk (CPIC)." },
    // NO RECOMMENDATION (insufficient evidence)
    { cat: "norec", names: ["gliclazide", "glipizide", "glimepiride", "chlorpropamide", "tolazamide"], note: "No CPIC recommendation (insufficient evidence)." },
    { cat: "norec", names: ["moxifloxacin", "probenecid", "sodium nitrite", "dabrafenib", "trametinib", "nicorandil", "sulfacetamide", "nitrofural", "nitrofurazone", "mepacrine", "quinacrine"], note: "No CPIC recommendation (insufficient evidence)." },
    { cat: "norec", names: ["mesalamine", "mesalazine", "asacol", "pentasa", "salofalk", "mezavant", "lialda"], note: "No CPIC recommendation (insufficient evidence)." }
  ];
  const CAT_LABEL = { high: "High risk – avoid", medium: "Medium – caution", methb: "MetHb risk", low: "Low-to-no risk", norec: "No recommendation", none: "Not listed" };
  const CAT_ORDER = { high: 0, medium: 1, methb: 2, norec: 3, low: 4, none: 5 };

  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const reEsc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const COMPILED = RULES.map((r) => ({ ...r, re: new RegExp("\\b(" + r.names.map(reEsc).join("|") + ")\\b", "i") }));

  function classify(name, routeText) {
    const hits = COMPILED.filter((r) => r.re.test(name || ""));
    if (!hits.length) return { cat: "none", note: "" };
    hits.sort((a, b) => CAT_ORDER[a.cat] - CAT_ORDER[b.cat]);
    const h = hits[0];
    let note = h.note;
    if (h.ivWarn && /\b(iv|intravenous)\b/i.test(routeText || "")) note = "IV vitamin C: avoid high doses in G6PD deficiency (hemolysis/AKI reports). " + note;
    return { cat: h.cat, note, matched: (name.match(h.re) || [])[0] };
  }

  // ---------- G6PD status ----------
  const G6PD_RE = /g6pd|g-6-pd|glucose[\s-]*6[\s-]*phosphate/i;
  const G6PD_LOINC = ["2357-2", "32546-4", "2356-4"]; // verify against local Cerner lab build
  const D55_RE = /^D55\.0/i;

  // ---------- Hemolysis labs ----------
  const HEMO = [
    { key: "hb", label: "Hemoglobin", loinc: ["718-7"], re: /^(h(a)?emoglobin|hgb|hb)\b(?!.*(a1c|glyc|urine|electro|f\b|s\b))/i },
    { key: "retic", label: "Reticulocytes", loinc: ["17849-1", "4679-7", "14196-0"], re: /retic/i },
    { key: "tbili", label: "Bilirubin, total", loinc: ["1975-2"], re: /bili.*total|total.*bili/i },
    { key: "dbili", label: "Bilirubin, direct", loinc: ["1968-7"], re: /bili.*(direct|conj)|(direct|conj).*bili/i },
    { key: "ldh", label: "LDH", loinc: ["2532-0", "14804-9"], re: /\bldh?\b|lactate dehydrogenase/i },
    { key: "hapto", label: "Haptoglobin", loinc: ["4542-7"], re: /haptoglobin/i },
    { key: "dat", label: "DAT (Coombs)", loinc: ["1007-4"], re: /direct antiglobulin|\bdat\b|coombs/i },
    { key: "methb", label: "Methemoglobin", loinc: ["2614-2"], re: /methemoglobin|\bmethb\b|\bmet ?hb\b/i },
    { key: "cr", label: "Creatinine", loinc: ["2160-0"], re: /^creatinine(?!.*(urine|clearance|ratio|kinase))/i },
    { key: "k", label: "Potassium", loinc: ["2823-3", "6298-4"], re: /^potassium(?!.*urine)|^k\b/i }
  ];

  // ---------- helpers ----------
  const ccText = (cc) => cc ? (cc.text || (cc.coding || []).map((c) => c.display).filter(Boolean)[0] || (cc.coding || [])[0]?.code || "") : "";
  const codes = (cc) => (cc?.coding || []).map((c) => c.code).filter(Boolean);
  const obsDate = (o) => o.effectiveDateTime || o.effectivePeriod?.start || o.issued || "";
  const fmtDate = (d) => d ? new Date(d).toLocaleString("en-CA", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "";
  function obsValue(o) {
    if (o.valueQuantity) return `${o.valueQuantity.value ?? ""} ${o.valueQuantity.unit || o.valueQuantity.code || ""}`.trim();
    if (o.valueString) return o.valueString;
    if (o.valueCodeableConcept) return ccText(o.valueCodeableConcept);
    if (o.dataAbsentReason) return "(" + ccText(o.dataAbsentReason) + ")";
    return "";
  }
  const obsFlag = (o) => (o.interpretation || []).flatMap((i) => i.coding || []).map((c) => c.code).find(Boolean) || "";
  const refRange = (o) => {
    const r = (o.referenceRange || [])[0];
    if (!r) return "";
    if (r.text) return r.text;
    return [r.low?.value, r.high?.value].every((v) => v === undefined) ? "" : `${r.low?.value ?? ""}–${r.high?.value ?? ""}`;
  };

  // ---------- data loading ----------
  async function loadAll(client) {
    const pid = client.patient.id;
    const since = new Date(Date.now() - 14 * 864e5).toISOString();
    const opts = { pageLimit: 5, flat: true };
    const safe = (p) => p.catch((e) => { console.warn(e); return { __error: e.message || String(e) }; });

    const [patient, meds, conds, allergies, recentLabs, g6pdLabs] = await Promise.all([
      safe(client.patient.read()),
      safe(client.request(`MedicationRequest?patient=${pid}&_count=100`, opts)),
      safe(client.request(`Condition?patient=${pid}`, opts)),
      safe(client.request(`AllergyIntolerance?patient=${pid}`, opts)),
      safe(client.request(`Observation?patient=${pid}&category=laboratory&date=ge${since}&_count=200`, opts)),
      safe(client.request(`Observation?patient=${pid}&code=${G6PD_LOINC.map((c) => "http://loinc.org|" + c).join(",")}`, opts))
    ]);

    // Fallback: scan older labs for a locally coded G6PD result
    let g6 = Array.isArray(g6pdLabs) ? g6pdLabs : [];
    if (!g6.length) {
      const older = await safe(client.request(`Observation?patient=${pid}&category=laboratory&_count=200`, opts));
      if (Array.isArray(older)) g6 = older.filter((o) => G6PD_RE.test(ccText(o.code)));
    }
    if (Array.isArray(recentLabs)) g6 = g6.concat(recentLabs.filter((o) => G6PD_RE.test(ccText(o.code))));

    // Resolve medicationReference names if needed
    const medList = Array.isArray(meds) ? meds : [];
    for (const m of medList) {
      if (!m.medicationCodeableConcept && m.medicationReference) {
        const ref = m.medicationReference.reference || "";
        if (ref.startsWith("#")) {
          const c = (m.contained || []).find((x) => "#" + x.id === ref);
          m._name = ccText(c?.code);
        } else if (ref) {
          try { const med = await client.request(ref); m._name = ccText(med.code); } catch (e) { /* ignore */ }
        }
        if (!m._name) m._name = m.medicationReference.display || ref;
      }
    }

    return {
      patient,
      meds: Array.isArray(meds) ? medList : meds,
      conds, allergies,
      recentLabs: Array.isArray(recentLabs) ? recentLabs : recentLabs,
      g6pdObs: dedupe(g6)
    };
  }
  const dedupe = (arr) => { const s = new Set(); return arr.filter((o) => (s.has(o.id) ? false : s.add(o.id))); };

  // ---------- rendering ----------
  function renderPatient(p) {
    const el = document.getElementById("ptBanner");
    if (!p || p.__error) { el.textContent = "Patient not loaded"; return; }
    const n = (p.name || [])[0] || {};
    const name = n.text || [(n.given || []).join(" "), n.family].filter(Boolean).join(" ");
    const mrn = (p.identifier || []).find((i) => /mrn|medical record/i.test(ccText(i.type) || i.type?.text || ""))?.value;
    el.textContent = `${name || "Unknown"} · ${p.gender || ""} · DOB ${p.birthDate || "?"}${mrn ? " · MRN " + mrn : ""}`;
  }

  function computeStatus(data) {
    const sources = [];
    let status = "unknown";

    const conds = Array.isArray(data.conds) ? data.conds : [];
    for (const c of conds) {
      const txt = ccText(c.code);
      const isActive = !c.clinicalStatus || /active|recurrence|relapse/i.test(codes(c.clinicalStatus).join(" "));
      if ((G6PD_RE.test(txt) || codes(c.code).some((x) => D55_RE.test(x))) && isActive) {
        status = "deficient";
        sources.push(`Problem list: ${esc(txt)}${c.recordedDate ? " (" + fmtDate(c.recordedDate).split(",")[0] + ")" : ""}`);
      }
    }
    const allergies = Array.isArray(data.allergies) ? data.allergies : [];
    for (const a of allergies) {
      const txt = [ccText(a.code), ...(a.note || []).map((n) => n.text)].join(" ");
      if (G6PD_RE.test(txt)) { status = "deficient"; sources.push(`Allergy/alert: ${esc(ccText(a.code))}`); }
    }

    const obs = (data.g6pdObs || []).slice().sort((a, b) => (obsDate(b) > obsDate(a) ? 1 : -1));
    let latest = null;
    if (obs.length) {
      latest = obs[0];
      const val = obsValue(latest), flag = obsFlag(latest);
      const lowFlag = /^(L|LL|A|AA)$/i.test(flag) || /deficien|low|abnormal|positive for deficiency/i.test(val);
      const normalText = /normal|not deficient|negative/i.test(val) && !/ab?normal/i.test(val.replace(/not\s+/, ""));
      if (status !== "deficient") status = lowFlag ? "deficient" : (normalText || flag === "N" ? "normal" : "result");
      sources.push(`Lab: ${esc(ccText(latest.code))} = <b>${esc(val)}</b>${flag ? " [" + esc(flag) + "]" : ""}${refRange(latest) ? " (ref " + esc(refRange(latest)) + ")" : ""} · ${esc(fmtDate(obsDate(latest)))}`);
      if (obs.length > 1) sources.push(`<span class="muted">${obs.length - 1} earlier G6PD result(s) on file</span>`);
    }
    const errs = ["conds", "allergies"].filter((k) => data[k]?.__error);
    return { status, sources, latest, errs };
  }

  function renderStatus(st) {
    const el = document.getElementById("g6pdStatus");
    const label = { deficient: "G6PD DEFICIENT", normal: "G6PD normal on file", result: "G6PD result on file – interpret", unknown: "No G6PD result or diagnosis found" }[st.status];
    const cls = st.status === "result" ? "unknown" : st.status;
    let html = `<div class="status-line ${cls}">${label}</div>`;
    if (st.sources.length) html += `<ul class="src">${st.sources.map((s) => `<li>${s}</li>`).join("")}</ul>`;
    if (st.status === "normal" || st.status === "result")
      html += `<p class="muted" style="margin-bottom:0">A normal level drawn during or soon after hemolysis or transfusion can be falsely normal; heterozygous females may test intermediate.</p>`;
    if (st.status === "unknown")
      html += `<p class="muted" style="margin-bottom:0">Consider a quantitative G6PD before high-risk drugs in at-risk ancestry.</p>`;
    if (st.errs.length) html += `<p class="err">Could not read: ${st.errs.join(", ")}</p>`;
    el.className = "";
    el.innerHTML = html;
  }

  let medRows = [];
  function buildMedRows(meds) {
    const activeLike = /^(active|on-hold|draft)$/i;
    return meds
      .filter((m) => activeLike.test(m.status || "active"))
      .map((m) => {
        const name = m._name || ccText(m.medicationCodeableConcept) || "(unnamed medication)";
        const di = (m.dosageInstruction || [])[0] || {};
        const route = ccText(di.route);
        const c = classify(name, route + " " + (di.text || ""));
        return { name, dose: di.text || "", route, status: m.status, intent: m.intent, authored: m.authoredOn, ...c };
      })
      .sort((a, b) => CAT_ORDER[a.cat] - CAT_ORDER[b.cat] || a.name.localeCompare(b.name));
  }

  function renderMeds(meds) {
    const el = document.getElementById("medTable");
    if (meds && meds.__error) { el.innerHTML = `<span class="err">Could not load medications: ${esc(meds.__error)}</span>`; return; }
    const showAll = document.getElementById("showAll").checked;
    const rows = medRows.filter((r) => showAll || r.cat !== "none");
    const hidden = medRows.length - rows.length;
    if (!medRows.length) { el.innerHTML = `<span class="muted">No active medication orders found.</span>`; return; }
    let html = `<table><tr><th>Medication</th><th>G6PD risk</th><th>Note</th></tr>`;
    if (!rows.length) html += `<tr><td colspan="3" class="muted">None of the ${medRows.length} active medications appear on the CPIC G6PD list.</td></tr>`;
    for (const r of rows) {
      html += `<tr>
        <td><b>${esc(r.name)}</b><div class="muted" style="font-size:12px">${esc([r.dose, r.route].filter(Boolean).join(" · "))}${r.status && r.status !== "active" ? " · " + esc(r.status) : ""}${r.intent === "plan" ? " · home med" : ""}</div></td>
        <td><span class="pill ${r.cat}">${CAT_LABEL[r.cat]}</span></td>
        <td>${esc(r.note)}</td></tr>`;
    }
    html += `</table>`;
    if (hidden && !showAll) html += `<div class="muted" style="margin-top:6px;font-size:12px">${hidden} other active medication(s) not on the CPIC G6PD list – tick the box above to show.</div>`;
    el.className = "";
    el.innerHTML = html;
  }

  function renderOverall(st) {
    const el = document.getElementById("overall");
    const high = medRows.filter((r) => r.cat === "high");
    const med = medRows.filter((r) => r.cat === "medium");
    const methb = medRows.filter((r) => r.cat === "methb");
    const names = (arr) => arr.map((r) => r.matched || r.name).join(", ");
    let cls = "green", msg = "No high- or medium-risk G6PD medications on the active list.", sub = "";

    if (high.length && st.status === "deficient") { cls = "red"; msg = `STOP: G6PD-deficient patient on high-risk medication – ${names(high)}`; sub = "Discontinue and choose an alternative (see notes). Watch for hemolysis over the next 24–72 h."; }
    else if (high.length && (st.status === "unknown" || st.status === "result")) { cls = "amber"; msg = `High-risk medication with unconfirmed G6PD status – ${names(high)}`; sub = "Send a quantitative G6PD before the dose if possible, or choose an alternative."; }
    else if (high.length) { cls = "blue"; msg = `High-risk medication ordered – ${names(high)} – G6PD normal on file`; sub = "Confirm the normal result was not drawn during hemolysis or after transfusion."; }
    else if (med.length && st.status === "deficient") { cls = "amber"; msg = `Use with caution in G6PD deficiency – ${names(med)}`; sub = "Consider an alternative; monitor for hemolysis."; }
    else if (med.length) { cls = "blue"; msg = `Medium-risk medication ordered – ${names(med)}`; }
    else if (st.status === "deficient") { cls = "green"; msg = "G6PD deficient – no high- or medium-risk medications currently ordered."; sub = "Check new orders with the drug lookup below."; }
    if (methb.length) sub += (sub ? " " : "") + `Methemoglobinemia-risk drug ordered (${names(methb)}); methylene blue is not an option if deficient.`;

    el.className = "banner " + cls;
    el.innerHTML = esc(msg) + (sub ? `<small>${esc(sub)}</small>` : "");
  }

  function renderHemo(labs) {
    const el = document.getElementById("hemoLabs");
    if (labs && labs.__error) { el.innerHTML = `<span class="err">Could not load labs: ${esc(labs.__error)}</span>`; return; }
    const byKey = {};
    for (const o of labs || []) {
      const cs = codes(o.code), txt = ccText(o.code);
      const def = HEMO.find((h) => h.loinc.some((l) => cs.includes(l))) || HEMO.find((h) => h.re.test(txt));
      if (!def) continue;
      (byKey[def.key] = byKey[def.key] || []).push(o);
    }
    let html = `<table><tr><th>Test</th><th>Latest</th><th>Previous</th></tr>`;
    for (const h of HEMO) {
      const arr = (byKey[h.key] || []).sort((a, b) => (obsDate(b) > obsDate(a) ? 1 : -1));
      const cell = (o) => {
        if (!o) return `<span class="muted">—</span>`;
        const f = obsFlag(o);
        return `<span class="flag-${esc(f)}">${esc(obsValue(o))}${f && f !== "N" ? " " + esc(f) : ""}</span><div class="muted" style="font-size:11px">${esc(fmtDate(obsDate(o)))}</div>`;
      };
      html += `<tr><td>${h.label}</td><td>${cell(arr[0])}</td><td>${cell(arr[1])}</td></tr>`;
    }
    html += `</table>`;
    el.className = "";
    el.innerHTML = html;
  }

  // ---------- UI wiring ----------
  function wireUI() {
    const sel = document.getElementById("sectionSelect");
    const show = () => {
      const v = sel.value;
      document.querySelectorAll(".ref-section").forEach((s) => s.classList.toggle("show", v === "all" || s.dataset.sec === v));
    };
    sel.addEventListener("change", show);
    show();

    document.getElementById("showAll").addEventListener("change", () => renderMeds([]));

    const inp = document.getElementById("lookup"), out = document.getElementById("lookupResult");
    inp.addEventListener("input", () => {
      const q = inp.value.trim();
      if (q.length < 3) { out.innerHTML = ""; return; }
      const exact = classify(q, "");
      let hits = exact.cat !== "none" ? [exact] : [];
      if (!hits.length) {
        const qre = new RegExp(reEsc(q), "i");
        hits = COMPILED.filter((r) => r.names.some((n) => qre.test(n)))
          .map((r) => ({ cat: r.cat, note: r.note, matched: r.names.find((n) => qre.test(n)) }));
      }
      out.innerHTML = hits.length
        ? hits.slice(0, 5).map((h) => `<div style="margin:4px 0"><span class="pill ${h.cat}">${CAT_LABEL[h.cat]}</span> <b>${esc(h.matched)}</b> – ${esc(h.note)}</div>`).join("")
        : `<span class="muted">Not on the CPIC G6PD list (no G6PD-specific restriction known). Check with pharmacy for combination products.</span>`;
    });
  }

  function renderAll(data) {
    renderPatient(data.patient);
    const st = computeStatus(data);
    renderStatus(st);
    medRows = Array.isArray(data.meds) ? buildMedRows(data.meds) : [];
    renderMeds(data.meds);
    renderOverall(st);
    renderHemo(data.recentLabs);
  }

  // ---------- demo data ----------
  function demoData() {
    const now = Date.now(), d = (h) => new Date(now - h * 3600e3).toISOString();
    const q = (code, text, v, unit, h, flag) => ({ id: code + h, code: { text, coding: [{ system: "http://loinc.org", code }] }, valueQuantity: { value: v, unit }, effectiveDateTime: d(h), interpretation: flag ? [{ coding: [{ code: flag }] }] : undefined });
    const med = (id, text, dose, route, intent) => ({ id, status: "active", intent: intent || "order", medicationCodeableConcept: { text }, dosageInstruction: [{ text: dose, route: { text: route } }] });
    return {
      patient: { name: [{ given: ["Test"], family: "Demo" }], gender: "male", birthDate: "1958-04-02" },
      meds: [
        med("1", "rasburicase", "0.2 mg/kg IV once", "IV"),
        med("2", "sulfamethoxazole-trimethoprim (Septra DS)", "1 tab PO Mon/Wed/Fri", "PO"),
        med("3", "nitrofurantoin (Macrobid)", "100 mg PO BID", "PO"),
        med("4", "hydroxychloroquine", "200 mg PO daily", "PO", "plan"),
        med("5", "acetaminophen", "650 mg PO q6h PRN", "PO"),
        med("6", "allopurinol", "300 mg PO daily", "PO")
      ],
      conds: [], allergies: [],
      g6pdObs: [{ id: "g1", code: { text: "G6PD Quantitative" }, valueQuantity: { value: 1.2, unit: "U/g Hb" }, interpretation: [{ coding: [{ code: "LL" }] }], referenceRange: [{ low: { value: 7.0 }, high: { value: 20.5 } }], effectiveDateTime: d(24 * 400) }],
      recentLabs: [
        q("718-7", "Hemoglobin", 92, "g/L", 6, "L"), q("718-7", "Hemoglobin", 118, "g/L", 30, "L"),
        q("17849-1", "Reticulocyte %", 3.8, "%", 6, "H"),
        q("1975-2", "Bilirubin Total", 48, "umol/L", 6, "H"), q("1975-2", "Bilirubin Total", 14, "umol/L", 30),
        q("2532-0", "LDH", 610, "U/L", 6, "H"),
        q("4542-7", "Haptoglobin", 0.1, "g/L", 6, "L"),
        q("2160-0", "Creatinine", 112, "umol/L", 6, "H"), q("2823-3", "Potassium", 4.9, "mmol/L", 6)
      ]
    };
  }

  // ---------- start ----------
  async function start() {
    wireUI();
    const isDemo = /[?&]demo=1\b/.test(location.search);
    if (isDemo) {
      document.getElementById("modeNote").textContent = "DEMO MODE – sample data only.";
      renderAll(demoData());
      return;
    }
    try {
      const client = await FHIR.oauth2.ready();
      const data = await loadAll(client);
      renderAll(data);
    } catch (e) {
      console.error(e);
      document.getElementById("overall").className = "banner amber";
      document.getElementById("overall").innerHTML = `Not launched from the EHR (${esc(e.message || e)}). <small>Launch via launch.html from the Cerner sandbox, or open <a href="?demo=1">demo mode</a>.</small>`;
      ["g6pdStatus", "medTable", "hemoLabs"].forEach((id) => (document.getElementById(id).textContent = "—"));
    }
  }

  // Expose for the Hospitalist Toolkit (call G6PD.renderAll(data) / G6PD.loadAll(client) from a tab)
  window.G6PD = { loadAll, renderAll, classify, RULES };
  document.addEventListener("DOMContentLoaded", start);
})();
