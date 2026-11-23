/* Wound photo review server - runs ONLY on your own computer.
   The Wound care tab ("Review photo" sub-tab) sends a de-identified wound photo (re-encoded in the browser,
   so camera metadata such as GPS and time are removed) plus optional bedside notes here;
   this server adds the API key and asks Claude to describe the wound and suggest a dressing category.

   Start it (Node 18 or newer, no installs needed):
     Windows PowerShell:   $env:ANTHROPIC_API_KEY="sk-ant-..." ; node wound-server.js
     Mac / Linux:          ANTHROPIC_API_KEY=sk-ant-... node wound-server.js
   Optional: CLAUDE_MODEL (default claude-sonnet-5-5), PORT (default 7074).

   The key stays in this terminal. Never save it in a file or put it on GitHub.
   For sandbox / made-up / teaching photos only until Island Health approves an AI service for patient images.
   Nothing is saved: the photo is held in memory for the one request and then discarded. */
const http = require('http');

const PORT = Number(process.env.PORT || 7074);
const KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-5-5';
const ALLOWED_ORIGINS = [/^https:\/\/wdlexan\.github\.io$/, /^http:\/\/localhost(:\d+)?$/, /^http:\/\/127\.0\.0\.1(:\d+)?$/, /^null$/];

if (!KEY) { console.error('Set ANTHROPIC_API_KEY in this terminal first (see the top of this file).'); process.exit(1); }

const SYSTEM = `You help a hospital physician describe a wound photo and choose a dressing CATEGORY (not a brand).
Describe only what is visible in the photo plus what the bedside notes state. Never invent depth, odour, warmth, pain,
probe-to-bone or perfusion findings: a photo cannot show them. Do not describe or mention anything that could identify
the person (face, tattoos, jewellery, labels, wristbands, room details). If the image is not a wound, or is too blurred,
dark or cropped to judge, say so in "image_quality", set "wound_visible" to false and use "unknown" values.
Colour in photos is unreliable (lighting, camera, skin tone): lower your confidence when tissue colour is ambiguous,
and note that erythema and deep tissue injury are harder to see on darker skin.

Return ONLY a JSON object, no other text, with exactly these keys and allowed values:
{
  "wound_visible": true | false,
  "image_quality": "one short sentence",
  "description": "2-3 sentences: location if evident, size if a ruler is visible, wound bed, edges, periwound",
  "tissue": { "granulation": 0-100, "slough": 0-100, "eschar": 0-100, "epithelial": 0-100, "necrosis_wet": 0-100 },
  "likely_type": "pi" | "dfu" | "venous" | "arterial" | "surgical" | "skintear" | "trauma" | "fungating" | "iad" | "iv" | "unknown",
  "type_reason": "one short sentence",
  "stage": "1" | "2" | "3" | "4" | "u" | "dti" | "na" | "unknown",
  "depth": "intact" | "superficial" | "full" | "cavity" | "unknown",
  "eschar_dry_stable": true | false | null,
  "exudate": "none" | "low" | "mod" | "heavy" | "unknown",
  "periwound": "ok" | "mac" | "fragile" | "unknown",
  "infection_signs": "none" | "local" | "deep" | "unknown",
  "infection_reason": "which visible signs (e.g. friable red granulation, purulence, spreading erythema), or 'none visible'",
  "bleeding": true | false,
  "odour": true | false | null,
  "probes_to_bone": true | false | null,
  "concerns": [ "urgent or important things to act on, e.g. possible necrotizing infection, exposed bone, wet gangrene" ],
  "cannot_assess": [ "what the photo cannot show and should be checked at the bedside" ],
  "dressing": { "primary": "dressing category", "secondary": "category or none", "change": "frequency", "avoid": "categories to avoid and why" },
  "confidence": "low" | "moderate" | "high"
}
Tissue percentages should add up to about 100 (use 0 for absent). "stage" applies to pressure injuries only; otherwise "na".
"odour" and "probes_to_bone" come ONLY from the bedside notes; use null when the notes do not say.
Dressing choice follows moist wound healing and wound bed preparation: match absorbency to exudate, fill cavities loosely,
autolytic debridement for slough, keep dry stable heel or ischemic eschar dry, antimicrobial dressings only for local infection
(2-week challenge), no hydrocolloid on diabetic foot ulcers or infected wounds.
This is a draft for physician and wound clinician review, not a diagnosis.`;

function cors(req, res) {
  const o = req.headers.origin || '';
  if (ALLOWED_ORIGINS.some((r) => r.test(o))) res.setHeader('Access-Control-Allow-Origin', o);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Private-Network', 'true');   // lets an https page call localhost in Chrome
}
const send = (res, code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); };

http.createServer(async (req, res) => {
  cors(req, res);
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  if (req.method !== 'POST' || req.url !== '/wound') return send(res, 404, { error: 'POST /wound only' });
  let body = '';
  req.on('data', (c) => { body += c; if (body.length > 8000000) { send(res, 413, { error: 'photo too large' }); req.destroy(); } });
  req.on('end', async () => {
    let image, notes;
    try { const j = JSON.parse(body); image = String(j.image || ''); notes = String(j.notes || '').slice(0, 2000); }
    catch (e) { return send(res, 400, { error: 'bad JSON' }); }
    const m = image.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
    if (!m) return send(res, 400, { error: 'no photo (expected a JPEG/PNG/WebP data URL)' });
    try {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({ model: MODEL, max_tokens: 1500, system: SYSTEM,
          messages: [{ role: 'user', content: [
            { type: 'image', source: { type: 'base64', media_type: m[1], data: m[2] } },
            { type: 'text', text: 'Bedside notes from the physician (may be empty):\n"""\n' + (notes || '(none)') + '\n"""\nReturn the JSON object only.' }
          ] }] })
      });
      const j = await r.json();
      if (!r.ok) return send(res, 502, { error: (j.error && j.error.message) || ('AI service HTTP ' + r.status) });
      const out = (j.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('');
      const jm = out.match(/\{[\s\S]*\}/);
      if (!jm) return send(res, 502, { error: 'AI did not return JSON' });
      const parsed = JSON.parse(jm[0]);
      console.log(new Date().toLocaleTimeString(), 'wound photo reviewed (' + Math.round(m[2].length * 0.75 / 1024) + ' KB in)');
      send(res, 200, parsed);
    } catch (e) { send(res, 502, { error: e.message }); }
  });
}).listen(PORT, '127.0.0.1', () => console.log('Wound photo AI server on http://localhost:' + PORT + '/wound  (model ' + MODEL + ')  - Ctrl+C to stop'));
