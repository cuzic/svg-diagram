import {boxHtml} from './html-box-band.ts';
import type {HtmlBandAdapter} from './html-adapter.ts';
import {visibleAt} from './reveal-visibility.ts';

export const rowHtml: HtmlBandAdapter<'row'> = {
  type: 'row',
  accepts: b => b.arrows.length === 0 && b.children.every(boxHtml.accepts),
  render: (b, day, tones, fb, roles, stage) => b.children.filter(c => visibleAt(c, stage)).map(c => boxHtml.render(c, day, tones, fb, roles, stage)).join(''),
};
