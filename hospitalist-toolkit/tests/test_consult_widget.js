/* node tests/test_consult_widget.js - shared consult message builder */
global.window = {};
require("../consult-widget.js");
const B = window.ConsultWidget.build;
let fail = 0; const ok = (n, c, x) => { if (!c) fail++; console.log((c ? "ok   " : "FAIL ") + n + (!c && x !== undefined ? " | " + JSON.stringify(x) : "")); };
let m = B({ dr: "Singh", service: "Nephrology", name: "Alma TEST", age: 81, sex: "female", mrn: "TEST0001", problem: "AKI on CKD 3b", hx: "Creatinine 150 to 410 over 3 days despite fluids, potassium 6.1", why: "possible need for dialysis" });
ok("format", /^Hello Dr\. Singh,\n\nThis is Wayne, hospitalist\. I have Alma TEST, 81, MRN TEST0001, a woman with AKI on CKD 3b\. Creatinine 150 to 410 over 3 days despite fluids, potassium 6\.1\. Could you see her to assess possible need for dialysis\?\n\nYour help is much appreciated\.\n\nThanks,\nWayne$/.test(m.text), m.text);
ok("about 50 words", m.words <= 60, m.words);
m = B({ service: "Infectious diseases", sex: "male", problem: "S. aureus bacteremia", why: "Duration and need for TEE" });
ok("ID phrasing: 'for advice on'", /Could you see him for advice on duration and need for TEE\?/.test(m.text), m.text);
ok("blanks", /Hello Dr\. ___/.test(m.text) && /I have ___, MRN ___/.test(m.text), m.text);
m = B({ service: "General surgery", sex: "female", problem: "possible ischemic bowel", why: "Assess for laparotomy" });
ok("no article before 'possible'; 'to assess'", /a woman with possible ischemic bowel\. Could you see her to assess for laparotomy\?/.test(m.text), m.text);
console.log(fail ? `\n${fail} FAILED` : "\nall passed"); process.exit(fail ? 1 : 0);
