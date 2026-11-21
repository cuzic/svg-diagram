// usage: node perfig.mjs <tagA> <tagB>  (in the directory run.sh wrote res/ to): per-figure maxima (bends, height, pairs) and the figures that got worse, plain (1800) and canvas.
import fs from 'node:fs';
const [,, A, B] = process.argv;
for (const k of ['p', 'c']) {
  const a = JSON.parse(fs.readFileSync(`res/${A}-${k}.json`)).out, b = JSON.parse(fs.readFileSync(`res/${B}-${k}.json`)).out;
  const rows = [];
  a.forEach((x, i) => { const y = b[i]; if (x.err || y.err) return; rows.push({g: x.g, dc: y.c - x.c, db: y.b - x.b, dbp: (y.b - x.b) / x.b, dpw: y.pw - x.pw, dh: y.h - x.h, dhp: (y.h - x.h) / x.h, dcc: y.cc - x.cc, dand: y.inAnd - x.inAnd, lsd: y.lsd - x.lsd, same: x.H === y.H}); });
  const top = (key, n = 4) => rows.slice().sort((p, q) => q[key] - p[key]).slice(0, n).map(r => `#${r.g}:${r[key].toFixed ? +r[key].toFixed(2) : r[key]}`).join(' ');
  console.log(`[${k}] ${A}->${B} n=${rows.length} changed=${rows.filter(r => !r.same).length}`);
  console.log(`  max bends +: ${top('db')} | % ${top('dbp')}`);
  console.log(`  max height +: ${top('dh')} | % ${top('dhp')}`);
  console.log(`  pairs up: ${rows.filter(r => r.dpw > 0).map(r => `#${r.g}:+${r.dpw}`).join(' ')}  crossings up: ${rows.filter(r => r.dc > 0).map(r => `#${r.g}:+${r.dc}`).join(' ')}  lsd up: ${rows.filter(r => r.lsd > 0).length}`);
  console.log(`  height up w/o crossings down: ${rows.filter(r => r.dh > 0.5 && r.dc >= 0).map(r => `#${r.g}(h${r.dh >= 0 ? '+' : ''}${r.dh},c${r.dc},cc${r.dcc},and${r.dand},pw${r.dpw})`).join(' ')}`);
  console.log(`  bends up w/o crossings/pairs/and-cross down: ${rows.filter(r => r.db > 0 && r.dc >= 0 && r.dpw >= 0 && r.dand >= 0 && r.dcc >= 0).map(r => `#${r.g}(+${r.db})`).join(' ')}`);
  console.log(`  bends up: n=${rows.filter(r => r.db > 0).length} ${rows.filter(r => r.db > 0).map(r => `#${r.g}(+${r.db},${Math.round(r.dbp * 100)}%;c${r.dc},pw${r.dpw},cc${r.dcc})`).join(' ')}`);
}
