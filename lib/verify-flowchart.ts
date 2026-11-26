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
    const now = `高さ ${Math.round(b.h + 40)}px / 幅 ${Math.round(b.w + 40)}px = ${((b.h + 40) / (b.w + 40)).toFixed(2)}（${LADDER_SLIDE_ASPECT} まで）`, better = b.betterW;
    // the width is named only when laying the figure out at it draws it larger on a slide (its text scale, ADR 0083 U4); else the height is what binds
    const advice = better
      ? `diagram({width: ${better.w + 40}}) にすると高さが ${Math.round(better.fromH + 40)}px から ${Math.round(better.toH + 40)}px になり、スライドで文字が最大で約 ${Math.round((better.gain - 1) * 100)}% 大きくなる。段か sub を減らしても大きくなる`
      : '高さで大きさが決まり、幅を変えても文字は大きくならない。段か sub を減らす';
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
  'ladder-height-bound': {doc: 'decisionLadder() が 16:9 のスライドより縦長（高さが幅の 0.47 倍超）。示した幅にするか、段・sub を減らす', scope: 'band'},
  'flowchart-decision-edges': {doc: '判断（flowchart のひし形）から出る矢印が 2 本未満、または 3 本以上、またはラベル（Yes / No など）がない', scope: 'band'},
} as const);
