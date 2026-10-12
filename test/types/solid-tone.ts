// Type-level tests: 'solid' / 'solid-danger' (EmphasisTone) reach box / banner / stat / a swimlane step / a legend item only. Never executed.
import {box, banner, stat, group, table, sequence, swimlane, legend} from '../../lib/dsl.ts';

export function solidToneCases(): void {
  box({title: 'a', tone: 'solid'});
  box({title: 'a', tone: 'solid-danger'});
  banner({headline: 'a', tone: 'solid'});
  stat('1', 'a', {tone: 'solid'});
  stat('1', 'a', {tone: 'accent'});
  legend([{tone: 'solid', label: '主役'}, {tone: 'solid-danger', label: '異常'}]);
  swimlane([{id: 'l', label: 'L'}], [{id: 's', lane: 'l', title: 'a', tone: 'solid'}]);

  // @ts-expect-error group() takes BoxTone: its children are white boxes (runtime: throws)
  group([], {tone: 'solid'});
  // @ts-expect-error a table's tone
  table([{label: 'a'}], [['x']], {tone: 'solid'});
  // @ts-expect-error a table row's tone: its cells are dark text
  table([{label: 'a'}], [{cells: ['x'], tone: 'solid'}]);
  // @ts-expect-error a sequence participant
  sequence([{id: 'a', label: 'A', tone: 'solid'}, {id: 'b', label: 'B'}], []);
  // @ts-expect-error a sequence note
  sequence([{id: 'a', label: 'A'}], [{note: 'n', over: 'a', tone: 'solid-danger'}]);
  // @ts-expect-error a swimlane lane
  swimlane([{id: 'l', label: 'L', tone: 'solid'}], [{id: 's', lane: 'l', title: 'a'}]);
  // @ts-expect-error not a text tone
  box({title: 'a', titleTone: 'solid'});
}
