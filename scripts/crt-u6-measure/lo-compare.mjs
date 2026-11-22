// ADR 0073 Q3 spike. usage (in the directory that holds res/): node lo-compare.mjs <baseTag> <tag> [<tag> ...]
// res/<tag>-<p|c>.json come from pins-measure.ts (300 plain / 150 canvas; env LO = the spike's JSON). Prints the sums, the per-figure rises and the three gates (cause-crossing never up, bends <= +3%, cost: see timing).
import fs from 'node:fs';
const [,, A, ...Bs] = process.argv, rd = (t, k) => JSON.parse(fs.readFileSync(`res/${t}-${k}.json`)).out;
for (const B of Bs) for (const [k, name] of [['p', 'plain 1800 x300'], ['c', 'canvas x150']]) {
  const a = rd(A, k), b = rd(B, k), idx = a.map((_, i) => i).filter(i => !a[i].err && !b[i].err);
  const sum = (o, q) => idx.reduce((s, i) => s + (o[i][q] ?? 0), 0), pc = (x, y) => (100 * (y / x - 1)).toFixed(1) + '%';
  const f = q => `${q} ${sum(a, q)}>${sum(b, q)}(${pc(sum(a, q), sum(b, q))})`;
  const up = q => idx.filter(i => b[i][q] > a[i][q]), dn = q => idx.filter(i => b[i][q] < a[i][q]);
  const ccUp = up('cc'), bPct = 100 * (sum(b, 'b') / sum(a, 'b') - 1), hMax = Math.max(...idx.map(i => b[i].h / a[i].h));
  const w = n => idx.reduce((s, i) => s + (b[i].rows?.[n] ?? 0), 0);
  const lay = (o, i) => o[i].rows?.[9] ?? 0, L0 = idx.reduce((s, i) => s + lay(a, i), 0), L1 = idx.reduce((s, i) => s + lay(b, i), 0), xl = Math.max(...idx.map(i => lay(b, i) - lay(a, i))), mv = idx.reduce((s, i) => s + (b[i].rows?.[10] ?? 0), 0);
  const rw = idx.reduce((s, i) => s + (b[i].rows?.[3] ?? 0), 0), rl = idx.reduce((s, i) => s + (b[i].rows?.[1] ?? 0), 0), ms = idx.reduce((s, i) => s + (b[i].rows?.[4] ?? 0), 0);
  console.log(`${B} ${name} n=${idx.length} | ${['c', 'cc', 'b', 'h', 'pw', 'ov', 'laid'].map(f).join(' ')} | figures: c up ${up('c').length} dn ${dn('c').length}; cc up ${ccUp.length} dn ${dn('cc').length}; b up ${up('b').length} dn ${dn('b').length}; h up ${up('h').length} (max x${hMax.toFixed(3)}); changed ${idx.filter(i => a[i].H !== b[i].H).length}; layouts ${L0}>${L1}(${pc(L0, L1)}, max +${xl}/figure) moves ${mv} | rows won ${rw}/laid ${rl} [frame ${w(5)} height ${w(6)} andWorse ${w(7)} noWin ${w(8)}], search ${ms}ms | GATE cc ${sum(b, 'cc') <= sum(a, 'cc') && !ccUp.length ? 'ok' : 'FAIL'} bends ${bPct <= 3 ? 'ok' : 'FAIL'} (${bPct.toFixed(1)}%)`);
}
