import type {DiagramData} from './types/core.ts';
import type {LaidOutDiagram} from './types/index.ts';
import type {Finding} from './types/verdicts.ts';

export function documentWidthFindings(d: Pick<DiagramData, 'medium' | 'canvas' | 'width' | 'maxWidth'>): Finding[] {
  const limit = d.maxWidth ?? 940;
  return d.medium === 'doc' && !d.canvas && d.width > limit ? [{rule: 'doc-width', severity: 'warn', message: `幅 ${d.width}px。本文の表示幅（約 930px）に縮められ、文字が小さくなる（${limit}px 以下にする）`}] : [];
}

export function wrapFallbackFindings(d: Pick<LaidOutDiagram, 'wrapFellBack'>): Finding[] {
  return d.wrapFellBack ? [{rule: 'wrap-fell-back', severity: 'info', message: "wrap: 'bunsetsu-soft': 文節で折ると図が幅に収まらなかったので、従来の折り方（phrase）で配置した。漢字・ひらがなの途中で折れる行が残る。図を 2 枚に分ける、文言を短くする、図の幅を広げると、文節で折れる"}] : [];
}

/** Opt in to the document-wide width and wrap-fallback checks for selective rendering. */
export function documentFindings(diagram: LaidOutDiagram): Finding[] {
  return [...wrapFallbackFindings(diagram), ...documentWidthFindings(diagram)];
}
