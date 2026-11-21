import {createRequire} from 'node:module'; const require = createRequire(import.meta.url);
// usage: node crt6.ts <root> N [scale]  random CRTs with ANDs, through checkDiagram
const root = process.argv[2], N = Number(process.argv[3] ?? 120), canvas = process.argv[4] === 'canvas';
await import(root + '/test/helpers/strict-width.ts');
const {checkDiagram, closeMeasurer, diagram, causeTree} = await import(root + '/lib/dsl.ts');
const {crossingsOf, parallelRuns, bendsOf} = await import(root + '/lib/polyline-metrics.ts');
const PM = await import(root + '/lib/polyline-metrics.ts');
const pairsOf = (P: any[], sep: number) => { const rs = P.map((p: any) => PM.runsOfRoute(p)); let n = 0; for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) { const w = PM.runPairWays(rs[i], rs[j], sep); n += w.level + w.plumb; } return n; };
let seed = 4711; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const out: any[] = []; const T = performance.now(); const G: any = globalThis;
for (let g = 0; g < N; g++) {
  const n = 8 + Math.floor(rnd() * 12);
  const nodes = Array.from({length: n}, (_, k) => ({id: `n${k}`, label: `n${k} ` + 'あ'.repeat(3 + Math.floor(rnd() * 10))}));
  const links: any[] = [], seen = new Set<string>();
  for (let k = 1; k < n; k++) { const f = Math.floor(rnd() * k); links.push({from: `n${f}`, to: `n${k}`}); seen.add(f + ':' + k); }
  const extra = Math.floor(n * (0.3 + rnd() * 0.6));
  for (let m = 0; m < extra; m++) { const a = Math.floor(rnd() * n), b = Math.floor(rnd() * n); if (a >= b || seen.has(a + ':' + b)) continue; seen.add(a + ':' + b); links.push({from: `n${a}`, to: `n${b}`}); }
  const nand = 1 + Math.floor(rnd() * 3), used = new Set<number>();
  for (let q = 0; q < nand; q++) { const b = 3 + Math.floor(rnd() * (n - 3)); const a1 = Math.floor(rnd() * b), a2 = Math.floor(rnd() * b); if (a1 !== a2 && !seen.has(a1 + ':' + b) && !seen.has(a2 + ':' + b)) { seen.add(a1 + ':' + b); seen.add(a2 + ':' + b); links.push({from: [`n${a1}`, `n${a2}`], to: `n${b}`}); } }
  const dir = ['up', 'left', 'down', 'right'][Math.floor(rnd() * 4)];
  for (const k of Object.keys(G.__u6c)) delete G.__u6c[k]; G.__u6log.length = 0; const t0 = performance.now();
  try {
    const d = canvas ? diagram({theme: 'blue', canvas: {width: 2400, height: 1800, minText: 18, fit: 'content'}}) : diagram({theme: 'blue', width: 1800});
    const r = await checkDiagram(d.add(causeTree(nodes, links, {tree: 'crt', dir}) as never));
    const t = r.laidOut.laidOut.find((b: any) => b.type === 'cause');
    const P = t.edges.map((e: any) => e.points);
    const inAnd = t.ands.map((a: any) => crossingsOf(t.edges.filter((e: any) => e.to === a.to && a.from.includes(e.from)).map((e: any) => e.points))).reduce((s: number, x: number) => s + x, 0);
    out.push({ms: Math.round(performance.now() - t0), u6c: {...G.__u6c}, lg: G.__u6log.length ? G.__u6log[G.__u6log.length - 1] : null, pw: pairsOf(P, canvas ? 18 : 14), pw14: pairsOf(P, 14), pw18: pairsOf(P, 18), pw23: pairsOf(P, 23), H: require('node:crypto').createHash('md5').update(JSON.stringify(P)).digest('hex').slice(0,10), g, dir, c: crossingsOf(P), b: P.reduce((s: number, p: any) => s + bendsOf(p), 0), par: parallelRuns(P, 14).length, ov: new Set(parallelRuns(P, 4).map((p: any) => p.a + ':' + p.b)).size, h: Math.round(t.h ?? 0), inAnd, loose: t.loose.length, ands: t.ands.length, cc: r.verdict.warnings.filter((w: string) => w.startsWith('[cause-crossing]')).length});
  } catch (e) { out.push({g, err: String(e).slice(0, 80)}); }
}
console.log(JSON.stringify({ms: Math.round(performance.now() - T), out}));
closeMeasurer();
