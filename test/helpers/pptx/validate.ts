#!/usr/bin/env node
// Schema check of every example's slide against the ECMA-376 transitional schemas (pml.xsd) -- the PowerPoint-free half of "no repair prompt".
//   node test/helpers/pptx/validate.ts [--fetch] examples/*.ts      (--fetch downloads the schemas into .cache/ooxml-xsd/ first)
import path from 'node:path';
import {register} from 'node:module';
import {loadConfig} from '../../../lib/config.ts';
import {loadDiagram} from '../../../lib/load-source.ts';
import {renderDiagram} from '../../../lib/dsl/render.ts';
import {closeMeasurer} from '../../../lib/measure.ts';
import {planSlide, fontsOf} from '../../../lib/pptx/slide.ts';
import {fetchXsd, hasXsd, hasXmllint, slideSchemaProblems} from './xsd.ts';

register(new URL('../../../lib/resolve-hook.ts', import.meta.url));
process.env.SVG_DIAGRAM_STRICT_WIDTH = '1';

const args = process.argv.slice(2), sources = args.filter(a => !a.startsWith('--'));
if (!sources.length) { console.error('usage: node test/helpers/pptx/validate.ts [--fetch] <source.ts>...'); process.exit(2); }
if (!hasXmllint()) { console.error('✗ xmllint is not installed'); process.exit(2); }
if (args.includes('--fetch') || !hasXsd()) await fetchXsd();

let bad = 0;
try {
  for (const source of sources) {
    const abs = path.resolve(source);
    const rendered = await renderDiagram(await loadDiagram(abs, loadConfig(path.dirname(abs))), {name: path.basename(abs, '.ts') + '.svg', budget: 'cacheOnly'});
    const problems = slideSchemaProblems(planSlide(rendered.laidOut, fontsOf()).xml);
    if (problems.length) { bad++; console.error(`✗ ${source}\n  ${problems.join('\n  ')}`); }
  }
} finally { await closeMeasurer(); }
if (bad) { console.error(`✗ ${bad} of ${sources.length} slides break the schema`); process.exitCode = 1; }
else console.log(`✓ ${sources.length} slides validate against pml.xsd`);
