// ADR 0080 spike (round 2): the plugin constructor's type (RawBand & Declares<Id>, standing in for PluginBand & Declares<Id>) in containers and connect().
// Must compile (run: node_modules/.bin/tsc --noEmit -p spikes/band-plugin/tsconfig.json). The one @ts-expect-error line (a bare typo) must STAY an error; the dotted sub-part line below it is deliberately NOT one.
import {areas, box, connect, diagram, group, row} from '../../lib/dsl-pure.ts';
import {PluginRegistry, pluginBands} from './host.ts';
import {ratingPlugin} from './rating-plugin.ts';

const rating = pluginBands(new PluginRegistry([ratingPlugin]), ratingPlugin);
export const top = diagram({theme: 'blue', title: 't'}).add(box({id: 'p', title: 'p'}), rating.stars({label: 'x', value: 1}, {id: 'r1'}), connect('p:right', 'r1:left'));
export const inGroup = diagram({theme: 'blue', title: 't'}).add(group([box({id: 'p2', title: 'p'}), rating.stars({label: 'x', value: 1}, {id: 'r2'})]), connect('p2:right', 'r2:left'));
export const inRow = diagram({theme: 'blue', title: 't'}).add(row([box({id: 'p3', title: 'p'}), rating.stars({label: 'x', value: 1}, {id: 'r3'})]), connect('p3:right', 'r3:left'));
// in areas() the cell band may carry an id equal to the area's name (containers.ts)
export const inAreas = diagram({theme: 'blue', title: 't'}).add(areas('a b', {a: box({title: 'a'}), b: rating.stars({label: 'x', value: 1}, {id: 'b'})}));
// a bare typo is rejected by the ids carried through Declares ...
// @ts-expect-error: 'r1x' is declared by no band
export const typo = diagram({theme: 'blue', title: 't'}).add(rating.stars({label: 'x', value: 1}, {id: 'r1'}), connect('r1x:right', 'r1:left'));
// ... but a dotted sub-part id is NOT checked (ADR 0012: IdProblem passes any `a.b`): sub-part refs are checked at run time only
export const dotted = diagram({theme: 'blue', title: 't'}).add(rating.stars({label: 'x', value: 1}, {id: 'r4'}), box({id: 'q', title: 'q'}), connect('q:right', 'r4.s99:left'));
