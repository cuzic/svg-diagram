// Type-level tests: connect({via}) (ADR 0069 D2). Never executed (see ids.ts).
import {branch, connect} from '../../lib/dsl.ts';

export function viaCases(): void {
  connect('memo:right', 'c1:left', {via: {to: 'group'}});
  connect('memo:right', 'c1:left', {via: 'group', route: 'elbow', bend: 'auto'});
  connect('c1:bottom', 'z:top', {via: {from: 'group'}, label: 'x', chip: true});
  branch('memo:right', [{to: 'c1:left'}, {to: 'c2:left'}], {via: {to: 'group'}});
  // @ts-expect-error a loop runs round the boxes, not up to a frame
  connect('a:bottom', 'b:bottom', {route: 'loop-under', via: 'group'});
  // @ts-expect-error via names an end with 'group'
  connect('a:right', 'b:left', {via: {to: 'frame'}});
}
