// node pins.mjs <mainTag> <tag>  (run in the directory run.sh wrote res/ to) -> pins.json on stdout: the per-figure values the ADR 0073 tests pin.
// Rows are [figure, crossings, cause-crossing findings, crossings among one AND's arrows, run pairs, bends, height]. `main` has every figure; `proposal` only the figures whose route differs from main's.
import fs from 'node:fs';
const [,, A, B] = process.argv, row = x => [x.g, x.c, x.cc, x.inAnd, x.pw, x.b, x.h], out = {note: 'random CRTs of random-crt.ts (seed 4711; plain: width 1800, 150 drawn of which 138 fit; canvas: 2400x1800 minText 18, 80). main = lib/ of 456ef142.', plain: {}, canvas: {}};
for (const [k, key] of [['p', 'plain'], ['c', 'canvas']]) {
  const a = JSON.parse(fs.readFileSync(`res/${A}-${k}.json`)).out, b = JSON.parse(fs.readFileSync(`res/${B}-${k}.json`)).out;
  out[key] = {main: a.filter(x => !x.err).map(row), proposal: a.flatMap((x, i) => (x.err || b[i].err || x.H === b[i].H) ? [] : [row(b[i])])};
}
console.log(JSON.stringify(out).replace(/\],\[/g, '],\n['));
