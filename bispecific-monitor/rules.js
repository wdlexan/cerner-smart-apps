/* Grading and alert logic for the Bispecific CRS/ICANS monitor. Pure functions: no page, no network. Tested in test_rules.js.
   Source of every rule: the SCCRS and SCICANS protocols (see protocol.js). Where the two protocols or the app have to choose, it is noted "CHOICE:". */
(function () {
  const H = 36e5, MIN = 6e4;
  const FEVER = 38.0;

  /* ---------- ICE score ---------- */
  const ICE_MAX = { orient: 4, naming: 3, command: 1, writing: 1, attention: 1 };
  // total out of 10, or null if any item is blank (incomplete)
  function iceTotal(ice) {
    if (!ice) return null;
    let s = 0;
    for (const k of Object.keys(ICE_MAX)) {
      if (ice[k] === "" || ice[k] == null || isNaN(Number(ice[k]))) return null;
      s += Math.min(Math.max(Number(ice[k]), 0), ICE_MAX[k]);
    }
    return s;
  }

  /* ---------- CRS grade (ASTCT, SCCRS table) ----------
     Fever >= 38.0 is required. Grade = highest of: hypotension (fluid-responsive 2, one vasopressor 3, multiple 4) and hypoxia (low-flow 2, high-flow/mask 3, positive pressure 4).
     CHOICE: with no fever but hypotension/hypoxia present the app shows a PROVISIONAL grade (fever can be masked by acetaminophen or steroids). */
  const HYPO_G = { none: 0, fluid: 2, one: 3, multi: 4 };
  const O2_G = { ra: 0, low: 2, high: 3, pp: 4 };
  function crs(S) {
    const recent = (S.readings || []).filter((r) => r.temp != null && S.now - r.t <= 24 * H && r.t <= S.now + 5 * MIN);
    const tmax = recent.length ? Math.max.apply(null, recent.map((r) => r.temp)) : null;
    const feverSeen = !!S.in.feverMasked || (tmax != null && tmax >= FEVER);
    const organ = Math.max(HYPO_G[S.in.hypo] || 0, O2_G[S.in.o2] || 0);
    const grade = feverSeen ? Math.max(1, organ) : 0;
    const provisional = !feverSeen && organ > 0 ? organ : 0;
    // "persistent Grade 1 not responding ... treat as grade 2"
    const effective = grade === 1 && S.in.g1persist ? 2 : grade;
    // Grade 2 with extensive comorbidities or poor performance status: manage per grade 3
    const manageAs = effective === 2 && S.in.comorbid ? 3 : Math.max(effective, provisional ? Math.min(provisional, 4) : 0);
    const notes = [];
    if (provisional) notes.push("No fever documented, so this is provisional. Fever can be masked by acetaminophen or a steroid dose; hypotension or a new oxygen need still needs attention.");
    if (grade === 1 && S.in.g1persist) notes.push("Persistent grade 1 not responding to measures: protocol says treat as grade 2.");
    if (effective === 2 && S.in.comorbid) notes.push("Extensive comorbidities or poor performance status: protocol says manage per grade 3.");
    return { grade, provisional, effective, manageAs: Math.min(manageAs, 4), feverSeen, tmax, notes, unlikely: !!S.in.fullDoseNoCRS };
  }

  /* ---------- ICANS grade (ASTCT, SCICANS Table 2) ----------
     Grade = most severe of: ICE score, level of consciousness, seizure, motor findings, raised ICP/edema.
     ICE 7-9 -> 1; 3-6 -> 2; 0-2 -> 3; 0 AND unrousable -> 4.
     Level of consciousness: awakens spontaneously gives no grade by itself (it is only the Grade 1 column when ICE is 7-9); to voice -> 2; tactile only -> 3; unrousable or vigorous/repeated tactile -> 4. */
  const LOC_G = { awake: 0, voice: 2, tactile: 3, unrousable: 4 };
  function icans(S) {
    const total = iceTotal(S.in.ice);
    const parts = [];
    let g = 0;
    const add = (gr, why) => { if (gr > 0) parts.push({ g: gr, why }); g = Math.max(g, gr); };
    if (total != null) {
      if (total === 0 && S.in.loc === "unrousable") add(4, "ICE 0 and unrousable");
      else if (total <= 2) add(3, "ICE " + total);
      else if (total <= 6) add(2, "ICE " + total);
      else if (total <= 9) add(1, "ICE " + total);
    }
    add(LOC_G[S.in.loc] || 0, { voice: "awakens to voice", tactile: "awakens only to tactile stimulus", unrousable: "unrousable or needs vigorous/repeated tactile stimulus" }[S.in.loc]);
    add({ none: 0, g3: 3, g4: 4 }[S.in.seizure] || 0, S.in.seizure === "g4" ? "life-threatening prolonged or repetitive seizures" : "seizure");
    add({ none: 0, g4: 4 }[S.in.motor] || 0, "deep focal motor weakness");
    add({ none: 0, g3: 3, g4: 4 }[S.in.icp] || 0, S.in.icp === "g4" ? "diffuse cerebral edema / raised ICP signs" : "focal edema on neuroimaging");
    const base = S.in.baselineIce == null || S.in.baselineIce === "" ? 10 : Number(S.in.baselineIce);
    // Appendix 1: notify MRP immediately if ICE < 9 or any change from baseline
    const notifyMRP = total != null && (total < 9 || total !== base);
    return { grade: g, total, parts, notifyMRP, done: total != null, baseline: base };
  }

  /* ---------- fever pattern (home rule) ----------
     "if fever persists for longer than 1 hour or recurs within 6 hours, advise patient to present".
     CHOICE: persists = a run of consecutive febrile readings spanning 60 minutes or more (>= so hourly checks catch it at the second reading).
             recurs = febrile again within 6 hours of an earlier fever, after an afebrile reading in between.
     CHOICE: the protocol prints "> 38.0" here and ">= 38.0" in the grading table; the app uses >= 38.0 throughout. */
  function feverPattern(readings, now) {
    const asc = (readings || []).filter((r) => r.temp != null && now - r.t <= 12 * H && r.t <= now + 5 * MIN).sort((a, b) => a.t - b.t);
    const out = { febrileNow: false, runMin: 0, persist: false, recur: false };
    if (!asc.length) return out;
    const last = asc[asc.length - 1];
    if (last.temp < FEVER) return out;
    out.febrileNow = true;
    let i = asc.length - 1;
    while (i > 0 && asc[i - 1].temp >= FEVER) i--;
    out.runMin = Math.round((last.t - asc[i].t) / MIN);
    out.persist = out.runMin >= 60;
    if (i > 0) {
      const prev = asc.slice(0, i).reverse().find((r) => r.temp >= FEVER);
      if (prev && asc[i].t - prev.t <= 6 * H) out.recur = true;
    }
    return out;
  }

  /* ---------- doses ---------- */
  function doseInfo(S) {
    const doses = (S.doses || []).filter((d) => d.t <= S.now + 5 * MIN);
    const tec = doses.filter((d) => d.drug === "tec").sort((a, b) => a.t - b.t);
    const toci = doses.filter((d) => d.drug === "toci").sort((a, b) => a.t - b.t);
    const lastTec = tec.length ? tec[tec.length - 1] : null, firstTec = tec[0] || null;
    const hrs = lastTec ? (S.now - lastTec.t) / H : null;
    // tocilizumab near the first teclistamab dose (shown for the physician; no pass/fail because the timing rule is the local protocol's)
    let tociNearFirst = null;
    if (firstTec && toci.length) {
      tociNearFirst = toci.map((d) => ({ d, diffH: (d.t - firstTec.t) / H })).sort((a, b) => Math.abs(a.diffH) - Math.abs(b.diffH))[0];
      if (Math.abs(tociNearFirst.diffH) > 48) tociNearFirst = null;
    }
    const toci24 = toci.filter((d) => S.now - d.t <= 24 * H).length;
    return { tec, toci, lastTec, firstTec, hrs, inWindow: hrs != null && hrs <= 48, tociNearFirst, toci24, tociTotal: toci.length };
  }
  // tocilizumab 8 mg/kg, maximum 800 mg (SCCRS Grade 2 and 3/4)
  function tociDose(kg) { if (!(kg > 0)) return null; const raw = 8 * kg; return { mg: Math.min(raw, 800), capped: raw > 800, raw }; }

  /* ---------- discharge criterion (facility Grade 1) ----------
     "afebrile with normal vital signs for at least 4 hours". CHOICE: normal = temp < 38.0, SBP >= 100 and not > 20 below baseline, SpO2 > 92.
     Heart rate and respiratory rate have no printed threshold, so they are left to the physician. */
  function normalReading(r, base) {
    if (r.temp != null && r.temp >= FEVER) return false;
    if (r.sbp != null && (r.sbp < 100 || (base && base - r.sbp > 20))) return false;
    if (r.spo2 != null && r.spo2 <= 92) return false;
    return true;
  }
  function stable4h(S) {
    const rs = (S.readings || []).filter((r) => r.t <= S.now + 5 * MIN).sort((a, b) => b.t - a.t);
    if (!rs.length) return { ok: false, why: "no readings" };
    if (S.now - rs[0].t > 2 * H) return { ok: false, why: "latest reading is more than 2 hours old" };
    let i = 0; while (i < rs.length && normalReading(rs[i], S.baseSbp)) i++;
    if (i === 0) return { ok: false, why: "latest reading is abnormal" };
    const from = rs[i - 1].t; // oldest reading of the normal run
    const hrs = (S.now - from) / H;
    return { ok: hrs >= 4, hours: hrs, why: hrs >= 4 ? "" : "normal for " + hrs.toFixed(1) + " h so far" };
  }

  /* ---------- alerts ---------- */
  function alerts(S) {
    const out = [], rs = (S.readings || []).slice().sort((a, b) => b.t - a.t), last = rs[0] || null;
    const c = crs(S), n = icans(S), d = doseInfo(S), f = feverPattern(S.readings, S.now);
    const A = (level, id, title, text, src) => out.push({ level, id, title, text, src });
    const latest = (k) => { const r = rs.find((x) => x[k] != null); return r ? r[k] : null; };
    const sbp = latest("sbp"), spo2 = latest("spo2"), base = S.baseSbp;

    // Immediate management (SCCRS): SBP < 100 or > 20 mmHg drop from baseline; keep SpO2 above 92%
    if (sbp != null && (sbp < 100 || (base && base - sbp > 20))) A("urgent", "sbp", "Low blood pressure", `Systolic ${sbp} mmHg${base ? ` (baseline ${base})` : ""}. Protocol: notify physician and start NaCl 0.9% IV fluid bolus.`, "SCCRS immediate management");
    if (spo2 != null && spo2 <= 92) A("urgent", "spo2", "Low oxygen saturation", `SpO2 ${spo2}%. Protocol: oxygen to maintain saturation above 92%.`, "SCCRS immediate management");

    if (c.manageAs >= 3) A("urgent", "crs3", "CRS grade 3 or 4 management", "Stop treatment, emergent transfer to ER/ICU, tocilizumab AND steroids, vital signs every 15 minutes.", "SCCRS grade 3 and 4");
    else if (c.manageAs === 2) A("urgent", "crs2", "CRS grade 2 management", S.where === "home" ? "Patient should present urgently to a health-care facility. Stop treatment and do not restart." : "Stop treatment and do not restart. Fluids; tocilizumab first if no response to 2 boluses.", "SCCRS grade 2");
    if (c.unlikely && f.febrileNow) A("action", "fullnocrs", "Fever after a full dose without CRS", "Protocol: if a full dose was given without CRS, later fever should be considered unrelated to CRS. Do a full work-up for infection and other causes.", "SCCRS page 1 note");

    // Home rules (Grade 1)
    if (S.where === "home" && (f.persist || f.recur)) A("urgent", "homefever", "Fever pattern: present to health-care facility", f.persist ? `Fever has lasted ${f.runMin} minutes. Protocol: if fever persists longer than 1 hour or recurs within 6 hours, advise patient to present to a health-care facility and/or ER.` : "Fever has recurred within 6 hours of the last one. Protocol: advise patient to present to a health-care facility and/or ER.", "SCCRS grade 1, at home");
    if (S.where === "home" && sbp != null && base && sbp < base - 10 && sbp < 100) A("urgent", "homebp", "Home BP rule", `Systolic ${sbp} is more than 10 mmHg below baseline ${base} AND below 100. Protocol: contact the team urgently and/or present to ER. (Printed as "< 10 mmHg below baseline"; confirm the intended threshold with the protocol authors.)`, "SCCRS grade 1, at home");
    const sy = S.in.symptoms || {};
    const g2sym = ["orthostatic", "weakness", "dizziness", "dyspnea"].filter((k) => sy[k]);
    if (S.where === "home" && (g2sym.length || sy.confusion)) A("urgent", "homesym", "New symptoms at home", `Reported: ${g2sym.concat(sy.confusion ? ["confusion"] : []).join(", ")}. Protocol: suggestive of Grade 2 CRS; contact the team urgently and/or present to ER.${sy.confusion ? " Confusion may also be ICANS: do an ICE score." : ""}`, "SCCRS grade 1, at home");
    if (sy.confusion && S.where !== "home") A("action", "conf", "Confusion reported", "Check an ICE score (ICANS) and for concurrent CRS.", "SCICANS");

    // ICANS
    if (n.grade >= 3) A("urgent", "icans3", "ICANS grade " + n.grade, "Stop treatment, urgent transfer to higher level of care, contact ICU, steroids, seizure prophylaxis, EEG.", "SCICANS grade 3 and 4");
    else if (n.grade === 2) A("urgent", "icans2", "ICANS grade 2", "Stop treatment, admit, page physician. Steroids first; tocilizumab only for concurrent CRS.", "SCICANS grade 2");
    else if (n.grade === 1) A("action", "icans1", "ICANS grade 1", "Stop treatment, page physician, admit for monitoring. Low threshold for one dose of dexamethasone if ataxia or ICE 7.", "SCICANS grade 1");
    if (n.notifyMRP) A("urgent", "icenotify", "ICE score " + n.total + "/10: notify MRP", n.total < 9 ? "ICE below 9: notify the MRP immediately." : `ICE differs from baseline ${n.baseline}: notify the MRP immediately.`, "SCICANS appendix 1");
    if (n.grade >= 1 && c.grade >= 1) A("action", "both", "Concurrent CRS and ICANS", "Treat both. For ICANS grade 2 give steroids first; tocilizumab is for the CRS (it does not cross the blood brain barrier).", "SCICANS grade 2, SCCRS");

    // Fever: infection work-up
    if (f.febrileNow || (c.feverSeen && S.in.feverMasked)) A("action", "septic", "Fever: consider infection", "Initiate concurrent septic work-up (cultures, chest x-ray, urine) and consider broad-spectrum antibiotics, particularly if neutropenic. Do not wait for the work-up before treating CRS.", "SCCRS page 1 and grade 1");

    // Tocilizumab limits
    if (d.toci24 >= 3 || d.tociTotal >= 4) A("action", "tocilimit", "Tocilizumab limit", `${d.toci24} dose(s) in the last 24 hours, ${d.tociTotal} in total in this record. Protocol limit: 3 doses in 24 hours, 4 doses total. (Check whether the pre-dose tocilizumab counts toward the total under your local protocol.)`, "SCCRS grade 2 dosing");

    // Risk window
    if (d.lastTec && d.inWindow) A("info", "window", "Within 48 hours of a teclistamab dose", `Last dose ${d.hrs.toFixed(1)} h ago (${d.lastTec.label || "dose"}). Protocol: CRS onset is within 48 hours of the preceding bispecific dose.`, "SCCRS page 1 note");
    else if (!d.lastTec) A("info", "nodose", "No teclistamab dose found", "Add the dose date and time below so the 48-hour window and dose count can be shown.", "");

    // Monitoring due
    const due = dueTimes(S, c, n);
    if (due.vitals && due.vitals.overdue) A("action", "vitalsdue", "Vital signs overdue", `Last set ${due.vitals.ago} min ago; protocol interval is ${due.vitals.interval} min for this grade.`, "SCCRS monitoring");
    if (due.ice && due.ice.overdue) A("action", "icedue", "ICE score overdue", `Last ICE ${due.ice.ago} h ago; repeat every 8 hours while ICANS symptoms are present.`, "SCICANS");
    if (S.in.ice == null || iceTotal(S.in.ice) == null) { /* no ICE entered: not an alert */ }

    // Discharge criterion for grade 1 at facility
    if (S.where === "facility" && c.grade === 1 && S.in.crsResolved) {
      const st = stable4h(S);
      if (st.ok) A("info", "discharge", "Meets the 4-hour stable criterion", "Afebrile with normal vital signs (as defined here) for at least 4 hours. Protocol: contact the MRP to decide whether the patient may go home with ongoing home monitoring. Heart rate and respiratory rate are left to your judgment.", "SCCRS grade 1");
    }
    const rank = { urgent: 0, action: 1, info: 2 };
    return out.sort((a, b) => rank[a.level] - rank[b.level]);
  }

  /* ---------- monitoring due times ---------- */
  function dueTimes(S, c, n) {
    const out = {}, rs = (S.readings || []).slice().sort((a, b) => b.t - a.t), last = rs[0];
    let interval = null;
    if (c.manageAs >= 3) interval = 15; else if (c.effective >= 1 || c.provisional >= 1) interval = 60; else if (n.grade >= 1) interval = 240;
    if (interval && last) {
      const ago = Math.round((S.now - last.t) / MIN);
      out.vitals = { interval, ago, overdue: ago > interval, dueIn: interval - ago };
    } else if (interval) out.vitals = { interval, ago: null, overdue: true, dueIn: 0 };
    const symptomatic = n.grade >= 1 || (n.done && n.total < 10);
    if (symptomatic) {
      if (S.in.iceT) { const ago = (S.now - S.in.iceT) / H; out.ice = { interval: 8, ago: Math.round(ago * 10) / 10, overdue: ago > 8, dueInMin: Math.round((8 - ago) * 60) }; }
      else out.ice = { interval: 8, ago: null, overdue: true, dueInMin: 0 };
    }
    return out;
  }

  /* ---------- merge chart readings with entered ones (same minute: entered wins) ---------- */
  function mergeReadings(chart, entered) {
    const map = new Map();
    (chart || []).forEach((r) => map.set(Math.floor(r.t / MIN), Object.assign({ src: "chart" }, r)));
    (entered || []).forEach((r) => {
      const k = Math.floor(r.t / MIN), old = map.get(k) || {};
      const merged = Object.assign({}, old, { src: "entered" }); ["temp", "sbp", "hr", "rr", "spo2"].forEach((f) => { if (r[f] != null) merged[f] = r[f]; });
      merged.t = r.t; map.set(k, merged);
    });
    return Array.from(map.values()).sort((a, b) => b.t - a.t);
  }

  /* ---------- where the patient should be ----------
     Pulled together from the protocols' "present to facility", "admit", "higher level of care" and "ER/ICU" wording.
     INTERPRETATION: the protocols name "health-care facility", "admit", "higher level of care" and "ER/ICU"; they do not name a ward.
     key: home | facility (no escalation, at a facility) | ward | er | icu. */
  function placement(S, c, n) {
    const home = S.where === "home", f = feverPattern(S.readings, S.now), reasons = [], sy = S.in.symptoms || {};
    const rs = (S.readings || []).slice().sort((a, b) => b.t - a.t), latestSbp = (rs.find((r) => r.sbp != null) || {}).sbp, base = S.baseSbp;
    let level = 0; // 0 none, 1 CRS grade 1, 2 admit or present, 3 ER/ICU
    const up = (l, why) => { level = Math.max(level, l); if (why && !reasons.includes(why)) reasons.push(why); };
    if (c.manageAs >= 3) up(3, c.grade >= 3 ? "CRS grade " + c.grade : "CRS grade 2 with comorbidities (managed as grade 3)");
    if (n.grade >= 3) up(3, "ICANS grade " + n.grade);
    if (c.manageAs === 2) up(2, c.grade === 1 ? "persistent CRS grade 1 (treated as grade 2)" : "CRS grade 2");
    if (n.grade >= 1) up(2, "ICANS grade " + n.grade);
    if (c.manageAs === 1) up(1, "CRS grade 1");
    if (home && (f.persist || f.recur)) up(2, f.persist ? "fever for " + f.runMin + " min" : "fever recurred within 6 h");
    if (home && latestSbp != null && base && latestSbp < base - 10 && latestSbp < 100) up(2, "SBP " + latestSbp + " (below baseline and under 100)");
    if (home && ["orthostatic", "weakness", "dizziness", "dyspnea", "confusion"].some((k) => sy[k])) up(2, "new symptoms at home");
    const considerICU = !!(level < 3 && ((n.grade === 2 && c.grade >= 2) || (c.manageAs === 2 && S.in.hypo === "fluid" && S.in.o2 === "low")));
    let key, title, text;
    if (level === 3) { key = home ? "er" : "icu"; title = home ? "ER now, then ICU" : "ICU / higher level of care now"; text = home ? "Emergency transport to the ER now; protocol requires emergent transfer to a higher level of care (ER/ICU)." : "Emergent transfer to ICU / higher level of care (ER/ICU required by protocol). Contact ICU."; }
    else if (level === 2) { key = home ? "er" : "ward"; title = home ? "Come to the ER / health-care facility now" : "Ward: admitted, monitored bed"; text = home ? "Protocol: present urgently to a health-care facility (ER) for evaluation, then admission for monitoring." : "Stay admitted on a monitored bed with at least hourly vital signs and neuro checks."; }
    else if (level === 1) { key = home ? "home" : "ward"; title = home ? "Home with hourly checks" : "Facility: monitored bed, hourly vital signs"; text = home ? "May stay at home with hourly temperature checks. Come in (ER / health-care facility) if fever persists over 1 hour or recurs within 6 hours, new orthostatic symptoms, weakness, confusion, dizziness or shortness of breath, or SBP drops." : "Stay in a monitored bed with hourly vital signs until symptoms resolve."; }
    else { key = home ? "home" : "facility"; title = home ? "Home (Hospital at Home)" : "Facility: no escalation"; text = "No CRS or ICANS criteria met by the data and entries so far. Keep monitoring; re-grade after every new reading."; }
    return { key, title, text, reasons, considerICU, level };
  }

  const API = { iceTotal, ICE_MAX, crs, icans, feverPattern, doseInfo, tociDose, stable4h, normalReading, alerts, dueTimes, mergeReadings, placement, FEVER };
  if (typeof window !== "undefined") window.BSRules = API;
  if (typeof module !== "undefined") module.exports = API;
})();
