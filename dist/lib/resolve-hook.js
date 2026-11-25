// ESM resolve hook: lets diagram sources import svg-diagram and its public code subpaths
// regardless of which repo they live in. Registered by build-diagram.ts.
//
// It also makes a fresh load fresh all the way down: load-source.ts imports a source as `x.ts?svg-diagram-fresh=<n>` when asked
// for a re-read (a watcher), and every local file that import graph pulls in gets the same query here, so an edited helper is
// read again, not served from the module cache. svg-diagram's own modules and node_modules keep their URLs: they hold state
// that must stay one copy.
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
const IS_SOURCE = import.meta.url.endsWith('.ts');
const DSL = new URL(IS_SOURCE ? './dsl.ts' : './dsl.js', import.meta.url).href;
const OWN = new URL('.', import.meta.url).href;
const PACKAGE_ROOT = new URL(IS_SOURCE ? '../' : '../../', OWN);
const PACKAGE_PREFIX = 'svg-diagram/';
export const FRESH_PARAM = 'svg-diagram-fresh';
const FRESH = new RegExp(`[?&](${FRESH_PARAM}=\\d+)`);
let packageExports;
function resolvePackage(specifier) {
    if (specifier === 'svg-diagram')
        return { url: DSL, shortCircuit: true };
    if (!specifier.startsWith(PACKAGE_PREFIX) || specifier.includes('*'))
        return undefined;
    packageExports ??= JSON.parse(readFileSync(new URL('package.json', PACKAGE_ROOT), 'utf8')).exports;
    const entry = packageExports[`./${specifier.slice(PACKAGE_PREFIX.length)}`];
    const target = typeof entry === 'string' ? entry : entry?.node ?? entry?.default;
    if (!target?.endsWith('.js'))
        return undefined;
    const file = IS_SOURCE ? target.replace(/^\.\/dist\/(.+)\.js$/, './$1.ts') : target;
    return { url: new URL(file, PACKAGE_ROOT).href, shortCircuit: true };
}
let onResolved = null;
/** Have every local file a source imports reported to `fn` (null: stop), as a file: URL with no query: what `serve` watches (ADR 0056 D5). */
export function recordResolved(fn) { onResolved = fn; }
/** The two hook flavours differ only in how `next` answers (a value, or a promise of one), so the tag rewrite is shared. */
function tagged(resolved, context) {
    if (onResolved && resolved.url.startsWith('file:') && !resolved.url.includes('/node_modules/') && !resolved.url.startsWith(OWN))
        onResolved(resolved.url.replace(/[?#].*$/, ''));
    const tag = context.parentURL ? FRESH.exec(context.parentURL)?.[1] : undefined;
    if (tag && resolved.url.startsWith('file:') && !resolved.url.includes('/node_modules/') && !resolved.url.startsWith(OWN) && !FRESH.test(resolved.url)) {
        return { ...resolved, url: `${resolved.url}${resolved.url.includes('?') ? '&' : '?'}${tag}` };
    }
    return resolved;
}
export async function resolve(specifier, context, next) {
    return resolvePackage(specifier) ?? tagged(await next(specifier, context), context);
}
/** The same hook, in-thread. `module.register` starts a loader thread that loads the type stripper again: about two seconds per process, for every CLI run. */
export function installResolveHook() {
    registerHooks({
        resolve: (specifier, context, next) => resolvePackage(specifier) ?? tagged(next(specifier, context), context),
    });
}
