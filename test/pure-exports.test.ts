// ADR 0031 §4: the pure functions of the core, listed from what the modules really export, and a ratchet on the ones no test names.
// The core holds no module-level state (core-purity.test.ts), so a function it exports is pure up to its arguments. The list of the
// functions nothing tests may only shrink: a new export that no test imports fails here until it gets a test (or is knowingly added to
// the fixture); one that has gained a test must leave the fixture.  UPDATE_FIXTURES=1 node --test test/pure-exports.test.ts rewrites it.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {LIB, libFiles, resolveLocal} from './helpers/purity.ts';
import {SHELL} from './helpers/shell.ts';

const FIXTURE = path.resolve(import.meta.dirname, 'fixtures/untested-exports.json');
const core = libFiles().filter(f => !SHELL[f]);

/** The names a source imports from local modules: `import {a, b as c, type D} from './x'`, `export {a} from`, `const {a} = await import('./x')`. */
function importedNames(src: string): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  const add = (spec: string, names: string[]) => { if (!spec.startsWith('.')) return; const set = out.get(spec) ?? new Set<string>(); for (const n of names) set.add(n); out.set(spec, set); };
  const list = (body: string) => body.split(',').map(x => x.trim().replace(/^type\s+/, '')).filter(Boolean).map(x => x.split(/\s+as\s+/)[0].trim()).filter(x => /^[A-Za-z_$][\w$]*$/.test(x));
  for (const m of src.matchAll(/(?:import|export)\s+(?!type\b)\{([^}]*)\}\s*from\s*['"]([^'"]+)['"]/g)) add(m[2], list(m[1]));
  for (const m of src.matchAll(/(?:const|let)\s*\{([^}]*)\}\s*=\s*await\s+import\(\s*['"]([^'"]+)['"]\s*\)/g)) add(m[2], list(m[1]));
  return out;
}

const walkTests = (dir: string): string[] => fs.readdirSync(dir, {withFileTypes: true}).flatMap(e => e.isDirectory() ? (e.name === 'fixtures' ? [] : walkTests(path.join(dir, e.name))) : e.name.endsWith('.ts') ? [path.join(dir, e.name)] : []);

test('every untested pure function is on the ratchet, and nothing on it is tested now', async () => {
  // names a test imports from lib (by name: dsl.ts re-exports the builders, so the module is not told apart)
  const tested = new Set<string>();
  for (const f of walkTests(path.resolve(import.meta.dirname))) {
    for (const [spec, names] of importedNames(fs.readFileSync(f, 'utf8'))) if (/lib\//.test(spec) || /\/lib\.ts$/.test(spec)) for (const n of names) tested.add(n);
  }
  // which module exports are used by another lib file
  const usedBy = new Map<string, Set<string>>();
  for (const f of libFiles()) {
    for (const [spec, names] of importedNames(fs.readFileSync(path.join(LIB, f + '.ts'), 'utf8'))) {
      const target = resolveLocal(f, spec);
      const set = usedBy.get(target) ?? new Set<string>();
      for (const n of names) set.add(n);
      usedBy.set(target, set);
    }
  }
  const untested: string[] = [], unreadable: string[] = [];
  for (const name of core) {
    let mod: Record<string, unknown>;
    try { mod = await import(pathToFileURL(path.join(LIB, name + '.ts')).href); } catch (e) { unreadable.push(`${name}: ${(e as Error).message.split('\n')[0]}`); continue; }
    for (const [key, v] of Object.entries(mod)) {
      if (typeof v !== 'function' || /^class\s/.test(Function.prototype.toString.call(v)) || v.constructor.name === 'AsyncFunction') continue;
      if (!usedBy.get(name)?.has(key)) continue; // an export only the file itself uses is an internal helper
      if (!tested.has(key)) untested.push(`${name}:${key}`);
    }
  }
  untested.sort();
  assert.deepEqual(unreadable, [], 'a core module must load without effects');
  if (process.env.UPDATE_FIXTURES) { fs.writeFileSync(FIXTURE, JSON.stringify(untested, null, 2) + '\n'); return; }
  const known = new Set<string>(JSON.parse(fs.readFileSync(FIXTURE, 'utf8')));
  const now = new Set(untested);
  assert.deepEqual(untested.filter(x => !known.has(x)), [], 'new pure functions that no test names: add a test (UPDATE_FIXTURES=1 only for ones you knowingly leave)');
  assert.deepEqual([...known].filter(x => !now.has(x)), [], 'these are tested now (or gone): remove them from test/fixtures/untested-exports.json (UPDATE_FIXTURES=1)');
});
