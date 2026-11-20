// The project's installed path icons: svg-diagram.icons.json, found from the current directory like .svg-diagram.json. This is the
// shell side of icons.ts (it reads a file and process.cwd(), which the rendering core must not): box() resolves the glyph here
// and carries it on the band.
import { MANIFEST_FILE, parseManifest } from './icon-store.js';
import { EMOJIS, emojiIcons, own } from './icons.js';
import { must } from './must.js';
// Found like .svg-diagram.json: svg-diagram.icons.json in the current directory or the nearest parent. Read once per directory;
// icon.use() points a process at a file or a manifest explicitly (tests, tools that render for several projects).
// fs / path come from process.getBuiltinModule (Node 22.3+, engines >= 22.18), not an import: a bundle for a web page has no node:* to resolve, and
// there `process` is absent, so the manifest comes only from icon.use() (lib/web.ts).
const nodeFs = () => globalThis.process?.getBuiltinModule?.('node:fs');
const nodePath = () => globalThis.process?.getBuiltinModule?.('node:path');
let explicit;
const found = new Map();
/** Path of the manifest that applies from `from`, or undefined. */
export function findManifest(from = globalThis.process?.cwd?.()) {
    const fs = nodeFs(), path = nodePath();
    if (!fs || !path || from === undefined)
        return undefined;
    let dir = path.resolve(from);
    for (;;) {
        const f = path.join(dir, MANIFEST_FILE);
        if (fs.existsSync(f))
            return f;
        const up = path.dirname(dir);
        if (up === dir)
            return undefined;
        dir = up;
    }
}
function installed() {
    if (explicit)
        return explicit;
    const file = findManifest();
    if (!file)
        return undefined;
    let m = found.get(file);
    if (!m)
        found.set(file, m = parseManifest(must(nodeFs()).readFileSync(file, 'utf8'), file));
    return m;
}
/** The installed glyph for a name, or undefined. */
export function glyphOf(name) {
    const m = installed();
    return m && own(m.icons, name) ? m.icons[name] : undefined;
}
function installedNames() {
    return Object.keys(installed()?.icons ?? {});
}
export const icon = {
    ...emojiIcons,
    /** Which sets have this name: `path` for box({icon}) / iconRow() (installed in the project), `emoji` for icon.emoji(). */
    has(name) {
        return { path: glyphOf(name) !== undefined, emoji: own(EMOJIS, name) };
    },
    /** The path icons this project installed. */
    get pathNames() { return installedNames(); },
    /** Use this manifest (an object, or the text of a svg-diagram.icons.json) instead of looking for the file. `undefined` goes back to the file. */
    use(manifest) {
        explicit = typeof manifest === 'string' ? parseManifest(manifest, 'icon.use()') : manifest;
    },
};
/** box({icon}) / iconRow(): the installed glyph, or a throw that says how to install it. */
export function resolveIcon(name, caller) {
    const g = glyphOf(name);
    if (g)
        return g;
    const have = installedNames();
    if (!nodeFs()) {
        throw new Error(`${caller}: icon "${name}" is not in the manifest given to icon.use()${explicit ? '' : ' (none given — this runtime cannot read svg-diagram.icons.json, so pass the manifest with icon.use(manifest))'}${have.length ? `; installed: ${have.join(', ')}` : ''}`);
    }
    const where = findManifest() ?? `${MANIFEST_FILE} (none found from ${globalThis.process?.cwd?.() ?? 'here'})`;
    throw new Error(`${caller}: icon "${name}" is not installed in ${where}${have.length ? ` — installed: ${have.join(', ')}` : ''}. Install one: svg-diagram icons add mdi:<icon>=${/^[A-Za-z][\w-]*$/.test(name) ? name : 'name'}  (find: svg-diagram icons search <word>)`);
}
