// ADR 0073 U6: per-figure comparison of two pins-measure.ts runs. usage (in the directory that holds res/): node u6-compare.mjs <baseTag> <tag> [--list]
// Per set (plain 300 / canvas 150): sums, the figures whose route changed, and the figures that got worse (more crossings, cause-crossing, AND crossings, pairs, overlaps, taller than +0.5px) or better, per key.
import fs from 'node:fs';
const [,, A, B, list] = process.argv, keys = ['c', 'cc', 'inAnd', 'pw', 'ov', 'b', 'h', 'laid'];
for (const [k, name] of [['p', 'plain 1800 (300)'], ['c', 'canvas (150)']]) {
  const a = JSON.parse(fs.readFileSync(`res/${A}-${k}.json`)).out, b = JSON.parse(fs.readFileSync(`res/${B}-${k}.json`)).out;
  const idx = a.map((_, i) => i).filter(i => !a[i].err && !b[i].err);
  const changed = idx.filter(i => a[i].H !== b[i].H);
  console.log(`== ${name}: drawable ${idx.length}, route changed ${changed.length}`);
  for (const q of keys) {
    const sa = idx.reduce((s, i) => s + (a[i][q] ?? 0), 0), sb = idx.reduce((s, i) => s + (b[i][q] ?? 0), 0);
    const tol = q === 'h' ? 0.5 : 0, up = idx.filter(i => (b[i][q] ?? 0) - (a[i][q] ?? 0) > tol), dn = idx.filter(i => (a[i][q] ?? 0) - (b[i][q] ?? 0) > tol);
    console.log(`  ${q.padEnd(5)} ${String(sa).padStart(7)} -> ${String(sb).padStart(7)}  worse ${String(up.length).padStart(3)}${up.length && list ? ' ' + up.map(i => `#${a[i].g}(${a[i][q]}>${b[i][q]})`).join(' ') : ''}  better ${dn.length}`);
  }
  const mx = q => Math.max(0, ...idx.map(i => (b[i][q] ?? 0) - (a[i][q] ?? 0)));
  const hr = Math.max(1, ...idx.map(i => a[i].h ? b[i].h / a[i].h : 1));
  console.log(`  max bends +${mx('b')}, max height ratio ${hr.toFixed(3)}, lsd ${idx.reduce((s, i) => s + (b[i].lsd ?? 0), 0)} (base ${idx.reduce((s, i) => s + (a[i].lsd ?? 0), 0)})`);
}
