// ADR 0080 D2b / D13 S4: a band's own logic lives in its definition (lib/bands/) or in a module that implements that one band. Everything else
// reaches a band through a hook of its definition, so a selective bundle never pulls a band it did not import. This is the ratchet for the
// ones that do not yet: a `.type === '<literal>'` (or `!==`, or a `case '<literal>':` of a `switch (x.type)`) outside lib/bands/ may only
// appear in a file listed below, and never more often than recorded. Counts only go down. Lowering a count is part of the change that
// removes the branch; a file that reaches 0 is removed from the list (the test says so).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {test} from 'node:test';

const LIB = path.resolve(import.meta.dirname, '../lib');

const NOT_BAND = 'not a band type: a Markdown token, mdast node, JSON-Schema type, UI input, drawing primitive or edge kind';
const BAND_MODULE = 'band-specific module: it implements one band or one chart family';
const BUILDER = 'builder or composer: it assembles specific bands by design';
const CORE = 'core-owned band (caption, status, legend, spacer, connect, group, row, grid, box, banner, raw) or the core stack itself';
const DEBT = 'debt: a cross-band branch that should become a band-definition hook (ADR 0080 D2b)';

/** Files outside lib/bands/ that may name a band type, with the most occurrences each may have. */
const ALLOWED: Record<string, {max: number; why: string}> = {
  'axis-comparison.ts': {max: 4, why: BAND_MODULE},
  'band-children.ts': {max: 1, why: CORE},
  'band-def.ts': {max: 1, why: CORE},
  'budget.ts': {max: 5, why: CORE},
  'charts-combo.ts': {max: 16, why: BAND_MODULE},
  'comic/render.ts': {max: 1, why: BAND_MODULE},
  'compose/hero.ts': {max: 1, why: BUILDER},
  'compose/selective/affinity.ts': {max: 4, why: BUILDER},
  'compose/selective/arrow-diagram.ts': {max: 1, why: BUILDER},
  'compose/selective/hero.ts': {max: 2, why: BUILDER},
  'compose/selective/versus.ts': {max: 6, why: BUILDER},
  'compose/selective/why-why-tree.ts': {max: 1, why: BUILDER},
  'core.ts': {max: 4, why: CORE},
  'diagram-description.ts': {max: 8, why: DEBT},
  'diagram-summary.ts': {max: 11, why: DEBT},
  'docs-check.ts': {max: 2, why: BAND_MODULE},
  'dsl/areas.ts': {max: 1, why: BAND_MODULE},
  'dsl/box-children.ts': {max: 1, why: BAND_MODULE},
  'dsl/cause.ts': {max: 1, why: BAND_MODULE},
  'dsl/defaults.ts': {max: 1, why: BAND_MODULE},
  'dsl/facet.ts': {max: 1, why: BAND_MODULE},
  'dsl/fill-scale-limit.ts': {max: 4, why: DEBT},
  'dsl/image.ts': {max: 1, why: BAND_MODULE},
  'dsl/mixed-row.ts': {max: 3, why: BAND_MODULE},
  'dsl/rewrite.ts': {max: 9, why: DEBT},
  'dsl/row.ts': {max: 1, why: BAND_MODULE},
  'dsl/shared.ts': {max: 1, why: BAND_MODULE},
  'dsl/state-matrix.ts': {max: 1, why: BAND_MODULE},
  'dsl/styled.ts': {max: 1, why: BAND_MODULE},
  'dsl/tree.ts': {max: 3, why: BAND_MODULE},
  'dsl/wireframe-numbering.ts': {max: 2, why: BAND_MODULE},
  'emit-box-text.ts': {max: 1, why: CORE},
  'emit-html.ts': {max: 2, why: CORE},
  'figure-definitions.ts': {max: 2, why: CORE},
  'figure-metrics.ts': {max: 4, why: CORE},
  'fit.ts': {max: 1, why: DEBT},
  'flow-shapes.ts': {max: 19, why: BAND_MODULE},
  'html-selective.ts': {max: 2, why: CORE},
  'image-file.ts': {max: 1, why: BAND_MODULE},
  'inventory-boxes.ts': {max: 2, why: CORE},
  'layout-areas-gaps.ts': {max: 2, why: BAND_MODULE},
  'layout-areas.ts': {max: 2, why: BAND_MODULE},
  'layout-box-like.ts': {max: 6, why: CORE},
  'layout-connect-gaps.ts': {max: 13, why: CORE},
  'layout-core.ts': {max: 3, why: CORE},
  'layout-fit-width.ts': {max: 7, why: DEBT},
  'layout-group-row.ts': {max: 2, why: CORE},
  'layout-group.ts': {max: 1, why: CORE},
  'layout-metrics.ts': {max: 10, why: DEBT},
  'layout-util.ts': {max: 1, why: CORE},
  'legacy-core.ts': {max: 19, why: DEBT},
  'legend-notation.ts': {max: 15, why: DEBT},
  'located.ts': {max: 1, why: CORE},
  'locations-map.ts': {max: 9, why: DEBT},
  'markdown-it.ts': {max: 11, why: NOT_BAND},
  'pptx/image-band-core.ts': {max: 1, why: DEBT},
  'pptx/selective.ts': {max: 2, why: DEBT},
  'pptx/svg-shapes.ts': {max: 2, why: NOT_BAND},
  'present/sync.ts': {max: 1, why: NOT_BAND},
  'present/ui.ts': {max: 9, why: NOT_BAND},
  'remark.ts': {max: 2, why: NOT_BAND},
  'semnet-dependency.ts': {max: 2, why: NOT_BAND},
  'spec-parts/swimlane.ts': {max: 1, why: BAND_MODULE},
  'spec-selective.ts': {max: 1, why: DEBT},
  'spec-validation.ts': {max: 12, why: NOT_BAND},
  'spotlight-legend.ts': {max: 3, why: CORE},
  'today-auto.ts': {max: 1, why: BAND_MODULE},
  'verify-bars.ts': {max: 2, why: BAND_MODULE},
  'verify-box-like.ts': {max: 4, why: BAND_MODULE},
  'verify-caption.ts': {max: 1, why: CORE},
  'verify-connect-geometry.ts': {max: 1, why: CORE},
  'verify-connection-graph.ts': {max: 4, why: BAND_MODULE},
  'verify-density.ts': {max: 7, why: BAND_MODULE},
  'verify-edge-bends.ts': {max: 8, why: BAND_MODULE},
  'verify-layout-fit.ts': {max: 10, why: BAND_MODULE},
  'verify-rects.ts': {max: 1, why: CORE},
  'verify-shrink.ts': {max: 1, why: BAND_MODULE},
  'wireframe-layout-core.ts': {max: 1, why: BAND_MODULE},
};

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, {withFileTypes: true}).flatMap(entry => {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'bands' && dir === LIB ? [] : sourceFiles(file);
    return file.endsWith('.ts') && !file.endsWith('.d.ts') ? [file] : [];
  });
}

/** `.type === 'x'`, `.type !== 'x'`, and the `case 'x':` labels of a `switch (….type)` (comment lines are skipped). */
function bandTypeLiterals(source: string): number {
  let count = 0, depth = 0;
  const switches: number[] = [];
  for (const line of source.split('\n')) {
    const text = line.trim();
    if (text.startsWith('//') || text.startsWith('*') || text.startsWith('/*')) continue;
    count += (line.match(/\.type\s*[!=]==\s*'[^']*'/g) ?? []).length;
    if (/switch\s*\([^)]*\.type\)/.test(line)) switches.push(depth);
    if (switches.length) count += (line.match(/case\s+'[^']*'\s*:/g) ?? []).length;
    for (const char of line) {
      if (char === '{') depth++;
      else if (char === '}') {
        depth--;
        if (switches.length && depth <= switches[switches.length - 1]!) switches.pop();
      }
    }
  }
  return count;
}

test('the counter sees comparisons and switch labels, and skips comments', () => {
  assert.equal(bandTypeLiterals("if (b.type === 'box' || c.type !== 'row') {}\n// x.type === 'a'\n"), 2);
  assert.equal(bandTypeLiterals("switch (b.type) {\n  case 'a': case 'b': return 1;\n}\ncase 'c': 0;\n"), 2);
  assert.equal(bandTypeLiterals("switch (kind) { case 'a': return 1; }\n"), 0);
});

test('band type literals outside lib/bands/ stay within the recorded counts (ratchet)', () => {
  const found = new Map<string, number>();
  for (const file of sourceFiles(LIB)) {
    const count = bandTypeLiterals(fs.readFileSync(file, 'utf8'));
    if (count > 0) found.set(path.relative(LIB, file), count);
  }
  const unlisted = [...found].filter(([file]) => !(file in ALLOWED)).map(([file, count]) => `${file} (${count})`);
  assert.deepEqual(unlisted, [], 'a band type literal outside lib/bands/: use a hook of the band definition, or list the file with a reason');
  const over = [...found].filter(([file, count]) => count > ALLOWED[file]!.max).map(([file, count]) => `${file}: ${count} > ${ALLOWED[file]!.max}`);
  assert.deepEqual(over, [], 'more band type literals than recorded');
  const stale = Object.entries(ALLOWED).filter(([file, {max}]) => (found.get(file) ?? 0) < max).map(([file, {max}]) => `${file}: ${found.get(file) ?? 0} < ${max}`);
  assert.deepEqual(stale, [], 'fewer than recorded: lower the max (or remove the file from the list at 0)');
});
