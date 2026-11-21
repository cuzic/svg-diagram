// node pins-fixture.mjs <mainTag> <tag>  (run in the directory run.sh wrote res/ to) -> test/fixtures/crt-random-pins.json on stdout (ADR 0073 U1).
// The pinned figures: every figure whose route differs from main's, and the first 12 that do not. `main` = the rows of main for them (the limits of P1 / P2), `now` = the rows of the
// version under test for the figures that differ (the gains the tests keep), `laid` = the orders the search laid out for the pinned figures (the cost gate; a count, not a time).
// Rows: [figure, crossings, cause-crossing findings, the AND crossings of the search score (andClashes, crosses), run pairs, bends, height, lineScaleDropped (0/1), orders laid].
// The figures are test/helpers/random-crt.ts's (labels of 'あ' only, so no font changes a number): measure them with scripts/crt-u6-measure/pins-measure.ts (the root is a scratch worktree of main for `main`, this branch for the other; its header says how to count the orders on main).
// The version under test is lib/ of the commit this fixture is committed with; regenerate it with run.sh on the new lib/ and on main (see run.sh), and say why in the PR.
import fs from 'node:fs';
const [,, A, B] = process.argv, row = x => [x.g, x.c, x.cc, x.inAnd, x.pw, x.b, x.h, x.lsd ?? 0, x.laid ?? 0];
const out = {note: 'ADR 0073 U1. Random CRTs of test/helpers/random-crt.ts (seed 4711; plain: width 1800 of the first 150, those that draw; canvas: 2400x1800 minText 18, the first 80). main = lib/ of 2465d4b4 (PR #406). now = ADR 0073 U1 (D1 order search + the height as the last key). Rows: [figure, crossings, cause-crossing, AND crossings (andClashes, crosses), pairs, bends, height, lineScaleDropped, orders laid]. The pairs and the bend cap of U2 are not in this version.', plain: {}, canvas: {}};
for (const [k, key] of [['p', 'plain'], ['c', 'canvas']]) {
  const a = JSON.parse(fs.readFileSync(`res/${A}-${k}.json`)).out, b = JSON.parse(fs.readFileSync(`res/${B}-${k}.json`)).out;
  let same = 0; const pinned = new Set();
  a.forEach((x, i) => { if (x.err || b[i].err) return; if (x.H !== b[i].H) pinned.add(i); else if (same++ < 12) pinned.add(i); });
  const idx = [...pinned].sort((p, q) => p - q);
  out[key] = {main: idx.map(i => row(a[i])), now: idx.filter(i => a[i].H !== b[i].H).map(i => row(b[i])), laid: {main: idx.reduce((s, i) => s + a[i].laid, 0), now: idx.reduce((s, i) => s + b[i].laid, 0)}};
}
console.log(JSON.stringify(out).replace(/\],\[/g, '],\n['));
