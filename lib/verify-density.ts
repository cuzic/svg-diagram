import {at} from './finding-rules.ts';
import type {LaidOutCause} from './types/diagrams.ts';
import type {LaidOutBand, LaidOutDiagram} from './types/index.ts';
import type {Finding} from './types/verdicts.ts';

export function causeBandsOf(bands: readonly LaidOutBand[], out: LaidOutCause[] = []): LaidOutCause[] {
  for (const b of bands) {
    if (b.type === 'cause') out.push(b);
    else if (b.type === 'row' || b.type === 'grid') causeBandsOf(b.children, out);
  }
  return out;
}

export function densityRestorationFindings(d: Partial<Pick<LaidOutDiagram, 'laidOut'>>): Finding[] {
  const out: Finding[] = [];
  // ADR 0070 D7 (U5): the canvas asked for lines scaled with the text, but the scaled figure did not fit; it is drawn with the old lines
  const dropped = causeBandsOf(d.laidOut ?? []).filter(b => b.lineScaleDropped);
  if (dropped.length) out.push({...at(dropped[0], ...dropped.slice(1)), rule: 'cause-line-scale-dropped', severity: 'info', message: 'causeTree(): 線の間隔を文字の倍率で広げると canvas に収まらないので、この図は広げない間隔で描いた（線の間隔 ÷ 文字が小さい）。canvas を高くする・minText を下げる・図を分けると広げられる'});
  const restored = (d.laidOut ?? []).filter(b => b.type === 'cause' && b.densityRestored || b.type === 'states' && b.densityRestored);
  const who = restored.map(b => b.type === 'cause' ? 'causeTree()' : b.type === 'states' && b.flavor === 'flowchart' ? 'flowchart()' : 'stateDiagram()');
  if (who.length) out.push({...at(restored[0], ...restored.slice(1)), rule: 'density-compact-restored', severity: 'info', message: `${[...new Set(who)].join('・')}: density: 'compact' にすると箱を通る矢印・重なるラベルが増えるので、この図は通常の間隔で描いた（高さは詰まっていない）`});
  return out;
}

export const densityRules = /* @__PURE__ */ Object.freeze({
  'cause-line-scale-dropped': {doc: "canvas の causeTree で、線の間隔を文字の倍率で広げた図が canvas の高さ・幅に収まらず、広げない間隔で描いた（情報）。canvas を高くする・minText を下げる・図を分けると広げられる", scope: 'band-grouped'},
  'density-compact-restored': {doc: "diagram({density: 'compact'}) の因果ツリー・状態遷移で、詰めた図のほうが検査の問題(箱を通る矢印・ラベルの重なり)が多いので、通常の間隔で描いた（情報）", scope: 'band-grouped'},
} as const);
