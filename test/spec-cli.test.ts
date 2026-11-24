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

test('spec CLI renders captions and automatic legends with just the requested spec part', async () => {
  const {causeTreePart} = await import('../lib/spec-parts/selective/cause-tree.ts');
  const {renderSpec} = await import('../lib/spec-render.ts');
  const dir = mkdtempSync(path.join(tmpdir(), 'svg-spec-cli-caption-'));
  try {
    const input = {
      version: 1, title: '検討結果', desc: '原因を比較する', showTitle: true, sourceLine: '会議資料',
      legend: 'auto', parts: [causeTreePart.example],
    };
    const pathToSpec = path.join(dir, 'cause.json');
    writeFileSync(pathToSpec, JSON.stringify(input));
    const hook = `import {registerHooks} from "node:module";
      registerHooks({resolve(specifier, context, next) {
        const result = next(specifier, context);
        const path = new URL(result.url).pathname;
        if (path.includes('/spec-parts/selective/') && !path.endsWith('/cause-tree.ts')) {
          throw new Error("Unexpected spec part: " + path);
        }
        if (['/lib/spec.ts', '/lib/web.ts', '/lib/raster.ts'].some(file => path.endsWith(file))) {
          throw new Error("Unexpected compatibility entry: " + path);
        }
        return result;
      }});`;
    const rendered = spawnSync(process.execPath, ['--import', 'data:text/javascript,' + encodeURIComponent(hook),
      cli, pathToSpec, '--part', 'cause-tree'], {cwd: dir, encoding: 'utf8'});
    const legacy = await renderSpec(input, {config: {measure: 'font'}});
    assert.ok(legacy.svg);
    assert.equal(rendered.status, legacy.ok ? 0 : 1, rendered.stderr);
    assert.equal(rendered.stdout, legacy.svg);
    assert.match(rendered.stdout, />検討結果<\/text>/);
    assert.match(rendered.stdout, /会議資料/);
    assert.match(rendered.stdout, />根本原因<\/text>/);
  } finally {
    rmSync(dir, {recursive: true, force: true});
  }
});
