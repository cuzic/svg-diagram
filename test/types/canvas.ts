// Type-level tests (checked by `tsc -p .`, never run): canvas() content keys follow the template, and its region ids are connect() anchors.
import {canvas, connect, diagram} from '../../lib/dsl.ts';

export function canvasCases(): void {
  const d = diagram({theme: 'blue'});
  d.add(canvas('swot', {strengths: ['a'], weaknesses: 'b'}));
  d.add(canvas('bmc', {value: ['v'], segments: ['s']}, {emphasis: ['value'], titles: {value: '価値'}, reveal: {value: 1}}));
  d.add(canvas('pest', {political: ['p'], legal: ['l']}, {pestle: true}));

  // @ts-expect-error  'strength' is not a region of swot (the keys are strengths / weaknesses / opportunities / threats)
  d.add(canvas('swot', {strength: ['a']}));
  // @ts-expect-error  'value' is a bmc region, not a swot one
  d.add(canvas('swot', {value: ['a']}));
  // @ts-expect-error  an unknown template
  d.add(canvas('swat', {}));
  // @ts-expect-error  emphasis names a region of the template
  d.add(canvas('swot', {}, {emphasis: ['value']}));
  // @ts-expect-error  titles keys are regions too
  d.add(canvas('swot', {}, {titles: {value: 'x'}}));
  // @ts-expect-error  pestle is for the 'pest' template only
  d.add(canvas('swot', {}, {pestle: true}));
  // @ts-expect-error  a tone is one of the box tones
  d.add(canvas('swot', {}, {tone: {strengths: 'pink'}}));
  // @ts-expect-error  an unknown option
  d.add(canvas('swot', {}, {width: 600}));
  // @ts-expect-error  a region's content is a string or strings, not a number
  d.add(canvas('swot', {strengths: 3}));

  // region ids are `${id}-${region}`: a connect() to a region of a canvas with an id type-checks, a made-up one does not
  d.add(canvas('swot', {}, {id: 'sw'})).add(connect('sw-strengths:right', 'sw-threats:left'));
  // @ts-expect-error  no such region
  d.add(canvas('swot', {}, {id: 'sw'})).add(connect('sw-value', 'sw-threats'));
}
