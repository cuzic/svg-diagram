// usage: node pins-measure.ts <root> N [canvas] > res/<tag>-<p|c>.json     (then: node pins-fixture.mjs <mainTag> <tag>, in the directory that holds res/)
// Measures the figures of test/helpers/random-crt.ts (the pinned figures of ADR 0073: seed 4711, labels of 'あ' only) with the lib/ of <root>: a worktree of main for `main`, this branch for the other.
// N = 150 (plain, width 1800) or 80 canvas (2400x1800, minText 18). Output per figure: g, c crossings, cc cause-crossing findings, inAnd the AND crossings of the search score (andClashes, crosses), pw run pairs
// (at the figure's lane step: 14, 18 on the canvas), b bends, h height, lsd lineScaleDropped, ov the overlaps under 4px (parallelRuns(P, 4): two arrows on one line), laid the orders the search laid out, H a hash of the routes.
// With LMIN=bound|force in the environment and a scratch root patched by u5-layered-bound.patch (ADR 0073 U5): lmin = the fewest layered crossings (dummies included) found by annealing the rows of the layered layout, l0 = the sweep order's.
// argv[5] = the first figure to measure (to split a run in chunks). `ma` = [first figures with no crossing, of them movedAside, of them that enter the search through it]: only with u5-movedaside.patch (env NOMA=1 ignores movedAside).
// `laid` comes from `searchStats.laid` (lib/toc.ts). Main has none: add this line before `const t = once(order, false, true, sameFit);` in the search loop of main's lib/toc.ts (a scratch worktree, never committed):
//   (globalThis as any).__laid = ((globalThis as any).__laid ?? 0) + 1;
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
const root = resolve(process.argv[2]!), N = Number(process.argv[3] ?? 150), canvas = process.argv[4] === 'canvas', from = Number(process.argv[5] ?? 0); // argv[5]: skip the figures before #from (the generator still draws them), to split a run
await import(root + '/test/helpers/strict-width.ts');
const {checkDiagram, closeMeasurer, diagram, causeTree} = await import(root + '/lib/dsl.ts');
const PM = await import(root + '/lib/polyline-metrics.ts');
const {andClashes} = await import(root + '/lib/cause-clash.ts');
const TOC = await import(root + '/lib/toc.ts');
const {randomCrts} = await import(new URL('../../test/helpers/random-crt.ts', import.meta.url).href);
const G = globalThis as any;
const pairsOf = (P: any[], sep: number) => { const rs = P.map((p: any) => PM.runsOfRoute(p)); let n = 0; for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) { const w = PM.runPairWays(rs[i], rs[j], sep); n += w.level + w.plumb; } return n; };
const out: any[] = [];
for (const {g, nodes, links, dir} of randomCrts(N)) {
  if (g < from) continue;
  G.__laid = 0; if (TOC.searchStats) TOC.searchStats.laid = 0;
  try {
    const d = canvas ? diagram({theme: 'blue', canvas: {width: 2400, height: 1800, minText: 18, fit: 'content'}}) : diagram({theme: 'blue', width: 1800});
    const r = await checkDiagram(d.add(causeTree(nodes, links, {tree: 'crt', dir}) as never));
    const t = r.laidOut.laidOut.find((b: any) => b.type === 'cause') as any, P = t.edges.map((e: any) => e.points);
    out.push({g, c: PM.crossingsOf(P), cc: r.verdict.warnings.filter((w: string) => w.startsWith('[cause-crossing]')).length, inAnd: andClashes(t.edges, t.ands).filter((c: any) => c.how === 'crosses').length, pw: pairsOf(P, canvas ? 18 : 14), b: P.reduce((s: number, p: any) => s + PM.bendsOf(p), 0), h: Math.round(t.h ?? 0), lsd: t.lineScaleDropped ? 1 : 0, ov: PM.parallelRuns(P, 4).length, laid: TOC.searchStats ? TOC.searchStats.laid : G.__laid, lmin: G.__lmin, l0: G.__l0, ma: [G.__ma0 ?? 0, G.__maHas ?? 0, G.__maEnter ?? 0], H: createHash('md5').update(JSON.stringify(P)).digest('hex').slice(0, 10)});
  } catch (e) { out.push({g, err: String(e).slice(0, 80)}); }
}
console.log(JSON.stringify({out}));
closeMeasurer();
