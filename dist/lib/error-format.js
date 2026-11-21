export function errorMessage(err) {
    return err instanceof Error ? err.message : String(err);
}
export function buildErrorSite(source, loc) {
    if (!loc)
        return source;
    const at = `${loc.file}:${loc.line}:${loc.column}`;
    return loc.file === source ? at : `${source}: ${at}`;
}
export function formatBuildError(source, err, env = process.env) {
    const head = `✗ ${source}: ${errorMessage(err)}`;
    if (env['SVG_DIAGRAM_DEBUG'] === '1' && err instanceof Error) {
        try {
            const stack = err.stack;
            if (stack)
                return `${head}\n${stack}`;
        }
        catch { /* a user-defined stack getter can throw */ }
    }
    return head;
}
