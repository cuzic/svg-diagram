// Reading a diagram source (a .ts whose default export builds a diagram()) into a Diagram — the one place the CLIs
// (build, check, notes, show) do it, so a change to how a source is loaded lands in all of them.
//
// This is not in dsl.ts on purpose: dsl.ts is the module a diagram source imports (`from 'svg-diagram'`), and a loader
// that imports sources does not belong in that public surface. The caller still registers lib/resolve-hook first (each
// CLI entry does), because that hook has to be in place before the first source is imported.
import {pathToFileURL} from 'node:url';
import type {Config, Diagram} from './types.ts';
import {applyConfig, loadConfig} from './config.ts';

/** `abs`'s default export, or an error that says what a source should export. */
export async function importDefine(abs: string, opts: {fresh?: boolean} = {}): Promise<() => Diagram> {
  // fresh: a query makes the loader treat the entry as a new module, so a watcher re-reads an edited source (its own imports stay cached)
  const mod = await import(pathToFileURL(abs).href + (opts.fresh ? `?v=${Date.now()}` : ''));
  if (typeof mod.default !== 'function') throw new Error(`${abs}: no default export function — export default function define() { return diagram(...) }`);
  return mod.default;
}

/** Import `abs`, run its define(), and apply the project's .svg-diagram.json (accepted rules, max width). */
export async function loadDiagram(abs: string, config: Config = loadConfig(), opts: {fresh?: boolean} = {}): Promise<Diagram> {
  return applyConfig((await importDefine(abs, opts))(), config);
}
