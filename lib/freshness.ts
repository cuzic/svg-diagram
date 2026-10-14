// Is an SVG still what its source would build? (ADR 0013)
// Read from the SVG's own <metadata id="svg-diagram"> (lib/emit.ts): which source, and the hashes of that source and of the
// local files it imports. Shared by `build` (failure notice), `check --drift`, `preview` and `show`. I/O lives here, so this is
// a shell file, not part of the rendering core.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import type {DiagramSource} from './types/core.ts';
import {depsSha256} from './source-deps.ts';

/** The provenance embedded in an SVG (what build() wrote), or null: no metadata (hand-made, other tool), unreadable, or not JSON. */
export function readProvenance(svgPath: string): DiagramSource | null {
  let text: string;
  try { text = fs.readFileSync(svgPath, 'utf8'); } catch { return null; }
  const m = text.match(/<metadata id="svg-diagram">([^<]*)<\/metadata>/);
  if (!m) return null;
  try {
    const j = JSON.parse(m[1].replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&'));
    return j && typeof j === 'object' ? j as DiagramSource : null;
  } catch { return null; }
}

/** Where `source` (relative to the cwd of the build) may be: the cwd, the parent of the SVG's directory, the directory of .svg-diagram.json. */
function candidates(prov: DiagramSource, svgPath: string, cwd: string): string[] {
  const rel = prov.source;
  if (!rel) return [];
  const svgDir = path.dirname(path.resolve(cwd, svgPath));
  const list = [path.resolve(cwd, rel), path.resolve(svgDir, '..', rel)];
  for (let dir = svgDir; ; dir = path.dirname(dir)) { // the nearest .svg-diagram.json going up from the SVG
    if (fs.existsSync(path.join(dir, '.svg-diagram.json'))) { list.push(path.resolve(dir, rel)); break; }
    if (path.dirname(dir) === dir) break;
  }
  return [...new Set(list)];
}

/** The source file an SVG was built from, found on disk; null when it cannot be found (then nothing is judged). */
export function locateSource(prov: DiagramSource, {svgPath, cwd = process.cwd()}: {svgPath: string; cwd?: string}): string | null {
  return candidates(prov, svgPath, cwd).find(f => { try { return fs.statSync(f).isFile(); } catch { return false; } }) ?? null;
}

export interface Freshness {
  state: 'fresh' | 'stale' | 'unknown';
  /** stale only: the source itself changed, or a local file it imports. */
  reason?: 'source' | 'deps';
  /** The source that was found (fresh and stale). */
  source?: string;
}

/**
 * fresh: the source and its imports hash as they did at build time. stale: they differ. unknown: no metadata or the source
 * cannot be found, so nothing is claimed (a hand-made SVG is never "stale"). The config hash and the tool version are not
 * compared: a tool upgrade must not turn every figure "stale" (`build --stale` and `check --drift --rebuild` do look at them).
 */
export function freshness(svgPath: string, cwd: string = process.cwd()): Freshness {
  const prov = readProvenance(svgPath);
  if (!prov || typeof prov.sourceSha256 !== 'string') return {state: 'unknown'};
  const source = locateSource(prov, {svgPath, cwd});
  if (!source) return {state: 'unknown'};
  if (crypto.createHash('sha256').update(fs.readFileSync(source)).digest('hex') !== prov.sourceSha256) return {state: 'stale', reason: 'source', source};
  if ((prov.depsSha256 ?? '') !== depsSha256(source)) return {state: 'stale', reason: 'deps', source};
  return {state: 'fresh', source};
}

/** Did this SVG come from `sourcePath`? By the embedded source path only (the hash of a failed build never matches). */
export function ownsOutput(svgPath: string, sourcePath: string, cwd: string = process.cwd()): boolean {
  const prov = readProvenance(svgPath);
  if (!prov) return false;
  const want = path.resolve(cwd, sourcePath);
  return candidates(prov, svgPath, cwd).some(f => f === want);
}

/** The words for a stale figure (preview, show): what is out of date, and the command that fixes it. */
export function staleNotice(f: Freshness, svgPath: string, cwd: string = process.cwd()): {short: string; banner: string; long: string} {
  const src = f.source ? path.relative(cwd, f.source) || f.source : '';
  const what = f.reason === 'deps' ? 'import しているファイルが変わっている' : 'ソースが変わっている';
  return {
    short: `古い: ${what}`,
    banner: `古い: ${f.reason === 'deps' ? 'import 先が変わっています' : 'ソースが変わっています'}`,
    long: `⚠ ${svgPath} は古い: ${what}(${src})。svg-diagram build ${src} で作り直す`,
  };
}
