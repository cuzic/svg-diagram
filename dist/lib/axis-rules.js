// Charts compared side by side or one under the other with different value axes (pure: reads the bands the author wrote).
// Two bars of 5.76 and 9.5 that are drawn the same length because each chart scaled itself to its own data are the misreading this finds.
import { nestedBandsOf } from './band-children.js';
import { waterfallScale } from './charts-waterfall.js';
import { stackedScale } from './charts-stacked.js';
import { tornadoScale } from './charts-tornado.js';
const SAME = 1e-9;
/** The value axis a chart band is drawn with, for the kinds that have one that is read as a length from zero. */
export function valueAxisOf(b) {
    if (b.type === 'bars')
        return b.unit ? { label: `bars「${b.data[0]?.label ?? ''}」`, unit: b.unit, vertical: b.dir === 'v', min: 0, max: b.max, own: false } : undefined;
    if (b.type !== 'chart')
        return undefined;
    const label = (kind, first) => `${kind}「${first ?? ''}」`;
    if (b.kind === 'waterfall') {
        const s = b.spec, sc = waterfallScale(s);
        return s.unit ? { label: label('waterfall', s.steps[0]?.label), unit: s.unit, vertical: s.dir === 'v', min: sc.min, max: sc.max, own: s.axisGroup === false } : undefined;
    }
    if (b.kind === 'stacked') {
        const s = b.spec, sc = stackedScale(s);
        return sc && s.unit ? { label: label('stackedBars', s.columns[0]?.label), unit: s.unit, vertical: true, min: sc.min, max: sc.max, own: s.axisGroup === false } : undefined;
    }
    if (b.kind === 'tornado') {
        const s = b.spec, sc = tornadoScale(s);
        return s.unit ? { label: label('tornado', s.items[0]?.label), unit: s.unit, vertical: false, min: sc.min, max: sc.max, own: s.axisGroup === false } : undefined;
    }
    return undefined;
}
const isChartLike = (b) => b.type === 'chart' || b.type === 'bars';
const differ = (a, b) => Math.abs(a.min - b.min) > SAME || Math.abs(a.max - b.max) > SAME;
const describe = (a) => `${a.label} は ${a.min}〜${a.max}`;
function charts(band, out = []) {
    if (isChartLike(band))
        out.push(band);
    for (const c of nestedBandsOf(band))
        charts(c, out);
    return out;
}
/**
 * The pairs whose axes are read against each other (ADR 0029 D5): (1) charts in different groups of one `grouprow` (side by side: a reader compares heights),
 * with the value axis up the page; (2) charts that follow one another in the same list with no other chart between them (one under the other: a reader
 * compares lengths), with the value axis along the page. Always the same unit, neither marked `axisGroup: false`.
 */
export function axisMismatches(bands) {
    const out = [];
    const pair = (a, b, vertical) => {
        if (!a || !b || a.own || b.own || a.vertical !== vertical || b.vertical !== vertical || a.unit !== b.unit || !differ(a, b))
            return;
        out.push(`${describe(a)}、${describe(b)}（単位 ${a.unit}）`);
    };
    const visit = (list) => {
        let prev; // the chart just before, with nothing chart-like in between
        for (const b of list) {
            if (isChartLike(b)) {
                if (prev)
                    pair(valueAxisOf(prev), valueAxisOf(b), false);
                prev = b;
            }
            else if (charts(b).length)
                prev = undefined;
            if (b.type === 'grouprow') {
                const groups = b.children.map(g => g.type === 'group' ? charts(g).map(valueAxisOf) : []);
                for (const [i, gi] of groups.entries())
                    for (const gj of groups.slice(i + 1))
                        for (const x of gi)
                            for (const y of gj)
                                pair(x, y, true);
            }
            visit(nestedBandsOf(b));
        }
    };
    visit(bands);
    return [...new Set(out)];
}
