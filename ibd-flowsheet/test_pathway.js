global.window = global; require("./data.js"); const R = require("./rules.js"); const P = require("./pathway.js");
let pass = 0, fail = 0; const ok = (n, c, x) => { console.log((c ? "PASS " : "FAIL ") + n + (!c && x ? " | " + JSON.stringify(x).slice(0, 200) : "")); c ? pass++ : fail++; };
const ids = new Set(); window.IBD.CLASSES.forEach((c) => c.drugs.forEach((d) => ids.add(d.id)));
ok("every tier drug id exists in the drug list", Object.values(P.TIERS).every((d) => Object.values(d).every((t) => ["H", "M", "L"].every((k) => (t[k] || []).every((id) => ids.has(id))))));
const t = (d, h) => P.options(d, h).tiers.reduce((a, [k, , l]) => (a[k] = l, a), {});
ok("UC naive: adalimumab is lower tier, infliximab and vedolizumab higher", t("uc", "naive").L.includes("adalimumab") && t("uc", "naive").H.includes("infliximab") && t("uc", "naive").H.includes("vedolizumab"));
ok("UC exposed: tofacitinib/upadacitinib/ustekinumab higher, vedolizumab lower", ["tofacitinib", "upadacitinib", "ustekinumab"].every((x) => t("uc", "exposed").H.includes(x)) && t("uc", "exposed").L.includes("vedolizumab"));
ok("UC includes S1P, Crohn does not", t("uc", "naive").H.includes("ozanimod") && !JSON.stringify(P.TIERS.cd).includes("ozanimod"));
ok("CD naive: upadacitinib and certolizumab lower; IL-23s higher", t("cd", "naive").L.includes("upadacitinib") && t("cd", "naive").L.includes("certolizumab") && ["risankizumab", "guselkumab", "mirikizumab"].every((x) => t("cd", "naive").H.includes(x)));
ok("CD exposed: vedolizumab and certolizumab lower", t("cd", "exposed").L.includes("vedolizumab") && t("cd", "exposed").L.includes("certolizumab"));
ok("no empty tier is returned", P.options("cd", "naive").tiers.every((x) => x[2].length));
// history from medication states
const mk = (id, cls, status) => ({ drug: { id, label: id }, cls: { id: cls }, status });
ok("history: naive when only 5-ASA and steroids", P.history([mk("mesalamine", "asa", "current"), mk("prednisone", "steroid", "past")], R.ADVANCED).exposed === false);
ok("history: exposed with a past biologic", P.history([mk("infliximab", "tnf", "past")], R.ADVANCED).exposed === true);
ok("history: not exposed if status none", P.history([mk("infliximab", "tnf", "none")], R.ADVANCED).exposed === false);
// notes
const n = (f, d) => P.notes(f, d).map((x) => x.id);
ok("TB and HBV urgent notes", n({ tb: true }, "uc").includes("tb") && P.notes({ hbv: true }, "cd")[0].level === "urgent");
ok("JAK caution at age 50 or with CV risk, not at 30", n({ age: 50 }, "uc").includes("jak") && n({ age: 30, cvrisk: true }, "cd").includes("jak") && !n({ age: 30 }, "cd").includes("jak"));
ok("S1P note only for UC", n({ age: 30 }, "uc").includes("s1p") && !n({ age: 30 }, "cd").includes("s1p"));
ok("pregnancy lists JAK and S1P", P.notes({ age: 30, preg: true }, "uc").find((x) => x.id === "preg").drugs.includes("ozanimod"));
ok("perianal note only for Crohn", n({ age: 30, perianal: true }, "cd").includes("perianal") && !n({ age: 30, perianal: true }, "uc").includes("perianal"));
ok("heart failure flags all anti-TNF", P.notes({ age: 30, hf: true }, "uc")[0].drugs.length === 4);
// stage choice
ok("stage: UC acute", P.stage("uc", { acute: true }) === "asuc");
ok("stage: UC mild score", P.stage("uc", { band: "mild" }) === "mild" && P.stage("uc", { band: "remission" }) === "mild");
ok("stage: UC moderate -> adv", P.stage("uc", { band: "moderate" }) === "adv");
ok("stage: CD mild without high-risk -> mild; with -> adv", P.stage("cd", { band: "mild" }) === "mild" && P.stage("cd", { band: "mild", highrisk: true }) === "adv");
ok("stage: CD perianal/postop", P.stage("cd", { perianal: true }) === "perianal" && P.stage("cd", { postop: true }) === "postop");
ok("ladder stage ids unique and have text", ["uc", "cd"].every((d) => new Set(P.LADDER[d].map((x) => x.id)).size === P.LADDER[d].length && P.LADDER[d].every((x) => x.lines.length && x.src)));
ok("sources have https links", P.SOURCES.length === 3 && P.SOURCES.every(([, u]) => /^https:\/\//.test(u)));
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
