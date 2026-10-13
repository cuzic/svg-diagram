// Programmatic rendering of a diagram source file — the entry other tools (a Slidev addon, a Vite plugin) import as
// `svg-diagram/render`, so they get an SVG string without shelling out to the CLI.
//
// It does what the CLIs do before they draw: register the `from 'svg-diagram'` resolve hook, import the source's default
// export, apply .svg-diagram.json, then renderDiagram(). Nothing is written to disk. A diagram that fails verification is
// still returned (ok: false, problems) so the caller can decide whether to show it; a define()/layout error throws.
import path from 'node:path';
import {register} from 'node:module';
import {loadConfig} from './config.ts';
import {loadDiagram} from './load-source.ts';
import {depsOf} from './source-deps.ts';
import {findManifest} from './icon-registry.ts';
import {renderDiagram, closeMeasurer} from './dsl.ts';

let hooked = false;
function ensureResolveHook(): void {
  if (hooked) return;
  register(import.meta.url.endsWith('.ts') ? './resolve-hook.ts' : './resolve-hook.js', import.meta.url);
  hooked = true;
}

export interface RenderSourceOptions {
  /** 'cacheOnly' (default) never starts a dev server to measure a slide; 'measure' does, and caches the result. */
  budget?: 'measure' | 'cacheOnly';
  /** Re-read the source, and the local files it imports, even if they were imported before (for watch mode). */
  fresh?: boolean;
  /** Also return the figure as HTML/CSS (`html`), as `svg-diagram build --html` writes it. */
  html?: boolean;
  /** Where to look for .svg-diagram.json (default: the source's directory). */
  configFrom?: string;
}

export interface RenderSourceResult {
  svg: string;
  /** The HTML/CSS fragment (a <style> and a <div class="sd">), when options.html is set. */
  html?: string;
  /** false when verification or the XML check failed — the svg is still the picture that was drawn. */
  ok: boolean;
  problems: string[];
  warnings: string[];
  notes: string[];
  width: number;
  height: number;
  /** The source, the local files it imports, and the settings (.svg-diagram.json, svg-diagram.icons.json) it was drawn with, absolute — what a watcher should rebuild on. */
  deps: string[];
}

export async function renderSource(file: string, opts: RenderSourceOptions = {}): Promise<RenderSourceResult> {
  ensureResolveHook();
  const abs = path.resolve(file);
  const config = loadConfig(opts.configFrom ?? path.dirname(abs));
  const d = await loadDiagram(abs, config, {fresh: opts.fresh});
  const r = await renderDiagram(d, {name: path.basename(abs, path.extname(abs)) + '.svg', budget: opts.budget ?? 'cacheOnly', html: opts.html});
  const problems = [...r.verdict.problems, ...r.xml];
  return {svg: r.svg, ...(r.html !== undefined ? {html: r.html} : {}), ok: problems.length === 0, problems, warnings: r.verdict.warnings, notes: r.notes, width: r.width, height: r.height, deps: [...new Set([abs, ...depsOf(abs).files, ...[config._file, findManifest(path.dirname(abs))].filter((f): f is string => !!f)])]};
}

/** Stops the Chromium that text measurement started. Call once when done (a long-lived dev server may leave it open). */
export {closeMeasurer as close};
