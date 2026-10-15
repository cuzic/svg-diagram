import {fitConnector, evalConnector, maxDeviation, type Pt} from './geom.ts';

// every orthogonal polyline of 1..5 segments, both start axes, random lengths and directions (including over/undershoot)
let seed = 7;
const rnd = (): number => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32;
const len = (): number => (rnd() < 0.5 ? -1 : 1) * (8 + Math.floor(rnd() * 200));
let worst = 0, fails = 0, total = 0;
const byN: Record<number, number> = {};
for (let n = 1; n <= 5; n++) for (const startH of [true, false]) for (let k = 0; k < 400; k++) {
  const pts: Pt[] = [{x: 300 + Math.floor(rnd() * 100), y: 300 + Math.floor(rnd() * 100)}];
  let h = startH;
  for (let i = 0; i < n; i++) { const p = pts[i]!; pts.push(h ? {x: p.x + len(), y: p.y} : {x: p.x, y: p.y + len()}); h = !h; }
  const r = fitConnector(pts);
  total++;
  if (!r.ok) { fails++; if (fails < 5) console.log('FIT FAIL', n, startH, r.why, JSON.stringify(pts)); continue; }
  const dev = maxDeviation(pts, evalConnector(r.x));
  byN[n] = Math.max(byN[n] ?? 0, dev === Infinity ? 999 : dev);
  worst = Math.max(worst, dev);
  if (dev > 0.5 && fails < 5) { fails++; console.log('DEV', n, startH, dev.toFixed(2), r.x.prst, JSON.stringify(pts)); }
}
console.log({total, fails, worst, byN});
// degenerate U (start and end on one axis): out 32px, back
const u: Pt[] = [{x: 100, y: 100}, {x: 100, y: 132}, {x: 100, y: 132}, {x: 100, y: 100}];
console.log('U (collinear: simplifies to 1 seg)', fitConnector(u).ok);
const u2: Pt[] = [{x: 100, y: 100}, {x: 70, y: 100}, {x: 70, y: 200}, {x: 100, y: 200}]; // C-shape, start/end same x
const r2 = fitConnector(u2); if (r2.ok) console.log('C-shape', r2.x.prst, r2.x.extX, r2.x.adj, 'dev', maxDeviation(u2, evalConnector(r2.x)).toFixed(3));
