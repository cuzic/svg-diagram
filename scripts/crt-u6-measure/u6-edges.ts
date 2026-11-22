// usage: [U6J=push,long] node u6-edges.ts <root> <plain|canvas> N > out.json   per figure: g, the arrows as [from>to, bends, |across offset|, points count] (u6-edges-diff.mjs compares two of these)
import {resolve} from 'node:path';
const root = resolve(process.argv[2]!), canvas = process.argv[3] === 'canvas', N = Number(process.argv[4] ?? 150);
await import(root + '/test/helpers/strict-width.ts');
const {checkDiagram, closeMeasurer, diagram, causeTree} = await import(root + '/lib/dsl.ts');
const PM = await import(root + '/lib/polyline-metrics.ts');
const {randomCrts} = await import(new URL('../../test/helpers/random-crt.ts', import.meta.url).href);
const out: any[] = [];
for (const {g, nodes, links, dir} of randomCrts(N)) {
  try {
    const d = canvas ? diagram({theme: 'blue', canvas: {width: 2400, height: 1800, minText: 18, fit: 'content'}}) : diagram({theme: 'blue', width: 1800});
    const r = await checkDiagram(d.add(causeTree(nodes, links, {tree: 'crt', dir}) as never));
    const t = r.laidOut.laidOut.find((b: any) => b.type === 'cause') as any;
    const across = (p: any) => dir === 'up' || dir === 'down' ? p.x : p.y;
    const inAnd = new Set<string>(); for (const a of t.ands) for (const f of a.from) inAnd.add(f + '>' + a.to);
    out.push({g, e: t.edges.map((e: any) => [e.from + '>' + e.to, PM.bendsOf(e.points), Math.round(Math.abs(across(e.points[0]) - across(e.points[e.points.length - 1]))), e.points.length, inAnd.has(e.from + '>' + e.to) ? 1 : 0])});
  } catch (e) { out.push({g, err: 1}); }
}
console.log(JSON.stringify({out})); closeMeasurer();
