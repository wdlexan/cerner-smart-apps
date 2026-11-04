"""Make blank referral templates with only the referring physician filled in.
Run:  python3 make_blank_templates.py   (needs: pip install pypdf reportlab)
Coordinates are the same ones used by forms.js / form41.js / bccancer.js
(PDF points, measured from the TOP of the page)."""
import io, os
from pypdf import PdfReader, PdfWriter
from reportlab.pdfgen import canvas
from reportlab.pdfbase.pdfmetrics import stringWidth

DOC = {
    "full": "Dr. Wayne Alexander Dong",   # Form 4.1 asks for full name
    "short": "Dr. Wayne A. Dong",
    "college": "21341",
    "msp": "26301",
    "phone": "250-819-0168",
}
H = 792
HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.dirname(HERE)
uline = lambda x0, x1, y: [x0 + 2, y - 11, x1, y + 1]

def box(c, text, b, size=10):
    x0, top, x1, bottom = b
    s = size
    while s > 6 and stringWidth(text, "Helvetica", s) > (x1 - x0 - 2):
        s -= 0.5
    c.setFont("Helvetica", s); c.drawString(x0 + 1, H - (bottom - 2.5), text)

def at(c, text, x, top, maxw, size=10):
    s = size
    while s > 6 and stringWidth(text, "Helvetica", s) > maxw:
        s -= 0.5
    c.setFont("Helvetica", s); c.drawString(x, H - top, text)

def form41(c):
    at(c, DOC["full"], 114, 556, 212)
    at(c, DOC["phone"], 114, 583, 112)
    at(c, DOC["college"], 233, 583, 92)
    c.circle(39.3, H - 555.2, 2.6, stroke=0, fill=1)   # "physician" radio

def bccancer(c):
    box(c, f"{DOC['short']} (College #{DOC['college']})", [154, 368, 325, 380], 8)
    box(c, DOC["phone"], [359, 368, 465, 380], 9)
    box(c, DOC["msp"], [501, 368, 600, 380], 9)

def pulse(c):
    box(c, DOC["short"], [337, 130, 585, 143], 10)
    box(c, DOC["msp"], [330, 144, 585, 157], 10)
    box(c, DOC["phone"], [339, 170, 585, 183], 10)

def gi(c):
    box(c, DOC["short"], uline(387.2, 503, 322.1))
    box(c, DOC["msp"], uline(539.9, 578.4, 322.1))
    box(c, DOC["phone"], uline(372.8, 578.4, 410.8))

JOBS = [("Form4.1.pdf", form41), ("BCCancerReferral.pdf", bccancer),
        ("PulseCardioReferral.pdf", pulse), ("GIReferral.pdf", gi)]

for name, draw in JOBS:
    reader = PdfReader(os.path.join(SRC, name)); w = PdfWriter()
    buf = io.BytesIO(); c = canvas.Canvas(buf, pagesize=(612, 792)); draw(c); c.save()
    overlay = PdfReader(buf).pages[0]
    for i, p in enumerate(reader.pages):
        if i == 0: p.merge_page(overlay)
        w.add_page(p)
    out = os.path.join(HERE, name.replace(".pdf", " - Blank (Dr Dong).pdf"))
    with open(out, "wb") as f: w.write(f)
    print("wrote", out)
