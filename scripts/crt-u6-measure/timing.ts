const root = process.argv[2], n = Number(process.argv[3]);
await import(root + '/test/helpers/strict-width.ts');
const {checkDiagram, closeMeasurer, diagram, causeTree} = await import(root + '/lib/dsl.ts');
const {crossingsOf, bendsOf, parallelRuns} = await import(root + '/lib/polyline-metrics.ts');
let seed = 4242; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const nodes = Array.from({length: n}, (_, k) => ({id: `n${k}`, label: `n${k} ` + 'あ'.repeat(2 + Math.floor(rnd() * 5))}));
const links: any[] = [], seen = new Set<string>();
for (let k = 1; k < n; k++) { const f = Math.max(0, k - 1 - Math.floor(rnd() * 6)); links.push({from: `n${f}`, to: `n${k}`}); seen.add(f + ':' + k); }
for (let m = 0; m < n * 0.8; m++) { const a = Math.floor(rnd() * n), b = Math.min(n - 1, a + 2 + Math.floor(rnd() * 8)); if (a >= b || seen.has(a + ':' + b)) continue; seen.add(a + ':' + b); links.push({from: `n${a}`, to: `n${b}`}); }
const T = performance.now();
const r = await checkDiagram(diagram({theme: 'blue', width: 4000}).add(causeTree(nodes, links, {dir: 'up'}) as never));
const t = r.laidOut.laidOut.find((b: any) => b.type === 'cause'); const P = t.edges.map((e: any) => e.points);
console.log(n, links.length, 'att', (globalThis as any).__att, 'ms', Math.round(performance.now() - T), 'cross', crossingsOf(P), 'bends', P.reduce((s: number, p: any) => s + bendsOf(p), 0), 'on-one-line', parallelRuns(P, 4).length, 'par14', parallelRuns(P, 14).length, 'h', t.h);
console.log(JSON.stringify(Object.fromEntries(Object.entries(globalThis).filter(([k]) => /^(p[12t]|pt|place|miss)/.test(k)))));
closeMeasurer();
