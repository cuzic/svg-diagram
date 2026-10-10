#!/usr/bin/env node
// svg-diagram typecheck [tsc args...] — run the project's own tsc over its tsconfig.json.
// The compiler comes from the project (not from this tool), so editor and CI agree.
import {createRequire} from 'node:module';
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

if (!fs.existsSync('tsconfig.json')) { console.error('tsconfig.json がない。先に `svg-diagram init` を実行する'); process.exit(2); }
let tsc: string;
try { tsc = createRequire(path.resolve('package.json')).resolve('typescript/bin/tsc'); }
catch { console.error('typescript が見つからない。`pnpm add -D typescript @types/node` を実行する'); process.exit(2); }
const r = spawnSync(process.execPath, [tsc, '-p', '.', '--noEmit', ...process.argv.slice(2)], {stdio: 'inherit'});
process.exit(r.status ?? 1);
