// Type-level tests: the public types come from 'svg-diagram' itself; cell() keeps tones literal. Never executed (see ids.ts).
import {table, cell} from '../../lib/dsl.ts';
import type {WfNode, TableCell, TextTone, RawColorTone, TableRow} from '../../lib/dsl.ts';

export function publicTypeCases(): void {
  const n: WfNode | undefined = undefined;
  const t: TextTone = 'accent';
  const c: RawColorTone = 'accent-soft';
  void [n, t, c];

  // a cell built apart from table() keeps its literal tone with cell()
  const ok = cell('通る', {tone: 'accent'});
  const cells: TableCell[] = [ok, 'x', 3];
  table([{label: 'a'}, {label: 'b'}, {label: 'c'}], [cells, {cells: [ok], tone: 'new'}]);
  // readonly (as const) rows are accepted
  const rows = [['a', {text: 'b', tone: 'danger'}]] as const;
  table([{label: 'a'}, {label: 'b'}], rows);
  const typed: TableRow = ['a', 'b'];
  void typed;

  // @ts-expect-error a widened `tone: string` is not a TextTone (the case cell() exists for)
  const widened = {text: '通る', tone: 'accent' as string}; const bad: TableCell = widened; void bad;
}
