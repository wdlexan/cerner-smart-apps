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
// labs
const W = window.ConsultWidget, now = Date.now();
const ob = (name, v, unit, h, flag) => ({ resourceType: "Observation", status: "final", code: { text: name }, valueQuantity: { value: v, unit }, effectiveDateTime: new Date(now - h * 36e5).toISOString(), interpretation: flag ? [{ coding: [{ code: flag }] }] : [] });
const L = W.summarizeLabs([ob("Creatinine", 150, "umol/L", 72), ob("Creatinine", 410, "umol/L", 4, "H"), ob("Potassium", 6.1, "mmol/L", 4, "H"), ob("Sodium", 138, "mmol/L", 4), ob("Hemoglobin", 102, "g/L", 4), ob("Creatinine, urine", 9000, "umol/L", 4), ob("Hemoglobin A1c", 0.07, "", 4)]);
ok("labs: latest with previous, urine excluded", L.find((l) => l.key === "Cr").v === 410 && L.find((l) => l.key === "Cr").prev === 150 && L.filter((l) => l.key === "Cr").length === 1);
ok("labs: A1c not read as Hb", L.find((l) => l.key === "Hb").v === 102 && L.find((l) => l.key === "A1c"));
ok("labs: high flag kept", L.find((l) => l.key === "K").flag === "H");
const neph = L.filter((l) => W.PERTINENT.Nephrology.includes(l.key));
ok("nephrology picks Cr, K, Na not Hb", neph.map((l) => l.key).sort().join(",") === "Cr,K,Na", neph.map((l) => l.key));
ok("lab line", W.labLine(neph.filter((l) => l.key !== "Na")) === "Labs: Cr 410 (prev 150), K 6.1." || W.labLine(neph.filter((l) => l.key !== "Na")) === "Labs: K 6.1, Cr 410 (prev 150).", W.labLine(neph));
m = B({ dr: "Singh", service: "Nephrology", name: "Alma TEST", age: 81, sex: "female", mrn: "TEST0001", problem: "AKI", hx: "Oliguric despite fluids", labs: "Labs: Cr 410 (prev 150), K 6.1", why: "possible need for dialysis" });
ok("labs in message before the ask", /Oliguric despite fluids\. Labs: Cr 410 \(prev 150\), K 6\.1\. Could you see her/.test(m.text), m.text);
ok("still ~50 words", m.words <= 60, m.words);
m = B({ dr: "Lee", problem: "AKI", sig: "Dr. Example Name · MSP 00000 · cell 000-000-0000" });
ok("sign-off line under Thanks, Wayne", /Thanks,\nWayne\nDr\. Example Name · MSP 00000 · cell 000-000-0000$/.test(m.text), m.text);
ok("no sign-off when blank", /Thanks,\nWayne$/.test(B({}).text));
// specialist list + text link
const C = W.parseContacts("Smith | Infectious | 250-555-1234\nDr. Lee | nephrology | (250) 555 9876\n\nPatel | 2505550000");
ok("contacts parsed", C.length === 3 && C[0].service === "Infectious diseases" && C[1].name === "Lee" && C[1].service === "Nephrology" && C[2].cell === "2505550000" && C[2].service === "", C);
ok("iPhone sms link", W.smsLink("250-555-1234", "Hello Dr. Smith,\n\nThanks & bye", true) === "sms:+12505551234&body=Hello%20Dr.%20Smith%2C%0A%0AThanks%20%26%20bye", W.smsLink("250-555-1234", "Hello Dr. Smith,\n\nThanks & bye", true));
ok("android sms link", W.smsLink("+1 250 555 1234", "Hi", false) === "sms:+12505551234?body=Hi");
const V = W.parseVcards("BEGIN:VCARD\r\nVERSION:3.0\r\nN:Smith;Jane;;Dr.;\r\nFN:Dr. Jane Smith\r\nORG:VGH Infectious Diseases\r\nTEL;type=WORK:250-555-0000\r\nTEL;type=CELL;type=pref:(250) 555-1234\r\nEND:VCARD\r\nBEGIN:VCARD\r\nFN:Raj Patel\r\nitem1.TEL:250 555 9999\r\nNOTE:nephro\r\nEND:VCARD\r\nBEGIN:VCARD\r\nFN:No Phone\r\nEND:VCARD");
ok("vcard import: surname, cell preferred, service guessed", V.length === 2 && V[0].name === "Smith" && V[0].cell === "(250) 555-1234" && V[0].service === "Infectious diseases" && V[1].name === "Patel" && V[1].service === "Nephrology", V);
ok("imported line round-trips", W.parseContacts(W.contactLine(V[0]))[0].cell === "(250) 555-1234" && W.parseContacts(W.contactLine(V[0]))[0].service === "Infectious diseases");
// patients from the VGH list Excel (shared strings, as Excel saves it, plus inline strings, as the toolkit writes it)
const sst = '<sst><si><t>room</t></si><si><t>age</t></si><si><t>Smith, Ann</t></si><si><t>Urosepsis</t></si><si><t>pmhx: CKD3, AF on apixaban</t></si><si><t>ESBL E. coli; Cr up</t></si><si><t>MRN</t></si><si><t>Sex</t></si></sst>';
const sheet = '<sheetData><row r="1"><c r="D1" t="s"><v>0</v></c><c r="E1" t="s"><v>1</v></c><c r="T1" t="s"><v>6</v></c><c r="U1" t="s"><v>7</v></c></row>' +
  '<row r="2"><c r="A2" t="inlineStr"><is><t>S7B</t></is></c></row>' +
  '<row r="3"><c r="D3" t="inlineStr"><is><t>S7B 12</t></is></c><c r="E3"><v>81</v></c><c r="F3" t="s"><v>2</v></c><c r="H3" t="s"><v>3</v></c><c r="O3" t="s"><v>5</v></c><c r="T3"><v>12345</v></c><c r="U3" t="inlineStr"><is><t>F</t></is></c></row>' +
  '<row r="4"><c r="F4" t="s"><v>4</v></c><c r="O4" t="inlineStr"><is><t>delirium &amp; falls</t></is></c></row><row r="5"><c r="F5"/></row>' +
  '<row r="7"><c r="D7" t="inlineStr"><is><t>S7B 14</t></is></c><c r="E7"><v>67</v></c><c r="F7" t="inlineStr"><is><t>Jones, Bob</t></is></c></row></sheetData>';
const P = W.listPatients(W.readSheet(sheet, sst));
ok("excel: 2 patients, floor row skipped", P.length === 2, P);
ok("excel: name flipped, age, room, reason, MRN, sex", P[0].name === "Ann Smith" && P[0].age === "81" && P[0].room === "S7B 12" && P[0].reason === "Urosepsis" && P[0].mrn === "12345" && P[0].sex === "female", P[0]);
ok("excel: issues and pmhx from rows under the name", P[0].issues.join("|") === "ESBL E. coli; Cr up|delirium & falls" && P[0].pmhx[0] === "CKD3, AF on apixaban", P[0]);
ok("excel: second patient", P[1].name === "Bob Jones" && P[1].age === "67" && P[1].mrn === "");
console.log(fail ? `\n${fail} FAILED` : "\nall passed"); process.exit(fail ? 1 : 0);
