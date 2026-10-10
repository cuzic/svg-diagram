// Type-level tests (checked by `tsc -p .`, never run by `node --test`): connect() refs against declared ids.
// Positive cases must compile; every `@ts-expect-error` must be a real error (an unused one fails tsc).
// Nothing here executes: the cases live in a function that is never called.
import {diagram, build, box, banner, row, grid, group, connect, branch, screens, wireframe, table, sequence, swimlane, wf} from '../../lib/dsl.ts';
import type {Band, Diagram} from '../../lib/types.ts';

export function idCases(): void {
  const d = diagram({theme: 'blue'});

  // ---- ids declared in the SAME add() call: before or after the connect (forward refs inside one call are fine) ----
  d.add(box({id: 'a', title: 'A'}), box({id: 'b'}), connect('a', 'b'));
  d.add(connect('a', 'b'), box({id: 'a'}), box({id: 'b'}));
  d.add(box({id: 'a'}), box({id: 'b'}), connect('a:right', 'b:left'), connect('a:top@0.25', 'b:bottom@1'), connect('a:center', 'b:bottom@0'), connect('a:left@.5', 'b'));

  // ---- every kind of anchor counts ----
  d.add(banner({id: 'ban', headline: 'H'}), connect('ban', 'ban:bottom'));
  d.add(row([box({id: 'r1'}), box({id: 'r2'}), box({title: 'no id'})]), connect('r1:right', 'r2:left'));
  d.add(grid([box({id: 'g1'}), box({id: 'g2'})], {cols: 2}), connect('g1', 'g2'));
  d.add(group([row([box({id: 'in1'})]), box({id: 'in2'})], {id: 'zone', title: 'Z'}), connect('zone:left', 'in1'), connect('in2', 'in1'));
  d.add(screens([{id: 'list', root: wf.text('x')}, {id: 'detail', root: wf.text('y'), at: [1, 0.5]}]), connect('list:right', 'detail:left'));
  d.add(wireframe(wf.text('x'), {id: 'wire'}), table([{label: 'c'}], [['v']], {id: 'tbl'}), connect('wire:bottom', 'tbl:top'));
  d.add(sequence([{id: 'u', label: 'U'}, {id: 'v', label: 'V'}], [{from: 'u', to: 'v', label: 'x'}], {id: 'seq'}), box({id: 'x'}), connect('x', 'seq'));
  d.add(box({id: 'a'}), box({id: 'b'}), box({id: 'c'}), branch('a', [{to: 'b', label: 'yes'}, {to: 'c', label: 'no', bend: 'start'}]));

  // ---- ids carried by the type when add() calls are chained ----
  d.add(box({id: 'a'}), box({id: 'b'})).add(connect('a', 'b')).add(connect('b:left', 'a:right'));

  // a diagram that tracks ids is still a plain Diagram for build() and for code that does not care
  const tracked = d.add(box({id: 'a'}), box({id: 'b'}));
  const plain: Diagram = tracked;
  void build(tracked, 'out.svg');
  void plain;

  // ---- ids that are plain `string` (computed at run time) degrade to "accept everything" ----
  const dynamicId: string = ['x', 'y'].join('');
  d.add(box({id: dynamicId}), connect('anything', 'goes'));
  d.add(box({id: 'known'}), connect(dynamicId, 'known'), connect('known', `step${dynamicId.length}`), connect(`${dynamicId}:left`, 'known:top'));

  // bands spread from an array are not tuples: nothing is known, nothing is checked
  const dynBands: Band[] = [];
  d.add(...dynBands, connect('a', 'b'));
  d.add(dynBands);

  // ---- the limitation: with separate statements (add()'s result is not assigned) nothing is known, so nothing is checked ----
  d.add(box({id: 'earlier'}));
  d.add(connect('earlier', 'typo-is-only-caught-at-run-time'));

  // ---- unknown ids ----
  // @ts-expect-error unknown target id
  d.add(box({id: 'a'}), connect('a', 'zzz'));
  // @ts-expect-error unknown source id (with a side)
  d.add(box({id: 'a'}), connect('zzz:left', 'a'));
  // @ts-expect-error a typo of a row child id
  d.add(row([box({id: 'r1'}), box({id: 'r2'})]), connect('r1', 'r3'));
  // @ts-expect-error a screens item id that does not exist
  d.add(screens([{id: 'list', root: wf.text('x')}]), connect('list', 'detail'));
  // @ts-expect-error ids inside a group are checked too
  d.add(group([box({id: 'in1'}), connect('in1', 'nope')]));
  // @ts-expect-error branch() targets are refs as well
  d.add(box({id: 'a'}), branch('a', [{to: 'nope'}]));
  // @ts-expect-error a chained add() knows the ids declared by the earlier call
  d.add(box({id: 'a'})).add(connect('a', 'nope'));
  // @ts-expect-error forward refs ACROSS add() calls are rejected (the runtime allows them): declare both in one call
  d.add(box({id: 'a'}), connect('a', 'b')).add(box({id: 'b'}));

  // ---- malformed refs are rejected where they are written, ids or not ----
  // @ts-expect-error unknown side
  connect('a:lft', 'b');
  // @ts-expect-error unknown side on the target
  connect('a', 'b:middle');
  // @ts-expect-error the offset is not a number
  connect('a:left@x', 'b');
  // @ts-expect-error the offset is a fraction in 0..1
  connect('a:left@7', 'b');
  // @ts-expect-error nothing after the side separator
  connect('a:', 'b');
  // @ts-expect-error the offset needs a side: 'a@0.5' is read as an id, which does not exist
  d.add(box({id: 'a'}), connect('a@0.5', 'a:top'));
}
