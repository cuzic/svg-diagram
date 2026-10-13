#!/usr/bin/env node
// svg-diagram preview <in.svg> [out.png] [scale]   — an SVG as a PNG, to look at while authoring (default scale 2).
// Drawn without a browser (resvg) with the font files the layout was measured with; --engine chromium draws it in a real browser.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {grayscaleSvg, rasterize} from './lib/raster.ts';
import {closeMeasurer} from './lib/measure.ts';

// No name given: <tmpdir>/svg-diagram-preview-<uid>/<source>-<unique>.png, created exclusively so parallel runs never overwrite each other.
// The directory is per user and private (0700): a shared one would fail for the second user on a host, or be pre-created by someone else.
function uniquePreview(input: string, png: Buffer): string {
  const uid = process.getuid?.();
  const dir = path.join(os.tmpdir(), `svg-diagram-preview${uid === undefined ? '' : `-${uid}`}`);
  fs.mkdirSync(dir, {recursive: true, mode: 0o700});
  const st = fs.lstatSync(dir);
  if (!st.isDirectory() || (uid !== undefined && st.uid !== uid)) throw new Error(`${dir} is not a directory of this user; give an output name`);
  for (;;) {
    const file = path.join(dir, `${path.basename(input, path.extname(input))}-${process.pid}-${crypto.randomBytes(3).toString('hex')}.png`);
    try { fs.writeFileSync(file, png, {flag: 'wx'}); return file; } catch (e) { if ((e as NodeJS.ErrnoException).code !== 'EEXIST') throw e; }
  }
}

const args = process.argv.slice(2);
const ei = args.indexOf('--engine');
const engine = (ei === -1 ? 'auto' : args[ei + 1]) as 'auto' | 'resvg' | 'chromium';
const GRAY = args.includes('--gray'); // as a mono print or a colour-blind reader sees it
const rest = args.filter((a, i) => (i !== ei && i !== ei + 1 || ei === -1) && a !== '--gray');
const USAGE = 'Usage: svg-diagram preview <in.svg> [out.png] [scale] [--engine resvg|chromium] [--gray]\n  without out.png: a new file in the temp dir (never overwrites), its path is printed';
let [input, output, scaleArg] = rest as (string | undefined)[];
if (output !== undefined && scaleArg === undefined && /^[\d.]+$/.test(output)) { scaleArg = output; output = undefined; } // `preview in.svg 3`
const scale = scaleArg === undefined ? 2 : Number(scaleArg);
if (!input || !(scale > 0)) { console.error(USAGE); process.exit(2); }
if (!['auto', 'resvg', 'chromium'].includes(engine)) { console.error(`✗ --engine is resvg or chromium (got ${engine})\n${USAGE}`); process.exit(2); }
try {
  const r = await rasterize(GRAY ? grayscaleSvg(fs.readFileSync(input, 'utf8')) : fs.readFileSync(input, 'utf8'), {scale, png: true, engine});
  if (output) fs.writeFileSync(output, r.png!);
  else output = uniquePreview(input, r.png!);
  console.log(`wrote ${output} (${r.width}x${r.height})`);
} catch (e) {
  console.error(`✗ ${input}: ${(e as Error).message}`);
  process.exit(1);
} finally {
  // --engine chromium starts a browser; left open it keeps the process alive (it looked like a hang after "wrote")
  await closeMeasurer();
}
