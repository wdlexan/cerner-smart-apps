/* IBD: Crohn disease manifestations outside the gut (extraintestinal manifestations, EIM). UNVERIFIED draft written by Claude on 2026-11-13 from general knowledge
   (ECCO extraintestinal-manifestation consensus and standard gastroenterology texts). Not checked against the source documents in this session: verify before clinical use.
   Most also occur in ulcerative colitis. "rel" says whether the problem usually tracks gut activity ("parallels": treating the bowel helps) or runs on its own ("independent": needs its own treatment).
   urgency: "urgent" = same-day specialist, "soon" = refer this admission or within days, "routine" = outpatient or monitor. Pure data + a self-rendering card for an element with id "eim". */
(function (root) {
  const SYSTEMS = [
    { id: "eye", name: "Eye", items: [
      { n: "Uveitis (anterior)", urgency: "urgent", rel: "independent", look: "Painful red eye with photophobia, blurred vision, ciliary flush (redness around the iris), small or irregular pupil. Can be insidious and painless in chronic cases; more common with HLA-B27 and with sacroiliitis.", act: "Same-day ophthalmology (slit lamp). Do not treat as simple conjunctivitis. Topical steroids; anti-TNF (adalimumab or infliximab) if recurrent or chronic.", why: "Can cause synechiae, glaucoma and permanent vision loss." },
      { n: "Scleritis", urgency: "urgent", rel: "parallels", look: "Severe, boring, often night-time pain, deep violaceous redness that does not blanch with phenylephrine, tender globe, may reduce vision.", act: "Same-day ophthalmology. Systemic therapy is often needed (steroids, anti-TNF). Treat the bowel disease.", why: "Threatens vision; may be necrotising." },
      { n: "Episcleritis", urgency: "routine", rel: "parallels", look: "Sectoral redness, mild irritation, no loss of vision, no photophobia; blanches with phenylephrine. Often flares with the bowel.", act: "Usually self-limited; lubricants or topical steroid per ophthalmology. Treat the bowel disease. Refer if pain or any visual change (it may be scleritis or uveitis).", why: "Benign, but it can be hard to tell from the dangerous ones." },
      { n: "Steroid eye effects", urgency: "routine", rel: "drug", look: "Cataract (posterior subcapsular) and raised eye pressure after prolonged steroids; also dry eye.", act: "Eye check for patients on long steroid courses or with vision change.", why: "Preventable harm from treatment." }] },
    { id: "skin", name: "Skin and mouth", items: [
      { n: "Pyoderma gangrenosum", urgency: "soon", rel: "independent", look: "Rapidly enlarging painful ulcer with a violaceous, undermined border, often on the legs or around a stoma; may start as a pustule or after minor trauma (pathergy).", act: "Dermatology urgently, with a biopsy to exclude infection. Avoid surgical debridement (pathergy makes it worse). Steroids, cyclosporine, infliximab or adalimumab; treat the bowel disease.", why: "Mimics infection or vascular ulcers and can be made worse by debridement." },
      { n: "Erythema nodosum", urgency: "routine", rel: "parallels", look: "Tender red or violet nodules on the shins (sometimes arms), with or without fever and arthralgia. The commonest skin manifestation.", act: "Treat the bowel disease; rest, leg elevation, NSAIDs only with caution (they can flare IBD); steroids if severe.", why: "A marker of active bowel disease." },
      { n: "Sweet syndrome", urgency: "soon", rel: "parallels", look: "Fever, neutrophilia and tender red papules or plaques on the face, neck or arms.", act: "Dermatology and biopsy; systemic steroids; treat the bowel disease.", why: "Rare but needs a diagnosis." },
      { n: "Aphthous stomatitis", urgency: "routine", rel: "parallels", look: "Painful mouth ulcers; may also be oral Crohn disease (cobblestoning, lip swelling).", act: "Treat the bowel disease; topical steroid or lidocaine; check B12, iron and folate.", why: "Common and often linked to nutritional deficiency." },
      { n: "Perianal skin tags and Crohn's of the skin", urgency: "routine", rel: "independent", look: "Perianal tags, fissures, and metastatic (non-contiguous) cutaneous Crohn disease with ulcers or plaques in skin folds or genitals.", act: "Examine the perianal area on every admission. Perianal abscess or fistula needs surgical review (see the abscess card).", why: "Perianal disease changes treatment and prognosis." },
      { n: "Skin reactions from the drugs", urgency: "routine", rel: "drug", look: "Anti-TNF: psoriasiform or eczematous rash (paradoxical psoriasis), injection reactions, infections. Thiopurines: photosensitivity and non-melanoma skin cancer.", act: "Dermatology for psoriasiform lesions; the drug may have to be changed. Sun protection and yearly skin checks on thiopurines or anti-TNF.", why: "Often mistaken for an extraintestinal manifestation." }] },
    { id: "joint", name: "Joints and spine", items: [
      { n: "Peripheral arthropathy type 1", urgency: "routine", rel: "parallels", look: "Fewer than 5 large joints (knee, ankle, wrist, elbow), asymmetric, migratory, lasts weeks, flares with bowel activity.", act: "Treat the bowel disease. Short NSAID course only with caution; local steroid injection; sulfasalazine or anti-TNF if persistent. Exclude septic arthritis if a single hot joint.", why: "The commonest EIM." },
      { n: "Peripheral arthropathy type 2", urgency: "soon", rel: "independent", look: "5 or more small joints (symmetric polyarthritis like RA), lasts months to years, independent of bowel activity.", act: "Rheumatology. Anti-TNF is useful for both the bowel and the joints; methotrexate is another option.", why: "Can cause damage and does not settle with bowel treatment alone." },
      { n: "Axial: sacroiliitis, ankylosing spondylitis", urgency: "soon", rel: "independent", look: "Inflammatory back pain: worse at rest and at night, morning stiffness over 30 minutes, improves with movement. HLA-B27 in a minority.", act: "Rheumatology; MRI sacroiliac joints. Anti-TNF. NSAIDs are the usual rheumatological first step but can flare IBD; use only briefly and monitor.", why: "Needs its own treatment; does not track the bowel." },
      { n: "Septic arthritis (always exclude)", urgency: "urgent", rel: "other", look: "One hot swollen joint with fever, especially on immunosuppression.", act: "Same-day aspiration and cultures; orthopaedics. Immunosuppression raises the risk.", why: "Easy to miss as 'IBD arthritis'." },
      { n: "Avascular necrosis", urgency: "soon", rel: "drug", look: "Hip or groin pain (sometimes knee or shoulder) after steroids.", act: "MRI (X-ray may be normal early); orthopaedics; stop steroids when possible.", why: "Steroid complication, easy to attribute to arthritis." }] },
    { id: "liver", name: "Liver and biliary", items: [
      { n: "Primary sclerosing cholangitis", urgency: "soon", rel: "independent", look: "Raised ALP and GGT (cholestatic pattern), itch, fatigue; often asymptomatic. More common in UC but also Crohn colitis. Fever and jaundice suggest cholangitis.", act: "MRCP; hepatology. Colonoscopy surveillance every year from diagnosis in colitis. Cholangitis with fever and jaundice is an emergency (antibiotics, ERCP).", why: "Raises bile duct and colon cancer risk. Not helped by treating the bowel." },
      { n: "Gallstones", urgency: "routine", rel: "other", look: "Biliary colic or cholecystitis; more common with ileal disease or ileal resection (bile salt loss).", act: "Usual gallstone work-up; surgery as for anyone.", why: "Common in Crohn disease." },
      { n: "Fatty liver and drug liver injury", urgency: "routine", rel: "drug", look: "Raised ALT or AST. Thiopurines, methotrexate, sulfasalazine and anti-TNF can all cause this.", act: "Review drugs; check LFTs regularly on thiopurines and methotrexate; hepatitis B screen before biologics (reactivation).", why: "Often drug-related." }] },
    { id: "kidney", name: "Kidney and urinary", items: [
      { n: "Calcium oxalate stones", urgency: "routine", rel: "other", look: "Renal colic in ileal disease or ileal resection with an intact colon (fat malabsorption means more oxalate is absorbed).", act: "Fluids, low-oxalate and low-fat diet, calcium with meals; urology for stones.", why: "A recognised complication of small-bowel Crohn disease." },
      { n: "Uric acid stones and dehydration", urgency: "routine", rel: "other", look: "High-output ileostomy or diarrhoea leading to concentrated acidic urine.", act: "Hydration; alkalinise the urine; correct losses.", why: "Often in ileostomy patients." },
      { n: "Hydronephrosis and enterovesical fistula", urgency: "soon", rel: "other", look: "Ureteric obstruction from retroperitoneal inflammation or an abscess; pneumaturia, faecaluria or recurrent UTIs suggest a fistula to the bladder.", act: "CT or MRI; urology and surgical review.", why: "A surgical trigger (see the surgeon card)." },
      { n: "Drug kidney injury", urgency: "routine", rel: "drug", look: "5-ASA (mesalamine) can cause interstitial nephritis; rising creatinine.", act: "Check creatinine before and during 5-ASA therapy.", why: "Easy to overlook." }] },
    { id: "bone", name: "Bone and nutrition", items: [
      { n: "Osteopenia and osteoporosis", urgency: "routine", rel: "independent", look: "Inflammation, steroids, malabsorption, low vitamin D and low body weight.", act: "Bone density scan if steroids for 3 months or more, or other risk factors; calcium, vitamin D, treat osteoporosis.", why: "Frequently missed; fractures." },
      { n: "Anaemia and micronutrient deficiency", urgency: "routine", rel: "parallels", look: "Iron deficiency (blood loss), B12 (terminal ileum disease or resection), folate, zinc, vitamin D; also anaemia of inflammation.", act: "Ferritin with CRP, transferrin saturation, B12, folate, vitamin D. IV iron is preferred in active disease. B12 injections after ileal resection.", why: "Fatigue and neuropathy are often nutritional." },
      { n: "Growth failure (children and adolescents)", urgency: "soon", rel: "other", look: "Slow growth or delayed puberty.", act: "Paediatric gastroenterology; early nutritional therapy.", why: "Not relevant to adults." }] },
    { id: "blood", name: "Blood clots, heart, lung, nerves", items: [
      { n: "Venous thromboembolism", urgency: "urgent", rel: "parallels", look: "Leg swelling or pain, chest pain or breathlessness. IBD flares carry a 2 to 3 times higher VTE risk, even in younger patients.", act: "Pharmacologic VTE prophylaxis in every admitted flare, including with rectal bleeding unless bleeding is severe; imaging for symptoms.", why: "A preventable cause of death in admitted patients." },
      { n: "Pericarditis, myocarditis, pleuritis", urgency: "soon", rel: "other", look: "Chest pain, effusion. Can be an IBD manifestation, but 5-ASA and anti-TNF are known causes.", act: "ECG, troponin and echo; review drugs; cardiology.", why: "Rare, but drug causes matter." },
      { n: "Neuropathy and demyelination", urgency: "soon", rel: "drug", look: "B12 deficiency; metronidazole (peripheral neuropathy); anti-TNF (rare demyelination, optic neuritis).", act: "Check B12; review metronidazole and anti-TNF; neurology.", why: "Often drug or nutrition related." },
      { n: "Pancreatitis", urgency: "soon", rel: "drug", look: "Epigastric pain with raised lipase. Azathioprine, 6-MP and 5-ASA are common causes; also gallstones.", act: "Stop the suspected drug; usual pancreatitis care.", why: "A drug reaction, usually early after starting a thiopurine." }] }
  ];
  const REL = { parallels: "tracks the gut", independent: "independent of the gut", drug: "drug or treatment effect", other: "complication of the disease" };
  const UR = { urgent: ["#b00020", "same day"], soon: ["#c26a00", "this admission"], routine: ["#0b6bcb", "routine"] };
  const FLAGS = [
    "Painful red eye with light sensitivity or any vision change: same-day ophthalmology.",
    "A painful, rapidly growing skin ulcer: think pyoderma gangrenosum; biopsy, avoid debridement, dermatology.",
    "A single hot swollen joint: exclude septic arthritis.",
    "Fever with jaundice or itch: cholangitis (PSC) until proven otherwise.",
    "Leg swelling, chest pain or breathlessness: VTE. Give VTE prophylaxis to every admitted flare."];
  /* Pearls supplied by the user on 2026-11-13 (their reference numbers [1], [4], [5] were not included, so no sources are shown). The anti-TNF line is qualified: PSC and many drug-induced look-alikes do not respond. */
  const PEARLS = [
    "A painful red eye needs urgent ophthalmology review. Uveitis and scleritis threaten vision and are treated systemically, often with anti-TNF therapy.",
    "Anti-TNF therapy treats most extraintestinal manifestations whether or not they follow bowel activity (exceptions: PSC does not respond, and some skin lesions are caused by the anti-TNF itself).",
    "Inflammatory arthritis is stiff in the morning and improves with movement, which separates it from osteoarthritis. Avoid NSAIDs where possible, since they can trigger flares.",
    "Having one extraintestinal manifestation raises the risk of developing others: look for the rest."];
  const NOTE = "Rule of thumb: manifestations that track the gut (type 1 arthritis, erythema nodosum, mouth ulcers, episcleritis) improve when the bowel does; those that run independently (axial arthritis, pyoderma gangrenosum, uveitis, PSC, type 2 arthritis) need their own specialist and treatment. Anti-TNF treats many of them, but check for drug-induced look-alikes.";

  function find(q) {
    q = String(q || "").toLowerCase().trim(); if (!q) return [];
    const out = [];
    SYSTEMS.forEach((s) => s.items.forEach((it) => { if ((it.n + " " + it.look + " " + it.act + " " + s.name).toLowerCase().includes(q)) out.push(Object.assign({ system: s.name }, it)); }));
    return out;
  }

  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const item = (it) => { const u = UR[it.urgency]; return `<details class="eim-i"><summary><b>${esc(it.n)}</b> <span style="color:${u[0]};font-size:12px;font-weight:700">${u[1]}</span> <span class="muted">· ${esc(REL[it.rel])}</span></summary><div style="padding:2px 0 6px 14px;font-size:13px"><div><b>What it looks like:</b> ${esc(it.look)}</div><div><b>What to do:</b> ${esc(it.act)}</div><div class="muted">${esc(it.why)}</div></div></details>`; };
  function render(el) {
    el.innerHTML = `
      <div class="muted">Crohn disease outside the gut (also seen in UC). <b>Unverified draft</b> from general knowledge of the ECCO consensus; verify before clinical use. Tap a heading for details.</div>
      <div style="border:2px solid #b00020;border-left-width:6px;border-radius:8px;background:#b0002012;padding:8px 12px 10px;margin:10px 0"><div style="font-weight:700;color:#b00020">Do not miss</div><ul style="margin:2px 0 0;padding-left:18px;font-size:13px">${FLAGS.map((f) => `<li>${esc(f)}</li>`).join("")}</ul></div>
      <div style="border:2px solid #0b6bcb;border-left-width:6px;border-radius:8px;background:#0b6bcb12;padding:8px 12px 10px;margin:10px 0"><div style="font-weight:700;color:#0b6bcb">Pearls for hospitalists</div><ul style="margin:2px 0 0;padding-left:18px;font-size:13px">${PEARLS.map((f) => `<li>${esc(f)}</li>`).join("")}</ul></div>
      <div class="row"><label class="inl">Search <input type="text" id="eim-q" size="26" placeholder="e.g. red eye, ulcer, back pain"></label><span class="muted" id="eim-n"></span></div>
      <div id="eim-res"></div>
      <div id="eim-all">${SYSTEMS.map((s) => `<div class="lab">${esc(s.name)}</div>${s.items.map(item).join("")}`).join("")}</div>
      <div class="muted" style="margin-top:8px">${esc(NOTE)}</div>`;
    const q = el.querySelector("#eim-q"), res = el.querySelector("#eim-res"), all = el.querySelector("#eim-all"), n = el.querySelector("#eim-n");
    q.oninput = () => { const r = find(q.value); res.innerHTML = r.map(item).join(""); all.style.display = q.value.trim() ? "none" : ""; n.textContent = q.value.trim() ? r.length + " match" + (r.length === 1 ? "" : "es") : ""; };
  }
  root.IBDEim = { SYSTEMS, FLAGS, PEARLS, REL, UR, find, render };
  if (typeof module !== "undefined" && module.exports) module.exports = root.IBDEim;
  if (typeof document !== "undefined") { const go = () => { const el = document.getElementById("eim"); if (el) render(el); }; if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", go); else go(); }
})(typeof window !== "undefined" ? window : globalThis);
