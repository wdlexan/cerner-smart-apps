/* node tests/test_plist.js  - Patient list (screenshot) tab. Made-up patients only. */
const P = require("../tools/plist/parse.js");
let fail = 0;
const eq = (n, g, w) => { const o = JSON.stringify(g) === JSON.stringify(w); if (!o) fail++; console.log((o ? "ok   " : "FAIL ") + n + ": got " + JSON.stringify(g) + ", want " + JSON.stringify(w)); };

// OCR slips seen on real PowerChart screenshots
eq("$ for S", P.fixLocation("S7B-VGH $719 B"), "S7B-VGH S719 B");
eq("no space before bed", P.fixLocation("S6B-VGH S621B"), "S6B-VGH S621 B");
eq("run together", P.fixLocation("N7D-VGHN719B"), "N7D-VGH N719 B");
eq("544 = S4A", P.fixLocation("544-VGH S44H 1"), "S4A-VGH S4AH 1");
eq("SSA = S5A", P.fixLocation("VGH SSA S505P"), "VGH S5A S505 P");
eq("bed I read as 1", P.fixLocation("S7B-VGH $7221"), "S7B-VGH S722 I");
eq("bed & = A", P.fixLocation("S44-VGH S408 &"), "S4A-VGH S408 A");
eq("LOS lost decimal", P.fixLos("44 Days"), 4.4);
eq("room only S7B", P.roomOf("S7B-VGH S715 A"), "S715 A");
eq("room only VGH S5A", P.roomOf("VGH S5A S505 P"), "S505 P");
eq("room only HAH", P.roomOf("HAH-VGH HAH20 A"), "HAH20 A");
eq("room only RJH", P.roomOf("8SW-RJH S835 B"), "S835 B");
eq("room only S5B OCB", P.roomOf("VGH S5B S5BOCB 2"), "S5BOCB 2");
eq("LOS stuck to Days", P.fixLos("22.0Days _—"), 22);
eq("LOS stray o is not 0", P.fixLos("_— o"), null);
eq("LOS ok", P.fixLos("75.0"), 75);
eq("name icon junk", P.fixName("B){testman, Gary John"), "Testman, Gary John");
// floors
eq("floor S7B", P.floorOf("S7B-VGH S719 B"), "S7B");
eq("floor VGH S5A", P.floorOf("VGH S5A S505 P"), "S5A");
eq("floor RJH", P.floorOf("8SW-RJH S835 B"), "8SW (RJH)");
eq("floor HAH", P.floorOf("HAH-VGH HAH20 A"), "HAH");
const g = P.group([{ location: "HAH-VGH HAH1 A" }, { location: "N6D-VGH N620 C" }, { location: "S7B-VGH S722 A" }, { location: "S7B-VGH S715 A" }, { location: "8SW-RJH S835 B" }, { location: "S4A-VGH S402 A" }]);
eq("floor order", g.map((x) => x.floor), ["S4A", "S7B", "N6D", "8SW (RJH)", "HAH"]);
eq("room order in floor", g[1].patients.map((p) => p.location), ["S7B-VGH S715 A", "S7B-VGH S722 A"]);

// text line (fallback when the picture has no header row)
let r = P.parseLine("Testman, Alice Joy  S7B-VGH S719 B 79 years Female MEDHosp  6.3 Days  General weakness  Doe DR, John Q  92030000001 01234567");
eq("line name", r.name, "Testman, Alice Joy"); eq("line loc", r.location, "S7B-VGH S719 B"); eq("line age", r.age, 79); eq("line sex", r.sex, "F");
eq("line los", r.los, 6.3); eq("line reason", r.reason, "General weakness"); eq("line pcp", r.pcp, "Doe DR, John Q"); eq("line ids", [r.fin, r.mrn], ["92030000001", "01234567"]);
r = P.parseLine("Sample, Bo  S4A-VGH S408 A 68 years Male MEDHosp 5.9 Days Lower extremity pain 18-Nov-2026 17:30 PCT Roe DR, Jane 92030000002 07654321");
eq("discharged", r.discharged, "18-Nov-2026 17:30"); eq("dc reason", r.reason, "Lower extremity pain");
r = P.parseLine("Sample, Cy  S7B-VGH S722 I 76 years Female MEDHosp 55.2 Days Cholangitis Du Plessis DR, Ann 92030000003 01112223");
eq("two-word PCP surname", [r.reason, r.pcp], ["Cholangitis", "Du Plessis DR, Ann"]);
eq("header line skipped", P.parseLine("Name Location Age Sex Medical Service Length of Stay"), null);

// column reader: header positions decide the column; spill and merged header words
const W = (line, x, text, conf) => ({ line, x0: x, x1: x + text.length * 9, y0: line * 30, y1: line * 30 + 20, text, conf: conf == null ? 95 : conf });
const words = [
  W(0, 0, "Name"), W(0, 300, "|Location"), W(0, 480, "|Age"), W(0, 560, "|Sex"), W(0, 640, "|Medical"), W(0, 720, "Service|Length"), W(0, 940, "Visit"),
  W(0, 1200, "Reason"), W(0, 1300, "Discharged"), W(0, 1500, "Primary"), W(0, 1800, "FIN"), W(0, 1950, "MRN"),
  W(1, 5, "Sample,"), W(1, 75, "Dee"), W(1, 310, "VGH"), W(1, 350, "S5B"), W(1, 390, "S5BOCB"), W(1, 470, "2"), W(1, 500, "65"), W(1, 525, "years"),
  W(1, 570, "Female"), W(1, 650, "SORTH"), W(1, 860, "25.9"), W(1, 900, "Days"), W(1, 950, "Lower"), W(1, 1000, "leg", 40), W(1, 1305, "18-Nov-2026"), W(1, 1400, "10:10"),
  W(1, 1505, "Roe"), W(1, 1540, "DR,"), W(1, 1570, "Jane"), W(1, 1805, "920300000"), W(1, 1950, "0412345678"),
];
const rows = P.parseWords(words);
eq("cols: 1 row", rows.length, 1);
eq("cols: spill back to room", rows[0].location, "VGH S5B S5BOCB 2");
eq("cols: age", rows[0].age, 65); eq("cols: los from merged header", rows[0].los, 25.9);
eq("cols: discharged", rows[0].discharged, "18-Nov-2026 10:10"); eq("cols: FIN/MRN split", [rows[0].fin, rows[0].mrn], ["92030000004", "12345678"]);
eq("cols: low confidence flagged", rows[0].low, ["reason"]);
eq("no header -> null", P.parseWords(words.slice(12)), null);

// admit date from length of stay
eq("admit text", P.admitText({ los: 6.3 }, new Date(2026, 10, 19, 18, 55)), "13-Nov");
eq("admit from discharge", P.admitText({ los: 2, discharged: "18-Nov-2026 10:10" }, new Date(2026, 10, 19)), "16-Nov");
// merge keeps one copy per FIN
eq("merge", P.merge([{ fin: "1", name: "A" }], [{ fin: "1", name: "A" }, { fin: "2", name: "B" }]).length, 2);
const mm = P.merge([{ fin: "9", mrn: "", name: "Sample, Al", location: "HAH-VGH HAH20 A" }], [{ mrn: "123", name: "Sample, Al", location: "HAH20 A", admitted: "12-Nov-2026 14:49" }]);
eq("merge across layouts by name", [mm.length, mm[0].mrn, mm[0].admitted], [1, "123", "12-Nov-2026 14:49"]);

// Room + Bed layout (Hospital at Home list): Name | Room | Bed | DOB | Age | Sex | Medical Service | MRN | Visit Reason | Admitted | Length of Stay
eq("roomBed joined by OCR", P.roomBed("HAH25A", ""), "HAH25 A");
eq("roomBed", P.roomBed("HAH25", "A"), "HAH25 A");
eq("floor bare HAH room", P.floorOf("HAH25 A"), "HAH");
eq("floor bare VGH room", P.floorOf("S715 A"), "S7");
eq("room only stays", P.roomOf("HAH25 A"), "HAH25 A");
const W2 = (line, x, text) => ({ line, x0: x, x1: x + text.length * 9, y0: line * 30, y1: line * 30 + 20, text, conf: 95 });
const hah = P.parseWords([
  W2(0, 0, "Name"), W2(0, 250, "[Room"), W2(0, 330, "'Bed|DOB"), W2(0, 470, "lage"), W2(0, 560, "|sex"), W2(0, 640, "[Medical"), W2(0, 720, "Service|"), W2(0, 860, "MRN"),
  W2(0, 960, "|visit"), W2(0, 1010, "Reason"), W2(0, 1250, "Admitted"), W2(0, 1450, "|Length"),
  W2(1, 5, "Sample,"), W2(1, 75, "Ann"), W2(1, 255, "HAH25A"), W2(1, 360, "31-Mar-1946"), W2(1, 475, "80"), W2(1, 500, "years"), W2(1, 565, "Female"),
  W2(1, 645, "MEDHaH"), W2(1, 840, "01234567"), W2(1, 965, "Urinary"), W2(1, 1035, "retention"), W2(1, 1255, "17-Nov-2026"), W2(1, 1360, "11:41"), W2(1, 1410, "PCT"),
  W2(1, 1455, "2.4"), W2(1, 1490, "Days")]);
eq("HAH list: 1 row", hah.length, 1);
eq("no PCP column -> fp unknown", hah[0].hasPcpCol, false);
eq("HAH list fields", [hah[0].location, hah[0].floor, hah[0].age, hah[0].sex, hah[0].mrn, hah[0].reason, hah[0].admitted, hah[0].los],
   ["HAH25 A", "HAH", 80, "F", "01234567", "Urinary retention", "17-Nov-2026 11:41", 2.4]);
eq("admit date from Admitted column", P.admitText(hah[0], new Date(2026, 10, 30)), "17-Nov");


// Chart info (made-up note and banner text)
const C = require("../tools/plist/chart.js");
eq("eGFR CKD-EPI 2021 M 80 Cr 68", C.egfr(68, 80, "M"), 91);
eq("eGFR F 70 Cr 110", C.egfr(110, 70, "F"), 47);
const banner = "Alerts:\nPrecautions:\nMOST: C2 – ICU/Intub/CPR PRN, Ordered on: 01-NOV-2026\nAllergies: No Known Allergies\nCreatinine Level: 68 umol/L\nrivaroxaban 10 mg tab 10 mg 1 tab, oral, DAILY\nNS at 75 mL/hr";
let c = C.parse(banner, { age: 80, sex: "M" }).fields;
eq("banner fields", [c.most, c.allergy, c.gfr, c.vtep, c.iv, c.isolation], ["C2", "n", 91, "y", "NS 75 mL/h", undefined]);
eq("OCR typo anticoag", C.parse("apbxaban 2.5 mg tab").fields.vtep, "y");
eq("NKDA wide spacing", C.parse("Allergies:   No Known  Drug  Allergies").fields.allergy, "n");
eq("NKDA run together", C.parse("Allergies: NoKnown Drug Allergies").fields.allergy, "n");
eq("NKDA OCR 0", C.parse("No Kn0wn Drug Alleraies").fields.allergy, "n");
eq("NKDA short", C.parse("Allergies: NKDA").fields.allergy, "n");
eq("allergy both -> blank", C.parse("Allergies: penicillin\nNo Known Allergies").fields.allergy, undefined);
eq("allergy listed", C.parse("Allergies: penicillin (rash)").fields.allergy, "y");
eq("contact precautions", C.parse("On contact precautions for MRSA").fields.isolation, "contact");
const note = ["Past Medical History/Chronic Problems", "Ongoing", "Atrial fibrillation", "COPD", "Historical", "No problems recorded",
  "Assessment/Plan", "1. Pneumonia (community acquired)", "Ceftriaxone day 3. Repeat CXR in 6 weeks.", "2. Urinary retention",
  " Has a Foley in situ. Trial of void Friday plan.", "CHF", "  - Euvolemic, no changes", "Blood cultures pending", "Disposition", "Home with home care."].join("\n");
c = C.parse(note, { age: 70, sex: "F" }).fields;
eq("issues", c.issues, ["Pneumonia", "Urinary retention"]);
eq("pmhx", c.pmhx, "Atrial fibrillation, COPD");
eq("foley", c.foley, "y");
eq("todo", c.todo, ["Dispo: Home with home care", "Pneumonia: Repeat CXR in 6 weeks", "Urinary retention: Trial of void Friday plan", "CHF: Blood cultures pending"]);
eq("pending", c.lab, "Blood cultures pending");
eq("foley removed later", C.parse("Foley inserted Nov 2.\nFoley removed Nov 5, voiding.").fields.foley, "n");
eq("right patient by name", C.mentions("Mr. Testman is 70", { name: "Testman, Al" }), true);
eq("right patient by MRN", C.mentions("MRN:01234567", { name: "Testman, Al", mrn: "01234567" }), true);
eq("wrong patient", C.mentions("Mrs. Other, MRN:07654321", { name: "Testman, Al", mrn: "01234567" }), false);
const X0 = require("../tools/plist/xlsx.js");
eq("pmhx short one row", X0.halves("COPD, AF"), ["COPD, AF", ""]);
eq("pmhx long two rows", X0.halves("Cardiac Amyloidosis, DVT lower limb 2021, Iron defic anemia, Osteoporosis, UTI"), ["Cardiac Amyloidosis, DVT lower limb 2021", "Iron defic anemia, Osteoporosis, UTI"]);
eq("pmhx 3 lines", require("../tools/plist/xlsx.js").lines("Alpha disease, Beta disease, Gamma disease, Delta disease, Epsilon disease, Zeta disease, Eta disease, Theta disease, Iota", 3).length, 3);
eq("spread 3", X0.spread(["a", "b", "c"]), ["a", "b", "c"]);
eq("spread 5", X0.spread("a; b; c; d; e"), ["a; b", "c; d", "e"]);

// Excel: rows copied from the template, colour rules stretched
let JSZip = null; try { JSZip = require("jszip"); } catch (e) { try { JSZip = require("/opt/node-tools/node_modules/jszip"); } catch (e2) {} }
const done = () => { console.log(fail ? fail + " FAILED" : "all passed"); process.exit(fail ? 1 : 0); };
if (!JSZip) { console.log("skip Excel test (jszip not installed)"); done(); }
else {
  const X = require("../tools/plist/xlsx.js"), fs = require("fs");
  X.build(JSZip, fs.readFileSync(__dirname + "/../tools/plist/template.xlsx"), [
    { floor: "S7B", patients: [{ name: "Sample, Ann & Co", location: "S7B-VGH S715 A", age: 82, admit: "≈ 28-Oct (LOS 22 d)", reason: "Altered <LOC>", fp: "y",
      most: "C2", allergy: "n", gfr: 91, vtep: "y", issues: ["A", "B", "C", "D"], todo: ["t1"], pmhx: "COPD", mrn: "0012345", sex: "F" }] },
    { floor: "HAH", patients: [{ name: "Sample, Bo", location: "HAH-VGH HAH1 A", age: 35, admit: "", reason: "Abdominal pain", fp: "n" }] }], { spare: 1 })
    .then((u8) => JSZip.loadAsync(u8)).then((z) => z.file("xl/worksheets/sheet1.xml").async("string")).then((x) => {
      eq("rows written", (x.match(/<row /g) || []).length, 1 + 2 + 2 * 4 + 4);
      eq("floor in A2", /<c r="A2"[^>]*t="inlineStr"><is><t[^>]*>S7B<\/t>/.test(x), true);
      eq("name escaped in F3", x.includes("Sample, Ann &amp; Co") && x.includes("Altered &lt;LOC&gt;"), true);
      eq("age is a number", /<c r="E3"[^>]*><v>82<\/v><\/c>/.test(x), true);
      eq("pmhx row", /<c r="F4"[^>]*><is><t[^>]*>pmhx: COPD</.test(x), true);
      eq("MOST, gfr number", /<c r="I3"[^>]*><is><t[^>]*>C2</.test(x) && /<c r="K3"[^>]*><v>91<\/v>/.test(x), true);
      eq("issues over 4 rows", /<c r="O3"[^>]*><is><t[^>]*>A</.test(x) && /<c r="O6"[^>]*><is><t[^>]*>D</.test(x), true);
      eq("second floor at row 7", /<c r="A7"[^>]*><is><t[^>]*>HAH</.test(x), true);
      eq("dimension", /<dimension ref="A1:U15"\/>/.test(x), true);
      eq("mrn (leading zeros kept) and sex columns", /<c r="T1"[^>]*><is><t[^>]*>mrn</.test(x) && /<c r="U1"[^>]*><is><t[^>]*>sex</.test(x) && /<c r="T3"[^>]*><is><t[^>]*>0012345</.test(x) && /<c r="U3"[^>]*><is><t[^>]*>F</.test(x), true);
      global.window = global.window || {}; require("../consult-widget.js"); const cp = window.ConsultWidget.listPatients(window.ConsultWidget.readSheet(x, ""));
      eq("consult picker reads the file", cp.length >= 2 && cp[0].name === "Ann & Co Sample" && cp[0].mrn === "0012345" && cp[0].sex === "female" && cp[0].pmhx[0] === "COPD", true);
      eq("colour rules to last row", /sqref="K1:K15"/.test(x) && !/sqref="[^"]*H26/.test(x), true);
      return X.update(JSZip, fs.readFileSync(__dirname + "/../tools/plist/template.xlsx"), []).then(() => { throw new Error("blank template should be refused"); }, () => true)
        .then(() => X.build(JSZip, fs.readFileSync(__dirname + "/../tools/plist/template.xlsx"), [{ floor: "S7B", patients: [{ name: "SMITH, ANN", location: "S715 A", age: 82, todo: ["call daughter"] }] }], { spare: 1 }))
        .then((u8) => X.update(JSZip, u8, [{ floor: "S7B", patients: [{ name: "Smith, Ann", mrn: "0012", sex: "F" }, { name: "NEW, PAT", location: "S720 B", age: 60, mrn: "9", sex: "M" }] },
                                          { floor: "N6D", patients: [{ name: "FAR, AWAY", location: "N601 A", age: 40 }] }]))
        .then((r) => { eq("update: new patients added, existing only filled", r.added.join("|") + " / " + r.filled.join("|"), "NEW, PAT|FAR, AWAY / SMITH, ANN");
          return X.readList(JSZip, r.data); })
        .then((L) => { eq("update: typed to-do kept, mrn filled", /call daughter/.test(L.rows.find((r) => r.n === 3).xml) && L.patients[0].mrn === "0012", true);
          eq("update: new floor added at the end", L.floors.map((f) => f.name).join(","), "S7B,N6D");
          eq("update: patients and floors", L.patients.map((p) => p.floor + ":" + p.name).join("|"), "S7B:SMITH, ANN|S7B:NEW, PAT|N6D:FAR, AWAY");
          done(); });
    }).catch((e) => { fail++; console.log("FAIL excel: " + e.message); done(); });
}
