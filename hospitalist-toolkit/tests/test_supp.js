/* node tests/test_supp.js - checks of the Supplement interactions tab on made-up patients */
const S = require("../tools/supp/rules.js");
let fail = 0;
const ok = (n, c) => { if (!c) fail++; console.log((c ? "ok   " : "FAIL ") + n); };
const eq = (n, g, w) => { const o = g === w; if (!o) fail++; console.log((o ? "ok   " : "FAIL ") + n + ": got " + g + ", want " + w); };
const keys = (t) => S.matchSupps(t).map((s) => s.key).join(",");
const run = (meds, supps, pt) => S.analyze({ meds: meds.map((text) => ({ text, source: "chart" })), supps: supps.map((x) => (typeof x === "string" ? { text: x, source: "patient" } : x)), pt: pt || {} });
const has = (r, re, sev) => r.findings.some((f) => re.test(f.title) && (!sev || f.sev === sev));

// ---- matching
eq("calcium + D combination", keys("Calcium carbonate 500 mg + vitamin D3 400 IU"), "vitd,calcium");
eq("atorvastatin calcium is not a supplement", keys("atorvastatin calcium 40 mg"), "");
eq("losartan potassium is not a supplement", keys("Losartan potassium 50 mg"), "");
eq("esomeprazole magnesium is not a supplement", keys("esomeprazole magnesium 40 mg"), "");
eq("IV KCl not flagged", keys("KCl 40 mmol IV in NS 1 L"), "");
eq("oral KCl flagged", keys("Potassium chloride ER 20 mEq PO daily"), "potassium");
eq("IV iron not flagged", keys("Iron sucrose 200 mg IV"), "");
eq("IV magnesium sulfate not flagged", keys("Magnesium sulfate 2 g IV"), "");
eq("phytonadione not flagged", keys("Phytonadione 2 mg PO once"), "");
eq("DGL licorice not flagged", keys("DGL licorice chewable"), "");
eq("St John's wort", keys("St. John's Wort 300 mg TID"), "sjw");
eq("K2 MK-7", keys("Vitamin K2 (MK-7) 100 mcg"), "vitk");
eq("COLD-FX is ginseng", keys("Cold-FX 200 mg"), "ginseng");
eq("leucovorin not folic acid", keys("leucovorin calcium 15 mg"), "");
ok("Fosavance is a bisphosphonate as well as vitamin D", S.groupsOf("Fosavance alendronate 70 mg/vitamin D 5600 IU").includes("bisphos"));
eq("biotin dose in mcg", S.parseDose("Biotin 10,000 mcg daily").mg, 10);
eq("vitamin E IU", S.parseDose("vitamin E 800 IU").iu, 800);

// ---- notes scanning
let sc = S.scanText("Potassium 3.2, replaced. Takes vitamin D 1000 IU daily and turmeric. Denies St Johns wort. Iron deficiency anemia. Hair, skin and nails normal. Fish oil 1 g BID. Uses natural products from a naturopath.", "H&P");
const hk = sc.hits.map((h) => h.key);
ok("notes: vitamin D with dose found", hk.includes("vitd"));
ok("notes: turmeric found", hk.includes("turmeric"));
ok("notes: fish oil found", hk.includes("fishoil"));
ok("notes: 'Potassium 3.2' lab not a supplement", !hk.includes("potassium"));
ok("notes: 'Iron deficiency' not a supplement", !hk.includes("iron"));
ok("notes: 'Denies St Johns wort' not a supplement", !hk.includes("sjw"));
ok("notes: exam 'Hair, skin and nails' not biotin", !hk.includes("biotin"));
ok("notes: generic natural-products mention kept", sc.other.length >= 1);

// ---- 1: hip fracture, apixaban, levothyroxine, alendronate, calcium, ginkgo, fish oil, turmeric
let r = run(["Apixaban 2.5 mg PO BID", "Levothyroxine 75 mcg PO daily", "Alendronate 70 mg PO weekly", "Zopiclone 3.75 mg HS", "Calcium carbonate 500 mg + vitamin D3 400 IU PO BID"],
  ["Ginkgo 120 mg", "Fish oil 1000 mg BID", "Turmeric 500 mg", "Melatonin 5 mg"], { age: 86, sex: "female", surgery: true });
ok("1 ginkgo + apixaban bleeding", has(r, /Bleeding risk with antithrombotic/, "Moderate"));
ok("1 three bleeding supplements on a DOAC = High", has(r, /3 bleeding-risk supplements/, "High"));
ok("1 calcium binds levothyroxine", has(r, /Calcium binds thyroid hormone/));
ok("1 calcium binds bisphosphonate", has(r, /Calcium binds oral bisphosphonate/));
ok("1 spacing rows present", r.spacing.length >= 2);
ok("1 surgery hold list", has(r, /Surgery planned/));
ok("1 melatonin + zopiclone at 86 = Moderate", has(r, /Melatonin \+ sedating/, "Moderate"));
ok("1 chart calcium order counted as supplement", r.supps.some((x) => x.supp.key === "calcium" && x.sources.includes("chart")));

// ---- 2: transplant + St John's wort
r = run(["Tacrolimus (Advagraf) 6 mg daily", "Mycophenolate 750 mg BID", "Ramipril 5 mg", "Septra 400/80 daily"], ["St John's wort", "Echinacea", "NoSalt salt substitute", "Probiotic"], { egfr: 35, k: 5.3, transplant: true });
ok("2 SJW + tacrolimus contraindicated", has(r, /St John's wort lowers tacrolimus/, "Contraindicated"));
ok("2 echinacea + immunosuppression", has(r, /Echinacea with immunosuppression/));
ok("2 salt substitute + ACEi with K 5.3 = High", has(r, /Potassium \+ ACE inhibitor/, "High"));
ok("2 salt substitute + TMP", has(r, /Potassium \+ trimethoprim/));
ok("2 K over 5 flag", has(r, /K over 5.0/, "High"));
ok("2 probiotic in transplant", has(r, /Probiotic in an immunocompromised/));

// ---- 3: warfarin
r = run(["Warfarin 5 mg daily", "Ciprofloxacin 500 mg BID"], ["Glucosamine 1500 mg", "Dong quai", "Centrum Silver", "Magnesium oxide 400 mg", "Vitamin K2 100 mcg"], {});
ok("3 dong quai + warfarin High", has(r, /Dong quai raises the INR/, "High"));
ok("3 glucosamine + warfarin", has(r, /Glucosamine/, "Moderate"));
ok("3 vitamin K2 + warfarin High", has(r, /Vitamin K lowers the INR/, "High"));
ok("3 magnesium binds ciprofloxacin", has(r, /Magnesium binds fluoroquinolone/, "Moderate"));

// ---- 4: biotin + troponin, red yeast rice + statin + clarithromycin, licorice + digoxin
r = run(["Atorvastatin 80 mg", "Clarithromycin 500 mg BID", "Furosemide 40 mg", "Digoxin 0.0625 mg"], ["Biotin 10 mg", "Red yeast rice 600 mg", "Licorice root tea"], { k: 3.1, trop: true });
ok("4 biotin + troponin = High", has(r, /falsely LOWER troponin/, "High"));
ok("4 red yeast rice + statin High", has(r, /two statins/, "High"));
ok("4 red yeast rice + clarithromycin High", has(r, /CYP3A4 inhibitor/, "High"));
ok("4 licorice + digoxin High", has(r, /Licorice \+ digoxin/, "High"));
ok("4 licorice with low K High", has(r, /Licorice with low potassium/, "High"));
r = run([], ["Biotin 300 mcg"], {});
ok("4b low-dose biotin, no tests = Low", has(r, /interferes with lab/, "Low"));

// ---- 5: CKD
r = run(["Spironolactone 25 mg", "Levothyroxine 100 mcg"], ["Potassium gluconate 595 mg", "Magnesium citrate 300 mg", "Vitamin C 2000 mg", "Ferrous gluconate 300 mg", "Kelp tablets"], { egfr: 22, k: 5.6 });
ok("5 K + MRA in CKD = High", has(r, /Potassium \+ K-sparing/, "High"));
ok("5 Mg with eGFR < 30", has(r, /Magnesium supplement with eGFR under 30/));
ok("5 vitamin C 2 g with eGFR < 30", has(r, /High-dose vitamin C with eGFR under 30/));
ok("5 iron binds levothyroxine", has(r, /Iron binds thyroid hormone/));
ok("5 kelp + levothyroxine", has(r, /Iodine \/ kelp/));

// ---- 6: serotonergic + liver
r = run(["Sertraline 150 mg", "Tramadol 50 mg q6h", "Lorazepam 1 mg HS", "Ethinyl estradiol/levonorgestrel", "Apixaban 5 mg BID"], ["St John's wort", "5-HTP 100 mg", "Kava", "CBD oil", "Green tea extract"], { alt: 210 });
ok("6 SJW + SSRI High", has(r, /St John's wort \+ serotonergic/, "High"));
ok("6 5-HTP + SSRI High", has(r, /5-HTP \/ tryptophan \+ serotonergic/, "High"));
ok("6 two serotonergic supplements", has(r, /Two serotonergic supplements/));
ok("6 kava with high ALT High", has(r, /Kava with liver disease/, "High"));
ok("6 SJW + OCP", has(r, /hormonal contraception/, "High"));
ok("6 SJW + apixaban", has(r, /lowers DOAC/, "High"));
ok("6 sorted worst first", S.SEV_ORDER[r.findings[0].sev] <= S.SEV_ORDER[r.findings[r.findings.length - 1].sev]);

// ---- nothing to flag
r = run(["Acetaminophen 1 g QID"], ["Vitamin B12 1000 mcg"], {});
eq("unrecognized supplement listed", r.unmatched[0], "Vitamin B12 1000 mcg");
eq("no findings", r.findings.length, 0);

// ---- every rule points at a real group
let bad = [];
S.SUPPS.forEach((s) => s.ix.forEach((x) => x.g.forEach((g) => { if (!S.GROUPS[g]) bad.push(s.key + ":" + g); })));
eq("all interaction groups exist", bad.join(","), "");

console.log(fail ? `\n${fail} FAILED` : "\nall passed");
process.exit(fail ? 1 : 0);
