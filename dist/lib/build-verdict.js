/** Check the render result before writing SVG or reusing its layout for a missing map. */
export function assertBuildOutput({ verdict, laidOut, xml }, outPath) {
    if (!verdict.ok) {
        const err = new Error(`build(${outPath}): layout verification failed before any SVG was written:\n  ${verdict.problems.join('\n  ')}`);
        const issues = verdict.issues ?? verdict.problems.map(message => ({ message }));
        Object.defineProperties(err, { issues: { value: issues }, laidOut: { value: laidOut } });
        throw err;
    }
    if (xml.length) {
        const err = new Error(`build(${outPath}): the emitted SVG is not well-formed XML (an <img> would fail to load it):\n  ${xml.join('\n  ')}`);
        Object.defineProperty(err, 'laidOut', { value: laidOut });
        throw err;
    }
}
