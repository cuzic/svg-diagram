export function findingLocation(file, { loc, via }) {
    const at = loc && (loc.file === file ? { line: loc.line, column: loc.column } : { location: loc });
    return { ...at, ...(via.length ? { via: via.map(({ line, column }) => ({ line, column })) } : {}) };
}
export function issueLocation(file, issue, resolve) {
    const related = issue.related?.flatMap(ref => {
        const { loc } = resolve(ref);
        return loc ? [loc] : [];
    });
    return { ...findingLocation(file, resolve(issue.loc)), ...(related?.length ? { related } : {}) };
}
/** The JSON form shared by check and the build source map. */
export function layoutFinding(file, issue, resolve) {
    return { file, rule: 'layout', severity: 'error', message: issue.message, ...issueLocation(file, issue, resolve) };
}
