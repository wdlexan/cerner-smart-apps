
## 15. IBD: when to drain an abscess and when to involve a surgeon

Card in the IBD tab: "Hospitalist: when to drain an abscess and when to involve a surgeon" (ibd-flowsheet/surgery.js).
- Enter site, size (cm), access for drainage, sepsis and other features; it gives a drain / antibiotics / surgeon recommendation.
- Defaults: over 3 cm drain (percutaneous first), 2 to 3 cm grey zone, under 2 cm antibiotics usually; any perianal abscess drain promptly. Cut-offs are constants GRAY_CM and DRAIN_CM at the top of surgery.js.
- Lists: call the surgeon same day / involve early / planned referral, plus a before-surgery checklist.
- Source: Haas et al., UEG J 2022 (PMC9752265). The surgeon lists are general practice, UNVERIFIED. Verify before clinical use.
- Tests: node ibd-flowsheet/test_surgery.js
