/* node test_serology_criteria.js : the criteria checklists in each card give the same total and verdict as the card score (made-up cases + random ticks). */
const E=require('../tools/serology/engine.js');require('../tools/serology/criteria.js');
const D=require('../tools/serology/demo.js');
const feats=E.FEATURES.flatMap(g=>g[1].map(x=>x[0]));
let bad=0,n=0;
function check(S,F,ctx,tag){const R=E.evaluate(S,F,ctx);
 for(const k of ['sle','ra','sjogren','ssc','gpa','mpa','egpa']){const c=R.cards.find(x=>x.key===k),cr=R.criteria[k][0];
  if(c.score==null)continue; n++;
  if(c.score!==cr.total){bad++; if(bad<8)console.log('MISMATCH',tag,k,c.score,cr.total);}
  const vm=c.verdict==='meets', cm=!!cr.met; if(['sle','ra','sjogren','ssc','gpa','mpa','egpa'].includes(k)&&vm!==cm){bad++; if(bad<8)console.log('VERDICT',tag,k,c.verdict,cr.met,cr.text);}
 }}
for(const d of D) check(d.S,d.F,{age:d.pt.age,sex:d.pt.sex,meds:d.meds},d.id);
// random combos
let seed=7;const rnd=()=>{seed=(seed*1103515245+12345)%2147483648;return seed/2147483648};
for(let i=0;i<3000;i++){const d=D[i%D.length];const F={};feats.forEach(f=>{if(rnd()<0.2)F[f]=true});if(rnd()<0.5)F.raJoints=String([0,1,2,3,5][Math.floor(rnd()*5)]);check(d.S,F,{age:d.pt.age,sex:d.pt.sex,meds:d.meds},'rand'+i);}
console.log('checked',n,'bad',bad);
process.exit(bad ? 1 : 0);
