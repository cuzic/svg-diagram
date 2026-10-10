const DSL = new URL(import.meta.url.endsWith('.ts') ? './dsl.ts' : './dsl.js', import.meta.url).href;
export async function resolve(specifier, context, next) {
    if (specifier === 'svg-diagram')
        return { url: DSL, shortCircuit: true };
    return next(specifier, context);
}
