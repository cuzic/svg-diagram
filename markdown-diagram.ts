#!/usr/bin/env node
// svg-diagram md <page.md> [--out FILE] [--svg-dir DIR (default: svg/ beside the output)] [--inline | --html] [--root DIR] — draw the diagrams a Markdown page points at.
// `![alt](./flow.diagram.ts)` (an image whose target is a diagram source) becomes `![alt](svg/flow.svg)`, with the SVG written
// next to it; `--inline` puts the <svg> into the Markdown instead, `--html` the figure as HTML/CSS (`build --html`). The result is plain Markdown any renderer reads.
import fs from 'node:fs';
import path from 'node:path';
const {expandMarkdown} = await import('./lib/markdown.ts');
const {close} = await import('./lib/render-source.ts');

const args = process.argv.slice(2);
const opt = (name: string): string | undefined => { const i = args.indexOf(name); if (i < 0) return undefined; const [, v] = args.splice(i, 2); if (v === undefined || v.startsWith('--')) { console.error(`✗ ${name} needs a value`); process.exit(2); } return v; };
const flag = (name: string): boolean => { const i = args.indexOf(name); if (i < 0) return false; args.splice(i, 1); return true; };
const out = opt('--out');
const svgDirOpt = opt('--svg-dir');
const rootOpt = opt('--root');
const html = flag('--html');
const inline = flag('--inline') || html;
const file = args[0];
if (!file || args.length !== 1 || file.startsWith('--')) { console.error('Usage: svg-diagram md <page.md> [--out FILE] [--svg-dir DIR] [--inline | --html] [--root DIR]'); process.exit(2); }

if (!out && !inline) { console.error('✗ without --out the SVG files would be written into the working folder and the Markdown to stdout: give --out FILE (or use --inline / --html)'); process.exit(2); }
const base = out ? path.dirname(path.resolve(out)) : process.cwd();
const svgAbs = svgDirOpt ? path.resolve(svgDirOpt) : path.join(base, 'svg');
const r = await expandMarkdown(fs.readFileSync(file, 'utf8'), {
  file: path.resolve(file),
  mode: inline ? 'inline' : 'file',
  render: html ? 'html' : 'svg',
  root: rootOpt ? path.resolve(rootOpt) : undefined,
  // Image targets are relative to wherever the Markdown ends up (--out's folder, or the working folder for stdout).
  svgDir: path.relative(base, svgAbs).split(path.sep).join('/') || '.',
}).finally(() => close());

for (const n of r.notes) console.error(`! ${n}`);
for (const p of r.problems) console.error(`✗ ${p}`);
for (const f of r.figures) for (const w of f.warnings) console.error(`! ${path.basename(f.source)}: ${w}`);
if (r.problems.length) { console.error(`✗ ${r.problems.length} problem(s) — nothing written`); process.exit(1); }

if (!inline || r.notes.length) {
  fs.mkdirSync(svgAbs, {recursive: true});
  for (const f of r.figures) fs.writeFileSync(path.join(svgAbs, f.name), f.svg);
}
if (out) fs.writeFileSync(out, r.markdown); else process.stdout.write(r.markdown);
