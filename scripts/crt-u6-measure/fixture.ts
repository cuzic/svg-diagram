// usage: [REPORT_CRT=<the user's own file, never committed>] [DUMP=1] U6='<json>' node fixture.ts <root> > out.json
// The U0 fixture (default / asap / compact / no-canvas / minText 14, 24), the real report figure when REPORT_CRT is set (it prints ids and numbers only, never labels), examples/toc-*. Metrics incl. AND jogs (jogsAnd: id>id:px). show.mjs prints a result.
import {createRequire} from 'node:module'; const require_ = createRequire(import.meta.url);
const root = process.argv[2]!;
await import(root + '/test/helpers/strict-width.ts');
const {register} = await import('node:module'); register(new URL('file://' + root + '/lib/resolve-hook.ts'));
const {checkDiagram, closeMeasurer} = await import(root + '/lib/dsl.ts');
const {crtReportShape} = await import(root + '/test/fixtures/crt-report-shape.ts');
const {crossingsOf, parallelRuns, bendsOf} = await import(root + '/lib/polyline-metrics.ts');
const {loadDiagram} = await import(root + '/lib/load-source.ts');
const {CRT_REPORT_NODES, CRT_REPORT_LINKS, CRT_REPORT_OPTIONS} = await import(root + '/test/fixtures/crt-report-shape.ts');
const {causeTree, diagram} = await import(root + '/lib/dsl.ts');
const {laneStepOf} = await import(root + '/lib/layered-route.ts');
const {canvasFontScale} = await import(root + '/lib/tokens.ts');
const fs = await import('node:fs'); const path = await import('node:path');
const rows: any[] = [];
const rowOf = (name: string, r: any, minText?: number, dir = 'up', space = 1) => {
  const t = r.laidOut.laidOut.find((b: any) => b.type === 'cause'); if (!t) return;
  const P = t.edges.map((e: any) => e.points); const s = minText ? Math.max(1, canvasFontScale(minText)) : 1; const step = laneStepOf(s * space);
  const near = parallelRuns(P, 1000).filter((p: any) => p.gap > 0.5); const sp = near.length ? Math.min(...near.map((p: any) => p.gap)) : null;
  const across = (p: any) => dir === 'up' || dir === 'down' ? p.x : p.y;
  const andTo = new Set<string>(); const inAnd = new Set<string>(); for (const a of t.ands) { andTo.add(a.to); for (const f of a.from) inAnd.add(f + '>' + a.to); }
  const jogs: string[] = [], jogsAnd: string[] = [];
  t.edges.forEach((e: any, i: number) => { const p = e.points; if (bendsOf(p) !== 2) return; const d = Math.abs(across(p[0]) - across(p[p.length - 1])); if (d > 0.5 && d <= 2 * Math.round(22 * s) + 1) { (inAnd.has(e.from + '>' + e.to) ? jogsAnd : jogs).push(`${e.from}>${e.to}:${Math.round(d)}`); } });
  // arrows with a jog-sized middle run: any run across shorter than 2 port steps at the head end
  const gapOf = Math.min(...t.ands.flatMap((a: any) => t.edges.filter((e: any) => e.to === a.to && a.from.includes(e.from)).map((e: any) => { const tip = e.points.at(-1), q = (tip.x - a.p0.x) / (a.p1.x - a.p0.x), y = (1 - q) ** 2 * a.p0.y + 2 * q * (1 - q) * a.c.y + q ** 2 * a.p1.y; return Math.abs(tip.y - y) - 12 - 1; })));
  const into = new Map<string, any[]>(); for (const a of t.ands) into.set(a.to, [...(into.get(a.to) ?? []), a]); let cut = Infinity; for (const l of into.values()) { const sp = l.map((a: any) => [Math.min(a.p0.x, a.p1.x), Math.max(a.p0.x, a.p1.x)]).sort((p: number[], q: number[]) => p[0]! - q[0]!); for (let k = 1; k < sp.length; k++) cut = Math.min(cut, sp[k][0] - sp[k - 1][1]); }
  const portSteps = [...new Set(t.edges.map((e: any) => e.to))].flatMap((to: any) => { const xs = t.edges.filter((e: any) => e.to === to).map((e: any) => e.points.at(-1).x).sort((a: number, b: number) => a - b); return xs.slice(1).map((x: number, i: number) => Math.round(x - xs[i]!)); });
  rows.push({name, arcGap: +gapOf.toFixed(1), arcCut: cut === Infinity ? null : Math.round(cut), minPort: Math.min(...portSteps), maxPort: Math.max(...portSteps), c: crossingsOf(P), b: P.reduce((q: number, p: any) => q + bendsOf(p), 0), bmax: Math.max(...P.map((p: any) => bendsOf(p))), pairs: parallelRuns(P, step).length, p14: parallelRuns(P, 14).length, ov: parallelRuns(P, 4).length, sp, spr: minText && sp ? +(sp / minText).toFixed(2) : null,
    h: Math.round(t.h), w: Math.round(t.w ?? 0), cc: r.verdict.warnings.filter((w: string) => w.startsWith('[cause-crossing]')).length, ep: r.verdict.warnings.filter((w: string) => w.startsWith('[edge-parallel]')).length, loose: t.loose.length, jogsAnd, jogs,
    hash: require_('node:crypto').createHash('md5').update(JSON.stringify(P)).digest('hex').slice(0, 8), P: process.env.DUMP ? t.edges.map((e: any) => ({f: e.from, t: e.to, p: e.points})) : undefined, nodes: process.env.DUMP ? t.anchors.map((n: any) => ({id: n.id, x: n.x, y: n.y, w: n.w, h: n.h, k: Object.keys(n).join()})) : undefined, ands: process.env.DUMP ? t.ands : undefined});
};
const D = (name: string, f: () => Promise<any>, mt?: number, space = 1) => f().then(r => rowOf(name, r, mt, 'up', space)).catch((e: any) => rows.push({name, err: String(e).slice(0, 100)}));
await D('fix-default', () => checkDiagram(crtReportShape()), 18);
await D('fix-asap', () => checkDiagram(crtReportShape({layer: 'asap'})), 18);
await D('fix-wide3600', () => checkDiagram(crtReportShape({}, 3600)), 18);
await D('fix-compact', async () => { const d: any = crtReportShape(); d.density = 'compact'; return checkDiagram(d); }, 18, 0.75);
await D('fix-nocanvas', () => checkDiagram(diagram({theme: 'blue', width: 2600}).add(causeTree(CRT_REPORT_NODES, CRT_REPORT_LINKS, CRT_REPORT_OPTIONS) as never)));
await D('fix-minText14', () => checkDiagram(diagram({theme: 'blue', canvas: {width: 2600, height: 2000, minText: 14, fit: 'content'}}).add(causeTree(CRT_REPORT_NODES, CRT_REPORT_LINKS, CRT_REPORT_OPTIONS) as never)), 14);
await D('fix-minText24', () => checkDiagram(diagram({theme: 'blue', canvas: {width: 2600, height: 2400, minText: 24, fit: 'content'}}).add(causeTree(CRT_REPORT_NODES, CRT_REPORT_LINKS, CRT_REPORT_OPTIONS) as never)), 24);
const rep = process.env.REPORT_CRT ?? ''; // the peer's own file (never committed): REPORT_CRT=/path/to/it
if (rep && fs.existsSync(rep)) { await D('report-crt', async () => checkDiagram(await loadDiagram(rep) as any), 18); }
const ex = path.join(root, 'examples');
for (const f of fs.readdirSync(ex).filter((f: string) => /^toc-.*\.ts$/.test(f)).sort()) await D(f, async () => checkDiagram(await loadDiagram(path.join(ex, f)) as any));
console.log(JSON.stringify(rows)); closeMeasurer();
