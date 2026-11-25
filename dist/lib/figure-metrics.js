/** Left and right margins of the whole figure that differ by this much or more (the figure sits to one side). */
export const FIGURE_OFFSET_PX = 48;
/** The content is narrower than this share of the figure width. */
export const FIGURE_NARROW_RATIO = 0.5;
const right = (r) => r.x + r.w;
const bottom = (r) => r.y + r.h;
/** The rect a band covers, when it has one (a grid has no h of its own: its children carry it). */
export function extentOf(b) {
    return b.type === 'grid' ? unionOf(b.children) : basicExtentOf(b);
}
export function basicExtentOf(b) {
    const x = b;
    if (typeof x.x !== 'number' || typeof x.y !== 'number' || typeof x.w !== 'number' || typeof x.h !== 'number')
        return null;
    const r = { x: x.x, y: x.y, w: x.w, h: x.h };
    return x.labelBoxes?.length ? unionOf([r, ...x.labelBoxes]) : r;
}
export function unionOf(rs) {
    if (!rs.length)
        return null;
    const x0 = Math.min(...rs.map(r => r.x)), y0 = Math.min(...rs.map(r => r.y)), x1 = Math.max(...rs.map(right)), y1 = Math.max(...rs.map(bottom));
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}
/** Bounding box of figure content, excluding titles, source lines, status and legends. */
export function contentExtent(laidOut, extent = extentOf) {
    const visible = laidOut.filter(b => b.type !== 'caption' && b.type !== 'legend' && b.type !== 'status');
    return unionOf(visible.map(extent).filter((r) => r !== null));
}
/** Measure whole-figure spacing for layouts without a fixed slide canvas. */
export function figureLayoutMetrics(laidOut, width) {
    return figureMetricsForExtent(contentExtent(laidOut), width);
}
export function figureMetricsForExtent(box, width) {
    const out = [];
    if (!box)
        return out;
    const left = box.x, rightMargin = width - right(box), off = Math.abs(left - rightMargin);
    if (off >= FIGURE_OFFSET_PX)
        out.push({ rule: 'layout-figure-offset', message: `内容の左の余白が ${Math.round(left)}px、右が ${Math.round(rightMargin)}px で、${Math.round(off)}px の差がある。図が左右どちらかに寄っている`, data: { measured: Math.round(off), threshold: FIGURE_OFFSET_PX, fix: '図の部品全体を中央に置く（row の justify: center、図形とラベルの外接で寄せる）' } });
    if (box.w < FIGURE_NARROW_RATIO * width)
        out.push({ rule: 'layout-figure-narrow', message: `内容の幅が ${Math.round(box.w)}px で、図の幅 ${width}px の ${Math.round(100 * box.w / width)}% しかない。diagram({width}) で内容に合わせて狭めると余白が減る`, data: { measured: Math.round(box.w), threshold: Math.round(FIGURE_NARROW_RATIO * width), fix: 'diagram({width}) を内容に合わせて小さくする' } });
    return out;
}
/** A layout metric as a finding, keeping the key order rule, severity, message, data. */
export function layoutFinding({ rule, message, data, ...location }, layoutCheck) {
    return { rule, severity: layoutCheck === 'strict' ? 'warn' : 'info', message, data, ...location };
}
