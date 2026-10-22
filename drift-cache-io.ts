// The shell of the `check --drift --rebuild` cache (the pure half is lib/drift-cache.ts): reads the files and the environment the key covers,
// records which files a build reads, and keeps one small JSON entry per source. See ADR 0038 (docs/adr) for the reasoning.
import fs from 'node:fs';
import {syncBuiltinESMExports} from 'node:module';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {depsOf, depsSha256} from './lib/source-deps.ts';
import {driftKey, entryHolds, makeEntry, parseEntry, type DriftKeyParts, type Probe, type ReadFile} from './lib/drift-cache.ts';
import type {Config} from './lib/types/project.ts';

const ROOT = import.meta.dirname;
const sha = (data: string | Uint8Array): string => crypto.createHash('sha256').update(data).digest('hex');

// ---- the tool: its own code and the packages it measures and draws with ------------------------------------------------------
function walk(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, {withFileTypes: true}).sort((a, b) => (a.name < b.name ? -1 : 1))) {
    const f = path.join(dir, e.name);
    if (e.isDirectory()) walk(f, out); else out.push(f);
  }
  return out;
}
let toolMemo: string | undefined;
/** Hash over lib/, the CLI files next to it, package.json and the installed versions of the packages the output depends on. */
export function toolHash(): string {
  if (toolMemo) return toolMemo;
  const h = crypto.createHash('sha256');
  const files = [...walk(path.join(ROOT, 'lib')), ...fs.readdirSync(ROOT).filter(f => /\.(ts|js)$/.test(f)).sort().map(f => path.join(ROOT, f))];
  for (const f of files) h.update(path.relative(ROOT, f)).update('\0').update(fs.readFileSync(f)).update('\0');
  const pkgFile = [path.join(ROOT, 'package.json'), path.join(ROOT, '..', 'package.json')].find(f => fs.existsSync(f));
  if (pkgFile) {
    const pkg = JSON.parse(fs.readFileSync(pkgFile, 'utf8')) as {version?: string; dependencies?: Record<string, string>; peerDependencies?: Record<string, string>};
    h.update(`${pkg.version}\0`);
    for (const d of Object.keys({...pkg.dependencies, ...pkg.peerDependencies}).sort()) {
      let v = 'absent';
      for (const base of [path.join(path.dirname(pkgFile), 'node_modules'), path.join(ROOT, 'node_modules')]) {
        try { v = (JSON.parse(fs.readFileSync(path.join(base, d, 'package.json'), 'utf8')) as {version?: string}).version ?? 'unknown'; break; } catch { /* next */ }
      }
      h.update(`${d}@${v}\0`);
    }
  }
  h.update(process.version);
  return toolMemo = h.digest('hex');
}

let fontMemo: string | undefined;
/** The installed fonts (fc-list) and the font-related variables: a different font is a different measure. */
export function fontEnvHash(): string {
  if (fontMemo) return fontMemo;
  const r = spawnSync('fc-list', ['-f', '%{file}|%{index}|%{family}|%{style}|%{weight}\n'], {encoding: 'utf8', maxBuffer: 64 * 1024 * 1024});
  const listing = r.status === 0 ? r.stdout.split('\n').sort().join('\n') : `no-fc:${r.error ? 'spawn' : r.status}`;
  const env = Object.keys(process.env).filter(k => /^(FONTCONFIG|SVG_DIAGRAM)/.test(k)).sort().map(k => `${k}=${process.env[k]}`).join('\n');
  return fontMemo = sha(`${listing}\0${env}`);
}

// ---- what a build reads ------------------------------------------------------------------------------------------------------
const reads = new Map<string, string | null>(), probes = new Map<string, boolean>();
let recording = 0, patched = false;
type Fn = (...a: unknown[]) => unknown;
const pathOf = (p: unknown): string | null => typeof p === 'string' ? path.resolve(p) : p instanceof URL ? fileURLToPath(p) : Buffer.isBuffer(p) ? path.resolve(p.toString()) : null;
const isScratch = (f: string): boolean => /[\\/]\.[^\\/]*\.rebuild\.svg$/.test(f);
function patch(): void {
  if (patched) return;
  patched = true;
  const rd = fs.readFileSync as unknown as Fn, ex = fs.existsSync as unknown as Fn;
  (fs as unknown as Record<string, Fn>)['readFileSync'] = function (this: unknown, ...a: unknown[]) {
    const f = recording ? pathOf(a[0]) : null;
    if (!f || isScratch(f)) return rd.apply(fs, a);
    try { const r = rd.apply(fs, a) as string | Uint8Array; reads.set(f, sha(r)); return r; }
    catch (e) { reads.set(f, null); throw e; }
  };
  (fs as unknown as Record<string, Fn>)['existsSync'] = function (this: unknown, ...a: unknown[]) {
    const r = ex.apply(fs, a) as boolean, f = recording ? pathOf(a[0]) : null;
    if (f && !isScratch(f)) probes.set(f, r);
    return r;
  };
  syncBuiltinESMExports(); // a source's `import {readFileSync} from 'node:fs'` is bound to the original until the exports are synced
}
/** Run `fn` and note every file it reads and every path it asks about. Notes accumulate over the process (a font read once serves every later source). */
export async function recordReads<T>(fn: () => Promise<T>): Promise<T> {
  patch();
  recording++;
  try { return await fn(); } finally { recording--; }
}

// ---- the cache ---------------------------------------------------------------------------------------------------------------
export interface DriftCache {
  /** the key for this source, or null when the build cannot be fully described (then nothing is cached) */
  keyFor(abs: string, svg: string, provenance: string): string | null;
  hit(abs: string, key: string): boolean;
  store(abs: string, key: string): void;
}

const revealsOf = (svg: string): string[] => {
  const dir = path.dirname(svg), base = path.basename(svg, '.svg');
  return fs.readdirSync(dir).filter(f => f.startsWith(`${base}.reveal`) && f.endsWith('.svg')).sort().map(f => path.join(dir, f));
};

export function openDriftCache(dir: string, config: Config): DriftCache | null {
  // a Chromium measure depends on a browser build this key cannot see
  if (process.env['SVG_DIAGRAM_MEASURE'] === 'chromium' || config.measure === 'chromium') return null;
  const entryFile = (abs: string): string => path.join(dir, `${sha(abs).slice(0, 32)}.json`);
  const hashed = new Map<string, string | null>(); // a font of 10 MB is read once per run, not once per source
  const world = {
    hashOf: (p: string): string | null => {
      if (!hashed.has(p)) { try { hashed.set(p, sha(fs.readFileSync(p))); } catch { hashed.set(p, null); } }
      return hashed.get(p) ?? null;
    },
    exists: (p: string): boolean => fs.existsSync(p),
  };
  return {
    keyFor(abs, svg, provenance) {
      if (depsOf(abs).unfollowable.length) return null; // an import() built from a variable: the imported files are unknown
      const committed: Record<string, string> = {};
      for (const f of [svg, ...revealsOf(svg)]) committed[path.basename(f)] = sha(fs.readFileSync(f));
      const parts: DriftKeyParts = {
        tool: toolHash(), fonts: fontEnvHash(), config: JSON.stringify(config), source: abs,
        sourceSha256: sha(fs.readFileSync(abs)), depsSha256: depsSha256(abs), committed, provenance,
      };
      return driftKey(parts);
    },
    hit(abs, key) {
      try { return entryHolds(parseEntry(fs.readFileSync(entryFile(abs), 'utf8')), key, world); } catch { return false; }
    },
    store(abs, key) {
      try {
        fs.mkdirSync(dir, {recursive: true});
        const ignore = path.join(dir, '.gitignore');
        if (!fs.existsSync(ignore)) fs.writeFileSync(ignore, '*\n');
        const r: ReadFile[] = [...reads].map(([p, s]) => ({path: p, sha256: s})), q: Probe[] = [...probes].map(([p, e]) => ({path: p, exists: e}));
        const tmp = `${entryFile(abs)}.${process.pid}.tmp`;
        fs.writeFileSync(tmp, JSON.stringify(makeEntry(key, r, q)));
        fs.renameSync(tmp, entryFile(abs));
      } catch { /* a cache that cannot be written is only a cache that is not there */ }
    },
  };
}
