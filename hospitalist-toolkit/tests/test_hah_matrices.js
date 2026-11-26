/* node tests/test_hah_matrices.js - HaH escalation risk predictor, asthma transfer and death-in-the-home matrices */
const M = require("../tools/hah/hah-matrices.js");
let fail = 0;
const ok = (n, c, x) => { if (!c) fail++; console.log((c ? "ok   " : "FAIL ") + n + (!c && x !== undefined ? " | " + JSON.stringify(x).slice(0, 300) : "")); };
const r = (hf, frail, met, male) => M.escRisk({ hf, frail, met, male });
// all 16 cells of the printed table
const T = [[1,1,1,1,45],[1,1,1,0,35],[1,1,0,1,31],[1,1,0,0,23],[1,0,1,1,26],[1,0,1,0,19],[1,0,0,1,16],[1,0,0,0,11],
           [0,1,1,1,22],[0,1,1,0,15],[0,1,0,1,13],[0,1,0,0,9],[0,0,1,1,11],[0,0,1,0,7],[0,0,0,1,6],[0,0,0,0,4]];
T.forEach(([a,b,c,d,p]) => ok(`risk ${a}${b}${c}${d} = ${p}%`, r(!!a,!!b,!!c,!!d) === p, r(!!a,!!b,!!c,!!d)));
ok("bands", M.escBand(10) === "Low" && M.escBand(11) === "Medium" && M.escBand(20) === "Medium" && M.escBand(22) === "High");
ok("unknown sex: null", r(true, true, true, null) === null);
let g = M.escRange({ hf: false, frail: false, met: false, male: null });
ok("range with sex unknown 4–6", g.min === 4 && g.max === 6 && g.exact === null, g);
g = M.escRange({});
ok("range nothing known 4–45", g.min === 4 && g.max === 45 && g.unknown.length === 4, g);
ok("range exact", M.escRange({ hf: true, frail: false, met: false, male: false }).exact === 11);
ok("cirrhosis MELD-Na 20: not eligible", M.cirrhosisGate("yes", 20).code === "out");
ok("cirrhosis MELD-Na 19: ok", M.cirrhosisGate("yes", 19).code === "ok");
ok("cirrhosis no MELD-Na: needs it", M.cirrhosisGate("yes", null).code === "need");
ok("no cirrhosis: ok", M.cirrhosisGate("no").code === "ok");
let a = M.asthmaResult({ pef: 0, spo2: 0, wob: 0, hr: 0, ms: 0, hx: 0 });
ok("asthma all green: appropriate", a.level === 0 && !a.missing.length, a);
a = M.asthmaResult({ pef: 0, spo2: 1, wob: 0, hr: 0, ms: 0, hx: 0 });
ok("asthma SpO2 90-94 on O2: respirologist", a.level === 1 && /Oxygen/.test(a.drivers[0]), a);
a = M.asthmaResult({ pef: 0, spo2: 0, wob: 0, hr: 0, ms: 0, hx: 2 });
ok("asthma prior ICU: not appropriate", a.level === 2, a);
a = M.asthmaResult({ pef: 0 });
ok("asthma partial: provisional with missing", a.provisional && a.missing.length === 5, a);
ok("death: EDITH -> funeral home, no coroner", JSON.stringify(M.deathPlan("edith").map((x) => x.value)) === JSON.stringify(["No","No","No","HaH physician","Funeral home","Funeral home"]));
ok("death: unexpected full resusc -> ambulance yes, morgue", M.deathPlan("ufull")[2].value === "Yes" && M.deathPlan("ufull")[4].value === "Hospital morgue");
ok("death: unnatural -> coroner + police", M.deathPlan("unnat")[0].value === "Yes" && M.deathPlan("unnat")[1].value === "Yes");
ok("death: DNR unexpected -> no ambulance, medivan", M.deathPlan("udnr")[2].value === "No" && M.deathPlan("udnr")[5].value === "Medivan");
console.log(fail ? `\n${fail} FAILED` : "\nall passed"); process.exit(fail ? 1 : 0);
