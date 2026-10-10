#!/usr/bin/env node
// svg-diagram init [dir] — make a project ready to hold diagram sources:
//   package.json   created if missing; "type": "module" added if absent (tsc reads .ts as CommonJS without it)
//   tsconfig.json  created if missing (checks the sources the way the tool itself is checked)
//   pnpm-workspace.yaml  created if missing, allowing playwright-chromium's install script (else pnpm stops with ERR_PNPM_IGNORED_BUILDS)
// Existing files are never overwritten beyond adding "type": "module".
import fs from 'node:fs';
import path from 'node:path';

const dir = path.resolve(process.argv[2] ?? '.');
fs.mkdirSync(dir, {recursive: true});

const pkgPath = path.join(dir, 'package.json');
if (!fs.existsSync(pkgPath)) {
  fs.writeFileSync(pkgPath, JSON.stringify({private: true, type: 'module'}, null, 2) + '\n');
  console.log('✓ package.json を作成（"type": "module"）');
} else {
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  if (pkg.type === 'module') console.log('· package.json は "type": "module" 済み');
  else if (pkg.type === undefined) {
    fs.writeFileSync(pkgPath, JSON.stringify({...pkg, type: 'module'}, null, 2) + '\n');
    console.log('✓ package.json に "type": "module" を追加');
  } else console.warn(`⚠ package.json の "type" が "${pkg.type}" 。図のソース(.ts)は ES モジュールとして型検査するため、"module" にするか、図専用のディレクトリに別の package.json を置く`);
}

const tsPath = path.join(dir, 'tsconfig.json');
if (fs.existsSync(tsPath)) console.log('· tsconfig.json は既にある（変更しない）');
else {
  fs.writeFileSync(tsPath, JSON.stringify({
    compilerOptions: {
      target: 'es2023', module: 'nodenext', moduleResolution: 'nodenext',
      allowImportingTsExtensions: true, noEmit: true, erasableSyntaxOnly: true,
      verbatimModuleSyntax: true, strict: true, skipLibCheck: true,
    },
    include: ['diagrams/**/*.ts'],
  }, null, 2) + '\n');
  console.log('✓ tsconfig.json を作成（対象: diagrams/**/*.ts）');
}

const wsPath = path.join(dir, 'pnpm-workspace.yaml');
const parentWs = (() => { for (let p = path.dirname(dir); ; p = path.dirname(p)) { if (fs.existsSync(path.join(p, 'pnpm-workspace.yaml'))) return p; if (p === path.dirname(p)) return null; } })();
if (!fs.existsSync(wsPath) && parentWs) {
  console.log(`· ${parentWs} に pnpm-workspace.yaml がある（入れ子のワークスペースになるので、ここには作らない）。playwright-chromium のビルド許可はそちらに書く`);
} else if (!fs.existsSync(wsPath)) {
  fs.writeFileSync(wsPath, 'allowBuilds:\n  playwright-chromium: true\n');
  console.log('✓ pnpm-workspace.yaml を作成（playwright-chromium のビルドを許可。文字幅の測定に使う Chromium の取得に必要）');
} else if (!/playwright-chromium\s*:\s*true|-\s*playwright-chromium/.test(fs.readFileSync(wsPath, 'utf8'))) {
  console.warn('⚠ pnpm-workspace.yaml に playwright-chromium の許可がない。ERR_PNPM_IGNORED_BUILDS になるなら、allowBuilds に `playwright-chromium: true` を足す（または `pnpm approve-builds`）');
} else console.log('· pnpm-workspace.yaml は playwright-chromium を許可済み');
console.log('次: pnpm add -D typescript @types/node  →  svg-diagram typecheck');
