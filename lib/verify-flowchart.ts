import {at} from './finding-rules.ts';
import {LADDER_SLIDE_ASPECT, tooTall} from './layout-util.ts';
import type {LaidOutStates} from './types/diagrams.ts';
import type {Finding} from './types/verdicts.ts';

// A decision (a diamond) is a fork: it needs two or more arrows out, and each says which answer it is (ADR 0041 D5)
export function flowchartFindings(b: LaidOutStates): Finding[] {
  const out: Finding[] = [];
  if (!b.nodes) return out;
  // a decisionLadder() taller than a 16:9 slide allows even with its row gaps packed: the slide draws it by its height, so a wider figure does not give larger text (ADR 0083 U4)
  if (b.arrange === 'ladder' && tooTall(b.h, b.w)) {
    const now = `高さ ${Math.round(b.h + 40)}px が幅 ${Math.round(b.w + 40)}px の ${((b.h + 40) / (b.w + 40)).toFixed(2)} 倍（${LADDER_SLIDE_ASPECT} 倍まで）`, base = b.oneLineW ?? 0, one = b.oneLineW === undefined ? undefined : base + 40;
    // narrower than the one-line width: the answers wrap and the figure is taller than it need be; wider: the figure is wider than the slide's height allows (the width binds)
    const advice = one === undefined || (b.w >= base && b.w - base <= 16)
      ? '16:9 のスライドでは高さで大きさが決まり、幅を変えても文字は大きくならない。段を減らす・sub（答えの 2 行目）を短くする'
      : b.w > base
        ? `答えの sub が 1 行に収まる幅は diagram({width: ${one}}) まで狭められる。スライドでは幅で大きさが決まっているので、狭めると文字が大きくなる（${one} より狭くすると sub が折り返す）`
        : `答えの sub が折り返して、高さが増えている。diagram({width: ${one}}) に広げると sub が 1 行になって高さが減り、スライドで文字が大きくなる。ほかに、段を減らす・sub を短くする`;
    out.push({...at(b), rule: 'ladder-height-bound', severity: 'info', message: `decisionLadder(): ${now}。${advice}`});
  }
  b.nodes.forEach((n, i) => {
    const id = b.anchors[i]?.id;
    if (n.shape !== 'diamond' || id === undefined) return;
    const leaving = b.edges.flatMap((e, k) => e.from === id && e.to !== id ? [{e, k}] : []);
    if (leaving.length < 2) out.push({...at(b), rule: 'flowchart-decision-edges', severity: 'info', message: `判断「${id}」から出る矢印が ${leaving.length} 本。判断は分岐なので、2 本以上（Yes / No など）にする`});
    else if (leaving.length > 2) out.push({...at(b), rule: 'flowchart-decision-edges', severity: 'info', message: `判断「${id}」から出る矢印が ${leaving.length} 本。3 本以上の分岐は読みにくいので、2 つの判断に分ける`});
    const bare = leaving.filter(({k}) => !b.labels.some(l => l.edge === k)).map(({e}) => `${e.from} → ${e.to}`);
    if (bare.length && leaving.length >= 2) out.push({...at(b), rule: 'flowchart-decision-edges', severity: 'info', message: `判断「${id}」から出る矢印にラベルがない（${bare.join('、')}）。どの答えの矢印か分かるよう、Yes / No などを付ける`});
  });
  return out;
}

export const flowchartRules = /* @__PURE__ */ Object.freeze({
  'ladder-height-bound': {doc: 'decisionLadder() の高さが幅の 0.47 倍を超え、16:9 のスライドより縦長（高さが幅の 0.47 倍を超える）。答えの sub が 1 行に収まる幅を示し、高さで決まるときは段・sub を減らす', scope: 'band'},
  'flowchart-decision-edges': {doc: '判断（flowchart のひし形）から出る矢印が 2 本未満、または 3 本以上、またはラベル（Yes / No など）がない', scope: 'band'},
} as const);
