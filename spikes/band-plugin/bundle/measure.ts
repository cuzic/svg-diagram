// ADR 0080 spike (round 3): what do today's browser bundles contain, and why. node spikes/band-plugin/bundle/measure.ts
// Bundles with esbuild (minify, esm, browser, no externals), reads the metafile, and reports size, gzip, the heaviest modules, and the import chain
// that drags a band the entry never asked for (e.g. bowtie.ts into a comic-only bundle). Entries are written to a temp dir outside the repo.
import {build, type Metafile} from 'esbuild';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';

const ROOT = path.resolve(import.meta.dirname, '../../..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bundle-'));
const rel = (p: string): string => path.relative(ROOT, p);
export const kb = (n: number): string => `${(n / 1024).toFixed(1)} KB`;

export async function bundle(name: string, code: string, opts: {treeShaking?: boolean; plugins?: never[]} = {}): Promise<{bytes: number; gz: number; meta: Metafile; out: string}> {
  const entry = path.join(tmp, `${name}.ts`);
  fs.writeFileSync(entry, code);
  const r = await build({entryPoints: [entry], bundle: true, write: false, minify: true, format: 'esm', platform: 'browser', metafile: true, logLevel: 'silent', outdir: tmp, absWorkingDir: ROOT, treeShaking: opts.treeShaking ?? true, mainFields: ['module', 'main']});
  const out = r.outputFiles[0]!.text;
  return {bytes: Buffer.byteLength(out), gz: zlib.gzipSync(out).length, meta: r.metafile, out};
}

/** bytesInOutput per source module (rolled up by file), biggest first. */
export function modules(meta: Metafile): {file: string; bytes: number}[] {
  const outp = Object.values(meta.outputs)[0]!;
  return Object.entries(outp.inputs).map(([file, v]) => ({file, bytes: v.bytesInOutput})).filter(x => x.bytes > 0).sort((a, b) => b.bytes - a.bytes);
}

/** The shortest import chain from the entry to `target` (module names), from the metafile's import graph. */
export function chain(meta: Metafile, target: string): string[] | undefined {
  const entry = Object.keys(meta.inputs).find(k => k.includes('/bundle-') || k.startsWith('..') || path.isAbsolute(k)) ?? '';
  const start = Object.keys(meta.inputs).find(k => meta.inputs[k]!.imports.length > 0 && /bundle-[^/]+\/[^/]+\.ts$/.test(k)) ?? entry;
  const prev = new Map<string, string>(), q = [start]; prev.set(start, '');
  while (q.length) {
    const cur = q.shift()!;
    if (cur.endsWith(target)) { const p: string[] = []; for (let c: string | undefined = cur; c; c = prev.get(c)) p.unshift(c); return p; }
    for (const i of meta.inputs[cur]?.imports ?? []) if (!prev.has(i.path) && meta.inputs[i.path]) { prev.set(i.path, cur); q.push(i.path); }
  }
  return undefined;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const lines: string[] = [];
  const rep = (s: string): void => { lines.push(s); console.log(s); };
  const entries: Record<string, string> = {
    'all-in-one (lib/web.ts)': `export * from '${ROOT}/lib/web.ts';`,
    'renderComic + svgMeasurer': `export {renderComic} from '${ROOT}/lib/comic/render.ts'; export {svgMeasurer} from '${ROOT}/lib/web-measure.ts';`,
    'box + row + diagram + renderInBrowser': `export {box, row, diagram, renderInBrowser} from '${ROOT}/lib/web.ts'; export {svgMeasurer} from '${ROOT}/lib/web-measure.ts';`,
    'svgMeasurer only': `export {svgMeasurer} from '${ROOT}/lib/web-measure.ts';`,
  };
  const BANDS = ['bowtie', 'fta', 'gantt', 'bpmn', 'classes', 'states', 'wireframe', 'sequence', 'timeline', 'tree', 'charts', 'quadrant', 'flow-shapes', 'cause', 'toc', 'comic', 'plane', 'wordart', 'people', 'swimlane', 'bars', 'seq-table', 'image'];
  for (const [name, code] of Object.entries(entries)) {
    const b = await bundle(name.replace(/\W+/g, '-'), code);
    rep(`\n## ${name}: ${kb(b.bytes)} minified, ${kb(b.gz)} gzip`);
    const mods = modules(b.meta);
    const total = mods.reduce((s, m) => s + m.bytes, 0);
    rep(`   modules in the bundle: ${mods.length}; top 12 by bytes:`);
    for (const m of mods.slice(0, 12)) rep(`     ${kb(m.bytes).padStart(9)}  ${m.file.replace(/^.*node_modules\//, 'node_modules/')}`);
    const present = BANDS.filter(bn => mods.some(m => new RegExp(`lib/(${bn}|emit-${bn}|${bn}-)[\\w-]*\\.ts$|lib/${bn}/`).test(m.file)));
    rep(`   band modules present: ${present.join(', ')}`);
    rep(`   core-ish share (lib/*.ts not band files): ${kb(total)} total`);
  }
  const comic = await bundle('comic-chain', entries['renderComic + svgMeasurer']!);
  for (const t of ['lib/bowtie.ts', 'lib/fta.ts', 'lib/gantt.ts', 'lib/charts.ts', 'lib/layout-handlers.ts', 'lib/emit-handlers.ts']) {
    const c = chain(comic.meta, t);
    rep(`\nchain to ${t} in the comic-only bundle: ${c ? c.map(rel).map(s => s.replace(/^.*\/(lib\/)/, '$1').replace(/^.*bundle-[^ ]*\.ts$/, '<entry>')).join(' -> ') : '(not present)'}`);
  }
  fs.writeFileSync(path.join(import.meta.dirname, '../out/bundle-today.txt'), lines.join('\n') + '\n');
}
