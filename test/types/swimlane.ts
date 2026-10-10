// Type-level tests for swimlane() and sequence(). Never executed (see ids.ts).
import {swimlane, sequence} from '../../lib/dsl.ts';
import type {SwimlaneLane} from '../../lib/types.ts';

export function swimlaneCases(): void {
  // ---- positive ----
  swimlane([{id: 'dev', label: 'D'}, {id: 'ops', label: 'O'}], [
    {id: 'a', lane: 'dev', title: 'A', body: 'b', lines: ['x', {text: 'y', bold: true}], tone: 'new', tag: 't', size: 16},
    {id: 'b', lane: 'ops', title: 'B', col: 2, span: 2, row: 1},
    {lane: 'dev', title: 'a step without an id'},
  ], {
    flows: [{from: 'a', to: 'b'}, {from: 'a:right', to: 'b:left@0.25', label: 'ok', chip: true, labelAt: 0.4}, {from: 'b', to: 'a', line: 'dashed', arrow: 'both', bend: 'start', bendOffset: 10}],
    phases: [{label: 'P', from: 1, to: 2}], labelW: 140,
  });
  // six lanes is the limit
  swimlane([{id: '1', label: ''}, {id: '2', label: ''}, {id: '3', label: ''}, {id: '4', label: ''}, {id: '5', label: ''}, {id: '6', label: ''}], []);
  // computed (non-literal) data degrades to "accept"
  const dynLanes: SwimlaneLane[] = [{id: 'x', label: 'X'}];
  const dynId: string = 'k';
  swimlane(dynLanes, [{id: dynId, lane: 'whatever', title: 'T'}], {flows: [{from: 'whatever', to: dynId}]});

  // ---- step.lane must be a declared lane ----
  // @ts-expect-error unknown lane
  swimlane([{id: 'dev', label: 'D'}], [{id: 'a', lane: 'qa', title: 'A'}]);

  // ---- flows' from / to must be step ids, with an optional :side[@t] ----
  // @ts-expect-error unknown source step
  swimlane([{id: 'dev', label: 'D'}], [{id: 'a', lane: 'dev', title: 'A'}], {flows: [{from: 'z', to: 'a'}]});
  // @ts-expect-error unknown target step (with a side)
  swimlane([{id: 'dev', label: 'D'}], [{id: 'a', lane: 'dev', title: 'A'}], {flows: [{from: 'a', to: 'z:left'}]});
  // @ts-expect-error unknown side
  swimlane([{id: 'dev', label: 'D'}], [{id: 'a', lane: 'dev', title: 'A'}, {id: 'b', lane: 'dev', title: 'B'}], {flows: [{from: 'a:lft', to: 'b'}]});
  // @ts-expect-error malformed offset
  swimlane([{id: 'dev', label: 'D'}], [{id: 'a', lane: 'dev', title: 'A'}, {id: 'b', lane: 'dev', title: 'B'}], {flows: [{from: 'a:left@x', to: 'b'}]});
  // @ts-expect-error a chip needs a label
  swimlane([{id: 'dev', label: 'D'}], [{id: 'a', lane: 'dev', title: 'A'}, {id: 'b', lane: 'dev', title: 'B'}], {flows: [{from: 'a', to: 'b', chip: true}]});

  // ---- step ids are unique ----
  // @ts-expect-error duplicate step id
  swimlane([{id: 'dev', label: 'D'}], [{id: 'a', lane: 'dev', title: 'A'}, {id: 'a', lane: 'dev', title: 'again'}]);

  // ---- rule swimlane-lanes: at most 6 lanes ----
  // @ts-expect-error seven lanes
  swimlane([{id: '1', label: ''}, {id: '2', label: ''}, {id: '3', label: ''}, {id: '4', label: ''}, {id: '5', label: ''}, {id: '6', label: ''}, {id: '7', label: ''}], []);

  // ---- exact option bags ----
  // @ts-expect-error unknown step option
  swimlane([{id: 'dev', label: 'D'}], [{id: 'a', lane: 'dev', title: 'A', colour: 'red'}]);
  // @ts-expect-error unknown lane tone
  swimlane([{id: 'dev', label: 'D', tone: 'purple'}], []);
  // @ts-expect-error sub-14px text
  swimlane([{id: 'dev', label: 'D'}], [{id: 'a', lane: 'dev', title: 'A', size: 12}]);
}

export function sequenceCases(): void {
  // ---- positive ----
  sequence([{id: 'user', label: '利用者'}, {id: 'api', label: 'API'}], [
    {from: 'user', to: 'api', label: 'POST', line: 'dashed', arrow: 'both'},
    {self: 'api', label: 'validate'},
    {note: 'n', over: 'api'},
    {note: 'n', over: ['user', 'api'], tone: 'accent'},
    {divider: 'phase 2'},
  ], {numbered: false, id: 'seq'});
  const dyn: string = 'x';
  sequence([{id: dyn, label: 'L'}], [{from: dyn, to: 'anyone', label: 'l'}]);

  // ids held in a plain (non-const) variable are `string`: nothing can be proven wrong, so they are accepted
  const widened = [{id: 'user', label: 'U'}];
  sequence(widened, [{from: 'user', to: 'db', label: 'x'}]);

  // ---- participants must be declared actors (runtime: "unknown actor") ----
  // @ts-expect-error unknown target actor
  sequence([{id: 'user', label: 'U'}, {id: 'api', label: 'A'}], [{from: 'user', to: 'db', label: 'x'}]);
  // @ts-expect-error unknown self actor
  sequence([{id: 'user', label: 'U'}, {id: 'api', label: 'A'}], [{self: 'db', label: 'x'}]);
  // @ts-expect-error unknown actor in a note
  sequence([{id: 'user', label: 'U'}, {id: 'api', label: 'A'}], [{note: 'n', over: ['user', 'db']}]);
  // ---- a message to yourself must be {self} (runtime: "has from === to") ----
  // @ts-expect-error from === to
  sequence([{id: 'user', label: 'U'}, {id: 'api', label: 'A'}], [{from: 'api', to: 'api', label: 'x'}]);
}
