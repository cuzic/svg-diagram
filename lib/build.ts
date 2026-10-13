// build(): render a diagram and write it to disk, then lint the file. The only part of the library that writes files or starts a
// process (ADR 0007 §4), so it lives apart from the builder in dsl.ts, which re-exports build.
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {emitSvg} from './emit.ts';
import {renderDiagram} from './render-diagram.ts';
import type {BuildResult, Diagram, RenderResult} from './types.ts';

// Lays out, verifies, renders, writes, and lints a diagram in one call.
// build(d, 'public/svg/day2-11-example.svg')
//
// Two verification layers, in order:
//   1. verifyDiagram() — pure-geometry checks on the laid-out tree, before
//      any SVG exists. Catches sibling/neighbor overlap, canvas-bounds
//      overflow, and low-contrast tone pairs in milliseconds, with no
//      Chromium render involved. This is the primary check.
//   2. lint-svg.ts --strict — a real Playwright render of the finished
//      file. Slower, but it's the only thing that can see what raw()
//      actually drew (verifyDiagram only checks raw()'s self-reported
//      x/y/w/h against its neighbors) and catches real-font-rendering
//      discrepancies verifyDiagram's measured-atom approximation can't.
// opts.name: the SVG's published name when outPath is a scratch file (it keys the slide-budget cache). opts.lint: false skips the per-file lint-svg.ts run (it starts its own Chromium), for callers that lint many
// files in one go afterwards (build-diagram.ts). Default true.
export async function build(d: Diagram, outPath: string, opts: {lint?: boolean; name?: string; html?: boolean} = {}): Promise<BuildResult> {
  const r = await renderDiagram(d, {name: opts.name ?? path.basename(outPath), budget: 'measure', html: opts.html});
  return finishBuild(r, outPath, opts.lint ?? true);
}

async function finishBuild(r: RenderResult, outPath: string, lint: boolean): Promise<BuildResult> {
  const {verdict} = r;
  if (!verdict.ok) {
    throw new Error(`build(${outPath}): layout verification failed before any SVG was written:\n  ${verdict.problems.join('\n  ')}`);
  }
  if (r.xml.length) throw new Error(`build(${outPath}): the emitted SVG is not well-formed XML (an <img> would fail to load it):\n  ${r.xml.join('\n  ')}`);
  fs.mkdirSync(path.dirname(outPath), {recursive: true});
  fs.writeFileSync(outPath, r.svg);
  let htmlPath: string | undefined;
  if (r.html !== undefined) {
    htmlPath = outPath.replace(/\.svg$/, '') + '.html';
    fs.writeFileSync(htmlPath, r.html);
  }
  const revealPaths: string[] = [];
  if (r.laidOut.maxReveal) {
    const ext = path.extname(outPath), stem = outPath.slice(0, -ext.length);
    for (let stage = 0; stage <= r.laidOut.maxReveal; stage++) {
      const revealPath = `${stem}.reveal${stage}${ext}`;
      fs.writeFileSync(revealPath, emitSvg(r.laidOut, {reveal: stage}));
      revealPaths.push(revealPath);
    }
  }
  const ext = path.extname(outPath), stem = outPath.slice(0, -ext.length);
  for (const name of fs.readdirSync(path.dirname(outPath))) {
    const m = new RegExp(`^${path.basename(stem).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\.reveal(\\d+)${ext.replace('.', '\\.')}$$`).exec(name);
    if (m && (!r.laidOut.maxReveal || Number(m[1]) > r.laidOut.maxReveal)) fs.rmSync(path.join(path.dirname(outPath), name));
  }

  const lintScript = path.resolve(import.meta.dirname, '..', import.meta.url.endsWith('.ts') ? 'lint-svg.ts' : 'lint-svg.js');
  if (lint) try {
    execFileSync('node', [lintScript, outPath, '--strict'], {encoding: 'utf8'});
  } catch (err) {
    const e = err as {stdout?: string; stderr?: string};
    const out = (e.stdout || '') + (e.stderr || '');
    throw new Error(`build(${outPath}) produced an SVG that fails lint-svg.ts --strict:\n${out}`);
  }
  return {outPath, ...(htmlPath ? {htmlPath} : {}), revealPaths, width: r.width, height: r.height, fit: r.fit, budget: r.budget, fontScale: r.fontScale, warnings: verdict.warnings, findings: verdict.findings};
}
