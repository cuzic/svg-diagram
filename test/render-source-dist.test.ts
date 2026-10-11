// What a package consumer gets: the compiled dist/ (tsc -p tsconfig.build.json), where `svg-diagram/render` is plain .js and the
// resolve hook is lib/resolve-hook.js — a different path from running the .ts sources. Compiles into a temp directory and
// renders an example from a separate process.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const ROOT = path.resolve(import.meta.dirname, '..');
const tsc = path.join(ROOT, 'node_modules', '.bin', 'tsc');

test('the compiled svg-diagram/render renders a source that imports "svg-diagram", in a fresh process', {timeout: 180_000}, async (t) => {
  if (!fs.existsSync(tsc)) return t.skip('no tsc');
  const dist = fs.mkdtempSync(path.join(os.tmpdir(), 'svg-diagram-dist-'));
  try {
    const c = spawnSync(tsc, ['-p', 'tsconfig.build.json', '--outDir', dist], {cwd: ROOT, encoding: 'utf8'});
    assert.equal(c.status, 0, c.stdout + c.stderr);
    for (const f of ['lib/render-source.js', 'lib/render-source.d.ts', 'lib/resolve-hook.js', 'lib/font-metrics.js', 'lib/dsl.js']) {
      assert.ok(fs.existsSync(path.join(dist, f)), `${f} missing from the build`);
    }
    // the compiled files import harfbuzzjs; they find it through the repo's node_modules
    fs.symlinkSync(path.join(ROOT, 'node_modules'), path.join(dist, 'node_modules'));
    fs.copyFileSync(path.join(ROOT, 'package.json'), path.join(dist, 'package.json'));
    const script = path.join(dist, 'run.mjs');
    fs.writeFileSync(script, `
      import {renderSource, close} from './lib/render-source.js';
      const r = await renderSource(process.argv[2], {fresh: true});
      await close();
      process.stdout.write(JSON.stringify({ok: r.ok, width: r.width, height: r.height, deps: r.deps, head: r.svg.slice(0, 5)}));
    `);
    const example = path.join(ROOT, 'examples', 'inventory-flow.ts');
    const run = spawnSync(process.execPath, [script, example], {cwd: dist, encoding: 'utf8', env: {...process.env, PLAYWRIGHT_BROWSERS_PATH: '/nonexistent', SVG_DIAGRAM_MEASURE: ''}});
    assert.equal(run.status, 0, run.stdout + run.stderr);
    const out = JSON.parse(run.stdout);
    assert.deepEqual({ok: out.ok, head: out.head, width: out.width}, {ok: true, head: '<svg ', width: 940});
    assert.ok(out.height > 0);
    assert.equal(out.deps[0], example);
  } finally { fs.rmSync(dist, {recursive: true, force: true}); }
});
