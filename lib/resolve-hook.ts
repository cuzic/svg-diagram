// ESM resolve hook: lets diagram sources `import {...} from 'svg-diagram'`
// regardless of which repo they live in. Registered by build-diagram.ts.
//
// It also makes a fresh load fresh all the way down: load-source.ts imports a source as `x.ts?svg-diagram-fresh=<n>` when asked
// for a re-read (a watcher), and every local file that import graph pulls in gets the same query here, so an edited helper is
// read again, not served from the module cache. svg-diagram's own modules and node_modules keep their URLs: they hold state
// that must stay one copy.
import type {ResolveHookContext as ResolveContext} from 'node:module';

type ResolveResult = {url: string; shortCircuit?: boolean; format?: string | null | undefined; importAttributes?: Record<string, string>};
const DSL = new URL(import.meta.url.endsWith('.ts') ? './dsl.ts' : './dsl.js', import.meta.url).href;
const OWN = new URL('.', import.meta.url).href;
export const FRESH_PARAM = 'svg-diagram-fresh';
const FRESH = new RegExp(`[?&](${FRESH_PARAM}=\\d+)`);

export async function resolve(specifier: string, context: ResolveContext, next: (specifier: string, context: ResolveContext) => ResolveResult | Promise<ResolveResult>): Promise<ResolveResult> {
  if (specifier === 'svg-diagram') return {url: DSL, shortCircuit: true};
  const resolved = await next(specifier, context);
  const tag = context.parentURL ? FRESH.exec(context.parentURL)?.[1] : undefined;
  if (tag && resolved.url.startsWith('file:') && !resolved.url.includes('/node_modules/') && !resolved.url.startsWith(OWN) && !FRESH.test(resolved.url)) {
    return {...resolved, url: `${resolved.url}${resolved.url.includes('?') ? '&' : '?'}${tag}`};
  }
  return resolved;
}
