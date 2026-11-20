/* Made-up test patients (NOT real people) for teaching and for testing without the sandbox. */
(function (root) {
  'use strict';
  const m = (v, disp) => ({ v, disp: disp || String(v), src: 'demo', date: '' });
  const DEMO = [
    {
      id: 'sle', label: 'Demo 1 — 28F: rash, arthritis, effusion, low platelets',
      pt: { name: 'TEST, Lupus (made-up)', age: 28, sex: 'female', mrn: 'DEMO001' },
      meds: ['acetaminophen 1 g PO q6h PRN'],
      S: { ana: m(640, '1:640'), anapat: m('homogeneous', 'Homogeneous'), dsdna: m('pos', '210 IU/mL (H)'), sm: m('pos', 'Positive'), rnp: m('pos', 'Positive'), ro: m('neg', 'Negative'), c3: m('low', '0.52 g/L (L)'), c4: m('low', '0.05 g/L (L)'), plt: m(82, '82'), wbc: m(3.1, '3.1'), upcr: m(1.3, '1.3 g/g'), uablood: m('pos', '2+'), cr: m(98, '98') },
      F: { acle: true, synovitis: true, effusion: true, oral: true },
    },
    {
      id: 'mpa', label: 'Demo 2 — 71M: AKI with hematuria, ILD',
      pt: { name: 'TEST, Vasculitis (made-up)', age: 71, sex: 'male', mrn: 'DEMO002' },
      meds: ['amlodipine 5 mg daily'],
      S: { anca: m('p', 'p-ANCA 1:320'), mpo: m('pos', '118 AU/mL (H)'), pr3: m('neg', '<2'), gbm: m('neg', 'Negative'), ana: m('neg', 'Negative'), c3: m('normal', '1.2'), c4: m('normal', '0.25'), cr: m(412, '412'), uablood: m('pos', '3+'), upcr: m(0.9, '0.9 g/g'), eos: m(0.2, '0.2') },
      F: { hematuria: true, rpgn: true, ild: true },
    },
    {
      id: 'ra', label: 'Demo 3 — 55F: symmetric small-joint synovitis',
      pt: { name: 'TEST, Arthritis (made-up)', age: 55, sex: 'female', mrn: 'DEMO003' },
      meds: [],
      S: { rf: m('high', '180 IU/mL (12× ULN)'), ccp: m('high', '>250 U/mL'), esr: m(48, '48'), crp: m(32, '32'), ana: m(80, '1:80') },
      F: { synovitis: true, dur6: true, raJoints: '5' },
    },
    {
      id: 'dil', label: 'Demo 4 — 74M on hydralazine: arthralgia, pleurisy',
      pt: { name: 'TEST, Druglupus (made-up)', age: 74, sex: 'male', mrn: 'DEMO004' },
      meds: ['hydralazine 50 mg PO TID', 'furosemide 40 mg daily'],
      S: { ana: m(1280, '≥1:1280'), anapat: m('homogeneous', 'Homogeneous'), histone: m('pos', 'Positive'), dsdna: m('neg', 'Negative'), c3: m('normal', '1.3'), c4: m('normal', '0.3') },
      F: { synovitis: true, effusion: true },
    },
    {
      id: 'lowana', label: 'Demo 5 — 81F: fatigue, ANA 1:80 DFS70 (teaching)',
      pt: { name: 'TEST, Lowtitre (made-up)', age: 81, sex: 'female', mrn: 'DEMO005' },
      meds: ['levothyroxine 75 mcg daily'],
      S: { ana: m(80, '1:80'), anapat: m('dfs', 'Dense fine speckled'), dsdna: m('neg', 'Negative'), sm: m('neg', 'Negative'), rnp: m('neg', 'Negative'), ro: m('neg', 'Negative'), la: m('neg', 'Negative'), c3: m('normal', '1.1'), c4: m('normal', '0.2') },
      F: {},
    },
    {
      id: 'cryo', label: 'Demo 6 — 63M: purpura, neuropathy, hematuria; HCV',
      pt: { name: 'TEST, Cryo (made-up)', age: 63, sex: 'male', mrn: 'DEMO006' },
      meds: [],
      S: { rf: m('high', '420 IU/mL'), c4: m('low', '<0.02 g/L'), c3: m('normal', '0.95'), hcv: m('pos', 'HCV RNA detected'), cryo: m('pos', 'Positive'), uablood: m('pos', '2+'), cr: m(160, '160') },
      F: { purpura: true, mononeuritis: true, hematuria: true },
    },
    {
      id: 'ssc', label: 'Demo 7 — 49F: Raynaud, puffy hands, new HTN, AKI',
      pt: { name: 'TEST, Scleroderma (made-up)', age: 49, sex: 'female', mrn: 'DEMO007' },
      meds: ['prednisone 40 mg daily'],
      S: { ana: m(1280, '≥1:1280'), anapat: m('nucleolar', 'Nucleolar/speckled'), rnapol: m('pos', 'Positive'), scl70: m('neg', 'Negative'), centromere: m('neg', 'Negative'), cr: m(240, '240') },
      F: { raynaud: true, puffy: true, sclerodactyly: true, skinprox: true, newhtn: true, rpgn: true },
    },
  ];
  root.SeroDemo = DEMO;
  if (typeof module !== 'undefined' && module.exports) module.exports = DEMO;
})(typeof window !== 'undefined' ? window : globalThis);
