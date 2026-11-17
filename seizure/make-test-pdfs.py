"""python3 make-test-pdfs.py : writes test-pdfs/*.txt and *.pdf (made-up chart extracts for the toolkit's Import PDF button)
and demo-patients.js (the same patients for index.html?demo=1, 2, 3). No real patient data.
PDF dates are fixed (chart "now" = 2026-11-17 09:30); the app reads labs from the last 7 days, so import them within a week
or use the demo links (demo dates are relative to when you open the page).
  1 New-onset: first unprovoked GTC, cavernoma on MRI, temporal sharp waves on EEG, commercial (Class 1) driver.
  2 Breakthrough / recurrent: juvenile myoclonic epilepsy on lamotrigine, combined OCP started 6 weeks ago, ciprofloxacin, low level.
  3 Status epilepticus: post-stroke epilepsy on phenytoin (low albumin-corrected level), Na 114, cefepime with AKI, apixaban."""
import os, json
from datetime import datetime, timedelta
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas

DIR = os.path.dirname(os.path.abspath(__file__))
HERE = os.path.join(DIR, "test-pdfs")
NOW = datetime(2026, 11, 17, 9, 30)
f = lambda dt: dt.strftime("%Y-%m-%d %H:%M")
H = lambda h: NOW - timedelta(hours=h)

LOINC = {"Sodium": "2951-2", "Potassium": "2823-3", "Glucose": "2345-7", "Calcium": "17861-6", "Ionized calcium": "1994-3", "Magnesium": "19123-9",
         "Phosphate": "2777-1", "Creatinine": "2160-0", "eGFR": "62238-1", "Urea": "3094-0", "ALT": "1742-6", "Albumin": "1751-7", "WBC": "6690-2",
         "Hemoglobin": "718-7", "Platelets": "777-3", "CK": "2157-6", "Lactate": "2524-7", "Prolactin": "2842-3", "Ethanol": "5643-2",
         "Phenytoin level": "3968-5", "Phenytoin level, free": "3969-3", "Lamotrigine level": "6948-4", "Valproate": "4086-5", "beta-hCG": "21198-7",
         "C reactive protein": "1988-5", "Ammonia": "16362-6", "TSH": "3016-3", "Troponin": "10839-9"}

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
         f"Patient: {p['name']:<32}DOB: {p['dob']}     Sex: {p['sex']}", f"MRN: {p['mrn']:<36}Age: {p['age']}",
         f"ED arrival: {f(H(p['arrive']))}    Admitted: {f(H(p['arrive'] - 3))} (Hospitalist)", ""]
    for title, h, text in p["notes"]:
        L += [title, f"Date of service: {f(H(h))}"] + wrap(text) + [""]
    L += ["VITAL SIGNS"] + [f"{f(H(h))} BP: {s}/{d} HR: {hr} Temp: {tp} C SpO2: {o2}%" for h, s, d, hr, tp, o2 in p["vitals"]] + [f"Weight: {p['weight']} kg", ""]
    for h, rows in p["labs"]: L += labs(f(H(h)), rows)
    L += ["", "MEDICATIONS GIVEN"] + [f"{g} {f(H(h))}" for g, h in p["given"]] + ["", f"ACTIVE MEDICATION ORDERS ({NOW:%Y-%m-%d})"] + p["meds"]
    L += ["", "ACTIVE ORDERS"] + p["orders"] + ["", "ACTIVE PROBLEM LIST"] + p["problems"]
    L += ["", "", f"MADE-UP TEST PATIENT - NOT A REAL PERSON | {p['name']} MRN {p['mrn']}         Page 1", "", "RADIOLOGY, EEG AND CARDIAC REPORTS", ""]
    for title, h, imp in p["reports"]:
        L += [title, f"Date of exam: {f(H(h))}", "IMPRESSION:"] + wrap(imp) + [""]
    L += ["", "", f"MADE-UP TEST PATIENT - NOT A REAL PERSON | {p['name']} MRN {p['mrn']}         Page 2"]
    return L

def demo(p):
    """Same patient as FHIR-like resources for the app's demo mode; h = hours before 'now'."""
    fam, given = p["name"].split(", ")
    return {
      "label": p["label"],
      "pt": {"resourceType": "Patient", "name": [{"given": [given.title()], "family": fam.title()}], "gender": "male" if p["sex"] == "M" else "female",
             "birthDate": p["dob"], "identifier": [{"type": {"text": "MRN"}, "value": p["mrn"]}]},
      "labs": [{"text": r[0], "loinc": LOINC.get(r[0], ""), "v": float(r[1]) if r[1].replace(".", "", 1).isdigit() else None, "unit": r[2], "h": h}
               for h, rows in p["labs"] for r in rows],
      "weight": p["weight"],
      "meds": p["meds"],
      "conds": p["problems"],
      "reps": [{"text": t, "h": h, "conclusion": c} for t, h, c in p["reports"]]
    }

P = [
 dict(file="01_new_onset_Kevin", label="New-onset seizure (cavernoma, commercial driver)", name="DEMO, KEVIN", dob="1980-06-03", sex="M", mrn="TESTSZ01", age=46, arrive=20, weight=92,
  notes=[("ED PHYSICIAN NOTE", 19.5, "46 year old long-haul truck driver (Class 1 licence). Witnessed generalized tonic-clonic seizure at the depot about 2 minutes, tongue bite on the left side, urinary incontinence, confused for about 20 minutes afterward. No prior seizures. No alcohol excess, no recreational drugs, slept normally. No head injury. Normal neurological exam now. CT head negative. Admit to hospitalist for MRI and EEG."),
         ("HOSPITALIST ADMISSION NOTE", 16, "First seizure, appears unprovoked: sodium, glucose, calcium and magnesium normal, ethanol negative, no new medications. Lactate and CK raised in keeping with a generalized convulsion. Plan MRI brain epilepsy protocol, EEG, neurology input. Counselled not to drive; commercial licence."),
         ("NEUROLOGY CONSULT NOTE", 3, "MRI shows a left temporal cavernoma and EEG shows left temporal sharp waves. Single seizure with structural lesion and epileptiform EEG gives high recurrence risk, meets the ILAE practical definition of epilepsy. Started levetiracetam 500 mg BID. Neurosurgery outpatient referral regarding cavernoma. Driving: no commercial driving; report to RoadSafetyBC.")],
  vitals=[(19.6, 152, 88, 104, 37.1, 97), (15, 138, 82, 86, 36.9, 98), (6, 132, 80, 78, 36.8, 98)],
  labs=[(19.4, [("Sodium", "138", "mmol/L", "135 - 145", ""), ("Potassium", "3.9", "mmol/L", "3.5 - 5.0", ""), ("Glucose", "7.4", "mmol/L", "3.6 - 7.8", ""),
                ("Calcium", "2.34", "mmol/L", "2.10 - 2.60", ""), ("Magnesium", "0.84", "mmol/L", "0.70 - 1.00", ""), ("Creatinine", "88", "umol/L", "60 - 110", ""),
                ("eGFR", "92", "mL/min/1.73m2", "> 60", ""), ("WBC", "12.1", "x10^9/L", "4.0 - 11.0", "H"), ("Hemoglobin", "151", "g/L", "135 - 175", ""),
                ("Lactate", "5.2", "mmol/L", "0.5 - 2.2", "H"), ("Prolactin", "48", "ug/L", "4 - 15", "H"), ("Ethanol", "0", "mmol/L", "0", ""), ("Troponin", "4", "ng/L", "< 16", "")]),
        (4, [("CK", "1420", "U/L", "40 - 300", "H"), ("ALT", "31", "U/L", "< 50", ""), ("Albumin", "41", "g/L", "35 - 50", "")])],
  given=[("Lorazepam 2 mg IV once (EMS)", 19.8), ("Levetiracetam 500 mg PO once", 3)],
  meds=["Levetiracetam 500 mg PO BID", "Atorvastatin 20 mg PO daily", "Ramipril 5 mg PO daily"],
  orders=["MRI brain epilepsy protocol", "EEG routine", "Seizure precautions", "Neurology consult"],
  problems=["First unprovoked seizure", "Hypertension", "Dyslipidemia"],
  reports=[("CT HEAD WITHOUT CONTRAST", 19, "No acute intracranial hemorrhage, mass effect or acute infarct. Small focus of hyperdensity in the left anterior temporal lobe, recommend MRI."),
           ("MRI BRAIN EPILEPSY PROTOCOL", 8, "1.4 cm left anterior temporal cavernous malformation with complete hemosiderin rim, no recent hemorrhage. Hippocampi normal and symmetric. No other lesion."),
           ("ELECTROENCEPHALOGRAM (EEG)", 5, "Abnormal awake and drowsy EEG: intermittent left temporal sharp waves, maximal T7/F7. No electrographic seizures. Supports a left temporal epileptogenic focus."),
           ("ECG 12 LEAD", 19.3, "Sinus tachycardia 104. Normal intervals, QTc 432 ms. No Brugada pattern.")]),
 dict(file="02_breakthrough_Maria", label="Breakthrough seizure (JME on lamotrigine, new OCP)", name="DEMO, MARIA", dob="1997-02-21", sex="F", mrn="TESTSZ02", age=29, arrive=14, weight=58,
  notes=[("ED PHYSICIAN NOTE", 13.5, "29 year old with juvenile myoclonic epilepsy, seizure free 3 years on lamotrigine 150 mg BID. Generalized tonic-clonic seizure at home this morning shortly after waking, witnessed by partner; also morning myoclonic jerks for the past 2 weeks. Started a combined oral contraceptive 6 weeks ago. Took ciprofloxacin for a urinary tract infection since 3 days ago. Slept 4 hours the night before (night shift nurse). Reports taking lamotrigine regularly. Exam normal."),
         ("HOSPITALIST NOTE", 2, "Breakthrough seizure in known generalized epilepsy. Likely trigger: lamotrigine level reduced by estrogen-containing contraceptive, plus sleep deprivation and ciprofloxacin. Lamotrigine level low. Pregnancy test negative. Plan discuss dose increase and contraception with neurology; myoclonus may also be worsened by lamotrigine, consider switch to levetiracetam. Drives a car (Class 5).")],
  vitals=[(13.6, 128, 78, 96, 36.8, 99), (8, 116, 72, 74, 36.7, 99), (2, 112, 70, 70, 36.6, 99)],
  labs=[(13.4, [("Sodium", "139", "mmol/L", "135 - 145", ""), ("Glucose", "5.2", "mmol/L", "3.6 - 7.8", ""), ("Calcium", "2.30", "mmol/L", "2.10 - 2.60", ""),
                ("Magnesium", "0.78", "mmol/L", "0.70 - 1.00", ""), ("Creatinine", "62", "umol/L", "45 - 90", ""), ("eGFR", "118", "mL/min/1.73m2", "> 60", ""),
                ("WBC", "8.4", "x10^9/L", "4.0 - 11.0", ""), ("beta-hCG", "1", "IU/L", "< 5", ""), ("Lactate", "3.1", "mmol/L", "0.5 - 2.2", "H"), ("CK", "390", "U/L", "30 - 200", "H")]),
        (10, [("Lamotrigine level", "9", "umol/L", "12 - 55", "L"), ("ALT", "18", "U/L", "< 35", "")])],
  given=[("Lamotrigine 150 mg PO once", 10)],
  meds=["Lamotrigine 150 mg PO BID", "Ethinyl Estradiol 30 mcg with levonorgestrel 150 mcg PO daily", "Ciprofloxacin 500 mg PO BID", "Folic acid 1 mg PO daily"],
  orders=["Seizure precautions", "Neurology consult", "EEG routine"],
  problems=["Juvenile myoclonic epilepsy (generalized epilepsy)", "Urinary tract infection"],
  reports=[("CT HEAD WITHOUT CONTRAST", 12.5, "Normal non-contrast CT head."),
           ("MRI BRAIN", 8000, "Normal MRI brain (outpatient)."),
           ("ELECTROENCEPHALOGRAM (EEG)", 8100, "Generalized 4-6 Hz polyspike-and-wave discharges with photoparoxysmal response, consistent with juvenile myoclonic epilepsy (outpatient study).")]),
 dict(file="03_status_Gordon", label="Status epilepticus (post-stroke epilepsy, Na 114, cefepime, phenytoin + apixaban)", name="DEMO, GORDON", dob="1955-10-30", sex="M", mrn="TESTSZ03", age=71, arrive=60, weight=78,
  notes=[("HOSPITALIST ADMISSION NOTE", 58, "Admitted with right lower lobe pneumonia. Background post-stroke epilepsy after left MCA infarct in 2023, on phenytoin 300 mg daily, atrial fibrillation on apixaban, hypertension. Started cefepime. Acute kidney injury on admission."),
         ("RAPID RESPONSE NOTE", 6, "Called for generalized tonic-clonic seizure. Three seizures over 25 minutes without return to baseline between them. Given lorazepam 4 mg IV twice, then levetiracetam 4500 mg IV load. Convulsions stopped but remains GCS 9 and not following commands 40 minutes later. Sodium 114. Concern for non-convulsive status epilepticus and cefepime neurotoxicity with eGFR 24. ICU consulted, continuous EEG requested, 3% saline 150 mL given."),
         ("ICU CONSULT NOTE", 4, "Status epilepticus, now non-convulsive on initial EEG review. Provoking factors: severe hyponatremia, cefepime with acute kidney injury, subtherapeutic phenytoin (albumin 24). Change cefepime to ceftriaxone. Continue levetiracetam 1000 mg IV q12h. Transfer to ICU for continuous EEG and airway monitoring.")],
  vitals=[(58, 138, 76, 98, 38.4, 92), (6, 182, 96, 124, 38.0, 88), (4, 150, 84, 104, 37.8, 95), (1, 142, 80, 96, 37.6, 96)],
  labs=[(58, [("Creatinine", "168", "umol/L", "60 - 110", "H"), ("eGFR", "34", "mL/min/1.73m2", "> 60", "L"), ("Sodium", "126", "mmol/L", "135 - 145", "L")]),
        (6, [("Sodium", "114", "mmol/L", "135 - 145", "LL"), ("Potassium", "4.1", "mmol/L", "3.5 - 5.0", ""), ("Glucose", "8.9", "mmol/L", "3.6 - 7.8", "H"),
             ("Calcium", "2.02", "mmol/L", "2.10 - 2.60", "L"), ("Magnesium", "0.58", "mmol/L", "0.70 - 1.00", "L"), ("Phosphate", "0.9", "mmol/L", "0.8 - 1.5", ""),
             ("Creatinine", "212", "umol/L", "60 - 110", "H"), ("eGFR", "24", "mL/min/1.73m2", "> 60", "L"), ("Urea", "18.4", "mmol/L", "2.5 - 8.0", "H"),
             ("Albumin", "24", "g/L", "35 - 50", "L"), ("ALT", "28", "U/L", "< 50", ""), ("WBC", "16.8", "x10^9/L", "4.0 - 11.0", "H"), ("Platelets", "212", "x10^9/L", "150 - 400", ""),
             ("Lactate", "4.6", "mmol/L", "0.5 - 2.2", "H"), ("Phenytoin level", "22", "umol/L", "40 - 80", "L"), ("Ammonia", "28", "umol/L", "< 35", "")]),
        (2, [("Sodium", "119", "mmol/L", "135 - 145", "L"), ("CK", "880", "U/L", "40 - 300", "H")])],
  given=[("Lorazepam 4 mg IV once", 5.9), ("Lorazepam 4 mg IV once", 5.8), ("Levetiracetam 4500 mg IV once", 5.6), ("Hypertonic saline 3% 150 mL IV once", 5.5)],
  meds=["Phenytoin 300 mg PO daily", "Levetiracetam 1000 mg IV q12h", "Cefepime 2 g IV q8h", "Apixaban 5 mg PO BID", "Metoprolol 25 mg PO BID", "Pantoprazole 40 mg PO daily"],
  orders=["Continuous EEG", "Transfer to ICU", "Sodium q4h", "Seizure precautions"],
  problems=["Status epilepticus", "Epilepsy, post-stroke", "Stroke, left MCA (2023)", "Atrial fibrillation", "Hypertension", "Pneumonia", "Acute kidney injury", "Hyponatremia"],
  reports=[("CT HEAD WITHOUT CONTRAST", 5, "No acute hemorrhage or new infarct. Old left MCA territory infarct with encephalomalacia. No mass effect."),
           ("CONTINUOUS EEG PRELIMINARY", 1.5, "Continuous lateralized periodic discharges over the left hemisphere at 1.5-2 Hz with evolution, consistent with ongoing non-convulsive seizures. Recommend escalation of antiseizure therapy."),
           ("ECG 12 LEAD", 5.7, "Atrial fibrillation 118. QTc 456 ms. PR not measurable.")]),
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
        c.save(); print("pdf", p["file"] + ".pdf")
    with open(os.path.join(DIR, "demo-patients.js"), "w") as fh:
        fh.write("// Generated by make-test-pdfs.py - made-up patients for index.html?demo=1..3 (match test-pdfs/). Not real people.\n")
        fh.write("window.SEIZURE_DEMOS = " + json.dumps([demo(p) for p in P], indent=1) + ";\n")
    print("wrote demo-patients.js")
