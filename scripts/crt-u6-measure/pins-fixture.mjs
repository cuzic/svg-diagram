// node pins-fixture.mjs <mainTag> <tag> [<noPairsTag> [<uncappedTag> [<lane14Tag>]]]  (run in the directory run.sh wrote res/ to) -> test/fixtures/crt-random-pins.json on stdout (ADR 0073 U1).
// The pinned figures: every figure whose route differs from main's, and the first 12 that do not. `main` = the rows of main for them (the limits of P1 / P2), `now` = the rows of the
// version under test for the figures that differ (the gains the tests keep), `laid` = the orders the search laid out for the pinned figures (the cost gate; a count, not a time).
// Rows: [figure, crossings, cause-crossing findings, the AND crossings of the search score (andClashes, crosses), run pairs, bends, height, lineScaleDropped (0/1), orders laid].
// The figures are test/helpers/random-crt.ts's (labels of 'あ' only, so no font changes a number): measure them with scripts/crt-u6-measure/pins-measure.ts (the root is a scratch worktree of main for `main`, this branch for the other; its header says how to count the orders on main).
// The version under test is lib/ of the commit this fixture is committed with; regenerate it with run.sh on the new lib/ and on main (see run.sh), and say why in the PR.
import fs from 'node:fs';
const [,, A, B, N, U, L] = process.argv, row = x => [x.g, x.c, x.cc, x.inAnd, x.pw, x.b, x.h, x.lsd ?? 0, x.laid ?? 0, x.ov ?? 0];
// the figures whose route changes with the pairs at 14px: all 150 canvas figures when res/big-<tag>-c.json (pins-measure.ts <root> 150 canvas) exist for both versions, else the pinned set
const laneStepOf = (k, b, l) => {
  const big = t => `res/big-${t}-c.json`;
  if (k === 'c' && fs.existsSync(big(B)) && fs.existsSync(big(L))) { const p = JSON.parse(fs.readFileSync(big(B))).out, q = JSON.parse(fs.readFileSync(big(L))).out; return Object.fromEntries(p.flatMap((x, i) => !x.err && !q[i].err && x.H !== q[i].H ? [[x.g, x.H]] : [])); }
  return Object.fromEntries(b.flatMap((x, i) => !x.err && !l[i].err && l[i].H !== x.H ? [[x.g, x.H]] : []));
};
const out = {note: 'ADR 0073 U1, U2. Random CRTs of test/helpers/random-crt.ts (seed 4711; plain: width 1800 of the first 150, those that draw; canvas: 2400x1800 minText 18, the first 80). main = lib/ of 2465d4b4 (PR #406). now = ADR 0073 U2 (U1 + D2: run pairs in the keys, the +4 bend window). nopairs = the same version with the pairs key switched off (P4). Rows: [figure, crossings, cause-crossing, AND crossings (andClashes, crosses), pairs, bends, height, lineScaleDropped, orders laid, overlaps under 4px]. laneStep = the route hash of the figures whose route changes when better() counts the pairs at 14px instead of the lane step of the figure (canvas: 18). The pairs of a row are the plain runPairWays count; the lib counts an overlap under 4px twice (U2 M1). Pinned: every figure whose route differs from main, every one the +4 cap changes (the version without the cap differs), and the first 12 that do not.', plain: {}, canvas: {}};
for (const [k, key] of [['p', 'plain'], ['c', 'canvas']]) {
  const a = JSON.parse(fs.readFileSync(`res/${A}-${k}.json`)).out, b = JSON.parse(fs.readFileSync(`res/${B}-${k}.json`)).out;
  const u = U ? JSON.parse(fs.readFileSync(`res/${U}-${k}.json`)).out : undefined, n = N ? JSON.parse(fs.readFileSync(`res/${N}-${k}.json`)).out : undefined;
  const l = L ? JSON.parse(fs.readFileSync(`res/${L}-${k}.json`)).out : undefined;
  let same = 0; const pinned = new Set();
  a.forEach((x, i) => { if (x.err || b[i].err) return; if (x.H !== b[i].H || (u && u[i].H !== b[i].H) || (l && l[i].H !== b[i].H)) pinned.add(i); else if (same++ < 12) pinned.add(i); });
  const idx = [...pinned].sort((p, q) => p - q);
  out[key] = {main: idx.map(i => row(a[i])), now: idx.filter(i => a[i].H !== b[i].H).map(i => row(b[i])), ...(l ? {laneStep: laneStepOf(k, b, l)} : {}), ...(n ? {nopairs: idx.map(i => row(n[i]))} : {}), laid: {main: idx.reduce((s, i) => s + a[i].laid, 0), now: idx.reduce((s, i) => s + b[i].laid, 0)}};
}
console.log(JSON.stringify(out).replace(/\],\[/g, '],\n['));
