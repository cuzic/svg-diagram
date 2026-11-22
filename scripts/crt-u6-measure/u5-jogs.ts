// usage: node u5-jogs.ts <root> N [canvas] > out.json   (ADR 0073 U5: the jogs of the arrows that are not into an AND)
// A jog = an arrow of 2 bends (4 points) whose two ends differ across the layer axis by 0.5px .. 2 x portStep + 1 (the definition of fixture.ts: `jogs` / `jogsAnd`), on the random CRTs of test/helpers/random-crt.ts.
// Output per figure: g, nonAnd (the offsets in px of the jogs of arrows that are not an AND's tail), and (the AND's) and, nArrows, nonJogDirect (4-point arrows with offset 0 = straight ones are counted as `straight`).
import {resolve} from 'node:path';
const root = resolve(process.argv[2]!), N = Number(process.argv[3] ?? 150), canvas = process.argv[4] === 'canvas';
await import(root + '/test/helpers/strict-width.ts');
const {checkDiagram, closeMeasurer, diagram, causeTree} = await import(root + '/lib/dsl.ts');
const PM = await import(root + '/lib/polyline-metrics.ts');
const {randomCrts} = await import(root + '/test/helpers/random-crt.ts');
const out: any[] = [], s = canvas ? 1.29 : 1, lim = 2 * Math.round(22 * s) + 1;
for (const {g, nodes, links, dir} of randomCrts(N)) {
  try {
    const d = canvas ? diagram({theme: 'blue', canvas: {width: 2400, height: 1800, minText: 18, fit: 'content'}}) : diagram({theme: 'blue', width: 1800});
    const r = await checkDiagram(d.add(causeTree(nodes, links, {tree: 'crt', dir}) as never));
    const t = r.laidOut.laidOut.find((b: any) => b.type === 'cause') as any;
    const inAnd = new Set<string>(); for (const a of t.ands) for (const f of a.from) inAnd.add(f + '>' + a.to);
    const across = (p: any) => dir === 'up' || dir === 'down' ? p.x : p.y;
    const nonAnd: number[] = [], and: number[] = []; let straight = 0;
    for (const e of t.edges) { const p = e.points; if (PM.bendsOf(p) !== 2) continue; const df = Math.abs(across(p[0]) - across(p[p.length - 1])); if (df <= 0.5) { straight++; continue; } if (df <= lim) (inAnd.has(e.from + '>' + e.to) ? and : nonAnd).push(Math.round(df)); }
    out.push({g, nonAnd, and, nArrows: t.edges.length});
  } catch (e) { out.push({g, err: 1}); }
}
console.log(JSON.stringify({lim, out})); closeMeasurer();
