/* Chart reading for the consult tab. READ-ONLY. Labs by LOINC then NAME; drugs by NAME (UNVERIFIED patterns). */
(function () {
  const DAY = 864e5;
  const label = (cc) => (cc && (cc.text || (cc.coding || []).map((c) => c.display).find(Boolean))) || "";
  const codes = (cc) => ((cc && cc.coding) || []).map((c) => String(c.code || ""));
  const tOf = (r) => { const d = r.effectiveDateTime || (r.effectivePeriod && r.effectivePeriod.start) || r.issued || r.authoredOn || r.onsetDateTime || r.recordedDate || ""; const t = d ? new Date(d).getTime() : NaN; return isNaN(t) ? null : t; };
  const URINE = /urine|\bur\b|\burin/i, OTHER = /csf|fluid|ascit|pleural|stool/i;
  const mg = (f) => (v, u) => (/mg\s*\/\s*dl/i.test(u || "") ? v * f : v);
  const LABS = [
    { id: "hgb", label: "Hgb", loinc: ["718-7", "20509-6"], re: /hemoglobin|haemoglobin|^hgb\b/i, not: /a1c|glycated|mean corp|mch|free/i, conv: (v, u) => (/g\s*\/\s*dl/i.test(u || "") || v < 25 ? v * 10 : v) },
    { id: "wbc", label: "WBC", loinc: ["6690-2", "26464-8"], re: /white blood cell|leukocyte count|^wbc\b/i, not: /esterase/i },
    { id: "plt", label: "plt", loinc: ["777-3", "26515-7"], re: /platelet/i, not: /volume|mpv|function/i },
    { id: "inr", label: "INR", loinc: ["6301-6", "34714-6"], re: /\binr\b|international normali/i },
    { id: "na", label: "Na", loinc: ["2951-2", "2947-0"], re: /^sodium|\bsodium\b/i, not: /fraction/i },
    { id: "k", label: "K", loinc: ["2823-3", "6298-4"], re: /potassium/i },
    { id: "hco3", label: "HCO3", loinc: ["1963-8", "2028-9", "1959-6"], re: /bicarbonate|total co2|\bco2\b|\bhco3/i },
    { id: "urea", label: "urea", loinc: ["3091-6", "22664-7", "3094-0"], re: /\burea\b|\bbun\b/i, not: /ratio|creatinine/i, conv: mg(1 / 2.8) },
    { id: "cr", label: "Cr", loinc: ["2160-0", "38483-4"], re: /creatinine/i, not: /ratio|kinase|clearance/i, conv: mg(88.4) },
    { id: "glu", label: "glucose", loinc: ["2345-7", "2339-0"], re: /glucose/i, conv: (v, u) => (/mg\s*\/\s*dl/i.test(u || "") || v > 60 ? v / 18.016 : v) },
    { id: "ca", label: "Ca", loinc: ["17861-6", "2000-8"], re: /^calcium|calcium,? total/i, not: /ionized|ionised/i, conv: mg(0.2495) },
    { id: "mg", label: "Mg", loinc: ["19123-9", "2601-3"], re: /magnesium/i, conv: mg(0.4114) },
    { id: "phos", label: "PO4", loinc: ["2777-1", "14879-1"], re: /phosph/i, not: /alkaline|kinase/i, conv: mg(0.3229) },
    { id: "alb", label: "albumin", loinc: ["1751-7"], re: /albumin/i, not: /micro|creatinine|ratio/i, conv: (v, u) => (/g\s*\/\s*dl/i.test(u || "") || v < 10 ? v * 10 : v) },
    { id: "bili", label: "bili", loinc: ["1975-2", "42719-5"], re: /bilirubin/i, not: /direct|conjugated|indirect/i, conv: mg(17.1) },
    { id: "alt", label: "ALT", loinc: ["1742-6", "1743-4"], re: /alanine|\balt\b/i },
    { id: "ast", label: "AST", loinc: ["1920-8", "30239-8"], re: /aspartate|\bast\b/i },
    { id: "alp", label: "ALP", loinc: ["6768-6"], re: /alkaline phosphatase|\balp\b/i },
    { id: "lipase", label: "lipase", loinc: ["3040-3"], re: /lipase/i },
    { id: "trop", label: "troponin", loinc: ["89579-7", "67151-1", "10839-9", "6598-7", "49563-0"], re: /troponin/i },
    { id: "bnp", label: "BNP", loinc: ["30934-4", "33762-6", "42637-9"], re: /\bbnp\b|natriuretic/i },
    { id: "tsh", label: "TSH", loinc: ["3016-3", "11580-8"], re: /\btsh\b|thyrotropin/i },
    { id: "lactate", label: "lactate", loinc: ["2524-7", "32693-4"], re: /lactate|lactic/i }];
  const ULABS = [
    { id: "uprotcr", label: "urine prot/Cr", loinc: ["2890-2", "34366-5"], re: /protein.*creat|upcr/i },
    { id: "una", label: "urine Na", loinc: ["2955-3", "2956-1"], re: /sodium/i },
    { id: "ucr", label: "urine Cr", loinc: ["2161-8", "14683-7"], re: /creatinine/i, not: /ratio|clearance/i }];
  const MEDS = [
    ["anticoag", /apixaban|eliquis|rivaroxaban|xarelto|edoxaban|dabigatran|warfarin|coumadin|enoxaparin|dalteparin|tinzaparin|\bheparin\b/i],
    ["antiplatelet", /aspirin|\basa\b|clopidogrel|prasugrel|ticagrelor/i], ["ppi", /pantoprazole|omeprazole|esomeprazole|lansoprazole|rabeprazole/i],
    ["nsaid", /ibuprofen|naproxen|diclofenac|ketorolac|celecoxib|meloxicam|indomethacin/i], ["steroid", /prednisone|prednisolone|methylprednisolone|dexamethasone|hydrocortisone/i],
    ["nephrotoxic", /ibuprofen|naproxen|diclofenac|ketorolac|celecoxib|gentamicin|tobramycin|amikacin|vancomycin|iohexol|iodixanol|contrast|lithium|tacrolimus|cyclosporine|amphotericin/i],
    ["diuretic", /furosemide|bumetanide|torsemide|hydrochlorothiazide|chlorthalidone|indapamide|metolazone|spironolactone|eplerenone/i],
    ["acearb", /\w+pril\b|\w+sartan\b|sacubitril/i], ["k", /potassium chloride|\bkcl\b|k-?dur|slow-?k/i],
    ["rate", /metoprolol|bisoprolol|carvedilol|atenolol|propranolol|diltiazem|verapamil|digoxin|amiodarone/i],
    ["hfmeds", /sacubitril|spironolactone|eplerenone|dapagliflozin|empagliflozin|furosemide|bisoprolol|carvedilol|metoprolol succinate/i],
    ["qt", /haloperidol|ondansetron|ciprofloxacin|levofloxacin|moxifloxacin|azithromycin|clarithromycin|methadone|citalopram|escitalopram|quetiapine|domperidone|sotalol/i],
    ["liver", /lactulose|rifaximin|octreotide|terlipressin|albumin/i], ["nsbb", /propranolol|nadolol|carvedilol/i],
    ["rbc", /red blood cell|packed cells|prbc/i], ["abx", /ceftriaxone|piperacillin|meropenem|vancomycin|cefazolin|ciprofloxacin|metronidazole|amoxicillin/i]];

  function medText(m) {
    let t = label(m.medicationCodeableConcept) || (m.medicationReference && m.medicationReference.display) || "";
    if (!t && m.medicationReference && m.contained) { const c = m.contained.find((x) => m.medicationReference.reference === "#" + x.id); if (c) t = label(c.code); }
    const di = m.dosageInstruction && m.dosageInstruction[0], d = m.dosage && m.dosage.dose;
    return [t, d && d.value != null ? d.value + " " + (d.unit || "") : "", di && di.text].filter(Boolean).join(" ").trim();
  }

  function parse(raw, opts) {
    const now = (opts && opts.now) || Date.now();
    const f = { name: "", sex: "", age: null, mrn: "", labs: {}, u: {}, vit: [], meds: [], problems: [], prob: {}, enc: null };
    LABS.forEach((d) => (f.labs[d.id] = [])); ULABS.forEach((d) => (f.u[d.id] = []));
    const p = raw.patient;
    if (p) {
      f.sex = String(p.gender || "").toLowerCase();
      if (p.birthDate) f.age = Math.floor((now - new Date(p.birthDate).getTime()) / (365.25 * DAY));
      const n = (p.name && (p.name.find((x) => x.use === "official") || p.name[0])) || {};
      f.name = [(n.given || []).join(" "), n.family].filter(Boolean).join(" ");
      const id = (p.identifier || []).find((i) => /MR|mrn|medical record/i.test(JSON.stringify(i.type || "")) || /mrn/i.test(i.system || ""));
      f.mrn = id ? id.value : "";
    }
    const seen = new Set();
    (raw.obs || []).forEach((o) => {
      if (!o || o.resourceType !== "Observation" || /entered-in-error|cancelled/.test(o.status || "")) return;
      const t = tOf(o); if (t == null || t > now + DAY) return;
      const name = label(o.code), cs = codes(o.code), q = o.valueQuantity, u = (q && q.unit) || "";
      const key = name + cs.join() + t + (q ? q.value : ""); if (seen.has(key)) return; seen.add(key);
      // vitals (incl. BP panel components)
      const comp = (code, re) => { const c = (o.component || []).find((x) => codes(x.code).includes(code) || re.test(label(x.code))); return c && c.valueQuantity ? c.valueQuantity.value : null; };
      const vr = {};
      const sbp = comp("8480-6", /systolic/i), dbp = comp("8462-4", /diastolic/i);
      if (sbp != null) vr.sbp = sbp; if (dbp != null) vr.dbp = dbp;
      if (q && typeof q.value === "number") {
        if (cs.includes("8480-6") || /systolic/i.test(name)) vr.sbp = q.value;
        if (cs.includes("8462-4") || /diastolic/i.test(name)) vr.dbp = q.value;
        if (cs.includes("8867-4") || /heart rate|pulse rate/i.test(name)) vr.hr = q.value;
        if (cs.includes("9279-1") || /respiratory rate/i.test(name)) vr.rr = q.value;
        if (cs.some((c) => ["59408-5", "2708-6"].includes(c)) || /spo2|oxygen saturation/i.test(name)) vr.spo2 = q.value;
        if (cs.some((c) => ["8310-5", "8331-1"].includes(c)) || /body temperature|^temp/i.test(name)) vr.temp = q.value > 50 ? Math.round(((q.value - 32) * 5) / 9 * 10) / 10 : q.value;
      }
      if (Object.keys(vr).length) { const same = f.vit.find((r) => Math.abs(r.t - t) < 6e4); if (same) Object.assign(same, vr); else f.vit.push(Object.assign({ t }, vr)); return; }
      if (!q || typeof q.value !== "number" || OTHER.test(name)) return;
      if (URINE.test(name)) { const d = ULABS.find((x) => x.loinc.some((c) => cs.includes(c))) || ULABS.find((x) => x.re.test(name) && !(x.not && x.not.test(name))); if (d) f.u[d.id].push({ t, v: q.value, shown: q.value + " " + u }); return; }
      const d = LABS.find((x) => x.loinc.some((c) => cs.includes(c))) || LABS.find((x) => x.re.test(name) && !(x.not && x.not.test(name)));
      if (d) f.labs[d.id].push({ t, v: d.conv ? d.conv(q.value, u) : q.value, unit: u, hs: /high.?sens|hs-?tn/i.test(name) || ["89579-7", "67151-1"].some((c) => cs.includes(c)) });
    });
    const srt = (a) => a.sort((x, y) => x.t - y.t);
    Object.values(f.labs).forEach(srt); Object.values(f.u).forEach(srt); srt(f.vit);
    [].concat(raw.medreqs || [], raw.admins || []).forEach((m) => {
      const isReq = m.resourceType === "MedicationRequest";
      if (isReq && /cancelled|entered-in-error|draft|completed|stopped/.test(m.status || "")) return;
      const name = medText(m), cats = MEDS.filter(([, re]) => re.test(name)).map(([id]) => id);
      f.meds.push({ name, t: tOf(m), cats, held: isReq && /on-hold/.test(m.status || ""), active: isReq, given: !isReq });
    });
    (raw.conditions || []).forEach((c) => {
      if (c.clinicalStatus && /resolved|inactive|remission/i.test(JSON.stringify(c.clinicalStatus))) return;
      const n = label(c.code) || codes(c.code)[0]; if (n && !f.problems.includes(n)) f.problems.push(n);
      const txt = n + " " + codes(c.code).join(" ");
      if (/cirrho|K70\.3|K74|liver failure|portal hypertens/i.test(txt)) f.prob.liver = true;
      if (/heart failure|I50/i.test(txt)) f.prob.hf = true;
    });
    const encs = (raw.encounters || []).filter((e) => e.period && e.period.start && !/cancelled|entered-in-error|finished/.test(e.status || "")).sort((a, b) => new Date(a.period.start) - new Date(b.period.start));
    if (encs.length) {
      const e = encs[0], loc = (e.location || []).map((l) => l.location && l.location.display).filter(Boolean).pop();
      f.enc = { start: new Date(e.period.start).getTime(), location: loc || "", reason: (e.reasonCode || []).map(label).filter(Boolean)[0] || "" };
    }
    return f;
  }

  const latest = (arr, maxAge, now) => { const e = arr && arr.length ? arr[arr.length - 1] : null; return e && (!maxAge || (now || Date.now()) - e.t <= maxAge) ? e : null; };

  async function gather(client, say) {
    const pid = client.patient.id, errors = [], tell = say || (() => {});
    const iso = (t) => new Date(t).toISOString().slice(0, 10);
    async function get(url, name, pages) {
      const timer = new Promise((_, rej) => setTimeout(() => rej(new Error("timed out after 60 s")), 60000));
      try { const r = (await Promise.race([client.request(url, { pageLimit: pages || 1, flat: true }), timer])).filter((x) => x.resourceType && x.resourceType !== "OperationOutcome"); tell(`Loaded ${name} (${r.length})…`); return r; }
      catch (e) { errors.push(`${name}: ${e.message || e}`); return []; }
    }
    const s90 = iso(Date.now() - 90 * DAY), s3 = iso(Date.now() - 3 * DAY), s30 = iso(Date.now() - 30 * DAY);
    const [patient, labs, vit, medreqs, admins, conditions, encounters] = await Promise.all([
      (async () => { try { return await client.patient.read(); } catch (e) { errors.push("patient: " + (e.message || e)); return null; } })(),
      get(`Observation?patient=${pid}&category=laboratory&date=ge${s90}&_count=100`, "lab results (90 days)", 8),
      get(`Observation?patient=${pid}&category=vital-signs&date=ge${s3}&_count=100`, "vital signs (3 days)", 3),
      get(`MedicationRequest?patient=${pid}&_count=100`, "medication orders", 3),
      get(`MedicationAdministration?patient=${pid}&effective-time=ge${s3}&_count=100`, "medications given (3 days)", 2),
      get(`Condition?patient=${pid}&_count=100`, "problem list", 2),
      get(`Encounter?patient=${pid}&date=ge${s30}&_count=50`, "encounters", 1)]);
    return { raw: { patient, obs: labs.concat(vit), medreqs, admins, conditions, encounters }, errors };
  }

  window.ConsultChart = { LABS, ULABS, parse, latest, gather, DAY };
})();
