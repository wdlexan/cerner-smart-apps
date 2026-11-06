/* Kidney transplant screen - the engine. READ-ONLY, pure functions (no FHIR calls here; chart.js fetches).
   parse(raw)  : raw FHIR resources -> plain facts (meds, labs, drug levels, problems)
   evaluate()  : facts + rule table -> interactions, level timing, lab flags, context checks, watch list
   UNVERIFIED DRAFT: rules and thresholds come from rules-data.js and need clinical review. */
(function () {
  const DAY = 864e5, HR = 36e5;
  const SEV = { critical: 3, major: 2, moderate: 1, info: 0 };
  const label = (cc) => (cc && (cc.text || (cc.coding || []).map((c) => c.display).find(Boolean))) || "";
  const codes = (cc) => ((cc && cc.coding) || []).map((c) => String(c.code || ""));
  const tOf = (d) => { const t = d ? new Date(d).getTime() : NaN; return isNaN(t) ? null : t; };

  /* whole-word matching on normalised text: "St. John's Wort" -> " st john s wort " */
  const norm = (s) => " " + String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim() + " ";
  const has = (text, term) => norm(text).includes(norm(term));
  const hasAny = (text, terms) => (terms || []).find((t) => has(text, t)) || null;

  const TRANSPLANT_PROBLEM = /kidney transplant|renal transplant|transplanted kidney|kidney replaced by transplant|Z94\.0|T86\.1/i;
  const URINE = /urine|\bur\b|\burin|24 ?h(ou)?r/i, OTHER = /csf|fluid|pleural|ascit|peritoneal|stool|sweat|drain/i;
  const mgdl = (u) => /mg\s*\/\s*dl/i.test(u || "");

  /* drug levels first (so "tacrolimus level" is never read as anything else), then other labs */
  const LEVELS = [
    { id: "tacrolimus", re: /tacrolimus|fk ?506/i }, { id: "cyclosporine", re: /cyclospor|ciclospor/i },
    { id: "sirolimus", re: /sirolimus|rapamycin/i }, { id: "everolimus", re: /everolimus/i }];
  const LABS = [
    { id: "creatinine", loinc: ["2160-0", "38483-4", "14682-9"], re: /creatinine/i, not: /ratio|kinase|clearance/i, conv: (v, u) => (mgdl(u) || v < 20 ? v * 88.4 : v) },
    { id: "potassium", loinc: ["2823-3", "6298-4", "32713-0"], re: /potassium|^k\b/i },
    { id: "magnesium", loinc: ["19123-9", "2601-3"], re: /magnesium/i, conv: (v, u) => (mgdl(u) ? v * 0.4114 : v) },
    { id: "glucose", loinc: ["2345-7", "2339-0", "41653-7", "15074-8", "14749-6"], re: /glucose/i, not: /tolerance/i, conv: (v, u) => (mgdl(u) || v > 60 ? v / 18.016 : v) },
    { id: "wbc", loinc: ["6690-2", "26464-8", "33256-9"], re: /\bwbc\b|white blood|white cell|leukocytes?\b/i, not: /esterase|differential/i },
    { id: "neutrophils", loinc: ["751-8", "26499-4", "753-4"], re: /neutrophil|\banc\b/i, not: /%|percent|band|lymph/i, skipUnit: /%/ },
    { id: "platelets", loinc: ["777-3", "26515-7"], re: /platelet|\bplt\b/i, not: /function|antibod|mean|volume|distribution|aggregat/i },
    { id: "hemoglobin", loinc: ["718-7", "30313-1", "20509-6"], re: /hemoglobin|haemoglobin|^hgb\b|^hb\b/i, not: /a1c|glyc|free|corpuscular|mch|electrophor/i, conv: (v, u) => (/g\s*\/\s*dl/i.test(u || "") || v < 25 ? v * 10 : v) },
    { id: "ck", loinc: ["2157-6"], re: /creatine kinase|\bck\b|\bcpk\b/i, not: /mb|isoenz|index|relative/i },
    { id: "qtc", loinc: [], re: /qtc|qt corrected/i }];

  function medText(m) {
    let t = label(m.medicationCodeableConcept) || (m.medicationReference && m.medicationReference.display) || "";
    if (!t && m.medicationReference && m.contained) { const c = m.contained.find((x) => m.medicationReference.reference === "#" + x.id); if (c) t = label(c.code); }
    const di = m.dosageInstruction && m.dosageInstruction[0], d = m.dosage && m.dosage.dose;
    return [t, d && d.value != null ? d.value + " " + (d.unit || "") : "", di && di.text].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
  }

  function parse(raw, opts) {
    const now = (opts && opts.now) || Date.now();
    const f = { now, sex: "", age: null, meds: [], labs: {}, levels: {}, problems: [], transplantProblems: [], orderText: [] };
    LABS.forEach((d) => (f.labs[d.id] = [])); LEVELS.forEach((d) => (f.levels[d.id] = []));
    const p = raw.patient;
    if (p) { f.sex = String(p.gender || "").toLowerCase(); if (p.birthDate) f.age = Math.floor((now - new Date(p.birthDate).getTime()) / (365.25 * DAY)); }

    /* medications: orders and administrations */
    (raw.medreqs || []).forEach((m) => {
      const st = String(m.status || "active");
      if (/cancelled|entered-in-error|draft/.test(st)) return;
      const di = m.dosageInstruction && m.dosageInstruction[0], bp = di && di.timing && di.timing.repeat && di.timing.repeat.boundsPeriod;
      const start = tOf(bp && bp.start) || tOf(m.authoredOn);
      let stop = tOf(bp && bp.end) || tOf(m.dispenseRequest && m.dispenseRequest.validityPeriod && m.dispenseRequest.validityPeriod.end);
      let current = /active|on-hold/.test(st) && !(stop && stop < now);
      f.meds.push({ kind: "order", name: medText(m), status: st, start, stop: current ? null : stop, current });
    });
    (raw.admins || []).forEach((m) => {
      if (/not-done|entered-in-error|stopped/.test(m.status || "")) return;
      const t = tOf(m.effectiveDateTime) || tOf(m.effectivePeriod && m.effectivePeriod.start);
      if (t == null || t > now + HR) return;
      f.meds.push({ kind: "given", name: medText(m), t });
    });

    /* labs and drug levels */
    const seen = new Set();
    (raw.obs || []).forEach((o) => {
      if (!o || o.resourceType !== "Observation" || /entered-in-error|cancelled/.test(o.status || "")) return;
      const q = o.valueQuantity; if (!q || typeof q.value !== "number") return;
      const t = tOf(o.effectiveDateTime) || tOf(o.effectivePeriod && o.effectivePeriod.start) || tOf(o.issued); if (t == null || t > now + DAY) return;
      const name = label(o.code), cs = codes(o.code), u = q.unit || "", where = name + " " + ((o.specimen && o.specimen.display) || "");
      const key = name + cs.join() + t + q.value; if (seen.has(key)) return; seen.add(key);
      const rr = o.referenceRange && o.referenceRange[0], high = rr && rr.high && typeof rr.high.value === "number" ? rr.high.value : null;
      const lv = LEVELS.find((x) => x.re.test(name));
      if (lv) { f.levels[lv.id].push({ t, v: q.value, unit: u, name }); return; }
      if (OTHER.test(where) || URINE.test(where)) return;
      const d = LABS.find((x) => x.loinc.some((c) => cs.includes(c))) || LABS.find((x) => x.re.test(name) && !(x.not && x.not.test(name)));
      if (!d || (d.skipUnit && d.skipUnit.test(u))) return;
      f.labs[d.id].push({ t, v: d.conv ? d.conv(q.value, u) : q.value, shown: q.value + " " + u, high });
    });
    Object.values(f.labs).concat(Object.values(f.levels)).forEach((a) => a.sort((x, y) => x.t - y.t));

    /* problem list */
    (raw.conditions || []).forEach((c) => {
      if (c.clinicalStatus && /resolved|inactive|remission/i.test(JSON.stringify(c.clinicalStatus))) return;
      const txt = label(c.code), all = txt + " " + codes(c.code).join(" ");
      f.problems.push(txt || codes(c.code)[0] || "");
      if (TRANSPLANT_PROBLEM.test(all)) f.transplantProblems.push(txt || codes(c.code)[0]);
    });
    /* diet / service orders (for NPO, contrast) - optional, many sites do not expose these */
    (raw.orders || []).forEach((o) => {
      if (/revoked|entered-in-error|completed|cancelled/.test(o.status || "")) return;
      const txt = [label(o.code), (o.oralDiet && (o.oralDiet.type || []).map(label).join(" ")) || "", o.text && o.text.div ? o.text.div.replace(/<[^>]+>/g, " ") : "", (o.note || []).map((n) => n.text).join(" ")].join(" ");
      if (txt.trim()) f.orderText.push(txt.replace(/\s+/g, " ").trim());
    });
    return f;
  }

  /* All chart mentions of the given terms, folded into one "drug group":
     current (ordered now, or given in the past 36 h and not since stopped), start, stop, names seen. */
  function group(f, terms, now) {
    const hits = f.meds.filter((m) => hasAny(m.name, terms));
    if (!hits.length) return null;
    const orders = hits.filter((m) => m.kind === "order"), given = hits.filter((m) => m.kind === "given").sort((a, b) => a.t - b.t);
    const lastGiven = given.length ? given[given.length - 1].t : null;
    const activeOrder = orders.find((m) => m.current);
    const stoppedAfterLast = orders.some((m) => !m.current && m.stop && (!lastGiven || m.stop >= lastGiven));
    const current = !!activeOrder || (lastGiven != null && now - lastGiven <= 36 * HR && !stoppedAfterLast);
    const starts = orders.filter((m) => m.current && m.start).map((m) => m.start).concat(given.filter((g) => now - g.t <= 14 * DAY).map((g) => g.t));
    const start = current && starts.length ? Math.min(...starts) : null;
    let stop = null;
    if (!current) {
      const stops = orders.map((m) => m.stop).filter(Boolean).concat(lastGiven ? [lastGiven] : []);
      stop = stops.length ? Math.max(...stops) : null;
    }
    const recent = current || (stop && now - stop <= 14 * DAY) || (!stop && orders.some((m) => m.start && now - m.start <= 30 * DAY));
    return { current, start, stop, recent, names: [...new Set(hits.map((m) => m.name))], text: hits.map((m) => m.name).join(" | ") };
  }

  const PROPHYLAXIS_DOSE = /prophyla|pjp|pcp|single.?strength|\bss\b|400\s*mg|three times (a |per )?week|3 times (a |per )?week|mon.{0,4}wed|m\/w\/f|\btiw\b|qmwf/i;

  function evaluate(f, RULES, opts) {
    opts = opts || {};
    const now = opts.now || f.now || Date.now(), ctx = opts.ctx || {}, targets = opts.targets || {};
    const out = { now, immunos: [], alerts: [], levels: [], labs: [], context: [], watch: [], prophylaxis: { found: [], missing: [] } };

    /* 1. immunosuppressants present */
    const imm = {};
    RULES.immunosuppressants.forEach((d) => {
      const g = group(f, d.matchTerms, now);
      if (!g) return;
      const present = d.id === "belatacept" ? g.recent || g.current || (g.stop && now - g.stop <= 35 * DAY) : g.current;
      if (!present) return;
      let subtype = null;
      if (d.subtypes) subtype = Object.keys(d.subtypes).find((k) => hasAny(g.text, d.subtypes[k])) || "unknown";
      imm[d.id] = { def: d, g, subtype };
      out.immunos.push({ id: d.id, name: d.name, cls: d.class, names: g.names, subtype, notes: d.notes, start: g.start });
    });
    out.transplant = { problems: f.transplantProblems, onImmuno: out.immunos.length > 0, detected: f.transplantProblems.length > 0 || out.immunos.length > 0 };
    const present = (ids) => (ids || []).filter((id) => imm[id]);

    /* 2. interaction rules */
    RULES.rules.forEach((r) => {
      let affected = present(r.affects);
      if (r.appliesToSubtype) affected = affected.filter((id) => !imm[id].subtype || imm[id].subtype === r.appliesToSubtype || imm[id].subtype === "unknown");
      if (!affected.length) return;
      const triggers = [];
      r.triggerTerms.forEach((term) => {
        const g = group(f, [term], now);
        if (!g || !(g.current || (r.levelCheck && r.levelCheck.alsoOnStop && g.stop && now - g.stop <= 14 * DAY))) return;
        if (affected.some((id) => hasAny(g.text, imm[id].def.matchTerms) && g.names.every((n) => hasAny(n, imm[id].def.matchTerms)))) return; // the immunosuppressant itself
        triggers.push(Object.assign({ term }, g));
      });
      if (!triggers.length) return;
      // a trigger term inside a longer one (e.g. "trimethoprim" within the same order as "sulfamethoxazole") is one drug: keep distinct orders only
      const uniq = [];
      triggers.forEach((t) => {
        const u = uniq.find((x) => x.names.some((n) => t.names.includes(n)));
        if (!u) { uniq.push(Object.assign({}, t, { names: t.names.slice() })); return; }
        t.names.forEach((n) => { if (!u.names.includes(n)) u.names.push(n); });
        u.text += " | " + t.text; u.current = u.current || t.current;
        if (t.start && (!u.start || t.start < u.start)) u.start = t.start;
        if (t.stop && (!u.stop || t.stop > u.stop)) u.stop = t.stop;
      });
      uniq.forEach((u) => { if (u.current) u.stop = null; });
      let sev = SEV[r.severity];
      affected.forEach((id) => { if (r.severityOverrides && r.severityOverrides[id] != null) sev = Math.max(sev, SEV[r.severityOverrides[id]]); });
      uniq.forEach((t) => { if (r.severityByTrigger && r.severityByTrigger[t.term] != null) sev = Math.max(sev, SEV[r.severityByTrigger[t.term]]); });
      let note = "";
      if (r.id === "R11" && uniq.filter((t) => t.current).every((t) => PROPHYLAXIS_DOSE.test(t.text))) { sev = SEV.info; note = "Order looks like a PJP prophylaxis dose: expected. Monitor potassium if creatinine is rising."; }
      if (r.appliesToSubtype && affected.some((id) => imm[id].subtype === "unknown")) note = (note ? note + " " : "") + "Applies to mycophenolate mofetil (CellCept); the order does not say which form.";
      const onlyStopped = uniq.every((t) => !t.current);
      out.alerts.push({ id: r.id, title: r.title, sevN: sev, severity: Object.keys(SEV).find((k) => SEV[k] === sev), effect: r.effect,
        triggers: uniq, onlyStopped, affects: affected.map((id) => imm[id].def.name), affectIds: affected, mechanism: r.mechanism, action: r.action, note, levelCheck: r.levelCheck, labsToWatch: r.labsToWatch || [] });
    });
    out.alerts.sort((a, b) => b.sevN - a.sevN || (a.onlyStopped - b.onlyStopped) || a.id.localeCompare(b.id));

    /* 3. drug levels and when to test */
    const labWatch = {}; (RULES.labWatch.items || []).forEach((i) => (labWatch[i.id] = i));
    const creat = creatinineCheck(f.labs.creatinine, labWatch.creatinine, now);
    RULES.immunosuppressants.filter((d) => d.levelMonitored && imm[d.id]).forEach((d) => {
      const lv = f.levels[d.id] || [], last = lv.length ? lv[lv.length - 1] : null, row = { id: d.id, name: d.name, levelType: d.levelType, last, recent: lv.slice(-6).reverse(), events: [], prompts: [], target: targets[d.id] || null };
      if (row.target && last && (last.v < row.target[0] || last.v > row.target[1])) row.outOfRange = last.v < row.target[0] ? "low" : "high";
      out.alerts.forEach((a) => {
        if (!a.levelCheck || !a.levelCheck.required || !a.affectIds.includes(d.id)) return;
        const days = a.levelCheck.daysAfterStart || d.routineRecheckDays;
        a.triggers.forEach((t) => {
          let kind, t0;
          if (t.current && t.start) { kind = "started"; t0 = t.start; }
          else if (!t.current && a.levelCheck.alsoOnStop && t.stop) { kind = "stopped"; t0 = t.stop; }
          else if (t.current) { kind = "on"; t0 = null; }
          else return;
          const ev = { rule: a.id, title: a.title, drug: t.names[0], kind, t: t0, note: a.levelCheck.note || "" };
          if (t0 == null) { ev.status = last && now - last.t <= 3 * DAY ? "done" : "due"; ev.windowStart = ev.windowEnd = null; }
          else {
            ev.windowStart = t0 + days[0] * DAY; ev.windowEnd = t0 + days[days.length - 1] * DAY;
            const after = lv.find((x) => x.t >= ev.windowStart - 12 * HR);
            ev.status = after ? "done" : now < ev.windowStart ? "upcoming" : now <= ev.windowEnd ? "due" : "overdue";
            if (after) ev.doneWith = after;
          }
          row.events.push(ev);
        });
      });
      const old = !last || now - last.t > 7 * DAY;
      if (old) row.prompts.push(last ? "No level in the last 7 days (last " + Math.round((now - last.t) / DAY) + " d ago)." : "No level found in the chart.");
      if (ctx.diarrhea && d.id === "tacrolimus") row.prompts.push("Diarrhea can raise tacrolimus levels: check a trough.");
      if (ctx.npo) row.prompts.push("NPO or unable to take oral: route plan needed (see context checks).");
      if (creat && creat.flag) row.prompts.push("Creatinine is up from baseline: check a level (toxicity vs other cause).");
      if (row.outOfRange) row.prompts.push("Last level is " + row.outOfRange + " for the target you entered.");
      const pending = row.events.filter((e) => e.status !== "done" && e.windowStart);
      row.nextDue = pending.length ? Math.min(...pending.map((e) => e.windowStart)) : null;
      row.dueNow = row.events.some((e) => e.status === "due" || e.status === "overdue") || (row.prompts.length > 0 && (old || ctx.diarrhea || (creat && creat.flag)));
      out.levels.push(row);
    });

    /* 4. labs to watch */
    RULES.labWatch.items.forEach((i) => {
      if (i.kind === "level") return;
      const arr = f.labs[i.id] || [], latest = arr.length ? arr[arr.length - 1] : null, fresh = latest && now - latest.t <= (i.maxAgeDays || 3) * DAY;
      const row = { id: i.id, label: i.label, rule: i.rule, severity: i.severity, message: i.message, latest, fresh, flag: false, detail: "" };
      if (i.kind === "creatinine") { if (creat) { row.flag = creat.flag && fresh; row.detail = creat.detail; } }
      else if (latest && fresh) {
        if (i.kind === "above") row.flag = latest.v > i.value;
        if (i.kind === "below") row.flag = latest.v < i.value;
        if (i.kind === "uln") { const uln = latest.high || i.defaultUln; row.flag = latest.v > i.times * uln; row.detail = "ULN " + uln; }
        if (i.kind === "drop") {
          const prior = arr.filter((x) => x.t < latest.t && latest.t - x.t <= i.hours * HR);
          const max = prior.length ? Math.max(...prior.map((x) => x.v)) : null;
          if (max != null) { row.flag = max - latest.v >= i.value; row.detail = "from " + Math.round(max) + " in " + i.hours + " h"; }
        }
      }
      out.labs.push(row);
    });

    /* 5. context checks */
    const anyImm = (ids) => present(ids).length > 0;
    RULES.contextChecks.forEach((c) => {
      if (!anyImm(c.appliesTo)) return;
      const dt = c.detect || {};
      let active = false, extra = "";
      if (dt.always) active = true;
      if (dt.conditionTerms) active = !!ctx.diarrhea;
      if (dt.orderTerms) active = c.id === "C02" ? !!ctx.npo : !!ctx.contrast;
      if (dt.levelOlderThanDays) { const old = out.levels.filter((l) => !l.last || now - l.last.t > dt.levelOlderThanDays * DAY); active = old.length > 0; if (active) extra = "No recent level: " + old.map((l) => l.name).join(", ") + "."; }
      if (dt.checkMedsPresent) {
        dt.checkMedsPresent.forEach((term) => { const g = group(f, [term], now); if (g && g.current) out.prophylaxis.found.push(g.names[0]); });
        out.prophylaxis.found = [...new Set(out.prophylaxis.found)];
        extra = out.prophylaxis.found.length ? "Found: " + out.prophylaxis.found.join("; ") + "." : "No PJP or CMV prophylaxis found among current orders.";
        active = true;
      }
      if (c.id === "C03" && ctx.unwell) extra = "You ticked acutely unwell / surgery: review stress dosing now.";
      if (active) out.context.push({ id: c.id, title: c.title, message: c.message, extra, urgent: (c.id === "C03" && !!ctx.unwell) || c.id === "C02" });
    });

    /* 6. what to watch for, by drug class present */
    const classes = new Set(out.immunos.map((i) => i.cls)), W = RULES.clinicalWatchList;
    if (classes.has("CNI")) out.watch.push(["Calcineurin inhibitor (tacrolimus / cyclosporine)", W.CNI]);
    if (classes.has("mTOR")) out.watch.push(["mTOR inhibitor (sirolimus / everolimus)", W.mTOR]);
    if (classes.has("antimetabolite")) out.watch.push(["Mycophenolate / azathioprine", W.antimetabolite]);
    if (classes.has("steroid")) out.watch.push(["Steroid", W.steroid]);
    if (out.transplant.detected) out.watch.push(["Any transplant patient", W.general]);

    out.counts = { critical: 0, major: 0, moderate: 0, info: 0 };
    out.alerts.forEach((a) => out.counts[a.severity]++);
    return out;
  }

  /* creatinine vs baseline: baseline = lowest value 3-90 days old; rise also checked within 48 h */
  function creatinineCheck(arr, rule, now) {
    if (!arr || !arr.length || !rule) return null;
    const latest = arr[arr.length - 1];
    const base = arr.filter((x) => now - x.t >= 3 * DAY && now - x.t <= 90 * DAY);
    const baseline = base.length ? Math.min(...base.map((x) => x.v)) : null;
    const prior48 = arr.filter((x) => x.t < latest.t && latest.t - x.t <= 48 * HR);
    const low48 = prior48.length ? Math.min(...prior48.map((x) => x.v)) : null;
    const pct = baseline ? (latest.v / baseline - 1) * 100 : null, abs48 = low48 != null ? latest.v - low48 : null;
    const flag = (pct != null && pct >= rule.pct) || (abs48 != null && abs48 >= rule.abs);
    const bits = [];
    if (baseline) bits.push("baseline " + Math.round(baseline) + " (" + (pct >= 0 ? "+" : "") + Math.round(pct) + "%)"); else bits.push("no baseline (no value 3-90 days old)");
    if (abs48 != null) bits.push((abs48 >= 0 ? "+" : "") + Math.round(abs48) + " in 48 h");
    return { latest, baseline, pct, abs48, flag, detail: bits.join(", ") };
  }

  /* chart hints for the context tick-boxes (the user confirms them) */
  function detectContext(f, RULES) {
    const terms = (id) => ((RULES.contextChecks.find((c) => c.id === id) || {}).detect || {});
    const out = { diarrhea: [], npo: [], contrast: [] };
    out.diarrhea = f.problems.filter((p) => hasAny(p, terms("C01").conditionTerms));
    out.npo = f.orderText.filter((t) => hasAny(t, terms("C02").orderTerms));
    out.contrast = f.orderText.filter((t) => hasAny(t, terms("C05").orderTerms));
    return out;
  }

  const API = { parse, evaluate, detectContext, group, norm, has, creatinineCheck, SEV, DAY, HR };
  if (typeof module !== "undefined") module.exports = API; else window.TxEngine = API;
})();
