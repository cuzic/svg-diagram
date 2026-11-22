// usage: node u6-edges-diff.mjs a.json b.json   the arrows whose bends changed between two u6-edges.ts runs (the same figures): counts by (bends before -> after, AND or not, offset before)
import fs from 'node:fs';
const a = JSON.parse(fs.readFileSync(process.argv[2])).out, b = JSON.parse(fs.readFileSync(process.argv[3])).out, tally = {};
a.forEach((f, i) => { if (f.err || b[i].err) return; f.e.forEach((x, k) => { const y = b[i].e[k]; if (x[1] !== y[1]) { const key = `${x[1]}->${y[1]} ${x[4] ? 'AND' : 'plain'} ${x[3] > 2 ? 'long' : 'direct'} off ${x[2] <= 45 ? '<=45' : '>45'}`; tally[key] = (tally[key] ?? 0) + 1; } }); });
console.log(Object.entries(tally).sort((p, q) => q[1] - p[1]).map(([k, v]) => `${String(v).padStart(4)}  ${k}`).join('\n'));
