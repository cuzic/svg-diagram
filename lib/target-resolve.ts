// Which SVG files does `svg-diagram lint <args>` mean? Pure: the file system is a pair of functions handed in.
// A path is tried relative to the working directory first, then to each folder above it (so a repo-root-relative path works from inside a
// sub-project), and a diagram source (.ts) stands for the SVG it builds (found in the project's svg folder or the usual places beside it).
import path from 'node:path';

export interface TargetIO {
  /** Is there a regular file at this absolute path? */
  isFile(abs: string): boolean;
  /** Absolute paths matching a pattern given relative to the working directory (for a quoted glob the shell did not expand). */
  glob(pattern: string): string[];
}
export interface TargetProblem {arg: string; message: string}
export interface Targets {files: string[]; problems: TargetProblem[]}

const SOURCE = /\.(ts|mts|cts|mjs|cjs|js)$/i;
export const isSourcePath = (a: string): boolean => SOURCE.test(a);
const GLOB = /[*?[{]/;

/** The folder names an SVG usually sits in, next to or one above its source. */
const SIBLING_DIRS = ['svg', 'images', 'img', 'figures'];

/** `svgDirs`: the folders a project names (`--svg-dir`, `outDir`), relative to cwd, tried first for a source's SVG. */
export function resolveTargets(args: string[], o: {cwd: string; io: TargetIO; svgDirs: string[]}): Targets {
  const files: string[] = [], problems: TargetProblem[] = [];
  const ancestors = (from: string): string[] => { const out = [from]; for (let d = from; path.dirname(d) !== d; d = path.dirname(d)) out.push(path.dirname(d)); return out; };
  const rel = (abs: string) => path.relative(o.cwd, abs) || '.';
  /** The file `a` names: from cwd, then from each folder above it. */
  const find = (a: string, tried: string[]): string | null => {
    if (path.isAbsolute(a)) { tried.push(a); return o.io.isFile(a) ? a : null; }
    for (const base of ancestors(o.cwd)) {
      const abs = path.resolve(base, a);
      tried.push(rel(abs));
      if (o.io.isFile(abs)) return abs;
    }
    return null;
  };
  const add = (f: string) => { if (!files.includes(f)) files.push(f); };
  /** lint reads SVGs: a source is mapped to the SVG it was built into. */
  const resolveSource = (src: string): void => {
    const name = path.parse(src).name + '.svg', dir = path.dirname(src);
    const cands = [
      ...o.svgDirs.map(d => path.resolve(o.cwd, d, name)),
      ...SIBLING_DIRS.flatMap(d => [path.join(dir, d, name), path.join(dir, '..', d, name)]),
      path.join(dir, name),
    ];
    const hit = cands.find(c => o.io.isFile(c));
    if (hit) add(hit);
    else problems.push({arg: src, message: `${rel(src)} is a diagram source; lint checks the SVG it builds, and none was found. Looked for: ${[...new Set(cands.map(rel))].join(', ')}. Build it first (svg-diagram build ${rel(src)}), or name the SVG / pass --svg-dir DIR`});
  };
  for (const a of args) {
    if (GLOB.test(a)) {
      const hits = o.io.glob(a).sort();
      if (!hits.length) problems.push({arg: a, message: `${a}: no file matches this pattern (looked from ${o.cwd}). The shell leaves a pattern unexpanded when nothing matches; check the folder`});
      for (const h of hits) { if (isSourcePath(h)) resolveSource(h); else add(h); }
      continue;
    }
    const tried: string[] = [];
    const abs = find(a, tried);
    if (!abs) {
      problems.push({arg: a, message: `${a}: no such ${isSourcePath(a) ? 'diagram source' : 'SVG'}. Paths are tried relative to the working directory (${o.cwd}), then to each folder above it. Looked for: ${tried.join(', ')}`});
      continue;
    }
    if (isSourcePath(a)) resolveSource(abs); else add(abs);
  }
  return {files, problems};
}
