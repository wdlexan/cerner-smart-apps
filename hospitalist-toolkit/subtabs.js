/* Shared sub-tabs for long toolkit tabs (CHF, Liver, Electrolytes, IBD, AKI, ...).
   Moves the page's existing top-level sections into tab panels, so each tool keeps its own markup and code.
   Usage (after the page's own scripts):
     SubTabs.mount({ store: "chf", top: ["Chart alerts", "#tiles"], tabs: [
       { key: "assess", label: "Assess", match: ["Patient and situation", "NT-proBNP"] }, ... ] });
   match: "#id" (element id), "^Text" (heading starts with), or text found anywhere in the section's <summary> heading (case-insensitive).
   Sections that match nothing go with the section before them. The banner (.banner) and "top" items stay above the tabs.
   A red dot shows on a tab that contains an urgent item (dotSel), or whose section heading contains dotText (e.g. "severe").
   Counts are optional (count: (panel) => "3").
   Collapsible sections inside each tab are untouched. Printing shows every tab. */
(function () {
  const css = `
  .st-top { display:grid; gap:12px; }
  .st-nav { display:flex; flex-wrap:wrap; gap:6px; padding:8px 0; position:sticky; top:0; z-index:5; background:var(--bg, #f5f7fa); border-bottom:1px solid var(--line, #dde3ea); }
  .st-nav button { border:1px solid var(--line, #dde3ea); background:var(--card, #fff); color:var(--accent, #0b6bcb); border-radius:6px; padding:6px 12px; font-size:13.5px; cursor:pointer; position:relative; font-weight:500; }
  .st-nav button.on { background:var(--accent, #0b6bcb); color:#fff; border-color:var(--accent, #0b6bcb); }
  .st-nav .cnt { font-size:11px; margin-left:5px; opacity:.85; }
  .st-nav .dot { position:absolute; top:-4px; right:-4px; width:10px; height:10px; border-radius:50%; background:#d0342c; border:2px solid var(--bg, #f5f7fa); }
  section.st-panel { display:none; gap:14px; } section.st-panel.on { display:grid; }
  @media print { section.st-panel { display:grid !important; } .st-nav { display:none !important; } }`;

  function headOf(el) {
    const sm = el.matches("details") ? el.querySelector(":scope > summary") : null;
    return (sm ? sm.textContent : el.matches("h2,h3") ? el.textContent : (el.querySelector("h2,h3") || {}).textContent || el.textContent.slice(0, 120)).toLowerCase().replace(/\s+/g, " ").trim();
  }
  function textOf(el) {
    const sm = el.matches("details") ? el.querySelector(":scope > summary") : null;
    const head = sm ? sm.textContent : el.matches("h2,h3") ? el.textContent : (el.querySelector("h2,h3") || {}).textContent || el.textContent.slice(0, 120); // no heading: the block's own first words
    return ((el.id || "") + " " + head).toLowerCase().replace(/\s+/g, " ");
  }
  function hits(el, m) {
    if (m.startsWith("#")) { const t = document.getElementById(m.slice(1)); return !!t && (el === t || el.contains(t)); }
    if (m.startsWith("^")) return headOf(el).startsWith(m.slice(1).toLowerCase()); // heading starts with
    return textOf(el).includes(m.toLowerCase());
  }

  function mount(cfg) {
    const main = cfg.root ? document.querySelector(cfg.root) : document.querySelector("main"); if (!main || main.dataset.stMounted) return;
    main.dataset.stMounted = "1";
    const st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);
    const kids = Array.from(main.children).filter((c) => c.tagName !== "SCRIPT");
    const top = document.createElement("div"); top.className = "st-top";
    const nav = document.createElement("nav"); nav.className = "st-nav"; nav.setAttribute("aria-label", "Sections");
    const panels = {}; cfg.tabs.forEach((t) => { const p = document.createElement("section"); p.className = "st-panel"; p.dataset.tab = t.key; panels[t.key] = p; });
    let last = cfg.tabs[0].key, firstSeen = false;
    kids.forEach((el) => {
      if (el.classList.contains("banner") && !firstSeen) { top.appendChild(el); return; }
      firstSeen = true;
      if ((cfg.top || []).some((m) => hits(el, m))) { top.appendChild(el); return; }
      const t = cfg.tabs.find((tab) => (tab.match || []).some((m) => hits(el, m)));
      if (t) last = t.key;
      panels[last].appendChild(el);
    });
    main.appendChild(top); main.appendChild(nav);
    cfg.tabs.forEach((t) => main.appendChild(panels[t.key]));

    const KEY = "subtab-" + (cfg.store || location.pathname);
    let cur = (() => { try { return sessionStorage.getItem(KEY); } catch (e) { return null; } })();
    if (!panels[cur]) cur = cfg.tabs[0].key;
    const dotSel = cfg.dotSel || ".alert.urgent, .tile.t3";
    function draw() {
      nav.innerHTML = cfg.tabs.filter((t) => panels[t.key].children.length && !(t.show && !t.show())).map((t) => {
        const p = panels[t.key], c = t.count ? t.count(p) : "", dot = Array.from(p.querySelectorAll(dotSel)).some((e) => !e.closest("[hidden]"))
          || (t.dotText ? Array.from(p.querySelectorAll("summary")).some((sm) => sm.textContent.toLowerCase().includes(t.dotText.toLowerCase())) : false);
        return `<button type="button" data-t="${t.key}" class="${t.key === cur ? "on" : ""}">${t.label}${c ? `<span class="cnt">${c}</span>` : ""}${dot ? `<span class="dot" title="something urgent in this tab"></span>` : ""}</button>`;
      }).join("");
      nav.querySelectorAll("button").forEach((b) => (b.onclick = () => show(b.dataset.t, true)));
      Object.keys(panels).forEach((k) => panels[k].classList.toggle("on", k === cur));
    }
    function show(k, scroll) {
      if (!panels[k]) return; cur = k; try { sessionStorage.setItem(KEY, k); } catch (e) {}
      draw();
      if (scroll && nav.getBoundingClientRect().top < 0) window.scrollTo({ top: nav.offsetTop });
    }
    // keep dots and counts current as the page redraws itself
    let tm = null; new MutationObserver((muts) => { if (muts.every((m) => nav.contains(m.target))) return; clearTimeout(tm); tm = setTimeout(draw, 120); }).observe(main, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["class", "hidden", "style"] });
    // a page that scrolls to (or links to) something in another tab switches to that tab first
    const orig = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = function (...a) { const p = this.closest && this.closest("section.st-panel"); if (p && !p.classList.contains("on")) show(p.dataset.tab); return orig.apply(this, a); };
    document.addEventListener("click", (e) => { const a = e.target.closest && e.target.closest('a[href^="#"]'); if (!a) return; const t = document.getElementById(a.getAttribute("href").slice(1)); const p = t && t.closest("section.st-panel"); if (p && !p.classList.contains("on")) show(p.dataset.tab); }, true);
    draw();
    window.SubTabs.show = show; window.SubTabs.redraw = draw;
  }
  window.SubTabs = { mount };
})();
