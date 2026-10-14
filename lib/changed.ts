// `svg-diagram check --changed`: which of the given sources need checking after these files changed.
// A source is selected when it, a local file it imports, or its committed SVG is among the changed files;
// a changed project config (.svg-diagram.json) can change every diagram's verdict, so it selects them all.
import path from 'node:path';
import {localDeps} from './source-deps.ts';

export interface ChangedOpts {
  /** Absolute paths of the files that changed (git diff + untracked). */
  changed: ReadonlySet<string>;
  /** The committed SVG of a source (--drift), if the caller looks at it. */
  svgOf?: (source: string) => string | undefined;
  /** Swappable for tests. */
  depsOf?: (source: string) => string[];
}

export function selectChanged(sources: readonly string[], {changed, svgOf, depsOf = localDeps}: ChangedOpts): {selected: string[]; skipped: string[]; reason: Map<string, string>} {
  const reason = new Map<string, string>();
  const configChanged = [...changed].find(f => path.basename(f) === '.svg-diagram.json');
  for (const s of sources) {
    const abs = path.resolve(s);
    if (configChanged) { reason.set(s, `${path.basename(configChanged)} が変わった`); continue; }
    if (changed.has(abs)) { reason.set(s, '自身が変わった'); continue; }
    const dep = depsOf(abs).find(d => changed.has(d));
    if (dep) { reason.set(s, `import している ${path.relative(path.dirname(abs), dep)} が変わった`); continue; }
    const svg = svgOf?.(s);
    if (svg && changed.has(path.resolve(svg))) reason.set(s, `${svg} が変わった`);
  }
  return {selected: sources.filter(s => reason.has(s)), skipped: sources.filter(s => !reason.has(s)), reason};
}
