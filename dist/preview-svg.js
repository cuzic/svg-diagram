#!/usr/bin/env node
// svg-diagram preview <in.svg> [out.png] [scale]   — an SVG as a PNG, to look at while authoring (default scale 2).
// Drawn without a browser (resvg) with the font files the layout was measured with; --engine chromium draws it in a real browser.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { grayscaleSvg, rasterize, staleBannerSvg } from './lib/raster.js';
import { freshness, staleNotice } from './lib/freshness.js';
import { closeMeasurer } from './lib/measure.js';
import { must } from './lib/must.js';
// No name given: <tmpdir>/svg-diagram-preview-<uid>/<source>-<unique>.png, created exclusively so parallel runs never overwrite each other.
// The directory is per user and private (0700): a shared one would fail for the second user on a host, or be pre-created by someone else.
function uniquePreview(input, png) {
    const uid = process.getuid?.();
    const dir = path.join(os.tmpdir(), `svg-diagram-preview${uid === undefined ? '' : `-${uid}`}`);
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    const st = fs.lstatSync(dir);
    if (!st.isDirectory() || (uid !== undefined && st.uid !== uid))
        throw new Error(`${dir} is not a directory of this user; give an output name`);
    for (;;) {
        const file = path.join(dir, `${path.basename(input, path.extname(input))}-${process.pid}-${crypto.randomBytes(3).toString('hex')}.png`);
        try {
            fs.writeFileSync(file, png, { flag: 'wx' });
            return file;
        }
        catch (e) {
            if (e.code !== 'EEXIST')
                throw e;
        }
    }
}
const args = process.argv.slice(2);
const ei = args.indexOf('--engine');
const engine = (ei === -1 ? 'auto' : args[ei + 1]);
const GRAY = args.includes('--gray'); // as a mono print or a colour-blind reader sees it
const NO_BANNER = args.includes('--no-stale-banner'); // no red band on the PNG when the SVG is out of date (the warning stays)
const REQUIRE_FRESH = args.includes('--require-fresh'); // exit 1 when the SVG is out of date (CI, an agent's automatic steps)
const rest = args.filter((a, i) => (i !== ei && i !== ei + 1 || ei === -1) && !['--gray', '--no-stale-banner', '--require-fresh'].includes(a));
const USAGE = 'Usage: svg-diagram preview <in.svg> [out.png] [scale] [--engine resvg|chromium] [--gray] [--no-stale-banner] [--require-fresh]\n  without out.png: a new file in the temp dir (never overwrites), its path is printed\n  an SVG older than its source (by the hashes in its metadata) gets a warning and a red band; --require-fresh makes that exit 1';
let [input, output, scaleArg] = rest;
if (output !== undefined && scaleArg === undefined && /^[\d.]+$/.test(output)) {
    scaleArg = output;
    output = undefined;
} // `preview in.svg 3`
const scale = scaleArg === undefined ? 2 : Number(scaleArg);
if (!input || !(scale > 0)) {
    console.error(USAGE);
    process.exit(2);
}
if (!['auto', 'resvg', 'chromium'].includes(engine)) {
    console.error(`✗ --engine is resvg or chromium (got ${engine})\n${USAGE}`);
    process.exit(2);
}
let stale = false;
try {
    let svg = fs.readFileSync(input, 'utf8');
    if (GRAY)
        svg = grayscaleSvg(svg);
    const f = freshness(input); // ADR 0013: judged by the hashes embedded in the SVG, never by file times
    const notice = f.state === 'stale' ? staleNotice(f, input) : null;
    if (notice && !NO_BANNER)
        svg = staleBannerSvg(svg, notice.banner);
    stale = !!notice;
    const r = await rasterize(svg, { scale, png: true, engine });
    if (output)
        fs.writeFileSync(output, must(r.png));
    else
        output = uniquePreview(input, must(r.png));
    console.log(`wrote ${output} (${r.width}x${r.height})${notice ? ` (${notice.short})` : ''}`);
    if (notice)
        console.error(notice.long);
}
catch (e) {
    console.error(`✗ ${input}: ${e.message}`);
    process.exit(1);
}
finally {
    // --engine chromium starts a browser; left open it keeps the process alive (it looked like a hang after "wrote")
    await closeMeasurer();
}
if (stale && REQUIRE_FRESH)
    process.exit(1);
