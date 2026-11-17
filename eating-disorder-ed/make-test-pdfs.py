"""python3 make-test-pdfs.py : writes test-pdfs/*.txt and *.pdf, made-up chart extracts matching demo patients 1-5.
For the toolkit's Import PDF button. No real patient data. Chart "now" is fixed at 2026-11-17 09:30.
Note: the PDF importer does not create Encounter resources, so past ED visits and the admission come in as
dated notes, vitals and labs only; the visit count and IM-to-hospitalist transfer check need the real chart or ?demo=."""
import os
from datetime import datetime, timedelta
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas

HERE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "test-pdfs")
NOW = datetime(2026, 11, 17, 9, 30)
f = lambda dt: dt.strftime("%Y-%m-%d %H:%M")
D = lambda d, h=0: NOW - timedelta(days=d, hours=h)

def wrap(s, w=92):
    out, line = [], ""
    for word in s.split():
        if len(line) + len(word) + 1 > w: out.append(line); line = word
        else: line = (line + " " + word).strip()
    return out + ([line] if line else [])

REF = {"Potassium": ("mmol/L", "3.5 - 5.1", 3.5, 5.1), "Sodium": ("mmol/L", "135 - 145", 135, 145), "Phosphate": ("mmol/L", "0.80 - 1.45", 0.8, 1.45),
       "Magnesium": ("mmol/L", "0.70 - 1.00", 0.7, 1.0), "Glucose": ("mmol/L", "3.6 - 7.8", 3.6, 7.8), "Hemoglobin": ("g/L", "120 - 160", 120, 160),
       "White blood cell count": ("x10^9/L", "4.0 - 11.0", 4.0, 11.0), "Albumin": ("g/L", "35 - 50", 35, 50), "ALT": ("U/L", "0 - 40", 0, 40),
       "Bicarbonate": ("mmol/L", "22 - 29", 22, 29)}

def labs(when, vals):
    out = ["LABORATORY RESULTS", f"Collected: {f(when)}", f"{'Test':<26}{'Result':<17}{'Units':<16}{'Reference':<16}Flag", ""]
    for name, v in vals:
        u, ref, lo, hi = REF[name]; flag = "L" if v < lo else "H" if v > hi else ""
        out += [f"{name:<26}{v:<17}{u:<16}{ref:<16}{flag:<4}", ""]  # blank line between rows (importer)
    return out

def vit(when, hr, s, d, t, wt=None):
    return f"{f(when)} BP: {s}/{d} HR: {hr} Temp: {t} C" + (f" Weight: {wt} kg" if wt else "")

def visit(days, v, note, admit=None):
    t = D(days)
    L = [f"ED VISIT - {v['reason']}" + (f" (admitted {admit} days)" if admit else " (discharged home)"), f"Date of service: {f(t + timedelta(hours=3))}"]
    L += wrap("ED physician note: " + note + (f" ECG QTc {v['qtc']} ms." if v.get("qtc") else "")) + [vit(t + timedelta(hours=1), v["hr"], v["sbp"], v["dbp"], v["temp"], v.get("wt")), ""]
    vals = [(n, v[k]) for n, k in [("Potassium", "k"), ("Phosphate", "po4"), ("Glucose", "glu")] if v.get(k) is not None]
    return L + labs(t + timedelta(hours=2), vals) + [""]

def header(name, dob, sex, mrn, age, height, where):
    return ["PATIENT CHART EXTRACT - VICTORIA GENERAL HOSPITAL (TEST)", "MADE-UP TEST PATIENT - NOT A REAL PERSON - FOR SANDBOX TESTING ONLY",
            f"Patient: {name:<32}DOB: {dob}     Sex: {sex}", f"MRN: {mrn:<36}Age: {age}", f"Height: {height} cm      {where}", ""]

def tail(meds, problems, name, mrn, n):
    return ["ACTIVE MEDICATION ORDERS"] + meds + ["", "ACTIVE PROBLEM LIST"] + problems + ["", "", f"MADE-UP TEST PATIENT - NOT A REAL PERSON | {name} MRN {mrn}         Page {n}", ""]

def p1():
    nm, mrn = "DEMO, Sophie", "TESTEDR01"
    past = [(540, dict(hr=54, sbp=100, dbp=64, temp=36.5, wt=46.5, k=3.4, po4=0.98, glu=4.8, reason="Dizziness"), "Presents with dizziness after vomiting. Tolerated oral intake. Discharged with eating disorder program follow-up.", None),
            (470, dict(hr=49, sbp=95, dbp=60, temp=36.3, wt=45.0, k=2.7, po4=0.74, glu=4.1, qtc=462, reason="Hypokalemia"), "Hypokalemia 2.7 after daily vomiting. Admitted for IV potassium and phosphate replacement. Refeeding syndrome precautions.", 4),
            (400, dict(hr=56, sbp=102, dbp=66, temp=36.6, wt=46.0, k=3.5, glu=5.0, reason="Abdominal pain"), "Abdominal pain, benign exam. Seen by psychiatry in ED. Care plan reviewed.", None),
            (330, dict(hr=52, sbp=98, dbp=62, temp=36.4, wt=45.2, k=3.3, po4=0.92, glu=4.6, reason="Weakness"), "Generalized weakness. Potassium replaced orally. Discharged per care plan.", None),
            (260, dict(hr=51, sbp=97, dbp=63, temp=36.5, wt=44.8, k=3.2, glu=4.4, reason="Palpitations"), "Palpitations, ECG sinus rhythm. Dietitian follow-up arranged.", None),
            (200, dict(hr=47, sbp=92, dbp=58, temp=36.2, wt=43.9, k=3.0, po4=0.85, glu=4.0, qtc=448, reason="Presyncope"), "Presyncope. Orthostatic. IV fluids, then admitted for monitoring.", 3),
            (130, dict(hr=55, sbp=101, dbp=65, temp=36.6, wt=44.5, k=3.6, glu=4.9, reason="Anxiety"), "Anxiety, denies suicidal ideation. Discharged with mental health worker follow-up.", None),
            (75, dict(hr=53, sbp=99, dbp=61, temp=36.4, wt=44.2, k=3.3, po4=0.9, glu=4.6, reason="Vomiting"), "Vomiting several times a week. Electrolytes replaced. Discharged with family doctor follow-up.", None),
            (30, dict(hr=52, sbp=98, dbp=62, temp=36.5, wt=44.0, k=3.4, glu=4.7, qtc=440, reason="Chest discomfort"), "Atypical chest discomfort, ECG normal, troponin negative. Discharged per care plan.", None)]
    t = D(0, 4)
    L = header(nm, "1997-03-09", "F", mrn, 29, 165, f"ED visit in progress since {f(t)}")
    L += ["ED PHYSICIAN NOTE (TODAY)", f"Date of service: {f(t + timedelta(hours=2))}"] + wrap("Known anorexia nervosa. Presents with weakness after vomiting 3-4 times this week. Denies suicidal ideation. Eating small meals. Drinking fluids. No syncope. ECG sinus rhythm, QTc 442 ms.")
    L += [vit(t + timedelta(hours=0.5), 54, 99, 63, 36.5, 43.8), vit(t + timedelta(hours=3), 52, 97, 62, 36.5), ""]
    L += labs(t + timedelta(hours=1), [("Potassium", 3.2), ("Sodium", 137), ("Phosphate", 0.94), ("Magnesium", 0.78), ("Glucose", 4.7), ("Hemoglobin", 121), ("White blood cell count", 4.6), ("Albumin", 38), ("ALT", 32)])
    L += [""] + tail(["Sertraline 100 mg PO daily", "Multivitamin PO daily"], ["Anorexia nervosa, binge-eating/purging type", "Generalized anxiety disorder"], nm, mrn, 1)
    L += ["INTERDISCIPLINARY CARE PLAN", f"Date of service: {f(D(380))}"] + wrap("ED care plan for frequent presentations. Medical admission only if red MEED criteria are met. If medically stable: replace electrolytes in ED, contact the eating disorder program next business day, follow-up with family doctor within 1 week. Contact: ED program intake. Psychiatry consult only if suicidal ideation.") + ["", "PRIOR ED VISITS", ""]
    for d, v, note, adm in past: L += visit(d, v, note, adm)
    return "01_frequent_stable_Sophie", nm, mrn, L

def p2():
    nm, mrn = "DEMO, Hannah", "TESTEDR02"; t = D(0, 3)
    L = header(nm, "2002-07-21", "F", mrn, 24, 163, f"ED visit in progress since {f(t)}")
    L += ["ED PHYSICIAN NOTE (TODAY)", f"Date of service: {f(t + timedelta(hours=1.5))}"] + wrap("Syncope at home, collapsed in kitchen. Refusing to eat for 4 days, drinking small amounts. Passive suicidal thoughts. Bradycardic to 38. ECG sinus bradycardia, QTc 476 ms.")
    L += [vit(t + timedelta(hours=0.3), 41, 86, 54, 35.7, 36.0), vit(t + timedelta(hours=2), 38, 84, 52, 35.7), ""]
    L += labs(t + timedelta(hours=1), [("Potassium", 2.8), ("Sodium", 133), ("Phosphate", 0.62), ("Magnesium", 0.66), ("Glucose", 3.1), ("Hemoglobin", 104), ("White blood cell count", 2.9), ("Albumin", 33), ("ALT", 145)])
    L += [""] + tail(["Fluoxetine 20 mg PO daily"], ["Anorexia nervosa, restricting type", "Major depressive disorder"], nm, mrn, 1)
    L += ["EATING DISORDER PROGRAM CLINIC NOTE", f"Date of service: {f(D(14))}"] + wrap("Weight 39.0 kg, down from 40.2. Restricting to one small meal a day. Plan reviewed.") + [vit(D(14), 50, 94, 60, 36.3, 39.0), "", "PRIOR ED VISITS", ""]
    L += visit(160, dict(hr=48, sbp=94, dbp=60, temp=36.2, wt=41.5, k=3.6, po4=0.9, glu=4.2, reason="Fatigue"), "Fatigue. Discharged with eating disorder program referral.")
    L += visit(90, dict(hr=45, sbp=90, dbp=58, temp=36.0, wt=40.2, k=3.4, po4=0.82, glu=3.9, reason="Dizziness"), "Dizziness. Declined admission. Psychiatry saw patient.")
    return "02_red_criteria_Hannah", nm, mrn, L

def p3():
    nm, mrn = "DEMO, Marcus", "TESTEDR03"; t = D(0, 1.5)
    L = header(nm, "1992-01-15", "M", mrn, 34, 178, f"ED visit in progress since {f(t)}")
    L += ["TRIAGE NOTE (TODAY)", f"Date of service: {f(t + timedelta(hours=1))}", "Vomiting since last night. Labs drawn, pending. No ECG yet.", vit(t + timedelta(hours=0.3), 76, 112, 70, 36.7), ""]
    L += tail(["Insulin glargine 100 unit/mL SC daily", "Insulin lispro 100 unit/mL SC with meals"], ["Bulimia nervosa", "Type 1 diabetes mellitus"], nm, mrn, 1) + ["PRIOR ED VISITS", ""]
    L += visit(300, dict(hr=72, sbp=118, dbp=74, temp=36.7, wt=63, k=3.3, glu=14.2, reason="Hyperglycemia"), "Hyperglycemia with insulin omission. Discharged.")
    L += visit(180, dict(hr=88, sbp=104, dbp=66, temp=36.8, wt=61, k=3.1, po4=0.8, glu=22.5, reason="DKA"), "Mild DKA after insulin restriction. Admitted to medicine.", 3)
    L += visit(60, dict(hr=70, sbp=116, dbp=72, temp=36.6, wt=62, k=3.5, glu=11.0, reason="Vomiting"), "Vomiting after binge. Tolerating fluids. Discharged with GP follow-up.")
    return "03_partly_assessed_Marcus", nm, mrn, L

def admitted(stay):
    nm, mrn = ("DEMO, Priya", "TESTEDR05") if stay else ("DEMO, Claire", "TESTEDR04")
    days = 4 if stay else 9; adm = D(days)
    L = header(nm, "1999-11-02" if stay else "1994-05-30", "F", mrn, 27 if stay else 32, 160, f"Admitted to Internal Medicine {f(adm + timedelta(hours=6))} (day {days})")
    L += ["INTERNAL MEDICINE ADMISSION NOTE", f"Date of service: {f(adm + timedelta(hours=3))}"] + wrap("Admitted to GIM for supervised feeding. HR 38, food refusal 6 days. Refeeding protocol started with dietitian. Psychiatry liaison consulted.") + [""]
    if stay: L += ["INTERNAL MEDICINE PROGRESS NOTE", f"Date of service: {f(D(2) + timedelta(hours=4))}"] + wrap("Phosphate 0.38 on day 2 of feeding, IV phosphate given. Continue refeeding precautions. Dizzy on standing.") + [""]
    else: L += ["INTERNAL MEDICINE PROGRESS NOTE", f"Date of service: {f(D(3) + timedelta(hours=4))}"] + wrap("Glucose 3.7 one hour after lunch, postprandial, asymptomatic, resolved. Phosphate replaced earlier in admission, now stable. Tolerating full meal plan. ECG QTc 446 ms.") + [""]
    L += ["DAILY VITALS AND LABS", ""]
    for d in range(days, -1, -1):
        t = NOW - timedelta(days=d) + timedelta(hours=2) - (timedelta(hours=4) if d == 0 else timedelta(0))
        hr = 38 + (days - d) if d > 6 else 44 + (days - d) % 4
        L += [vit(t, hr, 92 + (days - d), 58, 36.2, round(34.0 + (days - d) * 0.15, 1) if d % 3 == 0 else None), ""]
        po4 = 0.35 if d == 8 else (0.38 if stay and d == 2 else 0.82)
        L += labs(t, [("Potassium", 2.9 if d == 5 else 3.5), ("Phosphate", po4), ("Sodium", 136), ("Bicarbonate", 28), ("Glucose", 3.7 if d == 3 else 4.8)]) + [""]
    L += tail(["Thiamine 100 mg PO daily", "Potassium phosphate PO"], ["Anorexia nervosa, restricting type"], nm, mrn, 1) + ["PRIOR ED VISITS", ""]
    L += visit(120, dict(hr=50, sbp=96, dbp=60, temp=36.3, wt=37.5, k=3.4, po4=0.85, glu=4.3, reason="Weakness"), "Weakness. Discharged per care plan.")
    return ("05_admitted_day4_Priya" if stay else "04_admitted_day9_Claire"), nm, mrn, L

os.makedirs(HERE, exist_ok=True)
for fn, nm, mrn, lines in [p1(), p2(), p3(), admitted(False), admitted(True)]:
    base = os.path.join(HERE, fn)
    open(base + ".txt", "w").write("\n".join(lines) + "\n")
    c = canvas.Canvas(base + ".pdf", pagesize=letter); c.setTitle("MADE-UP TEST PATIENT"); y = 750
    for line in lines:
        if y < 50:
            c.setFont("Courier", 8.6); c.drawString(36, 36, f"MADE-UP TEST PATIENT - NOT A REAL PERSON | {nm} MRN {mrn}"); c.showPage(); y = 750
        c.setFont("Courier", 8.6); c.drawString(36, y, line); y -= 11
        if "MADE-UP TEST PATIENT - NOT A REAL PERSON |" in line: c.showPage(); y = 750
    c.save(); print("pdf", fn + ".pdf")
