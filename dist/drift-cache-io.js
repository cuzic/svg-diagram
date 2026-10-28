// The shell of the `check --drift --rebuild` cache (the pure half is lib/drift-cache.ts): reads the files and the environment the key covers,
// records which files a build reads, and keeps one small JSON entry per source. See ADR 0038 (docs/adr) for the reasoning.
import fs from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { depsOf, depsSha256 } from './lib/source-deps.js';
import { driftKey, entryHolds, makeEntry, parseEntry } from './lib/drift-cache.js';
const ROOT = import.meta.dirname;
const sha = (data) => crypto.createHash('sha256').update(data).digest('hex');
// ---- the tool: its own code and the packages it measures and draws with ------------------------------------------------------
function walk(dir, out = []) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
        const f = path.join(dir, e.name);
        if (e.isDirectory())
            walk(f, out);
        else
            out.push(f);
    }
    return out;
}
let toolMemo;
/** Hash over lib/, the CLI files next to it, package.json and the installed versions of the packages the output depends on. */
export function toolHash() {
    if (toolMemo)
        return toolMemo;
    const h = crypto.createHash('sha256');
    const files = [...walk(path.join(ROOT, 'lib')), ...fs.readdirSync(ROOT).filter(f => /\.(ts|js)$/.test(f)).sort().map(f => path.join(ROOT, f))];
    for (const f of files)
        h.update(path.relative(ROOT, f)).update('\0').update(fs.readFileSync(f)).update('\0');
    const pkgFile = [path.join(ROOT, 'package.json'), path.join(ROOT, '..', 'package.json')].find(f => fs.existsSync(f));
    if (pkgFile) {
        const pkg = JSON.parse(fs.readFileSync(pkgFile, 'utf8'));
        h.update(`${pkg.version}\0`);
        for (const d of Object.keys({ ...pkg.dependencies, ...pkg.peerDependencies }).sort()) {
            let v = 'absent';
            for (const base of [path.join(path.dirname(pkgFile), 'node_modules'), path.join(ROOT, 'node_modules')]) {
                try {
                    v = JSON.parse(fs.readFileSync(path.join(base, d, 'package.json'), 'utf8')).version ?? 'unknown';
                    break;
                }
                catch { /* next */ }
            }
            h.update(`${d}@${v}\0`);
        }
    }
    h.update(process.version);
    return toolMemo = h.digest('hex');
}
let fontMemo;
/** The installed fonts (fc-list) and the font-related variables: a different font is a different measure. */
export function fontEnvHash() {
    if (fontMemo)
        return fontMemo;
    const r = spawnSync('fc-list', ['-f', '%{file}|%{index}|%{family}|%{style}|%{weight}\n'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    const listing = r.status === 0 ? r.stdout.split('\n').sort().join('\n') : `no-fc:${r.error ? 'spawn' : r.status}`;
    const env = Object.keys(process.env).filter(k => /^(FONTCONFIG|SVG_DIAGRAM)/.test(k)).sort().map(k => `${k}=${process.env[k]}`).join('\n');
    return fontMemo = sha(`${listing}\0${env}`);
}
// ---- what a build reads ------------------------------------------------------------------------------------------------------
const reads = new Map(), probes = new Map();
let recording = 0, patched = false;
const pathOf = (p) => typeof p === 'string' ? path.resolve(p) : p instanceof URL ? fileURLToPath(p) : Buffer.isBuffer(p) ? path.resolve(p.toString()) : null;
const isScratch = (f) => /[\\/]\.[^\\/]*\.rebuild\.svg$/.test(f);
function patch() {
    if (patched)
        return;
    patched = true;
    const rd = fs.readFileSync, ex = fs.existsSync;
    fs['readFileSync'] = function (...a) {
        const f = recording ? pathOf(a[0]) : null;
        if (!f || isScratch(f))
            return rd.apply(fs, a);
        try {
            const r = rd.apply(fs, a);
            reads.set(f, sha(r));
            return r;
        }
        catch (e) {
            reads.set(f, null);
            throw e;
        }
    };
    fs['existsSync'] = function (...a) {
        const r = ex.apply(fs, a), f = recording ? pathOf(a[0]) : null;
        if (f && !isScratch(f))
            probes.set(f, r);
        return r;
    };
    syncBuiltinESMExports(); // a source's `import {readFileSync} from 'node:fs'` is bound to the original until the exports are synced
}
/** Run `fn` and note every file it reads and every path it asks about. Notes accumulate over the process (a font read once serves every later source). */
export async function recordReads(fn) {
    patch();
    recording++;
    try {
        return await fn();
    }
    finally {
        recording--;
    }
}
const revealsOf = (svg) => {
    const dir = path.dirname(svg), base = path.basename(svg, '.svg');
    return fs.readdirSync(dir).filter(f => f.startsWith(`${base}.reveal`) && f.endsWith('.svg')).sort().map(f => path.join(dir, f));
};
export function openDriftCache(dir, config) {
    // a Chromium measure depends on a browser build this key cannot see
    if (process.env['SVG_DIAGRAM_MEASURE'] === 'chromium' || config.measure === 'chromium')
        return null;
    const entryFile = (abs) => path.join(dir, `${sha(abs).slice(0, 32)}.json`);
    const hashed = new Map(); // a font of 10 MB is read once per run, not once per source
    const world = {
        hashOf: (p) => {
            if (!hashed.has(p)) {
                try {
                    hashed.set(p, sha(fs.readFileSync(p)));
                }
                catch {
                    hashed.set(p, null);
                }
            }
            return hashed.get(p) ?? null;
        },
        exists: (p) => fs.existsSync(p),
    };
    return {
        keyFor(abs, svg, provenance) {
            if (depsOf(abs).unfollowable.length)
                return null; // an import() built from a variable: the imported files are unknown
            const committed = {};
            for (const f of [svg, ...revealsOf(svg)])
                committed[path.basename(f)] = sha(fs.readFileSync(f));
            const parts = {
                tool: toolHash(), fonts: fontEnvHash(), config: JSON.stringify(config), source: abs,
                sourceSha256: sha(fs.readFileSync(abs)), depsSha256: depsSha256(abs), committed, provenance,
            };
            return driftKey(parts);
        },
        hit(abs, key) {
            try {
                return entryHolds(parseEntry(fs.readFileSync(entryFile(abs), 'utf8')), key, world);
            }
            catch {
                return false;
            }
        },
        store(abs, key) {
            try {
                fs.mkdirSync(dir, { recursive: true });
                const ignore = path.join(dir, '.gitignore');
                if (!fs.existsSync(ignore))
                    fs.writeFileSync(ignore, '*\n');
                const r = [...reads].map(([p, s]) => ({ path: p, sha256: s })), q = [...probes].map(([p, e]) => ({ path: p, exists: e }));
                const tmp = `${entryFile(abs)}.${process.pid}.tmp`;
                fs.writeFileSync(tmp, JSON.stringify(makeEntry(key, r, q)));
                fs.renameSync(tmp, entryFile(abs));
            }
            catch { /* a cache that cannot be written is only a cache that is not there */ }
        },
    };
}
