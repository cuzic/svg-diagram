// usage: node show.mjs <fixture.ts output json>   one line of metrics per figure
import fs from 'node:fs'; const r = JSON.parse(fs.readFileSync(process.argv[2]));
for (const x of r) { const {name, P, nodes, hash, ...o} = x; console.log(name.padEnd(22), x.err ?? JSON.stringify(o)); }
