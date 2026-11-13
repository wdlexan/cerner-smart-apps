const A = require("./asuc.js");
let p = 0, f = 0; const eq = (a, b, m) => { if (JSON.stringify(a) === JSON.stringify(b)) p++; else { f++; console.log("FAIL", m, a, b); } };
eq(A.truelove({ stools: 6, hr: 95 }).severe, true, "TW severe with HR");
eq(A.truelove({ stools: 6, hr: 80, temp: 37, hgb: 120, esr: 10 }).severe, false, "TW no systemic sign");
eq(A.truelove({ stools: 5, hr: 120 }).severe, false, "TW <6 stools");
eq(A.truelove({ stools: 8, hgb: 100 }).sys, ["Hb < 105 g/L"], "TW Hb");
eq(A.oxford(9, null).nonResponse, true, ">8 stools");
eq(A.oxford(5, 50).nonResponse, true, "3-8 + CRP>45");
eq(A.oxford(5, 40).nonResponse, false, "3-8 CRP 40");
eq(A.oxford(2, 80).nonResponse, false, "<3 stools");
eq(A.ho(3, false, 35).score, 0, "Ho 0");
eq(A.ho(5, false, 25).score, 2, "Ho 1+1");
eq(A.ho(8, false, 35).band, "Intermediate", "Ho 2");
eq(A.ho(10, false, 35).score, 4, "Ho >9 stools");
eq(A.ho(3, true, 28).failure, "85%", "Ho dilated");
eq(A.ho(null, true, 20), null, "Ho needs stools");
// chart suggestions
const H = 36e5, T = 1e12;
const fx = {
  vitals: [{ t: T - 30 * H, hr: 130 }, { t: T - 20 * H, hr: 98, temp: 38.1 }, { t: T - 2 * H, hr: 88, temp: 37.2 }],
  labs: { hgb: [{ t: T - 50 * H, v: 120 }, { t: T - 5 * H, v: 98 }], esr: [], crp: [{ t: T - 3 * H, v: 62 }],
          alb: [{ t: T - 400 * H, v: 40 }, { t: T - 70 * H, v: 27 }, { t: T - 4 * H, v: 31 }] }
};
const s = A.suggest(fx);
eq(s.hr && s.hr.v, 98, "HR = highest in 24 h before latest (130 is older)");
eq(s.temp && s.temp.v, 38.1, "temp = highest in last 24 h");
eq(s.hgb && s.hgb.v, 98, "Hb latest");
eq(s.esr, null, "ESR missing");
eq(s.crp && s.crp.v, 62, "CRP latest");
eq(s.alb && s.alb.v, 27, "albumin = earliest in 14 days before latest");
eq(A.suggest(null).hr, null, "no chart");
eq(A.truelove({ stools: 7, hr: s.hr.v, temp: s.temp.v, hgb: s.hgb.v }).sys.length, 3, "chart values feed TW");
console.log(`${p} passed, ${f} failed`); process.exit(f ? 1 : 0);
