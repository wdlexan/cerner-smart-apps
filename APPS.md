
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
