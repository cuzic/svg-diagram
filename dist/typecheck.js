#!/usr/bin/env node
// svg-diagram typecheck [tsc args...] — run tsc over the project's tsconfig.json.
// The compiler comes from the project when it has one (so editor and CI agree), else a `tsc` on PATH (a global install: `pnpm add -g typescript`).
// `import ... from 'svg-diagram'` and @types/node are resolved from the project when installed there; when they are not (this tool run globally,
// nothing installed next to the diagrams), the check goes through a temporary tsconfig that extends the project's and points them at this tool's own copies.
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
// No tsconfig.json: check with the same defaults `svg-diagram init` writes (build / check work without one too). `init` makes it permanent.
const hasConfig = fs.existsSync('tsconfig.json');
const DEFAULT_OPTIONS = {
    target: 'es2023', module: 'nodenext', moduleResolution: 'nodenext', allowImportingTsExtensions: true, noEmit: true,
    erasableSyntaxOnly: true, verbatimModuleSyntax: true, strict: true, skipLibCheck: true,
};
const req = createRequire(path.resolve('package.json'));
const resolves = (id) => { try {
    return req.resolve(id);
}
catch {
    return null;
} };
const onPath = () => {
    for (const d of (process.env['PATH'] ?? '').split(path.delimiter).filter(Boolean)) {
        const f = path.join(d, process.platform === 'win32' ? 'tsc.cmd' : 'tsc');
        if (fs.existsSync(f))
            return f;
    }
    return null;
};
let tsc;
// the project's typescript first; else this tool's own copy (present when installed from a clone, where it is a devDependency; a package install has none), so a project with nothing installed still checks
const toolRoot = fs.existsSync(path.join(import.meta.dirname, 'lib', 'dsl.ts')) ? import.meta.dirname : path.dirname(import.meta.dirname);
const toolReq = createRequire(path.join(toolRoot, 'package.json'));
// SVG_DIAGRAM_NO_OWN_TS=1 skips the tool's own copy (the tests use it to reach the PATH branch)
const ownTs = () => { if (process.env['SVG_DIAGRAM_NO_OWN_TS'])
    return null; try {
    return toolReq.resolve('typescript/package.json');
}
catch {
    return null;
} };
const pkgPath = resolves('typescript/package.json') ?? ownTs(); // a tsc on PATH comes last: an old one does not know the options `init` writes (erasableSyntaxOnly) // "typescript/bin/tsc" is not an exported path in TypeScript 7+, so find the bin through package.json
if (pkgPath)
    tsc = { cmd: process.execPath, args: [path.join(path.dirname(pkgPath), JSON.parse(fs.readFileSync(pkgPath, 'utf8')).bin.tsc)] };
else {
    const g = onPath();
    if (!g) {
        console.error('typescript が見つからない。`pnpm add -D typescript @types/node` を実行する（グローバル運用なら `pnpm add -g typescript`。clone 版の svg-diagram は、その clone で `pnpm install` すれば自身の typescript を使う）');
        process.exit(2);
    }
    tsc = { cmd: g, args: [] };
}
// This tool's own copies: the .ts sources in a clone, dist/ in a package.
const here = import.meta.dirname;
const root = fs.existsSync(path.join(here, 'lib', 'dsl.ts')) ? here : path.dirname(here);
const own = (f) => [path.join(root, 'dist', 'lib', `${f}.d.ts`), path.join(root, 'lib', `${f}.ts`)].find(x => fs.existsSync(x));
const paths = {};
for (const [spec, f] of [['svg-diagram', 'dsl'], ['svg-diagram/render', 'render-source']]) {
    const file = own(f);
    if (file && !resolves(spec))
        paths[spec] = [file];
}
const typeRoots = [];
if (!resolves('@types/node/package.json')) {
    // @types/node of this tool (a dependency of a clone; absent from a package): next to it, or in a pnpm store layout
    try {
        typeRoots.push(path.dirname(path.dirname(createRequire(path.join(root, 'package.json')).resolve('@types/node/package.json'))));
    }
    catch { /* not available either: tsc says so */ }
}
let config = '.';
let temp = null;
if (!hasConfig)
    console.error('ℹ tsconfig.json がないので、既定の設定で型検査する（`svg-diagram init` で tsconfig.json を作ると、エディタと同じ設定になる）');
if (!hasConfig || Object.keys(paths).length || typeRoots.length) {
    // a run killed before it could clean up leaves its file behind: drop the ones untouched for an hour (a live run finishes in seconds; going by age, not pid, since a pid means nothing across containers)
    for (const f of fs.readdirSync('.')) {
        if (!/^\.svg-diagram-tsconfig\.[\w-]+\.json$/.test(f))
            continue;
        try {
            if (Date.now() - fs.statSync(f).mtimeMs > 3600_000)
                fs.rmSync(f, { force: true });
        }
        catch { /* gone already */ }
    }
    temp = path.resolve(`.svg-diagram-tsconfig.${process.pid}-${Math.random().toString(36).slice(2, 8)}.json`); // per run (pid + random: pids repeat across containers): parallel runs in one directory must not share (or delete) each other's file
    // The project's own options, to keep what the temporary config would otherwise replace (`paths` and `typeRoots` replace, not merge).
    // A tsconfig with block comments or trailing commas is not read: its `paths` / `typeRoots` are then not kept.
    let project = {};
    if (hasConfig)
        try {
            project = JSON.parse(fs.readFileSync('tsconfig.json', 'utf8').replace(/^\s*\/\/.*$/gm, '')).compilerOptions ?? {};
        }
        catch { /* see above */ }
    const compilerOptions = {};
    if (Object.keys(paths).length) {
        // the project's entries are relative to its baseUrl (else to its tsconfig): made absolute so they keep pointing at the same files
        const base = path.resolve(project.baseUrl ?? '.');
        compilerOptions['paths'] = { ...Object.fromEntries(Object.entries(project.paths ?? {}).map(([k, v]) => [k, v.map(p => path.resolve(base, p))])), ...paths };
    }
    if (typeRoots.length) {
        // the project's other type packages stay visible: its own typeRoots, or the default node_modules/@types
        const mine = project.typeRoots?.map(t => path.resolve(t)) ?? [path.resolve('node_modules', '@types')].filter(t => fs.existsSync(t));
        compilerOptions['typeRoots'] = [...mine, ...typeRoots];
    }
    fs.writeFileSync(temp, JSON.stringify(hasConfig ? { extends: './tsconfig.json', compilerOptions } : {
        compilerOptions: { ...DEFAULT_OPTIONS, ...compilerOptions },
        include: fs.existsSync('diagrams') ? ['diagrams/**/*.ts'] : ['**/*.ts'],
        exclude: ['node_modules', 'dist'],
    }));
    config = temp;
}
// Ctrl-C reaches tsc too; this process waits for it and still removes the temporary config instead of dying first
if (temp)
    process.on('SIGINT', () => { });
// a `tsc.cmd` on Windows only starts through the shell (quoted: it may sit under "Program Files")
const shell = process.platform === 'win32' && !tsc.args.length;
const r = spawnSync(shell ? `"${tsc.cmd}"` : tsc.cmd, [...tsc.args, '-p', config, '--noEmit', ...process.argv.slice(2)], { stdio: 'inherit', shell });
if (temp)
    fs.rmSync(temp, { force: true });
process.exit(r.status ?? 1);
