// ADR 0073 U5 Q3: routed crossings (now) vs the layered lower bound (lmin) vs routed crossings with the annealed order forced. usage (in the directory that holds res/): node u5-bound.mjs <nowTag> <boundTag> <forceTag>
// res/<tag>-<p|c>.json from pins-measure.ts (the bound and force runs: LMIN=bound|force, root patched with u5-layered-bound.patch).
import fs from 'node:fs';
const [,, N, Bd, F] = process.argv, rd = (t, k) => JSON.parse(fs.readFileSync(`res/${t}-${k}.json`)).out;
for (const [k, name, lim] of [['p', 'plain 1800', 150], ['p', 'plain 1800', 300], ['c', 'canvas', 80], ['c', 'canvas', 150]]) {
  const n = rd(N, k), b = rd(Bd, k), f = rd(F, k), idx = n.map((_, i) => i).filter(i => !n[i].err && !b[i].err && !f[i].err && n[i].g < lim);
  const S = (o, q) => idx.reduce((s, i) => s + o[i][q], 0), c0 = idx.filter(i => n[i].c > 0);
  const to0 = c0.filter(i => f[i].c === 0).length, lm0 = idx.filter(i => b[i].lmin === 0).length;
  const half = idx.filter(i => f[i].c < n[i].c).length, worse = idx.filter(i => f[i].c > n[i].c);
  console.log(`${name} first ${lim} (${idx.length} figs): routed now c=${S(n, 'c')} | layered bound lmin=${S(b, 'lmin')} (lmin=0 in ${lm0} figs) | sweep order l0=${S(b, 'l0')} | forced-order routed c=${S(f, 'c')} (${(100 * (S(f, 'c') / S(n, 'c') - 1)).toFixed(0)}%)`);
  console.log(`   figs with c>0: ${c0.length}; forced makes them 0: ${to0}; forced lower ${half}, higher ${worse.length} (+${worse.map(i => f[i].c - n[i].c).join(',')}); cc ${S(n, 'cc')}->${S(f, 'cc')} pairs ${S(n, 'pw')}->${S(f, 'pw')} ov ${S(n, 'ov')}->${S(f, 'ov')} bends ${S(n, 'b')}->${S(f, 'b')} height ${S(n, 'h')}->${S(f, 'h')} laid ${S(n, 'laid')}->${S(f, 'laid')}`);
  const hist = {}; idx.forEach(i => { hist[f[i].c] = (hist[f[i].c] ?? 0) + 1; }); console.log('   forced crossings histogram: ' + Object.entries(hist).map(([a, c]) => `${a}:${c}`).join(' '));
}
