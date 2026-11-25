import {CAUSE_ROLES} from '../cause-roles.ts';
import type {LegendBand, LegendItem, LegendOpts} from '../types/containers.ts';
import {assertNoReveal} from './shared.ts';

// Key for line styles / tones used in the diagram. items:
//   {line: 'solid'|'dashed'|'dotted'|'double', arrow?: 'end'|'both'|'none', weight?: 'strong', label}
//   {tone: 'accent'|'muted'|'plain'|'danger'|'new'|'changed'|'removed', label}
export function legend(items: LegendItem[], opts: LegendOpts = {}): LegendBand {
  assertNoReveal(opts, 'legend()');
  for (const it of items) if (it.weight && it.line === 'double') throw new Error(`legend(): weight '${it.weight}' cannot go with line 'double' ("${it.label}")`);
  for (const it of items) {
    if (it.role !== undefined && !(it.role in CAUSE_ROLES)) throw new Error(`legend(): item "${it.label}" has role ${String(it.role)} (use ${Object.keys(CAUSE_ROLES).join(', ')})`);
    if (it.edge !== undefined && !['and', 'back', 'blocks'].includes(it.edge)) throw new Error(`legend(): item "${it.label}" has edge ${String(it.edge)} (use 'and', 'back' or 'blocks')`);
    if (it.mark !== undefined && it.mark !== 'core') throw new Error(`legend(): item "${it.label}" has mark ${String(it.mark)} (use 'core')`);
    if (it.ftaEvent !== undefined && !['basic', 'undeveloped', 'house', 'condition'].includes(it.ftaEvent)) throw new Error(`legend(): item "${it.label}" has ftaEvent ${String(it.ftaEvent)} (use 'basic', 'undeveloped', 'house' or 'condition')`);
    if (it.ftaGate !== undefined && !['and', 'or', 'vote', 'inhibit'].includes(it.ftaGate)) throw new Error(`legend(): item "${it.label}" has ftaGate ${String(it.ftaGate)} (use 'and', 'or', 'vote' or 'inhibit')`);
  }
  // a weight sample is a line sample: the plain line unless `line` says otherwise
  return {type: 'legend', items: items.map(it => it.weight && !it.line ? {...it, line: 'solid'} : it), align: opts.align ?? 'center'};
}
