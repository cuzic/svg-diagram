// The checks of a fault tree (ADR 0025 D5): pure functions of the band's events; no layout, no fonts.
import type {FtaBand, FtaEvent} from './types/diagrams.ts';
import {ftaResolve} from './fta.ts';
import {ftaVar, minimalCutSets, singlePoints} from './fta-analysis.ts';

export type FtaRule = 'fta-gate-one-input' | 'fta-vote-degenerate' | 'fta-top-is-leaf' | 'fta-undeveloped-left' | 'fta-single-point';
export interface FtaFinding {rule: FtaRule; message: string; /** Fixed: reported at this severity whatever diagram({rcaCheck}) says. */ severity?: 'info'}

export function ftaFindings(band: Pick<FtaBand, 'root' | 'id'>): FtaFinding[] {
  const out: FtaFinding[] = [], name = band.id ? `「${band.id}」` : '';
  const at = (msg: string): string => `故障の木${name}: ${msg}`;
  const top = band.root, undeveloped: string[] = [];
  if (top.gate === undefined) out.push({rule: 'fta-top-is-leaf', message: at(`頂上事象「${top.label}」にゲートが無い（1 つの事象だけの木）。原因を展開する`)});
  const walk = (e: FtaEvent): void => {
    if (e.ref !== undefined) return;
    const n = e.children?.length ?? 0;
    if (e.gate !== undefined && e.gate !== 'inhibit' && n === 1) out.push({rule: 'fta-gate-one-input', message: at(`「${e.label}」の ${e.gate.toUpperCase()} ゲートの入力が 1 つだけ（ゲートが意味を持たない）。原因を足すか、ゲートを外す`)});
    if (e.gate === 'vote' && n >= 2 && (e.k === 1 || e.k === n)) out.push({rule: 'fta-vote-degenerate', message: at(`「${e.label}」の ${e.k}/${n} の多数決は ${e.k === 1 ? 'OR' : 'AND'} と同じ。${e.k === 1 ? 'OR' : 'AND'} と書く`)});
    if (e.kind === 'undeveloped') undeveloped.push(e.label ?? '');
    for (const c of e.children ?? []) walk(c);
  };
  walk(top);
  if (undeveloped.length) out.push({rule: 'fta-undeveloped-left', severity: 'info', message: at(`展開していない事象（ひし形）が残っている: ${undeveloped.map(l => `「${l}」`).join('、')}。意図した省略でなければ原因を展開する`)});
  const {root, nodes} = ftaResolve(top), cuts = minimalCutSets(root);
  if (cuts.truncated) out.push({rule: 'fta-single-point', severity: 'info', message: at('カットセットが多すぎて、単一故障点を調べていない（vote や AND の中の OR を減らすと調べられる）')});
  else {
    const single = singlePoints(cuts), seen = new Set<string>(), lines: string[] = [];
    for (const n of nodes) {
      const v = ftaVar(n);
      if (!single.has(v) || seen.has(v)) continue;
      seen.add(v);
      lines.push(`「${n.label}」${n.kind === 'undeveloped' ? '（未展開）' : ''}`);
    }
    if (lines.length) out.push({rule: 'fta-single-point', severity: 'info', message: at(`単独で頂上事象を起こす事象（大きさ 1 のカットセット）がある: ${lines.join('、')}。冗長化か監視の対象にする`)});
  }
  return out;
}
