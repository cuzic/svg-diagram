// The checks of a fault tree (ADR 0025 D5): pure functions of the band's events; no layout, no fonts.
import type {FtaBand, FtaEvent} from './types/diagrams.ts';

export type FtaRule = 'fta-gate-one-input' | 'fta-vote-degenerate' | 'fta-top-is-leaf' | 'fta-undeveloped-left';
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
  return out;
}
