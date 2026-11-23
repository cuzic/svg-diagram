// node spikes/band-plugin/bundle/shaking.ts — does `sideEffects: false` + per-entry files give REAL tree shaking, with esbuild and with Rollup (via Vite)?
// Compiles lib/ and the BandDef prototype to plain ESM JS in a temp package (outside the repo), then bundles small consumers that import ONE band:
//   A. barrel re-exporting every band, no sideEffects field   B. same barrel, "sideEffects": false   C. direct per-band entry (no barrel)
//   D. a registry style (each band file registers itself on import) + "sideEffects": false          E. TODAY's code: only `renderComic` from lib/web.ts
import {build as esbuild, transform} from 'esbuild';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {kb} from './measure.ts';

const ROOT = path.resolve(import.meta.dirname, '../../..');
const lines: string[] = [];
const rep = (s: string): void => { lines.push(s); console.log(s); };
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'shake-'));

async function compileAll(pkg: string, sideEffects: boolean | undefined): Promise<void> {
  fs.rmSync(pkg, {recursive: true, force: true});
  const files: string[] = [];
  const walk = (d: string): void => { for (const e of fs.readdirSync(d, {withFileTypes: true})) { const p = path.join(d, e.name); if (e.isDirectory()) { if (!['out', 'bundle', 'node_modules'].includes(e.name)) walk(p); } else if (p.endsWith('.ts') && !p.endsWith('.check.ts')) files.push(p); } };
  walk(path.join(ROOT, 'lib')); walk(path.join(ROOT, 'spikes/band-plugin/banddef'));
  for (const f of files) {
    const rel = path.relative(ROOT, f).replace(/^spikes\/band-plugin\//, '').replace(/\.ts$/, '.js');
    const out = (await transform(fs.readFileSync(f, 'utf8'), {loader: 'ts', format: 'esm', target: 'es2023'})).code.replace(/(from\s*|import\s*\(\s*|import\s*)(["'])(\.{1,2}\/[^"']+)\.ts\2/g, '$1$2$3.js$2').replaceAll('../../../lib/', '../lib/');
    const o = path.join(pkg, rel); fs.mkdirSync(path.dirname(o), {recursive: true}); fs.writeFileSync(o, out);
  }
  fs.writeFileSync(path.join(pkg, 'package.json'), JSON.stringify({name: 'shake-pkg', type: 'module', ...(sideEffects === undefined ? {} : {sideEffects})}));
}
const sample = `{type: 'box', title: 'x'}`;
async function sizes(pkg: string, label: string, consumer: string): Promise<void> {
  const entry = path.join(pkg, `consumer-${label.replace(/\W+/g, '')}.js`); fs.writeFileSync(entry, consumer);
  const e = await esbuild({entryPoints: [entry], bundle: true, write: false, minify: true, format: 'esm', platform: 'browser', logLevel: 'silent', outdir: pkg}).then(r => r.outputFiles[0]!.contents.length, () => -1);
  let v = -1;
  try {
    const req = createRequire(import.meta.url);
    const viteDir = fs.readdirSync(path.join(ROOT, 'node_modules/.pnpm')).find(d => d.startsWith('vite@'))!;
    const vite = await import(pathToFileURL(path.join(ROOT, 'node_modules/.pnpm', viteDir, 'node_modules/vite/dist/node/index.js')).href);
    const r = await vite.build({root: pkg, logLevel: 'silent', configFile: false, build: {write: false, minify: 'esbuild', lib: {entry, formats: ['es'], fileName: 'x'}, rollupOptions: {}}});
    const out = (Array.isArray(r) ? r[0] : r).output[0].code as string; v = Buffer.byteLength(out);
  } catch (err) { v = -2; rep(`   (vite failed: ${(err as Error).message.slice(0, 120)})`); }
  rep(`${label.padEnd(58)} esbuild ${e < 0 ? 'ERR' : kb(e).padStart(10)}   rollup/vite ${v < 0 ? 'ERR' : kb(v).padStart(10)}`);
}

const pkgA = path.join(tmp, 'a'), pkgB = path.join(tmp, 'b');
await compileAll(pkgA, undefined); await compileAll(pkgB, false);
const barrel = `export {renderMini} from './mini-core.js'; export {box} from './box.js'; export {comic} from './comic.js';\n`;
for (const p of [pkgA, pkgB]) fs.writeFileSync(path.join(p, 'banddef/index.js'), barrel);
const use = (from: string) => `import {renderMini, box} from '${from}'; export const f = () => renderMini([box(${sample})], {measure: () => ({w: 1, h: 1})});`;
rep('## consumer imports ONE band (box) + the pipeline. Bundle sizes (minified):');
await sizes(pkgA, 'A. barrel (all bands), no sideEffects field', use('./banddef/index.js'));
await sizes(pkgB, 'B. barrel (all bands), sideEffects: false', use('./banddef/index.js'));
await sizes(pkgB, 'C. direct per-band entries (no barrel), sideEffects: false', `import {renderMini} from './banddef/mini-core.js'; import {box} from './banddef/box.js'; export const f = () => renderMini([box(${sample})], {measure: () => ({w: 1, h: 1})});`);
await sizes(pkgA, 'C2. direct per-band entries (no barrel), no sideEffects field', `import {renderMini} from './banddef/mini-core.js'; import {box} from './banddef/box.js'; export const f = () => renderMini([box(${sample})], {measure: () => ({w: 1, h: 1})});`);
await sizes(pkgB, 'F. direct per-band entries: ONE comic (not box), sideEffects: false', `import {renderMini} from './banddef/mini-core.js'; import {comic} from './banddef/comic.js'; import {sheet} from './banddef/sheet.js'; export const f = () => renderMini([comic(sheet)], {measure: () => ({w: 1, h: 1})});`);
await sizes(pkgB, 'G. direct entries: box + comic, sideEffects: false', `import {renderMini} from './banddef/mini-core.js'; import {box} from './banddef/box.js'; import {comic} from './banddef/comic.js'; import {sheet} from './banddef/sheet.js'; export const f = () => renderMini([box(${sample}), comic(sheet)], {measure: () => ({w: 1, h: 1})});`);
// D: registry style: importing a band file registers it as a side effect
for (const [p, label] of [[pkgA, 'no sideEffects field'], [pkgB, 'sideEffects: false']] as const) {
  fs.writeFileSync(path.join(p, 'banddef/registry.js'), `export const registry = new Map();\n`);
  for (const n of ['box', 'comic']) fs.writeFileSync(path.join(p, `banddef/reg-${n}.js`), `import {registry} from './registry.js'; import {${n}Def} from './${n}.js'; registry.set('${n}', ${n}Def);\n`);
  fs.writeFileSync(path.join(p, 'banddef/reg-index.js'), `import './reg-box.js'; import './reg-comic.js'; export {registry} from './registry.js'; export {renderMini} from './mini-core.js'; export {box} from './box.js';\n`);
  await sizes(p, `D. registry style (all register on import), ${label}`, `import {renderMini, box, registry} from './banddef/reg-index.js'; export const f = () => [registry.size, renderMini([box(${sample})], {measure: () => ({w: 1, h: 1})})];`);
}
// E: today's code
await sizes(pkgB, "E. TODAY: renderComic from lib/web.ts's neighbours, sideEffects: false", `export {renderComic} from './lib/comic/render.js';`);
await sizes(pkgA, "E2. TODAY: renderComic, no sideEffects field", `export {renderComic} from './lib/comic/render.js';`);
fs.writeFileSync(path.join(import.meta.dirname, '../out/shaking.txt'), lines.join('\n') + '\n');
fs.rmSync(tmp, {recursive: true, force: true});
