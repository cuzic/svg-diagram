import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {test} from 'node:test';
import type {Band} from '../lib/types/index.ts';
import {importsOf, LIB, libFiles, resolveLocal} from './helpers/purity.ts';

const CORE_OWNED = ['caption', 'status', 'legend', 'spacer', 'connect', 'group', 'row'] as const satisfies readonly Band['type'][];
const files = libFiles();
const COMPOSERS = files.filter(file => /^compose\/[^/]+$/.test(file));
const COMPOSER_IMPORTERS = ['dsl-pure', 'dsl', 'web'];

const KNOWN: Readonly<Record<string, string>> = {
  'spec-parts/board': 'U5: import the needed builders directly',
  'spec-parts/r1': 'U5: import the needed builders directly',
  'spec-parts/r2': 'U5: import the needed builders directly',
  'spec-parts/r3': 'U5: import the needed builders directly',
  'spec-parts/r4': 'U5: import the needed builders directly',
  'spec-parts/r5': 'U5: import the needed builders directly',
  'spec-parts/r6': 'U5: import the needed builders directly',
  'spec-parts/r7': 'U5: import the needed builders directly',
};

const isSpecPart = (file: string): boolean => /^spec-parts\/[^/]+$/.test(file);

function composerViolations(root: string, sources: string[]): string[] {
  return sources.flatMap(file => {
    if (COMPOSER_IMPORTERS.includes(file) || isSpecPart(file)) return [];
    return importsOf(path.join(root, file + '.ts')).local
      .map(spec => resolveLocal(file, spec))
      .filter(dep => dep.startsWith('compose/') && file !== `compose/selective/${dep.slice('compose/'.length)}`)
      .map(dep => `${file} → ${dep}`);
  });
}

test('R1: only entry points, spec parts and tests may import composers', () => {
  assert.deepEqual(composerViolations(LIB, files), []);
});

test('R1: the boundary check catches an import from a layout module', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'band-boundaries-'));
  try {
    fs.mkdirSync(path.join(root, 'compose'));
    fs.writeFileSync(path.join(root, 'compose/hero.ts'), 'export const hero = 1;');
    fs.writeFileSync(path.join(root, 'dsl-pure.ts'), "export {hero} from './compose/hero.ts';");
    fs.writeFileSync(path.join(root, 'layout-handlers.ts'), "import './compose/hero.ts';");
    assert.deepEqual(composerViolations(root, libFiles(root)), ['layout-handlers → compose/hero']);
  } finally {
    fs.rmSync(root, {recursive: true});
  }
});

test('R2: spec parts reach the DSL barrel only through the known imports scheduled for U5', () => {
  const actual = files.filter(isSpecPart).filter(file =>
    importsOf(path.join(LIB, file + '.ts')).local.some(spec => resolveLocal(file, spec) === 'dsl-pure'));
  assert.deepEqual(actual.sort(), Object.keys(KNOWN).sort());
});

test('the core-owned types and moved composer modules are accounted for', () => {
  assert.equal(new Set(CORE_OWNED).size, CORE_OWNED.length);
  assert.deepEqual(COMPOSERS.sort(), ['compose/canvas', 'compose/hero', 'compose/icon-row', 'compose/versus']);
  assert.ok(!files.includes('hero'));
  assert.ok(!files.includes('versus'));
});
