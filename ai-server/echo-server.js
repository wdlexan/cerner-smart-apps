/* Echo report AI summary server - runs ONLY on your own computer.
   The Antibiotics tab ("AI summary (draft)" button) sends de-identified echo report text here;
   this server adds the API key and asks Claude for a structured summary.

   Start it (Node 18 or newer, no installs needed):
     Windows PowerShell:   $env:ANTHROPIC_API_KEY="sk-ant-..." ; node echo-server.js
     Mac / Linux:          ANTHROPIC_API_KEY=sk-ant-... node echo-server.js
   Optional: CLAUDE_MODEL (default claude-sonnet-5-5), PORT (default 7073).

   The key stays in this terminal. Never save it in a file or put it on GitHub.
   For sandbox / made-up patients only until Island Health approves an AI service. */
const http = require('http');

const PORT = Number(process.env.PORT || 7073);
const KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-5-5';
const ALLOWED_ORIGINS = [/^https:\/\/wdlexan\.github\.io$/, /^http:\/\/localhost(:\d+)?$/, /^http:\/\/127\.0\.0\.1(:\d+)?$/, /^null$/];

if (!KEY) { console.error('Set ANTHROPIC_API_KEY in this terminal first (see the top of this file).'); process.exit(1); }

const SYSTEM = `You summarise echocardiogram reports for a hospital physician who is managing a patient with bacteremia.
Use ONLY the report text you are given. Never add findings that are not written in it.
Return ONLY a JSON object, no other text, with exactly these keys:
{
  "summary": "2-3 sentences in plain clinical language",
  "endocarditis": "one sentence: are vegetations, abscess, perforation, new valve dysfunction or prosthetic dehiscence described, excluded, or not mentioned; note if this is a TTE (which cannot exclude endocarditis)",
  "findings": [ { "label": "short name, e.g. LVEF, Vegetation, Aortic stenosis", "value": "short value, e.g. 55-60%, none seen, moderate", "quote": "the exact words from the report that support this, copied verbatim" } ],
  "limitations": [ "image quality limits, comparisons not available, anything unclear or contradictory in the report" ]
}
Include LVEF, vegetation, abscess, each valve lesion that is mild or worse, prosthetic valves, RV function, RVSP and pericardial effusion when they are mentioned.
Every "quote" must be copied exactly from the report. If something is not mentioned, say "not mentioned" and use an empty quote.
This is a draft for physician review, not a diagnosis.`;

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
  if (req.method !== 'POST' || req.url !== '/echo') return send(res, 404, { error: 'POST /echo only' });
  let body = '';
  req.on('data', (c) => { body += c; if (body.length > 200000) req.destroy(); });
  req.on('end', async () => {
    let text;
    try { text = String(JSON.parse(body).text || '').slice(0, 60000); } catch (e) { return send(res, 400, { error: 'bad JSON' }); }
    if (text.length < 20) return send(res, 400, { error: 'no report text' });
    try {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({ model: MODEL, max_tokens: 1500, system: SYSTEM,
          messages: [{ role: 'user', content: 'Echocardiogram report:\n"""\n' + text + '\n"""' }] })
      });
      const j = await r.json();
      if (!r.ok) return send(res, 502, { error: (j.error && j.error.message) || ('AI service HTTP ' + r.status) });
      const out = (j.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('');
      const m = out.match(/\{[\s\S]*\}/);
      if (!m) return send(res, 502, { error: 'AI did not return JSON' });
      const parsed = JSON.parse(m[0]);
      console.log(new Date().toLocaleTimeString(), 'echo summary sent (' + text.length + ' chars in)');
      send(res, 200, parsed);
    } catch (e) { send(res, 502, { error: e.message }); }
  });
}).listen(PORT, '127.0.0.1', () => console.log('Echo AI server on http://localhost:' + PORT + '/echo  (model ' + MODEL + ')  - Ctrl+C to stop'));
