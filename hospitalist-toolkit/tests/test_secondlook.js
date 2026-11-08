/* node tests/test_secondlook.js */
const S = require("../tools/watch/secondlook.js");
let fail = 0;
const ok = (n, c) => { if (!c) fail++; console.log((c ? "ok   " : "FAIL ") + n); };
const F = (o) => Object.assign({ age: 70, conditions: [], meds: {}, values: {}, stale: {}, source: {}, useOld: false }, o);

// bias prompts change with role
const kinds = (r) => S.biasPrompts(r, null).map((b) => b.trap).join("|");
ok("mrp has 'Outsourcing'", /Outsourcing/.test(kinds("mrp")));
ok("consult has framing", /Framing by the consult question/.test(kinds("consult")));
ok("comanage has diffusion", /Diffusion/.test(kinds("comanage")));
ok("age 80 adds atypical", S.biasPrompts("mrp", F({ age: 80 }), [], []).some((b) => b.trap === "Atypical presentation"));
ok("flags vs dx", S.biasPrompts("mrp", F({}), [{ sev: "high", title: "Low BP" }], ["Pneumonia"]).some((b) => /Low BP/.test(b.ask) && /Pneumonia/.test(b.ask)));

// what's missing
let m = S.missing(F({ values: { na: 126, hgb: 85, creat: 90, k: 4 }, source: { na: "126 today" } }), "mrp", []);
ok("low Na flagged", m.some((x) => /sodium/i.test(x.text)));
ok("low Hgb flagged", m.some((x) => /hemoglobin/i.test(x.text)));
m = S.missing(F({ conditions: ["Hyponatremia", "Iron deficiency anemia"], values: { na: 126, hgb: 85, creat: 90, k: 4 } }), "mrp", []);
ok("explained Na/Hgb not flagged", !m.some((x) => /sodium|hemoglobin/i.test(x.text)));
m = S.missing(F({ meds: { anticoag: ["Apixaban 5 mg"] }, values: { inr: 2, creat: 90, hgb: 130, na: 140, k: 4 } }), "mrp", []);
ok("anticoag without AF flagged", m.some((x) => /Anticoagulant/.test(x.text)));
ok("INR not flagged when on anticoag", !m.some((x) => /INR/.test(x.text)));
m = S.missing(F({ conditions: ["Atrial fibrillation"], meds: { anticoag: ["Apixaban 5 mg"] }, values: { creat: 90, hgb: 130, na: 140, k: 4 } }), "mrp", []);
ok("anticoag with AF fine", !m.some((x) => /Anticoagulant/.test(x.text)));
m = S.missing(F({ values: { na: 126, creat: 90, hgb: 130, k: 4 }, stale: { na: true } }), "mrp", []);
ok("stale Na ignored", !m.some((x) => /sodium/i.test(x.text)));
ok("not-read labs reported", S.missing(F({ values: {} }), "mrp", []).some((x) => /creatinine/.test(x.text)));
ok("aki card w/o kidney problem", S.missing(F({ values: { creat: 150, hgb: 130, na: 140, k: 4 } }), "mrp", [{ id: "aki" }]).some((x) => /kidney/.test(x.text)));
ok("fever on antibiotic not flagged", !S.missing(F({ meds: { antibiotic: ["Cefazolin"] }, conditions: ["Cellulitis"], values: { temp: 38.5, creat: 90, hgb: 130, na: 140, k: 4 } }), "mrp", []).some((x) => /Fever/.test(x.text)));

// checklist and scripts
ok("ortho checklist adds VTE", S.checklist("consult", "ortho").some((x) => /VTE/.test(x)));
ok("consult checklist", /consult question/.test(S.checklist("consult", "")[0]));
ok("urgent script uses CUS", S.script("mrp", "ortho", "urgent", {}).join(" ").includes("safety issue"));
ok("clearance script avoids 'clear'", /can't 'clear'/.test(S.script("consult", "ortho", "clearance", {}).join(" ")));
ok("fills used", S.script("consult", "ortho", "disagree", { concern: "Hgb 72" }).join(" ").includes("Hgb 72"));
ok("consultant opener", /medicine consultant/.test(S.script("consult", "ortho", "reasoning", {})[0]));
ok("sbar addressed", /^To Orthopedics/.test(S.sbar("consult", "ortho", {})));
ok("every situation has a script", Object.keys(S.SITUATIONS).every((k) => S.script("mrp", "other", k, {}).length >= 4));
ok("asText", /consult question: hip/i.test(S.asText({ role: "consult", service: "ortho", question: "hip", missing: [], unticked: [] })));
console.log(fail ? fail + " FAILED" : "all passed"); process.exit(fail ? 1 : 0);
