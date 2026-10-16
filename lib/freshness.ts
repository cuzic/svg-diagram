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

const isFile = (f: string) => { try { return fs.statSync(f).isFile(); } catch { return false; } };

/** Every candidate that exists on disk, in search order. */
function existing(prov: DiagramSource, svgPath: string, cwd: string): string[] { return candidates(prov, svgPath, cwd).filter(isFile); }

/** The first source file on disk the SVG may have been built from; null when there is none (then nothing is judged). */
export function locateSource(prov: DiagramSource, {svgPath, cwd = process.cwd()}: {svgPath: string; cwd?: string}): string | null {
  return existing(prov, svgPath, cwd)[0] ?? null;
}

/** sha256 hex of a string or buffer: the one hash definition build, check and freshness share. */
export function sha256(data: string | Buffer): string { return crypto.createHash('sha256').update(data).digest('hex'); }
export function sha256File(file: string): string { return sha256(fs.readFileSync(file)); }

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
  try {
    const prov = readProvenance(svgPath);
    if (!prov || typeof prov.sourceSha256 !== 'string') return {state: 'unknown'};
    const found = existing(prov, svgPath, cwd);
    if (!found.length) return {state: 'unknown'};
    // a same-named file of another project may sit at one candidate: any candidate that hashes as recorded makes the SVG fresh;
    // stale only when every candidate that exists differs (a false alarm is worse than a miss)
    // when none is fresh, a candidate whose source hash matches is the real one: its deps are what to report, not another file's source
    let mismatch: Freshness | null = null, drifted: Freshness | null = null;
    for (const source of found) {
      if (sha256File(source) !== prov.sourceSha256) { mismatch ??= {state: 'stale', reason: 'source', source}; continue; }
      if ((prov.depsSha256 ?? '') !== depsSha256(source)) { drifted ??= {state: 'stale', reason: 'deps', source}; continue; }
      return {state: 'fresh', source};
    }
    return (drifted ?? mismatch) as Freshness;
  } catch { return {state: 'unknown'}; } // unreadable source, a failing import scan: no claim, and preview / show go on drawing
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
