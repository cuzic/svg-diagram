// Type-level tests: row() takes boxes and groups; ids inside groups are visible to connect(). Never executed (see ids.ts).
import {diagram, box, row, group, connect, banner} from '../../lib/dsl.ts';

export function groupRowCases(): void {
  diagram({theme: 'blue'}).add(
    row([group([box({id: 'a', title: 'A'})], {title: 'G1', flex: 2}), group([box({id: 'b', title: 'B'})], {title: 'G2', id: 'g2'})]),
    connect('a:right', 'b:left'),
    connect('g2:bottom', 'a:top'),
  );
  diagram({theme: 'blue'}).add(row([box({id: 'x', title: 'X'}), group([box({id: 'y', title: 'Y'})])]), connect('x', 'y'));
  // @ts-expect-error unknown id inside a row of groups
  diagram({theme: 'blue'}).add(row([group([box({id: 'a', title: 'A'})])]), connect('a', 'nope'));
  // a banner is wrapped in a frameless group
  row([banner({headline: 'h'})]);
  // @ts-expect-error a spacer cannot be a row child
  row([spacer(8)]);
}
