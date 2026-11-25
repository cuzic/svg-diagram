import {at} from './finding-rules.ts';
import type {FunnelBand} from './flow-shapes.ts';
import {must} from './must.ts';
import type {Finding} from './types/verdicts.ts';

export function funnelFindings(b: FunnelBand): Finding[] {
  return b.scale === 'value' && b.stages.some((s, i) => i > 0 && (s.value ?? 0) > (must(b.stages[i - 1]).value ?? 0)) ? [{...at(b), rule: 'funnel-values-rise', severity: 'warn', message: 'funnel() の value が下の段で増えている。漏斗の減少として読ませるなら、値または段の順を見直す'}] : [];
}

export const funnelRules = /* @__PURE__ */ Object.freeze({
  'funnel-values-rise': {doc: 'funnel({scale: "value"}) の値が下の段で増えている（漏斗として読むなら、値と段の順を確認する）', scope: 'band'},
} as const);
