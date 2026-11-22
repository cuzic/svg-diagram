// ADR 0075 U1: the pins of test/cause-layer-order.test.ts. usage (in the directory that holds res/ from lo-run.sh): node pins-layer-order.mjs <mainTag> <tag> > crt-layer-order-pins.json
// main = lib/ before the row search (with the layout counter), tag = the branch. Rows: [figure, crossings, cause-crossing, AND crossings, run pairs (plain runPairWays at the figure's lane step), bends, height, overlaps under 4px, layouts, route hash].
// `main` has every drawable figure of the sample (the first 300 plain, the first 150 canvas); `now` only the figures whose route the row search changes.
import fs from 'node:fs';
const [,, A, B] = process.argv, row = x => [x.g, x.c, x.cc, x.inAnd, x.pw, x.b, x.h, x.ov, x.rows?.[4] ?? 0, x.H];
const out = {note: 'ADR 0075 U1. Random CRTs of test/helpers/random-crt.ts (seed 4711; plain: width 1800, the first 300 figures; canvas: 2400x1800 minText 18, the first 150). Rows: [figure, crossings, cause-crossing, AND crossings, run pairs, bends, height, overlaps under 4px, layouts the search placed, route hash]. main = lib/ of main before the row search (PR #432 merged, no code); now = ADR 0075 U1, only for the figures whose route changes.'};
for (const [k, key] of [['p', 'plain'], ['c', 'canvas']]) {
  const a = JSON.parse(fs.readFileSync(`res/${A}-${k}.json`)).out, b = JSON.parse(fs.readFileSync(`res/${B}-${k}.json`)).out;
  out[key] = {main: a.filter(x => !x.err).map(row), now: a.flatMap((x, i) => (x.err || b[i].err || x.H === b[i].H) ? [] : [row(b[i])])};
}
console.log(JSON.stringify(out).replace(/\],\[/g, '],\n['));
