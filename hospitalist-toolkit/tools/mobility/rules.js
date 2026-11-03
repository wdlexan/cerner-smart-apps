/* Mobility rules: read PT / OT / nursing text into assist level, aid, distance, transfers, stairs, baseline, home set-up and equipment;
   then trend, a rough time estimate and a to-do list. Pure functions (tests/test_mobility.js).
   Text matching is UNVERIFIED (written by Claude): it finds phrases, it does not understand notes. Always check against the source note. */
(function (root) {
  const DAY = 864e5;
  const ok = (v) => typeof v === "number" && isFinite(v);

  /* ordinal assist scale, higher = more independent */
  const LEVELS = {
    1: "Dependent / lift", 2: "Max assist or 2-person", 3: "Moderate assist", 4: "Minimal assist", 5: "Contact guard", 6: "Supervision / standby", 7: "Independent with aid", 8: "Independent" };
  const LEVEL_RE = [
    [7, /\b(mod(ified)?\.? ?ind(ep(endent)?)?|mod ?i\b|independent(ly)?\s+(with|w\/|using)\s+(a |an |his |her |their )?(fww|2ww|4ww|walker|rollator|cane|crutch|aid|device|gait aid))/i],
    [1, /\b(dependent|total(ly)? assist|total care|mechanical lift|ceiling lift|hoyer|sit[- ]?to[- ]?stand lift|sara stedy|bed[- ]?bound|non[- ]?ambulatory|unable to (walk|ambulate|stand|weight[- ]bear))/i],
    [2, /\b(max(imal|imum)?\.? ?assist|max ?a\b|(assist|a) ?x ?2\b|x ?2 assist|(2|two)[- ]person|(2|two) assist)/i],
    [3, /\b(mod(erate)?\.? ?assist|mod ?a\b)/i],
    [4, /\b(min(imal|imum)?\.? ?assist|min ?a\b|light assist|(1|one)[- ]person assist|assist x ?1|with (1|one) assist)/i],
    [5, /\b(contact[- ]guard|\bcga\b|hands[- ]on guard)/i],
    [6, /\b(supervis\w*|stand[- ]?by( assist)?|\bsba\b|set[- ]?up only|close observation)/i],
    [8, /\b(independent(ly)?|indep\b|no (gait |walking )?aid)/i]];
  const AIDS = [
    ["wheelchair", "Wheelchair", /\b(wheel ?chair|w\/c|\bwc\b)/i], ["fww", "Front-wheeled walker", /\b(front[- ]wheeled walker|2[- ]?ww|two[- ]wheeled walker|\bfww\b|standard walker|pick[- ]up walker)/i],
    ["4ww", "Four-wheeled walker (rollator)", /\b(4[- ]?ww|four[- ]wheeled walker|rollator)/i], ["walker", "Walker", /\bwalker\b/i],
    ["crutches", "Crutches", /\bcrutch(es)?\b/i], ["cane", "Cane", /\b(quad cane|4[- ]point cane|single point cane|\bcane\b|walking stick)/i]];
  const EQUIP = [
    ["fww", "Front-wheeled walker", /front[- ]wheeled walker|2[- ]?ww\b|\bfww\b|two[- ]wheeled walker/i], ["4ww", "Four-wheeled walker (rollator)", /4[- ]?ww\b|four[- ]wheeled walker|rollator/i],
    ["cane", "Cane", /quad cane|\bcane\b/i], ["crutches", "Crutches", /crutch/i], ["wheelchair", "Wheelchair", /wheel ?chair/i],
    ["rts", "Raised toilet seat", /raised toilet seat|toilet seat raise|\brts\b/i], ["toiletframe", "Toilet safety frame", /toilet (safety )?(frame|rails?|arms)/i],
    ["commode", "Commode", /commode/i], ["bathseat", "Bath / shower seat", /(bath|shower|tub) (seat|chair|stool)/i], ["ttb", "Tub transfer bench", /tub transfer bench|\bttb\b|transfer bench/i],
    ["grab", "Grab bars", /grab ?bars?/i], ["bed", "Hospital bed", /hospital bed/i], ["bedrail", "Bed rail / transfer pole", /bed (rail|cane|assist bar)|transfer pole|super ?pole/i],
    ["hipkit", "Hip kit (reacher, sock aid, long shoe horn)", /hip kit|reacher|sock aid|long[- ]handled (shoe ?horn|sponge)/i], ["lift", "Mechanical / ceiling lift", /mechanical lift|ceiling lift|hoyer/i],
    ["slide", "Slide board", /slide ?board|transfer board/i], ["perch", "Perching stool", /perch(ing)? stool/i], ["alarm", "Personal alarm (lifeline)", /lifeline|personal (emergency )?alarm|medical alert/i],
    ["hipprot", "Hip protectors", /hip protector/i]];
  const BASELINE = /\b(baseline|prior to admission|pre[- ]?morbid(ly)?|pta\b|before (this )?admission|before (the )?(fall|fracture|illness)|usually|normally|at home (he|she|they|pt|patient) (was|is|walks|uses|used)|previously|\bat home\b|uses? (a |an |his |her )?\w+ at home)/i;
  const MOB = /ambulat|walk|gait|mobil|transfer|stand|sit[- ]?to[- ]?stand|bed ?to ?chair|stairs|steps|wheel ?chair|walker|cane|bed mobility|up to chair|toilet/i;

  const sentences = (t) => String(t || "").replace(/\r/g, "").split(/(?<=[.;!?])\s+|\n+/).map((s) => s.trim()).filter(Boolean);
  function levelIn(s) {
    const hits = LEVEL_RE.filter(([, re]) => re.test(s)).map(([l]) => l);
    if (!hits.length) return null;
    const lv = hits.includes(7) ? Math.min(...hits.filter((h) => h !== 8)) : Math.min(...hits);
    return lv;
  }
  const aidsIn = (s) => { const a = AIDS.filter(([, , re]) => re.test(s)).map(([id]) => id); return a.includes("fww") || a.includes("4ww") ? a.filter((x) => x !== "walker") : a; };
  const distIn = (s) => { let best = null; const re = /(\d{1,4})\s*(m|metres|meters|ft|feet|')(?![a-z])/gi; let m; while ((m = re.exec(s))) { let v = +m[1]; if (/f|'/i.test(m[2])) v = Math.round(v * 0.3048); if (v <= 500 && (best == null || v > best)) best = v; } return best; };

  /* one note / observation text -> findings */
  function extract(text) {
    const out = { level: null, aids: [], dist: null, transfer: null, stairs: null, wb: null, baseline: { level: null, aids: [] }, home: {}, recs: { dest: null, equipment: {} }, flags: {}, quote: "" };
    sentences(text).forEach((s) => {
      const base = BASELINE.test(s);
      const lv = MOB.test(s) || /assist|independent|supervis|guard|dependent/i.test(s) ? levelIn(s) : null;
      if (base) {
        if (lv != null && (out.baseline.level == null || lv < out.baseline.level)) out.baseline.level = lv;
        aidsIn(s).forEach((a) => !out.baseline.aids.includes(a) && out.baseline.aids.push(a));
      } else if (MOB.test(s)) {
        const isTransfer = /transfer|bed ?to ?chair|sit[- ]?to[- ]?stand|up to chair/i.test(s) && !/ambulat|walk|gait/i.test(s);
        const adlOnly = /toilet|dress|bath|shower|groom/i.test(s) && !isTransfer && !/ambulat|walk|gait/i.test(s);
        if (adlOnly) return;
        if (lv != null) {
          if (isTransfer) { if (out.transfer == null || lv < out.transfer) out.transfer = lv; }
          else if (out.level == null || lv < out.level) { out.level = lv; out.quote = s.slice(0, 160); }
        }
        if (!/recommend|will need|needs|require|order|has (a|an)|owns/i.test(s)) aidsIn(s).forEach((a) => !out.aids.includes(a) && out.aids.push(a));
        if (/ambulat|walk|gait/i.test(s)) { const d = distIn(s); if (d != null && (out.dist == null || d > out.dist)) out.dist = d; }
      }
      if (/stairs|steps/i.test(s) && !/(to enter|entrance|entry|at home|into (the )?(home|house)|bedroom|upstairs|to (get )?in)/i.test(s)) {
        if (/(not (yet )?(assessed|attempted|tested|done|practi[cs]ed)|unable|declined|deferred|to be assessed|to assess|will assess|tomorrow|next session)/i.test(s)) out.stairs = out.stairs === "done" ? "done" : "not done";
        else if (!/\b(if|once|when|until|before)\b/i.test(s) && /(managed|completed|negotiated|climbed|able|independent|with (one |1 |a )?(hand)?rail|safely|step[- ]to|reciprocal|x ?\d+)/i.test(s)) out.stairs = "done";
      }
      if (/(\d+)\s*(stairs|steps)/i.test(s) && /(to enter|entrance|entry|at home|into (the )?(home|house)|bedroom|upstairs|to (get )?in|lives)/i.test(s)) out.home.steps = Math.max(out.home.steps || 0, +s.match(/(\d+)\s*(stairs|steps)/i)[1]);
      if (/bedroom (is )?(up|upstairs)|upstairs bedroom|two[- ]stor(e)?y|2[- ]stor(e)?y/i.test(s)) out.home.upstairs = true;
      if (/lives alone/i.test(s)) out.home.alone = true; else if (/lives with|lives in .* with|spouse|wife|husband|partner|daughter|son\b/i.test(s) && /lives/i.test(s)) out.home.alone = false;
      if (/(assisted living|long[- ]term care|care home|nursing home|ltc\b)/i.test(s) && /lives|resid|from/i.test(s)) out.home.facility = true;
      if (/home support|home care|community health worker|chw\b/i.test(s) && /(has|receives|existing|currently|already)/i.test(s)) out.home.support = true;
      const wb = s.match(/\b(WBAT|weight[- ]bearing as tolerated|NWB|non[- ]weight[- ]bearing|TTWB|toe[- ]touch weight[- ]bearing|PWB|partial weight[- ]bearing|FWB|full weight[- ]bearing)\b/i);
      if (wb) out.wb = wb[1].toUpperCase().replace(/WEIGHT[- ]BEARING AS TOLERATED/, "WBAT").replace(/NON[- ]WEIGHT[- ]BEARING/, "NWB").replace(/TOE[- ]TOUCH WEIGHT[- ]BEARING/, "TTWB").replace(/PARTIAL WEIGHT[- ]BEARING/, "PWB").replace(/FULL WEIGHT[- ]BEARING/, "FWB");
      // recommendations
      if (/recommend|d\/c|discharge|dc plan|plan:|safe (for|to go)|would benefit|suitable for/i.test(s)) {
        const d = s.match(/(rehab(ilitation)?|restorative|transitional care|convalescent|long[- ]term care|\bltc\b|assisted living|alternate level|\balc\b|home with (\w+ ){0,3}(support|supports|help|home care|family)|home independently|home\b)/i);
        if (d && !/not (yet )?(safe|ready)/i.test(s)) {
          const either = s.match(/((rehab\w*|restorative|transitional care)\s+(vs\.?|versus|or)\s+home[^.;,]*|home[^.;,]*?\s+(vs\.?|versus|or)\s+(rehab\w*|restorative|transitional care))/i);
          out.recs.dest = either ? either[1].toLowerCase().trim() : d[1].toLowerCase();
        }
        if (/not (yet )?(safe|ready) (for|to)( discharge| go)?( home)?/i.test(s)) out.flags.notSafe = true;
      }
      // equipment: owned vs recommended
      EQUIP.forEach(([id, , re]) => {
        if (!re.test(s)) return;
        if (/(has|owns|already (has|own)|own (a|an)|at home (he|she|they) (has|uses))/i.test(s)) out.recs.equipment[id] = "has";
        else if (/(recommend|needs?|require|will need|order(ed)?|rent|loan|obtain|purchase|provide|equipment|issued|trial(led)?|for home|for discharge)/i.test(s) && out.recs.equipment[id] !== "has") out.recs.equipment[id] = "recommended";
      });
      if (/limited by pain|pain limit|due to pain|painful/i.test(s) && MOB.test(s)) out.flags.pain = true;
      if (/dizz|lighthead|orthostat|pre-?syncop|bp dropped/i.test(s)) out.flags.dizzy = true;
      if (/\bsob\b|short of breath|desat|spo2 (dropped|fell)|o2 sats? (dropped|fell)|fatigue limit|limited by fatigue|exertion/i.test(s)) out.flags.endurance = true;
      if (/confus|delirium|impulsiv|poor safety awareness|cogniti/i.test(s)) out.flags.cognition = true;
      if (/fall(s)? (in|during|on) (hospital|unit|ward)|fell (on|in) (the )?(unit|ward|hospital)|found on (the )?floor/i.test(s)) out.flags.inpatientFall = true;
    });
    return out;
  }

  /* goal level for discharge */
  function target(baselineLevel, dest) {
    if (dest === "rehab" || dest === "facility") return null;           // no home goal: aim for safe transfers
    if (dest === "home-24h") return Math.min(6, baselineLevel || 6);   // with someone there all the time: supervision is enough
    return baselineLevel != null ? Math.min(baselineLevel, 8) : 7;
  }

  /* progress and rough time to goal. assess: [{t, level}] ascending. daysPerLevel: fallback when no measured trend. */
  function estimate(assess, goal, daysPerLevel, now) {
    const a = (assess || []).filter((x) => ok(x.level)).sort((p, q) => p.t - q.t);
    if (!a.length) return { status: "none" };
    const cur = a[a.length - 1];
    if (goal == null) return { status: "nogoal", cur };
    if (cur.level >= goal) return { status: "met", cur };
    const gap = goal - cur.level, first = a[0], spanD = (cur.t - first.t) / DAY;
    // plateau: no gain over the last 3+ days
    const recent = a.filter((x) => cur.t - x.t <= 3.5 * DAY && cur.t - x.t >= 2.5 * DAY);
    const plateau = a.some((x) => cur.t - x.t >= 3 * DAY) && a.filter((x) => cur.t - x.t <= 3.5 * DAY).every((x) => x.level >= cur.level);
    let rate = null, src = "assumed";
    if (spanD >= 1 && cur.level > first.level) { rate = (cur.level - first.level) / spanD; src = "measured"; }
    if (plateau && !(rate && a.filter((x) => cur.t - x.t <= 3.5 * DAY).some((x) => x.level < cur.level))) return { status: "plateau", cur, gap, since: a.filter((x) => x.level === cur.level)[0].t };
    const perLevel = rate ? 1 / rate : daysPerLevel || 2;
    const mid = gap * perLevel;
    return { status: "progressing", cur, gap, src, rate, lo: Math.max(1, Math.round(mid * 0.7)), hi: Math.max(1, Math.round(mid * 1.5)) };
  }

  /* to-do list with rough lead times (days, [lo, hi]) */
  function todo(x) {
    const T = [];
    const add = (what, why, days, kind) => T.push({ what, why, days: days || null, kind: kind || "action" });
    if (!x.hasPT) add("Physiotherapy assessment", "No PT note found this admission.", [1, 2]);
    if (!x.hasOT && (x.cur == null || x.cur < 8 || x.equipNeeded)) add("Occupational therapy assessment", "Toileting, bathing, dressing, home set-up and equipment.", [1, 2]);
    if (x.ortho && !x.wb) add("Confirm weight-bearing status with ortho", "Not found in the notes.", [0, 0]);
    if ((x.homeSteps || x.upstairs) && x.stairs !== "done" && !x.facility) add(`Stair assessment${x.homeSteps ? " (" + x.homeSteps + " steps at home)" : ""}`, x.upstairs ? "Bedroom upstairs." : "Steps to get into the home.", [1, 2]);
    if (x.est && x.est.status === "progressing") add(`Daily mobilisation to reach ${x.goalLabel}`, `Now ${x.curLabel}.`, [x.est.lo, x.est.hi], "mobility");
    if (x.est && x.est.status === "plateau") add("No progress for 3 days or more", "Ask PT about prognosis; discuss rehab / restorative care, more home support, or a different destination.", null, "warn");
    if (x.equip.length) add("Arrange equipment: " + x.equip.join(", "), "Loan (Red Cross HELP) or vendor; deliver before discharge.", [1, 3]);
    if (x.alone && x.cur != null && x.cur <= 6 && !x.facility) add("Home support or a different destination", "Lives alone and needs supervision or hands-on help: Home and Community Care referral, family help, or restorative care.", [3, 7]);
    if (x.dest && /rehab|restorative|transitional|convalescent/.test(x.dest)) add("Rehab / restorative care referral", "Recommended in the notes; wait times vary.", [3, 14]);
    if (x.dest && /long[- ]term care|ltc|alternate level|alc|assisted living/.test(x.dest)) add("Placement process", "Recommended in the notes; usually long.", null, "warn");
    if (x.flags.pain) add("Optimise analgesia before PT", "Pain is limiting mobility.", [0, 1]);
    if (x.flags.dizzy) add("Orthostatic BP; review antihypertensives and fluids", "Dizziness during mobilisation.", [0, 1]);
    if (x.flags.cognition) add("Cognitive / safety screen (OT)", "Confusion or poor safety awareness noted.", [1, 2]);
    if (x.flags.endurance) add("Check oxygen with exertion", "Breathlessness or desaturation with walking.", [0, 1]);
    if (x.flags.inpatientFall) add("Post-fall review", "Fall in hospital noted.", [0, 1]);
    if (x.morse != null && x.morse >= 45) add("Falls precautions", `Morse falls score ${x.morse}.`, [0, 0]);
    return T;
  }
  /* overall estimate: everything that runs in parallel; the longest decides */
  function overall(T) {
    const d = T.filter((t) => t.days).map((t) => t.days);
    if (!d.length) return null;
    return [Math.max(...d.map((x) => x[0])), Math.max(...d.map((x) => x[1]))];
  }

  /* equipment list: from the notes plus suggestions from the situation */
  function equipment(x) {
    const out = new Map();
    const name = (id) => (EQUIP.find((e) => e[0] === id) || [id, id])[1];
    Object.entries(x.noted || {}).forEach(([id, st]) => out.set(id, { id, name: name(id), status: st, src: "in notes" }));
    const sug = (id, why) => { if (!out.has(id)) out.set(id, { id, name: name(id), status: "suggested", src: why }); };
    const aids = x.aids || [];
    if (aids.includes("fww") && !(x.baseAids || []).includes("fww")) sug("fww", "uses one on the ward");
    if (aids.includes("4ww") && !(x.baseAids || []).includes("4ww")) sug("4ww", "uses one on the ward");
    if (aids.includes("walker") && !aids.includes("fww") && !aids.includes("4ww") && !(x.baseAids || []).some((a) => /ww|walker/.test(a))) sug("fww", "walker used on the ward (type not stated)");
    if (x.hip) { sug("rts", "after hip surgery"); sug("hipkit", "after hip surgery"); sug("ttb", "after hip surgery (bathing)"); }
    if (x.cur != null && x.cur <= 4 && !x.facility) sug("commode", "needs hands-on help to walk");
    if (x.cur != null && x.cur <= 5 && !x.facility && !out.has("rts")) sug("toiletframe", "transfers need help");
    if (x.cur != null && x.cur <= 3 && !x.facility) { sug("bed", "moderate help or more"); sug("wheelchair", "moderate help or more"); }
    if (x.alone && !x.facility) sug("alarm", "lives alone");
    (x.baseAids || []).forEach((a) => { const id = a === "walker" ? "fww" : a; if (out.has(id) && out.get(id).status === "suggested") out.set(id, Object.assign(out.get(id), { status: "has", src: "used before admission" })); });
    return [...out.values()].sort((p, q) => ({ recommended: 0, suggested: 1, has: 2 }[p.status] - { recommended: 0, suggested: 1, has: 2 }[q.status]));
  }

  const api = { LEVELS, extract, levelIn, aidsIn, distIn, target, estimate, todo, overall, equipment, EQUIP, AIDS, DAY };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.MobRules = api;
})(typeof window !== "undefined" ? window : globalThis);
