/* node tests/test_liver.js  - hand-worked checks of the liver scores (values in SI units) */
const S = require("../tools/liver/scores.js");
let fail = 0;
const eq = (name, got, want) => { const ok = got === want; if (!ok) fail++; console.log((ok ? "ok   " : "FAIL ") + name + ": got " + got + ", want " + want); };
const mg = (b) => b * 17.1, cr = (c) => c * 88.4;

// bili 2 mg/dL, INR 1.5, Cr 1.2 mg/dL, Na 130: MELD(i) 1.5336 -> 15; MELD-Na 15 + 1.32*7 - 0.033*15*7 = 20.775 -> 21
let m = S.meld({ bili: mg(2), creat: cr(1.2), inr: 1.5, na: 130 });
eq("MELD example", m.meld, 15); eq("MELD-Na example", m.meldNa, 21);
// normal labs: MELD(i) 0.643 -> 6; no Na correction at MELD <= 11
m = S.meld({ bili: 10, creat: 70, inr: 1.0, na: 140 });
eq("MELD normal", m.meld, 6); eq("MELD-Na normal", m.meldNa, 6);
// dialysis sets creatinine to 4 mg/dL: 0.957*ln4 + 0.643 = 1.9697 -> 20
m = S.meld({ bili: 10, creat: 70, inr: 1.0, na: 137, dialysis: true });
eq("MELD dialysis", m.meld, 20);
// creatinine above 4 mg/dL capped
eq("MELD creat cap", S.meld({ bili: 10, creat: cr(9), inr: 1 }).meld, 20);
// ceiling 40
eq("MELD max", S.meld({ bili: mg(40), creat: cr(4), inr: 6, na: 120 }).meldNa, 40);
// sodium bounded at 125 (120 counts as 125)
eq("Na floor", S.meld({ bili: mg(2), creat: cr(1.2), inr: 1.5, na: 120 }).meldNa, S.meld({ bili: mg(2), creat: cr(1.2), inr: 1.5, na: 125 }).meldNa);
// missing INR -> no score
eq("MELD missing", S.meld({ bili: 30, creat: 90 }), null);

// MELD 3.0: normal male = 6, normal female = 7 (1.33 + 6)
eq("MELD3 normal male", S.meld3({ bili: 10, creat: 70, inr: 1, na: 137, alb: 40, sex: "male" }).meld3, 6);
eq("MELD3 normal female", S.meld3({ bili: 10, creat: 70, inr: 1, na: 137, alb: 40, sex: "female" }).meld3, 7);
// female, bili 2, INR 1.5, Cr 1.2, Na 130, albumin 2.8 g/dL: worked by hand = 21.84 -> 22
eq("MELD3 example", S.meld3({ bili: mg(2), creat: cr(1.2), inr: 1.5, na: 130, alb: 28, sex: "female" }).meld3, 22);

// Child-Pugh: bili 34.2 (2) + alb 28 (2) + INR 1.5 (1) + ascites 2 + HE 1 = 8, class B
let c = S.childPugh({ bili: mg(2), alb: 28, inr: 1.5, ascites: 2, he: 1 });
eq("CP score", c.score, 8); eq("CP class", c.cls, "B");
// cut-off edges
eq("CP bili 33 -> 1", S.childPugh({ bili: 33, alb: 40, inr: 1, ascites: 1, he: 1 }).score, 5);
eq("CP bili 51 -> 3", S.childPugh({ bili: 51, alb: 40, inr: 1, ascites: 1, he: 1 }).score, 7);
eq("CP alb 35 -> 2", S.childPugh({ bili: 10, alb: 35, inr: 1, ascites: 1, he: 1 }).score, 6);
eq("CP INR 2.3 -> 2", S.childPugh({ bili: 10, alb: 40, inr: 2.3, ascites: 1, he: 1 }).score, 6);
eq("CP INR 2.4 -> 3", S.childPugh({ bili: 10, alb: 40, inr: 2.4, ascites: 1, he: 1 }).score, 7);
// cholestatic cut-offs: bili 60 scores 1 in PBC/PSC, 3 otherwise
eq("CP cholestatic", S.childPugh({ bili: 60, alb: 40, inr: 1, ascites: 1, he: 1, cholestatic: true }).score, 5);
// missing clinical items -> range
c = S.childPugh({ bili: 10, alb: 40, inr: 1 });
eq("CP range lo", c.lo, 5); eq("CP range hi", c.hi, 9); eq("CP incomplete", c.score, null);

// unit conversion
eq("bili mg/dL", Math.round(S.toSI.bili(2, "mg/dL") * 10) / 10, 34.2);
eq("creat mg/dL", Math.round(S.toSI.creat(1, "mg/dL") * 10) / 10, 88.4);
eq("alb g/dL", S.toSI.alb(3.2, "g/dL"), 32);

// ---------- rules ----------
const R = require("../tools/liver/rules.js"), D = 864e5, now = Date.now();
const near = (name, got, want, tol) => { const ok = got != null && Math.abs(got - want) <= (tol || 0.5); if (!ok) fail++; console.log((ok ? "ok   " : "FAIL ") + name + ": got " + got + ", want ~" + want); };
// eGFR: CKD-EPI 2021, creatinine 88.4 umol/L (1.0 mg/dL), 60 y male -> about 86
near("eGFR 60M Cr 1.0", R.egfr(88.4, 60, "male"), 86, 1.5);
near("back-calc gives eGFR 75", R.egfr(R.crForEgfr(75, 60, "male"), 60, "male"), 75, 0.01);
// Cockcroft-Gault: (140-60)*70*1.23/100 = 68.9
near("CrCl", R.crcl(100, 60, 70, "male"), 68.9, 0.1);
// AKI: baseline lowest in 3 months = 74; now 182 -> 2.46x stage 2
let a = R.aki([{ t: now - 60 * D, v: 74 }, { t: now - 5 * D, v: 118 }, { t: now - 3 * D, v: 145 }, { t: now, v: 182 }]);
eq("AKI yes", a.isAki, true); eq("AKI baseline", a.base, 74); eq("AKI stage", a.stage, 2);
// stage 1A: 80 -> 110 in 24 h (rise 30, ratio 1.375), below 133
a = R.aki([{ t: now - 30 * D, v: 80 }, { t: now - 1 * D, v: 80 }, { t: now, v: 110 }]);
eq("AKI 1A by 48h rise", a.sub, "1A");
// no AKI: 80 -> 100 (ratio 1.25, rise 20)
eq("no AKI", R.aki([{ t: now - 10 * D, v: 80 }, { t: now, v: 100 }]).isAki, false);
// stage 3 by creatinine >= 353.6 with a rise
eq("AKI stage 3 by level", R.aki([{ t: now - 20 * D, v: 250 }, { t: now - 1 * D, v: 250 }, { t: now, v: 360 }]).stage, 3);
// manual baseline wins
eq("manual baseline", R.aki([{ t: now - 20 * D, v: 60 }, { t: now, v: 130 }], { manualBaseline: 100 }).isAki, false);
// FENa: uNa 10, uCr 8 mmol/L, pNa 130, pCr 180 -> 10*180/(130*8000)*100 = 0.173%
near("FENa", R.fena(10, 8, "mmol/L", 130, 180), 0.173, 0.001);
// MAP
eq("MAP", Math.round(R.mapOf(120, 60)), 80);
// fluid: WBC 900, 60% PMN = 540 -> SBP; RBC 25000 corrects by 100 -> 440
let fl = R.fluid({ wbc: 900, pmnPct: 60, rbc: 25000, alb: 8, prot: 9, culture: "No growth" }, { alb: 28 });
eq("SBP", fl.sbp, true); near("PMN corrected", fl.corr, 440, 0.1); eq("SAAG 20", fl.saag, 20); eq("portal", fl.portal, true); eq("low protein", fl.lowProt, true);
// PMN 200 + culture positive -> bacterascites
fl = R.fluid({ pmn: 200, culture: "Escherichia coli isolated" }, {});
eq("bacterascites", fl.bacterascites, true);
// secondary peritonitis: PMN 3000, protein 22, glucose 1.5, LDH 400
fl = R.fluid({ pmn: 3000, prot: 22, glu: 1.5, ldh: 400 }, { ldhUln: 225 });
eq("secondary (Runyon)", fl.secondary, true);
// albumin doses
eq("SBP albumin d1 70 kg", R.albuminSbp(70).d1, 105); eq("SBP albumin d3", R.albuminSbp(70).d3, 70);
eq("LVP 8 L", R.albuminLvp(8).lo, 50); eq("LVP 8 L hi", R.albuminLvp(8).hi, 65); eq("LVP 4 L none", R.albuminLvp(4), null);
// primary prophylaxis
eq("prophylaxis yes", R.sbpProphylaxis({ prot: 10, na: 128 }).meets, true);
eq("prophylaxis no", R.sbpProphylaxis({ prot: 10, na: 135, cr: 80 }).meets, false);
eq("prophylaxis protein high", R.sbpProphylaxis({ prot: 20, na: 120 }), null);
// HRS: all yes
let h = R.hrs({ ascites: true, aki: R.aki([{ t: now - 60 * D, v: 74 }, { t: now, v: 182 }]), volGiven: true, crAtVol: 170, hoursSinceVol: 30, altCauses: [], manual: { noalt: "yes" } });
eq("HRS met", h.result, "yes");
// improved after albumin -> not HRS
h = R.hrs({ ascites: true, aki: R.aki([{ t: now - 60 * D, v: 74 }, { t: now, v: 130 }]), volGiven: true, crAtVol: 170, hoursSinceVol: 30, altCauses: [] });
eq("HRS excluded by response", h.result, "no");
// nutrition: 80 kg, moderate ascites (-10%) -> dry 72; 170 cm BMI 24.9; 35 kcal/kg = 2520 -> 2500; protein 86-108 -> 85-110
let n = R.nutrition({ wt: 80, ht: 170, ascitesLevel: 2, sex: "male" });
near("dry weight", n.dry, 72, 0.01); eq("kcal", n.kcal[0], 2500); eq("protein lo", n.prot[0], 85); eq("protein hi", n.prot[1], 110);
// VTE
eq("Padua", R.padua({ mobility: true, age: true, infection: true }), 5);
eq("VTE start", R.vte({ padua: 5, plt: 90, crcl: 60 }).state, "start");
eq("VTE low plt", R.vte({ padua: 5, plt: 40 }).state, "mechanical");
eq("VTE low risk", R.vte({ padua: 2, plt: 150 }).state, "low");
eq("VTE renal dose", /enoxaparin 30/.test(R.vte({ padua: 5, plt: 150, crcl: 25 }).head), true);
eq("VTE therapeutic", R.vte({ therapeutic: "apixaban" }).state, "na");
console.log(fail ? fail + " FAILED" : "all passed"); process.exit(fail ? 1 : 0);
