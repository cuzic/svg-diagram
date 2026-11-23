import {readFileSync} from 'node:fs';
import path from 'node:path';
import {gzipSync} from 'node:zlib';
import {build} from 'esbuild';

const root = path.resolve(import.meta.dirname, '..');
const limits: {'./browser': number} = JSON.parse(readFileSync(path.join(root, 'bundle-budget.json'), 'utf8'));
const budget = Number(process.env['SVG_DIAGRAM_BROWSER_BUDGET_BYTES'] ?? limits['./browser']);
if (!Number.isSafeInteger(budget) || budget <= 0) {
  throw new Error('./browser の予算が不正です。上限を正の整数（バイト）で指定してください');
}

const {outputFiles: [bundle]} = await build({
  absWorkingDir: root, entryPoints: ['lib/web.ts'], bundle: true, write: false,
  minify: true, format: 'esm', platform: 'browser',
});
if (!bundle) throw new Error('./browser のバンドルがありません。esbuild の設定を確認してください');
const bytes = bundle.contents.byteLength;
const gzip = gzipSync(bundle.contents).byteLength;

console.log('入口         バイト   gzip (バイト)   上限 (バイト)');
console.log(`./browser ${String(bytes).padStart(8)} ${String(gzip).padStart(14)} ${String(budget).padStart(15)}`);
if (bytes > budget) {
  console.error(`./browser が上限を ${bytes - budget} バイト超えました。追加された依存を確認してください`);
  process.exitCode = 1;
}
