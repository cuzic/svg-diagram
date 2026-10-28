/** The engine is `SVG_DIAGRAM_MEASURE` if set, else the config's `measure`; unset everywhere it is 'font' by default (and not `explicit`). */
export function measureSettingsOf(cfg) {
    const env = process.env['SVG_DIAGRAM_MEASURE'] || undefined; // empty counts as unset
    if (env && env !== 'chromium' && env !== 'font')
        throw new Error(`SVG_DIAGRAM_MEASURE=${env}: expected 'chromium' or 'font'`);
    const chosen = env ?? cfg.measure;
    return { backend: chosen ?? 'font', explicit: chosen !== undefined, ...(cfg.fonts ? { fonts: cfg.fonts } : {}) };
}
