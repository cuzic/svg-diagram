// ADR 0072 D3: resolve paths and positions from stack data. The CLI supplies the filesystem operations.
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
function filePath(value, cwd) {
    if (value.startsWith('file://')) {
        try {
            return fileURLToPath(value);
        }
        catch {
            return undefined;
        }
    }
    const file = value.split('?svg-diagram-fresh=', 1)[0];
    if (!file || file.startsWith('node:'))
        return undefined;
    if (path.isAbsolute(file))
        return file;
    return cwd === undefined ? undefined : path.join(cwd, file);
}
function inside(parent, file) {
    const relative = path.relative(parent, file);
    return relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative);
}
function* textFrames(lines) {
    for (const line of lines.slice(1)) {
        const match = /^\s+at (?:async )?(.+):(\d+):(\d+)(\)?)$/.exec(line);
        if (!match)
            continue;
        const [, target = '', row, column, close] = match;
        const open = close ? target.indexOf(' (') : -1;
        const file = open < 0 ? target : target.slice(open + 2);
        yield { file, line: Number(row), column: Number(column) };
    }
}
// Unicode 15.1.0 East_Asian_Width W and F ranges, including reserved ideographs.
const EAST_ASIAN_WIDE = new RegExp('[' +
    '\\u1100-\\u115f\\u231a-\\u231b\\u2329-\\u232a\\u23e9-\\u23ec\\u23f0\\u23f3\\u25fd-\\u25fe\\u2614-\\u2615\\u2648-\\u2653\\u267f' +
    '\\u2693\\u26a1\\u26aa-\\u26ab\\u26bd-\\u26be\\u26c4-\\u26c5\\u26ce\\u26d4\\u26ea\\u26f2-\\u26f3\\u26f5\\u26fa\\u26fd\\u2705' +
    '\\u270a-\\u270b\\u2728\\u274c\\u274e\\u2753-\\u2755\\u2757\\u2795-\\u2797\\u27b0\\u27bf\\u2b1b-\\u2b1c\\u2b50\\u2b55' +
    '\\u2e80-\\u2e99\\u2e9b-\\u2ef3\\u2f00-\\u2fd5\\u2ff0-\\u303e\\u3041-\\u3096\\u3099-\\u30ff\\u3105-\\u312f\\u3131-\\u318e' +
    '\\u3190-\\u31e3\\u31ef-\\u321e\\u3220-\\u3247\\u3250-\\u4dbf\\u4e00-\\ua48c\\ua490-\\ua4c6\\ua960-\\ua97c\\uac00-\\ud7a3' +
    '\\uf900-\\ufaff\\ufe10-\\ufe19\\ufe30-\\ufe52\\ufe54-\\ufe66\\ufe68-\\ufe6b\\uff01-\\uff60\\uffe0-\\uffe6\\u{16fe0}-\\u{16fe4}' +
    '\\u{16ff0}-\\u{16ff1}\\u{17000}-\\u{187f7}\\u{18800}-\\u{18cd5}\\u{18d00}-\\u{18d08}\\u{1aff0}-\\u{1aff3}' +
    '\\u{1aff5}-\\u{1affb}\\u{1affd}-\\u{1affe}\\u{1b000}-\\u{1b122}\\u{1b132}\\u{1b150}-\\u{1b152}\\u{1b155}' +
    '\\u{1b164}-\\u{1b167}\\u{1b170}-\\u{1b2fb}\\u{1f004}\\u{1f0cf}\\u{1f18e}\\u{1f191}-\\u{1f19a}\\u{1f200}-\\u{1f202}' +
    '\\u{1f210}-\\u{1f23b}\\u{1f240}-\\u{1f248}\\u{1f250}-\\u{1f251}\\u{1f260}-\\u{1f265}\\u{1f300}-\\u{1f320}' +
    '\\u{1f32d}-\\u{1f335}\\u{1f337}-\\u{1f37c}\\u{1f37e}-\\u{1f393}\\u{1f3a0}-\\u{1f3ca}\\u{1f3cf}-\\u{1f3d3}' +
    '\\u{1f3e0}-\\u{1f3f0}\\u{1f3f4}\\u{1f3f8}-\\u{1f43e}\\u{1f440}\\u{1f442}-\\u{1f4fc}\\u{1f4ff}-\\u{1f53d}' +
    '\\u{1f54b}-\\u{1f54e}\\u{1f550}-\\u{1f567}\\u{1f57a}\\u{1f595}-\\u{1f596}\\u{1f5a4}\\u{1f5fb}-\\u{1f64f}' +
    '\\u{1f680}-\\u{1f6c5}\\u{1f6cc}\\u{1f6d0}-\\u{1f6d2}\\u{1f6d5}-\\u{1f6d7}\\u{1f6dc}-\\u{1f6df}\\u{1f6eb}-\\u{1f6ec}' +
    '\\u{1f6f4}-\\u{1f6fc}\\u{1f7e0}-\\u{1f7eb}\\u{1f7f0}\\u{1f90c}-\\u{1f93a}\\u{1f93c}-\\u{1f945}\\u{1f947}-\\u{1f9ff}' +
    '\\u{1fa70}-\\u{1fa7c}\\u{1fa80}-\\u{1fa88}\\u{1fa90}-\\u{1fabd}\\u{1fabf}-\\u{1fac5}\\u{1face}-\\u{1fadb}' +
    '\\u{1fae0}-\\u{1fae8}\\u{1faf0}-\\u{1faf8}\\u{20000}-\\u{2fffd}\\u{30000}-\\u{3fffd}' +
    ']', 'u');
function utf16Offset(line, caret) {
    let width = 0, offset = 0;
    for (const ch of line) {
        if (width >= caret)
            break;
        width += ch === '\t' ? 4 - width % 4 : EAST_ASIAN_WIDE.test(ch) ? 2 : 1;
        offset += ch.length;
    }
    return offset;
}
function headerLocation(lines, error, { cwd, readSource }) {
    const header = /^(.+):(\d+)$/.exec(lines[0] ?? '');
    if (!header)
        return undefined;
    const typescript = error.code === 'ERR_INVALID_TYPESCRIPT_SYNTAX' || error.code === 'ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX';
    // Node's type stripper adds surrounding source lines to its code frame. V8 prints a single source line.
    let caretLine = 2;
    if (typescript) {
        while (caretLine < lines.length && !/^\s*\^+\s*$|^SyntaxError\b/.test(lines[caretLine] ?? ''))
            caretLine++;
    }
    const caret = lines[caretLine] ?? '';
    if (!/^\s*\^+\s*$/.test(caret))
        return undefined;
    const file = filePath(header[1] ?? '', cwd);
    const line = Number(header[2]);
    if (!file || !line)
        return undefined;
    const offset = caret.indexOf('^');
    const original = typescript ? readSource?.(file)?.split(/\r?\n/)[line - 1] : undefined;
    return { file, line, column: (original !== undefined ? utf16Offset(original, offset) : offset) + 1 };
}
// Skip comments and other strings so their text cannot point earlier than the actual import.
const IMPORT_SPECIFIERS = /\/\/[^\r\n]*|\/\*[\s\S]*?\*\/|\b(?:from\s*|import\s*(?:\(\s*)?)(?<quote>['"])(?<specifier>(?:\\.|(?!\k<quote>)[^\\\r\n])*)\k<quote>|"(?:\\[\s\S]|[^"\\])*"|'(?:\\[\s\S]|[^'\\])*'|`(?:\\[\s\S]|[^`\\])*`/g;
function missingImport(error, source, context) {
    if (error.code !== 'ERR_MODULE_NOT_FOUND')
        return undefined;
    const match = /^Cannot find (module|package) '(.+)' imported from (.+)$/m.exec(error.message ?? '');
    if (!match)
        return undefined;
    const [, kind, name = '', from = ''] = match;
    const importer = filePath(from);
    if (!importer || context.realpath(importer) !== source)
        return undefined;
    const text = context.readSource?.(importer);
    if (text === undefined)
        return undefined;
    const target = kind === 'module' ? filePath(name) : undefined;
    const base = pathToFileURL(importer);
    for (const candidate of text.matchAll(IMPORT_SPECIFIERS)) {
        const specifier = candidate.groups?.['specifier'];
        if (specifier === undefined)
            continue;
        if (kind === 'package' ? specifier !== name : !target || resolveSpecifier(specifier, base) !== target)
            continue;
        const start = candidate.index + candidate[0].length - specifier.length - 1;
        const prefix = text.slice(0, start);
        return { file: context.source, line: prefix.split('\n').length, column: start - prefix.lastIndexOf('\n') };
    }
    return undefined;
}
function resolveSpecifier(specifier, base) {
    if (!/^(?:\.{1,2}(?:\/|$)|\/|file:\/\/)/.test(specifier))
        return undefined;
    try {
        return fileURLToPath(new URL(specifier, base));
    }
    catch {
        return undefined;
    }
}
export function resolveErrorLocation(error, context) {
    const { source, cwd, realpath } = context;
    const checked = realpath(path.isAbsolute(source) ? path.normalize(source) : path.join(cwd, source));
    const physicalCwd = realpath(cwd);
    const displayFile = (file) => {
        if (file === checked)
            return source;
        return path.relative(inside(physicalCwd, file) ? physicalCwd : cwd, file);
    };
    const lines = error.stack?.split(/\r?\n/) ?? [];
    const header = headerLocation(lines, error, context);
    if (header)
        return { loc: { ...header, file: displayFile(realpath(header.file)) }, via: [] };
    const specifier = missingImport(error, checked, context);
    if (specifier)
        return { loc: specifier, via: [] };
    const packageDir = realpath(context.packageDir);
    const lib = realpath(path.join(packageDir, 'lib'));
    const dist = realpath(path.join(packageDir, 'dist'));
    const select = (frames) => {
        let fallback;
        const inSource = [];
        for (const frame of frames) {
            const file = filePath(frame.file);
            if (!file || !frame.line || !frame.column)
                continue;
            const canonical = realpath(file);
            if (canonical === checked) {
                inSource.push({ ...frame, file: source });
                if (inSource.length === 6)
                    break;
                continue;
            }
            if (inside(lib, canonical) || inside(dist, canonical))
                continue;
            if (path.dirname(canonical) === packageDir && /\.(?:ts|js)$/.test(canonical))
                continue;
            fallback ??= { ...frame, file: displayFile(canonical) };
        }
        const [loc = fallback, ...via] = inSource;
        return { loc, via };
    };
    const captured = select(error.frames ?? []);
    if (captured.loc)
        return captured;
    const parsed = select(textFrames(lines));
    return parsed.loc ? parsed : { via: [] };
}
