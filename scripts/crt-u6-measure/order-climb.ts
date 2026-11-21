// usage: U6='<json>' node order-climb.ts <root> <seed> <evals> : hill-climb over the written order of the fixture's nodes (numbers only). env U6 as usual (e.g. noSearch)
const root = process.argv[2]!, seed0 = Number(process.argv[3]), evals = Number(process.argv[4]);
await import(root + '/test/helpers/strict-width.ts');
const {checkDiagram, closeMeasurer, diagram, causeTree} = await import(root + '/lib/dsl.ts');
const {CRT_REPORT_NODES, CRT_REPORT_LINKS, CRT_REPORT_OPTIONS} = await import(root + '/test/fixtures/crt-report-shape.ts');
const {crossingsOf, bendsOf} = await import(root + '/lib/polyline-metrics.ts');
let seed = seed0; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const ev = async (ids: string[]) => {
  const by = new Map(CRT_REPORT_NODES.map((n: any) => [n.id, n])); const nodes = ids.map(i => by.get(i));
  const r = await checkDiagram(diagram({theme: 'blue', canvas: {width: 2600, height: 2000, minText: 18, fit: 'content'}}).add(causeTree(nodes, CRT_REPORT_LINKS, CRT_REPORT_OPTIONS) as never));
  const t = r.laidOut.laidOut.find((b: any) => b.type === 'cause'); const P = t.edges.map((e: any) => e.points);
  return {c: crossingsOf(P), b: P.reduce((s: number, p: any) => s + bendsOf(p), 0), h: Math.round(t.h), cc: r.verdict.warnings.filter((w: string) => w.startsWith('[cause-crossing]')).length};
};
let cur = CRT_REPORT_NODES.map((n: any) => n.id) as string[]; let curS = await ev(cur); const start = curS; let best = {ids: cur, s: curS};
const lex = (a: any, b: any) => a.cc - b.cc || a.c - b.c || a.b - b.b;
const hist: any[] = [];
for (let k = 0; k < evals; k++) {
  const o = [...cur]; const m = 1 + Math.floor(rnd() * 3);
  for (let q = 0; q < m; q++) { const i = Math.floor(rnd() * o.length), j = Math.floor(rnd() * o.length); [o[i], o[j]] = [o[j]!, o[i]!]; }
  let s: any; try { s = await ev(o); } catch { continue; }
  if (lex(s, curS) <= 0) { cur = o; curS = s; if (lex(s, best.s) < 0) { best = {ids: o, s}; hist.push({k, s}); } }
}
console.log(JSON.stringify({seed: seed0, start, best: best.s, ids: best.ids.join(','), hist}));
closeMeasurer();
