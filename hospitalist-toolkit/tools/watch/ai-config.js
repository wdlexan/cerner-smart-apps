/* AI connection for the Watch-ahead AI draft. EDIT THIS FILE only.
   "" (empty) = the AI button shows a FIXED SAMPLE that is not about the patient. Nothing is sent anywhere.
   To use the AI server on your own computer, run  node watch-server.js  (see ai-server folder) and set:
       window.WA_AI_ENDPOINT = "http://localhost:7072/watch";
   NEVER put an API key in this file or in any file on GitHub. The key lives only in the terminal that runs the server.
   The page only sends data from made-up samples or the Cerner SANDBOX (see ai.js). Real chart data stays blocked until Island Health approves. */
window.WA_AI_ENDPOINT = "http://localhost:7072/watch";
