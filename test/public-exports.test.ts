import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {test} from 'node:test';
import {API} from 'typescript/unstable/sync';

const root = path.resolve(import.meta.dirname, '..');
const entries = ['lib/dsl.ts', 'lib/dsl-pure.ts', 'lib/web.ts'];
const fixture = new URL('./fixtures/public-exports.json', import.meta.url);

test('the public entry points preserve their export names, including types', () => {
  const api = new API({cwd: root});
  try {
    const config = path.join(root, 'tsconfig.json');
    const snapshot = api.updateSnapshot({openProjects: [config]});
    const project = snapshot.getProject(config);
    assert.ok(project);
    const actual = Object.fromEntries(entries.map(entry => {
      const source = project.program.getSourceFile(path.join(root, entry));
      assert.ok(source, entry);
      const symbol = project.checker.getSymbolAtLocation(source);
      assert.ok(symbol, entry);
      return [entry, project.checker.getExportsOfModule(symbol).map(exp => exp.name).sort()];
    }));
    if (process.env['UPDATE_FIXTURES'] === '1') writeFileSync(fixture, JSON.stringify(actual, null, 2) + '\n');
    assert.deepEqual(actual, JSON.parse(readFileSync(fixture, 'utf8')));
  } finally {
    api.close();
  }
});
