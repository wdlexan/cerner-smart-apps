/*
 * cw.js — Choosing Wisely tab for the hospitalist toolkit
 * SMART on FHIR (Oracle Health / Cerner Millennium R4)
 *
 * A daily checklist of Choosing Wisely Canada recommendations for one patient.
 * Each item shows Review / OK / Not applicable / Couldn't check, the evidence behind it,
 * a suggestion, and a link to the recommendation. Read-only: nothing is written to the chart.
 *
 * Usage (after FHIR.oauth2.ready()):
 *   CW.mount(document.getElementById('cw-tab'), client, { lookbackDays: 7 });
 * Options:
 *   lookbackDays  how far back to read notes, labs, orders (default 7)
 *   getNotes      async ({from, to}) => [{time, title, text}]  (reuse another tab's note loader)
 *   loader        async (from, to) => resources                 (demo/tests: replace FHIR loading)
 *   now           a fixed "now" (tests)
 *
 * Thresholds, drug lists and keywords are all in CONFIG / DRUGS / KEYWORDS below.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CW = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const HOUR = 3600 * 1000, DAY = 24 * HOUR;

  // ------------------------------------------------------------------
  // Configuration
  // ------------------------------------------------------------------
  const CONFIG = {
    lookbackDays: 7,
    olderAdultAge: 65,
    catheterReviewDays: 2,        // flag a catheter in place this many days or more
    telemetryReviewHours: 48,     // flag telemetry running this long or more
    asbFeverC: 38.0,              // a temperature at or above this counts as a symptom
    asbWindowHours: 48,           // look for fever/symptoms within this many hours of the culture
    labs: {
      minDays: 3,                 // daily results on at least this many of the last N days
      windowDays: 4,
      // "stable" = every value inside the range AND total change no more than maxChange
      tests: {
        hgb:   { label: 'Hemoglobin', unit: 'g/L',    low: 100, high: 170, maxChange: 10 },
        wbc:   { label: 'WBC',        unit: '×10⁹/L', low: 3.5, high: 11,  maxChange: 3 },
        plt:   { label: 'Platelets',  unit: '×10⁹/L', low: 140, high: 450, maxChange: 50 },
        na:    { label: 'Sodium',     unit: 'mmol/L', low: 133, high: 145, maxChange: 4 },
        k:     { label: 'Potassium',  unit: 'mmol/L', low: 3.5, high: 5.0, maxChange: 0.6 },
        creat: { label: 'Creatinine', unit: 'µmol/L', low: 40,  high: 120, maxChangePct: 15 }
      }
    },
    timeouts: { searchMs: 60000, notesMs: 60000, noteMs: 15000 },
    maxNotes: 25,
    // Site-specific codes found with a data check: { telemetry: ['system|code'], catheter: [...], codeStatus: [...] }
    extraCodes: {}
  };

  const LINKS = {
    hospital: 'https://choosingwiselycanada.org/recommendation/hospital-medicine/',
    csim: 'https://choosingwiselycanada.org/csim-releases-five-new-recommendations/',
    labs: 'https://choosingwiselycanada.org/wp-content/uploads/2022/10/Daily-Labs-.pdf',
    tube: 'https://choosingwiselycanada.org/toolkit/lose-the-tube/',
    ppi: 'https://choosingwiselycanada.org/wp-content/uploads/dlm_uploads/2025/06/CWC_Toolkit_AskWhyPPI1.pdf'
  };

  const LOINC = {
    hgb: ['718-7', '30313-1', '20509-6'], wbc: ['6690-2', '26464-8', '804-5'], plt: ['777-3', '26515-7'],
    na: ['2951-2', '2947-0'], k: ['2823-3', '6298-4'], creat: ['2160-0', '38483-4', '14682-9'],
    temp: ['8310-5', '8331-1', '8332-9', '8333-7', '8328-5'],
    fev1: ['20150-9'], fev1fvc: ['19926-5', '69405-9'], fvc: ['19868-9']
  };

  const DRUGS = {
    benzo: ['alprazolam', 'bromazepam', 'chlordiazepoxide', 'clobazam', 'clonazepam', 'clorazepate', 'diazepam',
      'flurazepam', 'lorazepam', 'midazolam', 'nitrazepam', 'oxazepam', 'temazepam', 'triazolam'],
    zdrug: ['zopiclone', 'eszopiclone', 'zolpidem', 'zaleplon'],
    antipsychotic: ['haloperidol', 'quetiapine', 'olanzapine', 'risperidone', 'aripiprazole', 'loxapine',
      'methotrimeprazine', 'chlorpromazine', 'ziprasidone', 'paliperidone', 'lurasidone', 'perphenazine'],
    sedHypnoticOther: ['trazodone', 'mirtazapine', 'diphenhydramine', 'hydroxyzine', 'doxylamine', 'dimenhydrinate',
      'promethazine', 'doxepin'],
    antibiotic: ['ciprofloxacin', 'levofloxacin', 'moxifloxacin', 'nitrofurantoin', 'fosfomycin', 'trimethoprim',
      'sulfamethoxazole', 'cephalexin', 'cefazolin', 'cefuroxime', 'cefixime', 'ceftriaxone', 'cefotaxime', 'ceftazidime',
      'cefepime', 'amoxicillin', 'ampicillin', 'piperacillin', 'meropenem', 'ertapenem', 'imipenem', 'gentamicin',
      'tobramycin', 'amikacin', 'doxycycline', 'vancomycin', 'clindamycin', 'azithromycin', 'clarithromycin',
      'metronidazole', 'linezolid', 'daptomycin', 'cloxacillin'],
    ppi: ['omeprazole', 'esomeprazole', 'lansoprazole', 'dexlansoprazole', 'pantoprazole', 'rabeprazole'],
    inhalerMaint: ['tiotropium', 'umeclidinium', 'glycopyrronium', 'glycopyrrolate', 'aclidinium', 'salmeterol',
      'formoterol', 'vilanterol', 'indacaterol', 'olodaterol', 'fluticasone', 'budesonide', 'beclomethasone',
      'mometasone', 'ciclesonide'],
    nsaid: ['ibuprofen', 'naproxen', 'diclofenac', 'celecoxib', 'meloxicam', 'ketorolac', 'indomethacin', 'ketoprofen'],
    anticoag: ['warfarin', 'apixaban', 'rivaroxaban', 'dabigatran', 'edoxaban', 'enoxaparin', 'dalteparin', 'tinzaparin', 'heparin'],
    antiplatelet: ['aspirin', 'acetylsalicylic', 'asa', 'clopidogrel', 'ticagrelor', 'prasugrel']
  };
  const BRANDS = {
    ativan: 'lorazepam', xanax: 'alprazolam', rivotril: 'clonazepam', restoril: 'temazepam', imovane: 'zopiclone',
    ambien: 'zolpidem', sublinox: 'zolpidem', seroquel: 'quetiapine', zyprexa: 'olanzapine', haldol: 'haloperidol',
    desyrel: 'trazodone', remeron: 'mirtazapine', benadryl: 'diphenhydramine', gravol: 'dimenhydrinate',
    cipro: 'ciprofloxacin', macrobid: 'nitrofurantoin', keflex: 'cephalexin', septra: 'sulfamethoxazole',
    bactrim: 'sulfamethoxazole', tazocin: 'piperacillin', 'pip-tazo': 'piperacillin',
    pantoloc: 'pantoprazole', tecta: 'pantoprazole', nexium: 'esomeprazole', losec: 'omeprazole', prevacid: 'lansoprazole',
    pariet: 'rabeprazole', dexilant: 'dexlansoprazole', spiriva: 'tiotropium', advair: 'fluticasone salmeterol',
    symbicort: 'budesonide formoterol', breo: 'fluticasone vilanterol', trelegy: 'fluticasone umeclidinium vilanterol',
    anoro: 'umeclidinium vilanterol', incruse: 'umeclidinium', flovent: 'fluticasone', pulmicort: 'budesonide',
    ultibro: 'indacaterol glycopyrronium', inspiolto: 'tiotropium olodaterol', eliquis: 'apixaban', xarelto: 'rivaroxaban',
    coumadin: 'warfarin', lovenox: 'enoxaparin', fragmin: 'dalteparin', plavix: 'clopidogrel', brilinta: 'ticagrelor'
  };
  // Short-acting rescue inhalers are not "maintenance"; budesonide nebules for croup etc. are rare in adults.

  const KEYWORDS = {
    catheter: /\b(?:foley|indwelling (?:urinary )?catheter|urinary catheter|in-?dwelling catheter|IDC)\b/i,
    catheterRemoved: /\b(?:foley|catheter|IDC)\b[^.\n]{0,40}\b(?:removed|discontinued|d\/?c'?d|taken out|pulled)\b|\b(?:removed|discontinued|d\/?c'?d)\b[^.\n]{0,20}\b(?:foley|catheter|IDC)\b/i,
    catheterReason: [
      [/\burinary retention\b|\bretention\b|\bbladder outlet\b|\bobstruct/i, 'urinary retention or obstruction'],
      [/\bstrict (?:i ?& ?o|intake and output|input and output)\b|\bhourly urine output\b|\bcritically ill\b/i, 'accurate urine output in a critically ill patient'],
      [/\b(?:sacral|perineal|stage (?:3|4|iii|iv)) (?:wound|ulcer|pressure injury)\b/i, 'healing sacral or perineal wound'],
      [/\bcomfort care\b|\bend of life\b|\bpalliative\b/i, 'comfort at end of life'],
      [/\bunstable spine\b|\bpelvic fracture\b|\bspinal precautions\b/i, 'prolonged immobilization'],
      [/\burolog|\bTURP\b|\bcystectomy\b|\bpost-?op(?:erative)?\b/i, 'perioperative or urological']
    ],
    telemetry: /\btelemetry\b|\btele\b(?! ?health)|\bcardiac monitor(?:ing)?\b|\bcontinuous ECG\b/i,
    telemetryOff: /\b(?:tele(?:metry)?|cardiac monitor(?:ing)?)\b[^.\n]{0,30}\b(?:discontinued|stopped|d\/?c'?d|off)\b|\boff (?:tele(?:metry)?|monitor)\b/i,
    urinarySymptoms: /\bdysuria\b|\burinary (?:frequency|urgency)\b|\bfrequency and urgency\b|\bsuprapubic (?:pain|tenderness)\b|\bflank pain\b|\bCVA tenderness\b|\bcostovertebral\b|\bpyelonephritis\b|\burosepsis\b|\bgross hematuria\b|\brigors?\b/i,
    asbExempt: /\bpregnan|\bkidney transplant\b|\brenal transplant\b|\bneutropeni|\b(?:TURP|cystoscopy|urologic(?:al)? procedure)\b/i,
    negation: /\b(?:no|not|denies|denied|without|negative for|nil|absent)\b[^.;:\n]{0,30}$/i,
    goalsDocumented: /\bgoals? of care\b|\bcode status\b|\bDNR\b|\bDNAR\b|\bfull code\b|\bno CPR\b|\bresuscitation status\b|\bmedical orders? for scope of treatment\b|\badvance (?:care plan|directive)\b|\bserious illness conversation\b/i,
    // BC MOST: case-sensitive so the everyday word "most" and spine levels like "C2 fracture" don't match.
    most: /\bMOST\b|\bMOST:? ?[MC][0-3]\b|\b[MC][0-3] (?:MOST|status)\b/,
    spirometry: /\bspirometry\b|\bPFTs?\b|\bpulmonary function (?:test|testing|studies)\b|\bFEV1\b/i,
    positiveCulture: /\b(?:>|≥|greater than)?\s*10\^?\s*[5-8]\b|\b10\s*[eE]\s*[5-8]\b|\b\d{2,3}[, ]?000\s*(?:cfu|CFU)|\bescherichia\b|\bE\.?\s?coli\b|\bklebsiella\b|\bproteus\b|\benterococcus\b|\bpseudomonas\b|\bstaphylococcus\b|\bstreptococcus\b|\bcitrobacter\b|\benterobacter\b|\bcandida\b|\bmorganella\b|\bserratia\b/i,
    negativeCulture: /\bno growth\b|\bmixed (?:flora|growth|organisms)\b|\bcontaminat|\bno significant growth\b|\b< ?10\^?\s*[3-7]\b|\bnormal (?:urogenital|skin) flora\b/i
  };

  const HIGH_RISK = [
    [/metasta|stage (?:iv|4)\b|advanced (?:cancer|malignancy)/i, 'metastatic or advanced cancer'],
    [/dementia|alzheimer|lewy body/i, 'dementia'],
    [/frail/i, 'frailty'],
    [/end[- ]stage (?:renal|kidney)|ESRD|ESKD|on (?:hemo)?dialysis|hemodialysis|peritoneal dialysis/i, 'end-stage kidney disease'],
    [/cirrhosis/i, 'cirrhosis'],
    [/heart failure/i, 'heart failure'],
    [/COPD|chronic obstructive/i, 'COPD'],
    [/ALS\b|amyotrophic|motor neuron disease|parkinson/i, 'progressive neurological disease']
  ];

  const PPI_INDICATIONS = [
    [/barrett/i, 'Barrett’s esophagus'],
    [/(?:erosive|reflux) esophagitis|esophagitis/i, 'esophagitis'],
    [/peptic ulcer|gastric ulcer|duodenal ulcer|\bPUD\b/i, 'peptic ulcer disease'],
    [/(?:upper )?(?:GI|gastrointestinal) (?:bleed|hemorrhage)|melena|hematemesis/i, 'GI bleed'],
    [/eosinophilic esophagitis/i, 'eosinophilic esophagitis'],
    [/zollinger/i, 'Zollinger-Ellison syndrome'],
    [/idiopathic pulmonary fibrosis|\bIPF\b/i, 'idiopathic pulmonary fibrosis'],
    [/\bGERD\b|gastro-?(?:o)?esophageal reflux|reflux/i, 'GERD (check whether long-term use is needed)'],
    [/non-?cardiac chest pain/i, 'non-cardiac chest pain'],
    [/helicobacter|H\.? ?pylori/i, 'H. pylori (treatment course)']
  ];

  // ------------------------------------------------------------------
  // Utilities
  // ------------------------------------------------------------------
  const lc = s => (s == null ? '' : String(s)).toLowerCase();
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const toTime = v => { const t = v ? Date.parse(v) : NaN; return isNaN(t) ? null : t; };
  const pad2 = n => String(n).padStart(2, '0');
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const fmtTime = t => { const d = new Date(t); return MONTHS[d.getMonth()] + ' ' + d.getDate() + ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes()); };
  const fmtDate = t => { const d = new Date(t); return MONTHS[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear(); };
  const round = (v, d = 0) => { const f = Math.pow(10, d); return Math.round(v * f) / f; };
  const fhirDate = t => new Date(t).toISOString().replace(/\.\d{3}Z$/, 'Z');
  const uniq = a => Array.from(new Set(a));
  const codings = cc => (cc && cc.coding) || [];
  const ccText = cc => !cc ? '' : (cc.text || (codings(cc).find(c => c.display) || {}).display || '');
  const days = ms => Math.floor(ms / DAY);
  const plural = (n, w) => n + ' ' + w + (n === 1 ? '' : 's');

  function wordRe(term) { return new RegExp('\\b' + term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b'); }
  const CLASS_RES = {};
  Object.keys(DRUGS).forEach(k => { CLASS_RES[k] = DRUGS[k].map(wordRe); });
  function normMed(name) {
    let n = lc(name);
    Object.keys(BRANDS).forEach(b => { n = n.replace(wordRe(b), BRANDS[b]); });
    return n;
  }
  function classesOf(norm) {
    const out = {};
    Object.keys(CLASS_RES).forEach(cls => {
      const hits = CLASS_RES[cls].map(re => (norm.match(re) || [])[0]).filter(Boolean);
      if (hits.length) out[cls] = uniq(hits);
    });
    return out;
  }
  function ageAt(birthDate, t) {
    const b = new Date(birthDate), d = new Date(t);
    let a = d.getFullYear() - b.getFullYear();
    if (d.getMonth() < b.getMonth() || (d.getMonth() === b.getMonth() && d.getDate() < b.getDate())) a--;
    return a;
  }
  function notNegated(text, idx) { return !KEYWORDS.negation.test(text.slice(Math.max(0, idx - 40), idx)); }
  function findInNotes(notes, re, opts) {
    opts = opts || {};
    const hits = [];
    for (const n of notes || []) {
      const t = n.text || '';
      const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
      let m;
      while ((m = g.exec(t))) {
        if (opts.allowNegated || notNegated(t, m.index)) {
          const s = Math.max(0, m.index - 50), e = Math.min(t.length, m.index + m[0].length + 60);
          hits.push({ time: n.time, title: n.title, match: m[0],
            excerpt: (s > 0 ? '…' : '') + t.slice(s, e).replace(/\s+/g, ' ').trim() + (e < t.length ? '…' : '') });
          break;
        }
        if (m.index === g.lastIndex) g.lastIndex++;
      }
    }
    return hits.sort((a, b) => a.time - b.time);
  }
  const quote = h => '“' + h.excerpt + '” (' + (h.title || 'note') + ', ' + fmtTime(h.time) + ')';

  // ------------------------------------------------------------------
  // Parsing
  // ------------------------------------------------------------------
  function kindOf(cc) {
    const cods = codings(cc);
    for (const kind of Object.keys(CONFIG.extraCodes || {})) {
      const list = CONFIG.extraCodes[kind] || [];
      if (cods.some(c => list.includes((c.system || '') + '|' + (c.code || '')) || list.includes(c.code))) return kind;
    }
    const loinc = cods.filter(c => !c.system || /loinc/i.test(c.system)).map(c => c.code);
    for (const k of Object.keys(LOINC)) if (loinc.some(code => LOINC[k].includes(code))) return k;
    const t = lc(ccText(cc) + ' ' + cods.map(c => c.display || '').join(' '));
    if (!t.trim()) return null;
    if (/urine culture|culture,? urine|urine c ?& ?s/.test(t)) return 'urineCulture';
    if (/\bfev1\s*\/\s*fvc|fev1\/fvc/.test(t)) return 'fev1fvc';
    if (/\bfev1\b/.test(t)) return 'fev1';
    if (/spirometry|pulmonary function/.test(t)) return 'spirometry';
    if (/code status|resuscitation status|scope of treatment|\bmost\b/.test(t)) return 'codeStatus';
    if (/telemetry|cardiac monitor/.test(t)) return 'telemetry';
    if (/urinary catheter|foley|indwelling catheter/.test(t)) return 'catheter';
    if (/temperature/.test(t)) return 'temp';
    if (/h(a)?emoglobin\b/.test(t) && !/a1c|glyc|urine|free/.test(t)) return 'hgb';
    if (/\bwbc\b|white blood cell|leukocyte/.test(t) && !/urine|esterase|csf/.test(t)) return 'wbc';
    if (/platelet/.test(t)) return 'plt';
    if (/\bsodium\b/.test(t) && !/urine/.test(t)) return 'na';
    if (/\bpotassium\b/.test(t) && !/urine/.test(t)) return 'k';
    if (/creatinine/.test(t) && !/urine|clearance|ratio|kinase/.test(t)) return 'creat';
    return null;
  }

  function obsValue(o) {
    if (o.valueQuantity && typeof o.valueQuantity.value === 'number') return { num: o.valueQuantity.value, unit: o.valueQuantity.unit || o.valueQuantity.code || '' };
    if (typeof o.valueInteger === 'number') return { num: o.valueInteger, unit: '' };
    if (typeof o.valueString === 'string') return { num: null, text: o.valueString };
    if (o.valueCodeableConcept) return { num: null, text: ccText(o.valueCodeableConcept) };
    if (typeof o.valueBoolean === 'boolean') return { num: null, text: o.valueBoolean ? 'yes' : 'no' };
    return { num: null, text: '' };
  }
  function toSI(kind, num, unit) {
    if (num == null) return null;
    const u = lc(unit).replace(/\s/g, '');
    if (kind === 'hgb' && (u.includes('g/dl') || (!u && num < 25))) return round(num * 10);
    if (kind === 'creat' && (u.includes('mg/dl') || (!u && num < 20))) return round(num * 88.42);
    if (kind === 'temp' && (/degf|\[degf\]|fahrenheit/.test(u) || num > 50)) return round((num - 32) * 5 / 9, 1);
    return num;
  }

  function parseObservations(list) {
    const out = [];
    for (const o of list || []) {
      if (!o || o.resourceType !== 'Observation' || ['entered-in-error', 'cancelled'].includes(o.status)) continue;
      const time = toTime(o.effectiveDateTime || (o.effectivePeriod && o.effectivePeriod.start) || o.issued);
      if (time == null) continue;
      const entries = (o.component && o.component.length) ? o.component.map(c => ({ cc: c.code, src: c })) : [];
      entries.unshift({ cc: o.code, src: o });
      for (const e of entries) {
        const kind = kindOf(e.cc);
        if (!kind) continue;
        const v = obsValue(e.src);
        const interp = (o.interpretation || []).map(ccText).join(' ');
        out.push({ kind, time, display: ccText(e.cc), value: toSI(kind, v.num, v.unit), text: [v.text, interp, o.note && o.note.map(n => n.text).join(' ')].filter(Boolean).join(' '), raw: o });
      }
    }
    return out.sort((a, b) => a.time - b.time);
  }

  function parseReports(list) {
    // DiagnosticReport: microbiology (urine culture), PFTs, and any other text we can scan.
    return (list || []).filter(r => r && r.resourceType === 'DiagnosticReport' && r.status !== 'entered-in-error').map(r => {
      const text = [r.conclusion, (r.conclusionCode || []).map(ccText).join(' '),
        (r.presentedForm || []).map(p => p.data ? b64decode(p.data) : '').map(stripHtml).join(' ')].filter(Boolean).join(' ');
      return { time: toTime(r.effectiveDateTime || (r.effectivePeriod && r.effectivePeriod.start) || r.issued),
        name: ccText(r.code), kind: kindOf(r.code), text };
    }).filter(r => r.time != null);
  }

  function parseMeds(list, admitTime) {
    return (list || []).filter(r => r && r.resourceType === 'MedicationRequest' && r.status === 'active').map(r => {
      const name = ccText(r.medicationCodeableConcept) || (r.medicationReference && r.medicationReference.display) || '';
      const norm = normMed(name);
      const di = r.dosageInstruction || [];
      const route = lc(di.map(d => ccText(d.route) + ' ' + (d.text || '')).join(' '));
      const authored = toTime(r.authoredOn);
      return { name, norm, classes: classesOf(norm), prn: di.some(d => d.asNeededBoolean || d.asNeededCodeableConcept),
        sig: di.map(d => d.text || '').filter(Boolean).join('; '), authored,
        startedThisAdmission: authored != null && admitTime != null && authored >= admitTime,
        inhaled: /inhal|puff|nebul|mdi|dpi|ellipta|turbuhaler|diskus|handihaler|respimat|breezhaler/.test(route + ' ' + norm),
        ...{ raw: r } };
    }).filter(m => m.name);
  }

  function parseAdmins(list) {
    return (list || []).filter(r => r && r.resourceType === 'MedicationAdministration' && ['completed', 'in-progress'].includes(r.status)).map(r => {
      const name = ccText(r.medicationCodeableConcept) || (r.medicationReference && r.medicationReference.display) || '';
      const norm = normMed(name);
      return { name, norm, classes: classesOf(norm), time: toTime(r.effectiveDateTime || (r.effectivePeriod && r.effectivePeriod.start)) };
    }).filter(a => a.name && a.time != null).sort((a, b) => a.time - b.time);
  }

  function parseConditions(list) {
    return (list || []).filter(r => r && r.resourceType === 'Condition')
      .filter(r => !['entered-in-error', 'refuted'].includes(codings(r.verificationStatus).map(c => c.code)[0]))
      .map(r => {
        const st = codings(r.clinicalStatus).map(c => c.code)[0] || '';
        return { text: ccText(r.code), active: !st || ['active', 'recurrence', 'relapse'].includes(st) };
      }).filter(c => c.text);
  }

  function parseOrders(list) {
    // ServiceRequest and Procedure: used for catheter and telemetry orders when the server provides them.
    return (list || []).filter(r => r && (r.resourceType === 'ServiceRequest' || r.resourceType === 'Procedure'))
      .filter(r => !['entered-in-error', 'revoked', 'not-done'].includes(r.status)).map(r => ({
        type: r.resourceType, name: ccText(r.code), kind: kindOf(r.code), status: r.status,
        time: toTime(r.authoredOn || r.occurrenceDateTime || r.performedDateTime || (r.performedPeriod && r.performedPeriod.start)
          || (r.occurrencePeriod && r.occurrencePeriod.start)),
        end: toTime((r.performedPeriod && r.performedPeriod.end) || (r.occurrencePeriod && r.occurrencePeriod.end))
      })).filter(o => o.time != null);
  }

  // ------------------------------------------------------------------
  // Context
  // ------------------------------------------------------------------
  function buildContext(r, opts) {
    opts = opts || {};
    const now = opts.now != null ? opts.now : Date.now();
    const lookbackDays = opts.lookbackDays || CONFIG.lookbackDays;
    const from = now - lookbackDays * DAY;
    const enc = (r.encounters || []).filter(e => e && e.resourceType === 'Encounter')
      .map(e => ({ start: toTime(e.period && e.period.start), status: e.status, cls: lc((e.class && (e.class.code || e.class.display)) || '') }))
      .filter(e => e.start != null && e.start <= now)
      .sort((a, b) => b.start - a.start);
    const current = enc.find(e => e.status === 'in-progress' || e.status === 'arrived' || e.status === 'onleave') || enc[0] || null;
    const admitTime = current ? current.start : null;
    const patient = r.patient || null;
    const ctx = {
      now, from, lookbackDays, admitTime, patient,
      age: patient && patient.birthDate ? ageAt(patient.birthDate, now) : null,
      sex: patient ? patient.gender : null,
      meds: parseMeds(r.medRequests, admitTime),
      admins: r.medAdmins == null ? null : parseAdmins(r.medAdmins).filter(a => a.time >= from),
      obs: parseObservations(r.observations),
      reports: parseReports(r.reports),
      orders: parseOrders(r.orders),
      conditions: parseConditions(r.conditions),
      notes: r.notes == null ? null : r.notes.filter(n => n.time >= from && n.time <= now),
      failed: uniq((r.failed || []).concat(r.pending || [])),
      pending: (r.pending || []).slice(),
      gaps: (r.gaps || []).slice()
    };
    ctx.has = label => !ctx.failed.includes(label);
    ctx.medsLoaded = ctx.has('Active medications');
    ctx.series = k => ctx.obs.filter(o => o.kind === k);
    ctx.medsIn = cls => ctx.meds.filter(m => m.classes[cls]);
    return ctx;
  }

  // ------------------------------------------------------------------
  // Checks — each returns { status: 'review'|'ok'|'na'|'unknown', summary, evidence[], action }
  // ------------------------------------------------------------------
  const R = (status, summary, evidence, action) => ({ status, summary, evidence: [].concat(evidence || []).filter(Boolean), action: action || '' });
  const missing = (ctx, labels) => labels.filter(l => !ctx.has(l));

  const CHECKS = [
    {
      id: 'catheter', title: 'Urinary catheter', source: 'Canadian Society of Hospital Medicine',
      rec: 'Don’t place or leave in place a urinary catheter without reassessment.', link: LINKS.tube,
      run(ctx) {
        const orderHits = ctx.orders.filter(o => o.kind === 'catheter' || KEYWORDS.catheter.test(o.name));
        const obsHits = ctx.obs.filter(o => o.kind === 'catheter' && !/\b(?:no|none|removed|discontinued)\b/i.test(o.text));
        const noteHits = ctx.notes ? findInNotes(ctx.notes, KEYWORDS.catheter) : [];
        const removed = ctx.notes ? findInNotes(ctx.notes, KEYWORDS.catheterRemoved, { allowNegated: false }) : [];
        const mentions = [...orderHits.map(o => o.time), ...obsHits.map(o => o.time), ...noteHits.map(h => h.time)].sort((a, b) => a - b);
        if (!mentions.length) {
          const gaps = missing(ctx, ['Nursing notes']);
          if (ctx.notes == null || gaps.length) return R('unknown', 'Couldn’t check: notes didn’t load', [], 'Check for a urinary catheter at the bedside');
          return R('ok', 'No urinary catheter found in orders, flowsheets or notes', [], '');
        }
        const lastMention = mentions[mentions.length - 1];
        const lastRemoved = removed.length ? removed[removed.length - 1].time : null;
        if (lastRemoved && lastRemoved >= lastMention) {
          return R('ok', 'Catheter documented as removed ' + fmtTime(lastRemoved), [quote(removed[removed.length - 1])], '');
        }
        const first = mentions[0];
        const nDays = days(ctx.now - first);
        const reasons = ctx.notes ? KEYWORDS.catheterReason.map(([re, label]) => findInNotes(ctx.notes, re).length ? label : null).filter(Boolean) : [];
        const ev = ['First documented ' + fmtTime(first) + ' (' + plural(nDays, 'day') + ' ago)'];
        if (noteHits.length) ev.push(quote(noteHits[noteHits.length - 1]));
        if (reasons.length) {
          ev.push('Possible reason in notes: ' + reasons.join(', '));
          return R(nDays >= CONFIG.catheterReviewDays ? 'review' : 'ok',
            'Catheter in place ' + plural(nDays, 'day') + '; a possible reason is documented', ev,
            'Confirm the reason still applies; set a removal date');
        }
        if (nDays < CONFIG.catheterReviewDays) return R('ok', 'Catheter in place under ' + plural(CONFIG.catheterReviewDays, 'day'), ev, 'Reassess daily');
        return R('review', 'Catheter in place ' + plural(nDays, 'day') + ' with no documented reason', ev,
          'Remove, or document an indication: retention or obstruction, critical illness needing accurate output, sacral or perineal wound, immobilization, perioperative, or comfort care');
      }
    },
    {
      id: 'asb', title: 'Asymptomatic bacteriuria', source: 'Canadian Society of Hospital Medicine',
      rec: 'Don’t prescribe antibiotics for asymptomatic bacteriuria in non-pregnant patients.', link: LINKS.hospital,
      run(ctx) {
        const cultures = [
          ...ctx.obs.filter(o => o.kind === 'urineCulture').map(o => ({ time: o.time, text: o.display + ' ' + o.text })),
          ...ctx.reports.filter(r => r.kind === 'urineCulture').map(r => ({ time: r.time, text: r.name + ' ' + r.text }))
        ].filter(c => c.time >= ctx.from).sort((a, b) => a.time - b.time);
        const labsGap = missing(ctx, ['Lab results', 'Microbiology reports']);
        if (!cultures.length) {
          if (labsGap.length === 2) return R('unknown', 'Couldn’t check: lab and microbiology results didn’t load', [], '');
          return R('na', 'No urine culture in the last ' + plural(ctx.lookbackDays, 'day'), [], '');
        }
        const positive = cultures.filter(c => KEYWORDS.positiveCulture.test(c.text) && !KEYWORDS.negativeCulture.test(c.text));
        if (!positive.length) return R('ok', 'Urine culture without significant growth', ['Latest: ' + fmtTime(cultures[cultures.length - 1].time)], '');
        const pos = positive[positive.length - 1];
        const cultureText = pos.text.replace(/^\s*urine culture\s*/i, '').replace(/\s+/g, ' ').trim();
        const orgMatch = cultureText ? [cultureText.length > 90 ? cultureText.slice(0, 90) + '…' : cultureText] : null;
        if (!ctx.medsLoaded) return R('unknown', 'Positive urine culture; couldn’t check antibiotics (medications didn’t load)', ['Culture ' + fmtTime(pos.time)], '');
        const abx = ctx.medsIn('antibiotic');
        if (!abx.length) return R('ok', 'Positive urine culture, no antibiotic currently ordered', ['Culture ' + fmtTime(pos.time) + (orgMatch ? ': ' + orgMatch[0] : '')], '');
        const w0 = pos.time - CONFIG.asbWindowHours * HOUR, w1 = pos.time + CONFIG.asbWindowHours * HOUR;
        const fevers = ctx.series('temp').filter(o => o.time >= w0 && o.time <= w1 && o.value != null && o.value >= CONFIG.asbFeverC);
        const symptoms = ctx.notes ? findInNotes(ctx.notes, KEYWORDS.urinarySymptoms) : [];
        const exempt = ctx.notes ? findInNotes(ctx.notes, KEYWORDS.asbExempt) : [];
        const exemptCond = ctx.conditions.filter(c => c.active && KEYWORDS.asbExempt.test(c.text));
        const ev = ['Culture ' + fmtTime(pos.time) + (orgMatch ? ': ' + orgMatch[0] : ''), 'On: ' + abx.map(m => m.classes.antibiotic[0]).join(', ')];
        if (exempt.length || exemptCond.length) {
          ev.push('Exception noted: ' + (exemptCond[0] ? exemptCond[0].text : exempt[0].match));
          return R('ok', 'Treatment may be appropriate: pregnancy, transplant, neutropenia or urological procedure noted', ev, '');
        }
        if (fevers.length || symptoms.length) {
          if (fevers.length) ev.push('Temp ' + Math.max(...fevers.map(f => f.value)) + ' °C within ' + CONFIG.asbWindowHours + ' h of culture');
          if (symptoms.length) ev.push(quote(symptoms[symptoms.length - 1]));
          return R('ok', 'Positive culture with fever or urinary symptoms documented', ev, 'Check the antibiotic matches sensitivities and set a stop date');
        }
        if (ctx.notes == null) return R('unknown', 'Positive culture on an antibiotic; couldn’t check notes for symptoms', ev, 'Check for urinary symptoms before continuing');
        // Other infections can explain the antibiotic: say so instead of assuming ASB.
        const otherInfection = ctx.conditions.filter(c => c.active && /pneumonia|cellulitis|osteomyelitis|endocarditis|bacteremia|sepsis|abscess|cholangitis|diverticulitis|meningitis/i.test(c.text));
        if (otherInfection.length) ev.push('Note: another infection is on the problem list (' + otherInfection.map(c => c.text).join('; ') + '), which may explain the antibiotic');
        return R('review', 'Positive urine culture on an antibiotic, with no fever or urinary symptoms found', ev,
          'If there are no symptoms of UTI, consider stopping. Confusion or a fall alone is not a reason to treat bacteriuria');
      }
    },
    {
      id: 'sedatives', title: 'Sedative-hypnotics in an older adult', source: 'Canadian Society of Hospital Medicine',
      rec: 'Don’t use benzodiazepines and other sedative-hypnotics in older adults as first choice for insomnia, agitation or delirium.', link: LINKS.hospital,
      run(ctx) {
        if (ctx.age == null) return R('unknown', 'Couldn’t check: age not available', [], '');
        if (ctx.age < CONFIG.olderAdultAge) return R('na', 'Patient is under ' + CONFIG.olderAdultAge, [], '');
        if (!ctx.medsLoaded) return R('unknown', 'Couldn’t check: medications didn’t load', [], '');
        const cls = ['benzo', 'zdrug', 'antipsychotic', 'sedHypnoticOther'];
        const hits = ctx.meds.filter(m => cls.some(c => m.classes[c]));
        if (!hits.length) return R('ok', 'No benzodiazepine, Z-drug, antipsychotic or sedating antihistamine ordered', [], '');
        const ev = hits.map(m => {
          const ing = cls.map(c => (m.classes[c] || [])[0]).find(Boolean);
          const given = ctx.admins ? ctx.admins.filter(a => a.norm.includes(ing)) : [];
          return ing + (m.prn ? ' PRN' : '') + (m.startedThisAdmission ? ', started this admission' : '') +
            (given.length ? ' — given ' + plural(given.length, 'time') + ' (last ' + fmtTime(given[given.length - 1].time) + ')' : '');
        });
        return R('review', plural(hits.length, 'sedative') + ' ordered in a patient aged ' + ctx.age, ev,
          'Try non-drug measures first: sleep hygiene, fewer overnight interruptions, reorientation, treat pain and retention. If used for delirium, set a stop date');
      }
    },
    {
      id: 'labs', title: 'Repeat bloodwork while stable', source: 'Canadian Society of Internal Medicine',
      rec: 'In the inpatient setting, don’t order repeated CBC and chemistry testing in the face of clinical and lab stability.', link: LINKS.labs,
      run(ctx) {
        if (!ctx.has('Lab results')) return R('unknown', 'Couldn’t check: lab results didn’t load', [], '');
        const L = CONFIG.labs, since = ctx.now - L.windowDays * DAY;
        const stable = [], unstable = [], sparse = [];
        Object.keys(L.tests).forEach(k => {
          const t = L.tests[k];
          const s = ctx.series(k).filter(o => o.time >= since && o.value != null);
          const dayCount = uniq(s.map(o => new Date(o.time).toDateString())).length;
          if (dayCount < L.minDays) { if (s.length) sparse.push(t.label); return; }
          const vals = s.map(o => o.value);
          const lo = Math.min(...vals), hi = Math.max(...vals);
          const inRange = vals.every(v => v >= t.low && v <= t.high);
          const change = hi - lo;
          const changeOk = t.maxChangePct != null ? change <= lo * t.maxChangePct / 100 : change <= t.maxChange;
          const desc = t.label + ' ' + vals.map(v => round(v, t.unit === 'mmol/L' && k === 'k' ? 1 : 0)).join(' → ') + ' ' + t.unit + ' (' + dayCount + ' days)';
          (inRange && changeOk ? stable : unstable).push(desc);
        });
        if (!stable.length && !unstable.length) return R('na', 'Not drawn daily over the last ' + L.windowDays + ' days', [], '');
        if (!stable.length) return R('ok', 'Daily labs are changing or abnormal, so repeat testing looks justified', unstable, '');
        return R('review', plural(stable.length, 'daily test') + ' stable for ' + L.minDays + '+ days', stable.concat(unstable.length ? ['Still changing: ' + unstable.map(u => u.split(' ')[0]).join(', ')] : []),
          'Consider stopping or spacing out the stable tests, unless a drug or condition needs monitoring (IV diuretics, electrolyte replacement, heparin)');
      }
    },
    {
      id: 'telemetry', title: 'Telemetry outside the ICU', source: 'Canadian Society of Internal Medicine',
      rec: 'Don’t order continuous telemetry monitoring outside of ICU without a protocol that sets when to stop.', link: LINKS.csim,
      run(ctx) {
        const orderHits = ctx.orders.filter(o => o.kind === 'telemetry' || KEYWORDS.telemetry.test(o.name));
        const obsHits = ctx.obs.filter(o => o.kind === 'telemetry');
        const noteHits = ctx.notes ? findInNotes(ctx.notes, KEYWORDS.telemetry) : [];
        const offHits = ctx.notes ? findInNotes(ctx.notes, KEYWORDS.telemetryOff) : [];
        const activeOrders = orderHits.filter(o => !o.end && ['active', 'in-progress', 'completed'].includes(o.status || 'active'));
        const mentions = [...activeOrders.map(o => o.time), ...obsHits.map(o => o.time), ...noteHits.map(h => h.time)].sort((a, b) => a - b);
        if (!mentions.length) {
          if (ctx.notes == null && !ctx.has('Orders')) return R('unknown', 'Couldn’t check: orders and notes didn’t load', [], '');
          return R('ok', 'No telemetry found in orders, flowsheets or notes', [], '');
        }
        const last = mentions[mentions.length - 1];
        const off = offHits.length ? offHits[offHits.length - 1] : null;
        if (off && off.time >= last) return R('ok', 'Telemetry documented as stopped ' + fmtTime(off.time), [quote(off)], '');
        const hrs = Math.round((ctx.now - mentions[0]) / HOUR);
        const ev = ['First documented ' + fmtTime(mentions[0]) + ' (' + (hrs >= 48 ? plural(Math.floor(hrs / 24), 'day') : hrs + ' h') + ' ago)'];
        if (activeOrders.length) ev.push('Order: ' + activeOrders[activeOrders.length - 1].name);
        if (noteHits.length) ev.push(quote(noteHits[noteHits.length - 1]));
        if (hrs < CONFIG.telemetryReviewHours) return R('ok', 'On telemetry under ' + CONFIG.telemetryReviewHours + ' h', ev, 'Set a stop time or criteria');
        return R('review', 'On telemetry ' + (hrs >= 48 ? plural(Math.floor(hrs / 24), 'day') : hrs + ' h'), ev,
          'Is there still an indication? If not, stop telemetry');
      }
    },
    {
      id: 'goals', title: 'Goals of care for a high-risk patient', source: 'Canadian Society of Internal Medicine',
      rec: 'Don’t undertake prolonged life-sustaining treatments or escalate to intensive care without establishing prognosis and the patient’s wishes.', link: LINKS.csim,
      run(ctx) {
        if (!ctx.has('Problem list') && ctx.age == null) return R('unknown', 'Couldn’t check: problem list and age not available', [], '');
        const risks = uniq(HIGH_RISK.filter(([re]) => ctx.conditions.some(c => c.active && re.test(c.text))).map(([, label]) => label));
        if (ctx.age != null && ctx.age >= 85) risks.unshift('age ' + ctx.age);
        if (!risks.length) {
          if (!ctx.has('Problem list')) return R('unknown', 'Couldn’t check: problem list didn’t load', [], '');
          return R('na', 'No high-risk conditions found on the problem list', [], '');
        }
        const obsGoc = ctx.obs.filter(o => o.kind === 'codeStatus');
        const noteGoc = ctx.notes ? findInNotes(ctx.notes, KEYWORDS.goalsDocumented).concat(findInNotes(ctx.notes, KEYWORDS.most))
          .sort((a, b) => a.time - b.time) : [];
        const ev = ['High-risk: ' + risks.join(', ')];
        if (obsGoc.length) {
          const g = obsGoc[obsGoc.length - 1];
          ev.push('Documented: ' + (g.display || 'code status') + (g.text ? ' — ' + g.text : '') + ' (' + fmtTime(g.time) + ')');
          return R('ok', 'Code status or goals of care documented', ev, 'Revisit if the patient’s condition changes');
        }
        if (noteGoc.length) {
          ev.push(quote(noteGoc[noteGoc.length - 1]));
          return R('ok', 'Goals of care mentioned in notes', ev, 'Confirm a current MOST is on the chart');
        }
        if (ctx.notes == null) return R('unknown', 'High-risk patient; couldn’t check notes for goals of care', ev, 'Check for a MOST form');
        return R('review', 'High-risk patient with no MOST or goals-of-care discussion found', ev,
          'Have a goals-of-care conversation and complete a MOST before any escalation is needed');
      }
    },
    {
      id: 'spirometry', title: 'Inhalers without spirometry', source: 'Canadian Society of Internal Medicine',
      rec: 'Don’t initiate long-term maintenance inhalers for suspected COPD or asthma without confirming the diagnosis with objective testing.', link: LINKS.csim,
      run(ctx) {
        if (!ctx.medsLoaded) return R('unknown', 'Couldn’t check: medications didn’t load', [], '');
        const inh = ctx.meds.filter(m => m.classes.inhalerMaint && (m.inhaled || /inhal|puff|ellipta|diskus|turbuhaler|handihaler|respimat|breezhaler|spiriva|advair|symbicort|breo|trelegy|anoro|incruse|flovent|ultibro|inspiolto/.test(lc(m.name + ' ' + m.sig))));
        if (!inh.length) return R('na', 'No maintenance inhaler ordered', [], '');
        const pftObs = ctx.obs.filter(o => ['fev1', 'fev1fvc', 'fvc', 'spirometry'].includes(o.kind));
        const pftRep = ctx.reports.filter(r => ['fev1', 'fev1fvc', 'spirometry'].includes(r.kind) || KEYWORDS.spirometry.test(r.name));
        const pftNotes = ctx.notes ? findInNotes(ctx.notes, KEYWORDS.spirometry) : [];
        const ev = ['Maintenance inhaler: ' + uniq(inh.map(m => m.classes.inhalerMaint.join(' + '))).join('; ')];
        if (pftObs.length || pftRep.length) {
          const t = Math.max(...pftObs.map(o => o.time), ...pftRep.map(r => r.time));
          ev.push('Spirometry on file: ' + fmtDate(t));
          return R('ok', 'Spirometry found', ev, '');
        }
        if (pftNotes.length) {
          ev.push(quote(pftNotes[pftNotes.length - 1]));
          return R('ok', 'Spirometry mentioned in notes', ev, 'Confirm it showed obstruction');
        }
        return R('review', 'Maintenance inhaler with no spirometry found in this chart', ev,
          'Confirm spirometry was done elsewhere; if not, arrange it after discharge, when the patient is well');
      }
    },
    {
      id: 'ppi', title: 'PPI without a clear indication', source: 'Choosing Wisely Canada PPI toolkit',
      rec: 'Ask why: continue a proton pump inhibitor long term only when there is an ongoing indication.', link: LINKS.ppi,
      run(ctx) {
        if (!ctx.medsLoaded) return R('unknown', 'Couldn’t check: medications didn’t load', [], '');
        const ppis = ctx.medsIn('ppi');
        if (!ppis.length) return R('na', 'No PPI ordered', [], '');
        const ev = ppis.map(m => m.classes.ppi[0] + (m.sig ? ' (' + m.sig + ')' : '') + (m.startedThisAdmission ? ' — started this admission' : ''));
        const ind = uniq(PPI_INDICATIONS.filter(([re]) => ctx.conditions.some(c => re.test(c.text))).map(([, l]) => l));
        const nsaid = ctx.medsIn('nsaid'), ac = ctx.medsIn('anticoag'), ap = ctx.medsIn('antiplatelet');
        const gastro = (nsaid.length && (ctx.age >= 65 || ac.length)) || (ac.length && ap.length) || ap.length >= 2;
        if (gastro) ind.push(nsaid.length ? 'NSAID with risk factors' : (ap.length >= 2 ? 'dual antiplatelet therapy' : 'anticoagulant with antiplatelet'));
        if (ind.length) {
          ev.push('Possible indication: ' + ind.join(', '));
          return R('ok', 'PPI with a possible indication', ev, ind.some(i => /GERD|H\. pylori/.test(i)) ? 'For GERD, check whether long-term use is still needed' : '');
        }
        if (!ctx.has('Problem list')) return R('unknown', 'PPI ordered; couldn’t check the problem list for an indication', ev, '');
        const newOne = ppis.some(m => m.startedThisAdmission);
        return R('review', 'PPI with no indication found' + (newOne ? '; started this admission' : ''), ev,
          newOne ? 'If started for stress-ulcer prophylaxis, stop before discharge'
                 : 'Taper or stop if no ongoing indication; tell the family doctor at discharge');
      }
    }
  ];

  // Order-time recommendations: shown for reference only.
  const REFERENCE = [
    'Don’t routinely obtain head CT in hospitalized patients with delirium in the absence of risk factors.',
    'Don’t routinely obtain neuroimaging (CT, MRI or carotid Doppler) for simple syncope with a normal neurological exam.',
    'Don’t do a workup for clotting disorders after a first provoked DVT.',
    'Don’t order or refer for PCI in stable coronary artery disease without warning signs or optimal medical therapy.'
  ];

  function evaluate(ctx) {
    const items = CHECKS.map(c => {
      let r;
      try { r = c.run(ctx); } catch (e) {
        if (typeof console !== 'undefined') console.warn('[cw] check ' + c.id + ' failed', e);
        r = R('unknown', 'Couldn’t check (error)', [], '');
      }
      return Object.assign({ id: c.id, title: c.title, rec: c.rec, source: c.source, link: c.link }, r);
    });
    const count = s => items.filter(i => i.status === s).length;
    return { ctx, items, counts: { review: count('review'), ok: count('ok'), na: count('na'), unknown: count('unknown') },
      failed: ctx.failed.filter(f => !ctx.pending.includes(f)), pending: ctx.pending };
  }

  // ------------------------------------------------------------------
  // FHIR loading
  // ------------------------------------------------------------------
  function shortError(e) {
    const m = String((e && e.message) || e || 'failed');
    const code = m.match(/^\s*(\d{3})\b/);
    if (code) {
      const c = +code[1];
      if (c === 504 || c === 503 || c === 502) return 'Cerner server timed out (' + c + ')';
      if (c === 401 || c === 403) return 'Not allowed (' + c + ') — check the app’s scopes';
      if (c === 400 || c === 422) return 'Search not supported (' + c + ')';
      return 'Server error ' + c;
    }
    return m.length > 120 ? m.slice(0, 120) + '…' : m;
  }
  function withTimeout(p, ms, label) {
    let t;
    return Promise.race([p, new Promise((_, rej) => { t = setTimeout(() => rej(new Error(label + ' timed out after ' + Math.round(ms / 1000) + ' s')), ms); })])
      .finally(() => clearTimeout(t));
  }
  async function fhirSearch(client, url, pageLimit) {
    const r = await client.request(url, { pageLimit: pageLimit || 5, flat: true });
    return Array.isArray(r) ? r : (r && r.entry ? r.entry.map(e => e.resource) : []);
  }
  function b64decode(s) {
    try { return new TextDecoder().decode(Uint8Array.from(atob(s), c => c.charCodeAt(0))); } catch (e) { return ''; }
  }
  function stripHtml(h) {
    return String(h || '').replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ').replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|li|tr|h\d)>/gi, '\n').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/[ \t]+/g, ' ').trim();
  }
  async function noteText(client, doc) {
    const atts = (doc.content || []).map(c => c.attachment).filter(Boolean);
    const att = atts.find(a => /text\/plain/.test(a.contentType || '')) || atts.find(a => /html/.test(a.contentType || '')) || atts[0];
    if (!att) return '';
    let txt = '';
    if (att.data) txt = b64decode(att.data);
    else if (att.url) {
      const r = await client.request({ url: att.url, headers: { Accept: att.contentType || 'text/plain' } });
      txt = typeof r === 'string' ? r : (r && r.data ? b64decode(r.data) : '');
    }
    return (/html/.test(att.contentType || '') || /<\w+[^>]*>/.test(txt)) ? stripHtml(txt) : txt;
  }
  async function loadNotes(client, pid, from, to) {
    const docs = await fhirSearch(client, 'DocumentReference?patient=' + pid + '&_count=50', 3);
    const recent = docs.filter(d => d.status !== 'entered-in-error')
      .map(d => ({ d, time: toTime(d.date || (d.context && d.context.period && d.context.period.start)) }))
      .filter(x => x.time != null && x.time >= from && x.time <= to)
      .sort((a, b) => b.time - a.time).slice(0, CONFIG.maxNotes);
    const texts = await Promise.allSettled(recent.map(x => withTimeout(noteText(client, x.d), CONFIG.timeouts.noteMs, 'note')));
    return recent.map((x, i) => ({ time: x.time, title: ccText(x.d.type) || x.d.description || 'Note',
      text: texts[i].status === 'fulfilled' ? texts[i].value : '' })).filter(n => n.text);
  }

  async function loadResources(client, opts) {
    const pid = client.patient.id;
    const from = opts.from, to = opts.to;
    const ge = fhirDate(from);
    const gaps = [], failed = [], pending = new Set();
    const out = { patient: null, encounters: [], medRequests: [], medAdmins: null, observations: [], reports: [], orders: [], conditions: [], notes: null };
    const progress = opts.onProgress || function () {};
    const partial = opts.onPartial || function () {};
    const snapshot = () => Object.assign({}, out, { gaps: gaps.slice(), failed: failed.slice(), pending: Array.from(pending) });
    const FAILED = {};

    const safe = async (label, fn) => {
      progress(label, 'loading');
      try {
        const v = await withTimeout(Promise.resolve().then(fn), label === 'Nursing notes' ? CONFIG.timeouts.notesMs : CONFIG.timeouts.searchMs, label);
        progress(label, 'done', Array.isArray(v) ? v.length : null);
        return v;
      } catch (e) {
        if (typeof console !== 'undefined') console.warn('[cw] ' + label + ' failed', e);
        progress(label, 'failed', null, shortError(e));
        return FAILED;
      }
    };
    const run = async (label, key, fn, fallback, retryIfQuick) => {
      pending.add(label);
      const t0 = Date.now();
      let v = await safe(label, fn);
      if (v === FAILED && retryIfQuick && Date.now() - t0 < CONFIG.timeouts.searchMs / 2) v = await safe(label + ' (retry)', fn);
      pending.delete(label);
      if (v === FAILED) { failed.push(label); out[key] = fallback; } else out[key] = v;
      partial(snapshot());
    };
    // Some servers reject a search combination; try simpler forms before giving up.
    const firstWorking = async (urls, pages) => {
      let last;
      for (const u of urls) { try { return await fhirSearch(client, u, pages); } catch (e) { last = e; } }
      throw last;
    };
    const both = async (fns) => {
      const rs = await Promise.allSettled(fns.map(f => f()));
      const ok = rs.filter(r => r.status === 'fulfilled');
      if (!ok.length) throw rs[0].reason;
      return ok.flatMap(r => r.value);
    };

    await Promise.all([
      run('Patient', 'patient', () => client.patient.read(), null),
      run('Admission', 'encounters', () => firstWorking([
        'Encounter?patient=' + pid + '&status=in-progress', 'Encounter?patient=' + pid + '&_count=20'], 1), []),
      run('Active medications', 'medRequests', () => fhirSearch(client, 'MedicationRequest?patient=' + pid + '&status=active&_count=100'), [], true),
      run('Medication administrations', 'medAdmins', () => fhirSearch(client, 'MedicationAdministration?patient=' + pid +
        '&effective-time=ge' + ge + '&_count=100', 10), null),
      run('Problem list', 'conditions', () => firstWorking([
        'Condition?patient=' + pid + '&category=problem-list-item',
        'Condition?patient=' + pid + '&clinical-status=active'], 3), [], true),
      // Labs and vitals in the window, plus spirometry results from any date.
      run('Lab results', 'observations', () => both([
        () => firstWorking(['Observation?patient=' + pid + '&category=laboratory&date=ge' + ge + '&_count=100'], 10),
        () => firstWorking(['Observation?patient=' + pid + '&category=vital-signs&date=ge' + ge + '&_count=100'], 10),
        () => firstWorking(['Observation?patient=' + pid + '&code=http://loinc.org|20150-9,http://loinc.org|19926-5'], 2)
      ]), []),
      run('Microbiology reports', 'reports', () => firstWorking([
        'DiagnosticReport?patient=' + pid + '&date=ge' + ge + '&_count=100',
        'DiagnosticReport?patient=' + pid + '&category=LAB&_count=100'], 5), []),
      run('Orders', 'orders', () => both([
        () => fhirSearch(client, 'ServiceRequest?patient=' + pid + '&status=active&_count=100', 3),
        () => fhirSearch(client, 'Procedure?patient=' + pid + '&date=ge' + ge + '&_count=100', 3)
      ]), []),
      run('Nursing notes', 'notes', () => opts.getNotes ? opts.getNotes({ from, to }) : loadNotes(client, pid, from, to), null)
    ]);
    return snapshot();
  }

  // ------------------------------------------------------------------
  // Rendering
  // ------------------------------------------------------------------
  const STATUS = {
    review: { label: 'Review', cls: 'cw-st-review' },
    ok: { label: 'OK', cls: 'cw-st-ok' },
    na: { label: 'Not applicable', cls: 'cw-st-na' },
    unknown: { label: 'Couldn’t check', cls: 'cw-st-unknown' }
  };

  function itemHtml(i) {
    const s = STATUS[i.status];
    return '<section class="cw-item cw-item-' + i.status + '">' +
      '<div class="cw-item-head"><span class="cw-badge ' + s.cls + '">' + esc(s.label) + '</span>' +
      '<h3>' + esc(i.title) + '</h3></div>' +
      '<p class="cw-summary">' + esc(i.summary) + '</p>' +
      (i.evidence.length ? '<ul class="cw-evidence">' + i.evidence.map(e => '<li>' + esc(e) + '</li>').join('') + '</ul>' : '') +
      (i.action && i.status !== 'na' ? '<p class="cw-action">→ ' + esc(i.action) + '</p>' : '') +
      '<p class="cw-rec">' + esc(i.rec) + ' <a href="' + esc(i.link) + '" target="_blank" rel="noopener">' + esc(i.source) + '</a></p>' +
      '</section>';
  }

  function render(result, opts) {
    opts = opts || {};
    const r = result, c = r.counts, h = [];
    h.push('<div class="cw">');
    if (r.pending.length) h.push('<div class="cw-pending" role="status"><span class="cw-spinner" aria-hidden="true"></span><strong>Still loading:</strong> ' +
      r.pending.map(esc).join(', ') + '. The checklist updates when they arrive.</div>');
    if (r.failed.length) h.push('<div class="cw-incomplete" role="alert"><strong>Incomplete:</strong> ' + r.failed.map(esc).join(', ') +
      ' didn’t load, so some items show “Couldn’t check”. <button type="button" class="cw-retry">Try again</button></div>');
    const loading = r.pending.length > 0;
    h.push('<div class="cw-metrics">' +
      '<div class="cw-metric ' + (c.review ? 'cw-metric-bad' : (c.unknown || loading ? '' : 'cw-metric-good')) + '"><div class="cw-metric-label">To review</div><div class="cw-metric-value">' + c.review + '</div></div>' +
      '<div class="cw-metric ' + (c.ok ? 'cw-metric-good' : '') + '"><div class="cw-metric-label">OK</div><div class="cw-metric-value">' + c.ok + '</div></div>' +
      '<div class="cw-metric"><div class="cw-metric-label">Not applicable</div><div class="cw-metric-value">' + c.na + '</div></div>' +
      '<div class="cw-metric"><div class="cw-metric-label">Couldn’t check</div><div class="cw-metric-value">' + c.unknown + '</div></div>' +
      '</div>');
    const order = ['review', 'unknown', 'ok', 'na'];
    const sorted = r.items.slice().sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status));
    const showAll = !!opts.showAll;
    const shown = showAll ? sorted : sorted.filter(i => i.status === 'review' || i.status === 'unknown');
    if (!shown.length) h.push('<section class="cw-item cw-item-ok"><p class="cw-summary">Nothing to review. All checks are OK or not applicable.</p></section>');
    h.push(shown.map(itemHtml).join(''));
    const hidden = sorted.length - shown.length;
    h.push('<button type="button" class="cw-toggle">' + (showAll ? 'Show only items to review' : 'Show all ' + sorted.length + ' checks' + (hidden ? ' (' + hidden + ' OK or not applicable)' : '')) + '</button>');
    h.push('<details class="cw-ref"><summary>Other Choosing Wisely recommendations (decided at ordering, not checked here)</summary><ul>' +
      REFERENCE.map(t => '<li>' + esc(t) + '</li>').join('') + '</ul></details>');
    h.push('<p class="cw-disclaimer">Decision support only, from data available through FHIR; it reads orders, flowsheets and the last ' +
      plural(r.ctx.lookbackDays, 'day') + ' of notes. Check the chart before acting. Recommendations: Choosing Wisely Canada.</p>');
    h.push('</div>');
    return h.join('');
  }

  // ------------------------------------------------------------------
  // Mount
  // ------------------------------------------------------------------
  async function mount(container, client, opts) {
    opts = opts || {};
    const gen = (container.__cwGen || 0) + 1;
    container.__cwGen = gen;
    const current = () => container.__cwGen === gen;
    const hasPrev = !!container.querySelector('.cw-metrics');
    const now = opts.now || Date.now();
    const lookbackDays = opts.lookbackDays || CONFIG.lookbackDays;
    const from = now - lookbackDays * DAY;
    let showAll = !!container.__cwShowAll;
    let partialShown = false, lastResult = null;
    const status = {};

    const strip = (text, cls) => {
      const root = container.querySelector('.cw');
      if (!root) return;
      let el = root.querySelector('.cw-updating');
      if (!el) { el = document.createElement('div'); el.className = 'cw-updating'; el.setAttribute('role', 'status'); root.insertBefore(el, root.firstChild); }
      el.className = 'cw-updating' + (cls ? ' ' + cls : '');
      el.textContent = text;
    };
    const drawProgress = () => {
      if (!current() || partialShown) return;
      const keys = Object.keys(status);
      if (hasPrev) {
        const done = keys.filter(k => status[k].state !== 'loading').length;
        strip('Updating… ' + done + ' of ' + keys.length + ' loaded');
        return;
      }
      const icon = { loading: '…', done: '✓', failed: '✗' };
      container.innerHTML = '<div class="cw"><p class="cw-loading">Loading Choosing Wisely checks…</p><ul class="cw-progress">' +
        keys.map(k => '<li class="cw-prog-' + status[k].state + '"><span>' + icon[status[k].state] + '</span>' + esc(k) +
          (status[k].state === 'done' && status[k].count != null ? ' (' + status[k].count + ')' : '') +
          (status[k].state === 'failed' ? ' — ' + esc(status[k].msg || 'failed') : '') + '</li>').join('') + '</ul></div>';
    };
    const show = (res) => {
      lastResult = evaluate(buildContext(res, { now, lookbackDays }));
      container.innerHTML = render(lastResult, { showAll });
      wire();
      return lastResult;
    };
    const wire = () => {
      const rb = container.querySelector('.cw-retry');
      if (rb) rb.addEventListener('click', () => { mount(container, client, Object.assign({}, opts, { now: undefined })).catch(() => {}); });
      const t = container.querySelector('.cw-toggle');
      if (t && !t.__wired) {
        t.__wired = true;
        t.addEventListener('click', () => {
          showAll = !showAll; container.__cwShowAll = showAll;
          container.innerHTML = render(lastResult, { showAll });
          wire();
        });
      }
    };
    const onProgress = (label, state, count, msg) => { status[label] = { state, count, msg }; drawProgress(); };
    const onPartial = (snap) => {
      if (!current() || hasPrev) return;
      if (!['Active medications', 'Problem list', 'Lab results'].some(l => !snap.pending.includes(l))) return;
      partialShown = true;
      show(snap);
    };
    const loader = opts.loader || ((f, t) => loadResources(client, { from: f, to: t, getNotes: opts.getNotes, onProgress, onPartial }));
    if (hasPrev) strip('Updating…');
    else container.innerHTML = '<div class="cw"><p class="cw-loading">Loading Choosing Wisely checks…</p></div>';
    try {
      const res = await loader(from, now);
      if (!current()) return null;
      return show(res);
    } catch (e) {
      if (!current()) return null;
      if (hasPrev) strip('Couldn’t update — showing the previous checklist. ' + shortError(e), 'cw-updating-error');
      else container.innerHTML = '<div class="cw"><p class="cw-error">Couldn’t load the checks. ' + esc(shortError(e)) + '</p></div>';
      throw e;
    }
  }

  return { CONFIG, LINKS, DRUGS, KEYWORDS, CHECKS, mount, loadResources, buildContext, evaluate, render, classesOf, normMed, kindOf };
});
