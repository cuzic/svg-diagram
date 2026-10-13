// `svg-diagram icons ...` — the effects: asking Iconify (https://iconify.design — one API over the open icon sets), reading
// .svg files, and writing the project's svg-diagram.icons.json. The pure parts are in icon-store.ts.
import fs from 'node:fs';
import path from 'node:path';
import {emptyManifest, glyphFromBody, glyphFromSvg, MANIFEST_FILE, parseManifest, parseSpec, PERMISSIVE} from './icon-store.ts';
import type {IconManifest, IconSpec, InstalledIcon} from './icon-store.ts';
import {findManifest} from './icon-registry.ts';
import {setArgs} from './icon-sets.ts';

export type Fetch = (url: string) => Promise<{ok: boolean; status: number; json(): Promise<unknown>}>;
export interface InstallOpts {
  /** Iconify API root (SVG_DIAGRAM_ICONIFY_API overrides it, for a mirror or a test server). */
  api?: string;
  fetch?: Fetch;
  /** Licences to accept besides the permissive ones (SPDX ids). */
  allowLicense?: string[];
  /** Accept icons with colours of their own (they do not follow the tone / dark theme). */
  color?: boolean;
  cwd?: string;
  /** A name the set does not have is left out (and listed in `skipped`) instead of failing the whole add. Licence / colour / format errors still fail. */
  skipMissing?: boolean;
}
export const DEFAULT_API = 'https://api.iconify.design';

export interface IconifySet {prefix: string; icons: Record<string, {body: string; width?: number; height?: number; left?: number; top?: number; rotate?: number; hFlip?: boolean; vFlip?: boolean}>; aliases?: Record<string, {parent: string; body?: string; rotate?: number; hFlip?: boolean; vFlip?: boolean; width?: number; height?: number}>; width?: number; height?: number; not_found?: string[]}
export interface CollectionInfo {name?: string; author?: {name?: string}; license?: {spdx?: string; title?: string; url?: string}; palette?: boolean}

export async function getJson<T>(f: Fetch, url: string): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    let r: Awaited<ReturnType<Fetch>>;
    try { r = await f(url); } catch (e) { throw new Error(`cannot reach ${url} — ${(e as Error).message} (offline? install from a file instead: svg-diagram icons add ./name.svg)`); }
    if (r.status === 429 && attempt < 3) { await new Promise(ok => setTimeout(ok, 1500 * (attempt + 1))); continue; } // rate-limited: wait and ask again
    if (!r.ok) throw new Error(`${url} → HTTP ${r.status}`);
    return await r.json() as T;
  }
}

/** Where this project's manifest is (nearest parent), or where `add` would create it (here). */
export function manifestPath(cwd: string = process.cwd()): string {
  return findManifest(cwd) ?? path.join(path.resolve(cwd), MANIFEST_FILE);
}
export function readManifest(file: string): IconManifest {
  return fs.existsSync(file) ? parseManifest(fs.readFileSync(file, 'utf8'), file) : emptyManifest();
}
export function writeManifest(file: string, m: IconManifest): void {
  const icons = Object.fromEntries(Object.entries(m.icons).sort(([a], [b]) => a.localeCompare(b)));
  const tmp = `${file}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`;
  try {
    fs.writeFileSync(tmp, JSON.stringify({version: 1, ...(m.mainSet ? {mainSet: m.mainSet} : {}), ...(m.packs && Object.keys(m.packs).length ? {packs: m.packs} : {}), icons}, null, 2) + '\n');
    fs.renameSync(tmp, file); // atomic: a reader sees the old or the new file, never half of one
  } catch (e) { try { fs.unlinkSync(tmp); } catch { /* never made */ } throw e; }
}

const LOCK_STALE_MS = 30_000;
const LOCK_TIMEOUT_MS = 15_000;
const sleep = (ms: number) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
function lockIsStale(lock: string): boolean {
  try {
    const st = fs.statSync(lock);
    const pid = Number(fs.readFileSync(lock, 'utf8').split(/\s/)[0]);
    if (Date.now() - st.mtimeMs > LOCK_STALE_MS) return true;
    if (pid > 0) { try { process.kill(pid, 0); } catch (e) { return (e as NodeJS.ErrnoException).code === 'ESRCH'; } }
    return false;
  } catch { return false; } // gone already (or half-written): the next try finds out
}
/** Remove a stale lock. Two runs may both judge the same lock stale; a plain unlink by the slower one would delete the lock the faster one has
 *  just made, and both would go on. So the lock is first renamed aside (atomic — only one run gets it) and judged again there: a live lock
 *  caught by mistake is linked back. */
function takeOver(lock: string): void {
  const aside = `${lock}.${process.pid}.${Math.random().toString(36).slice(2)}.stale`;
  try { fs.renameSync(lock, aside); } catch { return; } // someone else took it over already
  try { if (!lockIsStale(aside)) fs.linkSync(aside, lock); } catch { /* a new lock is there already: its maker holds it */ } finally { try { fs.unlinkSync(aside); } catch { /* gone */ } }
}
/** Run `fn` holding an exclusive lock (<manifest>.lock, created with O_EXCL) so that read-modify-write cycles of parallel runs do not lose each other's updates. A lock left by a dead process is taken over. */
export function withManifestLock<T>(file: string, fn: () => T): T {
  const lock = `${file}.lock`;
  const start = Date.now();
  fs.mkdirSync(path.dirname(file), {recursive: true});
  for (;;) {
    try { const fd = fs.openSync(lock, 'wx'); try { fs.writeSync(fd, `${process.pid}\n`); } finally { fs.closeSync(fd); } break; } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'EEXIST') throw e;
      if (lockIsStale(lock)) { takeOver(lock); continue; }
      if (Date.now() - start > LOCK_TIMEOUT_MS) throw new Error(`${lock} is held by another svg-diagram run for over ${LOCK_TIMEOUT_MS / 1000}s — if none is running, delete that file`);
      sleep(20 + Math.random() * 40);
    }
  }
  try { return fn(); } finally { try { fs.unlinkSync(lock); } catch { /* already gone */ } }
}

/** Fetch and convert the icons for `specs`. Nothing is written; any failure throws, so one bad pick installs none. */
export async function resolveSpecs(specs: IconSpec[], opts: InstallOpts = {}, skipped: string[] = []): Promise<Record<string, InstalledIcon>> {
  const f: Fetch = opts.fetch ?? (url => fetch(url) as never);
  const api = (opts.api ?? process.env['SVG_DIAGRAM_ICONIFY_API'] ?? DEFAULT_API).replace(/\/$/, '');
  const allow = new Set([...PERMISSIVE, ...(opts.allowLicense ?? [])]);
  const out: Record<string, InstalledIcon> = {};
  const missing: string[] = []; // every name the set lacks, reported together (one typo should not hide the others)
  const byPrefix = new Map<string, Extract<IconSpec, {kind: 'iconify'}>[]>();
  for (const s of specs) {
    if (s.kind === 'file') {
      const file = path.resolve(opts.cwd ?? '.', s.path);
      out[s.name] = {...glyphFromSvg(fs.readFileSync(file, 'utf8'), s.path, {color: opts.color}), from: `file:${path.basename(s.path)}`, license: 'local'};
    } else byPrefix.set(s.prefix, [...(byPrefix.get(s.prefix) ?? []), s]);
  }
  // one small call for every set's author / licence (the per-set /collection call lists all of its icons)
  const infos = byPrefix.size ? await getJson<Record<string, CollectionInfo>>(f, `${api}/collections?prefixes=${[...byPrefix.keys()].join(',')}`) : {};
  for (const [prefix, list] of byPrefix) {
    const names = [...new Set(list.map(s => s.icon))].join(',');
    const set = await getJson<IconifySet>(f, `${api}/${prefix}.json?icons=${encodeURIComponent(names)}`);
    const col = {info: infos[prefix]};
    const lic = col.info?.license;
    if (!lic?.spdx) throw new Error(`${prefix}: the set states no licence (SPDX id) — not installing from it`);
    if (!allow.has(lic.spdx)) throw new Error(`${prefix}: licence ${lic.spdx}${lic.title ? ` (${lic.title})` : ''} is not one of the permissive ones (${[...PERMISSIVE].join(', ')}) — it may need attribution or forbid commercial use. If you have read it and accept: --allow-license ${lic.spdx}`);
    if (col.info?.palette && !opts.color) throw new Error(`${prefix}: a multi-colour set — its icons keep their own colours (no tone, no dark theme). To install from it anyway: --color`);
    for (const s of list) {
      const what = `${prefix}:${s.icon}`;
      const direct = set.icons?.[s.icon];
      const alias = set.aliases?.[s.icon];
      const base = direct ?? (alias ? set.icons?.[alias.parent] : undefined);
      if (!base) {
        if (opts.skipMissing) skipped.push(what);
        else missing.push(`${what}: not in the set (svg-diagram icons search ${s.icon.split('-')[0]} --set ${prefix})`);
        continue;
      }
      const t = direct ?? {...base, ...alias};
      if (t.rotate || t.hFlip || t.vFlip) throw new Error(`${what}: is a rotated / flipped alias — install ${alias?.parent ?? 'its parent'} instead`);
      const g = glyphFromBody(t.body, {width: t.width ?? set.width ?? 16, height: t.height ?? set.height ?? t.width ?? set.width ?? 16, left: t.left, top: t.top}, what, {color: opts.color});
      out[s.name] = {...g, from: what, license: lic.spdx, ...(lic.url ? {licenseUrl: lic.url} : {}), ...(col.info?.author?.name ? {author: col.info.author.name} : {})};
    }
  }
  if (missing.length) throw new Error(`${missing.join('\n')}${missing.length > 1 ? '\n(nothing was installed. --skip-missing installs the others and lists these)' : ''}`);
  return out;
}

export async function addIcons(args: string[], opts: InstallOpts & {keepExisting?: boolean} = {}): Promise<{file: string; added: string[]; replaced: string[]; kept: string[]; skipped: string[]; warnings: string[]}> {
  const cwd = opts.cwd ?? process.cwd();
  const specs = args.map(parseSpec);
  const dup = specs.find((s, i) => specs.findIndex(t => t.name === s.name) !== i);
  if (dup) throw new Error(`the name "${dup.name}" is given twice — rename one with =name`);
  const skipped: string[] = [];
  const got = await resolveSpecs(specs, {...opts, cwd}, skipped);
  const file = manifestPath(cwd);
  if (!Object.keys(got).length) return {file, added: [], replaced: [], kept: [], skipped, warnings: []}; // everything skipped: nothing to write
  const resolved = new Set(Object.keys(got));
  return withManifestLock(file, () => {
  const m = readManifest(file);
  // keepExisting (add-set): a name the project already has stays as it is — the set's pick does not overwrite the user's own
  const kept = opts.keepExisting ? Object.keys(got).filter(n => n in m.icons) : [];
  for (const n of kept) delete got[n];
  const replaced = Object.keys(got).filter(n => n in m.icons);
  // the first Iconify set a project installs from becomes its main set; later ones from another set are said to look different
  const warnings: string[] = [];
  // only the sets something was installed from: a set whose names were all skipped (--skip-missing) neither becomes the main set nor warns
  const sets = [...new Set(specs.flatMap(sp => (sp.kind === 'iconify' && resolved.has(sp.name) ? [sp.prefix] : [])))];
  if (!m.mainSet && sets.length) m.mainSet = sets[0];
  for (const p of sets) if (m.mainSet && p !== m.mainSet) warnings.push(`主セットは ${m.mainSet}。${p} のアイコンは線の太さや絵柄が揃わないことがある（主セットを変えるなら: svg-diagram icons main ${p}）`);
  Object.assign(m.icons, got);
  writeManifest(file, m);
  return {file, added: Object.keys(got).filter(n => !replaced.includes(n)), replaced, kept, skipped, warnings};
  });
}

/** Install a recommended set (see icon-sets.ts) through the ordinary `icons add` path. Names already installed are kept, not overwritten. */
export function addSet(name: string, opts: InstallOpts = {}) { return addIcons(setArgs(name), {...opts, keepExisting: true}); }

export function removeIcons(names: string[], cwd: string = process.cwd()): {file: string; removed: string[]} {
  const file = manifestPath(cwd);
  return withManifestLock(file, () => {
  const m = readManifest(file);
  const missing = names.filter(n => !(n in m.icons));
  if (missing.length) throw new Error(`not installed: ${missing.join(', ')}`);
  for (const n of names) delete m.icons[n];
  writeManifest(file, m);
  return {file, removed: names};
  });
}

export async function searchIcons(query: string, opts: InstallOpts & {set?: string; limit?: number} = {}): Promise<string[]> {
  const f: Fetch = opts.fetch ?? (url => fetch(url) as never);
  const api = (opts.api ?? process.env['SVG_DIAGRAM_ICONIFY_API'] ?? DEFAULT_API).replace(/\/$/, '');
  const r = await getJson<{icons?: string[]}>(f, `${api}/search?query=${encodeURIComponent(query)}&limit=${opts.limit ?? 32}${opts.set ? `&prefix=${encodeURIComponent(opts.set)}` : ''}`);
  return r.icons ?? [];
}

/** Markdown for a NOTICE / credits page: who made the icons the project installed, under which licence. */
export function noticeText(m: IconManifest): string {
  const groups = new Map<string, string[]>();
  for (const [name, ic] of Object.entries(m.icons)) {
    const pk = ic.license.startsWith('vendor:') ? m.packs?.[ic.license.slice(7)] : undefined;
    const key = pk ? `${ic.license.slice(7)} — the vendor's own terms (${pk.terms}), accepted ${pk.acceptedAt}` : ic.from.startsWith('file:') ? 'Drawn in this project' : `${ic.from.split(':')[0]} — ${ic.author ?? 'unknown author'}, ${ic.license}${ic.licenseUrl ? ` (${ic.licenseUrl})` : ''}`;
    groups.set(key, [...(groups.get(key) ?? []), name]);
  }
  return [...groups].map(([k, v]) => `- ${k}: ${v.join(', ')}`).join('\n') + '\n';
}

export function setMainSet(prefix: string | undefined, cwd: string = process.cwd()): {file: string; mainSet?: string} {
  if (prefix !== undefined && !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(prefix)) throw new Error(`"${prefix}" is not an Iconify set prefix (like mdi, lucide, material-symbols)`);
  const file = manifestPath(cwd);
  return withManifestLock(file, () => {
    const m = readManifest(file);
    if (prefix) m.mainSet = prefix; else delete m.mainSet;
    writeManifest(file, m);
    return {file, mainSet: prefix};
  });
}

/** One line naming the manifest file a command wrote (absolute), and saying so when it was found in a parent directory rather than the current one. */
export function manifestNote(file: string, cwd: string = process.cwd()): string {
  const abs = path.resolve(file);
  const here = path.join(path.resolve(cwd), MANIFEST_FILE);
  if (abs === here) return abs;
  return `${abs}（親ディレクトリで見つけたファイル。今のディレクトリではない）`;
}
