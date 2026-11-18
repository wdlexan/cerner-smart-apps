/* Acid-base rules for the toolkit Acid-Base tab (pure logic, no DOM). UNVERIFIED draft written by Claude: check against references before clinical use.
 * Units: SI as used at Island Health — Na/K/Cl/HCO3/glucose/urea/lactate/BHB mmol/L,
 * albumin g/L, creatinine µmol/L, pCO2/pO2 mmHg, osmolality mmol/kg.
 * Decision support only — verify against the chart and clinical picture.
 */
(function (root) {
  'use strict';

  var FIELDS = ['pH', 'pCO2', 'pO2', 'HCO3', 'BE', 'tCO2', 'Na', 'K', 'Cl', 'albumin', 'glucose', 'urea', 'creatinine', 'osm', 'ethanol', 'lactate', 'lactatePrev', 'bhb', 'salicylate', 'CK', 'uNa', 'uK', 'uCl', 'uPH'];
  var NORMAL = { pH: [7.35, 7.45], pCO2: [35, 45], HCO3: [22, 26], AG: 10, AG_SD: 2, ALB: 40 };

  function num(v) { return (v === null || v === undefined || v === '' || isNaN(Number(v))) ? null : Number(v); }
  function r(x, d) { if (x === null || x === undefined || isNaN(x)) return null; var p = Math.pow(10, d || 0); return Math.round(x * p) / p; }

  // Henderson–Hasselbalch: HCO3 = 0.0307 × pCO2 × 10^(pH − 6.1)
  function calcHCO3(pH, pCO2) { return 0.0307 * pCO2 * Math.pow(10, pH - 6.1); }

  function interpret(input, meds) {
    input = input || {};
    var v = {};
    FIELDS.forEach(function (k) { v[k] = num(input[k]); });
    v.specimen = input.specimen || '';
    meds = meds || {};
    var out = { steps: [], disorders: [], flags: [], derived: {}, caveats: [], causesToShow: [] };
    var d = out.derived;

    function step(title, ok, text, teach) { out.steps.push({ title: title, ok: ok, text: text, teach: teach || '' }); }
    function flag(level, text) { out.flags.push({ level: level, text: text }); }
    function addDisorder(name, key) { if (out.disorders.indexOf(name) === -1) out.disorders.push(name); if (key && out.causesToShow.indexOf(key) === -1) out.causesToShow.push(key); }

    var pH = v.pH, pCO2 = v.pCO2;
    // Bicarbonate: prefer chemistry total CO2 for the gap; gas HCO3 (or calculated) for compensation
    var gasHCO3 = v.HCO3;
    if (gasHCO3 === null && pH !== null && pCO2 !== null) { gasHCO3 = calcHCO3(pH, pCO2); d.HCO3calculated = true; }
    var chemHCO3 = v.tCO2 !== null ? v.tCO2 : gasHCO3;
    var HCO3 = gasHCO3 !== null ? gasHCO3 : chemHCO3;
    d.HCO3 = r(HCO3, 1);

    if (pH !== null && pCO2 !== null && v.HCO3 !== null) {
      var hhpH = 6.1 + Math.log10(v.HCO3 / (0.0307 * pCO2)); d.hhpH = r(hhpH, 2);
      if (Math.abs(hhpH - pH) > 0.05) out.caveats.push('pH, pCO2 and HCO3 do not fit together (Henderson–Hasselbalch predicts pH ' + d.hhpH + '). Check for transcription error or values from different samples.');
    }
    if (v.specimen === 'venous') {
      out.caveats.push('Venous gas: pH runs ~0.03 lower and pCO2 ~4–5 mmHg higher than arterial; venous pCO2 is unreliable in shock/poor perfusion. Use an ABG if ventilation or oxygenation is the question.');
    }
    if (d.HCO3calculated) out.caveats.push('HCO3 calculated from pH and pCO2 (Henderson–Hasselbalch) — no measured value available.');

    // ---------- Step 1: primary disorder ----------
    var primary = null;
    if (pH === null || pCO2 === null || HCO3 === null) {
      step('1. Primary disorder', null, 'Need pH, pCO2 and HCO3 (or total CO2) to classify. Gap calculations below still run if chemistry is available.');
    } else {
      var lowH = HCO3 < NORMAL.HCO3[0], highH = HCO3 > NORMAL.HCO3[1];
      var lowC = pCO2 < NORMAL.pCO2[0], highC = pCO2 > NORMAL.pCO2[1];
      var txt;
      if (pH < NORMAL.pH[0]) {
        if (lowH && highC) { primary = 'mixed-acidosis'; addDisorder('Metabolic acidosis', 'metacid'); addDisorder('Respiratory acidosis', 'respacid'); txt = 'Acidaemia with low HCO3 AND high pCO2 → mixed metabolic + respiratory acidosis.'; }
        else if (highC) { primary = 'respacid'; addDisorder('Respiratory acidosis', 'respacid'); txt = 'Acidaemia (pH ' + pH + ') with high pCO2 → primary respiratory acidosis.'; }
        else if (lowH || HCO3 < 24) { primary = 'metacid'; addDisorder('Metabolic acidosis', 'metacid'); txt = 'Acidaemia (pH ' + pH + ') with low HCO3 → primary metabolic acidosis.'; }
        else { txt = 'Acidaemia without a clear primary change — check values/sample.'; }
      } else if (pH > NORMAL.pH[1]) {
        if (highH && lowC) { primary = 'mixed-alkalosis'; addDisorder('Metabolic alkalosis', 'metalk'); addDisorder('Respiratory alkalosis', 'respalk'); txt = 'Alkalaemia with high HCO3 AND low pCO2 → mixed metabolic + respiratory alkalosis.'; }
        else if (lowC) { primary = 'respalk'; addDisorder('Respiratory alkalosis', 'respalk'); txt = 'Alkalaemia (pH ' + pH + ') with low pCO2 → primary respiratory alkalosis.'; }
        else if (highH || HCO3 > 24) { primary = 'metalk'; addDisorder('Metabolic alkalosis', 'metalk'); txt = 'Alkalaemia (pH ' + pH + ') with high HCO3 → primary metabolic alkalosis.'; }
        else { txt = 'Alkalaemia without a clear primary change — check values/sample.'; }
      } else {
        if (lowH && lowC) {
          if (pH < 7.40) { primary = 'metacid'; addDisorder('Metabolic acidosis', 'metacid'); txt = 'pH ' + pH + ' (normal, acid side) with low HCO3 and low pCO2 → compensated metabolic acidosis, or metabolic acidosis + respiratory alkalosis. Winter\'s check below.'; }
          else { primary = 'respalk'; addDisorder('Respiratory alkalosis', 'respalk'); txt = 'pH ' + pH + ' (normal, alkaline side) with low pCO2 and low HCO3 → chronic respiratory alkalosis (the only disorder that can compensate to a normal pH), or respiratory alkalosis + metabolic acidosis. Check below; think salicylate, sepsis, liver failure, pregnancy.'; }
        }
        else if (highH && highC) {
          if (pH < 7.40) { primary = 'respacid'; addDisorder('Respiratory acidosis', 'respacid'); txt = 'pH ' + pH + ' (normal, acid side) with high pCO2 and high HCO3 → compensated chronic respiratory acidosis, or respiratory acidosis + metabolic alkalosis. Check below.'; }
          else { primary = 'metalk'; addDisorder('Metabolic alkalosis', 'metalk'); txt = 'pH ' + pH + ' (normal, alkaline side) with high HCO3 and high pCO2 → metabolic alkalosis with respiratory compensation, or + respiratory acidosis. Check below.'; }
        }
        else if (lowH || highH || lowC || highC) { txt = 'Normal pH with only one abnormal value (pCO2 or HCO3) — a mixed disorder whose effects cancel out is likely. Check the anion gap.'; primary = 'normal-pH-abn'; }
        else { txt = 'pH, pCO2 and HCO3 all normal. A hidden mixed disorder is still possible — check the anion gap below.'; primary = 'normal'; }
      }
      step('1. Primary disorder', primary && primary !== 'normal' ? false : true, txt,
        'pH < 7.35 = acidaemia, > 7.45 = alkalaemia. The variable that moved in the same direction as the pH change is the primary process (HCO3 for metabolic, pCO2 inverse for respiratory).');
    }

    // ---------- Step 2: compensation ----------
    if (primary && pCO2 !== null && HCO3 !== null) {
      if (primary === 'metacid' || primary === 'mixed-acidosis') {
        var exp = 1.5 * HCO3 + 8; d.expectedPCO2 = [r(exp - 2, 0), r(exp + 2, 0)];
        var ok = pCO2 >= exp - 2 && pCO2 <= exp + 2;
        var t = 'Winter\'s formula: expected pCO2 = 1.5 × ' + r(HCO3, 1) + ' + 8 ± 2 = ' + d.expectedPCO2[0] + '–' + d.expectedPCO2[1] + ' mmHg. Measured ' + pCO2 + '. ';
        if (ok) t += 'Appropriate respiratory compensation.';
        else if (pCO2 > exp + 2) { t += 'pCO2 higher than expected → concurrent respiratory acidosis (tiring, sedation, neuromuscular weakness). Consider ICU/airway review.'; addDisorder('Respiratory acidosis', 'respacid'); if (pH !== null && pH < 7.25) flag('high', 'Metabolic acidosis without adequate respiratory compensation — risk of decompensation; assess airway/fatigue now.'); }
        else { t += 'pCO2 lower than expected → concurrent respiratory alkalosis (sepsis, salicylate, liver failure, PE, pain/anxiety).'; addDisorder('Respiratory alkalosis', 'respalk'); }
        step('2. Compensation', ok, t, 'Respiratory compensation for metabolic acidosis is near-complete within 12–24 h. Quick check: pCO2 ≈ last two digits of the pH. pCO2 rarely falls below ~10–12 mmHg.');
      } else if (primary === 'metalk' || primary === 'mixed-alkalosis') {
        var e2 = 0.7 * HCO3 + 20; d.expectedPCO2 = [r(e2 - 5, 0), r(e2 + 5, 0)];
        var ok2 = pCO2 >= e2 - 5 && pCO2 <= e2 + 5;
        var t2 = 'Expected pCO2 = 0.7 × ' + r(HCO3, 1) + ' + 20 ± 5 = ' + d.expectedPCO2[0] + '–' + d.expectedPCO2[1] + ' mmHg. Measured ' + pCO2 + '. ';
        if (ok2) t2 += 'Appropriate respiratory compensation.';
        else if (pCO2 > e2 + 5) { t2 += 'pCO2 higher than expected → concurrent respiratory acidosis.'; addDisorder('Respiratory acidosis', 'respacid'); }
        else { t2 += 'pCO2 lower than expected → concurrent respiratory alkalosis.'; addDisorder('Respiratory alkalosis', 'respalk'); }
        step('2. Compensation', ok2, t2, 'Hypoventilation to compensate for metabolic alkalosis is limited — pCO2 rarely exceeds ~55 mmHg from compensation alone.');
      } else if (primary === 'respacid') {
        var dC = pCO2 - 40;
        var acute = 24 + 0.1 * dC, chrLo = 24 + 0.35 * dC, chrHi = 24 + 0.4 * dC;
        d.expectedHCO3acute = r(acute, 1); d.expectedHCO3chronic = [r(chrLo, 1), r(chrHi, 1)];
        var t3 = 'pCO2 up ' + r(dC, 0) + ' mmHg. Expected HCO3: acute ≈ ' + d.expectedHCO3acute + ' (1 per 10), chronic ≈ ' + d.expectedHCO3chronic[0] + '–' + d.expectedHCO3chronic[1] + ' (3.5–4 per 10). Measured ' + r(HCO3, 1) + '. ';
        var ok3 = true;
        if (HCO3 < acute - 2) { t3 += 'HCO3 lower than even acute compensation → concurrent metabolic acidosis.'; addDisorder('Metabolic acidosis', 'metacid'); ok3 = false; }
        else if (HCO3 <= acute + 2) t3 += 'Fits ACUTE respiratory acidosis.';
        else if (HCO3 < chrLo - 2) t3 += 'Between acute and chronic → acute-on-chronic or evolving (hours–days) respiratory acidosis.';
        else if (HCO3 <= chrHi + 2) t3 += 'Fits CHRONIC compensated respiratory acidosis.';
        else { t3 += 'HCO3 higher than chronic compensation → concurrent metabolic alkalosis (diuretics, steroids, post-hypercapnia).'; addDisorder('Metabolic alkalosis', 'metalk'); ok3 = false; }
        step('2. Compensation', ok3, t3, 'Renal compensation takes 3–5 days. Acute: HCO3 ↑1 per 10 mmHg pCO2; chronic: ↑3.5–4 per 10.');
      } else if (primary === 'respalk') {
        var dC2 = 40 - pCO2;
        var a2 = 24 - 0.2 * dC2, cLo = 24 - 0.5 * dC2, cHi = 24 - 0.4 * dC2;
        d.expectedHCO3acute = r(a2, 1); d.expectedHCO3chronic = [r(cLo, 1), r(cHi, 1)];
        var t4 = 'pCO2 down ' + r(dC2, 0) + ' mmHg. Expected HCO3: acute ≈ ' + d.expectedHCO3acute + ' (2 per 10), chronic ≈ ' + d.expectedHCO3chronic[0] + '–' + d.expectedHCO3chronic[1] + ' (4–5 per 10). Measured ' + r(HCO3, 1) + '. ';
        var ok4 = true;
        if (HCO3 > a2 + 2) { t4 += 'HCO3 higher than acute compensation → concurrent metabolic alkalosis.'; addDisorder('Metabolic alkalosis', 'metalk'); ok4 = false; }
        else if (HCO3 >= a2 - 2) t4 += 'Fits ACUTE respiratory alkalosis.';
        else if (HCO3 > cHi + 2) t4 += 'Between acute and chronic → evolving respiratory alkalosis.';
        else if (HCO3 >= cLo - 2) t4 += 'Fits CHRONIC respiratory alkalosis.';
        else { t4 += 'HCO3 lower than chronic compensation → concurrent metabolic acidosis.'; addDisorder('Metabolic acidosis', 'metacid'); ok4 = false; }
        step('2. Compensation', ok4, t4, 'Acute: HCO3 ↓2 per 10 mmHg pCO2; chronic: ↓4–5 per 10. Chronic respiratory alkalosis is the one disorder that can compensate to a normal pH.');
      }
    }

    // ---------- Step 3: anion gap ----------
    var Na = v.Na, Cl = v.Cl, alb = v.albumin, K = v.K;
    if (Na !== null && Cl !== null && chemHCO3 !== null) {
      var AG = Na - (Cl + chemHCO3);
      d.AG = r(AG, 1);
      var corr = AG; var corrTxt = '';
      if (alb !== null) { corr = AG + 0.25 * (NORMAL.ALB - alb); d.AGcorr = r(corr, 1); corrTxt = ' Albumin-corrected (albumin ' + alb + ' g/L): ' + d.AGcorr + '.'; }
      else corrTxt = ' No albumin result — gap may be underestimated if albumin is low.';
      var useAG = d.AGcorr !== undefined ? corr : AG;
      var highAG = useAG > NORMAL.AG + NORMAL.AG_SD;
      d.highAG = highAG;
      var t5 = 'AG = Na − (Cl + HCO3) = ' + Na + ' − (' + Cl + ' + ' + r(chemHCO3, 1) + ') = ' + d.AG + '.' + corrTxt + ' ';
      if (highAG) { t5 += 'HIGH anion gap → high anion gap metabolic acidosis (HAGMA) present, whatever the pH or compensation shows.'; addDisorder('High anion gap metabolic acidosis', 'hagma'); if (out.disorders.indexOf('Metabolic acidosis') === -1 && (pH === null || pH >= 7.35)) addDisorder('Metabolic acidosis', 'metacid'); }
      else if (useAG < 4) t5 += 'Low gap — check for lab error, hypoalbuminaemia, myeloma (paraprotein), lithium/bromide.';
      else t5 += 'Normal gap.';
      if (!highAG && chemHCO3 < NORMAL.HCO3[0] && (primary === 'metacid' || primary === 'mixed-acidosis' || primary === 'normal-pH-mixed' || out.disorders.indexOf('Metabolic acidosis') > -1)) {
        addDisorder('Normal anion gap (hyperchloraemic) metabolic acidosis', 'nagma');
        t5 += ' Low HCO3 with normal gap → NAGMA.';
      }
      step('3. Anion gap', !highAG, t5, 'Normal AG ≈ 10 ± 2 mmol/L without K (check your lab\'s range). Each 10 g/L fall in albumin lowers the gap ~2.5. A high gap is meaningful even with a normal pH or HCO3.');

      // ---------- Step 4: delta-delta ----------
      if (highAG) {
        var dAG = useAG - NORMAL.AG, dH = 24 - chemHCO3;
        var t6;
        if (dH <= 0) {
          t6 = 'High gap but HCO3 ≥ 24 → concurrent metabolic alkalosis masking the acidosis (vomiting, diuretics, NG suction).';
          addDisorder('Metabolic alkalosis', 'metalk'); step('4. Delta-delta', false, t6, ''); d.deltaRatio = null;
        } else {
          var ratio = dAG / dH; d.deltaRatio = r(ratio, 2);
          t6 = 'Δ AG / Δ HCO3 = (' + r(useAG, 1) + ' − 10) / (24 − ' + r(chemHCO3, 1) + ') = ' + d.deltaRatio + '. ';
          var ok6 = true;
          if (ratio < 0.4) { t6 += '< 0.4 → mostly normal anion gap acidosis with a smaller high-gap component.'; addDisorder('Normal anion gap (hyperchloraemic) metabolic acidosis', 'nagma'); ok6 = false; }
          else if (ratio < 1) { t6 += '< 1 → HAGMA plus a concurrent NAGMA (e.g. diarrhoea, saline, DKA recovery, renal failure).'; addDisorder('Normal anion gap (hyperchloraemic) metabolic acidosis', 'nagma'); ok6 = false; }
          else if (ratio <= 2) { t6 += '1–2 → pure HAGMA (lactate typically ~1.6; DKA closer to 1).'; }
          else { t6 += '> 2 → HAGMA plus concurrent metabolic alkalosis (or pre-existing high HCO3 from chronic respiratory acidosis).'; addDisorder('Metabolic alkalosis', 'metalk'); ok6 = false; }
          step('4. Delta-delta', ok6, t6, 'Compares the rise in gap with the fall in HCO3. If they do not match, a second metabolic process is changing HCO3 independently of the gap.');
        }
      }
    } else {
      step('3. Anion gap', null, 'Need Na, Cl and HCO3/total CO2.');
    }

    // ---------- Step 5: osmolar gap ----------
    if (v.osm !== null && Na !== null && v.glucose !== null && v.urea !== null) {
      var calcOsm = 2 * Na + v.glucose + v.urea + (v.ethanol !== null ? 1.25 * v.ethanol : 0);
      var og = v.osm - calcOsm; d.calcOsm = r(calcOsm, 0); d.osmGap = r(og, 0);
      var t7 = 'Calculated osm = 2 × Na + glucose + urea' + (v.ethanol !== null ? ' + 1.25 × ethanol' : '') + ' = ' + d.calcOsm + '. Measured ' + v.osm + '. Gap = ' + d.osmGap + '. ';
      var hi7 = og > 10;
      if (hi7) {
        t7 += '> 10 → unmeasured osmoles.';
        if (d.highAG) { flag('high', 'Osmolar gap ' + d.osmGap + ' with a high anion gap — consider methanol / ethylene glycol. Do not wait for levels: fomepizole, nephrology (dialysis) and BC Drug & Poison Information Centre 1-800-567-8911.'); addDisorder('Possible toxic alcohol', 'toxalc'); }
        else t7 += ' Without a high AG consider isopropanol, ethanol not entered, mannitol, glycine, propylene glycol, severe hyperlipidaemia/hyperproteinaemia.';
      } else t7 += 'Normal (≤ 10). A normal gap does NOT exclude late toxic alcohol ingestion (parent compound already metabolised).';
      step('5. Osmolar gap', !hi7, t7, 'Units mmol/L, so no conversion divisors. Ethanol raises measured osmolality by about 1.25 × its molar concentration (Purssell 2001); mg/dL ÷ 4.6 = mmol/L.');
    } else if (d.highAG) {
      step('5. Osmolar gap', null, 'High anion gap without a measured osmolality — send serum osmolality (with glucose, urea, Na, ethanol on the same sample) if the cause is not obvious.');
    }

    // ---------- Step 6: branch workups ----------
    var hasNAGMA = out.disorders.indexOf('Normal anion gap (hyperchloraemic) metabolic acidosis') > -1;
    if (hasNAGMA) {
      var t8 = '';
      if (v.uNa !== null && v.uK !== null && v.uCl !== null) {
        var uag = v.uNa + v.uK - v.uCl; d.UAG = r(uag, 0);
        t8 += 'Urine AG = UNa + UK − UCl = ' + d.UAG + '. ' + (uag < 0 ? 'Negative → kidneys excreting NH4+ appropriately → GI loss (diarrhoea, fistula, ileostomy) or saline.' : 'Positive → impaired NH4+ excretion → renal tubular acidosis (or CKD). Unreliable if urine Na < 20 or with ketonuria/other unmeasured anions.') + ' ';
      } else t8 += 'Send urine Na, K, Cl (and urine pH) to calculate the urine anion gap. ';
      if (K !== null) {
        if (K < 3.5) {
          if (v.uPH !== null) t8 += v.uPH > 5.5 ? 'Low K + urine pH > 5.5 → think distal (type 1) RTA. ' : 'Low K + urine pH < 5.5 → think proximal (type 2) RTA, GI loss, or acetazolamide/topiramate. ';
          else t8 += 'Low K → GI loss, type 1 or 2 RTA, carbonic anhydrase inhibitors. ';
        } else if (K > 5.0) t8 += 'High K → think type 4 RTA (hypoaldosteronism: diabetes, ACEi/ARB, spironolactone, trimethoprim, heparin, calcineurin inhibitors) or CKD. ';
      }
      if (meds.cai) t8 += 'On ' + meds.cai.join(', ') + ' (carbonic anhydrase inhibition) — can cause NAGMA. ';
      step('6a. NAGMA workup', null, t8.trim(), 'Urine AG approximates urine NH4+. Normal kidneys respond to acidosis by excreting NH4+ (with Cl−), so the urine AG becomes negative.');
    }
    if (out.disorders.indexOf('Metabolic alkalosis') > -1) {
      var t9 = '';
      if (v.uCl !== null) t9 += 'Urine Cl ' + v.uCl + ' → ' + (v.uCl < 20 ? '< 20: chloride-responsive (vomiting, NG suction, remote diuretics, post-hypercapnia, contraction) — treat with NaCl/KCl and volume.' : '> 20: chloride-resistant (current diuretic, hyperaldosteronism/Cushing, liquorice, severe hypokalaemia, Bartter/Gitelman) — check BP and renin/aldosterone if no diuretic.') + ' ';
      else t9 += 'Send urine Cl (more reliable than urine Na in alkalosis). ';
      if (meds.diuretic) t9 += 'On ' + meds.diuretic.join(', ') + ' — likely contributor. ';
      if (K !== null && K < 3.5) t9 += 'Hypokalaemia sustains the alkalosis — replace K. ';
      step('6b. Metabolic alkalosis workup', null, t9.trim(), 'Urine Cl is preferred over urine Na because bicarbonaturia drags Na into the urine even when volume-depleted.');
    }

    // ---------- Red flags ----------
    if (pH !== null && pH < 7.1) flag('high', 'Severe acidaemia (pH ' + pH + ') — consider ICU, treat cause; IV bicarbonate is reasonable for pH < 7.2 with AKI (BICAR-ICU) or NAGMA.');
    if (pH !== null && pH > 7.6) flag('high', 'Severe alkalaemia (pH ' + pH + ') — arrhythmia/seizure risk; check K, Ca, Mg.');
    if (pCO2 !== null && pH !== null && pCO2 > 60 && pH < 7.3) flag('high', 'Hypercapnic acidaemia (pCO2 ' + pCO2 + ') — consider NIV/ICU; review opioids, sedatives, O2 targets (88–92% if CO2 retainer).');
    if (v.lactate !== null) {
      if (v.lactate >= 4) flag('high', 'Lactate ' + v.lactate + ' mmol/L — sepsis/shock/ischaemia workup (Type A), then Type B (metformin, liver failure, salbutamol, malignancy, thiamine deficiency).');
      else if (v.lactate >= 2) flag('med', 'Lactate ' + v.lactate + ' mmol/L — repeat in 2–4 h after treatment.');
      if (meds.metformin && v.lactate >= 4) flag('high', 'On metformin with lactate ' + v.lactate + ' — consider metformin-associated lactic acidosis; hold metformin, check creatinine; dialysis if severe.');
      d.lactateRising = v.lactatePrev !== null && v.lactate - v.lactatePrev >= 1;
      if (d.lactateRising) flag('high', 'Lactate rising (' + v.lactatePrev + ' → ' + v.lactate + ').');
    }
    var acidotic = out.disorders.indexOf('Metabolic acidosis') > -1 || d.highAG;
    if (meds.sglt2 && acidotic) flag('high', 'On ' + meds.sglt2.join(', ') + ' with metabolic acidosis — rule out EUGLYCAEMIC DKA (glucose may be < 14). Check beta-hydroxybutyrate; hold SGLT2 inhibitor; DKA protocol with dextrose + insulin if ketotic.');
    if (v.bhb !== null) {
      if (v.bhb >= 3) flag('high', 'Beta-hydroxybutyrate ' + v.bhb + ' mmol/L → ketoacidosis (DKA if diabetic; also alcoholic or starvation ketoacidosis).');
      else if (v.bhb >= 1.5) flag('med', 'Beta-hydroxybutyrate ' + v.bhb + ' mmol/L — significant ketosis.');
    }
    if (v.glucose !== null && v.glucose >= 14 && acidotic) flag('med', 'Glucose ' + v.glucose + ' mmol/L with acidosis — check ketones for DKA.');
    if (v.salicylate !== null && v.salicylate > 2.2) flag('high', 'Salicylate ' + v.salicylate + ' mmol/L — toxic; alkalinise urine, repeat level q2h, nephrology/Poison Centre (1-800-567-8911). Avoid intubation if possible (loss of hyperventilation worsens acidaemia).');
    else if (out.disorders.indexOf('Respiratory alkalosis') > -1 && d.highAG && v.salicylate === null) flag('med', 'Respiratory alkalosis + high AG acidosis — classic salicylate pattern; send a salicylate level.');
    if (K !== null) {
      if (K >= 6) flag('high', 'K ' + K + ' — treat hyperkalaemia; ECG now.');
      if (K < 3) flag('high', 'K ' + K + ' — replace before/with insulin or bicarbonate (both drive K into cells).');
    }
    if (chemHCO3 !== null && chemHCO3 < 10) flag('high', 'HCO3 ' + r(chemHCO3, 1) + ' — very little buffer reserve; small further losses or loss of ventilatory compensation cause rapid pH fall.');
    if (v.CK !== null && v.CK > 5000 && d.highAG) flag('med', 'CK ' + v.CK + ' — rhabdomyolysis can contribute to HAGMA and hyperkalaemia.');
    if (v.creatinine !== null && v.creatinine > 300 && d.highAG) flag('med', 'Creatinine ' + v.creatinine + ' µmol/L — uraemic acidosis may contribute; nephrology if refractory acidosis, K, or volume.');

    if (!out.disorders.length && primary === 'normal' && !d.highAG) out.disorders.push('No acid-base disorder identified');
    return out;
  }

  // Simple medication classifier (names from MedicationRequest)
  var MED_CLASSES = {
    sglt2: /empagliflozin|dapagliflozin|canagliflozin|ertugliflozin|jardiance|forxiga|farxiga|invokana|synjardy|xigduo|glyxambi|steglatro/i,
    metformin: /metformin|glucophage|janumet|jentadueto|synjardy|xigduo|kazano|segluromet/i,
    diuretic: /furosemide|lasix|bumetanide|torsemide|hydrochlorothiazide|chlorthalidone|indapamide|metolazone/i,
    cai: /acetazolamide|topiramate|zonisamide|methazolamide/i,
    hyperK: /spironolactone|eplerenone|trimethoprim|sulfamethoxazole|tacrolimus|cyclosporine|amiloride|triamterene/i,
    alkali: /calcium carbonate|sodium bicarbonate|sodium citrate/i,
    sedative: /morphine|hydromorphone|oxycodone|fentanyl|lorazepam|midazolam|diazepam|clonazepam|zopiclone|quetiapine/i
  };
  function classifyMeds(names) {
    var out = {};
    (names || []).forEach(function (n) {
      Object.keys(MED_CLASSES).forEach(function (k) {
        if (MED_CLASSES[k].test(n)) { out[k] = out[k] || []; if (out[k].indexOf(n) === -1) out[k].push(n); }
      });
    });
    return out;
  }

  var api = { FIELDS: FIELDS, interpret: interpret, classifyMeds: classifyMeds, calcHCO3: calcHCO3, NORMAL: NORMAL };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.AcidBaseRules = api;
})(typeof window !== 'undefined' ? window : this);
