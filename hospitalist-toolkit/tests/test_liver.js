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
console.log(fail ? fail + " FAILED" : "all passed"); process.exit(fail ? 1 : 0);
