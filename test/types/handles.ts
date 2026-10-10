// Type-level tests: handles (`const list = box({id})`, `connect(list.right, ...)`) and closed string unions
// (rule ids, legend keys). Never executed (see ids.ts).
import {diagram} from '../../lib/dsl.ts';

export function handleCases(): void {

  // ---- closed string unions: rule ids and legend keys ----
  diagram({theme: 'blue', accept: {'edge-crossings': 'unavoidable', 'density': 'a catalogue'}});
  diagram({theme: 'blue', legend: 'auto', legendLabels: {'tone:new': '新規', 'line:dashed': '非同期', 'arrow:both': '双方向'}});
  // @ts-expect-error not a rule id (the keys of RULE_DOCS)
  diagram({theme: 'blue', accept: {'edge-crossing': 'typo'}});
  // @ts-expect-error not a legend key
  diagram({theme: 'blue', legendLabels: {'tone:plain': 'x'}});
  // @ts-expect-error not a legend key
  diagram({theme: 'blue', legendLabels: {'line:wavy': 'x'}});
}
