/* Patient handout: living with heart failure at home. Plain language (about grade 6), kg and lb. DRAFT written by Claude: review before giving to patients.
   CHFHandout(o) returns { body, page }: body for the preview, page = a full printable HTML document. */
(function () {
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const lb = (kg) => Math.round(kg * 2.2046);
  const line = (v, w) => (v ? `<b>${esc(v)}</b>` : `<span style="display:inline-block;min-width:${w || 120}px;border-bottom:1px solid #999">&nbsp;</span>`);

  function body(o) {
    const dry = o.dry > 0 ? `${line(o.dry + " kg")} (${lb(o.dry)} lb)` : `${line("", 70)} kg (${line("", 60)} lb)`;
    const log = Array.from({ length: 14 }, (_, i) => `<tr><td>Day ${i + 1}</td><td></td><td></td><td></td></tr>`).join("");
    return `
<h1>Living with heart failure: your plan at home</h1>
<p>Heart failure means your heart does not pump as well as it should. Fluid can build up in your lungs, legs and belly. These daily steps help you stay well and out of hospital.</p>

<h2>1. Weigh yourself every morning</h2>
<ul>
<li>After you pee, before you eat or drink, in the same kind of clothes, on the same scale.</li>
<li>Write the number down every day (there is a log on page 2). Bring it to every appointment.</li>
<li>Your target weight ("dry weight") when you left hospital: ${dry}</li>
</ul>

<h2>2. Know when to call</h2>
<div class="zone yellow"><b>CALL your clinic or doctor the same day if:</b>
<ul>
<li>Your weight goes up more than <b>1 kg (2 lb) in a day</b>, or more than <b>2 kg (5 lb) in a week</b></li>
<li>You are more short of breath, or need more pillows to sleep, or wake up short of breath</li>
<li>Your legs, ankles or belly are more swollen</li>
<li>You feel dizzy or light-headed, or you are peeing much less than usual</li>
<li>You are vomiting, have diarrhea, or cannot eat or drink (see "Sick days")</li>
</ul>
Clinic phone: ${line(o.phone, 160)} &nbsp; After hours: call <b>8-1-1</b> (HealthLink BC, nurse 24/7)</div>
<div class="zone red"><b>CALL 9-1-1 if:</b> you are very short of breath at rest, have chest pain or pressure, faint, are confused, or cough up pink frothy spit.</div>

<h2>3. Eat less salt (sodium)</h2>
<ul>
<li>Aim for <b>less than 2,000 mg of sodium a day</b>. Salt makes your body hold on to water.</li>
<li>Read labels: <b>5% Daily Value or less is a little</b>, <b>15% or more is a lot</b>.</li>
<li>Most salt is already in food: canned soups, deli meats, bacon, ham, frozen dinners, pizza, chips, pickles, soy sauce, sauces, fast food and restaurant meals.</li>
<li>Cook at home with fresh foods. Use herbs, spices, lemon or garlic instead of salt. Take the salt shaker off the table.</li>
<li>Do not use salt substitutes (like "No Salt" or "Half Salt") without asking: they contain potassium, which can be dangerous with some heart pills.</li>
</ul>

<h2>4. Fluids</h2>
${o.fluid ? `<p>Drink no more than <b>${esc(o.fluidL)} litres a day</b> (about ${Math.round(o.fluidL * 4)} cups). This counts everything that is liquid at room temperature: water, coffee, tea, milk, juice, soup, ice cream, Jell-O and ice.</p>
<p>Tips: use a small cup, sip slowly, suck on ice chips or sugar-free candy if thirsty, spread drinks through the day.</p>`
      : `<p>You do <b>not</b> have a strict fluid limit right now. Drink when you are thirsty, but avoid drinking large amounts (more than about 2 litres a day) unless your doctor says so.</p>`}

<h2>5. Your medicines</h2>
<ul>
<li>Take your heart pills every day, even when you feel well. Do not stop them without asking your doctor.</li>
<li>Water pill (diuretic): ${line(o.diur, 220)}. It makes you pee more, so take it in the morning (and early afternoon if twice a day).</li>
${o.flex ? `<li>If your weight goes up more than 1 kg (2 lb) in a day: take ${line(o.flexdose, 180)} that day, and call the clinic if it does not come down in 2 days.</li>` : ""}
<li>Bring all your pill bottles (and any vitamins or herbal products) to every visit.</li>
<li><b>Avoid</b> anti-inflammatory pain pills: <b>ibuprofen (Advil, Motrin), naproxen (Aleve), diclofenac, celecoxib</b>. They make your body hold water and can hurt your kidneys. Acetaminophen (Tylenol) is OK for pain.</li>
<li>Ask a pharmacist before taking cold or flu pills (decongestants like pseudoephedrine raise blood pressure), antacids high in sodium, or herbal products.</li>
</ul>

<h2>6. Sick days</h2>
<p>If you are vomiting, have diarrhea, or cannot eat or drink, you can get dried out. <b>Call your clinic or 8-1-1</b>. You may be told to stop these for a day or two until you are eating and drinking again: water pills, dapagliflozin (Forxiga) or empagliflozin (Jardiance), sacubitril/valsartan (Entresto), ramipril and other "-pril" or "-sartan" pills, spironolactone, and metformin. Restart them when you are better.</p>

<h2>7. Stay active and healthy</h2>
<ul>
<li>Walk every day if you can. Start slowly and rest when tired. Ask about <b>cardiac rehab</b>.</li>
<li>Limit alcohol (or stop if your doctor says alcohol caused your heart failure). Stop smoking: ask for help (QuitNow: 1-877-455-2233).</li>
<li>Get your flu shot every year and your COVID-19 and pneumonia vaccines. Ask about the RSV vaccine.</li>
<li>Sleep: snoring with pauses in breathing (sleep apnea) can make heart failure worse. Tell your doctor.</li>
</ul>

<h2>8. Appointments</h2>
<ul>
<li>See your family doctor or heart failure clinic <b>within 7 days</b> of leaving hospital: ${line(o.fu, 200)}</li>
<li>Blood test (kidneys and potassium) on: ${line(o.lab, 120)}</li>
</ul>

<div class="pb"></div>
<h2>My daily weight log</h2>
<p>Target (dry) weight: ${dry}. Call if up more than 1 kg (2 lb) in a day or 2 kg (5 lb) in a week.</p>
<table class="log"><tr><th>Day</th><th>Date</th><th>Weight (kg or lb)</th><th>How I feel / swelling / breathing</th></tr>${log}</table>
<p class="small">This handout is general information. Follow the plan your own health care team gives you.</p>`;
  }
  const CSS = `body{font-family:Arial,Helvetica,sans-serif;font-size:14.5px;line-height:1.45;color:#111;max-width:760px;margin:20px auto;padding:0 16px}
h1{font-size:22px;margin:0 0 8px} h2{font-size:17px;margin:18px 0 6px;border-bottom:2px solid #0b6bcb;padding-bottom:2px} ul{margin:4px 0 8px 20px;padding:0} li{margin:3px 0}
.zone{border-radius:8px;padding:8px 12px;margin:8px 0} .yellow{background:#fff4cc;border:2px solid #e0b400} .red{background:#ffe0e0;border:2px solid #c62828}
table.log{border-collapse:collapse;width:100%} .log th,.log td{border:1px solid #888;padding:9px 6px;text-align:left} .log th{background:#eef3fa} .small{font-size:12px;color:#555}
.pb{page-break-before:always} .noprint button{font-size:15px;padding:6px 14px} @media print{.noprint{display:none} body{margin:0}}`;
  function page(o) {
    return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Heart failure: your plan at home</title><style>${CSS}</style></head><body>
<div class="noprint" style="text-align:right"><button onclick="window.print()">Print</button></div>${body(o)}</body></html>`;
  }
  const api = { body, page, CSS };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else window.CHFHandout = api;
})();
