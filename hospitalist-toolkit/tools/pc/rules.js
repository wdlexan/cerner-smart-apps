/* Peritoneal carcinomatosis tab: pure rules (no DOM, no FHIR). UNVERIFIED draft written by Claude - verify before clinical use.
   node hospitalist-toolkit/tests/test_pc.js checks them. */
(function () {
  // Sugarbaker PCI: 13 regions, lesion size 0-3 each, total 0-39.
  const REGIONS = [
    { n: 0, name: "Central" }, { n: 1, name: "Right upper" }, { n: 2, name: "Epigastrium" }, { n: 3, name: "Left upper" },
    { n: 4, name: "Left flank" }, { n: 5, name: "Left lower" }, { n: 6, name: "Pelvis" }, { n: 7, name: "Right lower" },
    { n: 8, name: "Right flank" }, { n: 9, name: "Upper jejunum" }, { n: 10, name: "Lower jejunum" }, { n: 11, name: "Upper ileum" }, { n: 12, name: "Lower ileum" }];

  function pciTotal(ls) {
    return REGIONS.reduce((s, r) => { const v = Math.round(Number(ls[r.n]) || 0); return s + Math.max(0, Math.min(3, v)); }, 0);
  }

  /* Thresholds are general (PSOGI/consensus and trial selection), not hard rules; the peritoneal surgeon decides. */
  function pciInterp(total, primary) {
    const sb = "Small bowel regions (9–12) at LS 2–3 often make complete cytoreduction impossible regardless of total.";
    if (primary === "colorectal") {
      if (total <= 10) return { level: "green", text: `PCI ${total}: limited disease. Good candidate to discuss CRS (± HIPEC) at a peritoneal surface malignancy centre if fit and no unresectable extra-abdominal disease.`, sb };
      if (total <= 20) return { level: "amber", text: `PCI ${total}: CRS still possible in selected fit patients (benefit falls as PCI rises; most centres use ≤15–20). Refer to discuss.`, sb };
      return { level: "red", text: `PCI ${total}: above the usual colorectal cut-off (>20). CRS rarely offered; systemic therapy is the main treatment.`, sb };
    }
    if (primary === "gastric") {
      if (total <= 6) return { level: "amber", text: `PCI ${total}: low-volume gastric disease. CRS/HIPEC only in highly selected patients after a good chemo response, ideally on a trial.`, sb };
      return { level: "red", text: `PCI ${total}: above the usual gastric cut-off (~6–7). Systemic therapy; CRS not generally offered.`, sb };
    }
    if (primary === "ovarian") {
      return { level: total > 20 ? "amber" : "green", text: `PCI ${total}: ovarian disease is treated with curative-intent debulking aiming for no residual disease; there is no fixed PCI cut-off. ${total > 20 ? "High PCI lowers the chance of complete resection → neoadjuvant chemo then interval debulking is often chosen." : "Gyne-oncology to decide primary vs interval debulking."}`, sb };
    }
    if (primary === "pmp") return { level: "green", text: `PCI ${total}: in appendiceal/pseudomyxoma disease a high PCI does not exclude CRS + HIPEC – refer to an expert centre.`, sb };
    return { level: "info", text: `PCI ${total}: interpret with the treating surgical oncologist; cut-offs depend on the primary.`, sb };
  }

  // MBO checklist: +1 favours procedure, -1 against.
  function mboAdvice(weights) {
    const pos = weights.filter((w) => w > 0).length, neg = weights.filter((w) => w < 0).length;
    if (!pos && !neg) return { level: "info", text: "Tick the boxes that apply." };
    if (neg >= 2) return { level: "red", text: `${neg} factor(s) against a procedure: surgery is unlikely to help. Focus on medical management, venting gastrostomy if vomiting persists, and goals of care. Still let surgery know.` };
    if (pos >= 3 && neg === 0) return { level: "green", text: "Favourable: ask general surgery (or GI for a stent if single colonic/gastric outlet level) to see the patient early." };
    return { level: "amber", text: `Mixed picture (${pos} for, ${neg} against). Discuss with surgery and oncology; start medical management meanwhile.` };
  }

  // Rough prognosis band from patient factors (not validated as a score - a prompt for goals-of-care).
  function prognosis(p) {
    const reasons = [];
    let bad = 0;
    if (p.ecog >= 3) { bad += 2; reasons.push("ECOG 3–4"); }
    if (p.alb != null && p.alb !== "" && +p.alb < 30) { bad += 1; reasons.push("albumin <30 g/L"); }
    if (p.mbo) { bad += 1; reasons.push("bowel obstruction"); }
    if (p.asc) { bad += 1; reasons.push("recurrent ascites"); }
    if (p.lines) { bad += 1; reasons.push("few or no treatment options left"); }
    if (p.pps && +p.pps <= 30) { bad += 2; reasons.push("PPS ≤30%"); } else if (p.pps && +p.pps <= 50) { bad += 1; reasons.push("PPS 40–50%"); }
    let band;
    if (bad >= 4) band = { level: "red", text: "Likely weeks to a few months. Prioritise goals of care, palliative care and getting home if that is the wish." };
    else if (bad >= 2) band = { level: "amber", text: "Likely months. Goals-of-care conversation this admission; involve palliative care; ask oncology whether further treatment is realistic." };
    else band = { level: "green", text: "Fewer adverse features: further oncologic treatment may be realistic – ask oncology. Still document goals of care." };
    return Object.assign(band, { reasons, score: bad });
  }

  // Primary from problem list text.
  const PRIMARY_RE = [
    ["pmp", /pseudomyxoma|appendi(x|ceal)\s*(cancer|carcinoma|neoplasm|mucinous|adenocarcinoma)|C18\.1/i],
    ["colorectal", /colon|colorectal|rect(al|um)|sigmoid|cec(al|um)|C1[89]|C20/i],
    ["gastric", /gastric|stomach|gastro-?esophageal|\bGEJ\b|linitis|C16/i],
    ["ovarian", /ovar|fallopian|tubal carcinoma|primary peritoneal|C56|C57\.0/i],
    ["other", /pancrea|mesothelioma|breast|cholangio|C25|C45\.1|C50/i]];
  function detectPrimary(texts) {
    const hits = [];
    PRIMARY_RE.forEach(([k, re]) => texts.forEach((t) => { if (re.test(t) && /cancer|carcinoma|neoplasm|malignan|tumou?r|adenocarcinoma|metasta|pseudomyxoma|C\d\d/i.test(t)) hits.push({ k, t }); }));
    return hits;
  }

  /* f = facts from chart.js parse(). Returns flags: {level, text, tab} */
  function flags(f) {
    const out = [], L = (id) => f.latest[id];
    const p = f.prob || {};
    const mbo = !!(p.mbo && p.mbo.length), asc = !!(p.ascites && p.ascites.length);
    if (!(p.pc && p.pc.length) && !(f.reports || []).length) out.push({ level: "info", text: "No peritoneal carcinomatosis/metastases on the problem list or recent reports found – check the CT report and update the problem list if present." });
    const k = L("k"), mg = L("mg"), ca = f.corrCa, alb = L("alb"), cr = L("cr"), lac = L("lactate"), wbc = L("wbc");
    if (k && k.v < 3.5) out.push({ level: mbo ? "red" : "amber", text: `K ${k.v} mmol/L – low K worsens ileus/obstruction; replace (IV if NPO).`, tab: "mbo" });
    if (mg && mg.v < 0.7) out.push({ level: "amber", text: `Mg ${mg.v} mmol/L – replace; low Mg also keeps K low.` });
    if (ca != null && ca > 2.6) out.push({ level: ca > 3.0 ? "red" : "amber", text: `Corrected Ca ${ca.toFixed(2)} mmol/L – hypercalcemia causes ileus, nausea and confusion.` });
    if (alb && alb.v < 30) out.push({ level: "amber", text: `Albumin ${alb.v} g/L – poor nutrition/prognosis marker; raises surgical risk. Dietitian.` });
    if (f.crRise) out.push({ level: "amber", text: `Creatinine up ${f.crRise.pct}% (${f.crRise.from} → ${f.crRise.to} µmol/L) – dehydration from vomiting/third spacing, or ureteric obstruction: check urine output and renal US.` });
    if (mbo && lac && lac.v > 2) out.push({ level: "red", text: `Lactate ${lac.v} with bowel obstruction – think ischemia/strangulation/perforation: urgent surgery review.`, tab: "mbo" });
    if (mbo && wbc && wbc.v > 15) out.push({ level: "amber", text: `WBC ${wbc.v} with obstruction – look for perforation, abscess, aspiration.` });
    const c = f.cls || {};
    if (mbo && c.metoclop.length) out.push({ level: c.anticholin.length ? "red" : "amber", text: `Metoclopramide ordered with bowel obstruction (${c.metoclop[0]}) – only for partial obstruction without colic; avoid in complete MBO${c.anticholin.length ? ", and it is opposed by the anticholinergic also ordered (" + c.anticholin[0] + ")" : ""}.`, tab: "mbo" });
    if (mbo && c.stimLax.length) out.push({ level: "amber", text: `Stimulant laxative ordered with obstruction (${c.stimLax[0]}) – avoid if complete; softener/osmotic only in partial MBO.`, tab: "mbo" });
    if (c.dex.length && f.dexDays != null && f.dexDays > 5 && mbo) out.push({ level: "amber", text: `Dexamethasone for ~${f.dexDays} days – if no MBO response by day 5, stop; if helping, taper to lowest dose. Check glucose, PPI.`, tab: "mbo" });
    if (mbo && !c.octreo.length && !c.anticholin.length) out.push({ level: "info", text: "Bowel obstruction with no octreotide or antisecretory anticholinergic ordered – consider if vomiting/NG output is high.", tab: "mbo" });
    if (mbo && !c.antiemetic.length) out.push({ level: "info", text: "No antiemetic ordered – haloperidol SC first line in complete MBO.", tab: "mbo" });
    if (c.opioid.length && !mbo && !c.anyLax.length) out.push({ level: "amber", text: "On opioids with no bowel regimen – opioid constipation can mimic or worsen obstruction." });
    if (c.bev.length && mbo) out.push({ level: "red", text: `Bevacizumab in the orders/recent meds (${c.bev[0]}) with obstruction – perforation risk; tell oncology and surgery.` });
    if (asc) out.push({ level: "info", text: "Ascites on the problem list – see Ascites tab (SAAG, cytology, indwelling catheter if frequent taps).", tab: "ascites" });
    if (!out.some((x) => x.level !== "info")) out.push({ level: "green", text: "No urgent lab or medication rule fired." });
    return out;
  }

  /* Which tumour markers to send, by primary (or unknown primary), and how to read what is there.
     have = { cea: latest value, ca125: …, … } in the lab's units. Cut-offs are typical upper limits; labs differ. */
  const MARKER_SETS = {
    colorectal: ["cea", "ca199"], gastric: ["cea", "ca199", "ca724"], ovarian: ["ca125", "cea", "ca199"],
    pmp: ["cea", "ca199", "ca125"], other: ["cea", "ca199", "ca125"],
    unknown: ["cea", "ca199", "ca125"] };
  const MARKER_NAME = { cea: "CEA", ca125: "CA-125", ca199: "CA 19-9", ca724: "CA 72-4", he4: "HE4", ca153: "CA 15-3", afp: "AFP", hcg: "β-hCG" };
  const ULN = { cea: 5, ca125: 35, ca199: 37, ca724: 6.9, ca153: 30, afp: 10 };
  function markerAdvice(primary, sex, age, have) {
    const set = MARKER_SETS[primary || "unknown"].slice();
    if (!primary || primary === "other") {
      if (sex === "female") set.push("he4", "ca153");
      if (age != null && age < 50) set.push("afp", "hcg");
    }
    if (primary === "ovarian") set.push("he4");
    const send = set.filter((k) => have[k] == null), notes = [];
    if (have.cea != null && have.ca125 != null && have.cea > 0) {
      const r = +(have.ca125 / have.cea).toFixed(1);
      notes.push({ level: r > 25 ? "info" : "amber", text: `CA-125 : CEA ratio ${r} – ${r > 25 ? "over 25 favours an ovarian/Müllerian primary" : "25 or less favours a GI primary (colorectal, gastric, appendiceal) – make sure the GI tract has been looked at"}.` });
    }
    if (have.ca125 != null && have.ca125 > 35 && primary && primary !== "ovarian") notes.push({ level: "info", text: "CA-125 is raised by any ascites or peritoneal irritation (and by heart failure, cirrhosis, pleural effusion) – not specific for ovarian cancer here." });
    if (have.ca199 != null && have.bili != null && have.bili > 50) notes.push({ level: "info", text: "CA 19-9 is falsely high with biliary obstruction/cholangitis – recheck once bilirubin falls." });
    if (have.cea != null && have.cea > 5 && have.cea <= 10) notes.push({ level: "info", text: "Mildly raised CEA can come from smoking, IBD, liver disease, pancreatitis or hypothyroidism." });
    Object.keys(ULN).forEach((k) => { if (have[k] != null && have[k] > ULN[k] * 10) notes.push({ level: "amber", text: `${MARKER_NAME[k]} ${have[k]} is over 10× the usual upper limit – supports bulky malignancy, but tissue is still needed for diagnosis.` }); });
    return { set, send, notes };
  }

  function corrCa(ca, alb) { if (ca == null || alb == null) return null; return +(ca + 0.02 * (40 - alb)).toFixed(2); }

  function note(o) {
    const L = [];
    L.push("Peritoneal carcinomatosis" + (o.primaryLabel ? " – primary: " + o.primaryLabel : " – primary not yet established"));
    if (o.probs && o.probs.length) L.push("Relevant problems: " + o.probs.join("; "));
    if (o.labs) L.push("Labs: " + o.labs);
    if (o.markers) L.push("Tumour markers: " + o.markers);
    if (o.pci != null && o.pci > 0) L.push(`PCI (entered): ${o.pci}/39. ${o.pciText || ""}`);
    if (o.mbo) {
      L.push("");
      L.push("Malignant bowel obstruction:");
      L.push("- NPO/sips; NG to drainage if high-volume vomiting; IV/SC fluids ~1–1.5 L/day; replace K/Mg/PO4.");
      L.push("- Octreotide SC and/or hyoscine butylbromide for secretions/colic; dexamethasone trial 5 days then stop if no response.");
      L.push("- Haloperidol SC for nausea (avoid metoclopramide if complete/colicky). Opioid SC for pain.");
      if (o.mboText) L.push("- Surgery/stent: " + o.mboText);
    }
    if (o.asc) { L.push(""); L.push("Ascites: diagnostic tap (cell count, SAAG, protein, culture, cytology); therapeutic tap PRN; consider tunnelled peritoneal catheter if recurring within 1–2 weeks."); }
    if (o.flags && o.flags.length) { L.push(""); L.push("Issues flagged:"); o.flags.forEach((x) => L.push("- " + x)); }
    if (o.prog) { L.push(""); L.push("Prognosis/goals: " + o.prog); }
    L.push("");
    L.push("Plan: tissue diagnosis/biomarkers if not done; medical oncology" + (o.primary === "ovarian" ? " / gyne-oncology" : "") + " input; palliative care; goals-of-care discussion documented.");
    L.push("Decision: " + (o.decision || "____________________"));
    return L.join("\n");
  }

  const api = { REGIONS, pciTotal, pciInterp, mboAdvice, prognosis, detectPrimary, flags, corrCa, note, markerAdvice, MARKER_NAME, ULN };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else window.PCRules = api;
})();
