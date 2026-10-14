#!/usr/bin/env node
// CLI: build one or more diagram-source modules into public/svg/*.svg.
//
// A diagram source module default-exports a function that constructs (but
// does not write) a diagram():
//
//   import { diagram, caption, box, banner } from './lib/dsl.ts';
//   export default function define() {
//     const d = diagram({ day: 2 });
//     d.add(caption('...'));
//     d.add(box({ title: '...', body: '...' }));
//     return d;
//   }
//
// Usage:
//   node scripts/svg-diagram/build-diagram.ts diagrams/day2-11-example.ts
//   node scripts/svg-diagram/build-diagram.ts diagrams/*.ts
//   node scripts/svg-diagram/build-diagram.ts diagrams/day2-11-example.ts --out /tmp/preview.svg
//
// Output path defaults to public/svg/<basename-without-extension>.svg.
// --out overrides it (only valid with exactly one input module).
// Always runs lint-svg.ts --strict on the result (via dsl.ts's build()) —
// a diagram that fails lint is reported as a failure, not written silently.

import fs from 'fs';
import path from 'path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {register} from 'node:module';
// Run from source (.ts) or from the compiled dist/ (.js); sibling files share the extension.
const EXT = import.meta.url.endsWith('.ts') ? 'ts' : 'js';
register(`./lib/resolve-hook.${EXT}`, import.meta.url);
const {build, closeMeasurer} = await import('./lib/dsl.ts');
const {loadConfig} = await import('./lib/config.ts');
const {loadDiagram} = await import('./lib/load-source.ts');
const {depsSha256, depsOf} = await import('./lib/source-deps.ts');
const {readProvenance, ownsOutput, sha256: sha} = await import('./lib/freshness.ts');
const {prefixSvgIds, idPrefixFor} = await import('./lib/svg-ids.ts');
const {formatBuildError} = await import('./lib/error-format.ts');
const config = loadConfig();

// --fit: ソースを書き換えずに、この図を使っているスライドを pages/*.md から探し、
// そのスライドの空き幅・空き高さ(実測)に合わせて作り直す(diagram({fill, slide}) と同じ)。
// 図は <img class="fill"> で、使用スライドがちょうど1枚のときだけ使える。
function locateSlide(svgName: string) {
  const hits: {page: string; heading: string | null; isFill: boolean}[] = [];
  for (const f of fs.readdirSync('pages').filter(f => f.endsWith('.md'))) {
    const lines = fs.readFileSync(path.join('pages', f), 'utf8').split('\n');
    let fence = false, heading: string | null = null;
    for (const l of lines) {
      if (/^```/.test(l)) fence = !fence;
      if (fence) continue;
      if (/^# /.test(l)) heading = l.slice(2).trim();
      if (l.includes(`/svg/${svgName}`) && /<img\b/.test(l)) hits.push({page: path.join('pages', f), heading, isFill: /class="[^"]*\bfill\b/.test(l)});
    }
  }
  return hits;
}

const TOOL_VERSION = JSON.parse(fs.readFileSync(new URL(EXT === 'ts' ? './package.json' : '../package.json', import.meta.url), 'utf8')).version;
const args = process.argv.slice(2);
const valueOf = (flag: string) => { const i = args.indexOf(flag); return i === -1 ? null : args[i + 1]; };
const outOverride = valueOf('--out');
const outDir = valueOf('--out-dir');
const pngDir = valueOf('--png'); // also write <name>.png (the rasters of lib/raster.ts) here
const scaleArg = valueOf('--scale');
const PNG_SCALE = scaleArg === null ? 2 : Number(scaleArg);
const idPrefixArg = valueOf('--id-prefix'); // ADR 0012 D2: prefix every id of the written SVG / HTML (`auto`: a hash of the content)
const FIT = args.includes('--fit');
const NO_LINT = args.includes('--no-lint'); // iteration: skip the lint pass (check/CI or a final build runs it)
const HTML = args.includes('--html'); // also write <name>.html (boxes and text as HTML/CSS, the rest as an inline SVG overlay)
const DARK = args.includes('--dark'); // draw with the dark token set (overrides diagram({appearance}))
const TRANSPARENT = args.includes('--transparent'); // no page-colour background rectangle
const STALE = args.includes('--stale'); // skip diagrams whose SVG already matches this source, tool version and project config
const modules = args.filter((a, i) => !['--out', '--out-dir', '--png', '--scale', '--id-prefix', '--fit', '--stale', '--no-lint', '--html', '--dark', '--transparent'].includes(a) && !['--out', '--out-dir', '--png', '--scale', '--id-prefix'].includes(args[i - 1]));

if (modules.length === 0) {
  console.error('Usage: svg-diagram build <diagram-source.ts>... [--out <file> | --out-dir <dir>] [--png <dir> [--scale N]] [--stale] [--no-lint] [--fit] [--html] [--dark] [--transparent] [--id-prefix <p|auto>]');
  process.exit(2);
}
if (outOverride && modules.length > 1) {
  console.error('--out only makes sense with exactly one input module (use --out-dir for several)');
  process.exit(2);
}
if (pngDir !== null && (!pngDir || pngDir.startsWith('--'))) { console.error('--png needs a directory'); process.exit(2); }
if (scaleArg !== null && pngDir === null) { console.error('--scale is the PNG scale: use it with --png <dir>'); process.exit(2); }
if (!(PNG_SCALE > 0)) { console.error(`--scale is a positive number (got ${scaleArg})`); process.exit(2); }
if (idPrefixArg !== null && !/^[A-Za-z_][\w.-]*$/.test(idPrefixArg)) { console.error(`--id-prefix is a name usable in an id (letters, digits, _ . -; not starting with a digit) or "auto" (got ${idPrefixArg})`); process.exit(2); }
if (outOverride && outDir) {
  console.error('use either --out or --out-dir, not both');
  process.exit(2);
}

// the project config changes what a build produces, so it takes part in "is this SVG current?"
const configSha256 = config._file ? sha(fs.readFileSync(config._file)) : '';

let failed = false;
const written: string[] = [];
let skipped = 0;
try {
  for (const modPath of modules) {
    const abs = path.resolve(modPath);
    const outPath = outOverride ?? path.join(outDir ?? 'svg', path.parse(modPath).name + '.svg');
    // ADR 0013: a failed build never touches the old SVG, but says so when that file is this source's own output (it is now out of date)
    const failedBuild = (message: unknown) => {
      console.error(formatBuildError(modPath, message));
      if (ownsOutput(outPath, abs)) console.error(`  ⚠ 前回の ${outPath} が残っている(ソースと一致しない古い絵)`);
      failed = true;
    };
    let define: unknown;
    try { define = (await import(abs)).default; } catch (err) { failedBuild(err); continue; }
    if (typeof define !== 'function') {
      failedBuild(new Error('no default export function — see the header comment for the expected shape'));
      continue;
    }
    const srcSha = sha(fs.readFileSync(abs));
    for (const f of depsOf(abs).unfollowable) console.warn(`  ⚠ ${path.relative(process.cwd(), f)}: 変数で組み立てた import() は、変更の検出（--stale / check --drift）の対象にならない`);
    const depsSha = depsSha256(abs); // local files the source imports (shared parts): a change there makes the SVG stale too
    const pngPath = pngDir && path.join(pngDir, path.parse(outPath).name + '.png');
    const pngCurrent = () => !pngPath || (fs.existsSync(pngPath) && fs.statSync(pngPath).mtimeMs >= fs.statSync(outPath).mtimeMs);
    if (STALE && idPrefixArg === null && !FIT && !DARK && !TRANSPARENT && fs.existsSync(outPath) && pngCurrent()) { // --png: a missing or older PNG is not up to date either
      const meta = readProvenance(outPath);
      if (meta && meta.sourceSha256 === srcSha && meta.toolVersion === TOOL_VERSION && (meta.configSha256 ?? '') === configSha256 && (meta.depsSha256 ?? '') === depsSha) {
        console.log(`· ${outPath} は最新（スキップ）`);
        skipped++;
        continue;
      }
    }
    try {
      const d = await loadDiagram(abs, config); // .svg-diagram.json: project-wide accepted rules and max width
      // provenance for drift checks: which source (and which tool version) produced this SVG
      d.source = {generator: 'svg-diagram', toolVersion: TOOL_VERSION, source: path.relative(process.cwd(), abs), sourceSha256: srcSha, ...(configSha256 ? {configSha256} : {}), ...(depsSha ? {depsSha256: depsSha} : {})};
      if (DARK && typeof d.appearance !== 'object') d.appearance = 'dark'; // a custom dark set the diagram names stays
      if (TRANSPARENT) d.transparent = true;
      if (FIT) {
        const hits = locateSlide(path.basename(outPath));
        if (hits.length !== 1) throw new Error(`--fit: ${path.basename(outPath)} を使っているスライドが${hits.length}枚です(ちょうど1枚が必要)`);
        if (!hits[0].isFill) throw new Error(`--fit: ${hits[0].page} の「${hits[0].heading}」の <img> に class="fill"(と frontmatter の fit-figure)がありません`);
        d.fill = true;
        d.slide = {page: hits[0].page, heading: hits[0].heading as string};
      }
      const result = await build(d, outPath, {lint: false, html: HTML}); // linted together below: one Chromium for all files
      if (idPrefixArg !== null) {
        const base = modules.length > 1 ? path.parse(modPath).name : null;
        for (const f of [outPath, ...result.revealPaths, ...(result.htmlPath ? [result.htmlPath] : [])]) {
          const text = fs.readFileSync(f, 'utf8');
          const prefix = idPrefixArg === 'auto' ? `sd${sha(text).slice(0, 8)}` : idPrefixFor(idPrefixArg, base);
          fs.writeFileSync(f, prefixSvgIds(text, prefix, {rootId: /<div id="(sd-[0-9a-f]+)" class="sd"/.exec(text)?.[1]})); // <metadata id="svg-diagram"> stays
        }
      }
      written.push(outPath, ...result.revealPaths);
      if (result.htmlPath) console.log(`✓ ${result.htmlPath}`);
      if (result.fit.doc) console.log(`✓ ${outPath} (${result.width}x${result.height})`);
      else {
        const imgTag = d.fill ? '<img class="fill">' : `<img style="${result.fit.imgStyle}">`;
        console.log(`✓ ${outPath} (${result.width}x${result.height}) → ${imgTag} (text ~${result.fit.effectiveFont}px on slide${d.fill ? `, font scale x${result.fontScale}` : ''})`);
      }
      if (result.budget) console.log(`  budget: ${result.budget.maxHeight}px high x ${result.budget.contentWidth}px wide (slide ${result.budget.index}, ${result.budget.cached ? 'cached' : 'measured'})`);
      for (const w of [...result.fit.warnings, ...result.warnings]) console.warn(`  ⚠ ${w}`);
    } catch (err) {
      failedBuild(err);
    }
  }
} finally {
  await closeMeasurer();
}
if (pngDir && written.length) { // the SVG and its PNG come from one build, so they cannot disagree
  const {rasterize} = await import('./lib/raster.ts');
  fs.mkdirSync(pngDir, {recursive: true});
  for (const svgPath of written) {
    try {
      const r = await rasterize(fs.readFileSync(svgPath, 'utf8'), {scale: PNG_SCALE, png: true});
      const pngPath = path.join(pngDir, path.parse(svgPath).name + '.png');
      fs.writeFileSync(pngPath, r.png!);
      console.log(`✓ ${pngPath} (${r.width}x${r.height})`);
    } catch (err) { console.error(`✗ ${svgPath}: ${(err as Error).message}`); failed = true; }
  }
  await closeMeasurer();
}
if (written.length && !NO_LINT) { // lint-svg.ts renders every file in a single Chromium (it used to start one per diagram)
  const lintScript = fileURLToPath(new URL(`./lint-svg.${EXT}`, import.meta.url));
  const r = spawnSync(process.execPath, [lintScript, ...written, '--strict'], {encoding: 'utf8'});
  if (r.status !== 0) {
    console.error(`✗ lint-svg.ts --strict が通らない:\n${(r.stdout || '') + (r.stderr || '')}`);
    failed = true;
  }
}
if (STALE) console.log(`${written.length} 件を生成、${skipped} 件は最新でスキップ`);
process.exit(failed ? 1 : 0);
