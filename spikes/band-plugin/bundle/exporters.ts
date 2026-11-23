// node spikes/band-plugin/bundle/exporters.ts — (1) the size of each exporter / heavy backend ALONE (esbuild, node platform, deps external),
// (2) what in the package entry "." pulls each of them in (import chains), (3) where each exporter dispatches on the band type centrally today.
import {build, type Metafile} from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import {kb} from './measure.ts';

const ROOT = path.resolve(import.meta.dirname, '../../..');
const lines: string[] = [];
const rep = (s: string): void => { lines.push(s); console.log(s); };
const EXT = ['node:*', '@resvg/resvg-js', 'harfbuzzjs', 'harfbuzzjs/*', 'sixel', 'mathjax-full', 'mathjax-full/*', 'playwright-chromium'];
const tmp = path.join(ROOT, 'spikes/band-plugin/out');
async function size(code: string, platform: 'node' | 'browser' = 'node'): Promise<{bytes: number; meta: Metafile; ext: string[]}> {
  const entry = path.join(tmp, '.e.ts'); fs.writeFileSync(entry, code);
  const r = await build({entryPoints: [entry], bundle: true, write: false, minify: true, format: 'esm', platform, metafile: true, logLevel: 'silent', outdir: tmp, external: EXT});
  fs.rmSync(entry);
  const o = Object.values(r.metafile.outputs)[0]!;
  return {bytes: o.bytes, meta: r.metafile, ext: [...new Set(o.imports.filter(i => i.external).map(i => i.path))]};
}
const bytesOf = (meta: Metafile, re: RegExp): number => Object.entries(Object.values(meta.outputs)[0]!.inputs).filter(([f]) => re.test(f)).reduce((s, [, v]) => s + v.bytesInOutput, 0);
const entryOf = (meta: Metafile): string => Object.keys(meta.inputs).find(k => /\.e\.ts$/.test(k))!;
function chain(meta: Metafile, re: RegExp): string[] | undefined {
  const start = entryOf(meta), prev = new Map<string, string>([[start, '']]), q = [start];
  while (q.length) { const c = q.shift()!; if (re.test(c) && c !== start) { const p: string[] = []; for (let x: string | undefined = c; x; x = prev.get(x)) p.unshift(x); return p; } for (const i of meta.inputs[c]?.imports ?? []) if (!prev.has(i.path) && meta.inputs[i.path]) { prev.set(i.path, c); q.push(i.path); } }
  return undefined;
}
const short = (s: string): string => s.replace(/^.*\/(lib\/)/, '$1').replace(/^.*\.e\.ts$/, '<entry>');

rep('## each exporter / heavy backend alone (own code; dependencies external)');
const ALONE: [string, string, 'node' | 'browser'][] = [
  ['PPTX single (lib/pptx/emit.ts)', 'lib/pptx/emit.ts', 'node'], ['PPTX edge (./pptx/edge)', 'lib/pptx-edge.ts', 'node'], ['PPTX deck edge', 'lib/pptx-deck-edge.ts', 'node'],
  ['HTML emit (lib/emit-html.ts)', 'lib/emit-html.ts', 'node'], ['deck HTML (lib/deck-html.ts)', 'lib/deck-html.ts', 'node'],
  ['Node measurer (lib/measure.ts, HarfBuzz)', 'lib/measure.ts', 'node'], ['browser measurer (lib/web-measure.ts)', 'lib/web-measure.ts', 'browser'],
  ['PNG (lib/raster.ts, resvg)', 'lib/raster.ts', 'node'], ['font subset (lib/font-subset.ts)', 'lib/font-subset.ts', 'node'], ['font box (lib/font-box.ts)', 'lib/font-box.ts', 'node'],
  ['SVG emit alone (lib/emit.ts)', 'lib/emit.ts', 'browser'], ['layout alone (lib/layout.ts)', 'lib/layout.ts', 'browser'], ['verify (lib/verify.ts)', 'lib/verify.ts', 'browser'], ['rules (lib/rules.ts)', 'lib/rules.ts', 'browser'],
  ['spec (lib/spec.ts)', 'lib/spec.ts', 'browser'],
];
for (const [name, file, plat] of ALONE) {
  try { const r = await size(`export * from '${ROOT}/${file}';`, plat); rep(`${name.padEnd(42)} ${kb(r.bytes).padStart(10)}   externals: ${r.ext.join(', ') || '-'}`); }
  catch (e) { rep(`${name.padEnd(42)} ERR ${(e as Error).message.split('\n')[0]!.slice(0, 100)}`); }
}

rep('\n## what the package entry "." (lib/dsl.ts) contains and why');
const dsl = await size(`export * from '${ROOT}/lib/dsl.ts';`);
const PARTS: [string, RegExp][] = [['pptx', /lib\/pptx/], ['html', /emit-html|deck-html|svg-to-css/], ['node measurer', /lib\/measure\.ts|measure-settings|font-metrics|font-box|font-subset/], ['png', /raster\.ts/], ['spec', /lib\/spec/], ['markdown/vitepress', /markdown|remark|vitepress/], ['present/deck', /lib\/present|deck-/]];
rep(`total ${kb(dsl.bytes)}; externals: ${dsl.ext.join(', ')}`);
for (const [n, re] of PARTS) { const b = bytesOf(dsl.meta, re); const c = chain(dsl.meta, re); rep(`  ${n.padEnd(20)} ${kb(b).padStart(9)}  via: ${c ? c.map(short).join(' -> ') : '(not present)'}`); }

rep('\n## where each exporter dispatches on the band type today');
const grep = (f: string, pat: RegExp): string => { const t = fs.readFileSync(path.join(ROOT, f), 'utf8').split('\n'); const hit = t.map((l, i) => [i + 1, l] as const).filter(([, l]) => pat.test(l)); return `${f}: ${hit.length} sites` + (hit[0] ? ` (first :${hit[0][0]})` : ''); };
for (const f of fs.readdirSync(path.join(ROOT, 'lib/pptx')).filter(x => x.endsWith('.ts'))) { const s = grep(`lib/pptx/${f}`, /\.type === '|case '|BAND_HANDLERS|\[band\.type\]/); if (!s.includes(': 0 sites')) rep(`  ${s}`); }
rep(`  ${grep('lib/emit-html.ts', /\.type === '|case '|kindOf/)}`);
rep(`  ${grep('lib/pptx-edge.ts', /\.type === '|case '/)}`);
fs.writeFileSync(path.join(import.meta.dirname, '../out/exporters-today.txt'), lines.join('\n') + '\n');
