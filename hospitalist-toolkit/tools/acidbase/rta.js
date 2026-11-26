/* RTA screen for the Acid-base tab (pure logic, no DOM). UNVERIFIED draft written by Claude: check against references before clinical use.
 * Input v (SI): K, Na, Cl, tCO2 (or HCO3), glucose, phos, creatinine, uNa, uK, uCl, uPH, uOsm, uUrea, uGlu, uKet, bhb
 * meds: medication name strings; probs: problem-list name strings; nagma: true when the main rules found a normal-gap acidosis.
 * Returns the kidney ammonium verdict, a best-fit pattern (type1 / type2 / type4 / hyperKdistal / gi / ckd / unclear) with reasons,
 * drugs and problems that cause each type, missing tests and treatment for the best fit. */
(function (root) {
  'use strict';
  function num(x) { return x === null || x === undefined || x === '' || isNaN(Number(x)) ? null : Number(x); }
  function r(x, d) { if (x === null || isNaN(x)) return null; var p = Math.pow(10, d || 0); return Math.round(x * p) / p; }

  /* drugs: [regex, label, types] */
  var DRUGS = [
    [/amphotericin|ambisome|fungizone/i, 'Amphotericin B', ['type1']],
    [/lithium/i, 'Lithium', ['type1']],
    [/ifosfamide/i, 'Ifosfamide', ['type1', 'type2']],
    [/foscarnet/i, 'Foscarnet', ['type1']],
    [/tenofovir disoproxil|\btdf\b|viread|truvada|atripla|complera|stribild/i, 'Tenofovir disoproxil', ['type2']],
    [/cisplatin/i, 'Cisplatin', ['type2']],
    [/gentamicin|tobramycin|amikacin/i, 'Aminoglycoside', ['type2']],
    [/deferasirox|exjade|jadenu/i, 'Deferasirox', ['type2']],
    [/valpro|divalproex|epival|depakene/i, 'Valproate', ['type2']],
    [/acetazolamide|diamox|methazolamide/i, 'Acetazolamide (carbonic anhydrase inhibitor)', ['type2']],
    [/topiramate|topamax|zonisamide/i, 'Topiramate / zonisamide (carbonic anhydrase inhibition)', ['type2']],
    [/\w+pril\b/i, 'ACE inhibitor', ['type4']],
    [/\w+sartan\b|entresto|sacubitril/i, 'ARB / ARNI', ['type4']],
    [/spironolactone|eplerenone|finerenone|aldactone|inspra/i, 'Mineralocorticoid antagonist', ['type4']],
    [/amiloride|triamterene/i, 'Amiloride / triamterene (ENaC block)', ['type4', 'hyperKdistal']],
    [/trimethoprim|sulfamethoxazole|septra|bactrim|co-?trimoxazole/i, 'Trimethoprim (ENaC block)', ['type4', 'hyperKdistal']],
    [/pentamidine/i, 'Pentamidine', ['type4']],
    [/\bheparin|enoxaparin|dalteparin|tinzaparin|lovenox|fragmin|innohep/i, 'Heparin / LMWH (lowers aldosterone)', ['type4']],
    [/ibuprofen|naproxen|diclofenac|ketorolac|celecoxib|indomethacin|meloxicam|ketoprofen/i, 'NSAID (lowers renin)', ['type4']],
    [/tacrolimus|cyclosporin|ciclosporin|prograf|advagraf|neoral/i, 'Calcineurin inhibitor', ['type4']],
    [/drospirenone|yasmin|yaz/i, 'Drospirenone', ['type4']]
  ];
  var PROBS = [
    [/sj[oö]gren/i, 'Sjögren syndrome', ['type1']],
    [/lupus|\bsle\b|M32/i, 'Lupus', ['type1', 'hyperKdistal']],
    [/rheumatoid|M05|M06/i, 'Rheumatoid arthritis', ['type1']],
    [/primary biliary|K74\.3/i, 'Primary biliary cholangitis', ['type1']],
    [/nephrocalcinosis|nephrolithiasis|kidney stone|renal calcul|N20/i, 'Kidney stones / nephrocalcinosis', ['type1']],
    [/sickle/i, 'Sickle cell disease', ['type1', 'hyperKdistal']],
    [/myeloma|light chain|mgus|C90|D47\.2/i, 'Myeloma / light chains', ['type2']],
    [/amyloid|E85/i, 'Amyloidosis', ['type2']],
    [/fanconi/i, 'Fanconi syndrome', ['type2']],
    [/wilson/i, 'Wilson disease', ['type2']],
    [/\bhiv\b|B20|Z21/i, 'HIV (check for tenofovir)', ['type2']],
    [/diabet|E1[0-4]/i, 'Diabetes (hyporeninaemic hypoaldosteronism)', ['type4']],
    [/obstruct.*urop|hydroneph|N13|urinary retention|R33|benign prostat|N40/i, 'Obstructive uropathy / retention', ['type4', 'hyperKdistal']],
    [/addison|adrenal insuff|hypoadrenal|E27/i, 'Adrenal insufficiency', ['type4']],
    [/transplant|Z94\.0/i, 'Kidney transplant', ['type1', 'type4']],
    [/chronic kidney|N18/i, 'CKD', ['type4', 'ckd']]
  ];

  var LABEL = { type1: 'Distal (type 1) RTA', type2: 'Proximal (type 2) RTA', type4: 'Type 4 RTA (hypoaldosteronism)', hyperKdistal: 'Hyperkalaemic distal RTA (voltage defect)',
    gi: 'GI bicarbonate loss (not RTA)', ckd: 'Acidosis of CKD', unclear: 'Type not yet clear' };

  var TREAT = {
    type1: ['Replace K before or with alkali.', 'Potassium citrate (or sodium bicarbonate) about 1–2 mmol/kg/day in divided doses; aim for a normal HCO3. Citrate also lowers stone risk.',
      'Find the cause: ANA, SSA/SSB, review drugs (amphotericin, lithium, ifosfamide). Renal ultrasound for stones or nephrocalcinosis.'],
    type2: ['Large alkali doses: about 10–15 mmol/kg/day (extra HCO3 is lost in the urine). Give K with it: alkali makes K loss worse.',
      'Stop the culprit drug if possible (tenofovir disoproxil, ifosfamide, topiramate, acetazolamide).', 'Adults: SPEP and serum free light chains for myeloma. Fanconi: replace phosphate, vitamin D. A thiazide can reduce the alkali needed.'],
    type4: ['Treat high K first (local protocol; ECG if K ≥ 6).', 'Review trimethoprim, NSAIDs, K-sparing diuretics, heparin; weigh the benefit of ACEi/ARB before stopping.',
      'Low-K diet; loop or thiazide diuretic if not volume deplete; K binder (sodium zirconium cyclosilicate or patiromer).',
      'Fludrocortisone only for true aldosterone deficiency without hypertension or fluid overload. Correcting K often improves the acidosis; sodium bicarbonate if HCO3 stays low (CKD).'],
    hyperKdistal: ['Treat high K. Look for obstruction (bladder scan, renal ultrasound) and stop amiloride/trimethoprim.', 'Relief of obstruction usually corrects it; alkali if acidosis persists.'],
    gi: ['Not RTA: the kidneys are excreting acid normally.', 'Replace volume with balanced crystalloid (not saline) and K. Treat the diarrhoea, fistula or stoma output. Oral bicarbonate for ongoing high-output losses.'],
    ckd: ['Acidosis of CKD (low NH4+ from fewer nephrons).', 'Oral sodium bicarbonate if HCO3 stays < 18–22; nephrology follow-up.'],
    unclear: ['Send the missing tests below, then re-check.']
  };

  function screen(input, meds, probs, nagma) {
    var v = {}; input = input || {};
    ['K', 'Na', 'Cl', 'tCO2', 'HCO3', 'glucose', 'phos', 'creatinine', 'uNa', 'uK', 'uCl', 'uPH', 'uOsm', 'uUrea', 'uGlu', 'uKet', 'bhb'].forEach(function (k) { v[k] = num(input[k]); });
    var o = { relevant: !!nagma, UAG: null, UOG: null, uNH4: null, nh4: null, nh4Why: '', best: 'unclear', reasons: [], cautions: [], missing: [], drugs: [], probs: [], fanconi: [], treat: [], nephro: [], rows: {} };
    var HCO3 = v.tCO2 !== null ? v.tCO2 : v.HCO3;

    // ---- kidney ammonium: urine osmolal gap is preferred when the urine AG is unreliable ----
    if (v.uNa !== null && v.uK !== null && v.uCl !== null) o.UAG = r(v.uNa + v.uK - v.uCl, 0);
    if (v.uOsm !== null && v.uNa !== null && v.uK !== null && v.uUrea !== null) {
      o.UOG = r(v.uOsm - (2 * (v.uNa + v.uK) + v.uUrea + (v.uGlu !== null ? v.uGlu : 0)), 0); o.uNH4 = r(o.UOG / 2, 0);
    }
    var uagBad = (v.uNa !== null && v.uNa < 20) || (v.uKet !== null && v.uKet > 0) || (v.bhb !== null && v.bhb >= 1.5);
    if (o.UOG !== null) {
      o.nh4 = o.UOG < 40 ? 'low' : o.UOG > 100 ? 'high' : 'mid';
      o.nh4Why = 'Urine osmolal gap ' + o.UOG + ' (NH4+ ≈ ' + o.uNH4 + ' mmol/L): ' + (o.nh4 === 'low' ? '< 40 → kidney NOT making enough NH4+ → renal cause.' : o.nh4 === 'high' ? '> 100 → kidney making NH4+ normally → GI loss or saline.' : '40–100 → borderline.');
    } else if (o.UAG !== null) {
      o.nh4 = o.UAG > 0 ? 'low' : o.UAG < -10 ? 'high' : 'mid';
      o.nh4Why = 'Urine anion gap ' + o.UAG + ': ' + (o.nh4 === 'low' ? 'positive → too little NH4+ → renal cause (RTA or CKD).' : o.nh4 === 'high' ? 'negative → kidney making NH4+ normally → GI loss or saline.' : '0 to −10 → borderline.');
      if (uagBad) o.cautions.push('Urine AG is unreliable here (' + (v.uNa !== null && v.uNa < 20 ? 'urine Na < 20' : 'ketones present') + '). Send urine osmolality and urea for the urine osmolal gap.');
    }

    // ---- Fanconi clues ----
    if (v.uGlu !== null && v.uGlu > 1 && (v.glucose === null || v.glucose < 10)) o.fanconi.push('Glucose in urine (' + v.uGlu + ') with ' + (v.glucose !== null ? 'blood glucose ' + v.glucose : 'no high blood glucose recorded'));
    if (v.phos !== null && v.phos < 0.8) o.fanconi.push('Low phosphate (' + v.phos + ')');

    // ---- best fit ----
    var K = v.K, uPH = v.uPH, ckd = v.creatinine !== null && v.creatinine > 250;
    if (K === null) { o.missing.push('Serum K (decides low-K vs high-K RTA)'); }
    else if (K > 5.0) {
      if (uPH !== null && uPH > 5.5 && o.nh4 !== 'high') { o.best = 'hyperKdistal'; o.reasons.push('High K (' + K + ') with urine pH ' + uPH + ' (> 5.5) → distal H+ secretion also impaired (voltage defect).'); }
      else if (o.nh4 === 'high') { o.best = 'unclear'; o.reasons.push('High K but the kidney is making NH4+ normally: look for a GI or saline cause plus a separate reason for high K.'); }
      else { o.best = 'type4'; o.reasons.push('High K (' + K + ') with normal gap acidosis' + (uPH !== null ? ' and urine pH ' + uPH + ' (≤ 5.5)' : '') + ' → low aldosterone effect (type 4).'); }
    } else if (o.nh4 === 'high') {
      o.best = 'gi'; o.reasons.push(o.nh4Why);
      if (uPH !== null && uPH > 5.5) o.cautions.push('Urine pH ' + uPH + ' is > 5.5, but the NH4+ is high: in diarrhoea, lots of NH3 buffers the urine. This is NOT distal RTA.');
      if (o.fanconi.length) { o.best = 'type2'; o.reasons.push('Proximal tubule clues: ' + o.fanconi.join('; ') + '. Proximal RTA can have a negative urine AG at steady state.'); }
    } else if (o.nh4 === 'low' || o.nh4 === 'mid' || o.nh4 === null) {
      if (o.fanconi.length) { o.best = 'type2'; o.reasons.push('Proximal tubule clues: ' + o.fanconi.join('; ') + '.'); }
      else if (uPH !== null && uPH > 5.5 && o.nh4 !== 'mid') { o.best = 'type1'; o.reasons.push((K < 3.5 ? 'Low K (' + K + ')' : 'K ' + K) + ', urine pH ' + uPH + ' (> 5.5) and ' + (o.nh4 === 'low' ? 'low NH4+' : 'no NH4+ estimate yet') + ' → distal (type 1).'); }
      else if (uPH !== null && uPH <= 5.5 && o.nh4 === 'low') {
        if (K < 3.5) { o.best = 'type2'; o.reasons.push('Low K, urine pH ' + uPH + ' (can acidify) → proximal (type 2) more likely; look for Fanconi signs.'); }
        else { o.best = ckd ? 'ckd' : 'type4'; o.reasons.push('Urine can acidify (pH ' + uPH + ') but NH4+ is low with K ' + K + (ckd ? ' and creatinine ' + v.creatinine + ' → acidosis of CKD.' : ' → early type 4 / low-ammonia pattern.')); }
      }
      if (o.nh4 === 'low' && o.best === 'unclear') o.reasons.push(o.nh4Why);
    }
    if (ckd && (o.best === 'type1' || o.best === 'type4' || o.best === 'unclear')) o.cautions.push('Creatinine ' + v.creatinine + ': advanced CKD alone lowers NH4+ excretion, so a positive urine AG is expected.');
    if (HCO3 !== null) {
      if (o.best === 'type2' && HCO3 < 12) o.cautions.push('HCO3 ' + HCO3 + ' is lower than usual for proximal RTA (self-limited around 12–18): look for a second cause.');
      if (o.best === 'type4' && HCO3 < 15) o.cautions.push('HCO3 ' + HCO3 + ' is low for type 4 RTA (usually 17–22): look for a second cause.');
    }

    // ---- drugs and problems ----
    (meds || []).forEach(function (n) { DRUGS.forEach(function (d) { if (d[0].test(n) && !o.drugs.some(function (x) { return x.label === d[1]; })) o.drugs.push({ label: d[1], name: n, types: d[2] }); }); });
    (probs || []).forEach(function (n) { PROBS.forEach(function (p) {
      if (!p[0].test(n) || o.probs.some(function (x) { return x.labels.indexOf(p[1]) > -1; })) return;
      var same = o.probs.filter(function (x) { return x.name === n; })[0];
      if (same) { same.labels.push(p[1]); same.label = same.labels.join(' + '); p[2].forEach(function (t) { if (same.types.indexOf(t) === -1) same.types.push(t); }); }
      else o.probs.push({ label: p[1], labels: [p[1]], name: n, types: p[2].slice() });
    }); });
    // a cause that fits the pattern supports it; with no other data, a drug can suggest the type
    var fits = function (arr) { return arr.filter(function (x) { return x.types.indexOf(o.best) > -1; }); };
    fits(o.drugs).forEach(function (d) { o.reasons.push('On ' + d.name + ' (' + d.label + ') — known cause.'); });
    fits(o.probs).forEach(function (p) { o.reasons.push('Problem list: ' + p.name + ' (' + p.label + ').'); });

    // ---- missing tests ----
    if (o.UAG === null) o.missing.push('Urine Na, K, Cl (spot) → urine anion gap');
    if (uPH === null) o.missing.push('Fresh urine pH (pH meter if possible; dipstick is rough)');
    if (o.UOG === null && (uagBad || o.nh4 === 'mid' || o.UAG === null)) o.missing.push('Urine osmolality and urea (± glucose) → urine osmolal gap');
    if ((o.best === 'type2' || (K !== null && K < 3.5 && o.best !== 'gi')) && v.phos === null) o.missing.push('Serum phosphate (Fanconi)');
    if ((o.best === 'type2' || (K !== null && K < 3.5 && o.best !== 'gi')) && v.uGlu === null) o.missing.push('Urinalysis for glucose (glucose in urine with normal blood glucose = proximal)');
    if (o.best === 'type1') o.missing.push('Renal ultrasound (stones, nephrocalcinosis); ANA, SSA/SSB; urine Ca and citrate');
    if (o.best === 'type2') o.missing.push('SPEP and serum free light chains (myeloma); urate, urine phosphate');
    if (o.best === 'type4') o.missing.push('Renin, aldosterone, AM cortisol (if cause not obvious); bladder scan for retention');
    if (o.best === 'hyperKdistal') o.missing.push('Bladder scan / renal ultrasound for obstruction');

    o.treat = TREAT[o.best] || [];
    // ---- nephrology ----
    if (o.best === 'type1' || o.best === 'type2') o.nephro.push('Suspected ' + (o.best === 'type1' ? 'distal' : 'proximal') + ' RTA in an adult: needs a cause found.');
    if (o.fanconi.length) o.nephro.push('Fanconi features.');
    if (HCO3 !== null && HCO3 < 15 && o.best !== 'gi') o.nephro.push('HCO3 ' + HCO3 + ' (< 15).');
    if (K !== null && K >= 6) o.nephro.push('K ' + K + ' (≥ 6).');
    if (o.probs.some(function (p) { return p.label === 'Kidney transplant'; })) o.nephro.push('Kidney transplant patient.');
    if (o.best === 'unclear' && o.relevant && o.UAG !== null && uPH !== null) o.nephro.push('Type still unclear with urine AG and pH available.');

    // ---- comparison table highlights ----
    o.label = LABEL[o.best];
    return o;
  }

  var api = { screen: screen, LABEL: LABEL, TREAT: TREAT, DRUGS: DRUGS, PROBS: PROBS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.AcidBaseRTA = api;
})(typeof window !== 'undefined' ? window : this);
