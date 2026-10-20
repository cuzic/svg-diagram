#!/usr/bin/env node
// svg-diagram pptx <source.ts>... [--out FILE | --out-dir DIR] [--png-scale N] [--font NAME]
import fs from 'node:fs';
import path from 'node:path';
import {installResolveHook} from './lib/resolve-hook.ts';
import {loadConfig} from './lib/config.ts';
import {loadDiagram} from './lib/load-source.ts';
import {renderDiagram} from './lib/dsl/render.ts';
import {closeMeasurer} from './lib/measure.ts';
import {emitPptx, fontFilesOf} from './lib/pptx/emit.ts';
import {formatBuildError} from './lib/error-format.ts';

installResolveHook();
const USAGE = 'Usage: svg-diagram pptx <source.ts>... [--out FILE | --out-dir DIR] [--png-scale N] [--font NAME]';
const args = process.argv.slice(2), values = ['--out', '--out-dir', '--png-scale', '--font'];
const usage = (message?: string): never => { console.error(message ? `✗ ${message}\n${USAGE}` : USAGE); process.exit(2); };
for (const [i, arg] of args.entries()) {
  if (arg.startsWith('--') && !values.includes(arg)) usage(`unknown option ${arg}`);
  if (values.includes(arg) && (args[i + 1] === undefined || args[i + 1]?.startsWith('--'))) usage(`${arg} needs a value`);
}
const value = (name: string): string | undefined => { const i = args.indexOf(name); return i < 0 ? undefined : args[i + 1]; };
const files = args.filter((arg, i) => !arg.startsWith('--') && !values.includes(args[i - 1] ?? ''));
if (!files.length || files.some(f => !f.endsWith('.ts'))) usage('pptx takes one or more .ts diagram sources');
if (value('--out') && value('--out-dir')) usage('--out and --out-dir cannot be used together');
if (value('--out') && files.length !== 1) usage('--out can only be used with one source');
const scaleText = value('--png-scale'), pngScale = scaleText === undefined ? undefined : Number(scaleText);
if (pngScale !== undefined && !(Number.isFinite(pngScale) && pngScale > 0)) usage(`--png-scale needs a positive number (got ${scaleText})`);

try {
  const outputs: {file: string; data: Buffer}[] = [];
  const failures: string[] = [];
  for (const source of files) {
    try {
      const abs = path.resolve(source), cfg = loadConfig(path.dirname(abs));
      const diagram = await loadDiagram(abs, cfg);
      const rendered = await renderDiagram(diagram, {name: path.basename(abs, '.ts') + '.svg', budget: 'cacheOnly'});
      const out = value('--out') ?? path.join(value('--out-dir') ?? '.', path.basename(abs, '.ts') + '.pptx');
      outputs.push({file: out, data: emitPptx(rendered.laidOut, {pngScale, rasterFonts: fontFilesOf(cfg.fonts), ...(value('--font') ? {font: value('--font')} : {})})});
      for (const warning of rendered.verdict.warnings) console.error(`⚠ ${source}: ${warning}`);
    } catch (error) { failures.push(formatBuildError(source, error)); }
  }
  if (failures.length) {
    failures.forEach(f => console.error(f));
    console.error(`✗ ${failures.length} of ${files.length} inputs failed; nothing was written`);
    process.exitCode = 1;
  } else {
    for (const output of outputs) { fs.mkdirSync(path.dirname(path.resolve(output.file)), {recursive: true}); fs.writeFileSync(output.file, output.data); console.log(`wrote ${output.file}`); }
  }
} finally { await closeMeasurer(); }
