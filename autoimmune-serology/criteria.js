/* Diagnostic / classification criteria shown as live checklists inside each condition card.
 * Load after engine.js. SeroEngine.evaluate() calls SeroCriteria.evaluate(X) with its shared context X,
 * so the checklist and the card score use the same lab facts and the same clinical ticks.
 * Item kinds:  f = clinical checkbox (feature id, same as the Clinical features tab)
 *              lab = filled from results (true / false / null = not done); ids = tests to show
 *              f + lab = met if ticked OR the lab shows it;  sel = dropdown (RA joint count)
 * Domain rules: max = highest item counts · sum = all items add (weights can be negative) · count = number of items met (need = minimum)
 * Criteria wording paraphrased from the cited sources. UNVERIFIED draft written by Claude — check against the original papers.
 */
(function (root) {
  'use strict';
  const anyDone = (X, ids) => ids.some(X.done);
  const L = (l, w, lab, ids) => ({ l, w, lab, ids });
  const C = (l, w, f, extra) => Object.assign({ l, w, f }, extra || {});

  const SETS = {
    sle: [{
      name: '2019 EULAR/ACR classification criteria for SLE', src: 'Aringer et al. Arthritis Rheumatol 2019', kind: 'points', thr: 10,
      pre: 'Count an item only if there is no more likely explanation. Items need not occur at the same time. Within each domain only the highest item counts.',
      entry: [L('ANA ≥1:80 on HEp-2 cells (ever)', null, X => (X.ana.done ? X.ana.pos80 : null), ['ana'])],
      domains: [
        { d: 'Constitutional', rule: 'max', clin: 1, items: [C('Fever >38.3 °C', 2, 'fever')] },
        { d: 'Hematologic', rule: 'max', clin: 1, items: [L('Leukopenia <4 ×10⁹/L', 3, X => (X.wbc == null ? null : X.leuko), ['wbc']), L('Thrombocytopenia <100 ×10⁹/L', 4, X => (X.plt == null ? null : X.thrombo), ['plt']), C('Autoimmune hemolysis', 4, 'aiha')] },
        { d: 'Neuropsychiatric', rule: 'max', clin: 1, items: [C('Delirium', 2, 'delirium'), C('Psychosis', 3, 'psychosis'), C('Seizure', 5, 'seizure')] },
        { d: 'Mucocutaneous', rule: 'max', clin: 1, items: [C('Non-scarring alopecia', 2, 'alopecia'), C('Oral ulcers', 2, 'oral'), C('Subacute cutaneous or discoid lupus', 4, 'scle'), C('Acute cutaneous lupus', 6, 'acle')] },
        { d: 'Serosal', rule: 'max', clin: 1, items: [C('Pleural or pericardial effusion', 5, 'effusion'), C('Acute pericarditis', 6, 'pericarditis')] },
        { d: 'Musculoskeletal', rule: 'max', clin: 1, items: [C('Joint involvement', 6, 'synovitis')] },
        { d: 'Renal', rule: 'max', clin: 1, items: [C('Proteinuria >0.5 g/24 h', 4, 'proteinuria', { lab: X => (X.upcr == null ? null : X.upcr > 0.5), ids: ['upcr'] }), C('Renal biopsy: lupus nephritis class II or V', 8, 'ln25'), C('Renal biopsy: lupus nephritis class III or IV', 10, 'ln34')] },
        { d: 'Antiphospholipid antibodies', rule: 'max', items: [L('Anticardiolipin, anti-β2GPI or lupus anticoagulant positive', 2, X => (anyDone(X, ['acl', 'b2gpi', 'lac']) ? X.apl : null), ['acl', 'b2gpi', 'lac'])] },
        { d: 'Complement', rule: 'max', items: [L('Low C3 or low C4', 3, X => (anyDone(X, ['c3', 'c4']) ? X.lowC3 || X.lowC4 : null), ['c3', 'c4']), L('Low C3 and low C4', 4, X => (anyDone(X, ['c3', 'c4']) ? X.lowC3 && X.lowC4 : null), ['c3', 'c4'])] },
        { d: 'SLE-specific antibodies', rule: 'max', items: [L('Anti-dsDNA or anti-Sm', 6, X => (anyDone(X, ['dsdna', 'sm']) ? X.pos('dsdna') || X.pos('sm') : null), ['dsdna', 'sm'])] },
      ],
      judge: (r) => { const clin = r.domains.filter(d => d.clin).reduce((a, d) => a + d.score, 0);
        return { met: r.entryMet && r.total >= 10 && clin > 0, text: !r.entryMet ? 'Entry criterion not met (ANA ≥1:80 needed).' : `${r.total} points (${clin} clinical). Classified as SLE if ≥10 with ≥1 clinical item.` }; },
    }],

    dil: [{
      name: 'Drug-induced lupus — supportive features', src: 'No validated criteria; commonly used features', kind: 'count', thr: null,
      pre: 'Diagnosis rests on exposure to a culprit drug, lupus-like features without prior SLE, and improvement after the drug is stopped.',
      domains: [{ d: 'Features', rule: 'count', items: [
        L('On a recognised culprit drug (hydralazine, procainamide, isoniazid, minocycline, TNF inhibitors…)', null, X => (X.meds ? X.DIL_DRUGS.test(X.meds) : null), []),
        C('No lupus before the drug was started', null, 'nopriorsle'),
        L('ANA positive', null, X => (X.ana.done ? X.ana.pos80 : null), ['ana']),
        L('Anti-histone positive', null, X => (X.done('histone') ? X.pos('histone') : null), ['histone']),
        L('Anti-dsDNA negative (TNF inhibitors are the exception)', null, X => (X.done('dsdna') ? X.neg('dsdna') : null), ['dsdna']),
        L('Complement normal', null, X => (anyDone(X, ['c3', 'c4']) ? !(X.lowC3 || X.lowC4) : null), ['c3', 'c4']),
        C('Improving after the drug was stopped (weeks to months)', null, 'resolves')] }],
      judge: (r) => ({ met: null, text: `${r.total} of 7 supportive features.` }),
    }],

    ra: [{
      name: '2010 ACR/EULAR classification criteria for RA', src: 'Aletaha et al. Arthritis Rheum 2010', kind: 'points', thr: 6,
      pre: 'For patients with ≥1 joint with definite synovitis not better explained by another disease. Within each domain only the highest item counts.',
      entry: [C('≥1 joint with definite clinical synovitis', null, 'synovitis', { from: 'from joint count', lab: X => (X.F.raJoints != null && X.F.raJoints !== '' ? true : null) })],
      domains: [
        { d: 'Joint involvement', rule: 'max', items: [{ l: 'Swollen or tender joints', sel: 'raJoints' }] },
        { d: 'Serology', rule: 'max', items: [L('Low-positive RF or anti-CCP (≤3× ULN)', 2, X => (anyDone(X, ['rf', 'ccp']) ? X.pos('rf') || X.pos('ccp') : null), ['rf', 'ccp']), L('High-positive RF or anti-CCP (>3× ULN)', 3, X => (anyDone(X, ['rf', 'ccp']) ? X.v('rf') === 'high' || X.v('ccp') === 'high' : null), ['rf', 'ccp'])] },
        { d: 'Acute-phase reactants', rule: 'max', items: [L('Abnormal CRP or ESR', 1, X => (X.num('crp') != null || X.num('esr') != null ? X.esrHi || X.crpHi : null), ['crp', 'esr'])] },
        { d: 'Duration', rule: 'max', items: [C('Symptoms ≥6 weeks', 1, 'dur6')] },
      ],
      judge: (r) => ({ met: r.entryMet && r.total >= 6, text: `${r.total}/10 points. Classified as RA if ≥6.` }),
    }],

    sjogren: [{
      name: '2016 ACR/EULAR classification criteria for Sjögren', src: 'Shiboski et al. Arthritis Rheumatol 2017', kind: 'points', thr: 4,
      pre: 'Exclusions: head/neck radiation, active HCV (PCR), AIDS, sarcoidosis, amyloidosis, graft-versus-host disease, IgG4-related disease. Stop anticholinergic drugs before testing gland function.',
      entry: [C('Dry eyes or dry mouth (or suspected from a systemic feature)', null, 'sicca')],
      domains: [{ d: 'Items', rule: 'sum', items: [
        C('Labial gland biopsy: focal lymphocytic sialadenitis, focus score ≥1', 3, 'lipbx'),
        L('Anti-Ro/SSA positive', 3, X => (X.done('ro') ? X.pos('ro') : null), ['ro']),
        C('Ocular staining score ≥5 (or van Bijsterveld ≥4) in ≥1 eye', 1, 'ocular'),
        C('Schirmer ≤5 mm/5 min in ≥1 eye', 1, 'schirmer'),
        C('Unstimulated whole saliva flow ≤0.1 mL/min', 1, 'saliva')] }],
      judge: (r) => ({ met: r.entryMet && r.total >= 4, text: `${r.total} points. Classified as Sjögren if ≥4.` }),
    }],

    ssc: [{
      name: '2013 ACR/EULAR classification criteria for systemic sclerosis', src: 'van den Hoogen et al. Arthritis Rheum 2013', kind: 'points', thr: 9,
      pre: 'Not for skin thickening that spares the fingers, or a scleroderma-like disorder that explains it. Within each row only the highest item counts.',
      domains: [
        { d: 'Skin thickening of both hands proximal to MCPs (sufficient alone)', rule: 'max', items: [C('Present', 9, 'skinprox')] },
        { d: 'Skin thickening of the fingers', rule: 'max', items: [C('Puffy fingers', 2, 'puffy'), C('Sclerodactyly (distal to MCPs, proximal to PIPs)', 4, 'sclerodactyly')] },
        { d: 'Fingertip lesions', rule: 'max', items: [C('Digital tip ulcers', 2, 'digulcer'), C('Fingertip pitting scars', 3, 'pitscar')] },
        { d: 'Telangiectasia', rule: 'max', items: [C('Telangiectasia', 2, 'telang')] },
        { d: 'Nailfold capillaries', rule: 'max', items: [C('Abnormal nailfold capillaries', 2, 'nailfold')] },
        { d: 'Lung', rule: 'max', items: [C('Pulmonary arterial hypertension', 2, 'pah'), C('Interstitial lung disease', 2, 'ild')] },
        { d: 'Raynaud phenomenon', rule: 'max', items: [C('Raynaud phenomenon', 3, 'raynaud')] },
        { d: 'SSc-related antibodies', rule: 'max', items: [L('Anti-centromere, anti-Scl-70 or anti-RNA polymerase III', 3, X => (anyDone(X, ['centromere', 'scl70', 'rnapol']) ? ['centromere', 'scl70', 'rnapol'].some(X.pos) : null), ['centromere', 'scl70', 'rnapol'])] },
      ],
      judge: (r) => ({ met: r.total >= 9, text: `${r.total} points. Classified as SSc if ≥9.` }),
    }],

    mctd: [{
      name: 'Alarcón-Segovia criteria for MCTD', src: 'Alarcón-Segovia & Cardiel 1989', kind: 'count', thr: 3,
      pre: 'Needs high-titre anti-U1-RNP plus ≥3 clinical items. If the three are swollen hands, Raynaud and acrosclerosis, synovitis or myositis is also needed.',
      entry: [L('Anti-U1-RNP positive (high titre, ≥1:1600 by hemagglutination)', null, X => (X.done('rnp') ? X.pos('rnp') : null), ['rnp'])],
      domains: [{ d: 'Clinical', rule: 'count', need: 3, items: [
        C('Swollen hands', null, 'puffy'), C('Synovitis', null, 'synovitis'),
        C('Myositis (proximal weakness or raised CK)', null, 'weakness', { lab: X => (X.num('ck') == null ? null : X.ckHi), ids: ['ck'] }),
        C('Raynaud phenomenon', null, 'raynaud'), C('Acrosclerosis (sclerodactyly)', null, 'sclerodactyly')] }],
      judge: (r) => { const it = r.domains[0].items, synMyo = it[1].met || it[2].met;
        return { met: r.entryMet && r.total >= 3 && synMyo, text: `${r.total} of 5 clinical items${r.total >= 3 && !synMyo ? ' — needs synovitis or myositis among them' : ''}.` }; },
    }],

    myositis: [{
      name: 'Bohan and Peter criteria (polymyositis / dermatomyositis)', src: 'Bohan & Peter NEJM 1975 (the 2017 EULAR/ACR weighted criteria are now preferred for classification)', kind: 'count', thr: null,
      domains: [{ d: 'Items', rule: 'count', items: [
        C('Symmetric proximal muscle weakness', null, 'weakness'),
        L('Raised muscle enzymes (CK)', null, X => (X.num('ck') == null ? null : X.ckHi), ['ck']),
        C('EMG: myopathic changes', null, 'emg'), C('Muscle biopsy: inflammatory myopathy', null, 'musclebx'),
        C('Typical rash of dermatomyositis (heliotrope, Gottron)', null, 'gottron')] }],
      judge: (r) => { const it = r.domains[0].items, core = it.slice(0, 4).filter(i => i.met).length, rash = it[4].met;
        const t = rash ? (core >= 3 ? 'Definite DM' : core === 2 ? 'Probable DM' : core === 1 ? 'Possible DM' : 'Rash only') : (core === 4 ? 'Definite PM' : core === 3 ? 'Probable PM' : core === 2 ? 'Possible PM' : 'Does not meet');
        return { met: /Definite/.test(t) ? true : /Probable/.test(t) ? null : false, text: `${t} (${core} of 4 muscle items${rash ? ' + rash' : ''}). Definite: PM 4 items; DM rash + 3.` }; },
    }, {
      name: 'Connors criteria (antisynthetase syndrome)', src: 'Connors et al. Chest 2010', kind: 'count', thr: 1,
      entry: [L('Anti-aminoacyl-tRNA synthetase antibody (Jo-1, PL-7, PL-12, EJ, OJ…)', null, X => (anyDone(X, ['jo1', 'myo']) ? X.pos('jo1') || X.v('myo') === 'synth' : null), ['jo1', 'myo'])],
      domains: [{ d: 'Plus ≥1 of', rule: 'count', need: 1, items: [C('Raynaud phenomenon', null, 'raynaud'), C('Arthritis', null, 'synovitis'), C('Interstitial lung disease', null, 'ild'), C('Unexplained fever', null, 'fever'), C('Mechanic\'s hands', null, 'mechanic')] }],
      judge: (r) => ({ met: r.entryMet && r.total >= 1, text: r.entryMet ? `${r.total} clinical item(s); needs ≥1.` : 'Needs an antisynthetase antibody.' }),
    }],

    gpa: [{
      name: '2022 ACR/EULAR classification criteria for GPA', src: 'Robson et al. Ann Rheum Dis 2022', kind: 'points', thr: 5,
      pre: 'Apply only once small- or medium-vessel vasculitis is diagnosed and mimics are excluded.',
      domains: [{ d: 'Items (all add; some subtract)', rule: 'sum', items: [
        C('Nasal: bloody discharge, ulcers, crusting, congestion/blockage, or septal defect/perforation', 3, 'nasal'),
        C('Cartilaginous involvement (ear/nose cartilage, hoarseness/stridor, endobronchial, saddle nose)', 2, 'cartilage'),
        C('Conductive or sensorineural hearing loss', 1, 'hearing'),
        L('c-ANCA or anti-PR3 positive', 5, X => (anyDone(X, ['anca', 'pr3']) ? X.canca : null), ['anca', 'pr3']),
        C('Lung nodules, mass or cavitation on chest imaging', 2, 'nodules'),
        C('Granuloma, extravascular granulomatous inflammation or giant cells on biopsy', 2, 'granuloma'),
        C('Inflammation, consolidation or effusion of nasal/paranasal sinuses or mastoiditis on imaging', 1, 'sinusimg'),
        C('Pauci-immune glomerulonephritis on biopsy', 1, 'pigN'),
        L('p-ANCA or anti-MPO positive', -1, X => (anyDone(X, ['anca', 'mpo']) ? X.panca : null), ['anca', 'mpo']),
        L('Blood eosinophils ≥1 ×10⁹/L', -4, X => (X.eos == null ? null : X.eos1), ['eos'])] }],
      judge: (r) => ({ met: r.total >= 5, text: `${r.total} points. Classified as GPA if ≥5.` }),
    }],
    mpa: [{
      name: '2022 ACR/EULAR classification criteria for MPA', src: 'Suppiah et al. Ann Rheum Dis 2022', kind: 'points', thr: 5,
      pre: 'Apply only once small- or medium-vessel vasculitis is diagnosed and mimics are excluded.',
      domains: [{ d: 'Items (all add; some subtract)', rule: 'sum', items: [
        L('p-ANCA or anti-MPO positive', 6, X => (anyDone(X, ['anca', 'mpo']) ? X.panca : null), ['anca', 'mpo']),
        C('Fibrosis or interstitial lung disease on chest imaging', 3, 'ild'),
        C('Pauci-immune glomerulonephritis on biopsy', 3, 'pigN'),
        C('Nasal involvement', -3, 'nasal'),
        L('c-ANCA or anti-PR3 positive', -1, X => (anyDone(X, ['anca', 'pr3']) ? X.canca : null), ['anca', 'pr3']),
        L('Blood eosinophils ≥1 ×10⁹/L', -4, X => (X.eos == null ? null : X.eos1), ['eos'])] }],
      judge: (r) => ({ met: r.total >= 5, text: `${r.total} points. Classified as MPA if ≥5.` }),
    }],
    egpa: [{
      name: '2022 ACR/EULAR classification criteria for EGPA', src: 'Grayson et al. Ann Rheum Dis 2022', kind: 'points', thr: 6,
      pre: 'Apply only once small- or medium-vessel vasculitis is diagnosed and mimics are excluded.',
      domains: [{ d: 'Items (all add; some subtract)', rule: 'sum', items: [
        C('Obstructive airway disease (asthma)', 3, 'asthma'), C('Nasal polyps', 3, 'polyps'), C('Mononeuritis multiplex', 1, 'mononeuritis'),
        L('Blood eosinophils ≥1 ×10⁹/L', 5, X => (X.eos == null ? null : X.eos1), ['eos']),
        C('Extravascular eosinophilic-predominant inflammation on biopsy', 2, 'eosinfl'),
        L('c-ANCA or anti-PR3 positive', -3, X => (anyDone(X, ['anca', 'pr3']) ? X.canca : null), ['anca', 'pr3']),
        C('Hematuria', -1, 'hematuria', { lab: X => (X.done('uablood') ? X.pos('uablood') : null), ids: ['uablood'] })] }],
      judge: (r) => ({ met: r.total >= 6, text: `${r.total} points. Classified as EGPA if ≥6.` }),
    }],

    gbm: [{
      name: 'Anti-GBM disease — diagnostic requirements', src: 'KDIGO 2021 glomerular diseases guideline', kind: 'count', thr: null,
      domains: [
        { d: 'Antibody or biopsy (≥1)', rule: 'count', need: 1, items: [L('Circulating anti-GBM antibody', null, X => (X.done('gbm') ? X.pos('gbm') : null), ['gbm']), C('Renal biopsy: linear IgG along the GBM', null, 'linearigg')] },
        { d: 'Organ involvement (≥1)', rule: 'count', need: 1, items: [C('Rapidly progressive glomerulonephritis', null, 'rpgn'), C('Hematuria / active sediment', null, 'hematuria', { lab: X => (X.done('uablood') ? X.pos('uablood') : null), ids: ['uablood'] }), C('Diffuse alveolar hemorrhage', null, 'pulmhem')] },
      ],
      judge: (r) => ({ met: r.domains.every(d => d.pass), text: r.domains.every(d => d.pass) ? 'Antibody/biopsy and organ involvement present.' : 'Needs anti-GBM antibody or linear IgG on biopsy, plus kidney or lung involvement.' }),
    }],

    aps: [{
      name: 'Revised Sapporo (Sydney) criteria for APS', src: 'Miyakis et al. J Thromb Haemost 2006 (2023 ACR/EULAR weighted criteria are now used for research classification)', kind: 'count', thr: null,
      pre: 'APS = ≥1 clinical + ≥1 laboratory criterion, the antibody positive on ≥2 occasions ≥12 weeks apart.',
      domains: [
        { d: 'Clinical (≥1)', rule: 'count', need: 1, items: [C('Arterial, venous or small-vessel thrombosis (imaging or histology)', null, 'thrombosis'), C('Pregnancy morbidity (loss ≥10 weeks; preterm <34 weeks with pre-eclampsia/placental insufficiency; ≥3 losses <10 weeks)', null, 'pregnancy')] },
        { d: 'Laboratory (≥1)', rule: 'count', need: 1, items: [
          L('Lupus anticoagulant present', null, X => (X.done('lac') ? X.pos('lac') : null), ['lac']),
          L('Anticardiolipin IgG/IgM medium–high titre (>40 GPL/MPL or >99th centile)', null, X => (X.done('acl') ? X.pos('acl') : null), ['acl']),
          L('Anti-β2-glycoprotein I IgG/IgM >99th centile', null, X => (X.done('b2gpi') ? X.pos('b2gpi') : null), ['b2gpi'])] },
        { d: 'Persistence', rule: 'count', need: 1, items: [C('Positive again ≥12 weeks apart', null, 'repeat12')] },
      ],
      judge: (r) => { const [c, l, p] = r.domains.map(d => d.pass);
        return { met: c && l && p, text: c && l && !p ? 'Clinical and laboratory criteria met — confirm the antibody ≥12 weeks later.' : c && l && p ? 'Meets the revised Sapporo criteria.' : 'Needs ≥1 clinical and ≥1 persistent laboratory criterion.' }; },
    }],

    cryo: [{
      name: 'Cryoglobulinemic vasculitis classification (simplified)', src: 'Quartuccio et al. Ann Rheum Dis 2011', kind: 'count', thr: null,
      pre: 'Serum cryoglobulins positive on ≥2 occasions ≥12 weeks apart, plus ≥2 of the 3 groups below.',
      entry: [L('Serum cryoglobulins positive', null, X => (X.done('cryo') ? X.pos('cryo') : null), ['cryo'])],
      domains: [
        { d: 'Questionnaire (≥2 of 3 answers)', rule: 'count', need: 1, items: [C('Red spots on legs; brown staining after them; told of viral hepatitis — ≥2 of these', null, 'cryoq')] },
        { d: 'Clinical (≥3 of 4)', rule: 'count', need: 3, items: [C('Constitutional (fatigue, fever)', null, 'fever'), C('Articular (arthralgia, arthritis)', null, 'synovitis'), C('Vascular (purpura, skin ulcers, necrotizing vasculitis)', null, 'purpura'), C('Neurological (peripheral neuropathy)', null, 'mononeuritis')] },
        { d: 'Laboratory (≥2 of 3)', rule: 'count', need: 2, items: [L('Low C4', null, X => (X.done('c4') ? X.lowC4 : null), ['c4']), L('Rheumatoid factor positive', null, X => (X.done('rf') ? X.pos('rf') : null), ['rf']), C('Serum monoclonal (M) component', null, 'mcomp')] },
      ],
      judge: (r) => { const n = r.domains.filter(d => d.pass).length; return { met: r.entryMet && n >= 2, text: `${n} of 3 groups met${r.entryMet ? '' : '; cryoglobulins not positive yet'}.` }; },
    }],

    liver: [{
      name: 'Primary biliary cholangitis — diagnosis (2 of 3)', src: 'EASL 2017 / AASLD 2018 guidance', kind: 'count', thr: 2,
      domains: [{ d: 'Items', rule: 'count', need: 2, items: [
        L('ALP ≥1.5× upper limit of normal', null, X => (X.num('alp') == null ? null : X.num('alp') >= 1.5 * (X.hiOf('alp') || 120)), ['alp']),
        L('AMA positive (>1:40)', null, X => (X.done('ama') ? X.pos('ama') : null), ['ama']),
        C('Liver histology: non-suppurative destructive cholangitis', null, 'pbchisto')] }],
      judge: (r) => ({ met: r.total >= 2, text: `${r.total} of 3; diagnosis if ≥2.` }),
    }, {
      name: 'Simplified criteria for autoimmune hepatitis', src: 'Hennes et al. Hepatology 2008', kind: 'points', thr: 6,
      pre: 'Within each row only the highest item counts. Anti-smooth muscle reported only as positive is counted at ≥1:80 here — confirm the titre.',
      domains: [
        { d: 'Autoantibodies', rule: 'max', items: [
          L('ANA or anti-smooth muscle ≥1:40', 1, X => (X.ana.done || X.done('asma') ? (X.ana.titer >= 40) || X.ana.unknownTiter || X.pos('asma') : null), ['ana', 'asma']),
          L('ANA or anti-smooth muscle ≥1:80, or anti-LKM-1 ≥1:40', 2, X => (X.ana.done || X.done('asma') || X.done('lkm') ? (X.ana.titer >= 80) || X.pos('asma') || X.pos('lkm') : null), ['ana', 'asma', 'lkm'])] },
        { d: 'IgG', rule: 'max', items: [
          L('IgG above upper limit of normal', 1, X => (X.num('igg') == null ? null : X.num('igg') > (X.hiOf('igg') || 16)), ['igg']),
          L('IgG >1.1× upper limit of normal', 2, X => (X.num('igg') == null ? null : X.num('igg') > 1.1 * (X.hiOf('igg') || 16)), ['igg'])] },
        { d: 'Liver histology', rule: 'max', items: [C('Compatible with AIH', 1, 'aihcompat'), C('Typical of AIH', 2, 'aihtypical')] },
        { d: 'Viral hepatitis', rule: 'max', items: [C('Absent (excluded)', 2, 'noviral')] },
      ],
      judge: (r) => ({ met: r.total >= 7 ? true : r.total >= 6 ? null : false, text: `${r.total} points: ${r.total >= 7 ? 'definite AIH' : r.total >= 6 ? 'probable AIH' : 'below threshold'} (≥6 probable, ≥7 definite).` }),
    }],

    spa: [{
      name: 'ASAS classification criteria for axial spondyloarthritis', src: 'Rudwaleit et al. Ann Rheum Dis 2009', kind: 'count', thr: null,
      pre: 'Imaging arm: sacroiliitis + ≥1 SpA feature. Clinical arm: HLA-B27 + ≥2 other SpA features.',
      entry: [C('Back pain ≥3 months with onset before age 45', null, 'backpain3m')],
      domains: [
        { d: 'Imaging', rule: 'count', items: [C('Sacroiliitis on MRI (active) or X-ray (definite)', null, 'sacroiliitis')] },
        { d: 'SpA features', rule: 'count', items: [
          C('Inflammatory back pain', null, 'ibp'), C('Arthritis', null, 'synovitis'), C('Enthesitis (heel)', null, 'enthesitis'), C('Uveitis', null, 'uveitis'), C('Dactylitis', null, 'dactylitis'),
          C('Psoriasis', null, 'psoriasis'), C('Crohn disease / ulcerative colitis', null, 'ibd'), C('Good response to NSAIDs', null, 'nsaid'), C('Family history of SpA', null, 'famhx'),
          L('HLA-B27 positive', null, X => (X.done('b27') ? X.pos('b27') : null), ['b27']), L('Raised CRP', null, X => (X.num('crp') == null ? null : X.crpHi), ['crp'])] },
      ],
      judge: (r) => { const sac = r.domains[0].total, feats = r.domains[1].items, n = feats.filter(i => i.met).length, b27 = feats[9].met;
        const img = sac && n >= 1, clin = b27 && n - 1 >= 2;
        return { met: r.entryMet && (img || clin), text: `${n} SpA feature(s). ${img ? 'Imaging arm met. ' : ''}${clin ? 'Clinical (HLA-B27) arm met. ' : ''}${!r.entryMet ? 'Entry (chronic back pain from <45) not ticked.' : ''}` }; },
    }],

    pmr: [{
      name: '2012 EULAR/ACR provisional criteria for PMR (without ultrasound)', src: 'Dasgupta et al. Ann Rheum Dis 2012', kind: 'points', thr: 4,
      entry: [L('Age ≥50', null, X => (X.age == null ? (X.F.age50 ? true : null) : X.age >= 50), []), C('Bilateral shoulder aching', null, 'girdle'), L('Abnormal CRP and/or ESR', null, X => (X.num('crp') != null || X.num('esr') != null ? X.esrHi || X.crpHi : null), ['crp', 'esr'])],
      domains: [{ d: 'Items', rule: 'sum', items: [
        C('Morning stiffness >45 minutes', 2, 'amstiff45'), C('Hip pain or limited range of motion', 1, 'hippain'),
        L('RF and anti-CCP both negative', 2, X => (X.done('rf') && X.done('ccp') ? X.neg('rf') && X.neg('ccp') : null), ['rf', 'ccp']),
        L('No other joint involvement (synovitis not ticked)', 1, X => !X.F.synovitis, [])] }],
      judge: (r) => ({ met: r.entryMet && r.total >= 4, text: `${r.total}/6 points. Classified as PMR if ≥4 (with entry criteria).` }),
    }, {
      name: '2022 ACR/EULAR classification criteria for GCA', src: 'Ponte et al. Ann Rheum Dis 2022', kind: 'points', thr: 6,
      pre: 'Apply once medium/large-vessel vasculitis is diagnosed and mimics are excluded.',
      entry: [L('Age ≥50 at diagnosis', null, X => (X.age == null ? (X.F.age50 ? true : null) : X.age >= 50), [])],
      domains: [{ d: 'Items', rule: 'sum', items: [
        C('Morning stiffness in shoulders/neck', 2, 'amstiff45'), C('Sudden visual loss', 3, 'visualloss'), C('Jaw or tongue claudication', 2, 'jaw'),
        C('New temporal headache', 2, 'temphead'), C('Scalp tenderness', 2, 'scalp'), C('Abnormal temporal artery exam', 2, 'taexam'),
        L('Maximum ESR ≥50 mm/h or CRP ≥10 mg/L', 3, X => (X.num('esr') != null || X.num('crp') != null ? (X.num('esr') || 0) >= 50 || (X.num('crp') || 0) >= 10 : null), ['esr', 'crp']),
        C('Positive temporal artery biopsy or halo sign on ultrasound', 5, 'tabx'), C('Bilateral axillary involvement on imaging', 2, 'axillary'), C('FDG-PET activity throughout the aorta', 2, 'petaorta')] }],
      judge: (r) => ({ met: r.entryMet && r.total >= 6, text: `${r.total} points. Classified as GCA if ≥6.` }),
    }],
  };

  function labTxt(ids, X) {
    return (ids || []).filter(X.done).map(id => { const t = X.TEST[id], v = X.v(id);
      return `${t.name.replace(/ \(.*\)/, '')} ${t.type === 'num' ? v + ' ' + t.unit : X.optLabel(t.type, v).replace(/ \(.*\)/, '')}`; }).join(' · ');
  }
  function item(it, X) {
    const o = { l: it.l, w: it.w == null ? null : it.w, f: it.f || null, sel: it.sel || null, from: it.from || 'from labs' };
    if (it.lab) { let lab = null; try { lab = it.lab(X); } catch (e) { lab = null; } o.lab = lab == null ? null : !!lab; o.labTxt = labTxt(it.ids, X); }
    if (it.sel) { const val = X.F[it.sel]; o.selVal = val == null ? '' : String(val); o.met = o.selVal !== ''; o.w = o.met ? parseInt(val, 10) : 0; }
    else o.met = (it.f ? !!X.F[it.f] : false) || o.lab === true;
    return o;
  }
  function runSet(set, X) {
    const entry = (set.entry || []).map(it => item(it, X));
    const entryMet = entry.every(e => e.met);
    const domains = set.domains.map(d => {
      const items = d.items.map(it => item(it, X)), met = items.filter(i => i.met);
      const score = d.rule === 'count' ? met.length : d.rule === 'sum' ? met.reduce((a, i) => a + (i.w || 0), 0) : met.reduce((a, i) => Math.max(a, i.w || 0), 0);
      return { d: d.d, rule: d.rule, need: d.need || null, clin: !!d.clin, items, score, total: score, pass: d.rule === 'count' ? score >= (d.need || 1) : score > 0 };
    });
    const total = domains.reduce((a, d) => a + d.score, 0);
    const r = { name: set.name, src: set.src, pre: set.pre || '', kind: set.kind, thr: set.thr, entry, entryMet, domains, total };
    const j = set.judge ? set.judge(r, X) : { met: total >= (set.thr || 0), text: '' };
    r.met = j.met; r.text = j.text;
    return r;
  }
  function evaluate(X) {
    const out = {};
    for (const k of Object.keys(SETS)) out[k] = SETS[k].map(s => runSet(s, X));
    return out;
  }
  root.SeroCriteria = { SETS, evaluate };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.SeroCriteria;
})(typeof window !== 'undefined' ? window : globalThis);
