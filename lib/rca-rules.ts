// The checks of the cause-analysis tables and trees (ADR 0026 D1): pure functions of a figure's input, run when its constructor builds it.
// No layout and no fonts. The result goes in the band's `rca` field, which rcaRules() reads and the drawing never does.
import type {RcaFinding} from './types/core.ts';
import type {BowtieBand, WhyNode} from './types/diagrams.ts';

export interface IsIsNotRow {dim: string; is: string; isNot: string; distinct?: string; change?: string}
export interface IsIsNotHypothesis {text: string; results: readonly ('yes' | 'ifAssumed' | 'no')[]; assumes?: readonly string[]}

const blank = (s: string | undefined): boolean => s === undefined || !s.trim();

/** isisnot-no-isnot, isisnot-no-distinct-at-all: the specification table (what / where / when / extent). */
export function isIsNotFindings(rows: readonly IsIsNotRow[], dimLabel: (dim: string) => string): RcaFinding[] {
  const out: RcaFinding[] = [];
  const noIsNot = rows.filter(r => blank(r.isNot)).map(r => `「${dimLabel(r.dim)}」`);
  if (noIsNot.length) out.push({rule: 'isisnot-no-isnot', message: `IS NOT が空の行がある: ${noIsNot.join('、')}。比較対象（そうであってもおかしくないのに、そうでないもの）を書く`});
  if (rows.every(r => blank(r.distinct))) out.push({rule: 'isisnot-no-distinct-at-all', message: '「違い」が 1 つも無い。IS と IS NOT で鋭く違う点（1 行に 1 つでよい）を挙げる'});
  return out;
}

/** The number of rows a hypothesis cannot explain. */
export const unexplained = (h: Pick<IsIsNotHypothesis, 'results'>): number => h.results.filter(r => r === 'no').length;

/** The hypotheses that explain every row (no `no`), and, of those, the ones with the fewest assumptions. */
export function standingHypotheses(hs: readonly IsIsNotHypothesis[]): {standing: Set<number>; fewest: Set<number>} {
  const standing = new Set<number>();
  hs.forEach((h, i) => { if (unexplained(h) === 0) standing.add(i); });
  const least = Math.min(...[...standing].map(i => hs[i].assumes?.length ?? 0));
  const fewest = new Set([...standing].filter(i => (hs[i].assumes?.length ?? 0) === least));
  return {standing, fewest};
}

/** isisnot-no-hypothesis-stands: every hypothesis fails a row. Always info. */
export function isIsNotTestFindings(hs: readonly IsIsNotHypothesis[]): RcaFinding[] {
  if (!hs.length || standingHypotheses(hs).standing.size) return [];
  return [{rule: 'isisnot-no-hypothesis-stands', severity: 'info', message: '説明できない行が 0 の仮説が無い。原因はまだ分かっていない（新しい仮説を立てるか、スペックを見直す）'}];
}

export interface WhyChain {whys: readonly string[]; trueCause?: string; measure?: string}

/** The checks of the why-why table: a row is one chain. */
export function whyWhyTableFindings(chains: readonly WhyChain[]): RcaFinding[] {
  const out: RcaFinding[] = [];
  const label = (c: WhyChain, i: number): string => `行 ${i + 1}「${c.whys.at(-1) ?? ''}」`;
  const noRoot = chains.map((c, i) => [c, i] as const).filter(([c]) => blank(c.trueCause));
  if (noRoot.length) out.push({rule: 'whywhy-no-root', message: `真因（trueCause）の無い鎖がある: ${noRoot.map(([c, i]) => label(c, i)).join('、')}。どこまで掘ったかを真因として書く`});
  const sym = chains.map((c, i) => [c, i] as const).filter(([c]) => blank(c.trueCause) && !blank(c.measure));
  if (sym.length) out.push({rule: 'whywhy-measure-without-root', message: `真因が無いのに対策（measure）がある: ${sym.map(([c, i]) => label(c, i)).join('、')}。症状への対策になっていないか確かめる`});
  if (chains.length === 1) out.push({rule: 'whywhy-single-chain', severity: 'info', message: 'なぜなぜの鎖が 1 本だけ（分岐が無い）。原因が本当に 1 つに決まるか確かめる'});
  return out;
}


/** The checks of the why-why tree: the same rules as the table, on the nodes. */
export function whyWhyTreeFindings(whys: readonly WhyNode[]): RcaFinding[] {
  const out: RcaFinding[] = [];
  const leaves: string[] = [], symptom: string[] = [], dug: string[] = [];
  let branches = whys.length > 1;
  const walk = (n: WhyNode): void => {
    const kids = n.because ?? [];
    if (kids.length > 1) branches = true;
    if (!kids.length && !n.trueCause) leaves.push(`「${n.why}」`);
    if (!blank(n.measure) && !n.trueCause) symptom.push(`「${n.why}」`);
    if (n.trueCause && kids.length) dug.push(`「${n.why}」`);
    kids.forEach(walk);
  };
  whys.forEach(walk);
  if (leaves.length) out.push({rule: 'whywhy-no-root', message: `真因（trueCause: true）の無い葉がある: ${leaves.join('、')}。どこまで掘ったかを真因として印す`});
  if (symptom.length) out.push({rule: 'whywhy-measure-without-root', message: `真因でない節に対策（measure）がある: ${symptom.join('、')}。症状への対策になっていないか確かめる`});
  if (!branches) out.push({rule: 'whywhy-single-chain', severity: 'info', message: 'なぜなぜの木が 1 本の鎖だけ（分岐が無い）。原因が本当に 1 つに決まるか確かめる'});
  if (dug.length) out.push({rule: 'whywhy-dig-below-root', severity: 'info', message: `真因の節の下にまだ「なぜ」がある: ${dug.join('、')}。真因より下を掘っている（真因の印の付け方を見直す）`});
  return out;
}

/** bowtie-barrier-missing: a threat or a consequence with no barrier at all. */
export function bowtieFindings(band: Pick<BowtieBand, 'threats' | 'consequences'>): RcaFinding[] {
  const none = (list: readonly {label: string; barriers?: readonly string[]}[]): string[] => list.filter(s => !s.barriers?.length).map(s => `「${s.label}」`);
  const t = none(band.threats), c = none(band.consequences), out: RcaFinding[] = [];
  if (t.length) out.push({rule: 'bowtie-barrier-missing', message: `予防バリアが 1 つも無い脅威がある: ${t.join('、')}。防ぐ手を足すか、無いことを確かめる`});
  if (c.length) out.push({rule: 'bowtie-barrier-missing', message: `低減バリアが 1 つも無い結果がある: ${c.join('、')}。和らげる手を足すか、無いことを確かめる`});
  return out;
}
