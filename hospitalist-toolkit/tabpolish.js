/* Tab polish for tools that already have their own tabs (ILD, Seizure, Peritoneal carcinomatosis, Oncology).
   Makes them behave like the shared sub-tabs (subtabs.js) without rewriting their tab code:
   - moves the warning banner and the safety-flag box ABOVE the tab row, so a red flag is visible from every tab
   - optionally mirrors red items from any tab into an "Act now" strip above the tabs (mirror: true)
   - red dot on a tab whose panel holds a red item (redSel)
   - button-style tabs, same as the other toolkit tabs
   Usage: TabPolish.mount({ nav: "#nav", panel: (key) => "#tab-" + key, move: ["#banner-el", "#flags-box"], redSel: ".flag.red", mirror: false }) */
(function () {
  const css = `
  .tpol-top { display:grid; gap:8px; margin:10px auto 0; max-width:var(--tpol-w, 1100px); padding:0 16px; }
  .tpol-top:empty { display:none; }
  nav.tpol { gap:6px !important; padding:8px 12px !important; background:var(--bg, #f5f7fa) !important; }
  nav.tpol button { border:1px solid var(--line, #dde3ea) !important; background:var(--card, #fff) !important; color:var(--accent, #0b6bcb) !important;
    border-radius:6px !important; padding:6px 12px !important; font-size:13.5px !important; font-weight:500 !important; position:relative; margin:0 !important; }
  nav.tpol button.on { background:var(--accent, #0b6bcb) !important; color:#fff !important; border-color:var(--accent, #0b6bcb) !important; }
  nav.tpol .tpol-dot { position:absolute; top:-4px; right:-4px; width:10px; height:10px; border-radius:50%; background:#d0342c; border:2px solid var(--bg, #f5f7fa); }
  .tpol-mirror { border:1px solid var(--line, #dde3ea); border-radius:8px; background:var(--card, #fff); padding:6px 12px; }
  .tpol-mirror > b { display:block; font-size:13px; margin-bottom:2px; }
  .tpol-mirror .tpol-item { font-size:13px; margin:4px 0; }
  .tpol-mirror .tpol-go { border:0; background:none; color:var(--accent, #0b6bcb); cursor:pointer; text-decoration:underline; padding:0 0 0 6px; font:inherit; font-size:12px; }`;

  function mount(cfg) {
    const nav = document.querySelector(cfg.nav); if (!nav || nav.dataset.tpol) return; nav.dataset.tpol = "1";
    const st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);
    nav.classList.add("tpol");
    const top = document.createElement("div"); top.className = "tpol-top";
    nav.parentNode.insertBefore(top, nav);
    (cfg.move || []).forEach((sel) => { const el = document.querySelector(sel); if (el) top.appendChild(el.closest(cfg.moveUp || "x-none") || el); });
    let strip = null;
    if (cfg.mirror) { strip = document.createElement("div"); strip.className = "tpol-mirror"; strip.hidden = true; top.appendChild(strip); }
    const keys = () => Array.from(nav.querySelectorAll("button[data-t]")).map((b) => b.dataset.t);
    const panelOf = (k) => document.querySelector(cfg.panel(k));
    const red = cfg.redSel || ".flag.red";
    function draw() {
      const items = [];
      keys().forEach((k) => {
        const b = nav.querySelector(`button[data-t="${k}"]`), p = panelOf(k);
        const hits = p ? Array.from(p.querySelectorAll(red)).filter((e) => !top.contains(e) && !e.closest("[hidden]") && e.textContent.trim()) : [];
        const has = !!b.querySelector(".tpol-dot");
        if (hits.length && !has) { const d = document.createElement("span"); d.className = "tpol-dot"; d.title = "something urgent in this tab"; b.appendChild(d); }
        if (!hits.length && has) b.querySelector(".tpol-dot").remove();
        hits.forEach((e) => items.push({ k, label: b.firstChild ? b.firstChild.textContent.trim() : k, text: e.textContent.replace(/\s+/g, " ").trim() }));
      });
      if (strip) {
        const html = items.length ? `<b>Act now (${items.length})</b>` + items.slice(0, 6).map((it) => `<div class="tpol-item">• ${it.text.slice(0, 220)}${it.text.length > 220 ? "…" : ""}<button class="tpol-go" data-go="${it.k}">${it.label} tab</button></div>`).join("") : "";
        if (strip.dataset.h !== html) { strip.dataset.h = html; strip.innerHTML = html; strip.hidden = !items.length;
          strip.querySelectorAll("[data-go]").forEach((g) => (g.onclick = () => { const b = nav.querySelector(`button[data-t="${g.dataset.go}"]`); if (b) b.click(); })); }
      }
    }
    let tm = null;
    new MutationObserver((muts) => { if (muts.every((m) => nav.contains(m.target) || (strip && strip.contains(m.target)))) return; clearTimeout(tm); tm = setTimeout(draw, 150); })
      .observe(document.body, { childList: true, subtree: true, characterData: true });
    draw();
  }
  window.TabPolish = { mount };
})();
