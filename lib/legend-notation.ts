import {nestedBandsOf} from './band-children.ts';
import {ftaResolve} from './fta-resolve.ts';
import {fromSources} from './finding-rules.ts';
import {sourceOf} from './source-ref.ts';
import type {Finding} from './types/verdicts.ts';
import {must} from './must.ts';
import type {ConnectBand, LegendBand, LegendItem} from './types/containers.ts';
import type {ArrowWeight, EmphasisTone, LineStyle} from './types/core.ts';
import type {CauseRole, FtaGate, FtaKind, TreeItem} from './types/diagrams.ts';
import type {Band} from './types/index.ts';
import type {BoxBand} from './types/text-bands.ts';

export type LegendNotationBand = BoxBand | ConnectBand | LegendBand;

export const DEFAULT_LEGEND_LABELS = {
  'line:solid': '実線', 'line:dashed': '破線', 'line:dotted': '点線', 'line:double': '二重線', 'arrow:both': '双方向', 'weight:strong': '強い流れ',
  'tone:new': '新規', 'tone:changed': '変更・改修', 'tone:removed': '対象外', 'tone:danger': '異常・注意',
  'tone:muted': '補助・任意', 'tone:accent': '強調', 'tone:solid': '主役', 'tone:solid-danger': '異常(強)',
  // a causeTree() figure (ADR 0015 D6): an entity role, an arrow joined by an arc, the core driver mark
  'role:ude': '好ましくない現象(UDE)', 'role:root': '根本原因', 'role:de': '望む結果(DE)', 'role:injection': '施策', 'role:precondition': '現状の事実', 'role:tipping': '転換点', 'role:trim': 'トリミング(施策)', 'role:need': 'ニーズ',
  'role:goal': '目標', 'role:io': '中間目標', 'role:obstacle': '障害', 'role:action': '行動', 'role:start': '開始', 'role:risk': '懸念', 'role:measure': '対策',
  'edge:and': '合わせて原因(AND)', 'edge:back': '戻り(フィードバック)', 'edge:blocks': '断つ', 'mark:core': '中核ドライバー',
  // a faultTree() figure (ADR 0025 D6): the symbol of each kind of event and of each gate
  'fta-event:basic': '基本事象', 'fta-event:undeveloped': '未展開の事象', 'fta-event:house': '家形事象(常に起きる/起きない)', 'fta-event:condition': '条件事象',
  'fta-gate:and': 'AND ゲート', 'fta-gate:or': 'OR ゲート', 'fta-gate:vote': '多数決ゲート(k/n)', 'fta-gate:inhibit': '禁止ゲート',
} satisfies Record<`line:${LineStyle}` | 'arrow:both' | `weight:${ArrowWeight}` | `tone:${Exclude<EmphasisTone, 'plain'>}` | `role:${Exclude<CauseRole, 'effect' | 'step'>}` | 'edge:and' | 'edge:back' | 'edge:blocks' | 'mark:core' | `fta-event:${Exclude<FtaKind, 'event'>}` | `fta-gate:${FtaGate}`, string>; // `satisfies`: a new line style / tone without a label (or a stale key) fails tsc; NotationKey derives from this table

// every band, including those nested in groups, rows, grids and swimlanes
export function walkBands(bands: Band[], out: Band[] = []): Band[] {
  for (const b of bands) {
    out.push(b);
    walkBands(nestedBandsOf(b), out);
  }
  return out;
}

// the node tones of the auto-layout bands (tree / mindmap, classDiagram, bpmn): their nodes are not box() bands, so legend: 'auto' reads them here
function bandTones(bands: Band[]): string[] {
  const out: string[] = [];
  const walk = (it: TreeItem): void => { out.push(it.tone ?? 'plain'); it.children?.forEach(walk); };
  for (const b of bands) {
    if (b.type === 'tree') walk(b.root);
    else if (b.type === 'classes') for (const c of b.classes) out.push(c.tone ?? 'plain');
    else if (b.type === 'bpmn') for (const n of b.nodes) out.push(n.tone ?? 'plain');
  }
  return out;
}

// A canvas region with a pill says its tone in words.
export function wordedCanvasBands(all: Band[]): Set<Band> {
  return new Set(all.flatMap(b => b.type === 'grid' && b.canvas ? b.children.filter((_, i) => must(b.canvas).worded[i]) : []));
}

// notation keys a diagram uses: 'line:dashed', 'arrow:both', 'weight:strong', 'tone:new', ...
export function usedNotation(bands: Band[], dimmed = new Set<Band>(), withCause = false): Set<string> {
  const all = walkBands(bands);
  return usedBandNotation(all, dimmed, wordedCanvasBands(all), withCause);
}

function usedBandNotation(all: readonly Band[], dimmed: ReadonlySet<Band>, worded: ReadonlySet<Band>, withCause = false): Set<string> {
  const used = new Set<string>(), lines = new Set<string>();
  for (const b of all) {
    if (dimmed.has(b) || worded.has(b)) continue;
    if (b.type === 'connect') {
      lines.add(b.line ?? 'solid');
      if (b.arrow === 'both') used.add('arrow:both');
      if (b.weight) used.add(`weight:${b.weight}`);
    } else if (b.type === 'box' && b.tone && b.tone !== 'plain') used.add(`tone:${b.tone}`);
    else if (withCause && (b.type === 'tree' || b.type === 'classes' || b.type === 'bpmn')) { // only legend: 'auto' reads these (a lone accent root would make legend-missing / gray-tone noisy in the lint); bpmn also a dashed message flow
      for (const t of bandTones([b])) if (t !== 'plain') used.add(`tone:${t}`);
      if (b.type === 'bpmn') for (const f of b.flows) lines.add(f.line === 'dashed' ? 'dashed' : 'solid');
    }
    else if (b.type === 'cause' && withCause) { // only legend: 'auto' reads these (the legend-* checks keep their old count)
      // a role that roleTags writes in words on the node needs no swatch: two double-frame swatches side by side would only blur it
      // with focus the tones are focus's (solid / accent / muted), not the roles': a role swatch would show a colour no node has
      if (b.focused) { for (const n of b.nodes) if (n.tone && n.tone !== 'plain') used.add(`tone:${n.tone}`); }
      else for (const n of b.nodes) if (n.role && n.role !== 'effect' && n.role !== 'step' && !b.roleTags?.[n.role as keyof typeof b.roleTags]) used.add(`role:${n.role}`);
      if (b.links.some(l => typeof l.from !== 'string' && l.from.length > 1)) used.add('edge:and');
      if (b.links.some(l => l.back)) used.add('edge:back');
      if (b.links.some(l => l.kind === 'blocks')) used.add('edge:blocks');
      if (b.nodes.some(n => n.core)) used.add('mark:core');
    } else if (b.type === 'fta' && withCause) { // likewise: only legend: 'auto' reads the symbols of a fault tree
      for (const n of ftaResolve(b.root).nodes) {
        if (n.kind !== 'event') used.add(`fta-event:${n.kind}`);
        if (n.gate) used.add(`fta-gate:${n.gate}`);
      }
    }
  }
  const nonSolid = [...lines].filter(l => l !== 'solid');
  for (const l of nonSolid) used.add(`line:${l}`);
  if (nonSolid.length || used.has('arrow:both') || used.has('weight:strong')) used.add('line:solid'); // the plain line needs a legend entry once others exist
  return used;
}

export function legendKeys(bands: Band[]): Set<string> {
  return listedNotation(walkBands(bands));
}

function listedNotation(bands: readonly Band[]): Set<string> {
  const keys = new Set<string>();
  for (const b of bands) {
    if (b.type !== 'legend') continue;
    for (const it of b.items) {
      if (it.role) keys.add(`role:${it.role}`);
      else if (it.edge) keys.add(`edge:${it.edge}`);
      else if (it.mark) keys.add(`mark:${it.mark}`);
      else if (it.ftaEvent) keys.add(`fta-event:${it.ftaEvent}`);
      else if (it.ftaGate) keys.add(`fta-gate:${it.ftaGate}`);
      else if (it.tone) keys.add(`tone:${it.tone}`);
      else if (it.weight) keys.add(`weight:${it.weight}`);
      else if (it.arrow === 'both') keys.add('arrow:both');
      else keys.add(`line:${it.line ?? 'solid'}`);
    }
  }
  return keys;
}

// The legend labels of a diagram: the defaults, with 'accent' read as the runner-up ('次点') once the diagram has a solid ('主役') box:
// "主役 / 強調" would not say which is the upper step. An explicit legendLabels['tone:accent'] always wins.
export function legendLabelsFor(used: ReadonlySet<string>, custom?: Partial<Record<string, string>>): Record<string, string> {
  return {...DEFAULT_LEGEND_LABELS, ...(used.has('tone:solid') ? {'tone:accent': '次点'} : {}), ...(custom ?? {})} as Record<string, string>;
}

// diagram({legend: 'auto'}): add a legend entry for every notation used but not listed.
export function missingLegendItems(bands: Band[], custom?: Partial<Record<string, string>>, dimmed?: Set<Band>): LegendItem[] {
  const used = usedNotation(bands, dimmed, true), have = legendKeys(bands);
  const missing = [...used].filter(k => !have.has(k));
  if (!missing.length) return [];
  const labels = legendLabelsFor(used, custom);
  // a tone whose boxes are ALL dashed gets a dashed swatch
  const boxes = walkBands(bands).filter((b): b is BoxBand => b.type === 'box');
  const allDashed = (tone: string) => { const bs = boxes.filter(b => b.tone === tone); return bs.length > 0 && bs.every(b => b.dashed); };
  const labelOf = (k: string): string => {
    const label = labels[k];
    if (label === undefined) throw new Error(`diagram({legend: 'auto'}): no legend label for "${k}" — add it to legendLabels`);
    return label;
  };
  return missing.map((k): LegendItem => {
    const [kind, v = ''] = k.split(':');
    // v comes from our own `tone:<tone>` / `line:<style>` keys (usedNotation), so the casts hold
    if (kind === 'tone') return allDashed(v) ? {tone: v as EmphasisTone, dashed: true, label: labelOf(k)} : {tone: v as EmphasisTone, label: labelOf(k)};
    if (kind === 'role') return {role: v as CauseRole, label: labelOf(k)};
    if (kind === 'edge') return {edge: v as 'and' | 'back' | 'blocks', label: labelOf(k)};
    if (kind === 'mark') return {mark: v as 'core', label: labelOf(k)};
    if (kind === 'fta-event') return {ftaEvent: v as 'basic', label: labelOf(k)};
    if (kind === 'fta-gate') return {ftaGate: v as 'and', label: labelOf(k)};
    if (kind === 'arrow') return {line: 'solid', arrow: 'both', label: labelOf(k)};
    if (kind === 'weight') return {line: 'solid', weight: v as ArrowWeight, label: labelOf(k)};
    return {line: v as LineStyle, label: labelOf(k)};
  });
}

/** Check notation gathered from the participating bands in source order. */
export function legendFindings(all: readonly LegendNotationBand[], worded: ReadonlySet<Band>, custom?: Partial<Record<string, string>>, dim = new Set<Band>()): Finding[] {
  const used = usedBandNotation(all, dim, worded), have = listedNotation(all);
  if (!used.size) return [];
  const missing = [...used].filter(k => !have.has(k));
  if (!missing.length) return [];
  const labels = legendLabelsFor(used, custom);
  // say WHICH element uses each missing notation (a tone: the boxes drawn in it; a line / arrow: the connectors), not just the key
  const quote = (t: string | undefined): string => { const s = (t ?? '').replace(/\s+/g, ' ').trim(); return s ? `「${[...s].length > 14 ? `${[...s].slice(0, 14).join('')}…` : s}」` : ''; };
  const hasLegend = all.some(b => b.type === 'legend');
  const parts = new Set<Band>();
  const where = (k: string): string => {
    if (k.startsWith('tone:')) {
      const boxes = all.filter((b): b is BoxBand => b.type === 'box' && `tone:${b.tone}` === k && !dim.has(b));
      for (const b of boxes) if (!worded.has(b)) parts.add(b);
      const ex = boxes.slice(0, 3).map(b => quote(b.title ?? b.body)).filter(Boolean).join('');
      return boxes.length ? `${k.slice(5)} の色の箱 ${boxes.length} 枚${ex ? `: ${ex}${boxes.length > 3 ? ' ほか' : ''}` : ''}` : '';
    }
    if (k.startsWith('line:') || k.startsWith('weight:') || k === 'arrow:both') {
      const lines = all.filter(b => b.type === 'connect' && (k === 'arrow:both' ? b.arrow === 'both' : k.startsWith('weight:') ? `weight:${b.weight}` === k : `line:${b.line ?? 'solid'}` === k));
      for (const b of lines) if (!dim.has(b)) parts.add(b);
      return lines.length ? `該当する矢印・線 ${lines.length} 本` : '';
    }
    return '';
  };
  const names = missing.map(k => { const w = where(k); return `${k}（${w ? `${w}。` : ''}凡例の例: ${labels[k] ?? k}）`; }).join('、');
  const location = hasLegend ? fromSources(all.filter(b => parts.has(b)).map(b => sourceOf(b))) : {};
  return [{...location, rule: hasLegend ? 'legend-incomplete' : 'legend-missing', severity: 'warn', message: `凡例にない記法: ${names}。凡例に項目を足す（legend: 'auto' なら自動）か、凡例が要らない図なら legend: false`}];
}
