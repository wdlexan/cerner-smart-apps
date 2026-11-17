"""python3 make-test-pdfs.py : writes test-pdfs/*.txt and *.pdf, made-up chart extracts matching demo patients 1-3.
For the toolkit's Import PDF button. No real patient data. Dates are fixed (chart "now" = 2026-11-17 09:30),
so time-based checks (24 h CT, BP window) depend on the day you import them."""
import os
from datetime import datetime, timedelta
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas

HERE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "test-pdfs")
NOW = datetime(2026, 11, 17, 9, 30)
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
    for r in rows: out += [f"{r[0]:<26}{r[1]:<17}{r[2]:<16}{r[3]:<16}{r[4]:<4}", ""]  # blank line between rows (importer)
    return out

def build(p):
    L = ["PATIENT CHART EXTRACT - VICTORIA GENERAL HOSPITAL (TEST)", "MADE-UP TEST PATIENT - NOT A REAL PERSON - FOR SANDBOX TESTING ONLY",
         f"Patient: {p['name']:<32}DOB: {p['dob']}     Sex: {p['sex']}", f"MRN: {p['mrn']:<36}Age: {p['age']}",
         f"ED arrival: {p['arrive']}    Admitted: {p['admit']} (Hospitalist)", ""]
    for title, when, text in p["notes"]:
        L += [title, f"Date of service: {when}"] + wrap(text) + [""]
    L += ["VITAL SIGNS"] + [f"{t} BP: {s}/{d} HR: {hr} Temp: {tp} C SpO2: {o2}%" for t, s, d, hr, tp, o2 in p["vitals"]] + [""]
    for coll, rows in p["labs"]: L += labs(coll, rows)
    L += ["", "MEDICATIONS GIVEN"] + p["given"] + ["", f"ACTIVE MEDICATION ORDERS ({NOW:%Y-%m-%d})"] + p["meds"]
    L += ["", "ACTIVE ORDERS"] + p["orders"] + ["", "PROCEDURES"] + ([w for x in p["procs"] for w in wrap(x)] or ["None"]) + ["", "ACTIVE PROBLEM LIST"] + p["problems"]
    L += ["", "", f"MADE-UP TEST PATIENT - NOT A REAL PERSON | {p['name']} MRN {p['mrn']}         Page 1", "", "RADIOLOGY AND CARDIAC REPORTS", ""]
    for title, when, imp in p["reports"]:
        L += [title, f"Date of exam: {when}", "IMPRESSION:"] + wrap(imp) + [""]
    L += ["", "", f"MADE-UP TEST PATIENT - NOT A REAL PERSON | {p['name']} MRN {p['mrn']}         Page 2"]
    return L

a1 = H(22); tnk = H(20.5); evt0, evt1 = H(20), H(19.2)
A2 = H(10); A3 = NOW - timedelta(days=3)
P = [
 dict(file="01_tnk_evt_Walter", name="DEMO, Walter", dob="1958-04-11", sex="M", mrn="TESTSTK01", age=68, arrive=f(a1), admit=f(H(18)),
  notes=[("ED PHYSICIAN NOTE", f(a1 + timedelta(hours=0.5)), "Code stroke. Last known well 07:40. Right hemiparesis and aphasia, NIHSS 14. Right homonymous hemianopia. Discussed with neurology: tenecteplase given, transferred for EVT."),
         ("NEUROLOGY NOTE", f(evt1 + timedelta(hours=0.5)), "Post thrombectomy left M1, eTICI 2b. NIHSS improving, now 8. BP target less than 180/105 for 24 h. Repeat CT at 24 h before antithrombotics. NPO until swallow screen."),
         ("NURSING NOTE", f(H(8)), "Telemetry showing atrial fibrillation, rate 90s, intermittent. Right groin site soft, no hematoma. Swallow screen failed, remains NPO."),
         ("PHYSIOTHERAPY INITIAL ASSESSMENT", f(H(5)), "Bed mobility moderate assist x1. Sit to stand with 2 person assist. Unable to ambulate today; dense right leg weakness. High falls risk. Plan: daily PT, tilt table, recommend inpatient rehabilitation (GRU) referral."),
         ("SPEECH-LANGUAGE PATHOLOGY SWALLOWING ASSESSMENT", f(H(4)), "Clinical swallow assessment. Wet voice and coughing with thin fluids on oral trials. Recommend NPO except meds crushed in puree; consider NG tube for nutrition. Expressive aphasia with word-finding difficulty; follows 1-step commands. VFSS if not improving in 48 h.")],
  vitals=[(f(tnk + timedelta(hours=h)), s, d, hr, 37.0, 97) for h, s, d, hr in [(0.2,172,92,88),(1,168,90,86),(3,176,94,92),(6.5,186,101,96),(7,171,95,90),(10,162,88,84),(14,158,84,82),(18,150,82,80),(20,154,80,78)]],
  labs=[(f(a1 + timedelta(hours=0.2)), [("Glucose","11.2","mmol/L","3.6 - 7.8","H"),("Creatinine","96","umol/L","60 - 110",""),("Platelets","232","x10^9/L","150 - 400",""),("INR","1.0","","0.9 - 1.1","")]),
        (f(H(3)), [("Glucose","9.1","mmol/L","3.6 - 7.8","H"),("Hemoglobin","141","g/L","135 - 175","")])],
  given=[f"Tenecteplase 25 mg IV once {f(tnk)}", f"Labetalol 10 mg IV once {f(H(14))}"],
  meds=["Metformin 500 mg PO BID (held, NPO)","Atorvastatin 80 mg PO daily"],
  orders=["CT head without contrast - 24 h post thrombolysis","Echocardiogram transthoracic","Telemetry","Swallow screen"],
  procs=[f"Endovascular thrombectomy, left M1, {f(evt0)} to {f(evt1)}. eTICI 2b reperfusion. Right femoral access, closure device."],
  problems=["Hypertension","Type 2 diabetes mellitus","Acute ischemic stroke, left MCA"],
  reports=[("CT HEAD WITHOUT CONTRAST", f(a1 + timedelta(hours=0.3)), "No acute intracranial hemorrhage. Early loss of grey-white differentiation left insula. ASPECTS 8."),
           ("CTA HEAD AND NECK", f(a1 + timedelta(hours=0.4)), "Occlusion of the left M1 segment of the middle cerebral artery. Carotid bifurcations without significant stenosis.")]),
 dict(file="02_posterior_noMRI_Linda", name="DEMO, Linda", dob="1968-09-02", sex="F", mrn="TESTSTK02", age=58, arrive=f(A2), admit=f(H(6)),
  notes=[("ED PHYSICIAN NOTE", f(A2 + timedelta(hours=1)), "Sudden onset vertigo at 06:30 this morning with vomiting. Unable to walk without assistance, falls to the left. Nystagmus on left gaze. NIHSS 2 (ataxia). CT and CTA negative. Discussed with neurology: not a lytic candidate given mild deficits outside window. Admit to hospitalist, MRI."),
         ("NURSING NOTE", f(H(2)), "Still dizzy, vomiting x2. Gait unsteady, needs assist of 2. Passed bedside swallow screen."),
         ("PHYSIOTHERAPY NOTE", f(H(1)), "Truncal ataxia, falls to the left in sitting. Transfers with 1 person assist. Ambulated 5 m with 2 person assist and walker. High falls risk; bed alarm. Will reassess tomorrow.")],
  vitals=[(f(A2 + timedelta(hours=h)), s, d, 84, 36.8, 98) for h, s, d in [(0.2,168,88),(2,174,90),(5,162,84),(8,158,82),(9.5,160,80)]],
  labs=[(f(A2 + timedelta(hours=0.3)), [("Glucose","6.4","mmol/L","3.6 - 7.8",""),("Creatinine","71","umol/L","45 - 90",""),("Hemoglobin","132","g/L","120 - 160","")])],
  given=[f"Acetylsalicylic acid 160 mg PO once {f(H(7))}"],
  meds=["Acetylsalicylic acid 81 mg PO daily","Dimenhydrinate 25 mg IV q6h PRN"],
  orders=["MRI brain without contrast"], procs=[],
  problems=["Hypertension","Dyslipidemia","Vertigo, acute"],
  reports=[("CT HEAD WITHOUT CONTRAST", f(A2 + timedelta(hours=0.5)), "No acute intracranial abnormality. No hemorrhage."),
           ("CTA HEAD AND NECK", f(A2 + timedelta(hours=0.6)), "No large vessel occlusion. Vertebral and basilar arteries patent. No significant stenosis.")]),
 dict(file="03_esus_pfo_Nora", name="DEMO, Nora", dob="1984-02-17", sex="F", mrn="TESTSTK03", age=42, arrive=f(A3), admit=f(A3 + timedelta(hours=5)),
  notes=[("ED PHYSICIAN NOTE", f(A3 + timedelta(hours=1)), "Sudden left hand weakness and clumsiness on waking. NIHSS 3. Non-smoker. No hypertension or diabetes. CT/CTA negative. Neurology: not a lytic candidate (wake-up, mild). Aspirin, admit, MRI."),
         ("HOSPITALIST PROGRESS NOTE", f(A3 + timedelta(hours=30)), "MRI shows small right frontal cortical infarct. Passed swallow screen. Plan: echo with bubble, telemetry, lipids, A1c."),
         ("HOSPITALIST PROGRESS NOTE", f(H(5)), "Echo: PFO with atrial septal aneurysm and large shunt. Telemetry sinus rhythm throughout. Considering embolic stroke of undetermined source with PFO."),
         ("PHYSIOTHERAPY ASSESSMENT", f(A3 + timedelta(hours=26)), "Independent with transfers and bed mobility. Ambulating 100 m independently without gait aid; managed stairs with rail. Low falls risk. No further PT needs; safe for discharge home from a mobility point of view."),
         ("OCCUPATIONAL THERAPY ASSESSMENT", f(A3 + timedelta(hours=28)), "Independent with dressing and grooming. Mild left hand clumsiness affecting fine motor tasks (buttons, typing). MoCA 27/30. No neglect. Recommend outpatient OT for hand function; return to work and driving to be discussed at stroke prevention clinic."),
         ("SLP NOTE", f(A3 + timedelta(hours=24)), "Bedside swallow assessment passed. Regular diet and thin fluids. Speech and language within normal limits. No SLP follow-up needed.")],
  vitals=[(f(A3 + timedelta(hours=h)), s, d, 72, 36.7, 99) for h, s, d in [(1,138,84),(12,132,80),(36,128,78),(60,126,76),(70,130,78)]],
  labs=[(f(A3 + timedelta(hours=0.3)), [("Glucose","5.6","mmol/L","3.6 - 7.8",""),("Creatinine","64","umol/L","45 - 90","")]),
        (f(A3 + timedelta(hours=24)), [("LDL cholesterol","2.9","mmol/L","< 2.0","H"),("Hemoglobin A1c","5.4","%","< 6.0","")])],
  given=[], meds=["Acetylsalicylic acid 81 mg PO daily","Atorvastatin 40 mg PO daily","Enoxaparin 40 mg SC daily"],
  orders=["Telemetry","Physical therapy consult","Occupational therapy consult"], procs=[],
  problems=["Migraine","Acute ischemic stroke, right frontal"],
  reports=[("CT HEAD WITHOUT CONTRAST", f(A3 + timedelta(hours=0.5)), "No acute hemorrhage."),
           ("CTA HEAD AND NECK", f(A3 + timedelta(hours=0.6)), "No large vessel occlusion. No dissection. No significant stenosis."),
           ("MRI BRAIN", f(A3 + timedelta(hours=20)), "Small acute infarct with restricted diffusion in the right frontal cortex (precentral gyrus), 1.2 cm. No hemorrhage."),
           ("ECHOCARDIOGRAM WITH BUBBLE STUDY", f(A3 + timedelta(days=2)), "Normal LV size and function. Atrial septal aneurysm with patent foramen ovale; large right-to-left shunt with more than 20 microbubbles at rest and with Valsalva. No LV thrombus."),
           ("TELEMETRY SUMMARY", f(H(4)), "72 h telemetry: sinus rhythm throughout, no arrhythmia detected.")]),
]

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
