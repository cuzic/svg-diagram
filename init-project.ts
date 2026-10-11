#!/usr/bin/env node
// svg-diagram init [dir] — make a project ready to hold diagram sources:
//   package.json   created if missing; "type": "module" added if absent (tsc reads .ts as CommonJS without it)
//   tsconfig.json  created if missing (checks the sources the way the tool itself is checked)
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

// The browser is optional now (layout and the default checks need none): no pnpm-workspace.yaml is needed for it. Say how to add it.
console.log('· Chromium は不要（レイアウトも既定の検査もブラウザなしで動く）。`lint --engine browser` や slide の空き寸法の実測を使うときだけ: pnpm add -D playwright-chromium（pnpm 10 以降は pnpm approve-builds も）');
console.log('次: pnpm add -D typescript @types/node  →  svg-diagram typecheck');
