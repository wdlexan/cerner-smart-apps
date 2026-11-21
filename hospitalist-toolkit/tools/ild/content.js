/* ILD tab reference content. UNVERIFIED draft written by Claude from general knowledge (ATS/ERS/JRS/ALAT IPF 2018/2022 and PPF guidance,
   2016 acute exacerbation definition, Pneumotox-type drug lists, CTS guidance). Verify before clinical use. */
(function () {
  const go = (k, t) => `<a href="#" data-goto="${k}">${t}</a>`;
  const tk = (k, t) => `<a href="#" data-toolkit="${k}">${t}</a>`;

  const SECTIONS = {
  acute: [
    { t: "Acute worsening in ILD: causes to work through", open: true, h: `
      <div class="flag red"><b>Acute exacerbation is a diagnosis of exclusion</b>, and it carries ~50% in-hospital mortality. Look hard for the treatable causes first.</div>
      <table><tr><th>Cause</th><th>Clues</th><th>Tests</th></tr>
        <tr><td><b>Infection</b> (bacterial, viral, PJP if immunosuppressed)</td><td>Fever, purulent sputum, focal consolidation, high procalcitonin</td><td>Cultures, viral swab (influenza, COVID, RSV), procalcitonin; immunosuppressed: LDH, beta-D-glucan, induced sputum/BAL PCR for PJP</td></tr>
        <tr><td><b>Pulmonary embolism</b></td><td>Sudden, pleuritic pain, tachycardia, unexplained hypoxia</td><td>CTPA (D-dimer often high anyway in ILD)</td></tr>
        <tr><td><b>Heart failure / fluid</b></td><td>Edema, effusions, septal lines, weight gain</td><td>BNP/NT-proBNP, echo; trial of diuresis</td></tr>
        <tr><td><b>Drug pneumonitis</b></td><td>New drug in the last weeks–months</td><td>${go("drug", "Drug pneumonitis tab")}</td></tr>
        <tr><td><b>Pneumothorax</b></td><td>Sudden pain and dyspnea</td><td>CXR / CT</td></tr>
        <tr><td>Aspiration</td><td>Dysphagia, GERD, sedation</td><td>Swallow assessment</td></tr>
        <tr><td>Pulmonary hypertension / RV failure</td><td>Raised JVP, edema, loud P2</td><td>Echo, BNP</td></tr>
        <tr><td><b>Acute exacerbation</b></td><td>&lt;1 month, new bilateral ground glass/consolidation on fibrosis</td><td>HRCT; criteria checker below</td></tr></table>
      <div id="aeBox"></div>
      <div id="workupBox"></div>` },
    { t: "Managing an acute exacerbation", open: false, h: `
      <ul>
        <li><b>Oxygen</b>: titrate to SpO2 88–92% (or higher if needed); high-flow nasal cannula is often the ceiling. Non-invasive ventilation has limited benefit.</li>
        <li><b>Antibiotics</b>: broad empiric cover until infection is excluded (many triggered exacerbations are infections).</li>
        <li><b>Steroids</b>: commonly given (e.g. methylprednisolone 500–1000 mg IV daily × 3 days, or prednisone ~1 mg/kg) but evidence is very weak and practice varies; guidelines give only a weak recommendation. Decide with respirology. Stop if no benefit.</li>
        <li><b>Avoid IV cyclophosphamide</b> in IPF exacerbation (EXAFIP: higher mortality).</li>
        <li><b>Continue the antifibrotic</b> (nintedanib or pirfenidone) unless there is a specific reason to hold.</li>
        <li>VTE prophylaxis; treat GERD; careful fluid balance.</li>
        <li><b>Intubation</b>: ICU mortality &gt;70–80% in fibrotic ILD on a ventilator – reserve for a reversible cause or a bridge to transplant. Discuss goals of care early, ideally with the patient's respirologist.</li>
        <li><b>Dyspnea</b>: low-dose opioids (e.g. morphine 1–2.5 mg PO q4h or hydromorphone 0.25–0.5 mg), fan, positioning, anxiolysis; palliative care involvement.</li>
      </ul>` },
    { t: "Prognosis (rough) and goals of care", open: false, h: `
      <table><tr><th>Setting</th><th>Rough outlook</th></tr>
        <tr><td>IPF, untreated</td><td>Median survival ~3–5 years from diagnosis</td></tr>
        <tr><td>IPF on antifibrotic</td><td>Slower FVC decline; longer survival</td></tr>
        <tr><td>Acute exacerbation of IPF</td><td>In-hospital mortality ~50%; median survival after an exacerbation ~3–4 months</td></tr>
        <tr><td>Fibrotic ILD on a ventilator</td><td>Hospital mortality &gt;70–80%</td></tr>
        <tr><td>Organizing pneumonia, drug pneumonitis, many HP and CTD-ILD</td><td>Often steroid-responsive and much better</td></tr></table>
      <div id="gapBox"></div>` } ],

  drug: [
    { t: "Drugs that cause pneumonitis or ILD", open: true, h: `
      <p>Suspect a drug in any new or worsening infiltrate. Stopping the drug is the main treatment; steroids for moderate/severe disease. A full list is at <a href="https://www.pneumotox.com" target="_blank" rel="noopener">pneumotox.com</a>.</p>
      <table><tr><th>Drug</th><th>Pattern</th><th>Notes</th></tr>
        <tr><td><b>Amiodarone</b></td><td>Pneumonitis, NSIP, organizing pneumonia, fibrosis; high-density lesions on CT</td><td>Usually after months, more with &gt;400 mg/day; can appear after stopping (half-life weeks). Stop; steroids for months.</td></tr>
        <tr><td><b>Nitrofurantoin</b></td><td>Acute: fever, rash, eosinophilia within days. Chronic: fibrosis/NSIP with long-term prophylaxis</td><td>Stop – many improve. Avoid long-term use in older adults.</td></tr>
        <tr><td><b>Methotrexate</b></td><td>Acute hypersensitivity pneumonitis (usually first year)</td><td>Also exclude PJP and infection. Stop; steroids. Pre-existing RA-ILD is not an absolute bar to methotrexate (rheumatology).</td></tr>
        <tr><td><b>Immune checkpoint inhibitors</b></td><td>Organizing pneumonia, NSIP, ground glass</td><td>Hold; grade ≥2 prednisone 1–2 mg/kg. ${tk("tox", "Oncology toxicity tab")}</td></tr>
        <tr><td><b>Trastuzumab deruxtecan</b> and other deruxtecan ADCs</td><td>ILD, can be fatal</td><td>Stop at any suspicion; steroids grade ≥2.</td></tr>
        <tr><td>EGFR/ALK TKIs, mTOR inhibitors</td><td>Pneumonitis</td><td>Hold; oncology.</td></tr>
        <tr><td>Bleomycin</td><td>Pneumonitis → fibrosis</td><td>Lowest FiO2 for SpO2 88–92%.</td></tr>
        <tr><td>Busulfan, carmustine, gemcitabine, cyclophosphamide, docetaxel, oxaliplatin, brentuximab, PI3K inhibitors</td><td>Pneumonitis / fibrosis</td><td>Oncology.</td></tr>
        <tr><td><b>Daptomycin</b>, minocycline, nitrofurantoin</td><td>Eosinophilic pneumonia (fever, hypoxia, eosinophilia)</td><td>Stop; steroids.</td></tr>
        <tr><td>Leflunomide, anti-TNF, rituximab, sulfasalazine, mesalamine</td><td>Uncommon pneumonitis / ILD worsening</td><td>Infection is more common – exclude it.</td></tr>
        <tr><td>Hydralazine, PTU, levamisole-cocaine</td><td>ANCA vasculitis, alveolar hemorrhage</td><td>ANCA; Hb drop, hemoptysis.</td></tr>
        <tr><td>Radiation</td><td>Pneumonitis 1–6 months after chest RT (borders follow the field); fibrosis later</td><td>Steroids if symptomatic.</td></tr>
        <tr><td>Vaping (EVALI), inhaled drugs</td><td>Ground glass, organizing pneumonia</td><td>Exposure history.</td></tr></table>
      <div id="drugBox"></div>` } ],

  ctd: [
    { t: "Connective tissue disease and ILD", open: true, h: `
      <p>About a quarter of "idiopathic" ILD turns out to have an autoimmune cause. It matters because CTD-ILD is treated with immunosuppression, not only antifibrotics.</p>
      <table><tr><th>Disease</th><th>Clues to look for</th><th>Tests</th></tr>
        <tr><td>Rheumatoid arthritis</td><td>Symmetric small-joint arthritis; UIP pattern common; male smokers</td><td>RF, anti-CCP</td></tr>
        <tr><td>Systemic sclerosis</td><td>Raynaud, sclerodactyly, digital ulcers, telangiectasia, GERD; NSIP pattern</td><td>ANA, Scl-70, centromere, RNA pol III; echo (pulmonary hypertension)</td></tr>
        <tr><td><b>Anti-synthetase syndrome</b></td><td>Mechanic's hands, myositis, arthritis, fever, Raynaud; NSIP/OP</td><td>CK, aldolase, Jo-1, PL-7, PL-12, EJ, OJ, Ro52</td></tr>
        <tr><td><b>Anti-MDA5 dermatomyositis</b></td><td>Rapidly progressive ILD, skin ulcers (palms, Gottron), little or no weakness, high ferritin</td><td>MDA5, ferritin – <b>urgent</b>: mortality high without early combined immunosuppression</td></tr>
        <tr><td>Sjögren</td><td>Dry eyes/mouth, parotid swelling; LIP, NSIP, cysts</td><td>SSA/Ro, SSB/La</td></tr>
        <tr><td>Lupus, MCTD</td><td>Rash, serositis, cytopenias; alveolar hemorrhage (lupus)</td><td>dsDNA, RNP, complement</td></tr>
        <tr><td>ANCA vasculitis (MPO)</td><td>Older patient, kidney involvement, hemoptysis; UIP-like ILD with MPO</td><td>ANCA (MPO/PR3), urinalysis</td></tr></table>
      <p>Usual first panel for new ILD: <b>ANA, ENA, RF, anti-CCP, CK, myositis panel, ANCA</b> (± dsDNA, complement). Interpretation: ${tk("sero", "Autoimmune serology tab")}.</p>
      <div id="seroBox"></div>` } ],

  types: [
    { t: "Main types of ILD (what the label means)", open: true, h: `
      <table><tr><th>Type</th><th>Typical patient / CT</th><th>Treatment and steroid response</th></tr>
        <tr><td><b>IPF</b> (UIP pattern)</td><td>&gt;60, male, ex-smoker; basal crackles, clubbing; subpleural basal reticulation, honeycombing, traction bronchiectasis</td><td><b>Antifibrotic</b> (nintedanib or pirfenidone). <b>No long-term steroids</b> (harm). O2, rehab, transplant referral if &lt;~70</td></tr>
        <tr><td><b>Fibrotic hypersensitivity pneumonitis</b></td><td>Exposure: birds, feathers (duvets), mould, hot tubs, farming; mosaic attenuation / air trapping, upper-mid zones</td><td><b>Remove the antigen</b>; prednisone, then mycophenolate; antifibrotic if progressive</td></tr>
        <tr><td>CTD-ILD</td><td>See ${go("ctd", "CTD tab")}; NSIP or UIP</td><td>Mycophenolate, rituximab, cyclophosphamide (specialist); nintedanib if progressive</td></tr>
        <tr><td>Idiopathic NSIP</td><td>Middle-aged, women; ground glass with subpleural sparing</td><td>Steroids + mycophenolate/azathioprine; often responds</td></tr>
        <tr><td><b>Organizing pneumonia</b> (COP / secondary)</td><td>"Pneumonia" that does not respond to antibiotics; migratory patchy consolidation, reversed halo; after infection, drugs, CTD, radiation</td><td><b>Steroids work well</b> (prednisone ~0.5–1 mg/kg tapered over months); relapses common</td></tr>
        <tr><td>Sarcoidosis</td><td>Young–middle-aged; hilar nodes, perilymphatic nodules, upper zones; eye, skin, heart, high Ca</td><td>Often no treatment; prednisone if symptomatic/organ-threatening; cardiac sarcoid → arrhythmia</td></tr>
        <tr><td>Occupational (asbestosis, silicosis)</td><td>Work history; pleural plaques (asbestos), upper zone nodules (silica)</td><td>Remove exposure; no steroids; compensation (WorkSafeBC)</td></tr>
        <tr><td>Smoking-related (RB-ILD, DIP)</td><td>Current smokers; ground glass, centrilobular nodules</td><td>Stop smoking; steroids for DIP</td></tr>
        <tr><td><b>Progressive pulmonary fibrosis</b> (any non-IPF fibrotic ILD)</td><td>Worsening symptoms, FVC drop ≥5–10%, more fibrosis on CT in a year</td><td><b>Nintedanib</b></td></tr>
        <tr><td>Acute ILDs</td><td>AIP (Hamman-Rich), acute eosinophilic pneumonia, diffuse alveolar hemorrhage, acute HP</td><td>Bronchoscopy/BAL; steroids for eosinophilic and many others; DAH → vasculitis work-up, plasma exchange/immunosuppression</td></tr></table>
      <p class="muted">Exposure history to ask every time: birds and feathers, mould/water damage, hot tubs, farming, wood/metal dust, asbestos, silica, vaping, drugs, radiation, family history of pulmonary fibrosis.</p>` } ],

  disch: [
    { t: "Before discharge", open: true, h: `
      <div id="dischBox"></div>
      <ul>
        <li><b>Exertional oxygen</b>: walk test with oximetry before discharge. Desaturation &lt;88% on exertion → ambulatory O2 assessment. Rest and exertion O2 need per the BC Home Oxygen Program criteria; document the flow rates.</li>
        <li><b>Antifibrotic</b>: resume nintedanib/pirfenidone (if held); LFTs per schedule; supply at home.</li>
        <li><b>Steroid taper</b> written out; <b>PJP prophylaxis</b> if prednisone ≥20 mg/day for ≥4 weeks or with other immunosuppressants; bone protection (calcium, vitamin D, bisphosphonate); glucose; PPI if indicated.</li>
        <li><b>Vaccines</b>: influenza, COVID-19, pneumococcal, RSV (≥60), zoster (non-live).</li>
        <li><b>Respirology follow-up</b> in 2–4 weeks with PFTs; referral to an ILD clinic if new diagnosis. Lung transplant referral early for younger patients with fibrotic ILD.</li>
        <li><b>Pulmonary rehabilitation</b> referral; smoking cessation; exposure avoidance (HP).</li>
        <li><b>Advance care planning</b>, home palliative care for advanced fibrotic ILD (dyspnea plan with low-dose opioids, crisis plan).</li>
        <li>GERD treatment if symptomatic; screen for pulmonary hypertension (echo) and sleep apnea where suspected.</li>
      </ul>` } ] };

  const api = { SECTIONS };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else window.IldContent = api;
})();
