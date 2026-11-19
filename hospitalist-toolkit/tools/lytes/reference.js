/* Reference cards for the Electrolytes tab: low and high potassium, phosphate and calcium.
   Causes, symptoms, tests and treatment, adult SI units. Written by Claude from general knowledge (UNVERIFIED):
   check against Island Health protocols, UpToDate / local guidance and pharmacy before clinical use. */
(function () {
  const REF = {
    hypoK: {
      title: "Low potassium (hypokalemia)", el: "K",
      grade: "Mild 3.0–3.4 · Moderate 2.5–2.9 · Severe < 2.5, or any level with ECG changes, weakness or arrhythmia.",
      symptoms: "Often none. Weakness, cramps, ileus, constipation; rhabdomyolysis when < 2.5. ECG: flat T, U waves, ST depression, long QU; ectopy, AF, VT/VF (worse with digoxin, ischemia, low Mg).",
      causes: [
        ["Kidney loss", "Loop and thiazide diuretics; osmotic diuresis (glucose); metabolic alkalosis; aldosterone excess (primary hyperaldosteronism, renal artery stenosis, licorice, high-dose steroids); low Mg; amphotericin; RTA type 1 and 2; Bartter/Gitelman."],
        ["GI loss", "Vomiting / NG suction (mostly via kidney with alkalosis); diarrhea, laxatives, high-output stoma or fistula, villous adenoma."],
        ["Shift into cells", "Insulin (DKA treatment), salbutamol and other beta-agonists, refeeding, alkalosis, theophylline/caffeine, thyrotoxic or familial periodic paralysis, rapid cell growth (B12 treatment, GM-CSF)."],
        ["Low intake", "Poor oral intake, alcohol, eating disorder (usually with another cause)."]],
      tests: ["Mg (always), creatinine, glucose, tCO2 / blood gas", "ECG", "Spot urine K and creatinine: K:Cr > 1.5 mmol/mmol = kidney loss; < 1.5 = GI, shift or intake", "If kidney loss and hypertension: renin and aldosterone; if normal BP and alkalosis: urine Cl (vomiting vs diuretic vs Gitelman/Bartter)"],
      treat: [
        ["How much", "100–200 mEq raises K by about 1 mmol/L in acute loss (up to 400 mEq in chronic loss) (local sheet)."],
        ["Mild", "K-Dur 20 mEq SR 1–2 tabs PO BID (40–80 mEq/day). K citrate 25 mEq tabs are easier to take but only ~40% as effective as KCl."],
        ["Moderate", "K-Dur 20 mEq × 2 (40 mEq) PO BID–TID, or KCl elixir 1.33 mEq/mL (dilute; salty). IV: KCl 10 mEq/100 mL peripheral bags, each over at least 30 min."],
        ["Severe or ECG changes", "Cardiac monitor. Peripheral: KCl 10 mEq/100 mL bags, each over at least 30 min. Central only: KCl 20 mEq/50 mL or 40 mEq/100 mL, rate per IV manual. Plus PO if able. IV fluid: premixed KCl 20 or 40 mEq/L (½NS + KCl mixed by pharmacy); not dextrose."],
        ["Always", "Correct Mg (MgSO4 2 g IV, or 5 g if Mg < 0.6). Treat the cause; for ongoing diuretic loss add spironolactone or amiloride rather than more KCl. GFR < 30: 50% dose and monitor more often (local sheet)."],
        ["Targets", "≥ 3.5; ≥ 4.0 with AF, ischemia, heart failure or digoxin. In DKA hold insulin until K ≥ 3.3."]],
      repeat: "SR tablets (K-Dur, Slow-K) release K over 4–8 h: draw the level at least 4 h after the dose; 1–2 h after elixir (local sheet). Severe IV: K 1–2 h after each 40 mEq, then every 4–6 h until > 3.0. Mild: next morning, then daily on KCl or diuretic. Sooner with GFR < 30.",
      pearls: ["Low K that will not correct = low Mg until proven otherwise.", "Hypertension + low K + metabolic alkalosis: think aldosterone excess.", "Periodic paralysis: give small doses; rebound high K is common after the shift reverses."]
    },
    hyperK: {
      title: "High potassium (hyperkalemia)", el: "K",
      grade: "Mild 5.1–5.9 · Moderate 6.0–6.4 · Severe ≥ 6.5, or any level with ECG changes.",
      symptoms: "Weakness, paresthesia, ascending paralysis. ECG: peaked T → long PR, flat P → wide QRS → sine wave, bradycardia, VF or asystole. ECG may be normal even at high K.",
      causes: [
        ["Pseudohyperkalemia", "Hemolysed sample, tight tourniquet / fist clenching, very high platelets (> 500) or WBC (> 50), familial. Repeat as plasma K or on a blood gas."],
        ["Low kidney excretion", "AKI, CKD (eGFR < 30), low aldosterone (diabetes / type 4 RTA, adrenal insufficiency, heparin), urinary obstruction."],
        ["Medications", "ACE inhibitors, ARBs, sacubitril-valsartan, spironolactone, eplerenone, finerenone, amiloride, triamterene, trimethoprim, NSAIDs, heparin/LMWH, tacrolimus/cyclosporine, beta-blockers, digoxin toxicity, succinylcholine, potassium supplements and salt substitutes, pentamidine."],
        ["Shift out of cells", "Insulin deficiency / hyperglycemia (DKA, HHS), metabolic acidosis (mineral acids more than lactic), hyperosmolality, beta-blockers, exercise."],
        ["Cell breakdown", "Rhabdomyolysis, tumour lysis, hemolysis, GI bleed (protein load), crush or burns, massive transfusion."]],
      tests: ["12-lead ECG now if K ≥ 6.0 or symptoms", "Repeat K if pseudohyperkalemia possible (no ECG changes)", "Creatinine and urine output, glucose, blood gas / tCO2, CK, urate/LDH/PO4/Ca if lysis possible, digoxin level if on digoxin", "Medication review; consider cortisol if hypotensive / low Na"],
      treat: [
        ["1. Protect the heart (if ECG changes)", "Calcium gluconate 10% 30 mL (3 g) IV over 5–10 min; repeat if ECG unchanged after 5 min. Calcium chloride 10% 10 mL via central line or in arrest. Onset minutes, lasts 30–60 min; does not lower K."],
        ["2. Shift K into cells", "Insulin regular 10 units IV (5 units if eGFR < 30 or dialysis) + dextrose 25 g (D50W 50 mL) if glucose < 14 mmol/L; glucose every hour for 6 h. Salbutamol 10–20 mg nebulized. Sodium bicarbonate only with metabolic acidosis."],
        ["3. Remove K", "Sodium zirconium cyclosilicate (Lokelma) 10 g PO TID up to 48 h, then 5–10 g daily; patiromer (Veltassa) 8.4 g daily (slow). Furosemide 40–80 mg IV if euvolemic or overloaded and making urine; IV fluid if dry. Dialysis for refractory K, oliguric AKI or ESRD."],
        ["4. Stop the cause", "Hold K supplements, ACEi/ARB/ARNI, MRA, amiloride, trimethoprim, NSAIDs, heparin where possible. Low-K diet (dietitian)."],
        ["Monitoring", "K 1–2 h after shifting, then every 4–6 h: K rebounds as insulin wears off (2–4 h). Cardiac monitor while ≥ 6.0 or ECG changes."]],
      repeat: "After treatment: K at 1, 2, 4, 6 and 24 h; glucose at 0, 15, 30, 60, 90, 120, 180, 240, 300 and 360 min after insulin-glucose; cardiac monitor while K ≥ 6.5 or ECG changes (UK Kidney Association 2023). Mild and stable: within 24–72 h.",
      pearls: ["Insulin + dextrose is the most reliable shift; hypoglycemia occurs in up to 1 in 5, mostly with low eGFR.", "Digoxin toxicity with high K: digoxin immune Fab.", "Restarting RAAS blockers after the episode: often at a lower dose with a binder (benefit in HF and CKD)."]
    },
    hypoPhos: {
      title: "Low phosphate (hypophosphatemia)", el: "PO4",
      grade: "Mild 0.65–0.79 · Moderate 0.32–0.64 · Severe < 0.32 mmol/L (< 1 mg/dL).",
      symptoms: "Usually none until < 0.32: muscle weakness, respiratory failure and failure to wean, heart failure, rhabdomyolysis, hemolysis, confusion, seizures, platelet and WBC dysfunction.",
      causes: [
        ["Shift into cells", "Refeeding (malnutrition, alcohol, eating disorder, prolonged NPO), insulin / DKA treatment, respiratory alkalosis (sepsis, alcohol withdrawal, pain), hungry bone after parathyroidectomy."],
        ["Low intake / absorption", "Poor intake, alcohol, vitamin D deficiency, phosphate binders, calcium carbonate, aluminium / magnesium antacids, chronic diarrhea."],
        ["Kidney loss", "High PTH (primary or secondary hyperparathyroidism), FGF23 (ferric carboxymaltose IV iron, tumour-induced osteomalacia, X-linked), Fanconi (tenofovir, ifosfamide, myeloma, cisplatin), foscarnet, acetazolamide, osmotic diuresis, after kidney transplant."],
        ["Other", "Continuous renal replacement therapy, burns recovery, rapidly growing leukemia/lymphoma."]],
      tests: ["K, Mg, Ca, creatinine, glucose, CK (if weak)", "If cause unclear: urine phosphate and creatinine (fractional excretion of PO4 > 5% with low serum = kidney loss), PTH, 25-OH D, glucose/protein/urate in urine (Fanconi)"],
      treat: [
        ["IV dose (local sheet)", "15 mmol × 2 (30 mmol) if PO4 < 0.3, or < 0.5 in a patient ≥ 60 kg; otherwise 15 mmol. Infuse each over 4–6 h."],
        ["IV products", "Peripheral OK: KPO4 15 mmol PO4 + 22 mmol K in 255 mL; NaPO4 15 mmol + 20 mmol Na in 125 mL; NaPO4 30 mmol + 40 mmol Na in 260 mL. Central only: KPO4 15 mmol in 125 mL; KPO4 30 mmol + 44 mmol K in 255 mL."],
        ["Choosing the salt", "KPO4 usually; NaPO4 if K ≥ 5.0, or GFR < 30 / dialysis with K ≥ 4.5. GFR < 30: 50% dose. Never in the same line as calcium; caution if Ca is high."],
        ["PO", "16–32 mmol/day (diarrhea above 32): sodium phosphate oral solution 4 mmol/mL, 4 mL PO BID; skim milk 8 mmol per 250 mL. Na acid phosphate 500 mg effervescent (16 mmol) is non-formulary."],
        ["Refeeding", "Thiamine 100 mg before feeding; start feeds at 10–20 kcal/kg/day; daily PO4, K, Mg for 3–5 days; dietitian."]],
      repeat: "Acute: 2 h after the IV dose; a level about 72 h later is more accurate, and repeat levels are often unnecessary (local sheet). Refeeding risk: daily PO4, K, Mg for the first 3–5 days of feeding.",
      pearls: ["Low PO4 after ferric carboxymaltose can last weeks and cause osteomalacia with repeat doses.", "In DKA routine phosphate is not needed unless < 0.32 or there is heart failure, respiratory weakness or anemia.", "Low PO4 with low K and low Mg in a thin patient on day 2–4 of feeding: refeeding syndrome."]
    },
    hyperPhos: {
      title: "High phosphate (hyperphosphatemia)", el: "PO4",
      grade: "Above 1.45 mmol/L. Grading in this tool: mild ≤ 2.0, moderate 2.0–3.0, severe > 3.0 (severity depends more on the speed of rise and the calcium).",
      symptoms: "Mostly from the low calcium it causes: tetany, cramps, long QT, seizures. Calcium phosphate deposits (vessels, kidney, skin) and AKI with acute loads (phosphate nephropathy after bowel prep).",
      causes: [
        ["Low kidney excretion", "AKI, CKD (usually eGFR < 30), hypoparathyroidism, pseudohypoparathyroidism, acromegaly, bisphosphonates (mild)."],
        ["Load: from inside", "Tumour lysis, rhabdomyolysis, hemolysis, lactic or ketoacidosis (DKA before insulin), hyperthermia, crush."],
        ["Load: from outside", "Sodium phosphate enemas and bowel preps (Fleet), phosphate supplements, IV phosphate, vitamin D excess."],
        ["False high (pseudohyperphosphatemia)", "Paraproteins (myeloma), high lipids, hemolysed sample, high bilirubin, liposomal amphotericin, heparin in the sample, tPA."]],
      tests: ["Ca (ionized if possible), creatinine, K, urate, LDH, CK, glucose, tCO2", "PTH if chronic and kidney function near normal", "SPEP if the value does not fit the picture (paraprotein artefact)"],
      treat: [
        ["Acute, kidneys working", "Stop intake; IV saline increases excretion. Usually falls within 6–12 h."],
        ["Acute with AKI / tumour lysis", "IV fluid, rasburicase or allopurinol per oncology, nephrology early; dialysis for rising PO4 with symptomatic low Ca or other indications."],
        ["Symptomatic low calcium", "IV calcium for symptoms only: if Ca × PO4 > 4.4 mmol²/L² calcium phosphate may precipitate."],
        ["Chronic (CKD)", "Low-phosphate diet (renal dietitian); binders with meals: calcium carbonate 500–1000 mg elemental TID (avoid if Ca high), sevelamer 800–1600 mg TID, lanthanum 500–1000 mg TID; dialysis adequacy."]],
      repeat: "Tumour lysis: every 6–8 h. AKI: every 12–24 h. Chronic CKD: routine bloods. (Common practice.)",
      pearls: ["Never give a phosphate enema to a patient with low eGFR, ileus or dehydration.", "High PO4 + low Ca + high K + high urate in a cancer patient = tumour lysis until proven otherwise."]
    },
    hypoCa: {
      title: "Low calcium (hypocalcemia)", el: "Ca",
      grade: "Use ionized Ca (< 1.12) or albumin-corrected total Ca (< 2.10). Severe: ionized < 0.90 or corrected < 1.90, or symptoms / long QT at any level.",
      symptoms: "Perioral and finger tingling, cramps, carpopedal spasm (Trousseau, Chvostek), laryngospasm, bronchospasm, seizures, confusion, long QT, heart failure, hypotension.",
      causes: [
        ["False low (pseudohypocalcemia)", "Low albumin (correct, or better measure ionized Ca); gadolinium contrast with some assays; EDTA contamination."],
        ["Low PTH", "After thyroidectomy or parathyroidectomy (hungry bone: low Ca and low PO4), autoimmune, infiltration, radiation, low or very high Mg, activating CaSR variants."],
        ["High PTH (appropriate)", "Vitamin D deficiency or resistance, CKD (low calcitriol, high PO4), pancreatitis, sepsis / critical illness, high PO4 load (tumour lysis, rhabdo early phase), osteoblastic metastases (prostate, breast)."],
        ["Medications", "Bisphosphonates and denosumab (especially with CKD or low vitamin D), cinacalcet / etelcalcetide, foscarnet, loop diuretics, enzyme-inducing antiepileptics, PPIs (via low Mg), citrate (massive transfusion, CRRT/apheresis), cisplatin, calcitonin."],
        ["Alkalosis", "Hyperventilation lowers ionized Ca without changing total."]],
      tests: ["Ionized Ca (or albumin), Mg, PO4, creatinine", "PTH and 25-OH vitamin D", "ECG (QTc)", "Lipase if abdominal pain; CK and urate if lysis / rhabdo"],
      treat: [
        ["First", "Correct Mg if low (magnesium sulfate 2 g IV, or 5 g over 5 h if < 0.6): Ca will not correct otherwise."],
        ["Severe or symptomatic", "Bolus: calcium gluconate 10% 10–20 mL (1–2 g) IV in 50–100 mL D5W over 10–20 min (can repeat). Then infusion (PowerChart order): calcium gluconate 5,000 mg + D5W 500 mL (10 mg/mL, ≈ 0.93 mg elemental Ca/mL): start 50 mL/h, range 50–100 mL/h (0.5–1.5 mg elemental Ca/kg/h ≈ 0.55–1.6 mL/kg/h); bag lasts 10 h at 50 mL/h. Titrate to ionized Ca every 4–6 h. Cardiac monitor. Not with bicarbonate or phosphate; calcium chloride only by central line."],
        ["Mild / chronic", "Calcium carbonate 500–1000 mg elemental PO BID–TID with meals (citrate if on PPI or achlorhydria); vitamin D3 1000–2000 IU daily (more to replete deficiency)."],
        ["Hypoparathyroidism", "Calcitriol 0.25–0.5 mcg BID plus calcium; aim for low-normal calcium (2.0–2.1) to limit hypercalciuria; endocrinology."],
        ["CKD", "Treat only if symptomatic or severe; calcitriol and phosphate control with nephrology."]],
      repeat: "1–2 h after an IV bolus; every 4–6 h on infusion (Society for Endocrinology: titrate to normal calcium); every 12 h for 24–48 h after neck surgery; weekly after discharge until stable.",
      pearls: ["Post-thyroidectomy: PTH on POD 0–1 predicts who needs calcitriol.", "Hungry bone after parathyroidectomy: large calcium needs for days to weeks.", "Before zoledronic acid or denosumab: check Ca and 25-OH D, and replete."]
    },
    hyperCa: {
      title: "High calcium (hypercalcemia)", el: "Ca",
      grade: "Albumin-corrected total Ca: mild 2.56–2.99 · moderate 3.0–3.49 · severe ≥ 3.5 mmol/L (ionized: > 1.32 / ≥ 1.5 / ≥ 1.8). Symptoms raise the urgency at any level.",
      symptoms: "\"Stones, bones, groans, thrones and psychiatric overtones\": thirst, polyuria (nephrogenic DI), dehydration, AKI, constipation, nausea, pancreatitis, ulcer, confusion, drowsiness, coma, short QT, bradycardia.",
      causes: [
        ["PTH-mediated (PTH high or not suppressed)", "Primary hyperparathyroidism (most common outpatient cause), tertiary hyperparathyroidism (CKD, after transplant), lithium, familial hypocalciuric hypercalcemia (FHH: low urine calcium)."],
        ["Malignancy (most common inpatient cause; PTH suppressed)", "PTHrP (squamous cancers, kidney, bladder, breast, ovary), osteolytic metastases (breast, lung), myeloma, calcitriol from lymphoma."],
        ["Vitamin D", "Vitamin D or calcitriol excess; granulomatous disease (sarcoid, TB, fungal) making calcitriol."],
        ["Medications and intake", "Thiazides, calcium carbonate with alkali (milk-alkali syndrome), vitamin A / retinoids, teriparatide / abaloparatide, theophylline, denosumab discontinuation rebound."],
        ["Other", "Immobilization (especially with high bone turnover, Paget), thyrotoxicosis, adrenal insufficiency, pheochromocytoma, recovery phase of rhabdomyolysis AKI."]],
      tests: ["Repeat Ca with albumin or ionized Ca; creatinine, PO4, Mg, ALP", "PTH first", "If PTH low: PTHrP, 25-OH D, 1,25-(OH)2 D, SPEP + serum free light chains, TSH, CXR (then CT if needed)", "If PTH high/normal: 24-h urine Ca or Ca/Cr clearance ratio (< 0.01 suggests FHH), stop lithium/thiazide and repeat", "ECG"],
      treat: [
        ["Mild, no symptoms", "Oral hydration, mobilize, stop thiazides, calcium and vitamin D supplements, lithium if possible; outpatient workup."],
        ["Moderate–severe or symptomatic", "IV 0.9% saline 1 L/h for the first 2–3 h, then 200–300 mL/h (about 4–6 L in 24 h) to urine output 100–150 mL/h; smaller boluses with heart failure, CKD or the elderly."],
        ["Fast bridge", "Calcitonin 4 units/kg SC/IM every 12 h, limited to 48–72 h (tachyphylaxis)."],
        ["Main treatment", "Zoledronic acid 4 mg IV over ≥ 15 min (or pamidronate 60–90 mg IV over 2–4 h); effect in 2–4 days. In cancer-related hypercalcemia the Endocrine Society (2023) suggests denosumab 120 mg SC over a bisphosphonate, and calcitonin plus a bisphosphonate or denosumab first when severe. With eGFR < 30: dose reduction / avoid, or denosumab (no renal adjustment, more hypocalcemia)."],
        ["Cause-specific", "Prednisone 40–60 mg daily for granulomatous disease, lymphoma or vitamin D excess. Cinacalcet for parathyroid carcinoma or when surgery is not possible. Parathyroidectomy for primary HPT that meets criteria."],
        ["Last resort", "Dialysis with low-calcium bath for Ca > 4.0–4.5 with neurologic symptoms or kidney / heart failure preventing fluids. Furosemide only for fluid overload after volume repletion."]],
      repeat: "Ca ≥ 3.5 or symptoms: 6 h after starting saline, then every 6–12 h until falling. 3.0–3.5: every 12–24 h. < 3.0 without symptoms: 24–48 h. Mg, PO4, K daily on IV fluid; Ca on day 2–4 after a bisphosphonate (nadir). No guideline sets fixed intervals: the Society for Endocrinology guidance gives severity bands and the 2–4 day nadir.",
      pearls: ["Hypercalcemia of malignancy usually means advanced disease: a good time for a goals-of-care conversation.", "After a bisphosphonate check Ca, PO4 and Mg: low levels follow in days.", "Calcium-containing antacids plus a PPI/alkali and AKI: milk-alkali syndrome."]
    },
    hypoMg: {
      title: "Low magnesium (hypomagnesemia)", el: "Mg",
      grade: "Mild 0.60–0.69 · Moderate 0.50–0.59 · Severe < 0.50 mmol/L, or any level with tetany, seizure or arrhythmia. Serum Mg is < 1% of body Mg: a normal level does not rule out depletion.",
      symptoms: "Tremor, muscle cramps, weakness, tetany, Chvostek and Trousseau signs, nystagmus, confusion, seizures. ECG: long QT, wide QRS, peaked then flat T; AF, VT, torsades de pointes; more digoxin toxicity. Causes low K (kidney loss) and low Ca (PTH blocked) that will not correct until Mg is replaced.",
      causes: [
        ["GI loss / low intake", "Diarrhea, laxatives, high-output stoma or fistula, malabsorption, short bowel, pancreatitis, alcohol, malnutrition, long-term PPI."],
        ["Kidney loss", "Loop and thiazide diuretics, alcohol, osmotic diuresis (glucose, DKA), aminoglycosides, amphotericin, cisplatin, tacrolimus/cyclosporine, foscarnet, pentamidine, cetuximab/panitumumab, Gitelman/Bartter, recovery from AKI or obstruction."],
        ["Shift into cells", "Refeeding, insulin / DKA treatment, hungry bone after parathyroidectomy, catecholamines."],
        ["Other", "Massive transfusion (citrate), burns, pregnancy and lactation, critical illness."]],
      tests: ["K, Ca (ionized), PO4, creatinine, glucose", "ECG (QTc)", "If cause unclear: urine Mg and creatinine. Fractional excretion of Mg > 2–4% with low serum Mg = kidney loss; < 2% = GI loss or intake"],
      treat: [
        ["Torsades / seizure / severe symptoms", "MgSO4 2 g IV over 10–15 min (1–2 min if pulseless; 2 g vials in crash carts and select units only), cardiac monitor, then the dose below."],
        ["Mg < 0.6 (local sheet)", "MgSO4 5 g in 100 mL NS IV (20 mmol); max rate 2 g/h, slower keeps more (e.g. 4–5 h). Often a second dose when severe."],
        ["Mg 0.6–0.69", "PO: target 20 mmol/day divided (diarrhea above 20): magnesium 250 mg elemental tab BID, or Mg glucoheptonate (Mg Rougier) 30 mL TID. Or MgSO4 2 g in 50 mL NS IV (8 mmol) if needed quickly."],
        ["Kidney function", "GFR < 30 or dialysis: 50% dose (2 g instead of 5 g) and recheck before more."],
        ["Stop the cause", "Stop or reduce a PPI if possible; amiloride or spironolactone for ongoing diuretic loss; thiamine and slow feeds with alcohol or malnutrition."]],
      repeat: "At least 1 h after an IV dose; a level 72 h after is more accurate (local sheet). Daily while replacing. GFR < 30: before every repeat dose.",
      pearls: ["Slow infusions keep more Mg: fast boluses are largely lost in the urine.", "Check Mg ≥ 6 h after an infusion: an early level is falsely high.", "Low K or low Ca that will not correct: replace Mg."]
    },
    hyperMg: {
      title: "High magnesium (hypermagnesemia)", el: "Mg",
      grade: "Mild 1.01–1.99 · Moderate 2.0–2.99 · Severe ≥ 3.0 mmol/L, or symptoms (lost reflexes, hypotension, drowsiness, slow breathing). Almost always kidney failure plus a magnesium load.",
      symptoms: "2–3 mmol/L: nausea, flushing, headache, drowsiness, reduced reflexes. 3–5: loss of patellar reflexes, hypotension, bradycardia, long PR and QRS, urinary retention, ileus. > 5: respiratory depression and paralysis, complete heart block, cardiac arrest. Also lowers calcium (PTH suppressed).",
      causes: [
        ["Magnesium load", "Magnesium hydroxide (milk of magnesia), magnesium citrate and other bowel preps (Pico-Salax, Citro-Mag), Mg antacids and enemas, supplements, IV magnesium sulfate (preeclampsia, asthma, torsades)."],
        ["Low excretion", "AKI or CKD (eGFR < 30), lithium, hypothyroidism, adrenal insufficiency, FHH (mild)."],
        ["Shift out of cells", "Tumour lysis, rhabdomyolysis, hemolysis, DKA before insulin."]],
      tests: ["Creatinine, K, Ca (ionized), PO4", "ECG", "Patellar reflexes, respiratory rate, BP, level of consciousness"],
      treat: [
        ["All", "Stop all magnesium (laxatives, antacids, enemas, bowel prep, supplements, IV Mg)."],
        ["Mild, no symptoms", "Stop intake; falls on its own if the kidneys work."],
        ["Moderate", "IV 0.9% saline plus furosemide 20–40 mg IV if kidneys work and volume allows; check reflexes each shift."],
        ["Severe or symptomatic", "Calcium gluconate 10% 10–20 mL (1–2 g) IV over 10 min as an antagonist (repeat as needed), cardiac monitor, support breathing (be ready to ventilate). Dialysis with nephrology if eGFR low or Mg stays ≥ 3 with symptoms."]],
      repeat: "Severe: Mg, Ca, K, creatinine every 4–6 h until < 2.0, with hourly reflexes, respiratory rate and BP. Moderate: every 12–24 h. Mild: next routine bloods. (Common practice.)",
      pearls: ["Loss of patellar reflexes comes before respiratory depression: check them.", "Milk of magnesia or Mg-containing bowel prep in an older patient with CKD is the classic ward cause.", "Magnesium is cleared by dialysis; calcium only buys time."]
    }
  };
  /* what is stocked: local electrolyte replacement sheet (R. Wanbon, PharmD, Dec 2014). Confirm with pharmacy: the sheet may be out of date. */
  const PRODUCTS = {
    K: [["IV, premixed 1 L", "KCl 20 mEq/L and 40 mEq/L (see pharmacy therapeutic interchange list); ½NS + KCl must be mixed by pharmacy"],
      ["IV, peripheral", "KCl 10 mEq/100 mL (sterile water base): each bag over at least 30 min"],
      ["IV, central only", "KCl 20 mEq/50 mL; KCl 40 mEq/100 mL (rate per IV manual)"],
      ["IV with phosphate", "KPO4 15 mmol PO4 + 22 mmol K in 250 mL (peripheral OK) or 125 mL (central); KPO4 30 mmol + 44 mmol K in 255 mL (central); over 4–6 h"],
      ["PO", "KCl 8 mEq SR (Slow-K); KCl 20 mEq SR (K-Dur): level ≥ 4 h after. KCl elixir 1.33 mEq/mL (dilute; level 1–2 h after). K citrate 25 mEq tabs (~40% as effective)"]],
    phos: [["IV, peripheral OK", "KPO4 15 mmol + 22 mmol K in 255 mL; NaPO4 15 mmol + 20 mmol Na in 125 mL; NaPO4 30 mmol + 40 mmol Na in 260 mL"],
      ["IV, central only", "KPO4 15 mmol + 22 mmol K in 125 mL; KPO4 30 mmol + 44 mmol K in 255 mL"],
      ["IV rule", "Over 4–6 h. 15 mmol × 2 if PO4 < 0.3, or < 0.5 and ≥ 60 kg; otherwise 15 mmol. Level 2 h after if acute; 72 h level more accurate"],
      ["PO", "Sodium phosphate solution 4 mmol/mL (oral Fleet) 4 mL BID; Na acid phosphate 500 mg effervescent = 16 mmol (NON-FORMULARY) 1 tab BID; skim milk 8 mmol/250 mL. Aim 16–32 mmol/day"]],
    Ca: [["IV infusion (PowerChart)", "Calcium gluconate (additive) 5,000 mg + Dextrose 5% in Water 500 mL = 10 mg/mL (≈ 0.93 mg elemental Ca/mL). 50 mL/h = 500 mg/h; 100 mL/h = 1 g/h"],
      ["IV bolus", "Calcium gluconate 10% 10 mL = 1 g ≈ 90–93 mg (2.25 mmol) elemental Ca; raises total Ca about 0.1–0.2 mmol/L for 2–3 h"],
      ["PO", "Calcium carbonate (40% elemental); calcium citrate if on a PPI; calcitriol 0.25–0.5 mcg BID if PTH low or CKD"]],
    Mg: [["IV", "MgSO4 2 g (8 mmol) in 50 mL NS; MgSO4 5 g (20 mmol) in 100 mL NS. Max 2 g/h; 5 g if Mg < 0.6. MgSO4 2 g vials: crash carts and select units, restricted indications"],
      ["PO", "Mg 25 mg elemental tabs (prevention); Mg 250 mg elemental tabs (≈ 10 mmol) BID; Mg glucoheptonate 100 mg/mL (Mg Rougier) 30 mL = 6 mmol TID; Mg hydroxide (Milk of Magnesia) 5 mL TID. Aim 20 mmol/day"],
      ["Levels", "At least 1 h after IV; 72 h after is more accurate"]],
    all: "ALL electrolytes: 50% dose reduction and more frequent monitoring when GFR < 30 mL/min." };
  const ORDER = ["hypoK", "hyperK", "hypoPhos", "hyperPhos", "hypoCa", "hyperCa", "hypoMg", "hyperMg"];
  const api = { REF, ORDER, PRODUCTS };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else { window.LYTES_REF = REF; window.LYTES_ORDER = ORDER; window.LYTES_PRODUCTS = PRODUCTS; }
})();
