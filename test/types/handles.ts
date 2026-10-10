// Type-level tests: handles (`const list = box({id})`, `connect(list.right, ...)`) and closed string unions
// (rule ids, legend keys). Never executed (see ids.ts).
import {diagram, box, banner, table, group, row, screens, swimlane, connect, branch, wireframe, sequence, wf} from '../../lib/dsl.ts';
import type {AnchorRef} from '../../lib/strict.ts';

export function handleCases(): void {
  const d = diagram({theme: 'blue'});

  // ---- a band built with an id is a handle: sides and offsets are properties, so no id string is retyped ----
  const list = box({id: 'list', title: 'L'});
  const detail = box({id: 'detail', title: 'D'});
  d.add(row([list, detail]), connect(list.right, detail.left), connect(list.at('bottom', 0.25), detail.top), connect(list.center, detail.bottom));
  d.add(list, detail).add(connect(list.bottom, detail.top, {route: 'elbow', label: 'x'}));
  // a handle ref from an earlier statement is never "unknown", even when the call declares other ids
  d.add(box({id: 'other'}), connect(list.right, 'other:left'), connect('other', detail.left));
  const ban = banner({id: 'ban', headline: 'H'});
  const tbl = table([{label: 'c'}], [['v']], {id: 'tbl'});
  const wire = wireframe(wf.text('x'), {id: 'wire'});
  const seq = sequence([{id: 'u', label: 'U'}, {id: 'v', label: 'V'}], [{from: 'u', to: 'v', label: 'x'}], {id: 'seq'});
  const zone = group([box({id: 'in1'})], {id: 'zone'});
  d.add(ban, tbl, wire, seq, zone, connect(ban.bottom, tbl.top), connect(wire.right, seq.left), connect(zone.center, tbl.at('left', 0.5)));
  branch(list.bottom, [{to: detail.top}, {to: tbl.top, label: 'x'}]);

  // screens() and swimlane() hand out one handle per item / step id under `.anchors`
  const flow = screens([{id: 'a', root: wf.text('x')}, {id: 'b', root: wf.text('y'), at: [1, 0]}]);
  d.add(flow, connect(flow.anchors.a.right, flow.anchors.b.at('top', 0.5)));
  const lane = swimlane([{id: 'dev', label: 'D'}], [{id: 's1', lane: 'dev', title: 'T'}, {id: 's2', lane: 'dev', title: 'T'}]);
  d.add(lane, connect(lane.anchors.s1.right, lane.anchors.s2.left));

  // ---- by construction: no handle for an unknown id, a side that does not exist, or a band without an id ----
  // @ts-expect-error the side does not exist
  connect(list.middle, detail.left);
  // @ts-expect-error at() takes a side name
  list.at('middle', 0.5);
  // @ts-expect-error at() needs the offset
  list.at('top');
  // @ts-expect-error a band built without an id is not a handle
  connect(box({title: 'no id'}).right, detail.left);
  // @ts-expect-error the screens item does not exist
  connect(flow.anchors.c.right, flow.anchors.b.left);
  // @ts-expect-error the step does not exist
  connect(lane.anchors.s9.right, lane.anchors.s2.left);
  // @ts-expect-error a handle is not an arbitrary string: connect() needs a ref (a plain string is checked as before)
  connect(list, detail);
  // @ts-expect-error unknown ids written as strings are still rejected when they can be compared
  d.add(list, detail).add(connect('typo', detail.left));

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
