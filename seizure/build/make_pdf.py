import sys
from reportlab.lib.pagesizes import letter, landscape
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Table, TableStyle, Spacer, PageBreak
from aed_data import AEDS

out = sys.argv[1]
ss = getSampleStyleSheet()
cell = ParagraphStyle("cell", parent=ss["BodyText"], fontSize=7.2, leading=8.6)
cellb = ParagraphStyle("cellb", parent=cell, fontName="Helvetica-Bold")
head = ParagraphStyle("head", parent=cell, textColor=colors.white, fontName="Helvetica-Bold")
h1 = ParagraphStyle("h1", parent=ss["Title"], fontSize=15, spaceAfter=4)
h2 = ParagraphStyle("h2", parent=ss["Heading2"], fontSize=11, spaceBefore=6, spaceAfter=3)
small = ParagraphStyle("small", parent=ss["BodyText"], fontSize=7.5, leading=9.5)

SPEC = {"focal": "Focal", "gtc": "Gen. tonic-clonic", "absence": "Absence", "myoclonic": "Myoclonic"}

def P(t, s=cell): return Paragraph(t, s)

def footer(c, d):
    c.saveState(); c.setFont("Helvetica", 6.5); c.setFillColor(colors.grey)
    c.drawString(0.4*inch, 0.3*inch, "Adult antiseizure medication quick reference - hospitalist use. Doses are typical ranges; confirm with product monograph, pharmacy and neurology. Not a substitute for clinical judgment.")
    c.drawRightString(10.6*inch, 0.3*inch, f"Page {d.page}")
    c.restoreState()

doc = SimpleDocTemplate(out, pagesize=landscape(letter), leftMargin=0.4*inch, rightMargin=0.4*inch,
                        topMargin=0.4*inch, bottomMargin=0.5*inch, title="Antiseizure medication dosing reference")
story = [P("Antiseizure Medications (AEDs/ASMs) - Adult Dosing Quick Reference", h1),
         P("Starting dose, titration, target, side effects and which seizure types each drug suits. "
           "Companion to the Seizure SMART on FHIR app.", small)]

# Choice table
story.append(P("Choosing a drug", h2))
choice = [
  ["Situation", "Usual first choices", "Avoid / caution"],
  ["Focal seizures", "Lamotrigine (SANAD II), levetiracetam, lacosamide; oxcarbazepine/carbamazepine", "-"],
  ["Generalized tonic-clonic / unclassified", "Valproate (men, non-childbearing), levetiracetam, lamotrigine", "Valproate in women of childbearing potential"],
  ["Absence", "Ethosuximide, valproate, lamotrigine", "Carbamazepine, oxcarbazepine, phenytoin, gabapentin, pregabalin"],
  ["Myoclonic (e.g. JME)", "Valproate, levetiracetam (zonisamide, clobazam adjunct)", "Carbamazepine, oxcarbazepine, phenytoin, gabapentin; lamotrigine may worsen"],
  ["Older adults", "Lamotrigine, levetiracetam, lacosamide", "Enzyme inducers (CBZ, PHT, PB): interactions, bone loss, sedation"],
  ["Women of childbearing potential", "Lamotrigine, levetiracetam (+ folic acid)", "Valproate (teratogen), topiramate, enzyme inducers with OCP"],
  ["Needs IV / rapid control", "Levetiracetam, lacosamide, valproate, (fos)phenytoin, brivaracetam", "Lamotrigine and cenobamate need slow titration"],
  ["On DOAC / warfarin / chemo / HIV ART", "Levetiracetam, lacosamide, brivaracetam", "CBZ, PHT, PB (strong inducers)"],
]
t = Table([[P(c, head if i == 0 else (cellb if j == 0 else cell)) for j, c in enumerate(r)] for i, r in enumerate(choice)],
          colWidths=[2.3*inch, 4.4*inch, 3.5*inch])
t.setStyle(TableStyle([("BACKGROUND", (0,0), (-1,0), colors.HexColor("#2b4a6f")),
                       ("GRID", (0,0), (-1,-1), 0.3, colors.HexColor("#b8c4d2")),
                       ("ROWBACKGROUNDS", (0,1), (-1,-1), [colors.white, colors.HexColor("#f2f5f9")]),
                       ("VALIGN", (0,0), (-1,-1), "TOP")]))
story += [t]

story.append(P("Status epilepticus (adult) - time-based", h2))
se = [
  ["Time", "Action"],
  ["0-5 min", "ABCs, O2, POC glucose (thiamine 100 mg IV before glucose if malnourished/alcohol), IV access, labs incl. AED levels, cardiac monitor"],
  ["5-20 min (benzodiazepine)", "Lorazepam 0.1 mg/kg IV (max 4 mg/dose), repeat once in 5 min; OR midazolam 10 mg IM (>40 kg); OR diazepam 0.15-0.2 mg/kg IV (max 10 mg/dose)"],
  ["20-40 min (second line, pick one)", "Levetiracetam 60 mg/kg IV (max 4500 mg); OR fosphenytoin 20 mg PE/kg (max 1500 mg PE); OR valproate 40 mg/kg (max 3000 mg). ESETT: similar efficacy (~45-50%)"],
  ["40+ min (refractory)", "ICU/anesthesia: intubation, midazolam or propofol infusion (or ketamine/pentobarbital), continuous EEG; consider second agent from line above or phenobarbital 15-20 mg/kg"],
]
t2 = Table([[P(c, head if i == 0 else (cellb if j == 0 else cell)) for j, c in enumerate(r)] for i, r in enumerate(se)],
           colWidths=[2.3*inch, 7.9*inch])
t2.setStyle(TableStyle([("BACKGROUND", (0,0), (-1,0), colors.HexColor("#8a2b2b")),
                       ("GRID", (0,0), (-1,-1), 0.3, colors.HexColor("#d2b8b8")),
                       ("VALIGN", (0,0), (-1,-1), "TOP")]))
story += [t2]

story.append(P("Drug levels (trough, Canadian units)", h2))
story.append(P("Phenytoin total 40-80 umol/L (correct for albumin; free 4-8 umol/L) &nbsp;|&nbsp; Valproate 350-700 umol/L &nbsp;|&nbsp; "
               "Carbamazepine 17-51 umol/L &nbsp;|&nbsp; Phenobarbital 65-170 umol/L &nbsp;|&nbsp; Ethosuximide 280-710 umol/L &nbsp;|&nbsp; "
               "Levetiracetam/lamotrigine: adherence or pregnancy only. Treat the patient, not the level.", small))
story.append(PageBreak())

story.append(P("Drug-by-drug dosing", h1))
hdr = ["Drug", "Start", "Titration", "Target / max", "Renal / hepatic", "Main side effects & monitoring", "Best suited for", "Avoid / caution"]
rows = [[P(h, head) for h in hdr]]
for a in AEDS:
    name = f"<b>{a['name']}</b>" + (f"<br/><font size=6.5>{a['brand']}</font>" if a['brand'] else "")
    name += "<br/><font size=6.5 color='#2b6f3a'>IV available</font>" if a["iv"] else ""
    spec = ", ".join(SPEC[s] for s in a["spectrum"])
    worse = (" <font color='#8a2b2b'>May worsen: " + ", ".join(SPEC[s] for s in a["worsens"]) + "</font>") if a["worsens"] else ""
    rows.append([P(name), P(a["start"]), P(a["titrate"]), P(f"{a['target']}<br/><i>Max: {a['max']}</i>"),
                 P(a["renal"]), P(a["se"] + "<br/><i>Monitor: " + a["monitor"] + "</i>" + (f"<br/><b>Levels:</b> {a['levels']}")),
                 P(f"<b>{spec}</b>.{worse}<br/>{a['best']}"),
                 P(a["avoid"] + (f"<br/><b>Interactions:</b> {a['interact']}" if a.get("interact") else ""))])
t3 = Table(rows, colWidths=[w*inch for w in [1.0, 1.1, 1.3, 1.2, 1.2, 1.75, 1.45, 1.2]], repeatRows=1)
t3.setStyle(TableStyle([("BACKGROUND", (0,0), (-1,0), colors.HexColor("#2b4a6f")),
                        ("GRID", (0,0), (-1,-1), 0.3, colors.HexColor("#b8c4d2")),
                        ("ROWBACKGROUNDS", (0,1), (-1,-1), [colors.white, colors.HexColor("#f2f5f9")]),
                        ("VALIGN", (0,0), (-1,-1), "TOP")]))
story.append(t3)
story.append(Spacer(1, 6))
story.append(P("Sources: SANAD II (Lancet 2021); ESETT (NEJM 2019); AES status epilepticus guideline 2016; product monographs; "
               "Ontario Clinical Guidelines for the Management of Epilepsy (2020); Health Canada valproate pregnancy warnings. "
               "All AEDs carry a suicidality warning - screen mood.", small))
doc.build(story, onFirstPage=footer, onLaterPages=footer)
print("wrote", out)
