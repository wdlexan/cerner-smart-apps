/* node tests/test_consult.js */
const R = require("../tools/consult/rules.js");
let fail = 0;
const eq = (n, g, w) => { const o = g === w; if (!o) fail++; console.log((o ? "ok   " : "FAIL ") + n + ": got " + JSON.stringify(g) + ", want " + JSON.stringify(w)); };
const H = 36e5, D = 864e5, now = Date.UTC(2026, 10, 3, 4);
// Glasgow-Blatchford: urea 14 (4) + male Hgb 76 (6) + SBP 98 (2) + HR 104 (1) + melena (1) = 14
eq("GBS 14", R.gbs({ urea: 14, hgb: 76, sbp: 98, hr: 104, sex: "male", melena: true }).score, 14);
eq("GBS 0 low", R.gbs({ urea: 5, hgb: 140, sbp: 130, hr: 70, sex: "male" }).low, true);
eq("GBS female Hgb 115 = 1", R.gbs({ urea: 5, hgb: 115, sbp: 130, hr: 70, sex: "female" }).score, 1);
eq("GBS male Hgb 125 = 1", R.gbs({ urea: 5, hgb: 125, sbp: 130, hr: 70, sex: "male" }).score, 1);
eq("GBS liver + HF + syncope = 6", R.gbs({ urea: 5, hgb: 140, sbp: 130, hr: 70, sex: "male", liver: true, hf: true, syncope: true }).score, 6);
eq("GBS missing", R.gbs({ urea: 5, hgb: 140 }), null);
// KDIGO
eq("KDIGO 2", R.kdigo([{ t: now - 40 * D, v: 80 }, { t: now - D, v: 120 }, { t: now, v: 170 }]).stage, 2);
eq("KDIGO 1 by 48h rise", R.kdigo([{ t: now - 30 * D, v: 90 }, { t: now - D, v: 90 }, { t: now, v: 118 }]).stage, 1);
eq("KDIGO 0", R.kdigo([{ t: now - 10 * D, v: 80 }, { t: now, v: 95 }]).stage, 0);
// trend
eq("trend", R.trend([{ t: now - 2 * D, v: 112 }, { t: now - D, v: 84 }, { t: now, v: 76 }], now, 3), "112 → 84 → 76");
eq("initials", R.initials("John Albert Smith"), "JAS");
// messages
const c = { spec: "gi", urgency: "urgent", question: "Scope timing?", callback: "Dr. Dong 250-819-0168", who: { age: 78, sex: "male", initials: "JS", mrn: "123", location: "4W-12", day: 2, reason: "melena" },
  lines: ["Hgb 112 → 84 → 76", "INR 1.3, plt 160"], vitals: { hr: 104, sbp: 98, dbp: 60 }, meds: ["Apixaban (held)"], stamp: "Nov 2 20:30" };
const t = R.teams(c).split("\n");
eq("teams head", t[0], "GI CONSULT – URGENT (today)"); eq("teams Q", t[1], "Q: Scope timing?"); eq("teams id", t[2], "78M, JS, 4W-12, admitted day 2, for melena (MRN 123)");
eq("teams callback", t.includes("Callback: Dr. Dong 250-819-0168"), true); eq("teams vitals", t.includes("HR 104, BP 98/60"), true);
eq("teams no question placeholder", R.teams(Object.assign({}, c, { question: "" })).includes("Q: [your question]"), true);
eq("full has sections", /Question:\n- Scope timing\?/.test(R.full(c)) && /Relevant medications:/.test(R.full(c)), true);
eq("general label", R.teams({ spec: "general", specName: "Infectious diseases", urgency: "routine" }).split("\n")[0], "INFECTIOUS DISEASES CONSULT – ROUTINE (next 24-48 h)");
// Teams link
const L = R.teamsLink("gi.oncall@islandhealth.ca", "hello world");
eq("link users", /users=gi.oncall%40islandhealth.ca/.test(L.url), true); eq("link message", /message=hello%20world/.test(L.url), true); eq("link not cut", L.cut, false);
eq("no email no link", R.teamsLink("", "x"), null);
const long = R.teamsLink("a@b.ca", "x".repeat(5000)); eq("long cut", long.cut, true); eq("long under limit", long.url.length <= 1800, true);
console.log(fail ? fail + " FAILED" : "all passed"); process.exit(fail ? 1 : 0);
