// Programmatic rendering of a diagram source file — the entry other tools (a Slidev addon, a Vite plugin) import as
// `svg-diagram/render`, so they get an SVG string without shelling out to the CLI.
//
// It does what the CLIs do before they draw: register the `from 'svg-diagram'` resolve hook, import the source's default
// export, apply .svg-diagram.json, then renderDiagram(). Nothing is written to disk. A diagram that fails verification is
// still returned (ok: false, problems) so the caller can decide whether to show it; a define()/layout error throws.
import path from 'node:path';
import { installResolveHook } from './resolve-hook.js';
import { loadConfig } from './config.js';
import { loadDiagram } from './load-source.js';
import { depsOf } from './source-deps.js';
import { findManifest } from './icon-registry.js';
import { renderDiagram } from './dsl/render.js';
import { closeMeasurer } from './measure.js';
let hooked = false;
function ensureResolveHook() {
    if (hooked)
        return;
    installResolveHook();
    hooked = true;
}
export async function renderSource(file, opts = {}) {
    ensureResolveHook();
    const abs = path.resolve(file);
    const config = loadConfig(opts.configFrom ?? path.dirname(abs));
    const d = await loadDiagram(abs, config, { fresh: opts.fresh });
    if (opts.noSourceLine)
        d.sourceLine = undefined; // d is this call's own Diagram (define() ran just now)
    const r = await renderDiagram(d, { name: path.basename(abs, path.extname(abs)) + '.svg', budget: opts.budget ?? 'cacheOnly', html: opts.html });
    const problems = [...r.verdict.problems, ...r.xml];
    return { svg: r.svg, ...(r.html !== undefined ? { html: r.html } : {}), ok: problems.length === 0, problems, warnings: r.verdict.warnings, notes: r.notes, width: r.width, height: r.height, deps: [...new Set([abs, ...depsOf(abs).files, ...[config._file, findManifest(path.dirname(abs))].filter((f) => !!f)])] };
}
/** Stops the Chromium that text measurement started. Call once when done (a long-lived dev server may leave it open). */
export { closeMeasurer as close };
