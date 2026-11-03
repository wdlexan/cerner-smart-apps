/* Chart reading for the Parkinson's tab. READ-ONLY. Meds (orders + MAR), creatinine/weight, orthostatic BP, problem list, and the text of recent notes.
   Note text uses the mobility tab's reader (../mobility/chart.js: MobChart.getText). Patterns UNVERIFIED. */
(function () {
  const DAY = 864e5, R = window.PdRules;
  const label = (cc) => (cc && (cc.text || (cc.coding || []).map((c) => c.display).find(Boolean))) || "";
  const codes = (cc) => ((cc && cc.coding) || []).map((c) => String(c.code || ""));
  const tOf = (r) => { const d = r.effectiveDateTime || (r.effectivePeriod && r.effectivePeriod.start) || r.date || r.issued || r.authoredOn || r.recordedDate || ""; const t = d ? new Date(d).getTime() : NaN; return isNaN(t) ? null : t; };
  function medText(m) {
    let t = label(m.medicationCodeableConcept) || (m.medicationReference && m.medicationReference.display) || "";
    if (!t && m.medicationReference && m.contained) { const c = m.contained.find((x) => m.medicationReference.reference === "#" + x.id); if (c) t = label(c.code); }
    const di = m.dosageInstruction && m.dosageInstruction[0], d = m.dosage && m.dosage.dose;
    const tod = di && di.timing && di.timing.repeat && di.timing.repeat.timeOfDay ? " at " + di.timing.repeat.timeOfDay.map((x) => x.slice(0, 5)).join(", ") : "";
    return [t, d && d.value != null ? d.value + " " + (d.unit || "") : "", di && di.text, tod].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
  }

  /* raw: { patient, medreqs, admins, conditions, obs, notes: [{title, t, text}] } */
  function parse(raw, opts) {
    const now = (opts && opts.now) || Date.now();
    const f = { sex: "", age: null, orders: [], gives: [], meds: [], problems: [], cr: null, wt: null, orth: [], notes: [], npoHint: null };
    const p = raw.patient;
    if (p) { f.sex = String(p.gender || "").toLowerCase(); if (p.birthDate) f.age = Math.floor((now - new Date(p.birthDate).getTime()) / (365.25 * DAY)); }
    (raw.medreqs || []).forEach((m) => {
      if (/cancelled|entered-in-error|draft|completed|stopped/.test(m.status || "")) return;
      const name = medText(m), d = R.drugOf(name);
      const rec = { name, t: tOf(m), held: /on-hold/.test(m.status || ""), prn: /\bprn\b|as needed/i.test(name), isPd: !!d, drug: d };
      f.meds.push(rec); if (d) f.orders.push(rec);
    });
    (raw.admins || []).forEach((m) => { const name = medText(m), d = R.drugOf(name), t = tOf(m); if (t) { f.gives.push({ name, t, drug: d }); if (!d) f.meds.push({ name, t, given: true }); } });
    (raw.conditions || []).forEach((c) => { if (c.clinicalStatus && /resolved|inactive/i.test(JSON.stringify(c.clinicalStatus))) return; const n = label(c.code) || codes(c.code)[0]; if (n) f.problems.push(n + " " + codes(c.code).join(" ")); });
    const sbp = [];
    (raw.obs || []).forEach((o) => {
      if (!o || o.resourceType !== "Observation") return;
      const t = tOf(o), name = label(o.code), cs = codes(o.code), q = o.valueQuantity; if (!t) return;
      if (q && typeof q.value === "number") {
        if ((cs.some((c) => ["2160-0", "38483-4"].includes(c)) || /creatinine/i.test(name)) && !/urine|ratio|clearance/i.test(name)) { const v = /mg\/dl/i.test(q.unit || "") ? q.value * 88.4 : q.value; if (!f.cr || t > f.cr.t) f.cr = { t, v }; }
        if (cs.some((c) => ["29463-7", "3141-9"].includes(c)) || /body weight/i.test(name)) { if (!f.wt || t > f.wt.t) f.wt = { t, v: q.value }; }
        const pos = cs.includes("8461-6") || /supine|lying/i.test(name) ? "lying" : cs.includes("8459-0") || /sitting/i.test(name) ? "sitting" : cs.includes("8460-8") || /standing/i.test(name) ? "standing" : null;
        if (pos && (/systolic/i.test(name) || ["8461-6", "8459-0", "8460-8"].some((c) => cs.includes(c)))) sbp.push({ t, pos, v: q.value });
      }
    });
    // orthostatic pairs: lying or sitting then standing within 30 min
    sbp.filter((x) => x.pos === "standing").forEach((st) => {
      const base = sbp.filter((x) => x.pos !== "standing" && Math.abs(st.t - x.t) <= 30 * 60e3).sort((a, b) => b.v - a.v)[0];
      if (base) f.orth.push({ t: st.t, base: base.v, stand: st.v, drop: base.v - st.v, pos: base.pos });
    });
    f.orth.sort((a, b) => a.t - b.t);
    f.notes = (raw.notes || []).filter((n) => n.text && (!n.t || now - n.t <= 4 * DAY));
    const npo = f.notes.find((n) => /\bNPO\b|nil by mouth|nothing by mouth|unable to swallow (pills|tablets|meds)/i.test(n.text) && now - n.t <= DAY);
    if (npo) f.npoHint = npo;
    return f;
  }

  async function gather(client, say) {
    const pid = client.patient.id, errors = [], tell = say || (() => {});
    const iso = (t) => new Date(t).toISOString().slice(0, 10);
    async function get(url, name, pages) {
      const timer = new Promise((_, rej) => setTimeout(() => rej(new Error("timed out after 60 s")), 60000));
      try { const r = (await Promise.race([client.request(url, { pageLimit: pages || 1, flat: true }), timer])).filter((x) => x.resourceType && x.resourceType !== "OperationOutcome"); tell(`Loaded ${name} (${r.length})…`); return r; }
      catch (e) { errors.push(`${name}: ${e.message || e}`); return []; }
    }
    const s4 = iso(Date.now() - 4 * DAY), s14 = iso(Date.now() - 14 * DAY);
    const [patient, medreqs, admins, conditions, labs, vit, wt, docs] = await Promise.all([
      (async () => { try { return await client.patient.read(); } catch (e) { errors.push("patient: " + (e.message || e)); return null; } })(),
      get(`MedicationRequest?patient=${pid}&_count=100`, "medication orders", 3),
      get(`MedicationAdministration?patient=${pid}&effective-time=ge${s4}&_count=100`, "medications given (4 days)", 4),
      get(`Condition?patient=${pid}&_count=100`, "problem list", 2),
      get(`Observation?patient=${pid}&code=http://loinc.org|2160-0,http://loinc.org|38483-4&date=ge${s14}&_count=50`, "creatinine", 1),
      get(`Observation?patient=${pid}&category=vital-signs&date=ge${s4}&_count=100`, "vital signs (4 days)", 4),
      get(`Observation?patient=${pid}&code=http://loinc.org|29463-7,http://loinc.org|3141-9&_count=20`, "weight", 1),
      get(`DocumentReference?patient=${pid}&date=ge${s4}&_count=50`, "notes (4 days)", 2)]);
    const wanted = docs.filter((d) => d.status !== "entered-in-error").sort((a, b) => (tOf(b) || 0) - (tOf(a) || 0)).slice(0, 15);
    const notes = [];
    for (let i = 0; i < wanted.length; i += 5) {
      tell(`Reading notes ${Math.min(i + 5, wanted.length)} of ${wanted.length}…`);
      notes.push(...(await Promise.all(wanted.slice(i, i + 5).map(async (d) => { try { return { title: label(d.type) || "Note", t: tOf(d), text: await window.MobChart.getText(client, d) }; } catch (e) { return { title: label(d.type), t: tOf(d), text: "" }; } }))));
    }
    return { raw: { patient, medreqs, admins, conditions, obs: labs.concat(vit, wt), notes }, errors };
  }

  window.PdChart = { parse, gather, DAY };
})();
