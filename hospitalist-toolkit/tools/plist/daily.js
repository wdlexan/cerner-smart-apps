/* Daily list update: what one patient's chart says for Wayne's VGH list columns, plus "check today" items.
   values(f, raw, allergies, opts) -> { age, allergy, gfr, vtep, iv, foley, lab, check: [..] }
     f = DcRules.parse(raw) (tools/discharge/rules.js), raw = DcChart.gather(...).raw, allergies = AllergyIntolerance resources.
   The list file is only FILLED where a cell is empty (Wayne's typed values always win); "check today" is the app's own column,
   rebuilt every run. Read-only: nothing is written to Cerner. UNVERIFIED rules written by Claude: the physician decides. */
(function (root) {
  const H = 36e5, DAY = 24 * H;
  const label = (cc) => (cc && (cc.text || (cc.coding || []).map((c) => c.display).find(Boolean))) || "";
  const codes = (cc) => ((cc && cc.coding) || []).map((c) => c.code).filter(Boolean);
  const tOf = (o) => { const v = o.effectiveDateTime || (o.effectivePeriod && o.effectivePeriod.start) || o.issued; return v ? new Date(v).getTime() : null; };
  const r1 = (v) => (Math.abs(v) >= 100 ? Math.round(v) : Math.round(v * 10) / 10);
  const last = (a) => (a && a.length ? a[a.length - 1] : null);

  // CKD-EPI 2021 (race-free), creatinine in umol/L
  function egfr(cr, age, sex) {
    if (!cr || !age || !/^(male|female)$/.test(sex || "")) return null;
    const s = cr / 88.4, k = sex === "female" ? 0.7 : 0.9, a = sex === "female" ? -0.241 : -0.302;
    return Math.round(142 * Math.pow(Math.min(s / k, 1), a) * Math.pow(Math.max(s / k, 1), -1.2) * Math.pow(0.9938, age) * (sex === "female" ? 1.012 : 1));
  }

  const VTE = /enoxaparin|dalteparin|tinzaparin|nadroparin|fondaparinux|heparin(?!.*(flush|lock))|apixaban|rivaroxaban|edoxaban|dabigatran|warfarin/i;
  const ABX = /amoxicillin|ampicillin|piperacillin|tazobactam|cef[a-z]+|ceph[a-z]+|meropenem|ertapenem|imipenem|vancomycin|linezolid|daptomycin|doxycycline|minocycline|azithromycin|clarithromycin|erythromycin|levofloxacin|moxifloxacin|ciprofloxacin|nitrofurantoin|trimethoprim|sulfamethoxazole|septra|clindamycin|metronidazole|gentamicin|tobramycin|amikacin|penicillin|cloxacillin|cefazolin|rifampin|fosfomycin|tigecycline/i;
  const FLUID = /sodium chloride 0\.9|normal saline|\bNS\b|ringer|plasma-?lyte|dextrose|D5W|D5|2\/3[- ]?1\/3|0\.45%|half[- ]normal/i;
  const IVROUTE = /\b(iv|intravenous)\b/i;

  // vital signs in the last 24 h that need a look
  const VIT = { sbp: ["8480-6"], hr: ["8867-4"], spo2: ["59408-5", "2708-6"], temp: ["8310-5", "8331-1"], rr: ["9279-1"] };
  function vitals24(raw, now) {
    const out = { sbp: [], hr: [], spo2: [], temp: [], rr: [] };
    (raw.obs || []).forEach((o) => {
      const t = tOf(o); if (!t || now - t > DAY) return;
      const push = (k, v) => { if (v != null && !isNaN(v)) out[k].push(+v); };
      (o.component || []).forEach((cp) => { if (codes(cp.code).includes("8480-6") || /systolic/i.test(label(cp.code))) push("sbp", cp.valueQuantity && cp.valueQuantity.value); });
      const cs = codes(o.code), n = label(o.code), v = o.valueQuantity && o.valueQuantity.value;
      Object.keys(VIT).forEach((k) => { if (cs.some((c) => VIT[k].includes(c))) push(k, v); });
      if (!cs.length && v != null) { if (/heart rate|pulse/i.test(n)) push("hr", v); else if (/spo2|oxygen sat/i.test(n)) push("spo2", v); else if (/temp/i.test(n)) push("temp", v); else if (/resp/i.test(n)) push("rr", v); else if (/systolic/i.test(n)) push("sbp", v); }
    });
    return out;
  }

  // lab results flagged abnormal by the lab in the last 24 h
  function abnormalLabs24(raw, now) {
    const seen = new Set(), out = [];
    (raw.obs || []).filter((o) => /final|amended|corrected|preliminary/.test(o.status || "") && (o.category || []).some((c) => codes(c).includes("laboratory") || /lab/i.test(label(c))))
      .sort((a, b) => (tOf(b) || 0) - (tOf(a) || 0)).forEach((o) => {
        const t = tOf(o); if (!t || now - t > DAY) return;
        const flag = (o.interpretation || []).flatMap(codes).find((c) => /^(H|L|HH|LL|A|AA|HU|LU|>|<)$/.test(c)); if (!flag) return;
        const n = label(o.code) || "result"; if (seen.has(n.toLowerCase())) return; seen.add(n.toLowerCase());
        const v = o.valueQuantity ? r1(o.valueQuantity.value) : o.valueString || "";
        out.push({ name: n, v, flag, crit: /HH|LL|AA/.test(flag) });
      });
    return out.sort((a, b) => (b.crit ? 1 : 0) - (a.crit ? 1 : 0));
  }

  function values(f, raw, allergies, opts) {
    opts = opts || {}; raw = raw || {}; const now = f.now || Date.now(), out = { check: [] };
    const pt = raw.patient || f.patient || {};
    const age = pt.birthDate ? Math.floor((now - new Date(pt.birthDate)) / (365.25 * DAY)) : null, sex = pt.gender || "";
    if (age != null) out.age = age;
    // allergy y/n: only say "n" when the chart records no known allergies
    const al = (allergies || []).filter((a) => !/inactive|resolved|entered-in-error/.test(JSON.stringify(a.clinicalStatus || "") + JSON.stringify(a.verificationStatus || "")));
    const nka = al.filter((a) => /no known|nka|nkda|716186003|409137002|428607008/i.test(label(a.code) + " " + codes(a.code).join(" ")));
    if (al.length > nka.length) out.allergy = "y"; else if (nka.length) out.allergy = "n";
    // gfr from the latest creatinine
    const cr = last(f.labs && f.labs.cr), labG = last(f.labs && f.labs.egfr);
    const g = labG && (!cr || labG.t >= cr.t - H) ? Math.round(labG.v) : cr ? egfr(cr.v, age, sex) : null; // the lab's own eGFR when it goes with the latest creatinine
    if (g != null) out.gfr = g;
    // current medicines
    const cur = (f.meds && f.meds.current) || [], txt = cur.map((m) => m.text);
    if (cur.length) out.vtep = txt.some((m) => VTE.test(m)) ? "y" : "n";
    const fl = txt.filter((m) => FLUID.test(m) && (IVROUTE.test(m) || /mL\/h|ml\/hr|mL\/hr/i.test(m)));
    if (fl.length) out.iv = fl.map((m) => { const rate = (m.match(/(\d+(?:\.\d+)?)\s*mL\s*\/\s*h(?:r|our)?/i) || [])[1]; const nm = (m.match(FLUID) || [""])[0]; return (/sodium chloride 0\.9|normal saline/i.test(nm) ? "NS" : nm) + (rate ? " " + rate + "/h" : ""); }).join(", ");
    // foley: only "y" when an order or a recent note says so (never a guessed "n")
    const recentNotes = (f.notes || []).filter((n) => !n.t || now - n.t < 2 * DAY).map((n) => n.text).join("\n");
    if ((f.orders || []).some((o) => /foley|urinary catheter|indwelling catheter/i.test(o.name)) || /\b(foley|indwelling (urinary )?catheter)\b(?![^.\n]{0,30}\b(removed|out|d\/c|discontinued)\b)/i.test(recentNotes)) out.foley = "y";
    // pending
    let pend = [];
    try { pend = (opts.pending ? opts.pending(f) : []).map((p) => p.what).filter(Boolean); } catch (e) {}
    if (pend.length) out.lab = pend.slice(0, 5).join("; ") + (pend.length > 5 ? "; +" + (pend.length - 5) + " more" : "");

    // days in hospital (whole days since the admission started), for the stay bar
    const enc = (raw.encounters || [])[0], st0 = enc && enc.period && enc.period.start && new Date(enc.period.start).getTime();
    if (st0 && !(enc.period.end && new Date(enc.period.end).getTime() < now)) out.los = Math.max(0, Math.floor((now - st0) / DAY));

    /* ---------- check today ---------- */
    const C = out.check;
    abnormalLabs24(raw, now).slice(0, 4).forEach((l) => C.push(`${l.crit ? "CRITICAL " : "new "}${l.name} ${l.v}${l.flag && !/^A/.test(l.flag) ? " " + l.flag : ""}`));
    const vt = vitals24(raw, now), lo = (a) => (a.length ? Math.min(...a) : null), hi = (a) => (a.length ? Math.max(...a) : null);
    const vb = [];
    if (lo(vt.sbp) != null && lo(vt.sbp) < 90) vb.push(`SBP ${Math.round(lo(vt.sbp))}`); if (hi(vt.sbp) != null && hi(vt.sbp) >= 180) vb.push(`SBP ${Math.round(hi(vt.sbp))}`);
    if (hi(vt.hr) != null && hi(vt.hr) > 120) vb.push(`HR ${Math.round(hi(vt.hr))}`); if (lo(vt.hr) != null && lo(vt.hr) < 45) vb.push(`HR ${Math.round(lo(vt.hr))}`);
    if (lo(vt.spo2) != null && lo(vt.spo2) < 90) vb.push(`SpO2 ${Math.round(lo(vt.spo2))}%`); if (hi(vt.temp) != null && hi(vt.temp) >= 38.3) vb.push(`T ${r1(hi(vt.temp))}`);
    if (hi(vt.rr) != null && hi(vt.rr) > 24) vb.push(`RR ${Math.round(hi(vt.rr))}`);
    if (vb.length) C.push("vitals 24 h: " + vb.join(", "));
    // antibiotics: day count, IV->PO, stop date
    cur.filter((m) => ABX.test(m.text)).forEach((m) => {
      const day = m.t ? Math.floor((now - m.t) / DAY) + 1 : null, nm = (m.text.match(ABX) || [m.text])[0].toLowerCase(), iv = IVROUTE.test(m.text);
      C.push(`${nm}${iv ? " IV" : ""}${day ? " day " + day : ""}${iv && day >= 3 ? ": IV to PO?" : ""}${day >= 7 ? ": stop date?" : ""}`);
    });
    // electrolytes off and not rechecked in 24 h
    const due = [];
    [["na", "Na", 130, 150], ["k", "K", 3.3, 5.5], ["mg", "Mg", 0.6, 1.3], ["phos", "PO4", 0.6, 2.0]].forEach(([id, nm, low, high]) => {
      const l = last(f.labs && f.labs[id]); if (!l) return; if ((l.v < low || l.v > high) && now - l.t > DAY) due.push(`${nm} ${r1(l.v)} (${Math.round((now - l.t) / H)} h ago)`);
    });
    if (due.length) C.push("recheck " + due.join(", "));
    if (g != null && g < 30 && cur.some((m) => /enoxaparin|dabigatran|rivaroxaban|apixaban|edoxaban|metformin|gabapentin|pregabalin|nitrofurantoin/i.test(m.text))) C.push(`GFR ${g}: renal dosing check`);
    if (pend.length) C.push("pending: " + pend.slice(0, 3).join(", "));
    if (opts.dcc && opts.dcc.verdict === "fit") C.push("Discharge Clinic candidate? (" + opts.dcc.fits.slice(0, 2).map((x) => x.name.split(" (")[0]).join(", ") + ")");
    return out;
  }

  const api = { values, egfr, vitals24, abnormalLabs24 };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.PListDaily = api;
})(typeof window !== "undefined" ? window : globalThis);
