"""python3 make-brainmap-png.py -> brainmap.png + brainmap.json (used by make-pathophysiology-pdf.py). Needs playwright + Chrome."""
import asyncio, json, os, subprocess
from playwright.async_api import async_playwright
HERE = os.path.dirname(os.path.abspath(__file__))
data = subprocess.run(["node", "-e", """
const vm=require('vm'),fs=require('fs');const c={esc:s=>String(s)};vm.createContext(c);
vm.runInContext(fs.readFileSync(process.argv[1],'utf8')+';this.out={R:BRAIN_REGIONS,T:TYPE_REGIONS};',c);console.log(JSON.stringify(c.out));""",
    os.path.join(HERE, "brainmap.js")], capture_output=True, text=True, check=True).stdout
open(os.path.join(HERE, "brainmap.json"), "w").write(data)
html = f"""<html><head><meta charset="utf-8"></head><body style="margin:0;background:#fff"><script>function esc(s){{return String(s).replace(/[&<>"]/g,c=>({{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}}[c]))}}</script>
<script src="file://{HERE}/brainmap.js"></script><div id="x" style="width:1600px"></div>
<script>document.getElementById('x').innerHTML=brainSVG({{}},{{labels:true}}).replace('max-width:820px','max-width:1600px');</script></body></html>"""
tmp = os.path.join(HERE, "_brain.html"); open(tmp, "w", encoding="utf-8").write(html)
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox", "--allow-file-access-from-files"])
        pg = await b.new_page(viewport={"width": 1600, "height": 700}, device_scale_factor=1.5)
        await pg.goto("file://" + tmp); await pg.wait_for_timeout(300)
        await (await pg.query_selector("svg")).screenshot(path=os.path.join(HERE, "brainmap.png")); await b.close()
asyncio.run(main()); os.remove(tmp); print("wrote brainmap.png")
