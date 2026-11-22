// ADR 0075 measurement. usage (in the directory that holds res/): node lo-compare.mjs <baseTag> <tag> [<tag> ...]
// res/<tag>-<p|c>.json come from pins-measure.ts run on two worktrees (main for the base, the branch for the other): `lo-run.sh <tag> <root>`.
// Prints the sums, the per-figure rises, the layouts (the load-independent cost of ADR 0075 D5) and the gates (cause-crossing never up, bends <= +3%, layouts <= +30% and <= +4 per figure).
import fs from 'node:fs';
const [,, A, ...Bs] = process.argv, rd = (t, k) => JSON.parse(fs.readFileSync(`res/${t}-${k}.json`)).out;
for (const B of Bs) for (const [k, name] of [['p', 'plain 1800 x300'], ['c', 'canvas x150']]) {
  const a = rd(A, k), b = rd(B, k), idx = a.map((_, i) => i).filter(i => !a[i].err && !b[i].err);
  const sum = (o, q) => idx.reduce((s, i) => s + (o[i][q] ?? 0), 0), pc = (x, y) => (100 * (y / x - 1)).toFixed(1) + '%';
  const f = q => `${q} ${sum(a, q)}>${sum(b, q)}(${pc(sum(a, q), sum(b, q))})`;
  const up = q => idx.filter(i => b[i][q] > a[i][q]), dn = q => idx.filter(i => b[i][q] < a[i][q]);
  const lay = (o, i) => o[i].rows?.[4] ?? 0, L0 = idx.reduce((s, i) => s + lay(a, i), 0), L1 = idx.reduce((s, i) => s + lay(b, i), 0), xl = Math.max(...idx.map(i => lay(b, i) - lay(a, i)));
  const mv = idx.reduce((s, i) => s + (b[i].rows?.[5] ?? 0), 0), won = idx.reduce((s, i) => s + (b[i].rows?.[3] ?? 0), 0), cand = idx.reduce((s, i) => s + (b[i].rows?.[1] ?? 0), 0);
  const ccUp = up('cc'), bPct = 100 * (sum(b, 'b') / sum(a, 'b') - 1), hMax = Math.max(...idx.map(i => b[i].h / a[i].h));
  console.log(`${B} ${name} n=${idx.length} | ${['c', 'cc', 'b', 'h', 'pw', 'ov'].map(f).join(' ')} | figures: c up ${up('c').length} dn ${dn('c').length}; cc up ${ccUp.length} dn ${dn('cc').length}; b up ${up('b').length} dn ${dn('b').length}; pw up ${up('pw').length} dn ${dn('pw').length}; ov up ${up('ov').length}; h up ${up('h').length} (max x${hMax.toFixed(3)}); changed ${idx.filter(i => a[i].H !== b[i].H).length}; layouts ${L0}>${L1}(${pc(L0, L1)}, max +${xl}/figure) moves ${mv} candidates ${cand} won ${won} | GATE cc ${sum(b, 'cc') <= sum(a, 'cc') && !ccUp.length ? 'ok' : 'FAIL'} bends ${bPct <= 3 ? 'ok' : 'FAIL'} (${bPct.toFixed(1)}%) layouts ${L1 <= 1.3 * L0 && xl <= 4 ? 'ok' : 'FAIL'}`);
}
