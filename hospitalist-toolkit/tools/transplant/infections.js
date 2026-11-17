/* Kidney transplant tab – opportunistic infections: CMV, PJP, BK polyomavirus.
 * Reference content + patient-specific checks from the chart (prophylaxis orders, CMV/BK PCR, LDH, WBC, creatinine trend,
 * lymphocyte-depleting or rejection treatment) and from inputs on the page (transplant date, CMV serostatus, weight, symptoms).
 * UNVERIFIED DRAFT written by Claude from AST IDCOP 2019 guidelines (CMV, PJP, BK), the Third International Consensus on CMV in SOT (2018)
 * and product monographs. Programs differ: follow the local transplant program's protocol. */
(function () {
  const DAY = 864e5, MONTH = 30.44 * DAY;
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const fmtD = (t) => new Date(t).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  const fmtN = (v) => v >= 1000 ? Math.round(v).toLocaleString() : String(Math.round(v * 10) / 10);
  const label = (cc) => (cc && (cc.text || (cc.coding || []).map((c) => c.display).filter(Boolean)[0])) || "";

  /* ---------------------------------------------------------------- reference */
  const KB = {
    cmv: {
      name: "Cytomegalovirus (CMV)",
      when: ["Highest risk 1–6 months after transplant when no prophylaxis is given.",
        "With prophylaxis, disease shifts to the 3–6 months after prophylaxis stops (\"late-onset CMV\").",
        "Any time after lymphocyte-depleting treatment (ATG/thymoglobulin, alemtuzumab) or pulse steroids for rejection."],
      risk: ["Donor-positive / recipient-negative (D+/R−): highest risk (no prior immunity).", "Recipient-positive (R+): intermediate, higher after ATG.", "D−/R−: low risk (blood products should be CMV-safe).",
        "Lymphocyte-depleting induction or rejection treatment, high mycophenolate exposure, older donor, other infections, lymphopenia."],
      symptoms: ["<b>CMV syndrome</b>: fever ≥38 °C, malaise/fatigue, leukopenia or neutropenia, thrombocytopenia, atypical lymphocytes, mildly raised ALT/AST.",
        "<b>Tissue-invasive disease</b>: GI (diarrhea, abdominal pain, GI bleeding, odynophagia — colitis, esophagitis, gastritis), hepatitis, pneumonitis (cough, hypoxia), nephritis/allograft dysfunction, pancreatitis; retinitis is rare and late (floaters, visual loss).",
        "<b>Indirect effects</b>: acute rejection, other opportunistic infections (PJP, fungal, EBV/PTLD), new-onset diabetes, reduced graft survival."],
      tests: ["<b>Plasma CMV quantitative PCR (QNAT, IU/mL)</b> — the main test; use the same lab each time to follow the trend.",
        "Repeat weekly during treatment. A rise of >0.5 log (≈3×) is meaningful; smaller changes can be lab variation.",
        "GI disease: blood PCR can be low or negative — endoscopy with biopsy (immunohistochemistry) is the gold standard.",
        "Pneumonitis: BAL PCR is hard to interpret (shedding); combine with blood PCR and histology. Retinitis: ophthalmology exam.",
        "CBC, liver enzymes, creatinine. Resistance genotyping (UL97, UL54) if viral load fails to fall or rises after ≥2 weeks of adequately dosed treatment."],
      prevent: ["<b>Universal prophylaxis</b> (most Canadian programs for D+/R− and R+ with ATG): valganciclovir 900 mg PO daily (kidney-adjusted) for 6 months if D+/R−, 3 months if R+.",
        "<b>Letermovir</b> 480 mg PO/IV daily — Health Canada–approved for D+/R− kidney recipients (to ~200 days); less marrow suppression; raises tacrolimus/cyclosporine levels; prophylaxis only (no treatment activity). Use 240 mg daily with cyclosporine.",
        "<b>Pre-emptive approach</b> (some programs, R+): weekly CMV PCR for ~3 months and treat when above the program threshold.",
        "After prophylaxis ends, many programs monitor CMV PCR every 2–4 weeks for ~3 months in D+/R−."],
      treat: ["<b>Non-severe disease or asymptomatic DNAemia above threshold</b>: valganciclovir 900 mg PO BID (adjust for CrCl).",
        "<b>Severe / life-threatening disease, very high viral load, or doubtful GI absorption</b>: ganciclovir 5 mg/kg IV q12h (adjust for CrCl), switch to oral when improving.",
        "Continue until symptoms resolve <b>and</b> CMV PCR is below the lower limit of quantitation on 1–2 consecutive weekly tests, for at least 2 weeks.",
        "Reduce immunosuppression with the transplant team (usually hold or reduce mycophenolate first). Don't change it yourself.",
        "Then secondary prophylaxis or close PCR monitoring per the program.",
        "Refractory or resistant CMV: maribavir 400 mg PO BID (Health Canada–approved for refractory/resistant post-transplant CMV), foscarnet (nephrotoxic, electrolytes), cidofovir — transplant ID only."],
      tips: ["Dose valganciclovir and ganciclovir to the current CrCl and recheck when creatinine changes — underdosing breeds resistance, overdosing causes neutropenia.",
        "Leukopenia on valganciclovir + mycophenolate + TMP-SMX: CMV itself also lowers the white count. Don't stop the antiviral or prophylaxis without transplant/ID input; G-CSF is sometimes used.",
        "Ask about CMV status (D/R) and the date prophylaxis stopped — it's often only in the transplant clinic letter."]
    },
    pjp: {
      name: "Pneumocystis jirovecii pneumonia (PJP)",
      when: ["Classic window 1–6 months after transplant if no prophylaxis.",
        "Risk rises again after rejection treatment (pulse steroids, ATG), during CMV infection, with prolonged lymphopenia (CD4 <200), or when steroids are increased.",
        "Outbreaks of hospital transmission have occurred between transplant patients."],
      risk: ["No prophylaxis in the first 6–12 months.", "Rejection treatment or lymphocyte-depleting therapy in the last 3–6 months.", "CMV infection, high-dose steroids, lymphopenia, older age, low eGFR."],
      symptoms: ["Subacute (days to 2 weeks, often faster than in HIV): dyspnea, dry cough, fever, fatigue.",
        "<b>Hypoxia out of proportion to the exam and chest X-ray</b>; desaturation on walking is an early sign.",
        "Chest exam often near normal. CXR may be normal early or show bilateral interstitial/perihilar opacities.",
        "Pneumothorax can occur."],
      tests: ["<b>CT chest</b>: diffuse ground-glass opacities (may be patchy); cysts later.", "LDH usually raised (non-specific); serum 1,3-β-D-glucan usually high (sensitive, not specific).",
        "<b>Diagnosis</b>: induced sputum or bronchoscopy with BAL — Pneumocystis PCR and/or immunofluorescence. Don't delay treatment for bronchoscopy if strongly suspected (organisms persist for days).",
        "ABG (PaO2, A–a gradient) to grade severity; CMV PCR (co-infection is common)."],
      prevent: ["<b>TMP-SMX</b> 1 single-strength (80/400 mg) daily, or 1 double-strength three times weekly, for at least 6–12 months after transplant (programs vary; KDIGO says 3–6 months minimum), and again for ~6 months after rejection treatment.",
        "Also prevents Toxoplasma, Nocardia and many urinary infections.",
        "If TMP-SMX can't be used (allergy, hyperkalemia, cytopenias): atovaquone 1500 mg PO daily with food; dapsone 100 mg PO daily (check G6PD first); pentamidine 300 mg inhaled monthly (least effective)."],
      treat: ["<b>TMP-SMX</b> 15–20 mg/kg/day of the trimethoprim component, PO or IV, divided q6–8h, usually for 21 days (CrCl 15–30: halve the dose; <15: use with caution and expert input).",
        "<b>Steroids</b> (prednisone 40 mg BID × 5 days, then taper over 21 days) are proven in HIV when PaO2 <70 mmHg or A–a gradient ≥35; in transplant patients evidence is weaker — decide with transplant ID.",
        "Alternatives: primaquine 30 mg daily + clindamycin 600 mg IV q8h (check G6PD); IV pentamidine 4 mg/kg daily (severe; hypoglycemia, pancreatitis, arrhythmia, nephrotoxicity); atovaquone 750 mg BID (mild disease only).",
        "Reduce immunosuppression with the transplant team. Restart prophylaxis after treatment."],
      tips: ["TMP-SMX raises potassium (amiloride-like effect) and serum creatinine (blocks tubular secretion, not a true GFR fall) — especially with tacrolimus or an ACE inhibitor. Check K and creatinine within days.",
        "Marrow suppression adds to mycophenolate and valganciclovir.",
        "Check that PJP prophylaxis was continued on admission — it's often missed during medication reconciliation."]
    },
    bk: {
      name: "BK polyomavirus (BKPyV)",
      when: ["Viruria appears first, then viremia, then BK nephropathy (BKPyVAN), typically 2–12 months after transplant (peak around 3–6 months); most cases in the first 2 years.",
        "Can appear later after increases in immunosuppression (e.g. rejection treatment)."],
      risk: ["Overall immunosuppression (tacrolimus + mycophenolate, ATG, rejection treatment) — the main driver.", "Older recipient, male, ureteric stent, ABO-incompatible or HLA-mismatched graft, donor viruria.", "There is no prophylaxis that works."],
      symptoms: ["<b>Usually no symptoms</b>: the first sign is a slow rise in creatinine without another cause.",
        "Sometimes ureteric stenosis → hydronephrosis and obstruction.",
        "Hemorrhagic cystitis (hematuria, dysuria) is rare in kidney transplant (common after stem cell transplant).",
        "Can mimic acute rejection on biopsy (interstitial inflammation)."],
      tests: ["<b>Screening: plasma BK PCR monthly until month 9, then every 3 months until 2 years</b> (AST 2019; programs vary), and whenever creatinine rises unexplained.",
        "Plasma BK DNA ≥10,000 copies/mL (≥4 log) for 2–3 weeks = presumptive BK nephropathy; lower levels = possible.",
        "Kidney biopsy (SV40 stain) confirms BK nephropathy and looks for concurrent rejection — decided by the transplant team.",
        "Urinalysis (decoy cells), ultrasound for hydronephrosis, tacrolimus level."],
      prevent: ["No effective antiviral prophylaxis (fluoroquinolones don't prevent it).", "Prevention = regular plasma BK PCR screening and early reduction of immunosuppression."],
      treat: ["<b>Reduce immunosuppression</b> (transplant team only) — the only proven treatment. Common sequence: reduce or stop mycophenolate (or azathioprine) first, then lower the tacrolimus target; some switch to an mTOR inhibitor.",
        "Repeat plasma BK PCR every 2–4 weeks until clearing; watch creatinine and for rejection, which can follow immunosuppression reduction.",
        "No proven antiviral: cidofovir, leflunomide, IVIG and quinolones have weak or no evidence — specialist use only."],
      tips: ["Unexplained creatinine rise in a transplant patient in the first 2 years: send plasma BK PCR along with a tacrolimus level, urinalysis and ultrasound.",
        "Don't reduce immunosuppression yourself — call the transplant team.",
        "BK can coexist with CMV and rejection; one doesn't exclude the others."]
    }
  };

  /* --------------------------------------------------------------- kidney dosing */
  function crcl(age, sex, wt, crUmol) { if (!age || !wt || !crUmol) return null; return Math.round(((140 - age) * wt * 1.23) / crUmol * (sex === "female" ? 0.85 : 1)); }
  function valganDose(c, mode) {
    if (c == null) return null;
    if (mode === "treat") return c >= 60 ? "900 mg PO BID" : c >= 40 ? "450 mg PO BID" : c >= 25 ? "450 mg PO daily" : c >= 10 ? "450 mg PO every 2 days" : "not recommended — use IV ganciclovir";
    return c >= 60 ? "900 mg PO daily" : c >= 40 ? "450 mg PO daily" : c >= 25 ? "450 mg PO every 2 days" : c >= 10 ? "450 mg PO twice weekly" : "not recommended";
  }
  function ganDose(c) { if (c == null) return null; return c >= 70 ? "5 mg/kg IV q12h" : c >= 50 ? "2.5 mg/kg IV q12h" : c >= 25 ? "2.5 mg/kg IV q24h" : c >= 10 ? "1.25 mg/kg IV q24h" : "1.25 mg/kg IV 3×/week after dialysis"; }
  const VALGAN_MAX_MG_DAY = (c, mode) => c == null ? null : mode === "treat" ? (c >= 60 ? 1800 : c >= 40 ? 900 : c >= 25 ? 450 : c >= 10 ? 225 : 0) : (c >= 60 ? 900 : c >= 40 ? 450 : c >= 25 ? 225 : c >= 10 ? 130 : 0);
  function doseTable(c) {
    const row = (lo, hi, a, b, g) => `<tr${c != null && c >= lo && c < hi ? ' style="font-weight:700"' : ""}><td>${hi === 999 ? "≥" + lo : lo + "–" + (hi - 1)}</td><td>${a}</td><td>${b}</td><td>${g}</td></tr>`;
    return `<div class="scroll"><table><tr><th>CrCl (mL/min)</th><th>Valganciclovir treatment</th><th>Valganciclovir prophylaxis</th><th>Ganciclovir IV treatment</th></tr>
      ${row(70, 999, "900 mg BID", "900 mg daily", "5 mg/kg q12h")}${row(60, 70, "900 mg BID", "900 mg daily", "2.5 mg/kg q12h")}${row(50, 60, "450 mg BID", "450 mg daily", "2.5 mg/kg q12h")}
      ${row(40, 50, "450 mg BID", "450 mg daily", "2.5 mg/kg q24h")}${row(25, 40, "450 mg daily", "450 mg every 2 days", "2.5 mg/kg q24h")}${row(10, 25, "450 mg every 2 days", "450 mg twice weekly", "1.25 mg/kg q24h")}
      ${row(0, 10, "use IV ganciclovir", "not recommended", "1.25 mg/kg 3×/week after HD")}</table></div>
      <div class="src">From product monographs (Cockcroft–Gault CrCl). ${c != null ? "Bold row = this patient's estimated CrCl " + c + " mL/min." : "Enter weight above to estimate CrCl."} TMP-SMX: CrCl 15–30 → half dose; &lt;15 → expert input.</div>`;
  }

  /* --------------------------------------------------------------- chart facts */
  function facts(raw, f) {
    const now = f.now, meds = f.meds || [];
    const cur = (re) => meds.filter((m) => re.test(m.name) && (m.kind === "order" ? m.current : now - m.t < 3 * DAY)).map((m) => m.name);
    const ever = (re, days) => meds.filter((m) => re.test(m.name) && ((m.kind === "given" && now - m.t < days * DAY) || (m.kind === "order" && (m.current || (m.stop && now - m.stop < days * DAY) || (m.start && now - m.start < days * DAY))))).map((m) => m.name);
    const F = {};
    F.valgan = cur(/valganciclovir|valcyte|\bganciclovir|cytovene/i); F.letermovir = cur(/letermovir|prevymis/i);
    F.tmpsmx = cur(/sulfamethoxazole|trimethoprim|septra|bactrim|co-?trimoxazole|TMP-?SMX/i); F.pjpAlt = cur(/atovaquone|dapsone|pentamidine/i);
    F.pjpStopped = meds.filter((m) => m.kind === "order" && !m.current && /sulfamethoxazole|trimethoprim|septra|bactrim|atovaquone|dapsone|pentamidine/i.test(m.name)).map((m) => m.name + (m.stop ? " (stopped " + fmtD(m.stop) + ")" : ""));
    F.depl = ever(/thymoglobulin|anti-?thymocyte|\bATG\b|alemtuzumab|campath|rituximab/i, 180)
      .concat(ever(/methylprednisolone\D{0,20}(?:250|500|1000)\s*mg|solu-?medrol\D{0,20}(?:250|500|1000)/i, 180));
    F.mmf = cur(/mycophenol|cellcept|myfortic|azathioprine/i);
    // labs not parsed by the engine: CMV / BK PCR, LDH, beta-D-glucan
    const obs = (raw.obs || []).filter((o) => o && o.resourceType === "Observation" && !/entered-in-error|cancelled/.test(o.status || ""));
    const pick = (re, not) => obs.map((o) => {
      const name = label(o.code); if (!re.test(name) || (not && not.test(name))) return null;
      const t = Date.parse(o.effectiveDateTime || o.issued || ""); if (isNaN(t)) return null;
      let v = o.valueQuantity && typeof o.valueQuantity.value === "number" ? o.valueQuantity.value : null, txt = o.valueString || label(o.valueCodeableConcept) || "";
      if (v == null && /not detected|negative|undetect|<\s*\d/i.test(txt)) v = 0;
      if (v == null) { const m = txt.replace(/,/g, "").match(/(\d+(?:\.\d+)?)/); if (m) v = +m[1]; }
      const high = o.referenceRange && o.referenceRange[0] && o.referenceRange[0].high ? o.referenceRange[0].high.value : null;
      return { t, v, unit: (o.valueQuantity && o.valueQuantity.unit) || "", txt, name, high };
    }).filter(Boolean).sort((a, b) => a.t - b.t);
    F.cmvPcr = pick(/cytomegalo|\bCMV\b/i, /igg|igm|antibod|serolog|avidity/i);
    F.bkPcr = pick(/\bBK\b|BKV|BKPyV|polyoma/i, /urine|urin/i);
    F.ldh = pick(/lactate dehydrogenase|\bLDH\b/i);
    F.bdg = pick(/glucan|fungitell/i);
    const crs = (f.labs.creatinine || []);
    F.crLatest = crs.length ? crs[crs.length - 1] : null;
    const base = crs.filter((x) => now - x.t > 3 * DAY && now - x.t < 90 * DAY);
    F.crBase = base.length ? Math.min(...base.map((x) => x.v)) : (crs.length > 1 ? Math.min(...crs.slice(0, -1).map((x) => x.v)) : null);
    F.crRise = F.crLatest && F.crBase ? (F.crLatest.v - F.crBase) / F.crBase : null;
    const w = f.labs.wbc || [], n = f.labs.neutrophils || [];
    F.wbc = w.length ? w[w.length - 1].v : null; F.anc = n.length ? n[n.length - 1].v : null;
    // problems
    const P = (f.problems || []).join(" | ");
    F.prob = { cmv: /cytomegalo|\bCMV\b/i.test(P), bk: /\bBK\b|polyoma/i.test(P), pjp: /pneumocystis|\bPJP\b|\bPCP\b/i.test(P), rejection: /rejection/i.test(P),
      resp: /pneumonia|hypox|dyspn|respiratory|pneumonitis|interstitial/i.test(P), gi: /diarrh|colitis|gastroenteritis|esophagitis/i.test(P), fever: /fever|febrile|pyrexia|sepsis/i.test(P),
      hydro: /hydronephrosis|ureter\w* (?:stenosis|stricture|obstruction)/i.test(P), hematuria: /hematuria|cystitis/i.test(P) };
    // transplant date from the problem list (onset)
    const tx = (raw.conditions || []).find((c) => /transplant|Z94\.0/i.test(label(c.code) + " " + JSON.stringify(c.code && c.code.coding || [])));
    F.txDate = tx && (tx.onsetDateTime || (tx.onsetPeriod && tx.onsetPeriod.start)) ? Date.parse(tx.onsetDateTime || tx.onsetPeriod.start) : null;
    return F;
  }

  /* --------------------------------------------------------------- patient checks */
  function checks(f, F, inp) {
    const A = [], add = (sev, title, msg) => A.push({ sev, title, msg });
    const txT = inp.txDate ? Date.parse(inp.txDate) : null, m = txT ? (f.now - txT) / MONTH : null;
    const cl = crcl(f.age, f.sex, inp.wt ? +inp.wt : null, F.crLatest ? F.crLatest.v : null);
    const sym = inp.sym || {}, pick = (k, p) => (k in sym ? !!sym[k] : !!p), fever = pick("fever", F.prob.fever), gi = pick("gi", F.prob.gi), resp = pick("resp", F.prob.resp);
    const depl = inp.depl || F.depl.length > 0 || F.prob.rejection;
    const lowWbc = (F.wbc != null && F.wbc < 3.5) || (F.anc != null && F.anc < 1.5);
    const last = (arr) => arr.length ? arr[arr.length - 1] : null;
    const recent = (arr, days) => arr.filter((x) => f.now - x.t < days * DAY);
    // ---- CMV
    const cmv = last(F.cmvPcr), cmvPrev = F.cmvPcr.length > 1 ? F.cmvPcr[F.cmvPcr.length - 2] : null;
    if (cmv && cmv.v > 0) {
      const rising = cmvPrev && cmvPrev.v > 0 && cmv.v / cmvPrev.v >= 3, high = cmv.v >= 50000;
      add(high || rising || fever || gi ? "critical" : "major", `CMV DNAemia ${fmtN(cmv.v)} ${cmv.unit || "IU/mL"} (${fmtD(cmv.t)})${rising ? " — rising >3× (>0.5 log)" : ""}`,
        `${fever || gi || resp || lowWbc ? "With fever/GI/respiratory symptoms or low WBC this may be CMV disease. " : ""}Treat per the transplant program: valganciclovir ${valganDose(cl, "treat") || "900 mg BID (adjust for CrCl)"}${high || gi ? ", or IV ganciclovir " + (ganDose(cl) || "5 mg/kg q12h (adjust)") + " if severe, very high load or GI absorption doubtful" : ""}. Weekly CMV PCR, CBC twice weekly; ask transplant about reducing mycophenolate. GI symptoms: consider endoscopy with biopsy.`);
    } else if (F.prob.cmv && !recent(F.cmvPcr, 14).length)
      add("major", "CMV on the problem list — no CMV PCR in the last 14 days", "Send plasma CMV quantitative PCR (weekly during treatment, same lab each time) and check the antiviral dose against CrCl.");
    else if ((fever || gi || lowWbc || (resp && (depl || (m != null && m < 12)))) && !recent(F.cmvPcr, 14).length && (m == null || m < 24 || depl))
      add("major", "Possible CMV — no CMV PCR in the last 14 days", `${[fever && "fever", gi && "diarrhea/GI symptoms", resp && "respiratory symptoms", lowWbc && "low WBC/neutrophils"].filter(Boolean).join(", ")}${m != null ? ` at ${Math.round(m)} months post-transplant` : ""}${depl ? " after ATG/rejection treatment" : ""}: send plasma CMV quantitative PCR.`);
    if (cmv && cmv.v === 0 && F.cmvPcr.length) add("info", `Last CMV PCR not detected (${fmtD(cmv.t)})`, "A negative test doesn't exclude CMV GI disease — biopsy if colitis is suspected.");
    if (inp.sero === "D+/R-" && m != null && m >= 2 && m <= 12 && !F.valgan.length && !F.letermovir.length)
      add("major", "CMV D+/R− without current prophylaxis", `${Math.round(m)} months post-transplant: this is the highest-risk window for late-onset CMV (3–6 months after prophylaxis stops). Low threshold for CMV PCR; check the program's post-prophylaxis monitoring plan.`);
    if (depl && !F.valgan.length && !F.letermovir.length && inp.sero !== "D-/R-")
      add("major", "Recent ATG or rejection treatment without CMV prophylaxis", `${F.depl.length ? F.depl.join("; ") : "Rejection on the problem list"}: most programs restart CMV prophylaxis (or weekly PCR) for ~3 months after lymphocyte-depleting or pulse-steroid treatment — confirm with transplant.`);
    F.valgan.forEach((name) => {
      const mg = +((name.match(/(\d+)\s*mg/i) || [])[1] || 0), bid = /\bBID\b|q12h|twice daily/i.test(name), qod = /every (?:2|other) days?|q48h|\bQOD\b/i.test(name), tiw = /twice weekly|twice a week|2x\/week/i.test(name);
      if (!mg || !/valgan|valcyte/i.test(name)) return;
      const perDay = mg * (bid ? 2 : qod ? 0.5 : tiw ? 2 / 7 : 1), treating = (cmv && cmv.v > 0) || F.prob.cmv || perDay > 900;
      const mx = VALGAN_MAX_MG_DAY(cl, treating ? "treat" : "proph");
      if (cl == null) add("info", `Valganciclovir ordered (${name})`, `Enter weight to check the dose against CrCl. ${treating ? "Treatment" : "Prophylaxis"} dosing is kidney-adjusted (table below).`);
      else if (perDay > mx * 1.05) add("major", `Valganciclovir dose high for CrCl ${cl}`, `${name} ≈ ${fmtN(perDay)} mg/day. ${treating ? "Treatment" : "Prophylaxis"} dose for CrCl ${cl}: ${valganDose(cl, treating ? "treat" : "proph")} — neutropenia risk. Confirm with pharmacy/transplant.`);
      else if (treating && perDay < mx * 0.6) add("major", `Valganciclovir may be underdosed for treatment (CrCl ${cl})`, `${name} ≈ ${fmtN(perDay)} mg/day; treatment dose for CrCl ${cl}: ${valganDose(cl, "treat")}. Underdosing promotes resistance.`);
    });
    if (F.valgan.length && lowWbc) add("major", `Low WBC/neutrophils on valganciclovir${F.mmf.length ? " + mycophenolate" : ""}${F.tmpsmx.length ? " + TMP-SMX" : ""}`, `WBC ${F.wbc ?? "?"}${F.anc != null ? ", ANC " + F.anc : ""}. Check the valganciclovir dose for CrCl and CMV PCR (CMV itself causes leukopenia). Changes to antivirals, mycophenolate or prophylaxis: transplant/ID decision.`);
    if (F.letermovir.length) add("info", "On letermovir (prophylaxis only)", "No activity for treating CMV disease or DNAemia above threshold; raises tacrolimus/cyclosporine levels — see interactions above.");
    // ---- PJP
    const pjpOn = F.tmpsmx.length || F.pjpAlt.length, ldh = last(F.ldh), bdg = last(F.bdg);
    if (resp && (!pjpOn || depl || (m != null && m < 12)))
      add(pjpOn ? "major" : "critical", `Respiratory symptoms${pjpOn ? "" : " without PJP prophylaxis"} — consider PJP`, `Hypoxia out of proportion to the exam/CXR is typical. CT chest (ground glass), LDH${ldh ? ` (last ${fmtN(ldh.v)})` : ""}, β-D-glucan${bdg ? ` (last ${fmtN(bdg.v)})` : ""}, induced sputum or BAL for Pneumocystis PCR, CMV PCR. If strongly suspected, start TMP-SMX 15–20 mg/kg/day (TMP) divided q6–8h${cl != null && cl < 30 ? ` — CrCl ${cl}: halve the dose` : ""} without waiting for bronchoscopy; involve transplant ID.`);
    if (!pjpOn && ((m != null && m < 12) || depl || (cmv && cmv.v > 0)))
      add("major", "No PJP prophylaxis found", `${m != null && m < 12 ? `${Math.round(m)} months post-transplant (most programs give 6–12 months). ` : ""}${depl ? "Recent ATG/rejection treatment (restart for ~6 months). " : ""}${cmv && cmv.v > 0 ? "Active CMV raises PJP risk. " : ""}${F.pjpStopped.length ? "Previously ordered: " + F.pjpStopped.join("; ") + ". " : ""}Check whether it was missed at admission reconciliation: TMP-SMX SS daily or DS three times weekly; if not tolerated, atovaquone 1500 mg daily or dapsone 100 mg daily (check G6PD).`);
    if (ldh && ldh.v > (ldh.high || 250) && resp) add("info", `LDH ${fmtN(ldh.v)} (${fmtD(ldh.t)})`, "Raised LDH supports PJP in a hypoxic transplant patient but is non-specific.");
    if (F.tmpsmx.length && F.crRise != null && F.crRise >= 0.15) add("info", "TMP-SMX and rising creatinine", "Trimethoprim blocks creatinine secretion (raises creatinine without a true GFR fall) and raises potassium — but don't assume that's the whole story: check K, volume status, tacrolimus level and BK.");
    // ---- BK
    const bk = last(F.bkPcr);
    if (bk && bk.v > 0) add(bk.v >= 10000 ? "critical" : "major", `BK viremia ${fmtN(bk.v)} ${bk.unit || "copies/mL"} (${fmtD(bk.t)})`,
      bk.v >= 10000 ? "≥10,000 copies/mL: presumptive BK nephropathy. Transplant team to reduce immunosuppression (usually mycophenolate first, then lower tacrolimus target) and decide on biopsy (also excludes rejection). Repeat plasma BK PCR every 2–4 weeks."
        : "Low-level viremia: repeat plasma BK PCR in 2–4 weeks; inform the transplant team (they may lower immunosuppression).");
    if (F.crRise != null && F.crRise >= 0.25 && (m == null || m < 24))
      add("major", `Creatinine up ${Math.round(F.crRise * 100)}% from baseline${m != null ? ` at ${Math.round(m)} months post-transplant` : ""}`, `Check volume/obstruction and drug causes, plus: tacrolimus level, urinalysis, graft ultrasound${recent(F.bkPcr, 30).length ? "" : ", <b>plasma BK PCR</b> (none in the last 30 days)"}${F.prob.hydro ? "; hydronephrosis/ureteric stenosis can be BK ureteritis" : ""}. Rejection vs BK needs the transplant team (often biopsy).`);
    if (m != null && m < 24 && !(bk && bk.v > 0) && !recent(F.bkPcr, m < 9 ? 45 : 100).length)
      add("info", "BK screening may be due", `${Math.round(m)} months post-transplant; no plasma BK PCR found in the expected interval (AST 2019: monthly to month 9, then every 3 months to 2 years — check the program schedule).`);
    if (pick("hematuria", F.prob.hematuria)) add("info", "Hematuria / dysuria", "Rule out UTI and stones first. BK hemorrhagic cystitis is rare after kidney transplant (common after stem cell transplant); check plasma BK PCR if unexplained.");
    return { A, m, cl, F };
  }

  /* --------------------------------------------------------------- render */
  function phaseText(m) {
    if (m == null) return "Enter the transplant date to see the risk window.";
    if (m < 1) return "First month: mostly surgical-site, line and hospital infections; CMV and PJP are uncommon this early on prophylaxis.";
    if (m < 6) return "1–6 months: peak window for opportunistic infections — CMV (if no prophylaxis), PJP (if no prophylaxis), BK viremia/nephropathy.";
    if (m < 12) return "6–12 months: late-onset CMV after prophylaxis stops; BK nephropathy still common; PJP risk falls once 6–12 months of prophylaxis is complete.";
    if (m < 24) return "1–2 years: mostly community infections; BK can still appear; CMV/PJP return after rejection treatment or heavier immunosuppression.";
    return ">2 years: mostly community infections; CMV and PJP mainly after rejection treatment, lymphopenia or heavy immunosuppression.";
  }
  const SYM = [["fever", "Fever"], ["gi", "Diarrhea / GI symptoms"], ["resp", "Dyspnea, dry cough or hypoxia"], ["vision", "Visual change"], ["hematuria", "Hematuria / dysuria"]];
  const SEV = { critical: "Act now", major: "Act", moderate: "Monitor", info: "Note" };

  function render(el, sumEl, state) {
    if (!state.f || !state.raw) { el.innerHTML = '<div class="muted">No patient loaded.</div>'; sumEl.textContent = ""; return; }
    const inp = state.infx || (state.infx = {}); inp.sym = inp.sym || {};
    const F0 = facts(state.raw, state.f);
    if (inp.txDate == null && F0.txDate) { inp.txDate = new Date(F0.txDate).toISOString().slice(0, 10); inp.txFromChart = true; }
    const { A, m, cl, F } = checks(state.f, F0, inp);
    const urgent = A.filter((a) => a.sev === "critical" || a.sev === "major").length;
    sumEl.textContent = A.length ? `${urgent ? urgent + " to act on · " : ""}${A.length} item${A.length > 1 ? "s" : ""}` : "nothing flagged";
    const pcrRow = (lab, arr) => arr.length ? arr.slice(-3).reverse().map((x) => `${x.v > 0 ? "<b>" + fmtN(x.v) + "</b> " + esc(x.unit) : "not detected"} <span class="muted">${fmtD(x.t)}</span>`).join(" · ") : '<span class="muted">none found (90 days)</span>';
    const sec = (k, title, items) => `<h3>${title}</h3><ul class="tight">${items.map((i) => "<li>" + i + "</li>").join("")}</ul>`;
    const ref = (id) => { const d = KB[id]; return `<details class="card" style="margin:8px 0" data-ix="${id}"><summary><span>${esc(d.name)}</span><span class="muted">when · symptoms · tests · prevention · treatment</span></summary><div class="body">
      ${sec(id, "When it occurs", d.when)}${sec(id, "Who is at risk", d.risk)}${sec(id, "Symptoms and signs", d.symptoms)}${sec(id, "Tests", d.tests)}${sec(id, "Prevention", d.prevent)}${sec(id, "Treatment", d.treat)}
      ${id === "cmv" ? "<h3>Kidney dosing</h3>" + doseTable(cl) : ""}${sec(id, "On the ward", d.tips)}</div></details>`; };
    const open = {}; el.querySelectorAll("details[data-ix]").forEach((d) => (open[d.dataset.ix] = d.open));
    el.innerHTML = `<div class="row">
        <label class="inl">Transplant date <input type="date" id="ix-tx" value="${esc(inp.txDate || "")}">${inp.txFromChart ? ' <span class="muted">(problem list – confirm)</span>' : ""}</label>
        <label class="inl">CMV status <select id="ix-sero">${["", "D+/R-", "R+", "D-/R-"].map((v) => `<option value="${v}"${(inp.sero || "") === v ? " selected" : ""}>${v ? v.replace("-", "−") : "unknown"}</option>`).join("")}</select></label>
        <label class="inl">Weight <input type="number" id="ix-wt" min="20" max="250" value="${esc(inp.wt || "")}"> kg</label>
        <span class="muted">${cl != null ? "CrCl ≈ " + cl + " mL/min" : F.crLatest ? "enter weight for CrCl" : "no creatinine"}</span></div>
      <div class="row"><b>Symptoms:</b> ${SYM.map(([k, l]) => { const pr = { fever: F.prob.fever, gi: F.prob.gi, resp: F.prob.resp, hematuria: F.prob.hematuria }[k]; const on = k in inp.sym ? inp.sym[k] : !!pr;
          return `<label class="inl"><input type="checkbox" data-ixs="${k}"${on ? " checked" : ""}> ${l}${pr ? ' <span class="muted">(problem list)</span>' : ""}</label>`; }).join(" ")}
        <label class="inl"><input type="checkbox" id="ix-depl"${inp.depl || F.depl.length || F.prob.rejection ? " checked" : ""}${F.depl.length || F.prob.rejection ? " disabled" : ""}> ATG / rejection treatment in last 6 months${F.depl.length ? ' <span class="muted">(chart: ' + esc(F.depl[0]) + ")</span>" : F.prob.rejection ? ' <span class="muted">(rejection on problem list)</span>' : ""}</label></div>
      <div class="banner" style="margin:6px 0"><b>${m != null ? Math.round(m * 10) / 10 + " months post-transplant." : "Time since transplant unknown."}</b> ${esc(phaseText(m))}</div>
      <div class="scroll"><table><tr><th>From the chart</th><th></th></tr>
        <tr><td>CMV prophylaxis / treatment</td><td>${F.valgan.concat(F.letermovir).map(esc).join("<br>") || '<span class="muted">none found</span>'}</td></tr>
        <tr><td>PJP prophylaxis</td><td>${F.tmpsmx.concat(F.pjpAlt).map(esc).join("<br>") || '<span class="muted">none found</span>' + (F.pjpStopped.length ? '<div class="muted">stopped: ' + esc(F.pjpStopped.join("; ")) + "</div>" : "")}</td></tr>
        <tr><td>CMV PCR (plasma)</td><td>${pcrRow("cmv", F.cmvPcr)}</td></tr>
        <tr><td>BK PCR (plasma)</td><td>${pcrRow("bk", F.bkPcr)}</td></tr>
        <tr><td>WBC / ANC · LDH</td><td>${F.wbc != null ? "WBC " + F.wbc : "WBC ?"}${F.anc != null ? " · ANC " + F.anc : ""}${F.ldh.length ? " · LDH " + fmtN(F.ldh[F.ldh.length - 1].v) : ""}</td></tr>
        <tr><td>Creatinine</td><td>${F.crLatest ? Math.round(F.crLatest.v) + " umol/L" + (F.crBase ? ` (baseline ${Math.round(F.crBase)}${F.crRise != null ? ", " + (F.crRise >= 0 ? "+" : "") + Math.round(F.crRise * 100) + "%" : ""})` : "") : '<span class="muted">not found</span>'}</td></tr>
      </table></div>
      <h3>For this patient</h3>
      ${A.length ? A.map((x) => `<div class="alert ${x.sev}"><div class="h"><span class="sev">${SEV[x.sev]}</span>${x.title}</div><div class="act">${x.msg}</div></div>`).join("") : '<div class="muted">Nothing flagged for CMV, PJP or BK from the chart and the boxes above.</div>'}
      <h3>Reference</h3>${ref("cmv")}${ref("pjp")}${ref("bk")}
      <div class="src">Unverified draft from AST IDCOP 2019 guidelines (CMV, PJP, BK), the Third International Consensus on CMV in SOT and product monographs. Thresholds and durations vary between programs — follow the transplant program's protocol.</div>`;
    el.querySelectorAll("details[data-ix]").forEach((d) => { if (open[d.dataset.ix]) d.open = true; });
    const again = () => render(el, sumEl, state);
    el.querySelector("#ix-tx").onchange = (e) => { inp.txDate = e.target.value; inp.txFromChart = false; again(); };
    el.querySelector("#ix-sero").onchange = (e) => { inp.sero = e.target.value; again(); };
    el.querySelector("#ix-wt").onchange = (e) => { inp.wt = e.target.value; again(); };
    el.querySelectorAll("[data-ixs]").forEach((cb) => (cb.onchange = () => { inp.sym[cb.dataset.ixs] = cb.checked; again(); }));
    const dp = el.querySelector("#ix-depl"); if (!dp.disabled) dp.onchange = () => { inp.depl = dp.checked; again(); };
  }

  window.TxInfx = { render, facts, checks, KB, valganDose, ganDose, crcl };
})();
