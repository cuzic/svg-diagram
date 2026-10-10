// ESM resolve hook: lets diagram sources `import {...} from 'svg-diagram'`
// regardless of which repo they live in. Registered by build-diagram.ts.
const DSL = new URL('./dsl.ts', import.meta.url).href;
export async function resolve(specifier, context, next) {
  if (specifier === 'svg-diagram') return {url: DSL, shortCircuit: true};
  return next(specifier, context);
}
