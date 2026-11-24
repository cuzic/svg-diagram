import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import test from 'node:test';

const cli = path.resolve(import.meta.dirname, '../spec-diagram.ts');

test('spec CLI loads only selected parts and writes SVG to stdout', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'svg-spec-cli-'));
  try {
    writeFileSync(path.join(dir, 'table.json'), JSON.stringify({version: 1, title: '比較', desc: '比較表', parts: [
      {type: 'table', columns: [{label: 'Review'}], rows: [['Done']]},
    ]}));
    const hook = 'import {registerHooks} from "node:module"; registerHooks({resolve(specifier, context, next) {'
      + 'const resolved = next(specifier, context);'
      + 'if (/(?:spec-parts\\/selective\\/(?!table\\.ts)|\\/lib\\/(?:spec|web|raster)\\.ts)/.test(resolved.url)) throw Error(resolved.url);'
      + 'return resolved; }});';
    const run = (...args: string[]) => spawnSync(process.execPath, ['--import', 'data:text/javascript,' + encodeURIComponent(hook), cli, ...args], {cwd: dir, encoding: 'utf8'});
    const rendered = run('table.json', '--part', 'table');
    assert.equal(rendered.status, 0, rendered.stderr);
    assert.match(rendered.stdout, /^<svg\b/);
    assert.match(rendered.stdout, />Review<\/text>/);
    writeFileSync(path.join(dir, 'pyramid.json'), JSON.stringify({version: 1, title: 'Example', parts: [
      {type: 'pyramid', layers: ['Start', 'Finish']},
    ]}));
    const unavailable = run('pyramid.json', '--part', 'table');
    assert.equal(unavailable.status, 1, unavailable.stderr);
    assert.equal(unavailable.stdout, '');
    assert.match(unavailable.stderr, /parts\[0\]/);
    const forbidden = run('table.json', '--part', '../table');
    assert.equal(forbidden.status, 2);
    assert.equal(forbidden.stdout, '');
    assert.match(forbidden.stderr, /\.\.\/table/);
  } finally {
    rmSync(dir, {recursive: true, force: true});
  }
});
