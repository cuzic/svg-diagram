// The checks of a TOC tree (ADR 0015 D2): pure functions of a cause band's nodes, links and `tree`; no layout, no fonts.
// They run only for a band that says which tree it is (`causeTree(..., {tree: 'crt'})`): relationDiagram() / pdpc() are not TOC trees.
import {breakCycles} from './graph-layout.ts';
import type {CauseBand} from './types/diagrams.ts';

export type TocRule = 'toc-ude-count' | 'toc-parts' | 'toc-source-has-cause' | 'toc-chain-only' | 'toc-orphan' | 'toc-cycle-undeclared';
export interface TocFinding {rule: TocRule; message: string}

/** The range of undesirable effects a current reality tree is built from (the guidance of the method, not a measure of the examples). */
export const UDE_RANGE = {min: 5, max: 10} as const;

type TocBand = Pick<CauseBand, 'nodes' | 'links' | 'tree'> & {id?: string};
// `back` (a declared feedback arrow) and `kind: 'blocks'` are not causes: they are left out of what is counted
type AnyLink = CauseBand['links'][number] & {back?: boolean; kind?: string};

const froms = (l: AnyLink): string[] => typeof l.from === 'string' ? [l.from] : [...l.from];
const isCause = (l: AnyLink): boolean => !l.back && l.kind !== 'blocks';

export function tocFindings(band: TocBand): TocFinding[] {
  const tree = band.tree;
  if (tree === undefined) return [];
  const out: TocFinding[] = [], name = band.id ? `「${band.id}」` : '';
  const at = (msg: string): string => `${tree.toUpperCase()}${name}: ${msg}`;
  const links = band.links as AnyLink[], causes = links.filter(isCause);
  const into = new Map<string, number>(), outOf = new Map<string, number>();
  for (const l of causes) { into.set(l.to, (into.get(l.to) ?? 0) + froms(l).length); for (const f of froms(l)) outOf.set(f, (outOf.get(f) ?? 0) + 1); }
  const withRole = (r: string): string[] => band.nodes.filter(n => n.role === r).map(n => n.id);

  if (tree === 'crt') {
    const n = withRole('ude').length;
    if (n < UDE_RANGE.min || n > UDE_RANGE.max) out.push({rule: 'toc-ude-count', message: at(`好ましくない現象（UDE）が ${n} 個。現状ツリーは ${UDE_RANGE.min}〜${UDE_RANGE.max} 個の UDE から根本原因へたどるのが指針（CRT の一部を抜き出した部分図なら、accept で理由を書いて許容する）`)});
    if (!withRole('root').length) out.push({rule: 'toc-parts', message: at("根本原因（role: 'root'）が無い")});
  }
  if (tree === 'frt') {
    const missing = [!withRole('injection').length ? "施策（role: 'injection'）" : '', !withRole('de').length ? "望む結果（role: 'de'）" : ''].filter(Boolean);
    if (missing.length) out.push({rule: 'toc-parts', message: at(`${missing.join('と')}が無い`)});
    const roots = withRole('root');
    if (roots.length) out.push({rule: 'toc-parts', message: at(`'root' は現状ツリーの根本原因の役割。未来現実ツリーの施策は 'injection' で書く: ${roots.join('、')}`)});
  }
  // an entity nobody controls the cause of: it must not be caused by anything
  const sources = band.nodes.filter(n => (n.role === 'root' && tree === 'crt') || (n.role === 'injection' && tree === 'frt') || n.role === 'precondition');
  const caused = sources.filter(n => (into.get(n.id) ?? 0) > 0).map(n => `${n.id}（${n.role}）`);
  if (caused.length) out.push({rule: 'toc-source-has-cause', message: at(`原因を持たない役割の実体に、入る矢印がある: ${caused.join('、')}。根本原因・施策・現状の事実は、ほかの実体の結果として描かない`)});

  if ((tree === 'crt' || tree === 'frt') && causes.length >= 2 && !causes.some(l => typeof l.from !== 'string')
    && band.nodes.every(n => (into.get(n.id) ?? 0) <= 1 && (outOf.get(n.id) ?? 0) <= 1)) {
    out.push({rule: 'toc-chain-only', message: at('分岐も合流も AND も無い 1 本鎖。TOC の因果ツリーは、複数の原因・結果が枝と合流でつながる（1 本の鎖は、途中の原因を飛ばしていることが多い）')});
  }
  // a cycle the author did not declare: the arrows that stay (a declared `back` and a `blocks` arrow are not causes) still close a loop
  const arrows = causes.flatMap(l => froms(l).map(f => ({from: f, to: l.to})));
  const returned = [...breakCycles(band.nodes, arrows)].map(i => `${arrows[i].from} -> ${arrows[i].to}`);
  if (returned.length) out.push({rule: 'toc-cycle-undeclared', message: at(`循環があるのに、戻りの矢印に back: true が付いていない。配置は次の矢印を戻りとして扱った(意味上の戻りと違うことがある): ${returned.join('、')}。悪循環の戻り(UDE から根本原因へ)のリンクに back: true を付ける`)});
  const linked = new Set(links.flatMap(l => [l.to, ...froms(l)]));
  const orphans = band.nodes.filter(n => !linked.has(n.id)).map(n => n.id);
  if (orphans.length) out.push({rule: 'toc-orphan', message: at(`どのリンクにも出てこない実体: ${orphans.join('、')}`)});
  return out;
}
