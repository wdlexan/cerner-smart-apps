/* Asplenia page. Read-only from the chart; your entries stay in this page. UNVERIFIED draft. */
const R = window.AspleniaRules, C = window.AspleniaChart, DAY = C.DAY, HR = C.HR, YEAR = R.YEAR;
const $ = (id) => document.getElementById(id);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const ul = (a) => "<ul>" + a.filter(Boolean).map((t) => "<li>" + t + "</li>").join("") + "</ul>";
const num = (id) => { const v = parseFloat($(id).value); return isFinite(v) ? v : null; };
const fmtD = R.fmtD;
const first = (t) => String(t).split(/\.\s/)[0].replace(/\.$/, "");
const state = { f: null, added: [], pasted: [], x: null };
const has = (k) => !!(state.f && state.f.cls[k] && state.f.cls[k].length);
const prob = (k) => !!(state.f && state.f.prob[k]);
const alertBox = (lvl, t) => `<div class="alert ${lvl}"><b>${lvl === "urgent" ? "Now" : lvl === "action" ? "Do" : "Note"}</b>${t}</div>`;

/* ---------- facts ---------- */
function facts() {
  const f = state.f, now = Date.now();
  const L = (src, id, days) => (f ? C.latest(f[src][id], days * DAY, now) : null);
  const max24 = (id) => { const a = f && f.v[id] ? f.v[id].filter((x) => now - x.t <= DAY) : []; return a.length ? Math.max(...a.map((x) => x.v)) : null; };
  const min24 = (id) => { const a = f && f.v[id] ? f.v[id].filter((x) => now - x.t <= DAY) : []; return a.length ? Math.min(...a.map((x) => x.v)) : null; };
  const v = { temp: max24("temp"), hr: max24("hr"), sbp: min24("sbp"), dbp: min24("dbp"), rr: max24("rr") };
  const lab = {}; ["wbc", "plt", "hb", "cr", "urea", "lactate", "inr", "crp", "pct"].forEach((k) => { const x = L("l", k, 3); lab[k] = x ? x.v : null; });
  const sDays = num("sDays"), pDays = num("pDays");
  const splenectomyT = sDays != null ? now - sDays * DAY : f ? f.splenectomyT || null : null;
  const plannedT = pDays != null ? now + pDays * DAY : f && f.plannedT && f.plannedT > now ? f.plannedT : null;
  const texts = f ? f.probText.slice() : [];
  if (f && f.partialT) texts.push("Partial splenectomy");
  if (f && f.embolT) texts.push("Splenic artery embolization");
  const smear = $("smear").value || (f ? f.smear : "");
  const sp = R.spleenStatus({ texts, smear: smear === "hj" ? "hj" : "", manual: $("spleen").value, splenectomyT, plannedT });
  const wtL = L("v", "wt", 60), weight = num("wt") != null ? num("wt") : wtL ? Math.round(wtL.v) : null;
  const crcl = num("crcl") != null ? num("crcl") : f ? C.crcl(f.age, f.sex, weight, lab.cr) : null;
  const allergy = $("allergy").value || (f ? f.allergy : "none");
  const fluSel = $("flu").value, flu = fluSel || (f ? f.flu : null);
  const m = new Date().getMonth(), inSeason = m >= 9 || m <= 3;
  const age = f ? f.age : null;
  const imms = (f ? f.imms : []).concat(state.added, state.pasted);
  const vp = R.vaccinePlan(imms, { now, splenectomyT, plannedT, immunoRecent: f ? f.recentImmuno : [] });
  const yearsSince = splenectomyT ? (now - splenectomyT) / YEAR : null;
  const ck = (id) => $(id).checked;
  const pr = R.prophylaxis({ yearsSince, age, priorOPSI: ck("priorOPSI"), immuno: ck("immuno"), heme: ck("heme"), gvhd: ck("gvhd"), sickle: sp.causes.includes("Sickle cell disease"), onProph: has("proph"), allergy });
  const reason = $("reason").value;
  const curb = R.curb65({ confusion: ck("confusion"), urea: lab.urea, rr: v.rr, sbp: v.sbp, dbp: v.dbp, age });
  const shock = ck("shock");
  const abx = R.pneumoniaAbx({ setting: $("setting").value, shock, meningitis: ck("meningitis"), allergy, crcl, weight, mrsa: ck("mrsa"), pseudo: ck("pseudo"), flu: flu === "pos", fluSeason: flu !== "pos" && flu !== "neg" && inSeason, age, immuno: ck("immuno") || ck("heme"), purpura: ck("purpura"), aspiration: ck("aspiration"), dog: ck("dog") });
  const op = R.opsi({ temp: v.temp, hr: v.hr, sbp: v.sbp, lactate: lab.lactate, plt: lab.plt, inr: lab.inr, purpura: ck("purpura"), shock, liver: !!(f && f.probText.some((t) => /cirrho|K70\.3|K74/i.test(t))) });
  const prec = R.precautions({ status: sp.status, sinceDays: splenectomyT ? (now - splenectomyT) / DAY : null, plt: lab.plt, onAnticoag: has("anticoag"), onVteProph: has("vteProph"), dogExposure: ck("dog"), tickTravel: ck("tick"), travelPlanned: ck("travel"), eculizumab: has("eculizumab"), allergy, onProph: has("proph") });
  return { f, now, v, lab, sp, splenectomyT, plannedT, weight, crcl, allergy, flu, inSeason, age, vp, pr, reason, curb, abx, op, prec, yearsSince, shock, imms };
}

/* ---------- static reference ---------- */
const OTHER_INF = [
  ["Pneumococcus (most OPSI)", "Pneumonia, bacteremia, meningitis, purpura fulminans", "Ceftriaxone 2 g IV (+ vancomycin if shock or meningitis until susceptibilities)"],
  ["Meningococcus", "Meningococcemia, meningitis, petechiae / purpura", "Ceftriaxone 2 g IV q12h; droplet precautions for 24 h; public health for contact prophylaxis"],
  ["H. influenzae type b", "Pneumonia, epiglottitis, meningitis", "Ceftriaxone"],
  ["Capnocytophaga canimorsus", "Sepsis, DIC, gangrene 1-7 days after a dog (or cat) bite, lick or scratch", "Bite prophylaxis: amoxicillin-clavulanate 3-5 days. Sepsis: piperacillin-tazobactam or a carbapenem (ceftriaxone also active); tell the lab about the dog exposure"],
  ["Babesia (B. microti, B. divergens)", "Fever, hemolysis, high parasitemia after tick exposure (NE / upper-midwest US, Europe)", "Thick/thin smear and PCR; atovaquone + azithromycin, severe: ID / exchange transfusion"],
  ["Plasmodium falciparum malaria", "More severe, higher parasitemia, after travel", "Smear x3 / RDT; severe: IV artesunate (ID, Canadian Malaria Network)"],
  ["Salmonella, E. coli, Klebsiella", "Bacteremia (sickle cell: Salmonella osteomyelitis)", "Per site and local resistance"],
  ["Influenza", "Often the trigger for secondary bacterial pneumonia", "Oseltamivir, vaccinate every year"]];
const VX_REF = [
  ["Pneumococcal conjugate (PCV20 Prevnar 20, or PCV21 Capvaxive)", "1 dose", "None at this time (BC / NACI)", "If PPV23 already given: 1 year after it. At least 8 weeks after PCV13/15. Funded in BC for asplenia."],
  ["Meningococcal ACWY conjugate (Menveo, MenQuadfi, Nimenrix)", "2 doses, at least 8 weeks apart", "Every 5 years for life (every 3-5 years if first dose before age 7)", "Men-C alone does not count."],
  ["Meningococcal B (Bexsero or Trumenba)", "Bexsero 2 doses at least 4 weeks apart; Trumenba 3 doses at 0, 1-2, 6 months", "Canada: not yet set. US ACIP: 1 year after the series, then every 2-3 years", "Brands are not interchangeable."],
  ["Hib conjugate (Act-HIB)", "1 dose if never given", "None", ""],
  ["Influenza (inactivated)", "1 dose", "Every fall", "Household contacts too."],
  ["COVID-19", "Per current BC schedule", "Per current BC schedule", "Asplenia alone is not an immunocompromising condition for COVID-19 vaccine."],
  ["Routine adult vaccines (Tdap/Td, MMR, varicella, zoster age 50+, hepatitis B, HPV)", "As for everyone", "As for everyone", "Live vaccines are fine with asplenia alone."],
  ["Timing", "Elective splenectomy: at least 2 weeks before. Emergency: 14 days after (before discharge if follow-up is uncertain).", "", "Chemo: 2 weeks before or 3 months after; anti-CD20: 6 months after (repeat doses given inside the window)."]];
const CAUSES = [
  ["Surgical", "Splenectomy (trauma, ITP, hemolytic anemia, lymphoma, cysts), congenital asplenia / heterotaxy", "Anatomic asplenia"],
  ["Hematologic", "Sickle cell disease (HbSS, HbSC, Sβ-thalassemia), thalassemia major, splenic infarcts, myelofibrosis, amyloidosis", "Sickle cell: functional asplenia in most adults with HbSS"],
  ["GI / liver", "Celiac disease, IBD (especially ulcerative colitis), alcohol-related liver disease and cirrhosis, Whipple disease", "Check smear"],
  ["Autoimmune", "SLE, rheumatoid arthritis, Sjogren, vasculitis, sarcoidosis", "Check smear"],
  ["Iatrogenic", "Splenic irradiation, splenic artery embolization, high-dose steroids, allogeneic HSCT / chronic GVHD, partial splenectomy", "Treat as hyposplenic"],
  ["Vascular", "Splenic artery or vein thrombosis, extensive infarction", ""],
  ["How to confirm", "Howell-Jolly bodies or pitted red cells (above 4%) on the smear; spleen size on imaging does not show function", "A small spleen on CT supports it"]];

/* ---------- draw ---------- */
function chip(status) { const lab = { done: "Done", due: "Due now", later: "Later", check: "Check" }[status] || status; return `<span class="st-${status}">${lab}</span>`; }
function draw() {
  const x = facts(); state.x = x;
  const { f, sp, vp, pr, abx, op, curb } = x;
  const pna = x.reason === "pneumonia" || x.reason === "sepsis";
  $("ptsum").textContent = f ? [f.age != null ? f.age + " y" : "", f.sex, x.weight ? x.weight + " kg" : "", x.crcl != null ? "CrCl " + x.crcl : ""].filter(Boolean).join(" · ") : "";

  // tiles
  const T = [];
  T.push([sp.atRisk ? "t3" : sp.status === "possible" ? "t2" : "t0", "Spleen", sp.label.split(":")[0], x.splenectomyT ? "splenectomy " + fmtD(x.splenectomyT) : sp.causes.length ? sp.causes.join(", ") : sp.why[0] || ""]);
  if (pna) T.push([op.lvl === "urgent" ? "t3" : op.lvl === "action" ? "t2" : "t1", "Sepsis / OPSI", op.lvl === "urgent" ? "Possible OPSI" : op.signs.length ? op.signs.length + " sign" + (op.signs.length > 1 ? "s" : "") : "No sepsis signs", op.signs.join(", ")]);
  if (pna) T.push([abx.severe ? "t3" : "t1", "Pneumonia antibiotic", abx.headline, first(curb.text)]);
  T.push([vp.due.length ? "t2" : "t0", "Vaccines", vp.due.length ? vp.due.length + " due now" : "None due now", vp.due.map((d) => d.name).join(", ") || (vp.later.length ? "next: " + vp.later.map((d) => d.name + " " + fmtD(d.next)).join(", ") : "")]);
  T.push([pr.daily && !has("proph") ? "t2" : "t1", "Prophylaxis", pr.label, pr.reasons.join("; ")]);
  T.push([x.allergy === "none" ? "t0" : x.allergy === "low" ? "t1" : "t2", "Beta-lactam allergy", { none: "None", low: "Low risk", immediate: "Immediate", scar: "Severe delayed" }[x.allergy], f ? f.allergyText : ""]);
  $("tiles").innerHTML = T.map(([c, k, big, s]) => `<div class="tile ${c}"><div class="k">${esc(k)}</div><div class="big">${esc(big)}</div><div class="s">${esc(s)}</div></div>`).join("");

  // chart alerts
  const A = [];
  if (pna && op.lvl === "urgent") A.push(["urgent", op.text]);
  if (has("eculizumab")) A.push(["urgent", "On a complement inhibitor (" + esc(f.cls.eculizumab[0]) + "): very high meningococcal risk on top of asplenia."]);
  if (pna && sp.atRisk) {
    const ctx = f ? f.cls.abx.filter((a) => /ceftriaxone\s*1\s*g/i.test(a)) : [];
    if (ctx.length) A.push(["action", `Ceftriaxone 1 g ordered (${esc(ctx[0])}): use 2 g in an asplenic patient${x.op.lvl === "urgent" || x.shock ? " and add vancomycin" : ""}.`]);
    const mono = f ? f.cls.abx.filter((a) => /azithromycin|clarithromycin|doxycycline/i.test(a)) : [];
    if (mono.length && f.cls.abx.length === mono.length) A.push(["action", "Only a macrolide / doxycycline is ordered: add a beta-lactam (pneumococcal resistance)."]);
    if (f && !f.cls.abx.length) A.push(["action", "No antibiotic found in the orders: blood cultures and the first dose within 1 hour."]);
    if (x.allergy === "scar" && f && f.cls.abx.some((a) => /cef|penicillin|amoxicillin|ampicillin|piperacillin|meropenem|ertapenem/i.test(a))) A.push(["urgent", "Beta-lactam ordered with a severe delayed (SJS/TEN/DRESS) allergy on file: check before giving."]);
  }
  if (f && f.immsError) A.push(["info", "Could not read immunizations (" + esc(f.immsError) + "). Add patient/Immunization.read to the Code Console scopes, or paste the CareConnect record on the Vaccines tab."]);
  else if (f && !f.imms.length && !state.pasted.length && !state.added.length) A.push(["info", "No vaccines found in Cerner: check CareConnect / the provincial record and paste it on the Vaccines tab before deciding."]);
  if (sp.status === "possible") A.push(["action", `Possible hyposplenia (${esc(sp.possible.join(", "))}): order a blood smear for Howell-Jolly bodies. If present, treat as asplenic.`]);
  if (sp.atRisk && x.lab.plt != null && x.lab.plt > 1000 && x.splenectomyT && x.now - x.splenectomyT < 90 * DAY) A.push(["action", `Platelets ${x.lab.plt} after splenectomy: thrombosis risk; check VTE prophylaxis and ask hematology about aspirin.`]);
  if (f && f.splenule) A.push(["info", "Imaging mentions an accessory spleen / splenosis: " + esc(f.splenule)]);
  if (sp.atRisk && pr.daily && !has("proph")) A.push(["action", "Daily antibiotic prophylaxis is indicated and none is ordered (see Prophylaxis)."]);
  $("alerts").innerHTML = A.length ? A.map(([l, t]) => alertBox(l, t)).join("") : '<span class="muted">Nothing urgent found.</span>';
  $("alertsum").textContent = A.filter((a) => a[0] !== "info").length ? A.filter((a) => a[0] !== "info").length + " to act on" : "";

  // plan now
  const P = [];
  if (pna) {
    if (op.lvl === "urgent") P.push(`<div class="urgent"><h3>Sepsis / possible OPSI</h3>${ul(["Ceftriaxone 2 g IV now (do not wait for imaging or LP) + vancomycin", "Blood cultures x2 first only if it takes minutes", "30 mL/kg balanced crystalloid if hypotensive or lactate 4+, then reassess", "ICU / outreach; DIC labs (INR, fibrinogen, platelets), lactate repeat in 2-4 h"])}</div>`);
    P.push(`<div class="action"><h3>Antibiotics: ${esc(abx.headline)}</h3>${ul(abx.reg.concat(abx.add).map((r) => `<b>${esc(r.drug)}</b> ${esc(r.dose)}${r.renal ? ` <span class="flag">(${esc(r.renal)})</span>` : ""}`).concat(x.allergy === "immediate" ? ["<b>Penicillin anaphylaxis:</b> ceftriaxone is usually tolerated; give the first dose monitored (or graded per local policy). Do not delay it."] : []))}</div>`);
  }
  if (vp.due.length) P.push(`<div class="action"><h3>Vaccines due${x.splenectomyT && x.now - x.splenectomyT < 14 * DAY ? " (from day 14 after surgery)" : ""}</h3>${ul(vp.due.map((d) => `<b>${esc(d.name)}</b>: ${esc(first(d.text))}.`))}</div>`);
  P.push(`<h3>Before discharge</h3>${ul([pr.daily ? "Daily prophylaxis: " + esc(pr.dailyRx.filter((r) => !/de-label/.test(r))[0]) : "", "Standby antibiotic: " + esc(pr.standby[0]), "Asplenia on the problem list + chart alert; handout; vaccine dates to the family doctor / public health"])}`);
  $("plan").innerHTML = P.join("");

  // spleen
  const yrs = x.yearsSince != null ? (x.yearsSince < 1 ? Math.round(x.yearsSince * 365) + " days" : x.yearsSince.toFixed(1) + " years") : "";
  $("sp").innerHTML = `<div class="verdict ${sp.atRisk ? "t3" : sp.status === "possible" ? "t2" : "t0"}"><div class="big">${esc(sp.label)}</div>${sp.why.length ? "<div>" + sp.why.map(esc).join("; ") + "</div>" : ""}</div>` +
    ul([x.splenectomyT ? `Splenectomy ${fmtD(x.splenectomyT)} (${yrs} ago). Risk of overwhelming infection is highest in the first 2 years but is lifelong.` : "",
      x.plannedT ? `Splenectomy planned ${fmtD(x.plannedT)}: vaccinate at least 2 weeks before.` : "",
      sp.causes.length ? "Cause: " + esc(sp.causes.join(", ")) : "",
      sp.possible.length ? "Conditions that can cause hyposplenia: " + esc(sp.possible.join(", ")) + (x.f && x.f.smear === "hj" ? " (Howell-Jolly bodies seen)" : " - check a smear") : "",
      "Asplenic patients have a lifelong risk of sudden, severe infection from encapsulated bacteria (pneumococcus, meningococcus, Hib), Capnocytophaga after dog bites, and severe babesiosis and malaria. Risk is highest in children, the first years after surgery, and with splenectomy for hematologic disease."]);
  $("spsum").textContent = sp.atRisk ? "at risk" : sp.status;

  // OPSI
  $("opsi").innerHTML = (op.text ? alertBox(op.lvl === "none" ? "info" : op.lvl, esc(op.text)) : '<span class="muted">No sepsis signs in the last 24 h of vitals and 3 days of labs.</span>') +
    `<h3 style="font-size:14px;margin:10px 0 4px">What OPSI looks like</h3>${ul(["Hours from flu-like illness (fever, chills, myalgia, vomiting, diarrhea) to shock", "Purpura fulminans, DIC, adrenal hemorrhage (Waterhouse-Friderichsen), multi-organ failure", "Often no focus; pneumonia or meningitis in about half", "Blood smear may show bacteria inside neutrophils (no spleen to clear them)"])}`;
  $("opsisum").textContent = op.signs.join(", ");

  // CURB-65
  $("curb").innerHTML = `<table><tbody>${curb.parts.map(([n, on]) => `<tr><td>${esc(n)}</td><td>${on ? '<b class="flag">yes</b>' : "no"}</td></tr>`).join("")}</tbody></table><p><b>${esc(curb.text)}</b></p>`;
  $("curbsum").textContent = "CURB-65 " + curb.score;

  // antibiotics
  const rxRows = (a) => a.map((r) => `<tr><td>${esc(r.drug)}</td><td>${esc(r.dose)}${r.renal ? `<div class="flag">${esc(r.renal)}</div>` : ""}</td><td>${esc(r.why)}</td></tr>`).join("");
  const cur = f && f.cls.abx.length ? `<p><b>Ordered now:</b> ${f.cls.abx.map(esc).join("; ")}</p>` : "";
  $("abx").innerHTML = (pna ? "" : '<p class="muted">Admitted for another reason: shown in case pneumonia develops.</p>') + cur +
    `<div class="verdict ${abx.severe ? "t3" : "t1"}"><div class="big">${esc(abx.headline)}</div><div>${x.allergy !== "none" ? "Allergy: " + esc(x.allergy) + ". " : ""}${x.crcl != null ? "CrCl " + x.crcl + " mL/min." : "CrCl unknown: enter it for renal doses."}</div></div>` +
    `<div class="scroll"><table class="rx"><thead><tr><th>Drug</th><th>Dose</th><th>Why</th></tr></thead><tbody>${rxRows(abx.reg)}${abx.add.length ? `<tr><td colspan="3" class="muted">Add</td></tr>` + rxRows(abx.add) : ""}</tbody></table></div>` +
    `<h3>How this differs from usual CAP</h3>${ul(abx.notes.map(esc))}<h3>Step-down and duration</h3>${ul(abx.step.map(esc).concat([esc(abx.duration)]))}`;
  $("abxsum").textContent = abx.headline;
  $("otherinf").innerHTML = `<table class="ref"><thead><tr><th>Organism</th><th>Picture</th><th>Treatment / prevention</th></tr></thead><tbody>${OTHER_INF.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;

  // vaccine record
  const recs = vp.records;
  const srcOf = (r) => (state.added.includes(r) ? "added" : state.pasted.includes(r) ? "pasted" : "chart");
  const allRec = (f ? f.imms : []).concat(state.added, state.pasted).filter((r) => r.name);
  $("rec").innerHTML = allRec.length ? `<table><thead><tr><th>Vaccine</th><th>Date</th><th>Counts as</th><th>From</th><th></th></tr></thead><tbody>${allRec.slice().sort((a, b) => (a.t || 0) - (b.t || 0)).map((r) => { const k = R.classify(r.name); const src = srcOf(r); return `<tr${k ? "" : ' class="dim"'}><td>${esc(r.name)}</td><td>${r.t ? fmtD(r.t) : '<span class="flag">no date</span>'}</td><td>${esc(k || "not used here")}</td><td>${src}</td><td>${src !== "chart" ? `<button class="rm" data-src="${src}" data-i="${(src === "added" ? state.added : state.pasted).indexOf(r)}">Remove</button>` : ""}</td></tr>`; }).join("")}</tbody></table>` : '<span class="muted">No vaccines recorded yet.</span>';
  $("recnote").textContent = f ? (f.immsError ? "Cerner immunizations could not be read. " : `Cerner immunizations: ${f.imms.length}. `) + "Cerner usually does not have the full BC record: check CareConnect." : "";
  $("recsum").textContent = recs.length + " doses";
  $$(".rm").forEach((b) => (b.onclick = () => { (b.dataset.src === "added" ? state.added : state.pasted).splice(+b.dataset.i, 1); draw(); }));

  // vaccines due
  $("vx").innerHTML = (sp.atRisk || sp.status === "possible" ? "" : '<p class="muted">Not marked asplenic: this is what would apply if the spleen does not work.</p>') +
    `<div class="scroll"><table class="vx"><thead><tr><th>Vaccine</th><th>Status</th><th>What to give / why</th><th>Next</th></tr></thead><tbody>${vp.items.map((i) => `<tr><td><b>${esc(i.name)}</b>${i.series ? `<div class="muted">${esc(i.series)}</div>` : ""}</td><td>${chip(i.status)}</td><td>${esc(i.text)}</td><td>${i.next ? (i.next <= x.now + DAY ? "now" : fmtD(i.next)) + (i.boosterUS ? " (US booster)" : "") : ""}</td></tr>`).join("")}</tbody></table></div>` +
    vp.timing.map((t) => alertBox(t.lvl, esc(t.t))).join("");
  $("vxsum").textContent = vp.due.length ? vp.due.length + " due now" : "none due now";
  $("vxref").innerHTML = `<table class="ref"><thead><tr><th>Vaccine</th><th>Primary</th><th>Boosters</th><th>Notes</th></tr></thead><tbody>${VX_REF.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;

  // prophylaxis
  $("pr").innerHTML = `<div class="verdict ${pr.daily ? "t2" : "t1"}"><div class="big">${esc(pr.label)}</div><div>${esc(pr.text)}</div></div>` +
    (has("proph") ? `<p><b>Ordered now:</b> ${f.cls.proph.map(esc).join("; ")}</p>` : "") +
    `<h3>Daily prophylaxis</h3>${ul(pr.dailyRx.map(esc))}<h3>Standby antibiotic (everyone)</h3>${ul(pr.standby.map(esc))}<p>${esc(pr.standbyText)}</p>` +
    `<h3>Why</h3>${ul(["Prophylaxis lowers but does not remove the risk: breakthrough OPSI happens on penicillin and after vaccination.", "Penicillin-resistant pneumococcus exists: fever on prophylaxis still means the ER.", "In BC, penicillin V and amoxicillin are low cost; write enough refills to last to the next visit."])}`;
  $("prsum").textContent = pr.label;

  // precautions
  $("prc").innerHTML = x.prec.map((p) => alertBox(p.lvl, esc(p.t) + (p.why ? ` <span class="muted">(${esc(p.why)})</span>` : ""))).join("");
  $("prcsum").textContent = x.prec.filter((p) => p.lvl !== "info").length + " to act on";
  $("causes").innerHTML = `<table class="ref"><thead><tr><th>Group</th><th>Causes</th><th>Notes</th></tr></thead><tbody>${CAUSES.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;

  // discharge
  const dcItems = [
    ["Problem list + chart alert: Asplenia / hyposplenism", f && f.probText.some((t) => /asplen|splenectomy|hyposplen|absence of spleen|Z90\.81|D73\.0/i.test(t))],
    ["Vaccines due given or booked (dates in the discharge summary)", !vp.due.length],
    ["Second doses booked (MenACWY 8 weeks, MenB 4 weeks / Trumenba schedule)", !vp.later.some((l) => /Mening/.test(l.name))],
    ["Daily prophylaxis prescribed (if indicated)", !pr.daily || has("proph")],
    ["Standby antibiotic prescribed with written instructions", null],
    ["Penicillin allergy label reviewed / de-labelling arranged", x.allergy === "none" ? true : null],
    ["Handout given: fever = ER, bites, ticks, travel, medical alert", null],
    ["Family doctor letter: vaccine plan and boosters (MenACWY every 5 years)", null]];
  $("dc").innerHTML = `<ul class="check">${dcItems.map(([t, ok]) => `<li class="${ok ? "have" : "miss"}">${ok ? "✓" : "☐"} ${esc(t)}${ok === false ? ' <span class="flag">not done</span>' : ""}</li>`).join("")}</ul>`;

  drawHandout();
  if (state.note) state.note.update();
}

/* ---------- handout ---------- */
function handoutHTML() {
  const x = state.x; if (!x) return "";
  const abx = $("h-abx").value || x.pr.standby[0], fu = $("h-fu").value, ph = $("h-phone").value;
  const due = x.vp.items.filter((i) => i.status === "due" || i.status === "later");
  return `<h3>Your spleen and infections</h3><p>Your spleen ${x.sp.status === "anatomic" ? "has been removed" : x.sp.status === "planned" ? "will be removed" : "does not work properly"}. The spleen helps fight some bacteria. Without it, a few infections can become very serious within hours. This risk lasts for life, but vaccines, antibiotics and quick action keep you safe.</p>
    <h3>Fever is an emergency for you</h3><ul><li>If you have a temperature of 38 °C or higher, shaking chills, or suddenly feel very unwell: <b>take your standby antibiotic (${esc(abx)}) and go to the nearest ER the same day.</b></li><li>Tell the ER staff right away: "I do not have a working spleen."</li><li>Do not wait to see if it gets better overnight.</li></ul>
    <h3>Call 911 if you have</h3><ul><li>Purple or dark red spots on the skin that do not fade when pressed</li><li>Confusion, very hard to wake, or a severe headache with a stiff neck</li><li>Trouble breathing, fainting, or cold, mottled hands and feet</li></ul>
    ${x.pr.daily ? `<h3>Your daily antibiotic</h3><p>${esc(x.pr.dailyRx.filter((r) => !/de-label/.test(r))[0])}. Take it every day, even when well. Do not stop without talking to your doctor.</p>` : ""}
    <h3>Your vaccines</h3><ul>${due.length ? due.map((d) => `<li>${esc(d.name)}: ${d.status === "due" ? "due now" : "due " + fmtD(d.next)}</li>`).join("") : "<li>Up to date for now.</li>"}<li>Meningococcal ACWY booster every 5 years. Flu shot every fall (your household too).</li></ul>${fu ? `<p>Next vaccine visit: ${esc(fu)}</p>` : ""}
    <h3>Animal bites, ticks and travel</h3><ul><li>Any dog or cat bite, even small: see a doctor the same day for antibiotics.</li><li>Use insect repellent and check for ticks after outdoor activity. Fever after a tick bite: go to the ER.</li><li>Before travel, see a travel clinic. Malaria is more dangerous for you. Take your antibiotic and vaccine record with you.</li></ul>
    <h3>Tell every health care provider</h3><ul><li>Wear a medical alert bracelet or carry a card that says "no spleen" / "hyposplenism".</li><li>Tell your dentist, pharmacist and any new doctor.</li></ul>
    ${x.splenectomyT && x.now - x.splenectomyT < 90 * DAY ? `<h3>After your surgery</h3><ul><li>Go to the ER for new belly pain, leg swelling, or shortness of breath: blood clots are more common in the first months.</li></ul>` : ""}
    ${ph ? `<p>Questions: ${esc(ph)}</p>` : ""}`;
}
function drawHandout() { $("handout").innerHTML = handoutHTML(); if (!$("h-abx").value && state.x) $("h-abx").placeholder = state.x.pr.standby[0]; }

/* ---------- note ---------- */
function noteBuild(full) {
  const x = state.x; if (!x) return null;
  const f = x.f, pna = x.reason === "pneumonia" || x.reason === "sepsis";
  const summary = [`${f ? [f.age != null ? f.age + " y" : "", f.sex].filter(Boolean).join(" ") : "Patient"}: ${x.sp.label}${x.sp.causes.length ? " (" + x.sp.causes.join(", ") + ")" : ""}${x.splenectomyT ? ", splenectomy " + fmtD(x.splenectomyT) : ""}.`];
  if (x.op.signs.length) summary.push("Sepsis signs: " + x.op.signs.join(", ") + ".");
  const pn = pna ? [first(x.curb.text) + ".", "Antibiotics: " + x.abx.reg.concat(x.abx.add).map((r) => `${r.drug} ${r.dose}${r.renal ? " (" + r.renal + ")" : ""}`).join("; ") + "."].concat(full ? x.abx.step.concat([x.abx.duration]) : [x.abx.step[0]]) : [];
  const vx = x.vp.items.filter((i) => full || i.status !== "done").map((i) => `${i.name}: ${({ done: "done", due: "DUE", later: "next " + fmtD(i.next), check: "check" })[i.status]}${i.status === "due" ? " - " + first(i.text) : ""}${i.status === "done" && i.next ? " (next " + fmtD(i.next) + ")" : ""}.`);
  x.vp.timing.filter((t) => t.lvl !== "info").forEach((t) => vx.push(t.t));
  const proph = [x.pr.label + (x.pr.reasons.length ? ": " + x.pr.reasons.join("; ") : "") + ".", x.pr.daily ? "Daily: " + x.pr.dailyRx.filter((r) => !/de-label/.test(r))[0] + "." : "", "Standby antibiotic: " + x.pr.standby[0] + "."].filter(Boolean);
  const prec = x.prec.filter((p) => full || p.lvl !== "info").map((p) => p.t);
  const plan = ["Asplenia added to the problem list and chart alert.", "Handout given: fever = ER, bites, ticks, travel, medical alert."];
  return { stamp: Date.now(), heading: "ASPLENIA / HYPOSPLENIA", sections: { summary, pneumonia: pn, vaccines: vx, proph, prec, plan } };
}
state.note = NoteDraft.mount($("note"), { title: "Asplenia", sections: [{ id: "summary", label: "Summary" }, { id: "pneumonia", label: "Pneumonia", noteLabel: "Pneumonia / sepsis" },
  { id: "vaccines", label: "Vaccines" }, { id: "proph", label: "Prophylaxis", noteLabel: "Antibiotic prophylaxis" }, { id: "prec", label: "Precautions", on: false }, { id: "plan", label: "Plan" }], build: noteBuild });

/* ---------- load ---------- */
function autoFill(preset) {
  const p = (preset && preset.sit) || {}, f = state.f;
  ["sDays", "crcl", "wt"].forEach((id) => { $(id).value = ""; $(id).classList.remove("typed"); });
  $("pDays").value = p.plannedDays ?? "";
  ["spleen", "smear", "allergy", "flu"].forEach((id) => ($(id).value = ""));
  $("reason").value = p.reason || (f && f.probText.some((t) => /pneumon|J1[2-8]/i.test(t)) ? "pneumonia" : f ? "other" : "pneumonia");
  $("setting").value = p.setting || "ward";
  $("shock").checked = !!p.shock; $("meningitis").checked = !!p.meningitis; $("purpura").checked = false; $("confusion").checked = false;
  $("mrsa").checked = false; $("pseudo").checked = false; $("aspiration").checked = false;
  $("priorOPSI").checked = prob("opsi");
  $("immuno").checked = !!(f && (f.cls.immuno.length || f.prob.transplant || f.prob.hiv || f.cls.eculizumab.length));
  $("heme").checked = !!(f && (f.prob.heme || f.cls.chemo.length || f.cls.cd20.length || f.recentImmuno.length));
  $("gvhd").checked = !!(f && f.probText.some((t) => /graft.?versus|gvhd|allogeneic/i.test(t)));
  $("dog").checked = !!p.dog || !!(f && f.probText.some((t) => /dog bite|cat bite|animal bite|W54|W55/i.test(t)));
  $("tick").checked = false; $("travel").checked = false;
  state.added = []; state.pasted = []; $("paste").value = ""; $("pastemsg").textContent = "";
  ["h-abx", "h-fu", "h-phone"].forEach((id) => ($(id).value = ""));
}
function load(raw, note, errors, preset) {
  state.f = raw ? C.parse(raw) : null;
  autoFill(preset);
  $("pstatus").textContent = note; $("clear").hidden = !raw;
  $("errs").innerHTML = errors && errors.length ? "Could not read: " + errors.map(esc).join("; ") + (errors.some((e) => /\b40[13]\b|Unauthorized|Forbidden/i.test(e)) ? ". Check the scopes in the Code Console." : ". Cerner's sandbox can be slow: reload the patient to try again.") : "";
  if (state.note) state.note.reset();
  draw();
}
document.addEventListener("change", (e) => { const t = e.target; if (t.id === "testsel" || t.id === "paste" || t.id === "addk" || t.id === "addd") return; if (/^h-/.test(t.id)) return drawHandout(); if (t.closest("#note")) return; if (t.matches("input, select")) draw(); });
document.addEventListener("input", (e) => { const t = e.target; if (t.closest("#note")) return; if (/^h-/.test(t.id)) return drawHandout(); if (t.matches("input[type=number]")) { t.classList.add("typed"); draw(); } });
$("addb").onclick = () => { const d = $("addd").value; state.added.push({ name: $("addk").value, t: d ? new Date(d + "T12:00:00Z").getTime() : null, src: "added" }); $("addd").value = ""; draw(); };
$("pasteb").onclick = () => {
  const got = R.parseImmText($("paste").value);
  state.pasted = got;
  const noDate = got.filter((g) => g.noDate).length;
  $("pastemsg").textContent = got.length ? `${got.length} vaccine line${got.length > 1 ? "s" : ""} read${noDate ? `, ${noDate} without a date (counted as given, date unknown)` : ""}. Check the table above.` : "No vaccine names found. One vaccine per line, with its date.";
  draw();
};
$("h-print").onclick = () => { const w = window.open("", "_blank"); if (!w) return; w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Living without a working spleen</title><style>body{font:16px/1.5 system-ui,sans-serif;max-width:720px;margin:24px auto;padding:0 16px}h3{margin:16px 0 4px}</style></head><body>${handoutHTML()}</body></html>`); w.document.close(); w.focus(); };
$("clear").onclick = () => { $("testsel").value = ""; load(null, "Open from Cerner to read the chart, or pick a made-up patient:"); };
const SAMPLES = window.ASPLENIA_SAMPLES || [];
SAMPLES.forEach((p, i) => { const op = document.createElement("option"); op.value = i; op.textContent = p.label; $("testsel").appendChild(op); });
$("testsel").onchange = () => { const p = SAMPLES[$("testsel").value]; if (!p) return $("clear").onclick(); load(p.build(Date.now()), "Made-up patient: " + p.label, [], p); };

async function fromChart() {
  if (typeof FHIR === "undefined" || !(location.search.includes("code=") || location.search.includes("complete=") || sessionStorage.getItem("SMART_KEY"))) return;
  $("pstatus").textContent = "Reading the chart…";
  try {
    const client = await FHIR.oauth2.ready();
    const { raw, errors } = await C.gather(client, (msg) => ($("pstatus").textContent = msg));
    load(raw, "Chart read (read-only). Nothing is sent anywhere. Check the situation boxes above and paste the vaccine record.", errors);
  } catch (e) { $("pstatus").textContent = "Could not read the chart: " + (e && e.message ? e.message : e) + ". The made-up patients still work."; }
}
const demo = new URLSearchParams(location.search).get("demo");
if (demo && SAMPLES[+demo - 1]) { $("testsel").value = String(+demo - 1); $("testsel").onchange(); } else { draw(); fromChart(); }
