import {definedDiagramTitle} from './diagram-title.ts';
import {walkDefinedBands} from './band-def.ts';
import {budgetWarnings} from './budget.ts';
import {missingGlyphs} from './text-rules.ts';
import type {SourceRef} from './source-ref.ts';
import {findingAcceptanceHint, fromSources} from './finding-rules.ts';
import type {DiagramData} from './types/core.ts';
import type {Band, LaidOutDiagram} from './types/index.ts';
import type {Finding, LintTarget} from './types/verdicts.ts';

export function documentWidthFindings(d: Pick<DiagramData, 'medium' | 'canvas' | 'slide' | 'width' | 'maxWidth'>): Finding[] {
  const limit = d.maxWidth ?? 940;
  // a slide figure (a canvas, or one placed on a slide) is sized to its slot, not to the text column of a document
  return d.medium === 'doc' && !d.canvas && !d.slide && d.width > limit ? [{rule: 'doc-width', severity: 'warn', message: `幅 ${d.width}px。本文の表示幅（約 930px）に縮められ、文字が小さくなる（${limit}px 以下にする）`}] : [];
}

export function wrapFallbackFindings(d: Pick<LaidOutDiagram, 'wrapFellBack'>): Finding[] {
  return d.wrapFellBack ? [{rule: 'wrap-fell-back', severity: 'info', message: "wrap: 'bunsetsu-soft': 文節で折ると図が幅に収まらなかったので、従来の折り方（phrase）で配置した。漢字・ひらがなの途中で折れる行が残る。図を 2 枚に分ける、文言を短くする、図の幅を広げると、文節で折れる"}] : [];
}

export function pictographFindings(d: Pick<LintTarget, 'laidOut'>): Finding[] {
  const refs = new Set<SourceRef | undefined>();
  const glyphs = missingGlyphs(d.laidOut, ref => refs.add(ref));
  return glyphs.length ? [{...fromSources(refs), rule: 'glyph-missing', severity: 'warn', message: `絵文字として扱われない絵記号がある（${glyphs.map(g => `「${g}」`).join('')}）。通常の文字のフォントで描かれ、字形が無いと空白になる。直し方: icon.emoji() か SVG アイコン（box({icon})）を使う、または ✓ ✗ などの字に置き換える`}] : [];
}

export function textBudgetFindings(d: Pick<LintTarget, 'medium' | 'laidOut'>): Finding[] {
  const limits = d.medium === 'doc' ? {boxBody: 100, total: 700, boxes: 30} : undefined;
  return budgetWarnings({laidOut: d.laidOut ?? []}, limits).map(message => ({rule: 'density', severity: 'warn', message}));
}

const ASPECT_TALL = 1.5;

export function aspectTallFindings(d: Pick<LintTarget, 'medium' | 'canvas' | 'canvasHeight' | 'width'>, bands: () => readonly Band[]): Finding[] {
  if (d.medium !== 'doc' || d.canvas || d.canvasHeight === undefined || !(d.canvasHeight > ASPECT_TALL * d.width)) return [];
  const kinds = new Set(bands().map(b => b.type));
  const ways = [
    ...(kinds.has('cause') ? ['causeTree({fold})（折って段にする）'] : []),
    ...(kinds.has('row') || kinds.has('grid') || kinds.has('group') ? ['row({cols}) / grid で横に並べる'] : []),
    '図を 2 つに分ける（章・段階ごと）',
  ];
  return [{rule: 'aspect-tall', severity: 'info', message: `幅 ${d.width}px に対して高さ ${d.canvasHeight}px（縦横比 ${(d.canvasHeight / d.width).toFixed(2)}）。本の 1 ページに収まりにくい。${ways.join('、')}を検討する（${ASPECT_TALL} 倍までは出さない）`}];
}

export function missingTitleFindings(d: Pick<DiagramData, 'medium'>, title: string): Finding[] {
  return d.medium === 'doc' && !title
    ? [{rule: 'a11y-no-title', severity: 'warn', message: 'SVG の題名にできるテキストがない。diagram({title}) を指定する'}]
    : [];
}

/** Opt in to the document-wide geometry, wrapping, pictograph and text budget checks for selective rendering. */
export function documentFindings(diagram: LaidOutDiagram, stage?: number): Finding[] {
  return [
    ...wrapFallbackFindings(diagram),
    ...pictographFindings(diagram),
    ...aspectTallFindings(diagram, () => walkDefinedBands(diagram.bands)),
    ...documentWidthFindings(diagram),
    ...textBudgetFindings(diagram),
    ...missingTitleFindings(diagram, definedDiagramTitle(diagram, stage)),
  ];
}

export function documentAcceptHint(rule: string): string | undefined {
  const documented = ['doc-width', 'glyph-missing', 'density', 'a11y-no-title', 'slide-min-text', 'slide-canvas-overflow'];
  return documented.includes(rule) ? findingAcceptanceHint(rule) : undefined;
}
