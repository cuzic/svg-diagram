#!/usr/bin/env node
// svg-diagram contact a.svg b.svg ... --out sheet.png [--cols 2] [--width 1400] [--engine resvg|chromium]
// Several diagrams on one picture, to review a whole set at a glance (checks cannot judge balance or spacing).
// The sheet is itself one SVG (lib/contact.ts), drawn like any other: no browser by default.
import fs from 'node:fs';
import {rasterize} from './lib/raster.ts';
import {buildSheet} from './lib/contact.ts';

const args = process.argv.slice(2);
const VALUE = ['--out', '--cols', '--width', '--engine'];
const val = (n: string, d: string) => { const i = args.indexOf(n); return i === -1 ? d : args[i + 1]; };
const out = val('--out', 'contact-sheet.png'), cols = Number(val('--cols', '2')), width = Number(val('--width', '1400'));
const engine = val('--engine', 'auto') as 'auto' | 'resvg' | 'chromium';
const files = args.filter((a, i) => a.endsWith('.svg') && !VALUE.includes(args[i - 1]));
const USAGE = 'Usage: svg-diagram contact a.svg b.svg ... --out sheet.png [--cols 2] [--width 1400] [--engine resvg|chromium]';
for (const a of args) if (a.startsWith('--') && !VALUE.includes(a)) { console.error(`✗ unknown option ${a}\n${USAGE}`); process.exit(2); }
if (!files.length) { console.error(USAGE); process.exit(2); }
if (!['auto', 'resvg', 'chromium'].includes(engine)) { console.error(`✗ --engine is resvg or chromium (got ${engine})\n${USAGE}`); process.exit(2); }
if (!(width > 0) || !(cols >= 1)) { console.error(`✗ --width and --cols need positive numbers\n${USAGE}`); process.exit(2); }
try {
  const sheet = buildSheet(files.map(f => [f, fs.readFileSync(f, 'utf8')] as [string, string]), {cols, width});
  fs.writeFileSync(out, (await rasterize(sheet.svg, {png: true, engine})).png!);
  console.log(`wrote ${out} (${files.length} diagrams)`);
} catch (e) {
  console.error(`✗ ${(e as Error).message}`);
  process.exit(1);
}
