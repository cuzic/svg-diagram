// Where a figure source named in a page may live (ADR 0031 §3): split from markdown-target.ts, which is otherwise pure. A shell file: it
// reads the working folder and resolves symbolic links.
import fs from 'node:fs';
import path from 'node:path';
/**
 * The absolute path of a source named in a page. The source is imported and run, so it must be inside `root` (default: the
 * working folder): `/etc/x.diagram.ts`, `//host/share/x.diagram.ts`, `C:\x.diagram.ts` and `../../x.diagram.ts` out of the root throw.
 */
export function resolveSource(file, base, root = process.cwd()) {
    if (/^([\\/]|[a-z]:)/i.test(file))
        throw new Error(`${file}: an absolute path is not allowed — write it relative to the page`);
    const abs = path.resolve(base, file);
    const real = (p) => { try {
        return fs.realpathSync(p);
    }
    catch {
        return path.resolve(p);
    } };
    const rel = path.relative(real(root), real(abs));
    if (rel === '..' || rel.startsWith('..' + path.sep) || path.isAbsolute(rel))
        throw new Error(`${file}: outside ${root} — set the root option to allow it`);
    return abs;
}
