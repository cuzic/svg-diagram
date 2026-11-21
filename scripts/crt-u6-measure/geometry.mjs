// usage: node geometry.mjs fx-dump.json [figure name]   node boxes and edge point lists (ids and coordinates)
import fs from 'node:fs';
const r = JSON.parse(fs.readFileSync(process.argv[2])).find(x => x.name === (process.argv[3] ?? 'fix-default'));
for (const n of r.nodes) console.log(n.id.padEnd(5), 'x', Math.round(n.x), '-', Math.round(n.x + n.w), ' y', Math.round(n.y), '-', Math.round(n.y + n.h));
console.log();
for (const e of r.P) console.log((e.f + '>' + e.t).padEnd(9), e.p.map(p => Math.round(p.x) + ',' + Math.round(p.y)).join(' '));
