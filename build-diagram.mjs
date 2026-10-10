#!/usr/bin/env node
// CLI: build one or more diagram-source modules into public/svg/*.svg.
//
// A diagram source module default-exports a function that constructs (but
// does not write) a diagram():
//
//   import { diagram, caption, box, banner } from './lib/dsl.mjs';
//   export default function define() {
//     const d = diagram({ day: 2 });
//     d.add(caption('...'));
//     d.add(box({ title: '...', body: '...' }));
//     return d;
//   }
//
// Usage:
//   node scripts/svg-diagram/build-diagram.mjs diagrams/day2-11-example.mjs
//   node scripts/svg-diagram/build-diagram.mjs diagrams/*.mjs
//   node scripts/svg-diagram/build-diagram.mjs diagrams/day2-11-example.mjs --out /tmp/preview.svg
//
// Output path defaults to public/svg/<basename-without-.mjs>.svg.
// --out overrides it (only valid with exactly one input module).
// Always runs lint-svg.mjs --strict on the result (via dsl.mjs's build()) —
// a diagram that fails lint is reported as a failure, not written silently.

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import {register} from 'node:module';
register('./lib/resolve-hook.mjs', import.meta.url);
const {build, closeMeasurer} = await import('./lib/dsl.mjs');

// --fit: ソースを書き換えずに、この図を使っているスライドを pages/*.md から探し、
// そのスライドの空き幅・空き高さ(実測)に合わせて作り直す(diagram({fill, slide}) と同じ)。
// 図は <img class="fill"> で、使用スライドがちょうど1枚のときだけ使える。
function locateSlide(svgName) {
  const hits = [];
  for (const f of fs.readdirSync('pages').filter(f => f.endsWith('.md'))) {
    const lines = fs.readFileSync(path.join('pages', f), 'utf8').split('\n');
    let fence = false, heading = null;
    for (const l of lines) {
      if (/^```/.test(l)) fence = !fence;
      if (fence) continue;
      if (/^# /.test(l)) heading = l.slice(2).trim();
      if (l.includes(`/svg/${svgName}`) && /<img\b/.test(l)) hits.push({page: path.join('pages', f), heading, isFill: /class="[^"]*\bfill\b/.test(l)});
    }
  }
  return hits;
}

const TOOL_VERSION = JSON.parse(fs.readFileSync(new URL('./package.json', import.meta.url), 'utf8')).version;
const args = process.argv.slice(2);
const outIdx = args.indexOf('--out');
const outOverride = outIdx === -1 ? null : args[outIdx + 1];
const modules = args.filter((a, i) => a !== '--out' && a !== '--fit' && args[i - 1] !== '--out')
const FIT = args.includes('--fit');;

if (modules.length === 0) {
  console.error('Usage: node scripts/svg-diagram/build-diagram.mjs <diagram-source.mjs> [<more...>] [--out <path>]');
  process.exit(2);
}
if (outOverride && modules.length > 1) {
  console.error('--out only makes sense with exactly one input module');
  process.exit(2);
}

let failed = false;
try {
  for (const modPath of modules) {
    const abs = path.resolve(modPath);
    const mod = await import(abs);
    const define = mod.default;
    if (typeof define !== 'function') {
      console.error(`✗ ${modPath}: no default export function — see the header comment for the expected shape`);
      failed = true;
      continue;
    }
    const outPath = outOverride ?? path.join('svg', path.basename(modPath, '.mjs') + '.svg');
    try {
      const d = define();
      // provenance for drift checks: which source (and which tool version) produced this SVG
      d.source = {generator: 'svg-diagram', toolVersion: TOOL_VERSION, source: path.relative(process.cwd(), abs), sourceSha256: crypto.createHash('sha256').update(fs.readFileSync(abs)).digest('hex')};
      if (FIT) {
        const hits = locateSlide(path.basename(outPath));
        if (hits.length !== 1) throw new Error(`--fit: ${path.basename(outPath)} を使っているスライドが${hits.length}枚です(ちょうど1枚が必要)`);
        if (!hits[0].isFill) throw new Error(`--fit: ${hits[0].page} の「${hits[0].heading}」の <img> に class="fill"(と frontmatter の fit-figure)がありません`);
        d.fill = true;
        d.slide = {page: hits[0].page, heading: hits[0].heading};
      }
      const result = await build(d, outPath);
      if (result.fit.doc) console.log(`✓ ${outPath} (${result.width}x${result.height})`);
      else {
        const imgTag = d.fill ? '<img class="fill">' : `<img style="${result.fit.imgStyle}">`;
        console.log(`✓ ${outPath} (${result.width}x${result.height}) → ${imgTag} (text ~${result.fit.effectiveFont}px on slide${d.fill ? `, font scale x${result.fontScale}` : ''})`);
      }
      if (result.budget) console.log(`  budget: ${result.budget.maxHeight}px high x ${result.budget.contentWidth}px wide (slide ${result.budget.index}, ${result.budget.cached ? 'cached' : 'measured'})`);
      for (const w of [...result.fit.warnings, ...result.warnings]) console.warn(`  ⚠ ${w}`);
    } catch (err) {
      console.error(`✗ ${modPath}: ${err.message}`);
      failed = true;
    }
  }
} finally {
  await closeMeasurer();
}
process.exit(failed ? 1 : 0);
