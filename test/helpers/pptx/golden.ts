#!/usr/bin/env node
// Golden check for the PPTX writer: the slide XML and the picture SVGs of every example, as one SHA-256 each (the PNG fallbacks depend on
// the machine's fonts, so they are left out). A refactor that should not change the output keeps every hash.
//
//   node test/helpers/pptx/golden.ts examples/*.ts            compare with examples/out/pptx-golden.json; exit 1 on any difference
//   node test/helpers/pptx/golden.ts --update examples/*.ts   rewrite the manifest (review the diff of the changed names first)
//
// Like the SVG golden (`pnpm golden`), the hashes hold for the measuring setup of .svg-diagram.json (fonts), so run it where that is installed.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {register} from 'node:module';
import {loadConfig} from '../../../lib/config.ts';
import {loadDiagram} from '../../../lib/load-source.ts';
import {renderDiagram} from '../../../lib/dsl/render.ts';
import {closeMeasurer} from '../../../lib/measure.ts';
import {planSlide, fontsOf} from '../../../lib/pptx/slide.ts';

register(new URL('../../../lib/resolve-hook.ts', import.meta.url));
process.env['SVG_DIAGRAM_STRICT_WIDTH'] = '1';

const MANIFEST = path.resolve('examples/out/pptx-golden.json');
const args = process.argv.slice(2), update = args.includes('--update'), sources = args.filter(a => !a.startsWith('--'));
if (!sources.length) { console.error('usage: node test/helpers/pptx/golden.ts [--update] <source.ts>...'); process.exit(2); }

const sha = (parts: string[]): string => crypto.createHash('sha256').update(parts.join('\0')).digest('hex');
const current: Record<string, string> = {};
try {
  for (const source of sources) {
    const abs = path.resolve(source);
    const rendered = await renderDiagram(await loadDiagram(abs, loadConfig(path.dirname(abs))), {name: path.basename(abs, '.ts') + '.svg', budget: 'cacheOnly'});
    const plan = planSlide(rendered.laidOut, fontsOf());
    current[path.basename(abs, '.ts')] = sha([plan.xml, ...plan.pictures.map(p => p.svg)]);
  }
} finally { await closeMeasurer(); }

if (update) {
  const merged = {...(fs.existsSync(MANIFEST) ? JSON.parse(fs.readFileSync(MANIFEST, 'utf8')) as Record<string, string> : {}), ...current};
  fs.writeFileSync(MANIFEST, JSON.stringify(Object.fromEntries(Object.entries(merged).sort(([a], [b]) => a < b ? -1 : 1)), null, 2) + '\n');
  console.log(`wrote ${Object.keys(current).length} hashes to ${path.relative('.', MANIFEST)}`);
} else {
  const expected = JSON.parse(fs.readFileSync(MANIFEST, 'utf8')) as Record<string, string>;
  const changed = Object.keys(current).filter(k => expected[k] !== undefined && expected[k] !== current[k]);
  const added = Object.keys(current).filter(k => expected[k] === undefined);
  for (const k of changed) console.error(`changed: ${k}`);
  for (const k of added) console.error(`new (not in the manifest): ${k}`);
  if (changed.length || added.length) { console.error(`✗ ${changed.length} changed, ${added.length} new of ${Object.keys(current).length}`); process.exitCode = 1; }
  else console.log(`✓ ${Object.keys(current).length} slides match the manifest`);
}
