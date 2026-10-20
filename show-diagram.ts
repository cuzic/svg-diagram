#!/usr/bin/env node
// svg-diagram show <file.svg|file.ts>... — draw an SVG, or a diagram source, right in the terminal as sixel
// (Windows Terminal 1.22+, WezTerm, foot, mlterm, xterm -ti vt340, tmux >= 3.4 built with sixel ...).
//
//   svg-diagram show svg/flow.svg
//   svg-diagram show diagrams/flow.ts              build in memory (nothing written), draw it, say what is wrong
//   svg-diagram show a.ts b.svg --width 800        several, one under the other; at most 800px wide
//   svg-diagram show flow.ts --png /tmp/flow.png   a PNG instead of sixel (also what an agent without a terminal uses)
//
// Options: --png FILE (one input; writes a PNG, no sixel, no terminal needed)   --scale N   --width PX (the cap, else the terminal's width)
//          --engine resvg|chromium (default: resvg, no browser)
//          --require-fresh (an SVG older than its source, by the hashes in its metadata, is warned about; with this flag it also exits 1)
//          --colors N (sixel palette, default 256)   --force (write sixel although stdout is not a terminal / sixel is not announced)
//          --passthrough (wrap sixel for tmux; needs `set -g allow-passthrough on`)
//
// The picture is drawn without a browser (resvg, with the font files the layout was measured with); --engine chromium draws it as an
// <img> in a real browser instead (needs playwright-chromium). Either way an SVG that is not well-formed XML fails here the way it
// fails in a document. A .ts source is laid out and verified like `build`, but a
// failed verification still draws — that is when you most want to see it. Nothing is written and no dev server is
// started for a slide's size: with no cached budget the diagram is drawn at its default size, with a note.
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {installResolveHook} from './lib/resolve-hook.ts';
// Run from source (.ts) or from the compiled dist/ (.js); sibling files share the extension.
const EXT = import.meta.url.endsWith('.ts') ? 'ts' : 'js';
installResolveHook();
const {renderDiagram, closeMeasurer} = await import('./lib/dsl.ts');
const {loadDiagram} = await import('./lib/load-source.ts');
const {loadConfig} = await import('./lib/config.ts');
const {rasterize, svgSize, staleBannerSvg} = await import('./lib/raster.ts');
const {xmlProblems} = await import('./lib/xml-check.ts');
const {freshness, staleNotice} = await import('./lib/freshness.ts');
const {formatBuildError} = await import('./lib/error-format.ts');
const {queryTerminal, supportsSixel, isTmux, fitBox, fitScale, tmuxPassthrough} = await import('./lib/terminal.ts');
const {image2sixel} = await import('sixel');

const USAGE = 'Usage: svg-diagram show <file.svg|file.ts>... [--png FILE] [--scale N] [--width PX] [--colors N] [--engine resvg|chromium] [--force] [--passthrough] [--require-fresh]';
const args = process.argv.slice(2);
const VALUE = ['--png', '--scale', '--width', '--colors', '--engine'];
const flag = (n: string) => args.includes(n);
const val = (n: string) => { const i = args.indexOf(n); return i === -1 ? null : args[i + 1] ?? null; };
const num = (n: string) => { const v = val(n); if (v === null) return null; const x = Number(v); if (!(x > 0)) { console.error(`✗ ${n} needs a positive number (got ${v})\n${USAGE}`); process.exit(2); } return x; };
const files = args.filter((a, i) => !a.startsWith('--') && !VALUE.includes(args[i - 1]));
for (const a of args) if (a.startsWith('--') && ![...VALUE, '--force', '--passthrough', '--require-fresh'].includes(a)) { console.error(`✗ unknown option ${a}\n${USAGE}`); process.exit(2); }
if (!files.length) { console.error(USAGE); process.exit(2); }
const pngOut = val('--png'), scaleOpt = num('--scale'), widthOpt = num('--width'), colors = num('--colors') ?? 256;
const engineOpt = val('--engine') ?? 'auto';
if (!['auto', 'resvg', 'chromium'].includes(engineOpt)) { console.error(`✗ --engine is resvg or chromium (got ${engineOpt})\n${USAGE}`); process.exit(2); }
const engine = engineOpt as 'auto' | 'resvg' | 'chromium';
if (!Number.isInteger(colors) || colors < 2 || colors > 256) { console.error(`✗ --colors is an integer from 2 to 256 (got ${colors})\n${USAGE}`); process.exit(2); }
const force = flag('--force'), passthrough = flag('--passthrough');
if (pngOut && files.length !== 1) { console.error(`✗ --png writes one picture: give exactly one input\n${USAGE}`); process.exit(2); }

const inTmux = !!process.env['TMUX'];
const tmuxQuery = (fmt: string) => { try { return execFileSync('tmux', ['display', '-p', fmt], {encoding: 'utf8', timeout: 2000}).trim(); } catch { return ''; } };

// ---- what the terminal can do (not needed for --png) ----------------------------------------------------------------
let term = null as Awaited<ReturnType<typeof queryTerminal>>;
let box = fitBox(null);
if (!pngOut) {
  if (!process.stdout.isTTY && !force) {
    console.error('✗ stdout is not a terminal, so no sixel is written. Use --png FILE to write a picture (and read it), or --force to write the sixel anyway.');
    process.exit(1);
  }
  term = process.stdout.isTTY ? await queryTerminal() : null; // never write queries to a terminal that is not the one being drawn on (--force into a pipe)
  const tmuxSeen = inTmux || (term ? isTmux(term) : false);
  const announced = !!term && supportsSixel(term);
  if (passthrough) {
    if (!tmuxSeen) console.error('⚠ --passthrough is for tmux; tmux was not detected, so the sixel is wrapped for nothing.');
    if (inTmux && tmuxQuery('#{pane_id}') && execFileSyncSafe('tmux', ['show', '-gv', 'allow-passthrough']) === 'off') {
      console.error('✗ tmux drops passthrough sequences while allow-passthrough is off. Run: tmux set -g allow-passthrough on');
      process.exit(1);
    }
    const cols = Number(tmuxQuery('#{pane_width}')) || term?.cols || null;
    const cellW = Number(tmuxQuery('#{client_cell_width}')) || term?.cellPx?.w || 0; // 3.3a answers 0
    if (cols) box = fitBox({windowPx: null, cellPx: cellW ? {w: cellW, h: 0} : null, cols, rows: null}, {cellWidthGuess: 8});
    else if (!widthOpt) console.error('⚠ the pane width is unknown, so the picture may run into the next pane: give --width PX');
    else box = fitBox(null);
    if (!widthOpt && box.estimated && cols) console.error(`⚠ the cell width is not known, so ${cols} columns were taken as ${box.maxW}px (8px a cell); adjust with --width PX`);
  } else {
    if (!announced && !force) {
      if (tmuxSeen) console.error('✗ tmux is between you and the terminal and does not pass sixel on (tmux >= 3.4 built with sixel does). Options: --png FILE, or --passthrough with `set -g allow-passthrough on` (the picture is lost when the pane redraws).');
      else if (!term) console.error('✗ no terminal to ask (/dev/tty is not available). Use --png FILE, or --force to write the sixel anyway.');
      else console.error('✗ this terminal did not say it can draw sixel (DA1 has no attribute 4). Windows Terminal needs 1.22 or later. Use --png FILE, or --force to try anyway.');
      process.exit(1);
    }
    box = fitBox(term);
  }
}
function execFileSyncSafe(cmd: string, a: string[]): string { try { return execFileSync(cmd, a, {encoding: 'utf8', timeout: 2000}).trim(); } catch { return ''; } }

// ---- draw each input ------------------------------------------------------------------------------------------------
let failed = false;
try {
  const config = loadConfig();
  for (const file of files) {
    const abs = path.resolve(file);
    if (!fs.existsSync(abs)) { console.error(`✗ ${file}: no such file`); failed = true; continue; }
    let svg: string;
    try {
      if (/\.svg$/i.test(file)) {
        svg = fs.readFileSync(abs, 'utf8');
        const xml = xmlProblems(svg);
        if (xml.length) { console.error(`  ✗ ${file}: not well-formed XML:\n    ${xml.join('\n    ')}`); failed = true; }
        const fresh = freshness(abs); // ADR 0013: out of date by the hashes in the SVG's metadata (a hand-made SVG is never judged)
        if (fresh.state === 'stale') {
          const notice = staleNotice(fresh, file);
          console.error(`  ${notice.long}`);
          if (flag('--require-fresh')) failed = true;
          if (pngOut) svg = staleBannerSvg(svg, notice.banner); // the PNG carries the warning; the sixel does not
        }
      } else {
        if (path.relative(process.cwd(), abs).startsWith('..')) console.error(`  ⚠ ${file}: outside the current directory, so .svg-diagram.json and the slide cache are looked up from here, not from the source's project (run from the project root to match \`build\`)`);
        const d = await loadDiagram(abs, config);
        const r = await renderDiagram(d, {name: `${path.parse(file).name}.svg`, budget: 'cacheOnly'});
        for (const n of r.notes) console.error(`  ℹ ${file}: ${n}`);
        for (const p of r.verdict.problems) console.error(`  ✗ ${file}: ${p}`);
        for (const w of [...r.fit.warnings, ...r.verdict.warnings]) console.error(`  ⚠ ${file}: ${w}`);
        svg = r.svg;
        if (!r.verdict.ok) failed = true; // drawn anyway, but the exit status says it would not build
        if (r.xml.length) console.error(`  ✗ ${file}: not well-formed XML:\n    ${r.xml.join('\n    ')}`);
      }
      const size = svgSize(svg);
      if (!size) throw new Error('the SVG has no width/height (or viewBox) on its root element');
      const byWidth = widthOpt ? Math.min(1, widthOpt / size.w) : null; // --width replaces the terminal's width (a guess may be too small); it never enlarges
      const byBox = fitScale(size.w, size.h, widthOpt ? Infinity : box.maxW, box.maxH);
      const scale = scaleOpt ?? (pngOut ? 1 : Math.min(byWidth ?? 1, byBox));
      const byHeight = Math.min(1, box.maxH / size.h); // the tall-picture cap alone (the width limit has its own note)
      if (!scaleOpt && !pngOut && byHeight < 1 && byHeight <= Math.min(byWidth ?? 1, widthOpt ? 1 : box.maxW / size.w)) console.error(`  ⚠ ${file}: too tall for the screen (${Math.round(size.h)}px; the cap is ${box.maxH}px), shrunk to ${Math.round(byHeight * 100)}%`);
      const ras = await rasterize(svg, {scale, png: !!pngOut, engine, fonts: config.fonts});
      if (pngOut) { fs.writeFileSync(pngOut, must(ras.png)); console.log(`wrote ${pngOut} (${ras.width}x${ras.height})`); continue; }
      let seq = image2sixel(new Uint8ClampedArray(ras.rgba), ras.width, ras.height, colors);
      if (passthrough) seq = tmuxPassthrough(seq);
      if (files.length > 1) process.stdout.write(`${file}\n`);
      process.stdout.write(seq + '\n');
    } catch (e) {
      console.error(formatBuildError(file, e));
      failed = true;
    }
  }
} finally {
  await closeMeasurer();
}
process.exitCode = failed ? 1 : 0; // not process.exit(): a pipe may still be draining
