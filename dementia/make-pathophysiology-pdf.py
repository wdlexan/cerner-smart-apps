"""python3 make-brainmap-png.py && python3 make-pathophysiology-pdf.py  ->  pathophysiology.pdf (and venn.png)
Brief pathophysiology of the dementias + a 4-set Venn of the main misfolded proteins."""
import os
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import Ellipse, FancyBboxPatch
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Image, Table, TableStyle, PageBreak, KeepTogether
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

HERE = os.path.dirname(os.path.abspath(__file__))
pdfmetrics.registerFont(TTFont("DV", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"))
pdfmetrics.registerFont(TTFont("DVB", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"))
pdfmetrics.registerFont(TTFont("DVI", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Oblique.ttf"))
from reportlab.lib.fonts import addMapping
addMapping("DV", 0, 0, "DV"); addMapping("DV", 1, 0, "DVB"); addMapping("DV", 0, 1, "DVI"); addMapping("DV", 1, 1, "DVB")

# ---------------------------------------------------------------- Venn diagram
SETS = [  # (label, colour, centre, angle)
    ("TDP-43", "#c0392b", (0.350, 0.400), 140),
    ("Amyloid-β", "#d68910", (0.450, 0.500), 140),
    ("Tau", "#2471a3", (0.544, 0.500), 40),
    ("α-Synuclein", "#239b56", (0.644, 0.400), 40),
]
# region code = TDP, Aβ, Tau, αSyn
REGIONS = {
    "1000": (0.13, 0.43, "LATE\nFTLD-TDP\n(bvFTD, svPPA)\nALS / ALS-FTD"),
    "0100": (0.31, 0.76, "Cerebral amyloid\nangiopathy\nPreclinical AD\n(amyloid only)"),
    "0010": (0.69, 0.76, "PSP · CBD (4R)\nPick (3R)\nCTE · PART\nMAPT FTD"),
    "0001": (0.87, 0.43, "Parkinson disease\nPDD · pure DLB\nMSA (glial)"),
    "0110": (0.50, 0.67, "ALZHEIMER\nDISEASE"),
    "1110": (0.335, 0.52, "AD + LATE\n(faster)"),
    "0111": (0.665, 0.52, "DLB with AD\nco-pathology"),
    "1111": (0.50, 0.385, "Mixed\n(common\nage >85)"),
    "1001": (0.50, 0.17, "Lewy + TDP-43\n(some DLB/PD)"),
    "1010": (0.285, 0.30, ""), "0101": (0.715, 0.30, ""),
    "1011": (0.395, 0.24, ""), "1101": (0.605, 0.24, ""),
    "1100": (0.23, 0.60, ""), "0011": (0.77, 0.60, ""),
}
fig, ax = plt.subplots(figsize=(8.2, 7.4), dpi=200)
ax.set_xlim(0, 1); ax.set_ylim(0.0, 1.0); ax.axis("off")
for name, col, (x, y), ang in SETS:
    ax.add_patch(Ellipse((x, y), 0.72, 0.45, angle=ang, facecolor=col, alpha=0.16, edgecolor=col, linewidth=2.2))
for code, (x, y, t) in REGIONS.items():
    if not t: continue
    big = code == "0110"
    ax.text(x, y, t, ha="center", va="center", fontsize=12 if big else 7.6, fontweight="bold" if big or code in ("1110", "0111", "1111") else "normal", color="#1d2430", linespacing=1.15)
for (name, col, _, _), (x, y) in zip(SETS, [(0.09, 0.15), (0.17, 0.90), (0.83, 0.90), (0.91, 0.15)]):
    ax.text(x, y, name, ha="center", va="center", fontsize=13, fontweight="bold", color=col)
ax.text(0.5, 0.985, "Misfolded proteins in neurodegenerative dementia — overlap is the rule in older adults", ha="center", va="top", fontsize=10.5, color="#1d2430", fontweight="bold")
ax.text(0.5, 0.035, "Empty overlaps: rare combinations. Regions show the usual pathology, not every case.", ha="center", fontsize=7.5, color="#5b6575", style="italic")
plt.tight_layout(pad=0.2)
venn = os.path.join(HERE, "venn.png"); fig.savefig(venn); plt.close(fig)

# ---------------------------------------------------------------- PDF
ss = getSampleStyleSheet()
H1 = ParagraphStyle("h1", parent=ss["Title"], fontName="DVB", fontSize=17, leading=21, spaceAfter=4, textColor=colors.HexColor("#1d2a44"))
SUB = ParagraphStyle("sub", parent=ss["Normal"], fontName="DVI", fontSize=8.5, textColor=colors.HexColor("#5b6575"), alignment=1, spaceAfter=8)
H2 = ParagraphStyle("h2", parent=ss["Heading2"], fontName="DVB", fontSize=11.5, leading=14, spaceBefore=8, spaceAfter=3, textColor=colors.HexColor("#2457a6"))
B = ParagraphStyle("b", parent=ss["Normal"], fontName="DV", fontSize=8.6, leading=11.4)
S = ParagraphStyle("s", parent=B, fontSize=7.6, leading=9.6)
SB = ParagraphStyle("sb", parent=S, fontName="DVB")

SBW = ParagraphStyle("sbw", parent=SB, textColor=colors.white)
def table2(rows, widths):
    data = [[Paragraph(c, SBW if i == 0 else S) for c in r] for i, r in enumerate(rows)]
    t = Table(data, colWidths=widths, repeatRows=1)
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1d2a44")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"), ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#c9d0da")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f4f6f9")]),
        ("LEFTPADDING", (0, 0), (-1, -1), 4), ("RIGHTPADDING", (0, 0), (-1, -1), 4), ("TOPPADDING", (0, 0), (-1, -1), 3), ("BOTTOMPADDING", (0, 0), (-1, -1), 3)]))
    return t

story = [
    Paragraph("Pathophysiology of the Dementias", H1),
    Paragraph("Hospitalist Toolkit · Dementia workup · brief reference for bedside teaching (not a substitute for specialist assessment)", SUB),
    Paragraph("Most neurodegenerative dementias are <b>proteinopathies</b>: a normal protein misfolds, aggregates and spreads cell-to-cell along connected networks "
              "(a “prion-like” templating process). Where the aggregate starts determines the first symptoms; how far it spreads determines severity. "
              "In people over 80, <b>two or more pathologies are the norm</b> — which is why mixed pictures are common and why a single biomarker rarely explains everything.", B),
    Spacer(1, 4),
    Image(venn, width=6.5 * inch, height=6.5 * 7.4 / 8.2 * inch),
    Spacer(1, 2),
    table2([["Outside the four circles", "Mechanism"],
            ["Vascular cognitive impairment", "Ischemia: cortical/strategic infarcts, lacunes and small-vessel disease disconnect frontal–subcortical circuits (slowing, executive, gait). Often adds to AD."],
            ["Prion disease (CJD)", "Prion protein (PrP<super>Sc</super>) templates normal PrP into a misfolded form → rapid spongiform neuronal loss."],
            ["Huntington disease", "CAG expansion in <i>HTT</i> → polyglutamine huntingtin aggregates; striatal (caudate) medium spiny neurons die first."],
            ["FUS proteinopathy", "Rare FTLD and young-onset ALS."],
            ["Non-degenerative", "NPH (CSF dynamics), Korsakoff (thiamine), metabolic/drug causes — potentially reversible."]],
           [1.9 * inch, 4.9 * inch]),
    PageBreak(),
]

story.append(Paragraph("The four main proteins", H2))
story.append(table2([
    ["Protein", "Normal job", "When it goes wrong", "Main diseases"],
    ["Amyloid-β (Aβ)", "Fragment cut from amyloid precursor protein (APP) at synapses", "Aβ42 aggregates into extracellular plaques and vessel walls (CAA); thought to trigger downstream tau spread", "Alzheimer disease, cerebral amyloid angiopathy, Down syndrome"],
    ["Tau", "Stabilizes microtubules in axons (3R and 4R isoforms)", "Hyperphosphorylated tau detaches and forms intracellular tangles/inclusions; tangle burden tracks symptoms best", "AD (3R+4R), PSP and CBD (4R), Pick disease (3R), CTE, PART, MAPT-FTD"],
    ["α-Synuclein", "Presynaptic protein regulating vesicle release", "Forms Lewy bodies/neurites in neurons, or glial cytoplasmic inclusions in oligodendrocytes (MSA)", "Parkinson disease, PDD, DLB, MSA, pure autonomic failure, RBD (prodrome)"],
    ["TDP-43", "Nuclear RNA-binding protein (splicing)", "Leaves the nucleus, aggregates in cytoplasm → loss of nuclear function", "ALS (~97%), FTLD-TDP (~50% of FTD), LATE, co-pathology in AD"],
], [1.0 * inch, 1.5 * inch, 2.3 * inch, 2.0 * inch]))

story.append(Paragraph("Disease by disease", H2))
story.append(table2([
    ["Dementia", "Pathophysiology", "Why it shapes treatment"],
    ["Alzheimer disease", "Aβ plaques begin 15–20 years before symptoms; tau tangles then spread entorhinal cortex → hippocampus → neocortex (Braak stages I–VI), causing synapse loss and memory-first decline. Loss of cholinergic neurons in the nucleus basalis of Meynert. APOE ε4 impairs Aβ clearance.",
     "Cholinesterase inhibitors boost remaining acetylcholine; memantine blocks excess NMDA (glutamate) activity. Anti-amyloid antibodies clear plaques (ARIA = vessel leakage/bleeds, worse with ε4 and CAA)."],
    ["Vascular", "Large-vessel infarcts, strategic infarcts (thalamus, angular gyrus) or diffuse small-vessel disease (arteriolosclerosis, lacunes, white-matter rarefaction) disrupt frontal–subcortical circuits; impaired cerebral autoregulation and blood–brain barrier.",
     "Prevent new injury: BP, AF, lipids, diabetes, smoking. Avoid hypotension. Cholinergic drugs give small benefit."],
    ["Lewy body (DLB) and PDD", "α-Synuclein spreads from brainstem/olfactory regions (Braak PD stages 1–6) to limbic and neocortex. Very severe cortical cholinergic loss; nigrostriatal dopamine loss. Visual hallucinations reflect visual-association cortex involvement; RBD from brainstem nuclei (subcoeruleus). AD co-pathology in about half.",
     "Large cholinergic deficit → often better ChEI response than AD. Dopamine depletion + D2 blockade → severe neuroleptic sensitivity (avoid haloperidol)."],
    ["Frontotemporal lobar degeneration (bvFTD, PPA)", "Frontal and anterior temporal neurons degenerate. About 45% tau (Pick, PSP, CBD, MAPT), 50% TDP-43 (GRN, C9orf72; svPPA almost always TDP type C), 5–10% FUS. Serotonergic deficits; cholinergic system relatively spared. nfvPPA → usually tau; lvPPA → usually AD.",
     "Cholinesterase inhibitors don't help and can worsen behaviour; SSRIs/trazodone target serotonin. Genetics matter (≈30–40% have family history)."],
    ["Progressive supranuclear palsy", "4R-tau in neurons (globose tangles) and astrocytes (tufted astrocytes) in midbrain, subthalamic nucleus, globus pallidus, dentate. Midbrain tectum → vertical gaze palsy; brainstem/basal ganglia → axial rigidity, falls.",
     "Postsynaptic striatal neurons lost → little levodopa response. Supportive care; swallow and falls."],
    ["Corticobasal degeneration / syndrome", "4R-tau with astrocytic plaques in asymmetric perirolandic (frontoparietal) cortex and basal ganglia → apraxia, alien limb, cortical sensory loss. The <i>syndrome</i> (CBS) can also be caused by AD or PSP pathology.",
     "Amyloid testing changes management (AD-CBS). Symptomatic: myoclonus, dystonia."],
    ["Multiple system atrophy", "α-Synuclein in oligodendrocytes (glial cytoplasmic inclusions) → demyelination and neuronal loss in striatonigral (MSA-P) and olivopontocerebellar (MSA-C) systems plus autonomic nuclei and spinal intermediolateral column.",
     "Central autonomic failure → treat orthostatic hypotension and bladder. Poor levodopa response. Cognition usually spared."],
    ["Huntington disease", "Autosomal dominant CAG expansion in <i>HTT</i> (≥40 full penetrance; anticipation through father). Mutant huntingtin aggregates; indirect-pathway striatal neurons die first → chorea; later frontal–subcortical dementia and psychiatric illness.",
     "Dopamine depletion (tetrabenazine, VMAT2) or D2 blockade reduces chorea. Genetic counselling for family."],
    ["ALS / ALS-FTD", "TDP-43 aggregates in upper and lower motor neurons (≈97%) and, in ALS-FTD, frontotemporal cortex. C9orf72 repeat expansion is the commonest genetic cause of both. Glutamate excitotoxicity contributes.",
     "Riluzole reduces glutamate release. Respiratory and bulbar failure drive prognosis."],
    ["LATE", "TDP-43 confined mainly to amygdala and hippocampus, often with hippocampal sclerosis; age >80. Pure LATE: slow amnestic decline. With AD: faster decline.",
     "Not an anti-amyloid target. Symptomatic ChEI trial reasonable."],
    ["Creutzfeldt–Jakob disease", "Misfolded prion protein (PrP<super>Sc</super>) converts normal PrP; spongiform change, neuronal loss and gliosis in cortex and deep grey matter. Sporadic (85%), genetic, acquired.",
     "No disease-modifying therapy. Transmissible via neurosurgical instruments → infection prevention."],
    ["Normal pressure hydrocephalus", "Impaired CSF absorption/compliance → ventricular enlargement stretches periventricular fibres (leg and bladder fibres from the medial frontal lobe) → gait, urinary and frontal–subcortical cognitive change.",
     "CSF diversion (shunt) can reverse it if not long-standing."],
    ["Alcohol-related / Korsakoff", "Thiamine deficiency injures mamillary bodies and medial thalamus (memory circuit of Papez); alcohol neurotoxicity adds frontal and cerebellar atrophy.",
     "High-dose thiamine before glucose; abstinence allows partial recovery."],
], [1.25 * inch, 3.35 * inch, 2.2 * inch]))

story.append(Paragraph("Neurotransmitters → drugs (why the same drug helps one dementia and harms another)", H2))
story.append(table2([
    ["System", "Most affected in", "Implication"],
    ["Acetylcholine (nucleus basalis)", "DLB/PDD > AD > vascular; relatively spared in FTD", "Cholinesterase inhibitors: best in DLB/PDD, useful in AD, no benefit in FTD"],
    ["Glutamate (NMDA)", "AD (excitotoxicity), ALS", "Memantine (AD); riluzole (ALS)"],
    ["Dopamine (nigrostriatal)", "PD/PDD/DLB, MSA, PSP", "Levodopa helps PD; less in DLB, poor in MSA/PSP. Antipsychotics dangerous in Lewy disease"],
    ["Serotonin", "FTD, depression in all dementias", "SSRIs/trazodone for behaviour in FTD"],
    ["Noradrenaline (locus coeruleus)", "Early AD, DLB, PD", "Contributes to apathy, attention problems, orthostatic hypotension"],
], [1.7 * inch, 2.3 * inch, 2.8 * inch]))

story.append(Spacer(1, 6))
story.append(Paragraph("<b>Key sources:</b> Braak H &amp; Braak E 1991 (AD staging); Braak H et al. 2003 (PD staging); McKeith IG et al. Neurology 2017 (DLB); "
                       "Mackenzie IR et al. Acta Neuropathol 2010 (FTLD nomenclature); Höglinger GU et al. Mov Disord 2017 (PSP); Armstrong MJ et al. Neurology 2013 (CBD); "
                       "Wenning GK et al. Mov Disord 2022 (MSA); Nelson PT et al. Brain 2019 and Wolk DA et al. Alzheimer's Dement 2025 (LATE); "
                       "Jack CR et al. Alzheimer's Dement 2024 (revised AD biological criteria). Percentages are approximate.", S))
# ---- page 4: brain map
import json
BM = json.load(open(os.path.join(HERE, "brainmap.json")))
TNAME = {"ad": "Alzheimer", "late": "LATE", "dlb": "DLB", "pdd": "PDD", "ftd": "bvFTD", "ppa": "PPA", "vad": "Vascular", "nph": "NPH", "rpd": "CJD / rapid",
         "alc": "Korsakoff", "psp": "PSP", "cbs": "CBS", "msa": "MSA", "hd": "Huntington", "als": "ALS"}
story.append(PageBreak())
story.append(Paragraph("Where each dementia starts — brain regions, function and symptoms", H2))
story.append(Paragraph("Schematic only (shapes approximate). The first area hit explains the first symptoms; spread along connected networks explains what comes next. "
                       "In the app, the Subtype fit tab colours this map for the patient: symptoms (orange), imaging (blue), both (green).", B))
story.append(Spacer(1, 4))
story.append(Image(os.path.join(HERE, "brainmap.png"), width=7.2 * inch, height=7.2 * 300 / 800 * inch))
rows = [["Region", "Function → symptom when affected", "Typically affected in"]]
for rid, r in BM["R"].items():
    ts = [TNAME[t] for t, rs in BM["T"].items() if rid in rs and t in TNAME]
    rows.append([f"<b>{r['name']}</b>", r["fn"], ", ".join(ts) or "—"])
story.append(table2(rows, [1.9 * inch, 3.3 * inch, 1.6 * inch]))

def foot(c, d):
    c.saveState(); c.setFont("DV", 7); c.setFillColor(colors.HexColor("#5b6575"))
    c.drawString(0.6 * inch, 0.45 * inch, "Pathophysiology of the Dementias · Hospitalist Toolkit · decision support only")
    c.drawRightString(letter[0] - 0.6 * inch, 0.45 * inch, f"Page {d.page}"); c.restoreState()

out = os.path.join(HERE, "pathophysiology.pdf")
SimpleDocTemplate(out, pagesize=letter, leftMargin=0.6 * inch, rightMargin=0.6 * inch, topMargin=0.55 * inch, bottomMargin=0.7 * inch,
                  title="Pathophysiology of the Dementias", author="Hospitalist Toolkit").build(story, onFirstPage=foot, onLaterPages=foot)
print("wrote", out)
