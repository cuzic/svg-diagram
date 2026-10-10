// The local files a diagram source imports (relative specifiers, followed recursively), and one hash over them.
// Read statically — no module is executed — so `check --drift` can use it without a browser or a build.
// Bare specifiers ('svg-diagram', packages) and anything under node_modules are not followed.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const SPEC = /(?:\bfrom\s*|\bimport\s*\(?\s*|\bimport\s+)(['"])(\.{1,2}\/[^'"\n]*|\.{1,2})\1/g;
const EXTS = ['', '.ts', '.mts', '.js', '.mjs', '.tsx', '.json'];
// per process: a build of many sources that share parts reads each file once
const fileCache = new Map();
function read(f) {
    if (!fileCache.has(f)) {
        let src = null;
        try {
            src = fs.readFileSync(f, 'utf8');
        }
        catch { /* unreadable */ }
        fileCache.set(f, src === null ? null : { src, imports: /\.json$/.test(f) ? [] : [...src.matchAll(SPEC)].map(m => m[2]), dynamic: /\bimport\s*\(\s*[^'"\s)]/.test(src) });
    }
    return fileCache.get(f) ?? null;
}
function resolveLocal(from, spec) {
    const base = path.resolve(path.dirname(from), spec);
    const bases = [base];
    const js = base.match(/^(.*)\.(m?)js$/); // './x.js' written in TS source means './x.ts'
    if (js)
        bases.push(`${js[1]}.${js[2]}ts`);
    for (const b of bases) {
        for (const e of EXTS)
            if (fs.existsSync(b + e) && fs.statSync(b + e).isFile())
                return b + e;
        for (const e of EXTS.slice(1))
            if (fs.existsSync(path.join(b, 'index' + e)))
                return path.join(b, 'index' + e);
    }
    return null;
}
/** Absolute paths of the local files `entry` imports, directly or not (not including `entry`), sorted. */
export function localDeps(entry) { return depsOf(entry).files; }
/** The imported local files, and the files whose imports this scan cannot follow (an import() built from a variable). */
export function depsOf(entry) {
    const seen = new Set(), unfollowable = [];
    const todo = [path.resolve(entry)];
    while (todo.length) {
        const f = todo.pop();
        const info = read(f);
        if (!info)
            continue;
        if (info.dynamic)
            unfollowable.push(f);
        for (const spec of info.imports) {
            const r = resolveLocal(f, spec);
            if (r && !r.includes(`${path.sep}node_modules${path.sep}`) && r !== path.resolve(entry) && !seen.has(r)) {
                seen.add(r);
                todo.push(r);
            }
        }
    }
    return { files: [...seen].sort(), unfollowable: unfollowable.sort() };
}
/** sha256 over the imported files' contents (named relative to the source, so moving the project keeps it); '' when there are none. */
export function depsSha256(entry) {
    const deps = localDeps(entry);
    if (!deps.length)
        return '';
    const h = crypto.createHash('sha256');
    for (const d of deps)
        h.update(`${path.relative(path.dirname(path.resolve(entry)), d)}\0`).update(read(d)?.src ?? '').update('\0');
    return h.digest('hex');
}
