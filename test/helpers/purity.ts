// ADR 0031 §1: the pieces of the purity check — what a lib file imports, and what in its code is not pure. Shared by
// test/core-purity.test.ts and by the one-off scripts that regenerate its SHELL list.
import fs from 'node:fs';
import path from 'node:path';

export const LIB = path.resolve(import.meta.dirname, '../../lib');

/** Every lib/**.ts, as a name without the extension ('dsl/render', 'emit'). */
export function libFiles(dir: string = LIB, prefix = ''): string[] {
  return fs.readdirSync(dir, {withFileTypes: true}).flatMap(e => e.isDirectory() ? libFiles(path.join(dir, e.name), `${prefix}${e.name}/`) : e.name.endsWith('.ts') ? [`${prefix}${e.name.slice(0, -3)}`] : []);
}

/** The source with comments, string literals and template literals blanked out (a word in a message or a type is not a use). */
export function code(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1')
    .replace(/`(?:\\[\s\S]|[^`\\])*`/g, '``')
    .replace(/'(?:\\.|[^'\\\n])*'/g, "''")
    .replace(/"(?:\\.|[^"\\\n])*"/g, '""');
}

export interface Imports {local: string[]; external: string[]}

/** Runtime imports (a type-only import is erased and does not count), static, side-effect and dynamic. */
export function importsOf(file: string): Imports {
  const src = fs.readFileSync(file, 'utf8').replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  const local: string[] = [], external: string[] = [];
  const add = (spec: string) => (spec.startsWith('.') ? local : external).push(spec);
  for (const m of src.matchAll(/^\s*(import|export)\s+(?!type\b)[^;'"]*?from\s+['"]([^'"]+)['"]/gm)) add(m[2]!);
  for (const m of src.matchAll(/^\s*import\s+['"]([^'"]+)['"]/gm)) add(m[1]!);
  for (const m of src.matchAll(/\bimport\(\s*['"]([^'"]+)['"]\s*\)/g)) add(m[1]!);
  return {local, external};
}

/** A lib file named by an import specifier of `from` ('./wrap.ts' → 'wrap'). */
export const resolveLocal = (from: string, spec: string): string => path.relative(LIB, path.resolve(path.dirname(path.join(LIB, from + '.ts')), spec.replace(/\.js$/, '.ts'))).replace(/\.ts$/, '');

/** Modules that touch the filesystem, a process, the network, a browser or a font file. `node:crypto` is allowed for createHash (see CRYPTO_RANDOM). */
export const FORBIDDEN = /^(node:)?(fs|fs\/promises|child_process|net|http|https|os|worker_threads|process|module|vm|dns|tty|readline|zlib)$|^playwright|^@resvg|^harfbuzzjs|^sixel$/;

/** The reasons a file's own code is not pure, each as a short rule name. */
export function violations(file: string): string[] {
  const raw = fs.readFileSync(file, 'utf8'), src = code(raw), out: string[] = [];
  for (const e of importsOf(file).external) if (FORBIDDEN.test(e)) out.push(`imports ${e}`);
  if (/\bprocess\b(?!\s*:)/.test(src)) out.push('uses process');
  if (/\bDate\.now\(|\bnew Date\(\s*\)|\bMath\.random\(|\bperformance\.now\(|\b(?:randomUUID|randomBytes|getRandomValues)\b/.test(src)) out.push('reads the clock or a random source');
  if (/\bpath\.resolve\(|\bcwd\(\)/.test(src)) out.push('reads the working directory');
  if (localeCompareWithoutLocale(src)) out.push('localeCompare without a locale');
  if (/\bIntl\.\w+\(\s*undefined\b|\.toLocale\w*\(\s*\)/.test(src)) out.push('depends on the default locale');
  for (const _ of src.matchAll(/^let\s/gm)) out.push('top-level let');
  for (const m of src.matchAll(/^(?:export\s+)?const\s+\w+\s*(:[^=]*)?=\s*new\s+(Map|Set|WeakMap|WeakSet)\b/gm)) {
    if (!(m[1] ?? '').trim().replace(/^:\s*/, '').startsWith('Readonly')) out.push(`top-level mutable ${m[2]}`);
  }
  return out;
}

/** `.localeCompare(x)` with one argument (the default locale decides the order). */
function localeCompareWithoutLocale(src: string): boolean {
  for (let i = src.indexOf('.localeCompare('); i !== -1; i = src.indexOf('.localeCompare(', i + 1)) {
    let depth = 0, commas = 0;
    for (let j = i + '.localeCompare('.length - 1; j < src.length; j++) {
      const c = src[j];
      if (c === '(' || c === '[' || c === '{') depth++;
      else if (c === ')' || c === ']' || c === '}') { if (--depth === 0) break; }
      else if (c === ',' && depth === 1) commas++;
    }
    if (commas === 0) return true;
  }
  return false;
}
