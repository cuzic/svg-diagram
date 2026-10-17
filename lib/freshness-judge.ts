// The judgement of ADR 0013 without the disk (ADR 0031 §3): is an SVG still what its source would build, given the provenance in its
// <metadata id="svg-diagram"> and the hashes the shell read from the candidates on disk. lib/freshness.ts does the reading.
import path from 'node:path';
import type {DiagramSource} from './types/core.ts';

/** The provenance embedded in an SVG's text (what build() wrote), or null: no metadata (hand-made, other tool), or not JSON. */
export function parseProvenance(text: string): DiagramSource | null {
  const m = text.match(/<metadata id="svg-diagram">([^<]*)<\/metadata>/);
  if (!m) return null;
  try {
    const j = JSON.parse(m[1].replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&'));
    return j && typeof j === 'object' ? j as DiagramSource : null;
  } catch { return null; }
}

export interface Freshness {
  state: 'fresh' | 'stale' | 'unknown';
  /** stale only: the source itself changed, or a local file it imports. */
  reason?: 'source' | 'deps';
  /** The source that was found (fresh and stale). */
  source?: string;
}

/** A candidate source that exists on disk, with the hash of its content and of the local files it imports. */
export interface Found {source: string; sha: string; depsSha: string}

/**
 * fresh: the source and its imports hash as they did at build time. stale: they differ. unknown: nothing found, so nothing is claimed
 * (a hand-made SVG is never "stale"). The config hash and the tool version are not compared: a tool upgrade must not turn every figure
 * "stale" (`build --stale` and `check --drift --rebuild` do look at them).
 * A same-named file of another project may sit at one candidate: any candidate that hashes as recorded makes the SVG fresh; stale only
 * when every candidate differs (a false alarm is worse than a miss). When none is fresh, a candidate whose source hash matches is the
 * real one: its deps are what to report, not another file's source.
 */
export function judgeFreshness(prov: Pick<DiagramSource, 'sourceSha256' | 'depsSha256'>, found: readonly Found[]): Freshness {
  if (!found.length) return {state: 'unknown'};
  let mismatch: Freshness | null = null, drifted: Freshness | null = null;
  for (const f of found) {
    if (f.sha !== prov.sourceSha256) { mismatch ??= {state: 'stale', reason: 'source', source: f.source}; continue; }
    if ((prov.depsSha256 ?? '') !== f.depsSha) { drifted ??= {state: 'stale', reason: 'deps', source: f.source}; continue; }
    return {state: 'fresh', source: f.source};
  }
  return (drifted ?? mismatch) as Freshness;
}

/** The words for a stale figure (preview, show): what is out of date, and the command that fixes it. */
export function staleNoticeAt(f: Freshness, svgPath: string, cwd: string): {short: string; banner: string; long: string} {
  const src = f.source ? path.relative(cwd, f.source) || f.source : '';
  const what = f.reason === 'deps' ? 'import しているファイルが変わっている' : 'ソースが変わっている';
  return {
    short: `古い: ${what}`,
    banner: `古い: ${f.reason === 'deps' ? 'import 先が変わっています' : 'ソースが変わっています'}`,
    long: `⚠ ${svgPath} は古い: ${what}(${src})。svg-diagram build ${src} で作り直す`,
  };
}
