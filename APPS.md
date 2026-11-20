
## 15. IBD: when to drain an abscess and when to involve a surgeon

Card in the IBD tab: "Hospitalist: when to drain an abscess and when to involve a surgeon" (ibd-flowsheet/surgery.js).
- Enter site, size (cm), access for drainage, sepsis and other features; it gives a drain / antibiotics / surgeon recommendation.
- Defaults: over 3 cm drain (percutaneous first), 2 to 3 cm grey zone, under 2 cm antibiotics usually; any perianal abscess drain promptly. Cut-offs are constants GRAY_CM and DRAIN_CM at the top of surgery.js.
- Lists: call the surgeon same day / involve early / planned referral, plus a before-surgery checklist.
- Source: Haas et al., UEG J 2022 (PMC9752265). The surgeon lists are general practice, UNVERIFIED. Verify before clinical use.
- Tests: node ibd-flowsheet/test_surgery.js

## 16. IBD: CMV colitis card and albumin card

Two cards in the IBD tab (ibd-flowsheet/labcards.js), UNVERIFIED drafts from general knowledge (ECCO opportunistic infections guidance, AGA/ACG UC). Verify before clinical use.
- CMV: when to suspect (steroid-refractory UC, thiopurine, deep ulcers), biopsy with IHC, how to read low versus high density, ganciclovir outline, what to do with immunosuppression and the surgeon. Shows any CMV result already in the chart.
- Albumin: fills from the chart; explains severity (under 30 g/L), anti-TNF clearance, protein-bound drugs, corrected calcium calculator, VTE and surgery risk, nutrition.
- Tests: node ibd-flowsheet/test_labcards.js

## 17. IBD: Crohn disease outside the gut (extraintestinal manifestations)

Card in the IBD tab (ibd-flowsheet/eim.js): eye, skin and mouth, joints and spine, liver and biliary, kidney, bone and nutrition, clots, heart, nerves. Each item says what it looks like, what to do, urgency (same day / this admission / routine) and whether it tracks the gut. Includes a "do not miss" box, the user's "pearls for hospitalists", and a search box. UNVERIFIED draft from general knowledge (ECCO consensus); the pearls' original reference numbers were not supplied. Tests: node ibd-flowsheet/test_eim.js

## 18. IBD: VTE prophylaxis card

Card in the IBD tab (ibd-flowsheet/vte.js): who gets prophylaxis (every admitted flare, rectal bleeding is not a reason to hold), start timing, agent and typical dose (enoxaparin 40 mg daily; UFH or 30 mg if CrCl under 30; obesity note), when to hold (severe bleeding, platelets under 50), and duration (until discharge and mobile; about 28 days after major abdominal or pelvic surgery, often extended after UC colectomy). Platelets fill from the chart. UNVERIFIED draft from general knowledge: confirm with local protocol and pharmacy. Tests: node ibd-flowsheet/test_vte.js

## 19. Autoimmune serology interpreter

Standalone app in autoimmune-serology/ (launch.html, index.html, app.js, engine.js, demo.js). Reads ANA titre and pattern, ENA (dsDNA, Sm, RNP, Ro, La, Scl-70, centromere, RNA pol III, histone), myositis antibodies, ANCA (IIF, PR3, MPO), anti-GBM, RF, anti-CCP, C3/C4/CH50, antiphospholipid antibodies, cryoglobulins, AMA/ASMA/LKM, HLA-B27 and supporting labs from the chart (matched by test name); every result can be entered or overridden.
- Scores SLE (2019 EULAR/ACR), RA (2010), Sjögren (2016), SSc (2013), GPA/MPA/EGPA (2022) plus drug-induced lupus, MCTD, myositis/antisynthetase, anti-GBM, APS, cryoglobulinemia, PBC/AIH, SpA, PMR/GCA, with ✓/✗/? lines.
- ANA, complement and ANCA pattern boxes; red flags (RPGN, pulmonary-renal, scleroderma renal crisis, MDA5, GCA, lupus nephritis); medication checks (DIL/ANCA drugs, anticoagulants and lupus anticoagulant, statins and HMGCR); next tests; note draft; consult message.
- Seven made-up cases: index.html?demo=sle|mpa|ra|dil|lowana|cryo|ssc
- Classification criteria are research tools; UNVERIFIED draft from general knowledge. Verify before clinical use.
- Also a toolkit tab: "Autoimmune serology" (hospitalist-toolkit/tools/serology/, key sero, open with #sero); consult button defaults to Rheumatology. Made-up cases are in the standalone app only.
- Made-up PDF patients (10): autoimmune-serology/make-test-pdfs.py writes autoimmune-serology/test-pdfs/; copies are in hospitalist-toolkit/sample-pdfs/Autoimmune serology/ (Import PDF > Load a made-up test patient). Grace SLE nephritis, Harold MPA/RPGN, Ian GPA, Joan RA (shows "possible" until the joint count is ticked), Kenneth hydralazine lupus, Muriel low-titre DFS70 ANA, Norman HCV cryoglobulinemia, Olivia scleroderma renal crisis, Paul antisynthetase, Rachel triple-positive APS.
- PDF importer (pdf-extract.js) now reads ANA titre/pattern, ENA, ANCA, PR3/MPO, anti-GBM, RF, anti-CCP, C3/C4, antiphospholipid, cryoglobulins, AMA/ASMA, HLA-B27, DAT, and problem-list entries such as Raynaud, ILD, glomerulonephritis, purpura, malar rash. Tests: node hospitalist-toolkit/tests/test_serology_pdfs.js
- Section headings are collapsible (clinical-feature groups, lab table groups, summary/next-test/note/reference boxes, condition cards), with Expand all / Collapse all; open/closed state is remembered in the browser (localStorage "sero-open").
- "Which test?" tab (order-guide.js): type a disease (synonyms/abbreviations, e.g. PBC, primary biliary cirrhosis, Wegener) to get Order first / Then / Also consider lists with a note and a Copy order list button; typing a test name lists the conditions that use it; ✓ shows results already in the chart. 50 conditions (CTD, myositis, vasculitis, APS, heme, liver/GI, SpA, kidney, endocrine, neuro). UNVERIFIED draft from general knowledge.
- Each condition card shows its diagnostic/classification criteria as a live checklist (criteria.js): lab items fill from results, clinical items are checkboxes shared with the Clinical features tab, points and threshold update as you tick. Sets: SLE 2019, RA 2010, Sjögren 2016, SSc 2013, MCTD Alarcón-Segovia, Bohan & Peter + Connors, GPA/MPA/EGPA 2022, anti-GBM (KDIGO), APS revised Sapporo, cryo (Quartuccio), PBC 2 of 3 + AIH simplified, ASAS axial SpA, PMR 2012 + GCA 2022; drug-induced lupus as supportive features. Tests: node hospitalist-toolkit/tests/test_serology_criteria.js
