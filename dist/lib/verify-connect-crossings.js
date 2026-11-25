import { fromSources } from './finding-rules.js';
import { must } from './must.js';
import { crossingsOf } from './polyline-metrics.js';
import { sourceOf } from './source-ref.js';
import { STRONG_STROKE } from './tokens.js';
export const connectorRules = /* @__PURE__ */ Object.freeze({
    'edge-crossings': { doc: '線どうしの交差・重なりがある', scope: 'band-grouped' },
    'arrow-labels': { doc: '一部にだけラベルがあり、ラベルのない矢印が多い', scope: 'diagram' },
    'connect-label-covers-arrow': { doc: "矢印のラベル(の下地)が、矢印の経路の 6 割より多くを覆い、見える部分が 20px に満たない。箱の間が狭く、矢じりや向きが読めなくなる。箱の間隔を広げる・ラベルを短くする・ラベルを箱の中に書く", scope: 'band-grouped' },
    'graph-orphan-node': { doc: '矢印でつないだ図の中に、どの矢印にもつながっていない箱がある（つなぎ忘れか、図に要らない箱。意図した注記なら id を付けない）', scope: 'band-grouped' },
    'graph-disconnected': { doc: '矢印でつないだ図が、互いにつながらない 2 つ以上のかたまりに分かれている（1 図 1 話なら、つなぎ忘れか、図を分ける）', scope: 'band-grouped' },
});
function segsOf(connects) {
    const out = [];
    connects.forEach((c, i) => { for (let k = 0; k < c.points.length - 1; k++)
        out.push({ i, c, a: must(c.points[k]), b: must(c.points[k + 1]) }); });
    return out;
}
const horiz = (s) => Math.abs(s.a.y - s.b.y) < 0.5;
const vert = (s) => Math.abs(s.a.x - s.b.x) < 0.5;
const lo = (a, b) => Math.min(a, b), hi = (a, b) => Math.max(a, b);
const strokeOf = (c) => c.weight === 'strong' ? STRONG_STROKE : 2;
export function edgeStats(connects) {
    // crossings: right-angle crossings inside the other line's span by 2px (polyline-metrics, shared with the layered layout's score)
    const crossings = crossingsOf(connects.map(c => c.points), { margin: 2, tol: 0.5 });
    const segs = segsOf(connects);
    let overlaps = 0;
    for (let i = 0; i < segs.length; i++)
        for (let j = i + 1; j < segs.length; j++) {
            const s = must(segs[i]), t = must(segs[j]);
            if (s.i === t.i)
                continue;
            // two lines this close (centre to centre) look like one: the normal width gives the usual 3, a strong line widens it
            const near = (strokeOf(s.c) + strokeOf(t.c)) / 2 + 1;
            const share = s.c.fromId === t.c.fromId || s.c.toId === t.c.toId || s.c.fromId === t.c.toId || s.c.toId === t.c.fromId;
            if (horiz(s) && vert(t) || vert(s) && horiz(t))
                continue;
            if (!share && horiz(s) && horiz(t) && Math.abs(s.a.y - t.a.y) < near) {
                if (Math.min(hi(s.a.x, s.b.x), hi(t.a.x, t.b.x)) - Math.max(lo(s.a.x, s.b.x), lo(t.a.x, t.b.x)) > 12)
                    overlaps++;
            }
            else if (!share && vert(s) && vert(t) && Math.abs(s.a.x - t.a.x) < near) {
                if (Math.min(hi(s.a.y, s.b.y), hi(t.a.y, t.b.y)) - Math.max(lo(s.a.y, s.b.y), lo(t.a.y, t.b.y)) > 12)
                    overlaps++;
            }
        }
    return { crossings, overlaps };
}
/** The connects (by index) that cross or overlap each other, for pointing at the pair rather than only counting. */
export function edgePairs(connects) {
    const crossings = [], overlaps = [];
    for (let i = 0; i < connects.length; i++)
        for (let j = i + 1; j < connects.length; j++) {
            const ci = must(connects[i]), cj = must(connects[j]);
            if (crossingsOf([ci.points, cj.points], { margin: 2, tol: 0.5 }) > 0)
                crossings.push([i, j]);
            const pair = edgeStats([ci, cj]);
            if (pair.overlaps > 0)
                overlaps.push([i, j]);
        }
    return { crossings, overlaps };
}
/** What to do about two lines that run back under a row (route: 'loop-under') and cross or overlap: the fix depends on whether their spans nest. */
function loopUnderHints(connects) {
    const name = (c) => `${c.fromId}→${c.toId}`;
    const span = (c) => [Math.min(...c.points.map(p => p.x)), Math.max(...c.points.map(p => p.x))];
    const { crossings, overlaps } = edgePairs(connects);
    const out = [];
    for (const [i, j] of overlaps) {
        const a = must(connects[i]), b = must(connects[j]);
        if (a.route !== 'loop-under' && b.route !== 'loop-under')
            continue;
        const [sa, sb] = [span(a), span(b)], nested = (sa[0] <= sb[0] && sb[1] <= sa[1]) || (sb[0] <= sa[0] && sa[1] <= sb[1]);
        out.push(nested ? `戻り ${name(a)} と ${name(b)} が同じ高さで重なる。外側の戻りに dip を書く（例: dip: 56）`
            : `戻り ${name(a)} と ${name(b)} が同じ高さで重なり、範囲が半端に重なる。dip を変えると交差になる。戻り先か戻り元を変えるか、1 本にまとめる`);
    }
    for (const [i, j] of crossings) {
        const a = must(connects[i]), b = must(connects[j]);
        if (a.route === 'loop-under' || b.route === 'loop-under')
            out.push(`戻り ${name(a)} と ${name(b)} が交差する（dip では消えない）。戻り先か戻り元を変えるか、1 本にまとめる`);
    }
    return out;
}
export function connectorFindings(d) {
    const out = [];
    const connects = d.connects ?? [];
    if (connects.length) {
        const { crossings, overlaps } = edgeStats(connects);
        if (crossings || overlaps) {
            const hints = loopUnderHints(connects);
            const pairs = connects.some(c => sourceOf(c)) ? edgePairs(connects) : undefined;
            const refs = pairs ? [...pairs.crossings, ...pairs.overlaps].flatMap(pair => pair.map(i => sourceOf(must(connects[i])))) : [];
            out.push({ ...fromSources(refs), rule: 'edge-crossings', severity: 'warn', message: `線の交差 ${crossings} 箇所、重なり ${overlaps} 箇所。${hints.length ? hints.slice(0, 3).join('。') : '箱や線の配置・レーンの順を見直す'}` });
        }
        const unlabeled = connects.filter(c => !c.label).length;
        // no label at all is a convention (the arrows only mean "depends on" / "next"); some labelled and most not is the inconsistency to flag
        if (connects.length >= 4 && unlabeled < connects.length && unlabeled / connects.length > 0.6)
            out.push({ rule: 'arrow-labels', severity: 'info', message: `矢印 ${connects.length} 本のうち ${unlabeled} 本にラベルがない。何が流れるか（成果物・プロトコル）を短く添える` });
    }
    return out;
}
