/* IBD: when to drain an abscess and when to involve a surgeon. UNVERIFIED draft written by Claude on 2026-11-13.
   What is from a source: the abscess size and drainage logic follows the ECCO-based review of Crohn intra-abdominal abscess management (Haas et al., United European Gastroenterol J 2022;
   a narrative review, no graded recommendations): image-guided percutaneous drainage first when feasible, collections over about 3 cm usually drained, smaller ones treated with antibiotics alone
   when drainage is not feasible, surgery if sepsis persists after 48 h of antibiotics plus drainage or an abscess persists on MRI after drainage, antibiotics typically 3 to 4 weeks, low threshold for surgery.
   Everything else (perianal abscess, UC and Crohn surgical triggers, lists) is Claude's general knowledge and is labelled "general practice". No size threshold has been tested as a predictor of drainage success:
   the 2 cm and 3 cm cut-offs are constants below; change them to match your local rule. Pure advice function (node-testable) + a self-rendering card that needs an element with id "surg". */
(function (root) {
  const GRAY_CM = 2;   // below this: antibiotics alone usually
  const DRAIN_CM = 3;  // above this: percutaneous drainage is the usual first step

  /* x = { loc: "abdo"|"perianal"|"wall", cm, access: "yes"|"no"|"unknown", multi: bool, septic: bool, peritonitis: bool, h48: bool (sepsis persists after 48 h of antibiotics plus drainage),
           persist: bool (still present on imaging after drainage), fistula: bool (stricture, enterocutaneous or complex fistula on imaging) }
     returns { level: "urgent"|"action"|"info"|"none", head, lines[] } */
  function abscessAdvice(x) {
    const L = [], cm = x.cm == null || x.cm === "" || isNaN(x.cm) ? null : +x.cm;
    if (x.peritonitis) return { level: "urgent", head: "Peritonitis or free perforation: urgent surgery", lines: ["Call the surgeon now. Resuscitate, IV broad-spectrum antibiotics covering gut flora (gram-negatives and anaerobes), hold steroids and biologics, and do not wait for drainage or imaging to be perfect."] };
    if (x.loc === "perianal") {
      L.push("A symptomatic perianal abscess needs prompt incision and drainage by surgery or colorectal, whatever its size (general practice). Antibiotics alone are not enough once pus has collected.");
      L.push("In Crohn disease: examination under anaesthesia to look for a fistula, drain, and place a seton if there is a fistula. MRI pelvis to define anatomy if not an emergency.");
      L.push("Start anti-TNF therapy only after sepsis is controlled (discuss with GI). Antibiotics are an adjunct (ciprofloxacin plus metronidazole is commonly used).");
      if (x.septic) L.unshift("Septic: this is urgent. Drain the same day.");
      return { level: x.septic ? "urgent" : "action", head: "Perianal abscess: drain, do not just treat with antibiotics", lines: L };
    }
    if (x.septic && x.h48) return { level: "urgent", head: "Sepsis persists after 48 h of antibiotics plus drainage: surgery", lines: ["Surgery is recommended at this stage (ECCO as quoted in the 2022 review). Call the surgeon now.", "Look for undrained loculations, a missed second collection, an enteric fistula or a perforation (repeat CT)."] };
    if (cm == null) return { level: "none", head: "Enter the abscess size", lines: [] };
    const where = x.loc === "wall" ? "abdominal wall or other superficial collection" : "intra-abdominal abscess";
    if (x.loc === "wall") L.push("Superficial or abdominal wall collections: drain (incision or ultrasound-guided) when fluctuant or larger than about 2 cm, and look for the underlying fistula (general practice).");
    L.push("Start IV antibiotics covering gram-negatives and anaerobes (for example a fluoroquinolone or third-generation cephalosporin plus metronidazole); adjust to culture if drained. Typical total course 3 to 4 weeks, guided by repeat imaging (MRI preferred over repeated CT).");
    L.push("Hold steroids and biologics until the source is controlled (general practice; the review gives no explicit rule). Corticosteroid use was linked to failure of conservative treatment in one cohort.");
    let level = "action", head;
    if (cm > DRAIN_CM) {
      head = `${cm} cm ${where}: percutaneous drainage is the usual first step`;
      L.unshift(x.access === "no" ? "Not accessible on imaging: discuss with interventional radiology and surgery now. If there is no safe window, surgery is the alternative." : "Ask interventional radiology for image-guided percutaneous drainage (reported success about 74 to 100%, mostly well-defined single collections). This may avoid surgery in up to about 30%.");
    } else if (cm >= GRAY_CM) {
      head = `${cm} cm ${where}: grey zone (${GRAY_CM} to ${DRAIN_CM} cm)`;
      L.unshift(`${GRAY_CM} to ${DRAIN_CM} cm: no study has tested size as a predictor. Reasonable approach: drain if it is accessible and the patient is febrile or symptomatic, or if not clearly improving after 48 to 72 h of antibiotics; otherwise antibiotics with repeat imaging.`);
      if (x.access === "no") L.push("Not accessible: antibiotics, repeat imaging at 48 to 72 h, and early surgical review if no improvement.");
    } else {
      head = `${cm} cm ${where}: antibiotics alone are usually enough`;
      level = "info";
      L.unshift(`Under ${GRAY_CM} cm is usually too small to drain (in the adalimumab study, abscesses under 30 mm were treated with antibiotics alone when drainage was not feasible). Repeat imaging if fever or pain persists and drain if it enlarges.`);
    }
    if (x.multi) L.push("Multiple or loculated collections are harder to drain by catheter: involve interventional radiology and surgery early.");
    if (x.fistula) L.push("A stricture or enteric, enterocutaneous or complex fistula on imaging: surgery is more likely to be needed. Involve the surgeon early (ECCO notes higher non-response with symptomatic fistulas between diseased loops and adjacent organs).");
    if (x.persist) { level = "urgent"; L.unshift("Abscess still present on MRI after drainage, antibiotics and nutrition support: surgery must be considered. Call the surgeon."); head = "Persisting abscess after drainage: surgical review"; }
    L.push("After control: optimise nutrition (enteral first, parenteral if not tolerated). Anti-TNF has retrospective evidence of lowering recurrence once the abscess has resolved on imaging (in the adalimumab study the first dose was given after at least 2 weeks of antibiotics if drained, 3 weeks if not). Timing with GI.");
    return { level, head, lines: L };
  }

  const SECTIONS = [
    ["Call the surgeon the same day (any IBD patient)", "urgent", [
      "Peritonitis, free air or perforation.",
      "Toxic megacolon: colon wider than about 5.5 to 6 cm with systemic toxicity (fever, tachycardia, distension, tenderness).",
      "Massive rectal bleeding or haemodynamic instability.",
      "Complete or closed-loop obstruction, vomiting with distension, or signs of ischaemia.",
      "Sepsis from an abscess that cannot be drained, or persisting after 48 h of antibiotics plus drainage.",
      "Perianal abscess with sepsis."]],
    ["Involve the surgeon early during the admission", "action", [
      "Every acute severe UC admission: from admission, not at day 3 (colectomy is the safe end of the pathway).",
      "UC: no response to IV steroids at day 3 (Oxford criteria), a high Ho index, or no improvement 4 to 7 days after rescue infliximab or cyclosporine.",
      "Crohn: intra-abdominal abscess needing drainage, a collection with no safe percutaneous window, or multiple collections.",
      "Crohn: obstructive symptoms from a fibrotic stricture that did not settle with decompression and steroids (dilation versus resection).",
      "Crohn: enteric, enterovesical, enterovaginal or enterocutaneous fistula, or a complex perianal fistula.",
      "Crohn: limited ileocecal disease that keeps relapsing: early ileocecal resection is a reasonable alternative to long-term biologics (discuss with GI; general practice)."]],
    ["Refer for planned (elective) surgical assessment", "info", [
      "Dysplasia or cancer on surveillance or biopsy (UC or Crohn colitis).",
      "Chronic refractory disease despite adequate advanced therapy, steroid dependence, or intolerable drug side effects.",
      "Post-resection recurrence with stricture that medical therapy will not reverse.",
      "Growth failure or severe nutritional compromise in younger patients."]]
  ];
  const BEFORE = [
    "VTE prophylaxis continues through the pre-operative period unless bleeding forbids it.",
    "Taper prednisone toward 20 mg/day or less if possible before elective surgery; give stress-dose steroids if on chronic steroids (infection and adrenal risk).",
    "Nutrition: albumin below about 30 g/L or recent weight loss raises complication risk. Start enteral or parenteral support and involve the dietitian.",
    "Tell the surgeon which advanced therapy the patient is on and when the last dose was (for example last infliximab or vedolizumab dose); ask GI how to time it.",
    "Check C. difficile, CMV (if colitis) and blood cultures if febrile; a wound or abdominal source can look like a flare."];

  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const LV = { urgent: "#b00020", action: "#c26a00", info: "#0b6bcb", none: "#555" };
  const list = (items) => `<ul class="chk">${items.map((t) => `<li><input type="checkbox"><span class="t">${esc(t)}</span></li>`).join("")}</ul>`;
  function render(el) {
    el.innerHTML = `
      <div class="muted">For the hospitalist: size of abscess, when to drain, and when to bring in the surgeon. <b>Unverified draft.</b> The abscess logic follows an ECCO-based review (Haas 2022, narrative, no graded recommendations); the surgical-trigger lists are my general knowledge. No study has tested abscess size as a predictor of drainage success: the ${GRAY_CM} cm and ${DRAIN_CM} cm cut-offs are a guide. Follow your local interventional radiology and surgical rules.</div>
      <div style="border:2px solid #b00020;border-left-width:6px;border-radius:8px;background:#b0002012;padding:8px 12px 10px;margin:10px 0">
        <div style="font-weight:700;font-size:15px;color:#b00020">Abscess: drain or antibiotics?</div>
        <div class="row">
          <label class="inl">Site <select id="sg-loc"><option value="abdo">Intra-abdominal / pelvic</option><option value="perianal">Perianal / perirectal</option><option value="wall">Abdominal wall / superficial</option></select></label>
          <label class="inl">Largest size (cm) <input type="number" min="0" step="0.1" id="sg-cm"></label>
          <label class="inl">Safe window for percutaneous drainage <select id="sg-acc"><option value="unknown">Not known yet</option><option value="yes">Yes</option><option value="no">No</option></select></label></div>
        <div class="row">
          <label class="inl"><input type="checkbox" id="sg-multi"> Multiple or loculated</label>
          <label class="inl"><input type="checkbox" id="sg-fist"> Stricture or complex / enteric fistula on imaging</label>
          <label class="inl"><input type="checkbox" id="sg-sep"> Septic (fever, tachycardia, hypotension)</label>
          <label class="inl"><input type="checkbox" id="sg-48"> Sepsis persists 48 h after antibiotics + drainage</label>
          <label class="inl"><input type="checkbox" id="sg-pers"> Still present on imaging after drainage</label>
          <label class="inl"><input type="checkbox" id="sg-peri"> Peritonitis or free air</label></div>
        <div id="sg-out"></div>
      </div>
      ${SECTIONS.map(([h, lv, items]) => `<div class="lab" style="color:${LV[lv]}">${esc(h)}</div>${list(items)}`).join("")}
      <div class="lab">Before any surgery</div>${list(BEFORE)}
      <div class="muted" style="margin-top:8px">Source for the abscess logic: <a href="https://pmc.ncbi.nlm.nih.gov/articles/PMC9752265" target="_blank" rel="noopener">Haas et al., management of Crohn intra-abdominal abscesses, UEG Journal 2022</a>. Lists marked above are general practice, not from a guideline I could read.</div>`;
    const g = (id) => el.querySelector("#" + id), upd = () => {
      const x = { loc: g("sg-loc").value, cm: g("sg-cm").value === "" ? null : +g("sg-cm").value, access: g("sg-acc").value, multi: g("sg-multi").checked, fistula: g("sg-fist").checked, septic: g("sg-sep").checked, h48: g("sg-48").checked, persist: g("sg-pers").checked, peritonitis: g("sg-peri").checked };
      const a = abscessAdvice(x);
      g("sg-out").innerHTML = a.level === "none" && !a.lines.length ? "" : `<div style="font-weight:700;color:${LV[a.level]};margin:6px 0 2px">${esc(a.head)}</div><ul style="margin:0;padding-left:18px;font-size:13px">${a.lines.map((l) => `<li>${esc(l)}</li>`).join("")}</ul>`;
    };
    el.addEventListener("input", upd); el.addEventListener("change", (e) => { if (e.target.type === "checkbox" && e.target.closest("li")) e.target.closest("li").classList.toggle("done", e.target.checked); upd(); });
    upd();
  }
  root.IBDSurgery = { abscessAdvice, render, SECTIONS, BEFORE, GRAY_CM, DRAIN_CM };
  if (typeof module !== "undefined" && module.exports) module.exports = root.IBDSurgery;
  if (typeof document !== "undefined") { const go = () => { const el = document.getElementById("surg"); if (el) render(el); }; if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", go); else go(); }
})(typeof window !== "undefined" ? window : globalThis);
