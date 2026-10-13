// `svg-diagram icons add-pack <dir|zip> --prefix aws --terms <url> --accept-terms` — a vendor's own icon set (AWS Architecture Icons,
// Azure, Google Cloud, Kubernetes, ...) from files the person downloaded. These come under the vendor's terms, not an open licence:
// nothing is fetched here, and installing needs the person to say where the terms are and that they read them; both are recorded
// in the manifest (packs) and printed by `icons notice`.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {glyphFromSvg, packIconName} from './icon-store.ts';
import type {InstalledIcon} from './icon-store.ts';
import {manifestPath, readManifest, withManifestLock, writeManifest} from './icon-install.ts';

export interface PackOpts {
  prefix: string;
  terms?: string;
  acceptTerms?: boolean;
  /** only files whose path matches */
  match?: RegExp;
  exclude?: RegExp;
  /** install everything (a pack has hundreds of icons: say so) */
  all?: boolean;
  /** report, write nothing */
  list?: boolean;
  cwd?: string;
  /** day recorded as the acceptance date (tests) */
  today?: string;
}
export interface PackResult {
  file: string;
  added: string[];
  replaced: string[];
  /** reason -> files */
  skipped: Record<string, string[]>;
  /** names two files claimed (the first, by size preference, won) */
  collisions: string[];
  listed: boolean;
}

function walk(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, {withFileTypes: true}).sort((a, b) => a.name.localeCompare(b.name))) {
    if (e.name.startsWith('.') || e.name === '__MACOSX') continue;
    const f = path.join(dir, e.name);
    if (e.isDirectory()) walk(f, out); else if (/\.svg$/i.test(e.name)) out.push(f);
  }
  return out;
}

// among files that name the same icon (one per size), the 48 px one, then the larger ones
const sizeRank = (f: string): number => { const m = /(?:^|[^\d])(16|24|32|48|64|128|256)(?:px)?(?:[^\d]|$)/.exec(f.split('/').slice(-1)[0]); const n = m ? Number(m[1]) : 0; return n === 48 ? 0 : n === 0 ? 1 : n > 48 ? 2 + n / 1000 : 3 + (48 - n) / 100; };

/** The directory to read: the given one, or the contents of a .zip extracted (by the system's `unzip`) into a fresh temp directory. */
function openSource(src: string): {dir: string; cleanup: () => void} {
  const abs = path.resolve(src);
  if (!fs.existsSync(abs)) throw new Error(`${src}: not found`);
  if (fs.statSync(abs).isDirectory()) return {dir: abs, cleanup: () => {}};
  if (!/\.zip$/i.test(abs)) throw new Error(`${src}: give a directory of .svg files, or the vendor's .zip`);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'icon-pack-'));
  const r = spawnSync('unzip', ['-q', '-o', abs, '-d', tmp], {encoding: 'utf8'});
  if (r.error || r.status !== 0) { fs.rmSync(tmp, {recursive: true, force: true}); throw new Error(`cannot unzip ${src} (${r.error ? 'the unzip command is not installed' : r.stderr.trim()}) — extract it yourself and give the directory`); }
  return {dir: tmp, cleanup: () => fs.rmSync(tmp, {recursive: true, force: true})};
}

export function addPack(src: string, o: PackOpts): PackResult {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(o.prefix)) throw new Error(`--prefix "${o.prefix}": lower-case letters, digits and - (like aws, azure, gcp)`);
  if (!o.list && (!o.terms?.trim() || !o.acceptTerms)) throw new Error(`a vendor pack comes under the vendor's own terms, not an open licence. Read them, then install with --terms <where they are (a URL)> --accept-terms — both are recorded in svg-diagram.icons.json`);
  const {dir, cleanup} = openSource(src);
  try {
    const files = walk(dir).map(f => path.relative(dir, f).split(path.sep).join('/')).filter(f => (!o.match || o.match.test(f)) && !(o.exclude?.test(f)));
    if (!files.length) throw new Error(`no .svg file${o.match ? ` matches ${o.match}` : ''} in ${src}`);
    if (!o.all && !o.match && !o.list) throw new Error(`${src} has ${files.length} icons (e.g. ${files.slice(0, 3).join(', ')}). Install the ones you need with --match <regex on the path> (like --match "Lambda|EC2|S3"), or everything with --all. --list shows the names.`);
    // one icon per name: the best size wins
    const byName = new Map<string, string[]>();
    for (const f of files) byName.set(packIconName(f, o.prefix), [...(byName.get(packIconName(f, o.prefix)) ?? []), f]);
    const collisions: string[] = [];
    const skipped: Record<string, string[]> = {};
    const got: Record<string, InstalledIcon> = {};
    for (const [name, group] of [...byName].sort(([a], [b]) => a.localeCompare(b))) {
      const best = [...group].sort((a, b) => sizeRank(a) - sizeRank(b) || a.localeCompare(b));
      if (group.length > 1) collisions.push(`${name} (${group.length} files: ${best[0]} kept)`);
      try {
        const g = glyphFromSvg(fs.readFileSync(path.join(dir, best[0]), 'utf8'), best[0], {color: true});
        got[name] = {...g, from: `pack:${o.prefix}/${best[0]}`, license: `vendor:${o.prefix}`};
      } catch (e) { (skipped[(e as Error).message.replace(/^[^:]*: /, '')] ??= []).push(best[0]); }
    }
    const file = manifestPath(o.cwd);
    if (o.list) return {file, added: Object.keys(got), replaced: [], skipped, collisions, listed: true};
    return withManifestLock(file, () => {
    const m = readManifest(file);
    const replaced = Object.keys(got).filter(n => n in m.icons);
    Object.assign(m.icons, got);
    m.packs = {...(m.packs ?? {}), [o.prefix]: {terms: o.terms!.trim(), source: path.basename(path.resolve(src)), acceptedAt: o.today ?? new Date().toISOString().slice(0, 10)}};
    writeManifest(file, m);
    return {file, added: Object.keys(got).filter(n => !replaced.includes(n)), replaced, skipped, collisions, listed: false};
    });
  } finally { cleanup(); }
}
