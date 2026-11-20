/* Autoimmune Serology Interpreter — rules engine
 * Pure JS (no DOM). Runs in the browser (window.SeroEngine) and in Node (module.exports) for testing.
 * Classification criteria are used as a structured checklist. They are research classification
 * tools, not diagnostic criteria; the clinician makes the diagnosis.
 */
(function (root) {
  'use strict';

  // ---------- Test catalogue (ORDER MATTERS: first name match wins) ----------
  const T = (id, name, group, type, re, extra) => Object.assign({ id, name, group, type, re }, extra || {});
  const TESTS = [
    T('anapat', 'ANA pattern', 'ANA & ENA', 'pattern', /(\bANA\b|antinuclear|hep.?2).*pattern|pattern.*(\bANA\b|antinuclear)/i),
    T('dsdna', 'Anti-dsDNA', 'ANA & ENA', 'ab', /ds.?DNA|double.?strand/i),
    T('rnp', 'Anti-U1-RNP', 'ANA & ENA', 'ab', /\bRNP\b|U1.?RNP|ribonucleoprotein/i),
    T('sm', 'Anti-Sm (Smith)', 'ANA & ENA', 'ab', /\bSm\b|smith/i),
    T('ro', 'Anti-Ro/SSA (52/60)', 'ANA & ENA', 'ab', /\bRo\b|Ro.?52|Ro.?60|\bSSA\b|SS-A/i),
    T('lac', 'Lupus anticoagulant', 'Antiphospholipid', 'ab', /lupus anticoag|dRVVT|lupus inhibitor|\bLA screen|\bLA confirm/i),
    T('la', 'Anti-La/SSB', 'ANA & ENA', 'ab', /\bLa\b|\bSSB\b|SS-B/i),
    T('scl70', 'Anti-Scl-70 (topoisomerase I)', 'ANA & ENA', 'ab', /Scl.?70|topoisomerase/i),
    T('centromere', 'Anti-centromere (CENP-B)', 'ANA & ENA', 'ab', /centromere|CENP/i),
    T('rnapol', 'Anti-RNA polymerase III', 'ANA & ENA', 'ab', /RNA.?pol/i),
    T('jo1', 'Anti-Jo-1', 'Myositis', 'ab', /\bJo.?1\b|histidyl/i),
    T('myo', 'Other myositis antibody', 'Myositis', 'myo', /PL.?7\b|PL.?12\b|\bEJ\b|\bOJ\b|MDA.?5|\bMi.?2|TIF.?1|NXP.?2|\bSAE\b|\bSRP\b|HMGCR|HMG.?CoA|myositis/i),
    T('histone', 'Anti-histone', 'ANA & ENA', 'ab', /histone/i),
    T('pr3', 'Anti-PR3 (ELISA)', 'ANCA & GBM', 'ab', /PR.?3\b|proteinase.?3/i),
    T('mpo', 'Anti-MPO (ELISA)', 'ANCA & GBM', 'ab', /\bMPO\b|myeloperoxidase/i),
    T('anca', 'ANCA (IIF pattern)', 'ANCA & GBM', 'aiif', /ANCA|neutrophil.{0,6}cytoplasm/i),
    T('gbm', 'Anti-GBM', 'ANCA & GBM', 'ab', /\bGBM\b|glomerular basement/i),
    T('acl', 'Anticardiolipin (IgG/IgM)', 'Antiphospholipid', 'ab', /cardiolipin/i),
    T('b2gpi', 'Anti-β2-glycoprotein I', 'Antiphospholipid', 'ab', /beta.?2.?glyco|β.?2.?glyco|b2.?GP/i),
    T('ccp', 'Anti-CCP', 'RF & CCP', 'ra', /\bCCP\b|citrullinated/i),
    T('rf', 'Rheumatoid factor', 'RF & CCP', 'ra', /rheumatoid factor|\bRF\b/i),
    T('ch50', 'CH50 (total complement)', 'Complement', 'comp', /CH.?50|total complement|hemolytic complement/i),
    T('c3', 'C3', 'Complement', 'comp', /\bC3\b|complement c3/i, { lo: 0.9, hi: 1.8, unit: 'g/L' }),
    T('c4', 'C4', 'Complement', 'comp', /\bC4\b|complement c4/i, { lo: 0.1, hi: 0.4, unit: 'g/L' }),
    T('cryo', 'Cryoglobulins', 'Other', 'ab', /cryoglob/i),
    T('ama', 'Anti-mitochondrial (AMA)', 'Liver', 'ab', /mitochondri/i),
    T('asma', 'Anti-smooth muscle / F-actin', 'Liver', 'ab', /smooth muscle|F.?actin/i),
    T('lkm', 'Anti-LKM-1', 'Liver', 'ab', /\bLKM|liver.?kidney/i),
    T('b27', 'HLA-B27', 'Other', 'ab', /B.?27\b/i),
    T('hcv', 'Hepatitis C (Ab or RNA)', 'Other', 'ab', /hepatitis C|\bHCV\b/i),
    T('dat', 'Direct antiglobulin (Coombs)', 'Other', 'ab', /direct antiglobulin|\bDAT\b|coombs/i),
    T('ana', 'ANA (HEp-2 IIF titre)', 'ANA & ENA', 'titer', /\bANA\b|antinuclear|anti-nuclear/i),
    // ---- supporting labs (numeric) ----
    T('upcr', 'Urine protein/creatinine ratio', 'Supporting labs', 'num', /protein.{0,15}creat|\bUPCR\b|\bUPC\b/i, { unit: 'g/g', not: /c.?reactive|albumin/i }),
    T('uaprot', 'Urine protein (dipstick)', 'Supporting labs', 'ab', /(urin|\bUA\b|dip).*protein|protein.*(urin|dip)/i),
    T('uablood', 'Urine blood / RBC', 'Supporting labs', 'ab', /(urin|\bUA\b|dip).*(blood|RBC|hemoglobin|erythro)|(blood|RBC|erythro).*urin/i),
    T('wbc', 'WBC', 'Supporting labs', 'num', /^(WBC|white blood|leukocytes?)\b/i, { unit: '×10⁹/L', not: /urin|esterase|cast|\bUA\b|fluid|CSF/i }),
    T('plt', 'Platelets', 'Supporting labs', 'num', /platelet|\bPLT\b/i, { unit: '×10⁹/L', not: /mean|MPV|volume|function|antibod|aggreg/i }),
    T('hb', 'Hemoglobin', 'Supporting labs', 'num', /hemoglobin|haemoglobin|\bHGB\b|\bHb\b/i, { unit: 'g/L', not: /A1c|glyc|urin|free|electroph/i }),
    T('eos', 'Eosinophils (absolute)', 'Supporting labs', 'num', /eosinophil/i, { unit: '×10⁹/L', not: /urin|percent|%/i }),
    T('cr', 'Creatinine', 'Supporting labs', 'num', /creatinine/i, { unit: 'µmol/L', not: /urin|ratio|clearance|random|fluid/i }),
    T('esr', 'ESR', 'Supporting labs', 'num', /\bESR\b|sed.{0,6}rate|sedimentation/i, { unit: 'mm/h' }),
    T('crp', 'CRP', 'Supporting labs', 'num', /\bCRP\b|c.?reactive/i, { unit: 'mg/L', hiDefault: 10 }),
    T('ck', 'CK', 'Supporting labs', 'num', /\bCK\b|creatine kinase|\bCPK\b/i, { unit: 'U/L', hiDefault: 200, not: /MB|isoenz/i }),
    T('alt', 'ALT', 'Supporting labs', 'num', /\bALT\b|alanine/i, { unit: 'U/L', hiDefault: 40 }),
    T('alp', 'ALP', 'Supporting labs', 'num', /alk.{0,6}phos|\bALP\b/i, { unit: 'U/L', hiDefault: 120, not: /isoenz/i }),
    T('igg', 'IgG (total)', 'Supporting labs', 'num', /^IgG\b|immunoglobulin G\b/i, { unit: 'g/L', hiDefault: 16, not: /cardiolipin|glyco|IgG4|subclass|index|CSF|antibod|\bAb\b|anti/i }),
  ];
  const TEST = Object.fromEntries(TESTS.map(t => [t.id, t]));

  const OPTIONS = {
    titer: [['', '— not done —'], ['neg', 'Negative (<1:40)'], [40, '1:40 (borderline)'], [80, '1:80'], [160, '1:160'], [320, '1:320'], [640, '1:640'], [1280, '≥1:1280'], ['pos', 'Positive, titre not given']],
    pattern: [['', '— not reported —'], ['homogeneous', 'Homogeneous (AC-1)'], ['speckled', 'Speckled (AC-2/4/5)'], ['dfs', 'Dense fine speckled / DFS70 (AC-2)'], ['centromere', 'Centromere (AC-3)'], ['nucleolar', 'Nucleolar (AC-8/9/10)'], ['rim', 'Rim / nuclear envelope (AC-11/12)'], ['cytoplasmic', 'Cytoplasmic (AC-15–23)'], ['mixed', 'Mixed / other']],
    ab: [['', '— not done —'], ['neg', 'Negative'], ['equiv', 'Equivocal / trace'], ['pos', 'Positive']],
    ra: [['', '— not done —'], ['neg', 'Negative'], ['low', 'Low positive (≤3× ULN)'], ['high', 'High positive (>3× ULN)']],
    aiif: [['', '— not done —'], ['neg', 'Negative'], ['c', 'c-ANCA (cytoplasmic)'], ['p', 'p-ANCA (perinuclear)'], ['atyp', 'Atypical / x-ANCA'], ['pos', 'Positive, pattern not given']],
    myo: [['', '— not done —'], ['neg', 'Negative'], ['synth', 'Antisynthetase (PL-7, PL-12, EJ, OJ)'], ['mda5', 'Anti-MDA5'], ['mi2', 'Anti-Mi-2'], ['tif1', 'Anti-TIF1-γ'], ['nxp2', 'Anti-NXP2'], ['sae', 'Anti-SAE'], ['srp', 'Anti-SRP'], ['hmgcr', 'Anti-HMGCR'], ['other', 'Other positive']],
    comp: [['', '— not done —'], ['low', 'Low'], ['normal', 'Normal'], ['high', 'High']],
  };
  const optLabel = (type, val) => { const o = (OPTIONS[type] || []).find(x => String(x[0]) === String(val)); return o ? o[1] : String(val); };

  // ---------- Clinical features ----------
  const FEATURES = [
    ['General', [['fever', 'Fever >38.3 °C (no infection)'], ['age50', 'Age ≥50 (auto from DOB)'], ['cocaine', 'Cocaine use (levamisole)'], ['dur6', 'Joint symptoms ≥6 weeks']]],
    ['Skin & mucosa', [['acle', 'Acute cutaneous lupus (malar / photosensitive rash)'], ['scle', 'Subacute cutaneous or discoid lupus'], ['oral', 'Oral ulcers'], ['alopecia', 'Non-scarring alopecia'], ['purpura', 'Palpable purpura'], ['gottron', 'Heliotrope rash / Gottron papules'], ['mechanic', 'Mechanic\'s hands'], ['raynaud', 'Raynaud phenomenon'], ['puffy', 'Puffy (swollen) fingers'], ['sclerodactyly', 'Sclerodactyly (distal to MCPs)'], ['skinprox', 'Skin thickening proximal to MCPs (both hands)'], ['digulcer', 'Digital tip ulcers'], ['pitscar', 'Digital pitting scars'], ['telang', 'Telangiectasia'], ['nailfold', 'Abnormal nailfold capillaries']]],
    ['Joints', [['synovitis', 'Synovitis ≥2 joints (or tenderness + ≥30 min AM stiffness)'], ['ibp', 'Inflammatory back pain'], ['uveitis', 'Anterior uveitis'], ['girdle', 'Shoulder/hip girdle pain & stiffness']]],
    ['Serosa, heart & lung', [['effusion', 'Pleural or pericardial effusion'], ['pericarditis', 'Acute pericarditis'], ['ild', 'ILD / pulmonary fibrosis'], ['nodules', 'Lung nodules, mass or cavitation'], ['pulmhem', 'Diffuse alveolar hemorrhage'], ['asthma', 'Asthma / obstructive airway disease'], ['pah', 'Pulmonary arterial hypertension']]],
    ['ENT & eyes', [['sicca', 'Dry eyes / dry mouth (>3 months)'], ['ocular', 'Ocular staining score ≥5 (or van Bijsterveld ≥4)'], ['schirmer', 'Schirmer ≤5 mm/5 min'], ['saliva', 'Unstimulated salivary flow ≤0.1 mL/min'], ['lipbx', 'Labial gland biopsy: focus score ≥1'], ['nasal', 'Nasal: bloody discharge, crusting, ulcers, sinusitis, septal perforation'], ['cartilage', 'Cartilaginous: ear/nose cartilage, hoarseness/stridor, subglottic'], ['hearing', 'Conductive hearing loss'], ['polyps', 'Nasal polyps'], ['sinusimg', 'Sinus/mastoid inflammation on imaging'], ['gca', 'New headache, jaw claudication or visual symptoms']]],
    ['Kidney', [['hematuria', 'Hematuria / active urine sediment (RBC casts)'], ['rpgn', 'Rapidly rising creatinine (days–weeks)'], ['proteinuria', 'Proteinuria >0.5 g/day (if UPCR not in chart)'], ['pigN', 'Biopsy: pauci-immune GN'], ['ln25', 'Biopsy: lupus nephritis class II or V'], ['ln34', 'Biopsy: lupus nephritis class III or IV'], ['newhtn', 'New severe hypertension']]],
    ['Neuro & muscle', [['seizure', 'Seizure'], ['psychosis', 'Psychosis'], ['delirium', 'Delirium'], ['mononeuritis', 'Mononeuritis multiplex / neuropathy'], ['weakness', 'Proximal muscle weakness'], ['dysphagia', 'Dysphagia or respiratory muscle weakness']]],
    ['Blood & clots', [['aiha', 'Autoimmune hemolysis (confirmed)'], ['thrombosis', 'Arterial or venous thrombosis / small-vessel thrombosis'], ['pregnancy', 'APS pregnancy morbidity (loss ≥10 wk, preterm <34 wk with PET/placental insufficiency, ≥3 early losses)']]],
    ['Biopsy', [['granuloma', 'Granuloma / giant cells on biopsy'], ['eosinfl', 'Extravascular eosinophilic inflammation on biopsy']]],
  ];

  const RA_JOINTS = [['', '— not assessed —'], ['0', '1 large joint (0)'], ['1', '2–10 large joints (1)'], ['2', '1–3 small joints (2)'], ['3', '4–10 small joints (3)'], ['5', '>10 joints incl. ≥1 small (5)']];

  // problem-list keyword → feature (pre-ticks, user verifies)
  const CONDITION_MAP = [
    [/raynaud/i, 'raynaud'], [/interstitial lung|pulmonary fibrosis|\bILD\b|\bUIP\b|\bNSIP\b/i, 'ild'], [/asthma/i, 'asthma'],
    [/nasal polyp/i, 'polyps'], [/sinusitis/i, 'nasal'], [/thrombosis|\bDVT\b|pulmonary embol/i, 'thrombosis'],
    [/miscarriage|pregnancy loss|pre-?eclampsia/i, 'pregnancy'], [/pericarditis/i, 'pericarditis'], [/pleural effusion|pericardial effusion/i, 'effusion'],
    [/seizure|epilep/i, 'seizure'], [/psychosis/i, 'psychosis'], [/delirium/i, 'delirium'], [/glomerulonephritis/i, 'hematuria'],
    [/alveolar h(a)?emorrhage|pulmonary h(a)?emorrhage/i, 'pulmhem'], [/pulmonary (arterial )?hypertension/i, 'pah'], [/uveitis/i, 'uveitis'],
    [/cocaine/i, 'cocaine'], [/oral ulcer|aphthous/i, 'oral'], [/purpura/i, 'purpura'], [/mononeuritis/i, 'mononeuritis'],
    [/myositis|inflammatory myopathy/i, 'weakness'], [/(?<!osteo)(rheumatoid |inflammatory |poly)arthritis|synovitis/i, 'synovitis'],
    [/polymyalgia/i, 'girdle'], [/giant cell arteritis|temporal arteritis/i, 'gca'], [/sicca|dry eye|xerostomia|sj[oö]gren/i, 'sicca'],
    [/hemolytic an(a)?emia/i, 'aiha'], [/dysphagia/i, 'dysphagia'],
    [/malar rash|acute cutaneous lupus/i, 'acle'], [/sclerodactyly/i, 'sclerodactyly'], [/hypertensive (emergency|urgency)|malignant hypertension/i, 'newhtn'], [/(lung|pulmonary) nodules?|cavitating nodule/i, 'nodules'],
  ];

  // ---------- Medication lists ----------
  const DIL_DRUGS = /hydralazine|procainamide|isoniazid|minocycline|quinidine|methyldopa|chlorpromazine|infliximab|adalimumab|etanercept|certolizumab|golimumab|terbinafine|sulfasalazine|carbamazepine|phenytoin|propylthiouracil|interferon|diltiazem|hydrochlorothiazide/i;
  const ANCA_DRUGS = /hydralazine|propylthiouracil|methimazole|minocycline|levamisole|allopurinol|sulfasalazine/i;
  const ANTICOAG = /warfarin|apixaban|rivaroxaban|dabigatran|edoxaban|heparin|enoxaparin|dalteparin|tinzaparin|fondaparinux|argatroban|bivalirudin/i;
  const STATIN = /statin\b|atorvastatin|rosuvastatin|simvastatin|pravastatin|lovastatin|fluvastatin|pitavastatin/i;

  // ---------- Observation parsing ----------
  function parseObservation(o) {
    const out = [];
    const base = {
      date: o.effectiveDateTime || (o.effectivePeriod && o.effectivePeriod.start) || o.issued || '',
      id: o.id,
    };
    const one = (codeObj, src) => {
      const name = (codeObj && (codeObj.text || (codeObj.coding && codeObj.coding[0] && codeObj.coding[0].display))) || '';
      const p = Object.assign({}, base, { name, num: null, unit: '', str: '', comparator: '', interp: '', lo: null, hi: null, rrText: '' });
      if (src.valueQuantity) {
        p.num = src.valueQuantity.value; p.unit = src.valueQuantity.unit || src.valueQuantity.code || '';
        p.comparator = src.valueQuantity.comparator || '';
      } else if (src.valueString) p.str = src.valueString;
      else if (src.valueCodeableConcept) p.str = src.valueCodeableConcept.text || (src.valueCodeableConcept.coding && src.valueCodeableConcept.coding[0] && src.valueCodeableConcept.coding[0].display) || '';
      else if (src.valueBoolean != null) p.str = src.valueBoolean ? 'positive' : 'negative';
      const it = src.interpretation && src.interpretation[0];
      if (it) p.interp = (it.coding && it.coding[0] && it.coding[0].code) || it.text || '';
      const rr = src.referenceRange && src.referenceRange[0];
      if (rr) { p.lo = rr.low ? rr.low.value : null; p.hi = rr.high ? rr.high.value : null; p.rrText = rr.text || ''; }
      if (p.num == null && p.str && /^\s*[<>]?\s*-?\d+(\.\d+)?\s*$/.test(p.str)) { // numeric string
        const m = p.str.match(/([<>])?\s*(-?\d+(\.\d+)?)/); p.comparator = m[1] || ''; p.num = parseFloat(m[2]);
      }
      p.display = p.str || (p.num != null ? `${p.comparator}${p.num} ${p.unit}`.trim() : '');
      return p;
    };
    if (o.valueQuantity || o.valueString || o.valueCodeableConcept || o.valueBoolean != null) out.push(one(o.code, o));
    (o.component || []).forEach(c => {
      const p = one(c.code, c);
      if (!p.name) p.name = one(o.code, o).name;
      out.push(p);
    });
    return out;
  }

  function matchTest(name) {
    if (!name) return null;
    for (const t of TESTS) {
      if (t.re.test(name) && !(t.not && t.not.test(name))) return t;
    }
    return null;
  }

  function qualFrom(p) {
    const s = (p.str || '').toLowerCase();
    if (s) {
      if (/equivocal|indeterminate|borderline|weak(ly)? pos|trace/.test(s)) return 'equiv';
      if (/neg|not detected|non-?reactive|absent|none seen|<\s*1\s*:\s*40|\bnil\b/.test(s)) return 'neg';
      if (/pos|detected|reactive|present|1\s*:\s*\d+|[1-4]\s*\+|large|moderate|small/.test(s)) return 'pos';
    }
    const ic = (p.interp || '').toUpperCase();
    if (/^(POS|DET|H|HH|HU|A|AA|>)$/.test(ic)) return 'pos';
    if (/^(NEG|ND|N|NR)$/.test(ic)) return 'neg';
    if (p.num != null) {
      if (p.comparator === '<') return 'neg';
      if (p.hi != null) return p.num > p.hi ? 'pos' : 'neg';
    }
    return null;
  }

  function convertNum(t, num, unit) {
    if (num == null) return null;
    const u = (unit || '').toLowerCase();
    switch (t.id) {
      case 'wbc': case 'plt': case 'eos':
        if (/%/.test(u)) return null;
        if (/(u|µ|mc)l|mm3|cumm/.test(u) && (t.id !== 'eos' ? num > 50 : num > 20)) return num / 1000;
        if (t.id === 'eos' && !u && num > 20) return null; // likely percent / per µL ambiguity
        return num;
      case 'hb': return /g\/dl/.test(u) ? num * 10 : num;
      case 'cr': return /mg\/dl/.test(u) ? num * 88.4 : num;
      case 'crp': return /mg\/dl/.test(u) ? num * 10 : num;
      case 'igg': return /mg\/dl/.test(u) ? num / 100 : num;
      case 'upcr':
        if (/mg\/mmol|g\/mol/.test(u)) return num / 113;
        if (/g\/mmol/.test(u)) return (num * 1000) / 113;
        if (/mg\/g/.test(u)) return num / 1000;
        return num; // g/g or mg/mg
      default: return num;
    }
  }

  // returns {v, disp, hi} or null
  function interpretFor(t, p) {
    const disp = p.display;
    switch (t.type) {
      case 'titer': {
        const m = (p.str || '').match(/1\s*:\s*(\d+)/);
        let titer = m ? parseInt(m[1], 10) : null;
        if (titer == null && p.num != null && p.num >= 20 && (/tit/i.test(p.unit) || p.num % 10 === 0)) titer = p.num;
        if (titer != null) return { v: titer >= 1280 ? 1280 : titer < 40 ? 'neg' : titer, disp };
        const q = qualFrom(p);
        return q ? { v: q === 'equiv' ? 40 : q, disp } : null;
      }
      case 'pattern': {
        const s = (p.str || '').toLowerCase();
        const v = /dense fine|dfs/.test(s) ? 'dfs' : /centromere/.test(s) ? 'centromere' : /nucleol/.test(s) ? 'nucleolar' :
          /homogen|diffuse/.test(s) ? 'homogeneous' : /speckl/.test(s) ? 'speckled' : /rim|periph|envelope|membran/.test(s) ? 'rim' :
          /cytoplasm/.test(s) ? 'cytoplasmic' : s ? 'mixed' : '';
        return v ? { v, disp } : null;
      }
      case 'aiif': {
        const s = (p.str || '').toLowerCase();
        if (/atyp|x-?anca/.test(s)) return { v: 'atyp', disp };
        if (/\bc-?anca|cytoplasmic/.test(s)) return { v: 'c', disp };
        if (/\bp-?anca|perinuclear/.test(s)) return { v: 'p', disp };
        const q = qualFrom(p); if (!q) return null;
        return { v: q === 'pos' ? 'pos' : q === 'neg' ? 'neg' : 'pos', disp };
      }
      case 'ra': {
        const q = qualFrom(p); if (!q) return null;
        if (q === 'neg') return { v: 'neg', disp };
        if (p.num != null && p.hi) return { v: p.num > 3 * p.hi ? 'high' : 'low', disp: `${disp} (${(p.num / p.hi).toFixed(1)}× ULN)` };
        return { v: 'low', disp: disp + ' (ULN unknown — assumed low positive)' };
      }
      case 'comp': {
        const ic = (p.interp || '').toUpperCase();
        let num = p.num; if (num != null && /mg\/dl/i.test(p.unit)) num = num / 100;
        const lo = p.lo != null ? (/mg\/dl/i.test(p.unit) ? p.lo / 100 : p.lo) : t.lo;
        const hi = p.hi != null ? (/mg\/dl/i.test(p.unit) ? p.hi / 100 : p.hi) : t.hi;
        if (/^(L|LL)$/.test(ic)) return { v: 'low', disp };
        if (/^(H|HH)$/.test(ic)) return { v: 'high', disp };
        if (num != null && lo != null && num < lo) return { v: 'low', disp };
        if (num != null && hi != null && num > hi) return { v: 'high', disp };
        if (num != null) return { v: 'normal', disp };
        const s = (p.str || '').toLowerCase();
        return /low|decreas/.test(s) ? { v: 'low', disp } : /normal/.test(s) ? { v: 'normal', disp } : null;
      }
      case 'myo': {
        const q = qualFrom(p); if (!q) return null;
        if (q === 'neg') return { v: 'neg', disp };
        const n = p.name;
        const v = /PL.?7|PL.?12|\bEJ\b|\bOJ\b/i.test(n) ? 'synth' : /MDA.?5/i.test(n) ? 'mda5' : /Mi.?2/i.test(n) ? 'mi2' : /TIF/i.test(n) ? 'tif1' :
          /NXP/i.test(n) ? 'nxp2' : /SAE/i.test(n) ? 'sae' : /SRP/i.test(n) ? 'srp' : /HMG/i.test(n) ? 'hmgcr' : 'other';
        return { v, disp: `${n}: ${disp}` };
      }
      case 'num': {
        const n = convertNum(t, p.num, p.unit); if (n == null) return null;
        const hi = p.hi != null ? convertNum(t, p.hi, p.unit) : null;
        return { v: Math.round(n * 100) / 100, disp, hi };
      }
      default: { // 'ab'
        const q = qualFrom(p); if (!q) return null;
        let d = disp;
        if (q === 'pos' && p.num != null && p.hi) d += ` (${(p.num / p.hi).toFixed(1)}× ULN)`;
        return { v: q, disp: d };
      }
    }
  }

  /** Build state from a list of FHIR Observations. Latest result per test wins.
   *  For 'myo' and 'ab' tests a later negative does not hide an earlier positive within the window
   *  (positives are kept and flagged), because antibodies are usually not repeated. */
  function stateFromObservations(observations) {
    const parsed = [];
    observations.forEach(o => parseObservation(o).forEach(p => parsed.push(p)));
    parsed.sort((a, b) => String(b.date).localeCompare(String(a.date)));
    const S = {}; const unmatched = [];
    parsed.forEach(p => {
      const t = matchTest(p.name);
      if (!t) { if (/anti|antibod|\bAb\b|ANA|ANCA|complement/i.test(p.name)) unmatched.push(p); return; }
      const r = interpretFor(t, p); if (!r) return;
      const rec = { v: r.v, disp: r.disp, hi: r.hi, date: p.date, src: 'chart', raw: p.name };
      if (!S[t.id]) S[t.id] = rec;
      else if (t.type === 'myo' && S[t.id].v === 'neg' && r.v !== 'neg') S[t.id] = Object.assign(rec, { note: 'earlier positive in a panel' });
    });
    return { S, unmatched };
  }

  // ---------- Evaluation ----------
  function evaluate(S, F, ctx) {
    S = S || {}; F = Object.assign({}, F || {}); ctx = ctx || {};
    const age = ctx.age; const sex = (ctx.sex || '').toLowerCase();
    if (age != null && age >= 50) F.age50 = true;
    const meds = (ctx.meds || []).join(' | ');

    const v = id => (S[id] && S[id].v !== '' && S[id].v != null ? S[id].v : null);
    const done = id => v(id) != null;
    const pos = id => { const t = TEST[id]; const x = v(id); if (x == null) return false;
      if (t.type === 'ra') return x === 'low' || x === 'high';
      if (t.type === 'aiif') return x !== 'neg';
      if (t.type === 'myo') return x !== 'neg';
      if (t.type === 'titer') return x === 'pos' || (typeof x === 'number' && x >= 80);
      return x === 'pos'; };
    const neg = id => v(id) === 'neg';
    const num = id => (typeof v(id) === 'number' ? v(id) : null);
    const hiOf = id => (S[id] && S[id].hi) || (TEST[id] && TEST[id].hiDefault) || null;
    const lab = (id, fmt) => (num(id) != null ? `${TEST[id].name} ${num(id)}${fmt ? ' ' + TEST[id].unit : ''}` : '');

    // derived lab facts
    const wbc = num('wbc'), plt = num('plt'), eos = num('eos'), upcr = num('upcr'), cr = num('cr');
    const leuko = wbc != null && wbc < 4;
    const thrombo = plt != null && plt < 100;
    const eos1 = eos != null && eos >= 1;
    const prot = (upcr != null && upcr > 0.5) || !!F.proteinuria;
    const esrHi = num('esr') != null && num('esr') > (age != null ? (sex === 'female' ? (age + 10) / 2 : age / 2) : 20);
    const crpHi = num('crp') != null && num('crp') > (hiOf('crp') || 10);
    const ckHi = num('ck') != null && num('ck') > (hiOf('ck') || 200);
    const altHi = num('alt') != null && num('alt') > (hiOf('alt') || 40);
    const alpHi = num('alp') != null && num('alp') > (hiOf('alp') || 120);
    const iggHi = num('igg') != null && num('igg') > (hiOf('igg') || 16);
    const hematuria = pos('uablood') || !!F.hematuria;
    const lowC3 = v('c3') === 'low', lowC4 = v('c4') === 'low';
    const apl = pos('acl') || pos('b2gpi') || pos('lac');
    const canca = v('anca') === 'c' || pos('pr3');
    const panca = v('anca') === 'p' || pos('mpo');
    const anaT = v('ana');
    const ana = { done: anaT != null, pos80: pos('ana'), neg: anaT === 'neg' || anaT === 40, titer: typeof anaT === 'number' ? anaT : null, unknownTiter: anaT === 'pos' };
    const anaTxt = anaT == null ? 'not done' : optLabel('titer', anaT);
    const onAnticoag = ANTICOAG.test(meds);

    const cards = []; const flags = []; const nextSet = new Map();
    const next = (test, why) => { if (!nextSet.has(test)) nextSet.set(test, why); };
    const mk = (key, name, basis) => { const c = { key, name, basis, pts: [], notes: [], verdict: 'na', score: null, threshold: null }; cards.push(c); return c; };
    const P = (c, s, t, w) => c.pts.push({ s, t, w: w == null ? null : w });

    // ===== SLE =====
    {
      const c = mk('sle', 'Systemic lupus erythematosus (SLE)', '2019 EULAR/ACR classification (entry ANA ≥1:80; ≥10 points with ≥1 clinical item)');
      const sleFeat = F.acle || F.scle || F.oral || F.alopecia || F.synovitis || F.effusion || F.pericarditis || F.ln25 || F.ln34 || prot || leuko || thrombo || F.aiha;
      if (!ana.done) {
        P(c, '?', 'ANA not done — entry criterion is ANA ≥1:80 on HEp-2 cells');
        if (sleFeat || done('dsdna') || done('sm')) { c.verdict = 'possible'; next('ANA (HEp-2 IIF) with titre and pattern', 'SLE entry criterion'); }
      } else if (!ana.pos80) {
        c.verdict = 'unlikely';
        P(c, '✗', `ANA ${anaTxt} — entry criterion (≥1:80) not met. ANA ≥1:80 is present in ~98% of SLE, so a negative ANA makes SLE very unlikely`);
        if (pos('ro')) c.notes.push('Anti-Ro can be positive with a negative/low HEp-2 ANA (Ro is partly cytoplasmic). If SLE is strongly suspected, repeat ANA by another method.');
      } else {
        P(c, '✓', `Entry criterion met: ANA ${anaTxt}${ana.unknownTiter ? ' (confirm titre ≥1:80)' : ''}`);
        const domains = [
          ['Constitutional', [[F.fever, 2, 'Fever']]],
          ['Hematologic', [[leuko, 3, `Leukopenia (WBC ${wbc} ×10⁹/L)`], [thrombo, 4, `Thrombocytopenia (platelets ${plt})`], [F.aiha, 4, 'Autoimmune hemolysis']]],
          ['Neuropsychiatric', [[F.delirium, 2, 'Delirium'], [F.psychosis, 3, 'Psychosis'], [F.seizure, 5, 'Seizure']]],
          ['Mucocutaneous', [[F.alopecia, 2, 'Non-scarring alopecia'], [F.oral, 2, 'Oral ulcers'], [F.scle, 4, 'Subacute cutaneous / discoid lupus'], [F.acle, 6, 'Acute cutaneous lupus']]],
          ['Serosal', [[F.effusion, 5, 'Pleural or pericardial effusion'], [F.pericarditis, 6, 'Acute pericarditis']]],
          ['Musculoskeletal', [[F.synovitis, 6, 'Joint involvement']]],
          ['Renal', [[prot, 4, `Proteinuria >0.5 g/day${upcr != null ? ` (UPCR ≈${upcr.toFixed(2)} g/g)` : ''}`], [F.ln25, 8, 'Lupus nephritis class II or V'], [F.ln34, 10, 'Lupus nephritis class III or IV']]],
        ];
        const immun = [
          ['Antiphospholipid', [[apl, 2, 'Antiphospholipid antibody positive']]],
          ['Complement', [[lowC3 || lowC4, 3, `Low ${lowC3 && !lowC4 ? 'C3' : !lowC3 && lowC4 ? 'C4' : 'C3 or C4'}`], [lowC3 && lowC4, 4, 'Low C3 and low C4']]],
          ['SLE-specific antibodies', [[pos('dsdna') || pos('sm'), 6, `Anti-${pos('dsdna') && pos('sm') ? 'dsDNA and anti-Sm' : pos('dsdna') ? 'dsDNA' : 'Sm'} positive`]]],
        ];
        let clin = 0, imm = 0;
        const run = (list, isClin) => list.forEach(([dname, items]) => {
          const met = items.filter(i => i[0]).sort((a, b) => b[1] - a[1])[0];
          if (met) { P(c, '✓', `${dname}: ${met[2]}`, met[1]); if (isClin) clin += met[1]; else imm += met[1]; }
        });
        run(domains, true); run(immun, false);
        if (!done('dsdna')) { P(c, '?', 'Anti-dsDNA not done (worth 6)'); next('Anti-dsDNA', 'SLE-specific; tracks nephritis/activity'); }
        else if (neg('dsdna')) P(c, '✗', 'Anti-dsDNA negative');
        if (!done('sm')) { P(c, '?', 'Anti-Sm not done (worth 6)'); next('ENA panel (Sm, RNP, Ro, La, Scl-70, Jo-1, centromere)', 'ANA is positive'); }
        if (!done('c3') || !done('c4')) { P(c, '?', 'C3/C4 not done (worth 3–4)'); next('C3 and C4', 'Low complement supports SLE / immune-complex disease'); }
        if (!done('acl') && !done('b2gpi') && !done('lac')) P(c, '?', 'Antiphospholipid antibodies not done (worth 2)');
        if (upcr == null && !F.proteinuria) next('Urinalysis with microscopy + urine protein/creatinine ratio', 'screen for lupus nephritis');
        if (wbc == null) next('CBC with differential', 'cytopenias');
        const tot = clin + imm; c.score = tot; c.threshold = 10;
        c.verdict = tot >= 10 && clin > 0 ? 'meets' : (tot >= 10 || (tot >= 7 && imm > 0) || pos('dsdna') || pos('sm')) ? 'possible' : 'unlikely';
        if (pos('histone') && neg('dsdna') && DIL_DRUGS.test(meds)) c.notes.push('Pattern also fits drug-induced lupus (anti-histone +, dsDNA −, culprit drug) — see that card before labelling SLE.');
        if (c.verdict === 'unlikely') c.notes.push('A positive ANA by itself is common (≈13% of healthy people at 1:80, ≈5% at 1:160) and does not make the diagnosis.');
        if (pos('dsdna') && (lowC3 || lowC4)) c.notes.push('Anti-dsDNA with low complement suggests active disease — check urine sediment and UPCR for nephritis.');
        if (v('anapat') === 'dfs') c.notes.push('Isolated DFS70 pattern argues against SLE and other systemic autoimmune disease.');
        if (pos('ro')) c.notes.push('Anti-Ro in a woman of child-bearing age: risk of neonatal lupus / congenital heart block — counsel before pregnancy.');
      }
    }

    // ===== Drug-induced lupus =====
    {
      const c = mk('dil', 'Drug-induced lupus', 'Pattern: anti-histone + culprit drug, dsDNA usually negative, complement normal');
      const m = meds.match(DIL_DRUGS);
      if (m) P(c, '✓', `On a recognised culprit drug: ${m[0]}`); else P(c, ctx.meds && ctx.meds.length ? '✗' : '?', ctx.meds && ctx.meds.length ? 'No classic culprit drug on the medication list' : 'Medication list not available');
      if (pos('histone')) P(c, '✓', 'Anti-histone positive (≈95% of DIL; also seen in idiopathic SLE)');
      else if (neg('histone')) P(c, '✗', 'Anti-histone negative'); else P(c, '?', 'Anti-histone not done');
      if (neg('dsdna')) P(c, '✓', 'Anti-dsDNA negative (typical; TNF-inhibitor lupus is the exception)');
      if (pos('dsdna')) P(c, m && /mab|cept/i.test(m[0]) ? '~' : '✗', 'Anti-dsDNA positive (favours idiopathic SLE unless on a TNF inhibitor)');
      if (done('c3') && !lowC3 && !lowC4) P(c, '✓', 'Complement normal');
      if (ana.pos80 && v('anapat') === 'homogeneous') P(c, '✓', 'Homogeneous ANA pattern');
      if (pos('histone') && m) c.verdict = 'meets';
      else if ((pos('histone') && ana.pos80) || (m && ana.pos80)) { c.verdict = 'possible'; if (!done('histone')) next('Anti-histone antibody', 'ANA positive on a culprit drug'); }
      else if (ana.done && !ana.pos80) c.verdict = 'unlikely';
      c.notes.push('Usually arthralgia, myalgia, fever, serositis; renal and CNS disease are rare. Stop the drug — symptoms settle over weeks, ANA can stay positive for months.');
      if (/hydralazine/i.test(meds)) c.notes.push('Hydralazine can also cause ANCA (MPO) vasculitis with GN — check ANCA and urine if kidney involvement.');
    }

    // ===== RA =====
    {
      const c = mk('ra', 'Rheumatoid arthritis', '2010 ACR/EULAR classification (≥6/10, needs ≥1 joint with definite synovitis)');
      let sc = 0;
      const j = F.raJoints != null && F.raJoints !== '' ? parseInt(F.raJoints, 10) : null;
      if (j != null) { P(c, '✓', `Joint involvement: ${RA_JOINTS.find(x => x[0] === String(j))[1]}`, j); sc += j; }
      else P(c, '?', 'Joint count not entered (Clinical features → RA joint count)');
      const ser = v('rf') === 'high' || v('ccp') === 'high' ? 3 : (pos('rf') || pos('ccp')) ? 2 : 0;
      if (ser) P(c, '✓', `Serology: ${['rf', 'ccp'].filter(pos).map(x => `${TEST[x].name} ${optLabel('ra', v(x))}`).join(', ')}`, ser);
      else if (done('rf') || done('ccp')) P(c, '✗', `${['rf', 'ccp'].filter(done).map(x => TEST[x].name).join(' and ')} negative`);
      if (!done('ccp')) { P(c, '?', 'Anti-CCP not done'); if (pos('rf') || F.synovitis || j != null) next('Anti-CCP', 'more specific than RF (~95%)'); }
      if (!done('rf') && (F.synovitis || j != null)) next('Rheumatoid factor', 'RA serology');
      sc += ser;
      if (esrHi || crpHi) { P(c, '✓', `Abnormal acute-phase reactant (${[esrHi && lab('esr', 1), crpHi && lab('crp', 1)].filter(Boolean).join(', ')})`, 1); sc += 1; }
      else if (num('esr') == null && num('crp') == null) P(c, '?', 'ESR/CRP not available');
      if (F.dur6) { P(c, '✓', 'Symptoms ≥6 weeks', 1); sc += 1; }
      c.score = sc; c.threshold = 6;
      c.verdict = sc >= 6 && (j != null || F.synovitis) ? 'meets' : (ser >= 2 || (F.synovitis && sc >= 3)) ? 'possible' : (j == null && !F.synovitis && !ser) ? 'na' : 'unlikely';
      if (pos('rf') && neg('ccp')) c.notes.push('RF positive but anti-CCP negative: RF is non-specific — also seen with ageing, HCV, endocarditis, TB, Sjögren, cryoglobulinemia, chronic liver/lung disease.');
      if (pos('ccp')) c.notes.push('Anti-CCP positive: high specificity for RA (~95%), predicts erosive disease; can precede arthritis by years.');
    }

    // ===== Sjögren =====
    {
      const c = mk('sjogren', 'Sjögren disease', '2016 ACR/EULAR classification (≥4 points, with sicca symptoms or suggestive systemic feature)');
      let sc = 0;
      const add = (cond, w, t) => { if (cond) { P(c, '✓', t, w); sc += w; } };
      add(pos('ro'), 3, 'Anti-Ro/SSA positive');
      add(F.lipbx, 3, 'Labial gland focus score ≥1');
      add(F.ocular, 1, 'Ocular staining score ≥5');
      add(F.schirmer, 1, 'Schirmer ≤5 mm/5 min');
      add(F.saliva, 1, 'Unstimulated salivary flow ≤0.1 mL/min');
      if (!done('ro')) { P(c, '?', 'Anti-Ro/SSA not done (worth 3)'); if (F.sicca) next('Anti-Ro/SSA (ENA panel)', 'sicca symptoms'); }
      else if (neg('ro')) P(c, '✗', 'Anti-Ro/SSA negative');
      if (pos('la') && !pos('ro')) P(c, '~', 'Isolated anti-La no longer counts in the 2016 criteria');
      if (F.sicca) P(c, '✓', 'Sicca symptoms (entry)'); else P(c, '?', 'Sicca symptoms not ticked (entry criterion)');
      c.score = sc; c.threshold = 4;
      c.verdict = sc >= 4 && F.sicca ? 'meets' : (pos('ro') || F.sicca) ? 'possible' : done('ro') ? 'unlikely' : 'na';
      if (pos('ro')) c.notes.push('RF positivity and hypergammaglobulinemia are common. Watch for parotid swelling, cryoglobulins and low C4 (lymphoma risk markers).');
    }

    // ===== Systemic sclerosis =====
    {
      const c = mk('ssc', 'Systemic sclerosis (scleroderma)', '2013 ACR/EULAR classification (≥9 points; proximal skin thickening alone is sufficient)');
      let sc = 0; const ab = pos('centromere') || pos('scl70') || pos('rnapol');
      const best = (items) => { const m = items.filter(i => i[0]).sort((a, b) => b[1] - a[1])[0]; if (m) { P(c, '✓', m[2], m[1]); sc += m[1]; } };
      best([[F.skinprox, 9, 'Skin thickening proximal to MCPs']]);
      best([[F.puffy, 2, 'Puffy fingers'], [F.sclerodactyly, 4, 'Sclerodactyly']]);
      best([[F.digulcer, 2, 'Digital tip ulcers'], [F.pitscar, 3, 'Digital pitting scars']]);
      best([[F.telang, 2, 'Telangiectasia']]); best([[F.nailfold, 2, 'Abnormal nailfold capillaries']]);
      best([[F.pah || F.ild, 2, 'PAH and/or ILD']]); best([[F.raynaud, 3, 'Raynaud phenomenon']]);
      best([[ab, 3, `SSc antibody: ${['centromere', 'scl70', 'rnapol'].filter(pos).map(x => TEST[x].name).join(', ')}`]]);
      if (!ab && !['centromere', 'scl70', 'rnapol'].some(done)) { P(c, '?', 'SSc antibodies not done'); if (F.raynaud || F.puffy || F.sclerodactyly || v('anapat') === 'nucleolar' || v('anapat') === 'centromere') next('Anti-centromere, anti-Scl-70, anti-RNA polymerase III', 'Raynaud / skin changes or nucleolar/centromere ANA'); }
      c.score = sc; c.threshold = 9;
      c.verdict = sc >= 9 ? 'meets' : (ab || (F.raynaud && (F.puffy || F.sclerodactyly))) ? 'possible' : (F.raynaud || F.puffy) ? 'unlikely' : 'na';
      if (pos('scl70')) c.notes.push('Anti-Scl-70: diffuse skin disease, high ILD risk — HRCT and PFTs (with DLCO).');
      if (pos('centromere')) c.notes.push('Anti-centromere: limited cutaneous SSc (CREST); PAH risk — echo and DLCO. Also seen with PBC.');
      if (pos('rnapol')) c.notes.push('Anti-RNA pol III: rapid diffuse skin, SCLERODERMA RENAL CRISIS risk (check BP, creatinine often; avoid prednisone >15 mg/day), cancer within ±2 y of onset.');
    }

    // ===== MCTD =====
    {
      const c = mk('mctd', 'Mixed connective tissue disease', 'Alarcón-Segovia: high-titre anti-U1-RNP + ≥3 of 5 clinical (incl. synovitis or myositis)');
      const items = [[F.puffy, 'Swollen hands'], [F.synovitis, 'Synovitis'], [F.weakness || ckHi, 'Myositis (weakness or high CK)'], [F.raynaud, 'Raynaud'], [F.sclerodactyly, 'Acrosclerosis']];
      const met = items.filter(i => i[0]); met.forEach(i => P(c, '✓', i[1]));
      if (pos('rnp')) P(c, '✓', 'Anti-U1-RNP positive'); else if (neg('rnp')) P(c, '✗', 'Anti-U1-RNP negative'); else P(c, '?', 'Anti-U1-RNP not done');
      const synMyo = F.synovitis || F.weakness || ckHi;
      c.score = met.length; c.threshold = 3;
      c.verdict = pos('rnp') && met.length >= 3 && synMyo ? 'meets' : pos('rnp') ? 'possible' : neg('rnp') ? 'unlikely' : 'na';
      if (pos('rnp') && (pos('sm') || pos('dsdna'))) c.notes.push('Anti-Sm or anti-dsDNA also present — favours SLE over MCTD.');
      if (pos('rnp')) c.notes.push('Screen for PAH (echo) and ILD — main causes of death in MCTD.');
    }

    // ===== Inflammatory myopathy / antisynthetase =====
    {
      const c = mk('myositis', 'Inflammatory myopathy / antisynthetase syndrome', 'Antibody + clinical pattern (Connors antisynthetase: antibody + ≥1 of ILD, myositis, arthritis)');
      const synth = pos('jo1') || v('myo') === 'synth';
      const myoAb = synth || pos('myo');
      if (pos('jo1')) P(c, '✓', 'Anti-Jo-1 positive');
      if (pos('myo')) P(c, '✓', `${optLabel('myo', v('myo'))} positive`);
      if (!myoAb && !done('jo1') && !done('myo')) P(c, '?', 'Myositis antibodies not done');
      [[F.weakness, 'Proximal weakness'], [ckHi, lab('ck', 1) + ' (high)'], [F.ild, 'ILD'], [F.mechanic, 'Mechanic\'s hands'], [F.gottron, 'Heliotrope / Gottron'], [F.synovitis, 'Arthritis'], [F.raynaud, 'Raynaud'], [F.dysphagia, 'Dysphagia / respiratory weakness']]
        .forEach(([cond, t]) => { if (cond) P(c, '✓', t); });
      if (synth && (F.ild || F.weakness || ckHi || F.synovitis)) c.verdict = 'meets';
      else if (myoAb || ((F.weakness || F.gottron) && ckHi)) c.verdict = 'possible';
      else if (((F.weakness && ckHi) || (F.ild && (F.mechanic || F.weakness))) && !done('jo1')) { c.verdict = 'possible'; }
      if ((F.weakness && ckHi) || F.gottron || (F.ild && F.mechanic)) next('Myositis antibody panel (Jo-1, PL-7, PL-12, EJ, OJ, MDA5, Mi-2, TIF1-γ, NXP2, SAE, SRP, HMGCR) + aldolase', 'weakness/high CK, skin or ILD');
      if (v('myo') === 'mda5') { c.notes.push('Anti-MDA5: rapidly progressive ILD risk (often with little myositis, skin ulcers) — urgent HRCT, involve rheumatology/respirology today.'); flags.push('Anti-MDA5 positive: risk of rapidly progressive ILD — urgent HRCT, oxygen monitoring, rheumatology + respirology.'); }
      if (v('myo') === 'tif1' || v('myo') === 'nxp2') c.notes.push('Anti-TIF1-γ / NXP2 in adults: strong cancer association — age-appropriate cancer screening (CT chest/abdo/pelvis ± mammogram, etc.).');
      if (v('myo') === 'hmgcr') c.notes.push(`Anti-HMGCR: immune-mediated necrotizing myopathy${STATIN.test(meds) ? ' — patient is on a statin; stop it' : ' (statin exposure common)'}; does not settle with statin withdrawal alone.`);
      if (v('myo') === 'srp') c.notes.push('Anti-SRP: severe necrotizing myopathy, can involve heart/dysphagia.');
      if (F.dysphagia) flags.push('Myositis with dysphagia or respiratory muscle weakness: aspiration and respiratory failure risk — swallow assessment, FVC/NIF.');
    }

    // ===== ANCA vasculitis (GPA / MPA / EGPA) =====
    const ancaNote = () => {
      const notes = [];
      const m = meds.match(ANCA_DRUGS);
      if (m || F.cocaine) notes.push(`Drug-induced ANCA possible (${[m && m[0], F.cocaine && 'cocaine/levamisole'].filter(Boolean).join(', ')}): often MPO high titre, sometimes PR3+MPO double positive.`);
      if (v('anca') && v('anca') !== 'neg' && done('pr3') && done('mpo') && !pos('pr3') && !pos('mpo')) notes.push('ANCA IIF positive but PR3 and MPO negative: low specificity — consider IBD, PSC, autoimmune hepatitis, infection, drugs.');
      if (v('anca') === 'atyp') notes.push('Atypical ANCA is seen with IBD, PSC, AIH, infections — not typical of AAV.');
      notes.push('Endocarditis, TB and other infections can cause positive ANCA (usually PR3) and GN — get blood cultures before immunosuppression if any fever.');
      return notes;
    };
    const ancaDone = done('anca') || done('pr3') || done('mpo');
    const vascClues = F.hematuria || F.rpgn || F.pulmhem || F.nasal || F.nodules || F.purpura || F.mononeuritis || F.pigN || F.cartilage;
    if (vascClues && !ancaDone) next('ANCA with PR3 and MPO by ELISA/immunoassay', 'features of small-vessel vasculitis');
    if (ancaDone && (v('anca') === 'c' || v('anca') === 'p' || v('anca') === 'pos') && (!done('pr3') || !done('mpo'))) next('Anti-PR3 and anti-MPO immunoassay', 'confirm positive ANCA IIF');
    {
      const c = mk('gpa', 'Granulomatosis with polyangiitis (GPA)', '2022 ACR/EULAR classification (≥5; apply only once small/medium-vessel vasculitis is diagnosed)');
      let sc = 0; const add = (cond, w, t) => { if (cond) { P(c, w > 0 ? '✓' : '✗', t, w); sc += w; } };
      add(F.nasal, 3, 'Nasal involvement'); add(F.cartilage, 2, 'Cartilaginous involvement'); add(F.hearing, 1, 'Conductive hearing loss');
      add(canca, 5, `${v('anca') === 'c' ? 'c-ANCA' : ''}${v('anca') === 'c' && pos('pr3') ? ' / ' : ''}${pos('pr3') ? 'anti-PR3' : ''} positive`);
      add(F.nodules, 2, 'Lung nodules, mass or cavitation'); add(F.granuloma, 2, 'Granuloma on biopsy'); add(F.sinusimg, 1, 'Sinus inflammation on imaging');
      add(F.pigN, 1, 'Pauci-immune GN'); add(panca, -1, 'p-ANCA / anti-MPO positive'); add(eos1, -4, `Eosinophils ≥1 ×10⁹/L (${eos})`);
      if (!ancaDone) P(c, '?', 'ANCA not done');
      c.score = sc; c.threshold = 5;
      c.verdict = sc >= 5 ? 'meets' : (canca || (F.nasal && (F.nodules || F.hematuria))) ? 'possible' : ancaDone ? 'unlikely' : 'na';
      c.notes.push(...ancaNote());
    }
    {
      const c = mk('mpa', 'Microscopic polyangiitis (MPA)', '2022 ACR/EULAR classification (≥5; apply only once vasculitis is diagnosed)');
      let sc = 0; const add = (cond, w, t) => { if (cond) { P(c, w > 0 ? '✓' : '✗', t, w); sc += w; } };
      add(panca, 6, `${v('anca') === 'p' ? 'p-ANCA' : ''}${v('anca') === 'p' && pos('mpo') ? ' / ' : ''}${pos('mpo') ? 'anti-MPO' : ''} positive`);
      add(F.ild, 3, 'Fibrosis or ILD on chest imaging'); add(F.pigN, 3, 'Pauci-immune GN on biopsy');
      add(canca, -1, 'c-ANCA / anti-PR3 positive'); add(eos1, -4, `Eosinophils ≥1 ×10⁹/L (${eos})`); add(F.nasal, -3, 'Nasal involvement');
      if (!ancaDone) P(c, '?', 'ANCA not done');
      c.score = sc; c.threshold = 5;
      c.verdict = sc >= 5 ? 'meets' : (panca || (F.hematuria && F.rpgn)) ? 'possible' : ancaDone ? 'unlikely' : 'na';
      c.notes.push(...ancaNote().slice(0, 2));
    }
    {
      const c = mk('egpa', 'Eosinophilic granulomatosis with polyangiitis (EGPA)', '2022 ACR/EULAR classification (≥6; apply only once vasculitis is diagnosed)');
      let sc = 0; const add = (cond, w, t) => { if (cond) { P(c, w > 0 ? '✓' : '✗', t, w); sc += w; } };
      add(F.asthma, 3, 'Obstructive airway disease / asthma'); add(F.polyps, 3, 'Nasal polyps'); add(F.mononeuritis, 1, 'Mononeuritis multiplex');
      add(eos1, 5, `Eosinophils ≥1 ×10⁹/L (${eos})`); add(F.eosinfl, 2, 'Extravascular eosinophilic inflammation');
      add(canca, -3, 'c-ANCA / anti-PR3 positive'); add(hematuria, -1, 'Hematuria');
      if (eos == null) P(c, '?', 'Absolute eosinophil count not available');
      c.score = sc; c.threshold = 6;
      c.verdict = sc >= 6 ? 'meets' : (eos1 || (F.asthma && (F.polyps || F.mononeuritis))) ? 'possible' : (F.asthma || F.polyps) ? 'unlikely' : 'na';
      c.notes.push('ANCA (usually MPO) is positive in only ~30–40% of EGPA; a negative ANCA does not exclude it. Check troponin/ECG/echo — cardiac involvement is the main cause of death.');
    }

    // ===== Anti-GBM =====
    {
      const c = mk('gbm', 'Anti-GBM disease (Goodpasture)', 'Anti-GBM antibody + RPGN ± alveolar hemorrhage');
      if (pos('gbm')) P(c, '✓', 'Anti-GBM positive'); else if (neg('gbm')) P(c, '✗', 'Anti-GBM negative'); else P(c, '?', 'Anti-GBM not done');
      if (F.rpgn) P(c, '✓', 'Rapidly rising creatinine'); if (hematuria) P(c, '✓', 'Hematuria / active sediment'); if (F.pulmhem) P(c, '✓', 'Alveolar hemorrhage');
      if (done('c3') && !lowC3) P(c, '✓', 'Complement normal (typical)');
      c.verdict = pos('gbm') ? 'meets' : (!done('gbm') && (F.rpgn || F.pulmhem) && hematuria) ? 'possible' : neg('gbm') ? 'unlikely' : 'na';
      if ((F.rpgn || F.pulmhem) && hematuria && !done('gbm')) next('Anti-GBM antibody (urgent)', 'RPGN / pulmonary-renal picture');
      if (pos('gbm') && panca) c.notes.push('Double positive (anti-GBM + MPO-ANCA, ~30%): treat like anti-GBM acutely (plasma exchange) but relapses like AAV.');
      if (pos('gbm')) flags.push('Anti-GBM positive: same-day nephrology — plasma exchange, steroids, cyclophosphamide.');
    }

    // ===== APS =====
    {
      const c = mk('aps', 'Antiphospholipid syndrome', 'Revised Sapporo/Sydney: ≥1 clinical + ≥1 lab criterion persisting ≥12 weeks (2023 ACR/EULAR uses weighted domains)');
      const labs = ['lac', 'acl', 'b2gpi'].filter(pos);
      labs.forEach(x => P(c, '✓', `${TEST[x].name} positive`));
      ['lac', 'acl', 'b2gpi'].filter(x => !done(x)).forEach(x => P(c, '?', `${TEST[x].name} not done`));
      if (F.thrombosis) P(c, '✓', 'Thrombosis'); if (F.pregnancy) P(c, '✓', 'Pregnancy morbidity');
      if (thrombo && labs.length) P(c, '~', 'Thrombocytopenia (non-criteria feature)');
      const clin = F.thrombosis || F.pregnancy;
      c.verdict = labs.length && clin ? 'meets' : (labs.length || (clin && !labs.length && ['lac', 'acl', 'b2gpi'].some(x => !done(x)))) ? 'possible' : ['lac', 'acl', 'b2gpi'].some(done) ? 'unlikely' : 'na';
      if (c.verdict === 'meets') c.notes.push('Confirm positive antibodies on repeat testing ≥12 weeks apart before labelling APS.');
      if (labs.length === 3) c.notes.push('Triple positive: highest thrombosis risk. Warfarin (INR 2–3) preferred; avoid DOACs in triple-positive or arterial APS.');
      if (onAnticoag && (done('lac') || clin)) c.notes.push('On anticoagulation: lupus anticoagulant results are unreliable (false positives with DOACs/heparin/warfarin). aCL and β2GPI are not affected.');
      if (clin && !['lac', 'acl', 'b2gpi'].every(done) && (F.thrombosis && (age == null || age < 50) || F.pregnancy || ana.pos80)) next('Antiphospholipid panel: lupus anticoagulant, anticardiolipin IgG/IgM, anti-β2GPI IgG/IgM', 'unprovoked/young/atypical-site thrombosis, pregnancy morbidity or SLE');
      if (labs.length && F.thrombosis && thrombo && (F.rpgn || F.newhtn)) flags.push('Possible catastrophic APS (multi-organ thrombosis + aPL + thrombocytopenia): ICU-level care, anticoagulation + steroids ± plasma exchange/IVIG.');
    }

    // ===== Cryoglobulinemic vasculitis =====
    {
      const c = mk('cryo', 'Cryoglobulinemic vasculitis', 'Cryoglobulins + purpura/neuropathy/GN; very low C4 and positive RF are classic');
      if (pos('cryo')) P(c, '✓', 'Cryoglobulins positive'); else if (neg('cryo')) P(c, '✗', 'Cryoglobulins negative (false negatives common if sample not kept at 37 °C)'); else P(c, '?', 'Cryoglobulins not done');
      if (lowC4) P(c, '✓', `Low C4${!lowC3 ? ' with normal C3 (classic)' : ''}`);
      if (pos('rf')) P(c, '✓', 'RF positive (cryoglobulin RF activity)');
      if (pos('hcv')) P(c, '✓', 'Hepatitis C positive'); else if (!done('hcv')) P(c, '?', 'Hepatitis C not tested');
      [[F.purpura, 'Palpable purpura'], [F.mononeuritis, 'Neuropathy'], [hematuria, 'Hematuria / GN'], [F.synovitis, 'Arthralgia/arthritis']].forEach(([x, t]) => { if (x) P(c, '✓', t); });
      const clin = F.purpura || F.mononeuritis || hematuria;
      c.verdict = pos('cryo') && clin ? 'meets' : ((lowC4 && pos('rf')) || (pos('hcv') && F.purpura) || pos('cryo')) ? 'possible' : neg('cryo') ? 'unlikely' : 'na';
      if (c.verdict !== 'na' && c.verdict !== 'unlikely') { if (!done('cryo')) next('Cryoglobulins (sample transported warm at 37 °C)', 'low C4 + RF / purpura'); if (!done('hcv')) next('HCV antibody ± RNA, HBV serology, SPEP/free light chains', 'causes of cryoglobulinemia'); }
    }

    // ===== Autoimmune liver =====
    {
      const c = mk('liver', 'Autoimmune liver disease (PBC / AIH)', 'Serology + liver enzyme pattern');
      if (pos('ama')) P(c, '✓', `AMA positive${alpHi ? ' with raised ALP → PBC pattern' : ''}`);
      if (pos('asma')) P(c, '✓', 'Anti-smooth muscle positive (AIH type 1)'); if (pos('lkm')) P(c, '✓', 'Anti-LKM-1 positive (AIH type 2)');
      if (altHi) P(c, '✓', lab('alt', 1) + ' (high)'); if (alpHi) P(c, '✓', lab('alp', 1) + ' (high)'); if (iggHi) P(c, '✓', lab('igg', 1) + ' (high)');
      if (pos('centromere')) P(c, '~', 'Anti-centromere also occurs in PBC');
      c.verdict = (pos('ama') && alpHi) || ((pos('asma') || pos('lkm')) && altHi && iggHi) ? 'meets' : (pos('ama') || pos('asma') || pos('lkm')) ? 'possible' : (altHi || alpHi) && ['ama', 'asma', 'lkm'].some(done) ? 'unlikely' : 'na';
      if ((altHi || alpHi) && !['ama', 'asma', 'lkm'].some(done) && (ana.pos80 || iggHi)) next('AMA, anti-smooth muscle, anti-LKM-1, IgG', 'raised liver enzymes with autoimmune markers');
    }

    // ===== Spondyloarthritis =====
    {
      const c = mk('spa', 'Spondyloarthritis', 'Seronegative (RF/CCP −) inflammatory back pain, uveitis, enthesitis; HLA-B27 supports');
      if (pos('b27')) P(c, '✓', 'HLA-B27 positive (also in ~6–8% of the general population)'); else if (neg('b27')) P(c, '✗', 'HLA-B27 negative');
      if (F.ibp) P(c, '✓', 'Inflammatory back pain'); if (F.uveitis) P(c, '✓', 'Anterior uveitis');
      if (neg('rf') && neg('ccp')) P(c, '✓', 'RF and anti-CCP negative');
      c.verdict = (pos('b27') && (F.ibp || F.uveitis)) ? 'possible' : (F.ibp || F.uveitis) ? 'possible' : neg('b27') ? 'unlikely' : 'na';
      if ((F.ibp || F.uveitis) && !done('b27')) next('HLA-B27 + MRI sacroiliac joints', 'inflammatory back pain / uveitis');
    }

    // ===== PMR / GCA =====
    {
      const c = mk('pmr', 'Polymyalgia rheumatica / giant cell arteritis', 'Seronegative; age ≥50, raised ESR/CRP, girdle symptoms or cranial features');
      if (F.age50) P(c, '✓', `Age ${age != null ? age : '≥50'}`); else if (age != null) P(c, '✗', `Age ${age} (<50 makes PMR/GCA unlikely)`);
      if (esrHi || crpHi) P(c, '✓', `Raised ${[esrHi && lab('esr', 1), crpHi && lab('crp', 1)].filter(Boolean).join(', ')}`);
      if (F.girdle) P(c, '✓', 'Shoulder/hip girdle pain & stiffness'); if (F.gca) P(c, '✓', 'Headache, jaw claudication or visual symptoms');
      if (neg('rf') || neg('ccp')) P(c, '✓', 'RF/anti-CCP negative (helps separate from elderly-onset RA)');
      c.verdict = F.age50 && (esrHi || crpHi) && (F.girdle || F.gca) ? 'possible' : (F.girdle || F.gca) ? 'unlikely' : 'na';
      if (F.gca && F.age50) flags.push('Possible giant cell arteritis: if visual symptoms, start high-dose steroids now (don\'t wait for biopsy/US) and contact ophthalmology/rheumatology same day.');
    }

    // ===== global red flags =====
    if ((F.rpgn || (cr != null && cr > 200)) && hematuria) flags.push('Possible rapidly progressive GN (rising creatinine + active sediment): same-day nephrology; send ANCA (PR3/MPO), anti-GBM, C3/C4, ANA, dsDNA, HBV/HCV, cryoglobulins, UPCR; renal biopsy.');
    if (F.pulmhem && (hematuria || F.rpgn || (cr != null && cr > 150))) flags.push('Pulmonary-renal syndrome (alveolar hemorrhage + kidney involvement): ICU review, nephrology + respirology today; consider pulse methylprednisolone and plasma exchange (anti-GBM).');
    if (pos('rnapol') && (F.newhtn || F.rpgn)) flags.push(`Possible scleroderma renal crisis (anti-RNA pol III + new hypertension / AKI): ACE inhibitor (captopril) titration, avoid high-dose steroids, nephrology now.${/prednis|methylpred|dexameth/i.test(meds) ? ' Patient is on a corticosteroid — doses >15 mg/day prednisone raise renal-crisis risk.' : ''}`);
    if ((F.ln34 || (pos('dsdna') && (lowC3 || lowC4) && (prot || hematuria)))) flags.push('Active lupus nephritis likely: nephrology/rheumatology, renal biopsy, UPCR trend; avoid NSAIDs.');
    if (ana.pos80 && (F.seizure || F.psychosis)) flags.push('Neuropsychiatric lupus is a diagnosis of exclusion — rule out infection (LP), metabolic causes, PRES, drugs and thrombosis (aPL).');

    // ---- summaries ----
    const complement = complementSummary(v('c3'), v('c4'), v('ch50'));
    const anaSummary = anaInterp(v('ana'), v('anapat'));
    const ancaSummary = ancaInterp(v('anca'), v('pr3'), v('mpo'));

    // sort cards
    const rank = { meets: 0, possible: 1, unlikely: 2, na: 3 };
    cards.forEach(c => { c.frac = c.score != null && c.threshold ? c.score / c.threshold : (c.verdict === 'meets' ? 1 : c.verdict === 'possible' ? 0.5 : 0); });
    cards.sort((a, b) => rank[a.verdict] - rank[b.verdict] || b.frac - a.frac);

    // general next tests
    if (ana.pos80 && !['dsdna', 'sm', 'rnp', 'ro', 'la'].some(done)) next('ENA panel (Sm, RNP, Ro, La, Scl-70, Jo-1, centromere)', 'ANA ≥1:80');
    if (pos('rf') && !done('hcv')) next('Hepatitis C antibody', 'RF positive');
    if ((lowC3 || lowC4) && !ana.done) next('ANA, anti-dsDNA', 'low complement');
    if ((lowC3 || lowC4) && hematuria && !pos('dsdna')) next('ASO / anti-DNase B, blood cultures, HCV/HBV, cryoglobulins', 'low complement + nephritis (post-infectious GN, endocarditis, cryo, C3G)');
    if (lowC3 && !lowC4 && done('c4')) next('Consider C3 nephritic factor / complement factor studies (via nephrology)', 'isolated low C3');

    return { cards, flags: [...new Set(flags)], next: [...nextSet.entries()].map(([t, w]) => ({ test: t, why: w })), complement, anaSummary, ancaSummary, derived: { leuko, thrombo, eos1, prot, esrHi, crpHi, ckHi, upcr, cr } };
  }

  function complementSummary(c3, c4, ch50) {
    if (c3 == null && c4 == null) return { pattern: 'not done', text: 'C3/C4 not available.', causes: [] };
    const L3 = c3 === 'low', L4 = c4 === 'low';
    if (L3 && L4) return { pattern: 'Low C3 + low C4 (classical pathway consumption)', text: 'Immune-complex disease.', causes: ['Active SLE (esp. nephritis)', 'Cryoglobulinemia (C4 often very low)', 'Immune-complex MPGN', 'Infective endocarditis / shunt nephritis', 'Hepatitis B or C', 'Hypocomplementemic urticarial vasculitis (anti-C1q)'] };
    if (L3 && !L4) return { pattern: 'Low C3, normal C4 (alternative pathway)', text: 'Alternative-pathway activation.', causes: ['Post-streptococcal / post-infectious GN (recovers in ~8 weeks)', 'C3 glomerulopathy (C3 nephritic factor)', 'Atypical HUS', 'Endocarditis / shunt nephritis', 'Sepsis'] };
    if (!L3 && L4) return { pattern: 'Normal C3, low C4', text: 'Classical/lectin pathway, early consumption, or inherited.', causes: ['Cryoglobulinemia (classic — very low C4)', 'Hereditary or acquired angioedema (C1-inhibitor deficiency — check C1-INH level/function if angioedema without urticaria)', 'Early or mild SLE', 'Partial C4 deficiency (C4 null alleles, common)', 'Sjögren with lymphoma risk'] };
    if (c3 === 'high' || c4 === 'high') return { pattern: 'High complement', text: 'Acute-phase response (complement rises with inflammation). Normal or high complement does not exclude active disease.', causes: [] };
    return { pattern: 'Normal C3 and C4', text: `Typical of ANCA vasculitis, anti-GBM disease, IgA vasculitis, RA, SSc. Does not exclude SLE.${ch50 === 'low' ? ' Low CH50 with normal C3/C4: consider a hereditary early component deficiency (C1q, C2) or sample handling.' : ''}`, causes: [] };
  }

  function anaInterp(t, pat) {
    const out = [];
    if (t == null) return ['ANA not available.'];
    if (t === 'neg') out.push('ANA negative: strong evidence against SLE, MCTD and drug-induced lupus. Sjögren (Ro), myositis (Jo-1 is cytoplasmic), ANCA vasculitis, RA and APS can still be ANA-negative.');
    else if (t === 40) out.push('ANA 1:40: borderline — found in ~25–30% of healthy people. Not meaningful without strong clinical features.');
    else if (t === 80) out.push('ANA 1:80: meets SLE entry but ~10–13% of healthy people have this. Interpret only with clinical features.');
    else if (t === 160) out.push('ANA 1:160: ~5% of healthy people. More meaningful with compatible features.');
    else if (typeof t === 'number' && t >= 320) out.push(`ANA 1:${t}${t >= 1280 ? '+' : ''}: high titre — more likely to reflect systemic autoimmune disease (still seen in drug-induced lupus, AIH, some infections).`);
    else if (t === 'pos') out.push('ANA positive, titre not given — request the titre and pattern.');
    const P = {
      homogeneous: 'Homogeneous: anti-dsDNA, nucleosome, histone → SLE, drug-induced lupus, juvenile arthritis.',
      speckled: 'Speckled: Sm, U1-RNP, Ro, La, Scl-70 → SLE, MCTD, Sjögren, SSc. Order an ENA panel.',
      dfs: 'Dense fine speckled (DFS70): common in healthy people; when isolated it argues AGAINST systemic autoimmune disease.',
      centromere: 'Centromere: limited cutaneous SSc (CREST); also PBC. Check for Raynaud, PAH.',
      nucleolar: 'Nucleolar: SSc (Th/To, PM/Scl, RNA pol III), SSc–myositis overlap.',
      rim: 'Rim / nuclear envelope: dsDNA (SLE); gp210/lamin → PBC.',
      cytoplasmic: 'Cytoplasmic: AMA (PBC), Jo-1 and other synthetases, ribosomal P (neuro-lupus), anti-smooth muscle (AIH).',
      mixed: 'Mixed pattern: interpret with the specific antibodies (ENA panel).',
    };
    if (pat && P[pat]) out.push(P[pat]);
    return out;
  }

  function ancaInterp(iif, pr3, mpo) {
    if (iif == null && pr3 == null && mpo == null) return ['ANCA not available. Order only with a compatible picture (GN, alveolar hemorrhage, sinus/ear, nodules, mononeuritis, purpura) — positive predictive value is low otherwise.'];
    const o = [];
    if (pr3 === 'pos' && mpo === 'pos') o.push('PR3 and MPO both positive: think drug/levamisole-induced vasculitis, endocarditis or other infection before primary AAV.');
    else if (pr3 === 'pos') o.push('Anti-PR3 positive: GPA pattern (≈65–75% of GPA). Higher relapse risk than MPO.');
    else if (mpo === 'pos') o.push('Anti-MPO positive: MPA (≈60–70%), renal-limited vasculitis, EGPA (~30–40%), drug-induced (hydralazine, PTU).');
    if ((iif === 'c' || iif === 'p' || iif === 'pos') && pr3 === 'neg' && mpo === 'neg') o.push('IIF positive with negative PR3/MPO: low specificity for vasculitis (IBD, PSC, AIH, RA, infection).');
    if (iif === 'neg' && pr3 == null && mpo == null) o.push('ANCA IIF negative. Current practice is PR3/MPO immunoassay first — IIF alone can miss AAV.');
    if (pr3 === 'neg' && mpo === 'neg' && iif == null) o.push('PR3 and MPO negative: makes GPA/MPA much less likely (~10% of AAV are ANCA-negative, esp. limited GPA and EGPA).');
    if (!o.length) o.push(`ANCA: IIF ${iif || 'n/a'}, PR3 ${pr3 || 'n/a'}, MPO ${mpo || 'n/a'}.`);
    return o;
  }

  // ---------- Reference library ----------
  const LIBRARY = [
    ['ANA (HEp-2 IIF)', 'Screen for SLE (~98%), SSc (~90%), MCTD (~100%), Sjögren (~70%), DIL (~95%), AIH', 'Low specificity: healthy (esp. elderly, women), infections, malignancy, drugs, thyroid/liver disease. Titre ≥1:160 more meaningful. Do not repeat once positive.'],
    ['Anti-dsDNA', 'SLE (sens ~60–70%, spec ~95%)', 'Levels track nephritis and flares; can be positive with TNF inhibitors. Crithidia IIF most specific; ELISA more sensitive.'],
    ['Anti-Sm', 'SLE (sens ~20–30%, spec ~99%)', 'Very specific; does not track activity.'],
    ['Anti-U1-RNP', 'MCTD (required, high titre); SLE (~30%); SSc', 'Raynaud, puffy hands, PAH. With anti-Sm → SLE.'],
    ['Anti-Ro/SSA', 'Sjögren (~70%), SLE (~30%), SCLE, neonatal lupus', 'Congenital heart block risk in pregnancy (~2%). Can be missed by HEp-2 ANA. Ro52 alone is non-specific (myositis, ILD).'],
    ['Anti-La/SSB', 'Sjögren, SLE', 'Usually with Ro; isolated La has little value.'],
    ['Anti-Scl-70', 'Diffuse SSc (~20–40%)', 'ILD risk; spec ~99%.'],
    ['Anti-centromere', 'Limited SSc / CREST (~50–90%)', 'PAH, digital ischemia; also PBC.'],
    ['Anti-RNA pol III', 'Diffuse SSc (~10–20%)', 'Scleroderma renal crisis, rapid skin, cancer association.'],
    ['Anti-histone', 'Drug-induced lupus (~95%), SLE (~50–70%)', 'Supportive only — not specific.'],
    ['Anti-Jo-1 / synthetases', 'Antisynthetase syndrome', 'ILD, myositis, arthritis, mechanic\'s hands, fever, Raynaud. ANA may be negative (cytoplasmic).'],
    ['Anti-MDA5', 'Clinically amyopathic dermatomyositis', 'Rapidly progressive ILD — urgent.'],
    ['Anti-TIF1-γ / NXP2', 'Dermatomyositis', 'Cancer association in adults.'],
    ['Anti-HMGCR / SRP', 'Immune-mediated necrotizing myopathy', 'Very high CK; HMGCR linked to statins.'],
    ['PR3-ANCA', 'GPA (~65–75%)', 'False +: endocarditis, TB, cocaine/levamisole, drugs.'],
    ['MPO-ANCA', 'MPA (~60–70%), renal-limited, EGPA (~30–40%)', 'Hydralazine, PTU, minocycline; anti-GBM double positivity.'],
    ['Anti-GBM', 'Anti-GBM disease', 'Medical emergency; normal complement.'],
    ['RF', 'RA (~70–80%), Sjögren, cryoglobulinemia', 'Non-specific: ageing, HCV, endocarditis, TB, chronic liver/lung disease.'],
    ['Anti-CCP', 'RA (sens ~67%, spec ~95%)', 'Predicts erosions; may precede symptoms.'],
    ['C3 / C4', 'Consumed in immune-complex disease', 'See complement pattern box. Acute phase reactant — can be falsely normal.'],
    ['Antiphospholipid (LA, aCL, β2GPI)', 'APS, SLE (~30–40%)', 'Transient positives with infection; repeat at ≥12 weeks. LA unreliable on anticoagulants.'],
    ['Cryoglobulins', 'Cryoglobulinemic vasculitis (HCV, Sjögren, B-cell lymphoma)', 'Sample must be kept at 37 °C until clotted/separated.'],
    ['AMA', 'PBC (~95%)', 'With raised ALP.'],
    ['Anti-smooth muscle / LKM-1', 'Autoimmune hepatitis type 1 / type 2', 'With raised ALT and IgG.'],
    ['HLA-B27', 'Ankylosing spondylitis (~90%), reactive arthritis, uveitis', '6–8% of the general population carries it.'],
  ];

  root.SeroEngine = { TESTS, TEST, OPTIONS, optLabel, FEATURES, RA_JOINTS, CONDITION_MAP, LIBRARY, parseObservation, matchTest, stateFromObservations, evaluate, DIL_DRUGS, ANCA_DRUGS, ANTICOAG };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.SeroEngine;
})(typeof window !== 'undefined' ? window : globalThis);
