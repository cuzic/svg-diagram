// ADR 0007 §4: the core of rendering (layout, verify, emit, ...) does no I/O. A listed file may not reach — through static
// or dynamic imports, transitively — anything that touches the filesystem, a process, a browser or a font file, and may not
// read process.env. Type-only imports are erased and do not count. Shell files (measure.ts, layout-measured.ts, dsl.ts, the
// CLIs) are where those effects live.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const LIB = path.resolve(import.meta.dirname, '../lib');
// emit-html.ts is not here: it reads font metrics (font-metrics.ts → textBox) while it draws.
const CORE = ['atoms', 'bars', 'emit', 'fit', 'layout', 'plane', 'reveal', 'rich', 'rules', 'seq-table', 'spotlight', 'tokens', 'types', 'verify', 'wrap', 'wireframe'];
const FORBIDDEN = /^(node:)?(fs|fs\/promises|child_process|net|http|https|os|worker_threads|crypto|process|module|vm|dns|tty|readline|zlib)$|^playwright|^@resvg|^harfbuzzjs|^sixel$/;

function importsOf(file: string): {local: string[]; external: string[]; usesEnv: boolean} {
  // line comments first: a `/*` inside `// lib/*.ts` must not open a block comment
  const src = fs.readFileSync(file, 'utf8').replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  const local: string[] = [], external: string[] = [];
  const add = (spec: string) => (spec.startsWith('.') ? local : external).push(spec);
  for (const m of src.matchAll(/^\s*(import|export)\s+(?!type\b)[^;'"]*?from\s+['"]([^'"]+)['"]/gm)) add(m[2]);
  for (const m of src.matchAll(/^\s*import\s+['"]([^'"]+)['"]/gm)) add(m[1]);
  for (const m of src.matchAll(/\bimport\(\s*['"]([^'"]+)['"]\s*\)/g)) add(m[1]);
  return {local, external, usesEnv: /\bprocess\b(?!\s*:)/.test(src)};
}

test('the rendering core reaches no I/O (transitive imports, process.*)', () => {
  const problems: string[] = [];
  for (const name of CORE) {
    const seen = new Set<string>();
    const walk = (file: string, via: string[]): void => {
      if (seen.has(file)) return;
      seen.add(file);
      const {local, external, usesEnv} = importsOf(file);
      const chain = [...via, path.basename(file)].join(' → ');
      for (const e of external) if (FORBIDDEN.test(e)) problems.push(`${name}: ${chain} imports '${e}'`);
      if (usesEnv) problems.push(`${name}: ${chain} uses process.*`);
      for (const l of local) walk(path.resolve(path.dirname(file), l.replace(/\.js$/, '.ts')), [...via, path.basename(file)]);
    };
    walk(path.join(LIB, name + '.ts'), []);
  }
  assert.deepEqual(problems, []);
});

// ADR 0007 §1: the core draws with the roles of the layout (LaidOutDiagram.roles), never with the global table, which holds
// the unscaled sizes — reading it there measures at the scaled size and draws at 1x again.
test('the rendering core does not import the global ROLES table', () => {
  const offenders = CORE.filter(n => n !== 'tokens').filter(n => {
    const src = fs.readFileSync(path.join(LIB, n + '.ts'), 'utf8');
    return /import\s*\{[^}]*\bROLES\b[^}]*\}\s*from\s*['"]\.\/tokens/.test(src);
  });
  assert.deepEqual(offenders, []);
});
