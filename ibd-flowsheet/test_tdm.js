const T = require("./tdm.js");
const DAY = 864e5, now = Date.UTC(2026, 10, 13);
let p = 0, f = 0; const ok = (c, m) => { if (c) p++; else { f++; console.log("FAIL", m); } };
const keys = (r) => r.flags.map((x) => x.key).concat(r.interp ? [r.interp.key] : []);

ok(T.abState({ text: "Not detected" }) === "neg", "ab neg text");
ok(T.abState({ text: "<22 ng/mL" }) === "neg", "ab below cutoff");
ok(T.abState({ text: "Detected" }) === "pos", "ab pos");
ok(T.abState({ v: 0 , text: ""}) === "neg", "ab zero");
ok(T.abState({ v: 45, text: "" }) === "unknown", "ab numeric");
ok(T.abState(null) === null, "ab none");

// new start, before window
let r = T.assess({ drugId: "infliximab", startT: now - 5 * 7 * DAY }, {}, now, false);
ok(keys(r).includes("due"), "due before week 12");
// week 16, no level
r = T.assess({ drugId: "infliximab", startT: now - 16 * 7 * DAY }, {}, now, false);
ok(keys(r).includes("post-missing"), "post-induction missing");
// week 15 with level at week 14 in target
r = T.assess({ drugId: "infliximab", startT: now - 15 * 7 * DAY }, { ifx: [{ t: now - 7 * DAY, v: 9 }] }, now, false);
ok(keys(r).join() === "ok", "post-induction ok " + keys(r));
// post-induction low (6 < 7)
r = T.assess({ drugId: "infliximab", startT: now - 15 * 7 * DAY }, { ifx: [{ t: now - 7 * DAY, v: 6 }], ifxab: [{ t: now - 7 * DAY, text: "Not detected" }] }, now, false);
ok(r.interp.key === "low-noab", "post-ind low no ab");
// maintenance 6 is fine for infliximab
r = T.assess({ drugId: "infliximab", startT: now - 100 * 7 * DAY }, { ifx: [{ t: now - 30 * DAY, v: 6 }] }, now, false);
ok(r.interp.key === "ok", "maint 6 ok");
// low with antibodies
r = T.assess({ drugId: "infliximab", startT: now - 100 * 7 * DAY }, { ifx: [{ t: now - 3 * DAY, v: 1.2 }], ifxab: [{ t: now - 3 * DAY, text: "Detected" }] }, now, true);
ok(r.interp.key === "low-ab" && !keys(r).includes("reactive"), "low with ab, recent level so no reactive flag");
// active, in target -> mechanism failure
r = T.assess({ drugId: "adalimumab", startT: now - 60 * 7 * DAY }, { ada: [{ t: now - 5 * DAY, v: 11 }] }, now, true);
ok(r.interp.key === "ok-active", "mechanistic");
// active, no level -> reactive + none
r = T.assess({ drugId: "adalimumab", startT: now - 60 * 7 * DAY }, {}, now, true);
ok(keys(r).includes("reactive") && keys(r).includes("none"), "reactive + none");
// old level
r = T.assess({ drugId: "adalimumab", startT: now - 200 * 7 * DAY }, { ada: [{ t: now - 500 * DAY, v: 10 }] }, now, false);
ok(keys(r).includes("old"), "old level");
// low, antibody not tested
r = T.assess({ drugId: "adalimumab", startT: now - 60 * 7 * DAY }, { ada: [{ t: now - 5 * DAY, v: 3 }] }, now, false);
ok(r.interp.key === "low-noabtest", "low, no ab test");
// antibody far from level is ignored
r = T.assess({ drugId: "adalimumab", startT: now - 60 * 7 * DAY }, { ada: [{ t: now - 5 * DAY, v: 3 }], adaab: [{ t: now - 200 * DAY, text: "Detected" }] }, now, false);
ok(r.interp.key === "low-noabtest", "distant ab ignored");
// flaring early in therapy: reactive only, no "due" note
r = T.assess({ drugId: "infliximab", startT: now - 8 * 7 * DAY }, {}, now, true);
ok(keys(r).join() === "reactive", "flare early " + keys(r));
// unknown drug
ok(T.assess({ drugId: "vedolizumab", startT: 0 }, {}, now, false) === null, "non anti-TNF");
console.log(`${p} passed, ${f} failed`); process.exit(f ? 1 : 0);
