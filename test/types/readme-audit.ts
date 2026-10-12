// Type-level tests that close gaps found when auditing README's 「コンパイル時に検出されるもの」 table against the other
// files in this directory: every row has at least one case that compiles and one `@ts-expect-error` case. Never executed.
import {diagram, box, banner, image, table, wireframe, sequence, group, grid, row, connect, branch, pyramid, curve, plane, swimlane, screens, stateMatrix, wf} from '../../lib/dsl.ts';
import type {Band} from '../../lib/types.ts';

export function readmeAuditCases(): void {
  const d = diagram({theme: 'blue'});

  // ---- row 1: connect() id must exist — one negative per kind of anchor the table lists ----
  d.add(banner({id: 'ban', headline: 'H'}), connect('ban', 'ban:top'));
  // @ts-expect-error a banner id that does not exist
  d.add(banner({id: 'ban', headline: 'H'}), connect('ban', 'bann'));
  // @ts-expect-error a table id that does not exist
  d.add(table([{label: 'c'}], [['v']], {id: 'tbl'}), connect('tbl', 'tbll'));
  // @ts-expect-error a wireframe id that does not exist
  d.add(wireframe(wf.text('x'), {id: 'wire'}), connect('wire', 'wyre'));
  // @ts-expect-error a sequence id that does not exist
  d.add(sequence([{id: 'u', label: 'U'}, {id: 'v', label: 'V'}], [{from: 'u', to: 'v', label: 'x'}], {id: 'seq'}), connect('seq', 'sec'));
  // @ts-expect-error a grid child id that does not exist
  d.add(grid([box({id: 'g1'}), box({id: 'g2'})], {cols: 2}), connect('g1', 'g3'));
  // @ts-expect-error a group id that does not exist
  d.add(group([box({id: 'in1'})], {id: 'zone'}), connect('zone', 'zon'));
  // the message names the missing id and lists the declared ones (the type of Err<...> is the text)
  // @ts-expect-error unknown anchor id "zzz" — declare it with {id: 'zzz'} (declared ids: a)
  d.add(box({id: 'a'}), connect('a', 'zzz'));
  // a literal template that CAN match a declared id is not rejected
  d.add(box({id: 'step1'}), connect('step1', `step${1 + 0}`));
  // several refs: one good, one bad -> the bad one is reported even though the other is fine
  // @ts-expect-error only the second connect is wrong
  d.add(box({id: 'a'}), box({id: 'b'}), connect('a', 'b'), connect('b', 'c'));

  // ---- row 2: ref format — side names, offsets ----
  connect('a:left@0', 'b:right@1');
  connect('a:top@0.5', 'b:bottom@.25');
  // @ts-expect-error an offset above 1 is not 0..1
  connect('a:left@1.5', 'b');
  // @ts-expect-error a negative offset
  connect('a:left@-1', 'b');
  // @ts-expect-error an uppercase side is not a side
  connect('a:Left', 'b');
  // refs with the same shape through a variable typed `string` cannot be proven wrong
  const dynamicRef: string = 'whatever:sideways';
  connect(dynamicRef, 'b');

  // ---- row 3-5: swimlane lanes ----
  swimlane([{id: 'a', label: 'A'}, {id: 'b', label: 'B'}], [{id: 's', lane: 'b', title: 'T'}]);
  // lane id typed with a different case
  // @ts-expect-error lane ids are case-sensitive
  swimlane([{id: 'dev', label: 'D'}], [{id: 's', lane: 'Dev', title: 'T'}]);
  // @ts-expect-error a flow with a label-less labelAt
  swimlane([{id: 'dev', label: 'D'}], [{id: 'a', lane: 'dev', title: 'A'}, {id: 'b', lane: 'dev', title: 'B'}], {flows: [{from: 'a', to: 'b', labelAt: 0.3}]});
  // @ts-expect-error a flow pointing at itself with a missing step plus a side
  swimlane([{id: 'dev', label: 'D'}], [{id: 'a', lane: 'dev', title: 'A'}], {flows: [{from: 'a:right', to: 'ghost:left@0.5'}]});
  // a flow with a good label is fine
  swimlane([{id: 'dev', label: 'D'}], [{id: 'a', lane: 'dev', title: 'A'}, {id: 'b', lane: 'dev', title: 'B'}], {flows: [{from: 'a:right@0.25', to: 'b:left', label: 'x', labelAt: 0.3}]});
  // @ts-expect-error eight lanes
  swimlane([{id: '1', label: ''}, {id: '2', label: ''}, {id: '3', label: ''}, {id: '4', label: ''}, {id: '5', label: ''}, {id: '6', label: ''}, {id: '7', label: ''}, {id: '8', label: ''}], []);

  // ---- row 6: box({step}) — number and string badges, and with title only ----
  box({step: 'A', title: 'T'});
  box({step: 3, title: 'T', body: 'b'});
  // @ts-expect-error step 0 still needs a title (the check is on the key, not on truthiness)
  box({step: 0});
  // @ts-expect-error a step must be a number or a string
  box({step: true, title: 'T'});

  // ---- row 7: diagram() fill/slide and theme/day ----
  diagram({day: 1, fill: true, slide: {page: 'p.html', heading: 'h'}});
  diagram({theme: 'blue', day: 2});
  // @ts-expect-error slide without fill is fine, fill without slide is not; here the heading is missing from the slide itself
  diagram({theme: 'blue', fill: true, slide: {page: 'p.html'}});
  // @ts-expect-error legacy day with fill: true and no slide
  diagram({day: 1, fill: true});
  // @ts-expect-error `fill` must be a boolean
  diagram({theme: 'blue', fill: 'yes'});

  // ---- row 8: connect option combinations, including the explicit 'straight' route ----
  // @ts-expect-error dip with an explicit straight route
  connect('a', 'b', {route: 'straight', dip: 4});
  // @ts-expect-error bendOffset with an explicit straight route
  connect('a', 'b', {route: 'straight', bendOffset: 4});
  // @ts-expect-error bend with an explicit straight route
  connect('a', 'b', {route: 'straight', bend: 'start'});
  // @ts-expect-error a chip even with `false` needs a label (the property is `never` without one)
  connect('a', 'b', {chip: false});
  connect('a', 'b', {route: 'elbow', bend: 'end', bendOffset: 0});
  connect('a', 'b', {route: 'elbow', bend: 'auto'});
  // @ts-expect-error a bend keyword that does not exist
  connect('a', 'b', {route: 'elbow', bend: 'middle'});
  branch('a', [{to: 'b', route: 'straight'}, {to: 'c', route: 'loop-under', dip: 5}]);
  // @ts-expect-error a straight branch cannot bend
  branch('a', [{to: 'b', route: 'straight', bend: 0.5}]);

  // ---- row 9: grid ----
  // @ts-expect-error cols is a number
  grid([box({title: 'a'})], {cols: '2'});
  // @ts-expect-error row children must be box bands (a grid is not one)
  row([grid([box({title: 'a'})], {cols: 1})]);

  // ---- row 10: pyramid / curve / raw ----
  // @ts-expect-error a variable of type string[] has no known length, so it cannot be passed (write the literal)
  pyramid(['a', 'b'] as string[]);
  // @ts-expect-error pyramid layers are strings or {text}
  pyramid(['a', 3]);
  // @ts-expect-error curve points held in a plain array have no known length
  curve([{y: 1}, {y: 0}] as {y: number}[]);
  curve([{y: 0}, {y: 1}, {y: 0.5, emphasis: 'muted'}]);
  // @ts-expect-error an unknown emphasis
  curve([{y: 0}, {y: 1, emphasis: 'rainbow'}]);

  // ---- row 11: font sizes — both ends of the allowed range ----
  box({title: 'T', size: 72});
  swimlane([{id: 'l', label: 'L'}], [{id: 's', lane: 'l', title: 'T', size: 14}]);
  // @ts-expect-error 73 is above the largest allowed size
  box({title: 'T', size: 73});
  // @ts-expect-error 13 is just under the floor
  box({title: 'T', size: 13});
  // @ts-expect-error a size in a swimlane step is held to the same floor
  swimlane([{id: 'l', label: 'L'}], [{id: 's', lane: 'l', title: 'T', size: 13}]);

  // ---- rows 12-14: state matrix ----
  stateMatrix(['a', 'b'], [{label: 'r', cells: ['na', {na: 'why'}]}], {required: ['b']});
  // @ts-expect-error required with a column name in a different case
  stateMatrix(['a', 'b'], [{label: 'r', cells: ['na', 'na']}], {required: ['A']});
  // @ts-expect-error a row whose cells are one short, in a matrix with three columns
  stateMatrix(['a', 'b', 'c'], [{label: 'r', cells: ['na', 'na']}]);

  // ---- row 15: sequence ----
  const s = sequence([{id: 'a', label: 'A'}, {id: 'b', label: 'B'}, {id: 'c', label: 'C'}], [{from: 'a', to: 'c', label: 'x'}, {from: 'c', to: 'a', label: 'y'}, {self: 'b', label: 'z'}, {note: 'n', over: ['a', 'c']}]);
  void s;
  // @ts-expect-error a self message written as a pair
  sequence([{id: 'a', label: 'A'}, {id: 'b', label: 'B'}], [{from: 'b', to: 'b', label: 'x'}]);
  // @ts-expect-error a note over an unknown actor
  sequence([{id: 'a', label: 'A'}], [{note: 'n', over: 'zz'}]);
  // @ts-expect-error a divider needs its text
  sequence([{id: 'a', label: 'A'}], [{divider: 3}]);

  // ---- row 16: option typos ----
  screens([{id: 'a', root: wf.text('x'), at: [0, 0.5], skeleton: true}], {cols: 2, gap: 40});
  // @ts-expect-error unknown screens option
  screens([{id: 'a', root: wf.text('x')}], {colls: 2});
  // @ts-expect-error unknown item option
  screens([{id: 'a', root: wf.text('x'), atRow: 1}]);
  // @ts-expect-error unknown banner tone
  banner({headline: 'h', tone: 'loud'});
  // @ts-expect-error a group option typo
  group([], {titel: 'x'});
  // the limitation the README states: options held in a variable skip the excess-key check
  const looseOpts = {headline: 'h', tonee: 'x'};
  banner(looseOpts);
  // bands held in a plain array are fine to add
  const some: Band[] = [box({id: 'q'})];
  d.add(some);
}

// ---- ergonomics: row({cols: [..], id}), d.connect(), connectDefaults, plane() ----
export function ergonomicsCases(): void {
  const top = row([box({id: 'a'}), box({id: 'b'})], {cols: [6, 6], id: 'top'});
  const bottom = row([box({id: 'c'})], {cols: [12], id: 'bottom'});
  // a column of a row is a handle; the row itself is one too
  connect(top.col(5).bottom, bottom.col(2).top);
  connect(top.right, bottom.col(1, 3).left);
  // @ts-expect-error a row built without an id has no handle
  row([box({id: 'x'})]).col(1);
  const d = diagram({theme: 'blue', connectDefaults: {chip: true, route: 'elbow', tone: 'accent'}});
  d.add(top, bottom).connect('a:right', 'c:left', {label: 'x'});
  // @ts-expect-error after the ids are known, an unknown one is rejected by d.connect()
  d.add(top, bottom).connect('a', 'zz');
  // @ts-expect-error a bad side is rejected
  d.connect('a:middle', 'b');
  // @ts-expect-error connectDefaults take connect options only
  diagram({theme: 'blue', connectDefaults: {colour: 'red'}});
  diagram({theme: 'blue', wireframeDefaults: {appbar: {title: 'T', nav: ['a']}, h: 'fit', frame: 'light'}});
  // @ts-expect-error the shell's `active` is a label or an index
  wireframe(wf.text('x'), {shell: {active: true}});
  plane({x: {max: 10}, y: {max: 10}, points: [{id: 'p', at: [1, 2]}], dims: [{from: 'p', to: [3, 4], label: 'd'}]});
  // @ts-expect-error a point is [x, y]
  plane({x: {max: 10}, y: {max: 10}, points: [{at: [1]}]});
}

// image(): a mark's id is an anchor of the band; an unknown one is a type error, and alt is checked at run time (test/image.test.ts)
export function imageCases(): void {
  const d = diagram({theme: 'blue'});
  const pic = image('./a.png', {alt: 'x', marks: [{id: 'pot', rect: [0, 0, 0.5, 0.5]}]});
  d.add(pic, box({id: 'n'}), connect(pic.anchors.pot.bottom, 'n:top'), connect('pot', 'n'));
  // @ts-expect-error a mark id that does not exist
  d.add(image('./a.png', {alt: 'x', marks: [{id: 'pot', rect: [0, 0, 0.5, 0.5]}]}), box({id: 'n'}), connect('pott', 'n'));
}
