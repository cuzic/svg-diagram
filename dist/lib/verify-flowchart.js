import { at } from './finding-rules.js';
// A decision (a diamond) is a fork: it needs two or more arrows out, and each says which answer it is (ADR 0041 D5)
export function flowchartFindings(b) {
    const out = [];
    if (!b.nodes)
        return out;
    b.nodes.forEach((n, i) => {
        const id = b.anchors[i]?.id;
        if (n.shape !== 'diamond' || id === undefined)
            return;
        const leaving = b.edges.flatMap((e, k) => e.from === id && e.to !== id ? [{ e, k }] : []);
        if (leaving.length < 2)
            out.push({ ...at(b), rule: 'flowchart-decision-edges', severity: 'info', message: `判断「${id}」から出る矢印が ${leaving.length} 本。判断は分岐なので、2 本以上（Yes / No など）にする` });
        else if (leaving.length > 2)
            out.push({ ...at(b), rule: 'flowchart-decision-edges', severity: 'info', message: `判断「${id}」から出る矢印が ${leaving.length} 本。3 本以上の分岐は読みにくいので、2 つの判断に分ける` });
        const bare = leaving.filter(({ k }) => !b.labels.some(l => l.edge === k)).map(({ e }) => `${e.from} → ${e.to}`);
        if (bare.length && leaving.length >= 2)
            out.push({ ...at(b), rule: 'flowchart-decision-edges', severity: 'info', message: `判断「${id}」から出る矢印にラベルがない（${bare.join('、')}）。どの答えの矢印か分かるよう、Yes / No などを付ける` });
    });
    return out;
}
export const flowchartRules = /* @__PURE__ */ Object.freeze({
    'flowchart-decision-edges': { doc: '判断（flowchart のひし形）から出る矢印が 2 本未満、または 3 本以上、またはラベル（Yes / No など）がない', scope: 'band' },
});
