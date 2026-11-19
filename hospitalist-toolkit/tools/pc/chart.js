/* Chart reading for the peritoneal carcinomatosis tab. READ-ONLY. parse() turns raw FHIR resources into plain facts; gather() fetches them.
   Labs and drugs are matched by LOINC and then by NAME (UNVERIFIED): something not found here may still be in the chart. */
(function () {
  const DAY = 864e5;
  const label = (cc) => (cc && (cc.text || (cc.coding || []).map((c) => c.display).find(Boolean))) || "";
  const codes = (cc) => ((cc && cc.coding) || []).map((c) => String(c.code || ""));
  const tOf = (r) => { const d = r.effectiveDateTime || (r.effectivePeriod && r.effectivePeriod.start) || r.issued || r.authoredOn || r.recordedDate || r.onsetDateTime || ""; const t = d ? new Date(d).getTime() : NaN; return isNaN(t) ? null : t; };
  const mgdl = (f) => (v, u) => (/mg\s*\/\s*dl/i.test(u || "") ? v * f : v);
  const gdl = (v, u) => (/g\s*\/\s*dl/i.test(u || "") ? v * 10 : v);

  const LABS = [
    { id: "na", name: "Na", loinc: ["2951-2", "2947-0"], re: /sodium/i, not: /urine/i },
    { id: "k", name: "K", loinc: ["2823-3", "6298-4", "32713-0"], re: /potassium|^k\b/i, not: /urine/i },
    { id: "mg", name: "Mg", loinc: ["19123-9", "2601-3"], re: /magnesium/i, not: /urine/i, conv: mgdl(0.4114) },
    { id: "po4", name: "PO4", loinc: ["2777-1", "14879-1"], re: /phosph/i, not: /urine|alkaline/i, conv: mgdl(0.3229) },
    { id: "ca", name: "Ca", loinc: ["17861-6", "2000-8"], re: /^calcium|calcium,? (total|serum)/i, not: /ionized|urine|corrected/i, conv: mgdl(0.2495) },
    { id: "cr", name: "Creat", loinc: ["2160-0", "38483-4", "14682-9"], re: /creatinine/i, not: /ratio|kinase|clearance|urine/i, conv: mgdl(88.4) },
    { id: "alb", name: "Albumin", loinc: ["1751-7", "61151-7"], re: /^albumin/i, not: /urine|ascit|fluid|ratio/i, conv: gdl },
    { id: "lactate", name: "Lactate", loinc: ["2524-7", "32693-4", "2519-7"], re: /lactate|lactic/i, not: /dehydrogenase/i },
    { id: "wbc", name: "WBC", loinc: ["6690-2", "26464-8"], re: /\bwbc\b|white blood|leukocyte/i, not: /urine|esterase|fluid/i },
    { id: "hb", name: "Hb", loinc: ["718-7", "20509-6"], re: /hemoglobin|haemoglobin|^hgb\b/i, not: /a1c|glyc|urine/i, conv: gdl },
    { id: "bili", name: "Bili", loinc: ["1975-2"], re: /bilirubin,? total|^total bilirubin|^bilirubin$/i },
    { id: "alp", name: "ALP", loinc: ["6768-6"], re: /alkaline phos/i },
    { id: "cea", name: "CEA", marker: true, loinc: ["2039-6"], re: /\bcea\b|carcinoembryonic/i },
    { id: "ca125", name: "CA-125", marker: true, loinc: ["10334-1", "83084-4"], re: /ca[\s-]?125|cancer antigen 125/i },
    { id: "ca199", name: "CA 19-9", marker: true, loinc: ["24108-3"], re: /ca[\s-]?19[\s-]?9|cancer antigen 19/i },
    { id: "ca724", name: "CA 72-4", marker: true, loinc: ["17842-6"], re: /ca[\s-]?72[\s-]?4/i },
    { id: "he4", name: "HE4", marker: true, loinc: ["55180-3"], re: /\bhe4\b|human epididymis/i },
    { id: "ca153", name: "CA 15-3", marker: true, loinc: ["6875-9"], re: /ca[\s-]?15[\s-]?3|cancer antigen 15/i },
    { id: "afp", name: "AFP", marker: true, loinc: ["1834-1"], re: /\bafp\b|alpha.?fetoprotein/i, not: /amniotic|l3/i },
    { id: "hcg", name: "β-hCG", marker: true, loinc: ["21198-7", "2106-3", "19080-1"], re: /\bhcg\b|chorionic gonadotropin/i, not: /urine/i },
    { id: "ldh", name: "LDH", loinc: ["2532-0", "14804-9"], re: /lactate dehydrogenase|\bldh?\b/i, not: /fluid|ascit|pleural|csf/i }];

  const MEDCLASS = {
    octreo: /octreotide|sandostatin/i,
    anticholin: /butylbromide|buscopan|butylscopolamine|hyoscine|scopolamine|glycopyrr/i,
    dex: /dexamethasone|decadron/i,
    metoclop: /metoclopramide|maxeran|reglan/i,
    antiemetic: /haloperidol|haldol|ondansetron|zofran|granisetron|olanzapine|prochlorperazine|metoclopramide|dimenhydrinate|methotrimeprazine|levomepromazine/i,
    opioid: /morphine|hydromorphone|dilaudid|oxycodone|fentanyl|methadone|codeine|tramadol|tapentadol|sufentanil/i,
    stimLax: /senna|sennoside|bisacodyl|dulcolax|picosulfate/i,
    anyLax: /senna|sennoside|bisacodyl|polyethylene glycol|peg ?3350|lax-?a-?day|restoralax|lactulose|docusate|colace|picosulfate|magnesium hydroxide|milk of magnesia|glycerin supp|enema|methylnaltrexone|naloxegol/i,
    bev: /bevacizumab|avastin|mvasi|zirabev/i,
    chemo: /oxaliplatin|irinotecan|fluorouracil|5-?fu|capecitabine|leucovorin|folinic|cisplatin|carboplatin|paclitaxel|docetaxel|gemcitabine|doxorubicin|topotecan|trifluridine|lonsurf|regorafenib|fruquintinib|bevacizumab|panitumumab|cetuximab|encorafenib|tucatinib|trastuzumab|ramucirumab|nivolumab|pembrolizumab|ipilimumab|zolbetuximab|olaparib|niraparib|mirvetuximab|sotorasib|adagrasib|nab-?paclitaxel|abraxane/i,
    anticoag: /apixaban|rivaroxaban|edoxaban|dabigatran|warfarin|enoxaparin|dalteparin|tinzaparin|heparin/i,
    diuretic: /spironolactone|furosemide|lasix/i };

  const PROB = {
    pc: /peritone(al|um).{0,30}(carcinomatosis|metasta|malignan|implant|deposit|disease)|carcinomatosis|omental (cake|caking|metasta)|C78\.6|pseudomyxoma|C48\.[12]/i,
    mbo: /bowel obstruction|intestinal obstruction|small bowel obstruction|large bowel obstruction|\bsbo\b|\blbo\b|gastric outlet obstruction|ileus|K56\.[0-7]|K31\.1|K31\.5/i,
    ascites: /ascites|R18|malignant effusion,? peritoneal/i,
    cancer: /cancer|carcinoma|neoplasm|malignan|adenocarcinoma|tumou?r|C\d\d/i,
    vte: /deep vein|dvt|pulmonary embol|I26|I80|I82/i,
    hydro: /hydronephrosis|ureteric obstruction|N13/i };

  function obsVal(r) { const q = r.valueQuantity; return q && q.value != null ? { v: +q.value, u: q.unit || q.code || "" } : null; }
  function medText(m) {
    let t = label(m.medicationCodeableConcept) || (m.medicationReference && m.medicationReference.display) || "";
    if (!t && m.medicationReference && m.contained) { const c = m.contained.find((x) => m.medicationReference.reference === "#" + x.id); if (c) t = label(c.code); }
    const di = m.dosageInstruction && m.dosageInstruction[0];
    return [t, di && di.text && di.text !== t ? di.text : ""].filter(Boolean).join(" ").trim();
  }
  const pick = (r) => { const c = codes(r.code), n = label(r.code); return LABS.find((d) => c.some((x) => d.loinc.includes(x)) || (d.re.test(n) && !(d.not && d.not.test(n)))); };

  function parse(raw, opts) {
    const now = (opts && opts.now) || Date.now();
    const f = { l: {}, latest: {}, meds: [], cls: {}, prob: {}, probText: [], reports: [] };
    const p = raw.patient || {};
    f.sex = String(p.gender || "").toLowerCase();
    if (p.birthDate) f.age = Math.floor((now - new Date(p.birthDate).getTime()) / (365.25 * DAY));
    (raw.obs || []).forEach((r) => {
      if (r.status === "entered-in-error" || r.status === "cancelled") return;
      const t = tOf(r), q = obsVal(r); if (t == null || !q) return;
      const d = pick(r); if (!d) return;
      (f.l[d.id] = f.l[d.id] || []).push({ t, v: +(d.conv ? d.conv(q.v, q.u) : q.v).toFixed(2), u: q.u, name: label(r.code) });
    });
    Object.keys(f.l).forEach((k) => { f.l[k].sort((a, b) => a.t - b.t); f.latest[k] = f.l[k][f.l[k].length - 1]; });
    // calcium corrected for albumin (both within 3 days of each other)
    const ca = f.latest.ca, alb = f.latest.alb;
    if (ca && alb && Math.abs(ca.t - alb.t) < 3 * DAY) f.corrCa = +(ca.v + 0.02 * (40 - alb.v)).toFixed(2);
    // creatinine rise over the window: lowest earlier value vs latest
    const cr = f.l.cr || [];
    if (cr.length >= 2) { const last = cr[cr.length - 1], low = cr.slice(0, -1).reduce((a, b) => (b.v < a.v ? b : a)); if (last.v >= low.v * 1.3 && last.v - low.v >= 26) f.crRise = { from: low.v, to: last.v, pct: Math.round((last.v / low.v - 1) * 100) }; }
    (raw.medreqs || []).forEach((m) => { if (["active", "on-hold", "draft"].includes(m.status) || !m.status) f.meds.push({ text: medText(m), status: m.status || "", t: tOf(m) }); });
    const all = f.meds.filter((m) => m.status !== "on-hold");
    Object.entries(MEDCLASS).forEach(([k, re]) => { f.cls[k] = all.filter((m) => re.test(m.text)).map((m) => m.text); });
    const dex = all.filter((m) => MEDCLASS.dex.test(m.text) && m.t).sort((a, b) => a.t - b.t)[0];
    f.dexDays = dex ? Math.floor((now - dex.t) / DAY) : null;
    (raw.conditions || []).forEach((c) => {
      if (c.clinicalStatus && /resolved|inactive|remission/.test(codes(c.clinicalStatus).join(" "))) return;
      if (c.verificationStatus && /refuted|entered-in-error/.test(codes(c.verificationStatus).join(" "))) return;
      const lab = label(c.code), n = lab + " " + codes(c.code).join(" ");
      let hit = false;
      Object.entries(PROB).forEach(([k, re]) => { if (re.test(n)) { f.prob[k] = (f.prob[k] || []).concat(lab); hit = true; } });
      f.probText.push(n);
      if (hit && f.probText.length < 200) (f.relevant = f.relevant || []).push(lab);
    });
    (raw.reports || []).forEach((r) => {
      const txt = [label(r.code), r.conclusion || ""].join(" — ");
      if (/peritone|carcinomatosis|omental|ascites|bowel obstruction|transition point/i.test(txt)) f.reports.push({ t: tOf(r), text: txt.slice(0, 300) });
    });
    f.reports.sort((a, b) => (b.t || 0) - (a.t || 0));
    return f;
  }

  async function gather(client, say) {
    const pid = client.patient.id, errors = [], tell = say || (() => {});
    const iso = (t) => new Date(t).toISOString().slice(0, 10);
    async function get(url, name, pages) {
      const once = () => { let tm; return Promise.race([client.request(url, { pageLimit: pages || 1, flat: true }), new Promise((_, rej) => { tm = setTimeout(() => rej(new Error("timed out after 30 s")), 30000); })]).finally(() => clearTimeout(tm)); };
      const transient = (e) => /timed out|\b50[234]\b|Gateway|Failed to fetch|NetworkError/i.test(String((e && e.message) || e));
      try { const r = (await once().catch((e) => (transient(e) ? new Promise((ok) => setTimeout(ok, 1500)).then(once) : Promise.reject(e)))).filter((x) => x.resourceType && x.resourceType !== "OperationOutcome"); tell(`Loaded ${name} (${r.length})…`); return r; }
      catch (e) { errors.push(`${name}: ${e.message || e}`); return []; }
    }
    const s30 = iso(Date.now() - 30 * DAY), s365 = iso(Date.now() - 365 * DAY), s90 = iso(Date.now() - 90 * DAY);
    const [patient, labs, markers, medreqs, conditions, reports] = await Promise.all([
      (async () => { try { return await client.patient.read(); } catch (e) { errors.push("patient: " + (e.message || e)); return null; } })(),
      get(`Observation?patient=${pid}&category=laboratory&date=ge${s30}&_count=200`, "lab results (30 days)", 8),
      get(`Observation?patient=${pid}&code=${["2039-6","10334-1","83084-4","24108-3","17842-6","55180-3","6875-9","1834-1","21198-7","2106-3","19080-1"].map((c) => "http://loinc.org|" + c).join(",")}&date=ge${s365}&_count=100`, "tumour markers (1 year)", 2),
      get(`MedicationRequest?patient=${pid}&_count=100`, "medication orders", 3),
      get(`Condition?patient=${pid}&_count=100`, "problems/diagnoses", 2),
      get(`DiagnosticReport?patient=${pid}&date=ge${s90}&_count=100`, "reports (90 days)", 2)]);
    const seen = new Set(), obs = labs.concat(markers).filter((o) => (o.id ? (seen.has(o.id) ? false : seen.add(o.id)) : true));
    return { raw: { patient, obs, medreqs, conditions, reports }, errors };
  }

  const api = { parse, gather, LABS, MEDCLASS, PROB, DAY };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else window.PCChart = api;
})();
