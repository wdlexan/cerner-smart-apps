"""python3 make-test-pdfs.py : writes test-pdfs/*.txt and *.pdf (made-up chart extracts for the toolkit's Import PDF button),
copies them to hospitalist-toolkit/sample-pdfs/Aortic stenosis/, and writes the same patients into the SAMPLES block of
index.html (standalone) and hospitalist-toolkit/tools/as/index.html, for the "Sample patient" dropdown. No real patient data.
Chart "now" = 2026-11-24 09:30. Each echo goes under a heading + "Date of exam" + "IMPRESSION:" (the importer keeps 800 characters
after IMPRESSION, so measurements are written there).
  1 Doris    84F  hip fracture + symptomatic severe high-gradient AS (D1), exertional presyncope
  2 Harold   76M  classical low-flow low-gradient, EF 30%, DSE true severe (D2), prior CABG
  3 Margaret 81F  paradoxical low-flow low-gradient, CT calcium 1650 AU (D3)
  4 Ronald   68M  asymptomatic severe high-gradient bicuspid AS, ascending aorta 4.7 cm (C1, SAVR)
  5 Evelyn   92F  very severe AS, CFS 7, advanced dementia, HF admission (goals of care)
  6 Frank    79M  high gradient but AVA 1.25 with Hb 78 from GI bleed: high-flow state"""
import os, json, re, shutil
from datetime import datetime, timedelta
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas

DIR = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(DIR)
HERE = os.path.join(DIR, "test-pdfs")
TOOLKIT_SAMPLES = os.path.join(ROOT, "hospitalist-toolkit", "sample-pdfs", "Aortic stenosis")
NOW = datetime(2026, 11, 24, 9, 30)
f = lambda dt: dt.strftime("%Y-%m-%d %H:%M")
H = lambda h: NOW - timedelta(hours=h)

def wrap(s, w=92):
    out, line = [], ""
    for word in s.split():
        if len(line) + len(word) + 1 > w: out.append(line); line = word
        else: line = (line + " " + word).strip()
    return out + ([line] if line else [])

def labs(collected, rows):
    out = ["LABORATORY RESULTS", f"Collected: {collected}", f"{'Test':<26}{'Result':<17}{'Units':<16}{'Reference':<16}Flag", ""]
    for r in rows: out += [f"{r[0]:<26}{r[1]:<17}{r[2]:<16}{r[3]:<16}{r[4]:<4}", ""]
    return out

def build(p):
    L = ["PATIENT CHART EXTRACT - VICTORIA GENERAL HOSPITAL (TEST)", "MADE-UP TEST PATIENT - NOT A REAL PERSON - FOR SANDBOX TESTING ONLY",
         f"Patient: {p['name']:<32}DOB: {p['dob']}     Sex: {p['sex']}", f"MRN: {p['mrn']:<36}Age: {p['age']}", f"Address: {p['addr'][0]}, {p['addr'][1]} BC {p['addr'][2]}",
         f"ED arrival: {f(H(p['arrive']))}    Admitted: {f(H(p['arrive'] - 3))} (Hospitalist)", ""]
    for title, h, text in p["notes"]:
        L += [title, f"Date of service: {f(H(h))}"] + wrap(text) + [""]
    L += ["VITAL SIGNS"] + [f"{f(H(h))} BP: {s}/{d} HR: {hr} Temp: {tp} C SpO2: {o2}%" for h, s, d, hr, tp, o2 in p["vitals"]] + [f"Weight: {p['weight']} kg", ""]
    for h, rows in p["labs"]: L += labs(f(H(h)), rows)
    L += ["", "ACTIVE MEDICATION ORDERS"] + p["meds"] + ["", "ACTIVE PROBLEM LIST"] + p["problems"]
    L += ["", "", f"MADE-UP TEST PATIENT - NOT A REAL PERSON | {p['name']} MRN {p['mrn']}         Page 1", "", "CARDIAC AND RADIOLOGY REPORTS", ""]
    for title, h, imp in p["reports"]:
        L += [title, f"Date of exam: {f(H(h))}", "IMPRESSION:"] + wrap(imp) + [""]
    L += ["", "", f"MADE-UP TEST PATIENT - NOT A REAL PERSON | {p['name']} MRN {p['mrn']}         Page 2"]
    return L

TTE = "TRANSTHORACIC ECHOCARDIOGRAM"
P = [
 dict(file="01 Doris - hip fracture with severe AS", short="Doris", name="DEMO, DORIS", dob="1942-03-14", sex="F", mrn="TESTAS01", age=84, arrive=30, weight=58, addr=("11 Test Lane", "Victoria", "V8R 0A1"),
  notes=[("ED PHYSICIAN NOTE", 29, "84 year old woman, fall at home going up the stairs: felt light-headed and greyed out on exertion just before she fell. Shortened externally rotated left leg. Loud ejection systolic murmur radiating to the carotids. Left femoral neck fracture on x-ray. Admit to orthopedics with hospitalist co-management."),
         ("HOSPITALIST CONSULT NOTE", 26, "Known aortic stenosis, last echo 2 years ago moderate. Over the past 6 months exertional dyspnea walking one block and two episodes of exertional presyncope. Lives alone, walks with a cane, independent ADLs, Clinical Frailty Scale 5. Plan urgent echo, inform anesthesia of severe AS, do not delay hip surgery, avoid nitrates and over-diuresis. Cardiology referral for TAVI after recovery.")],
  vitals=[(29, 118, 64, 92, 36.8, 95), (12, 106, 58, 88, 37.0, 94), (2, 112, 60, 84, 36.9, 95)],
  labs=[(28, [("Hemoglobin", "112", "g/L", "115 - 155", "L"), ("Creatinine", "96", "umol/L", "45 - 90", "H"), ("eGFR", "47", "mL/min/1.73m2", "> 60", "L"),
              ("Sodium", "136", "mmol/L", "135 - 145", ""), ("Potassium", "4.2", "mmol/L", "3.5 - 5.0", ""), ("NT-proBNP", "2900", "ng/L", "< 450", "H"), ("Troponin", "21", "ng/L", "< 16", "H")])],
  meds=["Acetaminophen 1 g PO q6h", "Hydromorphone 0.5 mg PO q4h PRN pain", "Enoxaparin 30 mg subcut daily", "Ramipril 2.5 mg PO daily (held)", "Furosemide 20 mg PO daily"],
  problems=["Fracture of neck of left femur", "Aortic stenosis", "Hypertension", "Chronic kidney disease stage 3a", "Osteoporosis"],
  reports=[("X-RAY LEFT HIP", 29, "Displaced subcapital fracture of the left femoral neck."),
           (TTE, 6, "BP 112/60. BSA 1.58 m2. Trileaflet aortic valve, severely calcified, severely reduced opening. AV Vmax 4.6 m/s, peak gradient 85 mmHg, mean gradient 52 mmHg. LVOT diameter 1.9 cm, LVOT VTI 21 cm, AV VTI 105 cm. AVA (continuity) 0.57 cm2. DVI 0.20. SVi 38 mL/m2. Concentric LVH, LVEF 60%. Mild mitral regurgitation. RVSP 42 mmHg. CONCLUSION: Severe high-gradient aortic stenosis with preserved LV function, progressed from moderate in 2024."),
           ("ECG 12 LEAD", 29, "Sinus rhythm 90. Left ventricular hypertrophy with strain. QRS 96 ms.")],
  clin=dict(cfs="5", le="1to10", tf=["tricuspid", "access"])),
 dict(file="02 Harold - low-flow low-gradient, low EF", short="Harold", name="DEMO, HAROLD", dob="1950-08-02", sex="M", mrn="TESTAS02", age=76, arrive=70, weight=84, addr=("22 Sample Road", "Saanich", "V8X 0B2"),
  notes=[("HOSPITALIST ADMISSION NOTE", 68, "76 year old man admitted with decompensated heart failure: orthopnea, 6 kg weight gain, bilateral crackles. Prior CABG 2012 (sternotomy, LIMA-LAD patent). Ischemic cardiomyopathy. Ejection murmur. Echo shows low EF with a small calcified aortic valve but low gradient. IV furosemide started."),
         ("CARDIOLOGY CONSULT NOTE", 20, "Classical low-flow low-gradient aortic stenosis with reduced EF. Dobutamine stress echo shows flow reserve and true severe AS. Heart Team referral for transfemoral TAVI given prior sternotomy. Continue cautious diuresis, avoid nitrates.")],
  vitals=[(69, 104, 66, 102, 36.7, 89), (30, 98, 62, 88, 36.8, 94), (3, 100, 60, 80, 36.6, 96)],
  labs=[(68, [("Hemoglobin", "128", "g/L", "135 - 175", "L"), ("Creatinine", "132", "umol/L", "60 - 110", "H"), ("eGFR", "46", "mL/min/1.73m2", "> 60", "L"),
              ("Sodium", "133", "mmol/L", "135 - 145", "L"), ("NT-proBNP", "8400", "ng/L", "< 450", "H"), ("Troponin", "38", "ng/L", "< 16", "H")])],
  meds=["Furosemide 40 mg IV BID", "Bisoprolol 2.5 mg PO daily", "Dapagliflozin 10 mg PO daily", "Spironolactone 12.5 mg PO daily", "Aspirin 81 mg PO daily", "Atorvastatin 80 mg PO daily"],
  problems=["Heart failure with reduced ejection fraction", "Aortic stenosis", "Coronary artery disease, prior CABG", "Chronic kidney disease stage 3a", "Type 2 diabetes"],
  reports=[(TTE, 60, "BP 100/62. BSA 2.02 m2. Trileaflet aortic valve, heavily calcified, restricted. AV Vmax 3.3 m/s, mean gradient 26 mmHg. LVOT diameter 2.2 cm, LVOT VTI 15 cm, AV VTI 69 cm. AVA (continuity) 0.83 cm2. DVI 0.22. SVi 28 mL/m2. Dilated LV, global hypokinesis, LVEF 30%. Moderate functional mitral regurgitation. RVSP 48 mmHg. CONCLUSION: Low-flow low-gradient aortic stenosis with reduced EF. Dobutamine stress echo recommended."),
           ("DOBUTAMINE STRESS ECHOCARDIOGRAM", 22, "Dobutamine to 20 mcg/kg/min. Stroke volume rose 34% (contractile reserve present). At peak: AV Vmax 4.3 m/s, mean gradient 44 mmHg, AVA 0.86 cm2. CONCLUSION: True severe aortic stenosis."),
           ("ECG 12 LEAD", 69, "Sinus tachycardia 102. Right bundle branch block. Old inferior Q waves.")],
  clin=dict(cfs="4", le="1to10", tf=["tricuspid", "access", "sternot"])),
 dict(file="03 Margaret - paradoxical low-flow, CT calcium", short="Margaret", name="DEMO, MARGARET", dob="1945-05-19", sex="F", mrn="TESTAS03", age=81, arrive=50, weight=61, addr=("33 Demo Crescent", "Oak Bay", "V8S 0C3"),
  notes=[("HOSPITALIST ADMISSION NOTE", 48, "81 year old woman admitted with community-acquired pneumonia. On recovery notes exertional dyspnea for a year, now walking half a block, and exertional chest tightness. Long-standing hypertension. Murmur. Independent, Clinical Frailty Scale 4."),
         ("HOSPITALIST PROGRESS NOTE", 4, "Echo: discordant grading with small calcified valve, low gradient, normal EF and low stroke volume index (paradoxical low-flow low-gradient). BP controlled at the time of echo. CT calcium score done: 1650 AU, severe AS very likely in a woman. Refer cardiology / Heart Team.")],
  vitals=[(49, 162, 84, 96, 38.2, 92), (20, 128, 70, 78, 36.9, 96), (3, 124, 68, 74, 36.7, 97)],
  labs=[(47, [("Hemoglobin", "118", "g/L", "115 - 155", ""), ("Creatinine", "78", "umol/L", "45 - 90", ""), ("eGFR", "64", "mL/min/1.73m2", "> 60", ""),
              ("NT-proBNP", "980", "ng/L", "< 450", "H"), ("WBC", "14.2", "x10^9/L", "4.0 - 11.0", "H")])],
  meds=["Ceftriaxone 1 g IV daily", "Amlodipine 5 mg PO daily", "Ramipril 5 mg PO daily", "Atorvastatin 20 mg PO daily"],
  problems=["Community-acquired pneumonia", "Aortic stenosis", "Hypertension", "Osteoarthritis"],
  reports=[("X-RAY CHEST", 49, "Right lower lobe consolidation."),
           (TTE, 26, "BP 128/70. BSA 1.82 m2. Trileaflet aortic valve, severely calcified, reduced cusp excursion. AV Vmax 3.6 m/s, peak gradient 52 mmHg, mean gradient 31 mmHg. LVOT diameter 2.0 cm, LVOT VTI 17 cm, AV VTI 78 cm. AVA (continuity) 0.69 cm2. DVI 0.22. SVi 30 mL/m2. Small LV cavity, concentric LVH, LVEF 63%. Mild aortic regurgitation. CONCLUSION: Discordant grading; paradoxical low-flow low-gradient severe AS possible. Suggest CT valve calcium score."),
           ("CT AORTIC VALVE CALCIUM SCORE", 6, "Aortic valve calcium score 1650 Agatston units. In a woman this makes severe aortic stenosis very likely. Ascending aorta 3.4 cm.")],
  clin=dict(cfs="4", le="1to10", tf=["tricuspid", "access"])),
 dict(file="04 Ronald - asymptomatic bicuspid, dilated aorta", short="Ronald", name="DEMO, RONALD", dob="1958-11-07", sex="M", mrn="TESTAS04", age=68, arrive=40, weight=88, addr=("44 Example Street", "Langford", "V9B 0D4"),
  notes=[("HOSPITALIST ADMISSION NOTE", 38, "68 year old man admitted with cellulitis of the right leg. Murmur noted. Cycles 30 km three times a week without dyspnea, chest pain or dizziness. No limitation. Known bicuspid valve from a childhood murmur, lost to follow-up."),
         ("HOSPITALIST PROGRESS NOTE", 5, "Echo: severe high-gradient AS in a bicuspid valve, normal EF, ascending aorta 4.7 cm. Asymptomatic and active. Discussed early intervention (ESC 2025) and that surgery would also address the aorta. Outpatient cardiology and cardiac surgery referral; exercise test as outpatient.")],
  vitals=[(39, 142, 82, 88, 38.1, 97), (10, 134, 78, 70, 36.9, 98)],
  labs=[(38, [("Hemoglobin", "146", "g/L", "135 - 175", ""), ("Creatinine", "84", "umol/L", "60 - 110", ""), ("eGFR", "84", "mL/min/1.73m2", "> 60", ""),
              ("NT-proBNP", "210", "ng/L", "< 125", "H"), ("WBC", "12.8", "x10^9/L", "4.0 - 11.0", "H")])],
  meds=["Cefazolin 2 g IV q8h", "Rosuvastatin 10 mg PO daily"],
  problems=["Cellulitis right leg", "Bicuspid aortic valve with aortic stenosis", "Dilated ascending aorta", "Dyslipidemia"],
  reports=[(TTE, 20, "BP 132/78. BSA 2.05 m2. Bicuspid aortic valve (fusion of right and left cusps, raphe), heavily calcified. AV Vmax 4.3 m/s, mean gradient 46 mmHg. LVOT diameter 2.3 cm, LVOT VTI 23 cm, AV VTI 98 cm. AVA (continuity) 0.97 cm2. DVI 0.23. SVi 46 mL/m2. LVEF 62%. Ascending aorta 4.7 cm. Trace aortic regurgitation. CONCLUSION: Severe high-gradient aortic stenosis, bicuspid valve, dilated ascending aorta.")],
  clin=dict(cfs="1", le="10to20", tf=["access"], none=True)),
 dict(file="05 Evelyn - very severe AS, frail with dementia", short="Evelyn", name="DEMO, EVELYN", dob="1934-01-28", sex="F", mrn="TESTAS05", age=92, arrive=55, weight=47, addr=("55 Trial Avenue", "Esquimalt", "V9A 0E5"),
  notes=[("HOSPITALIST ADMISSION NOTE", 53, "92 year old woman from residential care with advanced Alzheimer dementia (dependent for all ADLs, nonverbal most days), admitted with heart failure and a syncopal episode at the care home. Clinical Frailty Scale 7. Family (daughter is substitute decision maker) asks about valve treatment."),
         ("HOSPITALIST PROGRESS NOTE", 6, "Very severe AS. Given advanced dementia and severe frailty, valve replacement unlikely to improve quality of life. Goals of care meeting planned with daughter; current code status full. Gentle diuresis, avoid nitrates.")],
  vitals=[(54, 102, 58, 96, 36.5, 90), (8, 96, 54, 84, 36.6, 94)],
  labs=[(53, [("Hemoglobin", "104", "g/L", "115 - 155", "L"), ("Creatinine", "118", "umol/L", "45 - 90", "H"), ("eGFR", "34", "mL/min/1.73m2", "> 60", "L"),
              ("NT-proBNP", "12600", "ng/L", "< 450", "H"), ("Albumin", "27", "g/L", "35 - 50", "L")])],
  meds=["Furosemide 20 mg IV BID", "Donepezil 5 mg PO daily", "Acetaminophen 650 mg PO q6h PRN"],
  problems=["Heart failure", "Aortic stenosis", "Alzheimer dementia, advanced", "Syncope", "Frailty"],
  reports=[(TTE, 30, "BP 98/56. BSA 1.42 m2. Trileaflet aortic valve, severely calcified, immobile. AV Vmax 5.2 m/s, mean gradient 68 mmHg. LVOT diameter 1.8 cm, LVOT VTI 20 cm, AV VTI 120 cm. AVA (continuity) 0.42 cm2. DVI 0.17. SVi 36 mL/m2. LVEF 55%. Moderate mitral regurgitation, severe MAC. RVSP 55 mmHg. CONCLUSION: Very severe aortic stenosis.")],
  clin=dict(cfs="7", le="lt1", tf=["tricuspid", "dementia"])),
 dict(file="06 Frank - high gradient from anemia (GI bleed)", short="Frank", name="DEMO, FRANK", dob="1947-09-12", sex="M", mrn="TESTAS06", age=79, arrive=36, weight=76, addr=("66 Mock Road", "Sidney", "V8L 0F6"),
  notes=[("HOSPITALIST ADMISSION NOTE", 34, "79 year old man admitted with melena and hemoglobin 78, on apixaban for atrial fibrillation. Exertional dyspnea for 3 weeks since the bleeding started; previously walked 2 km daily without symptoms. Known moderate AS (2025). Recurrent iron deficiency anemia over 2 years with angiodysplasia on prior capsule study."),
         ("HOSPITALIST PROGRESS NOTE", 4, "Echo during anemia: high gradient but valve area 1.25 cm2 and high stroke volume index, in keeping with a high-flow state from anemia. Repeat echo once hemoglobin corrected. Recurrent angiodysplasia bleeding with AS: consider Heyde syndrome, send von Willebrand multimers. GI for endoscopy.")],
  vitals=[(35, 108, 60, 112, 36.9, 96), (12, 118, 64, 96, 36.8, 97), (2, 122, 66, 88, 36.7, 97)],
  labs=[(35, [("Hemoglobin", "78", "g/L", "135 - 175", "L"), ("Ferritin", "9", "ug/L", "30 - 400", "L"), ("Creatinine", "104", "umol/L", "60 - 110", ""), ("eGFR", "60", "mL/min/1.73m2", "> 60", ""),
              ("Urea", "16.2", "mmol/L", "2.5 - 8.0", "H"), ("NT-proBNP", "720", "ng/L", "< 450", "H")]),
        (6, [("Hemoglobin", "86", "g/L", "135 - 175", "L")])],
  meds=["Pantoprazole 40 mg IV BID", "Apixaban 5 mg PO BID (held)", "Metoprolol 25 mg PO BID", "Iron sucrose 300 mg IV once"],
  problems=["Upper GI bleed", "Iron deficiency anemia", "Angiodysplasia", "Aortic stenosis", "Atrial fibrillation"],
  reports=[(TTE, 18, "BP 116/62. HR 98. BSA 1.90 m2. Trileaflet aortic valve, moderately calcified. AV Vmax 4.1 m/s, mean gradient 41 mmHg. LVOT diameter 2.3 cm, LVOT VTI 26 cm, AV VTI 86 cm. AVA (continuity) 1.25 cm2. DVI 0.30. SVi 57 mL/m2. Hyperdynamic LV, LVEF 70%. Mild aortic regurgitation. CONCLUSION: High gradient with valve area above 1.0 cm2 during anemia; high-flow state likely. Repeat after correction of anemia."),
           ("ECG 12 LEAD", 35, "Atrial fibrillation 112. Nonspecific ST changes.")],
  clin=dict(cfs="3", le="1to10", tf=["tricuspid", "access"])),
]

def sample(p):
    """What the app's Sample patient dropdown loads: echo text, demographics, labs, symptoms and Heart Team fields."""
    echo = [r for r in p["reports"] if r[0] == TTE][0]
    others = [r for r in p["reports"] if r[0] != TTE]
    txt = f"{TTE} ({f(H(echo[1]))})\n" + echo[2].replace(" CONCLUSION:", "\nCONCLUSION:")
    lab = {r[0]: float(r[1]) for _, rows in p["labs"] for r in rows}
    notes = " ".join(t for _, _, t in p["notes"]).lower()
    sx = [k for k, pat in [("dysp", r"exertional dyspnea|orthopnea|heart failure"), ("angina", r"chest tightness|angina"), ("sync", r"presyncope|syncop"), ("hf", r"admitted with (?:decompensated )?heart failure|admitted with heart failure")] if re.search(pat, notes)]
    if p["clin"].get("none"): sx = []
    dse = "true" if any("True severe" in r[2] for r in others) else ""
    cac = next((int(m.group(1)) for r in others for m in [re.search(r"(\d{3,4}) Agatston", r[2])] if m), None)
    return {"label": p["file"], "name": p["name"].split(", ")[1].title() + " " + p["name"].split(", ")[0].title(), "mrn": p["mrn"], "age": p["age"], "sex": p["sex"],
            "bnp": lab.get("NT-proBNP"), "hgb": min(v for k, v in [(r[0], float(r[1])) for _, rows in p["labs"] for r in rows] if k == "Hemoglobin") if "Hemoglobin" in lab else None,
            "egfr": lab.get("eGFR"), "sx": sx, "none": bool(p["clin"].get("none")), "dse": dse, "cac": cac, "echo": txt,
            "cfs": p["clin"]["cfs"], "le": p["clin"]["le"], "tf": p["clin"]["tf"]}

def inject(path, data):
    s = open(path).read()
    block = "/*SAMPLES*/const SAMPLES=" + json.dumps(data, ensure_ascii=False) + ";/*END SAMPLES*/"
    s2, n = re.subn(r"/\*SAMPLES\*/.*?/\*END SAMPLES\*/", lambda m: block, s, flags=re.S)
    assert n == 1, path; open(path, "w").write(s2); print("samples ->", os.path.relpath(path, ROOT))

if __name__ == "__main__":
    os.makedirs(HERE, exist_ok=True); os.makedirs(TOOLKIT_SAMPLES, exist_ok=True)
    for p in P:
        lines = build(p); base = os.path.join(HERE, p["file"])
        open(base + ".txt", "w").write("\n".join(lines) + "\n")
        c = canvas.Canvas(base + ".pdf", pagesize=letter); c.setTitle("MADE-UP TEST PATIENT"); y = 750
        for line in lines:
            if y < 50: c.showPage(); y = 750
            c.setFont("Courier", 8.6); c.drawString(36, y, line); y -= 11
            if "MADE-UP TEST PATIENT - NOT A REAL PERSON |" in line: c.showPage(); y = 750
        c.save(); shutil.copy(base + ".pdf", TOOLKIT_SAMPLES); print("pdf", p["file"] + ".pdf")
    data = [sample(p) for p in P]
    for path in [os.path.join(DIR, "index.html"), os.path.join(ROOT, "hospitalist-toolkit", "tools", "as", "index.html")]: inject(path, data)
