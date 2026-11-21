// node pins.mjs <mainTag> <tag> [<noPairsTag>]  (run in the directory run.sh wrote res/ to) -> pins.json on stdout: the per-figure values the ADR 0073 tests pin.
// Rows are [figure, crossings, cause-crossing findings, crossings among one AND's arrows, run pairs, bends, height, lineScaleDropped (0/1)]. `main` has every figure; `proposal` only the figures whose route differs from main's; `nopairs` (when the third tag is given: the same proposal with the pairs key switched off, ADR 0073 test P4) has every figure.
import fs from 'node:fs';
const [,, A, B, N] = process.argv, row = x => [x.g, x.c, x.cc, x.inAnd, x.pw, x.b, x.h, x.lsd ?? 0], out = {note: 'random CRTs of random-crt.ts (seed 4711; plain: width 1800, 150 drawn of which 138 fit; canvas: 2400x1800 minText 18, 80). main = lib/ of 456ef142. proposal = the PRE-CAP, PRE-height-key version of ADR 0073 (D1 xcross + D2 pairs + D3 tail): NOT a limit for the tests. U1/U2 regenerate it with the height key and the +4 bend cap; the tests use main plus an explicit exception list. Rows: [figure, crossings, cause-crossing, AND crossings, pairs, bends, height, lineScaleDropped].', plain: {}, canvas: {}};
for (const [k, key] of [['p', 'plain'], ['c', 'canvas']]) {
  const a = JSON.parse(fs.readFileSync(`res/${A}-${k}.json`)).out, b = JSON.parse(fs.readFileSync(`res/${B}-${k}.json`)).out;
  out[key] = {main: a.filter(x => !x.err).map(row), proposal: a.flatMap((x, i) => (x.err || b[i].err || x.H === b[i].H) ? [] : [row(b[i])]), ...(N ? {nopairs: JSON.parse(fs.readFileSync(`res/${N}-${k}.json`)).out.filter(x => !x.err).map(row)} : {})};
}
console.log(JSON.stringify(out).replace(/\],\[/g, '],\n['));
