// usage: U6='{"epAll":1}' node edge-parallel-origins.ts <root> N : edge-parallel findings (the origin gate lifted with U6={"epAll":1}) on random pdpc / relationDiagram / whyWhyTree, plus the examples that use them
const root = process.argv[2]!, N = Number(process.argv[3] ?? 100);
await import(root + '/test/helpers/strict-width.ts');
const {register} = await import('node:module'); register(new URL('file://' + root + '/lib/resolve-hook.ts'));
const {checkDiagram, closeMeasurer, diagram, pdpc, relationDiagram, whyWhyTree, causeTree} = await import(root + '/lib/dsl.ts');
const {lintDiagram} = await import(root + '/lib/rules.ts');
const {loadDiagram} = await import(root + '/lib/load-source.ts');
const fs = await import('node:fs'); const path = await import('node:path');
let seed = 99; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648; const ri = (n: number) => Math.floor(rnd() * n);
const lab = (k: string) => k + ' ' + 'あ'.repeat(3 + ri(9));
const res: Record<string, {n: number; flagged: number; errs: number; pairs: number[]}> = {};
const rec = (kind: string, laid: any) => { const f = lintDiagram(laid).filter((x: any) => x.rule === 'edge-parallel'); const r = (res[kind] ??= {n: 0, flagged: 0, errs: 0, pairs: []}); r.n++; if (f.length) { r.flagged++; r.pairs.push(f.length); } };
const run = async (kind: string, mk: () => any) => { try { const d = diagram({theme: 'blue', width: 1800}).add(mk()); const r = await checkDiagram(d); rec(kind, r.laidOut); } catch (e) { (res[kind] ??= {n: 0, flagged: 0, errs: 0, pairs: []}).errs++; } };
for (let g = 0; g < N; g++) {
  const n = 8 + ri(10);
  // pdpc: a chain start..goal with risks and measures returning to the chain
  const chain = 3 + ri(4), nodes: any[] = [{id: 's', label: lab('s'), role: 'start'}], links: any[] = []; let prev = 's';
  for (let k = 0; k < chain; k++) { nodes.push({id: `c${k}`, label: lab('c')}); links.push({from: prev, to: `c${k}`}); prev = `c${k}`; }
  nodes.push({id: 'g', label: lab('g'), role: 'goal'}); links.push({from: prev, to: 'g'});
  const nr = 2 + ri(3); for (let k = 0; k < nr; k++) { const a = ri(chain), b = Math.min(chain - 1, a + ri(3)); nodes.push({id: `r${k}`, label: lab('r'), role: 'risk'}, {id: `m${k}`, label: lab('m'), role: 'measure'}); links.push({from: `c${a}`, to: `r${k}`}, {from: `r${k}`, to: `m${k}`}, {from: `m${k}`, to: ri(2) ? `c${b}` : 'g'}); }
  await run('pdpc', () => pdpc(nodes, links, {maxNodeW: 200}));
  // relation: random digraph incl. cycles
  const rn = Array.from({length: n}, (_, k) => ({id: `n${k}`, label: lab('n')})); const rl: any[] = [], seen = new Set<string>();
  for (let k = 1; k < n; k++) { const f = ri(k); rl.push({from: `n${f}`, to: `n${k}`}); seen.add(f + ':' + k); }
  for (let m = 0; m < n * 0.6; m++) { const a = ri(n), b = ri(n); if (a === b || seen.has(a + ':' + b)) continue; seen.add(a + ':' + b); rl.push({from: `n${a}`, to: `n${b}`}); }
  await run('relation', () => relationDiagram(rn, rl, {maxNodeW: 200}));
  // why-why: a tree
  const mk = (d: number): any => ({why: lab('w'), ...(d < 3 && ri(10) < 8 ? {because: Array.from({length: 1 + ri(3)}, () => mk(d + 1))} : {})});
  await run('whyWhy', () => whyWhyTree(lab('problem'), Array.from({length: 2 + ri(2)}, () => mk(1)), {}));
  // causeTree reference (the gate is on already)
  const cn = Array.from({length: n}, (_, k) => ({id: `n${k}`, label: lab('n')})); const cl = rl.filter(l => Number(l.from.slice(1)) < Number(l.to.slice(1)));
  await run('causeTree(ref)', () => causeTree(cn, cl, {tree: 'crt', dir: 'up'}));
}
const ex = path.join(root, 'examples'); const exr: Record<string, number> = {};
for (const f of ['qc-pdpc.ts', 'qc-relation.ts', 'why-why.ts']) { try { const r = await checkDiagram(await loadDiagram(path.join(ex, f)) as any); exr[f] = lintDiagram(r.laidOut).filter((x: any) => x.rule === 'edge-parallel').length; } catch (e) { exr[f] = -1; } }
console.log(JSON.stringify({res, exr})); closeMeasurer();
