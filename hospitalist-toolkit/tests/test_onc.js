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

// ---- leukemia / lymphoma ----
const dc = (t) => R.detectCancers(t, []);
eq("AML detected", Object.keys(dc(["Acute myeloid leukemia"])).join(), "leuk");
eq("AML subtype", dc(["Acute myeloid leukemia"]).leuk.sub.join(), "aml");
eq("APL not also AML", dc(["Acute promyelocytic leukemia"]).leuk.sub.join(), "apl");
eq("'ALL' uppercase = leukemia", dc(["Pre-B ALL in remission"]).leuk.sub.join(), "all");
eq("'all' lowercase is not leukemia", Object.keys(dc(["Pain in all joints"])).join(), "");
eq("leukemoid reaction is not leukemia", Object.keys(dc(["Leukemoid reaction"])).join(), "");
eq("lymphadenopathy is not lymphoma", Object.keys(dc(["Generalized lymphadenopathy"])).join(), "");
eq("non-Hodgkin is not Hodgkin", dc(["Non-Hodgkin lymphoma, diffuse large B-cell"]).lymph.sub.join(), "dlbcl");
eq("Hodgkin", dc(["Classical Hodgkin lymphoma"]).lymph.sub.join(), "hodgkin");
eq("topical tretinoin is not ATRA", m("tretinoin 0.05% cream topical"), "");
eq("low-dose weekly methotrexate is not chemo", m("methotrexate 15 mg PO weekly"), "");
eq("high-dose methotrexate", m("methotrexate 3.5 g/m2 IV"), "Methotrexate (high-dose or intrathecal)");
eq("ice chips are not R-ICE", m("ice chips PRN"), "");
ok("G: hyperleukocytosis red", has(FL[6], /WBC 142: hyperleukocytosis/, "red"));
ok("G: DIC red", has(FL[6], /Fibrinogen 1.2/, "red"));
ok("G: TLS red", has(FL[6], /tumour lysis/, "red"));
ok("G: pseudohyperkalemia note", has(FL[6], /pseudohyperkalemia/));
ok("H: differentiation syndrome red", has(FL[7], /differentiation syndrome/, "red"));
ok("H: QTc arsenic + ondansetron", has(FL[7], /QTc: Arsenic trioxide with ondansetron/));
ok("I: venetoclax + posaconazole", has(FL[8], /Venetoclax with a strong CYP3A4 inhibitor/, "amber"));
ok("I: venetoclax ramp-up", has(FL[8], /ramp-up/));
ok("I: CLL WBC 86 no leukostasis flag", !has(FL[8], /hyperleukocytosis/));
ok("J: febrile neutropenia", has(FL[9], /Febrile neutropenia: ANC 0.2/, "red"));
ok("J: vincristine + azole red", has(FL[9], /Vincristine with an azole/, "red"));
ok("K: HD-MTX + creatinine rise red", has(FL[10], /High-dose methotrexate with a creatinine rise/, "red"));
ok("K: HD-MTX interactions", has(FL[10], /pantoprazole, sulfamethoxazole/));
ok("K: no duplicate generic methotrexate kidney flag", !has(FL[10], /Creatinine rise on methotrexate/));
ok("APL without ATRA → start ATRA", has(R.flags(C.parse({ patient: {}, conditions: [{ code: { text: "Acute promyelocytic leukemia" } }], medreqs: [], obs: [] }, { now }), now), /start ATRA now/, "red"));
const mp = C.parse({ patient: {}, conditions: [{ code: { text: "B-cell acute lymphoblastic leukemia" } }], obs: [], medreqs: [{ status: "active", medicationCodeableConcept: { text: "mercaptopurine 50 mg PO daily" } }, { status: "active", medicationCodeableConcept: { text: "allopurinol 100 mg PO daily" } }] }, { now });
ok("mercaptopurine + allopurinol red", has(R.flags(mp, now), /Mercaptopurine\/thioguanine with allopurinol/, "red"));

// ---- bladder, melanoma, head & neck, kidney, pancreas ----
const k1 = (t) => Object.keys(R.detectCancers(t, [])).join(",");
eq("bladder", k1(["Urothelial carcinoma of bladder"]), "bladder");
eq("neurogenic bladder is not cancer", k1(["Neurogenic bladder"]), "");
eq("melanoma", k1(["Malignant melanoma of skin of back"]), "melanoma");
eq("melanoma lung mets stays melanoma", k1(["Melanoma metastatic to lung"]), "melanoma");
eq("head and neck", k1(["Squamous cell carcinoma of base of tongue"]), "hn");
eq("RCC", k1(["Clear cell renal cell carcinoma"]), "kidney");
eq("CKD is not kidney cancer", k1(["Chronic kidney disease stage 3"]), "");
eq("kidney mets from lung stays lung", k1(["Adenocarcinoma of lung", "Secondary malignant neoplasm of kidney"]), "lung");
eq("pancreas", k1(["Adenocarcinoma of head of pancreas"]), "panc");
eq("IPMN is not pancreatic cancer", k1(["Intraductal papillary mucinous neoplasm of pancreas"]), "");
eq("BCG", m("BCG intravesical weekly"), "Intravesical BCG");
eq("'practice' is not BCG", m("practice dose"), "");
ok("L: enfortumab glucose red (single flag)", FL[11].filter((x) => /Glucose 22.4/.test(x.text)).length === 1 && has(FL[11], /enfortumab/, "red"));
ok("L: enfortumab rash red", has(FL[11], /Rash on enfortumab/, "red"));
ok("L: conduit acidosis", has(FL[11], /ileal conduit/));
ok("M: BRAF pyrexia", has(FL[12], /BRAF\/MEK pyrexia/));
ok("M: immunotherapy low TSH", has(FL[12], /TSH 0.05 on immunotherapy/));
ok("M: Na on ICI mentions cortisol", has(FL[12], /Na 129.*cortisol/));
ok("N: tracheostomy airway red", has(FL[13], /airway issue/, "red"));
ok("N: sentinel bleed red", has(FL[13], /sentinel/, "red"));
ok("O: diltiazem + TKI", has(FL[14], /diltiazem or verapamil/));
ok("O: hypercalcemia", has(FL[14], /Corrected Ca 3.1/, "red"));
ok("O: TKI surgery hold text", has(FL[14], /VEGF TKI: check BP/));
ok("P: cholangitis red", has(FL[15], /cholangitis/, "red"));
ok("P: no enzymes info", has(FL[15], /pancrelipase/));
ok("P: VTE risk", has(FL[15], /highest VTE risks/));

// ---- drug list by class ----
const DL = require("../tools/onc/druglist.js");
ok("drug list: every row has name, schedule, common, watch", DL.GROUPS.every((g) => g.rows.every((r) => r.n && r.sched && r.common && r.watch && r.m instanceof RegExp)));
ok("drug list: at least 15 classes and 80 drugs", DL.GROUPS.length >= 15 && DL.GROUPS.reduce((a, g) => a + g.rows.length, 0) >= 80);
const pick = (meds) => [...DL.forPatient(meds)].map((k) => { const [g, r] = k.split(":"); return DL.GROUPS[g].rows[r].n; });
ok("drug list: FOLFIRI highlights 5-FU and irinotecan", (() => { const n = pick(["FOLFIRI every 2 weeks"]); return n.includes("5-Fluorouracil (5-FU)") && n.includes("Irinotecan"); })());
ok("drug list: R-CHOP highlights rituximab, cyclophosphamide, doxorubicin, vincristine", (() => { const n = pick(["R-CHOP every 21 days"]).join("|"); return /Rituximab/.test(n) && /Cyclophosphamide/.test(n) && /Doxorubicin/.test(n) && /Vincristine/.test(n); })());
ok("drug list: T-DXd is not plain trastuzumab", (() => { const n = pick(["trastuzumab deruxtecan 5.4 mg/kg"]); return n.length === 1 && /deruxtecan/.test(n[0]); })());
ok("drug list: nab-paclitaxel is not paclitaxel", (() => { const n = pick(["nab-paclitaxel 125 mg/m2"]); return n.length === 1 && n[0] === "Nab-paclitaxel"; })());
ok("drug list: topical tretinoin not ATRA", pick(["tretinoin 0.05% cream"]).length === 0);
ok("drug list: acetaminophen matches nothing", pick(["acetaminophen 650 mg PO q6h"]).length === 0);

// note
const n = R.note({ cancer: "Lung cancer", intent: "palliative", treatment: ["Osimertinib"], flags: ["x"], code: "M2", decision: "hold osimertinib" });
ok("note has intent, drug, decision", /Intent: palliative/.test(n) && /Osimertinib/.test(n) && /My decision: hold osimertinib/.test(n));

console.log(fail ? `\n${fail} FAILED` : "\nall passed");
process.exit(fail ? 1 : 0);
