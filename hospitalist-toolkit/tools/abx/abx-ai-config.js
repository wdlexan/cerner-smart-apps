/* AI connection for the echo report "AI summary (draft)" button. EDIT THIS FILE only.
   "" (empty) = the button shows a FIXED SAMPLE that is not about the patient. Nothing is sent anywhere.
   To use the AI server on your own computer, run  node echo-server.js  (ai-server folder in the repo) and set:
       window.ABX_AI_ENDPOINT = "http://localhost:7073/echo";
   NEVER put an API key in this file or any file on GitHub. The key lives only in the terminal that runs the server.
   The page only sends text from made-up samples or the Cerner SANDBOX, after removing identifiers and
   showing you exactly what will be sent. Real chart data stays blocked until Island Health approves. */
window.ABX_AI_ENDPOINT = "http://localhost:7073/echo";
