import { at } from './finding-rules.js';
import { bendsOf } from './polyline-metrics.js';
// ---- edge-bends (ADR 0016 D6) ------------------------------------------------------------------------------------------------
// A band whose edges the layout routed: cause / states / bpmn / classes, and the network charts (pert, dependency, a causal loop that is
// not a ring). The lines a person drew with connect() are not counted, nor are self-loops. The thresholds come from the principle, not from
// the examples: a layered edge should turn no more than twice (one elbow) and a figure about 2 times on average, so 5 bends on one edge
// (two layers skipped at a bend each) and an average over 3 are what a reader sees as tangled.
export const EDGE_BENDS_MAX = 5, EDGE_BENDS_MEAN = 3;
function routedBands(bands, out = []) {
    for (const b of bands) {
        if (b.type === 'cause' || b.type === 'states' || b.type === 'bpmn' || b.type === 'classes')
            out.push({ band: b, name: `${b.type === 'states' && b.flavor === 'flowchart' ? 'flowchart' : b.type}${b.id ? ` ${b.id}` : ''}`, edges: b.edges });
        else if (b.type === 'chart' && b.edges)
            out.push({ band: b, name: `${b.kind}${b.id ? ` ${b.id}` : ''}`, edges: b.edges });
        else if (b.type === 'row' || b.type === 'grid')
            routedBands(b.children, out);
    }
    return out;
}
export function edgeBendFindings(d) {
    if (!d.laidOut)
        return [];
    const out = [];
    const severity = d.layoutCheck === 'strict' ? 'warn' : 'info';
    for (const band of routedBands(d.laidOut)) {
        const counted = band.edges.filter(e => e.from !== e.to && e.points.length >= 2).map(e => ({ e, bends: bendsOf(e.points) }));
        if (!counted.length)
            continue;
        const total = counted.reduce((n, c) => n + c.bends, 0), mean = total / counted.length;
        const worst = counted.filter(c => c.bends >= EDGE_BENDS_MAX).sort((p, q) => q.bends - p.bends);
        const parts = [];
        if (worst.length)
            parts.push(`${worst.length} 本が ${EDGE_BENDS_MAX} 回以上折れる（${worst.slice(0, 3).map(c => `${c.e.from} → ${c.e.to} が ${c.bends} 回`).join('、')}${worst.length > 3 ? ' ほか' : ''}）`);
        if (mean > EDGE_BENDS_MEAN)
            parts.push(`矢印 ${counted.length} 本の折れの合計 ${total}（平均 ${mean.toFixed(1)} 回、${EDGE_BENDS_MEAN} 回以下が目安）`);
        if (!parts.length)
            continue;
        out.push({ ...at(band.band), rule: 'edge-bends', severity, message: `${band.name}: ${parts.join('。')}。層を飛ぶ矢印・戻る矢印を減らす（辺の向き・節の分け方を見直す）`, data: { band: band.name, measured: worst[0]?.bends ?? Math.round(mean * 10) / 10, threshold: worst.length ? EDGE_BENDS_MAX : EDGE_BENDS_MEAN, fix: '層を飛ぶ辺・戻る辺を減らす（節の分け方・辺の向きを見直す）。意図した形なら accept で許容する' } });
    }
    return out;
}
export const edgeBendRules = /* @__PURE__ */ Object.freeze({
    'edge-bends': { doc: '自動配置の図（cause / states / bpmn / classes / semnet）で、1 本の矢印が 5 回以上折れる、または折れの合計 ÷ 矢印の数が 3 を超える。既定は情報、diagram({layoutCheck: "strict"}) で warn', scope: 'band' },
});
