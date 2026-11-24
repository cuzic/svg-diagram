import {at} from './finding-rules.ts';
import type {LaidOutFlowShape} from './flow-shapes.ts';
import type {Finding} from './types/verdicts.ts';

/** ADR 0065: a mark of a concentric with sectors whose label found no spot clear of the ring and sector lines. */
export function concentricFindings(b: LaidOutFlowShape): Finding[] {
  return (b.crossings ?? []).map(label => ({...at(b), rule: 'concentric-label-crossing', severity: 'warn', message: `concentric: 印 "${label}" の見出しが輪の線か区切り線（stack では段・列の線）をまたぐか、stack の外枠の外に出る（近くに重ならない場所がない）。見出しを短くする、印を別の輪・扇形に移す、輪を減らす`}));
}
