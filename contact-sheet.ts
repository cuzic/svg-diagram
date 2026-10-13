#!/usr/bin/env node
// svg-diagram contact a.svg b.svg ... --out sheet.png [--cols 2] [--width 1400] [--per-page N | --pages N] [--engine resvg|chromium]
// Several diagrams on one picture, to review a whole set at a glance (checks cannot judge balance or spacing).
// The sheet is itself one SVG (lib/contact.ts), drawn like any other: no browser by default.
import fs from 'node:fs';
import {rasterize} from './lib/raster.ts';
import {closeMeasurer} from './lib/measure.ts';
import {buildSheet, paginate, pageName} from './lib/contact.ts';

const args = process.argv.slice(2);
const VALUE = ['--out', '--cols', '--width', '--engine', '--per-page', '--pages'];
const val = (n: string, d: string) => { const i = args.indexOf(n); return i === -1 ? d : args[i + 1]; };
const out = val('--out', 'contact-sheet.png'), cols = Number(val('--cols', '2')), width = Number(val('--width', '1400'));
const engine = val('--engine', 'auto') as 'auto' | 'resvg' | 'chromium';
const perPageArg = val('--per-page', ''), pagesArg = val('--pages', '');
const files = args.filter((a, i) => a.endsWith('.svg') && !VALUE.includes(args[i - 1]));
const USAGE = 'Usage: svg-diagram contact a.svg b.svg ... --out sheet.png [--cols 2] [--width 1400] [--per-page N | --pages N] [--engine resvg|chromium]';
for (const a of args) if (a.startsWith('--') && !VALUE.includes(a)) { console.error(`✗ unknown option ${a}\n${USAGE}`); process.exit(2); }
if ((perPageArg && !(Number(perPageArg) >= 1)) || (pagesArg && !(Number(pagesArg) >= 1))) { console.error(`✗ --per-page and --pages need positive numbers\n${USAGE}`); process.exit(2); }
if (perPageArg && pagesArg) { console.error(`✗ use --per-page or --pages, not both\n${USAGE}`); process.exit(2); }
if (!files.length) { console.error(USAGE); process.exit(2); }
if (!['auto', 'resvg', 'chromium'].includes(engine)) { console.error(`✗ --engine is resvg or chromium (got ${engine})\n${USAGE}`); process.exit(2); }
if (!(width > 0) || !(cols >= 1)) { console.error(`✗ --width and --cols need positive numbers\n${USAGE}`); process.exit(2); }
try {
  const pages = paginate(files, {perPage: perPageArg ? Number(perPageArg) : undefined, pages: pagesArg ? Number(pagesArg) : undefined});
  const written: string[] = [];
  for (const [i, page] of pages.entries()) {
    const sheet = buildSheet(page.map(f => [f, fs.readFileSync(f, 'utf8')] as [string, string]), {cols, width});
    const file = pageName(out, i, pages.length);
    fs.writeFileSync(file, (await rasterize(sheet.svg, {png: true, engine})).png!);
    written.push(file);
    console.log(`wrote ${file} (${page.length} diagrams)`);
  }
  if (written.length > 1) console.log(`${written.length} sheets: ${written.join(' ')}`);
} catch (e) {
  console.error(`✗ ${(e as Error).message}`);
  process.exit(1);
} finally {
  await closeMeasurer(); // --engine chromium starts a browser that would keep the process alive
}
