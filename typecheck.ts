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
  for (const d of (process.env['PATH'] ?? '').split(path.delimiter).filter(Boolean)) {
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
const own = (f: string) => [path.join(root, 'dist', 'lib', `${f}.d.ts`), path.join(root, 'lib', `${f}.ts`)].find(x => fs.existsSync(x));
const paths: Record<string, string[]> = {};
for (const [spec, f] of [['svg-diagram', 'dsl'], ['svg-diagram/render', 'render-source']]) {
  const file = own(f);
  if (file && !resolves(spec)) paths[spec] = [file];
}
const typeRoots: string[] = [];
if (!resolves('@types/node/package.json')) {
  // @types/node of this tool (a dependency of a clone; absent from a package): next to it, or in a pnpm store layout
  try { typeRoots.push(path.dirname(path.dirname(createRequire(path.join(root, 'package.json')).resolve('@types/node/package.json')))); } catch { /* not available either: tsc says so */ }
}

let config = '.';
let temp: string | null = null;
if (Object.keys(paths).length || typeRoots.length) {
  temp = path.resolve('.svg-diagram-tsconfig.json');
  // The project's own options, to keep what the temporary config would otherwise replace (`paths` and `typeRoots` replace, not merge).
  // A tsconfig with block comments or trailing commas is not read: its `paths` / `typeRoots` are then not kept.
  let project: {baseUrl?: string; paths?: Record<string, string[]>; typeRoots?: string[]} = {};
  try { project = JSON.parse(fs.readFileSync('tsconfig.json', 'utf8').replace(/^\s*\/\/.*$/gm, '')).compilerOptions ?? {}; } catch { /* see above */ }
  const compilerOptions: Record<string, unknown> = {};
  if (Object.keys(paths).length) {
    // the project's entries are relative to its baseUrl (else to its tsconfig): made absolute so they keep pointing at the same files
    const base = path.resolve(project.baseUrl ?? '.');
    compilerOptions['paths'] = {...Object.fromEntries(Object.entries(project.paths ?? {}).map(([k, v]) => [k, v.map(p => path.resolve(base, p))])), ...paths};
  }
  if (typeRoots.length) {
    // the project's other type packages stay visible: its own typeRoots, or the default node_modules/@types
    const mine = project.typeRoots?.map(t => path.resolve(t)) ?? [path.resolve('node_modules', '@types')].filter(t => fs.existsSync(t));
    compilerOptions['typeRoots'] = [...mine, ...typeRoots];
  }
  fs.writeFileSync(temp, JSON.stringify({extends: './tsconfig.json', compilerOptions}));
  config = temp;
}
// Ctrl-C reaches tsc too; this process waits for it and still removes the temporary config instead of dying first
if (temp) process.on('SIGINT', () => {});
// a `tsc.cmd` on Windows only starts through the shell (quoted: it may sit under "Program Files")
const shell = process.platform === 'win32' && !tsc.args.length;
const r = spawnSync(shell ? `"${tsc.cmd}"` : tsc.cmd, [...tsc.args, '-p', config, '--noEmit', ...process.argv.slice(2)], {stdio: 'inherit', shell});
if (temp) fs.rmSync(temp, {force: true});
process.exit(r.status ?? 1);
