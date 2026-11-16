"""python3 make-test-pdfs.py : turns test-pdfs/*.txt into text PDFs (monospace, one page per 'Page N' footer)."""
import glob, os
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
here = os.path.join(os.path.dirname(os.path.abspath(__file__)), "test-pdfs")
for t in sorted(glob.glob(os.path.join(here, "*.txt"))):
    c = canvas.Canvas(t[:-4] + ".pdf", pagesize=letter); c.setTitle("MADE-UP TEST PATIENT"); y = 750
    for line in open(t).read().splitlines():
        if y < 50: c.showPage(); y = 750
        c.setFont("Courier", 8.6); c.drawString(36, y, line); y -= 11
        if line.rstrip().split("Page")[-1].strip().isdigit() and "MADE-UP" in line: c.showPage(); y = 750
    c.save(); print("pdf", os.path.basename(t)[:-4] + ".pdf")
