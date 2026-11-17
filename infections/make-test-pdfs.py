"""python3 make-test-pdfs.py : writes test-pdfs/*.txt and *.pdf (made-up chart extracts for the toolkit's Import PDF button)
and demo-patients.js (the same patients for index.html?demo=1..5). No real patient data.
PDF dates are fixed (chart "now" = 2026-11-17 12:00); the app reads labs from the last 7 days and vitals from the last 48 h,
so import within a day or two, or use the demo links (dates move with today).
Note: the PDF importer does not read allergies or culture reports yet - those show in demo mode only."""
import os, json
from datetime import datetime, timedelta
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas

DIR = os.path.dirname(os.path.abspath(__file__)); HERE = os.path.join(DIR, "test-pdfs")
NOW = datetime(2026, 11, 17, 12, 0)
f = lambda dt: dt.strftime("%Y-%m-%d %H:%M"); H = lambda h: NOW - timedelta(hours=h)
LOINC = {"WBC": "6690-2", "Hemoglobin": "718-7", "Platelets": "777-3", "Sodium": "2951-2", "Glucose": "2345-7", "Creatinine": "2160-0",
         "eGFR": "62238-1", "Urea": "3094-0", "CRP": "1988-5", "Procalcitonin": "33959-8", "Lactate": "2524-7", "Albumin": "1751-7", "ESR": "4537-7", "CK": "2157-6"}

def wrap(s, w=92):
    out, line = [], ""
    for word in s.split():
        if len(line) + len(word) + 1 > w: out.append(line); line = word
        else: line = (line + " " + word).strip()
    return out + ([line] if line else [])

def build(p):
    L = ["PATIENT CHART EXTRACT - VICTORIA GENERAL HOSPITAL (TEST)", "MADE-UP TEST PATIENT - NOT A REAL PERSON - FOR SANDBOX TESTING ONLY",
         f"Patient: {p['name']:<32}DOB: {p['dob']}     Sex: {p['sex']}", f"MRN: {p['mrn']:<36}Age: {p['age']}", ""]
    L += ["ALLERGIES"] + ([f"{a[0]} - {a[1] or 'reaction not recorded'}" for a in p["allergies"]] or ["No known drug allergies"]) + [""]
    for title, h, text in p["notes"]: L += [title, f"Date of service: {f(H(h))}"] + wrap(text) + [""]
    L += ["VITAL SIGNS"] + [f"{f(H(h))} BP: {s}/{d} HR: {hr} RR: {rr} Temp: {t} C SpO2: {o}%" for h, s, d, hr, rr, t, o in p["vitals"]] + [""]
    rows = {}
    for name, v, unit, h in p["labs"]: rows.setdefault(h, []).append((name, v, unit))
    for h in sorted(rows, reverse=True):
        L += ["LABORATORY RESULTS", f"Collected: {f(H(h))}", f"{'Test':<26}{'Result':<17}{'Units':<16}", ""]
        for name, v, unit in rows[h]: L += [f"{name:<26}{str(v):<17}{unit:<16}", ""]
    L += ["", f"ACTIVE MEDICATION ORDERS ({NOW:%Y-%m-%d})"] + [m for m, h in p["meds"]] + ["", "ACTIVE PROBLEM LIST"] + p["conds"]
    L += ["", "", f"MADE-UP TEST PATIENT - NOT A REAL PERSON | {p['name']} MRN {p['mrn']}         Page 1", "", "RADIOLOGY AND MICROBIOLOGY REPORTS", ""]
    for r in p["reps"]: L += [r["text"].upper(), f"Date of exam: {f(H(r['h']))}", "IMPRESSION:"] + wrap(r["conclusion"]) + [""]
    L += ["", "", f"MADE-UP TEST PATIENT - NOT A REAL PERSON | {p['name']} MRN {p['mrn']}         Page 2"]
    return L

def demo(p):
    fam, given = p["name"].split(", ")
    return {"short": p["short"], "pt": {"resourceType": "Patient", "name": [{"given": [given.title()], "family": fam.title()}], "gender": "male" if p["sex"] == "M" else "female",
            "birthDate": p["dob"], "identifier": [{"type": {"text": "MRN"}, "value": p["mrn"]}]},
            "labs": [{"text": n, "loinc": LOINC.get(n, ""), "v": v, "unit": u, "h": h} for n, v, u, h in p["labs"]],
            "vitals": p["vitals"], "meds": p["meds"], "conds": p["conds"], "reps": p["reps"], "allergies": p["allergies"]}

P = [
 dict(file="01_necrotizing_fasciitis_Ray", short="leg cellulitis -> NF?", name="DEMO, RAY", dob="1968-03-14", sex="M", mrn="TESTINF01", age=58,
  allergies=[],
  notes=[("ED PHYSICIAN NOTE", 14, "58 year old with type 2 diabetes. Left shin redness for 2 days after a scrape, now spreading quickly up to the knee over 6 hours. Severe pain out of proportion to the skin findings, pain beyond the erythema. Tense swelling, two hemorrhagic bullae, dusky area over the shin, decreased sensation. Febrile and tachycardic. Started cefazolin. Admit hospitalist."),
         ("HOSPITALIST NOTE", 2, "Erythema has advanced 6 cm beyond the marked border in 10 hours. Concern for necrotizing soft tissue infection. LRINEC high. Plan: broaden antibiotics, urgent general surgery consult.")],
  vitals=[(14, 104, 62, 116, 22, 38.9, 96), (8, 96, 58, 121, 24, 39.2, 95), (2, 92, 54, 124, 24, 38.7, 95)],
  labs=[("WBC", 23.4, "x10^9/L", 13), ("Hemoglobin", 118, "g/L", 13), ("Platelets", 168, "x10^9/L", 13), ("Sodium", 131, "mmol/L", 13), ("Glucose", 16.2, "mmol/L", 13),
        ("Creatinine", 162, "umol/L", 13), ("eGFR", 41, "mL/min/1.73m2", 13), ("CRP", 212, "mg/L", 13), ("Lactate", 3.4, "mmol/L", 3), ("CK", 1650, "U/L", 3)],
  meds=[("Cefazolin 2 g IV q8h", 13), ("Metformin 1000 mg PO BID", None), ("Insulin glargine 20 units SC daily", None)],
  conds=["Cellulitis, left leg", "Type 2 diabetes mellitus", "Hypertension"],
  reps=[{"text": "X-ray left tibia and fibula", "h": 5, "conclusion": "Soft tissue swelling with small foci of subcutaneous gas along the anterior shin. No fracture."},
        {"text": "Blood culture x2", "h": 13, "conclusion": "Gram-positive cocci in chains in 1 of 2 sets at 9 hours; identification pending."}]),
 dict(file="02_pneumonia_Agnes", short="severe CAP, pen allergy", name="DEMO, AGNES", dob="1947-08-09", sex="F", mrn="TESTINF02", age=79,
  allergies=[["Penicillin", "hives (childhood)", "low", 70]],
  notes=[("ED PHYSICIAN NOTE", 60, "79 year old with COPD. Three days of productive cough, fever and dyspnea; confused today per daughter. Right lower lobe crackles. Started ceftriaxone and azithromycin. Penicillin allergy: hives as a child, has had cephalexin since without problems."),
         ("HOSPITALIST PROGRESS NOTE", 3, "Day 3. Afebrile since yesterday, mentation back to baseline, RR 20, SpO2 93% on room air, eating. Blood cultures pneumococcus, susceptible to penicillin. Small effusion not tapped.")],
  vitals=[(60, 88, 54, 112, 31, 39.0, 88), (36, 104, 62, 102, 26, 38.4, 91), (12, 118, 70, 92, 22, 37.6, 92), (3, 126, 74, 86, 20, 37.1, 93)],
  labs=[("WBC", 15.8, "x10^9/L", 59), ("Sodium", 132, "mmol/L", 59), ("Urea", 9.2, "mmol/L", 59), ("Creatinine", 110, "umol/L", 59), ("CRP", 182, "mg/L", 59),
        ("Procalcitonin", 2.1, "ug/L", 59), ("Lactate", 2.6, "mmol/L", 59), ("WBC", 10.4, "x10^9/L", 5), ("CRP", 96, "mg/L", 5), ("Urea", 7.4, "mmol/L", 5), ("Creatinine", 92, "umol/L", 5)],
  meds=[("Ceftriaxone 1 g IV daily", 59), ("Azithromycin 500 mg PO daily", 59), ("Tiotropium 18 mcg inhaled daily", None)],
  conds=["Community-acquired pneumonia, right lower lobe", "COPD"],
  reps=[{"text": "Chest X-ray PA and lateral", "h": 59, "conclusion": "Right lower lobe consolidation with a small right pleural effusion."},
        {"text": "Blood culture x2", "h": 59, "conclusion": "Streptococcus pneumoniae in 2 of 2 sets, penicillin susceptible, ceftriaxone susceptible."},
        {"text": "MRSA nasal PCR", "h": 58, "conclusion": "Not detected."}]),
 dict(file="03_pyelonephritis_ESBL_Helen", short="obstructed pyelo, ESBL, anaphylaxis", name="DEMO, HELEN", dob="1960-01-22", sex="F", mrn="TESTINF03", age=66,
  allergies=[["Amoxicillin", "anaphylaxis - throat swelling, needed epinephrine", "high", 2]],
  notes=[("ED PHYSICIAN NOTE", 20, "66 year old with recurrent UTIs, ESBL E. coli in urine 4 months ago. Right flank pain, rigors, vomiting since yesterday. Febrile, hypotensive, responded to 2 L fluid. Amoxicillin anaphylaxis 2 years ago. CT shows obstructing right ureteric stone. Ertapenem started after allergy discussion. Urology paged."),
         ("HOSPITALIST NOTE", 4, "Urology placed right ureteric stent overnight. Still febrile 38.6 but BP improving. Creatinine up.")],
  vitals=[(20, 86, 50, 118, 24, 39.4, 95), (12, 98, 56, 108, 22, 38.9, 96), (4, 112, 64, 100, 20, 38.6, 97)],
  labs=[("WBC", 19.6, "x10^9/L", 19), ("Creatinine", 168, "umol/L", 19), ("eGFR", 28, "mL/min/1.73m2", 19), ("Lactate", 4.2, "mmol/L", 19), ("CRP", 240, "mg/L", 19),
        ("Platelets", 112, "x10^9/L", 19), ("Creatinine", 188, "umol/L", 4), ("eGFR", 24, "mL/min/1.73m2", 4)],
  meds=[("Ertapenem 1 g IV daily", 18), ("Hydromorphone 0.5 mg IV q3h PRN", None), ("Nitrofurantoin 100 mg PO BID", None)],
  conds=["Pyelonephritis, right, obstructed", "Recurrent urinary tract infection", "Nephrolithiasis"],
  reps=[{"text": "CT abdomen and pelvis (renal stone protocol)", "h": 18, "conclusion": "7 mm obstructing right proximal ureteric stone with moderate hydronephrosis and perinephric stranding. No gas, no abscess."},
        {"text": "Urine culture", "h": 19, "conclusion": "Escherichia coli >10^8 CFU/L, ESBL producer: resistant to ceftriaxone and ciprofloxacin; susceptible to ertapenem, meropenem, nitrofurantoin, gentamicin."},
        {"text": "Blood culture x2", "h": 19, "conclusion": "Escherichia coli (ESBL) in 1 of 2 sets."}]),
 dict(file="04_diverticulitis_abscess_Tom", short="diverticular abscess, on prednisone", name="DEMO, TOM", dob="1974-05-30", sex="M", mrn="TESTINF04", age=52,
  allergies=[],
  notes=[("ED PHYSICIAN NOTE", 40, "52 year old on prednisone 20 mg daily for polymyalgia. Four days of left lower quadrant pain and fever. Localized tenderness, no peritonism. CT: sigmoid diverticulitis with a 4.5 cm pericolic abscess. Started ceftriaxone and metronidazole."),
         ("HOSPITALIST NOTE", 3, "Day 2. Still febrile and tender. IR consult for percutaneous drainage. General surgery aware.")],
  vitals=[(40, 124, 76, 104, 20, 38.6, 97), (20, 120, 72, 98, 18, 38.3, 98), (3, 122, 74, 96, 18, 38.2, 98)],
  labs=[("WBC", 17.2, "x10^9/L", 39), ("CRP", 148, "mg/L", 39), ("Lactate", 1.8, "mmol/L", 39), ("Creatinine", 78, "umol/L", 39), ("WBC", 16.1, "x10^9/L", 4), ("CRP", 171, "mg/L", 4)],
  meds=[("Ceftriaxone 2 g IV daily", 39), ("Metronidazole 500 mg IV q12h", 39), ("Prednisone 20 mg PO daily", None)],
  conds=["Sigmoid diverticulitis with abscess", "Polymyalgia rheumatica"],
  reps=[{"text": "CT abdomen and pelvis with contrast", "h": 39, "conclusion": "Sigmoid diverticulitis with a 4.5 x 3.8 cm rim-enhancing pericolic abscess. No free air. No obstruction."}]),
 dict(file="05_meningitis_Victor", short="bacterial meningitis", name="DEMO, VICTOR", dob="1964-12-02", sex="M", mrn="TESTINF05", age=61,
  allergies=[],
  notes=[("ED PHYSICIAN NOTE", 8, "61 year old with fever, severe headache, neck stiffness and confusion since this morning. GCS 13, no focal deficit, no rash. Blood cultures drawn, dexamethasone and ceftriaxone, vancomycin and ampicillin given within 40 minutes, then LP after CT."),
         ("HOSPITALIST NOTE", 1, "CSF consistent with bacterial meningitis, Gram-positive diplococci. ID consulted. Droplet precautions until organism confirmed.")],
  vitals=[(8, 142, 84, 112, 24, 39.6, 96), (4, 132, 78, 104, 22, 38.8, 97), (1, 128, 76, 98, 20, 38.2, 97)],
  labs=[("WBC", 21.2, "x10^9/L", 7.5), ("Glucose", 7.8, "mmol/L", 7.5), ("Creatinine", 96, "umol/L", 7.5), ("eGFR", 74, "mL/min/1.73m2", 7.5), ("Lactate", 2.4, "mmol/L", 7.5), ("CRP", 168, "mg/L", 7.5), ("Sodium", 133, "mmol/L", 7.5)],
  meds=[("Dexamethasone 10 mg IV q6h", 7.6), ("Ceftriaxone 2 g IV q12h", 7.6), ("Vancomycin 1500 mg IV q12h", 7.6), ("Ampicillin 2 g IV q4h", 7.6)],
  conds=["Bacterial meningitis", "Hypertension"],
  reps=[{"text": "CT head without contrast", "h": 7, "conclusion": "No acute intracranial abnormality. No mass effect."},
        {"text": "CSF Gram stain and culture", "h": 6, "conclusion": "CSF 2400 cells per microlitre (92% neutrophils), protein 2.8 g/L, CSF sugar 1.1 mmol/L (very low). Gram-positive diplococci seen; culture pending."},
        {"text": "Blood culture x2", "h": 7.8, "conclusion": "No growth to date."}])
]

if __name__ == "__main__":
    os.makedirs(HERE, exist_ok=True)
    for p in P:
        lines = build(p); base = os.path.join(HERE, p["file"])
        open(base + ".txt", "w").write("\n".join(lines) + "\n")
        c = canvas.Canvas(base + ".pdf", pagesize=letter); c.setTitle("MADE-UP TEST PATIENT"); y = 750
        for line in lines:
            if y < 50: c.showPage(); y = 750
            c.setFont("Courier", 8.6); c.drawString(36, y, line); y -= 11
            if "MADE-UP TEST PATIENT - NOT A REAL PERSON |" in line: c.showPage(); y = 750
        c.save(); print("pdf", p["file"])
    with open(os.path.join(DIR, "demo-patients.js"), "w") as fh:
        fh.write("// Generated by make-test-pdfs.py - made-up patients for index.html?demo=1..5 (match test-pdfs/). Not real people.\n")
        fh.write("window.INF_DEMOS = " + json.dumps([demo(p) for p in P], indent=1) + ";\n")
    print("wrote demo-patients.js")
