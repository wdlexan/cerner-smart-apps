/* node tests/test_onc.js - hand-worked checks of the Oncology tab rules, drug matching and chart parsing */
const R = require("../tools/onc/rules.js");
const C = require("../tools/onc/chart.js");
const DR = require("../tools/onc/drugs.js");
const S = require("../tools/onc/samples.js");
let fail = 0;
const ok = (n, c) => { if (!c) fail++; console.log((c ? "ok   " : "FAIL ") + n); };
const eq = (n, g, w) => { const o = g === w; if (!o) fail++; console.log((o ? "ok   " : "FAIL ") + n + ": got " + g + ", want " + w); };
const has = (fl, re, level) => fl.some((x) => re.test(x.text) && (!level || x.level === level));

// corrected calcium: 3.05 + 0.02*(40-32) = 3.21
eq("corrected Ca", R.corrCa(3.05, 32), 3.21);
eq("Ca 3.6 red", R.caLevel(3.6).level, "red");
eq("Ca 2.8 amber", R.caLevel(2.8).level, "amber");
eq("Ca 2.4 green", R.caLevel(2.4).level, "green");
// Cairo-Bishop
eq("TLS 2 criteria = lab TLS", R.tls({ urate: 520, k: 6.1 }).lab, true);
eq("TLS 1 criterion = not TLS", R.tls({ urate: 520, k: 4.0 }).lab, false);
eq("TLS clinical needs creatinine", R.tls({ urate: 520, po4: 1.6, crHigh: true }).clinical, true);
// MASCC: 5+5+4+4+3+3+2 = 26; 3+5+4 = 12
eq("MASCC max", R.mascc({ burden: "5", nohypo: 1, nocopd: 1, solid: 1, nodehyd: 1, outpt: 1, young: 1 }).score, 26);
eq("MASCC 21 low risk", R.mascc({ burden: "5", nohypo: 1, nocopd: 1, solid: 1, nodehyd: 1 }).low, true);
eq("MASCC 12 high risk", R.mascc({ burden: "3", nohypo: 1, nocopd: 1 }).low, false);

// cancer detection
const d = (t) => Object.keys(R.detectCancers(t, [])).join(",");
eq("lung primary", d(["Adenocarcinoma of left lower lobe lung C34.3"]), "lung");
eq("lung mets from colon is colon", d(["Malignant neoplasm of sigmoid colon C18.7", "Secondary malignant neoplasm of lung C78.0"]), "crc");
eq("BPH is not prostate cancer", d(["Benign prostatic hyperplasia N40"]), "");
eq("colon polyp is not cancer", d(["Colonic polyp"]), "");
eq("breast cancer with bone mets", d(["Malignant neoplasm of breast with bone metastases C50.9"]), "breast");
eq("SCLC flagged", R.detectCancers(["Small cell carcinoma of lung"], []).lung.sclc, true);
eq("NSCLC not small cell", R.detectCancers(["Non-small cell lung cancer"], []).lung.sclc, false);

// drug matching
const m = (t) => DR.match([t]).map((x) => x.name).join(",");
eq("pembro", m("pembrolizumab 200 mg IV q3w"), "Pembrolizumab");
eq("T-DXd is not plain trastuzumab", m("trastuzumab deruxtecan 5.4 mg/kg IV"), "Trastuzumab deruxtecan (T-DXd)");
eq("nab-paclitaxel is not paclitaxel", m("nab-paclitaxel 100 mg/m2"), "Nab-paclitaxel");
eq("insulin 'ac' is not an anthracycline", m("insulin lispro 4 units subcut TID ac"), "");
ok("FOLFOX maps to oxaliplatin and 5-FU", /Oxaliplatin/.test(m("FOLFOX every 2 weeks")) && /5-Fluorouracil/.test(m("FOLFOX every 2 weeks")));

// samples end to end
const now = Date.now(), F = S.map((s) => C.parse(s.build(now), { now })), FL = F.map((f) => R.flags(f, now));
ok("A: febrile neutropenia red", has(FL[0], /Febrile neutropenia: ANC 0.3/, "red"));
ok("A: Na 126 amber mentions SCLC", has(FL[0], /Na 126.*small cell/, "amber"));
ok("A: immunotherapy info", has(FL[0], /On immunotherapy/, "info"));
eq("A: Tmax parsed", F[0].tmax48, 38.6);
ok("B: hypercalcemia red", has(FL[1], /Corrected Ca 3.21/, "red"));
ok("B: back pain + bone mets → cord compression", has(FL[1], /spinal cord compression/, "amber"));
ok("B: ribociclib QTc with ondansetron/citalopram", has(FL[1], /QTc: Ribociclib/));
ok("C: Mg 0.45 red (anti-EGFR)", has(FL[2], /Mg 0.45.*anti-EGFR/, "red"));
ok("C: diarrhea on irinotecan red", has(FL[2], /Diarrhea on .*Irinotecan/, "red"));
ok("C: AKI flag", has(FL[2], /Creatinine 84 → 142/));
ok("D: back pain + weakness red", has(FL[3], /weakness.*today/, "red"));
ok("D: enzalutamide + DOAC", has(FL[3], /Enzalutamide.*DOAC/, "amber"));
ok("E: pneumonitis on osimertinib red", has(FL[4], /Pneumonitis\/ILD/, "red"));
ok("E: QTc osimertinib + haloperidol", has(FL[4], /QTc: Osimertinib with haloperidol/));
ok("E: PJP prophylaxis prompt", has(FL[4], /PJP/));
ok("F: abiraterone without prednisone red", has(FL[5], /Abiraterone without prednisone/, "red"));
ok("F: no 'abiraterone + prednisone' line when prednisone missing", !has(FL[5], /Abiraterone \+ prednisone: adrenal/));
ok("F: hydronephrosis", has(FL[5], /Hydronephrosis/));
ok("flags sorted red first", FL.every((fl) => fl.every((x, i) => i === 0 || ["red", "amber", "info", "green"].indexOf(fl[i - 1].level) <= ["red", "amber", "info", "green"].indexOf(x.level))));

// unit conversion: ANC in cells/µL, temp in °F
const raw = { patient: { gender: "male", birthDate: "1950-01-01" }, conditions: [], medreqs: [{ status: "active", medicationCodeableConcept: { text: "docetaxel 75 mg/m2" }, authoredOn: new Date(now - 5 * 864e5).toISOString() }],
  obs: [{ status: "final", code: { coding: [{ code: "751-8" }], text: "Neutrophils" }, effectiveDateTime: new Date(now - 36e5).toISOString(), valueQuantity: { value: 400, unit: "/uL" } },
        { status: "final", code: { coding: [{ code: "8310-5" }], text: "Temperature" }, effectiveDateTime: new Date(now - 36e5).toISOString(), valueQuantity: { value: 101.5, unit: "[degF]" } }] };
const g = C.parse(raw, { now });
eq("ANC /uL → 10^9/L", g.latest.anc.v, 0.4);
eq("°F → °C", g.tmax48, 38.6);
ok("docetaxel + ANC 0.4 + fever → FN red", has(R.flags(g, now), /Febrile neutropenia/, "red"));

// note
const n = R.note({ cancer: "Lung cancer", intent: "palliative", treatment: ["Osimertinib"], flags: ["x"], code: "M2", decision: "hold osimertinib" });
ok("note has intent, drug, decision", /Intent: palliative/.test(n) && /Osimertinib/.test(n) && /My decision: hold osimertinib/.test(n));

console.log(fail ? `\n${fail} FAILED` : "\nall passed");
process.exit(fail ? 1 : 0);
