// The pure half of the `check --drift --rebuild` cache: what a "this source rebuilds to exactly the committed SVG" verdict depends on,
// and when a stored verdict may be trusted again. The shell (drift-cache.ts at the project root) reads the files and the environment.
//
// A verdict is kept only for a pass. It is keyed by everything known up front (the source, the files it imports, the committed SVGs it was
// compared with, the tool's own code, the configuration, the environment) and carries the files the build was seen to read beyond that
// (images, icon manifests, fonts ...) with their hashes: a hit needs every one of them to be unchanged, so a file the key cannot know about
// still cannot make a stale "no drift" -- it makes a miss.
import crypto from 'node:crypto';
export const DRIFT_CACHE_VERSION = 1;
const sorted = (o) => Object.entries(o).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
export function driftKey(p) {
    const h = crypto.createHash('sha256');
    h.update(JSON.stringify([DRIFT_CACHE_VERSION, p.tool, p.fonts, p.config, p.source, p.sourceSha256, p.depsSha256, sorted(p.committed), p.provenance]));
    return h.digest('hex');
}
export function makeEntry(key, reads, probes) {
    const byPath = (a) => [...new Map(a.map(x => [x.path, x])).values()].sort((x, y) => (x.path < y.path ? -1 : x.path > y.path ? 1 : 0));
    return { version: DRIFT_CACHE_VERSION, key, reads: byPath(reads), probes: byPath(probes) };
}
export function parseEntry(text) {
    try {
        const e = JSON.parse(text);
        if (e.version !== DRIFT_CACHE_VERSION || typeof e.key !== 'string' || !Array.isArray(e.reads) || !Array.isArray(e.probes))
            return null;
        return e;
    }
    catch {
        return null;
    }
}
/** May the stored pass be trusted: the key is the one asked for and nothing the build read has changed since. */
export function entryHolds(entry, key, world) {
    if (!entry || entry.key !== key)
        return false;
    return entry.reads.every(r => world.hashOf(r.path) === r.sha256) && entry.probes.every(p => world.exists(p.path) === p.exists);
}
