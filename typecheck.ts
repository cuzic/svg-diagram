#!/usr/bin/env node
// svg-diagram typecheck [tsc args...] — run tsc over the project's tsconfig.json.
// The compiler comes from the project when it has one (so editor and CI agree), else a `tsc` on PATH (a global install: `pnpm add -g typescript`).
// `import ... from 'svg-diagram'` and @types/node are resolved from the project when installed there; when they are not (this tool run globally,
// nothing installed next to the diagrams), the check goes through a temporary tsconfig that extends the project's and points them at this tool's own copies.
import {createRequire} from 'node:module';
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

if (!fs.existsSync('tsconfig.json')) { console.error('tsconfig.json がない。先に `svg-diagram init` を実行する'); process.exit(2); }
const req = createRequire(path.resolve('package.json'));
const resolves = (id: string) => { try { return req.resolve(id); } catch { return null; } };

const onPath = () => {
  for (const d of (process.env.PATH ?? '').split(path.delimiter).filter(Boolean)) {
    const f = path.join(d, process.platform === 'win32' ? 'tsc.cmd' : 'tsc');
    if (fs.existsSync(f)) return f;
  }
  return null;
};
let tsc: {cmd: string; args: string[]};
const pkgPath = resolves('typescript/package.json'); // "typescript/bin/tsc" is not an exported path in TypeScript 7+, so find the bin through package.json
if (pkgPath) tsc = {cmd: process.execPath, args: [path.join(path.dirname(pkgPath), JSON.parse(fs.readFileSync(pkgPath, 'utf8')).bin.tsc)]};
else {
  const g = onPath();
  if (!g) { console.error('typescript が見つからない。`pnpm add -D typescript @types/node` を実行する（グローバル運用なら `pnpm add -g typescript`）'); process.exit(2); }
  tsc = {cmd: g, args: []};
}

// This tool's own copies: the .ts sources in a clone, dist/ in a package.
const here = import.meta.dirname;
const root = fs.existsSync(path.join(here, 'lib', 'dsl.ts')) ? here : path.dirname(here);
const dsl = [path.join(root, 'dist', 'lib', 'dsl.d.ts'), path.join(root, 'lib', 'dsl.ts')].find(f => fs.existsSync(f));
const paths: Record<string, string[]> = {};
if (dsl && !resolves('svg-diagram')) paths['svg-diagram'] = [dsl];
const typeRoots: string[] = [];
if (!resolves('@types/node/package.json')) {
  // @types/node of this tool (a dependency of a clone; absent from a package): next to it, or in a pnpm store layout
  const own = createRequire(path.join(root, 'package.json')).resolve.bind(null);
  try { typeRoots.push(path.dirname(path.dirname(own('@types/node/package.json')))); } catch { /* not available either: tsc says so */ }
}

let config = '.';
let temp: string | null = null;
if (Object.keys(paths).length || typeRoots.length) {
  temp = path.resolve('.svg-diagram-tsconfig.json');
  const compilerOptions: Record<string, unknown> = {};
  // `paths` replaces (not merges) the project's, and is relative to the config that sets it: keep the project's entries, made absolute
  if (Object.keys(paths).length) {
    let own: Record<string, string[]> = {};
    try { own = (JSON.parse(fs.readFileSync('tsconfig.json', 'utf8').replace(/^\s*\/\/.*$/gm, '')).compilerOptions?.paths) ?? {}; } catch { /* a tsconfig with comments or trailing commas: its paths are not kept */ }
    compilerOptions.paths = {...Object.fromEntries(Object.entries(own).map(([k, v]) => [k, v.map(p => path.resolve(p))])), ...paths};
  }
  if (typeRoots.length) compilerOptions.typeRoots = typeRoots;
  fs.writeFileSync(temp, JSON.stringify({extends: './tsconfig.json', compilerOptions}));
  config = temp;
}
const r = spawnSync(tsc.cmd, [...tsc.args, '-p', config, '--noEmit', ...process.argv.slice(2)], {stdio: 'inherit'});
if (temp) fs.rmSync(temp, {force: true});
process.exit(r.status ?? 1);
