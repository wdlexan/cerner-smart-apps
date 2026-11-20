"""python3 make-test-pdfs.py : writes test-pdfs/*.txt and *.pdf, made-up chart extracts for the Autoimmune serology app/tab.
For the toolkit's Import PDF button (Load a made-up test patient > Autoimmune serology). No real patient data.
Antibody names are kept out of the note prose so the PDF importer only reads them from the lab table.
Urinalysis is written as prose ("Urinalysis: ...") because the importer never reads urine lines as blood labs;
active urine sediment reaches the app through the problem list (Glomerulonephritis)."""
import os
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas

HERE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "test-pdfs")
os.makedirs(HERE, exist_ok=True)

def lab_table(collected, rows):
    out = ["LABORATORY RESULTS", f"Collected: {collected}",
           f"{'Test':<34}{'Result':<16}{'Units':<12}{'Reference':<14}Flag", ""]
    for name, val, unit, ref, flag in rows:
        out += [f"{name:<34}{val:<16}{unit:<12}{ref:<14}{flag:<4}", ""]
    return out

P = [
  dict(file="01_sle_nephritis_Grace", label="01 Grace - SLE with nephritis", name="DEMO, Grace", dob="1999-03-14", sex="F", mrn="TESTSE01", age=27, adm="2026-11-15",
   note=("HOSPITALIST ADMISSION NOTE", "2026-11-15 14:10", """27 F, previously well. Six weeks of fatigue, photosensitive rash over the cheeks sparing the
nasolabial folds, painless mouth ulcers, and painful swollen wrists and MCPs with morning
stiffness over an hour. Two weeks of pleuritic left chest pain. New leg swelling.
Urinalysis: 3+ blood, 3+ protein, RBC casts on microscopy. Spot urine protein/creatinine
ratio 1.3 g/g. No new drugs. No fever."""),
   vit="2026-11-15 13:30 BP: 152/94 HR: 98 RR: 18 Temp: 37.4 C SpO2: 97%",
   labs=("2026-11-15 06:00", [("ANA titre","1:640","","",""),("ANA pattern","Homogeneous","","",""),
        ("Anti-dsDNA","210","IU/mL","0 - 30","H"),("Anti-Sm","Positive","","",""),("Anti-U1 RNP","Positive","","",""),
        ("Anti-Ro/SSA","Negative","","",""),("C3 complement","0.48","g/L","0.90 - 1.80","L"),("C4 complement","0.04","g/L","0.10 - 0.40","L"),
        ("White blood cell count","3.1","x10^9/L","4.0 - 11.0","L"),("Platelet count","82","x10^9/L","150 - 400","L"),
        ("Hemoglobin","108","g/L","120 - 160","L"),("Creatinine","96","umol/L","45 - 90","H"),("Lupus anticoagulant","Not detected","","","")]),
   meds=["Hydroxychloroquine 400 mg PO daily","Prednisone 40 mg PO daily","Pantoprazole 40 mg PO daily","Calcium carbonate 500 mg PO BID"],
   problems=["Malar rash","Polyarthritis","Pleural effusion, left","Oral ulcers","Glomerulonephritis"],
   reports=[("CT CHEST WITH CONTRAST","2026-11-15 11:00","Small left pleural effusion. Trace pericardial fluid. Lungs clear.","Small left pleural effusion.")],
   expect="sle"),
  dict(file="02_mpa_rpgn_Harold", label="02 Harold - MPA with rapidly rising creatinine", name="DEMO, Harold", dob="1954-07-02", sex="M", mrn="TESTSE02", age=72, adm="2026-11-14",
   note=("HOSPITALIST ADMISSION NOTE", "2026-11-14 16:00", """72 M, two months of malaise, weight loss 6 kg and dry cough. Creatinine 140 four weeks ago
at his GP, now much higher. Urinalysis: 3+ blood, 2+ protein, dysmorphic red cells.
No hemoptysis. No sinus symptoms, no asthma. No new drugs."""),
   vit="2026-11-14 15:00 BP: 148/86 HR: 88 RR: 20 Temp: 37.6 C SpO2: 94%",
   labs=("2026-11-14 06:00", [("ANCA (IIF)","Perinuclear pattern","","",""),("Anti-MPO","118","U/mL","< 20","H"),("Anti-PR3","<2","U/mL","< 20",""),
        ("Anti-GBM","1","U/mL","< 20",""),("ANA titre","Negative","","",""),("C3 complement","1.20","g/L","0.90 - 1.80",""),("C4 complement","0.25","g/L","0.10 - 0.40",""),
        ("Creatinine","412","umol/L","60 - 110","H"),("Eosinophils","0.2","x10^9/L","0.0 - 0.5",""),("Hemoglobin","98","g/L","135 - 175","L"),("C reactive protein","64","mg/L","0 - 8","H")]),
   meds=["Amlodipine 5 mg PO daily","Atorvastatin 20 mg PO daily"],
   problems=["Glomerulonephritis","Interstitial lung disease","Hypertension"],
   reports=[("CT CHEST WITHOUT CONTRAST","2026-11-14 12:00","Basal subpleural reticulation with traction bronchiectasis. No nodules. No alveolar hemorrhage.","Fibrotic interstitial lung disease, UIP pattern.")],
   expect="mpa"),
  dict(file="03_gpa_Ian", label="03 Ian - GPA (sinus, cavitating nodules)", name="DEMO, Ian", dob="1981-01-22", sex="M", mrn="TESTSE03", age=45, adm="2026-11-16",
   note=("HOSPITALIST ADMISSION NOTE", "2026-11-16 10:30", """45 M, three months of nasal crusting, bloody nasal discharge and recurrent sinus infections
not settling with antibiotics. New cough with streaks of hemoptysis. Right ear fullness with
reduced hearing. Urinalysis: 2+ blood, 1+ protein. No asthma."""),
   vit="2026-11-16 09:00 BP: 138/84 HR: 96 RR: 20 Temp: 37.9 C SpO2: 95%",
   labs=("2026-11-16 06:00", [("ANCA (IIF)","Cytoplasmic pattern","","",""),("Anti-PR3","186","U/mL","< 20","H"),("Anti-MPO","<2","U/mL","< 20",""),
        ("Creatinine","165","umol/L","60 - 110","H"),("C reactive protein","88","mg/L","0 - 8","H"),("Eosinophils","0.1","x10^9/L","0.0 - 0.5",""),("Hemoglobin","121","g/L","135 - 175","L")]),
   meds=["Amoxicillin-clavulanate 875 mg PO BID","Saline nasal rinse BID"],
   problems=["Sinusitis, chronic","Lung nodules, cavitating","Glomerulonephritis"],
   reports=[("CT CHEST WITH CONTRAST","2026-11-16 08:00","Multiple bilateral nodules up to 2.8 cm, two with central cavitation. No effusion.","Multiple cavitating nodules."),
            ("CT SINUSES","2026-11-16 08:30","Mucosal thickening of the maxillary sinuses with nasal septal erosion.","Sinonasal inflammation with septal erosion.")],
   expect="gpa"),
  dict(file="04_ra_Joan", label="04 Joan - seropositive rheumatoid arthritis", name="DEMO, Joan", dob="1968-05-30", sex="F", mrn="TESTSE04", age=58, adm="2026-11-13",
   note=("HOSPITALIST CONSULT NOTE", "2026-11-17 11:00", """Admitted with a fall. Four months of symmetric pain and swelling of both wrists, MCPs, PIPs and
MTPs, more than 10 joints in total, with two hours of morning stiffness. No rash, no mouth
ulcers, no Raynaud. Synovitis on exam of wrists, MCPs 2-4 bilaterally and knees."""),
   vit="2026-11-17 08:00 BP: 128/76 HR: 82 RR: 16 Temp: 36.8 C SpO2: 98%",
   labs=("2026-11-17 06:00", [("Rheumatoid factor","180","IU/mL","0 - 15","H"),("Anti-CCP",">250","U/mL","< 20","H"),("ANA titre","1:80","","",""),
        ("ANA pattern","Speckled","","",""),("Erythrocyte sedimentation rate","48","mm/h","0 - 30","H"),("C reactive protein","32","mg/L","0 - 8","H"),("Hemoglobin","112","g/L","120 - 160","L")]),
   meds=["Naproxen 500 mg PO BID","Acetaminophen 1 g PO QID"],
   problems=["Polyarthritis","Fall"],
   reports=[("X-RAY BOTH HANDS","2026-11-16 10:00","Periarticular osteopenia. Small marginal erosions at the right 2nd and 3rd MCP heads.","Erosive inflammatory arthropathy.")],
   expect="ra", verdict="possible"),  # RA joint count is entered on the Clinical features tab; with >10 joints it meets
  dict(file="05_drug_lupus_Kenneth", label="05 Kenneth - hydralazine drug-induced lupus", name="DEMO, Kenneth", dob="1950-09-11", sex="M", mrn="TESTSE05", age=76, adm="2026-11-12",
   note=("HOSPITALIST PROGRESS NOTE", "2026-11-16 09:15", """76 M with heart failure on hydralazine for 3 years. Two months of arthralgia and swelling of
both wrists and knees, low-grade fevers and pleuritic chest pain. No rash, no mouth ulcers.
Urinalysis bland."""),
   vit="2026-11-16 08:00 BP: 124/70 HR: 78 RR: 18 Temp: 37.8 C SpO2: 95%",
   labs=("2026-11-16 06:00", [("ANA titre","1:1280","","",""),("ANA pattern","Homogeneous","","",""),("Anti-histone","Positive","","",""),
        ("Anti-dsDNA","4","IU/mL","0 - 30",""),("C3 complement","1.30","g/L","0.90 - 1.80",""),("C4 complement","0.30","g/L","0.10 - 0.40",""),("Creatinine","104","umol/L","60 - 110","")]),
   meds=["Hydralazine 50 mg PO TID","Isosorbide dinitrate 20 mg PO TID","Furosemide 40 mg PO daily","Bisoprolol 5 mg PO daily"],
   problems=["Heart failure","Pleural effusion, bilateral","Polyarthritis"],
   reports=[("CHEST X-RAY","2026-11-15 07:00","Small bilateral pleural effusions. Normal heart size.","Small bilateral effusions.")],
   expect="dil"),
  dict(file="06_low_titre_ana_Muriel", label="06 Muriel - low-titre ANA, no autoimmune disease", name="DEMO, Muriel", dob="1943-12-01", sex="F", mrn="TESTSE06", age=82, adm="2026-11-15",
   note=("HOSPITALIST ADMISSION NOTE", "2026-11-15 18:00", """82 F admitted after a mechanical fall. Six months of fatigue. GP sent screening blood work
including an antinuclear screen. No rash, joint swelling, Raynaud, dry eyes or mouth, or
muscle weakness. Exam unremarkable apart from right hip bruising."""),
   vit="2026-11-15 17:00 BP: 136/78 HR: 72 RR: 16 Temp: 36.6 C SpO2: 97%",
   labs=("2026-11-15 06:00", [("ANA titre","1:80","","",""),("ANA pattern","Dense fine speckled","","",""),("Anti-dsDNA","2","IU/mL","0 - 30",""),
        ("Anti-Sm","Negative","","",""),("Anti-U1 RNP","Negative","","",""),("Anti-Ro/SSA","Negative","","",""),("Anti-La/SSB","Negative","","",""),
        ("C3 complement","1.10","g/L","0.90 - 1.80",""),("C4 complement","0.22","g/L","0.10 - 0.40",""),("Creatine kinase","88","U/L","30 - 200",""),
        ("Erythrocyte sedimentation rate","22","mm/h","0 - 30","")]),
   meds=["Levothyroxine 75 mcg PO daily","Vitamin D 1000 units PO daily"],
   problems=["Hypothyroidism","Fall"],
   reports=[("X-RAY RIGHT HIP","2026-11-15 16:00","No fracture.","No acute fracture.")],
   expect=None),
  dict(file="07_cryoglobulinemia_Norman", label="07 Norman - HCV cryoglobulinemic vasculitis", name="DEMO, Norman", dob="1965-04-19", sex="M", mrn="TESTSE07", age=61, adm="2026-11-14",
   note=("HOSPITALIST ADMISSION NOTE", "2026-11-14 12:00", """61 M, past injection drug use, never treated for hepatitis. Three weeks of palpable purpura
on both shins, burning feet and right foot drop. Arthralgia of the knees.
Urinalysis: 2+ blood, 2+ protein."""),
   vit="2026-11-14 11:00 BP: 158/92 HR: 84 RR: 16 Temp: 37.0 C SpO2: 98%",
   labs=("2026-11-14 06:00", [("Rheumatoid factor","420","IU/mL","0 - 15","H"),("C3 complement","0.95","g/L","0.90 - 1.80",""),("C4 complement","<0.02","g/L","0.10 - 0.40","L"),
        ("Cryoglobulins","Positive","","",""),("Hepatitis C antibody","Positive","","",""),("Creatinine","160","umol/L","60 - 110","H"),("ALT","74","U/L","0 - 40","H")]),
   meds=["Gabapentin 300 mg PO TID"],
   problems=["Purpura","Mononeuritis multiplex","Glomerulonephritis"],
   reports=[("NERVE CONDUCTION STUDY","2026-11-15 10:00","Asymmetric axonal sensorimotor neuropathy, worst in the right peroneal nerve.","Pattern in keeping with mononeuritis multiplex.")],
   expect="cryo"),
  dict(file="08_scleroderma_crisis_Olivia", label="08 Olivia - scleroderma renal crisis", name="DEMO, Olivia", dob="1978-08-08", sex="F", mrn="TESTSE08", age=48, adm="2026-11-16",
   note=("HOSPITALIST ADMISSION NOTE", "2026-11-16 20:00", """48 F, eight months of Raynaud, puffy hands, then rapidly spreading skin tightening of the
fingers, forearms and chest. Prednisone 30 mg started 3 weeks ago by a walk-in clinic for
hand swelling. Now severe headache, blurred vision, BP 210/120. Urinalysis: 1+ protein."""),
   vit="2026-11-16 19:00 BP: 210/120 HR: 104 RR: 18 Temp: 36.9 C SpO2: 97%",
   labs=("2026-11-16 18:30", [("ANA titre","1:1280","","",""),("ANA pattern","Nucleolar","","",""),("Anti-RNA polymerase III","Positive","","",""),
        ("Anti-Scl-70","Negative","","",""),("Anti-centromere","Negative","","",""),("Creatinine","238","umol/L","45 - 90","H"),
        ("Platelet count","95","x10^9/L","150 - 400","L"),("Hemoglobin","92","g/L","120 - 160","L")]),
   meds=["Prednisone 30 mg PO daily","Nifedipine XL 30 mg PO daily"],
   problems=["Raynaud phenomenon","Sclerodactyly","Hypertensive emergency"],
   reports=[("CT HEAD WITHOUT CONTRAST","2026-11-16 19:30","No hemorrhage. Subtle bilateral parieto-occipital hypodensity.","Query posterior reversible encephalopathy.")],
   expect="ssc"),
  dict(file="09_antisynthetase_Paul", label="09 Paul - antisynthetase syndrome (Jo-1, ILD)", name="DEMO, Paul", dob="1972-02-27", sex="M", mrn="TESTSE09", age=54, adm="2026-11-15",
   note=("HOSPITALIST ADMISSION NOTE", "2026-11-15 15:30", """54 M, three months of exertional dyspnea and dry cough, difficulty climbing stairs and
getting out of a chair, and cracked rough skin on the sides of the fingers (mechanic's hands).
Hand arthralgia. Fevers. Proximal weakness 4/5 on exam."""),
   vit="2026-11-15 14:30 BP: 130/80 HR: 102 RR: 24 Temp: 38.1 C SpO2: 89%",
   labs=("2026-11-15 06:00", [("Anti-Jo-1","Positive","","",""),("ANA titre","Negative","","",""),("Creatine kinase","2400","U/L","30 - 200","H"),
        ("C reactive protein","24","mg/L","0 - 8","H"),("Creatinine","72","umol/L","60 - 110","")]),
   meds=["Acetaminophen 1 g PO QID PRN"],
   problems=["Interstitial lung disease","Polyarthritis","Raynaud phenomenon"],
   reports=[("CT CHEST HIGH RESOLUTION","2026-11-15 11:00","Bilateral lower-lobe ground glass and reticulation with subpleural sparing.","NSIP pattern interstitial lung disease.")],
   expect="myositis"),
  dict(file="10_antiphospholipid_Rachel", label="10 Rachel - triple-positive antiphospholipid", name="DEMO, Rachel", dob="1992-06-05", sex="F", mrn="TESTSE10", age=34, adm="2026-11-14",
   note=("HOSPITALIST ADMISSION NOTE", "2026-11-14 13:00", """34 F with an unprovoked left leg DVT and pulmonary embolism. Two pregnancy losses at 12 and
14 weeks. Not on estrogen. Clotting studies drawn before heparin was started."""),
   vit="2026-11-14 12:00 BP: 118/72 HR: 108 RR: 22 Temp: 37.0 C SpO2: 93%",
   labs=("2026-11-14 06:00", [("Lupus anticoagulant","Detected","","",""),("Anticardiolipin IgG","85","GPL","< 20","H"),("Anti-beta2 glycoprotein I IgG","64","U/mL","< 20","H"),
        ("ANA titre","1:160","","",""),("ANA pattern","Speckled","","",""),("Platelet count","110","x10^9/L","150 - 400","L"),("Creatinine","64","umol/L","45 - 90","")]),
   meds=["Enoxaparin 70 mg SC q12h"],
   problems=["Deep vein thrombosis, left leg","Pulmonary embolism"],
   reports=[("CT PULMONARY ANGIOGRAM","2026-11-14 10:00","Filling defects in right lower lobe segmental arteries.","Acute pulmonary embolism.")],
   expect="aps"),
]

def wrap(s, w=92):
    out, line = [], ""
    for word in s.split():
        if len(line) + len(word) + 1 > w: out.append(line); line = word
        else: line = (line + " " + word).strip()
    return out + [line] if line else out

def chart(p):
    foot = lambda n: ["", "", f"MADE-UP TEST PATIENT - NOT A REAL PERSON | {p['name']} MRN {p['mrn']}         Page {n}"]
    L = ["PATIENT CHART EXTRACT - VICTORIA GENERAL HOSPITAL (TEST)",
         "MADE-UP TEST PATIENT - NOT A REAL PERSON - FOR SANDBOX TESTING ONLY",
         f"Patient: {p['name']:<32}DOB: {p['dob']}     Sex: {p['sex']}",
         f"MRN: {p['mrn']:<36}Age: {p['age']}",
         f"Admitted: {p['adm']} (Hospitalist)", ""]
    title, when, body = p["note"]
    L += [title, f"Date of service: {when}"] + body.splitlines() + [p["vit"], ""]
    L += lab_table(*p["labs"]) + ["", f"ACTIVE MEDICATION ORDERS ({p['labs'][0][:10]})"] + p["meds"] + ["", "ACTIVE PROBLEM LIST"] + p["problems"]
    L += foot(1) + ["", "IMAGING AND DIAGNOSTIC REPORTS", ""]
    for t, w, findings, imp in p["reports"]:
        L += [t, f"Date of exam: {w}", "FINDINGS:"] + wrap(findings) + ["IMPRESSION:"] + wrap(imp) + [""]
    L += foot(2)
    return L

if __name__ == "__main__":
    import json
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
    json.dump([{k: p[k] for k in ("file", "label", "expect", "age", "sex")} | {"verdict": p.get("verdict", "meets")} for p in P], open(os.path.join(HERE, "cases.json"), "w"), indent=1)
