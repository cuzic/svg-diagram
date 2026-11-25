import { ftaResolve } from './fta.js';
import { ftaVar, minimalCutSets, singlePoints } from './fta-analysis.js';
export function ftaFindings(band) {
    const out = [], name = band.id ? `「${band.id}」` : '';
    const at = (msg) => `故障の木${name}: ${msg}`;
    const top = band.root, undeveloped = [];
    if (top.gate === undefined)
        out.push({ rule: 'fta-top-is-leaf', message: at(`頂上事象「${top.label}」にゲートが無い（1 つの事象だけの木）。原因を展開する`) });
    const walk = (e) => {
        if (e.ref !== undefined)
            return;
        const n = e.children?.length ?? 0;
        if (e.gate !== undefined && e.gate !== 'inhibit' && n === 1)
            out.push({ rule: 'fta-gate-one-input', message: at(`「${e.label}」の ${e.gate.toUpperCase()} ゲートの入力が 1 つだけ（ゲートが意味を持たない）。原因を足すか、ゲートを外す`) });
        if (e.gate === 'vote' && n >= 2 && (e.k === 1 || e.k === n))
            out.push({ rule: 'fta-vote-degenerate', message: at(`「${e.label}」の ${e.k}/${n} の多数決は ${e.k === 1 ? 'OR' : 'AND'} と同じ。${e.k === 1 ? 'OR' : 'AND'} と書く`) });
        if (e.kind === 'undeveloped')
            undeveloped.push(e.label ?? '');
        for (const c of e.children ?? [])
            walk(c);
    };
    walk(top);
    if (undeveloped.length)
        out.push({ rule: 'fta-undeveloped-left', severity: 'info', message: at(`展開していない事象（ひし形）が残っている: ${undeveloped.map(l => `「${l}」`).join('、')}。意図した省略でなければ原因を展開する`) });
    const { root, nodes } = ftaResolve(top), cuts = minimalCutSets(root);
    if (cuts.truncated)
        out.push({ rule: 'fta-single-point', severity: 'info', message: at('カットセットが多すぎて、単一故障点を調べていない（vote や AND の中の OR を減らすと調べられる）') });
    else {
        const single = singlePoints(cuts), seen = new Set(), lines = [];
        for (const n of nodes) {
            const v = ftaVar(n);
            if (!single.has(v) || seen.has(v))
                continue;
            seen.add(v);
            lines.push(`「${n.label}」${n.kind === 'undeveloped' ? '（未展開）' : ''}`);
        }
        if (lines.length)
            out.push({ rule: 'fta-single-point', severity: 'info', message: at(`単独で頂上事象を起こす事象（大きさ 1 のカットセット）がある: ${lines.join('、')}。冗長化か監視の対象にする`) });
    }
    return out;
}
export const ftaRules = /* @__PURE__ */ Object.freeze({
    'fta-gate-one-input': { doc: '故障の木(faultTree)の AND / OR / vote ゲートの入力が 1 つだけ。ゲートが意味を持たない。diagram({rcaCheck: "strict"}) で warn', scope: 'band' },
    'fta-vote-degenerate': { doc: '故障の木の vote ゲートの k が 1(OR と同じ)または入力の数(AND と同じ)。diagram({rcaCheck: "strict"}) で warn', scope: 'band' },
    'fta-top-is-leaf': { doc: '故障の木の頂上事象にゲートが無い(1 つの事象だけの木)。diagram({rcaCheck: "strict"}) で warn', scope: 'band' },
    'fta-undeveloped-left': { doc: '故障の木に、展開していない事象(ひし形)が残っている(常に info。意図した省略なら無視してよい)', scope: 'band' },
    'fta-single-point': { doc: '故障の木に、単独で頂上事象を起こす事象(大きさ 1 のカットセット)がある。カットセットが多すぎて調べられないときもこの規則の info(常に info)', scope: 'band' },
});
