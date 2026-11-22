// usage: node jog-why.ts <root> <plain|canvas|fixture> N [first] > out.json   (ADR 0073 U6: why a non-AND jog survives `align`)
// <root> must carry the instrumentation of u6-jog-why.patch (lib/layered-route.ts records, per routeOnce call, a reason for every arrow in globalThis.__jog).
// A jog = an arrow of 2 bends (4 points) whose ends differ across the layer axis by 0.5px .. 2 x portStep + 1 (as u5-jogs.ts). Output per figure: jogs = [{k, off, why, long}], arrows.
import {resolve} from 'node:path';
const root = resolve(process.argv[2]!), mode = process.argv[3] ?? 'plain', N = Number(process.argv[4] ?? 150), from = Number(process.argv[5] ?? 0);
await import(root + '/test/helpers/strict-width.ts');
const {register} = await import('node:module'); register(new URL('file://' + root + '/lib/resolve-hook.ts'));
const {checkDiagram, closeMeasurer, diagram, causeTree} = await import(root + '/lib/dsl.ts');
const PM = await import(root + '/lib/polyline-metrics.ts');
const G = globalThis as any;
const sig = (pts: number[][]) => JSON.stringify(pts.map(q => [q[0]! - pts[0]![0]!, q[1]! - pts[0]![1]!]));
const out: any[] = [];
const measure = async (name: any, mk: () => Promise<any>, dir: string, s: number) => {
  G.__jog = [];
  try {
    const r = await mk();
    const t = r.laidOut.laidOut.find((b: any) => b.type === 'cause') as any;
    const inAnd = new Set<string>(); for (const a of t.ands) for (const f of a.from) inAnd.add(f + '>' + a.to);
    const across = (p: any) => dir === 'up' || dir === 'down' ? p.x : p.y;
    const lim = Number(process.env['JOGLIM'] ?? 1e9), lim0 = 2 * Math.round(22 * s) + 1, jogs: any[] = [];
    for (const e of t.edges) {
      const p = e.points; if (PM.bendsOf(p) !== 2) continue;
      const off = Math.abs(across(p[0]) - across(p[p.length - 1])); if (off <= 0.5 || off > lim) continue;
      const k = e.from + '>' + e.to; if (inAnd.has(k)) continue;
      const sg = sig(p.map((q: any) => [Math.round(q.x), Math.round(q.y)]));
      let why = 'nomatch', sp = false;
      for (let c = G.__jog.length - 1; c >= 0 && why === 'nomatch'; c--) for (const rec of G.__jog[c]) if (rec.k === k && sig(JSON.parse(rec.p)) === sg) { why = rec.w; sp = rec.sp; break; }
      jogs.push({k, off: Math.round(off), why, sp, big: off > lim0 ? 1 : 0});
    }
    out.push({g: name, jogs, n: t.edges.length});
  } catch (e) { out.push({g: name, err: String(e).slice(0, 100)}); }
};
if (mode === 'fixture') {
  const {crtReportShape, CRT_REPORT_NODES, CRT_REPORT_LINKS, CRT_REPORT_OPTIONS} = await import(root + '/test/fixtures/crt-report-shape.ts');
  const {loadDiagram} = await import(root + '/lib/load-source.ts');
  const fs = await import('node:fs'); const path = await import('node:path');
  await measure('fix-default', async () => checkDiagram(crtReportShape()), 'up', 1.29);
  await measure('fix-asap', async () => checkDiagram(crtReportShape({layer: 'asap'})), 'up', 1.29);
  await measure('fix-nocanvas', async () => checkDiagram(diagram({theme: 'blue', width: 2600}).add(causeTree(CRT_REPORT_NODES, CRT_REPORT_LINKS, CRT_REPORT_OPTIONS) as never)), 'up', 1);
  const ex = path.join(root, 'examples');
  for (const f of fs.readdirSync(ex).filter((f: string) => /^toc-.*\.ts$/.test(f)).sort()) await measure(f, async () => checkDiagram(await loadDiagram(path.join(ex, f)) as any), 'up', 1);
} else {
  const canvas = mode === 'canvas';
  const {randomCrts} = await import(new URL('../../test/helpers/random-crt.ts', import.meta.url).href);
  for (const {g, nodes, links, dir} of randomCrts(N)) {
    if (g < from) continue;
    await measure(g, async () => { const d = canvas ? diagram({theme: 'blue', canvas: {width: 2400, height: 1800, minText: 18, fit: 'content'}}) : diagram({theme: 'blue', width: 1800}); return checkDiagram(d.add(causeTree(nodes, links, {tree: 'crt', dir}) as never)); }, dir, canvas ? 1.29 : 1);
  }
}
console.log(JSON.stringify({out})); closeMeasurer();
