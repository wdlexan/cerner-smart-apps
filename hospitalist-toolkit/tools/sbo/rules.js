/* Small bowel obstruction (SBO) rules. Pure functions, no chart access: tested by tests/test_sbo.js.
   UNVERIFIED draft written by Claude from the 2017 WSES Bologna guideline for adhesive SBO (ten Broek, World J Emerg Surg 2018),
   ACR Appropriateness Criteria "Suspected small-bowel obstruction" (2019), the water-soluble contrast meta-analyses (Ceresoli 2016),
   EAES / ASCRS guidance on large bowel obstruction and colonic pseudo-obstruction, and MASCC malignant bowel obstruction guidance.
   Thresholds are common teaching values, not a validated score. Check with general surgery and local policy. */
(function () {
  const n = (x) => x != null && x !== "" && isFinite(+x);

  /* ---------- CT / X-ray report scan ---------- */
  const CT_SIGNS = [
    // [id, regex, label, level]  level: urgent = ischemia/perforation/closed loop, action = needs surgery input, info = description
    ["freeAir", /free (intraperitoneal |intra-?abdominal )?(air|gas)|pneumoperitoneum|extraluminal (air|gas)/, "Free air / pneumoperitoneum (perforation)", "urgent"],
    ["extrav", /(oral )?contrast extravasation|extraluminal contrast|contrast leak/, "Extraluminal contrast (perforation / leak)", "urgent"],
    ["closedLoop", /closed[- ]loop|two adjacent transition points|u[- ]shaped|c[- ]shaped loop/, "Closed-loop obstruction", "urgent"],
    ["whirl", /whirl(pool)? sign|swirl(ing)? of (the )?mesenter|mesenteric (twist|torsion|swirl)|twisting of the mesentery/, "Whirl sign (mesenteric twist / volvulus)", "urgent"],
    ["reducedEnh", /(reduced|decreased|diminished|poor|absent|lack of|no) (bowel )?(wall )?enhancement|hypo-?enhanc|non-?enhanc/, "Reduced or absent bowel wall enhancement (ischemia)", "urgent"],
    ["pneumatosis", /pneumatosis/, "Pneumatosis intestinalis", "urgent"],
    ["pvGas", /portal (venous )?(gas|air)|mesenteric venous gas/, "Portal / mesenteric venous gas", "urgent"],
    ["hyperdense", /hyper-?(dense|attenuat\w*) (bowel )?wall|intramural (hemorrhage|haemorrhage|hematoma)/, "Hyperdense wall / intramural hemorrhage (on non-contrast CT)", "urgent"],
    ["ischemia", /ischemi|ischaemi|strangulat|infarct|necro|gangren/, "Ischemia / strangulation mentioned", "urgent"],
    ["mesEdema", /mesenteric (edema|oedema|haziness|stranding|fluid|congestion)|engorged mesenteric vessels/, "Mesenteric edema / haziness", "action"],
    ["freeFluid", /free fluid|ascites|intraperitoneal fluid/, "Free fluid", "action"],
    ["wallThick", /(bowel )?wall thickening|thickened (small )?bowel( wall)?|target sign|halo sign/, "Bowel wall thickening", "action"],
    ["beak", /beak sign|bird'?s? beak/, "Beak sign (twist / closed loop)", "action"],
    ["hernia", /hernia/, "Hernia", "action"],
    ["volvulus", /volvulus/, "Volvulus", "urgent"],
    ["intuss", /intussuscept/, "Intussusception (look for a lead point)", "action"],
    ["mass", /mass|tumou?r|neoplas|malignan|carcinoma|lead point/, "Mass / tumour", "action"],
    ["carcinomatosis", /carcinomatosis|peritoneal (implants|metasta|nodul|deposit)|omental cak/, "Peritoneal carcinomatosis", "action"],
    ["gallstone", /gallstone ileus|pneumobilia.*(stone|calculus)|ectopic (gallstone|calculus)|rigler/, "Gallstone ileus (pneumobilia + ectopic stone)", "action"],
    ["pneumobilia", /pneumobilia|aerobilia|(air|gas) (with)?in the (biliary tree|bile ducts?|gallbladder)|biliary (air|gas)/, "Pneumobilia: with SBO think gallstone ileus (look for an ectopic stone; benign after sphincterotomy, biliary stent or biliary-enteric anastomosis)", "action"],
    ["transition", /transition (point|zone)|point of transition|abrupt (change in )?calib/, "Transition point (mechanical obstruction)", "info"],
    ["highGrade", /high[- ]grade|complete (small bowel )?obstruction|decompressed (distal|colon)|collapsed (distal|colon)/, "High-grade / complete obstruction", "action"],
    ["partial", /partial|low[- ]grade|incomplete obstruction|contrast (passes|passing|reaches|seen) (into|in|to) the colon/, "Partial / low-grade obstruction", "info"],
    ["feces", /small bowel fec(es|al)|fecali[sz]ation|feces sign|faeces sign/, "Small bowel feces sign (favours adhesive, slower course)", "info"],
    ["sbo", /small bowel obstruction|\bsbo\b|dilated[^.;]{0,30}small bowel|small bowel dilat|dilated (fluid-filled )?(small bowel )?loops/, "Small bowel obstruction / dilated small bowel", "info"],
    ["lbo", /large bowel obstruction|colonic obstruction|\blbo\b|dilated (large bowel|colon)/, "Large bowel obstruction / dilated colon", "action"],
    ["ileus", /\bileus\b|diffuse(ly)? dilat\w* (small and large bowel|bowel)|gas throughout (the )?(small and large|colon)/, "Ileus pattern (no transition point)", "info"],
    ["ogilvie", /pseudo-?obstruction|ogilvie/, "Colonic pseudo-obstruction (Ogilvie)", "action"],
    ["contrastColon", /contrast (is |has )?(now )?(seen |present )?(in|within|reach\w*|pass\w* (in)?to) (the )?(colon|rectum|cecum|caecum|large bowel)|contrast in (the )?(colon|rectum)/, "Contrast has reached the colon (predicts resolution)", "info"],
    ["noContrastColon", /contrast (has )?(not|failed to) (reach|pass)|no contrast (in|within) (the )?(colon|rectum)|contrast remains (in|within) (the )?(small bowel|stomach)/, "Contrast has NOT reached the colon", "action"]];

  function imaging(text) {
    let t = " " + String(text || "").toLowerCase().replace(/\s+/g, " ") + " ";
    // keep "not excluded" possibilities, then drop plain negations ("no free air", "without pneumatosis")
    t = t.replace(/([^.;,]*?)\b(cannot be|can ?not be|can't be|not) (excluded|ruled out)/g, " possible $1 ");
    const contrastNeg = /contrast (has )?(not|failed to) (reach|pass)|no contrast (in|within) (the )?(colon|rectum)/.test(t);
    const tt = t.replace(/\b(no|without|negative for|free of|absence of)\b(?! contrast (in|within) (the )?(colon|rectum))[^.;,]*/g, " ");
    const f = [];
    CT_SIGNS.forEach(([id, re, label, lvl]) => {
      if (id === "noContrastColon") { if (contrastNeg) f.push({ id, label, lvl }); return; }
      if (id === "contrastColon" && contrastNeg) return;
      if (id === "reducedEnh") { if (re.test(tt) || /\b(absent|lack of|no) (bowel )?(wall )?enhancement/.test(t)) f.push({ id, label, lvl }); return; } // "no wall enhancement" is itself the finding
      if (re.test(tt)) f.push({ id, label, lvl });
    });
    const cm1 = t.match(/(?:cecum|caecum|cecal|caecal)[^.;]*?(\d{1,2}(?:\.\d)?) ?cm/), cm2 = t.match(/(\d{1,2}(?:\.\d)?) ?cm[^.;]*?(?:cecum|caecum|cecal|caecal)/), cm = cm1 || cm2;
    const sb = t.match(/small bowel[^.;]*?(\d(?:\.\d)?) ?cm/);
    const out = { finds: f, ids: new Set(f.map((x) => x.id)) };
    if (cm) out.cecum = +cm[1];
    if (sb) out.sbDiam = +sb[1];
    return out;
  }

  /* ---------- what kind of obstruction ---------- */
  function kind(o) {
    const ct = o.ct || new Set();
    if (ct.has("volvulus") && ct.has("lbo")) return { id: "volvulus", label: "Colonic volvulus (sigmoid or cecal)", why: "Volvulus with a dilated colon on imaging." };
    if (ct.has("ogilvie")) return { id: "ogilvie", label: "Colonic pseudo-obstruction (Ogilvie)", why: "Dilated colon without a mechanical cause on imaging." };
    if (ct.has("lbo")) return { id: "lbo", label: "Large bowel obstruction", why: "Dilated colon on imaging. Most often cancer, then volvulus, diverticular stricture. Different pathway from SBO." };
    if (ct.has("sbo") || ct.has("transition") || ct.has("closedLoop")) return { id: "sbo", label: "Mechanical small bowel obstruction", why: ct.has("transition") ? "Dilated small bowel with a transition point." : "Small bowel obstruction on imaging." };
    if (ct.has("ileus")) return { id: "ileus", label: "Ileus (not mechanical) more likely", why: "Diffusely dilated small and large bowel without a transition point. Look for the driver: surgery, opioids, electrolytes, infection, ischemia." };
    if (o.ctDone === false || !ct.size) return { id: "unclear", label: "Not confirmed yet: get a CT abdomen/pelvis with IV contrast", why: "Clinical suspicion only. X-ray misses or mislabels up to a third of SBO and cannot show ischemia." };
    return { id: "unclear", label: "Imaging does not name an obstruction", why: "Read the report yourself; consider ileus, constipation, gastroparesis, or early SBO." };
  }

  /* ---------- ischemia / strangulation red flags ---------- */
  function redFlags(o) {
    const out = [], ct = o.ct || new Set(), add = (id, lvl, t, why) => out.push({ id, lvl, t, why });
    if (o.peritonitis) add("peritonitis", "urgent", "Peritonitis on exam", "Rigidity, rebound or percussion tenderness: emergency surgery, no trial of non-operative management.");
    if (ct.has("freeAir") || ct.has("extrav")) add("perf", "urgent", "Perforation on imaging", "Free air or extraluminal contrast: emergency surgery, broad-spectrum antibiotics, resuscitation.");
    ["closedLoop", "whirl", "reducedEnh", "pneumatosis", "pvGas", "hyperdense", "ischemia", "volvulus"].forEach((id) => {
      if (ct.has(id)) add("ct-" + id, "urgent", CT_SIGNS.find((s) => s[0] === id)[2], id === "volvulus" ? "Volvulus can strangulate: surgery (small bowel / cecal) or endoscopic decompression (sigmoid) now." : "CT sign of ischemia or closed loop: needs surgery today, usually now.");
    });
    if (o.hernia === "irreducible" || o.hernia === "tender") add("hernia", "urgent", o.hernia === "tender" ? "Tender, irreducible hernia" : "Irreducible hernia", "Incarcerated hernia with obstruction: risk of strangulation. Surgery urgently; do not leave it for a trial of conservative care.");
    if (n(o.lactate) && o.lactate >= 4) add("lactate4", "urgent", `Lactate ${o.lactate} mmol/L`, "Lactate 4 or more with SBO: think ischemia or shock. Lactate is sensitive but not specific; a normal lactate does not exclude early ischemia.");
    else if (n(o.lactate) && o.lactate > 2) add("lactate2", "action", `Lactate ${o.lactate} mmol/L`, "Raised lactate: a WSES ischemia predictor. Recheck after fluids; tell surgery.");
    if (n(o.sbp) && o.sbp < 90) add("shock", "urgent", `SBP ${o.sbp}`, "Hypotension: resuscitate (fluids, consider sepsis/ischemia/perforation) and call surgery now.");
    if (n(o.hr) && o.hr > 110) add("hr", "action", `HR ${o.hr}`, "Tachycardia beyond what fluids fix suggests ischemia, sepsis or ongoing losses.");
    if (n(o.temp) && o.temp >= 38) add("fever", "action", `Temp ${o.temp}°C`, "Fever with SBO: ischemia, perforation or another source.");
    if (n(o.wbc) && o.wbc > 12) add("wbc", "action", `WBC ${o.wbc}`, "Leukocytosis is a WSES ischemia predictor (non-specific).");
    if (n(o.wbc) && o.wbc < 4) add("wbcLow", "action", `WBC ${o.wbc}`, "Leukopenia with SBO can mean overwhelming sepsis (or immunosuppression): treat as a red flag.");
    if (n(o.crp) && o.crp >= 75) add("crp", "action", `CRP ${o.crp} mg/L`, "CRP 75 or more was linked with strangulation (Schwenter 2010).");
    if ((n(o.hco3) && o.hco3 < 20) || (n(o.ph) && o.ph < 7.3)) add("acidosis", "action", `Metabolic acidosis (HCO3 ${o.hco3 ?? "?"}, pH ${o.ph ?? "?"})`, "Acidosis instead of the usual vomiting alkalosis: think ischemia, sepsis, AKI or DKA.");
    if (o.continuous) add("contPain", "action", "Continuous pain (not colicky) or pain out of proportion", "Change from colicky to constant pain is a classic sign of strangulation.");
    if (o.guarding && !o.peritonitis) add("guard", "action", "Guarding / localized tenderness", "Localized peritonism can be early strangulation: re-examine in a few hours; tell surgery.");
    if (ct.has("mesEdema") || ct.has("freeFluid")) add("ct-soft", "action", "Mesenteric edema or free fluid on CT", "Softer CT signs of ischemia (WSES). With any other red flag, surgery should see today.");
    if (n(o.cecum) && o.cecum >= 12) add("cecum12", "urgent", `Cecum ${o.cecum} cm`, "Cecal diameter 12 cm or more: high risk of perforation. Decompress now (LBO: surgery/stent; Ogilvie: neostigmine or colonoscopic decompression).");
    else if (n(o.cecum) && o.cecum >= 9) add("cecum9", "action", `Cecum ${o.cecum} cm`, "Cecum 9-12 cm: watch closely, repeat X-ray in 12-24 h.");
    if (o.steroid || (n(o.age) && o.age >= 80)) add("masked", "info", o.steroid ? "On steroids / immunosuppressed" : `Age ${o.age}`, "Peritonitis, fever and leukocytosis can be blunted: lower your threshold for CT and surgical review.");
    return out;
  }

  /* ---------- perforation risk: the labs and imaging that answer it ---------- */
  const PERF_LABS = [
    ["Lactate (venous is fine) and VBG/ABG pH, bicarbonate", "Ischemia, shock, acidosis. Repeat after 1-2 L of fluid and if pain changes."],
    ["CBC with differential", "Leukocytosis or new leukopenia, Hb for bleeding / pre-op."],
    ["CRP", "Over 75 mg/L linked with strangulation; trend over 24-48 h during non-operative care."],
    ["Electrolytes, creatinine, urea, glucose, Mg, PO4", "Losses (hypokalemia, contraction alkalosis), AKI before IV contrast, refeeding risk."],
    ["Lipase, liver enzymes, bilirubin", "Mimics and causes: pancreatitis, biliary sepsis, gallstone ileus."],
    ["INR, PTT, group and screen (crossmatch if going to OR)", "Pre-op; anticoagulant reversal plan."],
    ["Blood cultures x2 if febrile, hypotensive or perforated", "Before antibiotics."],
    ["CK (optional)", "Rises late with bowel infarction; not sensitive."]];
  const PERF_IMG = [
    ["CT abdomen/pelvis with IV contrast (portal venous phase)", "Test of choice (ACR). Confirms SBO, transition point, cause, closed loop, ischemia signs, free air. Oral contrast is not needed and delays the scan; give it only if the radiologist asks."],
    ["Non-contrast CT if IV contrast not possible", "Still shows obstruction, free air and hyperdense bowel wall; cannot show reduced enhancement. AKI is a relative, not absolute, reason to avoid IV contrast when ischemia is suspected."],
    ["Upright chest X-ray / left lateral decubitus abdominal film", "Free air under the diaphragm if CT is delayed or the patient is too unstable to travel. A normal film does not exclude perforation."],
    ["Supine and upright abdominal X-ray", "Dilated loops over 3 cm with air-fluid levels; used to follow a water-soluble contrast challenge. Not enough to decide on its own."],
    ["Bedside ultrasound (POCUS)", "Dilated fluid-filled loops over 2.5 cm, to-and-fro peristalsis, free fluid; akinetic loops with free fluid suggest strangulation."],
    ["Repeat CT", "If pain, vitals or lactate get worse during non-operative care, or no progress by 48-72 h without a contrast challenge."]];

  function perforation(o) {
    const ct = o.ct || new Set(), why = [];
    if (ct.has("freeAir") || ct.has("extrav")) return { level: "perforated", label: "Perforated", tone: "t3", why: ["Free air or extraluminal contrast on imaging."] };
    let pts = 0;
    const p = (cond, w, t) => { if (cond) { pts += w; why.push(t); } };
    p(o.peritonitis, 3, "peritonitis");
    p(ct.has("closedLoop") || ct.has("whirl") || ct.has("volvulus"), 3, "closed loop / twist");
    p(ct.has("reducedEnh") || ct.has("pneumatosis") || ct.has("pvGas") || ct.has("ischemia") || ct.has("hyperdense"), 3, "CT ischemia sign");
    p(o.hernia === "irreducible" || o.hernia === "tender", 2, "incarcerated hernia");
    p(n(o.cecum) && o.cecum >= 12, 3, "cecum 12 cm or more");
    p(n(o.cecum) && o.cecum >= 9 && o.cecum < 12, 1, "cecum 9-12 cm");
    p(n(o.lactate) && o.lactate > 2, n(o.lactate) && o.lactate >= 4 ? 2 : 1, "raised lactate");
    p(ct.has("highGrade") || o.obstipation, 1, "complete / high-grade obstruction");
    p(ct.has("mesEdema") || ct.has("freeFluid"), 1, "mesenteric edema / free fluid");
    p(o.continuous, 1, "continuous pain");
    p((n(o.wbc) && o.wbc > 12) || (n(o.crp) && o.crp >= 75), 1, "WBC/CRP up");
    p(n(o.temp) && o.temp >= 38, 1, "fever");
    p(n(o.nomHours) && o.nomHours > 72, 1, "over 72 h without resolution");
    const noCT = o.ctDone === false || !ct.size;
    if (pts >= 3) return { level: "high", label: "High risk of ischemia / perforation", tone: "t3", why, pts };
    if (pts >= 1) return { level: "moderate", label: "Some risk features", tone: "t2", why, pts };
    if (noCT) return { level: "unknown", label: "Unknown until CT", tone: "t1", why: ["No CT read yet: the CT is what rules out closed loop, ischemia and free air."], pts };
    return { level: "low", label: "Low on current data", tone: "t0", why: ["No red flags found. Re-examine every 4-6 h; risk changes."], pts };
  }

  /* ---------- water-soluble contrast challenge (Gastrografin) ---------- */
  function wscc(o) {
    if (o.wsccGiven !== true) {
      const no = [];
      if (o.peritonitis || (o.ct && ["freeAir", "extrav", "closedLoop", "whirl", "reducedEnh", "pneumatosis", "pvGas", "ischemia"].some((x) => o.ct.has(x)))) no.push("signs of ischemia, closed loop or perforation (go to surgery instead)");
      if (o.aspiration) no.push("high aspiration risk without an NG tube (decompress first)");
      if (o.contrastAllergy) no.push("previous severe reaction to iodinated contrast");
      if (o.cause && o.cause !== "adhesions" && o.cause !== "unknown") no.push("cause is not adhesions (the evidence is for adhesive SBO)");
      return { status: no.length ? "no" : "offer", label: no.length ? "Not now" : "Consider giving it now", no };
    }
    const h = o.wsccHours;
    if (o.wsccColon === "yes") return { status: "pass", label: "Contrast reached the colon: likely to settle without surgery", no: [] };
    if (o.wsccColon === "no" && n(h) && h >= 24) return { status: "fail", label: "No contrast in the colon at 24 h: high chance non-operative care will fail, talk to surgery about operating", no: [] };
    if (n(h) && h < 8) return { status: "wait", label: `Given ${h} h ago: abdominal X-ray at 8-24 h (local practice; most use 24 h)`, no: [] };
    if (n(h) && h >= 24 && !o.wsccColon) return { status: "due", label: "X-ray due now (24 h)", no: [] };
    return { status: "wait", label: "Abdominal X-ray at 8-24 h after the contrast", no: [] };
  }

  /* ---------- what to do ---------- */
  function pathway(o) {
    const flags = redFlags(o), urgent = flags.filter((f) => f.lvl === "urgent"), action = flags.filter((f) => f.lvl === "action");
    const k = kind(o), w = wscc(o), steps = [];
    if (urgent.length) return { act: "surgeryNow", tone: "t3", label: "Emergency: call general surgery now", why: urgent.map((f) => f.t), steps: [
      "Call general surgery now (and anesthesia if going to OR). NPO, NG tube to low intermittent suction.",
      "Two large-bore IVs; balanced crystalloid bolus (e.g. Ringer's lactate 500-1000 mL) then reassess; urinary catheter for hourly output.",
      "Labs now: lactate/VBG, CBC, lytes, creatinine, INR/PTT, group and screen/crossmatch, blood cultures if febrile/hypotensive.",
      ...(flags.some((f) => f.id === "perf" || /ischemi|strangul/i.test(f.t)) || o.peritonitis ? ["Antibiotics for perforation/ischemia: e.g. piperacillin-tazobactam 4.5 g IV q6-8h, or ceftriaxone 2 g IV daily + metronidazole 500 mg IV q12h (penicillin allergy: check local guide)."] : []),
      "Hold anticoagulants and plan reversal with surgery; stress-dose steroids if on chronic prednisone.",
      "Analgesia: IV opioid titrated; it does not mask the need for surgery.",
      "Goals of care conversation if frail or advanced illness, before OR if possible."] };
    if (k.id === "lbo" || k.id === "volvulus") return { act: "lbo", tone: "t2", label: k.id === "volvulus" ? "Colonic volvulus: surgery / GI today" : "Large bowel obstruction: general surgery today", why: [k.why], steps: [
      "General surgery today. Sigmoid volvulus without ischemia: endoscopic detorsion and rectal tube, then elective sigmoid resection this admission. Cecal volvulus: surgery.",
      "Malignant LBO: surgery vs colonic stent (bridge to surgery or palliation) by surgery/GI. CT chest for staging, CEA.",
      "NPO, NG if vomiting, IV fluids, correct K and Mg. No water-soluble contrast challenge (that is for adhesive SBO).",
      "Cecal diameter on every film: 12 cm or more is high perforation risk."] };
    if (k.id === "ogilvie") return { act: "ogilvie", tone: "t2", label: "Colonic pseudo-obstruction: treat the cause, decompress if cecum large", why: [k.why], steps: [
      "Stop opioids/anticholinergics/CCBs where possible; correct K, Mg, PO4, Ca; treat infection; mobilize; NG and rectal tube.",
      "Cecum 12 cm or more, or no better at 24-48 h: neostigmine 2 mg IV over 3-5 min with cardiac monitoring and atropine ready (contraindicated: mechanical obstruction, recent bowel surgery, bradycardia, active bronchospasm), or colonoscopic decompression.",
      "Peritonitis or perforation: surgery."] };
    if (k.id === "ileus") return { act: "ileus", tone: "t1", label: "Ileus: supportive care and find the cause", why: [k.why], steps: [
      "NPO (or sips), NG only if vomiting or distended. IV fluids, K over 4 and Mg over 1.0.",
      "Cut opioids (add non-opioids), stop anticholinergics; look for infection, pancreatitis, retroperitoneal bleed, hypothyroidism, recent surgery.",
      "If no better in 48-72 h or a transition point appears, re-image."] };
    if (o.cause === "malignant" || o.carcinomatosis) return { act: "mbo", tone: "t2", label: "Malignant bowel obstruction: surgery and palliative care together", why: ["Known cancer / carcinomatosis."], steps: [
      "Ask surgery whether this is a single operable point (good performance status, no ascites, no diffuse carcinomatosis) or multi-level.",
      "Not operable: NG or venting gastrostomy for vomiting; octreotide 100-200 mcg SC q8h; dexamethasone 8 mg IV/SC daily for 5 days then stop if no effect; haloperidol or ondansetron for nausea (avoid metoclopramide if complete); opioid subcutaneous.",
      "Palliative care consult; talk about goals, TPN (only if prognosis is months and performance status good) and where to be cared for.",
      "See the Peritoneal carcinomatosis tab for the PCI calculator and primary-specific approach."] };
    if (o.cause === "crohn") return { act: "crohn", tone: "t2", label: "Crohn disease stricture: GI and surgery", why: ["Crohn disease on the problem list."], steps: [
      "Inflammatory vs fibrotic stricture: CT/MR enterography features (wall enhancement, comb sign) and CRP. Abscess: drain + antibiotics before steroids.",
      "Inflammatory: IV steroids (e.g. methylprednisolone 40-60 mg/day) with GI. Fibrotic: endoscopic balloon dilation (short stricture) or surgery.",
      "See the IBD tab."] };
    const ct0 = o.ct || new Set();
    if (k.id === "sbo" && (ct0.has("gallstone") || (ct0.has("pneumobilia") && !o.biliaryProc))) return { act: "surgeryToday", tone: "t2", label: "Gallstone ileus likely: general surgery today", why: [ct0.has("gallstone") ? "Pneumobilia + ectopic gallstone (Rigler triad)" : "Pneumobilia with SBO and no previous biliary procedure"], steps: [
      "Confirm with radiology: ectopic stone (often terminal ileum / ileocecal valve), cholecystoduodenal fistula, any second stone.",
      "NPO, NG, IV fluids, correct K/Mg. Non-operative care rarely clears it; no water-soluble contrast challenge as a substitute for surgery.",
      "Surgery: enterolithotomy (fistula repair and cholecystectomy usually later or not at all in frail patients). Stone in the duodenum with gastric outlet obstruction (Bouveret): endoscopy or surgery.",
      "Older, often frail patients: goals of care and anesthesia risk discussed early."] };
    if (o.virgin) steps.push("No previous abdominal surgery and no hernia: adhesions are unlikely, so a cause must be found (cancer, hernia missed on exam, Crohn, internal hernia, gallstone, bezoar). Surgery should see early; many go to OR or diagnostic laparoscopy.");
    if (o.recentSurgery) steps.push("Within 30 days of abdominal surgery: early postoperative SBO vs ileus vs leak/collection. Managed by the operating team; non-operative care often longer.");
    const nh = o.nomHours;
    if (w.status === "fail") return { act: "surgeryToday", tone: "t3", label: "Failed contrast challenge: surgery today", why: [w.label], steps: steps.concat(["Discuss operating with surgery now (WSES: no contrast in the colon at 24 h predicts failure of non-operative care).", "Continue NPO, NG, fluids; daily lactate/CRP if trending."]) };
    if (n(nh) && nh >= 72 && w.status !== "pass") return { act: "surgeryToday", tone: "t3", label: "72 h of non-operative care without resolution: surgery", why: [`${Math.round(nh)} h of non-operative care`], steps: steps.concat(["WSES: if no resolution by 72 h, operate (unless the surgeon has a reason to wait, e.g. early postoperative or carcinomatosis)."]) };
    if (action.length >= 2) return { act: "surgeryToday", tone: "t2", label: "Several warning signs: surgery to see today and re-examine every 4 h", why: action.map((f) => f.t), steps: steps.concat(["CT with IV contrast if not done.", "Start non-operative care while waiting but do not give the contrast challenge until surgery agrees.", "Recheck lactate after resuscitation."]) };
    if (k.id === "unclear") return { act: "image", tone: "t1", label: "Confirm it: CT abdomen/pelvis with IV contrast", why: [k.why], steps: steps.concat(["Start: NPO, IV fluids, analgesia, antiemetic, NG if vomiting or distended.", "Consult general surgery once SBO is confirmed (all SBO admissions should have surgery involved; outcomes are better when surgery is the admitting or co-managing service)."]) };
    return { act: "nom", tone: "t0", label: "Non-operative management with surgery involved", why: ["No ischemia, perforation or closed-loop signs found."], steps: steps.concat([
      "NPO; NG to low intermittent suction if vomiting or distended (record output every shift).",
      "IV fluids (balanced crystalloid), replace NG losses mL for mL, KCl to keep K 4 or more, Mg over 1.0.",
      "Analgesia (opioid titrated + acetaminophen IV/PR), antiemetic (ondansetron; avoid metoclopramide while obstructed). VTE prophylaxis.",
      "Water-soluble contrast challenge: " + (w.status === "offer" ? "100 mL Gastrografin (diatrizoate) via NG after aspirating, clamp NG 2-4 h (or PO), abdominal X-ray at 8-24 h." : w.status === "pass" ? "contrast reached the colon: start clear fluids and advance as tolerated." : w.label + "."),
      "Re-examine every 4-6 h. Surgery if peritonitis, new red flags, or no resolution by 72 h.",
      "Resolution: passing flatus/stool, less distension, NG output under ~500 mL/24 h and not bilious → clamp trial then remove NG, start fluids."]) };
  }

  /* ---------- medication review for SBO ---------- */
  const MED_RULES = [
    { id: "prokinetic", re: /metoclopramide|domperidone|erythromycin.*(motility|gastroparesis)|prucalopride|neostigmine|pyridostigmine/i, lvl: "urgent", t: "Prokinetic", why: "Contraindicated in mechanical obstruction (risk of perforation). Stop until obstruction is excluded or resolved. Use ondansetron/haloperidol for nausea." },
    { id: "laxative", re: /polyethylene glycol|peg ?3350|lax-?a-?day|restoralax|senn|sennosides|bisacodyl|dulcolax|lactulose|docusate|magnesium (hydroxide|citrate)|picosulfate|pico-?salax|lubiprostone|linaclotide|methylnaltrexone|naloxegol/i, lvl: "action", t: "Laxative / bowel stimulant", why: "Hold oral and stimulant laxatives while obstructed (PRN orders can still get given). Methylnaltrexone and naloxegol are contraindicated in mechanical obstruction. Restart when it resolves, especially with opioids." },
    { id: "anticholinergic", re: /dimenhydrinate|gravol|diphenhydramine|hydroxyzine|scopolamine|hyoscine|buscopan|oxybutynin|tolterodine|solifenacin|trospium|darifenacin|fesoterodine|benztropine|trihexyphenidyl|amitriptyline|nortriptyline|imipramine|doxepin|clomipramine|promethazine|chlorpheniramine|dicyclomine|glycopyrr/i, lvl: "action", t: "Anticholinergic", why: "Slows the gut (worse ileus) and adds delirium. Swap: dimenhydrinate → ondansetron; for MBO colic hyoscine butylbromide is used on purpose by palliative care." },
    { id: "opioid", re: /morphine|hydromorphone|oxycodone|fentanyl|codeine|tramadol|tapentadol|methadone|buprenorphine|meperidine|sufentanil/i, lvl: "info", t: "Opioid", why: "Do not withhold analgesia (it does not mask surgical signs). Lowest effective dose, add acetaminophen; opioid ileus can mimic SBO. Methadone/buprenorphine: keep, give IV/SL equivalent." },
    { id: "constipating", re: /verapamil|diltiazem|clozapine|olanzapine|quetiapine|loperamide|imodium|diphenoxylate|ondansetron.*(scheduled|q6h|q8h)|cholestyramine|colestipol|sevelamer|sucralfate|aluminum hydroxide|calcium carbonate|ferrous|iron|psyllium|metamucil|clonidine|vincristine/i, lvl: "action", t: "Constipating / bezoar-forming drug", why: "Can cause or worsen obstruction. Clozapine: gut hypomotility can be fatal (tell psychiatry). Psyllium, sevelamer, sucralfate, cholestyramine, iron: bezoar risk. Hold while NPO." },
    { id: "glp1", re: /semaglutide|ozempic|wegovy|rybelsus|liraglutide|victoza|saxenda|dulaglutide|trulicity|exenatide|tirzepatide|mounjaro|zepbound/i, lvl: "action", t: "GLP-1 / GIP agonist", why: "Slows gastric emptying and is linked with ileus and gastroparesis that can look like obstruction; aspiration risk at anesthesia. Hold (weekly agents last about a week)." },
    { id: "anticoag", re: /apixaban|rivaroxaban|edoxaban|dabigatran|warfarin|heparin infusion|enoxaparin\s*(1\s*mg\/kg|[6-9]\d|1[0-9]\d)\s*mg|dalteparin\s*\d{4,}|tinzaparin/i, lvl: "action", t: "Anticoagulant", why: "Oral agents will not absorb with vomiting/NG. Surgery may be needed: switch to heparin infusion or LMWH with a hold plan. Intramural hematoma is a rare SBO cause on warfarin (INR high)." },
    { id: "steroid", re: /prednisone|prednisolone|dexamethasone|methylprednisolone|hydrocortisone|budesonide/i, lvl: "action", t: "Steroid", why: "Masks peritonitis and fever. Chronic use (over 5 mg prednisone for 3+ weeks): give IV hydrocortisone while NPO and stress dose for surgery." },
    { id: "sglt2", re: /empagliflozin|jardiance|dapagliflozin|forxiga|canagliflozin|invokana|ertugliflozin|synjardy|xigduo/i, lvl: "action", t: "SGLT2 inhibitor", why: "Hold while NPO / vomiting / before surgery: euglycemic DKA. Check ketones if the bicarbonate is low." },
    { id: "metformin", re: /metformin|janumet|jentadueto|synjardy|xigduo|segluromet/i, lvl: "action", t: "Metformin", why: "Hold while NPO, with AKI or before IV contrast; lactate may already be up." },
    { id: "insulin", re: /insulin|glargine|lantus|basaglar|toujeo|detemir|levemir|degludec|tresiba|nph|humulin|novolin|aspart|novorapid|fiasp|lispro|humalog|glulisine/i, lvl: "info", t: "Insulin", why: "NPO: keep basal at about 70-80% (do not stop in type 1), stop mealtime insulin, correction scale, glucose q4-6h. See the Diabetes tab." },
    { id: "sulfonylurea", re: /gliclazide|diamicron|glyburide|glibenclamide|glimepiride/i, lvl: "action", t: "Sulfonylurea", why: "Hold while NPO: hypoglycemia." },
    { id: "renal", re: /furosemide|lasix|hydrochlorothiazide|chlorthalidone|indapamide|spironolactone|ramipril|perindopril|lisinopril|enalapril|candesartan|losartan|valsartan|irbesartan|telmisartan|sacubitril|entresto|nsaid|ibuprofen|naproxen|ketorolac|diclofenac|celecoxib/i, lvl: "action", t: "Diuretic / ACE-ARB / NSAID", why: "Hold while volume-depleted from vomiting and third-spacing (AKI). Restart when eating and creatinine is back to baseline." },
    { id: "levodopa", re: /levodopa|carbidopa|sinemet|stalevo|rasagiline|pramipexole|ropinirole|rotigotine/i, lvl: "urgent", t: "Parkinson medication", why: "Do not just stop (parkinsonism-hyperpyrexia risk). Give levodopa crushed via NG and clamp 30-60 min if allowed, or a rotigotine patch. See the Parkinson tab; avoid metoclopramide/haloperidol (use domperidone only if not obstructed, ondansetron OK)." },
    { id: "aed", re: /levetiracetam|keppra|phenytoin|dilantin|valpro|divalproex|epival|lacosamide|vimpat|carbamazepine|tegretol|lamotrigine|lamictal|topiramate|brivaracetam|oxcarbazepine|clobazam/i, lvl: "urgent", t: "Antiseizure medication", why: "Missed doses cause seizures. Switch to IV (levetiracetam, lacosamide, valproate, phenytoin same dose) while NPO; lamotrigine/carbamazepine have no IV form: ask neurology/pharmacy. See the Seizure tab." },
    { id: "immuno", re: /tacrolimus|cyclosporine|mycophenolate|cellcept|myfortic|azathioprine|sirolimus|everolimus/i, lvl: "urgent", t: "Transplant / immunosuppressant", why: "Needs an IV or SL plan with the transplant team while NPO (tacrolimus SL or IV at a reduced dose, mycophenolate IV). See the Kidney transplant tab." },
    { id: "thyroid", re: /levothyroxine|synthroid|eltroxin/i, lvl: "info", t: "Levothyroxine", why: "Long half-life: can be held up to about 5-7 days NPO; then IV at about 50-75% of the oral dose." },
    { id: "oralOnly", re: /\b(po|oral|tablet|capsule|by mouth)\b/i, lvl: "info", t: "Other oral medications", why: "Will not be absorbed reliably with vomiting or NG suction. Decide which to hold, which to give IV, and which can go via NG (clamp after)." }];
  function medFlags(meds) {
    const out = [];
    MED_RULES.forEach((r) => {
      let hit = (meds || []).filter((m) => r.re.test(m));
      if (r.id === "oralOnly") { const used = new Set(out.flatMap((x) => x.drugs)); hit = hit.filter((m) => !used.has(m)); }
      if (r.id === "renal") hit = hit.filter((m) => !/acetaminophen/i.test(m));
      if (hit.length) out.push({ id: r.id, lvl: r.lvl, t: r.t, why: r.why, drugs: [...new Set(hit)] });
    });
    return out;
  }

  /* ---------- fluids while NPO with an NG ---------- */
  function fluids(x) {
    const w = n(x.weight) ? +x.weight : null, ng = n(x.ngOut) ? +x.ngOut : 0, lines = [];
    if (!w) return { ok: false, lines: ["Enter weight to calculate."] };
    const maint = Math.round(Math.min(w, 80) * 25 / 10) * 10, kMaint = Math.round(Math.min(w, 80) * 1);
    const hourly = Math.round((maint + ng) / 24 / 5) * 5;
    lines.push(`Maintenance about ${maint} mL/24 h (25 mL/kg; NICE 25-30 mL/kg/day, lower end if frail, cardiac or kidney disease) with about ${kMaint} mmol K+/24 h.`);
    if (ng) lines.push(`Plus NG losses ${ng} mL/24 h replaced mL for mL with Ringer's lactate or 0.9% saline + 10-20 mmol KCl/L (gastric fluid: Na about 60, K 10-15, Cl 100-130 mmol/L).`);
    lines.push(`About ${maint + ng} mL/24 h total, roughly ${hourly} mL/h, adjusted to urine output (goal 0.5 mL/kg/h = ${Math.round(w * 0.5)} mL/h), exam and lytes.`);
    if (x.dry) lines.push("Signs of hypovolemia now: give 500 mL bolus of balanced crystalloid over 15-30 min, reassess, repeat (most SBO patients arrive 2-4 L down).");
    if (n(x.k) && x.k < 3.5) lines.push(`K ${x.k}: replace IV (peripheral max about 10 mmol/h; recheck in 4-6 h). Check Mg: low Mg keeps K low and worsens ileus.`);
    if (x.alkalosis) lines.push("Hypochloremic metabolic alkalosis from vomiting/NG: chloride (saline) and potassium fix it.");
    if (n(x.npoDays) && x.npoDays >= 5) lines.push(`NPO ${x.npoDays} days: dietitian; PN if not expected to eat within 7 days (sooner if malnourished). Check PO4/Mg/K for refeeding risk.`);
    return { ok: true, maint, total: maint + ng, hourly, lines };
  }

  /* ---------- causes ---------- */
  const CAUSES = [
    { id: "adhesions", name: "Adhesions", freq: "About 60-75% of SBO in adults", clue: "Previous abdominal or pelvic surgery (appendectomy, colectomy, hysterectomy, C-section), single transition point, no mass.", img: "Transition point without a mass; 'small bowel feces' sign proximal to it.", tx: "Non-operative care + water-soluble contrast challenge; surgery for red flags or failure at 72 h. About 70-80% settle without surgery; recurrence is common." },
    { id: "hernia", name: "Hernia (inguinal, femoral, umbilical, incisional, internal)", freq: "About 10-15%; the commonest cause with no previous surgery", clue: "Examine every hernia site (femoral in older women is easy to miss). Internal hernia after Roux-en-Y gastric bypass: pain out of proportion, may need surgery even with a soft CT.", img: "Bowel in the hernia sac with a transition point; closed loop / whirl for internal hernia.", tx: "Incarcerated: surgery urgently. Reducible with resolution: elective repair. Post-bypass internal hernia: bariatric/general surgery now." },
    { id: "malignant", name: "Cancer (primary bowel tumour, metastases, carcinomatosis)", freq: "About 5-10%; common in malignant bowel obstruction (ovarian, colorectal, gastric, pancreatic)", clue: "Known cancer, weight loss, anemia, ascites, no previous surgery.", img: "Mass at the transition point, multiple transition points, peritoneal implants, ascites.", tx: "Single site and fit: surgery or stent. Diffuse carcinomatosis: palliative MBO management (octreotide, dexamethasone, venting gastrostomy)." },
    { id: "crohn", name: "Crohn disease stricture", freq: "Common in younger patients with IBD", clue: "Known Crohn disease, previous ileocecal resection, CRP up.", img: "Thickened, enhancing terminal ileum, comb sign; abscess or fistula.", tx: "Inflammatory: steroids. Fibrotic: dilation or surgery. Abscess: drain first. GI + surgery." },
    { id: "volvulus", name: "Small bowel volvulus / midgut volvulus", freq: "Uncommon", clue: "Sudden severe pain, malrotation, adhesion band.", img: "Whirl sign, closed loop.", tx: "Surgery now." },
    { id: "intuss", name: "Intussusception (adult)", freq: "1-5% of adult SBO", clue: "Intermittent symptoms. In adults usually has a lead point (tumour in about two thirds).", img: "Target / bowel-within-bowel sign; look for the mass. Short transient non-obstructing ones are often incidental.", tx: "Obstructing adult intussusception with a lead point: surgery (resection)." },
    { id: "gallstone", name: "Gallstone ileus", freq: "Rare; elderly women", clue: "Older woman, previous biliary symptoms, intermittent ('tumbling') obstruction. Pneumobilia with SBO and no previous ERCP, sphincterotomy, stent or biliary-enteric anastomosis is gallstone ileus until proven otherwise.", img: "Rigler triad: pneumobilia, SBO, ectopic gallstone (often at the ileocecal valve). All three on plain X-ray in a minority; CT shows them in most. Stone in the duodenum with gastric outlet obstruction = Bouveret syndrome.", tx: "Enterolithotomy (surgery); fistula repair usually later or never. Check for a second stone. Bouveret: endoscopic retrieval/lithotripsy or surgery." },
    { id: "bezoar", name: "Bezoar / foreign body", freq: "Rare", clue: "Previous gastric surgery, poor dentition, high-fibre or psyllium, sevelamer, cholestyramine, persimmon; capsule endoscopy.", img: "Mottled intraluminal mass at the transition point.", tx: "Some pass; often surgery or endoscopy." },
    { id: "radiation", name: "Radiation enteritis / stricture", freq: "After pelvic or abdominal radiation", clue: "Cervical, prostate, rectal radiation, often years later.", img: "Pelvic small bowel loops with wall thickening, tethering.", tx: "Usually non-operative first; surgery is difficult (high leak rate)." },
    { id: "hematoma", name: "Intramural hematoma", freq: "Rare", clue: "Warfarin with high INR, hemophilia, trauma.", img: "Long-segment hyperdense wall thickening.", tx: "Reverse anticoagulation; non-operative usually." },
    { id: "other", name: "Other: endometriosis, SMA syndrome, appendicitis/diverticulitis abscess, ischemic stricture, NSAID diaphragm disease, Meckel diverticulum", freq: "Rare", clue: "Context-specific.", img: "Depends on cause.", tx: "Treat the cause; surgery input." }];

  const MIMICS = [
    ["Ileus (postoperative, drug, electrolyte, sepsis)", "Diffuse dilation of small and large bowel, no transition point, quiet abdomen. Supportive care, fix K/Mg, cut opioids."],
    ["Large bowel obstruction", "Colon dilated (cecum, transverse colon), slower onset, distension more than vomiting. Different pathway: surgery/stent."],
    ["Colonic pseudo-obstruction (Ogilvie)", "Massive colonic dilation in an ill, immobile patient. Neostigmine/decompression if cecum 12 cm or more."],
    ["Mesenteric ischemia", "Pain out of proportion, AF or vascular disease, lactate up, may have little distension. CT angiography; vascular surgery."],
    ["Gastroparesis / gastric outlet obstruction", "Vomiting of undigested food, upper abdominal distension; diabetes, GLP-1 agonists, peptic stricture, pancreatic cancer."],
    ["Constipation / fecal impaction", "Colon full of stool, rectal exam; older patients on opioids/anticholinergics. Can cause SBO-like vomiting."],
    ["Pancreatitis, biliary sepsis, appendicitis, diverticulitis", "Local inflammation causes a localized ileus ('sentinel loop'). Lipase, CT."],
    ["DKA, hypercalcemia, hypothyroidism, adrenal crisis, uremia", "Vomiting and ileus from a metabolic cause: check glucose, ketones, Ca, TSH, cortisol."]];

  const SYMPTOMS = [
    ["Colicky central abdominal pain", "Waves every few minutes. Constant, severe or localized pain suggests ischemia."],
    ["Vomiting", "Early and bilious in proximal SBO; later and feculent in distal SBO."],
    ["Distension", "Marked in distal SBO, mild in proximal."],
    ["Obstipation (no flatus or stool)", "Suggests complete obstruction; early on the colon can still empty below the block."],
    ["Exam", "Distension, tympany, high-pitched or absent bowel sounds, surgical scars, every hernia site (incl. femoral), rectal exam. Peritonitis, fever, tachycardia, hypotension = complicated SBO."],
    ["Proximal vs distal", "Proximal: early vomiting, little distension, few air-fluid levels. Distal: distension, later vomiting, many dilated loops."]];

  function likelyCauses(x) {
    // x: { priorSurgery, hernia (exam), herniaCT, cancer, carcinomatosis, crohn, radiation, anticoag, inrHigh, bypass, gallCT, mass, intussCT, whirl, bezoarRisk }
    const s = CAUSES.map((c) => ({ ...c, score: 0, why: [] })), g = (id) => s.find((c) => c.id === id), bump = (id, w, t) => { const c = g(id); c.score += w; c.why.push(t); };
    if (x.priorSurgery) bump("adhesions", 3, "previous abdominal/pelvic surgery");
    if (x.hernia && x.hernia !== "none") bump("hernia", 3, "hernia on exam");
    if (x.herniaCT) bump("hernia", 3, "hernia on CT");
    if (x.bypass) bump("hernia", 2, "gastric bypass (internal hernia)");
    if (x.cancer) bump("malignant", 2, "cancer on the problem list");
    if (x.carcinomatosis) bump("malignant", 3, "carcinomatosis");
    if (x.mass) bump("malignant", 2, "mass on imaging");
    if (x.crohn) bump("crohn", 3, "Crohn disease");
    if (x.radiation) bump("radiation", 2, "previous radiation");
    if (x.whirl) bump("volvulus", 3, "whirl sign");
    if (x.intussCT) bump("intuss", 3, "intussusception on CT");
    if (x.gallCT) bump("gallstone", 4, "pneumobilia + ectopic stone");
    else if (x.pneumobilia) bump("gallstone", x.biliaryProc ? 1 : 3, x.biliaryProc ? "pneumobilia (but previous ERCP/sphincterotomy/stent can explain it)" : "pneumobilia with SBO: look for an ectopic gallstone");
    if (x.bezoarRisk) bump("bezoar", 1, "bezoar-forming drug");
    if (x.anticoag && x.inrHigh) bump("hematoma", 2, "anticoagulant with high INR");
    if (!x.priorSurgery && !(x.hernia && x.hernia !== "none")) bump("hernia", 1, "no previous surgery: check hernia sites");
    return s.filter((c) => c.score > 0).sort((a, b) => b.score - a.score);
  }

  const api = { imaging, CT_SIGNS, kind, redFlags, perforation, PERF_LABS, PERF_IMG, wscc, pathway, MED_RULES, medFlags, fluids, CAUSES, MIMICS, SYMPTOMS, likelyCauses };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else window.SboRules = api;
})();
