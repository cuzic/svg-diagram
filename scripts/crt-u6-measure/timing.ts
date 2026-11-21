// usage: node timing.ts <root> <nodes> [plain|and|canvas]   one timed layout of a random CRT (fixed seed). plain = no ANDs, width 4000 (the ADR 0070 benchmark);
// and = the same links plus 1 + n/20 ANDs; canvas = and, on a canvas (width 4000, height 100 px per node, minText 18: lines scaled 1.29). Env U6 = toggles of probe.patch. timing-alt.sh alternates two settings.
const root = process.argv[2], n = Number(process.argv[3]), mode = process.argv[4] ?? 'plain';
await import(root + '/test/helpers/strict-width.ts');
const {checkDiagram, closeMeasurer, diagram, causeTree} = await import(root + '/lib/dsl.ts');
const {crossingsOf, bendsOf, parallelRuns} = await import(root + '/lib/polyline-metrics.ts');
let seed = 4242; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const nodes = Array.from({length: n}, (_, k) => ({id: `n${k}`, label: `n${k} ` + 'あ'.repeat(2 + Math.floor(rnd() * 5))}));
const links: any[] = [], seen = new Set<string>();
for (let k = 1; k < n; k++) { const f = Math.max(0, k - 1 - Math.floor(rnd() * 6)); links.push({from: `n${f}`, to: `n${k}`}); seen.add(f + ':' + k); }
for (let m = 0; m < n * 0.8; m++) { const a = Math.floor(rnd() * n), b = Math.min(n - 1, a + 2 + Math.floor(rnd() * 8)); if (a >= b || seen.has(a + ':' + b)) continue; seen.add(a + ':' + b); links.push({from: `n${a}`, to: `n${b}`}); }
if (mode !== 'plain') for (let q = 0, used = new Set<number>(); q < 1 + Math.floor(n / 20); q++) { const b = 6 + Math.floor(rnd() * (n - 6)), a1 = Math.floor(rnd() * b), a2 = Math.floor(rnd() * b); if (a1 === a2 || used.has(b) || seen.has(a1 + ':' + b) || seen.has(a2 + ':' + b)) continue; used.add(b); seen.add(a1 + ':' + b); seen.add(a2 + ':' + b); links.push({from: [`n${a1}`, `n${a2}`], to: `n${b}`}); }
const T = performance.now();
const r = await checkDiagram((mode === 'canvas' ? diagram({theme: 'blue', canvas: {width: 4000, height: n * 100, minText: 18, fit: 'content'}}) : diagram({theme: 'blue', width: 4000})).add(causeTree(nodes, links, {dir: 'up'}) as never));
const t = r.laidOut.laidOut.find((b: any) => b.type === 'cause'); const P = t.edges.map((e: any) => e.points);
const cpu = process.cpuUsage(); console.log(n, links.length, mode, 'cpu', Math.round((cpu.user + cpu.system) / 1000), 'ands', links.filter(l => typeof l.from !== 'string').length, 'ms', Math.round(performance.now() - T), 'cross', crossingsOf(P), 'bends', P.reduce((s: number, p: any) => s + bendsOf(p), 0), 'on-one-line', parallelRuns(P, 4).length, 'par14', parallelRuns(P, 14).length, 'h', t.h);
closeMeasurer();
