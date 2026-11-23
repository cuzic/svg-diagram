// node spikes/manga-face/png.mjs in.svg out.png [scale] — renders an SVG with playwright-chromium.
import fs from 'node:fs';
import {chromium} from 'playwright-chromium';
const [, , inp, out, scale = '1'] = process.argv;
const svg = fs.readFileSync(inp, 'utf8');
const [w, h] = svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/).slice(1).map(Number);
const b = await chromium.launch();
const p = await b.newPage({viewport: {width: Math.ceil(w), height: Math.ceil(h)}, deviceScaleFactor: Number(scale)});
await p.setContent(`<body style="margin:0">${svg}</body>`);
await p.screenshot({path: out});
await b.close();
