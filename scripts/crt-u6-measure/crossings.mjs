import fs from 'node:fs';
const r = JSON.parse(fs.readFileSync(process.argv[2])).find(x => x.name === (process.argv[3] ?? 'fix-default'));
const segs = p => p.slice(1).map((q, k) => [p[k], q]);
const X = (a, b) => { // proper crossing of axis-aligned segments
  const [p, q] = a, [s, t] = b; const ah = p.y === q.y, bh = s.y === t.y; if (ah === bh) return null;
  const [h, v] = ah ? [a, b] : [b, a]; const y = h[0].y, x = v[0].x;
  if (x > Math.min(h[0].x, h[1].x) + .5 && x < Math.max(h[0].x, h[1].x) - .5 && y > Math.min(v[0].y, v[1].y) + .5 && y < Math.max(v[0].y, v[1].y) - .5) return [x, y]; return null; };
for (let i = 0; i < r.P.length; i++) for (let j = i + 1; j < r.P.length; j++) for (const a of segs(r.P[i].p)) for (const b of segs(r.P[j].p)) { const c = X(a, b); if (c) console.log(`${r.P[i].f}>${r.P[i].t} x ${r.P[j].f}>${r.P[j].t} at ${Math.round(c[0])},${Math.round(c[1])}`); }
