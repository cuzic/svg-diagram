// usage: node compare.mjs <tagA> <tagB>  (in the directory run.sh wrote res/ to): sums per metric, and the figures whose metric went up / down. c crossings, b bends, pw pairs, h height, inAnd AND crossings, cc cause-crossing findings.
import fs from 'node:fs';
const D = new URL('.', import.meta.url).pathname; void D;
const [,, A, B] = process.argv;
for (const k of ['p', 'c']) {
  const a = JSON.parse(fs.readFileSync(`res/${A}-${k}.json`)).out, b = JSON.parse(fs.readFileSync(`res/${B}-${k}.json`)).out;
  const S = {n: 0, same: 0}; const keys = ['c', 'b', 'pw', 'h', 'inAnd', 'cc', 'loose'];
  const up = Object.fromEntries(keys.map(x => [x, []])), dn = Object.fromEntries(keys.map(x => [x, []])), sum = Object.fromEntries(keys.map(x => [x, [0, 0]]));
  let msA = 0, msB = 0;
  a.forEach((x, i) => { const y = b[i]; if (x.err || y.err) return; S.n++; msA += x.ms ?? 0; msB += y.ms ?? 0; if (x.H === y.H) S.same++;
    for (const q of keys) { sum[q][0] += x[q]; sum[q][1] += y[q]; if (y[q] > x[q]) up[q].push(`#${x.g}:${x[q]}->${y[q]}`); if (y[q] < x[q]) dn[q].push(`#${x.g}:${x[q]}->${y[q]}`); } });
  console.log(`== ${A} -> ${B} [${k === 'p' ? 'plain 1800' : 'canvas 1.29'}] figures ${S.n}, identical ${S.same}, ms ${msA}->${msB}`);
  for (const q of keys) if (up[q].length || dn[q].length) console.log(`  ${q}: sum ${sum[q][0]}->${sum[q][1]}  up ${up[q].length} [${up[q].slice(0, 12).join(' ')}]  down ${dn[q].length} [${dn[q].slice(0, 12).join(' ')}]`);
}
