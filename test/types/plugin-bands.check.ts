import type {BandValue} from '../../lib/band-def.ts';
import type {PluginDef} from '../../lib/plugin.ts';
import {pluginBands} from '../../lib/plugin-bands.ts';
import {box, connect, diagram} from '../../lib/dsl-pure.ts';
import type {Declares} from '../../lib/strict.ts';

const plugin = {
  id: 'rating-demo',
  apiVersion: '0.1',
  bands: {
    stars: {
      build(input: {rating: number}) { return {rating: input.rating}; },
      layout(_data, {x, y, w}) { return {h: 8, laid: {x, y, w, h: 8}}; },
      emit() { return ''; },
    },
  },
} as const satisfies PluginDef;

const {stars} = pluginBands(plugin);
const rating: BandValue<'rating-demo:stars'> & Declares<'r'> = stars({rating: 4}, {id: 'r'});
const base = box({title: 'Base', id: 'b'});
const d = diagram({theme: 'blue'}).add(base, rating);
d.connect('b:right', 'r:left');
d.connect('b:right', 'r.s99:left');
diagram({theme: 'blue'}).add([base, rating], connect('b:right', 'r:left'));
// @ts-expect-error A bare typo in the anchor id must fail.
d.connect('b:right', 'rr:left');
// @ts-expect-error A bare typo in the same add() call must fail.
diagram({theme: 'blue'}).add(base, rating, connect('b:right', 'rr:left'));
// @ts-expect-error Core band discriminants still require their full shape.
d.add({type: 'row'});
// @ts-expect-error A plain namespaced value has no band definition.
d.add({type: 'rating-demo:stars'});
// @ts-expect-error The builder keeps the plugin's input type.
stars({rating: 'four'});
