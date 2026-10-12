#!/usr/bin/env node
// svg-diagram preview <in.svg> <out.png> [scale]   — an SVG as a PNG, to look at while authoring (default scale 2).
// Drawn without a browser (resvg) with the font files the layout was measured with; --engine chromium draws it in a real browser.
import fs from 'node:fs';
import {rasterize} from './lib/raster.ts';
import {closeMeasurer} from './lib/measure.ts';

const args = process.argv.slice(2);
const ei = args.indexOf('--engine');
const engine = (ei === -1 ? 'auto' : args[ei + 1]) as 'auto' | 'resvg' | 'chromium';
const rest = args.filter((a, i) => i !== ei && i !== ei + 1 || ei === -1);
const USAGE = 'Usage: svg-diagram preview <in.svg> <out.png> [scale] [--engine resvg|chromium]';
const [input, output, scaleArg] = rest;
const scale = scaleArg === undefined ? 2 : Number(scaleArg);
if (!input || !output || !(scale > 0)) { console.error(USAGE); process.exit(2); }
if (!['auto', 'resvg', 'chromium'].includes(engine)) { console.error(`✗ --engine is resvg or chromium (got ${engine})\n${USAGE}`); process.exit(2); }
try {
  const r = await rasterize(fs.readFileSync(input, 'utf8'), {scale, png: true, engine});
  fs.writeFileSync(output, r.png!);
  console.log(`wrote ${output} (${r.width}x${r.height})`);
} catch (e) {
  console.error(`✗ ${input}: ${(e as Error).message}`);
  process.exit(1);
} finally {
  // --engine chromium starts a browser; left open it keeps the process alive (it looked like a hang after "wrote")
  await closeMeasurer();
}
