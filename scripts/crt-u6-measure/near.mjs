// usage: node near.mjs   (reads fx-dump.json in the current directory)   vertical runs close to each other or to a box side
import fs from 'node:fs';
const r = JSON.parse(fs.readFileSync('fx-dump.json')).find(x => x.name === 'fix-default'); const N = r.nodes;
const vs = []; r.P.forEach(e => e.p.slice(1).forEach((q, k) => { const p = e.p[k]; if (p.x === q.x && p.y !== q.y) vs.push({e: e.f + '>' + e.t, x: p.x, lo: Math.min(p.y, q.y), hi: Math.max(p.y, q.y)}); }));
console.log('vertical runs within 30px of another vertical run (overlap > 30px), gap 4..30:');
for (let i = 0; i < vs.length; i++) for (let j = i + 1; j < vs.length; j++) { const a = vs[i], b = vs[j], g = Math.abs(a.x - b.x), ov = Math.min(a.hi, b.hi) - Math.max(a.lo, b.lo); if (g > 4 && g <= 30 && ov > 30) console.log(`  ${a.e} (x${Math.round(a.x)}) | ${b.e} (x${Math.round(b.x)}) gap ${Math.round(g)} overlap ${Math.round(ov)}  y ${Math.round(Math.max(a.lo,b.lo))}-${Math.round(Math.min(a.hi,b.hi))}`); }
console.log('vertical runs within 25px of a box side (outside) that overlap the box rows:');
for (const n of N) for (const v of vs) { const dl = n.x - v.x, dr = v.x - (n.x + n.w); const d = dl > 0 ? dl : dr > 0 ? dr : -1; if (d >= 0 && d <= 25 && Math.min(v.hi, n.y + n.h) - Math.max(v.lo, n.y) > 5 && !v.e.includes(n.id)) console.log(`  ${n.id} ${dl > 0 ? 'left' : 'right'} edge, ${v.e} x${Math.round(v.x)} dist ${Math.round(d)} overlap ${Math.round(Math.min(v.hi, n.y + n.h) - Math.max(v.lo, n.y))}`); }
