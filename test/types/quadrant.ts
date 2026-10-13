// Type-level tests: the ids of quadrant() items are anchors for connect(); presets are a closed union. Never executed (see ids.ts).
import {diagram, box, connect, quadrant} from '../../lib/dsl.ts';

export function quadrantCases(): void {
  diagram({theme: 'blue'}).add(
    quadrant.preset('bcg', {items: [{id: 'a', label: 'A', at: [0.5, 0.5]}, {label: 'B', cell: [0, 0]}]}),
    box({id: 'n', title: 'n'}),
    connect('n:top', 'a:bottom'),
  );
  diagram({theme: 'blue'}).add(quadrant({id: 'q', x: {title: 'x'}, y: {title: 'y'}, items: [{id: 'p', label: 'P', at: [0.1, 0.1]}]}), box({id: 'n'}), connect('n', 'q'), connect('n', 'p'));
  // @ts-expect-error an item without an id is not an anchor
  diagram({theme: 'blue'}).add(quadrant.preset('bcg', {items: [{label: 'B', cell: [0, 0]}]}), box({id: 'n'}), connect('n', 'B'));
  // @ts-expect-error unknown preset
  quadrant.preset('swot');
  // @ts-expect-error the id of an item is not declared by another figure's items
  diagram({theme: 'blue'}).add(quadrant.preset('bcg', {items: [{id: 'a', label: 'A', at: [0.5, 0.5]}]}), box({id: 'n'}), connect('n', 'zz'));
}
