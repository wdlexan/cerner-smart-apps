"""python3 make-test-pdfs.py : writes test-pdfs/*.txt and *.pdf (made-up chart extracts for the toolkit's Import PDF button).
No real patient data. PDF dates are fixed (chart "now" = 2026-11-19 12:00). Same layout as infections/make-test-pdfs.py.
After running, copy test-pdfs/*.pdf to hospitalist-toolkit/sample-pdfs/Peritoneal carcinomatosis/ and list them in sample-pdfs/index.js."""
import os
from datetime import datetime, timedelta
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas

DIR = os.path.dirname(os.path.abspath(__file__)); HERE = os.path.join(DIR, "test-pdfs")
NOW = datetime(2026, 11, 19, 12, 0)
f = lambda dt: dt.strftime("%Y-%m-%d %H:%M"); H = lambda h: NOW - timedelta(hours=h)
D = 24  # hours per day, for marker dates

def wrap(s, w=92):
    out, line = [], ""
    for word in s.split():
        if len(line) + len(word) + 1 > w: out.append(line); line = word
        else: line = (line + " " + word).strip()
    return out + ([line] if line else [])

def build(p):
    L = ["PATIENT CHART EXTRACT - VICTORIA GENERAL HOSPITAL (TEST)", "MADE-UP TEST PATIENT - NOT A REAL PERSON - FOR SANDBOX TESTING ONLY",
         f"Patient: {p['name']:<32}DOB: {p['dob']}     Sex: {p['sex']}", f"MRN: {p['mrn']:<36}Age: {p['age']}", ""]
    L += ["ALLERGIES"] + ([f"{a[0]} - {a[1]}" for a in p.get("allergies", [])] or ["No known drug allergies"]) + [""]
    for title, h, text in p["notes"]: L += [title, f"Date of service: {f(H(h))}"] + wrap(text) + [""]
    L += ["VITAL SIGNS"] + [f"{f(H(h))} BP: {s}/{d} HR: {hr} RR: {rr} Temp: {t} C SpO2: {o}%" for h, s, d, hr, rr, t, o in p["vitals"]] + [""]
    rows = {}
    for name, v, unit, h in p["labs"]: rows.setdefault(h, []).append((name, v, unit))
    for h in sorted(rows, reverse=True):
        L += ["LABORATORY RESULTS", f"Collected: {f(H(h))}", f"{'Test':<26}{'Result':<17}{'Units':<16}", ""]
        for name, v, unit in rows[h]: L += [f"{name:<26}{str(v):<17}{unit:<16}", ""]
    L += ["", f"ACTIVE MEDICATION ORDERS ({NOW:%Y-%m-%d})"] + p["meds"] + ["", "ACTIVE PROBLEM LIST"] + p["conds"]
    L += ["", "", f"MADE-UP TEST PATIENT - NOT A REAL PERSON | {p['name']} MRN {p['mrn']}         Page 1", "", "RADIOLOGY AND PATHOLOGY REPORTS", ""]
    for r in p["reps"]: L += [r["text"].upper(), f"Date of exam: {f(H(r['h']))}", "IMPRESSION:"] + wrap(r["conclusion"]) + [""]
    L += ["", "", f"MADE-UP TEST PATIENT - NOT A REAL PERSON | {p['name']} MRN {p['mrn']}         Page 2"]
    return L

P = [
 dict(file="01 Arthur - colorectal, SBO, low K, metoclopramide", name="DEMO, ARTHUR", dob="1958-04-11", sex="M", mrn="TESTPC01", age=68,
  notes=[("ED PHYSICIAN NOTE", 150, "68 year old with sigmoid adenocarcinoma (pMMR, KRAS mutated) and peritoneal metastases, on second-line FOLFIRI-bevacizumab, last dose 3 weeks ago. Four days of colicky pain, distension and vomiting, no flatus for 2 days. CT: small bowel obstruction with two transition points in the pelvis. NG inserted, 1.4 L out. Admit hospitalist, general surgery consulted."),
         ("HOSPITALIST PROGRESS NOTE", 4, "Day 6. Still vomiting despite NG, colicky pain. Surgery: not an operative candidate (multiple levels, carcinomatosis). Metoclopramide continued from ED, Buscopan PRN added yesterday. Dexamethasone day 7 without clear benefit. Weight down 6 kg over 2 months. ECOG 2 before admission. Goals-of-care discussion not yet held.")],
  vitals=[(150, 132, 80, 104, 20, 37.4, 96), (72, 124, 76, 98, 18, 37.1, 96), (24, 112, 70, 106, 18, 37.0, 95), (4, 108, 66, 110, 20, 37.2, 95)],
  labs=[("Sodium", 133, "mmol/L", 5), ("Potassium", 3.1, "mmol/L", 5), ("Magnesium", 0.62, "mmol/L", 5), ("Calcium", 2.15, "mmol/L", 5), ("Albumin", 26, "g/L", 5),
        ("Creatinine", 82, "umol/L", 148), ("Creatinine", 131, "umol/L", 5), ("Lactate", 1.4, "mmol/L", 5), ("WBC", 11.2, "x10^9/L", 5), ("Hemoglobin", 104, "g/L", 5),
        ("CEA", 18, "ug/L", 90 * D), ("CEA", 42, "ug/L", 38 * D), ("CEA", 96, "ug/L", 2 * D), ("CA 19-9", 210, "kU/L", 2 * D)],
  meds=["Metoclopramide 10 mg IV q6h", "Hyoscine butylbromide 20 mg subcut q6h PRN", "Dexamethasone 8 mg IV daily", "Hydromorphone 0.5 mg subcut q2h PRN",
        "Sennosides 17.2 mg PO at bedtime", "Enoxaparin 40 mg subcut daily"],
  conds=["Malignant neoplasm of sigmoid colon", "Secondary malignant neoplasm of peritoneum", "Small bowel obstruction", "Hypertension"],
  reps=[{"text": "CT abdomen and pelvis with contrast", "h": 148, "conclusion": "Dilated small bowel loops with two transition points in the pelvis. Omental caking and diffuse peritoneal nodularity consistent with peritoneal carcinomatosis. Small volume ascites. Mild left hydronephrosis."}]),
 dict(file="02 Beatrice - ovarian, tense ascites, CA-125 rising", name="DEMO, BEATRICE", dob="1967-02-03", sex="F", mrn="TESTPC02", age=59,
  notes=[("ED PHYSICIAN NOTE", 30, "59 year old with high-grade serous ovarian cancer, germline BRCA1, stage IIIC, interval debulking 2 years ago, on olaparib maintenance. Three weeks of increasing abdominal girth, early satiety and dyspnea on exertion. Tense ascites on exam. No vomiting, passing stool and flatus. Admitted for therapeutic paracentesis and work-up of recurrence."),
         ("HOSPITALIST NOTE", 3, "IR drained 4.8 L, dyspnea improved. Second tap in 3 weeks. Discussing tunnelled peritoneal catheter. Gyne-oncology aware, likely platinum-sensitive recurrence (last platinum 26 months ago).")],
  vitals=[(30, 118, 72, 98, 22, 36.8, 94), (12, 112, 70, 92, 20, 36.9, 95), (3, 108, 68, 88, 16, 36.7, 98)],
  labs=[("Sodium", 136, "mmol/L", 6), ("Potassium", 4.0, "mmol/L", 6), ("Magnesium", 0.80, "mmol/L", 6), ("Creatinine", 64, "umol/L", 6), ("Albumin", 31, "g/L", 6), ("Calcium", 2.30, "mmol/L", 6),
        ("CA-125", 410, "kU/L", 92 * D), ("CA-125", 95, "kU/L", 50 * D), ("CA-125", 780, "kU/L", 1 * D), ("CEA", 2.1, "ug/L", 1 * D), ("HE4", 640, "pmol/L", 1 * D)],
  meds=["Olaparib 300 mg PO BID", "Hydromorphone 1 mg PO q4h PRN", "Polyethylene glycol 3350 17 g PO daily", "Ondansetron 4 mg PO q8h PRN"],
  conds=["High grade serous carcinoma of ovary", "Malignant ascites", "Peritoneal carcinomatosis", "BRCA1 mutation carrier"],
  reps=[{"text": "CT abdomen and pelvis with contrast", "h": 28, "conclusion": "Large volume ascites. New peritoneal nodularity in the right paracolic gutter and pelvis, largest 2.2 cm, and omental thickening, consistent with recurrent peritoneal carcinomatosis. No bowel obstruction."},
        {"text": "Ascitic fluid cytology", "h": 20, "conclusion": "Positive for malignant cells, consistent with metastatic high-grade serous carcinoma (PAX8 and WT1 positive). SAAG 7 g/L, total protein 41 g/L."}]),
 dict(file="03 Charles - gastric, outlet obstruction, high Ca, lactate", name="DEMO, CHARLES", dob="1952-07-20", sex="M", mrn="TESTPC03", age=74,
  notes=[("ED PHYSICIAN NOTE", 12, "74 year old with gastric adenocarcinoma (HER2 negative, PD-L1 CPS 8) diagnosed 4 months ago, peritoneal metastases, on FOLFOX-nivolumab. Two days of vomiting undigested food, unable to keep fluids down, epigastric pain worse in the last 6 hours, now tender with guarding. Confused per wife."),
         ("HOSPITALIST NOTE", 2, "Lactate rising. Concern for perforation or ischemia versus gastric outlet obstruction. Surgery paged. No antiemetic or antisecretory yet.")],
  vitals=[(12, 104, 62, 112, 22, 37.9, 95), (6, 98, 58, 118, 24, 38.1, 94), (2, 94, 56, 122, 24, 38.3, 94)],
  labs=[("Potassium", 3.6, "mmol/L", 3), ("Calcium", 2.85, "mmol/L", 3), ("Albumin", 24, "g/L", 3), ("Lactate", 3.4, "mmol/L", 2), ("WBC", 17.5, "x10^9/L", 3),
        ("Creatinine", 98, "umol/L", 3), ("Total bilirubin", 18, "umol/L", 3), ("CA 19-9", 1250, "kU/L", 40), ("CEA", 22, "ug/L", 40), ("CA 72-4", 48, "kU/L", 40)],
  meds=["Pantoprazole 40 mg IV daily", "Morphine 2.5 mg subcut q2h PRN"],
  conds=["Adenocarcinoma of stomach", "Gastric outlet obstruction", "Peritoneal metastases", "Type 2 diabetes mellitus"],
  reps=[{"text": "CT abdomen with contrast", "h": 10, "conclusion": "Circumferential antral thickening with gastric outlet obstruction and a distended stomach. Peritoneal nodules and omental stranding. Small amount of free fluid; no definite free air."}]),
 dict(file="04 Doris - new ascites, unknown primary", name="DEMO, DORIS", dob="1963-10-08", sex="F", mrn="TESTPC04", age=63,
  notes=[("ED PHYSICIAN NOTE", 40, "63 year old previously well, ex-smoker. Six weeks of bloating, early satiety, 5 kg weight loss and change in bowel habit. Shifting dullness. No known cancer. Gynecology referral pending. Admitted for work-up."),
         ("HOSPITALIST NOTE", 3, "CT: omental cake and ascites, no clear primary; ovaries mildly bulky. Diagnostic tap sent. CA-125 high but CEA also high - GI primary not excluded. Plan core biopsy of omentum with IR and colonoscopy/OGD.")],
  vitals=[(40, 128, 78, 88, 16, 36.8, 97), (3, 124, 76, 86, 16, 36.7, 97)],
  labs=[("Sodium", 137, "mmol/L", 30), ("Potassium", 4.2, "mmol/L", 30), ("Creatinine", 70, "umol/L", 30), ("Albumin", 32, "g/L", 30), ("Calcium", 2.32, "mmol/L", 30),
        ("Hemoglobin", 112, "g/L", 30), ("CA-125", 420, "kU/L", 30), ("CEA", 58, "ug/L", 30), ("CA 19-9", 310, "kU/L", 30)],
  meds=["Acetaminophen 1 g PO q6h PRN", "Enoxaparin 40 mg subcut daily"],
  conds=["Ascites, new", "Omental mass", "Weight loss"],
  reps=[{"text": "CT chest abdomen and pelvis with contrast", "h": 36, "conclusion": "Moderate ascites with omental caking and peritoneal thickening suspicious for peritoneal carcinomatosis. Mildly bulky ovaries bilaterally (possible Krukenberg tumours versus primary). Possible thickening of the gastric antrum. No liver metastases."},
        {"text": "Ascitic fluid analysis", "h": 20, "conclusion": "SAAG 6 g/L, total protein 38 g/L, WBC 420 (lymphocyte predominant). Cytology: adenocarcinoma with signet-ring features; immunostains pending (CK7, CK20, CDX2, PAX8)."}]),
 dict(file="05 Edward - appendiceal pseudomyxoma, CRS referral", name="DEMO, EDWARD", dob="1974-12-15", sex="M", mrn="TESTPC05", age=51,
  notes=[("ED PHYSICIAN NOTE", 60, "51 year old, fit, ECOG 0. Gradual abdominal distension over 4 months, now uncomfortable. Exam: distended, doughy, no peritonism. Eating and passing stool."),
         ("HOSPITALIST NOTE", 4, "CT and biopsy consistent with low-grade appendiceal mucinous neoplasm with pseudomyxoma peritonei. Large volume mucinous ascites, scalloping of liver. Not drainable by needle. Plan referral to peritoneal surface malignancy centre for cytoreductive surgery and HIPEC.")],
  vitals=[(60, 132, 84, 82, 16, 36.6, 98), (4, 128, 80, 80, 16, 36.7, 98)],
  labs=[("Sodium", 139, "mmol/L", 50), ("Potassium", 4.3, "mmol/L", 50), ("Creatinine", 84, "umol/L", 50), ("Albumin", 38, "g/L", 50), ("Hemoglobin", 138, "g/L", 50),
        ("CEA", 34, "ug/L", 50), ("CA 19-9", 88, "kU/L", 50), ("CA-125", 64, "kU/L", 50)],
  meds=["Acetaminophen 1 g PO q6h PRN", "Polyethylene glycol 3350 17 g PO daily"],
  conds=["Pseudomyxoma peritonei", "Low grade appendiceal mucinous neoplasm"],
  reps=[{"text": "CT abdomen and pelvis with contrast", "h": 58, "conclusion": "Large volume low-attenuation mucinous ascites with scalloping of the liver and splenic surfaces. Cystic appendiceal mass 4 cm. Omental caking. Small bowel mesentery relatively spared. Findings consistent with pseudomyxoma peritonei."},
        {"text": "Omental core biopsy pathology", "h": 20, "conclusion": "Low-grade mucinous carcinoma peritonei, consistent with appendiceal origin (CK20 and CDX2 positive, CK7 negative)."}]),
 dict(file="06 Florence - pancreatic, inoperable MBO, end of life", name="DEMO, FLORENCE", dob="1950-05-29", sex="F", mrn="TESTPC06", age=76,
  notes=[("ED PHYSICIAN NOTE", 100, "76 year old with metastatic pancreatic adenocarcinoma (peritoneum, liver), progressed on gemcitabine and nab-paclitaxel; oncology says no further chemotherapy. Five days of feculent vomiting, no stool or flatus. CT: multilevel small bowel obstruction. Mostly in bed for the last 2 weeks."),
         ("HOSPITALIST NOTE", 2, "PPS 30%. NG output 1.8 L/day. Patient wants to be comfortable and go home if possible. Considering venting gastrostomy versus hospice. Recurrent ascites tapped twice this month.")],
  vitals=[(100, 104, 60, 108, 20, 37.0, 95), (48, 98, 56, 112, 20, 37.2, 94), (2, 92, 52, 118, 22, 37.4, 93)],
  labs=[("Sodium", 131, "mmol/L", 6), ("Potassium", 3.3, "mmol/L", 6), ("Creatinine", 112, "umol/L", 6), ("Albumin", 21, "g/L", 6), ("Total bilirubin", 64, "umol/L", 6),
        ("Alkaline phosphatase", 410, "U/L", 6), ("CA 19-9", 8400, "kU/L", 20 * D), ("CEA", 41, "ug/L", 20 * D)],
  meds=["Octreotide 100 mcg subcut q8h", "Haloperidol 0.5 mg subcut q8h PRN", "Hydromorphone 1 mg subcut q1h PRN", "Dexamethasone 8 mg subcut daily"],
  conds=["Malignant neoplasm of pancreas", "Secondary malignant neoplasm of peritoneum", "Malignant bowel obstruction", "Malignant ascites", "Liver metastases"],
  reps=[{"text": "CT abdomen and pelvis with contrast", "h": 98, "conclusion": "Multiple transition points in the small bowel with dilated loops, consistent with malignant bowel obstruction from diffuse peritoneal carcinomatosis. Moderate ascites. Multiple liver metastases, enlarged since prior. Biliary dilatation."}])
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
