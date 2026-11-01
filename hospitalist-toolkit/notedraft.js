/* Note draft box, shared by the toolkit tabs. Builds an editable assessment-and-plan draft from what the tab has worked out.
   Nothing is sent anywhere: the only way out is the clipboard. The page calls box.update() after every redraw.

   const box = NoteDraft.mount(el, {
     title: "Hyponatremia",
     sections: [{ id: "assess", label: "Assessment", on: true }, ...],   // tick boxes, in note order
     build: (full) => ({ stamp: ms, heading: "HYPONATREMIA", sections: { assess: ["line", ...], plan: [...] } })   // null when nothing to draft
   });
   The "plan" section gets the clinician's decision as its first line. */
(function () {
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const fmtDT = (t) => new Date(t).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  const PLACEHOLDER = "- [your decision]";
  let n = 0;

  const CSS = `.nd-box textarea { width:100%; min-height:300px; font:13px/1.45 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace; padding:10px; border:1px solid var(--line); border-radius:8px; background:var(--card); color:var(--ink); resize:vertical; }
    .nd-box .nd-row { display:flex; flex-wrap:wrap; gap:8px 14px; align-items:center; margin:8px 0; }
    .nd-box .nd-row label { display:inline-flex; gap:5px; align-items:center; }
    .nd-box input.nd-dec { flex:1; min-width:240px; }
    .nd-box .nd-seg button { border-radius:0; margin:0; } .nd-box .nd-seg button:first-child { border-radius:6px 0 0 6px; } .nd-box .nd-seg button:last-child { border-radius:0 6px 6px 0; margin-left:-1px; }
    .nd-box .nd-seg button.on { background:var(--accent); color:#fff; border-color:var(--accent); }
    .nd-box .nd-stale { background:var(--a-bg); color:var(--a-ink); border-radius:6px; padding:6px 10px; margin:6px 0; }
    .nd-box .nd-msg { font-size:12.5px; color:var(--muted); }`;

  function mount(el, cfg) {
    const id = "nd" + ++n;
    if (!document.getElementById("nd-css")) { const st = document.createElement("style"); st.id = "nd-css"; st.textContent = CSS; document.head.appendChild(st); }
    const on = {}; cfg.sections.forEach((s) => (on[s.id] = s.on !== false));
    const st = { full: false, dirty: false, lastGen: "", lastDecLine: PLACEHOLDER };
    el.classList.add("nd-box");
    el.innerHTML = `
      <div class="nd-row"><b>Include:</b> ${cfg.sections.map((s) => `<label><input type="checkbox" data-sec="${s.id}"${on[s.id] ? " checked" : ""}> ${esc(s.label)}</label>`).join("")}</div>
      <div class="nd-row"><label for="${id}-dec"><b>My decision:</b></label><input class="nd-dec" id="${id}-dec" type="text" placeholder="What you decided (goes first in the plan)">
        <span class="nd-seg"><button type="button" data-len="short" class="on">Short</button><button type="button" data-len="full">Full</button></span></div>
      <div class="nd-stale" id="${id}-stale" hidden>The chart or your selections changed after you edited the draft. <button type="button" id="${id}-redo">Rebuild draft</button> (your edits will be replaced)</div>
      <textarea id="${id}-txt" spellcheck="true" aria-label="${esc(cfg.title)} note draft"></textarea>
      <div class="nd-row"><button type="button" class="primary" id="${id}-copy">Copy to clipboard</button><button type="button" id="${id}-reset">Reset draft</button><span class="nd-msg" id="${id}-msg"></span></div>
      <div class="nd-msg">A draft for you to check and edit. It records your decision, not the tool's suggestion. Paste it into your PowerChart note; nothing is sent from this page.</div>`;
    const $ = (s) => el.querySelector(s), txt = $(`#${id}-txt`), dec = $(`#${id}-dec`), msg = $(`#${id}-msg`), stale = $(`#${id}-stale`);

    const decLine = () => (dec.value.trim() ? "- " + dec.value.trim().replace(/^[-•]\s*/, "") : PLACEHOLDER);
    function generate() {
      const d = cfg.build(st.full);
      if (!d) return "";
      const out = [d.heading + (d.stamp ? " (data as of " + fmtDT(d.stamp) + ")" : "")];
      cfg.sections.forEach((s) => {
        if (!on[s.id]) return;
        let lines = (d.sections[s.id] || []).filter(Boolean);
        if (s.id === "plan") lines = [decLine()].concat(lines);
        if (!lines.length) return;
        out.push((s.noteLabel || s.label) + ":"); lines.forEach((l) => out.push(/^[-•]/.test(l) ? l : "- " + l));
      });
      return out.join("\n");
    }
    function update(force) {
      const g = generate();
      if (st.dirty && !force) { if (g !== st.lastGen) stale.hidden = false; return; }
      txt.value = g; st.lastGen = g; st.dirty = false; stale.hidden = true; st.lastDecLine = decLine(); txt.scrollTop = 0;
    }
    txt.addEventListener("input", () => { st.dirty = txt.value !== st.lastGen; msg.textContent = ""; });
    dec.addEventListener("input", () => {
      const nl = decLine();
      if (st.dirty) { if (txt.value.includes(st.lastDecLine)) txt.value = txt.value.replace(st.lastDecLine, nl); st.lastDecLine = nl; }
      else update(true);
    });
    el.querySelectorAll("[data-sec]").forEach((cb) => (cb.onchange = () => { on[cb.dataset.sec] = cb.checked; update(); }));
    el.querySelectorAll("[data-len]").forEach((b) => (b.onclick = () => { st.full = b.dataset.len === "full"; el.querySelectorAll("[data-len]").forEach((x) => x.classList.toggle("on", x === b)); update(); }));
    $(`#${id}-redo`).onclick = () => update(true);
    $(`#${id}-reset`).onclick = () => { dec.value = ""; update(true); msg.textContent = ""; };
    $(`#${id}-copy`).onclick = async () => {
      let text = txt.value.split("\n").filter((l) => l.trim() !== PLACEHOLDER).join("\n").trim();
      if (!text) { msg.textContent = "Nothing to copy."; return; }
      try { await navigator.clipboard.writeText(text); msg.textContent = "Copied." + (dec.value.trim() ? "" : " No decision entered: add yours in the note."); }
      catch (e) { txt.focus(); txt.select(); msg.textContent = "Could not copy automatically: the text is selected, press Ctrl+C."; }
    };
    /* new patient: clear the decision and any edits */
    function reset() { dec.value = ""; st.dirty = false; msg.textContent = ""; update(true); }
    return { update: () => update(false), reset, text: () => txt.value };
  }
  window.NoteDraft = { mount };
})();
