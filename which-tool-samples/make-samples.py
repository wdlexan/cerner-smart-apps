"""python3 make-samples.py : writes made-up mixed ER admissions (test-pdfs/*.txt + .pdf) for testing the toolkit's "Which tool?" pop-up.
MADE-UP TEST PATIENTS - NOT REAL PEOPLE. Load them in the toolkit with Import PDF > Load a sample patient > "Open as a separate patient"."""
import os
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
HERE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "test-pdfs")

def labs(when, rows):
    out = [f"Collected: {when}", "Test                      Result          Units           Reference          Flag", ""]
    for name, val, unit, ref, flag in rows:
        out.append(f"{name:<30}{val:<12}{unit:<16}{ref:<19}{flag}".rstrip())
    return out + [""]

P = []
def patient(fn, name, dob, sex, mrn, loc, cc, hpi, pmh, meds, allergies, vitals, exam, ap, lab_blocks, expect):
    L = ["PATIENT CHART EXTRACT - VICTORIA GENERAL HOSPITAL (TEST)", "MADE-UP TEST PATIENT - NOT A REAL PERSON - FOR SANDBOX TESTING ONLY",
         f"Patient: TESTPATIENT, {name:<20}DOB: {dob}     Sex: {sex}", f"MRN: {mrn:<30}Location: {loc}",
         "Admitted: 2026-11-24 (Hospitalist Medicine)   Attending: Dr. A. Hospitalist (made-up)", "",
         "EMERGENCY DEPARTMENT ADMISSION NOTE", "Date of service: 2026-11-24 14:20", f"Chief complaint: {cc}", "",
         "HISTORY OF PRESENT ILLNESS"] + hpi + ["", "PAST MEDICAL HISTORY"] + pmh + ["", "HOME MEDICATIONS"] + meds + \
        ["", f"ALLERGIES: {allergies}", "", "EXAMINATION", f"2026-11-24 13:50 {vitals}"] + exam + ["", "ASSESSMENT AND PLAN"] + ap + ["", "LABORATORY RESULTS"]
    for b in lab_blocks: L += labs(*b)
    L += ["", f"MADE-UP TEST PATIENT - NOT A REAL PERSON | TESTPATIENT, {name} MRN {mrn}          Page 1"]
    P.append((fn, "\n".join(L) + "\n", expect))

BASE = "Nov 20, 2026 07:10"; NOW = "Nov 24, 2026 12:30"

patient("01 Edith - heart failure, AKI, low sodium", "Edith", "1944-03-12", "F", "TEST44012", "ED Bed 7",
  "Shortness of breath and leg swelling for 5 days.",
  ["82-year-old woman with known heart failure (EF 30%) and atrial fibrillation, 5 days of",
   "increasing dyspnea, orthopnea and leg edema. Gained 4 kg. Recently started on hydrochlorothiazide",
   "by her family doctor. Denies chest pain. No fever. Using hydromorphone for knee pain."],
  ["Heart failure with reduced ejection fraction", "Atrial fibrillation", "Chronic kidney disease stage 3", "Osteoarthritis knees"],
  ["Furosemide 40 mg PO daily", "Hydrochlorothiazide 25 mg PO daily", "Apixaban 2.5 mg PO BID", "Metoprolol 25 mg PO BID",
   "Spironolactone 25 mg PO daily", "Hydromorphone 1 mg PO q4h prn", "Atorvastatin 20 mg PO daily"], "None known",
  "BP: 104/62 HR: 112 RR: 24 Temp: 36.8 C SpO2: 90%", ["JVP 8 cm above sternal angle. Bibasal crackles. 3+ pitting edema to knees. Irregularly irregular."],
  ["Acute decompensated heart failure with bilateral pleural effusions on CXR.", "Acute kidney injury on CKD. Hyponatremia, likely thiazide. Hyperkalemia.",
   "AF with rapid rate. Hold HCTZ and spironolactone. IV furosemide. Admit hospitalist."],
  [(BASE, [("Creatinine", "92", "umol/L", "45 - 90", "H"), ("Sodium", "134", "mmol/L", "135 - 145", "L")]),
   (NOW, [("Sodium", "124", "mmol/L", "135 - 145", "L"), ("Potassium", "6.1", "mmol/L", "3.5 - 5.0", "H"), ("Creatinine", "168", "umol/L", "45 - 90", "H"),
          ("NT-proBNP", "8400", "ng/L", "< 450", "H"), ("Troponin I hs", "21", "ng/L", "< 26", ""), ("Hemoglobin", "112", "g/L", "120 - 160", "L"),
          ("Glucose", "6.4", "mmol/L", "3.6 - 7.8", "")])],
  "Heart failure, AKI, Sodium, Electrolytes, AF, Opioid safety, Pleural effusion")

patient("02 Raj - cellulitis, penicillin allergy, high sugar", "Raj", "1968-07-02", "M", "TEST68221", "ED Bed 12",
  "Red, hot, swollen right leg for 3 days with fever.",
  ["58-year-old man with type 2 diabetes, 3 days of spreading erythema right shin from a cracked heel.",
   "Fever 38.9 and rigors at home. Anaphylaxis to penicillin as a child. No crepitus."],
  ["Type 2 diabetes mellitus", "Hypertension", "Obesity"],
  ["Metformin 1000 mg PO BID", "Insulin glargine 30 units SC at bedtime", "Ramipril 10 mg PO daily"], "Penicillin (anaphylaxis)",
  "BP: 118/70 HR: 108 RR: 20 Temp: 38.7 C SpO2: 97%", ["Right leg erythema from ankle to mid-calf, warm, tender. Fissure right heel. No bullae."],
  ["Cellulitis right leg with sepsis. Penicillin allergy: which antibiotic.", "Hyperglycemia. Blood cultures x2. Admit."],
  [(NOW, [("White Blood Cell Count", "17.8", "x10^9/L", "4.0 - 11.0", "H"), ("Lactate", "3.1", "mmol/L", "0.5 - 2.0", "H"),
          ("Glucose", "22.4", "mmol/L", "3.6 - 7.8", "H"), ("Hemoglobin A1c", "9.8", "%", "4.0 - 6.0", "H"), ("Creatinine", "84", "umol/L", "60 - 110", ""),
          ("Sodium", "136", "mmol/L", "135 - 145", ""), ("Potassium", "4.2", "mmol/L", "3.5 - 5.0", "")])],
  "Antibiotic chooser, Infections by site, Diabetes, Antibiotics")

patient("03 Marjorie - hip fracture, 14 meds, confused", "Marjorie", "1947-11-30", "F", "TEST47330", "ED Bed 3",
  "Fall at home, unable to weight bear, right hip pain.",
  ["79-year-old woman, mechanical fall from standing at night going to the bathroom.",
   "Shortened externally rotated right leg. X-ray: right intertrochanteric hip fracture.",
   "Daughter reports she has been more confused for 2 days. Takes many medications including zopiclone."],
  ["Mild dementia", "Atrial fibrillation", "Hypertension", "Depression", "Osteoporosis", "Overactive bladder"],
  ["Apixaban 5 mg PO BID", "Metoprolol 50 mg PO BID", "Amlodipine 10 mg PO daily", "Hydrochlorothiazide 12.5 mg PO daily", "Citalopram 20 mg PO daily",
   "Zopiclone 7.5 mg PO at bedtime", "Oxybutynin 5 mg PO BID", "Donepezil 10 mg PO daily", "Pantoprazole 40 mg PO daily", "Atorvastatin 40 mg PO daily",
   "Calcium carbonate 500 mg PO BID", "Vitamin D 1000 units PO daily", "Acetaminophen 1 g PO QID", "Lorazepam 0.5 mg PO prn"], "Sulfa (rash)",
  "BP: 156/84 HR: 88 RR: 18 Temp: 36.9 C SpO2: 95%", ["Drowsy but rousable, disoriented to date. Right leg shortened and externally rotated."],
  ["Right intertrochanteric hip fracture after fall, for ortho fixation.", "Delirium on mild dementia. Polypharmacy with sedatives and anticholinergics.",
   "Hyponatremia. On apixaban: last dose this morning."],
  [(NOW, [("Sodium", "128", "mmol/L", "135 - 145", "L"), ("Potassium", "3.9", "mmol/L", "3.5 - 5.0", ""), ("Creatinine", "88", "umol/L", "45 - 90", ""),
          ("Hemoglobin", "104", "g/L", "120 - 160", "L"), ("Platelets", "210", "x10^9/L", "150 - 400", ""), ("INR", "1.2", "ratio", "0.8 - 1.2", "")])],
  "Hip fracture, Deprescribing, Sodium, Dementia workup, Risk screen")

patient("04 Leonard - cirrhosis, ascites, rising creatinine", "Leonard", "1962-01-19", "M", "TEST62119", "ED Bed 9",
  "Increasing abdominal swelling and confusion.",
  ["64-year-old man with alcohol-related cirrhosis, tense ascites, 3 days of confusion and",
   "abdominal discomfort. Low urine output. Last drink 2 weeks ago. No hematemesis."],
  ["Alcohol-related cirrhosis", "Ascites", "Esophageal varices"],
  ["Spironolactone 100 mg PO daily", "Furosemide 40 mg PO daily", "Lactulose 30 mL PO TID", "Propranolol 20 mg PO BID", "Thiamine 100 mg PO daily"], "None known",
  "BP: 96/58 HR: 92 RR: 18 Temp: 37.6 C SpO2: 96%", ["Jaundiced. Tense ascites. Asterixis. Mild diffuse abdominal tenderness."],
  ["Decompensated cirrhosis with hepatic encephalopathy. Diagnostic paracentesis for SBP.", "Acute kidney injury: hepatorenal vs pre-renal. Hold diuretics. Albumin. Hypokalemia."],
  [(BASE, [("Creatinine", "72", "umol/L", "60 - 110", "")]),
   (NOW, [("Creatinine", "164", "umol/L", "60 - 110", "H"), ("Total Bilirubin", "92", "umol/L", "0 - 20", "H"), ("INR", "2.1", "ratio", "0.8 - 1.2", "H"),
          ("Sodium", "129", "mmol/L", "135 - 145", "L"), ("Potassium", "2.9", "mmol/L", "3.5 - 5.0", "L"), ("Albumin", "24", "g/L", "35 - 50", "L"),
          ("Platelets", "68", "x10^9/L", "150 - 400", "L")])],
  "Liver (cirrhosis), AKI, Electrolytes, Sodium")

patient("05 Kevin - NSTEMI, low K and Mg", "Kevin", "1955-05-05", "M", "TEST55505", "ED Bed 1",
  "Central chest pressure for 3 hours.",
  ["71-year-old man with 3 hours of central chest pressure radiating to the left arm, diaphoretic.",
   "ECG: 1 mm ST depression V4-V6. Pain settled with nitro. Has had diarrhea for 4 days."],
  ["Hypertension", "Dyslipidemia", "Former smoker"],
  ["Ramipril 5 mg PO daily", "Rosuvastatin 10 mg PO daily"], "None known",
  "BP: 148/90 HR: 84 RR: 16 Temp: 36.7 C SpO2: 98%", ["No murmur. Chest clear. No edema."],
  ["NSTEMI. ASA load, start DAPT question, heparin. Cardiology for angiogram.", "Hypokalemia and hypomagnesemia from diarrhea: replace."],
  [(NOW, [("Troponin I hs", "340", "ng/L", "< 26", "H"), ("Potassium", "3.0", "mmol/L", "3.5 - 5.0", "L"), ("Magnesium", "0.55", "mmol/L", "0.70 - 1.00", "L"),
          ("Creatinine", "96", "umol/L", "60 - 110", ""), ("Hemoglobin", "142", "g/L", "130 - 170", ""), ("Sodium", "139", "mmol/L", "135 - 145", "")])],
  "NSTEMI (ACS), Electrolytes")

patient("06 Priya - DKA", "Priya", "1981-09-14", "F", "TEST81914", "ED Resus 2",
  "Vomiting, abdominal pain, very high sugars.",
  ["45-year-old woman with type 1 diabetes, 2 days of vomiting and abdominal pain after a viral illness.",
   "Missed insulin doses because she could not eat. Kussmaul breathing."],
  ["Type 1 diabetes mellitus", "Hypothyroidism"],
  ["Insulin glargine 18 units SC daily", "Insulin lispro per carb count", "Levothyroxine 75 mcg PO daily"], "None known",
  "BP: 102/64 HR: 118 RR: 28 Temp: 37.1 C SpO2: 99%", ["Dry mucous membranes. Ketotic breath. Soft abdomen, mild diffuse tenderness."],
  ["Diabetic ketoacidosis. Insulin infusion, fluids, potassium protocol.", "Admit step-down."],
  [(NOW, [("Glucose", "31.2", "mmol/L", "3.6 - 7.8", "H"), ("pH Venous", "7.12", "", "7.32 - 7.42", "L"), ("Bicarbonate", "8", "mmol/L", "22 - 29", "L"),
          ("Potassium", "5.9", "mmol/L", "3.5 - 5.0", "H"), ("Sodium", "131", "mmol/L", "135 - 145", "L"), ("Creatinine", "118", "umol/L", "45 - 90", "H"),
          ("Phosphate", "0.5", "mmol/L", "0.8 - 1.5", "L")])],
  "Diabetes, Acid-base, Electrolytes, Sodium")

patient("07 Arthur - Parkinson, aspiration pneumonia", "Arthur", "1950-02-08", "M", "TEST50208", "ED Bed 5",
  "Cough, fever and choking on food.",
  ["76-year-old man with Parkinson disease, 3 days of productive cough and fever.",
   "Family reports coughing and choking with meals for months, weight loss. Now NPO in ED."],
  ["Parkinson disease", "Dysphagia", "Benign prostatic hyperplasia"],
  ["Levodopa/carbidopa 100/25 mg PO QID", "Pramipexole 0.25 mg PO TID", "Tamsulosin 0.4 mg PO daily"], "None known",
  "BP: 128/72 HR: 98 RR: 24 Temp: 38.4 C SpO2: 89%", ["Rigid, bradykinetic, wet voice. Right basal crackles."],
  ["Aspiration pneumonia right lower lobe. Which antibiotic.", "Parkinson disease: patient is NPO, plan for levodopa (NG). Swallow assessment."],
  [(NOW, [("White Blood Cell Count", "15.1", "x10^9/L", "4.0 - 11.0", "H"), ("Lactate", "1.6", "mmol/L", "0.5 - 2.0", ""), ("Sodium", "141", "mmol/L", "135 - 145", ""),
          ("Creatinine", "102", "umol/L", "60 - 110", "")])],
  "Parkinson disease, Antibiotic chooser, Risk screen, Infections by site")

patient("08 Doreen - myeloma on teclistamab, fever", "Doreen", "1958-06-22", "F", "TEST58622", "ED Bed 14",
  "Fever and confusion 2 days after teclistamab step-up dose.",
  ["68-year-old woman with relapsed multiple myeloma, received teclistamab step-up dose 2 days ago.",
   "Fever 39.2, rigors, new word-finding difficulty this morning. Hypotensive in triage."],
  ["Multiple myeloma", "Hypertension"],
  ["Teclistamab per hematology protocol", "Acyclovir 400 mg PO BID", "Sulfamethoxazole-trimethoprim DS 1 tab PO three times weekly", "Dexamethasone per protocol"], "None known",
  "BP: 88/52 HR: 124 RR: 22 Temp: 39.2 C SpO2: 93%", ["Flushed. Expressive word-finding difficulty, ICE score 7. No neck stiffness."],
  ["Cytokine release syndrome grade 2 with possible ICANS after teclistamab. Febrile: cover for sepsis.", "Tocilizumab per protocol. Hematology aware."],
  [(NOW, [("White Blood Cell Count", "2.1", "x10^9/L", "4.0 - 11.0", "L"), ("Lactate", "2.6", "mmol/L", "0.5 - 2.0", "H"), ("Ferritin", "4200", "ug/L", "15 - 200", "H"),
          ("Creatinine", "110", "umol/L", "45 - 90", "H"), ("Sodium", "135", "mmol/L", "135 - 145", "")])],
  "CRS/ICANS (bispecific), Infections, Oncology toxicity, FUO")

with open(os.path.join(HERE, "EXPECTED.md"), "w") as f:
    f.write("# Which tool? test patients: expected top suggestions (made-up patients)\n\n")
    for fn, text, exp in P:
        open(os.path.join(HERE, fn + ".txt"), "w").write(text)
        c = canvas.Canvas(os.path.join(HERE, fn + ".pdf"), pagesize=letter); c.setTitle("MADE-UP TEST PATIENT"); y = 750
        for line in text.splitlines():
            if y < 50: c.showPage(); y = 750
            c.setFont("Courier", 8.6); c.drawString(36, y, line); y -= 11
        c.save(); f.write(f"- **{fn}**: {exp}\n"); print("pdf", fn)
