/* Second look: role-aware harm check for the Watch-ahead tab.
   1) Your role (MRP, consultant, co-managing) and the other service involved.
   2) Cognitive-bias prompts for that role, plus prompts triggered by the chart.
   3) "What's missing": abnormal values with no matching problem, drugs with no matching indication, role checklist.
   4) How to raise a concern with the other service without confrontation: script, escalation ladder, what to avoid.
   Pure logic, no network. Works in the browser (window.WASL) and in node (tests/test_secondlook.js).
   All wording is a DRAFT written by Claude from common teaching (CMPA team-communication guidance, TeamSTEPPS CUS/SBAR,
   diagnostic-error literature). UNVERIFIED: edit freely. */
(function (root) {
  const ROLES = {
    mrp:      { label: "I am the MRP", short: "MRP" },
    consult:  { label: "I was consulted", short: "consultant" },
    comanage: { label: "We are co-managing", short: "co-managing" }
  };

  // Other services. "friction" = where disagreements usually happen, used to tailor the script.
  const SERVICES = {
    ortho:    { label: "Orthopedics", friction: ["Time to OR (aim within 48 h) vs. optimizing first", "Being asked to 'clear' the patient", "Anticoagulant and antiplatelet holds", "Post-op delirium, pain, hemoglobin and transfusion thresholds", "Weight-bearing status and mobilization"] },
    gensurg:  { label: "General surgery", friction: ["Who manages post-op medical problems", "Ileus, fluids and electrolytes", "Glucose while NPO", "Timing of return to OR or imaging"] },
    cardio:   { label: "Cardiology", friction: ["Timing of angiography or echo", "Anticoagulation and antiplatelet plans", "Rate vs. rhythm control", "Who titrates heart failure drugs"] },
    nephro:   { label: "Nephrology", friction: ["Timing of dialysis", "Contrast decisions", "Fluid targets", "Renal dosing"] },
    icu:      { label: "ICU / critical care", friction: ["Transfer criteria and 'too sick for the ward'", "Goals of care before escalation", "Step-down timing"] },
    ed:       { label: "Emergency department", friction: ["The admitting diagnosis label", "Disposition and admission criteria", "Work-up already done vs. still needed"] },
    onc:      { label: "Oncology / hematology", friction: ["Goals of care and prognosis", "Toxicity vs. progression", "Transfusion and growth-factor plans"] },
    psych:    { label: "Psychiatry", friction: ["Medical vs. psychiatric cause (delirium?)", "Capacity", "Sedating medications and QT"] },
    neuro:    { label: "Neurology", friction: ["Imaging timing", "Antithrombotic start dates", "Delirium vs. new neurological event"] },
    gi:       { label: "Gastroenterology", friction: ["Endoscopy timing", "Anticoagulation holds and restarts", "Who follows the hemoglobin"] },
    id:       { label: "Infectious diseases", friction: ["Antibiotic choice and duration", "Source control", "IV-to-oral switch"] },
    palliative: { label: "Palliative care", friction: ["Goals of care conversations", "Symptom drugs and sedation", "Who leads family meetings"] },
    other:    { label: "Other service", friction: ["Who owns which problem", "Timing of tests or procedures"] }
  };

  const SITUATIONS = {
    reasoning:   "I want to understand their reasoning",
    disagree:    "I disagree with the plan or recommendation",
    notActioned: "A recommendation or request isn't being acted on",
    urgent:      "I'm worried about the patient right now",
    clearance:   "I'm being asked to 'clear' or call the patient 'stable'",
    ownership:   "It's unclear who owns a problem"
  };

  // ---------- 1) bias prompts ----------
  const BASE_BIAS = [
    ["Anchoring", "What was the first diagnosis offered (ED, referral, handover)? What would I expect to see if it were wrong?"],
    ["Premature closure", "Have I named at least two other possibilities, including one I can't afford to miss?"],
    ["Diagnostic momentum", "Has a label been copied forward note after note without anyone re-testing it?"],
    ["Attribution to a known condition", "Am I blaming dementia, alcohol, anxiety, frailty or 'chronic' disease for something new?"]
  ];
  const ROLE_BIAS = {
    mrp: [
      ["Not improving", "If the patient isn't better by day 2-3, re-take the history and re-examine rather than add another test."],
      ["Framing", "Labels like 'social admit', 'frequent flyer' or 'failure to cope' lower everyone's vigilance. Is there a medical cause?"],
      ["Outsourcing to the consultant", "Am I assuming the specialist is thinking about the whole patient? They usually answer only the question asked."]
    ],
    consult: [
      ["Framing by the consult question", "The question shapes the answer. Read the primary data yourself, not only the referral summary."],
      ["Answer the question, then the one not asked", "Is there something outside the question that could harm the patient? Say it, clearly labelled as additional."],
      ["Scope creep vs. silence", "Be clear which recommendations you will act on and which the primary team should own."]
    ],
    comanage: [
      ["Diffusion of responsibility", "Each team may assume the other ordered, checked or told the family. Name an owner for each problem."],
      ["Handoff gaps", "Nights and weekends: does the covering person know who to call for which problem?"],
      ["Two plans", "Are both teams' notes saying the same thing? Conflicting plans confuse nursing and the family."]
    ]
  };

  function biasPrompts(role, f, cards, dxTitles) {
    const out = BASE_BIAS.concat(ROLE_BIAS[role] || []).map(([trap, ask]) => ({ trap, ask, from: "" }));
    if (!f) return out;
    const titles = (cards || []).filter((c) => c.sev === "high" || c.sev === "med").map((c) => c.title);
    if (titles.length && dxTitles && dxTitles.length)
      out.push({ trap: "Does the data fit", ask: `Working diagnoses: ${dxTitles.join(", ")}. Which of these chart flags does it NOT explain: ${titles.join("; ")}?`, from: "chart" });
    else if (titles.length)
      out.push({ trap: "Does the data fit", ask: `No diagnosis is ticked below. Which working diagnosis explains these flags: ${titles.join("; ")}?`, from: "chart" });
    if (f.age != null && f.age >= 75)
      out.push({ trap: "Atypical presentation", ask: "Age 75 or older: infection, ACS, abdominal catastrophe and drug toxicity often present as confusion, falls or 'off legs'.", from: "chart" });
    if ((f.conditions || []).length >= 8)
      out.push({ trap: "Long problem list", ask: `${f.conditions.length} active problems. Which are old, which are this admission's, and is anything new hidden among them?`, from: "chart" });
    return out;
  }

  // ---------- 2) what's missing ----------
  const has = (f, re) => (f.conditions || []).some((c) => re.test(c));
  const med = (f, k) => (f.meds && f.meds[k] && f.meds[k].length ? f.meds[k] : null);
  const val = (f, k) => (f.values && f.values[k] != null && (f.useOld || !(f.stale && f.stale[k])) ? f.values[k] : null);
  const src = (f, k) => (f.source && f.source[k]) || "";

  // [value key, test, problem-list regex, text]
  const UNEXPLAINED = [
    ["na", (v) => v < 133, /hyponat|SIADH|sodium/i, "Low sodium with no hyponatremia on the problem list"],
    ["na", (v) => v > 147, /hypernat|sodium|dehydrat/i, "High sodium with no matching problem"],
    ["k", (v) => v < 3.3, /hypokal|potassium/i, "Low potassium with no matching problem"],
    ["hgb", (v) => v < 100, /anemi|anaemi|bleed|hemorrh|haemorrh|GI bleed|melena|myelo|thalass/i, "Low hemoglobin with no anemia or bleeding on the problem list"],
    ["plt", (v) => v < 100, /thrombocytop|platelet|ITP|HIT|cirrho|myelo|leuk|lymphom/i, "Low platelets with no matching problem"],
    ["wbc", (v) => v > 12, /infect|sepsis|pneumon|cellulit|UTI|pyelo|abscess|osteomyel|leuk|cholang|cholecyst|colitis|endocard|meningit/i, "High white count with no infection or blood disorder on the problem list"],
    ["glucose", (v) => v > 15, /diabet|DM\b|hyperglyc/i, "Glucose over 15 with no diabetes on the problem list"],
    ["inr", (v) => v > 1.5, /cirrho|liver|hepat|coagulop|DIC|vitamin k/i, "INR over 1.5 with no anticoagulant or liver problem"],
    ["lactate", (v) => v > 2, /sepsis|shock|ischemi|ischaemi|seizure/i, "Lactate over 2 with no explanation on the problem list"],
    ["temp", (v) => v >= 38, /infect|sepsis|pneumon|cellulit|UTI|pyelo|abscess|osteomyel|fever|neutropen/i, "Fever with no infection on the problem list"]
  ];
  const NO_INDICATION = [
    ["anticoag", /atrial fib|\bAF\b|a\.?fib|flutter|DVT|deep vein|pulmonary embol|\bPE\b|thrombo|valve|mechanical|LV thromb|VTE/i, "Anticoagulant with no AF, VTE or valve on the problem list (if it is prophylaxis, fine; if treatment, the indication is missing)"],
    ["insulin", /diabet|hyperglyc|DKA|HHS|steroid/i, "Insulin with no diabetes on the problem list"],
    ["sulfonylurea", /diabet/i, "Sulfonylurea with no diabetes on the problem list"],
    ["antipsychotic", /schizo|bipolar|psychos|delirium|agitat|dementia|nausea/i, "Antipsychotic with no psychiatric problem or delirium documented"],
    ["digoxin", /atrial fib|\bAF\b|flutter|heart failure|HFrEF/i, "Digoxin with no AF or heart failure on the problem list"],
    ["antibiotic", /infect|sepsis|pneumon|cellulit|UTI|pyelo|abscess|osteomyel|endocard|colitis|prophyl|cholang|cholecyst|wound|bacter/i, "Antibiotic with no infection on the problem list: what is it for, and what is the stop date?"]
  ];

  function missing(f, role, cards) {
    const out = [];
    if (!f) return out;
    UNEXPLAINED.forEach(([k, test, re, text]) => {
      const v = val(f, k); if (v == null || !test(v)) return;
      if (k === "inr" && med(f, "anticoag")) return;
      if (k === "temp" && med(f, "antibiotic")) return;
      if (k === "wbc" && med(f, "steroid")) return; // steroids raise the white count
      if (!has(f, re)) out.push({ kind: "Unexplained result", text, from: src(f, k) });
    });
    if ((cards || []).some((c) => c.id === "aki") && !has(f, /kidney|renal|AKI|CKD|nephr/i))
      out.push({ kind: "Unexplained result", text: "Creatinine rising with no kidney injury on the problem list", from: src(f, "creat") });
    NO_INDICATION.forEach(([k, re, text]) => {
      const m = med(f, k); if (m && !has(f, re)) out.push({ kind: "Drug without a listed indication", text, from: m.slice(0, 3).join(", ") });
    });
    const notRead = ["creat", "hgb", "na", "k"].filter((k) => f.values && f.values[k] == null);
    if (notRead.length) out.push({ kind: "No recent result", text: "No recent value found for: " + notRead.map((k) => ({ creat: "creatinine", hgb: "hemoglobin", na: "sodium", k: "potassium" })[k]).join(", "), from: "" });
    return out;
  }

  // Manual checklist: things the chart can't show. Ticks are not saved.
  const CHECKS = {
    mrp: ["Every consult recommendation has been read and either done or answered", "Pending results and imaging have an owner", "Code status and goals of care are documented", "Each consultant knows the question I'm asking them", "Medication reconciliation done (home vs. hospital)"],
    consult: ["I've confirmed the consult question with the referring physician", "I reviewed the primary data myself (not only the referral)", "Recommendations are numbered, specific, and say who does what", "Urgent recommendations were given by phone, not only in the note", "Follow-up plan: when I'll see the patient again or when I'll sign off"],
    comanage: ["Each problem has a named owning team", "Night and weekend coverage know who to call for what", "One person updates the family, and both teams know who", "Both teams' notes say the same plan", "Discharge criteria agreed by both teams"]
  };
  const SERVICE_CHECKS = {
    ortho: ["Anticoagulant/antiplatelet hold and restart dates written down", "VTE prophylaxis plan after surgery", "Delirium screen and prevention in place", "Pain plan with opioid safety (age, kidneys, sedation)", "Weight-bearing status and mobilization plan known"],
    gensurg: ["Who replaces fluids and electrolytes is agreed", "Glucose plan while NPO", "Return-to-OR or imaging triggers are clear"],
    cardio: ["Antithrombotic plan agreed and written", "Who titrates heart failure drugs is named"],
    icu: ["Goals of care discussed before escalation", "Clear call-back criteria if the patient deteriorates"],
    ed: ["Admitting diagnosis re-tested against the data", "ED work-up results all reviewed"],
    onc: ["Goals of care and prognosis discussed", "Oncologist aware of admission and toxicities"],
    psych: ["Medical causes of the behaviour excluded (delirium?)", "Capacity question stated clearly"]
  };
  function checklist(role, service) { return (CHECKS[role] || []).concat(SERVICE_CHECKS[service] || []); }

  // ---------- 3) communication ----------
  const LADDER = [
    "Talk directly: phone or in person, physician to physician. Not by text, page or a note alone.",
    "Ask first, then state the concern: curiosity, then the facts, then what you need.",
    "If still worried, use CUS words: 'I'm concerned... I'm uncomfortable... This is a safety issue.' Repeat once (two-challenge rule).",
    "Still unresolved: involve the most senior physician on each side (attending to attending, or their staff).",
    "Then your division head / site medical lead. If the patient is in danger now: rapid response or ICU, and act.",
    "Document neutrally: facts, who you spoke with, the plan, and who agreed. No blame, no opinions about colleagues."
  ];
  const AVOID = [
    "'Why didn't you...?' (sounds like blame). Try 'Help me understand...'",
    "'Medically cleared' or 'stable for OR'. Say what was assessed and what the risks are.",
    "Disagreeing in front of the patient, family or a full team room",
    "Arguing by text, iMessage or chart note",
    "Words like 'obviously', 'clearly', 'just' or 'you should have'",
    "Writing about a disagreement in the chart before you've talked"
  ];

  function script(role, service, situation, fill) {
    fill = fill || {};
    const svc = (SERVICES[service] || SERVICES.other).label;
    const me = role === "consult" ? "the medicine consultant" : role === "comanage" ? "the hospitalist co-managing" : "the MRP";
    const pt = fill.patient || "[patient, room]";
    const concern = fill.concern || "[your concern in one sentence]";
    const ask = fill.ask || "[what you need from them]";
    const data = fill.data || "[2-3 key facts: vitals, labs, exam]";
    const open = `Hi, it's [name], ${me} for ${pt}. Do you have two minutes to talk about the plan?`;
    const S = {
      reasoning: [open, `I want to make sure I understand your thinking on ${concern}.`, "Can you walk me through how you're weighing it?", `What I'm seeing is ${data}. How does that fit with your plan?`, "That helps. Can we agree on what we'd each watch for, and when we'd re-talk?"],
      disagree: [open, "We both want the same thing for this patient, so I want to check something with you.", `My concern is ${concern}. What I'm seeing: ${data}.`, "Is there something you're seeing that I'm not?", `Would you be open to ${ask}? If not, what would change your mind, and when should we re-look together?`],
      notActioned: [open, `I wanted to follow up on ${concern}. I may have missed an update.`, `It matters because ${data}.`, `Is there a barrier I can help with, or should I ${ask}?`, "Can we agree on who does it and by when?"],
      urgent: [`Hi, it's [name], ${me} for ${pt}. I'm concerned and I need you to see this patient.`, `Situation: ${concern}.`, `Background and assessment: ${data}.`, `Request: ${ask}, within [time].`, "I'm uncomfortable waiting. This is a safety issue. If you can't come, who can?"],
      clearance: [open, "I can't 'clear' a patient, but I can tell you where we are and what the risks are.", `Assessed: ${data}.`, `The risks I'd want you and the anesthetist to know: ${concern}.`, `What I'd suggest before or after: ${ask}. Does that work with your timing?`],
      ownership: [open, `I want to make sure ${concern} doesn't fall between our teams.`, `Right now: ${data}.`, `My suggestion: ${ask}. Does that split work for you?`, "I'll write it in my note so nursing and the covering teams know who to call."]
    };
    return S[situation] || S.reasoning;
  }

  // SBAR text for a Teams message (non-urgent only). Urgent concerns must be a phone call.
  function sbar(role, service, fill) {
    fill = fill || {};
    const svc = (SERVICES[service] || SERVICES.other).label;
    return [
      `To ${svc}: ${fill.patient || "[patient, room]"}`,
      `S: ${fill.concern || "[concern in one sentence]"}`,
      `B: ${fill.background || "[relevant background]"}`,
      `A: ${fill.data || "[key data and your assessment]"}`,
      `R: ${fill.ask || "[what you're asking for, and by when]"}`,
      "Happy to talk by phone. [your name, callback number]"
    ].join("\n");
  }

  function asText(st) {
    const L = ["SECOND LOOK (draft; reflection aid, not a clinical decision)"];
    L.push(`Role: ${(ROLES[st.role] || ROLES.mrp).label}${st.service ? " · " + (SERVICES[st.service] || SERVICES.other).label : ""}${st.consulted && st.consulted.length ? " · consulted: " + st.consulted.map((k) => (SERVICES[k] || SERVICES.other).label).join(", ") : ""}`);
    if (st.question) L.push("Consult question: " + st.question);
    if (st.missing && st.missing.length) { L.push("", "Possibly missing:"); st.missing.forEach((m) => L.push(`- ${m.text}${m.from ? " [" + m.from + "]" : ""}`)); }
    if (st.unticked && st.unticked.length) { L.push("", "Not yet done:"); st.unticked.forEach((c) => L.push("- " + c)); }
    return L.join("\n");
  }

  const API = { ROLES, SERVICES, SITUATIONS, LADDER, AVOID, biasPrompts, missing, checklist, script, sbar, asText };
  if (typeof module !== "undefined" && module.exports) module.exports = API; else root.WASL = API;
})(typeof window !== "undefined" ? window : this);
