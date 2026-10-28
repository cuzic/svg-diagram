/** 'YYYY-MM-DD' of a real date, else a message that names where the value came from. */
export function checkToday(v, what) {
    if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v) || new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) !== v)
        throw new Error(`${what} must be a real date 'YYYY-MM-DD' (got ${JSON.stringify(v)}); the clock is never read, so pass the date yourself, e.g. SVG_DIAGRAM_TODAY=$(date +%F)`);
    return v;
}
/** Writes `today` into every gantt that says 'auto'. Returns whether there was one (the date then goes in the SVG's metadata). */
export function fillAutoToday(bands, today) {
    let used = false;
    for (const b of bands)
        if (b.type === 'gantt' && b.today === 'auto') {
            if (today === undefined)
                throw new Error("gantt(): today: 'auto' needs a date: pass --today YYYY-MM-DD (build / check), set SVG_DIAGRAM_TODAY, or put \"today\" in .svg-diagram.json");
            b.today = today;
            used = true;
        }
    return used;
}
