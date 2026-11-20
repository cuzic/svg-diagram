// Is an SVG still what its source would build? (ADR 0013)
// Read from the SVG's own <metadata id="svg-diagram"> (lib/emit.ts): which source, and the hashes of that source and of the
// local files it imports. Shared by `build` (failure notice), `check --drift`, `preview` and `show`. I/O lives here, so this is
// a shell file, not part of the rendering core.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { depsSha256 } from './source-deps.js';
import { judgeFreshness, parseProvenance, staleNoticeAt } from './freshness-judge.js';
/** The words for a stale figure (preview, show): what is out of date, and the command that fixes it. */
export const staleNotice = (f, svgPath, cwd = process.cwd()) => staleNoticeAt(f, svgPath, cwd);
/** The provenance embedded in an SVG (what build() wrote), or null: no metadata (hand-made, other tool), unreadable, or not JSON. */
export function readProvenance(svgPath) {
    let text;
    try {
        text = fs.readFileSync(svgPath, 'utf8');
    }
    catch {
        return null;
    }
    return parseProvenance(text);
}
/** Where `source` (relative to the cwd of the build) may be: the cwd, the parent of the SVG's directory, the directory of .svg-diagram.json. */
function candidates(prov, svgPath, cwd) {
    const rel = prov.source;
    if (!rel)
        return [];
    const svgDir = path.dirname(path.resolve(cwd, svgPath));
    const list = [path.resolve(cwd, rel), path.resolve(svgDir, '..', rel)];
    for (let dir = svgDir;; dir = path.dirname(dir)) { // the nearest .svg-diagram.json going up from the SVG
        if (fs.existsSync(path.join(dir, '.svg-diagram.json'))) {
            list.push(path.resolve(dir, rel));
            break;
        }
        if (path.dirname(dir) === dir)
            break;
    }
    return [...new Set(list)];
}
const isFile = (f) => { try {
    return fs.statSync(f).isFile();
}
catch {
    return false;
} };
/** Every candidate that exists on disk, in search order. */
function existing(prov, svgPath, cwd) { return candidates(prov, svgPath, cwd).filter(isFile); }
/** The first source file on disk the SVG may have been built from; null when there is none (then nothing is judged). */
export function locateSource(prov, { svgPath, cwd = process.cwd() }) {
    return existing(prov, svgPath, cwd)[0] ?? null;
}
/** sha256 hex of a string or buffer: the one hash definition build, check and freshness share. */
export function sha256(data) { return crypto.createHash('sha256').update(data).digest('hex'); }
export function sha256File(file) { return sha256(fs.readFileSync(file)); }
/** Is the SVG still what its source would build? Reads the candidates and hashes them; the judgement is judgeFreshness(). unknown on any read failure. */
export function freshness(svgPath, cwd = process.cwd()) {
    try {
        const prov = readProvenance(svgPath);
        if (!prov || typeof prov.sourceSha256 !== 'string')
            return { state: 'unknown' };
        return judgeFreshness(prov, existing(prov, svgPath, cwd).map(source => ({ source, sha: sha256File(source), depsSha: depsSha256(source) })));
    }
    catch {
        return { state: 'unknown' };
    } // unreadable source, a failing import scan: no claim, and preview / show go on drawing
}
/** Did this SVG come from `sourcePath`? By the embedded source path only (the hash of a failed build never matches). */
export function ownsOutput(svgPath, sourcePath, cwd = process.cwd()) {
    const prov = readProvenance(svgPath);
    if (!prov)
        return false;
    const want = path.resolve(cwd, sourcePath);
    return candidates(prov, svgPath, cwd).some(f => f === want);
}
