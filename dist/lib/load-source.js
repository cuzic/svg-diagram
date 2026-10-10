var __rewriteRelativeImportExtension = (this && this.__rewriteRelativeImportExtension) || function (path, preserveJsx) {
    if (typeof path === "string" && /^\.\.?\//.test(path)) {
        return path.replace(/\.(tsx)$|((?:\.d)?)((?:\.[^./]+?)?)\.([cm]?)ts$/i, function (m, tsx, d, ext, cm) {
            return tsx ? preserveJsx ? ".jsx" : ".js" : d && (!ext || !cm) ? m : (d + ext + "." + cm.toLowerCase() + "js");
        });
    }
    return path;
};
// Reading a diagram source (a .ts whose default export builds a diagram()) into a Diagram — the one place the CLIs
// (build, check, notes, show) do it, so a change to how a source is loaded lands in all of them.
//
// This is not in dsl.ts on purpose: dsl.ts is the module a diagram source imports (`from 'svg-diagram'`), and a loader
// that imports sources does not belong in that public surface. The caller still registers lib/resolve-hook first (each
// CLI entry does), because that hook has to be in place before the first source is imported.
import { pathToFileURL } from 'node:url';
import { applyConfig, loadConfig } from './config.js';
/** `abs`'s default export, or an error that says what a source should export. */
export async function importDefine(abs) {
    const mod = await import(__rewriteRelativeImportExtension(pathToFileURL(abs).href));
    if (typeof mod.default !== 'function')
        throw new Error(`${abs}: no default export function — export default function define() { return diagram(...) }`);
    return mod.default;
}
/** Import `abs`, run its define(), and apply the project's .svg-diagram.json (accepted rules, max width). */
export async function loadDiagram(abs, config = loadConfig()) {
    return applyConfig((await importDefine(abs))(), config);
}
