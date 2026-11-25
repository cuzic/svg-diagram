import { fromSources } from './finding-rules.js';
import { sourceOf } from './source-ref.js';
const SAME = 1e-9;
const isChartLike = (b) => b.type === 'chart' || b.type === 'bars';
const differ = (a, b) => Math.abs(a.min - b.min) > SAME || Math.abs(a.max - b.max) > SAME;
const describe = (a) => `${a.label} は ${a.min}〜${a.max}`;
/**
 * The pairs whose axes are read against each other (ADR 0029 D5): (1) charts in different groups of one `grouprow` (side by side: a reader compares heights),
 * with the value axis up the page; (2) charts that follow one another in the same list with no other chart between them (one under the other: a reader
 * compares lengths), with the value axis along the page. Always the same unit, neither marked `axisGroup: false`.
 */
export function compareAxes(bands, valueAxisOf, nestedBandsOf) {
    const charts = (band, out = []) => {
        if (isChartLike(band))
            out.push(band);
        for (const c of nestedBandsOf(band))
            charts(c, out);
        return out;
    };
    const out = new Map();
    const pair = (left, right, vertical) => {
        const a = valueAxisOf(left), b = valueAxisOf(right);
        if (!a || !b || a.own || b.own || a.vertical !== vertical || b.vertical !== vertical || a.unit !== b.unit || !differ(a, b))
            return;
        const message = `${describe(a)}、${describe(b)}（単位 ${a.unit}）`;
        const parts = out.get(message) ?? new Set();
        parts.add(left);
        parts.add(right);
        out.set(message, parts);
    };
    const visit = (list) => {
        let prev; // the chart just before, with nothing chart-like in between
        for (const b of list) {
            if (isChartLike(b)) {
                if (prev)
                    pair(prev, b, false);
                prev = b;
            }
            else if (charts(b).length)
                prev = undefined;
            if (b.type === 'grouprow') {
                const groups = b.children.map(g => g.type === 'group' ? charts(g) : []);
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
    return out;
}
export function axisMismatchFindings(pairs) {
    const found = [...pairs.keys()];
    const refs = [...pairs.values()].flatMap(parts => [...parts].map(b => sourceOf(b)));
    return found.length ? [{ ...fromSources(refs), rule: 'chart-axis-mismatch', severity: 'warn', message: `比べて読む 2 つのチャートの値の軸が違う: ${found.slice(0, 3).join('。')}${found.length > 3 ? ` ほか ${found.length - 3} 組` : ''}。同じ長さが別の値に見える。直し方: 両方に同じ domain を書く（bars は max）。横向きのチャートは、ラベルの列の幅が違うと同じ値が別の長さに見えるので、plotInset もそろえる。意図して別の軸なら axisGroup: false か accept` }] : [];
}
export const axisRules = /* @__PURE__ */ Object.freeze({
    'chart-axis-mismatch': { doc: "同じ単位で、横に並べる(同じ grouprow の別の group)か縦に続ける(間に別のチャートを挟まない)2 つのチャートの値の軸が違う。それぞれが自分のデータに合わせて軸を決めるので、同じ長さが別の値に見える(5.76 と 9.5 がほぼ同じ長さ)。両方に同じ domain: [0, 10] を書く(bars は max)。横向きのチャートは、ラベルの列の幅が違うと同じ値が別の長さに見えるので plotInset もそろえる。意図して別の量を別の軸で描くなら、axisGroup: false か accept", scope: 'band-grouped' },
});
