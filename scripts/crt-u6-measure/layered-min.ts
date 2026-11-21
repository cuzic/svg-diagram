// the layered graph of the fixture (layers taken from the drawn figure): the fewest crossings any per-layer order gives (annealing), vs the drawn order
const root = process.argv[2]!; // node layered-min.ts <root> (reads fx-dump.json from DUMP=1 fixture.ts, writes force-rows.json)
const {CRT_REPORT_LINKS} = await import(root + '/test/fixtures/crt-report-shape.ts');
import fs from 'node:fs';
const r = JSON.parse(fs.readFileSync('fx-dump.json', 'utf8')).find((x: any) => x.name === 'fix-default');
// layer of each node: rank of its row (dir up: smaller y = further along). Nodes of one layer have close y; cluster by sorted y with 150px gaps
const ns = r.nodes.map((n: any) => ({id: n.id, y: n.y + n.h / 2, x: n.x + n.w / 2})).sort((a: any, b: any) => b.y - a.y);
const layer = new Map<string, number>(); let L = 0, prev = ns[0].y;
for (const n of ns) { if (prev - n.y > 90) L++; layer.set(n.id, L); prev = n.y; }
const arrows: [string, string][] = []; for (const l of CRT_REPORT_LINKS) for (const f of typeof l.from === 'string' ? [l.from] : l.from) arrows.push([f, l.to]);
// dummies
type V = {id: string; l: number}; const verts: V[] = ns.map((n: any) => ({id: n.id, l: layer.get(n.id)!})); const edges: [string, string][] = [];
arrows.forEach(([f, t], k) => { let a = f; const lf = layer.get(f)!, lt = layer.get(t)!; for (let l = lf + 1; l < lt; l++) { const d = `d${k}_${l}`; verts.push({id: d, l}); edges.push([a, d]); a = d; } edges.push([a, t]); });
const layers: string[][] = Array.from({length: L + 1}, () => []);
for (const n of ns) layers[layer.get(n.id)!]!.push(n.id); // drawn left-to-right order below
layers.forEach(l => l.sort((a, b) => (ns.find((n: any) => n.id === a)?.x ?? 0) - (ns.find((n: any) => n.id === b)?.x ?? 0)));
// dummies: place by their drawn route? start with barycenter of ends; here put by mean x of the arrow ends
const xOf = new Map(ns.map((n: any) => [n.id, n.x])); arrows.forEach(([f, t], k) => { for (const v of verts) if (v.id.startsWith(`d${k}_`)) layers[v.l]!.push(v.id); });
const pos = new Map<string, number>();
const count = (): number => { layers.forEach(l => l.forEach((id, i) => pos.set(id, i))); let c = 0; const by = new Map<number, [number, number][]>();
  for (const [a, b] of edges) { const la = verts.find(v => v.id === a)!.l; const lb = verts.find(v => v.id === b)!.l; const lo = Math.min(la, lb); const [u, w] = la < lb ? [a, b] : [b, a]; (by.get(lo) ?? by.set(lo, []).get(lo)!).push([pos.get(u)!, pos.get(w)!]); }
  for (const es of by.values()) for (let i = 0; i < es.length; i++) for (let j = i + 1; j < es.length; j++) { const [a1, b1] = es[i]!, [a2, b2] = es[j]!; if ((a1 - a2) * (b1 - b2) < 0) c++; } return c; };
// initial dummies order by barycenter of adjacent known nodes (iterate)
for (let it = 0; it < 4; it++) for (const l of layers) { const bar = (id: string): number => { const nb = edges.filter(([a, b]) => a === id || b === id).map(([a, b]) => (a === id ? b : a)); const xs = nb.map(n => pos.get(n)).filter((v): v is number => v !== undefined); return xs.length ? xs.reduce((s, v) => s + v, 0) / xs.length : 0; }; if (it > 0) l.sort((a, b) => bar(a) - bar(b)); count(); }
let cur = count(); const drawn = cur;
let seed = 7; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
let best = cur; let bestL = layers.map(l => [...l]);
for (let run = 0; run < 60; run++) { let T = 3; layers.forEach((l, i) => { if (run > 0) { for (let k = l.length - 1; k > 0; k--) { const j = Math.floor(rnd() * (k + 1)); [l[k], l[j]] = [l[j]!, l[k]!]; } } }); cur = count();
  for (let k = 0; k < 6000; k++) { const l = layers[Math.floor(rnd() * layers.length)]!; if (l.length < 2) continue; const i = Math.floor(rnd() * l.length), j = Math.floor(rnd() * l.length); if (i === j) continue; [l[i], l[j]] = [l[j]!, l[i]!]; const c = count(); if (c <= cur || rnd() < Math.exp((cur - c) / T)) { cur = c; if (c < best) { best = c; bestL = layers.map(q => [...q]); } } else [l[i], l[j]] = [l[j]!, l[i]!]; T = Math.max(0.05, T * 0.999); } }
console.log(JSON.stringify({layers: layers.map(l => l.filter(x => !x.startsWith('d')).length), drawnOrderCrossings: drawn, fewestFound: best}));
fs.writeFileSync('force-rows.json', JSON.stringify(bestL));
console.log(bestL.map(l => l.filter(x => !x.startsWith('d')).join(' ')).join('\n'));
