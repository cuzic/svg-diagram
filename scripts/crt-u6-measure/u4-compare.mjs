import fs from 'node:fs';
const [,, A, B] = process.argv; const keys=['c','cc','inAnd','pw','ov','b','h','lsd'];
for (const k of ['p','c']) {
  const a = JSON.parse(fs.readFileSync(`.scratch/res/${A}-${k}.json`)).out, b = JSON.parse(fs.readFileSync(`.scratch/res/${B}-${k}.json`)).out;
  let n=0, ch=0, ent=0; const worse=[], better=[], mixed=[], chg=[];
  a.forEach((x,i)=>{const y=b[i]; if(x.err||y.err) return; n++; if(x.H!==y.H){ch++; chg.push(x.g);} if(x.ent!==y.ent) ent++;
    if(x.H===y.H) return; const w=keys.filter(q=>y[q]>x[q]).map(q=>`${q}${x[q]}>${y[q]}`), g=keys.filter(q=>y[q]<x[q]).map(q=>`${q}${x[q]}>${y[q]}`);
    const s=`#${x.g}[ent${x.ent}>${y.ent} laid${x.laid}>${y.laid}] ${w.join(',')}${w.length&&g.length?' | ':''}${g.join(',')}`; (w.length&&g.length?mixed:w.length?worse:g.length?better:chg).push(s);});
  console.log(`== ${A}->${B} [${k}] n=${n} changed=${ch} entryChanged=${ent}`);
  for (const [t,l] of [['worse',worse],['mixed',mixed],['better',better],['routeOnly',chg.filter(x=>typeof x==='string')]]) if(l.length) console.log(` ${t}: ${l.join('; ')}`);
}
