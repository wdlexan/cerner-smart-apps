/* Watch-ahead AI draft (optional second layer). The fixed rules always run first and stay on screen; the AI only adds a labelled draft.
   - Builds a de-identified text from the parsed chart (no name, no dates: values are "N days ago"), shows it to the user BEFORE sending.
   - Sends it only to window.WA_AI_ENDPOINT (ai-config.js). Empty = fixed sample, nothing sent.
   - Blocked unless the data are a made-up sample or come from the Cerner SANDBOX server. */
(function () {
  const SANDBOX_HOSTS = ["fhir-ehr-code.cerner.com", "fhir-open.cerner.com"];
  const D = () => window.WAChart.DEFS;
  const dayText = (t, now) => { if (!t) return "date unknown"; const d = Math.round((now - t) / 864e5); return d <= 0 ? "today" : d === 1 ? "1 day ago" : d + " days ago"; };

  function allowed(state) {
    if (!state.f) return { ok: false, why: "Pick a made-up patient or open from Cerner first." };
    if (state.source === "sample") return { ok: true, why: "" };
    if (state.source === "chart" && SANDBOX_HOSTS.some((h) => String(state.serverUrl || "").includes(h))) return { ok: true, why: "" };
    return { ok: false, why: "AI is blocked for this chart because it does not look like the Cerner sandbox. Real patient data stays out of the AI until Island Health approves." };
  }

  function buildText(state, dxTitles) {
    const f = state.f, now = state.now || Date.now(), defs = D(), L = [];
    L.push(`Patient: ${f.age != null ? f.age + "-year-old" : "age unknown"} ${f.sex || "sex unknown"}`);
    L.push("Diagnoses selected for this admission: " + (dxTitles.length ? dxTitles.join("; ") : "none selected"));
    L.push("", "Problem list:", ...(f.conditions.length ? f.conditions.map((c) => "- " + c) : ["- none read"]));
    L.push("", "Active medications (names only):", ...(f.medNames.length ? f.medNames.slice(0, 40).map((m) => "- " + m) : ["- none read"]));
    L.push("", "Allergies:", ...(f.allergies.length ? f.allergies.map((a) => "- " + a.text + (a.reaction ? " (" + a.reaction + ")" : "")) : ["- none recorded"]));
    L.push("", "Latest vital signs and labs (age of each value shown):");
    const missing = [];
    Object.keys(defs).forEach((k) => {
      const s = f.series[k];
      if (!s || !s.length) { missing.push(defs[k].name); return; }
      const usable = state.useOld || !f.stale[k];
      const top = s[0];
      let line = `- ${defs[k].name}: ${top.v}${defs[k].unit ? " " + defs[k].unit : ""} (${dayText(top.t, now)})${usable ? "" : " [older than the usual window]"}`;
      if (["creat", "hgb", "k"].includes(k) && s.length > 1) line += "; earlier: " + s.slice(1, 3).map((x) => `${x.v} (${dayText(x.t, now)})`).join("; ");
      L.push(line);
    });
    if (missing.length) L.push("", "Not available in the data: " + missing.join(", "));
    if (state.cards && state.cards.length) {
      L.push("", "Rule-based flags already shown to the physician:");
      state.cards.forEach((c) => L.push(`- ${c.title} (${(c.from || []).join("; ").replace(/\b\d{4}-\d{2}-\d{2}\b/g, "").replace(/\s*\(\s*\)/g, "").replace(/,\s*(?=[;)]|$)/g, "")})`));
    }
    return L.join("\n");
  }

  const SAMPLE = {
    snapshot: "SAMPLE ONLY, not about this patient: older adult with pneumonia, falling kidney function and several drugs that need review.",
    watch: [{ t: "Possible: oxygen need rising over the next day.", s: "Sample" }, { t: "Possible: creatinine continuing to rise.", s: "Sample" }],
    mayHappen: [{ t: "Possible: slower recovery than a younger patient.", s: "Sample" }],
    contingency: [{ if: "oxygen need rises", then: "reassess, repeat imaging, consider critical care review" }],
    course: "Sample text. A real draft gives a qualitative course tied to this patient's data.",
    length: [{ what: "Antibiotic course", range: "sample range", basis: "sample" }],
    uncertainty: ["Sample: what is missing from the data would be listed here."]
  };

  async function call(endpoint, text) {
    const res = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
    if (!res.ok) { let m = ""; try { m = (await res.json()).error || ""; } catch (e) {} throw new Error("HTTP " + res.status + (m ? ": " + m : "")); }
    return res.json();
  }
  window.WAAI = { allowed, buildText, call, SAMPLE, SANDBOX_HOSTS };
})();
