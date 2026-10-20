// The pure half of the `check --drift --rebuild` cache: what a "this source rebuilds to exactly the committed SVG" verdict depends on,
// and when a stored verdict may be trusted again. The shell (drift-cache.ts at the project root) reads the files and the environment.
//
// A verdict is kept only for a pass. It is keyed by everything known up front (the source, the files it imports, the committed SVGs it was
// compared with, the tool's own code, the configuration, the environment) and carries the files the build was seen to read beyond that
// (images, icon manifests, fonts ...) with their hashes: a hit needs every one of them to be unchanged, so a file the key cannot know about
// still cannot make a stale "no drift" -- it makes a miss.

import crypto from 'node:crypto';

/** Everything the key covers. Values are strings (hashes) or plain JSON. */
export interface DriftKeyParts {
  /** the tool's code and its dependencies (hash over lib/, the CLI files, package versions, node version) */
  tool: string;
  /** installed fonts and the font-related environment */
  fonts: string;
  /** the resolved .svg-diagram.json, the SVG_DIAGRAM_* variables, the CLI settings that reach the build (--today ...) */
  config: string;
  /** absolute path of the source (the base of relative image / icon paths) */
  source: string;
  sourceSha256: string;
  depsSha256: string;
  /** the committed SVG and its reveal files: name -> sha256 */
  committed: Record<string, string>;
  /** the provenance read from the committed SVG (what the rebuild is made to carry) */
  provenance: string;
}

export const DRIFT_CACHE_VERSION = 1;

const sorted = <T>(o: Record<string, T>): [string, T][] => Object.entries(o).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

export function driftKey(p: DriftKeyParts): string {
  const h = crypto.createHash('sha256');
  h.update(JSON.stringify([DRIFT_CACHE_VERSION, p.tool, p.fonts, p.config, p.source, p.sourceSha256, p.depsSha256, sorted(p.committed), p.provenance]));
  return h.digest('hex');
}

/** A file the build read: its path and the hash of its content (null: it did not exist). */
export interface ReadFile {path: string; sha256: string | null}
/** A path the build asked about without reading it (existsSync) and what it was told. */
export interface Probe {path: string; exists: boolean}
export interface DriftEntry {version: number; key: string; reads: ReadFile[]; probes: Probe[]}

export function makeEntry(key: string, reads: ReadFile[], probes: Probe[]): DriftEntry {
  const byPath = <T extends {path: string}>(a: T[]): T[] => [...new Map(a.map(x => [x.path, x])).values()].sort((x, y) => (x.path < y.path ? -1 : x.path > y.path ? 1 : 0));
  return {version: DRIFT_CACHE_VERSION, key, reads: byPath(reads), probes: byPath(probes)};
}

export function parseEntry(text: string): DriftEntry | null {
  try {
    const e = JSON.parse(text) as Partial<DriftEntry>;
    if (e.version !== DRIFT_CACHE_VERSION || typeof e.key !== 'string' || !Array.isArray(e.reads) || !Array.isArray(e.probes)) return null;
    return e as DriftEntry;
  } catch { return null; }
}

export interface World {
  /** sha256 of the file now, null when it is not there */
  hashOf(path: string): string | null;
  exists(path: string): boolean;
}

/** May the stored pass be trusted: the key is the one asked for and nothing the build read has changed since. */
export function entryHolds(entry: DriftEntry | null, key: string, world: World): boolean {
  if (!entry || entry.key !== key) return false;
  return entry.reads.every(r => world.hashOf(r.path) === r.sha256) && entry.probes.every(p => world.exists(p.path) === p.exists);
}
