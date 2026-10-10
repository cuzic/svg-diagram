// ESM resolve hook: lets diagram sources `import {...} from 'svg-diagram'`
// regardless of which repo they live in. Registered by build-diagram.ts.
import type {ResolveHookContext as ResolveContext} from 'node:module';

type ResolveResult = {url: string; shortCircuit?: boolean; format?: string | null | undefined; importAttributes?: Record<string, string>};
const DSL = new URL(import.meta.url.endsWith('.ts') ? './dsl.ts' : './dsl.js', import.meta.url).href;
export async function resolve(specifier: string, context: ResolveContext, next: (specifier: string, context: ResolveContext) => ResolveResult | Promise<ResolveResult>): Promise<ResolveResult> {
  if (specifier === 'svg-diagram') return {url: DSL, shortCircuit: true};
  return next(specifier, context);
}
