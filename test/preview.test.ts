// `preview` and `show <file.svg>`: an SVG older than its source is warned about (ADR 0013), judged by the hashes in its metadata.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {rasterize, staleBannerSvg} from '../lib/raster.ts';
import {closeMeasurer} from '../lib/measure.ts';

test.after(() => closeMeasurer());

const BIN = path.resolve(import.meta.dirname, '..', 'bin', 'svg-diagram');
const run = (cwd: string, ...args: string[]) => spawnSync(BIN, args, {cwd, encoding: 'utf8'});
const sha = (s: string) => crypto.createHash('sha256').update(s).digest('hex');
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const BODY = '<rect width="200" height="100" fill="#ffffff"/><rect x="20" y="40" width="60" height="30" fill="#1f5fa8"/>';
const svgWith = (meta: object | null) => `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100" viewBox="0 0 200 100">${meta ? `<metadata id="svg-diagram">${esc(JSON.stringify(meta))}</metadata>` : ''}${BODY}</svg>`;

function project(sourceText = 'export default () => 1;\n') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'preview-'));
  fs.mkdirSync(path.join(dir, 'src')); fs.mkdirSync(path.join(dir, 'svg'));
  fs.writeFileSync(path.join(dir, 'src/a.ts'), sourceText);
  fs.writeFileSync(path.join(dir, 'svg/a.svg'), svgWith({source: 'src/a.ts', sourceSha256: sha(sourceText)}));
  return dir;
}
const png = (dir: string, name: string) => fs.readFileSync(path.join(dir, name));

test('staleBannerSvg: a red band across the top edge, the rest of the picture unchanged', async () => {
  const plain = await rasterize(svgWith(null), {png: true});
  const banner = await rasterize(staleBannerSvg(svgWith(null), '古い'), {png: true});
  const px = (r: typeof plain, x: number, y: number) => [...r.rgba.subarray((y * r.width + x) * 4, (y * r.width + x) * 4 + 4)];
  assert.deepEqual(px(plain, 150, 3), [255, 255, 255, 255]);
  assert.deepEqual(px(banner, 150, 3), [0xc0, 0x39, 0x2b, 255], 'top edge is the band colour');
  assert.deepEqual(px(banner, 50, 60), px(plain, 50, 60), 'below the band the figure is as it was');
  assert.equal(staleBannerSvg('<p>not an svg</p>', 'x'), '<p>not an svg</p>');
});

test('preview: an up-to-date SVG has no warning and no band; a hand-made one (no metadata) is never judged', () => {
  const dir = project();
  const fresh = run(dir, 'preview', 'svg/a.svg', 'fresh.png', '1');
  assert.equal(fresh.status, 0, fresh.stderr);
  assert.doesNotMatch(fresh.stdout + fresh.stderr, /古い/);
  fs.writeFileSync(path.join(dir, 'svg/hand.svg'), svgWith(null));
  fs.writeFileSync(path.join(dir, 'src/a.ts'), 'changed\n'); // irrelevant to a hand-made SVG
  const hand = run(dir, 'preview', 'svg/hand.svg', 'hand.png', '1', '--require-fresh');
  assert.equal(hand.status, 0, hand.stderr);
  assert.doesNotMatch(hand.stdout + hand.stderr, /古い/);
  assert.deepEqual(png(dir, 'hand.png'), png(dir, 'fresh.png'));
});

test('preview: once the source changes it warns on stdout and stderr and draws a band; the exit code stays 0', () => {
  const dir = project();
  assert.equal(run(dir, 'preview', 'svg/a.svg', 'fresh.png', '1').status, 0);
  fs.writeFileSync(path.join(dir, 'src/a.ts'), 'export default () => 2;\n');
  const r = run(dir, 'preview', 'svg/a.svg', 'stale.png', '1');
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /wrote stale\.png \(200x100\) \(古い: ソースが変わっている\)/);
  assert.match(r.stderr, /svg\/a\.svg は古い.*svg-diagram build src\/a\.ts/);
  assert.notDeepEqual(png(dir, 'stale.png'), png(dir, 'fresh.png'), 'the PNG carries the band');
  assert.equal(fs.readFileSync(path.join(dir, 'svg/a.svg'), 'utf8').includes('stale-banner'), false, 'the SVG file itself is not touched');
});

test('preview: --no-stale-banner keeps the warning but draws no band; --require-fresh exits 1', () => {
  const dir = project();
  assert.equal(run(dir, 'preview', 'svg/a.svg', 'fresh.png', '1').status, 0);
  fs.writeFileSync(path.join(dir, 'src/a.ts'), 'export default () => 2;\n');
  const nb = run(dir, 'preview', 'svg/a.svg', 'nb.png', '1', '--no-stale-banner');
  assert.equal(nb.status, 0);
  assert.match(nb.stderr, /古い/);
  assert.deepEqual(png(dir, 'nb.png'), png(dir, 'fresh.png'));
  const req = run(dir, 'preview', 'svg/a.svg', 'req.png', '1', '--require-fresh');
  assert.equal(req.status, 1);
  assert.ok(fs.existsSync(path.join(dir, 'req.png')), 'the picture is still written');
});

test('preview: a changed import is stale too; --gray still works with the band', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'preview-'));
  fs.mkdirSync(path.join(dir, 'src')); fs.mkdirSync(path.join(dir, 'svg'));
  fs.writeFileSync(path.join(dir, 'src/part.ts'), 'export const x = 1;\n');
  const text = `import {x} from './part.ts';\nexport default () => x;\n`;
  fs.writeFileSync(path.join(dir, 'src/a.ts'), text);
  fs.writeFileSync(path.join(dir, 'svg/a.svg'), svgWith({source: 'src/a.ts', sourceSha256: sha(text), depsSha256: 'recorded-before-the-change'}));
  const r = run(dir, 'preview', 'svg/a.svg', 'g.png', '1', '--gray');
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /import しているファイルが変わっている/);
  assert.equal(run(dir, 'preview', 'svg/a.svg', 'gn.png', '1', '--gray', '--no-stale-banner').status, 0);
  assert.notDeepEqual(png(dir, 'g.png'), png(dir, 'gn.png'), 'the band is on the grayscale PNG too');
});

test('show <file.svg> --png: warns on stderr, puts the band on the PNG, --require-fresh exits 1; an unknown option is still refused', () => {
  const dir = project();
  const ok = run(dir, 'show', 'svg/a.svg', '--png', 'fresh.png');
  assert.equal(ok.status, 0, ok.stderr);
  assert.doesNotMatch(ok.stderr, /古い/);
  fs.writeFileSync(path.join(dir, 'src/a.ts'), 'export default () => 2;\n');
  const r = run(dir, 'show', 'svg/a.svg', '--png', 'stale.png');
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stderr, /svg\/a\.svg は古い/);
  assert.notDeepEqual(png(dir, 'stale.png'), png(dir, 'fresh.png'));
  assert.equal(run(dir, 'show', 'svg/a.svg', '--png', 'req.png', '--require-fresh').status, 1);
  assert.equal(run(dir, 'show', 'svg/a.svg', '--png', 'x.png', '--no-such').status, 2);
});

test('staleBannerSvg: the band follows the drawn size (big viewBox drawn small, tiny viewBox), never the whole picture', async () => {
  const draw = async (vbW: number, vbH: number, w: number, h: number) => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${vbW} ${vbH}"><rect width="${vbW}" height="${vbH}" fill="#ffffff"/></svg>`;
    const r = await rasterize(staleBannerSvg(svg, '古い'), {png: true});
    let red = 0;
    for (let y = 0; y < r.height; y++) if (r.rgba[(y * r.width + r.width - 1) * 4 + 1] < 100) red++;
    return {red, height: r.height};
  };
  const big = await draw(4000, 1000, 400, 100);
  assert.ok(big.red >= 15 && big.red <= 25, `about 22px of 100, got ${big.red}`);
  const tiny = await draw(40, 10, 40, 10);
  assert.ok(tiny.red <= 3 && tiny.red >= 1, `a quarter of 10px at most, got ${tiny.red}`);
});

test('preview: the same-named source of another project in the cwd does not make a fresh SVG stale; if every candidate differs it is stale', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'preview-two-'));
  const a = path.join(root, 'A'), b = path.join(root, 'B');
  for (const d of [a, b]) fs.mkdirSync(path.join(d, 'src'), {recursive: true});
  fs.mkdirSync(path.join(a, 'svg'));
  const text = 'export default () => "A";\n';
  fs.writeFileSync(path.join(a, 'src/a.ts'), text);
  fs.writeFileSync(path.join(b, 'src/a.ts'), 'export default () => "B, something else";\n');
  fs.writeFileSync(path.join(a, 'svg/a.svg'), svgWith({source: 'src/a.ts', sourceSha256: sha(text)}));
  const r = run(b, 'preview', '../A/svg/a.svg', 'x.png', '1', '--require-fresh');
  assert.equal(r.status, 0, r.stderr);
  assert.doesNotMatch(r.stdout + r.stderr, /古い/);
  fs.writeFileSync(path.join(a, 'src/a.ts'), 'export default () => "A edited";\n');
  assert.equal(run(b, 'preview', '../A/svg/a.svg', 'x.png', '1', '--require-fresh').status, 1);
});
