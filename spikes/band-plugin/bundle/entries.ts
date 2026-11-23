// node spikes/band-plugin/bundle/entries.ts — size of each package entry today (esbuild, browser, minified) and what heavy dependencies it reaches.
import fs from 'node:fs';
import path from 'node:path';
import {bundle, kb, modules} from './measure.ts';

const ROOT = path.resolve(import.meta.dirname, '../../..');
const lines: string[] = [];
const rep = (s: string): void => { lines.push(s); console.log(s); };
const ENTRIES: Record<string, string> = {'.': 'lib/dsl.ts', './browser': 'lib/web.ts', './spec': 'lib/spec.ts', './spec/edge': 'lib/spec-edge.ts', './pptx/edge': 'lib/pptx-edge.ts', './pptx/deck/edge': 'lib/pptx-deck-edge.ts', './render': 'lib/render-source.ts', './markdown': 'lib/markdown.ts'};
const HEAVY = ['harfbuzzjs', 'resvg', 'sixel', 'mathjax', 'playwright', 'jszip', 'fflate', 'node:'];
for (const [name, file] of Object.entries(ENTRIES)) {
  try {
    // node builtins and native packages are external, so the number is "the library's own code"; their names are listed
    const code = `export * from '${ROOT}/${file}';`;
    const {build} = await import('esbuild');
    const entry = path.join(ROOT, 'spikes/band-plugin/out', '.entry.ts');
    fs.writeFileSync(entry, code);
    const r = await build({entryPoints: [entry], bundle: true, write: false, minify: true, format: 'esm', platform: 'node', metafile: true, logLevel: 'silent', outdir: path.dirname(entry), external: ['node:*', '@resvg/resvg-js', 'harfbuzzjs', 'harfbuzzjs/*', 'sixel', 'mathjax-full', 'mathjax-full/*', 'playwright-chromium']});
    fs.rmSync(entry);
    const out = Object.values(r.metafile.outputs)[0]!;
    const ext = [...new Set(out.imports.filter(i => i.external).map(i => i.path))];
    const own = out.bytes;
    rep(`${name.padEnd(18)} ${kb(own).padStart(10)} (own code, deps external)  externals: ${ext.join(', ') || '-'}  modules: ${Object.keys(out.inputs).length}`);
  } catch (e) { rep(`${name.padEnd(18)} ERR ${(e as Error).message.split('\n')[0]!.slice(0, 120)}`); }
}
void bundle; void modules; void HEAVY;
fs.writeFileSync(path.join(import.meta.dirname, '../out/entries-today.txt'), lines.join('\n') + '\n');
