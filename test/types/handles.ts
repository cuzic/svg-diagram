// Type-level tests: handles (`const list = box({id})`, `connect(list.right, ...)`) and closed string unions
// (rule ids, legend keys). Never executed (see ids.ts).
import {diagram} from '../../lib/dsl.ts';
import type {AnchorRef} from '../../lib/strict.ts';

export function handleCases(): void {
  // ---- the ref format as a type ----
  const ok1: AnchorRef<'a' | 'b'> = 'a';
  const ok2: AnchorRef<'a' | 'b'> = 'b:left';
  const ok3: AnchorRef<'a' | 'b'> = 'a:top@0.25';
  void [ok1, ok2, ok3];
  // @ts-expect-error unknown id
  const bad1: AnchorRef<'a' | 'b'> = 'c';
  // @ts-expect-error unknown side
  const bad2: AnchorRef<'a' | 'b'> = 'a:middle';
  // @ts-expect-error the offset must be a number
  const bad3: AnchorRef<'a' | 'b'> = 'a:left@x';
  void [bad1, bad2, bad3];

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
