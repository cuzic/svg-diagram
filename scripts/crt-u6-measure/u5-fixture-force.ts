// usage: [LMIN=bound|force] [REPORT_CRT=<the user's own file, never committed>] node u5-fixture-force.ts <root>   (ADR 0073 U5, Q3)
// root = a scratch worktree patched with u5-layered-bound.patch. Prints numbers only (never a label): per figure c crossings, cc cause-crossing, b bends, pairs, h, w,
// lmin = the fewest layered crossings (dummies included) found by annealing, l0 = the sweep order's. LMIN=force routes the figure with the annealed order.
const root = process.argv[2]!;
await import(root + '/test/helpers/strict-width.ts');
const {register} = await import('node:module'); register(new URL('file://' + root + '/lib/resolve-hook.ts'));
const {checkDiagram, closeMeasurer, diagram, causeTree} = await import(root + '/lib/dsl.ts');
const {crtReportShape, CRT_REPORT_NODES, CRT_REPORT_LINKS, CRT_REPORT_OPTIONS} = await import(root + '/test/fixtures/crt-report-shape.ts');
const {crossingsOf, parallelRuns, bendsOf} = await import(root + '/lib/polyline-metrics.ts');
const {laneStepOf} = await import(root + '/lib/layered-route.ts');
const {loadDiagram} = await import(root + '/lib/load-source.ts');
const G = globalThis as any, rows: any[] = [];
const run = async (name: string, f: () => Promise<any>, step = 18) => {
  G.__lmin = undefined; G.__l0 = undefined;
  try { const r = await f(), t = r.laidOut.laidOut.find((b: any) => b.type === 'cause'), P = t.edges.map((e: any) => e.points);
    rows.push({name, c: crossingsOf(P), cc: r.verdict.warnings.filter((w: string) => w.startsWith('[cause-crossing]')).length, b: P.reduce((s: number, p: any) => s + bendsOf(p), 0), bmax: Math.max(...P.map((p: any) => bendsOf(p))), pairs: parallelRuns(P, step).length, ov: parallelRuns(P, 4).length, h: Math.round(t.h), w: Math.round(t.w ?? 0), lmin: G.__lmin, l0: G.__l0});
  } catch (e) { rows.push({name, err: String(e).slice(0, 80)}); }
};
await run('fix-default', () => checkDiagram(crtReportShape()));
await run('fix-asap', () => checkDiagram(crtReportShape({layer: 'asap'})));
await run('fix-compact', async () => { const d: any = crtReportShape(); d.density = 'compact'; return checkDiagram(d); }, 14);
await run('fix-nocanvas', () => checkDiagram(diagram({theme: 'blue', width: 2600}).add(causeTree(CRT_REPORT_NODES, CRT_REPORT_LINKS, CRT_REPORT_OPTIONS) as never)), 14);
const rep = process.env.REPORT_CRT ?? '';
if (rep) await run('report-crt', async () => checkDiagram(await loadDiagram(rep) as any));
console.log(JSON.stringify(rows)); closeMeasurer();
