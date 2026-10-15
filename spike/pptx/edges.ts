// Every polyline the layout produces inside bands (edges of tree/states/cause/bpmn/classes/...): can a connector preset draw it?
import fs from 'node:fs';
import path from 'node:path';
import {register} from 'node:module';
import {closeMeasurer} from '../../lib/measure.ts';
import {loadLaidOut} from './run.ts';
import {fitConnector, evalConnector, maxDeviation, simplify, type Pt} from './geom.ts';

register(new URL('../../lib/resolve-hook.ts', import.meta.url));
const bySrc: Record<string, {n: number; ok: number; worst: number; fails: Record<string, number>; segs: Record<number, number>}> = {};
let lines = 0, degenerate = 0;
for (const f of fs.readdirSync('examples').filter(f => f.endsWith('.ts')).sort()) {
  const {laidOut} = await loadLaidOut(path.join('examples', f));
  const visit = (band: any, where: string): void => {
    for (const [k, v] of Object.entries(band)) {
      if (!Array.isArray(v)) continue;
      for (const e of v) {
        const pts = e && typeof e === 'object' ? (e as {points?: unknown}).points : undefined;
        if (!Array.isArray(pts) || pts.length < 2 || typeof (pts[0] as Pt).x !== 'number') continue;
        const key = `${where}.${k}`;
        const s = (bySrc[key] ??= {n: 0, ok: 0, worst: 0, fails: {}, segs: {}});
        s.n++; lines++;
        const r = fitConnector(pts as Pt[]);
        const nseg = simplify(pts as Pt[]).length - 1;
        s.segs[nseg] = (s.segs[nseg] ?? 0) + 1;
        if (!r.ok) { s.fails[r.why] = (s.fails[r.why] ?? 0) + 1; continue; }
        s.ok++;
        const dev = maxDeviation(pts as Pt[], evalConnector(r.x));
        if (dev > 0.5) degenerate++;
        s.worst = Math.max(s.worst, dev === Infinity ? 999 : dev);
      }
    }
  };
  for (const b of laidOut.laidOut) visit(b, b.type);
}
console.log(JSON.stringify({lines, degenerateOver0_5px: degenerate, bySrc}, null, 1));
closeMeasurer();
