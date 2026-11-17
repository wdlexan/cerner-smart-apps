"""python3 make-test-pdfs.py : writes test-pdfs/*.txt and *.pdf, made-up chart extracts matching demo patients 1-6.
For the toolkit's Import PDF button (or any PDF reader). No real patient data.
CSF results are written as prose ("CSF cell count 38 /uL") so the PDF importer does not read them as blood labs."""
import os
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas

HERE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "test-pdfs")
os.makedirs(HERE, exist_ok=True)

def lab_table(collected, rows):
    out = ["LABORATORY RESULTS", f"Collected: {collected}",
           f"{'Test':<26}{'Result':<17}{'Units':<16}{'Reference':<16}Flag", ""]
    for name, val, unit, ref, flag in rows:
        out += [f"{name:<26}{val:<17}{unit:<16}{ref:<16}{flag:<4}", ""]  # blank line between rows: keeps the importer from merging short tables
    return out

P = [
  dict(file="01_nmdar_Amelia", name="DEMO, Amelia", dob="2003-10-08", sex="F", mrn="TESTAE01", age=23, adm="2026-11-10",
   notes=[("HOSPITALIST ADMISSION NOTE", "2026-11-10 15:20", """23 F, no psychiatric history. Flu-like illness with headache 3 weeks ago, then insomnia,
paranoia and auditory hallucinations over 10 days. Seen by psychiatry with first-episode
psychosis and started on haloperidol. Over 48 h developed rigidity and CK rose; query
neuroleptic malignant syndrome. Speech markedly reduced with periods of mutism.""",
           "2026-11-10 14:00 BP: 168/96 HR: 148 RR: 22 Temp: 38.6 C SpO2: 97%"),
          ("HOSPITALIST PROGRESS NOTE", "2026-11-15 08:40", """Catatonic posturing, orofacial dyskinesias with lip-smacking and grimacing. Generalized
tonic-clonic seizure overnight. Labile blood pressure and heart rate on telemetry
(HR 52 to 148). Lumbar puncture 2026-11-12: CSF cell count 38 /uL, lymphocytic. CSF
oligoclonal bands positive. HSV-1/2 PCR on CSF not detected. Paired serum and CSF sent to
MitogenDx. Methylprednisolone started 2026-11-13, IVIG started 2026-11-15.""",
           "2026-11-15 08:00 BP: 88/50 HR: 52 RR: 18 Temp: 37.9 C SpO2: 96%")],
   labs=("2026-11-14 05:30", [("Sodium","139","mmol/L","135 - 145",""),("Creatine kinase","3100","U/L","30 - 200","H"),
        ("TSH","1.8","mIU/L","0.35 - 5",""),("Hemoglobin","124","g/L","120 - 160",""),("Creatinine","68","umol/L","45 - 90","")]),
   meds=["Haloperidol 5 mg IM q6h PRN agitation","Acyclovir 10 mg/kg IV q8h","Methylprednisolone 1 g IV daily x 5 days (completed)",
         "Immune globulin (IVIG) 0.4 g/kg IV daily x 5 days","Lorazepam 1 mg IV q4h PRN"],
   problems=["Psychosis, unspecified","Encephalitis, query autoimmune","Ovarian mass, right"],
   reports=[("MRI BRAIN WITH AND WITHOUT CONTRAST","2026-11-12 10:00","No abnormal signal. No abnormal enhancement. No diffusion restriction.","No acute intracranial abnormality."),
            ("EEG REPORT","2026-11-14 09:00","Diffuse slowing with extreme delta brush pattern. No electrographic seizures captured.","Extreme delta brush; diffuse encephalopathy."),
            ("ULTRASOUND PELVIS TRANSVAGINAL","2026-11-15 13:00","4.2 cm right ovarian lesion with echogenic fat and calcification.","Consistent with mature cystic teratoma (dermoid) of the right ovary.")]),
  dict(file="02_lgi1_Bernard", name="DEMO, Bernard", dob="1959-10-08", sex="M", mrn="TESTAE02", age=67, adm="2026-11-13",
   notes=[("NEUROLOGY CONSULT NOTE", "2026-11-15 11:00", """67 M with 6 weeks of progressive short-term memory loss and disorientation. Wife
describes many brief episodes a day where the left arm stiffens and the left side of the
face pulls up for 2 to 3 seconds, consistent with faciobrachial dystonic seizures (FBDS).
Not improved on levetiracetam. Hyponatremia felt to be SIADH. Lumbar puncture: CSF cell
count 3 /uL, CSF protein mildly raised. HSV-1/2 PCR on CSF not detected.""",
           "2026-11-15 08:00 BP: 134/80 HR: 74 RR: 16 Temp: 36.9 C SpO2: 97%")],
   labs=("2026-11-16 05:30", [("Sodium","126","mmol/L","135 - 145","L"),("Potassium","4.1","mmol/L","3.5 - 5.1",""),("TSH","2.1","mIU/L","0.35 - 5",""),
        ("Creatinine","92","umol/L","60 - 110",""),("Hemoglobin","138","g/L","135 - 175","")]),
   meds=["Levetiracetam 750 mg PO BID","Amlodipine 5 mg PO daily","Fluid restriction 1.2 L/day"],
   problems=["Essential hypertension","Hyponatremia","Memory loss, subacute"],
   reports=[("MRI BRAIN WITH AND WITHOUT CONTRAST","2026-11-14 10:00","Bilateral mesial temporal FLAIR hyperintensity with mild hippocampal swelling, right greater than left. No enhancement or diffusion restriction.","Bilateral mesial temporal FLAIR hyperintensity, in keeping with limbic encephalitis."),
            ("EEG REPORT","2026-11-15 09:00","Intermittent right temporal sharp waves and right temporal slowing.","Right temporal epileptiform activity.")]),
  dict(file="03_gabab_sclc_Carol", name="DEMO, Carol", dob="1962-10-08", sex="F", mrn="TESTAE03", age=64, adm="2026-11-01",
   notes=[("HOSPITALIST PROGRESS NOTE", "2026-11-16 09:00", """64 F, current smoker 45 pack-years. Presented with new seizures progressing to status
epilepticus, now confusion and short-term memory loss. Seizures still breaking through on
two antiseizure medications. Minimal improvement since steroids started 2026-11-02.
CT chest shows a right hilar mass, bronchoscopy pending; small cell lung cancer
suspected. Lumbar puncture 2026-11-01: CSF cell count 12 /uL. HSV-1/2 PCR not detected.""",
           "2026-11-16 08:00 BP: 126/74 HR: 92 RR: 18 Temp: 37.1 C SpO2: 94%")],
   labs=("2026-11-16 05:30", [("Sodium","136","mmol/L","135 - 145",""),("Glucose","9.8","mmol/L","3.6 - 7.8","H"),("Creatinine","71","umol/L","45 - 90",""),
        ("Hemoglobin","121","g/L","120 - 160","")]),
   meds=["Methylprednisolone 1 g IV daily x 5 days (completed 2026-11-06)","Prednisone 60 mg PO daily","Levetiracetam 1500 mg PO BID",
         "Lacosamide 200 mg PO BID","Pantoprazole 40 mg PO daily"],
   problems=["COPD","Lung mass, right hilar","Status epilepticus, resolved"],
   reports=[("MRI BRAIN WITH AND WITHOUT CONTRAST","2026-11-02 10:00","Left mesial temporal T2/FLAIR hyperintensity involving the hippocampus and amygdala. No enhancement.","Left mesial temporal FLAIR hyperintensity, query limbic encephalitis."),
            ("CT CHEST WITH CONTRAST","2026-11-04 14:00","3.4 cm right hilar mass with bulky mediastinal adenopathy.","Suspicious for small cell carcinoma."),
            ("EEG REPORT","2026-11-03 09:00","Frequent left temporal epileptiform discharges; electrographic seizures arising from the left temporal region.","Left temporal seizures.")]),
  dict(file="04_ma2_Daniel", name="DEMO, Daniel", dob="1992-10-08", sex="M", mrn="TESTAE04", age=34, adm="2026-11-15",
   notes=[("HOSPITALIST ADMISSION NOTE", "2026-11-15 16:00", """34 M with 2 months of excessive daytime sleepiness (hypersomnia), sleeping 16 h a day,
and short-term memory loss. Vertical gaze limitation on exam. No fever. Testicular exam
not documented. Lumbar puncture: CSF cell count 9 /uL. HSV-1/2 PCR not detected.
Acyclovir started pending results.""",
           "2026-11-15 15:00 BP: 118/72 HR: 66 RR: 14 Temp: 36.7 C SpO2: 99%")],
   labs=("2026-11-16 05:30", [("Sodium","141","mmol/L","135 - 145",""),("Creatinine","84","umol/L","60 - 110",""),("Hemoglobin","152","g/L","135 - 175","")]),
   meds=["Acyclovir 10 mg/kg IV q8h"],
   problems=["Hypersomnia","Memory loss, subacute"],
   reports=[("MRI BRAIN WITH AND WITHOUT CONTRAST","2026-11-15 12:00","Bilateral hippocampal FLAIR hyperintensity with additional hypothalamic and upper brainstem T2 signal change. Faint enhancement.","Bilateral mesial temporal and diencephalic signal change, query paraneoplastic encephalitis.")]),
  dict(file="05_post_hsv_Elena", name="DEMO, Elena", dob="1997-10-08", sex="F", mrn="TESTAE05", age=29, adm="2026-11-14",
   notes=[("HOSPITALIST PROGRESS NOTE", "2026-11-16 10:00", """Treated for HSV encephalitis 5 weeks ago, was improving at discharge. Re-presents with
new agitation, insomnia and abnormal involuntary movements: choreoathetosis of the arms
and orofacial dyskinesias. Lumbar puncture: CSF cell count 22 /uL. Repeat HSV-1/2 PCR
not detected. Concern for post-HSV autoimmune encephalitis (anti-NMDAR).""",
           "2026-11-16 08:00 BP: 130/78 HR: 108 RR: 18 Temp: 37.4 C SpO2: 98%")],
   labs=("2026-11-15 05:30", [("Sodium","137","mmol/L","135 - 145",""),("Creatinine","62","umol/L","45 - 90",""),("Hemoglobin","128","g/L","120 - 160","")]),
   meds=["Quetiapine 25 mg PO BID","Acyclovir 10 mg/kg IV q8h (completed 2026-10-24)"],
   problems=["Herpes simplex encephalitis, recent","Movement disorder, new"],
   reports=[("MRI BRAIN WITH AND WITHOUT CONTRAST","2026-11-14 11:00","Expected evolution of left temporal and insular encephalomalacia from prior HSV encephalitis. No new diffusion restriction.","No new lesion."),
            ("EEG REPORT","2026-11-15 09:00","Diffuse slowing, no epileptiform discharges.","Diffuse encephalopathy.")]),
  dict(file="06_mimic_psychosis_Felix", name="DEMO, Felix", dob="2000-10-08", sex="M", mrn="TESTAE06", age=26, adm="2026-11-14",
   notes=[("PSYCHIATRY CONSULT NOTE", "2026-11-15 13:00", """26 M with 8 months of gradual social withdrawal, then paranoid delusions and auditory
hallucinations. Daily cannabis. No seizures. No abnormal movements, no dyskinesias.
No catatonia. Neurological exam normal. Tolerating risperidone without extrapyramidal
side effects. Medicine asked to rule out an organic cause. Lumbar puncture: CSF cell
count 1 /uL. HSV-1/2 PCR not detected.""",
           "2026-11-15 08:00 BP: 124/76 HR: 78 RR: 14 Temp: 36.7 C SpO2: 99%")],
   labs=("2026-11-14 05:30", [("Sodium","140","mmol/L","135 - 145",""),("TSH","1.4","mIU/L","0.35 - 5",""),("Creatinine","88","umol/L","60 - 110","")]),
   meds=["Risperidone 2 mg PO daily"],
   problems=["First episode psychosis","Cannabis use disorder"],
   reports=[("MRI BRAIN WITH AND WITHOUT CONTRAST","2026-11-14 10:00","Normal appearance of the brain.","Normal MRI of the brain."),
            ("EEG REPORT","2026-11-15 09:00","Normal awake and drowsy recording.","Normal EEG.")]),
]

def chart(p):
    foot = lambda n: ["", "", f"MADE-UP TEST PATIENT - NOT A REAL PERSON | {p['name']} MRN {p['mrn']}         Page {n}"]
    L = ["PATIENT CHART EXTRACT - VICTORIA GENERAL HOSPITAL (TEST)",
         "MADE-UP TEST PATIENT - NOT A REAL PERSON - FOR SANDBOX TESTING ONLY",
         f"Patient: {p['name']:<32}DOB: {p['dob']}     Sex: {p['sex']}",
         f"MRN: {p['mrn']:<36}Age: {p['age']}",
         f"Admitted: {p['adm']} (Hospitalist)", ""]
    for title, when, body, vit in p["notes"]:
        L += [title, f"Date of service: {when}"] + body.splitlines() + [vit, ""]
    L += lab_table(*p["labs"]) + ["", f"ACTIVE MEDICATION ORDERS ({p['labs'][0][:10]})"] + p["meds"] + ["", "ACTIVE PROBLEM LIST"] + p["problems"]
    L += foot(1) + ["", "RADIOLOGY AND NEURODIAGNOSTIC REPORTS", ""]
    for title, when, findings, imp in p["reports"]:
        L += [title, f"Date of exam: {when}", "FINDINGS:"] + wrap(findings) + ["IMPRESSION:"] + wrap(imp) + [""]
    L += foot(2)
    return L

def wrap(s, w=92):
    out, line = [], ""
    for word in s.split():
        if len(line) + len(word) + 1 > w: out.append(line); line = word
        else: line = (line + " " + word).strip()
    return out + [line] if line else out

for p in P:
    lines = chart(p)
    base = os.path.join(HERE, p["file"])
    open(base + ".txt", "w").write("\n".join(lines) + "\n")
    c = canvas.Canvas(base + ".pdf", pagesize=letter); c.setTitle("MADE-UP TEST PATIENT"); y = 750
    for line in lines:
        if y < 50: c.showPage(); y = 750
        c.setFont("Courier", 8.6); c.drawString(36, y, line); y -= 11
        if "MADE-UP TEST PATIENT - NOT A REAL PERSON |" in line: c.showPage(); y = 750
    c.save(); print("pdf", p["file"] + ".pdf")
